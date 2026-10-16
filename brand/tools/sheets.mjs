/* Review pictures for version 2, into review/v2/:
     page-<width>-<lang>.png            the whole product page (390 × 844 and 1440 × 900, Hebrew and English)
     sheet-390.jpg, sheet-1440.jpg      the same pages cut into screens and laid side by side
     sheet-legal.jpg                    the privacy and terms pages (390, Hebrew and English)
     sheet-states.jpg                   the states that are not on the plain page: scanner on, hero with a video and with a play
                                        button, the film lightbox, the open form, the live demo in its frame
     before-after-390.jpg               yesterday's page next to today's at the same scale, with heights and visible words
     measure.json                       the numbers behind that picture (same counting for both pages)
   Which viewer: MANA_VIEW (see tools/serve.mjs).      Run: node tools/sheets.mjs */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listen } from './serve.mjs';
import { renderIndex, mediaFound } from './build-site.mjs';
import { ensureTestMedia } from './test-media.mjs';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright'); const sharp = require('sharp');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), OUT = join(ROOT, 'review', 'v2'), TMP = join(ROOT, '.scratch', 'sheets'), MEDIA = ensureTestMedia();
mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const srv = await listen(0);
const countWords = () => {
  const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const el = n.parentElement; if (!el || !n.nodeValue.trim()) continue;
    if (el.closest('script,style,noscript,template,svg,.vh,[hidden],dialog:not([open])')) continue;
    const d = el.closest('details:not([open])'); if (d && !el.closest('summary')) continue;
    if (!el.checkVisibility() || !el.getClientRects().length) continue;
    out.push(n.nodeValue);
  }
  return out.join(' ').split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
};
/* the reveals (the flow's line, the sample numbers) start when their section is on screen: bring each one into view and
   wait for it, so that a whole-page picture never catches one half drawn */
const REVEAL = async () => {
  for (const el of document.querySelectorAll('.reveal')) {
    el.scrollIntoView({ block: 'center', behavior: 'instant' }); const t0 = performance.now();
    while (document.documentElement.classList.contains('anim') && !el.classList.contains('in') && performance.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 50));
    el.classList.add('in');            // on a busy machine the observer can be late: a review picture shows the finished state either way (tools/test-site.mjs checks the real trigger)
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
};
async function shoot(url, file, { w = 390, h = 844, origin = srv.origin, before, clip, viewport = false, reduced = false, settle = 2600 } = {}) {
  const phone = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(origin + url, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += 400) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo({ top: 0, behavior: 'instant' }); });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 6000 }).catch(() => {});
  await page.evaluate(REVEAL);
  if (before) await before(page);
  await page.waitForTimeout(settle);
  const m = await page.evaluate((f) => ({ height: document.documentElement.scrollHeight, words: (0, eval)('(' + f + ')')() }), countWords.toString());
  if (clip) await page.locator(clip).screenshot({ path: file }); else await page.screenshot({ path: file, fullPage: !viewport });
  await ctx.close(); return m;
}
const label = (text, w, h = 34, size = 17) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#0F0F0F"/><text x="12" y="${Math.round(h * 0.68)}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}" fill="#FCF8F6">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
/* cut a tall page into screens of `cut` px, scale them, and lay them left to right under one label */
async function strip(file, title, { cut, scale = 1, size = 17 }) {
  const meta = await sharp(file).metadata(), n = Math.ceil(meta.height / cut), cw = Math.round(meta.width * scale), ch = Math.round(cut * scale), gap = 10;
  const parts = [];
  for (let i = 0; i < n; i++) {
    const hh = Math.min(cut, meta.height - i * cut);
    parts.push({ input: await sharp(file).extract({ left: 0, top: i * cut, width: meta.width, height: hh }).resize({ width: cw }).png().toBuffer(), left: i * (cw + gap), top: 34 });
  }
  const W = n * cw + (n - 1) * gap, H = ch + 34;
  return { W, H, buf: await sharp({ create: { width: W, height: H, channels: 3, background: '#3a3a3a' } }).composite([{ input: label(title, W, 34, size), left: 0, top: 0 }, ...parts]).png().toBuffer() };
}
async function stack(strips, file, { dir = 'v', gap = 14, quality = 84 } = {}) {
  const W = dir === 'v' ? Math.max(...strips.map((s) => s.W)) : strips.reduce((a, s) => a + s.W, 0) + gap * (strips.length - 1);
  const H = dir === 'v' ? strips.reduce((a, s) => a + s.H, 0) + gap * (strips.length - 1) : Math.max(...strips.map((s) => s.H));
  let x = 0, y = 0; const comp = [];
  for (const s of strips) { comp.push({ input: s.buf, left: x, top: y }); if (dir === 'v') y += s.H + gap; else x += s.W + gap; }
  await sharp({ create: { width: W, height: H, channels: 3, background: '#3a3a3a' } }).composite(comp).jpeg({ quality, mozjpeg: true }).toFile(file);
  console.log(file.replace(ROOT + '/', ''), W + '×' + H);
}

const measure = { counted: 'visible words at 390 px: text in rendered elements, without closed <details> bodies, visually hidden headings and text inside drawings', pages: {} };
/* ---- the product page, four ways */
const pages = {};
for (const [w, h] of [[390, 844], [1440, 900]]) for (const lang of ['he', 'en']) {
  const f = join(OUT, `page-${w}-${lang}.png`); pages[w + lang] = f;
  const m = await shoot(`/mana/?lang=${lang}&demo=off`, f, { w, h }); measure.pages[`after ${w} ${lang}`] = m; console.log('page', w, lang, m);
}
await stack([await strip(pages['390he'], `Mana product page v2 · 390 × 844 · Hebrew · ${measure.pages['after 390 he'].height} px, ${measure.pages['after 390 he'].words} visible words`, { cut: 844 }),
  await strip(pages['390en'], `390 × 844 · English · ${measure.pages['after 390 en'].height} px, ${measure.pages['after 390 en'].words} visible words`, { cut: 844 })], join(OUT, 'sheet-390.jpg'));
await stack([await strip(pages['1440he'], `Mana product page v2 · 1440 × 900 · Hebrew · ${measure.pages['after 1440 he'].height} px (screens at 50%)`, { cut: 900, scale: 0.5 }),
  await strip(pages['1440en'], `1440 × 900 · English · ${measure.pages['after 1440 en'].height} px`, { cut: 900, scale: 0.5 })], join(OUT, 'sheet-1440.jpg'));

/* ---- privacy and terms */
const legal = [];
for (const pg of ['privacy', 'terms']) for (const lang of ['he', 'en']) {
  const f = join(OUT, `${pg}-390-${lang}.png`); const m = await shoot(`/mana/${pg}/?lang=${lang}`, f, { settle: 300 });
  legal.push(await strip(f, `${pg} · 390 · ${lang === 'he' ? 'Hebrew' : 'English'} · ${m.height} px (60%)`, { cut: 1500, scale: 0.6 }));
}
await stack(legal, join(OUT, 'sheet-legal.jpg'));
const lf = join(OUT, 'privacy-1440-he.png'); await shoot('/mana/privacy/?lang=he', lf, { w: 1440, h: 900, settle: 300 });

/* ---- the states that the plain page does not show */
const states = [];
const one = async (title, url, opts) => { const f = join(TMP, 'state-' + states.length + '.png'); await shoot(url, f, opts); const meta = await sharp(f).metadata(); const w = Math.min(meta.width, 720);
  const img = await sharp(f).resize({ width: w }).png().toBuffer(), mh = (await sharp(img).metadata()).height;
  states.push({ W: w, H: mh + 34, buf: await sharp({ create: { width: w, height: mh + 34, channels: 3, background: '#3a3a3a' } }).composite([{ input: label(title, w, 34, 14), left: 0, top: 0 }, { input: img, left: 0, top: 34 }]).png().toBuffer() }); };
const s2 = await listen(0, { scan: true }); await one('scanner switched on (config.features.scan) · he', '/mana/?lang=he&demo=off', { origin: s2.origin, clip: '#how' }); await one('scanner on · en', '/mana/?lang=en&demo=off', { origin: s2.origin, clip: '#how' }); s2.server.close();
await one('scanner off (today) · en', '/mana/?lang=en&demo=off', { clip: '#how' });
if (existsSync(join(MEDIA, 'hero.webm'))) {
  const withMedia = renderIndex(Object.assign(mediaFound(), { heroMp4: true, heroWebm: true, film169: true, film916: true }));
  const film169 = existsSync(join(ROOT, 'tools', 'film', 'out', 'mana-film-16x9-he.mp4')) ? join(ROOT, 'tools', 'film', 'out', 'mana-film-16x9-he.mp4') : join(MEDIA, 'film-16x9.mp4');
  const film916 = existsSync(join(ROOT, 'tools', 'film', 'out', 'mana-film-9x16-he.mp4')) ? join(ROOT, 'tools', 'film', 'out', 'mana-film-9x16-he.mp4') : join(MEDIA, 'film-9x16.mp4');
  const s3 = await listen(0, { pages: { 'index.html': withMedia }, media: { 'img/hero.webm': join(MEDIA, 'hero.webm'), 'img/hero.mp4': join(MEDIA, 'hero.mp4'), 'img/film-16x9.mp4': film169, 'img/film-9x16.mp4': film916 } });
  await one('hero with a (test) video playing · 390', '/mana/?lang=he&demo=off', { origin: s3.origin, clip: '.hero', before: (p) => p.waitForFunction(() => document.getElementById('hero-phone').getAttribute('data-video') === 'on', null, { timeout: 15000 }).catch(() => {}) });
  await one('Save-Data or reduced motion: still + play button', '/mana/?lang=he&demo=off&save=1', { origin: s3.origin, clip: '.hero' });
  await one('demo band with the film button · 390', '/mana/?lang=he&demo=off', { origin: s3.origin, clip: '#demo' });
  await one('film lightbox open · 390 (tall cut; H.264 does not play in this test browser)', '/mana/?lang=he&demo=off', { origin: s3.origin, before: async (p) => { await p.click('[data-film]'); await p.waitForTimeout(600); }, viewport: true, settle: 600 });
  s3.server.close();
}
await one('the short form, open · 390', '/mana/?lang=he&demo=off', { clip: '#talk-sec', before: (p) => p.evaluate(() => { document.getElementById('talk-more').open = true; }) });
await one('a question, open · 390', '/mana/?lang=en&demo=off', { clip: '#faq', before: (p) => p.evaluate(() => { document.querySelector('.faq details').open = true; }) });
await one('live demo inside the frame · 1440 (viewer: ' + (process.env.MANA_VIEW ? 'published copy' : '../apps/view') + ')', '/mana/?lang=en&vtest=1', { w: 1440, h: 900, clip: '#demo', settle: 9000, before: async (p) => { await p.locator('#phone').scrollIntoViewIfNeeded(); await p.waitForFunction(() => document.querySelector('#phone').getAttribute('data-state') === 'live', null, { timeout: 30000 }).catch(() => {});
  const fr = p.frames().find((f) => f.url().includes('/view/')); if (fr && await fr.evaluate(() => !!(window.__menu && window.__menu.tick)).catch(() => false)) { await fr.evaluate(() => window.__menu.ready); await fr.waitForFunction(() => window.__menu.pending() === 0, null, { timeout: 90000 }).catch(() => {}); await fr.evaluate(() => window.__menu.tick(70, 1 / 30)).catch(() => {}); } } });
/* lay the states out in rows of about 2200 px */
const rows = []; let row = [], rw = 0;
for (const s of states) { if (rw + s.W > 2300 && row.length) { rows.push(row); row = []; rw = 0; } row.push(s); rw += s.W + 14; } if (row.length) rows.push(row);
const rowStrips = [];
for (const r of rows) { const W = r.reduce((a, s) => a + s.W, 0) + 14 * (r.length - 1), H = Math.max(...r.map((s) => s.H)); let x = 0; const comp = []; for (const s of r) { comp.push({ input: s.buf, left: x, top: 0 }); x += s.W + 14; }
  rowStrips.push({ W, H, buf: await sharp({ create: { width: W, height: H, channels: 3, background: '#3a3a3a' } }).composite(comp).png().toBuffer() }); }
await stack(rowStrips, join(OUT, 'sheet-states.jpg'));

/* ---- before and after, same counting, same scale */
const BEFORE_SITE = join(ROOT, '.scratch', 'before', 'site');
if (!existsSync(BEFORE_SITE)) { mkdirSync(join(ROOT, '.scratch', 'before'), { recursive: true }); execFileSync('sh', ['-c', `cd "${ROOT}" && git archive master site | tar -x -C .scratch/before`]); }
const sb = await listen(0, { site: BEFORE_SITE });
const bf = join(TMP, 'before-390-he.png'), bfe = join(TMP, 'before-390-en.png');
measure.pages['before 390 he'] = await shoot('/mana/?lang=he&demo=off', bf, { origin: sb.origin, settle: 300 });
measure.pages['before 390 en'] = await shoot('/mana/?lang=en&demo=off', bfe, { origin: sb.origin, settle: 300 });
sb.server.close();
const b = measure.pages['before 390 he'], a = measure.pages['after 390 he'];
measure.ratio = { height: +(a.height / b.height).toFixed(3), words: +(a.words / b.words).toFixed(3) };
const sc = 0.5;
await stack([await strip(bf, `BEFORE (6 Oct) · 390 px wide, Hebrew, shown at 50% · ${b.height} px tall · ${b.words} visible words`, { cut: 2000, scale: sc }),
  await strip(pages['390he'], `AFTER · ${a.height} px (${Math.round(a.height / b.height * 100)}%) · ${a.words} words (${Math.round(a.words / b.words * 100)}%)`, { cut: 2000, scale: sc, size: 14 })], join(OUT, 'before-after-390.jpg'), { dir: 'h', gap: 40 });
writeFileSync(join(OUT, 'measure.json'), JSON.stringify(measure, null, 1)); console.log(JSON.stringify(measure.pages), JSON.stringify(measure.ratio));
await browser.close(); srv.server.close();
