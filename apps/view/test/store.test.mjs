import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildModel, initialState, reduce, createStore, select, checkState, swipeToStep, arrowToStep, formatHash, parseHash, routeOf, sceneFor, tx, presentation } from '../src/store.js';
import { bindHistory, planFromUrl } from '../src/history.js';
import { normalise } from '../src/snapshot.js';

const raw = JSON.parse(readFileSync(new URL('../demo/olea/menu.json', import.meta.url), 'utf8'));
const model = buildModel(normalise(raw, 'http://x.test/view/demo/olea/menu.json'));
const fresh = (opts) => createStore(model, initialState(model, opts));
const ok = (s) => assert.deepEqual(checkState(s, model), []);

/* a browser history that behaves like the real one: Back is asynchronous and fires popstate */
function fakeBrowser(startHash = '') {
  const entries = [{ state: null, hash: startHash }]; let at = 0; const subs = [];
  const location = { pathname: '/m/olea', search: '', get hash() { return entries[at].hash; } };
  const hashOf = (u) => { const i = u.indexOf('#'); return i < 0 ? '' : u.slice(i); };
  const history = {
    get state() { return entries[at].state; }, get length() { return entries.length; },
    pushState(st, _t, u) { entries.length = at + 1; entries.push({ state: st, hash: hashOf(u) }); at++; },
    replaceState(st, _t, u) { entries[at] = { state: st, hash: hashOf(u) }; },
    back() { return queueMicrotask(() => { if (at > 0) { at--; subs.forEach((f) => f()); } else left = true; }); },
    forward() { return queueMicrotask(() => { if (at < entries.length - 1) { at++; subs.forEach((f) => f()); } }); }
  };
  let left = false;
  return { history, location, on: (_n, f) => subs.push(f), entries, get at() { return at; }, get left() { return left; }, setTimeout: null };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test('scene presets follow the category', () => {
  assert.equal(sceneFor({ kind: 'food', scene: 'auto' }, { surface: 'oak' }), 'table');
  assert.equal(sceneFor({ kind: 'wine', scene: 'auto' }, { surface: 'oak' }), 'cellar');
  assert.equal(sceneFor({ kind: 'drinks', scene: 'table' }, { surface: 'oak' }), 'table');
  assert.equal(sceneFor({ kind: 'food', scene: 'auto' }, { surface: 'holo' }), 'holo');
  assert.deepEqual(model.cats.map((c) => c.scene), ['table', 'table', 'table', 'vitrine', 'cellar', 'taps', 'cocktail']);
  /* ?rooms=off: the two rooms of before */
  assert.equal(sceneFor({ kind: 'wine', scene: 'auto' }, { surface: 'oak' }, { rooms: false }), 'bar');
  assert.equal(sceneFor({ kind: 'dessert', scene: 'auto' }, { surface: 'oak' }, { rooms: false }), 'table');
  assert.deepEqual(buildModel(normalise(raw, 'http://x.test/view/demo/olea/menu.json'), { rooms: false }).cats.map((c) => c.scene), ['table', 'table', 'table', 'table', 'bar', 'bar', 'bar']);
});

test('a dish is always in focus: the first one to begin with, Hebrew by default', () => {
  const s = fresh().getState();
  assert.equal(s.categoryId, 'starters'); assert.equal(s.itemId, 'labaneh'); assert.equal(s.open, null); assert.equal(s.lang, 'he'); ok(s);
  assert.equal(select(s, model).index, 0); assert.equal(select(s, model).count, 9); assert.equal(select(s, model).first, true);
  assert.equal(model.order.length, 43); assert.equal(model.itemById.get('pappardelle').g, 9);
});

test('the whole menu is one walk: past the last dish of a category comes the first of the next, and back', () => {
  const st = fresh({ lang: 'en' }); const seen = [st.getState().itemId], kinds = [];
  for (let i = 0; i < 42; i++) { st.dispatch({ type: 'step', dir: 1 }); const s = st.getState(); seen.push(s.itemId); kinds.push(s.nav.kind + s.nav.dir); ok(s); }
  assert.deepEqual(seen, model.order); assert.equal(st.getState().categoryId, 'cold');
  assert.equal(kinds.filter((k) => k === 'category1').length, 6, 'six tables are crossed'); assert.equal(kinds.filter((k) => k === 'glide1').length, 36);
  st.dispatch({ type: 'step', dir: 1 }); assert.equal(st.getState().itemId, 'mojito'); assert.equal(st.getState().nav.kind, 'edge'); assert.equal(select(st.getState(), model).last, true);
  st.dispatch({ type: 'focus', id: 'pappardelle' }); st.dispatch({ type: 'step', dir: -1 });
  let s = st.getState(); assert.equal(s.itemId, 'fish-soup', 'backwards you arrive at the LAST dish of the table before (the sold-out soup waits at its end)'); assert.equal(s.categoryId, 'starters'); assert.deepEqual([s.nav.kind, s.nav.dir, s.nav.axis], ['category', -1, 'x']);
  st.dispatch({ type: 'step', dir: 1, by: 3 }); assert.equal(st.getState().itemId, 'gnocchi', 'Page Down: three dishes on, across the table edge');
  st.dispatch({ type: 'home' }); assert.equal(st.getState().itemId, 'pappardelle'); st.dispatch({ type: 'home' }); assert.equal(st.getState().itemId, 'labaneh', 'Home again: the start of the menu'); st.dispatch({ type: 'home' }); assert.equal(st.getState().nav.kind, 'edge');
  st.dispatch({ type: 'end' }); assert.equal(st.getState().itemId, 'fish-soup'); st.dispatch({ type: 'end' }); assert.equal(st.getState().itemId, 'mojito');
});

test('a sideways swipe, an arrow or a chip changes category; you arrive at its first dish; the ends are edges', () => {
  const st = fresh({ lang: 'en' });
  st.dispatch({ type: 'swipe', sx: 1 }); assert.equal(st.getState().categoryId, 'starters'); assert.deepEqual([st.getState().nav.kind, st.getState().nav.axis], ['edge', 'x']);
  st.dispatch({ type: 'focus', id: 'caesar' }); st.dispatch({ type: 'swipe', sx: -1 });      // LTR: finger left = next
  let s = st.getState(); assert.equal(s.categoryId, 'mains'); assert.equal(s.itemId, 'pappardelle'); assert.equal(s.nav.kind, 'category'); assert.equal(s.nav.dir, 1); ok(s);
  for (let i = 0; i < 20; i++) st.dispatch({ type: 'swipe', sx: -1 });
  assert.equal(st.getState().categoryId, 'cold'); assert.equal(st.getState().itemId, 'orange-juice'); assert.equal(st.getState().nav.kind, 'edge');
  st.dispatch({ type: 'setCategory', id: 'sweet' }); s = st.getState(); assert.equal(s.itemId, 'cheesecake'); assert.equal(s.nav.dir, -1, 'a chip to the left of where you are: the camera goes that way');
  st.dispatch({ type: 'focus', id: 'malabi' }); st.dispatch({ type: 'setCategory', id: 'sweet' }); assert.equal(st.getState().itemId, 'cheesecake', 'the chip of the table you are at: back to its first dish'); assert.equal(st.getState().nav.kind, 'glide');
  st.dispatch({ type: 'setCategory', id: 'nope' }); assert.equal(st.getState().itemId, 'cheesecake');
});

test('RTL mirrors swipes and arrows', () => {
  assert.equal(swipeToStep(-1, 'en'), 1); assert.equal(swipeToStep(1, 'en'), -1);
  assert.equal(swipeToStep(1, 'he'), 1); assert.equal(swipeToStep(-1, 'he'), -1);
  assert.equal(arrowToStep('ArrowRight', 'en'), 1); assert.equal(arrowToStep('ArrowRight', 'he'), -1); assert.equal(arrowToStep('ArrowLeft', 'he'), 1);
  const st = fresh({ lang: 'he' });
  st.dispatch({ type: 'swipe', sx: 1 }); assert.equal(st.getState().categoryId, 'mains');                    // Hebrew: finger right = next
  st.dispatch({ type: 'arrow', key: 'ArrowLeft' }); assert.equal(st.getState().categoryId, 'oven');
  st.dispatch({ type: 'setLang', lang: 'en' }); st.dispatch({ type: 'swipe', sx: 1 }); assert.equal(st.getState().categoryId, 'mains');
  st.dispatch({ type: 'setLang', lang: 'fr' }); assert.equal(st.getState().lang, 'en');
});

test('lift, the list and "my table": one thing open at a time, Esc closes it, the walk goes on under a lifted dish', () => {
  const st = fresh({ lang: 'en' }), s = () => st.getState();
  st.dispatch({ type: 'open', what: 'dish' }); assert.equal(s().open, 'dish'); assert.equal(s().itemId, 'labaneh'); assert.equal(s().nav.kind, 'open'); ok(s());
  st.dispatch({ type: 'swipe', sx: -1 }); assert.equal(s().categoryId, 'starters', 'a sideways drag turns a lifted dish; it does not change table');
  st.dispatch({ type: 'step', dir: 1 }); assert.equal(s().itemId, 'hummus'); assert.equal(s().open, 'dish', 'arrow keys walk on with the sheet open');
  st.dispatch({ type: 'focus', id: 'kebab' }); assert.equal(s().open, null, 'picking another dish puts the first one down');
  st.dispatch({ type: 'open', what: 'dish', id: 'malabi' }); assert.equal(s().itemId, 'malabi'); assert.equal(s().open, 'dish'); assert.equal(s().categoryId, 'sweet');
  st.dispatch({ type: 'escape' }); assert.equal(s().open, null); assert.equal(s().nav.kind, 'close'); st.dispatch({ type: 'escape' }); assert.equal(s().nav.kind, 'close', 'nothing open: Esc does nothing');
  st.dispatch({ type: 'open', what: 'list' }); assert.equal(s().open, 'list'); st.dispatch({ type: 'focus', id: 'ipa' }); assert.equal(s().open, 'list', 'an unknown dish changes nothing');
  st.dispatch({ type: 'focus', id: 'beer-ipa' }); assert.equal(s().open, null, 'a row of the list flies to its dish and closes the list'); assert.equal(s().categoryId, 'beer');
  st.dispatch({ type: 'open', what: 'tray' }); st.dispatch({ type: 'open', what: 'list' }); assert.equal(s().open, 'list'); st.dispatch({ type: 'close' }); assert.equal(s().open, null);
  st.dispatch({ type: 'open', what: 'cellar' }); assert.equal(s().open, null);
  st.dispatch({ type: 'setSimple', on: true }); st.dispatch({ type: 'open', what: 'list' }); assert.equal(s().open, null, 'without the table the list is already the page');
  st.dispatch({ type: 'open', what: 'dish', id: 'hummus' }); assert.equal(s().open, 'dish'); ok(s());
});

test('how each kind of item is shown, and what is called an illustration', () => {
  const it = (id) => model.itemById.get(id), p = (id) => presentation(it(id).item, it(id).cat.raw.kind);
  assert.deepEqual(p('hummus'), { type: 'relief', pourable: false, illustration: false, holo: false, turns: true });
  assert.equal(p('lasagne').type, 'photo'); assert.equal(p('bread').type, 'text'); assert.equal(p('lemonade').type, 'stand');
  assert.deepEqual([p('wine-red').type, p('wine-red').illustration, p('wine-red').holo], ['drink', true, false], 'a drawn bottle is an illustration, but not a projection');
  const stock = { id: 's', name: { he: 'פיצה', en: 'Pizza' }, asset: { state: 'relief', stock: 'pizza', e: 53, h: .06, o: null, s: null } };
  assert.deepEqual(presentation(stock, 'food'), { type: 'relief', pourable: false, illustration: true, holo: true, turns: true }, 'a placeholder: a projection, labelled');
  assert.deepEqual(presentation(Object.assign({}, stock, { details: { wine: { color: 'red' } } }), 'wine'), { type: 'relief', pourable: false, illustration: true, holo: true, turns: true }, 'and nothing is drawn or poured beside it');
  assert.equal(presentation({ id: 'u', name: {}, asset: { state: 'stock', id: 'pizza' } }, 'food').type, 'text', 'until the library has answered, a placeholder is no picture');
});

test('sold out is never addable; totals stay in minor units', () => {
  const st = fresh();
  st.dispatch({ type: 'trayAdd', id: 'fish-soup' }); assert.deepEqual(st.getState().tray, {});
  st.dispatch({ type: 'trayAdd', id: 'hummus' }); st.dispatch({ type: 'trayAdd', id: 'hummus' }); st.dispatch({ type: 'trayAdd', id: 'sea-bream' });
  assert.deepEqual(st.getState().tray, { hummus: 2, 'sea-bream': 1 });
  const total = Object.entries(st.getState().tray).reduce((n, [id, q]) => n + q * model.itemById.get(id).item.price.amount, 0);
  assert.equal(total, 2 * 3600 + 12800); assert.ok(Number.isInteger(total));
  st.dispatch({ type: 'traySet', id: 'hummus', qty: 0 }); assert.deepEqual(st.getState().tray, { 'sea-bream': 1 });
  st.dispatch({ type: 'trayClear' }); assert.deepEqual(st.getState().tray, {});
  assert.deepEqual(initialState(model, { tray: { hummus: 3, 'fish-soup': 2, gone: 1 } }).tray, { hummus: 3 }, 'what was kept on the phone is checked against today\'s menu');
});

test('addresses: #c=&i= names the dish in focus, &o= what is open; old and dead links still open the menu', () => {
  model.cats.forEach((c) => c.ids.forEach((id) => {
    const s = initialState(model, { route: parseHash(formatHash({ c: c.id, i: id })) });
    assert.equal(s.itemId, id); assert.equal(s.categoryId, c.id); assert.equal(s.open, null); ok(s);
    assert.deepEqual(parseHash(formatHash(routeOf(s))), { c: c.id, i: id });
  }));
  assert.equal(initialState(model, { route: parseHash('#c=wine') }).itemId, 'wine-white', 'a link to a category: its first dish');
  assert.equal(initialState(model, { route: parseHash('#c=nope&i=gone') }).itemId, 'labaneh', 'a dead link opens the menu, not an error');
  assert.equal(initialState(model, { route: parseHash('#c=wine&i=hummus') }).categoryId, 'starters', 'the dish decides its category');
  let s = initialState(model, { route: parseHash('#c=mains&i=kebab&o=1') }); assert.equal(s.open, 'dish'); assert.equal(formatHash(routeOf(s)), '#c=mains&i=kebab&o=1');
  s = initialState(model, { route: parseHash('#c=mains&i=kebab&o=list') }); assert.equal(s.open, 'list'); assert.equal(initialState(model, { simple: true, route: parseHash('#c=mains&i=kebab&o=list') }).open, null);
  assert.equal(initialState(model, { route: parseHash('#c=mains&i=kebab&o=nonsense') }).open, null);
  assert.deepEqual(parseHash(formatHash({ c: 'a b&c=d', i: 'x#y', o: 'tray' })), { c: 'a b&c=d', i: 'x#y', o: 'tray' });
});

test('history plan: gliding replaces the address, opening adds an entry, closing goes back to it', () => {
  const a = initialState(model), g = reduce(a, { type: 'step', dir: 1 }, model), c = reduce(a, { type: 'stepCategory', dir: 1 }, model), o = reduce(g, { type: 'open', what: 'dish' }, model);
  assert.equal(planFromUrl(routeOf(a), g, null), 'replace'); assert.equal(planFromUrl(routeOf(a), c, null), 'replace'); assert.equal(planFromUrl(routeOf(g), o, null), 'push');
  assert.equal(planFromUrl(routeOf(o), g, '#c=starters&i=hummus'), 'back'); assert.equal(planFromUrl(routeOf(o), g, null), 'replace', 'opened by a link: there is nothing to go back to');
  assert.equal(planFromUrl(routeOf(o), reduce(o, { type: 'open', what: 'tray' }, model), '#x'), 'replace'); assert.equal(planFromUrl(routeOf(a), reduce(a, { type: 'setLang', lang: 'en' }, model), null), 'none');
});

test('Back closes what is open and otherwise leaves the menu in one press, however far the guest has walked', async () => {
  const br = fakeBrowser(''), st = fresh({ lang: 'en' }); bindHistory(st, br);
  assert.equal(br.location.hash, '#c=starters&i=labaneh');
  for (let i = 0; i < 12; i++) st.dispatch({ type: 'step', dir: 1 }); st.dispatch({ type: 'setCategory', id: 'wine' }); st.dispatch({ type: 'swipe', sx: 1 });
  assert.equal(br.entries.length, 1, 'walking and changing table never piles up history'); assert.equal(br.location.hash, '#c=sweet&i=cheesecake');
  st.dispatch({ type: 'open', what: 'dish' }); assert.equal(br.entries.length, 2); assert.equal(br.location.hash, '#c=sweet&i=cheesecake&o=1');
  st.dispatch({ type: 'step', dir: 1 }); assert.equal(br.entries.length, 2); assert.equal(br.location.hash, '#c=sweet&i=knafeh&o=1');
  br.history.back(); await flush();
  let s = st.getState(); assert.equal(s.open, null); assert.equal(s.itemId, 'knafeh', 'Back puts the dish down; the guest stays where they are'); assert.equal(br.location.hash, '#c=sweet&i=knafeh'); assert.equal(br.at, 0);
  st.dispatch({ type: 'open', what: 'list' }); st.dispatch({ type: 'focus', id: 'kebab' }); await flush(); await flush();
  assert.equal(st.getState().open, null); assert.equal(br.at, 0, 'a row of the list closes it the way Back would'); assert.equal(br.location.hash, '#c=mains&i=kebab');
  st.dispatch({ type: 'open', what: 'tray' }); st.dispatch({ type: 'close' }); await flush(); assert.equal(br.at, 0); assert.equal(br.location.hash, '#c=mains&i=kebab');
  br.history.back(); await flush(); assert.equal(br.left, true, 'nothing open: one Back leaves the menu');
  br.history.forward(); await flush(); assert.equal(st.getState().open, 'tray', 'and Forward brings back what was open');
});

test('a link straight into an open dish: closing it rewrites the entry instead of leaving the site', async () => {
  const br = fakeBrowser('#c=sweet&i=malabi&o=1'), st = createStore(model, initialState(model, { route: parseHash('#c=sweet&i=malabi&o=1') })); bindHistory(st, br);
  assert.equal(st.getState().open, 'dish'); st.dispatch({ type: 'close' }); await flush();
  assert.equal(br.left, false); assert.equal(br.location.hash, '#c=sweet&i=malabi'); assert.equal(br.entries.length, 1);
});

test('actions fired while our own Back is in flight are not lost', async () => {
  const br = fakeBrowser(''), st = fresh({ lang: 'en' }); bindHistory(st, br);
  st.dispatch({ type: 'open', what: 'dish' });
  st.dispatch({ type: 'close' }); st.dispatch({ type: 'open', what: 'dish', id: 'caesar' });      // same tick: Back has not landed yet
  await flush(); await flush();
  assert.equal(st.getState().itemId, 'caesar'); assert.equal(st.getState().open, 'dish'); assert.equal(br.location.hash, '#c=starters&i=caesar&o=1');
  br.history.back(); await flush(); assert.equal(st.getState().open, null); assert.equal(br.location.hash, '#c=starters&i=caesar');
});

test('fuzz: 5,000 random actions, state always valid, label always the dish, history never grows past one open thing', async () => {
  let seed = 20261007; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }, pick = (a) => a[Math.floor(rnd() * a.length)];
  const allItems = [...model.itemById.keys()], allCats = model.cats.map((c) => c.id);
  const br = fakeBrowser(''), st = fresh(); bindHistory(st, br);
  let label = null; st.subscribe((s) => { const v = select(s, model); label = { name: v.itemName, cat: v.categoryName, id: s.itemId, c: s.categoryId }; });   // what a view would paint
  const acts = [
    () => ({ type: 'step', dir: pick([-1, 1]) }), () => ({ type: 'step', dir: pick([-1, 1]) }), () => ({ type: 'step', dir: pick([-1, 1]), by: 3 }), () => ({ type: 'swipe', sx: pick([-1, 1]) }), () => ({ type: 'arrow', key: pick(['ArrowLeft', 'ArrowRight']) }),
    () => ({ type: 'focus', id: pick(allItems) }), () => ({ type: 'focus', id: pick(allItems), keep: true }), () => ({ type: 'open', what: pick(['dish', 'list', 'tray', 'x']) }), () => ({ type: 'open', what: 'dish', id: pick(allItems) }),
    () => ({ type: 'close' }), () => ({ type: 'escape' }), () => ({ type: 'stepCategory', dir: pick([-1, 1]) }), () => ({ type: 'setCategory', id: pick(allCats) }), () => ({ type: 'home' }), () => ({ type: 'end' }), () => ({ type: 'pourAgain' }),
    () => ({ type: 'setLang', lang: pick(['he', 'en', 'fr']) }), () => ({ type: 'setSimple', on: rnd() < 0.3 }),
    () => ({ type: 'trayAdd', id: pick(allItems) }), () => ({ type: 'traySet', id: pick(allItems), qty: Math.floor(rnd() * 3) }), () => ({ type: 'route', route: { c: pick(allCats.concat(['x'])), i: rnd() < 0.5 ? pick(allItems.concat(['y'])) : undefined, o: pick([undefined, '1', 'list', 'tray', 'zz']) } }),
    () => ({ type: 'focus', id: 'missing' }), () => ({ type: 'setCategory', id: 'missing' }), () => ({ type: 'nonsense' })
  ];
  let backs = 0, pours = 0, opened = 0;
  for (let n = 0; n < 5000; n++) {
    const before = st.getState();
    if (rnd() < 0.06) { br.history.back(); backs++; if (rnd() < 0.5) await flush(); }        // Back, sometimes with more actions landing before it does
    else {
      const a = pick(acts)(); st.dispatch(a); const s = st.getState();
      if (a.type === 'pourAgain' && s.pourSeq !== before.pourSeq) { pours++; assert.equal(before.open, 'dish'); assert.ok(presentation(model.itemById.get(s.itemId).item, model.catById.get(s.categoryId).raw.kind).pourable); }
      if (a.type === 'swipe' && before.open) assert.equal(s.categoryId, before.categoryId, 'a swipe never changes table under something open');
      if (s.open && !before.open) opened++;
    }
    if (rnd() < 0.3) await flush();
    const s = st.getState(); assert.deepEqual(checkState(s, model), [], 'step ' + n);
    JSON.parse(JSON.stringify(s));                                                        // serialisable
    assert.ok(br.entries.length <= 2, 'history holds at most the menu and the one thing open on it: ' + br.entries.length);
    if (label) { assert.equal(label.id, s.itemId); assert.equal(label.c, s.categoryId);
      assert.equal(label.name, tx(model.itemById.get(s.itemId).item.name, s.lang)); assert.equal(label.cat, tx(model.catById.get(s.categoryId).raw.name, s.lang)); }
  }
  await flush(); await flush(); await flush();
  if (!br.left) assert.equal(br.location.hash, formatHash(routeOf(st.getState())), 'the URL ends up on the state');
  assert.ok(backs > 100 && opened > 300 && pours > 0, `backs ${backs}, opened ${opened}, pours ${pours}`);
});
