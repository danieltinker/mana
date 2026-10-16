/**
 * The v2 back office's data layer: every staff RPC of ADR-008 (and the phase-0 ones the back office uses), typed with
 * `@mana/contracts`. Each call runs the contract's validator first and never reaches the database with an input the
 * database would refuse; every call resolves to `{ ok: true, data }` or a `Fail`, and nothing here throws.
 *
 * It talks to a `Backend` (an RPC call and a read of the caller's own staff row): `supabaseBackend` in the page, a
 * typed fake in the tests.
 */
import {
  isObject, isUuid, stripBlank, validateActForOwner, validateActivityQuery, validateApproveVenue, validateDashboardQuery,
  validateExportQuery, validateOpsAnalyticsQuery, validateOpsLeadsQuery, validateOpsRevisionQuery, validateOpsVenueQuery, validateOpsVenuesQuery,
  validateSetDemo, validateSetPlan, validateUpdateCase, validateUpdateLead,
  type ActForOwnerInput, type ActForOwnerReply, type ActivityPage, type ActivityQuery, type ApproveVenueInput, type ApproveVenueReply,
  type ClientDashboard, type DashboardQuery, type DishRow, type Issue, type MenuExport, type OpsAnalytics, type OpsAnalyticsQuery, type OpsLeads,
  type OpsLeadsQuery, type OpsRevision, type OpsRevisionQuery, type OpsVenueDetail, type OpsVenues, type OpsVenuesQuery, type PublicMenuResponse,
  type SetDemoInput, type SetDemoReply, type SetPlanInput, type SetPlanReply, type StaffRole, type UpdateCaseInput, type UpdateCaseReply,
  type UpdateLeadInput, type UpdateLeadReply,
} from '@mana/contracts';

// ---------------------------------------------------------------- results

export type FailKind =
  /** The session is gone or expired: sign in again. */
  | 'signed_out'
  /** The database does not count this session as Halom staff (42501). */
  | 'not_staff'
  /** Staff, but the action is an admin's (42501 not_admin). */
  | 'not_admin'
  /** The input is wrong (caught here by the contract's validator, or 22023 from the database). */
  | 'invalid'
  /** A write the database answered `{ ok: false, code }`: nothing was changed. */
  | 'refused'
  /** The database has no such function yet (an older schema than this page). */
  | 'missing'
  | 'timeout' | 'network' | 'server';
export type Fail = {
  readonly ok: false; readonly kind: FailKind; readonly message: string; readonly code?: string; readonly errors?: readonly Issue[];
  /** A refused write's whole reply (some carry more than a code: `stale` carries the row's current values). */
  readonly reply?: Readonly<Record<string, unknown>>;
};
export type Result<T> = { readonly ok: true; readonly data: T } | Fail;

// ---------------------------------------------------------------- the backend

export type RawError = { readonly message?: string; readonly code?: string; readonly status?: number; readonly name?: string };
export type Raw = { readonly data: unknown; readonly error: RawError | null };

/** The RPCs this page calls, by their database names. */
export const RPC = [
  'ops_venues', 'ops_venue', 'ops_revision', 'ops_analytics', 'ops_update_case', 'ops_set_demo', 'ops_approve_venue', 'act_for_owner', 'ops_set_plan',
  'ops_leads', 'ops_update_lead', 'public_menu', 'redeem_staff_invite', 'venue_activity', 'my_dashboard', 'export_menu',
] as const;
export type RpcName = (typeof RPC)[number];

export interface Backend {
  rpc(fn: RpcName, args: Readonly<Record<string, unknown>>): Promise<Raw>;
  /** The caller's own row in `public.staff` (RLS lets anyone read their own): `{ role }`, or null when there is none. */
  staffRow(userId: string): Promise<Raw>;
  /** One dish as the owner's tables hold it now (staff read them under RLS): the `DISH_NOW` columns, or null. */
  dishRow(dishId: string): Promise<Raw>;
}

/** The columns of a dish Halom reads before changing it for the owner (what the review step states). */
export const DISH_NOW = ['id', 'name_he', 'name_en', 'price', 'hidden', 'updated_at'] as const;
export type DishNow = Pick<DishRow, (typeof DISH_NOW)[number]>;

// ---------------------------------------------------------------- errors → words

/** What a refused write's code means, in words for staff. Unknown codes are shown as they are. */
export const CODE_TEXT: Readonly<Record<string, string>> = {
  reason_required: 'Write a reason of 3 to 500 characters. The owner reads it.',
  venue_unknown: 'This venue no longer exists.',
  owner_declined: 'The owner has turned off Halom acting for them (their support switch is off). Nothing was changed.',
  action_unknown: 'The database does not know this action.',
  payload_invalid: 'The database refused the details of this action. Nothing was changed.',
  target_unknown: 'That dish, section, option or case is not in this venue any more.',
  until_invalid: 'That “until” is not one the database accepts.',
  plan_expired: 'The venue’s plan has expired, so its menu cannot be published.',
  plan_suspended: 'The venue’s plan is suspended, so its menu cannot be published.',
  empty_menu: 'The menu has no dish guests can see, so there is nothing to publish.',
  invalid_menu: 'The menu has a problem that stops a publish; the owner app lists it.',
  revision_unknown: 'That revision does not exist.',
  revision_changed: 'The owner published a newer revision since your review. Nothing was approved: read it and review again.',
  approval_first: 'A plan does not approve a venue: approve its first publish first, after reading its menu.',
  stale: 'The owner changed this since your review. Nothing was changed: review it again.',
  revision_invalid: 'That is not a revision number.',
  text_invalid: 'Some text holds characters that cannot be stored.',
  already_approved: 'This venue was already approved.',
  not_published: 'The owner has not published yet, so there is nothing to approve.',
  case_unknown: 'This case no longer exists.',
  state_invalid: 'That plan state is not one the database knows.',
  plan_invalid: 'That plan is not one the database knows.',
  until_in_past: 'That date is already in the past.',
  step_automatic: 'The database marks this step done by itself; it can be set to doing, skipped or blocked.',
  step_done: 'The database already marked this step done; it stays done.',
  nothing_to_change: 'Nothing would change.',
  status_invalid: 'That status is not one the database knows.',
  not_found: 'This enquiry no longer exists.',
  invalid: 'That code is not valid, or it was already used. A staff code works once.',
  locked: 'Too many wrong codes today. Try again tomorrow.',
  email_unconfirmed: 'This account’s e-mail address is not confirmed yet.',
  signed_out: 'Your session ended. Sign in again.',
};
export const codeText = (code: string): string => CODE_TEXT[code] ?? `The database answered: ${code.slice(0, 60)}`;

const SIGNED_OUT = 'Your session ended. Sign in again.';

/** A transport or database error as a `Fail`. */
export function failOf(e: RawError | null | undefined): Fail {
  const message = String(e?.message ?? '');
  const code = String(e?.code ?? '');
  const status = Number(e?.status) || 0;
  if (e?.name === 'TimeoutError' || /timeout|aborted/i.test(message)) return { ok: false, kind: 'timeout', message: 'The server did not answer in time.' };
  if (code === '42501') {
    return message === 'not_admin'
      ? { ok: false, kind: 'not_admin', message: 'Only a Halom admin can do this.', code: message }
      : { ok: false, kind: 'not_staff', message: 'The database does not count this session as Halom staff.', code: message || 'not_staff' };
  }
  if (code === 'PGRST301' || code === 'PGRST303' || status === 401 || /JWT|invalid claim|session_not_found/i.test(message)) {
    return { ok: false, kind: 'signed_out', message: SIGNED_OUT };
  }
  if (code === 'PGRST202') return { ok: false, kind: 'missing', message: 'The database does not have this part of the back office yet (an older schema).' };
  if (code === '22023') return { ok: false, kind: 'invalid', message: `The database refused the request (${message.slice(0, 60)}).`, code: message };
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(message)) {
    return { ok: false, kind: 'network', message: 'Could not reach the server. Check the connection.' };
  }
  return { ok: false, kind: 'server', message: message ? `The server refused: ${message.slice(0, 200)}` : 'The server returned an error.', code };
}

const invalid = (errors: readonly Issue[]): Fail => ({
  ok: false, kind: 'invalid', errors, code: errors[0]?.code ?? 'invalid',
  message: errors[0] && CODE_TEXT[errors[0].code] ? (CODE_TEXT[errors[0].code] as string) : 'Some details are missing or wrong.',
});
const malformed: Fail = { ok: false, kind: 'server', message: 'The server sent an answer this page does not understand.' };

/** The success half of a write's reply (the contracts type both halves; the failure becomes a `Fail`). */
export type Ok<R> = Extract<R, { readonly ok: true }>;


// ---------------------------------------------------------------- the API

export type OpsApi = ReturnType<typeof opsApi>;

export function opsApi(backend: Backend) {
  async function call(fn: RpcName, args: Readonly<Record<string, unknown>>): Promise<Result<unknown>> {
    let raw: Raw;
    try { raw = await backend.rpc(fn, args); } catch (e) { return failOf(e as RawError); }
    return raw.error ? failOf(raw.error) : { ok: true, data: raw.data };
  }
  /** A read RPC: the reply must look like `shape` says. */
  async function read<T>(fn: RpcName, args: Readonly<Record<string, unknown>>, shape: (d: Readonly<Record<string, unknown>>) => boolean): Promise<Result<T>> {
    const r = await call(fn, args);
    if (!r.ok) return r;
    return isObject(r.data) && shape(r.data) ? { ok: true, data: r.data as T } : malformed;
  }
  /** A write RPC: `{ ok: true, … }`, or `{ ok: false, code }` (nothing changed). */
  async function write<R extends { readonly ok: boolean }>(fn: RpcName, args: Readonly<Record<string, unknown>>): Promise<Result<Ok<R>>> {
    const r = await call(fn, args);
    if (!r.ok) return r;
    const d = r.data;
    if (!isObject(d)) return malformed;
    if (d.ok === true) return { ok: true, data: d as Ok<R> };
    const code = typeof d.code === 'string' ? d.code : 'failed';
    return { ok: false, kind: 'refused', code, message: codeText(code), reply: d, ...(Array.isArray(d.errors) ? { errors: d.errors as Issue[] } : {}) };
  }

  return {
    /** Which staff role the signed-in person has, from their own row; null = not staff. */
    async staffRole(userId: string): Promise<Result<StaffRole | null>> {
      let raw: Raw;
      try { raw = await backend.staffRow(userId); } catch (e) { return failOf(e as RawError); }
      if (raw.error) return failOf(raw.error);
      const role = isObject(raw.data) ? raw.data.role : null;
      return { ok: true, data: role === 'support' || role === 'admin' ? role : null };
    },

    /** A dish as the owner's tables hold it now (not as published): what a change for the owner starts from. */
    async dish(dishId: string): Promise<Result<DishNow | null>> {
      if (!isUuid(dishId)) return invalid([{ code: 'id_invalid', path: 'dishId' }]);
      let raw: Raw;
      try { raw = await backend.dishRow(dishId); } catch (e) { return failOf(e as RawError); }
      if (raw.error) return failOf(raw.error);
      if (raw.data === null) return { ok: true, data: null };
      return isObject(raw.data) && raw.data.id === dishId ? { ok: true, data: raw.data as DishNow } : malformed;
    },

    venues(query: OpsVenuesQuery = {}): Promise<Result<OpsVenues>> {
      const v = validateOpsVenuesQuery(query);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return read<OpsVenues>('ops_venues', { p_filters: v.value }, (d) => Array.isArray(d.venues) && isObject(d.totals));
    },

    venue(venueId: string): Promise<Result<OpsVenueDetail>> {
      const v = validateOpsVenueQuery({ venueId });
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return read<OpsVenueDetail>('ops_venue', { p_venue: venueId }, (d) => isObject(d.venue) && Array.isArray(d.activity) && isObject(d.onboarding));
    },

    analytics(query: OpsAnalyticsQuery): Promise<Result<OpsAnalytics>> {
      const v = validateOpsAnalyticsQuery(query);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return read<OpsAnalytics>('ops_analytics', { p_query: v.value }, (d) => Array.isArray(d.buckets) && isObject(d.series) && isObject(d.funnel));
    },

    /** What a guest's phone gets for this slug: the published snapshot and the live overlay, or "unavailable". */
    publicMenu(slug: string): Promise<Result<PublicMenuResponse>> {
      return read<PublicMenuResponse>('public_menu', { p_slug: slug }, (d) => d.state === 'ok' || d.state === 'unavailable' || d.state === 'not_found');
    },

    /** A stored revision as Halom reviews it (the newest unless a number is asked). Each read is logged (`menu.read`). */
    revision(query: OpsRevisionQuery): Promise<Result<Ok<OpsRevision>>> {
      const v = validateOpsRevisionQuery(query);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return write<OpsRevision>('ops_revision', { p_venue: query.venueId, p_revision: query.revision ?? null });
    },

    /** Approves the revision staff reviewed (`expectedRevision`); a newer one is refused as `revision_changed`. */
    approve(input: ApproveVenueInput): Promise<Result<Ok<ApproveVenueReply>>> {
      const v = validateApproveVenue(input);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return write<ApproveVenueReply>('ops_approve_venue', { p_venue: input.venueId, p_reason: stripBlank(input.reason), p_expected_revision: input.expectedRevision });
    },

    /** `dish.update` and `onboarding.set` carry the `updated_at` staff read, exactly as read; a change since is `stale`. */
    actForOwner(input: ActForOwnerInput): Promise<Result<Ok<ActForOwnerReply>>> {
      const v = validateActForOwner(input);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return write<ActForOwnerReply>('act_for_owner', { p_venue: input.venueId, p_reason: stripBlank(input.reason), p_action: input.action, p_payload: input.payload });
    },

    updateCase(input: UpdateCaseInput): Promise<Result<Ok<UpdateCaseReply>>> {
      const v = validateUpdateCase(input);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return write<UpdateCaseReply>('ops_update_case', {
        p_case: input.caseId, p_status: input.status ?? null, p_topic: input.topic ?? null, p_reason: input.reason ? stripBlank(input.reason) : null,
      });
    },

    setDemo(input: SetDemoInput): Promise<Result<Ok<SetDemoReply>>> {
      const v = validateSetDemo(input);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return write<SetDemoReply>('ops_set_demo', { p_venue: input.venueId, p_demo: input.demo, p_reason: stripBlank(input.reason) });
    },

    setPlan(input: SetPlanInput): Promise<Result<Ok<SetPlanReply>>> {
      const v = validateSetPlan(input);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return write<SetPlanReply>('ops_set_plan', {
        p_venue: input.venueId, p_state: input.state, p_until: input.until ?? null, p_reason: stripBlank(input.reason), p_plan: input.plan ?? null,
      });
    },

    /** The owner's dashboard as they see it (`my_dashboard`; staff may read it): their nudges, what is off, today. */
    dashboard(query: DashboardQuery): Promise<Result<ClientDashboard>> {
      const v = validateDashboardQuery(query);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return read<ClientDashboard>('my_dashboard', { p_venue: query.venueId, p_range: query.range ?? 'today' }, (d) => d.v === 2 && Array.isArray(d.nudges));
    },

    /** The owner's menu as it is in their app now (`export_menu`). Logged as `menu.export`, which the owner sees: on request only. */
    exportMenu(venueId: string): Promise<Result<MenuExport>> {
      const v = validateExportQuery({ venueId });
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return read<MenuExport>('export_menu', { p_venue: venueId }, (d) => d.kind === 'mana.menu_export' && isObject(d.tables));
    },

    /** One page of a venue's log, newest first (`venue_activity`): the timeline past the newest 100 that `ops_venue` carries. */
    activity(query: ActivityQuery): Promise<Result<ActivityPage>> {
      const v = validateActivityQuery(query);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return read<ActivityPage>('venue_activity', { p_venue: query.venueId, p_before: query.before ?? null, p_limit: query.limit ?? 50,
        p_actor: query.actor ?? null, p_via: query.via ?? null }, (d) => Array.isArray(d.entries));
    },

    /** Mana's own leads. Personal data: the database logs every read. */
    leads(query: OpsLeadsQuery = {}): Promise<Result<OpsLeads>> {
      const v = validateOpsLeadsQuery(query);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return read<OpsLeads>('ops_leads', { p_status: query.status ?? null, p_source: query.source ?? null, p_since: query.since ?? null, p_limit: query.limit ?? 300 },
        (d) => Array.isArray(d.leads));
    },

    /** A field left out (or null) stays as it is; '' clears a text. */
    updateLead(input: UpdateLeadInput): Promise<Result<Ok<UpdateLeadReply>>> {
      const v = validateUpdateLead(input);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return write<UpdateLeadReply>('ops_update_lead', { p_id: input.id, p_status: input.status ?? null, p_owner: input.owner ?? null, p_notes: input.notes ?? null });
    },

    redeemInvite(code: string): Promise<Result<{ readonly ok: true; readonly role?: StaffRole }>> {
      return write<{ readonly ok: true; readonly role?: StaffRole } | { readonly ok: false; readonly code: string }>('redeem_staff_invite', { p_code: code.trim() });
    },
  };
}
