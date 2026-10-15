// Row-level security and grants: every rule of 20261015120500_access.sql, exercised as the role that would break it.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { as, q, rpc } from './harness/cluster.mjs';
import { A, count, ID, U, world } from './harness/world.mjs';

let w;
before(async () => { w = await world(); });
after(async () => { await w?.stop(); });

const MENU_TABLES = ['schedules', 'sections', 'dishes', 'assets', 'addon_groups', 'addon_options', 'dish_addon_groups', 'dish_relations',
  'upsell_rules', 'venue_hours', 'venue_closures', 'availability_overrides'];
const RECORD_TABLES = ['menu_revisions', 'activity_log', 'onboarding_progress', 'menu_imports', 'support_cases', 'entitlements', 'rollups_day', 'rollups_minute'];

describe('the schema itself', () => {
  test('RLS is on for every table in public and app, including every event partition', async () => {
    const { rows } = await w.admin.query(`select n.nspname || '.' || c.relname as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname in ('public', 'app') and c.relkind in ('r', 'p') and not c.relrowsecurity`);
    assert.deepEqual(rows, []);
  });

  test('anon has no table privilege at all; authenticated has none on app_config, staff_invites, events, leads writes', async () => {
    const { rows } = await w.admin.query(`select table_schema || '.' || table_name || ':' || privilege_type as p from information_schema.role_table_grants
      where grantee = 'anon' and table_schema in ('public', 'app')`);
    assert.deepEqual(rows, []);
    for (const t of ['public.app_config', 'public.staff_invites', 'public.events', 'app.event_ids', 'app.rollup_queue']) {
      assert.equal(await count(w.url, U.ownerA, `select 1 from ${t} limit 1`), '42501', t);
    }
    assert.equal(await count(w.url, U.support, `insert into public.leads (ref, client_token, message, contact) values ('x', gen_random_uuid(), 'hello', 'a@b.cd')`), '42501');
  });

  test('every SECURITY DEFINER function pins search_path', async () => {
    const { rows } = await w.admin.query(`select n.nspname || '.' || p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app') and p.prosecdef and not coalesce('search_path=""' = any (p.proconfig), false)`);
    assert.deepEqual(rows, []);
    const { rows: all } = await w.admin.query(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app') and p.prosecdef`);
    assert.ok(all[0].n > 40, 'the check looked at the definer functions');
  });

  test('anon may execute exactly public_menu, track_events and submit_lead', async () => {
    const { rows } = await w.admin.query(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app') and has_function_privilege('anon', p.oid, 'execute') order by 1`);
    assert.deepEqual(rows.map((r) => r.proname), ['public_menu', 'submit_lead', 'track_events']);
  });

  test('a signed-in user may execute the phase-1 RPCs and the policy helpers, nothing else', async () => {
    const { rows } = await w.admin.query(`select n.nspname || '.' || p.proname as f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('public', 'app') and has_function_privilege('authenticated', p.oid, 'execute') order by 1`);
    assert.deepEqual(rows.map((r) => r.f), [
      'app.can_edit', 'app.can_operate', 'app.can_read', 'app.can_see_records', 'app.is_member', 'app.is_owner', 'app.is_staff',
      'app.path_venue', 'app.until_spec_ok', 'app.windows_ok',
      'public.act_for_owner', 'public.create_staff_invite', 'public.create_venue', 'public.my_dashboard', 'public.ops_approve_venue',
      'public.ops_leads', 'public.ops_overview', 'public.ops_set_plan', 'public.ops_update_lead', 'public.preview_menu', 'public.public_menu',
      'public.publish_menu', 'public.redeem_staff_invite', 'public.restore_revision', 'public.slug_available', 'public.submit_lead',
      'public.track_events', 'public.unpublish_menu',
    ]);
  });

  test('internal functions in app are not callable by a signed-in user (only the policy helpers are)', async () => {
    for (const f of ["app.publish('" + A + "', 'x')", "app.log('" + A + "', 'x.y')", 'app.build_rollups()', "app.emit('" + A + "', 'menu_published', '{}')"]) {
      const r = await q(w.url, U.ownerA, `select ${f}`);
      assert.equal(r.error?.code, '42501', f);
    }
  });
});

describe('owners: venue A never sees or changes venue B', () => {
  test('reads are limited to their own venue, table by table', async () => {
    for (const t of ['venues', ...MENU_TABLES, ...RECORD_TABLES]) {
      const col = t === 'venues' ? 'id' : 'venue_id';
      const rows = await q(w.url, U.ownerA, `select distinct ${col}::text as v from public.${t}`);
      assert.ok(!rows.error, `${t}: ${rows.error?.message}`);
      assert.ok(rows.every((r) => r.v === A), `${t} leaks: ${JSON.stringify(rows)}`);
    }
    assert.equal(await count(w.url, U.ownerA, 'select 1 from public.venues where id = $1', [w.B]), 0);
    assert.equal(await count(w.url, U.ownerB, 'select 1 from public.dishes where venue_id = $1', [A]), 0);
  });

  test('writes into another venue are refused or touch nothing', async () => {
    assert.equal(await count(w.url, U.ownerA, `update public.dishes set price = 1 where id = $1`, [w.b.dish]), 0);
    assert.equal(await count(w.url, U.ownerA, `delete from public.sections where id = $1`, [w.b.section]), 0);
    assert.equal(await count(w.url, U.ownerA, `update public.venues set name_en = 'Mine' where id = $1`, [w.B]), 0);
    assert.equal(await count(w.url, U.ownerA, `insert into public.sections (venue_id, name_en) values ($1, 'Intruder')`, [w.B]), '42501');
    assert.equal(await count(w.url, U.ownerA, `insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec)
      values ($1, 'dish', $2, 'indefinite', '{"kind":"indefinite"}')`, [w.B, w.b.dish]), '42501');
  });

  test('a row can never point at another venue\'s parent (composite keys)', async () => {
    // owner A inserts into A, but names B's section: the foreign key (venue_id, section_id) refuses
    const r = await count(w.url, U.ownerA, `insert into public.dishes (venue_id, section_id, name_en) values ($1, $2, 'Smuggled')`, [A, w.b.section]);
    assert.equal(r, '23503');
    const r2 = await count(w.url, U.ownerA, `insert into public.dish_addon_groups (venue_id, dish_id, group_id) values ($1, $2, $3)`, [A, ID.burger, w.b.group]);
    assert.equal(r2, '23503');
    const r3 = await count(w.url, U.ownerA, `insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec)
      values ($1, 'dish', $2, 'indefinite', '{"kind":"indefinite"}')`, [A, w.b.dish]);
    assert.equal(r3, 'P0001', 'target_unknown');
  });

  test('the slug is permanent and the venue id fixed', async () => {
    const r = await q(w.url, U.ownerA, `update public.venues set slug = 'renamed' where id = $1`, [A]);
    assert.equal(r.error?.code, '42501', 'no column grant on slug');
    const r2 = await q(w.url, 'service', `update public.venues set slug = 'renamed' where id = $1`, [A]);
    assert.equal(r2.error?.code, '42501', 'the service role writes no venue');
    await assert.rejects(w.admin.query(`update public.venues set slug = 'renamed' where id = $1`, [A]), /slug_permanent/,
      'and the trigger holds for the database owner too');
  });

  test('owners cannot mark their own venue as a demo or change its mode in phase 1', async () => {
    assert.equal((await q(w.url, U.ownerA, `update public.venues set is_demo = false where id = $1`, [A])).error?.code, '42501');
    assert.equal((await q(w.url, U.ownerA, `update public.venues set mode = 'standalone' where id = $1`, [A])).error?.code, '42501');
  });
});

describe('managers and counters', () => {
  test('a manager edits the menu but cannot change the team or Halom\'s access switch', async () => {
    assert.equal(await count(w.url, U.managerA, `update public.dishes set desc_en = 'Crispy' where id = $1`, [ID.schnitzel]), 1);
    assert.equal(await count(w.url, U.managerA, `update public.venue_members set role = 'owner' where venue_id = $1 and user_id = $2`, [A, U.managerA]), 0);
    assert.equal(await count(w.url, U.managerA, `delete from public.venue_members where venue_id = $1 and user_id = $2`, [A, U.counterA]), 0);
    const r = await q(w.url, U.managerA, `update public.venues set support_can_act = false where id = $1`, [A]);
    assert.equal(r.error?.code, '42501');
  });

  test('a counter cannot change a price, or anything else on the menu', async () => {
    assert.equal(await count(w.url, U.counterA, `update public.dishes set price = 1 where id = $1`, [ID.burger]), 0);
    assert.equal(await count(w.url, U.counterA, `update public.addon_options set price = 0 where id = $1`, [ID.chipotle]), 0);
    assert.equal(await count(w.url, U.counterA, `insert into public.sections (venue_id, name_en) values ($1, 'Counter section')`, [A]), '42501');
    assert.equal(await count(w.url, U.counterA, `delete from public.dishes where id = $1`, [ID.lemonade]), 0);
    const { rows } = await w.admin.query('select price from public.dishes where id = $1', [ID.burger]);
    assert.equal(rows[0].price, 6800);
    assert.equal((await rpc(w.url, U.counterA, 'publish_menu', { p_venue: A })).code, 'not_allowed');
  });

  test('a counter reads the menu, not the venue\'s records', async () => {
    assert.ok((await count(w.url, U.counterA, 'select 1 from public.dishes where venue_id = $1', [A])) > 0);
    for (const t of ['menu_revisions', 'activity_log', 'menu_imports', 'support_cases', 'rollups_day', 'entitlements']) {
      assert.equal(await count(w.url, U.counterA, `select 1 from public.${t} where venue_id = $1`, [A]), 0, t);
    }
  });

  test('a counter takes a dish off for two hours and restores it; the log says "counter"', async () => {
    const id = await as(w.url, U.counterA, async (c) => (await c.query(`insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec)
      values ($1, 'dish', $2, 'duration', '{"kind":"duration","minutes":120}') returning id, until_at, created_by_kind`, [A, ID.lemonade])).rows[0]);
    assert.equal(id.created_by_kind, 'counter');
    assert.ok(Math.abs(new Date(id.until_at).getTime() - Date.now() - 2 * 3600_000) < 60_000);
    assert.equal(await count(w.url, U.counterA, `update public.availability_overrides set restored_at = now() where id = $1`, [id.id]), 1);
    // nothing else of an override can change, and overrides are never deleted
    assert.equal((await q(w.url, U.counterA, `update public.availability_overrides set until_at = null where id = $1`, [id.id])).error?.code, '42501');
    assert.equal((await q(w.url, U.ownerA, `delete from public.availability_overrides where id = $1`, [id.id])).error?.code, '42501');
    const { rows } = await w.admin.query(`select actor_kind, via from public.activity_log where venue_id = $1 and action = 'availability_overrides.insert' order by id desc limit 1`, [A]);
    assert.deepEqual(rows[0], { actor_kind: 'counter', via: 'direct' });
  });

  test('a stranger with no venue sees nothing and cannot create rows', async () => {
    for (const t of ['venues', ...MENU_TABLES, ...RECORD_TABLES]) assert.equal(await count(w.url, U.stranger, `select 1 from public.${t}`), 0, t);
    assert.equal(await count(w.url, U.stranger, `insert into public.venue_members (venue_id, user_id, role) values ($1, $2, 'owner')`, [A, U.stranger]), '42501');
  });

  test('a venue always keeps an owner', async () => {
    const r = await q(w.url, U.ownerA, `delete from public.venue_members where venue_id = $1 and user_id = $2`, [A, U.ownerA]);
    assert.match(r.error?.message ?? '', /last_owner/);
  });
});

describe('guests (anon)', () => {
  test('read nothing from tables, only the published snapshot through public_menu', async () => {
    for (const t of ['venues', 'dishes', 'menu_revisions', 'activity_log', 'leads', 'rollups_day']) {
      assert.equal((await q(w.url, 'anon', `select 1 from public.${t} limit 1`)).error?.code, '42501', t);
    }
    const r = await rpc(w.url, 'anon', 'public_menu', { p_slug: 'cafe-demo' });
    assert.equal(r.state, 'ok');
    assert.equal(r.snapshot.v, 2);
  });

  test('a draft is never public: an unpublished change does not reach public_menu', async () => {
    await as(w.url, U.ownerB, (c) => c.query(`update public.dishes set name_en = 'Secret draft name' where id = $1`, [w.b.dish]));
    const r = await rpc(w.url, 'anon', 'public_menu', { p_slug: 'bistro-test' });
    assert.equal(r.state, 'ok');
    assert.ok(!JSON.stringify(r.snapshot).includes('Secret draft name'));
    assert.equal(r.snapshot.sections[0].dishes[0].name.en, 'Soup');
  });

  test('a venue never published, an unknown slug, an expired plan', async () => {
    const made = await rpc(w.url, U.ownerB, 'create_venue', { p_slug: 'bistro-two', p_name_en: 'Bistro Two' });
    assert.equal(made.ok, true);
    assert.deepEqual(await rpc(w.url, 'anon', 'public_menu', { p_slug: 'bistro-two' }), { state: 'not_found' });
    assert.deepEqual(await rpc(w.url, 'anon', 'public_menu', { p_slug: 'no-such-place' }), { state: 'not_found' });
    await w.admin.query(`update public.entitlements set status = 'suspended' where venue_id = $1`, [w.B]);
    const r = await rpc(w.url, 'anon', 'public_menu', { p_slug: 'bistro-test' });
    assert.deepEqual(r, { state: 'unavailable', venue: { name: { he: 'ביסטרו טסט', en: 'Bistro Test' } } });
    await w.admin.query(`update public.entitlements set status = 'trialing' where venue_id = $1`, [w.B]);
  });
});

describe('Halom staff', () => {
  test('support reads across venues', async () => {
    assert.equal(await count(w.url, U.support, 'select 1 from public.venues where id in ($1, $2)', [A, w.B]), 2);
    for (const t of [...MENU_TABLES, 'menu_revisions', 'activity_log', 'onboarding_progress']) {
      const rows = await q(w.url, U.support, `select distinct venue_id::text as v from public.${t}`);
      assert.ok(!rows.error, t);
    }
    assert.ok((await count(w.url, U.support, 'select 1 from public.activity_log where venue_id = $1', [w.B])) > 0);
  });

  test('support cannot write into a venue directly, on any menu table', async () => {
    assert.equal(await count(w.url, U.support, `update public.dishes set price = 1 where id = $1`, [ID.burger]), 0);
    assert.equal(await count(w.url, U.support, `update public.venues set name_en = 'Support was here' where id = $1`, [A]), 0);
    assert.equal(await count(w.url, U.support, `delete from public.dishes where id = $1`, [ID.burger]), 0);
    assert.equal(await count(w.url, U.support, `insert into public.sections (venue_id, name_en) values ($1, 'Support section')`, [A]), '42501');
    assert.equal(await count(w.url, U.support, `insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec)
      values ($1, 'dish', $2, 'indefinite', '{"kind":"indefinite"}')`, [A, ID.burger]), '42501');
    assert.equal(await count(w.url, U.admin, `update public.dishes set price = 1 where id = $1`, [ID.burger]), 0, 'admin too');
    assert.equal((await rpc(w.url, U.support, 'publish_menu', { p_venue: A })).code, 'not_allowed');
  });

  test('owners cannot call staff functions', async () => {
    assert.equal((await rpc(w.url, U.ownerA, 'ops_overview')).error?.code, '42501');
    assert.equal((await rpc(w.url, U.ownerA, 'act_for_owner', { p_venue: A, p_reason: 'I am staff', p_action: 'availability.restore', p_payload: {} })).error?.code, '42501');
    assert.equal((await rpc(w.url, 'anon', 'ops_overview')).error?.code, '42501');
  });

  test('leads are personal data: nobody reads the table; staff read through ops_leads, and every read is logged', async () => {
    const r = await rpc(w.url, 'anon', 'submit_lead', { p_token: '22222222-2222-4222-8222-222222222222', p_message: 'We would like a menu', p_contact: 'owner@example.invalid', p_elapsed_ms: 5000 });
    assert.equal(r.ok, true);
    assert.equal(await count(w.url, U.ownerA, 'select 1 from public.leads'), '42501');
    assert.equal(await count(w.url, U.support, 'select 1 from public.leads'), '42501', 'not even staff, directly');
    assert.equal((await rpc(w.url, U.ownerA, 'ops_leads')).error?.code, '42501');
    const got = await rpc(w.url, U.support, 'ops_leads');
    assert.equal(got.count, 1);
    assert.equal(got.leads[0].contact, 'owner@example.invalid');
    const read = await w.admin.query(`select venue_id, actor_kind, n, detail from public.activity_log where action = 'leads.read' order by id desc limit 1`);
    assert.deepEqual(read.rows[0], { venue_id: null, actor_kind: 'staff', n: 1, detail: { n: 1, status: 'default' } });
    assert.ok(!JSON.stringify(read.rows[0]).includes('owner@example.invalid'));
    assert.deepEqual(await rpc(w.url, 'anon', 'submit_lead', { p_token: '22222222-2222-4222-8222-222222222222', p_message: 'again', p_contact: 'owner@example.invalid', p_elapsed_ms: 5000 }), { ok: true, ref: r.ref }, 'the same form twice');
    // staff work the lead: logged (Halom-wide), without the contact
    const lead = got.leads[0].id;
    assert.deepEqual(await rpc(w.url, U.support, 'ops_update_lead', { p_id: lead, p_status: 'contacted', p_notes: 'called back' }), { ok: true });
    const { rows } = await w.admin.query(`select venue_id, actor_kind, detail from public.activity_log where action = 'leads.update' order by id desc limit 1`);
    assert.equal(rows[0].venue_id, null);
    assert.equal(rows[0].actor_kind, 'staff');
    assert.deepEqual(rows[0].detail.changes, { status: ['new', 'contacted'] });
    assert.ok(!JSON.stringify(rows[0].detail).includes('owner@example.invalid'));
    assert.equal(await count(w.url, U.ownerA, `select 1 from public.activity_log where venue_id is null`), 0, 'owners never see Halom-wide entries');
  });
});

describe('the activity log is append-only', () => {
  test('nobody updates or deletes it: not the owner, not staff, not the database owner', async () => {
    assert.equal((await q(w.url, U.ownerA, `update public.activity_log set reason = 'x' where venue_id = $1`, [A])).error?.code, '42501');
    assert.equal((await q(w.url, U.support, `delete from public.activity_log`)).error?.code, '42501');
    await assert.rejects(w.admin.query(`update public.activity_log set action = 'x.y' where id = (select min(id) from public.activity_log)`), /append_only/);
    await assert.rejects(w.admin.query(`delete from public.activity_log where id = (select min(id) from public.activity_log)`), /append_only/);
    await assert.rejects(w.admin.query(`truncate public.activity_log`), /append_only|cannot truncate/);
    await assert.rejects(w.admin.query(`delete from public.menu_revisions`), /append_only/);
  });

  test('a venue with history cannot be deleted (records are kept); it is archived', async () => {
    await assert.rejects(w.admin.query(`delete from public.venues where id = $1`, [w.B]), /foreign key|violates/);
  });
});

describe('storage', () => {
  test('members write only under their own venue folder; the private bucket is not readable by a counter', async () => {
    const ins = (who, bucket, venue) => count(w.url, who, `insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, `${venue}/x/${Math.random()}.jpg`]);
    assert.equal(await ins(U.ownerA, 'menu-private', A), 1);
    assert.equal(await ins(U.ownerA, 'menu-public', A), 1);
    assert.equal(await ins(U.ownerA, 'menu-private', w.B), '42501');
    assert.equal(await ins(U.counterA, 'menu-public', A), '42501');
    assert.equal(await ins(U.support, 'menu-private', A), '42501');
    assert.equal(await count(w.url, U.counterA, `select 1 from storage.objects where bucket_id = 'menu-private'`), 0);
    assert.ok((await count(w.url, U.support, `select 1 from storage.objects where bucket_id = 'menu-private'`)) >= 1);
    assert.equal(await count(w.url, U.ownerB, `select 1 from storage.objects where bucket_id = 'menu-private'`), 0);
  });
});
