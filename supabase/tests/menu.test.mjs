// The menu model in the database: publish_menu builds a snapshot the contracts validator accepts, the SQL and TypeScript
// validators agree, one nesting level is enforced by the database, availability and time agree with the contracts.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { as, q, rpc } from './harness/cluster.mjs';
import { A, count, ID, U, world } from './harness/world.mjs';
import {
  isOpenAt, LIMITS, menuAvailability, nextOpening, priceDish, pricingContext, resolveUntil, unavailableOf, validateSnapshotV2, zonedTime,
  ACT_FOR_OWNER_ACTIONS, ASSET_STATUSES, CASE_STATUSES, CASE_TOPICS, ENTITLEMENT_STATUSES, IMPORT_SOURCES, IMPORT_STATUSES, MEMBER_ROLES,
  ONBOARDING_STEPS, ONBOARDING_STATES, PLANS, ROOMS, SCENES, SECTION_KINDS, SELECTIONS, STAFF_ROLES, TABLE_COLUMNS, TAGS, TARGET_KINDS,
  TRIGGERS, UNTIL_KINDS, VENUE_KINDS, VENUE_MODES,
} from '../../packages/contracts/src/index.ts';
import { cafeDemo, mutable } from '../../packages/contracts/test/fixtures.ts';

let w;
before(async () => { w = await world(); });
after(async () => { await w?.stop(); });

const snapshotOf = async (slug) => (await rpc(w.url, 'anon', 'public_menu', { p_slug: slug }));

describe('publish_menu and the snapshot v2', () => {
  test('the published synthetic café is valid and equals the contracts fixture', async () => {
    const r = await snapshotOf('cafe-demo');
    assert.equal(r.state, 'ok');
    const v = validateSnapshotV2(r.snapshot);
    assert.ok(v.ok, JSON.stringify(!v.ok && v.errors));
    assert.deepEqual({ ...r.snapshot, publishedAt: 'x' }, { ...cafeDemo(), publishedAt: 'x' });
  });

  test('an owner\'s publish returns the public path and bumps the revision; the trial starts', async () => {
    const r = await rpc(w.url, U.ownerB, 'publish_menu', { p_venue: w.B, p_note: 'second' });
    assert.deepEqual(r, { ok: true, revision: 2, slug: 'bistro-test', path: '/m/bistro-test' });
    const { rows } = await w.admin.query('select status, trial_ends_at is not null as t from public.entitlements where venue_id = $1', [w.B]);
    assert.deepEqual(rows[0], { status: 'trialing', t: true });
    const snap = (await snapshotOf('bistro-test')).snapshot;
    assert.ok(validateSnapshotV2(snap).ok);
    assert.equal(snap.revision, 2);
  });

  test('a manager may publish; publish is logged and emitted as an event', async () => {
    const r = await rpc(w.url, U.managerA, 'publish_menu', { p_venue: A, p_note: 'by the manager' });
    assert.equal(r.ok, true);
    const { rows } = await w.admin.query(`select actor_kind, via, detail from public.activity_log where venue_id = $1 and action = 'menu.publish' order by id desc limit 1`, [A]);
    assert.deepEqual(rows[0], { actor_kind: 'manager', via: 'rpc', detail: { revision: r.revision, note: 'by the manager' } });
    const ev = await w.admin.query(`select props from public.events where venue_id = $1 and name = 'menu_published' order by at desc limit 1`, [A]);
    assert.deepEqual(ev.rows[0].props, { revision: r.revision });
  });

  test('hidden dishes, empty sections, unapproved pictures and rules pointing at hidden dishes stay out', async () => {
    await as(w.url, U.ownerA, async (c) => {
      await c.query(`update public.dishes set hidden = true where id = $1`, [ID.croissant]);
      await c.query(`insert into public.sections (venue_id, name_en, position) values ($1, 'Empty', 9)`, [A]);
      await c.query(`insert into public.assets (venue_id, dish_id, status, kind, color_path, thumb_path) values ($1, $2, 'uploaded', 'photo', $3, $4)`,
        [A, ID.burger, `${A}/p/color.jpg`, `${A}/p/thumb.jpg`]);
    });
    const p = await rpc(w.url, U.ownerA, 'preview_menu', { p_venue: A });
    assert.deepEqual(p.issues, []);
    const s = p.snapshot;
    assert.ok(validateSnapshotV2(s).ok);
    const dishes = s.sections.flatMap((x) => x.dishes.map((d) => d.id));
    assert.ok(!dishes.includes(ID.croissant));
    assert.ok(!s.sections.some((x) => x.name.en === 'Empty'));
    assert.equal(s.sections.flatMap((x) => x.dishes).find((d) => d.id === ID.burger).asset, null);
    assert.ok(!s.upsellRules.some((r) => r.id === ID.ruleCroissant), 'the croissant rule has nothing to suggest');
    assert.ok(!s.sections.flatMap((x) => x.dishes).find((d) => d.id === ID.espresso).related.includes(ID.croissant));
    await as(w.url, U.ownerA, (c) => c.query(`update public.dishes set hidden = false where id = $1`, [ID.croissant]));
  });

  test('an empty menu cannot be published; a counter, a stranger and support cannot publish', async () => {
    const made = await rpc(w.url, U.ownerB, 'create_venue', { p_slug: 'empty-one', p_name_en: 'Empty One' });
    assert.deepEqual(await rpc(w.url, U.ownerB, 'publish_menu', { p_venue: made.id }), { ok: false, code: 'empty_menu' });
    for (const who of [U.counterA, U.stranger, U.support]) assert.equal((await rpc(w.url, who, 'publish_menu', { p_venue: A })).code, 'not_allowed');
  });

  test('the SQL validator and the contracts validator agree on broken menus', async () => {
    const cases = {
      nesting: (s) => { s.addonGroups[1].options[0].opensGroupId = ID.extras; },
      opensSelf: (s) => { s.addonGroups[2].options[0].opensGroupId = ID.extras; s.addonGroups[2].options[0].maxQty = 1; },
      openerQty: (s) => { s.addonGroups[0].options[0].maxQty = 2; },
      minUnreachable: (s) => { s.sections[1].dishes[0].addons[1] = { groupId: ID.extras, min: 5, max: 5 }; },
      singleMax: (s) => { s.sections[1].dishes[0].addons[0].max = 2; },
      dupDish: (s) => { s.sections[3].dishes[1].id = ID.burger; },
      relatedSelf: (s) => { s.sections[1].dishes[0].related.push(ID.burger); },
      relatedUnknown: (s) => { s.sections[1].dishes[0].related.push('00000000-0000-4000-8000-00000000ffff'); },
      price: (s) => { s.sections[1].dishes[0].price.amount = 12.5; },
      tags: (s) => { s.sections[1].dishes[0].tags = ['vegan', 'halal']; },
      asset: (s) => { s.sections[1].dishes[0].asset = { state: 'photo', color: '../../x', thumb: 't.jpg' }; },
      defaults: (s) => { s.addonGroups[3].options[1].default = true; },
      limits: (s) => { s.addonGroups[2].min = 4; },
      ruleGroup: (s) => { s.upsellRules[1].suggest.groupId = ID.side; },
      ruleCheckoutOption: (s) => { s.upsellRules[1].trigger = 'checkout'; },
      ruleScope: (s) => { s.upsellRules[0].scope = { kind: 'dish', ids: [] }; },
      priority: (s) => { s.upsellRules[0].priority = 101; },
      cap: (s) => { s.upsellRules[0].cap = 0; },
      window: (s) => { s.schedules[0].windows[0].from = '24:00'; },
      when: (s) => { s.upsellRules[0].when = { days: [], from: '07:00', to: null }; },
      locale: (s) => { s.locale.default = 'fr'; },
      tz: (s) => { s.venue.timeZone = 'Mars/Olympus'; },
      kind: (s) => { s.venue.kind = 'nightclub'; },
      slug: (s) => { s.slug = 'Bad Slug'; },
      version: (s) => { s.v = 1; },
    };
    for (const [name, breakIt] of Object.entries(cases)) {
      const s = mutable(cafeDemo());
      breakIt(s);
      const ts = validateSnapshotV2(s);
      const sql = (await w.admin.query('select app.validate_snapshot($1::jsonb) as e', [JSON.stringify(s)])).rows[0].e;
      const a = ts.ok ? [] : ts.errors.map((e) => `${e.code}@${e.path}`).sort();
      const b = sql.map((e) => `${e.code}@${e.path}`).sort();
      assert.ok(a.length > 0, `${name}: the contracts validator accepts it`);
      assert.deepEqual(b, a, name);
    }
    assert.deepEqual((await w.admin.query('select app.validate_snapshot($1::jsonb) as e', [JSON.stringify(cafeDemo())])).rows[0].e, []);
  });
});

describe('add-ons: one nesting level, enforced by the database', () => {
  const opt = (venue, group, name, opens = null) =>
    `insert into public.addon_options (venue_id, group_id, name_en, opens_group_id) values ('${venue}', '${group}', '${name}', ${opens ? `'${opens}'` : 'null'})`;

  test('an option in the nested group (sauce) cannot open another group', async () => {
    const r = await q(w.url, U.ownerA, opt(A, ID.sauce, 'Sauce that opens extras', ID.extras));
    assert.match(r.error?.message ?? '', /nesting_too_deep/);
    const r2 = await q(w.url, U.ownerA, `update public.addon_options set opens_group_id = $1 where id = $2`, [ID.extras, ID.ketchup]);
    assert.match(r2.error?.message ?? '', /nesting_too_deep/);
  });

  test('a group that opens another cannot itself be opened', async () => {
    // milk → side would make side (which opens sauce) a second level
    const r = await q(w.url, U.ownerA, `update public.addon_options set opens_group_id = $1 where id = $2`, [ID.side, ID.oat]);
    assert.match(r.error?.message ?? '', /nesting_too_deep/);
  });

  test('an option cannot open its own group, and an opener has quantity 1', async () => {
    assert.equal((await q(w.url, U.ownerA, `update public.addon_options set opens_group_id = group_id where id = $1`, [ID.cheese])).error?.code, '23514');
    assert.equal((await q(w.url, U.ownerA, `update public.addon_options set max_qty = 2 where id = $1`, [ID.fries])).error?.code, '23514');
  });

  test('one level elsewhere is fine; the published snapshot still validates', async () => {
    const ok = await q(w.url, U.ownerA, `update public.addon_options set opens_group_id = $1 where id = $2 returning id`, [ID.bread, ID.oat]);
    assert.ok(!ok.error, ok.error?.message);
    const p = await rpc(w.url, U.ownerA, 'preview_menu', { p_venue: A });
    assert.deepEqual(p.issues, []);
    await q(w.url, U.ownerA, `update public.addon_options set opens_group_id = null where id = $1`, [ID.oat]);
  });

  test('two concurrent edits cannot build two levels between them', async () => {
    // T1: an extra (egg) opens the milk group; T2: a milk option (oat) opens the bread group. Each alone is one level;
    // together extras → milk → bread is two. The nesting guard serialises per venue, so the second sees the first.
    const { default: pg } = await import('pg');
    const c1 = new pg.Client({ connectionString: w.url });
    const c2 = new pg.Client({ connectionString: w.url });
    await c1.connect();
    await c2.connect();
    const t1 = (sql) => c1.query(sql, [ID.milk, ID.egg]);
    const t2 = () => c2.query(`update public.addon_options set opens_group_id = $1 where id = $2`, [ID.bread, ID.oat]).then(() => 'ok', (e) => e.message);
    try {
      // the first rolls back: the second goes through
      await c1.query('begin');
      await t1(`update public.addon_options set opens_group_id = $1 where id = $2`);
      await c2.query('begin');
      const second = t2();
      await new Promise((r) => setTimeout(r, 200));
      await c1.query('rollback');
      assert.equal(await second, 'ok');
      await c2.query('rollback');
      // the first commits: the second is refused, although it was valid when it started
      await c1.query('begin');
      await t1(`update public.addon_options set opens_group_id = $1 where id = $2`);
      await c2.query('begin');
      const third = t2();
      await new Promise((r) => setTimeout(r, 200));
      await c1.query('commit');
      assert.match(await third, /nesting_too_deep/);
      await c2.query('rollback');
    } finally {
      await w.admin.query(`update public.addon_options set opens_group_id = null where id = $1`, [ID.egg]);
      await c1.end();
      await c2.end();
    }
  });

  test('a single-choice group attached with max 2 is refused; limits are checked', async () => {
    const r = await q(w.url, U.ownerA, `update public.dish_addon_groups set max_units = 2 where dish_id = $1 and group_id = $2`, [ID.burger, ID.side]);
    assert.match(r.error?.message ?? '', /single_max/);
    const r2 = await q(w.url, U.ownerA, `update public.addon_groups set selection = 'single', max_units = 3 where id = $1`, [ID.extras]);
    assert.equal(r2.error?.code, '23514');
  });

  test('size limits per group come from app_config', async () => {
    await w.admin.query(`update public.app_config set value = jsonb_set(value, '{options_per_group}', '3') where key = 'limits'`);
    const r = await q(w.url, U.ownerA, opt(A, ID.extras, 'Fourth extra'));
    assert.match(r.error?.message ?? '', /limit_options_per_group/);
    await w.admin.query(`update public.app_config set value = jsonb_set(value, '{options_per_group}', $1::jsonb) where key = 'limits'`, [String(LIMITS.optionsPerGroup)]);
  });

  test('server-side pricing from the published snapshot: side → sauce', async () => {
    const s = (await snapshotOf('cafe-demo')).snapshot;
    const burger = s.sections[1].dishes[0];
    const r = priceDish(burger, { quantity: 2, groups: [{ groupId: ID.side, options: [{ optionId: ID.sweetFries, nested: [{ groupId: ID.sauce, options: [{ optionId: ID.chipotle }] }] }] }] }, pricingContext(s));
    assert.ok(r.ok);
    assert.equal(r.total, (6800 + 800 + 200) * 2);
  });
});

describe('availability and time agree with the contracts', () => {
  test('until-specs resolve in the database exactly as resolveUntil does (incl. closed days and DST)', async () => {
    await w.admin.query(`insert into public.venue_closures (venue_id, from_date, to_date) values ($1, '2026-10-18', '2026-10-18')`, [A]);
    const { rows: hrs } = await w.admin.query(`select weekday, to_char(opens, 'HH24:MI') as f, to_char(closes, 'HH24:MI') as t from public.venue_hours where venue_id = $1`, [A]);
    const hours = { timeZone: 'Asia/Jerusalem', weekly: hrs.map((h) => ({ days: [h.weekday], from: h.f, to: h.t })), closures: [{ from: '2026-10-18', to: '2026-10-18' }] };
    const specs = [
      { kind: 'duration', minutes: 120 }, { kind: 'time', at: '14:30' }, { kind: 'time', at: '06:00' }, { kind: 'next_opening' },
      { kind: 'date', date: '2026-10-20' }, { kind: 'indefinite' },
    ];
    const moments = [
      zonedTime('2026-10-15', '12:00', 'Asia/Jerusalem'), zonedTime('2026-10-17', '23:30', 'Asia/Jerusalem'),
      zonedTime('2026-10-18', '00:30', 'Asia/Jerusalem'), zonedTime('2026-10-24', '23:30', 'Asia/Jerusalem'),
      zonedTime('2026-03-27', '01:30', 'Asia/Jerusalem'), zonedTime('2026-10-16', '16:00', 'Asia/Jerusalem'),
    ];
    for (const at of moments) {
      for (const spec of specs) {
        const sql = (await w.admin.query(`select app.resolve_until($1, $2::jsonb, $3::timestamptz) as u`, [A, JSON.stringify(spec), new Date(at).toISOString()])).rows[0].u;
        const ts = resolveUntil(spec, at, hours);
        assert.equal(sql ? sql.toISOString() : null, ts ? ts.toISOString() : null, `${spec.kind} at ${new Date(at).toISOString()}`);
      }
      const open = (await w.admin.query(`select app.is_open_at($1, $2) as o, app.next_opening($1, $2) as n`, [A, new Date(at).toISOString()])).rows[0];
      assert.equal(open.o, isOpenAt(hours, at), `open at ${new Date(at).toISOString()}`);
      assert.equal(open.n?.toISOString() ?? null, nextOpening(hours, at)?.toISOString() ?? null);
    }
    await w.admin.query(`delete from public.venue_closures where venue_id = $1`, [A]);
  });

  test('the live overlay: off now in public_menu without a publish, restored by the clock, exhausted required choices', async () => {
    await as(w.url, U.ownerA, async (c) => {
      for (const id of [ID.sourdough, ID.challah]) {
        await c.query(`insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec) values ($1, 'option', $2, 'duration', '{"kind":"duration","minutes":60}')`, [A, id]);
      }
      // already over: starts a minute ago, ends now + 1s (the guard clamps starts_at); then we wait it out
      await c.query(`insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec) values ($1, 'dish', $2, 'indefinite', '{"kind":"indefinite"}')`, [A, ID.lemonade]);
    });
    const r = await snapshotOf('cafe-demo');
    const off = r.live.off.map((o) => o.id).sort();
    assert.deepEqual(off, [ID.lemonade, ID.sourdough, ID.challah].sort());
    const av = menuAvailability(r.snapshot, r.live, Date.parse(r.live.at));
    assert.equal(av.dishes.get(ID.shakshuka).available, false);
    assert.ok(['choices', 'schedule', 'closed'].includes(av.dishes.get(ID.shakshuka).reason));
    const u = unavailableOf(av, true);
    assert.ok(u.dishes.has(ID.lemonade));
    // restore everything sold out (the one-click restore) and it is back at once
    assert.ok((await count(w.url, U.ownerA, `update public.availability_overrides set restored_at = now() where venue_id = $1 and restored_at is null`, [A])) >= 3);
    assert.deepEqual((await snapshotOf('cafe-demo')).live.off, []);
  });

  test('deleting a dish or section scrubs it from upsell rules; a rule left with no scope goes', async () => {
    const r = await as(w.url, U.ownerB, async (c) => {
      const d2 = (await c.query(`insert into public.dishes (venue_id, section_id, name_en, price) values ($1, $2, 'Bread', 900) returning id`, [w.B, w.b.section])).rows[0].id;
      const d3 = (await c.query(`insert into public.dishes (venue_id, section_id, name_en, price) values ($1, $2, 'Olives', 1500) returning id`, [w.B, w.b.section])).rows[0].id;
      const keep = (await c.query(`insert into public.upsell_rules (venue_id, trigger, scope_kind, scope_ids, basket_lacks_dishes, suggest_kind, suggest_dish_id)
        values ($1, 'add', 'dish', $2, $3, 'dish', $4) returning id`, [w.B, [w.b.dish, d2], [d2], d3])).rows[0].id;
      const gone = (await c.query(`insert into public.upsell_rules (venue_id, trigger, scope_kind, scope_ids, suggest_kind, suggest_dish_id)
        values ($1, 'add', 'dish', $2, 'dish', $3) returning id`, [w.B, [d2], d3])).rows[0].id;
      await c.query(`delete from public.dishes where id = $1`, [d2]);
      const rules = (await c.query(`select id, scope_ids, basket_lacks_dishes from public.upsell_rules where id in ($1, $2)`, [keep, gone])).rows;
      await c.query(`delete from public.dishes where id = $1`, [d3]);
      const after = (await c.query(`select count(*)::int as n from public.upsell_rules where id = $1`, [keep])).rows[0].n;
      return { keep, rules, after, d2 };
    });
    assert.deepEqual(r.rules, [{ id: r.keep, scope_ids: [w.b.dish], basket_lacks_dishes: [] }]);
    assert.equal(r.after, 0, 'deleting the suggested dish deletes the rule');
    assert.deepEqual((await rpc(w.url, U.ownerB, 'preview_menu', { p_venue: w.B })).issues, []);
  });

  test('an override in the past or for another venue\'s item is refused', async () => {
    const r = await q(w.url, U.ownerA, `insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec) values ($1, 'dish', $2, 'date', '{"kind":"date","date":"2020-01-01"}')`, [A, ID.burger]);
    assert.match(r.error?.message ?? '', /until_in_past|check/);
    const r2 = await q(w.url, U.ownerA, `insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec) values ($1, 'dish', $2, 'duration', '{"kind":"duration","minutes":0}')`, [A, ID.burger]);
    assert.match(r2.error?.message ?? '', /until_invalid/);
    const r3 = await q(w.url, U.ownerA, `insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec) values ($1, 'dish', $2, 'time', '{"kind":"duration","minutes":30}')`, [A, ID.burger]);
    assert.match(r3.error?.message ?? '', /until_invalid/, 'kind and spec must agree');
  });
});

describe('the contracts and the schema use the same words and columns', () => {
  const checkValues = async (table, column, values) => {
    const { rows } = await w.admin.query(`select pg_get_constraintdef(c.oid) as d from pg_constraint c join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace where n.nspname = 'public' and t.relname = $1 and c.contype = 'c'`, [table]);
    const defs = rows.map((r) => r.d).filter((d) => d.includes(`${column} `) || d.includes(`(${column} `) || d.includes(`${column})`) || d.includes(`(${column}`));
    const found = new Set();
    for (const d of defs) for (const m of d.matchAll(/'([a-z_]+)'::text/g)) found.add(m[1]);
    assert.deepEqual([...found].filter((x) => values.includes(x)).sort(), [...values].sort(), `${table}.${column}`);
  };
  test('closed lists', async () => {
    await checkValues('venues', 'kind', VENUE_KINDS);
    await checkValues('venues', 'mode', VENUE_MODES);
    await checkValues('venue_members', 'role', MEMBER_ROLES);
    await checkValues('staff', 'role', STAFF_ROLES);
    await checkValues('sections', 'kind', SECTION_KINDS);
    await checkValues('sections', 'scene', SCENES);
    await checkValues('sections', 'room', ROOMS);
    await checkValues('dishes', 'tags', TAGS);
    await checkValues('addon_groups', 'selection', SELECTIONS);
    await checkValues('upsell_rules', 'trigger', TRIGGERS);
    await checkValues('availability_overrides', 'target_kind', TARGET_KINDS);
    await checkValues('availability_overrides', 'until_kind', UNTIL_KINDS);
    await checkValues('assets', 'status', ASSET_STATUSES);
    await checkValues('onboarding_progress', 'step', ONBOARDING_STEPS);
    await checkValues('onboarding_progress', 'state', ONBOARDING_STATES);
    await checkValues('menu_imports', 'source', IMPORT_SOURCES);
    await checkValues('menu_imports', 'status', IMPORT_STATUSES);
    await checkValues('support_cases', 'status', CASE_STATUSES);
    await checkValues('support_cases', 'topic', CASE_TOPICS);
    await checkValues('entitlements', 'plan', PLANS);
    await checkValues('entitlements', 'status', ENTITLEMENT_STATUSES);
    const fn = (await w.admin.query(`select prosrc from pg_proc where proname = 'act_for_owner'`)).rows[0].prosrc;
    for (const a of ACT_FOR_OWNER_ACTIONS) assert.ok(fn.includes(`'${a}'`), a);
  });

  test('every table\'s columns equal the contracts\' row types', async () => {
    for (const [table, cols] of Object.entries(TABLE_COLUMNS)) {
      const { rows } = await w.admin.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = $1 order by ordinal_position`, [table]);
      assert.deepEqual(rows.map((r) => r.column_name).sort(), [...cols].sort(), table);
    }
  });
});
