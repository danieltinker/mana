/* Mana's own ledger (R2 §5.1): bill, bill_share, payment_intent, tip, refund. Provider-neutral, so split bills and tips
   work the same on Grow, PayPlus or any later adapter. Integer agorot only. One state machine per payment_intent. An
   idempotency key is unique per intent: the same key twice is the same intent, never a second charge. A split bill is N
   intents against one bill; the bill closes when the captured shares reach its total. Tips are their own rows (payouts,
   reporting) and a line item on the intent (so the document is right); they never count towards the bill's total.
   This in-memory ledger is the reference the proposed SQL (db/proposed/0005_payments.sql) mirrors; it keeps every rule
   the database will enforce so the rules can be tested without one. */
import { PaymentError, assertAgorot, INTENTS } from './port.mjs';

/** @typedef {'created'|'pending'|'authorized'|'captured'|'released'|'failed'|'refunded_partial'|'refunded_full'} IntentState */
export const INTENT_STATES = Object.freeze(['created', 'pending', 'authorized', 'captured', 'released', 'failed', 'refunded_partial', 'refunded_full']);
/** created → pending (the checkout is open) → authorized (a hold) | captured (paid) | failed; a hold → captured | released |
 *  failed (expired); captured → refunded_partial → refunded_full. released, failed and refunded_full are final. */
export const TRANSITIONS = Object.freeze({
  created: ['pending', 'failed'],
  pending: ['authorized', 'captured', 'failed'],
  authorized: ['captured', 'released', 'failed'],
  captured: ['refunded_partial', 'refunded_full'],
  refunded_partial: ['refunded_partial', 'refunded_full'],
  released: [], failed: [], refunded_full: [],
});
export const FINAL = Object.freeze(['released', 'failed', 'refunded_full']);

export class Ledger {
  /** @param {{now?: () => string, id?: () => string}} [opts] a clock and an id maker, replaceable for deterministic tests */
  constructor(opts = {}) {
    let n = 0;
    this.now = opts.now || (() => new Date().toISOString());
    this.newId = opts.id || ((kind) => kind + '_' + String(++n).padStart(4, '0'));
    this.bills = new Map(); this.shares = new Map(); this.intents = new Map(); this.tips = new Map(); this.refunds = new Map();
    this.byKey = new Map();            // idempotencyKey → intent id
    this.byRef = new Map();            // providerRef → intent id
    this.journal = [];                 // every change, append-only (what the SQL keeps as payment_events)
  }

  /* ------------------------------------------------------------------ bills */
  /** Opens a bill for a table. Lines are what was ordered; the total is their sum (agorot). */
  openBill({ restaurantId, table = null, lines = [], currency = 'ILS' }) {
    if (typeof restaurantId !== 'string' || !restaurantId) throw new PaymentError('bad_request', 'restaurantId');
    if (currency !== 'ILS') throw new PaymentError('bad_request', 'currency is ILS');
    const items = lines.map((l, i) => ({ idx: i, name: String(l.name || ''), qty: l.qty ?? 1, unitAmount: assertAgorot(l.unitAmount, 'lines[].unitAmount'), kind: l.kind || 'dish' }));
    for (const it of items) if (!Number.isSafeInteger(it.qty) || it.qty < 1) throw new PaymentError('bad_request', 'lines[].qty');
    const bill = { id: this.newId('bill'), restaurantId, table, currency, lines: items, total: items.reduce((s, it) => s + it.qty * it.unitAmount, 0),
      captured: 0, refunded: 0, status: 'open', createdAt: this.now(), closedAt: null };
    this.bills.set(bill.id, bill); this.log('bill.open', bill.id, { total: bill.total });
    return bill;
  }
  bill(id) { const b = this.bills.get(id); if (!b) throw new PaymentError('not_found', 'bill ' + id); return b; }
  /** What is still owed on a bill, counting only captured shares (not tips, not holds). */
  outstanding(billId) { const b = this.bill(billId); return Math.max(0, b.total - b.captured); }

  /* ----------------------------------------------------------------- shares */
  /** N equal shares; the remainder in agorot goes one each to the first shares, so the shares sum to the total exactly. */
  splitEqual(billId, n) {
    const b = this.bill(billId); if (!Number.isSafeInteger(n) || n < 1) throw new PaymentError('bad_request', 'n ≥ 1');
    if (this.sharesOf(billId).length) throw new PaymentError('bad_state', 'the bill is already split');
    const each = Math.floor(b.total / n), rest = b.total - each * n;
    return Array.from({ length: n }, (_, i) => this.addShare(billId, each + (i < rest ? 1 : 0), { kind: 'equal', seat: i + 1 }));
  }
  /** Shares by items: each group is a list of line indexes; a line is in one group at most; what is in no group stays on the bill. */
  splitByItems(billId, groups) {
    const b = this.bill(billId), seen = new Set();
    if (this.sharesOf(billId).length) throw new PaymentError('bad_state', 'the bill is already split');
    return groups.map((g, i) => { let sum = 0; for (const idx of g) { const l = b.lines[idx]; if (!l) throw new PaymentError('bad_request', 'no line ' + idx); if (seen.has(idx)) throw new PaymentError('bad_request', 'line ' + idx + ' in two shares'); seen.add(idx); sum += l.qty * l.unitAmount; }
      return this.addShare(billId, sum, { kind: 'items', seat: i + 1, lines: [...g] }); });
  }
  /** One share of a bill (by seat, by items, equal or a custom amount). The shares of a bill never exceed its total. */
  addShare(billId, amount, { kind = 'custom', seat = null, lines = null } = {}) {
    const b = this.bill(billId); assertAgorot(amount, 'share'); if (amount === 0) throw new PaymentError('bad_amount', 'a share is > 0');
    const sum = this.sharesOf(billId).reduce((s, x) => s + x.amount, 0);
    if (sum + amount > b.total) throw new PaymentError('bad_amount', 'shares would exceed the bill: ' + (sum + amount) + ' > ' + b.total);
    const share = { id: this.newId('share'), billId, kind, seat, lines, amount, intentId: null, createdAt: this.now() };
    this.shares.set(share.id, share); this.log('share.add', share.id, { billId, amount }); return share;
  }
  sharesOf(billId) { return [...this.shares.values()].filter((s) => s.billId === billId); }

  /* ---------------------------------------------------------------- intents */
  /** A payment intent for a bill (or one of its shares), plus a tip. `amount` is the share of the bill; the provider is asked
   *  for amount + tip. The same idempotency key returns the same intent; the same key with other numbers is refused. */
  createIntent({ billId, shareId = null, amount, tip = 0, intent = 'charge', idempotencyKey, items = null }) {
    const b = this.bill(billId); assertAgorot(amount); assertAgorot(tip, 'tip');
    if (!INTENTS.includes(intent)) throw new PaymentError('bad_request', 'intent');
    if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8) throw new PaymentError('bad_request', 'idempotencyKey (≥ 8 chars)');
    const dup = this.byKey.get(idempotencyKey);
    if (dup) { const d = this.intents.get(dup); if (d.billId === billId && d.amount === amount && d.tip === tip && d.kind === intent && d.shareId === shareId) return d;
      throw new PaymentError('duplicate', 'idempotency key ' + idempotencyKey + ' already names intent ' + d.id + ' with other terms'); }
    if (intent !== 'tokenize' && amount === 0 && tip === 0) throw new PaymentError('bad_amount', 'nothing to pay');
    if (b.status !== 'open') throw new PaymentError('bad_state', 'bill ' + billId + ' is ' + b.status);
    let share = null;
    if (shareId) { share = this.shares.get(shareId); if (!share || share.billId !== billId) throw new PaymentError('not_found', 'share ' + shareId + ' of bill ' + billId);
      if (share.intentId && !FINAL.includes(this.intents.get(share.intentId).state)) throw new PaymentError('bad_state', 'share ' + shareId + ' already has an open intent');
      if (amount !== share.amount) throw new PaymentError('bad_amount', 'share ' + shareId + ' is ' + share.amount + ', not ' + amount); }
    else if (intent !== 'tokenize' && amount > this.outstanding(billId)) throw new PaymentError('bad_amount', 'amount ' + amount + ' is more than the ' + this.outstanding(billId) + ' outstanding');
    const lines = items || (share && share.lines ? share.lines.map((i) => b.lines[i]) : [{ name: share ? 'Share ' + (share.seat ?? share.id) : 'Bill ' + b.id, qty: 1, unitAmount: amount, kind: 'other' }]);
    const it = { id: this.newId('intent'), billId, shareId, kind: intent, amount, tip, total: amount + tip, state: 'created', idempotencyKey, provider: null, providerRef: null, txnRef: null, token: null,
      held: 0, captured: 0, capturedShare: 0, refunded: 0, refundCount: 0, items: lines.map((l) => ({ name: l.name, qty: l.qty, unitAmount: l.unitAmount, kind: l.kind || 'dish' })), history: [], createdAt: this.now(), updatedAt: this.now() };
    if (tip > 0) { it.items.push({ name: 'Tip', qty: 1, unitAmount: tip, kind: 'tip' }); const t = { id: this.newId('tip'), billId, intentId: it.id, amount: tip, collected: 0, state: 'pending', createdAt: this.now() }; this.tips.set(t.id, t); it.tipId = t.id; }
    this.intents.set(it.id, it); this.byKey.set(idempotencyKey, it.id); if (share) share.intentId = it.id;
    this.log('intent.create', it.id, { billId, amount, tip, intent }); return it;
  }
  intent(id) { const i = this.intents.get(id); if (!i) throw new PaymentError('not_found', 'intent ' + id); return i; }
  intentByRef(ref) { const id = this.byRef.get(ref); if (!id) throw new PaymentError('not_found', 'no intent for provider ref ' + ref); return this.intents.get(id); }
  intentsOf(billId) { return [...this.intents.values()].filter((i) => i.billId === billId); }
  tipsOf(billId) { return [...this.tips.values()].filter((t) => t.billId === billId); }

  /** The provider's checkout was created for this intent. */
  attachCheckout(intentId, { provider, providerRef }) {
    const it = this.intent(intentId); if (typeof providerRef !== 'string' || !providerRef) throw new PaymentError('bad_request', 'providerRef');
    if (this.byRef.has(providerRef) && this.byRef.get(providerRef) !== intentId) throw new PaymentError('duplicate', 'provider ref ' + providerRef + ' belongs to another intent');
    it.provider = provider; it.providerRef = providerRef; this.byRef.set(providerRef, intentId); this.transition(intentId, 'pending', { providerRef }); return it;
  }
  /** The one state machine. Every change goes through here and into the journal. */
  transition(intentId, to, detail = {}) {
    const it = this.intent(intentId), from = it.state;
    if (!INTENT_STATES.includes(to)) throw new PaymentError('bad_state', 'no state ' + to);
    if (!TRANSITIONS[from].includes(to)) throw new PaymentError('bad_state', 'intent ' + it.id + ': ' + from + ' → ' + to + ' is not allowed');
    it.state = to; it.updatedAt = this.now(); it.history.push({ from, to, at: it.updatedAt, ...detail }); this.log('intent.' + to, it.id, detail); return it;
  }

  /** A verified provider event (from verifyCallback, capture, release, refund…) moves the intent. Unverified events are refused:
   *  a callback alone proves nothing. The amount must agree with what the intent asked for. */
  applyEvent(ev) {
    if (!ev || ev.verified !== true) throw new PaymentError('unverified', 'an event is applied only after the provider confirmed it by a round trip');
    assertAgorot(ev.amount, 'event.amount');
    const it = ev.metadata && ev.metadata.intentId ? this.intent(ev.metadata.intentId) : this.intentByRef(ev.providerRef);
    if (it.providerRef && ev.providerRef && it.providerRef !== ev.providerRef) throw new PaymentError('mismatch', 'event ref ' + ev.providerRef + ' is not intent ' + it.id + "'s " + it.providerRef);
    if (ev.txnRef) it.txnRef = ev.txnRef; if (ev.token) it.token = ev.token;
    switch (ev.type) {
      case 'approved': case 'captured':
        if (it.state === 'authorized') return this.capture(it.id, ev.amount, { event: true });
        if (ev.amount !== it.total) throw new PaymentError('mismatch', 'paid ' + ev.amount + ', asked ' + it.total);
        this.transition(it.id, 'captured', { amount: ev.amount, txnRef: ev.txnRef }); this.credit(it, ev.amount); return it;
      case 'authorized':
        if (ev.amount !== it.total) throw new PaymentError('mismatch', 'held ' + ev.amount + ', asked ' + it.total);
        it.held = ev.amount; return this.transition(it.id, 'authorized', { amount: ev.amount, txnRef: ev.txnRef });
      case 'tokenized': return this.transition(it.id, it.kind === 'tokenize' ? 'captured' : it.state, { token: true });
      case 'declined': return this.transition(it.id, 'failed', { reason: ev.reason || 'declined' });
      case 'released': return this.transition(it.id, it.state === 'authorized' ? 'released' : 'failed', { reason: ev.type });
      case 'cancelled':   // a same-day reversal: a hold is released, a payment is refunded in full, an open checkout fails
        if (it.state === 'authorized') return this.transition(it.id, 'released', { reason: 'cancelled' });
        if (it.state === 'captured') return this.refund(it.id, it.captured, { event: true });
        return this.transition(it.id, 'failed', { reason: 'cancelled' });
      case 'refunded': return this.refund(it.id, ev.amount, { event: true });
      default: throw new PaymentError('bad_request', 'event type ' + ev.type);
    }
  }

  /** Settles a hold for `amount` ≤ what was held (partial capture when the provider allows it). Called with the provider's
   *  confirmed event, or by the service after provider.capture() succeeded. */
  capture(intentId, amount, { partial = true } = {}) {
    const it = this.intent(intentId); assertAgorot(amount);
    if (it.state !== 'authorized') throw new PaymentError('bad_state', 'intent ' + it.id + ' is ' + it.state + ', not authorized');
    if (amount > it.held) throw new PaymentError('over_capture', 'capture ' + amount + ' > held ' + it.held);
    if (amount < it.held && !partial) throw new PaymentError('no_partial_capture', 'this provider captures the whole hold or nothing');
    if (amount === 0) return this.transition(it.id, 'released', { reason: 'capture 0' });
    this.transition(it.id, 'captured', { amount }); this.credit(it, amount); return it;
  }
  /** Money arrived: first the share of the bill, then the tip. The bill closes when its shares are all in. */
  credit(it, amount) {
    const b = this.bill(it.billId), share = Math.min(amount, it.amount - it.capturedShare), tip = amount - share;
    it.captured += amount; it.capturedShare += share; b.captured += share;
    if (it.tipId) { const t = this.tips.get(it.tipId); t.collected += tip; t.state = t.collected >= t.amount ? 'collected' : t.collected > 0 ? 'partial' : 'pending'; }
    if (b.status === 'open' && b.captured >= b.total) { b.status = 'closed'; b.closedAt = this.now(); this.log('bill.close', b.id, { captured: b.captured }); }
  }
  /** A refund of a captured intent: never more than what is left, never more refunds than the provider allows. */
  refund(intentId, amount, { maxRefunds = Infinity } = {}) {
    const it = this.intent(intentId); assertAgorot(amount); if (amount === 0) throw new PaymentError('bad_amount', 'a refund is > 0');
    if (!['captured', 'refunded_partial'].includes(it.state)) throw new PaymentError('bad_state', 'intent ' + it.id + ' is ' + it.state + ': nothing to refund');
    if (it.refundCount >= maxRefunds) throw new PaymentError('refund_cap', 'intent ' + it.id + ' already has ' + it.refundCount + ' refunds, the provider allows ' + maxRefunds);
    const left = it.captured - it.refunded; if (amount > left) throw new PaymentError('over_refund', 'refund ' + amount + ' > ' + left + ' left');
    const r = { id: this.newId('refund'), intentId: it.id, billId: it.billId, amount, createdAt: this.now() }; this.refunds.set(r.id, r);
    it.refunded += amount; it.refundCount++; this.bill(it.billId).refunded += amount;
    return this.transition(it.id, it.refunded === it.captured ? 'refunded_full' : 'refunded_partial', { amount, refundId: r.id });
  }
  release(intentId) { return this.transition(intentId, 'released', { reason: 'released' }); }
  fail(intentId, reason) { return this.transition(intentId, 'failed', { reason }); }

  log(kind, id, detail) { this.journal.push({ at: this.now(), kind, id, ...detail }); }
}
