/* The walk: where things stand on a long table that runs away from the guest, and the camera that glides along it.
   Pure numbers (no three.js, no DOM), so the frame, the places and the camera are unit-tested in node.

   World: y is up, the table top is y = 0. A category is one table (a "lane") running along z; dish i stands at
     z = lane.z - walk · i · S        walk = +1: the next dish is further up the table (pull it towards you)
                                      walk = -1: the next dish comes from the near end (swipe it up, like a feed)
   The camera looks at the focus point from elevation E through a shifted lens: the dish in focus is seen from exactly E
   (the angle its photo was taken from, near enough) wherever on the screen it sits, a little above the middle. */
import { SIZE, RAD, clamp, tableDef, hash01 } from './common.js';

export const PLATE = SIZE * 0.94;          // world width of a plate (the relief's image plane is SIZE across)
export const LANE = 5.4;                   // from the middle of one table to the middle of the next


export const PRESETS = {
  /* food and desserts: seen like a guest who has just sat down */
  table: { id: 'table', holo: false, kind: 'table', E: 45, D: 9.6, S: 2.5, width: 1e4, stagger: .2, pool: 6.2, liftE: 45, liftZoom: 1.07, liftY: .82, far: [2.4, 9],
    surface: (theme) => tableDef(theme, 'oak') },
  /* drinks, wine, beer: the bar counter, the eye lower, the back-bar glowing at the far end */
  bar: { id: 'bar', holo: false, kind: 'bar', E: 31, D: 10.5, S: 3.7, width: 1e4, stagger: .3, pool: 7.5, liftE: 11, liftEStand: 24, liftZoom: 1.02, liftY: 0, far: [6, 14], wall: 12.5,
    surface: () => ({ id: 'bar-stone', kind: 'bar', size: 7.5, spec: .5, shin: 64, bump: 1.1, refl: .27, gloss: 1.0, tint: [1, .9, .76] }) },
  /* theme.surface = 'holo': everything is a projection over a dark floor */
  holo: { id: 'holo', holo: true, kind: 'holo', E: 42, D: 10, S: 3.0, width: 60, stagger: .22, pool: 9, liftE: 40, liftZoom: 1.05, liftY: .3, far: [7, 16],
    surface: () => ({ id: 'holo' }) }
};
export const presetById = (id) => PRESETS[id] || PRESETS.table;

/* How the screen is shared: the slim bar and the chips on top, one card at the bottom (phones, portrait) or at the side (wide).
   Returns pixels. cx, cy = where the dish in focus sits · ppu = pixels per world unit at the focus · hero = its width in pixels. */
export function frameOf(preset, W, H, rtl, kind) {
  const wide = W >= 700 && W / H >= 1.15, top = H < 520 ? 88 : 100;
  const cardW = wide ? Math.round(clamp(W * .3, 300, 400)) : 0, cardH = wide ? Math.round(clamp(H * .3, 180, 250)) : Math.round(clamp(H * .2, 148, 190));
  const freeW = W - cardW, freeH = H - top - (wide ? 0 : cardH), standing = preset.kind === 'bar';
  let ppu, cy;
  if (standing) {                                   // sized by what stands: a bottle and its glass
    const boxW = 2.0, boxH = 2.3 * Math.cos(preset.E * RAD) + .9 * Math.sin(preset.E * RAD);
    ppu = Math.min((wide ? freeW * .4 : W * .8) / boxW, (wide ? freeH * .56 : freeH * .56) / boxH);
    cy = top + freeH * (wide ? .8 : .8);            // the foot of the glass; the drink rises above it
  } else {
    const hero = wide ? Math.min(freeW * .46, freeH * .56) : Math.min(W * .84, freeH * .74);
    ppu = hero / PLATE; cy = top + freeH * (wide ? .56 : .47);
  }
  const cx = wide ? (rtl ? freeW / 2 : cardW + freeW / 2) : W / 2;
  const fov = 2 * Math.atan(H / 2 / (ppu * preset.D)) / RAD;
  /* lifted: the sheet covers the lower part of a phone (or stands at the side), the dish comes up into what is left */
  const sheetH = wide ? H - top - 16 : Math.round(clamp(H * .56, 320, H - 150));
  const liftCy = wide ? cy - freeH * .03 : liftCyFor(H, sheetH, standing);
  return { W, H, wide, top, cardW, cardH, sheetH, cx, cy, ppu, fov, D: preset.D, E: preset.E, S: preset.S, hero: ppu * PLATE, standing,
    pxPerDish: preset.S * ppu * Math.sin(preset.E * RAD), liftCy, liftZoom: wide ? Math.max(preset.liftZoom, 1.1) : preset.liftZoom };
}

/* A lifted dish on a phone sits in the middle of what the sheet leaves free (a standing drink: near the sheet, it rises above it). */
export const liftCyFor = (H, sheet, standing) => (standing ? 64 + (H - sheet - 64) * .92 : 60 + (H - sheet - 60) * .5);

/* Where dish i stands, relative to the middle line of its table: a little left, a little right, never quite straight. */
export function placeOf(preset, i, id, rtl) {
  const side = (i % 2 ? 1 : -1) * (rtl ? -1 : 1), j = hash01(String(id), 1) - .5, k = hash01(String(id), 2) - .5;
  return { dx: side * preset.stagger * (.8 + .4 * hash01(String(id), 3)) + j * .1, dz: k * .16, spin: (hash01(String(id), 4) - .5) * .16 };
}
/* the sideways position of the focus line at p (between two dishes it leans from one to the other) */
export function centreAt(places, p) {
  const n = places.length; if (!n) return 0;
  const q = clamp(p, 0, n - 1), a = Math.floor(q), b = Math.min(n - 1, a + 1), t = q - a, s = t * t * (3 - 2 * t);
  return places[a].dx + (places[b].dx - places[a].dx) * s;
}

/* The camera, as { pos, look, fov, offset:[x, y] } for a W×H frame: at `zoom` times closer than the preset's distance, looking at
   `look` from elevation E (degrees), turned `yaw` radians round it; the look point lands at (cx, cy) on screen. */
export function cameraFor(frame, look, E, zoom, yaw, cx, cy) {
  const e = E * RAD, d = frame.D / zoom, ce = Math.cos(e);
  return { pos: [look[0] + Math.sin(yaw) * ce * d, look[1] + Math.sin(e) * d, look[2] + Math.cos(yaw) * ce * d], look, fov: frame.fov, offset: [frame.W / 2 - cx, frame.H / 2 - cy] };
}
/* project a world point with such a camera → screen pixels (x right, y down) and the elevation it is seen from */
export function projectPx(cam, frame, p) {
  const f = [cam.look[0] - cam.pos[0], cam.look[1] - cam.pos[1], cam.look[2] - cam.pos[2]], fl = Math.hypot(f[0], f[1], f[2]); f[0] /= fl; f[1] /= fl; f[2] /= fl;
  let r = [-f[2], 0, f[0]]; const rl = Math.hypot(r[0], r[2]) || 1; r = [r[0] / rl, 0, r[2] / rl];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const v = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]], w = v[0] * f[0] + v[1] * f[1] + v[2] * f[2], th = Math.tan(cam.fov * RAD / 2), k = frame.H / 2 / (w * th);
  return { x: frame.W / 2 - cam.offset[0] + (v[0] * r[0] + v[1] * r[1] + v[2] * r[2]) * k, y: frame.H / 2 - cam.offset[1] - (v[0] * u[0] + v[1] * u[1] + v[2] * u[2]) * k, w,
    el: Math.atan2(cam.pos[1] - p[1], Math.hypot(cam.pos[0] - p[0], cam.pos[2] - p[2])) / RAD };
}
