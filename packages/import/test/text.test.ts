import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMPORT_TEXT_MAX } from '@mana/contracts';
import { bilingual, clip, cleanLine, descShaped, headingShaped, mainLang, scriptOf, sourceLines } from '../src/text.ts';

const cp = String.fromCodePoint;

test('cleanLine: direction marks and zero-width characters go; every space is one space', () => {
  assert.equal(cleanLine(`${cp(0x200f)}64.00${cp(0xa0)}₪`), '64.00 ₪');
  assert.equal(cleanLine(`\tSchnitzel${cp(0x200b)}  ${cp(0x2009)} 64 `), 'Schnitzel 64');
  assert.equal(cleanLine(`${cp(0xfeff)}${cp(0x202b)}שניצל${cp(0x202c)}`), 'שניצל');
});

test('sourceLines: numbered from 1, any line break, at most IMPORT_TEXT_MAX characters cut at a line end', () => {
  const { lines } = sourceLines(`a\r\nb\rc${cp(0x2028)}d`);
  assert.deepEqual(lines, [{ n: 1, text: 'a' }, { n: 2, text: 'b' }, { n: 3, text: 'c' }, { n: 4, text: 'd' }]);
  const long = `${'Dish 10\n'.repeat(IMPORT_TEXT_MAX / 8)}Last 99\n`;
  const r = sourceLines(long);
  assert.equal(r.truncated, true);
  assert.ok(r.lines.every((l) => l.text === '' || l.text === 'Dish 10'), 'no half line');
  assert.equal(sourceLines('').lines.length, 1);
});

test('scriptOf, mainLang, bilingual', () => {
  assert.equal(scriptOf('שניצל'), 'he');
  assert.equal(scriptOf('Pad Thai'), 'en');
  assert.equal(scriptOf('42 ₪'), null);
  assert.equal(scriptOf('7UP קולה'), 'en', 'the first letter decides, as dir="auto"');
  assert.equal(mainLang(['שניצל', 'Cola', 'המבורגר']), 'he');
  assert.equal(mainLang(['Schnitzel', 'Burger']), 'en');
  assert.deepEqual(bilingual('שניצל / Schnitzel', 'he'), { he: 'שניצל', en: 'Schnitzel' });
  assert.deepEqual(bilingual('Schnitzel / שניצל', 'he'), { he: 'שניצל', en: 'Schnitzel' });
  assert.deepEqual(bilingual('Coke / Diet Coke', 'he'), { he: '', en: 'Coke / Diet Coke' });
  assert.deepEqual(bilingual('42', 'he'), { he: '42', en: '' }, 'no letters: the fallback language');
});

test('clip: never inside a surrogate pair, never a blank end', () => {
  assert.deepEqual(clip('abc', 5), { text: 'abc', clipped: false });
  assert.deepEqual(clip('ab cd', 3), { text: 'ab', clipped: true });
  const r = clip(`ab${cp(0x1f336)}cd`, 3);
  assert.equal(r.text, 'ab');
  assert.ok(r.text.length <= 3);
});

test('heading_shape and desc_shape', () => {
  for (const s of ['Mains', 'Hot drinks', 'מנות עיקריות', 'Kids menu!']) assert.ok(headingShaped(s), s);
  for (const s of ['Crispy, with lemon', 'Two eggs in a spicy tomato sauce', 'x'.repeat(41)]) assert.ok(!headingShaped(s), s);
  for (const s of ['Crispy, with lemon', 'Two eggs in tomato', 'Crispy chicken…', 'עם טחינה ופיתה', 'with lemon']) assert.ok(descShaped(s), s);
  for (const s of ['Schnitzel', 'Burger deluxe', 'Coke 0.5L']) assert.ok(!descShaped(s), s);
});
