// Halom staff's inputs: act for owner (one payload per action), approval, plans, leads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACT_FOR_OWNER_ACTIONS, DISH_PATCH_COLUMNS, validateActForOwner, validateApproveVenue, validateOpsLeadsQuery, validateSetPlan, validateUpdateLead,
  type ActForOwnerInput, type Validation,
} from '../src/index.ts';

const V = '00000000-0000-4000-8000-0000000000c1';
const D = '00000000-0000-4000-8000-00000000d001';
const errs = (r: Validation<unknown>) => (r.ok ? [] : r.errors.map((e) => `${e.code}@${e.path}`).sort());
const reason = 'Owner asked on WhatsApp';

test('act for owner: one valid input per action, typed by the action', () => {
  const inputs: ActForOwnerInput[] = [
    { venueId: V, reason, action: 'availability.set', payload: { targetKind: 'dish', targetId: D, until: { kind: 'duration', minutes: 120 }, note: 'grill down' } },
    { venueId: V, reason, action: 'availability.restore', payload: { targetKind: 'section', targetId: D } },
    { venueId: V, reason, action: 'dish.update', payload: { dishId: D, patch: { price: 6800, name_en: 'Schnitzel', tags: ['spicy'], hidden: false, stock_id: null } } },
    { venueId: V, reason, action: 'menu.publish', payload: {} },
    { venueId: V, reason, action: 'onboarding.set', payload: { step: 'photos', state: 'done', blockers: [] } },
    { venueId: V, reason, action: 'support_case.update', payload: { caseId: D, status: 'resolved' } },
  ];
  assert.deepEqual(inputs.map((i) => i.action), [...ACT_FOR_OWNER_ACTIONS]);
  for (const i of inputs) assert.deepEqual(errs(validateActForOwner(i)), [], i.action);
  // @ts-expect-error a payload of another action does not type-check
  const wrong: ActForOwnerInput = { venueId: V, reason, action: 'menu.publish', payload: { dishId: D, patch: {} } };
  assert.deepEqual(errs(validateActForOwner(wrong)), ['field_not_allowed@payload.dishId', 'field_not_allowed@payload.patch']);
});

test('act for owner: the reason, the action and each payload are checked', () => {
  assert.deepEqual(errs(validateActForOwner({ venueId: 'x', reason: ' ab ', action: 'dish.delete', payload: {} })), ['action_unknown@action', 'id_invalid@venueId', 'reason_required@reason']);
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'availability.set', payload: { targetKind: 'table', targetId: 'x', until: { kind: 'forever' } } })),
    ['enum_invalid@payload.targetKind', 'id_invalid@payload.targetId', 'until_invalid@payload.until']);
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'dish.update', payload: { dishId: D, patch: {} } })), ['nothing_to_change@payload.patch']);
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'dish.update',
    payload: { dishId: D, patch: { price: -5, tags: ['halal'], slug: 'x', name_en: 'x'.repeat(91), position: 1.5, stock_id: 'Bad' } } })),
  ['enum_invalid@payload.patch.tags', 'field_not_allowed@payload.patch.slug', 'price_invalid@payload.patch.price', 'stock_invalid@payload.patch.stock_id',
    'text_too_long@payload.patch.name_en', 'type@payload.patch.position']);
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'onboarding.set', payload: { step: 'publish', state: 'done' } })), ['step_automatic@payload.state']);
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'support_case.update', payload: { caseId: D, status: 'closed' } })), ['enum_invalid@payload.status']);
  assert.ok(DISH_PATCH_COLUMNS.includes('price') && !(DISH_PATCH_COLUMNS as readonly string[]).includes('section_id'));
});

test('approval and plans', () => {
  assert.deepEqual(errs(validateApproveVenue({ venueId: V, reason: 'First menu checked' })), []);
  assert.deepEqual(errs(validateApproveVenue({ venueId: V })), ['reason_required@reason']);
  const now = Date.parse('2026-10-16T09:00:00Z');
  assert.deepEqual(errs(validateSetPlan({ venueId: V, state: 'trialing', until: '2026-11-16T00:00:00Z', reason: 'Pilot extended', plan: 'pilot' }, { now })), []);
  assert.deepEqual(errs(validateSetPlan({ venueId: V, state: 'suspended', reason: 'Asked to pause' }, { now })), []);
  assert.deepEqual(errs(validateSetPlan({ venueId: V, state: 'active', until: '2026-10-01T00:00:00Z', reason: 'Paid', plan: 'gold' }, { now })),
    ['plan_invalid@plan', 'until_in_past@until']);
  assert.deepEqual(errs(validateSetPlan({ venueId: V, state: 'free', until: 'tomorrow', reason: 'x' }, { now })), ['reason_required@reason', 'state_invalid@state', 'time_invalid@until']);
});

test('leads: the read and the update', () => {
  assert.deepEqual(errs(validateOpsLeadsQuery({})), []);
  assert.deepEqual(errs(validateOpsLeadsQuery({ status: 'all', source: 'mana-landing', since: '2026-10-01T00:00:00Z', limit: 50 })), []);
  assert.deepEqual(errs(validateOpsLeadsQuery({ status: 'hot', source: 'Bad Source', since: '2026-10-01', limit: 501, page: 2 })),
    ['enum_invalid@status', 'field_not_allowed@page', 'limit_invalid@limit', 'source_invalid@source', 'time_invalid@since']);
  assert.deepEqual(errs(validateUpdateLead({ id: D, status: 'contacted', owner: 'Halom', notes: 'Called back' })), []);
  assert.deepEqual(errs(validateUpdateLead({ id: 'x', status: 'maybe', owner: 'x'.repeat(81), notes: `a${String.fromCharCode(0)}b` })),
    ['id_invalid@id', 'status_invalid@status', 'text_invalid@notes', 'text_too_long@owner']);
});
