import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, isLocalDate, isOpenAt, localParts, nextOpening, offsetAt, resolveUntil, weekdayOf, windowsOn, zonedTime,
  type VenueHours,
} from '../src/time.ts';

const TZ = 'Asia/Jerusalem';
const iso = (ms: number | Date | null) => (ms === null ? null : new Date(ms).toISOString());
const H = (weekly: VenueHours['weekly'], closures: VenueHours['closures'] = []): VenueHours => ({ timeZone: TZ, weekly, closures });

test('Jerusalem offsets: +2 in winter, +3 in summer', () => {
  assert.equal(offsetAt(Date.parse('2026-01-15T12:00:00Z'), TZ), 2 * 3600_000);
  assert.equal(offsetAt(Date.parse('2026-07-15T12:00:00Z'), TZ), 3 * 3600_000);
});

test('zonedTime: an ordinary local time', () => {
  assert.equal(iso(zonedTime('2026-10-15', '09:00', TZ)), '2026-10-15T06:00:00.000Z');
  assert.equal(iso(zonedTime('2026-12-01', '09:00', TZ)), '2026-12-01T07:00:00.000Z');
});

test('zonedTime: spring forward (27 Mar 2026, 02:00 → 03:00): a time in the gap is read with the old offset, like Postgres', () => {
  // Postgres: '2026-03-27 02:30'::timestamp at time zone 'Asia/Jerusalem' = 2026-03-27 00:30Z
  assert.equal(iso(zonedTime('2026-03-27', '02:30', TZ)), '2026-03-27T00:30:00.000Z');
  assert.equal(iso(zonedTime('2026-03-27', '02:00', TZ)), '2026-03-27T00:00:00.000Z');
  assert.equal(iso(zonedTime('2026-03-27', '03:00', TZ)), '2026-03-27T00:00:00.000Z');
  assert.equal(iso(zonedTime('2026-03-27', '01:59', TZ)), '2026-03-26T23:59:00.000Z');
});

test('zonedTime: fall back (25 Oct 2026, 02:00 → 01:00): an hour that happens twice is the second one, like Postgres', () => {
  assert.equal(iso(zonedTime('2026-10-25', '01:30', TZ)), '2026-10-24T23:30:00.000Z');
  assert.equal(iso(zonedTime('2026-10-25', '01:00', TZ)), '2026-10-24T23:00:00.000Z');
  assert.equal(iso(zonedTime('2026-10-25', '00:59', TZ)), '2026-10-24T21:59:00.000Z');
  assert.equal(iso(zonedTime('2026-10-25', '02:00', TZ)), '2026-10-25T00:00:00.000Z');
});

test('localParts and weekdays (0 = Sunday)', () => {
  const p = localParts(Date.parse('2026-10-15T21:30:00Z'), TZ); // 00:30 on Friday 16 Oct in Israel
  assert.deepEqual(p, { date: '2026-10-16', weekday: 5, minutes: 30 });
  assert.equal(weekdayOf('2026-10-18'), 0);
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(isLocalDate('2026-02-29'), false);
  assert.equal(isLocalDate('2028-02-29'), true);
});

test('a window that runs past midnight belongs to the day it opens', () => {
  const hours = H([{ days: [6], from: '19:00', to: '01:00' }]); // Saturday night
  // Sat 17 Oct 2026 23:30 local
  assert.equal(isOpenAt(hours, zonedTime('2026-10-17', '23:30', TZ)), true);
  // Sun 18 Oct 00:30 local: still Saturday's window
  assert.equal(isOpenAt(hours, zonedTime('2026-10-18', '00:30', TZ)), true);
  // Sun 18 Oct 01:00: closed (end is exclusive)
  assert.equal(isOpenAt(hours, zonedTime('2026-10-18', '01:00', TZ)), false);
  // Sat 17 Oct 00:30 belongs to Friday night: no Friday window here
  assert.equal(isOpenAt(hours, zonedTime('2026-10-17', '00:30', TZ)), false);
  const [iv] = windowsOn(hours.weekly, '2026-10-17', TZ);
  assert.equal(iso(iv!.end), '2026-10-17T22:00:00.000Z');
});

test('00:00–00:00 is a full day; no hours means always open', () => {
  assert.equal(isOpenAt(H([{ days: [4], from: '00:00', to: '00:00' }]), zonedTime('2026-10-15', '23:59', TZ)), true);
  assert.equal(isOpenAt(H([]), Date.parse('2026-10-15T03:00:00Z')), true);
});

test('a closed date removes the windows that open on it, not the night before', () => {
  const hours = H([{ days: [0, 1, 2, 3, 4, 5, 6], from: '18:00', to: '02:00' }], [{ from: '2026-10-16', to: '2026-10-16' }]);
  assert.equal(isOpenAt(hours, zonedTime('2026-10-16', '01:00', TZ)), true, "Thursday's night runs into the closed Friday");
  assert.equal(isOpenAt(hours, zonedTime('2026-10-16', '20:00', TZ)), false, 'Friday evening is closed');
  assert.equal(isOpenAt(hours, zonedTime('2026-10-17', '20:00', TZ)), true);
});

test('nextOpening skips a closed day and the weekend gap', () => {
  const hours = H(
    [{ days: [0, 1, 2, 3, 4], from: '08:00', to: '17:00' }],
    [{ from: '2026-10-18', to: '2026-10-18' }], // Sunday closed
  );
  // Thursday 15 Oct 18:00 → next is Monday 19 Oct 08:00 (Fri/Sat have no hours, Sunday is closed)
  assert.equal(iso(nextOpening(hours, zonedTime('2026-10-15', '18:00', TZ))), iso(zonedTime('2026-10-19', '08:00', TZ)));
  // during opening hours: the next opening is tomorrow's
  assert.equal(iso(nextOpening(hours, zonedTime('2026-10-15', '09:00', TZ))), iso(zonedTime('2026-10-19', '08:00', TZ)));
  assert.equal(nextOpening(H([]), Date.now()), null);
});

test('nextOpening across the autumn change uses the new offset', () => {
  const hours = H([{ days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '23:00' }]);
  // Saturday 24 Oct 23:30 IDT → Sunday 25 Oct 07:00 IST (+2) = 05:00Z
  assert.equal(iso(nextOpening(hours, zonedTime('2026-10-24', '23:30', TZ))), '2026-10-25T05:00:00.000Z');
});

test('resolveUntil: duration, a time today or tomorrow, a date, indefinite', () => {
  const hours = H([{ days: [0, 1, 2, 3, 4], from: '08:00', to: '17:00' }]);
  const now = zonedTime('2026-10-15', '12:00', TZ);
  assert.equal(iso(resolveUntil({ kind: 'duration', minutes: 120 }, now, hours)), iso(now + 2 * 3600_000));
  assert.equal(iso(resolveUntil({ kind: 'time', at: '14:30' }, now, hours)), iso(zonedTime('2026-10-15', '14:30', TZ)));
  assert.equal(iso(resolveUntil({ kind: 'time', at: '09:00' }, now, hours)), iso(zonedTime('2026-10-16', '09:00', TZ)), 'passed today → tomorrow');
  assert.equal(iso(resolveUntil({ kind: 'date', date: '2026-10-20' }, now, hours)), iso(zonedTime('2026-10-20', '00:00', TZ)));
  assert.equal(resolveUntil({ kind: 'indefinite' }, now, hours), null);
});

test('resolveUntil "until opening tomorrow" crosses a closed day and the weekend', () => {
  const hours = H([{ days: [0, 1, 2, 3, 4], from: '08:00', to: '17:00' }], [{ from: '2026-10-18', to: '2026-10-18' }]);
  const thursdayNoon = zonedTime('2026-10-15', '12:00', TZ);
  assert.equal(iso(resolveUntil({ kind: 'next_opening' }, thursdayNoon, hours)), iso(zonedTime('2026-10-19', '08:00', TZ)));
  // no hours set: the start of tomorrow
  assert.equal(iso(resolveUntil({ kind: 'next_opening' }, thursdayNoon, H([]))), iso(zonedTime('2026-10-16', '00:00', TZ)));
});

test('resolveUntil: two hours across the spring change are two real hours', () => {
  const now = zonedTime('2026-03-27', '01:00', TZ); // 23:00Z the day before
  const until = resolveUntil({ kind: 'duration', minutes: 120 }, now, H([]))!;
  assert.equal(iso(until), '2026-03-27T01:00:00.000Z');
  assert.deepEqual(localParts(until, TZ), { date: '2026-03-27', weekday: 5, minutes: 4 * 60 }, 'the wall clock shows 04:00');
});
