/* Deposits as holds (J5): capture at most what was held, release on arrival, the window. Refunds: never more than
   captured, never more refunds than the provider allows; same-day cancel is the whole amount. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, openBill, payOnPage, RESTAURANT } from './helpers.mjs';

const DAY = 86400000;

test('a deposit is a hold: over-capture is rejected, a partial capture settles the rest', async () => {
  const ctx = setup(), { ledger } = ctx;
  const booking = ledger.openBill({ restaurantId: RESTAURANT.id, lines: [{ name: 'Deposit, table for 4', unitAmount: 20000, kind: 'deposit' }] });
  const hold = ledger.createIntent({ billId: booking.id, amount: 20000, intent: 'authorize', idempotencyKey: 'deposit-' + booking.id });
  const { cb } = await payOnPage(ctx, hold.id);
  const { intent } = await ctx.pay.onCallback(cb.headers, cb.body);
  assert.equal(intent.state, 'authorized'); assert.equal(intent.held, 20000); assert.equal(ledger.bill(booking.id).captured, 0);
  await assert.rejects(ctx.pay.capture(hold.id, 20001), (e) => e.code === 'over_capture');
  await assert.rejects(ctx.provider.capture(intent.providerRef, 20001), (e) => e.code === 'over_capture');   // the provider refuses it too
  assert.equal(ledger.intent(hold.id).state, 'authorized');
  const done = await ctx.pay.capture(hold.id, 8000);                                 // the no-show fee for two of the four
  assert.equal(done.state, 'captured'); assert.equal(done.captured, 8000);
  await assert.rejects(ctx.pay.capture(hold.id, 1), (e) => e.code === 'bad_state');  // a hold settles once
});

test('a hold is released on arrival, and capture(0) is a release', async () => {
  const ctx = setup(), { ledger } = ctx;
  const b = ledger.openBill({ restaurantId: RESTAURANT.id, lines: [{ name: 'Deposit', unitAmount: 10000, kind: 'deposit' }] });
  const h1 = ledger.createIntent({ billId: b.id, amount: 10000, intent: 'authorize', idempotencyKey: 'h1-' + b.id });
  const { cb } = await payOnPage(ctx, h1.id); await ctx.pay.onCallback(cb.headers, cb.body);
  const r = await ctx.pay.release(h1.id); assert.equal(r.state, 'released');
  const h2 = ledger.createIntent({ billId: b.id, amount: 10000, intent: 'authorize', idempotencyKey: 'h2-' + b.id });
  const p2 = await payOnPage(ctx, h2.id); await ctx.pay.onCallback(p2.cb.headers, p2.cb.body);
  const z = await ctx.pay.capture(h2.id, 0); assert.equal(z.state, 'released');
  assert.equal(ledger.bill(b.id).status, 'open'); assert.equal(ledger.bill(b.id).captured, 0);
});

test('a hold past its window cannot be captured (place it T-3 days, not at booking)', async () => {
  const ctx = setup(), { ledger, provider } = ctx;
  const b = ledger.openBill({ restaurantId: RESTAURANT.id, lines: [{ name: 'Deposit', unitAmount: 10000, kind: 'deposit' }] });
  const h = ledger.createIntent({ billId: b.id, amount: 10000, intent: 'authorize', idempotencyKey: 'late-' + b.id });
  const { cb } = await payOnPage(ctx, h.id); await ctx.pay.onCallback(cb.headers, cb.body);
  ctx.tick((provider.capabilities.holdWindowDays + 1) * DAY);
  await assert.rejects(ctx.pay.capture(h.id, 10000), (e) => e.code === 'hold_expired');
});

test('refunds: never more than captured, and at most the provider\'s count', async () => {
  const ctx = setup(), { ledger, provider } = ctx, bill = openBill(ledger);
  const it = ledger.createIntent({ billId: bill.id, amount: bill.total, idempotencyKey: 'refund-' + bill.id });
  const { cb } = await payOnPage(ctx, it.id); await ctx.pay.onCallback(cb.headers, cb.body);
  ctx.tick(2 * DAY);                                                                  // after settlement: a refund, not a cancel
  await assert.rejects(ctx.pay.refund(it.id, 20601), (e) => e.code === 'over_refund');
  const r1 = await ctx.pay.refund(it.id, 4200);                                       // the dessert was wrong
  assert.equal(r1.state, 'refunded_partial'); assert.equal(r1.refunded, 4200); assert.equal(r1.refundCount, 1);
  const r2 = await ctx.pay.refund(it.id, 1000);
  assert.equal(r2.state, 'refunded_partial'); assert.equal(r2.refundCount, 2);
  assert.equal(provider.capabilities.maxRefundsPerTxn, 2);
  await assert.rejects(ctx.pay.refund(it.id, 100), (e) => e.code === 'refund_cap');   // the service stops before the provider is asked
  await assert.rejects(provider.refund(it.providerRef, 100), (e) => e.code === 'refund_cap');   // and the provider would too
  assert.equal(ledger.intent(it.id).refunded, 5200); assert.equal(ledger.bill(bill.id).refunded, 5200);
  assert.equal(ledger.refunds.size, 2);
});

test('a full refund is refunded_full; a same-day cancel is the whole amount', async () => {
  const ctx = setup(), { ledger } = ctx, bill = openBill(ledger);
  const a = ledger.createIntent({ billId: bill.id, amount: bill.total, idempotencyKey: 'full-' + bill.id });
  const pa = await payOnPage(ctx, a.id); await ctx.pay.onCallback(pa.cb.headers, pa.cb.body);
  const c = await ctx.pay.cancel(a.id);                                               // same day
  assert.equal(c.state, 'refunded_full'); assert.equal(c.refunded, 20600);
  assert.throws(() => ledger.transition(a.id, 'captured'), (e) => e.code === 'bad_state');   // final
  const bill2 = openBill(ledger), b = ledger.createIntent({ billId: bill2.id, amount: bill2.total, idempotencyKey: 'full2-' + bill2.id });
  const pb = await payOnPage(ctx, b.id); await ctx.pay.onCallback(pb.cb.headers, pb.cb.body);
  ctx.tick(3 * DAY);
  await assert.rejects(ctx.pay.cancel(b.id), (e) => e.code === 'bad_state');          // not same day any more
  const r = await ctx.pay.refund(b.id, 20600); assert.equal(r.state, 'refunded_full');
});

test('no partial capture where the provider has none', async () => {
  const ctx = setup({ capabilities: { supportsPartialCapture: false } }), { ledger } = ctx;
  const b = ledger.openBill({ restaurantId: RESTAURANT.id, lines: [{ name: 'Deposit', unitAmount: 10000, kind: 'deposit' }] });
  const h = ledger.createIntent({ billId: b.id, amount: 10000, intent: 'authorize', idempotencyKey: 'nopart-' + b.id });
  const { cb } = await payOnPage(ctx, h.id); await ctx.pay.onCallback(cb.headers, cb.body);
  await assert.rejects(ctx.pay.capture(h.id, 5000), (e) => e.code === 'no_partial_capture');
  assert.equal((await ctx.pay.capture(h.id, 10000)).state, 'captured');
});
