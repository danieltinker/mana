// The environment tools on a small fixture site (no build, no network beyond 127.0.0.1):
// tools/serve-site.mjs (halom.io's routes, byte ranges, headers), tools/site-env.mjs (the build's settings step) and
// tools/demo.mjs's scenario seam.   node --test tools/test/*.test.mjs   (tools/test-all.mjs: the "tools" suite)
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { localConfigText, ROOT } from '../env.mjs';
import { serveSite } from '../serve-site.mjs';
import { findScenario, scenarios } from '../demo.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mana-env-tools-'));
const SITE = path.join(tmp, 'site');
const CSP = (origin) => `<meta http-equiv="Content-Security-Policy" content="connect-src 'self' blob: ${origin}; frame-src 'self'">`;
const page = (title, origin = 'https://zemdhczqlhkabfwxccqq.supabase.co') => `<!doctype html><meta charset="utf-8">${CSP(origin)}<title>${title}</title>`;
const FILM = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251));
/* the back office's own policy (apps/ops/src/index.html): any Supabase project over https */
const OPS_CSP = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; connect-src \'self\' https://*.supabase.co; base-uri \'none\'">';
function writeSite(dir, config) {
  for (const [f, body] of Object.entries({ 'index.html': page('product'), 'guide/index.html': page('guide'), 'view/index.html': '<!doctype html><title>menu</title>',
    'ops/index.html': `<!doctype html>${OPS_CSP}<title>back office</title>`,
    'studio/index.html': '<!doctype html><title>owner</title>', 'img/film.mp4': FILM, 'config.js': config })) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), body);
  }
}
let s;
before(async () => {
  writeSite(SITE, fs.readFileSync(path.join(ROOT, 'config.js')));
  fs.writeFileSync(path.join(tmp, 'secret.txt'), 'outside the site');
  s = await serveSite({ site: SITE, port: 0 });
});
after(async () => { await s?.close(); fs.rmSync(tmp, { recursive: true, force: true }); });
const get = (p, headers = {}) => fetch(s.origin + p, { headers, redirect: 'manual' });

test('serve-site routes Mana as halom.io does: /mana/<path>, /m/<slug> to the guest menu, / and /mana to /mana/', async () => {
  assert.match(await (await get('/mana/')).text(), /<title>product<\/title>/);
  assert.match(await (await get('/mana/guide/')).text(), /<title>guide<\/title>/);
  for (const p of ['/m/cafe-demo', '/m/cafe-demo/', '/m/cafe-demo?t=1']) {
    const r = await get(p);
    assert.equal(r.status, 200, p);
    assert.match(await r.text(), /<title>menu<\/title>/, p);
  }
  for (const [p, to] of [['/', '/mana/'], ['/mana', '/mana/'], ['/mana/studio', '/mana/studio/'], ['/mana/studio?x=1', '/mana/studio/?x=1']]) {
    const r = await get(p);
    assert.deepEqual([r.status, r.headers.get('location')], [302, to], p);
  }
  assert.equal((await get('/mana/config.js')).headers.get('content-type'), 'text/javascript; charset=utf-8');
});

test('serve-site serves nothing outside the site, and answers 404 for what is not there', async () => {
  for (const p of ['/mana/../secret.txt', '/mana/%2e%2e/secret.txt', '/mana/..%2fsecret.txt', '/elsewhere/', '/m/a/b', '/mana/nothing.js']) {
    const r = await get(p);
    assert.equal(r.status, 404, p);
    assert.doesNotMatch(await r.text(), /outside the site/, p);
  }
  assert.equal((await fetch(s.origin + '/mana/', { method: 'POST' })).status, 405);
  const raw = await new Promise((done, fail) => http.get({ host: '127.0.0.1', port: s.port, path: '/mana/../secret.txt' }, (r) => {   // as sent, not normalised
    let b = ''; r.on('data', (d) => { b += d; }); r.on('end', () => done({ status: r.statusCode, body: b }));
  }).on('error', fail));
  assert.equal(raw.status, 404);
  assert.doesNotMatch(raw.body, /outside the site/);
});

test('serve-site answers byte ranges (Safari plays films only with them) and sets halom.io\'s headers', async () => {
  const whole = await get('/mana/img/film.mp4');
  assert.deepEqual([whole.status, whole.headers.get('accept-ranges'), whole.headers.get('content-type')], [200, 'bytes', 'video/mp4']);
  assert.deepEqual(Buffer.from(await whole.arrayBuffer()), FILM);
  for (const [range, from, to] of [['bytes=0-1', 0, 1], ['bytes=10-19', 10, 19], ['bytes=990-', 990, 999], ['bytes=-5', 995, 999]]) {
    const r = await get('/mana/img/film.mp4', { range });
    assert.deepEqual([r.status, r.headers.get('content-range')], [206, `bytes ${from}-${to}/1000`], range);
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), FILM.subarray(from, to + 1), range);
  }
  assert.equal((await get('/mana/img/film.mp4', { range: 'bytes=2000-' })).status, 416);
  const h = (await get('/m/x')).headers;
  assert.deepEqual([h.get('x-content-type-options'), h.get('referrer-policy'), h.get('permissions-policy')],
    ['nosniff', 'strict-origin-when-cross-origin', 'camera=(), microphone=(), geolocation=()']);
});

/** An anon JWT shaped like the stack's (the tools read its role, never its signature). */
const anonJwt = () => ['{"alg":"HS256","typ":"JWT"}', '{"role":"anon","iss":"env-tools-test"}'].map((s) => Buffer.from(s).toString('base64url')).join('.') + '.c2lnbmF0dXJl';
const siteEnv = (dir, env) => spawnSync(process.execPath, [path.join(ROOT, 'tools/site-env.mjs'), dir, env], { encoding: 'utf8' });

test('site-env: production is checked and left as it is', () => {
  const dir = path.join(tmp, 'prod'); writeSite(dir, fs.readFileSync(path.join(ROOT, 'config.js')));
  const before = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const r = siteEnv(dir, 'production');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /environment production \(schema 1, realtime on\): https:\/\/zemdhczqlhkabfwxccqq\.supabase\.co/);
  assert.equal(fs.readFileSync(path.join(dir, 'index.html'), 'utf8'), before);
  assert.equal(siteEnv(dir, 'demo').status, 1, 'production\'s settings are not a demo build');
});

test('site-env: a demo build\'s pages name mana in their CSP, and nothing in it names halom-studio', () => {
  const dir = path.join(tmp, 'demo'); writeSite(dir, fs.readFileSync(path.join(ROOT, 'config/demo.js')));
  const r = siteEnv(dir, 'demo');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /environment demo \(schema 2, realtime on\): https:\/\/hhmjcudeiiycwqqklksc\.supabase\.co; 2 pages' Content-Security-Policy retargeted/);
  for (const f of ['index.html', 'guide/index.html']) assert.ok(fs.readFileSync(path.join(dir, f), 'utf8').includes(CSP('https://hhmjcudeiiycwqqklksc.supabase.co')), f);
  assert.ok(fs.readFileSync(path.join(dir, 'ops/index.html'), 'utf8').includes(OPS_CSP), 'the back office already allows mana: unchanged');
  fs.writeFileSync(path.join(dir, 'leftover.js'), `fetch('https://${'zemdhczqlhkabfwxccqq'}.supabase.co/rest/v1/')`);
  const again = siteEnv(dir, 'demo');
  assert.equal(again.status, 1);
  assert.match(again.stderr, /still names halom-studio .* leftover\.js/);
  assert.equal(siteEnv(dir, 'production').status, 1, 'a demo config is never production\'s');
  assert.equal(siteEnv(dir, 'staging').status, 1);
});

test('site-env: a local build\'s pages, the back office\'s included, may connect to the stack on this machine', () => {
  const dir = path.join(tmp, 'local'), api = 'http://127.0.0.1:57521';
  writeSite(dir, localConfigText({ apiUrl: api, anonKey: anonJwt() }));
  const r = siteEnv(dir, 'local');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /environment local \(schema 2, realtime off\): http:\/\/127\.0\.0\.1:57521; 3 pages' Content-Security-Policy retargeted/);
  assert.ok(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes(CSP(api)));
  assert.ok(fs.readFileSync(path.join(dir, 'ops/index.html'), 'utf8').includes(`connect-src 'self' https://*.supabase.co ${api}; base-uri 'none'`));
  assert.equal(siteEnv(dir, 'demo').status, 1, 'a local config is not the demo\'s');
});

test('demo scenarios: found by name in the repository\'s folder first, then the private one; an unknown name says which there are', () => {
  const [pub, priv] = [path.join(tmp, 'sc-public'), path.join(tmp, 'sc-private')];
  for (const [d, files] of [[pub, ['walk.mjs', 'Upper.mjs', '_draft.mjs', 'notes.md']], [priv, ['walk.mjs', 'tour.mjs']]]) {
    fs.mkdirSync(d, { recursive: true });
    for (const f of files) fs.writeFileSync(path.join(d, f), 'export async function run() {}');
  }
  assert.deepEqual([...scenarios([pub, priv]).keys()], ['walk', 'tour']);
  assert.equal(findScenario('walk', [pub, priv]), path.join(pub, 'walk.mjs'));
  assert.equal(findScenario('tour', [pub, priv]), path.join(priv, 'tour.mjs'));
  const e = findScenario('nope', [pub, priv]);
  assert.ok(e instanceof Error);
  assert.match(e.message, /no demo scenario called "nope" .*there are: walk, tour/);
  assert.match(findScenario('nope', [path.join(tmp, 'none')]).message, /there are none yet/);
});

test('npm run demo -- --scenario <unknown> stops before building, with exit code 2', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/demo.mjs'), '--scenario', 'no-such-scenario'], { cwd: ROOT, encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /no demo scenario called "no-such-scenario" in tools\/demo-scenarios\/ or private\/demo-scenarios\//);
  assert.doesNotMatch(r.stdout, /guest menu/, 'nothing was built');
  const bad = spawnSync(process.execPath, [path.join(ROOT, 'tools/demo.mjs'), '--port'], { cwd: ROOT, encoding: 'utf8', timeout: 20000 });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /--port needs a value/);
});
