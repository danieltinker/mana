// QA round 3 (NO-GO on five Mediums), each repro as a test: qa/r3-probes.ts, r3-probes2..5.ts, fuzz3-one.ts,
// r3-numbers.mjs (the fuzz itself, fuzz3.ts, is import-fuzz.test.ts). And the round-4 contract items: the readers'
// price_ambiguous note, open_case's own id, old Safari's instants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  draftBytes, draftExceptions, EMPTY_MENU, jsonbNumberText, linkKey, planApply, validateDraft, validateSaveDraft, type ExistingMenu, type ImportChoice,
  type ImportDecisions, type ImportDraft, type ImportPlan, type PlanStep, type ReaderNote, LAYOUT_GUESS_RULES, READER_NOTES, readerNoteIssues,
} from '../src/import.ts';
import { instantMs } from '../src/events.ts';
import { REVISION_MAX, validateActForOwner, validateApproveVenue } from '../src/staff.ts';
import { validateOpsRevisionQuery } from '../src/ops.ts';
import { indexMenu, NO_SUGGESTION_CODES, whyNoSuggestion } from '../src/upsell.ts';
import { cafeDemo, ID, RULES } from './fixtures.ts';
import { applyPlan, bistroDraft, copy, dish, draftOf, group, link, menuRuleBreaks, opt, planProblems, section } from './import-fixtures.ts';

const yes = (choices: Record<string, ImportChoice> = {}, skip?: string[]): ImportDecisions => ({ v: 1, pricesConfirmed: true, choices, ...(skip ? { skip } : {}) });
const plan = (d: ImportDraft, m: ExistingMenu = EMPTY_MENU, dec: ImportDecisions = yes()): ImportPlan => {
  const v = validateDraft(d);
  assert.ok(v.ok, JSON.stringify(v.ok ? [] : v.errors));
  const r = planApply(d, m, dec);
  if (r.ok === false) throw new Error(JSON.stringify(r.errors));
  assert.deepEqual(planProblems(r.value), []);
  return r.value;
};
const step = (p: ImportPlan, kind: PlanStep['kind'], key: string) => p.steps.find((s) => s.kind === kind && s.key === key)!;
const brief = (s: PlanStep) => `${s.kind}:${s.key}:${s.op}${s.reason ? `(${s.reason})` : ''}`;
const asked = (p: ImportPlan) => p.exceptions.map((e) => `${e.code}@${e.key}=${e.choice}`);
const sectionsOf = (m: ExistingMenu) => m.sections.map((s) => [s.name_en, m.dishes.filter((x) => x.section_id === s.id).map((x) => `${x.name_en} ${x.price}`)]);
const limitsOf = (m: ExistingMenu) => ({
  groups: m.groups.map((g) => [g.name_en, g.min_units, g.max_units]),
  links: (m.dishGroups as unknown as ReadonlyArray<{ min_units: number | null; max_units: number | null }>).map((l) => [l.min_units, l.max_units]),
});
const SALAD = (id: string, sectionId: string, price: number, position = 0) => ({
  id, section_id: sectionId, position, name_he: 'סלט', name_en: 'Salad', desc_he: '', desc_en: '', price, price_note_he: '', price_note_en: '', tags: [],
  allergens_he: '', allergens_en: '', asset_id: null, stock_id: null,
});
const A = '00000000-0000-4000-8000-0000000000a1', B = '00000000-0000-4000-8000-0000000000a2';
const B1 = '00000000-0000-4000-8000-0000000000b1', B2 = '00000000-0000-4000-8000-0000000000b2';
const twoSections = (dishes: ExistingMenu['dishes']): ExistingMenu => ({
  ...EMPTY_MENU,
  sections: [{ id: A, position: 0, name_he: 'עיקריות', name_en: 'Mains', kind: 'food' }, { id: B, position: 1, name_he: 'ילדים', name_en: 'Kids', kind: 'food' }],
  dishes,
});

// ---------------------------------------------------------------- M1: a valid draft's plan is one the database accepts

test('M1 (r3-probes5 V1, V2, V5, V6): each unstated limit yields to the links; the database accepts every link', () => {
  const run = (g: ReturnType<typeof group>, l: ReturnType<typeof link>) => {
    const m = applyPlan(EMPTY_MENU, plan(draftOf([section('s', 'עיקריות', 'Mains', [dish('d', 'סלט', 'Salad', 4000, { groups: [l] })])], [g])));
    assert.deepEqual(menuRuleBreaks(m), []);
    return limitsOf(m);
  };
  const toppings = [opt('a', 'זיתים', 'Olives', 0), opt('b', 'פטה', 'Feta', 300)];
  assert.deepEqual(run(group('g', 'תוספות', 'Toppings', { selection: 'multiple', min: 1, max: null, options: toppings }), link('g', null, 5)),
    { groups: [['Toppings', 1, 5]], links: [[null, 5]] }, 'V1: the stated min stays, the guessed max yields');
  assert.deepEqual(run(group('g', 'תוספות', 'Toppings', { selection: 'multiple', min: null, max: 3, options: [...toppings, opt('c', 'בצל', 'Onion', 0)] }), link('g', 2, null)),
    { groups: [['Toppings', 0, 3]], links: [[2, null]] }, 'V2');
  const sides = [opt('a', 'צ׳יפס', 'Fries', 0), opt('b', 'סלט', 'Salad', 0)];
  assert.deepEqual(run(group('g', 'תוספת', 'Side', { selection: 'single', min: null, max: 1, options: sides }), link('g', 0, null)),
    { groups: [['Side', 0, 1]], links: [[0, null]] }, 'V5: a stated max does not make the guessed min stated');
  assert.deepEqual(run(group('g', 'תוספת', 'Side', { selection: 'single', min: null, max: null, options: sides }), link('g', 0, null)),
    { groups: [['Side', 0, 1]], links: [[0, null]] }, 'V6');
});

test('M1 (fuzz3 seed 834265856): a single choice\'s dish minimum above 1 is an invalid draft', () => {
  const d = draftOf([section('s', 'עיקריות', 'Mains', [dish('d', 'סלט', 'Salad', 4000, { groups: [link('g', 2, null)] })])],
    [group('g', 'רוטב', 'Sauce', { selection: 'single', min: null, max: null, options: [opt('a', 'איולי', 'Aioli', 300), opt('b', 'קטשופ', 'Ketchup', null)] })]);
  assert.deepEqual((validateDraft(d) as { errors: unknown }).errors, [{ code: 'limits_invalid', path: 'sections[0].dishes[0].groups[0]' }]);
  const one: any = copy(d);
  one.sections[0].dishes[0].groups[0].min = 1;
  assert.ok(validateDraft(one).ok);
});

test('M1 (fuzz3 seed 146027584, fuzz3-one.ts): a stated min with a guessed max; a stated max with a guessed min', () => {
  const extras = group('g', 'תוספות', 'Extras', { selection: 'multiple', min: 1, max: null, options: [opt('a', 'צ׳יפס', 'Fries', 0), opt('b', 'סלט', 'Salad', 0), opt('c', 'אורז', 'Rice', 300)] });
  const looser = applyPlan(EMPTY_MENU, plan(draftOf([section('s', 'עיקריות', 'Mains', [
    dish('d1', 'המבורגר', 'Burger', 4200, { groups: [link('g', 1, 4)] }), dish('d2', 'שניצל', 'Schnitzel', 4200, { groups: [link('g', null, 1)] }),
  ])], [extras])));
  assert.deepEqual([limitsOf(looser), menuRuleBreaks(looser)], [{ groups: [['Extras', 1, 4]], links: [[1, 4], [null, 1]] }, []]);
  const sauce = group('g', 'רוטב', 'Sauce', { selection: 'multiple', min: null, max: 2, options: [opt('a', 'איולי', 'Aioli', 0), opt('k', 'קטשופ', 'Ketchup', 0)] });
  const two = applyPlan(EMPTY_MENU, plan(draftOf([section('s', 'עיקריות', 'Mains', [
    dish('d1', 'סלט', 'Salad', 4000, { groups: [link('g', 2, null)] }), dish('d2', 'שניצל', 'Schnitzel', 6000, { groups: [link('g', null, 1)] }),
  ])], [sauce])));
  assert.deepEqual([limitsOf(two), menuRuleBreaks(two)], [{ groups: [['Sauce', 0, 2]], links: [[2, null], [null, 1]] }, []]);
  const optional = applyPlan(EMPTY_MENU, plan(draftOf([section('s', 'עיקריות', 'Mains', [dish('d1', 'סלט', 'Salad', 4000, { groups: [link('g', 1, null)] })])],
    [group('g', 'רוטב', 'Sauce', { selection: 'single', min: 0, max: null, options: [opt('a', 'איולי', 'Aioli', 0), opt('k', 'קטשופ', 'Ketchup', 0)] })])));
  assert.deepEqual([limitsOf(optional), menuRuleBreaks(optional)], [{ groups: [['Sauce', 0, 1]], links: [[1, null]] }, []]);
});

test('L5 (r3-probes5 V3): a link to the venue\'s group gets its minimum lowered to what the group\'s options reach', () => {
  const base = draftOf([section('s', 'עיקריות', 'Mains', [dish('d0', 'סטייק', 'Steak', 9000, { groups: [link('g')] })])],
    [group('g', 'תוספות', 'Extras', { selection: 'multiple', min: 0, max: 5, options: [opt('a', 'גבינה', 'Cheese', 300), opt('b', 'ביצה', 'Egg', 400)] })]);
  const once = applyPlan(EMPTY_MENU, plan(base));
  const d = draftOf([section('s', 'עיקריות', 'Mains', [dish('d1', 'המבורגר', 'Burger', 7000, { groups: [link('g', 3, null)] })])],
    [group('g', 'תוספות', 'Extras', { selection: 'multiple', min: 0, max: 5, options: [opt('a', 'גבינה', 'Cheese', 300, { maxQty: 3 }), opt('b', 'ביצה', 'Egg', 400)] })]);
  const p = plan(d, once);
  const set = step(p, 'dish_group', linkKey('d1', 'g')).set as { min_units: number | null; max_units: number | null; group_id?: string };
  assert.deepEqual([set.min_units, set.max_units, set.group_id], [2, null, once.groups[0]!.id], 'the venue\'s Extras: 2 options, so at least 2');
  assert.deepEqual(menuRuleBreaks(applyPlan(once, p)), []);
});

// ---------------------------------------------------------------- M2, M3: renamed sections

test('M2 (r3-probes R1, r3-probes2 R1b): a new section with one dish the venue has elsewhere is not "renamed"', () => {
  const once = applyPlan(EMPTY_MENU, plan(draftOf([section('s-starters', 'ראשונות', 'Starters', [dish('d-hummus', 'חומוס', 'Hummus', 3200), dish('d-salad', 'סלט', 'Salad', 3800)])])));
  const specials = section('s-specials', 'מיוחדים', 'Specials', [
    dish('d-sp1', 'ניוקי', 'Gnocchi', 6200), dish('d-sp2', 'ריזוטו', 'Risotto', 6400), dish('d-sp3', 'טרטר', 'Tartare', 7200),
    dish('d-sp4', 'קרפצ׳יו', 'Carpaccio', 5800), dish('d-salad2', 'סלט', 'Salad', 3800),
  ]);
  for (const d of [draftOf([specials], [], { source: 'scan' }), draftOf([section('s-starters', 'ראשונות', 'Starters', [dish('d-hummus', 'חומוס', 'Hummus', 3200)]), specials])]) {
    const p = plan(d, once);
    assert.deepEqual(asked(p), ['dish_elsewhere@d-salad2=same_dish']);
    assert.deepEqual(sectionsOf(applyPlan(once, p)), [['Starters', ['Hummus 3200', 'Salad 3800']], ['Specials', ['Gnocchi 6200', 'Risotto 6400', 'Tartare 7200', 'Carpaccio 5800']]]);
  }
});

test('M3 (r3-probes2 R3b, r3-probes R3): renamed twins do not cross: the same price wins a tie, whatever the ids', () => {
  const d = draftOf([
    section('s-a', 'מנות עיקריות', 'Main courses', [dish('d-a-salad', 'סלט', 'Salad', 4200)]),
    section('s-b', 'לקטנים', 'Little ones', [dish('d-b-salad', 'סלט', 'Salad', 2400)]),
  ]);
  for (const [mains, kids] of [[B1, B2], [B2, B1]] as const) {
    const m = twoSections([SALAD(mains, A, 4200), SALAD(kids, B, 2400)]);
    const p = plan(d, m);
    assert.deepEqual([step(p, 'dish', 'd-a-salad').id, step(p, 'dish', 'd-b-salad').id], [mains, kids]);
    assert.deepEqual(asked(p), ['section_renamed@s-a=same_section', 'section_renamed@s-b=same_section']);
    const ans = yes({ 'section_renamed@s-a': 'rename', 'section_renamed@s-b': 'rename' });
    assert.deepEqual(sectionsOf(applyPlan(m, plan(d, m, ans))), [['Main courses', ['Salad 4200']], ['Little ones', ['Salad 2400']]]);
  }
});

test('M3: when only a tie tells renamed twins apart, no section is proposed and each dish asks where it is', () => {
  const d = draftOf([
    section('s-a', 'מנות עיקריות', 'Main courses', [dish('d-a-salad', 'סלט', 'Salad', 4200)]),
    section('s-b', 'לקטנים', 'Little ones', [dish('d-b-salad', 'סלט', 'Salad', 4200)]),
  ]);
  for (const [mains, kids] of [[B1, B2], [B2, B1]] as const) {
    const m = twoSections([SALAD(mains, A, 4200), SALAD(kids, B, 4200)]);
    const p = plan(d, m, yes({ 'dish_repeated@d-b-salad': 'keep_both' }));
    assert.deepEqual(asked(p), ['dish_repeated@d-b-salad=keep_both', 'dish_elsewhere@d-a-salad=same_dish', 'dish_elsewhere@d-b-salad=same_dish']);
    assert.deepEqual(p.steps.filter((s) => s.op !== 'keep').map(brief), ['section:s-a:skip(empty)', 'section:s-b:skip(empty)']);
  }
});

test('M2, M3 (r3-probes4): renamed sections with a new dish each: no crossing, whatever the ids', () => {
  const d = draftOf([
    section('s-a', 'מנות עיקריות', 'Main courses', [dish('d-a-salad', 'סלט', 'Salad', 4200), dish('d-risotto', 'ריזוטו', 'Risotto', 6800)]),
    section('s-b', 'לקטנים', 'Little ones', [dish('d-b-salad', 'סלט', 'Salad', 2400), dish('d-pancakes', 'פנקייק', 'Pancakes', 3200)]),
  ]);
  for (const [mains, kids] of [[B1, B2], [B2, B1]] as const) {
    const m = twoSections([SALAD(mains, A, 4200), SALAD(kids, B, 2400)]);
    const p = plan(d, m);
    assert.deepEqual(asked(p), ['dish_elsewhere@d-a-salad=same_dish', 'dish_elsewhere@d-b-salad=same_dish']);
    assert.deepEqual(sectionsOf(applyPlan(m, p)),
      [['Mains', ['Salad 4200']], ['Kids', ['Salad 2400']], ['Main courses', ['Risotto 6800']], ['Little ones', ['Pancakes 3200']]]);
  }
});

// ---------------------------------------------------------------- the Lows

test('L1 (r3-probes R2): "Popular" first, every dish of a real section in it: the real sections keep their dishes', () => {
  const side = group('g-side', 'תוספת', 'Side', { options: [opt('o-fries', 'צ׳יפס', 'Fries', 0), opt('o-salad', 'סלט', 'Salad', 0)] });
  const d = draftOf([
    section('s-popular', 'פופולרי', 'Popular', [
      dish('d-p-burger', 'המבורגר', 'Burger', 7200, { groups: [link('g-side')] }), dish('d-p-double', 'דאבל', 'Double', 8200, { groups: [link('g-side')] }),
      dish('d-p-pizza', 'פיצה', 'Pizza', 5600),
    ]),
    section('s-burgers', 'המבורגרים', 'Burgers', [
      dish('d-burger', 'המבורגר', 'Burger', 7200, { groups: [link('g-side')] }), dish('d-double', 'דאבל', 'Double', 8200, { groups: [link('g-side')] }),
    ]),
    section('s-pizza', 'פיצות', 'Pizza', [dish('d-pizza', 'פיצה', 'Pizza', 5600), dish('d-marg', 'מרגריטה', 'Margherita', 5200)]),
  ], [side]);
  assert.deepEqual(draftExceptions(d).map((e) => `${e.code}@${e.key}`), ['dish_repeated@d-p-burger', 'dish_repeated@d-p-double', 'dish_repeated@d-p-pizza']);
  assert.deepEqual(sectionsOf(applyPlan(EMPTY_MENU, plan(d))), [['Burgers', ['Burger 7200', 'Double 8200']], ['Pizza', ['Pizza 5600', 'Margherita 5200']]]);
});

test('L2 (r3-probes R4, r3-probes3 U1): limits_unreachable is not asked where the answer changes nothing', () => {
  const g1 = group('g1', 'רוטב', 'Sauce', { selection: 'multiple', min: 2, max: 2, options: [opt('p', 'איולי', 'Aioli', 0), opt('q', 'קטשופ', 'Ketchup', 0)] });
  const g0 = group('g0', 'תוספת', 'Side', { selection: 'multiple', min: 2, max: 2, options: [opt('x', 'צ׳יפס', 'Fries', 0, { opens: 'g1' }), opt('y', 'סלט', 'Salad', 0)] });
  for (const order of [[g1, g0], [g0, g1]]) {
    const d = draftOf([section('s', 'עיקריות', 'Mains', [dish('d', 'שניצל', 'Schnitzel', 6000, { groups: [link('g0')] })])], order);
    const p = plan(d, EMPTY_MENU, yes({ 'limits_unreachable@g1': 'skip' }, ['q', 'y']));
    assert.deepEqual(asked(p), ['limits_unreachable@g1=skip'], 'g0 is emptied by the same pass: not asked');
    assert.deepEqual(p.steps.filter((s) => s.kind === 'group').map(brief).sort(), ['group:g0:skip(empty)', 'group:g1:skip(choice)']);
  }
  // the venue's own Sauce (Aioli, Ketchup, BBQ; 0–3); the new draft says 2–2 and the owner leaves Ketchup out
  const base = draftOf([section('s', 'עיקריות', 'Mains', [dish('d', 'שניצל', 'Schnitzel', 6000, { groups: [link('g')] })])],
    [group('g', 'רוטב', 'Sauce', { selection: 'multiple', min: 0, max: 3, options: [opt('a', 'איולי', 'Aioli', 0), opt('k', 'קטשופ', 'Ketchup', 0), opt('b', 'ברביקיו', 'BBQ', 0)] })]);
  const once = applyPlan(EMPTY_MENU, plan(base));
  const d = draftOf([section('s', 'עיקריות', 'Mains', [dish('d', 'שניצל', 'Schnitzel', 6000, { groups: [link('g')] })])],
    [group('g', 'רוטב', 'Sauce', { selection: 'multiple', min: 2, max: 2, options: [opt('a', 'איולי', 'Aioli', 0), opt('k', 'קטשופ', 'Ketchup', 0)] })]);
  const p = plan(d, once, yes({}, ['k']));
  assert.deepEqual(asked(p), [], 'it lands on the venue\'s Sauce, whose limits stay');
  assert.equal(step(p, 'group', 'g').op, 'keep');
});

test('L4 (r3-probes R7, r3-probes5 V4): a dish with a picture in any state gets no illustration, and keeps its photo', () => {
  const once = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  const schnitzel = once.dishes.find((x) => x.name_en === 'Schnitzel')!.id;
  const pending: ExistingMenu = { ...once, assets: [{ id: '00000000-0000-4000-8000-0000000000e1', dish_id: schnitzel, status: 'ready_for_review' }] };
  const d: any = copy(bistroDraft());
  d.sections[0].dishes[0].illustration = 'schnitzel';
  assert.equal(step(plan(d, pending), 'dish', 'd-schnitzel').op, 'keep');
  assert.deepEqual(step(plan(d, once), 'dish', 'd-schnitzel').set, { stock_id: 'schnitzel' }, 'no picture at all: the illustration');
  const approved: any = copy(once);
  approved.dishes.find((x: any) => x.id === schnitzel).asset_id = '00000000-0000-4000-8000-0000000000e2';
  approved.assets.push({ id: '00000000-0000-4000-8000-0000000000e2', dish_id: schnitzel, status: 'approved' });
  const w: any = copy(bistroDraft());
  w.source = 'wolt_screenshots';
  w.sections[0].dishes[0].photo = { path: 'v/imports/i/schnitzel.jpg', rights: 'unknown' };
  assert.deepEqual(brief(step(plan(w, approved), 'photo', 'd-schnitzel')), 'photo:d-schnitzel:keep');
  assert.equal(step(plan(w, approved), 'photo', 'd-schnitzel').id, '00000000-0000-4000-8000-0000000000e2');
  assert.deepEqual(brief(step(plan(w, once), 'photo', 'd-schnitzel')), 'photo:d-schnitzel:skip(choice)', 'no photo yet, rights unknown: none');
});

test('L6 (r3-probes R5): a new dish never gets two groups of one name, one the venue\'s and one created', () => {
  const base = draftOf([section('s', 'עיקריות', 'Mains', [dish('d-steak', 'סטייק', 'Steak', 9000, { groups: [link('g')] })])],
    [group('g', 'תוספת', 'Extras', { options: [opt('o1', 'צ׳יפס', 'Fries', 0), opt('o2', 'סלט', 'Salad', 0), opt('o3', 'אורז', 'Rice', 0)] })]);
  const once = applyPlan(EMPTY_MENU, plan(base));
  for (const [extra, created] of [[opt('b1', 'אורז', 'Rice', 0), 'keep'], [opt('b2', 'פירה', 'Mash', 0), 'create']] as const) {
    const d = draftOf([section('s', 'עיקריות', 'Mains', [dish('d-new', 'פרגית', 'Chicken', 7000, { groups: [link('g-side'), link('g-x')] })])], [
      group('g-side', 'תוספת', 'Side', { options: [opt('a1', 'צ׳יפס', 'Fries', 0), opt('a2', 'סלט', 'Salad', 0)] }),
      group('g-x', '', 'Extras', { options: [extra] }),
    ]);
    const p = plan(d, once);
    assert.deepEqual(p.steps.filter((s) => s.kind === 'dish_group' || s.kind === 'group').map(brief),
      ['group:g-side:keep', `group:g-x:${created}`, 'dish_group:d-new>g-side:create', 'dish_group:d-new>g-x:skip(merged)']);
    const after = applyPlan(once, p);
    const chicken = after.dishes.find((x) => x.name_en === 'Chicken')!;
    assert.deepEqual(after.dishGroups.filter((l) => l.dish_id === chicken.id).map((l) => after.groups.find((g) => g.id === l.group_id)!.name_en), ['Extras']);
    assert.deepEqual(menuRuleBreaks(after), []);
  }
});

test('L7 (r3-probes3 U3): NO_SUGGESTION_CODES is the order of the checks, for a dish and for an add-on', () => {
  const menu = indexMenu(cafeDemo());
  const cheese = RULES[1]!;
  const ctx = { trigger: 'sheet' as const, menu, dishId: ID.espresso, basket: [], now: Date.parse('2026-10-15T10:00:00Z'), unavailable: { dishes: new Set<string>(), options: new Set<string>() } };
  const gone = { ...cheese, scope: { kind: 'all' as const }, suggest: { ...(cheese.suggest as { kind: 'option'; groupId: string; optionId: string }), optionId: '00000000-0000-4000-8000-0000000fffff' } };
  assert.deepEqual(whyNoSuggestion(gone, ctx), { code: 'option_not_on_dish' });
  const at = (c: (typeof NO_SUGGESTION_CODES)[number]) => NO_SUGGESTION_CODES.indexOf(c);
  const ordered = (list: Array<(typeof NO_SUGGESTION_CODES)[number]>) => list.every((c, i) => i === 0 || at(list[i - 1]!) < at(c));
  assert.ok(ordered(['lacks', 'hidden', 'no_price', 'same_dish', 'in_basket', 'unavailable', 'filtered']), 'a dish suggestion');
  assert.ok(ordered(['lacks', 'option_not_on_dish', 'hidden', 'option_unavailable', 'option_chosen', 'option_would_replace', 'option_full']), 'an add-on');
});

test('L8 (r3-probes3 U2): a time PostgreSQL refuses is time_invalid; a revision is an int4', () => {
  const at = (t: string) => {
    const r = validateActForOwner({ venueId: '00000000-0000-4000-8000-0000000000c1', reason: 'Owner asked', action: 'dish.update',
      payload: { dishId: '00000000-0000-4000-8000-00000000d001', patch: { price: 100 }, expectedUpdatedAt: t } });
    return r.ok ? 'ok' : r.errors.map((e) => e.code).join(',');
  };
  assert.deepEqual(['2026-02-30T00:00:00Z', '2026-02-29T00:00:00Z', '2026-10-16T24:00:00Z', '2026-10-16T09:00:60Z', '2026-10-16T09:00+14:30', '0000-01-01T00:00:00Z',
    '2026-10-16T09:00:00.123456+03:00'].map(at), ['time_invalid', 'time_invalid', 'ok', 'ok', 'ok', 'time_invalid', 'ok']);
  const approve = (n: number) => validateApproveVenue({ venueId: '00000000-0000-4000-8000-0000000000c1', reason: 'checked', expectedRevision: n }).ok;
  assert.deepEqual([approve(1), approve(REVISION_MAX), approve(REVISION_MAX + 1), approve(0)], [true, true, false, false]);
  assert.equal(validateOpsRevisionQuery({ venueId: '00000000-0000-4000-8000-0000000000c1', revision: 2 ** 31 }).ok, false);
});

test('L8: instantMs reads a time as PostgreSQL 16 does (its answers, recorded on a local cluster)', () => {
  const PG: Array<[string, number | null]> = [
    ['2026-02-28T12:00Z', 1772280000000], ['2026-02-29T12:00Z', null], ['2024-02-29T12:00Z', 1709208000000], ['2100-02-29T12:00Z', null],
    ['2000-02-29T12:00Z', 951825600000], ['1900-02-29T12:00Z', null], ['2026-04-31T12:00Z', null], ['2026-13-01T12:00Z', null],
    ['2026-00-01T12:00Z', null], ['2026-01-00T12:00Z', null], ['0000-01-01T12:00Z', null], ['0001-01-01T00:00:00Z', -62135596800000],
    ['9999-12-31T23:59:59Z', 253402300799000], ['2026-10-16T24:00Z', 1792195200000], ['2026-10-16T24:00:00.000001Z', null], ['2026-10-16T24:01Z', null],
    ['2026-10-16T25:00Z', null], ['2026-10-16T23:60Z', null], ['2026-10-16T23:59:60Z', 1792195200000], ['2026-10-16T23:59:60.5Z', null],
    ['2026-10-16T00:00:60.5Z', 1792108860500], ['2026-10-16T00:00:61Z', null], ['2026-10-16T00:00:59.999999Z', 1792108859999.999],
    ['2026-10-16T00:00:00.123Z', 1792108800123], ['2026-12-31T24:00:00+14:30', 1798709400000], ['2026-12-31T00:00:00+15:59', 1798617660000],
    ['2026-12-31T00:00:00+16:00', null], ['2026-12-31T00:00:00-15:59', 1798732740000], ['2026-12-31T00:00:00+05:60', null],
    ['0001-01-01T00:00:00+15:59', -62135654340000], ['9999-12-31T23:59:59-15:59', 253402358339000], ['2026-12-31T00:00:00-03:30', 1798687800000],
  ];
  for (const [t, ms] of PG) {
    const got = instantMs(t);
    assert.equal(Number.isNaN(got) ? null : Math.round(got * 1000) / 1000, ms, t);
  }
  assert.ok([null, 7, '2026-10-16', '2026-10-16T09:00', '2026-10-16 09:00Z'].every((v) => Number.isNaN(instantMs(v))));
});

test('L13 (r3-numbers.mjs): numbers in exponent form, as PostgreSQL 16 wrote them', () => {
  const n = (v: number) => jsonbNumberText(v);
  assert.deepEqual([1e-7, 1.5e-7, 1.23456789123e-15, -2.5e-9, 1e21, -1e21, 1.2345e22, 123456789012345680000, 0.000001].map(n),
    ['0.0000001', '0.00000015', '0.00000000000000123456789123', '-0.0000000025', '1000000000000000000000', '-1000000000000000000000',
      '12345000000000000000000', '123456789012345680000', '0.000001']);
  assert.equal(n(5e-324), `0.${'0'.repeat(323)}5`);
  assert.equal(n(1.7976931348623157e308), `17976931348623157${'0'.repeat(292)}`);
  assert.equal(n(1e300), `1${'0'.repeat(300)}`);
  const nums = [1e-7, 1.5e-7, 5e-324, 1.7976931348623157e308, 1.23456789123e-15, -2.5e-9, 1e21, -1e21, 1.2345e22, 123456789012345680000, 0.000001, 1e300];
  assert.equal(draftBytes({ a: nums, b: { c: 'שַׁקְשׁוּקָה', d: [1e-7, null, true] } }), 1194);
});

test('round 4: the readers\' price_ambiguous note is stored with the draft (a dish key, its line, a count)', () => {
  const note: ReaderNote = { code: 'price_ambiguous', severity: 'check', key: 'd-burger', lines: [7], count: 1, rule: null };
  const errs = (raw: unknown) => { const v = validateSaveDraft(raw); return v.ok ? [] : v.errors.map((e) => `${e.code}@${e.path}`); };
  assert.deepEqual(errs({ importId: '00000000-0000-4000-8000-0000000000d9', draft: bistroDraft(), notes: [note] }), []);
  assert.deepEqual(errs({ importId: '00000000-0000-4000-8000-0000000000d9', draft: bistroDraft(), notes: [{ ...note, severity: 'info' }] }), ['enum_invalid@notes[0].severity']);
});

test('round 5: the readers\' layout_guessed note, on a dish or a section, with the guess it made', () => {
  assert.equal(READER_NOTES.layout_guessed, 'check');
  assert.deepEqual([...LAYOUT_GUESS_RULES], ['tag_or_heading', 'desc_habit', 'common_name', 'other_language']);
  const d = bistroDraft();
  const note = (o: Partial<ReaderNote> = {}): ReaderNote => ({ code: 'layout_guessed', severity: 'check', key: 'd-schnitzel', lines: [3], count: 1, rule: 'desc_habit', ...o });
  const issues = (notes: unknown[], draft: ImportDraft | null = d) => readerNoteIssues(notes, draft).map((e) => `${e.code}@${e.path}`);
  assert.deepEqual(issues(LAYOUT_GUESS_RULES.map((rule) => note({ rule }))), [], 'every rule, on a dish');
  assert.deepEqual(issues([note({ key: d.sections[0]!.key, rule: 'common_name', lines: [1, 2], count: 2 })]), [], 'on a section');
  assert.deepEqual(issues([note({ rule: null }), note({ rule: 'delivery' }), note({ key: null }), note({ key: d.groups[0]!.key }), note({ severity: 'info' })]),
    ['rule_invalid@notes[0].rule', 'rule_invalid@notes[1].rule', 'key_invalid@notes[2].key', 'ref_unknown@notes[3].key', 'enum_invalid@notes[4].severity']);
  assert.deepEqual(issues([note({ key: 'g-anything' })], null), [], 'without the draft, the key is checked for shape only');
  const v = validateSaveDraft({ importId: '00000000-0000-4000-8000-0000000000d9', draft: d, notes: [note(), note({ code: 'price_ambiguous', rule: null })] });
  assert.ok(v.ok, 'stored with the draft by save_import_draft');
});
