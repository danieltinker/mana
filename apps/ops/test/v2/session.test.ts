// The v2 connection (src/v2/session.ts): what config it accepts, and where it keeps its session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_STORAGE_KEY, connect } from '../../src/v2/session.ts';

const KEY = 'sb_publishable_unit_test';

test('connect (N5): https anywhere; plain http only on a local stack, where no token crosses a network', () => {
  assert.ok(connect({ supabaseUrl: 'https://project.supabase.example', supabaseKey: KEY, env: 'demo', schema: 2 }).ok);
  const demo = connect({ supabaseUrl: 'http://project.example', supabaseKey: KEY, env: 'demo', schema: 2 });
  assert.ok(!demo.ok && /plain http:\/\/ backend outside a local stack/.test(demo.message));
  assert.ok(!connect({ supabaseUrl: 'http://127.0.0.1:54321', supabaseKey: KEY }).ok, 'no env is production');
  assert.ok(connect({ supabaseUrl: 'http://127.0.0.1:54321', supabaseKey: KEY, env: 'local', schema: 2 }).ok);
  assert.ok(!connect({ supabaseUrl: 'ftp://127.0.0.1', supabaseKey: KEY, env: 'local' }).ok);
  assert.ok(!connect({ supabaseUrl: 'not a url', supabaseKey: KEY, env: 'local' }).ok);
  assert.ok(!connect({ supabaseUrl: 'https://project.supabase.example' }).ok, 'no key');
  assert.ok(!connect(null).ok);
});

test('connect (N6): the session lives under its own storage key, apart from v1 and the owner app', () => {
  const c = connect({ supabaseUrl: 'https://project.supabase.example', supabaseKey: KEY, env: 'demo', schema: 2 });
  assert.ok(c.ok);
  if (!c.ok) return;
  assert.equal(AUTH_STORAGE_KEY, 'mana.ops.v2.auth');
  assert.equal((c.value.client.auth as unknown as { storageKey: string }).storageKey, AUTH_STORAGE_KEY);
});
