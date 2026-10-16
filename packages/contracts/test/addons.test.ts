// Saving an add-on group in one call: the twin of app.validate_addon_group_input, the editor's per-group entry point,
// the checks against the stored menu, and the reply.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADDON_POSITION_MAX, ADDON_TEXT_MAX, addonGroupMenuIssues, LIMITS, validateAddonGroup, validateAddonGroupInput,
  type AddonGroupMenu, type AddonGroupWrite, type AddonOptionWrite, type SaveAddonGroupInput, type SaveAddonGroupReply, type Validation,
} from '../src/index.ts';

const V = '00000000-0000-4000-8000-0000000000c1';
const G = '00000000-0000-4000-8000-00000000a001'; // the group being saved (sides)
const SAUCE = '00000000-0000-4000-8000-00000000a002'; // a group whose options open nothing
const EXTRAS = '00000000-0000-4000-8000-00000000a003'; // a group holding an opener
const optId = (n: number): string => `00000000-0000-4000-8000-0000000b${String(n).padStart(4, '0')}`;
const opt = (n: number, o: Record<string, unknown> = {}) => ({
  id: optId(n), position: n, name_he: `תוספת ${n}`, name_en: `Side ${n}`, price: 0, max_qty: 1, is_default: false, opens_group_id: null, ...o,
});
const group = (o: Record<string, unknown> = {}) => ({
  id: G, label: 'Sides, burgers', name_he: 'תוספות', name_en: 'Sides', selection: 'multiple', min_units: 0, max_units: 2, ...o,
});
const check = (o: Record<string, unknown> = {}) => ({ venueId: V, group: group(), options: [opt(1), opt(2)], ...o });
const errs = (r: Validation<unknown>) => (r.ok ? [] : r.errors.map((e) => `${e.code}@${e.path}`));
const first = (gr: Record<string, unknown>, options: unknown = [opt(1), opt(2)]) => errs(validateAddonGroupInput(check({ group: gr, options })))[0] ?? 'ok';

test('valid inputs: whole rows, the shortest group, and defaults from the table', () => {
  assert.deepEqual(errs(validateAddonGroupInput(check())), []);
  // only the id: label and names '' would leave no name, so a name is the least a group needs
  assert.deepEqual(errs(validateAddonGroupInput({ venueId: V, group: { id: G, name_en: 'Sides' }, options: [{ id: optId(1), name_he: 'צ׳יפס' }] })), []);
  // an empty list is a valid save (publishing refuses the empty group)
  assert.deepEqual(errs(validateAddonGroupInput(check({ options: [] }))), []);
  assert.deepEqual(errs(validateAddonGroupInput(check({ group: group({ limits_confirmed: true, min_units: 2, max_units: 2 }) }))), []);
  // 60 emoji are 60 code points, and blank edges do not count
  const burgers = String.fromCodePoint(0x1f354).repeat(ADDON_TEXT_MAX);
  assert.deepEqual(errs(validateAddonGroupInput(check({ group: group({ name_en: ` ${burgers} `, label: burgers }) }))), []);
  const typed: SaveAddonGroupInput = { venueId: V, group: { id: G, name_en: 'Sides' }, options: [{ id: optId(1), name_en: 'Fries' }], expectedUpdatedAt: null };
  assert.ok(typed);
});

test('every group code, with the path the database gives (supabase/tests/addon-group)', () => {
  assert.equal(first(group({ name_he: ' ', name_en: '' })), 'name_missing@group');
  assert.equal(first(group({ name_en: 'x'.repeat(ADDON_TEXT_MAX + 1) })), 'text_too_long@group.name_en');
  assert.equal(first(group({ selection: 'single' })), 'single_max@group.max_units');
  assert.equal(first({ id: G, name_en: 'Sides', max_units: 2 }), 'single_max@group.max_units', 'single is the default');
  assert.equal(first(group({ selection: null })), 'enum_invalid@group.selection');
  assert.equal(first(group({ min_units: 3 })), 'units_invalid@group.max_units', 'min above max is the max to fix');
  assert.equal(first(group({ max_units: 31 })), 'units_invalid@group.max_units');
  assert.equal(first(group({ min_units: -1, max_units: 0 })), 'units_invalid@group.min_units', 'the min first, alone');
  assert.equal(first(group({ min_units: 1.5 })), 'units_invalid@group.min_units');
  assert.equal(first(group({ selection: 'any' })), 'enum_invalid@group.selection');
  assert.equal(first(group({ venue_id: V })), 'field_not_allowed@group.venue_id');
  assert.equal(first(group({ id: 'g1' })), 'id_invalid@group.id');
  assert.equal(first(group({ label: 5 })), 'type@group.label');
  assert.equal(first(group({ limits_confirmed: 'yes' })), 'type@group.limits_confirmed');
  assert.equal(first(group({ label: `a${String.fromCharCode(0)}b` })), 'text_invalid@group.label', 'the contracts only: such JSON never reaches the database');
  assert.deepEqual(errs(validateAddonGroupInput(check({ group: 'sides' }))), ['type@group']);
});

test('every option code, with the path the database gives', () => {
  const o = (options: unknown, gr: Record<string, unknown> = {}) => errs(validateAddonGroupInput(check({ group: group(gr), options })));
  assert.deepEqual(o([opt(1), opt(1)]), ['id_duplicate@options[1].id']);
  assert.deepEqual(o([opt(1), opt(1, { id: optId(1).toUpperCase() })]), ['id_duplicate@options[1].id'], 'ids compare without case');
  assert.deepEqual(o([opt(1, { name_he: '', name_en: '' })]), ['name_missing@options[0]']);
  assert.deepEqual(o([opt(1, { price: 2.5 }), opt(2, { price: LIMITS.price + 1 }), opt(3, { price: -1 })]),
    ['price_invalid@options[0].price', 'price_invalid@options[1].price', 'price_invalid@options[2].price']);
  assert.deepEqual(o([opt(1, { max_qty: 11 }), opt(2, { max_qty: 0 }), opt(3, { max_qty: null })]),
    ['qty_invalid@options[0].max_qty', 'qty_invalid@options[1].max_qty', 'qty_invalid@options[2].max_qty']);
  assert.deepEqual(o([opt(1, { max_qty: 2, opens_group_id: SAUCE })]), ['qty_invalid@options[0].max_qty'], 'an opener counts one');
  assert.deepEqual(o([{ id: optId(1), name_en: 'x', opens_group_id: SAUCE }]), [], 'an opener with the default max_qty');
  assert.deepEqual(o([opt(1, { opens_group_id: G.toUpperCase() })]), ['nesting_invalid@options[0].opens_group_id']);
  assert.deepEqual(o([opt(1, { opens_group_id: 'sauce' })]), ['id_invalid@options[0].opens_group_id']);
  assert.deepEqual(o([1, 2, 3].map((n) => opt(n, { is_default: true }))), ['defaults_invalid@options'], 'three defaults, two at most');
  assert.deepEqual(o([opt(1, { is_default: 'no' })]), ['type@options[0].is_default']);
  assert.deepEqual(o([opt(1, { colour: 'red' })]), ['field_not_allowed@options[0].colour']);
  assert.deepEqual(o([opt(1, { position: -1 }), opt(2, { position: ADDON_POSITION_MAX + 1 }), opt(3, { position: '3' })]),
    ['position_invalid@options[0].position', 'position_invalid@options[1].position', 'position_invalid@options[2].position']);
  assert.deepEqual(o([opt(1, { id: 'b1' }), 'fries']), ['id_invalid@options[0].id', 'type@options[1]']);
  assert.deepEqual(o({ 0: opt(1) }), ['type@options']);
  // the defaults count only when the group's limits are readable
  assert.deepEqual(o([1, 2, 3].map((n) => opt(n, { is_default: true })), { max_units: 40 }), ['units_invalid@group.max_units']);
});

test('the input: its own keys, and the first issue in the twin order', () => {
  assert.deepEqual(errs(validateAddonGroupInput('x')), ['type@']);
  assert.deepEqual(errs(validateAddonGroupInput(check({ venueId: 'x', expectedUpdatedAt: null }))), ['field_not_allowed@expectedUpdatedAt', 'id_invalid@venueId']);
  const r = validateAddonGroupInput(check({ venueId: 'x', group: group({ min_units: 5 }), options: [opt(1, { max_qty: 0 })] }));
  assert.deepEqual(errs(r), ['id_invalid@venueId', 'units_invalid@group.max_units', 'qty_invalid@options[0].max_qty']);
  // a key whose value is undefined does not reach the database (JSON leaves it out)
  assert.deepEqual(errs(validateAddonGroupInput(check({ group: group({ min_units: undefined, selection: undefined, max_units: 1 }) }))), []);
});

test('the per-group entry point: the same checks and paths for the editor form', () => {
  assert.deepEqual(errs(validateAddonGroup(group(), [opt(1)])), []);
  assert.deepEqual(errs(validateAddonGroup(group({ selection: 'single' }), [opt(1, { opens_group_id: G })])),
    ['single_max@group.max_units', 'nesting_invalid@options[0].opens_group_id']);
  const ok = validateAddonGroup(group(), [opt(1)]);
  assert.ok(ok.ok && ok.value.group.id === G && ok.value.options.length === 1);
});

test('the checks against the stored menu, before the call', () => {
  const menu: AddonGroupMenu = {
    groups: [{ id: G }, { id: SAUCE }, { id: EXTRAS }],
    options: [
      { id: optId(1), group_id: G, opens_group_id: null },
      { id: optId(2), group_id: G, opens_group_id: EXTRAS }, // replaced by the input, so it does not count
      { id: optId(50), group_id: EXTRAS, opens_group_id: SAUCE },
      { id: optId(60), group_id: SAUCE, opens_group_id: null },
    ],
  };
  const issues = (g: AddonGroupWrite, options: AddonOptionWrite[]) => addonGroupMenuIssues(g, options, menu).map((e) => `${e.code}@${e.path}`);
  assert.deepEqual(issues({ id: G }, [opt(1), opt(2, { opens_group_id: SAUCE })]), []);
  assert.deepEqual(issues({ id: G }, [opt(1, { opens_group_id: '00000000-0000-4000-8000-00000000a0ff' })]), ['group_unknown@options[0].opens_group_id']);
  assert.deepEqual(issues({ id: G }, [opt(1, { opens_group_id: EXTRAS })]), ['nesting_too_deep@options[0].opens_group_id'], 'extras opens a group already');
  assert.deepEqual(issues({ id: SAUCE }, [opt(60, { opens_group_id: G })]), ['nesting_too_deep@options[0].opens_group_id'], 'sauce is opened by extras');
  assert.deepEqual(issues({ id: G }, [opt(1), opt(50)]), ['not_allowed@options[1].id'], 'an option never moves between groups');
});

test('the reply: stale carries the stored rows, option_in_rules the rules, the rest a code and a path', () => {
  const say = (r: SaveAddonGroupReply): string => {
    if (r.ok) return `saved ${r.options.length}`;
    if (r.code === 'stale') return `changed at ${r.current.group.updated_at}`;
    if (r.code === 'option_in_rules') return `rules ${r.rules.join(',')}`;
    return `${r.code} ${r.path ?? ''}`.trim();
  };
  assert.equal(say({ ok: false, code: 'option_in_rules', rules: ['r1', 'r2'] }), 'rules r1,r2');
  assert.equal(say({ ok: false, code: 'not_allowed', path: 'options[0].id' }), 'not_allowed options[0].id');
  assert.equal(say({ ok: false, code: 'nesting_too_deep' }), 'nesting_too_deep');
  assert.equal(say({ ok: false, code: 'invalid', constraint: 'addon_groups_check' }), 'invalid');
  // @ts-expect-error a stale answer always carries what is stored
  const bad: SaveAddonGroupReply = { ok: false, code: 'stale' };
  assert.ok(bad);
});
