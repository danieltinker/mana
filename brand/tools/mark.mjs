/* The Mana mark, version 2 (14 Oct 2026): Cloche. Daniel chose it on 14 Oct (Mana HQ t249), "for now; maybe Relief later".
   Two dish domes on one table line make the m; the second dome is lifted a little and its light gets out. The lift is the
   product's own move (the dish rises off the table), the light is yolk, Mana's one colour.

   Drawn by hand on a 64 × 64 field. Two cuts:
   - full  (stroke 3.4, handles, the lid tilted 5°): 40 px and up, print, icons, lockups
   - small (stroke 5.4, no handles, the lid lifted straight): 16–32 px (favicons, the owner app's top bar)
   Rules (from the round-two proofs): the arches are ink, never yolk, never filled; the light is the only yolk; in one
   colour the light takes the ink colour; nothing is drawn behind the mark.

   Every builder imports from here, so the mark lives in one place. Plain ESM, no dependencies. */

export const YOLK = '#F5B120';

/* the ink box of each cut on the 64 × 64 field (the soft glow is outside it on purpose and may be clipped) */
export const BOX = { full: { x0: 2.3, x1: 61.7, y0: 20.3, y1: 51.7 }, small: { x0: 0.3, x1: 63.7, y0: 19.3, y1: 53.4 } };   // measured in Chromium

const n = (v) => Math.round(v * 100) / 100;

/* The mark's shapes as SVG markup, no <svg> around them.
   ink: the arches and the table line; light: the escaping light (yolk; in one colour, the ink); glow: a soft halo under the
   lid (needs a unique id when several marks share a page). */
export function shapes({ ink = '#16120E', light = YOLK, small = false, glow = null } = {}) {
  if (small) {
    return `<ellipse cx="45.5" cy="44.6" rx="11.5" ry="3.6" fill="${light}"/>` +
      `<path d="M3 50.7H61" stroke="${ink}" stroke-width="5.4" stroke-linecap="round" fill="none"/>` +
      `<path d="M7 48C7 22 31 22 31 48" stroke="${ink}" stroke-width="5.4" stroke-linecap="round" fill="none"/>` +
      `<path d="M33 41.5C33 15.5 57 15.5 57 41.5" stroke="${ink}" stroke-width="5.4" stroke-linecap="round" fill="none"/>`;
  }
  const halo = glow ? `<radialGradient id="${glow}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${light}" stop-opacity=".55"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>` : '';
  return (halo ? `<defs>${halo}</defs><ellipse cx="46" cy="45.5" rx="17" ry="8" fill="url(#${glow})"/>` : '') +
    `<ellipse cx="45.8" cy="45.4" rx="10.6" ry="2.5" fill="${light}"/>` +
    `<path d="M4 50H60" stroke="${ink}" stroke-width="3.4" stroke-linecap="round" fill="none"/>` +
    `<path d="M8 48C8 24 31 24 31 48" stroke="${ink}" stroke-width="3.4" stroke-linecap="round" fill="none"/>` +
    `<rect x="16.9" y="25.7" width="5.2" height="2.8" rx="1.4" fill="${ink}"/>` +
    `<g transform="translate(0 -4.2) rotate(-5 34 48)"><path d="M34 48C34 24 57 24 57 48" stroke="${ink}" stroke-width="3.4" stroke-linecap="round" fill="none"/>` +
    `<rect x="42.9" y="25.7" width="5.2" height="2.8" rx="1.4" fill="${ink}"/></g>`;
}

/* A <g> placing the mark so that its ink box starts at (x, y) and is w wide (for lockups, print, posters). */
export function placed({ x = 0, y = 0, w = 59.4, ...o } = {}) {
  const b = o.small ? BOX.small : BOX.full, s = w / (b.x1 - b.x0);
  return `<g transform="translate(${n(x - b.x0 * s)} ${n(y - b.y0 * s)}) scale(${n(s)})">${shapes(o)}</g>`;
}
export const height = (w, small = false) => { const b = small ? BOX.small : BOX.full; return w * (b.y1 - b.y0) / (b.x1 - b.x0); };

/* The viewBox that crops a cut to its ink box plus pad units (what inline() and the apps' copies use). */
export function viewBox(small = false, pad = 1) {
  const b = small ? BOX.small : BOX.full;
  return `${n(b.x0 - pad)} ${n(b.y0 - pad)} ${n(b.x1 - b.x0 + 2 * pad)} ${n(b.y1 - b.y0 + 2 * pad)}`;
}

/* An inline <svg>, cropped to the ink box (for page chrome: the nav, the footer, the dialog). w = width in px or a CSS length. */
export function inline(ink = '#16120E', w = 40, { small = false, light = YOLK, label = '' } = {}) {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="mana-mark" viewBox="${viewBox(small)}" width="${w}" ${a11y} focusable="false">${shapes({ ink, light, small })}</svg>`;
}

/* The mark w wide, centred on a W × W field (icons, avatars, the favicon). */
export function centred(W, w, o = {}) {
  return placed({ x: (W - w) / 2, y: (W - height(w, o.small)) / 2, w, ...o });
}

/* The favicon: the small cut, 50 of 64 units wide, on a dark rounded plate (readable at 16 px). brand/assets/favicon.svg and
   every page's data-URI favicon are this file (tools/sync-mark.mjs writes the copies). */
export function favicon({ plate = '#0F0F0F', ink = '#FCF8F6', light = YOLK } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img"><title>mana</title>` +
    `<rect width="64" height="64" rx="14" fill="${plate}"/>` + centred(64, 50, { ink, light, small: true }) + '</svg>';
}

/* A whole 64 × 64 file (the assets folder, the round-two proofs). */
export function file({ ink = '#16120E', light = YOLK, small = false, title = 'mana', bg = null, rx = 0, glow = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img"><title>${title}</title>` +
    (bg ? `<rect width="64" height="64" rx="${rx}" fill="${bg}"/>` : '') + shapes({ ink, light, small, glow: !small && glow ? 'mana-glow' : null }) + '</svg>\n';
}
