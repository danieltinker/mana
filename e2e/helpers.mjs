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
// `mounts` serves one app's own build without the whole site (guest-menu.test.mjs: { view: apps/view, stock: stock }).
// The browser may reach 127.0.0.1 only (no proxy; every other host fails to resolve).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSeed, readSeed, SEEDS } from '@mana/sim';
import { startStack } from '@mana/sim/stack';
import { startStatic } from '@mana/sim/stack/gateway';
import { localConfigText, PRODUCTION, retargetCsp } from '../tools/env.mjs';
import { ARGS, CHROME, playwright } from '../tools/browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
export const OUT = path.join(HERE, '.out');
export { CHROME, playwright };
export const PHONE = { width: 390, height: 844 };
export const PREFIX = '/mana/';
/** Software WebGL (SwiftShader), as the guest menu's own browser tests use it: slow, but the table is drawn. */
export const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

/**
 * @param o.seed    a synthetic seed of sim/seeds (null = none)
 * @param o.site    the built site, served at /mana/ when it has an index.html
 * @param o.mounts  more folders by first path segment, e.g. { view: 'apps/view', stock: 'stock' } (a built app without the whole site)
 * @param o.config  more fields for the local config.js (on top of localConfigText's: env local, schema 2, realtime off)
 * @param o.gl      true: the browser draws WebGL in software (without it, a page that needs WebGL falls back as a phone would)
 * @param o.signup  'open': the stack's public sign-up is on, every address confirmed at once (sim/stack/start.mjs)
 */
export async function startE2E({ seed = 'bistro-sim', site = path.join(ROOT, '_site'), mounts = {}, config: extra = {}, gl = false, signup = 'closed' } = {}) {
  const stack = await startStack({ ports: 'auto', signup });
  let web = null, browser = null;
  const stop = async () => {
    if (browser) await browser.close().catch(() => {});
    if (web) await web.close().catch(() => {});
    await stack.stop();
  };
  try {
    const venue = seed ? await loadSeed(stack, readSeed(path.join(SEEDS, `${seed}.json`)).seed) : null;
    // the local settings, as npm run dev:local writes them (env 'local', schema 2, realtime false), plus `config`
    const config = localConfigText({ apiUrl: stack.apiUrl, anonKey: stack.anonKey })
      + (Object.keys(extra).length ? `Object.assign(window.HALOM_MENUS_CONFIG, ${JSON.stringify(extra)});\n` : '');
    const hasSite = fs.existsSync(path.join(site, 'index.html'));
    // the back office's Content-Security-Policy allows exactly the local stack, as a local build writes it (tools/site-env.mjs)
    const opsIndex = path.join(site, 'ops/index.html');
    const ops = fs.existsSync(opsIndex) ? retargetCsp(fs.readFileSync(opsIndex, 'utf8'), new URL(PRODUCTION.supabaseUrl).origin, new URL(stack.apiUrl).origin) : null;
    web = await startStatic({ port: stack.ports.web, prefix: PREFIX, mounts: { ...(hasSite ? { '': site } : {}), ...mounts }, shortLinks: true,
      virtual: { 'config.js': config, 'e2e/blank.html': '<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,"><title>e2e</title><body></body>',
        ...(ops ? { 'ops/': ops, 'ops/index.html': ops } : {}) } });
    browser = await playwright().chromium.launch({ executablePath: CHROME, headless: true, args: gl ? ARGS.concat(GL_ARGS) : ARGS });
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
