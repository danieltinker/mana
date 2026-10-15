import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSnapshotV2 } from '../src/validate-snapshot.ts';
import { allDishes } from '../src/snapshot.ts';
import { cafeDemo, ID, mutable } from './fixtures.ts';

const codes = (raw: unknown) => {
  const r = validateSnapshotV2(raw);
  return r.ok ? [] : [...new Set(r.errors.map((e) => e.code))].sort();
};
const broken = (fn: (s: any) => void) => {
  const s = mutable(cafeDemo());
  fn(s);
  return codes(s);
};

test('the synthetic café validates', () => {
  const r = validateSnapshotV2(cafeDemo());
  assert.ok(r.ok, JSON.stringify(!r.ok && r.errors));
  assert.equal(allDishes(cafeDemo()).length, 7);
});

test('readers ignore fields they do not know (forward compatible)', () => {
  assert.deepEqual(broken((s) => { s.futureThing = { a: 1 }; s.venue.newField = 'x'; s.sections[0].dishes[0].calories = 400; s.addonGroups[0].hint = {}; }), []);
});

test('version and top-level shape', () => {
  assert.deepEqual(codes({ ...cafeDemo(), v: 1 }), ['version']);
  assert.deepEqual(codes(null), ['type']);
  assert.deepEqual(codes([]), ['type']);
  assert.deepEqual(broken((s) => { s.slug = 'Bad Slug'; }), ['slug_invalid']);
  assert.deepEqual(broken((s) => { s.assetBase = 'ftp://x/'; }), ['url_invalid']);
  assert.deepEqual(broken((s) => { s.venueId = 'nope'; }), ['id_invalid']);
});

test('venue and locale', () => {
  assert.deepEqual(broken((s) => { s.venue.name = { he: ' ', en: '' }; }), ['name_missing']);
  assert.deepEqual(broken((s) => { s.venue.kind = 'nightclub'; }), ['enum_invalid']);
  assert.deepEqual(broken((s) => { s.venue.mode = 'pos'; }), ['enum_invalid']);
  assert.deepEqual(broken((s) => { s.venue.orderUrl = 'http://insecure.example'; }), ['url_invalid']);
  assert.deepEqual(broken((s) => { s.venue.timeZone = 'Mars/Olympus'; }), ['time_zone_invalid']);
  assert.deepEqual(broken((s) => { s.locale.default = 'fr'; }), ['locale_invalid']);
  assert.deepEqual(broken((s) => { s.locale.langs = ['he', 'he']; }), ['locale_invalid']);
  assert.deepEqual(broken((s) => { s.locale.currency = 'USD'; }), ['locale_invalid']);
  assert.deepEqual(broken((s) => { s.pricing.includesVat = false; }), ['type']);
  assert.deepEqual(broken((s) => { s.theme.accent = 'red'; }), ['color_invalid']);
});

test('dishes: ids unique across the menu, prices integer agorot', () => {
  assert.deepEqual(broken((s) => { s.sections[3].dishes[1].id = ID.burger; }), ['id_duplicate'], 'the Friday cake (referenced by nothing) takes the burger\'s id');
  assert.deepEqual(broken((s) => { s.sections[1].dishes[1].id = ID.burger; }), ['id_duplicate', 'ref_unknown'], 'the schnitzel\'s id disappears: the burger\'s "goes well with" now points nowhere');
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].price.amount = 12.5; }), ['price_invalid']);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].price.amount = -1; }), ['price_invalid']);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].price = null; }), [], 'a dish may show no price');
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].tags = ['vegan', 'halal']; }), ['enum_invalid']);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].name = { he: '', en: '' }; }), ['name_missing']);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].desc = { he: 'x'.repeat(601), en: '' }; }), ['text_too_long']);
});

test('assets: relief, photo, stock; anything else is refused', () => {
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].asset = { state: 'relief', color: 'a/color.jpg', aux: 'a/aux.png', thumb: 'a/t.jpg', kind: 'low', e: 40, h: 0.2, o: null, s: null }; }), []);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].asset = { state: 'photo', color: 'a/color.jpg', thumb: 'a/t.jpg' }; }), []);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].asset = { state: 'relief', color: 'a/color.jpg', thumb: 'a/t.jpg', kind: 'low', e: 40, h: 0.2 }; }), ['asset_invalid']);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].asset = { state: 'photo', color: '../../etc/passwd', thumb: 'a/t.jpg' }; }), ['asset_invalid']);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].asset = { state: 'model3d' }; }), ['asset_invalid']);
  assert.deepEqual(broken((s) => { s.sections[3].dishes[0].asset.id = 'Croissant!'; }), ['asset_invalid']);
});

test('add-on groups: limits, single choice, empty, defaults', () => {
  assert.deepEqual(broken((s) => { s.addonGroups[2].min = 4; }), ['limits_invalid']);
  assert.deepEqual(broken((s) => { s.addonGroups[0].max = 2; }), ['single_max']);
  assert.deepEqual(broken((s) => { s.addonGroups[4].options = []; }), ['options_empty']);
  assert.deepEqual(broken((s) => { s.addonGroups[2].options = []; }), ['options_empty', 'ref_unknown'], 'the cheese rule loses its option');
  assert.deepEqual(broken((s) => { s.addonGroups[3].options[1].default = true; }), ['defaults_exceed']);
  assert.deepEqual(broken((s) => { s.addonGroups[2].options[0].maxQty = 0; }), ['option_qty_invalid']);
  assert.deepEqual(broken((s) => { s.addonGroups[2].options[0].price = 1.5; }), ['price_invalid']);
  assert.deepEqual(broken((s) => { s.addonGroups[1].options[0].id = s.addonGroups[0].options[0].id; }), ['id_duplicate']);
});

test('nesting: one level only', () => {
  // the sauce (a nested group) gets an option that opens the extras: two levels
  assert.deepEqual(broken((s) => { s.addonGroups[1].options[0].opensGroupId = ID.extras; }), ['nesting_too_deep']);
  assert.deepEqual(broken((s) => { s.addonGroups[2].options[0].opensGroupId = ID.extras; s.addonGroups[2].options[0].maxQty = 1; }), ['opens_self']);
  assert.deepEqual(broken((s) => { s.addonGroups[0].options[1].opensGroupId = '00000000-0000-4000-8000-00000000ffff'; }), ['ref_unknown']);
  assert.deepEqual(broken((s) => { s.addonGroups[0].options[0].maxQty = 2; }), ['opener_qty']);
});

test('dish add-ons: known groups, no repeats, reachable minimum, single max', () => {
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].addons.push({ groupId: ID.side, min: 1, max: 1 }); }), ['addon_duplicate']);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].addons[0].groupId = '00000000-0000-4000-8000-00000000ffff'; }), ['ref_unknown']);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].addons[1] = { groupId: ID.extras, min: 5, max: 5 }; }), ['min_unreachable']);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].addons[0].max = 2; }), ['single_max']);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].addons[1] = { groupId: ID.extras, min: 2, max: 1 }; }), ['limits_invalid']);
});

test('related dishes and schedules must exist; a dish is not related to itself', () => {
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].related.push(ID.burger); }), ['related_self']);
  assert.deepEqual(broken((s) => { s.sections[1].dishes[0].related.push('00000000-0000-4000-8000-00000000ffff'); }), ['ref_unknown']);
  assert.deepEqual(broken((s) => { s.sections[0].scheduleId = '00000000-0000-4000-8000-00000000ffff'; }), ['ref_unknown']);
  assert.deepEqual(broken((s) => { s.schedules[0].windows = []; }), ['window_invalid']);
  assert.deepEqual(broken((s) => { s.schedules[0].windows[0].from = '24:00'; }), ['window_invalid']);
  assert.deepEqual(broken((s) => { s.schedules[0].windows[0].days = [7]; }), ['window_invalid']);
  assert.deepEqual(broken((s) => { s.schedules[1].validFrom = '2026-11-01'; s.schedules[1].validTo = '2026-10-01'; }), ['date_invalid']);
});

test('upsell rules: references, option rules need a dish, priority and cap ranges', () => {
  assert.deepEqual(broken((s) => { s.upsellRules[0].suggest.dishId = '00000000-0000-4000-8000-00000000ffff'; }), ['ref_unknown']);
  assert.deepEqual(broken((s) => { s.upsellRules[1].suggest.groupId = ID.side; }), ['rule_option_group']);
  assert.deepEqual(broken((s) => { s.upsellRules[1].trigger = 'checkout'; }), ['rule_option_needs_dish']);
  assert.deepEqual(broken((s) => { s.upsellRules[0].scope = { kind: 'dish', ids: [] }; }), ['rule_scope_empty']);
  assert.deepEqual(broken((s) => { s.upsellRules[0].priority = 101; }), ['priority_invalid']);
  assert.deepEqual(broken((s) => { s.upsellRules[0].cap = 0; }), ['cap_invalid']);
  assert.deepEqual(broken((s) => { s.upsellRules[0].when = { days: [], from: '07:00', to: null }; }), ['window_invalid']);
  assert.deepEqual(broken((s) => { s.upsellRules[0].trigger = 'popup'; }), ['enum_invalid']);
});

test('every error names its path', () => {
  const s = mutable(cafeDemo());
  s.sections[1].dishes[0].price.amount = 'free';
  s.addonGroups[1].options[0].opensGroupId = ID.extras;
  const r = validateSnapshotV2(s);
  assert.ok(!r.ok);
  // depth is reported at each opener whose group itself opens another (fries and sweet potato fries both open the sauce)
  assert.deepEqual(r.errors.map((e) => `${e.code}@${e.path}`).sort(), [
    'nesting_too_deep@addonGroups[0].options[0].opensGroupId',
    'nesting_too_deep@addonGroups[0].options[2].opensGroupId',
    'price_invalid@sections[1].dishes[0].price',
  ]);
});

test('an option in an unopened group may open one: that is still one level', () => {
  assert.deepEqual(broken((s) => { s.addonGroups[4].options[1].opensGroupId = ID.sauce; }), [], 'milk → sauce: odd, but one level');
});
