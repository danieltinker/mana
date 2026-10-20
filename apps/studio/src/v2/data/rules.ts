// Upsell rules (F06) as the owner edits them: stored rows ↔ the rule form with the checks the database makes, the rule
// as the guest's phone will get it (app.build_snapshot_full's rules, mirrored for the draft being edited), priority by
// order, and the live preview: the contracts' matchSuggestion on the draft menu (preview_menu's snapshot) with a sample
// basket, and when nothing would be suggested, the first reason why: the contracts' whyNoSuggestion, on which
// matchSuggestion is built, so the verdict and the reason always agree. Pure.
import {
  LIMITS, SCOPE_KINDS, TAGS, TRIGGERS, addDays, defaultSelection, indexMenu, isHHMM, isWeekday, localParts, matchSuggestion, menuAvailability,
  oneOf, rankRules, stripBlank, textLength, unavailableOf, whyNoSuggestion, zonedTime,
} from '@mana/contracts';
import type {
  HHMM, LiveOverlay, MenuAvailability, NoSuggestion, ScopeKind, SnapshotV2, Suggestion, SuggestionContext, Tag, Trigger,
  UnavailableReason, UpsellRuleRow, UpsellRuleV2, Weekday,
} from '@mana/contracts';
import type { FieldError, Mapped } from './forms.ts';
import { WEEK, hhmm } from './hours.ts';

export type IdLists = { dishes: string[]; sections: string[] };
export type RuleForm = {
  /** The owner's own name for the rule; guests never see it. */
  label: string;
  trigger: Trigger;
  scopeKind: ScopeKind;
  scopeIds: string[];
  /** Empty = every day. */
  days: Weekday[];
  /** false = at any hour. */
  timed: boolean;
  from: string;
  to: string;
  /** null = no condition. */
  has: IdLists | null;
  lacks: IdLists | null;
  suggestKind: 'dish' | 'option';
  suggestDishId: string | null;
  suggestOptionId: string | null;
  /** The short line the guest reads with the suggestion. */
  lineHe: string;
  lineEn: string;
  priority: number;
  cap: number;
  active: boolean;
};
export type RuleWrite = Pick<UpsellRuleRow, 'label' | 'trigger' | 'scope_kind' | 'scope_ids' | 'days' | 'from_time' | 'to_time' | 'basket_has_dishes'
  | 'basket_has_sections' | 'basket_lacks_dishes' | 'basket_lacks_sections' | 'suggest_kind' | 'suggest_dish_id' | 'suggest_option_id' | 'line_he'
  | 'line_en' | 'priority' | 'cap' | 'active'>;

/** The schema's lengths (in code points) and ranges (upsell_rules' checks). */
const LABEL = 80;
const PRIORITY_MAX = 100;
export const DEFAULT_PRIORITY = 50;

const done = <T>(errors: FieldError[], value: T): Mapped<T> => (errors.length ? { ok: false, errors } : { ok: true, value });
const uniq = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

/** A new rule competes below the others (it can be dragged up): 5 under the lowest, or the default for the first. */
export function nextPriority(rules: readonly Pick<UpsellRuleRow, 'priority'>[]): number {
  return rules.length ? Math.max(0, Math.min(...rules.map((r) => r.priority)) - 5) : DEFAULT_PRIORITY;
}

/** "After a coffee, suggest a croissant": the most common rule, started for the owner. */
export const newRuleForm = (priority = DEFAULT_PRIORITY): RuleForm => ({
  label: '', trigger: 'add', scopeKind: 'dish', scopeIds: [], days: [], timed: false, from: '07:00', to: '11:00', has: null, lacks: null,
  suggestKind: 'dish', suggestDishId: null, suggestOptionId: null, lineHe: '', lineEn: '', priority, cap: 1, active: true,
});

export function ruleToForm(r: UpsellRuleRow): RuleForm {
  // a rule the database switched off because its "basket has" lost its last target keeps the condition, empty, to fill
  const has = r.basket_has_dishes.length + r.basket_has_sections.length > 0 || r.inactive_reason === 'basket_has_emptied';
  const lacks = r.basket_lacks_dishes.length + r.basket_lacks_sections.length > 0;
  return {
    label: r.label, trigger: r.trigger, scopeKind: r.scope_kind, scopeIds: [...r.scope_ids], days: WEEK.filter((d) => r.days.includes(d)),
    timed: r.from_time !== null, from: r.from_time ? hhmm(r.from_time) : '07:00', to: r.to_time ? hhmm(r.to_time) : '11:00',
    has: has ? { dishes: [...r.basket_has_dishes], sections: [...r.basket_has_sections] } : null,
    lacks: lacks ? { dishes: [...r.basket_lacks_dishes], sections: [...r.basket_lacks_sections] } : null,
    suggestKind: r.suggest_kind, suggestDishId: r.suggest_dish_id, suggestOptionId: r.suggest_option_id,
    lineHe: r.line_he, lineEn: r.line_en, priority: r.priority, cap: r.cap, active: r.active,
  };
}

/**
 * The columns to store, with every check the database makes before it would refuse (same codes as the snapshot
 * validator where one exists): too_long, enum_invalid, rule_scope_empty, too_many, days_invalid, time_invalid,
 * time_same, rule_condition_empty, suggestion_missing, rule_option_needs_dish, priority_invalid, cap_invalid.
 * Every day selected is stored as "every day" (no days).
 */
export function ruleFromForm(f: RuleForm): Mapped<RuleWrite> {
  const errors: FieldError[] = [];
  const label = stripBlank(f.label);
  if (textLength(label) > LABEL) errors.push({ field: 'label', code: 'too_long' });
  if (!oneOf(TRIGGERS, f.trigger)) errors.push({ field: 'trigger', code: 'enum_invalid' });
  if (!oneOf(SCOPE_KINDS, f.scopeKind)) errors.push({ field: 'scope', code: 'enum_invalid' });
  const scopeIds = f.scopeKind === 'all' ? [] : uniq(f.scopeIds);
  if (f.scopeKind !== 'all' && scopeIds.length === 0) errors.push({ field: 'scope', code: 'rule_scope_empty' });
  if (scopeIds.length > (f.scopeKind === 'section' ? LIMITS.sections : LIMITS.dishes)) errors.push({ field: 'scope', code: 'too_many' });
  if (!f.days.every(isWeekday)) errors.push({ field: 'days', code: 'days_invalid' });
  const days = WEEK.filter((d) => f.days.includes(d));
  if (f.timed) {
    if (!isHHMM(f.from) || !isHHMM(f.to)) errors.push({ field: 'time', code: 'time_invalid' });
    else if (f.from === f.to) errors.push({ field: 'time', code: 'time_same' });
  }
  const lists = (x: IdLists | null, field: string): IdLists => {
    if (!x) return { dishes: [], sections: [] };
    const out = { dishes: uniq(x.dishes), sections: uniq(x.sections) };
    if (out.dishes.length + out.sections.length === 0) errors.push({ field, code: 'rule_condition_empty' });
    return out;
  };
  const has = lists(f.has, 'has'), lacks = lists(f.lacks, 'lacks');
  const dish = f.suggestKind === 'dish';
  if (dish ? !f.suggestDishId : !f.suggestOptionId) errors.push({ field: 'suggest', code: 'suggestion_missing' });
  if (!dish && f.trigger === 'checkout') errors.push({ field: 'suggest', code: 'rule_option_needs_dish' });
  const lineHe = stripBlank(f.lineHe), lineEn = stripBlank(f.lineEn);
  if (textLength(lineHe) > LIMITS.ruleLine) errors.push({ field: 'line_he', code: 'too_long' });
  if (textLength(lineEn) > LIMITS.ruleLine) errors.push({ field: 'line_en', code: 'too_long' });
  if (!Number.isInteger(f.priority) || f.priority < 0 || f.priority > PRIORITY_MAX) errors.push({ field: 'priority', code: 'priority_invalid' });
  if (!Number.isInteger(f.cap) || f.cap < 1 || f.cap > LIMITS.ruleCap) errors.push({ field: 'cap', code: 'cap_invalid' });
  return done(errors, {
    label, trigger: f.trigger, scope_kind: f.scopeKind, scope_ids: scopeIds, days: days.length === WEEK.length ? [] : days,
    from_time: f.timed ? f.from : null, to_time: f.timed ? f.to : null,
    basket_has_dishes: has.dishes, basket_has_sections: has.sections, basket_lacks_dishes: lacks.dishes, basket_lacks_sections: lacks.sections,
    suggest_kind: f.suggestKind, suggest_dish_id: dish ? f.suggestDishId : null, suggest_option_id: dish ? null : f.suggestOptionId,
    line_he: lineHe, line_en: lineEn, priority: f.priority, cap: f.cap, active: f.active,
  });
}

// ---------------------------------------------------------------- the rule as guests get it
/** What a published menu shows, by id: a rule may only name these. */
export type Shown = { readonly dishes: ReadonlySet<string>; readonly sections: ReadonlySet<string>; readonly groups: ReadonlySet<string> };
export function shownOf(s: SnapshotV2): Shown {
  return {
    dishes: new Set(s.sections.flatMap((x) => x.dishes.map((d) => d.id))),
    sections: new Set(s.sections.map((x) => x.id)),
    groups: new Set(s.addonGroups.map((g) => g.id)),
  };
}

/** Why publishing leaves a rule out (the database's warning `rule_left_out`, same reasons). */
export type LeftOut = 'scope_empty' | 'suggestion_hidden' | 'basket_has_empty';

/**
 * A rule's columns as the snapshot builder publishes them (app.build_snapshot_full): the ids it names kept only where
 * guests see them, a "basket has" that names nothing guests see leaves the rule out (a condition is never published as
 * "no condition"), an emptied "basket lacks" becomes no condition, an add-on suggestion carries its group.
 * `optionGroup` maps every stored option to its group.
 */
export function ruleV2(id: string, w: RuleWrite, shown: Shown, optionGroup: ReadonlyMap<string, string>): { ok: true; rule: UpsellRuleV2 } | { ok: false; reason: LeftOut } {
  const keep = (ids: readonly string[], set: ReadonlySet<string>) => ids.filter((x) => set.has(x));
  const scope = keep(w.scope_ids, w.scope_kind === 'dish' ? shown.dishes : shown.sections);
  const has = { dishes: keep(w.basket_has_dishes, shown.dishes), sections: keep(w.basket_has_sections, shown.sections) };
  const lacks = { dishes: keep(w.basket_lacks_dishes, shown.dishes), sections: keep(w.basket_lacks_sections, shown.sections) };
  const group = w.suggest_option_id ? optionGroup.get(w.suggest_option_id) : undefined;
  if (w.scope_kind !== 'all' && scope.length === 0) return { ok: false, reason: 'scope_empty' };
  if (w.suggest_kind === 'dish' ? !(w.suggest_dish_id && shown.dishes.has(w.suggest_dish_id)) : !(group && shown.groups.has(group))) return { ok: false, reason: 'suggestion_hidden' };
  const hasCondition = w.basket_has_dishes.length + w.basket_has_sections.length > 0;
  if (hasCondition && has.dishes.length + has.sections.length === 0) return { ok: false, reason: 'basket_has_empty' };
  return {
    ok: true,
    rule: {
      id, trigger: w.trigger,
      scope: w.scope_kind === 'all' ? { kind: 'all' } : { kind: w.scope_kind, ids: scope },
      when: w.days.length === 0 && w.from_time === null ? null
        : { days: uniq(w.days).sort((a, b) => a - b), from: w.from_time ? hhmm(w.from_time) : null, to: w.to_time ? hhmm(w.to_time) : null },
      basketHas: hasCondition ? has : null,
      basketLacks: lacks.dishes.length + lacks.sections.length > 0 ? lacks : null,
      suggest: w.suggest_kind === 'dish' ? { kind: 'dish', dishId: w.suggest_dish_id! } : { kind: 'option', groupId: group!, optionId: w.suggest_option_id! },
      line: { he: w.line_he, en: w.line_en }, priority: w.priority, cap: w.cap, active: true,
    },
  };
}

// ---------------------------------------------------------------- priority by order
/** Rules in the order they compete: the contracts' rankRules (priority high to low, then id). */
export function ranked<T extends { id: string; priority: number }>(rows: readonly T[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r] as const));
  // rankRules reads only `priority` and `id`
  return rankRules(rows.map((r) => ({ id: r.id, priority: r.priority }) as unknown as UpsellRuleV2)).map((r) => byId.get(r.id)!);
}

/**
 * Move the rule at `from` to `to` in the ranked list and return the priorities to store (id → priority). The moved rule
 * takes a priority strictly between its new neighbours when there is room; otherwise every rule is numbered again
 * evenly from 100 down. Either way the list ranks (rankRules) exactly in the new order.
 */
export function reprioritize(rows: readonly { id: string; priority: number }[], from: number, to: number): Map<string, number> {
  const out = new Map<string, number>();
  if (from < 0 || from >= rows.length) return out;
  const target = Math.max(0, Math.min(rows.length - 1, to));
  if (target === from) return out;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved!);
  const above = next[target - 1], below = next[target + 1];
  const hi = above ? above.priority : PRIORITY_MAX + 1, lo = below ? below.priority : -1;
  if (hi - lo >= 2) {
    const p = above && below ? Math.floor((hi + lo) / 2) : above ? Math.max(lo + 1, hi - 5) : Math.min(hi - 1, lo + 5);
    out.set(moved!.id, p);
    return out;
  }
  const step = next.length > 1 ? PRIORITY_MAX / (next.length - 1) : 0;
  next.forEach((r, i) => { const p = Math.round(PRIORITY_MAX - i * step); if (p !== r.priority) out.set(r.id, p); });
  return out;
}

// ---------------------------------------------------------------- the live preview
export type Sample = {
  /** sheet: the dish the guest opened; add: the dish just added. Not used at checkout. */
  dishId: string | null;
  /** Dishes in "my table" (for add, besides the one just added). */
  basket: string[];
  weekday: Weekday;
  time: HHMM;
  /** The guest's tag filter (the contracts' passesTagFilter: every tag asked for; a vegan dish counts as vegetarian). */
  tags: Tag[];
  /** The dish was added from a suggestion (add only): nothing follows it, never a chain. */
  fromSuggestion: boolean;
};

/** This week's instant of a sample day and time on the venue's clock (today when it is that day). */
export function sampleAt(now: number, weekday: Weekday, time: HHMM, tz: string): number {
  const today = localParts(now, tz);
  return zonedTime(addDays(today.date, (weekday - today.weekday + 7) % 7), time, tz);
}

/**
 * Why the rule suggests nothing here: publishing leaves it out (`left_out`), or the contracts' whyNoSuggestion, with
 * the reason and the moment something unavailable comes back added from the availability the preview used.
 */
export type Why =
  | { code: 'left_out'; reason: LeftOut }
  | { code: 'unavailable'; reason: UnavailableReason; back: Date | null }
  | { code: 'option_unavailable'; back: Date | null }
  | { code: 'lacks'; found: string[] }
  | { code: Exclude<NoSuggestion['code'], 'unavailable' | 'option_unavailable' | 'lacks'> };

export type Preview = {
  /** The sample's instant. */
  readonly at: number;
  /** This rule on its own: what it would suggest. */
  readonly mine: Suggestion | null;
  /** When `mine` is null, the first reason, in the order the engine checks. */
  readonly why: Why | null;
  /** What the guest would see with every rule (this draft in place of its stored version): one suggestion at most. */
  readonly shown: Suggestion | null;
  /** The rule is switched off: `mine` says what it would do once on. */
  readonly off: boolean;
};

export type PreviewInput = {
  /** The draft menu as guests would get it (preview_menu). */
  readonly snapshot: SnapshotV2;
  /** What is off and the hours, as the guest's phone gets them. */
  readonly live: LiveOverlay;
  readonly id: string;
  readonly write: RuleWrite;
  readonly optionGroup: ReadonlyMap<string, string>;
  readonly sample: Sample;
  readonly now: number;
};

/** The tags a sample may ask for, in the contracts' order. */
export const sampleTags = (tags: readonly Tag[]): Tag[] => TAGS.filter((x) => tags.includes(x));

export function previewRule(p: PreviewInput): Preview {
  const s = p.snapshot;
  const at = sampleAt(p.now, p.sample.weekday, p.sample.time, s.venue.timeZone);
  const menu = indexMenu(s);
  const av = menuAvailability(s, p.live, at);
  // a view-only menu can be browsed while the venue is closed; one that takes orders cannot sell then
  const unavailable = unavailableOf(av, s.venue.mode !== 'view_only');
  const trigger = p.write.trigger;
  const dishId = trigger === 'checkout' ? null : p.sample.dishId && menu.dishes.has(p.sample.dishId) ? p.sample.dishId : null;
  const inBasket = p.sample.basket.filter((id) => menu.dishes.has(id));
  const basket = uniq(trigger === 'add' && dishId ? [...inBasket, dishId] : inBasket);
  const dish = dishId ? menu.dishes.get(dishId) : undefined;
  const ctx: SuggestionContext = {
    trigger, menu, dishId, selection: dish ? defaultSelection(dish, { groups: menu.groups, unavailable }) : null,
    basket: basket.map((d) => ({ dishId: d })), now: at, unavailable, tags: sampleTags(p.sample.tags),
    fromSuggestion: trigger === 'add' && p.sample.fromSuggestion,
  };
  const off = !p.write.active;
  const others = s.upsellRules.filter((r) => r.id !== p.id);
  const v2 = ruleV2(p.id, p.write, shownOf(s), p.optionGroup);
  if (!v2.ok) return { at, mine: null, why: { code: 'left_out', reason: v2.reason }, shown: matchSuggestion(others, ctx), off };
  const mine = matchSuggestion([v2.rule], ctx);
  const no = mine ? null : whyNoSuggestion(v2.rule, ctx);
  return { at, mine, why: no ? whyOf(no, v2.rule, av) : null, shown: matchSuggestion(off ? others : [...others, v2.rule], ctx), off };
}

/** The contracts' reason, with why and until when something unavailable is (from the availability the preview used). */
function whyOf(no: NoSuggestion, rule: UpsellRuleV2, av: MenuAvailability): Why {
  const sg = rule.suggest;
  if (no.code === 'unavailable' && sg.kind === 'dish') {
    const a = av.dishes.get(sg.dishId);
    return { code: 'unavailable', reason: a && !a.available ? a.reason : 'off', back: a && !a.available ? a.back : null };
  }
  if (no.code === 'option_unavailable' && sg.kind === 'option') {
    const a = av.options.get(sg.optionId);
    return { code: 'option_unavailable', back: a && !a.available ? a.back : null };
  }
  if (no.code === 'lacks') return { code: 'lacks', found: [...(no.found ?? [])] };
  return { code: no.code } as Why;
}
