/* The table clock: how long a party keeps its table, when the manager hears about it, and when the table frees itself.
   Pure ESM, no dependencies, no DOM and no clock of its own: every function that needs the time takes `now` (ms since the
   epoch, or a Date). The same file runs on the host board (view/host/), in tests (timers.test.mjs) and, later, as the twin
   of a database function (db/proposed/0006_table_clock.sql). Built from scratch for Mana; nothing is copied from anyone.

   The rules
   - The venue has a default time frame in minutes (the owner's setting: 15–360 in steps of 5, 90 unless changed). Any
     table may have its own (the bar 45, the long table 150). A setting changes the next seating, never a running one.
   - A table is free, reserved (a booking is coming), or seated. A seated table is `ending` when `ending` minutes or less
     are left (a setting, 5 by default) and `over` when its time is up.
   - Time is up: the table counts as free for availability at once; the board shows it `over` until the manager extends
     or frees it, or the grace period passes (a setting, 10 minutes by default, at least 1), and then it is free by itself.
   - A seating can be extended (+15 by default, any number of times) or ended early. An extension of a running seating
     moves its end; an extension after time is up runs from now (rounded up to the whole minute).
   - tick(state, now) reports `ending`, `over` and `freed` once per seating end. An extension sets a new end, so the new
     end can warn once more (the manager asked for more time; he hears when that runs out too). When the board was closed
     and several moments passed at once, only what is still true is reported: no "ending" for a table already over, no
     "over" for a table that already freed itself.
   - The state is plain JSON ({ v: 1, ... }), every update returns a new object and leaves its input as it was. Bad input
     (an unknown table, minutes off the scale, a party of 0) throws a TimerError with a plain reason. Data from storage
     passes validateState() first, which never throws.

   State (v1)
     { v: 1, seq, settings: { minutes, ending, grace, extendBy, overrides: { tableId: minutes } },
       tables: { tableId: { phase: 'free' }
                        | { phase: 'reserved', party, at, minutes }
                        | { phase: 'seated', n, party, seatedAt, minutes, extended, warned, alerted } },
       ended: [ { table, n, party, seatedAt, minutes, extended, endedAt, how: 'early' | 'manager' | 'auto' } ]   (last 50) }
   `minutes` is the frame the seating started with, `extended` the minutes added since; the end is
   seatedAt + (minutes + extended) minutes. `warned` / `alerted`: the `ending` / `over` events of the current end fired. */

export const MIN = 60000;
export const DEFAULTS = Object.freeze({ minutes: 90, ending: 5, grace: 10, extendBy: 15 });
/* [low, high, step] of every setting, in minutes */
export const LIMITS = Object.freeze({ minutes: [15, 360, 5], ending: [1, 30, 1], grace: [1, 60, 1], extendBy: [5, 120, 5], party: [1, 40, 1] });
export const PHASES = ['free', 'reserved', 'seated', 'ending', 'over'];
const KEEP_ENDED = 50;
const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;

export class TimerError extends Error { constructor(message) { super(message); this.name = 'TimerError'; } }
const fail = (m) => { throw new TimerError(m); };
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const onScale = (v, [lo, hi, step]) => Number.isInteger(v) && v >= lo && v <= hi && (v - lo) % step === 0;
const scale = (name, v, lim = LIMITS[name]) => (onScale(v, lim) ? v : fail(name + ' must be ' + lim[0] + '–' + lim[1] + (lim[2] > 1 ? ' in steps of ' + lim[2] : '') + ' (got ' + JSON.stringify(v) + ')'));
const time = (v, name = 'now') => { const n = v instanceof Date ? v.getTime() : v; return typeof n === 'number' && Number.isFinite(n) ? n : fail(name + ' must be a time (ms since the epoch or a Date)'); };
const known = (state, id) => (Object.prototype.hasOwnProperty.call(state.tables, id) ? state.tables[id] : fail('unknown table ' + JSON.stringify(id)));

/* ---------- settings ---------- */
/* The owner's settings, checked: settings({ minutes: 90, ending: 5, grace: 10, extendBy: 15 }, { b1: 45, h5: 150 }).
   Anything left out is the default. Throws a TimerError on a value off its scale. */
export function settings(defaults = {}, overrides = {}) {
  if (!isObj(defaults)) fail('settings must be an object');
  if (!isObj(overrides)) fail('overrides must be an object of table id → minutes');
  const out = {};
  for (const k of ['minutes', 'ending', 'grace', 'extendBy']) out[k] = scale(k, defaults[k] == null ? DEFAULTS[k] : defaults[k]);
  out.overrides = {};
  for (const id of Object.keys(overrides).sort()) {
    if (!ID.test(id)) fail('override for a bad table id ' + JSON.stringify(id));
    if (overrides[id] != null) out.overrides[id] = scale('minutes', overrides[id]);
  }
  return out;
}

/* A new floor: every table free. `tables` is a list of ids, or of { id } (a layout's tables). */
export function createState(tables, cfg = settings()) {
  if (!Array.isArray(tables) || !tables.length) fail('a floor needs at least one table');
  const ids = tables.map((t) => (isObj(t) ? t.id : t));
  const seen = new Set();
  ids.forEach((id) => { if (!(typeof id === 'string' && ID.test(id))) fail('bad table id ' + JSON.stringify(id)); if (seen.has(id)) fail('table ' + id + ' repeats'); seen.add(id); });
  const s = settings(cfg, cfg && cfg.overrides);
  Object.keys(s.overrides).forEach((id) => { if (!seen.has(id)) fail('override for unknown table ' + JSON.stringify(id)); });
  const out = { v: 1, seq: 0, settings: s, tables: {}, ended: [] };
  ids.forEach((id) => { out.tables[id] = { phase: 'free' }; });
  return out;
}

/* the frame a new seating at this table gets: its own, or the venue's default */
export const minutesFor = (state, id) => { known(state, id); const o = state.settings.overrides[id]; return o == null ? state.settings.minutes : o; };

/* The owner changes a setting: configure(state, { minutes: 100, overrides: { b1: 45, h5: null } }) (null = back to the
   default). Running seatings keep the frame they started with. */
export function configure(state, patch) {
  if (!isObj(patch)) fail('configure needs an object');
  const s = state.settings, overrides = Object.assign({}, s.overrides);
  if (patch.overrides != null) {
    if (!isObj(patch.overrides)) fail('overrides must be an object of table id → minutes');
    Object.keys(patch.overrides).forEach((id) => { known(state, id); const m = patch.overrides[id]; if (m == null) delete overrides[id]; else overrides[id] = scale('minutes', m); });
  }
  const next = settings(Object.assign({}, s, patch, { overrides: undefined }), overrides);
  return Object.assign({}, state, { settings: next });
}

/* ---------- the moments of a seating ---------- */
const endOf = (t) => t.seatedAt + (t.minutes + t.extended) * MIN;
const moments = (state, t) => { const end = endOf(t); return { end, endingAt: end - state.settings.ending * MIN, freeAt: end + state.settings.grace * MIN }; };
const put = (state, id, table, extra) => Object.assign({}, state, extra || {}, { tables: Object.assign({}, state.tables, { [id]: table }) });
const log = (state, id, t, endedAt, how) => state.ended.concat([{ table: id, n: t.n, party: t.party, seatedAt: t.seatedAt, minutes: t.minutes, extended: t.extended, endedAt, how }]).slice(-KEEP_ENDED);
/* a seated table whose grace has passed is free, whatever tick has or has not done yet */
const running = (state, t, now) => t.phase === 'seated' && now < moments(state, t).freeAt;

/* ---------- what the manager does ---------- */
/* Seat a party: seat(state, 'h1', { party: 4, now, minutes? }). A free table, a reserved one (the booking arrives) or one
   whose time is up (it counts as free) can be seated; a table still in its time cannot. */
export function seat(state, id, opts = {}) {
  const t = known(state, id), now = time(opts.now);
  if (t.phase === 'seated' && running(state, t, now) && now < endOf(t)) fail('table ' + id + ' is seated until its time is up; extend it or free it first');
  const party = scale('party', opts.party == null && t.phase === 'reserved' ? t.party : opts.party);
  const minutes = scale('minutes', opts.minutes == null ? (t.phase === 'reserved' ? t.minutes : minutesFor(state, id)) : opts.minutes);
  const n = state.seq + 1, extra = { seq: n };
  if (t.phase === 'seated') extra.ended = log(state, id, t, Math.min(now, moments(state, t).freeAt), running(state, t, now) ? 'manager' : 'auto');
  return put(state, id, { phase: 'seated', n, party, seatedAt: now, minutes, extended: 0, warned: false, alerted: false }, extra);
}

/* Hold a table for a booking (optional in this version): reserve(state, 'w3', { party: 2, at, now, minutes? }). */
export function reserve(state, id, opts = {}) {
  const t = known(state, id), now = time(opts.now), at = time(opts.at, 'at');
  if (t.phase === 'seated' && running(state, t, now) && now < endOf(t)) fail('table ' + id + ' is seated; free it first');
  if (t.phase === 'reserved') fail('table ' + id + ' is already reserved');
  if (at < now - LIMITS.grace[1] * MIN) fail('a booking cannot start in the past');
  const party = scale('party', opts.party), minutes = scale('minutes', opts.minutes == null ? minutesFor(state, id) : opts.minutes);
  const extra = t.phase === 'seated' ? { ended: log(state, id, t, Math.min(now, moments(state, t).freeAt), running(state, t, now) ? 'manager' : 'auto') } : null;
  return put(state, id, { phase: 'reserved', party, at, minutes }, extra);
}

/* More time: extend(state, 'h1', { by: 15, now }). `by` defaults to the venue's extendBy. */
export function extend(state, id, opts = {}) {
  const t = known(state, id), now = time(opts.now), by = scale('extendBy', opts.by == null ? state.settings.extendBy : opts.by);
  if (!(t.phase === 'seated' && running(state, t, now))) fail('table ' + id + ' is not seated');
  const end = endOf(t);
  /* running: the end moves by `by`; time is up: the new end is now (to the whole minute) + `by` */
  const extended = now < end ? t.extended + by : Math.ceil((now - t.seatedAt) / MIN) - t.minutes + by;
  const next = Object.assign({}, t, { extended });
  const left = endOf(next) - now;
  next.warned = left <= state.settings.ending * MIN;      // the manager is looking at it now: no "ending soon" right after he asked for more
  next.alerted = false;                                   // the new end can tell him once more that time is up
  return put(state, id, next);
}

/* End a seating (early or after time is up) or drop a booking: free(state, 'h1', { now }). Freeing a free table is a no-op. */
export function free(state, id, opts = {}) {
  const t = known(state, id), now = time(opts.now);
  if (t.phase === 'free') return state;
  if (t.phase === 'reserved') return put(state, id, { phase: 'free' });
  const m = moments(state, t);
  const how = now < m.end ? 'early' : now < m.freeAt ? 'manager' : 'auto';
  return put(state, id, { phase: 'free' }, { ended: log(state, id, t, Math.min(now, m.freeAt), how) });
}

/* ---------- the clock ---------- */
/* The board calls this every second: → { state, events }. events: { type: 'ending' | 'over' | 'freed', tableId, at } in
   table order, `at` being the moment it happened (not now). The same state object comes back when nothing changed. */
export function tick(state, now) {
  now = time(now);
  const events = []; let next = state;
  for (const id of Object.keys(state.tables)) {
    const t = state.tables[id]; if (t.phase !== 'seated') continue;
    const m = moments(state, t);
    if (now >= m.freeAt) {
      events.push({ type: 'freed', tableId: id, at: m.freeAt });
      next = put(next, id, { phase: 'free' }, { ended: log(next, id, t, m.freeAt, 'auto') });
    } else if (now >= m.end) {
      if (!t.alerted) { events.push({ type: 'over', tableId: id, at: m.end }); next = put(next, id, Object.assign({}, t, { warned: true, alerted: true })); }
    } else if (now >= m.endingAt) {
      if (!t.warned) { events.push({ type: 'ending', tableId: id, at: m.endingAt }); next = put(next, id, Object.assign({}, t, { warned: true })); }
    }
  }
  return { state: next, events };
}

/* ---------- what the board shows ---------- */
/* status(state, id, now) → { phase, leftMs, endsAt, progress, ... }
   phase: free | reserved | seated | ending | over. leftMs: ms to the end (negative once time is up; to the booking for a
   reserved table; null when free). progress: the share of the time frame used, 0..1 (1 when over). For a seated table
   also: n, party, seatedAt, minutes, extended, total (minutes), freeAt (when it frees itself), overMs. */
export function status(state, id, now) {
  const t = known(state, id); now = time(now);
  if (t.phase === 'free') return { phase: 'free', leftMs: null, endsAt: null, progress: 0 };
  if (t.phase === 'reserved') return { phase: 'reserved', leftMs: t.at - now, endsAt: null, progress: 0, party: t.party, at: t.at, minutes: t.minutes };
  const m = moments(state, t);
  if (now >= m.freeAt) return { phase: 'free', leftMs: null, endsAt: null, progress: 0 };
  const total = (t.minutes + t.extended) * MIN, leftMs = m.end - now;
  const phase = now >= m.end ? 'over' : now >= m.endingAt ? 'ending' : 'seated';
  return { phase, leftMs, endsAt: m.end, progress: Math.min(1, Math.max(0, (now - t.seatedAt) / total)), n: t.n, party: t.party, seatedAt: t.seatedAt,
    minutes: t.minutes, extended: t.extended, total: t.minutes + t.extended, freeAt: m.freeAt, overMs: Math.max(0, now - m.end) };
}

/* When a new party could sit here: now for a free table and for one whose time is up ("after this the table frees up"),
   the end for a seated one, after the booking's own frame for a reserved one. */
export function availableAt(state, id, now) {
  const t = known(state, id); now = time(now);
  if (t.phase === 'free') return now;
  if (t.phase === 'reserved') return Math.max(now, t.at + t.minutes * MIN);
  return Math.max(now, endOf(t));
}
export const isAvailable = (state, id, now) => availableAt(state, id, now) <= time(now);

/* The tables in the order a manager reads them: time up first (the longest over first), then ending, then seated (least
   time left first), then reserved (the soonest first), then free (in floor order). */
export function byUrgency(state, now) {
  now = time(now);
  const rank = { over: 0, ending: 1, seated: 2, reserved: 3, free: 4 };
  return Object.keys(state.tables).map((id, i) => ({ id, i, s: status(state, id, now) }))
    .sort((a, b) => rank[a.s.phase] - rank[b.s.phase] || (a.s.leftMs == null ? 0 : a.s.leftMs - b.s.leftMs) || a.i - b.i)
    .map((x) => x.id);
}

/* ---------- storage ---------- */
/* Data from storage (or anywhere outside) → { ok: true, state } | { ok: false, errors }. Never throws. With `ids` (the
   layout's tables), the floor follows the layout: a new table starts free, a table that left is dropped, and so is its
   override. */
export function validateState(raw, ids) {
  const errors = [], err = (m) => errors.push(m);
  if (!isObj(raw)) return { ok: false, errors: ['not an object'] };
  if (raw.v !== 1) err('v must be 1');
  if (!(Number.isInteger(raw.seq) && raw.seq >= 0)) err('seq must be a whole number');
  let cfg = null;
  try { cfg = settings(raw.settings || {}, (raw.settings && raw.settings.overrides) || {}); } catch (e) { err('settings: ' + e.message); }
  if (!isObj(raw.tables)) err('tables must be an object');
  const want = Array.isArray(ids) ? ids : isObj(raw.tables) ? Object.keys(raw.tables) : [];
  const tables = {}, n = (v) => typeof v === 'number' && Number.isFinite(v);
  for (const id of want) {
    if (!ID.test(id)) { err('bad table id ' + JSON.stringify(id)); continue; }
    const t = isObj(raw.tables) && isObj(raw.tables[id]) ? raw.tables[id] : { phase: 'free' };
    if (t.phase === 'free') tables[id] = { phase: 'free' };
    else if (t.phase === 'reserved') {
      if (!(onScale(t.party, LIMITS.party) && n(t.at) && onScale(t.minutes, LIMITS.minutes))) err('tables.' + id + ': a reservation needs party, at and minutes');
      else tables[id] = { phase: 'reserved', party: t.party, at: t.at, minutes: t.minutes };
    } else if (t.phase === 'seated') {
      if (!(Number.isInteger(t.n) && t.n >= 1 && onScale(t.party, LIMITS.party) && n(t.seatedAt) && onScale(t.minutes, LIMITS.minutes) && Number.isInteger(t.extended) && t.extended >= 0)) err('tables.' + id + ': a seating needs n, party, seatedAt, minutes and extended');
      else tables[id] = { phase: 'seated', n: t.n, party: t.party, seatedAt: t.seatedAt, minutes: t.minutes, extended: t.extended, warned: t.warned === true, alerted: t.alerted === true };
    } else err('tables.' + id + ': unknown phase ' + JSON.stringify(t.phase));
  }
  if (!Object.keys(tables).length && !errors.length) err('a floor needs at least one table');
  const ended = Array.isArray(raw.ended) ? raw.ended.filter((e) => isObj(e) && typeof e.table === 'string' && n(e.endedAt) && ['early', 'manager', 'auto'].includes(e.how)).slice(-KEEP_ENDED)
    .map((e) => ({ table: e.table, n: e.n, party: e.party, seatedAt: e.seatedAt, minutes: e.minutes, extended: e.extended, endedAt: e.endedAt, how: e.how })) : [];
  if (errors.length) return { ok: false, errors };
  const overrides = {}; Object.keys(cfg.overrides).forEach((id) => { if (tables[id]) overrides[id] = cfg.overrides[id]; });
  const seq = Math.max(raw.seq, ...Object.values(tables).map((t) => t.n || 0));
  return { ok: true, state: { v: 1, seq, settings: Object.assign({}, cfg, { overrides }), tables, ended } };
}
