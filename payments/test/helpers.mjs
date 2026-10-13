/* One table, one provider, one service: what every test starts from. */
import { Ledger } from '../ledger.mjs';
import { MockProvider } from '../providers/mock.mjs';
import { Payments } from '../service.mjs';

export const RESTAURANT = { id: 'rest_olea', name: 'Olea' };
export const URLS = { success: 'https://halom.io/mana/pay/ok', failure: 'https://halom.io/mana/pay/failed', cancel: 'https://halom.io/mana/pay/cancel' };
export const CALLBACK = 'https://example.invalid/functions/v1/pay-callback';   // never called: the mock hands the callback back as an object

export function setup(opts = {}) {
  let t = 1_760_000_000_000;                                         // a fixed clock: deterministic ids, expiry and same-day rules
  const ledger = new Ledger({ now: () => new Date(t).toISOString() });
  const provider = new MockProvider({ now: () => t, ...opts });
  const pay = new Payments({ ledger, provider, callbackUrl: CALLBACK, returnUrls: URLS });
  const tick = (ms) => { t += ms; };
  return { ledger, provider, pay, tick };
}
/** A table's bill: two mains and a dessert, ₪186. */
export function openBill(ledger, extra = {}) {
  return ledger.openBill({ restaurantId: RESTAURANT.id, table: 7, lines: [
    { name: 'Lamb kebab', qty: 1, unitAmount: 7800 }, { name: 'Sea bream', qty: 1, unitAmount: 8600 }, { name: 'Crème brûlée', qty: 1, unitAmount: 4200 }], ...extra });
}
/** Opens the checkout for an intent and lets the guest pay on the provider's page; returns the callback the provider sends. */
export async function payOnPage(ctx, intentId, outcome) {
  const co = await ctx.pay.checkout(intentId, { restaurant: RESTAURANT, methods: ['card', 'bit'] });
  return { co, cb: ctx.provider.pay(co.providerRef, outcome ? { outcome } : {}) };
}
