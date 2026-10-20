// The phase-1 RPCs of the client app (ADR-008), each "who" proven as the role that would break it, every error code,
// what they write and what the owner then sees: onboarding steps, support cases, the phone's quick actions, the export,
// the activity log, the dashboard v2. Then the access model as a whole.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { as, q, rpc } from './harness/cluster.mjs';
import { A, count, ID, U, world } from './harness/world.mjs';
import { ACTIVITY_ACTIONS, isActivityAction, NUDGE_CODES } from '../../packages/contracts/src/index.ts';

let w;
before(async () => { w = await world(); });
after(async () => { await w?.stop(); });

const ROLES = { anon: 'anon', stranger: U.stranger, ownerA: U.ownerA, managerA: U.managerA, counterA: U.counterA, ownerB: U.ownerB, support: U.support, admin: U.admin };
/** What each role gets from one call: 'ok', a reply's code, or the error's SQLSTATE. */
async function whoMay(fn, args, roles = ROLES) {
  const out = {};
  for (const [name, who] of Object.entries(roles)) {
    const r = await rpc(w.url, who, fn, args);
    out[name] = r?.error ? r.error.code : r?.ok === false ? r.code : 'ok';
  }
  return out;
}
/** A text[] argument as PostgreSQL reads it (PostgREST turns a JSON array into one; the harness sends objects as JSON). */
const pgArray = (xs) => `{${xs.map((x) => `"${String(x).replace(/["\\]/g, (c) => '\\' + c)}"`).join(',')}}`;
const setCfg = (key, value) => w.admin.query(`update public.app_config set value = $2::jsonb where key = $1`, [key, JSON.stringify(value)]);
const cfg = async (key) => (await w.admin.query(`select value from public.app_config where key = $1`, [key])).rows[0].value;
const withCfg = async (key, value, fn) => { const old = await cfg(key); await setCfg(key, value); try { return await fn(); } finally { await setCfg(key, old); } };
/** Setup only: rows the triggers would not let a test write (an override that started yesterday, an old timestamp). */
const raw = async (sql, params = []) => {
  await w.admin.query('set session_replication_role = replica');
  try { return (await w.admin.query(sql, params)).rows; } finally { await w.admin.query('set session_replication_role = default'); }
};
const lastLog = async (venue, action) => (await w.admin.query(
  `select actor_kind, via, reason, n, detail, target_ids from public.activity_log where venue_id = $1 and action = $2 order by id desc limit 1`, [venue, action])).rows[0];
const newVenue = async (owner, slug) => {
  await w.admin.query(`insert into auth.users (id, email, email_confirmed_at, last_sign_in_at) values ($1, $2, now(), now()) on conflict do nothing`, [owner, `${slug}@example.invalid`]);
  const made = await rpc(w.url, owner, 'create_venue', { p_slug: slug, p_name_en: `Venue ${slug}` });
  assert.equal(made.ok, true, JSON.stringify(made));
  return made.id;
};

describe('onboarding: set_onboarding_step and the steps the database marks itself', () => {
  test('owners and managers may; a counter, another venue\'s owner, staff and guests may not', async () => {
    assert.deepEqual(await whoMay('set_onboarding_step', { p_venue: A, p_step: 'photos', p_state: 'nope' }), {
      anon: '42501', stranger: '42501', ownerA: 'enum_invalid', managerA: 'enum_invalid', counterA: '42501', ownerB: '42501', support: '42501', admin: '42501',
    });
  });

  test('a step marked, its blockers kept when none are sent; an automatic step never by hand; every code', async () => {
    const set = (step, state, blockers) => rpc(w.url, U.ownerB, 'set_onboarding_step', { p_venue: w.B, p_step: step, p_state: state, ...(blockers ? { p_blockers: pgArray(blockers) } : {}) });
    const r = await set('photos', 'done');
    assert.equal(r.ok, true);
    assert.deepEqual(r.progress.steps.find((s) => s.step === 'photos'), { step: 'photos', state: 'done', blockers: [], auto: false, updatedAt: r.progress.steps.find((s) => s.step === 'photos').updatedAt });
    assert.match(r.progress.steps.find((s) => s.step === 'photos').updatedAt, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{1,6}(Z|[+-]\d\d:\d\d)$/, 'a version, to the microsecond');
    assert.deepEqual([r.progress.total, r.progress.next, r.progress.complete], [9, 'review', false]);
    assert.equal((await set('hours', 'blocked', ['dish_without_price'])).ok, true);
    const kept = await set('hours', 'doing');
    assert.deepEqual(kept.progress.steps.find((s) => s.step === 'hours').blockers, ['dish_without_price'], 'no blockers sent: kept');
    assert.deepEqual((await set('hours', 'doing', [])).progress.steps.find((s) => s.step === 'hours').blockers, []);
    assert.deepEqual(await set('review', 'done'), { ok: false, code: 'step_automatic' });
    assert.deepEqual(await set('menu', 'todo'), { ok: false, code: 'step_done' }, 'the first dish marked it done');
    assert.equal((await set('review', 'skipped')).ok, true, 'a menu built by hand skips the review');
    assert.deepEqual(await set('publish', 'skipped'), { ok: false, code: 'step_automatic' }, 'of the automatic steps only the review is skipped');
    assert.match((await q(w.url, U.ownerB, `update public.onboarding_progress set state = 'skipped' where venue_id = $1 and step = 'menu'`, [w.B])).error?.message ?? '',
      /step_automatic/, 'nor by a direct write');
    assert.deepEqual(await set('hours', 'blocked', ['Free text!']), { ok: false, code: 'blocker_invalid' });
    assert.deepEqual(await set('hours', 'blocked', Array(21).fill('a_b')), { ok: false, code: 'too_many' });
    assert.deepEqual(await set('party', 'done'), { ok: false, code: 'enum_invalid' });
    const log = await lastLog(w.B, 'onboarding_progress.update');
    assert.deepEqual([log.actor_kind, log.via], ['owner', 'rpc']);
    const ev = await w.admin.query(`select count(*)::int as n from public.events where venue_id = $1 and name = 'onboarding_step_done' and props->>'step' = 'photos'`, [w.B]);
    assert.equal(ev.rows[0].n, 1);
    // an archived venue
    const O = '22222222-2222-4222-8222-2222222222a1';
    const v = await newVenue(O, 'archived-one');
    await w.admin.query(`update public.venues set archived_at = now() where id = $1`, [v]);
    assert.deepEqual(await rpc(w.url, O, 'set_onboarding_step', { p_venue: v, p_step: 'photos', p_state: 'done' }), { ok: false, code: 'venue_unknown' });
  });

  test('Halom\'s act_for_owner("onboarding.set") follows the same rules', async () => {
    const afo = (payload) => rpc(w.url, U.support, 'act_for_owner', { p_venue: w.B, p_reason: 'Owner asked on the phone', p_action: 'onboarding.set', p_payload: payload });
    /** The step's updatedAt as staff read it (ops_venue), to the microsecond; null for a step never written. */
    const seen = async (step) => (await rpc(w.url, U.support, 'ops_venue', { p_venue: w.B })).onboarding.steps.find((s) => s.step === step).updatedAt;
    assert.deepEqual(await afo({ step: 'publish', state: 'done', expectedUpdatedAt: await seen('publish') }), { ok: false, code: 'step_automatic' });
    assert.deepEqual(await afo({ step: 'menu', state: 'doing', expectedUpdatedAt: await seen('menu') }), { ok: false, code: 'step_done' });
    assert.deepEqual(await afo({ step: 'nope', state: 'done', expectedUpdatedAt: null }), { ok: false, code: 'enum_invalid' });
    assert.deepEqual(await afo({ step: 'style', state: 'done' }), { ok: false, code: 'payload_invalid' }, 'expectedUpdatedAt is required');
    const at0 = await seen('style');   // null when never written
    const ok = await afo({ step: 'style', state: 'done', expectedUpdatedAt: at0 });
    assert.deepEqual([ok.ok, ok.result.step, ok.result.state, ok.result.progress.steps.find((s) => s.step === 'style').state], [true, 'style', 'done', 'done']);
    const log = await lastLog(w.B, 'onboarding_progress.update');
    assert.deepEqual([log.actor_kind, log.via, log.reason], ['staff', 'act_for_owner', 'Owner asked on the phone']);
    // the step changed since staff read it: stale, with the step as it is
    const at = await seen('style');
    assert.match(at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{1,6}(Z|[+-]\d\d:\d\d)$/, 'to the microsecond');
    const before = (await w.admin.query('select count(*)::int as n from public.activity_log')).rows[0].n;
    assert.deepEqual(await afo({ step: 'style', state: 'skipped', expectedUpdatedAt: at0 }),
      { ok: false, code: 'stale', action: 'onboarding.set', current: { step: 'style', state: 'done', blockers: ok.result.progress.steps.find((s) => s.step === 'style').blockers, updatedAt: at } });
    const second = at.replace(/\.\d+(?=Z$|[+-]\d\d:\d\d$)/, '');
    assert.equal((await afo({ step: 'style', state: 'skipped', expectedUpdatedAt: second })).code, 'stale', 'the same second is not the same version');
    assert.equal((await w.admin.query('select count(*)::int as n from public.activity_log')).rows[0].n, before, 'nothing written');
    assert.equal((await afo({ step: 'style', state: 'skipped', expectedUpdatedAt: at })).ok, true);
    assert.equal((await w.admin.query(`select state from public.onboarding_progress where venue_id = $1 and step = 'style'`, [w.B])).rows[0].state, 'skipped');
  });

  test('the venue\'s first dish marks "menu" done; clients never write an automatic step done', async () => {
    const O = '22222222-2222-4222-8222-2222222222a2';
    const v = await newVenue(O, 'first-dish');
    const step = async () => (await w.admin.query(`select state from public.onboarding_progress where venue_id = $1 and step = 'menu'`, [v])).rows[0].state;
    assert.equal(await step(), 'todo');
    await as(w.url, O, async (c) => {
      const s = (await c.query(`insert into public.sections (venue_id, name_en) values ($1, 'Food') returning id`, [v])).rows[0].id;
      await c.query(`insert into public.dishes (venue_id, section_id, name_en, price) values ($1, $2, 'Soup', 3000), ($1, $2, 'Bread', 900)`, [v, s]);
    });
    assert.equal(await step(), 'done');
    assert.equal((await w.admin.query(`select count(*)::int as n from public.events where venue_id = $1 and name = 'onboarding_step_done' and props->>'step' = 'menu'`, [v])).rows[0].n, 1);
    assert.match((await q(w.url, O, `update public.onboarding_progress set state = 'done' where venue_id = $1 and step = 'publish'`, [v])).error?.message ?? '', /step_automatic/);
  });
});

describe('add-on groups: limits an import guessed wait for the owner', () => {
  test('changing a group\'s limits confirms them; the owner may also confirm them as they are', async () => {
    const state = async () => (await w.admin.query(`select limits_confirmed from public.addon_groups where id = $1`, [w.b.group])).rows[0].limits_confirmed;
    assert.equal(await state(), true, 'a group the owner made is confirmed');
    await w.admin.query(`update public.addon_groups set limits_confirmed = false where id = $1`, [w.b.group]);
    await as(w.url, U.ownerB, (c) => c.query(`update public.addon_groups set name_en = 'Breads' where id = $1`, [w.b.group]));
    assert.equal(await state(), false, 'a name is not the limits');
    await as(w.url, U.ownerB, (c) => c.query(`update public.addon_groups set min_units = 1 where id = $1`, [w.b.group]));
    assert.equal(await state(), true);
    await w.admin.query(`update public.addon_groups set limits_confirmed = false where id = $1`, [w.b.group]);
    assert.equal(await count(w.url, U.ownerB, `update public.addon_groups set limits_confirmed = true where id = $1`, [w.b.group]), 1);
    assert.equal(await state(), true);
    await as(w.url, U.ownerB, (c) => c.query(`update public.addon_groups set min_units = 0, name_en = 'Bread' where id = $1`, [w.b.group]));
  });
});

describe('opening hours: updated_at, and windows never overlap (hours_overlap)', () => {
  test('a window carries updated_at, moved by every change', async () => {
    const O = '22222222-2222-4222-8222-2222222222a7';
    const v = await newVenue(O, 'hours-version');
    const id = await as(w.url, O, async (c) => (await c.query(`insert into public.venue_hours (venue_id, weekday, opens, closes) values ($1, 1, '09:00', '12:00') returning id`, [v])).rows[0].id);
    const at = async () => (await w.admin.query(`select updated_at from public.venue_hours where id = $1`, [id])).rows[0].updated_at;
    const first = await at();
    assert.ok(first);
    await as(w.url, O, (c) => c.query(`update public.venue_hours set closes = '13:00' where id = $1`, [id]));
    assert.ok((await at()) > first);
  });

  test('two windows of one day, a window past midnight into the next day\'s first, Saturday into Sunday: refused; touching is fine', async () => {
    const O = '22222222-2222-4222-8222-2222222222a8';
    const v = await newVenue(O, 'hours-overlap');
    const add = (weekday, opens, closes) => q(w.url, O, `insert into public.venue_hours (venue_id, weekday, opens, closes) values ($1, $2, $3, $4) returning id`, [v, weekday, opens, closes]);
    const refused = (r) => /hours_overlap/.test(r.error?.message ?? '');
    assert.ok(!(await add(5, '10:00', '14:00')).error);
    assert.ok(refused(await add(5, '12:00', '16:00')), 'Friday 10-14 and 12-16');
    assert.ok(refused(await add(5, '09:00', '18:00')), 'one inside the other');
    assert.ok(!(await add(5, '14:00', '16:00')).error, 'touching at 14:00');
    assert.ok(!(await add(5, '18:00', '02:00')).error, 'Friday night past midnight');
    assert.ok(refused(await add(6, '01:00', '03:00')), 'Saturday\'s first window, still Friday night');
    assert.ok(!(await add(6, '02:00', '05:00')).error, 'from 02:00 on Saturday');
    assert.ok(!(await add(6, '22:00', '01:00')).error, 'Saturday night into Sunday');
    assert.ok(refused(await add(0, '00:30', '04:00')), 'Sunday 00:30: the week wraps');
    assert.ok(refused(await add(3, '08:00', '08:00')) === false, 'a 24-hour Wednesday alone is fine');
    assert.ok(refused(await add(4, '07:00', '09:00')), 'Thursday 07:00 is still Wednesday\'s 24 hours');
    const id = (await q(w.url, O, `select id from public.venue_hours where venue_id = $1 and weekday = 5 and opens = '14:00'`, [v]))[0].id;
    assert.ok(refused(await q(w.url, O, `update public.venue_hours set opens = '13:00' where id = $1`, [id])), 'an update too');
    assert.ok(!(await q(w.url, O, `update public.venue_hours set closes = '15:00' where id = $1`, [id])).error, 'a window never overlaps itself');
    const other = await newVenue('22222222-2222-4222-8222-2222222222a9', 'hours-other');
    assert.ok(!(await q(w.url, '22222222-2222-4222-8222-2222222222a9', `insert into public.venue_hours (venue_id, weekday, opens, closes) values ($1, 5, '10:00', '14:00')`, [other])).error,
      'per venue');
  });
});

describe('support cases: open_case and ops_update_case', () => {
  test('owners and managers open cases; a counter, another venue, staff and guests do not', async () => {
    assert.deepEqual(await whoMay('open_case', { p_venue: A, p_topic: 'billing', p_subject: 'x' }), {
      anon: '42501', stranger: '42501', ownerA: 'enum_invalid', managerA: 'enum_invalid', counterA: '42501', ownerB: '42501', support: '42501', admin: '42501',
    });
  });

  test('the owner asks for help and switches Halom\'s access in the same call; the words never reach the log', async () => {
    const r = await rpc(w.url, U.ownerB, 'open_case', { p_venue: w.B, p_topic: 'import', p_subject: ' The drinks went missing ', p_body: 'Two lemonades', p_allow_act: false });
    assert.deepEqual([r.ok, r.supportCanAct], [true, false]);
    const c = (await w.admin.query(`select subject, body, status, opened_by from public.support_cases where id = $1`, [r.caseId])).rows[0];
    assert.deepEqual(c, { subject: 'The drinks went missing', body: 'Two lemonades', status: 'open', opened_by: U.ownerB });
    const ins = await lastLog(w.B, 'support_cases.insert');
    assert.deepEqual([ins.actor_kind, ins.via], ['owner', 'rpc']);
    assert.ok(!JSON.stringify(ins.detail).includes('lemonade') && !JSON.stringify(ins.detail).includes('drinks'));
    const sw = await lastLog(w.B, 'venues.update');
    assert.deepEqual(sw.detail.changes, { support_can_act: [true, false] });
    assert.deepEqual(await rpc(w.url, U.support, 'act_for_owner', { p_venue: w.B, p_reason: 'Trying anyway', p_action: 'availability.restore',
      p_payload: { targetKind: 'dish', targetId: w.b.dish } }), { ok: false, code: 'owner_declined' });
    const on = await rpc(w.url, U.ownerB, 'open_case', { p_venue: w.B, p_topic: 'other', p_subject: 'Please go ahead', p_allow_act: true });
    assert.deepEqual([on.ok, on.supportCanAct], [true, true]);
  });

  test('every code: a manager may not switch Halom\'s access; text; topic; the daily cap; an archived venue', async () => {
    assert.deepEqual(await rpc(w.url, U.managerA, 'open_case', { p_venue: A, p_topic: 'menu', p_subject: 'Hi', p_allow_act: false }), { ok: false, code: 'owner_only' });
    const m = await rpc(w.url, U.managerA, 'open_case', { p_venue: A, p_topic: 'menu', p_subject: 'Hi' });
    assert.deepEqual([m.ok, m.supportCanAct], [true, true], 'without allowAct the switch is left alone');
    assert.deepEqual(await rpc(w.url, U.ownerA, 'open_case', { p_venue: A, p_topic: 'menu', p_subject: `  ${String.fromCodePoint(0x200b)}` }), { ok: false, code: 'text_missing' });
    assert.deepEqual(await rpc(w.url, U.ownerA, 'open_case', { p_venue: A, p_topic: 'menu', p_subject: 'x'.repeat(161) }), { ok: false, code: 'text_too_long' });
    assert.deepEqual(await rpc(w.url, U.ownerA, 'open_case', { p_venue: A, p_topic: 'menu', p_subject: 'x', p_body: 'y'.repeat(4001) }), { ok: false, code: 'text_too_long' });
    await withCfg('case_caps', { per_venue_day: 1 }, async () => {
      assert.deepEqual(await rpc(w.url, U.ownerA, 'open_case', { p_venue: A, p_topic: 'menu', p_subject: 'One more' }), { ok: false, code: 'rate_limited' });
    });
    const O = '22222222-2222-4222-8222-2222222222a3';
    const v = await newVenue(O, 'archived-two');
    await w.admin.query(`update public.venues set archived_at = now() where id = $1`, [v]);
    assert.deepEqual(await rpc(w.url, O, 'open_case', { p_venue: v, p_topic: 'menu', p_subject: 'Hi' }), { ok: false, code: 'venue_unknown' });
  });

  test('open_case is the only way to make a case: no direct insert, and a client id makes a retry safe', async () => {
    for (const who of [U.ownerA, U.managerA]) {
      assert.equal((await q(w.url, who, `insert into public.support_cases (venue_id, topic, subject, body) values ($1, 'menu', 'Direct', '')`, [A])).error?.code, '42501',
        'past the daily cap otherwise');
    }
    const id = randomUUID();
    const first = await rpc(w.url, U.ownerA, 'open_case', { p_venue: A, p_topic: 'menu', p_subject: 'Prices look wrong', p_id: id });
    assert.deepEqual([first.ok, first.caseId], [true, id]);
    const before = (await w.admin.query(`select count(*)::int as n from public.support_cases where venue_id = $1`, [A])).rows[0].n;
    await withCfg('case_caps', { per_venue_day: 1 }, async () => {
      const again = await rpc(w.url, U.managerA, 'open_case', { p_venue: A, p_topic: 'menu', p_subject: 'Prices look wrong', p_id: id });
      assert.deepEqual([again.ok, again.caseId], [true, id], 'the same id again: the stored case, past the cap too');
    });
    assert.equal((await w.admin.query(`select count(*)::int as n from public.support_cases where venue_id = $1`, [A])).rows[0].n, before, 'nothing new');
    assert.deepEqual(await rpc(w.url, U.ownerB, 'open_case', { p_venue: w.B, p_topic: 'menu', p_subject: 'Mine now', p_id: id }), { ok: false, code: 'id_taken' },
      'another venue\'s case id: a bare code, never that case');
    const own = randomUUID();
    assert.equal((await rpc(w.url, U.ownerB, 'open_case', { p_venue: w.B, p_topic: 'menu', p_subject: 'Hi', p_id: own })).caseId, own);
  });

  test('staff work a case with a reason the owner sees; owners cannot; every code', async () => {
    const c = await rpc(w.url, U.ownerB, 'open_case', { p_venue: w.B, p_topic: 'photos', p_subject: 'A picture is wrong' });
    const args = { p_case: c.caseId, p_status: 'waiting_owner', p_reason: 'Sent the owner two options' };
    assert.deepEqual(await whoMay('ops_update_case', { ...args, p_status: 'closed' }), {
      anon: '42501', stranger: '42501', ownerA: '42501', managerA: '42501', counterA: '42501', ownerB: '42501', support: 'enum_invalid', admin: 'enum_invalid',
    });
    const r = await rpc(w.url, U.support, 'ops_update_case', args);
    assert.equal(r.ok, true);
    assert.deepEqual([r.case.id, r.case.status, r.case.topic, r.case.openedBy, r.case.resolvedAt, r.case.supportCanAct], [c.caseId, 'waiting_owner', 'photos', 'owner', null, true]);
    const log = await lastLog(w.B, 'support_cases.update');
    assert.deepEqual([log.actor_kind, log.via, log.reason, log.detail.changes], ['staff', 'rpc', 'Sent the owner two options', { status: ['open', 'waiting_owner'] }]);
    const seen = await rpc(w.url, U.ownerB, 'venue_activity', { p_venue: w.B, p_limit: 5 });
    assert.ok(seen.entries.some((e) => e.action === 'support_cases.update' && e.reason === 'Sent the owner two options' && e.actorKind === 'staff' && !e.you));
    const done = await rpc(w.url, U.admin, 'ops_update_case', { p_case: c.caseId, p_status: 'resolved', p_topic: 'menu', p_reason: 'Fixed with the owner' });
    assert.deepEqual([done.case.status, done.case.topic, typeof done.case.resolvedAt], ['resolved', 'menu', 'string']);
    assert.deepEqual(await rpc(w.url, U.support, 'ops_update_case', { p_case: c.caseId, p_reason: 'Nothing to do' }), { ok: false, code: 'nothing_to_change' });
    assert.deepEqual(await rpc(w.url, U.support, 'ops_update_case', { p_case: c.caseId, p_status: 'open', p_reason: ' a ' }), { ok: false, code: 'reason_required' });
    assert.deepEqual(await rpc(w.url, U.support, 'ops_update_case', { p_case: c.caseId, p_status: 'open' }), { ok: false, code: 'reason_required' });
    assert.deepEqual(await rpc(w.url, U.support, 'ops_update_case', { p_case: '00000000-0000-4000-8000-00000000ffff', p_status: 'open', p_reason: 'Checking' }),
      { ok: false, code: 'case_unknown' });
  });
});

describe('availability: set_availability and restore_today', () => {
  test('owners, managers and counters; nobody else', async () => {
    assert.deepEqual(await whoMay('set_availability', { p_venue: A, p_target_kind: 'table', p_target_id: ID.burger }), {
      anon: '42501', stranger: '42501', ownerA: 'enum_invalid', managerA: 'enum_invalid', counterA: 'enum_invalid', ownerB: '42501', support: '42501', admin: '42501',
    });
    assert.deepEqual(await whoMay('restore_today', { p_venue: w.B }, { anon: 'anon', stranger: U.stranger, counterA: U.counterA, support: U.support }),
      { anon: '42501', stranger: '42501', counterA: '42501', support: '42501' });
  });

  test('the newest answer counts: off two hours, then thirty minutes, then back; whole minutes; logged as the counter', async () => {
    const set = (until, note) => rpc(w.url, U.counterA, 'set_availability', { p_venue: A, p_target_kind: 'dish', p_target_id: ID.lemonade, p_until: until, ...(note ? { p_note: note } : {}) });
    const t0 = Date.now();
    const a = await set({ kind: 'duration', minutes: 120 }, 'out of lemons');
    assert.deepEqual([a.ok, a.restored], [true, 0]);
    assert.equal(Date.parse(a.untilAt) % 60000, 0, 'a whole minute');
    assert.ok(Date.parse(a.untilAt) - t0 >= 120 * 60000 - 1000 && Date.parse(a.untilAt) - t0 <= 121 * 60000);
    const b = await set({ kind: 'duration', minutes: 30 });
    assert.equal(b.restored, 1, 'the two hours are restored first');
    const off = (await rpc(w.url, 'anon', 'public_menu', { p_slug: 'cafe-demo' })).live.off.filter((o) => o.id === ID.lemonade);
    assert.deepEqual(off.map((o) => o.until), [b.untilAt], 'nothing stacks');
    const logIns = await lastLog(A, 'availability_overrides.insert');
    const logUpd = await lastLog(A, 'availability_overrides.update');
    assert.deepEqual([logIns.actor_kind, logIns.via, logUpd.actor_kind, logUpd.via, logUpd.n], ['counter', 'rpc', 'counter', 'rpc', 1]);
    assert.ok(!JSON.stringify(logIns.detail).includes('lemons'), 'the note is not copied');
    const c = await set(null);
    assert.deepEqual([c.ok, c.overrideId, c.untilAt, c.restored], [true, null, null, 1]);
    assert.deepEqual((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'cafe-demo' })).live.off.filter((o) => o.id === ID.lemonade), []);
  });

  test('every code: another venue\'s dish, a past date, a bad spec, a long note, no target', async () => {
    const set = (args) => rpc(w.url, U.ownerA, 'set_availability', { p_venue: A, p_target_kind: 'dish', p_target_id: ID.burger, p_until: { kind: 'indefinite' }, ...args });
    assert.deepEqual(await set({ p_target_id: w.b.dish }), { ok: false, code: 'target_unknown' });
    assert.deepEqual(await set({ p_until: { kind: 'date', date: '2020-01-01' } }), { ok: false, code: 'until_in_past' });
    assert.deepEqual(await set({ p_until: { kind: 'forever' } }), { ok: false, code: 'until_invalid' });
    assert.deepEqual(await set({ p_note: 'x'.repeat(201) }), { ok: false, code: 'text_too_long' });
    assert.deepEqual(await set({ p_target_id: null }), { ok: false, code: 'id_invalid' });
    assert.deepEqual(await set({ p_target_kind: 'option' }), { ok: false, code: 'target_unknown', }, 'a dish id is not an option');
    assert.equal((await w.admin.query(`select count(*)::int as n from public.availability_overrides where target_id = $1 and restored_at is null`, [ID.burger])).rows[0].n, 0,
      'a refused call restored nothing either');
  });

  test('act_for_owner("availability.set") runs the same internal: the newest counts, null brings it back', async () => {
    const afo = (payload) => rpc(w.url, U.support, 'act_for_owner', { p_venue: A, p_reason: 'Owner called', p_action: 'availability.set', p_payload: payload });
    const a = await afo({ targetKind: 'option', targetId: ID.chipotle, until: { kind: 'duration', minutes: 60 } });
    const b = await afo({ targetKind: 'option', targetId: ID.chipotle, until: { kind: 'next_opening' } });
    assert.deepEqual([a.ok, b.ok, b.result.restored], [true, true, 1]);
    const back = await afo({ targetKind: 'option', targetId: ID.chipotle, until: null });
    assert.deepEqual([back.result.restored, back.result.overrideId], [1, null]);
    assert.deepEqual(await afo({ targetKind: 'option', targetId: ID.chipotle }), { ok: false, code: 'payload_invalid' }, 'until must be said, even as null');
  });

  test('restore_today brings back what was taken off today; what started yesterday or has not started stays', async () => {
    const take = (id, until, startsAt = null) => as(w.url, U.ownerA, async (c) => (await c.query(`insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec, starts_at)
      values ($1, 'dish', $2, $3, $4, coalesce($5::timestamptz, now())) returning id`, [A, id, until.kind, JSON.stringify(until), startsAt])).rows[0].id);
    await take(ID.espresso, { kind: 'duration', minutes: 120 });
    const old = await take(ID.croissant, { kind: 'indefinite' });
    await raw(`update public.availability_overrides set starts_at = now() - interval '3 days' where id = $1`, [old]);
    const later = await take(ID.schnitzel, { kind: 'indefinite' }, new Date(Date.now() + 3600_000).toISOString());
    const r = await rpc(w.url, U.counterA, 'restore_today', { p_venue: A });
    assert.deepEqual(r, { ok: true, restored: 1, targets: [{ kind: 'dish', id: ID.espresso }] });
    const left = (await w.admin.query(`select target_id from public.availability_overrides where venue_id = $1 and restored_at is null order by target_id`, [A])).rows.map((x) => x.target_id);
    assert.deepEqual(left, [ID.schnitzel, ID.croissant].sort());
    const log = await lastLog(A, 'availability_overrides.update');
    assert.deepEqual([log.actor_kind, log.via, log.n], ['counter', 'rpc', 1]);
    assert.deepEqual(await rpc(w.url, U.counterA, 'restore_today', { p_venue: A }), { ok: true, restored: 0, targets: [] });
    await w.admin.query(`update public.availability_overrides set restored_at = now() where id in ($1, $2)`, [old, later]);
  });
});

describe('export_menu: the owner\'s menu as JSON', () => {
  test('owners, managers and Halom; not a counter, another venue or a guest', async () => {
    assert.deepEqual(await whoMay('export_menu', { p_venue: A }), {
      anon: '42501', stranger: '42501', ownerA: 'ok', managerA: 'ok', counterA: '42501', ownerB: '42501', support: 'ok', admin: 'ok',
    });
    assert.equal((await rpc(w.url, U.support, 'export_menu', { p_venue: '00000000-0000-4000-8000-00000000ffff' })).error?.code, '22023');
  });

  test('exactly what the venue has, as stored, in position (else id) order; pictures by their public files; logged', async () => {
    const x = await rpc(w.url, U.support, 'export_menu', { p_venue: A });
    assert.deepEqual([x.v, x.kind, x.venue.id, x.venue.slug, x.venue.timeZone, x.venue.defaultLang], [1, 'mana.menu_export', A, 'cafe-demo', 'Asia/Jerusalem', 'he']);
    assert.equal(x.assetBase, 'https://example.invalid/storage/v1/object/public/menu-public/');
    const oracle = async (table, order) => (await w.admin.query(`select id from public.${table} where venue_id = $1 order by ${order}`, [A])).rows.map((r) => r.id);
    for (const [table, order] of [['schedules', 'id'], ['sections', 'position, id'], ['dishes', 'position, id'], ['addon_groups', 'id'], ['addon_options', 'position, id'],
      ['dish_addon_groups', 'position, id'], ['dish_relations', 'position, id'], ['upsell_rules', 'id'], ['venue_hours', 'id'], ['venue_closures', 'id'], ['assets', 'id']]) {
      assert.deepEqual(x.tables[table].map((r) => r.id), await oracle(table, order), table);
    }
    const burger = x.tables.dishes.find((d) => d.id === ID.burger);
    assert.deepEqual([burger.name_en, burger.price, burger.section_id, burger.tags], ['Burger', 6800, ID.mains, []]);
    assert.match(burger.created_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/, 'times through app.iso');
    assert.equal(x.tables.addon_groups.find((g) => g.id === ID.extras).limits_confirmed, true);
    assert.deepEqual(x.tables.venue_hours.length, 7);
    const log = await lastLog(A, 'menu.export');
    assert.deepEqual([log.actor_kind, log.via, log.detail.counts.dishes, log.detail.counts.sections], ['staff', 'rpc', 7, 4]);
    assert.ok((await rpc(w.url, U.ownerA, 'venue_activity', { p_venue: A, p_limit: 3 })).entries.some((e) => e.action === 'menu.export' && e.actorKind === 'staff'),
      'the owner sees when Halom exported the menu');
  });
});

describe('venue_activity: the log, page by page', () => {
  test('owners, managers and staff; codes as 22023', async () => {
    assert.deepEqual(await whoMay('venue_activity', { p_venue: A, p_limit: 1 }), {
      anon: '42501', stranger: '42501', ownerA: 'ok', managerA: 'ok', counterA: '42501', ownerB: '42501', support: 'ok', admin: 'ok',
    });
    assert.equal((await rpc(w.url, U.ownerA, 'venue_activity', { p_venue: A, p_limit: 0 })).error?.code, '22023');
    assert.match((await rpc(w.url, U.ownerA, 'venue_activity', { p_venue: A, p_actor: 'guest' })).error?.message ?? '', /enum_invalid/);
    assert.match((await rpc(w.url, U.ownerA, 'venue_activity', { p_venue: A, p_before: 0 })).error?.message ?? '', /id_invalid/);
  });

  test('newest first; you; staff never named; the name of the row now; pages; filters', async () => {
    await as(w.url, U.ownerA, (c) => c.query(`update public.dishes set desc_en = 'Crispy' where id = $1`, [ID.schnitzel]));
    const p1 = await rpc(w.url, U.ownerA, 'venue_activity', { p_venue: A, p_limit: 2 });
    assert.equal(p1.entries.length, 2);
    assert.ok(p1.entries[0].id > p1.entries[1].id);
    const mine = p1.entries[0];
    assert.deepEqual([mine.action, mine.actorKind, mine.you, mine.via, mine.targetName], ['dishes.update', 'owner', true, 'direct', { he: 'שניצל', en: 'Schnitzel' }]);
    assert.ok(!('actorId' in mine) && !JSON.stringify(p1).includes(U.ownerA), 'no person\'s id leaves the database');
    assert.equal(p1.next, p1.entries[1].id);
    const p2 = await rpc(w.url, U.ownerA, 'venue_activity', { p_venue: A, p_before: p1.next, p_limit: 2 });
    assert.ok(p2.entries.every((e) => e.id < p1.next));
    const staff = await rpc(w.url, U.ownerA, 'venue_activity', { p_venue: A, p_actor: 'staff', p_limit: 100 });
    assert.ok(staff.entries.length > 0 && staff.entries.every((e) => e.actorKind === 'staff' && !e.you));
    const all = await rpc(w.url, U.ownerA, 'venue_activity', { p_venue: A, p_via: 'act_for_owner', p_limit: 100 });
    assert.ok(all.entries.every((e) => e.via === 'act_for_owner'));
    assert.equal(all.next, null, 'the last page');
    assert.ok(all.entries.every((e) => isActivityAction(e.action)));
  });
});

describe('my_dashboard v2', () => {
  test('every phase-0 field and v2\'s: progress, steps with auto, nudges, off now with names, today, activity entries', async () => {
    await as(w.url, U.ownerA, (c) => c.query(`insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec) values ($1, 'option', $2, 'indefinite', '{"kind":"indefinite"}')`, [A, ID.oat]));
    await w.admin.query(`update public.addon_groups set limits_confirmed = false where id = $1`, [ID.extras]);
    const d = await rpc(w.url, U.ownerA, 'my_dashboard', { p_venue: A, p_range: '7d' });
    for (const k of ['venueId', 'range', 'from', 'to', 'timeZone', 'demo', 'generatedAt', 'rolledUpAt', 'totals', 'opensBy', 'days', 'capped', 'lastHour', 'topDishes',
      'rules', 'offNow', 'menu', 'onboarding', 'progress', 'nudges', 'activity', 'today']) assert.ok(k in d, k);
    assert.equal(d.v, 2);
    assert.equal(d.onboarding.length, 9);
    assert.deepEqual(d.onboarding.filter((s) => s.auto).map((s) => s.step), ['venue', 'menu', 'review', 'publish']);
    assert.deepEqual(Object.keys(d.progress).sort(), ['complete', 'done', 'next', 'total']);
    const oat = d.offNow.find((o) => o.id === ID.oat);
    assert.deepEqual([oat.kind, oat.name, oat.until, oat.untilKind, oat.by, oat.today], ['option', { he: 'שיבולת שועל', en: 'Oat' }, null, 'indefinite', 'owner', true]);
    assert.match(oat.overrideId, /^[0-9a-f-]{36}$/);
    assert.deepEqual(Object.keys(d.today).sort(), ['opensBy', 'topDishes', 'totals']);
    const rule = d.rules.find((r) => r.ruleId === ID.ruleCheese);
    assert.deepEqual([rule.trigger, rule.inactiveReason], ['sheet', null]);
    assert.ok(d.activity.length > 0 && d.activity.length <= 20 && d.activity.every((e) => typeof e.you === 'boolean' && 'targetName' in e));
    const codes = d.nudges.map((n) => n.code);
    assert.deepEqual(codes, NUDGE_CODES.filter((c) => codes.includes(c)), 'in NUDGE_CODES order');
    const noPhoto = d.nudges.find((n) => n.code === 'dish_no_photo');
    assert.equal(noPhoto.count, 7);
    assert.deepEqual(noPhoto.targets[0], { kind: 'dish', id: ID.shakshuka }, 'menu order: breakfast first');
    assert.deepEqual(d.nudges.find((n) => n.code === 'group_without_limits'), { code: 'group_without_limits', count: 1, targets: [{ kind: 'group', id: ID.extras }] });
    await w.admin.query(`update public.addon_groups set limits_confirmed = true where id = $1`, [ID.extras]);
    await w.admin.query(`update public.availability_overrides set restored_at = now() where venue_id = $1 and restored_at is null`, [A]);
  });

  test('nudges for a real venue: approval, the next step, a case waiting for the owner, a dish with no price', async () => {
    const O = '22222222-2222-4222-8222-2222222222a4';
    const v = await newVenue(O, 'nudged');
    await as(w.url, O, async (c) => {
      const s = (await c.query(`insert into public.sections (venue_id, name_en) values ($1, 'Food') returning id`, [v])).rows[0].id;
      await c.query(`insert into public.dishes (venue_id, section_id, name_en, price) values ($1, $2, 'Soup', null)`, [v, s]);
    });
    assert.equal((await rpc(w.url, O, 'publish_menu', { p_venue: v })).review, 'pending');
    const c = await rpc(w.url, O, 'open_case', { p_venue: v, p_topic: 'menu', p_subject: 'Help' });
    await rpc(w.url, U.support, 'ops_update_case', { p_case: c.caseId, p_status: 'waiting_owner', p_reason: 'Asked the owner for the price' });
    const d = await rpc(w.url, O, 'my_dashboard', { p_venue: v });
    const by = Object.fromEntries(d.nudges.map((n) => [n.code, n]));
    assert.deepEqual(by.approval_pending, { code: 'approval_pending', count: 1, targets: [{ kind: 'venue', id: v }] });
    assert.deepEqual(by.onboarding_step.targets, [{ kind: 'step', id: 'review' }]);
    assert.equal(by.onboarding_step.count, 9 - d.progress.done);
    assert.deepEqual(by.case_waiting_owner.targets, [{ kind: 'case', id: c.caseId }]);
    assert.equal(by.dish_no_price.count, 1);
    assert.equal(by.import_waiting, undefined, 'none waiting');
  });
});

describe('my_dashboard reads ids from rollup keys only inside the venue (SEC-M1)', () => {
  test('a dish deleted here and made again with the same id in another venue never shows on this venue\'s top dishes', async () => {
    const OA = '22222222-2222-4222-8222-2222222222b1', OB = '22222222-2222-4222-8222-2222222222b2';
    const va = await newVenue(OA, 'top-dish-a'), vb = await newVenue(OB, 'top-dish-b');
    const X = randomUUID();
    await as(w.url, OA, async (c) => {
      const s = (await c.query(`insert into public.sections (venue_id, name_en) values ($1, 'Food') returning id`, [va])).rows[0].id;
      await c.query(`insert into public.dishes (id, venue_id, section_id, name_en, price) values ($1, $2, $3, 'Soup', 3000)`, [X, va, s]);
    });
    const day = (await w.admin.query(`select app.local_date(now(), time_zone) as d from public.venues where id = $1`, [va])).rows[0].d;
    await w.admin.query(`insert into public.rollups_day (venue_id, day, name, key, demo, n) values ($1, $2, 'dish_viewed', '', false, 40), ($1, $2, 'dish_viewed', 'dish:' || $3, false, 40)`,
      [va, day, X]);
    const top = async () => (await rpc(w.url, OA, 'my_dashboard', { p_venue: va, p_range: 'today' })).topDishes;
    assert.deepEqual((await top()).map((d) => [d.dishId, d.name.en, d.views]), [[X, 'Soup', 40]]);
    await q(w.url, OA, `delete from public.dishes where id = $1`, [X]);
    const sb = (await w.admin.query(`insert into public.sections (venue_id, name_en) values ($1, 'Food') returning id`, [vb])).rows[0].id;
    const made = await q(w.url, OB, `insert into public.dishes (id, venue_id, section_id, name_en, price) values ($1, $2, $3, 'Call 050-0000000 to verify your account', 100) returning id`, [X, vb, sb]);
    assert.equal(made.length, 1, 'another venue may hold the id now');
    assert.deepEqual(await top(), [], 'its name never appears here');
    assert.deepEqual((await rpc(w.url, OA, 'my_dashboard', { p_venue: va, p_range: '7d' })).topDishes, []);
  });
});

describe('the via labels of the staff RPCs (simulator follow-up)', () => {
  test('invites, joins, lead reads and lead updates say rpc', async () => {
    const X = '22222222-2222-4222-8222-2222222222a5';
    const since = (await w.admin.query(`select coalesce(max(id), 0) as id from public.activity_log`)).rows[0].id;
    await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'via-check@example.invalid', now())`, [X]);
    const inv = await rpc(w.url, U.admin, 'create_staff_invite', { p_email: 'via-check@example.invalid' });
    assert.equal((await rpc(w.url, X, 'redeem_staff_invite', { p_code: inv.code })).ok, true);
    await rpc(w.url, U.support, 'ops_leads');
    const lead = await rpc(w.url, 'anon', 'submit_lead', { p_token: '55555555-5555-4555-8555-555555555555', p_message: 'A menu please', p_contact: 'via@example.invalid', p_elapsed_ms: 5000 });
    assert.equal(lead.ok, true);
    const id = (await rpc(w.url, U.support, 'ops_leads')).leads[0].id;
    await rpc(w.url, U.support, 'ops_update_lead', { p_id: id, p_status: 'contacted' });
    const { rows } = await w.admin.query(`select action, via from public.activity_log where action in ('staff_invite.create', 'staff.join', 'staff.insert', 'leads.read', 'leads.update')
      and id > $1 order by id`, [since]);
    assert.deepEqual([...new Set(rows.map((r) => r.action))].sort(), ['leads.read', 'leads.update', 'staff.insert', 'staff.join', 'staff_invite.create']);
    assert.ok(rows.every((r) => r.via === 'rpc'), JSON.stringify(rows));
    await w.admin.query(`delete from public.staff where user_id = $1`, [X]);
  });
});

describe('the access model after phase 1', () => {
  test('app.audit_grants() and app.unindexed_foreign_keys() find nothing; the audit notices a widened service-role column', async () => {
    assert.deepEqual((await w.admin.query('select * from app.audit_grants()')).rows, []);
    assert.deepEqual((await w.admin.query('select * from app.unindexed_foreign_keys()')).rows, []);
    await w.admin.query(`begin; grant update (parsed) on public.menu_imports to service_role; alter table public.dishes add column test_ref uuid references public.sections (id)`);
    const drift = (await w.admin.query('select * from app.audit_grants()')).rows;
    const loose = (await w.admin.query('select tbl, cols from app.unindexed_foreign_keys()')).rows;
    await w.admin.query('rollback');
    assert.deepEqual(drift, [{ problem: 'unexpected', grantee: 'service_role', object: 'public.menu_imports.parsed', privilege: 'UPDATE' }]);
    assert.deepEqual(loose, [{ tbl: 'public.dishes', cols: 'test_ref' }]);
  });

  test('every action the database logged in these tests is on the contracts\' closed list', async () => {
    const { rows } = await w.admin.query(`select distinct action from public.activity_log order by 1`);
    const unknown = rows.map((r) => r.action).filter((a) => !ACTIVITY_ACTIONS.includes(a));
    assert.deepEqual(unknown, []);
    assert.ok(rows.length >= 15);
  });
});
