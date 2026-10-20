// Safari and iOS 15 run the contracts (the live owner app's entry loads config.ts): no regular-expression lookbehind
// (Safari before 16.4); no `Object.hasOwn`, `crypto.randomUUID`, `Array.prototype.at` / `findLast` / `findLastIndex`,
// `String.prototype.at` or `structuredClone` (before 15.4). Old Safari's limits are a test, in two parts: the source text
// (the only check that sees a lookbehind written as a regular-expression literal, which the engine compiles without
// calling `RegExp`), and a child process that loads and runs every module with those built-ins removed and `RegExp`
// refusing a lookbehind pattern given to it as a string (as `new RegExp('…')` does).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasOwn, isStorableText, newUuid } from '../src/common.ts';
import { importKey } from '../src/import.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../src');
const sources = fs.readdirSync(src).filter((n) => n.endsWith('.ts')).map((n) => [n, fs.readFileSync(path.join(src, n), 'utf8')] as const);

test('old Safari, the text: no lookbehind (literal or string), Object.hasOwn, at(), findLast, structuredClone or bare randomUUID in src; config.ts imports nothing at run time', () => {
  for (const [name, text] of sources) {
    assert.ok(!/\(\?<[=!]/.test(text), `${name}: a lookbehind`);
    assert.ok(!/Object\.hasOwn\b/.test(text), `${name}: Object.hasOwn`);
    assert.ok(!/\.at\(/.test(text), `${name}: .at()`);
    assert.ok(!/\bfindLast(Index)?\b/.test(text), `${name}: findLast`);
    assert.ok(!/\bstructuredClone\b/.test(text), `${name}: structuredClone`);
    if (name !== 'common.ts') assert.ok(!/randomUUID\(\)/.test(text.replace(/^\s*\/?\*.*$/gm, '')), `${name}: crypto.randomUUID without the fallback`);
  }
  const config = sources.find(([n]) => n === 'config.ts')![1];
  assert.deepEqual(config.split('\n').filter((l) => /^\s*import\s/.test(l) && !/^\s*import\s+type\s/.test(l)), [], 'config.ts: only type imports');
});

test('old Safari, at run time: every module loads and runs with RegExp refusing a lookbehind string, and without Object.hasOwn, randomUUID, at(), findLast or structuredClone', () => {
  const r = spawnSync(process.execPath, [path.join(here, 'old-safari.child.ts')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim().split('\n').pop()!);
  assert.equal(out.modules, sources.length);
  assert.deepEqual(out.flags, ['demo', 2, false, 0]);
  assert.equal(out.draft, true);
  assert.equal(out.uuid, true, 'the fallback makes a version-4 uuid');
  assert.equal(out.event, true);
  assert.deepEqual(out.extra, ['field_not_allowed@props.toString'], 'own keys only, without Object.hasOwn');
  assert.deepEqual(out.keys, ['ציפס', 'ציפס', 'rock n roll', 'א ב']);
  assert.deepEqual(out.storable, [true, false, false, false, true]);
});

// the former regular expressions (with lookbehind), kept here only to prove the new code does exactly what they did
const OLD_UNSTORABLE = new RegExp('\\x00|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]');
const OLD_GERESH = new RegExp('[\\u05F3\\u05F4]|(?<=[\\u05D0-\\u05EA])[\\x22\\x27]', 'gu');
const NEW_GERESH = new RegExp('[\\u05F3\\u05F4]|([\\u05D0-\\u05EA])[\\x22\\x27]', 'gu');
const words = (alphabet: readonly string[], n: number): string[] => {
  let all = [''];
  const out = [''];
  for (let k = 0; k < n; k++) {
    all = all.flatMap((w) => alphabet.map((a) => w + a));
    out.push(...all);
  }
  return out;
};

test('isStorableText is the former expression on every string of up to 5 code units of its edge cases', () => {
  const alphabet = ['a', '\u0000', '\uD800', '\uDBFF', '\uDC00', '\uDFFF', 'א'];
  let n = 0;
  for (const s of words(alphabet, 5)) { assert.equal(isStorableText(s), !OLD_UNSTORABLE.test(s), JSON.stringify(s)); n++; }
  assert.equal(n, 19608);
  // the edges, by name: a lone high surrogate at the end, a lone low one at the start, a pair, a pair then a lone low
  assert.equal(isStorableText('Burger \uD83C'), false);
  assert.equal(isStorableText('\uDF54 Burger'), false);
  assert.equal(isStorableText('Burger 🍔'), true);
  assert.equal(isStorableText('🍔\uDF54'), false);
  assert.equal(isStorableText('\uD83C🍔'), false);
});

test('the geresh step of importKey is the former expression on every string of up to 5 of its edge cases', () => {
  const alphabet = ['א', 'ת', 'a', 'é', '\'', '"', '׳', '״', ' ', 'ּ'];
  let n = 0;
  for (const s of words(alphabet, 5)) {
    assert.equal(s.replace(NEW_GERESH, (_, letter: string | undefined) => letter ?? ''), s.replace(OLD_GERESH, ''), JSON.stringify(s));
    n++;
  }
  assert.equal(n, 111111);
  // a geresh after a letter that is not Hebrew stays (then separates words); after a Hebrew letter it goes
  assert.equal(importKey('Rock\'n\'roll'), 'rock n roll');
  assert.equal(importKey('ג\'חנון'), 'גחנון');
  assert.equal(importKey('e\'ג'), 'e ג');
  assert.equal(importKey('ב"ב'), 'בב');
  assert.equal(importKey('א\'\'ב'), 'א ב', 'only the first quote follows the letter');
});

test('newUuid without crypto.randomUUID, and hasOwn', () => {
  const proto = Object.getPrototypeOf(globalThis.crypto) as { randomUUID?: () => string };
  const saved = proto.randomUUID;
  try {
    delete proto.randomUUID;
    const ids = new Set(Array.from({ length: 200 }, () => newUuid()));
    assert.equal(ids.size, 200);
    for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  } finally {
    proto.randomUUID = saved;
  }
  assert.match(newUuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(hasOwn({ a: 1 }, 'a'), true);
  assert.equal(hasOwn({ a: 1 }, 'toString'), false);
  assert.equal(hasOwn(Object.create(null) as object, 'a'), false);
});
