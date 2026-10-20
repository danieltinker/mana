// Events end to end: resending the same events (the same ids) never changes the rollups; the rollup job counts each
// event once; and the seeded-random mode, where N guests over M minutes produce numbers that every dashboard agrees on,
// replays exactly with the same seed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isoAt } from '../src/clock.mjs';
import { GuestBot } from '../src/guest.mjs';
import { runRandom } from '../src/random.mjs';
import { bistro, halomTeam, scriptedGuests } from '../src/scenarios.mjs';
import { guestRollups, liveVenue, useStack } from './helpers.mjs';

const S = useStack(async (stack) => {
  const team = await halomTeam(stack, 'events');
  return { team, idem: await liveVenue(stack, bistro(), 'bistro-idem', team), crowd: await liveVenue(stack, bistro(), 'bistro-crowd', team),
    replay: await liveVenue(stack, bistro(), 'bistro-replay', team) };
});

test('resending the same events (same ids) changes nothing: not the rollups, not the dashboards', async () => {
  const { owner, ids, slug, venueId } = S.ctx.idem;
  const run = await scriptedGuests(S.stack, slug, ids);
  await S.stack.buildRollups();
  const rollups = await guestRollups(owner);
  const dash = (await owner.dashboard('7d')).totals;
  const card = await S.ctx.team.support.venueCard(venueId);
  assert.deepEqual(rollups, run.ledger.rows());

  // every phone retries everything it sent, twice, in other batch sizes
  const sent = run.guests.flatMap((g) => g.sent);
  const phone = new GuestBot(S.stack, { ip: '10.30.0.1' });
  for (let i = 0; i < 2; i++) {
    const again = await phone.resend(i === 0 ? sent : [...sent].reverse());
    assert.deepEqual([again.accepted, again.duplicates, again.capped, again.rejected], [0, sent.length, 0, []]);
  }
  // the same id twice inside one batch, beside an id already stored
  const one = sent[0];
  const fresh = { ...one, id: randomUUID(), at: isoAt(Date.now()) };
  const mixed = await phone.resend([one, fresh, fresh]);
  assert.deepEqual([mixed.accepted, mixed.duplicates], [1, 2]);

  assert.deepEqual(await S.stack.buildRollups(), { ok: true, events: 1 }, 'only the one new event reached the rollup queue');
  assert.deepEqual(await S.stack.buildRollups(), { ok: true, events: 0 }, 'a second run finds nothing');
  const after = await guestRollups(owner);
  const want = run.ledger.rows().map((r) => ({ ...r }));
  // the new event adds exactly its own keys
  const plus = (name, key) => { const r = want.find((x) => x.name === name && x.key === key); if (r) r.n += 1; else want.push({ name, key, n: 1 }); };
  plus(fresh.name, '');
  if (fresh.name === 'menu_opened') { plus(fresh.name, 'src:' + fresh.props.src); plus(fresh.name, 'lang:' + fresh.props.lang); }
  want.sort((a, b) => (a.name + '|' + a.key < b.name + '|' + b.key ? -1 : 1));
  assert.deepEqual(after, want);
  const dash2 = (await owner.dashboard('7d')).totals;
  assert.equal(dash2.menuOpens, dash.menuOpens + 1);
  assert.deepEqual({ ...dash2, menuOpens: dash.menuOpens }, dash);
  assert.equal((await S.ctx.team.support.venueCard(venueId)).opens.last7d, card.opens.last7d + 1);
});

test('random mode: N guests over M minutes; the owner\'s dashboard and Halom\'s overview agree with what they did, key by key', async () => {
  const { owner, ids, slug, venueId } = S.ctx.crowd;
  const r = await runRandom(S.stack, { slug, guests: 40, minutes: 20, seed: 42 });
  assert.deepEqual(r.results, { accepted: r.ledger.events, duplicates: 0, capped: 0, rejected: 0, uncertain: 0 });
  assert.deepEqual(r.violations, []);
  assert.equal(r.ledger.n('menu_opened'), 40);
  assert.ok(r.ledger.n('basket_added') > 20 && r.ledger.n('suggestion_shown') > 5 && r.ledger.n('addon_chosen') > 20, JSON.stringify(r.ledger.totals()));
  // times: within the last M minutes, with the venue's offset, never in the future
  const now = Date.now();
  for (const b of r.bots) for (const e of b.sent) {
    assert.match(e.at, /[+-]\d\d:\d\d$/);
    const t = Date.parse(e.at);
    assert.ok(t <= now && t >= now - 21 * 60000, e.at);
  }
  await S.stack.buildRollups();
  assert.deepEqual(await guestRollups(owner), r.ledger.rows());
  const d = await owner.dashboard('7d');
  assert.deepEqual(d.totals, r.ledger.totals());
  assert.deepEqual(d.opensBy, r.ledger.opensBy());
  for (const rule of d.rules) assert.deepEqual({ shown: rule.shown, accepted: rule.accepted, dismissed: rule.dismissed }, r.ledger.rule(rule.ruleId), rule.label);
  for (const t of d.topDishes) assert.deepEqual({ views: t.views, adds: t.adds }, r.ledger.dish(t.dishId), t.name.en);
  assert.equal(d.lastHour.reduce((s, m) => s + m.opens, 0), 40, 'the last hour by minute');
  const card = await S.ctx.team.support.venueCard(venueId);
  assert.deepEqual([card.opens.last7d, card.opens.lastHour], [40, 40]);
  assert.deepEqual(card.suggestions7d, { shown: r.ledger.n('suggestion_shown'), accepted: r.ledger.n('suggestion_accepted') });
  assert.deepEqual((await S.ctx.team.support.dashboard(venueId, '7d')).totals, d.totals);
  assert.ok(Object.keys(ids.dishes).length > 0);
});

test('the same seed replays the same guests doing the same things; another seed does not', async () => {
  const { slug } = S.ctx.replay;
  const shape = (r) => r.bots.map((b) => b.sent.map((e) => [e.name, e.props]));
  const a = await runRandom(S.stack, { slug, guests: 12, minutes: 10, seed: 7 });
  const b = await runRandom(S.stack, { slug, guests: 12, minutes: 10, seed: 7 });
  const c = await runRandom(S.stack, { slug, guests: 12, minutes: 10, seed: 8 });
  assert.deepEqual(shape(a), shape(b));
  assert.deepEqual(a.bots.map((x) => x.actions), b.bots.map((x) => x.actions));
  assert.notDeepEqual(shape(a), shape(c));
  // new ids every run: the replay is new traffic, not a duplicate
  assert.equal(b.results.duplicates, 0);
  assert.equal(b.results.accepted, a.results.accepted);
  await S.stack.buildRollups();
  const d = await S.ctx.replay.owner.dashboard('7d');
  assert.equal(d.totals.menuOpens, 36);
  assert.equal(d.totals.basketAdds, a.ledger.n('basket_added') + b.ledger.n('basket_added') + c.ledger.n('basket_added'));
});
