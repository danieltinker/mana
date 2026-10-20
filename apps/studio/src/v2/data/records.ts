// The owner's records through phase 1's RPCs (ADR-008): the dashboard (my_dashboard v2), the activity log
// (venue_activity), the menu export (export_menu), "get help" (open_case), and the venue's open help requests. Each input
// is checked with the contracts' validator before it leaves the phone (the same codes the database answers). Stateless.
import {
  validateActivityQuery, validateDashboardQuery, validateExportQuery, validateOpenCase, type ActivityPage, type ActivityQuery, type ClientDashboard,
  type DashboardRange, type MenuExport, type OpenCaseInput, type OpenCaseReply, type SupportCaseRow, type Validation,
} from '@mana/contracts';
import { q, rpc, sb } from './client.ts';
import { V2Error } from './errors.ts';

function checked<T>(v: Validation<T>): T {
  if (!v.ok) throw new V2Error(v.errors[0]!.code, v.errors);
  return v.value;
}

/** Today at a glance and the range's numbers, what is off, nudges, per-rule numbers, the newest activity. */
export function myDashboard(venueId: string, range: DashboardRange): Promise<ClientDashboard> {
  const i = checked(validateDashboardQuery({ venueId, range }));
  return q<ClientDashboard>(sb.rpc('my_dashboard', { p_venue: i.venueId, p_range: i.range }));
}

/** One page of the log, newest first; `next` is the page after it (null at the end). */
export function venueActivity(query: ActivityQuery): Promise<ActivityPage> {
  const i = checked(validateActivityQuery(query));
  return q<ActivityPage>(sb.rpc('venue_activity', { p_venue: i.venueId, p_before: i.before ?? null, p_limit: i.limit ?? 50, p_actor: i.actor ?? null, p_via: i.via ?? null }));
}

/** The menu as stored (each export is logged as `menu.export`, which the owner sees). */
export function exportMenu(venueId: string): Promise<MenuExport> {
  const i = checked(validateExportQuery({ venueId }));
  return q<MenuExport>(sb.rpc('export_menu', { p_venue: i.venueId }));
}

/**
 * Ask Halom for help. `id` is the request's own, made on the phone (newUuid) and kept until an answer arrives: sent
 * again after a lost answer, it answers the request stored the first time (`reused`), never a second one. The owner's
 * switch for Halom acting is not part of a request (store.ts `setSupportCanAct`), so `allowAct` is never sent.
 */
export function openCase(input: Omit<OpenCaseInput, 'allowAct' | 'id'> & { readonly id: string }): Promise<Extract<OpenCaseReply, { ok: true }>> {
  const i = checked(validateOpenCase(input));
  return rpc('open_case', { p_venue: i.venueId, p_topic: i.topic, p_subject: i.subject, p_body: i.body ?? '', p_id: i.id });
}

export type CaseLine = Pick<SupportCaseRow, 'id' | 'topic' | 'status' | 'subject' | 'created_at' | 'updated_at'>;

/**
 * The venue's help requests that are not resolved, newest first. No RPC lists them for the owner; the table is read
 * under its own row-level security (owners, managers and Halom staff of the venue: `cases_read`), as the editors read
 * theirs (ADR-008: direct reads where RLS already makes them safe). Never who opened it.
 */
export const openCases = (venueId: string) =>
  q<CaseLine[]>(sb.from('support_cases').select('id, topic, status, subject, created_at, updated_at').eq('venue_id', venueId).neq('status', 'resolved')
    .order('created_at', { ascending: false }).limit(20));
