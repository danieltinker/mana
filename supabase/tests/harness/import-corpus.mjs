// The importer's parity corpus: every call the contracts' own import tests make to the importer's functions, recorded.
// Every contract test file named import*.test.ts (so a new review's file joins by itself) runs unchanged in a child
// process, its import of ../src/import.ts pointed at a shim that records each call's arguments (as JSON) and calls the
// real function. supabase/tests/import-twins.test.mjs then runs
// the SQL twins on exactly those inputs and compares the answers with the contracts'.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CONTRACTS = path.join(ROOT, 'packages/contracts');
export const RECORDED = ['importKey', 'validateDraft', 'draftExceptions', 'validateDecisions', 'validateSaveDraft', 'validateApplyImport', 'planApply'];

/** Runs packages/contracts/test/import*.test.ts with the recording shim; returns { [fn]: argument lists }. */
export function recordContractCalls() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mana-import-corpus-'));
  const real = pathToFileURL(path.join(CONTRACTS, 'src/import.ts')).href;
  const out = path.join(dir, 'calls.json');
  fs.writeFileSync(path.join(dir, 'shim.ts'), [
    `import fs from 'node:fs';`,
    `import * as real from ${JSON.stringify(real)};`,
    `export * from ${JSON.stringify(real)};`,
    `const calls: Record<string, unknown[]> = {};`,
    `const keep = (name: string, args: unknown[]) => { try { (calls[name] ??= []).push(JSON.parse(JSON.stringify(args))); } catch { /* not JSON */ } };`,
    `process.on('exit', () => fs.writeFileSync(${JSON.stringify(out)}, JSON.stringify(calls)));`,
    ...RECORDED.map((n) => `export const ${n} = ((...a: unknown[]) => { keep('${n}', a); return (real.${n} as (...x: unknown[]) => unknown)(...a); }) as typeof real.${n};`),
  ].join('\n'));
  const files = fs.readdirSync(path.join(CONTRACTS, 'test')).filter((f) => /^import.*\.test\.ts$/.test(f)).sort();
  if (files.length === 0) throw new Error('no contract import tests found');
  const calls = {};
  for (const file of files) {
    const src = fs.readFileSync(path.join(CONTRACTS, 'test', file), 'utf8');
    const copy = src.replace(/from '(\.\.?\/[^']+)'/g, (_, rel) => {
      const abs = path.resolve(path.join(CONTRACTS, 'test'), rel);
      if (abs === path.join(CONTRACTS, 'src/import.ts')) return `from ${JSON.stringify(pathToFileURL(path.join(dir, 'shim.ts')).href)}`;
      return `from ${JSON.stringify(pathToFileURL(abs).href)}`;
    });
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
  return calls;
}
