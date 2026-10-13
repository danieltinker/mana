/* Bidding on tables at peak: a guest offers an amount for a table and a time slot; when bidding closes the highest offer
   wins and the table is held for that slot (violet on the board); the others are released. It should feel like reserving
   the best seat, not paying for a chair: by default the winning amount is credited to the guest's order. Pure ESM, no
   DOM, no clock of its own, immutable JSON state; the same shape as the request machine in validate.mjs. Nothing here
   moves money: in the demo the amounts are samples and nothing is charged.

   The rules (seating/README.md has them in words)
   - The owner chooses which tables can be bid for (rules.tables), a minimum bid and a step, and whether the winning amount
     is credited to the order (rules.credit, default true). Bidding happens only for a slot of a peak window
     (seating/peaks.mjs), from `opensBefore` until `closeBefore` minutes before the slot starts.
   - A bid is a whole amount ≥ the minimum; when someone leads, ≥ the leader's amount + the step. The party must fit the
     table (validate.mjs fits). The leader cannot outbid himself. A guest leads at most one table per slot.
   - One auction per table and slot, made by its first bid:
         open ──bid──▶ open                  (the new bid leads; the previous leader is `outbid`)
         open ──close (tick, at closesAt)──▶ won (the highest bid) | unsold (no bids)
         open ──accept (the owner, early)──▶ won
         open ──decline (the owner, a reason)──▶ declined   (every bid released)
         won  ──release (the owner)──▶ released             won ──(tick, the slot ends)──▶ done
     A refused move returns { ok: false, error } and changes nothing.
   - A won auction holds its table from the moment it closes until its slot ends (holdAt); the board shows it violet
     and seats the winner when they arrive (timers.seat with the slot's minutes).

   State (v1): { v: 1, seq, rules: { tables: [id], min, step, credit },
                 auctions: { key: { key, table, start, end, closesAt, phase, bids: [{ id, guest, party, amount, at, status }],
                                    winner: bidId | null, reason, decidedAt } } }    key = table + '@' + start */
import { slotAt } from './peaks.mjs';
import { fits } from './validate.mjs';

export const BID_PHASES = ['open', 'won', 'unsold', 'declined', 'released', 'done'];
export const BID_LIMITS = Object.freeze({ min: [1, 1000], step: [1, 500] });
export const BID_DEFAULTS = Object.freeze({ min: 10, step: 5, credit: true });
const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/, GUEST = /^[A-Za-z0-9_-]{4,64}$/;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const whole = (v, [lo, hi]) => Number.isInteger(v) && v >= lo && v <= hi;
const t = (v) => (v instanceof Date ? v.getTime() : v);
const ok = (state, extra) => Object.assign({ ok: true, state }, extra || {});
/* a refusal carries a plain reason (for logs and tests) and a code the screens translate (floor/i18n.js err_*) */
const no = (error, code = 'refused', extra) => Object.assign({ ok: false, error, code }, extra || {});
export const keyOf = (table, start) => table + '@' + t(start);
const put = (state, a) => Object.assign({}, state, { auctions: Object.assign({}, state.auctions, { [a.key]: a }) });

/* the owner's rules, checked: → { ok, rules | error } */
export function bidRules(raw = {}, layout) {
  const r = Object.assign({}, BID_DEFAULTS, { tables: [] }, raw || {});
  if (!Array.isArray(r.tables) || !r.tables.every((x) => typeof x === 'string' && ID.test(x))) return no('tables must be a list of table ids', 'bad-rules');
  if (layout) { const bad = r.tables.find((x) => !layout.tables.some((tb) => tb.id === x && tb.bookable)); if (bad) return no('table ' + bad + ' is not a bookable table of the layout', 'bad-rules'); }
  if (!whole(r.min, BID_LIMITS.min)) return no('the minimum bid must be a whole amount 1–1000', 'bad-rules');
  if (!whole(r.step, BID_LIMITS.step)) return no('the step must be a whole amount 1–500', 'bad-rules');
  if (typeof r.credit !== 'boolean') return no('credit must be true or false', 'bad-rules');
  return { ok: true, rules: { tables: [...new Set(r.tables)], min: r.min, step: r.step, credit: r.credit } };
}
export function createBids(rules, layout) { const r = bidRules(rules, layout); if (!r.ok) throw new Error(r.error); return { v: 1, seq: 0, rules: r.rules, auctions: {} }; }
/* the owner changes the rules; running auctions keep their bids (a new minimum applies to the next bid) */
/* The owner changes the rules (configureBids(state, patch, layout, { now })). Running auctions keep their bids (a new
   minimum applies to the next bid); a table taken off the list has its open auctions declined: "this time is no longer
   open" (reasonCode 'no-longer-open', which the screens translate). */
export function configureBids(state, patch, layout, { now } = {}) {
  const r = bidRules(Object.assign({}, state.rules, patch), layout); if (!r.ok) return r;
  let next = Object.assign({}, state, { rules: r.rules });
  Object.values(next.auctions).forEach((a) => { if (a.phase === 'open' && !r.rules.tables.includes(a.table)) next = put(next, closeAsGone(a, now)); });
  return ok(next);
}
const closeAsGone = (a, now) => Object.assign({}, a, { phase: 'declined', reason: '', reasonCode: 'no-longer-open', decidedAt: t(now == null ? Date.now() : now), bids: a.bids.map((x) => Object.assign({}, x, { status: 'released' })) });
/* The owner changed the peak hours: an open auction whose slot is no longer a peak slot (or no longer the same slot) is
   declined with "this time is no longer open". → the same state object when nothing changed */
export function reconcileBids(state, peaks, now) {
  let next = state;
  Object.values(state.auctions).forEach((a) => { if (a.phase !== 'open') return; const sl = slotAt(peaks, a.start); if (!sl || sl.end !== a.end || sl.closesAt !== a.closesAt) next = put(next, closeAsGone(a, now)); });
  return next;
}

export const leaderOf = (a) => (a ? a.bids.find((b) => b.status === 'leading') || null : null);
/* the least a guest may offer now: the minimum, or the leader + the step */
export const minNext = (state, a) => { const l = leaderOf(a); return l ? l.amount + state.rules.step : state.rules.min; };

/* A guest bids: placeBid(state, { table, start, guest, party, amount }, { layout, peaks, now }) → { ok, state, bid } | { ok: false, error } */
export function placeBid(state, b, { layout, peaks, now }) {
  now = t(now);
  if (!isObj(b)) return no('a bid needs table, start, guest, party and amount', 'bad-bid');
  if (!(typeof b.guest === 'string' && GUEST.test(b.guest))) return no('a bid needs a guest id', 'bad-bid');
  const tb = layout.tables.find((x) => x.id === b.table); if (!tb) return no('unknown table ' + JSON.stringify(b.table), 'no-table');
  if (!state.rules.tables.includes(tb.id)) return no('this table cannot be bid for', 'not-biddable');
  const slot = slotAt(peaks, t(b.start)); if (!slot) return no('there is no peak slot at that time', 'no-slot');
  if (now < slot.opensAt) return no('bidding for this slot has not opened yet', 'not-open');
  if (now >= slot.closesAt) return no('bidding for this slot has closed', 'closed');
  if (!fits(tb, b.party)) return no('this table does not fit a party of ' + b.party, 'party', { n: b.party });
  if (!Number.isInteger(b.amount) || b.amount < 1) return no('the amount must be a whole number', 'bad-amount');
  const key = keyOf(tb.id, slot.start), a = state.auctions[key] || { key, table: tb.id, start: slot.start, end: slot.end, closesAt: slot.closesAt, phase: 'open', bids: [], winner: null, reason: '', decidedAt: null };
  if (a.phase !== 'open') return no('this auction is ' + a.phase, 'closed');
  if (now >= a.closesAt) return no('bidding for this slot has closed', 'closed');                   // the stored auction's own close (the peak hours may have moved)
  const lead = leaderOf(a);
  if (lead && lead.guest === b.guest) return no('you are already leading', 'leading');
  const elsewhere = Object.values(state.auctions).find((x) => x.key !== key && x.start === slot.start && x.phase === 'open' && (leaderOf(x) || {}).guest === b.guest);
  if (elsewhere) return no('you are leading at another table for this time; one table per guest', 'one-table');
  const least = minNext(state, a);
  if (b.amount < least) return no((lead ? 'the next bid is at least ' : 'the minimum bid is ') + least, 'too-low', { n: least });
  const seq = state.seq + 1, bid = { id: 'b' + seq, guest: b.guest, party: b.party, amount: b.amount, at: now, status: 'leading' };
  const bids = a.bids.map((x) => (x.status === 'leading' ? Object.assign({}, x, { status: 'outbid' }) : x)).concat([bid]);
  return ok(Object.assign(put(state, Object.assign({}, a, { bids })), { seq }), { bid, outbid: lead });
}

const settle = (a, now, how) => {
  const lead = leaderOf(a);
  if (!lead) return Object.assign({}, a, { phase: 'unsold', decidedAt: now });
  return Object.assign({}, a, { phase: 'won', winner: lead.id, decidedAt: now, how, bids: a.bids.map((x) => Object.assign({}, x, { status: x.id === lead.id ? 'won' : 'lost' })) });
};
/* The owner accepts the leading bid before the close: accept(state, key, { now }) */
export function accept(state, key, { now } = {}) {
  const a = state.auctions[key]; if (!a) return no('no such auction', 'no-auction');
  if (a.phase !== 'open') return no('only an open auction can be accepted', 'not-open-auction');
  if (!leaderOf(a)) return no('there is no bid to accept', 'no-leader');
  return ok(put(state, settle(a, t(now), 'accepted')));
}
/* The owner says no to this table and slot: decline(state, key, { reason, now }); every bid is released */
export function decline(state, key, { reason, now } = {}) {
  const a = state.auctions[key]; if (!a) return no('no such auction', 'no-auction');
  if (a.phase !== 'open') return no('only an open auction can be declined', 'not-open-auction');
  if (!(typeof reason === 'string' && reason.trim() && reason.length <= 200)) return no('a decline needs a reason the guests will read', 'need-reason');
  return ok(put(state, Object.assign({}, a, { phase: 'declined', reason: reason.trim(), decidedAt: t(now), bids: a.bids.map((x) => Object.assign({}, x, { status: 'released' })) })));
}
/* The owner frees a held table (the guest did not come, or the owner needs it): release(state, key, { now }) */
export function release(state, key, { now } = {}) {
  const a = state.auctions[key]; if (!a) return no('no such auction', 'no-auction');
  if (a.phase !== 'won') return no('only a won auction holds a table', 'not-won');
  return ok(put(state, Object.assign({}, a, { phase: 'released', decidedAt: t(now) })));
}
/* The clock: tick(state, now) → { state, events: [{ type: 'won' | 'unsold' | 'done', key, at }] }; same object when nothing changed */
export function tickBids(state, now) {
  now = t(now); let next = state; const events = [];
  for (const key of Object.keys(state.auctions).sort()) {
    const a = state.auctions[key];
    if (a.phase === 'open' && now >= a.closesAt) { const s = settle(a, a.closesAt, 'closed'); next = put(next, s); events.push({ type: s.phase, key, at: a.closesAt }); }
    else if (a.phase === 'won' && now >= a.end) { next = put(next, Object.assign({}, a, { phase: 'done' })); events.push({ type: 'done', key, at: a.end }); }
  }
  return { state: next, events };
}

/* ---------- what the screens read ---------- */
/* the won auction that holds a table now, or null. A hold runs from the slot's start (or the owner's early accept, if that
   came later) to the slot's end, so back-to-back slots never hold one table twice. Between the close and the slot's start
   the table is promised (wonAhead) but not held. */
export const holdFrom = (a) => Math.max(a.decidedAt == null ? a.start : a.decidedAt, a.start);
export function holdAt(state, table, now) {
  now = t(now);
  return Object.values(state.auctions).find((a) => a.table === table && a.phase === 'won' && now >= holdFrom(a) && now < a.end) || null;
}
/* the won auction whose slot is still ahead for a table (promised, not yet held), or null */
export function wonAhead(state, table, now) { now = t(now); return Object.values(state.auctions).find((a) => a.table === table && a.phase === 'won' && now < holdFrom(a)) || null; }
/* the auction for a table and slot (it may not exist yet: then a fresh open one is described) */
export function auctionFor(state, table, slot) { return state.auctions[keyOf(table, slot.start)] || { key: keyOf(table, slot.start), table, start: slot.start, end: slot.end, closesAt: slot.closesAt, phase: 'open', bids: [], winner: null, reason: '', decidedAt: null }; }
/* where a guest stands in an auction: 'none' | 'leading' | 'outbid' | 'won' | 'lost' | 'released' | 'declined' */
export function standing(a, guest) {
  const mine = a.bids.filter((b) => b.guest === guest); if (!mine.length) return 'none';
  if (a.phase === 'declined') return 'declined';
  if (mine.some((b) => b.status === 'won')) return a.phase === 'released' ? 'released' : 'won';
  if (mine.some((b) => b.status === 'leading')) return 'leading';
  return a.phase === 'open' ? 'outbid' : 'lost';
}

/* ---------- storage ---------- */
/* never throws: anything malformed is dropped or refused */
export function validateBids(raw, layout) { try { return checkBids(raw, layout); } catch (e) { return { ok: false, errors: ['malformed bids state'] }; } }
function checkBids(raw, layout) {
  if (!isObj(raw) || raw.v !== 1 || !isObj(raw.auctions) || !Number.isInteger(raw.seq)) return { ok: false, errors: ['not a bids state'] };
  const rules = isObj(raw.rules) ? raw.rules : {}, list = Array.isArray(rules.tables) ? rules.tables : [];
  const r = bidRules(Object.assign({}, rules, { tables: list.filter((x) => typeof x === 'string' && (!layout || layout.tables.some((tb) => tb.id === x && tb.bookable))) }), layout);
  if (!r.ok) return { ok: false, errors: [r.error] };
  const auctions = {}, num = (v) => typeof v === 'number' && Number.isFinite(v);
  for (const k of Object.keys(raw.auctions)) {
    const a = raw.auctions[k];
    if (!isObj(a) || !BID_PHASES.includes(a.phase) || !num(a.start) || !num(a.end) || !num(a.closesAt) || !Array.isArray(a.bids) || keyOf(a.table, a.start) !== k) continue;
    if (layout && !layout.tables.some((tb) => tb.id === a.table)) continue;                  // the table left the floor
    const bids = a.bids.filter((b) => isObj(b) && typeof b.id === 'string' && GUEST.test(b.guest || '') && Number.isInteger(b.amount) && num(b.at) && ['leading', 'outbid', 'won', 'lost', 'released'].includes(b.status))
      .map((b) => ({ id: b.id, guest: b.guest, party: b.party, amount: b.amount, at: b.at, status: b.status }));
    auctions[k] = { key: k, table: a.table, start: a.start, end: a.end, closesAt: a.closesAt, phase: a.phase, bids, winner: typeof a.winner === 'string' ? a.winner : null, reason: typeof a.reason === 'string' ? a.reason : '', reasonCode: a.reasonCode === 'no-longer-open' ? a.reasonCode : undefined, decidedAt: num(a.decidedAt) ? a.decidedAt : null, how: a.how };
  }
  return { ok: true, state: { v: 1, seq: raw.seq, rules: r.rules, auctions } };
}
