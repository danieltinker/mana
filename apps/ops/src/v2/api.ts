/**
 * The v2 back office's data layer: every staff RPC of ADR-008 (and the phase-0 ones the back office uses), typed with
 * `@mana/contracts`. Each call runs the contract's validator first and never reaches the database with an input the
 * database would refuse; every call resolves to `{ ok: true, data }` or a `Fail`, and nothing here throws.
 *
 * It talks to a `Backend` (an RPC call and a read of the caller's own staff row): `supabaseBackend` in the page, a
 * typed fake in the tests.
 */
import {
  ACT_FOR_OWNER_ACTIONS, CASE_STATUSES, ENTITLEMENT_STATUSES, LIMITS, PLANS, TAGS, TARGET_KINDS, isObject, isReason, isUntilSpec, isUuid, oneOf,
  stripBlank, validateOpsAnalyticsQuery, validateOpsVenueQuery, validateOpsVenuesQuery, validateSetDemo, validateSetStep, validateUpdateCase,
  type ActForOwnerAction, type CaseStatus, type EntitlementStatus, type Issue, type OnboardingState, type OnboardingStep, type OpsAnalytics,
  type OpsAnalyticsQuery, type OpsVenueDetail, type OpsVenues, type OpsVenuesQuery, type Plan, type PublicMenuResponse, type SetDemoInput,
  type SetDemoReply, type StaffRole, type Tag, type TargetKind, type UntilSpec, type UpdateCaseInput, type UpdateCaseReply,
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
export type Fail = { readonly ok: false; readonly kind: FailKind; readonly message: string; readonly code?: string; readonly errors?: readonly Issue[] };
export type Result<T> = { readonly ok: true; readonly data: T } | Fail;

// ---------------------------------------------------------------- the backend

export type RawError = { readonly message?: string; readonly code?: string; readonly status?: number; readonly name?: string };
export type Raw = { readonly data: unknown; readonly error: RawError | null };

/** The RPCs this page calls, by their database names. */
export const RPC = [
  'ops_venues', 'ops_venue', 'ops_analytics', 'ops_update_case', 'ops_set_demo', 'ops_approve_venue', 'act_for_owner', 'ops_set_plan',
  'ops_leads', 'ops_update_lead', 'public_menu', 'redeem_staff_invite',
] as const;
export type RpcName = (typeof RPC)[number];

export interface Backend {
  rpc(fn: RpcName, args: Readonly<Record<string, unknown>>): Promise<Raw>;
  /** The caller's own row in `public.staff` (RLS lets anyone read their own): `{ role }`, or null when there is none. */
  staffRow(userId: string): Promise<Raw>;
}

// ---------------------------------------------------------------- errors → words

/** What a refused write's code means, in words for staff. Unknown codes are shown as they are. */
export const CODE_TEXT: Readonly<Record<string, string>> = {
  reason_required: 'Write a reason of 3 to 500 characters. The owner reads it.',
  venue_unknown: 'This venue no longer exists.',
  owner_declined: 'The owner has turned off Halom acting for them (their support switch is off). Nothing was changed.',
  action_unknown: 'The database does not know this action.',
  payload_invalid: 'The database refused the details of this action. Nothing was changed.',
  target_unknown: 'That dish, section, option or case is not in this venue any more.',
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

// ---------------------------------------------------------------- inputs the contracts do not type (phase 0's RPCs)

/** `ops_approve_venue`. */
export type ApproveInput = { readonly venueId: string; readonly reason: string };
export type ApproveReply = { readonly ok: true; readonly trialEndsAt: string | null };

/** `ops_set_plan` (admins): the plan by hand until billing exists. `until` is an instant with an offset, or null. */
export type SetPlanInput = {
  readonly venueId: string; readonly state: EntitlementStatus; readonly until: string | null; readonly reason: string; readonly plan: Plan | null;
};
export type SetPlanReply = { readonly ok: true; readonly state: EntitlementStatus };

/** The dish columns `act_for_owner('dish.update')` may change (the database's allow-list). */
export const DISH_PATCH_KEYS = [
  'name_he', 'name_en', 'desc_he', 'desc_en', 'price', 'price_note_he', 'price_note_en', 'tags', 'allergens_he', 'allergens_en', 'hidden',
  'stock_id', 'position',
] as const;
export type DishPatch = Partial<{
  name_he: string; name_en: string; desc_he: string; desc_en: string; price: number | null; price_note_he: string; price_note_en: string;
  tags: Tag[]; allergens_he: string; allergens_en: string; hidden: boolean; stock_id: string | null; position: number;
}>;

/** Each action's payload, as `act_for_owner`'s internal functions read it. */
export type ActPayloads = {
  'availability.set': { readonly targetKind: TargetKind; readonly targetId: string; readonly until: UntilSpec; readonly note?: string };
  'availability.restore': { readonly targetKind: TargetKind; readonly targetId: string };
  'dish.update': { readonly dishId: string; readonly patch: DishPatch };
  'menu.publish': { readonly note?: string };
  'onboarding.set': { readonly step: OnboardingStep; readonly state: OnboardingState; readonly blockers?: readonly string[] };
  'support_case.update': { readonly caseId: string; readonly status: CaseStatus };
};
export type ActInput<A extends ActForOwnerAction = ActForOwnerAction> = A extends ActForOwnerAction
  ? { readonly venueId: string; readonly reason: string; readonly action: A; readonly payload: ActPayloads[A] }
  : never;
export type ActReply = { readonly ok: true; readonly action: ActForOwnerAction; readonly result: Readonly<Record<string, unknown>>; readonly logId: number | null };

/** The checks `act_for_owner` makes on a payload, made here first (codes as the validators' words). */
export function validateAct(input: ActInput): readonly Issue[] {
  const out: Issue[] = [];
  const add = (code: string, path: string): void => void out.push({ code, path });
  if (!isUuid(input.venueId)) add('id_invalid', 'venueId');
  if (!isReason(input.reason)) add('reason_required', 'reason');
  if (!oneOf(ACT_FOR_OWNER_ACTIONS, input.action)) { add('action_unknown', 'action'); return out; }
  const p = input.payload as Readonly<Record<string, unknown>>;
  if (!isObject(p)) { add('type', 'payload'); return out; }
  switch (input.action) {
    case 'availability.set':
      if (!oneOf(TARGET_KINDS, p.targetKind)) add('enum_invalid', 'payload.targetKind');
      if (!isUuid(p.targetId)) add('id_invalid', 'payload.targetId');
      if (!isUntilSpec(p.until)) add('until_invalid', 'payload.until');
      if (p.note !== undefined && (typeof p.note !== 'string' || p.note.length > 200)) add('text_too_long', 'payload.note');
      break;
    case 'availability.restore':
      if (!oneOf(TARGET_KINDS, p.targetKind)) add('enum_invalid', 'payload.targetKind');
      if (!isUuid(p.targetId)) add('id_invalid', 'payload.targetId');
      break;
    case 'dish.update': {
      if (!isUuid(p.dishId)) add('id_invalid', 'payload.dishId');
      const patch = p.patch;
      if (!isObject(patch) || Object.keys(patch).length === 0) { add('nothing_to_change', 'payload.patch'); break; }
      for (const [k, v] of Object.entries(patch)) {
        if (!(DISH_PATCH_KEYS as readonly string[]).includes(k)) add('field_not_allowed', `payload.patch.${k}`);
        else if (k === 'price' && v !== null && !(Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= LIMITS.price)) add('price_invalid', 'payload.patch.price');
        else if (k === 'hidden' && typeof v !== 'boolean') add('type', 'payload.patch.hidden');
        else if (k === 'tags' && !(Array.isArray(v) && v.every((t) => oneOf(TAGS, t)))) add('enum_invalid', 'payload.patch.tags');
      }
      break;
    }
    case 'menu.publish':
      if (p.note !== undefined && (typeof p.note !== 'string' || p.note.length > 200)) add('text_too_long', 'payload.note');
      break;
    case 'onboarding.set': {
      const r = validateSetStep({ venueId: input.venueId, step: p.step, state: p.state, ...(p.blockers === undefined ? {} : { blockers: p.blockers }) });
      if (!r.ok) for (const e of r.errors) if (e.path !== 'venueId') add(e.code, 'payload.' + e.path);
      break;
    }
    case 'support_case.update':
      if (!isUuid(p.caseId)) add('id_invalid', 'payload.caseId');
      if (!oneOf(CASE_STATUSES, p.status)) add('enum_invalid', 'payload.status');
      break;
  }
  return out;
}

// ---------------------------------------------------------------- leads (Mana's own; the contracts have no type for them yet)

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'onboarding', 'won', 'lost', 'spam'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
/** One lead as `ops_leads` returns it (the table's columns, snake_case). Personal data: every read is logged. */
export type OpsLead = {
  readonly id: string; readonly ref: string; readonly created_at: string; readonly source: string; readonly message: string; readonly contact: string;
  readonly name: string | null; readonly venue_name: string | null; readonly locale: 'he' | 'en' | null; readonly status: LeadStatus;
  readonly owner: string | null; readonly notes: string | null;
};
export type OpsLeads = { readonly leads: readonly OpsLead[]; readonly count: number };
/** null = every status but spam; 'all' = everything. */
export type LeadsQuery = { readonly status?: LeadStatus | 'all' | null; readonly limit?: number };
/** A field left out (or null) is kept; '' clears a text. */
export type UpdateLeadInput = { readonly id: string; readonly status?: LeadStatus; readonly owner?: string; readonly notes?: string };

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
  async function write<T extends { ok: true }>(fn: RpcName, args: Readonly<Record<string, unknown>>): Promise<Result<T>> {
    const r = await call(fn, args);
    if (!r.ok) return r;
    const d = r.data;
    if (!isObject(d)) return malformed;
    if (d.ok === true) return { ok: true, data: d as T };
    const code = typeof d.code === 'string' ? d.code : 'failed';
    return { ok: false, kind: 'refused', code, message: codeText(code), ...(Array.isArray(d.errors) ? { errors: d.errors as Issue[] } : {}) };
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

    approve(input: ApproveInput): Promise<Result<ApproveReply>> {
      const errors: Issue[] = [];
      if (!isUuid(input.venueId)) errors.push({ code: 'id_invalid', path: 'venueId' });
      if (!isReason(input.reason)) errors.push({ code: 'reason_required', path: 'reason' });
      if (errors.length) return Promise.resolve(invalid(errors));
      return write<ApproveReply>('ops_approve_venue', { p_venue: input.venueId, p_reason: stripBlank(input.reason) });
    },

    actForOwner(input: ActInput): Promise<Result<ActReply>> {
      const errors = validateAct(input);
      if (errors.length) return Promise.resolve(invalid(errors));
      return write<ActReply>('act_for_owner', { p_venue: input.venueId, p_reason: stripBlank(input.reason), p_action: input.action, p_payload: input.payload });
    },

    updateCase(input: UpdateCaseInput): Promise<Result<UpdateCaseReply>> {
      const v = validateUpdateCase(input);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return write<UpdateCaseReply>('ops_update_case', {
        p_case: input.caseId, p_status: input.status ?? null, p_topic: input.topic ?? null, p_reason: stripBlank(input.reason),
      });
    },

    setDemo(input: SetDemoInput): Promise<Result<SetDemoReply>> {
      const v = validateSetDemo(input);
      if (!v.ok) return Promise.resolve(invalid(v.errors));
      return write<SetDemoReply>('ops_set_demo', { p_venue: input.venueId, p_demo: input.demo, p_reason: stripBlank(input.reason) });
    },

    setPlan(input: SetPlanInput): Promise<Result<SetPlanReply>> {
      const errors: Issue[] = [];
      if (!isUuid(input.venueId)) errors.push({ code: 'id_invalid', path: 'venueId' });
      if (!oneOf(ENTITLEMENT_STATUSES, input.state)) errors.push({ code: 'state_invalid', path: 'state' });
      if (input.plan !== null && !oneOf(PLANS, input.plan)) errors.push({ code: 'plan_invalid', path: 'plan' });
      if (input.until !== null && Number.isNaN(Date.parse(input.until))) errors.push({ code: 'time_invalid', path: 'until' });
      if (!isReason(input.reason)) errors.push({ code: 'reason_required', path: 'reason' });
      if (errors.length) return Promise.resolve(invalid(errors));
      return write<SetPlanReply>('ops_set_plan', {
        p_venue: input.venueId, p_state: input.state, p_until: input.until, p_reason: stripBlank(input.reason), p_plan: input.plan,
      });
    },

    leads(query: LeadsQuery = {}): Promise<Result<OpsLeads>> {
      const status = query.status ?? null;
      if (status !== null && status !== 'all' && !oneOf(LEAD_STATUSES, status)) return Promise.resolve(invalid([{ code: 'enum_invalid', path: 'status' }]));
      return read<OpsLeads>('ops_leads', { p_status: status, p_source: null, p_since: null, p_limit: query.limit ?? 300 }, (d) => Array.isArray(d.leads));
    },

    updateLead(input: UpdateLeadInput): Promise<Result<{ ok: true }>> {
      const errors: Issue[] = [];
      if (!isUuid(input.id)) errors.push({ code: 'id_invalid', path: 'id' });
      if (input.status !== undefined && !oneOf(LEAD_STATUSES, input.status)) errors.push({ code: 'status_invalid', path: 'status' });
      if (input.owner !== undefined && input.owner.length > 80) errors.push({ code: 'text_too_long', path: 'owner' });
      if (input.notes !== undefined && input.notes.length > 4000) errors.push({ code: 'text_too_long', path: 'notes' });
      if (input.status === undefined && input.owner === undefined && input.notes === undefined) errors.push({ code: 'nothing_to_change', path: '' });
      if (errors.length) return Promise.resolve(invalid(errors));
      return write<{ ok: true }>('ops_update_lead', { p_id: input.id, p_status: input.status ?? null, p_owner: input.owner ?? null, p_notes: input.notes ?? null });
    },

    redeemInvite(code: string): Promise<Result<{ ok: true; role?: StaffRole }>> {
      return write<{ ok: true; role?: StaffRole }>('redeem_staff_invite', { p_code: code.trim() });
    },
  };
}
