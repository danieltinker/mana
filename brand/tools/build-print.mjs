/* Print files in the Mana identity, as vectors written in code (text is outlined from the open fonts; QR codes are real).
     print/table-card-a6[-dark].svg|pdf      A6 table card      (placeholders: restaurant name, QR, short link)
     print/qr-sticker-60mm.svg|pdf           round sticker, 60 mm
     print/leave-behind-a5.pdf               A5, Hebrew front, English back (source: print/src/leave-behind.html)
     print/*-bleed.pdf                       the same with 3 mm bleed for a print shop
     print/preview/*.png                     150 dpi pictures for checking on screen
   A real restaurant's card:  node tools/build-print.mjs --slug olea --he "אוליאה" --en "Olea" [--base https://halom.io/m/]
     → print/cards/<slug>/table-card-a6.pdf, qr-sticker-60mm.pdf (+ svg)                                        */
import { placed } from './mark.mjs';
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { qrPath } from './qr.mjs';
import { C, outlines } from './build-assets.mjs';
import { leaveBehind } from './leave-behind.mjs';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { word, fonts } = outlines;
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const slug = arg('slug', ''), base = arg('base', 'https://halom.io/m/');
const nameHe = arg('he', slug ? '' : 'שם המסעדה'), nameEn = arg('en', slug ? '' : 'Restaurant name');
const OUT = slug ? join(ROOT, 'print', 'cards', slug) : join(ROOT, 'print');
mkdirSync(join(OUT, 'preview'), { recursive: true });
const url = slug ? base + slug : 'https://halom.io/m/your-name';
const shown = url.replace(/^https?:\/\//, '');
const r = (n) => Math.round(n * 1000) / 1000;
const isHeb = (s) => /[֐-׿]/.test(s);
/* one line of outlined text, centred on x, baseline at y; size in mm (font size, not cap height) */
function line(text, x, y, size, { serif = false, fill = C.black, tracking = 0, id = '' } = {}) {
  const heb = isHeb(text), font = serif ? (heb ? fonts.serifHeb : fonts.serifLat) : (heb ? fonts.sansHeb : fonts.sansLat);
  const w = word(font, text, size, { rtl: heb, tracking });
  return { w: w.w, svg: `<path${id ? ` id="${id}"` : ''} transform="translate(${r(x - w.w / 2)} ${r(y)})" fill="${fill}" d="${w.d}"/>` };
}
const fit = (text, max, size, o) => { let l = line(text, 0, 0, size, o); return l.w > max ? size * max / l.w : size; };
const markSvg = (x, y, w, plate) => placed({ x, y, w, ink: plate, light: C.yolk, small: w < 5 });   // Cloche (./mark.mjs); x, y = the ink box's top-left
function qr(x, y, size, { pad = 0.09, fg = C.black } = {}) {         // white tile with the code inside; x,y = top-left of the tile
  const { n, d } = qrPath(url, { ecc: 'Q' }), inner = size * (1 - 2 * pad), m = inner / n;
  return `<g id="qr"><rect x="${r(x)}" y="${r(y)}" width="${size}" height="${size}" rx="${r(size * 0.045)}" fill="#FFFFFF"/><path transform="translate(${r(x + size * pad)} ${r(y + size * pad)}) scale(${r(m)})" fill="${fg}" shape-rendering="crispEdges" d="${d}"/></g>`;
}
const doc = (w, h, body, bleed, ground) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 2 * bleed}mm" height="${h + 2 * bleed}mm" viewBox="${-bleed} ${-bleed} ${w + 2 * bleed} ${h + 2 * bleed}">\n<rect x="${-bleed}" y="${-bleed}" width="${w + 2 * bleed}" height="${h + 2 * bleed}" fill="${ground}"/>\n${body}\n</svg>\n`;

/* ---- A6 table card, 105 × 148 mm */
function tableCard(dark, bleed = 0) {
  const W = 105, H = 148, ink = dark ? C.ivory : C.black, sub = dark ? '#cfc9c4' : C.charcoal, ground = dark ? C.black : C.ivory, cx = W / 2;
  const names = [nameHe, nameEn].filter(Boolean); let y = 25, b = '';
  const big = fit(names[0], 82, 11.5, { serif: true });
  b += `<g id="restaurant-name">` + line(names[0], cx, y, big, { serif: true, fill: ink }).svg;
  if (names[1]) { y += 8.2; b += line(names[1], cx, y, fit(names[1], 82, 5.4, { serif: true }), { serif: true, fill: sub }).svg; }
  b += `</g>`;
  y = 44.5; b += line('סרקו וראו את המנות על השולחן', cx, y, 4.3, { fill: ink }).svg;
  b += line('Scan to see the dishes on the table', cx, y + 5.6, 3.5, { fill: sub }).svg;
  const q = 56; b += qr(cx - q / 2, 57, q);
  b += `<g id="short-link">` + line(shown, cx, 122.5, fit(shown, 80, 3.7), { fill: sub, tracking: 0.02 }).svg + `</g>`;
  const by = line('Menu by mana', 0, 0, 3.1, { fill: sub }), mw = 7.2, total = mw + 1.8 + by.w, x0 = cx - total / 2;
  b += markSvg(x0, 136.2, mw, ink) + line('Menu by mana', x0 + mw + 1.8 + by.w / 2, 140.4, 3.1, { fill: sub }).svg;
  return doc(W, H, b, bleed, ground);
}
/* ---- round sticker, 60 mm */
function sticker(bleed = 0) {
  const D = 60, cx = 30, b = [];
  b.push(`<circle cx="30" cy="30" r="${30 + bleed}" fill="${C.black}"/>`);
  b.push(line('סרקו לתפריט', cx, 10.2, 3.6, { fill: C.ivory }).svg);
  b.push(qr(cx - 16.5, 13.5, 33));
  b.push(line('Scan for the menu', cx, 51.2, 2.9, { fill: C.ivory }).svg);
  b.push(markSvg(cx - 3.1, 53.3, 6.2, C.ivory));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${D + 2 * bleed}mm" height="${D + 2 * bleed}mm" viewBox="${-bleed} ${-bleed} ${D + 2 * bleed} ${D + 2 * bleed}">\n${b.join('\n')}\n</svg>\n`;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
async function emit(name, svg, wmm, hmm, { png = true } = {}) {
  writeFileSync(join(OUT, name + '.svg'), svg);
  await page.setContent(`<style>@page{size:${wmm}mm ${hmm}mm;margin:0}html,body{margin:0}svg{display:block;width:${wmm}mm;height:${hmm}mm}</style>${svg}`);
  await page.pdf({ path: join(OUT, name + '.pdf'), width: wmm + 'mm', height: hmm + 'mm', printBackground: true, preferCSSPageSize: true });
  if (png) { const px = (mm) => Math.round(mm / 25.4 * 150); await page.setViewportSize({ width: px(wmm), height: px(hmm) }); await page.setContent(`<style>html,body{margin:0;background:#9a9a9a}svg{display:block;width:${px(wmm)}px;height:${px(hmm)}px}</style>${svg}`); await page.screenshot({ path: join(OUT, 'preview', name + '.png') }); }
  console.log(name);
}
await emit('table-card-a6', tableCard(false), 105, 148);
await emit('table-card-a6-dark', tableCard(true), 105, 148);
await emit('qr-sticker-60mm', sticker(), 60, 60);
if (!slug) {
  await emit('table-card-a6-bleed', tableCard(false, 3), 111, 154, { png: false });
  await emit('table-card-a6-dark-bleed', tableCard(true, 3), 111, 154, { png: false });
  await emit('qr-sticker-60mm-bleed', sticker(2), 64, 64, { png: false });
  /* ---- A5 leave-behind: an HTML page with live text, printed to PDF */
  const src = join(ROOT, 'print', 'src', 'leave-behind.html'); mkdirSync(dirname(src), { recursive: true }); writeFileSync(src, leaveBehind());
  await page.goto(pathToFileURL(src).href, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: join(OUT, 'leave-behind-a5.pdf'), width: '148mm', height: '210mm', printBackground: true, preferCSSPageSize: true });
  const px = (mm) => Math.round(mm / 25.4 * 150);
  await page.setViewportSize({ width: px(148), height: px(210) }); await page.emulateMedia({ media: 'print' });
  const over = await page.evaluate(() => [...document.querySelectorAll('.sheet')].map((s) => { const last = s.querySelector('.foot').getBoundingClientRect(), box = s.getBoundingClientRect(); return [s.id, Math.round(box.bottom - last.bottom)]; }));
  console.log('leave-behind: space under the last block, px (must be > 0):', JSON.stringify(over));
  for (const [i, id] of [[1, 'he'], [2, 'en']]) { await page.locator('#' + id).screenshot({ path: join(OUT, 'preview', `leave-behind-a5-${i}-${id}.png`) }); }
  console.log('leave-behind-a5');
}
await browser.close();
