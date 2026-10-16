import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSelection, fromPrice, priceDish, pricingContext, vatIncluded, type DishSelection, type PriceResult } from '../src/pricing.ts';
import type { AddonGroupV2, DishV2 } from '../src/snapshot.ts';
import { cafeDemo, DISHES, ID } from './fixtures.ts';

const snap = cafeDemo();
const ctx = pricingContext(snap);
const off = (...options: string[]) => pricingContext(snap, { dishes: new Set(), options: new Set(options) });
const codes = (r: PriceResult) => (r.ok ? [] : r.errors.map((e) => e.code));
const sel = (groups: DishSelection['groups'], quantity = 1): DishSelection => ({ quantity, groups });

const burgerWith = (side: string, sauce: string | null, extras: { optionId: string; qty?: number }[] = []) =>
  sel([
    { groupId: ID.side, options: [sauce ? { optionId: side, nested: [{ groupId: ID.sauce, options: [{ optionId: sauce }] }] } : { optionId: side }] },
    { groupId: ID.extras, options: extras },
  ]);

test('a plain dish: base price, VAT extracted from the total, never added', () => {
  const r = priceDish(DISHES.lemonade, sel([]), ctx);
  assert.ok(r.ok);
  assert.equal(r.total, 1600);
  assert.equal(r.vat, 244); // 1600 × 18/118 = 244.07
  assert.equal(r.net, 1356);
  assert.equal(r.vat + r.net, r.total);
});

test('vatIncluded rounds half up to the agora and is exact on round numbers', () => {
  assert.equal(vatIncluded(11800, 1800), 1800);
  assert.equal(vatIncluded(0, 1800), 0);
  assert.equal(vatIncluded(1, 1800), 0);
  assert.equal(vatIncluded(59, 1800), 9); // 9.0 exactly
  assert.equal(vatIncluded(1000, 0), 0);
  for (let total = 0; total < 3000; total += 7) {
    const v = vatIncluded(total, 1700);
    assert.ok(Math.abs(v - (total * 1700) / 11700) <= 0.5 + 1e-9, `total ${total}`);
  }
});

test('side → nested sauce: free side with a paid sauce, paid side with a free sauce', () => {
  const a = priceDish(DISHES.burger, burgerWith(ID.fries, ID.chipotle), ctx);
  assert.ok(a.ok);
  assert.equal(a.unit, 6800 + 0 + 200);
  const nested = a.lines.find((l) => l.kind === 'option' && l.optionId === ID.chipotle);
  assert.ok(nested && nested.kind === 'option' && nested.parentOptionId === ID.fries);
  const b = priceDish(DISHES.burger, burgerWith(ID.sweetFries, ID.aioli), ctx);
  assert.ok(b.ok);
  assert.equal(b.unit, 6800 + 800);
  assert.equal(b.lines.reduce((s, l) => s + l.amount, 0), b.unit, 'the breakdown adds up to the unit price');
});

test('an option that opens a required group needs that group chosen', () => {
  assert.deepEqual(codes(priceDish(DISHES.burger, burgerWith(ID.fries, null), ctx)), ['below_min']);
  const r = priceDish(DISHES.burger, burgerWith(ID.fries, null), ctx);
  assert.ok(!r.ok && r.error.code === 'below_min' && r.error.groupId === ID.sauce && r.error.parentOptionId === ID.fries);
});

test('an option that opens nothing cannot carry nested choices', () => {
  const s = sel([{ groupId: ID.side, options: [{ optionId: ID.salad, nested: [{ groupId: ID.sauce, options: [{ optionId: ID.aioli }] }] }] }]);
  assert.deepEqual(codes(priceDish(DISHES.schnitzel, s, ctx)), ['nested_unexpected']);
});

test('nesting depth: a nested group\'s option cannot open further choices', () => {
  const s = sel([{
    groupId: ID.side,
    options: [{ optionId: ID.fries, nested: [{ groupId: ID.sauce, options: [{ optionId: ID.aioli, nested: [{ groupId: ID.extras, options: [{ optionId: ID.cheese }] }] }] }] }],
  }]);
  assert.deepEqual(codes(priceDish(DISHES.schnitzel, s, ctx)), ['nesting_too_deep']);
});

test('nested choices for a group the option does not open are refused', () => {
  const s = sel([{ groupId: ID.side, options: [{ optionId: ID.fries, nested: [{ groupId: ID.sauce, options: [{ optionId: ID.aioli }] }, { groupId: ID.extras, options: [] }] }] }]);
  assert.ok(codes(priceDish(DISHES.schnitzel, s, ctx)).includes('group_unknown'));
});

test('min and max: required single group, multiple group capped by units', () => {
  assert.deepEqual(codes(priceDish(DISHES.burger, sel([{ groupId: ID.extras, options: [] }]), ctx)), ['below_min']);
  const four = burgerWith(ID.salad, null, [{ optionId: ID.cheese, qty: 2 }, { optionId: ID.egg }, { optionId: ID.avocado }]);
  const r = priceDish(DISHES.burger, four, ctx);
  assert.ok(!r.ok && r.error.code === 'above_max' && r.error.got === 4 && r.error.max === 3);
  const three = burgerWith(ID.salad, null, [{ optionId: ID.cheese, qty: 2 }, { optionId: ID.egg }]);
  const ok = priceDish(DISHES.burger, three, ctx);
  assert.ok(ok.ok);
  assert.equal(ok.unit, 6800 + 800 + 500);
});

test('a single-choice group refuses two options', () => {
  const s = sel([{ groupId: ID.size, options: [{ optionId: ID.single }, { optionId: ID.double }] }]);
  assert.deepEqual(codes(priceDish(DISHES.espresso, s, ctx)), ['above_max']);
});

test('the dish may tighten a group\'s limits', () => {
  const tight: DishV2 = { ...DISHES.burger, addons: [{ groupId: ID.side, min: 1, max: 1 }, { groupId: ID.extras, min: 1, max: 1 }] };
  assert.deepEqual(codes(priceDish(tight, burgerWith(ID.salad, null), ctx)), ['below_min']);
  assert.deepEqual(codes(priceDish(tight, burgerWith(ID.salad, null, [{ optionId: ID.cheese }, { optionId: ID.egg }]), ctx)), ['above_max']);
  assert.ok(priceDish(tight, burgerWith(ID.salad, null, [{ optionId: ID.egg }]), ctx).ok);
});

test('quantity caps: per option ("double cheese" = 2, never 3) and per line', () => {
  const r = priceDish(DISHES.burger, burgerWith(ID.salad, null, [{ optionId: ID.cheese, qty: 3 }]), ctx);
  assert.ok(!r.ok && r.error.code === 'option_qty_invalid' && r.error.max === 2);
  assert.deepEqual(codes(priceDish(DISHES.burger, burgerWith(ID.salad, null, [{ optionId: ID.cheese, qty: 0 }]), ctx)), ['option_qty_invalid']);
  assert.deepEqual(codes(priceDish(DISHES.burger, burgerWith(ID.salad, null, [{ optionId: ID.cheese, qty: 1.5 }]), ctx)), ['option_qty_invalid']);
  assert.deepEqual(codes(priceDish(DISHES.lemonade, sel([], 0), ctx)), ['quantity_invalid']);
  assert.deepEqual(codes(priceDish(DISHES.lemonade, sel([], 51), ctx)), ['quantity_invalid']);
  const many = priceDish(DISHES.burger, burgerWith(ID.sweetFries, ID.chipotle, [{ optionId: ID.cheese, qty: 2 }]), { ...ctx });
  assert.ok(many.ok);
  const q3 = priceDish(DISHES.burger, { ...burgerWith(ID.sweetFries, ID.chipotle, [{ optionId: ID.cheese, qty: 2 }]), quantity: 3 }, ctx);
  assert.ok(q3.ok);
  assert.equal(q3.total, many.unit * 3);
  assert.equal(q3.vat, vatIncluded(q3.total, 1800), 'VAT is taken from the line total, not summed per unit');
});

test('the same option or group twice is refused, unknown ones too', () => {
  assert.ok(codes(priceDish(DISHES.burger, burgerWith(ID.salad, null, [{ optionId: ID.egg }, { optionId: ID.egg }]), ctx)).includes('option_repeated'));
  assert.ok(codes(priceDish(DISHES.lemonade, sel([{ groupId: ID.extras, options: [] }]), ctx)).includes('group_unknown'));
  const twice = sel([{ groupId: ID.size, options: [{ optionId: ID.single }] }, { groupId: ID.size, options: [{ optionId: ID.single }] }]);
  assert.ok(codes(priceDish(DISHES.espresso, twice, ctx)).includes('group_repeated'));
  assert.ok(codes(priceDish(DISHES.espresso, sel([{ groupId: ID.size, options: [{ optionId: ID.aioli }] }]), ctx)).includes('option_unknown'));
});

test('a sold-out option cannot be chosen', () => {
  const r = priceDish(DISHES.burger, burgerWith(ID.fries, ID.chipotle), off(ID.chipotle));
  assert.ok(!r.ok && r.error.code === 'option_unavailable' && r.error.optionId === ID.chipotle);
});

test('a required group with every option sold out makes the dish unavailable', () => {
  const r = priceDish(DISHES.shakshuka, sel([{ groupId: ID.bread, options: [{ optionId: ID.sourdough }] }]), off(ID.sourdough, ID.challah));
  assert.deepEqual(codes(r), ['dish_unavailable']);
});

test('nested exhaustion: every sauce sold out leaves only the salad, so the burger still works', () => {
  const c = off(ID.aioli, ID.ketchup, ID.chipotle);
  assert.deepEqual(codes(priceDish(DISHES.burger, burgerWith(ID.fries, ID.aioli), c)), ['option_unavailable']);
  assert.ok(priceDish(DISHES.burger, burgerWith(ID.salad, null), c).ok);
  // with the salad also gone, no side can be completed: the dish is unavailable
  assert.deepEqual(codes(priceDish(DISHES.burger, burgerWith(ID.salad, null), off(ID.aioli, ID.ketchup, ID.chipotle, ID.salad))), ['dish_unavailable']);
});

test('a dish that is off, or has no price, cannot be priced', () => {
  const c = pricingContext(snap, { dishes: new Set([ID.lemonade]), options: new Set() });
  assert.deepEqual(codes(priceDish(DISHES.lemonade, sel([]), c)), ['dish_unavailable']);
  assert.deepEqual(codes(priceDish({ ...DISHES.lemonade, price: null }, sel([]), ctx)), ['no_price']);
});

test('every problem is reported, the first as `error`', () => {
  const r = priceDish(DISHES.burger, sel([{ groupId: ID.extras, options: [{ optionId: ID.cheese, qty: 9 }, { optionId: ID.aioli }] }], 0), ctx);
  assert.ok(!r.ok);
  assert.deepEqual([...new Set(r.errors.map((e) => e.code))].sort(), ['below_min', 'option_qty_invalid', 'option_unknown', 'quantity_invalid']);
  assert.equal(r.error, r.errors[0]);
});

test('fromPrice: only free required choices show the plain price; a paid one makes it "from"', () => {
  assert.deepEqual(fromPrice(DISHES.shakshuka, ctx), { amount: 5400, from: false }, 'sourdough or challah, both free');
  assert.deepEqual(fromPrice(DISHES.lemonade, ctx), { amount: 1600, from: false });
  assert.deepEqual(fromPrice(DISHES.schnitzel, ctx), { amount: 6200, from: true }, 'the side may be sweet potato fries (+8)');
  assert.deepEqual(fromPrice(DISHES.espresso, ctx), { amount: 1200, from: true }, 'a required size with a paid double');
  assert.equal(fromPrice({ ...DISHES.lemonade, price: null }, ctx), null);
});

test('fromPrice: the amount is always payable (cheapest complete choice, nested included)', () => {
  const sizes: AddonGroupV2 = { id: '00000000-0000-4000-8000-0000000000aa', name: { he: 'גודל', en: 'Size' }, selection: 'single', min: 1, max: 1,
    options: [{ id: '00000000-0000-4000-8000-0000000000ab', name: { he: 'קטן', en: 'Small' }, price: 300, maxQty: 1, default: false, opensGroupId: null },
      { id: '00000000-0000-4000-8000-0000000000ac', name: { he: 'גדול', en: 'Large' }, price: 900, maxQty: 1, default: false, opensGroupId: null }] };
  const groups = new Map(ctx.groups);
  groups.set(sizes.id, sizes);
  const pizza: DishV2 = { ...DISHES.lemonade, price: { amount: 4000, note: { he: '', en: '' } }, addons: [{ groupId: sizes.id, min: 1, max: 1 }] };
  assert.deepEqual(fromPrice(pizza, { groups }), { amount: 4300, from: true });
  // when the cheapest is sold out, the shown price moves up
  assert.deepEqual(fromPrice(pizza, { groups, unavailable: { dishes: new Set(), options: new Set(['00000000-0000-4000-8000-0000000000ab']) } }), { amount: 4900, from: true });
  // a free side that opens a required sauce with only paid sauces left
  const c = { groups: ctx.groups, unavailable: { dishes: new Set<string>(), options: new Set([ID.aioli, ID.ketchup, ID.salad]) } };
  assert.deepEqual(fromPrice(DISHES.schnitzel, c), { amount: 6200 + 200, from: true });
  // nothing left to choose
  assert.equal(fromPrice(DISHES.shakshuka, { groups: ctx.groups, unavailable: { dishes: new Set(), options: new Set([ID.sourdough, ID.challah]) } }), null);
});

test('fromPrice: free options that open a required paid nested group make it "from"; optional groups never do', () => {
  const freeSides: AddonGroupV2 = { ...ctx.groups.get(ID.side)!, options: ctx.groups.get(ID.side)!.options.filter((o) => o.price === 0) };
  const groups = new Map(ctx.groups);
  groups.set(ID.side, freeSides);
  // fries (free) opens the required sauce, which has a paid chipotle
  assert.deepEqual(fromPrice(DISHES.schnitzel, { groups }), { amount: 6200, from: true });
  // with only free sauces the price is plain again
  const freeSauces: AddonGroupV2 = { ...ctx.groups.get(ID.sauce)!, options: ctx.groups.get(ID.sauce)!.options.filter((o) => o.price === 0) };
  groups.set(ID.sauce, freeSauces);
  assert.deepEqual(fromPrice(DISHES.schnitzel, { groups }), { amount: 6200, from: false });
  // the burger's paid extras are optional: they never make the shown price "from" on their own
  assert.deepEqual(fromPrice(DISHES.burger, { groups }), { amount: 6800, from: false });
});

test('fromPrice: a sold-out paid choice does not make the price "from"', () => {
  const off = (...ids: string[]) => ({ groups: ctx.groups, unavailable: { dishes: new Set<string>(), options: new Set(ids) } });
  assert.deepEqual(fromPrice(DISHES.espresso, off(ID.double)), { amount: 1200, from: false }, 'only the single is left');
  assert.deepEqual(fromPrice(DISHES.schnitzel, off(ID.sweetFries, ID.chipotle)), { amount: 6200, from: false }, 'no paid side, no paid sauce left');
  assert.deepEqual(fromPrice(DISHES.schnitzel, off(ID.sweetFries)), { amount: 6200, from: true }, 'fries still open a sauce with a paid chipotle');
  assert.deepEqual(fromPrice(DISHES.schnitzel, off(ID.aioli, ID.ketchup, ID.chipotle)), { amount: 6200, from: false },
    'every sauce gone: neither kind of fries can be ordered, only the free salad');
  assert.deepEqual(fromPrice(DISHES.espresso, off(ID.single)), { amount: 1600, from: true }, 'the cheapest available is the double');
});

test('defaultSelection follows the owner\'s defaults and prices without errors', () => {
  const d = defaultSelection(DISHES.burger, ctx);
  assert.deepEqual(d, { quantity: 1, groups: [
    { groupId: ID.side, options: [{ optionId: ID.fries, nested: [{ groupId: ID.sauce, options: [{ optionId: ID.aioli }] }] }] },
    { groupId: ID.extras, options: [] },
  ] });
  const r = priceDish(DISHES.burger, d, ctx);
  assert.ok(r.ok);
  assert.equal(r.unit, 6800);
  // a sold-out default is not pre-selected
  const d2 = defaultSelection(DISHES.burger, { groups: ctx.groups, unavailable: { dishes: new Set(), options: new Set([ID.fries]) } });
  assert.deepEqual(d2.groups[0], { groupId: ID.side, options: [] });
});

test('defaultSelection skips a default opener whose required nested group is sold out entirely', () => {
  // every sauce off: fries (the default side) could not be added, so the sheet starts with no side, not a dead end
  const c = { groups: ctx.groups, unavailable: { dishes: new Set<string>(), options: new Set([ID.aioli, ID.ketchup, ID.chipotle]) } };
  assert.deepEqual(defaultSelection(DISHES.burger, c).groups[0], { groupId: ID.side, options: [] });
  assert.deepEqual(codes(priceDish(DISHES.burger, defaultSelection(DISHES.burger, c), off(ID.aioli, ID.ketchup, ID.chipotle))), ['below_min']);
  // one sauce back (not the default one): fries is pre-selected again, and its sauce starts empty (aioli is off)
  const one = { groups: ctx.groups, unavailable: { dishes: new Set<string>(), options: new Set([ID.aioli, ID.chipotle]) } };
  assert.deepEqual(defaultSelection(DISHES.burger, one).groups[0], { groupId: ID.side, options: [{ optionId: ID.fries, nested: [{ groupId: ID.sauce, options: [] }] }] });
});

test('a total too large for exact arithmetic is refused, not rounded', () => {
  const huge: DishV2 = { ...DISHES.lemonade, price: { amount: Math.floor(Number.MAX_SAFE_INTEGER / 4), note: { he: '', en: '' } } };
  assert.deepEqual(codes(priceDish(huge, sel([], 3), ctx)), ['total_overflow']);
  assert.deepEqual(codes(priceDish(huge, sel([], 1), ctx)), ['total_overflow'], 'the VAT extraction would overflow too');
});
