import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_MENU, planApply, validateDraft, type ImportDraft } from '@mana/contracts';
import { bistroDraft, copy, dish, link, section } from '../../contracts/test/import-fixtures.ts';
import { fromScanEvents, mergeDrafts, parsePaste, parseWoltText, readScanReply, scanDraft } from '../src/index.ts';
import { PASTE_EN, PASTE_MIXED, REPLY_WOLT, SCAN_EVENTS, WOLT_EN_PAGE, WOLT_EN_SHEET, WOLT_HE_PAGE, WOLT_HE_SHEET } from './fixtures.ts';
import { answerFixes, exceptions, outline, reimportCreatesNothing, valid } from './helpers.ts';

function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}
const merged = (ds: readonly ImportDraft[]) => valid(mergeDrafts(ds));
const page = (text: string, n: number) => readScanReply(text, { langs: ['he', 'en'], stock: [], page: n, truncated: false });

const readers: Array<[string, () => ImportDraft]> = [
  ['wolt en', () => parseWoltText(`${WOLT_EN_PAGE}\n${WOLT_EN_SHEET}`).draft],
  ['wolt he', () => parseWoltText(`${WOLT_HE_PAGE}\n${WOLT_HE_SHEET}`).draft],
  ['paste', () => parsePaste(PASTE_MIXED).draft],
  ['paste en', () => parsePaste(PASTE_EN).draft],
  ['scan events', () => fromScanEvents(SCAN_EVENTS).draft],
  ['scanner', () => scanDraft('wolt_screenshots', [page(REPLY_WOLT, 1)]).draft],
];

test('mergeDrafts is idempotent: a draft with itself, twice, or a merge with one of its inputs', () => {
  for (const [name, read] of readers) {
    const d = read();
    assert.deepEqual(merged([d]), d, name);
    assert.deepEqual(merged([d, d]), d, name);
    assert.deepEqual(merged([merged([d, d]), d]), d, name);
  }
  const a = parsePaste('# Mains\nSoup 30\nStew 60').draft, b = parsePaste('# Mains\nStew 60\nPie 40').draft;
  const ab = merged([a, b]);
  assert.deepEqual(merged([ab, b]), ab);
  assert.deepEqual(merged([ab, a, b]), ab);
});

test('mergeDrafts is independent of the drafts\' order where their overlaps decide it', () => {
  const full = `# Mains\nSchnitzel 64\nBurger 72\nFish 88\nPasta 54\n# Drinks\nLemonade 18\nCola 12\n# Desserts\nMalabi 26`;
  // three "screenshots" of the same list, each overlapping the next
  const shots = [
    '# Mains\nSchnitzel 64\nBurger 72\nFish 88',
    '# Mains\nBurger 72\nFish 88\nPasta 54\n# Drinks\nLemonade 18',
    '# Drinks\nLemonade 18\nCola 12\n# Desserts\nMalabi 26',
  ].map((t) => parsePaste(t).draft);
  const expected = parsePaste(full).draft;
  for (const p of permutations(shots)) assert.deepEqual(merged(p), expected);
});

test('mergeDrafts with groups: overlapping scanner readings, in any order, give one menu with each group once', () => {
  const shots = [
    '{"c":{"he":"עיקריות","en":"Mains"},"k":"food"}\n{"n":{"he":"שניצל","en":"Schnitzel"},"p":"₪64"}\n{"g":{"he":"תוספת","en":"Side"},"r":"Required · Choose 1"}\n{"o":{"he":"צ׳יפס","en":"Fries"}}\n{"o":{"he":"סלט","en":"Salad"}}',
    '{"c":{"he":"עיקריות","en":"Mains"},"k":"food"}\n{"n":{"he":"שניצל","en":"Schnitzel"},"p":"₪64"}\n{"n":{"he":"המבורגר","en":"Burger"},"p":"₪72"}\n{"g":{"he":"תוספת","en":"Side"},"r":"Required · Choose 1"}\n{"o":{"he":"צ׳יפס","en":"Fries"}}\n{"o":{"he":"סלט","en":"Salad"}}',
    '{"c":{"he":"עיקריות","en":"Mains"},"k":"food"}\n{"n":{"he":"המבורגר","en":"Burger"},"p":"₪72"}\n{"c":{"he":"שתייה","en":"Drinks"},"k":"drinks"}\n{"n":{"he":"לימונדה","en":"Lemonade"},"p":"₪18"}',
  ].map((t, i) => scanDraft('wolt_screenshots', [page(t, i + 1)]).draft);
  const results = permutations(shots).map(merged);
  for (const r of results) assert.deepEqual(r, results[0]);
  const d = results[0]!;
  assert.equal(d.groups.length, 1);
  assert.deepEqual(d.sections[0]!.dishes.map((x) => x.groups.map((g) => g.group)), [[d.groups[0]!.key], [d.groups[0]!.key]]);
});

test('where the drafts say nothing about each other, the earlier draft comes first; the content never depends on the order', () => {
  const a = parsePaste('# Mains\nSoup 30').draft, b = parsePaste('# Drinks\nCola 10').draft;
  assert.deepEqual(outline(merged([a, b])), ['# Mains (food)', 'Soup 3000', '# Drinks (drinks)', 'Cola 1000']);
  assert.deepEqual(outline(merged([b, a])), ['# Drinks (drinks)', 'Cola 1000', '# Mains (food)', 'Soup 3000']);
  assert.deepEqual(outline(merged([a, b])).sort(), outline(merged([b, a])).sort());
});

test('identical groups become one (planApply does not dedupe inside one draft)', () => {
  const d = copy(bistroDraft()) as any;
  d.groups.push({ ...copy(d.groups[0]), key: 'g-side-2', options: d.groups[0].options.map((o: any) => ({ ...o, key: `${o.key}-2` })) });
  d.sections[0].dishes[1].groups = [link('g-side-2'), link('g-extras')];
  assert.ok(validateDraft(d).ok);
  const before = planApply(d, EMPTY_MENU, { v: 1, pricesConfirmed: true, choices: {} });
  assert.ok(before.ok && before.value.summary.group.create === 4, 'as given, the plan would create the side twice');
  const m = merged([d]);
  assert.equal(m.groups.length, 3);
  const side = m.groups.find((g) => g.name.en === 'Side of choice')!;
  assert.deepEqual(m.sections[0]!.dishes.map((x) => x.groups[0]!.group), [side.key, side.key]);
  const after = planApply(m, EMPTY_MENU, { v: 1, pricesConfirmed: true, choices: {} });
  assert.ok(after.ok && after.value.summary.group.create === 3);
});

test('the same dish read with two prices stays two dishes, and the owner is asked', () => {
  const m = merged([parsePaste('# Mains\nSoup 30').draft, parsePaste('# Mains\nSoup 32').draft]);
  assert.deepEqual(outline(m), ['# Mains (food)', 'Soup 3000', 'Soup 3200']);
  assert.deepEqual(exceptions(m, ['en']), ['dish_duplicate@Soup']);
  assert.deepEqual(outline(merged([parsePaste('# Mains\nSoup').draft, parsePaste('# Mains\nSoup 30').draft])), ['# Mains (food)', 'Soup 3000'], 'no price and a price agree');
});

test('values: the printed text beats a translation; a cut description gives way to the full one', () => {
  const a = scanDraft('scan_menu', [page('{"lang":"he"}\n{"c":{"he":"עיקריות","en":"Mains"},"k":"food","tr":["en"]}\n{"n":{"he":"מרק","en":"Soup"},"d":{"he":"","en":"Lentils, cumin…"},"p":"30"}', 1)]).draft;
  const b = scanDraft('scan_menu', [page('{"lang":"he"}\n{"c":{"he":"עיקריות","en":"Main courses"},"k":"food"}\n{"n":{"he":"מרק","en":"Soup"},"d":{"he":"","en":"Lentils, cumin and lemon"},"p":"30"}', 1)]).draft;
  for (const p of permutations([a, b])) {
    const m = merged(p);
    assert.deepEqual([m.sections[0]!.name, m.sections[0]!.translated], [{ he: 'עיקריות', en: 'Main courses' }, []]);
    assert.equal(m.sections[0]!.dishes[0]!.desc.en, 'Lentils, cumin and lemon');
  }
});

test('mergeDrafts refuses drafts of different sources, or none', () => {
  assert.throws(() => mergeDrafts([]), RangeError);
  assert.throws(() => mergeDrafts([parsePaste('Soup 30').draft, parseWoltText('Soup\n₪30.00').draft]), RangeError);
});

test('a draft whose groups open each other (two levels: an exception, not an error) still merges', () => {
  const d = copy(bistroDraft()) as any;
  d.groups[1].options[0].opens = 'g-side';
  assert.ok(validateDraft(d).ok);
  const m = merged([d, d]);
  assert.ok(exceptions(m).some((e) => e.startsWith('nesting_too_deep@')));
  assert.deepEqual(merged([m]), m);
});

test('Hopa test 1 after a merge: the merged menu imported again creates nothing', () => {
  const shots = ['# Mains\nSoup 30\nStew 60', '# Mains\nStew 60\nPie 40\n# Drinks\nCola 10'];
  const read = () => mergeDrafts(shots.map((t) => parsePaste(t).draft));
  reimportCreatesNothing(read, answerFixes(read().draft));
  const sections = [section('s1', 'עיקריות', 'Mains', [dish('d1', 'מרק', 'Soup', 3000)])];
  assert.ok(merged([{ v: 1, source: 'paste', sections, groups: [] }]).sections[0]!.key.startsWith('s-mains-'), 'keys are the reader\'s, not the input\'s');
});
