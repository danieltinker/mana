// The import's lifecycle around the reader (ADR-006, ADR-008): create_import, claim_import_scan, discard_import, the
// scanner's (service role's) narrow rights, the raw input nobody reads back, and its purge after the retention period.
// What the reader saves and what applying does (save_import_draft, apply_import) is tested with their SQL twins.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { as, q, rpc } from './harness/cluster.mjs';
import { A, U, world } from './harness/world.mjs';
import { IMPORT_CLIENT_COLUMNS, IMPORT_TEXT_MAX } from '../../packages/contracts/src/index.ts';

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
/** A text[] argument as PostgreSQL reads it (PostgREST turns a JSON array into one; the harness sends objects as JSON). */
const pgArray = (xs) => `{${xs.map((x) => `"${String(x).replace(/["\\]/g, (c) => '\\' + c)}"`).join(',')}}`;
const cfg = async (key) => (await w.admin.query(`select value from public.app_config where key = $1`, [key])).rows[0].value;
const setCfg = (key, value) => w.admin.query(`update public.app_config set value = $2::jsonb where key = $1`, [key, JSON.stringify(value)]);
const withCfg = async (key, value, fn) => { const old = await cfg(key); await setCfg(key, value); try { return await fn(); } finally { await setCfg(key, old); } };
/** Setup only: moves a row's clock back without the triggers (they would refuse or touch updated_at). */
const raw = async (sql, params = []) => {
  await w.admin.query('set session_replication_role = replica');
  try { return (await w.admin.query(sql, params)).rows; } finally { await w.admin.query('set session_replication_role = default'); }
};
const row = async (id) => (await w.admin.query(`select * from public.menu_imports where id = $1`, [id])).rows[0];
const paste = (who, venue, text) => rpc(w.url, who, 'create_import', { p_venue: venue, p_source: 'paste', p_text: text });
let shaN = 0;
const sha = () => (++shaN).toString(16).padStart(64, 'a');
/** Screenshots: the client makes the import's id, uploads under <venue>/imports/<id>/, then creates the import. */
const scan = (who, venue, files = 1, extra = {}) => {
  const id = randomUUID();
  return rpc(w.url, who, 'create_import', { p_venue: venue, p_source: 'scan', p_import_id: id,
    p_paths: pgArray(Array.from({ length: files }, (_, i) => `${venue}/imports/${id}/page-${i}.jpg`)), p_input_sha256: sha(), ...extra });
};
const clearImports = () => w.admin.query(`delete from public.menu_imports where venue_id in ($1, $2)`, [A, w.B]);

describe('create_import', () => {
  test('owners and managers; not a counter, another venue, Halom (it helps through act_for_owner) or a guest', async () => {
    assert.deepEqual(await whoMay('create_import', { p_venue: A, p_source: 'paste', p_text: 'Soup 38' }), {
      anon: '42501', stranger: '42501', ownerA: 'ok', managerA: 'ok', counterA: '42501', ownerB: '42501', support: '42501', admin: '42501',
    });
    await clearImports();
  });

  test('a text is stored stripped and hashed by the database; the same input again is the same import; logged without it', async () => {
    const a = await paste(U.ownerB, w.B, '  Lentil soup 38\n\nGreen salad 42  \n');
    assert.deepEqual([a.ok, a.status, a.reused], [true, 'uploaded', false]);
    const r = await row(a.importId);
    assert.equal(r.raw_text, 'Lentil soup 38\n\nGreen salad 42');
    assert.equal(r.input_sha256, (await w.admin.query(`select encode(extensions.digest($1, 'sha256'), 'hex') as h`, [r.raw_text])).rows[0].h);
    assert.deepEqual([r.created_by, r.rights_confirmed, r.raw_paths, r.parsed, r.raw_purged_at], [U.ownerB, false, [], null, null]);
    const b = await paste(U.ownerB, w.B, 'Lentil soup 38\n\nGreen salad 42');
    assert.deepEqual([b.importId, b.reused, b.status], [a.importId, true, 'uploaded']);
    const log = (await w.admin.query(`select actor_kind, via, n, detail from public.activity_log where venue_id = $1 and action = 'menu_imports.insert' order by id desc limit 1`, [w.B])).rows[0];
    assert.deepEqual([log.actor_kind, log.via, log.n], ['owner', 'rpc', 1]);
    assert.ok(!JSON.stringify(log.detail).includes('Lentil'));
    assert.equal((await w.admin.query(`select count(*)::int as n from public.activity_log where venue_id = $1 and action = 'menu_imports.insert'`, [w.B])).rows[0].n, 1,
      'the reuse wrote nothing');
    assert.equal((await rpc(w.url, U.ownerB, 'discard_import', { p_import: a.importId })).ok, true);
    const c = await paste(U.ownerB, w.B, 'Lentil soup 38\n\nGreen salad 42');
    assert.deepEqual([c.reused, c.importId === a.importId], [false, false], 'a discarded import frees its input');
  });

  test('screenshots: the import takes the client\'s id, its files lie in its own folder; only Wolt screenshots carry the rights', async () => {
    const s = await scan(U.ownerA, A, 2);
    assert.equal(s.ok, true, JSON.stringify(s));
    assert.deepEqual((await row(s.importId)).raw_paths, [`${A}/imports/${s.importId}/page-0.jpg`, `${A}/imports/${s.importId}/page-1.jpg`]);
    const id = randomUUID();
    const wolt = await rpc(w.url, U.ownerA, 'create_import', { p_venue: A, p_source: 'wolt_screenshots', p_import_id: id,
      p_paths: pgArray([`${A}/imports/${id}/wolt.png`]), p_input_sha256: sha(), p_rights_confirmed: true });
    assert.deepEqual([wolt.ok, wolt.importId], [true, id]);
    assert.equal((await row(wolt.importId)).rights_confirmed, true);
    const other = randomUUID();
    const again = await rpc(w.url, U.managerA, 'create_import', { p_venue: A, p_source: 'scan', p_import_id: other,
      p_paths: pgArray([`${A}/imports/${other}/other-name.jpg`]), p_input_sha256: (await row(s.importId)).input_sha256 });
    assert.deepEqual([again.importId, again.reused], [s.importId, true], 'the same files (by hash) are the same import');
    const retry = await rpc(w.url, U.ownerA, 'create_import', { p_venue: A, p_source: 'wolt_screenshots', p_import_id: id,
      p_paths: pgArray([`${A}/imports/${id}/wolt.png`]), p_input_sha256: (await row(id)).input_sha256, p_rights_confirmed: true });
    assert.deepEqual([retry.importId, retry.reused], [id, true], 'a retry after a lost answer');
    const taken = await rpc(w.url, U.ownerA, 'create_import', { p_venue: A, p_source: 'scan', p_import_id: id,
      p_paths: pgArray([`${A}/imports/${id}/new.jpg`]), p_input_sha256: sha() });
    assert.deepEqual(taken, { ok: false, code: 'id_taken' }, 'another input under an id already used');
    const textId = randomUUID();
    const t = await rpc(w.url, U.ownerA, 'create_import', { p_venue: A, p_source: 'paste', p_text: 'Tea 12', p_import_id: textId });
    assert.equal(t.importId, textId, 'a text import may name its id too');
  });

  test('every code, the validator\'s first', async () => {
    const code = async (args) => (await rpc(w.url, U.ownerA, 'create_import', { p_venue: A, ...args })).code;
    const I = randomUUID();
    const dir = `${A}/imports/${I}`;
    const img = (paths, extra = {}) => code({ p_source: 'scan', p_import_id: I, p_paths: pgArray(paths), p_input_sha256: sha(), ...extra });
    assert.equal(await code({ p_source: 'pdf', p_text: 'x' }), 'enum_invalid');
    assert.equal(await code({ p_source: 'paste', p_text: ' \n\t ' }), 'text_missing');
    assert.equal(await code({ p_source: 'paste' }), 'text_missing');
    assert.equal(await code({ p_source: 'wolt_text', p_text: 'x'.repeat(IMPORT_TEXT_MAX + 1) }), 'text_too_long');
    assert.equal((await code({ p_source: 'wolt_text', p_text: String.fromCodePoint(0x1f354).repeat(IMPORT_TEXT_MAX) })), undefined, 'code points, not UTF-16 units');
    assert.equal(await code({ p_source: 'paste', p_text: 'Soup', p_paths: pgArray([`${dir}/a.jpg`]) }), 'input_mismatch');
    assert.equal(await code({ p_source: 'paste', p_text: 'Soup', p_rights_confirmed: true }), 'rights_invalid');
    assert.equal(await code({ p_source: 'scan', p_import_id: I, p_input_sha256: sha() }), 'paths_missing');
    assert.equal(await img([]), 'paths_missing');
    assert.equal(await code({ p_source: 'scan', p_text: 'x', p_import_id: I, p_paths: pgArray([`${dir}/a.jpg`]), p_input_sha256: sha() }), 'input_mismatch');
    assert.equal(await code({ p_source: 'scan', p_paths: pgArray([`${dir}/a.jpg`]), p_input_sha256: sha() }), 'id_invalid', 'images name their import');
    assert.equal(await img(Array.from({ length: 21 }, (_, i) => `${dir}/${i}.jpg`)), 'too_many');
    assert.equal(await img([`${w.B}/imports/${I}/a.jpg`]), 'path_invalid', 'another venue\'s folder');
    assert.equal(await img([`${A}/imports/${randomUUID()}/a.jpg`]), 'path_invalid', 'another import\'s folder');
    assert.equal(await img([`${A}/imports/a.jpg`]), 'path_invalid', 'not in the import\'s own folder');
    assert.equal(await img([`${dir}/../a.jpg`]), 'path_invalid');
    assert.equal(await img([`${dir}/a.jpg`], { p_input_sha256: 'A'.repeat(64) }), 'sha_invalid');
    assert.equal(await img([`${dir}/a.jpg`], { p_rights_confirmed: true }), 'rights_invalid');
    const O = '44444444-4444-4444-8444-4444444444a1';
    await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'archived-imp@example.invalid', now())`, [O]);
    const v = (await rpc(w.url, O, 'create_venue', { p_slug: 'archived-imp', p_name_en: 'Archived' })).id;
    await w.admin.query(`update public.venues set archived_at = now() where id = $1`, [v]);
    assert.deepEqual(await paste(O, v, 'Soup'), { ok: false, code: 'venue_unknown' });
  });

  test('a venue\'s imports per local day are capped (app_config.import_caps)', async () => {
    await clearImports();
    await withCfg('import_caps', { per_venue_day: 2, scans_per_venue_day: 10 }, async () => {
      assert.equal((await paste(U.ownerB, w.B, 'One 10')).ok, true);
      assert.equal((await paste(U.ownerB, w.B, 'Two 20')).ok, true);
      assert.deepEqual(await paste(U.ownerB, w.B, 'Three 30'), { ok: false, code: 'rate_limited' });
      assert.equal((await paste(U.ownerB, w.B, 'Two 20')).reused, true, 'the same input is not a new import');
      await raw(`update public.menu_imports set created_at = created_at - interval '2 days' where venue_id = $1`, [w.B]);
      assert.equal((await paste(U.ownerB, w.B, 'Three 30')).ok, true, 'yesterday\'s do not count');
    });
    await clearImports();
  });
});

describe('claim_import_scan: the scanner, with the owner\'s token, before any paid call', () => {
  test('owners and managers of the venue only', async () => {
    const s = await scan(U.ownerA, A);
    const roles = { anon: 'anon', stranger: U.stranger, counterA: U.counterA, ownerB: U.ownerB, support: U.support, admin: U.admin };
    assert.deepEqual(await whoMay('claim_import_scan', { p_import: s.importId }, roles),
      { anon: '42501', stranger: '42501', counterA: '42501', ownerB: '42501', support: '42501', admin: '42501' });
    assert.equal((await row(s.importId)).status, 'uploaded');
  });

  test('the claim: parsing, what to read, once at a time; a stale claim may be taken again; a failed read retried', async () => {
    await clearImports();
    const s = await scan(U.ownerA, A, 2);
    const c = await rpc(w.url, U.managerA, 'claim_import_scan', { p_import: s.importId });
    const r = await row(s.importId);
    assert.deepEqual(c, { ok: true, importId: s.importId, venueId: A, source: 'scan', paths: r.raw_paths, rightsConfirmed: false,
      langs: (await w.admin.query(`select langs from public.venues where id = $1`, [A])).rows[0].langs });
    assert.equal(r.status, 'parsing');
    assert.deepEqual(await rpc(w.url, U.ownerA, 'claim_import_scan', { p_import: s.importId }), { ok: false, code: 'import_busy' });
    assert.deepEqual(await rpc(w.url, U.ownerA, 'discard_import', { p_import: s.importId }), { ok: false, code: 'import_busy' });
    await raw(`update public.menu_imports set updated_at = now() - interval '11 minutes' where id = $1`, [s.importId]);
    assert.equal((await rpc(w.url, U.ownerA, 'claim_import_scan', { p_import: s.importId })).ok, true, 'a crashed read is claimed again');
    const failed = await as(w.url, 'service', async (x) => (await x.query(`update public.menu_imports set status = 'failed', error_code = 'model_failed' where id = $1`, [s.importId])).rowCount);
    assert.equal(failed, 1, 'the scanner marks its read failed');
    assert.equal((await rpc(w.url, U.ownerA, 'claim_import_scan', { p_import: s.importId })).ok, true, 'a failed read may be retried');
    assert.equal((await row(s.importId)).error_code, null);
    const log = (await w.admin.query(`select actor_kind, via from public.activity_log where venue_id = $1 and action = 'menu_imports.update' order by id desc limit 2`, [A])).rows;
    assert.deepEqual([log[0].actor_kind, log[0].via], ['owner', 'rpc'], 'the claim');
    assert.equal(log[1].actor_kind, 'system', 'the scanner');
  });

  test('every code; the scans per local day (app_config.import_caps)', async () => {
    await clearImports();
    const p = await paste(U.ownerA, A, 'Soup 38');
    assert.deepEqual(await rpc(w.url, U.ownerA, 'claim_import_scan', { p_import: p.importId }), { ok: false, code: 'not_scannable' });
    assert.deepEqual(await rpc(w.url, U.ownerA, 'claim_import_scan', { p_import: '00000000-0000-4000-8000-00000000ffff' }), { ok: false, code: 'import_unknown' });
    const d = await scan(U.ownerA, A);
    await rpc(w.url, U.ownerA, 'discard_import', { p_import: d.importId });
    assert.deepEqual(await rpc(w.url, U.ownerA, 'claim_import_scan', { p_import: d.importId }), { ok: false, code: 'import_closed' });
    await w.admin.query(`delete from app.event_counters where key like 'import-scan:%'`);
    await withCfg('import_caps', { per_venue_day: 20, scans_per_venue_day: 2 }, async () => {
      const a = await scan(U.ownerA, A), b = await scan(U.ownerA, A), c = await scan(U.ownerA, A);
      assert.equal((await rpc(w.url, U.ownerA, 'claim_import_scan', { p_import: a.importId })).ok, true);
      await raw(`update public.menu_imports set updated_at = now() - interval '11 minutes' where id = $1`, [a.importId]);
      assert.equal((await rpc(w.url, U.ownerA, 'claim_import_scan', { p_import: a.importId })).ok, true, 'a second read of the same import counts too');
      assert.deepEqual(await rpc(w.url, U.ownerA, 'claim_import_scan', { p_import: b.importId }), { ok: false, code: 'rate_limited' });
      assert.equal((await row(b.importId)).status, 'uploaded', 'a refused claim changes nothing');
      assert.equal((await w.admin.query(`select n from app.event_counters where key = $1`, [`import-scan:${A}`])).rows[0].n, 2);
      void c;
    });
    await w.admin.query(`delete from app.event_counters where key like 'import-scan:%'`);
  });
});

describe('discard_import', () => {
  test('owners and managers; uploaded, failed or parsed; twice is fine; never an applied one', async () => {
    await clearImports();
    const p = await paste(U.ownerB, w.B, 'Soup 38');
    const roles = { anon: 'anon', stranger: U.stranger, counterA: U.counterA, ownerA: U.ownerA, support: U.support, admin: U.admin };
    assert.deepEqual(await whoMay('discard_import', { p_import: p.importId }, roles),
      { anon: '42501', stranger: '42501', counterA: '42501', ownerA: '42501', support: '42501', admin: '42501' });
    assert.deepEqual(await rpc(w.url, U.ownerB, 'discard_import', { p_import: p.importId }), { ok: true });
    assert.deepEqual(await rpc(w.url, U.ownerB, 'discard_import', { p_import: p.importId }), { ok: true });
    assert.equal((await row(p.importId)).status, 'discarded');
    const log = (await w.admin.query(`select actor_kind, via, detail from public.activity_log where venue_id = $1 and action = 'menu_imports.update' order by id desc limit 1`, [w.B])).rows[0];
    assert.deepEqual([log.actor_kind, log.via, log.detail.changes.status], ['owner', 'rpc', ['uploaded', 'discarded']]);
    const x = await paste(U.ownerB, w.B, 'Bread 12');
    await raw(`update public.menu_imports set status = 'applied', applied_at = now() where id = $1`, [x.importId]);
    assert.deepEqual(await rpc(w.url, U.ownerB, 'discard_import', { p_import: x.importId }), { ok: false, code: 'import_closed' });
    assert.deepEqual(await rpc(w.url, U.ownerB, 'discard_import', { p_import: '00000000-0000-4000-8000-00000000ffff' }), { ok: false, code: 'import_unknown' });
    await clearImports();
  });
});

describe('the raw input: written once, read by nobody, purged after the retention period', () => {
  test('no client reads raw_text, not even its owner or Halom; every other column is readable', async () => {
    const p = await paste(U.ownerA, A, 'Secret soup 38');
    for (const who of [U.ownerA, U.managerA, U.support, U.admin]) {
      assert.equal((await q(w.url, who, `select raw_text from public.menu_imports`)).error?.code, '42501');
      assert.equal((await q(w.url, who, `select * from public.menu_imports`)).error?.code, '42501');
      assert.equal((await q(w.url, who, `select to_jsonb(i) from public.menu_imports i`)).error?.code, '42501', 'not as a whole row either');
      const rows = await q(w.url, who, `select ${IMPORT_CLIENT_COLUMNS.join(', ')} from public.menu_imports where id = $1`, [p.importId]);
      assert.equal(rows.length, 1);
    }
    assert.deepEqual(await q(w.url, U.counterA, `select id from public.menu_imports`), [], 'a counter sees no imports');
    assert.equal((await q(w.url, 'anon', `select id from public.menu_imports`)).error?.code, '42501');
  });

  test('clients and the scanner write only through the functions; the scanner may only fail a claimed read and purge', async () => {
    const p = await paste(U.ownerA, A, 'Soup 39');
    for (const who of [U.ownerA, U.support]) {
      assert.equal((await q(w.url, who, `insert into public.menu_imports (venue_id, source, raw_text) values ($1, 'paste', 'x')`, [A])).error?.code, '42501');
      assert.equal((await q(w.url, who, `update public.menu_imports set status = 'discarded' where id = $1`, [p.importId])).error?.code, '42501');
    }
    assert.equal((await q(w.url, 'service', `insert into public.menu_imports (venue_id, source, raw_text) values ($1, 'paste', 'x')`, [A])).error?.code, '42501');
    assert.equal((await q(w.url, 'service', `update public.menu_imports set parsed = '{}' where id = $1`, [p.importId])).error?.code, '42501');
    assert.match((await q(w.url, 'service', `update public.menu_imports set status = 'parsed' where id = $1`, [p.importId])).error?.message ?? '', /import_transition/);
    assert.match((await q(w.url, 'service', `update public.menu_imports set status = 'failed' where id = $1`, [p.importId])).error?.message ?? '', /import_transition/,
      'only a read it claimed');
    const s = await scan(U.ownerA, A);
    assert.match((await q(w.url, 'service', `update public.menu_imports set raw_paths = '{}' where id = $1`, [s.importId])).error?.message ?? '', /import_input_fixed/,
      'a purge says when');
    assert.deepEqual(await q(w.url, 'service', `update public.menu_imports set raw_paths = '{}', raw_purged_at = now() where id = $1 returning status`, [s.importId]), [{ status: 'uploaded' }]);
    assert.match((await q(w.url, 'service', `update public.menu_imports set raw_purged_at = now() where id = $1`, [s.importId])).error?.message ?? '', /import_input_fixed/, 'once');
    assert.match((await q(w.url, 'service', `update public.menu_imports set raw_paths = $2 where id = $1`, [s.importId, [`${A}/imports/new.jpg`]])).error?.message ?? '', /import_input_fixed/);
    await clearImports();
  });

  test('the daily job empties the raw text of finished imports past import_raw_retention_days; the row and its hash stay', async () => {
    await clearImports();
    const old = await paste(U.ownerA, A, 'Old soup 38');
    const fresh = await paste(U.ownerA, A, 'Fresh soup 38');
    const open = await paste(U.ownerA, A, 'Open soup 38');
    await rpc(w.url, U.ownerA, 'discard_import', { p_import: old.importId });
    await rpc(w.url, U.ownerA, 'discard_import', { p_import: fresh.importId });
    await raw(`update public.menu_imports set updated_at = now() - interval '31 days' where id in ($1, $2)`, [old.importId, open.importId]);
    const job = (await w.admin.query('select app.daily_maintenance() as r')).rows[0].r;
    assert.equal(job.importsPurged, 1);
    const o = await row(old.importId);
    assert.deepEqual([o.raw_text, o.raw_purged_at !== null, o.status, o.input_sha256.length], [null, true, 'discarded', 64]);
    assert.equal((await row(fresh.importId)).raw_text, 'Fresh soup 38', 'within the retention period');
    assert.equal((await row(open.importId)).raw_text, 'Open soup 38', 'not finished');
    assert.equal((await w.admin.query('select app.daily_maintenance() as r')).rows[0].r.importsPurged, 0, 'once');
    await withCfg('import_raw_retention_days', 0, async () => {
      assert.equal((await w.admin.query('select app.daily_maintenance() as r')).rows[0].r.importsPurged, 1, 'the setting is read each time');
    });
    assert.equal((await w.admin.query(`select count(*)::int as n from public.menu_imports where raw_purged_at is not null and raw_text is null`)).rows[0].n, 2);
    await clearImports();
  });
});
