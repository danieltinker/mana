/* Looks: what a menu wears (templates/templates.v1.json, bundled here by esbuild; never fetched). A look gives the table
   surface, the accent, the lamp's pool, a dark or light card and one CSS-only detail. It never touches a dish.
   Pure apart from applyLookDom (the few attributes and custom properties on the app root), so the precedence is unit-tested.

     lookOf(id)                         → the look, or null (an unknown id leaves the menu as it is today)
     applyLook(theme, presets)          → mutates theme (surface, accent) and presets.table (pool, open, surface finish); returns the look or null
     resetPresets(presets)              → today's numbers back (a live preview may change its look between messages)
     applyLookDom(root, app, look)      → data-look, data-card, the look-<detail> class, the light card's ink */
import LOOKS from '../../templates/templates.v1.json' with { type: 'json' };
import { tableDef } from './scenes/common.js';

export const ID = /^[a-z0-9-]{1,40}$/;
export const looks = () => LOOKS.looks;
export function lookOf(id) { if (!ID.test(String(id || ''))) return null; return LOOKS.looks.find((l) => l.id === id) || null; }

const BASE = { table: null };
function remember(presets) { if (!BASE.table) BASE.table = { pool: presets.table.pool, open: presets.table.open, surface: presets.table.surface }; }
export function resetPresets(presets) { if (!BASE.table) return; Object.assign(presets.table, BASE.table); }

/* The look gives surface, accent and lamp. An owner's own table photo (theme.surface === 'custom' with tableImg) still wins
   over the look's surface; the finish applies only to the look's own surface. */
export function applyLook(theme, presets) {
  remember(presets); resetPresets(presets);
  const look = lookOf(theme && theme.template); if (!look) return null;
  const own = theme.surface === 'custom' && !!theme.tableImg;
  if (!own) theme.surface = look.surface;
  theme.accent = look.accent;
  const T = presets.table, finish = look.finish || null;
  T.pool = look.light.pool; T.open = look.light.open;
  T.surface = (th) => { const d = tableDef(th, 'oak'); if (finish && d.id === look.surface) Object.assign(d, finish); return d; };
  return look;
}

/* a colour dark enough to read at 4.5:1 on the light card: the accent, pulled towards the ink until it does */
export function inkAccent(accent, ink) {
  const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const bg = [252 * .86 + 11 * .14, 248 * .86 + 9 * .14, 246 * .86 + 7 * .14], lb = lum(bg), a = rgb(accent), k = rgb(ink);
  for (let t = 0; t <= 1.001; t += .05) {
    const c = a.map((v, i) => Math.round(v + (k[i] - v) * t)), ratio = (lb + .05) / (lum(c) + .05);
    if (ratio >= 4.5) return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
  }
  return ink;
}

export function applyLookDom(root, app, look) {
  const st = root.style;
  app.className = app.className.replace(/\blook-[a-z0-9-]+/g, '').replace(/\s{2,}/g, ' ').trim();
  if (!look) { delete app.dataset.look; delete app.dataset.card; delete app.dataset.motion; st.removeProperty('--look-ink'); st.removeProperty('--look-ink-soft'); st.removeProperty('--look-ink-faint'); st.removeProperty('--look-price'); return; }
  app.dataset.look = look.id; app.dataset.card = look.card; app.dataset.motion = look.motion; app.classList.add('look-' + look.detail);
  if (look.card === 'light') { st.setProperty('--look-ink', look.ink); st.setProperty('--look-ink-soft', '#4a4541'); st.setProperty('--look-ink-faint', '#57514c'); st.setProperty('--look-price', inkAccent(look.accent, look.ink)); }
  else { st.removeProperty('--look-ink'); st.removeProperty('--look-ink-soft'); st.removeProperty('--look-ink-faint'); st.removeProperty('--look-price'); }
}

/* the track number of a dish on a listening café's menu: side A is the first section, track 1 its first dish */
export const trackOf = (catIndex, index) => String.fromCharCode(65 + Math.min(25, Math.max(0, catIndex | 0))) + (Math.max(0, index | 0) + 1);
