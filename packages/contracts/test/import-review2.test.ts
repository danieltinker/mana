// The cold re-review of the importer (round 2): each QA repro as a test (qa/rr.ts, rr2.ts, new1b.ts, excap.ts,
// p2dbg.ts, and the readers' QA unreachable.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  draftExceptions, EMPTY_MENU, EXCEPTIONS_MAX, linkKey, planApply, validateDraft, type ExistingMenu, type ImportChoice, type ImportDecisions,
  type ImportDraft, type ImportPlan, type PlanStep,
} from '../src/import.ts';
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

test('L1 (p2dbg.ts): a dish link moved by new_group drops a minimum above the created group\'s kept capacity', () => {
  const m = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  const d: any = copy(bistroDraft());
  d.groups[2].options = [opt('o-cheese', 'גבינה', 'Cheese', 300), opt('o-avocado', 'אבוקדו', 'Avocado', 400), opt('o-bacon', 'בייקון', 'Bacon', 500)];
  d.sections[0].dishes[1].groups = [link('g-side'), link('g-extras', 3, null)];
  const answer = yes({ 'group_changed@d-burger>g-extras': 'new_group' }, ['o-bacon']);
  assert.deepEqual(setOf(step(plan(d, m, answer), 'dish_group', linkKey('d-burger', 'g-extras'))), { min_units: null, max_units: null });
  const all = yes({ 'group_changed@d-burger>g-extras': 'new_group' });
  assert.deepEqual(setOf(step(plan(d, m, all), 'dish_group', linkKey('d-burger', 'g-extras'))), { min_units: 3, max_units: null }, 'reachable: kept');
  assert.deepEqual(changes(plan(d, m, all)).filter((c) => c.startsWith('group')), ['group:g-extras:create']);
});
