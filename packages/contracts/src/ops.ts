/**
 * The back office (F09, phase 1): the clients list, one venue's detail, real-time analytics across venues or for one,
 * and the demo switch. Staff only (`support` and `admin`); every number is from the rollups and the state tables, and
 * staff write only through logged functions (ADR-003). Demo venues are labelled and left out of real totals unless a
 * query asks for them.
 */
import { isInt, isUuid, oneOf, type Text, type Validation } from './common.ts';
import type { ActivityAction, ActivityEntry } from './activity.ts';
import type { DashboardMenu } from './dashboard.ts';
import {
  ENTITLEMENT_STATUSES, ONBOARDING_STEPS, PLANS, REVIEW_STATES, type EntitlementStatus, type ImportSource, type ImportStatus,
  type OnboardingStep, type Plan, type ReviewState, type VenueKind, type VenueMode,
} from './enums.ts';
import { EVENT_NAMES, instantMs, type EventName } from './events.ts';
import type { DraftCounts, ImportExceptionCode } from './import.ts';
import type { OnboardingProgress } from './onboarding.ts';
import { isReason, requiredText, validateInput, type RpcFail, type RpcOk } from './rpc.ts';
import type { SnapshotV2 } from './snapshot.ts';
import { REVISION_MAX } from './staff.ts';
import type { SupportCase } from './support.ts';
import { isLocalDate, type LocalDate } from './time.ts';

/**
 * Warnings on a venue's row, in this order. The rules (the database's):
 * - `awaiting_review`: the first publish waits for Halom's approval;
 * - `stuck_step_2d`: the journey is not complete and its next step has not changed for 2 days;
 * - `not_published_2d`: created more than 2 days ago, never published;
 * - `no_publish_7d`: published, but not in the last 7 days;
 * - `import_failed`: an import failed in the last 2 days (the scanner is failing for this venue);
 * - `case_open`: a case is open or waiting for Halom;
 * - `case_waiting`: a case has waited for Halom for more than a day;
 * - `events_capped`: a cap dropped this venue's events in the last 7 days.
 */
export const OPS_WARNINGS = [
  'awaiting_review', 'stuck_step_2d', 'not_published_2d', 'no_publish_7d', 'import_failed', 'case_open', 'case_waiting', 'events_capped',
] as const;
export type OpsWarning = (typeof OPS_WARNINGS)[number];

/** One venue in the clients list. A superset of phase 0's `ops_overview` card. */
export type OpsVenueRow = {
  readonly id: string;
  readonly slug: string;
  readonly name: Text;
  readonly kind: VenueKind;
  readonly mode: VenueMode;
  readonly isDemo: boolean;
  readonly createdAt: string;
  readonly supportCanAct: boolean;
  readonly review: ReviewState;
  readonly approvedAt: string | null;
  readonly onboarding: {
    /** The next step, or 'complete'. */
    readonly stage: OnboardingStep | 'complete';
    readonly done: number;
    readonly total: number;
    /** When the next step last changed (or the venue was created): "stuck since". null when complete. */
    readonly since: string | null;
    readonly blocked: ReadonlyArray<{ readonly step: OnboardingStep; readonly blockers: readonly string[] }>;
  };
  readonly menu: Omit<DashboardMenu, 'review'> & { readonly firstPublishedAt: string | null };
  /** Menu opens (demo traffic on a demo venue, real traffic otherwise). */
  readonly opens: { readonly today: number; readonly last7d: number; readonly lastHour: number };
  readonly cappedToday: boolean;
  readonly suggestions7d: { readonly shown: number; readonly accepted: number; readonly dismissed: number };
  readonly photos: {
    /** Dishes guests can see. */
    readonly dishes: number;
    /** Of those, with an approved photo or relief. */
    readonly withPhoto: number;
    /** Pictures waiting for the owner's approval (`ready_for_review`). */
    readonly awaitingReview: number;
  };
  readonly imports: {
    readonly total: number;
    readonly lastAt: string | null;
    readonly lastStatus: ImportStatus | null;
    readonly failed2d: number;
  };
  readonly openCases: number;
  readonly lastOwnerSignInAt: string | null;
  readonly lastActivityAt: string | null;
  readonly plan: { readonly plan: Plan; readonly state: EntitlementStatus; readonly trialEndsAt: string | null };
  readonly warnings: readonly OpsWarning[];
};

/** The whole fleet's numbers, real venues only, whatever the filters. */
export type OpsTotals = {
  readonly venues: number;
  readonly live: number;
  readonly awaitingReview: number;
  readonly demoVenues: number;
  readonly opensToday: number;
  readonly openCases: number;
  readonly actsForOwner7d: number;
};

export const DEMO_SCOPES = ['exclude', 'include', 'only'] as const;
export type DemoScope = (typeof DEMO_SCOPES)[number];
export const OPS_SORTS = ['created', 'activity', 'opens_today', 'name'] as const;
export type OpsSort = (typeof OPS_SORTS)[number];
export const OPS_PAGE_MAX = 500;

/** `ops_venues`: the clients list. Every filter is optional; they combine with "and". */
export type OpsVenuesQuery = {
  /** A part of the name (either language) or of the slug, any case; 1–80 characters once blank edges are stripped
   * (the database searches for the stripped text). */
  readonly q?: string;
  readonly stage?: OnboardingStep | 'complete';
  readonly warning?: OpsWarning;
  readonly review?: ReviewState;
  readonly planState?: EntitlementStatus;
  readonly plan?: Plan;
  /** Default 'include': the list shows demo venues, labelled. */
  readonly demo?: DemoScope;
  /** Default 'created' (newest first); 'activity' and 'opens_today' are highest first; 'name' A–Z by English, then Hebrew. */
  readonly sort?: OpsSort;
  /** 1–500; default 200. */
  readonly limit?: number;
  readonly offset?: number;
};
export type OpsVenues = {
  readonly generatedAt: string;
  readonly rolledUpAt: string | null;
  readonly totals: OpsTotals;
  /** How many venues match the filters (the page is `venues`). */
  readonly total: number;
  readonly venues: readonly OpsVenueRow[];
};

/** Codes: type, field_not_allowed, text_too_long, text_missing, enum_invalid, limit_invalid. */
export function validateOpsVenuesQuery(raw: unknown): Validation<OpsVenuesQuery> {
  return validateInput<OpsVenuesQuery>(raw, ['q', 'stage', 'warning', 'review', 'planState', 'plan', 'demo', 'sort', 'limit', 'offset'], (x, o) => {
    if (o.q !== undefined) requiredText(x, o.q, 'q', 80);
    if (o.stage !== undefined && o.stage !== 'complete' && !oneOf(ONBOARDING_STEPS, o.stage)) x.add('enum_invalid', 'stage');
    if (o.warning !== undefined && !oneOf(OPS_WARNINGS, o.warning)) x.add('enum_invalid', 'warning');
    if (o.review !== undefined && !oneOf(REVIEW_STATES, o.review)) x.add('enum_invalid', 'review');
    if (o.planState !== undefined && !oneOf(ENTITLEMENT_STATUSES, o.planState)) x.add('enum_invalid', 'planState');
    if (o.plan !== undefined && !oneOf(PLANS, o.plan)) x.add('enum_invalid', 'plan');
    if (o.demo !== undefined && !oneOf(DEMO_SCOPES, o.demo)) x.add('enum_invalid', 'demo');
    if (o.sort !== undefined && !oneOf(OPS_SORTS, o.sort)) x.add('enum_invalid', 'sort');
    if (o.limit !== undefined && !(isInt(o.limit) && o.limit >= 1 && o.limit <= OPS_PAGE_MAX)) x.add('limit_invalid', 'limit');
    if (o.offset !== undefined && !(isInt(o.offset) && o.offset >= 0)) x.add('limit_invalid', 'offset');
  });
}

/** An import as the back office lists it: what came in and what the reader made of it, never the raw input. */
export type OpsImport = {
  readonly id: string;
  readonly source: ImportSource;
  readonly status: ImportStatus;
  readonly createdAt: string;
  readonly appliedAt: string | null;
  readonly errorCode: string | null;
  readonly rightsConfirmed: boolean;
  /** null until it is read. */
  readonly counts: DraftCounts | null;
  readonly exceptions: { readonly fix: number; readonly check: number; readonly byCode: Readonly<Partial<Record<ImportExceptionCode, number>>> };
};

/** `ops_venue(venue)`: one venue, everything support needs to follow it. */
export type OpsVenueDetail = {
  readonly venue: OpsVenueRow;
  readonly members: { readonly owners: number; readonly managers: number; readonly counters: number };
  readonly onboarding: OnboardingProgress;
  /** Newest first, at most 20. */
  readonly imports: readonly OpsImport[];
  /** Every open case, then the newest resolved ones (at most 20 in all beyond the open ones). */
  readonly cases: readonly SupportCase[];
  /** The venue's log, newest first, at most 100: the timeline (`timelineKind` groups it). */
  readonly activity: readonly ActivityEntry[];
};

export const TIMELINE_KINDS = ['onboarding', 'import', 'publish', 'case', 'halom', 'availability', 'menu', 'settings'] as const;
export type TimelineKind = (typeof TIMELINE_KINDS)[number];

/** Which strand of a venue's timeline an activity belongs to. */
export function timelineKind(action: ActivityAction): TimelineKind {
  if (action.startsWith('onboarding_progress.')) return 'onboarding';
  if (action.startsWith('menu_imports.') || action === 'import.apply') return 'import';
  if (action === 'menu.export') return 'menu';
  if (action.startsWith('menu.') || action === 'venue.approve') return 'publish';
  if (action.startsWith('support_cases.')) return 'case';
  if (action === 'support.act_for_owner' || action === 'plan.set' || action === 'venue.set_demo' || action.startsWith('entitlements.')) return 'halom';
  if (action.startsWith('availability_overrides.')) return 'availability';
  if (/^(sections|dishes|assets|addon_groups|addon_options|dish_addon_groups|dish_relations|upsell_rules|schedules)\./.test(action) ||
      action === 'upsell_rules.deactivated') return 'menu';
  return 'settings';
}

// ---------------------------------------------------------------- analytics

export const ANALYTICS_RESOLUTIONS = ['minute', 'day'] as const;
export type AnalyticsResolution = (typeof ANALYTICS_RESOLUTIONS)[number];
/** A minute series spans at most a day; minute rollups are kept 35 days. A day series spans at most 400 days. */
export const ANALYTICS_MAX = { minuteSpanMs: 24 * 3600_000, minuteRetentionDays: 35, days: 400 } as const;

/**
 * `ops_analytics`: event counts per minute (`from`/`to` are instants with an offset; `from` inclusive, `to` exclusive,
 * whole minutes) or per day (`from`/`to` are local dates, both inclusive), across every venue or one. Real traffic
 * only unless `demo` says otherwise.
 */
export type OpsAnalyticsQuery = {
  readonly venueId?: string | null;
  readonly resolution: AnalyticsResolution;
  readonly from: string;
  readonly to: string;
  readonly demo?: DemoScope;
  /** Default: every event name. */
  readonly names?: readonly EventName[];
};

export type OpsAnalytics = {
  readonly generatedAt: string;
  readonly rolledUpAt: string | null;
  readonly resolution: AnalyticsResolution;
  readonly venueId: string | null;
  readonly demo: DemoScope;
  /** Each bucket's start: an ISO minute, or a local date. */
  readonly buckets: readonly string[];
  /** One count per bucket, per requested name (zeros included). */
  readonly series: Readonly<Partial<Record<EventName, readonly number[]>>>;
  readonly totals: Readonly<Partial<Record<EventName, number>>>;
  /** Of the venues created in the range: how many imported a menu, published, and were approved. */
  readonly funnel: { readonly created: number; readonly imported: number; readonly published: number; readonly approved: number };
  /** The imports created in the range, and their exceptions. */
  readonly imports: {
    readonly total: number;
    readonly parsed: number;
    readonly applied: number;
    readonly discarded: number;
    readonly failed: number;
    /** Imports with at least one `fix` exception. */
    readonly withFix: number;
    readonly exceptions: number;
    readonly bySource: ReadonlyArray<{ readonly source: ImportSource; readonly total: number; readonly applied: number; readonly failed: number; readonly withFix: number }>;
    readonly byCode: ReadonlyArray<{ readonly code: ImportExceptionCode; readonly n: number }>;
  };
};

/** Codes: type, field_not_allowed, id_invalid, enum_invalid, time_invalid, date_invalid, range_invalid, range_too_long. */
export function validateOpsAnalyticsQuery(raw: unknown): Validation<OpsAnalyticsQuery> {
  return validateInput<OpsAnalyticsQuery>(raw, ['venueId', 'resolution', 'from', 'to', 'demo', 'names'], (x, o) => {
    if (o.venueId !== undefined && o.venueId !== null && !isUuid(o.venueId)) x.add('id_invalid', 'venueId');
    if (o.demo !== undefined && !oneOf(DEMO_SCOPES, o.demo)) x.add('enum_invalid', 'demo');
    if (o.names !== undefined && (!Array.isArray(o.names) || o.names.length === 0 || !o.names.every((n) => oneOf(EVENT_NAMES, n)) ||
        new Set(o.names).size !== o.names.length)) x.add('enum_invalid', 'names');
    if (o.resolution === 'minute') {
      const from = instantMs(o.from), to = instantMs(o.to);
      if (Number.isNaN(from) || from % 60_000 !== 0) x.add('time_invalid', 'from');
      if (Number.isNaN(to) || to % 60_000 !== 0) x.add('time_invalid', 'to');
      if (!Number.isNaN(from) && !Number.isNaN(to)) {
        if (to <= from) x.add('range_invalid', 'to');
        else if (to - from > ANALYTICS_MAX.minuteSpanMs) x.add('range_too_long', 'to');
      }
    } else if (o.resolution === 'day') {
      if (!isLocalDate(o.from)) x.add('date_invalid', 'from');
      if (!isLocalDate(o.to)) x.add('date_invalid', 'to');
      if (isLocalDate(o.from) && isLocalDate(o.to)) {
        if (o.to < o.from) x.add('range_invalid', 'to');
        else if (daysBetween(o.from, o.to) + 1 > ANALYTICS_MAX.days) x.add('range_too_long', 'to');
      }
    } else x.add('enum_invalid', 'resolution');
  });
}

const daysBetween = (a: LocalDate, b: LocalDate): number => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

// ---------------------------------------------------------------- the demo switch

/** `ops_set_demo` (admins): label a venue as demo or real. Logged with the reason. Stored events and rollups keep the
 * label they were counted with (records are append-only); the switch applies from the next event. A staff member who
 * belongs to the venue never labels it (`own_venue`). */
export type SetDemoInput = { readonly venueId: string; readonly demo: boolean; readonly reason: string };
export type SetDemoReply = RpcOk<{ readonly demo: boolean }> | RpcFail<'reason_required' | 'venue_unknown' | 'own_venue'>;

/** Codes: type, field_not_allowed, id_invalid, reason_required. */
export function validateSetDemo(raw: unknown): Validation<SetDemoInput> {
  return validateInput<SetDemoInput>(raw, ['venueId', 'demo', 'reason'], (x, o) => {
    if (!isUuid(o.venueId)) x.add('id_invalid', 'venueId');
    if (typeof o.demo !== 'boolean') x.add('type', 'demo');
    if (!isReason(o.reason)) x.add('reason_required', 'reason');
  });
}

/** `ops_venue(venue)`'s input. */
export type OpsVenueQuery = { readonly venueId: string };
export function validateOpsVenueQuery(raw: unknown): Validation<OpsVenueQuery> {
  return validateInput<OpsVenueQuery>(raw, ['venueId'], (x, o) => void (isUuid(o.venueId) || x.add('id_invalid', 'venueId')));
}

// ---------------------------------------------------------------- a stored revision, as staff read it

/**
 * `ops_revision(p_venue, p_revision)` (staff; a caller who is not staff gets 42501 `not_staff`): one stored revision
 * of a venue's menu, the newest when `revision` is null or absent. Each read is logged (`menu.read`).
 */
export type OpsRevisionQuery = { readonly venueId: string; readonly revision?: number | null };
export type OpsRevision =
  | RpcOk<{
      readonly venueId: string;
      /** `live`: this is the published revision (`venues.published_revision_id`), the one guests see once approved. */
      readonly revision: { readonly id: string; readonly number: number; readonly createdAt: string; readonly note: string | null; readonly live: boolean };
      /** The newest revision's number (not always the published one: a restore publishes an older revision). */
      readonly latest: number;
      readonly review: ReviewState;
      readonly snapshot: SnapshotV2;
    }>
  | RpcFail<'venue_unknown' | 'revision_unknown'>;

/** Codes: type, field_not_allowed, id_invalid, revision_invalid. */
export function validateOpsRevisionQuery(raw: unknown): Validation<OpsRevisionQuery> {
  return validateInput<OpsRevisionQuery>(raw, ['venueId', 'revision'], (x, o) => {
    if (!isUuid(o.venueId)) x.add('id_invalid', 'venueId');
    if (o.revision !== undefined && o.revision !== null && !(isInt(o.revision) && o.revision >= 1 && o.revision <= REVISION_MAX)) x.add('revision_invalid', 'revision');
  });
}
