/**
 * The upsell rules engine (F06): which ONE suggestion, if any, to show the guest now.
 *
 * Rules (Hopa H20–H24, test 10):
 * - at most one suggestion at a time; never chained (nothing follows an accepted suggestion); never pre-selected or
 *   added for the guest (this function only names it);
 * - never something already in the basket (or already chosen on the dish), sold out, outside its schedule, or hidden
 *   by the guest's filter;
 * - the highest priority wins, ties go to the smaller rule id (deterministic);
 * - a rule is shown at most `cap` times per visit; a rule the guest dismissed is not shown again in that visit.
 */
import type { Text } from './common.ts';
import type { Trigger } from './enums.ts';
import type { Unavailable } from './availability.ts';
import type { DishSelection } from './pricing.ts';
import type { AddonGroupV2, DishV2, SnapshotV2, UpsellRuleV2, UpsellSuggestion } from './snapshot.ts';
import { inWindow } from './time.ts';

/** Lookups a snapshot gives, built once per menu. */
export type MenuIndex = {
  readonly timeZone: string;
  readonly dishes: ReadonlyMap<string, DishV2>;
  readonly sectionOf: ReadonlyMap<string, string>;
  readonly groups: ReadonlyMap<string, AddonGroupV2>;
};

export function indexMenu(s: SnapshotV2): MenuIndex {
  const dishes = new Map<string, DishV2>();
  const sectionOf = new Map<string, string>();
  for (const sec of s.sections)
    for (const d of sec.dishes) {
      dishes.set(d.id, d);
      sectionOf.set(d.id, sec.id);
    }
  return { timeZone: s.venue.timeZone, dishes, sectionOf, groups: new Map(s.addonGroups.map((g) => [g.id, g] as const)) };
}

export type BasketLine = { readonly dishId: string; readonly selection?: DishSelection };

export type SuggestionContext = {
  readonly trigger: Trigger;
  readonly menu: MenuIndex;
  /** sheet: the dish whose sheet is open; add: the dish just added. Not used at checkout. */
  readonly dishId?: string | null;
  /** The choices on that dish so far (sheet) or as added (add). */
  readonly selection?: DishSelection | null;
  /** "My table" now; for `add` it already holds the line just added. */
  readonly basket: readonly BasketLine[];
  readonly now: Date | number;
  readonly unavailable: Unavailable;
  /** Dishes the guest's tag filter hides. */
  readonly filteredOut?: ReadonlySet<string>;
  /** How many times each rule was shown in this visit. */
  readonly shown?: ReadonlyMap<string, number>;
  /** Rules the guest dismissed in this visit. */
  readonly dismissed?: ReadonlySet<string>;
  /** The action came from accepting a suggestion: nothing follows it (never chained). */
  readonly fromSuggestion?: boolean;
};

export type Suggestion = { readonly ruleId: string; readonly suggest: UpsellSuggestion; readonly line: Text };

function basketMatches(m: { dishes: readonly string[]; sections: readonly string[] }, basketDishes: ReadonlySet<string>, menu: MenuIndex): boolean {
  for (const id of basketDishes) {
    if (m.dishes.includes(id)) return true;
    const sec = menu.sectionOf.get(id);
    if (sec !== undefined && m.sections.includes(sec)) return true;
  }
  return false;
}

const isEmpty = (m: { dishes: readonly string[]; sections: readonly string[] }): boolean => m.dishes.length === 0 && m.sections.length === 0;

function inScope(rule: UpsellRuleV2, ctx: SuggestionContext, basketDishes: ReadonlySet<string>): boolean {
  const sc = rule.scope;
  if (sc.kind === 'all') return ctx.trigger === 'checkout' ? basketDishes.size > 0 : ctx.dishId != null;
  if (ctx.trigger === 'checkout') return basketMatches(sc.kind === 'dish' ? { dishes: sc.ids, sections: [] } : { dishes: [], sections: sc.ids }, basketDishes, ctx.menu);
  if (ctx.dishId == null) return false;
  return sc.kind === 'dish' ? sc.ids.includes(ctx.dishId) : sc.ids.includes(ctx.menu.sectionOf.get(ctx.dishId) ?? '');
}

function units(sel: DishSelection | null | undefined, groupId: string): { units: number; chosen: Set<string> } {
  const g = sel?.groups.find((x) => x.groupId === groupId);
  const chosen = new Set<string>();
  let n = 0;
  for (const o of g?.options ?? []) {
    chosen.add(o.optionId);
    n += o.qty ?? 1;
  }
  return { units: n, chosen };
}

function suggestionOk(rule: UpsellRuleV2, ctx: SuggestionContext, basketDishes: ReadonlySet<string>): boolean {
  const sg = rule.suggest;
  if (sg.kind === 'dish') {
    const d = ctx.menu.dishes.get(sg.dishId);
    if (!d || d.price === null) return false;
    if (basketDishes.has(sg.dishId) || sg.dishId === ctx.dishId) return false;
    if (ctx.unavailable.dishes.has(sg.dishId)) return false;
    if (ctx.filteredOut?.has(sg.dishId)) return false;
    return true;
  }
  // an add-on of the dish in context: only at the sheet or right after the add
  if (ctx.trigger === 'checkout' || ctx.dishId == null) return false;
  const dish = ctx.menu.dishes.get(ctx.dishId);
  const attached = dish?.addons.find((a) => a.groupId === sg.groupId);
  const group = ctx.menu.groups.get(sg.groupId);
  if (!dish || !attached || !group) return false;
  const opt = group.options.find((o) => o.id === sg.optionId);
  if (!opt || ctx.unavailable.options.has(opt.id)) return false;
  const { units: n, chosen } = units(ctx.selection, sg.groupId);
  if (chosen.has(opt.id)) return false;
  if (group.selection === 'single' && n > 0) return false; // would replace the guest's own choice
  return n + 1 <= attached.max;
}

/** Rules in the order they compete: priority high to low, then id. */
export function rankRules(rules: readonly UpsellRuleV2[]): UpsellRuleV2[] {
  return [...rules].sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** At most one suggestion for this moment, or null. */
export function matchSuggestion(rules: readonly UpsellRuleV2[], ctx: SuggestionContext): Suggestion | null {
  if (ctx.fromSuggestion) return null;
  const basketDishes = new Set(ctx.basket.map((l) => l.dishId));
  for (const rule of rankRules(rules)) {
    if (!rule.active || rule.trigger !== ctx.trigger) continue;
    if (ctx.dismissed?.has(rule.id)) continue;
    if ((ctx.shown?.get(rule.id) ?? 0) >= rule.cap) continue;
    if (!inScope(rule, ctx, basketDishes)) continue;
    if (rule.when && !inWindow(rule.when, ctx.now, ctx.menu.timeZone)) continue;
    if (!isEmpty(rule.basketHas) && !basketMatches(rule.basketHas, basketDishes, ctx.menu)) continue;
    if (!isEmpty(rule.basketLacks) && basketMatches(rule.basketLacks, basketDishes, ctx.menu)) continue;
    if (!suggestionOk(rule, ctx, basketDishes)) continue;
    return { ruleId: rule.id, suggest: rule.suggest, line: rule.line };
  }
  return null;
}

/** The visit's memory after a suggestion was shown (the guest menu keeps it in memory only, never stored). */
export function recordShown(shown: ReadonlyMap<string, number>, ruleId: string): Map<string, number> {
  const next = new Map(shown);
  next.set(ruleId, (next.get(ruleId) ?? 0) + 1);
  return next;
}
