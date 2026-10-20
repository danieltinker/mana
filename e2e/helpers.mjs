// The end-to-end harness: the simulator's local stack (sim/stack), a static server for the site, and a headless
// Chromium driven by playwright-core. Phase 0 has one smoke test; the apps speak the new schema from phase 1, and their
// browser tests move here then.
//
//   const e = await startE2E({ seed: 'bistro-sim' });   // stack + a published, approved synthetic venue + web server
//   const page = await e.page();                         // a phone-sized page on the web server
//   … await e.stop();
//
// The web server serves `_site/` (bash tools/build-site.sh) at /mana/ when it exists, and /m/<slug> as the guest menu
// (the short links the apps make), with a generated config.js that points the apps at the local stack; without a
// build it serves only /mana/e2e/blank.html (enough for the smoke test).
// The browser may reach 127.0.0.1 only (no proxy; every other host fails to resolve).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSeed, readSeed, SEEDS } from '@mana/sim';
import { startStack } from '@mana/sim/stack';
import { startStatic } from '@mana/sim/stack/gateway';
import { localConfigText } from '../tools/env.mjs';
import { ARGS, CHROME, playwright } from '../tools/browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export const OUT = path.join(HERE, '.out');
export { CHROME, playwright };
export const PHONE = { width: 390, height: 844 };
export const PREFIX = '/mana/';

export async function startE2E({ seed = 'bistro-sim', site = path.join(ROOT, '_site') } = {}) {
  const stack = await startStack({ ports: 'auto' });
  let web = null, browser = null;
  const stop = async () => {
    if (browser) await browser.close().catch(() => {});
    if (web) await web.close().catch(() => {});
    await stack.stop();
  };
  try {
    const venue = seed ? await loadSeed(stack, readSeed(path.join(SEEDS, `${seed}.json`)).seed) : null;
    const config = localConfigText({ apiUrl: stack.apiUrl, anonKey: stack.anonKey });      // the local settings, as npm run dev:local writes them
    const hasSite = fs.existsSync(path.join(site, 'index.html'));
    web = await startStatic({ port: stack.ports.web, prefix: PREFIX, mounts: hasSite ? { '': site } : {}, shortLinks: true,
      virtual: { 'config.js': config, 'e2e/blank.html': '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>e2e</title><body></body>' } });
    browser = await playwright().chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
    fs.mkdirSync(OUT, { recursive: true });
    const webUrl = `http://127.0.0.1:${stack.ports.web}${PREFIX}`;
    return {
      stack, venue, browser, webUrl, hasSite, stop,
      /** A fresh phone-sized page; page errors and console errors are collected in `problems`. */
      async page(url = webUrl + 'e2e/blank.html', { viewport = PHONE } = {}) {
        const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
        const page = await ctx.newPage();
        page.problems = [];
        page.on('pageerror', (e) => page.problems.push('pageerror: ' + e.message));
        page.on('console', (m) => { if (m.type() === 'error') page.problems.push('console: ' + m.text()); });
        await page.goto(url);
        return page;
      },
    };
  } catch (e) {
    await stop();
    throw e;
  }
}
