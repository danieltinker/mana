/* Never trust a callback alone. A forged callback (unsigned, signed with the wrong secret, the right signature but a
   claim the provider does not hold, an unknown reference) is rejected before the ledger moves; and the ledger itself
   refuses any event that was not verified by a round trip. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, openBill, payOnPage, RESTAURANT } from './helpers.mjs';

test('a forged callback is rejected: wrong secret, no signature', async () => {
  const ctx = setup(), { ledger, provider } = ctx, bill = openBill(ledger);
  const it = ledger.createIntent({ billId: bill.id, amount: bill.total, idempotencyKey: 'forge-' + bill.id });
  const co = await ctx.pay.checkout(it.id, { restaurant: RESTAURANT });
  const f1 = provider.forge({ ref: co.providerRef, type: 'captured', amount: bill.total, secret: 'guess' });
  await assert.rejects(ctx.pay.onCallback(f1.headers, f1.body), (e) => e.code === 'forged');
  const f2 = provider.forge({ ref: co.providerRef, type: 'captured', amount: bill.total });
  await assert.rejects(ctx.pay.onCallback(f2.headers, f2.body), (e) => e.code === 'forged');
  assert.equal(ledger.intent(it.id).state, 'pending'); assert.equal(ledger.bill(bill.id).status, 'open');
});

test('a signed callback whose claim the provider does not hold is rejected by the round trip', async () => {
  const ctx = setup(), { ledger, provider } = ctx, bill = openBill(ledger);
  const it = ledger.createIntent({ billId: bill.id, amount: bill.total, idempotencyKey: 'claim-' + bill.id });
  const co = await ctx.pay.checkout(it.id, { restaurant: RESTAURANT });
  // the real secret leaked, but the guest never paid: the provider's record says "open", so "captured" is a lie
  const f = provider.forge({ ref: co.providerRef, type: 'captured', amount: bill.total, secret: provider.secret });
  await assert.rejects(ctx.pay.onCallback(f.headers, f.body), (e) => e.code === 'forged' && /the provider says/.test(e.message));
  // the guest paid ₪1 on a tampered page; the callback claims the full bill: the amounts disagree
  const small = ledger.createIntent({ billId: bill.id, amount: 100, idempotencyKey: 'small-' + bill.id });
  const { co: co2, cb } = await payOnPage(ctx, small.id);
  const lie = provider.forge({ ref: co2.providerRef, type: 'captured', amount: bill.total, txnRef: JSON.parse(cb.body).txnRef, secret: provider.secret });
  await assert.rejects(ctx.pay.onCallback(lie.headers, lie.body), (e) => e.code === 'forged');
  const ok = await ctx.pay.onCallback(cb.headers, cb.body);                       // the honest one goes through
  assert.equal(ok.intent.captured, 100); assert.equal(ledger.bill(bill.id).status, 'open');
});

test('an unknown reference and a provider without signatures (Grow) still fail the round trip', async () => {
  const ctx = setup({ signed: false }), { ledger, provider } = ctx, bill = openBill(ledger);
  const it = ledger.createIntent({ billId: bill.id, amount: bill.total, idempotencyKey: 'unsigned-' + bill.id });
  await ctx.pay.checkout(it.id, { restaurant: RESTAURANT });
  const f = provider.forge({ ref: 'proc_9999', type: 'captured', amount: bill.total });
  await assert.rejects(ctx.pay.onCallback(f.headers, f.body), (e) => e.code === 'forged');
  assert.equal(ledger.intent(it.id).state, 'pending');
});

test('the ledger refuses an event that was not verified', () => {
  const { ledger } = setup(), bill = openBill(ledger);
  const it = ledger.createIntent({ billId: bill.id, amount: bill.total, idempotencyKey: 'unverified-' + bill.id });
  ledger.attachCheckout(it.id, { provider: 'mock', providerRef: 'proc_x' });
  assert.throws(() => ledger.applyEvent({ type: 'captured', providerRef: 'proc_x', amount: bill.total, currency: 'ILS', metadata: { intentId: it.id }, verified: false }), (e) => e.code === 'unverified');
  assert.throws(() => ledger.applyEvent({ type: 'captured', providerRef: 'proc_x', amount: bill.total, currency: 'ILS', metadata: { intentId: it.id } }), (e) => e.code === 'unverified');
  assert.throws(() => ledger.applyEvent({ type: 'captured', providerRef: 'proc_x', amount: 1, currency: 'ILS', metadata: { intentId: it.id }, verified: true }), (e) => e.code === 'mismatch');
  assert.equal(ledger.intent(it.id).state, 'pending');
});

test('a checkout request never carries a card and only goes to public https addresses', async () => {
  const { provider } = setup();
  const base = { restaurant: RESTAURANT, intent: 'charge', amount: 100, currency: 'ILS', methods: ['card'], items: [{ name: 'x', qty: 1, unitAmount: 100 }],
    returnUrls: { success: 'https://a/', failure: 'https://a/', cancel: 'https://a/' }, callbackUrl: 'https://a/cb', idempotencyKey: 'k-12345678' };
  await assert.rejects(provider.createCheckout({ ...base, callbackUrl: 'http://localhost:9200/cb' }), (e) => e.code === 'bad_request');
  await assert.rejects(provider.createCheckout({ ...base, currency: 'USD' }), (e) => e.code === 'bad_request');
  await assert.rejects(provider.createCheckout({ ...base, amount: 1.5 }), (e) => e.code === 'bad_amount');
  await assert.rejects(provider.createCheckout({ ...base, items: [{ name: 'x', qty: 1, unitAmount: 99 }] }), (e) => /items sum/.test(e.message));
  assert.equal(JSON.stringify(base).includes('card_number'), false);
});
