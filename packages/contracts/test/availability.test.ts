import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAvailable, menuAvailability, unavailableOf, type OverrideLike } from '../src/availability.ts';
import { zonedTime, type ScheduleTimes, type VenueHours } from '../src/time.ts';
import { cafeDemo, HOURS, ID, liveOf } from './fixtures.ts';

const TZ = 'Asia/Jerusalem';
const at = (date: string, time: string) => zonedTime(date, time, TZ);
const hours: VenueHours = { timeZone: TZ, weekly: HOURS.weekly, closures: [] };
const dish = { kind: 'dish', id: ID.burger, sectionId: ID.mains } as const;
const iso = (d: Date | null) => (d ? d.toISOString() : null);

test('nothing off, inside hours: available', () => {
  assert.deepEqual(isAvailable(dish, [], null, hours, at('2026-10-15', '12:00')), { available: true });
});

test('sold out for two hours, restored on time by the clock', () => {
  const now = at('2026-10-15', '12:00');
  const o: OverrideLike[] = [{ kind: 'dish', id: ID.burger, from: new Date(now), until: new Date(now + 2 * 3600_000) }];
  const a = isAvailable(dish, o, null, hours, now + 60_000);
  assert.equal(a.available, false);
  assert.ok(!a.available && a.reason === 'off' && iso(a.back) === new Date(now + 2 * 3600_000).toISOString());
  assert.deepEqual(isAvailable(dish, o, null, hours, now + 2 * 3600_000), { available: true }, 'the end is exclusive');
  assert.deepEqual(isAvailable(dish, o, null, hours, now - 1), { available: true }, 'not before it starts');
});

test('indefinite and section overrides; the latest end wins', () => {
  const now = at('2026-10-15', '12:00');
  const forever = isAvailable(dish, [{ kind: 'dish', id: ID.burger, until: null }], null, hours, now);
  assert.ok(!forever.available && forever.reason === 'off' && forever.back === null);
  const viaSection = isAvailable(dish, [{ kind: 'section', id: ID.mains, until: new Date(now + 3600_000).toISOString() }], null, hours, now);
  assert.ok(!viaSection.available && viaSection.reason === 'off');
  const both = isAvailable(dish, [
    { kind: 'section', id: ID.mains, until: new Date(now + 3600_000) },
    { kind: 'dish', id: ID.burger, until: new Date(now + 7200_000) },
  ], null, hours, now);
  assert.ok(!both.available && iso(both.back) === new Date(now + 7200_000).toISOString());
  // another dish's override does not touch this one
  assert.deepEqual(isAvailable(dish, [{ kind: 'dish', id: ID.schnitzel, until: null }], null, hours, now), { available: true });
});

test('outside opening hours: "closed", back at the next opening', () => {
  const a = isAvailable(dish, [], null, hours, at('2026-10-15', '23:30')); // Thursday after 23:00
  assert.ok(!a.available && a.reason === 'closed');
  assert.equal(iso(!a.available ? a.back : null), new Date(at('2026-10-16', '07:00')).toISOString());
  // a menu that ignores hours (null) says available
  assert.deepEqual(isAvailable(dish, [], null, null, at('2026-10-15', '23:30')), { available: true });
});

test('across midnight: Saturday night 19:00–01:00', () => {
  assert.deepEqual(isAvailable(dish, [], null, hours, at('2026-10-18', '00:30')), { available: true }, 'Sunday 00:30 is Saturday night');
  const a = isAvailable(dish, [], null, hours, at('2026-10-18', '01:30'));
  assert.ok(!a.available && a.reason === 'closed' && iso(a.back) === new Date(at('2026-10-18', '07:00')).toISOString());
});

test('a closed day: everything is closed, back the day after', () => {
  const h: VenueHours = { ...hours, closures: [{ from: '2026-10-15', to: '2026-10-15' }] };
  const a = isAvailable(dish, [], null, h, at('2026-10-15', '12:00'));
  assert.ok(!a.available && a.reason === 'closed' && iso(a.back) === new Date(at('2026-10-16', '07:00')).toISOString());
});

test('a breakfast day part: available 07:00–12:00 only, back tomorrow at 07:00', () => {
  const breakfast: ScheduleTimes = { windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '12:00' }], validFrom: null, validTo: null };
  const t = { kind: 'section', id: ID.morning } as const;
  assert.deepEqual(isAvailable(t, [], breakfast, hours, at('2026-10-15', '11:59')), { available: true });
  const late = isAvailable(t, [], breakfast, hours, at('2026-10-15', '12:00'));
  assert.ok(!late.available && late.reason === 'schedule' && iso(late.back) === new Date(at('2026-10-16', '07:00')).toISOString());
});

test('a Friday special shows only on Friday, and only within its dates', () => {
  const special: ScheduleTimes = { windows: [{ days: [5], from: '07:00', to: '15:00' }], validFrom: '2026-10-01', validTo: '2026-10-31' };
  const t = { kind: 'dish', id: ID.fridayCake } as const;
  assert.deepEqual(isAvailable(t, [], special, hours, at('2026-10-16', '10:00')), { available: true });
  assert.equal(isAvailable(t, [], special, hours, at('2026-10-15', '10:00')).available, false);
  assert.equal(isAvailable(t, [], special, hours, at('2026-11-06', '10:00')).available, false, 'after validTo');
});

test('the reason order: off before schedule before closed', () => {
  const breakfast: ScheduleTimes = { windows: [{ days: [4], from: '07:00', to: '12:00' }], validFrom: null, validTo: null };
  const r = isAvailable({ kind: 'dish', id: ID.shakshuka }, [{ kind: 'dish', id: ID.shakshuka, until: null }], breakfast, hours, at('2026-10-15', '23:30'));
  assert.ok(!r.available && r.reason === 'off');
  const r2 = isAvailable({ kind: 'dish', id: ID.shakshuka }, [], breakfast, hours, at('2026-10-15', '23:30'));
  assert.ok(!r2.available && r2.reason === 'schedule');
});

test('DST: a two-hour override set at 01:00 on the spring night ends at 04:00 local', () => {
  const now = at('2026-03-27', '01:00');
  const o: OverrideLike[] = [{ kind: 'option', id: ID.aioli, until: new Date(now + 2 * 3600_000) }];
  assert.equal(isAvailable({ kind: 'option', id: ID.aioli }, o, null, null, at('2026-03-27', '03:59')).available, false);
  assert.equal(isAvailable({ kind: 'option', id: ID.aioli }, o, null, null, at('2026-03-27', '04:00')).available, true);
});

test('menuAvailability: required choices exhausted marks the dish unavailable for "choices"', () => {
  const s = cafeDemo();
  const now = at('2026-10-15', '10:00');
  const off = [ID.sourdough, ID.challah].map((id) => ({ kind: 'option' as const, id, from: '2026-10-15T00:00:00Z', until: null }));
  const av = menuAvailability(s, liveOf(off), now);
  const a = av.dishes.get(ID.shakshuka)!;
  assert.ok(!a.available && a.reason === 'choices');
  assert.equal(av.dishes.get(ID.burger)!.available, true);
  assert.equal(av.options.get(ID.sourdough)!.available, false);
  const u = unavailableOf(av);
  assert.ok(u.dishes.has(ID.shakshuka) && u.options.has(ID.challah) && !u.dishes.has(ID.burger));
});

test('menuAvailability: schedules of sections and dishes, and "closed" left out for a view-only menu', () => {
  const s = cafeDemo();
  const thursdayNight = at('2026-10-15', '23:30');
  const av = menuAvailability(s, liveOf(), thursdayNight);
  assert.equal(av.open, false);
  const shak = av.dishes.get(ID.shakshuka)!;
  assert.ok(!shak.available && shak.reason === 'schedule', 'breakfast is over before the venue closes');
  const burger = av.dishes.get(ID.burger)!;
  assert.ok(!burger.available && burger.reason === 'closed');
  assert.ok(!unavailableOf(av).dishes.has(ID.burger), 'closed is not "cannot choose" on a view-only menu');
  assert.ok(unavailableOf(av, true).dishes.has(ID.burger));
  const friday = menuAvailability(s, liveOf(), at('2026-10-16', '10:00'));
  assert.equal(friday.dishes.get(ID.fridayCake)!.available, true);
  assert.equal(menuAvailability(s, liveOf(), at('2026-10-15', '10:00')).dishes.get(ID.fridayCake)!.available, false);
});
