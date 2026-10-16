// The phase-1 back office (ADR-008, F09): the clients list, one venue's detail, the stored menu Halom approves,
// analytics across venues or for one, and the demo switch. Staff only; every number against the tables it counts.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { as, rpc } from './harness/cluster.mjs';
import { A, ID, U, world } from './harness/world.mjs';
import { isActivityAction, OPS_WARNINGS } from '../../packages/contracts/src/index.ts';

let w;
before(async () => { w = await world(); });
after(async () => { await w?.stop(); });

const ROLES = { anon: 'anon', stranger: U.stranger, ownerA: U.ownerA, managerA: U.managerA, counterA: U.counterA, ownerB: U.ownerB, support: U.support, admin: U.admin };
async function whoMay(fn, args, roles = ROLES) {
  const out = {};
  for (const [name, who] of Object.entries(roles)) {
    const r = await rpc(w.url, who, fn, args);
    out[name] = r?.error ? r.error.code : r?.ok === false ? r.code : 'ok';
  }
  return out;
}
const STAFF_ONLY = { anon: '42501', stranger: '42501', ownerA: '42501', managerA: '42501', counterA: '42501', ownerB: '42501', support: 'ok', admin: 'ok' };
const lastLog = async (venue, action) => (await w.admin.query(
  `select actor_kind, via, reason, n, detail, target_table, target_ids from public.activity_log where venue_id = $1 and action = $2 order by id desc limit 1`, [venue, action])).rows[0];
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const track = (batch) => as(w.url, 'anon', async (c) => {
  await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify({ 'x-forwarded-for': '203.0.113.9' })]);
  return (await c.query('select public.track_events($1::jsonb) as r', [JSON.stringify(batch)])).rows[0].r;
});
const opens = (venueId, n) => Array.from({ length: n }, () => ({ id: randomUUID(), name: 'menu_opened', venueId, at: iso(Date.now() - 2000), props: { src: 'qr', lang: 'he', revision: 1 } }));
const rollup = () => w.admin.query('select app.build_rollups()');
const newVenue = async (owner, slug, { dish = true } = {}) => {
  await w.admin.query(`insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values ($1, $2, now(), now()) on conflict do nothing`, [owner, `${slug}@example.invalid`]);
  const made = await rpc(w.url, owner, 'create_venue', { p_slug: slug, p_name_en: `Venue ${slug}` });
  assert.equal(made.ok, true, JSON.stringify(made));
  if (dish) await as(w.url, owner, async (c) => {
    const s = (await c.query(`insert into public.sections (venue_id, name_en) values ($1, 'Food') returning id`, [made.id])).rows[0].id;
    await c.query(`insert into public.dishes (venue_id, section_id, name_en, price) values ($1, $2, 'Soup', 3000)`, [made.id, s]);
  });
  return made.id;
};

describe('ops_venues: the clients list', () => {
  test('staff only', async () => {
    assert.deepEqual(await whoMay('ops_venues', { p_filters: { limit: 1 } }), STAFF_ONLY);
  });

  test('every venue by default, demo ones labelled; the demo scope; totals of real venues whatever the filters', async () => {
    const all = await rpc(w.url, U.support, 'ops_venues', {});
    const live = (await w.admin.query(`select id, is_demo from public.venues where archived_at is null order by created_at desc, id`)).rows;
    assert.deepEqual(all.venues.map((v) => v.id), live.map((v) => v.id), 'newest first');
    assert.equal(all.total, live.length);
    assert.equal(all.venues.find((v) => v.id === A).isDemo, true);
    const real = await rpc(w.url, U.support, 'ops_venues', { p_filters: { demo: 'exclude' } });
    const demo = await rpc(w.url, U.support, 'ops_venues', { p_filters: { demo: 'only' } });
    assert.ok(real.venues.every((v) => !v.isDemo) && demo.venues.every((v) => v.isDemo));
    assert.equal(real.total + demo.total, all.total);
    assert.deepEqual(real.totals, all.totals);
    assert.equal(all.totals.venues, live.filter((v) => !v.is_demo).length);
    assert.equal(all.totals.demoVenues, live.filter((v) => v.is_demo).length);
    for (const k of ['generatedAt', 'rolledUpAt', 'totals', 'total', 'venues']) assert.ok(k in all, k);
  });

  test('search by a part of either name or of the slug, any case; the other filters; sorting; paging', async () => {
    const find = async (f) => (await rpc(w.url, U.admin, 'ops_venues', { p_filters: f })).venues.map((v) => v.id);
    assert.deepEqual(await find({ q: ' BISTRO ' }), [w.B]);
    assert.deepEqual(await find({ q: 'ביסטרו' }), [w.B]);
    assert.deepEqual(await find({ q: 'cafe-dem' }), [A]);
    assert.deepEqual(await find({ q: 'nothing like it' }), []);
    const c = await rpc(w.url, U.ownerB, 'open_case', { p_venue: w.B, p_topic: 'menu', p_subject: 'A question' });
    assert.ok((await find({ warning: 'case_open' })).includes(w.B));
    assert.ok(!(await find({ warning: 'awaiting_review' })).includes(w.B));
    assert.ok((await find({ review: 'approved' })).includes(w.B));
    const rows = (await rpc(w.url, U.admin, 'ops_venues', {})).venues;
    for (const stage of [...new Set(rows.map((r) => r.onboarding.stage))]) {
      assert.deepEqual(await find({ stage }), rows.filter((r) => r.onboarding.stage === stage).map((r) => r.id), stage);
    }
    for (const plan of [...new Set(rows.map((r) => r.plan.plan))]) assert.deepEqual(await find({ plan }), rows.filter((r) => r.plan.plan === plan).map((r) => r.id));
    for (const planState of [...new Set(rows.map((r) => r.plan.state))]) assert.deepEqual(await find({ planState }), rows.filter((r) => r.plan.state === planState).map((r) => r.id));
    const byName = (await rpc(w.url, U.admin, 'ops_venues', { p_filters: { sort: 'name' } })).venues.map((v) => v.name.en.toLowerCase());
    assert.deepEqual(byName, [...byName].sort((a, b) => (a === '') - (b === '') || (a < b ? -1 : a > b ? 1 : 0)));
    const act = (await rpc(w.url, U.admin, 'ops_venues', { p_filters: { sort: 'activity' } })).venues.map((v) => v.lastActivityAt ?? '');
    assert.deepEqual(act, [...act].sort().reverse());
    const page = await rpc(w.url, U.admin, 'ops_venues', { p_filters: { limit: 1, offset: 1 } });
    assert.deepEqual([page.total, page.venues.map((v) => v.id)], [rows.length, [rows[1].id]]);
    await rpc(w.url, U.support, 'ops_update_case', { p_case: c.caseId, p_status: 'resolved', p_reason: 'Answered by phone' });
    assert.ok(!(await find({ warning: 'case_open' })).includes(w.B));
  });

  test('a bad filter answers 22023 with the validator\'s first code', async () => {
    const code = async (f) => { const r = await rpc(w.url, U.support, 'ops_venues', { p_filters: f }); return [r.error?.code, r.error?.message]; };
    assert.deepEqual(await code({ sort: 'size' }), ['22023', 'enum_invalid']);
    assert.deepEqual(await code({ limit: 0 }), ['22023', 'limit_invalid']);
    assert.deepEqual(await code({ limit: 501 }), ['22023', 'limit_invalid']);
    assert.deepEqual(await code({ q: '   ' }), ['22023', 'text_missing']);
    assert.deepEqual(await code({ owner: 'x' }), ['22023', 'field_not_allowed']);
    assert.deepEqual(await code({ q: 'x'.repeat(5000) }), ['22023', 'too_large']);
    assert.deepEqual(await code([]), ['22023', 'type']);
  });

  test('a row\'s warnings are on the closed list and in its order; ops_overview builds the same rows', async () => {
    const rows = (await rpc(w.url, U.support, 'ops_venues', {})).venues;
    for (const r of rows) assert.deepEqual(r.warnings, OPS_WARNINGS.filter((x) => r.warnings.includes(x)), r.slug);
    const o = await rpc(w.url, U.support, 'ops_overview');
    const strip = (r) => ({ ...r, lastActivityAt: null });
    assert.deepEqual(o.venues.map(strip), rows.map(strip));
  });
});

describe('ops_venue: one venue', () => {
  test('staff only; an unknown venue is 22023', async () => {
    assert.deepEqual(await whoMay('ops_venue', { p_venue: w.B }), STAFF_ONLY);
    assert.equal((await rpc(w.url, U.support, 'ops_venue', { p_venue: '00000000-0000-4000-8000-00000000ffff' })).error?.code, '22023');
  });

  test('members, onboarding, imports without their input, open cases first, the timeline; staff are never "you"', async () => {
    const text = 'Lentil soup 38\nGreen salad 42\n';
    const imp = await rpc(w.url, U.ownerB, 'create_import', { p_venue: w.B, p_source: 'paste', p_text: text });
    assert.equal(imp.ok, true, JSON.stringify(imp));
    const open = await rpc(w.url, U.ownerB, 'open_case', { p_venue: w.B, p_topic: 'import', p_subject: 'Is it right?' });
    const d = await rpc(w.url, U.support, 'ops_venue', { p_venue: w.B });
    assert.deepEqual(Object.keys(d).sort(), ['activity', 'cases', 'imports', 'members', 'onboarding', 'venue']);
    assert.equal(d.venue.id, w.B);
    assert.deepEqual(d.members, { owners: 1, managers: 0, counters: 0 });
    assert.equal(d.onboarding.steps.length, 9);
    assert.deepEqual(d.imports[0], { id: imp.importId, source: 'paste', status: 'uploaded', createdAt: d.imports[0].createdAt, appliedAt: null, errorCode: null,
      rightsConfirmed: false, counts: null, exceptions: { fix: 0, check: 0, byCode: {} } });
    assert.ok(!JSON.stringify(d).includes('Lentil'), 'never the raw input');
    assert.equal(d.cases[0].id, open.caseId);
    assert.ok(d.cases.findIndex((c) => c.status === 'resolved') === -1 || d.cases.findIndex((c) => c.status === 'resolved') > d.cases.findIndex((c) => c.status !== 'resolved'));
    assert.ok(d.activity.length <= 100 && d.activity.every((e, i, a) => i === 0 || a[i - 1].id > e.id));
    assert.ok(d.activity.every((e) => e.actorKind === 'staff' || e.you === false), 'the reader is staff: an owner\'s change is never "you"');
    assert.ok(d.activity.some((e) => e.action === 'venue.approve' && e.you === true), 'the support person who approved it reads "you"');
    const counts = (await w.admin.query(`select count(*)::int as n from public.activity_log where venue_id = $1`, [w.B])).rows[0].n;
    assert.equal(d.activity.length, Math.min(100, counts));
    await rpc(w.url, U.ownerB, 'discard_import', { p_import: imp.importId });
  });
});

describe('ops_revision: the stored menu Halom approves', () => {
  test('staff only', async () => {
    assert.deepEqual(await whoMay('ops_revision', { p_venue: w.B }), STAFF_ONLY);
  });

  test('a venue waiting for approval: its stored revision, pending; the read is logged on its timeline', async () => {
    const O = '33333333-3333-4333-8333-3333333333a1';
    const v = await newVenue(O, 'waiting-one');
    assert.deepEqual(await rpc(w.url, U.support, 'ops_revision', { p_venue: v }), { ok: false, code: 'revision_unknown' }, 'nothing published yet');
    assert.equal((await rpc(w.url, O, 'publish_menu', { p_venue: v, p_note: 'please check' })).review, 'pending');
    assert.equal((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'waiting-one' })).state, 'unavailable', 'guests see nothing yet');
    const r = await rpc(w.url, U.support, 'ops_revision', { p_venue: v });
    const stored = (await w.admin.query(`select id, snapshot from public.menu_revisions where venue_id = $1 and number = 1`, [v])).rows[0];
    assert.deepEqual([r.ok, r.venueId, r.review, r.latest, r.revision.id, r.revision.number, r.revision.note, r.revision.live], [true, v, 'pending', 1, stored.id, 1, 'please check', true]);
    assert.match(r.revision.createdAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
    assert.deepEqual(r.snapshot, stored.snapshot);
    assert.equal(r.snapshot.v, 2);
    const log = await lastLog(v, 'menu.read');
    assert.deepEqual(log, { actor_kind: 'staff', via: 'rpc', reason: null, n: 1, detail: { revision: 1 }, target_table: 'menu_revisions', target_ids: [stored.id] });
    const seen = await rpc(w.url, O, 'venue_activity', { p_venue: v, p_limit: 1 });
    assert.deepEqual([seen.entries[0].action, seen.entries[0].actorKind], ['menu.read', 'staff'], 'the owner sees that Halom looked');
    assert.equal(isActivityAction('menu.read'), true, 'the contracts list menu.read (pending the architect\'s revision)');
  });

  test('the newest by default, any by number; live says which one guests see; every code', async () => {
    assert.equal((await rpc(w.url, U.ownerB, 'publish_menu', { p_venue: w.B, p_note: 'second' })).revision, 2);
    const newest = await rpc(w.url, U.admin, 'ops_revision', { p_venue: w.B });
    const first = await rpc(w.url, U.admin, 'ops_revision', { p_venue: w.B, p_revision: 1 });
    assert.deepEqual([newest.revision.number, newest.revision.live, newest.latest, newest.review], [2, true, 2, 'approved']);
    assert.deepEqual([first.revision.number, first.revision.live, first.latest, first.revision.note], [1, false, 2, 'first']);
    assert.deepEqual(await rpc(w.url, U.admin, 'ops_revision', { p_venue: w.B, p_revision: 3 }), { ok: false, code: 'revision_unknown' });
    assert.deepEqual(await rpc(w.url, U.admin, 'ops_revision', { p_venue: w.B, p_revision: 0 }), { ok: false, code: 'revision_invalid' });
    assert.deepEqual(await rpc(w.url, U.admin, 'ops_revision', { p_venue: '00000000-0000-4000-8000-00000000ffff' }), { ok: false, code: 'venue_unknown' });
    assert.equal((await rpc(w.url, U.ownerB, 'unpublish_menu', { p_venue: w.B })).ok, true);
    const off = await rpc(w.url, U.admin, 'ops_revision', { p_venue: w.B });
    assert.deepEqual([off.revision.number, off.revision.live], [2, false], 'unpublished: stored, not live');
    assert.equal((await rpc(w.url, U.ownerB, 'restore_revision', { p_venue: w.B, p_revision: 2 })).ok, true);
  });
});

describe('ops_analytics', () => {
  test('staff only; codes as 22023', async () => {
    const today = new Date().toISOString().slice(0, 10);
    assert.deepEqual(await whoMay('ops_analytics', { p_query: { resolution: 'day', from: today, to: today } }), STAFF_ONLY);
    const code = async (q) => { const r = await rpc(w.url, U.support, 'ops_analytics', { p_query: q }); return [r.error?.code, r.error?.message]; };
    assert.deepEqual(await code({ resolution: 'hour', from: today, to: today }), ['22023', 'enum_invalid']);
    assert.deepEqual(await code({ resolution: 'day', from: today, to: '2020-01-01' }), ['22023', 'range_invalid']);
    const m = Math.floor(Date.now() / 60000) * 60000;
    assert.deepEqual(await code({ resolution: 'minute', from: iso(m - 25 * 3600_000), to: iso(m) }), ['22023', 'range_too_long']);
    assert.deepEqual(await code({ resolution: 'minute', from: iso(m - 40 * 86400_000), to: iso(m - 40 * 86400_000 + 3600_000) }), ['22023', 'range_out_of_retention']);
    assert.deepEqual(await code({ resolution: 'minute', from: iso(m + 30_000), to: iso(m + 90_000) }), ['22023', 'time_invalid']);
  });

  test('real traffic by default, by each rollup\'s own label; minute and day series agree with the rollups', async () => {
    await rollup();
    const t0 = await w.admin.query(`select coalesce(sum(n), 0)::int as n, demo from public.rollups_day where name = 'menu_opened' and key = '' group by demo`);
    const before = Object.fromEntries(t0.rows.map((r) => [r.demo, r.n]));
    const got = await track([...opens(w.B, 3), ...opens(A, 2)]);
    assert.equal(got.accepted, 5, JSON.stringify(got));
    await rollup();
    const day = new Date(Date.now() - 2000).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    const daily = async (demo) => (await rpc(w.url, U.support, 'ops_analytics', { p_query: { resolution: 'day', from: day, to: day, names: ['menu_opened'], ...(demo ? { demo } : {}) } }));
    const real = await daily();
    assert.deepEqual([real.resolution, real.demo, real.venueId, real.buckets], ['day', 'exclude', null, [day]]);
    assert.deepEqual(Object.keys(real.series), ['menu_opened']);
    assert.equal(real.totals.menu_opened, (before.false ?? 0) + 3);
    assert.equal((await daily('only')).totals.menu_opened, (before.true ?? 0) + 2);
    assert.equal((await daily('include')).totals.menu_opened, (before.false ?? 0) + (before.true ?? 0) + 5);
    const m = Math.floor(Date.now() / 60000) * 60000;
    const minute = await rpc(w.url, U.admin, 'ops_analytics', { p_query: { resolution: 'minute', venueId: w.B, from: iso(m - 59 * 60000), to: iso(m + 60000) } });
    assert.equal(minute.buckets.length, 60);
    assert.equal(minute.buckets[59], iso(m));
    const sum = (await w.admin.query(`select coalesce(sum(n), 0)::int as n from public.rollups_minute where venue_id = $1 and name = 'menu_opened' and key = '' and not demo
      and bucket >= $2 and bucket < $3`, [w.B, iso(m - 59 * 60000), iso(m + 60000)])).rows[0].n;
    assert.equal(minute.totals.menu_opened, sum);
    assert.ok(sum >= 3);
    assert.ok(Object.values(minute.series).every((s) => s.length === 60), 'every name, zeros included');
  });

  test('the funnel of the venues created in the range, and the imports created in it', async () => {
    const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
    const r = await rpc(w.url, U.support, 'ops_analytics', { p_query: { resolution: 'day', from: day, to: day, names: ['menu_opened'] } });
    const made = (await w.admin.query(`select count(*)::int as created, count(*) filter (where first_published_at is not null)::int as published,
      count(*) filter (where approved_at is not null)::int as approved from public.venues where not is_demo and app.local_date(created_at, time_zone) = $1::date`, [day])).rows[0];
    assert.deepEqual(r.funnel, { ...made, imported: 0 });
    const imps = (await w.admin.query(`select count(*)::int as n from public.menu_imports i join public.venues v on v.id = i.venue_id where not v.is_demo`)).rows[0].n;
    assert.equal(r.imports.total, imps);
    assert.deepEqual(r.imports.bySource.map((s) => s.source), ['scan', 'paste', 'wolt_screenshots', 'wolt_text']);
    assert.equal(r.imports.bySource.reduce((a, s) => a + s.total, 0), r.imports.total);
  });
});

describe('ops_set_demo (admins)', () => {
  test('admins only; every code', async () => {
    assert.deepEqual(await whoMay('ops_set_demo', { p_venue: w.B, p_demo: false, p_reason: 'x' }), {
      anon: '42501', stranger: '42501', ownerA: '42501', managerA: '42501', counterA: '42501', ownerB: '42501', support: '42501', admin: 'reason_required',
    });
    assert.deepEqual(await rpc(w.url, U.admin, 'ops_set_demo', { p_venue: '00000000-0000-4000-8000-00000000ffff', p_demo: true, p_reason: 'Training venue' }),
      { ok: false, code: 'venue_unknown' });
    assert.deepEqual(await rpc(w.url, U.admin, 'ops_set_demo', { p_venue: w.B, p_demo: null, p_reason: 'Training venue' }), { ok: false, code: 'type' });
  });

  test('a venue switched to demo: logged with the reason the owner sees, out of the real totals, its next events demo', async () => {
    const t0 = (await rpc(w.url, U.support, 'ops_venues', {})).totals;
    const r = await rpc(w.url, U.admin, 'ops_set_demo', { p_venue: w.B, p_demo: true, p_reason: 'Used for staff training' });
    assert.deepEqual(r, { ok: true, demo: true });
    const t1 = (await rpc(w.url, U.support, 'ops_venues', {})).totals;
    assert.deepEqual([t1.venues, t1.demoVenues], [t0.venues - 1, t0.demoVenues + 1]);
    const named = await lastLog(w.B, 'venue.set_demo');
    assert.deepEqual([named.actor_kind, named.via, named.reason, named.detail], ['staff', 'rpc', 'Used for staff training', { demo: true }]);
    const row = await lastLog(w.B, 'venues.update');
    assert.deepEqual([row.via, row.reason, row.detail.changes], ['rpc', 'Used for staff training', { is_demo: [false, true] }]);
    const seen = (await rpc(w.url, U.ownerB, 'venue_activity', { p_venue: w.B, p_limit: 5 })).entries.find((e) => e.action === 'venue.set_demo');
    assert.deepEqual([seen.actorKind, seen.reason, seen.you], ['staff', 'Used for staff training', false]);
    await rollup();
    await track(opens(w.B, 1));
    await rollup();
    const labels = (await w.admin.query(`select demo, sum(n)::int as n from public.rollups_minute where venue_id = $1 and name = 'menu_opened' and key = ''
      and bucket = date_trunc('minute', now() - interval '2 seconds') group by demo order by demo`, [w.B])).rows;
    assert.ok(labels.some((l) => l.demo === true && l.n >= 1), JSON.stringify(labels));
    assert.deepEqual(await rpc(w.url, U.admin, 'ops_set_demo', { p_venue: w.B, p_demo: true, p_reason: 'Again' }), { ok: true, demo: true }, 'no change, still logged');
    assert.equal((await w.admin.query(`select count(*)::int as n from public.activity_log where venue_id = $1 and action = 'venues.update' and reason = 'Again'`, [w.B])).rows[0].n, 0);
    assert.deepEqual(await rpc(w.url, U.admin, 'ops_set_demo', { p_venue: w.B, p_demo: false, p_reason: 'Back to a real venue' }), { ok: true, demo: false });
  });
});
