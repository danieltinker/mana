// Smoke test against the REAL schema (db/0001_core.sql) in a throwaway PostgreSQL 16 started just for this run.
// It checks the things the stub only imitates: the exact JSON shape of ops_overview(), the staff gate (SQLSTATE 42501),
// the invite code, and that the arguments this page sends to ops_set_entitlement / ops_update_lead are accepted.
// No HTTP layer here (PostgREST/GoTrue are not started): calls run as the "authenticated" role with JWT claims set,
// which is what PostgREST does. Usage: node test/real-sql.mjs
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { derive, planRequest, leadPatch, businessesCsv, leadsCsv } from '../src/model.js';
import { HOSTILE } from './fixtures.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MENUS = path.resolve(HERE, '../..');
const PGBIN = process.env.PGBIN || '/usr/lib/postgresql/16/bin';
const DIR = path.join(HERE, '.pg'); const DATA = path.join(DIR, 'data'); const PORT = 54777;
const OSUSER = process.env.STACK_OS_USER || 'claude';
const root = process.getuid() === 0;
const as = (cmd, args) => (root ? ['runuser', ['-u', OSUSER, '--', cmd, ...args]] : [cmd, args]);
const sh = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts }); if (r.status !== 0 && !opts.allowFail) throw new Error(`${cmd} failed:\n${r.stdout}\n${r.stderr}`); return r; };
const psqlArgs = ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-h', '127.0.0.1', '-p', String(PORT), '-U', 'postgres', '-d', 'postgres'];
const sql = (text, opts) => sh(path.join(PGBIN, 'psql'), [...psqlArgs, '-c', text], opts).stdout.trim();
const file = (f) => sh(path.join(PGBIN, 'psql'), [...psqlArgs, '-f', f]);
const lit = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
// one RPC, the way PostgREST runs it: role + JWT claims for the transaction, named arguments
function rpc(uid, role, fn, args = {}) {
  const named = Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}`).join(', ');
  const text = `begin; set local role ${role}; select set_config('request.jwt.claims', ${lit(JSON.stringify(uid ? { sub: uid, role } : { role }))}, true) is null; select public.${fn}(${named}); commit;`;
  const r = sh(path.join(PGBIN, 'psql'), [...psqlArgs, '-c', text], { allowFail: true });
  if (r.status !== 0) { const m = /ERROR:\s+(\w{5}):\s+(.*)/.exec(r.stderr) || []; return { error: { code: m[1], message: m[2] } }; }
  const out = r.stdout.trim().split('\n').slice(1).join('\n');
  try { return { data: JSON.parse(out) }; } catch { return { data: out === 't' ? true : out === 'f' ? false : out }; }
}

fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
if (root) sh('chown', ['-R', OSUSER, DIR]);
sh(...as(path.join(PGBIN, 'initdb'), ['-D', DATA, '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C.UTF-8']));
const [c, a] = as(path.join(PGBIN, 'postgres'), ['-D', DATA, '-p', String(PORT), '-k', DIR, '-c', 'listen_addresses=127.0.0.1', '-c', 'fsync=off']);
const pg = spawn(c, a, { stdio: 'ignore' });
let failed = false;
try {
  for (let i = 0; ; i++) { if (sh(path.join(PGBIN, 'pg_isready'), ['-h', '127.0.0.1', '-p', String(PORT)], { allowFail: true }).status === 0) break; if (i > 100) throw new Error('postgres did not start'); await new Promise((r) => setTimeout(r, 100)); }
  file(path.join(MENUS, 'studio/test/stack/bootstrap.sql'));
  // GoTrue normally creates auth.users; only the columns the schema reads are needed here
  sql(`create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, last_sign_in_at timestamptz, created_at timestamptz default now()); grant select on auth.users to postgres;`);
  file(path.join(MENUS, 'studio/test/stack/after-auth.sql'));
  file(path.join(MENUS, 'db/0001_core.sql'));

  const U = { staff: '11111111-1111-4111-8111-111111111111', a: '22222222-2222-4222-8222-222222222222', b: '33333333-3333-4333-8333-333333333333', lone: '44444444-4444-4444-8444-444444444444', newbie: '55555555-5555-4555-8555-555555555555' };
  sql(`insert into auth.users (id, email, last_sign_in_at) values ('${U.staff}', 'staff@halom.test', now()), ('${U.a}', 'noa@juno.test', now() - interval '2 hours'), ('${U.b}', 'b@owners.test', now() - interval '6 days'), ('${U.lone}', 'lone@x.test', null), ('${U.newbie}', 'newbie@halom.test', now());
       insert into public.staff (user_id, note) values ('${U.staff}', 'seed');
       insert into public.staff_invites (code_hash, note) values (encode(extensions.digest('SMOKE-CODE-123', 'sha256'), 'hex'), 'smoke');`);

  // ---- the gate, on the first day: nothing exists yet
  assert.equal(rpc(U.newbie, 'authenticated', 'is_staff').data, false);
  assert.deepEqual(rpc(U.newbie, 'authenticated', 'ops_overview').error, { code: '42501', message: 'not_staff' });
  assert.equal(rpc(null, 'anon', 'ops_overview').error.code, '42501', 'anonymous callers are refused');
  assert.equal(rpc(null, 'anon', 'is_staff').error.code, '42501');
  assert.deepEqual(rpc(U.newbie, 'authenticated', 'redeem_staff_invite', { p_code: 'wrong' }).data, { ok: false, code: 'invalid' });
  assert.equal(rpc(U.newbie, 'authenticated', 'is_staff').data, false);
  const day0 = rpc(U.staff, 'authenticated', 'ops_overview').data;
  assert.deepEqual(Object.keys(day0).sort(), ['accountsWithoutBusiness', 'businesses', 'generatedAt', 'leads', 'signupsByDay', 'viewsByDay']);
  assert.deepEqual([day0.businesses, day0.leads, day0.viewsByDay, day0.signupsByDay], [[], [], [], []]);
  assert.equal(day0.accountsWithoutBusiness, 4, 'every account without a business that is not staff (owners a, b, lone, newbie)');
  const d0 = derive(day0);
  assert.deepEqual([d0.kpi.businesses, d0.kpi.live, d0.kpi.views7, d0.funnel[0].value], [0, 0, 0, 4]);

  // ---- real owner actions: create, fill, publish, a diner opens the menu
  const mk = (uid, slug, he, en, kind, contact, phone) => rpc(uid, 'authenticated', 'create_business', { p_slug: slug, p_name_he: he, p_name_en: en, p_kind: kind, p_contact_name: contact, p_contact_phone: phone }).data;
  const juno = mk(U.a, 'smoke-juno', 'ג׳ונו', 'Juno', 'restaurant', 'נועה לוי', '054-202-2269');
  const beach = mk(U.a, 'smoke-beach', '', 'Juno Beach', 'bar', null, null);
  const xss = mk(U.b, 'smoke-xss', 'ביסטרו <b>x</b>', '<img src=x onerror=alert(1)>', 'bakery', '=HYPERLINK("http://evil.example","o")', '+972-54-000-0000');
  const old = mk(U.b, 'smoke-old', 'ישן', '', 'cafe', null, null);
  for (const r of [juno, beach, xss, old]) assert.equal(r.ok, true, JSON.stringify(r));
  sql(`set session_replication_role = replica;
       insert into public.categories (id, business_id, name_he) values ('aaaaaaaa-0000-4000-8000-000000000001', '${juno.id}', 'ראשונות'), ('aaaaaaaa-0000-4000-8000-000000000002', '${old.id}', 'קפה');
       insert into public.assets (id, business_id, status, kind, color_path, thumb_path) values
         ('bbbbbbbb-0000-4000-8000-000000000001', '${juno.id}', 'approved', 'photo', '${juno.id}/x/color.jpg', '${juno.id}/x/thumb.jpg'),
         ('bbbbbbbb-0000-4000-8000-000000000002', '${juno.id}', 'ready_for_review', 'relief', null, null),
         ('bbbbbbbb-0000-4000-8000-000000000003', '${juno.id}', 'failed', 'relief', null, null),
         ('bbbbbbbb-0000-4000-8000-000000000004', '${juno.id}', 'failed', 'relief', null, null);
       insert into public.items (business_id, category_id, name_he, price_minor, asset_id) values
         ('${juno.id}', 'aaaaaaaa-0000-4000-8000-000000000001', 'חומוס', 3200, 'bbbbbbbb-0000-4000-8000-000000000001'),
         ('${juno.id}', 'aaaaaaaa-0000-4000-8000-000000000001', 'סלט', 2800, null),
         ('${old.id}', 'aaaaaaaa-0000-4000-8000-000000000002', 'אספרסו', 900, null);
       set session_replication_role = origin;`);
  assert.equal(rpc(U.a, 'authenticated', 'publish_menu', { p_business: juno.id, p_note: 'first' }).data.ok, true);
  assert.equal(rpc(U.b, 'authenticated', 'publish_menu', { p_business: old.id, p_note: null }).data.ok, true);
  for (let i = 0; i < 3; i++) assert.equal(rpc(null, 'anon', 'public_menu', { p_slug: 'smoke-juno' }).data.state, 'ok');
  // "old": created 10 days ago, its trial ran out yesterday; "xss": untouched for 5 days
  sql(`set session_replication_role = replica;
       update public.entitlements set trial_ends_at = now() - interval '1 day' where business_id = '${old.id}';
       update public.businesses set created_at = now() - interval '10 days', updated_at = now() - interval '5 days' where id in ('${old.id}', '${xss.id}');
       update public.menus set updated_at = now() - interval '5 days' where business_id = '${xss.id}';
       set session_replication_role = origin;`);
  assert.equal(rpc(null, 'anon', 'public_menu', { p_slug: 'smoke-old' }).data.state, 'unavailable');

  // ---- enquiries through the real public function, hostile ones included (the database accepts them)
  const tok = (n) => `cccccccc-0000-4000-8000-00000000000${n}`;
  const leadArgs = (n, o) => ({ p_token: tok(n), p_dream: o.dream, p_contact: o.contact, p_name: o.name ?? null, p_package: o.pkg ?? null, p_source: o.source ?? 'menus-landing', p_locale: o.locale ?? null, p_page: o.page ?? null, p_hp: '', p_elapsed_ms: 5000 });
  const sent = [
    { dream: 'מסעדה בתל אביב, רוצים תפריט תלת־ממדי.', contact: 'ariel@hakosem.test', name: 'אריאל', pkg: 'menus', locale: 'he', page: 'https://halom.io/mana/' },
    { dream: HOSTILE.img + ' ' + HOSTILE.script, contact: HOSTILE.svgMail, name: '<b onmouseover=alert(1)>Bob</b>', pkg: 'dream', page: HOSTILE.jsUrl },
    { dream: HOSTILE.formula, contact: '-1234567@evil.example', name: HOSTILE.plus, source: HOSTILE.at },
    { dream: 'Normal ‮reversed‬ text', contact: 'user‮@moc.elpmaxe.test', name: HOSTILE.rlo },
    { dream: 'Phone only', contact: '054-202-2269' },
  ].map((o, i) => rpc(null, 'anon', 'submit_lead', leadArgs(i + 1, o)).data);
  assert.ok(sent.every((r) => r.ok === true && /^HL-\d{4}-\d{4}$/.test(r.ref)), JSON.stringify(sent));

  // ---- what the back office receives, through this page's own model
  const raw = rpc(U.staff, 'authenticated', 'ops_overview').data;
  const d = derive(raw);
  const by = Object.fromEntries(d.businesses.map((b) => [b.slug, b]));
  const want = ['id', 'slug', 'name_he', 'name_en', 'kind', 'area_he', 'area_en', 'created_at', 'contact_name', 'contact_phone', 'phone', 'owner_email', 'last_sign_in_at', 'categories', 'items',
    'items_with_picture', 'assets', 'last_asset_at', 'first_published_at', 'last_published_at', 'live', 'revisions', 'plan', 'plan_status', 'plan_state', 'trial_started_at', 'trial_ends_at',
    'current_period_end', 'plan_note', 'views_total', 'views_7d', 'last_activity_at'];
  assert.deepEqual(Object.keys(raw.businesses[0]).sort(), [...want].sort(), 'the field list this page was written against');
  assert.deepEqual(Object.keys(raw.leads[0]).sort(), ['contact', 'created_at', 'dream', 'id', 'locale', 'name', 'next_action', 'next_action_on', 'notes', 'owner', 'package', 'page', 'ref', 'source', 'status']);
  assert.equal(raw.accountsWithoutBusiness, 2, 'lone + newbie');
  assert.deepEqual(d.kpi, { accountsWithoutBusiness: 2, businesses: 4, withItems: 2, withApproved: 1, published: 2, live: 1, trialSoon: 0, planOff: 1, views7: 3, newLeads: 5, stalled: 1, attention: 3 });
  const j = by['smoke-juno'];
  assert.deepEqual([j.stage, j.liveNow, j.items, j.itemsWithPicture, j.categories, j.revisions, j.views7, j.viewsTotal, j.plan, j.planState, j.daysLeft, j.ownerEmail, j.contactName],
    ['live', true, 2, 1, 1, 1, 3, 3, 'trial', 'trialing', 30, 'noa@juno.test', 'נועה לוי']);
  assert.deepEqual(j.pics, { approved: 1, review: 1, working: 0, failed: 2, rejected: 0, waiting: 1 });
  assert.deepEqual(j.attention.map((x) => x.id), ['failed']);
  assert.deepEqual([by['smoke-beach'].stage, by['smoke-beach'].planState, by['smoke-beach'].ownerEmail], ['created', 'pending', 'noa@juno.test']);
  assert.deepEqual([by['smoke-xss'].stage, by['smoke-xss'].base, by['smoke-xss'].idleDays], ['stalled', 'created', 5]);
  assert.deepEqual([by['smoke-old'].stage, by['smoke-old'].planState, by['smoke-old'].offlineWhy, by['smoke-old'].liveFlag], ['published', 'expired', 'plan expired', true]);
  assert.deepEqual(d.funnel.map((s) => s.value), [6, 4, 2, 1, 2, 1]);
  assert.equal(d.views.at(-1).value, 3); assert.equal(d.signups.reduce((s, x) => s + x.value, 0), 4);
  assert.equal(d.leads.length, 5); assert.ok(d.leads.every((l) => l.status === 'new'));
  assert.ok(!/(^|,)"[=+\-@]/m.test(leadsCsv(d.leads)) && !/(^|,)"[=+\-@]/m.test(businessesCsv(d.businesses, {})));

  // ---- plan change with exactly the arguments the drawer sends
  const req = planRequest(j, 'pilot', '2027-01-31', false, 'פיילוט עד סוף ינואר');
  assert.deepEqual(rpc(U.staff, 'authenticated', 'ops_set_entitlement', req.args).data, { ok: true });
  assert.equal(rpc(U.newbie, 'authenticated', 'ops_set_entitlement', req.args).error.code, '42501');
  let after = derive(rpc(U.staff, 'authenticated', 'ops_overview').data).businesses.find((b) => b.id === j.id);
  assert.deepEqual([after.plan, after.planState, new Date(after.endsAt).toISOString(), after.planNote], ['pilot', 'active', '2027-01-31T21:59:59.000Z', 'פיילוט עד סוף ינואר']);
  assert.deepEqual(rpc(U.staff, 'authenticated', 'ops_set_entitlement', planRequest(after, 'suspend', '', false, '').args).data, { ok: true });
  after = derive(rpc(U.staff, 'authenticated', 'ops_overview').data).businesses.find((b) => b.id === j.id);
  assert.deepEqual([after.plan, after.planState, after.stage, after.offlineWhy, after.planNote], ['pilot', 'suspended', 'published', 'plan suspended', 'פיילוט עד סוף ינואר']);
  assert.equal(rpc(null, 'anon', 'public_menu', { p_slug: 'smoke-juno' }).data.state, 'unavailable');
  const o = by['smoke-old'];
  assert.deepEqual(rpc(U.staff, 'authenticated', 'ops_set_entitlement', planRequest(o, 'extend', '2027-02-10', false, '').args).data, { ok: true });
  const o2 = derive(rpc(U.staff, 'authenticated', 'ops_overview').data).businesses.find((b) => b.id === o.id);
  assert.deepEqual([o2.planState, o2.stage, new Date(o2.trialEnds).toISOString()], ['trialing', 'live', '2027-02-10T21:59:59.000Z']);
  assert.deepEqual(rpc(U.staff, 'authenticated', 'ops_set_entitlement', { ...req.args, p_business: '99999999-9999-4999-8999-999999999999' }).data, { ok: false, code: 'no_business' });

  // ---- lead edit with exactly the arguments the table sends
  const lead = d.leads.find((l) => l.contact === 'ariel@hakosem.test');
  const p1 = leadPatch(lead, { status: 'qualified', owner: 'Daniel', nextAction: 'לשלוח הצעת מחיר', nextOn: '2026-10-12', notes: 'Line one\nשורה שתיים' });
  assert.deepEqual(rpc(U.staff, 'authenticated', 'ops_update_lead', p1.args).data, { ok: true });
  let l2 = derive(rpc(U.staff, 'authenticated', 'ops_overview').data).leads.find((l) => l.id === lead.id);
  assert.deepEqual([l2.status, l2.owner, l2.nextAction, l2.nextOn, l2.notes], ['qualified', 'Daniel', 'לשלוח הצעת מחיר', '2026-10-12', 'Line one\nשורה שתיים']);
  const p2 = leadPatch(l2, { owner: '', status: 'scoped' });               // clearing a text field = sending ''
  assert.deepEqual(rpc(U.staff, 'authenticated', 'ops_update_lead', p2.args).data, { ok: true });
  l2 = derive(rpc(U.staff, 'authenticated', 'ops_overview').data).leads.find((l) => l.id === lead.id);
  assert.deepEqual([l2.status, l2.owner, l2.nextAction, l2.nextOn], ['scoped', '', 'לשלוח הצעת מחיר', '2026-10-12'], 'untouched fields are kept');
  assert.equal(rpc(U.staff, 'authenticated', 'ops_update_lead', { ...p2.args, p_status: 'won' }).error.code, '23514', 'an unknown status is refused by the check constraint');
  assert.equal(rpc(U.newbie, 'authenticated', 'ops_update_lead', p2.args).error.code, '42501');
  assert.deepEqual(rpc(U.staff, 'authenticated', 'ops_update_lead', { ...p2.args, p_id: '99999999-9999-4999-8999-999999999999' }).data, { ok: false, code: 'no_lead' });

  // ---- the one-time code
  assert.deepEqual(rpc(U.newbie, 'authenticated', 'redeem_staff_invite', { p_code: ' SMOKE-CODE-123 ' }).data, { ok: true });
  assert.equal(rpc(U.newbie, 'authenticated', 'is_staff').data, true);
  assert.deepEqual(rpc(U.lone, 'authenticated', 'redeem_staff_invite', { p_code: 'SMOKE-CODE-123' }).data, { ok: false, code: 'invalid' }, 'a used code is dead');
  assert.equal(rpc(U.newbie, 'authenticated', 'ops_overview').data.businesses.length, 4);

  fs.writeFileSync(path.join(HERE, 'real-overview.sample.json'), JSON.stringify(raw, null, 1));

  // ---- optional: the SQL this lane proposes (proposed/0002_ops_additions.sql), on top of the real schema
  if (process.argv.includes('--proposal')) {
    file(path.resolve(HERE, '../proposed/0002_ops_additions.sql'));
    const S = (fn, args) => rpc(U.staff, 'authenticated', fn, args);
    assert.deepEqual(S('ops_patch_lead', { p_id: lead.id, p_patch: JSON.stringify({ next_action_on: null, owner: 'Maya' }) }).data, { ok: true });
    l2 = derive(S('ops_overview').data).leads.find((l) => l.id === lead.id);
    assert.deepEqual([l2.nextOn, l2.owner, l2.status, l2.nextAction], ['', 'Maya', 'scoped', 'לשלוח הצעת מחיר'], 'the date is cleared, the rest is kept');
    assert.deepEqual(S('ops_patch_lead', { p_id: lead.id, p_patch: JSON.stringify({ status: 'won' }) }).data, { ok: false, code: 'bad_status' });
    assert.deepEqual(S('ops_patch_lead', { p_id: lead.id, p_patch: JSON.stringify({ next_action_on: 'tomorrow' }) }).data, { ok: false, code: 'bad_date' });
    assert.deepEqual(S('ops_patch_lead', { p_id: lead.id, p_patch: JSON.stringify({ next_action_on: '2026-02-30' }) }).data, { ok: false, code: 'bad_date' });
    assert.deepEqual(S('ops_patch_lead', { p_id: lead.id, p_patch: JSON.stringify({ next_action_on: '2026-11-01', notes: '' }) }).data, { ok: true });
    assert.equal(rpc(U.lone, 'authenticated', 'ops_patch_lead', { p_id: lead.id, p_patch: '{}' }).error.code, '42501');
    assert.equal(rpc(null, 'anon', 'ops_patch_lead', { p_id: lead.id, p_patch: '{}' }).error.code, '42501');
    const x = S('ops_overview_extra').data;
    assert.deepEqual([x.accountsTotal, x.leadsTotal, x.accountsByDay.length, Object.keys(x.lastViewDay)], [3, 5, 1, [juno.id]]);
    assert.equal(rpc(U.lone, 'authenticated', 'ops_overview_extra').error.code, '42501');
    assert.deepEqual(S('ops_set_entitlement', { ...req.args, p_plan: 'gold' }).data, { ok: false, code: 'bad_plan' });
    assert.deepEqual(S('ops_set_entitlement', req.args).data, { ok: true });
    const log = S('ops_business_log', { p_business: juno.id }).data;
    assert.deepEqual([log.length, log[0].action, log[0].staff, log[0].detail.plan, log[0].detail.before.status], [1, 'set_entitlement', 'staff@halom.test', 'pilot', 'suspended']);
    assert.equal(rpc(U.a, 'authenticated', 'ops_business_log', { p_business: juno.id }).error.code, '42501', 'an owner cannot read the log');
    assert.match(sql(`begin; set local role authenticated; select count(*) from public.ops_log; commit;`, { allowFail: true }) || 'denied', /denied|^$/);
    console.log('proposal SQL: applied and checked');
  }
  console.log('real SQL smoke: all checks passed (PostgreSQL ' + sql('show server_version') + ', db/0001_core.sql)');
} catch (e) { failed = true; console.error('real SQL smoke FAILED\n', e); } finally {
  sh(...as(path.join(PGBIN, 'pg_ctl'), ['stop', '-D', DATA, '-m', 'immediate', '-w']), { allowFail: true });
  pg.kill('SIGTERM');
  fs.rmSync(DIR, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
