// The environment tools on a small fixture site (no build, no network beyond 127.0.0.1):
// tools/serve-site.mjs (halom.io's routes, byte ranges, headers), tools/site-env.mjs (the build's settings step) and
// tools/demo.mjs's scenario seam.   node --test tools/test/*.test.mjs   (tools/test-all.mjs: the "tools" suite)
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { localConfigText, ROOT } from '../env.mjs';
import { JWT_SECRET, signJwt } from '../../sim/stack/jwt.mjs';
import { serveSite } from '../serve-site.mjs';
import { findScenario, runScenario, scenarios } from '../demo.mjs';

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
/** The simulator's anon key, as its stack signs it; `secret` signs another (a key that is not the simulator's). */
const anonJwt = (secret = JWT_SECRET, role = 'anon') => signJwt({ role, iss: 'mana-sim-local' }, secret, { issuedAt: 1760000000 });
/** A request sent exactly as written (fetch would normalise the path first). */
const raw = (p) => new Promise((done, fail) => http.get({ host: '127.0.0.1', port: s.port, path: p }, (r) => {
  let body = ''; r.on('data', (d) => { body += d; }); r.on('end', () => done({ status: r.statusCode, headers: r.headers, body }));
}).on('error', fail));

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
  assert.equal((await get('/mana/config.js')).status, 404, 'by default a production build\'s settings are withheld');
});

test('serve-site serves nothing outside the site, and answers 404 for what is not there', async () => {
  for (const p of ['/mana/../secret.txt', '/mana/%2e%2e/secret.txt', '/mana/..%2fsecret.txt', '/elsewhere/', '/m/a/b', '/mana/nothing.js']) {
    const r = await get(p);
    assert.equal(r.status, 404, p);
    assert.doesNotMatch(await r.text(), /outside the site/, p);
  }
  assert.equal((await fetch(s.origin + '/mana/', { method: 'POST' })).status, 405);
  const r = await raw('/mana/../secret.txt');
  assert.equal(r.status, 404);
  assert.doesNotMatch(r.body, /outside the site/);
});

test('serve-site survives the reviewers\' probes: NUL, names too long, CR/LF and Hebrew in a folder redirect, symbolic links out', async () => {
  for (const [p, status] of [['/mana/%00', 400], ['/mana/a%00b/index.html', 400], ['/mana/' + 'a'.repeat(300) + '/x', 404], ['/mana/' + 'b/'.repeat(1500), 400]]) {
    assert.equal((await raw(p)).status, status, p.slice(0, 40));
  }
  for (const [dir, enc] of [['a\r\nX-Evil: 1', 'a%0D%0AX-Evil:%201'], ['תפריט', encodeURIComponent('תפריט')]]) {
    fs.mkdirSync(path.join(SITE, dir), { recursive: true });
    fs.writeFileSync(path.join(SITE, dir, 'index.html'), '<title>folder</title>');
    const r = await raw('/mana/' + enc + '?q=1');
    assert.deepEqual([r.status, r.headers.location, r.headers['x-evil']], [302, '/mana/' + enc + '/?q=1', undefined], JSON.stringify(dir));
    assert.equal((await raw('/mana/' + enc + '/')).status, 200);
  }
  fs.symlinkSync(path.join(tmp, 'secret.txt'), path.join(SITE, 'leak.txt'));
  fs.symlinkSync(tmp, path.join(SITE, 'leakdir'));
  for (const p of ['/mana/leak.txt', '/mana/leakdir/secret.txt', '/mana/leakdir/']) {
    const r = await raw(p);
    assert.equal(r.status, 404, p);
    assert.doesNotMatch(r.body, /outside the site/, p);
  }
  assert.equal((await raw('/mana/')).status, 200, 'still serving');
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

/** npm run serve on `site`: resolves once it printed its first address, with what it printed and that origin. */
function serveCli(site, ...args) {
  const child = spawn(process.execPath, [path.join(ROOT, 'tools/serve-site.mjs'), '--site', site, '--port', '0', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  return new Promise((done, fail) => {
    child.stdout.on('data', (d) => { out += d; const m = /http:\/\/127\.0\.0\.1:\d+/.exec(out); if (m) setTimeout(() => done({ child, out, origin: m[0], output: () => out }), 50); });
    child.stderr.on('data', (d) => { out += d; });
    child.on('exit', (code) => fail(new Error(`serve-site exited ${code}: ${out}`)));
  });
}

test('npm run serve says which environment it serves; a production build\'s settings only with --live', async () => {
  fs.symlinkSync('config.js', path.join(SITE, 'settings-alias.js'));      // another name for the same file
  const guarded = await serveCli(SITE);
  try {
    assert.match(guarded.out, /settings: production \(https:\/\/zemdhczqlhkabfwxccqq\.supabase\.co, schema 1\)/);
    assert.match(guarded.out, /config\.js is withheld/);
    assert.deepEqual([...guarded.out.matchAll(/http:\/\/\S+/g)].map((m) => m[0].replace(guarded.origin, '')), ['/mana/view/?demo=olea'], 'it offers only the in-build demo');
    for (const p of ['/mana/config.js', '/mana/settings-alias.js', '/mana/view/../config.js']) assert.equal((await fetch(guarded.origin + p)).status, 404, p);
    assert.equal((await fetch(guarded.origin + '/mana/')).status, 200);
  } finally { guarded.child.kill(); }
  const live = await serveCli(SITE, '--live');
  try {
    assert.match(live.out, /--live: every page talks to halom-studio/);
    assert.equal((await fetch(live.origin + '/mana/config.js')).status, 200);
  } finally { live.child.kill(); fs.rmSync(path.join(SITE, 'settings-alias.js')); }
});

test('npm run serve on a demo build, rebuilt for production while it runs: config.js refused, the terminal told', async () => {
  const dir = path.join(tmp, 'race-cli');
  writeSite(dir, fs.readFileSync(path.join(ROOT, 'config/demo.js')));
  const cli = await serveCli(dir);
  try {
    assert.match(cli.out, /settings: demo/);
    assert.equal((await fetch(cli.origin + '/mana/config.js')).status, 200);
    fs.rmSync(dir, { recursive: true, force: true }); writeSite(dir, fs.readFileSync(path.join(ROOT, 'config.js')));
    const r = await fetch(cli.origin + '/mana/config.js');
    assert.equal(r.status, 409);
    assert.doesNotMatch(await r.text(), /zemdhczqlhkabfwxccqq/, 'not one byte of production\'s settings');
    await new Promise((ok) => setTimeout(ok, 100));
    assert.match(cli.output(), /! _site\/config\.js is now production's \(halom-studio, the live database\), not the demo build this server checked at start: refused/);
  } finally { cli.child.kill(); }
});

test('the settings are judged on every request: a rebuild under a running server is refused, by inode and by content', async () => {
  const dir = path.join(tmp, 'race'), warnings = [];
  const rebuild = (cfg) => { fs.rmSync(dir, { recursive: true, force: true }); writeSite(dir, fs.readFileSync(path.join(ROOT, cfg))); };   // as build-site.sh: rm -rf, then copy
  rebuild('config/demo.js');
  const srv = await serveSite({ site: dir, port: 0, settings: { expected: 'demo', warn: (l) => warnings.push(l) } });
  const cfgAt = async (p) => { const r = await fetch(srv.origin + p); const b = await r.text(); return `${r.status} ${/hhmjcudeiiycwqqklksc/.test(b) ? 'mana' : /zemdhczqlhkabfwxccqq/.test(b) ? 'halom-studio' : b.trim()}`; };
  try {
    assert.equal(await cfgAt('/mana/config.js'), '200 mana');
    rebuild('config.js');                                                       // npm run build in a second terminal
    fs.linkSync(path.join(dir, 'config.js'), path.join(dir, 'hard-link.js'));
    fs.copyFileSync(path.join(dir, 'config.js'), path.join(dir, 'copy.js'));
    for (const p of ['/mana/config.js', '/mana/hard-link.js', '/mana/copy.js', '/mana/config.js']) assert.match(await cfgAt(p), /^409 refused: _site\/ was rebuilt for production, not demo/, p);
    assert.deepEqual(warnings, ['! _site/config.js is now production\'s (halom-studio, the live database), not the demo build this server checked at start: refused; restart it after a rebuild'], 'said once');
    rebuild('config/demo.js');
    assert.equal(await cfgAt('/mana/config.js'), '200 mana', 'the demo build again');
    fs.writeFileSync(path.join(dir, 'config.js'), localConfigText({ apiUrl: 'http://127.0.0.1:57521', anonKey: anonJwt() }));
    assert.match(await cfgAt('/mana/config.js'), /^409 refused: _site\/ was rebuilt for local, not demo/);
    fs.writeFileSync(path.join(dir, 'config.js'), 'not a config');
    assert.match(await cfgAt('/mana/config.js'), /^409 refused: config\.js is unreadable/);
    assert.equal(warnings.length, 3);
  } finally { await srv.close(); }
});

const siteEnv = (dir, env) => spawnSync(process.execPath, [path.join(ROOT, 'tools/site-env.mjs'), dir, env], { encoding: 'utf8' });

test('site-env: production is checked and left as it is', () => {
  const dir = path.join(tmp, 'prod'); writeSite(dir, fs.readFileSync(path.join(ROOT, 'config.js')));
  const pages = ['index.html', 'guide/index.html', 'ops/index.html'], before = pages.map((f) => fs.readFileSync(path.join(dir, f), 'utf8'));
  const r = siteEnv(dir, 'production');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /environment production \(schema 1, realtime on\): https:\/\/zemdhczqlhkabfwxccqq\.supabase\.co/);
  assert.deepEqual(pages.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')), before, 'every page as it was, the back office\'s wildcard included');
  assert.equal(siteEnv(dir, 'demo').status, 1, 'production\'s settings are not a demo build');
});

test('site-env: a demo build\'s pages name mana in their CSP, and nothing in it names halom-studio', () => {
  const dir = path.join(tmp, 'demo'); writeSite(dir, fs.readFileSync(path.join(ROOT, 'config/demo.js')));
  const r = siteEnv(dir, 'demo');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /environment demo \(schema 2, realtime on\): https:\/\/hhmjcudeiiycwqqklksc\.supabase\.co; 3 pages' Content-Security-Policy retargeted/);
  for (const f of ['index.html', 'guide/index.html']) assert.ok(fs.readFileSync(path.join(dir, f), 'utf8').includes(CSP('https://hhmjcudeiiycwqqklksc.supabase.co')), f);
  assert.ok(fs.readFileSync(path.join(dir, 'ops/index.html'), 'utf8').includes(
    "connect-src 'self' https://hhmjcudeiiycwqqklksc.supabase.co wss://hhmjcudeiiycwqqklksc.supabase.co; base-uri 'none'"), 'the back office: mana over https and wss, no wildcard');
  fs.writeFileSync(path.join(dir, 'leftover.js'), `fetch('https://${'zemdhczqlhkabfwxccqq'}.supabase.co/rest/v1/')`);
  const again = siteEnv(dir, 'demo');
  assert.equal(again.status, 1);
  assert.match(again.stderr, /still names halom-studio .* leftover\.js/);
  fs.rmSync(path.join(dir, 'leftover.js'));
  for (const policy of ["img-src 'self' https://other-project.supabase.co", "script-src 'self' https://*.supabase.co"]) {
    fs.writeFileSync(path.join(dir, 'stray.html'), `<meta http-equiv="Content-Security-Policy" content="${policy}">`);
    const r2 = siteEnv(dir, 'demo');
    assert.equal(r2.status, 1, policy);
    assert.match(r2.stderr, /Content-Security-Policy still allows another Supabase host: stray\.html/, policy);
  }
  fs.rmSync(path.join(dir, 'stray.html'));
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
  assert.ok(fs.readFileSync(path.join(dir, 'ops/index.html'), 'utf8').includes(`connect-src 'self' ${api} ws://127.0.0.1:57521; base-uri 'none'`), 'the back office: the stack over http and ws, no wildcard');
  assert.equal(siteEnv(dir, 'demo').status, 1, 'a local config is not the demo\'s');
});

test('check-site: the simulator\'s anon key is the only JWT a site may hold, on config.js\'s key line of a local build', () => {
  const dir = path.join(tmp, 'jwt'), api = 'http://127.0.0.1:57521';
  writeSite(dir, localConfigText({ apiUrl: api, anonKey: anonJwt() }));
  const check = () => spawnSync(process.execPath, [path.join(ROOT, 'tools/check-site.mjs'), dir], { encoding: 'utf8' });
  let r = check();
  assert.equal(r.status, 0, r.stdout + r.stderr);
  for (const [token, why] of [[anonJwt(JWT_SECRET, 'service_role'), /a JWT with the role service_role in leak\.js:1/],
    [anonJwt('another-secret-0123456789abcdef'), /an anon JWT that is not the simulator's local key in leak\.js:1/],
    [anonJwt(), /the simulator's local key outside config\.js's key line of a local build, in leak\.js:1/]]) {
    fs.writeFileSync(path.join(dir, 'leak.js'), `const k = '${token}';\n`);
    r = check();
    assert.equal(r.status, 1, r.stdout);
    assert.match(r.stdout, why);
  }
  fs.rmSync(path.join(dir, 'leak.js'));
  writeSite(dir, localConfigText({ apiUrl: api, anonKey: anonJwt() }).replace(anonJwt(), anonJwt('another-secret-0123456789abcdef')));
  assert.match(check().stdout, /an anon JWT that is not the simulator's local key in config\.js:4/, 'not even on config.js\'s key line');
  writeSite(dir, fs.readFileSync(path.join(ROOT, 'config/demo.js'), 'utf8') + `// ${anonJwt()}\n`);
  assert.match(check().stdout, /the simulator's local key outside config\.js's key line of a local build, in config\.js:\d+/, 'not in a demo build\'s config.js');
});

test('the build picks its settings by MANA_ENV, and a wrong or missing one stops it before _site/ is touched', () => {
  /* the build script in a copy of the repository's settings, so a run that went further could touch nothing real */
  const repo = path.join(tmp, 'repo');
  for (const f of ['tools/build-site.sh', 'config.js', 'config/demo.js']) { fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(repo, f)); }
  fs.mkdirSync(path.join(repo, '_site'), { recursive: true }); fs.writeFileSync(path.join(repo, '_site/marker'), 'the last build');
  const build = (env, ...args) => {
    const e = { ...process.env, ...env }; for (const k of ['MANA_ENV', 'GITHUB_ACTIONS']) if (!(k in env)) delete e[k];
    return spawnSync('bash', [path.join(repo, 'tools/build-site.sh'), ...args], { encoding: 'utf8', env: e, timeout: 20000 });
  };
  let r = build({}, '--settings');
  assert.deepEqual([r.status, r.stdout.trim()], [0, '· settings: production (config.js)'], 'MANA_ENV unset: production');
  r = build({ MANA_ENV: 'demo' }, '--settings');
  assert.deepEqual([r.status, r.stdout.trim()], [0, '· settings: demo (config/demo.js)']);
  for (const [env, why] of [[{ MANA_ENV: 'prodution' }, /MANA_ENV is "prodution": production, demo or local/], [{ MANA_ENV: 'local' }, /config\/local\.js is missing/],
    [{ MANA_ENV: 'demo', GITHUB_ACTIONS: 'true' }, /GitHub Actions builds production only/]]) {
    r = build(env);
    assert.equal(r.status, 1, JSON.stringify(env));
    assert.match(r.stdout, why);
    assert.deepEqual(fs.readdirSync(path.join(repo, '_site')), ['marker'], 'the last build is untouched: ' + JSON.stringify(env));
  }
  assert.equal(build({ MANA_ENV: 'production', GITHUB_ACTIONS: 'true' }, '--settings').status, 0, 'CI builds production');
});

test('demo scenarios: the repository\'s first, then a private one; a private name is never listed or printed', () => {
  const root = path.join(tmp, 'sc'), dirs = { repository: path.join(root, 'tools/demo-scenarios'), private: path.join(root, 'private/demo-scenarios') };
  for (const [d, files] of [[dirs.repository, ['walk.mjs', 'Upper.mjs', '_draft.mjs', 'notes.md']], [dirs.private, ['walk.mjs', 'tour.mjs']]]) {
    fs.mkdirSync(d, { recursive: true });
    for (const f of files) fs.writeFileSync(path.join(d, f), 'export async function run() {}');
  }
  assert.deepEqual(scenarios(dirs), ['walk']);
  assert.deepEqual(findScenario('walk', dirs, root), { file: path.join(dirs.repository, 'walk.mjs'), label: 'the scenario "walk"', private: false });
  assert.deepEqual(findScenario('tour', dirs, root), { file: path.join(dirs.private, 'tour.mjs'), label: 'the private scenario', private: true });
  const e = findScenario('nope', dirs, root);
  assert.ok(e instanceof Error);
  assert.equal(e.message, 'no demo scenario called "nope": there are walk in tools/demo-scenarios/, or a private one goes in private/demo-scenarios/');
  assert.doesNotMatch(e.message, /tour/);
  assert.match(findScenario('nope', { repository: path.join(root, 'none'), private: dirs.private }, root).message, /there is none in none\/ yet, or a private one/);
});

test('a scenario writes under private/ or _site/: a file git sees, new or tracked, fails it; a private one is never named', async () => {
  const root = path.join(tmp, 'sc-git'), g = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' });
  fs.mkdirSync(path.join(root, 'private/demo-scenarios'), { recursive: true });
  fs.writeFileSync(path.join(root, '.gitignore'), 'private/\n_site/\n');
  fs.writeFileSync(path.join(root, 'tracked.txt'), 'as committed\n');
  g('init', '-q'); g('add', '.'); g('-c', 'user.email=t@example.invalid', '-c', 'user.name=t', 'commit', '-q', '-m', 'x');
  const scenario = (name, body, secret = true) => {
    const file = path.join(root, 'private/demo-scenarios', name + '.mjs');
    fs.writeFileSync(file, `import fs from 'node:fs'; import path from 'node:path';
      export async function run({ root, outDir }) { ${body}; return { links: [['menu', '/m/x']] }; }`);
    return { file, label: secret ? 'the private scenario' : `the scenario "${name}"`, private: secret };
  };
  const write = (where) => `fs.mkdirSync(path.dirname(${where}), { recursive: true }); fs.writeFileSync(${where}, 'x')`;
  const opts = { config: {}, origin: 'http://127.0.0.1:4180', root, log: () => {}, guard: false };      // the process guard: the next test, in a child
  assert.deepEqual(await runScenario(scenario('tidy', write("path.join(outDir, 'walk.json')")), opts), [['menu', '/m/x']]);
  assert.ok(fs.existsSync(path.join(root, 'private/demo-output/tidy/walk.json')), 'outDir is private/demo-output/<name>/');
  assert.deepEqual(await runScenario(scenario('built', write("path.join(root, '_site/m.json')")), opts), [['menu', '/m/x']]);
  const refused = async (sc, re) => { const e = await runScenario(sc, opts).then(() => null, (x) => x); assert.ok(e, 'refused'); assert.match(e.message, re); return e.message; };
  for (const [name, body] of [['zebrastray', write("path.join(root, 'apps/zebrastray.json')")], ['zebraedit', "fs.appendFileSync(path.join(root, 'tracked.txt'), 'changed')"]]) {
    const msg = await refused(scenario(name, body), /^the private scenario changed 1 file git sees \(a scenario writes only under private\/ or _site\/\); git status lists them$/);
    assert.doesNotMatch(msg, /zebra|demo-scenarios/, 'neither the private scenario\'s name nor its path');
    g('checkout', '-q', '--', 'tracked.txt'); fs.rmSync(path.join(root, 'apps'), { recursive: true, force: true });
  }
  await refused(scenario('mine', "fs.appendFileSync(path.join(root, 'tracked.txt'), 'changed')", false), /^the scenario "mine" changed 1 file git sees .*: tracked\.txt$/);
  g('checkout', '-q', '--', 'tracked.txt');
  const failing = scenario('zebrafail', "throw new Error('zebrafail broke at ' + import.meta.url)");
  const msg = await refused(failing, /^the private scenario failed \(Error\); MANA_DEMO_DEBUG=1 shows the error, which may name it$/);
  assert.doesNotMatch(msg, /zebra|demo-scenarios/);
  process.env.MANA_DEMO_DEBUG = '1';
  try { await refused(failing, /zebrafail broke at/); } finally { delete process.env.MANA_DEMO_DEBUG; }
});

test('a private scenario never shows itself: not in an error\'s name, a thrown value, or what it leaves running', () => {
  const root = path.join(tmp, 'sc-proc'), priv = path.join(root, 'private/demo-scenarios'), hidden = 'zebra-' + crypto.randomUUID().slice(0, 8);
  fs.mkdirSync(priv, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: root }); fs.writeFileSync(path.join(root, '.gitignore'), 'private/\n');
  const cases = {
    'an error class named after it': [`class E extends Error { constructor() { super('x'); this.name = '${hidden}'; } } throw new E();`, /failed \(an error\);/],
    'a TypeError': ['null.x;', /failed \(TypeError\);/],
    'a thrown string': [`throw '${hidden}';`, /failed \(a thrown value\);/],
    'a throw in a timer after it returned': [`setTimeout(() => { throw new Error('${hidden}'); }, 5); return {};`, /failed after it ran \(Error\);/],
    'a rejection nobody awaits': [`setTimeout(() => Promise.reject(new Error('${hidden}')), 5); return {};`, /failed after it ran \(Error\);/],
  };
  for (const [what, [body, why]] of Object.entries(cases)) {
    fs.writeFileSync(path.join(priv, hidden + '.mjs'), `export async function run() { ${body} }`);
    const runner = path.join(root, 'run.mjs');
    fs.writeFileSync(runner, `import { findScenario, runScenario } from ${JSON.stringify(pathToFileURL(path.join(ROOT, 'tools/demo.mjs')).href)};
      const dirs = { repository: ${JSON.stringify(path.join(root, 'none'))}, private: ${JSON.stringify(priv)} };
      try { await runScenario(findScenario(${JSON.stringify(hidden)}, dirs, ${JSON.stringify(root)}), { config: {}, origin: 'http://127.0.0.1:4180', root: ${JSON.stringify(root)}, log: () => {} }); }
      catch (e) { console.error('✗ ' + e.message); process.exit(1); }
      await new Promise((ok) => setTimeout(ok, 200)); console.log('still running');`);
    const env = { ...process.env }; delete env.MANA_DEMO_DEBUG;
    const r = spawnSync(process.execPath, [runner], { encoding: 'utf8', env, timeout: 20000 });
    assert.equal(r.status, 1, what + ': ' + r.stdout + r.stderr);
    assert.match(r.stderr, why, what);
    assert.doesNotMatch(r.stdout + r.stderr, new RegExp(hidden + '|demo-scenarios'), what + ': neither its name nor its path');
  }
});

test('the e2e web server (sim/stack/gateway.mjs startStatic) answers the apps\' short links, /m/<slug>, as serve-site does', async () => {
  const { startStatic } = await import('../../sim/stack/gateway.mjs');
  const web = await startStatic({ port: 0, prefix: '/mana/', mounts: { '': SITE }, shortLinks: true, virtual: { 'config.js': '/* e2e */' } });
  const origin = `http://127.0.0.1:${web.server.address().port}`;
  try {
    for (const p of ['/m/bistro-sim', '/m/bistro-sim/', '/m/bistro-sim?t=1']) {
      const r = await fetch(origin + p);
      assert.deepEqual([r.status, /<title>menu<\/title>/.test(await r.text())], [200, true], p);
    }
    assert.equal(await (await fetch(origin + '/mana/config.js')).text(), '/* e2e */');
  } finally { await web.close(); }
});

test('the tools a Mac runs (serve, demo, the build\'s settings step and site check) load no package: Node only', () => {
  const seen = new Set(), bare = [];
  const walk = (file) => {
    if (seen.has(file)) return; seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^\s*import\s[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (spec.startsWith('.')) walk(path.resolve(path.dirname(file), spec));
      else if (!spec.startsWith('node:')) bare.push(`${path.relative(ROOT, file)}: ${spec}`);
    }
  };
  for (const f of ['serve-site.mjs', 'demo.mjs', 'site-env.mjs', 'check-site.mjs', 'env.mjs']) walk(path.join(ROOT, 'tools', f));
  assert.ok(seen.has(path.join(ROOT, 'sim/stack/jwt.mjs')), 'the local key is checked through sim/stack/jwt.mjs');
  assert.deepEqual(bare, []);
});

test('npm run demo -- --scenario <unknown> stops before building, with exit code 2', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/demo.mjs'), '--scenario', 'no-such-scenario'], { cwd: ROOT, encoding: 'utf8', timeout: 20000 });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /no demo scenario called "no-such-scenario": there (is none|are .*) in tools\/demo-scenarios\/.*, or a private one goes in private\/demo-scenarios\//);
  assert.doesNotMatch(r.stdout, /guest menu/, 'nothing was built');
  const bad = spawnSync(process.execPath, [path.join(ROOT, 'tools/demo.mjs'), '--port'], { cwd: ROOT, encoding: 'utf8', timeout: 20000 });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /--port needs a value/);
});
