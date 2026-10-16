import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_MENU, planApply, validateDraft, type ImportDraft } from '@mana/contracts';
import { bistroDraft, copy, dish, link, section } from '../../contracts/test/import-fixtures.ts';
import { fromScanEvents, mergeDrafts, parsePaste, parseWoltText, readScanReply, scanDraft } from '../src/index.ts';
import { PASTE_EN, PASTE_MIXED, REPLY_WOLT, SCAN_EVENTS, WOLT_EN_PAGE, WOLT_EN_SHEET, WOLT_HE_PAGE, WOLT_HE_SHEET } from './fixtures.ts';
import { mergeOrder } from '../src/order.ts';
import { answerFixes, exceptions, fastest, outline, reimportCreatesNothing, valid } from './helpers.ts';

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
  assert.ok(merged([{ v: 1, source: 'paste', sections, groups: [], dropped: 0 }]).sections[0]!.key.startsWith('s-mains-'), 'keys are the reader\'s, not the input\'s');
});

// ---------------------------------------------------------------- the fix round (QA M6, M9)

const t = (en: string) => ({ he: '', en });
const shot = (lines: unknown[]) => scanDraft('wolt_screenshots', [readScanReply(lines.map((l) => JSON.stringify(l)).join('\n'), { langs: ['en'], stock: [], page: 1, truncated: false })]).draft;
const sameInEveryOrder = (drafts: readonly ImportDraft[]): ImportDraft => {
  const all = permutations(drafts).map((p) => merged(p));
  for (const m of all) assert.deepEqual(m, all[0]);
  return all[0]!;
};

test('QA-M6: an option read at two prices has none (an exception asks), in any order; never the first copy\'s', () => {
  const A = shot([{ c: t('Mains') }, { n: t('Pasta'), p: '₪54.00' }, { g: t('Sauce'), r: 'Choose up to 2' }, { o: t('Tomato') }, { o: t('Cream'), f: true }, { o: t('Rice'), p: '+₪4.00' }]);
  const B = shot([{ c: t('Mains') }, { n: t('Pasta'), p: '₪54.00' }, { g: t('Sauce'), r: 'Choose up to 2' }, { o: t('Cream') }, { o: t('Rice'), p: '+₪5.00' }, { o: t('Pesto') }]);
  const m = sameInEveryOrder([A, B]);
  const rice = m.groups[0]!.options.find((o) => o.name.en === 'Rice')!;
  assert.deepEqual([rice.price, rice.priceText], [null, '+₪4.00 / +₪5.00']);
  assert.ok(exceptions(m, ['en']).includes('option_price_unreadable@Rice'));
  // pre-selected in one copy only: not pre-selected, and the limits are the owner's to confirm
  const cream = m.groups[0]!.options.find((o) => o.name.en === 'Cream')!;
  assert.equal(cream.default, false);
  assert.deepEqual([m.groups[0]!.min, m.groups[0]!.max], [null, null]);
  assert.ok(exceptions(m, ['en']).includes('limits_guessed@Sauce'));
  assert.ok(mergeDrafts([A, B]).notes.some((n) => n.code === 'defaults_cleared'));
  // the same inside one scan (two calls): the same group
  const call = (price: string, n: number) => readScanReply([{ c: t('Mains') }, { n: t('Pasta'), p: '₪54.00' }, { g: t('Sauce'), r: 'Choose up to 2' }, { o: t('Rice'), p: price }]
    .map((l) => JSON.stringify(l)).join('\n'), { langs: ['en'], stock: [], page: n, truncated: false });
  const one = scanDraft('wolt_screenshots', [call('+₪4.00', 1), call('+₪5.00', 2)]).draft;
  assert.deepEqual([one.groups[0]!.options[0]!.price, one.groups[0]!.options[0]!.priceText], [null, '+₪4.00 / +₪5.00']);
  // four prices or more: their span
  const prices = [4, 5, 6, 7].map((p) => shot([{ c: t('Mains') }, { n: t('Pasta'), p: '₪54.00' }, { g: t('Sauce') }, { o: t('Rice'), p: `+₪${p}.00` }]));
  assert.equal(merged(prices).groups[0]!.options[0]!.priceText, '+₪4.00…+₪7.00');
});

test('QA-M6: merge(merge(A, B), A) == merge(A, B), whatever the inputs disagree on', () => {
  const A = shot([{ c: t('Mains') }, { n: t('Pasta'), p: '₪54.00' }, { g: t('Sauce'), r: 'Choose up to 2' }, { o: t('Tomato') }, { o: t('Cream'), f: true }, { o: t('Rice'), p: '+₪4.00' }]);
  const B = shot([{ c: t('Mains') }, { n: t('Pasta'), p: '₪54.00' }, { g: t('Sauce'), r: 'Choose up to 3' }, { o: t('Cream') }, { o: t('Rice'), p: '+₪5.00' }, { o: t('Pesto') }]);
  const C = shot([{ c: t('Mains') }, { n: t('Pasta'), p: '₪54.00' }, { g: t('Sauce') }, { o: t('Pesto') }, { o: t('Tomato') }, { o: t('Rice'), p: '+₪6.00' }]);
  for (const [x, y] of [[A, B], [B, A], [A, C], [B, C]] as const) {
    const m = merged([x, y]);
    assert.deepEqual(merged([m, x]), m);
    assert.deepEqual(merged([m, y]), m);
    assert.deepEqual(merged([x, m, y]), m);
  }
  // limits stated in one copy and not in another: left unstated, and stays so
  const m = merged([A, C]);
  assert.deepEqual([m.groups[0]!.min, m.groups[0]!.max], [null, null]);
  // three copies whose orders contradict each other (a cycle): one order, whichever copy comes first
  sameInEveryOrder([A, B, C]);
});

test('the same dish at two prices, merged in any order: two dishes in price order', () => {
  const a = shot([{ c: t('Mains') }, { n: t('Soup'), p: '₪30.00' }, { n: t('Stew'), p: '₪60.00' }]);
  const b = shot([{ c: t('Mains') }, { n: t('Soup'), p: '₪38.00' }, { n: t('Stew') }]);
  const c = shot([{ c: t('Mains') }, { n: t('Stew'), p: '₪60.00' }, { n: t('Pie'), p: '₪40.00' }]);
  const m = sameInEveryOrder([a, b, c]);
  assert.deepEqual(outline(m), ['# Mains (food)', 'Soup 3000', 'Soup 3800', 'Stew 6000', 'Pie 4000']);
});

test('groups of one name on a dish: Hebrew first, as the contracts compare names; symbol names by their text', () => {
  const he = (h: string, en: string) => ({ he: h, en });
  const d = scanDraft('wolt_screenshots', [readScanReply([
    { c: he('עיקריות', 'Mains') }, { n: he('פסטה', 'Pasta'), p: '₪54' },
    { g: he('רוטב', 'Sauce') }, { o: he('עגבניות', 'Tomato') }, { g: he('תוספת', 'Sauce') }, { o: he('גבינה', 'Cheese') },
    { g: he('', '🌶️') }, { o: he('', 'Mild') }, { g: he('', '🌶️') }, { o: he('', 'Hot') },
  ].map((l) => JSON.stringify(l)).join('\n'), { langs: ['he', 'en'], stock: [], page: 1, truncated: false })]).draft;
  assert.ok(validateDraft(d).ok, JSON.stringify(validateDraft(d)));
  assert.deepEqual(outline(d).slice(2), [
    '[רוטב / Sauce] multiple ?-?: עגבניות / Tomato', '[תוספת / Sauce] multiple ?-?: גבינה / Cheese', '[🌶️] multiple ?-?: Mild, Hot',
  ], 'the same English name under two Hebrew names stays two groups; two groups named only "🌶️" are one');
});

test('QA-M9: merging is linear: thousands of groups of one name on a dish, a long contradicting order', () => {
  // the model repeats the group line before every option (one answer, well under MAX_TOKENS)
  const answer = ['{"n":{"he":"","en":"Burger"},"p":"₪72.00"}', ...Array.from({ length: 800 }, (_, i) => `{"g":{"he":"","en":"Extras"}}\n{"o":{"he":"","en":"Extra ${i}"},"p":"+₪1"}`)].join('\n');
  const { ms, r } = fastest(() => scanDraft('wolt_screenshots', [readScanReply(answer, { langs: ['en'], stock: [], page: 1, truncated: false })]));
  const d = valid(r);
  assert.equal(d.groups.length, 1);
  assert.ok(ms < 1000, `${ms.toFixed(0)} ms`);
  // two long orders that disagree everywhere
  const ids = Array.from({ length: 20_000 }, (_, i) => `n${i}`);
  const rank = new Map(ids.map((id, i) => [id, [i]] as const));
  const t0 = fastest(() => mergeOrder([ids, [...ids].reverse()], rank));
  assert.equal(new Set(t0.r).size, ids.length);
  assert.ok(t0.ms < 1000, `${t0.ms.toFixed(0)} ms`);
});
