// Opening hours, closed dates and schedules (day parts such as breakfast, specials on chosen days): stored rows ↔ what
// the owner edits, with the checks the database makes (app.windows_ok and the tables' own checks), and the venue's hours
// in the contracts' shape, as public_menu builds the live overlay, so "open now" here is what the guest sees. Pure.
import { LIMITS, SCHEDULE_KINDS, isBlank, isHHMM, isLocalDate, isWeekday, minutesOf, oneOf, stripBlank, textLength } from '@mana/contracts';
import type { HHMM, ScheduleKind, ScheduleRow, TimeWindow, VenueClosureRow, VenueHours, VenueHoursRow, Weekday } from '@mana/contracts';
import type { FieldError, Mapped } from './forms.ts';

/** Sunday first, as the week runs in Israel (weekday 0 = Sunday, as in the contracts and Postgres). */
export const WEEK: readonly Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const DAY = 1440;
const WEEK_MIN = 7 * DAY;
/** A schedule's or a closure's name and note: the schema's lengths, in code points (the contracts' textLength). */
const SCHEDULE_NAME = 60;
const CLOSURE_NOTE = 80;
/** The schema's longest closure (`to_date - from_date <= 366`). */
const CLOSURE_DAYS = 366;

const done = <T>(errors: FieldError[], value: T): Mapped<T> => (errors.length ? { ok: false, errors } : { ok: true, value });

/** 'HH:MM:SS' as Postgres returns a time → 'HH:MM'. */
export const hhmm = (t: string): HHMM => t.slice(0, 5);

/** The venue's hours as the guest's phone gets them (public_menu's live overlay): one window per stored row. */
export function venueHoursOf(timeZone: string, hours: readonly VenueHoursRow[], closures: readonly VenueClosureRow[]): VenueHours {
  return {
    timeZone,
    weekly: [...hours].sort((a, b) => a.weekday - b.weekday || (a.opens < b.opens ? -1 : 1)).map((h) => ({ days: [h.weekday], from: hhmm(h.opens), to: hhmm(h.closes) })),
    closures: [...closures].sort((a, b) => (a.from_date < b.from_date ? -1 : 1)).map((c) => ({ from: c.from_date, to: c.to_date })),
  };
}

/** One day's opening windows, earliest first. */
export const dayHours = (rows: readonly VenueHoursRow[], weekday: Weekday): VenueHoursRow[] =>
  rows.filter((r) => r.weekday === weekday).sort((a, b) => (a.opens < b.opens ? -1 : a.opens > b.opens ? 1 : 0));

/** A window as minutes of the week: it opens on its day and, when `to <= from`, runs into the next (00:00–00:00 is 24 h). */
function weekSpan(day: Weekday, from: HHMM, to: HHMM): [number, number] {
  const a = minutesOf(from), b = minutesOf(to);
  const start = day * DAY + a;
  return [start, start + (b <= a ? b + DAY - a : b - a)];
}
const meets = (x: [number, number], y: [number, number]) => [-WEEK_MIN, 0, WEEK_MIN].some((k) => x[0] < y[1] + k && y[0] + k < x[1]);

export type HoursWrite = { weekday: Weekday; opens: HHMM; closes: HHMM };

/** The same opening and closing time: open the whole 24 hours (not a slip the owner should be left to guess at). */
export const isAllDay = (from: string, to: string): boolean => isHHMM(from) && from === to;

/**
 * Opening hours from..to on some days, checked against the windows already stored (less the one being changed). Two
 * windows may not overlap, also across midnight (Friday 22:00–02:00 and Saturday 01:00–…). Codes: days_empty,
 * time_invalid, hours_overlap (another window that day), hours_overlap_night (the night before's window runs past
 * midnight into these hours), hours_overlap_next (these hours run past midnight into the next day's). The same time
 * twice (08:00–08:00) is a full 24 hours, as the contracts read it (`isAllDay` says so on screen).
 */
export function hoursFromForm(days: readonly Weekday[], from: string, to: string, stored: readonly VenueHoursRow[], exceptId: string | null = null): Mapped<HoursWrite[]> {
  const errors: FieldError[] = [];
  const picked = WEEK.filter((d) => days.includes(d));
  if (picked.length === 0 || !days.every(isWeekday)) errors.push({ field: 'days', code: 'days_empty' });
  if (!isHHMM(from) || !isHHMM(to)) errors.push({ field: 'time', code: 'time_invalid' });
  if (errors.length) return { ok: false, errors };
  const others = stored.filter((r) => r.id !== exceptId).map((r) => ({ day: r.weekday, span: weekSpan(r.weekday, hhmm(r.opens), hhmm(r.closes)) }));
  // the same window on different days never meets itself (it lasts 24 hours at most)
  const hit = picked.flatMap((d) => others.filter((o) => meets(weekSpan(d, from, to), o.span)).map((o) => (o.day === d ? 0 : o.day === (d + 6) % 7 ? -1 : 1)));
  if (hit.length) errors.push({ field: 'time', code: hit.includes(0) ? 'hours_overlap' : hit.includes(-1) ? 'hours_overlap_night' : 'hours_overlap_next' });
  return done(errors, picked.map((weekday) => ({ weekday, opens: from, closes: to })));
}

// ---------------------------------------------------------------- closed dates: holidays, a one-off closure
export type ClosureForm = { from: string; to: string; noteHe: string; noteEn: string };
export type ClosureWrite = Pick<VenueClosureRow, 'from_date' | 'to_date' | 'note_he' | 'note_en'>;

/** One day, today; "to" stays empty (the same day) until the owner picks a longer closure. */
export const newClosureForm = (today: string): ClosureForm => ({ from: today, to: '', noteHe: '', noteEn: '' });

const dayNumber = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000;

/** Codes: date_invalid, date_order, range_too_long, too_long. An empty "to" is the same day. */
export function closureFromForm(f: ClosureForm): Mapped<ClosureWrite> {
  const errors: FieldError[] = [];
  const to = f.to === '' ? f.from : f.to;
  if (!isLocalDate(f.from)) errors.push({ field: 'from', code: 'date_invalid' });
  if (!isLocalDate(to)) errors.push({ field: 'to', code: 'date_invalid' });
  else if (isLocalDate(f.from) && to < f.from) errors.push({ field: 'to', code: 'date_order' });
  else if (isLocalDate(f.from) && dayNumber(to) - dayNumber(f.from) > CLOSURE_DAYS) errors.push({ field: 'to', code: 'range_too_long' });
  const noteHe = stripBlank(f.noteHe), noteEn = stripBlank(f.noteEn);
  if (textLength(noteHe) > CLOSURE_NOTE) errors.push({ field: 'note_he', code: 'too_long' });
  if (textLength(noteEn) > CLOSURE_NOTE) errors.push({ field: 'note_en', code: 'too_long' });
  return done(errors, { from_date: f.from, to_date: to, note_he: noteHe, note_en: noteEn });
}

/** Closures that still matter (ending today or later), soonest first; the past ones stay stored as history. */
export const upcomingClosures = (rows: readonly VenueClosureRow[], today: string): VenueClosureRow[] =>
  rows.filter((c) => c.to_date >= today).sort((a, b) => (a.from_date < b.from_date ? -1 : a.from_date > b.from_date ? 1 : 0));

// ---------------------------------------------------------------- schedules: a day part (breakfast until 12:00), a special (Wednesdays)
export type WindowForm = { key: string; days: Weekday[]; from: string; to: string };
export type ScheduleForm = { kind: ScheduleKind; nameHe: string; nameEn: string; windows: WindowForm[]; validFrom: string; validTo: string };
export type ScheduleWrite = Pick<ScheduleRow, 'kind' | 'name_he' | 'name_en' | 'windows' | 'valid_from' | 'valid_to'>;

let seq = 0;
export const newWindowForm = (days: readonly Weekday[] = WEEK, from = '07:00', to = '12:00'): WindowForm => ({ key: 'w-' + ++seq, days: [...days], from, to });
/** A day part runs every day (breakfast 07:00–12:00); a special runs on the days the owner picks. */
export const newScheduleForm = (kind: ScheduleKind = 'day_part'): ScheduleForm => ({
  kind, nameHe: '', nameEn: '', windows: [kind === 'day_part' ? newWindowForm() : newWindowForm([3], '12:00', '16:00')], validFrom: '', validTo: '',
});

export const scheduleToForm = (r: ScheduleRow): ScheduleForm => ({
  kind: r.kind, nameHe: r.name_he, nameEn: r.name_en, validFrom: r.valid_from ?? '', validTo: r.valid_to ?? '',
  windows: r.windows.map((w) => ({ key: 'w-' + ++seq, days: WEEK.filter((d) => w.days.includes(d)), from: w.from, to: w.to })),
});

/**
 * Codes: name_missing (one language at least: the owner picks it by name), too_long, enum_invalid, windows_empty,
 * too_many, days_empty, time_invalid, date_invalid, date_order. Windows keep the order the owner gave them.
 */
export function scheduleFromForm(f: ScheduleForm): Mapped<ScheduleWrite> {
  const errors: FieldError[] = [];
  const he = stripBlank(f.nameHe), en = stripBlank(f.nameEn);
  if (textLength(he) > SCHEDULE_NAME) errors.push({ field: 'name_he', code: 'too_long' });
  if (textLength(en) > SCHEDULE_NAME) errors.push({ field: 'name_en', code: 'too_long' });
  if (isBlank(he) && isBlank(en)) errors.push({ field: 'name', code: 'name_missing' });
  if (!oneOf(SCHEDULE_KINDS, f.kind)) errors.push({ field: 'kind', code: 'enum_invalid' });
  if (f.windows.length === 0) errors.push({ field: 'windows', code: 'windows_empty' });
  if (f.windows.length > LIMITS.windows) errors.push({ field: 'windows', code: 'too_many' });
  const windows: TimeWindow[] = f.windows.map((w, i) => {
    const days = WEEK.filter((d) => w.days.includes(d));
    if (days.length === 0) errors.push({ field: `windows.${i}.days`, code: 'days_empty' });
    if (!isHHMM(w.from) || !isHHMM(w.to)) errors.push({ field: `windows.${i}.time`, code: 'time_invalid' });
    return { days, from: w.from, to: w.to };
  });
  const from = f.validFrom === '' ? null : f.validFrom, to = f.validTo === '' ? null : f.validTo;
  if (from !== null && !isLocalDate(from)) errors.push({ field: 'validFrom', code: 'date_invalid' });
  if (to !== null && !isLocalDate(to)) errors.push({ field: 'validTo', code: 'date_invalid' });
  else if (from !== null && to !== null && isLocalDate(from) && to < from) errors.push({ field: 'validTo', code: 'date_order' });
  return done(errors, { kind: f.kind, name_he: he, name_en: en, windows, valid_from: from, valid_to: to });
}
