import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAFT_BYTES_MAX, DRAFT_ROOT, draftBytes, draftCounts, draftExceptions, draftGroupLimits, EMPTY_MENU, EXCEPTION_CHOICES, EXCEPTIONS_MAX, exceptionId,
  IMPORT_EXCEPTION_CODES, IMPORT_EXCEPTIONS, IMPORT_IMAGES_MAX, importKey, linkKey, nameScore, PLAN_EXCEPTION_CODES, planApply, targetKey, validateApplyImport,
  validateCreateImport, validateDecisions, validateDraft, validateSaveDraft, type ExistingMenu, type ImportChoice, type ImportDecisions, type ImportDraft,
  type ImportPlan, type PlanStep,
} from '../src/import.ts';
import { LIMITS } from '../src/enums.ts';
import { applyPlan, bistroDraft, copy, dish, draftOf, group, link, opt, planProblems, section, tx } from './import-fixtures.ts';

const cp = String.fromCodePoint;
const yes = (choices: Record<string, ImportChoice> = {}, skip?: string[]): ImportDecisions =>
  ({ v: 1, pricesConfirmed: true, choices, ...(skip ? { skip } : {}) });
const codes = (raw: unknown) => {
  const r = validateDraft(raw);
  return r.ok ? [] : r.errors.map((e) => e.code).sort();
};
const plan = (d: ImportDraft, m: ExistingMenu = EMPTY_MENU, dec: ImportDecisions = yes()): ImportPlan => {
  const r = planApply(d, m, dec);
  if (r.ok === false) throw new Error(JSON.stringify(r.errors));
  assert.deepEqual(planProblems(r.value), []);
  return r.value;
};
const errorsOf = (d: ImportDraft, m: ExistingMenu = EMPTY_MENU, dec: ImportDecisions = yes()) => {
  const r = planApply(d, m, dec);
  return r.ok ? [] : r.errors.map((e) => `${e.code}@${e.path}`);
};
const step = (p: ImportPlan, kind: PlanStep['kind'], key: string) => p.steps.find((s) => s.kind === kind && s.key === key)!;
const setOf = (s: PlanStep) => s.set as Record<string, unknown>;
const opsOf = (steps: readonly PlanStep[]) => steps.map((s) => `${s.kind}:${s.key}:${s.op}`);
const changes = (p: ImportPlan) => p.steps.filter((s) => s.op !== 'keep').map((s) => `${s.kind}:${s.key}:${s.op}${s.reason ? `(${s.reason})` : ''}`);
const asked = (p: ImportPlan) => p.exceptions.map((e) => `${e.code}@${e.key}=${e.choice}`);
const once = (d: ImportDraft = bistroDraft()) => applyPlan(EMPTY_MENU, plan(d));
const nameOf = (m: ExistingMenu, sectionId: string) => m.sections.find((s) => s.id === sectionId)!.name_en;

// ---------------------------------------------------------------- the key

test('importKey: accents, Hebrew points, geresh, case, punctuation, symbols, emoji and blanks do not make two names different', () => {
  assert.equal(importKey('Crème Brûlée!'), 'creme brulee');
  assert.equal(importKey('  SCHNITZEL  (Wiener) '), 'schnitzel wiener');
  const pointed = `ש${cp(0x5c1, 0x5b7)}קש${cp(0x5c1)}ו${cp(0x5bc)}ק${cp(0x5b8)}ה`;
  assert.equal(importKey(pointed), 'שקשוקה');
  assert.equal(importKey('צ׳יפס'), 'ציפס', 'the geresh is removed, not a space');
  assert.equal(importKey("צ'יפס"), 'ציפס', "an ASCII ' after a Hebrew letter is a geresh");
  assert.equal(importKey('צ״ק'), 'צק');
  assert.equal(importKey('מ"מ'), 'ממ', 'an ASCII " after a Hebrew letter is gershayim');
  assert.equal(importKey("Joe's"), 'joe s', "after a Latin letter ' still separates");
  assert.equal(importKey(`Coffee ${cp(0x2615, 0xfe0f)}`), 'coffee');
  assert.equal(importKey('Coke™'), 'coke');
  assert.equal(importKey('Coke® Zero'), 'coke zero');
  assert.equal(importKey(`Keycap 1${cp(0xfe0f, 0x20e3)}`), 'keycap 1');
  assert.equal(importKey(`Fish${cp(0xa0)}&${cp(0x200b)}chips`), 'fish chips');
  assert.equal(importKey(cp(0xff33, 0xff4f, 0xff55, 0xff50)), 'soup', 'full-width letters fold (NFKD)');
  assert.equal(importKey('Lemonade — ₪18'), 'lemonade 18');
  assert.notEqual(importKey('Coke 330ml'), importKey('Coke 0.5L'));
  assert.equal(importKey(`עיקריות${cp(0x5be)}בית`), 'עיקריות בית', 'maqaf separates');
  assert.equal(importKey('!!! — ☕'), '');
  assert.equal(importKey('БОРЩ'), 'БОРЩ', 'lowercasing is A–Z only, so the database agrees exactly');
});

test('importKey: every code point outside the BMP is a space before NFKD (no Unicode-version differences)', () => {
  for (const c of [0x1f354, 0x1ccf0, 0x1ccd6, 0x1d400, 0x20000, 0xe0067, 0x10ffff]) assert.equal(importKey(`a${cp(c)}b`), 'a b', c.toString(16));
  assert.equal(importKey(`Pizza ${cp(0x1f355, 0x1f355)}`), 'pizza');
  assert.equal(importKey(`${cp(0x1f1ee, 0x1f1f1)} Falafel`), 'falafel');
});

test('nameScore: Hebrew counts 2, English 1, empty never matches', () => {
  assert.equal(nameScore(tx('שניצל', 'Schnitzel'), tx('שניצל', 'schnitzel!')), 3);
  assert.equal(nameScore(tx('שניצל', 'Wiener'), tx('שניצל', 'Schnitzel')), 2);
  assert.equal(nameScore(tx('', 'Schnitzel'), tx('שניצל', 'SCHNITZEL')), 1);
  assert.equal(nameScore(tx('', ''), tx('', '')), 0);
});

// ---------------------------------------------------------------- validation

test('the base draft is valid; its counts carry the lines the reader dropped', () => {
  assert.deepEqual(codes(bistroDraft()), []);
  assert.deepEqual(draftCounts({ ...bistroDraft(), dropped: 3 }), { sections: 2, dishes: 3, groups: 3, options: 6, photos: 0, dropped: 3 });
});

test('validateDraft: what a broken reader produces is refused with a code', () => {
  const mut = (f: (x: any) => void) => { const x: any = copy(bistroDraft()); f(x); return x; };
  assert.deepEqual(codes(null), ['type']);
  assert.deepEqual(codes(mut((x) => { x.v = 2; })), ['version']);
  assert.deepEqual(codes(mut((x) => { x.source = 'wolt_page'; })), ['enum_invalid']);
  assert.deepEqual(codes(mut((x) => { delete x.dropped; })), ['count_invalid']);
  assert.deepEqual(codes(mut((x) => { x.dropped = -1; })), ['count_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].key = 'Bad Key'; })), ['key_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[1].dishes[0].key = 'd-burger'; })), ['key_duplicate']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].name = tx(cp(0x200b), ' '); })), ['name_missing']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].tags = ['halal']; })), ['enum_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].price = -1; })), ['price_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].price = 64.5; })), ['price_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].priceText = 'x'.repeat(41); })), ['text_too_long']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].groups = [link('g-nope')]; })), ['ref_unknown']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[1].groups = [link('g-side'), link('g-side')]; })), ['addon_duplicate']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].groups = [link('g-side', 0, 1)]; })), ['limits_loosened'], 'a stated limit only tightens');
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[1].groups = [link('g-extras', 0, 2)]; })), [], 'max 2 of the guessed 3 tightens');
  assert.deepEqual(codes(mut((x) => { x.groups[1].options[0].opens = 'g-nope'; })), ['ref_unknown']);
  assert.deepEqual(codes(mut((x) => { x.groups[1].options[0].opens = 'g-sauce'; })), ['opens_self']);
  assert.deepEqual(codes(mut((x) => { x.groups[0].options[0].maxQty = 2; })), ['opener_qty']);
  assert.deepEqual(codes(mut((x) => { x.groups[0].options[1].maxQty = 11; })), ['option_qty_invalid']);
  assert.deepEqual(codes(mut((x) => { x.groups[0].max = 2; })), ['single_max']);
  assert.deepEqual(codes(mut((x) => { x.groups[0].min = 2; x.groups[0].max = null; })), ['limits_invalid'], 'a single choice needs at most one');
  assert.deepEqual(codes(mut((x) => { x.groups[2].min = 3; x.groups[2].max = 2; })), ['limits_invalid']);
  assert.deepEqual(codes(mut((x) => { x.groups[2].max = 31; })), ['limits_invalid']);
  assert.deepEqual(codes(mut((x) => { x.groups[2].options = []; })), ['options_empty']);
  assert.deepEqual(codes(mut((x) => { x.groups[1].options.forEach((o: any) => { o.default = true; }); })), ['defaults_exceed']);
  assert.deepEqual(codes(mut((x) => { x.source = 'scan'; x.sections[0].dishes[0].photo = { path: '/abs/x.jpg', rights: 'unknown' }; })), ['path_invalid']);
  assert.deepEqual(codes(mut((x) => { x.source = 'scan'; x.sections[0].dishes[0].photo = { path: 'v/../x.jpg', rights: 'unknown' }; })), ['path_invalid']);
  assert.deepEqual(codes(mut((x) => { x.source = 'scan'; x.sections[0].dishes[0].photo = { path: 'https://cdn.example/x.jpg', rights: 'unknown' }; })), ['path_invalid']);
  assert.deepEqual(codes(mut((x) => { x.source = 'scan'; x.sections[0].dishes[0].photo = { path: 'v/x.jpg', rights: 'yes' }; })), ['enum_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].illustration = 'Bad Id'; })), ['stock_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].translated = ['en', 'en']; })), ['translated_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].name = tx('שניצל', ''); x.sections[0].dishes[0].translated = ['en']; })), ['translated_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].room = 'garden'; })), ['enum_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections = Array.from({ length: 81 }, (_, i) => section(`s${i}`, '', `S${i}`, [])); })), ['too_large']);
});

test('validateDraft: no key the type does not have, at any level (M5)', () => {
  const x: any = copy(bistroDraft());
  x.raw = 'the whole pasted text';
  x.sections[0].note = 'x';
  x.sections[0].dishes[0].guestNote = 'x';
  x.sections[0].dishes[0].name.fr = 'Escalope';
  x.sections[0].dishes[0].groups[0].why = 'x';
  x.groups[0].sourceLine = 'x';
  x.groups[0].options[0].sourceLine = 'x';
  const r = validateDraft(x);
  assert.deepEqual(r.ok ? [] : r.errors.map((e) => `${e.code}@${e.path}`).sort(), [
    'field_not_allowed@groups[0].options[0].sourceLine', 'field_not_allowed@groups[0].sourceLine', 'field_not_allowed@raw',
    'field_not_allowed@sections[0].dishes[0].groups[0].why', 'field_not_allowed@sections[0].dishes[0].guestNote',
    'field_not_allowed@sections[0].dishes[0].name.fr', 'field_not_allowed@sections[0].note',
  ]);
});

test('validateDraft: text PostgreSQL cannot store is refused; lengths count code points (L1)', () => {
  const nul: any = copy(bistroDraft());
  nul.sections[0].dishes[0].name.en = `Schnit${String.fromCharCode(0)}zel`;
  assert.deepEqual(codes(nul), ['text_invalid']);
  const lone: any = copy(bistroDraft());
  lone.sections[0].dishes[0].name.en = `Schnitzel ${String.fromCharCode(0xd83c)}`;
  assert.deepEqual(codes(lone), ['text_invalid']);
  const burgers: any = copy(bistroDraft());
  burgers.sections[0].dishes[0].name.en = cp(0x1f354).repeat(LIMITS.nameLength);
  assert.deepEqual(codes(burgers), [], '90 emoji are 90 characters (180 UTF-16 units)');
  burgers.sections[0].dishes[0].name.en += cp(0x1f354);
  assert.deepEqual(codes(burgers), ['text_too_long']);
});

test('validateDraft: a dish limit may not contradict the group\'s stated limits; a guess yields to a dish (M3, L11, readers QA-H2)', () => {
  const d: any = copy(bistroDraft());
  d.sections[0].dishes[1].groups = [link('g-side'), link('g-extras', 5, null)]; // extras: guessed, capacity 3
  assert.deepEqual(codes(d), [], 'what the options can reach is the plan\'s business, not an invalid draft');
  assert.equal(setOf(step(plan(d), 'dish_group', linkKey('d-burger', 'g-extras'))).min_units, 3, 'the plan lowers a minimum the group cannot reach to its capacity');
  const stated: any = copy(d);
  stated.groups[2].min = 0; stated.groups[2].max = 3;
  assert.deepEqual(codes(stated), ['limits_invalid'], 'a dish minimum above the stated maximum');
  const s: any = copy(bistroDraft());
  s.groups[0].min = 2; s.groups[0].max = 3; s.groups[0].selection = 'multiple';
  s.groups[0].options.push(opt('o-rice', 'אורז', 'Rice', 0));
  s.groups[0].options[0].opens = null;
  s.sections[0].dishes[0].groups = [link('g-side', 1, null)];
  s.sections[0].dishes[1].groups = [link('g-extras')];
  assert.deepEqual(codes(s), ['limits_loosened'], 'below the stated minimum');
  s.sections[0].dishes[0].groups = [link('g-side', null, 1)];
  assert.deepEqual(codes(s), ['limits_invalid'], 'a maximum below the minimum it keeps');
  const guess: any = copy(bistroDraft());
  guess.groups[0].min = null; guess.groups[0].max = null; // guessed required (free options)
  guess.sections[0].dishes[0].groups = [link('g-side', 0, 1)];
  assert.deepEqual(codes(guess), [], 'a dish that says optional wins over a guess');
});

test('validateDraft: one dish never carries two groups of the same name and selection (H2)', () => {
  const d: any = copy(bistroDraft());
  d.groups.push(group('g-side-2', 'תוספת', 'Side of choice', { options: [opt('o-rice', 'אורז', 'Rice', 0)] }));
  d.sections[0].dishes[0].groups = [link('g-side'), link('g-side-2')];
  assert.deepEqual(codes(d), ['addon_duplicate']);
});

test('validateDraft: a text source carries no photos; the byte cap is the column check; at most EXCEPTIONS_MAX exceptions (M4, L11)', () => {
  const t: any = copy(bistroDraft());
  t.sections[0].dishes[0].photo = { path: 'v/imports/i/a.jpg', rights: 'unknown' };
  assert.deepEqual(codes(t), ['photo_unexpected']);
  assert.equal(draftBytes({ a: [1, 'b'], c: null }), '{"a": [1, "b"], "c": null}'.length, 'jsonb text: ": " and ", "');
  assert.equal(draftBytes('שלום'), 2 + 8);
  // the cap is 1 500 000 bytes (round 2, L11): a menu at LIMITS fits; 800 dishes with full Hebrew and English
  // descriptions do not
  assert.equal(DRAFT_BYTES_MAX, 1_500_000);
  const full = draftOf(
    Array.from({ length: 20 }, (_, s) => section(`s${s}`, `מדור ${s}`, `Section ${s}`, Array.from({ length: 20 }, (_, d) =>
      dish(`s${s}d${d}`, `מנה ${s} ${d}`, `Dish ${s} ${d}`, 3000, { groups: [link(`g${(s * 20 + d) % 200}`)] })))),
    Array.from({ length: 200 }, (_, g) => group(`g${g}`, `קבוצה ${g}`, `Group ${g}`, { selection: 'multiple', min: 0, max: 3,
      options: Array.from({ length: 30 }, (_, o) => opt(`g${g}o${o}`, `אפשרות ${o}`, `Option ${o}`, 100)) })),
  );
  assert.ok(draftBytes(full) > 1_100_000 && draftBytes(full) < DRAFT_BYTES_MAX, String(draftBytes(full)));
  assert.deepEqual(codes(full), [], 'a menu at LIMITS is accepted');
  const big = draftOf(Array.from({ length: 80 }, (_, i) => section(`s${i}`, `ס${i}`, `S${i}`,
    Array.from({ length: 10 }, (_, j) => dish(`s${i}d${j}`, `מ ${i} ${j}`, `Dish ${i} ${j}`, 100, { desc: tx('א'.repeat(600), 'y'.repeat(600)) })))));
  assert.ok(draftBytes(big) > DRAFT_BYTES_MAX);
  assert.deepEqual(codes(big), ['too_large']);
  // 800 dishes, each without a price, with a photo of unknown rights and allergens: 2400 exceptions
  const many: any = draftOf(Array.from({ length: 80 }, (_, i) => section(`s${i}`, `ס ${i}`, `S ${i}`, Array.from({ length: 10 }, (_, j) =>
    dish(`s${i}d${j}`, `מ ${i} ${j}`, `D ${i} ${j}`, null, { photo: { path: `v/i/${i}-${j}.jpg`, rights: 'unknown' }, allergens: tx('', 'nuts') })))),
    [], { source: 'scan' });
  assert.ok(draftExceptions(many).length > EXCEPTIONS_MAX);
  assert.deepEqual(codes(many), ['too_many_exceptions']);
});

test('validateDraft keeps what the owner can fix: no price, two levels of nesting, past LIMITS', () => {
  const d: any = copy(bistroDraft());
  d.sections[0].dishes[0].price = null;
  d.groups.push(group('g-dip', 'מטבל', 'Dip', { options: [opt('o-dip', 'טחינה', 'Tahini', 0)] }));
  d.groups[1].options[0].opens = 'g-dip';
  d.sections.push(...Array.from({ length: LIMITS.sections }, (_, i) => section(`s-x${i}`, '', `Extra ${i}`, [])));
  assert.deepEqual(codes(d), []);
});

// ---------------------------------------------------------------- exceptions

test('draftExceptions: the base draft has one check, the guessed limits of the extras', () => {
  assert.deepEqual(draftExceptions(bistroDraft()), [{ code: 'limits_guessed', severity: 'check', key: 'g-extras', path: 'groups[2]', count: 1 }]);
  const g = bistroDraft().groups[2]!;
  assert.deepEqual(draftGroupLimits(g, g.options), { min: 0, max: 3, stated: false, capacity: 3 });
});

test('guessed limits: a single choice is required only when it offers a free option or has a default (M7)', () => {
  const g = (options: any[]) => group('g', 'ש', 'Drink', { min: null, max: null, options });
  const L = (x: ReturnType<typeof g>) => draftGroupLimits(x, x.options).min;
  assert.equal(L(g([opt('a', 'קולה', 'Cola', 800), opt('b', 'סודה', 'Soda', 800)])), 0, '"add a drink?" is optional');
  assert.equal(L(g([opt('a', 'קולה', 'Cola', 800), opt('b', 'מים', 'Water', 0)])), 1, 'a free option: a choice to make');
  assert.equal(L(g([opt('a', 'קולה', 'Cola', 800, { default: true }), opt('b', 'סודה', 'Soda', 800)])), 1, 'a default');
  // S8: the plan creates the drink group optional
  const d: any = copy(bistroDraft());
  d.groups.push(group('g-drink', 'הוסיפו שתייה', 'Add a drink', { min: null, max: null, options: [opt('o-cola', 'קולה', 'Cola', 800), opt('o-soda', 'סודה', 'Soda', 800)] }));
  d.sections[0].dishes[1].groups.push(link('g-drink'));
  assert.deepEqual([setOf(step(plan(d), 'group', 'g-drink')).min_units, setOf(step(plan(d), 'group', 'g-drink')).max_units], [0, 1]);
});

test('draftExceptions: every code, at its node, in node order and then IMPORT_EXCEPTIONS order', () => {
  const d: any = copy(bistroDraft());
  const mains = d.sections[0];
  mains.dishes[0].price = null; // price_missing
  mains.dishes[1].price = null;
  mains.dishes[1].priceText = '₪ 7O'; // price_unreadable
  mains.dishes.push(dish('d-schnitzel-2', 'שניצל', 'Schnitzel', 6600)); // dish_duplicate
  mains.dishes.push(dish('d-water', 'מים', 'Water', 0)); // price_zero
  mains.dishes[0].allergens = tx('גלוטן, ביצים', ''); // allergens_check
  mains.dishes[0].translated = ['en']; // translation_check (grouped)
  d.source = 'wolt_screenshots';
  mains.dishes[0].photo = { path: 'v/imports/i/1.jpg', rights: 'unknown' }; // photo_rights_unknown
  d.sections.push(section('s-mains-2', 'עיקריות', '', [])); // section_duplicate + a missing English name (grouped)
  d.sections.push(section('s-popular', 'פופולרי', 'Popular', [dish('d-p-lemonade', 'לימונדה', 'Lemonade', 1800)])); // dish_repeated (same price)
  d.groups[2].min = 5; // limits_unreachable (capacity 3)
  d.groups.push(group('g-dip', 'מטבל', 'Dip', { options: [opt('o-dip', 'טחינה', 'Tahini', null, { priceText: '+?' })] })); // option_price_unreadable
  d.groups[1].options[0].opens = 'g-dip'; // nesting_too_deep (sauce is opened by fries)
  assert.deepEqual(codes(d), [], 'every exception is something the owner answers, not an invalid draft (readers QA-H2)');
  const got = draftExceptions(d).map((e) => `${e.code}@${e.key}:${e.severity}:${e.count}`);
  assert.deepEqual(got, [
    `name_missing_lang@${DRAFT_ROOT}:check:1`, `translation_check@${DRAFT_ROOT}:check:1`,
    'price_missing@d-schnitzel:fix:1', 'photo_rights_unknown@d-schnitzel:check:1', 'allergens_check@d-schnitzel:check:1',
    'price_unreadable@d-burger:fix:1',
    'dish_duplicate@d-schnitzel-2:fix:1',
    'price_zero@d-water:check:1',
    'section_duplicate@s-mains-2:fix:1',
    'dish_repeated@d-p-lemonade:check:1',
    'nesting_too_deep@o-aioli:fix:1',
    'limits_unreachable@g-extras:fix:1',
    'option_price_unreadable@o-dip:fix:1',
  ]);
  assert.ok(!draftExceptions(d, { langs: ['he'] }).some((e) => e.code === 'name_missing_lang'), 'it follows the venue\'s languages');
  for (const c of IMPORT_EXCEPTION_CODES) assert.ok(EXCEPTION_CHOICES[c].length > 0, c);
  for (const c of PLAN_EXCEPTION_CODES) assert.ok(c in IMPORT_EXCEPTIONS, c);
});

test('draftExceptions: a one-language source is one grouped exception, not one per node (M4)', () => {
  const big = draftOf(
    Array.from({ length: 20 }, (_, s) => section(`s${s}`, `מדור ${s}`, '', Array.from({ length: 20 }, (_, d) => dish(`s${s}d${d}`, `מנה ${s}-${d}`, '', 3000)))),
    Array.from({ length: 100 }, (_, g) => group(`g${g}`, `קבוצה ${g}`, '', { selection: 'multiple', min: 0, max: 3,
      options: Array.from({ length: 10 }, (_, o) => opt(`g${g}o${o}`, `אפשרות ${o}`, '', 0)) })),
  );
  assert.deepEqual(codes(big), []);
  assert.deepEqual(draftExceptions(big), [{ code: 'name_missing_lang', severity: 'check', key: DRAFT_ROOT, path: '', count: 20 + 400 + 100 + 1000 }]);
});

test('draftExceptions: past LIMITS in draft order (sections, groups per dish)', () => {
  const d: any = copy(bistroDraft());
  d.sections = Array.from({ length: LIMITS.sections + 1 }, (_, i) => section(`s${i}`, `ס${i}`, `S${i}`, [dish(`d${i}`, `מ${i}`, `D${i}`, 100)]));
  assert.deepEqual(draftExceptions(d).filter((e) => e.code === 'too_many').map((e) => e.key), [`s${LIMITS.sections}`]);
  const e: any = copy(bistroDraft());
  e.groups = Array.from({ length: 9 }, (_, i) => group(`g${i}`, `ק${i}`, `G${i}`, { options: [opt(`o${i}`, `א${i}`, `O${i}`, 0)] }));
  e.sections[0].dishes[0].groups = e.groups.map((g: any) => link(g.key));
  e.sections[0].dishes[1].groups = [];
  assert.deepEqual(draftExceptions(e).filter((x) => x.code === 'too_many').map((x) => x.key), [linkKey('d-schnitzel', 'g8')]);
});

test('dish repeats across sections (M1): Wolt\'s "Popular" adds no second dish; after a merge the repeat is a fix', () => {
  const d: any = copy(bistroDraft());
  d.sections.push(section('s-popular', 'פופולרי', 'Popular', [dish('d-p-schnitzel', 'שניצל', 'Schnitzel', 6400), dish('d-p-burger', 'המבורגר', 'Burger', 7200)]));
  const p = plan(d);
  assert.deepEqual(asked(p).filter((a) => a.startsWith('dish_repeated')), ['dish_repeated@d-p-schnitzel=skip', 'dish_repeated@d-p-burger=skip']);
  assert.deepEqual(applyPlan(EMPTY_MENU, p).dishes.map((x) => x.name_en).sort(), ['Burger', 'Lemonade', 'Schnitzel']);
  // S14: a section split over two screenshots, merged, with one dish on both
  const s: any = copy(bistroDraft());
  s.sections.splice(1, 0, section('s-mains-2', 'עיקריות', 'Mains', [dish('d-burger-again', 'המבורגר', 'Burger', 7200), dish('d-fish', 'דג', 'Fish', 8800)]));
  assert.deepEqual(draftExceptions(s).map((e) => exceptionId(e)), ['section_duplicate@s-mains-2', 'dish_duplicate@d-burger-again', 'limits_guessed@g-extras']);
  assert.deepEqual(errorsOf(s, EMPTY_MENU, yes({ 'section_duplicate@s-mains-2': 'merge' })), ['exception_unresolved@d-burger-again']);
  const answers = yes({ 'section_duplicate@s-mains-2': 'merge', 'dish_duplicate@d-burger-again': 'skip' });
  const first = applyPlan(EMPTY_MENU, plan(s, EMPTY_MENU, answers));
  assert.deepEqual(first.dishes.map((x) => x.name_en).sort(), ['Burger', 'Fish', 'Lemonade', 'Schnitzel']);
  assert.deepEqual(changes(plan(s, first, answers)), ['section:s-mains-2:skip(merged)', 'dish:d-burger-again:skip(choice)'], 're-importing it changes nothing');
});

test('Popular first (round 2, M1): each repeated dish lands in its real section with its groups, whichever copy comes first', () => {
  const popular = () => section('s-popular', 'פופולרי', 'Popular', [dish('d-p-schnitzel', 'שניצל', 'Schnitzel', 6400), dish('d-p-burger', 'המבורגר', 'Burger', 7200)]);
  const menuOf = (m: ExistingMenu) => m.sections.map((s) => `${s.name_en}: ${m.dishes.filter((x) => x.section_id === s.id).map((x) =>
    `${x.name_en} [${m.dishGroups.filter((l) => l.dish_id === x.id).map((l) => m.groups.find((g) => g.id === l.group_id)!.name_en).join(', ')}]`).join('; ')}`);
  const results = ['last', 'first'].map((where) => {
    const d: any = copy(bistroDraft());
    if (where === 'first') d.sections.unshift(popular()); else d.sections.push(popular());
    assert.deepEqual(draftExceptions(d).filter((e) => e.code === 'dish_repeated').map((e) => e.key), ['d-p-schnitzel', 'd-p-burger'], where);
    const p = plan(d);
    const m = applyPlan(EMPTY_MENU, p);
    assert.deepEqual(changes(plan(d, m)).filter((c) => !c.includes(':skip(')), [], `${where}: re-importing it changes nothing`);
    return menuOf(m);
  });
  assert.deepEqual(results[1], results[0]);
  assert.deepEqual(results[0], ['Mains: Schnitzel [Side of choice]; Burger [Side of choice, Extras]', 'Drinks: Lemonade []']);
  // QA P3: Popular first and left out by the owner: the real dishes stay
  const d: any = copy(bistroDraft());
  d.sections.unshift(section('s-popular', 'פופולרי', 'Popular', [dish('d-p-schnitzel', 'שניצל', 'Schnitzel', 6400)]));
  const p = plan(d, EMPTY_MENU, yes({}, ['s-popular']));
  assert.deepEqual(['d-p-schnitzel', 'd-schnitzel', linkKey('d-schnitzel', 'g-side')].map((k) => step(p, k === 'd-p-schnitzel' || k === 'd-schnitzel' ? 'dish' : 'dish_group', k).op),
    ['skip', 'create', 'create']);
  // with no groups on either side: the copy in the section made mostly of copies is the repeat, then the smaller section
  const plain = (first: boolean) => {
    const mains = section('s-mains', 'עיקריות', 'Mains', [dish('d-a', 'שניצל', 'Schnitzel', 6400), dish('d-b', 'המבורגר', 'Burger', 7200), dish('d-c', 'פסטה', 'Pasta', 5400)]);
    const pop = section('s-pop', 'פופולרי', 'Popular', [dish('d-p', 'שניצל', 'Schnitzel', 6400)]);
    return draftExceptions(draftOf(first ? [pop, mains] : [mains, pop])).filter((e) => e.code === 'dish_repeated').map((e) => e.key);
  };
  assert.deepEqual([plain(true), plain(false)], [['d-p'], ['d-p']]);
});

// ---------------------------------------------------------------- the plan

test('the first import into an empty menu creates everything, in draft order, with positions from 0', () => {
  const p = plan(bistroDraft());
  assert.deepEqual(opsOf(p.steps), [
    'section:s-mains:create', 'section:s-drinks:create',
    'group:g-side:create', 'group:g-sauce:create', 'group:g-extras:create',
    'option:o-fries:create', 'option:o-salad:create', 'option:o-aioli:create', 'option:o-ketchup:create', 'option:o-cheese:create', 'option:o-egg:create',
    'dish:d-schnitzel:create', 'dish:d-burger:create', 'dish:d-lemonade:create',
    `dish_group:${linkKey('d-schnitzel', 'g-side')}:create`, `dish_group:${linkKey('d-burger', 'g-side')}:create`, `dish_group:${linkKey('d-burger', 'g-extras')}:create`,
  ]);
  assert.deepEqual(setOf(step(p, 'section', 's-drinks')), { position: 1, name_he: 'שתייה', name_en: 'Drinks', kind: 'drinks', room: null });
  assert.deepEqual(setOf(step(p, 'group', 'g-extras')),
    { label: 'Extras', name_he: 'תוספות', name_en: 'Extras', selection: 'multiple', min_units: 0, max_units: 3, limits_confirmed: false });
  assert.equal(setOf(step(p, 'group', 'g-side')).limits_confirmed, true);
  assert.deepEqual(step(p, 'option', 'o-fries').refs, { group_id: 'g-side', opens_group_id: 'g-sauce' });
  assert.equal(setOf(step(p, 'option', 'o-salad')).opens_group_id, null);
  assert.deepEqual(setOf(step(p, 'dish', 'd-burger')), {
    position: 1, name_he: 'המבורגר', name_en: 'Burger', desc_he: '', desc_en: '', price: 7200, price_note_he: '', price_note_en: '', tags: ['spicy'],
    allergens_he: '', allergens_en: '', stock_id: null,
  });
  assert.deepEqual(step(p, 'dish', 'd-lemonade').refs, { section_id: 's-drinks' });
  assert.deepEqual(setOf(step(p, 'dish_group', linkKey('d-burger', 'g-extras'))), { position: 1, min_units: null, max_units: null });
  assert.deepEqual(asked(p), ['limits_guessed@g-extras=accept']);
});

test('Hopa test 1: importing the same menu again creates nothing and changes nothing, whatever the order', () => {
  const m = once();
  const again = plan(bistroDraft(), m);
  assert.deepEqual(changes(again), []);
  const d: any = copy(bistroDraft());
  d.sections.reverse();
  d.sections[1].dishes.reverse();
  d.sections[1].dishes[1].name = tx(`ש${cp(0x5b0)}ניצל`, 'SCHNITZEL!');
  d.groups.reverse();
  d.groups.forEach((g: any) => g.options.reverse());
  const third = plan(d, m);
  assert.deepEqual(changes(third), []);
  assert.deepEqual(applyPlan(m, third), m);
});

test('noise (QA): reordered, renamed, re-spelled, a new price and a dish listed under another kind', () => {
  const m = once();
  const d: any = copy(bistroDraft());
  d.sections.reverse();
  d.sections[0].name = tx('משקאות', 'Beverages');
  const mains = d.sections[1];
  mains.dishes[0].name = tx(`ש${cp(0x5b0)}ניצל ${cp(0x2615, 0xfe0f)}`, 'SCHNITZEL!!');
  mains.dishes[1].price = 7600;
  mains.dishes.push(d.sections[0].dishes.pop());
  d.groups[0].name = tx('תוספת:', 'side of CHOICE');
  const p = plan(d, m);
  assert.deepEqual(changes(p), ['section:s-drinks:skip(empty)', 'dish:d-lemonade:create']);
  assert.deepEqual(asked(p), ['limits_guessed@g-extras=accept', 'price_differs@s-mains=keep_mine', 'dish_other_kind@d-lemonade=new_dish']);
  // the section's question, answered for the burger alone
  const same = plan(d, m, yes({ 'dish_other_kind@d-lemonade': 'same_dish', 'price_differs@d-burger': 'take_new' }));
  assert.deepEqual(changes(same), ['section:s-drinks:skip(empty)', 'dish:d-burger:update']);
  assert.deepEqual(setOf(step(same, 'dish', 'd-burger')), { price: 7600 });
});

test('H1 (S1): a renamed and reordered section keeps its dishes; a new price waits for the owner', () => {
  const d0 = draftOf([
    section('s-mains', 'עיקריות', 'Mains', [dish('d-m-salad', 'סלט', 'Salad', 4200), dish('d-m-steak', 'סטייק', 'Steak', 9800)]),
    section('s-kids', 'ילדים', 'Kids', [dish('d-k-salad', 'סלט', 'Salad', 2400), dish('d-k-nuggets', 'נאגטס', 'Nuggets', 3200)]),
  ]);
  const m = once(d0);
  const kidsId = m.sections.find((s) => s.name_en === 'Kids')!.id;
  const d1: any = copy(d0);
  d1.sections.reverse();
  d1.sections[0].name = tx('לקטנים', 'Little ones');
  d1.sections[0].dishes[0].price = 2600;
  const p = plan(d1, m);
  assert.deepEqual(asked(p), ['section_renamed@s-kids=same_section', 'price_differs@s-kids=keep_mine']);
  assert.deepEqual(changes(p), []);
  assert.equal(nameOf(m, m.dishes.find((x) => x.id === step(p, 'dish', 'd-k-salad').id)!.section_id), 'Kids');
  const taken = applyPlan(m, plan(d1, m, yes({ 'price_differs@d-k-salad': 'take_new' })));
  assert.deepEqual(taken.dishes.filter((x) => x.name_en === 'Salad').map((x) => [nameOf(taken, x.section_id), x.price]).sort(), [['Kids', 2600], ['Mains', 4200]]);
  const renamed = plan(d1, m, yes({ 'section_renamed@s-kids': 'rename' }));
  assert.deepEqual(setOf(step(renamed, 'section', 's-kids')), { name_he: 'לקטנים', name_en: 'Little ones' });
  assert.equal(step(renamed, 'section', 's-kids').id, kidsId);
  const both = plan(d1, m, yes({ 'section_renamed@s-kids': 'keep_both' }));
  assert.deepEqual(asked(both).filter((a) => a.startsWith('dish_elsewhere')), ['dish_elsewhere@d-k-salad=same_dish', 'dish_elsewhere@d-k-nuggets=same_dish']);
  assert.deepEqual(changes(both), ['section:s-kids:skip(empty)'], 'kept in Kids by default; nothing new');
});

test('H1 (S1b): dishes match inside their own section first, so same-name dishes never cross-wire', () => {
  const d0 = draftOf([
    section('s-mains', 'עיקריות', 'Mains', [dish('d-m', 'סלט', 'Salad', 4200)]),
    section('s-kids', 'ילדים', 'Kids', [dish('d-k', 'סלט', 'Kids salad', 2400)]),
  ]);
  const m = once(d0);
  const d1: any = copy(d0);
  d1.sections.reverse();
  d1.sections[0].dishes[0].name = tx('סלט', 'Salad');
  d1.sections[0].dishes[0].price = 2600;
  const p = plan(d1, m);
  const home = (key: string) => nameOf(m, m.dishes.find((x) => x.id === step(p, 'dish', key).id)!.section_id);
  assert.deepEqual([home('d-m'), home('d-k')], ['Mains', 'Kids']);
  assert.deepEqual(asked(p), ['price_differs@s-kids=keep_mine']);
  // the same answer whatever the draft order
  const d2: any = copy(d1);
  d2.sections.reverse();
  assert.deepEqual(plan(d2, m).steps.filter((s) => s.kind === 'dish').map((s) => [s.key, s.id]).sort(), p.steps.filter((s) => s.kind === 'dish').map((s) => [s.key, s.id]).sort());
});

test('H1 (S15): never matched across kinds without the owner: a burger is not the cocktail of the same name', () => {
  const existing: ExistingMenu = {
    ...EMPTY_MENU,
    sections: [{ id: '00000000-0000-4000-8000-0000000000a1', position: 0, name_he: 'קוקטיילים', name_en: 'Cocktails', kind: 'drinks' }],
    dishes: [{
      id: '00000000-0000-4000-8000-0000000000b1', section_id: '00000000-0000-4000-8000-0000000000a1', position: 0, name_he: 'קלאסי', name_en: 'Classic',
      desc_he: '', desc_en: '', price: 4800, price_note_he: '', price_note_en: '', tags: [], allergens_he: '', allergens_en: '', asset_id: null, stock_id: null,
    }],
  };
  const draft = draftOf([section('s-burgers', 'המבורגרים', 'Burgers', [dish('d-classic', 'קלאסי', 'Classic', 6200), dish('d-double', 'דאבל', 'Double', 7400)])]);
  const p = plan(draft, existing);
  assert.deepEqual(changes(p), ['section:s-burgers:create', 'dish:d-classic:create', 'dish:d-double:create']);
  assert.deepEqual(asked(p), ['dish_other_kind@d-classic=new_dish']);
  assert.ok(!p.steps.some((s) => s.id === '00000000-0000-4000-8000-0000000000b1'), 'the cocktail is untouched');
});

test('a re-import fills blanks, adds what is new, and never takes anything away', () => {
  const heOnly: any = copy(bistroDraft());
  heOnly.sections[0].dishes[0].name = tx('שניצל', '');
  heOnly.sections[0].dishes[1].tags = [];
  const m = once(heOnly);
  const d: any = copy(bistroDraft());
  d.sections[0].dishes[1].tags = ['vegan', 'spicy'];
  d.sections[0].dishes[0].desc = tx('', 'Crumbed, with lemon');
  d.sections[0].dishes.push(dish('d-fish', 'דג', 'Fish', 8800));
  d.sections.splice(1, 1);
  const p = plan(d, m);
  const schnitzel = m.dishes.find((x) => x.name_he === 'שניצל')!;
  const burger = m.dishes.find((x) => x.name_he === 'המבורגר')!;
  assert.deepEqual(step(p, 'dish', 'd-schnitzel'), { kind: 'dish', key: 'd-schnitzel', op: 'update', id: schnitzel.id, set: { name_en: 'Schnitzel', desc_en: 'Crumbed, with lemon' }, refs: {}, reason: null });
  assert.deepEqual(setOf(step(p, 'dish', 'd-burger')), { tags: ['vegan', 'spicy'] });
  assert.deepEqual([setOf(step(p, 'dish', 'd-fish')).section_id, setOf(step(p, 'dish', 'd-fish')).position], [burger.section_id, 2]);
  const lemonade = m.dishes.find((x) => x.name_en === 'Lemonade')!;
  assert.ok(!p.steps.some((s) => s.id === lemonade.id), 'what the source no longer has is left alone');
  const e: any = copy(bistroDraft());
  e.sections[0].dishes[0].name = tx('שניצל', 'Wiener schnitzel');
  assert.equal(step(plan(e, applyPlan(m, p)), 'dish', 'd-schnitzel').op, 'keep', "the owner's words are never replaced");
});

test('prices (M6, round 2 M4): a price of 0 is a check; prices that differ are one question per section and per group, default keep mine', () => {
  const d: any = copy(bistroDraft());
  d.sections[0].dishes[0].price = 0;
  assert.ok(draftExceptions(d).some((e) => exceptionId(e) === 'price_zero@d-schnitzel'));
  assert.equal(setOf(step(plan(d, EMPTY_MENU, yes({ 'price_zero@d-schnitzel': 'no_price' })), 'dish', 'd-schnitzel')).price, null);
  const m = once();
  const p = plan(d, m);
  assert.deepEqual(asked(p), ['price_zero@d-schnitzel=accept', 'limits_guessed@g-extras=accept', 'price_differs@s-mains=keep_mine']);
  assert.deepEqual(p.exceptions.find((e) => e.code === 'price_differs'), { code: 'price_differs', severity: 'check', key: 's-mains', path: 'sections[0]', count: 1, choice: 'keep_mine' });
  // two dishes and two options up: one question for the section, one for the group; an override answers one node
  const up: any = copy(bistroDraft());
  up.sections[0].dishes.forEach((x: any) => { x.price += 100; });
  up.groups[2].options.forEach((x: any) => { x.price += 100; });
  const pu = plan(up, m);
  assert.deepEqual(pu.exceptions.filter((e) => e.code === 'price_differs').map((e) => `${e.key}:${e.path}:${e.count}`), ['s-mains:sections[0]:2', 'g-extras:groups[2]:2']);
  const answered = plan(up, m, yes({ 'price_differs@s-mains': 'take_new', 'price_differs@d-burger': 'keep_mine', 'price_differs@g-extras': 'take_new' }));
  assert.deepEqual(['d-schnitzel', 'd-burger'].map((k) => setOf(step(answered, 'dish', k)).price), [6500, undefined]);
  assert.deepEqual(['o-cheese', 'o-egg'].map((k) => setOf(step(answered, 'option', k)).price), [400, 500]);
  assert.deepEqual(errorsOf(up, m, yes({ 'price_differs@d-burger': 'skip' })), ['choice_invalid@d-burger'], 'an override takes the same answers');
  assert.deepEqual(changes(p), []);
  const o: any = copy(bistroDraft());
  o.groups[2].options[0].price = 350;
  const q = plan(o, m, yes({ 'price_differs@o-cheese': 'take_new' }));
  assert.deepEqual(setOf(step(q, 'option', 'o-cheese')), { price: 350 });
  // an unread price never replaces the venue's
  const u: any = copy(bistroDraft());
  u.groups[2].options[1].price = null;
  u.groups[2].options[1].priceText = '+?';
  assert.equal(step(plan(u, m, yes({ 'option_price_unreadable@o-egg': 'free' })), 'option', 'o-egg').op, 'keep');
  assert.equal(setOf(step(plan(u, EMPTY_MENU, yes({ 'option_price_unreadable@o-egg': 'free' })), 'option', 'o-egg')).price, 0);
});

test('H2 (S2): a dish keeps the group it has; a re-read without the geresh is the same option', () => {
  const d0 = draftOf([section('s', 'עיקריות', '', [dish('d-schnitzel', 'שניצל', '', 6400, { groups: [link('g-side')] })])],
    [group('g-side', 'תוספת', '', { options: [opt('o-fries', 'צ׳יפס', '', 0), opt('o-salad', 'סלט', '', 0)] })], { source: 'scan' });
  const m = once(d0);
  const d1: any = copy(d0);
  d1.groups[0].options[0].name = tx('ציפס', '');
  assert.deepEqual(changes(plan(d1, m)), []);
  // a reading the venue's group does not cover: the dish still has one side group, unless the owner says otherwise
  const d2: any = copy(d0);
  d2.groups[0].options[0].name = tx('צפס', '');
  const p = plan(d2, m);
  const lk = linkKey('d-schnitzel', 'g-side');
  assert.deepEqual(asked(p).filter((a) => !a.startsWith('name_missing')), [`group_changed@${lk}=keep_mine`]);
  assert.deepEqual(changes(p), ['option:o-fries:skip(choice)']);
  const after = applyPlan(m, p);
  assert.deepEqual(after.dishGroups.length, 1);
  const added = applyPlan(m, plan(d2, m, yes({ [`group_changed@${lk}`]: 'add_options' })));
  assert.deepEqual(after.groups.length, added.groups.length);
  assert.deepEqual(added.options.map((o) => o.name_he).sort(), ['סלט', 'צפס', 'צ׳יפס'], 'added to the group the dish has');
  const fresh = plan(d2, m, yes({ [`group_changed@${lk}`]: 'new_group' }));
  assert.deepEqual(changes(fresh), ['group:g-side:create', 'option:o-fries:create', 'option:o-salad:create', `dish_group:${lk}:update`]);
  const moved = applyPlan(m, fresh);
  assert.equal(moved.dishGroups.length, 1, 'the link moved; the dish has one side group');
  assert.notEqual(moved.dishGroups[0]!.group_id, m.dishGroups[0]!.group_id);
});

test('H2 (S3): two groups with the same guest name (the owner\'s per-dish copies): each dish keeps its own', () => {
  const m = once();
  const side = m.groups.find((g) => g.name_en === 'Side of choice')!;
  const burger = m.dishes.find((x) => x.name_en === 'Burger')!;
  const copyId = '00000000-0000-4000-8000-0000000000c9';
  const sideOptions = m.options.filter((o) => o.group_id === side.id);
  const withCopy: ExistingMenu = {
    ...m,
    groups: [...m.groups, { ...side, id: copyId }],
    options: [...m.options, ...sideOptions.map((o, i) => ({ ...o, id: `00000000-0000-4000-8000-0000000000d${i}`, group_id: copyId }))],
    dishGroups: m.dishGroups.map((l) => (l.dish_id === burger.id && l.group_id === side.id ? { ...l, group_id: copyId } : l)),
  };
  const p = plan(bistroDraft(), withCopy);
  assert.deepEqual(changes(p), []);
  const first = side.id < copyId ? side.id : copyId;
  const other = first === side.id ? copyId : side.id;
  assert.deepEqual(p.steps.filter((s) => s.kind === 'group' && s.key.startsWith('g-side')).map((s) => [s.key, s.id]),
    [['g-side', first], [targetKey('g-side', other), other]]);
  const after = applyPlan(withCopy, p);
  for (const n of ['Burger', 'Schnitzel']) {
    const d = after.dishes.find((x) => x.name_en === n)!;
    assert.equal(after.dishGroups.filter((l) => l.dish_id === d.id && after.groups.find((g) => g.id === l.group_id)!.name_en === 'Side of choice').length, 1, n);
  }
});

test('order (L2): group and option steps follow the draft, whether they match or are created', () => {
  const m = once();
  const d: any = copy(bistroDraft());
  d.groups[0].options.push(opt('o-mash', 'פירה', 'Mash', 0));
  const p = plan(d, m);
  assert.deepEqual(p.steps.filter((s) => s.kind === 'group').map((s) => s.key), ['g-side', 'g-sauce', 'g-extras']);
  assert.deepEqual(p.steps.filter((s) => s.kind === 'option').map((s) => s.key), ['o-fries', 'o-salad', 'o-mash', 'o-aioli', 'o-ketchup', 'o-cheese', 'o-egg']);
  assert.deepEqual(asked(p).filter((a) => a.startsWith('group_changed')), [`group_changed@${linkKey('d-schnitzel', 'g-side')}=keep_mine`, `group_changed@${linkKey('d-burger', 'g-side')}=keep_mine`]);
});

test('a renamed section with a new dish (S4): the dish goes into the venue\'s section', () => {
  const m = once();
  const d: any = copy(bistroDraft());
  d.sections[0].name = tx('מנות עיקריות', 'Main courses');
  d.sections[0].dishes.push(dish('d-fish', 'דג', 'Fish', 8800));
  const p = plan(d, m);
  assert.deepEqual(changes(p), ['dish:d-fish:create']);
  const after = applyPlan(m, p);
  assert.deepEqual(after.sections.map((s) => [s.name_en, after.dishes.filter((x) => x.section_id === s.id).length]), [['Mains', 3], ['Drinks', 1]]);
});

test('skips (M2, M8, S6, S11, S13): any node by key; a group left empty goes with its links and the options that open it', () => {
  const d: any = copy(bistroDraft());
  d.groups.push(group('g-bread', 'לחם', 'Bread', { options: [opt('o-bread', 'לחם', 'Bread', null, { priceText: '₪?' })] }));
  d.sections[0].dishes[0].groups.push(link('g-bread'));
  const p = plan(d, EMPTY_MENU, yes({ 'option_price_unreadable@o-bread': 'skip' }));
  assert.deepEqual([step(p, 'group', 'g-bread').reason, step(p, 'option', 'o-bread').reason, step(p, 'dish_group', linkKey('d-schnitzel', 'g-bread')).reason],
    ['empty', 'choice', 'parent_skipped']);

  const e: any = copy(bistroDraft());
  e.groups[2].min = 2; e.groups[2].max = 2;
  e.groups[2].options = [opt('o-cheese', 'גבינה', 'Cheese', 300), opt('o-egg', 'ביצה', 'Egg', null, { priceText: '+?' })];
  assert.deepEqual(errorsOf(e, EMPTY_MENU, yes({ 'option_price_unreadable@o-egg': 'skip' })), ['exception_unresolved@g-extras'], 'a minimum the kept options cannot reach');
  const clamped = plan(e, EMPTY_MENU, yes({ 'option_price_unreadable@o-egg': 'skip', 'limits_unreachable@g-extras': 'clamp' }));
  assert.deepEqual([setOf(step(clamped, 'group', 'g-extras')).min_units, setOf(step(clamped, 'group', 'g-extras')).max_units], [1, 2]);

  const s: any = copy(bistroDraft());
  s.groups[1].options.forEach((o: any) => { o.price = null; o.priceText = '?'; });
  const noSauce = plan(s, EMPTY_MENU, yes({ 'option_price_unreadable@o-aioli': 'skip', 'option_price_unreadable@o-ketchup': 'skip' }));
  assert.deepEqual([step(noSauce, 'group', 'g-sauce').reason, step(noSauce, 'option', 'o-fries').reason, step(noSauce, 'option', 'o-salad').op],
    ['empty', 'parent_skipped', 'create'], 'fries opened the sauce: it goes with it');
  const oneSauce = plan(s, EMPTY_MENU, yes({ 'option_price_unreadable@o-aioli': 'skip', 'option_price_unreadable@o-ketchup': 'free' }));
  assert.deepEqual(step(oneSauce, 'option', 'o-fries').refs, { group_id: 'g-side', opens_group_id: 'g-sauce' });

  const owner = plan(bistroDraft(), EMPTY_MENU, yes({}, ['d-lemonade', 's-mains', 'o-egg']));
  assert.deepEqual([step(owner, 'dish', 'd-lemonade').reason, step(owner, 'section', 's-drinks').reason, step(owner, 'dish', 'd-burger').reason,
    step(owner, 'option', 'o-egg').reason, step(owner, 'group', 'g-side').reason], ['choice', 'empty', 'parent_skipped', 'choice', 'unused']);
  const unanswered = planApply(bistroDraft(), EMPTY_MENU, yes({ 'skip@d-lemonade': 'skip' } as Record<string, ImportChoice>));
  assert.equal(unanswered.ok && step(unanswered.value, 'dish', 'd-lemonade').op, 'create', 'a choice for an exception that does not exist is ignored');
});

test('answers: fixes must be answered; no_price, unlink, merge, keep_both; prices confirmed', () => {
  const d: any = copy(bistroDraft());
  d.sections[0].dishes[0].price = null;
  assert.deepEqual(errorsOf(d), ['exception_unresolved@d-schnitzel']);
  assert.deepEqual(errorsOf(d, EMPTY_MENU, yes({ 'price_missing@d-schnitzel': 'merge' })), ['choice_invalid@d-schnitzel']);
  assert.equal(setOf(step(plan(d, EMPTY_MENU, yes({ 'price_missing@d-schnitzel': 'no_price' })), 'dish', 'd-schnitzel')).price, null);
  const n: any = copy(bistroDraft());
  n.groups.push(group('g-dip', 'מטבל', 'Dip', { options: [opt('o-tahini', 'טחינה', 'Tahini', 0)] }));
  n.groups[1].options[0].opens = 'g-dip';
  const unlinked = plan(n, EMPTY_MENU, yes({ 'nesting_too_deep@o-aioli': 'unlink' }));
  assert.equal(setOf(step(unlinked, 'option', 'o-aioli')).opens_group_id, null);
  assert.equal(step(unlinked, 'group', 'g-dip').reason, 'unused');
  const m: any = copy(bistroDraft());
  m.sections.push(section('s-mains-2', 'עיקריות', 'Mains', [dish('d-fish', 'דג', 'Fish', 8800)]));
  const merged = plan(m, EMPTY_MENU, yes({ 'section_duplicate@s-mains-2': 'merge' }));
  assert.deepEqual([step(merged, 'section', 's-mains-2').reason, step(merged, 'dish', 'd-fish').refs, setOf(step(merged, 'dish', 'd-fish')).position],
    ['merged', { section_id: 's-mains' }, 2]);
  const both = plan(m, EMPTY_MENU, yes({ 'section_duplicate@s-mains-2': 'keep_both' }));
  assert.deepEqual([step(both, 'section', 's-mains-2').op, setOf(step(both, 'section', 's-mains-2')).position], ['create', 2]);
  assert.deepEqual(errorsOf(bistroDraft(), EMPTY_MENU, { v: 1, pricesConfirmed: false, choices: {} }), ['prices_unconfirmed@pricesConfirmed']);
});

test('S12: two same-name dishes kept apart; a re-read of one finds the closer name', () => {
  const d: any = copy(bistroDraft());
  d.sections[0].dishes.push(dish('d-schnitzel-2', 'שניצל', 'Schnitzel XL', 8400));
  const m = applyPlan(EMPTY_MENU, plan(d, EMPTY_MENU, yes({ 'dish_duplicate@d-schnitzel-2': 'keep_both' })));
  const e: any = copy(bistroDraft());
  e.sections[0].dishes[0] = dish('d-xl', 'שניצל', 'Schnitzel XL', 8600, { groups: [link('g-side')] });
  const p = plan(e, m);
  assert.equal(m.dishes.find((x) => x.id === step(p, 'dish', 'd-xl').id)!.name_en, 'Schnitzel XL');
  assert.deepEqual(asked(p).filter((a) => a.startsWith('price')), ['price_differs@s-mains=keep_mine']);
});

test('photos (D33, M11): only with rights; a picture still waiting for approval is kept, not doubled', () => {
  const d: any = copy(bistroDraft());
  d.source = 'wolt_screenshots';
  d.sections[0].dishes[0].photo = { path: 'v/imports/i/schnitzel.jpg', rights: 'confirmed' };
  d.sections[0].dishes[1].photo = { path: 'v/imports/i/burger.jpg', rights: 'unknown' };
  d.sections[0].dishes[1].illustration = 'burger';
  const p = plan(d);
  assert.deepEqual(step(p, 'photo', 'd-schnitzel'), {
    kind: 'photo', key: 'd-schnitzel', op: 'create', id: null, refs: { dish_id: 'd-schnitzel' }, reason: null,
    set: { kind: 'photo', status: 'uploaded', original_path: 'v/imports/i/schnitzel.jpg', provenance: { from: 'import', source: 'wolt_screenshots', rights: 'confirmed_at_upload' } },
  });
  assert.deepEqual([step(p, 'photo', 'd-burger').op, step(p, 'photo', 'd-burger').reason], ['skip', 'choice'], 'the default is the labelled illustration');
  assert.equal(setOf(step(p, 'dish', 'd-burger')).stock_id, 'burger');
  const confirmed = step(plan(d, EMPTY_MENU, yes({ 'photo_rights_unknown@d-burger': 'confirm_rights' })), 'photo', 'd-burger');
  assert.deepEqual([confirmed.op, (setOf(confirmed).provenance as any).rights], ['create', 'confirmed_at_apply']);
  const pending = applyPlan(EMPTY_MENU, p); // the schnitzel's picture waits for approval: dishes.asset_id is still null
  const again: any = copy(d);
  again.sections[0].dishes[0].photo = { path: 'v/imports/j/schnitzel.jpg', rights: 'confirmed' };
  const q = plan(again, pending);
  assert.deepEqual([step(q, 'photo', 'd-schnitzel').op, step(q, 'photo', 'd-schnitzel').id], ['keep', pending.assets[0]!.id]);
  const rejected = { ...pending, assets: pending.assets.map((a) => ({ ...a, status: 'rejected' as const })) };
  assert.equal(step(plan(again, rejected), 'photo', 'd-schnitzel').op, 'create', 'a rejected picture does not count');
});

test('limits count what the venue has; a new choice may not open an existing group that nests', () => {
  const full: ExistingMenu = {
    ...EMPTY_MENU,
    sections: Array.from({ length: LIMITS.sections }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, position: i, name_he: '', name_en: `Old ${i}`, kind: 'food' as const })),
  };
  assert.deepEqual(errorsOf(bistroDraft(), full), ['too_many@sections']);
  const m = once();
  const d: any = copy(bistroDraft());
  d.groups[0].options[0].opens = null;
  d.groups.push(group('g-combo', 'קומבו', 'Combo', { options: [opt('o-combo', 'ארוחה', 'Meal', 1500, { opens: 'g-side' })] }));
  d.sections[0].dishes[1].groups = [link('g-combo')];
  // round 10c: asked as `nesting_too_deep` on the option (rule 11's last check), the plan refused until it is answered
  const r = planApply(d, m, yes());
  assert.deepEqual(r.ok ? [] : r.errors, [{ code: 'exception_unresolved', path: 'o-combo', message: 'nesting_too_deep' }]);
  const unlinked = plan(d, m, yes({ 'nesting_too_deep@o-combo': 'unlink' }));
  assert.equal((step(unlinked, 'option', 'o-combo').set as { opens_group_id?: string | null }).opens_group_id, null);
  assert.equal(step(plan(d, m, yes({ 'nesting_too_deep@o-combo': 'skip' })), 'option', 'o-combo').reason, 'choice');
});

test('a dish limit on an existing group is kept only within the group\'s own limits', () => {
  const m = once();
  const d: any = copy(bistroDraft());
  d.sections[0].dishes.push(dish('d-fish', 'דג', 'Fish', 8800, { groups: [link('g-extras', 1, 2), link('g-side')] }));
  const p = plan(d, m);
  assert.deepEqual([setOf(step(p, 'dish_group', linkKey('d-fish', 'g-extras'))).min_units, setOf(step(p, 'dish_group', linkKey('d-fish', 'g-extras'))).max_units], [1, 2]);
  const loose: any = copy(d);
  loose.groups[2].max = 3;
  loose.sections[0].dishes[2].groups[0] = link('g-extras', null, 3);
  const extras = m.groups.find((g) => g.name_en === 'Extras')!;
  const tight = { ...m, groups: m.groups.map((g) => (g.id === extras.id ? { ...g, max_units: 2 } : g)) };
  assert.equal(setOf(step(plan(loose, tight), 'dish_group', linkKey('d-fish', 'g-extras'))).max_units, null, 'max 3 would loosen the venue\'s max 2');
});

test('the plan is deterministic and fast at LIMITS scale (L10)', () => {
  const groups = Array.from({ length: 100 }, (_, g) => group(`g${g}`, `קבוצה ${g}`, `Group ${g}`, {
    selection: 'multiple', min: 0, max: 3, options: Array.from({ length: 20 }, (_, o) => opt(`g${g}o${o}`, `אפשרות ${g} ${o}`, `Option ${g} ${o}`, 100)),
  }));
  const sections = Array.from({ length: 20 }, (_, s) => section(`s${s}`, `מדור ${s}`, `Section ${s}`,
    Array.from({ length: 20 }, (_, d) => dish(`s${s}d${d}`, `מנה ${s} ${d}`, `Dish ${s} ${d}`, 3000, { groups: [link(`g${(s * 20 + d) % 100}`), link(`g${(s * 20 + d + 1) % 100}`)] }))));
  const draft = draftOf(sections, groups);
  const m = applyPlan(EMPTY_MENU, plan(draft));
  const t0 = performance.now();
  const again = plan(draft, m);
  const ms = performance.now() - t0;
  assert.deepEqual(changes(again), []);
  assert.deepEqual(plan(draft, m), again);
  assert.ok(ms < 1500, `a re-import of 400 dishes, 100 groups and 2000 options took ${ms.toFixed(0)} ms (target: well under 150 ms)`);
});

// ---------------------------------------------------------------- the RPC inputs

test('validateDecisions: shape, node skips, no other keys', () => {
  assert.ok(validateDecisions(yes({ 'dish_duplicate@d-x': 'skip', [`too_many@${linkKey('d-x', 'g-y')}`]: 'skip', [`price_differs@${targetKey('o-x', '00000000-0000-4000-8000-0000000000c9')}`]: 'take_new' }, ['d-x', linkKey('d-x', 'g-y')])).ok);
  const bad = validateDecisions({ v: 1, pricesConfirmed: 'yes', choices: { nope: 'skip', 'price_missing@d': 'delete' }, skip: ['Bad Key'], note: 'x' });
  assert.deepEqual(bad.ok ? [] : bad.errors.map((e) => e.code).sort(), ['choice_invalid', 'choice_invalid', 'field_not_allowed', 'key_invalid', 'type']);
});

test('validateCreateImport: text for text sources; images in the import\'s own folder with a hash; rights only for Wolt screenshots', () => {
  const venue = '00000000-0000-4000-8000-0000000000c1';
  const imp = '00000000-0000-4000-8000-0000000000e7';
  const folder = `${venue}/imports/${imp}`;
  const sha = 'a'.repeat(64);
  const err = (o: object) => { const r = validateCreateImport(o); return r.ok ? [] : r.errors.map((e) => e.code).sort(); };
  assert.deepEqual(err({ venueId: venue, source: 'wolt_text', text: 'Mains\nSchnitzel 64', rightsConfirmed: false }), []);
  assert.deepEqual(err({ venueId: venue, source: 'wolt_screenshots', importId: imp, paths: [`${folder}/1.png`], inputSha256: sha, rightsConfirmed: true }), []);
  assert.deepEqual(err({ venueId: venue, source: 'paste', text: ' \n ', rightsConfirmed: false }), ['text_missing']);
  assert.deepEqual(err({ venueId: venue, source: 'paste', text: `Soup${String.fromCharCode(0)} 32`, rightsConfirmed: false }), ['text_invalid']);
  assert.deepEqual(err({ venueId: venue, source: 'paste', text: 'x'.repeat(60_001), rightsConfirmed: false }), ['text_too_long']);
  assert.deepEqual(err({ venueId: venue, source: 'paste', text: 'Soup 32', rightsConfirmed: false, guest: 'x' }), ['field_not_allowed']);
  assert.deepEqual(err({ venueId: venue, source: 'scan', importId: imp, text: 'x', paths: [`${folder}/a.jpg`], inputSha256: sha, rightsConfirmed: false }), ['input_mismatch']);
  assert.deepEqual(err({ venueId: venue, source: 'scan', importId: imp, paths: [`${venue}/imports/other/a.jpg`], inputSha256: sha, rightsConfirmed: false }), ['path_invalid']);
  assert.deepEqual(err({ venueId: venue, source: 'scan', paths: [`${folder}/a.jpg`], inputSha256: sha, rightsConfirmed: false }), ['id_invalid'], 'images need the import id');
  assert.deepEqual(err({ venueId: venue, source: 'scan', importId: imp, paths: [], inputSha256: 'ABC', rightsConfirmed: false }), ['paths_missing', 'sha_invalid']);
  assert.deepEqual(err({ venueId: venue, source: 'scan', importId: imp, paths: [`${folder}/a.jpg`], inputSha256: sha, rightsConfirmed: true }), ['rights_invalid']);
  assert.deepEqual(err({ venueId: 'x', source: 'wolt_page', text: 'x' }), ['enum_invalid', 'id_invalid']);
  // images per source (readers QA-M8): 8 photos of a printed menu, 24 screenshots
  const pages = (n: number) => Array.from({ length: n }, (_, i) => `${folder}/${i}.jpg`);
  assert.deepEqual(IMPORT_IMAGES_MAX, { scan: 8, wolt_screenshots: 24 });
  assert.deepEqual([8, 9].map((n) => err({ venueId: venue, source: 'scan', importId: imp, paths: pages(n), inputSha256: sha, rightsConfirmed: false })), [[], ['too_many']]);
  assert.deepEqual([24, 25].map((n) => err({ venueId: venue, source: 'wolt_screenshots', importId: imp, paths: pages(n), inputSha256: sha, rightsConfirmed: false })), [[], ['too_many']]);
});

test("validateSaveDraft and validateApplyImport prefix the draft's and the decisions' paths and refuse other keys", () => {
  const id = '00000000-0000-4000-8000-0000000000d9';
  assert.ok(validateSaveDraft({ importId: id, draft: bistroDraft() }).ok);
  const bad: any = copy(bistroDraft());
  bad.sections[0].key = 'X';
  const r = validateSaveDraft({ importId: 'nope', draft: bad, extra: 1 });
  assert.deepEqual(r.ok ? [] : r.errors.map((e) => `${e.code}@${e.path}`), ['field_not_allowed@extra', 'id_invalid@importId', 'key_invalid@draft.sections[0].key']);
  assert.ok(validateApplyImport({ importId: id, draft: bistroDraft(), decisions: yes() }).ok);
  const a = validateApplyImport({ importId: id, draft: bistroDraft(), decisions: { v: 1, pricesConfirmed: true } });
  assert.deepEqual(a.ok ? [] : a.errors.map((e) => `${e.code}@${e.path}`), ['type@decisions.choices']);
});
