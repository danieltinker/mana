// The import's lifecycle around the reader (ADR-006, ADR-008): create_import, claim_import_scan, save_import_draft,
// discard_import, the scanner's (service role's) narrow rights, the images' own folder, the raw input nobody reads back,
// and its purge. What applying does (apply_import) is in apply.test.mjs; the rules' SQL twins in import-twins.test.mjs.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { as, q, rpc } from './harness/cluster.mjs';
import { A, U, world } from './harness/world.mjs';
import { IMPORT_CAP_KEYS, IMPORT_CLIENT_COLUMNS, IMPORT_IMAGES_MAX, IMPORT_TEXT_MAX, SCAN_IMAGE_CAPS, validateListPurgeableQuery } from '../../packages/contracts/src/index.ts';
import { dish, draftOf, section } from '../../packages/contracts/test/import-fixtures.ts';

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
const scan = (who, venue, files = 1, extra = {}, source = 'scan') => {
  const id = randomUUID();
  return rpc(w.url, who, 'create_import', { p_venue: venue, p_source: source, p_import_id: id,
    p_paths: pgArray(Array.from({ length: files }, (_, i) => `${venue}/imports/${id}/page-${i}.jpg`)), p_input_sha256: sha(), ...extra });
};
const claim = (who, id, mode = 'scan') => rpc(w.url, who, 'claim_import_scan', { p_import: id, p_mode: mode });
const counters = async () => Object.fromEntries((await w.admin.query(`select key, n from app.event_counters where key like 'import-images:%'`)).rows.map((r) => [r.key, r.n]));
const clearCounters = () => w.admin.query(`delete from app.event_counters where key like 'import-images:%'`);
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
    assert.deepEqual(IMPORT_IMAGES_MAX, { scan: 8, wolt_screenshots: 24 });
    assert.equal(await img(Array.from({ length: 9 }, (_, i) => `${dir}/${i}.jpg`)), 'too_many', 'a scan: at most 8 pages');
    const W = randomUUID();
    const wolt = (n) => code({ p_source: 'wolt_screenshots', p_import_id: W, p_input_sha256: sha(),
      p_paths: pgArray(Array.from({ length: n }, (_, i) => `${A}/imports/${W}/${i}.png`)) });
    assert.equal(await wolt(25), 'too_many', 'Wolt screenshots: at most 24');
    assert.equal(await wolt(24), undefined);
    assert.equal(await img([`${w.B}/imports/${I}/a.jpg`]), 'path_invalid', 'another venue\'s folder');
    assert.equal(await img([`${A}/imports/${randomUUID()}/a.jpg`]), 'path_invalid', 'another import\'s folder');
    assert.equal(await img([`${A}/imports/a.jpg`]), 'path_invalid', 'not in the import\'s own folder');
    assert.equal(await img([`${dir}/../a.jpg`]), 'path_invalid');
    // exactly <venue>/imports/<import>/<name>: a name of letters, digits, dot, dash or underscore, 1 to 100 of them
    for (const bad of [`${dir}/sub/a.jpg`, `${dir}/..`, `${dir}/.`, `${dir}/a b.jpg`, `${dir}/${'n'.repeat(101)}`, `${dir}/`, `${dir}/a%2Fb.jpg`,
      `${dir}/%2e%2e`, `${dir}/..%2fa.jpg`, `/${dir}/a.jpg`, `menu-private/${dir}/a.jpg`, `${dir}/../../${w.B}/a.jpg`, `${dir}/שם.jpg`, `${dir.toUpperCase()}/a.jpg`]) {
      assert.equal(await img([bad]), 'path_invalid', bad);
    }
    assert.equal(await img([`${dir}/${'n'.repeat(100)}`]), undefined, 'a 100-character name');
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
    await withCfg('import_caps', { ...(await cfg('import_caps')), per_venue_day: 2 }, async () => {
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
  test('owners and managers of the venue only; anyone else, and an import that does not exist, the same import_unknown', async () => {
    await clearImports();
    const s = await scan(U.ownerA, A);
    const roles = { anon: 'anon', stranger: U.stranger, counterA: U.counterA, ownerB: U.ownerB, support: U.support, admin: U.admin };
    assert.deepEqual(await whoMay('claim_import_scan', { p_import: s.importId, p_mode: 'scan' }, roles),
      { anon: '42501', stranger: 'import_unknown', counterA: 'import_unknown', ownerB: 'import_unknown', support: 'import_unknown', admin: 'import_unknown' });
    assert.deepEqual(await claim(U.ownerA, '00000000-0000-4000-8000-00000000ffff'), { ok: false, code: 'import_unknown' });
    assert.equal((await row(s.importId)).status, 'uploaded');
    assert.deepEqual(await counters(), {}, 'nothing charged');
  });

  test('the claim: parsing, what to read and how many images, once at a time; a stale claim may be taken again; a failed read retried', async () => {
    await clearImports();
    await clearCounters();
    const s = await scan(U.ownerA, A, 2);
    const c = await claim(U.managerA, s.importId);
    const r = await row(s.importId);
    assert.deepEqual(c, { ok: true, importId: s.importId, venueId: A, source: 'scan', paths: r.raw_paths, images: 2, rightsConfirmed: false,
      langs: (await w.admin.query(`select langs from public.venues where id = $1`, [A])).rows[0].langs });
    assert.equal(r.status, 'parsing');
    assert.deepEqual(await claim(U.ownerA, s.importId), { ok: false, code: 'import_busy' });
    assert.deepEqual(await rpc(w.url, U.ownerA, 'discard_import', { p_import: s.importId }), { ok: false, code: 'import_busy' });
    await raw(`update public.menu_imports set updated_at = now() - interval '11 minutes' where id = $1`, [s.importId]);
    assert.equal((await claim(U.ownerA, s.importId)).ok, true, 'a crashed read is claimed again');
    const failed = await as(w.url, 'service', async (x) => (await x.query(`update public.menu_imports set status = 'failed', error_code = 'model_failed' where id = $1`, [s.importId])).rowCount);
    assert.equal(failed, 1, 'the scanner marks its read failed');
    assert.equal((await claim(U.ownerA, s.importId)).ok, true, 'a failed read may be retried');
    assert.equal((await row(s.importId)).error_code, null);
    const log = (await w.admin.query(`select actor_kind, via from public.activity_log where venue_id = $1 and action = 'menu_imports.update' order by id desc limit 2`, [A])).rows;
    assert.deepEqual([log[0].actor_kind, log[0].via], ['owner', 'rpc'], 'the claim');
    assert.equal(log[1].actor_kind, 'system', 'the scanner');
    // every successful claim charges its images: three claims of two
    assert.deepEqual(await counters(), { [`import-images:venue:${A}`]: 6, [`import-images:user:${U.managerA}`]: 2, [`import-images:user:${U.ownerA}`]: 4, 'import-images:all': 6 });
    const wolt = await scan(U.ownerA, A, 3, { p_rights_confirmed: true }, 'wolt_screenshots');
    const cw = await claim(U.ownerA, wolt.importId, 'wolt_screenshots');
    assert.deepEqual([cw.ok, cw.source, cw.images, cw.rightsConfirmed], [true, 'wolt_screenshots', 3, true]);
    await clearCounters();
  });

  test('an older image import with more images than IMPORT_IMAGES_MAX is never read (not_scannable, nothing charged)', async () => {
    await clearImports();
    await clearCounters();
    const id = randomUUID();
    await w.admin.query(`insert into public.menu_imports (id, venue_id, source, raw_paths, input_sha256) values ($1, $2, 'scan', $3, $4)`,
      [id, A, Array.from({ length: 9 }, (_, i) => `${A}/imports/${id}/${i}.jpg`), sha()]);
    assert.deepEqual(await claim(U.ownerA, id), { ok: false, code: 'not_scannable' });
    assert.deepEqual(await counters(), {});
    assert.equal((await row(id)).status, 'uploaded');
    await clearImports();
  });

  test('the mode must be the import\'s source; a mismatch is not_scannable and costs nothing', async () => {
    await clearImports();
    await clearCounters();
    const s = await scan(U.ownerA, A);
    const p = await paste(U.ownerA, A, 'Soup 38');
    const wolt = await scan(U.ownerA, A, 1, {}, 'wolt_screenshots');
    for (const [id, mode] of [[s.importId, 'wolt_screenshots'], [s.importId, 'scan_menu'], [s.importId, null], [wolt.importId, 'scan'], [p.importId, 'scan'], [p.importId, 'paste']]) {
      assert.deepEqual(await claim(U.ownerA, id, mode), { ok: false, code: 'not_scannable' }, `${id} ${mode}`);
    }
    assert.deepEqual(await counters(), {});
    assert.deepEqual([(await row(s.importId)).status, (await row(wolt.importId)).status], ['uploaded', 'uploaded']);
  });

  test('closed: discarded, parsed, applied, purged', async () => {
    await clearImports();
    const d = await scan(U.ownerA, A);
    await rpc(w.url, U.ownerA, 'discard_import', { p_import: d.importId });
    assert.deepEqual(await claim(U.ownerA, d.importId), { ok: false, code: 'import_closed' });
    const f = await scan(U.ownerA, A);
    assert.equal((await claim(U.ownerA, f.importId)).ok, true);
    await as(w.url, 'service', (x) => x.query(`update public.menu_imports set status = 'failed', error_code = 'model_failed' where id = $1`, [f.importId]));
    await as(w.url, 'service', (x) => x.query(`update public.menu_imports set raw_paths = '{}', raw_purged_at = now() where id = $1`, [f.importId]));
    assert.deepEqual(await claim(U.ownerA, f.importId), { ok: false, code: 'import_closed' }, 'its images are gone');
    for (const status of ['parsed', 'applied']) {
      const x = await scan(U.ownerA, A);
      await raw(`update public.menu_imports set status = $2 where id = $1`, [x.importId, status]);
      assert.deepEqual(await claim(U.ownerA, x.importId), { ok: false, code: 'import_closed' }, status);
    }
    await clearCounters();
  });

  test('the images per venue (local day), per person and in all (UTC day) are capped; rate_limited names the cap', async () => {
    const base = await cfg('import_caps');
    assert.deepEqual(base, { per_venue_day: 20, scan_images_per_venue_day: 60, scan_images_per_user_day: 120, scan_images_per_day: 1000, refused_applies_per_venue_hour: 10 });
    assert.deepEqual(Object.keys(base).filter((k) => k.startsWith('scan_images')).sort(), [...SCAN_IMAGE_CAPS].sort(), 'the caps ClaimScanReply names');
    assert.deepEqual(Object.keys(base).sort(), [...IMPORT_CAP_KEYS].sort(), 'the keys the contracts list (IMPORT_CAP_KEYS)');
    for (const [cap, other] of [['scan_images_per_venue_day', null], ['scan_images_per_user_day', null], ['scan_images_per_day', 'B']]) {
      await clearImports();
      await clearCounters();
      await withCfg('import_caps', { ...base, [cap]: 3 }, async () => {
        const a = await scan(U.ownerA, A, 2);
        assert.equal((await claim(U.ownerA, a.importId)).ok, true);
        // the second: the same venue and person, or (for the cap on all venues) another venue's owner
        const b = other ? await scan(U.ownerB, w.B, 2) : await scan(U.ownerA, A, 2);
        assert.deepEqual(await claim(other ? U.ownerB : U.ownerA, b.importId), { ok: false, code: 'rate_limited', cap });
        assert.equal((await row(b.importId)).status, 'uploaded', 'a refused claim changes nothing');
        const one = other ? await scan(U.ownerB, w.B, 1) : await scan(U.ownerA, A, 1);
        assert.equal((await claim(other ? U.ownerB : U.ownerA, one.importId)).ok, true, 'up to the cap exactly');
      });
    }
    // the person's cap follows the person across venues; the venue's cap counts everyone
    await clearImports();
    await clearCounters();
    await withCfg('import_caps', { ...base, scan_images_per_venue_day: 3 }, async () => {
      assert.equal((await claim(U.ownerA, (await scan(U.ownerA, A, 2)).importId)).ok, true);
      assert.deepEqual(await claim(U.managerA, (await scan(U.managerA, A, 2)).importId), { ok: false, code: 'rate_limited', cap: 'scan_images_per_venue_day' });
      assert.equal((await claim(U.ownerB, (await scan(U.ownerB, w.B, 2)).importId)).ok, true, 'another venue has its own');
    });
    // yesterday's images do not count
    await w.admin.query(`update app.event_counters set window_start = window_start - interval '1 day' where key like 'import-images:%'`);
    await withCfg('import_caps', { ...base, scan_images_per_venue_day: 3 }, async () => {
      assert.equal((await claim(U.managerA, (await scan(U.managerA, A, 2)).importId)).ok, true);
    });
    await clearCounters();
    await clearImports();
  });
});

describe('save_import_draft: what a reader made of the input', () => {
  const draft = (source = 'paste', o = {}) => draftOf([section('s-mains', 'עיקריות', 'Mains', [dish('d-soup', 'מרק', 'Soup', 3800), dish('d-salad', 'סלט', 'Salad', null)])], [],
    { source, ...o });
  const save = (who, id, d, notes) => rpc(w.url, who, 'save_import_draft', { p_import: id, p_draft: d, ...(notes === undefined ? {} : { p_notes: notes }) });
  /** A reader's note: codes, a draft key, lines and counts, never the source's text. */
  const NOTE = { code: 'noise', severity: 'info', key: null, lines: [1, 2], count: 2, rule: 'header' };

  test('owners and managers save a text import; the exceptions in the venue\'s languages; the notes readable, the text not', async () => {
    await clearImports();
    const p = await paste(U.ownerA, A, 'Soup 38\nSalad');
    const roles = { anon: 'anon', stranger: U.stranger, counterA: U.counterA, ownerB: U.ownerB, support: U.support, admin: U.admin };
    assert.deepEqual(await whoMay('save_import_draft', { p_import: p.importId, p_draft: draft() }, roles),
      { anon: '42501', stranger: 'import_unknown', counterA: 'import_unknown', ownerB: 'import_unknown', support: 'import_unknown', admin: 'import_unknown' });
    const r = await save(U.managerA, p.importId, draft(), [NOTE, { ...NOTE, code: 'price_range', severity: 'check', key: 'd-soup', lines: [1], count: 1, rule: null }]);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.counts, { sections: 1, dishes: 2, groups: 0, options: 0, photos: 0, dropped: 0 });
    const langs = (await w.admin.query(`select langs from public.venues where id = $1`, [A])).rows[0].langs;
    assert.deepEqual(r.exceptions, (await w.admin.query(`select app.import_exceptions($1::jsonb, $2::text[]) as e`, [JSON.stringify(draft()), langs])).rows[0].e);
    assert.ok(r.exceptions.some((e) => e.code === 'price_missing' && e.key === 'd-salad'));
    const x = await row(p.importId);
    const notes = [NOTE, { ...NOTE, code: 'price_range', severity: 'check', key: 'd-soup', lines: [1], count: 1, rule: null }];
    assert.deepEqual([x.status, x.error_code, x.parsed, x.exceptions, x.notes], ['parsed', null, draft(), r.exceptions, notes]);
    const seen = await q(w.url, U.ownerA, `select ${IMPORT_CLIENT_COLUMNS.join(', ')} from public.menu_imports where id = $1`, [p.importId]);
    assert.deepEqual(seen[0].notes, notes);
    assert.equal((await q(w.url, U.ownerA, `select raw_text from public.menu_imports`)).error?.code, '42501');
    const log = (await w.admin.query(`select detail from public.activity_log where venue_id = $1 and action = 'menu_imports.update' order by id desc limit 1`, [A])).rows[0];
    for (const hidden of ['parsed', 'exceptions', 'notes']) assert.ok(!(hidden in (log.detail.changes ?? {})), `${hidden} is not copied into the log`);
    const ev = (await w.admin.query(`select props from public.events where name = 'import_parsed' and props->>'importId' = $1`, [p.importId])).rows;
    assert.deepEqual(ev.map((e) => e.props), [{ importId: p.importId, source: 'paste', sections: 1, dishes: 2, exceptions: r.exceptions.length }]);
    // a correction of a parsed draft
    const fixed = draft('paste', { dropped: 1 });
    assert.equal((await save(U.ownerA, p.importId, fixed)).ok, true);
    assert.deepEqual([(await row(p.importId)).parsed.dropped, (await row(p.importId)).notes], [1, []], 'no notes: none');
  });

  test('every code', async () => {
    await clearImports();
    const p = await paste(U.ownerA, A, 'Soup 38');
    const code = async (d, notes, who = U.ownerA, id = p.importId) => (await save(who, id, d, notes)).code;
    assert.equal(await code(null), 'too_large');
    assert.equal(await code({ ...draft(), pad: 'x'.repeat(1500001) }), 'too_large', 'over 1 500 000 bytes');
    const bad = await save(U.ownerA, p.importId, { ...draft(), v: 2 });
    assert.deepEqual([bad.code, bad.errors], ['invalid_draft', [{ code: 'version', path: 'v' }]]);
    assert.equal(await code(draft('wolt_text')), 'source_mismatch');
    // the reader's notes (readerNoteIssues): invalid_draft, with the issues under notes
    for (const [notes, issue] of [[{}, 'type@notes'], [[1], 'type@notes[0]'], [[{ ...NOTE, code: 'lines_merged' }], 'enum_invalid@notes[0].code'],
      [[{ ...NOTE, severity: 'check' }], 'enum_invalid@notes[0].severity'], [[{ ...NOTE, key: 'D-1' }], 'key_invalid@notes[0].key'],
      [[{ ...NOTE, key: 'd-nope' }], 'ref_unknown@notes[0].key'], [[{ ...NOTE, lines: [2, 1] }], 'lines_invalid@notes[0].lines'],
      [[{ ...NOTE, lines: [0] }], 'lines_invalid@notes[0].lines'], [[{ ...NOTE, count: 0 }], 'count_invalid@notes[0].count'],
      [[{ ...NOTE, rule: 'Header' }], 'rule_invalid@notes[0].rule'], [[{ ...NOTE, text: 'Soup' }], 'field_not_allowed@notes[0].text'],
      [Array.from({ length: 2001 }, () => NOTE), 'too_many@notes']]) {
      const r = await save(U.ownerA, p.importId, draft(), notes);
      assert.deepEqual([r.code, r.errors.map((e) => `${e.code}@${e.path}`)], ['invalid_draft', [issue]], issue);
    }
    assert.equal(await code(draft(), []), undefined);
    await raw(`update public.menu_imports set status = 'parsing' where id = $1`, [p.importId]);
    assert.equal(await code(draft()), 'import_busy', 'a claim is reading it');
    for (const status of ['applied', 'discarded']) {
      await raw(`update public.menu_imports set status = $2 where id = $1`, [p.importId, status]);
      assert.equal(await code(draft()), 'import_closed', status);
    }
    assert.equal(await code(draft(), undefined, U.ownerA, '00000000-0000-4000-8000-00000000ffff'), 'import_unknown');
  });

  test('the scanner saves only an import it claimed; photos only from the import\'s own folder, confirmed only when the owner confirmed them', async () => {
    await clearImports();
    await clearCounters();
    const s = await scan(U.ownerA, A, 1);
    const photo = (path, rights = 'unknown') => draftOf([section('s-mains', 'עיקריות', 'Mains', [dish('d-soup', 'מרק', 'Soup', 3800, { photo: { path, rights } })])], [],
      { source: 'scan' });
    // a dish photo is a crop the scanner wrote in the import's folder, never one of the uploaded images (QA-L4)
    const own = `${A}/imports/${s.importId}/crop-0.jpg`;
    assert.deepEqual(await save('service', s.importId, photo(own)), { ok: false, code: 'import_closed' }, 'not claimed');
    assert.equal((await claim(U.ownerA, s.importId)).ok, true);
    assert.deepEqual(await save(U.ownerA, s.importId, photo(own)), { ok: false, code: 'import_busy' }, 'the owner waits for the read');
    for (const path of [`${A}/imports/${randomUUID()}/page-0.jpg`, `${w.B}/imports/${s.importId}/page-0.jpg`, `${A}/dishes/page-0.jpg`,
      (await row(s.importId)).raw_paths[0]]) {
      const r = await save('service', s.importId, photo(path));
      assert.deepEqual([r.code, r.errors], ['invalid_draft', [{ code: 'path_invalid', path: 'sections[0].dishes[0].photo.path' }]], path);
    }
    const r = await save('service', s.importId, photo(own, 'confirmed'));
    assert.deepEqual([r.code, r.errors], ['rights_unconfirmed', [{ code: 'rights_unconfirmed', path: 'sections[0].dishes[0].photo.rights' }]]);
    const ok = await save('service', s.importId, photo(own), [{ code: 'page_unreadable', severity: 'check', key: null, lines: [1], count: 1, rule: null }]);
    assert.equal(ok.ok, true, JSON.stringify(ok));
    assert.deepEqual([(await row(s.importId)).status, ok.counts.photos], ['parsed', 1]);
    assert.ok(ok.exceptions.some((e) => e.code === 'photo_rights_unknown'));
    assert.deepEqual(await save('service', s.importId, photo(own)), { ok: false, code: 'import_closed' }, 'once saved, the claim is over');
    const wolt = await scan(U.ownerA, A, 1, { p_rights_confirmed: true }, 'wolt_screenshots');
    assert.equal((await claim(U.ownerA, wolt.importId, 'wolt_screenshots')).ok, true);
    const confirmed = draftOf([section('s-mains', 'עיקריות', 'Mains', [dish('d-soup', 'מרק', 'Soup', 3800,
      { photo: { path: `${A}/imports/${wolt.importId}/crop-0.jpg`, rights: 'confirmed' } })])], [], { source: 'wolt_screenshots' });
    assert.equal((await save('service', wolt.importId, confirmed)).ok, true, 'rights confirmed at upload');
    await clearCounters();
    await clearImports();
  });
});

describe('discard_import', () => {
  test('owners and managers; uploaded, failed or parsed; twice is fine; never an applied one', async () => {
    await clearImports();
    const p = await paste(U.ownerB, w.B, 'Soup 38');
    const roles = { anon: 'anon', stranger: U.stranger, counterA: U.counterA, ownerA: U.ownerA, support: U.support, admin: U.admin };
    // another venue's import is the same import_unknown as one that does not exist (N1); anon has no EXECUTE
    assert.deepEqual(await whoMay('discard_import', { p_import: p.importId }, roles),
      { anon: '42501', stranger: 'import_unknown', counterA: 'import_unknown', ownerA: 'import_unknown', support: 'import_unknown', admin: 'import_unknown' });
    assert.equal((await row(p.importId)).status, 'uploaded', 'nothing changed');
    const opened = (await row(p.importId)).updated_at;
    assert.deepEqual(await rpc(w.url, U.ownerB, 'discard_import', { p_import: p.importId }), { ok: true });
    assert.deepEqual(await rpc(w.url, U.ownerB, 'discard_import', { p_import: p.importId }), { ok: true });
    assert.equal((await row(p.importId)).status, 'discarded');
    assert.ok((await row(p.importId)).updated_at > opened, 'closing moves updated_at (the purge counts its days from it)');
    const log = (await w.admin.query(`select actor_kind, via, detail from public.activity_log where venue_id = $1 and action = 'menu_imports.update' order by id desc limit 1`, [w.B])).rows[0];
    assert.deepEqual([log.actor_kind, log.via, log.detail.changes.status], ['owner', 'rpc', ['uploaded', 'discarded']]);
    const x = await paste(U.ownerB, w.B, 'Bread 12');
    await raw(`update public.menu_imports set status = 'applied', applied_at = now() where id = $1`, [x.importId]);
    assert.deepEqual(await rpc(w.url, U.ownerB, 'discard_import', { p_import: x.importId }), { ok: false, code: 'import_closed' });
    assert.deepEqual(await rpc(w.url, U.ownerB, 'discard_import', { p_import: '00000000-0000-4000-8000-00000000ffff' }), { ok: false, code: 'import_unknown' });
    await clearImports();
  });

  test('a crashed read (a claim past the 10-minute reclaim window): its owner may discard it, and its screenshots go after the retention period (SEC-L2)', async () => {
    await clearImports();
    await clearCounters();
    const s = await scan(U.ownerA, A, 1);
    assert.equal((await claim(U.ownerA, s.importId)).ok, true);
    assert.deepEqual(await rpc(w.url, U.ownerA, 'discard_import', { p_import: s.importId }), { ok: false, code: 'import_busy' }, 'a read in progress');
    const ids = async () => (await rpc(w.url, 'service', 'list_purgeable_imports', {})).map((x) => x.importId);
    await raw(`update public.menu_imports set updated_at = now() - interval '11 minutes' where id = $1`, [s.importId]);
    assert.deepEqual(await ids(), [], 'waiting, within the retention period');
    await raw(`update public.menu_imports set updated_at = now() - interval '31 days' where id = $1`, [s.importId]);
    assert.deepEqual(await ids(), [s.importId], 'a crashed read past the retention period');
    const listed = (await rpc(w.url, 'service', 'list_purgeable_imports', {}))[0];
    assert.equal(listed.status, 'parsing');
    // the scanner's purge goes through the guard
    await as(w.url, 'service', (c) => c.query(`update public.menu_imports set raw_paths = '{}', raw_purged_at = now() where id = $1 and raw_purged_at is null`, [s.importId]));
    assert.ok((await row(s.importId)).raw_purged_at);
    const t = await scan(U.ownerA, A, 1);
    assert.equal((await claim(U.ownerA, t.importId)).ok, true);
    await raw(`update public.menu_imports set updated_at = now() - interval '11 minutes' where id = $1`, [t.importId]);
    assert.deepEqual(await rpc(w.url, U.managerA, 'discard_import', { p_import: t.importId }), { ok: true }, 'its owner or manager lets it go');
    assert.equal((await row(t.importId)).status, 'discarded');
    await clearImports();
    await clearCounters();
  });

  test('a claim inside the reclaim window is never purged, even with a retention of 0 days; the scanner marks before it deletes (N9)', async () => {
    await clearImports();
    await clearCounters();
    await withCfg('import_raw_retention_days', 0, async () => {
      const s = await scan(U.ownerA, A, 1);
      assert.equal((await claim(U.ownerA, s.importId)).ok, true);
      await raw(`update public.menu_imports set updated_at = now() - interval '1 minute' where id = $1`, [s.importId]);
      assert.deepEqual((await rpc(w.url, 'service', 'list_purgeable_imports', {})).map((x) => x.importId), [], 'a live claim is not listed');
      // the scanner's mark (the step before deleting any file) is refused for it: so nothing is deleted
      const mark = await as(w.url, 'service', (c) => c.query(`update public.menu_imports set raw_paths = '{}', raw_purged_at = now() where id = $1 and raw_purged_at is null`, [s.importId]))
        .then(() => 'marked', (e) => e.message);
      assert.match(mark, /import_not_purgeable/);
      assert.equal((await row(s.importId)).raw_purged_at, null);
      const daily = (await w.admin.query(`select app.daily_maintenance() r`)).rows[0].r;
      assert.equal(daily.ok, true);
      assert.equal((await row(s.importId)).raw_purged_at, null, 'nor by the daily job');
      // past the window it is a crashed read, waiting: purgeable at once with a retention of 0
      await raw(`update public.menu_imports set updated_at = now() - interval '11 minutes' where id = $1`, [s.importId]);
      assert.deepEqual((await rpc(w.url, 'service', 'list_purgeable_imports', {})).map((x) => x.importId), [s.importId]);
    });
    await clearImports();
    await clearCounters();
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
    const purge = `update public.menu_imports set raw_paths = '{}', raw_purged_at = now() where id = $1 and raw_purged_at is null returning status`;
    assert.match((await q(w.url, 'service', `update public.menu_imports set raw_paths = '{}' where id = $1`, [s.importId])).error?.message ?? '', /import_input_fixed/,
      'a purge says when');
    assert.match((await q(w.url, 'service', purge, [s.importId])).error?.message ?? '', /import_not_purgeable/, 'an import still waiting for its read');
    assert.equal((await claim(U.ownerA, s.importId)).ok, true);
    assert.match((await q(w.url, 'service', purge, [s.importId])).error?.message ?? '', /import_not_purgeable/, 'never one a claim is reading');
    await as(w.url, 'service', (x) => x.query(`update public.menu_imports set status = 'failed', error_code = 'model_failed' where id = $1`, [s.importId]));
    assert.match((await q(w.url, 'service', `update public.menu_imports set status = 'uploaded', raw_paths = '{}', raw_purged_at = now() where id = $1`, [s.importId])).error?.message ?? '',
      /import_not_purgeable|import_transition/, 'a purge changes nothing else');
    assert.deepEqual(await q(w.url, 'service', purge, [s.importId]), [{ status: 'failed' }]);
    assert.deepEqual(await q(w.url, 'service', purge, [s.importId]), [], 'once: the condition finds nothing the second time');
    assert.match((await q(w.url, 'service', `update public.menu_imports set raw_purged_at = now() where id = $1`, [s.importId])).error?.message ?? '', /import_input_fixed/, 'once');
    assert.match((await q(w.url, 'service', `update public.menu_imports set raw_paths = $2 where id = $1`, [s.importId, [`${A}/imports/${s.importId}/new.jpg`]])).error?.message ?? '', /import_input_fixed/);
    await clearImports();
    await clearCounters();
  });

  test('the table itself holds the images to their import\'s folder (menu_imports_paths_ck)', async () => {
    const id = randomUUID();
    const ins = (paths) => w.admin.query(`insert into public.menu_imports (id, venue_id, source, raw_paths, input_sha256) values ($1, $2, 'scan', $3, $4)`,
      [id, A, paths, sha()]);
    for (const bad of [[`${A}/imports/${randomUUID()}/a.jpg`], [`${A}/imports/${id}/sub/a.jpg`], [`${A}/imports/${id}/..`], [`${A}/imports/${id}/a b.jpg`]]) {
      await assert.rejects(ins(bad), (e) => e.code === '23514' && /menu_imports_paths_ck/.test(e.message), bad[0]);
    }
    await assert.rejects(ins(Array.from({ length: 25 }, (_, i) => `${A}/imports/${id}/${i}.png`)), (e) => e.code === '23514');
    await ins([`${A}/imports/${id}/a.jpg`]);
    await clearImports();
  });

  test('list_purgeable_imports (the scanner\'s purge mode): image imports past the retention period, with their venue, paths and finishedAt', async () => {
    await clearImports();
    await clearCounters();
    const fresh = await scan(U.ownerA, A, 1);
    const stale = await scan(U.ownerA, A, 2);
    const done = await scan(U.ownerB, w.B, 1);
    const failed = await scan(U.ownerA, A, 1);
    const reading = await scan(U.ownerA, A, 1);
    await paste(U.ownerA, A, 'Text is purged by the daily job');
    await rpc(w.url, U.ownerB, 'discard_import', { p_import: done.importId });
    assert.equal((await claim(U.ownerA, failed.importId)).ok, true);
    await as(w.url, 'service', (c) => c.query(`update public.menu_imports set status = 'failed', error_code = 'model_failed' where id = $1`, [failed.importId]));
    assert.equal((await claim(U.ownerA, reading.importId)).ok, true);
    await raw(`update public.menu_imports set updated_at = now() - interval '31 days' where id in ($1, $2)`, [stale.importId, reading.importId]);
    await raw(`update public.menu_imports set status = 'parsing', updated_at = now() where id = $1`, [reading.importId]);
    for (const who of ['anon', U.ownerA, U.support, U.admin]) {
      assert.equal((await rpc(w.url, who, 'list_purgeable_imports', {})).error?.code, '42501', String(who));
    }
    const ids = async (args = {}) => (await rpc(w.url, 'service', 'list_purgeable_imports', args)).map((x) => x.importId);
    // finished today (discarded, failed) waits for the retention period like the daily job: the owner may try a failed
    // scan again; one left uploaded that long goes; never one being read, never a text
    assert.deepEqual(await ids(), [stale.importId]);
    assert.equal((await claim(U.ownerA, failed.importId)).ok, true, 'a failed scan can be read again: its screenshots are still there');
    await as(w.url, 'service', (c) => c.query(`update public.menu_imports set status = 'failed', error_code = 'model_failed' where id = $1`, [failed.importId]));
    // past it: failed 32 days ago, discarded 31 days ago; an applied import counts from applied_at, not its last change
    await raw(`update public.menu_imports set updated_at = now() - interval '32 days' where id = $1`, [failed.importId]);
    await raw(`update public.menu_imports set updated_at = now() - interval '31 days' where id = $1`, [done.importId]);
    const applied = await scan(U.ownerA, A, 1);
    await raw(`update public.menu_imports set status = 'applied', applied_at = now() - interval '40 days', updated_at = now() where id = $1`, [applied.importId]);
    const list = await rpc(w.url, 'service', 'list_purgeable_imports', {});
    assert.deepEqual(list.map((x) => x.importId), [applied.importId, failed.importId, stale.importId, done.importId], 'oldest first');
    const finished = Object.fromEntries((await w.admin.query(`select id, to_jsonb(coalesce(applied_at, updated_at)) as f from public.menu_imports where id = any($1::uuid[])`,
      [pgArray(list.map((x) => x.importId))])).rows.map((r) => [r.id, r.f]));
    assert.ok(list.every((x) => x.finishedAt === finished[x.importId]), 'finishedAt to the microsecond, as to_jsonb writes it');
    const st = list.find((x) => x.importId === stale.importId);
    assert.deepEqual(st, { importId: stale.importId, venueId: A, status: 'uploaded', paths: (await row(stale.importId)).raw_paths, finishedAt: finished[stale.importId] });
    assert.ok(st.paths.every((x) => x.startsWith(`${A}/imports/${stale.importId}/`)));
    // a keyset cursor: the last row as it came gives the page after it, whatever the first page's rows became
    const pages = [];
    let after = null;
    for (let i = 0; i < 6; i++) {
      const page = await rpc(w.url, 'service', 'list_purgeable_imports', { p_limit: 1, ...(after ? { p_after: after } : {}) });
      if (page.length === 0) break;
      pages.push(page[0].importId);
      after = { finishedAt: page[0].finishedAt, importId: page[0].importId };
    }
    assert.deepEqual(pages, list.map((x) => x.importId), 'one page at a time, every row once');
    // a cursor is exactly {finishedAt, importId}, as the contracts' validateListPurgeableQuery says
    for (const bad of [5, [], { importId: 'x', finishedAt: list[0].finishedAt }, { importId: list[0].importId }, { importId: list[0].importId, finishedAt: '2026-02-30T00:00:00Z' },
      { importId: list[0].importId, finishedAt: list[0].finishedAt, page: 2 }]) {
      assert.equal((await rpc(w.url, 'service', 'list_purgeable_imports', { p_after: bad })).error?.code, '22023', JSON.stringify(bad));
      assert.deepEqual(validateListPurgeableQuery({ after: bad }).errors, [{ code: 'cursor_invalid', path: 'after' }], JSON.stringify(bad));
    }
    assert.equal(validateListPurgeableQuery({ limit: 1, after: { finishedAt: list[0].finishedAt, importId: list[0].importId } }).ok, true);
    for (const x of list) await as(w.url, 'service', (c) => c.query(`update public.menu_imports set raw_paths = '{}', raw_purged_at = now() where id = $1 and raw_purged_at is null`, [x.importId]));
    assert.deepEqual(await rpc(w.url, 'service', 'list_purgeable_imports', {}), []);
    assert.equal((await row(fresh.importId)).raw_purged_at, null);
    await clearImports();
    await clearCounters();
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
    assert.equal(job.importsPurged, 2, 'a finished import, and one left waiting past the retention period');
    const o = await row(old.importId);
    assert.deepEqual([o.raw_text, o.raw_purged_at !== null, o.status, o.input_sha256.length], [null, true, 'discarded', 64]);
    assert.equal((await row(fresh.importId)).raw_text, 'Fresh soup 38', 'within the retention period');
    assert.deepEqual([(await row(open.importId)).raw_text, (await row(open.importId)).status], [null, 'uploaded'], 'never read, past the retention period');
    assert.equal((await w.admin.query('select app.daily_maintenance() as r')).rows[0].r.importsPurged, 0, 'once');
    await withCfg('import_raw_retention_days', 0, async () => {
      assert.equal((await w.admin.query('select app.daily_maintenance() as r')).rows[0].r.importsPurged, 1, 'the setting is read each time');
    });
    assert.equal((await w.admin.query(`select count(*)::int as n from public.menu_imports where raw_purged_at is not null and raw_text is null`)).rows[0].n, 3);
    await clearImports();
  });
});
