/* A deterministic local provider for tests and the local stack. It plays both sides: the gateway (its own store of
   processes and transactions, a callback it signs with a test secret) and what the real adapters do with a callback:
   never trust it alone, confirm by a round trip to the provider and compare the amount. Rules it enforces, as the real
   ones do: a declined amount, a hold that captures at most what was held (partial allowed), at most N refunds per
   transaction and never more than was captured, a same-day cancel that is always the full amount, tokens from a
   tokenize checkout, idempotent token charges. Nothing here touches the network. */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError, assertAgorot, assertCheckoutRequest } from '../port.mjs';

/** An amount whose last two digits are 99 (₪x.99) is declined, like a gateway's test card that fails. */
export const DECLINE_SUFFIX = 99;

export class MockProvider {
  /** @param {{secret?: string, signed?: boolean, now?: () => number, capabilities?: Partial<import('../port.mjs').Capabilities>}} [opts]
   *  secret: the test secret the callbacks are signed with · signed=false plays a provider without signatures (Grow), where the
   *  round trip is the only proof · now: a clock in ms, for deterministic expiry */
  constructor(opts = {}) {
    this.name = 'mock';
    this.secret = opts.secret || 'mock-test-secret'; this.signed = opts.signed !== false; this.now = opts.now || Date.now;
    this.capabilities = { supportsPartialCapture: true, holdWindowDays: 7, bitMaxAmount: 500000, walletTokensReusable: false, maxRefundsPerTxn: 2, sandbox: 'cards-only', ...(opts.capabilities || {}) };
    this.processes = new Map();   // providerRef → {ref, req, state, txnRef, amount, held, captured, refunded, refunds, token, createdAt, settledAt}
    this.tokens = new Map();      // token → {restaurantId, ref}
    this.charges = new Map();     // idempotencyKey → event (chargeToken is idempotent)
    this.docs = []; let n = 0; this.seq = () => ++n;
  }
  /* ---------------------------------------------------------------- the port */
  async createCheckout(req) {
    assertCheckoutRequest(req);
    if (req.methods.includes('bit') && req.amount > this.capabilities.bitMaxAmount && req.methods.length === 1) throw new PaymentError('bad_amount', 'Bit stops at ' + this.capabilities.bitMaxAmount + ' agorot');
    for (const p of this.processes.values()) if (p.req.idempotencyKey === req.idempotencyKey) return this.checkoutOf(p);   // the same key: the same process, never a second one
    const ref = 'proc_' + String(this.seq()).padStart(4, '0');
    this.processes.set(ref, { ref, req, state: 'open', txnRef: null, amount: req.amount, held: 0, captured: 0, refunded: 0, refunds: 0, token: null, createdAt: this.now(), settledAt: null });
    return this.checkoutOf(this.processes.get(ref));
  }
  checkoutOf(p) { return { checkoutUrl: 'mock://checkout/' + p.ref, providerRef: p.ref, expiresAt: new Date(p.createdAt + 10 * 60 * 1000).toISOString(), qr: 'mock://qr/' + p.ref }; }

  async capture(ref, amount) {
    const p = this.proc(ref); assertAgorot(amount);
    if (p.state !== 'authorized') throw new PaymentError('bad_state', ref + ' is ' + p.state + ', not a hold');
    if (this.now() - p.settledAt > this.capabilities.holdWindowDays * 86400000) { p.state = 'expired'; throw new PaymentError('hold_expired', ref + ': the hold is past its window'); }
    if (amount > p.held) throw new PaymentError('over_capture', 'capture ' + amount + ' > held ' + p.held);
    if (amount < p.held && !this.capabilities.supportsPartialCapture) throw new PaymentError('no_partial_capture', 'this provider settles the whole hold');
    if (amount === 0) return this.release(ref);
    p.state = 'captured'; p.captured = amount; p.settledAt = this.now(); return this.event(p, 'captured', amount);
  }
  async release(ref) { const p = this.proc(ref); if (p.state !== 'authorized') throw new PaymentError('bad_state', ref + ' is ' + p.state); p.state = 'released'; return this.event(p, 'released', p.held); }
  async chargeToken(restaurant, token, amount, idempotencyKey) {
    assertAgorot(amount); if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8) throw new PaymentError('bad_request', 'idempotencyKey');
    if (this.charges.has(idempotencyKey)) return this.charges.get(idempotencyKey);   // asked twice: charged once
    const t = this.tokens.get(token); if (!t || t.restaurantId !== restaurant.id) throw new PaymentError('not_found', 'no such token for this restaurant');
    const ref = 'proc_' + String(this.seq()).padStart(4, '0'), src = this.processes.get(t.ref);
    const p = { ref, req: { ...src.req, intent: 'charge', amount, idempotencyKey, metadata: { ...src.req.metadata, tokenCharge: '1' } }, state: 'open', txnRef: null, amount, held: 0, captured: 0, refunded: 0, refunds: 0, token, createdAt: this.now(), settledAt: null };
    this.processes.set(ref, p); const ev = this.settle(p, amount % 100 === DECLINE_SUFFIX ? 'decline' : 'approve'); this.charges.set(idempotencyKey, ev); return ev;
  }
  async refund(ref, amount) {
    const p = this.proc(ref); assertAgorot(amount);
    if (p.state !== 'captured' && p.state !== 'refunded') throw new PaymentError('bad_state', ref + ' is ' + p.state + ': nothing to refund');
    if (p.refunds >= this.capabilities.maxRefundsPerTxn) throw new PaymentError('refund_cap', ref + ' already has ' + p.refunds + ' refunds (the cap is ' + this.capabilities.maxRefundsPerTxn + ')');
    if (amount === 0 || amount > p.captured - p.refunded) throw new PaymentError('over_refund', 'refund ' + amount + ' > ' + (p.captured - p.refunded) + ' left');
    p.refunded += amount; p.refunds++; p.state = 'refunded'; return this.event(p, 'refunded', amount);
  }
  async cancel(ref) {   // same day only, and always the whole amount
    const p = this.proc(ref);
    if (p.state === 'authorized') return this.release(ref);
    if (p.state !== 'captured') throw new PaymentError('bad_state', ref + ' is ' + p.state);
    if (this.now() - p.settledAt > 86400000) throw new PaymentError('bad_state', 'cancel is same-day; after that it is a refund');
    p.refunded = p.captured; p.refunds++; p.state = 'cancelled'; return this.event(p, 'cancelled', p.captured);
  }
  /** The rule every adapter follows: the signature (when the provider has one) gates the callback, then a round trip to the
   *  provider's own record decides, and its amount must be the one the callback claims. A forged body never gets through. */
  async verifyCallback(headers, body) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    if (this.signed) { const h = headers['x-mock-signature'] || headers['X-Mock-Signature']; if (!h || !this.sigOk(text, h)) throw new PaymentError('forged', 'the callback is not signed with this provider\'s secret'); }
    let c; try { c = JSON.parse(text); } catch (e) { throw new PaymentError('forged', 'the callback is not JSON'); }
    const p = this.processes.get(c.ref);                                   // the round trip: what the provider itself says
    if (!p) throw new PaymentError('forged', 'the provider knows no process ' + c.ref);
    const truth = this.statusOf(p);
    if (truth.type !== c.type || truth.amount !== c.amount || (c.txnRef && c.txnRef !== p.txnRef)) throw new PaymentError('forged', 'the callback says ' + c.type + ' ' + c.amount + '; the provider says ' + truth.type + ' ' + truth.amount);
    return this.event(p, truth.type, truth.amount);
  }
  async issueDocument(txnRef, type, lines) {
    const p = [...this.processes.values()].find((x) => x.txnRef === txnRef); if (!p) throw new PaymentError('not_found', 'no transaction ' + txnRef);
    const d = { docRef: 'doc_' + String(this.seq()).padStart(4, '0'), type, txnRef, lines: lines || p.req.items, url: 'mock://doc/' + txnRef + '/' + type }; this.docs.push(d); return { docRef: d.docRef, url: d.url };
  }

  /* ------------------------------------------------- the gateway's own side */
  /** The guest finished on the provider's page. Deterministic: 'decline' when asked, or when the amount ends in 99. Returns
   *  the callback the provider would POST: {headers, body} for verifyCallback(). */
  pay(ref, { outcome } = {}) {
    const p = this.proc(ref); if (p.state !== 'open') throw new PaymentError('bad_state', ref + ' is ' + p.state + ', not an open checkout');
    if (this.now() > p.createdAt + 10 * 60 * 1000) { p.state = 'expired'; throw new PaymentError('expired', 'the checkout page is dead after 10 minutes'); }
    this.settle(p, outcome || (p.amount % 100 === DECLINE_SUFFIX ? 'decline' : 'approve'));
    return this.callback(p);
  }
  settle(p, outcome) {
    p.txnRef = 'txn_' + String(this.seq()).padStart(4, '0'); p.settledAt = this.now();
    if (outcome === 'decline') { p.state = 'declined'; return this.event(p, 'declined', p.amount); }
    if (p.req.intent === 'authorize') { p.state = 'authorized'; p.held = p.amount; return this.event(p, 'authorized', p.amount); }
    if (p.req.intent === 'tokenize') { p.state = 'tokenized'; p.token = 'tok_' + p.txnRef; this.tokens.set(p.token, { restaurantId: p.req.restaurant.id, ref: p.ref }); return this.event(p, 'tokenized', p.amount); }
    p.state = 'captured'; p.captured = p.amount; return this.event(p, 'captured', p.amount);
  }
  /** The callback as the provider sends it (signed with the test secret when `signed`). */
  callback(p) { const t = this.statusOf(p), body = JSON.stringify({ ref: p.ref, txnRef: p.txnRef, type: t.type, amount: t.amount, metadata: p.req.metadata || {} }); return { headers: this.signed ? { 'x-mock-signature': this.sign(body) } : {}, body }; }
  /** A forged callback: what an attacker who saw the format would send. Signed with their own guess at the secret, or unsigned. */
  forge({ ref, type = 'captured', amount, txnRef = null, secret = null }) { const body = JSON.stringify({ ref, txnRef, type, amount, metadata: {} }); return { headers: secret ? { 'x-mock-signature': createHmac('sha256', secret).update(body).digest('base64') } : {}, body }; }
  statusOf(p) {
    const map = { captured: 'captured', authorized: 'authorized', declined: 'declined', tokenized: 'tokenized', released: 'released', refunded: 'refunded', cancelled: 'cancelled', expired: 'declined', open: 'declined' };
    return { type: map[p.state], amount: p.state === 'captured' ? p.captured : p.state === 'authorized' || p.state === 'released' ? p.held : p.state === 'refunded' || p.state === 'cancelled' ? p.refunded : p.amount };
  }
  event(p, type, amount) { return { type, providerRef: p.ref, txnRef: p.txnRef, amount, currency: 'ILS', metadata: p.req.metadata || {}, token: p.token || undefined, verified: true, raw: { state: p.state } }; }
  proc(ref) { const p = this.processes.get(ref); if (!p) throw new PaymentError('not_found', 'no process ' + ref); return p; }
  sign(text) { return createHmac('sha256', this.secret).update(text).digest('base64'); }
  sigOk(text, given) { const a = Buffer.from(this.sign(text)), b = Buffer.from(String(given)); return a.length === b.length && timingSafeEqual(a, b); }
  /** Moves the clock (tests): the hold window and the same-day rule. */
  tick(ms) { const t0 = this.now(); this.now = () => t0 + ms; }
}
