/* The table clock's rules (seating/timers.mjs): defaults and overrides, the ending threshold, time up once, the grace
   period, extend after time is up, free early, availability, a JSON round trip, bad input. No real clock anywhere: every
   test turns `now` by hand. Run: node --test seating/timers.test.mjs   (cd view && npm test runs it too) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MIN, DEFAULTS, settings, createState, minutesFor, configure, seat, reserve, extend, free, tick, status, availableAt, isAvailable, byUrgency, validateState, TimerError } from './timers.mjs';

const layout = JSON.parse(readFileSync(new URL('./fixtures/olea.layout.json', import.meta.url), 'utf8'));
const T0 = Date.UTC(2026, 9, 13, 17, 0);                       // 20:00 in Tel Aviv
const at = (min) => T0 + min * MIN;
const fresh = (over) => createState(layout.tables, settings({}, Object.assign({ b1: 45, h5: 150 }, over)));
const freeze = (o) => { Object.values(o).forEach((v) => { if (v && typeof v === 'object') freeze(v); }); return Object.freeze(o); };
/* run the clock from a to b (minutes) one step at a time, collecting every event */
function run(state, from, to, step = 0.25) { const all = []; for (let m = from; m <= to + 1e-9; m += step) { const r = tick(state, at(m)); state = r.state; all.push(...r.events); } return { state, events: all }; }

test('defaults and overrides: 90 minutes unless the owner says otherwise; a table may have its own', () => {
  assert.deepEqual(settings(), { minutes: 90, ending: 5, grace: 10, extendBy: 15, overrides: {} });
  assert.deepEqual(DEFAULTS, { minutes: 90, ending: 5, grace: 10, extendBy: 15 });
  const S = fresh();
  assert.equal(S.v, 1); assert.equal(Object.keys(S.tables).length, 12); assert.ok(Object.values(S.tables).every((t) => t.phase === 'free'));
  assert.equal(minutesFor(S, 'h1'), 90); assert.equal(minutesFor(S, 'b1'), 45, 'the bar'); assert.equal(minutesFor(S, 'h5'), 150, 'the long table');
  const s1 = seat(S, 'b1', { party: 2, now: at(0) }); assert.equal(status(s1, 'b1', at(0)).endsAt, at(45));
  const s2 = seat(S, 'h1', { party: 4, now: at(0), minutes: 120 }); assert.equal(status(s2, 'h1', at(0)).endsAt, at(120), 'a seating may get its own frame');
  /* the owner changes the default: the next seating gets it, a running one keeps its frame */
  const c = configure(s2, { minutes: 100, overrides: { b1: null, w1: 60 } });
  assert.equal(minutesFor(c, 'h2'), 100); assert.equal(minutesFor(c, 'b1'), 100, 'null puts a table back on the default'); assert.equal(minutesFor(c, 'w1'), 60);
  assert.equal(status(c, 'h1', at(0)).endsAt, at(120), 'a running seating keeps its frame');
  assert.equal(minutesFor(S, 'b1'), 45, 'configure leaves its input as it was');
});

test('the ending threshold: seated → ending at 5 minutes left (a setting) → over; each reported once', () => {
  let S = seat(fresh(), 'h1', { party: 4, now: at(0) });
  assert.equal(status(S, 'h1', at(84.9)).phase, 'seated'); assert.equal(status(S, 'h1', at(85)).phase, 'ending'); assert.equal(status(S, 'h1', at(90)).phase, 'over');
  const st = status(S, 'h1', at(30)); assert.equal(st.leftMs, 60 * MIN); assert.ok(Math.abs(st.progress - 1 / 3) < 1e-9); assert.equal(st.party, 4); assert.equal(st.total, 90);
  const r = run(S, 0, 89); assert.deepEqual(r.events, [{ type: 'ending', tableId: 'h1', at: at(85) }]);
  /* the threshold is the owner's */
  S = seat(configure(fresh(), { ending: 10 }), 'h1', { party: 4, now: at(0) });
  assert.equal(status(S, 'h1', at(80)).phase, 'ending'); assert.deepEqual(run(S, 0, 85).events.map((e) => [e.type, e.at]), [['ending', at(80)]]);
});

test('time is up: reported once, counted as free at once, shown over until the manager acts', () => {
  const S = seat(fresh(), 'w3', { party: 3, now: at(0) });
  const r = run(S, 0, 95);
  assert.deepEqual(r.events, [{ type: 'ending', tableId: 'w3', at: at(85) }, { type: 'over', tableId: 'w3', at: at(90) }]);
  assert.equal(r.events.filter((e) => e.type === 'over').length, 1, 'over fires once');
  const again = tick(r.state, at(96)); assert.deepEqual(again.events, []); assert.equal(again.state, r.state, 'nothing changed: the same object comes back');
  const st = status(r.state, 'w3', at(93)); assert.equal(st.phase, 'over'); assert.equal(st.leftMs, -3 * MIN); assert.equal(st.overMs, 3 * MIN); assert.equal(st.progress, 1); assert.equal(st.freeAt, at(100));
  assert.equal(availableAt(r.state, 'w3', at(93)), at(93), 'after this the table frees up: available right away'); assert.equal(isAvailable(r.state, 'w3', at(93)), true);
  assert.equal(isAvailable(r.state, 'w3', at(89)), false);
});

test('the grace period: an over table nobody touched frees itself (10 minutes, a setting)', () => {
  const S = seat(fresh(), 'w3', { party: 3, now: at(0) });
  let r = run(S, 0, 100);
  assert.deepEqual(r.events.map((e) => e.type), ['ending', 'over', 'freed']); assert.deepEqual(r.events[2], { type: 'freed', tableId: 'w3', at: at(100) });
  assert.equal(r.state.tables.w3.phase, 'free'); assert.equal(status(r.state, 'w3', at(100)).phase, 'free');
  assert.deepEqual(r.state.ended, [{ table: 'w3', n: 1, party: 3, seatedAt: at(0), minutes: 90, extended: 0, endedAt: at(100), how: 'auto' }]);
  r = run(seat(configure(fresh(), { grace: 2 }), 'w3', { party: 3, now: at(0) }), 0, 93);
  assert.deepEqual(r.events.map((e) => [e.type, e.at]), [['ending', at(85)], ['over', at(90)], ['freed', at(92)]]);
  /* status is pure: past the grace the table reads free even before a tick */
  assert.equal(status(S, 'w3', at(100)).phase, 'free');
  /* the board was closed: only what is still true is reported */
  assert.deepEqual(tick(S, at(91)).events.map((e) => e.type), ['over'], 'no stale "ending" for a table already over');
  assert.deepEqual(tick(S, at(130)).events.map((e) => e.type), ['freed'], 'no "over" for a table that freed itself');
  assert.deepEqual(tick(tick(S, at(91)).state, at(92)).events, [], 'and nothing twice');
});

test('extend: a running seating moves its end; after time is up the extension runs from now; the new end can warn again', () => {
  let S = seat(fresh(), 'h1', { party: 4, now: at(0) });
  S = extend(S, 'h1', { now: at(40) }); assert.equal(status(S, 'h1', at(40)).endsAt, at(105), '+15 by default'); assert.equal(S.tables.h1.extended, 15);
  S = extend(S, 'h1', { now: at(41), by: 30 }); assert.equal(status(S, 'h1', at(41)).endsAt, at(135), 'any number of times'); assert.equal(status(S, 'h1', at(41)).total, 135);
  /* extend after over */
  let r = run(seat(fresh(), 'w3', { party: 3, now: at(0) }), 0, 93.5);
  assert.equal(status(r.state, 'w3', at(93.5)).phase, 'over');
  const x = extend(r.state, 'w3', { now: at(93.5) });
  const st = status(x, 'w3', at(93.5)); assert.equal(st.phase, 'seated'); assert.equal(st.endsAt, at(109), 'from now, to the whole minute: 94 + 15'); assert.equal(x.tables.w3.extended, 19);
  r = run(x, 93.5, 125);
  assert.deepEqual(r.events.map((e) => [e.type, e.at]), [['ending', at(104)], ['over', at(109)], ['freed', at(119)]], 'the new end warns once more, once');
  /* extending inside the warning window does not warn again right away */
  r = run(seat(configure(fresh(), { ending: 10 }), 'h2', { party: 2, now: at(0) }), 0, 89);
  const y = extend(r.state, 'h2', { now: at(89), by: 5 }); assert.equal(status(y, 'h2', at(89)).phase, 'ending', '6 minutes left, the threshold is 10');
  assert.deepEqual(run(y, 89, 95).events.map((e) => [e.type, e.at]), [['over', at(95)]]);
  assert.throws(() => extend(fresh(), 'h1', { now: at(0) }), /not seated/);
  assert.throws(() => extend(S, 'h1', { now: at(0), by: 7 }), /extendBy must be 5–120 in steps of 5/);
});

test('free early, free after, seat again: the history says how each seating ended', () => {
  let S = seat(fresh(), 'c2', { party: 2, now: at(0) });
  S = free(S, 'c2', { now: at(50) });
  assert.equal(S.tables.c2.phase, 'free'); assert.equal(status(S, 'c2', at(50)).phase, 'free'); assert.equal(availableAt(S, 'c2', at(50)), at(50));
  assert.deepEqual(S.ended.map((e) => [e.n, e.how, e.endedAt]), [[1, 'early', at(50)]]);
  assert.deepEqual(tick(S, at(200)).events, [], 'a freed table never alerts');
  S = seat(S, 'c2', { party: 3, now: at(55) }); assert.equal(S.tables.c2.n, 2, 'a new seating, a new number');
  assert.throws(() => seat(S, 'c2', { party: 2, now: at(60) }), /is seated until its time is up/);
  S = run(S, 55, 147).state; assert.equal(status(S, 'c2', at(147)).phase, 'over');
  const S2 = seat(S, 'c2', { party: 2, now: at(147) }); assert.equal(S2.tables.c2.n, 3, 'time is up: the table counts as free, a new party may sit');
  assert.deepEqual(S2.ended.map((e) => e.how), ['early', 'manager']);
  assert.deepEqual(free(S, 'c2', { now: at(147) }).ended.map((e) => e.how), ['early', 'manager']);
  assert.equal(free(fresh(), 'c2', { now: at(0) }).tables.c2.phase, 'free');
});

test('availability and the manager’s order', () => {
  let S = fresh();
  S = seat(S, 'h1', { party: 4, now: at(0) });                 // ends 90
  S = seat(S, 'w3', { party: 3, now: at(-86) });               // ends 4: ending
  S = seat(S, 'c2', { party: 2, now: at(-95) });               // ended -5: over
  S = seat(S, 'h5', { party: 7, now: at(-30) });               // 150: ends 120
  S = reserve(S, 'w4', { party: 2, at: at(30), now: at(0) });
  assert.equal(availableAt(S, 'h1', at(0)), at(90)); assert.equal(availableAt(S, 'c2', at(0)), at(0)); assert.equal(availableAt(S, 'w1', at(0)), at(0));
  assert.equal(availableAt(S, 'w4', at(0)), at(120), 'a booking holds the table for its own frame');
  assert.equal(status(S, 'w4', at(0)).phase, 'reserved'); assert.equal(status(S, 'w4', at(0)).leftMs, 30 * MIN);
  assert.deepEqual(byUrgency(S, at(0)).slice(0, 6), ['c2', 'w3', 'h1', 'h5', 'w4', 'w1']);
  const arrived = seat(S, 'w4', { now: at(31) }); assert.equal(arrived.tables.w4.party, 2, 'the booking arrives: its party is seated'); assert.equal(status(arrived, 'w4', at(31)).endsAt, at(121));
  assert.equal(free(S, 'w4', { now: at(5) }).tables.w4.phase, 'free', 'a booking can be dropped');
  assert.throws(() => reserve(S, 'h1', { party: 2, at: at(30), now: at(0) }), /is seated/);
});

test('serialisation: the state is plain JSON, round-trips, and the clock behaves the same after', () => {
  let S = fresh(); S = seat(S, 'h1', { party: 4, now: at(0) }); S = seat(S, 'w3', { party: 3, now: at(-86) }); S = extend(S, 'h1', { now: at(10) }); S = free(seat(S, 'c1', { party: 1, now: at(0) }), 'c1', { now: at(5) });
  S = tick(S, at(0)).state;
  const json = JSON.parse(JSON.stringify(S));
  assert.deepEqual(json, S);
  const v = validateState(json, layout.tables.map((t) => t.id)); assert.equal(v.ok, true, JSON.stringify(v.errors)); assert.deepEqual(v.state, S);
  assert.deepEqual(run(v.state, 0, 120).events, run(S, 0, 120).events);
  /* the floor follows the layout: a new table starts free, a table that left is dropped with its override */
  const ids = layout.tables.map((t) => t.id).filter((id) => id !== 'b1').concat(['p1']);
  const moved = validateState(json, ids); assert.equal(moved.ok, true); assert.equal(moved.state.tables.p1.phase, 'free'); assert.equal(moved.state.tables.b1, undefined); assert.equal(moved.state.settings.overrides.b1, undefined);
  assert.equal(validateState(null).ok, false); assert.equal(validateState({ v: 2 }).ok, false);
  assert.match(validateState(Object.assign({}, json, { tables: { h1: { phase: 'seated', party: 4 } } })).errors.join(), /a seating needs/);
  assert.match(validateState(Object.assign({}, json, { settings: { minutes: 7 } })).errors.join(), /minutes must be 15–360/);
  assert.match(validateState(Object.assign({}, json, { tables: { h1: { phase: 'dancing' } } })).errors.join(), /unknown phase/);
});

test('updates are immutable', () => {
  const S = freeze(seat(fresh(), 'h1', { party: 4, now: at(0) }));
  const before = JSON.stringify(S);
  seat(S, 'h2', { party: 2, now: at(1) }); extend(S, 'h1', { now: at(2) }); free(S, 'h1', { now: at(3) }); tick(S, at(200)); configure(S, { minutes: 60 }); reserve(S, 'w1', { party: 2, at: at(30), now: at(0) });
  assert.equal(JSON.stringify(S), before);
});

test('bad input is refused with a plain reason', () => {
  const S = fresh();
  const no = (fn, re) => assert.throws(fn, (e) => e instanceof TimerError && re.test(e.message), String(re));
  no(() => seat(S, 'nope', { party: 2, now: at(0) }), /unknown table "nope"/);
  no(() => status(S, 'nope', at(0)), /unknown table/);
  no(() => seat(S, 'h1', { party: 0, now: at(0) }), /party must be 1–40/);
  no(() => seat(S, 'h1', { party: 2.5, now: at(0) }), /party/);
  no(() => seat(S, 'h1', { party: 2, now: at(0), minutes: 92 }), /minutes must be 15–360 in steps of 5 \(got 92\)/);
  no(() => seat(S, 'h1', { party: 2, now: at(0), minutes: 10 }), /minutes must be 15–360/);
  no(() => seat(S, 'h1', { party: 2 }), /now must be a time/);
  no(() => seat(S, 'h1', { party: 2, now: 'tonight' }), /now must be a time/);
  no(() => settings({ minutes: 400 }), /minutes must be 15–360/);
  no(() => settings({ ending: 0 }), /ending must be 1–30/);
  no(() => settings({ grace: 0 }), /grace must be 1–60/);
  no(() => settings({}, { h1: 13 }), /minutes must be/);
  no(() => configure(S, { overrides: { zz: 60 } }), /unknown table "zz"/);
  no(() => createState([]), /at least one table/);
  no(() => createState(['a', 'a']), /repeats/);
  no(() => createState(['a'], settings({}, { b: 30 })), /override for unknown table/);
  no(() => tick(S, NaN), /now must be a time/);
  assert.equal(seat(S, 'h1', { party: 2, now: new Date(at(0)) }).tables.h1.seatedAt, at(0), 'a Date is a time too');
});
