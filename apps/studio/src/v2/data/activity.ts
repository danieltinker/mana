// The activity log in plain words (F08, F11, D25): who (you, someone on your team, Halom, or the system), what, and when,
// on the venue's clock, from venue_activity's entries (ActivityEntry, @mana/contracts). Halom's staff are never named:
// a staff entry reads "Halom", with the reason Halom gave. The log keeps ids, numbers, codes and times, never the words a
// person typed, so a name is the one the RPC sends (`targetName`, read from the row now) and nothing else; a price
// change is said from its numbers. Sentences avoid verbs that agree with the actor (Hebrew conjugates by person and
// gender): "Dish changed: Coffee", by "You". Browser-free (it reads the current language).
import {
  ACT_FOR_OWNER_ACTIONS, CASE_STATUSES, IMPORT_STATUSES, ONBOARDING_STATES, ONBOARDING_STEPS, TARGET_KINDS, activityChanges, addDays, localParts, oneOf, type ActivityEntry, type LocalDate,
} from '@mana/contracts';
import { shekels } from '../format.ts';
import { lang, t } from '../i18n.ts';
import { dateText, ltr } from '../words.ts';

export type Who = 'you' | 'team' | 'halom' | 'system';

/** Halom first: a staff entry is Halom's whoever reads it. */
export const whoOf = (e: Pick<ActivityEntry, 'actorKind' | 'you'>): Who =>
  e.actorKind === 'staff' ? 'halom' : e.you ? 'you' : e.actorKind === 'system' ? 'system' : 'team';

export type ActivityWords = {
  readonly who: Who;
  readonly whoText: string;
  /** What happened, with the name of what it happened to when the RPC sent one. */
  readonly what: string;
  /** More about it: a price's before and after, what was hidden, which details changed ('' when nothing to add). */
  readonly details: string;
  /** The reason Halom gave (shown to the owner, D25). */
  readonly reason: string | null;
  /** 'HH:MM' on the venue's clock. */
  readonly time: string;
  /** The venue's local date, for grouping by day. */
  readonly day: LocalDate;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const hm = (minutes: number) => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');

function nameOf(e: ActivityEntry): string {
  const n = e.targetName;
  if (!n) return '';
  const L = lang.value;
  return (L === 'he' ? n.he || n.en : n.en || n.he) || '';
}

/** "Dish added", "3 dishes added", "Section deleted": a table's rows, in words that need no verb agreement. */
function rowsWords(table: string, op: string, n: number): string {
  if (n > 1) return t(`acto.${op}.n`, { n, x: t(`actn.${table}.n`) });
  return t(`acto.${op}`, { x: t(`actn.${table}`) });
}

/** A changed column, in words; the two languages of one field are one word ("name"). */
const COLUMN_WORD: Readonly<Record<string, string>> = {
  name_he: 'name', name_en: 'name', label: 'name', desc_he: 'desc', desc_en: 'desc', price_note_he: 'price_note', price_note_en: 'price_note',
  allergens_he: 'allergens', allergens_en: 'allergens', line_he: 'line', line_en: 'line', tags: 'tags', position: 'position', section_id: 'section_id',
  schedule_id: 'schedule_id', min_units: 'limits', max_units: 'limits', opens: 'hours', closes: 'hours', weekday: 'day', from_date: 'dates',
  to_date: 'dates', priority: 'position', price: 'price',
};

function priceWords(before: unknown, after: unknown): string {
  const say = (v: unknown) => { const a = num(v); return a === null ? t('actd.noPrice') : ltr(shekels(a)); };
  return t('actd.price', { from: say(before), to: say(after) });
}

/** An update of one or more rows: what changed, as far as the log kept it. */
function updateDetails(e: ActivityEntry): string {
  const { columns, changes } = activityChanges(e);
  const parts: string[] = [];
  const said = new Set<string>();
  if ('price' in changes) { parts.push(priceWords(changes.price![0], changes.price![1])); said.add('price'); }
  if ('hidden' in changes) { parts.push(t(changes.hidden![1] === true ? 'actd.hidden' : 'actd.shown')); said.add('hidden'); }
  if ('active' in changes) { parts.push(t(changes.active![1] === true ? 'actd.on' : 'actd.off')); said.add('active'); }
  const words: string[] = [];
  let other = false;
  for (const c of columns) {
    if (said.has(c)) continue;
    const w = COLUMN_WORD[c];
    if (!w) { other = true; continue; }
    const text = t('actc.' + w);
    if (!words.includes(text)) words.push(text);
  }
  if (other) words.push(t('actc.other'));
  if (words.length) parts.push(t('actd.changed', { x: words.join(', ') }));
  return parts.join(' · ');
}

/** What happened, and more about it. */
function whatOf(e: ActivityEntry, timeZone: string, day: LocalDate): { what: string; details: string } {
  const d = e.detail, name = nameOf(e);
  const withName = (s: string) => (name ? `${s}: ${name}` : s);
  const [table, op] = e.action.split('.') as [string, string];

  switch (e.action) {
    case 'menu.publish': return { what: t('actv.menu.publish', { n: num(d.revision) ?? '' }), details: '' };
    case 'menu.restore': return { what: t('actv.menu.restore', { n: num(d.revision) ?? '' }), details: '' };
    case 'menu.read': return { what: t('actv.menu.read', { n: num(d.revision) ?? '' }), details: '' };
    case 'support.act_for_owner': {
      const a = str(d.action);
      return { what: t('actv.support.act_for_owner', { x: oneOf(ACT_FOR_OWNER_ACTIONS, a) ? t('afo.' + a) : t('actv.other') }), details: '' };
    }
    case 'upsell_rules.deactivated':
      return { what: e.n > 1 ? t('actv.upsell_rules.deactivated.n', { n: e.n }) : withName(t('actv.upsell_rules.deactivated')), details: '' };
    case 'venue.set_demo': return { what: t(d.demo === true ? 'actv.venue.set_demo.on' : 'actv.venue.set_demo.off'), details: '' };
    case 'venue.create': case 'venue.approve': case 'plan.set': case 'menu.unpublish': case 'menu.export': case 'import.apply':
    case 'staff.join': case 'staff_invite.create': case 'leads.read':
      return { what: t('actv.' + e.action), details: '' };

    case 'availability_overrides.insert': {
      if (e.n > 1) return { what: t('acta.off.n', { n: e.n }), details: '' };
      const kind = str(d.target_kind);
      const until = str(d.until_at);
      const when = until ? t('acta.until', { when: momentWords(until, timeZone, day) }) : t('acta.untilBack');
      return { what: t('acta.off', { x: oneOf(TARGET_KINDS, kind) ? t('actk.' + kind) : t('actk.other') }), details: when };
    }
    case 'availability_overrides.update': {
      const { columns } = activityChanges(e);
      if (columns.includes('restored_at')) return { what: e.n > 1 ? t('acta.back.n', { n: e.n }) : t('acta.back'), details: '' };
      break;
    }
    case 'support_cases.insert': return { what: t('acta.case.open'), details: '' };
    case 'support_cases.update': {
      const s = str(activityChanges(e).changes.status?.[1]);
      return { what: oneOf(CASE_STATUSES, s) ? t('acta.case.status', { status: t('case.' + s) }) : t('acta.case.update'), details: '' };
    }
    case 'venues.update': {
      const { columns, changes } = activityChanges(e);
      if (changes.support_can_act) return { what: t(changes.support_can_act[1] === true ? 'acta.canAct.on' : 'acta.canAct.off'), details: '' };
      if (columns.includes('approved_at')) return { what: t('actv.venue.approve'), details: '' };
      return { what: t('acta.venue'), details: '' };
    }
    case 'onboarding_progress.insert':
    case 'onboarding_progress.update': {
      if (e.n > 1) break;
      // the row's key is "<venue>/<step>"; a one-row insert also keeps the step itself
      const step = str(d.step) || (e.targetIds[0] ?? '').split('/').pop() || '';
      const state = op === 'insert' ? str(d.state) : str(activityChanges(e).changes.state?.[1]);
      if (!oneOf(ONBOARDING_STEPS, step)) break;
      return { what: t('acta.step', { step: t('step.' + step) }), details: oneOf(ONBOARDING_STATES, state) ? t('stepstate.' + state) : '' };
    }
    case 'menu_imports.insert': return { what: t('acta.import.new'), details: '' };
    case 'menu_imports.update': {
      const s = str(activityChanges(e).changes.status?.[1]);
      if (oneOf(IMPORT_STATUSES, s)) return { what: t('acta.import.status', { status: t('importstate.' + s) }), details: '' };
      break;
    }
  }
  if (op === 'insert' || op === 'update' || op === 'delete') {
    const what = rowsWords(table, op, e.n);
    return { what: e.n > 1 ? what : withName(what), details: op === 'update' ? updateDetails(e) : '' };
  }
  return { what: withName(t('actv.other')), details: '' };
}

/** An override's end on the venue's clock: "15:30" on the entry's own day, else "16 October, 15:30". */
function momentWords(iso: string, timeZone: string, day: LocalDate): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return '';
  const p = localParts(at, timeZone);
  return p.date === day ? hm(p.minutes) : t('actw.dayAt', { day: dateText(p.date, false), time: hm(p.minutes) });
}

export function activityWords(e: ActivityEntry, timeZone: string): ActivityWords {
  const who = whoOf(e);
  const p = localParts(Date.parse(e.at), timeZone);
  const { what, details } = whatOf(e, timeZone, p.date);
  return { who, whoText: t('who.' + who), what, details, reason: e.reason && e.reason.trim() ? e.reason : null, time: hm(p.minutes), day: p.date };
}

/** A day's heading: "Today", "Yesterday", or the date ("Monday 13 October"). */
export function dayTitle(day: LocalDate, now: number, timeZone: string): string {
  const today = localParts(now, timeZone).date;
  if (day === today) return t('actw.today');
  if (day === addDays(today, -1)) return t('actw.yesterday');
  return dateText(day);
}
