#!/usr/bin/env node
/* The old-phones guard: every app a guest or an owner opens today must boot on the phones they have. Safari before
   16.4 (iPhones not updated past iOS 16.3) refuses a lookbehind in a regular expression, and Safari before 15.4 has no
   Object.hasOwn and no crypto.randomUUID. A lookbehind built at load time in an entry chunk is a blank page there,
   whatever Chromium says (an import of the contracts did exactly that to the owner app, so this guard exists).

   On a production build (bash tools/build-site.sh), each app's production entry is opened with production's settings
   in a Chromium patched before any script runs: RegExp refuses a lookbehind, Object.hasOwn and crypto.randomUUID are
   gone, the user agent is an iPhone's on iOS 15. Each must boot (the owner app and the back office render into #app;
   the guest menu, the in-build demo, leaves its boot state) with no page error. A lookbehind written as a literal
   is a parse error the patched RegExp cannot see, so every script and page the app loads is also read for one.
     the owner app    /mana/studio/
     the guest menu   /mana/view/?demo=olea   (the in-build demo: the whole menu, no database)
     the back office  /mana/ops/

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
const LOOKBEHIND = /(?:^|[^\\])(?:\\\\)*\(\?<[=!]/;
/* booted: #app holds what the app rendered, not the page's own "Loading…" (.boot); the guest menu's #app leaves its
   boot mode for the list or the table once the menu is on screen */
const rendered = () => { const a = document.getElementById('app'); return !!a && a.children.length > 0 && !a.querySelector('.boot'); };
const APPS = [
  { name: 'the owner app (studio)', at: 'studio/', ready: rendered },
  { name: 'the guest menu (view)', at: 'view/?demo=olea', ready: () => { const a = document.getElementById('app'); return !!a && a.dataset.mode !== 'boot'; } },
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

let server, browser, config;
before(async () => {
  assert.ok(fs.existsSync(path.join(SITE, 'index.html')), `no built site in ${SITE} (bash tools/build-site.sh)`);
  config = settings();
  server = await serveSite({ site: SITE, port: 0, settings: { warn: () => {} } });      // production's config.js withheld: the route below answers it
  browser = await playwright().chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
});
after(async () => { await browser?.close(); await server?.close(); });

for (const app of APPS) {
  test(`${app.name} boots on an iPhone's engine of iOS 15: no lookbehind, no Object.hasOwn, no crypto.randomUUID`, async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      userAgent: IPHONE_IOS15, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', serviceWorkers: 'block' });
    const errors = [], read = [], outside = new Set();
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
      page.on('response', (r) => { if (['script', 'document'].includes(r.request().resourceType()) && r.ok()) read.push(r.text().then((t) => ({ url: r.url(), t }), () => null)); });
      await page.goto(server.origin + '/mana/' + app.at);
      await page.waitForFunction(app.ready, null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(800);                                                  // a late error, after the first paint
      const engine = await page.evaluate(() => [typeof Object.hasOwn, typeof crypto.randomUUID, (() => { try { new RegExp('(?<=a)b'); return 'lookbehind accepted'; } catch { return 'lookbehind refused'; } })()]);
      assert.deepEqual(engine, ['undefined', 'undefined', 'lookbehind refused'], 'the old engine is in place');
      const booted = await page.evaluate(app.ready);
      const state = await page.evaluate(() => { const a = document.getElementById('app'); return a ? `#app: ${a.children.length} children, mode ${a.dataset.mode ?? '-'}` : 'no #app'; });
      assert.deepEqual(errors, [], `page errors (${state})`);
      assert.ok(booted, `it did not boot: ${state}`);
      const scripts = (await Promise.all(read)).filter(Boolean);
      assert.ok(scripts.length >= 2, 'its page and its scripts were read');
      const withLookbehind = scripts.filter(({ t }) => LOOKBEHIND.test(t)).map(({ url, t }) => `${new URL(url).pathname} at ${t.search(LOOKBEHIND)}`);
      assert.deepEqual(withLookbehind, [], 'a lookbehind in what it loads (a literal one is a parse error on these phones)');
      if (outside.size) console.log(`note: ${app.name} asked for ${[...outside].join(', ')}: aborted`);
    } finally { await ctx.close(); }
  });
}
