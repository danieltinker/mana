/* Renders SVG (and HTML) to PNG with headless Chromium. Usage: node tools/render.mjs  → PNGs next to the SVGs in assets/
   A contact sheet (assets/_sheet.png) shows every lockup on its ground so they can be looked at in one go. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), A = join(ROOT, 'assets');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function png(svgFile, out, { width, bg = 'transparent', pad = 0 } = {}) {
  const svg = readFileSync(join(A, svgFile), 'utf8'); const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/); const w = +m[1], h = +m[2];
  const W = width, H = Math.round(width * h / w);
  await page.setViewportSize({ width: W + pad * 2, height: H + pad * 2 });
  await page.setContent(`<body style="margin:0;background:${bg};padding:${pad}px"><div style="width:${W}px;height:${H}px">${svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${W}" height="${H}"`)}</div></body>`);
  await page.screenshot({ path: join(A, out), omitBackground: bg === 'transparent' });
  console.log(out, W + pad * 2, H + pad * 2);
}
const C = JSON.parse(readFileSync(join(A, 'tokens.json'), 'utf8')).colour;
for (const k of ['latin', 'hebrew', 'bilingual']) for (const t of ['light', 'dark']) {
  await png(`mana-lockup-${k}-${t}.svg`, `mana-lockup-${k}-${t}.png`, { width: 1200 });
  await png(`mana-lockup-${k}-${t}.svg`, `mana-lockup-${k}-${t}-on-ground.png`, { width: 1200, bg: t === 'light' ? C.ivory : C.black, pad: 120 });
}
for (const k of ['latin', 'hebrew']) for (const t of ['light', 'dark']) await png(`mana-by-halom-${k}-${t}.svg`, `mana-by-halom-${k}-${t}-on-ground.png`, { width: 1200, bg: t === 'light' ? C.ivory : C.black, pad: 120 });
for (const t of ['light', 'dark']) await png(`mana-mark-${t}.svg`, `mana-mark-${t}.png`, { width: 1024 });
await png('favicon.svg', 'favicon-32.png', { width: 32 }); await png('favicon.svg', 'favicon-16.png', { width: 16 }); await png('app-icon-dark.svg', 'favicon-180.png', { width: 180 });      // the home-screen icon is 180 px: the full cut on its plate (the small cut is for 16–32 px)
await png('app-icon-dark.svg', 'app-icon-512.png', { width: 512 }); await png('app-icon-dark.svg', 'app-icon-192.png', { width: 192 }); await png('app-icon-light.svg', 'app-icon-light-512.png', { width: 512 });
await png('avatar-instagram.svg', 'avatar-instagram-1080.png', { width: 1080 });
/* contact sheet */
const uri = (f) => 'data:image/svg+xml;base64,' + readFileSync(join(A, f)).toString('base64');
const cell = (f, bg, w = 420) => `<figure style="margin:0;background:${bg};padding:36px;display:flex;align-items:center;justify-content:center;min-height:150px"><img src="${uri(f)}" style="width:${w}px;max-width:100%"></figure>`;
await page.setViewportSize({ width: 1500, height: 1400 });
await page.setContent(`<body style="margin:0;background:#888;font:12px sans-serif"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:10px">
${cell('mana-lockup-latin-light.svg', C.ivory)}${cell('mana-lockup-hebrew-light.svg', C.ivory)}${cell('mana-lockup-bilingual-light.svg', C.ivory)}
${cell('mana-lockup-latin-dark.svg', C.black)}${cell('mana-lockup-hebrew-dark.svg', C.black)}${cell('mana-lockup-bilingual-dark.svg', C.black)}
${cell('mana-by-halom-latin-light.svg', C.ivory)}${cell('mana-by-halom-hebrew-light.svg', C.ivory)}${cell('mana-by-halom-latin-dark.svg', C.black)}
${cell('mana-mark-light.svg', C.ivory, 200)}${cell('mana-mark-dark.svg', C.black, 200)}${cell('mana-mark-light.svg', C.blush, 200)}
<figure style="margin:0;background:#fff;padding:36px;display:flex;gap:24px;align-items:center;justify-content:center"><img src="${uri('favicon.svg')}" width="16"><img src="${uri('favicon.svg')}" width="32"><img src="${uri('favicon.svg')}" width="64"><img src="${uri('app-icon-dark.svg')}" width="120" style="border-radius:27px"><img src="${uri('app-icon-light.svg')}" width="120" style="border-radius:27px;box-shadow:0 0 0 1px #ddd"></figure>
<figure style="margin:0;background:#fff;padding:36px;display:flex;gap:24px;align-items:center;justify-content:center"><img src="${uri('avatar-instagram.svg')}" width="150" style="border-radius:50%"><img src="${uri('avatar-instagram.svg')}" width="44" style="border-radius:50%"></figure>
${cell('mana-mark-mono-black.svg', '#fff', 120)}
</div></body>`);
await page.waitForTimeout(300);
await page.screenshot({ path: join(A, '_sheet.png'), fullPage: true });
await browser.close();
