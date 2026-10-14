/* Round two: the rooms of the place, sold out at the bottom, the taste of a wine or a beer, "my table" setting itself. Pure parts. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roomFor, ROOM_IDS, isStandingRoom } from '../src/scenes/rooms.js';
import { PRESETS, presetById, placesOf, heightAt, frameOf, tierOf } from '../src/scenes/walk.js';
import { shapeOf } from '../src/scenes/common.js';
import { buildModel, initialState, reduce, servedOrder } from '../src/store.js';
import { normalise } from '../src/snapshot.js';
import { tasteOf, cleanTaste, hasWord } from '../src/drinks/taste.js';
import { layoutSet, poseAt, clothAt, durationOf, CLOTH_T, cutleryAt, paint } from '../src/trayset.js';

const raw = JSON.parse(readFileSync(new URL('../demo/olea/menu.json', import.meta.url), 'utf8'));
const olea = () => normalise(JSON.parse(JSON.stringify(raw)), 'http://x.test/view/demo/olea/menu.json');

test('a category\'s room follows its kind; category.room chooses another; scene keeps its old meaning; the theme can make it all a projection', () => {
  const t = { surface: 'oak' };
  assert.deepEqual(['food', 'dessert', 'wine', 'beer', 'drinks', 'weird'].map((kind) => roomFor({ kind, scene: 'auto' }, t)), ['table', 'vitrine', 'cellar', 'taps', 'cocktail', 'table']);
  assert.equal(roomFor({ kind: 'food', room: 'vitrine' }, t), 'vitrine', 'sandwiches in the vitrine');
  assert.equal(roomFor({ kind: 'drinks', room: 'cellar' }, t), 'cellar');
  assert.equal(roomFor({ kind: 'dessert', room: 'moon' }, t), 'vitrine', 'an unknown room is ignored');
  assert.equal(roomFor({ kind: 'dessert', scene: 'table' }, t), 'table', 'scene: table keeps it on the table');
  assert.deepEqual(['wine', 'beer', 'drinks', 'food'].map((kind) => roomFor({ kind, scene: 'bar' }, t)), ['cellar', 'taps', 'cocktail', 'cocktail'], 'scene: bar → the drinks room of its kind');
  assert.equal(roomFor({ kind: 'wine', room: 'cellar' }, { surface: 'holo' }), 'holo');
  assert.equal(roomFor({ kind: 'beer', scene: 'holo', room: 'taps' }, t), 'holo');
  assert.equal(roomFor({ kind: 'beer', room: 'taps' }, t, { rooms: false }), 'bar', '?rooms=off: the two rooms of before');
  for (const id of ROOM_IDS) { assert.ok(PRESETS[id], id + ' has a preset'); assert.equal(presetById(id).id, id); assert.equal(!!presetById(id).standing, isStandingRoom(id)); }
});

test('every room is its own place: its own eye, light and surface', () => {
  const ids = ['table', 'vitrine', 'cellar', 'taps', 'cocktail'], P = ids.map((id) => PRESETS[id]);
  assert.equal(new Set(P.map((p) => p.E)).size, ids.length, 'each room has its own height of eye: ' + P.map((p) => p.E));
  assert.ok(PRESETS.cocktail.E > PRESETS.bar.E + 8, 'the cocktail bar is seen from higher up than the old bar (Daniel: "the angle is too flat for drinks")');
  assert.ok(Math.abs(PRESETS.taps.yaw) > .2 && Math.abs(PRESETS.cocktail.yaw) > .2, 'the taps and the cocktail bar are seen three-quarter on');
  const surf = ids.slice(1).map((id) => PRESETS[id].surface({})); assert.ok(surf.every((s) => s.kind && s.plate), 'each room has a counter and a backdrop');
  assert.equal(new Set(surf.map((s) => s.plate)).size, 4); assert.equal(new Set(surf.map((s) => s.tint.join())).size, 4, 'and its own light');
  for (const id of ids) { const f = frameOf(PRESETS[id], 390, 844, false); assert.ok(f.ppu > 0 && f.fov > 10 && f.fov < 80, id + ': a sensible lens'); assert.ok(f.pxPerDish > 40, id + ': a finger moves it: ' + f.pxPerDish); }
});

test('the vitrine: dishes on risers of three heights, read from the dish itself; the eye rises and settles with them', () => {
  const m = buildModel(olea()), sweet = m.catById.get('sweet'), P = PRESETS.vitrine, pl = placesOf(P, sweet.items, 'dessert', false);
  assert.ok(pl.every((p) => P.tiers.includes(p.y)), 'every dish stands on one of the tiers');
  assert.ok(new Set(pl.map((p) => p.y)).size >= 2, 'not all on one level: ' + pl.map((p) => p.y));
  const malabi = sweet.items.findIndex((it) => it.id === 'malabi'); assert.equal(pl[malabi].y, P.tiers[0], 'a tall dessert stands low');
  for (let i = 0; i < pl.length; i++) assert.equal(heightAt(pl, i), pl[i].y);
  for (let p = 0; p < pl.length - 1; p += .05) { const a = heightAt(pl, p), b = heightAt(pl, p + .05); assert.ok(Math.abs(b - a) < .05, 'no jump at ' + p); }
  assert.equal(tierOf(P.tiers, { type: 'text', top: .03 }), P.tiers[1]);
  assert.ok(placesOf(PRESETS.table, sweet.items, 'dessert', false).every((p) => p.y === 0), 'the table has no risers');
  for (let i = 1; i < pl.length; i++) assert.ok(pl[i].z - pl[i - 1].z > 2 * shapeOf(sweet.items[i], 'dessert').r * .9, 'neighbours do not touch');
});

test('sold out waits at the end of its section, never first; business.soldOut = hide leaves it out; the list has the same order', () => {
  const items = [{ id: 'a', available: false }, { id: 'b' }, { id: 'c', available: false }, { id: 'd' }];
  assert.deepEqual(servedOrder(items, 'bottom').map((x) => x.id), ['b', 'd', 'a', 'c'], 'the merchant\'s order, sold out last');
  assert.deepEqual(servedOrder(items, 'hide').map((x) => x.id), ['b', 'd']);
  let s = olea(); assert.equal(s.business.soldOut, 'bottom', 'the default');
  let m = buildModel(s); assert.deepEqual(m.catById.get('starters').ids.slice(-2), ['bread', 'fish-soup']); assert.equal(m.catById.get('sweet').ids.slice(-1)[0], 'brulee');
  const r2 = JSON.parse(JSON.stringify(raw)); r2.business.soldOut = 'hide'; s = normalise(r2, 'http://x.test/'); m = buildModel(s);
  assert.equal(s.business.soldOut, 'hide'); assert.ok(!m.itemById.has('fish-soup') && !m.itemById.has('brulee')); assert.equal(m.catById.get('starters').items.length, 8);
  const r3 = JSON.parse(JSON.stringify(raw)); r3.business.soldOut = 'sideways'; assert.equal(normalise(r3, 'http://x.test/').business.soldOut, 'bottom', 'unknown → bottom');
  /* a section whose first dish is sold out does not open on it */
  const r4 = JSON.parse(JSON.stringify(raw)); r4.categories[0].items[0].available = false; m = buildModel(normalise(r4, 'http://x.test/'));
  assert.notEqual(initialState(m).itemId, 'labaneh'); assert.equal(m.catById.get('starters').ids.slice(-1)[0], 'fish-soup');
  /* a deep link to a hidden dish falls back to its section */
  r2.business.soldOut = 'hide'; m = buildModel(normalise(r2, 'http://x.test/')); assert.equal(initialState(m, { route: { c: 'starters', i: 'fish-soup' } }).itemId, 'labaneh');
  /* hide a whole section of sold-out dishes: the section goes */
  const r5 = JSON.parse(JSON.stringify(raw)); r5.business.soldOut = 'hide'; r5.categories[3].items.forEach((it) => { it.available = false; }); m = buildModel(normalise(r5, 'http://x.test/'));
  assert.ok(!m.catById.has('sweet')); assert.equal(reduce(initialState(m), { type: 'setCategory', id: 'sweet' }, m).categoryId, 'starters');
});

test('the snapshot: category.room and the taste fields are optional and checked', () => {
  const r = JSON.parse(JSON.stringify(raw));
  r.categories[0].room = 'vitrine'; r.categories[1].room = 'attic';
  const w = r.categories[4].items[0].details.wine; w.taste = { sweet: 9, body: 2, acid: 'high', notes: ['mineral', 'mineral', 'unicorn', 'citrus'] };
  const b = r.categories[5].items[0].details.beer; b.taste = { style: 'ipa', bitter: 3, notes: 'hop' };
  const s = normalise(r, 'http://x.test/');
  assert.equal(s.categories[0].room, 'vitrine'); assert.equal(s.categories[1].room, null);
  assert.deepEqual(s.categories[4].items[0].details.wine.taste, { body: 2, notes: ['mineral', 'citrus'] });
  assert.deepEqual(s.categories[5].items[0].details.beer.taste, { bitter: 3, style: 'ipa' });
  assert.equal(cleanTaste('dry', 'wine'), null); assert.equal(cleanTaste({}, 'beer'), null);
  assert.equal(buildModel(s).catById.get('starters').scene, 'vitrine', 'the owner chose the vitrine for the starters');
});

test('taste: only what the merchant said: fields are facts, words from the description are marked as suggested', () => {
  const s = olea(), it = (id) => { for (const c of s.categories) for (const x of c.items) if (x.id === id) return [x, c.kind]; return null; };
  const white = tasteOf(...it('wine-white'));
  assert.deepEqual(white.style, { id: 'white', src: 'field' });
  assert.deepEqual(white.scales.map((x) => [x.id, x.v, x.src]), [['sweet', 0, 'field'], ['body', 1, 'field'], ['acid', 3, 'field']], 'from the notes fields: Dry, Light, High');
  assert.ok(white.notes.some((n) => n.id === 'citrus' && n.src === 'field'));
  const rose = tasteOf(...it('wine-rose'));
  assert.deepEqual(rose.scales.map((x) => [x.id, x.v, x.src]), [['sweet', 0, 'words']], '"Pale, dry, strawberry on the nose" → dry, suggested');
  assert.deepEqual(rose.notes, [{ id: 'redfruit', src: 'words' }]);
  const orange = tasteOf(...it('wine-orange')); assert.ok(orange.notes.every((n) => n.src === 'field'), 'the taste field wins');
  const stout = tasteOf(...it('beer-stout')); assert.deepEqual(stout.style, { id: 'stout', src: 'field' }); assert.deepEqual(stout.notes, [{ id: 'roast', src: 'words' }]); assert.equal(stout.abv.text, '4.5%');
  const ipa = tasteOf(...it('beer-ipa')); assert.deepEqual(ipa.scales.map((x) => [x.id, x.v, x.src]), [['bitter', 3, 'field']]);
  /* Hebrew words, and nothing without words */
  assert.deepEqual(tasteOf({ desc: { he: 'יין יבש ומינרלי עם ניחוח הדרים', en: '' } }, 'wine').notes.map((n) => n.id).sort(), ['citrus', 'mineral']);
  assert.equal(tasteOf({ desc: { he: 'יין יבש', en: '' } }, 'wine').scales[0].v, 0);
  assert.equal(tasteOf({ desc: { he: 'יין חצי יבש', en: '' } }, 'wine').scales[0].v, 1, '"חצי יבש" is off-dry, not dry');
  assert.equal(tasteOf({ desc: { he: '', en: 'Our house wine' } }, 'wine'), null, 'no words, no tags');
  assert.equal(tasteOf({ desc: 'red fruit and oak' }, 'wine').style, null, '"red fruit" does not make a wine red');
  assert.equal(tasteOf({ details: {}, desc: 'x' }, 'food'), null);
  assert.ok(hasWord('ובמינרלי', 'מינרלי') === false && hasWord('ומינרלי', 'מינרלי'), 'one Hebrew prefix letter, no more');
  assert.ok(!hasWord('dryness', 'dry') && hasWord('Dry.', 'dry'));
});

test('my table sets itself: the cloth first, then each place in turn, landing with a bounce; at the end everything is still', () => {
  assert.ok(clothAt(0).on === 0 && clothAt(CLOTH_T).drop === 0);
  const end = durationOf(3);
  for (let i = 0; i < 3; i++) { assert.equal(poseAt(CLOTH_T - .01, i).on, 0, 'nothing before the cloth'); const p = poseAt(end, i); assert.deepEqual([p.on, p.drop, p.scale], [1, 0, 1], 'landed'); }
  assert.ok(poseAt(CLOTH_T + .3, 0).on > 0 && poseAt(CLOTH_T + .3, 2).on === 0, 'in turn');
  let over = false; for (let t = CLOTH_T; t < end; t += .01) if (poseAt(t, 0).drop < -.01) over = true; assert.ok(over, 'a little bounce past the cloth');
  assert.ok(end > 1.4 && durationOf(4) < 2.6, 'about two seconds: ' + durationOf(4));
  const L = layoutSet(5, 440, 200); assert.equal(L.places.length, 5); assert.ok(L.places.every((p) => p.x > 0 && p.x < 440 && p.y > 0 && p.y < 200));
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) assert.ok(Math.hypot(L.places[i].x - L.places[j].x, L.places[i].y - L.places[j].y) > L.places[i].r * 2, 'places do not overlap');
  assert.equal(layoutSet(12, 440, 200).places.length, 8, 'at most eight places');
  /* the fork on the left, the knife on the right, whatever the language: a table setting is not a reading direction */
  const c = cutleryAt(100, 20); assert.ok(c.fork < 100 && c.knife > 100);
  assert.equal(paint.length, 3, 'painting the table takes no language or direction');
});

test('taste: a negation turns a word round: "not dry" is not dry, "לא מתוק" is not sweet, "no oak" is no oak note', () => {
  const sc = (desc) => (tasteOf({ desc }, 'wine') || { scales: [] }).scales.map((x) => [x.id, x.v]);
  const nt = (desc, kind = 'wine') => (tasteOf({ desc }, kind) || { notes: [] }).notes.map((x) => x.id);
  assert.deepEqual(sc('Not too sweet, not dry'), [], 'the review\'s example: neither sweet nor dry is suggested');
  assert.deepEqual(sc({ he: 'לא מתוק', en: '' }), []); assert.deepEqual(sc({ he: 'יין לא יבש', en: '' }), []); assert.deepEqual(sc({ he: 'ולא מתוק מדי', en: '' }), [], 'one prefix letter on the negation');
  assert.deepEqual(sc({ he: 'בלי מתיקות, יבש', en: '' }), [['sweet', 0]], 'a comma ends the negation');
  assert.deepEqual(sc('never sweet'), []); assert.deepEqual(sc("isn't sweet"), []); assert.deepEqual(sc('not semi-sweet'), []);
  assert.deepEqual(sc('Dry and fresh'), [['sweet', 0]], 'and without one the word stands');
  assert.deepEqual(sc('A sweet finish, not oaky'), [['sweet', 3]], 'a negation after the word does not touch it');
  assert.deepEqual(nt('no oak, citrus and flint'), ['mineral', 'citrus']); assert.deepEqual(nt('without any oak'), []);
  assert.deepEqual(nt({ he: 'ללא עץ, מינרלי', en: '' }), ['mineral']); assert.deepEqual(nt({ he: 'אין בה מרירות, לתתית', en: '' }, 'beer'), ['malt']);
  assert.ok(hasWord('dry', 'dry') && !hasWord('not dry', 'dry') && !hasWord('לא יבש', 'יבש') && hasWord('יבש, לא חמוץ', 'יבש'));
  /* the same question from the card, the sheet and the list is answered once, and fast */
  const it = { desc: 'Dry, citrus', details: {} }; assert.equal(tasteOf(it, 'wine'), tasteOf(it, 'wine'));
  const many = []; for (let k = 0; k < 300; k++) many.push({ desc: { he: 'יין יבש ומינרלי עם ניחוח הדרים, לא מתוק', en: 'Dry and mineral, citrus, not sweet ' + k }, details: { wine: { color: 'white', notes: { sweetness: 'Dry', fruit: 'Citrus' } } } });
  const t0 = performance.now(); many.forEach((x) => tasteOf(x, 'wine')); const per = (performance.now() - t0) / many.length;
  assert.ok(per < .5, 'well under a millisecond a drink: ' + per.toFixed(3) + ' ms');
});
