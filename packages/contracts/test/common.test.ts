import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, hasName, isBlank, isBlankChar, isStorableText, stripBlank, textLength } from '../src/common.ts';
import { isLocalDate } from '../src/time.ts';

test('the blank characters, one by one', () => {
  const blank = [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680, 0x180e, 0x2000, 0x2005, 0x200a, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f,
    0x2028, 0x2029, 0x202a, 0x202e, 0x202f, 0x205f, 0x2060, 0x2064, 0x2066, 0x2069, 0x206a, 0x206f, 0x3000, 0xfeff,
    // the review's second round: soft hyphen, CGJ, ALM, Hangul fillers, braille blank, variation selectors, tags
    0xad, 0x34f, 0x61c, 0x115f, 0x1160, 0x3164, 0xffa0, 0x2800, 0xfe00, 0xfe0f, 0xe0000, 0xe0001, 0xe0020, 0xe007f];
  for (const cp of blank) assert.equal(isBlankChar(String.fromCodePoint(cp)), true, cp.toString(16));
  for (const cp of [0x41, 0x5d0, 0x2d, 0x5f, 0x2065, 0x2010, 0x1f600, 0x30, 0x2801, 0xfe10, 0xe0080, 0xe0100, 0x1161, 0x5be])
    assert.equal(isBlankChar(String.fromCodePoint(cp)), false, cp.toString(16));
});

test('an emoji at the end of a name keeps its variation selector and its flag tags', () => {
  assert.equal(stripBlank('Coffee ☕\uFE0F '), 'Coffee ☕\uFE0F');
  assert.equal(stripBlank('Coffee ☕\uFE0F\u200B\uFE0F\u00A0'), 'Coffee ☕\uFE0F', 'only the selectors right after it');
  const england = '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}';
  assert.equal(stripBlank(`Fish & chips ${england}\u2800`), `Fish & chips ${england}`);
  assert.equal(stripBlank('\uFE0F\u{E0067}Tea'), 'Tea', 'at the start they belong to nothing');
  assert.equal(stripBlank('Tea\u00AD\u034F\u061C\u3164'), 'Tea');
  assert.equal(isBlank('\uFE0F\u{E007F}\u2800\u3164\u115F\uFFA0\u00AD'), true);
  assert.equal(isBlank('☕\uFE0F'), false);
});

test('strip at the edges only; a name of nothing but blanks is no name', () => {
  assert.equal(stripBlank('‏  שקשוקה ﻿​'), 'שקשוקה');
  assert.equal(stripBlank('Fish & chips'), 'Fish & chips', 'inner spaces stay');
  assert.equal(isBlank('  　﻿​‏\t\n'), true);
  assert.equal(isBlank('​.'), false);
  assert.deepEqual(cleanText({ he: '‫ טוסט‬', en: ' Toast ' }), { he: 'טוסט', en: 'Toast' });
  assert.equal(hasName({ he: '‎', en: ' ' }), false);
  assert.equal(hasName({ he: '', en: ' x ' }), true);
});

test('lengths count code points, as char_length does; text PostgreSQL cannot store is told apart', () => {
  const burger = String.fromCodePoint(0x1f354);
  assert.equal(textLength(''), 0);
  assert.equal(textLength('שניצל'), 5);
  assert.equal(textLength(burger.repeat(3)), 3);
  assert.equal(textLength(`a${String.fromCharCode(0xd83c)}b`), 3, 'a lone surrogate is one');
  assert.equal(isStorableText(`Soup ${burger} ☕`), true);
  assert.equal(isStorableText(`So${String.fromCharCode(0)}up`), false);
  assert.equal(isStorableText(`x${String.fromCharCode(0xd83c)}`), false);
  assert.equal(isStorableText(`${String.fromCharCode(0xdf54)}x`), false);
});

test('isBlank says exactly what stripBlank leaves', () => {
  const samples = ['', ' ', 'a', ` ${String.fromCodePoint(0xfe0f)}`, `${String.fromCodePoint(0x2615, 0xfe0f)} `, String.fromCodePoint(0x200b, 0xa0, 0x3164), ' x '];
  for (const s of samples) assert.equal(isBlank(s), stripBlank(s) === '', JSON.stringify(s));
});

test('a local date is a real date between 2000 and 2100', () => {
  assert.equal(isLocalDate('2026-10-16'), true);
  assert.equal(isLocalDate('2000-01-01') && isLocalDate('2100-12-31'), true);
  assert.equal(isLocalDate('1999-12-31'), false);
  assert.equal(isLocalDate('2101-01-01'), false);
  assert.equal(isLocalDate('2026-02-30'), false);
});
