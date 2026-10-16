/* The templates contract, as a check. A look is a small set of numbers and names the guest menu already knows how to use:
   one of the engine's 18 table surfaces, one accent, the lamp's pool, a dark or light card, one CSS-only detail. Nothing here
   fetches, nothing here draws. Node ≥ 18, no dependencies.

     import { validateLooks, SURFACES, DETAILS } from './validate.mjs';   validateLooks(json) → { ok, errors: [] }
     node templates/validate.mjs [templates.v1.json]                       exit 0 when the file is sound, 1 with the errors listed */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/* the 18 tables of apps/view/src/scenes/common.js (TABLES); 'custom' and 'holo' are not looks */
export const SURFACES = ['oak', 'walnut', 'birch', 'gingham', 'gingham-blue', 'linen', 'damask', 'linen-black', 'marble', 'marble-black', 'terrazzo', 'concrete', 'slate', 'tiles', 'bamboo', 'kraft', 'steel', 'copper'];
/* the CSS-only concept details the guest menu's app.css knows (class look-<detail> on the app root) */
export const DETAILS = ['tracks', 'tile-stripe', 'ticket', 'door-crack', 'rug-edge', 'leaf-vein'];
export const CATEGORIES = ['cafe', 'bistro', 'fine', 'israeli', 'asian', 'italian', 'bar', 'bakery', 'street'];
export const ID = /^[a-z0-9-]{1,40}$/, HEX = /^#[0-9a-f]{6}$/;
const RANGES = { pool: [0.5, 12], open: [0, 2], spec: [0, 1], shin: [1, 120], refl: [0, 0.5] };
const ALLOWED = ['id', 'category', 'subcategory', 'name', 'surface', 'accent', 'card', 'ink', 'light', 'finish', 'motion', 'detail', 'fonts'];

/* the card's own tint over the page's black (what the text is read against at its darkest); a light card over the same */
const CARD_BG = { dark: compose([15, 11, 8], .74, [11, 9, 7]), light: compose([252, 248, 246], .86, [11, 9, 7]) };
function compose(top, a, under) { return top.map((v, i) => v * a + under[i] * (1 - a)); }
export function luminance(rgb) { const f = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(rgb[0]) + .7152 * f(rgb[1]) + .0722 * f(rgb[2]); }
export function contrast(a, b) { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + .05) / (Math.min(la, lb) + .05); }
export const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, [lo, hi]) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;

export function validateLook(look, i = 0) {
  const errors = [], at = 'looks[' + i + ']' + (look && look.id ? ' (' + look.id + ')' : ''), bad = (m) => errors.push(at + ': ' + m);
  if (!isObj(look)) return [at + ': not an object'];
  Object.keys(look).forEach((k) => { if (!ALLOWED.includes(k)) bad('unknown field "' + k + '"'); });
  if (!ID.test(String(look.id))) bad('id must match ' + ID);
  if (!CATEGORIES.includes(look.category)) bad('category must be one of ' + CATEGORIES.join(', '));
  if (typeof look.subcategory !== 'string' || !look.subcategory.startsWith(look.category + '-')) bad('subcategory must be a string starting with "' + look.category + '-"');
  if (!isObj(look.name) || typeof look.name.he !== 'string' || !look.name.he.trim() || typeof look.name.en !== 'string' || !look.name.en.trim()) bad('name needs non-empty he and en');
  else if (!/[֐-׿]/.test(look.name.he)) bad('name.he must be written in Hebrew');
  if (!SURFACES.includes(look.surface)) bad('surface must be one of the 18 tables: ' + SURFACES.join(', '));
  if (!HEX.test(String(look.accent))) bad('accent must be #rrggbb (lower case)');
  if (look.card !== 'dark' && look.card !== 'light') bad('card must be "dark" or "light"');
  if (look.card === 'light') { if (!HEX.test(String(look.ink))) bad('a light card carries ink (#rrggbb)'); }
  else if (look.ink != null) bad('ink belongs to a light card only');
  if (!isObj(look.light) || !num(look.light.pool, RANGES.pool) || !num(look.light.open, RANGES.open)) bad('light needs pool in [' + RANGES.pool + '] and open in [' + RANGES.open + ']');
  else Object.keys(look.light).forEach((k) => { if (k !== 'pool' && k !== 'open') bad('light.' + k + ' is not part of the contract'); });
  if (look.finish != null) {
    if (!isObj(look.finish)) bad('finish must be an object');
    else { Object.keys(look.finish).forEach((k) => { if (!RANGES[k] || k === 'pool' || k === 'open') bad('finish.' + k + ' is not part of the contract (spec, shin, refl)'); else if (!num(look.finish[k], RANGES[k])) bad('finish.' + k + ' must be in [' + RANGES[k] + ']'); }); }
  }
  if (look.motion !== 'settle' && look.motion !== 'none') bad('motion must be "settle" or "none"');
  if (!DETAILS.includes(look.detail)) bad('detail must be one of ' + DETAILS.join(', '));
  if (look.fonts !== 'house') bad('fonts must be "house" (each look gets its own type in week 2)');
  /* what the guest reads on the card must be legible: the accent is the price on a dark card, the ink is every word on a light one */
  if (HEX.test(String(look.accent)) && look.card === 'dark') { const c = contrast(hexRgb(look.accent), CARD_BG.dark); if (c < 4.5) bad('accent ' + look.accent + ' reads at ' + c.toFixed(2) + ':1 on the dark card (needs 4.5:1)'); }
  /* the add button is the accent with text on it; the guest menu picks dark or cream text by the accent's luma (apps/view/src/main.js applyTheme) */
  if (HEX.test(String(look.accent))) { const c = hexRgb(look.accent), luma = (c[0] * .299 + c[1] * .587 + c[2] * .114) / 255, on = luma > .5 ? [22, 19, 10] : [251, 247, 239], r = contrast(on, c); if (r < 4.5) bad('the text on the accent ' + look.accent + ' reads at ' + r.toFixed(2) + ':1 (needs 4.5:1; move the accent away from mid luma)'); }
  if (look.card === 'light' && HEX.test(String(look.ink))) { const c = contrast(hexRgb(look.ink), CARD_BG.light); if (c < 4.5) bad('ink ' + look.ink + ' reads at ' + c.toFixed(2) + ':1 on the light card (needs 4.5:1)'); }
  return errors;
}

export function validateLooks(doc) {
  const errors = [];
  if (!isObj(doc)) return { ok: false, errors: ['not an object'] };
  if (doc.v !== 1) errors.push('v must be 1');
  Object.keys(doc).forEach((k) => { if (k !== 'v' && k !== 'looks') errors.push('unknown top-level field "' + k + '"'); });
  if (!Array.isArray(doc.looks) || !doc.looks.length) errors.push('looks must be a non-empty array');
  else {
    const seen = new Set();
    doc.looks.forEach((l, i) => { errors.push(...validateLook(l, i)); if (l && l.id) { if (seen.has(l.id)) errors.push('looks[' + i + ']: duplicate id ' + l.id); seen.add(l.id); } });
  }
  return { ok: !errors.length, errors };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), 'templates.v1.json');
  let doc; try { doc = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { console.error('✗ ' + file + ': ' + e.message); process.exit(1); }
  const r = validateLooks(doc);
  if (r.ok) { console.log('✓ ' + file + ': ' + doc.looks.length + ' look(s) sound'); process.exit(0); }
  r.errors.forEach((e) => console.error('✗ ' + e)); process.exit(1);
}
