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

/* Plan prices: not set yet (Rami sets them). When they are, write each as { he, en } (for example { he: '₪149 לחודש', en: '₪149 a
   month' }) and the card shows it above its button; while null no price is shown. */
export const PRICES = { pMenu: null, pPlace: null, pDream: null };
/* The early-access offer's facts: not set yet (Rami confirms them). spots: a number of places in the founding group; until: the
   last day, as { he, en }. While null the offer speaks of "a small group of founding restaurants" only: no number, no deadline,
   no discount. */
export const EARLY = { spots: null, until: null };

const DISHES = [['pizza', 'מרגריטה', 'Margherita'], ['burger', 'המבורגר', 'Burger'], ['ramen', 'ראמן', 'Ramen'], ['croissant', 'קרואסון', 'Croissant'], ['shakshuka', 'שקשוקה', 'Shakshuka'], ['gelato', 'גלידה', 'Gelato']];
/* the twelve ingredients that levitate through the hero (levitate.js moves them; this is their still composition, also the
   reduced-motion picture): [file, inline-start %, top %, depth 0 (far) .. 3 (near), phone: null (wide screens only) or [x %, y %]] */
const LEV = [
  ['coffee', 47, 9, 0, [88, 62]], ['garlic', 60, 88, 0, null], ['rosemary', 97, 64, 0, null],
  ['olive', 3, 91, 1, [8, 98]], ['chili', 95, 19, 1, null], ['parmesan', 50, 60, 1, null],
  ['basil', 63, 10, 2, [10, 60]], ['lemon', 87, 87, 2, [14, 93]], ['raspberry', 41, 92, 2, [88, 95]], ['strawberry', 76, 6, 2, null],
  ['tomato', 101, 44, 3, [92, 70]], ['mint', 54, 101, 3, [6, 82]]
];
const LOOKS = [['album-side', 'צד א׳', 'Album Side'], ['casablanca-white', 'לבן קזבלנקה', 'Casablanca White'], ['back-door', 'הדלת האחורית', 'Back Door']];
const AI_DISHES = () => t('מנות לדוגמה · נוצרו בבינה מלאכותית', 'Demo dishes · made with AI');
const hrefs = (path, extra = '') => `href="${path}lang=he${extra}" data-href-he="${path}lang=he${extra}" data-href-en="${path}lang=en${extra}"`;
const DEMO = hrefs('./view/?demo=olea&amp;'), SEAT = hrefs('./view/seat/?demo=olea&amp;'), HOST = hrefs('./view/host/?demo=olea&amp;speed=60&amp;');
/* Café Lima, the first place drawn from photos (view/floor/): the counter's board, and the guest's phone at table 3 */
const LIMA = hrefs('./view/floor/?demo=lima&amp;'), LIMA_GUEST = hrefs('./view/floor/guest.html?demo=lima&amp;table=t3&amp;');

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
/* 4. one code, a living menu: the printed card never moves; beside it the menu changes (a new dish, sold out, the look) */
const vizQr = `<div class="viz v-qrs" aria-hidden="true">
    <div class="v-tent"><div class="v-qrcard">${qrUse()}</div><i class="v-stand"></i><i class="v-pulse"></i></div>
    <i class="v-beam"></i>
    <div class="v-live"><i class="v-notch"></i><div class="v-lscreen">
      <div class="v-lrow v-new"><img src="./img/dishes/gelato.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><span class="v-lines"><i></i><i></i></span><i class="v-tag v-tag-new"></i></div>
      <div class="v-lrow v-r1"><img src="./img/dishes/burger.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><span class="v-lines"><i></i><i></i></span><i class="v-price"></i></div>
      <div class="v-lrow v-r2"><img src="./img/dishes/ramen.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><span class="v-lines"><i></i><i></i></span><i class="v-tag v-tag-out"></i></div>
      <div class="v-lrow v-r3"><img src="./img/dishes/pizza.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><span class="v-lines"><i></i><i></i></span><i class="v-price"></i></div>
    </div></div>
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
/* 6. the looks: the same dish, the material under it changing (slate, white linen, dark wood), the menu's screen with it */
const vizLooks = `<div class="viz v-looks" aria-hidden="true">
    <div class="v-surf">${LOOKS.map(([id], i) => `<i class="v-mat m-${id}" style="--i:${i}"></i>`).join('')}<i class="v-wipe"></i></div>
    <div class="v-hero"><i class="v-shadow"></i><img src="./img/dishes/shakshuka.webp" width="640" height="640" alt="" loading="lazy" decoding="async"></div>
    <div class="v-screens">${LOOKS.map(([id], i) => `<img style="--i:${i}" src="./img/looks/${id}.webp" width="390" height="844" alt="" decoding="async" fetchpriority="low">`).join('')}</div>
    <ul class="v-names">${LOOKS.map(([id], i) => `<li class="n-${id}" style="--i:${i}"><i></i></li>`).join('')}</ul>
  </div>`;
const TILES = [
  ['noapp', vizNoApp, 'בלי אפליקציה לסועדים', 'No app for guests', 'מצלמה, קוד, תפריט.', 'Camera, code, menu.'],
  ['lang', vizLang, 'עברית ואנגלית', 'Hebrew and English', 'בנגיעה אחת, לכל סועד.', 'One tap, for every guest.'],
  ['sold', vizSold, '״אזל״ בנגיעה אחת', 'Sold out in one tap', 'המנה נשארת, הסועד יודע.', 'The dish stays; the guest knows.'],
  ['qr', vizQr, 'קוד אחד. תפריט חי.', 'One code. A living menu.', 'הקוד המודפס נשאר. התפריט, המראה, המחירים ו״אזל״ משתנים מתי שרוצים.', 'The printed code stays. The menu, the look, the prices and sold out change whenever you like.'],
  ['draw', vizDraw, 'איורים עד שיש תמונות', 'Illustrations until you have photos', 'מתחילים היום, מצלמים מחר.', 'Start today, shoot tomorrow.'],
  ['looks', vizLooks, 'המראה של המקום שלכם', 'Your place’s look', 'אותה מנה, על אבן, על פשתן לבן, על עץ כהה. בוחרים את המראה שמרגיש כמו המקום.', 'The same dish on stone, on white linen, on dark wood. Choose the look that feels like your place.']
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
/* the race (round two): the same five dishes, day by day through the sample week (opens per day). Each row adds up to the
   dish's sample total above, so the race ends on the sample's order; on the way the dishes overtake each other. */
const RACE = { shakshuka: [7, 9, 11, 13, 16, 20, 20], pizza: [6, 8, 10, 12, 14, 16, 15], ramen: [9, 14, 12, 9, 8, 6, 6], burger: [4, 6, 7, 8, 9, 9, 9], croissant: [12, 10, 6, 4, 3, 3, 3] };
SAMPLE.items.forEach(([id, , , n]) => { if (RACE[id].reduce((a, b) => a + b, 0) !== n) throw new Error('the race does not add up for ' + id); });
const peaks = SAMPLE.hours.map((v, h) => [v, h]).sort((a, b) => b[0] - a[0]).slice(0, 2).map((x) => x[1]).sort((a, b) => a - b);      // 13:00 and 20:00
const hh = (h) => String(h).padStart(2, '0') + ':00';
const INS = { days: SAMPLE.days.slice(-7), hours: SAMPLE.hours, race: SAMPLE.items.map(([id, he, en, n]) => ({ id, he, en, n, d: RACE[id] })), views: views7, delta, qr: SAMPLE.qr, en: SAMPLE.en, adds: SAMPLE.adds, peaks };
/* the still (no WebGL; and the moment before the scene draws): the glass table as the scene frames it, the 24 hours standing
   round its edge, the race track on the glass and the five plates where the week ends. Two framings, like the scene: a wide
   stage (16:9) and a phone (2:3). The world is the scene's: table radius 3, the track 4.4 × 4.6 with five lanes. */
const VIEWS = {
  wide: { w: 1600, h: 900, cx: 800, cy: 470, rx: 470, ry: 330, bar: 150, bw: 16, allow: 1.15 },
  narrow: { w: 1000, h: 1500, cx: 500, cy: 580, rx: 440, ry: 373, bar: 120, bw: 14, allow: 1.6 }
};
const TRK = { w: 4.4, d: 4.6, fin: 1.7 };
const trackGeo = (v) => { const sx = v.rx / 3, sz = v.ry / 3, x0 = v.cx - TRK.w / 2 * sx, x1 = v.cx + TRK.w / 2 * sx, y0 = v.cy - TRK.d / 2 * sz, y1 = v.cy + TRK.d / 2 * sz;
  return { sx, sz, x0, x1, y0, y1, start: v.cx + (-TRK.w / 2 + v.allow) * sx, finish: v.cx + TRK.fin * sx, lane: (r) => y0 + (r + .5) * (y1 - y0) / 5 }; };
/* a plate's place in the still, in % of the stage, measured from the inline start (the race runs from the start side) */
const platePos = (v, r, n) => { const g = trackGeo(v), x = g.start + (g.finish - g.start) * n / SAMPLE.items[0][3]; return [x / v.w * 100, g.lane(r) / v.h * 100]; };
function insStill(k) {
  const v = VIEWS[k], g = trackGeo(v), hMax = Math.max(...SAMPLE.hours);
  const bars = SAMPLE.hours.map((val, h) => { const a = h / 24 * Math.PI * 2, x = v.cx + Math.sin(a) * v.rx * 1.13, y = v.cy - Math.cos(a) * v.ry * 1.13, q = val / hMax, len = 10 + q * v.bar;
    const c = q >= .999 ? 'url(#ins-pk-' + k + ')' : q > .75 ? '#F06B6E' : q > .5 ? '#FF8A55' : q > .25 ? '#F5B120' : q > .05 ? '#F1D49A' : 'rgba(22,18,14,.12)';
    return [y, `<rect x="${(x - v.bw / 2).toFixed(1)}" y="${(y - len).toFixed(1)}" width="${v.bw}" height="${len.toFixed(1)}" rx="${v.bw / 3}" fill="${c}"/>`]; });
  const back = bars.filter((b) => b[0] < v.cy).sort((a, b) => a[0] - b[0]).map((b) => b[1]).join(''), front = bars.filter((b) => b[0] >= v.cy).sort((a, b) => a[0] - b[0]).map((b) => b[1]).join('');
  const lanes = [1, 2, 3, 4].map((r) => `<path d="M${(g.x0 + 20).toFixed(1)} ${(g.y0 + r * (g.y1 - g.y0) / 5).toFixed(1)}H${(g.x1 - 20).toFixed(1)}" stroke="rgba(22,18,14,.2)" stroke-width="3" stroke-dasharray="16 11"/>`).join('');
  const fills = [0, 1, 2, 3, 4].map((r) => `<rect x="${g.x0.toFixed(1)}" y="${(g.y0 + r * (g.y1 - g.y0) / 5).toFixed(1)}" width="${(g.x1 - g.x0).toFixed(1)}" height="${((g.y1 - g.y0) / 5).toFixed(1)}" fill="${r % 2 ? 'rgba(245,177,32,.1)' : 'rgba(255,236,206,.28)'}"/>`).join('');
  const lead = platePos(v, 0, SAMPLE.items[0][3]);
  return `<svg class="ins-svg ins-svg-${k}" viewBox="0 0 ${v.w} ${v.h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs>
    <radialGradient id="ins-glass-${k}" cx=".42" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".96"/><stop offset=".6" stop-color="#fff" stop-opacity=".66"/><stop offset="1" stop-color="#F3E7D6" stop-opacity=".72"/></radialGradient>
    <radialGradient id="ins-core-${k}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFD27A" stop-opacity=".8"/><stop offset=".5" stop-color="#FF7A45" stop-opacity=".22"/><stop offset="1" stop-color="#FF7A45" stop-opacity="0"/></radialGradient>
    <linearGradient id="ins-pk-${k}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#F5B120"/><stop offset=".55" stop-color="#FF7A45"/><stop offset="1" stop-color="#E25C7A"/></linearGradient>
    <radialGradient id="ins-sh-${k}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#462D14" stop-opacity=".22"/><stop offset="1" stop-color="#462D14" stop-opacity="0"/></radialGradient>
    <clipPath id="ins-trk-${k}"><rect x="${g.x0.toFixed(1)}" y="${g.y0.toFixed(1)}" width="${(g.x1 - g.x0).toFixed(1)}" height="${(g.y1 - g.y0).toFixed(1)}" rx="${(g.sx * .62).toFixed(1)}"/></clipPath></defs>
    <ellipse cx="${v.cx}" cy="${v.cy + v.ry * 1.25}" rx="${v.rx * 1.05}" ry="${v.ry * .22}" fill="url(#ins-sh-${k})"/>
    ${back}
    <ellipse cx="${v.cx}" cy="${v.cy + v.ry * .05}" rx="${v.rx}" ry="${v.ry}" fill="rgba(70,45,20,.08)"/>
    <ellipse cx="${v.cx}" cy="${v.cy}" rx="${v.rx}" ry="${v.ry}" fill="url(#ins-glass-${k})" stroke="#fff" stroke-width="3"/>
    <ellipse cx="${v.cx}" cy="${v.cy}" rx="${v.rx * .42}" ry="${v.ry * .42}" fill="url(#ins-core-${k})"/>
    <g clip-path="url(#ins-trk-${k})"><rect x="${g.x0}" y="${g.y0}" width="${g.x1 - g.x0}" height="${g.y1 - g.y0}" fill="rgba(255,255,255,.5)"/>${fills}${lanes}</g>
    <rect x="${g.x0.toFixed(1)}" y="${g.y0.toFixed(1)}" width="${(g.x1 - g.x0).toFixed(1)}" height="${(g.y1 - g.y0).toFixed(1)}" rx="${(g.sx * .62).toFixed(1)}" fill="none" stroke="#fff" stroke-width="4"/>
    <g class="trk-dir"><path d="M${g.start.toFixed(1)} ${(g.y0 + 22).toFixed(1)}V${(g.y1 - 22).toFixed(1)}" stroke="rgba(22,18,14,.32)" stroke-width="5"/><path d="M${g.finish.toFixed(1)} ${(g.y0 + 22).toFixed(1)}V${(g.y1 - 22).toFixed(1)}" stroke="#16120E" stroke-opacity=".55" stroke-width="12" stroke-dasharray="12 12"/>
      <ellipse cx="${(lead[0] / 100 * v.w).toFixed(1)}" cy="${(lead[1] / 100 * v.h).toFixed(1)}" rx="${(g.sx * .9).toFixed(1)}" ry="${(g.sz * .9).toFixed(1)}" fill="url(#ins-core-${k})"/></g>
    ${front}
  </svg>`;
}
const insights = () => `<figure class="ins glass" id="ins" data-ins="still" data-reveal aria-labelledby="ins-cap">
        <figcaption class="ins-top" id="ins-cap"><b class="dash-name">${t('אוליאה', 'Olea')}</b><span class="ins-day" aria-hidden="true"></span><span class="dash-sample">${t('דוגמה · מספרים להמחשה', 'Example · sample numbers')}</span></figcaption>
        <div class="ins-stage">
          <div class="ins-still">${insStill('wide')}${insStill('narrow')}</div>
          <div class="ins-gl" id="ins-gl"></div>
          <div class="ins-layer" aria-hidden="true">
            ${SAMPLE.items.map(([id, he, en, n], r) => { const [x, y] = platePos(VIEWS.wide, r, n), [mx, my] = platePos(VIEWS.narrow, r, n); return `<span class="ip${r ? '' : ' lead'}" data-id="${id}" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--mx:${mx.toFixed(1)}%;--my:${my.toFixed(1)}%"><img src="./img/dishes/${id}.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><b class="ip-r num">${r + 1}</b><span class="ip-w">${t(he, en)}<b class="num">${n}</b></span></span>`; }).join('')}
            <span class="ic ic-views" style="--x:12%;--y:14%;--mx:27%;--my:77%"><small>${t('צפיות השבוע', 'Views this week')}</small><b class="num" data-v="views">${views7}</b><i class="up num"><bdi dir="ltr">+${delta}%</bdi></i></span>
            <span class="ic ic-qr" style="--x:8%;--y:60%;--mx:17%;--my:91%"><b class="num"><bdi dir="ltr">${SAMPLE.qr}%</bdi></b><small>${t('מקוד ה־QR', 'From the QR')}</small></span>
            <span class="ic ic-en" style="--x:92%;--y:54%;--mx:50%;--my:91%"><b class="num"><bdi dir="ltr">${SAMPLE.en}%</bdi></b><small>${t('תיירים', 'Tourists')}</small></span>
            <span class="ic ic-adds" style="--x:88%;--y:86%;--mx:83%;--my:91%"><b class="num">${SAMPLE.adds}</b><small>${t('ל״שולחן שלי״', 'To “my table”')}</small></span>
            <span class="ic ic-peak" style="--x:86%;--y:14%;--mx:73%;--my:77%"><small>${t('הכי עמוס', 'Busiest')}</small><b class="num"><bdi dir="ltr">${peaks.map(hh).join(' · ')}</bdi></b></span>
          </div>
        </div>
        <ul class="vh">
          <li>${t(`צפיות השבוע: ${views7}, ${delta}% יותר מהשבוע הקודם.`, `Views this week: ${views7}, ${delta}% more than the week before.`)}</li>
          <li>${t(`השעות העמוסות: ${peaks.map(hh).join(' ו־')}.`, `Busiest hours: ${peaks.map(hh).join(' and ')}.`)}</li>
          <li>${t('מנות מובילות: ', 'Top dishes: ')}${SAMPLE.items.map(([, he, en, n]) => t(`${he} ${n}`, `${en} ${n}`)).join(', ')}.</li>
          <li>${t(`מקוד ה־QR: ${SAMPLE.qr}%. תיירים: ${SAMPLE.en}%. ל״שולחן שלי״: ${SAMPLE.adds}.`, `From the QR: ${SAMPLE.qr}%. Tourists: ${SAMPLE.en}%. To “my table”: ${SAMPLE.adds}.`)}</li>
        </ul>
        <script type="application/json" id="ins-data">${JSON.stringify(INS)}</script>
        <p class="ai-tag dash-tag">${AI_DISHES()}</p>
      </figure>`;

/* ------------------------------------------------------------------------------------------------ words */
const learn = [
  ['dish', 'יודעים אילו מנות הסועדים פותחים.', 'Know which dishes guests open.'],
  ['clock', 'רואים מתי הכי עמוס.', 'See your busy hours.'],
  ['globe', 'רואים כמה קוראים באנגלית.', 'See how many read in English.'],
  ['shield', 'בלי עוגיות, בלי לשמור דבר על הסועדים.', 'No cookies, nothing stored about guests.']
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
    '<a href="https://halom.io">Halom</a>, a creative studio in Tel Aviv. We set up the first restaurants together with you.'],
  ['מה עובד כבר היום?', 'What works today?',
    'התפריט: תבליטים, עברית ואנגלית, ״אזל״, ״השולחן שלי״ ונתונים כל שבוע. המקום בתלת־ממד, השעונים לשולחנות, ההצעות על שולחנות, האתר, הרילסים והדמות המארחת מסומנים ״בקרוב״, ואפשר לראות חלק מהם בהדגמה.',
    'The menu: reliefs, Hebrew and English, sold out, “my table” and insights every week. Your place in 3D, the table clocks, the bids for a table, the site, the reels and the host are marked “coming”, and you can see some of them in the demo.'],
  ['מה זה גישה מוקדמת?', 'What is early access?',
    'קבוצה קטנה של מסעדות שמתחילות עם מנה עכשיו, יחד איתנו. משאירים פרטים או כותבים בוואטסאפ, ואדם מהצוות חוזר אליכם. 30 הימים הראשונים חינם, בלי כרטיס אשראי.',
    'A small group of restaurants that start with Mana now, together with us. Leave your details or write on WhatsApp, and a person from the team gets back to you. The first 30 days are free, no card.']
];

/* ------------------------------------------------------------------------------------------------ the page */
const top = () => `<header class="top" id="top">
  <div class="top-pill glass">
    <a class="brand" href="./" data-label-he="מנה, לעמוד הראשי" data-label-en="Mana, home" aria-label="מנה, לעמוד הראשי">${mark(INK, 34)}<b>${t('מנה', 'mana')}</b></a>
    <nav class="top-nav"><a href="#how">${t('איך זה עובד', 'How it works')}</a><a href="#plans">${t('חבילות', 'Plans')}</a><a href="#faq">${t('שאלות', 'Questions')}</a></nav>
    <div class="top-tools">
      <button class="lang" type="button" data-lang-toggle><span class="he" lang="en">English</span><span class="en" lang="he">עברית</span></button>
      <a class="btn btn-glass btn-sm top-demo" ${DEMO} data-demo-open>${ico.play}${t('הדגמה', 'Demo')}</a>
      <a class="btn btn-ink btn-sm" href="./studio/">${t('כניסה', 'Sign in')}</a>
    </div>
  </div>
</header>`;

const hero = () => `<section class="hero" id="hero" aria-labelledby="hero-h" data-live>
  <div class="lev" aria-hidden="true">${LEV.map(([f, x, y, d, ph]) => `<span class="lv d${d}${ph ? '' : ' lv-wide'}" data-depth="${d}" style="--x:${x}%;--y:${y}%${ph ? `;--mx:${ph[0]}%;--my:${ph[1]}%` : ''}">${d >= 2 ? '<i class="lv-sh"></i>' : ''}<img src="./img/float/${f}.webp" width="360" height="360" alt="" decoding="async" fetchpriority="low"${ph ? '' : ' loading="lazy"'}></span>`).join('')}</div>
  <div class="hero-in wrap">
    <div class="hero-words">
      <p class="eyebrow">${t('מסעדנות פוגשת טכנולוגיה', 'Hospitality meets technology')}</p>
      <h1 id="hero-h">${t('<em>השולחן</em> הוא רק ההתחלה.', '<em>The table</em> is just the beginning.')}</h1>
      ${p('היום: תפריט שבו האורח רואה כל מנה על השולחן, מתמונה אחת. בקרוב: מפת ישיבה, הצעות על שולחנות בשעות עומס, אתר ורילסים.', 'Today: a menu where guests see every dish on the table, from one photo. Coming: a seat map, peak-time bids for tables, your site and reels.', 'lead')}
      <div class="cta">
        <a class="btn btn-ink btn-lg" href="./studio/">${t('מתחילים בחינם', 'Start free')}</a>
        <a class="btn btn-glass btn-lg" ${DEMO} data-demo-open>${ico.play}${t('לנסות את ההדגמה', 'Try the demo')}</a>
      </div>
    </div>
    <figure class="hero-stage" id="hero-stage" data-hero="still" data-dish="0">
      <div class="hero-box">
        <div class="halo" aria-hidden="true"><i class="halo-ring"></i><i class="halo-orbit"><b></b></i><i class="halo-disc"></i><i class="halo-shadow"></i></div>
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

/* one story instead of three steps (round two): what the whole package does for a restaurant, in one movement. A light runs
   through the three chapters; each says plainly whether it is here today or coming. */
const CHAPTERS = [
  ['menu', true, 'התפריט שלכם מתעורר.', 'Your menu comes alive.', 'כל מנה בתבליט מתמונה אחת, בעברית ובאנגלית, עם ״אזל״ חי ונתונים כל שבוע.', 'Every dish a relief from one photo, in Hebrew and English, with live sold out and insights every week.'],
  ['place', false, 'המקום שלכם על המפה.', 'Your place on the map.', 'המקום בתלת־ממד, בקשות ישיבה, שעון לכל שולחן, ובשעות העומס: הצעות על שולחנות.', 'Your place in 3D, seat requests, a clock on every table and, at peak hours, bids for a table.'],
  ['creative', false, 'הקריאטיב שלכם נוצר.', 'Your creative, made.', 'אתר משלכם, רילסים ודמות מארחת למותג, מבית הסטודיו של Halom.', 'Your own site, reels and a host character for your brand, from the Halom studio.']
];
const chArt = {
  /* a dish lifts off its line on a printed menu, in relief, and settles back; then the next one */
  menu: `<div class="ch-art ch-menu" aria-hidden="true"><div class="ch-card">${[0, 1, 2, 3].map((i) => `<i class="ch-line l${i}"><b></b><s></s></i>`).join('')}
    <img class="ch-dish d1" src="./img/dishes/ramen.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><img class="ch-dish d2" src="./img/dishes/pizza.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><i class="ch-sh"></i></div></div>`,
  /* a small floor in three-quarter view; its tables light up one after another; one is held by a bid (violet) */
  place: `<div class="ch-art ch-place" aria-hidden="true"><div class="ch-plane"><i class="ch-bar"></i>${['free', 'seated', 'ending', 'bid', 'seated', 'free', 'reserved', 'seated'].map((st, i) => `<i class="ch-t ${st}" style="--i:${i}"></i>`).join('')}</div></div>`,
  /* a phone whose creative changes: a reel, a post, the site */
  creative: `<div class="ch-art ch-creative" aria-hidden="true"><div class="ch-phone2"><div class="ch-slides">
    <div class="ch-s s-reel"><i class="ch-prog"></i><img src="./img/dishes/gelato.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><i class="ch-play"></i></div>
    <div class="ch-s s-post"><img src="./img/dishes/croissant.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><i class="ch-tl"></i><i class="ch-tl s"></i><i class="ch-heart"></i></div>
    <div class="ch-s s-site"><i class="ch-dots"></i><img src="./img/dishes/shakshuka.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><i class="ch-btn"></i></div>
  </div></div></div>`
};
const how = () => `<section class="sec story" id="how" aria-labelledby="how-h" data-live>
  <div class="wrap">
    <p class="eyebrow story-eye">${t('פלטפורמה אחת למסעדה', 'One platform for your restaurant')}</p>
    <h2 class="sec-h center" id="how-h">${t('מנה היא יותר מתפריט.', 'Mana is more than a menu.')}</h2>
    <div class="story-thread" aria-hidden="true"><i class="st-line"></i><i class="st-node"></i><i class="st-node"></i><i class="st-node"></i><i class="st-orb"></i></div>
    <ol class="chapters" data-reveal>
      ${CHAPTERS.map(([id, today, th, te, ph, pe], i) => `<li class="chapter glass sheen c-${id}${today ? ' today' : ''}" style="--i:${i}">
        ${chArt[id]}
        <span class="chip ${today ? 'chip-today' : 'chip-soon'}">${today ? t('היום', 'Today') : t('בקרוב', 'Coming')}</span>
        <h3>${t(th, te)}</h3>
        ${p(ph, pe, 'ch-p')}
      </li>`).join('\n      ')}
    </ol>
    ${p('מתחילים היום בתפריט. כל השאר מצטרף לחבילות כשהוא מוכן.', 'Start with the menu today. Everything else joins the plans as it is ready.', 'story-foot center')}
    <p class="ai-tag center">${AI_DISHES()}</p>
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
    <!-- the first real place: Café Lima, drawn from six photos (a first draft): the counter's board (same tab, like every link here) and the guest's phone in the demo -->
    <p class="floor-more" id="floor-more"><span class="floor-more-t">${t('המקום הראשון שצויר מתמונות: קפה לימה, בתלת־ממד. טיוטה ראשונה.', 'The first place drawn from photos: Café Lima, in 3D. A first draft.')}</span>
      <a class="btn btn-glass" ${LIMA}>${t('הלוח של הדלפק', 'The counter’s board')}</a> <a class="btn btn-glass" ${LIMA_GUEST} data-demo-open="lima">${t('הטלפון של האורח', 'The guest’s phone')}</a></p>
  </div>
</section>`;

const numbers = () => `<section class="sec numbers" id="numbers" aria-labelledby="nums-h" data-live>
  <div class="wrap">
    <div class="nums-head">
      <h2 class="sec-h" id="nums-h">${t('מה תדעו על הסועדים', 'What you learn about guests')}</h2>
      <ul class="learn">${learn.map(([i, he, en]) => `<li>${ico[i]}${t(he, en)}</li>`).join('')}</ul>
    </div>
    ${insights()}
  </div>
</section>`;

/* "your dream, our creative" (round two): the studio's side of the package, and the AI host's mini-ad. A phone plays one mood,
   then, with a burst of light and a whip of colour, the next: the same invented woman in another place. The chips name the
   mood as it plays; a tap switches. Muted, inline, only while on screen; the poster first; never with reduced motion or
   Save-Data (then the chips switch the posters). The films are 480p drafts; finals keep the same names. */
const MOODS = [
  ['eat', 'בוקר שטוף שמש', 'A sunlit brunch'],
  ['paris', 'ג׳אז בקפה פריזאי', 'Jazz in a Paris café'],
  ['orbit', 'ערב במסעדה לבנה', 'Evening in a white room']
];
const MADE = [
  ['globe', 'אתר משלכם, מתוך אותו תפריט', 'Your own site, from the same menu'],
  ['play', 'רילסים ותוכן לרשתות', 'Reels and social creative'],
  ['tap', 'דמות מארחת למותג, בכל אווירה', 'A host for your brand, in any mood'],
  ['dish', 'מראה שנבנה למותג שלכם', 'A look designed for your brand']
];
const reels = () => `<section class="sec reels" id="reels" aria-labelledby="reels-h" data-live>
  <div class="wrap split split-rev">
    <div class="split-words">
      <span class="chip chip-soon">${t('בקרוב · מהסטודיו של Halom', 'Coming · from the Halom studio')}</span>
      <h2 class="sec-h" id="reels-h">${t('החלום שלכם, הקריאטיב שלנו', 'Your dream, our creative')}</h2>
      ${p('הסטודיו של Halom בונה את כל מה שסביב התפריט: אתר, רילסים, תוכן לרשתות ודמות שמארחת את המותג שלכם. אתם מספרים מה החלום, אנחנו מביאים אותו למסך.', 'The Halom studio makes everything around the menu: a site, reels, social creative and a host for your brand. You tell us the dream; we bring it to the screen.', 'sec-p')}
      <ul class="marks">${MADE.map(([i, he, en]) => `<li>${ico[i]}${t(he, en)}</li>`).join('')}</ul>
    </div>
    <div class="ad" id="ad" data-mood="eat">
      <div class="site-card glass" aria-hidden="true">
        <div class="site-bar"><i></i><i></i><i></i><span class="site-url"></span></div>
        <div class="site-hero"><img src="./img/dishes/shakshuka.webp" width="640" height="640" alt="" loading="lazy" decoding="async"><div class="site-words"><b class="site-name">${t('אוליאה', 'Olea')}</b><span class="site-l"></span><span class="site-l short"></span><span class="site-book">${t('להזמין שולחן', 'Book a table')}</span></div></div>
        <div class="site-row">${['pizza', 'ramen', 'gelato'].map((d) => `<img src="./img/dishes/${d}.webp" width="640" height="640" alt="" loading="lazy" decoding="async">`).join('')}</div>
      </div>
      <figure class="reel">
        <div class="phone"><div class="phone-screen">
          ${MOODS.map(([id], i) => `<img class="reel-still m-${id}${i ? '' : ' on'}" src="./img/host/host-${id}.jpg" width="${id === 'orbit' ? 720 : 480}" height="${id === 'orbit' ? 1280 : 854}" alt="" loading="lazy" decoding="async">`).join('')}
          <!-- each film plays (muted) only while the phone is on screen; no source here, so nothing is fetched before then -->
          ${MOODS.map(([id]) => `<video class="reel-video m-${id}" muted playsinline preload="none" width="480" height="854" tabindex="-1" aria-hidden="true" data-src="./img/host/host-${id}.mp4"></video>`).join('')}
          <i class="boom" aria-hidden="true"></i>
        </div></div>
        <figcaption class="ai-tag">${t('דמות שנוצרה בבינה מלאכותית', 'A person made with AI')}</figcaption>
      </figure>
      <div class="moods" role="group" aria-label="${'אווירה'}" data-label-he="אווירה" data-label-en="Mood">${MOODS.map(([id, he, en], i) => `<button class="mood" type="button" data-mood="${id}" aria-pressed="${i ? 'false' : 'true'}"><i class="mood-p" aria-hidden="true"></i>${t(he, en)}</button>`).join('')}</div>
    </div>
  </div>
</section>`;

/* packages (round two): three, by what a restaurant gets, not by dishes alone. Each: what it is for, what is in it today, what is
   coming (marked), one button. No prices until Rami sets them (PRICES). Above them the early-access offer; its facts come from
   EARLY only (while null the words stay general). */
const PLANS = [
  ['menu', 'pMenu', 'תפריט', 'Menu', 'התפריט החי, מוכן לשולחן.', 'The living menu, ready for the table.', 'עד 50 מנות', 'Up to 50 dishes',
    [['תבליט מכל תמונה, ואיור עד שיש תמונה', 'A relief from every photo, an illustration until there is one'], ['עברית ואנגלית', 'Hebrew and English'], ['״אזל״ בנגיעה אחת', 'Sold out in one tap'], ['״השולחן שלי״ לסועדים', '“My table” for guests'], ['נתונים כל שבוע, בלי עוגיות', 'Insights every week, no cookies'], ['אפליקציה לבעלים', 'The owner app'], ['קוד QR להדפסה שלא משתנה', 'A printable QR that never changes'], ['חדרים למשקאות ולקינוחים: מרתף יין, ברזי בירה, בר קוקטיילים וויטרינה', 'Rooms for drinks and desserts: a wine cellar, beer taps, a cocktail bar and a vitrine'], ['אנחנו מקימים איתכם: מעבירים את התפריט ומכוונים לצילום', 'We set it up with you: we bring your menu in and guide your photos']],
    [['מראות לבחירה', 'Looks to choose from']]],
  ['place', 'pPlace', 'מקום', 'Place', 'כל המקום, לא רק התפריט.', 'The whole place, not just the menu.', 'עד 100 מנות', 'Up to 100 dishes',
    [['כל מה שב״תפריט״', 'Everything in Menu']],
    [['המקום שלכם בתלת־ממד, מהתמונות שלכם', 'Your place in 3D, from your photos'], ['בקשות ישיבה מהסועדים', 'Seat requests from guests'], ['שעון לכל שולחן והתראות למנהל', 'A clock on every table, alerts for the manager'], ['צפצוף ״ההזמנה מוכנה״ לשירות עצמי', 'An “order ready” beep for self-service']]],
  ['dream', 'pDream', 'חלום', 'Dream', 'המסעדה כמותג, מהשולחן ועד הרשתות.', 'Your restaurant as a brand, from the table to the feeds.', 'מנות ללא הגבלה', 'Unlimited dishes',
    [['כל מה שב״מקום״', 'Everything in Place'], ['סטודיו שעונה לכם ראשונים', 'A studio that answers you first']],
    [['הצעות על שולחנות בשעות העומס', 'Peak-time bids for a table'], ['אתר משלכם מהסטודיו של Halom', 'Your own site by the Halom studio'], ['קריאטיב לרשתות: רילסים ודמות מארחת למותג', 'Social creative: reels and a host for your brand'], ['מראה שנבנה למותג שלכם', 'A look designed for your brand']]]
];
const EARLY_PERKS = [
  ['הקמה אישית יחד עם הסטודיו', 'Set up in person, with the studio'],
  ['ראשונים לכל מה שמסומן ״בקרוב״', 'First to everything marked “coming”'],
  ['קו ישיר לאנשים שבונים את מנה', 'A direct line to the people who build Mana']
];
const price = (k) => PRICES[k] ? `<p class="plan-price num">${t(PRICES[k].he, PRICES[k].en)}</p>` : '';
const earlyFacts = () => [EARLY.spots ? t(`${EARLY.spots} מקומות בקבוצה`, `${EARLY.spots} places in the group`) : '', EARLY.until ? t(EARLY.until.he, EARLY.until.en) : ''].filter(Boolean).map((x) => `<span class="chip">${x}</span>`).join('');
const plans = () => `<section class="sec plans" id="plans" aria-labelledby="plans-h" data-live>
  <div class="wrap">
    <h2 class="sec-h center" id="plans-h">${t('חבילות', 'Plans')}</h2>
    ${p('שלוש חבילות, לפי מה שהמסעדה צריכה: תפריט חי, מקום שלם, או החלום כולו.', 'Three plans, by what your restaurant needs: a living menu, the whole place, or the whole dream.', 'sec-p center')}
    <div class="early" data-reveal>
      <div class="early-in">
        <div class="early-words">
          <span class="chip chip-new">${t('גישה מוקדמת', 'Early access')}</span>${earlyFacts()}
          <h3>${t('המסעדות המייסדות', 'The founding restaurants')}</h3>
          ${p('אנחנו פותחים את מנה לקבוצה קטנה של מסעדות מייסדות. מקימים איתכם הכול, יד ביד, ואתם הראשונים לקבל כל חלק חדש כשהוא מוכן.', 'We are opening Mana to a small group of founding restaurants. We set everything up with you, hand in hand, and you are the first to get each new piece as it is ready.', 'early-p')}
          <ul class="early-perks">${EARLY_PERKS.map(([he, en]) => `<li>${ico.check}${t(he, en)}</li>`).join('')}</ul>
        </div>
        <p class="early-cta"><a class="btn btn-energy btn-lg" href="#talk-sec" data-early="any">${t('בקשת גישה מוקדמת', 'Request early access')}</a></p>
      </div>
    </div>
    <ol class="plan-row" data-reveal>
      ${PLANS.map(([id, k, nh, ne, wh, we, dh, de, today, soon], i) => `<li class="plan glass sheen plan-${id}" style="--i:${i}">
        <i class="plan-mark" aria-hidden="true"></i>
        <h3>${t(nh, ne)}</h3>
        ${p(wh, we, 'plan-for')}
        <p class="plan-n">${t(dh, de)}</p>
        <div class="plan-group"><h4>${t('כלול היום', 'Included today')}</h4><ul>${today.map(([he, en]) => `<li>${ico.check}${t(he, en)}</li>`).join('')}</ul></div>
        ${soon.length ? `<div class="plan-group soon"><h4>${t('בקרוב', 'Coming')}</h4><ul>${soon.map(([he, en]) => `<li>${ico.soon}${t(he, en)}</li>`).join('')}</ul></div>` : ''}
        ${price(k)}<a class="btn ${i === 2 ? 'btn-ink' : 'btn-glass'} plan-btn" href="#talk-sec" data-early="${id}">${t(`בוחרים ב״${nh}״`, `Choose ${ne}`)}</a>
      </li>`).join('\n      ')}
    </ol>
    <div class="plan-free">${p('בכל חבילה: 30 הימים הראשונים חינם, בלי כרטיס אשראי.', 'Every plan: the first 30 days free, no card.')}<a class="btn btn-ink btn-lg" href="./studio/">${t('מתחילים בחינם', 'Start free')}</a></div>
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
        <fieldset class="field plan-pick"><legend>${t('חבילה', 'Plan')}</legend><div class="pick">${[['any', 'עוד לא יודעים', 'Not sure yet'], ['menu', 'תפריט', 'Menu'], ['place', 'מקום', 'Place'], ['dream', 'חלום', 'Dream']].map(([v, he, en], i) => `<label class="pick-o"><input type="radio" name="plan" value="${v}"${i ? '' : ' checked'}${preview ? ' disabled' : ''}>${t(he, en)}</label>`).join('')}</div><input type="hidden" id="f-early" name="early" value=""></fieldset>
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
      <div class="dlg-tabs">${tab('menu', 'התפריט', 'The menu', true)}${tab('looks', 'מראות', 'Looks')}${tab('seat', 'מפת ישיבה', 'Seat map')}${tab('tables', 'שעון לשולחן', 'Table clocks')}${tab('lima', 'קפה לימה', 'Café Lima')}${film ? tab('film', 'הסרט', 'The film') : ''}</div>
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
    titleHe: 'מנה · השולחן הוא רק ההתחלה', titleEn: 'Mana · The table is just the beginning',
    descHe: 'מסעדנות פוגשת טכנולוגיה: תפריט שבו האורח רואה כל מנה על השולחן, בתבליט מתמונה אחת. בקרוב: מפת ישיבה, הצעות על שולחנות, אתר ורילסים. 30 הימים הראשונים חינם, בלי כרטיס אשראי. מבית חלום.',
    descEn: 'Hospitality meets technology: a menu where guests see every dish on the table, a relief from one photo. Coming: a seat map, bids for tables, your site and reels. The first 30 days free, no card. By Halom.',
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
