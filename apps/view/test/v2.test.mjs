/* The guest menu on the v2 clean schema (src/v2/): the reader of public_menu, the sheet's choices, the basket, the
   events and the suggestion wiring, on the contracts' synthetic Café Demo. What the contracts decide (prices, limits,
   availability, which rule wins) has its own tests in packages/contracts; these check that the menu uses them right. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { cafeDemo, liveOf, ID } from '@mana/contracts/fixtures';
import { EVENT_PROPS, defaultSelection, priceDish, validateBatch } from '@mana/contracts';
import { text, asset, assetUrl, details, httpsUrl } from '../src/snapshot.js';
import { ROOM_IDS } from '../src/scenes/rooms.js';
import { buildModel, checkState, createStore, initialState } from '../src/store.js';
import { closedText, filtered, filteredOut, loadMenu, poll, readLive, setLive, toModel } from '../src/v2/menu.js';
import { chosenList, deadOpeners, issues, qtyOf, runningPrice, selectionKey, setOption, startOf } from '../src/v2/choices.js';
import { addLine, counts, lineOf, priced, readLines, removeLine, replaceSelection, room, setQuantity, splitOne, storedLines } from '../src/v2/basket.js';
import { createEvents, isoAt, newId } from '../src/v2/events.js';
import { createVisit } from '../src/v2/visit.js';
import { isV2 } from '../src/v2/guest.js';
import { word } from '../src/v2/i18n.js';

const kit = { text, asset, assetUrl, details, httpsUrl, rooms: ROOM_IDS };
const at = (iso) => Date.parse(iso);
const WED_0900 = at('2026-10-14T06:00:00Z');                     // a Wednesday, 09:00 in Jerusalem (summer time, +03:00)
const menuAt = (now = WED_0900, live = liveOf(), mutate = null) => { const s = cafeDemo(); if (mutate) mutate(s); return toModel(s, live, kit, now); };
const item = (m, id) => m.categories.flatMap((c) => c.items).find((i) => i.id === id);
const off = (kind, id, until = null, from = '2026-10-14T00:00:00Z') => ({ kind, id, from, until });

test('v2 normalization: the snapshot becomes the model the menu already draws, priced "from" where a required choice can cost more', () => {
  const m = menuAt();
  assert.deepEqual([m.v, m.slug, m.revision, m.business.name.en, m.business.soldOut, m.locale.default, m.theme.accent], [2, 'cafe-demo', 1, 'Café Demo', 'bottom', 'he', '#c8743c']);
  assert.deepEqual(m.categories.map((c) => [c.id, c.kind, c.items.map((i) => i.name.en)]), [
    [ID.morning, 'food', ['Shakshuka']], [ID.mains, 'food', ['Burger', 'Schnitzel']], [ID.drinks, 'drinks', ['Espresso', 'Lemonade']], [ID.pastries, 'dessert', ['Croissant', 'Friday cake']]
  ]);
  const price = (id) => { const p = item(m, id).price; return [p.amount, p.from]; };
  assert.deepEqual(price(ID.burger), [6800, true], 'a required side with a paid choice (sweet potato fries)');
  assert.deepEqual(price(ID.schnitzel), [6200, true]);
  assert.deepEqual(price(ID.espresso), [1200, true], 'a double costs more');
  assert.deepEqual(price(ID.shakshuka), [5400, false], 'a required choice whose options are all free');
  assert.deepEqual(price(ID.lemonade), [1600, false]);
  assert.deepEqual(item(m, ID.croissant).asset, { state: 'stock', id: 'croissant' }, 'a stock picture is resolved later, as in v1');
  const model = buildModel(m);
  assert.equal(model.order.length, 7); assert.equal(model.cats.length, 4);
  assert.equal(model.itemById.get(ID.fridayCake).cat.ids.at(-1), ID.fridayCake, 'not served now: at the end of its section, as sold out is in v1');
});

test('availability: the live overlay and the clock decide, with the reason in both languages', () => {
  const wed = menuAt();
  assert.equal(item(wed, ID.shakshuka).available, true, 'breakfast, 07:00–12:00');
  const cake = item(wed, ID.fridayCake);
  assert.deepEqual([cake.available, cake.availKind, cake.availLabel.en, cake.availLabel.he], [false, 'later', 'Served from Friday, 07:00', 'מוגש החל מיום שישי, 07:00']);
  const noon = menuAt(at('2026-10-14T10:00:00Z'));               // 13:00
  assert.deepEqual([item(noon, ID.shakshuka).available, item(noon, ID.shakshuka).availLabel.en], [false, 'Served from Thursday, 07:00']);

  const early = menuAt(at('2026-10-14T03:30:00Z'));              // 06:30: before opening
  assert.equal(early.v2.closed, true);
  assert.equal(closedText(early, 'en', at('2026-10-14T03:30:00Z')), 'Closed now · opens at 07:00');
  assert.equal(closedText(early, 'he', at('2026-10-14T03:30:00Z')), 'סגור כרגע · נפתח ב־07:00');
  assert.deepEqual([item(early, ID.burger).available, item(early, ID.shakshuka).availLabel.en], [true, 'Served from 07:00'], 'a view-only menu stays readable while closed');
  assert.equal(closedText(wed, 'en'), '');

  const k0 = wed.v2 && setLive(wed, liveOf(), WED_0900);
  const k1 = setLive(wed, liveOf([off('dish', ID.burger, '2026-10-14T11:30:00Z')]), WED_0900);
  const burger = item(wed, ID.burger);
  assert.notEqual(k1, k0, 'the redraw key changes when a dish goes off');
  assert.deepEqual([burger.available, burger.availKind, burger.availLabel.en, burger.availLabel.he], [false, 'off', 'Sold out · back at 14:30', 'אזל · חוזר ב־14:30']);
  assert.equal(setLive(wed, liveOf(), WED_0900), k0, 'and back when it returns');
  assert.equal(item(wed, ID.burger).available, true);
  const k2 = setLive(wed, liveOf([off('option', ID.sweetFries)]), WED_0900);
  assert.notEqual(k2, k0); assert.equal(item(wed, ID.burger).price.from, true, 'fries still open a required sauce with a paid choice');
  setLive(wed, liveOf([off('option', ID.sweetFries), off('option', ID.chipotle)]), WED_0900);
  assert.deepEqual([item(wed, ID.burger).available, item(wed, ID.burger).price.from], [true, false], 'every paid required choice is off: the price is plain again');
});

test('the live overlay and the snapshot are read as far as they are well formed; an invalid snapshot is refused', () => {
  const live = readLive({ at: 'nope', open: 'yes', off: [off('dish', ID.burger), { kind: 'table', id: ID.burger }, { kind: 'dish', id: 'not-a-uuid' }, null],
    hours: { weekly: [{ days: [1], from: '07:00', to: '23:00' }, { days: [9], from: '07:00', to: '23:00' }, { days: [1], from: '7am', to: '23:00' }], closures: [{ from: '2026-12-25', to: '2026-12-25' }, { from: 'xmas' }] } });
  assert.deepEqual(live.off.map((o) => o.id), [ID.burger]); assert.equal(live.open, null); assert.ok(!Number.isNaN(Date.parse(live.at)));
  assert.deepEqual(live.hours.weekly, [{ days: [1], from: '07:00', to: '23:00' }]); assert.deepEqual(live.hours.closures, [{ from: '2026-12-25', to: '2026-12-25' }]);
  assert.throws(() => menuAt(WED_0900, liveOf(), (s) => { s.sections[1].dishes[0].addons.push({ groupId: '00000000-0000-4000-8000-0000000000ff', min: 0, max: 1 }); }), /not a valid v2 menu: ref_unknown/);
  assert.throws(() => toModel({ v: 1, categories: [] }, liveOf(), kit), /not a valid v2 menu/);
  const pics = menuAt(WED_0900, liveOf(), (s) => { s.sections[1].dishes[0].asset = { state: 'photo', color: 'v/burger.jpg', thumb: 'v/burger-t.jpg' }; });
  assert.deepEqual(item(pics, ID.burger).asset, { state: 'photo', color: 'https://example.invalid/storage/v1/object/public/menu-public/v/burger.jpg', thumb: 'https://example.invalid/storage/v1/object/public/menu-public/v/burger-t.jpg' });
});

test('the tag filter: only matching dishes, sections with none left out; a vegan dish is vegetarian; what it hides is "filtered out"', () => {
  const m = menuAt(), names = (x) => x.categories.map((c) => [c.name.en, c.items.map((i) => i.name.en)]);
  assert.equal(filtered(m, []), m);
  assert.deepEqual(names(filtered(m, ['vegan'])), [['Drinks', ['Espresso', 'Lemonade']]]);
  assert.deepEqual(names(filtered(m, ['vegetarian'])), [['Breakfast', ['Shakshuka']], ['Drinks', ['Espresso', 'Lemonade']], ['Pastries', ['Croissant']]]);
  assert.deepEqual(filtered(m, ['vegan', 'spicy']).categories, []);
  assert.deepEqual([...filteredOut(m, ['vegan'])].sort(), [ID.shakshuka, ID.burger, ID.schnitzel, ID.croissant, ID.fridayCake].sort());
  assert.equal(filtered(m, ['vegan']).categories[0].items[0], item(m, ID.espresso), 'the same item objects: availability seen live stays one truth');
});

test('loadMenu and poll: public_menu with the publishable key; the three answers; a new revision is noticed', async () => {
  const calls = [], answers = {
    'cafe-demo': () => ({ state: 'ok', snapshot: cafeDemo(), live: liveOf() }), paused: () => ({ state: 'unavailable', venue: { name: { he: 'קפה', en: 'Café' } } }), gone: () => ({ state: 'not_found' }),
    newer: () => ({ state: 'ok', snapshot: Object.assign(cafeDemo(), { revision: 2 }), live: liveOf() })
  };
  const fetch = async (url, init) => { const body = JSON.parse(init.body); calls.push({ url, key: init.headers.apikey, body }); if (body.p_slug === 'broken') return { ok: false, status: 500 }; return { ok: true, status: 200, json: async () => answers[body.p_slug]() }; };
  const env = { fetch, config: { supabaseUrl: 'https://db.test/', supabaseKey: 'sb_publishable_test' } };
  const ok = await loadMenu('cafe-demo', env, kit, null, WED_0900);
  assert.equal(ok.state, 'ok'); assert.equal(ok.snapshot.v, 2);
  assert.deepEqual(calls[0], { url: 'https://db.test/rest/v1/rpc/public_menu', key: 'sb_publishable_test', body: { p_slug: 'cafe-demo' } });
  assert.deepEqual(await loadMenu('paused', env, kit), { state: 'unavailable', business: { name: { he: 'קפה', en: 'Café' } } });
  assert.deepEqual(await loadMenu('gone', env, kit), { state: 'not_found' });
  assert.deepEqual(await loadMenu('broken', env, kit), { state: 'error', message: 'HTTP 500' });
  assert.equal((await loadMenu('x', { fetch, config: {} }, kit)).state, 'error');
  assert.equal((await poll(ok.snapshot, env)).state, 'live');
  assert.equal((await poll(Object.assign({}, ok.snapshot, { slug: 'newer' }), env)).state, 'revision');
});

test('the sheet: the owner\'s defaults, a single choice replaces, an opener opens its group with its defaults, quantities up to the maximum', () => {
  const m = menuAt(), ctx = m.v2.ctx, burger = m.v2.menu.dishes.get(ID.burger), price = (sel) => runningPrice(burger, sel, ctx).unit;
  const s0 = startOf(burger, ctx);
  assert.deepEqual(chosenList(s0).map((c) => c.optionId), [ID.fries, ID.aioli], 'fries with aioli: the defaults, never an upsell');
  assert.equal(price(s0), 6800);
  const s1 = setOption(s0, ctx, { groupId: ID.side, optionId: ID.sweetFries });
  assert.deepEqual(chosenList(s1).map((c) => [c.optionId, c.parentOptionId]), [[ID.sweetFries, null], [ID.aioli, ID.sweetFries]], 'the side replaced; the sauce group it opens starts from its default');
  const s2 = setOption(s1, ctx, { groupId: ID.sauce, optionId: ID.chipotle, parentOptionId: ID.sweetFries });
  assert.equal(price(s2), 6800 + 800 + 200);
  const s3 = setOption(s2, ctx, { groupId: ID.extras, optionId: ID.cheese, qty: 5 });
  assert.equal(qtyOf(s3, ID.extras, ID.cheese), 2, 'never more than the option allows'); assert.equal(price(s3), 7800 + 800);
  assert.deepEqual(priceDish(burger, s3, ctx).unit, price(s3), 'complete: exactly priceDish');
  const s4 = setOption(s3, ctx, { groupId: ID.side, optionId: ID.salad });
  assert.ok(!chosenList(s4).some((c) => c.groupId === ID.sauce), 'the sauce went with the side that opened it');
  assert.equal(setOption(s4, ctx, { groupId: ID.sauce, optionId: ID.ketchup, parentOptionId: ID.sweetFries }), s4, 'no nested choice without its opener');
  assert.equal(selectionKey(s3), selectionKey({ quantity: 1, groups: [...s3.groups].reverse() }));

  const none = { quantity: 1, groups: [] };
  assert.deepEqual(issues(burger, none, ctx), { missing: [{ groupId: ID.side, parentOptionId: null, need: 1 }], off: [] });
  assert.equal(price(none), 6800, 'the running price before the side is chosen');
  const aioliOff = menuAt(WED_0900, liveOf([off('option', ID.aioli)]));
  assert.deepEqual(issues(burger, s0, aioliOff.v2.ctx).off, [ID.aioli]);
  assert.deepEqual(chosenList(startOf(burger, aioliOff.v2.ctx)).map((c) => c.optionId), [ID.fries], 'a sold-out default is not pre-selected; the guest picks the sauce');
});

test('the basket: the same choices add up, other choices are a line of their own; totals in agorot, VAT included; an unavailable line is marked and left out', () => {
  const m = menuAt(), ctx = m.v2.ctx, burger = m.v2.menu.dishes.get(ID.burger);
  const big = setOption(setOption(startOf(burger, ctx), ctx, { groupId: ID.side, optionId: ID.sweetFries }), ctx, { groupId: ID.sauce, optionId: ID.chipotle, parentOptionId: ID.sweetFries });
  let lines = addLine([], ID.burger, big, 1, { he: 'המבורגר', en: 'Burger' });
  lines = addLine(lines, ID.burger, { quantity: 1, groups: [...big.groups].reverse() });
  lines = addLine(lines, ID.lemonade, { quantity: 1, groups: [] });
  lines = addLine(lines, ID.burger, startOf(burger, ctx));
  assert.deepEqual(lines.map((l) => [l.key, l.quantity]), [['l1', 2], ['l2', 1], ['l3', 1]]);
  let P = priced(lines, m.v2.menu, ctx);
  assert.deepEqual([P.total, P.count, P.problems], [2 * 7800 + 1600 + 6800, 4, 0]);
  assert.equal(P.lines[0].total, priceDish(burger, Object.assign({}, big, { quantity: 2 }), ctx).total);
  assert.deepEqual(counts(lines), { [ID.burger]: 3, [ID.lemonade]: 1 });
  lines = replaceSelection(lines, 'l3', big);
  assert.deepEqual(lines.map((l) => [l.key, l.quantity]), [['l1', 3], ['l2', 1]], 'changed to the same choices as another line: one line');
  assert.equal(lineOf(lines, ID.burger, big).key, 'l1');
  assert.deepEqual(setQuantity(lines, 'l2', 0).map((l) => l.key), ['l1']); assert.deepEqual(removeLine(lines, 'l1').map((l) => l.key), ['l2']);

  const off1 = menuAt(WED_0900, liveOf([off('dish', ID.lemonade)]));
  P = priced(lines, off1.v2.menu, off1.v2.ctx);
  assert.deepEqual(P.lines.map((x) => [x.ok, x.why]), [[true, undefined], [false, 'off']]); assert.equal(P.total, 3 * 7800); assert.equal(P.problems, 1);
  const off2 = menuAt(WED_0900, liveOf([off('option', ID.chipotle)]));
  assert.deepEqual(priced(lines, off2.v2.menu, off2.v2.ctx).lines.map((x) => [x.why, x.optionId]), [['option', ID.chipotle], [undefined, undefined]]);
  const gone = addLine([], '00000000-0000-4000-8000-00000000d0ff', { quantity: 1, groups: [] });
  assert.equal(priced(gone, m.v2.menu, ctx).lines[0].why, 'gone');

  const back = readLines(JSON.parse(JSON.stringify(storedLines(lines))));
  assert.deepEqual(back, lines.map((l) => Object.assign({}, l, { name: l.name ?? null })));
  assert.deepEqual(readLines({ lines: [{ n: 1, dishId: 'x', quantity: 1 }, { n: 2, dishId: ID.burger, quantity: 0 }, { n: 3, dishId: ID.burger, quantity: 1, selection: { groups: [{ groupId: ID.side, options: [{ optionId: 'nope' }] }] } }, { n: 3, dishId: ID.lemonade, quantity: 1 }] }),
    [{ key: 'l3', n: 3, dishId: ID.burger, name: null, selection: { quantity: 1, groups: [{ groupId: ID.side, options: [] }] }, quantity: 1 }], 'what is not well formed is dropped');
  assert.deepEqual(readLines(null), []);
});

test('the store mirrors the basket\'s counts per dish (traySync), every line counted: also one the filter hides', () => {
  const m = menuAt(), model = buildModel(filtered(m, ['vegan'])), store = createStore(model, initialState(model));
  assert.equal(model.itemById.has(ID.burger), false, 'the vegan filter hides the burger');
  store.dispatch({ type: 'traySync', tray: { [ID.burger]: 2, [ID.lemonade]: 0, [ID.espresso]: 1 } });
  assert.deepEqual(store.getState().tray, { [ID.burger]: 2, [ID.espresso]: 1 }, '"my table" still counts the burger (badge: 3)');
  const s = store.getState(); store.dispatch({ type: 'traySync', tray: { [ID.burger]: 2, [ID.espresso]: 1 } });
  assert.equal(store.getState(), s, 'the same counts: no new state, no redraw');
});

test('an add-on accepted after an add changes one unit of the line, never the whole line', () => {
  const m = menuAt(), g = m.v2, burger = g.menu.dishes.get(ID.burger), plain = startOf(burger, g.ctx);
  let lines = addLine(addLine(addLine([], ID.burger, plain), ID.burger, plain), ID.burger, plain);
  assert.deepEqual(lines.map((l) => l.quantity), [3]);
  const egg = setOption(plain, g.ctx, { groupId: ID.extras, optionId: ID.egg });
  lines = splitOne(lines, 'l1', egg);
  assert.deepEqual(lines.map((l) => [l.key, l.quantity, qtyOf(l.selection, ID.extras, ID.egg)]), [['l1', 2, 0], ['l2', 1, 1]]);
  const P = priced(lines, g.menu, g.ctx);
  assert.equal(P.total, 3 * 6800 + 500, 'one egg, not three');
  lines = splitOne(lines, 'l1', egg);                          // the same again: it joins the line that has the egg
  assert.deepEqual(lines.map((l) => [l.key, l.quantity]), [['l1', 1], ['l2', 2]]);
  lines = splitOne(lines, 'l1', egg);                          // the last plain one: the lines become one
  assert.deepEqual(lines.map((l) => [l.key, l.quantity]), [['l2', 3]]);
  assert.equal(splitOne(lines, 'nope', egg), lines);
});

test('an opener whose own required group ran out: named dead, never a default, its nested defaults one level only', () => {
  const m = menuAt(WED_0900, liveOf([off('option', ID.aioli), off('option', ID.ketchup), off('option', ID.chipotle)])), g = m.v2, burger = g.menu.dishes.get(ID.burger);
  assert.deepEqual([...g.dead].sort(), [ID.fries, ID.sweetFries].sort(), 'fries and sweet potato open the sauce, and no sauce is left');
  assert.deepEqual(deadOpeners(menuAt().v2.ctx).size, 0);
  const start = startOf(burger, g.ctx);
  assert.deepEqual(start.groups[0], { groupId: ID.side, options: [] }, 'the sheet does not start on fries');
  assert.deepEqual(issues(burger, start, g.ctx).missing.map((x) => x.groupId), [ID.side], 'the guest chooses the salad');
  assert.ok(priceDish(burger, setOption(start, g.ctx, { groupId: ID.side, optionId: ID.salad }), g.ctx).ok);
  assert.equal(item(m, ID.burger).available, true, 'the salad still makes the burger orderable');
  // with only aioli (the default sauce) off, choosing fries opens the sauce with nothing pre-selected
  const m2 = menuAt(WED_0900, liveOf([off('option', ID.aioli)])), f = setOption({ quantity: 1, groups: [] }, m2.v2.ctx, { groupId: ID.side, optionId: ID.fries });
  assert.deepEqual(f.groups[0].options[0].nested, [{ groupId: ID.sauce, options: [] }]);
});

test('a suggestion on screen is checked again: sold out, filtered out, chosen meanwhile, or in the basket now, it goes', () => {
  const m = menuAt(), g = m.v2, burger = g.menu.dishes.get(ID.burger), nothing = new Set(), sel = startOf(burger, g.ctx);
  const base = { basket: [], unavailable: g.unavailable, filteredOut: nothing, now: WED_0900 };
  const v = createVisit(g.snap.upsellRules, g.menu);
  v.offer('sheet', Object.assign({ dishId: ID.burger, selection: sel, where: 'sheet' }, base));
  assert.equal(v.still(Object.assign({ selection: sel }, base)), true, 'nothing changed: it stays');
  assert.equal(v.pending.ruleId, ID.ruleCheese);
  assert.deepEqual(v.memory().shown, { [ID.ruleCheese]: 1 }, 'checking again is not showing again');
  const cheeseOff = menuAt(WED_0900, liveOf([off('option', ID.cheese)])).v2.unavailable;
  assert.equal(v.still(Object.assign({}, base, { selection: sel, unavailable: cheeseOff })), false, 'cheese sold out while shown');
  assert.equal(v.pending, null);

  v.offer('sheet', Object.assign({ dishId: ID.burger, selection: sel }, base));            // its second showing (cap 2)
  assert.equal(v.still(Object.assign({}, base, { selection: sel })), true, 'at its cap, the one on screen still qualifies');
  const chosen = setOption(sel, g.ctx, { groupId: ID.extras, optionId: ID.cheese });
  assert.equal(v.still(Object.assign({}, base, { selection: chosen })), false, 'the guest chose cheese themselves');

  const v2 = createVisit(g.snap.upsellRules, g.menu), mains = [{ dishId: ID.burger }];
  v2.offer('checkout', Object.assign({}, base, { basket: mains, where: 'tray' }));
  assert.equal(v2.pending.ruleId, ID.ruleLemonade);
  assert.equal(v2.still(Object.assign({}, base, { basket: mains, tags: ['vegetarian'] })), true, 'a vegan lemonade passes "vegetarian"');
  assert.equal(v2.still(Object.assign({}, base, { basket: mains, tags: ['spicy'] })), false, 'the filter now hides the lemonade');
  v2.offer('checkout', Object.assign({}, base, { basket: mains }));
  assert.equal(v2.pending, null, 'cap 1: shown once this visit');
  const v3 = createVisit(g.snap.upsellRules, g.menu);
  v3.offer('checkout', Object.assign({}, base, { basket: mains }));
  assert.equal(v3.still(Object.assign({}, base, { basket: mains.concat({ dishId: ID.lemonade }) })), false, 'a lemonade is on the table now');
});

test('events: the contract\'s props only, an offset in every time, batches of 50, a failed send retried with the same ids, a refused one not', async () => {
  assert.equal(isoAt(at('2026-10-14T06:00:00.000Z'), 'Asia/Jerusalem'), '2026-10-14T09:00:00.000+03:00');
  assert.equal(isoAt(at('2026-12-01T10:00:00.250Z'), 'Asia/Jerusalem'), '2026-12-01T12:00:00.250+02:00');
  assert.match(newId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const sent = [], timers = { set: () => 1, clear: () => {} };
  let answer = { ok: true, status: 200 };
  const ev = createEvents({ venueId: ID.venue, tz: 'Asia/Jerusalem', now: () => Date.now(), timers, send: async (batch) => { sent.push(batch.map((e) => e.id)); if (answer === 'throw') throw new Error('offline'); return answer; } });
  ev.emit('menu_opened', { src: 'qr', lang: 'he', revision: 1, name: 'Dana', extra: 1 });
  assert.throws(() => ev.emit('dish_viewed', {}), /dishId is missing/);
  for (let i = 0; i < 119; i++) ev.emit('dish_viewed', { dishId: ID.burger });
  answer = 'throw';
  await ev.flush();
  assert.equal(ev.pending(), 120, 'offline: nothing is lost');
  answer = { ok: false, status: 503 };
  await ev.flush();
  answer = { ok: true, status: 200 };
  await ev.drained();
  assert.deepEqual(sent.map((b) => b.length), [50, 50, 50, 50, 20]);
  assert.deepEqual(sent[0], sent[1], 'the same ids again'); assert.deepEqual(sent[1], sent[2]);
  assert.equal(new Set(sent.slice(2).flat()).size, 120, 'every event once in the batches that went through');
  answer = { ok: false, status: 400 };
  ev.emit('dish_viewed', { dishId: ID.burger }); await ev.flush();
  assert.equal(ev.pending(), 0, 'refused: not retried');
});

test('the event queue never stops: a flush with nothing queued leaves no send behind (real timers)', async () => {
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (cond, what) => { for (let i = 0; i < 400 && !cond(); i++) await pause(5); assert.ok(cond(), what); };
  const sent = [], gates = [];
  const ev = createEvents({ venueId: ID.venue, tz: 'Asia/Jerusalem', delay: 5, send: (batch) => new Promise((r) => { sent.push(batch.map((e) => e.name)); gates.push(() => r({ ok: true, status: 200 })); }) });
  const open = () => gates.splice(0).forEach((g) => g());
  const idle = { queued: 0, sending: false, failures: 0, waiting: false };

  // 1. the page is hidden with nothing queued (visibilitychange → flush with keepalive), then the guest goes on
  await ev.flush({ keepalive: true });
  assert.deepEqual(ev.state(), idle, 'nothing left behind');
  ev.emit('dish_viewed', { dishId: ID.burger });
  await until(() => sent.length === 1, 'its own delay timer sends it');
  open(); await ev.drained();
  assert.deepEqual(ev.state(), idle);

  // 2. an event queued while a batch is out: the loop sends it too, then that event's delay timer finds the queue empty
  ev.emit('menu_opened', { src: 'qr', lang: 'he', revision: 1 });
  await until(() => sent.length === 2, 'the first batch goes out');
  ev.emit('basket_added', { dishId: ID.burger, qty: 1, fromSuggestion: false });
  open(); await until(() => sent.length === 3, 'the loop sends the second');
  open(); await pause(30);                                      // the second delay timer fires on an empty queue
  assert.deepEqual(ev.state(), idle);
  ev.emit('suggestion_shown', { ruleId: ID.ruleCheese, trigger: 'sheet', dishId: ID.burger });
  await until(() => sent.length === 4, 'a later event is still sent by itself');
  open(); await ev.drained();
  assert.deepEqual(sent, [['dish_viewed'], ['menu_opened'], ['basket_added'], ['suggestion_shown']]);
  assert.deepEqual(ev.state(), idle);
});

test('every event the queue builds passes the contracts\' validateBatch, with no field for a person', async () => {
  let batch = null;
  const ev = createEvents({ venueId: ID.venue, tz: 'Asia/Jerusalem', timers: { set: () => 1, clear: () => {} }, send: async (b) => { batch = b; return { ok: true, status: 200 }; } });
  const props = {
    menu_opened: { src: 'link', lang: 'en', revision: 1 }, dish_viewed: { dishId: ID.burger }, addon_chosen: { dishId: ID.burger, groupId: ID.sauce, optionId: ID.chipotle, parentOptionId: ID.sweetFries },
    basket_added: { dishId: ID.burger, qty: 1, fromSuggestion: false }, suggestion_shown: { ruleId: ID.ruleCheese, trigger: 'sheet', dishId: ID.burger },
    suggestion_accepted: { ruleId: ID.ruleCheese, trigger: 'sheet', dishId: ID.burger }, suggestion_dismissed: { ruleId: ID.ruleLemonade, trigger: 'checkout', dishId: null }
  };
  for (const [name, p] of Object.entries(props)) ev.emit(name, p);
  await ev.flush();
  const r = validateBatch(batch);
  assert.equal(r.ok, true); assert.deepEqual([r.value.accepted.length, r.value.rejected, r.value.duplicates], [7, [], 0]);
  for (const e of batch) { assert.deepEqual(Object.keys(e), ['id', 'name', 'venueId', 'at', 'props']); assert.deepEqual(Object.keys(e.props), Object.keys(EVENT_PROPS[e.name])); }
});

test('suggestion wiring: counted once when shown, a dismissed rule stays quiet, an ignored one may return up to its cap, nothing follows an accepted one', () => {
  const m = menuAt(), g = m.v2, burger = g.menu.dishes.get(ID.burger), nothing = new Set();
  const ask = (visit, trigger, o) => visit.offer(trigger, Object.assign({ basket: [], unavailable: g.unavailable, filteredOut: nothing, now: WED_0900 }, o));
  const v = createVisit(g.snap.upsellRules, g.menu);
  assert.equal(ask(v, 'sheet', { dishId: ID.burger, selection: startOf(burger, g.ctx), where: 'sheet' }).ruleId, ID.ruleCheese);
  assert.deepEqual(v.memory().shown, { [ID.ruleCheese]: 1 });
  v.drop();
  assert.equal(ask(v, 'sheet', { dishId: ID.burger, selection: startOf(burger, g.ctx) }).seen, 2, 'ignored, it may come back');
  assert.equal(ask(v, 'sheet', { dishId: ID.burger, selection: startOf(burger, g.ctx) }), null, 'its cap (2) holds for the visit');
  assert.equal(v.pending, null);

  const v2 = createVisit(g.snap.upsellRules, g.menu);
  ask(v2, 'sheet', { dishId: ID.burger, selection: startOf(burger, g.ctx) });
  assert.equal(v2.dismiss().ruleId, ID.ruleCheese);
  assert.equal(ask(v2, 'sheet', { dishId: ID.burger, selection: startOf(burger, g.ctx) }), null, 'dismissed: quiet for the rest of the visit');
  assert.deepEqual(v2.memory().dismissed, [ID.ruleCheese]);

  const v3 = createVisit(g.snap.upsellRules, g.menu), espresso = [{ dishId: ID.espresso }];
  assert.equal(ask(v3, 'add', { dishId: ID.espresso, basket: espresso, fromSuggestion: true }), null, 'after an accepted suggestion nothing follows');
  assert.equal(ask(v3, 'add', { dishId: ID.espresso, basket: espresso, filteredOut: new Set([ID.croissant]) }), null, 'never what the filter hides');
  assert.equal(ask(v3, 'add', { dishId: ID.espresso, basket: espresso, tags: ['vegan'] }), null, 'the guest\'s tags, through the contracts\' passesTagFilter: the croissant is only vegetarian');
  assert.equal(ask(createVisit(g.snap.upsellRules, g.menu), 'add', { dishId: ID.espresso, basket: espresso, tags: ['vegetarian'] }).ruleId, ID.ruleCroissant, 'vegetarian: it passes');
  const p = ask(v3, 'add', { dishId: ID.espresso, basket: espresso, where: 'float', lineKey: 'l1' });
  assert.deepEqual([p.ruleId, p.where, p.lineKey], [ID.ruleCroissant, 'float', 'l1']);
  assert.equal(v3.accept().ruleId, ID.ruleCroissant); assert.equal(v3.pending, null);
  assert.equal(ask(v3, 'checkout', { basket: [{ dishId: ID.burger }] }).ruleId, ID.ruleLemonade);
  assert.equal(ask(v3, 'checkout', { basket: [{ dishId: ID.burger }, { dishId: ID.lemonade }] }), null, 'never what is in the basket');
});

test('the schema switch is the contracts\' configFlags; "from" joins the price after the Hebrew maqaf', () => {
  assert.equal(isV2({ env: 'local', schema: 2 }), true);
  assert.equal(isV2({ env: 'demo', schema: 2 }), true);
  assert.equal(isV2({ schema: 2 }), false, 'no env means production, and production is never 2 before the cutover');
  assert.equal(isV2({ env: 'production', schema: 2 }), false);
  assert.equal(isV2({ env: 'local' }), false, 'absent = 1');
  assert.equal(isV2({ env: 'local', schema: '2' }), false, 'a broken value is the default');
  assert.equal(word('he', 'fromPrefix') + '68 ₪', 'החל מ־68 ₪');
  assert.equal(word('en', 'fromPrefix') + '₪68', 'from ₪68');
});

test('closed: a view-only menu stays readable; a menu that takes orders does not take them while the venue is closed (the contracts\' rule)', () => {
  const t = at('2026-10-14T03:30:00Z');                          // Wednesday 06:30: Café Demo opens at 07:00
  const view = menuAt(t), orders = menuAt(t, liveOf(), (s) => { s.venue.mode = 'standalone'; });
  assert.equal(item(view, ID.burger).available, true, 'view only: readable');
  const b = item(orders, ID.burger);
  assert.deepEqual([b.available, b.availKind, b.availLabel.en, b.availLabel.he], [false, 'later', 'Served from 07:00', 'מוגש החל מ־07:00']);
  assert.equal(orders.v2.unavailable.dishes.has(ID.burger), true, 'so it is never priced, added or suggested');
  const open = menuAt(at('2026-10-14T06:00:00Z'), liveOf(), (s) => { s.venue.mode = 'standalone'; });
  assert.equal(item(open, ID.burger).available, true);
});

test('a line holds at most LIMITS.lineQuantity: room() says how many more fit, so an add, a change or a split past it is refused', () => {
  const m = menuAt(), g = m.v2, burger = g.menu.dishes.get(ID.burger), plain = startOf(burger, g.ctx), egg = setOption(plain, g.ctx, { groupId: ID.extras, optionId: ID.egg });
  let lines = addLine([], ID.burger, plain, 50);
  lines = addLine(lines, ID.burger, egg, 2);
  assert.equal(room(lines, ID.burger, plain), 0, 'the plain line is full');
  assert.equal(room(lines, ID.burger, egg), 48);
  assert.equal(room(lines, ID.burger, plain, 'l1'), 50, 'the line being changed does not count');
  assert.equal(room(lines, ID.burger, plain, 'l2') < 2, true, 'the egg line changed to plain would not fit: refused, never 52 → 50');
  assert.equal(room([], ID.lemonade, { quantity: 1, groups: [] }), 50);
});

test('the store\'s invariants agree with traySync: in schema 2 the tray may hold a dish the filter hides', () => {
  const v2model = buildModel(filtered(menuAt(), ['vegan']));
  const s = Object.assign(initialState(v2model), { tray: { [ID.burger]: 2, [ID.espresso]: 1 } });
  assert.deepEqual(checkState(s, v2model), []);
  assert.deepEqual(checkState(Object.assign({}, s, { tray: { [ID.burger]: 0 } }), v2model), ['tray entry invalid']);
  assert.deepEqual(checkState(Object.assign({}, s, { tray: { [ID.burger]: 1.5 } }), v2model), ['tray entry invalid']);
});

test('the dead-opener rule and the nested start are the contracts\' own: deadOpeners and setOption agree with defaultSelection on every shape', () => {
  // a group of four openers (two into a required group of min 2 with a 2-unit option, one into an optional group, one
  // plain), every combination of options off: each opener is dead exactly when defaultSelection skips it, and the nested
  // group an opener starts with is exactly defaultSelection's
  const id = (n) => `00000000-0000-4000-8000-00000000c${String(n).padStart(3, '0')}`;
  const o = (n, extra = {}) => ({ id: id(n), name: { he: 'א', en: 'o' + n }, price: 100 * n, maxQty: 1, default: false, opensGroupId: null, ...extra });
  const dips = { id: id(900), name: { he: 'א', en: 'Dips' }, selection: 'multiple', min: 2, max: 3, options: [o(1, { maxQty: 2, default: true }), o(2)] };
  const herbs = { id: id(901), name: { he: 'א', en: 'Herbs' }, selection: 'single', min: 0, max: 1, options: [o(3, { default: true })] };
  const all = [o(10, { opensGroupId: dips.id }), o(11, { opensGroupId: dips.id }), o(12, { opensGroupId: herbs.id }), o(13)];
  const ids = [1, 2, 3, 10, 11, 12, 13].map(id);
  for (let mask = 0; mask < 2 ** ids.length; mask++) {
    const offIds = new Set(ids.filter((_, i) => mask & (1 << i)));
    for (const opener of all) {
      const probe = { id: id(950), name: { he: 'א', en: 'Probe' }, selection: 'single', min: 0, max: 1, options: [Object.assign({}, opener, { default: true })] };
      const groups = new Map([dips, herbs, probe].map((gr) => [gr.id, gr]));
      const ctx = { groups, unavailable: { dishes: new Set(), options: offIds }, vatBasisPoints: 0 };
      const theirs = defaultSelection({ addons: [{ groupId: probe.id, min: 0, max: 1 }] }, ctx).groups[0].options;
      const skipped = theirs.length === 0;
      if (!offIds.has(opener.id)) assert.equal(deadOpeners(ctx).has(opener.id), skipped, `mask ${mask} o${opener.id.slice(-2)}: dead`);      // an opener that is off is skipped for that alone
      if (!skipped) {
        const mine = setOption({ quantity: 1, groups: [] }, ctx, { groupId: probe.id, optionId: opener.id }).groups[0].options[0];
        assert.deepEqual(mine.nested, theirs[0].nested, `mask ${mask}: the nested start`);
      }
    }
  }
});
