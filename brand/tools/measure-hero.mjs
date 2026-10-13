/* Measures the hero (view/?demo=solo&embed=hero) in a headless Chromium with software WebGL: first paint → the rise (the
   page's own marks), the quality tier it ends at, and the same run with the CPU slowed four times (CDP
   Emulation.setCPUThrottlingRate 4), the stand-in for a mid-range phone. Numbers are for this machine only.
     node tools/measure-hero.mjs [origin]      default: a local tools/serve.mjs on a free port */
import { createRequire } from 'node:module';
import { listen } from './serve.mjs';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'];
const own = process.argv[2] ? null : await listen(0), origin = process.argv[2] || own.origin;
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true, args: GL });
async function run(label, rate) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 600 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }); const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page); if (rate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const t0 = Date.now(); await page.goto(origin + '/mana/view/?demo=solo&embed=hero&lang=he', { waitUntil: 'domcontentloaded' });
  const end = await page.waitForFunction(() => window.__manaHero && ['rest', 'poster'].includes(window.__manaHero.phase()), null, { timeout: 120000 }).then(() => page.evaluate(() => window.__manaHero.phase())).catch(() => 'timeout');
  const r = await page.evaluate(() => { const fp = performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint'), m = Object.fromEntries(window.__mana.marks().map((x) => [x.name.replace('menu-', ''), x.t])); return { firstPaint: fp ? Math.round(fp.startTime) : null, marks: m, tier: window.__mana.info().tier, pixelRatio: window.__mana.info().pixelRatio }; });
  console.log(`${label}: end state "${end}" after ${Date.now() - t0} ms · first paint ${r.firstPaint} ms · poster ${r.marks['hero-poster']} ms · table drawn ${r.marks['table-drawn']} ms · rise ${r.marks['hero-rise']} ms · rest ${r.marks['hero-rest']} ms · tier ${r.tier} (pixel ratio ${r.pixelRatio})`);
  await ctx.close();
}
await run('headless, this machine, CPU ×1', 1);
await run('headless, this machine, CPU ×4 (mid-phone proxy)', 4);
await browser.close(); if (own) own.server.close();
