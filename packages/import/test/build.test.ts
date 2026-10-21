import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_BYTES_MAX, DRAFT_CAPS, DRAFT_KEY_RE, draftBytes } from '@mana/contracts';
import { nameIdentity, parsePaste, parseWoltText, readScanReply, scanDraft } from '../src/index.ts';
import { hash8, slug } from '../src/keys.ts';
import { exceptions, valid } from './helpers.ts';

const jsonl = (lines: unknown[]) => lines.map((l) => JSON.stringify(l)).join('\n');
const draftOf = (lines: unknown[]) => scanDraft('wolt_screenshots', [readScanReply(jsonl(lines), { langs: ['en'], stock: [], page: 1, truncated: false })]);
const t = (en: string) => ({ he: '', en });

test('nameIdentity: the printed language decides; a translation never does', () => {
  assert.equal(nameIdentity({ he: 'שניצל', en: 'Schnitzel' }, []), 'he:שניצל');
  assert.equal(nameIdentity({ he: 'שניצל', en: 'Schnitzel' }, ['he']), 'en:schnitzel');
  assert.equal(nameIdentity({ he: '', en: 'Crème Brûlée!' }, []), 'en:creme brulee', 'through importKey');
  assert.equal(nameIdentity({ he: 'שניצל', en: '' }, ['he']), 'he:שניצל', 'all translated: any language');
  assert.equal(nameIdentity({ he: '', en: '' }, []), '');
});

test('keys: a kind, English words and a hash; always valid; stable', () => {
  assert.equal(slug('Side of choice'), 'side-of-choice');
  assert.equal(slug('A very long dish name that goes on and on'), 'a-very-long-dish-name');
  assert.equal(slug('שניצל'), '');
  assert.equal(hash8('x'), hash8('x'));
  assert.notEqual(hash8('x'), hash8('y'));
  const d = parsePaste('# Mains\nSoup 30\nמרק 30\nA very long dish name that goes on and on 40').draft;
  for (const k of [d.sections[0]!.key, ...d.sections[0]!.dishes.map((x) => x.key)]) assert.match(k, DRAFT_KEY_RE);
  assert.match(d.sections[0]!.dishes[1]!.key, /^d-[0-9a-f]{8}$/, 'a name with no Latin letters: the hash alone');
  assert.match(d.sections[0]!.dishes[2]!.key, /^d-a-very-long-dish-name-[0-9a-f]{8}$/);
});

test('bounds: groups per dish, options per group and groups past DRAFT_CAPS are left out with a note', () => {
  const groups = Array.from({ length: DRAFT_CAPS.groupsPerDish + 4 }, (_, i) => [{ g: t(`Group ${i}`), r: 'Optional' }, { o: t(`Option ${i}`), p: '+₪1' }]).flat();
  const options = Array.from({ length: DRAFT_CAPS.optionsPerGroup + 3 }, (_, i) => ({ o: t(`Choice ${i}`) }));
  const r = draftOf([{ c: t('Mains') }, { n: t('Big'), p: '₪50' }, ...groups, { n: t('Long'), p: '₪50' }, { g: t('Many'), r: 'Optional' }, ...options]);
  const d = valid(r);
  assert.equal(d.sections[0]!.dishes[0]!.groups.length, DRAFT_CAPS.groupsPerDish);
  assert.equal(d.groups.find((g) => g.name.en === 'Many')!.options.length, DRAFT_CAPS.optionsPerGroup);
  assert.deepEqual(r.notes.filter((n) => n.code === 'caps_reached').map((n) => [n.rule, n.count]), [['groups_per_dish', 4], ['options_per_group', 3]]);
  assert.ok(!d.groups.some((g) => g.name.en === `Group ${DRAFT_CAPS.groupsPerDish}`), 'a group no kept dish reaches is not in the draft');
  const many = draftOf([{ c: t('Mains') }, ...Array.from({ length: DRAFT_CAPS.groups + 10 }, (_, i) => [{ n: t(`Dish ${i}`), p: '₪10' }, { g: t(`Side ${i}`) }, { o: t(`Fries ${i}`) }]).flat()]);
  assert.equal(valid(many).groups.length, DRAFT_CAPS.groups);
  assert.ok(many.notes.some((n) => n.code === 'caps_reached' && n.rule === 'groups' && n.count === 10));
  assert.ok(exceptions(many.draft).some((e) => e.startsWith('too_many@')), 'past LIMITS but within DRAFT_CAPS: the owner chooses');
});

test('limits a group cannot have are left unstated; too many defaults are cleared; texts are cut', () => {
  const r = draftOf([
    { n: t('Pizza'), p: '₪50' },
    { g: t('Toppings'), r: 'Choose up to 50' }, { o: t('Olives') },
    { g: t('Size'), r: 'Choose 1' }, { o: t('Small'), f: true }, { o: t('Large'), f: true },
    { g: t('x'.repeat(80)) }, { o: t('y'.repeat(80)) },
  ]);
  const d = valid(r);
  const [toppings, size, long] = d.groups;
  assert.deepEqual([toppings!.min, toppings!.max], [null, null]);
  assert.deepEqual(size!.options.map((o) => o.default), [false, false]);
  assert.equal(long!.name.en.length, 60);
  assert.deepEqual(r.notes.map((n) => n.code).sort(), ['defaults_cleared', 'limits_dropped', 'text_clipped']);
  assert.ok(r.notes.every((n) => n.severity === 'check'));
});

test('a dish never carries two groups of the same name and choice: they become one (addon_duplicate)', () => {
  // two screenshots that each show part of the burger's sides
  const r = draftOf([
    { c: t('Mains') }, { n: t('Burger'), p: '₪72' },
    { g: t('Choose a side'), r: 'Required · Choose 1' }, { o: t('Fries') }, { o: t('Salad') },
    { g: t('Choose a side'), r: 'Choose 1' }, { o: t('Salad') }, { o: t('Rice'), p: '+₪4' },
    { g: t('Extras'), r: 'Choose up to 2' }, { o: t('Egg'), p: '+₪5' },
    { g: t('Extras'), r: 'Choose up to 3' }, { o: t('Cheese'), p: '+₪3' },
  ]);
  const d = valid(r);
  assert.deepEqual(d.groups.map((g) => [g.name.en, g.selection, g.min, g.max, g.options.map((o) => o.name.en)]), [
    ['Choose a side', 'single', 1, 1, ['Fries', 'Salad', 'Rice']],
    ['Extras', 'multiple', null, null, ['Egg', 'Cheese']],
  ]);
  assert.deepEqual(d.sections[0]!.dishes[0]!.groups.map((g) => g.group), d.groups.map((g) => g.key));
  assert.ok(r.notes.some((n) => n.code === 'limits_dropped'), 'two different maximums: neither is kept');
});

test('text the database cannot store (NUL, half an emoji) is removed', () => {
  const nul = String.fromCharCode(0), half = String.fromCharCode(0xd83c), stew = String.fromCodePoint(0x1f372);
  const d = valid(parsePaste(`# Mains${nul}\nSoup${half} 30\nStew ${stew} 60`));
  assert.deepEqual(d.sections[0]!.dishes.map((x) => x.name.en), ['Soup', `Stew ${stew}`], 'a whole emoji stays');
  assert.equal(d.sections[0]!.name.en, 'Mains');
});

test('a draft past DRAFT_BYTES_MAX keeps its first dishes, with a note', () => {
  // characters of three bytes each, a full description and allergens: 700 such dishes are past DRAFT_BYTES_MAX (1.5 MB)
  // while within DRAFT_CAPS
  const desc = '€'.repeat(590), allergens = '€'.repeat(290);
  const lines = Array.from({ length: 700 }, (_, i) => ({ n: t(`Dish ${i}`), d: { he: desc, en: '' }, a: { he: allergens, en: '' }, p: '₪10' }));
  const r = scanDraft('wolt_screenshots', [readScanReply(jsonl([{ c: t('Mains') }, ...lines]), { langs: ['he', 'en'], stock: [], page: 1, truncated: false })]);
  const d = valid(r);
  assert.ok(draftBytes(d) <= DRAFT_BYTES_MAX);
  const kept = d.sections[0]!.dishes.length;
  assert.ok(kept > 100 && kept < 700, String(kept));
  assert.deepEqual(d.sections[0]!.dishes.map((x) => x.name.en), Array.from({ length: kept }, (_, i) => `Dish ${i}`), 'the first ones, in order');
  assert.ok(r.notes.some((n) => n.code === 'caps_reached' && n.rule === 'bytes' && n.count === 700 - kept));
});

test('dropped: the lines a reader could not read, in the draft', () => {
  assert.equal(parseWoltText('Choose a side\nRequired\nFries\n+₪4.00\nMains\nSoup\n₪30.00').draft.dropped, 4);
  assert.equal(readScanReply('{"n":{"he":"","en":"Soup"},"p":"30"}\nnot json\n{"n":', { langs: ['en'], stock: [], page: 1, truncated: true }).dropped, 2);
  assert.equal(parsePaste('# Mains\nSoup 30').draft.dropped, 0);
});
