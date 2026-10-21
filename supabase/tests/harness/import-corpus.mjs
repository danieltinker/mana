// The importer's parity corpus: every call the contracts' own import tests make to the importer's functions, recorded.
// Every contract test file that imports ../src/import.ts (import*.test.ts, a review's file such as review3.test.ts: a new
// one joins by itself) runs unchanged in a child process, its import of ../src/import.ts pointed at a shim that records
// each call's arguments (as JSON) and calls the real function. A file that finds its way by its own location
// (import.meta.url: old-safari.test.ts reads ../src) cannot run from the shim's folder and is left out.
// supabase/tests/import-twins.test.mjs then runs the SQL twins on exactly those inputs and compares the answers with the
// contracts'.
//
// The fuzz (import-fuzz.test.ts) plans thousands of random drafts. Each of its runs is marked (`fuzz(seed, n, kind)`):
// a run of one draft (the seeds QA found) is recorded whole; of a larger run, one call in FUZZ_EVERY, the same ones on
// every machine. MANA_TWINS_FULL=1 records every call (about 10 000 distinct plans; twenty minutes on a busy machine).
// A call a full-size run found the twins differing on is pinned whole in ../fixtures/pinned-calls.json (with why), so
// the sampled corpus always has it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CONTRACTS = path.join(ROOT, 'packages/contracts');
export const RECORDED = ['importKey', 'validateDraft', 'draftExceptions', 'validateDecisions', 'validateSaveDraft', 'validateApplyImport', 'planApply',
  'readerNoteIssues'];

export const FUZZ_EVERY = 8;

/** Runs the contracts' importer tests with the recording shim; returns { [fn]: argument lists }. */
export function recordContractCalls({ full = process.env.MANA_TWINS_FULL === '1' } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mana-import-corpus-'));
  const real = pathToFileURL(path.join(CONTRACTS, 'src/import.ts')).href;
  const out = path.join(dir, 'calls.json');
  fs.writeFileSync(path.join(dir, 'shim.ts'), [
    `import fs from 'node:fs';`,
    `import * as real from ${JSON.stringify(real)};`,
    `export * from ${JSON.stringify(real)};`,
    `const calls: Record<string, unknown[]> = {};`,
    `let every = 1, seen = 0;`,
    `export const __corpusMark = (n: number): void => { every = n > 1 && !${full} ? ${FUZZ_EVERY} : 1; seen = 0; };`,
    `const keep = (name: string, args: unknown[]) => {`,
    `  if (every > 1 && seen++ % every !== 0) return;`,
    `  try { (calls[name] ??= []).push(JSON.parse(JSON.stringify(args))); } catch { /* not JSON */ }`,
    `};`,
    `process.on('exit', () => fs.writeFileSync(${JSON.stringify(out)}, JSON.stringify(calls)));`,
    ...RECORDED.map((n) => `export const ${n} = ((...a: unknown[]) => { keep('${n}', a); return (real.${n} as (...x: unknown[]) => unknown)(...a); }) as typeof real.${n};`),
  ].join('\n'));
  const files = fs.readdirSync(path.join(CONTRACTS, 'test')).filter((f) => {
    if (!/\.test\.ts$/.test(f)) return false;
    const src = fs.readFileSync(path.join(CONTRACTS, 'test', f), 'utf8');
    return src.includes(`from '../src/import.ts'`) && !src.includes('import.meta.url');
  }).sort();
  if (files.length === 0) throw new Error('no contract import tests found');
  const calls = {};
  for (const file of files) {
    const src = fs.readFileSync(path.join(CONTRACTS, 'test', file), 'utf8');
    const shim = JSON.stringify(pathToFileURL(path.join(dir, 'shim.ts')).href);
    let copy = src.replace(/from '(\.\.?\/[^']+)'/g, (_, rel) => {
      const abs = path.resolve(path.join(CONTRACTS, 'test'), rel);
      if (abs === path.join(CONTRACTS, 'src/import.ts')) return `from ${shim}`;
      return `from ${JSON.stringify(pathToFileURL(abs).href)}`;
    });
    // each fuzz run marked: fuzz(seed, n, …) → (__corpusMark(n), fuzz(seed, n, …))
    const marked = copy.replace(/\bfuzz\((\w+), (\w+), ([^()]*?)\)/g, (_, seed, n, rest) => `(__corpusMark(${n}), fuzz(${seed}, ${n}, ${rest}))`);
    if (marked !== copy) copy = `import { __corpusMark } from ${shim};\n` + marked;
    fs.writeFileSync(path.join(dir, file), copy);
    fs.rmSync(out, { force: true });
    // run directly (node:test runs a file's tests when it is executed), outside this process's own test runner
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, [path.join(dir, file)], { encoding: 'utf8', cwd: CONTRACTS, env, maxBuffer: 64 * 1024 * 1024 });
    if (r.status !== 0) throw new Error(`the contracts' ${file} failed under the recording shim:\n` + (r.stdout + r.stderr).slice(-3000));
    for (const [fn, list] of Object.entries(JSON.parse(fs.readFileSync(out, 'utf8')))) (calls[fn] ??= []).push(...list);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  const pinned = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/pinned-calls.json'), 'utf8'));
  for (const fn of RECORDED) for (const { args } of pinned[fn] ?? []) (calls[fn] ??= []).push(args);
  return calls;
}
