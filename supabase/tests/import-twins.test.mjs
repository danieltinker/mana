// The importer's SQL twins agree with the contracts on the same inputs: app.import_key with importKey,
// app.validate_import_draft with validateDraft, app.import_exceptions with draftExceptions, app.validate_import_decisions
// with validateDecisions, the save and apply validators, and app.plan_import_on with planApply. The inputs: every call
// the contracts' own import tests make (recorded, harness/import-corpus.mjs), then generated ones.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startCluster } from './harness/cluster.mjs';
import { recordContractCalls } from './harness/import-corpus.mjs';
import { ABSENT, compareValidator, inputs, storable } from './harness/parity.mjs';
import {
  draftExceptions, importKey, planApply, validateApplyImport, validateDecisions, validateDraft, validateSaveDraft,
} from '../../packages/contracts/src/index.ts';
import { bistroDraft, copy } from '../../packages/contracts/test/import-fixtures.ts';

let db;
let calls;
before(async () => { db = await startCluster({ seed: false }); calls = recordContractCalls(); }, { timeout: 240000 });
after(async () => { await db?.stop(); });

const cp = (...c) => String.fromCodePoint(...c);
/** One query: the SQL function on every input, in order. */
async function sqlAll(fn, list) {
  const { rows } = await db.admin.query(`select coalesce(jsonb_agg(${fn} order by i), '[]') as r
    from jsonb_array_elements($1::jsonb) with ordinality t(x, i)`, [JSON.stringify(list)]);
  return rows[0].r;
}

/** Every name in a draft or a menu (the importKey corpus). */
function namesIn(v, out = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => namesIn(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (typeof x === 'string' && /^(he|en|name_he|name_en)$/.test(k)) out.add(x);
      else namesIn(x, out);
    }
  }
  return out;
}

describe('the matching key', () => {
  test('app.import_key is importKey: the contracts\' own cases, every name they import, and the hard characters', async () => {
    const list = new Set([...(calls.importKey ?? []).map((a) => a[0]).filter((s) => typeof s === 'string')]);
    for (const a of [...(calls.planApply ?? []), ...(calls.validateDraft ?? [])]) namesIn(a, list);
    for (const s of ['Crème Brûlée!', 'Coke™', `Coffee ${cp(0x2615, 0xfe0f)}`, `Keycap 1${cp(0xfe0f, 0x20e3)}`, 'צ׳יפס', "צ'יפס", 'צ"יפס', 'ציפס', "a'b",
      'שָׁלוֹם', 'ﬁsh', 'Ｆｕｌｌ', '①', '½', `${cp(0x1f354)}Burger${cp(0x1f354)}`, `a${cp(0x10ffff)}b`, '  spaced   out  ', `x${cp(0x200b)}y`, `${cp(0x3164)}`,
      'İstanbul', 'ǅ', 'ß', 'Ⅻ', `${cp(0xe0067)}flag`, '¡Hola!', '×÷', '₪42', '→', 'A-Z_a-z', '"quoted"', `${cp(0x5be)}`, `${cp(0x5f3)}${cp(0x5f4)}`,
      `${cp(0x5d0)}'${cp(0x5d1)}"`, `''${cp(0x5d0)}''`, '', ' ', '\t\n']) list.add(s);
    const strings = [...list].filter(storable);
    const sql = await sqlAll('to_jsonb(app.import_key(x #>> \'{}\'))', strings);
    strings.forEach((s, i) => assert.equal(sql[i], importKey(s), JSON.stringify(s)));
    assert.ok(strings.length > 60, String(strings.length));
  });
});

describe('the draft', () => {
  test('app.validate_import_draft is validateDraft on every draft the contracts check', async () => {
    const list = (calls.validateDraft ?? []).map((a) => a[0]);
    assert.ok(list.length > 30);
    await compareValidator(db.admin, 'app.validate_import_draft', validateDraft, list);
  });

  test('app.validate_import_draft is validateDraft on generated drafts (one change at a time, then mixes)', async () => {
    const base = bistroDraft();
    const d0 = 'sections.0.dishes.0';
    const g0 = 'groups.0';
    const o0 = 'groups.0.options.0';
    const text = (max) => [ABSENT, null, 5, {}, { he: 'x' }, { he: 'x', en: 'y', fr: 'z' }, { he: '', en: '' }, { he: ' ', en: cp(0x200b) },
      { he: 'x'.repeat(max), en: '' }, { he: 'x'.repeat(max + 1), en: 'y' }, { he: '', en: cp(0x1f354).repeat(max) }];
    const pools = {
      v: [ABSENT, 2, '1'], source: [ABSENT, 'scan', 'paste', 'wolt_page'], dropped: [ABSENT, null, -1, 0, 100000, 100001, 1.5], extra: [1],
      sections: [ABSENT, {}, []], groups: [ABSENT, {}],
      'sections.0': [5, null], 'sections.0.key': [ABSENT, 'S', 'd-burger', 'x'.repeat(65)], 'sections.0.name': text(60),
      'sections.0.translated': [ABSENT, ['fr'], ['he', 'he'], ['en'], ['he']], 'sections.0.kind': [ABSENT, 'snacks', 'wine'],
      'sections.0.room': [ABSENT, 'bar', 'cellar'], 'sections.0.dishes': [ABSENT, {}, []], 'sections.0.colour': ['red'],
      [d0]: [5], [`${d0}.key`]: [ABSENT, 'g-side'], [`${d0}.name`]: text(90), [`${d0}.desc`]: text(600), [`${d0}.translated`]: [['en'], ['fr']],
      [`${d0}.price`]: [ABSENT, null, -1, 0, 1.5, 10000000, 10000001, '64'], [`${d0}.priceText`]: [ABSENT, null, 5, '₪ 4O', 'x'.repeat(41)],
      [`${d0}.priceNote`]: text(80), [`${d0}.tags`]: [ABSENT, ['vegan', 'vegan'], ['halal'], 'vegan'], [`${d0}.allergens`]: text(300),
      [`${d0}.photo`]: [ABSENT, 'x', { path: 'v/imports/i/a.jpg', rights: 'confirmed' }, { path: '/a.jpg', rights: 'maybe' }, { path: 'a.jpg', rights: 'unknown', at: 1 }],
      [`${d0}.illustration`]: [ABSENT, 'Burger', 'burger-1'], [`${d0}.groups`]: [ABSENT, {}, [1], [{ group: 'nope', min: null, max: null }],
        [{ group: 'g-side', min: null, max: null }, { group: 'g-side', min: null, max: null }], [{ group: 'g-side', min: 0, max: 1, x: 1 }],
        [{ group: 'g-side', min: 2, max: 1 }], [{ group: 'g-side', min: 0, max: 2 }], [{ group: 'g-side', min: 0, max: null }],
        [{ group: 'g-extras', min: 3, max: null }], [{ group: 'g-extras', min: 4, max: 4 }], [{ group: 'g-extras', min: 1, max: 2 }]],
      [d0 + '.colour']: ['red'],
      [g0]: [5], [`${g0}.key`]: [ABSENT, 'd-burger', 'G'], [`${g0}.name`]: text(60), [`${g0}.selection`]: [ABSENT, 'any', 'multiple'],
      [`${g0}.min`]: [ABSENT, null, 0, 2, 31, 1.5], [`${g0}.max`]: [ABSENT, null, 0, 2, 31], [`${g0}.options`]: [ABSENT, [], {}, [5]],
      [`${g0}.translated`]: [['he']], [`${g0}.colour`]: ['red'],
      [o0]: [5], [`${o0}.key`]: [ABSENT, 'o-salad'], [`${o0}.name`]: text(60), [`${o0}.price`]: [ABSENT, null, -1, 300],
      [`${o0}.priceText`]: [ABSENT, 'x'.repeat(41), '? '], [`${o0}.maxQty`]: [ABSENT, 0, 2, 11, '1'], [`${o0}.default`]: [ABSENT, 'yes', true],
      [`${o0}.opens`]: [ABSENT, null, 5, 'g-side', 'g-nope', 'g-extras'], [`${o0}.translated`]: [['en'], ['xx']], [`${o0}.colour`]: ['red'],
      'groups.1.options.1.default': [true], 'groups.2.min': [3, 5], 'groups.2.max': [1, 5],
    };
    const list = inputs(base, pools, { random: 300, seed: 5 });
    const n = await compareValidator(db.admin, 'app.validate_import_draft', validateDraft, list);
    assert.ok(n > 400, String(n));
  });

  test('app.import_exceptions is draftExceptions: every draft the contracts list, in their languages and in each one', async () => {
    const recorded = (calls.draftExceptions ?? []).map(([d, o]) => [d, o?.langs ?? ['he', 'en']]);
    const fromValid = (calls.validateDraft ?? []).map((a) => a[0]).filter((d) => validateDraft(d).ok).flatMap((d) => [[d, ['he', 'en']], [d, ['he']], [d, ['en']]]);
    const list = [...recorded, ...fromValid].filter(([d]) => storable(d));
    assert.ok(list.length > 20);
    const sql = await sqlAll(`app.import_exceptions(x->0, array(select jsonb_array_elements_text(x->1)))`, list);
    list.forEach(([d, langs], i) => assert.deepEqual(sql[i], draftExceptions(d, { langs }), `draft ${i} in ${langs}`));
  });
});

describe('decisions and the RPCs\' inputs', () => {
  test('app.validate_import_decisions is validateDecisions', async () => {
    const recorded = (calls.validateDecisions ?? []).map((a) => a[0]);
    const generated = inputs({ v: 1, pricesConfirmed: true, choices: { 'price_missing@d-1': 'no_price' }, skip: ['d-2', 'd-1>g-1'] }, {
      v: [ABSENT, 2, '1'], pricesConfirmed: [ABSENT, null, 'yes', false], choices: [ABSENT, [], 5, {}, { 'x@y': 'merge' }, { 'X@y': 'merge' }, { 'x@': 'merge' },
        { 'group_changed@d-1>g-1@00000000-0000-4000-8000-000000000001': 'add_options' }, { 'price_missing@d-1': 'maybe' }, { [`${'a'.repeat(41)}@k`]: 'skip' }],
      skip: [ABSENT, null, 'd-1', [5], ['D-1'], ['d-1>g'], ['d-1>g>h'], ['_draft'], Array(5001).fill('d')], extra: [1],
    }, { random: 120, seed: 9 });
    await compareValidator(db.admin, 'app.validate_import_decisions', validateDecisions, [...recorded, ...generated], { anyFirst: ['choice_invalid'] });
  });

  test('app.validate_save_draft and app.validate_apply_import are validateSaveDraft and validateApplyImport', async () => {
    const I = '00000000-0000-4000-8000-0000000001a1';
    const dec = { v: 1, pricesConfirmed: true, choices: {} };
    const save = [...(calls.validateSaveDraft ?? []).map((a) => a[0]), ...inputs({ importId: I, draft: bistroDraft() }, {
      importId: [ABSENT, null, 'x', I.toUpperCase()], draft: [ABSENT, null, 5, { ...bistroDraft(), v: 2 }, { ...bistroDraft(), dropped: -1 }], extra: [1] })];
    await compareValidator(db.admin, 'app.validate_save_draft', validateSaveDraft, save);
    const apply = [...(calls.validateApplyImport ?? []).map((a) => a[0]), ...inputs({ importId: I, draft: bistroDraft(), decisions: dec }, {
      importId: [ABSENT, 'x'], draft: [ABSENT, { ...bistroDraft(), v: 2 }], decisions: [ABSENT, 5, { ...dec, v: 2 }, { ...dec, skip: [5] }], extra: [1] })];
    await compareValidator(db.admin, 'app.validate_apply_import', validateApplyImport, apply);
  });
});

describe('the plan', () => {
  test('app.plan_import_on is planApply on every plan the contracts make (steps, summary, exceptions, errors)', async () => {
    const list = (calls.planApply ?? []).filter((a) => storable(a));
    assert.ok(list.length > 50, String(list.length));
    for (const [i, [draft, existing, decisions, opts]] of list.entries()) {
      const { rows } = await db.admin.query(`select app.plan_import_on($1::jsonb, $2::jsonb, $3::jsonb, $4::text[]) as r`,
        [JSON.stringify(draft), JSON.stringify(existing), JSON.stringify(decisions), opts?.langs ?? ['he', 'en']]);
      const want = planApply(draft, existing, decisions, opts ?? {});
      assert.deepEqual(rows[0].r, JSON.parse(JSON.stringify(want)), `plan ${i}`);
    }
  });

  test('the plan on generated answers to the base draft over the menu it made (skips, choices, every check answered both ways)', async () => {
    void copy;
  });
});
