/* Stills of the real viewer, without its buttons, for the product page and for the film composer's placeholder clips.
   The pictures are the real engine drawing the Olea demo reliefs (software WebGL, frames advanced by hand with ?test=1).
   The stage is given a phone-shaped height (390 × 844) so one dish fills the screen the way the guest view shows it.
     site/img/hero-poster.jpg (+ -480)   one dish in focus on the table: stands in until img/hero.mp4 exists, then
                                         tools/build-site.mjs replaces it with the video's first frame
     site/img/demo-poster.jpg            the whole table: the still behind "Play with it"
     tools/film/placeholders/*.jpg       stills the film composer animates until the real screen recordings arrive
   Which viewer: MANA_VIEW (see tools/serve.mjs); the default here is the published copy, because ../apps/view is being rebuilt.
   Run: node tools/posters.mjs [page|film]      (about 20 s for the page stills, 60 s for the film stills) */
import { createRequire } from 'node:module';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listen } from './serve.mjs';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright'); const sharp = require('sharp');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), RAW = join(ROOT, '.scratch', 'stills'), IMG = join(ROOT, 'site', 'img'), PH = join(ROOT, 'tools', 'film', 'placeholders');
for (const d of [RAW, IMG, PH]) mkdirSync(d, { recursive: true });
const PUBLISHED = '/home/claude/halom-projects/projects/menus/view';
const view = process.env.MANA_VIEW || (existsSync(PUBLISHED) ? PUBLISHED : undefined);
const only = process.argv[2] || 'page';
const srv = await listen(0, { view });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const V = srv.origin + '/mana/view/';
const tick = (page, n, dt = 1 / 30) => page.evaluate(([a, b]) => window.__menu.tick(a, b), [n, dt]);
const act = (page, a, meta) => page.evaluate(([x, m]) => window.__menu.dispatch(x, m), [a, meta || null]);
const CLEAN = ':root{--stage-h:844px!important}.stage-title,.caps,.pager,.stage .chip,.stage .round,.hint{display:none!important}';
async function open(hash, lang = 'he') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1400 }, deviceScaleFactor: 2 }); const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.addInitScript((css) => { document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }); }, CLEAN);
  await page.goto(V + '?demo=olea&test=1&lang=' + lang + hash, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.__menu.ready); await page.evaluate(() => window.__menu.tableReady);
  await page.waitForFunction(() => window.__menu.pending() === 0, null, { timeout: 180000 }); await tick(page, 70);
  return { page, ctx };
}
async function settle(page, n = 90) { await page.waitForFunction(() => window.__menu.pending() <= 0, null, { timeout: 120000 }).catch(() => {}); await tick(page, n); await tick(page, 2); }
async function grab(page, name) { const raw = join(RAW, name + '.png'); await page.locator('#stage').screenshot({ path: raw }); return raw; }
const jpg = (raw, out, width, quality = 80) => sharp(raw).resize({ width }).jpeg({ quality, mozjpeg: true }).toFile(out).then(() => console.log(out.replace(ROOT + '/', '')));

if (only === 'page' || only === 'all') {
  let o = await open('#c=oven'); await act(o.page, { type: 'openItem', id: 'shakshuka' }, { via: 'tap' }); await settle(o.page);
  let raw = await grab(o.page, 'hero'); await jpg(raw, join(IMG, 'hero-poster.jpg'), 720, 78); await jpg(raw, join(IMG, 'hero-poster-480.jpg'), 480, 76); await o.ctx.close();
  o = await open('#c=oven'); await settle(o.page, 10); raw = await grab(o.page, 'demo'); await jpg(raw, join(IMG, 'demo-poster.jpg'), 720, 78); await o.ctx.close();
}
if (only === 'film' || only === 'all') {
  /* the guest's view: four dishes in focus, and one dish turned each way ("Look closer") for the lift-and-turn beat */
  for (const [cat, id] of [['oven', 'shakshuka'], ['oven', 'margherita'], ['mains', 'shrimp'], ['mains', 'burger'], ['sweet', 'cheesecake']]) {
    const o = await open('#c=' + cat); await act(o.page, { type: 'openItem', id }, { via: 'tap' }); await settle(o.page);
    await jpg(await grab(o.page, 'guest-' + id), join(PH, 'guest-' + id + '.jpg'), 780, 84);
    if (id === 'shakshuka') {
      await act(o.page, { type: 'setInspect', on: true }); await settle(o.page, 40); await jpg(await grab(o.page, 'guest-shakshuka-lift'), join(PH, 'guest-shakshuka-lift.jpg'), 780, 84);
      for (const [key, tag] of [['ArrowRight', 'r'], ['ArrowLeft', 'l']]) {
        const n = tag === 'r' ? 2 : 4; for (let i = 0; i < n; i++) await o.page.keyboard.press(key); await settle(o.page, 50);
        await jpg(await grab(o.page, 'guest-shakshuka-turn-' + tag), join(PH, 'guest-shakshuka-turn-' + tag + '.jpg'), 780, 84);
      }
    }
    await o.ctx.close();
  }
  const o = await open('#c=oven'); await settle(o.page, 10); await jpg(await grab(o.page, 'guest-table'), join(PH, 'guest-table.jpg'), 780, 84); await o.ctx.close();
}
await browser.close(); srv.server.close();
