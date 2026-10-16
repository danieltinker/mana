/**
 * A typed fake of the staff RPCs (ADR-008's signatures), answering contract-valid shapes from an in-memory world of
 * SYNTHETIC venues: Café Demo (the contracts' fixture menu), Bistro Sim, and Pita Lab (invented here). It follows the
 * database's rules where the page depends on them (staff only, reasons, the owner's support switch, admins for demo
 * and plans, demo traffic out of real totals), so the data layer's tests and the browser stub (stub.mjs) exercise the
 * same answers the backend lane's functions will give. It is not the database: the sim stack tests (e2e/ops.test.mjs)
 * are the real thing.
 */
import {
  ACTIVITY_PAGE_MAX, ONBOARDING_STEPS, allDishes, isReason, onboardingProgress, stripBlank, type ActivityAction, type ActivityEntry, type CaseStatus,
  type ClientDashboard, type DemoScope, type EntitlementStatus, type ImportExceptionCode, type MenuExport, type Nudge, type OffEntry, type OnboardingState,
  type OnboardingStep, type OpsAnalytics, type OpsAnalyticsQuery, type OpsImport, type OpsTotals, type OpsVenueDetail, type OpsVenueRow, type OpsVenues,
  type OpsVenuesQuery, type Plan, type OpsLead, type ReviewState, type SnapshotV2, type StaffRole, type SupportCase, type Text, addDays, localParts,
} from '@mana/contracts';
import { ID, cafeDemo, liveOf } from '@mana/contracts/fixtures';
import type { Backend, DishNow, Raw, RpcName } from '../../src/v2/api.ts';

export const VENUE = { demo: ID.venue, bistro: '00000000-0000-4000-8000-0000000000c2', pita: '00000000-0000-4000-8000-0000000000c3' } as const;
export const USERS = {
  admin: '00000000-0000-4000-8000-00000000aa01',
  support: '00000000-0000-4000-8000-00000000aa02',
  owner: '00000000-0000-4000-8000-00000000aa03',
} as const;
/** Text a stranger could type, rendered only as text. */
export const HOSTILE = '<img src=x onerror="window.__xss=1">‮ reversed';

const t = (en: string, he: string): Text => ({ he, en });
const iso = (ms: number): string => new Date(ms).toISOString();
const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const uuid = (n: number): string => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

type Fault = { readonly mode: 'error' | 'missing' | 'not_staff' | 'jwt' | 'timeout' | 'garbage'; times?: number };

export type FakeVenue = {
  row: Mutable<OpsVenueRow>;
  steps: { step: OnboardingStep; state: OnboardingState; blockers: string[]; updatedAt: string | null }[];
  imports: OpsImport[];
  cases: Mutable<SupportCase>[];
  activity: ActivityEntry[];
  snapshot: SnapshotV2 | null;
  /** Stored revisions, oldest first; the published one is `row.menu.revision`. */
  revisions: { id: string; number: number; createdAt: string; note: string | null; snapshot: SnapshotV2 }[];
  off: OffEntry[];
  members: { owners: number; managers: number; counters: number };
  /** The owner's menu as it is in the owner app now (what a publish copies; what staff read and `export_menu` gives). */
  sections: { id: string; position: number; name_he: string; name_en: string; hidden: boolean }[];
  dishes: (DishNow & { section_id: string; position: number })[];
};
type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] };

/** The owner's menu from a published snapshot (every row as published, `updated_at` at the publish). */
function ownerMenu(s: SnapshotV2 | null, at: string): Pick<FakeVenue, 'sections' | 'dishes'> {
  if (!s) return { sections: [], dishes: [] };
  return {
    sections: s.sections.map((x, i) => ({ id: x.id, position: i, name_he: x.name.he, name_en: x.name.en, hidden: false })),
    dishes: allDishes(s).map(({ dish, sectionId }, i) => ({ id: dish.id, section_id: sectionId, position: i, name_he: dish.name.he, name_en: dish.name.en,
      price: dish.price?.amount ?? null, hidden: false, updated_at: at })),
  };
}

export type World = {
  now: () => number;
  venues: FakeVenue[];
  leads: OpsLead[];
  staff: Map<string, StaffRole>;
  /** Event counts per venue per UTC minute: `${venueId}|${minuteIso}|${name}` → n, demo from the venue at the time. */
  traffic: Map<string, { n: number; demo: boolean }>;
  calls: { fn: string; args: Readonly<Record<string, unknown>>; user: string | null }[];
  faults: Partial<Record<string, Fault>>;
  /** Milliseconds a function's answers wait (a slow database). */
  delays: Partial<Record<string, number>>;
  rolledUpAt: string | null;
  nextLog: number;
};

// ---------------------------------------------------------------- the synthetic world

function row(created: number, o: { id: string; slug: string; name: Text; isDemo: boolean; review: ReviewState } & Partial<OpsVenueRow>): Mutable<OpsVenueRow> {
  const base: OpsVenueRow = {
    id: o.id, slug: o.slug, name: o.name, kind: 'cafe', mode: 'view_only', isDemo: o.isDemo, createdAt: iso(created), supportCanAct: true,
    review: o.review, approvedAt: null,
    onboarding: { stage: 'venue', done: 0, total: ONBOARDING_STEPS.length, since: iso(created), blocked: [] },
    menu: { live: false, revision: null, lastPublishedAt: null, firstPublishedAt: null },
    opens: { today: 0, last7d: 0, lastHour: 0 }, cappedToday: false,
    suggestions7d: { shown: 0, accepted: 0, dismissed: 0 },
    photos: { dishes: 0, withPhoto: 0, awaitingReview: 0 },
    imports: { total: 0, lastAt: null, lastStatus: null, failed2d: 0 },
    openCases: 0, lastOwnerSignInAt: null, lastActivityAt: null,
    plan: { plan: 'trial', state: 'pending', trialEndsAt: null }, warnings: [],
  };
  return structuredClone({ ...base, ...o }) as Mutable<OpsVenueRow>;
}

function entry(w: World, venueId: string, at: number, action: ActivityAction, o: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: w.nextLog++, at: iso(at), actorKind: 'owner', you: false, via: 'direct', action, targetTable: action.includes('.') ? action.split('.')[0] ?? null : null,
    targetIds: [venueId], n: 1, targetName: null, reason: null, detail: {}, ...o,
  };
}

/** Café Demo's first publish: the burger was ₪66 and there was no lemonade yet (what the comparison shows). */
function firstTry(s: SnapshotV2): SnapshotV2 {
  const m = structuredClone(s) as unknown as { sections: { dishes: { id: string; price: { amount: number } | null }[] }[] };
  for (const sec of m.sections) {
    sec.dishes = sec.dishes.filter((d) => d.id !== ID.lemonade);
    for (const d of sec.dishes) if (d.id === ID.burger && d.price) d.price.amount = 6600;
  }
  return m as unknown as SnapshotV2;
}

/** A fresh world. `traffic: false` leaves every venue without guest events (the "no traffic yet" state). */
export function world({ now = () => Date.now(), traffic = true }: { now?: () => number; traffic?: boolean } = {}): World {
  const w: World = { now, venues: [], leads: [], staff: new Map([[USERS.admin, 'admin'], [USERS.support, 'support']]), traffic: new Map(), calls: [], faults: {},
    delays: {}, rolledUpAt: null, nextLog: 1 };
  const n = now();
  w.rolledUpAt = iso(Math.floor(n / MIN) * MIN);

  // Café Demo: a demo venue, published, waiting for Halom's approval; the espresso is sold out for two hours
  // the published menu is revision 2, published five hours ago (the fixture's own number and time are a single publish's)
  const demoSnap = { ...cafeDemo(), revision: 2, publishedAt: iso(n - 5 * HOUR) };
  const demo: FakeVenue = {
    row: row(n - 3 * DAY, { id: VENUE.demo, slug: 'cafe-demo', name: t('Café Demo', 'קפה דמו'), isDemo: true, review: 'pending',
      onboarding: { stage: 'photos', done: 4, total: 9, since: iso(n - 2.5 * DAY), blocked: [{ step: 'photos', blockers: ['dish_without_photo'] }] },
      menu: { live: true, revision: 2, lastPublishedAt: iso(n - 5 * HOUR), firstPublishedAt: iso(n - 26 * HOUR) },
      photos: { dishes: 7, withPhoto: 1, awaitingReview: 2 }, imports: { total: 1, lastAt: iso(n - 2.8 * DAY), lastStatus: 'applied', failed2d: 0 },
      openCases: 1, lastOwnerSignInAt: iso(n - 4 * HOUR), lastActivityAt: iso(n - 20 * MIN), warnings: ['awaiting_review', 'stuck_step_2d', 'case_open'] }),
    steps: [
      { step: 'venue', state: 'done', blockers: [], updatedAt: iso(n - 3 * DAY) },
      { step: 'menu', state: 'done', blockers: [], updatedAt: iso(n - 2.8 * DAY) },
      { step: 'review', state: 'done', blockers: [], updatedAt: iso(n - 2.8 * DAY) },
      { step: 'addons', state: 'done', blockers: [], updatedAt: iso(n - 2.6 * DAY) },
      { step: 'photos', state: 'blocked', blockers: ['dish_without_photo'], updatedAt: iso(n - 2.5 * DAY) },
    ],
    imports: [{ id: uuid(0x1001), source: 'paste', status: 'applied', createdAt: iso(n - 2.8 * DAY), appliedAt: iso(n - 2.8 * DAY + 20 * MIN), errorCode: null,
      rightsConfirmed: false, counts: { sections: 4, dishes: 7, groups: 6, options: 16, photos: 0, dropped: 0 },
      exceptions: { fix: 2, check: 3, byCode: { price_missing: 2, limits_guessed: 2, translation_check: 1 } } }],
    cases: [{ id: uuid(0x2001), venueId: VENUE.demo, topic: 'photos', status: 'open', subject: 'Photos for the drinks?', body: `Can Halom help with the drinks photos? ${HOSTILE}`,
      openedBy: 'owner', openedAt: iso(n - 6 * HOUR), updatedAt: iso(n - 6 * HOUR), resolvedAt: null, supportCanAct: true }],
    activity: [], snapshot: demoSnap, revisions: [
      { id: uuid(0x5001), number: 1, createdAt: iso(n - 26 * HOUR), note: 'first try', snapshot: { ...firstTry(demoSnap), revision: 1, publishedAt: iso(n - 26 * HOUR) } },
      { id: uuid(0x5002), number: 2, createdAt: iso(n - 5 * HOUR), note: null, snapshot: structuredClone(demoSnap) },
    ],
    off: [{ kind: 'dish', id: ID.espresso, from: iso(n - 20 * MIN), until: iso(Math.ceil((n + 100 * MIN) / MIN) * MIN) }],
    members: { owners: 1, managers: 0, counters: 0 },
    // since revision 2 the owner raised the burger to ₪72 in the owner app, not published yet
    ...ownerMenu(demoSnap, iso(n - 5 * HOUR)),
  };
  for (const d of demo.dishes) if (d.id === ID.burger) { d.price = 7200; d.updated_at = iso(n - 40 * MIN); }
  demo.activity = [
    entry(w, VENUE.demo, n - 3 * DAY, 'venue.create', { via: 'rpc' }),
    entry(w, VENUE.demo, n - 2.8 * DAY, 'menu_imports.insert', { via: 'rpc', targetTable: 'menu_imports', targetIds: [uuid(0x1001)], detail: { status: 'uploaded', source: 'paste' } }),
    entry(w, VENUE.demo, n - 2.8 * DAY + 20 * MIN, 'import.apply', { via: 'rpc', targetIds: [uuid(0x1001)], detail: { source: 'paste', sections: 4, dishes: 7 } }),
    entry(w, VENUE.demo, n - 2.8 * DAY + 21 * MIN, 'onboarding_progress.update', { via: 'rpc', targetIds: [`${VENUE.demo}/review`], detail: { columns: ['state'], changes: { state: ['todo', 'done'] } } }),
    entry(w, VENUE.demo, n - 2.5 * DAY, 'onboarding_progress.update', { targetIds: [`${VENUE.demo}/photos`], detail: { columns: ['state', 'blockers'], changes: { state: ['todo', 'blocked'] } } }),
    entry(w, VENUE.demo, n - 26 * HOUR, 'menu.publish', { via: 'rpc', detail: { revision: 1 } }),
    entry(w, VENUE.demo, n - 5 * HOUR, 'menu.publish', { via: 'rpc', detail: { revision: 2 } }),
    entry(w, VENUE.demo, n - 6 * HOUR, 'support_cases.insert', { targetTable: 'support_cases', targetIds: [uuid(0x2001)], detail: { topic: 'photos', status: 'open' } }),
    entry(w, VENUE.demo, n - 40 * MIN, 'dishes.update', { targetTable: 'dishes', targetIds: [ID.burger], targetName: t('Burger', 'המבורגר'),
      detail: { columns: ['price'], changes: { price: [6800, 7200] } } }),
    entry(w, VENUE.demo, n - 20 * MIN, 'availability_overrides.insert', { actorKind: 'counter', targetTable: 'availability_overrides', targetIds: [uuid(0x3001)],
      detail: { target_kind: 'dish', target_id: ID.espresso, until_kind: 'duration', until_at: demo.off[0]?.until ?? null } }),
  ];

  // Bistro Sim: a real venue, approved and live, onboarding complete
  const bistro: FakeVenue = {
    row: row(n - 12 * DAY, { id: VENUE.bistro, slug: 'bistro-sim', name: t('Bistro Sim', 'ביסטרו סים'), isDemo: false, review: 'approved',
      approvedAt: iso(n - 11 * DAY), onboarding: { stage: 'complete', done: 9, total: 9, since: null, blocked: [] },
      menu: { live: true, revision: 4, lastPublishedAt: iso(n - 1 * DAY), firstPublishedAt: iso(n - 11 * DAY) },
      photos: { dishes: 6, withPhoto: 6, awaitingReview: 0 }, imports: { total: 2, lastAt: iso(n - 11 * DAY), lastStatus: 'applied', failed2d: 0 },
      lastOwnerSignInAt: iso(n - 1 * DAY), lastActivityAt: iso(n - 1 * DAY), plan: { plan: 'pilot', state: 'trialing', trialEndsAt: iso(n + 19 * DAY) } }),
    steps: ONBOARDING_STEPS.map((step) => ({ step, state: 'done' as const, blockers: [], updatedAt: iso(n - 11 * DAY) })),
    imports: [], cases: [], activity: [], snapshot: null, revisions: [], off: [], members: { owners: 1, managers: 1, counters: 1 }, sections: [], dishes: [],
  };
  bistro.activity = [
    entry(w, VENUE.bistro, n - 12 * DAY, 'venue.create', { via: 'rpc' }),
    entry(w, VENUE.bistro, n - 11 * DAY, 'venue.approve', { actorKind: 'staff', via: 'rpc', reason: 'Checked the menu with the owner on the phone', detail: { trialEndsAt: iso(n + 19 * DAY) } }),
    entry(w, VENUE.bistro, n - 1 * DAY, 'menu.publish', { via: 'rpc', detail: { revision: 4 } }),
  ];

  // Pita Lab: a real venue stuck at the import, its scanner failing, a case waiting for Halom (invented)
  const pita: FakeVenue = {
    row: row(n - 4 * DAY, { id: VENUE.pita, slug: 'pita-lab', name: t(`Pita Lab ${HOSTILE}`, 'מעבדת פיתות'), isDemo: false, review: 'not_requested',
      supportCanAct: false, onboarding: { stage: 'menu', done: 1, total: 9, since: iso(n - 4 * DAY), blocked: [] },
      imports: { total: 2, lastAt: iso(n - 1 * DAY), lastStatus: 'failed', failed2d: 2 }, openCases: 1, lastOwnerSignInAt: iso(n - 1 * DAY),
      lastActivityAt: iso(n - 1 * DAY), warnings: ['stuck_step_2d', 'not_published_2d', 'import_failed', 'case_open', 'case_waiting'] }),
    steps: [{ step: 'venue', state: 'done', blockers: [], updatedAt: iso(n - 4 * DAY) }],
    imports: [
      { id: uuid(0x1002), source: 'scan', status: 'failed', createdAt: iso(n - 1 * DAY), appliedAt: null, errorCode: 'scan_unreadable', rightsConfirmed: true, counts: null,
        exceptions: { fix: 0, check: 0, byCode: {} } },
      { id: uuid(0x1003), source: 'scan', status: 'failed', createdAt: iso(n - 1.5 * DAY), appliedAt: null, errorCode: 'scan_unreadable', rightsConfirmed: true, counts: null,
        exceptions: { fix: 0, check: 0, byCode: {} } },
    ],
    cases: [{ id: uuid(0x2002), venueId: VENUE.pita, topic: 'import', status: 'waiting_halom', subject: 'The scan does not work', body: 'Tried twice with the printed menu.',
      openedBy: 'owner', openedAt: iso(n - 1.6 * DAY), updatedAt: iso(n - 1.6 * DAY), resolvedAt: null, supportCanAct: false }],
    activity: [], snapshot: null, revisions: [], off: [], members: { owners: 1, managers: 0, counters: 0 }, sections: [], dishes: [],
  };
  pita.activity = [
    entry(w, VENUE.pita, n - 4 * DAY, 'venue.create', { via: 'rpc' }),
    entry(w, VENUE.pita, n - 1.6 * DAY, 'support_cases.insert', { targetTable: 'support_cases', targetIds: [uuid(0x2002)], detail: { topic: 'import', status: 'waiting_halom' } }),
    entry(w, VENUE.pita, n - 1.5 * DAY, 'menu_imports.update', { via: 'rpc', targetTable: 'menu_imports', targetIds: [uuid(0x1003)], detail: { columns: ['status'], changes: { status: ['parsing', 'failed'] } } }),
    entry(w, VENUE.pita, n - 1 * DAY, 'menu_imports.update', { via: 'rpc', targetTable: 'menu_imports', targetIds: [uuid(0x1002)], detail: { columns: ['status'], changes: { status: ['parsing', 'failed'] } } }),
  ];
  w.venues.push(demo, bistro, pita);
  // the log's ids grow with time, as the database's do
  const log = w.venues.flatMap((v) => v.activity.map((e) => ({ v, e }))).sort((a, b) => Date.parse(a.e.at) - Date.parse(b.e.at));
  for (const v of w.venues) v.activity = [];
  log.forEach(({ v, e }, i) => v.activity.unshift({ ...e, id: i + 1 }));
  w.nextLog = log.length + 1;

  if (traffic) {
    // guests over the last 90 minutes: Café Demo's are demo traffic, Bistro Sim's are real
    for (let m = 90; m >= 1; m--) {
      const minute = iso(Math.floor((n - m * MIN) / MIN) * MIN);
      const k = (m * 7) % 5;
      for (const [venue, scale] of [[VENUE.demo, 2], [VENUE.bistro, 1]] as const) {
        const add = (name: string, c: number) => { if (c > 0) w.traffic.set(`${venue}|${minute}|${name}`, { n: c, demo: venue === VENUE.demo }); };
        add('menu_opened', (k % 3) * scale); add('dish_viewed', k * scale); add('basket_added', (k % 2) * scale);
        add('suggestion_shown', k > 2 ? scale : 0); add('suggestion_accepted', k === 4 ? 1 : 0); add('suggestion_dismissed', k === 3 ? 1 : 0);
      }
    }
    refreshCounts(w);
  }
  w.leads = [
    { id: uuid(0x4001), ref: 'MN-2026-0001', created_at: iso(n - 2 * HOUR), source: 'mana-landing', message: 'We are a small café and want the menu.', contact: 'hello@example.invalid',
      name: 'Dana Test', venue_name: 'Test Café', locale: 'en', status: 'new', owner: null, notes: null },
    { id: uuid(0x4002), ref: 'MN-2026-0002', created_at: iso(n - 2 * DAY), source: 'mana-landing', message: `Line one\nLine two ${HOSTILE}`, contact: '050-000-0000',
      name: null, venue_name: null, locale: 'he', status: 'contacted', owner: 'Halom', notes: 'Called back' },
  ];
  return w;
}

/** The opens on each row, from the traffic (a demo venue counts its demo traffic, a real one its real traffic). */
function refreshCounts(w: World): void {
  const n = w.now();
  const today = localParts(n, 'Asia/Jerusalem').date;
  for (const v of w.venues) {
    const opens = { today: 0, last7d: 0, lastHour: 0 };
    const sugg = { shown: 0, accepted: 0, dismissed: 0 };
    for (const [key, c] of w.traffic) {
      const [venue, minute, name] = key.split('|') as [string, string, string];
      if (venue !== v.row.id || c.demo !== v.row.isDemo) continue;
      const at = Date.parse(minute);
      if (name === 'menu_opened') {
        if (localParts(at, 'Asia/Jerusalem').date === today) opens.today += c.n;
        if (at > n - 7 * DAY) opens.last7d += c.n;
        if (at >= n - HOUR) opens.lastHour += c.n;
      }
      if (at > n - 7 * DAY) {
        if (name === 'suggestion_shown') sugg.shown += c.n;
        if (name === 'suggestion_accepted') sugg.accepted += c.n;
        if (name === 'suggestion_dismissed') sugg.dismissed += c.n;
      }
    }
    v.row.opens = opens;
    v.row.suggestions7d = sugg;
  }
}

// ---------------------------------------------------------------- the RPCs

class RpcError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status; }
}
const notStaff = (): never => { throw new RpcError('42501', 'not_staff', 403); };
const bad = (code: string): never => { throw new RpcError('22023', code, 400); };

function totals(w: World): OpsTotals {
  const real = w.venues.filter((v) => !v.row.isDemo);
  const week = w.now() - 7 * DAY;
  return {
    venues: real.length, live: real.filter((v) => v.row.menu.live && v.row.approvedAt !== null).length,
    awaitingReview: w.venues.filter((v) => v.row.review === 'pending').length, demoVenues: w.venues.length - real.length,
    opensToday: real.reduce((s, v) => s + v.row.opens.today, 0), openCases: w.venues.reduce((s, v) => s + v.cases.filter((c) => c.status !== 'resolved').length, 0),
    actsForOwner7d: w.venues.reduce((s, v) => s + v.activity.filter((a) => a.action === 'support.act_for_owner' && Date.parse(a.at) > week).length, 0),
  };
}

function venues(w: World, q: OpsVenuesQuery): OpsVenues {
  const needle = q.q?.toLowerCase();
  const demo: DemoScope = q.demo ?? 'include';
  let list = w.venues.map((v) => v.row as OpsVenueRow).filter((r) =>
    (!needle || [r.name.he, r.name.en, r.slug].some((s) => s.toLowerCase().includes(needle))) &&
    (q.stage === undefined || r.onboarding.stage === q.stage) && (q.warning === undefined || r.warnings.includes(q.warning)) &&
    (q.review === undefined || r.review === q.review) && (q.planState === undefined || r.plan.state === q.planState) &&
    (q.plan === undefined || r.plan.plan === q.plan) && (demo === 'include' || (demo === 'only') === r.isDemo));
  const by = q.sort ?? 'created';
  const key = (r: OpsVenueRow): number | string => by === 'name' ? (r.name.en || r.name.he).toLowerCase() : by === 'opens_today' ? -r.opens.today
    : by === 'activity' ? -Date.parse(r.lastActivityAt ?? r.createdAt) : -Date.parse(r.createdAt);
  list = [...list].sort((a, b) => { const x = key(a), y = key(b); return x < y ? -1 : x > y ? 1 : 0; });
  const offset = q.offset ?? 0, limit = q.limit ?? 200;
  return { generatedAt: iso(w.now()), rolledUpAt: w.rolledUpAt, totals: totals(w), total: list.length, venues: structuredClone(list.slice(offset, offset + limit)) };
}

function detail(v: FakeVenue): OpsVenueDetail {
  const progress = onboardingProgress(v.steps);
  return structuredClone({ venue: v.row as OpsVenueRow, members: v.members, onboarding: progress, imports: v.imports, cases: v.cases, activity: v.activity.slice(0, 100) });
}

function analytics(w: World, q: OpsAnalyticsQuery): OpsAnalytics {
  const demo: DemoScope = q.demo ?? 'exclude';
  const names = q.names ?? ['menu_opened', 'dish_viewed', 'basket_added', 'suggestion_shown', 'suggestion_accepted', 'suggestion_dismissed'];
  const buckets: string[] = [];
  if (q.resolution === 'minute') for (let t = Date.parse(q.from); t < Date.parse(q.to); t += MIN) buckets.push(iso(t));
  else for (let d = q.from; d <= q.to; d = addDays(d, 1)) buckets.push(d);
  const index = new Map(buckets.map((b, i) => [b, i]));
  const series: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, buckets.map(() => 0)]));
  for (const [key, c] of w.traffic) {
    const [venue, minute, name] = key.split('|') as [string, string, string];
    if (q.venueId && venue !== q.venueId) continue;
    if ((demo === 'exclude' && c.demo) || (demo === 'only' && !c.demo)) continue;
    const b = q.resolution === 'minute' ? minute : localParts(Date.parse(minute), 'Asia/Jerusalem').date;
    const i = index.get(b);
    const s = series[name];
    if (i !== undefined && s) s[i] = (s[i] ?? 0) + c.n;
  }
  const totalsOut = Object.fromEntries(Object.entries(series).map(([k, s]) => [k, s.reduce((a, b) => a + b, 0)]));
  const inRange = (at: string): boolean => {
    const t = Date.parse(at);
    return q.resolution === 'minute' ? t >= Date.parse(q.from) && t < Date.parse(q.to) : (() => { const d = localParts(t, 'Asia/Jerusalem').date; return d >= q.from && d <= q.to; })();
  };
  const scope = w.venues.filter((v) => (!q.venueId || v.row.id === q.venueId) && (demo === 'include' || (demo === 'only') === v.row.isDemo));
  const created = scope.filter((v) => inRange(v.row.createdAt));
  const imports = scope.flatMap((v) => v.imports.filter((i) => inRange(i.createdAt)));
  const sources = [...new Set(imports.map((i) => i.source))];
  const codes = new Map<string, number>();
  for (const i of imports) for (const [c, n] of Object.entries(i.exceptions.byCode)) codes.set(c, (codes.get(c) ?? 0) + (n ?? 0));
  return {
    generatedAt: iso(w.now()), rolledUpAt: w.rolledUpAt, resolution: q.resolution, venueId: q.venueId ?? null, demo, buckets, series, totals: totalsOut,
    funnel: { created: created.length, imported: created.filter((v) => v.imports.some((i) => i.status === 'applied')).length,
      published: created.filter((v) => v.row.menu.firstPublishedAt !== null).length, approved: created.filter((v) => v.row.approvedAt !== null).length },
    imports: {
      total: imports.length, parsed: imports.filter((i) => i.status === 'parsed').length, applied: imports.filter((i) => i.status === 'applied').length,
      discarded: imports.filter((i) => i.status === 'discarded').length, failed: imports.filter((i) => i.status === 'failed').length,
      withFix: imports.filter((i) => i.exceptions.fix > 0).length, exceptions: imports.reduce((s, i) => s + i.exceptions.fix + i.exceptions.check, 0),
      bySource: sources.map((source) => {
        const of = imports.filter((i) => i.source === source);
        return { source, total: of.length, applied: of.filter((i) => i.status === 'applied').length, failed: of.filter((i) => i.status === 'failed').length,
          withFix: of.filter((i) => i.exceptions.fix > 0).length };
      }),
      byCode: [...codes].map(([code, n]) => ({ code: code as ImportExceptionCode, n })).sort((a, b) => b.n - a.n),
    },
  } as OpsAnalytics;
}

const find = (w: World, id: unknown): FakeVenue | undefined => w.venues.find((v) => v.row.id === id);

/** Logs an action as the database does: Halom staff, with the reason; returns the new row. */
function log(w: World, v: FakeVenue, action: ActivityAction, o: Partial<ActivityEntry> = {}): ActivityEntry {
  const e = entry(w, v.row.id, w.now(), action, { actorKind: 'staff', ...o });
  v.activity.unshift(e);
  v.row.lastActivityAt = e.at;
  return e;
}

/**
 * A publish: the owner's menu (their prices, hidden dishes left out) as a new stored revision; guests get it once the
 * venue is approved. A first publish waits for Halom's approval. Returns the new revision, or null for an empty menu.
 */
export function publish(w: World, venueId: string, o: Partial<ActivityEntry> = { actorKind: 'owner', via: 'rpc' }): number | null {
  const v = find(w, venueId);
  const base = v?.snapshot ?? v?.revisions.at(-1)?.snapshot ?? null;
  if (!v || !base) return null;
  const number = (v.revisions.at(-1)?.number ?? 0) + 1;
  const snap = structuredClone(base) as unknown as { revision: number; publishedAt: string; sections: { dishes: { id: string; price: { amount: number; note: Text } | null }[] }[] };
  snap.revision = number;
  snap.publishedAt = iso(w.now());
  for (const sec of snap.sections) {
    sec.dishes = sec.dishes.filter((d) => !v.dishes.find((x) => x.id === d.id)?.hidden);
    for (const d of sec.dishes) {
      const own = v.dishes.find((x) => x.id === d.id);
      if (own) d.price = own.price === null ? null : { amount: own.price, note: d.price?.note ?? { he: '', en: '' } };
    }
  }
  const s = snap as unknown as SnapshotV2;
  v.revisions.push({ id: uuid(0x50000 + w.nextLog), number, createdAt: iso(w.now()), note: null, snapshot: s });
  v.snapshot = s;
  v.row.menu = { ...v.row.menu, live: true, revision: number, lastPublishedAt: iso(w.now()), firstPublishedAt: v.row.menu.firstPublishedAt ?? iso(w.now()) };
  if (v.row.review === 'not_requested') v.row.review = 'pending';
  log(w, v, 'menu.publish', { ...o, detail: { revision: number } });
  return number;
}

/** The owner changes a dish in the owner app (a new `updated_at`, as the database's touch trigger gives it). */
export function ownerEdit(w: World, dishId: string, patch: { price?: number | null; hidden?: boolean }): void {
  for (const v of w.venues) {
    const d = v.dishes.find((x) => x.id === dishId);
    if (!d) continue;
    Object.assign(d, patch, { updated_at: iso(Math.max(w.now(), Date.parse(d.updated_at) + 1)) });
    log(w, v, 'dishes.update', { actorKind: 'owner', via: 'direct', targetTable: 'dishes', targetIds: [dishId], targetName: t(d.name_en, d.name_he),
      detail: { columns: Object.keys(patch) } });
  }
}

/** The owner marks an onboarding step in the owner app (a new `updated_at`). */
export function ownerStep(w: World, venueId: string, step: OnboardingStep, state: OnboardingState): void {
  const v = find(w, venueId);
  if (!v) return;
  const s = v.steps.find((x) => x.step === step);
  const was = s?.state ?? null;
  const at = iso(Math.max(w.now(), s?.updatedAt ? Date.parse(s.updatedAt) + 1 : 0));
  if (s) { s.state = state; s.updatedAt = at; } else v.steps.push({ step, state, blockers: [], updatedAt: at });
  log(w, v, 'onboarding_progress.update', { actorKind: 'owner', via: 'rpc', targetIds: [`${venueId}/${step}`], detail: { columns: ['state'], changes: { state: [was, state] } } });
}

/** `n` more entries in a venue's log, the owner's edits half a minute apart, up to now (a long history). */
export function padLog(w: World, venueId: string, n: number): void {
  const v = find(w, venueId);
  if (!v) return;
  for (let i = 0; i < n; i++) {
    const e = entry(w, venueId, w.now() - (n - i) * 30_000, 'venue_hours.update', { targetTable: 'venue_hours', detail: { columns: ['opens_at'] } });
    v.activity.unshift(e);
  }
}

const TODAY_KEYS = ['menuOpens', 'dishViews', 'addonsChosen', 'basketAdds', 'suggestionsShown', 'suggestionsAccepted', 'suggestionsDismissed'] as const;
const KEY_EVENT: Readonly<Record<(typeof TODAY_KEYS)[number], string>> = {
  menuOpens: 'menu_opened', dishViews: 'dish_viewed', addonsChosen: 'addon_chosen', basketAdds: 'basket_added', suggestionsShown: 'suggestion_shown',
  suggestionsAccepted: 'suggestion_accepted', suggestionsDismissed: 'suggestion_dismissed',
};

/** `my_dashboard` as the owner gets it: their own traffic (demo traffic on a demo venue), nudges, what is off now. */
function dashboard(w: World, v: FakeVenue, range: 'today' | '7d' | '30d'): ClientDashboard {
  const n = w.now();
  const today = localParts(n, 'Asia/Jerusalem').date;
  const from = addDays(today, -((range === 'today' ? 1 : range === '7d' ? 7 : 30) - 1));
  const count = (name: string, f: string, to = today): number => {
    let s = 0;
    for (const [key, c] of w.traffic) {
      const [venue, minute, nm] = key.split('|') as [string, string, string];
      const day = localParts(Date.parse(minute), 'Asia/Jerusalem').date;
      if (venue === v.row.id && nm === name && c.demo === v.row.isDemo && day >= f && day <= to) s += c.n;
    }
    return s;
  };
  const totalsOf = (f: string) => Object.fromEntries(TODAY_KEYS.map((k) => [k, count(KEY_EVENT[k], f)])) as ClientDashboard['totals'];
  const totals = totalsOf(from), todays = totalsOf(today);
  const progress = onboardingProgress(v.steps);
  const nudges: Nudge[] = [];
  if (v.row.review === 'pending') nudges.push({ code: 'approval_pending', count: 1, targets: [{ kind: 'venue', id: v.row.id }] });
  if (!progress.complete) nudges.push({ code: 'onboarding_step', count: progress.total - progress.done, targets: progress.next ? [{ kind: 'step', id: progress.next }] : [] });
  const waiting = v.cases.filter((c) => c.status === 'waiting_owner');
  if (waiting.length) nudges.push({ code: 'case_waiting_owner', count: waiting.length, targets: waiting.map((c) => ({ kind: 'case', id: c.id })) });
  const noPrice = v.dishes.filter((d) => !d.hidden && d.price === null);
  if (noPrice.length) nudges.push({ code: 'dish_no_price', count: noPrice.length, targets: noPrice.slice(0, 20).map((d) => ({ kind: 'dish', id: d.id })) });
  const nameOf = (kind: string, id: string): Text => {
    const d = v.dishes.find((x) => x.id === id) ?? v.sections.find((x) => x.id === id);
    if (d) return t(d.name_en, d.name_he);
    const o = v.snapshot?.addonGroups.flatMap((g) => g.options).find((x) => x.id === id);
    return o ? o.name : t('', kind);
  };
  const days = [];
  for (let d = from; d <= today; d = addDays(d, 1)) days.push({ day: d, opens: count('menu_opened', d, d), views: count('dish_viewed', d, d), adds: count('basket_added', d, d), capped: false });
  return {
    v: 2, venueId: v.row.id, range, from, to: today, timeZone: 'Asia/Jerusalem', demo: v.row.isDemo, generatedAt: iso(n), rolledUpAt: w.rolledUpAt,
    totals, opensBy: { qr: 0, link: totals.menuOpens, he: 0, en: 0 }, days, capped: [], lastHour: [], topDishes: [], rules: [],
    offNow: v.off.map((o, i) => ({ overrideId: uuid(0x3001 + i), kind: o.kind, id: o.id, name: nameOf(o.kind, o.id), from: o.from, until: o.until,
      untilKind: o.until ? 'duration' : 'indefinite', by: 'counter', today: true })),
    menu: { live: v.row.menu.live, revision: v.row.menu.revision, lastPublishedAt: v.row.menu.lastPublishedAt, review: v.row.review },
    onboarding: progress.steps, progress: { done: progress.done, total: progress.total, next: progress.next, complete: progress.complete },
    nudges, activity: structuredClone(v.activity.slice(0, 20)), today: { totals: todays, opensBy: { qr: 0, link: todays.menuOpens, he: 0, en: 0 }, topDishes: [] },
  };
}

/** `export_menu`: the owner's tables as stored (the columns this fake keeps), logged as `menu.export`. */
function exportMenu(w: World, v: FakeVenue): MenuExport {
  const counts = { sections: v.sections.length, dishes: v.dishes.length };
  log(w, v, 'menu.export', { via: 'rpc', targetTable: 'venues', targetIds: [v.row.id], detail: { counts } });
  return {
    v: 1, kind: 'mana.menu_export', exportedAt: iso(w.now()),
    venue: { id: v.row.id, slug: v.row.slug, name: v.row.name, kind: v.row.kind, mode: v.row.mode, timeZone: 'Asia/Jerusalem', defaultLang: 'he', langs: ['he', 'en'],
      soldOutDisplay: 'bottom' },
    publishedRevision: v.row.menu.revision, assetBase: null,
    tables: {
      schedules: [], sections: structuredClone(v.sections) as unknown as MenuExport['tables']['sections'],
      dishes: structuredClone(v.dishes) as unknown as MenuExport['tables']['dishes'], addon_groups: [], addon_options: [], dish_addon_groups: [], dish_relations: [],
      upsell_rules: [], venue_hours: [], venue_closures: [], assets: [],
    },
  };
}

function actForOwner(w: World, v: FakeVenue, reason: string, action: string, p: Record<string, unknown>): Record<string, unknown> {
  if (!v.row.supportCanAct) return { ok: false, code: 'owner_declined' };
  const via = { via: 'act_for_owner' as const, reason };
  let result: Record<string, unknown>;
  let ids: string[] = [];
  switch (action) {
    case 'availability.restore': {
      const before = v.off.length;
      v.off = v.off.filter((o) => !(o.kind === p.targetKind && o.id === p.targetId));
      result = { restored: before - v.off.length };
      ids = [String(p.targetId)];
      if (before !== v.off.length) log(w, v, 'availability_overrides.update', { ...via, targetTable: 'availability_overrides', targetIds: [uuid(0x3001)],
        detail: { columns: ['restored_at'], changes: { restored_at: [null, iso(w.now())] }, target_kind: p.targetKind, target_id: p.targetId } });
      break;
    }
    case 'availability.set': {
      const until = p.until as { kind: string; minutes?: number };
      const untilAt = until.kind === 'duration' ? iso(Math.ceil((w.now() + (until.minutes ?? 0) * MIN) / MIN) * MIN) : null;
      v.off.push({ kind: p.targetKind as OffEntry['kind'], id: String(p.targetId), from: iso(w.now()), until: untilAt });
      const e = log(w, v, 'availability_overrides.insert', { ...via, targetTable: 'availability_overrides', targetIds: [uuid(0x3100 + w.nextLog)],
        detail: { target_kind: p.targetKind, target_id: p.targetId, until_kind: until.kind, until_at: untilAt } });
      result = { overrideId: e.targetIds[0], untilAt };
      ids = [String(p.targetId)];
      break;
    }
    case 'dish.update': {
      // the owner's tables, not the published menu: guests see the change after the next publish
      const d = v.dishes.find((x) => x.id === p.dishId);
      if (!d) return { ok: false, code: 'target_unknown' };
      // refused when the owner changed the dish since the review read it (the string as read, at full precision)
      if (p.expectedUpdatedAt !== d.updated_at) {
        return { ok: false, code: 'stale', action, current: { id: d.id, name_he: d.name_he, name_en: d.name_en, price: d.price, hidden: d.hidden, updated_at: d.updated_at } };
      }
      const patch = p.patch as { price?: number | null; hidden?: boolean };
      Object.assign(d, patch, { updated_at: iso(Math.max(w.now(), Date.parse(d.updated_at) + 1)) });
      log(w, v, 'dishes.update', { ...via, targetTable: 'dishes', targetIds: [d.id], targetName: t(d.name_en, d.name_he), detail: { columns: Object.keys(patch) } });
      result = { dishId: d.id, fields: Object.keys(patch) };
      ids = [d.id];
      break;
    }
    case 'onboarding.set': {
      const step = p.step as OnboardingStep, state = p.state as OnboardingState;
      const s = v.steps.find((x) => x.step === step);
      if (p.expectedUpdatedAt !== (s?.updatedAt ?? null)) {
        return { ok: false, code: 'stale', action, current: { step, state: s?.state ?? 'todo', blockers: s?.blockers ?? [], updatedAt: s?.updatedAt ?? null } };
      }
      if (s) { s.state = state; s.updatedAt = iso(w.now()); } else v.steps.push({ step, state, blockers: [], updatedAt: iso(w.now()) });
      const pr = onboardingProgress(v.steps);
      v.row.onboarding = { ...v.row.onboarding, stage: pr.next ?? 'complete', done: pr.done };
      log(w, v, 'onboarding_progress.update', { ...via, targetIds: [`${v.row.id}/${step}`], detail: { columns: ['state'], changes: { state: [null, state] } } });
      result = { step, state };
      break;
    }
    case 'support_case.update': {
      const c = v.cases.find((x) => x.id === p.caseId);
      if (!c) return { ok: false, code: 'target_unknown' };
      c.status = p.status as CaseStatus;
      log(w, v, 'support_cases.update', { ...via, targetTable: 'support_cases', targetIds: [c.id], detail: { columns: ['status'], changes: { status: [null, c.status] } } });
      result = { caseId: c.id, status: c.status };
      ids = [c.id];
      break;
    }
    default:
      return { ok: false, code: 'action_unknown' };
  }
  const own = log(w, v, 'support.act_for_owner', { ...via, targetIds: ids, detail: { action, keys: Object.keys(p).sort() } });
  return { ok: true, action, result, logId: own.id };
}

function handle(w: World, user: string | null, fn: RpcName, a: Readonly<Record<string, unknown>>): unknown {
  const role = user ? w.staff.get(user) ?? null : null;
  const staffOnly = (): StaffRole => role ?? notStaff();
  const reasonOf = (): string | null => (isReason(a.p_reason) ? stripBlank(a.p_reason) : null);
  switch (fn) {
    case 'public_menu': {
      const v = w.venues.find((x) => x.row.slug === a.p_slug);
      if (!v) return { state: 'not_found' };
      if (!v.snapshot || v.row.review !== 'approved' || !v.row.menu.live) return { state: 'unavailable', venue: { name: v.row.name } };
      return { state: 'ok', snapshot: v.snapshot, live: { ...liveOf(v.off, iso(w.now())) } };
    }
    case 'redeem_staff_invite': {
      if (!user) return { ok: false, code: 'signed_out' };
      if (role) return { ok: true };
      if (a.p_code !== 'a'.repeat(48)) return { ok: false, code: 'invalid' };
      w.staff.set(user, 'support');
      return { ok: true, role: 'support' };
    }
    case 'ops_venues': staffOnly(); return venues(w, (a.p_filters ?? {}) as OpsVenuesQuery);
    case 'ops_venue': { staffOnly(); const v = find(w, a.p_venue); return v ? detail(v) : bad('venue_unknown'); }
    case 'ops_analytics': staffOnly(); return analytics(w, a.p_query as OpsAnalyticsQuery);
    case 'ops_revision': {
      staffOnly();
      const v = find(w, a.p_venue);
      if (!v) return { ok: false, code: 'venue_unknown' };
      const latest = v.revisions.at(-1)?.number ?? null;
      const r = v.revisions.find((x) => x.number === ((a.p_revision as number | null) ?? latest));
      if (!r) return { ok: false, code: 'revision_unknown' };
      log(w, v, 'menu.read', { via: 'rpc', targetTable: 'menu_revisions', targetIds: [r.id], detail: { revision: r.number } });
      return { ok: true, venueId: v.row.id, revision: { id: r.id, number: r.number, createdAt: r.createdAt, note: r.note, live: r.number === v.row.menu.revision },
        latest, review: v.row.review, snapshot: r.snapshot };
    }
    case 'ops_approve_venue': {
      staffOnly();
      const reason = reasonOf();
      if (!reason) return { ok: false, code: 'reason_required' };
      const v = find(w, a.p_venue);
      if (!v) return { ok: false, code: 'venue_unknown' };
      if (v.row.approvedAt) return { ok: false, code: 'already_approved' };
      if (!v.row.menu.firstPublishedAt) return { ok: false, code: 'not_published' };
      // the round-3 signature: approves the revision the review named, only while it is still the newest
      const latest = v.revisions.at(-1)?.number ?? v.row.menu.revision;
      if (a.p_expected_revision !== latest) return { ok: false, code: 'revision_changed', revision: latest };
      v.row.approvedAt = iso(w.now()); v.row.review = 'approved';
      v.row.warnings = v.row.warnings.filter((x) => x !== 'awaiting_review');
      v.row.plan = { ...v.row.plan, state: 'trialing', trialEndsAt: iso(w.now() + 30 * DAY) };
      // the audit triggers' rows of the same call (the same instant), without the reason: the named entry carries it
      const at = iso(w.now());
      log(w, v, 'venues.update', { at, via: 'rpc', targetTable: 'venues', detail: { columns: ['approved_at'] } });
      log(w, v, 'entitlements.update', { at, via: 'rpc', targetTable: 'entitlements', detail: { columns: ['status', 'trial_ends_at'], changes: { status: ['pending', 'trialing'] } } });
      log(w, v, 'venue.approve', { at, via: 'rpc', reason, detail: { trialEndsAt: v.row.plan.trialEndsAt, revision: latest } });
      return { ok: true, trialEndsAt: v.row.plan.trialEndsAt };
    }
    case 'act_for_owner': {
      staffOnly();
      const reason = reasonOf();
      if (!reason) return { ok: false, code: 'reason_required' };
      const v = find(w, a.p_venue);
      if (!v) return { ok: false, code: 'venue_unknown' };
      return actForOwner(w, v, reason, String(a.p_action), (a.p_payload ?? {}) as Record<string, unknown>);
    }
    case 'ops_update_case': {
      staffOnly();
      const reason = reasonOf();
      if (!reason) return { ok: false, code: 'reason_required' };
      const v = w.venues.find((x) => x.cases.some((c) => c.id === a.p_case));
      const c = v?.cases.find((x) => x.id === a.p_case);
      if (!v || !c) return { ok: false, code: 'case_unknown' };
      if (typeof a.p_status === 'string') { c.status = a.p_status as CaseStatus; c.resolvedAt = c.status === 'resolved' ? iso(w.now()) : null; }
      if (typeof a.p_topic === 'string') c.topic = a.p_topic as SupportCase['topic'];
      c.updatedAt = iso(w.now());
      v.row.openCases = v.cases.filter((x) => x.status !== 'resolved').length;
      log(w, v, 'support_cases.update', { via: 'rpc', reason, targetTable: 'support_cases', targetIds: [c.id], detail: { columns: ['status'], changes: { status: [null, c.status] } } });
      return { ok: true, case: structuredClone(c) };
    }
    case 'ops_set_demo': {
      if (staffOnly() !== 'admin') throw new RpcError('42501', 'not_admin', 403);
      const v = find(w, a.p_venue);
      if (!v) return { ok: false, code: 'venue_unknown' };
      v.row.isDemo = a.p_demo === true;
      log(w, v, 'venue.set_demo', { via: 'rpc', reason: reasonOf(), detail: { demo: v.row.isDemo } });
      return { ok: true, demo: v.row.isDemo };
    }
    case 'ops_set_plan': {
      if (staffOnly() !== 'admin') throw new RpcError('42501', 'not_admin', 403);
      const reason = reasonOf();
      if (!reason) return { ok: false, code: 'reason_required' };
      const v = find(w, a.p_venue);
      if (!v) return { ok: false, code: 'venue_unknown' };
      // the round-3 rule: a plan never lets guests in before the first publish is approved
      if (v.row.review === 'pending' && (a.p_state === 'trialing' || a.p_state === 'active')) return { ok: false, code: 'approval_first' };
      const was = v.row.plan.state;
      v.row.plan = { plan: (a.p_plan as Plan | null) ?? v.row.plan.plan, state: a.p_state as EntitlementStatus,
        trialEndsAt: a.p_state === 'trialing' ? (a.p_until as string | null) ?? iso(w.now() + 30 * DAY) : v.row.plan.trialEndsAt };
      const at = iso(w.now());
      log(w, v, 'entitlements.update', { at, via: 'rpc', targetTable: 'entitlements', detail: { columns: ['status'], changes: { status: [was, v.row.plan.state] } } });
      log(w, v, 'plan.set', { at, via: 'rpc', reason, detail: { state: a.p_state, plan: a.p_plan, until: a.p_until } });
      return { ok: true, state: v.row.plan.state };
    }
    case 'venue_activity': {
      staffOnly();
      const v = find(w, a.p_venue);
      if (!v) return bad('venue_unknown');
      const limit = typeof a.p_limit === 'number' ? Math.min(a.p_limit, ACTIVITY_PAGE_MAX) : 50;
      const before = typeof a.p_before === 'number' ? a.p_before : null;
      const all = v.activity.filter((e) => (before === null || e.id < before) && (a.p_actor == null || e.actorKind === a.p_actor) && (a.p_via == null || e.via === a.p_via));
      const entries = all.slice(0, limit);
      return { entries: structuredClone(entries), next: all.length > limit ? entries.at(-1)!.id : null };
    }
    case 'my_dashboard': {
      staffOnly();
      const v = find(w, a.p_venue);
      if (!v) return bad('venue_unknown');
      return dashboard(w, v, (a.p_range as 'today' | '7d' | '30d' | undefined) ?? 'today');
    }
    case 'export_menu': {
      staffOnly();
      const v = find(w, a.p_venue);
      if (!v) return bad('venue_unknown');
      return exportMenu(w, v);
    }
    case 'ops_leads': {
      staffOnly();
      const s = a.p_status;
      const leads = w.leads.filter((l) => (s === null || s === undefined ? l.status !== 'spam' : s === 'all' ? true : l.status === s));
      return { leads: structuredClone(leads), count: leads.length };
    }
    case 'ops_update_lead': {
      staffOnly();
      const l = w.leads.find((x) => x.id === a.p_id);
      if (!l) return { ok: false, code: 'not_found' };
      Object.assign(l, { status: (a.p_status as string | null) ?? l.status, owner: (a.p_owner as string | null) ?? l.owner, notes: (a.p_notes as string | null) ?? l.notes });
      return { ok: true };
    }
  }
}

/** Simulated guests: `n` of each event name for one venue in the current minute (what the sim's guests and a rollup run do). */
export function addTraffic(w: World, venueId: string, counts: Partial<Record<string, number>>): void {
  const v = find(w, venueId);
  const minute = iso(Math.floor(w.now() / MIN) * MIN);
  for (const [name, n] of Object.entries(counts)) {
    const key = `${venueId}|${minute}|${name}`;
    const was = w.traffic.get(key)?.n ?? 0;
    w.traffic.set(key, { n: was + (n ?? 0), demo: v?.row.isDemo ?? false });
  }
  w.rolledUpAt = minute;
  refreshCounts(w);
}

/** The fake as a `Backend` for one signed-in user (null = signed out). */
export function fakeBackend(w: World, user: string | null): Backend {
  const fault = (fn: string): Raw | null => {
    const f = w.faults[fn];
    if (!f) return null;
    if (f.times !== undefined && --f.times <= 0) delete w.faults[fn];
    const err = { missing: { code: 'PGRST202', message: `Could not find the function public.${fn}`, status: 404 }, not_staff: { code: '42501', message: 'not_staff', status: 403 },
      jwt: { code: 'PGRST301', message: 'JWT expired', status: 401 }, error: { code: 'XX000', message: 'fake: a database error', status: 500 },
      timeout: { name: 'TimeoutError', message: 'timeout' }, garbage: null }[f.mode];
    return err ? { data: null, error: err } : { data: null, error: null };
  };
  const wait = async (fn: string) => { const ms = w.delays[fn]; if (ms) await new Promise((r) => setTimeout(r, ms)); };
  return {
    async rpc(fn, args) {
      w.calls.push({ fn, args, user });
      await wait(fn);
      const f = fault(fn);
      if (f) return f;
      if (!user) return { data: null, error: { code: 'PGRST301', message: 'JWT expired', status: 401 } };
      try { return { data: structuredClone(handle(w, user, fn, args)), error: null }; } catch (e) {
        if (e instanceof RpcError) return { data: null, error: { code: e.code, message: e.message, status: e.status } };
        throw e;
      }
    },
    async staffRow(userId) {
      w.calls.push({ fn: 'staff', args: { userId }, user });
      const role = w.staff.get(userId);
      return { data: role ? { role } : null, error: null };
    },
    /** Under RLS: a dish of any venue for staff, nothing for anyone else. */
    async dishRow(dishId) {
      w.calls.push({ fn: 'dishes', args: { dishId }, user });
      await wait('dishes');
      if (!user || !w.staff.has(user)) return { data: null, error: null };
      const d = w.venues.flatMap((v) => v.dishes).find((x) => x.id === dishId);
      return { data: d ? { id: d.id, name_he: d.name_he, name_en: d.name_en, price: d.price, hidden: d.hidden, updated_at: d.updated_at } : null, error: null };
    },
  };
}

