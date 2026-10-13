/* Writes the product page (version 2), the photo guide, and the privacy and terms pages into site/.
   One HTML file carries both languages: every text node exists twice (class "he" / class "en") and <html lang> decides
   which one shows. The output is plain static HTML: nothing here runs on the host.

   Media the page uses when the files exist in site/img/ (checked HERE, at build time, so a missing file is never requested):
     hero.mp4 (+ hero.webm)              the guest's view, playing in the hero's phone frame      (optional: hero-en.mp4 / .webm)
     film-16x9.mp4, film-9x16.mp4        "Watch the film" (wide screens / phones)                 (optional: film-16x9-en.mp4, film-9x16-en.mp4)
   After adding or removing any of them: run this script again. It prints what it found.
     node tools/build-site.mjs                         build
     node tools/build-site.mjs --poster-from-video[=s] also take the hero poster from hero.mp4 (frame at s seconds, default 0)
     node tools/build-site.mjs --demo-still-from-clip[=s] also take the still behind "Play with it" (img/demo-poster.jpg) from
                                         tools/film/clips/guest-glide.mp4 (frame at s seconds, default 1.7: the second dish in focus)  */
import { writeFileSync, mkdirSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SITE = join(dirname(fileURLToPath(import.meta.url)), '..', 'site');
const ROOT = join(SITE, '..', '..');
/* the page's CSP names the one host the lead form talks to: Supabase's origin, read from the repository's config.js (its publishable key is public) */
export function supabaseOrigin() { try { const m = /supabaseUrl:\s*'(https:\/\/[^']+)'/.exec(readFileSync(join(ROOT, 'config.js'), 'utf8')); return m ? new URL(m[1]).origin : ''; } catch (e) { return ''; } }
export const PREVIEW = process.env.MANA_PREVIEW === '1';      // a preview build: the lead form is rendered switched off (nothing a test build can write to the live backend)
const LIVE = 'https://halom.io/mana/';                       // the address after the next halom.io release (og:url, og:image)
const WA = 'https://wa.me/972542022269';
const UPDATED = { he: '7 באוקטובר 2026', en: '7 October 2026' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/* t(he, en, tag): the same element once per language. Text is trusted HTML written in this file. */
const t = (he, en, tag = 'span', attrs = '') => `<${tag} class="he" lang="he"${attrs ? ' ' + attrs : ''}>${he}</${tag}><${tag} class="en" lang="en"${attrs ? ' ' + attrs : ''}>${en}</${tag}>`;
const p = (he, en, cls = '') => `<p class="he${cls ? ' ' + cls : ''}" lang="he">${he}</p><p class="en${cls ? ' ' + cls : ''}" lang="en">${en}</p>`;
const mark = (plate, w = 44) => `<svg viewBox="0 14 64 39" width="${w}" aria-hidden="true"><ellipse cx="32" cy="33.5" rx="28" ry="15" fill="none" stroke="${plate}" stroke-width="3.4"/><ellipse cx="32" cy="30" rx="15" ry="8" fill="#F5B120"/></svg>`;
const waIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H10l-5 4v-4H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
const LINE = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

/* ------------------------------------------------------------------------------------------------ media */
export function mediaFound(dir = join(SITE, 'img')) {
  const has = (f) => existsSync(join(dir, f));
  return { heroMp4: has('hero.mp4'), heroWebm: has('hero.webm'), heroEnMp4: has('hero-en.mp4'), heroEnWebm: has('hero-en.webm'),
    film169: has('film-16x9.mp4'), film916: has('film-9x16.mp4'), film169en: has('film-16x9-en.mp4'), film916en: has('film-9x16-en.mp4') };
}

/* ------------------------------------------------------------------------------------------------ shared chrome */
const head = ({ titleHe, titleEn, descHe, descEn, base = './', path = '', config = false, note = '' }) => `<!doctype html>
${note ? `<!-- ${note} -->\n` : ''}<html lang="he" dir="rtl" data-title-he="${esc(titleHe)}" data-title-en="${esc(titleEn)}" data-desc-he="${esc(descHe)}" data-desc-en="${esc(descEn)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titleHe)}</title>
<meta name="description" content="${esc(descHe)}">
<!-- Pilot: not for search engines yet. The founder removes this line at launch. -->
<meta name="robots" content="noindex">
<meta name="theme-color" content="${config ? '#0B0907' : '#FCF8F6'}">
<meta http-equiv="Content-Security-Policy" content="connect-src 'self'${supabaseOrigin() ? ' ' + supabaseOrigin() : ''}; frame-src 'self'">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Mana · מנה">
<meta property="og:title" content="${esc(titleHe)}">
<meta property="og:description" content="${esc(descHe)}">
<meta property="og:url" content="${LIVE}${path}">
<meta property="og:image" content="${LIVE}img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="he_IL">
<meta property="og:locale:alternate" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${base}img/favicon.svg" type="image/svg+xml">
<link rel="icon" href="${base}img/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="${base}img/favicon-180.png">
<link rel="preload" href="${base}fonts/frank-ruhl-libre-hebrew-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}tokens.css">
<link rel="stylesheet" href="${base}mana.css">
<script>/* language before first paint: ?lang=, then the last choice, then Hebrew */
(function(){try{var l=new URLSearchParams(location.search).get('lang')||localStorage.getItem('mana-lang');if(l==='en'){document.documentElement.lang='en';document.documentElement.dir='ltr';}}catch(e){}})();</script>${config ? `
<script src="${base}config.js"></script>
<script>/* what the product can do today, before first paint: the menu scanner is named only when it is switched on */
(function(){var c=window.HALOM_MENUS_CONFIG;if(c&&c.features&&c.features.scan===true)document.documentElement.setAttribute('data-scan','1');})();</script>` : ''}
</head>`;

const header = (base = './') => `<header class="top">
  <div class="pill">
    <a class="brand" href="${base}" data-label-he="מנה, לעמוד הראשי" data-label-en="Mana, home" aria-label="מנה, לעמוד הראשי">${mark('#FCF8F6', 36)}<b>${t('מנה', 'Mana')}</b></a>
    <div class="top-tools">
      <button class="lang" type="button" data-lang-toggle><span class="he" lang="en">English</span><span class="en" lang="he">עברית</span></button>
      <a class="btn btn-sm" href="${base}studio/">${t('כניסה', 'Sign in')}</a>
    </div>
  </div>
</header>`;

const footer = (base = './') => `<footer class="foot">
  <div class="wrap">
    <div class="foot-row">
      <a class="brand" href="${base}" aria-label="Mana">${mark('#FCF8F6', 36)}<b>${t('מנה', 'Mana')}</b></a>
      <ul class="foot-links">
        <li><a href="${base}guide/">${t('מדריך צילום', 'Photo guide')}</a></li>
        <li><a href="${base}privacy/">${t('פרטיות', 'Privacy')}</a></li>
        <li><a href="${base}terms/">${t('תנאים', 'Terms')}</a></li>
      </ul>
    </div>
    <p class="foot-fine"><a href="https://halom.io" lang="en" dir="ltr">Mana by Halom</a><bdi dir="ltr" lang="en">Dreams, realized · חלומות מתגשמים</bdi></p>
  </div>
</footer>`;

/* ------------------------------------------------------------------------------------------------ small drawings */
/* the three steps: one small scene each, 96 × 96, drawn in the page's ink with the yolk "serving" travelling through them */
const stepScan = `<svg viewBox="0 0 96 96" aria-hidden="true">
  <g transform="rotate(-9 38 54)"><rect x="17" y="27" width="42" height="54" rx="4" fill="#fff" stroke="#0F0F0F" stroke-width="1.7"/><path d="M25 38h18M25 46h26M25 54h22M25 62h26M25 70h14" stroke="#0F0F0F" stroke-width="1.7" stroke-linecap="round" opacity=".4"/></g>
  <g transform="rotate(8 63 44)"><rect x="46" y="13" width="34" height="62" rx="7.5" fill="#0F0F0F"/><rect x="49.5" y="18.5" width="27" height="51" rx="4" fill="#FCF8F6"/>
    <path d="M54 29h13M54 37h18M54 45h11M54 53h18" stroke="#0F0F0F" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>
    <rect class="scan" x="49.5" y="21" width="27" height="2.6" rx="1.3" fill="#F5B120"/></g>
</svg>`;
const stepType = `<svg viewBox="0 0 96 96" aria-hidden="true">
  <rect x="23" y="16" width="50" height="64" rx="5" fill="#fff" stroke="#0F0F0F" stroke-width="1.7"/>
  <path d="M32 30h20M32 41h24M32 52h17" stroke="#0F0F0F" stroke-width="1.7" stroke-linecap="round" opacity=".4"/>
  <path d="M60 30h5M60 41h5M60 52h5" stroke="#9A5238" stroke-width="1.7" stroke-linecap="round"/>
  <path d="M32 63h11" stroke="#0F0F0F" stroke-width="1.7" stroke-linecap="round"/>
  <rect class="caret" x="46" y="57.5" width="2.4" height="11" rx="1.2" fill="#F5B120"/>
</svg>`;
const stepRelief = `<svg viewBox="0 0 96 96" aria-hidden="true">
  <path d="M12 64 38 47l46 10-26 20z" fill="#fff" stroke="#0F0F0F" stroke-width="1.7" stroke-linejoin="round"/>
  <ellipse cx="48" cy="62" rx="19" ry="7.5" fill="none" stroke="#0F0F0F" stroke-width="1.4" opacity=".3"/>
  <path d="M26 50v10M70 50v10" stroke="#0F0F0F" stroke-width="1.4" stroke-linecap="round" stroke-dasharray="1.5 3.5" opacity=".55"/>
  <g class="lift"><ellipse cx="48" cy="42" rx="24" ry="10.5" fill="#FCF8F6" stroke="#0F0F0F" stroke-width="1.7"/><ellipse cx="48" cy="38.5" rx="13" ry="6" fill="#F5B120"/></g>
</svg>`;
const stepCard = `<svg viewBox="0 0 96 96" aria-hidden="true">
  <path d="M18 80h60" stroke="#0F0F0F" stroke-width="1.4" stroke-linecap="round" opacity=".3"/>
  <g transform="rotate(-4 48 48)"><rect x="27" y="13" width="42" height="62" rx="4.5" fill="#fff" stroke="#0F0F0F" stroke-width="1.7"/>
    <g fill="#0F0F0F"><path fill-rule="evenodd" d="M34 21h10v10H34zm2.6 2.6v4.8h4.8v-4.8zM52 21h10v10H52zm2.6 2.6v4.8h4.8v-4.8zM34 39h10v10H34zm2.6 2.6v4.8h4.8v-4.8z"/>
      <path d="M38 25h2v2h-2zM56 25h2v2h-2zM38 43h2v2h-2zM46.5 21h3v3h-3zM46.5 27h3v3h-3zM34 33.5h3v3h-3zM40 33.5h3v3h-3zM46.5 33.5h3v3h-3zM53 33.5h3v3h-3zM59 33.5h3v3h-3zM46.5 40h3v3h-3zM53 40h3v3h-3zM59 46h3v3h-3zM46.5 46h3v3h-3zM53 46h3v3h-3zM59 40h3v3h-3z"/></g>
    <ellipse cx="48" cy="63" rx="9.5" ry="5" fill="none" stroke="#0F0F0F" stroke-width="1.4"/><ellipse cx="48" cy="61.8" rx="5" ry="2.7" fill="#F5B120"/></g>
</svg>`;
/* stop 5: the engine's own folded name card (paintCard in view/src/gl/stage.js: cream, a double rule), empty, standing in the
   ring of light on the table. The ring is one stroke (pathLength 1), drawn once when the stop comes into view. */
const nameCard = `<svg viewBox="0 0 320 230" aria-hidden="true">
  <defs><linearGradient id="cardFace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f1e7"/><stop offset="1" stop-color="#e3dccf"/></linearGradient>
    <linearGradient id="cardBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfc8bb"/><stop offset="1" stop-color="#b9b2a5"/></linearGradient>
    <radialGradient id="cardShadow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
  <ellipse cx="166" cy="176" rx="96" ry="22" fill="url(#cardShadow)"/>
  <path d="M104 68 L216 68 L212 74 L108 74 Z" fill="url(#cardBack)"/>
  <path d="M100 74 L220 74 L230 170 L90 170 Z" fill="url(#cardFace)"/>
  <path d="M110 86 L210 86 L218 158 L102 158 Z" fill="none" stroke="rgba(60,44,28,.55)" stroke-width="1.6"/>
  <path d="M114 91 L206 91 L213.5 153 L106.5 153 Z" fill="none" stroke="rgba(60,44,28,.35)" stroke-width=".8"/>
  <path d="M90 170 L230 170 L229 172 L91 172 Z" fill="#a89f91"/>
  <path class="card-ring" pathLength="1" d="M160 206 A132 38 0 1 1 160 130 A132 38 0 1 1 160 206"/>
</svg>`;
/* six plain benefits and four "what you learn" lines: 24 × 24 line icons */
const ico = {
  noapp: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.8" width="10" height="18.4" rx="2.6" ${LINE}/><path d="M10.5 18h3" ${LINE}/><path d="M9.8 9.3l4.4 4.4M14.2 9.3l-4.4 4.4" ${LINE}/></svg>`,
  langs: `<svg viewBox="0 0 24 24" aria-hidden="true"><text x="6.5" y="16.5" font-family="Frank Ruhl Libre,serif" font-size="13" font-weight="500" text-anchor="middle" fill="currentColor">א</text><text x="17.2" y="16.5" font-family="Frank Ruhl Libre,serif" font-size="13" font-weight="500" text-anchor="middle" fill="currentColor">A</text><path d="M12 6v12" ${LINE} opacity=".35"/></svg>`,
  soldout: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.8" y="7" width="18.4" height="10" rx="5" ${LINE}/><circle cx="7.8" cy="12" r="2.6" fill="currentColor"/></svg>`,
  qr: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1" ${LINE}/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1" ${LINE}/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1" ${LINE}/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM18 14h2.5M14 18v2.5" ${LINE}/></svg>`,
  draw: `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="10.5" cy="15" rx="8" ry="4.3" ${LINE} stroke-dasharray="2.2 2.6"/><path d="M14.5 10.5l5.3-5.3 1.9 1.9-5.3 5.3-2.5.6z" ${LINE}/></svg>`,
  free: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.4" ${LINE}/><path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" ${LINE}/><text x="12" y="17.6" font-family="Frank Ruhl Libre,serif" font-size="7.5" font-weight="500" text-anchor="middle" fill="currentColor">30</text></svg>`,
  dish: `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="14" rx="9" ry="4.8" ${LINE}/><ellipse cx="12" cy="12.3" rx="4.6" ry="2.4" fill="currentColor"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" ${LINE}/><path d="M12 7.5V12l3 2" ${LINE}/></svg>`,
  globe: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" ${LINE}/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5S9.4 5.9 12 3.5z" ${LINE}/></svg>`,
  shield: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7.5 2.8v5.4c0 4.4-3 7.9-7.5 9.8-4.5-1.9-7.5-5.4-7.5-9.8V5.8z" ${LINE}/><path d="M8.8 12.2l2.3 2.3 4.2-4.4" ${LINE}/></svg>`,
  swipe: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V6M7.5 10.5L12 6l4.5 4.5" ${LINE}/><circle cx="12" cy="20" r="1.6" fill="currentColor"/></svg>`,
  tap: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.4" fill="currentColor"/><circle cx="12" cy="12" r="5.6" ${LINE}/><circle cx="12" cy="12" r="9" ${LINE} opacity=".45"/></svg>`,
  tilt: `<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="13" rx="6.5" ry="3.4" ${LINE}/><path d="M3 9.5c0 2.5 0 5 1.8 7.3M3 9.5l-1.3 2.3M3 9.5l2.2 1.3M21 9.5c0 2.5 0 5-1.8 7.3M21 9.5l1.3 2.3M21 9.5l-2.2 1.3" ${LINE}/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" ${LINE}/></svg>`
};

/* ------------------------------------------------------------------------------------------------ the sample dashboard
   The same numbers the owner app shows from my_stats (BACKEND.md v2). Invented sample values, labelled as such on the page. */
const SAMPLE = {
  days: [12, 15, 14, 17, 24, 28, 11, 15, 17, 16, 20, 28, 33, 13, 17, 19, 20, 22, 21, 26, 35, 40, 16, 24, 21, 26, 29, 34, 41, 37],       // 30 days of opens; the last 7 add up to views7
  hours: [0, 0, 0, 0, 0, 0, 0, 1, 3, 5, 6, 9, 22, 30, 23, 10, 7, 9, 16, 27, 36, 30, 17, 6],                                          // 24 hours, Israel time
  items: [['שקשוקה', 'Shakshuka', 96], ['מרגריטה', 'Margherita', 81], ['שרימפס', 'Shrimp', 64], ['קבב', 'Kebab', 52], ['כנאפה', 'Knafeh', 41]],
  en: 31, qr: 78, adds: 64
};
const views7 = SAMPLE.days.slice(-7).reduce((a, b) => a + b, 0), prev7 = SAMPLE.days.slice(-14, -7).reduce((a, b) => a + b, 0), delta = Math.round((views7 / prev7 - 1) * 100);
function sparkline(v, w = 132, h = 40, pad = 3) {
  const lo = Math.min(...v), hi = Math.max(...v), x = (i) => +(pad + i * (w - 2 * pad) / (v.length - 1)).toFixed(1), y = (n) => +(h - pad - (n - lo) / (hi - lo) * (h - 2 * pad)).toFixed(1);
  const d = v.map((n, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(n)).join('');
  /* the line is stretched to its tile, so today's dot is a separate round element placed at the line's end */
  return `<div class="spark" aria-hidden="true"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path class="spark-area" d="${d}L${x(v.length - 1)} ${h}L${x(0)} ${h}z"/><path class="spark-line" d="${d}"/></svg><i class="spark-dot" style="left:${(x(v.length - 1) / w * 100).toFixed(2)}%;top:${(y(v[v.length - 1]) / h * 100).toFixed(2)}%"></i></div>`;
}
const hourMax = Math.max(...SAMPLE.hours), itemMax = SAMPLE.items[0][2];
const dashboard = () => `<figure class="dash reveal" aria-labelledby="dash-cap">
        <figcaption class="dash-top" id="dash-cap"><b class="dash-name">${t('אוליאה', 'Olea')}</b><span class="dash-sample">${t('דוגמה, מספרים להמחשה', 'Example, sample numbers')}</span></figcaption>
        <div class="dash-grid">
          <div class="tile tile-views">
            <div><h3>${t('צפיות השבוע', 'Views this week')}</h3><p class="dash-big num">${views7}<small class="up"><bdi dir="ltr">+${delta}%</bdi></small></p></div>
            ${sparkline(SAMPLE.days)}
          </div>
          <div class="tile tile-dishes">
            <h3>${t('מנות מובילות', 'Top dishes')}</h3>
            <ol class="bars">${SAMPLE.items.map(([he, en, n], i) => `<li>${t(he, en)}<i style="--w:${Math.round(n / itemMax * 100)}%;--d:${i * 70}ms"></i></li>`).join('')}</ol>
          </div>
          <div class="tile tile-hours">
            <h3>${t('שעות עמוסות', 'Busy hours')}</h3>
            <div class="hours" dir="ltr" aria-hidden="true">${SAMPLE.hours.map((n, i) => `<i${n === hourMax ? ' class="peak"' : ''} style="--h:${Math.max(4, Math.round(n / hourMax * 100))}%;--d:${i * 18}ms"></i>`).join('')}</div>
            <div class="hours-ticks num" dir="ltr" aria-hidden="true"><span style="--x:12">12</span><span style="--x:20">20</span></div>
          </div>
          <div class="tile tile-s"><p class="dash-mid num"><bdi dir="ltr">${SAMPLE.en}%</bdi></p><h3>${t('תיירים', 'Tourists')}</h3><span class="share" style="--w:${SAMPLE.en}%"></span></div>
          <div class="tile tile-s"><p class="dash-mid num"><bdi dir="ltr">${SAMPLE.qr}%</bdi></p><h3>${t('מקוד ה־QR', 'From the QR')}</h3><span class="share" style="--w:${SAMPLE.qr}%"></span></div>
          <div class="tile tile-s"><p class="dash-mid num">${SAMPLE.adds}</p><h3>${t('ל״שולחן שלי״', 'To “my table”')}</h3></div>
        </div>
      </figure>`;

/* ------------------------------------------------------------------------------------------------ index */
const perks = [
  ['noapp', 'בלי אפליקציה לסועדים', 'No app for guests'],
  ['langs', 'עברית ואנגלית', 'Hebrew and English'],
  ['soldout', '״אזל״ בנגיעה אחת', 'Sold out in one tap'],
  ['qr', 'קוד QR שלא משתנה', 'Your QR never changes'],
  ['draw', 'איורים עד שיש תמונות', 'Illustrations until you have photos'],
  ['free', '30 יום חינם', 'Free for 30 days']
];
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
    'את ההמשך מסכמים איתנו ישירות. אם לא ממשיכים, הקישור נשאר שלכם ומציג "התפריט לא זמין כרגע". שום דבר לא נמחק.',
    'What follows is agreed with us directly. If you stop, the link stays yours and shows “This menu is not available right now”. Nothing is deleted.'],
  ['מי עשה את זה?', 'Who made it?',
    '<a href="https://halom.io">Halom</a>, סטודיו קריאייטיב מתל אביב. מנה נמצאת בפיילוט, ואת המסעדות הראשונות אנחנו מלווים בעצמנו.',
    '<a href="https://halom.io">Halom</a>, a creative studio in Tel Aviv. Mana is in pilot, and we look after the first restaurants ourselves.']
];

export function renderIndex(media = mediaFound(), opts = {}) {
  const preview = opts.preview != null ? !!opts.preview : PREVIEW;
  const heroVideo = media.heroMp4 || media.heroWebm;
  const film = media.film169 || media.film916;
  const filmWide = media.film169 ? 'film-16x9' : 'film-9x16', filmTall = media.film916 ? 'film-9x16' : 'film-16x9';
  const filmAttr = film ? ` data-film-wide="./img/${filmWide}.mp4" data-film-tall="./img/${filmTall}.mp4"` +
    ((media.film169en || media.film916en) ? ` data-film-wide-en="./img/${media.film169en ? 'film-16x9-en' : media.film916en ? 'film-9x16-en' : filmWide}.mp4" data-film-tall-en="./img/${media.film916en ? 'film-9x16-en' : media.film169en ? 'film-16x9-en' : filmTall}.mp4"` : '') : '';
  return head({
    titleHe: 'מנה · רואים את המנה לפני שמזמינים', titleEn: 'Mana · See the dish before you order',
    descHe: 'תפריט QR שמראה את המנות שלכם על השולחן, בתבליט. בונים לבד, והסועדים פותחים בלי אפליקציה. חינם ל־30 יום מהפרסום הראשון. מבית Halom.',
    descEn: 'A QR menu that shows your dishes on the table, in relief. You build it yourself; guests open it with no app. Free for 30 days from your first publish. By Halom.',
    config: true
  }) + `
<body>
<a class="skip" href="#main">${t('דילוג לתוכן', 'Skip to content')}</a>
${header()}
<main id="main">

<section class="hero table" aria-labelledby="hero-h">
  <div class="hero-grid">
    <div class="hero-words">
      <h1 id="hero-h">${t('רואים את המנה לפני שמזמינים.', 'See the dish before you order.')}</h1>
      ${p('תפריט QR שמראה את המנות שלכם על השולחן.', 'A QR menu that shows your dishes on the table.', 'lead')}
    </div>
    <figure class="hero-stage" id="hero-stage" data-hero="still" data-src-he="./view/?demo=solo&amp;embed=hero&amp;lang=he" data-src-en="./view/?demo=solo&amp;embed=hero&amp;lang=en" data-title-he="המנה על השולחן: תבליט חי, אפשר לסובב" data-title-en="The dish on the table: a live relief you can turn">
      <!-- The dish's flat photo paints first. mana.js places it where the live dish will stand (the same framing the guest view
           uses), then, after the page has painted and never on Save-Data, adds the guest view in hero mode as an iframe here;
           the live relief rises in the same place. Off screen the page tells the frame to stop its clock. -->
      <img class="hero-poster" src="./img/hero-dish.webp" width="640" height="640" alt="" data-alt="1" fetchpriority="high" decoding="async">
      <div class="cta">
        <a class="btn btn-primary" href="./studio/">${t('מתחילים בחינם', 'Start free')}</a>
        <a class="btn" href="./view/?demo=olea&amp;lang=he" data-href-he="./view/?demo=olea&amp;lang=he" data-href-en="./view/?demo=olea&amp;lang=en" data-demo-link>${t('לנסות את ההדגמה', 'Try the demo')}</a>
      </div>
      <figcaption class="demo-tag"><b>${t('מנות לדוגמה · נוצרו בבינה מלאכותית', 'Demo dishes · made with AI')}</b><span class="hero-hint" hidden> · ${t('גוררים כדי לסובב', 'Drag to turn')}</span></figcaption>
    </figure>
  </div>
</section>

<section class="flow reveal" id="how" aria-labelledby="how-h">
  <div class="wrap">
    <h2 id="how-h">${t('שלושה צעדים', 'Three steps')}</h2>
    <div class="flow-rail">
      <svg class="flow-line" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true"><path class="straight" pathLength="1" d="M0 12H100"/><path class="wave" pathLength="1" d="M0 12C9 3 17 3 25 12s16 9 25 0 16-9 25 0 16 9 25 0"/></svg>
      <svg class="flow-chev c1" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>
      <svg class="flow-chev c2" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2l4 4-4 4"/></svg>
      <ol class="flow-row">
        <li class="flow-step">
          <div class="flow-disc"><span class="flow-n num" aria-hidden="true">1</span><span class="if-scan">${stepScan}</span><span class="if-noscan">${stepType}</span></div>
          <p><span class="if-scan">${t('סורקים את התפריט המודפס', 'Scan your printed menu')}</span><span class="if-noscan">${t('מדביקים או מקלידים תפריט', 'Paste or type your menu')}</span></p>
        </li>
        <li class="flow-step">
          <div class="flow-disc"><span class="flow-n num" aria-hidden="true">2</span>${stepRelief}</div>
          <p>${t('מוסיפים תמונות או איורים', 'Add photos or illustrations')}</p>
        </li>
        <li class="flow-step">
          <div class="flow-disc"><span class="flow-n num" aria-hidden="true">3</span>${stepCard}</div>
          <p>${t('מדפיסים קוד QR', 'Print the QR')}</p>
        </li>
      </ol>
    </div>
  </div>
</section>

<section class="band-dark demo" id="demo" aria-labelledby="demo-h">
  <div class="wrap demo-grid">
    <div class="demo-words">
      <h2 id="demo-h">${t('נסו בעצמכם', 'Try it yourself')}</h2>
      <ul class="gest">
        <li>${ico.swipe}${t('מחליקים', 'Swipe')}</li>
        <li>${ico.tap}${t('נוגעים', 'Tap')}</li>
        <li>${ico.tilt}${t('מטים', 'Tilt')}</li>
      </ul>${film ? `
      <p class="demo-film"><a class="btn" href="./img/${filmWide}.mp4" data-film${filmAttr}>${ico.play}${t('לצפות בסרט', 'Watch the film')}</a></p>` : ''}
    </div>
    <div class="demo-stage" id="phone" data-state="still">
      <div class="phone">
        <div class="phone-screen">
          <img class="phone-poster" src="./img/demo-poster.jpg" width="720" height="1560" loading="lazy" decoding="async" alt="" data-alt="2">
          <a class="btn btn-primary demo-play" href="./view/?demo=olea&amp;lang=he" data-href-he="./view/?demo=olea&amp;lang=he" data-href-en="./view/?demo=olea&amp;lang=en" data-demo-start>${ico.play}${t('לשחק עם זה', 'Play with it')}</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="nums" id="numbers" aria-labelledby="nums-h">
  <div class="wrap nums-grid">
    <div class="nums-words">
      <h2 id="nums-h">${t('מה תדעו על הסועדים', 'What you learn about guests')}</h2>
      <ul class="learn">
        ${learn.map(([i, he, en]) => `<li>${ico[i]}${t(he, en)}</li>`).join('\n        ')}
      </ul>
    </div>
    <div class="nums-dash">
      ${dashboard()}
    </div>
  </div>
</section>

<section class="perks" aria-labelledby="perks-h">
  <div class="wrap">
    <h2 class="vh" id="perks-h">${t('מה מקבלים', 'What you get')}</h2>
    <ul>
      ${perks.map(([i, he, en]) => `<li>${ico[i]}${t(he, en)}</li>`).join('\n      ')}
    </ul>
  </div>
</section>

<section class="start table reveal" id="price" aria-labelledby="price-h">
  <div class="wrap start-grid">
    <div class="start-words">
      <h2 class="big" id="price-h">${t('30 יום חינם', '30 days free')}</h2>
      ${p('מהפרסום הראשון, בלי כרטיס אשראי. את ההמשך מסכמים איתנו ישירות, במהלך הפיילוט.', 'From your first publish, no card. What follows is agreed directly, during the pilot.')}
      <div class="cta">
        <a class="btn btn-primary" href="./studio/">${t('מתחילים בחינם', 'Start free')}</a>
        <span class="soon"><i aria-hidden="true"></i>${t('תשלום ליד השולחן · בקרוב', 'Pay at the table · coming')}</span>
      </div>
    </div>
    <figure class="start-card" role="img" data-label-he="כרטיס שם ריק עומד על השולחן, בתוך טבעת אור" data-label-en="An empty name card standing on the table, in a ring of light" aria-label="כרטיס שם ריק עומד על השולחן, בתוך טבעת אור">
      ${nameCard}
    </figure>
  </div>
</section>

<section class="qa" id="faq" aria-labelledby="faq-h">
  <div class="wrap qa-grid">
    <h2 id="faq-h">${t('שאלות', 'Questions')}</h2>
    <div class="faq">
      ${faq.map(([qh, qe, ah, ae]) => `<details><summary>${t(qh, qe)}</summary><div class="a">${p(ah, ae)}</div></details>`).join('\n      ')}
    </div>
  </div>
</section>

<section class="talk" id="talk-sec" aria-labelledby="talk-h">
  <div class="wrap talk-grid">
    <div class="talk-words">
      <h2 id="talk-h">${t('דברו איתנו', 'Talk to us')}</h2>
      <p class="talk-wa"><a class="btn btn-ink" href="${WA}">${waIcon}${t('לכתוב בוואטסאפ', 'Write on WhatsApp')}</a></p>
    </div>
    <details class="talk-form" id="talk-more">
      <summary>${t('או להשאיר פרטים', 'Or leave details')}</summary>
      <form class="form" id="talk" novalidate${preview ? ' data-off="1"' : ''}>${preview ? `
        <p class="preview-off">${t('זאת תצוגה מקדימה: הטופס כבוי ולא שולח דבר. אפשר לכתוב לנו בוואטסאפ.', 'This is a preview: the form is off and sends nothing. You can write to us on WhatsApp.')}</p>` : ''}
        <div class="field"><label for="f-place">${t('שם המסעדה', 'Restaurant name')}</label><input id="f-place" name="place" type="text" autocomplete="organization" maxlength="120" required aria-describedby="e-place"${preview ? ' disabled' : ''}><p class="err" id="e-place">${t('כתבו את שם המסעדה.', 'Please write the restaurant’s name.')}</p></div>
        <div class="field"><label for="f-contact">${t('טלפון או אימייל', 'Phone or e-mail')}</label><input id="f-contact" name="contact" type="text" inputmode="email" autocomplete="email" maxlength="200" dir="ltr" required aria-describedby="e-contact"${preview ? ' disabled' : ''}><p class="err" id="e-contact">${t('צריך מספר טלפון או כתובת אימייל כדי שנוכל לחזור אליכם.', 'We need a phone number or an e-mail address to get back to you.')}</p></div>
        <div class="field"><label for="f-msg">${t('שאלה <span class="opt">(לא חובה)</span>', 'Question <span class="opt">(optional)</span>')}</label><textarea id="f-msg" name="msg" maxlength="3500" rows="2"${preview ? ' disabled' : ''}></textarea></div>
        <div class="hp" aria-hidden="true"><label for="f-site">Website</label><input id="f-site" name="website" type="text" tabindex="-1" autocomplete="off"></div>
        <label class="check"><input id="f-news" type="checkbox">${t('אפשר לשלוח לי עדכונים על מנה בוואטסאפ או באימייל. אפשר לבטל בכל רגע.', 'You may send me updates about Mana by WhatsApp or e-mail. I can stop them at any time.')}</label>
        <div class="notice notice-bad" id="talk-bad" role="alert" tabindex="-1" hidden><p id="talk-bad-text"></p><p><a class="wa" id="talk-wa" href="${WA}">${waIcon}${t('לשלוח בוואטסאפ', 'Send on WhatsApp')}</a></p></div>
        <div class="form-foot">
          <button class="btn btn-primary" id="f-send" type="submit"${preview ? ' disabled' : ''}><span class="lbl">${t('לשלוח', 'Send')}</span><span class="busy" hidden></span></button>
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
  </div>
</section>

</main>
${footer()}
${film ? `<dialog class="film" id="film" aria-labelledby="film-t">
  <h2 class="vh" id="film-t">${t('הסרט של מנה', 'The Mana film')}</h2>
  <video controls playsinline preload="none"></video>
  <button class="film-x" type="button" data-film-close data-label-he="לסגור" data-label-en="Close" aria-label="לסגור">${ico.close}</button>
</dialog>
` : ''}<script src="./mana.js"></script>
<script>/* picture descriptions, per language */
(function(){var A={he:{1:'צלחת חומוס חם על שולחן עץ כהה, תחת מנורה אחת',2:'תפריט ההדגמה: שבע מנות מונחות על שולחן עץ'},en:{1:'A plate of warm hummus on a dark wooden table, under one lamp',2:'The demo menu: seven dishes lying on a wooden table'}};
function f(){var l=document.documentElement.lang==='en'?'en':'he';[].forEach.call(document.querySelectorAll('img[data-alt]'),function(i){i.alt=A[l][i.getAttribute('data-alt')];});}f();document.addEventListener('mana:lang',f);})();</script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------------------------------------ guide (unchanged copy, new header and footer) */
const rules = [
  ['מנה אחת בכל תמונה, וכולה בתוך הפריים, עם מעט שוליים מסביב.', 'One dish per photo, all of it inside the frame, with a little margin around it.'],
  ['מצלמים מהזווית שבה רואים צלחת כשיושבים לשולחן: בערך 45 מעלות מעליה. צילום ישר מלמעלה יוצא שטוח; צילום מגובה השולחן מסתיר את האוכל.', 'Shoot from the angle you see a plate when you sit down: about 45 degrees above it. Straight from the top comes out flat; from table height hides the food.'],
  ['רקע חלק, בצבע שונה מהצלחת. שולחן כהה או מפה כהה הם הכי טובים. צלחת לבנה על מפה לבנה היא המקרה הקשה ביותר.', 'A plain background that is not the plate’s colour. A dark table or cloth is best. A white plate on a white cloth is the hardest case.'],
  ['אור רך, בלי פלאש. ליד חלון זה מצוין; שמש ישירה פחות.', 'Soft light, no flash. Next to a window is ideal; direct sun less so.'],
  ['בלי ידיים, בלי סכו״ם שחוצה את שפת הצלחת, ובלי מנה שנייה שנוגעת בה.', 'No hands, no cutlery crossing the rim of the plate, and no second dish touching it.'],
  ['משקאות: כוס או בקבוק עומדים לבד, מאותה זווית.', 'Drinks: the glass or bottle standing alone, from the same angle.'],
  ['טלפון מספיק. צד ארוך של 1,200 פיקסלים מספיק, וכל טלפון מהשנים האחרונות מצלם הרבה יותר. קובץ JPEG הוא הבטוח ביותר.', 'A phone is enough. 1,200 pixels on the long side will do, and any recent phone shoots far more. A JPEG file is the safest.']
];
const wrong = [
  ['צלחת שנחתכת בקצה התמונה', 'A plate cut off by the edge of the photo'],
  ['תקריב שממלא את כל הפריים', 'A close-up that fills the whole frame'],
  ['שולחן עמוס: כמה מנות, כוסות ומפיות בתמונה אחת', 'A crowded table: several dishes, glasses and napkins in one photo'],
  ['צלחת כהה על שולחן כהה: הצלחת נעלמת והאוכל "מרחף" (לפעמים זה עדיין נראה טוב)', 'A dark plate on a dark table: the plate disappears and the food “floats” (sometimes that still looks good)'],
  ['חלקים דקים, כמו ידית של מחבת או רגל של כוס יין, עלולים להיעלם', 'Thin parts, such as a pan handle or the stem of a wine glass, can go missing']
];
const after = [
  ['לאשר, והתבליט נכנס לתפריט.', 'Approve it, and the relief goes into the menu.'],
  ['לשנות את העומק: שטוח (פיצה, חומוס), נמוך, בינוני או גבוה (המבורגר, עוגה, קערה). שנייה או שתיים לכל שינוי.', 'Change the depth: flat (pizza, hummus), low, medium or tall (burger, cake, bowl). A second or two per change.'],
  ['לנסות שוב, עד 5 ניסיונות לתמונה, או להעלות תמונה אחרת.', 'Try again, up to 5 attempts per photo, or upload a different photo.'],
  ['להשתמש בתמונה כמו שהיא. היא תוצג כתמונה מונחת על השולחן, בלי עומק.', 'Use the photo as it is. It is shown as a print lying on the table, with no depth.']
];
const check = [
  ['פותחים את הקישור בטלפון אמיתי, לא רק בתצוגה המקדימה.', 'Open the link on a real phone, not only in the preview.'],
  ['עוברים על כל המנות: אף מנה לא חתוכה, והמשקאות עומדים.', 'Go through every dish: none is cut off, and the drinks stand upright.'],
  ['מרימים את שלוש המנות הגבוהות ומטים אותן: אין צדדים מרוחים.', 'Lift the three tallest dishes and tilt them: no smeared sides.'],
  ['מחליפים שפה ובודקים שמות ומחירים בעברית ובאנגלית.', 'Switch language and check names and prices in Hebrew and in English.'],
  ['שמות, מחירים ואלרגנים תואמים את התפריט שבמסעדה היום.', 'Names, prices and allergens match the menu in the restaurant today.']
];
const li = (rows) => rows.map(([a, b]) => `<li>${t(a, b)}</li>`).join('\n        ');
export function renderGuide() {
  return head({
    titleHe: 'מדריך הצילום של מנה · תמונה אחת לכל מנה', titleEn: 'The Mana photo guide · one photo per dish',
    descHe: 'איך לצלם מנה כדי שהתבליט ייצא טוב: זווית, רקע, אור, ומה עושים כשתמונה לא מצליחה.',
    descEn: 'How to photograph a dish so the relief comes out well: angle, background, light, and what to do when a photo does not work.', base: '../', path: 'guide/'
  }) + `
<body>
<a class="skip" href="#main">${t('דילוג לתוכן', 'Skip to content')}</a>
${header('../')}
<main id="main" class="wrap doc-main">
  <article class="guide">
    <p class="back"><a href="../">${t('→ לעמוד של מנה', '← Back to Mana')}</a></p>
    <h1>${t('מדריך הצילום: תמונה אחת לכל מנה', 'The photo guide: one photo per dish')}</h1>
    ${p('מנה בונה תבליט מתמונה אחת של כל מנה. ככל שהתמונה ברורה יותר, התוצאה טובה יותר. חמש דקות עם הדף הזה חוסכות צילום חוזר.', 'Mana builds a relief from one photo of each dish. The clearer the photo, the better the result. Five minutes with this page saves a reshoot.', 'lead')}
    <p class="no-print" style="margin-top:18px"><button class="btn btn-sm" type="button" onclick="window.print()">${t('להדפיס את המדריך', 'Print this guide')}</button></p>

    <h2>${t('שבעה כללים', 'Seven rules')}</h2>
    <ol>
        ${li(rules)}
    </ol>
    <svg class="angle" viewBox="0 0 420 190" role="img" aria-labelledby="angle-t"><title id="angle-t">Camera about 45 degrees above the plate</title>
      <line x1="10" y1="160" x2="410" y2="160" stroke="#0F0F0F" stroke-width="1.5"/>
      <ellipse cx="270" cy="152" rx="62" ry="9" fill="none" stroke="#0F0F0F" stroke-width="2.4"/>
      <ellipse cx="270" cy="147" rx="34" ry="8" fill="#F5B120"/>
      <line x1="270" y1="147" x2="128" y2="42" stroke="#9A5238" stroke-width="1.5" stroke-dasharray="5 5"/>
      <path d="M214 147a56 56 0 0 1 11-33.5" fill="none" stroke="#9A5238" stroke-width="1.5"/>
      <text x="196" y="128" font-family="IBM Plex Sans Hebrew,Arial,sans-serif" font-size="15" fill="#9A5238" direction="ltr">45°</text>
      <g transform="rotate(-53 118 34)"><rect x="96" y="18" width="44" height="78" rx="7" fill="#fff" stroke="#0F0F0F" stroke-width="2.4"/><circle cx="118" cy="84" r="5" fill="#0F0F0F"/></g>
    </svg>

    <div class="guide-fig">
      <figure><img src="../img/howto-photo.jpg" width="960" height="720" alt="" loading="lazy"><figcaption class="small">${t('עובד טוב: כל הקערה בפריים, רקע כהה וחלק, צלחת בהירה.', 'Works well: the whole bowl in frame, a dark plain background, a light plate.')}</figcaption></figure>
      <figure><img src="../img/guide-cutoff.jpg" width="960" height="720" alt="" loading="lazy"><figcaption class="small">${t('עובד פחות טוב: המחבת נחתכת בקצה והרקע עמוס. התוצאה תסומן "כדאי תמונה טובה יותר".', 'Works less well: the pan is cut off by the frame and the background is busy. The result is flagged “a better photo would help”.')}</figcaption></figure>
    </div>
    <p class="small" style="margin-top:8px">${t('שתי התמונות הן תמונות טלפון אמיתיות ממאגר פתוח (based.cooking, נחלת הכלל).', 'Both are real phone photos from a public-domain set (based.cooking).')}</p>

    <h2>${t('מה בדרך כלל משתבש', 'What usually goes wrong')}</h2>
    <ul>
        ${li(wrong)}
    </ul>
    ${p('לא כל תמונה מצליחה, וזה בסדר: תמיד אפשר להציג את התמונה כמו שהיא.', 'Not every photo works, and that is fine: you can always show the photo as it is.', 'small')}

    <h2>${t('אחרי העיבוד: מה אפשר לעשות', 'After processing: what you can do')}</h2>
    ${p('אתם רואים את התמונה שלכם ליד התוצאה, ובוחרים:', 'You see your photo next to the result, and choose:')}
    <ul>
        ${li(after)}
    </ul>
    ${p('עד שלא אישרתם ופרסמתם, אף סועד לא רואה את התמונה.', 'Until you approve and publish, no guest sees the photo.', 'small')}

    <h2>${t('לפני שמתחילים', 'Before you start')}</h2>
    <ul>
      <li>${t('מומלץ לעבוד ממחשב. אפשר לצלם בטלפון ולהעביר את התמונות למחשב.', 'We recommend working on a computer. Shoot on the phone and move the photos to the computer.')}</li>
      <li>${t('בפעם הראשונה הדפדפן מוריד כ־72 מ״ב, פעם אחת. עדיף Wi‑Fi. אחר כך כל תמונה לוקחת בערך 10 שניות במחשב נייד.', 'The first time, the browser downloads about 72 MB, once. Wi‑Fi is better. After that each photo takes about 10 seconds on a laptop.')}</li>
      <li>${t('אייפון שומר תמונות בפורמט HEIC, ולא כל דפדפן פותח אותו. אם תמונה נדחית, שמרו אותה כ‑JPEG (בהגדרות המצלמה: פורמטים, "התואם ביותר").', 'iPhones save photos as HEIC, and not every browser can open it. If a photo is refused, save it as JPEG (Camera settings: Formats, “Most Compatible”).')}</li>
    </ul>

    <h2>${t('בדיקה לפני שמדפיסים את הקוד', 'A check before you print the code')}</h2>
    <ul>
        ${li(check)}
    </ul>
    <p class="no-print" style="margin-top:36px"><a class="btn btn-primary" href="../studio/">${t('מתחילים בחינם', 'Start free')}</a></p>
  </article>
</main>
${footer('../')}
<script src="../mana.js"></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------------------------------------ privacy and terms
   Plain words, an honest description of what the product does (CONTRACT.md v2, BACKEND.md v2, db/0001 + 0002,
   functions/menus-ai). NOT reviewed by a lawyer: the founder said "no lawyer for now". What the founder must confirm or
   fill in before launch is listed in LEGAL_TODO and repeated in an HTML comment at the top of both pages. */
const LEGAL_NOTE = 'Written in plain words by Halom as an honest description of what Mana does. NOT reviewed by a lawyer. ' +
  'Founder to confirm or fill in before launch: (1) the deletion period, written here as 14 days; (2) the legal name of the business behind Halom and its company or dealer number; ' +
  '(3) a contact e-mail address (none is given: hello@halom.io cannot receive mail yet); (4) governing law and courts, written here as "to be confirmed"; ' +
  '(5) the hosting facts as stated: Supabase in the EU (Frankfurt), pages served by GitHub Pages through halom.io on Vercel; (6) the Anthropic API terms that apply to Halom\'s account; ' +
  '(7) whether backups exist and how long they are kept.';
const sec = (id, he, en, body) => `<section id="${id}"><h2>${t(he, en)}</h2>${body}</section>`;
const ul = (rows) => `<ul>${rows.map(([a, b]) => `<li>${t(a, b)}</li>`).join('')}</ul>`;
const waLink = (he, en) => t(`<a href="${WA}">${he}</a>`, `<a href="${WA}">${en}</a>`);
const docPage = ({ titleHe, titleEn, descHe, descEn, path, h1He, h1En, leadHe, leadEn, body }) => head({ titleHe, titleEn, descHe, descEn, base: '../', path, note: LEGAL_NOTE }) + `
<body>
<a class="skip" href="#main">${t('דילוג לתוכן', 'Skip to content')}</a>
${header('../')}
<main id="main" class="wrap doc-main">
  <article class="guide legal">
    <p class="back"><a href="../">${t('→ לעמוד של מנה', '← Back to Mana')}</a></p>
    <h1>${t(h1He, h1En)}</h1>
    ${p(leadHe, leadEn, 'lead')}
    <p class="small updated">${t('עודכן: ' + UPDATED.he, 'Updated: ' + UPDATED.en)}</p>
    ${body}
  </article>
</main>
${footer('../')}
<script src="../mana.js"></script>
</body>
</html>
`;

export function renderPrivacy() {
  return docPage({
    titleHe: 'פרטיות · מנה מבית Halom', titleEn: 'Privacy · Mana by Halom', path: 'privacy/',
    descHe: 'מה מנה שומרת על בעלי עסקים, מה היא לא שומרת על סועדים, איפה המידע נמצא ואיך מוחקים אותו.',
    descEn: 'What Mana keeps about business owners, what it does not keep about guests, where the data is and how to have it deleted.',
    h1He: 'פרטיות', h1En: 'Privacy',
    leadHe: 'מנה היא תפריט שמסעדות בונות לבד, מבית Halom. כאן כתוב במילים פשוטות מה נשמר, איפה, ואיך מוחקים.',
    leadEn: 'Mana is a menu that restaurants build themselves, by Halom. This page says in plain words what is kept, where, and how to have it deleted.',
    body: [
      sec('guests', 'סועדים: מי שפותח תפריט', 'Guests: anyone who opens a menu',
        p('על מי שפותח תפריט לא נשמר שום דבר אישי. אין עוגיות, אין מזהים ואין חשבון.', 'Nothing personal is kept about a person who opens a menu. No cookies, no identifiers, no account.') +
        p('נשמרות רק ספירות, לכל מסעדה:', 'Only counts are kept, per restaurant:') +
        ul([
          ['כמה פעמים התפריט נפתח, לפי יום ולפי שעה;', 'how many times the menu was opened, by day and by hour;'],
          ['באיזו שפה הוא נפתח, עברית או אנגלית;', 'the language it opened in, Hebrew or English;'],
          ['אם הפתיחה הגיעה מקוד ה־QR המודפס או מקישור;', 'whether it was opened from the printed QR code or from a link;'],
          ['כמה פעמים כל מנה נפתחה, וכמה פעמים היא נוספה ל"שולחן שלי".', 'how many times each dish was opened, and how many times it was added to “my table”.']
        ]) +
        p('אלה מספרים בלבד. הם לא קשורים לאדם, למכשיר או לביקור מסוים, ובעל המסעדה רואה רק אותם.', 'These are numbers only. They are not tied to a person, a device or a single visit, and they are all the restaurant’s owner sees.') +
        p('בטלפון של הסועד, הדפדפן זוכר את השפה שנבחרה ואת רשימת "השולחן שלי". זה נשאר במכשיר ולא נשלח אלינו.', 'On the guest’s own phone, the browser remembers the chosen language and the “my table” list. That stays on the phone and is not sent to us.')),
      sec('owners', 'בעלי עסקים: מי שבונה תפריט', 'Owners: anyone who builds a menu',
        ul([
          ['<b>החשבון:</b> כתובת האימייל שלכם. אם נכנסתם עם Google, Apple או Facebook: כתובת האימייל והשם שהשירות מוסר לנו. סיסמה נשמרת מגובבת בשירות ההזדהות, ואנחנו לא יכולים לקרוא אותה.', '<b>The account:</b> your e-mail address. If you signed in with Google, Apple or Facebook: the e-mail address and the name that service gives us. A password is stored hashed by the sign-in service, and we cannot read it.'],
          ['<b>פרטי העסק:</b> שם, כתובת התפריט, סוג העסק, אזור וסגנון, לוגו, צבע ומשטח, וטלפון, קישור להזמנות ואיש קשר אם מסרתם.', '<b>The business:</b> its name, the menu’s address, the kind of business, area and cuisine, logo, colour and table surface, and a phone number, an ordering link and a contact person if you gave them.'],
          ['<b>התפריט:</b> קטגוריות, מנות, תיאורים, מחירים, סימונים ואלרגנים כפי שכתבתם, והגרסאות שפרסמתם.', '<b>The menu:</b> categories, dishes, descriptions, prices, tags and allergens as you wrote them, and the versions you published.'],
          ['<b>התמונות:</b> התמונות שהעליתם, והתמונות שנוצרו מהן. טיוטות נשמרות באחסון פרטי. רק מה שאישרתם ופרסמתם פתוח לציבור.', '<b>The pictures:</b> the photos you uploaded and the pictures made from them. Drafts are kept in private storage. Only what you approved and published is public.'],
          ['<b>שימוש:</b> מתי נוצרו החשבון והתפריט, מצב תקופת הניסיון, המספרים של התפריט שלכם, וכמה פעמים ביום השתמשתם בסורק התפריטים ובהצעות מתמונה.', '<b>Use:</b> when the account and the menu were made, the state of the trial, your menu’s numbers, and how many times a day you used the menu scanner and the suggestions from a photo.']
        ])),
      sec('where', 'איפה זה נשמר', 'Where it is kept',
        p('בסיס הנתונים, הקבצים ושירות ההזדהות נמצאים אצל Supabase, באזור האיחוד האירופי (פרנקפורט).', 'The database, the files and the sign-in service are at Supabase, in the EU region (Frankfurt).') +
        p('העמודים עצמם הם קבצים סטטיים שמוגשים דרך halom.io (Vercel) ו־GitHub Pages. כמו כל שרת אינטרנט, הספקים האלה ו־Supabase רושמים יומני גישה טכניים: כתובת IP, זמן, סוג הדפדפן והעמוד שהתבקש. אנחנו לא משתמשים ביומנים האלה כדי לזהות סועדים.', 'The pages themselves are static files served through halom.io (Vercel) and GitHub Pages. Like every web server, these hosts and Supabase write technical access logs: IP address, time, browser type and the page asked for. We do not use those logs to identify guests.') +
        p('אין באתר ובתפריטים כלי מעקב, פרסום או אנליטיקה של צד שלישי, והגופנים מוגשים מהאתר עצמו.', 'There are no third-party tracking, advertising or analytics tools on the site or in the menus, and the fonts are served from the site itself.')),
      sec('photos', 'תמונות, סריקה והצעות', 'Photos, scanning and suggestions',
        p('הפיכת תמונה של מנה לתבליט נעשית בדפדפן שלכם, במכשיר שלכם. התמונה והתוצאה נשמרות בחשבון שלכם כדי שתוכלו לאשר ולפרסם אותן.', 'Turning a dish photo into a relief happens in your own browser, on your own device. The photo and the result are saved in your account so that you can approve and publish them.') +
        p('<b>סורק התפריטים וההצעות מתמונה:</b> כשאתם מצלמים תפריט מודפס כדי לסרוק אותו, או מבקשים הצעה לשם ולתיאור מתמונה של מנה, התמונה מועברת ל־API של Anthropic כדי שיקרא אותה, והתוצאה חוזרת אליכם לבדיקה. מנה לא שומרת את התמונה הזאת. נרשמים רק ספירת השימוש היומית, ושורה טכנית עם מזהה העסק, מספר הפריטים שנקראו ומשך העיבוד. העיבוד אצל Anthropic כפוף לתנאים ולמדיניות הפרטיות שלה.', '<b>The menu scanner and suggestions from a photo:</b> when you photograph a printed menu to scan it, or ask for a suggested name and description from a dish photo, the picture is passed to Anthropic’s API to be read, and the result comes back to you to check. Mana does not store that picture. Only the daily count of use is recorded, and one technical line with the business’s id, the number of items read and how long it took. Processing at Anthropic is subject to its own terms and privacy policy.')),
      sec('contact-form', 'הטופס, ההרשמה והאתר', 'The form, sign-up and this site',
        p('כששולחים את הטופס "דברו איתנו" נשמר מה שכתבתם: שם המסעדה, פרטי הקשר, השאלה, השפה, העמוד שממנו נשלח הטופס, ואם הסכמתם לקבל עדכונים. כדי לעצור הצפות נשמר גם גיבוב חד־כיווני של כתובת ה־IP, לא הכתובת עצמה. אותו גיבוב נשמר בניסיונות הרשמה.', 'When you send the “Talk to us” form we keep what you wrote: the restaurant’s name, your contact details, your question, the language, the page the form was sent from, and whether you agreed to receive updates. To stop floods we also keep a one-way hash of the IP address, not the address itself. The same hash is kept for sign-up attempts.') +
        p('הודעות ששולחים לנו בוואטסאפ נשמרות בוואטסאפ, לפי התנאים של וואטסאפ. האתר זוכר בדפדפן שלכם את השפה שבחרתם.', 'Messages you send us on WhatsApp are kept by WhatsApp, under WhatsApp’s terms. This site remembers your chosen language in your browser.')),
      sec('use', 'למה המידע משמש', 'What the data is used for',
        p('כדי להפעיל את התפריט שלכם, להראות לכם את המספרים שלו, לתת תמיכה, ולחזור אליכם כשפניתם. אנחנו לא מוכרים מידע ולא מעבירים אותו למפרסמים. עדכונים שיווקיים נשלחים רק למי שסימן שהוא מסכים, ואפשר להפסיק אותם בכל רגע.', 'To run your menu, to show you its numbers, to give support, and to answer you when you wrote to us. We do not sell data or pass it to advertisers. Marketing updates go only to people who ticked that they agree, and can be stopped at any time.')),
      `<section id="data-deletion"><span id="delete"></span><h2>${t('מחיקת חשבון ומידע', 'Deleting an account and its data')}</h2>` +
        `<p>${waLink('כתבו לנו בוואטסאפ', 'Write to us on WhatsApp')}${t(' מהטלפון או עם כתובת האימייל של החשבון, ובקשו למחוק אותו. נמחק את החשבון, העסק, התפריט, התמונות והמספרים בתוך 14 יום, ונאשר לכם כשזה נעשה.', ' from the account’s phone or with its e-mail address, and ask us to delete it. We delete the account, the business, the menu, the pictures and the numbers within 14 days, and confirm to you when it is done.')}</p>` +
        p('באותה דרך אפשר לבקש עותק של המידע, או לתקן אותו.', 'The same way, you can ask for a copy of your data, or to have it corrected.') +
        p('נכנסתם עם Facebook, Google או Apple? המחיקה אצלנו מוחקת גם את האימייל והשם שקיבלנו מהשירות. את ההרשאה עצמה מסירים בהגדרות החשבון באותו שירות.', 'Signed in with Facebook, Google or Apple? Deletion on our side also deletes the e-mail and name we received from that service. The permission itself is removed in your account settings at that service.') +
        p('יומנים טכניים אצל ספקי האירוח נמחקים לפי לוחות הזמנים של הספקים.', 'Technical logs at the hosts are deleted on the hosts’ own schedules.') + '</section>',
      sec('contact', 'מי אחראי, ושינויים', 'Who is responsible, and changes',
        `<p>${t('Halom, סטודיו קריאייטיב, תל אביב. ', 'Halom, a creative studio, Tel Aviv. ')}${waLink('וואטסאפ: <bdi dir="ltr" class="nb">054-202-2269</bdi>', 'WhatsApp: <bdi dir="ltr" class="nb">+972 54-202-2269</bdi>')}.</p>` +
        p('כשהדף הזה משתנה, התאריך שלמעלה מתעדכן.', 'When this page changes, the date at the top changes with it.'))
    ].join('\n    ')
  });
}

export function renderTerms() {
  return docPage({
    titleHe: 'תנאי שימוש · מנה מבית Halom', titleEn: 'Terms · Mana by Halom', path: 'terms/',
    descHe: 'התנאים של מנה במילים פשוטות: מה השירות, תקופת הניסיון, האחריות לתוכן, איורים, זמינות בפיילוט.',
    descEn: 'Mana’s terms in plain words: what the service is, the free period, responsibility for content, illustrations, availability during the pilot.',
    h1He: 'תנאי שימוש', h1En: 'Terms',
    leadHe: 'התנאים של מנה, במילים פשוטות. מנה נמצאת בפיילוט, והתנאים יתעדכנו כשהוא יסתיים.',
    leadEn: 'Mana’s terms, in plain words. Mana is in pilot, and these terms will be updated when the pilot ends.',
    body: [
      sec('what', 'מה זה מנה', 'What Mana is',
        p('מנה היא שירות של Halom שבו בעל עסק בונה תפריט דיגיטלי: כותב, מדביק או סורק את התפריט, מוסיף תמונות או איורים, ומפרסם אותו בכתובת קבועה ובקוד QR. סועדים פותחים את התפריט בדפדפן, בלי אפליקציה ובלי חשבון.', 'Mana is a service by Halom in which a business owner builds a digital menu: types, pastes or scans the menu, adds photos or illustrations, and publishes it at a permanent address with a QR code. Guests open the menu in a browser, with no app and no account.') +
        p('מנה היא תפריט בלבד. אין בה הזמנות ואין בה תשלום.', 'Mana is a menu only. There is no ordering and no payment in it.')),
      sec('account', 'החשבון', 'The account',
        p('אתם אחראים לשמור על פרטי הכניסה, ולמה שנעשה בחשבון. את התפריט בונה מי שמוסמך לפעול בשם העסק. כתובת התפריט נבחרת פעם אחת ואינה משתנה.', 'You are responsible for keeping your sign-in details safe, and for what is done in the account. The menu is built by someone authorised to act for the business. The menu’s address is chosen once and does not change.')),
      sec('free', 'תקופת הניסיון', 'The free period',
        p('השימוש חינם ל־30 יום מהפרסום הראשון של התפריט, בלי כרטיס אשראי. אין תשלום באתר. את מה שבא אחרי 30 הימים מסכמים איתנו ישירות, במהלך הפיילוט.', 'Use is free for 30 days from the first time you publish the menu, with no card. Nothing is paid on the site. What follows the 30 days is agreed with us directly, during the pilot.') +
        p('אם לא ממשיכים, הכתובת נשארת שלכם ומציגה "התפריט לא זמין כרגע". התוכן לא נמחק עד שתבקשו.', 'If you do not continue, the address stays yours and shows “This menu is not available right now”. Your content is not deleted until you ask.')),
      sec('content', 'התוכן שלכם', 'Your content',
        p('מה שמופיע בתפריט הוא שלכם ובאחריותכם: שמות, תיאורים, מחירים, סימונים ומידע על אלרגנים. מנה לא בודקת, לא מנחשת ולא משלימה אלרגנים.', 'What appears on the menu is yours and your responsibility: names, descriptions, prices, tags and allergen information. Mana does not check, guess or fill in allergens.') +
        p('מעלים רק תמונות ולוגו שיש לכם זכות להשתמש בהם. אתם נותנים ל־Halom רשות לאחסן את התוכן, לעבד אותו ולהציג אותו כדי להפעיל את התפריט שלכם. את התפריט שלכם נציג כדוגמה רק באישורכם.', 'Upload only photos and a logo you have the right to use. You give Halom permission to store, process and show the content in order to run your menu. We show your menu as an example only with your consent.') +
        p('תוצאה של סריקת תפריט, והצעה לשם או לתיאור מתמונה, הן טיוטה שנוצרה אוטומטית. בדקו שמות, מחירים ותרגום לפני שאתם מפרסמים.', 'The result of a menu scan, and a name or description suggested from a photo, are drafts made automatically. Check names, prices and translation before you publish.')),
      sec('pictures', 'תבליטים ואיורים', 'Reliefs and illustrations',
        p('תבליט נוצר מתמונה אחת ואינו העתק מדויק של המנה. לא כל תמונה מצליחה, ותמונה שלא הצליחה אפשר להציג כמו שהיא.', 'A relief is made from one photo and is not an exact copy of the dish. Not every photo works, and one that does not can be shown as it is.') +
        p('מנה בלי תמונה יכולה להופיע עם איור מהספרייה שלנו. איור הוא איור: הוא מסומן "להמחשה בלבד" ואינו תמונה של המנה שלכם.', 'A dish with no photo can appear with an illustration from our library. An illustration is an illustration: it is marked “Illustration” and is not a picture of your dish.')),
      sec('uptime', 'זמינות', 'Availability',
        p('מנה נמצאת בפיילוט. אנחנו עושים מאמץ שהתפריטים יהיו זמינים, ואיננו מתחייבים לזמינות רציפה או לשירות בלי תקלות בתקופה הזאת. כדאי להחזיק גם תפריט מודפס.', 'Mana is in pilot. We work to keep menus available, and we do not guarantee uninterrupted availability or a fault-free service in this period. Keep a printed menu as well.')),
      sec('rules', 'מה אסור', 'What is not allowed',
        p('אין להעלות תוכן לא חוקי, פוגעני או מטעה, או תוכן שמפר זכויות של אחרים. Halom רשאית להסיר תוכן כזה ולהשעות חשבון שמשתמש בשירות לרעה.', 'Do not upload content that is unlawful, abusive or misleading, or that infringes someone else’s rights. Halom may remove such content and suspend an account that misuses the service.')),
      sec('liability', 'אחריות', 'Responsibility',
        p('השירות ניתן כמו שהוא בתקופת הפיילוט. Halom אינה אחראית לתוכן שעסקים מפרסמים, כולל מחירים ואלרגנים.', 'The service is provided as it is during the pilot. Halom is not responsible for content that businesses publish, including prices and allergens.')),
      sec('leaving', 'סיום ומחיקה', 'Leaving and deletion',
        `<p>${t('אפשר להפסיק בכל רגע ולבקש שנמחק את החשבון והמידע, כמו שמוסבר ב<a href="../privacy/#data-deletion">דף הפרטיות</a>.', 'You can stop at any time and ask us to delete the account and its data, as the <a href="../privacy/#data-deletion">privacy page</a> explains.')}</p>`),
      sec('law', 'הדין החל', 'Governing law',
        p('ייקבע.', 'To be confirmed.')),
      sec('contact', 'יצירת קשר', 'Contact',
        `<p>${t('Halom, סטודיו קריאייטיב, תל אביב. ', 'Halom, a creative studio, Tel Aviv. ')}${waLink('וואטסאפ: <bdi dir="ltr" class="nb">054-202-2269</bdi>', 'WhatsApp: <bdi dir="ltr" class="nb">+972 54-202-2269</bdi>')}.</p>`)
    ].join('\n    ')
  });
}

/* ------------------------------------------------------------------------------------------------ write */
function main() {
  const arg = process.argv.find((a) => a.startsWith('--poster-from-video'));
  if (arg) {
    const at = arg.includes('=') ? arg.split('=')[1] : '0', v = join(SITE, 'img', 'hero.mp4');
    if (!existsSync(v)) { console.error('no site/img/hero.mp4: the poster was left as it is'); }
    else for (const [w, f] of [[720, 'hero-poster.jpg'], [480, 'hero-poster-480.jpg']]) {
      execFileSync('/usr/bin/ffmpeg', ['-v', 'error', '-y', '-ss', at, '-i', v, '-frames:v', '1', '-vf', `scale=${w}:-2`, '-q:v', '4', join(SITE, 'img', f)]);
      console.log('poster from the video at ' + at + ' s →', f);
    }
  }
  const demo = process.argv.find((a) => a.startsWith('--demo-still-from-clip'));          // the still behind "Play with it": a frame of the guest recording
  if (demo) {
    const at = demo.includes('=') ? demo.split('=')[1] : '1.7', v = join(SITE, '..', 'tools', 'film', 'clips', 'guest-glide.mp4');
    if (!existsSync(v)) console.error('no tools/film/clips/guest-glide.mp4: the demo still was left as it is');
    else { execFileSync('/usr/bin/ffmpeg', ['-v', 'error', '-y', '-ss', at, '-i', v, '-frames:v', '1', '-vf', 'scale=720:1560:flags=lanczos', '-q:v', '4', join(SITE, 'img', 'demo-poster.jpg')]); console.log('demo still from the guest recording at ' + at + ' s → demo-poster.jpg'); }
  }
  for (const d of ['guide', 'privacy', 'terms']) mkdirSync(join(SITE, d), { recursive: true });
  copyFileSync(join(ROOT, 'design', 'tokens.css'), join(SITE, 'tokens.css'));      // the shared custom properties (design/tokens.css): one copy, linked by every page
  if (PREVIEW) console.log('MANA_PREVIEW=1: the lead form is rendered switched off');
  const media = mediaFound(), pages = { 'index.html': renderIndex(media), 'guide/index.html': renderGuide(), 'privacy/index.html': renderPrivacy(), 'terms/index.html': renderTerms() };
  for (const [f, html] of Object.entries(pages)) { writeFileSync(join(SITE, f), html); console.log(f, html.length); }
  console.log('media found in site/img:', Object.entries(media).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none (hero shows the still; "Watch the film" is hidden)');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
