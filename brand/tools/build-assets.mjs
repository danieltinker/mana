/* Builds the Mana identity files in assets/ from code. No image generation.
   - the mark is two primitives written by hand (a plate seen from a seat, one serving on it)
   - the words are outlines taken from the open fonts (Frank Ruhl Libre, IBM Plex Sans / Sans Hebrew; all SIL OFL 1.1),
     so the SVG files need no font installed
   Run: node tools/build-assets.mjs            (SVG)   then   node tools/render.mjs   (PNG) */
import opentype from 'opentype.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets');
mkdirSync(OUT, { recursive: true });
const F = (p) => { const b = readFileSync(join(ROOT, 'node_modules/@fontsource', p)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };

export const C = { ivory: '#FCF8F6', blush: '#FAD9D5', peach: '#FFC9B6', silver: '#D5D8DC', charcoal: '#434343', black: '#0F0F0F',
  rose: '#9A5238', yolk: '#F5B120', yolkDeep: '#C4860A', table: '#17120D' };

const serifLat = F('frank-ruhl-libre/files/frank-ruhl-libre-latin-500-normal.woff');
const serifHeb = F('frank-ruhl-libre/files/frank-ruhl-libre-hebrew-500-normal.woff');
const sansLat = F('ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff');
const sansHeb = F('ibm-plex-sans-hebrew/files/ibm-plex-sans-hebrew-hebrew-400-normal.woff');

const r = (n) => Math.round(n * 100) / 100;
/* text → { d, w, x0, y0, y1 }: outlines with the baseline at y = 0 and the ink starting at x = 0.
   rtl: the string is given in reading order and laid out right to left. */
function word(font, text, size, { tracking = 0, rtl = false } = {}) {
  const chars = rtl ? [...text].reverse() : [...text];
  let x = 0; const parts = [];
  chars.forEach((ch, i) => {
    const g = font.charToGlyph(ch);
    if (i > 0) { const prev = font.charToGlyph(chars[i - 1]); x += font.getKerningValue(prev, g) * size / font.unitsPerEm + tracking * size; }
    parts.push(g.getPath(x, 0, size));
    x += g.advanceWidth * size / font.unitsPerEm;
  });
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  parts.forEach((p) => { const b = p.getBoundingBox(); if (b.x1 === b.x2) return; x0 = Math.min(x0, b.x1); x1 = Math.max(x1, b.x2); y0 = Math.min(y0, b.y1); y1 = Math.max(y1, b.y2); });
  const d = parts.map((p) => p.commands.map((c) => {
    const X = (v) => r(v - x0);
    if (c.type === 'M') return `M${X(c.x)} ${r(c.y)}`;
    if (c.type === 'L') return `L${X(c.x)} ${r(c.y)}`;
    if (c.type === 'C') return `C${X(c.x1)} ${r(c.y1)} ${X(c.x2)} ${r(c.y2)} ${X(c.x)} ${r(c.y)}`;
    if (c.type === 'Q') return `Q${X(c.x1)} ${r(c.y1)} ${X(c.x)} ${r(c.y)}`;
    return 'Z';
  }).join('')).join('');
  return { d, w: x1 - x0, y0, y1 };
}

/* The mark, on a 64 × 64 field: two ellipses, written by hand.
   A plate the way you see it from your seat, and one serving on it, lifted a little off the plate (the relief).
   The plate is Halom's ring laid on the table; the serving is the one colour Mana owns. Ink box: x 2.3–61.7, y 16.8–50.2. */
export const MARK = { x0: 2.3, x1: 61.7, y0: 16.8, y1: 50.2, cy: 33.5 };
export function mark({ plate = C.black, dish = C.yolk, x = 0, y = 0, s = 1, strokeW = 3.4 } = {}) {
  return `<g transform="translate(${r(x)} ${r(y)}) scale(${r(s)})">` +
    `<ellipse cx="32" cy="33.5" rx="28" ry="15" fill="none" stroke="${plate}" stroke-width="${strokeW}"/>` +
    `<ellipse cx="32" cy="30" rx="15" ry="8" fill="${dish}"/></g>`;
}

const svg = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(w)} ${r(h)}" width="${r(w)}" height="${r(h)}" role="img">` +
  (bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : '') + body + '</svg>\n';
const save = (name, s) => { writeFileSync(join(OUT, name), s); console.log(name, s.length); };

const themes = { light: { ink: C.black, sub: C.charcoal, bg: C.ivory }, dark: { ink: C.ivory, sub: C.silver, bg: C.black } };

/* ---- mark alone */
for (const [t, k] of Object.entries(themes)) {
  save(`mana-mark-${t}.svg`, svg(64, 64, `<title>Mana</title>` + mark({ plate: k.ink })));
}
save('mana-mark-mono-black.svg', svg(64, 64, `<title>Mana</title>` + mark({ plate: C.black, dish: C.black })));
save('mana-mark-mono-white.svg', svg(64, 64, `<title>Mana</title>` + mark({ plate: '#FFFFFF', dish: '#FFFFFF' })));

/* ---- horizontal lockups: mark + word (Latin: mark first; Hebrew: word, then the mark on the right, where a Hebrew line starts) */
const SIZE = 64;
const lat = word(serifLat, 'Mana', SIZE, { tracking: -0.012 });
const heb = word(serifHeb, 'מנה', SIZE, { rtl: true, tracking: 0.01 });
const capH = -word(serifLat, 'M', SIZE).y0;                 // cap height in px
const hebH = -word(serifHeb, 'נ', SIZE).y0;
const PAD = 14, GAP = 17;
/* the mark is as wide as 1.3 letter heights and centred on the middle of the letters */
function geo(h, mid = 0.5) { const ms = (h * 1.3) / (MARK.x1 - MARK.x0), mw = (MARK.x1 - MARK.x0) * ms, base = PAD + h; return { ms, mw, base, mx: -MARK.x0 * ms, my: base - h * mid - MARK.cy * ms }; }
function lockup(kind, t, withBg) {
  const k = themes[t], w = kind === 'latin' ? lat : heb, h = kind === 'latin' ? capH : hebH;
  const { ms, mw, mx, my, base } = geo(h, kind === 'latin' ? 0.43 : 0.5);
  const total = PAD * 2 + mw + GAP + w.w, height = base + PAD + 6;
  const body = kind === 'latin'
    ? mark({ plate: k.ink, x: PAD + mx, y: my, s: ms }) + `<path transform="translate(${r(PAD + mw + GAP)} ${r(base)})" fill="${k.ink}" d="${w.d}"/>`
    : `<path transform="translate(${PAD} ${r(base)})" fill="${k.ink}" d="${w.d}"/>` + mark({ plate: k.ink, x: PAD + w.w + GAP + mx, y: my, s: ms });
  return svg(total, height, `<title>${kind === 'latin' ? 'Mana' : 'מנה'}</title>` + body, withBg ? k.bg : null);
}
for (const kind of ['latin', 'hebrew']) for (const t of ['light', 'dark']) {
  save(`mana-lockup-${kind}-${t}.svg`, lockup(kind, t, false));
}

/* ---- endorsed lockups: the word, the mark, and the studio credit set small underneath */
const byLat = word(sansLat, 'by Halom', 15, { tracking: 0.02 });
const byHeb = word(sansHeb, 'מבית חלום', 15.5, { rtl: true, tracking: 0.01 });
function endorsed(kind, t) {
  const k = themes[t], w = kind === 'latin' ? lat : heb, h = kind === 'latin' ? capH : hebH, by = kind === 'latin' ? byLat : byHeb;
  const { ms, mw, mx, my, base } = geo(h, kind === 'latin' ? 0.43 : 0.5);
  const total = PAD * 2 + mw + GAP + w.w, byBase = base + 30, height = byBase + PAD;
  const wordX = kind === 'latin' ? PAD + mw + GAP : PAD;
  const byX = kind === 'latin' ? wordX + 1.5 : wordX + w.w - by.w - 1;
  const body = (kind === 'latin' ? mark({ plate: k.ink, x: PAD + mx, y: my, s: ms }) : mark({ plate: k.ink, x: PAD + w.w + GAP + mx, y: my, s: ms })) +
    `<path transform="translate(${r(wordX)} ${r(base)})" fill="${k.ink}" d="${w.d}"/>` +
    `<path transform="translate(${r(byX)} ${r(byBase)})" fill="${k.sub}" d="${by.d}"/>`;
  return svg(total, height, `<title>${kind === 'latin' ? 'Mana by Halom' : 'מנה מבית חלום'}</title>` + body);
}
for (const kind of ['latin', 'hebrew']) for (const t of ['light', 'dark']) save(`mana-by-halom-${kind}-${t}.svg`, endorsed(kind, t));

/* ---- bilingual lockup: מנה  [mark]  Mana — for the table card and the page footer */
function bilingual(t) {
  const k = themes[t], { ms, mw, mx, my, base } = geo(capH, 0.45);
  const total = PAD * 2 + lat.w + GAP + mw + GAP + heb.w;
  const body = `<path transform="translate(${PAD} ${r(base)})" fill="${k.ink}" d="${lat.d}"/>` + mark({ plate: k.ink, x: PAD + lat.w + GAP + mx, y: my, s: ms }) +
    `<path transform="translate(${r(PAD + lat.w + GAP + mw + GAP)} ${r(base)})" fill="${k.ink}" d="${heb.d}"/>`;
  return svg(total, base + PAD + 6, '<title>Mana · מנה</title>' + body);
}
for (const t of ['light', 'dark']) save(`mana-lockup-bilingual-${t}.svg`, bilingual(t));

/* ---- favicon (the mark on its own field, readable at 16 px: heavier plate line) and app icons */
save('favicon.svg', svg(64, 64, '<title>Mana</title><rect width="64" height="64" rx="14" fill="' + C.black + '"/>' + mark({ plate: C.ivory, x: 2.6, y: 1.5, s: 0.92, strokeW: 4.6 })));
const icon = (bg, plate, rx) => svg(512, 512, `<title>Mana</title><rect width="512" height="512" rx="${rx}" fill="${bg}"/>` + mark({ plate, x: 64, y: 55, s: 6, strokeW: 3.4 }));
save('app-icon-dark.svg', icon(C.black, C.ivory, 0));         // full bleed: the platform rounds it
save('app-icon-light.svg', icon(C.ivory, C.black, 0));
/* Instagram avatar: 1080 square, everything inside the circle the app crops to */
save('avatar-instagram.svg', svg(1080, 1080, `<title>Mana</title><rect width="1080" height="1080" fill="${C.black}"/>` + mark({ plate: C.ivory, x: 220, y: 205, s: 10, strokeW: 3.4 })));

/* tokens for the other builders */
writeFileSync(join(OUT, 'tokens.json'), JSON.stringify({ colour: C, type: { display: 'Frank Ruhl Libre', text: 'IBM Plex Sans Hebrew', latinText: 'IBM Plex Sans' },
  radius: { s: 6, m: 14, l: 28, pill: 999 }, space: [4, 8, 12, 16, 24, 32, 48, 72, 112] }, null, 2) + '\n');
export const outlines = { lat, heb, capH, hebH, word, fonts: { serifLat, serifHeb, sansLat, sansHeb } };
