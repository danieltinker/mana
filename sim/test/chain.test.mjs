// The phase-0 chain, end state on all three sides (feature map F02): the owner builds and publishes; Halom's support
// approves; guests browse, choose, accept and dismiss suggestions; after app.build_rollups() the owner's my_dashboard
// and staff's ops_overview show exactly the counts the guests generated, and the guest's public_menu is what the owner
// published. Then the owner's two-hour sold-out and Halom's logged restore, and Mana's own leads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSnapshotV2 } from '@mana/contracts';
import { ApiError } from '../src/client.mjs';
import { bistro, phase0Chain } from '../src/scenarios.mjs';
import { guestRollups, snapshotVsSeed, useStack } from './helpers.mjs';

const seed = bistro();
let c, R, D;
useStack(async (stack) => {
  c = await phase0Chain(stack, { slug: 'bistro-chain', seed });
  R = c.ids.rules;
  D = c.ids.dishes;
});

test('owner: the first publish is revision 1 and waits for Halom; guests see "unavailable" until Halom approves', () => {
  assert.deepEqual(c.published, { ok: true, revision: 1, slug: 'bistro-chain', path: '/m/bistro-chain', review: 'pending', warnings: [] });
  assert.deepEqual(c.before.menu, { state: 'unavailable', venue: { name: seed.venue.name } });
  assert.equal(c.before.card.review, 'pending');
  assert.ok(c.before.card.warnings.includes('awaiting_review'));
  assert.equal(c.approved.ok, true);
});

test('guest: public_menu is exactly the revision the owner published, and that revision is the menu the owner built', () => {
  const g = c.views.guest;
  assert.equal(g.state, 'ok');
  assert.ok(validateSnapshotV2(g.snapshot).ok, 'the snapshot validates against the contracts');
  assert.deepEqual(g.snapshot, c.views.revision.snapshot);
  assert.equal(g.snapshot.revision, 1);
  assert.deepEqual(snapshotVsSeed(g.snapshot, seed, c.ids), []);
  // the nested level reached the guest: the fries open the sauce group
  const side = g.snapshot.addonGroups.find((x) => x.id === c.ids.groups.side);
  assert.equal(side.options.find((o) => o.id === c.ids.options.fries).opensGroupId, c.ids.groups.sauce);
  assert.equal(g.live.open, true);
});

test('guests: the scripted choices are priced by the contracts and get exactly the scripted suggestions', () => {
  assert.deepEqual(c.guests.log, [
    ['A', 'sheet', R['burger-cheese']],
    ['A', 'add', true, 6800 + 800 + 300 + 400, R['any-lemonade']],   // burger + sweet potato + harissa (nested) + the accepted cheese
    ['A', 'checkout', R['main-drink']],
    ['A', 'accept lemonade', true, null],                             // accepted: added, and nothing follows (never chained)
    ['B', 'add espresso', 1200 + 400, R['coffee-croissant']],
    ['B', 'accept croissant', true, null],
    ['B', 'add toast', 4200, R['any-lemonade']],
    ['C', 'add cookie', 900, R['any-lemonade']],
  ]);
  for (const g of c.guests.guests) {
    assert.deepEqual(g.results.rejected, [], 'every event valid');
    assert.equal(g.results.duplicates + g.results.capped, 0);
    assert.deepEqual(g.violations, [], 'no suggestion broke test 10');
  }
  assert.deepEqual(c.guests.guests.map((g) => g.basket.map((l) => l.dishId)), [[D.burger, D.lemonade], [D.espresso, D.croissant, D.toast], [D.cookie]]);
});

test('owner: my_dashboard shows exactly what the guests did', () => {
  const L = c.guests.ledger;
  const d = c.views.dashboard;
  assert.deepEqual(L.totals(), { menuOpens: 3, dishViews: 4, addonsChosen: 4, basketAdds: 6, suggestionsShown: 6, suggestionsAccepted: 3, suggestionsDismissed: 2 });
  assert.deepEqual(d.totals, L.totals());
  assert.deepEqual(d.opensBy, L.opensBy());
  assert.deepEqual(d.opensBy, { qr: 1, link: 2, he: 2, en: 1 });
  assert.deepEqual(Object.fromEntries(d.rules.map((r) => [r.ruleId, [r.shown, r.accepted, r.dismissed]])), {
    [R['coffee-croissant']]: [1, 1, 0], [R['burger-cheese']]: [1, 1, 0], [R['main-drink']]: [1, 1, 0], [R['any-lemonade']]: [3, 0, 2],
  });
  for (const t of d.topDishes) assert.deepEqual({ views: t.views, adds: t.adds }, L.dish(t.dishId), t.name.en);
  assert.equal(d.topDishes.length, 6);
  assert.equal(d.days.reduce((s, x) => s + x.opens, 0), 3);
  assert.equal(d.demo, true, 'a simulator venue is a demo venue');
  assert.deepEqual(d.capped, []);
  // "today": the same numbers, unless the run crossed the venue's midnight
  const sameDay = c.guests.guests.every((g) => g.sent.every((e) => e.at.slice(0, 10) === c.views.today.to));
  if (sameDay) assert.deepEqual(c.views.today.totals, L.totals());
});

test('owner: the rollups hold exactly the guests\' events, key by key', async () => {
  assert.deepEqual(await guestRollups(c.owner), c.guests.ledger.rows());
});

test('Halom: ops_overview shows the same numbers, the review, the onboarding stage; demo traffic stays out of real totals', async () => {
  const card = c.views.card;
  assert.deepEqual(card.opens, { today: card.opens.today, last7d: 3, lastHour: 3 });
  assert.deepEqual(card.suggestions7d, { shown: 6, accepted: 3, dismissed: 2 });
  assert.equal(card.review, 'approved');
  assert.deepEqual([card.menu.live, card.menu.revision], [true, 1]);
  assert.equal(card.isDemo, true);
  assert.equal(card.onboarding.stage, 'photos', 'venue, menu, review, addons, hours and publish are done; photos is next');
  assert.equal(card.plan.state, 'trialing');
  assert.deepEqual(c.views.staffDashboard.totals, c.views.dashboard.totals, 'staff and owner read the same truth');
  const all = await c.team.support.overview();
  assert.deepEqual([all.totals.venues, all.totals.demoVenues, all.totals.opensToday], [0, 1, 0], 'the demo venue is counted apart');
});

test('owner quick action: sold out for two hours, unavailable at once; Halom restores it for the owner, who sees why', async () => {
  assert.equal(c.off.target_kind, 'dish');
  assert.equal(c.off.created_by_kind, 'owner');
  // two hours, ending on the whole minute at or after (the moment the guest's phone shows is the moment it comes back)
  const span = Date.parse(c.off.until_at) - Date.parse(c.off.starts_at);
  assert.ok(span >= 120 * 60000 && span < 121 * 60000, String(span));
  assert.equal(Date.parse(c.off.until_at) % 60000, 0);
  assert.deepEqual(c.whileOff.live.off.map((o) => [o.kind, o.id]), [['dish', D.toast]]);
  assert.equal(c.whileOff.toast.reason, 'off');
  assert.equal(c.whileOff.toast.back.getTime(), Date.parse(c.whileOff.live.off[0].until), 'back when the override ends');
  assert.ok(Math.abs(c.whileOff.toast.back.getTime() - Date.parse(c.off.until_at)) < 1000);
  assert.equal(c.whileOff.price.error.code, 'dish_unavailable');
  assert.deepEqual([c.act.ok, c.act.action, c.act.result], [true, 'availability.restore', { restored: 1 }]);
  assert.deepEqual(c.afterRestore.live.off, []);
  assert.equal(c.afterRestore.toast.available, true);

  const reason = 'Owner called: the bread arrived';
  const mine = c.views.activity.filter((a) => a.via === 'act_for_owner');
  assert.deepEqual(mine.map((a) => [a.action, a.actor_kind, a.reason]), [['support.act_for_owner', 'staff', reason], ['availability_overrides.update', 'staff', reason]]);
  assert.equal(mine[0].detail.action, 'availability.restore');
  const acts = c.views.activity.map((a) => [a.action, a.actor_kind, a.via]);
  for (const want of [['venue.create', 'owner', 'rpc'], ['menu.publish', 'owner', 'rpc'], ['venue.approve', 'staff', 'rpc'], ['availability_overrides.insert', 'owner', 'direct']]) {
    assert.ok(acts.some((x) => JSON.stringify(x) === JSON.stringify(want)), 'the owner sees ' + want.join(' '));
  }
  assert.equal(c.views.activity.find((a) => a.action === 'venue.approve').reason, 'First menu checked: prices and add-ons look right');
  assert.ok(c.views.dashboard.activity.some((a) => a.action === 'support.act_for_owner' && a.reason === reason), 'and on the dashboard');
});

test('Halom: a visitor\'s lead reaches ops_leads; the read is logged without the contact', () => {
  assert.equal(c.lead.ok, true);
  assert.match(c.lead.ref, /^MN-\d{4}-\d{4}$/);
  assert.equal(c.leads.count, 1);
  assert.deepEqual([c.leads.leads[0].contact, c.leads.leads[0].status], ['lead.sim@example.invalid', 'new']);
  const read = c.views.staffActivity.find((a) => a.action === 'leads.read');
  assert.equal(read.n, 1);
  assert.ok(!JSON.stringify(c.views.staffActivity).includes('lead.sim@'), 'no contact in the log');
});

test('Halom: the first admin by the README\'s SQL line, support by an invite; support cannot invite', async () => {
  assert.equal(c.team.admin.role, 'admin');
  assert.equal(c.team.support.role, 'support');
  const acts = c.views.staffActivity.map((a) => a.action);
  assert.ok(acts.includes('staff_invite.create') && acts.includes('staff.join'));
  await assert.rejects(c.team.support.invite('another@example.invalid'), (e) => e instanceof ApiError && e.code === '42501');
});
