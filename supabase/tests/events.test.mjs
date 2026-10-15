// Events and rollups: track_events dedupes, rejects personal fields the same way the contracts do, caps per source, and
// a fixed batch produces exactly the expected minute and day rollups (and my_dashboard / ops_overview read them).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { as, q, rpc } from './harness/cluster.mjs';
import { A, ID, U, world } from './harness/world.mjs';
import { EVENT_PROPS, rollupKeys, validateEvent } from '../../packages/contracts/src/events.ts';

let w;
before(async () => { w = await world(); });
after(async () => { await w?.stop(); });

let n = 0;
const uid = () => `00000000-0000-4000-9000-${String(++n).padStart(12, '0')}`;
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const ev = (name, props, o = {}) => ({ id: uid(), name, venueId: o.venueId ?? w.B, at: o.at ?? iso(Date.now() - 1000), props });
const track = (batch, headers = { 'x-forwarded-for': '203.0.113.7' }) =>
  as(w.url, 'anon', async (c) => {
    await c.query(`select set_config('request.headers', $1, true)`, [JSON.stringify(headers)]);
    return (await c.query('select public.track_events($1::jsonb) as r', [JSON.stringify(batch)])).rows[0].r;
  });

describe('the events contract in the database', () => {
  test('the SQL event spec is the contracts\' EVENT_PROPS', async () => {
    const { rows } = await w.admin.query('select app.event_spec() as s');
    assert.deepEqual(rows[0].s, EVENT_PROPS);
  });

  test('the SQL check and validateEvent give the same first code on the same inputs', async () => {
    const base = () => ev('dish_viewed', { dishId: w.b.dish });
    const inputs = [
      base(), { ...base(), phone: '050' }, { ...base(), props: { dishId: w.b.dish, Note: 'x' } }, { ...base(), extra: 1 },
      { ...base(), id: 'nope' }, { ...base(), name: 'page_scrolled' }, { ...base(), name: 'menu_published', props: { revision: 1 } },
      { ...base(), at: 'yesterday' }, { ...base(), at: '2020-01-01T00:00:00Z' }, { ...base(), props: {} }, { ...base(), props: { dishId: 'Moshe' } },
      ev('basket_added', { dishId: w.b.dish, qty: 0, fromSuggestion: false }), ev('basket_added', { dishId: w.b.dish, qty: 2, fromSuggestion: 'yes' }),
      ev('menu_opened', { src: 'qr', lang: 'fr', revision: 1 }), ev('menu_opened', { src: 'qr', lang: 'he', revision: 1.5 }),
      ev('suggestion_shown', { ruleId: ID.ruleCheese, trigger: 'popup', dishId: null }), ev('addon_chosen', { dishId: w.b.dish, groupId: w.b.group, optionId: w.b.option, parentOptionId: null }),
      [1, 2], null, 'event',
    ];
    for (const e of inputs) {
      const sql = (await w.admin.query(`select app.check_event($1::jsonb, app.guest_events()) as c`, [JSON.stringify(e)])).rows[0].c;
      const ts = validateEvent(e);
      assert.equal(sql, ts.ok ? null : ts.errors[0].code, JSON.stringify(e).slice(0, 120));
    }
  });

  test('rollup keys agree with the contracts', async () => {
    const samples = [
      ['menu_opened', { src: 'qr', lang: 'en', revision: 2 }], ['dish_viewed', { dishId: w.b.dish }],
      ['addon_chosen', { dishId: w.b.dish, groupId: w.b.group, optionId: w.b.option, parentOptionId: null }],
      ['basket_added', { dishId: w.b.dish, qty: 1, fromSuggestion: true }], ['basket_added', { dishId: w.b.dish, qty: 1, fromSuggestion: false }],
      ['suggestion_dismissed', { ruleId: ID.ruleCheese, trigger: 'sheet', dishId: null }], ['onboarding_step_done', { step: 'hours' }],
      ['import_parsed', { importId: uid(), source: 'wolt_text', sections: 1, dishes: 2, exceptions: 0 }], ['menu_published', { revision: 3 }],
    ];
    for (const [name, props] of samples) {
      const { rows } = await w.admin.query('select app.event_keys($1, $2::jsonb) as k', [name, JSON.stringify(props)]);
      assert.deepEqual(rows[0].k, rollupKeys(name, props), name);
    }
  });
});

describe('track_events', () => {
  test('accepts valid guest events, dedupes by id within and across batches', async () => {
    const a = ev('dish_viewed', { dishId: w.b.dish });
    const r = await track([a, a, ev('menu_opened', { src: 'link', lang: 'he', revision: 1 })]);
    assert.deepEqual(r, { ok: true, accepted: 2, duplicates: 1, capped: 0, rejected: [] });
    const again = await track([a]);
    assert.deepEqual(again, { ok: true, accepted: 0, duplicates: 1, capped: 0, rejected: [] }, 'a retried batch adds nothing');
  });

  test('rejects personal fields and anything outside the contract, one event at a time', async () => {
    const r = await track([
      { ...ev('dish_viewed', { dishId: w.b.dish }), phone: '0500000000' },
      ev('basket_added', { dishId: w.b.dish, qty: 1, fromSuggestion: false, note: 'no onions' }),
      ev('dish_viewed', { dishId: w.b.dish, email: 'a@b.c' }),
      ev('menu_published', { revision: 1 }),
      ev('dish_viewed', { dishId: ID.burger }),
      ev('dish_viewed', { dishId: w.b.dish }, { venueId: '00000000-0000-4000-8000-00000000ffff' }),
      ev('dish_viewed', { dishId: w.b.dish }),
    ]);
    assert.deepEqual(r.rejected, [
      { index: 0, code: 'personal_field' }, { index: 1, code: 'personal_field' }, { index: 2, code: 'personal_field' },
      { index: 3, code: 'name_not_allowed' }, { index: 4, code: 'ref_unknown' }, { index: 5, code: 'venue_unknown' },
    ]);
    assert.equal(r.accepted, 1);
    const stored = await w.admin.query(`select count(*)::int as n from public.events where props::text ~* 'phone|onions|@b\\.c'`);
    assert.equal(stored.rows[0].n, 0, 'nothing personal is stored');
  });

  test('a batch must be 1–50 events; unpublished venues take no events', async () => {
    assert.deepEqual(await track([]), { ok: false, code: 'batch_invalid' });
    assert.deepEqual(await track(Array.from({ length: 51 }, () => ev('dish_viewed', { dishId: w.b.dish }))), { ok: false, code: 'batch_invalid' });
    assert.deepEqual(await rpc(w.url, 'anon', 'track_events', { p_events: { not: 'an array' } }), { ok: false, code: 'batch_invalid' });
    const made = await rpc(w.url, U.ownerB, 'create_venue', { p_slug: 'not-live', p_name_en: 'Not live' });
    const r = await track([ev('menu_opened', { src: 'qr', lang: 'he', revision: 1 }, { venueId: made.id })]);
    assert.deepEqual(r.rejected, [{ index: 0, code: 'venue_unknown' }]);
  });

  test('per-source cap: a script cannot inflate the numbers', async () => {
    await w.admin.query(`update public.app_config set value = jsonb_set(value, '{per_source_hour}', '5') where key = 'event_caps'`);
    try {
      const batch = Array.from({ length: 8 }, () => ev('dish_viewed', { dishId: w.b.dish }));
      const r = await track(batch, { 'x-forwarded-for': '198.51.100.9' });
      assert.equal(r.accepted, 5);
      assert.equal(r.capped, 3);
      const other = await track([ev('dish_viewed', { dishId: w.b.dish })], { 'x-forwarded-for': '198.51.100.10' });
      assert.equal(other.accepted, 1, 'another source is not affected');
    } finally {
      await w.admin.query(`update public.app_config set value = jsonb_set(value, '{per_source_hour}', '600') where key = 'event_caps'`);
    }
  });

  test('the raw events table is not readable through the API; the source hash is not stored with events', async () => {
    assert.equal((await q(w.url, U.ownerB, 'select 1 from public.events limit 1')).error?.code, '42501');
    const { rows } = await w.admin.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'events'`);
    assert.deepEqual(rows.map((r) => r.column_name).sort(), ['at', 'demo', 'id', 'name', 'props', 'received_at', 'source', 'venue_id']);
  });
});

describe('rollups', () => {
  test('a fixed batch produces exactly the expected minute and day rollups', async () => {
    await w.admin.query('select app.build_rollups()');                 // count whatever earlier tests left in the queue
    await w.admin.query('delete from public.rollups_minute; delete from public.rollups_day');
    const now = Date.now();
    const t1 = Math.floor(now / 60000) * 60000 - 3 * 60000 + 5000;      // three minutes ago, 5 s into the minute
    const t2 = t1 + 60000;
    const rule = await w.admin.query(`insert into public.upsell_rules (venue_id, trigger, scope_kind, suggest_kind, suggest_dish_id, line_en)
      values ($1, 'add', 'all', 'dish', $2, 'Soup?') returning id`, [w.B, w.b.dish]);
    const R = rule.rows[0].id;
    const batch = [
      ev('menu_opened', { src: 'qr', lang: 'he', revision: 2 }, { at: iso(t1) }),
      ev('menu_opened', { src: 'qr', lang: 'en', revision: 2 }, { at: iso(t1 + 1000) }),
      ev('menu_opened', { src: 'link', lang: 'he', revision: 2 }, { at: iso(t2) }),
      ev('dish_viewed', { dishId: w.b.dish }, { at: iso(t1 + 2000) }),
      ev('dish_viewed', { dishId: w.b.dish }, { at: iso(t2 + 2000) }),
      ev('basket_added', { dishId: w.b.dish, qty: 2, fromSuggestion: true }, { at: iso(t2 + 3000) }),
      ev('suggestion_shown', { ruleId: R, trigger: 'add', dishId: w.b.dish }, { at: iso(t2 + 1000) }),
      ev('suggestion_accepted', { ruleId: R, trigger: 'add', dishId: w.b.dish }, { at: iso(t2 + 2500) }),
    ];
    const r = await track([...batch, batch[0]]);
    assert.equal(r.accepted, 8);
    assert.equal(r.duplicates, 1);
    const job = (await w.admin.query('select app.build_rollups() as r')).rows[0].r;
    assert.deepEqual(job, { ok: true, events: 8 });
    assert.deepEqual((await w.admin.query('select app.build_rollups() as r')).rows[0].r, { ok: true, events: 0 }, 'nothing is counted twice');

    const minutes = (await w.admin.query(`select extract(epoch from bucket)::bigint * 1000 as b, name, key, n::int from public.rollups_minute where venue_id = $1 order by 1, 2, 3`, [w.B])).rows;
    const m1 = Math.floor(t1 / 60000) * 60000, m2 = Math.floor(t2 / 60000) * 60000;
    const want = [
      [m1, 'dish_viewed', '', 1], [m1, 'dish_viewed', `dish:${w.b.dish}`, 1],
      [m1, 'menu_opened', '', 2], [m1, 'menu_opened', 'lang:en', 1], [m1, 'menu_opened', 'lang:he', 1], [m1, 'menu_opened', 'src:qr', 2],
      [m2, 'basket_added', '', 1], [m2, 'basket_added', `dish:${w.b.dish}`, 1], [m2, 'basket_added', 'from:suggestion', 1],
      [m2, 'dish_viewed', '', 1], [m2, 'dish_viewed', `dish:${w.b.dish}`, 1],
      [m2, 'menu_opened', '', 1], [m2, 'menu_opened', 'lang:he', 1], [m2, 'menu_opened', 'src:link', 1],
      [m2, 'suggestion_accepted', '', 1], [m2, 'suggestion_accepted', `rule:${R}`, 1], [m2, 'suggestion_accepted', 'trigger:add', 1],
      [m2, 'suggestion_shown', '', 1], [m2, 'suggestion_shown', `rule:${R}`, 1], [m2, 'suggestion_shown', 'trigger:add', 1],
    ];
    assert.deepEqual(minutes.map((x) => [Number(x.b), x.name, x.key, x.n]), want);

    const days = (await w.admin.query(`select name, key, n::int from public.rollups_day where venue_id = $1 and key = '' order by name`, [w.B])).rows;
    assert.deepEqual(days, [
      { name: 'basket_added', key: '', n: 1 }, { name: 'dish_viewed', key: '', n: 2 }, { name: 'menu_opened', key: '', n: 3 },
      { name: 'suggestion_accepted', key: '', n: 1 }, { name: 'suggestion_shown', key: '', n: 1 },
    ]);

    // the dashboards read the same numbers
    const d = await rpc(w.url, U.ownerB, 'my_dashboard', { p_venue: w.B, p_range: 'today' });
    assert.equal(d.totals.menuOpens, 3);
    assert.deepEqual(d.opensBy, { qr: 2, link: 1, he: 2, en: 1 });
    assert.equal(d.totals.dishViews, 2);
    assert.deepEqual(d.topDishes.map((x) => [x.dishId, x.views, x.adds]), [[w.b.dish, 2, 1]]);
    assert.deepEqual(d.rules.find((x) => x.ruleId === R), { ruleId: R, label: '', line: { he: '', en: 'Soup?' }, active: true, shown: 1, accepted: 1, dismissed: 0 });
    assert.equal(d.lastHour.reduce((s, x) => s + x.opens, 0), 3);
    const o = await rpc(w.url, U.support, 'ops_overview');
    const vb = o.venues.find((x) => x.id === w.B);
    assert.equal(vb.opens.today, 3);
    assert.equal(vb.opens.lastHour, 3);
    assert.equal(o.totals.opensToday, 3);
  });

  test('demo traffic is flagged and left out of real totals', async () => {
    const r = await track([ev('menu_opened', { src: 'qr', lang: 'he', revision: 1 }, { venueId: A })]);
    assert.equal(r.accepted, 1);
    await w.admin.query('select app.build_rollups()');
    const { rows } = await w.admin.query(`select demo from public.events where venue_id = $1 and name = 'menu_opened'`, [A]);
    assert.ok(rows.every((x) => x.demo === true));
    const o = await rpc(w.url, U.support, 'ops_overview');
    assert.equal(o.totals.opensToday, 3, 'the demo café is not in the real total');
    assert.equal(o.venues.find((x) => x.id === A).opens.today, 1, 'but its own card shows its traffic');
    assert.equal((await rpc(w.url, U.ownerA, 'my_dashboard', { p_venue: A, p_range: '7d' })).totals.menuOpens, 1);
  });

  test('an event late in the queue is still counted once (no watermark to miss it)', async () => {
    // an event whose time is two hours ago arrives now (an offline phone): it lands in its own minute
    const late = ev('dish_viewed', { dishId: w.b.dish }, { at: iso(Date.now() - 2 * 3600_000) });
    assert.equal((await track([late])).accepted, 1);
    assert.deepEqual((await w.admin.query('select app.build_rollups() as r')).rows[0].r, { ok: true, events: 1 });
    const { rows } = await w.admin.query(`select n::int from public.rollups_minute where venue_id = $1 and bucket = date_trunc('minute', $2::timestamptz) and name = 'dish_viewed' and key = ''`, [w.B, late.at]);
    assert.deepEqual(rows, [{ n: 1 }]);
  });

  test('server events: onboarding steps and imports are emitted by the database itself', async () => {
    await as(w.url, U.ownerB, (c) => c.query(`update public.onboarding_progress set state = 'done' where venue_id = $1 and step = 'hours'`, [w.B]));
    const imp = await as(w.url, U.ownerB, async (c) => (await c.query(`insert into public.menu_imports (venue_id, source, raw_text) values ($1, 'wolt_text', 'Soup 38') returning id`, [w.B])).rows[0].id);
    await q(w.url, 'service', `update public.menu_imports set status = 'parsed', parsed = '{"sections":[{"dishes":[{},{}]}]}', exceptions = '[{"code":"price_missing"}]' where id = $1`, [imp]);
    const { rows } = await w.admin.query(`select name, props from public.events where venue_id = $1 and source = 'server' and name in ('onboarding_step_done', 'import_parsed') order by at, name`, [w.B]);
    // create_venue finished "venue", the first publish finished "publish", this test finished "hours"
    assert.deepEqual(rows.filter((r) => r.name === 'onboarding_step_done').map((r) => r.props.step).sort(), ['hours', 'publish', 'venue']);
    assert.deepEqual(rows.filter((r) => r.name === 'import_parsed').map((r) => r.props), [{ importId: imp, source: 'wolt_text', sections: 1, dishes: 2, exceptions: 1 }]);
    // an owner cannot mark an import as parsed: only the scanner (service role) does
    const r2 = await as(w.url, U.ownerB, async (c) => (await c.query(`insert into public.menu_imports (venue_id, source, raw_text) values ($1, 'paste', 'x') returning id`, [w.B])).rows[0].id);
    const t = await q(w.url, U.ownerB, `update public.menu_imports set status = 'parsed' where id = $1`, [r2]);
    assert.match(t.error?.message ?? '', /import_transition/);
  });
});

describe('partitions', () => {
  test('monthly partitions exist around now; an event outside them falls into the default and moves when its month is created', async () => {
    const { rows } = await w.admin.query(`select c.relname from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'public.events'::regclass order by 1`);
    const names = rows.map((r) => r.relname);
    assert.ok(names.includes('events_default'));
    assert.ok(names.filter((x) => /^events_y\d{4}m\d{2}$/.test(x)).length >= 4, names.join(','));
    // a row in a month with no partition (inserted directly, as the database owner) sits in the default one
    await w.admin.query(`insert into public.events (id, venue_id, name, at, source, props) values (gen_random_uuid(), $1, 'menu_published', now() + interval '200 days', 'server', '{"revision":1}')`, [w.B]);
    assert.equal((await w.admin.query('select count(*)::int as n from app.events_default')).rows[0].n, 1);
    assert.ok((await w.admin.query('select app.ensure_event_partitions(8) as n')).rows[0].n >= 1);
    assert.equal((await w.admin.query('select count(*)::int as n from app.events_default')).rows[0].n, 0, 'moved into its month');
    assert.equal((await w.admin.query(`select count(*)::int as n from public.events where at > now() + interval '100 days'`)).rows[0].n, 1);
    // RLS is on for every partition (also the new ones)
    const off = await w.admin.query(`select c.relname from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'public.events'::regclass and not c.relrowsecurity`);
    assert.deepEqual(off.rows, []);
  });
});
