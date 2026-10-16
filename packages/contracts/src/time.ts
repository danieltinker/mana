/**
 * Wall-clock time in a venue's time zone (Asia/Jerusalem by default): opening hours, closures, day parts,
 * "until opening tomorrow".
 *
 * Conventions (the database's app.* time functions follow the same ones; supabase/tests compares them):
 * - Weekday 0 = Sunday … 6 = Saturday (JavaScript getUTCDay, Postgres extract(dow)).
 * - A window `{ days, from, to }` belongs to the day it OPENS on. When `to <= from` it ends on the next day
 *   (22:00–02:00 runs into the night; 00:00–00:00 is a full 24 hours).
 * - A closure (a closed date) removes the windows that open on that date; a window from the evening before that
 *   runs past midnight into a closed date still counts.
 * - A local time that does not exist (the spring-forward gap) is read with the offset in force before the change,
 *   so 02:30 on the night clocks go forward is 03:30 summer time. A local time that happens twice (the autumn
 *   overlap) is the second one (standard time). This is exactly what PostgreSQL does with
 *   `timestamp AT TIME ZONE zone`.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
/** 'HH:MM', 00:00–23:59. */
export type HHMM = string;
/** 'YYYY-MM-DD' in the venue's time zone. */
export type LocalDate = string;

export type TimeWindow = { readonly days: readonly Weekday[]; readonly from: HHMM; readonly to: HHMM };
export type Closure = { readonly from: LocalDate; readonly to: LocalDate };
export type VenueHours = {
  readonly timeZone: string;
  /** Empty = no hours set: the venue is never considered closed. */
  readonly weekly: readonly TimeWindow[];
  readonly closures: readonly Closure[];
};

export const DEFAULT_TIME_ZONE = 'Asia/Jerusalem';
export const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const MINUTE = 60_000;
const DAY_MS = 86_400_000;

export const isHHMM = (v: unknown): v is HHMM => typeof v === 'string' && HHMM_RE.test(v);
export function isLocalDate(v: unknown): v is LocalDate {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
export const isWeekday = (v: unknown): v is Weekday => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 6;

const zoneOk = new Map<string, boolean>();
export function isTimeZone(tz: unknown): tz is string {
  if (typeof tz !== 'string' || tz === '') return false;
  let ok = zoneOk.get(tz);
  if (ok === undefined) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      ok = true;
    } catch {
      ok = false;
    }
    zoneOk.set(tz, ok);
  }
  return ok;
}

export const minutesOf = (t: HHMM): number => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

type Wall = { y: number; mo: number; d: number; h: number; mi: number; s: number };
function wall(ms: number, tz: string): Wall {
  const out: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return { y: out.year!, mo: out.month!, d: out.day!, h: out.hour! % 24, mi: out.minute!, s: out.second! };
}

/** The zone's offset from UTC at an instant, in milliseconds (+3 h = 10 800 000). */
export function offsetAt(ms: number, tz: string): number {
  const w = wall(ms, tz);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000;
}

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

export type LocalParts = { readonly date: LocalDate; readonly weekday: Weekday; readonly minutes: number };
export function localParts(at: Date | number, tz: string): LocalParts {
  const w = wall(typeof at === 'number' ? at : at.getTime(), tz);
  const date = `${pad(w.y, 4)}-${pad(w.mo)}-${pad(w.d)}`;
  return { date, weekday: weekdayOf(date), minutes: w.h * 60 + w.mi };
}

export function weekdayOf(date: LocalDate): Weekday {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as Weekday;
}

export function addDays(date: LocalDate, n: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return `${pad(t.getUTCFullYear(), 4)}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** The instant (epoch ms) of a wall-clock time on a local date, with the gap/overlap rule above. */
export function zonedTime(date: LocalDate, time: HHMM, tz: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const h = Number(time.slice(0, 2));
  const mi = Number(time.slice(3, 5));
  const naive = Date.UTC(y, m - 1, d, h, mi);
  // The offsets in force a day before and a day after: at most one transition sits between them.
  const before = offsetAt(naive - DAY_MS, tz);
  const after = offsetAt(naive + DAY_MS, tz);
  const fits = (o: number): boolean => {
    const w = wall(naive - o, tz);
    return w.y === y && w.mo === m && w.d === d && w.h === h && w.mi === mi;
  };
  const hits = [...new Set([before, after])].filter(fits).map((o) => naive - o);
  if (hits.length === 0) return naive - before; // the gap: read with the offset before the change
  return Math.max(...hits); // one answer, or the overlap's later instant (standard time)
}

export type Interval = { readonly start: number; readonly end: number };

/** The concrete intervals of the windows that open on one local date. */
export function windowsOn(windows: readonly TimeWindow[], date: LocalDate, tz: string): Interval[] {
  const wd = weekdayOf(date);
  const out: Interval[] = [];
  for (const w of windows) {
    if (!w.days.includes(wd)) continue;
    const overnight = minutesOf(w.to) <= minutesOf(w.from);
    out.push({ start: zonedTime(date, w.from, tz), end: zonedTime(overnight ? addDays(date, 1) : date, w.to, tz) });
  }
  return out.sort((a, b) => a.start - b.start);
}

export const isClosedOn = (closures: readonly Closure[], date: LocalDate): boolean =>
  closures.some((c) => c.from <= date && date <= c.to);

/** Is the venue open at this instant? No hours set = always open. */
export function isOpenAt(hours: VenueHours, at: Date | number): boolean {
  if (hours.weekly.length === 0) return true;
  const t = typeof at === 'number' ? at : at.getTime();
  const today = localParts(t, hours.timeZone).date;
  for (const day of [addDays(today, -1), today]) {
    if (isClosedOn(hours.closures, day)) continue;
    for (const iv of windowsOn(hours.weekly, day, hours.timeZone)) if (iv.start <= t && t < iv.end) return true;
  }
  return false;
}

/** The start of the next opening strictly after `after`, skipping closed dates; null when none within `horizonDays`. */
export function nextOpening(hours: VenueHours, after: Date | number, horizonDays = 14): Date | null {
  if (hours.weekly.length === 0) return null;
  const t = typeof after === 'number' ? after : after.getTime();
  const today = localParts(t, hours.timeZone).date;
  for (let i = 0; i <= horizonDays; i++) {
    const day = addDays(today, i);
    if (isClosedOn(hours.closures, day)) continue;
    const next = windowsOn(hours.weekly, day, hours.timeZone).find((iv) => iv.start > t);
    if (next) return new Date(next.start);
  }
  return null;
}

/** The start of the next local day (00:00) after an instant. */
export const startOfNextDay = (at: Date | number, tz: string): Date =>
  new Date(zonedTime(addDays(localParts(at, tz).date, 1), '00:00', tz));

/** A schedule's windows and optional validity dates (a day part, or a special on chosen days). */
export type ScheduleTimes = {
  readonly windows: readonly TimeWindow[];
  readonly validFrom: LocalDate | null;
  readonly validTo: LocalDate | null;
};

const validOn = (s: ScheduleTimes, date: LocalDate): boolean =>
  (s.validFrom === null || s.validFrom <= date) && (s.validTo === null || date <= s.validTo);

/** Is a schedule in effect at this instant? */
export function inSchedule(s: ScheduleTimes, at: Date | number, tz: string): boolean {
  const t = typeof at === 'number' ? at : at.getTime();
  const today = localParts(t, tz).date;
  for (const day of [addDays(today, -1), today]) {
    if (!validOn(s, day)) continue;
    for (const iv of windowsOn(s.windows, day, tz)) if (iv.start <= t && t < iv.end) return true;
  }
  return false;
}

/** When a schedule next starts, strictly after `after`; null when not within `horizonDays`. */
export function nextScheduleStart(s: ScheduleTimes, after: Date | number, tz: string, horizonDays = 14): Date | null {
  const t = typeof after === 'number' ? after : after.getTime();
  const today = localParts(t, tz).date;
  for (let i = 0; i <= horizonDays; i++) {
    const day = addDays(today, i);
    if (!validOn(s, day)) continue;
    const next = windowsOn(s.windows, day, tz).find((iv) => iv.start > t);
    if (next) return new Date(next.start);
  }
  return null;
}

/** Is an instant inside a simple days/from/to condition (an upsell rule's "when")? */
export function inWindow(w: { days: readonly Weekday[]; from: HHMM | null; to: HHMM | null }, at: Date | number, tz: string): boolean {
  const days = w.days.length === 0 ? ([0, 1, 2, 3, 4, 5, 6] as const) : w.days;
  if (w.from === null || w.to === null) return days.includes(localParts(at, tz).weekday);
  return inSchedule({ windows: [{ days, from: w.from, to: w.to }], validFrom: null, validTo: null }, at, tz);
}

/** How long an availability override lasts, as the owner chose it. */
export type UntilSpec =
  | { readonly kind: 'duration'; readonly minutes: number }
  | { readonly kind: 'time'; readonly at: HHMM }
  | { readonly kind: 'next_opening' }
  | { readonly kind: 'date'; readonly date: LocalDate }
  | { readonly kind: 'indefinite' };

export const MAX_DURATION_MINUTES = 60 * 24 * 30;

/**
 * When an override that starts `now` ends (null = indefinitely). The database computes the same moment when the
 * override is stored (app.resolve_until), so the restore happens by the clock with no job.
 * - duration: now + minutes (absolute time; a DST change does not stretch it);
 * - time: the next time the wall clock shows HH:MM (today, or tomorrow when it has passed);
 * - next_opening: the next opening after now, skipping closed dates; without hours, the start of tomorrow;
 * - date: 00:00 of that local date (back on that day).
 */
export function resolveUntil(spec: UntilSpec, now: Date | number, hours: VenueHours): Date | null {
  const t = typeof now === 'number' ? now : now.getTime();
  const tz = hours.timeZone;
  switch (spec.kind) {
    case 'duration':
      return new Date(t + spec.minutes * MINUTE);
    case 'time': {
      const today = localParts(t, tz).date;
      const at = zonedTime(today, spec.at, tz);
      return new Date(at > t ? at : zonedTime(addDays(today, 1), spec.at, tz));
    }
    case 'next_opening':
      return nextOpening(hours, t) ?? startOfNextDay(t, tz);
    case 'date':
      return new Date(zonedTime(spec.date, '00:00', tz));
    case 'indefinite':
      return null;
  }
}
