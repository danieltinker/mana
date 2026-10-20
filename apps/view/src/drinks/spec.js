/* Drinks, as numbers. Pure: no three.js, no DOM.
   What a wine or a beer looks like when the merchant gave no photo: a bottle (or can, or tap) and the right glass, built from
   profiles below and from the merchant's own words. Nothing here guesses taste; a missing colour means an empty glass.

   One scale for everything that stands on the bar: U world units per centimetre (a 30 cm wine bottle is 2.25 units, about the
   height of the tallest photographed glass, so both kinds of drink sit together). Profiles are [radius, height] in cm. */

export const U = 0.075;

/* ---------- vessels: outer profile, bottom centre → top centre ---------- */
export const VESSELS = {
  bordeaux: { h: 30, r: 3.75, mouth: 1.15, label: [6.2, 15.4, 66], back: [7.5, 13.5, 40], capsule: [25.2, 30.05], fill: 21.5,
    p: [[0, 0], [3.3, 0], [3.7, .35], [3.75, 1], [3.75, 18.4], [3.62, 19.8], [3.1, 21.2], [2.3, 22.3], [1.7, 23.2], [1.46, 24.2], [1.42, 28.5], [1.62, 28.75], [1.62, 29.5], [1.44, 29.75], [1.44, 30], [0, 30]] },
  burgundy: { h: 30, r: 4.1, mouth: 1.15, label: [4.4, 12.6, 62], back: [5.5, 11, 38], capsule: [25, 30.05], fill: 21.5,
    p: [[0, 0], [3.6, 0], [4.05, .35], [4.1, 1], [4.1, 13.2], [4.0, 15.2], [3.68, 17.3], [3.15, 19.3], [2.5, 21.2], [1.95, 22.9], [1.6, 24.4], [1.44, 26], [1.42, 28.5], [1.62, 28.75], [1.62, 29.5], [1.44, 29.75], [1.44, 30], [0, 30]] },
  sparkling: { h: 31.5, r: 4.4, mouth: 1.2, label: [4.6, 11.4, 58], back: [5.5, 10, 36], capsule: [20.8, 31.55], fill: 23,
    p: [[0, 0], [3.8, 0], [4.35, .4], [4.4, 1.1], [4.4, 12.4], [4.28, 14.6], [3.9, 17], [3.3, 19.4], [2.6, 21.6], [2.0, 23.6], [1.66, 25.6], [1.56, 28.2], [1.6, 29.3], [1.95, 29.7], [1.95, 30.9], [1.6, 31.3], [1.5, 31.5], [0, 31.5]] },
  longneck: { h: 23, r: 3.05, mouth: 1.0, label: [3.2, 9.8, 74], back: null, capsule: [22.1, 23.05], fill: 17.5,
    p: [[0, 0], [2.7, 0], [3.0, .3], [3.05, .9], [3.05, 11.2], [2.95, 12.6], [2.55, 14.2], [1.95, 15.8], [1.5, 17.2], [1.32, 18.8], [1.3, 22.0], [1.48, 22.15], [1.48, 22.9], [1.3, 23], [0, 23]] },
  can: { h: 11.5, r: 3.3, mouth: 0.9, label: [1.0, 10.2, 180], back: null, capsule: null, fill: 10.5,
    p: [[0, 0], [2.5, 0], [2.7, .25], [3.15, .7], [3.3, 1.0], [3.3, 10.2], [3.1, 10.75], [2.75, 11.2], [2.72, 11.5], [2.6, 11.5], [2.55, 11.3], [0, 11.3]] },
  /* a counter-mounted tap: column, faucet towards +x, handle above it. p = the column; faucet and handle are placed by the builder */
  tap: { h: 33, r: 3.2, mouth: 0.8, label: null, back: null, capsule: null, fill: 0, spout: [6.6, 18.6], handle: [22.2, 33],
    p: [[0, 0], [3.2, 0], [3.2, .5], [2.2, .9], [1.9, 1.6], [1.9, 20.6], [2.15, 21], [2.15, 22.6], [1.9, 23], [1.5, 23.6], [0, 23.9]] }
};

/* ---------- glasses: outer wall up, inner wall back down. fill = liquid surface, head = foam thickness (beer) ---------- */
export const GLASSES = {
  red: { h: 21, fill: 13.9, head: 0,
    outer: [[0, 0], [3.6, 0], [3.6, .22], [1.3, .55], [.5, 1.15], [.34, 2.6], [.34, 8.2], [.62, 9], [2.2, 9.85], [3.55, 11.1], [4.38, 12.7], [4.62, 14.3], [4.46, 16.6], [4.06, 19], [3.66, 21]],
    inner: [[0, 9.72], [2.1, 10.12], [3.44, 11.3], [4.26, 12.82], [4.5, 14.3], [4.34, 16.6], [3.94, 19], [3.56, 21]] },
  white: { h: 20, fill: 13.6, head: 0,
    outer: [[0, 0], [3.3, 0], [3.3, .22], [1.2, .52], [.48, 1.1], [.33, 2.5], [.33, 8.6], [.6, 9.3], [1.9, 10.1], [2.95, 11.3], [3.5, 12.8], [3.62, 14.2], [3.44, 16.4], [3.1, 18.4], [2.86, 20]],
    inner: [[0, 10.0], [1.8, 10.36], [2.84, 11.5], [3.38, 12.9], [3.5, 14.2], [3.32, 16.4], [2.98, 18.4], [2.76, 20]] },
  flute: { h: 23.5, fill: 20.2, head: 0,
    outer: [[0, 0], [3.2, 0], [3.2, .22], [1.1, .5], [.45, 1.05], [.32, 2.4], [.32, 9.2], [.55, 10], [1.3, 11.2], [2.0, 13], [2.5, 15.6], [2.6, 18], [2.48, 21], [2.3, 23.5]],
    inner: [[0, 10.5], [1.2, 11.4], [1.88, 13.1], [2.38, 15.6], [2.48, 18], [2.36, 21], [2.2, 23.5]] },
  pint: { h: 15.4, fill: 12.2, head: 2.0,
    outer: [[0, 0], [2.85, 0], [2.95, .3], [3.25, 4], [3.75, 10], [4.2, 15.4]],
    inner: [[0, 1.25], [2.72, 1.3], [3.1, 4], [3.6, 10], [4.06, 15.4]] },
  tulip: { h: 15.6, fill: 11.0, head: 2.6,
    outer: [[0, 0], [3.1, 0], [3.1, .25], [1.4, .6], [.95, 1.3], [.9, 2.6], [1.3, 3.5], [2.8, 4.5], [3.9, 6.2], [4.3, 8.2], [4.05, 10.6], [3.6, 12.6], [3.62, 14], [3.95, 15.6]],
    inner: [[0, 3.75], [2.6, 4.75], [3.74, 6.3], [4.16, 8.2], [3.92, 10.6], [3.48, 12.6], [3.5, 14], [3.82, 15.6]] }
};
export function radiusAt(profile, y) {             // inner radius of a glass at height y (cm), straight lines between profile points
  const p = profile; if (y <= p[0][1]) return p[0][0];
  for (let i = 1; i < p.length; i++) if (y <= p[i][1]) { const a = p[i - 1], b = p[i], k = (y - a[1]) / Math.max(1e-6, b[1] - a[1]); return a[0] + (b[0] - a[0]) * k; }
  return p[p.length - 1][0];
}

/* ---------- colour: only from the merchant's own colour field ---------- */
const WINE = {
  red: { deep: [.17, .008, .03], edge: [.60, .06, .11], glass: [.028, .075, .035], dark: 1, foil: [.24, .03, .05], ink: '#3a1218' },
  white: { deep: [.80, .68, .26], edge: [.97, .93, .64], glass: [.62, .74, .52], dark: 0, foil: [.74, .62, .30], ink: '#2c2a1c' },
  rose: { deep: [.88, .38, .33], edge: [.99, .72, .63], glass: [.86, .88, .84], dark: 0, foil: [.82, .54, .48], ink: '#4a2420' },
  orange: { deep: [.76, .38, .07], edge: [.97, .70, .30], glass: [.86, .88, .84], dark: 0, foil: [.56, .33, .12], ink: '#40260c' },
  sparkling: { deep: [.86, .74, .34], edge: [.99, .95, .70], glass: [.03, .085, .04], dark: 1, foil: [.80, .67, .33], ink: '#2c2a1c' }
};
const BEER = {
  pale: { deep: [.84, .54, .07], edge: [.99, .83, .30], foam: [.98, .96, .90], paper: '#f2ecdc', ink: '#2a2014', wrap: [.84, .85, .84] },
  amber: { deep: [.50, .19, .025], edge: [.88, .48, .11], foam: [.96, .91, .80], paper: '#efe2c6', ink: '#3a1c08', wrap: [.60, .28, .10] },
  dark: { deep: [.045, .02, .01], edge: [.26, .11, .04], foam: [.86, .74, .58], paper: '#17130f', ink: '#ead9b8', wrap: [.07, .068, .072] }
};
const NO_COLOUR = { glass: [.028, .075, .035], dark: 1, foil: [.05, .05, .05], ink: '#2a1e12' };
const txt = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (o[lang] || o.he || o.en || ''));

/* What stands on the bar for this item, or null when it is not a drink we draw ourselves.
   kind = the category kind. Only 'wine' and 'beer' items are drawn; everything else keeps its photo, print or name card. */
export function drinkSpec(item, kind) {
  if (!item || (kind !== 'wine' && kind !== 'beer')) return null;
  const a = item.asset, d = item.details || {};
  if (a && a.state === 'photo') return null;                                     // a print is a print
  if (a && a.stock) return null;                                                 // a placeholder picture stands alone: nothing is drawn beside it
  const relief = !!(a && a.state === 'relief');
  if (kind === 'wine') {
    const w = d.wine || {}, c = WINE[w.color] || null, look = c || NO_COLOUR;
    const vessel = w.bottle === 'bordeaux' || w.bottle === 'burgundy' || w.bottle === 'sparkling' ? w.bottle : w.color === 'sparkling' ? 'sparkling' : w.color === 'rose' || w.color === 'orange' ? 'burgundy' : 'bordeaux';
    const glass = w.color === 'red' ? 'red' : w.color === 'sparkling' ? 'flute' : 'white';
    if (relief) return a.glass === true ? companion(kind, glass, c, w.color === 'sparkling') : null;
    return finish({ kind, vessel, glass, liquid: c ? { deep: c.deep, edge: c.edge, foam: [1, .98, .94] } : null, sparkling: w.color === 'sparkling', beer: false,
      glassTint: look.glass, dark: look.dark, foil: look.foil, ink: look.ink, paper: '#f3eee2', wrap: null, source: 'bottle' });
  }
  const b = d.beer || {}, c = BEER[b.color] || null, serving = b.serving === 'bottle' || b.serving === 'can' || b.serving === 'tap' ? b.serving : null;
  if (relief) return a.glass === true || (a.glass !== false && (serving === 'bottle' || serving === 'can')) ? companion(kind, serving === 'can' ? 'pint' : 'tulip', c, false) : null;
  return finish({ kind, vessel: serving === 'bottle' ? 'longneck' : serving === 'can' ? 'can' : serving === 'tap' ? 'tap' : 'none', glass: serving === 'bottle' ? 'tulip' : 'pint',
    liquid: c ? { deep: c.deep, edge: c.edge, foam: c.foam } : null, sparkling: false, beer: true,
    glassTint: [.15, .062, .016], dark: 1, foil: [.72, .62, .34], ink: c ? c.ink : '#2a2014', paper: c ? c.paper : '#f2ecdc', wrap: c ? c.wrap : [.84, .85, .84],
    source: serving === 'tap' ? 'tap' : serving ? 'bottle' : 'above' });
}
/* a photographed bottle with a glass we add beside it; the wine or beer arrives from above the frame, the photo never tilts */
function companion(kind, glass, c, sparkling) {
  return finish({ kind, vessel: 'none', glass, liquid: c ? { deep: c.deep, edge: c.edge, foam: c.foam || [1, .98, .94] } : null, sparkling, beer: kind === 'beer', companion: true,
    glassTint: [.9, .9, .9], dark: 0, foil: null, ink: '#2a1e12', paper: '#f3eee2', wrap: null, source: 'above' });
}
function finish(s) {
  const V = s.vessel === 'none' ? null : VESSELS[s.vessel], G = GLASSES[s.glass], gr = Math.max.apply(null, G.outer.map((p) => p[0])) * U;
  s.pourable = !!s.liquid;
  s.turns = s.vessel === 'bordeaux' || s.vessel === 'burgundy' || s.vessel === 'sparkling' || s.vessel === 'longneck' || s.vessel === 'can';      // something with a label to read
  if (!V) { s.bottle = null; s.glassAt = [0, 0]; s.r = gr + .06; s.top = G.h * U; s.rest = { cx: 0, r: s.r, top: s.top }; s.pour = { cx: 0, r: s.r + .1, top: s.top + .9 }; return s; }
  const br = V.r * U;
  if (s.vessel === 'tap') {                                                      // the glass stands under the faucet
    s.bottle = [-(V.spout[0] * U) / 2, 0]; s.glassAt = [s.bottle[0] + V.spout[0] * U, 0];
    const lo = s.bottle[0] - br, hi = s.glassAt[0] + gr; s.r = (hi - lo) / 2 + .04; s.top = Math.max(V.h, G.h) * U;
    s.rest = { cx: (lo + hi) / 2, r: s.r, top: s.top }; s.pour = s.rest; return s;
  }
  const gap = .1, w = 2 * br + gap + 2 * gr;                                     // bottle on the left, glass on the right and a little nearer
  s.bottle = [-w / 2 + br, -.06]; s.glassAt = [w / 2 - gr, .2]; s.r = w / 2 + .03; s.top = Math.max(V.h, G.h) * U;
  s.rest = { cx: 0, r: s.r, top: s.top };
  const tip = tiltPose(s, 1), half = V.h * U / 2, left = tip.x - half - .2;      // room for the bottle to swing while it pours
  s.pour = { cx: (left + s.r) / 2, r: (s.r - left) / 2, top: Math.max(s.top, tip.y + br + .25) };
  return s;
}
export const TILT = { bordeaux: 1.83, burgundy: 1.83, sparkling: 1.8, longneck: 1.86, can: 1.78 };       // radians from upright when the stream runs
/* where a pouring bottle's middle is, for a tilt of k (0 upright on the bar … 1 pouring): { x, y, z, angle, mouth:[x,y,z] } in the item's own frame */
export function tiltPose(s, k) {
  const V = VESSELS[s.vessel], G = GLASSES[s.glass], half = V.h * U / 2, th = (TILT[s.vessel] || 1.8) * k;
  const mx = s.glassAt[0] - .1, my = G.h * U + .26, x1 = mx - half * Math.sin(TILT[s.vessel] || 1.8), y1 = my - half * Math.cos(TILT[s.vessel] || 1.8);
  const e = k * k * (3 - 2 * k), x = s.bottle[0] + (x1 - s.bottle[0]) * e, y = half + (y1 - half) * e, z = s.bottle[1] + (s.glassAt[1] - s.bottle[1]) * e;
  return { x, y, z, angle: th, mouth: [x + half * Math.sin(th), y + half * Math.cos(th), z] };
}

/* ---------- the words on the label: only what the merchant typed ---------- */
export function labelText(item, kind, lang) {
  const d = item.details || {};
  if (kind === 'wine') {
    const w = d.wine || {}, name = txt(w.name, lang) || txt(item.name, lang);
    return { top: txt(w.producer, lang), title: name, mid: txt(w.grape, lang), foot: [txt(w.region, lang), txt(w.vintage, lang)].filter(Boolean).join(' · '),
      back: [txt(w.grape, lang), txt(w.region, lang), txt(w.serving, lang)].filter(Boolean) };
  }
  const b = d.beer || {};
  return { top: txt(b.brewery, lang), title: txt(item.name, lang), mid: txt(b.style, lang), foot: txt(b.abv, lang), back: [] };
}
export const isRtlText = (s) => /[֐-׿]/.test(String(s || ''));
