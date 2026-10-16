/* The walk: where things stand on a long table that runs away from the guest, and the camera that glides along it.
   Pure numbers (no three.js, no DOM), so the frame, the places and the camera are unit-tested in node.

   World: y is up, the table top is y = 0. A category is one table (a "lane") running along z; dish i stands at
     z = lane.z - walk · place[i].z   walk = +1: the next dish is further up the table (pull it towards you)
                                      walk = -1: the next dish comes from the near end (swipe it up, like a feed)
   place[i].z is how far along the table dish i was put down (see placesOf): on a set table that follows the size of the
   plates, rim to rim; on the bar every drink has the same room.
   The camera looks at the focus point from elevation E through a shifted lens: the dish in focus is seen from exactly E
   (the angle its photo was taken from, near enough) wherever on the screen it sits, a little above the middle. */
import { SIZE, RAD, clamp, tableDef, hash01, shapeOf } from './common.js';

export const PLATE = SIZE * 0.94;          // world width of a plate (the relief's image plane is SIZE across)
export const LANE = 5.4;                   // from the middle of one table to the middle of the next


const RIM = .5;                             // clear table between the rims of two plates that were set down one after the other
export const PRESETS = {
  /* food and desserts: seen like a guest who has just sat down. One straight row down the middle of the table, set rim to
     rim (S is the room two plates take); `wander` is how far a hand misses the line, never to one side and then the other.
     pool = how wide the lamp's light falls (small: it stays on the dish in focus); open = how much wider while the guest is
     moving along the table */
  table: { id: 'table', holo: false, kind: 'table', E: 45, D: 9.6, S: 2 * SIZE * .47 + RIM, rim: RIM, width: 1e4, stagger: 0, wander: .045, pool: 2.4, open: .85, liftE: 45, liftZoom: 1.07, liftY: .82, far: [1.9, 7],
    surface: (theme) => tableDef(theme, 'oak') },
  /* drinks, wine, beer: the bar counter, the eye lower, the back-bar glowing at the far end */
  bar: { id: 'bar', holo: false, kind: 'bar', standing: true, E: 31, D: 10.5, S: 3.7, width: 1e4, stagger: .3, pool: 7.5, liftE: 11, liftEStand: 24, liftZoom: 1.02, liftY: 0, far: [6, 14], wall: 12.5,
    surface: () => ({ id: 'bar-stone', kind: 'bar', size: 7.5, spec: .5, shin: 64, bump: 1.1, refl: .27, gloss: 1.0, tint: [1, .9, .76] }) },
  /* The rooms of the place (scenes/rooms.js): each has its own eye, light and pace, so the walk from one to the next is a change
     of place, not more of the same table. wall = where the room's counter ends and its backdrop begins, behind the focus ·
     yaw = the eye stands a little to one side (a row of taps, the cocktail bar are seen three-quarter on) · heroK, cyK = how
     large the thing in focus is drawn and where (a smaller dish leaves room for the case around it) · tiers: the vitrine's
     dishes stand on risers of three heights. look: what gl/rooms.js draws around it (props, backdrop, light). */
  vitrine: { id: 'vitrine', holo: false, kind: 'vitrine', E: 36, D: 9.4, S: 2 * SIZE * .47 + RIM + .2, rim: RIM + .2, width: 3.24, stagger: 0, wander: .03, pool: 4.2, open: .5, liftE: 40, liftZoom: 1.08, liftY: .62, far: [4, 10], wall: 7.6,
    heroK: .74, cyK: .58, tiers: [0, .17, .32], look: 'vitrine',
    surface: () => ({ id: 'marble', kind: 'vitrine', size: 9, spec: .5, shin: 90, bump: 0, refl: .16, gloss: .7, tint: [1, .97, .93], amb: [.34, .33, .32], plate: 'patisserie' }) },
  cellar: { id: 'cellar', holo: false, kind: 'cellar', standing: true, E: 29, D: 10.5, S: 3.5, width: 1e4, stagger: .26, pool: 6.5, liftE: 13, liftEStand: 24, liftZoom: 1.02, liftY: 0, far: [5, 12], wall: 9.2, look: 'cellar',
    surface: () => ({ id: 'walnut', kind: 'cellar', size: 5.6, spec: .3, shin: 40, bump: 2.5, refl: .14, gloss: .55, tint: [1, .78, .52], amb: [.07, .05, .035], plate: 'cellar' }) },
  taps: { id: 'taps', holo: false, kind: 'taps', standing: true, E: 22, D: 11, S: 2.6, width: 1e4, stagger: 0, pool: 6, liftE: 12, liftEStand: 20, liftZoom: 1.02, liftY: 0, far: [5, 12], wall: 9, yaw: -.44, look: 'taps',
    surface: () => ({ id: 'walnut', kind: 'taps', size: 5.6, spec: .55, shin: 70, bump: 1.4, refl: .22, gloss: .9, tint: [1, .86, .64], amb: [.06, .05, .04], plate: 'taps' }) },
  cocktail: { id: 'cocktail', holo: false, kind: 'cocktail', standing: true, E: 43, D: 10.5, S: 3.6, width: 1e4, stagger: .2, pool: 7, liftE: 30, liftEStand: 34, liftZoom: 1.02, liftY: 0, far: [5, 12], wall: 7.4, yaw: .36, look: 'cocktail',
    surface: () => ({ id: 'bar-stone', kind: 'cocktail', size: 7.5, spec: .55, shin: 70, bump: 1.1, refl: .3, gloss: 1.0, tint: [.86, .92, 1], amb: [.035, .038, .045], plate: 'cocktail' }) },
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
  const freeW = W - cardW, freeH = H - top - (wide ? 0 : cardH), standing = !!preset.standing, yaw = preset.yaw || 0;
  let ppu, cy;
  if (standing) {                                   // sized by what stands: a bottle and its glass
    const boxW = 2.0, boxH = 2.3 * Math.cos(preset.E * RAD) + .9 * Math.sin(preset.E * RAD);
    ppu = Math.min((wide ? freeW * .4 : W * .8) / boxW, (wide ? freeH * .56 : freeH * .56) / boxH);
    cy = top + freeH * (wide ? .8 : .8);            // the foot of the glass; the drink rises above it
  } else {
    const hero = (wide ? Math.min(freeW * .46, freeH * .56) : Math.min(W * .84, freeH * .74)) * (preset.heroK || 1);
    ppu = hero / PLATE; cy = top + freeH * (preset.cyK ? preset.cyK + (wide ? .04 : 0) : wide ? .56 : .47);
  }
  const cx = wide ? (rtl ? freeW / 2 : cardW + freeW / 2) : W / 2;
  const fov = 2 * Math.atan(H / 2 / (ppu * preset.D)) / RAD;
  /* lifted: the sheet covers the lower part of a phone (or stands at the side), the dish comes up into what is left */
  const sheetH = wide ? H - top - 16 : Math.round(clamp(H * .56, 320, H - 150));
  const liftCy = wide ? cy - freeH * .03 : liftCyFor(H, sheetH, standing);
  return { W, H, wide, top, cardW, cardH, sheetH, cx, cy, ppu, fov, D: preset.D, E: preset.E, S: preset.S, hero: ppu * PLATE, standing, yaw,
    pxPerDish: preset.S * ppu * Math.sin(preset.E * RAD) * Math.cos(yaw), liftCy, liftZoom: wide ? Math.max(preset.liftZoom, 1.1) : preset.liftZoom };
}

/* A lifted dish on a phone sits in the middle of what the sheet leaves free (a standing drink: near the sheet, it rises above it). */
export const liftCyFor = (H, sheet, standing) => (standing ? 64 + (H - sheet - 64) * .92 : 60 + (H - sheet - 60) * .5);

/* How much of the table a thing takes along the walk, from its middle to its rim: a plate is round, a print lies flat,
   a folded name card is only a hand deep. */
export const reachOf = (shape) => (shape.type === 'text' ? .52 : shape.type === 'photo' ? .98 : shape.r);

/* Where the things of one section were put down: [{ z, m, cx, dx, dz, spin }], one per item, the same every time.
     z        how far along the table the camera stops for it, from the first dish (0)        m   the pace there (see alongAt)
     cx       where the focus line passes, sideways                                           dx, dz, spin   how the thing itself lies
   A set table (preset.rim): ONE straight row down the middle. The room between two neighbours follows their own size, rim to
   rim, so a name card stands closer to its plate than two plates do to each other. What reads as a hand is small and has no
   pattern: a finger's width off the line, a few degrees askew. The focus line itself is straight, so nothing sways on the way.
   The bar and the projector stage: every drink has the same room and stands a little to one side, then the other, so the
   one behind is not hidden; there the focus line leans from one to the next. */
export function placesOf(preset, items, kind, rtl) {
  const S = preset.S, set = preset.rim != null, flip = rtl ? -1 : 1, out = [];
  let z = 0, reach = 0;
  for (let i = 0; i < items.length; i++) {
    const id = String(items[i].id), j = hash01(id, 1) - .5, k = hash01(id, 2) - .5, spin = (hash01(id, 4) - .5) * .16;
    if (set) {
      const r = reachOf(shapeOf(items[i], kind)); if (i) z += reach + preset.rim + r; reach = r;
      out.push({ z, m: S, cx: 0, dx: flip * j * 2 * preset.wander, dz: k * .08, spin, y: preset.tiers ? tierOf(preset.tiers, shapeOf(items[i], kind)) : 0 });
    } else {
      const side = (i % 2 ? 1 : -1) * flip, dx = side * preset.stagger * (.8 + .4 * hash01(id, 3)) + j * .1;
      out.push({ z: i * S, m: S, cx: dx, dx, dz: k * .16, spin, y: 0 });
    }
  }
  for (let i = 1; i < out.length - 1; i++) out[i].m = (out[i + 1].z - out[i - 1].z) / 2;      // the pace through a dish: the mean of the room before and after it
  return out;
}
/* The vitrine's risers: a tall dessert stands low, a flat one is raised to be seen, the rest in between (as a pâtissier sets a
   case). Read from the thing itself, so it is the same every time and needs no field in the menu. */
export const tierOf = (tiers, shape) => (shape.type !== 'relief' && shape.type !== 'stand' ? tiers[1] : shape.top > .45 ? tiers[0] : shape.top > .2 ? tiers[1] : tiers[2]);
/* how high the focus is at p (the vitrine's risers; 0 elsewhere): one smooth curve, so the eye rises and settles with the dishes */
export function heightAt(places, p) {
  const n = places.length; if (!n) return 0;
  const q = clamp(p, 0, n - 1), a = Math.floor(q), b = Math.min(n - 1, a + 1), t = q - a, s = t * t * (3 - 2 * t);
  return (places[a].y || 0) + ((places[b].y || 0) - (places[a].y || 0)) * s;
}
/* the sideways position of the focus line at p (between two drinks it leans from one to the other; on a set table it is straight) */
export function centreAt(places, p) {
  const n = places.length; if (!n) return 0;
  const q = clamp(p, 0, n - 1), a = Math.floor(q), b = Math.min(n - 1, a + 1), t = q - a, s = t * t * (3 - 2 * t);
  return places[a].cx + (places[b].cx - places[a].cx) * s;
}
/* How far along the table the focus line is at p (in dishes): through every place, one smooth curve in between (so the
   table does not change pace with a jolt where a small thing follows a large one), straight on past both ends at the pace
   of S a dish. alongAt and dishAt undo each other; where every dish has the same room, both are the plain p · S. */
export function alongAt(places, p, S) {
  const n = places.length; if (!n) return p * S;
  if (p <= 0) return places[0].z + p * S; if (p >= n - 1) return places[n - 1].z + (p - (n - 1)) * S;
  const a = Math.floor(p), t = p - a, A = places[a], B = places[a + 1], t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * A.z + (t3 - 2 * t2 + t) * A.m + (3 * t2 - 2 * t3) * B.z + (t3 - t2) * B.m;
}
export function dishAt(places, z, S) {
  const n = places.length; if (!n) return z / S;
  if (z <= places[0].z) return (z - places[0].z) / S; if (z >= places[n - 1].z) return n - 1 + (z - places[n - 1].z) / S;
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (places[mid].z <= z) lo = mid; else hi = mid; }
  let a = lo, b = lo + 1;                                                    // between two places the curve only rises: halve the step until it is found
  for (let k = 0; k < 26; k++) { const mid = (a + b) / 2; if (alongAt(places, mid, S) <= z) a = mid; else b = mid; }
  return (a + b) / 2;
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
