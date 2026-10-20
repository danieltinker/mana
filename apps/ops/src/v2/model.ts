/**
 * Pure logic of the v2 back office: no DOM, no network. Words for every code the contracts define, the warning chips,
 * the timeline's strands and days, what an activity entry says, the guest's menu as staff read it, and the analytics
 * ranges. Unit-tested in test/v2/model.test.ts.
 */
import {
  ACT_FOR_OWNER_ACTIONS, NAMED_ACTIONS, OPS_WARNINGS, TIMELINE_KINDS, activityChanges, addDays, allDishes, localParts, oneOf, timelineKind,
  type ActForOwnerAction, type ActivityEntry, type ActorKind, type AnalyticsResolution, type CaseStatus, type CaseTopic, type DemoScope,
  type EntitlementStatus, type EventName, type ImportExceptionCode, type ImportSource, type ImportStatus, type LiveOverlay, type NudgeCode,
  type OnboardingState, type OnboardingStep, type OpsAnalyticsQuery, type OpsVenueRow, type OpsWarning, type Plan, type ReviewState,
  type SnapshotV2, type TargetKind, type Text, type TimelineKind, type UntilSpec, type AddonGroupV2, type AssetV2, type IdMatch, type SelectionKind,
  type Tag, type TimeWindow, type Trigger, type UpsellRuleV2, type Weekday,
} from '@mana/contracts';

export const PRODUCT = { name: 'Mana', by: 'Halom' } as const;
export const TZ = 'Asia/Jerusalem';

// ---------------------------------------------------------------- routes

export type Route =
  | { readonly view: 'clients' }
  | { readonly view: 'venue'; readonly id: string }
  | { readonly view: 'analytics'; readonly venue: string | null }
  | { readonly view: 'leads' };

const decode = (s: string): string => { try { return decodeURIComponent(s); } catch { return ''; } };

/** The hash as a route; works under any path prefix. Never throws: a malformed address leads to a page that says it
 * found nothing (the venue page refuses an id that is not a uuid before it asks anything). */
export function parseRoute(hash: string): Route {
  const [path = '', qs = ''] = hash.replace(/^#\/?/, '').split('?');
  const seg = path.split('/').filter(Boolean);
  const q = new URLSearchParams(qs);
  if (seg[0] === 'venues' && seg[1]) return { view: 'venue', id: decode(seg[1]) };
  if (seg[0] === 'analytics') return { view: 'analytics', venue: q.get('venue') };
  if (seg[0] === 'leads') return { view: 'leads' };
  return { view: 'clients' };
}

// ---------------------------------------------------------------- numbers and times (Israel time)

const intFmt = new Intl.NumberFormat('en-US');
export const fmtInt = (n: number): string => intFmt.format(Number.isFinite(n) ? Math.round(n) : 0);
/** A share as a whole percent; '—' when there is nothing to divide by. */
export const fmtPct = (part: number, whole: number): string => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');
/** Agorot as shekels: ₪54, ₪54.50. */
export const fmtMoney = (agorot: number): string => `₪${agorot % 100 === 0 ? fmtInt(agorot / 100) : (agorot / 100).toFixed(2)}`;

const dtFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric' });
const dShort = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: 'numeric', month: 'short' });
const wdFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const hmFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const hmsFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const ms = (iso: string | null | undefined): number | null => { if (!iso) return null; const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };
const fmt = (f: Intl.DateTimeFormat) => (iso: string | null | undefined, empty = '—'): string => { const t = ms(iso); return t === null ? empty : f.format(t); };
export const fmtDateTime = fmt(dtFmt);
export const fmtDate = fmt(dFmt);
export const fmtDateShort = fmt(dShort);
export const fmtTime = fmt(hmFmt);
export const fmtClock = (t: number): string => hmsFmt.format(t);
/** A local date (YYYY-MM-DD) as "16 Oct"; with `weekday`, "Fri 16 Oct". */
export const fmtDay = (d: string, weekday = false): string => (weekday ? wdFmt : dShort).format(Date.parse(`${d}T12:00:00Z`));

export function ago(iso: string | null | undefined, now: number, never = 'never'): string {
  const t = ms(iso);
  if (t === null) return never;
  const s = Math.max(0, now - t) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 36 * 3600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}
/** The venue's local date of an instant (Israel unless the venue says otherwise). */
export const localDate = (t: number, tz = TZ): string => localParts(t, tz).date;

// ---------------------------------------------------------------- bilingual names

/** The name to show first (English, else Hebrew), and the other language when both exist and differ. */
export function names(t: Text | null | undefined, fallback = ''): { main: string; alt: string | null } {
  const he = (t?.he ?? '').trim(), en = (t?.en ?? '').trim();
  const main = en || he || fallback;
  return { main, alt: en && he && en !== he ? he : null };
}

// ---------------------------------------------------------------- words for the contracts' codes

export const STEP_LABEL: Readonly<Record<OnboardingStep, string>> = {
  venue: 'Venue', menu: 'Menu', review: 'Review the import', addons: 'Add-ons', photos: 'Photos', hours: 'Hours', style: 'Style', test: 'Test on a phone',
  publish: 'Publish',
};
export const stageLabel = (s: OnboardingStep | 'complete'): string => (s === 'complete' ? 'Onboarding complete' : STEP_LABEL[s]);
export const STATE_LABEL: Readonly<Record<OnboardingState, string>> = { todo: 'To do', doing: 'Doing', done: 'Done', skipped: 'Skipped', blocked: 'Blocked' };
export const REVIEW_LABEL: Readonly<Record<ReviewState, string>> = { not_requested: 'Not published yet', pending: 'Waiting for approval', approved: 'Approved' };
export const PLAN_LABEL: Readonly<Record<Plan, string>> = { trial: 'Trial', pilot: 'Pilot', paid: 'Paid' };
export const PLAN_STATE_LABEL: Readonly<Record<EntitlementStatus, string>> = {
  pending: 'not started', trialing: 'trial running', active: 'active', expired: 'expired', suspended: 'suspended',
};
export const CASE_STATUS_LABEL: Readonly<Record<CaseStatus, string>> = {
  open: 'Open', waiting_owner: 'Waiting for the owner', waiting_halom: 'Waiting for Halom', resolved: 'Resolved',
};
export const CASE_TOPIC_LABEL: Readonly<Record<CaseTopic, string>> = {
  onboarding: 'Onboarding', import: 'Menu import', menu: 'Menu', photos: 'Photos', account: 'Account', other: 'Other',
};
export const ACTOR_LABEL: Readonly<Record<ActorKind, string>> = { owner: 'Owner', manager: 'Manager', counter: 'Counter', staff: 'Halom', system: 'System' };
export const IMPORT_STATUS_LABEL: Readonly<Record<ImportStatus, string>> = {
  uploaded: 'Uploaded', parsing: 'Being read', parsed: 'Read, waiting for the owner', failed: 'Failed', applied: 'Applied', discarded: 'Discarded',
};
export const IMPORT_SOURCE_LABEL: Readonly<Record<ImportSource, string>> = {
  scan: 'Scan of a printed menu', paste: 'Pasted text', wolt_screenshots: 'Wolt screenshots', wolt_text: 'Wolt text',
};
export const EXCEPTION_LABEL: Readonly<Record<ImportExceptionCode, string>> = {
  price_missing: 'No price', price_unreadable: 'Price unreadable', price_zero: 'Price 0', option_price_unreadable: 'Add-on price unreadable',
  limits_guessed: 'Limits guessed', limits_unreachable: 'Minimum unreachable', section_duplicate: 'Section twice', dish_duplicate: 'Dish twice',
  dish_repeated: 'Dish repeated in another section', name_missing_lang: 'Names in one language only', translation_check: 'Translated: needs a native read',
  name_symbols: 'Name of symbols only',
  nesting_too_deep: 'Add-ons nested too deep', too_many: 'Over the limits', photo_rights_unknown: 'Photo rights not confirmed',
  allergens_check: 'Allergens to check', section_renamed: 'Section renamed?', dish_elsewhere: 'Dish already in another section',
  dish_other_kind: 'Same name, another kind of section', price_differs: 'Price differs from the menu', group_changed: 'Add-ons differ from the menu',
  opens_changed: 'Nested add-ons differ',
};
export const TARGET_LABEL: Readonly<Record<TargetKind, string>> = { section: 'Section', dish: 'Dish', option: 'Add-on' };
const A_TARGET: Readonly<Record<TargetKind, string>> = { section: 'a section', dish: 'a dish', option: 'an add-on' };
export const DEMO_LABEL: Readonly<Record<DemoScope, string>> = { exclude: 'Real traffic only', include: 'Real and demo', only: 'Demo only' };

/** Every action Halom may take for the owner, and `menu.publish`, which phase 0 offered: older log entries keep it. */
export const ACT_LABEL: Readonly<Record<ActForOwnerAction | 'menu.publish', string>> = {
  'availability.set': 'Take something off the menu for a while',
  'availability.restore': 'Bring something back on the menu',
  'dish.update': 'Change a dish (price, shown or hidden)',
  'menu.publish': 'Publish the menu',
  'onboarding.set': 'Mark an onboarding step',
  'support_case.update': 'Change a support case’s status',
};
export const isAct = (v: unknown): v is ActForOwnerAction => oneOf(ACT_FOR_OWNER_ACTIONS, v);

// ---------------------------------------------------------------- warnings as chips

export type Tone = 'plain' | 'info' | 'warn' | 'bad' | 'good';
export type Chip = { readonly code: string; readonly label: string; readonly tone: Tone; readonly hint: string };

const WARNING_CHIP: Readonly<Record<OpsWarning, Omit<Chip, 'code'>>> = {
  awaiting_review: { label: 'Waiting for approval', tone: 'warn', hint: 'The first publish waits for Halom; guests see "menu not available" until it is approved.' },
  stuck_step_2d: { label: 'Stuck 2+ days', tone: 'warn', hint: 'Onboarding is not complete and its next step has not moved for 2 days.' },
  not_published_2d: { label: 'Not published after 2 days', tone: 'warn', hint: 'Created more than 2 days ago and never published.' },
  no_publish_7d: { label: 'No publish in 7 days', tone: 'info', hint: 'Published before, but not in the last 7 days.' },
  import_failed: { label: 'Import failed', tone: 'bad', hint: 'An import failed in the last 2 days: the scanner may be failing for this venue.' },
  case_open: { label: 'Case open', tone: 'info', hint: 'A support case is open or waiting for Halom.' },
  case_waiting: { label: 'Case waiting 1+ day', tone: 'bad', hint: 'A support case has waited for Halom for more than a day.' },
  events_capped: { label: 'Events capped', tone: 'warn', hint: 'A cap dropped some of this venue’s guest events in the last 7 days: its numbers are a floor.' },
};

/** A row's warnings as chips, in the contract's order; a code this page does not know yet is shown as it is. */
export function warningChips(warnings: readonly string[], row?: Pick<OpsVenueRow, 'onboarding'>): Chip[] {
  const order = (c: string): number => { const i = (OPS_WARNINGS as readonly string[]).indexOf(c); return i < 0 ? OPS_WARNINGS.length : i; };
  return [...new Set(warnings)].sort((a, b) => order(a) - order(b)).map((code) => {
    if (!oneOf(OPS_WARNINGS, code)) return { code, label: code.replace(/_/g, ' '), tone: 'plain' as const, hint: 'A warning this page has no words for yet.' };
    const c = WARNING_CHIP[code];
    if (code === 'stuck_step_2d' && row && row.onboarding.stage !== 'complete') return { code, ...c, label: `Stuck at ${STEP_LABEL[row.onboarding.stage].toLowerCase()}` };
    return { code, ...c };
  });
}
export const WARNING_LABEL = (code: OpsWarning): string => WARNING_CHIP[code].label;

// ---------------------------------------------------------------- the menu's state, for guests

export type MenuState = { readonly code: 'live' | 'waiting' | 'plan' | 'offline' | 'never'; readonly label: string; readonly tone: Tone };

/**
 * What guests get from a venue's menu now, in words. "Live" only when the first publish is approved and the plan lets
 * guests in (trial running or active); a published menu waiting for approval says so, with its revision.
 */
export function menuState(r: Pick<OpsVenueRow, 'review' | 'menu' | 'plan'>): MenuState {
  const rev = r.menu.revision !== null ? ` · revision ${r.menu.revision}` : '';
  if (!r.menu.firstPublishedAt) return { code: 'never', label: 'never published', tone: 'plain' };
  if (r.review === 'pending') return { code: 'waiting', label: `waiting for approval${rev}`, tone: 'warn' };
  if (r.review === 'approved' && r.menu.live) {
    if (r.plan.state === 'trialing' || r.plan.state === 'active') return { code: 'live', label: `live${rev}`, tone: 'good' };
    return { code: 'plan', label: `offline: the plan is ${PLAN_STATE_LABEL[r.plan.state]}${rev}`, tone: 'bad' };
  }
  return { code: 'offline', label: 'offline', tone: 'plain' };
}

// ---------------------------------------------------------------- the owner's nudges, in words

const plural = (n: number, one: string, many: string): string => `${fmtInt(n)} ${n === 1 ? one : many}`;
export const NUDGE_LABEL: Readonly<Record<NudgeCode, (n: number) => string>> = {
  approval_pending: () => 'The first publish waits for Halom’s approval',
  onboarding_step: (n) => `${plural(n, 'onboarding step', 'onboarding steps')} left`,
  import_waiting: (n) => `${plural(n, 'import is', 'imports are')} read and waiting for the owner’s review`,
  case_waiting_owner: (n) => `${plural(n, 'case waits', 'cases wait')} for the owner`,
  dish_no_price: (n) => `${plural(n, 'dish', 'dishes')} guests can see without a price`,
  dish_no_photo: (n) => `${plural(n, 'dish', 'dishes')} guests can see without a photo or relief of its own`,
  group_without_limits: (n) => `${plural(n, 'add-on group', 'add-on groups')} with limits an import guessed, not confirmed yet`,
};

// ---------------------------------------------------------------- how fresh a page is

/**
 * The words beside "Updated hh:mm:ss": with Realtime, only what the channel covers is live (`liveWhat`) and the rest is
 * the safety poll's; without it, the polling interval; a page that never polls says so.
 */
export function freshnessWords(o: { mode: 'realtime' | 'polling'; polls: boolean; pollMs: number; safetyMs: number; liveWhat?: string | undefined }): string {
  const s = (ms: number) => `${Math.round(ms / 1000)} s`;
  if (!o.polls) return 'loaded on demand';
  if (o.mode === 'realtime') return `${o.liveWhat ?? 'live'} · the rest every ${s(o.safetyMs)}`;
  return `refreshes every ${s(o.pollMs)}`;
}

// ---------------------------------------------------------------- the timeline

export const TIMELINE_LABEL: Readonly<Record<TimelineKind, string>> = {
  onboarding: 'Onboarding', import: 'Imports', publish: 'Publishes', case: 'Support cases', halom: 'Halom', availability: 'Availability',
  menu: 'Menu', settings: 'Settings',
};

export type TimelineItem = ActivityEntry & {
  readonly kind: TimelineKind;
  readonly halom: boolean;
  /** The reason to show: the entry's own, or, for a row Halom's function wrote without one, the reason of the named
   * entry the same call logged (same instant). */
  readonly shownReason: string | null;
  /** `shownReason` came from that named entry. */
  readonly paired: boolean;
};
export type TimelineDay = { readonly day: string; readonly items: readonly TimelineItem[] };
export type Timeline = {
  readonly items: readonly TimelineItem[];
  /** How many entries each strand shows (every strand, zeros included, in the contract's order). The Halom strand counts
   * what Halom did, whatever its other strand. */
  readonly counts: Readonly<Record<TimelineKind, number>>;
};

/** Halom did it: staff acting for the owner, or staff through their own functions (approve, plans, cases, demo). */
export const isHalom = (e: Pick<ActivityEntry, 'actorKind' | 'via'>): boolean => e.actorKind === 'staff' || e.via === 'act_for_owner';
const NAMED = new Set<string>(NAMED_ACTIONS);

/**
 * The venue's log (any number of pages; an entry twice counts once) with each entry's strand, newest first. An entry
 * the contract files under "Halom" that Halom did not make (a plan the system expired) is a setting; Halom's audit rows
 * without a reason show the reason of the named entry their call logged at the same instant.
 */
export function timeline(entries: readonly ActivityEntry[]): Timeline {
  const counts = Object.fromEntries(TIMELINE_KINDS.map((k) => [k, 0])) as Record<TimelineKind, number>;
  const byId = new Map<number, ActivityEntry>();
  for (const e of entries) if (!byId.has(e.id)) byId.set(e.id, e);
  const sorted = [...byId.values()].sort((a, b) => b.id - a.id);
  const named = new Map<string, string>();
  for (const e of sorted) if (isHalom(e) && e.reason && NAMED.has(e.action) && !named.has(e.at)) named.set(e.at, e.reason);
  const items = sorted.map((e): TimelineItem => {
    const halom = isHalom(e);
    const k = timelineKind(e.action);
    const kind = k === 'halom' && !halom ? 'settings' : k;
    counts[kind] += kind === 'halom' ? 0 : 1;
    if (halom) counts.halom += 1;
    const paired = halom && !e.reason ? named.get(e.at) ?? null : null;
    return { ...e, kind, halom, shownReason: e.reason ?? paired, paired: paired !== null };
  });
  return { items, counts };
}

/** One strand (or all), grouped by the Israel date, newest day first. The Halom strand is everything Halom did. */
export function timelineDays(items: readonly TimelineItem[], kind: TimelineKind | 'all' = 'all'): TimelineDay[] {
  const out: { day: string; items: TimelineItem[] }[] = [];
  for (const it of items) {
    if (kind === 'halom' ? !it.halom : kind !== 'all' && it.kind !== kind) continue;
    const t = Date.parse(it.at);
    const day = Number.isFinite(t) ? localDate(t) : '—';
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(it); else out.push({ day, items: [it] });
  }
  return out;
}

// ---------------------------------------------------------------- what an activity entry says

const TABLE_WORDS: Readonly<Record<string, readonly [string, string]>> = {
  venues: ['venue setting', 'venue settings'], venue_members: ['team member', 'team members'], staff: ['staff member', 'staff members'],
  entitlements: ['plan', 'plans'], schedules: ['schedule', 'schedules'], sections: ['section', 'sections'], dishes: ['dish', 'dishes'],
  assets: ['picture', 'pictures'], addon_groups: ['add-on group', 'add-on groups'], addon_options: ['add-on', 'add-ons'],
  dish_addon_groups: ['dish’s add-on group', 'dishes’ add-on groups'], dish_relations: ['“goes well with”', '“goes well with” links'],
  upsell_rules: ['suggestion rule', 'suggestion rules'], venue_hours: ['opening hours', 'opening hours'], venue_closures: ['closed date', 'closed dates'],
  availability_overrides: ['availability change', 'availability changes'], onboarding_progress: ['onboarding step', 'onboarding steps'],
  menu_imports: ['menu import', 'menu imports'], support_cases: ['support case', 'support cases'], leads: ['lead', 'leads'],
};
const VERB: Readonly<Record<string, string>> = { insert: 'added', update: 'changed', delete: 'removed' };
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A name for an id of the venue's menu (from the published snapshot). */
export type NameOf = (id: string) => string | null;

export type Said = { readonly title: string; readonly detail: string | null };

/** One activity entry in words. Every value comes from the log's ids, numbers and codes; nothing typed by a person. */
export function describe(e: ActivityEntry, nameOf: NameOf = () => null): Said {
  const d = e.detail;
  const target = e.targetName ? names(e.targetName).main : null;
  const many = e.n > 1 ? ` (${fmtInt(e.n)})` : '';
  const { columns, changes } = activityChanges(e);
  const change = (col: string): readonly [unknown, unknown] | null => changes[col] ?? null;
  switch (e.action) {
    case 'venue.create': return { title: 'Venue created', detail: null };
    case 'venue.approve': return { title: 'First publish approved', detail: str(d.trialEndsAt) ? `Trial until ${fmtDate(str(d.trialEndsAt))}` : null };
    case 'plan.set': {
      const state = str(d.state), plan = str(d.plan), until = str(d.until);
      const words = [plan && oneOf(['trial', 'pilot', 'paid'] as const, plan) ? PLAN_LABEL[plan] : null,
        state && state in PLAN_STATE_LABEL ? PLAN_STATE_LABEL[state as EntitlementStatus] : state, until ? `until ${fmtDate(until)}` : null];
      return { title: 'Plan set', detail: words.filter(Boolean).join(', ') || null };
    }
    case 'menu.publish': return { title: 'Menu published', detail: num(d.revision) !== null ? `Revision ${num(d.revision)}` : null };
    case 'menu.restore': return { title: 'An earlier menu restored', detail: num(d.revision) !== null ? `Revision ${num(d.revision)}` : null };
    case 'menu.unpublish': return { title: 'Menu taken offline', detail: null };
    case 'menu.export': return { title: 'Menu exported', detail: null };
    case 'menu.read': return { title: 'Halom read a stored menu', detail: num(d.revision) !== null ? `Revision ${num(d.revision)}` : null };
    case 'support.act_for_owner': {
      const a = str(d.action);
      // hasOwnProperty, not Object.hasOwn: iOS before 15.4 has no Object.hasOwn
      return { title: 'Halom acted for the owner', detail: a && Object.prototype.hasOwnProperty.call(ACT_LABEL, a) ? ACT_LABEL[a as keyof typeof ACT_LABEL] : a };
    }
    case 'upsell_rules.deactivated': return { title: `Suggestion rule${e.n > 1 ? 's' : ''} switched off${many}`, detail: 'Its dish or section is gone' };
    case 'venue.set_demo': return { title: d.demo === true ? 'Marked as a demo venue' : d.demo === false ? 'Marked as a real venue' : 'Demo label changed', detail: null };
    case 'import.apply': {
      const src = str(d.source);
      return { title: 'Menu import applied', detail: src && src in IMPORT_SOURCE_LABEL ? IMPORT_SOURCE_LABEL[src as ImportSource] : null };
    }
    case 'staff.join': case 'staff_invite.create': case 'leads.read': return { title: e.action, detail: null };
  }
  const [table, op] = e.action.split('.') as [string, string];
  if (table === 'availability_overrides') {
    const kind = str(d.target_kind), id = str(d.target_id);
    const what = (id && nameOf(id)) || (kind && kind in A_TARGET ? A_TARGET[kind as TargetKind] : 'something');
    if (op === 'insert') {
      const until = str(d.until_at);
      return { title: `Taken off: ${what}`, detail: until ? `until ${fmtDateTime(until)}` : 'until brought back' };
    }
    if (op === 'update' && columns.includes('restored_at')) return { title: `Brought back${e.n > 1 ? many : ''}`, detail: e.n === 1 && id ? nameOf(id) : null };
  }
  if (table === 'onboarding_progress') {
    const step = str(d.step) ?? e.targetIds[0]?.split('/').pop() ?? null;
    const st = change('state')?.[1] ?? d.state;
    const stepWord = step && step in STEP_LABEL ? STEP_LABEL[step as OnboardingStep] : 'A step';
    return { title: `Onboarding: ${stepWord}`, detail: typeof st === 'string' && st in STATE_LABEL ? STATE_LABEL[st as OnboardingState] : null };
  }
  if (table === 'support_cases') {
    const st = change('status')?.[1] ?? d.status;
    const status = typeof st === 'string' && st in CASE_STATUS_LABEL ? CASE_STATUS_LABEL[st as CaseStatus] : null;
    return { title: op === 'insert' ? 'Support case opened' : 'Support case updated', detail: status };
  }
  if (table === 'menu_imports') {
    const st = change('status')?.[1] ?? d.status;
    return { title: op === 'insert' ? 'Menu import started' : 'Menu import updated', detail: typeof st === 'string' && st in IMPORT_STATUS_LABEL ? IMPORT_STATUS_LABEL[st as ImportStatus] : null };
  }
  if (table === 'dishes' && op === 'update' && e.n === 1) {
    const price = change('price');
    const parts: string[] = [];
    if (price) parts.push(`price ${typeof price[0] === 'number' ? fmtMoney(price[0]) : 'none'} → ${typeof price[1] === 'number' ? fmtMoney(price[1]) : 'none'}`);
    const hidden = change('hidden');
    if (hidden) parts.push(hidden[1] === true ? 'hidden from guests' : 'shown to guests');
    const rest = columns.filter((c) => c !== 'price' && c !== 'hidden');
    if (rest.length) parts.push(rest.map((c) => c.replace(/_(he|en)$/, ' ($1)').replace(/_/g, ' ')).join(', '));
    return { title: `Dish changed${target ? `: ${target}` : ''}`, detail: parts.join(' · ') || null };
  }
  const words = TABLE_WORDS[table];
  const noun = words ? (e.n === 1 ? words[0] : words[1]) : table.replace(/_/g, ' ');
  const verb = VERB[op] ?? op;
  const title = `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${verb}${e.n > 1 ? many : ''}${target ? `: ${target}` : ''}`;
  return { title, detail: op === 'update' && columns.length ? columns.map((c) => c.replace(/_/g, ' ')).join(', ') : null };
}

// ---------------------------------------------------------------- the guest's menu, as staff read it

export type MenuRow = {
  readonly kind: TargetKind;
  readonly id: string;
  readonly name: Text;
  readonly price: number | null;
  /** Off right now, with when it comes back (null = until the owner brings it back). */
  readonly off: { readonly from: string; readonly until: string | null } | null;
};
export type MenuSection = MenuRow & { readonly dishes: readonly MenuRow[] };
export type MenuView = { readonly sections: readonly MenuSection[]; readonly options: readonly MenuRow[]; readonly offCount: number };

/** The published snapshot with the live overlay's "off now", section by section; add-ons that are off listed apart. */
export function menuView(s: SnapshotV2, live: LiveOverlay): MenuView {
  const now = Date.parse(live.at);
  const off = new Map<string, { from: string; until: string | null }>();
  for (const o of live.off) {
    if (Date.parse(o.from) > now || (o.until !== null && Date.parse(o.until) <= now)) continue;
    off.set(`${o.kind}:${o.id}`, { from: o.from, until: o.until });
  }
  const offOf = (kind: TargetKind, id: string) => off.get(`${kind}:${id}`) ?? null;
  const sections = s.sections.map((sec): MenuSection => ({
    kind: 'section', id: sec.id, name: sec.name, price: null, off: offOf('section', sec.id),
    dishes: sec.dishes.map((d): MenuRow => ({ kind: 'dish', id: d.id, name: d.name, price: d.price?.amount ?? null, off: offOf('dish', d.id) })),
  }));
  const options = s.addonGroups.flatMap((g) => g.options.map((o): MenuRow => ({ kind: 'option', id: o.id, name: o.name, price: o.price, off: offOf('option', o.id) })))
    .filter((o) => o.off !== null);
  return { sections, options, offCount: off.size };
}

/** id → name for every section, dish, group and add-on of a snapshot. */
export function snapshotNames(s: SnapshotV2 | null): NameOf {
  const m = new Map<string, string>();
  if (s) {
    for (const sec of s.sections) m.set(sec.id, names(sec.name).main);
    for (const { dish } of allDishes(s)) m.set(dish.id, names(dish.name).main);
    for (const g of s.addonGroups) { m.set(g.id, names(g.name).main); for (const o of g.options) m.set(o.id, names(o.name).main); }
  }
  return (id) => m.get(id.toLowerCase()) ?? m.get(id) ?? null;
}

/** What changed from one stored revision to another, by id (a dish keeps its id when it is renamed or repriced). */
export type MenuDiff = {
  readonly sectionsAdded: readonly { readonly id: string; readonly name: Text }[];
  readonly sectionsRemoved: readonly { readonly id: string; readonly name: Text }[];
  readonly dishesAdded: readonly { readonly id: string; readonly name: Text }[];
  readonly dishesRemoved: readonly { readonly id: string; readonly name: Text }[];
  readonly prices: readonly { readonly id: string; readonly name: Text; readonly from: number | null; readonly to: number | null }[];
  readonly renamed: readonly { readonly id: string; readonly from: Text; readonly to: Text }[];
};

export function compareSnapshots(base: SnapshotV2, next: SnapshotV2): MenuDiff {
  const dishes = (s: SnapshotV2) => new Map(allDishes(s).map(({ dish }) => [dish.id, dish] as const));
  const sections = (s: SnapshotV2) => new Map(s.sections.map((x) => [x.id, x] as const));
  const [bd, nd, bs, ns] = [dishes(base), dishes(next), sections(base), sections(next)];
  const same = (a: Text, b: Text) => a.he === b.he && a.en === b.en;
  return {
    sectionsAdded: [...ns.values()].filter((x) => !bs.has(x.id)).map((x) => ({ id: x.id, name: x.name })),
    sectionsRemoved: [...bs.values()].filter((x) => !ns.has(x.id)).map((x) => ({ id: x.id, name: x.name })),
    dishesAdded: [...nd.values()].filter((x) => !bd.has(x.id)).map((x) => ({ id: x.id, name: x.name })),
    dishesRemoved: [...bd.values()].filter((x) => !nd.has(x.id)).map((x) => ({ id: x.id, name: x.name })),
    prices: [...nd.values()].flatMap((x) => {
      const was = bd.get(x.id);
      const from = was?.price?.amount ?? null, to = x.price?.amount ?? null;
      return was && from !== to ? [{ id: x.id, name: x.name, from, to }] : [];
    }),
    renamed: [...nd.values()].flatMap((x) => { const was = bd.get(x.id); return was && !same(was.name, x.name) ? [{ id: x.id, from: was.name, to: x.name }] : []; }),
  };
}
export const diffSize = (d: MenuDiff): number =>
  d.sectionsAdded.length + d.sectionsRemoved.length + d.dishesAdded.length + d.dishesRemoved.length + d.prices.length + d.renamed.length;

// ---------------------------------------------------------------- a stored revision, read in full

export const TAG_LABEL: Readonly<Record<Tag, string>> = { vegan: 'vegan', vegetarian: 'vegetarian', spicy: 'spicy', gf: 'gluten free' };
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const NUMBER_WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'] as const;
/** 5 → "five"; past ten, the digits. */
export const countWord = (n: number): string => NUMBER_WORD[n] ?? fmtInt(n);

/** Days as words: every day, Sun–Thu, or a list. */
export function daysWords(days: readonly Weekday[]): string {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (d.length === 0 || d.length === 7) return 'every day';
  const run = d.every((x, i) => i === 0 || x === (d[i - 1] ?? 0) + 1);
  return run && d.length > 2 ? `${DAY_SHORT[d[0]!]}–${DAY_SHORT[d[d.length - 1]!]}` : d.map((x) => DAY_SHORT[x]).join(', ');
}
export const windowsWords = (ws: readonly TimeWindow[]): string => ws.map((w) => `${daysWords(w.days)} ${w.from}–${w.to}`).join('; ');

/**
 * A picture's address, only when it is plainly the revision's own public storage: `assetBase` an http(s) URL ending in
 * `/`, the path a plain relative one (no `..`, no scheme, no leading `/`). Anything else is not shown.
 */
export function assetUrl(base: string | null | undefined, path: string | null | undefined): string | null {
  if (!base || !path || !/^https?:\/\/[^\s]+\/$/.test(base)) return null;
  if (!/^[A-Za-z0-9._~\-/]+$/.test(path) || path.startsWith('/') || path.split('/').some((p) => p === '..' || p === '.' || p === '')) return null;
  try { const u = new URL(path, base); return u.href.startsWith(base) ? u.href : null; } catch { return null; }
}

/** What guests see for a dish's picture: a photo, a relief from one photo, an illustration from Mana's library, or none. */
export type PictureRead = { readonly kind: 'photo' | 'relief' | 'stock'; readonly label: string; readonly src: string | null } | null;
export function pictureOf(a: AssetV2 | null, assetBase: string | null): PictureRead {
  if (!a) return null;
  if (a.state === 'stock') {
    return { kind: 'stock', label: 'an illustration from Mana’s library, labelled as one for guests', src: /^[a-z0-9-]{1,60}$/.test(a.id) ? `../stock/img/${a.id}_t.jpg` : null };
  }
  return a.state === 'relief'
    ? { kind: 'relief', label: 'a relief from one photo', src: assetUrl(assetBase, a.thumb) }
    : { kind: 'photo', label: 'a photo', src: assetUrl(assetBase, a.thumb) };
}

export type OptionRead = {
  readonly id: string; readonly name: Text; readonly price: number; readonly maxQty: number; readonly default: boolean;
  /** The one nesting level: choosing it opens this group (whose options open nothing). */
  readonly opens: GroupRead | null;
};
export type GroupRead = {
  readonly id: string; readonly name: Text; readonly selection: SelectionKind;
  /** On a dish: the dish's limits (it may tighten the group's own); for an opened group, the group's. */
  readonly min: number; readonly max: number;
  readonly options: readonly OptionRead[];
};
export type DishRead = {
  readonly id: string; readonly name: Text; readonly desc: Text; readonly price: number | null; readonly priceNote: Text;
  readonly tags: readonly string[]; readonly allergens: Text;
  /** Wine and beer details, as plain words (key: value), only the plain values. */
  readonly details: readonly (readonly [string, string])[];
  readonly picture: PictureRead;
  /** Shown only in these hours (a schedule's name and windows), or always. */
  readonly when: string | null;
  readonly addons: readonly GroupRead[];
  readonly related: readonly Text[];
};
export type SectionRead = { readonly id: string; readonly name: Text; readonly when: string | null; readonly dishes: readonly DishRead[] };
export type RuleRead = { readonly id: string; readonly words: string; readonly line: Text; readonly active: boolean };
export type MenuRead = { readonly sections: readonly SectionRead[]; readonly rules: readonly RuleRead[] };

const NO_TEXT: Text = { he: '', en: '' };
const plain = (v: unknown): string | null =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v)
    : v && typeof v === 'object' && !Array.isArray(v) && typeof (v as Text).en === 'string' ? names(v as Text).main : null;

/** A limit in words: "choose 1", "up to 3", "1 to 3", "any". */
export function limitWords(min: number, max: number): string {
  if (min === max) return `choose ${min}`;
  if (min === 0) return `up to ${max}`;
  return `${min} to ${max}`;
}

/**
 * A stored revision as staff review it before guests see it: every section and dish in both languages, descriptions,
 * prices and price notes, tags, allergens, wine and beer details, pictures, hours, "goes well with", each dish's add-on
 * groups with their options, limits, prices and the one nesting level, and the suggestion rules in words.
 */
export function readMenu(s: SnapshotV2): MenuRead {
  const groups = new Map(s.addonGroups.map((g) => [g.id, g] as const));
  const schedules = new Map(s.schedules.map((x) => [x.id, x] as const));
  const dishNames = new Map(allDishes(s).map(({ dish }) => [dish.id, dish.name] as const));
  const when = (id: string | null): string | null => {
    const sc = id ? schedules.get(id) : undefined;
    return sc ? `${names(sc.name).main} (${windowsWords(sc.windows)})` : null;
  };
  const group = (g: AddonGroupV2, min: number, max: number, nested: boolean): GroupRead => ({
    id: g.id, name: g.name, selection: g.selection, min, max,
    options: g.options.map((o): OptionRead => {
      const opened = !nested && o.opensGroupId ? groups.get(o.opensGroupId) : undefined;
      return { id: o.id, name: o.name, price: o.price, maxQty: o.maxQty, default: o.default, opens: opened ? group(opened, opened.min, opened.max, true) : null };
    }),
  });
  const sections = s.sections.map((sec): SectionRead => ({
    id: sec.id, name: sec.name, when: when(sec.scheduleId),
    dishes: sec.dishes.map((d): DishRead => ({
      id: d.id, name: d.name, desc: d.desc ?? NO_TEXT, price: d.price?.amount ?? null, priceNote: d.price?.note ?? NO_TEXT,
      tags: d.tags.map((t) => TAG_LABEL[t] ?? String(t)), allergens: d.allergens ?? NO_TEXT,
      details: Object.entries(d.details ?? {}).flatMap(([k, v]) => { const p = plain(v); return p !== null && p !== '' ? [[k.replace(/_/g, ' '), p] as const] : []; }),
      picture: pictureOf(d.asset, s.assetBase), when: when(d.scheduleId),
      addons: d.addons.flatMap((a) => { const g = groups.get(a.groupId); return g ? [group(g, a.min, a.max, false)] : []; }),
      related: d.related.flatMap((id) => { const n = dishNames.get(id); return n ? [n] : []; }),
    })),
  }));
  const sectionNames = new Map(s.sections.map((x) => [x.id, x.name] as const));
  return { sections, rules: s.upsellRules.map((r) => ({ id: r.id, words: ruleWords(r, { dish: (id) => dishNames.get(id), section: (id) => sectionNames.get(id), groups }), line: r.line, active: r.active })) };
}

const TRIGGER_WORDS: Readonly<Record<Trigger, string>> = {
  sheet: 'opens the sheet of', add: 'adds', checkout: 'opens “my table” with',
};

/** One suggestion rule in plain words. */
export function ruleWords(r: UpsellRuleV2, n: {
  readonly dish: (id: string) => Text | undefined; readonly section: (id: string) => Text | undefined; readonly groups: ReadonlyMap<string, AddonGroupV2>;
}): string {
  const list = (xs: readonly (Text | undefined)[], or: string) => {
    const w = xs.filter((x): x is Text => !!x).map((x) => `“${names(x).main}”`);
    return w.length === 0 ? or : w.length === 1 ? w[0]! : `${w.slice(0, -1).join(', ')} or ${w[w.length - 1]}`;
  };
  const or = (w: readonly string[], none: string) => (w.length === 0 ? none : w.length === 1 ? w[0]! : `${w.slice(0, -1).join(', ')} or ${w[w.length - 1]}`);
  const match = (m: IdMatch) => or([
    ...m.dishes.map(n.dish).filter((x): x is Text => !!x).map((x) => `“${names(x).main}”`),
    ...m.sections.map(n.section).filter((x): x is Text => !!x).map((x) => `anything from ${names(x).main}`),
  ], 'something');
  const scope = r.scope.kind === 'all' ? 'any dish'
    : r.scope.kind === 'dish' ? list(r.scope.ids.map(n.dish), 'a dish that is gone')
      : `a dish from ${list(r.scope.ids.map(n.section), 'a section that is gone')}`;
  const time = r.when ? `${daysWords(r.when.days)}${r.when.from || r.when.to ? ` ${r.when.from ?? '00:00'}–${r.when.to ?? '24:00'}` : ''}` : 'any time';
  let suggest: string;
  if (r.suggest.kind === 'dish') suggest = list([n.dish(r.suggest.dishId)], 'a dish that is gone');
  else {
    const sg = r.suggest;
    const g = n.groups.get(sg.groupId);
    const o = g?.options.find((x) => x.id === sg.optionId);
    suggest = o && g ? `the add-on “${names(o.name).main}” (${names(g.name).main})` : 'an add-on that is gone';
  }
  const parts = [`When a guest ${TRIGGER_WORDS[r.trigger]} ${scope}, ${time}`];
  if (r.basketHas) parts.push(`if their table has ${match(r.basketHas)}`);
  if (r.basketLacks) parts.push(`unless their table has ${match(r.basketLacks)}`);
  return `${parts.join(', ')}: suggest ${suggest}. Priority ${r.priority}, at most ${r.cap === 1 ? 'once' : `${r.cap} times`} a visit${r.active ? '' : '; switched off'}.`;
}

/** The choices for "until" when Halom takes something off for the owner. */
export const UNTIL_CHOICES: ReadonlyArray<{ readonly id: string; readonly label: string; readonly spec: UntilSpec }> = [
  { id: '1h', label: 'For 1 hour', spec: { kind: 'duration', minutes: 60 } },
  { id: '2h', label: 'For 2 hours', spec: { kind: 'duration', minutes: 120 } },
  { id: 'next', label: 'Until the next opening', spec: { kind: 'next_opening' } },
  { id: 'indefinite', label: 'Until someone brings it back', spec: { kind: 'indefinite' } },
];

// ---------------------------------------------------------------- analytics

export const ANALYTICS_NAMES = [
  'menu_opened', 'dish_viewed', 'basket_added', 'suggestion_shown', 'suggestion_accepted', 'suggestion_dismissed',
] as const satisfies readonly EventName[];
export type AnalyticsName = (typeof ANALYTICS_NAMES)[number];
export const EVENT_LABEL: Readonly<Record<AnalyticsName, { readonly title: string; readonly one: string; readonly many: string }>> = {
  menu_opened: { title: 'Menu opens', one: 'open', many: 'opens' },
  dish_viewed: { title: 'Dish views', one: 'view', many: 'views' },
  basket_added: { title: 'Added to “my table”', one: 'add', many: 'adds' },
  suggestion_shown: { title: 'Suggestions shown', one: 'shown', many: 'shown' },
  suggestion_accepted: { title: 'Suggestions accepted', one: 'accepted', many: 'accepted' },
  suggestion_dismissed: { title: 'Suggestions dismissed', one: 'dismissed', many: 'dismissed' },
};

export const ANALYTICS_RANGES = [
  { id: '1h', label: 'Last hour', resolution: 'minute', minutes: 60 },
  { id: '24h', label: 'Last 24 hours', resolution: 'minute', minutes: 24 * 60 },
  { id: '7d', label: 'Last 7 days', resolution: 'day', days: 7 },
  { id: '30d', label: 'Last 30 days', resolution: 'day', days: 30 },
] as const satisfies ReadonlyArray<{ id: string; label: string; resolution: AnalyticsResolution; minutes?: number; days?: number }>;
export type AnalyticsRangeId = (typeof ANALYTICS_RANGES)[number]['id'];

/**
 * The `ops_analytics` query for a range ending now: minutes are whole (from inclusive, to exclusive, the current minute
 * included), days are Israel dates (both inclusive, today included).
 */
export function analyticsQuery(range: AnalyticsRangeId, now: number, o: { venueId?: string | null; demo?: DemoScope } = {}): OpsAnalyticsQuery {
  const r = ANALYTICS_RANGES.find((x) => x.id === range) ?? ANALYTICS_RANGES[0];
  const base = { venueId: o.venueId ?? null, demo: o.demo ?? 'exclude', names: [...ANALYTICS_NAMES] } as const;
  if (r.resolution === 'minute') {
    const to = Math.floor(now / 60_000) * 60_000 + 60_000;
    return { ...base, resolution: 'minute', from: new Date(to - r.minutes * 60_000).toISOString(), to: new Date(to).toISOString() };
  }
  const today = localDate(now);
  return { ...base, resolution: 'day', from: addDays(today, -(r.days - 1)), to: today };
}

/**
 * The second time an Israel wall-clock minute occurs: when the clocks go back (the last Sunday of October), 01:00–01:59
 * comes twice, and the second one is marked.
 */
export const secondOccurrence = (t: number): boolean => hmFmt.format(t) === hmFmt.format(t - 3_600_000);

/**
 * A bucket's label on the axis and in the table: a minute as HH:MM (Israel), a day as "16 Oct". The long form (the
 * read-out and the table) marks the second 01:xx of the night the clocks go back.
 */
export const bucketLabel = (b: string, resolution: AnalyticsResolution, long = false): string => {
  if (resolution !== 'minute') return fmtDay(b, long);
  if (!long) return fmtTime(b);
  const t = Date.parse(b);
  return `${fmtDateTime(b)}${Number.isFinite(t) && secondOccurrence(t) ? ' (2nd, after the clocks went back)' : ''}`;
};
