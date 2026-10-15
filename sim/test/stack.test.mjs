// The local stack answers like a Supabase project where the simulator depends on it: the schema applied unchanged
// with exactly its grants, the gateway's API key rule, the caller's address set by the gateway (a caller cannot pick
// its own per-source cap), and a second process can attach to a running stack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { asAnon } from '../src/client.mjs';
import { isoAt } from '../src/clock.mjs';
import { attachStack, migrationFiles } from '../stack/start.mjs';
import { bistro, halomTeam } from '../src/scenarios.mjs';
import { liveVenue, useStack } from './helpers.mjs';

const S = useStack();

test('every migration applied unchanged; the grants are exactly the access model; the local differences are named', async () => {
  assert.ok(migrationFiles().length >= 8);
  assert.deepEqual(await S.stack.sql('select * from app.audit_grants()'), []);
  const [t] = await S.stack.sql(`select (select count(*) from pg_tables where schemaname = 'public')::int as tables,
    (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity)::int as without_rls,
    (select count(*) from storage.buckets where id in ('menu-private', 'menu-public'))::int as buckets,
    (select count(*) from pg_namespace where nspname = 'cron')::int as cron`);
  assert.deepEqual([t.without_rls, t.buckets, t.cron], [0, 2, 0], 'RLS everywhere; both buckets; no pg_cron locally (the simulator runs the rollup job)');
  assert.ok(t.tables >= 25);
  assert.ok(S.stack.notes.some((n) => n.startsWith('public_base = http://127.0.0.1:')));
  const caps = await S.stack.sql(`select key from public.app_config where key in ('event_caps', 'event_caps_demo') order by key`);
  if (caps.length === 1) assert.ok(S.stack.notes.some((n) => n.includes('event_caps raised locally')));
});

test('the gateway asks for an API key, as a hosted project does', async () => {
  const url = `${S.stack.apiUrl}/rest/v1/rpc/public_menu`;
  const call = (headers) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ p_slug: 'nobody' }) });
  assert.equal((await call({})).status, 401);
  const wrong = await call({ apikey: 'not-a-key' });
  assert.deepEqual([wrong.status, (await wrong.json()).message], [401, 'Invalid API key']);
  const ok = await call({ apikey: S.stack.anonKey });
  assert.deepEqual([ok.status, await ok.json()], [200, { state: 'not_found' }]);
  assert.equal((await fetch(`${S.stack.apiUrl}/auth/v1/health`)).status, 200);
});

test('per-source caps follow the address the gateway sees; a caller\'s own cf-connecting-ip is ignored', async () => {
  const team = await halomTeam(S.stack, 'caps');
  const real = { ...bistro(), venue: { ...bistro().venue, demo: false } };
  const v = await liveVenue(S.stack, real, 'bistro-caps', team);
  const [{ value: saved }] = await S.stack.sql(`select value from public.app_config where key = 'event_caps'`);
  await S.stack.setConfig('event_caps', { per_source_hour: 3, per_venue_source_day: 1000, per_venue_day: 1000 });
  try {
    const ev = () => ({ id: randomUUID(), name: 'dish_viewed', venueId: v.venueId, at: isoAt(Date.now()), props: { dishId: v.ids.dishes.toast } });
    const x = asAnon(S.stack, { ip: '10.40.0.1' });
    const y = asAnon(S.stack, { ip: '10.40.0.2' });
    const first = await x.rpc('track_events', { p_events: [ev(), ev(), ev(), ev()] });
    assert.deepEqual([first.accepted, first.capped], [3, 1]);
    const other = await y.rpc('track_events', { p_events: [ev(), ev()] });
    assert.deepEqual([other.accepted, other.capped], [2, 0], 'another phone has its own cap');
    const forged = await x.request('POST', '/rest/v1/rpc/track_events', { body: { p_events: [ev()] }, headers: { 'cf-connecting-ip': '203.0.113.7', 'x-real-ip': '203.0.113.8' } });
    assert.deepEqual([forged.accepted, forged.capped], [0, 1], 'the forged header changes nothing');
  } finally {
    await S.stack.setConfig('event_caps', saved);
  }
});

test('a second process attaches to a running stack with the same keys, and letting go leaves it running', async () => {
  const other = await attachStack({ ports: S.stack.ports });
  assert.deepEqual([other.apiUrl, other.anonKey, other.serviceKey], [S.stack.apiUrl, S.stack.anonKey, S.stack.serviceKey], 'the keys are the same on every start');
  assert.deepEqual(await asAnon(other).rpc('public_menu', { p_slug: 'nobody' }), { state: 'not_found' });
  await other.stop();
  assert.deepEqual(await asAnon(S.stack).rpc('public_menu', { p_slug: 'nobody' }), { state: 'not_found' }, 'still running');
  await assert.rejects(attachStack({ ports: { ...S.stack.ports, api: 1 } }), /no simulator stack answers/);
});
