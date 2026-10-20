// The v2 owner app's data layer, through its public functions: rows ↔ forms, shekels ↔ agorot, the nesting guard the
// editor applies, the guest preview's prices (every combination of an invented schnitzel), what publishing would
// change, and errors in the app's codes. Invented data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, defaultSelection, priceDish, validateSnapshotV2 } from '@mana/contracts';
import {
  agorotOf, blockedColumns, changed, dishDraft, dishEdit, dishLimitsFromForm, dishToForm, effectiveLimits, groupFromForm, groupToForm, limitChoices,
  mergeGroupForms, newGroupForm, newOptionForm, sectionFromForm, sectionToForm, shekelsOf, withSelection,
} from '../../src/v2/data/forms.ts';
import { canHoldOpeners, nestingProblem, openTargets } from '../../src/v2/data/nesting.ts';
import { choose, clearGroup, guestModel, menuPrice, pricingOf, setQty, unitsIn } from '../../src/v2/data/guest.ts';
import { menuChanges, standingOf, anyChange } from '../../src/v2/data/changes.ts';
import { refusal, toV2Error, V2Error } from '../../src/v2/data/errors.ts';
import { byPosition, newId, reorder } from '../../src/v2/data/rows.ts';

// ---------------------------------------------------------------- an invented menu, as stored rows
const V = '00000000-0000-4000-8000-0000000000aa';
let n = 0;
const id = () => '00000000-0000-4000-8000-' + String(++n).padStart(12, '0');
const at = (i) => `2026-10-16T10:00:${String(i).padStart(2, '0')}Z`;
const group = (o) => ({ id: id(), venue_id: V, label: '', name_he: '', name_en: '', selection: 'single', min_units: 0, max_units: 1, created_at: at(n), updated_at: at(n), ...o });
const option = (g, o) => ({ id: id(), venue_id: V, group_id: g.id, position: 0, name_he: '', name_en: '', price: 0, max_qty: 1, is_default: false, opens_group_id: null, created_at: at(n), updated_at: at(n), ...o });
const dish = (o) => ({ id: id(), venue_id: V, section_id: 'sec', position: 0, name_he: '', name_en: '', desc_he: '', desc_en: '', price: null, price_note_he: '', price_note_en: '', tags: [],
  allergens_he: '', allergens_en: '', details: {}, asset_id: null, stock_id: null, schedule_id: null, hidden: false, created_at: at(n), updated_at: at(n), ...o });
const dag = (d, g, o = {}) => ({ id: id(), venue_id: V, dish_id: d.id, group_id: g.id, position: 0, min_units: null, max_units: null, created_at: at(n), ...o });

const side = group({ label: 'Side, mains', name_he: 'תוספת לבחירה', name_en: 'Side of choice', selection: 'multiple', min_units: 1, max_units: 2 });
const sauce = group({ name_he: 'רוטב', name_en: 'Sauce', selection: 'single', min_units: 1, max_units: 1 });
const fries = option(side, { position: 0, name_en: 'Fries', opens_group_id: sauce.id });
const salad = option(side, { position: 1, name_en: 'Salad', price: 400 });
const rice = option(side, { position: 2, name_en: 'Rice' });
const ketchup = option(sauce, { position: 0, name_en: 'Ketchup', is_default: true });
const aioli = option(sauce, { position: 1, name_en: 'Aioli', price: 300 });
const schnitzel = dish({ name_en: 'Schnitzel', price: 6200 });
const kids = dish({ name_en: 'Kids schnitzel', price: 4400, position: 1 });
const rows = {
  dishes: [schnitzel, kids], groups: [side, sauce], options: [aioli, rice, fries, ketchup, salad],
  dishGroups: [dag(schnitzel, side), dag(kids, side, { max_units: 1 })], relations: [],
};

test('shekels typed by a person become agorot, and back; more than the schema allows is refused', () => {
  assert.equal(agorotOf('62'), 6200); assert.equal(agorotOf('62.50'), 6250); assert.equal(agorotOf('₪ 3'), 300); assert.equal(agorotOf(''), null);
  assert.equal(agorotOf('abc'), 'invalid'); assert.equal(agorotOf('-3'), 'invalid');
  assert.equal(agorotOf(String(LIMITS.price / 100)), LIMITS.price); assert.equal(agorotOf(String(LIMITS.price / 100 + 1)), 'invalid');
  for (const a of [0, 5, 99, 300, 6200, 6250, 123456]) assert.equal(agorotOf(shekelsOf(a)), a);
  assert.equal(shekelsOf(null), '');
});

test('a section: names stripped, one language is enough, none is name_missing; its day part goes with it', () => {
  const row = { id: 's', venue_id: V, position: 0, name_he: 'עיקריות', name_en: '', kind: 'food', scene: 'auto', room: null, schedule_id: null, hidden: false, created_at: at(1), updated_at: at(1) };
  const f = sectionToForm(row);
  assert.deepEqual(f, { nameHe: 'עיקריות', nameEn: '', kind: 'food', room: null, scheduleId: null, hidden: false });
  assert.deepEqual(sectionFromForm({ ...f, nameEn: '  Mains‏ ', room: 'table' }), { ok: true, value: { name_he: 'עיקריות', name_en: 'Mains', kind: 'food', room: 'table', schedule_id: null, hidden: false } });
  assert.equal(sectionFromForm({ ...f, scheduleId: 'breakfast' }).value.schedule_id, 'breakfast');
  assert.equal(sectionToForm({ ...row, schedule_id: 'breakfast' }).scheduleId, 'breakfast');
  assert.deepEqual(sectionFromForm({ ...f, nameHe: '  ' }).errors, [{ field: 'name', code: 'name_missing' }]);
  assert.deepEqual(sectionFromForm({ ...f, room: 'garden' }).errors, [{ field: 'room', code: 'enum_invalid' }]);
});

test('a dish: the form shows shekels, the write stores agorot; a field with a problem is held back, the others are saved', () => {
  const f = dishToForm({ ...schnitzel, tags: ['spicy', 'vegan'], price_note_en: 'for two' });
  assert.equal(f.price, '62'); assert.deepEqual(f.tags, ['vegan', 'spicy']); assert.equal(f.priceNoteEn, 'for two');
  const ok = dishDraft({ ...f, price: '64.50', descEn: ' Crisp ', allergensHe: 'גלוטן, ביצה' });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.value.price, 6450); assert.equal(ok.value.desc_en, 'Crisp'); assert.equal(ok.value.allergens_he, 'גלוטן, ביצה');
  assert.deepEqual(changed(schnitzel, ok.value), { price: 6450, desc_en: 'Crisp', allergens_he: 'גלוטן, ביצה', tags: ['vegan', 'spicy'], price_note_en: 'for two' });
  assert.equal(dishDraft({ ...f, price: '' }).value.price, null);
  const bad = dishDraft({ ...f, price: '6o', nameEn: '', nameHe: '' });
  assert.deepEqual(bad.errors.map((e) => e.code).sort(), ['name_missing', 'price_invalid']);
  assert.deepEqual([...blockedColumns(bad.errors)].sort(), ['name_en', 'name_he', 'price']);
});

test('one edit of a dish asks to store only the columns it changed (never a column changed elsewhere and stale here)', () => {
  const f = dishToForm(schnitzel);
  // the price is typed: the price only, though every other column of this (stale) form differs from some stored row
  assert.deepEqual(dishEdit(f, { ...f, price: '65' }).patch, { price: 6500 });
  assert.deepEqual(dishEdit(f, { ...f, descHe: ' פריך ' }).patch, { desc_he: 'פריך' });
  assert.deepEqual(dishEdit(f, { ...f, tags: ['vegan'] }).patch, { tags: ['vegan'] });
  // a price with a problem is held back (and said), the edit stores nothing; fixed, it goes, even back to "no price"
  const typo = { ...f, price: '6o' };
  assert.deepEqual(dishEdit(f, typo), { patch: {}, errors: [{ field: 'price', code: 'price_invalid' }] });
  assert.deepEqual(dishEdit(typo, { ...typo, price: '60' }).patch, { price: 6000 });
  assert.deepEqual(dishEdit(typo, { ...typo, price: '' }).patch, { price: null });
  // both names emptied: held back; one typed again: both names go
  const blank = { ...f, nameHe: '', nameEn: '' };
  assert.deepEqual(dishEdit(f, blank).patch, {});
  assert.deepEqual(dishEdit(blank, { ...blank, nameEn: 'Schnitzel' }).patch, { name_he: '', name_en: 'Schnitzel' });
  // the section is not an autosave column (moving takes a new position: its own write)
  assert.deepEqual(dishEdit(f, { ...f, sectionId: 'elsewhere' }).patch, {});
});

test('new rows get their ids here: a uuid, a new one each time; a new choice is saved under its own', () => {
  const a = newId(), b = newId();
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
  const f = groupToForm(side, rows.options);
  const extra = newOptionForm();
  assert.equal(extra.id, null);
  const w = groupFromForm({ ...f, options: [...f.options, { ...extra, nameHe: 'צ׳יפס בטטה' }] }, side.id);
  assert.equal(w.ok, true);
  assert.deepEqual(w.value.options.map((o) => o.id), [fries.id, salad.id, rice.id, extra.key], 'the stored ones keep theirs; the new one is saved under the id made for it');
});

test('a group: the form round-trips, and every rule the validators hold is checked before a write', () => {
  const f = groupToForm(side, rows.options);
  assert.deepEqual(f.options.map((o) => o.nameEn), ['Fries', 'Salad', 'Rice']);
  assert.deepEqual(f.options.map((o) => o.price), ['', '4', '']);
  const w = groupFromForm(f, side.id);
  assert.equal(w.ok, true);
  assert.deepEqual(w.value.group, { label: 'Side, mains', name_he: 'תוספת לבחירה', name_en: 'Side of choice', selection: 'multiple', min_units: 1, max_units: 2 });
  assert.deepEqual(w.value.options.map((o) => [o.id, o.position, o.price, o.opens_group_id]), [[fries.id, 0, 0, sauce.id], [salad.id, 1, 400, null], [rice.id, 2, 0, null]]);

  // the rules are the contracts' (validateAddonGroup, the database's twin): the same codes, at the form's fields
  const issues = (form, gid = side.id) => { const r = groupFromForm(form, gid); return r.ok ? [] : r.errors.map((e) => e.code + '@' + e.field); };
  assert.deepEqual(issues({ ...f, nameHe: '', nameEn: '' }), ['name_missing@name']);
  assert.deepEqual(issues({ ...f, options: [] }), ['options_empty@options']);
  assert.deepEqual(issues({ ...f, min: 4, max: 4 }), ['min_unreachable@limits']);
  assert.deepEqual(issues({ ...f, min: 2, max: 1 }), ['units_invalid@limits']);
  assert.deepEqual(issues({ ...f, selection: 'single' }), ['single_max@limits']);
  assert.deepEqual(issues({ ...f, options: f.options.map((o) => ({ ...o, isDefault: true })) }), ['defaults_invalid@defaults']);
  assert.deepEqual(issues({ ...f, options: f.options.map((o, i) => (i === 0 ? { ...o, maxQty: 2 } : o)) }), ['opener_qty@options.0.maxQty']);
  assert.deepEqual(issues({ ...f, options: f.options.map((o, i) => (i === 1 ? { ...o, opensGroupId: side.id } : o)) }), ['nesting_invalid@options.1.opens']);
  assert.deepEqual(issues({ ...f, options: f.options.map((o, i) => (i === 2 ? { ...o, price: '1,2,3' } : o)) }), ['price_invalid@options.2.price']);
  assert.deepEqual(issues({ ...f, options: f.options.map((o, i) => (i === 2 ? { ...o, maxQty: 11 } : o)) }), ['qty_invalid@options.2.maxQty']);
  assert.deepEqual(issues({ ...f, options: f.options.map((o, i) => (i === 1 ? { ...o, nameHe: '', nameEn: '' } : o)) }), ['name_missing@options.1.name']);
  assert.deepEqual(issues({ ...f, label: 'א'.repeat(61) }), ['text_too_long@label']);

  // switching to "choose one" keeps the form valid: one unit, one default, one of each choice
  const many = { ...f, min: 1, max: 2, options: f.options.map((o) => ({ ...o, isDefault: true, maxQty: o.opensGroupId ? 1 : 3 })) };
  const one = withSelection(many, 'single');
  assert.deepEqual([one.min, one.max], [1, 1]);
  assert.deepEqual(one.options.map((o) => [o.isDefault, o.maxQty]), [[true, 1], [false, 1], [false, 1]]);
  assert.equal(groupFromForm(one, side.id).ok, true);
  assert.equal(groupFromForm(newGroupForm(), newId()).ok, false, 'a new group needs a name and a named choice');
});

test('"save my changes over it": only what the owner changed here goes over the group as stored now', () => {
  const opened = groupToForm(side, rows.options);                        // the form as read: fries, salad, rice
  const [F, S, R] = opened.options;
  const corn = { ...newOptionForm(), nameEn: 'Corn' }, fresh = { ...newOptionForm(), nameEn: 'Beans' };
  // elsewhere: a label, a larger maximum, fries renamed in English, salad dearer, rice deleted, corn added
  const stored = { ...opened, label: 'Side, all', max: 3, options: [{ ...F, nameEn: 'Chips' }, { ...S, price: '5' }, corn] };
  // here: the group's Hebrew name, fries deleted, salad renamed in Hebrew, rice cheaper, beans added
  const mine = { ...opened, nameHe: 'תוספת', options: [{ ...S, nameHe: 'סלט ירוק' }, { ...R, price: '2' }, fresh] };
  const m = mergeGroupForms(opened, mine, stored);
  assert.deepEqual([m.label, m.nameHe, m.max], ['Side, all', 'תוספת', 3], 'their label and maximum stay; my name goes over');
  assert.deepEqual(m.options.map((o) => [o.nameEn, o.nameHe, o.price]), [
    ['Salad', 'סלט ירוק', '5'],                                              // their price, my name
    ['Corn', '', ''],                                                        // added there: stays
    ['Rice', rows.options.find((o) => o.id === R.id).name_he, '2'],         // deleted there, changed here: back
    ['Beans', '', ''],                                                       // added here
  ]);
  assert.equal(m.options.some((o) => o.id === F.id), false, 'deleted here: gone');
  // the owner changed the order: theirs wins over the stored one, what was added there comes after
  const reordered = mergeGroupForms(opened, { ...opened, options: [R, S, F] }, stored);
  assert.deepEqual(reordered.options.map((o) => o.nameEn), ['Salad', 'Chips', 'Corn'], 'rice, deleted there and unchanged here, stays deleted');
  // nothing changed here: the stored group as it is
  assert.deepEqual(mergeGroupForms(opened, opened, stored), stored);
});

test('a dish may only tighten a group: the editor offers only tighter limits, stores null for the group\'s own', () => {
  assert.deepEqual(limitChoices(side, 3, 1), { mins: [1, 2], maxes: [1, 2] });
  assert.deepEqual(limitChoices(side, 3, 2), { mins: [1, 2], maxes: [2] });
  assert.deepEqual(limitChoices(sauce, 2, 1), { mins: [1], maxes: [1] });
  assert.deepEqual(limitChoices({ selection: 'multiple', min_units: 0, max_units: 5 }, 3, 0), { mins: [0, 1, 2, 3], maxes: [1, 2, 3, 4, 5] });
  assert.deepEqual(dishLimitsFromForm(side, 3, 1, 1), { ok: true, value: { min_units: null, max_units: 1 } });
  assert.deepEqual(dishLimitsFromForm(side, 3, 1, 2), { ok: true, value: { min_units: null, max_units: null } });
  assert.deepEqual(dishLimitsFromForm(side, 3, 0, 2).errors, [{ field: 'limits', code: 'limits_loosened' }]);
  assert.deepEqual(dishLimitsFromForm(side, 3, 1, 3).errors, [{ field: 'limits', code: 'limits_loosened' }]);
  assert.deepEqual(dishLimitsFromForm(sauce, 2, 1, 2).errors, [{ field: 'limits', code: 'single_max' }]);
  assert.deepEqual(dishLimitsFromForm(side, 3, 2, 1).errors, [{ field: 'limits', code: 'limits_invalid' }]);
  // the guest gets the dish's limits clamped to the group's, as the snapshot builder does
  assert.deepEqual(effectiveLimits(side, { min_units: null, max_units: 1 }), { min: 1, max: 1 });
  assert.deepEqual(effectiveLimits({ ...side, max_units: 1 }, { min_units: null, max_units: 2 }), { min: 1, max: 1 });
});

test('the nesting guard: one level, never offered a second', () => {
  const extras = group({ name_en: 'Extras', selection: 'multiple', max_units: 3 });
  const cheese = option(extras, { name_en: 'Cheese', max_qty: 2 });
  const all = [...rows.options, cheese];
  const groups = [side, sauce, extras];
  // Sauce is opened by Fries: its choices may open nothing
  assert.equal(canHoldOpeners(sauce.id, all), false);
  assert.deepEqual(openTargets(sauce.id, groups, all), []);
  assert.equal(nestingProblem(sauce.id, [null, extras.id], all), 'nesting_too_deep');
  // Side's choices may open Sauce or Extras (never Side itself); Extras may open Sauce, not Side (Side opens a group)
  assert.deepEqual(openTargets(side.id, groups, all).map((g) => g.name_en), ['Sauce', 'Extras']);
  assert.deepEqual(openTargets(extras.id, groups, all).map((g) => g.name_en), ['Sauce']);
  assert.equal(nestingProblem(extras.id, [sauce.id], all), null);
  assert.equal(nestingProblem(extras.id, [side.id], all), 'nesting_too_deep');
  assert.equal(nestingProblem(side.id, [side.id], all), 'opens_self');
  assert.deepEqual(openTargets(null, groups, all).map((g) => g.name_en), ['Sauce', 'Extras'], 'a new group may open any group without openers');
  // another device makes Extras a nested group: now Extras may open nothing, and the database would refuse it too
  const combo = group({ name_en: 'Combo' });
  const opened = [...all, option(combo, { name_en: 'Loaded', opens_group_id: extras.id })];
  assert.equal(canHoldOpeners(extras.id, opened), false);
  assert.equal(nestingProblem(extras.id, [sauce.id], opened), 'nesting_too_deep');
  // the group's own options are what its form replaces: Combo may keep opening Extras (or Sauce), never Side (an opener)
  assert.deepEqual(openTargets(combo.id, [...groups, combo], opened).map((g) => g.name_en), ['Sauce', 'Extras']);
});

test('the guest preview prices every combination of the schnitzel and the kids\' one exactly as priceDish does', () => {
  const big = guestModel(rows, schnitzel.id), small = guestModel(rows, kids.id);
  assert.deepEqual(big.dish.addons, [{ groupId: side.id, min: 1, max: 2 }]);
  assert.deepEqual(small.dish.addons, [{ groupId: side.id, min: 1, max: 1 }]);
  assert.deepEqual([...big.groups.keys()].sort(), [side.id, sauce.id].sort());
  assert.deepEqual(menuPrice(rows, schnitzel.id), { amount: 6200, from: true });
  assert.deepEqual(menuPrice(rows, kids.id), { amount: 4400, from: true });

  const top = { groupId: side.id, parentOptionId: null }, under = { groupId: sauce.id, parentOptionId: fries.id };
  const total = (m, sel) => { const r = priceDish(m.dish, sel, pricingOf(m)); return r.ok ? r.total : r.error.code; };
  const pick = (m, picks) => {
    let s = clearGroup(defaultSelection(m.dish, pricingOf(m)), top);
    for (const p of picks) {
      if (p === 'aioli') s = choose(s, m, under, aioli.id, true);
      else s = choose(s, m, top, { fries: fries.id, salad: salad.id, rice: rice.id }[p], true);
    }
    return s;
  };
  // fries brings the sauce's default (ketchup); aioli swaps it
  const want = { fries: 6200, 'fries+aioli': 6500, salad: 6600, rice: 6200, 'fries+salad': 6600, 'fries+aioli+salad': 6900, 'fries+rice': 6200, 'fries+aioli+rice': 6500, 'salad+rice': 6600 };
  for (const [combo, amount] of Object.entries(want)) assert.equal(total(big, pick(big, combo.split('+'))), amount, combo);
  const wantKids = { fries: 4400, 'fries+aioli': 4700, salad: 4800, rice: 4400 };
  for (const [combo, amount] of Object.entries(wantKids)) assert.equal(total(small, pick(small, combo.split('+'))), amount, combo);
  // the limits: nothing is below the minimum; a third side does not fit (the preview does not add it); one only on the kids'
  assert.equal(total(big, pick(big, [])), 'below_min');
  const three = pick(big, ['fries', 'salad', 'rice']);
  assert.equal(unitsIn(three, top), 2);
  assert.equal(total(small, pick(small, ['fries', 'salad'])), 4800, 'a group of one swaps its choice');
  // a nested sauce chosen away from fries is not possible: unchoosing fries takes its sauce with it
  const off = choose(pick(big, ['fries', 'aioli', 'salad']), big, top, fries.id, false);
  assert.equal(total(big, off), 6600);
  // quantities: a choice with a most-per-dish above one
  const extras = group({ name_en: 'Extras', selection: 'multiple', max_units: 3 });
  const cheese = option(extras, { name_en: 'Cheese', price: 400, max_qty: 2 });
  const withExtras = { ...rows, groups: [...rows.groups, extras], options: [...rows.options, cheese], dishGroups: [...rows.dishGroups, dag(schnitzel, extras, { position: 1 })] };
  const m = guestModel(withExtras, schnitzel.id), ex = { groupId: extras.id, parentOptionId: null };
  let s = choose(defaultSelection(m.dish, pricingOf(m)), m, top, rice.id, true);
  s = setQty(choose(s, m, ex, cheese.id, true), ex, cheese.id, 2);
  assert.equal(total(m, s), 6200 + 800);
  assert.equal(total(m, setQty(s, ex, cheese.id, 3)), 'option_qty_invalid');
});

test('what publishing would change, and where the menu stands for guests', () => {
  const snap = (over = {}) => ({
    v: 2, venueId: V, slug: 'cafe-test', revision: 1, publishedAt: at(1), assetBase: 'http://127.0.0.1/x/', venue: { name: { he: 'ק', en: 'C' } }, locale: {}, pricing: { includesVat: true, vatBasisPoints: 1800 },
    theme: {}, schedules: [], upsellRules: [], addonGroups: [{ id: 'g1', min: 1 }], sections: [{ id: 's1', name: { he: '', en: 'Mains' }, dishes: [{ id: 'd1', price: 1 }, { id: 'd2', price: 2 }] }], ...over,
  });
  const a = snap();
  assert.equal(anyChange(menuChanges(a, snap({ revision: 0, publishedAt: at(9) }))), false, 'a fresh build of the same menu changes nothing');
  const b = snap({ addonGroups: [{ id: 'g1', min: 0 }, { id: 'g2' }], sections: [{ id: 's1', name: { he: '', en: 'Mains' }, dishes: [{ id: 'd1', price: 9 }, { id: 'd3' }] }] });
  assert.deepEqual(menuChanges(a, b), { dishesAdded: 1, dishesRemoved: 1, dishesChanged: 1, groupsChanged: 2, sections: true, other: false });
  assert.equal(standingOf({ first_published_at: null, approved_at: null, published_revision_id: null }), 'never');
  assert.equal(standingOf({ first_published_at: at(1), approved_at: null, published_revision_id: 'r' }), 'pending');
  assert.equal(standingOf({ first_published_at: at(1), approved_at: at(2), published_revision_id: 'r' }), 'live');
  assert.equal(standingOf({ first_published_at: at(1), approved_at: at(2), published_revision_id: null }), 'offline');
});

test('errors come back in the app\'s codes', () => {
  const code = (e) => toV2Error(e).code;
  assert.equal(code({ code: 'P0001', message: 'nesting_too_deep', details: 'the group it opens already opens another group' }), 'nesting_too_deep');
  assert.equal(code({ code: 'P0001', message: 'limits_loosened' }), 'limits_loosened');
  assert.equal(code({ code: 'P0001', message: 'limit_dishes' }), 'limit_dishes');
  assert.equal(code({ code: '42501', message: 'not_allowed' }), 'forbidden', 'the schema\'s permission refusal is the same code as row-level security\'s');
  assert.equal(code({ code: '42501', message: 'new row violates row-level security policy for table "dishes"' }), 'forbidden');
  assert.equal(code({ code: '23505', message: 'duplicate key value violates unique constraint "dish_relations_dish_id_related_dish_id_key"' }), 'duplicate');
  assert.equal(code({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }), 'not_found');
  assert.equal(code({ code: 'PGRST301', message: 'JWT expired' }), 'signed_out');
  assert.equal(code({ name: 'AuthApiError', code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' }), 'email_unconfirmed');
  assert.equal(code({ name: 'AuthApiError', code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' }), 'bad_login');
  assert.equal(code({ name: 'AuthApiError', code: 'signup_disabled', status: 422, message: 'Signups not allowed for this instance' }), 'signup_closed');
  assert.equal(code(new TypeError('Failed to fetch')), 'network');
  assert.equal(code({ code: 'XX000', message: 'something else' }), 'unknown');
  assert.throws(() => refusal({ ok: false, code: 'email_unconfirmed' }), (e) => e instanceof V2Error && e.code === 'email_unconfirmed');
  assert.deepEqual(refusal({ ok: true, id: 'x' }), { ok: true, id: 'x' });
});

test('order: the builder\'s order, and a move writes only what moved', () => {
  const r = (i, p, c) => ({ id: i, position: p, created_at: at(c) });
  assert.deepEqual(byPosition([r('c', 1, 1), r('b', 0, 2), r('a', 0, 2)]).map((x) => x.id), ['a', 'b', 'c']);
  const list = [r('a', 0, 1), r('b', 1, 1), r('c', 2, 1), r('d', 3, 1)];
  assert.deepEqual([...reorder(list, 3, 1)], [['d', 1], ['b', 2], ['c', 3]]);
  assert.deepEqual([...reorder(list, 0, 0)], []);
  assert.deepEqual([...reorder([r('a', 5, 1), r('b', 9, 1)], 0, 1)], [['b', 0], ['a', 1]], 'gaps in stored positions are closed');
});

test('a snapshot built from these rows passes the contracts\' validator (the preview reads what publishing will check)', () => {
  const m = guestModel(rows, schnitzel.id);
  const s = {
    v: 2, venueId: V, slug: 'cafe-test', revision: 0, publishedAt: at(1), assetBase: 'http://127.0.0.1/storage/', venue: { name: { he: 'קפה', en: 'Cafe' }, area: { he: '', en: '' }, cuisine: { he: '', en: '' },
      kind: 'cafe', mode: 'view_only', logo: null, orderUrl: null, bookUrl: null, phone: null, soldOut: 'bottom', timeZone: 'Asia/Jerusalem' },
    locale: { default: 'he', langs: ['he', 'en'], currency: 'ILS' }, pricing: { includesVat: true, vatBasisPoints: 1800 }, theme: { accent: '#E25C7A', surface: 'porcelain', template: null, tableImg: null },
    schedules: [], sections: [{ id: id(), name: { he: '', en: 'Mains' }, kind: 'food', scene: 'auto', room: null, scheduleId: null, dishes: [m.dish] }],
    addonGroups: [...m.groups.values()], upsellRules: [],
  };
  const v = validateSnapshotV2(s);
  assert.equal(v.ok, true, JSON.stringify(v.ok ? [] : v.errors));
});
