/* Screenshots of the real viewer for the product page and the campaign. Software WebGL: slow, so frames are advanced by hand (?test=1).
   Output: site/img/*.jpg (and .shots-raw/*.png). Run: node tools/product-shots.mjs [filter] */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listen } from './serve.mjs';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright'); const sharp = require('sharp');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), RAW = join(ROOT, '.shots-raw'), IMG = join(ROOT, 'site', 'img');
mkdirSync(RAW, { recursive: true }); mkdirSync(IMG, { recursive: true });
const only = process.argv[2] || '';
const srv = await listen(0);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const V = srv.origin + '/mana/view/';
async function open(url, { width = 390, height = 780, dpr = 2 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr }); const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' }); return { page, ctx };
}
const tick = (page, n, dt = 1 / 30) => page.evaluate(([a, b]) => window.__menu.tick(a, b), [n, dt]);
async function up(page, frames = 80) { await page.evaluate(() => window.__menu.ready); await page.evaluate(() => window.__menu.tableReady); await page.waitForFunction(() => window.__menu.pending() === 0, null, { timeout: 120000 }); await settle(page, frames); await page.evaluate(() => document.fonts.ready); await tick(page, 2); }
async function settle(page, frames = 60) { await page.waitForFunction(() => window.__menu.pending() <= 0, null, { timeout: 120000 }).catch(() => {}); await tick(page, frames); }
const d = (page, a, meta) => page.evaluate(([x, m]) => window.__menu.dispatch(x, m), [a, meta || null]);
async function save(page, name, { clip, selector, quality = 82, width } = {}) {
  const raw = join(RAW, name + '.png');
  if (selector) await page.locator(selector).screenshot({ path: raw }); else await page.screenshot({ path: raw, clip });
  let img = sharp(raw); if (width) img = img.resize({ width });
  await img.jpeg({ quality, mozjpeg: true }).toFile(join(IMG, name + '.jpg')); console.log(name);
}
const S = {
  async poster() { for (const lang of ['he', 'en']) { const o = await open(V + '?demo=olea&test=1&lang=' + lang + '#c=mains'); await up(o.page); await save(o.page, 'poster-' + lang); await o.ctx.close(); } },
  async detail() { for (const lang of ['he', 'en']) { const o = await open(V + '?demo=olea&test=1&lang=' + lang + '#c=mains'); await up(o.page, 60); await d(o.page, { type: 'openItem', id: 'shrimp' }, { via: 'tap' }); await settle(o.page, 90); await save(o.page, 'detail-' + lang); await o.ctx.close(); } },
  async soldout() { for (const lang of ['he', 'en']) { const o = await open(V + '?demo=olea&test=1&lang=' + lang + '#c=sweet'); await up(o.page, 60); await d(o.page, { type: 'openItem', id: 'brulee' }); await settle(o.page, 90); await save(o.page, 'soldout-' + lang); await o.ctx.close(); } },
  async table() { for (const lang of ['he', 'en']) { const o = await open(V + '?demo=olea&test=1&pr=1.5&lang=' + lang + '#c=oven', { width: 1440, height: 900, dpr: 1 }); await up(o.page); await save(o.page, 'table-' + lang, { selector: '#stage', quality: 80 }); await o.ctx.close(); } },
  async howto() { for (const lang of ['he', 'en']) { const o = await open(V + '?demo=howto&test=1&lang=' + lang + '#c=mains&i=pasta'); await up(o.page, 90); await d(o.page, { type: 'setInspect', on: true }); await o.page.keyboard.press('ArrowRight'); await o.page.keyboard.press('ArrowRight'); await settle(o.page, 50); await save(o.page, 'howto-relief-' + lang); await o.ctx.close(); } },
  async unavailable() { /* the calm page a diner sees when a trial has ended: taken from the viewer's own stub in view/test, not reproduced here */ }
};
for (const k of Object.keys(S)) { if (only && !k.includes(only)) continue; const t = Date.now(); await S[k](); console.log(k, Date.now() - t, 'ms'); }
await browser.close(); srv.server.close();
