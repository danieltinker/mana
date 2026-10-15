import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePrice, formatMinor, formatPrice } from '../../src/lib/money.ts';
import { slugify, suggestSlug, slugProblem, SLUG_RE } from '../../src/lib/slug.ts';
import { parsePasted, guessKind } from '../../src/lib/paste.ts';

test('prices: shekels typed by a person become agorot without float maths', () => {
  const ok = { '62': 6200, '62.5': 6250, '62.50': 6250, '62,50': 6250, '0.1': 10, '0.07': 7, '19.99': 1999, '1,250': 125000, '1.250,50': 125050, '1,250.5': 125050, '₪ 48': 4800, '48 ש"ח': 4800, '48 ש״ח': 4800,
    ' 12 ': 1200, '0': 0, '007': 700, '1000000': 100000000, '4.35': 435, '8.2': 820, '1.15': 115, '33.33': 3333 };
  for (const [k, v] of Object.entries(ok)) assert.equal(parsePrice(k), v, k);
  for (const bad of ['abc', '-5', '12.345', '1,2,3', '.', '12..5', '1000001', '₪', '12 13', '1e3', '٣', '12.500', '1,250,50', '1.250.50']) assert.equal(parsePrice(bad), 'invalid', bad);
  assert.equal(parsePrice(''), null); assert.equal(parsePrice('   '), null);
  // every amount up to 1,000.00 survives a round trip (this is where float maths would slip)
  for (let m = 0; m <= 100000; m += 1) { const back = parsePrice(formatMinor(m)); if (back !== m) assert.fail(`round trip ${m} → ${formatMinor(m)} → ${back}`); }
  assert.equal(formatMinor(6200), '62'); assert.equal(formatMinor(6205), '62.05'); assert.equal(formatMinor(null), ''); assert.equal(formatPrice(6250), '₪62.50');
});

test('menu address: suggestions always fit the database rule', () => {
  assert.equal(slugify('Café Olea & Sons'), 'cafe-olea-and-sons');
  assert.equal(slugify('  --Hello__World--  '), 'hello-world');
  assert.equal(suggestSlug('', 'פסטה בסטה'), 'psta-bsta');
  assert.equal(suggestSlug("Dana's Kitchen", 'המטבח של דנה'), 'danas-kitchen');
  for (const n of ['A', 'ab', 'x'.repeat(80), 'שלום עולם', 'Bar 51', 'קפה']) { const s = suggestSlug(n, n); assert.ok(SLUG_RE.test(s), n + ' → ' + s); }
  assert.equal(suggestSlug('!!!', '???'), '');
  assert.equal(slugProblem('ab'), 'short'); assert.equal(slugProblem('-abc'), 'edges'); assert.equal(slugProblem('Abc'), 'chars'); assert.equal(slugProblem('cafe-olea'), '');
});

test('pasted list: categories, prices, descriptions and the problems a person must see', () => {
  const cats = parsePasted(`חומוס | 32 | עם גרגרים\n# עיקריות\nשניצל | 68.5\nדג היום || מחיר לפי משקל\n | 12\nסלט | שתים עשרה\n\n# Wine\nMerlot | 140 | Galilee | 2021`, 'תפריט');
  assert.equal(cats.length, 3);
  assert.deepEqual([cats[0].name, cats[0].implicit, cats[0].items[0].name, cats[0].items[0].price, cats[0].items[0].description], ['תפריט', true, 'חומוס', 3200, 'עם גרגרים']);
  assert.deepEqual(cats[1].items.map((i) => [i.name, i.price, i.problem]), [['שניצל', 6850, ''], ['דג היום', null, ''], ['', 1200, 'no_name'], ['סלט', null, 'bad_price']]);
  assert.equal(cats[1].items[1].description, 'מחיר לפי משקל');
  assert.equal(cats[2].kind, 'wine'); assert.equal(cats[2].items[0].description, 'Galilee | 2021');
  assert.equal(guessKind('קינוחים'), 'dessert'); assert.equal(guessKind('שתייה קלה'), 'drinks'); assert.equal(guessKind('בירות מהחבית'), 'beer'); assert.equal(guessKind('Mains'), 'food');
  assert.deepEqual(parsePasted('', 'x'), []); assert.deepEqual(parsePasted('#\n#  \n', 'x'), []);
});

// ---- version 2: the dashboard's sums, "what changed", and how names are compared
import { weekChange, share, sparkPaths, barHeights, peakHours, diffSnapshots, norm } from '../../src/lib/sums.ts';

test('dashboard: change against last week, shares, and the busiest hours', () => {
  assert.equal(weekChange(120, 100), 20); assert.equal(weekChange(50, 100), -50); assert.equal(weekChange(100, 100), 0);
  assert.equal(weekChange(7, 3), 133); assert.equal(weekChange(0, 40), -100);
  assert.equal(weekChange(12, 0), null, 'nothing to compare with: no arrow, not "infinity"');
  assert.equal(share(1, 3), 33); assert.equal(share(2, 3), 67); assert.equal(share(0, 0), 0); assert.equal(share(5, 0), 0); assert.equal(share(7, 5), 100, 'never above 100');
  const day = new Array(24).fill(0); day[12] = 30; day[13] = 44; day[14] = 12; day[20] = 50;
  assert.deepEqual(peakHours(day), [12, 15], 'the busiest three hours in a row, not the single tallest bar');
  const late = new Array(24).fill(0); late[23] = 9; late[0] = 8; late[1] = 2;
  assert.deepEqual(peakHours(late), [23, 2], 'a stretch may pass midnight');
  assert.equal(peakHours(new Array(24).fill(0)), null);
  assert.deepEqual(peakHours([5]), [0, 3], 'a short row does not break it');
});

test('dashboard: bars and the 30-day line stay inside their boxes', () => {
  assert.deepEqual(barHeights([0, 5, 10]), [0, 0.5, 1]);
  assert.deepEqual(barHeights([0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(barHeights([1, 1000]), [0.06, 1], 'a small number stays visible');
  assert.deepEqual(barHeights([]), []);
  const p = sparkPaths([0, 10, 5], 300, 64);
  assert.equal(p.line, 'M0 63 L150 2 L300 32.5');
  assert.equal(p.area, 'M0 63 L150 2 L300 32.5 L300 64 L0 64 Z');
  assert.deepEqual(p.last, [300, 32.5]);
  for (const vals of [[0, 0, 0], [3], [1e6, 2, 0, 7], new Array(30).fill(4)]) {
    const q = sparkPaths(vals, 300, 64);
    for (const [, x, y] of q.line.matchAll(/[ML]([\d.]+) ([\d.]+)/g)) { assert.ok(Number(x) >= 0 && Number(x) <= 300, 'x ' + x); assert.ok(Number(y) >= 2 && Number(y) <= 63, 'y ' + y); }
    assert.ok(!/NaN|Infinity/.test(q.line + q.area));
  }
  assert.deepEqual(sparkPaths([], 300, 64), { line: '', area: '', last: [0, 63] });
});

test('what changed since the last publish: dishes, look, order; "sold out" alone is not a change', () => {
  const item = (id, name, extra = {}) => ({ id, name: { he: name, en: '' }, price: 1000, available: true, asset: { state: 'none' }, ...extra });
  const snap = (cats, theme = { accent: '#9A5238', surface: 'oak' }) => ({ business: { name: { he: 'א', en: '' } }, theme, locale: { default: 'he', langs: ['he'] }, categories: cats });
  const base = snap([{ id: 'c1', name: { he: 'עיקריות' }, kind: 'food', scene: 'auto', items: [item('a', 'חומוס'), item('b', 'סלט')] }]);
  const none = { added: 0, removed: 0, changed: 0, look: false, order: false };
  assert.deepEqual(diffSnapshots(base, structuredClone(base)), none);
  const soldOut = snap([{ ...base.categories[0], items: [item('a', 'חומוס', { available: false }), item('b', 'סלט')] }]);
  assert.deepEqual(diffSnapshots(base, soldOut), none, 'sold out reaches guests without publishing');
  const edited = snap([{ ...base.categories[0], items: [item('a', 'חומוס הבית'), item('b', 'סלט'), item('c', 'פסטה')] }]);
  assert.deepEqual(diffSnapshots(base, edited), { added: 1, removed: 0, changed: 1, look: false, order: true });
  const removed = snap([{ ...base.categories[0], items: [item('b', 'סלט')] }]);
  assert.deepEqual(diffSnapshots(base, removed), { added: 0, removed: 1, changed: 0, look: false, order: true });
  const swapped = snap([{ ...base.categories[0], items: [item('b', 'סלט'), item('a', 'חומוס')] }]);
  assert.deepEqual(diffSnapshots(base, swapped), { added: 0, removed: 0, changed: 0, look: false, order: true });
  assert.deepEqual(diffSnapshots(base, snap(base.categories, { accent: '#2f6b4a', surface: 'oak' })), { ...none, look: true });
  const illustrated = snap([{ ...base.categories[0], items: [item('a', 'חומוס', { asset: { state: 'stock', id: 'hummus' } }), item('b', 'סלט')] }]);
  assert.equal(diffSnapshots(base, illustrated).changed, 1, 'an illustration is a change guests would see');
  const moved = snap([{ ...base.categories[0], items: [item('b', 'סלט')] }, { id: 'c2', name: { he: 'ראשונות' }, kind: 'food', scene: 'auto', items: [item('a', 'חומוס')] }]);
  assert.deepEqual(diffSnapshots(base, moved), { added: 0, removed: 0, changed: 1, look: false, order: true }, 'a dish moved to another section');
});

test('scanner: two names are the same dish whatever the case, the points and the punctuation', () => {
  assert.equal(norm('  Margherita!  '), 'margherita');
  assert.equal(norm('שַׁקְשׁוּקָה'), norm('שקשוקה'), 'Hebrew points do not count');
  assert.equal(norm('Fish & Chips'), norm('fish chips'));
  assert.equal(norm('סלט-קיסר'), norm('סלט  קיסר'));
  assert.notEqual(norm('סלט קיסר'), norm('סלט יווני'));
  assert.equal(norm(''), ''); assert.equal(norm(null), ''); assert.equal(norm('—'), '');
});
