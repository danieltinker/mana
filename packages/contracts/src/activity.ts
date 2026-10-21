/**
 * The activity log as the owner reads it (F08, F11, D25): every change, who made it (the owner, a manager, the counter,
 * Halom, the system), how, and when; the reason when Halom acted. The log keeps ids, numbers, codes and times, never
 * the words a person typed (a dish's name is shown from the dish itself, while it exists).
 */
import { isInt, isUuid, oneOf, type Text, type Validation } from './common.ts';
import type { ActivityRow } from './domain.ts';
import { ACTOR_KINDS, type ActorKind } from './enums.ts';
import { validateInput } from './rpc.ts';

/** Tables whose writes the audit triggers log, one row per venue per statement (`<table>.<insert|update|delete>`). */
export const AUDITED_TABLES = [
  'venues', 'venue_members', 'staff', 'entitlements', 'schedules', 'sections', 'dishes', 'assets', 'addon_groups', 'addon_options',
  'dish_addon_groups', 'dish_relations', 'upsell_rules', 'venue_hours', 'venue_closures', 'availability_overrides', 'onboarding_progress',
  'menu_imports', 'support_cases', 'leads',
] as const;
export type AuditedTable = (typeof AUDITED_TABLES)[number];
export type AuditOp = 'insert' | 'update' | 'delete';
/** Venues are created by `create_venue` (logged as `venue.create`) and archived, never deleted; leads are written
 * only by the product page's form, so only staff updates to them are activity. */
const AUDIT_OPS: Readonly<Partial<Record<AuditedTable, readonly AuditOp[]>>> = { venues: ['update'], leads: ['update'] };
export const auditOpsOf = (t: AuditedTable): readonly AuditOp[] => AUDIT_OPS[t] ?? ['insert', 'update', 'delete'];

/** Actions a function logs by name, with what it did (phase 0, then phase 1's from `venue.set_demo` on). `menu.read`:
 * a staff read of a stored revision (`ops_revision`: target `menu_revisions`, the revision's id, detail
 * `{revision}`). */
export const NAMED_ACTIONS = [
  'venue.create', 'venue.approve', 'plan.set', 'menu.publish', 'menu.restore', 'menu.unpublish', 'support.act_for_owner',
  'upsell_rules.deactivated', 'staff.join', 'staff_invite.create', 'leads.read',
  'venue.set_demo', 'menu.export', 'menu.read', 'import.apply',
] as const;
export type NamedAction = (typeof NAMED_ACTIONS)[number];
export type ActivityAction = NamedAction | `${AuditedTable}.${AuditOp}`;

/** Every action the log may hold: the closed list the activity view knows. supabase/tests requires every action the
 * database writes to be on it, so a new one is added here in the same change. */
export const ACTIVITY_ACTIONS: readonly ActivityAction[] = [
  ...NAMED_ACTIONS,
  ...AUDITED_TABLES.flatMap((t) => auditOpsOf(t).map((op) => `${t}.${op}` as const)),
];
const ACTIONS = new Set<string>(ACTIVITY_ACTIONS);
export const isActivityAction = (v: unknown): v is ActivityAction => typeof v === 'string' && ACTIONS.has(v);

export const ACTIVITY_VIAS = ['direct', 'rpc', 'act_for_owner', 'system'] as const satisfies readonly ActivityRow['via'][];
export type ActivityVia = (typeof ACTIVITY_VIAS)[number];

export type ActivityEntry = {
  readonly id: number;
  readonly at: string;
  readonly actorKind: ActorKind;
  /** The reader made this change. Halom's staff are never named to the owner: `actorKind: 'staff'` reads "Halom". */
  readonly you: boolean;
  readonly via: ActivityVia;
  readonly action: ActivityAction;
  readonly targetTable: string | null;
  readonly targetIds: readonly string[];
  /** How many rows the statement touched (a bulk import of 200 dishes is one entry, n = 200). */
  readonly n: number;
  /** The name of the one row the entry is about, read from that row now: a section, dish, add-on group or option, or a
   * schedule (its names); an upsell rule (its label, in both languages); an availability override (the name of what it
   * took off: its section, dish, option or group). For Halom's `support.act_for_owner` row, what the action names first
   * (the target taken off or brought back, the dish changed). Null for several rows, for other tables, or when the row
   * is gone. */
  readonly targetName: Text | null;
  /** Shown to the owner when Halom acted (`act_for_owner`, approvals, plans, cases, demo). */
  readonly reason: string | null;
  /** What the log kept: for an update `{columns, changes}` (one row: `changes[column] = [before, after]`, values only
   * for ids, numbers, codes and times); for a named action its own keys. */
  readonly detail: Readonly<Record<string, unknown>>;
};

/** An update entry's changed columns and, for one row, the before and after values the log kept. */
export function activityChanges(e: Pick<ActivityEntry, 'detail'>): { columns: readonly string[]; changes: Readonly<Record<string, readonly [unknown, unknown]>> } {
  const columns = Array.isArray(e.detail.columns) ? e.detail.columns.filter((c): c is string => typeof c === 'string') : [];
  const raw = e.detail.changes;
  const changes: Record<string, readonly [unknown, unknown]> = {};
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw))
    for (const [k, v] of Object.entries(raw)) if (Array.isArray(v) && v.length === 2) changes[k] = [v[0], v[1]];
  return { columns, changes };
}

export const ACTIVITY_PAGE_MAX = 100;

/** `venue_activity`: one page, newest first. Owners, managers and Halom staff. */
export type ActivityQuery = {
  readonly venueId: string;
  /** Entries with an id below this one (the previous page's `next`); null or absent = the newest. */
  readonly before?: number | null;
  /** 1–100; default 50. */
  readonly limit?: number;
  readonly actor?: ActorKind | null;
  readonly via?: ActivityVia | null;
};
export type ActivityPage = { readonly entries: readonly ActivityEntry[]; readonly next: number | null };

/** Codes: type, field_not_allowed, id_invalid, limit_invalid, enum_invalid. */
export function validateActivityQuery(raw: unknown): Validation<ActivityQuery> {
  return validateInput<ActivityQuery>(raw, ['venueId', 'before', 'limit', 'actor', 'via'], (x, o) => {
    if (!isUuid(o.venueId)) x.add('id_invalid', 'venueId');
    if (o.before !== undefined && o.before !== null && !(isInt(o.before) && o.before > 0)) x.add('id_invalid', 'before');
    if (o.limit !== undefined && !(isInt(o.limit) && o.limit >= 1 && o.limit <= ACTIVITY_PAGE_MAX)) x.add('limit_invalid', 'limit');
    if (o.actor !== undefined && o.actor !== null && !oneOf(ACTOR_KINDS, o.actor)) x.add('enum_invalid', 'actor');
    if (o.via !== undefined && o.via !== null && !oneOf(ACTIVITY_VIAS, o.via)) x.add('enum_invalid', 'via');
  });
}
