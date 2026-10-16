import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexMenu, matchSuggestion, NO_SUGGESTION_CODES, passesTagFilter, rankRules, recordShown, whyNoSuggestion, type SuggestionContext } from '../src/upsell.ts';
import type { UpsellRuleV2 } from '../src/snapshot.ts';
import { LIMITS, type Tag } from '../src/enums.ts';
import { inWindow, zonedTime } from '../src/time.ts';
import { cafeDemo, ID, RULES } from './fixtures.ts';

const menu = indexMenu(cafeDemo());
const morning = zonedTime('2026-10-15', '08:30', 'Asia/Jerusalem');
const none = { dishes: new Set<string>(), options: new Set<string>() };
const base = (o: Partial<SuggestionContext>): SuggestionContext => ({ trigger: 'add', menu, basket: [], now: morning, unavailable: none, ...o });
const rule = (o: Partial<UpsellRuleV2>): UpsellRuleV2 => ({ ...RULES[0]!, ...o });

test('after adding an espresso in the morning: the croissant', () => {
  const s = matchSuggestion(RULES, base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }] }));
  assert.deepEqual(s && { rule: s.ruleId, suggest: s.suggest }, { rule: ID.ruleCroissant, suggest: { kind: 'dish', dishId: ID.croissant } });
});

test('never suggests what is already in the basket, or from a section the basket must lack', () => {
  const ctx = base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }, { dishId: ID.croissant }] });
  assert.equal(matchSuggestion(RULES, ctx), null);
  // the basket holds the Friday cake (same pastries section): "basket lacks pastries" fails
  assert.equal(matchSuggestion(RULES, base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }, { dishId: ID.fridayCake }] })), null);
});

test('never sold out, never filtered out', () => {
  const sold = { dishes: new Set([ID.croissant]), options: new Set<string>() };
  assert.equal(matchSuggestion(RULES, base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }], unavailable: sold })), null);
  assert.equal(matchSuggestion(RULES, base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }], filteredOut: new Set([ID.croissant]) })), null);
});

test('outside the rule\'s hours: nothing', () => {
  const noon = zonedTime('2026-10-15', '11:00', 'Asia/Jerusalem');
  assert.equal(matchSuggestion(RULES, base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }], now: noon })), null, '11:00 is the end (exclusive)');
});

test('the trigger must match, and the rule must be active', () => {
  assert.equal(matchSuggestion(RULES, base({ trigger: 'sheet', dishId: ID.espresso })), null);
  assert.equal(matchSuggestion([rule({ active: false })], base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }] })), null);
});

test('exposure cap per visit, and a dismissed rule stays quiet', () => {
  const ctx = base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }] });
  let shown = new Map<string, number>();
  assert.ok(matchSuggestion(RULES, { ...ctx, shown }));
  shown = recordShown(shown, ID.ruleCroissant);
  assert.equal(matchSuggestion(RULES, { ...ctx, shown }), null, 'cap 1 reached');
  assert.equal(matchSuggestion(RULES, { ...ctx, dismissed: new Set([ID.ruleCroissant]) }), null);
});

test('never chained: an action that came from accepting a suggestion gets none', () => {
  assert.equal(matchSuggestion(RULES, base({ dishId: ID.croissant, basket: [{ dishId: ID.espresso }, { dishId: ID.croissant }], fromSuggestion: true })), null);
});

test('priority: the higher wins, a tie goes to the smaller id, the loser waits its turn', () => {
  const a = rule({ id: '00000000-0000-4000-8000-0000000000a2', priority: 10, suggest: { kind: 'dish', dishId: ID.lemonade } });
  const b = rule({ id: '00000000-0000-4000-8000-0000000000a1', priority: 10, suggest: { kind: 'dish', dishId: ID.croissant } });
  const c = rule({ id: '00000000-0000-4000-8000-0000000000a3', priority: 90, suggest: { kind: 'dish', dishId: ID.schnitzel } });
  assert.deepEqual(rankRules([a, b, c]).map((r) => r.id), [c.id, b.id, a.id]);
  const ctx = base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }] });
  assert.equal(matchSuggestion([a, b, c], ctx)!.ruleId, c.id);
  // when the winner cannot suggest (its dish is in the basket), the next rule is tried: still one suggestion only
  assert.equal(matchSuggestion([a, b, c], { ...ctx, basket: [{ dishId: ID.espresso }, { dishId: ID.schnitzel }] })!.ruleId, b.id);
  assert.equal(matchSuggestion([a, b, c], { ...ctx, shown: new Map([[c.id, 1], [b.id, 1]]) })!.ruleId, a.id);
});

test('sheet trigger, an add-on suggestion: cheese on the burger, unless chosen or the group is full', () => {
  const ctx = base({ trigger: 'sheet', dishId: ID.burger, selection: { quantity: 1, groups: [] } });
  assert.deepEqual(matchSuggestion(RULES, ctx)!.suggest, { kind: 'option', groupId: ID.extras, optionId: ID.cheese });
  const withCheese = { quantity: 1, groups: [{ groupId: ID.extras, options: [{ optionId: ID.cheese }] }] };
  assert.equal(matchSuggestion(RULES, { ...ctx, selection: withCheese }), null);
  const full = { quantity: 1, groups: [{ groupId: ID.extras, options: [{ optionId: ID.egg }, { optionId: ID.avocado, qty: 1 }, { optionId: '00000000-0000-4000-8000-0000000000ff' }] }] };
  assert.equal(matchSuggestion(RULES, { ...ctx, selection: full }), null, 'three units already: max reached');
  assert.equal(matchSuggestion(RULES, { ...ctx, unavailable: { dishes: new Set(), options: new Set([ID.cheese]) } }), null);
  assert.equal(matchSuggestion(RULES, { ...ctx, dishId: ID.schnitzel }), null, 'out of scope');
});

test('an option suggestion never replaces the guest\'s choice in a single group', () => {
  const r = rule({ id: '00000000-0000-4000-8000-0000000000b9', trigger: 'sheet', scope: { kind: 'dish', ids: [ID.espresso] }, when: null,
    basketLacks: { dishes: [], sections: [] }, suggest: { kind: 'option', groupId: ID.milk, optionId: ID.oat } });
  const ctx = base({ trigger: 'sheet', dishId: ID.espresso, selection: { quantity: 1, groups: [] } });
  assert.ok(matchSuggestion([r], ctx));
  assert.equal(matchSuggestion([r], { ...ctx, selection: { quantity: 1, groups: [{ groupId: ID.milk, options: [{ optionId: ID.soy }] }] } }), null);
});

test('checkout: "basket lacks drinks" after a main', () => {
  const ctx = base({ trigger: 'checkout', basket: [{ dishId: ID.burger }] });
  assert.equal(matchSuggestion(RULES, ctx)!.ruleId, ID.ruleLemonade);
  assert.equal(matchSuggestion(RULES, { ...ctx, basket: [{ dishId: ID.burger }, { dishId: ID.espresso }] }), null, 'a drink is already there');
  assert.equal(matchSuggestion(RULES, { ...ctx, basket: [{ dishId: ID.espresso }] }), null, 'no main: out of scope');
  assert.equal(matchSuggestion(RULES, { ...ctx, basket: [] }), null);
});

test('"basket has" condition and "all" scope', () => {
  const r = rule({ id: '00000000-0000-4000-8000-0000000000c9', trigger: 'add', scope: { kind: 'all' }, when: null,
    basketHas: { dishes: [], sections: [ID.mains] }, basketLacks: { dishes: [], sections: [] }, suggest: { kind: 'dish', dishId: ID.lemonade } });
  assert.equal(matchSuggestion([r], base({ dishId: ID.croissant, basket: [{ dishId: ID.croissant }] })), null);
  assert.equal(matchSuggestion([r], base({ dishId: ID.croissant, basket: [{ dishId: ID.croissant }, { dishId: ID.burger }] }))!.ruleId, r.id);
});

test('a rule never suggests the dish in context, or a dish without a price', () => {
  const self = rule({ id: '00000000-0000-4000-8000-0000000000d9', scope: { kind: 'all' }, when: null, basketLacks: { dishes: [], sections: [] }, suggest: { kind: 'dish', dishId: ID.espresso } });
  assert.equal(matchSuggestion([self], base({ trigger: 'add', dishId: ID.espresso, basket: [] })), null);
  const m2 = cafeDemo() as any;
  m2.sections[3].dishes[0].price = null;
  const idx = indexMenu(m2);
  assert.equal(matchSuggestion(RULES, base({ menu: idx, dishId: ID.espresso, basket: [{ dishId: ID.espresso }] })), null);
});

test('days: a weekday-only rule is quiet on Saturday', () => {
  const r = rule({ when: { days: [0, 1, 2, 3, 4], from: null, to: null } });
  const saturday = zonedTime('2026-10-17', '08:30', 'Asia/Jerusalem');
  assert.equal(matchSuggestion([r], base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }], now: saturday })), null);
  assert.ok(matchSuggestion([r], base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }] })));
});

test('a "basket has" condition with no targets never fires (fail closed); null is no condition', () => {
  const ctx = base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }] });
  assert.ok(matchSuggestion([rule({ basketHas: null })], ctx));
  assert.equal(matchSuggestion([rule({ basketHas: { dishes: [], sections: [] } })], ctx), null, 'an emptied list is not "always"');
  assert.equal(matchSuggestion([rule({ basketHas: { dishes: [ID.burger], sections: [] } })], ctx), null);
  assert.ok(matchSuggestion([rule({ basketHas: { dishes: [ID.espresso], sections: [] } })], ctx));
});

// ---------------------------------------------------------------- round 3: one tag filter, the reason, stored rows (B17, B18)

test('passesTagFilter: every tag asked for (AND), a vegan dish counting as vegetarian', () => {
  const d = (...tags: Tag[]) => ({ tags });
  assert.ok(passesTagFilter(d(), []), 'no filter: every dish');
  assert.ok(passesTagFilter(d('vegan'), ['vegetarian']));
  assert.ok(!passesTagFilter(d('vegetarian'), ['vegan']));
  assert.ok(passesTagFilter(d('vegan', 'gf'), ['vegetarian', 'gf']));
  assert.ok(!passesTagFilter(d('vegan'), ['vegetarian', 'gf']), 'AND, not OR');
  // matchSuggestion applies the guest's tags to a suggested dish: the croissant is vegetarian, not vegan
  const ctx = base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }] });
  assert.equal(matchSuggestion(RULES, { ...ctx, tags: ['vegetarian'] })!.ruleId, ID.ruleCroissant);
  assert.equal(matchSuggestion(RULES, { ...ctx, tags: ['vegan'] }), null);
  assert.deepEqual(whyNoSuggestion(RULES[0]!, { ...ctx, tags: ['vegan'] }), { code: 'filtered' });
});

test('whyNoSuggestion: the first reason, in the order matchSuggestion checks', () => {
  const add = base({ dishId: ID.espresso, basket: [{ dishId: ID.espresso }] });
  const croissant = RULES[0]!, cheese = RULES[1]!, lemonade = RULES[2]!;
  const why = (r: UpsellRuleV2, c: SuggestionContext) => whyNoSuggestion(r, c)?.code ?? null;
  assert.equal(why(croissant, add), null);
  assert.equal(why(croissant, { ...add, fromSuggestion: true }), 'chained');
  assert.equal(why({ ...croissant, active: false }, add), 'inactive');
  assert.equal(why(croissant, { ...add, trigger: 'sheet' }), 'trigger');
  assert.equal(why(croissant, { ...add, dismissed: new Set([croissant.id]) }), 'dismissed');
  assert.equal(why(croissant, { ...add, shown: new Map([[croissant.id, 1]]) }), 'cap');
  assert.equal(why(croissant, { ...add, dishId: null }), 'no_dish');
  assert.equal(why(croissant, { ...add, dishId: ID.burger }), 'scope');
  assert.equal(why(lemonade, base({ trigger: 'checkout', basket: [] })), 'basket_empty');
  assert.equal(why(croissant, { ...add, now: zonedTime('2026-10-15', '11:00', 'Asia/Jerusalem') }), 'when');
  assert.equal(why({ ...croissant, basketHas: { dishes: [ID.burger], sections: [] } }, add), 'has');
  assert.deepEqual(whyNoSuggestion(croissant, { ...add, basket: [{ dishId: ID.espresso }, { dishId: ID.fridayCake }] }), { code: 'lacks', found: [ID.fridayCake] });
  assert.equal(why({ ...croissant, suggest: { kind: 'dish', dishId: '00000000-0000-4000-8000-00000000d0ff' } }, add), 'hidden');
  assert.equal(why({ ...croissant, suggest: { kind: 'dish', dishId: ID.espresso } }, add), 'same_dish');
  assert.equal(why({ ...croissant, basketLacks: null }, { ...add, basket: [{ dishId: ID.espresso }, { dishId: ID.croissant }] }), 'in_basket');
  assert.equal(why(croissant, { ...add, unavailable: { dishes: new Set([ID.croissant]), options: new Set() } }), 'unavailable');
  assert.equal(why(croissant, { ...add, filteredOut: new Set([ID.croissant]) }), 'filtered');
  const sheet = base({ trigger: 'sheet', dishId: ID.burger });
  assert.equal(why(cheese, sheet), null);
  assert.equal(why({ ...cheese, scope: { kind: 'all' } }, { ...sheet, dishId: ID.espresso }), 'option_not_on_dish');
  assert.equal(why(cheese, { ...sheet, unavailable: { dishes: new Set(), options: new Set([ID.cheese]) } }), 'option_unavailable');
  assert.equal(why(cheese, { ...sheet, selection: { quantity: 1, groups: [{ groupId: ID.extras, options: [{ optionId: ID.cheese }] }] } }), 'option_chosen');
  const m2 = cafeDemo() as any;
  m2.sections[3].dishes[0].price = null;
  assert.equal(why(croissant, { ...add, menu: indexMenu(m2) }), 'no_price');
  assert.equal(new Set(NO_SUGGESTION_CODES).size, NO_SUGGESTION_CODES.length);
});

/** matchSuggestion as phase 1 wrote it (before it was built on whyNoSuggestion): the reference the new one must equal. */
function phase1Match(rules: readonly UpsellRuleV2[], ctx: SuggestionContext): string | null {
  if (ctx.fromSuggestion) return null;
  const basket = new Set(ctx.basket.map((l) => l.dishId));
  const has = (m: { dishes: readonly string[]; sections: readonly string[] }) =>
    [...basket].some((id) => m.dishes.includes(id) || m.sections.includes(ctx.menu.sectionOf.get(id) ?? ''));
  for (const r of [...rules].sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1))) {
    if (!r.active || r.trigger !== ctx.trigger || ctx.dismissed?.has(r.id) || (ctx.shown?.get(r.id) ?? 0) >= r.cap) continue;
    const sc = r.scope;
    const inScope = sc.kind === 'all' ? (ctx.trigger === 'checkout' ? basket.size > 0 : ctx.dishId != null)
      : ctx.trigger === 'checkout' ? has(sc.kind === 'dish' ? { dishes: sc.ids, sections: [] } : { dishes: [], sections: sc.ids })
      : ctx.dishId != null && (sc.kind === 'dish' ? sc.ids.includes(ctx.dishId) : sc.ids.includes(ctx.menu.sectionOf.get(ctx.dishId) ?? ''));
    if (!inScope || (r.when && !inWindow(r.when, ctx.now, ctx.menu.timeZone))) continue;
    if ((r.basketHas !== null && !has(r.basketHas)) || (r.basketLacks !== null && has(r.basketLacks))) continue;
    const sg = r.suggest;
    if (sg.kind === 'dish') {
      const d = ctx.menu.dishes.get(sg.dishId);
      if (!d || d.price === null || basket.has(sg.dishId) || sg.dishId === ctx.dishId || ctx.unavailable.dishes.has(sg.dishId)) continue;
      if (ctx.filteredOut?.has(sg.dishId) || !(ctx.tags ?? []).every((t) => d.tags.includes(t) || (t === 'vegetarian' && d.tags.includes('vegan')))) continue;
      return r.id;
    }
    if (ctx.trigger === 'checkout' || ctx.dishId == null) continue;
    const dish = ctx.menu.dishes.get(ctx.dishId);
    const at = dish?.addons.find((a) => a.groupId === sg.groupId);
    const g = ctx.menu.groups.get(sg.groupId);
    const o = g?.options.find((x) => x.id === sg.optionId);
    if (!dish || !at || !g || !o || ctx.unavailable.options.has(o.id)) continue;
    const mine = ctx.selection?.groups.find((x) => x.groupId === sg.groupId)?.options ?? [];
    const n = mine.reduce((s, x) => s + (x.qty ?? 1), 0);
    if (mine.some((x) => x.optionId === o.id) || (g.selection === 'single' && n > 0) || n + 1 > at.max) continue;
    return r.id;
  }
  return null;
}

test('whyNoSuggestion agrees with matchSuggestion, and matchSuggestion with phase 1, over every moment, basket, dish, filter and trigger', () => {
  const extra: UpsellRuleV2[] = [
    { ...RULES[1]!, id: '00000000-0000-4000-8000-00000000f011', scope: { kind: 'section', ids: [ID.mains] }, when: { days: [0, 1, 2], from: '18:00', to: '02:00' } },
    { ...RULES[2]!, id: '00000000-0000-4000-8000-00000000f012', trigger: 'add', scope: { kind: 'all' }, basketLacks: null, basketHas: { dishes: [], sections: [ID.pastries] } },
    { ...RULES[2]!, id: '00000000-0000-4000-8000-00000000f013', scope: { kind: 'dish', ids: [ID.burger] }, when: { days: [5], from: null, to: null }, suggest: { kind: 'dish', dishId: ID.shakshuka } },
    { ...RULES[0]!, id: '00000000-0000-4000-8000-00000000f014', trigger: 'sheet', when: null, suggest: { kind: 'dish', dishId: ID.espresso } },
  ];
  const rules = [...RULES, ...extra];
  const moments = [['2026-10-15', '08:00'], ['2026-10-15', '13:00'], ['2026-10-16', '23:30'], ['2026-10-18', '08:00']].map(([d, t]) => zonedTime(d!, t!, 'Asia/Jerusalem'));
  const baskets = [[], [ID.croissant], [ID.espresso, ID.burger], [ID.lemonade, ID.croissant]];
  const filters: Tag[][] = [[], ['vegan'], ['vegetarian']];
  const offs = [none, { dishes: new Set<string>([ID.lemonade]), options: new Set<string>([ID.cheese]) }];
  let n = 0;
  for (const trigger of ['sheet', 'add', 'checkout'] as const) for (const now of moments) for (const b of baskets) for (const dishId of [ID.espresso, ID.burger, ID.croissant, null])
    for (const tags of filters) for (const unavailable of offs) {
      const ctx = base({ trigger, now, basket: b.map((d) => ({ dishId: d })), dishId, tags, unavailable });
      assert.equal(matchSuggestion(rules, ctx)?.ruleId ?? null, phase1Match(rules, ctx));
      for (const r of rules) assert.equal(whyNoSuggestion(r, ctx) === null, matchSuggestion([r], ctx) !== null);
      n++;
    }
  assert.equal(n, 3 * 4 * 4 * 4 * 3 * 2);
});

test('rankRules takes the stored rule rows too (the owner app ranks drafts before they are published)', () => {
  const rows = [{ id: 'b', priority: 50, label: 'B' }, { id: 'a', priority: 50, label: 'A' }, { id: 'c', priority: 90, label: 'C' }];
  assert.deepEqual(rankRules(rows).map((r) => r.label), ['C', 'A', 'B']);
  assert.equal(LIMITS.hours, 21, 'opening-hours windows per venue, as the database allows');
});
