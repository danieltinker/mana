/* Halom 3D Menu engine, hologram edition.
   In:  window.HALOM_MENUS (restaurants, dishes) and window.HALOM_ASSETS (per dish: camera elevation + relief height).
        Each dish has two images made from ONE photo: img/<id>.jpg (colour) and img/<id>.png (R = height, G = matte).
   Out: every dish as a relief hologram over its own projector, on a carousel the diner turns. */
(function () {
'use strict';
const T = window.THREE;
const MENUS = window.HALOM_MENUS || [], ASSETS = window.HALOM_ASSETS || {}, CFG = window.HALOM_MENU_CONFIG || {};
const CLIENT = CFG.mode === 'client', IMG = CFG.img || 'img/', CUR = CFG.currency || '₪';   // client: one restaurant's own menu, no demo framing
const $ = (id) => document.getElementById(id);
const root = document.documentElement, app = $('app');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const PI = Math.PI, TAU = PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => x * x * (3 - 2 * x);

/* ---------------- words ---------------- */
const STR = {
  en: {
    demo: 'Halom concept demo · AI-generated dish previews · not official', tray: 'My table', add: 'Add to my table',
    look: 'Look closer', back: 'Back to the menu', prev: 'Previous dish', next: 'Next dish', close: 'Close',
    hint: 'Swipe to turn the menu', hintLook: 'Drag to turn the dish', noGl: '3D could not start in this browser, so the dishes are listed without the holograms.',
    venuesTitle: 'Pick a restaurant',
    venuesNote: 'Concept menus built by Halom from publicly posted menus, October 2026. Not affiliated with these restaurants. Dish names and prices may be out of date. The dish images are AI-generated previews, not photos of the restaurants’ food, and the round marks are placeholders, not their logos.',
    own: 'Your restaurant', ownSub: 'Upload a logo, paste your dishes, add photos',
    trayEmpty: 'Nothing here yet. Add a dish and it lands on this list.', total: 'Total', trayNote: 'Show this list to your waiter.', clear: 'Clear the list',
    studioLead: 'Give the engine a logo and a list of dishes, then add one photo per dish. Each photo becomes a hologram.',
    stLogo: 'Logo', stName: 'Restaurant name', stDishes: 'Dishes', stHelp: 'One dish per line: name | price | description. Start a line with # to open a new section.', stGo: 'Project the menu',
    photo: 'Add a photo of this dish', noPhoto: 'Waiting for a photo', lang: 'עב', credit: '3D menu by Halom · halom.io',
    table: 'Table style', tableTitle: 'Choose a table', tableNote: 'The same menu on a different table. Each restaurant picks the one that fits its room.', fits: 'Fits this place',
    introTitle: 'Menus you can almost taste', introBody: 'A Halom concept: ten Tel Aviv menus rebuilt as holograms. We are not affiliated with these restaurants, and the dish images are AI-generated previews, not photos of their food.', introGo: 'Open the menu'
  },
  he: {
    demo: 'הדגמת קונספט של Halom · תמונות המנות נוצרו ב-AI · לא רשמי', tray: 'השולחן שלי', add: 'להוסיף לשולחן',
    look: 'מבט מקרוב', back: 'חזרה לתפריט', prev: 'המנה הקודמת', next: 'המנה הבאה', close: 'סגירה',
    hint: 'החליקו כדי לסובב את התפריט', hintLook: 'גררו כדי לסובב את המנה', noGl: 'התלת-מימד לא עלה בדפדפן הזה, אז המנות מוצגות בלי ההולוגרמות.',
    venuesTitle: 'בחרו מסעדה',
    venuesNote: 'תפריטי קונספט ש-Halom בנתה מתפריטים שפורסמו ברשת, אוקטובר 2026. אין קשר למסעדות. ייתכן ששמות המנות והמחירים אינם מעודכנים. תמונות המנות נוצרו ב-AI ואינן צילומים של האוכל במסעדות, והסמלים העגולים הם ממלאי מקום ולא הלוגו שלהן.',
    own: 'המסעדה שלכם', ownSub: 'מעלים לוגו, מדביקים מנות, מוסיפים תמונות',
    trayEmpty: 'עוד אין כאן כלום. מוסיפים מנה והיא מופיעה ברשימה.', total: 'סה״כ', trayNote: 'מראים את הרשימה למלצר.', clear: 'לנקות את הרשימה',
    studioLead: 'נותנים למנוע לוגו ורשימת מנות, ואז מוסיפים תמונה אחת לכל מנה. כל תמונה הופכת להולוגרמה.',
    stLogo: 'לוגו', stName: 'שם המסעדה', stDishes: 'מנות', stHelp: 'מנה בכל שורה: שם | מחיר | תיאור. שורה שמתחילה ב-# פותחת קטגוריה חדשה.', stGo: 'להקרין את התפריט',
    photo: 'להוסיף תמונה של המנה', noPhoto: 'מחכה לתמונה', lang: 'EN', credit: 'תפריט תלת-ממד של Halom · halom.io',
    table: 'סגנון שולחן', tableTitle: 'בחרו שולחן', tableNote: 'אותו תפריט על שולחן אחר. כל מסעדה בוחרת את השולחן שמתאים לחלל שלה.', fits: 'מתאים למקום',
    introTitle: 'תפריטים שכמעט אפשר לטעום', introBody: 'קונספט של Halom: עשרה תפריטים תל-אביביים שנבנו מחדש כהולוגרמות. אין לנו קשר למסעדות, ותמונות המנות נוצרו ב-AI ואינן צילומים של האוכל שלהן.', introGo: 'לפתוח את התפריט'
  }
};
const TAGS = {
  vegan: { en: 'Vegan', he: 'טבעוני' }, vegetarian: { en: 'Vegetarian', he: 'צמחוני' },
  spicy: { en: 'Spicy', he: 'חריף' }, gf: { en: 'Gluten free', he: 'ללא גלוטן' }
};
const SAMPLE = ['# To start', 'Burnt eggplant | 46 | Tahini, pomegranate, pine nuts', 'Hummus masabacha | 38 | Warm chickpeas, olive oil, parsley',
  '# Mains', 'Shakshuka | 58 | Three eggs, spicy tomato sauce, challah', 'Sea bream | 112 | Whole grilled fish, lemon, herbs',
  '# Sweet', 'Malabi | 34 | Rose syrup, pistachio, coconut'].join('\n');

/* Tables: what the dishes stand on. 'holo' is the projector stage; every other entry is a tiling texture pair in themes/
   (<id>.jpg colour, <id>_h.jpg height) lit by one lamp over the dish in front.
   size = world units one tile covers · spec, shin = how glossy · bump = how much the height map catches the light ·
   refl = mirror strength for standing drinks · ink = colour the logo is printed in. Order = order in swatches.jpg. */
const TABLES = [
  { id: 'holo', en: 'Hologram stage', he: 'במת הולוגרמה' },
  { id: 'oak', en: 'Oak table', he: 'שולחן אלון', size: 5.6, spec: .14, shin: 20, bump: 3.5, refl: .05, ink: '#3a2614' },
  { id: 'walnut', en: 'Dark walnut', he: 'אגוז כהה', size: 5.6, spec: .2, shin: 26, bump: 3.5, refl: .09, ink: '#e6cfa8' },
  { id: 'birch', en: 'Pale birch', he: 'ליבנה בהיר', size: 5.6, spec: .1, shin: 16, bump: 3, refl: .04, ink: '#6b5236' },
  { id: 'gingham', en: 'Red check cloth', he: 'מפה משובצת אדומה', size: 4.2, spec: .015, shin: 6, bump: 16, refl: 0, ink: '#4a1016' },
  { id: 'gingham-blue', en: 'Blue check cloth', he: 'מפה משובצת כחולה', size: 4.2, spec: .015, shin: 6, bump: 16, refl: 0, ink: '#14254e' },
  { id: 'linen', en: 'White linen', he: 'מפה לבנה', size: 4.4, spec: .02, shin: 8, bump: 14, refl: 0, ink: '#8d8272' },
  { id: 'damask', en: 'White damask', he: 'מפת דמשק לבנה', size: 4.2, spec: .05, shin: 10, bump: 9, refl: 0, ink: '#8d8272' },
  { id: 'linen-black', en: 'Black linen', he: 'מפה שחורה', size: 4.4, spec: .04, shin: 8, bump: 14, refl: 0, ink: '#c9c1b4' },
  { id: 'marble', en: 'White marble', he: 'שיש לבן', size: 9, spec: .42, shin: 70, bump: 0, refl: .2, ink: '#5a5e68' },
  { id: 'marble-black', en: 'Black marble', he: 'שיש שחור', size: 9, spec: .55, shin: 80, bump: 0, refl: .3, ink: '#d8b877' },
  { id: 'terrazzo', en: 'Terrazzo', he: 'טראצו', size: 5, spec: .3, shin: 55, bump: 0, refl: .12, ink: '#4a433a' },
  { id: 'concrete', en: 'Concrete', he: 'בטון', size: 7, spec: .1, shin: 16, bump: 5, refl: .04, ink: '#2c2c2a' },
  { id: 'slate', en: 'Slate', he: 'צפחה', size: 6, spec: .16, shin: 22, bump: 14, refl: .03, ink: '#cfd4da' },
  { id: 'tiles', en: 'Painted tiles', he: 'אריחים מצוירים', size: 4.8, spec: .4, shin: 60, bump: 8, refl: .14, ink: '#1c3f92' },
  { id: 'bamboo', en: 'Bamboo mat', he: 'מחצלת במבוק', size: 4.6, spec: .1, shin: 14, bump: 12, refl: 0, ink: '#46331a' },
  { id: 'kraft', en: 'Kraft paper', he: 'נייר קראפט', size: 6, spec: .015, shin: 6, bump: 5, refl: 0, ink: '#49301c' },
  { id: 'steel', en: 'Brushed steel', he: 'נירוסטה מוברשת', size: 6, spec: .55, shin: 34, bump: 1.4, refl: .24, ink: '#262a30' },
  { id: 'copper', en: 'Hammered copper', he: 'נחושת מרוקעת', size: 5, spec: .7, shin: 46, bump: 2.6, refl: .16, ink: '#3a1a0c' }
];
const THEMES = CFG.themes || 'themes/';
const S = { noAdapt: false, table: null, pick: null, lang: 'en', venue: null, items: [], idx: 0, turn: 0, theta: 0, thetaT: 0, focus: false, RR: 4.2, wide: false, drag: false, course: null, single: true, px: 0 };
try { const l = localStorage.getItem('halom-menu-lang'); if (l === 'he' || l === 'en') S.lang = l; else if ((navigator.language || '').toLowerCase().startsWith('he')) S.lang = 'he'; } catch (e) { /* storage is optional */ }
const t_ = (k) => (STR[S.lang][k] != null ? STR[S.lang][k] : STR.en[k]);
const tx = (o) => (o == null ? '' : typeof o === 'string' ? o : (o[S.lang] || o.en || o.he || ''));
const dirSign = () => (S.lang === 'he' ? -1 : 1);
const mod = (n, m) => ((n % m) + m) % m;

function hexRgb(h) { h = String(h).trim().replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function lum(h) { const c = hexRgb(h); return (c[0] * .299 + c[1] * .587 + c[2] * .114) / 255; }
const onColor = (h) => (lum(h) > .5 ? '#04121a' : '#f4fbff');

/* ---------------- shaders ---------------- */
const DISH_VS = `
uniform sampler2D aux; uniform float uH; uniform float uE; uniform float uGlitch; uniform float uTime; uniform vec2 uO;
varying vec2 vUv; varying float vY; varying vec3 vW;
void main(){
  vUv = uv;
  float h = texture2D(aux, uv).r * uH;
  float se = sin(uE), ce = cos(uE);
  // the photo was shot from elevation uE: lay its plane flat, push each pixel out along the old view axis
  vec2 q = position.xy - uO;
  vec3 p = vec3(q.x, h * se, -q.y / se + h * ce);
  float n = fract(sin(floor(uv.y * 30.0) * 91.7 + floor(uTime * 24.0) * 13.3) * 43758.5453);
  p.x += (n - 0.5) * 0.2 * uGlitch * step(0.5, fract(n * 7.3));
  vY = p.y;
  vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const DISH_FS = `
uniform sampler2D map; uniform sampler2D aux;
uniform float uH; uniform float uFocus; uniform float uReveal; uniform float uTime; uniform float uScan; uniform float uGlitch;
uniform float uGlow; uniform float uMirror; uniform vec3 uAccent; uniform vec3 uCenter;
uniform float uTable; uniform float uLight; uniform float uRefl; uniform vec4 uMask;
varying vec2 vUv; varying float vY; varying vec3 vW;
void main(){
  vec4 ax = texture2D(aux, vUv);
  float a = ax.g;
  if (a < 0.03) discard;
  if (uMirror > 0.5 && uGlow > 0.5) discard;
  vec3 c = texture2D(map, vUv).rgb;
  if (uTable > 0.5) {           // on a table: the dish as photographed, under the lamp; no hologram treatment
    float fade = a * uReveal;
    vec3 ct = c * uLight;
    if (uGlow > 0.5) { gl_FragColor = vec4(ct * smoothstep(0.74, 1.0, dot(c, vec3(0.299, 0.587, 0.114))) * 0.1, fade); return; }
    if (uMirror > 0.5) {        // a glossy table gives standing things a faint reflection
      float inside = 1.0 - smoothstep(uMask.w - 0.6, uMask.w, length(vW.xz - uMask.xy));
      gl_FragColor = vec4(ct * 0.85, fade * uRefl * inside * exp(-vY * 2.6)); return;
    }
    gl_FragColor = vec4(ct, fade); return;
  }
  if (uGlitch > 0.01) { vec2 ca = vec2(0.016 * uGlitch, 0.0); c.r = texture2D(map, vUv + ca).r; c.b = texture2D(map, vUv - ca).b; }
  float tx = 1.0 / 256.0;
  float gx = texture2D(aux, vUv + vec2(tx, 0.0)).r - texture2D(aux, vUv - vec2(tx, 0.0)).r;
  float gy = texture2D(aux, vUv + vec2(0.0, tx)).r - texture2D(aux, vUv - vec2(0.0, tx)).r;
  float steep = smoothstep(0.08, 0.5, length(vec2(gx, gy)) * uH * 22.0);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 holo = mix(uAccent * (l * 1.3 + 0.05), c, 0.18);
  vec3 col = mix(holo, c * 1.03, uFocus);
  col *= 1.0 - 0.16 * steep * (1.0 - uFocus * 0.5);
  float sl = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.7 + uTime * 2.0);
  col *= 1.0 - mix(0.34, 0.018, uFocus) * sl;
  float edge = smoothstep(0.03, 0.5, a) * (1.0 - smoothstep(0.6, 0.99, a));
  vec3 em = uAccent * edge * mix(0.9, 0.6, uFocus);
  em += uAccent * exp(-pow((vY - uScan) / 0.026, 2.0)) * 0.6;
  float r = length(vUv - 0.5) * 1.45, front = uReveal * 1.3;
  float vis = 1.0 - smoothstep(front - 0.03, front, r);
  em += uAccent * smoothstep(front - 0.16, front - 0.02, r) * vis * 1.3;
  float bar = step(0.8, fract(sin(floor(vUv.y * 30.0) * 12.9898 + floor(uTime * 24.0) * 7.1) * 43758.5453));
  em += uAccent * uGlitch * (0.25 + bar * 0.6);
  float al = a * vis * mix(0.74, 1.0, uFocus);
  if (uGlow > 0.5) {            // light-only pass, feeds the bloom; the dish still hides what is behind it
    gl_FragColor = vec4(em + holo * (1.0 - uFocus) * 0.14 + c * smoothstep(0.7, 1.0, l) * 0.12 * uFocus, a * vis);
    return;
  }
  col += em;
  if (uMirror > 0.5) {          // reflection in the projector glass
    float rr = length(vW.xz - uCenter.xz);
    float m = (1.0 - smoothstep(1.0, 1.3, rr)) * exp(-vY * 4.5);
    gl_FragColor = vec4(mix(col, uAccent * (l + 0.1), 0.4), al * 0.34 * m);
    return;
  }
  gl_FragColor = vec4(col, al);
}`;
const BASE_FS = `
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  vec2 p = vUv * 2.0 - 1.0; float r = length(p); float an = atan(p.y, p.x);
  float ring = smoothstep(0.014, 0.0, abs(r - 0.955)) * 1.3 + 0.6 * smoothstep(0.01, 0.0, abs(r - 0.8));
  float dash = step(0.5, fract(an * 14.0 / 6.2831853 + uTime * 0.08)) * smoothstep(0.02, 0.0, abs(r - 0.875));
  float tick = step(0.86, fract(an * 60.0 / 6.2831853)) * smoothstep(0.03, 0.0, abs(r - 0.68)) * 0.6;
  float lens = smoothstep(0.34, 0.0, r) * 0.4 + smoothstep(0.012, 0.0, abs(r - 0.36)) * 0.7;
  float glow = pow(max(0.0, 1.0 - r), 2.0) * 0.5;
  float a = (ring + dash * 0.9 + tick + glow + lens * uOn) * mix(0.3, 1.0, uOn) * step(r, 1.0);
  float glass = step(r, 1.0) * 0.8;          // dark glass under the light
  gl_FragColor = vec4(uAccent * a, glass);
}`;
const SIDE_FS = `
uniform vec3 uAccent; uniform float uOn;
varying vec2 vUv;
void main(){
  float lip = smoothstep(0.7, 0.98, vUv.y);
  vec3 body = vec3(0.02, 0.03, 0.045) + uAccent * 0.05;
  gl_FragColor = vec4(body + uAccent * lip * mix(0.35, 1.0, uOn), 1.0);
}`;
const CONE_FS = `
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  float streak = 0.72 + 0.28 * sin(vUv.x * 190.0 + sin(vUv.x * 37.0) * 4.0);
  float rise = 0.85 + 0.15 * sin(vUv.y * 26.0 - uTime * 3.0);
  float a = pow(1.0 - vUv.y, 1.6) * 0.42 * streak * rise * uOn;
  gl_FragColor = vec4(uAccent * a, a);
}`;
const BEAM_FS = `
uniform vec3 uAccent; uniform float uTime; uniform float uOn;
varying vec2 vUv;
void main(){
  float streak = 0.6 + 0.4 * sin(vUv.x * 120.0 + sin(vUv.x * 23.0 + uTime * 0.3) * 5.0);
  float a = pow(1.0 - vUv.y, 2.4) * 0.2 * streak * uOn;
  gl_FragColor = vec4(uAccent * a, a);
}`;
const HUD_FS = `
uniform vec3 uAccent; uniform float uTime; uniform float uOn; uniform float uKind;
varying vec3 vL;
void main(){
  float r = length(vL.xz), an = atan(vL.z, vL.x) / 6.2831853 + 0.5, a = 0.0;
  if (uKind < 0.5) {            // flat instrument ring around the projector
    float t = an + uTime * 0.012;
    a += smoothstep(0.01, 0.0, abs(r - 1.5)) * 0.55;
    a += step(0.5, fract(t * 180.0)) * smoothstep(0.03, 0.0, abs(r - 1.55)) * 0.4;
    a += step(0.88, fract(t * 12.0)) * smoothstep(0.055, 0.0, abs(r - 1.575)) * 0.9;
    a += smoothstep(0.016, 0.0, abs(r - 1.69)) * step(0.66, fract(-an * 3.0 + uTime * 0.045));
  } else if (uKind < 1.5) {     // tilted orbit with one bright satellite
    float d = abs(fract(an - uTime * 0.07) - 0.5);
    a += smoothstep(0.012, 0.0, abs(r - 1.86)) * (0.2 + 0.9 * smoothstep(0.16, 0.0, d));
    a += smoothstep(0.05, 0.0, length(vec2((fract(an - uTime * 0.07) - 0.5) * 11.7, r - 1.86))) * 1.6;
  } else {                      // scanner hoop that rides up with the scan line
    a += smoothstep(0.011, 0.0, abs(r - 1.3)) * 0.8 + smoothstep(0.12, 0.0, abs(r - 1.3)) * 0.07;
  }
  a *= uOn;
  gl_FragColor = vec4(uAccent * a, a);
}`;
const FLOOR_FS = `
uniform vec3 uAccent; uniform float uTime; uniform vec2 uHub; uniform float uPulse; uniform float uGlow;
varying vec3 vW;
void main(){
  vec2 q = vW.xz - uHub; float r = length(q); float an = atan(q.y, q.x);
  float rings = smoothstep(0.03, 0.0, abs(fract(r * 0.5) - 0.5) * 2.0 - 0.94);
  float spokes = smoothstep(0.012, 0.0, abs(fract(an * 24.0 / 6.2831853) - 0.5) * 2.0 - 0.985 + 0.012 / max(r, 0.4));
  float d0 = length(vW.xz);
  float fade = exp(-d0 * 0.16) * smoothstep(13.0, 6.0, d0);
  float pool = exp(-d0 * d0 * 0.22) * 0.5;
  float rp = uPulse * 5.5;
  float ripple = exp(-pow((d0 - rp) / 0.16, 2.0)) * exp(-uPulse * 2.6) * step(1.3, d0) * 1.3;
  float a = ((rings * 0.42 + spokes * 0.26) * fade + pool + ripple) * mix(1.0, 0.45, uGlow);
  gl_FragColor = vec4(uAccent * a * 0.55, a * 0.55);
}`;
const TABLE_FS = `
uniform sampler2D map; uniform sampler2D hmap; uniform vec2 uHub; uniform float uTheta; uniform float uSize; uniform float uSpec; uniform float uShin;
uniform float uBump; uniform float uRt; uniform float uGlow; uniform float uFade; uniform float uSide; uniform vec3 uLamp; uniform vec3 uCam;
varying vec3 vW;
void main(){
  if (uGlow > 0.5) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }      // the table gives off no light, it only hides what is under it
  vec2 q = vW.xz - uHub; float r = length(q);
  float cs = cos(uTheta), sn = sin(uTheta);
  vec2 t = vec2(cs * q.x - sn * q.y, sn * q.x + cs * q.y);                    // the table turns with the dishes, like a lazy Susan
  vec2 uv = uSide > 0.5 ? vec2(atan(t.y, t.x) * uRt, vW.y) / uSize : t / uSize;
  vec3 alb = texture2D(map, uv).rgb; alb *= alb;
  float e = 1.0 / 512.0;
  vec2 g = vec2(texture2D(hmap, uv + vec2(e, 0.0)).r - texture2D(hmap, uv - vec2(e, 0.0)).r,
                texture2D(hmap, uv + vec2(0.0, e)).r - texture2D(hmap, uv - vec2(0.0, e)).r) * uBump;
  vec3 n = normalize(vec3(-(cs * g.x + sn * g.y), 1.0, sn * g.x - cs * g.y));
  vec3 l = normalize(vec3(0.5, 3.6, 1.5) - vW);
  float d = length(vW.xz - vec2(0.0, 0.1));
  float pool = 1.0 / pow(1.0 + d * d / 9.5, 1.5);                              // one lamp over the dish in front
  float dif = max(dot(n, l), 0.0) * pool;
  vec3 hv = normalize(l + normalize(uCam - vW));
  float sp = pow(max(dot(n, hv), 0.0), uShin) * uSpec * pool;
  vec3 col = alb * (vec3(0.035, 0.033, 0.036) + uLamp * dif * 1.25) + uLamp * sp;
  col *= uSide > 0.5 ? 0.3 : 0.2 + 0.8 * smoothstep(uRt, uRt - 1.2, r);
  gl_FragColor = vec4(sqrt(col) * uFade, 1.0);
}`;
const SHADOW_VS = `
uniform float uE; uniform vec2 uO; uniform float uLen;
varying vec2 vUv;
void main(){
  vUv = uv;
  vec2 q = position.xy - uO;
  vec3 p = vec3(q.x * 1.05, 0.0, -q.y / sin(uE) * uLen * 1.05 - 0.02);         // the dish's outline on the table, pushed a little away from the lamp
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const SHADOW_FS = `
uniform sampler2D aux; uniform float uK;
varying vec2 vUv;
float tap(vec2 o){ return texture2D(aux, vUv + o).g; }
void main(){
  float a = tap(vec2(0.0));
  float near = (a + tap(vec2(0.012, 0.0)) + tap(vec2(-0.012, 0.0)) + tap(vec2(0.0, 0.012)) + tap(vec2(0.0, -0.012))) / 5.0;
  float far = (tap(vec2(0.045, 0.012)) + tap(vec2(-0.045, -0.012)) + tap(vec2(0.012, -0.045)) + tap(vec2(-0.012, 0.045))
             + tap(vec2(0.032, 0.032)) + tap(vec2(-0.032, 0.032)) + tap(vec2(0.032, -0.032)) + tap(vec2(-0.032, -0.032))) / 8.0;
  gl_FragColor = vec4(0.0, 0.0, 0.0, (near * 0.55 + far * 0.45) * uK);
}`;
const UV_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const LOCAL_VS = 'varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const WORLD_VS = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const SPARK_VS = `
attribute float aSeed; uniform float uTime; uniform float uPx; uniform float uOn; varying float vA;
void main(){
  float t = fract(aSeed * 7.13 + uTime * (0.05 + 0.07 * fract(aSeed * 3.7)));
  vec3 p = position; p.y = t * 2.5; p.xz *= 1.0 + t * 0.3;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (1.5 + 3.5 * fract(aSeed * 5.3)) * uPx * 4.6 / -mv.z;
  vA = sin(t * 3.14159) * (0.35 + 0.65 * fract(aSeed * 9.1)) * uOn;
  gl_Position = projectionMatrix * mv;
}`;
const DUST_VS = `
attribute float aSeed; uniform float uTime; uniform float uPx; varying float vA;
void main(){
  vec3 p = position;
  p.y = mod(p.y + uTime * (0.03 + 0.05 * aSeed), 5.0);
  p.x += sin(uTime * 0.11 + aSeed * 40.0) * 0.35;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = min((1.0 + 2.6 * fract(aSeed * 5.3)) * uPx * 5.0 / max(-mv.z, 0.5), 7.0 * uPx);
  vA = (0.12 + 0.3 * fract(aSeed * 9.1)) * smoothstep(0.0, 0.6, p.y) * smoothstep(5.0, 3.6, p.y) * (0.6 + 0.4 * sin(uTime * (0.5 + aSeed) + aSeed * 30.0));
  gl_Position = projectionMatrix * mv;
}`;
const SPARK_FS = 'uniform vec3 uAccent; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(uAccent * a, a); }';
const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BLUR_FS = `
uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
void main(){
  vec4 s = texture2D(tex, vUv) * 0.227027;
  s += (texture2D(tex, vUv + dir * 1.384615) + texture2D(tex, vUv - dir * 1.384615)) * 0.316216;
  s += (texture2D(tex, vUv + dir * 3.230769) + texture2D(tex, vUv - dir * 3.230769)) * 0.070270;
  gl_FragColor = s;
}`;
const BLOOM_FS = `
uniform sampler2D a; uniform sampler2D b; uniform float k; varying vec2 vUv;
void main(){
  vec3 c = (texture2D(a, vUv).rgb * 0.6 + texture2D(b, vUv).rgb * 0.95) * k;
  gl_FragColor = vec4(c, clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0));
}`;

/* ---------------- scene ---------------- */
let renderer = null, scene, camera, ring, floorM, tableM, rimM, tU, flatTex, logoM, logoTex, sparks, dust, halo, geoHi, geoLo, geoBase, geoSide, geoCone, geoPick, loader, softTex, fx, fxU, hoop, orbit;
let rtG, rtB1, rtB2, rtC1, rtC2, quad, quadScene, quadCam, blurM, bloomM, bloomOn = true;
const U = { time: { value: 0 }, accent: { value: null }, px: { value: 1 }, hub: { value: null }, glow: { value: 0 }, pulse: { value: 9 }, table: { value: 0 }, refl: { value: 0 }, mask: { value: null } };
const camP = T ? new T.Vector3(0, 4.15, 4.05) : null, look = T ? new T.Vector3(0, .5, -.15) : null, camT = T ? new T.Vector3() : null, lookT = T ? new T.Vector3() : null;
const SIZE = 2.3, PUCK = .07, LIFT = .5;
let clock = 0, fxOn = 0;

function softDot() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new T.CanvasTexture(cv);
}
const addMat = (fs, uniforms, vs, extra) => new T.ShaderMaterial(Object.assign({ uniforms: uniforms, vertexShader: vs || UV_VS, fragmentShader: fs, transparent: true, depthWrite: false, blending: T.AdditiveBlending }, extra || {}));
function initGL() {
  if (!T) return;
  try { renderer = new T.WebGLRenderer({ canvas: $('gl'), antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { renderer = null; return; }
  const pr = Math.min(window.devicePixelRatio || 1, 2); renderer.setPixelRatio(pr); renderer.setClearColor(0x000000, 0); U.px.value = pr;
  U.accent.value = new T.Color('#5fd0ff'); U.hub.value = new T.Vector2(0, -4.2); U.mask.value = new T.Vector4(0, -4.2, 0, 7);
  scene = new T.Scene(); camera = new T.PerspectiveCamera(38, 1, .1, 80);
  loader = new T.TextureLoader(); softTex = softDot();
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  geoHi = new T.PlaneGeometry(1, 1, small ? 220 : 300, small ? 220 : 300); geoLo = new T.PlaneGeometry(1, 1, 96, 96);
  geoBase = new T.CircleGeometry(1.36, 72); geoBase.rotateX(-PI / 2); geoBase.translate(0, PUCK, 0);
  geoSide = new T.CylinderGeometry(1.36, 1.4, PUCK + .03, 72, 1, true); geoSide.translate(0, (PUCK - .03) / 2, 0);
  geoCone = new T.CylinderGeometry(1.2, .42, LIFT - PUCK + .05, 64, 1, true); geoCone.translate(0, PUCK + (LIFT - PUCK + .05) / 2, 0);
  geoPick = new T.CylinderGeometry(1.15, 1.15, 1.0, 16); geoPick.translate(0, .6, 0);
  floorM = new T.Mesh(new T.CircleGeometry(15, 64).rotateX(-PI / 2), addMat(FLOOR_FS, { uAccent: U.accent, uTime: U.time, uHub: U.hub, uPulse: U.pulse, uGlow: U.glow }, WORLD_VS));
  floorM.position.y = -.02; floorM.renderOrder = -6; scene.add(floorM);
  /* the table: one lit disc that turns with the carousel, and its edge */
  const px1 = (r, g, b) => { const t = new T.DataTexture(new Uint8Array([r, g, b]), 1, 1, T.RGBFormat); t.needsUpdate = true; return t; };
  flatTex = px1(128, 128, 128);
  tU = { map: { value: px1(20, 18, 16) }, hmap: { value: flatTex }, uHub: U.hub, uTheta: { value: 0 }, uSize: { value: 6 }, uSpec: { value: .1 }, uShin: { value: 20 }, uBump: { value: 0 },
    uRt: { value: 7 }, uGlow: U.glow, uFade: { value: 0 }, uSide: { value: 0 }, uLamp: { value: new T.Color(1, .95, .86) }, uCam: { value: camera.position } };
  tableM = new T.Mesh(new T.CircleGeometry(1, 96).rotateX(-PI / 2), new T.ShaderMaterial({ uniforms: tU, vertexShader: WORLD_VS, fragmentShader: TABLE_FS })); tableM.visible = false; scene.add(tableM);
  rimM = new T.Mesh(new T.CylinderGeometry(1, 1, .5, 96, 1, true).translate(0, -.25, 0), new T.ShaderMaterial({ uniforms: Object.assign({}, tU, { uSide: { value: 1 } }), vertexShader: WORLD_VS, fragmentShader: TABLE_FS })); rimM.visible = false; scene.add(rimM);
  logoM = new T.Mesh(new T.CircleGeometry(1.5, 64).rotateX(-PI / 2), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: .85 }));
  logoM.position.set(0, .01, -4.2); logoM.renderOrder = -5; scene.add(logoM);
  ring = new T.Group(); scene.add(ring);
  halo = new T.Sprite(new T.SpriteMaterial({ map: softTex, color: 0xffffff, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: .2 }));
  halo.scale.set(6.6, 4.4, 1); halo.position.set(0, .8, -1.5); halo.renderOrder = -4; scene.add(halo);

  /* light that belongs to the dish in front: beam, instrument ring, orbit, scanner hoop, sparks */
  fx = new T.Group(); scene.add(fx); fxU = { uAccent: U.accent, uTime: U.time, uOn: { value: 0 } };
  const beam = new T.Mesh(new T.CylinderGeometry(1.5, 1.36, 2.7, 64, 1, true).translate(0, PUCK + 1.35, 0), addMat(BEAM_FS, fxU, UV_VS, { side: T.BackSide })); beam.renderOrder = -1; fx.add(beam);
  const dial = new T.Mesh(new T.RingGeometry(1.44, 1.74, 128).rotateX(-PI / 2), addMat(HUD_FS, Object.assign({ uKind: { value: 0 } }, fxU), LOCAL_VS, { side: T.DoubleSide })); dial.position.y = .012; dial.renderOrder = -2; fx.add(dial);
  orbit = new T.Mesh(new T.RingGeometry(1.8, 1.92, 128).rotateX(-PI / 2), addMat(HUD_FS, Object.assign({ uKind: { value: 1 } }, fxU), LOCAL_VS, { side: T.DoubleSide, depthTest: true })); orbit.position.y = LIFT + .16; orbit.rotation.set(.2, 0, -.12); orbit.renderOrder = 5; fx.add(orbit);
  hoop = new T.Mesh(new T.RingGeometry(1.1, 1.5, 96).rotateX(-PI / 2), addMat(HUD_FS, { uAccent: U.accent, uTime: U.time, uOn: { value: 0 }, uKind: { value: 2 } }, LOCAL_VS, { side: T.DoubleSide })); hoop.renderOrder = 5; fx.add(hoop);
  const n = 150, pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = .25 + Math.sqrt(Math.random()) * 1.0; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0; pos[i * 3 + 2] = Math.sin(a) * r; seed[i] = Math.random(); }
  const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(pos, 3)); sg.setAttribute('aSeed', new T.BufferAttribute(seed, 1));
  sparks = new T.Points(sg, addMat(SPARK_FS, { uAccent: U.accent, uTime: U.time, uPx: U.px, uOn: fxU.uOn }, SPARK_VS)); sparks.frustumCulled = false; sparks.renderOrder = 6; fx.add(sparks);
  const m = 240, dp = new Float32Array(m * 3), ds = new Float32Array(m);
  for (let i = 0; i < m; i++) { dp[i * 3] = (Math.random() - .5) * 20; dp[i * 3 + 1] = Math.random() * 5; dp[i * 3 + 2] = 3 - Math.random() * 16; ds[i] = Math.random(); }
  const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3)); dg.setAttribute('aSeed', new T.BufferAttribute(ds, 1));
  dust = new T.Points(dg, addMat(SPARK_FS, { uAccent: U.accent, uTime: U.time, uPx: U.px }, DUST_VS)); dust.frustumCulled = false; dust.renderOrder = 7; scene.add(dust);

  /* bloom: the light-only render, blurred twice, added over the picture */
  const rt = (depth) => new T.WebGLRenderTarget(4, 4, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: depth, stencilBuffer: false });
  rtG = rt(true); rtB1 = rt(false); rtB2 = rt(false); rtC1 = rt(false); rtC2 = rt(false);
  quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1); quadScene = new T.Scene();
  blurM = new T.ShaderMaterial({ uniforms: { tex: { value: null }, dir: { value: new T.Vector2() } }, vertexShader: QUAD_VS, fragmentShader: BLUR_FS, depthTest: false, depthWrite: false });
  bloomM = new T.ShaderMaterial({ uniforms: { a: { value: rtB2.texture }, b: { value: rtC2.texture }, k: { value: 1 } }, vertexShader: QUAD_VS, fragmentShader: BLOOM_FS, depthTest: false, depthWrite: false, transparent: true,
    blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor });
  quad = new T.Mesh(new T.PlaneGeometry(2, 2), blurM); quad.frustumCulled = false; quadScene.add(quad);
}
function blur(src, dst, dx, dy) { quad.material = blurM; blurM.uniforms.tex.value = src.texture; blurM.uniforms.dir.value.set(dx, dy); renderer.setRenderTarget(dst); renderer.render(quadScene, quadCam); }
function draw() {
  if (bloomOn) {
    const hv = halo.visible, lv = logoM.visible; U.glow.value = 1; halo.visible = false; if (S.table) logoM.visible = false;      // a logo printed on a table does not glow
    renderer.setRenderTarget(rtG); renderer.render(scene, camera); U.glow.value = 0; halo.visible = hv; logoM.visible = lv;
    blur(rtG, rtB1, 2 / rtG.width, 0); blur(rtB1, rtB2, 0, 1.5 / rtB1.height); blur(rtB2, rtC1, 2 / rtB2.width, 0); blur(rtC1, rtC2, 0, 2 / rtC1.height);
  }
  renderer.setRenderTarget(null); renderer.render(scene, camera);
  if (bloomOn) { quad.material = bloomM; renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = true; }
}
function domeAux() {            // a plain photo with no depth: round matte, gentle dome
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'), im = x.createImageData(256, 256);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) { const r = Math.hypot(i - 127.5, j - 127.5) / 124, k = (j * 256 + i) * 4; im.data[k] = Math.max(0, 1 - r * r) * 255; im.data[k + 1] = clamp((1 - r) * 28) * 255; im.data[k + 3] = 255; }
  x.putImageData(im, 0, 0); return new T.CanvasTexture(cv);
}
function placeholderMap() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const x = cv.getContext('2d');
  x.fillStyle = '#0a1016'; x.fillRect(0, 0, 512, 512); x.strokeStyle = '#9fb4c0'; x.lineWidth = 3;
  [200, 150].forEach((r, i) => { x.setLineDash(i ? [4, 10] : [16, 12]); x.beginPath(); x.arc(256, 256, r, 0, TAU); x.stroke(); });
  x.setLineDash([]); if (!CLIENT) { x.lineWidth = 5; x.beginPath(); x.moveTo(256, 216); x.lineTo(256, 296); x.moveTo(216, 256); x.lineTo(296, 256); x.stroke(); }
  return new T.CanvasTexture(cv);
}
function photoMap(img) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 768; const x = cv.getContext('2d'), s = Math.max(768 / img.width, 768 / img.height);
  x.drawImage(img, (768 - img.width * s) / 2, (768 - img.height * s) / 2, img.width * s, img.height * s); return new T.CanvasTexture(cv);
}
function makeItem(d, key) {
  const g = new T.Group(), meta = ASSETS[key] || null;
  const um = { map: { value: null }, aux: { value: null }, uH: { value: meta ? meta.h : .1 }, uE: { value: (meta ? meta.e : 90) * PI / 180 }, uFocus: { value: 0 }, uReveal: { value: 0 }, uTime: U.time, uScan: { value: -9 },
    uGlitch: { value: 0 }, uGlow: U.glow, uMirror: { value: 0 }, uAccent: U.accent, uCenter: { value: g.position }, uTable: U.table, uLight: { value: 1 }, uRefl: U.refl, uMask: U.mask, uO: { value: new T.Vector2(meta && meta.o ? meta.o[0] : 0, meta && meta.o ? meta.o[1] : 0) } };
  const dishMat = (mirror) => new T.ShaderMaterial({ uniforms: mirror ? Object.assign({}, um, { uMirror: { value: 1 } }) : um, vertexShader: DISH_VS, fragmentShader: DISH_FS, transparent: true, side: T.DoubleSide, depthWrite: !mirror });
  const mesh = new T.Mesh(geoLo, dishMat(false)); mesh.frustumCulled = false; mesh.rotation.order = 'YXZ'; mesh.visible = false; g.add(mesh);
  const mir = new T.Group(); mir.scale.y = -1; mir.position.y = 2 * PUCK; g.add(mir);
  const refl = new T.Mesh(geoLo, dishMat(true)); refl.frustumCulled = false; refl.rotation.order = 'YXZ'; refl.renderOrder = -1.5; refl.visible = false; mir.add(refl);
  const ub = { uAccent: U.accent, uTime: U.time, uOn: { value: 0 } };
  const side = new T.Mesh(geoSide, new T.ShaderMaterial({ uniforms: ub, vertexShader: UV_VS, fragmentShader: SIDE_FS })); side.renderOrder = -3; g.add(side);
  const base = new T.Mesh(geoBase, new T.ShaderMaterial({ uniforms: ub, vertexShader: UV_VS, fragmentShader: BASE_FS, transparent: true, depthWrite: false,
    blending: T.CustomBlending, blendEquation: T.AddEquation, blendSrc: T.OneFactor, blendDst: T.OneMinusSrcAlphaFactor, blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor })); base.renderOrder = -2.5; g.add(base);
  const cone = new T.Mesh(geoCone, addMat(CONE_FS, ub, UV_VS, { side: T.DoubleSide })); cone.renderOrder = -1; g.add(cone);
  const pick = new T.Mesh(geoPick, new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false })); pick.renderOrder = -9; g.add(pick);
  const shadow = new T.Mesh(geoLo, new T.ShaderMaterial({ uniforms: { aux: um.aux, uE: um.uE, uO: um.uO, uLen: { value: meta && meta.o ? .5 : 1 }, uK: { value: 0 } }, vertexShader: SHADOW_VS, fragmentShader: SHADOW_FS, transparent: true, depthWrite: false }));
  shadow.frustumCulled = false; shadow.renderOrder = -2; shadow.position.y = .006; shadow.visible = false; g.add(shadow);
  const it = { d: d, g: g, mesh: mesh, refl: refl, mir: mir, shadow: shadow, stage: [side, base, cone], um: um, ub: ub, pick: pick, a: 0, yaw: 0, user: 0, ready: 0, born: 1e9, own: [], e: meta ? meta.e * PI / 180 : null, s: meta && meta.s ? meta.s : 1, stand: !!(meta && meta.o) };
  const done = () => { it.ready++; if (it.ready >= 2) { mesh.visible = refl.visible = true; it.born = clock + .1; itemMode(it); } };
  itemMode(it);
  const tune = (t, mip) => { t.generateMipmaps = mip; t.minFilter = mip ? T.LinearMipmapLinearFilter : T.LinearFilter; t.anisotropy = mip ? renderer.capabilities.getMaxAnisotropy() : 1; t.needsUpdate = true; it.own.push(t); return t; };
  if (d.photo) { um.map.value = tune(photoMap(d.photo), true); um.aux.value = tune(domeAux(), false); um.uH.value = .09; um.uE.value = PI / 2; it.ready = 1; done(); }
  else if (meta) { um.map.value = loader.load(IMG + key + '.jpg', (t) => { tune(t, true); done(); }); um.aux.value = loader.load(IMG + key + '.png', (t) => { tune(t, false); done(); }); }
  else { um.map.value = tune(placeholderMap(), true); um.aux.value = tune(domeAux(), false); um.uH.value = .02; um.uE.value = PI / 2; it.ready = 1; it.empty = true; done(); }
  return it;
}
function itemMode(it) {          // hologram stage or table: which parts of a dish's kit are in use
  const on = !!S.table; it.stage.forEach((m) => { m.visible = !on; }); it.shadow.visible = on && it.ready >= 2 && !it.empty;
  it.mir.position.y = on ? 0 : 2 * PUCK; it.refl.material.depthTest = !on;
}
function clearRing() {
  S.items.forEach((it) => { if (!it.g) return; ring.remove(it.g); it.own.forEach((t) => t.dispose()); it.shadow.material.dispose(); ['map', 'aux'].forEach((k) => { const t = it.um[k].value; if (t && t.dispose) t.dispose(); }); it.mesh.material.dispose(); it.refl.material.dispose(); });
  S.items = [];
}
function layRing(keep) {
  const v = S.venue, order = v.courses.map((c) => c.id), all = v.dishes.map((d, i) => ({ d: d, i: i })).sort((a, b) => order.indexOf(a.d.c) - order.indexOf(b.d.c));
  const keepDish = keep && S.items[S.idx] ? S.items[S.idx].d : null;
  if (renderer) clearRing(); else S.items = [];
  S.single = all.length <= 12; if (!S.single && (!S.course || order.indexOf(S.course) < 0)) S.course = order[0];
  const list = S.single ? all : all.filter((o) => o.d.c === S.course), N = list.length, sg = dirSign(), step = TAU / Math.max(N, 1);
  S.RR = N < 3 ? 2.9 : clamp(3.05 / (2 * Math.sin(step / 2)), 2.9, 6.4); if (renderer) { U.hub.value.set(0, -S.RR); logoM.position.z = -S.RR; logoM.scale.setScalar(clamp(S.RR / 4.4, .7, 1.2)); }
  S.items = list.map((o, k) => {
    const it = renderer ? makeItem(o.d, o.d.a || (v.id + '-' + o.i)) : { d: o.d, g: null };
    it.a = sg * k * step; if (it.g) { it.g.userData.index = k; it.pick.userData.index = k; ring.add(it.g); }
    return it;
  });
  const ki = keepDish ? list.findIndex((o) => o.d === keepDish) : -1; S.turn = S.idx = ki >= 0 ? ki : 0; S.thetaT = S.theta = -S.items[S.idx].a;
}
function resize() {
  if (!renderer) return; const w = app.clientWidth, h = app.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); const asp = w / h; S.wide = w >= 700 && asp >= 1.25;
  let fov = S.wide ? (S.table ? 33 : 45) : 2 * Math.atan(1.5 / 5.5 / asp) * 180 / PI;      // over a table a longer lens keeps glasses upright and plates round fov = clamp(fov, 30, 66);
  camera.aspect = asp; camera.fov = fov; camera.setViewOffset(w, h, S.wide ? (S.lang === 'he' ? .13 : -.13) * w : 0, S.wide ? -.03 * h : .09 * h, w, h); camera.updateProjectionMatrix();
  const bw = renderer.domElement.width, bh = renderer.domElement.height, s2 = (n) => Math.max(2, Math.round(n));
  rtG.setSize(s2(bw / 2), s2(bh / 2)); rtB1.setSize(s2(bw / 4), s2(bh / 4)); rtB2.setSize(s2(bw / 4), s2(bh / 4)); rtC1.setSize(s2(bw / 8), s2(bh / 8)); rtC2.setSize(s2(bw / 8), s2(bh / 8));
}
let lastNow = 0, scanAt = 2.2, slow = 0, tier = 0;
function frame(now) {
  requestAnimationFrame(frame); if (!renderer || document.hidden) { lastNow = now; return; }
  const raw = Math.max(0, (now - (lastNow || now)) / 1000), dt = Math.min(.05, raw); lastNow = now;
  if (!S.noAdapt && tier < 2) {                 // a phone that cannot keep up loses the bloom first, then the extra pixels
    slow = raw > .045 ? slow + 1 : Math.max(0, slow - 2);
    if (slow > 50) { slow = 0; tier++; if (tier === 1) bloomOn = false; else { renderer.setPixelRatio(1); U.px.value = 1; resize(); } }
  }
  step(dt); draw();
}
function step(dt) {
  clock += dt; const t = clock; U.time.value = t; U.pulse.value += dt;
  if (S.drag && !S.focus) S.theta = S.thetaT; else S.theta += (S.thetaT - S.theta) * (1 - Math.exp(-dt * 7));
  const N = S.items.length, stp = TAU / Math.max(N, 1), RR = S.RR;
  const F = S.focus, k2 = 1 - Math.exp(-dt * 4);
  const tall = S.items[S.idx] && S.items[S.idx].stand ? 1 : 0;      // a standing glass needs the camera to look a little higher
  const TB = S.table;
  const back = TB && S.wide ? 1.4 : 1;
  if (TB) { camT.set(0, F ? 3.55 + tall * .1 : 4.6, F ? 2.9 + tall * .3 : 3.9); lookT.set(0, .12 + tall * (F ? .7 : .38), F ? -.1 : -.25); camT.sub(lookT).multiplyScalar(back).add(lookT); }   // over a table the camera sits where the photos were taken from
  else { camT.set(0, F ? 3.4 + tall * .1 : 4.15, F ? 3.1 + tall * .2 : 4.05); lookT.set(0, .5 + tall * (F ? .55 : .12), F ? -.05 : -.15); }
  camP.lerp(camT, k2); look.lerp(lookT, k2); camera.position.copy(camP);
  if (!reduce) camera.position.x += TB ? (Math.sin(t * .27) * .4 + S.px * .55) * back : Math.sin(t * .21) * .06;      // on a table the plates stay put and the viewer drifts
  camera.lookAt(look);
  if (TB) { const Rt = RR + 7; tU.uTheta.value = S.theta; tU.uRt.value = Rt; tU.uFade.value += ((TB.ready ? 1 : 0) - tU.uFade.value) * (1 - Math.exp(-dt * 5));
    tableM.position.set(0, 0, -RR); tableM.scale.set(Rt, 1, Rt); rimM.position.copy(tableM.position); rimM.scale.copy(tableM.scale); U.mask.value.set(0, -RR, 0, Rt); }
  let scan = -9; const ph = t - scanAt; if (ph > 0 && ph < 1.6 && !reduce) scan = -.06 + ph / 1.6 * 1.0; if (ph > 8) scanAt = t;
  const C = camera.position;
  S.items.forEach((it, k) => {
    if (!it.g) return; const an = it.a + S.theta, da = Math.atan2(Math.sin(an), Math.cos(an));
    const w = clamp(1 - Math.abs(da) / Math.min(stp, 1.1)), e = smooth(w), hero = k === S.idx, P = it.g.position;
    P.set(Math.sin(an) * RR, 0, Math.cos(an) * RR - RR);
    it.um.uFocus.value += ((e > .55 ? 1 : e * .5) - it.um.uFocus.value) * (1 - Math.exp(-dt * 6));
    it.ub.uOn.value += ((hero ? 1 : 0) * (S.focus ? .8 : 1) + .22 - it.ub.uOn.value) * (1 - Math.exp(-dt * 5));
    const age = t - it.born; it.um.uReveal.value = reduce ? (age > 0 ? 1 : 0) : clamp(age / .9);
    it.um.uGlitch.value *= Math.exp(-dt * 7); if (it.um.uGlitch.value < .004) it.um.uGlitch.value = 0;
    it.um.uScan.value = hero ? scan / (SIZE * it.s) : -9;
    const geo = hero ? geoHi : geoLo; if (it.mesh.geometry !== geo) it.mesh.geometry = geo;
    const idle = reduce ? 0 : Math.sin(t * .5 + k) * (it.stand ? .32 : .2) * e;
    if (!hero) it.user *= Math.max(0, 1 - dt * 4);
    if (TB) {                    // resting on the table: flat, still, lit by how close it is to the lamp
      const dl = Math.hypot(P.x, P.z - .1), lf = .2 + .8 / Math.pow(1 + dl * dl / 9.5, 1.5), age2 = clamp((t - it.born) / .7);
      it.um.uLight.value += (lf - it.um.uLight.value) * (1 - Math.exp(-dt * 6)); it.um.uReveal.value = reduce ? (age2 > 0 ? 1 : 0) : smooth(age2);
      it.yaw += ((hero ? it.user : 0) - it.yaw) * (1 - Math.exp(-dt * 6));
      const ry = Math.atan2(camP.x - P.x, camP.z - P.z) * .85 + it.yaw, sc2 = SIZE * it.s * (.96 + .04 * it.um.uReveal.value);
      [it.mesh, it.refl].forEach((m) => { m.position.y = .016; m.rotation.y = ry; m.rotation.x = 0; m.scale.setScalar(sc2); });
      it.shadow.rotation.y = ry; it.shadow.scale.setScalar(sc2); it.shadow.material.uniforms.uK.value = (it.stand ? .42 : .62) * it.um.uReveal.value;
      return;
    }
    it.yaw += ((hero ? S.px * .32 : 0) + idle + it.user - it.yaw) * (1 - Math.exp(-dt * 6));
    // the photo looks right from its own camera angle: face the viewer and tip the hologram until that angle is ours
    const y0 = (it.stand ? PUCK + .1 : LIFT) + (reduce ? 0 : Math.sin(t * 1.1 + k * 2.1) * .02), dx = C.x - P.x, dz = C.z - P.z, el = Math.atan2(C.y - y0, Math.hypot(dx, dz));
    const tip = it.e == null ? .28 : clamp(it.e - el, -.4, .4), sc = SIZE * it.s * (1 + .05 * e);
    [it.mesh, it.refl].forEach((m) => { m.position.y = y0; m.rotation.y = Math.atan2(dx, dz) * .85 + it.yaw; m.rotation.x = tip; m.scale.setScalar(sc); });
  });
  const hi = S.items[S.idx];
  if (hi && hi.g && !TB) {
    const settle = 1 - clamp(Math.abs(S.thetaT - S.theta) / stp * 2.2);
    fxOn += (settle * (hi.ready >= 2 ? 1 : 0) - fxOn) * (1 - Math.exp(-dt * 6)); fxU.uOn.value = fxOn; fx.position.copy(hi.g.position);
    orbit.rotation.y = t * .1; hoop.position.y = LIFT + Math.max(scan, 0) * .92; hoop.material.uniforms.uOn.value = scan > -1 ? fxOn * Math.sin(clamp((scan + .06) / 1.0) * PI) : 0;
  }
  halo.material.opacity = .16 + (reduce ? 0 : Math.sin(t * .9) * .02);
}
function applyTheme(v) {
  const ac = v.theme.holo || v.theme.accent; root.style.setProperty('--accent', ac); root.style.setProperty('--on-accent', onColor(ac));
  const c = hexRgb(ac); root.style.setProperty('--glow', 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',.16)'); root.style.setProperty('--line', 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',.28)');
  if (!renderer) return; U.accent.value.set(ac); halo.material.color.set(ac); drawLogo();
}
function logoCanvas(v, solid) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 512; const x = cv.getContext('2d'), ac = v.theme.holo || v.theme.accent, ink = solid ? onColor(ac) : '#ffffff';
  if (solid) { x.fillStyle = ac; x.beginPath(); x.arc(256, 256, 256, 0, TAU); x.fill(); }
  if (v.logoImg) { if (!solid && !S.table) { x.fillStyle = 'rgba(255,255,255,.08)'; x.beginPath(); x.arc(256, 256, 250, 0, TAU); x.fill(); } const im = v.logoImg, s = Math.min(330 / im.width, 330 / im.height); x.drawImage(im, 256 - im.width * s / 2, 256 - im.height * s / 2, im.width * s, im.height * s); return cv; }
  x.strokeStyle = ink; x.lineWidth = 3; x.beginPath(); x.arc(256, 256, 236, 0, TAU); x.stroke(); x.lineWidth = 1.5; x.beginPath(); x.arc(256, 256, 222, 0, TAU); x.stroke();
  if (!solid) { x.lineWidth = 6; x.setLineDash([2, 13]); x.beginPath(); x.arc(256, 256, 248, 0, TAU); x.stroke(); x.setLineDash([]); }
  const name = tx(v.name), words = name.split(/\s+/); let lines = [name];
  if (words.length > 1 && name.length > 8) { let best = 1, bd = 1e9; for (let i = 1; i < words.length; i++) { const dd = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (dd < bd) { bd = dd; best = i; } } lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')]; }
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = ink; let size = 128;
  do { size -= 4; x.font = '700 ' + size + 'px "Frank Ruhl Libre","Times New Roman",serif'; } while (Math.max.apply(null, lines.map((l) => x.measureText(l).width)) > 340 && size > 30);
  const lh = size * 1.04; lines.forEach((l, i) => x.fillText(l, 256, 246 + (i - (lines.length - 1) / 2) * lh));
  const sub = tx(v.area).toUpperCase(); if (sub) { x.font = '600 21px "IBM Plex Sans Hebrew",Arial,sans-serif'; x.fillText(sub, 256, Math.min(430, 246 + lines.length * lh / 2 + 34)); }
  return cv;
}
let tblMap = null, tblH = null;
function applySurface() {
  const v = S.venue, th = v.theme || {}, id = S.pick || th.surface || CFG.table || 'holo';
  let def = TABLES.find((t) => t.id === id) || TABLES[0];
  if (id === 'custom' && th.tableImg) def = { id: 'custom', img: th.tableImg, size: 5, spec: .06, shin: 12, bump: 0, refl: 0, ink: '#ffffff', mirror: true };   // the restaurant's own table photo
  const on = def.id !== 'holo';
  app.dataset.table = def.id;
  if (!renderer) { S.table = null; return; }
  if (!on) S.table = null;
  else if (!S.table || S.table.id !== def.id || S.table.img !== def.img) {
    const tb = S.table = Object.assign({ ready: false }, def); tU.uFade.value = 0;
    const set = (tex) => { tex.wrapS = tex.wrapT = def.mirror ? T.MirroredRepeatWrapping : T.RepeatWrapping; tex.anisotropy = renderer.capabilities.getMaxAnisotropy(); tex.needsUpdate = true; return tex; };
    loader.load(def.img || THEMES + def.id + '.jpg', (tex) => { if (S.table !== tb) { tex.dispose(); return; } if (tblMap) tblMap.dispose(); tblMap = tU.map.value = set(tex); tb.ready = true; });
    if (tblH) { tblH.dispose(); tblH = null; } tU.hmap.value = flatTex;
    if (!def.img) loader.load(THEMES + def.id + '_h.jpg', (tex) => { if (S.table !== tb) { tex.dispose(); return; } tblH = tU.hmap.value = set(tex); });
    tU.uSize.value = def.size; tU.uSpec.value = def.spec; tU.uShin.value = def.shin; tU.uBump.value = def.bump;
  }
  U.table.value = on ? 1 : 0; U.refl.value = on ? def.refl : 0;
  tableM.visible = rimM.visible = on; floorM.visible = halo.visible = fx.visible = !on;
  bloomM.uniforms.k.value = on ? .75 : 1;
  S.items.forEach((it) => { if (it.g) itemMode(it); });
  drawLogo();
}
function buildTableList() {
  const ul = $('tableList'); ul.textContent = ''; const cur = S.table ? S.table.id : 'holo', fit = S.venue.theme && S.venue.theme.fits, n = TABLES.length - 1;
  TABLES.forEach((tb, i) => {
    const li = document.createElement('li'), b = document.createElement('button'), sw = document.createElement('span'), nm = document.createElement('span');
    b.type = 'button'; b.setAttribute('aria-current', tb.id === cur ? 'true' : 'false'); sw.className = 'swatch' + (i ? '' : ' holo'); nm.className = 't-name'; nm.textContent = tb[S.lang] || tb.en;
    if (i) { sw.style.backgroundImage = 'url(' + THEMES + 'swatches.jpg)'; sw.style.backgroundSize = n * 100 + '% auto'; sw.style.backgroundPosition = ((i - 1) / (n - 1) * 100) + '% 50%'; }
    b.appendChild(sw); b.appendChild(nm);
    if (tb.id === fit) { const f = document.createElement('span'); f.className = 't-fit'; f.textContent = t_('fits'); b.appendChild(f); }
    b.addEventListener('click', () => { S.pick = tb.id; closeSheets(); applySurface(); resize(); });
    li.appendChild(b); ul.appendChild(li);
  });
}
function drawLogo() {
  const v = S.venue; if (!v) return;
  try { $('venueMark').style.backgroundImage = 'url(' + logoCanvas(v, true).toDataURL('image/png') + ')'; } catch (e) { /* the small mark is optional */ }
  if (!renderer) return;
  if (logoTex) logoTex.dispose(); logoTex = new T.CanvasTexture(logoCanvas(v, false)); logoTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const tb = S.table, m = logoM.material; m.map = logoTex;
  if (tb) {                    // on a table the logo is printed on the surface and sits in the lamp's falloff like everything else
    const d = S.RR, k = clamp((.2 + .8 / Math.pow(1 + d * d / 9.5, 1.5)) * 2.4, .3, 1);
    m.blending = T.NormalBlending; m.color.set(v.logoImg ? '#ffffff' : tb.ink).multiplyScalar(k); m.opacity = v.logoImg ? .9 : .6;
  } else { m.blending = T.AdditiveBlending; m.color.set(v.logoImg ? '#ffffff' : (v.theme.holo || v.theme.accent)); m.opacity = v.logoImg ? .34 : .85; }
  m.needsUpdate = true;   // a full-colour logo is brighter than a tinted outline
}

/* ---------------- UI ---------------- */
function goTo(turn) {
  const N = S.items.length, was = S.idx; S.turn = turn; S.idx = mod(turn, N); S.thetaT = -dirSign() * turn * (TAU / N); S.px = 0;
  const it = S.items[S.idx]; if (it && it.um && S.idx !== was && !reduce) { it.um.uGlitch.value = 1; U.pulse.value = -.25; }
  showDish(true);
}
function trayOf(v) { if (!v.tray) v.tray = new Map(); return v.tray; }
function showDish(animate) {
  const it = S.items[S.idx]; if (!it) return; const d = it.d, v = S.venue, cr = v.courses.find((c) => c.id === d.c);
  $('dishCourse').textContent = cr ? tx(cr) : ''; $('dishIdx').textContent = String(S.idx + 1).padStart(2, '0') + ' / ' + String(S.items.length).padStart(2, '0');
  $('dishName').textContent = tx(d.n); $('dishDesc').textContent = tx(d.d) || (it.empty && !CLIENT ? t_('noPhoto') : ''); $('dishDesc').hidden = !$('dishDesc').textContent;
  $('dishPrice').textContent = d.p != null && d.p !== '' ? CUR + d.p : '';
  const ul = $('dishTags'); ul.textContent = ''; (d.t || []).forEach((k) => { const li = document.createElement('li'); li.textContent = TAGS[k] ? TAGS[k][S.lang] : k; ul.appendChild(li); });
  const q = trayOf(v).get(d) || 0; $('addBtn').textContent = t_('add') + (q ? ' · ' + q : '');
  $('photoRow').hidden = !(v.own && renderer);
  Array.prototype.forEach.call($('courses').children, (b) => { const on = b.dataset.id === d.c; b.setAttribute('aria-current', on ? 'true' : 'false'); if (on && animate && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });
  if (animate && !reduce && $('dishBody').animate) $('dishBody').animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
}
function buildCourses() {
  const nav = $('courses'); nav.textContent = '';
  S.venue.courses.forEach((c) => {
    if (!S.venue.dishes.some((d) => d.c === c.id)) return;
    const b = document.createElement('button'); b.className = 'course'; b.type = 'button'; b.dataset.id = c.id; b.textContent = tx(c);
    b.addEventListener('click', () => {
      setFocus(false);
      if (S.single) { const j = S.items.findIndex((it) => it.d.c === c.id); if (j >= 0) { const N = S.items.length; let dl = mod(j - S.idx, N); if (dl > N / 2) dl -= N; goTo(S.turn + dl); } }
      else { S.course = c.id; layRing(false); showDish(true); }
    });
    nav.appendChild(b);
  });
}
function applyLang() {
  root.lang = S.lang; root.dir = S.lang === 'he' ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i]').forEach((el) => { el.textContent = t_(el.dataset.i); });
  $('tableBtn').setAttribute('aria-label', t_('table')); $('tableBtn').title = t_('table'); $('tableLbl').textContent = t_('table');
  $('langBtn').textContent = t_('lang'); $('langBtn').setAttribute('aria-label', S.lang === 'he' ? 'Switch to English' : 'מעבר לעברית');
  $('prevBtn').setAttribute('aria-label', t_('prev')); $('nextBtn').setAttribute('aria-label', t_('next'));
  document.querySelectorAll('[data-close]').forEach((b) => b.setAttribute('aria-label', t_('close')));
  if (!renderer) $('hint').textContent = t_('noGl');
  setFocusLabel();
}
function setFocusLabel() { const l = S.focus ? t_('back') : t_('look'); $('lookBtn').setAttribute('aria-label', l); $('lookBtn').title = l; $('lookBtn').setAttribute('aria-pressed', S.focus ? 'true' : 'false'); if (renderer && !$('hint').hidden) $('hint').textContent = S.focus ? t_('hintLook') : t_('hint'); }
function setFocus(on) { S.focus = !!on && !!renderer; setFocusLabel(); }
function renderVenue() {
  const v = S.venue; $('venueName').textContent = tx(v.name); $('venueMeta').textContent = [tx(v.cuisine), tx(v.area)].filter(Boolean).join(' · ');
  buildCourses(); updateTray(); showDish(false);
}
function loadLogo(v) {            // a restaurant's own logo file, shown on the hub and in the header
  if (!v.logo || v.logoImg || v.logoAsked) return; v.logoAsked = true;
  const im = new Image(); im.onload = () => { v.logoImg = im; if (S.venue === v) drawLogo(); }; im.src = v.logo;
}
function setVenue(v) { S.venue = v; S.course = null; setFocus(false); loadLogo(v); applyTheme(v); layRing(false); applySurface(); resize(); renderVenue(); if (CLIENT) document.title = tx(v.name); }
function switchVenue(v) {
  closeSheets(); $('veil').classList.add('on');
  if (!v.own && MENUS.length > 1) { try { history.replaceState(null, '', '#' + v.id); } catch (e) { /* a link to this restaurant is optional */ } }
  setTimeout(() => { setVenue(v); requestAnimationFrame(() => requestAnimationFrame(() => $('veil').classList.remove('on'))); }, reduce ? 0 : 430);
}
function updateTray() {
  const tr = trayOf(S.venue), ul = $('trayList'); let n = 0, sum = 0; ul.textContent = '';
  tr.forEach((q, d) => {
    n += q; sum += q * (Number(d.p) || 0);
    const li = document.createElement('li'), nm = document.createElement('span'), st = document.createElement('span'), pr = document.createElement('span');
    nm.className = 'l-name'; nm.textContent = tx(d.n); st.className = 'step'; pr.className = 'l-price'; pr.dir = 'ltr'; pr.textContent = CUR + (q * (Number(d.p) || 0));
    const mk = (txt, dl) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.setAttribute('aria-label', txt + ' ' + tx(d.n)); b.addEventListener('click', () => { const nq = (tr.get(d) || 0) + dl; if (nq <= 0) tr.delete(d); else tr.set(d, nq); updateTray(); showDish(false); }); return b; };
    const qq = document.createElement('span'); qq.textContent = q; st.appendChild(mk('−', -1)); st.appendChild(qq); st.appendChild(mk('+', 1));
    li.appendChild(nm); li.appendChild(st); li.appendChild(pr); ul.appendChild(li);
  });
  $('trayCount').textContent = n; $('trayTotal').textContent = CUR + sum;
  $('trayEmpty').hidden = n > 0; $('trayTotalRow').hidden = n === 0; $('trayNote').hidden = n === 0; $('trayClear').hidden = n === 0;
}
function buildVenueList() {
  const ul = $('venueList'); ul.textContent = '';
  const row = (cls, mark, name, meta, fn, cur) => {
    const li = document.createElement('li'), b = document.createElement('button'), mk = document.createElement('span'), tw = document.createElement('span'), a = document.createElement('span'), c = document.createElement('span');
    b.type = 'button'; if (cls) b.className = cls; b.setAttribute('aria-current', cur ? 'true' : 'false'); mk.className = 'venue-mark'; mark(mk);
    a.className = 'v-name'; a.textContent = name; c.className = 'v-meta'; c.textContent = meta; tw.appendChild(a); tw.appendChild(c);
    b.appendChild(mk); b.appendChild(tw); b.addEventListener('click', fn); li.appendChild(b); ul.appendChild(li);
  };
  MENUS.forEach((v) => row('', (mk) => { try { mk.style.backgroundImage = 'url(' + logoCanvas(v, true).toDataURL('image/png') + ')'; } catch (e) { /* optional */ } }, tx(v.name), [tx(v.cuisine), tx(v.area)].filter(Boolean).join(' · '), () => switchVenue(v), v === S.venue));
  if (!CLIENT) row('own', (mk) => { mk.textContent = '+'; }, t_('own'), t_('ownSub'), () => openSheet('studioSheet'), false);
}
let lastFocus = null;
function openSheet(id) {
  ['venueSheet', 'traySheet', 'studioSheet', 'tableSheet'].forEach((s) => { $(s).hidden = s !== id; });
  $('backdrop').hidden = false; if (id === 'venueSheet') buildVenueList(); if (id === 'traySheet') updateTray(); if (id === 'tableSheet') buildTableList();
  lastFocus = document.activeElement; const x = $(id).querySelector('[data-close]'); if (x) x.focus();
}
function closeSheets() { ['venueSheet', 'traySheet', 'studioSheet', 'tableSheet'].forEach((s) => { $(s).hidden = true; }); $('backdrop').hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); lastFocus = null; }
function hideHint() { if (renderer) $('hint').hidden = true; }

/* studio: logo + pasted dishes (+ a photo per dish) -> a restaurant */
function accentFrom(img) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 48; const x = cv.getContext('2d'); x.drawImage(img, 0, 0, 48, 48);
  const d = x.getImageData(0, 0, 48, 48).data, bk = {};
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue; const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0;
    if (sat > .28 && mx > 40) { const k = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5), o = bk[k] || (bk[k] = { r: 0, g: 0, b: 0, n: 0, s: 0 }); o.r += r; o.g += g; o.b += b; o.n++; o.s += sat; }
  }
  let best = null, bs = 0; Object.keys(bk).forEach((k) => { if (bk[k].s > bs) { bs = bk[k].s; best = bk[k]; } });
  if (!best) return null; let r = best.r / best.n, g = best.g / best.n, b = best.b / best.n; const mx = Math.max(r, g, b), k = 235 / Math.max(mx, 1);   // holograms need a bright hue
  return rgbHex(r * k, g * k, b * k);
}
function parseDishes(txt) {
  const courses = [], dishes = []; let cur = null;
  txt.split(/\r?\n/).forEach((ln) => {
    ln = ln.trim(); if (!ln) return;
    if (ln[0] === '#') { const nm = ln.replace(/^#+\s*/, ''); cur = { id: 'c' + courses.length, en: nm, he: nm }; courses.push(cur); return; }
    if (!cur) { cur = { id: 'c0', en: 'Menu', he: 'תפריט' }; courses.push(cur); }
    const p = ln.split('|').map((s) => s.trim()), price = parseFloat((p[1] || '').replace(/[^\d.]/g, ''));
    dishes.push({ c: cur.id, n: { en: p[0], he: p[0] }, d: { en: p[2] || '', he: p[2] || '' }, p: isNaN(price) ? '' : price, t: [] });
  });
  return { courses: courses, dishes: dishes };
}
let ownLogo = null;
function buildOwn() {
  const parsed = parseDishes($('stDishes').value); if (!parsed.dishes.length) { $('stDishes').focus(); return null; }
  const nm = $('stName').value.trim() || t_('own');
  return { own: true, id: 'own', name: { en: nm, he: nm }, area: '', cuisine: '', logoImg: ownLogo, theme: { holo: (ownLogo && accentFrom(ownLogo)) || '#5fd0ff' }, courses: parsed.courses, dishes: parsed.dishes };
}

function bind() {
  const cv = $('gl'); let pd = null;
  cv.addEventListener('pointerdown', (e) => { try { cv.setPointerCapture(e.pointerId); } catch (er) { /* fine */ } pd = { x: e.clientX, y: e.clientY, theta: S.thetaT, moved: false, lastX: e.clientX, vx: 0 }; S.drag = true; });
  cv.addEventListener('pointermove', (e) => {
    if (!pd) { if (e.pointerType === 'mouse') S.px = clamp((e.clientX / app.clientWidth) * 2 - 1, -1, 1) * (S.wide ? 1 : .6); return; }
    const dx = e.clientX - pd.x; if (Math.abs(dx) > 6 || Math.abs(e.clientY - pd.y) > 6) { pd.moved = true; hideHint(); }
    if (S.focus) { const it = S.items[S.idx]; const lim = it.stand ? .95 : .45; it.user = clamp(it.user + (e.clientX - pd.lastX) * .008, -lim, lim); } else S.thetaT = pd.theta + dx * (S.wide ? 1.5 : 2.2) / app.clientWidth;
    pd.vx = e.clientX - pd.lastX; pd.lastX = e.clientX;
  });
  const up = (e) => {
    if (!pd) return; const p = pd; pd = null; S.drag = false;
    if (!p.moved) { pick(e); return; } if (S.focus) return;
    const step = TAU / S.items.length; let tg = Math.round(-(S.thetaT + p.vx * .012) / (step * dirSign()));
    if (tg === S.turn && Math.abs(S.thetaT - p.theta) > step * .12) tg = S.turn + (S.thetaT - p.theta > 0 ? -1 : 1) * dirSign();
    goTo(tg);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { if (pd) { pd = null; S.drag = false; goTo(S.turn); } });
  let wheelLock = 0;
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY, n = performance.now(); if (Math.abs(d) < 8 || n < wheelLock) return; wheelLock = n + 260; hideHint(); setFocus(false); goTo(S.turn + (d > 0 ? 1 : -1)); }, { passive: false });
  function pick(e) {
    if (!renderer) return; const r = cv.getBoundingClientRect(), m = new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), rc = new T.Raycaster(); rc.setFromCamera(m, camera);
    const hit = rc.intersectObjects(S.items.map((it) => it.pick), false)[0]; if (!hit) { if (S.focus) setFocus(false); return; }
    const j = hit.object.userData.index, N = S.items.length; hideHint();
    if (j === S.idx) setFocus(!S.focus); else { setFocus(false); let dl = mod(j - S.idx, N); if (dl > N / 2) dl -= N; goTo(S.turn + dl); }
  }
  $('prevBtn').addEventListener('click', () => { hideHint(); goTo(S.turn - 1); });
  $('nextBtn').addEventListener('click', () => { hideHint(); goTo(S.turn + 1); });
  $('lookBtn').addEventListener('click', () => setFocus(!S.focus));
  $('addBtn').addEventListener('click', () => { const d = S.items[S.idx].d, tr = trayOf(S.venue); tr.set(d, (tr.get(d) || 0) + 1); updateTray(); showDish(false); });
  $('venueBtn').addEventListener('click', () => { if (!(CLIENT && MENUS.length < 2)) openSheet('venueSheet'); });
  $('tableBtn').addEventListener('click', () => openSheet('tableSheet'));
  $('trayBtn').addEventListener('click', () => openSheet('traySheet'));
  $('trayClear').addEventListener('click', () => { trayOf(S.venue).clear(); updateTray(); showDish(false); });
  $('backdrop').addEventListener('click', closeSheets);
  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));
  $('langBtn').addEventListener('click', () => {
    S.lang = S.lang === 'he' ? 'en' : 'he'; try { localStorage.setItem('halom-menu-lang', S.lang); } catch (e) { /* optional */ }
    applyLang(); layRing(true); resize(); drawLogo(); renderVenue();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (!$('backdrop').hidden) closeSheets(); else setFocus(false); return; }
    if (!$('backdrop').hidden || /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '')) return;
    if (e.key === 'ArrowRight') { hideHint(); goTo(S.turn + dirSign()); } else if (e.key === 'ArrowLeft') { hideHint(); goTo(S.turn - dirSign()); }
  });
  window.addEventListener('resize', resize);
  window.addEventListener('hashchange', () => { const v = MENUS.find((m) => m.id === (location.hash || '').replace('#', '')); if (v && v !== S.venue) switchVenue(v); });
  $('stDishes').value = SAMPLE;
  $('stLogo').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (!f) { ownLogo = null; return; } const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => { ownLogo = im; }; im.src = rd.result; }; rd.readAsDataURL(f); });
  $('studioForm').addEventListener('submit', (e) => { e.preventDefault(); const v = buildOwn(); if (v) switchVenue(v); });
  $('photoInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader();
    rd.onload = () => { const im = new Image(); im.onload = () => { S.items[S.idx].d.photo = im; layRing(true); showDish(false); }; im.src = rd.result; }; rd.readAsDataURL(f); e.target.value = '';
  });
}
function start() {
  $('tableBtn').hidden = CLIENT && !CFG.tablePicker;      // a restaurant's own menu keeps the table it chose
  try { const q = new URLSearchParams(location.search).get('table'); if (q && TABLES.some((t) => t.id === q)) S.pick = q; } catch (e) { /* optional */ }
  if (CLIENT) { document.querySelector('.demo').hidden = true; $('venueNote').hidden = true; $('credit').hidden = false; if (MENUS.length < 2) { app.classList.add('solo'); $('venueBtn').removeAttribute('aria-haspopup'); } }
  const intro = $('intro'); let seen = false; try { seen = localStorage.getItem('halom-menu-intro') === '1'; } catch (e) { /* optional */ }
  if (CFG.intro && !seen) { intro.hidden = false; $('introGo').addEventListener('click', () => { intro.hidden = true; try { localStorage.setItem('halom-menu-intro', '1'); } catch (e) { /* optional */ } }); }
  initGL(); applyLang(); bind();
  let first = MENUS[0]; const h = (location.hash || '').replace('#', ''); if (h) first = MENUS.find((v) => v.id === h) || first;
  if (!first) first = buildOwn();
  setVenue(first);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawLogo);
  requestAnimationFrame(frame);
  requestAnimationFrame(() => requestAnimationFrame(() => $('veil').classList.remove('on')));
  window.__halomMenu = { S: S, tick: (n, dt) => { if (!renderer) return; for (let i = 0; i < n; i++) step(dt || 1 / 60); draw(); } };
}
start();
})();
