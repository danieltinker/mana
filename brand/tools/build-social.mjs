/* Four ready post frames (1080 × 1350), Hebrew and English, rendered from HTML with the page's own fonts and real product pictures.
   Output: social/frames/<n>-<name>-<lang>.png   Source kept in social/src/frames.html   Run: node tools/build-social.mjs */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const mark = (plate, w) => `<svg viewBox="0 14 64 39" width="${w}"><ellipse cx="32" cy="33.5" rx="28" ry="15" fill="none" stroke="${plate}" stroke-width="3.4"/><ellipse cx="32" cy="30" rx="15" ry="8" fill="#F5B120"/></svg>`;
const brand = (l, ink) => `<div class="brand">${mark(ink, 84)}<b>${l === 'he' ? 'מנה' : 'Mana'}</b><span>${l === 'he' ? 'מבית Halom' : 'by Halom'}</span></div>`;
const F = {
  '01-one-photo': (l, T) => `<section class="f ivory">${brand(l, '#0F0F0F')}<h1>${T('תמונה אחת מהטלפון.<br>ככה היא נראית בתפריט.', 'One phone photo.<br>This is how it looks on the menu.')}</h1>
    <div class="pair"><img src="../../site/img/howto-photo.jpg"><img src="../../site/img/howto-table-${l}.jpg"></div>
    <p class="note">${T('צילום אמיתי ממאגר פתוח, והתוצאה כפי שיצאה, בלי תיקונים. זה תבליט: יש עומק ואפשר להטות, אי אפשר לסובב מסביב.', 'A real photo from a public-domain set, and the result as it came out, untouched. It is a relief: there is depth and it tilts; it does not spin all the way round.')}</p></section>`,
  '06-relief': (l, T) => `<section class="f black">${brand(l, '#FCF8F6')}<h1>${T('זה תבליט,<br>לא קסם.', 'It is a relief,<br>not magic.')}</h1>
    <img class="wide" src="../../site/img/table-${l}.jpg">
    <ul><li>${T('כל מנה נבנית מתמונה אחת.', 'Each dish is built from one photo.')}</li><li>${T('היא מקבלת עומק ונוטה מעט לכל צד.', 'It gets depth and tilts a little each way.')}</li><li>${T('מה שלא צולם לא קיים. לא כל תמונה מצליחה.', 'What was not photographed is not there. Not every photo works.')}</li></ul>
    <p class="note">${T('בתמונה: תפריט הדגמה, תמונות להמחשה.', 'Pictured: a demo menu with sample pictures.')}</p></section>`,
  '11-what-it-is-not': (l, T) => `<section class="f blush">${brand(l, '#0F0F0F')}<h1>${T('מה מנה לא עושה', 'What Mana does not do')}</h1>
    <ul class="rows"><li>${T('לא לוקחת הזמנות ולא תשלום.', 'It takes no orders and no payment.')}</li><li>${T('לא מודל תלת־ממד מלא. תבליט.', 'It is not a full 3D model. A relief.')}</li><li>${T('לא כל תמונה מצליחה. אז מציגים אותה כתמונה.', 'Not every photo works. Then it is shown as a photo.')}</li><li>${T('לא כותבת אלרגנים במקומכם.', 'It does not write your allergens for you.')}</li></ul>
    <p class="yes">${T('מה כן: מצלמים כל מנה פעם אחת, והסועדים רואים אותה על השולחן.', 'What it does: one photo per dish, and your guests see it on the table.')}</p></section>`,
  '12-pilot': (l, T) => `<section class="f black">${brand(l, '#FCF8F6')}<h1 class="big">${T('מחפשים<br>10 מסעדות<br>בתל אביב.', 'Looking for<br>10 restaurants<br>in Tel Aviv.')}</h1>
    <p class="lead">${T('לפיילוט של מנה: תפריט שרואים בו את האוכל, מתמונה אחת לכל מנה. חינם ל־30 יום מהפרסום הראשון, ואנחנו מלווים אתכם אישית.', 'For the Mana pilot: a menu where you see the food, from one photo per dish. Free for 30 days from your first publish, and we look after you in person.')}</p>
    <p class="cta"><b>halom.io/mana</b> ${T('· או כתבו לנו "מנה"', '· or message us “Mana”')}</p></section>`
};
const html = (l) => { const T = (a, b) => (l === 'he' ? a : b); return `<!doctype html><html lang="${l}" dir="${l === 'he' ? 'rtl' : 'ltr'}"><meta charset="utf-8"><style>
@font-face{font-family:"Frank Ruhl Libre";font-weight:300 900;src:url(../../site/fonts/frank-ruhl-libre-hebrew-wght-normal.woff2) format("woff2");unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
@font-face{font-family:"Frank Ruhl Libre";font-weight:300 900;src:url(../../site/fonts/frank-ruhl-libre-latin-wght-normal.woff2) format("woff2");unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:"IBM Plex Sans Hebrew";font-weight:400;src:url(../../site/fonts/ibm-plex-sans-hebrew-hebrew-400-normal.woff2) format("woff2");unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
@font-face{font-family:"IBM Plex Sans Hebrew";font-weight:400;src:url(../../site/fonts/ibm-plex-sans-hebrew-latin-400-normal.woff2) format("woff2");unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:"IBM Plex Sans Hebrew";font-weight:600;src:url(../../site/fonts/ibm-plex-sans-hebrew-hebrew-600-normal.woff2) format("woff2");unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
@font-face{font-family:"IBM Plex Sans Hebrew";font-weight:600;src:url(../../site/fonts/ibm-plex-sans-hebrew-latin-600-normal.woff2) format("woff2");unicode-range:U+0000-00FF,U+2000-206F}
*{box-sizing:border-box}body{margin:0;font:400 34px/1.45 "IBM Plex Sans Hebrew",Arial,sans-serif}
.f{width:1080px;height:1350px;padding:84px 84px 76px;display:flex;flex-direction:column;overflow:hidden}
.ivory{background:#FCF8F6;color:#0F0F0F}.black{background:#0F0F0F;color:#FCF8F6}.blush{background:#FAD9D5;color:#0F0F0F}
.brand{display:flex;align-items:center;gap:18px}.brand b{font:500 54px/1 "Frank Ruhl Libre",serif}.brand span{font-size:26px;opacity:.72;margin-inline-start:auto}
h1{font:500 78px/1.14 "Frank Ruhl Libre",serif;margin:70px 0 0}[lang=en] h1{line-height:1.08;letter-spacing:-.01em}
h1.big{font-size:132px;line-height:1.06;margin-top:110px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:56px}.pair img{width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:22px}
.wide{width:100%;height:430px;object-fit:cover;object-position:50% 100%;border-radius:26px;margin-top:52px}
.note{margin:auto 0 0;font-size:27px;line-height:1.45;opacity:.78}
ul{list-style:none;margin:44px 0 0;padding:0}ul li{padding:17px 0;border-top:2px solid rgba(252,248,246,.22)}
.rows{margin-top:64px}.rows li{font:500 46px/1.25 "Frank Ruhl Libre",serif;padding:30px 0;border-top:2px solid rgba(15,15,15,.25)}.rows li:last-child{border-bottom:2px solid rgba(15,15,15,.25)}
.yes{margin:auto 0 0;font-size:36px;line-height:1.4;font-weight:600}
.lead{font-size:40px;line-height:1.42;margin:64px 0 0;color:#e2dcd7}
.cta{margin:auto 0 0;font-size:38px}.cta b{color:#F5B120;font-weight:600;direction:ltr;unicode-bidi:isolate}
</style><body>${Object.entries(F).map(([k, f]) => f(l, T).replace('<section class="f', `<section id="${k}" class="f`)).join('\n')}</body></html>`; };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
for (const l of ['he', 'en']) {
  const src = join(ROOT, 'social', 'src', `frames-${l}.html`); writeFileSync(src, html(l));
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } }); await page.goto(pathToFileURL(src).href, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
  for (const k of Object.keys(F)) {
    const over = await page.evaluate((id) => { const s = document.getElementById(id); return s.scrollHeight - s.clientHeight; }, k);
    await page.locator('[id="' + k + '"]').screenshot({ path: join(ROOT, 'social', 'frames', `${k}-${l}.png`) }); console.log(k, l, over > 0 ? 'OVERFLOW ' + over : 'ok');
  }
  await page.close();
}
await browser.close();
