// The v2 data layer (src/v2/api.ts) against the typed fake: ADR-008's argument names, the contracts' validators run
// before any call, the database's errors and refusals mapped to what the page shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '@mana/contracts/fixtures';
import { failOf, opsApi, validateAct, type ActInput, type Backend } from '../../src/v2/api.ts';
import { HOSTILE, USERS, VENUE, addTraffic, fakeBackend, world } from './fake.ts';

const NOW = Date.parse('2026-10-16T09:30:00Z');
const at = () => NOW;
const setup = (user: string | null = USERS.support) => { const w = world({ now: at }); return { w, api: opsApi(fakeBackend(w, user)) }; };
const last = (w: ReturnType<typeof world>) => w.calls[w.calls.length - 1];

test('staffRole: the caller\'s own staff row, null for anyone else', async () => {
  const { api } = setup();
  assert.deepEqual(await api.staffRole(USERS.admin), { ok: true, data: 'admin' });
  assert.deepEqual(await api.staffRole(USERS.support), { ok: true, data: 'support' });
  assert.deepEqual(await api.staffRole(USERS.owner), { ok: true, data: null });
});

test('venues: the filters go as p_filters after the contract validator; a bad filter never leaves the page', async () => {
  const { w, api } = setup();
  const r = await api.venues({ q: 'demo', sort: 'name', demo: 'include', limit: 50 });
  assert.equal(r.ok, true);
  assert.deepEqual(last(w), { fn: 'ops_venues', args: { p_filters: { q: 'demo', sort: 'name', demo: 'include', limit: 50 } }, user: USERS.support });
  if (r.ok) assert.deepEqual(r.data.venues.map((v) => v.slug), ['cafe-demo']);
  const calls = w.calls.length;
  const bad = await api.venues({ q: '   ', sort: 'loudest' as never, limit: 501 });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.equal(bad.kind, 'invalid');
    assert.deepEqual(bad.errors?.map((e) => e.code).sort(), ['enum_invalid', 'limit_invalid', 'text_missing']);
  }
  assert.equal(w.calls.length, calls, 'nothing was sent');
});

test('venues: totals are real venues only, demo venues labelled in the list', async () => {
  const { api } = setup();
  const r = await api.venues();
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.data.totals.venues, 2);
  assert.equal(r.data.totals.demoVenues, 1);
  assert.deepEqual(r.data.venues.map((v) => [v.slug, v.isDemo]), [['cafe-demo', true], ['pita-lab', false], ['bistro-sim', false]]);
});

test('venue, analytics and public_menu: the argument names of ADR-008', async () => {
  const { w, api } = setup();
  assert.ok((await api.venue(VENUE.demo)).ok);
  assert.deepEqual(last(w)?.args, { p_venue: VENUE.demo });
  const q = { resolution: 'day', from: '2026-10-10', to: '2026-10-16', demo: 'include', venueId: null } as const;
  assert.ok((await api.analytics(q)).ok);
  assert.deepEqual(last(w)?.args, { p_query: q });
  assert.ok((await api.publicMenu('cafe-demo')).ok);
  assert.deepEqual(last(w)?.args, { p_slug: 'cafe-demo' });
  const n = w.calls.length;
  const bad = await api.analytics({ resolution: 'minute', from: '2026-10-16T09:00:30Z', to: '2026-10-17T10:00:00Z' });
  assert.ok(!bad.ok && bad.kind === 'invalid' && bad.errors?.some((e) => e.code === 'time_invalid'));
  assert.ok(!(await api.venue('not-a-uuid')).ok);
  assert.equal(w.calls.length, n);
});

test('not staff: a 42501 from any staff RPC is "not_staff", and the admin-only ones are "not_admin"', async () => {
  const owner = setup(USERS.owner);
  const r = await owner.api.venues();
  assert.ok(!r.ok && r.kind === 'not_staff');
  const support = setup(USERS.support);
  const demo = await support.api.setDemo({ venueId: VENUE.demo, demo: false, reason: 'Real venue after all' });
  assert.ok(!demo.ok && demo.kind === 'not_admin');
  const admin = setup(USERS.admin);
  assert.deepEqual(await admin.api.setDemo({ venueId: VENUE.demo, demo: false, reason: 'Real venue after all' }), { ok: true, data: { ok: true, demo: false } });
  assert.deepEqual(last(admin.w)?.args, { p_venue: VENUE.demo, p_demo: false, p_reason: 'Real venue after all' });
});

test('approve: a reason is required before the call; the reply is the database\'s', async () => {
  const { w, api } = setup();
  const n = w.calls.length;
  const short = await api.approve({ venueId: VENUE.demo, reason: '  ok ' });
  assert.ok(!short.ok && short.kind === 'invalid' && short.code === 'reason_required');
  assert.equal(w.calls.length, n);
  const r = await api.approve({ venueId: VENUE.demo, reason: '  Menu checked with the owner  ' });
  assert.ok(r.ok && typeof r.data.trialEndsAt === 'string');
  assert.deepEqual(last(w)?.args, { p_venue: VENUE.demo, p_reason: 'Menu checked with the owner' }, 'the reason is sent stripped');
  const again = await api.approve({ venueId: VENUE.demo, reason: 'Menu checked with the owner' });
  assert.ok(!again.ok && again.kind === 'refused' && again.code === 'already_approved' && /already approved/.test(again.message));
});

test('act for owner: each action\'s payload is checked first; the owner\'s switch is refused plainly', async () => {
  const { w, api } = setup();
  const restore: ActInput = { venueId: VENUE.demo, reason: 'Owner asked by phone', action: 'availability.restore', payload: { targetKind: 'dish', targetId: ID.espresso } };
  const r = await api.actForOwner(restore);
  assert.ok(r.ok && r.data.action === 'availability.restore' && typeof r.data.logId === 'number');
  assert.deepEqual(last(w)?.args, { p_venue: VENUE.demo, p_reason: 'Owner asked by phone', p_action: 'availability.restore', p_payload: { targetKind: 'dish', targetId: ID.espresso } });
  const declined = await api.actForOwner({ ...restore, venueId: VENUE.pita });
  assert.ok(!declined.ok && declined.kind === 'refused' && declined.code === 'owner_declined');
  if (!declined.ok) assert.match(declined.message, /support switch is off\)\. Nothing was changed/);

  const codes = (i: ActInput) => validateAct(i).map((e) => e.code).sort();
  assert.deepEqual(codes({ ...restore, reason: 'x' }), ['reason_required']);
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'availability.set', payload: { targetKind: 'table' as never, targetId: 'x', until: { kind: 'forever' } as never } }),
    ['enum_invalid', 'id_invalid', 'until_invalid']);
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'dish.update', payload: { dishId: ID.burger, patch: { price: -1, slug: 'x' } as never } }),
    ['field_not_allowed', 'price_invalid']);
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'dish.update', payload: { dishId: ID.burger, patch: {} } }), ['nothing_to_change']);
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'onboarding.set', payload: { step: 'publish', state: 'done' } }), ['step_automatic'],
    'the contract\'s own validator: the database marks publish done');
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'onboarding.set', payload: { step: 'photos', state: 'skipped' } }), []);
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'support_case.update', payload: { caseId: 'x', status: 'closed' as never } }),
    ['enum_invalid', 'id_invalid']);
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'menu.delete' as never, payload: {} as never }), ['action_unknown']);
});

test('act for owner: the result is in the venue\'s timeline at once, marked Halom, with the reason', async () => {
  const { api } = setup();
  await api.actForOwner({ venueId: VENUE.demo, reason: 'Owner asked by phone', action: 'availability.restore', payload: { targetKind: 'dish', targetId: ID.espresso } });
  const d = await api.venue(VENUE.demo);
  assert.ok(d.ok);
  if (!d.ok) return;
  const [own, restored] = d.data.activity;
  assert.deepEqual([own?.action, own?.actorKind, own?.via, own?.reason], ['support.act_for_owner', 'staff', 'act_for_owner', 'Owner asked by phone']);
  assert.deepEqual([restored?.action, restored?.via, restored?.reason], ['availability_overrides.update', 'act_for_owner', 'Owner asked by phone']);
});

test('cases: ops_update_case gets null for what does not change, and needs a reason', async () => {
  const { w, api } = setup();
  const caseId = (await api.venue(VENUE.demo)).ok ? w.venues[0]!.cases[0]!.id : '';
  const r = await api.updateCase({ caseId, status: 'waiting_owner', reason: 'Asked the owner for the photos' });
  assert.ok(r.ok && r.data.case.status === 'waiting_owner');
  assert.deepEqual(last(w)?.args, { p_case: caseId, p_status: 'waiting_owner', p_topic: null, p_reason: 'Asked the owner for the photos' });
  const nothing = await api.updateCase({ caseId, reason: 'Nothing at all' });
  assert.ok(!nothing.ok && nothing.errors?.some((e) => e.code === 'nothing_to_change'));
});

test('plan: admins only, a reason, a known state', async () => {
  const admin = setup(USERS.admin);
  const r = await admin.api.setPlan({ venueId: VENUE.bistro, state: 'active', until: '2026-12-31T21:59:59.000Z', plan: 'paid', reason: 'Signed the paid plan' });
  assert.deepEqual(r, { ok: true, data: { ok: true, state: 'active' } });
  assert.deepEqual(last(admin.w)?.args, { p_venue: VENUE.bistro, p_state: 'active', p_until: '2026-12-31T21:59:59.000Z', p_reason: 'Signed the paid plan', p_plan: 'paid' });
  const bad = await admin.api.setPlan({ venueId: VENUE.bistro, state: 'gold' as never, until: 'soon', plan: null, reason: '' });
  assert.deepEqual(!bad.ok && bad.errors?.map((e) => e.code).sort(), ['reason_required', 'state_invalid', 'time_invalid']);
  const support = await setup(USERS.support).api.setPlan({ venueId: VENUE.bistro, state: 'active', until: null, plan: null, reason: 'Signed the paid plan' });
  assert.ok(!support.ok && support.kind === 'not_admin');
});

test('leads: read (logged by the database), update only what changes', async () => {
  const { w, api } = setup();
  const r = await api.leads();
  assert.ok(r.ok && r.data.leads.length === 2);
  assert.deepEqual(last(w)?.args, { p_status: null, p_source: null, p_since: null, p_limit: 300 });
  const id = r.ok ? r.data.leads[0]!.id : '';
  assert.deepEqual(await api.updateLead({ id, status: 'contacted' }), { ok: true, data: { ok: true } });
  assert.deepEqual(last(w)?.args, { p_id: id, p_status: 'contacted', p_owner: null, p_notes: null });
  assert.ok(!(await api.updateLead({ id })).ok, 'nothing to change is not sent');
  assert.ok(!(await api.leads({ status: 'archived' as never })).ok);
});

test('errors: what each failure of the transport or the database means', () => {
  assert.equal(failOf({ code: '42501', message: 'not_staff' }).kind, 'not_staff');
  assert.equal(failOf({ code: '42501', message: 'not_admin' }).kind, 'not_admin');
  assert.equal(failOf({ code: 'PGRST301', message: 'JWT expired' }).kind, 'signed_out');
  assert.equal(failOf({ status: 401, message: 'whatever' }).kind, 'signed_out');
  assert.equal(failOf({ code: 'PGRST202', message: 'Could not find the function public.ops_venues' }).kind, 'missing');
  assert.deepEqual([failOf({ code: '22023', message: 'range_out_of_retention' }).kind, failOf({ code: '22023', message: 'range_out_of_retention' }).code], ['invalid', 'range_out_of_retention']);
  assert.equal(failOf({ name: 'TimeoutError', message: 'signal is aborted' }).kind, 'timeout');
  assert.equal(failOf({ message: 'TypeError: Failed to fetch' }).kind, 'network');
  assert.equal(failOf({ code: 'XX000', message: 'boom' }).kind, 'server');
});

test('faults: a missing function, an empty answer, a thrown transport: a Fail, never a throw', async () => {
  const { w, api } = setup();
  w.faults.ops_venues = { mode: 'missing' };
  const missing = await api.venues();
  assert.ok(!missing.ok && missing.kind === 'missing');
  w.faults.ops_venue = { mode: 'garbage' };
  const empty = await api.venue(VENUE.demo);
  assert.ok(!empty.ok && empty.kind === 'server' && /does not understand/.test(empty.message));
  const throwing: Backend = { rpc: () => Promise.reject(new TypeError('Failed to fetch')), staffRow: () => Promise.reject(new Error('timeout')) };
  const t = opsApi(throwing);
  const r = await t.venues();
  assert.ok(!r.ok && r.kind === 'network');
  const s = await t.staffRole(USERS.admin);
  assert.ok(!s.ok && s.kind === 'timeout');
});

test('the fake\'s traffic: demo traffic counts on the demo venue\'s row, and analytics leave it out unless asked', async () => {
  const { w, api } = setup();
  addTraffic(w, VENUE.demo, { menu_opened: 5 });
  const list = await api.venues();
  assert.ok(list.ok);
  if (!list.ok) return;
  const demo = list.data.venues.find((v) => v.id === VENUE.demo)!;
  assert.ok(demo.opens.lastHour >= 5);
  assert.equal(list.data.totals.opensToday, list.data.venues.filter((v) => !v.isDemo).reduce((s, v) => s + v.opens.today, 0), 'real venues only');
  const q = { resolution: 'minute', from: new Date(NOW - 3600_000 - (NOW % 60_000)).toISOString(), to: new Date(NOW - (NOW % 60_000) + 60_000).toISOString(), venueId: VENUE.demo } as const;
  const exclude = await api.analytics(q);
  const include = await api.analytics({ ...q, demo: 'include' });
  assert.ok(exclude.ok && include.ok);
  if (exclude.ok && include.ok) {
    assert.equal(exclude.data.totals.menu_opened, 0);
    assert.ok((include.data.totals.menu_opened ?? 0) >= 5);
    assert.equal(include.data.buckets.length, 61);
  }
});

test('hostile text arrives as data, unchanged (the page renders it as text)', async () => {
  const { api } = setup();
  const r = await api.venues({ q: 'pita' });
  assert.ok(r.ok && r.data.venues[0]?.name.en.includes(HOSTILE));
});
