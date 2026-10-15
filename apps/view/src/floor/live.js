/* The café's live picture, shared by the board and the guest's phone in one browser: localStorage (one versioned key per
   part) and a BroadcastChannel that says "this part changed". Every part passes its validator on the way in, so nothing
   malformed from storage reaches a screen. A demo: no names, no phones, nothing leaves this browser. In production these
   parts are tables behind RLS with a realtime channel (db/proposed/0007_floor.sql, seating/README.md).
   Parts: clock (the demo clock: a start time and a speed), timers (seating/timers.mjs), orders (orders.mjs), bids (bids.mjs),
   rules (frames and peak windows: peaks.mjs), layout (the owner's edited floor; Lima's draft when there is none). */
import { validateLayout } from '../../../seating/validate.mjs';
import { createState, settings, seat, reserve, tick, validateState, MIN } from '../../../seating/timers.mjs';
import { validatePeaks, validateFrames } from '../../../seating/peaks.mjs';
import { createBids, placeBid, validateBids } from '../../../seating/bids.mjs';
import { createOrders, addOrder, advance, attach, validateOrders } from '../../../seating/orders.mjs';
import lima from '../../../seating/fixtures/lima.layout.json';

export const DEMOS = { lima };
const V = 'v1';
export function createLive(venue, { storage } = {}) {
  const base = 'mana-floor:' + V + ':' + venue + ':', mem = {}, listeners = new Set();
  const get = (part) => { let raw = null; try { raw = storage ? storage.getItem(base + part) : mem[part]; } catch (e) { raw = mem[part]; } try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
  let ch = null; try { ch = new BroadcastChannel('mana-floor:' + venue); ch.onmessage = (e) => listeners.forEach((fn) => fn(e.data || {})); } catch (e) { ch = null; }
  const put = (part, value, quiet) => { const s = JSON.stringify(value); mem[part] = s; try { if (storage) storage.setItem(base + part, s); } catch (e) { /* kept in memory */ } if (!quiet && ch) try { ch.postMessage({ part }); } catch (e) { /* closed */ } };
  if (typeof window !== 'undefined') window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith(base)) listeners.forEach((fn) => fn({ part: e.key.slice(base.length) })); });
  return {
    base, get, put,
    drop(part) { delete mem[part]; try { if (storage) storage.removeItem(base + part); } catch (e) { /* fine */ } if (ch) try { ch.postMessage({ part }); } catch (e) { /* closed */ } },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    say(msg) { if (ch) try { ch.postMessage(msg); } catch (e) { /* closed */ } }
  };
}

/* the floor: the owner's saved one, else the café's draft */
export function loadLayout(live, venue) {
  const saved = live.get('layout'); if (saved) { const v = validateLayout(saved); if (v.ok && v.layout.venue === venue) return { layout: v.layout, edited: true }; }
  const v = validateLayout(DEMOS[venue]); return v.ok ? { layout: v.layout, edited: false } : null;
}

/* the demo clock: on the first visit it starts at 09:35 today (just before the example's 10:00 peak), and runs at `speed` */
export function demoClock(live, speed) {
  let c = live.get('clock');
  if (!c || !Number.isFinite(c.real) || !Number.isFinite(c.virt) || !(c.speed >= 1)) { const d = new Date(); d.setHours(9, 35, 0, 0); c = { real: Date.now(), virt: d.getTime(), speed: speed || 1 }; live.put('clock', c, true); }
  else if (speed && speed !== c.speed) { c = { real: Date.now(), virt: c.virt + (Date.now() - c.real) * c.speed, speed }; live.put('clock', c, true); }
  return c;
}
export const clockNow = (c) => c.virt + (Date.now() - c.real) * c.speed;

/* the example's owner settings (they say "example" wherever they show) */
export const EXAMPLE = {
  peaks: { windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '10:00', to: '13:00' }], slot: 90, opensBefore: 120, closeBefore: 10 },
  frames: { zones: { lounge: 120 }, peak: { minutes: 75, zones: { wall: 60 } } },
  bids: { tables: ['l1', 't6'], min: 10, step: 5, credit: true },
  timer: { minutes: 90, ending: 5, grace: 10, extendBy: 15 }
};

export function loadRules(live, layout) {
  const r = live.get('rules') || {}, p = validatePeaks(r.peaks || EXAMPLE.peaks), f = validateFrames(r.frames || EXAMPLE.frames, layout);
  return { peaks: p.ok ? p.peaks : validatePeaks(EXAMPLE.peaks).peaks, frames: f.ok ? f.frames : validateFrames(EXAMPLE.frames, layout).frames };
}
export function loadParts(live, layout) {
  const ids = layout.tables.map((t) => t.id);
  const tv = live.get('timers') ? validateState(live.get('timers'), ids) : { ok: false };
  const ov = live.get('orders') ? validateOrders(live.get('orders')) : { ok: false };
  const bv = live.get('bids') ? validateBids(live.get('bids'), layout) : { ok: false };
  return { timers: tv.ok ? tv.state : null, orders: ov.ok ? ov.state : null, bids: bv.ok ? bv.state : null };
}

/* The demo's morning at 09:35: a few tables seated (one along the wall about to end), a booking for the plank table at
   10:15, three orders at the counter (#23 attached to table 3 along the wall), and one sample bid for the sofa corner.
   Every number here is a sample. */
export function seedMorning(layout, now) {
  const has = (id) => layout.tables.some((t) => t.id === id);
  let timers = createState(layout.tables, settings(EXAMPLE.timer, {}));
  [['t2', 1, 31, 60], ['t5', 2, 56, 60], ['r2', 2, 30, 90], ['r4', 3, 70, 90], ['i1', 2, 12, 90], ['t8', 3, 41, 90], ['t10', 2, 88, 90]].forEach(([id, party, ago, minutes]) => { if (has(id)) timers = seat(timers, id, { party, now: now - ago * MIN, minutes }); });
  if (has('t1')) timers = reserve(timers, 't1', { party: 4, at: now + 40 * MIN, now, minutes: 90 });
  timers = tick(timers, now).state;
  let orders = Object.assign(createOrders(), { seq: 20 });
  orders = addOrder(orders, { items: ['cappuccino', 'croissant'], table: has('r2') ? 'r2' : null, now: now - 6 * MIN }).state;
  orders = advance(orders, orders.orders[0].id, 'preparing', { now: now - 4 * MIN }).state;
  orders = addOrder(orders, { items: ['iced-coffee'], now: now - 2 * MIN }).state;
  const o23 = addOrder(orders, { items: ['espresso', 'cookie'], now: now - MIN }); orders = o23.state;
  if (has('t3')) orders = attach(orders, o23.order.id, 't3').state;
  let bids = createBids({ tables: EXAMPLE.bids.tables.filter(has), min: EXAMPLE.bids.min, step: EXAMPLE.bids.step, credit: true }, layout);
  const peaks = validatePeaks(EXAMPLE.peaks).peaks, d = new Date(now); d.setHours(10, 0, 0, 0);
  if (has('l1')) { const r = placeBid(bids, { table: 'l1', start: d.getTime(), guest: 'guest-sample-1', party: 2, amount: 15 }, { layout, peaks, now: now - 10 * MIN }); if (r.ok) bids = r.state; }
  return { timers, orders, bids };
}
