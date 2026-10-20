/* What stands on the table, as numbers. Pure: no three.js, no DOM. Where things stand and where the camera is: scenes/walk.js.
   World: y is up, the table is the plane y = 0, the camera sits at +z looking towards -z. Units as in the original engine
   (a plate is about 2.1 across). */

import { drinkSpec } from '../drinks/spec.js';

export const SIZE = 2.3;                       // world width of a relief's square image plane
export const RAD = Math.PI / 180;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

/* Tables: what the dishes stand on. Every entry is a tiling texture pair in themes/ (<id>.jpg colour, <id>_h.jpg height)
   lit by one lamp. size = world units one tile covers · spec, shin = gloss · bump = how much the height map catches the light ·
   refl = mirror strength for standing things. Values carried over from the original engine. */
export const TABLES = {
  oak: { size: 5.6, spec: .14, shin: 20, bump: 3.5, refl: .05 }, walnut: { size: 5.6, spec: .2, shin: 26, bump: 3.5, refl: .09 },
  birch: { size: 5.6, spec: .1, shin: 16, bump: 3, refl: .04 }, gingham: { size: 4.2, spec: .015, shin: 6, bump: 16, refl: 0 },
  'gingham-blue': { size: 4.2, spec: .015, shin: 6, bump: 16, refl: 0 }, linen: { size: 4.4, spec: .02, shin: 8, bump: 14, refl: 0 },
  damask: { size: 4.2, spec: .05, shin: 10, bump: 9, refl: 0 }, 'linen-black': { size: 4.4, spec: .04, shin: 8, bump: 14, refl: 0 },
  marble: { size: 9, spec: .42, shin: 70, bump: 0, refl: .2 }, 'marble-black': { size: 9, spec: .55, shin: 80, bump: 0, refl: .3 },
  terrazzo: { size: 5, spec: .3, shin: 55, bump: 0, refl: .12 }, concrete: { size: 7, spec: .1, shin: 16, bump: 5, refl: .04 },
  slate: { size: 6, spec: .16, shin: 22, bump: 14, refl: .03 }, tiles: { size: 4.8, spec: .4, shin: 60, bump: 8, refl: .14 },
  bamboo: { size: 4.6, spec: .1, shin: 14, bump: 12, refl: 0 }, kraft: { size: 6, spec: .015, shin: 6, bump: 5, refl: 0 },
  steel: { size: 6, spec: .55, shin: 34, bump: 1.4, refl: .24 }, copper: { size: 5, spec: .7, shin: 46, bump: 2.6, refl: .16 }
};
export function tableDef(theme, fallback = 'oak') {
  const id = theme && theme.surface;
  if (id === 'custom' && theme.tableImg) return { id: 'custom', img: theme.tableImg, size: 5, spec: .06, shin: 12, bump: 0, refl: 0, mirror: true };
  const key = TABLES[id] ? id : fallback;
  return Object.assign({ id: key }, TABLES[key]);
}

/* What an item is on the table, and how much room it takes. An item is only a relief if it has an approved relief;
   a photo is a print lying on the table, and an item with no picture is a name card. Nothing is dressed up. */
export function shapeOf(item, kind) {
  const a = item.asset, drink = drinkSpec(item, kind);                 // wine and beer: a bottle and glass drawn in code (see drinks/spec.js)
  if (a && a.state === 'relief') {
    const holo = !!a.stock;                                             // a placeholder from the stock library: drawn as a projection, never as the dish
    if (a.o) {
      const s = a.s || .62, r = SIZE * s * .36, top = Math.min(2.3, a.h * SIZE * s * Math.sin(a.e * RAD));
      if (!drink) return { type: 'stand', r, top, s, holo };
      const w = 2 * r + .04 + 2 * drink.r;                             // the photographed bottle, and a glass we stand beside it
      return { type: 'stand', r: w / 2, top: Math.max(top, drink.top), s, drink, reliefX: -w / 2 + r, drinkX: w / 2 - drink.r, drinkZ: .14 };
    }
    return { type: 'relief', r: SIZE * .47, top: a.h * SIZE * Math.sin(a.e * RAD), s: 1, holo };
  }
  if (drink) return { type: 'drink', r: drink.r, top: drink.top, s: 1, drink, drinkX: 0, drinkZ: 0 };
  if (a && a.state === 'photo') return { type: 'photo', r: 1.0, top: .03, s: 1 };
  return { type: 'text', r: 1.0, top: .03, s: 1 };
}

export function hash01(str, salt) { let h = 2166136261 ^ salt; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
