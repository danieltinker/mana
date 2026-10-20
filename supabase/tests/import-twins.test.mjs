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
  ACT_FOR_OWNER_ACTIONS, draftExceptions, EMPTY_MENU, EXCEPTION_CHOICES, IMPORT_CHOICES, IMPORT_EXCEPTION_CODES, IMPORT_EXCEPTIONS, importKey,
  LAYOUT_GUESS_RULES, planApply, READER_NOTES, readerNoteIssues, validateApplyImport, validateDecisions, validateDraft, validateSaveDraft,
} from '../../packages/contracts/src/index.ts';
import { applyPlan, bistroDraft, copy, dish, link, opt, section } from '../../packages/contracts/test/import-fixtures.ts';

let db;
let calls;
before(async () => { db = await startCluster({ seed: false }); calls = recordContractCalls(); }, { timeout: 240000 });
after(async () => { await db?.stop(); });

const cp = (...c) => String.fromCodePoint(...c);
/** Each input once (the fuzz makes the same call many times). */
const distinct = (list) => {
  const seen = new Set();
  return list.filter((a) => { const k = JSON.stringify(a); if (seen.has(k)) return false; seen.add(k); return true; });
};

/** The SQL function on every input, in order (a few inputs per query: large drafts take a while each). */
async function sqlAll(fn, list, per = 10) {
  const out = [];
  for (let i = 0; i < list.length; i += per) {
    const { rows } = await db.admin.query(`select coalesce(jsonb_agg(${fn} order by i), '[]') as r
      from jsonb_array_elements($1::jsonb) with ordinality t(x, i)`, [JSON.stringify(list.slice(i, i + per))]);
    out.push(...rows[0].r);
  }
  return out;
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
    const list = distinct((calls.validateDraft ?? []).map((a) => a[0]));
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
    const list = distinct([...recorded, ...fromValid].filter(([d]) => storable(d)));
    assert.ok(list.length > 20);
    const sql = await sqlAll(`app.import_exceptions(x->0, array(select jsonb_array_elements_text(x->1)))`, list);
    list.forEach(([d, langs], i) => assert.deepEqual(sql[i], draftExceptions(d, { langs }), `draft ${i} in ${langs}`));
  });
});

describe('the closed lists', () => {
  test('IMPORT_EXCEPTIONS (order and severity), IMPORT_CHOICES, EXCEPTION_CHOICES, READER_NOTES, LAYOUT_GUESS_RULES, ACT_FOR_OWNER_ACTIONS', async () => {
    const { rows } = await db.admin.query(`select app.import_exception_codes() c, app.import_choice_list() l, app.import_choices() x, app.reader_notes() n,
      app.layout_guess_rules() g,
      (select jsonb_object_agg(c, app.import_exception_severity(c)) from unnest(app.import_exception_codes()) c) s,
      pg_get_functiondef('public.act_for_owner(uuid,text,text,jsonb)'::regprocedure) a`);
    assert.deepEqual(rows[0].c, [...IMPORT_EXCEPTION_CODES]);
    assert.deepEqual(rows[0].s, { ...IMPORT_EXCEPTIONS });
    assert.deepEqual(new Set(rows[0].l), new Set(IMPORT_CHOICES));
    assert.deepEqual(rows[0].x, JSON.parse(JSON.stringify(EXCEPTION_CHOICES)));
    assert.deepEqual(rows[0].n, { ...READER_NOTES });
    assert.deepEqual(rows[0].g, [...LAYOUT_GUESS_RULES]);
    const listed = /not in \(([^)]*)\) then\s+return app\.fail\('action_unknown'\)/.exec(rows[0].a)[1].match(/'([a-z_.]+)'/g).map((v) => v.slice(1, -1));
    assert.deepEqual(listed, [...ACT_FOR_OWNER_ACTIONS]);
  });
});

describe('the reader\'s notes', () => {
  test('app.validate_reader_notes is readerNoteIssues: the contracts\' own calls, then generated notes, with and without the draft', async () => {
    const base = bistroDraft();
    const note = { code: 'noise', severity: 'info', key: null, lines: [1, 3], count: 2, rule: 'header' };
    const recorded = (calls.readerNoteIssues ?? []).map(([n, d, prefix]) => [n, d ?? null, prefix ?? 'notes']);
    const generated = inputs([note, { ...note, code: 'price_range', severity: 'check', key: 'd-burger', lines: [4], count: 1, rule: null }], {
      0: [ABSENT, 5, null, [], {}], '0.code': [ABSENT, 'nope', 5, 'price_range'], '0.severity': [ABSENT, 'check', null], '0.key': [ABSENT, 'd-burger', 'd-nope', 'D', 5, ''],
      '0.lines': [ABSENT, [], [0], [1, 1], [2, 1], [1, 2.5], Array.from({ length: 101 }, (_, i) => i + 1), Array.from({ length: 100 }, (_, i) => i + 1), [1000001], '1'],
      '0.count': [ABSENT, 0, 1, 1000000, 1000001, 1.5, '2'], '0.rule': [ABSENT, 'Header', 'a'.repeat(40), 'a'.repeat(41), '_x', 5], '0.text': ['Soup'],
      '1.key': ['g-side', 'o-fries', 's-mains', 'x'], 2: [5],
    }, { random: 200, seed: 13 }).filter((n) => storable(n));
    const list = [...recorded, ...generated.flatMap((n) => [[n, base, 'notes'], [n, null, 'notes']]), [Array.from({ length: 2001 }, () => note), null, 'notes'],
      [{}, null, 'n'], [null, null, 'notes']].filter((a) => storable(a));
    const sql = await sqlAll(`app.validate_reader_notes(x->0, case when x->1 = 'null'::jsonb then null else x->1 end, x->>2)`, list);
    // (as JSON carries them: a hole in an array is a null)
    list.forEach(([n, d, prefix], i) => assert.deepEqual(sql[i], readerNoteIssues(JSON.parse(JSON.stringify(n)), d, prefix), JSON.stringify([n, prefix]).slice(0, 200)));
    assert.ok(list.length > 300, String(list.length));
  });

  test('layout_guessed: a rule of LAYOUT_GUESS_RULES, a key, a section or dish of the draft; every other code as before', async () => {
    const base = bistroDraft();
    const layout = { code: 'layout_guessed', severity: 'check', key: 'd-burger', lines: [3, 4], count: 2, rule: 'desc_habit' };
    const noise = { code: 'noise', severity: 'info', key: null, lines: [1], count: 1, rule: 'header' };
    // each case, with the issues both sides must give (with the draft, and without it)
    const cases = [
      [{ ...layout }, [], []],
      ...LAYOUT_GUESS_RULES.map((rule) => [{ ...layout, rule }, [], []]),
      [{ ...layout, key: 's-mains' }, [], []],
      [{ ...layout, rule: null }, ['rule_invalid@notes[0].rule'], ['rule_invalid@notes[0].rule']],
      [{ ...layout, rule: 'header' }, ['rule_invalid@notes[0].rule'], ['rule_invalid@notes[0].rule']],
      [{ ...layout, rule: 'Desc_habit' }, ['rule_invalid@notes[0].rule'], ['rule_invalid@notes[0].rule']],
      [{ ...layout, key: null }, ['key_invalid@notes[0].key'], ['key_invalid@notes[0].key']],
      [{ ...layout, key: 'g-side' }, ['ref_unknown@notes[0].key'], []],
      [{ ...layout, key: 'o-fries' }, ['ref_unknown@notes[0].key'], []],
      [{ ...layout, key: 'd-nope' }, ['ref_unknown@notes[0].key'], []],
      [{ ...layout, key: 'D' }, ['key_invalid@notes[0].key'], ['key_invalid@notes[0].key']],
      [{ ...layout, key: null, rule: null, count: 0, severity: 'info' },
        ['enum_invalid@notes[0].severity', 'key_invalid@notes[0].key', 'count_invalid@notes[0].count', 'rule_invalid@notes[0].rule'],
        ['enum_invalid@notes[0].severity', 'key_invalid@notes[0].key', 'count_invalid@notes[0].count', 'rule_invalid@notes[0].rule']],
      // the other codes: a null key, any node of the draft, a rule word or null
      [{ ...noise }, [], []],
      [{ ...noise, key: 'g-side', rule: null }, [], []],
      [{ ...noise, key: 'o-fries', rule: 'tag_or_heading' }, [], []],
      [{ ...noise, rule: 'Header' }, ['rule_invalid@notes[0].rule'], ['rule_invalid@notes[0].rule']],
    ];
    const list = cases.flatMap(([n]) => [[[n], base, 'notes'], [[n], null, 'notes']]);
    const sql = await sqlAll(`app.validate_reader_notes(x->0, case when x->1 = 'null'::jsonb then null else x->1 end, x->>2)`, list);
    const codes = (issues) => issues.map((e) => `${e.code}@${e.path}`);
    cases.forEach(([n, withDraft, without], i) => {
      assert.deepEqual(codes(readerNoteIssues([n], base)), withDraft, `contracts, with the draft: ${JSON.stringify(n)}`);
      assert.deepEqual(codes(readerNoteIssues([n], null)), without, `contracts, without: ${JSON.stringify(n)}`);
      assert.deepEqual(codes(sql[2 * i]), withDraft, `SQL, with the draft: ${JSON.stringify(n)}`);
      assert.deepEqual(codes(sql[2 * i + 1]), without, `SQL, without: ${JSON.stringify(n)}`);
    });
    // and generated: every key and rule against each code, with and without the draft
    const generated = inputs([layout], {
      '0.code': ['noise', 'popular_only', 'nope'], '0.severity': [ABSENT, 'info', 'check'],
      '0.rule': [ABSENT, null, ...LAYOUT_GUESS_RULES, 'header', 'Desc_habit', 5, '', 'x'.repeat(41)],
      '0.key': [ABSENT, null, 'd-burger', 's-mains', 'g-side', 'o-fries', 'd-nope', 'D', 5], '0.count': [0, 1000001], '0.lines': [[2, 1], []],
    }, { random: 150, seed: 21 }).filter((n) => storable(n));
    const more = generated.flatMap((n) => [[n, base, 'notes'], [n, null, 'notes']]);
    const sql2 = await sqlAll(`app.validate_reader_notes(x->0, case when x->1 = 'null'::jsonb then null else x->1 end, x->>2)`, more);
    more.forEach(([n, d, prefix], i) => assert.deepEqual(sql2[i], readerNoteIssues(JSON.parse(JSON.stringify(n)), d, prefix), JSON.stringify(n).slice(0, 200)));
    assert.ok(more.length > 300, String(more.length));
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
    const note = { code: 'noise', severity: 'info', key: 'd-burger', lines: [1], count: 1, rule: null };
    const save = [...(calls.validateSaveDraft ?? []).map((a) => a[0]), ...inputs({ importId: I, draft: bistroDraft() }, {
      importId: [ABSENT, null, 'x', I.toUpperCase()], draft: [ABSENT, null, 5, { ...bistroDraft(), v: 2 }, { ...bistroDraft(), dropped: -1 }], extra: [1],
      notes: [ABSENT, null, [], [note], [{ ...note, key: 'd-nope' }], [{ ...note, count: 0 }], {}] })];
    await compareValidator(db.admin, 'app.validate_save_draft', validateSaveDraft, save);
    const apply = [...(calls.validateApplyImport ?? []).map((a) => a[0]), ...inputs({ importId: I, draft: bistroDraft(), decisions: dec }, {
      importId: [ABSENT, 'x'], draft: [ABSENT, { ...bistroDraft(), v: 2 }], decisions: [ABSENT, 5, { ...dec, v: 2 }, { ...dec, skip: [5] }], extra: [1] })];
    await compareValidator(db.admin, 'app.validate_apply_import', validateApplyImport, apply);
  });
});

describe('the plan', () => {
  /** Runs the SQL twin on each [draft, existing, decisions, opts] and compares it with planApply; returns how many. */
  async function comparePlans(list, label) {
    const bad = [];
    for (const [i, [draft, existing, decisions, opts]] of list.entries()) {
      const { rows } = await db.admin.query(`select app.plan_import_on($1::jsonb, $2::jsonb, $3::jsonb, $4::text[]) as r`,
        [JSON.stringify(draft), JSON.stringify(existing), JSON.stringify(decisions), opts?.langs ?? ['he', 'en']]);
      const want = JSON.parse(JSON.stringify(planApply(draft, existing, decisions, opts ?? {})));
      try { assert.deepEqual(rows[0].r, want); } catch (e) { bad.push(`${label} ${i}: ${e.message.slice(0, 1500)}`); }
    }
    assert.deepEqual(bad.slice(0, 3), [], `${bad.length} of ${list.length} plans differ`);
    return list.length;
  }

  // (the fuzz's seeds whole, its large runs one call in FUZZ_EVERY: harness/import-corpus.mjs; MANA_TWINS_FULL=1 for all)
  test('app.plan_import_on is planApply on every plan the contracts make (steps, summary, exceptions, fromDraft, errors)', async () => {
    const list = distinct((calls.planApply ?? []).filter((a) => storable(a)));
    assert.ok(list.length > 50, String(list.length));
    await comparePlans(list, 'recorded');
  });

  test('the plan on generated drafts over the menu the base draft made, with every check answered each way', async () => {
    const base = bistroDraft();
    const answerFixes = (d, existing = EMPTY_MENU) => {
      const choices = {};
      for (const e of draftExceptions(d)) if (e.severity === 'fix') choices[`${e.code}@${e.key}`] = EXCEPTION_CHOICES[e.code][0];
      const p = planApply(d, existing, { v: 1, pricesConfirmed: true, choices });
      if (p.ok) for (const e of p.value.exceptions) if (e.severity === 'fix') choices[`${e.code}@${e.key}`] = EXCEPTION_CHOICES[e.code][0];
      return { v: 1, pricesConfirmed: true, choices };
    };
    const first = planApply(base, EMPTY_MENU, answerFixes(base));
    assert.equal(first.ok, true);
    const menu = applyPlan(EMPTY_MENU, first.value);
    const variants = {
      same: (d) => d,
      prices: (d) => { d.sections[0].dishes[0].price = 6600; d.sections[0].dishes[1].price = 7400; d.groups[2].options[0].price = 350; return d; },
      renamed: (d) => { d.sections[0].name = { he: 'מנות', en: 'Main courses' }; d.sections[0].key = 's-main-courses'; return d; },
      moved: (d) => { d.sections[1].dishes.push(d.sections[0].dishes.pop()); return d; },
      newDish: (d) => { d.sections[0].dishes.push(dish('d-steak', 'סטייק', 'Steak', 9800, { groups: [link('g-side', 1, 1)] })); return d; },
      fewerOptions: (d) => { d.groups[0].options.pop(); return d; },
      moreOptions: (d) => { d.groups[0].options.push(opt('o-rice', 'אורז', 'Rice', 0)); return d; },
      nested: (d) => { d.groups[1].options.push(opt('o-mayo', 'מיונז', 'Mayo', 0)); return d; },
      unreachable: (d) => { d.groups[2].min = 3; d.groups[2].max = 3; d.groups[2].options[1].maxQty = 1; return d; },
      zero: (d) => { d.sections[1].dishes[0].price = 0; return d; },
      otherKind: (d) => { d.sections[1].kind = 'food'; return d; },
      twins: (d) => { d.sections.unshift(section('s-popular', 'פופולרי', 'Popular', [dish('d-burger-2', 'המבורגר', 'Burger', 7200)])); return d; },
      // a duplicate of s-mains (answered merge by the fixes); with skip ['s-mains'] below, its dishes and their links go
      // with it (parent_skipped)
      mergedIntoSkipped: (d) => {
        d.sections.push(section('s-mains-2', 'עיקריות', 'Mains', [dish('d-steak', 'סטייק', 'Steak', 9800, { groups: [link('g-side', 1, 1), link('g-extras')] })]));
        return d;
      },
    };
    const list = [];
    for (const [name, change] of Object.entries(variants)) {
      const d = change(copy(base));
      const fixed = answerFixes(d, menu);
      const asked = planApply(d, menu, fixed);
      const exceptions = asked.ok ? asked.value.exceptions : draftExceptions(d);
      const decisions = [fixed, { ...fixed, pricesConfirmed: false }];
      // every check and fix answered with each of its choices, one at a time; grouped price questions overridden per node
      for (const e of exceptions) {
        for (const c of EXCEPTION_CHOICES[e.code]) decisions.push({ ...fixed, choices: { ...fixed.choices, [`${e.code}@${e.key}`]: c } });
        decisions.push({ ...fixed, choices: { ...fixed.choices, [`${e.code}@${e.key}`]: 'nonsense_choice' } });
      }
      for (const dk of ['d-schnitzel', 'd-burger', 'o-cheese']) {
        decisions.push({ ...fixed, choices: { ...fixed.choices, [`price_differs@${dk}`]: 'take_new' } });
        decisions.push({ ...fixed, choices: { ...fixed.choices, [`price_differs@${dk}`]: 'merge' } });
      }
      for (const skip of [['s-mains'], ['d-burger'], ['g-side'], ['o-fries'], ['d-burger>g-extras'], ['g-sauce', 'o-salad']]) decisions.push({ ...fixed, skip });
      for (const dec of decisions) list.push([d, menu, dec], [d, EMPTY_MENU, dec]);
      list.push([d, menu, fixed, { langs: ['he'] }]);
    }
    const gone = planApply(variants.mergedIntoSkipped(copy(base)), menu, { ...answerFixes(variants.mergedIntoSkipped(copy(base)), menu), skip: ['s-mains'] });
    assert.equal(gone.ok, true);
    assert.deepEqual(gone.value.steps.filter((x) => x.key === 'd-steak' || x.key.startsWith('d-steak>')).map((x) => `${x.kind}:${x.key}:${x.op}:${x.reason}`),
      ['dish:d-steak:skip:parent_skipped', 'dish_group:d-steak>g-side:skip:parent_skipped', 'dish_group:d-steak>g-extras:skip:parent_skipped'],
      'a section merged into a section left out takes its dishes and their links with it');
    assert.equal(gone.value.exceptions.find((e) => e.code === 'section_duplicate' && e.key === 's-mains-2')?.choice, 'merge');
    const n = await comparePlans(list.filter((a) => storable(a)), 'generated');
    assert.ok(n > 300, String(n));
    // Hopa test 1: the same draft again creates nothing
    const again = planApply(base, menu, answerFixes(base, menu));
    assert.equal(again.ok, true);
    assert.deepEqual(again.value.steps.filter((x) => x.op === 'create'), []);
  });
});
