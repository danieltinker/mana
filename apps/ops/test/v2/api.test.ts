// The v2 data layer (src/v2/api.ts) against the typed fake: ADR-008's argument names, the contracts' validators run
// before any call, the database's errors and refusals mapped to what the page shows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID } from '@mana/contracts/fixtures';
import { validateActForOwner, type ActForOwnerInput } from '@mana/contracts';
import { failOf, opsApi, type Backend } from '../../src/v2/api.ts';
import { HOSTILE, USERS, VENUE, addTraffic, fakeBackend, ownerEdit, padLog, publish, restore, world } from './fake.ts';

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

test('approve: a reason and the reviewed revision are required before the call; the reply is the database\'s', async () => {
  const { w, api } = setup();
  const n = w.calls.length;
  const short = await api.approve({ venueId: VENUE.demo, reason: '  ok ', expectedRevision: 2 });
  assert.ok(!short.ok && short.kind === 'invalid' && short.code === 'reason_required');
  const noRev = await api.approve({ venueId: VENUE.demo, reason: 'Menu checked with the owner', expectedRevision: 0 });
  assert.ok(!noRev.ok && noRev.kind === 'invalid' && noRev.errors?.some((e) => e.code === 'revision_invalid' && e.path === 'expectedRevision'));
  assert.equal(w.calls.length, n);
  const r = await api.approve({ venueId: VENUE.demo, reason: '  Menu checked with the owner  ', expectedRevision: 2 });
  assert.ok(r.ok && typeof r.data.trialEndsAt === 'string');
  assert.deepEqual(last(w)?.args, { p_venue: VENUE.demo, p_reason: 'Menu checked with the owner', p_expected_revision: 2 }, 'the reason is sent stripped');
  const again = await api.approve({ venueId: VENUE.demo, reason: 'Menu checked with the owner', expectedRevision: 2 });
  assert.ok(!again.ok && again.kind === 'refused' && again.code === 'already_approved' && /already approved/.test(again.message));
});

test('approve (H2): the database approves only the revision reviewed; a newer publish is refused, nothing approved', async () => {
  const { w, api } = setup();
  publish(w, VENUE.demo);                                       // the owner publishes revision 3 after Halom read revision 2
  const r = await api.approve({ venueId: VENUE.demo, reason: 'Menu checked with the owner', expectedRevision: 2 });
  assert.ok(!r.ok && r.kind === 'refused' && r.code === 'revision_changed');
  if (!r.ok) {
    assert.match(r.message, /published revision changed since your review\. Nothing was approved/);
    assert.equal(r.reply?.revision, 3, 'the reply names the published one');
  }
  const d = await api.venue(VENUE.demo);
  assert.ok(d.ok && d.data.venue.review === 'pending' && d.data.venue.menu.revision === 3);
  assert.ok((await api.approve({ venueId: VENUE.demo, reason: 'Menu checked with the owner', expectedRevision: 3 })).ok);
});

test('approve: the revision named is the published one (what guests will see), not the newest after a restore', async () => {
  const { w, api } = setup();
  publish(w, VENUE.demo);                                       // revision 3 ...
  restore(w, VENUE.demo, 2);                                    // ... then the owner goes back to revision 2
  const d = await api.venue(VENUE.demo);
  assert.ok(d.ok && d.data.venue.menu.revision === 2, 'published: 2');
  const newest = await api.revision({ venueId: VENUE.demo });
  assert.ok(newest.ok && newest.data.latest === 3 && newest.data.revision.number === 3 && !newest.data.revision.live, 'the newest stored is 3, not published');
  const wrong = await api.approve({ venueId: VENUE.demo, reason: 'Menu checked with the owner', expectedRevision: 3 });
  assert.ok(!wrong.ok && wrong.code === 'revision_changed' && wrong.reply?.revision === 2);
  assert.ok((await api.approve({ venueId: VENUE.demo, reason: 'Menu checked with the owner', expectedRevision: 2 })).ok);
});

test('plan (M1): a plan never lets guests in before the first publish is approved', async () => {
  const admin = setup(USERS.admin);
  const r = await admin.api.setPlan({ venueId: VENUE.demo, state: 'trialing', until: null, plan: 'pilot', reason: 'Starting the pilot' });
  assert.ok(!r.ok && r.kind === 'refused' && r.code === 'approval_first');
  if (!r.ok) assert.match(r.message, /approve its first publish first/);
  const d = await admin.api.venue(VENUE.demo);
  assert.ok(d.ok && d.data.venue.plan.state === 'pending' && d.data.venue.review === 'pending', 'nothing changed');
  assert.ok((await admin.api.setPlan({ venueId: VENUE.demo, state: 'suspended', until: null, plan: null, reason: 'Paused on the owner’s request' })).ok);
});

test('dish (M4): the dish as the owner has it now, read before the change; staff only (RLS)', async () => {
  const { w, api } = setup();
  const r = await api.dish(ID.burger);
  assert.ok(r.ok && r.data !== null);
  if (r.ok && r.data) assert.deepEqual([r.data.price, r.data.hidden, r.data.updated_at], [7200, false, new Date(NOW - 40 * 60_000).toISOString()], 'not the published ₪68');
  assert.deepEqual(last(w), { fn: 'dishes', args: { dishId: ID.burger }, user: USERS.support });
  assert.deepEqual(await api.dish('00000000-0000-4000-8000-00000000ffff'), { ok: true, data: null });
  const n = w.calls.length;
  assert.ok(!(await api.dish('not-a-uuid')).ok);
  assert.equal(w.calls.length, n, 'refused before the read');
  assert.deepEqual(await setup(USERS.owner).api.dish(ID.burger), { ok: true, data: null }, 'RLS shows a stranger nothing');
});

test('act for owner (M4): a dish change carries the updated_at it was reviewed with; a change since is refused with the current values', async () => {
  const { w, api } = setup();
  const seen = new Date(NOW - 40 * 60_000).toISOString();
  const input = { venueId: VENUE.demo, reason: 'Owner asked by phone', action: 'dish.update', payload: { dishId: ID.burger, patch: { price: 7000 }, expectedUpdatedAt: seen } } as const;
  const n = w.calls.length;
  const bad = await api.actForOwner({ ...input, payload: { ...input.payload, expectedUpdatedAt: 'yesterday' } });
  assert.ok(!bad.ok && bad.kind === 'invalid' && bad.errors?.some((e) => e.code === 'time_invalid' && e.path === 'payload.expectedUpdatedAt'));
  assert.equal(w.calls.length, n, 'refused before the call');
  ownerEdit(w, ID.burger, { price: 7400 });                  // the owner changes it after the review
  const stale = await api.actForOwner(input);
  assert.ok(!stale.ok && stale.kind === 'refused' && stale.code === 'stale');
  if (!stale.ok) {
    assert.match(stale.message, /changed this since your review\. Nothing was changed/);
    assert.equal(stale.reply?.action, 'dish.update');
    assert.deepEqual((stale.reply?.current as { price: number }).price, 7400, 'the refusal carries the values now');
  }
  assert.deepEqual(last(w)?.args, { p_venue: VENUE.demo, p_reason: 'Owner asked by phone', p_action: 'dish.update', p_payload: { dishId: ID.burger, patch: { price: 7000 }, expectedUpdatedAt: seen } });
  const now = await api.dish(ID.burger);
  assert.ok(now.ok && now.data);
  if (!now.ok || !now.data) return;
  const ok = await api.actForOwner({ ...input, payload: { ...input.payload, expectedUpdatedAt: now.data.updated_at } });
  assert.ok(ok.ok);
  const after = await api.dish(ID.burger);
  assert.ok(after.ok && after.data?.price === 7000);
  const menu = await api.publicMenu('cafe-demo');
  assert.ok(menu.ok && menu.data.state === 'unavailable', 'guests still see nothing before approval: the change is in the owner’s menu');
});

test('dashboard and export (M5): what the owner sees; the export is logged as menu.export, the dashboard is not', async () => {
  const { w, api } = setup();
  const d = await api.dashboard({ venueId: VENUE.demo });
  assert.ok(d.ok);
  if (!d.ok) return;
  assert.deepEqual(last(w)?.args, { p_venue: VENUE.demo, p_range: 'today' });
  assert.deepEqual(d.data.nudges.map((x) => x.code), ['approval_pending', 'onboarding_step']);
  assert.deepEqual(d.data.offNow.map((o) => [o.kind, o.id, o.name.en]), [['dish', ID.espresso, 'Espresso']]);
  assert.equal(d.data.demo, true);
  const reads = (await api.venue(VENUE.demo)).ok ? w.venues[0]!.activity.filter((e) => e.action === 'menu.export').length : -1;
  assert.equal(reads, 0, 'reading the dashboard logs nothing');
  const e = await api.exportMenu(VENUE.demo);
  assert.ok(e.ok && e.data.kind === 'mana.menu_export');
  if (e.ok) assert.equal(e.data.tables.dishes.find((x) => x.id === ID.burger)?.price, 7200, 'the owner’s menu as it is now');
  assert.deepEqual(last(w)?.args, { p_venue: VENUE.demo });
  assert.equal(w.venues[0]!.activity[0]!.action, 'menu.export');
  const n = w.calls.length;
  assert.ok(!(await api.exportMenu('x')).ok);
  assert.ok(!(await api.dashboard({ venueId: VENUE.demo, range: 'year' as never })).ok);
  assert.equal(w.calls.length, n);
});

test('activity (M3): venue_activity pages past the newest 100, by p_before, with ADR-008\'s names', async () => {
  const { w, api } = setup();
  padLog(w, VENUE.bistro, 130);
  const first = await api.venue(VENUE.bistro);
  assert.ok(first.ok && first.data.activity.length === 100);
  if (!first.ok) return;
  const oldest = first.data.activity.at(-1)!.id;
  const page = await api.activity({ venueId: VENUE.bistro, before: oldest, limit: 100 });
  assert.ok(page.ok);
  if (!page.ok) return;
  assert.deepEqual(last(w)?.args, { p_venue: VENUE.bistro, p_before: oldest, p_limit: 100, p_actor: null, p_via: null });
  assert.equal(page.data.entries.length, 33, '130 + the 3 it had, past the first 100');
  assert.equal(page.data.next, null);
  assert.ok(page.data.entries.every((e) => e.id < oldest));
  assert.equal(page.data.entries.at(-1)?.action, 'venue.create');
  const n = w.calls.length;
  assert.ok(!(await api.activity({ venueId: VENUE.bistro, limit: 101 })).ok);
  assert.equal(w.calls.length, n);
});

test('act for owner: each action\'s payload is checked first; the owner\'s switch is refused plainly', async () => {
  const { w, api } = setup();
  const restore: ActForOwnerInput = { venueId: VENUE.demo, reason: 'Owner asked by phone', action: 'availability.restore', payload: { targetKind: 'dish', targetId: ID.espresso } };
  const r = await api.actForOwner(restore);
  assert.ok(r.ok && r.data.action === 'availability.restore' && typeof r.data.logId === 'number');
  assert.deepEqual(last(w)?.args, { p_venue: VENUE.demo, p_reason: 'Owner asked by phone', p_action: 'availability.restore', p_payload: { targetKind: 'dish', targetId: ID.espresso } });
  const declined = await api.actForOwner({ ...restore, venueId: VENUE.pita });
  assert.ok(!declined.ok && declined.kind === 'refused' && declined.code === 'owner_declined');
  if (!declined.ok) assert.match(declined.message, /support switch is off\)\. Nothing was changed/);

  // the contract's validator runs before the call (the database's SQL twin answers the same codes)
  const codes = (i: ActForOwnerInput) => { const v = validateActForOwner(i); return v.ok ? [] : v.errors.map((e) => e.code).sort(); };
  assert.deepEqual(codes({ ...restore, reason: 'x' }), ['reason_required']);
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'availability.set', payload: { targetKind: 'table' as never, targetId: 'x', until: { kind: 'forever' } as never } }),
    ['enum_invalid', 'id_invalid', 'until_invalid']);
  const at = '2026-10-16T09:00:00.123456+00:00';
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'dish.update', payload: { dishId: ID.burger, patch: { price: -1, slug: 'x' } as never, expectedUpdatedAt: at } }),
    ['field_not_allowed', 'price_invalid']);
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'dish.update', payload: { dishId: ID.burger, patch: {}, expectedUpdatedAt: at } }), ['nothing_to_change']);
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'dish.update', payload: { dishId: ID.burger, patch: { price: 100 } } as never }), ['time_invalid'],
    'a dish change names the updated_at it was reviewed with');
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'onboarding.set', payload: { step: 'publish', state: 'done', expectedUpdatedAt: null } }), ['step_automatic'],
    'the contract\'s own validator: the database marks publish done');
  assert.deepEqual(codes({ venueId: VENUE.demo, reason: 'fine reason', action: 'onboarding.set', payload: { step: 'photos', state: 'skipped', expectedUpdatedAt: at } }), []);
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

test('revision: ops_revision with ADR-008\'s names; the newest unless a number is asked; each read is in the timeline', async () => {
  const { w, api } = setup();
  const newest = await api.revision({ venueId: VENUE.demo });
  assert.ok(newest.ok);
  assert.deepEqual(last(w)?.args, { p_venue: VENUE.demo, p_revision: null });
  if (newest.ok) assert.deepEqual([newest.data.revision.number, newest.data.latest, newest.data.revision.live, newest.data.review], [2, 2, true, 'pending']);
  const first = await api.revision({ venueId: VENUE.demo, revision: 1 });
  assert.ok(first.ok && first.data.revision.number === 1 && first.data.revision.live === false);
  const none = await api.revision({ venueId: VENUE.demo, revision: 9 });
  assert.ok(!none.ok && none.kind === 'refused' && none.code === 'revision_unknown');
  const n = w.calls.length;
  const bad = await api.revision({ venueId: VENUE.demo, revision: 0 });
  assert.ok(!bad.ok && bad.kind === 'invalid' && bad.code === 'revision_invalid');
  assert.equal(w.calls.length, n, 'refused before the call');
  const d = await api.venue(VENUE.demo);
  assert.ok(d.ok && d.data.activity.filter((e) => e.action === 'menu.read').length === 2);
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
  const throwing: Backend = { rpc: () => Promise.reject(new TypeError('Failed to fetch')), staffRow: () => Promise.reject(new Error('timeout')),
    dishRow: () => Promise.reject(new TypeError('Failed to fetch')) };
  const t = opsApi(throwing);
  const r = await t.venues();
  assert.ok(!r.ok && r.kind === 'network');
  const s = await t.staffRole(USERS.admin);
  assert.ok(!s.ok && s.kind === 'timeout');
  const dish = await t.dish(ID.burger);
  assert.ok(!dish.ok && dish.kind === 'network');
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
