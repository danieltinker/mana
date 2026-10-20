// Hopa's acceptance tests that phase 0–1 can run (hopa-matrix: 2, 10, 11, 12), as simulator scenarios on synthetic
// venues. Each asserts the end state on the sides it touches: what the guest's phone shows, what the owner's dashboard
// and log show, what Halom can and cannot do.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { EVENT_PROPS } from '@mana/contracts';
import { ApiError, createUser, signIn } from '../src/client.mjs';
import { autoSelection, chosenOptions } from '../src/choices.mjs';
import { isoAt } from '../src/clock.mjs';
import { GuestBot } from '../src/guest.mjs';
import { OwnerBot } from '../src/owner.mjs';
import { runRandom } from '../src/random.mjs';
import { bistro, halomTeam } from '../src/scenarios.mjs';
import { liveVenue, useStack } from './helpers.mjs';

const S = useStack(async (stack) => {
  const team = await halomTeam(stack, 'hopa');
  const v = {};
  for (const slug of ['bistro-t2', 'bistro-t10', 'bistro-a', 'bistro-b', 'bistro-t12']) v[slug] = await liveVenue(stack, bistro(), slug, team);
  // a manager and a counter for venue A: no RPC hands those roles out yet (team invites are phase 2), so setup adds them
  const member = async (role) => {
    const email = `${role}.a@example.invalid`;
    await createUser(stack, { email, password: 'sim-owner-pass-1' });
    const bot = await OwnerBot.signInAs(stack, { email });
    await stack.addMember(v['bistro-a'].venueId, bot.userId, role);
    return bot.forVenue(v['bistro-a'].venueId, 'bistro-a');
  };
  return { team, v, manager: await member('manager'), counter: await member('counter') };
});
const guest = (ip, o = {}) => new GuestBot(S.stack, { ip, ...o });
const code = (c) => (e) => e instanceof ApiError && e.code === c;

describe('Hopa test 2: availability changes while a basket is open', () => {
  test('a dish sold out mid-basket shows as unavailable, priceDish refuses it, the basket says which line; restoring brings it back', async () => {
    const { owner, ids, slug } = S.ctx.v['bistro-t2'];
    const D = ids.dishes;
    const g = guest('10.2.0.1');
    await g.open(slug);
    g.view(D.burger);
    assert.equal(g.add().ok, true);
    g.view(D.toast);
    assert.equal(g.add().ok, true);

    const off = await owner.soldOut('dish', D.burger, { kind: 'duration', minutes: 120 }, 'grill down');
    assert.deepEqual(g.basketIssues(), [], 'the phone has not looked yet');
    await g.refresh();
    assert.deepEqual(g.live.off.map((o) => [o.kind, o.id]), [['dish', D.burger]]);
    const av = g.availability(D.burger);
    assert.equal(av.reason, 'off');
    assert.ok(Math.abs(av.back.getTime() - Date.parse(off.until_at)) < 1000, 'back when the two hours end');
    assert.deepEqual(g.basketIssues(), [{ index: 0, dishId: D.burger, error: { code: 'dish_unavailable', dishId: D.burger } }]);
    g.view(D.burger);
    const again = g.add();
    assert.deepEqual([again.ok, again.error.code], [false, 'dish_unavailable']);
    g.removeLine(0);
    assert.deepEqual(g.basketIssues(), [], 'fixable: the rest of the basket stands');
    assert.equal(g.basketTotal(), 4200);
    assert.deepEqual((await owner.dashboard()).offNow.map((o) => [o.kind, o.id, o.by]), [['dish', D.burger, 'owner']]);

    assert.equal((await owner.restore('dish', D.burger)).length, 1);
    await g.refresh();
    assert.deepEqual(g.live.off, []);
    assert.equal(g.availability(D.burger).available, true);
    g.view(D.burger);
    assert.equal(g.add().ok, true);
    assert.deepEqual((await owner.dashboard()).offNow, []);
  });

  test('an add-on sold out: the line with it is refused until the guest picks another; a required group with nothing left makes the dish unavailable', async () => {
    const { owner, ids, slug } = S.ctx.v['bistro-t2'];
    const { dishes: D, groups: G, options: O } = ids;
    const g = guest('10.2.0.2');
    await g.open(slug);
    g.view(D.burger); // the owner's defaults: fries, with aioli in the nested sauce group
    assert.equal(g.add().ok, true);
    await owner.soldOut('option', O.aioli, { kind: 'indefinite' });
    await g.refresh();
    assert.equal(g.av.options.get(O.aioli).reason, 'off');
    assert.equal(g.availability(D.burger).available, true, 'other sauces are left');
    assert.deepEqual(g.basketIssues().map((i) => [i.dishId, i.error.code, i.error.optionId]), [[D.burger, 'option_unavailable', O.aioli]]);
    g.removeLine(0);
    g.view(D.burger);
    g.choose(G.sauce, O.ketchup, { parentOptionId: O.fries });
    assert.equal(g.add().ok, true);
    assert.deepEqual(g.basketIssues(), []);

    // every sauce off: neither opener can be completed, the salad still can
    await owner.soldOut('option', O.ketchup, { kind: 'indefinite' });
    await owner.soldOut('option', O.harissa, { kind: 'indefinite' });
    await g.refresh();
    assert.equal(g.availability(D.burger).available, true);
    assert.deepEqual(chosenOptions(autoSelection(g.dish(D.burger), g.ctx)).map((c) => c.optionId), [O.salad]);
    // and with the salad off too, the required side has nothing left
    await owner.soldOut('option', O.salad, { kind: 'indefinite' });
    await g.refresh();
    assert.equal(g.availability(D.burger).reason, 'choices');
    assert.equal(g.availability(D.toast).reason, 'choices');
    assert.equal(g.price(D.burger, { quantity: 1, groups: [] }).error.code, 'dish_unavailable');
    assert.equal(g.availability(D.espresso).available, true, 'the rest of the menu is untouched');

    for (const o of [O.aioli, O.ketchup, O.harissa, O.salad]) assert.equal((await owner.restore('option', o)).length, 1);
    await g.refresh();
    assert.deepEqual(g.live.off, []);
    assert.equal(g.availability(D.burger).available, true);
  });

  test('a whole section off for 30 minutes covers its dishes; restoring the section brings them back', async () => {
    const { owner, ids, slug } = S.ctx.v['bistro-t2'];
    const g = guest('10.2.0.3');
    await g.open(slug);
    await owner.soldOut('section', ids.sections.drinks, { kind: 'duration', minutes: 30 });
    await g.refresh();
    assert.equal(g.av.sections.get(ids.sections.drinks).reason, 'off');
    assert.deepEqual([g.availability(ids.dishes.espresso).reason, g.availability(ids.dishes.lemonade).reason], ['off', 'off']);
    assert.equal(g.availability(ids.dishes.burger).available, true);
    await owner.restore('section', ids.sections.drinks);
    await g.refresh();
    assert.equal(g.availability(ids.dishes.espresso).available, true);
  });
});

describe('Hopa test 10: a suggestion is never in the basket, sold out or filtered out; dismissing keeps the choices', () => {
  const ctx = () => S.ctx.v['bistro-t10'];

  test('never something already in the basket', async () => {
    const { ids, slug } = ctx();
    const D = ids.dishes, R = ids.rules;
    const control = guest('10.10.0.1');
    await control.open(slug);
    control.view(D.espresso);
    assert.equal(control.add().suggestion.suggest.dishId, D.croissant, 'control: after a coffee, the croissant');

    const g = guest('10.10.0.2');
    await g.open(slug);
    g.view(D.croissant);
    assert.equal(g.add().suggestion.ruleId, R['any-lemonade'], 'the guest ignores it');
    g.view(D.espresso);
    const r = g.add();
    assert.equal(r.suggestion, null, 'the croissant is in the basket and the lemonade rule has had its one showing');
    assert.deepEqual(g.violations, []);
  });

  test('never something sold out: the next rule speaks instead', async () => {
    const { owner, ids, slug } = ctx();
    const D = ids.dishes;
    await owner.soldOut('dish', D.croissant, { kind: 'duration', minutes: 60 });
    const g = guest('10.10.0.3');
    await g.open(slug);
    g.view(D.espresso);
    const r = g.add();
    assert.deepEqual([r.suggestion.ruleId, r.suggestion.suggest.dishId], [ids.rules['any-lemonade'], D.lemonade]);
    assert.deepEqual(g.violations, []);
    await owner.restore('dish', D.croissant);
  });

  test('never something the guest filtered out', async () => {
    const { ids, slug } = ctx();
    const D = ids.dishes;
    const g = guest('10.10.0.4', { filter: 'vegan' });
    await g.open(slug);
    assert.ok(!g.browsable().some((d) => d.id === D.croissant), 'the croissant is vegetarian, not vegan');
    g.view(D.espresso);
    const r = g.add();
    assert.equal(r.suggestion.suggest.dishId, D.lemonade);
    assert.deepEqual(g.violations, []);
  });

  test('an add-on: never one already chosen or sold out', async () => {
    const { owner, ids, slug } = ctx();
    const { dishes: D, groups: G, options: O } = ids;
    const control = guest('10.10.0.5');
    await control.open(slug);
    assert.equal(control.view(D.burger).suggest.optionId, O.cheese, 'control: the sheet suggests cheese');

    const g = guest('10.10.0.6');
    await g.open(slug);
    const withCheese = { quantity: 1, groups: [{ groupId: G.side, options: [{ optionId: O.salad }] }, { groupId: G.extras, options: [{ optionId: O.cheese }] }] };
    assert.equal(g.view(D.burger, { selection: withCheese }), null);

    await owner.soldOut('option', O.cheese, { kind: 'duration', minutes: 15 });
    const h = guest('10.10.0.7');
    await h.open(slug);
    assert.equal(h.view(D.burger), null);
    await owner.restore('option', O.cheese);
  });

  test('dismissing keeps every choice and the price; the rule stays quiet for the rest of the visit', async () => {
    const { ids, slug } = ctx();
    const { dishes: D, groups: G, options: O, rules: R } = ids;
    const g = guest('10.10.0.8');
    await g.open(slug);
    const mine = { quantity: 1, groups: [
      { groupId: G.side, options: [{ optionId: O['sweet-potato'], nested: [{ groupId: G.sauce, options: [{ optionId: O.harissa }] }] }] },
      { groupId: G.extras, options: [{ optionId: O.egg }] },
    ] };
    const kept = structuredClone(mine);
    assert.equal(g.view(D.burger, { selection: mine }).suggest.optionId, O.cheese);
    const price = g.price().total;
    assert.equal(price, 6800 + 800 + 300 + 500);
    g.dismiss();
    assert.deepEqual(g.sheet.selection, kept);
    assert.equal(g.price().total, price);
    const added = g.add();
    assert.deepEqual([g.basket[0].selection, g.basket[0].total], [kept, price]);
    assert.notEqual(added.suggestion?.ruleId, R['burger-cheese']);
    assert.equal(g.view(D.burger), null, 'dismissed: not shown again in this visit, although its cap is 2');
  });

  test('a suggestion is never pre-selected; accepting adds exactly it, and nothing follows an accepted suggestion', async () => {
    const { ids, slug } = ctx();
    const { dishes: D, options: O, rules: R } = ids;
    const g = guest('10.10.0.9');
    await g.open(slug);
    g.view(D.burger);
    const before = chosenOptions(g.sheet.selection).map((c) => c.optionId);
    assert.ok(!before.includes(O.cheese), 'shown, not chosen');
    assert.deepEqual(g.basket, []);
    g.accept();
    assert.deepEqual(chosenOptions(g.sheet.selection).map((c) => c.optionId), [...before, O.cheese]);
    assert.equal(g.price().total, 6800 + 400);

    const control = guest('10.10.0.10');
    await control.open(slug);
    control.view(D.croissant);
    assert.equal(control.add().suggestion.ruleId, R['any-lemonade'], 'control: a croissant added by hand gets the lemonade');
    const h = guest('10.10.0.11');
    await h.open(slug);
    h.view(D.espresso);
    assert.equal(h.add().suggestion.suggest.dishId, D.croissant);
    const acc = h.accept();
    assert.deepEqual([acc.ok, acc.suggestion], [true, null], 'the accepted croissant brings no lemonade: never chained');
    const sent = h.queue.filter((e) => e.name === 'basket_added').map((e) => [e.props.dishId, e.props.fromSuggestion]);
    assert.deepEqual(sent, [[D.espresso, false], [D.croissant, true]]);
  });

  test('a random crowd with sold-out items and filters: no suggestion ever breaks the rule', async () => {
    const { owner, ids, slug } = ctx();
    await owner.soldOut('dish', ids.dishes.croissant, { kind: 'duration', minutes: 30 });
    await owner.soldOut('option', ids.options.egg, { kind: 'duration', minutes: 30 });
    const r = await runRandom(S.stack, { slug, guests: 30, minutes: 10, seed: 10, pFilter: 0.4, pAccept: 0.4 });
    assert.deepEqual(r.violations, []);
    assert.deepEqual([r.results.rejected, r.results.capped, r.results.duplicates], [0, 0, 0]);
    assert.ok(r.ledger.n('suggestion_shown') >= 5, 'suggestions were shown (the check is not empty)');
    for (const b of r.bots) for (const l of b.basket) assert.notEqual(l.dishId, ids.dishes.croissant, 'nobody ordered the sold-out croissant');
    await owner.restore('dish', ids.dishes.croissant);
    await owner.restore('option', ids.options.egg);
  });
});

describe('Hopa test 11: roles and data', () => {
  const A = () => S.ctx.v['bistro-a'];
  const B = () => S.ctx.v['bistro-b'];

  test('another venue\'s owner reads nothing of venue A and changes nothing', async () => {
    const a = A(), ob = B().owner;
    for (const t of ['sections', 'dishes', 'addon_groups', 'addon_options', 'dish_addon_groups', 'dish_relations', 'upsell_rules', 'schedules', 'venue_hours',
      'availability_overrides', 'activity_log', 'rollups_day', 'rollups_minute', 'menu_revisions', 'onboarding_progress', 'venue_members', 'entitlements']) {
      assert.deepEqual(await ob.api.select(t, { select: 'venue_id', venue_id: `eq.${a.venueId}` }), [], t);
    }
    assert.deepEqual(await ob.api.select('venues', { select: 'id', id: `eq.${a.venueId}` }), []);
    await assert.rejects(ob.api.rpc('my_dashboard', { p_venue: a.venueId, p_range: 'today' }), code('42501'));
    await assert.rejects(ob.api.rpc('preview_menu', { p_venue: a.venueId }), code('42501'));
    assert.deepEqual(await ob.api.rpc('publish_menu', { p_venue: a.venueId, p_note: null }), { ok: false, code: 'not_allowed' });
    assert.deepEqual(await ob.api.update('dishes', { id: `eq.${a.ids.dishes.burger}` }, { price: 1 }), []);
    await assert.rejects(ob.api.insert('sections', [{ venue_id: a.venueId, name_en: 'Mine now' }]), code('42501'));
    await assert.rejects(ob.api.insert('availability_overrides', [{ venue_id: a.venueId, target_kind: 'dish', target_id: a.ids.dishes.burger, until_kind: 'indefinite', until_spec: { kind: 'indefinite' } }]), code('42501'));
    const burger = await a.owner.api.select('dishes', { select: 'price', id: `eq.${a.ids.dishes.burger}` });
    assert.deepEqual(burger, [{ price: 6800 }], 'venue A\'s owner still sees the price untouched');
  });

  test('the counter reads the menu, takes a dish off and back, and cannot change a price, publish, or see the records', async () => {
    const a = A(), c = S.ctx.counter;
    assert.ok((await c.api.select('dishes', { select: 'id', venue_id: `eq.${a.venueId}` })).length >= 6);
    assert.deepEqual(await c.updateDish(a.ids.dishes.burger, { price: 100 }), []);
    assert.deepEqual(await c.api.update('addon_options', { id: `eq.${a.ids.options.cheese}` }, { price: 1 }), []);
    await assert.rejects(c.api.insert('dishes', [{ venue_id: a.venueId, section_id: a.ids.sections.mains, name_en: 'Free lunch', price: 0 }]), code('42501'));
    assert.deepEqual(await c.publish('counter tries'), { ok: false, code: 'not_allowed' });
    await assert.rejects(c.dashboard(), code('42501'));
    assert.deepEqual(await c.activity(), []);
    const off = await c.soldOut('dish', a.ids.dishes.toast, { kind: 'duration', minutes: 60 });
    assert.equal(off.created_by_kind, 'counter');
    assert.equal((await c.restore('dish', a.ids.dishes.toast)).length, 1);
    // and nothing of venue B
    assert.deepEqual(await c.api.select('dishes', { select: 'id', venue_id: `eq.${B().venueId}` }), []);
    await assert.rejects(c.api.insert('availability_overrides', [{ venue_id: B().venueId, target_kind: 'dish', target_id: B().ids.dishes.toast, until_kind: 'indefinite', until_spec: { kind: 'indefinite' } }]), code('42501'));
    assert.deepEqual((await a.owner.api.select('dishes', { select: 'price', id: `eq.${a.ids.dishes.burger}` }))[0], { price: 6800 });
    assert.ok((await a.owner.activity()).some((x) => x.action === 'availability_overrides.insert' && x.actor_kind === 'counter'), 'the owner sees what the counter did');
  });

  test('Halom support reads across venues, writes into one only through act_for_owner with a reason, and the owner sees it', async () => {
    const a = A(), sup = S.ctx.team.support;
    assert.ok((await sup.api.select('dishes', { select: 'id', venue_id: `eq.${a.venueId}` })).length >= 6, 'support reads');
    assert.deepEqual(await sup.api.update('dishes', { id: `eq.${a.ids.dishes.burger}` }, { price: 1 }), [], 'no direct write');
    await assert.rejects(sup.api.insert('availability_overrides', [{ venue_id: a.venueId, target_kind: 'dish', target_id: a.ids.dishes.burger, until_kind: 'indefinite', until_spec: { kind: 'indefinite' } }]), code('42501'));
    assert.deepEqual(await sup.actForOwner(a.venueId, '', 'dish.update', { dishId: a.ids.dishes.burger, patch: { price: 7000 } }), { ok: false, code: 'reason_required' });
    assert.deepEqual(await sup.actForOwner(a.venueId, 'ok', 'dish.update', { dishId: a.ids.dishes.burger, patch: { price: 7000 } }), { ok: false, code: 'reason_required' });
    const reason = 'Owner asked by phone to change the burger price';
    const r = await sup.updateDish(a.venueId, reason, a.ids.dishes.burger, { price: 7000 });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual((await a.owner.api.select('dishes', { select: 'price', id: `eq.${a.ids.dishes.burger}` }))[0], { price: 7000 });
    const log = (await a.owner.activity()).filter((x) => x.via === 'act_for_owner');
    assert.deepEqual(log.map((x) => [x.action, x.actor_kind, x.reason]), [['support.act_for_owner', 'staff', reason], ['dishes.update', 'staff', reason]]);
    assert.deepEqual(log[0].detail.patchKeys, ['price']);
    assert.deepEqual(log[1].detail.changes.price, [6800, 7000]);
    assert.ok((await a.owner.dashboard()).activity.some((x) => x.action === 'support.act_for_owner' && x.reason === reason));

    // the owner's switch: off, and Halom cannot act; a manager cannot flip it; on again
    await assert.rejects(S.ctx.manager.updateVenue({ support_can_act: false }), code('42501'));
    await a.owner.updateVenue({ support_can_act: false });
    assert.deepEqual(await sup.actForOwner(a.venueId, reason, 'dish.update', { dishId: a.ids.dishes.burger, patch: { price: 6800 } }), { ok: false, code: 'owner_declined' });
    await a.owner.updateVenue({ support_can_act: true });
    assert.equal((await sup.updateDish(a.venueId, 'Back to the menu price, as the owner asked', a.ids.dishes.burger, { price: 6800 })).ok, true);
  });

  test('staff functions stay with staff: an owner cannot use them, support cannot invite', async () => {
    const a = A();
    await assert.rejects(a.owner.api.rpc('ops_overview', {}), code('42501'));
    await assert.rejects(a.owner.api.rpc('act_for_owner', { p_venue: a.venueId, p_reason: 'I am staff now', p_action: 'dish.update', p_payload: {} }), code('42501'));
    await assert.rejects(a.owner.api.rpc('ops_leads', {}), code('42501'));
    await assert.rejects(S.ctx.team.support.invite('friend@example.invalid'), code('42501'));
    // (refunds are phase 2: the counter role gains order actions there, never refunds)
  });
});

describe('Hopa test 12: measurement without personal data; no consent inferred', () => {
  const V = () => S.ctx.v['bistro-t12'];

  test('track_events refuses personal fields, at the top and in props, and stores nothing of those events', async () => {
    const { venueId, ids } = V();
    const D = ids.dishes;
    const e = (name, props, extra = {}) => ({ id: randomUUID(), name, venueId, at: isoAt(Date.now()), props, ...extra });
    const batch = [
      e('menu_opened', { src: 'qr', lang: 'he', revision: 1 }, { phone: '0000000000' }),
      e('dish_viewed', { dishId: D.burger, email: 'someone@example.invalid' }),
      e('basket_added', { dishId: D.burger, qty: 1, fromSuggestion: false, note: 'no onions' }),
      e('dish_viewed', { dishId: D.toast, userAgent: 'Mozilla/5.0' }),
      e('dish_viewed', { dishId: D.toast }, { sessionId: 'abc123' }),
      e('dish_viewed', { dishId: D.toast, visitorId: 'v-1' }),
      e('dish_viewed', { dishId: D.cookie }),
    ];
    const g = guest('10.12.0.9');
    const r = await g.api.rpc('track_events', { p_events: batch });
    assert.deepEqual(r.rejected, [0, 1, 2, 3, 4, 5].map((index) => ({ index, code: 'personal_field' })));
    assert.equal(r.accepted, 1);
    const stored = await S.stack.sql('select count(*)::int as n from public.events where id = any($1::uuid[])', [batch.slice(0, 6).map((x) => x.id)]);
    assert.equal(stored[0].n, 0);
  });

  test('stored events hold the contract only: no address, no person, no device, no visit id', async () => {
    const { venueId, ids, slug } = V();
    const ips = ['10.12.0.1', '10.12.0.1', '10.12.0.2']; // two visits from one phone, one from another
    const bots = [];
    for (const ip of ips) {
      const g = guest(ip, { lang: 'en', src: 'link' });
      await g.open(slug);
      g.view(ids.dishes.burger);
      g.accept();
      g.add();
      await g.flush();
      bots.push(g);
    }
    const cols = await S.stack.sql(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'events' order by ordinal_position`);
    assert.deepEqual(cols.map((x) => x.column_name), ['id', 'venue_id', 'name', 'at', 'received_at', 'source', 'demo', 'props']);
    const rows = await S.stack.sql(`select id, name, props from public.events where venue_id = $1 and source = 'guest'`, [venueId]);
    assert.ok(rows.length >= 15);
    const menuIds = new Set([...Object.values(ids.dishes), ...Object.values(ids.groups), ...Object.values(ids.options), ...Object.values(ids.rules)]);
    for (const row of rows) {
      assert.deepEqual(Object.keys(row.props).sort(), Object.keys(EVENT_PROPS[row.name]).sort(), row.name);
      for (const v of Object.values(row.props)) if (typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v)) assert.ok(menuIds.has(v), 'every id in an event is a menu id');
    }
    assert.equal(new Set(rows.map((x) => x.id)).size, rows.length, 'event ids are unique, nothing ties two visits together');
    for (const t of ['public.events', 'public.rollups_day', 'public.rollups_minute', 'public.activity_log', 'app.event_counters', 'app.rollup_queue', 'app.event_ids']) {
      const hit = await S.stack.sql(`select count(*)::int as n from ${t} x where row_to_json(x)::text like '%10.12.0.%'`);
      assert.equal(hit[0].n, 0, `no guest address in ${t}`);
    }
    for (const b of bots) assert.equal(b.api.lastHeaders.get('set-cookie'), null, 'no cookie');
  });

  test('no consent and no person are inferred from what a guest orders or accepts', async () => {
    const { slug, ids } = V();
    const count = async () => (await S.stack.sql(`select (select count(*) from auth.users)::int as users, (select count(*) from public.leads)::int as leads,
      (select count(*) from public.venue_members)::int as members`))[0];
    const before = await count();
    const leadsBefore = (await S.ctx.team.support.leads({ status: 'all' })).count;
    const r = await runRandom(S.stack, { slug, guests: 12, minutes: 5, seed: 12, pAccept: 0.8, pAdd: 0.9 });
    assert.ok(r.ledger.n('basket_added') > 5 && r.ledger.n('suggestion_accepted') > 0);
    const g = guest('10.12.0.3');
    await g.open(slug);
    g.view(ids.dishes.espresso);
    g.add();
    g.accept();
    await g.flush();
    assert.deepEqual(await count(), before, 'no account, no lead, no membership came from guests');
    assert.equal((await S.ctx.team.support.leads({ status: 'all' })).count, leadsBefore);
  });
});
