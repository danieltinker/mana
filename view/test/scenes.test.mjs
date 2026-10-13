/* The walk: how the screen is shared, where the dishes stand on the long table, and what the gliding camera shows. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, presetById, frameOf, placesOf, reachOf, centreAt, alongAt, dishAt, cameraFor, projectPx, PLATE, LANE } from '../src/scenes/walk.js';
import { shapeOf, RAD, SIZE } from '../src/scenes/common.js';

const relief = (id, extra) => ({ id, asset: Object.assign({ state: 'relief', e: 48, h: .2, o: null, s: null }, extra || {}) });
const stand = (id) => ({ id, asset: { state: 'relief', e: 45, h: 1.8, o: [0, -.4], s: .62 } });
const photo = (id) => ({ id, asset: { state: 'photo' } }), bare = (id) => ({ id, asset: null });
const PHONES = [[390, 844], [360, 640], [414, 896], [768, 1024]], WIDE = [[1280, 800], [1440, 900], [844, 390], [1024, 768]];
/* the camera at dish p of a table whose dishes stand at `places` */
function camAt(P, F, places, p, walk = 1) { const look = [centreAt(places, p), 0, -walk * alongAt(places, p, P.S)]; return cameraFor(F, look, P.E, 1, 0, F.cx, F.cy); }
const dish = (P, places, i, walk = 1) => [places[i].dx, 0, -walk * places[i].z + places[i].dz];
/* n places exactly on the line, every one with the room of a plate */
const row = (P, n) => Array.from({ length: n }, (_, i) => ({ z: i * P.S, m: P.S, cx: 0, dx: 0, dz: 0, spin: 0 }));

test('what stands on the table is never dressed up; a placeholder is marked as a projection', () => {
  assert.equal(shapeOf(relief('a')).type, 'relief'); assert.equal(shapeOf(stand('a')).type, 'stand');
  assert.equal(shapeOf(photo('a')).type, 'photo'); assert.equal(shapeOf(bare('a')).type, 'text');
  assert.equal(shapeOf(relief('a')).holo, false); assert.equal(shapeOf(relief('a', { stock: 'pizza' })).holo, true); assert.equal(shapeOf(Object.assign(stand('a'), { asset: Object.assign(stand('a').asset, { stock: 'orange-juice' }) })).holo, true);
  assert.equal(shapeOf(Object.assign(relief('w', { stock: 'white-wine' }), { details: { wine: { color: 'white' } } }), 'wine').drink, undefined, 'no glass is drawn beside a placeholder');
  assert.equal(shapeOf({ id: 'u', asset: { state: 'stock', id: 'pizza' } }).type, 'text', 'a placeholder the library has not resolved is no picture');
  assert.equal(presetById('nope').id, 'table'); assert.ok(Math.abs(PLATE - SIZE * .94) < 1e-9);
});

test('phones: the dish in focus is about 80–88% of the width, a little above the middle, clear of the bar and the card', () => {
  for (const [W, H] of PHONES) {
    const F = frameOf(PRESETS.table, W, H, false), where = `${W}x${H}`;
    assert.equal(F.wide, false); assert.equal(F.cardW, 0); assert.equal(F.cx, W / 2);
    if (W < 500) assert.ok(F.hero / W >= .8 && F.hero / W <= .88, where + ': plate is ' + (F.hero / W * 100).toFixed(0) + '% of the width');
    assert.ok(F.cy < H / 2 && F.cy > H * .36, where + ': focus at ' + (F.cy / H).toFixed(2) + ' of the height');
    const top = F.cy - F.hero * .5 * Math.sin(F.E * RAD) - 8, bottom = F.cy + F.hero * .5 * Math.sin(F.E * RAD);
    assert.ok(top > F.top - 40 && bottom < H - F.cardH + 6, where + ': the plate sits between the chips and the card');
    assert.ok(F.fov > 14 && F.fov < 42, where + ': a long lens, ' + F.fov.toFixed(1) + '°'); assert.ok(F.sheetH >= 320 && F.sheetH <= H - 150 && F.liftCy < F.cy, where + ': lifted, the dish comes up above the sheet');
  }
});

test('wide screens: the card stands at the side (the other side in Hebrew) and the dishes take the rest', () => {
  for (const [W, H] of WIDE) {
    const F = frameOf(PRESETS.table, W, H, false), R = frameOf(PRESETS.table, W, H, true), where = `${W}x${H}`;
    assert.equal(F.wide, true); assert.ok(F.cardW >= 300 && F.cardW <= 400); assert.ok(F.cx > F.cardW + F.hero / 2 - 1 && F.cx + F.hero / 2 < W, where + ': the dish is beside the card, on screen');
    assert.ok(Math.abs((W - R.cx) - (F.cx)) < 1e-6 || Math.abs(R.cx - (W - F.cardW) / 2) < 1e-6, where + ': mirrored'); assert.ok(R.cx + R.hero / 2 < W - R.cardW + 1);
    assert.ok(F.hero >= 120 && F.hero <= W * .5, where + ': plate ' + F.hero.toFixed(0) + ' px');
  }
});

test('the table runs away from the guest: the next dish is further up and smaller, the previous one peeks in behind the card', () => {
  const P = PRESETS.table;
  for (const [W, H] of PHONES.concat(WIDE)) {
    const F = frameOf(P, W, H, false), places = placesOf(P, Array.from({ length: 6 }, (_, i) => relief('dish-' + i)), 'food', false), where = `${W}x${H}`;
    const cam = camAt(P, F, places, 2), at = (i) => projectPx(cam, F, dish(P, places, i)), w = (i) => { const d = dish(P, places, i); return projectPx(cam, F, [d[0] + PLATE / 2, 0, d[2]]).x - projectPx(cam, F, [d[0] - PLATE / 2, 0, d[2]]).x; };
    const hero = at(2), next = at(3), prev = at(1), look = projectPx(cam, F, cam.look);
    assert.ok(Math.abs(look.x - F.cx) < .01 && Math.abs(look.y - F.cy) < .01, where + ': the focus line is where the frame says');
    assert.ok(Math.abs(w(2) - F.hero) / F.hero < .03, where + ': the plate in focus is as wide as the frame says');
    assert.ok(Math.abs(hero.el - P.E) < 1.5, where + ': it is seen from ' + hero.el.toFixed(1) + '°, the angle of its photo');
    assert.ok(next.y < hero.y - F.hero * .4 && w(3) < w(2) * .95, where + ': the next dish is up the table and smaller'); assert.ok(prev.y > hero.y + F.hero * .5 && w(1) > w(2) * 1.05, where + ': the previous one is nearer and larger');
    const nextNear = projectPx(cam, F, [dish(P, places, 3)[0], 0, dish(P, places, 3)[2] + PLATE / 2]).y; assert.ok(nextNear > F.top - 10, where + ': the next dish shows below the chips (its near rim at ' + nextNear.toFixed(0) + ')');
    const prevFar = projectPx(cam, F, [dish(P, places, 1)[0], 0, dish(P, places, 1)[2] - PLATE / 2]).y; if (!F.wide) assert.ok(prevFar < H - F.cardH + 30 && prev.y > H - F.cardH - 60, where + ': the previous dish peeks in at the card (far rim ' + prevFar.toFixed(0) + ', card top ' + (H - F.cardH) + ')');
    assert.ok(next.el > 30 && next.el < hero.el && prev.el < 66 && prev.el > hero.el, where + ': neighbours stay believable (' + next.el.toFixed(0) + '° and ' + prev.el.toFixed(0) + '°)');
    assert.ok(at(4).y < next.y && w(4) < w(3), 'and so on into the distance');
  }
});

test('gliding: a finger travelling pxPerDish moves the camera one dish, and near things move faster than far things', () => {
  for (const P of [PRESETS.table, PRESETS.bar]) for (const [W, H] of [[390, 844], [1280, 800]]) {
    const F = frameOf(P, W, H, false), places = row(P, 6), eps = .01;
    const a = projectPx(camAt(P, F, places, 2), F, [0, 0, -2 * P.S]), b = projectPx(camAt(P, F, places, 2 + eps), F, [0, 0, -2 * P.S]);
    assert.ok(Math.abs((b.y - a.y) / eps - F.pxPerDish) / F.pxPerDish < .01, `${P.id} ${W}x${H}: the point under the finger keeps up with it (${((b.y - a.y) / eps).toFixed(1)} vs ${F.pxPerDish.toFixed(1)} px a dish)`);
    const far = (p) => projectPx(camAt(P, F, places, p), F, [0, 0, -3 * P.S]).y, near = (p) => projectPx(camAt(P, F, places, p), F, [0, 0, -1 * P.S]).y;
    assert.ok((near(2 + eps) - near(2)) > (b.y - a.y) && (b.y - a.y) > (far(2 + eps) - far(2)) && far(2 + eps) > far(2), P.id + ': parallax');
  }
  const P = PRESETS.table, F = frameOf(P, 390, 844, false), places = row(P, 2);
  const feed = projectPx(camAt(P, F, places, .01, -1), F, [0, 0, 0]).y - projectPx(camAt(P, F, places, 0, -1), F, [0, 0, 0]).y; assert.ok(feed < 0, 'walk = -1: going on, the dish in focus moves UP the screen, with a finger that swipes up');
});

test('a set table: one straight row down the middle, rim to rim; what reads as a hand is small and has no pattern; the same every time', () => {
  const P = PRESETS.table, ids = ['labaneh', 'hummus', 'chopped-salad', 'artichoke', 'filo', 'caesar', 'croquettes', 'fish-soup'], items = ids.map((id) => relief(id)).concat([bare('bread'), photo('lasagne'), relief('last')]);
  const pl = placesOf(P, items, 'food', false), rtl = placesOf(P, items, 'food', true), near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
  assert.deepEqual(pl, placesOf(P, items, 'food', false), 'the same every time');
  pl.forEach((p, i) => { assert.equal(p.cx, 0, 'the focus line is the middle of the table: nothing sways on the way'); assert.ok(Math.abs(p.dx) <= P.wander + 1e-9 && Math.abs(p.dz) <= .04 + 1e-9 && Math.abs(p.spin) <= .08 + 1e-9, 'a finger\'s width off the line at most'); assert.ok(near(rtl[i].dx, -p.dx) && rtl[i].z === p.z, 'mirrored in Hebrew'); });
  const sides = pl.slice(0, 8).map((p) => Math.sign(p.dx)); assert.ok(sides.some((sd, i) => i && sd === sides[i - 1]), 'never one side and then the other, all the way down: ' + sides);
  assert.ok(new Set(pl.map((p) => p.spin.toFixed(4))).size > 6, 'no two dishes lie exactly alike');
  /* the room between two neighbours follows their size: the same clear table between any two rims */
  for (let i = 0; i < items.length - 1; i++) { const gap = pl[i + 1].z - pl[i].z - reachOf(shapeOf(items[i])) - reachOf(shapeOf(items[i + 1])); assert.ok(near(gap, P.rim, 1e-9), 'rim to rim: ' + gap); assert.ok(Math.hypot(pl[i + 1].dx - pl[i].dx, pl[i + 1].z + pl[i + 1].dz - pl[i].z - pl[i].dz) > reachOf(shapeOf(items[i])) + reachOf(shapeOf(items[i + 1])) + .3, 'neighbours do not touch'); }
  for (let i = 0; i < 7; i++) assert.ok(near(pl[i + 1].z - pl[i].z, P.S), 'two plates take S: ' + (pl[i + 1].z - pl[i].z)); assert.ok(near(P.S, 2 * reachOf(shapeOf(relief('a'))) + P.rim));
  assert.ok(pl[8].z - pl[7].z < P.S - .4 && pl[9].z - pl[8].z < P.S - .4, 'a name card stands closer to its neighbours than a plate does'); assert.ok(pl[10].z - pl[9].z < P.S && pl[10].z - pl[9].z > pl[9].z - pl[8].z, 'a print takes nearly the room of a plate');
  /* along the table and back: through every place, never backwards, no jolt where a small thing follows a large one, straight on past the ends */
  for (let i = 0; i < pl.length; i++) { assert.ok(near(alongAt(pl, i, P.S), pl[i].z, 1e-9)); assert.ok(near(dishAt(pl, pl[i].z, P.S), i, 1e-6)); }
  for (let p = 0; p <= 6; p += .13) assert.ok(near(alongAt(pl, p, P.S), p * P.S, 1e-9), 'where every dish has the same room, p dishes are p · S');
  let last = -Infinity; for (let p = -1.5; p <= pl.length + .5; p += .01) { const z = alongAt(pl, p, P.S); assert.ok(z > last, 'it only goes on: ' + p); last = z; assert.ok(near(dishAt(pl, z, P.S), p, 1e-5), 'and back: ' + p + ' → ' + dishAt(pl, z, P.S)); }
  const pace = (p) => (alongAt(pl, p + 1e-4, P.S) - alongAt(pl, p - 1e-4, P.S)) / 2e-4;
  for (let i = 0; i < pl.length; i++) assert.ok(Math.abs(pace(i - .002) - pace(i + .002)) < .02 && pace(i) > 1.4 && pace(i) < 3, 'the pace through dish ' + i + ' has no step: ' + pace(i - .002).toFixed(3) + ' / ' + pace(i + .002).toFixed(3));
  assert.ok(near(alongAt(pl, -1, P.S), -P.S) && near(alongAt(pl, pl.length, P.S), pl[pl.length - 1].z + P.S) && near(pace(-.5), P.S, 1e-6) && near(pace(pl.length - .5 + 1), P.S, 1e-6));
  assert.equal(centreAt(pl, 2.5), 0); assert.equal(centreAt([], 1), 0); assert.equal(alongAt([], 2, P.S), 2 * P.S); assert.equal(dishAt([], 2 * P.S, P.S), 2);
  assert.equal(placesOf(P, [relief('solo')], 'food', false).length, 1); assert.equal(alongAt(placesOf(P, [relief('solo')], 'food', false), .5, P.S), .5 * P.S);
});

test('the bar and the projector stage: every drink has the same room and stands to one side, then the other, so the one behind is not hidden', () => {
  for (const P of [PRESETS.bar, PRESETS.holo]) {
    const ids = ['labaneh', 'hummus', 'chopped-salad', 'artichoke', 'filo', 'caesar', 'croquettes', 'fish-soup'], items = ids.map((id) => relief(id)), pl = placesOf(P, items, 'wine', false), rtl = placesOf(P, items, 'wine', true);
    pl.forEach((p, i) => { assert.ok(Math.sign(p.dx) === (i % 2 ? 1 : -1), P.id + ': alternate sides'); assert.ok(Math.abs(p.dx) <= P.stagger * 1.2 + .05 + 1e-9 && Math.abs(p.dx) >= P.stagger * .7 - .05); assert.ok(Math.abs(p.dz) <= .08 + 1e-9 && Math.abs(p.spin) <= .08 + 1e-9); assert.ok(Math.sign(rtl[i].dx) === -Math.sign(p.dx)); assert.equal(p.z, i * P.S); assert.equal(p.cx, p.dx, 'the focus line leans to each in turn'); });
    for (let i = 0; i < ids.length - 1; i++) assert.ok(Math.hypot(pl[i + 1].dx - pl[i].dx, P.S + pl[i].dz - pl[i + 1].dz) > PLATE * (P.id === 'bar' ? .8 : 1.0), P.id + ': neighbours do not touch');
    assert.equal(centreAt(pl, 0), pl[0].dx); assert.equal(centreAt(pl, 3), pl[3].dx); const mid = centreAt(pl, 2.5); assert.ok(mid > Math.min(pl[2].dx, pl[3].dx) && mid < Math.max(pl[2].dx, pl[3].dx)); assert.equal(centreAt(pl, 99), pl[7].dx);
    for (let p = -1; p <= 8; p += .21) { assert.ok(Math.abs(alongAt(pl, p, P.S) - p * P.S) < 1e-9); assert.ok(Math.abs(dishAt(pl, p * P.S, P.S) - p) < 1e-6); }
  }
  for (const P of Object.values(PRESETS)) assert.ok(P.width > 1000 || P.holo || P.id === 'vitrine', P.id + ': the table has no sides: one surface to every edge of any screen (there was a dark gap between two tables)');      // the vitrine is a glass case of its own width; around it the room is quieter, never black
});

test('the bar: a bottle and its glass fit above the card, the eye is lower, and the next drink stands clear behind', () => {
  const P = PRESETS.bar;
  for (const [W, H] of PHONES.concat(WIDE)) {
    const F = frameOf(P, W, H, false), places = placesOf(P, Array.from({ length: 4 }, (_, i) => bare('wine-' + i)), 'wine', false), cam = camAt(P, F, places, 1), where = `${W}x${H}`;
    assert.equal(F.standing, true); assert.ok(P.E < PRESETS.table.E - 8);
    const foot = projectPx(cam, F, dish(P, places, 1)), head = projectPx(cam, F, [places[1].dx, 2.3, -P.S + places[1].dz]), l = projectPx(cam, F, [places[1].dx - .85, 0, -P.S]), r = projectPx(cam, F, [places[1].dx + .85, 0, -P.S]);
    assert.ok(head.y > F.top - 6 && foot.y < H - (F.wide ? 0 : F.cardH) + 4, where + ': the whole drink is in view (' + head.y.toFixed(0) + ' … ' + foot.y.toFixed(0) + ')'); assert.ok(l.x > -2 && r.x < W + 2, where + ': bottle and glass fit the width');
    const nextFoot = projectPx(cam, F, dish(P, places, 2)); assert.ok(nextFoot.y < foot.y - 60 && nextFoot.y > 0, where + ': the next drink stands further up the counter');
  }
});
