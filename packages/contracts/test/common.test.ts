import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, hasName, isBlank, isBlankChar, stripBlank } from '../src/common.ts';

test('the blank characters, one by one', () => {
  const blank = [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x20, 0x85, 0xa0, 0x1680, 0x180e, 0x2000, 0x2005, 0x200a, 0x200b, 0x200c, 0x200d, 0x200e, 0x200f,
    0x2028, 0x2029, 0x202a, 0x202e, 0x202f, 0x205f, 0x2060, 0x2064, 0x2066, 0x2069, 0x3000, 0xfeff];
  for (const cp of blank) assert.equal(isBlankChar(String.fromCodePoint(cp)), true, cp.toString(16));
  for (const cp of [0x41, 0x5d0, 0x2d, 0x5f, 0x2065, 0x206a, 0x2010, 0x1f600, 0x30]) assert.equal(isBlankChar(String.fromCodePoint(cp)), false, cp.toString(16));
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
