// Phase 1 end to end (ADR-008), on a real venue and a demo one: Halom's back-office analytics and the owner's
// extended dashboard agree key by key with what the guests did, demo traffic left out unless asked for; the owner asks
// for help and Halom answers the case; the phone takes a dish off for two hours and brings back everything off today;
// the export is exactly the seed's menu; the demo label is Halom's admin's, with a reason the owner sees.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GUEST_EVENTS } from '@mana/contracts';
import { bistro, phase1Chain } from '../src/scenarios.mjs';
import { DEMO_REASON } from '../src/seed.mjs';
import { exportVsSeed, useStack } from './helpers.mjs';

const seed = bistro();
let c;
useStack(async (stack) => { c = await phase1Chain(stack, { slug: 'bistro-p1', seed }); });

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

test('ops_analytics: real traffic by default, demo only when asked, both when included, key by key with the guests', () => {
  const { real, demo, all, venue } = c.analytics;
  assert.equal(real.demo, 'exclude');
  assert.equal(real.buckets.length, 60);
  for (const name of GUEST_EVENTS) {
    assert.equal(real.totals[name], c.ledgers.real.n(name), `real ${name}`);
    assert.equal(sum(real.series[name]), real.totals[name], `the series sums to the total: ${name}`);
    assert.equal(demo.totals[name], c.ledgers.demo.n(name), `demo ${name}`);
    assert.equal(all.totals[name], c.ledgers.real.n(name) + c.ledgers.demo.n(name), `included ${name}`);
    assert.equal(venue.totals[name], c.ledgers.real.n(name), `one venue ${name}`);
    assert.equal(c.analytics.day.totals[name], c.ledgers.real.n(name), `today, by day ${name}`);
  }
  assert.ok(c.ledgers.real.n('menu_opened') >= 3 + 15, 'the scripted three and the crowd opened the menu');
  assert.deepEqual(c.analytics.day.funnel, { created: 1, imported: 0, published: 1, approved: 1 }, 'the real venue created today');
});

test('my_dashboard v2: the totals, opens, rules, top dishes and the last hour by minute are what the guests did', () => {
  const d = c.dashboard;
  const L = c.ledgers.real;
  assert.equal(d.v, 2);
  assert.deepEqual(d.totals, L.totals());
  assert.deepEqual(d.opensBy, L.opensBy());
  for (const r of d.rules) assert.deepEqual({ shown: r.shown, accepted: r.accepted, dismissed: r.dismissed }, L.rule(r.ruleId), r.label);
  for (const t of d.topDishes) assert.deepEqual({ views: t.views, adds: t.adds }, L.dish(t.dishId), t.name.en);
  assert.deepEqual([sum(d.lastHour.map((m) => m.opens)), sum(d.lastHour.map((m) => m.views)), sum(d.lastHour.map((m) => m.adds))],
    [L.n('menu_opened'), L.n('dish_viewed'), L.n('basket_added')]);
  assert.ok(d.lastHour.every((m) => m.opens + m.views + m.adds > 0), 'sparse: only minutes with something');
  assert.deepEqual(d.progress, { done: 6, total: 9, next: 'photos', complete: false }, 'venue, menu, review (skipped), addons, hours, publish');
  assert.deepEqual(d.nudges.map((n) => n.code), ['onboarding_step', 'dish_no_photo']);
});

test('help: the owner asks, the case shows on the clients list and the venue with a warning; Halom answers it', () => {
  const h = c.help;
  assert.deepEqual([h.asked.ok, h.asked.supportCanAct], [true, true]);
  assert.ok(h.list.venues.some((v) => v.id === c.real.venueId && v.warnings.includes('case_open') && v.openCases === 1));
  assert.ok(h.detail.venue.warnings.includes('case_open'));
  assert.deepEqual([h.detail.cases[0].id, h.detail.cases[0].status, h.detail.cases[0].topic, h.detail.cases[0].openedBy], [h.asked.caseId, 'open', 'menu', 'owner']);
  assert.deepEqual([h.updated.ok, h.updated.case.status], [true, 'waiting_owner']);
  assert.ok(!h.listAfter.venues.some((v) => v.id === c.real.venueId), 'waiting for the owner is not open for Halom');
  assert.deepEqual(h.dashboard.nudges.find((n) => n.code === 'case_waiting_owner'), { code: 'case_waiting_owner', count: 1, targets: [{ kind: 'case', id: h.asked.caseId }] });
  const answer = h.activity.entries.find((e) => e.action === 'support_cases.update');
  assert.deepEqual([answer.actorKind, answer.via, answer.reason, answer.you], ['staff', 'rpc', 'Asked the owner which price is right', false]);
  const mine = h.activity.entries.find((e) => e.action === 'support_cases.insert');
  assert.deepEqual([mine.actorKind, mine.you], ['owner', true]);
  assert.ok(!JSON.stringify(h.activity).includes('lemonade price'), 'the case\'s words are not in the log');
});

test('the phone: two hours off, seen by guests at once and on the dashboard; "back everything off today" restores it', () => {
  const p = c.phone;
  const T = c.real.ids.dishes.toast;
  assert.equal(p.off.ok, true);
  assert.equal(Date.parse(p.off.untilAt) % 60000, 0, 'a whole minute');
  assert.deepEqual(p.whileOff.live.off.map((o) => [o.kind, o.id, o.until]), [['dish', T, p.off.untilAt]]);
  assert.equal(p.whileOff.toast.available, false);
  const row = p.whileOff.offNow.find((o) => o.id === T);
  assert.deepEqual([row.overrideId, row.kind, row.name.en, row.until, row.untilKind, row.by, row.today], [p.off.overrideId, 'dish', 'Toast', p.off.untilAt, 'duration', 'owner', true]);
  assert.deepEqual(p.restored, { ok: true, restored: 1, targets: [{ kind: 'dish', id: T }] });
  assert.deepEqual(p.after.live.off, []);
  assert.equal(p.after.toast.available, true);
});

test('export_menu is exactly the seed\'s menu, as stored', () => {
  const x = c.exported;
  assert.deepEqual([x.v, x.kind, x.venue.id, x.venue.slug, x.publishedRevision], [1, 'mana.menu_export', c.real.venueId, 'bistro-p1-real', 1]);
  assert.deepEqual(exportVsSeed(x, seed, c.real.ids), []);
});

test('the demo label is Halom\'s admin\'s (ops_set_demo), with the reason the owner sees; demo venues stay out of real totals', () => {
  const set = c.demoActivity.entries.find((e) => e.action === 'venue.set_demo');
  assert.deepEqual([set.actorKind, set.via, set.reason, set.detail], ['staff', 'rpc', DEMO_REASON, { demo: true }]);
  assert.deepEqual([c.totals.venues, c.totals.demoVenues, c.totals.live], [1, 1, 1]);
  assert.equal(c.totals.opensToday, c.ledgers.real.n('menu_opened'));
});
