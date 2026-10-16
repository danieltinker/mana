#!/usr/bin/env node
/* The guard on Mana's settings (docs/environments.md), fast and offline:  node --test tools/check-config.mjs
   (tools/test-all.mjs runs it as the "config" suite).
   - production (config.js) still points at halom-studio and halom.io's short links, schema 1;
   - demo (config/demo.js) points at `mana`, schema 2, and its QR codes never open production's short links;
   - local (config/local.js) is written by npm run dev:local, git-ignored and never committed;
   - the keys are publishable keys, not JWTs, each on the line .gitleaksignore names;
   - no file in the repository holds a secret key (sb_secret_…) or a service_role key;
   - the build picks the settings by MANA_ENV and the published build is production's. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CONFIG_FILES, configProblems, envOf, isJwt, isPublishableKey, jwtRole, KEY_LINE, keyLine, localConfigText, readConfig, realtimeOf,
  retargetCsp, ROOT, schemaOf,
} from './env.mjs';

const at = (f) => path.join(ROOT, f);
const ORIGINS = ['http://localhost:4180', 'http://192.168.1.20:4181'];
/* written out here on purpose: changing production's address takes this file and tools/env.mjs, both (the cutover) */
const HALOM_STUDIO = 'https://zemdhczqlhkabfwxccqq.supabase.co', MANA = 'https://hhmjcudeiiycwqqklksc.supabase.co';
/* a local stack's address and anon key, as the simulator's stack hands them out */
const LOCAL = { apiUrl: 'http://127.0.0.1:57521', anonKey: jwt({ role: 'anon', iss: 'mana-sim-local' }) };

test('production (config.js) is halom-studio, schema 1, with the short links printed QR codes carry', () => {
  const cfg = readConfig(at(CONFIG_FILES.production));
  assert.equal(CONFIG_FILES.production, 'config.js', 'production is the root config.js, served at /mana/config.js');
  assert.equal(cfg.supabaseUrl, HALOM_STUDIO);
  assert.equal(cfg.shortBase, 'https://halom.io/m/');
  assert.equal(cfg.shortLive, true);
  assert.ok(cfg.schema === undefined || cfg.schema === 1, 'schema absent or 1');
  assert.ok(cfg.env === undefined || cfg.env === 'production', 'env absent or production');
  assert.deepEqual([envOf(cfg), schemaOf(cfg), realtimeOf(cfg)], ['production', 1, true]);
  assert.deepEqual(configProblems('production', cfg), []);
});

test('demo (config/demo.js) is the database mana, schema 2, Realtime on', () => {
  const cfg = readConfig(at(CONFIG_FILES.demo));
  assert.equal(cfg.supabaseUrl, MANA);
  assert.deepEqual([cfg.env, cfg.schema, cfg.realtime], ['demo', 2, true]);
  for (const origin of ORIGINS) assert.deepEqual(configProblems('demo', readConfig(at(CONFIG_FILES.demo), { origin }), { origin }), [], origin);
});

test('a demo QR code opens the server that serves the demo, never production\'s short links', () => {
  for (const origin of ORIGINS) {
    const cfg = readConfig(at(CONFIG_FILES.demo), { origin });
    assert.equal(cfg.shortBase, origin + '/m/');
    assert.equal(cfg.shortLive, true, 'the demo server routes /m/<slug> (tools/serve-site.mjs), so its short links work');
    assert.doesNotMatch(cfg.shortBase, /halom\.io/);
  }
  const wrong = { ...readConfig(at(CONFIG_FILES.demo)), shortBase: 'https://halom.io/m/' };
  assert.match(configProblems('demo', wrong).join(), /production's short links/);
});

test('the keys are publishable keys, not JWTs', () => {
  for (const env of ['production', 'demo']) {
    const k = readConfig(at(CONFIG_FILES[env])).supabaseKey;
    assert.ok(isPublishableKey(k), env + ': sb_publishable_…');
    assert.ok(!isJwt(k), env + ': not a JWT');
  }
  assert.notEqual(readConfig(at(CONFIG_FILES.production)).supabaseKey, readConfig(at(CONFIG_FILES.demo)).supabaseKey);
  assert.match(configProblems('demo', { ...readConfig(at(CONFIG_FILES.demo)), supabaseKey: jwt({ role: 'anon' }) }).join(), /is a JWT/);
});

test('every config keeps its key on the line .gitleaksignore names, and every entry there points at a publishable key', () => {
  for (const f of [CONFIG_FILES.production, CONFIG_FILES.demo]) assert.equal(keyLine(fs.readFileSync(at(f), 'utf8')), KEY_LINE, f);
  assert.equal(keyLine(localConfigText(LOCAL)), KEY_LINE, 'config/local.js');
  const entries = fs.readFileSync(at('.gitleaksignore'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  for (const f of [CONFIG_FILES.production, CONFIG_FILES.demo]) assert.ok(entries.includes(`${f}:generic-api-key:${KEY_LINE}`), f + ' is listed');
  for (const e of entries) {
    const m = /^(.+):([a-z0-9-]+):(\d+)$/.exec(e);
    assert.ok(m, 'an entry is file:rule:line: ' + e);
    const line = fs.readFileSync(at(m[1]), 'utf8').split('\n')[Number(m[3]) - 1] || '';
    assert.match(line, /sb_publishable_[A-Za-z0-9_-]{16,}/, `${e} points at a line without a publishable key`);
  }
});

test('local: written from the stack, schema 2, no Realtime, git-ignored and never committed', () => {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'mana-local-config-')), f = path.join(dir, 'local.js');
  try {
    fs.writeFileSync(f, localConfigText(LOCAL));
    for (const origin of ORIGINS) {
      const cfg = readConfig(f, { origin });
      assert.deepEqual([cfg.env, cfg.schema, cfg.realtime, cfg.supabaseUrl, cfg.shortBase], ['local', 2, false, LOCAL.apiUrl, origin + '/m/']);
      assert.deepEqual(configProblems('local', cfg, { origin }), []);
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  assert.throws(() => localConfigText({ ...LOCAL, apiUrl: MANA }), /not a local stack address/);
  assert.throws(() => localConfigText({ ...LOCAL, anonKey: jwt({ role: 'service_role' }) }), /anon key/);
  assert.equal(git(['check-ignore', '-q', CONFIG_FILES.local]).status, 0, 'config/local.js is git-ignored');
  assert.equal(git(['ls-files', '--', CONFIG_FILES.local]).stdout, '', 'config/local.js is not tracked');
  if (fs.existsSync(at(CONFIG_FILES.local))) assert.deepEqual(configProblems('local', readConfig(at(CONFIG_FILES.local))), [], 'the config/local.js on disk');
});

test('no file in the repository holds a secret key or a service_role key', () => {
  const r = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  assert.equal(r.status, 0, 'git ls-files: the scan needs a git checkout');
  const files = r.stdout.split('\0').filter(Boolean);
  assert.ok(files.length > 100, 'the repository\'s files were listed');
  const found = [];
  let scanned = 0;
  for (const f of files) { const s = readText(at(f)); if (s === null) continue; scanned++; for (const what of secretsIn(s)) found.push(`${f}: ${what}`); }
  assert.ok(scanned > 100, 'text files were read');
  assert.deepEqual(found, []);
});

test('the secret scan finds what it looks for (built here at run time, so this file holds none)', () => {
  assert.deepEqual(secretsIn(`const k = '${'sb_secret_' + 'Ab1'.repeat(10)}';`), ['a secret key (sb_secret_…)']);
  assert.deepEqual(secretsIn(`x = "${jwt({ role: 'service_role' })}"`), ['a service_role JWT']);
  assert.deepEqual(secretsIn(`SUPABASE_SERVICE_ROLE_KEY=${'z9'.repeat(16)}`), ['a service role key assignment']);
  assert.deepEqual(secretsIn(`const anon = "${jwt({ role: 'anon' })}"; grant select to service_role; Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`), []);
});

test('the build picks the settings by MANA_ENV, and the published build is production\'s', () => {
  const sh = fs.readFileSync(at('tools/build-site.sh'), 'utf8');
  assert.match(sh, /MANA_ENV="\$\{MANA_ENV:-production\}"/, 'the default is production');
  for (const [env, f] of Object.entries(CONFIG_FILES)) assert.match(sh, new RegExp(`\\n\\s*${env}\\)\\s+CONFIG=${f.replace(/[./]/g, '\\$&')} ;;`), env);
  assert.match(sh, /cp "\$CONFIG" "\$OUT\/config\.js"/);
  assert.match(sh, /node tools\/site-env\.mjs "\$OUT" "\$MANA_ENV"/);
  const yml = fs.readFileSync(at('.github/workflows/pages.yml'), 'utf8');
  assert.deepEqual([...yml.matchAll(/MANA_ENV:\s*(\S+)/g)].map((m) => m[1]), ['production'], 'pages.yml builds production, and only production');
});

test('a demo build\'s pages may talk to mana, and no longer to halom-studio', () => {
  const page = fs.readFileSync(at('brand/site/index.html'), 'utf8');
  assert.match(page, /Content-Security-Policy" content="[^"]*https:\/\/zemdhczqlhkabfwxccqq\.supabase\.co/, 'production\'s page names halom-studio');
  const demo = retargetCsp(page, HALOM_STUDIO, MANA);
  assert.match(demo, /Content-Security-Policy" content="connect-src 'self' blob: https:\/\/hhmjcudeiiycwqqklksc\.supabase\.co; frame-src 'self'"/);
  assert.ok(!demo.includes('zemdhczqlhkabfwxccqq'));
  assert.equal(demo.length - page.length, MANA.length - HALOM_STUDIO.length, 'nothing else on the page changed');
});

// ---------------------------------------------------------------- helpers
function git(args) { return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }); }

/** A JWT with this payload, signed with a throwaway secret (the scan reads claims, never checks signatures). */
function jwt(payload) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ iss: 'check-config', iat: 1760000000, ...payload })}`;
  return body + '.' + crypto.createHmac('sha256', crypto.randomBytes(16)).update(body).digest('base64url');
}

/** The file's text, or null for a binary file (a NUL byte in its first 8 KB) or one that is gone. */
function readText(file) {
  let fd; try { fd = fs.openSync(file, 'r'); } catch { return null; }
  try {
    const head = Buffer.alloc(8192), n = fs.readSync(fd, head, 0, head.length, 0);
    if (head.subarray(0, n).includes(0)) return null;
  } finally { fs.closeSync(fd); }
  return fs.readFileSync(file, 'utf8');
}

/** What secret-looking things `s` holds. A role named service_role in SQL or a variable read from the environment is not one. */
function secretsIn(s) {
  const out = [];
  if (/sb_secret_[A-Za-z0-9_-]{8,}/.test(s)) out.push('a secret key (sb_secret_…)');
  for (const m of s.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g)) if (jwtRole(m[0]) === 'service_role') { out.push('a service_role JWT'); break; }
  if (/\b(?:SUPABASE_)?SERVICE_?ROLE_?KEY\b["']?\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}/i.test(s)) out.push('a service role key assignment');
  return out;
}
