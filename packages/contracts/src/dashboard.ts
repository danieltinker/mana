/**
 * The client dashboard (F08) as `my_dashboard(venue, range)` returns it, version 2: today at a glance, what is off now
 * and until when, nudges as codes with targets, per-rule numbers, onboarding progress per step, the latest activity.
 * Numbers come from the rollups (ADR-004): demo traffic counts only on a demo venue's own dashboard.
 *
 * It extends the phase-0 reply without renaming anything (readers of v1 fields keep working) and says `v: 2`.
 * How it stays live (Realtime, or polling when the environment has none) is ADR-007; the numbers to use are below.
 */
import { isUuid, oneOf, type Text, type Validation } from './common.ts';
import type { ActivityEntry } from './activity.ts';
import type { UpsellRuleRow } from './domain.ts';
import type { ActorKind, ReviewState, TargetKind, Trigger, UntilKind } from './enums.ts';
import type { OnboardingProgress, OnboardingStepView } from './onboarding.ts';
import { validateInput } from './rpc.ts';
import type { LocalDate } from './time.ts';

export const DASHBOARD_RANGES = ['today', '7d', '30d'] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export type DashboardTotals = {
  readonly menuOpens: number;
  readonly dishViews: number;
  readonly addonsChosen: number;
  readonly basketAdds: number;
  readonly suggestionsShown: number;
  readonly suggestionsAccepted: number;
  readonly suggestionsDismissed: number;
};
export type OpensBy = { readonly qr: number; readonly link: number; readonly he: number; readonly en: number };
export type DashboardDay = { readonly day: LocalDate; readonly opens: number; readonly views: number; readonly adds: number; readonly capped: boolean };
/** One UTC minute of the last hour (`minute` is its start). Phase 0 sent `opens` only. */
export type DashboardMinute = { readonly minute: string; readonly opens: number; readonly views: number; readonly adds: number };
export type TopDish = { readonly dishId: string; readonly name: Text; readonly views: number; readonly adds: number };

export type RuleNumbers = {
  readonly ruleId: string;
  readonly label: string;
  readonly line: Text;
  readonly trigger: Trigger;
  readonly active: boolean;
  readonly inactiveReason: UpsellRuleRow['inactive_reason'];
  readonly shown: number;
  readonly accepted: number;
  readonly dismissed: number;
};

/** Something off right now (or a section covering it), with when it comes back. */
export type OffNowEntry = {
  readonly overrideId: string;
  readonly kind: TargetKind;
  readonly id: string;
  /** The target's name now (a section, dish or add-on option). */
  readonly name: Text;
  readonly from: string;
  /** null = until the owner restores it. Whole minutes (`resolveUntil`). */
  readonly until: string | null;
  readonly untilKind: UntilKind;
  readonly by: ActorKind;
  /** Taken off on the venue's local today: "restore everything off today" brings it back. */
  readonly today: boolean;
};

/**
 * Nudges, in the order the dashboard shows them, each with how many and up to `NUDGE_TARGETS_MAX` targets (in menu
 * order). The rules, which the database follows:
 * - `approval_pending`: the first publish waits for Halom's review (target: the venue);
 * - `onboarding_step`: the journey is not complete (target: the next step; count: the steps left);
 * - `import_waiting`: an import is read and waits for the owner's review (`status = 'parsed'`; targets: imports);
 * - `case_waiting_owner`: Halom answered a case and waits for the owner (targets: cases);
 * - `dish_no_price`: a dish guests can see has no price (targets: dishes);
 * - `dish_no_photo`: a dish guests can see has no photo or relief of its own (an illustration does not count);
 * - `group_without_limits`: an add-on group on a visible dish whose limits an import guessed and the owner has not
 *   confirmed yet (`addon_groups.limits_confirmed = false`; editing the limits, or confirming them, clears it).
 * A dish "guests can see" is not hidden and neither is its section.
 */
export const NUDGE_CODES = [
  'approval_pending', 'onboarding_step', 'import_waiting', 'case_waiting_owner', 'dish_no_price', 'dish_no_photo', 'group_without_limits',
] as const;
export type NudgeCode = (typeof NUDGE_CODES)[number];
export const NUDGE_TARGETS_MAX = 20;
export type NudgeTarget = { readonly kind: 'venue' | 'step' | 'import' | 'case' | 'dish' | 'group'; readonly id: string };
export type Nudge = { readonly code: NudgeCode; readonly count: number; readonly targets: readonly NudgeTarget[] };

export type DashboardMenu = {
  readonly live: boolean;
  readonly revision: number | null;
  readonly lastPublishedAt: string | null;
  readonly review: ReviewState;
};

/** Today (the venue's local date) whatever the range: the phone's first card. */
export type DashboardGlance = { readonly totals: DashboardTotals; readonly opensBy: OpensBy; readonly topDishes: readonly TopDish[] };

export type ClientDashboard = {
  readonly v: 2;
  readonly venueId: string;
  readonly range: DashboardRange;
  readonly from: LocalDate;
  readonly to: LocalDate;
  readonly timeZone: string;
  /** A demo venue: its numbers are demo traffic, labelled as such. */
  readonly demo: boolean;
  readonly generatedAt: string;
  /** When the rollup job last ran: numbers are complete up to that minute. */
  readonly rolledUpAt: string | null;
  readonly totals: DashboardTotals;
  readonly opensBy: OpensBy;
  readonly days: readonly DashboardDay[];
  /** Days a cap dropped events: the numbers of those days are a floor, never "a quiet day". */
  readonly capped: ReadonlyArray<{ readonly day: LocalDate; readonly dropped: number }>;
  readonly lastHour: readonly DashboardMinute[];
  /** Up to 10, by views then adds. */
  readonly topDishes: readonly TopDish[];
  readonly rules: readonly RuleNumbers[];
  readonly offNow: readonly OffNowEntry[];
  readonly menu: DashboardMenu;
  /** All nine steps of `ONBOARDING_STEPS`, in journey order (a step never written is `todo`). */
  readonly onboarding: readonly OnboardingStepView[];
  readonly progress: Omit<OnboardingProgress, 'steps'>;
  readonly nudges: readonly Nudge[];
  /** The newest 20 entries (the full log: `venue_activity`). */
  readonly activity: readonly ActivityEntry[];
  readonly today: DashboardGlance;
};

export type DashboardQuery = { readonly venueId: string; readonly range?: DashboardRange };
export function validateDashboardQuery(raw: unknown): Validation<DashboardQuery> {
  return validateInput<DashboardQuery>(raw, ['venueId', 'range'], (x, o) => {
    if (!isUuid(o.venueId)) x.add('id_invalid', 'venueId');
    if (o.range !== undefined && !oneOf(DASHBOARD_RANGES, o.range)) x.add('range_invalid', 'range');
  });
}

// ---------------------------------------------------------------- staying live (ADR-007)

/**
 * How the client app and the back office keep their numbers current. With Realtime (`config.realtime`), they
 * subscribe to Postgres changes on these tables (RLS applies to every message) and treat each message as a signal
 * to fetch the dashboard again, at most once per `debounceMs`; **while subscribed they still poll every `safetyMs`**
 * (only while the page is visible), since what the tables above do not carry (a new venue, a case, a warning, a
 * timeline entry) sends no message (ADR-007, amended in round 3). Without Realtime (the local stack has no Realtime
 * server), they poll every `pollMs`. Never while the page is hidden; after a failure, `pollDelay`'s backoff.
 */
export const LIVE_REFRESH = {
  realtimeTables: ['rollups_minute', 'rollups_day', 'availability_overrides'],
  debounceMs: 1500,
  pollMs: { owner: 15_000, ops: 30_000 },
  /** The slow poll beside a Realtime subscription. */
  safetyMs: 60_000,
  maxBackoffMs: 120_000,
} as const;

/** The subscription filter for one venue's rows (`postgres_changes` filter syntax). */
export const venueFilter = (venueId: string): string => `venue_id=eq.${venueId}`;

/** The wait before the next poll: the base (`pollMs` without Realtime, `safetyMs` beside a subscription), doubled per
 * consecutive failure, with ±10 % jitter, never above `maxBackoffMs`. */
export function pollDelay(baseMs: number, failures: number, random: () => number = Math.random): number {
  const raw = Math.min(baseMs * 2 ** Math.max(0, failures), LIVE_REFRESH.maxBackoffMs);
  return Math.min(Math.round(raw * (0.9 + 0.2 * random())), LIVE_REFRESH.maxBackoffMs);
}
