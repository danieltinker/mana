/* Proof stills: the guest's view at several screen shapes, each at rest, in mid-glide, in the middle of a category change,
   with a photographed dish lifted and with an illustration lifted. One sheet a shape, and a count of plain-black pixels in
   every frame (the table must reach all four edges).  Usage: node tools/proof.mjs [--out .shots/v2/fix] [--only phone]
   Uses ?capture=1: the clock is turned by hand, so every still is the same on every run. */
import { createRequire } from 'node:module';
import { mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { listen } from './serve.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), VIEW = '/projects/menus/view/';
const argv = process.argv.slice(2), opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const OUT = resolve(opt('--out', join(ROOT, '.shots', 'v2', 'fix'))), only = opt('--only', '');
const SHAPES = [['phone', 390, 844], ['desktop', 1440, 900], ['wide', 2560, 1080], ['tablet', 1024, 1366]].filter((s) => !only || s[0] === only);
mkdirSync(OUT, { recursive: true });
const srv = await listen(0, { stock: process.env.STOCK === 'fixture' ? undefined : 'library' });
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || (existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined), headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] });
const lang = opt('--lang', 'en');
for (const [name, w, h] of SHAPES) {
  const t0 = Date.now(), files = [];
  const openPage = async (demo) => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 900, isMobile: w < 900 }), page = await ctx.newPage(), errors = []; page.on('pageerror', (e) => errors.push(e.message)); await page.goto(srv.origin + VIEW + '?demo=' + demo + '&lang=' + lang + '&capture=1', { waitUntil: 'domcontentloaded' }); await page.evaluate(() => window.__mana.settle()); return { ctx, page, errors }; };
  const still = async (page, label) => { const f = join(OUT, name + '-' + label + '.png'); await page.evaluate(() => window.__mana.frame(0)); await page.screenshot({ path: f }); files.push(f); };
  const run = (page, ms) => page.evaluate((t) => { for (let k = 0; k < Math.round(t / 25); k++) window.__mana.tick(1, .025, false); }, ms);      // time passes, nothing is drawn
  let o = await openPage('olea');
  const F = await o.page.evaluate(() => window.__mana.info().frame);
  await still(o.page, '1-rest');
  await o.page.evaluate(([x, y]) => { const m = window.__mana; m.pointer('down', x, y + 150); for (let k = 1; k <= 5; k++) { m.pointer('move', x, y + 150 - k * 26); m.tick(1, .03, false); } }, [F.cx, F.cy]); await still(o.page, '2-mid-glide');
  await o.page.evaluate(([x, y]) => { const m = window.__mana; for (let k = 6; k <= 9; k++) { m.pointer('move', x, y + 150 - k * 26); m.tick(1, .03, false); } m.tick(1, .03, false); m.pointer('up', x, y - 84); }, [F.cx, F.cy]); await run(o.page, 1500);
  await o.page.evaluate(() => window.__mana.dispatch({ type: 'setCategory', id: 'mains' }, { via: 'chip' })); await run(o.page, 300); await still(o.page, '3-mid-category');
  await run(o.page, 2500); await o.page.evaluate(() => window.__mana.goTo('hummus')); await run(o.page, 2500); await o.page.evaluate(() => window.__mana.lift(true)); await run(o.page, 1800); await still(o.page, '4-lifted-photo-dish');
  const e1 = o.errors; await o.ctx.close();
  o = await openPage('kiosk'); await still(o.page, '6-illustration-at-rest'); await o.page.evaluate(() => window.__mana.lift(true)); await run(o.page, 100); await still(o.page, '7-illustration-lifting'); await run(o.page, 1700); await still(o.page, '5-lifted-illustration'); const e2 = o.errors; await o.ctx.close();
  files.sort();
  const sheet = join(OUT, name + '.jpg'), cellW = w > 1200 ? 960 : w > 600 ? 512 : 390, cols = w > 1200 ? 2 : 5;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error'].concat(files.flatMap((f) => ['-i', f]), ['-filter_complex', files.map((_, i) => `[${i}:v]scale=${cellW}:-2[s${i}]`).join(';') + ';' + files.map((_, i) => `[s${i}]`).join('') + `xstack=inputs=${files.length}:layout=` + files.map((_, i) => `${(i % cols) * (cellW + 8)}_${Math.floor(i / cols) * (Math.round(h * cellW / w / 2) * 2 + 8)}`).join('|') + ':fill=0x7a2a8c', '-frames:v', '1', '-q:v', '3', sheet]));
  const black = spawnSync('python3', ['-c', `
import sys
from PIL import Image
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGB'); px = im.resize((im.width // 2, im.height // 2)).getdata(); n = len(px)
    b = sum(1 for p in px if max(p) <= 6); d = sum(1 for p in px if max(p) <= 16)
    print('   %-34s plain black (<=6/255): %5.2f%%   very dark (<=16): %5.2f%%' % (f.split('/')[-1], 100.0 * b / n, 100.0 * d / n))
`].concat(files));
  console.log(name, w + 'x' + h, '→', r.status === 0 ? sheet : 'sheet failed: ' + String(r.stderr).slice(0, 300), Math.round((Date.now() - t0) / 1000) + ' s', e1.concat(e2).length ? e1.concat(e2) : ''); console.log(String(black.stdout).trimEnd());
}
await browser.close(); srv.server.close();
