/* PayPlus adapter: the port mapped onto PayPlus REST v1.0. Docs: https://docs.payplus.co.il (every page also as .md,
   index at /llms.txt; R2 §1.4). Adapter #2 for its clean REST surface: staging + test cards, HMAC-signed callbacks,
   J5 → ChargeByTransactionUid with partial capture, explicit allowed_charge_methods (card, bit, apple, google), a QR
   with every payment link, Invoice+ documents linked by transaction_uuid. No platform model: each restaurant opens its
   own PayPlus account and gives Mana an api-key, secret-key and payment_page_uid, kept in Supabase secrets.
   Never exercised by the tests: refuses to run without credentials; every request goes through the injected `fetch`.
   To confirm with PayPlus before money moves: how to obtain staging credentials, the J5 hold duration, and whether a J5
   can be released explicitly (otherwise it lapses). */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentError, assertAgorot, assertCheckoutRequest } from '../port.mjs';

export const PAYPLUS_BASE = Object.freeze({
  sandbox: 'https://restapidev.payplus.co.il/api/v1.0/',   // test cards 5326-1402-8077-9844 (success), 5326-1402-0001-0120 (rejected), 05/30, CVV 000
  production: 'https://restapi.payplus.co.il/api/v1.0/',
});
export const PAYPLUS_ENDPOINTS = Object.freeze({
  generateLink: 'PaymentPages/generateLink',                 // → payment_page_link, page_request_uid, qr_code_image
  ipn: 'PaymentPages/ipn',                                   // lookup by payment_request_uid | transaction_uid: the round trip
  chargeByTransactionUid: 'Transactions/ChargeByTransactionUid',   // J5 capture, amount ≤ the original approval
  charge: 'Transactions/Charge',                             // J4; with use_token=true, token, customer_uid: a token charge
  refundByTransactionUid: 'Transactions/RefundByTransactionUid',
  docsNew: 'books/docs/new/',                                // + docType: inv_tax_receipt | inv_tax | inv_receipt | inv_refund
});
/** charge_method on a payment page: 1 = Charge (J4), 2 = Approval (J5), 0 = Check (J2). */
const CHARGE_METHOD = { charge: 1, authorize: 2, tokenize: 0 };
const METHOD = { card: 'credit-card', bit: 'bit', apple: 'apple-pay', google: 'google-pay' };
const DOC = { invoice_receipt: 'inv_tax_receipt', invoice: 'inv_tax', receipt: 'inv_receipt', credit: 'inv_refund' };

export class PayPlusProvider {
  /** @param {{apiKey: string, secretKey: string, paymentPageUid: string, env?: 'sandbox'|'production', fetch?: typeof fetch, now?: () => number}} opts */
  constructor(opts = {}) {
    const { apiKey, secretKey, paymentPageUid, env = 'sandbox' } = opts;
    if (!apiKey || !secretKey || !paymentPageUid) throw new PaymentError('no_credentials', 'PayPlus needs api-key, secret-key and payment_page_uid (the restaurant\'s); they live in Supabase secrets');
    this.name = 'payplus'; this.env = env; this.base = PAYPLUS_BASE[env]; this.creds = { apiKey, secretKey, paymentPageUid }; this.fetch = opts.fetch || globalThis.fetch; this.now = opts.now || Date.now;
    this.capabilities = { supportsPartialCapture: true, holdWindowDays: 7 /* not public: confirm with PayPlus */, bitMaxAmount: 500000, walletTokensReusable: false, maxRefundsPerTxn: Infinity /* no cap named in the docs; keep the ledger's own */, sandbox: 'cards-only' };
    this.pending = new Map();   // page_request_uid → {req, transactionUid}
  }
  async post(name, body) {
    const res = await this.fetch(this.base + PAYPLUS_ENDPOINTS[name], { method: 'POST', headers: { 'content-type': 'application/json', 'api-key': this.creds.apiKey, 'secret-key': this.creds.secretKey }, body: JSON.stringify(body) });
    const j = await res.json();
    if (!res.ok || !j || !j.results || j.results.status !== 'success') throw new PaymentError('provider_error', 'PayPlus ' + name + ': ' + JSON.stringify(j && j.results));
    return j.data || j;
  }
  async createCheckout(req) {
    assertCheckoutRequest(req);
    const d = await this.post('generateLink', { payment_page_uid: this.creds.paymentPageUid, charge_method: CHARGE_METHOD[req.intent], amount: shekels(req.intent === 'tokenize' ? 100 : req.amount), currency_code: 'ILS',
      create_token: req.intent === 'tokenize', allowed_charge_methods: req.methods.map((m) => METHOD[m]), more_info: req.metadata && req.metadata.intentId || '', more_info_2: req.idempotencyKey,
      refURL_success: req.returnUrls.success, refURL_failure: req.returnUrls.failure, refURL_cancel: req.returnUrls.cancel, refURL_callback: req.callbackUrl, send_failure_callback: true,
      customer: { customer_name: req.customer && req.customer.name || '', email: req.customer && req.customer.email || '', phone: req.customer && req.customer.phone || '' },
      items: req.items.map((it) => ({ name: it.name, quantity: it.qty, price: shekels(it.unitAmount) })) });
    this.pending.set(d.page_request_uid, { req, transactionUid: null });
    return { checkoutUrl: d.payment_page_link, providerRef: d.page_request_uid, expiresAt: new Date(this.now() + 30 * 60 * 1000).toISOString(), qr: d.qr_code_image };
  }
  async capture(providerRef, amount) { assertAgorot(amount); const t = this.txn(providerRef); const d = await this.post('chargeByTransactionUid', { transaction_uid: t.transactionUid, amount: shekels(amount) }); return this.event('captured', providerRef, amount, d); }
  async release(providerRef) { const t = this.txn(providerRef); t.released = true; return this.event('released', providerRef, t.amount, { note: 'no explicit J5 release in the docs read; the approval lapses' }); }
  async chargeToken(restaurant, token, amount, idempotencyKey) {
    assertAgorot(amount);
    const d = await this.post('charge', { terminal_uid: undefined, use_token: true, token, customer_uid: restaurant.id, amount: shekels(amount), currency_code: 'ILS', more_info: idempotencyKey });
    return this.event('captured', String(d.transaction && d.transaction.uid || idempotencyKey), amount, d);
  }
  async refund(providerRef, amount) { assertAgorot(amount); const t = this.txn(providerRef); const d = await this.post('refundByTransactionUid', { transaction_uid: t.transactionUid, amount: shekels(amount) }); return this.event('refunded', providerRef, amount, d); }
  async cancel(providerRef) { const t = this.txn(providerRef); return this.refund(providerRef, t.amount); }
  /** Two gates: the HMAC (header `hash` = base64(HMAC-SHA256(raw JSON body, secret-key)), user-agent PayPlus), then the IPN
   *  round trip by page_request_uid, whose status and amount are what the ledger gets. */
  async verifyCallback(headers, body) {
    const text = typeof body === 'string' ? body : JSON.stringify(body), h = headers['hash'] || headers['Hash'];
    const mine = createHmac('sha256', this.creds.secretKey).update(text).digest('base64');
    if (!h || Buffer.from(h).length !== Buffer.from(mine).length || !timingSafeEqual(Buffer.from(h), Buffer.from(mine))) throw new PaymentError('forged', 'PayPlus callback hash does not match');
    const c = JSON.parse(text), ref = c.page_request_uid || (c.transaction && c.transaction.page_request_uid), p = this.pending.get(ref);
    if (!p) throw new PaymentError('forged', 'PayPlus callback for a page this service did not open: ' + ref);
    const d = await this.post('ipn', { payment_request_uid: ref });
    const tx = d.transaction || d, approved = String(tx.status_code) === '000', amount = agorot(tx.amount);
    if (!approved) return this.event('declined', ref, amount, d);
    if (amount !== p.req.amount && p.req.intent !== 'tokenize') throw new PaymentError('forged', 'PayPlus holds ' + amount + ' for ' + ref + ', the intent asked ' + p.req.amount);
    p.transactionUid = tx.uid || tx.transaction_uid; p.amount = amount;
    const type = p.req.intent === 'authorize' ? 'authorized' : p.req.intent === 'tokenize' ? 'tokenized' : 'captured';
    return { ...this.event(type, ref, amount, d), txnRef: String(p.transactionUid), token: tx.token_uid || tx.token || undefined };
  }
  async issueDocument(txnRef, type, lines) {   // POST books/docs/new/{docType} linked by transaction_uuid (Invoice+ / Books)
    const res = await this.fetch(this.base + PAYPLUS_ENDPOINTS.docsNew + DOC[type], { method: 'POST', headers: { 'content-type': 'application/json', 'api-key': this.creds.apiKey, 'secret-key': this.creds.secretKey },
      body: JSON.stringify({ transaction_uuid: txnRef, items: (lines || []).map((it) => ({ name: it.name, quantity: it.qty, price: shekels(it.unitAmount) })) }) });
    const j = await res.json(); if (!res.ok || !j.results || j.results.status !== 'success') throw new PaymentError('provider_error', 'PayPlus document: ' + JSON.stringify(j.results));
    return { docRef: String(j.data && (j.data.uid || j.data.number) || txnRef), url: j.data && j.data.url };
  }
  txn(ref) { const p = this.pending.get(ref); if (!p || !p.transactionUid) throw new PaymentError('not_found', 'no settled PayPlus transaction for ' + ref); return p; }
  event(type, providerRef, amount, raw) { return { type, providerRef, amount, currency: 'ILS', metadata: (this.pending.get(providerRef) || {}).req?.metadata || {}, verified: true, raw }; }
}
const shekels = (agorot) => Number((agorot / 100).toFixed(2));
const agorot = (s) => Math.round(parseFloat(String(s)) * 100);
