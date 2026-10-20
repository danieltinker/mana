// The owner app v2's setup flow (F03), through its public functions: which step a place opens on and comes back to on
// any device, what holds each step back, how each step ends (never an automatic step marked done by hand), the import
// preview (what was read, the exceptions fixed or decided in place, the plan, what still stops applying), re-importing
// the same menu changing nothing (Hopa test 1), the import calls' validators before the network, and the demo mark on
// QR codes outside production (B5). Invented data only: the café of e2e/fixtures/wolt-text-cafe.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  BLOCKER_RE, EMPTY_MENU, EXCEPTION_CHOICES, IMPORT_TEXT_MAX, ONBOARDING_AUTO_STEPS, ONBOARDING_STEPS, onboardingProgress, READER_NOTE_CODES, SKIP_REASONS,
  validateSetStep,
} from '@mana/contracts';
import { applyPlan, dish, draftOf, group, link, opt, section } from '../../../../packages/contracts/test/import-fixtures.ts';
import { parsePaste, parseWoltText } from '@mana/import';
import { DEMO_MARK, marksDemo, withDemoBand } from '../../src/v2/data/demo-mark.ts';
import { answersKey, forgetAnswersBut, readAnswers, writeAnswers } from '../../src/v2/data/answers.ts';
import { blockersOf, endWrite, nextOpenAfter, openStep, resumeStep, stepEnd, visitWrite } from '../../src/v2/data/flow.ts';
import { imagePath, imagesHash, importsApi, isEmptyDraft, readText, storableNotes } from '../../src/v2/data/imports.ts';
import {
  aboutOf, carriesPrices, changesNothing, choose, confirmPrices, gate, NO_DECISIONS, noteLines, planLines, preview, priceDiffs, sameDraft, withDishPrice,
} from '../../src/v2/data/review.ts';
import { WOLT_TEXT, WOLT_TEXT_REORDERED } from '../../../../e2e/fixtures/wolt-text-cafe.mjs';

const VENUE = '00000000-0000-4000-8000-0000000000c1';
const LANGS = ['he', 'en'];
const NOTHING = { dishes: 0, groupsUnconfirmed: 0, importsWaiting: 0, importsReading: 0, importsApplied: 0, hours: 0, publishIssues: 0 };
const progressOf = (states) => onboardingProgress(Object.entries(states).map(([step, state]) => ({ step, state, blockers: [], updatedAt: null })));
/** A place just made by create_venue: its first step is the database's own, done. */
const fresh = () => progressOf({ venue: 'done' });

// ---------------------------------------------------------------- the flow
test('a new place opens on bringing the menu; a waiting import opens on its check; all set when every step is finished', () => {
  assert.equal(resumeStep(fresh()), 'menu');
  assert.equal(openStep(fresh(), { importsWaiting: 0 }), 'menu');
  assert.equal(openStep(fresh(), { importsWaiting: 1 }), 'review', 'the menu step is done by applying the import: its check comes first');
  const all = progressOf(Object.fromEntries(ONBOARDING_STEPS.map((s) => [s, s === 'photos' || s === 'style' ? 'skipped' : 'done'])));
  assert.equal(resumeStep(all), null);
  assert.equal(openStep(all, { importsWaiting: 0 }), 'done');
});

test('leaving and coming back on another device: the same step, read from the stored rows alone', () => {
  // the owner finished the menu (an applied import) and the add-ons, and left on the photos step
  const stored = [
    { step: 'venue', state: 'done' }, { step: 'menu', state: 'done' }, { step: 'review', state: 'done' }, { step: 'addons', state: 'done' },
    { step: 'photos', state: 'doing' },
  ];
  const other = onboardingProgress(stored.map((r) => ({ ...r, blockers: [], updatedAt: '2026-10-20T08:00:00.000Z' })));
  assert.equal(openStep(other, NOTHING), 'photos');
  assert.equal(other.done, 4);
});

test('after a step: the next step still open, then one left open earlier, then all set', () => {
  const p = progressOf({ venue: 'done', menu: 'done', review: 'done', addons: 'skipped', photos: 'skipped', hours: 'done' });
  assert.equal(nextOpenAfter(p, 'hours'), 'style');
  const late = progressOf({ venue: 'done', menu: 'done', review: 'done', addons: 'doing', photos: 'skipped', hours: 'done', style: 'skipped', test: 'done', publish: 'done' });
  assert.equal(nextOpenAfter(late, 'publish'), 'addons', 'the step left open comes back');
  const done = progressOf(Object.fromEntries(ONBOARDING_STEPS.map((s) => [s, 'done'])));
  assert.equal(nextOpenAfter(done, 'publish'), null);
});

test('what holds a step back: machine words the database takes as blockers', () => {
  assert.deepEqual(blockersOf('menu', NOTHING), ['menu_empty']);
  assert.deepEqual(blockersOf('menu', { ...NOTHING, importsWaiting: 1 }), ['import_waiting']);
  assert.deepEqual(blockersOf('menu', { ...NOTHING, importsReading: 1 }), ['import_reading']);
  assert.deepEqual(blockersOf('menu', { ...NOTHING, dishes: 3 }), []);
  assert.deepEqual(blockersOf('review', { ...NOTHING, importsWaiting: 2 }), ['import_waiting']);
  assert.deepEqual(blockersOf('addons', { ...NOTHING, groupsUnconfirmed: 2 }), ['group_without_limits']);
  assert.deepEqual(blockersOf('publish', { ...NOTHING, dishes: 4, publishIssues: 1 }), ['publish_issues']);
  assert.deepEqual(blockersOf('publish', NOTHING), ['menu_empty']);
  for (const step of ONBOARDING_STEPS) for (const f of [NOTHING, { ...NOTHING, importsWaiting: 1, groupsUnconfirmed: 1, publishIssues: 1 }]) {
    for (const b of blockersOf(step, f)) assert.match(b, BLOCKER_RE);
  }
});

test('how each step ends: the database\'s own steps wait for it; a menu built by hand skips its review; photos and style only wait for later', () => {
  const byHand = { ...NOTHING, dishes: 5 };
  assert.deepEqual(stepEnd('review', byHand), { end: 'review_skip', later: false });
  assert.deepEqual(stepEnd('review', { ...byHand, importsApplied: 1 }), { end: 'wait', later: false }, 'an applied import marks it done itself');
  assert.deepEqual(stepEnd('review', { ...byHand, importsWaiting: 1 }), { end: 'wait', later: false }, 'an import waits for its check');
  assert.deepEqual(stepEnd('addons', { ...NOTHING, groupsUnconfirmed: 1 }), { end: 'wait', later: true });
  assert.deepEqual(stepEnd('addons', NOTHING), { end: 'done', later: false });
  for (const s of ['venue', 'menu', 'publish']) assert.equal(stepEnd(s, byHand).end, 'wait');
  for (const s of ['photos', 'style']) assert.equal(stepEnd(s, byHand).end, 'skip', 'no screen of this app does them yet: never "done"');
  for (const s of ['hours', 'test']) assert.deepEqual(stepEnd(s, NOTHING), { end: 'done', later: true });
});

test('every write the flow makes is one set_onboarding_step takes: never an automatic step done by hand', () => {
  for (const step of ONBOARDING_STEPS) {
    for (const how of ['done', 'skip', 'review_skip']) {
      const w = endWrite(step, how);
      if (!w) continue;
      assert.ok(!(ONBOARDING_AUTO_STEPS.includes(step) && w.state === 'done'), `${step} ${how}`);
      assert.equal(validateSetStep({ venueId: VENUE, step: w.step, state: w.state, blockers: [] }).ok, true, `${step} ${how}`);
    }
    for (const state of ['todo', 'doing', 'done', 'skipped']) {
      const v = visitWrite(step, state, NOTHING);
      if (state !== 'todo' || step === 'venue') { assert.equal(v, null, `${step} ${state}`); continue; }
      assert.equal(v.state, 'doing');
      assert.equal(validateSetStep({ venueId: VENUE, step, state: v.state, blockers: v.blockers }).ok, true, step);
    }
  }
  // blockers only on the owner's own steps: the database finishes its own without clearing them
  assert.deepEqual(visitWrite('menu', 'todo', NOTHING), { state: 'doing', blockers: [] });
  assert.deepEqual(visitWrite('addons', 'todo', { ...NOTHING, groupsUnconfirmed: 1 }), { state: 'doing', blockers: ['group_without_limits'] });
  assert.deepEqual(endWrite('review', 'review_skip'), { step: 'review', state: 'skipped' });
  assert.equal(endWrite('menu', 'review_skip'), null);
  assert.equal(endWrite('publish', 'done'), null);
});

// ---------------------------------------------------------------- reading the menu
test('readText: refused before reading as create_import would refuse it; the Wolt reader reads the owner\'s own text', () => {
  assert.throws(() => readText('paste', '   \n '), (e) => e.code === 'text_missing');
  assert.throws(() => readText('wolt_text', 'x'.repeat(IMPORT_TEXT_MAX + 1)), (e) => e.code === 'text_too_long');
  const r = readText('wolt_text', WOLT_TEXT);
  assert.equal(r.draft.source, 'wolt_text');
  assert.equal(isEmptyDraft(r.draft), false);
  assert.equal(isEmptyDraft({ ...r.draft, sections: r.draft.sections.map((s) => ({ ...s, dishes: [] })) }), true, 'headings and no dish: nothing to review');
  // notes the contracts do not know stay on the phone; the rest are stored with the draft
  const known = r.notes.filter((n) => n.code === 'noise');
  assert.deepEqual(storableNotes([...known, { code: 'not_a_code', severity: 'info', key: null, lines: [], count: 1, rule: null }]), known);
});

const cafe = () => parseWoltText(WOLT_TEXT).draft;
const dishNamed = (draft, en) => draft.sections.flatMap((s) => s.dishes).find((d) => d.name.en === en);

test('the preview of the café: what was read, one thing to fix (a price that could not be read), the checks with their defaults', () => {
  const draft = cafe();
  const pv = preview(draft, EMPTY_MENU, NO_DECISIONS, LANGS);
  const codes = pv.rows.map((r) => `${r.e.code}:${r.e.severity}:${r.open ? 'open' : r.effective}`);
  assert.deepEqual(codes, [
    'name_missing_lang:check:accept', 'dish_repeated:check:skip', 'allergens_check:check:accept', 'price_unreadable:fix:open',
    'limits_guessed:check:accept', 'limits_guessed:check:accept',
  ]);
  const unread = pv.rows.find((r) => r.e.code === 'price_unreadable');
  assert.equal(unread.edit, 'dish_price', 'fixed in place by typing the price');
  assert.deepEqual(unread.about.name, { he: '', en: 'Seasonal cake' });
  assert.deepEqual(unread.about.within, { he: '', en: 'Cakes' });
  assert.deepEqual(unread.choices, ['no_price', 'skip']);
  // the plan shows while the fix is open (it takes its first answer there), and applying waits
  assert.ok(pv.plan, 'a provisional plan');
  const g = gate(draft, EMPTY_MENU, NO_DECISIONS, LANGS);
  assert.equal(g.ok, false);
  assert.deepEqual([g.open, g.prices], [1, true]);
  assert.equal(carriesPrices(draft), true);
});

test('fixing in place: a typed price removes its exception; the prices confirmed, the plan is what applying will do', () => {
  let draft = cafe();
  const cake = dishNamed(draft, 'Seasonal cake');
  draft = withDishPrice(draft, cake.key, 2800);
  assert.equal(dishNamed(draft, 'Seasonal cake').price, 2800);
  assert.equal(dishNamed(draft, 'Seasonal cake').priceText, null);
  assert.equal(preview(draft, EMPTY_MENU, NO_DECISIONS, LANGS).rows.some((r) => r.e.code === 'price_unreadable'), false);
  assert.equal(withDishPrice(draft, cake.key, -1), draft, 'a price the schema refuses changes nothing');
  let g = gate(draft, EMPTY_MENU, NO_DECISIONS, LANGS);
  assert.deepEqual([g.ok, g.open, g.prices], [false, 0, true], 'only the prices wait for the owner');
  g = gate(draft, EMPTY_MENU, confirmPrices(NO_DECISIONS, true), LANGS);
  assert.equal(g.ok, true);
  // the café's menu lands: four sections read, "Most ordered" left out with its repeated espresso, every dish of the rest
  const s = g.plan.summary;
  assert.deepEqual([s.section.create, s.dish.create, s.group.create, s.option.create], [3, 6, 3, 7]);
  assert.equal(s.dish.skip, 1, 'the repeated espresso');
  assert.deepEqual(planLines(g.plan).filter((x) => x.op === 'create').map((x) => `${x.kind}:${x.n}`), ['section:3', 'dish:6', 'group:3', 'option:7']);
  // the groups whose limits were guessed are created unconfirmed: the add-ons step asks for them
  const groups = g.plan.steps.filter((x) => x.kind === 'group' && x.op === 'create');
  assert.deepEqual(groups.map((x) => x.set.limits_confirmed).sort(), [false, false, true]);
});

test('answering instead of typing: "no price for now" and "leave it out" are the owner\'s; an answer outside the list is not taken', () => {
  const draft = cafe();
  const id = `price_unreadable@${dishNamed(draft, 'Seasonal cake').key}`;
  for (const c of ['no_price', 'skip']) {
    const d = confirmPrices(choose(NO_DECISIONS, id, c), true);
    assert.equal(gate(draft, EMPTY_MENU, d, LANGS).ok, true, c);
    assert.equal(preview(draft, EMPTY_MENU, d, LANGS).rows.find((r) => r.id === id).effective, c);
  }
  const wrong = confirmPrices(choose(NO_DECISIONS, id, 'free'), true);
  assert.equal(preview(draft, EMPTY_MENU, wrong, LANGS).rows.find((r) => r.id === id).choice, null, 'shown as unanswered');
  assert.equal(gate(draft, EMPTY_MENU, wrong, LANGS).ok, false);
  assert.equal(choose(choose(NO_DECISIONS, id, 'skip'), id, null).choices[id], undefined, 'an answer taken back');
});

/** The venue's menu after a plan ran, as apply_import would leave it (ids made here; refs resolved as rows are created). */
function applied(existing, plan) {
  const m = { sections: [...existing.sections], dishes: [...existing.dishes], groups: [...existing.groups], options: [...existing.options], dishGroups: [...existing.dishGroups], assets: [...existing.assets] };
  const ids = new Map();
  let n = m.sections.length + m.dishes.length + m.groups.length + m.options.length + m.dishGroups.length;
  const kindOf = { section_id: 'section', dish_id: 'dish', group_id: 'group', opens_group_id: 'group' };
  for (const s of plan.steps) {
    if (s.op === 'skip') continue;
    if (s.op !== 'create') { ids.set(`${s.kind}:${s.key}`, s.id); }
    const cols = { ...s.set };
    for (const [col, key] of Object.entries(s.refs)) cols[col] = ids.get(`${kindOf[col]}:${key}`);
    if (s.op === 'update') {
      const table = { section: m.sections, dish: m.dishes, group: m.groups, option: m.options, dish_group: m.dishGroups }[s.kind];
      const i = table.findIndex((r) => r.id === s.id);
      table[i] = { ...table[i], ...cols };
      continue;
    }
    if (s.op !== 'create') continue;
    const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
    ids.set(`${s.kind}:${s.key}`, id);
    if (s.kind === 'section') m.sections.push({ id, ...cols });
    if (s.kind === 'dish') m.dishes.push({ id, asset_id: null, ...cols });
    if (s.kind === 'group') m.groups.push({ id, ...cols });
    if (s.kind === 'option') m.options.push({ id, opens_group_id: null, ...cols });
    if (s.kind === 'dish_group') m.dishGroups.push({ id, ...cols });
  }
  return m;
}

test('importing the same menu again changes nothing (Hopa test 1): the same text, and the same menu in another order', () => {
  const draft = withDishPrice(cafe(), dishNamed(cafe(), 'Seasonal cake').key, 2800);
  const yes = confirmPrices(NO_DECISIONS, true);
  const first = gate(draft, EMPTY_MENU, yes, LANGS);
  assert.equal(first.ok, true);
  const menu = applied(EMPTY_MENU, first.plan);
  assert.equal(menu.dishes.length, 6);
  const again = gate(draft, menu, yes, LANGS);
  assert.equal(again.ok, true);
  assert.equal(changesNothing(again.plan), true, JSON.stringify(again.plan.summary));
  assert.equal(changesNothing(preview(draft, menu, yes, LANGS).plan), true);
  // the same menu, sections and dishes in reverse order
  const reversed = { ...draft, sections: [...draft.sections].reverse().map((s) => ({ ...s, dishes: [...s.dishes].reverse() })) };
  const re = gate(reversed, menu, yes, LANGS);
  assert.equal(re.ok, true);
  assert.equal(changesNothing(re.plan), true, JSON.stringify(re.plan.summary));
  assert.equal(applied(menu, re.plan).dishes.length, 6, 'no dish twice');
  // the same menu copied another day (another text: the sheet first, the sections in another order)
  const later = parseWoltText(WOLT_TEXT_REORDERED).draft;
  const id = `price_unreadable@${dishNamed(later, 'Seasonal cake').key}`;
  const other = gate(later, menu, choose(yes, id, 'no_price'), LANGS);
  assert.equal(other.ok, true);
  assert.equal(changesNothing(other.plan), true, JSON.stringify(other.plan.summary));
});

test('a price read that differs from the venue\'s: one question for its section, the dish with both prices, the venue\'s kept by default', () => {
  const base = withDishPrice(cafe(), dishNamed(cafe(), 'Seasonal cake').key, 2800);
  const yes = confirmPrices(NO_DECISIONS, true);
  const menu = applied(EMPTY_MENU, gate(base, EMPTY_MENU, yes, LANGS).plan);
  // the next copy of the page shows the cappuccino at ₪17
  const later = { ...base, sections: base.sections.map((s) => ({ ...s, dishes: s.dishes.map((d) => (d.name.en === 'Cappuccino' ? { ...d, price: 1700 } : d)) })) };
  const pv = preview(later, menu, yes, LANGS);
  const q = pv.rows.find((r) => r.e.code === 'price_differs');
  assert.ok(q, 'asked');
  assert.deepEqual([q.plan, q.e.severity, q.effective], [true, 'check', 'keep_mine']);
  assert.deepEqual(q.about.name, { he: '', en: 'Coffee' });
  const diffs = priceDiffs(later, menu, pv.plan).get(q.e.key);
  assert.deepEqual(diffs.map((x) => [x.name.en, x.yours, x.read]), [['Cappuccino', 1600, 1700]]);
  // kept by default: nothing changes; "take what was read" updates that one price
  assert.equal(changesNothing(gate(later, menu, yes, LANGS).plan), true);
  const take = gate(later, menu, choose(yes, q.id, 'take_new'), LANGS);
  assert.deepEqual(take.plan.steps.filter((x) => x.op === 'update').map((x) => [x.kind, x.set.price]), [['dish', 1700]]);
});

test('what an exception is about, by the draft\'s own names: a dish in its section, a choice in its group, a dish\'s group, the draft', () => {
  const draft = cafe();
  const plate = dishNamed(draft, 'Schnitzel plate');
  const side = draft.groups.find((g) => g.name.en === 'Side of choice');
  const rice = side.options.find((o) => o.name.en === 'Rice');
  assert.deepEqual(aboutOf(draft, { key: '_draft', path: '' }).kind, 'draft');
  const di = draft.sections.findIndex((s) => s.dishes.includes(plate));
  assert.deepEqual(aboutOf(draft, { key: plate.key, path: `sections[${di}].dishes[0]` }), { kind: 'dish', name: plate.name, within: draft.sections[di].name, theirs: null });
  assert.deepEqual(aboutOf(draft, { key: rice.key, path: '' }).within, side.name, 'found by key when the path says nothing');
  const link = aboutOf(draft, { key: `${plate.key}>${side.key}`, path: '' });
  assert.deepEqual([link.kind, link.name, link.within], ['link', side.name, plate.name]);
  const theirs = aboutOf(draft, { key: `${side.key}@00000000-0000-4000-8000-0000000000aa`, path: '' }, { groups: [{ id: '00000000-0000-4000-8000-0000000000aa', name_he: 'תוספת', name_en: 'Side' }] });
  assert.deepEqual(theirs.theirs, { he: 'תוספת', en: 'Side' });
});

test('the draft the database holds and the owner\'s: the same content whatever the key order', () => {
  const a = cafe();
  const reordered = Object.fromEntries(Object.entries(a).reverse());
  assert.equal(sameDraft(a, reordered), true);
  assert.equal(sameDraft(a, JSON.parse(JSON.stringify(a))), true);
  assert.equal(sameDraft(a, withDishPrice(a, dishNamed(a, 'Seasonal cake').key, 2800)), false);
});

test('a pasted list reads into the same flow: sections, dishes, prices', () => {
  const r = parsePaste('Breakfast:\nShakshuka 58\nCheese toast 42\nDrinks:\nEspresso 12');
  const pv = preview(r.draft, EMPTY_MENU, confirmPrices(NO_DECISIONS, true), LANGS);
  assert.ok(pv.plan);
  assert.deepEqual([pv.plan.summary.section.create, pv.plan.summary.dish.create], [2, 3]);
});

test('what the reader said: one line per kind, counts added, lines merged in order', () => {
  const { notes } = parseWoltText(WOLT_TEXT);
  const noise = notes.filter((n) => n.code === 'noise');
  assert.ok(noise.length > 1, 'the reader keeps a note per rule');
  const lines = noteLines(notes);
  assert.equal(lines.filter((x) => x.code === 'noise').length, 1);
  const one = lines.find((x) => x.code === 'noise');
  assert.equal(one.count, noise.reduce((n, x) => n + x.count, 0));
  assert.deepEqual(one.lines, [...new Set(noise.flatMap((x) => x.lines))].sort((a, b) => a - b));
  assert.deepEqual(noteLines([]), []);
});

test('what is left out says why: the repeated espresso as the owner chose, "Most ordered" with nothing left in it', () => {
  const g = gate(withDishPrice(cafe(), dishNamed(cafe(), 'Seasonal cake').key, 2800), EMPTY_MENU, confirmPrices(NO_DECISIONS, true), LANGS);
  assert.deepEqual(planLines(g.plan).filter((x) => x.op === 'skip').map((x) => `${x.kind}:${x.reason}:${x.n}`), ['section:empty:1', 'dish:choice:1']);
  assert.ok(planLines(g.plan).filter((x) => x.op !== 'skip').every((x) => x.reason === null));
});

test('an answer the plan refuses is said at its question, which stays on screen: "a new group" on an add-on taken more than once', () => {
  // the venue (invented): Burger with Extras, Cheese up to 2 times; the new read has Cheese opening "Cheese type"
  const extras = (cheese) => group('g', 'תוספות', 'Extras', { selection: 'multiple', min: 0, max: 4, options: [opt('c', 'גבינה', 'Cheese', 300, cheese), opt('e', 'ביצה', 'Egg', 400)] });
  const burger = () => [section('s', 'עיקריות', 'Mains', [dish('d', 'המבורגר', 'Burger', 7000, { groups: [link('g')] })])];
  const venue = applyPlan(EMPTY_MENU, gate(draftOf(burger(), [extras({ maxQty: 2 })]), EMPTY_MENU, confirmPrices(NO_DECISIONS, true), LANGS).plan);
  const draft = draftOf(burger(), [extras({ opens: 'n' }),
    group('n', 'סוג גבינה', 'Cheese type', { selection: 'single', min: 1, max: 1, options: [opt('n1', 'צהובה', 'Yellow', 0), opt('n2', 'עיזים', 'Goat', 0)] })]);
  const id = 'opens_changed@c>n';
  const kept = confirmPrices(NO_DECISIONS, true);
  assert.equal(preview(draft, venue, kept, LANGS).rows.find((r) => r.id === id).effective, 'keep_mine', 'the default: the venue\'s Cheese as it is');
  assert.equal(gate(draft, venue, kept, LANGS).ok, true);

  const moved = choose(kept, id, 'new_group');
  const pv = preview(draft, venue, moved, LANGS);
  assert.equal(pv.plan, null, 'no plan to show: applying would be refused');
  const r = pv.rows.find((x) => x.id === id);
  assert.ok(r, 'the question is still listed, so the answer can be changed back');
  assert.deepEqual([r.choice, r.refused], ['new_group', 'opener_qty']);
  assert.deepEqual(pv.planErrors, [], 'said at the question, not again under the plan');
  const g = gate(draft, venue, moved, LANGS);
  assert.deepEqual([g.ok, g.errors.map((e) => e.code)], [false, ['opener_qty']]);
  assert.equal(preview(draft, venue, choose(moved, id, 'keep_mine'), LANGS).rows.find((x) => x.id === id).refused, null);
});

test('the answers kept on the device: per account and import, read back through the validator, never a skip; another account\'s go', () => {
  const imp = '00000000-0000-4000-8000-0000000000e1', me = '00000000-0000-4000-8000-0000000000a1', other = '00000000-0000-4000-8000-0000000000a2';
  assert.equal(answersKey(me, imp), `mana-import-answers:${me}:${imp}`);
  const d = choose(NO_DECISIONS, 'dish_repeated@s0d1', 'keep_both');
  const back = readAnswers(writeAnswers({ ...d, pricesConfirmed: true, skip: ['s0'] }));
  assert.deepEqual(back, { v: 1, pricesConfirmed: false, choices: { 'dish_repeated@s0d1': 'keep_both' }, skip: [] }, 'the prices are confirmed again; nothing left out but by an answer');
  assert.ok(!writeAnswers({ ...d, skip: ['s0'] }).includes('skip'), 'a skip is never stored');
  // what was written by hand, or by an older version, is checked again: an answer outside the list drops them all
  assert.deepEqual(readAnswers(JSON.stringify({ choices: { 'dish_repeated@s0d1': 'delete_everything' } })), NO_DECISIONS);
  assert.deepEqual(readAnswers(JSON.stringify({ choices: { '__proto__': 'skip' } })), NO_DECISIONS);
  assert.deepEqual(readAnswers(JSON.stringify({ choices: {}, skip: ['s0', 's1'] })).skip, [], 'a stored skip is not read back');
  assert.deepEqual(readAnswers('not json'), NO_DECISIONS);
  assert.deepEqual(readAnswers('[1,2]'), NO_DECISIONS);
  assert.deepEqual(readAnswers(null), NO_DECISIONS);
  // a device's store: the signed-in account keeps its own; signed out, none is left
  const store = (keys) => {
    const m = new Map(keys.map((k) => [k, '{}']));
    return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, removeItem: (k) => { m.delete(k); }, keys: () => [...m.keys()].sort() };
  };
  const s = store([answersKey(me, imp), answersKey(other, imp), `mana-import-answers:${imp}`, 'mana-studio-v2-venue:' + me]);
  forgetAnswersBut(me, s);
  assert.deepEqual(s.keys(), [answersKey(me, imp), 'mana-studio-v2-venue:' + me].sort(), 'another account\'s, and the old unkeyed ones, are gone');
  forgetAnswersBut(null, s);
  assert.deepEqual(s.keys(), ['mana-studio-v2-venue:' + me], 'signed out: no answer is left');
});

test('every note, question, answer, reason and refusal the contracts can send has words in both languages', () => {
  const src = fs.readFileSync(new URL('../../src/v2/i18n.ts', import.meta.url), 'utf8');
  const words = new Map([...src.matchAll(/^\s*'([a-zA-Z0-9_.]+)':\s*\[\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\s*\]/gm)].map((m) => [m[1], [m[2], m[3]]]));
  const want = [
    ...READER_NOTE_CODES.map((c) => 'note.' + c),
    ...Object.keys(EXCEPTION_CHOICES).map((c) => 'imp.x.' + c),
    ...[...new Set(Object.values(EXCEPTION_CHOICES).flat())].map((c) => 'imp.c.' + c),
    ...SKIP_REASONS.map((r) => 'imp.why.' + r),
    'imp.refused.opener_qty',
  ];
  assert.deepEqual(want.filter((k) => !(words.get(k)?.[0].trim() && words.get(k)?.[1].trim())), []);
});

// ---------------------------------------------------------------- the import calls
test('the import calls: the contracts\' validators before the network; each RPC with exactly its arguments', async () => {
  const calls = [];
  const api = importsApi(async (fn, args) => { calls.push([fn, args]); return { ok: true, importId: '00000000-0000-4000-8000-0000000000d1', status: 'uploaded', reused: false }; });
  await assert.rejects(api.create({ venueId: 'nope', source: 'paste', text: 'x', rightsConfirmed: false }), (e) => e.code === 'id_invalid');
  await assert.rejects(api.create({ venueId: VENUE, source: 'paste', text: 'x', rightsConfirmed: true }), (e) => e.code === 'rights_invalid', 'only Wolt screenshots may say the photos are the owner\'s');
  await assert.rejects(api.create({ venueId: VENUE, source: 'scan', paths: ['a.jpg'], inputSha256: 'f'.repeat(64), rightsConfirmed: false }), (e) => e.code === 'id_invalid', 'an image import names its own id');
  assert.equal(calls.length, 0, 'nothing left the phone');
  await api.create({ venueId: VENUE, source: 'wolt_text', text: WOLT_TEXT, rightsConfirmed: false });
  assert.deepEqual(calls[0], ['create_import', { p_venue: VENUE, p_source: 'wolt_text', p_text: WOLT_TEXT, p_paths: null, p_input_sha256: null, p_rights_confirmed: false, p_import_id: null }]);
  const draft = cafe();
  await api.saveDraft('00000000-0000-4000-8000-0000000000d1', draft, parseWoltText(WOLT_TEXT).notes);
  assert.equal(calls[1][0], 'save_import_draft');
  assert.deepEqual(Object.keys(calls[1][1]), ['p_import', 'p_draft', 'p_notes']);
  await assert.rejects(api.apply('00000000-0000-4000-8000-0000000000d1', draft, { v: 1, pricesConfirmed: 'yes', choices: {} }), (e) => e.code === 'type');
  await api.apply('00000000-0000-4000-8000-0000000000d1', draft, confirmPrices(NO_DECISIONS, true));
  assert.deepEqual(Object.keys(calls[2][1]), ['p_import', 'p_draft', 'p_decisions']);
  await api.discard('00000000-0000-4000-8000-0000000000d1');
  assert.deepEqual(calls[3], ['discard_import', { p_import: '00000000-0000-4000-8000-0000000000d1' }]);
});

test('pictures for the scanner: each under the import\'s own folder; the input\'s hash is the same for the same pictures in the same order', async () => {
  const id = '00000000-0000-4000-8000-0000000000d2';
  assert.equal(imagePath(VENUE.toUpperCase(), id, 0, 'jpg'), `${VENUE}/imports/${id}/01.jpg`);
  assert.match(imagePath(VENUE, id, 23, 'png'), /\/imports\/[0-9a-f-]+\/24\.png$/);
  const a = new Uint8Array([1, 2, 3]), b = new Uint8Array([4, 5]);
  const h = await imagesHash([a, b]);
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(await imagesHash([a, b]), h);
  assert.notEqual(await imagesHash([b, a]), h);
});

// ---------------------------------------------------------------- the demo mark (B5)
test('outside production every QR code carries the "demo" mark, under the code (which still scans as it was)', () => {
  assert.equal(marksDemo('production'), false);
  assert.equal(marksDemo('demo'), true);
  assert.equal(marksDemo('local'), true);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 37 37" shape-rendering="crispEdges"><path d="M4 4h7"/></svg>';
  const marked = withDemoBand(svg);
  assert.match(marked, /viewBox="0 0 37 43"/, 'the picture grows below the code');
  assert.ok(marked.includes('<path d="M4 4h7"/>'), 'the code itself is untouched');
  assert.ok(marked.includes(DEMO_MARK) && marked.includes('data-demo="mark"'));
  assert.ok(!/width="200"|height="200"/.test(marked), 'the viewBox alone sizes it');
  assert.equal(withDemoBand('<svg></svg>'), '<svg></svg>');
});
