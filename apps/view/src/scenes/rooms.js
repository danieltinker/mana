/* The rooms of the place. Pure: no three.js, no DOM.
   The menu is a walk through a restaurant, not one long table: every kind of category has its own room, with its own light,
   camera and props (gl/rooms.js draws them; scenes/walk.js holds their cameras as presets of the same name).

     table     food: the long table under one lamp (as before)
     vitrine   desserts, pastries, sandwiches: a lit glass case, the dishes on tiers behind glass
     cellar    wine: a counter of dark oak between wine fridges and oak barrels, the cellar vault far behind
     taps      beer: a row of brass taps on a bar counter, seen from the side
     cocktail  drinks: a dark marble bar seen from above and to one side, backlit shelves behind

   A category's room follows its kind; the snapshot's optional `category.room` lets an owner choose another (an unknown value is
   ignored). The older `category.scene` still means what it meant: 'table' keeps a category on the table, 'bar' puts it in the
   drinks room its kind belongs to, 'holo' is the projector stage. Nothing else is read. */

export const ROOM_IDS = ['table', 'vitrine', 'cellar', 'taps', 'cocktail'];
export const ROOM_OF_KIND = { food: 'table', dessert: 'vitrine', wine: 'cellar', beer: 'taps', drinks: 'cocktail' };
const BAR_OF_KIND = { wine: 'cellar', beer: 'taps' };
const DRINK = { drinks: 1, wine: 1, beer: 1 };

/* → 'table' | 'vitrine' | 'cellar' | 'taps' | 'cocktail' | 'holo', or with opts.rooms === false (?rooms=off) the two rooms
   of before: 'table' | 'bar' | 'holo' */
export function roomFor(cat, theme, opts) {
  const c = cat || {}, kind = c.kind, scene = c.scene;
  if (theme && theme.surface === 'holo') return 'holo';
  if (scene === 'holo') return 'holo';
  if (opts && opts.rooms === false) return scene === 'table' || scene === 'bar' ? scene : DRINK[kind] ? 'bar' : 'table';
  if (ROOM_IDS.includes(c.room)) return c.room;
  if (scene === 'table') return 'table';
  if (scene === 'bar') return BAR_OF_KIND[kind] || 'cocktail';
  return ROOM_OF_KIND[kind] || 'table';
}

/* what stands in a room: drinks stand on a counter (bottles, glasses, taps); food lies on a table or a shelf */
export const isStandingRoom = (id) => id === 'bar' || id === 'cellar' || id === 'taps' || id === 'cocktail';
