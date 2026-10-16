// How rules, hours and "until" read in the owner's language: an upsell rule in one plain line ("After Coffee, suggest
// Croissant, 7–11"), days of the week, times, dates, and the moment something comes back, on the venue's clock.
// Browser-free (it reads the current language), so the tests read the same sentences the screens show.
import { addDays, localParts } from '@mana/contracts';
import type { HHMM, LocalDate, UpsellRuleRow, Weekday } from '@mana/contracts';
import { WEEK } from './data/hours.ts';
import { lang, t } from './i18n.ts';

/** Kept left to right inside a Hebrew sentence (a range "7–11" would otherwise read "11–7"). */
export const ltr = (s: string): string => '\u2066' + s + '\u2069';
/** A range's dash, held to both ends (word joiners): "7–11" never breaks across two lines. */
const DASH = '\u2060–\u2060';

/** '07:00' → '7', '07:30' → '7:30': a rule's hours, said short. */
export function shortTime(t: HHMM): string {
  const h = Number(t.slice(0, 2)), m = t.slice(3, 5);
  return m === '00' ? String(h) : `${h}:${m}`;
}
export const timeRange = (from: HHMM, to: HHMM, short = false): string => ltr((short ? shortTime(from) : from) + DASH + (short ? shortTime(to) : to));

export const dayName = (d: Weekday, long = false): string => t((long ? 'dayl.' : 'day.') + d);

/** "Sun–Thu", "Mon, Wed", "Fri–Sun", or "every day": three days or more in a row are a range, Saturday runs into Sunday. */
export function daysText(days: readonly Weekday[]): string {
  const set = new Set(days);
  if (set.size === 0 || set.size === WEEK.length) return t('days.every');
  const start = WEEK.find((d) => set.has(d) && !set.has(((d + 6) % 7) as Weekday))!;
  const runs: Weekday[][] = [];
  for (let i = 0; i < 7; i++) {
    const d = ((start + i) % 7) as Weekday;
    if (!set.has(d)) continue;
    const last = runs[runs.length - 1];
    if (last && (last[last.length - 1]! + 1) % 7 === d) last.push(d); else runs.push([d]);
  }
  return runs.map((r) => (r.length >= 3 ? dayName(r[0]!) + '–' + dayName(r[r.length - 1]!) : r.map((d) => dayName(d)).join(', '))).join(', ');
}

/** "A", "A or B", "A, B or C". */
export function orList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return t('w.or', { a: names.slice(0, -1).join(', '), b: names[names.length - 1]! });
}

// ---------------------------------------------------------------- an upsell rule in one line
export type RuleWords = Pick<UpsellRuleRow, 'trigger' | 'scope_kind' | 'scope_ids' | 'days' | 'from_time' | 'to_time' | 'basket_has_dishes'
  | 'basket_has_sections' | 'basket_lacks_dishes' | 'basket_lacks_sections' | 'suggest_kind' | 'suggest_dish_id' | 'suggest_option_id'>;
/** A name in the current language ('' when the row is gone). */
export type NameOf = (kind: 'dish' | 'section' | 'option', id: string) => string;

/**
 * "After Coffee, suggest Croissant, 7–11"; "At checkout, if the basket has no Drinks, suggest Lemonade"; "When Pasta
 * is opened, suggest the add-on Parmesan, Fri–Sat". Something since deleted reads as such, never as nothing.
 */
export function ruleSummary(r: RuleWords, name: NameOf): string {
  const list = (dishes: readonly string[], sections: readonly string[]) => {
    const names = [...sections.map((id) => name('section', id)), ...dishes.map((id) => name('dish', id))].filter(Boolean);
    return names.length ? orList(names) : t('rs.gone');
  };
  const parts: string[] = [];
  if (r.scope_kind === 'all') parts.push(t(`rs.${r.trigger}.all`));
  else if (r.scope_kind === 'section') parts.push(t(`rs.${r.trigger}.section`, { x: list([], r.scope_ids) }));
  else parts.push(t(`rs.${r.trigger}.some`, { x: list(r.scope_ids, []) }));
  if (r.basket_has_dishes.length + r.basket_has_sections.length) parts.push(t('rs.has', { x: list(r.basket_has_dishes, r.basket_has_sections) }));
  if (r.basket_lacks_dishes.length + r.basket_lacks_sections.length) parts.push(t('rs.lacks', { x: list(r.basket_lacks_dishes, r.basket_lacks_sections) }));
  if (r.suggest_kind === 'dish') parts.push(t('rs.suggest', { x: (r.suggest_dish_id && name('dish', r.suggest_dish_id)) || t('rs.gone') }));
  else parts.push(t('rs.suggestOption', { x: (r.suggest_option_id && name('option', r.suggest_option_id)) || t('rs.gone') }));
  const some = r.days.length > 0 && r.days.length < WEEK.length;
  const from = r.from_time?.slice(0, 5), to = r.to_time?.slice(0, 5);
  // a window past midnight on chosen days runs into the day after: "Fri 22–02 (into Sat)"
  const into = some && from && to && to <= from ? (r.days.length === 1 ? t('rs.into', { day: dayName(((r.days[0]! + 1) % 7) as Weekday, true) }) : t('rs.intoNext')) : '';
  const when = [some ? daysText(r.days) : '', from && to ? timeRange(from, to, true) : '', into].filter(Boolean).join(' ');
  if (when) parts.push(when);
  return parts.join(', ');
}

// ---------------------------------------------------------------- moments on the venue's clock
const hm = (minutes: number): HHMM => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');

/** A local date in words: "Friday 25 December" / "יום שישי, 25 בדצמבר". */
export function dateText(d: LocalDate, withDay = true): string {
  const at = new Date(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))));
  return new Intl.DateTimeFormat(lang.value === 'he' ? 'he-IL' : 'en-GB', withDay ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' } : { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(at);
}

/**
 * A moment said from `now`: "15:30" today ("today at 15:30" with `sayToday`), "tomorrow at 07:00", "Sunday at 07:00"
 * within the week, the date after that; midnight is said as the day alone ("tomorrow", "Sunday": back on that day).
 */
export function momentText(at: Date | number, now: Date | number, timeZone: string, sayToday = false): string {
  const a = localParts(at, timeZone), n = localParts(now, timeZone);
  const time = hm(a.minutes);
  if (a.date === n.date) return sayToday ? t('w.todayAt', { time }) : time;
  const midnight = a.minutes === 0;
  if (a.date === addDays(n.date, 1)) return midnight ? t('w.tomorrow') : t('w.tomorrowAt', { time });
  const inWeek = [2, 3, 4, 5, 6].some((k) => addDays(n.date, k) === a.date);
  const day = inWeek ? t('w.onDay', { day: dayName(a.weekday, true) }) : dateText(a.date, false);
  return midnight ? day : t('w.dayAt', { day, time });
}
