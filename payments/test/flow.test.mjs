/* Pay at the table, end to end on the mock: checkout → the provider's page → callback → verified → the bill closes.
   Plus: a decline, a duplicate (idempotency), the port's shape. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertProvider, assertAgorot, PaymentError } from '../port.mjs';
import { setup, openBill, payOnPage, RESTAURANT } from './helpers.mjs';

test('the mock implements the port, with its capability flags', () => {
  const { provider } = setup();
  assert.equal(assertProvider(provider), provider);
  assert.deepEqual(Object.keys(provider.capabilities).sort(), ['bitMaxAmount', 'holdWindowDays', 'maxRefundsPerTxn', 'sandbox', 'supportsPartialCapture', 'walletTokensReusable']);
  assert.throws(() => assertProvider({ name: 'x', capabilities: provider.capabilities }), /lacks createCheckout/);
});

test('amounts are whole agorot', () => {
  assert.equal(assertAgorot(18600), 18600);
  for (const bad of [186.5, -1, '186', NaN, 1e18]) assert.throws(() => assertAgorot(bad), (e) => e instanceof PaymentError && e.code === 'bad_amount');
});

test('pay at the table: the callback is verified by a round trip and the bill closes', async () => {
  const ctx = setup(), { ledger } = ctx, bill = openBill(ledger);
  assert.equal(bill.total, 20600);
  const it = ledger.createIntent({ billId: bill.id, amount: bill.total, idempotencyKey: 'table7-' + bill.id });
  assert.equal(it.state, 'created');
  const { co, cb } = await payOnPage(ctx, it.id);
  assert.match(co.checkoutUrl, /^mock:\/\/checkout\//); assert.equal(ledger.intent(it.id).state, 'pending');
  const { intent, event } = await ctx.pay.onCallback(cb.headers, cb.body);
  assert.equal(event.verified, true); assert.equal(event.type, 'captured'); assert.equal(event.amount, 20600);
  assert.equal(intent.state, 'captured'); assert.equal(intent.captured, 20600);
  assert.equal(ledger.bill(bill.id).status, 'closed'); assert.equal(ledger.outstanding(bill.id), 0);
  assert.ok(ledger.journal.some((j) => j.kind === 'bill.close'));
});

test('a declined card fails the intent and leaves the bill open', async () => {
  const ctx = setup(), { ledger } = ctx, bill = openBill(ledger);
  const it = ledger.createIntent({ billId: bill.id, amount: bill.total, idempotencyKey: 'decline-' + bill.id });
  const { cb } = await payOnPage(ctx, it.id, 'decline');
  const { intent, event } = await ctx.pay.onCallback(cb.headers, cb.body);
  assert.equal(event.type, 'declined'); assert.equal(intent.state, 'failed');
  assert.equal(ledger.bill(bill.id).status, 'open'); assert.equal(ledger.outstanding(bill.id), 20600);
  // a second try is a new intent with a new key; the failed one is final
  assert.throws(() => ledger.transition(it.id, 'captured'), (e) => e.code === 'bad_state');
  const again = ledger.createIntent({ billId: bill.id, amount: bill.total, idempotencyKey: 'retry-' + bill.id });
  assert.notEqual(again.id, it.id);
});

test('an amount ending in 99 declines by itself (the deterministic test amount)', async () => {
  const ctx = setup(), { ledger } = ctx, bill = ledger.openBill({ restaurantId: RESTAURANT.id, lines: [{ name: 'Coffee', unitAmount: 1299 }] });
  const it = ledger.createIntent({ billId: bill.id, amount: 1299, idempotencyKey: 'coffee-99-' + bill.id });
  const { cb } = await payOnPage(ctx, it.id);
  const { intent } = await ctx.pay.onCallback(cb.headers, cb.body);
  assert.equal(intent.state, 'failed');
});

test('duplicate: the same idempotency key is the same intent and the same checkout, never a second charge', async () => {
  const ctx = setup(), { ledger, provider } = ctx, bill = openBill(ledger);
  const a = ledger.createIntent({ billId: bill.id, amount: bill.total, idempotencyKey: 'once-' + bill.id });
  const b = ledger.createIntent({ billId: bill.id, amount: bill.total, idempotencyKey: 'once-' + bill.id });
  assert.equal(a.id, b.id); assert.equal(ledger.intentsOf(bill.id).length, 1);
  assert.throws(() => ledger.createIntent({ billId: bill.id, amount: 100, idempotencyKey: 'once-' + bill.id }), (e) => e.code === 'duplicate');
  const co1 = await ctx.pay.checkout(a.id, { restaurant: RESTAURANT }), co2 = await ctx.pay.checkout(a.id, { restaurant: RESTAURANT });
  assert.equal(co1.providerRef, co2.providerRef); assert.equal(provider.processes.size, 1);
  // the provider's callback twice (providers retry): the second application is refused by the state machine, the money is counted once
  const cb = provider.pay(co1.providerRef);
  await ctx.pay.onCallback(cb.headers, cb.body);
  await assert.rejects(ctx.pay.onCallback(cb.headers, cb.body), (e) => e.code === 'bad_state');
  assert.equal(ledger.intent(a.id).captured, 20600); assert.equal(ledger.bill(bill.id).captured, 20600);
});

test('a token charge is idempotent on both sides', async () => {
  const ctx = setup(), { ledger, provider } = ctx, bill = openBill(ledger);
  const keep = ledger.createIntent({ billId: bill.id, amount: 100, intent: 'tokenize', idempotencyKey: 'keep-card-' + bill.id });
  const { cb } = await payOnPage(ctx, keep.id);
  const { intent: kept } = await ctx.pay.onCallback(cb.headers, cb.body);
  assert.match(kept.token, /^tok_/);
  const fee = ledger.createIntent({ billId: bill.id, amount: 5000, idempotencyKey: 'no-show-' + bill.id });
  const first = await ctx.pay.chargeToken(fee.id, { restaurant: RESTAURANT, token: kept.token });
  assert.equal(first.state, 'captured');
  const twice = await provider.chargeToken(RESTAURANT, kept.token, 5000, fee.idempotencyKey);
  assert.equal(twice.providerRef, first.providerRef);                              // the provider charged once
  assert.equal([...provider.processes.values()].filter((p) => p.req.metadata.tokenCharge).length, 1);   // one charge, not two
  await assert.rejects(provider.chargeToken({ id: 'rest_other' }, kept.token, 5000, 'other-rest-' + bill.id), (e) => e.code === 'not_found');   // a token is the restaurant's
});
