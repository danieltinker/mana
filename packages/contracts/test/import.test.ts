import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  draftCounts, draftExceptions, draftGroupLimits, EMPTY_MENU, EXCEPTION_CHOICES, exceptionId, IMPORT_EXCEPTION_CODES, IMPORT_EXCEPTIONS, importKey,
  linkKey, nameScore, planApply, validateApplyImport, validateCreateImport, validateDecisions, validateDraft, validateSaveDraft,
  type ExistingMenu, type ImportChoice, type ImportDecisions, type ImportDraft, type PlanStep,
} from '../src/import.ts';
import { LIMITS } from '../src/enums.ts';
import { applyPlan, bistroDraft, copy, dish, group, link, opt, planProblems, section, tx } from './import-fixtures.ts';

const cp = String.fromCodePoint;
const yes = (choices: Record<string, ImportChoice> = {}): ImportDecisions => ({ v: 1, pricesConfirmed: true, choices });
const codes = (raw: unknown) => {
  const r = validateDraft(raw);
  return r.ok ? [] : r.errors.map((e) => e.code).sort();
};
const plan = (d: ImportDraft, m: ExistingMenu = EMPTY_MENU, dec: ImportDecisions = yes()) => {
  const r = planApply(d, m, dec);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  assert.deepEqual(planProblems(r.value), []);
  return r.value;
};
const stepOf = (steps: readonly PlanStep[], key: string) => steps.find((s) => s.key === key)!;
const opsOf = (steps: readonly PlanStep[]) => steps.map((s) => `${s.kind}:${s.key}:${s.op}`);

// ---------------------------------------------------------------- the key

test('importKey: accents, Hebrew points, case, punctuation, emoji and blanks do not make two names different', () => {
  assert.equal(importKey('Crème Brûlée!'), 'creme brulee');
  assert.equal(importKey('  SCHNITZEL  (Wiener) '), 'schnitzel wiener');
  // שַׁקְשׁוּקָה with its points, and plain
  const pointed = `ש${cp(0x5c1, 0x5b7)}קש${cp(0x5c1)}ו${cp(0x5bc)}ק${cp(0x5b8)}ה`;
  assert.equal(importKey(pointed), importKey('שקשוקה'));
  assert.equal(importKey('שקשוקה'), 'שקשוקה');
  assert.equal(importKey('צ׳יפס'), importKey("צ'יפס"), 'geresh and apostrophe are both separators');
  assert.equal(importKey(`Coffee ${cp(0x2615, 0xfe0f)}`), 'coffee');
  assert.equal(importKey(`Fish${cp(0xa0)}&${cp(0x200b)}chips`), 'fish chips');
  assert.equal(importKey(`${cp(0xff33, 0xff4f, 0xff55, 0xff50)}`), 'soup', 'full-width letters fold (NFKD)');
  assert.equal(importKey('Lemonade — ₪18'), 'lemonade 18');
  assert.equal(importKey('Coke 330ml'), 'coke 330ml');
  assert.notEqual(importKey('Coke 330ml'), importKey('Coke 0.5L'));
  assert.equal(importKey(`עיקריות${cp(0x5be)}בית`), 'עיקריות בית', 'maqaf separates');
  assert.equal(importKey(''), '');
  assert.equal(importKey('!!! — ☕'), '');
  // lowercasing is A–Z only, so the database's translate() agrees exactly
  assert.equal(importKey('БОРЩ'), 'БОРЩ');
});

test('nameScore: Hebrew counts 2, English 1, empty never matches', () => {
  assert.equal(nameScore(tx('שניצל', 'Schnitzel'), tx('שניצל', 'schnitzel!')), 3);
  assert.equal(nameScore(tx('שניצל', 'Wiener'), tx('שניצל', 'Schnitzel')), 2);
  assert.equal(nameScore(tx('', 'Schnitzel'), tx('שניצל', 'SCHNITZEL')), 1);
  assert.equal(nameScore(tx('', ''), tx('', '')), 0);
});

// ---------------------------------------------------------------- validation

test('the base draft is valid, and so is its counts', () => {
  assert.deepEqual(codes(bistroDraft()), []);
  assert.deepEqual(draftCounts(bistroDraft()), { sections: 2, dishes: 3, groups: 3, options: 6, photos: 0 });
});

test('validateDraft: what a broken reader produces is refused with a code', () => {
  const d = bistroDraft;
  const mut = (f: (x: any) => void) => { const x: any = copy(d()); f(x); return x; };
  assert.deepEqual(codes(null), ['type']);
  assert.deepEqual(codes(mut((x) => { x.v = 2; })), ['version']);
  assert.deepEqual(codes(mut((x) => { x.source = 'wolt_page'; })), ['enum_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].key = 'Bad Key'; })), ['key_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[1].dishes[0].key = 'd-burger'; })), ['key_duplicate']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].name = tx(cp(0x200b), ' '); })), ['name_missing']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].tags = ['halal']; })), ['enum_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].tags = ['vegan', 'vegan']; })), ['enum_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].price = -1; })), ['price_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].price = 64.5; })), ['price_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].priceText = 'x'.repeat(41); })), ['text_too_long']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].groups = [link('g-nope')]; })), ['ref_unknown']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[1].groups = [link('g-side'), link('g-side')]; })), ['addon_duplicate']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].groups = [link('g-side', 0, 1)]; })), ['limits_loosened'], 'a dish only tightens');
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
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].photo = { path: '/abs/x.jpg', rights: 'unknown' }; })), ['path_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].photo = { path: 'v/../x.jpg', rights: 'unknown' }; })), ['path_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].photo = { path: 'https://cdn.example/x.jpg', rights: 'unknown' }; })), ['path_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].photo = { path: 'v/x.jpg', rights: 'yes' }; })), ['enum_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].illustration = 'Bad Id'; })), ['stock_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].translated = ['en', 'en']; })), ['translated_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections[0].dishes[0].name = tx('שניצל', ''); x.sections[0].dishes[0].translated = ['en']; })), ['translated_invalid'],
    'a translated language has text');
  assert.deepEqual(codes(mut((x) => { x.sections[0].room = 'garden'; })), ['enum_invalid']);
  assert.deepEqual(codes(mut((x) => { x.sections = Array.from({ length: 81 }, (_, i) => section(`s${i}`, '', `S${i}`, [])); })), ['too_large']);
});

test('validateDraft keeps what the owner can fix: no price, two levels of nesting, past LIMITS', () => {
  const d = copy(bistroDraft()) as any;
  d.sections[0].dishes[0].price = null;
  d.groups.push(group('g-dip', 'מטבל', 'Dip', { options: [opt('o-dip', 'טחינה', 'Tahini', 0)] }));
  d.groups[1].options[0].opens = 'g-dip';
  d.sections.push(...Array.from({ length: LIMITS.sections }, (_, i) => section(`s-x${i}`, '', `Extra ${i}`, [])));
  assert.deepEqual(codes(d), []);
});

// ---------------------------------------------------------------- exceptions

test('draftExceptions: the base draft has one check, the guessed limits of the extras', () => {
  assert.deepEqual(draftExceptions(bistroDraft()), [{ code: 'limits_guessed', severity: 'check', key: 'g-extras', path: 'groups[2]' }]);
  assert.deepEqual(draftGroupLimits(bistroDraft().groups[2]!), { min: 0, max: 3, stated: false, capacity: 3 });
  assert.deepEqual(draftGroupLimits(group('g', '', 'G', { min: null, max: null, options: [opt('o', '', 'O', 0)] })), { min: 1, max: 1, stated: false, capacity: 1 },
    'a single choice with no limits stated is guessed required');
});

test('draftExceptions: every code, at its node, in node order and then IMPORT_EXCEPTIONS order', () => {
  const d = copy(bistroDraft()) as any;
  const mains = d.sections[0];
  mains.dishes[0].price = null; // price_missing
  mains.dishes[1].price = null;
  mains.dishes[1].priceText = '₪ 7O'; // price_unreadable
  mains.dishes.push(dish('d-schnitzel-2', 'שניצל', 'Schnitzel', 6600)); // dish_duplicate
  mains.dishes[0].allergens = tx('גלוטן, ביצים', ''); // allergens_check
  mains.dishes[0].name = tx('שניצל', 'Schnitzel'); // stays
  mains.dishes[0].translated = ['en']; // translation_check
  mains.dishes[0].photo = { path: 'v/imports/i/1.jpg', rights: 'unknown' }; // photo_rights_unknown
  d.sections.push(section('s-mains-2', 'עיקריות', '', [])); // section_duplicate + name_missing_lang (en)
  d.groups[2].min = 5; // limits_unreachable (capacity 3)
  d.groups.push(group('g-dip', 'מטבל', 'Dip', { options: [opt('o-dip', 'טחינה', 'Tahini', null, { priceText: '+?' })] })); // price_unreadable on an option
  d.groups[1].options[0].opens = 'g-dip'; // nesting_too_deep (sauce is opened by fries)
  const got = draftExceptions(d).map((e) => `${e.code}@${e.key}:${e.severity}`);
  assert.deepEqual(got, [
    'price_missing@d-schnitzel:fix', 'translation_check@d-schnitzel:check', 'photo_rights_unknown@d-schnitzel:check', 'allergens_check@d-schnitzel:check',
    'price_unreadable@d-burger:fix',
    'dish_duplicate@d-schnitzel-2:fix',
    'section_duplicate@s-mains-2:fix', 'name_missing_lang@s-mains-2:check',
    'nesting_too_deep@o-aioli:fix',
    'limits_unreachable@g-extras:fix',
    'option_price_unreadable@o-dip:fix',
  ]);
  // name_missing_lang follows the venue's languages
  assert.ok(!draftExceptions(d, { langs: ['he'] }).some((e) => e.code === 'name_missing_lang'));
  // every code has choices, and a check's default is its first
  for (const c of IMPORT_EXCEPTION_CODES) assert.ok(EXCEPTION_CHOICES[c].length > 0, c);
  assert.equal(Object.keys(IMPORT_EXCEPTIONS).length, IMPORT_EXCEPTION_CODES.length);
});

test('draftExceptions: past LIMITS in draft order (sections, dishes, groups per dish)', () => {
  const d = copy(bistroDraft()) as any;
  d.sections = Array.from({ length: LIMITS.sections + 1 }, (_, i) => section(`s${i}`, `ס${i}`, `S${i}`, [dish(`d${i}`, `מ${i}`, `D${i}`, 100)]));
  const extra = draftExceptions(d).filter((e) => e.code === 'too_many').map((e) => e.key);
  assert.deepEqual(extra, [`s${LIMITS.sections}`]);
  const e = copy(bistroDraft()) as any;
  e.groups = Array.from({ length: 9 }, (_, i) => group(`g${i}`, '', `G${i}`, { options: [opt(`o${i}`, '', `O${i}`, 0)] }));
  e.sections[0].dishes[0].groups = e.groups.map((g: any) => link(g.key));
  e.sections[0].dishes[1].groups = [];
  assert.deepEqual(draftExceptions(e).filter((x) => x.code === 'too_many').map((x) => x.key), [linkKey('d-schnitzel', 'g8')]);
});

// ---------------------------------------------------------------- the plan

test('the first import into an empty menu creates everything, in apply order, with positions from 0', () => {
  const p = plan(bistroDraft());
  assert.deepEqual(opsOf(p.steps), [
    'section:s-mains:create', 'section:s-drinks:create',
    'group:g-side:create', 'group:g-sauce:create', 'group:g-extras:create',
    'option:o-fries:create', 'option:o-salad:create', 'option:o-aioli:create', 'option:o-ketchup:create', 'option:o-cheese:create', 'option:o-egg:create',
    'dish:d-schnitzel:create', 'dish:d-burger:create', 'dish:d-lemonade:create',
    `dish_group:${linkKey('d-schnitzel', 'g-side')}:create`, `dish_group:${linkKey('d-burger', 'g-side')}:create`, `dish_group:${linkKey('d-burger', 'g-extras')}:create`,
  ]);
  assert.deepEqual(stepOf(p.steps, 's-drinks').set, { position: 1, name_he: 'שתייה', name_en: 'Drinks', kind: 'drinks', room: null });
  assert.deepEqual(stepOf(p.steps, 'g-extras').set,
    { label: 'Extras', name_he: 'תוספות', name_en: 'Extras', selection: 'multiple', min_units: 0, max_units: 3, limits_confirmed: false });
  assert.equal(stepOf(p.steps, 'g-side').set.limits_confirmed, true);
  assert.deepEqual(stepOf(p.steps, 'o-fries').refs, { group_id: 'g-side', opens_group_id: 'g-sauce' });
  assert.equal(stepOf(p.steps, 'o-salad').set.opens_group_id, null);
  assert.deepEqual(stepOf(p.steps, 'd-burger').set, {
    position: 1, name_he: 'המבורגר', name_en: 'Burger', desc_he: '', desc_en: '', price: 7200, price_note_he: '', price_note_en: '', tags: ['spicy'],
    allergens_he: '', allergens_en: '', stock_id: null,
  });
  assert.deepEqual(stepOf(p.steps, 'd-lemonade').refs, { section_id: 's-drinks' });
  assert.equal(stepOf(p.steps, 'd-lemonade').set.position, 0);
  assert.deepEqual(stepOf(p.steps, linkKey('d-burger', 'g-extras')).set, { position: 1, min_units: null, max_units: null });
  assert.deepEqual(p.summary.option, { create: 6, update: 0, keep: 0, skip: 0 });
});

test('Hopa test 1: importing the same menu again creates nothing and changes nothing', () => {
  const once = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  const again = plan(bistroDraft(), once);
  assert.ok(again.steps.every((s) => s.op === 'keep'), JSON.stringify(again.steps.filter((s) => s.op !== 'keep')));
  // the same menu, written differently (points, case, punctuation) and in another order, still matches
  const d = copy(bistroDraft()) as any;
  d.sections.reverse();
  d.sections[1].dishes[0].name = tx(`ש${cp(0x5b0)}ניצל`, 'SCHNITZEL!');
  d.groups[0].options.reverse();
  const third = plan(d, once);
  assert.deepEqual(third.steps.filter((s) => s.op !== 'keep').map((s) => s.key), []);
  assert.deepEqual(applyPlan(once, third), once);
});

test('a re-import updates prices and fills blanks, adds what is new, and never takes anything away', () => {
  const heOnly = copy(bistroDraft()) as any;
  heOnly.sections[0].dishes[0].name = tx('שניצל', '');
  heOnly.sections[0].dishes[1].tags = [];
  const once = applyPlan(EMPTY_MENU, plan(heOnly));
  const d = copy(bistroDraft()) as any;
  d.sections[0].dishes[1].price = 7600; // a new price
  d.sections[0].dishes[1].tags = ['vegan', 'spicy'];
  d.sections[0].dishes[0].desc = tx('', 'Crumbed, with lemon');
  d.sections[0].dishes.push(dish('d-fish', 'דג', 'Fish', 8800));
  d.sections.splice(1, 1); // the drinks are not in this source at all
  d.groups[2].options[0].price = 350;
  const p = plan(d, once);
  const schnitzel = once.dishes.find((x) => x.name_he === 'שניצל')!;
  const burger = once.dishes.find((x) => x.name_he === 'המבורגר')!;
  assert.deepEqual(stepOf(p.steps, 'd-schnitzel'), { kind: 'dish', key: 'd-schnitzel', op: 'update', id: schnitzel.id, set: { name_en: 'Schnitzel', desc_en: 'Crumbed, with lemon' }, refs: {}, reason: null });
  assert.deepEqual(stepOf(p.steps, 'd-burger').set, { price: 7600, tags: ['vegan', 'spicy'] });
  assert.deepEqual(stepOf(p.steps, 'o-cheese').set, { price: 350 });
  const fish = stepOf(p.steps, 'd-fish');
  assert.equal(fish.op, 'create');
  assert.equal(fish.set.section_id, burger.section_id);
  assert.equal(fish.set.position, 2, 'after the existing dishes of that section');
  const lemonade = once.dishes.find((x) => x.name_en === 'Lemonade')!;
  assert.ok(!p.steps.some((s) => s.id === lemonade.id), 'what the source no longer has is left alone');
  const after = applyPlan(once, p);
  assert.equal(after.dishes.length, 4);
  assert.equal(after.dishes.find((x) => x.id === lemonade.id)!.price, 1800);
  // an owner's own words are never replaced: a different English name keeps the owner's
  const e = copy(bistroDraft()) as any;
  e.sections[0].dishes[0].name = tx('שניצל', 'Wiener schnitzel');
  assert.equal(stepOf(plan(e, after).steps, 'd-schnitzel').op, 'keep');
});

test('matching: a dish stays in its section; same-section first; each existing row matches once', () => {
  const once = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  // the owner moved the lemonade into Mains; the source still lists it under Drinks
  const lemonade = once.dishes.find((x) => x.name_en === 'Lemonade')!;
  const mains = once.sections.find((s) => s.name_en === 'Mains')!;
  const moved = { ...once, dishes: once.dishes.map((x) => (x.id === lemonade.id ? { ...x, section_id: mains.id } : x)) };
  assert.equal(stepOf(plan(bistroDraft(), moved).steps, 'd-lemonade').op, 'keep');
  // two salads: the one in the draft's section wins
  const kids = { id: '00000000-0000-4000-8000-0000000000b1', position: 5, name_he: 'ילדים', name_en: 'Kids' };
  const twoSalads: ExistingMenu = {
    ...once, sections: [...once.sections, kids],
    dishes: [...once.dishes,
      { ...once.dishes[0]!, id: '00000000-0000-4000-8000-0000000000e1', section_id: mains.id, position: 9, name_he: 'סלט', name_en: 'Salad' },
      { ...once.dishes[0]!, id: '00000000-0000-4000-8000-0000000000e2', section_id: kids.id, position: 0, name_he: 'סלט', name_en: 'Salad' }],
  };
  const d = copy(bistroDraft()) as any;
  d.sections.push(section('s-kids', 'ילדים', 'Kids', [dish('d-kids-salad', 'סלט', 'Salad', 2400)]));
  assert.equal(stepOf(plan(d, twoSalads).steps, 'd-kids-salad').id, '00000000-0000-4000-8000-0000000000e2');
});

test('groups: matched by name, selection and options; several draft groups may share one; else created', () => {
  const once = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  const side = once.groups.find((g) => g.name_en === 'Side of choice')!;
  // the owner added rice to the side since: the source's side (fries, salad) is still that group
  const withRice: ExistingMenu = {
    ...once, options: [...once.options, { id: '00000000-0000-4000-8000-0000000000f1', group_id: side.id, position: 2, name_he: 'אורז', name_en: 'Rice', price: 0, opens_group_id: null }],
  };
  assert.equal(stepOf(plan(bistroDraft(), withRice).steps, 'g-side').op, 'keep');
  // a side with an option the group does not have is another group
  const d = copy(bistroDraft()) as any;
  d.groups[0].options.push(opt('o-mash', 'פירה', 'Mash', 0));
  const p = plan(d, once);
  assert.equal(stepOf(p.steps, 'g-side').op, 'create');
  assert.equal(stepOf(p.steps, linkKey('d-schnitzel', 'g-side')).op, 'create', 'linked to the new group');
  // the same name with another selection is another group
  const e = copy(bistroDraft()) as any;
  e.groups[1].selection = 'multiple';
  e.groups[1].min = 0;
  e.groups[1].max = 2;
  assert.equal(stepOf(plan(e, once).steps, 'g-sauce').op, 'create');
  // two identical draft groups both match the one existing group
  const f = copy(bistroDraft()) as any;
  f.groups.push({ ...copy(f.groups[0]), key: 'g-side-2', options: f.groups[0].options.map((o: any) => ({ ...o, key: `${o.key}-2` })) });
  f.sections[0].dishes[1].groups = [link('g-side-2'), link('g-extras')];
  const q = plan(f, once);
  assert.deepEqual([stepOf(q.steps, 'g-side').id, stepOf(q.steps, 'g-side-2').id], [side.id, side.id]);
});

test('answers: fixes must be answered; skip, no_price, free, clamp, unlink, merge, keep_both', () => {
  const d = copy(bistroDraft()) as any;
  d.sections[0].dishes[0].price = null;
  const unanswered = planApply(d, EMPTY_MENU, yes());
  assert.deepEqual(!unanswered.ok && unanswered.errors, [{ code: 'exception_unresolved', path: 'd-schnitzel', message: 'price_missing' }]);
  const wrong = planApply(d, EMPTY_MENU, yes({ 'price_missing@d-schnitzel': 'merge' }));
  assert.deepEqual(!wrong.ok && wrong.errors.map((e) => e.code), ['choice_invalid']);
  assert.equal(stepOf(plan(d, EMPTY_MENU, yes({ 'price_missing@d-schnitzel': 'no_price' })).steps, 'd-schnitzel').set.price, null);
  const skipped = plan(d, EMPTY_MENU, yes({ 'price_missing@d-schnitzel': 'skip' }));
  assert.deepEqual([stepOf(skipped.steps, 'd-schnitzel').reason, stepOf(skipped.steps, linkKey('d-schnitzel', 'g-side')).reason], ['choice', 'parent_skipped']);
  assert.equal(stepOf(skipped.steps, 'd-burger').set.position, 0, 'positions close up');

  const o = copy(bistroDraft()) as any;
  o.groups[2].options[1].price = null;
  o.groups[2].options[1].priceText = '+?';
  assert.equal(stepOf(plan(o, EMPTY_MENU, yes({ 'option_price_unreadable@o-egg': 'free' })).steps, 'o-egg').set.price, 0);
  // an unreadable price never replaces the one the venue has
  const withEgg = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  assert.equal(stepOf(plan(o, withEgg, yes({ 'option_price_unreadable@o-egg': 'free' })).steps, 'o-egg').op, 'keep');
  const noPrice = copy(bistroDraft()) as any;
  noPrice.sections[0].dishes[1].price = null;
  assert.equal(stepOf(plan(noPrice, withEgg, yes({ 'price_missing@d-burger': 'no_price' })).steps, 'd-burger').op, 'keep');

  const c = copy(bistroDraft()) as any;
  c.groups[2].min = 5;
  assert.equal(stepOf(plan(c, EMPTY_MENU, yes({ 'limits_unreachable@g-extras': 'clamp' })).steps, 'g-extras').set.min_units, 3);
  const noExtras = plan(c, EMPTY_MENU, yes({ 'limits_unreachable@g-extras': 'skip' }));
  assert.deepEqual([stepOf(noExtras.steps, 'g-extras').op, stepOf(noExtras.steps, 'o-cheese').reason, stepOf(noExtras.steps, linkKey('d-burger', 'g-extras')).reason],
    ['skip', 'parent_skipped', 'parent_skipped']);

  const n = copy(bistroDraft()) as any;
  n.groups.push(group('g-dip', 'מטבל', 'Dip', { options: [opt('o-tahini', 'טחינה', 'Tahini', 0)] }));
  n.groups[1].options[0].opens = 'g-dip';
  const unlinked = plan(n, EMPTY_MENU, yes({ 'nesting_too_deep@o-aioli': 'unlink' }));
  assert.equal(stepOf(unlinked.steps, 'o-aioli').set.opens_group_id, null);
  assert.deepEqual(stepOf(unlinked.steps, 'o-aioli').refs, { group_id: 'g-sauce' });

  const m = copy(bistroDraft()) as any;
  m.sections.push(section('s-mains-2', 'עיקריות', 'Mains', [dish('d-fish', 'דג', 'Fish', 8800)]));
  const merged = plan(m, EMPTY_MENU, yes({ 'section_duplicate@s-mains-2': 'merge' }));
  assert.deepEqual([stepOf(merged.steps, 's-mains-2').reason, stepOf(merged.steps, 'd-fish').refs, stepOf(merged.steps, 'd-fish').set.position],
    ['merged', { section_id: 's-mains' }, 2]);
  const both = plan(m, EMPTY_MENU, yes({ 'section_duplicate@s-mains-2': 'keep_both' }));
  assert.deepEqual([stepOf(both.steps, 's-mains-2').op, stepOf(both.steps, 's-mains-2').set.position], ['create', 2]);

  const dd = copy(bistroDraft()) as any;
  dd.sections[0].dishes.push(dish('d-schnitzel-2', 'שניצל', 'Schnitzel', 6600));
  assert.equal(stepOf(plan(dd, EMPTY_MENU, yes({ 'dish_duplicate@d-schnitzel-2': 'skip' })).steps, 'd-schnitzel-2').op, 'skip');
  const once = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  const kept = plan(dd, once, yes({ 'dish_duplicate@d-schnitzel-2': 'keep_both' }));
  assert.deepEqual([stepOf(kept.steps, 'd-schnitzel').op, stepOf(kept.steps, 'd-schnitzel-2').op], ['keep', 'create'], 'the second one is new');
});

test('prices must be confirmed when the draft carries any', () => {
  const r = planApply(bistroDraft(), EMPTY_MENU, { v: 1, pricesConfirmed: false, choices: {} });
  assert.deepEqual(!r.ok && r.errors.map((e) => e.code), ['prices_unconfirmed']);
  const free = copy(bistroDraft()) as any;
  free.sections = [section('s', 'סלטים', 'Salads', [dish('d', 'סלט', 'Salad', null)])];
  free.groups = [];
  assert.ok(planApply(free, EMPTY_MENU, { v: 1, pricesConfirmed: false, choices: { 'price_missing@d': 'no_price' } }).ok);
});

test('photos enter only with rights (D33): confirmed at upload, or by the owner; never over an existing photo', () => {
  const d = copy(bistroDraft()) as any;
  d.source = 'wolt_screenshots';
  d.sections[0].dishes[0].photo = { path: 'v/imports/i/schnitzel.jpg', rights: 'confirmed' };
  d.sections[0].dishes[1].photo = { path: 'v/imports/i/burger.jpg', rights: 'unknown' };
  d.sections[0].dishes[1].illustration = 'burger';
  const p = plan(d);
  assert.deepEqual(stepOf(p.steps.filter((s) => s.kind === 'photo'), 'd-schnitzel'), {
    kind: 'photo', key: 'd-schnitzel', op: 'create', id: null, refs: { dish_id: 'd-schnitzel' }, reason: null,
    set: { kind: 'photo', status: 'uploaded', original_path: 'v/imports/i/schnitzel.jpg', provenance: { from: 'import', source: 'wolt_screenshots', rights: 'confirmed_at_upload' } },
  });
  const burgerPhoto = p.steps.find((s) => s.kind === 'photo' && s.key === 'd-burger')!;
  assert.deepEqual([burgerPhoto.op, burgerPhoto.reason], ['skip', 'choice'], 'the default is the labelled illustration');
  assert.equal(stepOf(p.steps, 'd-burger').set.stock_id, 'burger');
  const confirmed = plan(d, EMPTY_MENU, yes({ 'photo_rights_unknown@d-burger': 'confirm_rights' }));
  const cb = confirmed.steps.find((s) => s.kind === 'photo' && s.key === 'd-burger')!;
  assert.deepEqual([cb.op, (cb.set.provenance as any).rights], ['create', 'confirmed_at_apply']);
  const once = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  const withAsset = { ...once, dishes: once.dishes.map((x) => (x.name_en === 'Schnitzel' ? { ...x, asset_id: '00000000-0000-4000-8000-0000000000a5' } : x)) };
  const again = plan(d, withAsset).steps.find((s) => s.kind === 'photo' && s.key === 'd-schnitzel')!;
  assert.deepEqual([again.op, again.id], ['keep', '00000000-0000-4000-8000-0000000000a5']);
});

test('limits count what the venue has; a new choice may not open an existing group that nests', () => {
  const full: ExistingMenu = {
    ...EMPTY_MENU,
    sections: Array.from({ length: LIMITS.sections }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, position: i, name_he: '', name_en: `Old ${i}` })),
  };
  const r = planApply(bistroDraft(), full, yes());
  assert.deepEqual(!r.ok && r.errors, [{ code: 'too_many', path: 'sections' }]);

  const once = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  const d = copy(bistroDraft()) as any;
  // this source does not show the sauce, so the draft nests nothing; but the venue's "Side of choice" opens the sauce,
  // and a new group whose choice opens that side would make two levels
  d.groups[0].options[0].opens = null;
  d.groups.push(group('g-combo', 'קומבו', 'Combo', { options: [opt('o-combo', 'ארוחה', 'Meal', 1500, { opens: 'g-side' })] }));
  d.sections[0].dishes[1].groups = [link('g-combo')];
  const r2 = planApply(d, once, yes());
  assert.deepEqual(!r2.ok && r2.errors.map((e) => `${e.code}@${e.path}`), ['nesting_too_deep@o-combo']);
});

test('a section with nothing new is left out; its dishes stay where the venue has them', () => {
  const once = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  const d = copy(bistroDraft()) as any;
  d.sections[1] = section('s-cold', 'קרים', 'Cold drinks', [dish('d-lemonade', 'לימונדה', 'Lemonade', 1800)], { kind: 'drinks' });
  const p = plan(d, once);
  assert.deepEqual([stepOf(p.steps, 's-cold').op, stepOf(p.steps, 's-cold').reason, stepOf(p.steps, 'd-lemonade').op], ['skip', 'empty', 'keep']);
});

test('the plan is deterministic: the same inputs, the same steps', () => {
  const once = applyPlan(EMPTY_MENU, plan(bistroDraft()));
  assert.deepEqual(plan(bistroDraft(), once), plan(bistroDraft(), once));
  assert.deepEqual(exceptionId({ code: 'price_missing', key: 'd-1' }), 'price_missing@d-1');
});

// ---------------------------------------------------------------- the RPC inputs

test('validateDecisions', () => {
  assert.ok(validateDecisions(yes({ 'dish_duplicate@d-x': 'skip', [`too_many@${linkKey('d-x', 'g-y')}`]: 'skip' })).ok);
  const bad = validateDecisions({ v: 1, pricesConfirmed: 'yes', choices: { 'nope': 'skip', 'price_missing@d': 'delete' } });
  assert.deepEqual(!bad.ok && bad.errors.map((e) => e.code).sort(), ['choice_invalid', 'choice_invalid', 'type']);
});

test('validateCreateImport: text for text sources, private paths and a hash for images, rights only for Wolt screenshots', () => {
  const venue = '00000000-0000-4000-8000-0000000000c1';
  const sha = 'a'.repeat(64);
  const ok = (o: object) => validateCreateImport(o).ok;
  const err = (o: object) => { const r = validateCreateImport(o); return r.ok ? [] : r.errors.map((e) => e.code).sort(); };
  assert.ok(ok({ venueId: venue, source: 'wolt_text', text: 'Mains\nSchnitzel 64', paths: null, inputSha256: null, rightsConfirmed: false }));
  assert.ok(ok({ venueId: venue, source: 'wolt_screenshots', text: null, paths: [`${venue}/imports/1.png`], inputSha256: sha, rightsConfirmed: true }));
  assert.ok(ok({ venueId: venue, source: 'paste', text: 'Soup 32', rightsConfirmed: false }), 'a field left out is null');
  assert.deepEqual(err({ venueId: venue, source: 'paste', text: ' \n ', paths: null, inputSha256: null, rightsConfirmed: false }), ['text_missing']);
  assert.deepEqual(err({ venueId: venue, source: 'paste', text: 'x'.repeat(60_001), paths: null, inputSha256: null, rightsConfirmed: false }), ['text_too_long']);
  assert.deepEqual(err({ venueId: venue, source: 'scan', text: 'x', paths: [`${venue}/a.jpg`], inputSha256: sha, rightsConfirmed: false }), ['input_mismatch']);
  assert.deepEqual(err({ venueId: venue, source: 'scan', text: null, paths: ['00000000-0000-4000-8000-0000000000c2/a.jpg'], inputSha256: sha, rightsConfirmed: false }),
    ['path_invalid'], "another venue's folder");
  assert.deepEqual(err({ venueId: venue, source: 'scan', text: null, paths: [], inputSha256: 'ABC', rightsConfirmed: false }), ['paths_missing', 'sha_invalid']);
  assert.deepEqual(err({ venueId: venue, source: 'scan', text: null, paths: [`${venue}/a.jpg`], inputSha256: sha, rightsConfirmed: true }), ['rights_invalid']);
  assert.deepEqual(err({ venueId: 'x', source: 'wolt_page', text: 'x' }), ['enum_invalid', 'id_invalid']);
});

test('validateSaveDraft and validateApplyImport prefix the draft\'s and the decisions\' paths', () => {
  const id = '00000000-0000-4000-8000-0000000000d9';
  assert.ok(validateSaveDraft({ importId: id, draft: bistroDraft() }).ok);
  const bad = copy(bistroDraft()) as any;
  bad.sections[0].key = 'X';
  const r = validateSaveDraft({ importId: 'nope', draft: bad });
  assert.deepEqual(!r.ok && r.errors.map((e) => `${e.code}@${e.path}`), ['id_invalid@importId', 'key_invalid@draft.sections[0].key']);
  assert.ok(validateApplyImport({ importId: id, draft: bistroDraft(), decisions: yes() }).ok);
  const a = validateApplyImport({ importId: id, draft: bistroDraft(), decisions: { v: 1, pricesConfirmed: true } });
  assert.deepEqual(!a.ok && a.errors.map((e) => `${e.code}@${e.path}`), ['type@decisions.choices']);
});
