/* Lab screenshots of the hero dish (headless Chromium, software WebGL). Run through the shared browser lock:
     flock /tmp/mana-browser.lock node brand/lab/shoot-hero.mjs <origin> <outDir> <job>...
   job = "<w>x<h>:<name>:<query>"   e.g. "1440x900:pizza:dish=0&angle=-28"
   Also: "measure:<w>x<h>[:low]" runs the live loop and prints first-dish time, bytes and frame times. */
import { createRequire } from 'node:module';
import { join } from 'node:path';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const [origin, outDir, ...jobs] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--no-proxy-server'] });
for (const job of jobs) {
  const parts = job.split(':');
  if (parts[0] === 'measure') { await measure(parts[1], parts[2] === 'low'); continue; }
  const [w, h] = parts[0].split('x').map(Number), name = parts[1], query = parts.slice(2).join(':');
  const mobile = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${origin}/lab/hero.html?${query}`);
  const ok = await page.waitForFunction(() => window.__hero && (window.__hero.frame || window.__hero.error || (window.__hero.ready && new URLSearchParams(location.search).get('reduced') === '1')), null, { timeout: 90000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(150);
  const st = await page.evaluate(() => ({ error: window.__hero.error, frame: window.__hero.frame, readyMs: window.__hero.readyMs }));
  await page.screenshot({ path: join(outDir, `${name}-${w}.png`) });
  console.log(ok ? 'ok  ' : 'TIME', name, w, JSON.stringify(st), errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await browser.close();

async function measure(vp, low) {
  const [w, h] = vp.split('x').map(Number), mobile = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const t0 = Date.now();
  await page.goto(`${origin}/lab/hero.html${low ? '?low=1' : ''}`);
  await page.waitForFunction(() => window.__hero && (window.__hero.ready || window.__hero.error), null, { timeout: 60000 });
  const first = await page.evaluate(() => {
    const m = performance.getEntriesByName('hero-first-dish')[0];
    const res = performance.getEntriesByType('resource').map((r) => ({ n: r.name.split('/').slice(-2).join('/'), b: r.encodedBodySize || r.transferSize, end: Math.round(r.responseEnd) }));
    const marks = Object.fromEntries(performance.getEntriesByType('mark').map((x) => [x.name, Math.round(x.startTime)]));
    return { marks, firstDishMs: m ? Math.round(m.startTime) : null, readyMs: Math.round(window.__hero.readyMs), res, error: window.__hero.error };
  });
  // wait until a second dish is loaded and a shift has run, then sample frame times
  await page.waitForFunction(() => { const s = window.__hero.handle && window.__hero.handle._stats(); return s && s.frames.shift.length > 10 && s.phase === 'rest'; }, null, { timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => { const s = window.__hero.handle._stats(); const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? Math.round(b[Math.floor(b.length / 2)]) : null; };
    const avg = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
    return { restMedian: med(s.frames.rest), restAvg: avg(s.frames.rest), shiftMedian: med(s.frames.shift), shiftAvg: avg(s.frames.shift), nShift: s.frames.shift.length, N: s.N, drawFrac: s.drawFrac, loaded: s.loaded, dishes: window.__hero.dishes }; });
  console.log('measure', vp, low ? 'lowPower' : 'desktop', `(${Date.now() - t0} ms wall)`, JSON.stringify(first), JSON.stringify(st), errs.join(' | '));
  await ctx.close();
}
