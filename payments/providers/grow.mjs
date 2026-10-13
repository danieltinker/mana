/* Grow (formerly Meshulam) adapter: the port mapped onto Grow's "light server" API. Docs: https://developers.grow.business
   (R2 §1.3). Grow is adapter #1 because it has a documented platform programme: one platform apiKey for Halom, a
   userId + pageCode per restaurant, a fixed-ILS companyCommission Grow deducts for the platform, J5 with partial capture,
   cards + Bit + PayBox + wallets, and a real sandbox for cards (Bit, wallets and PayBox are live-only).
   Credentials come from Supabase secrets per restaurant, never from the repository. This file is never exercised by the
   tests: it refuses to run without credentials, and every request goes through the injected `fetch`.
   What is still to confirm at Grow before any money moves: the J5 window (the docs say both 7 and 10 days), the refund
   endpoint's path, whether a suspended charge can be released explicitly (otherwise it lapses by itself), and the
   production base URL (issued only after Grow reviews the integration). */
import { PaymentError, assertAgorot, assertCheckoutRequest } from '../port.mjs';

export const GROW_BASE = Object.freeze({
  sandbox: 'https://sandbox.meshulam.co.il/api/light/server/1.0/',   // test cards 4580458045804580 · 4580000000000000 · 4580111111111121
  production: null,                                                  // issued by Grow after review; set from secrets
});
/** Endpoint names as the docs call them (all POST, form-encoded, server-side only; localhost is refused). */
export const GROW_ENDPOINTS = Object.freeze({
  createPaymentProcess: 'createPaymentProcess',           // hosted page: returns url, processId, processToken; the url lives 10 minutes
  approveTransaction: 'approveTransaction',               // REQUIRED after every notifyUrl POST: the round trip that makes a callback true
  settleSuspendedTransaction: 'settleSuspendedTransaction',   // J5 capture: transactionId, transactionToken, sum ≤ authorized (partial allowed)
  createTransactionWithToken: 'createTransactionWithToken',   // cardToken + transactionUniqueIdentifier (idempotency)
  refund: null,                                           // "up to the original amount, max two per transaction via API": confirm the path in the docs
});
/** chargeType on createPaymentProcess. */
const CHARGE_TYPE = { charge: 1, authorize: 2 /* "Suspended Charge", J4J5 */, tokenize: 3 /* token only: sum=1, saveCardToken=1 */ };

export class GrowProvider {
  /** @param {{apiKey: string, userId: string, pageCode: string, env?: 'sandbox'|'production', baseUrl?: string, fetch?: typeof fetch, now?: () => number}} opts
   *  apiKey is Halom's platform key; userId and pageCode are the restaurant's (its Grow business and payment page). */
  constructor(opts = {}) {
    const { apiKey, userId, pageCode, env = 'sandbox' } = opts;
    if (!apiKey || !userId || !pageCode) throw new PaymentError('no_credentials', 'Grow needs apiKey (the platform), userId and pageCode (the restaurant); they live in Supabase secrets');
    this.base = opts.baseUrl || GROW_BASE[env]; if (!this.base) throw new PaymentError('no_credentials', 'Grow production base URL is issued by Grow; set baseUrl');
    this.name = 'grow'; this.env = env; this.creds = { apiKey, userId, pageCode }; this.fetch = opts.fetch || globalThis.fetch; this.now = opts.now || Date.now;
    this.capabilities = { supportsPartialCapture: true, holdWindowDays: 7 /* docs also say 10: confirm */, bitMaxAmount: 500000, walletTokensReusable: false, maxRefundsPerTxn: 2, sandbox: 'cards-only' };
    this.pending = new Map();   // providerRef (processId) → {processToken, req}: what approveTransaction needs
  }
  async post(name, fields) {
    const path = GROW_ENDPOINTS[name]; if (!path) throw new PaymentError('not_implemented', 'Grow ' + name + ': the endpoint path is not confirmed yet');
    const res = await this.fetch(this.base + path, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(flat(fields)).toString() });
    const j = await res.json();
    if (!res.ok || (j && j.status !== 1 && j.status !== '1')) throw new PaymentError('provider_error', 'Grow ' + name + ': ' + JSON.stringify(j && (j.err || j.status)));
    return j.data || j;
  }
  async createCheckout(req) {
    assertCheckoutRequest(req); const c = this.creds;
    const fields = { apiKey: c.apiKey, userId: c.userId, pageCode: c.pageCode, chargeType: CHARGE_TYPE[req.intent],
      sum: req.intent === 'tokenize' ? '1' : shekels(req.amount), description: (req.restaurant.name || '') + ' ' + (req.metadata && req.metadata.billId || ''),
      successUrl: req.returnUrls.success, cancelUrl: req.returnUrls.cancel, notifyUrl: req.callbackUrl, saveCardToken: req.intent === 'tokenize' ? 1 : 0,
      'pageField[fullName]': req.customer && req.customer.name || '', 'pageField[phone]': req.customer && req.customer.phone || '', 'pageField[email]': req.customer && req.customer.email || '',
      cField1: req.metadata && req.metadata.intentId || '', cField2: req.metadata && req.metadata.billId || '', cField3: req.idempotencyKey };
    req.items.forEach((it, i) => { fields['productData[' + i + '][catalogNumber]'] = String(i); fields['productData[' + i + '][productName]'] = it.name; fields['productData[' + i + '][quantity]'] = it.qty; fields['productData[' + i + '][price]'] = shekels(it.unitAmount); });
    const d = await this.post('createPaymentProcess', fields);
    this.pending.set(String(d.processId), { processToken: d.processToken, req });
    return { checkoutUrl: d.url, providerRef: String(d.processId), expiresAt: new Date(this.now() + 10 * 60 * 1000).toISOString() };
  }
  async capture(providerRef, amount) {
    assertAgorot(amount); const t = this.txn(providerRef);
    const d = await this.post('settleSuspendedTransaction', { apiKey: this.creds.apiKey, userId: this.creds.userId, transactionId: t.transactionId, transactionToken: t.transactionToken, sum: shekels(amount) });
    return this.event('captured', providerRef, amount, d);
  }
  async release(providerRef) {   // no explicit release in R2's notes: a suspended charge lapses after Grow's window; confirm before relying on it for deposits
    const t = this.txn(providerRef); t.released = true;
    return this.event('released', providerRef, t.sum, { note: 'Grow releases an unsettled suspended charge itself after its window' });
  }
  async chargeToken(restaurant, token, amount, idempotencyKey) {
    assertAgorot(amount);
    const d = await this.post('createTransactionWithToken', { apiKey: this.creds.apiKey, userId: this.creds.userId, pageCode: this.creds.pageCode, cardToken: token, sum: shekels(amount), transactionUniqueIdentifier: idempotencyKey, description: restaurant.name || '' });
    return this.event('captured', String(d.transactionId || idempotencyKey), amount, d);
  }
  async refund(providerRef, amount) { assertAgorot(amount); const d = await this.post('refund', { transactionId: this.txn(providerRef).transactionId, sum: shekels(amount) }); return this.event('refunded', providerRef, amount, d); }
  async cancel(providerRef) { const t = this.txn(providerRef); return this.refund(providerRef, t.sum); }   // same day = the whole amount
  /** Grow's notifyUrl POST carries no signature. The only proof is the round trip: approveTransaction with the transaction's
   *  id and token, whose answer carries the sum and status Grow holds. The callback's own fields are never believed. */
  async verifyCallback(headers, body) {
    const c = typeof body === 'string' ? Object.fromEntries(new URLSearchParams(body)) : body;
    const ref = String(c.processId || ''), p = this.pending.get(ref);
    if (!p) throw new PaymentError('forged', 'Grow callback for a process this service did not open: ' + ref);
    const d = await this.post('approveTransaction', { apiKey: this.creds.apiKey, userId: this.creds.userId, pageCode: this.creds.pageCode, processId: ref, processToken: p.processToken, transactionId: c.transactionId, transactionToken: c.transactionToken });
    const sum = agorot(d.sum), ok = String(d.statusCode) === '2' || d.status === 1;   // statusCode 2 = approved (confirm the code table in the docs)
    if (!ok) return this.event('declined', ref, sum, d);
    if (sum !== p.req.amount && p.req.intent !== 'tokenize') throw new PaymentError('forged', 'Grow holds ' + sum + ' for ' + ref + ', the intent asked ' + p.req.amount);
    p.transactionId = d.transactionId || c.transactionId; p.transactionToken = d.transactionToken || c.transactionToken; p.sum = sum;
    const type = p.req.intent === 'authorize' ? 'authorized' : p.req.intent === 'tokenize' ? 'tokenized' : 'captured';
    return { ...this.event(type, ref, sum, d), txnRef: String(p.transactionId), token: d.cardToken || undefined };
  }
  async issueDocument(txnRef, type) {
    if (type === 'credit') throw new PaymentError('not_supported', 'Grow issues no credit document on a refund: the restaurant\'s bookkeeping must');
    return { docRef: 'grow:' + txnRef, url: undefined };   // Grow generates the invoice itself and posts it to invoiceNotifyUrl
  }
  txn(ref) { const p = this.pending.get(ref); if (!p || !p.transactionId) throw new PaymentError('not_found', 'no settled Grow transaction for ' + ref); return p; }
  event(type, providerRef, amount, raw) { return { type, providerRef, amount, currency: 'ILS', metadata: (this.pending.get(providerRef) || {}).req?.metadata || {}, verified: true, raw }; }
}
const shekels = (agorot) => (agorot / 100).toFixed(2);
const agorot = (s) => Math.round(parseFloat(String(s)) * 100);
const flat = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));
