/* The walk: how the screen is shared, where the dishes stand on the long table, and what the gliding camera shows. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, presetById, frameOf, placeOf, centreAt, cameraFor, projectPx, PLATE, LANE } from '../src/scenes/walk.js';
import { shapeOf, RAD, SIZE } from '../src/scenes/common.js';

const relief = (id, extra) => ({ id, asset: Object.assign({ state: 'relief', e: 48, h: .2, o: null, s: null }, extra || {}) });
const stand = (id) => ({ id, asset: { state: 'relief', e: 45, h: 1.8, o: [0, -.4], s: .62 } });
const photo = (id) => ({ id, asset: { state: 'photo' } }), bare = (id) => ({ id, asset: null });
const PHONES = [[390, 844], [360, 640], [414, 896], [768, 1024]], WIDE = [[1280, 800], [1440, 900], [844, 390], [1024, 768]];
/* the camera at dish p of a table whose dishes stand at `places` */
function camAt(P, F, places, p, walk = 1) { const look = [centreAt(places, p), 0, -walk * p * P.S]; return cameraFor(F, look, P.E, 1, 0, F.cx, F.cy); }
const dish = (P, places, i, walk = 1) => [places[i].dx, 0, -walk * i * P.S + places[i].dz];

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
    const F = frameOf(P, W, H, false), items = Array.from({ length: 6 }, (_, i) => 'dish-' + i), places = items.map((id, i) => placeOf(P, i, id, false)), where = `${W}x${H}`;
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
    const F = frameOf(P, W, H, false), places = Array.from({ length: 6 }, () => ({ dx: 0, dz: 0, spin: 0 })), eps = .01;
    const a = projectPx(camAt(P, F, places, 2), F, [0, 0, -2 * P.S]), b = projectPx(camAt(P, F, places, 2 + eps), F, [0, 0, -2 * P.S]);
    assert.ok(Math.abs((b.y - a.y) / eps - F.pxPerDish) / F.pxPerDish < .01, `${P.id} ${W}x${H}: the point under the finger keeps up with it (${((b.y - a.y) / eps).toFixed(1)} vs ${F.pxPerDish.toFixed(1)} px a dish)`);
    const far = (p) => projectPx(camAt(P, F, places, p), F, [0, 0, -3 * P.S]).y, near = (p) => projectPx(camAt(P, F, places, p), F, [0, 0, -1 * P.S]).y;
    assert.ok((near(2 + eps) - near(2)) > (b.y - a.y) && (b.y - a.y) > (far(2 + eps) - far(2)) && far(2 + eps) > far(2), P.id + ': parallax');
  }
  const P = PRESETS.table, F = frameOf(P, 390, 844, false), places = [{ dx: 0, dz: 0 }, { dx: 0, dz: 0 }];
  const feed = projectPx(camAt(P, F, places, .01, -1), F, [0, 0, 0]).y - projectPx(camAt(P, F, places, 0, -1), F, [0, 0, 0]).y; assert.ok(feed < 0, 'walk = -1: going on, the dish in focus moves UP the screen, with a finger that swipes up');
});

test('a laid table, not a column: places lean left and right, a little askew, the same every time, mirrored in Hebrew', () => {
  for (const P of Object.values(PRESETS)) {
    const ids = ['labaneh', 'hummus', 'chopped-salad', 'artichoke', 'filo', 'caesar', 'croquettes', 'fish-soup'], pl = ids.map((id, i) => placeOf(P, i, id, false)), rtl = ids.map((id, i) => placeOf(P, i, id, true));
    pl.forEach((p, i) => { assert.ok(Math.sign(p.dx) === (i % 2 ? 1 : -1), P.id + ': alternate sides'); assert.ok(Math.abs(p.dx) <= P.stagger * 1.2 + .05 + 1e-9 && Math.abs(p.dx) >= P.stagger * .7 - .05); assert.ok(Math.abs(p.dz) <= .08 + 1e-9 && Math.abs(p.spin) <= .08 + 1e-9); assert.deepEqual(p, placeOf(P, i, ids[i], false)); assert.ok(Math.sign(rtl[i].dx) === -Math.sign(p.dx)); });
    assert.ok(new Set(pl.map((p) => p.spin.toFixed(4))).size > 5, 'no two dishes lie exactly alike');
    for (let i = 0; i < ids.length - 1; i++) assert.ok(Math.hypot(pl[i + 1].dx - pl[i].dx, P.S + pl[i].dz - pl[i + 1].dz) > PLATE * (P.id === 'bar' ? .8 : 1.0), P.id + ': neighbours do not touch');
    assert.equal(centreAt(pl, 0), pl[0].dx); assert.equal(centreAt(pl, 3), pl[3].dx); const mid = centreAt(pl, 2.5); assert.ok(mid > Math.min(pl[2].dx, pl[3].dx) && mid < Math.max(pl[2].dx, pl[3].dx)); assert.equal(centreAt(pl, 99), pl[7].dx); assert.equal(centreAt([], 1), 0);
    assert.ok(P.width > 1000 || P.holo, P.id + ': the table has no sides: one surface to every edge of any screen (there was a dark gap between two tables)');
  }
});

test('the bar: a bottle and its glass fit above the card, the eye is lower, and the next drink stands clear behind', () => {
  const P = PRESETS.bar;
  for (const [W, H] of PHONES.concat(WIDE)) {
    const F = frameOf(P, W, H, false), places = Array.from({ length: 4 }, (_, i) => placeOf(P, i, 'wine-' + i, false)), cam = camAt(P, F, places, 1), where = `${W}x${H}`;
    assert.equal(F.standing, true); assert.ok(P.E < PRESETS.table.E - 8);
    const foot = projectPx(cam, F, dish(P, places, 1)), head = projectPx(cam, F, [places[1].dx, 2.3, -P.S + places[1].dz]), l = projectPx(cam, F, [places[1].dx - .85, 0, -P.S]), r = projectPx(cam, F, [places[1].dx + .85, 0, -P.S]);
    assert.ok(head.y > F.top - 6 && foot.y < H - (F.wide ? 0 : F.cardH) + 4, where + ': the whole drink is in view (' + head.y.toFixed(0) + ' … ' + foot.y.toFixed(0) + ')'); assert.ok(l.x > -2 && r.x < W + 2, where + ': bottle and glass fit the width');
    const nextFoot = projectPx(cam, F, dish(P, places, 2)); assert.ok(nextFoot.y < foot.y - 60 && nextFoot.y > 0, where + ': the next drink stands further up the counter');
  }
});
