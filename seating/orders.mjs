/* The counter's queue for a self-service café: a guest orders at the counter and gets a number (and, if the counter
   knows it, a table); the barista moves the order New → Preparing → Ready → Picked up. "Ready" is the moment the guest's
   phone beeps. Pure ESM, no DOM, no clock of its own, immutable JSON state. Items are plain ids from the café's list (the
   screens name them); no prices: there are none to show.

   State (v1): { v: 1, seq, orders: [{ id, no, items: [itemId], table: id | null, phase, at: { new, preparing?, ready?, picked? } }] }
   - A number runs 1–99 and starts again at 1, skipping any number still in the queue.
   - Moves go forward only: new → preparing → ready → picked; Ready may be tapped straight from New (one big tap);
     back() undoes one mistaken tap (not after Picked up). A refused move throws an OrderError with a plain reason.
   - Picked-up orders are kept for the last 30, so the guest's phone can still say "picked up". */
export const ORDER_PHASES = ['new', 'preparing', 'ready', 'picked'];
const KEEP_PICKED = 30, ITEM = /^[a-z0-9][a-z0-9-]{0,39}$/, ID = /^[a-z0-9][a-z0-9_-]{0,39}$/;
/* a refusal: a plain reason, and a code the screens translate (floor/i18n.js err_*) */
export class OrderError extends Error { constructor(m, code) { super(m); this.name = 'OrderError'; this.code = code || 'refused'; } }
const fail = (m, code) => { throw new OrderError(m, code); };
const time = (v) => { const n = v instanceof Date ? v.getTime() : v; return typeof n === 'number' && Number.isFinite(n) ? n : fail('now must be a time', 'bad-time'); };
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const find = (state, id) => state.orders.find((o) => o.id === id) || fail('no such order ' + JSON.stringify(id), 'no-order');
const swap = (state, o) => Object.assign({}, state, { orders: state.orders.map((x) => (x.id === o.id ? o : x)) });
const trim = (orders) => { const picked = orders.filter((o) => o.phase === 'picked'); const drop = new Set(picked.slice(0, Math.max(0, picked.length - KEEP_PICKED)).map((o) => o.id)); return orders.filter((o) => !drop.has(o.id)); };

export const createOrders = () => ({ v: 1, seq: 0, orders: [] });

/* a new order: addOrder(state, { items: ['cappuccino', 'croissant'], table: 't3' | null, now }) → { state, order } */
export function addOrder(state, { items, table = null, now } = {}) {
  now = time(now);
  if (!Array.isArray(items) || !items.length || items.length > 20 || !items.every((i) => typeof i === 'string' && ITEM.test(i))) fail('an order needs 1–20 items from the list', 'items');
  if (table !== null && !(typeof table === 'string' && ID.test(table))) fail('table must be a table id or null', 'no-table');
  const busy = new Set(state.orders.filter((o) => o.phase !== 'picked').map((o) => o.no));
  if (busy.size >= 99) fail('99 orders are waiting: hand some out first', 'queue-full');
  let seq = state.seq, no;
  do { seq += 1; no = ((seq - 1) % 99) + 1; } while (busy.has(no));
  const order = { id: 'o' + seq, no, items: items.slice(), table, phase: 'new', at: { new: now } };
  return { state: Object.assign({}, state, { seq, orders: trim(state.orders.concat([order])) }), order };
}
/* the barista's tap: advance(state, id, 'preparing' | 'ready' | 'picked', { now }) */
export function advance(state, id, to, { now } = {}) {
  now = time(now); const o = find(state, id), from = ORDER_PHASES.indexOf(o.phase), at = ORDER_PHASES.indexOf(to);
  if (at < 0) fail('unknown step ' + JSON.stringify(to), 'bad-step');
  if (at <= from) fail('order #' + o.no + ' is already ' + o.phase, 'already');
  if (to === 'picked' && o.phase !== 'ready') fail('order #' + o.no + ' is not ready yet', 'not-ready');
  if (to === 'preparing' && from !== 0) fail('order #' + o.no + ' is past preparing', 'already');
  const next = Object.assign({}, o, { phase: to, at: Object.assign({}, o.at, { [to]: now }) });
  return { state: Object.assign(swap(state, next), { orders: trim(swap(state, next).orders) }), order: next };
}
/* one step back after a mistaken tap (not from picked up, not from new) */
export function back(state, id) {
  const o = find(state, id), i = ORDER_PHASES.indexOf(o.phase);
  if (o.phase === 'picked' || i === 0) fail('order #' + o.no + ' cannot go back from ' + o.phase, 'cannot-back');
  const at = Object.assign({}, o.at); delete at[o.phase];
  const prev = ORDER_PHASES.slice(0, i).reverse().find((p) => at[p] != null) || 'new';
  const next = Object.assign({}, o, { phase: prev, at });
  return { state: swap(state, next), order: next };
}
/* the counter attaches a table later (or takes it off: null) */
export function attach(state, id, table) {
  if (table !== null && !(typeof table === 'string' && ID.test(table))) fail('table must be a table id or null');
  const next = Object.assign({}, find(state, id), { table }); return { state: swap(state, next), order: next };
}

/* what the screens read */
export const waiting = (state) => state.orders.filter((o) => o.phase !== 'picked');
export const byPhase = (state, phase) => state.orders.filter((o) => o.phase === phase).sort((a, b) => a.at[a.phase] - b.at[b.phase] || a.at.new - b.at.new);
/* the guest's order by its number: the one in the queue, else the latest picked up with that number */
export function byNumber(state, no) { const list = state.orders.filter((o) => o.no === no); return list.find((o) => o.phase !== 'picked') || list[list.length - 1] || null; }
/* the orders the counter attached to a table and not yet picked up */
export const forTable = (state, table) => state.orders.filter((o) => o.table === table && o.phase !== 'picked');

export function validateOrders(raw) { try { return checkOrders(raw); } catch (e) { return { ok: false, errors: ['malformed orders'] }; } }
function checkOrders(raw) {
  if (!isObj(raw) || raw.v !== 1 || !Number.isInteger(raw.seq) || !Array.isArray(raw.orders)) return { ok: false, errors: ['not an orders state'] };
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const orders = raw.orders.filter((o) => isObj(o) && typeof o.id === 'string' && Number.isInteger(o.no) && o.no >= 1 && o.no <= 99 && Array.isArray(o.items) && o.items.length && o.items.every((i) => typeof i === 'string' && ITEM.test(i))
    && ORDER_PHASES.includes(o.phase) && isObj(o.at) && num(o.at.new) && (o.table === null || (typeof o.table === 'string' && ID.test(o.table))))
    .map((o) => ({ id: o.id, no: o.no, items: o.items.slice(0, 20), table: o.table, phase: o.phase, at: Object.fromEntries(ORDER_PHASES.filter((p) => num(o.at[p])).map((p) => [p, o.at[p]])) }));
  return { ok: true, state: { v: 1, seq: raw.seq, orders: trim(orders) } };
}
