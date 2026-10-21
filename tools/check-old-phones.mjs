#!/usr/bin/env node
/* The old-phones guard: every app a guest or an owner opens today must boot on the phones they have. Safari before
   16.4 (iPhones not updated past iOS 16.3) refuses a lookbehind in a regular expression, and Safari before 15.4 has no
   Object.hasOwn and no crypto.randomUUID. A lookbehind built at load time in an entry chunk is a blank page there,
   whatever Chromium says (an import of the contracts did exactly that to the owner app, so this guard exists).

   On a production build (bash tools/build-site.sh):
   - every built script and page (.js, .mjs, .html, all of _site/, the chunks no page below loads included: the seat
     map, the host board, the floor, gen/) is read for a lookbehind written as a literal, a parse error on those phones
     that no patched RegExp can see. A finding gives the file, line and column; one inside a string is reported too, and
     a person judges it.
   - each app's production entry is opened with production's settings in a Chromium patched before any script runs:
     RegExp refuses a lookbehind, Object.hasOwn and crypto.randomUUID are gone, the user agent is an iPhone's on iOS 15.
     Each must boot with no page error:
       the owner app    /mana/studio/            renders into #app, past the page's own "Loading…"
       the back office  /mana/ops/               the same
       the guest menu   /mana/view/?demo=olea    the in-build demo (the whole menu, no database) on its table: the
                                                 table's chunk is imported apart and a failure there is caught (the menu
                                                 falls back to its list), so the table must be up (#app.live) and the
                                                 console must hold no error.

   Nothing leaves this machine: the settings are production's with the database address pointed at a closed port on
   127.0.0.1, every request to another host is aborted, and the browser resolves no other host.

     bash tools/build-site.sh && node --test tools/check-old-phones.mjs     (tools/test-all.mjs: the "old-phones" suite)
     node tools/check-old-phones.mjs <another built site>                   a copy of _site/, e.g. to show it bites */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { envOf, PRODUCTION, readConfigText, ROOT } from './env.mjs';
import { serveSite } from './serve-site.mjs';
import { ARGS, CHROME, playwright } from './browser.mjs';

const SITE = path.resolve(process.argv[2] || path.join(ROOT, '_site'));
const IPHONE_IOS15 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.7 Mobile/15E148 Safari/604.1';
const DEAD = 'http://127.0.0.1:9';        // the discard port: nothing listens, so every database call fails at once
/** An unescaped "(?<=" or "(?<!": a lookbehind, in a pattern's source or in a script's text. */
const LOOKBEHIND = /(?:^|[^\\])(?:\\\\)*\(\?<[=!]/g;
/* booted: #app holds what the app rendered, not the page's own "Loading…" (.boot) */
const rendered = () => { const a = document.getElementById('app'); return !!a && a.children.length > 0 && !a.querySelector('.boot'); };
const APPS = [
  { name: 'the owner app (studio)', at: 'studio/', ready: rendered },
  { name: 'the guest menu (view) on its table', at: 'view/?demo=olea', console: true, gl: true,
    ready: () => { const a = document.getElementById('app'); return !!a && a.dataset.mode !== 'boot' && a.classList.contains('live'); } },
  { name: 'the back office (ops)', at: 'ops/', ready: rendered },
];

/** Runs in the page before any of its scripts: the engine of an iPhone on iOS 15. */
function oldEngine() {
  const R = globalThis.RegExp, LB = /(?:^|[^\\])(?:\\\\)*\(\?<[=!]/;
  function RegExp(pattern, flags) {
    const source = pattern instanceof R ? pattern.source : String(pattern);
    if (LB.test(source)) throw new SyntaxError(`Invalid regular expression: /${source}/: Invalid group specifier name (no lookbehind before Safari 16.4)`);
    return new.target ? Reflect.construct(R, [pattern, flags], new.target) : R(pattern, flags);
  }
  RegExp.prototype = R.prototype;
  Object.setPrototypeOf(RegExp, R);
  globalThis.RegExp = RegExp;
  delete Object.hasOwn;
  if (globalThis.Crypto) delete globalThis.Crypto.prototype.randomUUID;
}

/** The build's settings, as production carries them, with the database address on a closed local port. */
function settings() {
  const text = fs.readFileSync(path.join(SITE, 'config.js'), 'utf8'), cfg = readConfigText(text);
  assert.equal(envOf(cfg), 'production', `${SITE} is a ${envOf(cfg)} build: this guard checks production's (bash tools/build-site.sh)`);
  const dead = text.split(PRODUCTION.supabaseUrl).join(DEAD), after = readConfigText(dead);
  assert.deepEqual({ ...after, supabaseUrl: cfg.supabaseUrl }, cfg, 'only the database address changes');
  assert.equal(after.supabaseUrl, DEAD);
  return dead;
}

/** Every script and page under `dir`: paths relative to it. */
function builtFiles(dir, rel = '') {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) return builtFiles(dir, r);
    return e.isFile() && /\.(m?js|html?)$/i.test(e.name) ? [r] : [];
  });
}
/** Where `text` holds a lookbehind: "line:column" of each "(?<", the first three. */
function lookbehinds(text) {
  const out = [];
  for (const m of text.matchAll(LOOKBEHIND)) {
    const at = m.index + m[0].length - 4, before = text.slice(0, at), line = before.split('\n').length;
    out.push(`${line}:${at - before.lastIndexOf('\n')}`);
    if (out.length === 3) break;
  }
  return out;
}

let server, browser, config;
before(async () => {
  assert.ok(fs.existsSync(path.join(SITE, 'index.html')), `no built site in ${SITE} (bash tools/build-site.sh)`);
  config = settings();
  server = await serveSite({ site: SITE, port: 0, settings: { warn: () => {} } });      // production's config.js withheld: the route below answers it
  browser = await playwright().chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
});
after(async () => { await browser?.close(); await server?.close(); });

test('no built script or page holds a lookbehind (a literal one is a parse error on those phones, whichever page loads it)', () => {
  const files = builtFiles(SITE);
  for (const want of [/^gen\/gen\.js$/, /^view\/chunks\/seat-/, /^view\/host\.js$/, /^view\/floor\.js$/, /^studio\/assets\/index-.*\.js$/]) {
    assert.ok(files.some((f) => want.test(f)), `${want} is read too: every script, the ones no page here loads included`);
  }
  const found = files.flatMap((f) => lookbehinds(fs.readFileSync(path.join(SITE, f), 'utf8')).map((at) => `${f}:${at}`));
  assert.deepEqual(found, [], 'a lookbehind (file:line:column): rewrite it, or a person judges that it is only text');
});

for (const app of APPS) {
  test(`${app.name} boots on an iPhone's engine of iOS 15: no lookbehind, no Object.hasOwn, no crypto.randomUUID`, async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      userAgent: IPHONE_IOS15, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', serviceWorkers: 'block' });
    const errors = [], logged = [], outside = new Set();
    try {
      await ctx.addInitScript(oldEngine);
      await ctx.route('**/*', (route) => {
        const u = new URL(route.request().url());
        if (u.protocol !== 'data:' && u.protocol !== 'blob:' && u.hostname !== '127.0.0.1') { outside.add(u.host); return route.abort(); }
        if (u.pathname === '/mana/config.js') return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: config });
        return route.continue();
      });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') logged.push(m.text()); });
      await page.goto(server.origin + '/mana/' + app.at);
      if (app.gl) assert.ok(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl')), 'this browser has no WebGL: the guest menu\'s table cannot be checked here');
      await page.waitForFunction(app.ready, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(800);                                                  // a late error, after the first paint
      const engine = await page.evaluate(() => [typeof Object.hasOwn, typeof crypto.randomUUID, (() => { try { new RegExp('(?<=a)b'); return 'lookbehind accepted'; } catch { return 'lookbehind refused'; } })()]);
      assert.deepEqual(engine, ['undefined', 'undefined', 'lookbehind refused'], 'the old engine is in place');
      const booted = await page.evaluate(app.ready);
      const state = await page.evaluate(() => { const a = document.getElementById('app'); return a ? `#app: ${a.children.length} children, mode ${a.dataset.mode ?? '-'}, ${a.classList.contains('live') ? 'its table up' : 'no table'}` : 'no #app'; });
      assert.deepEqual(errors, [], `page errors (${state})`);
      if (app.console) assert.deepEqual(logged, [], `console errors (${state})`);
      assert.ok(booted, `it did not boot: ${state}`);
      if (outside.size) console.log(`note: ${app.name} asked for ${[...outside].join(', ')}: aborted`);
    } finally { await ctx.close(); }
  });
}
