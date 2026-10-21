/**
 * The upsell rules engine (F06): which ONE suggestion, if any, to show the guest now.
 *
 * Rules (Hopa H20–H24, test 10):
 * - at most one suggestion at a time; never chained (nothing follows an accepted suggestion); never pre-selected or
 *   added for the guest (this function only names it);
 * - never something already in the basket (or already chosen on the dish), sold out, outside its schedule, or hidden
 *   by the guest's tag filter (`passesTagFilter`);
 * - the highest priority wins, ties go to the smaller rule id (deterministic);
 * - a rule is shown at most `cap` times per visit; a rule the guest dismissed is not shown again in that visit.
 */
import type { Text } from './common.ts';
import type { Tag, Trigger } from './enums.ts';
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
  /** The guest's tag filter (`passesTagFilter`): a suggested dish must pass it. */
  readonly tags?: readonly Tag[];
  /** Dishes hidden for another reason (or by a filter computed elsewhere; prefer `tags`). */
  readonly filteredOut?: ReadonlySet<string>;
  /** How many times each rule was shown in this visit. */
  readonly shown?: ReadonlyMap<string, number>;
  /** Rules the guest dismissed in this visit. */
  readonly dismissed?: ReadonlySet<string>;
  /** The action came from accepting a suggestion: nothing follows it (never chained). */
  readonly fromSuggestion?: boolean;
};

export type Suggestion = { readonly ruleId: string; readonly suggest: UpsellSuggestion; readonly line: Text };

/**
 * The guest's tag filter, in one place (the guest menu, the owner app's rule preview and `matchSuggestion`): a dish
 * passes when it has every tag asked for (AND), a vegan dish counting as vegetarian. No tags: every dish passes.
 */
export function passesTagFilter(dish: { readonly tags: readonly Tag[] }, tags: readonly Tag[]): boolean {
  return tags.every((t) => dish.tags.includes(t) || (t === 'vegetarian' && dish.tags.includes('vegan')));
}

function basketMatches(m: { dishes: readonly string[]; sections: readonly string[] }, basketDishes: ReadonlySet<string>, menu: MenuIndex): boolean {
  for (const id of basketDishes) {
    if (m.dishes.includes(id)) return true;
    const sec = menu.sectionOf.get(id);
    if (sec !== undefined && m.sections.includes(sec)) return true;
  }
  return false;
}


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

/** Why the suggestion itself cannot be shown (the rule's conditions hold), or null when it can. */
function suggestionWhy(rule: UpsellRuleV2, ctx: SuggestionContext, basketDishes: ReadonlySet<string>): NoSuggestion | null {
  const sg = rule.suggest;
  if (sg.kind === 'dish') {
    const d = ctx.menu.dishes.get(sg.dishId);
    if (!d) return { code: 'hidden' };
    if (d.price === null) return { code: 'no_price' };
    if (sg.dishId === ctx.dishId) return { code: 'same_dish' };
    if (basketDishes.has(sg.dishId)) return { code: 'in_basket' };
    if (ctx.unavailable.dishes.has(sg.dishId)) return { code: 'unavailable' };
    if (!passesTagFilter(d, ctx.tags ?? []) || ctx.filteredOut?.has(sg.dishId)) return { code: 'filtered' };
    return null;
  }
  // an add-on of the dish in context: only at the sheet or right after the add
  if (ctx.trigger === 'checkout' || ctx.dishId == null) return { code: 'option_not_on_dish' };
  const dish = ctx.menu.dishes.get(ctx.dishId);
  const attached = dish?.addons.find((a) => a.groupId === sg.groupId);
  const group = ctx.menu.groups.get(sg.groupId);
  if (!dish || !attached || !group) return { code: 'option_not_on_dish' };
  const opt = group.options.find((o) => o.id === sg.optionId);
  if (!opt) return { code: 'hidden' };
  if (ctx.unavailable.options.has(opt.id)) return { code: 'option_unavailable' };
  const { units: n, chosen } = units(ctx.selection, sg.groupId);
  if (chosen.has(opt.id)) return { code: 'option_chosen' };
  if (group.selection === 'single' && n > 0) return { code: 'option_would_replace' }; // would replace the guest's own choice
  if (n + 1 > attached.max) return { code: 'option_full' };
  return null;
}

/** Rules in the order they compete: priority high to low, then id. Published rules or stored rows alike. */
export function rankRules<R extends { readonly id: string; readonly priority: number }>(rules: readonly R[]): R[] {
  return [...rules].sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Why a rule suggests nothing at this moment, in the order `matchSuggestion` checks (the first that fails): a dish
 * suggestion is checked for `hidden` to `filtered`, an add-on suggestion for `option_not_on_dish`, then `hidden` (the
 * option is gone or hidden), then `option_unavailable` to `option_full`. One list keeps both orders.
 */
export const NO_SUGGESTION_CODES = [
  'chained', 'inactive', 'trigger', 'dismissed', 'cap', 'no_dish', 'basket_empty', 'scope', 'when', 'has', 'lacks',
  'option_not_on_dish', 'hidden', 'no_price', 'same_dish', 'in_basket', 'unavailable', 'filtered',
  'option_unavailable', 'option_chosen', 'option_would_replace', 'option_full',
] as const;
export type NoSuggestionCode = (typeof NO_SUGGESTION_CODES)[number];
/** `found`: for `lacks`, the basket's dishes the "basket lacks" condition names (directly or by their section). */
export type NoSuggestion = { readonly code: NoSuggestionCode; readonly found?: readonly string[] };

/**
 * The first reason this one rule suggests nothing now, or null when `matchSuggestion([rule], ctx)` would show it: the
 * owner app's rule preview. `matchSuggestion` is built on it, so the two always agree. `unavailable` and
 * `option_unavailable` say only that; the caller adds why and until when from its availability.
 * - `no_dish`: a sheet or add rule with no dish in context; `basket_empty`: at checkout with nothing in the basket;
 *   `scope`: the dish (or the basket at checkout) is outside the rule's scope.
 */
export function whyNoSuggestion(rule: UpsellRuleV2, ctx: SuggestionContext): NoSuggestion | null {
  if (ctx.fromSuggestion) return { code: 'chained' };
  if (!rule.active) return { code: 'inactive' };
  if (rule.trigger !== ctx.trigger) return { code: 'trigger' };
  if (ctx.dismissed?.has(rule.id)) return { code: 'dismissed' };
  if ((ctx.shown?.get(rule.id) ?? 0) >= rule.cap) return { code: 'cap' };
  const basketDishes = new Set(ctx.basket.map((l) => l.dishId));
  if (!inScope(rule, ctx, basketDishes)) {
    if (ctx.trigger !== 'checkout' && ctx.dishId == null) return { code: 'no_dish' };
    if (ctx.trigger === 'checkout' && basketDishes.size === 0) return { code: 'basket_empty' };
    return { code: 'scope' };
  }
  if (rule.when && !inWindow(rule.when, ctx.now, ctx.menu.timeZone)) return { code: 'when' };
  // null = no condition. A "has" condition with no targets matches nothing (it never turns into "always").
  if (rule.basketHas !== null && !basketMatches(rule.basketHas, basketDishes, ctx.menu)) return { code: 'has' };
  if (rule.basketLacks !== null && basketMatches(rule.basketLacks, basketDishes, ctx.menu)) {
    const m = rule.basketLacks;
    return { code: 'lacks', found: [...basketDishes].filter((id) => m.dishes.includes(id) || m.sections.includes(ctx.menu.sectionOf.get(id) ?? '')) };
  }
  return suggestionWhy(rule, ctx, basketDishes);
}

/** At most one suggestion for this moment, or null: the first rule, in `rankRules` order, with no `whyNoSuggestion`. */
export function matchSuggestion(rules: readonly UpsellRuleV2[], ctx: SuggestionContext): Suggestion | null {
  if (ctx.fromSuggestion) return null;
  for (const rule of rankRules(rules)) {
    if (whyNoSuggestion(rule, ctx) === null) return { ruleId: rule.id, suggest: rule.suggest, line: rule.line };
  }
  return null;
}

/** The visit's memory after a suggestion was shown (the guest menu keeps it in memory only, never stored). */
export function recordShown(shown: ReadonlyMap<string, number>, ruleId: string): Map<string, number> {
  const next = new Map(shown);
  next.set(ruleId, (next.get(ruleId) ?? 0) + 1);
  return next;
}
