// Halom staff's inputs: act for owner (one payload per action), approval, plans, leads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACT_FOR_OWNER_ACTIONS, DISH_PATCH_COLUMNS, validateActForOwner, validateApproveVenue, validateOpsLeadsQuery, validateSetPlan, validateUpdateLead,
  type ActForOwnerInput, type ActForOwnerReply, type ApproveVenueReply, type SetPlanReply, type Validation,
} from '../src/index.ts';

const V = '00000000-0000-4000-8000-0000000000c1';
const D = '00000000-0000-4000-8000-00000000d001';
const errs = (r: Validation<unknown>) => (r.ok ? [] : r.errors.map((e) => `${e.code}@${e.path}`).sort());
const reason = 'Owner asked on WhatsApp';
const AT = '2026-10-16T09:00:00Z';

test('act for owner: one valid input per action, typed by the action', () => {
  const inputs: ActForOwnerInput[] = [
    { venueId: V, reason, action: 'availability.set', payload: { targetKind: 'dish', targetId: D, until: { kind: 'duration', minutes: 120 }, note: 'grill down' } },
    { venueId: V, reason, action: 'availability.restore', payload: { targetKind: 'section', targetId: D } },
    { venueId: V, reason, action: 'dish.update', payload: { dishId: D, patch: { price: 6800, name_en: 'Schnitzel', tags: ['spicy'], hidden: false, stock_id: null }, expectedUpdatedAt: AT } },
    { venueId: V, reason, action: 'menu.publish', payload: {} },
    { venueId: V, reason, action: 'onboarding.set', payload: { step: 'photos', state: 'done', blockers: [], expectedUpdatedAt: null } },
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
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'dish.update', payload: { dishId: D, patch: {}, expectedUpdatedAt: AT } })), ['nothing_to_change@payload.patch']);
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'dish.update',
    payload: { dishId: D, patch: { price: -5, tags: ['halal'], slug: 'x', name_en: 'x'.repeat(91), position: 1.5, stock_id: 'Bad' }, expectedUpdatedAt: AT } })),
  ['enum_invalid@payload.patch.tags', 'field_not_allowed@payload.patch.slug', 'price_invalid@payload.patch.price', 'stock_invalid@payload.patch.stock_id',
    'text_too_long@payload.patch.name_en', 'type@payload.patch.position']);
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'onboarding.set', payload: { step: 'publish', state: 'done', expectedUpdatedAt: null } })), ['step_automatic@payload.state']);
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'support_case.update', payload: { caseId: D, status: 'closed' } })), ['enum_invalid@payload.status']);
  assert.ok(DISH_PATCH_COLUMNS.includes('price') && !(DISH_PATCH_COLUMNS as readonly string[]).includes('section_id'));
});

test('act for owner (round 3): what staff read is what they change, or the answer is stale; a dish keeps a name', () => {
  // the version is required where the owner may be editing the same row
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'dish.update', payload: { dishId: D, patch: { price: 6800 } } })), ['time_invalid@payload.expectedUpdatedAt']);
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'onboarding.set', payload: { step: 'photos', state: 'done' } })), ['time_invalid@payload.expectedUpdatedAt']);
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'onboarding.set', payload: { step: 'photos', state: 'done', expectedUpdatedAt: 'yesterday' } })), ['time_invalid@payload.expectedUpdatedAt']);
  // QA L12: a patch may not blank both names (the database's check refuses it)
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'dish.update', payload: { dishId: D, patch: { name_he: ' ', name_en: '' }, expectedUpdatedAt: AT } })), ['name_missing@payload.patch']);
  assert.deepEqual(errs(validateActForOwner({ venueId: V, reason, action: 'dish.update', payload: { dishId: D, patch: { name_he: '', name_en: 'Fries' }, expectedUpdatedAt: AT } })), []);
  // the stale answer, typed by action
  const say = (r: ActForOwnerReply): string => {
    if (r.ok) return `done ${r.action}`;
    if (r.code === 'stale') return r.action === 'dish.update' ? `dish now ${r.current.price}` : `step now ${r.current.state}`;
    return r.code;
  };
  assert.equal(say({ ok: false, code: 'stale', action: 'onboarding.set', current: { step: 'photos', state: 'skipped', blockers: [], updatedAt: AT } }), 'step now skipped');
  // @ts-expect-error a stale answer carries what is stored now
  const bad: ActForOwnerReply = { ok: false, code: 'stale', action: 'dish.update' };
  assert.ok(bad);
});

test('approval and plans', () => {
  assert.deepEqual(errs(validateApproveVenue({ venueId: V, reason: 'First menu checked', expectedRevision: 2 })), []);
  assert.deepEqual(errs(validateApproveVenue({ venueId: V, expectedRevision: 0 })), ['reason_required@reason', 'revision_invalid@expectedRevision']);
  assert.deepEqual(errs(validateApproveVenue({ venueId: V, reason: 'First menu checked' })), ['revision_invalid@expectedRevision'], 'the revision staff reviewed');
  const changed: ApproveVenueReply = { ok: false, code: 'revision_changed', revision: 3 };
  assert.equal(changed.ok === false && changed.code === 'revision_changed' && changed.revision, 3);
  const first: SetPlanReply = { ok: false, code: 'approval_first' };
  assert.ok(!first.ok);
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
