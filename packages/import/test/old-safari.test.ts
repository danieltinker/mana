// The readers run in the owner's browser too (paste and Wolt text are read there), and Safari and iOS 15 are among
// them: no regular-expression lookbehind (Safari before 16.4), no `Object.hasOwn` and no `crypto.randomUUID` (before
// 15.4). As in the contracts (test/old-safari.test.ts), old Safari's limits are a test. The scanner (Deno, on the
// server) is exempt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { work } from './old-safari.work.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, '../src');
const sources = fs.readdirSync(src).filter((n) => n.endsWith('.ts')).map((n) => [n, fs.readFileSync(path.join(src, n), 'utf8')] as const);

test('old Safari: no lookbehind, no Object.hasOwn, no crypto.randomUUID anywhere in the readers', () => {
  assert.ok(sources.length >= 10);
  for (const [name, text] of sources) {
    assert.ok(!/\(\?<[=!]/.test(text), `${name}: a lookbehind`);
    assert.ok(!/Object\.hasOwn\b/.test(text), `${name}: Object.hasOwn`);
    assert.ok(!/randomUUID/.test(text), `${name}: crypto.randomUUID (the contracts' newUuid has the fallback)`);
    assert.ok(!/\.at\(|findLast|structuredClone/.test(text), `${name}: at(), findLast or structuredClone`);
  }
});

test('old Safari: every reader module loads and reads exactly as here, without lookbehind, Object.hasOwn or randomUUID', () => {
  const r = spawnSync(process.execPath, [path.join(here, 'old-safari.child.ts')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  const child = JSON.parse(r.stdout.trim().split('\n').pop()!) as { modules: number; out: unknown };
  assert.equal(child.modules, sources.length);
  assert.deepEqual(child.out, JSON.parse(JSON.stringify(work())));
});
