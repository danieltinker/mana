// The cold re-review of the importer (round 2): each QA repro as a test (qa/rr.ts, rr2.ts, new1b.ts, excap.ts,
// p2dbg.ts, and the readers' QA unreachable.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  draftBytes, draftExceptions, DRAFT_TEXT_MAX, EMPTY_MENU, EXCEPTIONS_MAX, jsonbNumberText, linkKey, NOTES_MAX, planApply, READER_NOTE_CODES, READER_NOTES, readerNoteIssues,
  validateDraft, validateSaveDraft, type DiscardImportReply, type ExistingMenu, type ImportChoice, type ImportDecisions, type ImportDraft,
  type ImportPlan, type PlanStep, type ReaderNote,
} from '../src/import.ts';
import { LIMITS } from '../src/enums.ts';
import { STOCK_RE } from '../src/index.ts';
import { applyPlan, bistroDraft, copy, dish, draftOf, group, link, opt, planProblems, section, tx } from './import-fixtures.ts';

const yes = (choices: Record<string, ImportChoice> = {}, skip?: string[]): ImportDecisions => ({ v: 1, pricesConfirmed: true, choices, ...(skip ? { skip } : {}) });
const plan = (d: ImportDraft, m: ExistingMenu = EMPTY_MENU, dec: ImportDecisions = yes()): ImportPlan => {
  const r = planApply(d, m, dec);
  if (r.ok === false) throw new Error(JSON.stringify(r.errors));
  assert.deepEqual(planProblems(r.value), []);
  return r.value;
};
const step = (p: ImportPlan, kind: PlanStep['kind'], key: string) => p.steps.find((s) => s.kind === kind && s.key === key)!;
const setOf = (s: PlanStep) => s.set as Record<string, unknown>;
const asked = (p: ImportPlan) => p.exceptions.map((e) => `${e.code}@${e.key}=${e.choice}`);
const changes = (p: ImportPlan) => p.steps.filter((s) => s.op !== 'keep').map((s) => `${s.kind}:${s.key}:${s.op}${s.reason ? `(${s.reason})` : ''}`);

const twoSalads = () => draftOf([
  section('s-mains', 'עיקריות', 'Mains', [dish('d-m-salad', 'סלט', 'Salad', 4200), dish('d-m-steak', 'סטייק', 'Steak', 9800)]),
  section('s-kids', 'ילדים', 'Kids', [dish('d-k-salad', 'סלט', 'Salad', 2400), dish('d-k-nuggets', 'נאגטס', 'Nuggets', 3200)]),
]);
const landsIn = (m: ExistingMenu, p: ImportPlan) => p.steps.filter((s) => s.kind === 'dish').map((s) => {
  const x = m.dishes.find((y) => y.id === s.id);
  return `${s.key}->${x ? `${m.sections.find((y) => y.id === x.section_id)!.name_en} ${x.price}` : 'new'}`;
});

test('M2 (NEW-1): both sections renamed, a same-name dish in each: each lands where the rest of its section went', () => {
  const m = applyPlan(EMPTY_MENU, plan(twoSalads()));
  const d: any = copy(twoSalads());
  d.sections[0].name = tx('מנות עיקריות', 'Main courses');
  d.sections[1].name = tx('לקטנים', 'Little ones');
  const p = plan(d, m);
  assert.deepEqual(landsIn(m, p), ['d-m-salad->Mains 4200', 'd-m-steak->Mains 9800', 'd-k-salad->Kids 2400', 'd-k-nuggets->Kids 3200']);
  assert.deepEqual(asked(p), ['section_renamed@s-mains=same_section', 'section_renamed@s-kids=same_section'], 'no price question: nothing crossed');
  assert.deepEqual(changes(p), []);
  const r: any = copy(d);
  r.sections.reverse();
  assert.deepEqual(landsIn(m, plan(r, m)).sort(), landsIn(m, p).sort(), 'the same whatever the draft order');
});

test('M2 (new1b): one section renamed, the same-name dish left only in the other section of the venue', () => {
  const m = applyPlan(EMPTY_MENU, plan(twoSalads()));
  const d = draftOf([
    section('s-mains', 'עיקריות', 'Mains', [dish('d-m-steak', 'סטייק', 'Steak', 9800)]),
    section('s-kids', 'לקטנים', 'Little ones', [dish('d-k-salad', 'סלט', 'Salad', 2400), dish('d-k-nuggets', 'נאגטס', 'Nuggets', 3200)]),
  ]);
  const p = plan(d, m);
  assert.deepEqual(landsIn(m, p), ['d-m-steak->Mains 9800', 'd-k-salad->Kids 2400', 'd-k-nuggets->Kids 3200']);
  assert.deepEqual(asked(p), ['section_renamed@s-kids=same_section']);
});

test('M3 (rr.ts M2): skip, the answer to the plan\'s limits_unreachable, leaves the group out with its options and links', () => {
  const e: any = copy(bistroDraft());
  e.groups[2].min = 2; e.groups[2].max = 2;
  e.groups[2].options = [opt('o-cheese', 'גבינה', 'Cheese', 300), opt('o-egg', 'ביצה', 'Egg', null, { priceText: '+?' })];
  const base = { 'option_price_unreadable@o-egg': 'skip' } as const;
  const s = plan(e, EMPTY_MENU, yes({ ...base, 'limits_unreachable@g-extras': 'skip' }));
  assert.deepEqual(['g-extras', 'o-cheese', 'o-egg'].map((k) => `${k}:${step(s, k === 'g-extras' ? 'group' : 'option', k).reason}`).concat(
    `link:${step(s, 'dish_group', linkKey('d-burger', 'g-extras')).reason}`), ['g-extras:choice', 'o-cheese:parent_skipped', 'o-egg:choice', 'link:parent_skipped']);
  const c = plan(e, EMPTY_MENU, yes({ ...base, 'limits_unreachable@g-extras': 'clamp' }));
  assert.deepEqual([setOf(step(c, 'group', 'g-extras')).min_units, setOf(step(c, 'group', 'g-extras')).max_units], [1, 2]);
  // L4: a draft-level limits_unreachable is listed once, not again by the plan
  const f: any = copy(bistroDraft());
  f.groups[2].min = 9; f.groups[2].max = 9;
  const fc = plan(f, EMPTY_MENU, yes({ 'limits_unreachable@g-extras': 'clamp' }));
  assert.deepEqual(asked(fc).filter((a) => a.startsWith('limits_unreachable')), ['limits_unreachable@g-extras=clamp']);
  assert.equal(setOf(step(fc, 'group', 'g-extras')).min_units, 3);
});

test('M3 (fuzz seeds 53367808, 1311955456): skipping an unreachable group whose skip removes an opener elsewhere', () => {
  // the shape both seeds found: g0 needs 2 of its options, one of which is unreadable and left out; g0 is left out, and
  // the option of g1 that opens it goes with it; no group the plan creates has a minimum it cannot reach
  const d = draftOf([section('s0', 'עיקריות', 'Mains', [dish('s0d0', 'סלט', 'Salad', 3000, { groups: [link('g0'), link('g1')] })])], [
    group('g0', 'רוטב', 'Sauce', { selection: 'multiple', min: 2, max: 3, options: [opt('g0o0', 'איולי', 'Aioli', 0), opt('g0o1', 'סלט', 'Salad', null)] }),
    group('g1', 'תוספת', 'Side', { selection: 'single', min: null, max: null, options: [opt('g1o0', 'צ׳יפס', 'Fries', 0, { opens: 'g0' }), opt('g1o1', 'אורז', 'Rice', 0)] }),
  ]);
  assert.ok(validateDraft(d).ok);
  const p = plan(d, EMPTY_MENU, yes({ 'option_price_unreadable@g0o1': 'skip', 'limits_unreachable@g0': 'skip' }));
  assert.deepEqual([step(p, 'group', 'g0').reason, step(p, 'option', 'g1o0').reason, step(p, 'group', 'g1').op], ['choice', 'parent_skipped', 'create']);
  const m = applyPlan(EMPTY_MENU, p);
  for (const g of m.groups) {
    const capacity = (m.options as any[]).filter((o) => o.group_id === g.id).reduce((n, o) => n + o.max_qty, 0);
    assert.ok(g.min_units <= capacity, `${g.name_en}: min ${g.min_units} capacity ${capacity}`);
  }
});

test('M4 (excap.ts): a price rise re-imported at LIMITS scale asks one question per section and group; what is stored fits', () => {
  const groups = Array.from({ length: 100 }, (_, g) => group(`g${g}`, `קבוצה ${g}`, `Group ${g}`, {
    selection: 'multiple', min: 0, max: 3, options: Array.from({ length: 20 }, (_, o) => opt(`g${g}o${o}`, `אפשרות ${g} ${o}`, `Option ${g} ${o}`, 100)),
  }));
  const sections = Array.from({ length: 20 }, (_, s) => section(`s${s}`, `מדור ${s}`, `Section ${s}`,
    Array.from({ length: 20 }, (_, d) => dish(`s${s}d${d}`, `מנה ${s} ${d}`, `Dish ${s} ${d}`, 3000, {
      allergens: { he: 'גלוטן', en: 'Gluten' }, groups: [link(`g${(s * 20 + d) % 100}`)],
    }))));
  const draft = draftOf(sections, groups);
  const m = applyPlan(EMPTY_MENU, plan(draft));
  const up: any = copy(draft);
  for (const s of up.sections) for (const d of s.dishes) d.price += 100;
  for (const g of up.groups) for (const o of g.options) o.price += 100;
  const p = plan(up, m);
  const priced = p.exceptions.filter((e) => e.code === 'price_differs');
  assert.equal(priced.length, 20 + 100);
  assert.ok(priced.every((e) => e.count === 20));
  assert.equal(p.fromDraft, draftExceptions(up).length);
  assert.equal(p.fromDraft, 400, 'the allergens to check');
  assert.ok(p.exceptions.slice(0, p.fromDraft).length <= EXCEPTIONS_MAX, 'what apply_import stores');
  assert.deepEqual(p.exceptions.slice(0, p.fromDraft).map((e) => e.code), draftExceptions(up).map((e) => e.code));
  const taken = applyPlan(m, plan(up, m, yes(Object.fromEntries(priced.map((e) => [`price_differs@${e.key}`, 'take_new'])))));
  assert.ok(taken.dishes.every((x) => x.price === 3100) && (taken.options as any[]).every((o) => o.price === 200));
});

test('readers QA-H2: a stated minimum above the options read is the group\'s question, not an invalid draft', () => {
  // "Choose 2" with one option copied (Wolt text, Hebrew and English), "Choose at least 3" with two, the scanner's
  // "Choose 2" with one option: the shapes the readers emit
  const shapes: Array<[string, ImportDraft]> = [
    ['choose 2, one option', draftOf([section('s', '', 'Menu', [dish('d', '', 'Pasta', 5400, { groups: [link('g')] })])],
      [group('g', '', 'Toppings', { selection: 'multiple', min: 2, max: 2, options: [opt('o', '', 'Parmesan', 0)] })])],
    ['בחרו 2, one option', draftOf([section('s', 'תפריט', '', [dish('d', 'פסטה', '', 5400, { groups: [link('g')] })])],
      [group('g', 'תוספות', '', { selection: 'multiple', min: 2, max: 2, options: [opt('o', 'פרמזן', '', 0)] })])],
    ['at least 3, two options', draftOf([section('s', '', 'Menu', [dish('d', '', 'Bowl', 5000, { groups: [link('g')] })])],
      [group('g', '', 'Base', { selection: 'multiple', min: 3, max: null, options: [opt('o1', '', 'Rice', 0), opt('o2', '', 'Greens', 0)] })])],
  ];
  for (const [label, d] of shapes) {
    assert.deepEqual(validateDraft(d).ok ? [] : (validateDraft(d) as any).errors, [], label);
    assert.ok(draftExceptions(d).some((e) => e.code === 'limits_unreachable' && e.key === 'g'), label);
    const clamped = plan(d, EMPTY_MENU, yes({ 'limits_unreachable@g': 'clamp' }));
    assert.ok((setOf(step(clamped, 'group', 'g')).min_units as number) <= d.groups[0]!.options.length, label);
    assert.equal(step(plan(d, EMPTY_MENU, yes({ 'limits_unreachable@g': 'skip' })), 'dish_group', linkKey('d', 'g')).reason, 'parent_skipped', label);
  }
  // the contracts' own fixture: g-extras min 5 (capacity 3), linked to the burger
  const f: any = copy(bistroDraft());
  f.groups[2].min = 5;
  assert.ok(validateDraft(f).ok);
  assert.ok(draftExceptions(f).some((e) => e.code === 'limits_unreachable' && e.key === 'g-extras'));
});

test('L1 (p2dbg.ts), round 4 L5: a dish link moved by new_group lowers a minimum above the created group\'s kept capacity to it', () => {
  const m = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  const d: any = copy(bistroDraft());
  d.groups[2].options = [opt('o-cheese', 'גבינה', 'Cheese', 300), opt('o-avocado', 'אבוקדו', 'Avocado', 400), opt('o-bacon', 'בייקון', 'Bacon', 500)];
  d.sections[0].dishes[1].groups = [link('g-side'), link('g-extras', 3, null)];
  const answer = yes({ 'group_changed@d-burger>g-extras': 'new_group' }, ['o-bacon']);
  assert.deepEqual(setOf(step(plan(d, m, answer), 'dish_group', linkKey('d-burger', 'g-extras'))), { min_units: 2, max_units: null });
  const all = yes({ 'group_changed@d-burger>g-extras': 'new_group' });
  assert.deepEqual(setOf(step(plan(d, m, all), 'dish_group', linkKey('d-burger', 'g-extras'))), { min_units: 3, max_units: null }, 'reachable: kept');
  assert.deepEqual(changes(plan(d, m, all)).filter((c) => c.startsWith('group')), ['group:g-extras:create']);
});

test('L2 (h2b.ts): two draft groups landing on one existing group give a dish one link, not two', () => {
  const base = draftOf([section('s', 'עיקריות', 'Mains', [dish('d-steak', 'סטייק', 'Steak', 9000, { groups: [link('g')] })])],
    [group('g', 'תוספת', 'Extras', { options: [opt('o1', 'צ׳יפס', 'Fries', 0), opt('o2', 'סלט', 'Salad', 0), opt('o3', 'אורז', 'Rice', 0)] })]);
  const m = applyPlan(EMPTY_MENU, plan(base));
  const d = draftOf([section('s', 'עיקריות', 'Mains', [dish('d-new', 'פרגית', 'Chicken', 7000, { groups: [link('g-side'), link('g-extras')] })])], [
    group('g-side', 'תוספת', 'Side', { options: [opt('a1', 'צ׳יפס', 'Fries', 0), opt('a2', 'סלט', 'Salad', 0)] }),
    // an English-only name (L10: with a Hebrew name that differs, "Extras" alone would not match at all)
    group('g-extras', '', 'Extras', { options: [opt('b1', 'אורז', 'Rice', 0)] }),
  ]);
  const p = plan(d, m);
  assert.deepEqual(p.steps.filter((s) => s.kind === 'dish_group').map((s) => `${s.key}:${s.op}${s.reason ? `(${s.reason})` : ''}`),
    ['d-new>g-side:create', 'd-new>g-extras:skip(merged)']);
  const after = applyPlan(m, p);
  const chicken = after.dishes.find((x) => x.name_en === 'Chicken')!;
  assert.equal(after.dishGroups.filter((l) => l.dish_id === chicken.id).length, 1);
});

test('L3 (rr2.ts P1): which draft section claims an existing one does not depend on the draft order', () => {
  const m = applyPlan(EMPTY_MENU, plan(draftOf([section('s-a', 'עיקריות', 'Mains', [dish('d-a', 'סטייק', 'Steak', 9000)])])));
  const he = section('s-he', 'עיקריות', 'Main courses', [dish('d-fish', 'דג', 'Fish', 8000)]);
  const en = section('s-en', 'מנות', 'Mains', [dish('d-soup', 'מרק', 'Soup', 3000)]);
  const outcome = (order: ReturnType<typeof section>[]) => {
    const after = applyPlan(m, plan(draftOf(order), m));
    return after.sections.map((s) => `${s.name_en}: ${after.dishes.filter((x) => x.section_id === s.id).map((x) => x.name_en).join(', ')}`);
  };
  assert.deepEqual(outcome([he, en]), outcome([en, he]));
  assert.deepEqual(outcome([he, en]), ['Mains: Steak, Fish', 'Mains: Soup'], 'the Hebrew match claims it; "מנות" is another section (L10)');
});

test('L9 (rr.ts NEW-2): a name of symbols or emoji only is matched by its exact text, and flagged', () => {
  const d = draftOf([section('s-hot', '🔥', '🔥', [dish('d-x', '★', '★', 1000), dish('d-y', 'פיצה', 'Pizza', 4000), dish('d-z', '☆', '', 1200)])]);
  assert.deepEqual(draftExceptions(d).map((e) => `${e.code}@${e.key}`), ['name_missing_lang@_draft', 'name_symbols@s-hot', 'name_symbols@d-x', 'name_symbols@d-z']);
  const m = applyPlan(EMPTY_MENU, plan(d));
  assert.deepEqual(changes(plan(d, m)), [], 're-importing it changes nothing');
  const e: any = copy(d);
  e.sections[0].dishes[0].name = tx(' ★ ', '★');
  assert.deepEqual(changes(plan(e, m)), [], 'blank edges do not count');
  e.sections[0].dishes[0].name = tx('★★', '★★');
  assert.deepEqual(changes(plan(e, m)), ['dish:d-x:create'], 'another text is another dish');
});

test('L5 (edges.ts 1): a draft\'s text is measured as stored, blank edges stripped', () => {
  const d: any = copy(bistroDraft());
  d.sections[0].dishes[0].name.en = `${'x'.repeat(LIMITS.nameLength)} `;
  assert.ok(validateDraft(d).ok);
  d.sections[0].dishes[0].name.en = 'x'.repeat(LIMITS.nameLength + 1);
  assert.deepEqual((validateDraft(d) as any).errors, [{ code: 'text_too_long', path: 'sections[0].dishes[0].name.en' }]);
});

test('L13 (pg-probes2.mjs): draftBytes writes numbers as PostgreSQL does, never in exponent form', () => {
  assert.deepEqual([1e21, 1.5e21, 1e-7, 1.5e-7, -2e22, 123, 0.1 + 0.2, -0, 1e20].map(jsonbNumberText),
    ['1000000000000000000000', '1500000000000000000000', '0.0000001', '0.00000015', '-20000000000000000000000', '123', '0.30000000000000004', '0', '100000000000000000000']);
  assert.equal(draftBytes({ a: [1e21] }), '{"a": [1000000000000000000000]}'.length);
});

test('L8 and B22: discard_import\'s reply; what the reader said is saved with the draft (codes, keys and counts, never text)', () => {
  const r: DiscardImportReply = { ok: false, code: 'import_busy' };
  assert.ok(!r.ok);
  const id = '00000000-0000-4000-8000-0000000000d9';
  const note = (o: Partial<ReaderNote> = {}): ReaderNote => ({ code: 'sold_out', severity: 'check', key: 'd-burger', lines: [4, 9], count: 2, rule: null, ...o });
  const errs = (raw: unknown) => { const v = validateSaveDraft(raw); return v.ok ? [] : v.errors.map((e) => `${e.code}@${e.path}`); };
  assert.deepEqual(errs({ importId: id, draft: bistroDraft() }), [], 'notes left out: none');
  assert.deepEqual(errs({ importId: id, draft: bistroDraft(), notes: [note(), note({ code: 'noise', severity: 'info', key: null, rule: 'delivery', lines: [1, 2, 3], count: 3 })] }), []);
  assert.deepEqual(errs({ importId: id, draft: bistroDraft(), notes: [
    note({ key: 'd-nope' }), note({ severity: 'info' }), note({ lines: [9, 4] }), note({ count: 0 }), note({ rule: 'Free text' }),
    { ...note(), text: 'Burger — SOLD OUT' }, note({ code: 'two_prices' as never }),
  ] }), ['ref_unknown@notes[0].key', 'enum_invalid@notes[1].severity', 'lines_invalid@notes[2].lines', 'count_invalid@notes[3].count',
    'rule_invalid@notes[4].rule', 'field_not_allowed@notes[5].text', 'enum_invalid@notes[6].code']);
  assert.deepEqual(errs({ importId: id, draft: bistroDraft(), notes: Array.from({ length: NOTES_MAX + 1 }, () => note()) }), ['too_many@notes']);
  assert.ok(READER_NOTE_CODES.includes('caps_reached') && READER_NOTE_CODES.includes('popular_dropped') && READER_NOTE_CODES.includes('popular_only'));
  assert.deepEqual(readerNoteIssues([note({ key: 'd-elsewhere' })], null), [], 'without the draft, keys are only checked for shape');
});

test('for the readers: price_ambiguous, the stock id pattern and the draft text limits come from the contracts', () => {
  assert.equal(READER_NOTES.price_ambiguous, 'check');
  assert.ok(STOCK_RE.test('croissant') && !STOCK_RE.test('Croissant') && !STOCK_RE.test('-x'));
  assert.deepEqual(DRAFT_TEXT_MAX, { section: 60, group: 60, option: 60, dish: 90, desc: 600, priceNote: 80, allergens: 300, priceText: 40 });
  assert.deepEqual([LIMITS.shortNameLength, LIMITS.allergensLength], [60, 300]);
  const d: any = copy(bistroDraft());
  d.sections[0].name.en = 'x'.repeat(DRAFT_TEXT_MAX.section);
  d.sections[0].dishes[0].allergens.en = 'y'.repeat(DRAFT_TEXT_MAX.allergens);
  assert.ok(validateDraft(d).ok);
  d.sections[0].name.en += 'x';
  d.sections[0].dishes[0].allergens.en += 'y';
  assert.deepEqual((validateDraft(d) as any).errors.map((e: any) => `${e.code}@${e.path}`),
    ['text_too_long@sections[0].name.en', 'text_too_long@sections[0].dishes[0].allergens.en']);
});

test('L10 (rr2.ts P6): when the Hebrew names differ, an English match does not make them the same', () => {
  const m = applyPlan(EMPTY_MENU, plan(draftOf([section('s', 'סלטים', 'Salads', [dish('d1', 'סלט ירקות', 'Salad', 3800)])])));
  const p = plan(draftOf([section('s', 'סלטים', 'Salads', [dish('d1', 'סלט קיסר', 'Salad', 4600)])]), m);
  assert.deepEqual([step(p, 'dish', 'd1').op, asked(p)], ['create', []]);
  // the same Hebrew with another English still matches (the Hebrew counts 2)
  const q = plan(draftOf([section('s', 'סלטים', 'Salads', [dish('d1', 'סלט ירקות', 'Green salad', 3800)])]), m);
  assert.equal(step(q, 'dish', 'd1').op, 'keep');
  // one side without Hebrew: the English decides
  const r = plan(draftOf([section('s', '', 'Salads', [dish('d1', '', 'Salad', 3800)])]), m);
  assert.equal(step(r, 'dish', 'd1').op, 'keep');
  // the same rule everywhere a name is compared: duplicates, repeats, and an existing group
  const two = draftOf([
    section('s1', 'סלטים', 'Salads', [dish('d1', 'סלט קיסר', 'Salad', 4600), dish('d2', 'סלט ירקות', 'Salad', 3800)]),
    section('s2', 'מומלצים', 'Popular', [dish('d3', 'סלט טונה', 'Salad', 4600)]),
  ]);
  assert.deepEqual(draftExceptions(two).filter((e) => e.code === 'dish_duplicate' || e.code === 'dish_repeated'), []);
  const withSide = applyPlan(EMPTY_MENU, plan(draftOf([section('s', 'עיקריות', 'Mains', [dish('d', 'סטייק', 'Steak', 9000, { groups: [link('g')] })])],
    [group('g', 'רוטב', 'Side', { options: [opt('o', 'צ׳יפס', 'Fries', 0)] })])));
  const side = plan(draftOf([section('s', 'עיקריות', 'Mains', [dish('d2', 'פרגית', 'Chicken', 7000, { groups: [link('g2')] })])],
    [group('g2', 'תוספת', 'Side', { options: [opt('o2', 'צ׳יפס', 'Fries', 0)] })]), withSide);
  assert.equal(step(side, 'group', 'g2').op, 'create', '"תוספת / Side" is not the venue\'s "רוטב / Side"');
});
