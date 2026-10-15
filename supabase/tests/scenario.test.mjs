// The phase-1 chain on all three sides, on a fresh SYNTHETIC venue (the shape of the mock client's demo, none of its data):
// an owner signs up and names the venue; pastes a menu as text (the scanner, played here by the service role, parses
// it); builds a "side of choice" with a nested sauce; adds two upsell rules; sets breakfast and hours; publishes. A guest
// bot browses, chooses add-ons, accepts one suggestion and dismisses another. The owner takes a dish off for two hours.
// Halom sees the venue, its numbers and its activity, and acts for the owner once to restore the dish; the owner sees it.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { as, rpc } from './harness/cluster.mjs';
import { U, world } from './harness/world.mjs';
import {
  indexMenu, matchSuggestion, menuAvailability, newEventId, priceDish, pricingContext, unavailableOf, validateSnapshotV2, defaultSelection,
} from '../../packages/contracts/src/index.ts';

let w;
before(async () => { w = await world(); });
after(async () => { await w?.stop(); });

const OWNER = '22222222-2222-4222-8222-2222222222c1';
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

test('onboarding → menu with nested add-ons → publish → guest → owner quick action → Halom acts for the owner', async () => {
  await w.admin.query(`insert into auth.users (id, email, last_sign_in_at) values ($1, 'scenario-owner@example.invalid', now())`, [OWNER]);

  // 1. the owner names the venue
  const made = await rpc(w.url, OWNER, 'create_venue', { p_slug: 'corner-cafe', p_name_he: 'קפה הפינה', p_name_en: 'Corner Café', p_kind: 'cafe' });
  assert.equal(made.ok, true);
  const V = made.id;

  // 2. the menu arrives as pasted text; nothing is public until the owner applies it
  const imp = await as(w.url, OWNER, async (c) => (await c.query(`insert into public.menu_imports (venue_id, source, raw_text, input_sha256)
    values ($1, 'wolt_text', $2, encode(extensions.digest($2, 'sha256'), 'hex')) returning id`, [V, 'Toast 42\nFries side\nLemonade 14'])).rows[0].id);
  await as(w.url, 'service', (c) => c.query(`update public.menu_imports set status = 'parsing' where id = $1`, [imp]));
  await as(w.url, 'service', (c) => c.query(`update public.menu_imports set status = 'parsed',
    parsed = '{"sections":[{"name":{"he":"","en":"Food"},"dishes":[{"name":{"en":"Toast"},"price":4200}]},{"name":{"en":"Drinks"},"dishes":[{"name":{"en":"Lemonade"},"price":null}]}]}',
    exceptions = '[{"code":"price_missing","path":"sections[1].dishes[0]"}]' where id = $1`, [imp]));
  assert.deepEqual(await rpc(w.url, 'anon', 'public_menu', { p_slug: 'corner-cafe' }), { state: 'not_found' });

  // 3. the owner fixes the exception and applies the import (the client app inserts the rows), then builds add-ons
  const ids = await as(w.url, OWNER, async (c) => {
    const one = async (sql, p) => (await c.query(sql, p)).rows[0].id;
    const breakfast = await one(`insert into public.schedules (venue_id, kind, name_en, windows) values ($1, 'day_part', 'Breakfast', '[{"days":[0,1,2,3,4,5,6],"from":"00:00","to":"00:00"}]') returning id`, [V]);
    const food = await one(`insert into public.sections (venue_id, name_en, position, schedule_id) values ($1, 'Food', 0, $2) returning id`, [V, breakfast]);
    const drinks = await one(`insert into public.sections (venue_id, name_en, kind, position) values ($1, 'Drinks', 'drinks', 1) returning id`, [V]);
    const toast = await one(`insert into public.dishes (venue_id, section_id, name_en, price) values ($1, $2, 'Toast', 4200) returning id`, [V, food]);
    const lemonade = await one(`insert into public.dishes (venue_id, section_id, name_en, price) values ($1, $2, 'Lemonade', 1400) returning id`, [V, drinks]);
    const side = await one(`insert into public.addon_groups (venue_id, name_en, selection, min_units, max_units) values ($1, 'Side of choice', 'single', 1, 1) returning id`, [V]);
    const sauce = await one(`insert into public.addon_groups (venue_id, name_en, selection, min_units, max_units) values ($1, 'Sauce', 'single', 1, 1) returning id`, [V]);
    const mayo = await one(`insert into public.addon_options (venue_id, group_id, name_en, price, is_default) values ($1, $2, 'Mayo', 0, true) returning id`, [V, sauce]);
    const harissa = await one(`insert into public.addon_options (venue_id, group_id, name_en, price) values ($1, $2, 'Harissa', 300) returning id`, [V, sauce]);
    const fries = await one(`insert into public.addon_options (venue_id, group_id, name_en, price, opens_group_id, is_default) values ($1, $2, 'Fries', 0, $3, true) returning id`, [V, side, sauce]);
    const salad = await one(`insert into public.addon_options (venue_id, group_id, name_en, price) values ($1, $2, 'Salad', 500) returning id`, [V, side]);
    await c.query(`insert into public.dish_addon_groups (venue_id, dish_id, group_id) values ($1, $2, $3)`, [V, toast, side]);
    await c.query(`insert into public.dish_relations (venue_id, dish_id, related_dish_id) values ($1, $2, $3)`, [V, toast, lemonade]);
    const ruleA = await one(`insert into public.upsell_rules (venue_id, trigger, scope_kind, scope_ids, basket_lacks_sections, suggest_kind, suggest_dish_id, line_en, priority)
      values ($1, 'add', 'dish', $2, $3, 'dish', $4, 'A lemonade with that?', 60) returning id`, [V, [toast], [drinks], lemonade]);
    const ruleB = await one(`insert into public.upsell_rules (venue_id, trigger, scope_kind, scope_ids, suggest_kind, suggest_option_id, line_en, priority)
      values ($1, 'sheet', 'dish', $2, 'option', $3, 'Harissa?', 40) returning id`, [V, [toast], harissa]);
    for (let d = 0; d < 7; d++) await c.query(`insert into public.venue_hours (venue_id, weekday, opens, closes) values ($1, $2, '00:00', '00:00')`, [V, d]);
    await c.query(`update public.menu_imports set status = 'applied' where id = $1`, [imp]);
    for (const step of ['menu', 'review', 'addons', 'hours']) await c.query(`update public.onboarding_progress set state = 'done' where venue_id = $1 and step = $2`, [V, step]);
    return { food, drinks, toast, lemonade, side, sauce, mayo, harissa, fries, salad, ruleA, ruleB };
  });

  // 4. publish
  const pub = await rpc(w.url, OWNER, 'publish_menu', { p_venue: V, p_note: 'opening day' });
  assert.deepEqual(pub, { ok: true, revision: 1, slug: 'corner-cafe', path: '/m/corner-cafe' });

  // 5. a guest bot reads the menu, chooses, gets one suggestion, accepts one and dismisses another; events go in
  const menu = await rpc(w.url, 'anon', 'public_menu', { p_slug: 'corner-cafe' });
  assert.equal(menu.state, 'ok');
  assert.ok(validateSnapshotV2(menu.snapshot).ok);
  const s = menu.snapshot;
  const now = Date.parse(menu.live.at);
  const av = menuAvailability(s, menu.live, now);
  const unavailable = unavailableOf(av, true);
  const toast = s.sections[0].dishes[0];
  const ctx = pricingContext(s, unavailable);
  const sel = defaultSelection(toast, ctx);
  const sheet = matchSuggestion(s.upsellRules, { trigger: 'sheet', menu: indexMenu(s), dishId: toast.id, selection: sel, basket: [], now, unavailable });
  assert.equal(sheet, null, 'Harissa would replace the guest\'s own sauce choice in a single group: not suggested');
  const chosen = { quantity: 1, groups: [{ groupId: ids.side, options: [{ optionId: ids.fries, nested: [{ groupId: ids.sauce, options: [{ optionId: ids.harissa }] }] }] }] };
  const price = priceDish(toast, chosen, ctx);
  assert.ok(price.ok);
  assert.equal(price.total, 4200 + 300);
  const add = matchSuggestion(s.upsellRules, { trigger: 'add', menu: indexMenu(s), dishId: toast.id, selection: chosen, basket: [{ dishId: toast.id, selection: chosen }], now, unavailable });
  assert.equal(add.ruleId, ids.ruleA);
  const e = (name, props) => ({ id: newEventId(), name, venueId: V, at: iso(now - 500), props });
  const r = await as(w.url, 'anon', async (c) => (await c.query('select public.track_events($1::jsonb) as r', [JSON.stringify([
    e('menu_opened', { src: 'qr', lang: 'he', revision: 1 }),
    e('dish_viewed', { dishId: ids.toast }),
    e('addon_chosen', { dishId: ids.toast, groupId: ids.sauce, optionId: ids.harissa, parentOptionId: ids.fries }),
    e('basket_added', { dishId: ids.toast, qty: 1, fromSuggestion: false }),
    e('suggestion_shown', { ruleId: ids.ruleA, trigger: 'add', dishId: ids.toast }),
    e('suggestion_accepted', { ruleId: ids.ruleA, trigger: 'add', dishId: ids.toast }),
    e('basket_added', { dishId: ids.lemonade, qty: 1, fromSuggestion: true }),
    e('suggestion_shown', { ruleId: ids.ruleB, trigger: 'sheet', dishId: ids.toast }),
    e('suggestion_dismissed', { ruleId: ids.ruleB, trigger: 'sheet', dishId: ids.toast }),
  ])])).rows[0].r);
  assert.deepEqual(r, { ok: true, accepted: 9, duplicates: 0, capped: 0, rejected: [] });
  await w.admin.query('select app.build_rollups()');

  // 6. the owner takes the toast off for two hours from the phone; guests see it at once
  await as(w.url, OWNER, (c) => c.query(`insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec, note)
    values ($1, 'dish', $2, 'duration', '{"kind":"duration","minutes":120}', 'out of bread')`, [V, ids.toast]));
  const live = (await rpc(w.url, 'anon', 'public_menu', { p_slug: 'corner-cafe' })).live;
  assert.deepEqual(live.off.map((o) => o.id), [ids.toast]);
  assert.equal(menuAvailability(s, live, Date.parse(live.at)).dishes.get(ids.toast).reason, 'off');

  // 7. the client dashboard has the numbers and the off-now list
  const dash = await rpc(w.url, OWNER, 'my_dashboard', { p_venue: V, p_range: 'today' });
  assert.equal(dash.totals.menuOpens, 1);
  assert.equal(dash.totals.basketAdds, 2);
  assert.deepEqual(dash.rules.map((x) => [x.ruleId, x.shown, x.accepted, x.dismissed]), [[ids.ruleA, 1, 1, 0], [ids.ruleB, 1, 0, 1]]);
  assert.deepEqual(dash.offNow.map((o) => [o.id, o.by]), [[ids.toast, 'owner']]);

  // 8. Halom sees the venue: onboarding, last publish, live opens
  const ops = await rpc(w.url, U.support, 'ops_overview');
  const card = ops.venues.find((x) => x.id === V);
  assert.equal(card.menu.live, true);
  assert.equal(card.menu.revision, 1);
  assert.equal(card.opens.today, 1);
  assert.equal(card.onboarding.stage, 'photos');
  assert.deepEqual(card.suggestions7d, { shown: 2, accepted: 1 });

  // 9. Halom acts for the owner once to restore the dish
  const act = await rpc(w.url, U.support, 'act_for_owner', { p_venue: V, p_reason: 'Owner called: bread arrived', p_action: 'availability.restore', p_payload: { targetKind: 'dish', targetId: ids.toast } });
  assert.equal(act.ok, true);
  assert.deepEqual((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'corner-cafe' })).live.off, []);

  // 10. the owner sees it in the activity log, with the reason
  const log = await as(w.url, OWNER, async (c) => (await c.query(`select action, actor_kind, via, reason from public.activity_log where venue_id = $1 order by id`, [V])).rows);
  assert.deepEqual(log.filter((x) => x.via === 'act_for_owner').map((x) => [x.action, x.actor_kind, x.reason]), [
    ['availability_overrides.update', 'staff', 'Owner called: bread arrived'],
    ['support.act_for_owner', 'staff', 'Owner called: bread arrived'],
  ]);
  assert.ok(log.some((x) => x.action === 'menu.publish' && x.actor_kind === 'owner'));
  assert.ok(log.some((x) => x.action === 'venue.create'));
  assert.equal(log.filter((x) => x.via === 'act_for_owner' && x.actor_kind !== 'staff').length, 0);
});
