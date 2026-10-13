/* Split bills: N intents against one bill, the bill closes when the captured shares reach its total. Tips: their own
   rows and a line item on the intent, never part of the bill's total. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, openBill, payOnPage, RESTAURANT } from './helpers.mjs';

test('three equal shares close the bill when the last one is paid; agorot add up exactly', async () => {
  const ctx = setup(), { ledger } = ctx, bill = openBill(ledger);                      // ₪206.00 by 3: 68.67 + 68.67 + 68.66
  const shares = ledger.splitEqual(bill.id, 3);
  assert.deepEqual(shares.map((s) => s.amount), [6867, 6867, 6866]);
  assert.equal(shares.reduce((n, s) => n + s.amount, 0), bill.total);
  const intents = shares.map((s) => ledger.createIntent({ billId: bill.id, shareId: s.id, amount: s.amount, idempotencyKey: 'seat-' + s.seat + '-' + bill.id }));
  assert.equal(ledger.intentsOf(bill.id).length, 3);
  for (const [i, it] of intents.entries()) {
    const { cb } = await payOnPage(ctx, it.id); await ctx.pay.onCallback(cb.headers, cb.body);
    assert.equal(ledger.bill(bill.id).status, i < 2 ? 'open' : 'closed', 'after share ' + (i + 1));
    assert.equal(ledger.outstanding(bill.id), bill.total - shares.slice(0, i + 1).reduce((n, s) => n + s.amount, 0));
  }
  assert.equal(ledger.bill(bill.id).captured, bill.total);
  assert.throws(() => ledger.createIntent({ billId: bill.id, amount: 100, idempotencyKey: 'late-' + bill.id }), (e) => e.code === 'bad_state');   // closed
});

test('a share that fails is paid again by a new intent; the others are untouched', async () => {
  const ctx = setup(), { ledger } = ctx, bill = openBill(ledger);
  const [s1, s2] = ledger.splitEqual(bill.id, 2);
  const a = ledger.createIntent({ billId: bill.id, shareId: s1.id, amount: s1.amount, idempotencyKey: 'a-' + bill.id });
  const b = ledger.createIntent({ billId: bill.id, shareId: s2.id, amount: s2.amount, idempotencyKey: 'b-' + bill.id });
  const pa = await payOnPage(ctx, a.id); await ctx.pay.onCallback(pa.cb.headers, pa.cb.body);
  const pb = await payOnPage(ctx, b.id, 'decline'); await ctx.pay.onCallback(pb.cb.headers, pb.cb.body);
  assert.equal(ledger.intent(b.id).state, 'failed'); assert.equal(ledger.bill(bill.id).status, 'open');
  assert.throws(() => ledger.createIntent({ billId: bill.id, shareId: s1.id, amount: s1.amount, idempotencyKey: 'a2-' + bill.id }), (e) => e.code === 'bad_state');   // s1 is paid
  const b2 = ledger.createIntent({ billId: bill.id, shareId: s2.id, amount: s2.amount, idempotencyKey: 'b2-' + bill.id });
  const pb2 = await payOnPage(ctx, b2.id); await ctx.pay.onCallback(pb2.cb.headers, pb2.cb.body);
  assert.equal(ledger.bill(bill.id).status, 'closed');
});

test('shares by items carry their lines to the document; shares never exceed the bill', () => {
  const { ledger } = setup(), bill = openBill(ledger);
  const [mine, yours] = ledger.splitByItems(bill.id, [[0, 2], [1]]);
  assert.equal(mine.amount, 7800 + 4200); assert.equal(yours.amount, 8600);
  const it = ledger.createIntent({ billId: bill.id, shareId: mine.id, amount: mine.amount, idempotencyKey: 'items-' + bill.id });
  assert.deepEqual(it.items.map((l) => l.name), ['Lamb kebab', 'Crème brûlée']);
  assert.throws(() => ledger.addShare(bill.id, 1), (e) => e.code === 'bad_amount');         // 20600 + 1 > total
  const b2 = openBill(ledger);
  assert.throws(() => ledger.splitByItems(b2.id, [[0], [0]]), /in two shares/);
  assert.throws(() => ledger.createIntent({ billId: b2.id, amount: b2.total + 1, idempotencyKey: 'over-' + b2.id }), (e) => e.code === 'bad_amount');
});

test('tips are their own rows and a line item, and do not count towards the bill', async () => {
  const ctx = setup(), { ledger, provider } = ctx, bill = openBill(ledger);
  const it = ledger.createIntent({ billId: bill.id, amount: bill.total, tip: 2500, idempotencyKey: 'tip-' + bill.id });
  assert.equal(it.total, 23100);
  assert.deepEqual(it.items.at(-1), { name: 'Tip', qty: 1, unitAmount: 2500, kind: 'tip' });
  const tips = ledger.tipsOf(bill.id); assert.equal(tips.length, 1); assert.equal(tips[0].amount, 2500); assert.equal(tips[0].state, 'pending');
  const { co, cb } = await payOnPage(ctx, it.id);
  assert.equal(provider.processes.get(co.providerRef).amount, 23100);                   // the provider is asked for bill + tip
  await ctx.pay.onCallback(cb.headers, cb.body);
  assert.equal(ledger.bill(bill.id).status, 'closed'); assert.equal(ledger.bill(bill.id).captured, 20600);   // the tip is not the bill's
  assert.equal(ledger.intent(it.id).captured, 23100); assert.equal(ledger.intent(it.id).capturedShare, 20600);
  assert.equal(ledger.tipsOf(bill.id)[0].state, 'collected'); assert.equal(ledger.tipsOf(bill.id)[0].collected, 2500);
  const doc = await provider.issueDocument(ledger.intent(it.id).txnRef, 'invoice_receipt', ledger.intent(it.id).items);
  assert.match(doc.docRef, /^doc_/); assert.equal(provider.docs[0].lines.some((l) => l.kind === 'tip'), true);
});

test('a tip on a split share: the share closes its part, the tip row is its own', async () => {
  const ctx = setup(), { ledger } = ctx, bill = openBill(ledger);
  const [s1, s2] = ledger.splitEqual(bill.id, 2);
  const a = ledger.createIntent({ billId: bill.id, shareId: s1.id, amount: s1.amount, tip: 1000, idempotencyKey: 'ta-' + bill.id });
  const b = ledger.createIntent({ billId: bill.id, shareId: s2.id, amount: s2.amount, idempotencyKey: 'tb-' + bill.id });
  for (const it of [a, b]) { const { cb } = await payOnPage(ctx, it.id); await ctx.pay.onCallback(cb.headers, cb.body); }
  assert.equal(ledger.bill(bill.id).status, 'closed'); assert.equal(ledger.bill(bill.id).captured, 20600);
  assert.deepEqual(ledger.tipsOf(bill.id).map((t) => [t.intentId, t.amount, t.state]), [[a.id, 1000, 'collected']]);
  assert.equal(ledger.intentsOf(bill.id).reduce((n, i) => n + i.captured, 0), 21600);
});
