/* The seating contracts (seating/validate.mjs), the request state machine, who fits where, the session store, and the
   snapshot's bookUrl. Run: node --test test/seat.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateLayout, validateRequest, newRequest, transition, fits, tablesFor, zonesFor, tableNo } from '../../seating/validate.mjs';
import { createSessionStore } from '../src/seat/store.js';
import { footprint, seatsOf } from '../src/seat/plan.js';
import { normalise } from '../src/snapshot.js';

const raw = () => JSON.parse(readFileSync(new URL('../../seating/fixtures/olea.layout.json', import.meta.url), 'utf8'));
const L = validateLayout(raw()).layout;
const ask = (over) => Object.assign({ zone: 'window', table: 'w3', date: '2026-10-14', time: '20:00', party: 3, name: 'דנה לוי', phone: '050-000-0000', note: '' }, over);
const mk = (over, id = 'r0001') => newRequest(ask(over), L, { id, now: '2026-10-13T10:00:00Z' }).request;

test('layout.v1: the demo room passes, normalised', () => {
  const v = validateLayout(raw()); assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.equal(v.layout.v, 1); assert.equal(v.layout.venue, 'olea'); assert.equal(v.layout.tableChoice, true, 'table choice is on unless the owner turns it off');
  assert.equal(v.layout.zones.length, 4); assert.equal(v.layout.tables.length, 12); assert.equal(v.layout.walls.length, 4);
  assert.deepEqual(v.layout.walls.map((w) => w.kind), ['wall', 'window', 'wall', 'door']); assert.deepEqual(v.layout.walls[3].gap, [4, 6]);
  v.layout.tables.forEach((t) => { assert.ok(t.minParty <= t.maxParty && t.maxParty <= t.seats, t.id); assert.equal(t.name, null); });
  assert.equal(v.layout.tables.find((t) => t.id === 'b1').bookable, false, 'the bar is drawn, never booked');
  assert.equal(validateLayout(Object.assign(raw(), { tableChoice: false })).layout.tableChoice, false);
});

test('layout.v1: bad shapes are refused with a reason each', () => {
  const bad = (patch, re) => { const r = raw(); patch(r); const v = validateLayout(r); assert.equal(v.ok, false); assert.ok(v.errors.some((e) => re.test(e)), re + ' in ' + JSON.stringify(v.errors)); };
  assert.equal(validateLayout(null).ok, false); assert.equal(validateLayout([]).ok, false);
  bad((r) => { r.v = 2; }, /v must be 1/);
  bad((r) => { r.venue = 'Olea Café'; }, /venue/);
  bad((r) => { delete r.room; }, /room/);
  bad((r) => { r.tables[0].zone = 'patio'; }, /is not a zone/);
  bad((r) => { r.tables[0].maxParty = 9; }, /exceeds its seats/);
  bad((r) => { r.tables[0].minParty = 5; r.tables[0].maxParty = 4; }, /minParty <= maxParty/);
  bad((r) => { r.tables[1].id = r.tables[0].id; }, /repeats/);
  bad((r) => { r.tables[0].shape = 'oval'; }, /shape/);
  bad((r) => { r.tables[0].x = 99; }, /outside the room/);
  bad((r) => { r.tables[0].bookable = 'yes'; }, /bookable/);
  bad((r) => { r.zones[0].rect = [10, 0, 15, 10]; }, /inside the room/);
  bad((r) => { r.zones[0].name = { he: 'x' }; }, /name needs he and en/);
  bad((r) => { r.walls[0].from = [0]; }, /from and to/);
  bad((r) => { r.walls[3].gap = [6, 4]; }, /gap/);
  bad((r) => { r.tables = []; }, /at least one table/);
  bad((r) => { r.tableChoice = 'no'; }, /tableChoice/);
});

test('who fits where', () => {
  assert.deepEqual(tablesFor(L, 2).map((t) => t.id), ['w1', 'w2', 'w3', 'w4', 'h1', 'h2', 'h3', 'h4', 'c1', 'c2']);
  assert.deepEqual(tablesFor(L, 1).map((t) => t.id), ['w1', 'w2', 'h3', 'h4', 'c1']);
  assert.deepEqual(tablesFor(L, 6).map((t) => t.id), ['h5']); assert.deepEqual(zonesFor(L, 6).map((z) => z.id), ['hall']);
  assert.deepEqual(tablesFor(L, 9), []); assert.deepEqual(zonesFor(L, 9), []);
  assert.deepEqual(tablesFor(L, 3, 'window').map((t) => t.id), ['w3', 'w4']);
  assert.equal(fits(L.tables.find((t) => t.id === 'b1'), 1), false, 'a bar stool is not booked');
  assert.equal(fits(L.tables.find((t) => t.id === 'w1'), 2.5), false);
  assert.equal(tableNo(L, 'w3'), 3); assert.equal(tableNo(L, 'h5'), 5); assert.equal(tableNo(L, 'c2'), 2); assert.equal(tableNo(L, 'nope'), 0);
});

test('booking_request.v1: a good request is normalised; bad ones are refused', () => {
  const r = mk({ name: '  דנה לוי ', note: ' בלי בצל ' }); assert.equal(r.status, 'pending'); assert.equal(r.name, 'דנה לוי'); assert.equal(r.note, 'בלי בצל'); assert.equal(r.reason, ''); assert.equal(r.createdAt, '2026-10-13T10:00:00.000Z'); assert.equal(r.decidedAt, null);
  assert.deepEqual(Object.keys(r).sort(), ['createdAt', 'date', 'decidedAt', 'id', 'name', 'note', 'party', 'phone', 'reason', 'status', 'table', 'time', 'v', 'venue', 'zone']);
  const bad = (over, re) => { const v = newRequest(ask(over), L, { id: 'r0002' }); assert.equal(v.ok, false); assert.ok(v.errors.some((e) => re.test(e)), re + ' in ' + JSON.stringify(v.errors)); };
  bad({ phone: 'call me' }, /phone/); bad({ phone: '1234' }, /phone/); bad({ name: '' }, /name/); bad({ name: 'x'.repeat(81) }, /name/);
  bad({ date: '14/10/2026' }, /date/); bad({ date: '2026-13-01' }, /date/); bad({ time: '8pm' }, /time/); bad({ time: '24:00' }, /time/);
  bad({ party: 0 }, /party/); bad({ party: 2.5 }, /party/); bad({ zone: 'patio' }, /zone/); bad({ table: 'h1' }, /not in zone window/); bad({ table: 'w1' }, /does not fit a party of 3/); bad({ table: 'b1' }, /does not fit/);
  bad({ note: 'n'.repeat(301) }, /note/);
  assert.equal(newRequest(ask({ table: null }), L, { id: 'r0003' }).ok, true, 'an area without a table is a request too');
  assert.equal(validateRequest(Object.assign(mk({}), { status: 'declined', reason: '' }), L).ok, false, 'declined needs a reason');
  assert.equal(validateRequest(Object.assign(mk({}), { reason: 'why' }), L).ok, false, 'only declined carries a reason');
  assert.equal(validateRequest(Object.assign(mk({}), { venue: 'other' }), L).ok, false);
  assert.equal(validateRequest(Object.assign(mk({}), { id: 'a' }), L).ok, false);
  assert.equal(validateRequest('x').ok, false);
});

test('the state machine: pending → approved | declined; approved may change its table; nothing goes back', () => {
  const r = mk({}), now = { now: '2026-10-13T11:00:00Z' };
  const a = transition(r, { type: 'approve' }, L, now); assert.equal(a.ok, true, a.error); assert.deepEqual([a.request.status, a.request.table, a.request.zone, a.request.decidedAt], ['approved', 'w3', 'window', '2026-10-13T11:00:00.000Z']);
  assert.equal(r.status, 'pending', 'the input is not changed');
  const moved = transition(r, { type: 'approve', table: 'h1' }, L, now); assert.equal(moved.ok, true); assert.deepEqual([moved.request.table, moved.request.zone], ['h1', 'hall'], 'approve may seat the party at another fitting table, in its zone');
  const area = transition(r, { type: 'approve', table: null }, L, now); assert.equal(area.ok, true); assert.equal(area.request.table, null, 'or confirm the area only');
  assert.match(transition(r, { type: 'approve', table: 'h5' }, L, now).error, /does not fit/);
  assert.match(transition(r, { type: 'approve', table: 'b1' }, L, now).error, /does not fit/);
  assert.match(transition(r, { type: 'approve', table: 'zz' }, L, now).error, /not in the layout/);
  const d = transition(r, { type: 'decline', reason: ' אין מקום בשעה הזו ' }, L, now); assert.equal(d.ok, true); assert.equal(d.request.status, 'declined'); assert.equal(d.request.reason, 'אין מקום בשעה הזו');
  assert.match(transition(r, { type: 'decline' }, L, now).error, /reason/); assert.match(transition(r, { type: 'decline', reason: '   ' }, L, now).error, /reason/);
  assert.match(transition(a.request, { type: 'approve' }, L, now).error, /only a pending/); assert.match(transition(a.request, { type: 'decline', reason: 'x' }, L, now).error, /only a pending/);
  assert.match(transition(d.request, { type: 'approve' }, L, now).error, /only a pending/); assert.match(transition(d.request, { type: 'swap', table: 'w4' }, L, now).error, /only an approved/);
  const s = transition(a.request, { type: 'swap', table: 'w4' }, L, now); assert.equal(s.ok, true); assert.deepEqual([s.request.status, s.request.table], ['approved', 'w4']);
  assert.match(transition(r, { type: 'swap', table: 'w4' }, L, now).error, /only an approved/); assert.match(transition(a.request, { type: 'swap' }, L, now).error, /needs a table/); assert.match(transition(a.request, { type: 'swap', table: 'h5' }, L, now).error, /does not fit/);
  assert.match(transition(a.request, { type: 'seat' }, L, now).error, /unknown action/); assert.match(transition({ v: 1 }, { type: 'approve' }, L, now).error, /request:/);
});

test('the session store keeps only valid requests, acts through the state machine, remembers mine', () => {
  const mem = new Map(), storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  const st = createSessionStore('olea', storage);
  assert.deepEqual(st.list(L), []); assert.equal(st.mine(), null);
  assert.equal(st.add(mk({}), L).ok, true); assert.equal(st.add(mk({ zone: 'hall', table: 'h2' }, 'r0002'), L).ok, true); assert.equal(st.add({ v: 1, id: 'bad' }, L).ok, false);
  st.setMine('r0002'); assert.equal(st.mine(), 'r0002'); assert.equal(st.list(L).length, 2);
  assert.equal(st.act('r0001', { type: 'approve', table: 'w4' }, L).ok, true); assert.equal(st.byId(L, 'r0001').table, 'w4');
  assert.match(st.act('r0001', { type: 'decline', reason: 'x' }, L).error, /only a pending/); assert.match(st.act('nope', { type: 'approve' }, L).error, /no such/);
  assert.equal(st.act('r0002', { type: 'decline', reason: 'full' }, L).ok, true); assert.equal(st.byId(L, 'r0002').reason, 'full');
  const key = 'mana-seat:olea', saved = JSON.parse(mem.get(key)); saved.requests.push({ v: 1, id: 'r0003', junk: true }); saved.requests[0].phone = 'x'; mem.set(key, JSON.stringify(saved));
  assert.deepEqual(st.list(L).map((r) => r.id), ['r0002'], 'anything malformed in storage is dropped, never shown');
  const quiet = createSessionStore('olea', { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } });
  assert.equal(quiet.add(mk({}), L).ok, true); assert.equal(quiet.list(L).length, 1, 'with storage refused it still works for the page');
  st.clear(); assert.deepEqual(st.list(L), []); assert.equal(st.mine(), null);
});

test('the plan draws every seat, and the shapes have a size', () => {
  L.tables.forEach((t) => { assert.equal(seatsOf(t).length, t.seats, t.id); const fp = footprint(t); assert.ok(fp.w > 0 && fp.h > 0); seatsOf(t).forEach(([x, z]) => assert.ok(Math.abs(x) < 4 && Math.abs(z) < 4)); });
  assert.ok(footprint({ shape: 'round', seats: 4 }).r > footprint({ shape: 'round', seats: 2 }).r);
  assert.ok(footprint({ shape: 'long', seats: 8 }).w > footprint({ shape: 'long', seats: 6 }).w);
});

test('the snapshot carries business.bookUrl only as an https link', () => {
  const base = { v: 1, categories: [], business: { name: 'X' } };
  assert.equal(normalise(Object.assign({}, base, { business: { name: 'X', bookUrl: 'https://ontopo.co.il/x' } })).business.bookUrl, 'https://ontopo.co.il/x');
  assert.equal(normalise(Object.assign({}, base, { business: { name: 'X', bookUrl: 'http://ontopo.co.il/x' } })).business.bookUrl, null);
  assert.equal(normalise(Object.assign({}, base, { business: { name: 'X', bookUrl: 'javascript:alert(1)' } })).business.bookUrl, null);
  assert.equal(normalise(Object.assign({}, base, { business: { name: 'X', bookUrl: 7 } })).business.bookUrl, null);
  assert.equal(normalise(base).business.bookUrl, null);
  const olea = JSON.parse(readFileSync(new URL('../demo/olea/menu.json', import.meta.url), 'utf8'));
  assert.equal(normalise(olea, 'https://host.test/mana/view/demo/olea/menu.json').business.bookUrl, 'https://example.com/olea/book', 'the demo has one, so the button shows (and opens the seat map instead)');
});
