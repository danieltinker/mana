/* Café Lima's place system, the pure parts: layout.v1's optional fields (look, outdoor, fixtures), peak windows and time
   frames (peaks.mjs), bidding on tables (bids.mjs), the counter's queue (orders.mjs) and floor edits (edit.mjs).
   Times are built with the local Date constructor, so the tests pass in any time zone.  Run: node --test seating/floor.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateLayout, tableNo } from './validate.mjs';
import { createState, settings, seat } from './timers.mjs';
import { validatePeaks, peakAt, slotsOf, windowsOn, slotAt, openSlots, nextPeak, validateFrames, frameFor } from './peaks.mjs';
import { createBids, configureBids, placeBid, accept, decline, release, tickBids, holdAt, standing, leaderOf, minNext, keyOf, validateBids, auctionFor } from './bids.mjs';
import { createOrders, addOrder, advance, back, attach, waiting, byPhase, byNumber, forTable, validateOrders, OrderError } from './orders.mjs';
import { moveTable, rotateTable, addTable, duplicateTable, removeTable, setSeats, setZone, warnings, overlaps, zoneAt, sizeOf, createHistory, commit, undo, redo } from './edit.mjs';

const read = (n) => JSON.parse(readFileSync(new URL('./fixtures/' + n + '.layout.json', import.meta.url), 'utf8'));
const L = validateLayout(read('lima')).layout;
const at = (h, m = 0, day = 16) => new Date(2026, 9, day, h, m).getTime();        // Friday 16 Oct 2026, local time
const MIN = 60000;
const PEAKS = validatePeaks({ windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '10:00', to: '13:00' }], slot: 90, opensBefore: 120, closeBefore: 10 }).peaks;

test('layout.v1: Lima passes with its looks, outdoor zones and fixtures; Olea is unchanged', () => {
  const v = validateLayout(read('lima')); assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.equal(v.layout.tables.length, 16); assert.equal(v.layout.tables.reduce((n, t) => n + t.seats, 0), 44);
  assert.deepEqual(v.layout.tables.find((t) => t.id === 't9').look, { top: 'glass', seat: 'chairs', w: 1.2, d: 0.65 });
  assert.deepEqual(v.layout.zones.filter((z) => z.outdoor).map((z) => z.id), ['street', 'wall']);
  assert.ok(v.layout.fixtures.some((f) => f.kind === 'counter' && f.name.he));
  assert.equal(tableNo(v.layout, 't3'), 3, 'Table 3 · along the wall');
  assert.deepEqual(warnings(v.layout), [], 'the draft has no overlaps and nothing outside the venue');
  const o = validateLayout(read('olea')); assert.equal(o.ok, true);
  assert.deepEqual(o.layout.fixtures, []); assert.equal('look' in o.layout.tables[0], false); assert.equal('outdoor' in o.layout.zones[0], false, 'optional fields appear only when the file has them');
});

test('layout.v1: bad looks, outdoor flags and fixtures are refused with a reason', () => {
  const bad = (patch, re) => { const r = read('lima'); patch(r); const v = validateLayout(r); assert.equal(v.ok, false); assert.ok(v.errors.some((e) => re.test(e)), re + ' in ' + JSON.stringify(v.errors)); };
  bad((r) => { r.tables[0].look.top = 'plastic'; }, /look\.top must be one of/);
  bad((r) => { r.tables[0].look.seat = 'throne'; }, /look\.seat/);
  bad((r) => { r.tables[0].look.w = 9; }, /look\.w/);
  bad((r) => { r.tables[0].look = 'nice'; }, /look must be an object/);
  bad((r) => { r.zones[0].outdoor = 'yes'; }, /outdoor must be true or false/);
  bad((r) => { r.fixtures.push({ kind: 'jacuzzi', at: [1, 1] }); }, /"jacuzzi" is not a known kind/);
  bad((r) => { r.fixtures.push({ kind: 'tree' }); }, /needs a rect or an at/);
  bad((r) => { r.fixtures.push({ kind: 'lamp', at: [99, 1] }); }, /at must be/);
  bad((r) => { r.fixtures.push({ kind: 'bench', rect: [3, 3, 1, 1] }); }, /rect must be/);
  bad((r) => { r.fixtures = {}; }, /fixtures must be an array/);
});

test('peaks: windows, slots, when bidding opens and closes, the next peak', () => {
  assert.equal(validatePeaks({ windows: [{ days: [9], from: '10:00', to: '13:00' }] }).ok, false);
  assert.equal(validatePeaks({ windows: [{ days: [1], from: '13:00', to: '10:00' }] }).ok, false);
  assert.equal(validatePeaks({ windows: [], slot: 25 }).ok, false);
  assert.ok(peakAt(PEAKS, at(10, 30))); assert.equal(peakAt(PEAKS, at(13, 0)), null); assert.equal(peakAt(PEAKS, at(9, 59)), null);
  const w = windowsOn(PEAKS, at(8))[0], s = slotsOf(PEAKS, w);
  assert.deepEqual(s.map((x) => [new Date(x.start).getHours() + ':' + new Date(x.start).getMinutes(), (x.end - x.start) / MIN]), [['10:0', 90], ['11:30', 90]]);
  assert.equal(s[0].closesAt, at(9, 50)); assert.equal(s[0].opensAt, at(8, 0));
  assert.deepEqual(openSlots(PEAKS, at(9, 40)).map((x) => x.start), [at(10), at(11, 30)]);
  assert.deepEqual(openSlots(PEAKS, at(9, 55)).map((x) => x.start), [at(11, 30)], 'the 10:00 slot closed at 9:50');
  assert.equal(slotAt(PEAKS, at(10, 15)), null); assert.equal(slotAt(PEAKS, at(11, 30)).end, at(13));
  assert.equal(nextPeak(PEAKS, at(14)).from, at(10, 0, 17));
});

test('frames: the table’s own, then the zone at peak, then the venue at peak, then the zone, then the default', () => {
  let timers = createState(L.tables, settings({ minutes: 90 }, { t6: 150 }));
  const frames = validateFrames({ zones: { lounge: 120 }, peak: { minutes: 75, zones: { wall: 60 } } }, L).frames;
  const f = (id, when) => frameFor({ timers, frames, peaks: PEAKS, layout: L }, id, when);
  assert.deepEqual(f('t6', at(11)), { minutes: 150, why: 'table' });
  assert.deepEqual(f('t3', at(11)), { minutes: 60, why: 'peak-zone' }, 'a laptop table along the wall gets an hour at peak');
  assert.deepEqual(f('r1', at(11)), { minutes: 75, why: 'peak' });
  assert.deepEqual(f('l1', at(15)), { minutes: 120, why: 'zone' });
  assert.deepEqual(f('r1', at(15)), { minutes: 90, why: 'default' });
  assert.equal(validateFrames({ zones: { lounge: 7 } }, L).ok, false);
  assert.deepEqual(validateFrames({ zones: { patio: 60 } }, L).frames.zones, {}, 'a zone that left the floor is dropped');
  timers = seat(timers, 't3', { party: 2, now: at(11), minutes: f('t3', at(11)).minutes }); assert.equal(timers.tables.t3.minutes, 60, 'timers.seat takes the frame as is');
});

test('bids: the machine — minimum, step, outbid, one table per guest, close, holds, accept, decline, release', () => {
  let S = createBids({ tables: ['l1', 't6'], min: 10, step: 5 }, L);
  const ctx = (h, m) => ({ layout: L, peaks: PEAKS, now: at(h, m) }), slot = at(10);
  const bid = (guest, amount, table = 'l1', when = [9, 30], party = 2) => placeBid(S, { table, start: slot, guest, party, amount }, ctx(...when));
  assert.equal(bid('guest-a', 10, 't3').ok, false, 'only the tables the owner chose');
  assert.match(bid('guest-a', 10, 'l1', [7, 59]).error, /not opened/);
  assert.match(bid('guest-a', 10, 'l1', [9, 50]).error, /closed/);
  assert.match(bid('guest-a', 10, 'l1', [9, 30], 7).error, /does not fit/);
  assert.match(bid('guest-a', 5).error, /minimum bid is 10/);
  let r = bid('guest-a', 10); assert.equal(r.ok, true); S = r.state;
  const k = keyOf('l1', slot); assert.equal(leaderOf(S.auctions[k]).guest, 'guest-a'); assert.equal(minNext(S, S.auctions[k]), 15);
  assert.match(bid('guest-a', 20).error, /already leading/);
  assert.match(bid('guest-b', 12).error, /at least 15/);
  r = bid('guest-b', 15); assert.equal(r.ok, true); assert.equal(r.outbid.guest, 'guest-a'); S = r.state;
  assert.equal(standing(S.auctions[k], 'guest-a'), 'outbid'); assert.equal(standing(S.auctions[k], 'guest-b'), 'leading');
  assert.match(bid('guest-b', 10, 't6').error, /one table per guest/);
  S = bid('guest-a', 20).state;
  /* nothing happens before the close; at 9:50 the highest wins and the table is held until the slot ends */
  assert.equal(tickBids(S, at(9, 49)).state, S);
  const t = tickBids(S, at(9, 51)); S = t.state; assert.deepEqual(t.events, [{ type: 'won', key: k, at: at(9, 50) }]);
  assert.equal(S.auctions[k].phase, 'won'); assert.equal(standing(S.auctions[k], 'guest-a'), 'won'); assert.equal(standing(S.auctions[k], 'guest-b'), 'lost');
  assert.ok(holdAt(S, 'l1', at(10, 30))); assert.equal(holdAt(S, 'l1', at(11, 30)), null); assert.equal(holdAt(S, 't6', at(10, 30)), null);
  assert.match(bid('guest-c', 50, 'l1', [9, 40]).error, /won/, 'a closed auction takes no bids');
  assert.equal(tickBids(S, at(11, 31)).state.auctions[k].phase, 'done');
  assert.equal(release(S, k, { now: at(10) }).state.auctions[k].phase, 'released');
  assert.equal(holdAt(release(S, k, { now: at(10) }).state, 'l1', at(10, 30)), null, 'released: the table is free again');
  /* the owner: accept early, decline with a reason; a slot with no bids is unsold */
  let S2 = placeBid(createBids({ tables: ['t6'] }, L), { table: 't6', start: at(11, 30), guest: 'guest-d', party: 3, amount: 10 }, ctx(9, 40)).state, k2 = keyOf('t6', at(11, 30));
  assert.equal(accept(S2, k2, { now: at(9, 5) }).state.auctions[k2].phase, 'won');
  assert.match(decline(S2, k2, { reason: ' ', now: at(9, 5) }).error, /reason/);
  const d = decline(S2, k2, { reason: 'A private event', now: at(9, 5) }).state; assert.equal(d.auctions[k2].phase, 'declined'); assert.equal(standing(d.auctions[k2], 'guest-d'), 'declined');
  assert.equal(accept(d, k2, {}).ok, false, 'a declined auction stays declined');
  assert.equal(auctionFor(S2, 'l1', { start: at(10), end: at(11, 30), closesAt: at(9, 50) }).bids.length, 0);
  assert.equal(configureBids(S2, { min: 0 }).ok, false); assert.equal(configureBids(S2, { credit: false }).state.rules.credit, false);
  assert.equal(createBids({}).rules.credit, true, 'by default the winning amount is credited to the order');
  /* storage */
  assert.equal(validateBids(JSON.parse(JSON.stringify(S)), L).ok, true); assert.equal(validateBids({ v: 2 }).ok, false);
  const gone = validateBids(JSON.parse(JSON.stringify(S)), Object.assign({}, L, { tables: L.tables.filter((x) => x.id !== 'l1') })).state;
  assert.deepEqual([gone.rules.tables, Object.keys(gone.auctions)], [['t6'], []], 'a table that left the floor leaves the bids');
});

test('orders: numbers, the barista’s taps, Ready from New, back, attach, the guest finds his number', () => {
  let S = createOrders(), r = addOrder(S, { items: ['cappuccino', 'croissant'], now: at(9) }); S = r.state;
  assert.deepEqual([r.order.no, r.order.phase, r.order.table], [1, 'new', null]);
  S = addOrder(S, { items: ['espresso'], table: 't3', now: at(9, 1) }).state;
  assert.throws(() => addOrder(S, { items: [], now: at(9) }), OrderError); assert.throws(() => addOrder(S, { items: ['Latte!'], now: at(9) }), /items/);
  S = advance(S, 'o1', 'preparing', { now: at(9, 2) }).state;
  assert.throws(() => advance(S, 'o1', 'preparing', { now: at(9, 3) }), /already/); assert.throws(() => advance(S, 'o2', 'picked', { now: at(9, 3) }), /not ready/);
  S = advance(S, 'o2', 'ready', { now: at(9, 3) }).state; assert.equal(byNumber(S, 2).phase, 'ready', 'Ready straight from New: one tap');
  S = back(S, 'o2').state; assert.equal(byNumber(S, 2).phase, 'new'); assert.throws(() => back(S, 'o2'), /cannot go back/);
  S = advance(S, 'o1', 'ready', { now: at(9, 4) }).state; S = back(S, 'o1').state; assert.equal(byNumber(S, 1).phase, 'preparing', 'back steps to where it was');
  S = advance(advance(S, 'o1', 'ready', { now: at(9, 5) }).state, 'o1', 'picked', { now: at(9, 6) }).state;
  assert.equal(byNumber(S, 1).phase, 'picked'); assert.deepEqual(waiting(S).map((o) => o.no), [2]);
  assert.deepEqual(forTable(S, 't3').map((o) => o.no), [2]); S = attach(S, 'o2', 'r1').state; assert.deepEqual(forTable(S, 'r1').map((o) => o.no), [2]);
  assert.deepEqual(byPhase(S, 'new').map((o) => o.id), ['o2']);
  /* numbers run 1–99 and skip any still waiting */
  let Q = createOrders(); for (let i = 0; i < 99; i++) Q = addOrder(Q, { items: ['tea'], now: at(9) }).state;
  assert.throws(() => addOrder(Q, { items: ['tea'], now: at(9) }), /99 orders/);
  Q = advance(advance(Q, 'o5', 'ready', { now: at(9) }).state, 'o5', 'picked', { now: at(9) }).state;
  assert.equal(addOrder(Q, { items: ['tea'], now: at(9) }).order.no, 5);
  assert.equal(validateOrders(JSON.parse(JSON.stringify(S))).ok, true); assert.equal(validateOrders({ v: 1, seq: 0, orders: [{ id: 'x', no: 400 }] }).state.orders.length, 0);
});

test('edit: move snaps and the zone follows, rotate by 15°, add, duplicate, delete, seats, zone, warnings, undo / redo', () => {
  let F = moveTable(L, 't3', 4.512, 3.333); const t3 = F.tables.find((t) => t.id === 't3'); assert.deepEqual([t3.x, t3.z, t3.zone], [4.5, 3.35, 'wall']);
  F = moveTable(F, 't3', 4.5, 1.9); assert.equal(F.tables.find((t) => t.id === 't3').zone, 'street', 'moved into the street line, the zone follows');
  assert.equal(L.tables.find((t) => t.id === 't3').zone, 'wall', 'the input is left as it was');
  assert.equal(rotateTable(L, 't1', 15).tables[0].rot, 105); assert.equal(rotateTable(L, 't1', -105).tables[0].rot, 345);
  const a = addTable(L, 'round2', { x: 12.2, z: 6.6 }); assert.equal(a.id, 'n1'); const n1 = a.layout.tables.find((t) => t.id === 'n1');
  assert.equal(n1.zone, 'door'); assert.equal(validateLayout(a.layout).ok, true, 'an added table passes the contract'); assert.deepEqual(warnings(a.layout), [], 'placed at a free spot');
  const d = duplicateTable(a.layout, 'n1'); assert.equal(d.id, 'n2'); assert.deepEqual(warnings(d.layout), []);
  assert.equal(removeTable(d.layout, 'n2').tables.length, 17); assert.throws(() => removeTable(L, 'zz'), /unknown/);
  const s = setSeats(L, 'r1', { seats: 1 }).tables.find((t) => t.id === 'r1'); assert.deepEqual([s.seats, s.minParty, s.maxParty], [1, 1, 1]);
  assert.equal(setZone(L, 'i1', 'lounge').tables.find((t) => t.id === 'i1').zone, 'lounge'); assert.throws(() => setZone(L, 'i1', 'roof'), /unknown zone/);
  /* warnings: on top of another table, on the pavement, in the kitchen */
  const w = warnings(moveTable(moveTable(L, 't2', 3.2, 3.35), 't5', 8, 9));
  assert.ok(w.some((x) => x.id === 't2' && x.type === 'overlap' && x.with === 't3'));
  assert.ok(w.some((x) => x.id === 't5' && x.type === 'outside' && x.why === 'kitchen'));
  assert.ok(warnings(moveTable(L, 't10', 9, 0.4)).some((x) => x.id === 't10' && x.why === 'walkway'));
  assert.equal(zoneAt(L, 12, 9.5), 'lounge'); assert.equal(sizeOf(L.tables[0]).w, 1.4); assert.equal(overlaps(L.tables[1], L.tables[2]), false);
  /* history */
  let h = createHistory(L); h = commit(h, F); h = commit(h, a.layout);
  h = undo(h); assert.equal(h.present, F); h = undo(h); assert.equal(h.present, L); assert.equal(undo(h), h, 'nothing more to undo');
  h = redo(h); assert.equal(h.present, F); h = commit(h, d.layout); assert.deepEqual(h.future, [], 'a new edit clears redo');
});
