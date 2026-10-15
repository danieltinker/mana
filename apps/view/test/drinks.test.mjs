import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { U, VESSELS, GLASSES, radiusAt, drinkSpec, tiltPose, labelText, TILT } from '../src/drinks/spec.js';
import { pourAt, pourPlan, REST, LEAD } from '../src/drinks/pour.js';
import { buildModel, initialState, createStore, select, checkState, presentation } from '../src/store.js';
import { normalise } from '../src/snapshot.js';
import { shapeOf, RAD } from '../src/scenes/common.js';

const snap = normalise(JSON.parse(readFileSync(new URL('../demo/olea/menu.json', import.meta.url), 'utf8')), 'http://x.test/view/demo/olea/menu.json');
const model = buildModel(snap), item = (id) => model.itemById.get(id).item;
const wine = (color, extra) => ({ id: 'w', name: { he: 'יין', en: 'Wine' }, asset: null, details: { wine: Object.assign({ color }, extra || {}) } });
const beer = (serving, color) => ({ id: 'b', name: { he: 'בירה', en: 'Beer' }, asset: null, details: { beer: { serving, color } } });
const relief = (extra) => Object.assign({ state: 'relief', e: 45, h: 1.7, o: [0, -.38], s: .62 }, extra || {});

test('what is drawn comes from the merchant\'s fields, and nothing is guessed', () => {
  assert.deepEqual(['red', 'white', 'rose', 'orange', 'sparkling'].map((c) => { const s = drinkSpec(wine(c), 'wine'); return [s.vessel, s.glass, s.pourable]; }),
    [['bordeaux', 'red', true], ['bordeaux', 'white', true], ['burgundy', 'white', true], ['burgundy', 'white', true], ['sparkling', 'flute', true]]);
  assert.equal(drinkSpec(wine('red', { bottle: 'burgundy' }), 'wine').vessel, 'burgundy');
  const blank = drinkSpec(wine(''), 'wine'); assert.equal(blank.liquid, null); assert.equal(blank.pourable, false, 'no colour given: an empty glass, no pour');
  assert.deepEqual(['bottle', 'can', 'tap', ''].map((s) => { const d = drinkSpec(beer(s, 'pale'), 'beer'); return [d.vessel, d.glass, d.source, d.turns]; }),
    [['longneck', 'tulip', 'bottle', true], ['can', 'pint', 'bottle', true], ['tap', 'pint', 'tap', false], ['none', 'pint', 'above', false]]);
  assert.equal(drinkSpec(beer('tap', 'mauve'), 'beer').pourable, false);
  assert.equal(drinkSpec(wine('red'), 'food'), null); assert.equal(drinkSpec(wine('red'), 'drinks'), null);
  assert.equal(drinkSpec(Object.assign(wine('red'), { asset: { state: 'photo' } }), 'wine'), null, 'a print stays a print');
  /* a photographed bottle: left alone, unless the data says a glass belongs beside it */
  assert.equal(drinkSpec(Object.assign(wine('red'), { asset: relief() }), 'wine'), null);
  const comp = drinkSpec(Object.assign(wine('red'), { asset: relief({ glass: true }) }), 'wine'); assert.equal(comp.vessel, 'none'); assert.equal(comp.source, 'above'); assert.equal(comp.companion, true);
  assert.equal(drinkSpec(Object.assign(beer('bottle', 'amber'), { asset: relief() }), 'beer').source, 'above');
  assert.equal(drinkSpec(Object.assign(beer('bottle', 'amber'), { asset: relief({ glass: false }) }), 'beer'), null);
  assert.equal(drinkSpec(Object.assign(beer('tap', 'amber'), { asset: relief() }), 'beer'), null, 'on tap: the photo is the glass');
});

test('how an item is shown, and what may be done with it', () => {
  assert.deepEqual(presentation(item('wine-red'), 'wine'), { type: 'drink', pourable: true, illustration: true, holo: false, turns: true, vessel: 'bordeaux' });
  assert.equal(presentation(item('beer-lager'), 'beer').turns, false); assert.equal(presentation(item('beer-stout'), 'beer').vessel, 'can');
  assert.deepEqual(presentation(item('lemonade'), 'drinks'), { type: 'stand', pourable: false, illustration: false, holo: false, turns: true });      // a photo is never called an illustration
  assert.equal(presentation(item('hummus'), 'food').type, 'relief'); assert.equal(presentation(item('lasagne'), 'food').type, 'photo'); assert.equal(presentation(item('bread'), 'food').type, 'text');
  assert.equal(presentation(item('bread'), 'food').turns, false);
});

test('shapes: sane profiles, one scale, small meshes', () => {
  Object.entries(VESSELS).forEach(([k, v]) => { v.p.forEach((p, i) => { assert.ok(p[0] >= 0 && p[1] >= 0 && p[1] <= v.h + .1, k); if (i) assert.ok(p[1] >= v.p[i - 1][1] - .25, k + ': profile goes up (a can lid may sit a little below its rim)'); }); assert.ok((v.p.length - 1) * 40 * 2 <= 6000, k + ' triangles'); });
  Object.entries(GLASSES).forEach(([k, g]) => {
    assert.ok((g.outer.length + g.inner.length - 1) * 44 * 2 <= 6000, k + ' triangles'); assert.ok(g.fill > g.inner[0][1] && g.fill + g.head * 1.6 <= g.h + .2, k + ': the pour stays inside the glass');
    g.inner.forEach((p, i) => { const o = radiusAt(g.outer.filter((q) => q[1] >= g.inner[0][1] - .5), p[1]); if (i) assert.ok(p[0] < o + 1e-6, k + ': the inside is inside'); });
    assert.equal(radiusAt(g.inner, g.inner[0][1] - 5), g.inner[0][0]); assert.ok(radiusAt(g.inner, g.fill) > 1);
  });
  assert.ok(Math.abs(VESSELS.bordeaux.h * U - 2.25) < .01); assert.ok(GLASSES.red.h < VESSELS.bordeaux.h && VESSELS.can.h < GLASSES.pint.h);
  ['wine-white', 'wine-rose', 'wine-red', 'wine-orange', 'wine-sparkling'].forEach((id) => { const s = drinkSpec(item(id), 'wine'); assert.ok(s.r > .5 && s.r < .9 && s.top >= 2.2 && s.top < 2.4, id); assert.ok(s.pour.r > s.rest.r && s.pour.top >= s.rest.top); });
  const can = drinkSpec(item('beer-stout'), 'beer'); assert.ok(Math.abs(can.top - GLASSES.pint.h * U) < 1e-9, 'the frame is as tall as the taller of the two');
});

test('the pouring bottle ends with its mouth over the glass and never passes through it', () => {
  ['wine-red', 'wine-rose', 'wine-sparkling', 'beer-wheat', 'beer-stout'].forEach((id) => {
    const kind = id.startsWith('wine') ? 'wine' : 'beer', s = drinkSpec(item(id), kind), G = GLASSES[s.glass], V = VESSELS[s.vessel], rest = tiltPose(s, 0), end = tiltPose(s, 1);
    assert.ok(Math.abs(rest.x - s.bottle[0]) < 1e-9 && Math.abs(rest.y - V.h * U / 2) < 1e-9 && rest.angle === 0, id + ': starts standing where it stood');
    assert.ok(Math.abs(end.mouth[0] - s.glassAt[0]) < .2 && end.mouth[1] > G.h * U + .1 && end.mouth[1] < G.h * U + .5, id + ': mouth over the glass');
    assert.ok(end.angle > Math.PI / 2 && end.angle < 2, id + ': tipped past level'); assert.equal(end.angle, TILT[s.vessel]);
    for (let k = 0; k <= 1.0001; k += .05) { const p = tiltPose(s, k), half = V.h * U / 2;      // sample the bottle's axis: no point of it inside the glass
      for (let a = -1; a <= 1.0001; a += .1) { const x = p.x + a * half * Math.sin(p.angle), y = p.y + a * half * Math.cos(p.angle), inside = Math.abs(x - s.glassAt[0]) < radiusAt(G.outer, y / U) * U && y < G.h * U - .02 && y > 0;
        assert.ok(!(inside && k > .15), id + ': bottle axis inside the glass at tilt ' + k.toFixed(2)); } }
  });
});

test('the pour: once, short, and it ends exactly at rest', () => {
  [{ source: 'bottle' }, { source: 'bottle', sparkling: true }, { source: 'bottle', beer: true }, { source: 'tap', beer: true }, { source: 'above', beer: true }, { source: 'above' }].forEach((o) => {
    const p = pourPlan(o), name = JSON.stringify(o); let last = null, maxFoam = 0;
    assert.ok(p.action >= 2.5 && p.action <= 3.5, name + ': the pour itself takes ' + p.action.toFixed(2) + ' s'); assert.ok(p.end <= 9.5, name + ': everything is still after ' + p.end.toFixed(1) + ' s');
    for (let t = -LEAD; t <= p.end + 1; t += 1 / 60) {
      const s = pourAt(t, o);
      ['fade', 'tilt', 'head', 'tail', 'level', 'bubbles', 'cam'].forEach((k) => assert.ok(s[k] >= 0 && s[k] <= 1 + 1e-9, name + ' ' + k + ' at ' + t.toFixed(2)));
      assert.ok(Math.abs(s.wobble) <= 1 && s.foam >= 0 && s.foam <= 1.6);
      if (last && t > 1 / 60) { assert.ok(s.level >= last.level - 1e-9, name + ': the level never falls'); assert.ok(Math.abs(s.level - last.level) < .03 && Math.abs(s.tilt - last.tilt) < .1, name + ': no jumps'); }
      if (t < 0) { assert.equal(s.tilt, 0); assert.equal(s.level, 1); }
      if (t >= 0 && t < p.t0 - .07) assert.equal(s.head, 0, 'nothing flows before the bottle is over the glass');
      if (s.head > 0 && s.tail < 1) assert.ok(s.tilt > .7, name + ': it only flows while tipped');
      maxFoam = Math.max(maxFoam, s.foam); last = s;
    }
    assert.deepEqual(pourAt(p.end, o), REST(o)); assert.deepEqual(pourAt(1e6, o), REST(o)); assert.equal(pourAt(p.end - .01, o).done, false);
    assert.ok(Math.abs(pourAt(-LEAD, o).fade - 1) < 1e-9 && pourAt(-.01, o).fade < .01, 'the glass is emptied before the pour starts');
    const justBefore = pourAt(p.end - 1 / 60, o); ['tilt', 'wobble', 'bubbles'].forEach((k) => assert.ok(Math.abs(justBefore[k]) < .03, name + ': ' + k + ' has settled by the end'));
    assert.ok(Math.abs(justBefore.level - 1) < 1e-6 && Math.abs(justBefore.foam - REST(o).foam) < .03);
    if (o.beer) { assert.ok(maxFoam > 1.3, 'the head rises above the collar'); assert.equal(REST(o).foam, 1); } else assert.equal(REST(o).foam, 0);
  });
});

test('labels carry only what was typed', () => {
  assert.deepEqual(labelText(item('wine-red'), 'wine', 'en'), { top: 'Nahal Shakedim', title: 'Adom', mid: 'Syrah, Carignan', foot: 'Upper Galilee · 2022', back: ['Syrah, Carignan', 'Upper Galilee', 'By the glass, 150 ml'] });
  assert.equal(labelText(item('wine-red'), 'wine', 'he').foot, 'הגליל העליון · 2022');
  assert.deepEqual(labelText(wine('red'), 'wine', 'en'), { top: '', title: 'Wine', mid: '', foot: '', back: [] });      // nothing entered: the item's own name, and blanks
  assert.deepEqual(labelText(item('beer-ipa'), 'beer', 'en'), { top: 'Simta Brewing', title: 'IPA', mid: 'West Coast IPA', foot: '6.2%', back: [] });
});

test('state: "pour again" only for a lifted drink that can be poured', () => {
  const st = createStore(model, initialState(model, { lang: 'en' })), s = () => st.getState();
  st.dispatch({ type: 'pourAgain' }); assert.equal(s().pourSeq, 0, 'nothing is poured on the food table');
  st.dispatch({ type: 'focus', id: 'wine-red' }); st.dispatch({ type: 'pourAgain' }); assert.equal(s().pourSeq, 0, 'a drink that stands on the bar is full and still');
  st.dispatch({ type: 'open', what: 'dish' }); assert.equal(s().pourSeq, 0, 'lifting a drink does not count as asking again');
  st.dispatch({ type: 'pourAgain' }); st.dispatch({ type: 'pourAgain' }); assert.equal(s().pourSeq, 2); assert.equal(s().nav.kind, 'pour'); assert.equal(s().itemId, 'wine-red'); assert.equal(s().open, 'dish');
  st.dispatch({ type: 'step', dir: 1 }); assert.equal(s().itemId, 'wine-orange'); assert.equal(s().open, 'dish'); st.dispatch({ type: 'pourAgain' }); assert.equal(s().pourSeq, 3);
  st.dispatch({ type: 'setSimple', on: true }); st.dispatch({ type: 'pourAgain' }); assert.equal(s().pourSeq, 3, 'the list has no picture to pour in'); st.dispatch({ type: 'setSimple', on: false });
  st.dispatch({ type: 'open', what: 'dish', id: 'lemonade' }); st.dispatch({ type: 'pourAgain' }); assert.equal(s().pourSeq, 3, 'a photographed drink is not poured');
  st.dispatch({ type: 'open', what: 'dish', id: 'bread' }); st.dispatch({ type: 'pourAgain' }); assert.equal(s().pourSeq, 3);
  assert.deepEqual(checkState(s(), model), []); assert.equal(select(s(), model).kind, 'food'); assert.equal(select(st.dispatch({ type: 'focus', id: 'wine-white' }), model).present.illustration, true);
  assert.equal(presentation(item('beer-lager'), 'beer').turns, false, 'a tap has no label to turn to'); assert.equal(presentation(item('bread'), 'food').turns, false);
});

test('the drinks keep one scale on the bar, and the pour needs more room than the rest', () => {
  for (const cat of ['wine', 'beer', 'cold']) model.catById.get(cat).items.forEach((it) => {
    const sh = shapeOf(it, model.catById.get(cat).raw.kind);
    assert.ok(sh.top > .9 && sh.top <= 2.5 && sh.r > .3 && sh.r < 1.6, it.id + ': ' + sh.type + ' ' + sh.r.toFixed(2) + ' × ' + sh.top.toFixed(2));
    if (sh.type === 'drink') { assert.ok(sh.drink.pour.r >= sh.drink.rest.r && sh.drink.pour.top >= sh.drink.rest.top, it.id + ': the camera never has to come closer to hold the pour'); if (sh.drink.source === 'bottle') { const tip = tiltPose(sh.drink, 1); assert.ok(tip.x - VESSELS[sh.drink.vessel].h * U / 2 > sh.drink.pour.cx - sh.drink.pour.r - 1e-6, it.id + ': the swinging bottle stays inside the pour frame'); } }
  });
});
