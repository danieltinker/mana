// The QA and security review of 15 Oct 2026, item by item (M = must fix, L = low, m = minor), on a fresh cluster.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { as, q, rpc } from './harness/cluster.mjs';
import { A, count, ID, U, world } from './harness/world.mjs';
import { isBlankChar, lintSnapshotV2, nextOpening, validateSnapshotV2 } from '../../packages/contracts/src/index.ts';
import { cafeDemo, mutable } from '../../packages/contracts/test/fixtures.ts';

let w;
before(async () => { w = await world(); });
after(async () => { await w?.stop(); });

const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
let n = 0;
const uid = () => `00000000-0000-4000-9100-${String(++n).padStart(12, '0')}`;
const view = (venueId = w.B) => ({ id: uid(), name: 'dish_viewed', venueId, at: iso(Date.now() - 1000), props: { dishId: venueId === w.B ? w.b.dish : ID.burger } });
const track = (batch, headers) => as(w.url, 'anon', async (c) => {
  await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify(headers)]);
  return (await c.query('select public.track_events($1::jsonb) as r', [JSON.stringify(batch)])).rows[0].r;
});
const setCfg = (key, value) => w.admin.query(`update public.app_config set value = $2::jsonb where key = $1`, [key, JSON.stringify(value)]);
const cfg = async (key) => (await w.admin.query(`select value from public.app_config where key = $1`, [key])).rows[0].value;
const withCfg = async (key, value, fn) => { const old = await cfg(key); await setCfg(key, value); try { return await fn(); } finally { await setCfg(key, old); } };
const addUser = async (id, email, confirmed = true) =>
  w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, ${confirmed ? 'now()' : 'null'})`, [id, email]);

describe('M1: one definition of blank', () => {
  test('the database and the contracts agree on every code point up to U+3100 and U+FE00–U+FFFF', async () => {
    const { rows } = await w.admin.query(`select array_agg(cp order by cp) as cps from generate_series(1, 65533) cp
      where (cp <= 12544 or cp >= 65024) and cp not between 55296 and 57343 and chr(cp) ~ ('^' || app.blank_class() || '$')`);
    const ts = [];
    for (let cp = 1; cp <= 65533; cp++) if ((cp <= 12544 || cp >= 65024) && !(cp >= 0xd800 && cp <= 0xdfff) && isBlankChar(String.fromCodePoint(cp))) ts.push(cp);
    assert.deepEqual(rows[0].cps, ts);
    assert.ok(ts.length >= 40);
  });

  test('names and descriptions are stripped on write; a name of blanks only is refused', async () => {
    const blanks = ' ﻿​‏ 　\t ‮⁠';     // ten kinds
    const d = await as(w.url, U.ownerA, async (c) => (await c.query(`insert into public.dishes (venue_id, section_id, name_he, name_en, desc_en)
      values ($1, $2, $3, $4, $5) returning name_he, name_en, desc_en`, [A, ID.mains, `${blanks}טוסט${blanks}`, ' Toast‎', '​Crisp bread.﻿'])).rows[0]);
    assert.deepEqual(d, { name_he: 'טוסט', name_en: 'Toast', desc_en: 'Crisp bread.' });
    for (const [table, cols, vals] of [
      ['dishes', '(venue_id, section_id, name_he, name_en)', [A, ID.mains, blanks, ' ']],
      ['sections', '(venue_id, name_he, name_en)', [A, blanks, '‏‎']],
      ['addon_groups', '(venue_id, name_he, name_en)', [A, '﻿', blanks]],
    ]) {
      const r = await q(w.url, U.ownerA, `insert into public.${table} ${cols} values (${vals.map((_, i) => '$' + (i + 1)).join(', ')})`, vals);
      assert.equal(r.error?.code, '23514', table);
    }
    assert.equal((await q(w.url, U.ownerA, `update public.venues set name_he = $2, name_en = $3 where id = $1`, [A, blanks, ' '])).error?.code, '23514');
  });

  test('both validators: a snapshot name of blanks is name_missing, with ten kinds of space', async () => {
    for (const b of [' ', '﻿', '​', '‏', ' ', '　', '\t', ' ', '‮', '⁠']) {
      const s = mutable(cafeDemo());
      s.sections[1].dishes[0].name = { he: b, en: b + b };
      s.addonGroups[0].options[0].name = { he: '', en: b };
      const ts = validateSnapshotV2(s);
      const sql = (await w.admin.query('select app.validate_snapshot($1::jsonb) as e', [JSON.stringify(s)])).rows[0].e;
      assert.deepEqual(sql.map((e) => `${e.code}@${e.path}`).sort(), (ts.ok ? [] : ts.errors.map((e) => `${e.code}@${e.path}`)).sort(), `U+${b.codePointAt(0).toString(16)}`);
      assert.equal(sql.length, 2);
    }
  });
});

describe('M2: a "basket has" condition never becomes unconditional', () => {
  const ruleWith = (venue, has) => w.admin.query(`insert into public.upsell_rules (venue_id, label, trigger, scope_kind, basket_has_dishes, basket_has_sections,
    basket_lacks_sections, suggest_kind, suggest_dish_id, line_en) values ($1, 'has-test', 'add', 'all', $2, $3, $4, 'dish', $5, 'x') returning id`,
    [venue, has.dishes ?? [], has.sections ?? [], has.lacks ?? [], has.suggest ?? ID.lemonade]).then((r) => r.rows[0].id);
  const preview = () => rpc(w.url, U.ownerA, 'preview_menu', { p_venue: A });

  test('hidden dish target: the rule is left out of the snapshot and named in the warnings', async () => {
    const r = await ruleWith(A, { dishes: [ID.fridayCake] });
    await w.admin.query(`update public.dishes set hidden = true where id = $1`, [ID.fridayCake]);
    const p = await preview();
    assert.deepEqual(p.issues, []);
    assert.ok(!p.snapshot.upsellRules.some((x) => x.id === r));
    assert.deepEqual(p.warnings.filter((x) => x.id === r), [{ code: 'rule_left_out', path: 'upsellRules', id: r, reason: 'basket_has_empty', label: 'has-test' }]);
    const pub = await rpc(w.url, U.ownerA, 'publish_menu', { p_venue: A });
    assert.ok(pub.warnings.some((x) => x.id === r && x.reason === 'basket_has_empty'), 'publish returns the warning too');
    await w.admin.query(`update public.dishes set hidden = false where id = $1`, [ID.fridayCake]);
    const back = await preview();
    assert.deepEqual(back.snapshot.upsellRules.find((x) => x.id === r).basketHas, { dishes: [ID.fridayCake], sections: [] });
    await w.admin.query(`delete from public.upsell_rules where id = $1`, [r]);
  });

  test('hidden section target: same', async () => {
    const r = await ruleWith(A, { sections: [ID.pastries] });
    await w.admin.query(`update public.sections set hidden = true where id = $1`, [ID.pastries]);
    const p = await preview();
    assert.ok(!p.snapshot.upsellRules.some((x) => x.id === r));
    assert.ok(p.warnings.some((x) => x.id === r && x.reason === 'basket_has_empty'));
    await w.admin.query(`update public.sections set hidden = false where id = $1`, [ID.pastries]);
    await w.admin.query(`delete from public.upsell_rules where id = $1`, [r]);
  });

  test('a partly hidden list keeps the condition with what is left; "no condition" is null', async () => {
    const r = await ruleWith(A, { dishes: [ID.fridayCake, ID.burger] });
    await w.admin.query(`update public.dishes set hidden = true where id = $1`, [ID.fridayCake]);
    const s = (await preview()).snapshot;
    assert.deepEqual(s.upsellRules.find((x) => x.id === r).basketHas, { dishes: [ID.burger], sections: [] });
    assert.equal(s.upsellRules.find((x) => x.id === ID.ruleCheese).basketHas, null);
    await w.admin.query(`update public.dishes set hidden = false where id = $1`, [ID.fridayCake]);
    await w.admin.query(`delete from public.upsell_rules where id = $1`, [r]);
  });

  test('a "lacks" condition whose targets are all hidden is no condition (the basket can never hold them)', async () => {
    const r = await ruleWith(A, { lacks: [ID.pastries], suggest: ID.burger });
    await w.admin.query(`update public.sections set hidden = true where id = $1`, [ID.pastries]);
    const rule = (await preview()).snapshot.upsellRules.find((x) => x.id === r);
    assert.equal(rule.basketLacks, null);
    await w.admin.query(`update public.sections set hidden = false where id = $1`, [ID.pastries]);
    await w.admin.query(`delete from public.upsell_rules where id = $1`, [r]);
  });

  test('deleting the last dish or section of a "has" list switches the rule off, logged', async () => {
    const ids = await as(w.url, U.ownerB, async (c) => {
      const d = (await c.query(`insert into public.dishes (venue_id, section_id, name_en, price) values ($1, $2, 'Bread', 900) returning id`, [w.B, w.b.section])).rows[0].id;
      const s2 = (await c.query(`insert into public.sections (venue_id, name_en) values ($1, 'Sweets') returning id`, [w.B])).rows[0].id;
      await c.query(`insert into public.dishes (venue_id, section_id, name_en, price) values ($1, $2, 'Cake', 2200)`, [w.B, s2]);
      return { d, s2 };
    });
    const r1 = await ruleWith(w.B, { dishes: [ids.d], suggest: w.b.dish });
    const r2 = await ruleWith(w.B, { sections: [ids.s2], suggest: w.b.dish });
    const r3 = await ruleWith(w.B, { dishes: [ids.d, w.b.dish], suggest: w.b.dish });
    await as(w.url, U.ownerB, async (c) => {
      await c.query(`delete from public.dishes where id = $1`, [ids.d]);
      await c.query(`delete from public.sections where id = $1`, [ids.s2]);
    });
    const { rows } = await w.admin.query(`select id, active, basket_has_dishes, basket_has_sections from public.upsell_rules where id = any ($1) order by label, id`, [[r1, r2, r3]]);
    const by = Object.fromEntries(rows.map((x) => [x.id, x]));
    assert.equal(by[r1].active, false);
    assert.equal(by[r2].active, false);
    assert.deepEqual([by[r3].active, by[r3].basket_has_dishes], [true, [w.b.dish]], 'one target left: still a condition');
    const log = await w.admin.query(`select target_ids, detail from public.activity_log where venue_id = $1 and action = 'upsell_rules.deactivated' order by id`, [w.B]);
    assert.deepEqual(log.rows.map((x) => [x.target_ids, x.detail.reason, x.detail.deleted]), [[[r1], 'basket_has_emptied', 'dish'], [[r2], 'basket_has_emptied', 'section']]);
    assert.ok(!(await rpc(w.url, U.ownerB, 'preview_menu', { p_venue: w.B })).snapshot.upsellRules.some((x) => [r1, r2].includes(x.id)));
    await w.admin.query(`delete from public.upsell_rules where id = any ($1)`, [[r1, r2, r3]]);
  });

  test('both validators refuse an empty condition list', async () => {
    const s = mutable(cafeDemo());
    s.upsellRules[0].basketHas = { dishes: [], sections: [] };
    const ts = validateSnapshotV2(s);
    const sql = (await w.admin.query('select app.validate_snapshot($1::jsonb) as e', [JSON.stringify(s)])).rows[0].e;
    assert.deepEqual(sql, [{ code: 'rule_condition_empty', path: 'upsellRules[0].basketHas' }]);
    assert.deepEqual(ts.ok ? [] : ts.errors, sql);
  });
});

describe('M1 (security): the request source and the caps', () => {
  test('rotating the leftmost X-Forwarded-For does not make a new source', async () => {
    await withCfg('event_caps', { per_source_hour: 3, per_venue_source_day: 1000, per_venue_day: 50000 }, async () => {
      let accepted = 0, capped = 0;
      for (let i = 0; i < 6; i++) {
        const r = await track([view()], { 'x-forwarded-for': `198.51.100.${i}, 203.0.113.99` });
        accepted += r.accepted; capped += r.capped;
      }
      assert.deepEqual([accepted, capped], [3, 3]);
    });
  });

  test('cf-connecting-ip wins over x-real-ip and X-Forwarded-For; x-real-ip over X-Forwarded-For', async () => {
    assert.equal((await q(w.url, 'anon', 'select app.request_source()')).error?.code, '42501', 'not callable by guests');
    // compared through the admin connection, with the headers PostgREST would set
    const s = async (h) => (await w.admin.query(`select set_config('request.headers', $1, false), app.request_source() as s`, [JSON.stringify(h)])).rows[0].s;
    const a = await s({ 'cf-connecting-ip': '192.0.2.1', 'x-forwarded-for': '10.0.0.1, 192.0.2.50' });
    assert.equal(await s({ 'cf-connecting-ip': '192.0.2.1', 'x-forwarded-for': '10.9.9.9, 192.0.2.51', 'x-real-ip': '192.0.2.77' }), a);
    const b = await s({ 'x-real-ip': '192.0.2.77', 'x-forwarded-for': '1.1.1.1, 192.0.2.52' });
    assert.equal(await s({ 'x-real-ip': '192.0.2.77', 'x-forwarded-for': '2.2.2.2, 192.0.2.53' }), b);
    assert.equal(await s({ 'x-forwarded-for': '3.3.3.3, 192.0.2.60' }), await s({ 'x-forwarded-for': '4.4.4.4,192.0.2.60' }), 'the last hop counts');
    assert.notEqual(await s({ 'x-forwarded-for': '3.3.3.3, 192.0.2.60' }), await s({ 'x-forwarded-for': '3.3.3.3, 192.0.2.61' }));
    await w.admin.query(`select set_config('request.headers', '', false)`);
    const salts = await w.admin.query(`select day, salt from app.source_salts`);
    assert.equal(salts.rows.length, 1, 'one random salt for today');
    assert.match(salts.rows[0].salt, /^[0-9a-f]{48}$/);
  });

  test('a per-(venue, source) daily cap', async () => {
    await withCfg('event_caps', { per_source_hour: 1000, per_venue_source_day: 4, per_venue_day: 50000 }, async () => {
      const r = await track(Array.from({ length: 6 }, () => view()), { 'cf-connecting-ip': '192.0.2.200' });
      assert.deepEqual([r.accepted, r.capped], [4, 2]);
      const other = await track([view()], { 'cf-connecting-ip': '192.0.2.201' });
      assert.equal(other.accepted, 1);
    });
  });

  test('when a venue passes its daily cap the day is flagged, not silently low', async () => {
    await withCfg('event_caps', { per_source_hour: 1000, per_venue_source_day: 1000, per_venue_day: 1 }, async () => {
      const r = await track([view(), view(), view()], { 'cf-connecting-ip': '192.0.2.210' });
      assert.equal(r.capped, 3, 'earlier tests already used today\'s single event');
    });
    const { rows } = await w.admin.query(`select dropped::int from app.event_capped_days where venue_id = $1`, [w.B]);
    assert.equal(rows[0].dropped, 3);
    const d = await rpc(w.url, U.ownerB, 'my_dashboard', { p_venue: w.B, p_range: 'today' });
    assert.equal(d.days[0].capped, true);
    assert.equal(d.capped[0].dropped, 3);
    const o = (await rpc(w.url, U.support, 'ops_overview')).venues.find((x) => x.id === w.B);
    assert.equal(o.cappedToday, true);
    assert.ok(o.warnings.includes('events_capped'));
  });

  test('leads: suspected spam is kept as spam (never refused), out of the default view; a hard ceiling stops a flood', async () => {
    const lead = (i, extra = {}) => as(w.url, 'anon', async (c) => {
      await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify({ 'cf-connecting-ip': '192.0.2.150' })]);
      return (await c.query(`select public.submit_lead(p_token => $1, p_message => 'We want a menu', p_contact => $2, p_elapsed_ms => $3, p_hp => $4) as r`,
        [`33333333-3333-4333-8333-${String(i).padStart(12, '0')}`, `owner${i}@example.invalid`, extra.ms ?? 5000, extra.hp ?? ''])).rows[0].r;
    });
    const out = [];
    for (let i = 1; i <= 6; i++) out.push(await lead(i));
    out.push(await lead(7, { hp: 'http://spam.example' }));
    assert.ok(out.every((r) => r.ok === true), 'a real visitor is never told no');
    const statuses = (await w.admin.query(`select status, count(*)::int as n from public.leads where contact like 'owner%' group by 1 order by 1`)).rows;
    assert.deepEqual(statuses, [{ status: 'new', n: 5 }, { status: 'spam', n: 2 }]);
    const def = await rpc(w.url, U.support, 'ops_leads');
    assert.ok(def.leads.every((l) => l.status !== 'spam'));
    assert.equal((await rpc(w.url, U.support, 'ops_leads', { p_status: 'spam' })).count, 2);
    await withCfg('lead_caps', { per_source_hour: 5, hard_day: 3 }, async () => {
      assert.deepEqual(await lead(8), { ok: false, code: 'rate_limited' });
    });
  });
});

describe('M2 (security): rollups carry an opaque key', () => {
  test('the primary key of both rollup tables is a uuid named id; the natural key is a unique constraint', async () => {
    for (const t of ['rollups_minute', 'rollups_day']) {
      const { rows } = await w.admin.query(`select a.attname, format_type(a.atttypid, a.atttypmod) as type from pg_index i
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey) where i.indrelid = $1::regclass and i.indisprimary`, [`public.${t}`]);
      assert.deepEqual(rows, [{ attname: 'id', type: 'uuid' }], t);
      const u = await w.admin.query(`select pg_get_constraintdef(oid) as d from pg_constraint where conrelid = $1::regclass and contype = 'u'`, [`public.${t}`]);
      assert.equal(u.rows.length, 1);
      assert.match(u.rows[0].d, /^UNIQUE \(venue_id, (bucket|day), name, key, demo\)$/);
      const ri = await w.admin.query(`select relreplident from pg_class where oid = $1::regclass`, [`public.${t}`]);
      assert.equal(ri.rows[0].relreplident, 'd', 'a DELETE payload carries the primary key only');
    }
    const { rows } = await w.admin.query(`select pubname from pg_publication_tables where tablename in ('rollups_minute', 'rollups_day')`);
    assert.equal(rows.length, 2);
  });
});

describe('M3 (security): staff invites and MFA', () => {
  const V = '11111111-1111-4111-8111-1111111111c1';
  before(async () => { await addUser(V, 'invitee@example.invalid'); });

  test('a short code is refused before any lookup; five failures a day lock the person out', async () => {
    const inv = await rpc(w.url, U.admin, 'create_staff_invite', { p_email: 'invitee@example.invalid' });
    for (const code of ['short', 'x'.repeat(31), 'y'.repeat(40), 'z'.repeat(64), 'w'.repeat(32)]) {
      assert.deepEqual(await rpc(w.url, V, 'redeem_staff_invite', { p_code: code }), { ok: false, code: 'invalid' });
    }
    assert.deepEqual(await rpc(w.url, V, 'redeem_staff_invite', { p_code: inv.code }), { ok: false, code: 'locked' }, 'even the right code, today');
    await w.admin.query(`delete from app.staff_invite_failures where user_id = $1`, [V]);
    assert.deepEqual(await rpc(w.url, V, 'redeem_staff_invite', { p_code: inv.code }), { ok: true, role: 'support' });
    await w.admin.query(`delete from public.staff where user_id = $1`, [V]);
  });

  test('an unconfirmed e-mail cannot redeem; an expired invite is invalid', async () => {
    const X = '11111111-1111-4111-8111-1111111111c2';
    await addUser(X, 'unconfirmed@example.invalid', false);
    const inv = await rpc(w.url, U.admin, 'create_staff_invite', { p_email: 'unconfirmed@example.invalid' });
    assert.deepEqual(await rpc(w.url, X, 'redeem_staff_invite', { p_code: inv.code }), { ok: false, code: 'email_unconfirmed' });
    const old = await rpc(w.url, U.admin, 'create_staff_invite', { p_email: 'invitee@example.invalid' });
    await w.admin.query(`update public.staff_invites set expires_at = now() - interval '1 minute' where email = 'invitee@example.invalid' and used_at is null`);
    assert.deepEqual(await rpc(w.url, V, 'redeem_staff_invite', { p_code: old.code }), { ok: false, code: 'invalid' });
    assert.equal((await w.admin.query(`select count(*)::int as n from public.staff_invites where email !~ '^[^@]+@[^@]+$'`)).rows[0].n, 0);
  });

  test('with staff_require_aal2 on, staff count as staff only in an MFA session', async () => {
    await withCfg('staff_require_aal2', true, async () => {
      assert.equal((await rpc(w.url, U.support, 'ops_overview')).error?.code, '42501', 'aal1');
      assert.equal(await count(w.url, U.support, 'select 1 from public.venues where id = $1', [w.B]), 0, 'and no cross-venue reads');
      assert.ok(Array.isArray((await rpc(w.url, { sub: U.support, aal: 'aal2' }, 'ops_overview')).venues), 'aal2');
      assert.equal((await rpc(w.url, { sub: U.support, aal: 'aal1' }, 'act_for_owner', { p_venue: A, p_reason: 'test', p_action: 'availability.restore', p_payload: {} })).error?.code, '42501');
    });
    assert.ok(Array.isArray((await rpc(w.url, U.support, 'ops_overview')).venues), 'off again (the default until the back office has its MFA screen)');
  });
});

describe('M4 (security): Halom approves the first publish; owners need a confirmed e-mail', () => {
  test('pending review: published but unavailable, no events; approval starts the trial and is logged for the owner', async () => {
    const O = '11111111-1111-4111-8111-1111111111d1';
    await addUser(O, 'reviewed-owner@example.invalid');
    const v = (await rpc(w.url, O, 'create_venue', { p_slug: 'needs-review', p_name_en: 'Needs Review' })).id;
    await as(w.url, O, async (c) => {
      const s = (await c.query(`insert into public.sections (venue_id, name_en) values ($1, 'Food') returning id`, [v])).rows[0].id;
      await c.query(`insert into public.dishes (venue_id, section_id, name_en, price) values ($1, $2, 'Soup', 3000)`, [v, s]);
    });
    const pub = await rpc(w.url, O, 'publish_menu', { p_venue: v });
    assert.equal(pub.review, 'pending');
    assert.equal((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'needs-review' })).state, 'unavailable');
    assert.deepEqual((await w.admin.query(`select status from public.entitlements where venue_id = $1`, [v])).rows[0], { status: 'pending' }, 'no trial yet');
    assert.deepEqual((await track([{ ...view(), venueId: v, props: { dishId: '00000000-0000-4000-8000-00000000ffff' } }], {})).rejected[0].code, 'venue_unknown');
    assert.equal((await rpc(w.url, 'anon', 'ops_approve_venue', { p_venue: v, p_reason: 'x' })).error?.code, '42501');
    assert.equal((await rpc(w.url, O, 'ops_approve_venue', { p_venue: v, p_reason: 'approving myself' })).error?.code, '42501');
    assert.deepEqual(await rpc(w.url, U.support, 'ops_approve_venue', { p_venue: v, p_reason: '' }), { ok: false, code: 'reason_required' });
    const ok = await rpc(w.url, U.support, 'ops_approve_venue', { p_venue: v, p_reason: 'Menu and photos checked' });
    assert.equal(ok.ok, true);
    assert.equal((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'needs-review' })).state, 'ok');
    assert.equal((await w.admin.query(`select status from public.entitlements where venue_id = $1`, [v])).rows[0].status, 'trialing');
    const log = await as(w.url, O, async (c) => (await c.query(`select action, actor_kind, reason from public.activity_log where venue_id = $1 and action = 'venue.approve'`, [v])).rows);
    assert.deepEqual(log, [{ action: 'venue.approve', actor_kind: 'staff', reason: 'Menu and photos checked' }]);
    assert.deepEqual(await rpc(w.url, U.support, 'ops_approve_venue', { p_venue: v, p_reason: 'again' }), { ok: false, code: 'already_approved' });
  });

  test('with approval off, the first publish goes live at once', async () => {
    await withCfg('publish_requires_approval', false, async () => {
      const O = '11111111-1111-4111-8111-1111111111d2';
      await addUser(O, 'direct-owner@example.invalid');
      const v = (await rpc(w.url, O, 'create_venue', { p_slug: 'goes-live', p_name_en: 'Goes Live' })).id;
      await as(w.url, O, async (c) => {
        const s = (await c.query(`insert into public.sections (venue_id, name_en) values ($1, 'Food') returning id`, [v])).rows[0].id;
        await c.query(`insert into public.dishes (venue_id, section_id, name_en, price) values ($1, $2, 'Soup', 3000)`, [v, s]);
      });
      assert.equal((await rpc(w.url, O, 'publish_menu', { p_venue: v })).review, 'approved');
      assert.equal((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'goes-live' })).state, 'ok');
    });
  });

  test('create_venue needs a confirmed e-mail (a setting)', async () => {
    const X = '11111111-1111-4111-8111-1111111111d3';
    await addUser(X, 'not-yet@example.invalid', false);
    assert.deepEqual(await rpc(w.url, X, 'create_venue', { p_slug: 'unconfirmed-place', p_name_en: 'x' }), { ok: false, code: 'email_unconfirmed' });
    await withCfg('require_confirmed_email', false, async () => {
      assert.equal((await rpc(w.url, X, 'create_venue', { p_slug: 'unconfirmed-place', p_name_en: 'x' })).ok, true);
    });
  });

  test('eight concurrent create_venue calls by one person: exactly five venues', async () => {
    const O = '11111111-1111-4111-8111-1111111111d4';
    await addUser(O, 'busy-owner@example.invalid');
    const clients = await Promise.all(Array.from({ length: 8 }, async () => { const c = new pg.Client({ connectionString: w.url }); await c.connect(); return c; }));
    try {
      for (const c of clients) {
        await c.query('begin');
        await c.query(`select set_config('request.jwt.claims', $1, true), set_config('role', 'authenticated', true)`, [JSON.stringify({ sub: O, role: 'authenticated' })]);
      }
      const results = await Promise.all(clients.map(async (c, i) => {
        const r = (await c.query(`select public.create_venue($1, '', $2) as r`, [`busy-place-${i}`, `Busy ${i}`])).rows[0].r;
        await c.query('commit');
        return r;
      }));
      assert.equal(results.filter((r) => r.ok).length, 5, JSON.stringify(results));
      assert.equal(results.filter((r) => r.code === 'limit_venues').length, 3);
      assert.equal((await w.admin.query(`select count(*)::int as n from public.venue_members where user_id = $1 and role = 'owner'`, [O])).rows[0].n, 5);
    } finally {
      await Promise.all(clients.map((c) => c.end()));
    }
  });
});

describe('L1: the last owner, under concurrency', () => {
  test('two owners removing each other at once: one succeeds, the other is refused', async () => {
    const O2 = '11111111-1111-4111-8111-1111111111e2';
    await addUser(O2, 'co-owner@example.invalid');
    await w.admin.query(`insert into public.venue_members (venue_id, user_id, role) values ($1, $2, 'owner')`, [w.B, O2]);
    const c1 = new pg.Client({ connectionString: w.url });
    const c2 = new pg.Client({ connectionString: w.url });
    await c1.connect();
    await c2.connect();
    try {
      await c1.query('begin');
      await c1.query(`delete from public.venue_members where venue_id = $1 and user_id = $2`, [w.B, U.ownerB]);
      await c2.query('begin');
      const second = c2.query(`delete from public.venue_members where venue_id = $1 and user_id = $2`, [w.B, O2]).then(() => 'ok', (e) => e.message);
      await new Promise((r) => setTimeout(r, 200));
      await c1.query('rollback');                            // undo, so the rest of the suite keeps venue B's owner
      assert.equal(await second, 'ok', 'once the first is undone the second may go');
      await c2.query('rollback');
      // and when the first commits, the second sees it and is refused
      await c1.query('begin');
      await c1.query(`delete from public.venue_members where venue_id = $1 and user_id = $2`, [w.B, O2]);
      await c2.query('begin');
      const third = c2.query(`delete from public.venue_members where venue_id = $1 and user_id = $2`, [w.B, U.ownerB]).then(() => 'ok', (e) => e.message);
      await new Promise((r) => setTimeout(r, 200));
      await c1.query('commit');
      assert.match(await third, /last_owner/);
      await c2.query('rollback');
      assert.deepEqual((await w.admin.query(`select user_id from public.venue_members where venue_id = $1 and role = 'owner'`, [w.B])).rows, [{ user_id: U.ownerB }]);
    } finally {
      await c1.end();
      await c2.end();
    }
  });
});

describe('L2: picture paths', () => {
  test('the logo and table photo live in the venue\'s own folder, with no "..", "//" or ":"', async () => {
    for (const bad of [`${w.B}/brand/logo.png`, 'other/logo.png', `${A}/../x.png`, `${A}//x.png`, `${A}/a:b.png`, `https://evil.example/${A}/x.png`]) {
      assert.equal((await q(w.url, U.ownerA, `update public.venues set logo_path = $2 where id = $1`, [A, bad])).error?.code, '23514', bad);
      assert.equal((await q(w.url, U.ownerA, `update public.venues set table_img_path = $2 where id = $1`, [A, bad])).error?.code, '23514', bad);
    }
    assert.equal(await count(w.url, U.ownerA, `update public.venues set logo_path = $2 where id = $1`, [A, `${A}/brand/logo-1.png`]), 1);
    const p = await rpc(w.url, U.ownerA, 'preview_menu', { p_venue: A });
    assert.equal(p.snapshot.venue.logo, `${A}/brand/logo-1.png`);
    assert.deepEqual(p.issues, []);
    await as(w.url, U.ownerA, (c) => c.query(`update public.venues set logo_path = null where id = $1`, [A]));
  });

  test('both validators refuse a path with a scheme, "//" or ".."', async () => {
    for (const bad of ['https://x.example/a.jpg', '//x.example/a.jpg', 'a/../b.jpg', '/a.jpg', 'a\\b.jpg']) {
      const s = mutable(cafeDemo());
      s.venue.logo = bad;
      s.sections[1].dishes[0].asset = { state: 'photo', color: bad, thumb: 't.jpg' };
      const ts = validateSnapshotV2(s);
      const sql = (await w.admin.query('select app.validate_snapshot($1::jsonb) as e', [JSON.stringify(s)])).rows[0].e;
      assert.deepEqual(sql.map((e) => e.code).sort(), ['asset_invalid', 'path_invalid'], bad);
      assert.deepEqual(sql.map((e) => `${e.code}@${e.path}`).sort(), (ts.ok ? [] : ts.errors.map((e) => `${e.code}@${e.path}`)).sort(), bad);
    }
  });
});

describe('L3: only what the snapshot shows', () => {
  test('live.off lists only ids in the published snapshot; unused schedules stay out', async () => {
    await w.admin.query(`insert into public.schedules (id, venue_id, kind, name_en, windows) values ('00000000-0000-4000-8000-0000000005c9', $1, 'special', 'Unused', '[{"days":[1],"from":"10:00","to":"11:00"}]')`, [A]);
    await w.admin.query(`update public.dishes set hidden = true where id = $1`, [ID.fridayCake]);
    assert.equal((await rpc(w.url, U.ownerA, 'publish_menu', { p_venue: A })).ok, true);
    await as(w.url, U.ownerA, async (c) => {
      for (const id of [ID.fridayCake, ID.lemonade]) {
        await c.query(`insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec) values ($1, 'dish', $2, 'indefinite', '{"kind":"indefinite"}')`, [A, id]);
      }
    });
    const r = await rpc(w.url, 'anon', 'public_menu', { p_slug: 'cafe-demo' });
    assert.deepEqual(r.live.off.map((o) => o.id), [ID.lemonade], 'the hidden Friday cake is not named');
    assert.deepEqual(r.snapshot.schedules.map((x) => x.id), [ID.breakfast], 'Friday is used only by the hidden cake; "Unused" by nothing');
    await w.admin.query(`update public.availability_overrides set restored_at = now() where venue_id = $1 and restored_at is null`, [A]);
    await w.admin.query(`update public.dishes set hidden = false where id = $1`, [ID.fridayCake]);
    await w.admin.query(`delete from public.schedules where id = '00000000-0000-4000-8000-0000000005c9'`);
    assert.equal((await rpc(w.url, U.ownerA, 'publish_menu', { p_venue: A })).ok, true);
  });
});

describe('L4 and L9: the service role and the grant audit', () => {
  test('the service role reads the records but never writes, truncates, references or triggers them', async () => {
    const { rows } = await w.admin.query(`select c.relname, p.priv from pg_class c join pg_namespace n on n.oid = c.relnamespace
      cross join unnest(array['TRUNCATE', 'REFERENCES', 'TRIGGER']) p(priv)
      where n.nspname = 'public' and c.relkind in ('r', 'p') and has_table_privilege('service_role', c.oid, p.priv)`);
    assert.deepEqual(rows, []);
    for (const t of ['activity_log', 'menu_revisions', 'events', 'rollups_day', 'rollups_minute']) {
      assert.equal((await w.admin.query(`select has_table_privilege('service_role', $1, 'SELECT') as s, has_table_privilege('service_role', $1, 'INSERT')
        or has_table_privilege('service_role', $1, 'UPDATE') or has_table_privilege('service_role', $1, 'DELETE') as w`, [`public.${t}`])).rows[0].w, false, t);
    }
    assert.equal((await q(w.url, 'service', `delete from public.availability_overrides`)).error?.code, '42501');
    assert.equal((await q(w.url, 'service', `insert into public.activity_log (actor_kind, via, action) values ('system', 'system', 'x.y')`)).error?.code, '42501');
    assert.ok((await q(w.url, 'service', `select 1 from public.activity_log limit 1`)).length >= 0);
  });

  test('app.audit_grants() finds nothing outside the intended access model', async () => {
    const { rows } = await w.admin.query('select * from app.audit_grants()');
    assert.deepEqual(rows, []);
    // and it notices drift
    await w.admin.query(`begin; grant select on public.leads to authenticated`);
    const drift = await w.admin.query('select * from app.audit_grants()');
    await w.admin.query('rollback');
    assert.deepEqual(drift.rows, [{ problem: 'unexpected', grantee: 'authenticated', object: 'public.leads', privilege: 'SELECT' }]);
  });
});

describe('L5, L7, L8: logs without words, events once, retention', () => {
  test('availability.set for the owner: the note is not copied into the log', async () => {
    const r = await rpc(w.url, U.support, 'act_for_owner', { p_venue: A, p_reason: 'Owner called', p_action: 'availability.set',
      p_payload: { targetKind: 'dish', targetId: ID.lemonade, until: { kind: 'duration', minutes: 30 }, note: 'Supplier Moshe is late' } });
    assert.equal(r.ok, true);
    const { rows } = await w.admin.query(`select detail from public.activity_log where venue_id = $1 and via = 'act_for_owner' order by id desc limit 2`, [A]);
    assert.ok(!JSON.stringify(rows).includes('Moshe'));
    assert.deepEqual(rows.find((x) => x.detail.action).detail.keys, ['note', 'targetId', 'targetKind', 'until']);
    await w.admin.query(`update public.availability_overrides set restored_at = now() where venue_id = $1 and restored_at is null`, [A]);
  });

  test('onboarding_step_done is emitted once per venue and step', async () => {
    for (const state of ['done', 'todo', 'done', 'todo', 'done']) {
      await as(w.url, U.ownerB, (c) => c.query(`update public.onboarding_progress set state = $2 where venue_id = $1 and step = 'style'`, [w.B, state]));
    }
    const { rows } = await w.admin.query(`select count(*)::int as n from public.events where venue_id = $1 and name = 'onboarding_step_done' and props->>'step' = 'style'`, [w.B]);
    assert.equal(rows[0].n, 1);
  });

  test('daily maintenance: old salts, lead hashes and event partitions go', async () => {
    await w.admin.query(`insert into app.source_salts (day, salt) values (current_date - 5, repeat('ab', 24)) on conflict do nothing`);
    await w.admin.query(`update public.leads set created_at = now() - interval '8 days' where contact = 'owner1@example.invalid'`);
    await w.admin.query(`select app.ensure_event_partitions(1)`);
    // an old month: a partition two years back, as if the retention period had passed
    await w.admin.query(`create table app.events_y2024m01 partition of public.events for values from ('2024-01-01 00:00+00') to ('2024-02-01 00:00+00')`);
    const r = (await w.admin.query('select app.daily_maintenance() as r')).rows[0].r;
    assert.equal(r.ok, true);
    assert.ok(r.salts >= 1 && r.leadHashes >= 1 && r.partitions >= 1, JSON.stringify(r));
    assert.equal((await w.admin.query(`select count(*)::int as n from app.source_salts where day < current_date - 1`)).rows[0].n, 0);
    assert.equal((await w.admin.query(`select source_hash from public.leads where contact = 'owner1@example.invalid'`)).rows[0].source_hash, null);
    assert.equal((await w.admin.query(`select to_regclass('app.events_y2024m01') as t`)).rows[0].t, null);
    assert.ok((await w.admin.query(`select count(*)::int as n from pg_inherits where inhparent = 'public.events'::regclass`)).rows[0].n >= 3, 'recent months stay');
    assert.equal((await w.admin.query(`select count(*)::int as n from public.activity_log where action = 'leads.update' and detail->'columns' ? 'source_hash'`)).rows[0].n, 0, 'forgetting is not activity');
  });
});

describe('QA m3, m4, m5 and the RPCs that must survive the cutover', () => {
  test('the database refuses a dish that loosens its group\'s limits', async () => {
    const r = await q(w.url, U.ownerA, `update public.dish_addon_groups set min_units = 0 where dish_id = $1 and group_id = $2`, [ID.burger, ID.side]);
    assert.match(r.error?.message ?? '', /limits_loosened/);
    const r2 = await q(w.url, U.ownerA, `update public.dish_addon_groups set max_units = 3 where dish_id = $1 and group_id = $2`, [ID.schnitzel, ID.side]);
    assert.match(r2.error?.message ?? '', /single_max/);
    assert.equal(await count(w.url, U.ownerA, `update public.dish_addon_groups set min_units = 1, max_units = 2 where dish_id = $1 and group_id = $2`, [ID.burger, ID.extras]), 1, 'tightening is fine');
    // the group is later tightened past the dish's own limit: the snapshot clamps instead of publishing a looser limit
    await w.admin.query(`update public.addon_groups set min_units = 2 where id = $1`, [ID.extras]);
    const s = (await rpc(w.url, U.ownerA, 'preview_menu', { p_venue: A })).snapshot;
    assert.deepEqual(s.sections[1].dishes[0].addons[1], { groupId: ID.extras, min: 2, max: 2 });
    await w.admin.query(`update public.addon_groups set min_units = 0 where id = $1`, [ID.extras]);
    await w.admin.query(`update public.dish_addon_groups set min_units = null, max_units = null where dish_id = $1 and group_id = $2`, [ID.burger, ID.extras]);
  });

  test('lint warnings agree between the database and the contracts', async () => {
    const variants = [
      (s) => s,
      (s) => { s.upsellRules[0].suggest = { kind: 'dish', dishId: ID.espresso }; },
      (s) => { s.upsellRules[1].scope = { kind: 'dish', ids: [ID.schnitzel] }; },
      (s) => { s.upsellRules[1].scope = { kind: 'section', ids: [ID.drinks] }; },
      (s) => { s.upsellRules[1].scope = { kind: 'all' }; },
      (s) => { s.upsellRules[2].scope = { kind: 'dish', ids: [ID.lemonade, ID.burger] }; },
    ];
    for (const [i, change] of variants.entries()) {
      const s = mutable(cafeDemo());
      change(s);
      const sql = (await w.admin.query('select app.lint_snapshot($1::jsonb) as l', [JSON.stringify(s)])).rows[0].l;
      assert.deepEqual(sql, lintSnapshotV2(s), `variant ${i}`);
    }
  });

  test('one live import per input: the same text twice is refused until the first is discarded', async () => {
    const ins = () => q(w.url, U.ownerB, `insert into public.menu_imports (venue_id, source, raw_text, input_sha256)
      values ($1, 'paste', 'Soup 38', encode(extensions.digest('Soup 38', 'sha256'), 'hex')) returning id`, [w.B]);
    const first = await ins();
    assert.ok(!first.error);
    assert.equal((await ins()).error?.code, '23505');
    await as(w.url, U.ownerB, (c) => c.query(`update public.menu_imports set status = 'discarded' where id = $1`, [first[0].id]));
    assert.ok(!(await ins()).error, 'after discarding, the same input may come again');
  });

  test('next_opening: no opening within 14 days is null, in the database as in the contracts', async () => {
    await w.admin.query(`insert into public.venue_closures (venue_id, from_date, to_date) values ($1, current_date - 1, current_date + 30)`, [A]);
    const sql = (await w.admin.query(`select app.next_opening($1, now()) as n`, [A])).rows[0].n;
    const { rows: hrs } = await w.admin.query(`select weekday, to_char(opens, 'HH24:MI') as f, to_char(closes, 'HH24:MI') as t from public.venue_hours where venue_id = $1`, [A]);
    const { rows: cl } = await w.admin.query(`select to_char(from_date, 'YYYY-MM-DD') as f, to_char(to_date, 'YYYY-MM-DD') as t from public.venue_closures where venue_id = $1`, [A]);
    const hours = { timeZone: 'Asia/Jerusalem', weekly: hrs.map((h) => ({ days: [h.weekday], from: h.f, to: h.t })), closures: cl.map((c) => ({ from: c.f, to: c.t })) };
    assert.equal(sql, null);
    assert.equal(nextOpening(hours, Date.now()), null);
    await w.admin.query(`delete from public.venue_closures where venue_id = $1`, [A]);
  });

  test('restore_revision and unpublish_menu', async () => {
    const before = (await rpc(w.url, 'anon', 'public_menu', { p_slug: 'bistro-test' })).snapshot.revision;
    await as(w.url, U.ownerB, (c) => c.query(`update public.dishes set price = 4100 where id = $1`, [w.b.dish]));
    const pub = await rpc(w.url, U.ownerB, 'publish_menu', { p_venue: w.B });
    assert.equal((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'bistro-test' })).snapshot.sections[0].dishes[0].price.amount, 4100);
    assert.equal((await rpc(w.url, U.counterA, 'restore_revision', { p_venue: A, p_revision: 1 })).code, 'not_allowed');
    assert.deepEqual(await rpc(w.url, U.ownerB, 'restore_revision', { p_venue: w.B, p_revision: 999 }), { ok: false, code: 'no_revision' });
    const r = await rpc(w.url, U.ownerB, 'restore_revision', { p_venue: w.B, p_revision: before });
    assert.equal(r.ok, true);
    const back = (await rpc(w.url, 'anon', 'public_menu', { p_slug: 'bistro-test' })).snapshot;
    assert.equal(back.revision, before);
    assert.notEqual(back.sections[0].dishes[0].price.amount, 4100);
    assert.deepEqual(await rpc(w.url, U.ownerB, 'unpublish_menu', { p_venue: w.B }), { ok: true });
    assert.deepEqual(await rpc(w.url, 'anon', 'public_menu', { p_slug: 'bistro-test' }), { state: 'unavailable', venue: { name: { he: 'ביסטרו טסט', en: 'Bistro Test' } } });
    assert.equal((await rpc(w.url, U.ownerB, 'restore_revision', { p_venue: w.B, p_revision: pub.revision })).ok, true);
    assert.equal((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'bistro-test' })).state, 'ok');
    const log = (await w.admin.query(`select action from public.activity_log where venue_id = $1 and action like 'menu.%' order by id`, [w.B])).rows.map((x) => x.action);
    assert.deepEqual(log.slice(-4), ['menu.publish', 'menu.restore', 'menu.unpublish', 'menu.restore']);
  });

  test('ops_set_plan: staff only, with a reason the owner sees; a dead plan makes the menu unavailable', async () => {
    assert.equal((await rpc(w.url, U.ownerB, 'ops_set_plan', { p_venue: w.B, p_state: 'active', p_reason: 'self-service' })).error?.code, '42501');
    assert.deepEqual(await rpc(w.url, U.support, 'ops_set_plan', { p_venue: w.B, p_state: 'active' }), { ok: false, code: 'reason_required' });
    assert.deepEqual(await rpc(w.url, U.support, 'ops_set_plan', { p_venue: w.B, p_state: 'free_forever', p_reason: 'x x x' }), { ok: false, code: 'state_invalid' });
    assert.deepEqual(await rpc(w.url, U.support, 'ops_set_plan', { p_venue: w.B, p_state: 'suspended', p_reason: 'Owner asked to pause' }), { ok: true, state: 'suspended' });
    assert.equal((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'bistro-test' })).state, 'unavailable');
    const until = new Date(Date.now() + 30 * 86400_000).toISOString();
    assert.deepEqual(await rpc(w.url, U.support, 'ops_set_plan', { p_venue: w.B, p_state: 'active', p_until: until, p_reason: 'Pilot agreed', p_plan: 'pilot' }), { ok: true, state: 'active' });
    assert.equal((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'bistro-test' })).state, 'ok');
    const log = await as(w.url, U.ownerB, async (c) => (await c.query(`select reason, detail from public.activity_log where venue_id = $1 and action = 'plan.set' order by id`, [w.B])).rows);
    assert.deepEqual(log.map((x) => [x.reason, x.detail.state]), [['Owner asked to pause', 'suspended'], ['Pilot agreed', 'active']]);
  });
});
