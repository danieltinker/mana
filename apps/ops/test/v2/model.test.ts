// The v2 back office's pure logic (src/v2/model.ts): warning chips, the timeline's strands and days, what an activity
// entry says, the guest's menu as staff read it, the analytics ranges.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NUDGE_CODES, OPS_WARNINGS, TIMELINE_KINDS, validateOpsAnalyticsQuery, type ActivityEntry } from '@mana/contracts';
import { ID, cafeDemo, liveOf } from '@mana/contracts/fixtures';
import {
  NUDGE_LABEL, analyticsQuery, bucketLabel, compareSnapshots, describe, diffSize, fmtDate, fmtMoney, fmtPct, freshnessWords, menuState, menuView, names,
  parseRoute, snapshotNames, timeline, timelineDays, warningChips,
} from '../../src/v2/model.ts';

const entry = (id: number, at: string, action: ActivityEntry['action'], o: Partial<ActivityEntry> = {}): ActivityEntry => ({
  id, at, actorKind: 'owner', you: false, via: 'direct', action, targetTable: null, targetIds: [], n: 1, targetName: null, reason: null, detail: {}, ...o,
});

test('warning chips: every contract warning has words, a tone and a hint; order is the contract\'s; unknown codes still show', () => {
  const all = warningChips([...OPS_WARNINGS].reverse());
  assert.deepEqual(all.map((c) => c.code), [...OPS_WARNINGS]);
  for (const c of all) {
    assert.ok(c.label.length > 3 && c.hint.length > 10, c.code);
    assert.ok(['info', 'warn', 'bad'].includes(c.tone), c.code);
  }
  assert.deepEqual(warningChips(['case_waiting', 'case_waiting']).map((c) => c.code), ['case_waiting'], 'no duplicates');
  const future = warningChips(['payment_unknown', 'awaiting_review']);
  assert.deepEqual(future.map((c) => [c.code, c.label, c.tone]), [['awaiting_review', 'Waiting for approval', 'warn'], ['payment_unknown', 'payment unknown', 'plain']]);
  const stuck = warningChips(['stuck_step_2d'], { onboarding: { stage: 'photos', done: 4, total: 9, since: null, blocked: [] } });
  assert.equal(stuck[0]?.label, 'Stuck at photos');
});

test('timeline: each entry gets its strand (timelineKind), Halom\'s actions are marked, newest first, counts per strand', () => {
  const t = timeline([
    entry(1, '2026-10-14T08:00:00Z', 'venue.create', { via: 'rpc' }),
    entry(2, '2026-10-14T09:00:00Z', 'menu_imports.insert'),
    entry(3, '2026-10-15T10:00:00Z', 'onboarding_progress.update'),
    entry(5, '2026-10-16T07:10:00Z', 'support.act_for_owner', { actorKind: 'staff', via: 'act_for_owner', reason: 'Owner asked' }),
    entry(4, '2026-10-16T07:10:00Z', 'availability_overrides.update', { actorKind: 'staff', via: 'act_for_owner', reason: 'Owner asked' }),
    entry(6, '2026-10-16T07:20:00Z', 'venue.approve', { actorKind: 'staff', via: 'rpc', reason: 'Checked' }),
    entry(7, '2026-10-16T07:30:00Z', 'support_cases.update', { actorKind: 'staff', via: 'rpc', reason: 'Answered' }),
    entry(8, '2026-10-16T07:40:00Z', 'dishes.update'),
  ]);
  assert.deepEqual(t.items.map((i) => i.id), [8, 7, 6, 5, 4, 3, 2, 1]);
  assert.deepEqual(t.items.map((i) => i.kind), ['menu', 'case', 'publish', 'halom', 'availability', 'onboarding', 'import', 'settings']);
  assert.deepEqual(t.items.map((i) => i.halom), [false, true, true, true, true, false, false, false]);
  assert.deepEqual(Object.keys(t.counts), [...TIMELINE_KINDS]);
  assert.deepEqual(t.counts, { onboarding: 1, import: 1, publish: 1, case: 1, halom: 4, availability: 1, menu: 1, settings: 1 },
    'the Halom strand counts everything Halom did');
  assert.deepEqual(timelineDays(t.items, 'halom').flatMap((d) => d.items.map((i) => i.id)), [7, 6, 5, 4]);
});

test('timeline (L4): only Halom is in the Halom strand; Halom\'s audit rows show the reason their call gave', () => {
  const at = '2026-10-16T07:20:00.000Z';
  const t = timeline([
    entry(1, '2026-10-15T00:00:00Z', 'entitlements.update', { actorKind: 'system', via: 'system', detail: { columns: ['status'] } }),   // a trial the system ended
    entry(2, at, 'venues.update', { actorKind: 'staff', via: 'rpc' }),
    entry(3, at, 'entitlements.update', { actorKind: 'staff', via: 'rpc' }),
    entry(4, at, 'venue.approve', { actorKind: 'staff', via: 'rpc', reason: 'Menu checked with the owner' }),
    entry(5, '2026-10-16T08:00:00Z', 'venues.update', { actorKind: 'owner' }),
    entry(6, '2026-10-16T09:00:00Z', 'venues.update', { actorKind: 'staff', via: 'rpc' }),                                             // no named entry with it
  ]);
  const by = new Map(t.items.map((i) => [i.id, i]));
  assert.deepEqual([by.get(1)!.kind, by.get(1)!.halom], ['settings', false], 'not Halom: a setting');
  assert.deepEqual([by.get(3)!.kind, by.get(3)!.halom], ['halom', true]);
  assert.deepEqual(timelineDays(t.items, 'halom').flatMap((d) => d.items.map((i) => i.id)), [6, 4, 3, 2]);
  assert.deepEqual([2, 3].map((id) => [by.get(id)!.shownReason, by.get(id)!.paired]), [['Menu checked with the owner', true], ['Menu checked with the owner', true]]);
  assert.deepEqual([by.get(4)!.shownReason, by.get(4)!.paired], ['Menu checked with the owner', false], 'its own reason');
  assert.deepEqual([by.get(5)!.shownReason, by.get(6)!.shownReason, by.get(1)!.shownReason], [null, null, null], 'never borrowed across calls or for the owner');
  assert.equal(t.counts.halom, 4);
  assert.equal(t.counts.settings, 4, 'the system’s plan change, the owner’s and Halom’s venue settings');
});

test('timeline (M3): pages merge, an entry on two pages counts once', () => {
  const page1 = [entry(5, '2026-10-16T09:00:00Z', 'dishes.update'), entry(4, '2026-10-16T08:00:00Z', 'dishes.update')];
  const page2 = [entry(4, '2026-10-16T08:00:00Z', 'dishes.update'), entry(2, '2026-10-16T07:00:00Z', 'venue.create')];
  const t = timeline([...page1, ...page2]);
  assert.deepEqual(t.items.map((i) => i.id), [5, 4, 2]);
  assert.equal(t.counts.menu, 2);
});

test('menu state (L3): live only when approved and the plan lets guests in; waiting says so, with the revision', () => {
  const row = (review: 'not_requested' | 'pending' | 'approved', state: 'pending' | 'trialing' | 'active' | 'expired' | 'suspended', live = true, published = true) => ({
    review, plan: { plan: 'trial' as const, state, trialEndsAt: null },
    menu: { live, revision: published ? 2 : null, lastPublishedAt: published ? '2026-10-16T07:00:00Z' : null, firstPublishedAt: published ? '2026-10-15T07:00:00Z' : null },
  });
  assert.deepEqual(menuState(row('approved', 'trialing')), { code: 'live', label: 'live · revision 2', tone: 'good' });
  assert.deepEqual(menuState(row('approved', 'active')).code, 'live');
  assert.deepEqual(menuState(row('pending', 'pending')), { code: 'waiting', label: 'waiting for approval · revision 2', tone: 'warn' },
    'published but not approved is not live');
  assert.deepEqual(menuState(row('approved', 'suspended')), { code: 'plan', label: 'offline: the plan is suspended · revision 2', tone: 'bad' });
  assert.deepEqual(menuState(row('approved', 'expired')).code, 'plan');
  assert.deepEqual(menuState(row('approved', 'trialing', false)).code, 'offline');
  assert.deepEqual(menuState(row('not_requested', 'pending', false, false)), { code: 'never', label: 'never published', tone: 'plain' });
});

test('dates (L2): an instant is shown on its Israel date, never its UTC one', () => {
  assert.equal(fmtDate('2026-10-15T22:30:00Z'), '16 Oct 2026', '01:30 in Israel');
  assert.equal(fmtDate('2026-10-15T20:30:00Z'), '15 Oct 2026');
  assert.equal(fmtDate(null), '—');
});

test('routes (L1): a malformed address never throws; ids are passed on for the venue page to refuse', () => {
  assert.deepEqual(parseRoute('#/venues/%E0%A4%A'), { view: 'venue', id: '' });
  assert.deepEqual(parseRoute(`#/venues/${encodeURIComponent(ID.venue)}`), { view: 'venue', id: ID.venue });
  assert.deepEqual(parseRoute('#/venues/x%2Cy'), { view: 'venue', id: 'x,y' });
  assert.equal(parseRoute('#/analytics?venue=%E0%A4%A').view, 'analytics', 'the search params decode leniently (the page then refuses a non-uuid)');
  assert.deepEqual(parseRoute('#/leads'), { view: 'leads' });
  assert.deepEqual(parseRoute('#/nowhere'), { view: 'clients' });
  assert.deepEqual(parseRoute(''), { view: 'clients' });
});

test('freshness words (M6): "live" only for what the channel covers; the rest comes with the safety poll', () => {
  assert.equal(freshnessWords({ mode: 'realtime', polls: true, pollMs: 30_000, safetyMs: 60_000, liveWhat: 'opens: live' }), 'opens: live · the rest every 60 s');
  assert.equal(freshnessWords({ mode: 'polling', polls: true, pollMs: 30_000, safetyMs: 60_000, liveWhat: 'opens: live' }), 'refreshes every 30 s');
  assert.equal(freshnessWords({ mode: 'polling', polls: false, pollMs: 30_000, safetyMs: 60_000 }), 'loaded on demand');
});

test('nudges: every code of the contract has words', () => {
  for (const code of NUDGE_CODES) assert.ok(NUDGE_LABEL[code](2).length > 10, code);
  assert.equal(NUDGE_LABEL.dish_no_price(1), '1 dish guests can see without a price');
  assert.equal(NUDGE_LABEL.onboarding_step(5), '5 onboarding steps left');
});

test('timeline days: grouped by the Israel date (a UTC evening is the next day there), one strand or all', () => {
  const t = timeline([
    entry(1, '2026-10-15T20:30:00Z', 'dishes.update'),            // 23:30 in Israel: 15 Oct
    entry(2, '2026-10-15T21:30:00Z', 'dishes.update'),            // 00:30 in Israel: 16 Oct
    entry(3, '2026-10-16T09:00:00Z', 'menu_imports.update'),
  ]);
  assert.deepEqual(timelineDays(t.items).map((d) => [d.day, d.items.map((i) => i.id)]), [['2026-10-16', [3, 2]], ['2026-10-15', [1]]]);
  assert.deepEqual(timelineDays(t.items, 'import').map((d) => [d.day, d.items.map((i) => i.id)]), [['2026-10-16', [3]]]);
  assert.deepEqual(timelineDays(t.items, 'case'), []);
});

test('describe: named actions, Halom\'s act for owner, availability with the dish\'s name, prices as shekels; never typed words', () => {
  const nameOf = snapshotNames(cafeDemo());
  const said = (e: ActivityEntry) => { const s = describe(e, nameOf); return [s.title, s.detail]; };
  assert.deepEqual(said(entry(1, '2026-10-16T07:00:00Z', 'support.act_for_owner', { detail: { action: 'availability.restore' } })),
    ['Halom acted for the owner', 'Bring something back on the menu']);
  assert.deepEqual(said(entry(2, '2026-10-16T07:00:00Z', 'availability_overrides.insert', { detail: { target_kind: 'dish', target_id: ID.espresso, until_at: '2026-10-16T09:00:00Z' } })),
    ['Taken off: Espresso', 'until 16 Oct, 12:00']);
  assert.deepEqual(said(entry(3, '2026-10-16T07:00:00Z', 'availability_overrides.update', { detail: { columns: ['restored_at'], target_id: ID.espresso } })),
    ['Brought back', 'Espresso']);
  assert.deepEqual(said(entry(4, '2026-10-16T07:00:00Z', 'dishes.update', { targetName: { he: 'המבורגר', en: 'Burger' }, detail: { columns: ['price', 'name_en'], changes: { price: [6600, 6850] } } })),
    ['Dish changed: Burger', 'price ₪66 → ₪68.50 · name (en)']);
  assert.deepEqual(said(entry(5, '2026-10-16T07:00:00Z', 'onboarding_progress.update', { targetIds: [`${ID.venue}/photos`], detail: { columns: ['state'], changes: { state: ['todo', 'blocked'] } } })),
    ['Onboarding: Photos', 'Blocked']);
  assert.deepEqual(said(entry(6, '2026-10-16T07:00:00Z', 'sections.insert', { n: 4 })), ['Sections added (4)', null]);
  assert.deepEqual(said(entry(7, '2026-10-16T07:00:00Z', 'menu.publish', { detail: { revision: 3 } })), ['Menu published', 'Revision 3']);
  assert.deepEqual(said(entry(8, '2026-10-16T07:00:00Z', 'venue.set_demo', { detail: { demo: true } })), ['Marked as a demo venue', null]);
  assert.deepEqual(said(entry(9, '2026-10-16T07:00:00Z', 'support_cases.update', { detail: { columns: ['status'], changes: { status: ['open', 'resolved'] } } })),
    ['Support case updated', 'Resolved']);
  assert.deepEqual(said(entry(11, '2026-10-16T07:00:00Z', 'menu.read', { actorKind: 'staff', via: 'rpc', detail: { revision: 2 } })), ['Halom read a stored menu', 'Revision 2']);
  const hostile = describe(entry(10, '2026-10-16T07:00:00Z', 'support.act_for_owner', { detail: { action: '<b>x</b>' } }));
  assert.equal(hostile.detail, '<b>x</b>', 'an unknown value is passed on as text, for the page to render as text');
});

test('menu view: what guests see, with what is off now and until when; the overlay\'s past or future entries do not count', () => {
  const s = cafeDemo();
  const v = menuView(s, liveOf([
    { kind: 'dish', id: ID.espresso, from: '2026-10-15T08:00:00Z', until: '2026-10-15T10:00:00Z' },
    { kind: 'option', id: ID.oat, from: '2026-10-15T08:00:00Z', until: null },
    { kind: 'dish', id: ID.burger, from: '2026-10-15T07:00:00Z', until: '2026-10-15T08:00:00Z' },     // already back
    { kind: 'section', id: ID.pastries, from: '2026-10-15T12:00:00Z', until: null },                  // not yet
  ], '2026-10-15T09:00:00Z'));
  assert.deepEqual(v.sections.map((x) => names(x.name).main), ['Breakfast', 'Mains', 'Drinks', 'Pastries']);
  const drinks = v.sections[2]!;
  assert.deepEqual(drinks.dishes.map((d) => [names(d.name).main, d.price, d.off?.until ?? null]), [['Espresso', 1200, '2026-10-15T10:00:00Z'], ['Lemonade', 1600, null]]);
  assert.equal(v.sections[1]!.dishes[0]!.off, null);
  assert.equal(v.sections[3]!.off, null);
  assert.deepEqual(v.options.map((o) => names(o.name).main), ['Oat']);
  assert.equal(v.offCount, 2);
});

test('names and money', () => {
  assert.deepEqual(names({ he: 'קפה דמו', en: 'Café Demo' }), { main: 'Café Demo', alt: 'קפה דמו' });
  assert.deepEqual(names({ he: 'קפה', en: '' }), { main: 'קפה', alt: null });
  assert.deepEqual(names({ he: '', en: '' }, 'cafe-demo'), { main: 'cafe-demo', alt: null });
  assert.equal(fmtMoney(5400), '₪54');
  assert.equal(fmtMoney(5450), '₪54.50');
  assert.equal(fmtPct(1, 3), '33%');
  assert.equal(fmtPct(0, 0), '—', 'no share of nothing');
});

test('analytics ranges: whole minutes ending with the current one, or Israel days ending today; each valid for the contract', () => {
  const now = Date.parse('2026-10-16T21:30:20Z');                 // 00:30 on 17 Oct in Israel
  const hour = analyticsQuery('1h', now, { demo: 'include' });
  assert.deepEqual([hour.resolution, hour.from, hour.to, hour.demo, hour.venueId], ['minute', '2026-10-16T20:31:00.000Z', '2026-10-16T21:31:00.000Z', 'include', null]);
  const day = analyticsQuery('24h', now);
  assert.equal(Date.parse(day.to) - Date.parse(day.from), 24 * 3600_000);
  const week = analyticsQuery('7d', now, { venueId: ID.venue });
  assert.deepEqual([week.resolution, week.from, week.to, week.venueId, week.demo], ['day', '2026-10-11', '2026-10-17', ID.venue, 'exclude']);
  for (const id of ['1h', '24h', '7d', '30d'] as const) assert.equal(validateOpsAnalyticsQuery(analyticsQuery(id, now)).ok, true, id);
  assert.equal(bucketLabel('2026-10-16T21:05:00.000Z', 'minute'), '00:05');
  assert.equal(bucketLabel('2026-10-17', 'day'), '17 Oct');
});

test('compare two stored revisions: dishes and sections added or removed, prices and names changed, by id', () => {
  const base = cafeDemo() as any;
  const next = cafeDemo() as any;
  base.sections[2].dishes = base.sections[2].dishes.filter((d: any) => d.id !== ID.lemonade);   // no lemonade before
  base.sections[1].dishes[0].price.amount = 6600;                                               // the burger was ₪66
  next.sections[3].dishes[0].name = { he: 'קרואסון חמאה', en: 'Butter croissant' };             // renamed, same id
  next.sections = next.sections.filter((x: any) => x.id !== ID.morning);                        // breakfast gone
  const d = compareSnapshots(base, next);
  assert.deepEqual(d.dishesAdded.map((x) => x.name.en), ['Lemonade']);
  assert.deepEqual(d.dishesRemoved.map((x) => x.name.en), ['Shakshuka']);
  assert.deepEqual(d.sectionsRemoved.map((x) => x.name.en), ['Breakfast']);
  assert.deepEqual(d.sectionsAdded, []);
  assert.deepEqual(d.prices.map((p) => [p.name.en, p.from, p.to]), [['Burger', 6600, 6800]]);
  assert.deepEqual(d.renamed.map((r) => [r.from.en, r.to.en]), [['Croissant', 'Butter croissant']]);
  assert.equal(diffSize(d), 5);
  assert.equal(diffSize(compareSnapshots(cafeDemo(), cafeDemo())), 0);
});
