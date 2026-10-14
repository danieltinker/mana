/* The A5 leave-behind for the field team: Hebrew on the front, English on the back. Written as HTML (live text), printed to PDF
   by build-print.mjs. No prices, no testimonials, no client names: only what the product does today. */
import { inline as markInline } from './mark.mjs';
import { qrSvg } from './qr.mjs';
export const PAGE = 'https://halom.io/mana/';
const mark = (plate, w) => markInline(plate, w);   // Cloche (./mark.mjs)
const side = (l) => {
  const he = l === 'he', T = (a, b) => (he ? a : b);
  return `<section class="sheet" id="${l}" lang="${l}" dir="${he ? 'rtl' : 'ltr'}">
  <header><span class="brand">${mark('#0F0F0F', '11mm')}<b>${T('מנה', 'mana')}</b></span><span class="by">${T('מבית חלום', 'by Halom')}</span></header>
  <h1>${T('מצלמים כל מנה פעם אחת.<br>הסועדים רואים אותה על השולחן.', 'One photo per dish.<br>Your guests see it on the table.')}</h1>
  <figure><img src="../../site/img/table-${l}.jpg" alt=""><figcaption>${T('צילום מסך מתפריט הדגמה. המסעדה והתמונות בהדגמה אינן אמיתיות; בתפריט שלכם מופיעים הצילומים שלכם.', 'A screenshot of a demo menu. The restaurant and pictures in the demo are not real; your menu shows your own photos.')}</figcaption></figure>
  <ol>
    <li><b>${T('כותבים את התפריט', 'Type the menu')}</b>${T('מנות, משקאות ומחירים, בעברית ובאנגלית.', 'Dishes, drinks and prices, in Hebrew and English.')}</li>
    <li><b>${T('מצלמים כל מנה פעם אחת', 'Take one photo per dish')}</b>${T('הדפדפן הופך אותה לתבליט תלת־ממדי. אתם מאשרים מה שנראה טוב.', 'The browser turns it into a 3D relief. You approve what looks right.')}</li>
    <li><b>${T('מפרסמים ומקבלים קוד QR', 'Publish and get a QR code')}</b>${T('קישור קבוע לשולחנות. מעדכנים לבד, ו"אזל" מתעדכן מיד.', 'A permanent link for the tables. You update it yourself, and “sold out” shows at once.')}</li>
  </ol>
  <div class="foot">
    <div class="facts">
      <p class="free">${T('חינם ל־30 יום מהפרסום הראשון', 'Free for 30 days from your first publish')}</p>
      <p>${T('לסועדים: בלי אפליקציה ובלי הרשמה. לכם: בלי כרטיס אשראי.', 'For guests: no app, no account. For you: no credit card.')}</p>
      <p class="fine">${T('שיהיה ברור: זה תבליט מתמונה אחת, לא מודל תלת־ממד מלא. לא כל תמונה מצליחה, ואז היא מוצגת כתמונה רגילה. בתפריט אין הזמנות ואין תשלום. אחרי הניסיון, תנאי הפיילוט מסוכמים ישירות עם Halom.', 'To be clear: a relief from one photo, not a full 3D model. Not every photo works; one that does not is shown as a plain photo. No orders or payment in the menu. After the trial, pilot terms are agreed directly with Halom.')}</p>
      <p class="contact">${T('וואטסאפ', 'WhatsApp')} <bdi dir="ltr">054-202-2269</bdi> · <bdi dir="ltr">halom.io/mana</bdi><br><span class="rep">${T('דיברתם עם:', 'You spoke with:')} <i></i></span></p>
    </div>
    <div class="scan">${qrSvg(PAGE, { title: 'halom.io/mana' })}<span>${T('סרקו: תפריט חי והרשמה', 'Scan: a live menu and sign-up')}</span></div>
  </div>
</section>`;
};
export const leaveBehind = () => `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><title>Mana · leave-behind A5</title>
<style>
@font-face{font-family:"Frank Ruhl Libre";font-weight:300 900;src:url(../../site/fonts/frank-ruhl-libre-hebrew-wght-normal.woff2) format("woff2");unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
@font-face{font-family:"Frank Ruhl Libre";font-weight:300 900;src:url(../../site/fonts/frank-ruhl-libre-latin-wght-normal.woff2) format("woff2");unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:"IBM Plex Sans Hebrew";font-weight:400;src:url(../../site/fonts/ibm-plex-sans-hebrew-hebrew-400-normal.woff2) format("woff2");unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
@font-face{font-family:"IBM Plex Sans Hebrew";font-weight:400;src:url(../../site/fonts/ibm-plex-sans-hebrew-latin-400-normal.woff2) format("woff2");unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:"IBM Plex Sans Hebrew";font-weight:600;src:url(../../site/fonts/ibm-plex-sans-hebrew-hebrew-600-normal.woff2) format("woff2");unicode-range:U+0307-0308,U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
@font-face{font-family:"IBM Plex Sans Hebrew";font-weight:600;src:url(../../site/fonts/ibm-plex-sans-hebrew-latin-600-normal.woff2) format("woff2");unicode-range:U+0000-00FF,U+2000-206F}
@page{size:148mm 210mm;margin:0}
*{box-sizing:border-box}html,body{margin:0;background:#FCF8F6}
body{font:400 9.6pt/1.45 "IBM Plex Sans Hebrew",Arial,sans-serif;color:#0F0F0F;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:148mm;height:210mm;padding:11mm 11mm 10mm;display:flex;flex-direction:column;background:#FCF8F6;break-after:page;overflow:hidden}
header{display:flex;align-items:center;justify-content:space-between}
.brand{display:inline-flex;align-items:center;gap:2.4mm}.brand b{font:500 19pt/1 "Frank Ruhl Libre",serif}
.by{font-size:8.6pt;color:#434343}
h1{font:500 22.5pt/1.16 "Frank Ruhl Libre",serif;margin:6mm 0 0;letter-spacing:0}
[lang=en] h1{font-size:23.5pt;line-height:1.1;letter-spacing:-.01em}
figure{margin:5mm 0 0}figure img{display:block;width:100%;height:60mm;object-fit:cover;object-position:50% 100%;border-radius:4mm}
figcaption{font-size:6.6pt;color:#434343;margin-top:1.4mm}
ol{list-style:none;margin:4mm 0 0;padding:0;counter-reset:s}
ol li{counter-increment:s;display:grid;grid-template-columns:8mm 1fr;column-gap:1mm;padding:1.9mm 0;border-top:.25mm solid rgba(15,15,15,.2)}
ol li:last-child{border-bottom:.25mm solid rgba(15,15,15,.2)}
ol li::before{content:counter(s);font:500 17pt/1 "Frank Ruhl Libre",serif;color:#9A5238;grid-row:1/3}
ol li b{font:500 12pt/1.2 "Frank Ruhl Libre",serif;display:block}
.foot{margin-top:auto;display:grid;grid-template-columns:1fr 34mm;gap:6mm;align-items:end}
[lang=en] .free{font-size:12.6pt}
[lang=en] figure img{height:53mm}
.free{font:500 14pt/1.2 "Frank Ruhl Libre",serif;margin:0}
.facts p{margin:1.4mm 0 0}.facts .free{margin:0}
.fine{font-size:7.4pt;color:#434343;line-height:1.42}
.contact{font-weight:600;font-size:9.2pt;margin-top:2.6mm!important}
.rep{font-weight:400;color:#434343}.rep i{display:inline-block;width:34mm;border-bottom:.25mm solid #434343;height:3.4mm}
.scan{display:flex;flex-direction:column;align-items:center;gap:1.6mm;text-align:center;font-size:7.4pt;color:#434343}
.scan svg{width:34mm;height:34mm;border-radius:1.6mm}
</style></head><body>
${side('he')}
${side('en')}
</body></html>
`;
