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
import {
  ADDON_GROUP_BYTES_MAX, addonGroupSizeFail, applyImportSizeFail, DECISIONS_BYTES_MAX, DRAFT_BYTES_MAX, draftBytes, NOTES_BYTES_MAX, NOTES_MAX,
  saveDraftSizeFail,
} from '../../packages/contracts/src/index.ts';

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

  // SEC-M3: a menu at the venue's own limits (LIMITS: 400 dishes, 200 add-on groups of 30 options, 8 groups per dish),
  // planned and written by one apply_import, on a first import and on a re-import of the same draft, well under
  // Supabase's 8 s statement timeout (security measured 8 to 17 CPU s before; one link per dish was the worst)
  test('the plan at the venue\'s limits: 400 dishes, 200 groups of 30 options, 8 links each (and 1), a first import and a re-import', async () => {
    const groups = Array.from({ length: 200 }, (_, g) => ({ key: 'g' + g, name: { he: 'תוספות ' + he(g), en: 'Extras ' + g }, translated: [], selection: 'multiple', min: null,
      max: null, options: Array.from({ length: 30 }, (_, o) => ({ key: `g${g}o${o}`, name: { he: 'סלט ' + he(o), en: 'Salad ' + o }, translated: [], price: 0, priceText: null,
        maxQty: 1, default: false, opens: null })) }));
    const dec = { v: 1, pricesConfirmed: true, choices: {} };
    for (const [n, links] of [[1, 8], [2, 1]]) {
      const big = draft(40, 10, { groups, link: (i, j) => Array.from({ length: links }, (_, k) => ({ group: 'g' + (((i * 10 + j) * links + k) % 200), min: null, max: null })) });
      // an empty venue of its own (the limits count what a venue has)
      const O = `66666666-6666-4666-8666-6666666666a${n}`;
      await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [O, `sizes-owner-${n}@example.invalid`]);
      const V = (await rpc(w.url, O, 'create_venue', { p_slug: `sizes-venue-${n}`, p_name_en: 'Sizes' })).id;
      const saved = async () => {
        const imp = await rpc(w.url, O, 'create_import', { p_venue: V, p_source: 'paste', p_text: 'plan ' + randomUUID() });
        assert.equal((await rpc(w.url, O, 'save_import_draft', { p_import: imp.importId, p_draft: big })).ok, true);
        return imp.importId;
      };
      const first = await saved();
      const [a, t1] = await cpu(O, 'apply_import', { p_import: first, p_draft: big, p_decisions: dec });
      assert.equal(a.ok, true, JSON.stringify(a).slice(0, 200));
      assert.deepEqual([a.plan.summary.option.create, a.plan.summary.dish_group.create], [6000, 400 * links]);
      under(t1, 4, `a first import of 400 dishes, 200 groups of 30 options, ${links} link${links > 1 ? 's' : ''} each (rolled back)`);
      assert.equal((await rpc(w.url, O, 'apply_import', { p_import: first, p_draft: big, p_decisions: dec })).ok, true, 'applied, for the re-import');
      const again = await saved();
      const [b, t2] = await cpu(O, 'apply_import', { p_import: again, p_draft: big, p_decisions: dec });
      assert.equal(b.ok, true, JSON.stringify(b).slice(0, 200));
      assert.ok(Object.values(b.plan.summary).every((k) => k.create === 0 && k.update === 0), 'the same draft again writes nothing');
      under(t2, 4, `a re-import of the same menu, ${links} link${links > 1 ? 's' : ''} each (rolled back)`);
    }
  });

  // SEC-M2: an onboarding step's blockers past BLOCKERS_MAX (20) are refused unread, by the owner's RPC and by Halom's
  test('set_onboarding_step: 20 000 invalid blockers are refused unread, by the owner and through act_for_owner', async () => {
    const many = `{${Array(20000).fill('BAD').join(',')}}`;
    const [r, t1] = await cpu(U.ownerB, 'set_onboarding_step', { p_venue: w.B, p_step: 'hours', p_state: 'blocked', p_blockers: many });
    assert.deepEqual(r, { ok: false, code: 'too_many' });
    under(t1, 0.5, '20 000 invalid blockers (the reviewer measured 46 CPU s)');
    const [s, t2] = await cpu(U.support, 'act_for_owner', { p_venue: w.B, p_reason: 'Owner asked on the phone', p_action: 'onboarding.set',
      p_payload: { step: 'hours', state: 'blocked', blockers: Array(20000).fill('BAD'), expectedUpdatedAt: null } });
    assert.deepEqual([s.ok, s.code], [false, 'too_many']);
    under(t2, 0.5, '20 000 invalid blockers through act_for_owner');
  });
});

describe('the size bounds as the contracts state them, on both sides of each, Hebrew at 2 bytes (SEC-M1)', () => {
  /** The value with its filler string grown (Hebrew letters, 2 bytes each, and at most one ASCII letter) to exactly
   * `target` bytes by draftBytes */
  const sized = (make, target) => {
    const need = target - draftBytes(make(''));
    assert.ok(need >= 2, 'room for the filler');
    const v = make('ש'.repeat(Math.floor(need / 2)) + 'a'.repeat(need % 2));
    assert.equal(draftBytes(v), target);
    return v;
  };
  /** The bytes the database measures: octet_length of the jsonb text */
  const dbBytes = async (v) => (await w.admin.query('select octet_length($1::jsonb::text) n', [JSON.stringify(v)])).rows[0].n;
  const small = draft(1, 1);
  const newImport = async () => (await rpc(w.url, U.ownerB, 'create_import', { p_venue: w.B, p_source: 'paste', p_text: 'bounds ' + randomUUID() })).importId;

  test('save_import_draft: the draft at DRAFT_BYTES_MAX, the notes at NOTES_MAX and at NOTES_BYTES_MAX', async () => {
    for (const target of [DRAFT_BYTES_MAX, DRAFT_BYTES_MAX + 1]) {
      const d = sized((f) => ({ ...small, pad: f }), target);
      assert.equal(await dbBytes(d), target, 'the database measures the same bytes');
      const got = await rpc(w.url, U.ownerB, 'save_import_draft', { p_import: await newImport(), p_draft: d, p_notes: [] });
      const want = saveDraftSizeFail(d, []);
      assert.equal(want === null, target === DRAFT_BYTES_MAX);
      if (want) assert.deepEqual(got, want, `a draft of ${target} bytes`);
      else assert.deepEqual([got.code, got.errors], ['invalid_draft', [{ code: 'field_not_allowed', path: 'pad' }]], `a draft of ${target} bytes is walked`);
    }
    for (const n of [NOTES_MAX, NOTES_MAX + 1]) {
      const notes = Array.from({ length: n }, () => ({ code: 'noise', severity: 'info', key: null, lines: [], count: 1, rule: null }));
      const got = await rpc(w.url, U.ownerB, 'save_import_draft', { p_import: await newImport(), p_draft: small, p_notes: notes });
      const want = saveDraftSizeFail(small, notes);
      assert.equal(want === null, n === NOTES_MAX);
      if (want) assert.deepEqual(got, want, `${n} notes`);
      else assert.equal(got.ok, true, `${n} notes: ${JSON.stringify(got).slice(0, 160)}`);
    }
    for (const target of [NOTES_BYTES_MAX, NOTES_BYTES_MAX + 1]) {
      const notes = sized((f) => [{ code: 'noise', severity: 'info', key: null, lines: [], count: 1, rule: f }], target);
      assert.equal(await dbBytes(notes), target, 'the database measures the same bytes');
      const got = await rpc(w.url, U.ownerB, 'save_import_draft', { p_import: await newImport(), p_draft: small, p_notes: notes });
      const want = saveDraftSizeFail(small, notes);
      assert.equal(want === null, target === NOTES_BYTES_MAX);
      if (want) assert.deepEqual(got, want, `notes of ${target} bytes`);
      else assert.deepEqual([got.code, got.errors], ['invalid_draft', [{ code: 'rule_invalid', path: 'notes[0].rule' }]], `notes of ${target} bytes are walked`);
    }
  });

  test('apply_import: the decisions at DECISIONS_BYTES_MAX; a draft past DRAFT_BYTES_MAX', async () => {
    const imp = await newImport();
    assert.equal((await rpc(w.url, U.ownerB, 'save_import_draft', { p_import: imp, p_draft: small, p_notes: [] })).ok, true);
    for (const target of [DECISIONS_BYTES_MAX, DECISIONS_BYTES_MAX + 1]) {
      const dec = sized((f) => ({ v: 1, pricesConfirmed: true, choices: {}, pad: f }), target);
      assert.equal(await dbBytes(dec), target, 'the database measures the same bytes');
      const got = await rpc(w.url, U.ownerB, 'apply_import', { p_import: imp, p_draft: small, p_decisions: dec });
      const want = applyImportSizeFail(small, dec);
      assert.equal(want === null, target === DECISIONS_BYTES_MAX);
      if (want) assert.deepEqual(got, want, `decisions of ${target} bytes`);
      else assert.deepEqual([got.code, got.errors], ['invalid_decisions', [{ code: 'field_not_allowed', path: 'pad' }]], `decisions of ${target} bytes are walked`);
    }
    const over = sized((f) => ({ ...small, pad: f }), DRAFT_BYTES_MAX + 1);
    assert.deepEqual(await rpc(w.url, U.ownerB, 'apply_import', { p_import: imp, p_draft: over, p_decisions: { v: 1, pricesConfirmed: true, choices: {} } }),
      applyImportSizeFail(over, {}));
  });

  test('save_addon_group: the options at the venue\'s limit, the group and its options at ADDON_GROUP_BYTES_MAX', async () => {
    const opts = (n) => Array.from({ length: n }, () => ({ id: randomUUID(), name_en: 'Fries' }));
    for (const n of [30, 31]) {
      const g = { id: randomUUID(), name_en: 'Sides', selection: 'multiple', min_units: 0, max_units: 1 };
      const o = opts(n);
      const got = await rpc(w.url, U.ownerB, 'save_addon_group', { p_venue: w.B, p_group: g, p_options: o });
      const want = addonGroupSizeFail(g, o);
      assert.equal(want === null, n === 30);
      if (want) assert.deepEqual(got, want, `${n} options`);
      else assert.notEqual(got.code, 'limit_options_per_group', `${n} options: ${JSON.stringify(got).slice(0, 160)}`);
    }
    const options = opts(2);
    for (const target of [ADDON_GROUP_BYTES_MAX, ADDON_GROUP_BYTES_MAX + 1]) {
      const g = sized((f) => ({ id: randomUUID(), name_he: f, name_en: 'Sides' }), target - draftBytes(options));
      assert.equal(await dbBytes(g) + await dbBytes(options), target, 'the database measures the same bytes');
      const got = await rpc(w.url, U.ownerB, 'save_addon_group', { p_venue: w.B, p_group: g, p_options: options });
      const want = addonGroupSizeFail(g, options);
      assert.equal(want === null, target === ADDON_GROUP_BYTES_MAX);
      if (want) assert.deepEqual(got, want, `${target} bytes`);
      else assert.notEqual(got.code, 'too_large', `${target} bytes: ${JSON.stringify(got).slice(0, 160)}`);
    }
  });
});
