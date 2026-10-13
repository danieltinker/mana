/* The Grow and PayPlus adapters are shapes tonight: they implement the port, refuse to run without credentials, and are
   never allowed to reach the network from a test (a fetch that throws is injected, and must not be called). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertProvider } from '../port.mjs';
import { GrowProvider, GROW_ENDPOINTS } from '../providers/grow.mjs';
import { PayPlusProvider, PAYPLUS_ENDPOINTS } from '../providers/payplus.mjs';

const noNet = async () => { throw new Error('the network must not be reached from a test'); };

test('Grow refuses to run without the platform key and the restaurant\'s ids', () => {
  assert.throws(() => new GrowProvider(), (e) => e.code === 'no_credentials');
  assert.throws(() => new GrowProvider({ apiKey: 'x' }), (e) => e.code === 'no_credentials');
  assert.throws(() => new GrowProvider({ apiKey: 'x', userId: 'y', pageCode: 'z', env: 'production' }), (e) => e.code === 'no_credentials');   // production base URL is issued by Grow
});

test('Grow implements the port with its flags; a callback for an unknown process is forged, without any network call', async () => {
  const g = assertProvider(new GrowProvider({ apiKey: 'test', userId: 'test', pageCode: 'test', fetch: noNet }));
  assert.equal(g.capabilities.maxRefundsPerTxn, 2); assert.equal(g.capabilities.supportsPartialCapture, true); assert.equal(g.capabilities.sandbox, 'cards-only');
  await assert.rejects(g.verifyCallback({}, 'processId=123&transactionId=1&sum=10'), (e) => e.code === 'forged');
  await assert.rejects(g.refund('123', 100), (e) => e.code === 'not_found');
  assert.equal(GROW_ENDPOINTS.refund, null);   // the path is not confirmed: refund() says so instead of guessing
  await assert.rejects(g.issueDocument('t', 'credit'), (e) => e.code === 'not_supported');
});

test('PayPlus refuses to run without api-key, secret-key and payment_page_uid', () => {
  assert.throws(() => new PayPlusProvider(), (e) => e.code === 'no_credentials');
  assert.throws(() => new PayPlusProvider({ apiKey: 'a', secretKey: 'b' }), (e) => e.code === 'no_credentials');
});

test('PayPlus implements the port; an unsigned or mis-signed callback is forged before any round trip', async () => {
  const p = assertProvider(new PayPlusProvider({ apiKey: 'a', secretKey: 'b', paymentPageUid: 'c', fetch: noNet }));
  assert.equal(p.capabilities.supportsPartialCapture, true);
  await assert.rejects(p.verifyCallback({}, '{"page_request_uid":"x"}'), (e) => e.code === 'forged');
  await assert.rejects(p.verifyCallback({ hash: 'nope' }, '{"page_request_uid":"x"}'), (e) => e.code === 'forged');
  assert.ok(Object.values(PAYPLUS_ENDPOINTS).every((e) => !/^https?:/.test(e)));   // paths, joined to the staging or production base
});
