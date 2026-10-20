// SEC-M1: what a JSON argument can cost the database. Each RPC refuses an argument on its size before walking it, the
// validators collect their issues in place, and the twins of dishes are found by name and section: the worst inputs
// cost little backend CPU. Timed in CPU, not wall time: the backend's own utime + stime from /proc (other load on the
// machine does not count), as the security review measured it. On a system without /proc the timings are skipped.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { rpc } from './harness/cluster.mjs';
import { U, world } from './harness/world.mjs';

let w;
before(async () => { w = await world(); });
after(async () => { await w?.stop(); });

const PROC = fs.existsSync('/proc/self/stat');
const ticks = (pid) => { const f = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' '); return Number(f[11]) + Number(f[12]); };
/** One call as `who` in its own backend: [the reply, the backend's CPU seconds]. */
async function cpu(who, fn, args) {
  const c = new pg.Client({ connectionString: w.url });
  await c.connect();
  try {
    const pid = (await c.query('select pg_backend_pid() p')).rows[0].p;
    await c.query('begin');
    await c.query(`select set_config('statement_timeout', '120s', true), set_config('request.jwt.claims', $1, true), set_config('role', 'authenticated', true)`,
      [JSON.stringify({ sub: who, role: 'authenticated', aal: 'aal1' })]);
    const names = Object.keys(args);
    const vals = names.map((n) => (args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n]));
    const t0 = PROC ? ticks(pid) : 0;
    const r = (await c.query(`select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) v`, vals)).rows[0].v;
    const sec = PROC ? (ticks(pid) - t0) / 100 : 0;
    await c.query('rollback');
    return [r, sec];
  } finally {
    await c.end();
  }
}
const under = (sec, max, label) => {
  if (!PROC) return;
  console.log(`# CPU ${sec.toFixed(2)} s (at most ${max}): ${label}`);
  assert.ok(sec < max, `${label}: ${sec.toFixed(2)} CPU s (at most ${max})`);
};

const he = (i) => 'מנה ' + String.fromCharCode(0x05D0 + (i % 27)) + String.fromCharCode(0x05D0 + (Math.floor(i / 27) % 27)) + String.fromCharCode(0x05D0 + (Math.floor(i / 729) % 27));
const dishOf = (key, name, price, groups = []) => ({ key, name, desc: { he: '', en: '' }, translated: [], price, priceText: null, priceNote: { he: '', en: '' }, tags: [],
  allergens: { he: '', en: '' }, photo: null, illustration: null, groups });
/** A paste draft: `secs` sections of `per` dishes; the same dish name everywhere (and one price, one section name) on request. */
const draft = (secs, per, { same = false, sameSection = false, groups = [], link = null } = {}) => ({ v: 1, source: 'paste', dropped: 0, groups,
  sections: Array.from({ length: secs }, (_, i) => ({ key: 's' + i, name: sameSection ? { he: 'עיקריות', en: 'Mains' } : { he: 'קטגוריה ' + he(i), en: 'Section ' + i },
    translated: [], kind: 'food', room: null,
    dishes: Array.from({ length: per }, (_, j) => dishOf(`d${i}-${j}`, same ? { he: 'ב', en: 'Same' } : { he: he(i * per + j), en: `Dish ${i}-${j}` }, same ? 3000 : 100 + j,
      link ? link(i, j) : [])) })) });

describe('every JSON argument is refused on its size before it is walked, and the worst inputs cost little CPU (SEC-M1)', () => {
  let imp;
  const small = draft(1, 1);
  const newImport = async () => (await rpc(w.url, U.ownerB, 'create_import', { p_venue: w.B, p_source: 'paste', p_text: 'sizes ' + randomUUID() })).importId;
  before(async () => {
    imp = await newImport();
    assert.equal((await rpc(w.url, U.ownerB, 'save_import_draft', { p_import: imp, p_draft: small, p_notes: [] })).ok, true);
  });

  test('save_import_draft: notes past NOTES_MAX or 2 500 000 bytes are refused unread; 2000 invalid notes are checked in linear time', async () => {
    const [many, t1] = await cpu(U.ownerB, 'save_import_draft', { p_import: imp, p_draft: small, p_notes: Array.from({ length: 100000 }, () => 1) });
    assert.deepEqual([many.code, many.errors], ['invalid_draft', [{ code: 'too_many', path: 'notes' }]]);
    under(t1, 0.5, '100 000 notes');
    const huge = Array.from({ length: 1500 }, () => ({ code: 'noise', severity: 'info', key: null, lines: Array(1000).fill(1), count: 1, rule: null }));
    const [big, t2] = await cpu(U.ownerB, 'save_import_draft', { p_import: imp, p_draft: small, p_notes: huge });
    assert.equal(big.code, 'too_large');
    under(t2, 1, 'notes past 2 500 000 bytes');
    const bad = Array.from({ length: 2000 }, () => ({ code: 'zz', severity: 'x', key: 'K', lines: 'x', count: 0, rule: 9 }));
    const [invalid, t3] = await cpu(U.ownerB, 'save_import_draft', { p_import: imp, p_draft: small, p_notes: bad });
    assert.equal(invalid.code, 'invalid_draft');
    assert.equal(invalid.errors.length, 2000 * 5, 'every issue of every note (the reviewer measured 16.3 CPU s)');
    under(t3, 1.5, '2000 invalid notes');
    const full = Array.from({ length: 2000 }, (_, i) => ({ code: 'noise', severity: 'info', key: null, lines: Array.from({ length: 100 }, (_, j) => (i % 9000) * 100 + j + 1),
      count: 100, rule: 'header' }));
    const [ok, t4] = await cpu(U.ownerB, 'save_import_draft', { p_import: imp, p_draft: small, p_notes: full });
    assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 200));
    under(t4, 2, 'the largest valid notes (2000 of 100 lines)');
  });

  test('apply_import: decisions past 2 000 000 bytes or 5000 entries are refused unread; a draft larger than any stored one is draft_changed', async () => {
    const [skips, t1] = await cpu(U.ownerB, 'apply_import', { p_import: imp, p_draft: small,
      p_decisions: { v: 1, pricesConfirmed: true, choices: {}, skip: Array.from({ length: 100000 }, () => 'BAD KEY') } });
    assert.deepEqual([skips.code, skips.errors], ['invalid_decisions', [{ code: 'too_large', path: 'skip' }]]);
    under(t1, 0.5, '100 000 skipped keys');
    const [bytes, t2] = await cpu(U.ownerB, 'apply_import', { p_import: imp, p_draft: small,
      p_decisions: { v: 1, pricesConfirmed: true, choices: {}, skip: Array.from({ length: 4000 }, () => 'x'.repeat(600)) } });
    assert.deepEqual([bytes.code, bytes.errors], ['invalid_decisions', [{ code: 'too_large', path: '' }]]);
    under(t2, 0.5, 'decisions past 2 000 000 bytes');
    const choices = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`BAD ${i}`, 'nope']));
    const [invalid, t3] = await cpu(U.ownerB, 'apply_import', { p_import: imp, p_draft: small, p_decisions: { v: 1, pricesConfirmed: true, choices,
      skip: Array.from({ length: 5000 }, () => 'BAD KEY') } });
    assert.equal(invalid.code, 'invalid_decisions');
    assert.equal(invalid.errors.length, 10000, 'every issue, in linear time (the reviewer measured 11 CPU s for 10 000 skipped keys)');
    under(t3, 1, '5000 invalid answers and 5000 invalid skipped keys');
    const [changed, t4] = await cpu(U.ownerB, 'apply_import', { p_import: imp, p_draft: { ...small, groups: Array(700000).fill(5) }, p_decisions: { v: 1, pricesConfirmed: true, choices: {} } });
    assert.equal(changed.code, 'draft_changed');
    under(t4, 1, 'a 1.4 MB draft');
  });

  test('save_addon_group: more options than the venue\'s limit, or more than 64 KiB, are refused unread', async () => {
    const [many, t1] = await cpu(U.ownerB, 'save_addon_group', { p_venue: w.B, p_group: { id: randomUUID(), name_en: 'G' },
      p_options: Array.from({ length: 20000 }, () => ({ id: 'nope', name_en: '' })) });
    assert.equal(many.code, 'limit_options_per_group');
    under(t1, 0.5, '20 000 options');
    const [big, t2] = await cpu(U.ownerB, 'save_addon_group', { p_venue: w.B, p_group: { id: randomUUID(), name_en: 'G' },
      p_options: Array.from({ length: 30 }, () => ({ id: 'nope', name_en: 'x'.repeat(3000) })) });
    assert.equal(big.code, 'too_large');
    under(t2, 0.5, '30 options of 3000 characters');
  });

  test('the draft: past DRAFT_CAPS refused on its counts alone; the worst names and links at the caps well under the statement timeout', async () => {
    const [groups, t1] = await cpu(U.ownerB, 'save_import_draft', { p_import: await newImport(), p_draft: { ...small, groups: Array(700000).fill(5) }, p_notes: [] });
    assert.equal(groups.code, 'too_large', '1.4 MB of groups: past the byte cap');
    under(t1, 1, 'a 1.4 MB draft');
    const [counts, t2] = await cpu(U.ownerB, 'save_import_draft', { p_import: await newImport(), p_draft: { ...small, groups: Array(401).fill(5), sections: Array(81).fill(5) }, p_notes: [] });
    assert.deepEqual([counts.code, counts.errors], ['invalid_draft', [{ code: 'too_large', path: 'groups' }, { code: 'too_large', path: 'sections' }]]);
    under(t2, 0.5, '401 groups and 81 sections');
    const cases = [
      ['400 dishes', draft(40, 10), 1.5],
      ['400 dishes of one name in one section', draft(1, 400, { same: true }), 2],
      ['800 dishes of one name and price in 80 sections', draft(80, 10, { same: true }), 3],
      ['800 dishes of one name and price in 80 sections of one name', draft(80, 10, { same: true, sameSection: true }), 5],
    ];
    const groups400 = Array.from({ length: 400 }, (_, g) => ({ key: 'g' + g, name: { he: 'תוספות', en: 'Extras' }, translated: [], selection: 'multiple', min: null, max: null,
      options: Array.from({ length: 2 }, (_, o) => ({ key: `g${g}o${o}`, name: { he: 'סלט', en: 'Salad' }, translated: [], price: 0, priceText: null, maxQty: 1, default: false, opens: null })) }));
    cases.push(['400 groups of one name, 800 dishes linking 16 each', draft(50, 16, { same: true, groups: groups400,
      link: (i, j) => Array.from({ length: 16 }, (_, k) => ({ group: 'g' + ((i * 16 + j + k) % 400), min: null, max: null })) }), 5]);
    for (const [label, d, max] of cases) {
      const [r, sec] = await cpu(U.ownerB, 'save_import_draft', { p_import: await newImport(), p_draft: d, p_notes: [] });
      assert.ok(r.ok === true || r.code === 'invalid_draft', `${label}: ${JSON.stringify(r).slice(0, 120)}`);
      under(sec, max, label);
    }
  });

  test('the plan at the limits: 400 dishes, 100 groups of 20 options, 8 links each, planned and written in one apply_import', async () => {
    const groups = Array.from({ length: 100 }, (_, g) => ({ key: 'g' + g, name: { he: 'תוספות ' + he(g), en: 'Extras ' + g }, translated: [], selection: 'multiple', min: null, max: null,
      options: Array.from({ length: 20 }, (_, o) => ({ key: `g${g}o${o}`, name: { he: 'סלט ' + he(o), en: 'Salad ' + o }, translated: [], price: 0, priceText: null, maxQty: 1,
        default: false, opens: null })) }));
    const big = draft(40, 10, { groups, link: (i, j) => Array.from({ length: 8 }, (_, k) => ({ group: 'g' + ((i * 10 + j + k) % 100), min: null, max: null })) });
    const dec = { v: 1, pricesConfirmed: true, choices: {} };
    // an empty venue of its own (the limits count what a venue has)
    const O = '66666666-6666-4666-8666-6666666666a1';
    await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'sizes-owner@example.invalid', now())`, [O]);
    const V = (await rpc(w.url, O, 'create_venue', { p_slug: 'sizes-venue', p_name_en: 'Sizes' })).id;
    const first = await rpc(w.url, O, 'create_import', { p_venue: V, p_source: 'paste', p_text: 'plan ' + randomUUID() });
    assert.equal((await rpc(w.url, O, 'save_import_draft', { p_import: first.importId, p_draft: big })).ok, true);
    const [a, t1] = await cpu(O, 'apply_import', { p_import: first.importId, p_draft: big, p_decisions: dec });
    assert.equal(a.ok, true, JSON.stringify(a).slice(0, 200));
    under(t1, 6, 'planning and writing 400 dishes, 100 groups and 2000 options (rolled back)');
  });
});
