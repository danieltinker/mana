// QA round 3 (NO-GO on five Mediums), each repro as a test: qa/r3-probes.ts, r3-probes2..5.ts, fuzz3-one.ts,
// r3-numbers.mjs (the fuzz itself, fuzz3.ts, is import-fuzz.test.ts). And the round-4 contract items: the readers'
// price_ambiguous note, open_case's own id, old Safari's instants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appliedIds, mergePrevious, draftBytes, draftExceptions, EMPTY_MENU, jsonbNumberText, linkKey, planApply, validateDraft, validateSaveDraft, type ExistingMenu, type ImportChoice,
  type ImportDecisions, type ImportDraft, type ImportPlan, type PlanStep, type ReaderNote, LAYOUT_GUESS_RULES, READER_NOTES, readerNoteIssues,
  SCAN_IMAGE_CAPS, type ClaimScanReply, validateDecisions, NOTES_MAX, NOTES_BYTES_MAX, DRAFT_BYTES_MAX, DECISIONS_BYTES_MAX, saveDraftSizeFail,
  applyImportSizeFail, type ApplyImportReply, type ImportedIds, type DraftOption, IMPORT_CAP_KEYS,
} from '../src/import.ts';
import { BLOCKERS_MAX, onboardingProgress, validateSetStep, type SetStepReply } from '../src/onboarding.ts';
import { addonGroupSizeFail, ADDON_GROUP_BYTES_MAX } from '../src/addons.ts';
import { LIMITS } from '../src/enums.ts';
import { instantMs } from '../src/events.ts';
import { REVISION_MAX, validateActForOwner, validateApproveVenue, type ActForOwnerReply } from '../src/staff.ts';
import { validateOpsRevisionQuery } from '../src/ops.ts';
import { indexMenu, NO_SUGGESTION_CODES, whyNoSuggestion } from '../src/upsell.ts';
import { cafeDemo, ID, RULES } from './fixtures.ts';
import { applyPlan, bistroDraft, copy, dish, draftOf, group, link, menuRuleBreaks, opt, planProblems, section } from './import-fixtures.ts';

const SKIPPED_NONE = { choice: 0, merged: 0, empty: 0, parent_skipped: 0, unused: 0 };
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

test('L6 (r3-probes R5), round 6 L3: a new dish never gets two groups of one name; a group only its merged links used is unused', () => {
  const base = draftOf([section('s', 'עיקריות', 'Mains', [dish('d-steak', 'סטייק', 'Steak', 9000, { groups: [link('g')] })])],
    [group('g', 'תוספת', 'Extras', { options: [opt('o1', 'צ׳יפס', 'Fries', 0), opt('o2', 'סלט', 'Salad', 0), opt('o3', 'אורז', 'Rice', 0)] })]);
  const once = applyPlan(EMPTY_MENU, plan(base));
  for (const [extra, created] of [[opt('b1', 'אורז', 'Rice', 0), 'keep'], [opt('b2', 'פירה', 'Mash', 0), 'skip(unused)']] as const) {
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
    assert.equal(after.groups.length, 1, 'no group the dish lost its link to');
    assert.deepEqual([p.summary.dish_group.skipped.merged, p.summary.group.skipped.unused], [1, created === 'keep' ? 0 : 1], 'the summary says so');
    // the same draft again: both links stay on the dish's own Extras row; the second is merged, asked nothing (round 7:
    // a new_group there could not move the row the first keeps), as on the first import
    const again = plan(d, after);
    assert.deepEqual(again.steps.filter((s) => s.op === 'create' || s.op === 'update').map(brief), []);
    assert.deepEqual(asked(again).filter((e) => !e.startsWith('name_missing_lang')), []);
    assert.equal(brief(step(again, 'dish_group', linkKey('d-new', 'g-x'))), 'dish_group:d-new>g-x:skip(merged)');
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

// ---------------------------------------------------------------- round 6 (QA round 4)

test('QA-M1 (r4-opener.ts): new_group never makes a venue\'s option taken more than once open a group', () => {
  // the venue: Burger with Extras (multiple 0–4): Cheese up to 2, Egg
  const base = draftOf([section('s', 'עיקריות', 'Mains', [dish('d', 'המבורגר', 'Burger', 7000, { groups: [link('g')] })])],
    [group('g', 'תוספות', 'Extras', { selection: 'multiple', min: 0, max: 4, options: [opt('c', 'גבינה', 'Cheese', 300, { maxQty: 2 }), opt('e', 'ביצה', 'Egg', 400)] })]);
  const once = applyPlan(EMPTY_MENU, plan(base));
  // the new read: Cheese (once) opens "Cheese type"
  const d = draftOf([section('s', 'עיקריות', 'Mains', [dish('d', 'המבורגר', 'Burger', 7000, { groups: [link('g')] })])], [
    group('g', 'תוספות', 'Extras', { selection: 'multiple', min: 0, max: 4, options: [opt('c', 'גבינה', 'Cheese', 300, { opens: 'n' }), opt('e', 'ביצה', 'Egg', 400)] }),
    group('n', 'סוג גבינה', 'Cheese type', { selection: 'single', min: 1, max: 1, options: [opt('n1', 'צהובה', 'Yellow', 0), opt('n2', 'עיזים', 'Goat', 0)] }),
  ]);
  const kept = plan(d, once);
  assert.deepEqual(asked(kept), ['opens_changed@c>n=keep_mine']);
  assert.deepEqual(menuRuleBreaks(applyPlan(once, kept)), [], 'keep_mine: the venue\'s Cheese stays as it is');
  const moved = planApply(d, once, yes({ 'opens_changed@c>n': 'new_group' }));
  assert.deepEqual(moved.ok ? [] : moved.errors, [{ code: 'opener_qty', path: 'c>n', message: 'opens_changed' }]);
  // the owner sets Cheese to once in the editor first: then new_group moves it
  const once1: any = copy(once);
  once1.options.find((o: any) => o.name_en === 'Cheese').max_qty = 1;
  const p = plan(d, once1, yes({ 'opens_changed@c>n': 'new_group' }));
  assert.equal(brief(step(p, 'option', 'c')), 'option:c:update');
  assert.deepEqual(step(p, 'option', 'c').refs, { opens_group_id: 'n' });
  assert.deepEqual(menuRuleBreaks(applyPlan(once1, p)), []);
});

test('QA-M1: menuRuleBreaks models the add-on options\' checks and the nesting guard', () => {
  const m = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  assert.deepEqual(menuRuleBreaks(m), []);
  const bad: any = copy(m);
  const side = bad.groups.find((g: any) => g.name_en === 'Side of choice').id;
  const sauce = bad.groups.find((g: any) => g.name_en === 'Sauce').id;
  const fries = bad.options.find((o: any) => o.name_en === 'Fries');
  fries.max_qty = 2;
  bad.options.find((o: any) => o.name_en === 'Salad').opens_group_id = side;
  bad.options.find((o: any) => o.group_id === sauce).opens_group_id = side;
  bad.options.find((o: any) => o.group_id !== side && o.group_id !== sauce).max_qty = 11;
  const breaks = menuRuleBreaks(bad);
  for (const b of ['option Fries: opens a group with max_qty 2', 'option Salad: opens its own group']) assert.ok(breaks.includes(b), b);
  assert.ok(breaks.some((b) => b.includes('nesting_too_deep')));
  assert.ok(breaks.some((b) => b.endsWith('max_qty 11')));
});

test('round 6 L4: a reader note of another code may name its rule (only its shape is checked)', () => {
  const note: ReaderNote = { code: 'sold_out', severity: 'check', key: 'd-burger', lines: [4], count: 1, rule: 'badge_text' };
  assert.deepEqual(readerNoteIssues([note], bistroDraft()), []);
  assert.deepEqual(readerNoteIssues([{ ...note, rule: 'Badge text' }], bistroDraft()).map((e) => e.code), ['rule_invalid']);
});

test('round 6 L3: the summary counts the skipped steps by reason', () => {
  const p = plan(bistroDraft(), EMPTY_MENU, yes({}, ['d-burger']));
  assert.deepEqual(p.summary.dish.skipped, { ...SKIPPED_NONE, choice: 1 });
  assert.equal(p.summary.dish.skip, 1);
  assert.deepEqual(p.summary.section.skipped, SKIPPED_NONE);
});

test('QA-M2 (r6-hopa.ts, fuzz6 seed 615767102): the owner\'s skip of an unreachable group holds on the re-import that finds it', () => {
  const d = draftOf([section('s', 'עיקריות', 'Mains', [
    dish('d-burger', 'המבורגר', 'Burger', 6200, { groups: [link('g-a')] }),
    dish('d-steak', 'סטייק', 'Steak', 9800, { groups: [link('g-b')] }),
  ])], [
    group('g-a', 'תוספות', 'Extras', { selection: 'multiple', min: 0, max: 2, options: [opt('a1', 'צ׳יפס', 'Fries', 0), opt('a2', 'סלט', 'Salad', 0)] }),
    group('g-b', 'תוספות', 'Extras', { selection: 'multiple', min: 2, max: 2, options: [opt('b1', 'אורז', 'Rice', 0), opt('b2', 'סלט', 'Salad', 0)] }),
  ]);
  const answers = yes({ 'limits_unreachable@g-b': 'skip' }, ['b1']);
  const first = plan(d, EMPTY_MENU, answers);
  assert.deepEqual(asked(first), ['limits_unreachable@g-b=skip']);
  const once = applyPlan(EMPTY_MENU, first);
  const again = plan(d, once, answers);
  assert.deepEqual(asked(again), ['limits_unreachable@g-b=skip'], 'asked and honoured though g-b now matches the venue\'s Extras');
  assert.deepEqual(again.steps.filter((s) => s.op === 'create' || s.op === 'update').map(brief), [], 'Hopa test 1');
  assert.equal(brief(step(again, 'dish_group', linkKey('d-steak', 'g-b'))), 'dish_group:d-steak>g-b:skip(parent_skipped)');
  // clamp instead: the venue's Extras is found the second time, and it is not asked again (its limits are the venue's)
  const clamp = yes({ 'limits_unreachable@g-b': 'clamp' }, ['b1']);
  const c1 = applyPlan(EMPTY_MENU, plan(d, EMPTY_MENU, clamp));
  const c2 = plan(d, c1, clamp);
  assert.deepEqual(c2.steps.filter((s) => s.op === 'create' || s.op === 'update').map(brief), []);
});

// ---------------------------------------------------------------- round 8 (the backend's report on 6f43be7)

test('round 8: a section merged into a section left out takes its dishes, their links and photos with it (no throw)', () => {
  const d = draftOf([
    section('s1', 'עיקריות', 'Mains', [dish('d1', 'סטייק', 'Steak', 9000)]),
    section('s2', 'עיקריות', 'Mains', [dish('d2', 'המבורגר', 'Burger', 7000, { groups: [link('g')], photo: { path: 'v/imports/i/burger.jpg', rights: 'confirmed' } })]),
  ], [group('g', 'תוספת', 'Side', { options: [opt('o1', 'צ׳יפס', 'Fries', 0)] })], { source: 'wolt_screenshots' });
  for (const m of [EMPTY_MENU, applyPlan(EMPTY_MENU, plan(d, EMPTY_MENU, yes({ 'section_duplicate@s2': 'merge' })))]) {
    const p = plan(d, m, yes({ 'section_duplicate@s2': 'merge' }, ['s1']));
    assert.deepEqual(p.steps.filter((s) => s.kind !== 'group' && s.kind !== 'option').map(brief),
      ['section:s1:skip(choice)', 'section:s2:skip(merged)', 'dish:d1:skip(parent_skipped)', 'dish:d2:skip(parent_skipped)',
        'dish_group:d2>g:skip(parent_skipped)', 'photo:d2:skip(parent_skipped)']);
    assert.equal(brief(step(p, 'group', 'g')), 'group:g:skip(unused)');
  }
});

test('round 8: claim_import_scan as built: the images it charged, and the cap a refusal names', () => {
  assert.deepEqual([...SCAN_IMAGE_CAPS], ['scan_images_per_venue_day', 'scan_images_per_user_day', 'scan_images_per_day']);
  const ok: ClaimScanReply = {
    ok: true, importId: '00000000-0000-4000-8000-0000000000e9', venueId: '00000000-0000-4000-8000-0000000000c1', source: 'scan',
    paths: ['00000000-0000-4000-8000-0000000000c1/imports/00000000-0000-4000-8000-0000000000e9/1.jpg'], images: 1, rightsConfirmed: false, langs: ['he', 'en'],
  };
  const capped: ClaimScanReply = { ok: false, code: 'rate_limited', cap: 'scan_images_per_user_day' };
  assert.ok(ok.ok && ok.images === ok.paths.length && !capped.ok);
});

// ---------------------------------------------------------------- round 9 (QA-M2: same-name nodes across re-imports)

type HopaFlow = { draft: ImportDraft; first: ImportDecisions; reread: ImportDraft; again: ImportDecisions };
/**
 * QA's database fuzz as one flow: an import, the same again, a re-read with the owner's new answers, that re-read
 * again, and once more. `forget` drops `previous` before the re-read, as for a venue whose last import was another
 * draft (or was applied before `menu_imports.applied_ids`).
 */
const hopaFlow = (f: HopaFlow, forget = false) => {
  const p1 = plan(f.draft, EMPTY_MENU, f.first);
  let m = applyPlan(EMPTY_MENU, p1, f.draft);
  const p2 = plan(f.draft, m, f.first);
  m = applyPlan(m, p2, f.draft);
  if (forget) { const { previous: _, ...rest } = m; m = rest; }
  const p3 = plan(f.reread, m, f.again);
  m = applyPlan(m, p3, f.reread);
  const p4 = plan(f.reread, m, f.again);
  const m4 = applyPlan(m, p4, f.reread);
  const p5 = plan(f.reread, m4, f.again);
  return { p1, p2, p3, p4, p5, menu: m, menu4: m4 };
};
const changed = (p: ImportPlan) => p.steps.filter((s) => s.op === 'create' || s.op === 'update').map(brief);
const askedKeys = (p: ImportPlan) => p.exceptions.map((e) => `${e.code}@${e.key}`);
/** Hopa test 1: the same draft with the same answers writes nothing, and asks nothing the import it repeats did not. */
const assertHopa = (again: ImportPlan, before: ImportPlan, what: string) => {
  assert.deepEqual(changed(again), [], `${what}: no row written`);
  assert.deepEqual(askedKeys(again).filter((k) => !askedKeys(before).includes(k)), [], `${what}: nothing new asked`);
};
const assertFlow = (f: HopaFlow) => {
  for (const forget of [false, true]) {
    const r = hopaFlow(f, forget);
    const how = forget ? 'the re-read into a menu without provenance' : 'with provenance';
    assertHopa(r.p2, r.p1, `${how}, the same again`);
    assertHopa(r.p4, r.p3, `${how}, the re-read again`);
    assertHopa(r.p5, r.p3, `${how}, the re-read a third time`);
    assert.deepEqual(sectionsOf(r.menu4), sectionsOf(r.menu));
  }
};
/** A draft a test may change: its sections' names, its dishes' prices and price notes. */
type Editable = { sections: Array<{ name: { he: string; en: string }; dishes: Array<{ price: number | null; priceNote: { he: string; en: string } }> }> };
const renamedCopy = (d: ImportDraft, change: (x: Editable) => void = () => {}): ImportDraft => {
  const x = copy(d) as unknown as Editable;
  for (const s of x.sections) s.name = { he: `${s.name.he} חדש`, en: `${s.name.en} new` };
  change(x);
  return x as unknown as ImportDraft;
};

test('QA-M2 (db fuzz seed 307537388, shrunk): a Salad in each of two merged sections, kept apart; a re-read imported again makes no new Salad', () => {
  const draft = draftOf([
    section('s0', 'ראשונות', 'Starters', [dish('s0d0', 'סלט', 'Salad', 4200)]),
    section('s1', 'ראשונות', 'Starters', [dish('s1d1', 'סלט', 'Salad', 4200)]),
  ]);
  const first = yes({ 'section_duplicate@s1': 'merge', 'dish_duplicate@s1d1': 'keep_both' });
  const again = yes({ ...first.choices, 'dish_elsewhere@s1d1': 'new_dish' });
  assertFlow({ draft, first, reread: renamedCopy(draft), again });
  // before round 9, a re-read into a menu without provenance made "Starters new" with one Salad, and every import of
  // it again matched the two Salads the other way round and made one more
  const r = hopaFlow({ draft, first, reread: renamedCopy(draft), again }, true);
  assert.deepEqual(sectionsOf(r.menu), [['Starters', ['Salad 4200', 'Salad 4200']], ['Starters new', ['Salad 4200']]]);
  assert.deepEqual(r.p4.steps.filter((s) => s.kind === 'dish').map(brief), ['dish:s0d0:keep', 'dish:s1d1:keep']);
});

test('QA-M2 (db fuzz seed -668751856, shrunk): two sections of one name kept apart, one of them empty, renamed by a re-read', () => {
  const draft = draftOf([section('s1', 'ילדים', 'Kids', []), section('s2', 'ילדים', 'Kids', [dish('s2d0', 'סלט', 'Salad', 0)])]);
  const first = yes({ 'section_duplicate@s2': 'keep_both' });
  const again = yes({ ...first.choices, 'dish_elsewhere@s2d0': 'new_dish', 'section_renamed@s2': 'rename' });
  assertFlow({ draft, first, reread: renamedCopy(draft, (x) => { x.sections[1]!.dishes[0]!.price = 3000; }), again });
});

test('QA-M2 (QA\'s r8-hopa-twins.ts, shrunk from -668751856): one section keeps its name, its twin takes the re-read\'s', () => {
  const draft = draftOf([
    section('s-a', 'ילדים', 'Kids', [dish('d-schnitzel', 'שניצל', 'Schnitzel', 4200)]),
    section('s-b', 'ילדים', 'Kids', [dish('d-salad', 'סלט', 'Salad', 3000)]),
  ]);
  const first = yes({ 'section_duplicate@s-b': 'keep_both' });
  const again = yes({ ...first.choices, 'section_renamed@s-a': 'same_section', 'section_renamed@s-b': 'rename' });
  assertFlow({ draft, first, reread: renamedCopy(draft), again });
  const r = hopaFlow({ draft, first, reread: renamedCopy(draft), again });
  assert.deepEqual(sectionsOf(r.menu), [['Kids', ['Schnitzel 4200']], ['Kids new', ['Salad 3000']]]);
});

test('QA-M2 (fuzz seed -345021870, shrunk): a dish the owner matched to another kind stays there when a row of its own kind frees up', () => {
  const draft = draftOf([
    section('s1', 'משקאות', 'Drinks', [dish('s1d0', 'שניצל', 'Schnitzel', null), dish('s1d2', 'שניצל', 'Schnitzel', 3000)], { kind: 'drinks' }),
    section('s2', 'עיקריות', 'Mains', [dish('s2d2', 'שניצל', 'Schnitzel', 4200)]),
  ]);
  const first = yes({ 'price_missing@s1d0': 'no_price', 'dish_duplicate@s1d2': 'skip' });
  const edited = copy(draft) as unknown as Editable;
  edited.sections[0]!.name = { he: 'משקאות חדש', en: 'Drinks new' };
  edited.sections[0]!.dishes[0]!.price = 4200;
  edited.sections[0]!.dishes[1]!.priceNote = { he: 'לזוג', en: 'for two' };
  const reread = edited as unknown as ImportDraft;
  const again = yes({ 'dish_duplicate@s1d2': 'keep_both', 'dish_elsewhere@s1d0': 'new_dish', 'dish_other_kind@s1d2': 'same_dish' });
  assertFlow({ draft, first, reread, again });
});

test('QA-M2 (fuzz seeds 1849530644, 1592050329, shrunk): two Lemonades kept apart; the renamed section is asked, or not, as the last import was', () => {
  // the re-read into a menu without provenance: a tie leaves "Starters new" unproposed, so both Lemonades ask
  // dish_elsewhere and the section is left without a row; the re-read again holds both and still asks no rename
  const lemonades = draftOf([section('s1', 'ראשונות', 'Starters', [dish('s1d0', 'לימונדה', 'Lemonade', 3000), dish('s1d1', 'לימונדה', 'Lemonade', 4200)])]);
  assertFlow({
    draft: lemonades, first: yes({ 'dish_duplicate@s1d1': 'keep_both' }),
    reread: renamedCopy(lemonades, (x) => { x.sections[0]!.dishes[1]!.price = null; }),
    again: yes({ 'dish_duplicate@s1d1': 'keep_both', 'price_missing@s1d1': 'no_price', 'section_renamed@s1': 'rename' }),
  });
  // with provenance: the held Lemonade is no tie, the section is renamed onto the venue's, and stays so
  const three = draftOf([section('s0', 'ראשונות', 'Starters', [
    dish('s0d0', 'לימונדה', 'Lemonade', 3000), dish('s0d1', 'לימונדה', 'Lemonade', 4200), dish('s0d3', 'סלט', 'Salad', 0),
  ])]);
  assertFlow({
    draft: three, first: yes({ 'dish_duplicate@s0d1': 'skip' }),
    reread: renamedCopy(three, (x) => { x.sections[0]!.dishes[0]!.price = null; x.sections[0]!.dishes[1]!.price = 3000; }),
    again: yes({ 'dish_duplicate@s0d1': 'keep_both', 'price_missing@s0d0': 'no_price', 'dish_elsewhere@s0d3': 'new_dish' }),
  });
});

test('round 9: provenance: a node takes the row the last import put it on, while that row\'s name still matches', () => {
  const twins = draftOf([
    section('s-a', 'עיקריות', 'Mains', [dish('d-a', 'סלט', 'Salad', 3000)]),
    section('s-b', 'ילדים', 'Kids', [dish('d-b', 'סלט', 'Salad', 3000)]),
  ]);
  const both = yes({ 'dish_repeated@d-b': 'keep_both' });
  // the venue has two Salads in Mains, and an empty Kids
  const menu = (previous?: ExistingMenu['previous']): ExistingMenu =>
    ({ ...twoSections([SALAD(B1, A, 3000, 0), SALAD(B2, A, 3000, 1)]), ...(previous ? { previous } : {}) });
  const on = (p: ImportPlan) => p.steps.filter((s) => s.kind === 'dish').map((s) => `${s.key}→${s.id}`);
  assert.deepEqual(on(plan(twins, menu(), both)), [`d-a→${B1}`, `d-b→${B2}`], 'by name and position');
  assert.deepEqual(on(plan(twins, menu({ sections: {}, dishes: { 'd-a': B2, 'd-b': B1 } }), both)), [`d-a→${B2}`, `d-b→${B1}`],
    'held: the rows the last import wrote');
  assert.deepEqual(on(plan(twins, menu({ sections: {}, dishes: { 'd-a': B2, 'd-b': B2 } }), both)), [`d-a→${B1}`, `d-b→${B2}`],
    'a row two keys name: neither holds it');
  assert.deepEqual(on(plan(twins, menu({ sections: {}, dishes: { 'd-a': '00000000-0000-4000-8000-0000000000ff', 'd-b': B1 } }), both)),
    [`d-a→${B2}`, `d-b→${B1}`], 'a row gone holds nothing; the other key still holds its own');
  const greens = { ...menu({ sections: {}, dishes: { 'd-a': B2 } }), dishes: [SALAD(B1, A, 3000, 0), { ...SALAD(B2, A, 3000, 1), name_he: 'ירוקים', name_en: 'Greens' }] };
  assert.deepEqual(on(plan(twins, greens, both)), [`d-a→${B1}`, 'd-b→null'], 'a row renamed since holds nothing: names decide');
  // a section holds its row the same way, before the others claim theirs
  const mainsTwice = draftOf([section('s-x', 'עיקריות', 'Mains', [dish('d-x', 'שניצל', 'Schnitzel', 4000)]), section('s-y', 'עיקריות', 'Mains', [])]);
  const twoMains: ExistingMenu = {
    ...EMPTY_MENU, sections: [{ id: A, position: 0, name_he: 'עיקריות', name_en: 'Mains', kind: 'food' }, { id: B, position: 1, name_he: 'עיקריות', name_en: 'Mains', kind: 'food' }],
  };
  const sec = (p: ImportPlan) => p.steps.filter((s) => s.kind === 'section').map((s) => `${s.key}→${s.id}`);
  const keepBoth = yes({ 'section_duplicate@s-y': 'keep_both' });
  assert.deepEqual(sec(plan(mainsTwice, twoMains, keepBoth)), [`s-x→${A}`, `s-y→${B}`]);
  assert.deepEqual(sec(plan(mainsTwice, { ...twoMains, previous: { sections: { 's-x': B, 's-y': A }, dishes: {} } }, keepBoth)), [`s-x→${B}`, `s-y→${A}`]);
});

test('round 9: appliedIds is what apply_import stores: the row each section and dish was created, updated or kept on', () => {
  const d = bistroDraft();
  const p1 = plan(d, EMPTY_MENU, yes({}, ['d-lemonade']));
  const ids = new Map([['s-mains', 'S1'], ['s-drinks', 'S2'], ['d-schnitzel', 'D1'], ['d-burger', 'D2']]);
  assert.deepEqual(appliedIds(d, p1, (_, key) => ids.get(key)), { sections: { 's-mains': 'S1' }, dishes: { 'd-schnitzel': 'D1', 'd-burger': 'D2' } },
    'a node left out has none, nor a section emptied by leaving its dishes out');
  const m1 = applyPlan(EMPTY_MENU, p1);
  const m2 = applyPlan(m1, plan(d, m1));
  assert.deepEqual(Object.keys(m2.previous!.dishes), ['d-schnitzel', 'd-burger', 'd-lemonade']);
  assert.equal(m2.previous!.dishes['d-schnitzel'], m1.previous!.dishes['d-schnitzel'], 'kept: the same row');
  assert.equal(m2.previous!.dishes['d-lemonade'], m2.dishes.find((x) => x.name_en === 'Lemonade')!.id, 'created: the new row');
});

// ---------------------------------------------------------------- round 9 (the backend's SEC-M1: sizes before any work)

test('round 9 (SEC-M1): past a DRAFT_CAPS count the draft gets the issues so far and its count issues, no node is walked', () => {
  const bad = { ...dish('d-bad', 'סלט', 'Salad', 100), key: 'Not A Key', price: -1 };
  const many = (n: number, at: number) => Array.from({ length: n }, (_, i) => section(`s${at}-${i}`, 'עיקריות', 'Mains', []));
  const errors = (raw: unknown) => { const v = validateDraft(raw); return v.ok ? [] : v.errors.map((e) => `${e.code}@${e.path}`); };
  // under the caps the bad dish is reported; past one, only the count (after the top-level issues)
  const under = { ...draftOf([...many(79, 0), section('s-x', 'x', 'X', [bad])]), extra: 1 };
  assert.deepEqual(errors(under), ['field_not_allowed@extra', 'key_invalid@sections[79].dishes[0].key', 'price_invalid@sections[79].dishes[0].price']);
  const over = { ...draftOf([...many(80, 0), section('s-x', 'x', 'X', [bad])]), extra: 1 };
  assert.deepEqual(errors(over), ['field_not_allowed@extra', 'too_large@sections']);
  // every count, in validateDraft's order: the groups, each group's options, the sections, each dish's links, the dishes
  const opts = (n: number) => Array.from({ length: n }, (_, i) => opt(`o${i}`, 'א', 'A', 0));
  const groups = Array.from({ length: 401 }, (_, i) => group(`g${i}`, 'ג', 'G', { options: i === 3 ? opts(61) : opts(1) }));
  const links = Array.from({ length: 17 }, (_, i) => link(`g${i}`));
  const dishes = Array.from({ length: 801 }, (_, i) => dish(`d${i}`, 'ד', 'D', 100, i === 5 ? { groups: links } : {}));
  assert.deepEqual(errors(draftOf([section('s', 'ס', 'S', [bad, ...dishes]), ...many(80, 1)], groups)),
    ['too_large@groups', 'too_large@groups[3].options', 'too_large@sections', 'too_large@sections[0].dishes[6].groups', 'too_large@sections']);
  // a non-array or a non-object never counts
  assert.deepEqual(errors(draftOf([{ ...section('s', 'ס', 'S', []), dishes: 'many' } as never])), ['type@sections[0].dishes']);
});

test('round 9 (SEC-M1): a decisions list past DECISIONS_LIST_MAX is too_large and not walked; the other list still is', () => {
  const choices = (n: number) => Object.fromEntries([['Bad Id', 'skip'], ...Array.from({ length: n - 1 }, (_, i) => [`dish_repeated@d${i}`, 'skip'])]);
  const errors = (raw: unknown) => { const v = validateDecisions(raw); return v.ok ? [] : v.errors.map((e) => `${e.code}@${e.path}`); };
  assert.deepEqual(errors({ v: 1, pricesConfirmed: true, choices: choices(5000), skip: ['Bad'] }), ['choice_invalid@choices.Bad Id', 'key_invalid@skip[0]']);
  assert.deepEqual(errors({ v: 1, pricesConfirmed: true, choices: choices(5001), skip: ['Bad'] }), ['too_large@choices', 'key_invalid@skip[0]']);
  const skip = (n: number) => ['Bad', ...Array.from({ length: n - 1 }, (_, i) => `d${i}`)];
  assert.deepEqual(errors({ v: 1, pricesConfirmed: true, choices: { 'Bad Id': 'skip' }, skip: skip(5000) }), ['choice_invalid@choices.Bad Id', 'key_invalid@skip[0]']);
  assert.deepEqual(errors({ v: 2, pricesConfirmed: true, choices: { 'Bad Id': 'skip' }, skip: skip(5001) }), ['version@v', 'choice_invalid@choices.Bad Id', 'too_large@skip']);
});

test('round 9 (SEC-M1): past NOTES_MAX the notes are too_many alone; at it, each is checked', () => {
  const notes = (n: number) => Array.from({ length: n }, () => ({ code: 'nope' }));
  assert.deepEqual(readerNoteIssues(notes(NOTES_MAX + 1), null), [{ code: 'too_many', path: 'notes' }]);
  assert.equal(readerNoteIssues(notes(NOTES_MAX), null).filter((e) => e.code === 'enum_invalid').length, NOTES_MAX);
});

const VENUE_ID = '00000000-0000-4000-8000-0000000000c1';

test('round 9 (SEC-M1): the byte bounds, either side, as octet_length(v::text) measures them (draftBytes)', () => {
  // a padded value of exactly `bytes` (calibrated with draftBytes, whose parity with octet_length the backend tests)
  const padded = (base: Record<string, unknown>, bytes: number, hebrew = false) => {
    const room = bytes - draftBytes({ ...base, pad: '' });
    const v = { ...base, pad: hebrew ? 'x'.repeat(room % 2) + 'א'.repeat(Math.floor(room / 2)) : 'x'.repeat(room) };
    assert.equal(draftBytes(v), bytes);
    return v;
  };
  const draft = (bytes: number) => padded({ v: 1 }, bytes);
  // save_import_draft: the draft, then the notes' count, then the notes' bytes
  assert.equal(saveDraftSizeFail(draft(DRAFT_BYTES_MAX)), null);
  assert.deepEqual(saveDraftSizeFail(draft(DRAFT_BYTES_MAX + 1)), { ok: false, code: 'too_large' });
  assert.deepEqual(saveDraftSizeFail(null), { ok: false, code: 'too_large' });
  const notes = (bytes: number, hebrew = false) => [padded({}, bytes - 2, hebrew)];
  assert.equal(saveDraftSizeFail(draft(100), notes(NOTES_BYTES_MAX, true)), null, 'a Hebrew letter is two bytes');
  assert.deepEqual(saveDraftSizeFail(draft(100), notes(NOTES_BYTES_MAX + 1, true)), { ok: false, code: 'too_large' });
  assert.deepEqual(saveDraftSizeFail(draft(100), notes(NOTES_BYTES_MAX + 1)), { ok: false, code: 'too_large' });
  assert.equal(saveDraftSizeFail(draft(100), null), null, 'null notes are []');
  assert.deepEqual(saveDraftSizeFail(draft(100), Array.from({ length: NOTES_MAX + 1 }, () => 0)),
    { ok: false, code: 'invalid_draft', errors: [{ code: 'too_many', path: 'notes' }] });
  // apply_import: the draft (draft_changed), then the decisions
  const decisions = (bytes: number) => padded({ v: 1, pricesConfirmed: true, choices: {} }, bytes);
  assert.equal(applyImportSizeFail(draft(DRAFT_BYTES_MAX), decisions(DECISIONS_BYTES_MAX)), null);
  assert.deepEqual(applyImportSizeFail(draft(DRAFT_BYTES_MAX + 1), decisions(100)), { ok: false, code: 'draft_changed' });
  assert.deepEqual(applyImportSizeFail(draft(100), decisions(DECISIONS_BYTES_MAX + 1)),
    { ok: false, code: 'invalid_decisions', errors: [{ code: 'too_large', path: '' }] });
  // save_addon_group: the options' count (the venue's limit), then the group and its options together
  const options = (n: number) => Array.from({ length: n }, () => ({ id: VENUE_ID }));
  assert.equal(addonGroupSizeFail({ id: VENUE_ID }, options(LIMITS.optionsPerGroup)), null);
  assert.deepEqual(addonGroupSizeFail({ id: VENUE_ID }, options(LIMITS.optionsPerGroup + 1)), { ok: false, code: 'limit_options_per_group' });
  assert.equal(addonGroupSizeFail({ id: VENUE_ID }, options(40), 40), null, 'a venue whose config allows more');
  const opts = options(2);
  assert.equal(addonGroupSizeFail(padded({}, ADDON_GROUP_BYTES_MAX - draftBytes(opts)), opts), null);
  assert.deepEqual(addonGroupSizeFail(padded({}, ADDON_GROUP_BYTES_MAX + 1 - draftBytes(opts)), opts), { ok: false, code: 'too_large' });
  // a group left out is null (4 bytes); ["x…"] is 4 bytes more than its x's
  assert.equal(addonGroupSizeFail(undefined, ['x'.repeat(ADDON_GROUP_BYTES_MAX - 8)]), null);
  assert.deepEqual(addonGroupSizeFail(undefined, ['x'.repeat(ADDON_GROUP_BYTES_MAX - 7)]), { ok: false, code: 'too_large' });
});

// ---------------------------------------------------------------- round 10 (QA of 0f8c43e: provenance over every import)

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

test('round 10 (QA-M3): mergePrevious takes, per key, the row of the most recently applied import that holds it', () => {
  const ids = (sections: Record<string, string>, dishes: Record<string, string>) => ({ sections, dishes });
  const a = { id: uuid(0xa), appliedAt: '2026-10-20T10:00:00.000001+00:00', appliedIds: ids({ 's-drinks': 'S1' }, { 'd-a': 'D1', 'd-b': 'D2' }) };
  // a microsecond after a, written in another offset; c is the same instant as b, and its id is the greater
  const b = { id: uuid(0xb), appliedAt: '2026-10-20T13:00:00.000002+03:00', appliedIds: ids({}, { 'd-a': 'D9', 'd-c': 'D5' }) };
  const c = { id: uuid(0xc), appliedAt: '2026-10-20T10:00:00.000002Z', appliedIds: ids({ 's-wines': 'S3' }, { 'd-b': 'D7', 'd-c': 'D6' }) };
  const before = { id: uuid(0xd), appliedAt: '2026-10-21T00:00:00Z', appliedIds: null };
  const want = { sections: { 's-drinks': 'S1', 's-wines': 'S3' }, dishes: { 'd-a': 'D9', 'd-b': 'D7', 'd-c': 'D6' } };
  assert.deepEqual(mergePrevious([a, b, c, before]), want);
  assert.deepEqual(mergePrevious([before, c, a, b]), want, 'whatever the order they come in');
  assert.equal(mergePrevious([]), undefined);
  assert.equal(mergePrevious([before]), undefined, 'an import applied before the column existed counts for nothing');
});

test('round 10 (QA-M3, r9-hopa-other.ts): a re-read imported again after another import of the venue\'s writes nothing', () => {
  // keys as the readers make them, from the names: the re-read renames the section, so every key is new
  const first = draftOf([section('s-drinks', 'שתייה', 'Drinks', [
    dish('d-drinks-classic-0', 'קלאסי', 'Classic', 0), dish('d-drinks-classic-4200', 'קלאסי', 'Classic', 4200),
  ], { kind: 'drinks' })]);
  const reread = draftOf([section('s-drinks-new', 'שתייה חדש', 'Drinks new', [
    dish('d-drinks-new-classic-3000', 'קלאסי', 'Classic', 3000), dish('d-drinks-new-classic-4200', 'קלאסי', 'Classic', 4200),
  ], { kind: 'drinks' })]);
  const wines = draftOf([section('s-wines', 'יינות', 'Wines', [dish('d-wines-merlot', 'מרלו', 'Merlot', 3800)], { kind: 'wine' })]);
  const answers = yes({
    'dish_duplicate@d-drinks-new-classic-4200': 'keep_both', 'price_differs@s-drinks-new': 'take_new',
    'dish_elsewhere@d-drinks-new-classic-3000': 'same_dish', 'dish_elsewhere@d-drinks-new-classic-4200': 'new_dish',
  });
  let m = applyPlan(EMPTY_MENU, plan(first, EMPTY_MENU, yes({ 'price_zero@d-drinks-classic-0': 'no_price', 'dish_duplicate@d-drinks-classic-4200': 'keep_both' })));
  const r = plan(reread, m, answers);
  m = applyPlan(m, r);
  assert.deepEqual(sectionsOf(m), [['Drinks', ['Classic 3000', 'Classic 4200']], ['Drinks new', ['Classic 4200']]]);
  assertHopa(plan(reread, m, answers), r, 'back to back');
  m = applyPlan(m, plan(wines, m, yes()));
  // before round 10, `previous` was the wines' alone: the Classics were matched by name again, one repriced and one made
  const again = plan(reread, m, answers);
  assertHopa(again, r, 'after the wines');
  assertHopa(plan(reread, applyPlan(m, again), answers), r, 'and once more');
});

test('round 10 (QA\'s r9-crossing.ts): keys by position, sections reordered: the moved section key holds nothing, so the Salads stay', () => {
  const a = draftOf([section('s0', 'עיקריות', 'Mains', [dish('s0d0', 'סלט', 'Salad', 4200)]), section('s1', 'ילדים', 'Kids', [dish('s1d0', 'סלט', 'Salad', 2400)])]);
  const b = draftOf([section('s0', 'ילדים', 'Kids', [dish('s0d0', 'סלט', 'Salad', 2400)]), section('s1', 'עיקריות', 'Mains', [dish('s1d0', 'סלט', 'Salad', 4200)])]);
  const m = applyPlan(EMPTY_MENU, plan(a, EMPTY_MENU));
  const p = plan(b, m);
  const where = (id: string | null) => { const x = m.dishes.find((y) => y.id === id)!; return `${m.sections.find((s) => s.id === x.section_id)!.name_en} ${x.price}`; };
  assert.deepEqual(p.steps.filter((s) => s.kind === 'dish').map((s) => `${s.key} → ${where(s.id)}`), ['s0d0 → Kids 2400', 's1d0 → Mains 4200']);
  assert.deepEqual(asked(p), [], 'nothing asked: each Salad is in its own section');
  assert.deepEqual(changed(p), []);
});

test('round 10 (QA, seed -1686291165): an option\'s question on a target takes the answer that names the target first', () => {
  const draft = (extras: Array<[string, string]>) => draftOf([section('s', 'עיקריות', 'Mains', [dish('d', 'המבורגר', 'Burger', 6000, { groups: [link('g0')] })])], [
    group('g0', 'רוטב', 'Sauce', { options: [opt('o', 'צ׳יפס', 'Fries', 0, { opens: 'g1' })] }),
    group('g1', 'תוספות', 'Extras', { selection: 'multiple', min: 0, max: 2, options: extras.map(([he, en], i) => opt(`x${i}`, he, en, 0)) }),
  ]);
  const m = applyPlan(EMPTY_MENU, plan(draft([['אורז', 'Rice']]), EMPTY_MENU));
  const sauce = m.groups.find((g) => g.name_en === 'Sauce')!.id;
  // the re-read adds an extra: the venue's Sauce is the only target of g0, so its question is keyed without its id
  const reread = draft([['אורז', 'Rice'], ['סלט', 'Salad']]);
  assert.deepEqual(asked(plan(reread, m)), ['group_changed@o>g1=keep_mine']);
  // an answer stored for that same target under its own name (from an import where it was not the first) wins over a
  // stale one under the short key, as the owner gave it for this group
  const both = yes({ 'group_changed@o>g1': 'keep_mine', [`group_changed@o@${sauce}>g1`]: 'add_options' });
  const p = plan(reread, m, both);
  assert.deepEqual(asked(p), ['group_changed@o>g1=add_options']);
  assert.deepEqual(changed(p).filter((s) => s.startsWith('option:')), ['option:x1:create']);
});

test('round 10 (backend b9bc23c): mergePrevious counts only imports with applied_at and applied_ids, as app.existing_menu', () => {
  const a = { id: uuid(0x1), appliedAt: '2026-10-20T10:00:00Z', appliedIds: { sections: { s: 'S1' }, dishes: { d: 'D1' } } };
  const notApplied = { id: uuid(0x2), appliedAt: null, appliedIds: { sections: { s: 'S9' }, dishes: { d: 'D9' } } };
  const partial = { id: uuid(0x3), appliedAt: '2026-10-20T11:00:00Z', appliedIds: { sections: { s: 'S2' } } as unknown as ImportedIds };
  assert.deepEqual(mergePrevious([a, notApplied, partial]), { sections: { s: 'S2' }, dishes: { d: 'D1' } });
  assert.equal(mergePrevious([notApplied]), undefined);
});

test('round 10 (backend b9bc23c): past BLOCKERS_MAX the blockers are too_many alone, for the owner and for Halom', () => {
  const blockers = (n: number) => Array.from({ length: n }, () => 'Not A Blocker');
  const owner = (n: number) => { const v = validateSetStep({ venueId: VENUE_ID, step: 'menu', state: 'blocked', blockers: blockers(n) }); return v.ok ? [] : v.errors.map((e) => e.code); };
  assert.deepEqual(owner(BLOCKERS_MAX + 1), ['too_many']);
  assert.equal(owner(BLOCKERS_MAX).filter((c) => c === 'blocker_invalid').length, BLOCKERS_MAX);
  const halom = (n: number) => {
    const v = validateActForOwner({
      venueId: VENUE_ID, reason: 'the owner asked by phone', action: 'onboarding.set',
      payload: { step: 'menu', state: 'blocked', blockers: blockers(n), expectedUpdatedAt: null },
    });
    return v.ok ? [] : v.errors.map((e) => e.code);
  };
  assert.deepEqual(halom(BLOCKERS_MAX + 1), ['too_many']);
  assert.equal(halom(BLOCKERS_MAX).filter((c) => c === 'blocker_invalid').length, BLOCKERS_MAX);
});

test('round 10 (backend b9bc23c): a "doing" on a done step is kept; apply_import may answer import_busy', () => {
  const progress = onboardingProgress([]);
  const owner: SetStepReply = { ok: true, kept: true, progress };
  // round 10d (QA-L11): a kept step writes no support.act_for_owner row, so its logId is null
  const halom: ActForOwnerReply = { ok: true, action: 'onboarding.set', result: { step: 'menu', state: 'done', kept: true, progress }, logId: null };
  const logged: ActForOwnerReply = { ok: true, action: 'onboarding.set', result: { step: 'menu', state: 'done', progress }, logId: 1 };
  const busy: ApplyImportReply = { ok: false, code: 'import_busy' };
  assert.ok(owner.ok && owner.kept && halom.ok && halom.logId === null && logged.ok && logged.logId === 1 && !busy.ok);
});

test('round 10d (the backend\'s replies at 202522b): apply_import may answer rate_limited; import_caps names its key', () => {
  const capped: ApplyImportReply = { ok: false, code: 'rate_limited' };
  assert.ok(!capped.ok && capped.code === 'rate_limited');
  assert.deepEqual([...IMPORT_CAP_KEYS], ['per_venue_day', 'scan_images_per_venue_day', 'scan_images_per_user_day', 'scan_images_per_day', 'refused_applies_per_venue_hour']);
  assert.ok(SCAN_IMAGE_CAPS.every((k) => (IMPORT_CAP_KEYS as readonly string[]).includes(k)));
});

test('round 10 (fuzz seed -304226620): an option add_options adds opens its nested group, created for it, so the next import asks nothing', () => {
  const draft = (salad: Partial<DraftOption>, kidsName = 'ראשונות') => draftOf([section('s0', kidsName, 'Starters', [dish('s0d0', 'שניצל', 'Schnitzel', 3000, { groups: [link('g0')] })])], [
    group('g0', 'רוטב', 'Sauce', { selection: 'multiple', min: 2, max: 3, options: [opt('g0o0', 'אורז', 'Rice', 0), opt('g0o1', 'צ׳יפס', 'Fries', 0), opt('g0o2', 'סלט', 'Salad', null, salad)] }),
    group('g1', 'תוספת', 'Side', { selection: 'multiple', min: 0, max: 1, options: [opt('g1o1', 'איולי', 'Aioli', 300)] }),
  ]);
  // the first read: the Salad's price unreadable, left out; Side is used by nothing, so it is not created
  const first = draft({ maxQty: 2 });
  const m1 = applyPlan(EMPTY_MENU, plan(first, EMPTY_MENU, yes({ 'option_price_unreadable@g0o2': 'skip' })));
  assert.deepEqual(m1.groups.map((g) => g.name_en), ['Sauce']);
  // the re-read: the Salad has a price and opens Side; the owner adds it to the venue's Sauce
  const reread = draft({ price: 500, opens: 'g1' });
  const answers = yes({ 'group_changed@s0d0>g0': 'add_options' });
  const p = plan(reread, m1, answers);
  assert.deepEqual(changed(p).filter((s) => !s.startsWith('dish')), ['group:g1:create', 'option:g0o2:create', 'option:g1o1:create']);
  assert.deepEqual(step(p, 'option', 'g0o2').refs, { opens_group_id: 'g1' }, 'the added Salad opens the Side this plan creates');
  const m2 = applyPlan(m1, p);
  assert.deepEqual(menuRuleBreaks(m2), []);
  const salad = m2.options.find((o) => o.name_en === 'Salad')!;
  assert.equal(m2.groups.find((g) => g.id === salad.opens_group_id)?.name_en, 'Side');
  // the same re-read again: nothing new asked (before, opens_changed was, and new_group wrote), nothing written
  const again = plan(reread, m2, yes({ ...answers.choices, 'opens_changed@g0o2>g1': 'new_group' }));
  assertHopa(again, p, 'the re-read again');
});

test('round 10 (QA fuzz seed -427087555): the added option opens the venue\'s own nested group when it has one', () => {
  const draft = (sauce: DraftOption[]) => draftOf([section('s-mains', 'עיקריות', 'Mains', [
    dish('d-mains-burger', 'המבורגר', 'Burger', 6000, { groups: [link('g-sauce')] }),
    dish('d-mains-salad', 'סלט', 'Salad', 4000, { groups: [link('g-extras')] }),
  ])], [
    group('g-sauce', 'רוטב', 'Sauce', { selection: 'multiple', min: 0, max: 2, options: sauce }),
    group('g-extras', 'תוספות', 'Extras', { selection: 'multiple', min: 0, max: 2, options: [opt('o-rice', 'אורז', 'Rice', 0), opt('o-fries', 'צ׳יפס', 'Fries', 0)] }),
  ]);
  const m1 = applyPlan(EMPTY_MENU, plan(draft([opt('o-ketchup', 'קטשופ', 'Ketchup', 0)]), EMPTY_MENU));
  const extras = m1.groups.find((g) => g.name_en === 'Extras')!.id;
  const reread = draft([opt('o-ketchup', 'קטשופ', 'Ketchup', 0), opt('o-aioli', 'איולי', 'Aioli', 0, { opens: 'g-extras' })]);
  const answers = yes({ 'group_changed@d-mains-burger>g-sauce': 'add_options' });
  const p = plan(reread, m1, answers);
  assert.deepEqual(step(p, 'option', 'o-aioli').set, { position: 1, name_he: 'איולי', name_en: 'Aioli', price: 0, max_qty: 1, is_default: false,
    group_id: m1.groups.find((g) => g.name_en === 'Sauce')!.id, opens_group_id: extras });
  const m2 = applyPlan(m1, p);
  assert.deepEqual(menuRuleBreaks(m2), []);
  assertHopa(plan(reread, m2, yes({ ...answers.choices, 'opens_changed@o-aioli>g-extras': 'new_group' })), p, 'the re-read again');
});

test('round 10 (SEC-M4): a menu at the limits whose 200 groups share one name re-imports in bounded time, writing nothing', () => {
  for (const shape of ['shared', 'same'] as const) {
    // 40 sections × 10 dishes, 200 groups × 30 options, one link per dish; every group "Extras". `shared`: 29 option
    // names every group has and one of its own; `same`: one option name throughout
    const groups = Array.from({ length: 200 }, (_, g) => group(`g${g}`, 'תוספות', 'Extras', {
      selection: 'multiple', min: 0, max: 3,
      options: Array.from({ length: 30 }, (_, o) => {
        const name = shape === 'same' ? 'Rice' : o < 29 ? `Shared ${o}` : `Own ${g}`;
        return opt(`g${g}o${o}`, `${name} א`, name, 100);
      }),
    }));
    const sections = Array.from({ length: 40 }, (_, s) => section(`s${s}`, `קטגוריה ${s}`, `Section ${s}`, Array.from({ length: 10 }, (_, d) =>
      dish(`s${s}d${d}`, `מנה ${s} ${d}`, `Dish ${s} ${d}`, 5000, { groups: [link(`g${(s * 10 + d) % 200}`)] }))));
    const d = draftOf(sections, groups);
    const m = applyPlan(EMPTY_MENU, plan(d));
    assert.equal(m.options.length, 6000);
    const t0 = performance.now();
    const again = plan(d, m);
    const ms = performance.now() - t0;
    assert.deepEqual(changed(again), [], shape);
    // before the bound, `same` took about 9 s here (every candidate's full cover, 200 × 200 × 900 pairs)
    assert.ok(ms < 6000, `${shape}: the re-import took ${ms.toFixed(0)} ms`);
  }
});

test('round 10 (SEC-M4, 10c): candidates in order, count misfits passed over; after 8 failed covers only twin groups; never a silent duplicate', () => {
  // a venue group whose options pass the count checks for the draft's two options, yet the cover fails: the draft's
  // אורז/Rice takes the venue's אורז/Rice (score 3) before ''/Rice can, and ''/Rice matches nothing else
  const failing = (i: number) => ({ id: uuid(0x100 + i), options: [['אורז', 'Rice'], ['אורז', 'Pilaf']] as const });
  const covering = { id: uuid(0x1ff), options: [['אורז', 'Rice'], ['אורז', 'Pilaf'], ['', 'Rice']] as const };
  const tooFew = (i: number) => ({ id: uuid(0x80 + i), options: [['אורז', 'Rice']] as const });
  const venue = (gs: ReadonlyArray<{ id: string; options: ReadonlyArray<readonly [string, string]> }>): ExistingMenu => ({
    ...EMPTY_MENU,
    groups: gs.map((g) => ({ id: g.id, name_he: 'תוספות', name_en: 'Extras', selection: 'multiple' as const, min_units: 0, max_units: 2 })),
    options: gs.flatMap((g, gi) => g.options.map(([he, en], j) => ({
      id: uuid(0x1000 + gi * 10 + j), group_id: g.id, position: j, name_he: he, name_en: en, price: 0, max_qty: 1, opens_group_id: null,
    }))),
  });
  const d = draftOf([section('s', 'עיקריות', 'Mains', [dish('d', 'המבורגר', 'Burger', 6000, { groups: [link('g')] })])], [
    group('g', 'תוספות', 'Extras', { selection: 'multiple', min: 0, max: 2, options: [opt('a', 'אורז', 'Rice', 0), opt('b', '', 'Rice', 0)] }),
  ]);
  const landing = (m: ExistingMenu) => { const s = step(plan(d, m), 'group', 'g'); return s.op === 'create' ? 'created' : s.id; };
  // groups with fewer options come first in the order; a group that is too small is passed over without a try
  const tooSmall = Array.from({ length: 20 }, (_, i) => tooFew(i));
  assert.equal(landing(venue([...tooSmall, ...Array.from({ length: 7 }, (_, i) => failing(i)), covering])), covering.id, '7 failed tries, the 8th covers');
  // after 8 failed covers, a group with a twin for each draft option (as an import of this group makes it) is still tried
  assert.equal(landing(venue([...tooSmall, ...Array.from({ length: 8 }, (_, i) => failing(i)), covering])), covering.id, 'the twin group, after the bound');
  // one that covers without twins is not tried: rather than make a second Extras in silence, the plan is refused
  const coversOtherwise = { id: uuid(0x1fe), options: [['אורז', 'Rice'], ['צ׳יפס', 'Rice']] as const };
  const r = planApply(d, venue([...Array.from({ length: 8 }, (_, i) => failing(i)), coversOtherwise]), yes());
  assert.deepEqual(r.ok ? [] : r.errors, [{ code: 'group_ambiguous', path: 'g' }]);
  assert.equal(landing(venue([...Array.from({ length: 7 }, (_, i) => failing(i)), coversOtherwise])), coversOtherwise.id, 'within the bound, it is tried');
  // a walk that tried every candidate the counts allow, and found none, makes the group as before
  assert.equal(landing(venue([...tooSmall, ...Array.from({ length: 12 }, (_, i) => failing(i))].filter((_, i) => i < 28))), 'created');
  assert.equal(step(plan(d, venue(Array.from({ length: 8 }, (_, i) => failing(i)))), 'group', 'g').op, 'create', '8 tried, nothing left untried');
});

// ---------------------------------------------------------------- round 10c (QA of 202522b)

test('round 10c (QA-M4, r10-nesting-pg.ts N1–N3): one nesting level on the menu as the plan leaves it, asked per opener', () => {
  const sauce = (k: string, opts: ReturnType<typeof opt>[]) => group(k, 'רוטב', 'Sauce', { selection: 'multiple', min: 0, max: 3, options: opts });
  const venueOf = (d: ImportDraft) => applyPlan(EMPTY_MENU, plan(d), d);
  const base = draftOf([section('s', 'עיקריות', 'Mains', [dish('d-burger', 'המבורגר', 'Burger', 6000, { groups: [link('g-sauce')] }), dish('d-steak', 'סטייק', 'Steak', 9000)])],
    [sauce('g-sauce', [opt('a', 'איולי', 'Aioli', 0), opt('k', 'קטשופ', 'Ketchup', 0)])]);
  const herbs = (k: string, opts: ReturnType<typeof opt>[]) => group(k, 'עשבים', 'Herbs', { selection: 'multiple', min: 0, max: 2, options: opts });
  // N1: a new Side's Fries opens the venue's Sauce, and the Burger's Sauce gets a Chili (add_options) that opens Herbs
  const n1 = draftOf([section('s', 'עיקריות', 'Mains', [
    dish('d-burger', 'המבורגר', 'Burger', 6000, { groups: [link('g-burger-sauce')] }), dish('d-steak', 'סטייק', 'Steak', 9000, { groups: [link('g-side')] }),
  ])], [
    group('g-side', 'תוספת', 'Side', { options: [opt('f', 'צ׳יפס', 'Fries', 0, { opens: 'g-sauce' }), opt('s2', 'סלט', 'Salad', 0)] }),
    sauce('g-sauce', [opt('a2', 'איולי', 'Aioli', 0)]),
    sauce('g-burger-sauce', [opt('a3', 'איולי', 'Aioli', 0), opt('c3', 'צ׳ילי', 'Chili', 0, { opens: 'g-herbs' })]),
    herbs('g-herbs', [opt('h1', 'פטרוזיליה', 'Parsley', 0)]),
  ]);
  // N2: two add_options answers chain Sauce → Herbs → Dips
  const base2 = draftOf([section('s', 'עיקריות', 'Mains', [
    dish('d-burger', 'המבורגר', 'Burger', 6000, { groups: [link('g-sauce')] }), dish('d-steak', 'סטייק', 'Steak', 9000, { groups: [link('g-herbs')] }),
  ])], [sauce('g-sauce', [opt('a', 'איולי', 'Aioli', 0), opt('k', 'קטשופ', 'Ketchup', 0)]), herbs('g-herbs', [opt('h1', 'פטרוזיליה', 'Parsley', 0)])]);
  const n2 = draftOf([section('s', 'עיקריות', 'Mains', [
    dish('d-burger', 'המבורגר', 'Burger', 6000, { groups: [link('g-burger-sauce')] }), dish('d-steak', 'סטייק', 'Steak', 9000, { groups: [link('g-steak-herbs')] }),
  ])], [
    sauce('g-burger-sauce', [opt('a3', 'איולי', 'Aioli', 0), opt('c3', 'צ׳ילי', 'Chili', 0, { opens: 'g-herbs' })]),
    herbs('g-herbs', [opt('h2', 'פטרוזיליה', 'Parsley', 0)]),
    herbs('g-steak-herbs', [opt('h3', 'פטרוזיליה', 'Parsley', 0), opt('m3', 'נענע', 'Mint', 0, { opens: 'g-dips' })]),
    group('g-dips', 'מטבלים', 'Dips', { options: [opt('t1', 'טחינה', 'Tahini', 0), opt('t2', 'חומוס', 'Hummus', 0)] }),
  ]);
  // N3 (since 7c9d25b): a created option opens the venue's Sauce while opens_changed new_group moves its Aioli to a new Dips
  const n3 = draftOf([section('s', 'עיקריות', 'Mains', [
    dish('d-burger', 'המבורגר', 'Burger', 6000, { groups: [link('g-burger-sauce')] }), dish('d-steak', 'סטייק', 'Steak', 9000, { groups: [link('g-side')] }),
  ])], [
    group('g-side', 'תוספת', 'Side', { options: [opt('f', 'צ׳יפס', 'Fries', 0, { opens: 'g-sauce' }), opt('s2', 'סלט', 'Salad', 0)] }),
    sauce('g-sauce', [opt('a2', 'איולי', 'Aioli', 0)]),
    sauce('g-burger-sauce', [opt('a3', 'איולי', 'Aioli', 0, { opens: 'g-dips' }), opt('k3', 'קטשופ', 'Ketchup', 0)]),
    group('g-dips', 'מטבלים', 'Dips', { options: [opt('t1', 'טחינה', 'Tahini', 0), opt('t2', 'חומוס', 'Hummus', 0)] }),
  ]);
  const cases: Array<[string, ImportDraft, ImportDraft, Record<string, ImportChoice>, [string, string]]> = [
    ['N1', base, n1, { 'group_changed@d-burger>g-burger-sauce': 'add_options' }, ['f', 'c3']],
    ['N2', base2, n2, { 'group_changed@d-burger>g-burger-sauce': 'add_options', 'group_changed@d-steak>g-steak-herbs': 'add_options' }, ['c3', 'm3']],
    ['N3', base, n3, { 'opens_changed@a3>g-dips': 'new_group' }, ['f', 'a3']],
  ];
  for (const [label, b, d, choices, [first, second]] of cases) {
    const m = venueOf(b);
    // both openers of the chain are asked; unanswered, the plan is refused (it never writes what PostgreSQL refuses)
    const r = planApply(d, m, yes(choices));
    assert.deepEqual(r.ok ? [] : r.errors, [first, second].map((k) => ({ code: 'exception_unresolved', path: k, message: 'nesting_too_deep' })), label);
    // either answer ends the chain: the plan lists it, and the menu keeps one level
    for (const [k, c] of [[first, 'unlink'], [second, 'unlink'], [first, 'skip'], [second, 'skip']] as const) {
      const p = plan(d, m, yes({ ...choices, [`nesting_too_deep@${k}`]: c }));
      assert.ok(asked(p).includes(`nesting_too_deep@${k}=${c}`), `${label} ${k} ${c}`);
      assert.deepEqual(menuRuleBreaks(applyPlan(m, p, d)), [], `${label} ${k} ${c}`);
    }
  }
});

test('round 10c (R10 L2): an empty section is remembered as such, unless dishes were left out by hand', () => {
  const draft = draftOf([section('s0', 'עיקריות', 'Mains', [dish('s0d0', 'שניצל', 'Schnitzel', 3000), dish('s0d1', 'סלט', 'Salad', 3000)])]);
  const reread = renamedCopy(draft);
  const m1 = applyPlan(EMPTY_MENU, plan(draft), draft);
  // the re-read: "Mains new" is not proposed for a rename when the owner says no (new_section)... the dishes stay
  // where they are: the section is left empty with its dishes placed: null
  const answers = yes({ 'section_renamed@s0': 'keep_both', 'dish_elsewhere@s0d0': 'same_dish', 'dish_elsewhere@s0d1': 'same_dish' });
  const p = plan(reread, m1, answers);
  assert.equal(brief(step(p, 'section', 's0')), 'section:s0:skip(empty)');
  const ids = appliedIds(reread, p, () => undefined);
  assert.equal(ids.sections['s0'], null);
  // left out by hand (decisions.skip), the same section says nothing
  const byHand = plan(reread, m1, yes(answers.choices, ['s0d1']));
  assert.equal(brief(step(byHand, 'section', 's0')), 'section:s0:skip(empty)');
  assert.equal(hasOwnKey(appliedIds(reread, byHand, () => undefined).sections, 's0'), false);
});
const hasOwnKey = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
