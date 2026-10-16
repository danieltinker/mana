import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indexMenu, matchSuggestion, rankRules, recordShown, type SuggestionContext } from '../src/upsell.ts';
import type { UpsellRuleV2 } from '../src/snapshot.ts';
import { zonedTime } from '../src/time.ts';
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
