#!/usr/bin/env node
/* Every test suite in the repository, one after another (never two browser suites at once: software WebGL on a small
   machine). Each suite runs in its own folder with its own command, exactly as it runs on its own; this only sequences
   them and prints one line per suite.

     npm test                  (= node tools/test-all.mjs)       every suite, the browser ones included (about 40 min)
     npm run test:fast         (= node tools/test-all.mjs --fast) no browser and no app stack: the settings guard, types, units, contracts, the schema's database tests,
                               and on Linux x64 the simulator's scenarios on its own small stack (about 2 min)
     node tools/test-all.mjs view-unit studio-e2e …               only the suites named

   Needs: `npm ci` at the root (the three apps), Chromium for the browser suites (CHROME, default
   /opt/pw-browsers/chromium-1194/chrome-linux/chrome), and for studio-e2e the local stack's binaries (apps/studio/test/README.md);
   sim and e2e use the same binaries, or fetch them once into sim/.stack/bin (sim/README.md).
   The brand suite (the product page) installs brand/'s own lock when brand/node_modules is missing (the root `npm ci`
   covers only the workspaces) and needs a built brand/site/land (node brand/tools/build-land.mjs).
   Exit 1 if any suite fails. Logs: test-results/<suite>.log (ignored by git). */
import { spawn } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/* name, folder, command, browser/stack (heavy) or not */
const SUITES = [
  ['names', '.', 'node --test tools/check-names.mjs', false],        // no listed name (the mock client's) in a file, a commit of this branch or its name
  ['config', '.', 'node --test tools/check-config.mjs', false],      // the settings per environment, and no secret key anywhere (docs/environments.md)
  ['tools', '.', "node --test 'tools/test/*.test.mjs'", false],      // the local server, the build's settings step, the demo's scenarios
  ['contracts-check', 'packages/contracts', 'npm run -s check', false],
  ['contracts', 'packages/contracts', 'npm test', false],
  ['db', 'supabase', 'npm test', false],        // a throwaway local PostgreSQL 16 (/usr/lib/postgresql/16/bin), about 15 s
  // the simulator on its local stack (PostgreSQL 16 + GoTrue + PostgREST), about 35 s: fast on Linux x64; elsewhere
  // heavy, because the GoTrue release is a Linux binary (sim/README.md)
  ['sim', 'sim', 'npm test', !(process.platform === 'linux' && process.arch === 'x64')],
  ['studio-check', 'apps/studio', 'npm run -s check', false],
  ['view-unit', 'apps/view', 'npm test', false],
  ['studio-unit', 'apps/studio', 'npm run -s test:unit', false],
  ['studio-i18n', 'apps/studio', 'node test/check-i18n.mjs', false],
  ['ops-unit', 'apps/ops', 'npm run -s test:unit', false],
  ['payments', 'payments', 'npm test', false],
  ['site-kit', 'site-kit', 'npm test', false],
  ['templates', '.', 'node templates/validate.mjs', false],
  ['mark', '.', 'node brand/tools/sync-mark.mjs --check', false],
  ['view-browser', 'apps/view', 'npm run -s test:browser', true],
  ['ops-e2e', 'apps/ops', 'npm run -s build && npm run -s test:e2e', true],
  ['studio-e2e', 'apps/studio', 'npm run -s build && npm run -s test:e2e', true],
  // a production build, then each app's entry on an iPhone's engine of iOS 15: no lookbehind, no Object.hasOwn, no
  // crypto.randomUUID (docs/environments.md, "Old phones")
  ['old-phones', '.', 'bash tools/build-site.sh && node --test tools/check-old-phones.mjs', true],
  // brand/ is outside the workspace with a lock of its own (qrcode, the fonts, opentype.js): installed here when missing
  ['brand', 'brand', '([ -d node_modules ] || npm ci --no-audit --no-fund --loglevel=error) && node tools/test-site.mjs', true],
  ['e2e', 'e2e', 'npm test', true],             // the browser on the simulator's stack (phase 0: one smoke test)
];
/* the seating contracts' tests run inside view-unit (apps/view/package.json names them) */

const args = process.argv.slice(2), fast = args.includes('--fast'), only = args.filter((a) => !a.startsWith('--'));
const pick = SUITES.filter(([n, , , heavy]) => (only.length ? only.includes(n) : !(fast && heavy)));
if (only.length) for (const n of only) if (!SUITES.some((s) => s[0] === n)) { console.error('no suite called ' + n + '; there are: ' + SUITES.map((s) => s[0]).join(', ')); process.exit(2); }
const LOGS = join(ROOT, 'test-results'); mkdirSync(LOGS, { recursive: true });

const run = (name, dir, cmd) => new Promise((done) => {
  const log = createWriteStream(join(LOGS, name + '.log')), t0 = Date.now(); let out = '';
  const ch = spawn('bash', ['-c', cmd], { cwd: join(ROOT, dir), env: process.env });
  for (const s of [ch.stdout, ch.stderr]) s.on('data', (d) => { log.write(d); out += d; if (out.length > 1e6) out = out.slice(-5e5); });
  ch.on('close', (code) => {
    log.end();
    const tap = (k) => { const m = [...out.matchAll(new RegExp('^# ' + k + ' (\\d+)$', 'gm'))]; return m.length ? m.reduce((a, x) => a + +x[1], 0) : null; };
    const own = /(\d+) passed, (\d+) failed/.exec(out);
    const counts = tap('pass') !== null ? `${tap('pass')} pass, ${tap('fail')} fail` : own ? `${own[1]} pass, ${own[2]} fail` : '';
    const note = /^# note: ([^(\n]+)/m.exec(out);        // a suite that checked less than it could says so (names: no list)
    done({ name, ok: code === 0, counts: [note && note[1].trim(), counts].filter(Boolean).join('; '), s: ((Date.now() - t0) / 1000).toFixed(0) });
  });
});

const results = [];
for (const [name, dir, cmd] of pick) {
  process.stdout.write(`· ${name.padEnd(13)} ${dir.padEnd(12)} ${cmd} … `);
  const r = await run(name, dir, cmd); results.push(r);
  console.log(`${r.ok ? 'ok' : 'FAILED'}${r.counts ? ' (' + r.counts + ')' : ''}  ${r.s} s`);
}
const bad = results.filter((r) => !r.ok);
console.log(bad.length ? `✗ ${bad.length} of ${results.length} suites failed: ${bad.map((r) => r.name).join(', ')} (logs in test-results/)` : `✓ ${results.length} suites passed`);
process.exit(bad.length ? 1 : 0);
