/* Screenshots and numbers for the floor's lab (headless Chromium, software WebGL: judge the look here, not the speed).
   Run through the shared browser lock, with lab/floor.html served from brand/ on a local port:
     flock /tmp/mana-browser.lock node brand/lab/shoot-floor.mjs <origin> <out-dir> [filter]
   Writes <out-dir>/floor-<w>-<lang>-<moment>.png, contact-sheet.png and numbers.json. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright'); const sharp = require('sharp');
const [origin = 'http://127.0.0.1:7501', OUT = '.', only = ''] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
const MOMENTS = [['normal', 1.5, 'yaw=-0.5'], ['soon', 5.5, 'yaw=-0.62'], ['up', 9, 'yaw=-0.74']];
const VPS = [[1440, 900, false], [390, 844, true]];
const shots = [], numbers = { note: 'headless Chromium, SwiftShader (software WebGL), this machine (2 shared cores)' };
async function open(q, w, h, touch, reduced = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errors = [], hosts = new Set();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('request', (r) => { try { hosts.add(new URL(r.url()).host); } catch (e) { /* data: */ } });
  await page.goto(origin + '/lab/floor.html?' + q, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__floorState !== 'loading', null, { timeout: 60000 });
  return { ctx, page, errors, hosts };
}
for (const [w, h, touch] of VPS) for (const lang of ['he', 'en']) for (const [name, t, extra] of MOMENTS) {
  const id = `floor-${w}-${lang}-${name}`; if (only && !id.includes(only)) continue;
  const o = await open(`lang=${lang}&t=${t}&freeze&${extra}`, w, h, touch);
  await o.page.evaluate(() => document.fonts.ready); await o.page.waitForTimeout(1400);
  const st = await o.page.evaluate(() => window.__floorState);
  const file = join(OUT, id + '.png'); await o.page.locator('.card').screenshot({ path: file });
  shots.push({ id, file }); console.log(id, st, o.errors.length ? o.errors : '', [...o.hosts].join(','));
  await o.ctx.close();
}
/* numbers: time to first frame and frame times while it runs (desktop and phone sizes), and the reduced still */
if (!only || only === 'numbers') for (const [w, h, touch] of VPS) {
  const o = await open('lang=he', w, h, touch);
  const ready = await o.page.evaluate(() => window.__floorReadyMs);
  await o.page.waitForTimeout(6000);
  const info = await o.page.evaluate(() => window.__floor && window.__floor.info());
  numbers[`${w}x${h}`] = { firstFrameMs: ready, ...info, errors: o.errors, hosts: [...o.hosts] }; await o.ctx.close();
  const r = await open('lang=he', w, h, touch, true); await r.page.waitForTimeout(800);
  const ri = await r.page.evaluate(() => window.__floor && window.__floor.info());
  const file = join(OUT, `floor-${w}-he-reduced.png`); await r.page.locator('.card').screenshot({ path: file }); shots.push({ id: `floor-${w}-he-reduced`, file });
  numbers[`${w}x${h} reduced`] = { firstFrameMs: await r.page.evaluate(() => window.__floorReadyMs), frames: ri && ri.frames, errors: r.errors }; await r.ctx.close();
}
await browser.close();
writeFileSync(join(OUT, 'numbers.json'), JSON.stringify(numbers, null, 2)); console.log(JSON.stringify(numbers, null, 1));
/* the contact sheet: each shot scaled to one column width, in rows of three */
if (shots.length > 1) {
  const COL = 560, PAD = 16, tiles = [];
  for (const s of shots) { const img = sharp(s.file).resize({ width: COL }); const buf = await img.png().toBuffer(); const m = await sharp(buf).metadata(); tiles.push({ buf, h: m.height, id: s.id }); }
  const rows = []; for (let i = 0; i < tiles.length; i += 3) rows.push(tiles.slice(i, i + 3));
  const rowH = rows.map((r) => Math.max(...r.map((x) => x.h)) + 28), Wt = 3 * COL + 4 * PAD, Ht = rowH.reduce((a, b) => a + b + PAD, PAD);
  const comp = []; let y = PAD;
  rows.forEach((r, ri) => { r.forEach((t, ci) => { const x = PAD + ci * (COL + PAD); comp.push({ input: t.buf, left: x, top: y + 24 }); comp.push({ input: Buffer.from(`<svg width="${COL}" height="22"><text x="0" y="16" font-family="sans-serif" font-size="14" fill="#4A433C">${t.id}</text></svg>`), left: x, top: y }); }); y += rowH[ri] + PAD; });
  await sharp({ create: { width: Wt, height: Ht, channels: 3, background: '#EFEBE4' } }).composite(comp).png().toFile(join(OUT, 'contact-sheet.png'));
  console.log('contact sheet', join(OUT, 'contact-sheet.png'));
}
