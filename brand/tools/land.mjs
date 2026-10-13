/* The product page (remaster, 13 Oct 2026): white liquid glass. One HTML holds both languages (class "he" / "en"; <html lang>
   decides). build-site.mjs renderIndex() calls renderLand(); the chrome (head, footer, t, p) is build-site.mjs's own.
   The page's behaviours are brand/src/land/main.js, bundled by build-land.mjs into site/land/ (a module script): the language,
   the reveals, the demo dialog, the form, and the two 3D pieces, loaded on demand (hero-morph.js, floor3d.js). Everything here
   reads, links and shows a good still without that script.
   Words: a dish in the product is a relief from one photo, never a "3D model". Generated media is labelled (class "ai-tag");
   the sample numbers say they are a sample.                                                                                       */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
/* build-site.mjs imports this file, and this file uses build-site's chrome: only inside functions (call time), never at the
   top level, so the import cycle is safe whichever file loads first */
import { head, footer, t, p, mark, waIcon, WA, PREVIEW, mediaFound } from './build-site.mjs';
import { qrPath } from './qr.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LINE = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

/* Plan prices: not set yet. When they are, write each as { he, en } (for example { he: '₪149 לחודש', en: '₪149 a month' }) and
   the card shows it above its button; while null the card shows "Get an offer" only. */
export const PRICES = { p50: null, p100: null, pAll: null };

const DISHES = [['pizza', 'מרגריטה', 'Margherita'], ['burger', 'המבורגר', 'Burger'], ['ramen', 'ראמן', 'Ramen'], ['croissant', 'קרואסון', 'Croissant'], ['shakshuka', 'שקשוקה', 'Shakshuka'], ['gelato', 'גלידה', 'Gelato']];
/* the six ingredients around the hero: [file, top %, inline-start %, size % of the stage, depth 0 (far) .. 1 (near), on phones too] */
const FLOAT = [['basil', 2, 4, 19, 1, 1], ['tomato', 6, 80, 13, .55, 1], ['olive', 40, -2, 13, .25, 0], ['chili', 44, 88, 15, .85, 0], ['lemon', 76, 6, 16, .6, 1], ['rosemary', 80, 74, 18, .3, 0]];
const LOOKS = [['album-side', 'צד א׳', 'Album Side'], ['casablanca-white', 'לבן קזבלנקה', 'Casablanca White'], ['back-door', 'הדלת האחורית', 'Back Door']];
const AI_DISHES = () => t('מנות לדוגמה · נוצרו בבינה מלאכותית', 'Demo dishes · made with AI');
const hrefs = (path, extra = '') => `href="${path}lang=he${extra}" data-href-he="${path}lang=he${extra}" data-href-en="${path}lang=en${extra}"`;
const DEMO = hrefs('./view/?demo=olea&amp;'), SEAT = hrefs('./view/seat/?demo=olea&amp;'), HOST = hrefs('./view/host/?demo=olea&amp;speed=60&amp;');

/* ------------------------------------------------------------------------------------------------ drawings
   Decorative letters and numbers are never text nodes: they are paths, or CSS content on aria-hidden elements. */
const INK = '#16120E';
const QR = qrPath('https://halom.io/mana/view/?demo=olea', { ecc: 'L' });
const qrUse = (cls = '') => `<svg class="qr${cls ? ' ' + cls : ''}" viewBox="-2 -2 ${QR.n + 4} ${QR.n + 4}" shape-rendering="crispEdges" aria-hidden="true"><use href="#mana-qr"/></svg>`;
const defs = `<svg class="defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>
  <symbol id="mana-qr" viewBox="-2 -2 ${QR.n + 4} ${QR.n + 4}"><rect x="-2" y="-2" width="${QR.n + 4}" height="${QR.n + 4}" rx="2" fill="#fff"/><path fill="${INK}" d="${QR.d}"/></symbol>
  <linearGradient id="g-energy" x1="0" y1="0" x2="1" y2=".4"><stop offset="0" stop-color="#F5B120"/><stop offset=".45" stop-color="#FF7A45"/><stop offset="1" stop-color="#E25C7A"/></linearGradient>
  <linearGradient id="g-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF7A45" stop-opacity=".28"/><stop offset="1" stop-color="#F5B120" stop-opacity="0"/></linearGradient>
</defs></svg>`;

/* the three steps: one small scene each (96 × 96), the yolk "serving" travelling through them */
const stepScan = `<svg viewBox="0 0 96 96" aria-hidden="true">
  <g transform="rotate(-9 38 54)"><rect x="17" y="27" width="42" height="54" rx="4" fill="#fff" stroke="${INK}" stroke-width="1.7"/><path d="M25 38h18M25 46h26M25 54h22M25 62h26M25 70h14" stroke="${INK}" stroke-width="1.7" stroke-linecap="round" opacity=".35"/></g>
  <g transform="rotate(8 63 44)"><rect x="46" y="13" width="34" height="62" rx="7.5" fill="${INK}"/><rect x="49.5" y="18.5" width="27" height="51" rx="4" fill="#FFFDF9"/>
    <path d="M54 29h13M54 37h18M54 45h11M54 53h18" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>
    <rect class="scan" x="49.5" y="21" width="27" height="2.6" rx="1.3" fill="#F5B120"/></g>
</svg>`;
const stepType = `<svg viewBox="0 0 96 96" aria-hidden="true">
  <rect x="23" y="16" width="50" height="64" rx="5" fill="#fff" stroke="${INK}" stroke-width="1.7"/>
  <path d="M32 30h20M32 41h24M32 52h17" stroke="${INK}" stroke-width="1.7" stroke-linecap="round" opacity=".35"/>
  <path d="M60 30h5M60 41h5M60 52h5" stroke="#FF7A45" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M32 63h11" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>
  <rect class="caret" x="46" y="57.5" width="2.4" height="11" rx="1.2" fill="#F5B120"/>
</svg>`;
const stepRelief = `<svg viewBox="0 0 96 96" aria-hidden="true">
  <path d="M12 64 38 47l46 10-26 20z" fill="#fff" stroke="${INK}" stroke-width="1.7" stroke-linejoin="round"/>
  <ellipse cx="48" cy="62" rx="19" ry="7.5" fill="none" stroke="${INK}" stroke-width="1.4" opacity=".25"/>
  <path d="M26 50v10M70 50v10" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="1.5 3.5" opacity=".5"/>
  <g class="lift"><ellipse cx="48" cy="42" rx="24" ry="10.5" fill="#FFFDF9" stroke="${INK}" stroke-width="1.7"/><ellipse cx="48" cy="38.5" rx="13" ry="6" fill="#F5B120"/></g>
</svg>`;
const stepCard = `<svg viewBox="0 0 96 96" aria-hidden="true">
  <path d="M18 80h60" stroke="${INK}" stroke-width="1.4" stroke-linecap="round" opacity=".25"/>
  <g transform="rotate(-4 48 48)"><rect x="27" y="13" width="42" height="62" rx="4.5" fill="#fff" stroke="${INK}" stroke-width="1.7"/>
    <g fill="${INK}"><path fill-rule="evenodd" d="M34 21h10v10H34zm2.6 2.6v4.8h4.8v-4.8zM52 21h10v10H52zm2.6 2.6v4.8h4.8v-4.8zM34 39h10v10H34zm2.6 2.6v4.8h4.8v-4.8z"/>
      <path d="M38 25h2v2h-2zM56 25h2v2h-2zM38 43h2v2h-2zM46.5 21h3v3h-3zM46.5 27h3v3h-3zM34 33.5h3v3h-3zM40 33.5h3v3h-3zM46.5 33.5h3v3h-3zM53 33.5h3v3h-3zM59 33.5h3v3h-3zM46.5 40h3v3h-3zM53 40h3v3h-3zM59 46h3v3h-3zM46.5 46h3v3h-3zM53 46h3v3h-3zM59 40h3v3h-3z"/></g>
    <ellipse cx="48" cy="63" rx="9.5" ry="5" fill="none" stroke="${INK}" stroke-width="1.4"/><ellipse class="glow" cx="48" cy="61.8" rx="5" ry="2.7" fill="#F5B120"/></g>
</svg>`;
/* small line icons, 24 × 24 */
const ico = {
  dish: `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="14" rx="9" ry="4.8" ${LINE}/><ellipse cx="12" cy="12.3" rx="4.6" ry="2.4" fill="currentColor"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" ${LINE}/><path d="M12 7.5V12l3 2" ${LINE}/></svg>`,
  globe: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" ${LINE}/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5S9.4 5.9 12 3.5z" ${LINE}/></svg>`,
  shield: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7.5 2.8v5.4c0 4.4-3 7.9-7.5 9.8-4.5-1.9-7.5-5.4-7.5-9.8V5.8z" ${LINE}/><path d="M8.8 12.2l2.3 2.3 4.2-4.4" ${LINE}/></svg>`,
  bell: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.8H5z" ${LINE}/><path d="M10 20.5a2.2 2.2 0 0 0 4 0" ${LINE}/></svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4.2 4.2L18.5 7.8" ${LINE} stroke-width="2"/></svg>`,
  soon: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5" ${LINE} stroke-dasharray="2.4 2.6"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 6v12l10-6z" fill="currentColor"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" ${LINE} stroke-width="2"/></svg>`,
  swipe: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V6M7.5 10.5L12 6l4.5 4.5" ${LINE}/><circle cx="12" cy="20" r="1.6" fill="currentColor"/></svg>`,
  tap: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.4" fill="currentColor"/><circle cx="12" cy="12" r="5.6" ${LINE}/><circle cx="12" cy="12" r="9" ${LINE} opacity=".45"/></svg>`,
  tilt: `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="13" rx="6.5" ry="3.4" ${LINE}/><path d="M3 9.5c0 2.5 0 5 1.8 7.3M3 9.5l-1.3 2.3M3 9.5l2.2 1.3M21 9.5c0 2.5 0 5-1.8 7.3M21 9.5l1.3 2.3M21 9.5l-2.2 1.3" ${LINE}/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" ${LINE} stroke-width="2"/></svg>`
};

/* ------------------------------------------------------------------------------------------------ the six tiles
   Each visual is aria-hidden; its words (a chip, a toggle's letters, a dish name) are CSS content, so copying the section gives
   the tiles' titles and subs only. Every visual's resting state (no animation) is a good still. */
const vizNoApp = `<div class="viz v-noapp" aria-hidden="true"><div class="v-phone"><i class="v-notch"></i><div class="v-screen">
    ${qrUse('v-qr')}<i class="v-scan"></i>
    <div class="v-menu"><img src="./img/dishes/pizza.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><i class="v-l1"></i><i class="v-l2"></i><i class="v-l3"></i></div>
  </div></div><i class="v-cam"></i></div>`;
const vizLang = `<div class="viz v-lang" aria-hidden="true">
    <div class="v-toggle"><i class="v-knob"></i><i class="v-k v-k-en"></i><i class="v-k v-k-he"></i></div>
    <div class="v-dish"><img src="./img/dishes/shakshuka.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><span class="v-names"><i class="v-n v-n-he"></i><i class="v-n v-n-en"></i></span></div>
  </div>`;
const vizSold = `<div class="viz v-sold" aria-hidden="true">
    <div class="v-row v-row-a"><img src="./img/dishes/ramen.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><span class="v-lines"><i></i><i></i></span><i class="v-sw on"></i></div>
    <div class="v-row v-row-b"><img src="./img/dishes/shakshuka.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><span class="v-lines"><i></i><i></i></span><i class="v-sw"></i><i class="v-chip"></i></div>
    <div class="v-row v-row-c"><img src="./img/dishes/croissant.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><span class="v-lines"><i></i><i></i></span><i class="v-sw on"></i></div>
  </div>`;
const vizQr = `<div class="viz v-qrs" aria-hidden="true">
    <div class="v-deck">${['burger', 'gelato', 'ramen'].map((d, i) => `<img style="--i:${i}" src="./img/dishes/${d}.webp" width="640" height="640" alt="" loading="lazy" decoding="async">`).join('')}</div>
    <div class="v-qrcard">${qrUse()}<i class="v-sweep"></i></div>
  </div>`;
const vizDraw = `<div class="viz v-draw" aria-hidden="true"><div class="v-art">
    <svg viewBox="0 0 120 120"><g fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
      <circle class="d1" pathLength="1" cx="58" cy="62" r="40"/><circle class="d2" pathLength="1" cx="58" cy="62" r="33" opacity=".45"/>
      <path class="d3" pathLength="1" d="M95 46l20-13"/>
      <path class="d4" pathLength="1" d="M38 52c3-7 13-8 16-1 2 6-4 11-10 10-5 0-8-4-6-9z"/><circle class="d5" pathLength="1" cx="45" cy="56" r="3.6"/>
      <path class="d6" pathLength="1" d="M62 70c3-7 13-8 16-1 2 6-4 11-10 10-5 0-8-4-6-9z"/><circle class="d7" pathLength="1" cx="69" cy="74" r="3.6"/>
      <path class="d8" pathLength="1" d="M64 40c4-5 12-4 13 2 1 5-4 9-9 8-4-1-6-6-4-10z"/>
      <path class="d9" pathLength="1" d="M36 76l3 2M48 84l2-3M80 54l3-1M54 44l-2-3M30 64l-3 1"/></g></svg>
    <img src="./img/dishes/shakshuka.webp" width="640" height="640" alt="" loading="lazy" decoding="async">
  </div></div>`;
const vizLooks = `<div class="viz v-looks" aria-hidden="true">${LOOKS.map(([id], i) => `<img style="--i:${i}" src="./img/looks/${id}.webp" width="390" height="844" alt="" loading="lazy" decoding="async">`).join('')}</div>`;
const TILES = [
  ['noapp', vizNoApp, 'בלי אפליקציה לסועדים', 'No app for guests', 'מצלמה, קוד, תפריט.', 'Camera, code, menu.'],
  ['lang', vizLang, 'עברית ואנגלית', 'Hebrew and English', 'בנגיעה אחת, לכל סועד.', 'One tap, for every guest.'],
  ['sold', vizSold, '״אזל״ בנגיעה אחת', 'Sold out in one tap', 'המנה נשארת, הסועד יודע.', 'The dish stays; the guest knows.'],
  ['qr', vizQr, 'קוד QR שלא משתנה', 'Your QR never changes', 'משנים תפריט, לא מדפיסים שוב.', 'Change the menu, never reprint.'],
  ['draw', vizDraw, 'איורים עד שיש תמונות', 'Illustrations until you have photos', 'מתחילים היום, מצלמים מחר.', 'Start today, shoot tomorrow.'],
  ['looks', vizLooks, 'המראה של המקום שלכם', 'Your place’s look', 'כמה סגנונות, אחד שלכם.', 'A few styles; one is yours.']
];

/* ------------------------------------------------------------------------------------------------ the floor's still
   The Olea room (seating/fixtures/olea.layout.json) as a light plan on a tilted glass plane; the tables stand on it as small
   lifted pieces in the table-state colours. floor3d.js replaces it with the floating room when it draws. */
const LAYOUT = JSON.parse(readFileSync(join(ROOT, 'seating', 'fixtures', 'olea.layout.json'), 'utf8'));
const STATE = { w1: 'seated', w2: 'free', w3: 'ending', w4: 'seated', h1: 'reserved', h2: 'seated', h3: 'free', h4: 'up', b1: 'seated', b2: 'free', c1: 'reserved', c2: 'seated' };
function floorStill() {
  const { w, d } = LAYOUT.room, ink = 'rgba(22,18,14,.55)';
  const walls = (LAYOUT.walls || []).map((wl) => {
    const a = wl.from, b = wl.to;
    if (wl.kind === 'door' && wl.gap) { const v = [b[0] - a[0], b[1] - a[1]], L = Math.hypot(v[0], v[1]), u = [v[0] / L, v[1] / L], g0 = [a[0] + u[0] * wl.gap[0], a[1] + u[1] * wl.gap[0]], g1 = [a[0] + u[0] * wl.gap[1], a[1] + u[1] * wl.gap[1]];
      return `<path d="M${a} L${g0} M${g1} L${b}" stroke="${ink}" stroke-width=".12" stroke-linecap="round"/>`; }
    return `<path d="M${a} L${b}" stroke="${wl.kind === 'window' ? '#7FA9DB' : ink}" stroke-width="${wl.kind === 'window' ? .14 : .12}" stroke-linecap="round"${wl.kind === 'window' ? ' stroke-dasharray=".6 .2"' : ''}/>`; }).join('');
  const zones = LAYOUT.zones.map((z) => `<rect x="${z.rect[0] + .22}" y="${z.rect[1] + .22}" width="${z.rect[2] - z.rect[0] - .44}" height="${z.rect[3] - z.rect[1] - .44}" rx=".35" fill="rgba(255,255,255,.55)" stroke="rgba(22,18,14,.08)" stroke-width=".04"/>`).join('');
  const plan = `<svg class="fl-plan" viewBox="-.3 -.3 ${w + .6} ${d + .6}" preserveAspectRatio="none"><rect x="-.3" y="-.3" width="${w + .6}" height="${d + .6}" rx=".5" fill="rgba(255,253,249,.7)"/>${zones}${walls}</svg>`;
  const foot = (tb) => tb.shape === 'round' ? { w: (.3 + Math.min(8, tb.seats) * .045) * 2, h: (.3 + Math.min(8, tb.seats) * .045) * 2 } : tb.shape === 'square' ? { w: tb.seats <= 2 ? .72 : .92, h: tb.seats <= 2 ? .72 : .92 } : tb.shape === 'long' ? { w: 1 + Math.ceil(tb.seats / 2) * .62, h: .92 } : { w: Math.max(2.2, tb.seats * .58), h: .5 };
  const tables = LAYOUT.tables.map((tb, i) => { const f = foot(tb), st = STATE[tb.id] || 'free', rot = tb.rot || 0, wide = Math.abs(rot) % 180 === 90;
    const fw = (wide ? f.h : f.w) / w * 100, fh = (wide ? f.w : f.h) / d * 100;
    return `<i class="fl-t ${st}${tb.shape === 'round' ? ' round' : ''}" style="left:${(tb.x / w * 100 - fw / 2).toFixed(2)}%;top:${(tb.z / d * 100 - fh / 2).toFixed(2)}%;width:${fw.toFixed(2)}%;height:${fh.toFixed(2)}%;--i:${i}"><b></b></i>`; }).join('');
  return `<div class="fl-scene"><div class="fl-plane">${plan}${tables}</div></div>`;
}
const FLOOR_KEY = [['free', 'פנוי', 'Free'], ['seated', 'יושבים', 'Seated'], ['ending', 'עוד מעט מתפנה', 'Ending soon'], ['up', 'הזמן נגמר', 'Time is up'], ['reserved', 'שמור', 'Reserved']];

/* ------------------------------------------------------------------------------------------------ the sample dashboard
   Invented sample values, labelled on the page as an example (the same shape the owner app shows from my_stats). */
const SAMPLE = {
  days: [12, 15, 14, 17, 24, 28, 11, 15, 17, 16, 20, 28, 33, 13, 17, 19, 20, 22, 21, 26, 35, 40, 16, 24, 21, 26, 29, 34, 41, 37],       // 30 days of opens; the last 7 add up to views7
  hours: [0, 0, 0, 0, 0, 0, 0, 1, 3, 5, 6, 9, 22, 30, 23, 10, 7, 9, 16, 27, 36, 30, 17, 6],                                          // 24 hours, Israel time
  items: [['shakshuka', 'שקשוקה', 'Shakshuka', 96], ['pizza', 'מרגריטה', 'Margherita', 81], ['ramen', 'ראמן', 'Ramen', 64], ['burger', 'המבורגר', 'Burger', 52], ['croissant', 'קרואסון', 'Croissant', 41]],
  en: 31, qr: 78, adds: 64
};
const views7 = SAMPLE.days.slice(-7).reduce((a, b) => a + b, 0), prev7 = SAMPLE.days.slice(-14, -7).reduce((a, b) => a + b, 0), delta = Math.round((views7 / prev7 - 1) * 100);
function sparkline(v, w = 300, h = 72, pad = 4) {
  const lo = Math.min(...v), hi = Math.max(...v), x = (i) => +(pad + i * (w - 2 * pad) / (v.length - 1)).toFixed(1), y = (n) => +(h - pad - (n - lo) / (hi - lo) * (h - 2 * pad)).toFixed(1);
  const d = v.map((n, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(n)).join('');
  return `<div class="spark" aria-hidden="true"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path class="spark-area" d="${d}L${x(v.length - 1)} ${h}L${x(0)} ${h}z"/><path class="spark-line" pathLength="1" d="${d}"/></svg><i class="spark-dot" style="left:${(x(v.length - 1) / w * 100).toFixed(2)}%;top:${(y(v[v.length - 1]) / h * 100).toFixed(2)}%"></i></div>`;
}
/* busy hours in 3D: the owner app's own breakdown (my_stats: opens per hour of the day, over 30 days), 24 bars standing in a row */
function hoursField() {
  const hMax = Math.max(...SAMPLE.hours);
  const v = [SAMPLE.hours.map((hv) => hv / hMax)];
  const peak = Math.max(...v.flat()); let bars = '';
  v.forEach((row, y) => row.forEach((n, x) => {
    const k = n / peak, lvl = k >= .999 ? 'pk' : k > .75 ? 'v4' : k > .5 ? 'v3' : k > .25 ? 'v2' : k > .05 ? 'v1' : 'v0';
    bars += `<i class="b ${lvl}" style="--x:${x};--y:${y};--h:${Math.max(.04, k).toFixed(3)};--d:${(x * 40)}ms"><b class="t"></b><b class="f"></b><b class="s"></b></i>`;
  }));
  return `<div class="hf-wrap" aria-hidden="true"><div class="hfield">${bars}</div><i class="hf-sweep"></i></div>`;
}
const ring = (val, id) => `<svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle class="ring-bg" cx="50" cy="50" r="42" pathLength="100"/><circle class="ring-v" cx="50" cy="50" r="42" pathLength="100" style="--v:${val}"/></svg>`;
const dashboard = () => `<figure class="dash glass sheen" data-reveal data-live aria-labelledby="dash-cap">
        <figcaption class="dash-top" id="dash-cap"><b class="dash-name">${t('אוליאה', 'Olea')}</b><span class="dash-sample">${t('דוגמה · מספרים להמחשה', 'Example · sample numbers')}</span></figcaption>
        <div class="dash-grid">
          <div class="tile t-views">
            <h3>${t('צפיות השבוע', 'Views this week')}</h3>
            <p class="dash-big num"><span data-count="${views7}">${views7}</span><small class="up"><bdi dir="ltr">+<span data-count="${delta}">${delta}</span>%</bdi></small></p>
            ${sparkline(SAMPLE.days)}
          </div>
          <div class="tile t-hours">
            <h3>${t('שעות עמוסות', 'Busy hours')}</h3>
            ${hoursField()}
          </div>
          <div class="tile t-dishes">
            <h3>${t('מנות מובילות', 'Top dishes')}</h3>
            <ol class="tops">${SAMPLE.items.map(([id, he, en, n], i) => `<li style="--w:${Math.round(n / SAMPLE.items[0][3] * 100)}%;--d:${200 + i * 110}ms"><img src="./img/dishes/${id}.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><span class="tn">${t(he, en)}</span><span class="tb"><i></i></span><b class="num" data-count="${n}">${n}</b></li>`).join('')}</ol>
          </div>
          <div class="tile t-ring">${ring(SAMPLE.en)}<p class="dash-mid num"><bdi dir="ltr"><span data-count="${SAMPLE.en}">${SAMPLE.en}</span>%</bdi></p><h3>${t('תיירים', 'Tourists')}</h3></div>
          <div class="tile t-ring">${ring(SAMPLE.qr)}<p class="dash-mid num"><bdi dir="ltr"><span data-count="${SAMPLE.qr}">${SAMPLE.qr}</span>%</bdi></p><h3>${t('מקוד ה־QR', 'From the QR')}</h3></div>
          <div class="tile t-adds"><span class="adds-ico">${ico.plus}</span><p class="dash-mid num"><span data-count="${SAMPLE.adds}">${SAMPLE.adds}</span></p><h3>${t('ל״שולחן שלי״', 'To “my table”')}</h3></div>
        </div>
        <p class="ai-tag dash-tag">${AI_DISHES()}</p>
      </figure>`;

/* ------------------------------------------------------------------------------------------------ words */
const learn = [
  ['dish', 'יודעים אילו מנות הסועדים פותחים.', 'Know which dishes guests open.'],
  ['clock', 'רואים מתי הכי עמוס.', 'See your busy hours.'],
  ['globe', 'רואים כמה קוראים באנגלית.', 'See how many read in English.'],
  ['shield', 'בלי עוגיות, בלי לשמור דבר על הסועדים.', 'No cookies, nothing stored about guests.']
];
const PLANS = [
  ['p50', 'עד <b>50</b> מנות', 'Up to <b>50</b> dishes', 50],
  ['p100', 'עד <b>100</b> מנות', 'Up to <b>100</b> dishes', 100],
  ['pAll', 'מנות <b>ללא הגבלה</b>', '<b>Unlimited</b> dishes', 0]
];
const INCLUDED = [
  ['תפריט QR עם תבליטים או איורים', 'A QR menu with reliefs or illustrations'],
  ['עברית ואנגלית', 'Hebrew and English'],
  ['״אזל״ בנגיעה אחת', 'Sold out in one tap'],
  ['קוד QR להדפסה, שלא משתנה', 'A printable QR that never changes'],
  ['נתוני צפייה, בלי עוגיות', 'Views data, no cookies']
];
const COMING = [
  ['מפת ישיבה ושעון לכל שולחן', 'A seat map and a clock for every table'],
  ['אתר למסעדה', 'A restaurant website'],
  ['רילסים', 'Reels'],
  ['מראות לבחירה', 'Looks to choose from'],
  ['תשלום ליד השולחן', 'Pay at the table']
];
const faq = [
  ['אילו תמונות עובדות?', 'Which photos work?',
    'מנה אחת, כולה בתוך הפריים, על רקע חלק ובאור רך. תמונת טלפון מספיקה, ולא כל תמונה מצליחה. <a href="./guide/">מדריך הצילום</a>',
    'One dish, all of it in the frame, on a plain background in soft light. A phone photo is enough, and not every photo works. <a href="./guide/">Photo guide</a>'],
  ['זה תלת־ממד אמיתי?', 'Is it real 3D?',
    'זה תבליט: התמונה שלכם מקבלת עומק, ואפשר להטות את המנה מעט. זה לא מודל שמסובבים מכל הכיוונים.',
    'It is a relief: your photo gets depth and the dish tilts a little. It is not a model you turn all the way round.'],
  ['אפשר להזמין דרכו?', 'Can guests order?',
    'לא. מנה היא תפריט. אם יש לכם עמוד הזמנות משלכם, מוסיפים קישור אליו.',
    'No. Mana is a menu. If you have your own ordering page, you add a link to it.'],
  ['מה קורה אחרי 30 יום?', 'After 30 days?',
    'בוחרים חבילה. אם לא ממשיכים, הקישור נשאר שלכם ומציג ״התפריט לא זמין כרגע״. שום דבר לא נמחק.',
    'You choose a plan. If you stop, the link stays yours and shows “This menu is not available right now”. Nothing is deleted.'],
  ['מי עשה את זה?', 'Who made it?',
    '<a href="https://halom.io">Halom</a>, סטודיו קריאייטיב מתל אביב. את המסעדות הראשונות אנחנו מקימים יחד איתכם.',
    '<a href="https://halom.io">Halom</a>, a creative studio in Tel Aviv. We set up the first restaurants together with you.']
];

/* ------------------------------------------------------------------------------------------------ the page */
const top = () => `<header class="top" id="top">
  <div class="top-pill glass">
    <a class="brand" href="./" data-label-he="מנה, לעמוד הראשי" data-label-en="Mana, home" aria-label="מנה, לעמוד הראשי">${mark(INK, 34)}<b>${t('מנה', 'Mana')}</b></a>
    <nav class="top-nav"><a href="#how">${t('איך זה עובד', 'How it works')}</a><a href="#plans">${t('חבילות', 'Plans')}</a><a href="#faq">${t('שאלות', 'Questions')}</a></nav>
    <div class="top-tools">
      <button class="lang" type="button" data-lang-toggle><span class="he" lang="en">English</span><span class="en" lang="he">עברית</span></button>
      <a class="btn btn-glass btn-sm top-demo" ${DEMO} data-demo-open>${ico.play}${t('הדגמה', 'Demo')}</a>
      <a class="btn btn-ink btn-sm" href="./studio/">${t('כניסה', 'Sign in')}</a>
    </div>
  </div>
</header>`;

const hero = () => `<section class="hero" id="hero" aria-labelledby="hero-h" data-live>
  <div class="hero-in wrap">
    <div class="hero-words">
      <p class="eyebrow">${t('מָנָה · כוח החיים שבאוכל', 'Mana · the life force in food')}</p>
      <h1 id="hero-h">${t('רואים את <em>המנה</em> לפני שמזמינים.', 'See <em>the dish</em> before you order.')}</h1>
      ${p('תפריט QR שמראה את המנות שלכם על השולחן. בקרוב באותה חבילה: אתר, רילסים ומפת ישיבה.', 'A QR menu that shows your dishes on the table. Coming to the same package: a website, reels and a seat map.', 'lead')}
      <div class="cta">
        <a class="btn btn-ink btn-lg" href="./studio/">${t('מתחילים בחינם', 'Start free')}</a>
        <a class="btn btn-glass btn-lg" ${DEMO} data-demo-open>${ico.play}${t('לנסות את ההדגמה', 'Try the demo')}</a>
      </div>
    </div>
    <figure class="hero-stage" id="hero-stage" data-hero="still" data-dish="0">
      <div class="hero-box">
        <div class="halo" aria-hidden="true"><i class="halo-ring"></i><i class="halo-orbit"><b></b></i><i class="halo-disc"></i><i class="halo-shadow"></i></div>
        <div class="floaters" aria-hidden="true">${FLOAT.map(([f, top, start, size, depth, phone]) => `<span class="fl${phone ? '' : ' fl-wide'}" style="--top:${top}%;--start:${start}%;--size:${size}%;--z:${depth}"><img src="./img/float/${f}.webp" width="360" height="360" alt="" decoding="async"${phone ? '' : ' loading="lazy"'}></span>`).join('')}</div>
        <div class="stills" aria-hidden="true">${DISHES.map(([id], i) => `<img style="--i:${i}" src="./img/dishes/${id}.webp" width="640" height="640" alt="" decoding="async"${i ? ' loading="lazy" fetchpriority="low"' : ' fetchpriority="high"'}>`).join('')}</div>
        <div class="hero-gl" id="hero-gl"></div>
      </div>
      <figcaption class="hero-cap">
        <span class="dish-names" aria-hidden="true"><span class="dn-stack">${DISHES.map(([id, he, en], i) => `<span class="dn" style="--i:${i}">${t(he, en)}</span>`).join('')}</span></span>
        <span class="ai-tag">${t('המחשה · נוצרה בבינה מלאכותית', 'Illustration · made with AI')}</span>
      </figcaption>
    </figure>
  </div>
</section>`;

const how = () => `<section class="sec how" id="how" aria-labelledby="how-h" data-live>
  <div class="wrap">
    <h2 class="sec-h center" id="how-h">${t('שלושה צעדים', 'Three steps')}</h2>
    <ol class="steps" data-reveal>
      <li class="step glass sheen"><div class="step-art"><span class="if-scan">${stepScan}</span><span class="if-noscan">${stepType}</span></div>
        <p><span class="if-scan">${t('סורקים את התפריט המודפס', 'Scan your printed menu')}</span><span class="if-noscan">${t('מדביקים או מקלידים תפריט', 'Paste or type your menu')}</span></p></li>
      <li class="step glass sheen"><div class="step-art">${stepRelief}</div><p>${t('מוסיפים תמונות או איורים', 'Add photos or illustrations')}</p></li>
      <li class="step glass sheen"><div class="step-art">${stepCard}</div><p>${t('מדפיסים קוד QR', 'Print the QR')}</p></li>
    </ol>
  </div>
</section>`;

const bento = () => `<section class="sec simple" id="simple" aria-labelledby="simple-h" data-live>
  <div class="wrap">
    <h2 class="sec-h center" id="simple-h">${t('פשוט לסועדים. פשוט לכם.', 'Simple for guests. Simple for you.')}</h2>
    <ul class="bento" data-reveal>
      ${TILES.map(([id, viz, th, te, sh, se]) => `<li class="tile-b b-${id} glass sheen">${viz}<div class="b-words"><h3>${t(th, te)}</h3>${p(sh, se, 'b-sub')}${id === 'looks' ? `<span class="chip chip-soon">${t('בקרוב לכל החבילות', 'Coming to every plan')}</span>` : ''}</div></li>`).join('\n      ')}
    </ul>
    <p class="ai-tag center">${AI_DISHES()}</p>
  </div>
</section>`;

const place = () => `<section class="sec place" id="place" aria-labelledby="place-h" data-live>
  <div class="wrap split">
    <div class="split-words">
      <span class="chip chip-new">${t('בקרוב · אפשר לנסות בהדגמה', 'Coming · try the demo')}</span>
      <h2 class="sec-h" id="place-h">${t('המקום שלכם', 'Your place')}</h2>
      ${p('מפת הישיבה של המסעדה, חיה. הסועדים בוחרים אזור או שולחן, אתם מאשרים, ולכל שולחן יש שעון.', 'Your restaurant’s seat map, alive. Guests pick an area or a table, you approve, and every table has a clock.', 'sec-p')}
      <ul class="marks">
        <li>${ico.clock}${t('זמן ישיבה לכל שולחן. אתם קובעים את ברירת המחדל.', 'A seating time for every table. You set the default.')}</li>
        <li>${ico.bell}${t('כשהזמן נגמר, השולחן מתפנה והמנהל מקבל התראה.', 'When time is up, the table frees up and the manager is alerted.')}</li>
      </ul>
      <p class="split-cta"><a class="btn btn-glass btn-lg" ${SEAT} data-demo-open="seat">${t('לנסות את מפת הישיבה', 'Try the seat map')}</a> <a class="btn btn-glass btn-lg" ${HOST} data-demo-open="tables">${t('שעון לשולחן', 'Table clocks')}</a></p>
    </div>
    <figure class="floor glass" id="floor" data-floor="still">
      <div class="floor-stage">
        <div class="floor-still" aria-hidden="true">${floorStill()}</div>
        <div class="floor-gl" id="floor-gl"></div>
      </div>
      <figcaption><ul class="floor-key">${FLOOR_KEY.map(([k, he, en]) => `<li class="${k}"><i aria-hidden="true"></i>${t(he, en)}</li>`).join('')}</ul></figcaption>
    </figure>
  </div>
</section>`;

const numbers = () => `<section class="sec numbers" id="numbers" aria-labelledby="nums-h" data-live>
  <div class="wrap">
    <div class="nums-head">
      <h2 class="sec-h" id="nums-h">${t('מה תדעו על הסועדים', 'What you learn about guests')}</h2>
      <ul class="learn">${learn.map(([i, he, en]) => `<li>${ico[i]}${t(he, en)}</li>`).join('')}</ul>
    </div>
    ${dashboard()}
  </div>
</section>`;

const reels = () => `<section class="sec reels" id="reels" aria-labelledby="reels-h" data-live>
  <div class="wrap split split-rev">
    <div class="split-words">
      <span class="chip chip-soon">${t('בקרוב', 'Coming')}</span>
      <h2 class="sec-h" id="reels-h">${t('האתר שלכם, הרילסים שלכם', 'Your site, your reels')}</h2>
      ${p('אתר למסעדה מתוך אותו תפריט, ורילסים כדי להתחיל לפרסם.', 'A website made from the same menu, and reels to start posting.', 'sec-p')}
    </div>
    <div class="reels-art">
      <div class="site-card glass" aria-hidden="true">
        <div class="site-bar"><i></i><i></i><i></i><span class="site-url"></span></div>
        <div class="site-hero"><img src="./img/dishes/shakshuka.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><div class="site-words"><b class="site-name">${t('אוליאה', 'Olea')}</b><span class="site-l"></span><span class="site-l short"></span><span class="site-book">${t('להזמין שולחן', 'Book a table')}</span></div></div>
        <div class="site-row">${['pizza', 'ramen', 'gelato'].map((d) => `<img src="./img/dishes/${d}.webp" width="640" height="640" alt="" loading="lazy" decoding="async">`).join('')}</div>
      </div>
      <p class="ai-tag site-tag">${AI_DISHES()}</p>
      <figure class="reel">
        <div class="phone"><div class="phone-screen">
          <img class="reel-still" src="./img/host/host-orbit.jpg" width="720" height="1280" alt="" loading="lazy" decoding="async">
          <!-- the film plays (muted, looping) only while the phone is on screen; no source here, so nothing is fetched before then -->
          <video class="reel-video" muted playsinline loop preload="none" width="720" height="1280" tabindex="-1" aria-hidden="true" data-src="./img/host/host-orbit.mp4"></video>
        </div></div>
        <figcaption class="ai-tag">${t('דמות שנוצרה בבינה מלאכותית', 'A person made with AI')}</figcaption>
      </figure>
    </div>
  </div>
</section>`;

const price = (k) => PRICES[k] ? `<p class="plan-price num">${t(PRICES[k].he, PRICES[k].en)}</p>` : '';
const plans = () => `<section class="sec plans" id="plans" aria-labelledby="plans-h" data-live>
  <div class="wrap">
    <h2 class="sec-h center" id="plans-h">${t('חבילות', 'Plans')}</h2>
    ${p('כל חבילה כוללת הכול. ההבדל הוא מספר המנות.', 'Every plan includes everything. The difference is the number of dishes.', 'sec-p center')}
    <ol class="plan-row" data-reveal>
      ${PLANS.map(([k, he, en, n], i) => `<li class="plan glass sheen plan-${k}" style="--i:${i}">
        <i class="plan-dots" aria-hidden="true" style="--n:${n || 150}"></i>
        <h3>${t(he, en)}</h3>
        ${price(k)}<a class="btn ${i === 2 ? 'btn-ink' : 'btn-glass'}" href="#talk-sec">${t('לקבל הצעה', 'Get an offer')}</a>
      </li>`).join('\n      ')}
    </ol>
    <div class="plan-all glass">
      <div class="plan-group"><h3>${t('כלול היום', 'Included today')}</h3><ul>${INCLUDED.map(([he, en]) => `<li>${ico.check}${t(he, en)}</li>`).join('')}</ul></div>
      <div class="plan-group soon"><h3>${t('בקרוב לכל החבילות', 'Coming to every plan')}</h3><ul>${COMING.map(([he, en]) => `<li>${ico.soon}${t(he, en)}</li>`).join('')}</ul></div>
      <div class="plan-free">${p('בכל חבילה: 30 הימים הראשונים חינם, בלי כרטיס אשראי.', 'Every plan: the first 30 days free, no card.')}<a class="btn btn-ink btn-lg" href="./studio/">${t('מתחילים בחינם', 'Start free')}</a></div>
    </div>
  </div>
</section>`;

const questions = () => `<section class="sec qa" id="faq" aria-labelledby="faq-h">
  <div class="wrap qa-in">
    <h2 class="sec-h" id="faq-h">${t('שאלות', 'Questions')}</h2>
    <div class="faq glass">
      ${faq.map(([qh, qe, ah, ae]) => `<details><summary>${t(qh, qe)}</summary><div class="a">${p(ah, ae)}</div></details>`).join('\n      ')}
    </div>
  </div>
</section>`;

const talk = (preview) => `<section class="sec talk" id="talk-sec" aria-labelledby="talk-h">
  <div class="wrap"><div class="talk-card glass">
    <div class="talk-words">
      <h2 class="sec-h" id="talk-h">${t('דברו איתנו', 'Talk to us')}</h2>
      <p class="talk-wa"><a class="btn btn-ink btn-lg" href="${WA}">${waIcon}${t('לכתוב בוואטסאפ', 'Write on WhatsApp')}</a></p>
    </div>
    <details class="talk-form" id="talk-more">
      <summary>${t('או להשאיר פרטים', 'Or leave details')}</summary>
      <form class="form" id="talk" method="post" novalidate${preview ? ' data-off="1"' : ''}>${preview ? `
        <p class="preview-off">${t('זאת תצוגה מקדימה: הטופס כבוי ולא שולח דבר. אפשר לכתוב לנו בוואטסאפ.', 'This is a preview: the form is off and sends nothing. You can write to us on WhatsApp.')}</p>` : ''}
        <div class="field"><label for="f-place">${t('שם המסעדה', 'Restaurant name')}</label><input id="f-place" name="place" type="text" autocomplete="organization" maxlength="120" required aria-describedby="e-place"${preview ? ' disabled' : ''}><p class="err" id="e-place">${t('כתבו את שם המסעדה.', 'Please write the restaurant’s name.')}</p></div>
        <div class="field"><label for="f-contact">${t('טלפון או אימייל', 'Phone or e-mail')}</label><input id="f-contact" name="contact" type="text" inputmode="email" autocomplete="email" maxlength="200" dir="ltr" required aria-describedby="e-contact"${preview ? ' disabled' : ''}><p class="err" id="e-contact">${t('צריך מספר טלפון או כתובת אימייל כדי שנוכל לחזור אליכם.', 'We need a phone number or an e-mail address to get back to you.')}</p></div>
        <div class="field"><label for="f-msg">${t('שאלה <span class="opt">(לא חובה)</span>', 'Question <span class="opt">(optional)</span>')}</label><textarea id="f-msg" name="msg" maxlength="3500" rows="2"${preview ? ' disabled' : ''}></textarea></div>
        <div class="hp" aria-hidden="true"><label for="f-site">Website</label><input id="f-site" name="website" type="text" tabindex="-1" autocomplete="off"></div>
        <label class="check"><input id="f-news" type="checkbox">${t('אפשר לשלוח לי עדכונים על מנה בוואטסאפ או באימייל. אפשר לבטל בכל רגע.', 'You may send me updates about Mana by WhatsApp or e-mail. I can stop them at any time.')}</label>
        <div class="notice notice-bad" id="talk-bad" role="alert" tabindex="-1" hidden><p id="talk-bad-text"></p><p><a class="wa" id="talk-wa" href="${WA}">${waIcon}${t('לשלוח בוואטסאפ', 'Send on WhatsApp')}</a></p></div>
        <div class="form-foot">
          <button class="btn btn-ink" id="f-send" type="submit"${preview ? ' disabled' : ''}><span class="lbl">${t('לשלוח', 'Send')}</span><span class="busy" hidden></span></button>
          <a class="small" href="./privacy/">${t('מה נשמר: דף הפרטיות', 'What we keep: the privacy page')}</a>
        </div>
        <noscript><p class="small">${t('הטופס צריך JavaScript. אפשר לכתוב לנו בוואטסאפ.', 'The form needs JavaScript. You can write to us on WhatsApp.')}</p></noscript>
      </form>
      <div class="notice" id="talk-ok" role="status" tabindex="-1" hidden>
        <h3>${t('קיבלנו, תודה.', 'Received, thank you.')}</h3>
        <p class="has-ref">${t('מספר הפנייה שלכם:', 'Your reference:')} <span class="ref ltr" id="talk-ref"></span></p>
        <p>${t('אדם מהצוות יחזור אליכם. אם זה דחוף, וואטסאפ מהיר יותר.', 'A person from the team will get back to you. If it is urgent, WhatsApp is quicker.')}</p>
        <p><button class="lang" id="talk-again" type="button">${t('לשלוח פנייה נוספת', 'Send another message')}</button></p>
      </div>
    </details>
  </div></div>
</section>`;

/* the demo dialog: the real guest menu in a frame (loaded only while the dialog is open), its looks, the seat map, the film */
function dialog(media) {
  const film = media.film169 || media.film916;
  const filmWide = media.film169 ? 'film-16x9' : 'film-9x16', filmTall = media.film916 ? 'film-9x16' : 'film-16x9';
  const filmAttr = film ? ` data-film-wide="./img/${filmWide}.mp4" data-film-tall="./img/${filmTall}.mp4"` +
    ((media.film169en || media.film916en) ? ` data-film-wide-en="./img/${media.film169en ? 'film-16x9-en' : media.film916en ? 'film-9x16-en' : filmWide}.mp4" data-film-tall-en="./img/${media.film916en ? 'film-9x16-en' : media.film169en ? 'film-16x9-en' : filmTall}.mp4"` : '') : '';
  const tab = (id, he, en, sel) => `<button class="dlg-tab" type="button" data-tab="${id}" aria-pressed="${sel ? 'true' : 'false'}">${t(he, en)}</button>`;
  return `<dialog class="dlg" id="demo" aria-labelledby="dlg-h"${filmAttr}>
  <div class="dlg-sheet">
    <div class="dlg-top">
      <h2 class="vh" id="dlg-h">${t('הדגמה', 'Demo')}</h2>
      <span class="dlg-mark" aria-hidden="true">${mark(INK, 30)}</span>
      <div class="dlg-tabs">${tab('menu', 'התפריט', 'The menu', true)}${tab('looks', 'מראות', 'Looks')}${tab('seat', 'מפת ישיבה', 'Seat map')}${tab('tables', 'שעון לשולחן', 'Table clocks')}${film ? tab('film', 'הסרט', 'The film') : ''}</div>
      <button class="dlg-x" type="button" data-dlg-close data-label-he="לסגור" data-label-en="Close" aria-label="לסגור">${ico.close}</button>
    </div>
    <div class="dlg-body">
      <div class="dlg-looks" hidden>${LOOKS.map(([id, he, en], i) => `<button class="dlg-look" type="button" data-look="${id}" aria-pressed="${i ? 'false' : 'true'}"><img src="./img/looks/${id}.webp" width="390" height="844" alt="" loading="lazy" decoding="async"><span>${t(he, en)}</span></button>`).join('')}</div>
      <div class="dlg-stage"><div class="dlg-phone"><div class="dlg-screen" id="dlg-screen"></div></div>
        <ul class="dlg-gest">${[['swipe', 'מחליקים', 'Swipe'], ['tap', 'נוגעים', 'Tap'], ['tilt', 'מטים', 'Tilt']].map(([i, he, en]) => `<li>${ico[i]}${t(he, en)}</li>`).join('')}</ul></div>
      ${film ? '<div class="dlg-film" hidden><video controls playsinline preload="none"></video></div>' : ''}
    </div>
    <p class="ai-tag dlg-tag">${AI_DISHES()}</p>
  </div>
</dialog>`;
}

export function renderLand(media = mediaFound(), opts = {}) {
  const preview = opts.preview != null ? !!opts.preview : PREVIEW;
  return head({
    titleHe: 'מנה · רואים את המנה לפני שמזמינים', titleEn: 'Mana · See the dish before you order',
    descHe: 'תפריט QR שמראה את המנות שלכם על השולחן, בתבליט. בקרוב באותה חבילה: אתר, רילסים ומפת ישיבה. 30 הימים הראשונים חינם, בלי כרטיס אשראי. מבית Halom.',
    descEn: 'A QR menu that shows your dishes on the table, in relief. Coming to the same package: a website, reels and a seat map. The first 30 days free, no card. By Halom.',
    config: true, styles: ['land.css'], theme: '#F7F4EE'
  }) + `
<body class="land">
<div class="aura" aria-hidden="true"><i class="a1"></i><i class="a2"></i><i class="a3"></i><i class="a4"></i><i class="a5"></i></div>
${defs}
<a class="skip" href="#main">${t('דילוג לתוכן', 'Skip to content')}</a>
${top()}
<main id="main">
${hero()}
${how()}
${bento()}
${place()}
${numbers()}
${reels()}
${plans()}
${questions()}
${talk(preview)}
</main>
${footer('./', INK)}
${dialog(media)}
<script type="module" src="./land/main.js"></script>
</body>
</html>
`;
}
