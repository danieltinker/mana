/* The PaymentProvider port (R2 §5.1): one interface every gateway adapter implements, so the ledger, the owner app and
   the guest menu never know which provider a restaurant uses. Amounts are integers in agorot; the currency is ILS.
   No card number ever reaches Halom: a checkout is the provider's own page (redirect, or an iframe with
   allow="payment" and sandbox); Halom holds a reference, never funds. Plain ESM, no dependencies. */

/** @typedef {'charge'|'authorize'|'tokenize'} Intent
 *  charge: pay now (pay at the table, an online order) · authorize: a hold (J5) to capture or release later (a deposit,
 *  a table bid) · tokenize: keep a card for a later charge (a no-show fee after the hold window). */
export const INTENTS = Object.freeze(['charge', 'authorize', 'tokenize']);
/** @typedef {'card'|'bit'|'apple'|'google'} Method */
export const METHODS = Object.freeze(['card', 'bit', 'apple', 'google']);
/** @typedef {'invoice_receipt'|'invoice'|'receipt'|'credit'} DocType */
export const DOC_TYPES = Object.freeze(['invoice_receipt', 'invoice', 'receipt', 'credit']);
/** @typedef {'approved'|'authorized'|'captured'|'declined'|'released'|'refunded'|'cancelled'|'tokenized'} EventType */
export const EVENT_TYPES = Object.freeze(['approved', 'authorized', 'captured', 'declined', 'released', 'refunded', 'cancelled', 'tokenized']);

/**
 * @typedef {object} LineItem
 * @property {string} name          as it must appear on the document
 * @property {number} qty
 * @property {number} unitAmount    agorot
 * @property {'dish'|'tip'|'service'|'deposit'|'other'} [kind]
 */
/**
 * @typedef {object} CheckoutRequest
 * @property {{id: string, name?: string}} restaurant       the restaurant (its provider credentials live in Supabase secrets, keyed by this id)
 * @property {Intent} intent
 * @property {number} amount                               agorot, integer, > 0 (tokenize: the provider's minimum, usually ₪1)
 * @property {'ILS'} currency
 * @property {Method[]} methods
 * @property {{name?: string, phone?: string, email?: string}} [customer]
 * @property {LineItem[]} items
 * @property {Record<string, string>} [metadata]           carried to the callback: at least {intentId, billId}
 * @property {{success: string, failure: string, cancel: string}} returnUrls
 * @property {string} callbackUrl                          a public HTTPS edge function; providers reject localhost
 * @property {string} idempotencyKey                       unique per payment_intent
 */
/**
 * @typedef {object} Checkout
 * @property {string} checkoutUrl     the provider's page: open by redirect, or in an <iframe allow="payment" sandbox="allow-scripts allow-forms allow-same-origin allow-top-navigation">
 * @property {string} providerRef     the provider's id for this process (not a transaction yet)
 * @property {string} expiresAt       ISO time after which the page is dead (Grow: 10 minutes)
 * @property {string} [qr]            a QR image or URL for a printed / tablet fallback (PayPlus returns one)
 */
/**
 * @typedef {object} PaymentEvent    a callback made safe: normalised, and verified by a round trip to the provider
 * @property {EventType} type
 * @property {string} providerRef
 * @property {string} [txnRef]        the provider's transaction id once there is one
 * @property {number} amount          agorot
 * @property {'ILS'} currency
 * @property {Record<string, string>} metadata   what createCheckout sent (intentId, billId)
 * @property {string} [token]         for tokenize, or saveCardToken on a charge
 * @property {boolean} verified       true only after the round trip confirmed status and amount; the ledger refuses false
 * @property {unknown} raw
 */
/**
 * @typedef {object} Capabilities
 * @property {boolean} supportsPartialCapture   capture less than the hold (Grow, PayPlus: yes; CardCom suspended deal: no)
 * @property {number} holdWindowDays            days a J5 hold lives (acquirer-set; Grow 7–10, Hyp ≈5)
 * @property {number} bitMaxAmount              agorot; Bit stops at ₪5,000
 * @property {boolean} walletTokensReusable     Apple / Google Pay tokens reusable for a later charge (Hyp: no)
 * @property {number} maxRefundsPerTxn          Grow: two by API
 * @property {'cards-only'|'full'|'none'} sandbox   what the provider's sandbox can run (Bit, wallets and J5 are live-only at most providers)
 */
/**
 * @typedef {object} PaymentProvider
 * @property {string} name
 * @property {Capabilities} capabilities
 * @property {(req: CheckoutRequest) => Promise<Checkout>} createCheckout
 * @property {(providerRef: string, amount: number) => Promise<PaymentEvent>} capture      settle a hold, ≤ the held amount
 * @property {(providerRef: string) => Promise<PaymentEvent>} release                      let a hold go (arrival, cancellation in time)
 * @property {(restaurant: {id: string}, token: string, amount: number, idempotencyKey: string) => Promise<PaymentEvent>} chargeToken
 * @property {(providerRef: string, amount: number) => Promise<PaymentEvent>} refund       after settlement; same-day = cancel
 * @property {(providerRef: string) => Promise<PaymentEvent>} cancel                       same-day full reversal
 * @property {(headers: Record<string, string>, body: string|object) => Promise<PaymentEvent>} verifyCallback   never trust the callback alone
 * @property {(txnRef: string, type: DocType, lines?: LineItem[]) => Promise<{docRef: string, url?: string}>} issueDocument
 */

const METHOD_NAMES = ['createCheckout', 'capture', 'release', 'chargeToken', 'refund', 'cancel', 'verifyCallback', 'issueDocument'];
const CAPS = { supportsPartialCapture: 'boolean', holdWindowDays: 'number', bitMaxAmount: 'number', walletTokensReusable: 'boolean', maxRefundsPerTxn: 'number', sandbox: 'string' };

/** An amount is a whole number of agorot, never a float of shekels. */
export function assertAgorot(n, what = 'amount') {
  if (!Number.isSafeInteger(n) || n < 0) throw new PaymentError('bad_amount', what + ' must be a whole number of agorot, got ' + String(n));
  return n;
}
/** Proves an object implements the port (shape only; behaviour is what the tests are for). */
export function assertProvider(p) {
  if (!p || typeof p.name !== 'string') throw new PaymentError('bad_provider', 'a provider has a name');
  for (const m of METHOD_NAMES) if (typeof p[m] !== 'function') throw new PaymentError('bad_provider', p.name + ' lacks ' + m + '()');
  for (const [k, t] of Object.entries(CAPS)) if (typeof (p.capabilities || {})[k] !== t) throw new PaymentError('bad_provider', p.name + '.capabilities.' + k + ' must be a ' + t);
  if (!['cards-only', 'full', 'none'].includes(p.capabilities.sandbox)) throw new PaymentError('bad_provider', p.name + '.capabilities.sandbox is one of cards-only | full | none');
  return p;
}
/** Checks a CheckoutRequest before it leaves for a provider. */
export function assertCheckoutRequest(r) {
  if (!r || !r.restaurant || typeof r.restaurant.id !== 'string') throw new PaymentError('bad_request', 'restaurant.id');
  if (!INTENTS.includes(r.intent)) throw new PaymentError('bad_request', 'intent is one of ' + INTENTS.join(' | '));
  assertAgorot(r.amount); if (r.amount === 0) throw new PaymentError('bad_amount', 'amount is > 0');
  if (r.currency !== 'ILS') throw new PaymentError('bad_request', 'currency is ILS');
  if (!Array.isArray(r.methods) || !r.methods.length || r.methods.some((m) => !METHODS.includes(m))) throw new PaymentError('bad_request', 'methods are from ' + METHODS.join(' | '));
  if (!Array.isArray(r.items)) throw new PaymentError('bad_request', 'items[]');
  for (const it of r.items) { assertAgorot(it.unitAmount, 'items[].unitAmount'); if (!Number.isSafeInteger(it.qty) || it.qty < 1) throw new PaymentError('bad_request', 'items[].qty'); }
  const sum = r.items.reduce((n, it) => n + it.unitAmount * it.qty, 0);
  if (r.intent !== 'tokenize' && sum !== r.amount) throw new PaymentError('bad_request', 'items sum to ' + sum + ', amount is ' + r.amount);
  if (!r.returnUrls || !['success', 'failure', 'cancel'].every((k) => /^https:\/\//.test(r.returnUrls[k] || '') || /^mock:/.test(r.returnUrls[k] || ''))) throw new PaymentError('bad_request', 'returnUrls.{success,failure,cancel} are https');
  if (!/^https:\/\//.test(r.callbackUrl || '') && !/^mock:/.test(r.callbackUrl || '')) throw new PaymentError('bad_request', 'callbackUrl is a public https address');
  if (typeof r.idempotencyKey !== 'string' || r.idempotencyKey.length < 8) throw new PaymentError('bad_request', 'idempotencyKey (≥ 8 chars)');
  return r;
}

export class PaymentError extends Error {
  /** @param {string} code  a short machine code: bad_amount, declined, over_capture, refund_cap, forged, not_found, bad_state, duplicate, no_credentials … */
  constructor(code, message) { super(message || code); this.code = code; this.name = 'PaymentError'; }
}
