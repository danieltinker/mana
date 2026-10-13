/* The payments service: the ledger on one side, a PaymentProvider on the other. This is what the edge functions run:
   open a checkout for an intent, take a callback (answer the provider at once, then verify by a round trip and only
   then move the ledger), capture or release a hold, refund within the provider's caps, cancel same day. The service
   never sees a card number and never holds funds: it holds references. */
import { PaymentError, assertProvider, assertAgorot } from './port.mjs';

export class Payments {
  /** @param {{ledger: import('./ledger.mjs').Ledger, provider: import('./port.mjs').PaymentProvider, callbackUrl: string, returnUrls: {success: string, failure: string, cancel: string}}} deps */
  constructor({ ledger, provider, callbackUrl, returnUrls }) {
    this.ledger = ledger; this.provider = assertProvider(provider); this.callbackUrl = callbackUrl; this.returnUrls = returnUrls;
  }
  /** Opens the provider's page for an intent (amount + tip). Idempotent through the intent's key. */
  async checkout(intentId, { restaurant, methods = ['card'], customer = {} } = {}) {
    const it = this.ledger.intent(intentId);
    if (it.state !== 'created' && it.state !== 'pending') throw new PaymentError('bad_state', 'intent ' + it.id + ' is ' + it.state);
    if (methods.includes('bit') && it.total > this.provider.capabilities.bitMaxAmount) methods = methods.filter((m) => m !== 'bit');   // Bit stops at ₪5,000: offer the rest
    const co = await this.provider.createCheckout({ restaurant, intent: it.kind, amount: it.total, currency: 'ILS', methods, customer, items: it.items,
      metadata: { intentId: it.id, billId: it.billId }, returnUrls: this.returnUrls, callbackUrl: this.callbackUrl, idempotencyKey: it.idempotencyKey });
    if (it.state === 'created') this.ledger.attachCheckout(it.id, { provider: this.provider.name, providerRef: co.providerRef });
    return co;
  }
  /** A callback arrived. The HTTP answer to the provider is "received" at once (the caller does that); here the callback is
   *  verified by the adapter's round trip and only a verified event touches the ledger. A forged callback throws `forged`. */
  async onCallback(headers, body) {
    const ev = await this.provider.verifyCallback(headers, body);   // throws forged | not_found; returns verified: true only after the round trip
    const it = this.ledger.applyEvent(ev);
    return { intent: it, event: ev };
  }
  async capture(intentId, amount) {
    const it = this.ledger.intent(intentId); assertAgorot(amount);
    if (it.state !== 'authorized') throw new PaymentError('bad_state', 'intent ' + it.id + ' is ' + it.state + ', not a hold');
    if (amount > it.held) throw new PaymentError('over_capture', 'capture ' + amount + ' > held ' + it.held);   // refused here, before the provider is asked
    const ev = await this.provider.capture(it.providerRef, amount);
    return ev.type === 'released' ? this.ledger.applyEvent(ev) : this.ledger.capture(it.id, ev.amount, { partial: this.provider.capabilities.supportsPartialCapture });
  }
  async release(intentId) { const it = this.ledger.intent(intentId); const ev = await this.provider.release(it.providerRef); return this.ledger.applyEvent(ev); }
  async refund(intentId, amount) {
    const it = this.ledger.intent(intentId), cap = this.provider.capabilities.maxRefundsPerTxn;
    if (it.refundCount >= cap) throw new PaymentError('refund_cap', 'intent ' + it.id + ' already has ' + cap + ' refunds: the provider allows no more (correct the share with a new charge instead)');
    const ev = await this.provider.refund(it.providerRef, amount);
    return this.ledger.refund(it.id, ev.amount, { maxRefunds: cap });
  }
  async cancel(intentId) { const it = this.ledger.intent(intentId); const ev = await this.provider.cancel(it.providerRef); return this.ledger.applyEvent(ev); }
  /** A no-show fee or a later charge against a kept card: idempotent per key on both sides. */
  async chargeToken(intentId, { restaurant, token }) {
    const it = this.ledger.intent(intentId);
    const ev = await this.provider.chargeToken(restaurant, token, it.total, it.idempotencyKey);
    if (it.state === 'created') this.ledger.attachCheckout(it.id, { provider: this.provider.name, providerRef: ev.providerRef });
    return this.ledger.applyEvent({ ...ev, metadata: { ...ev.metadata, intentId: it.id } });
  }
}
