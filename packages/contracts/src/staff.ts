/**
 * What Halom staff write, and the personal data they read (ADR-003): act for owner (D25, the only staff write into a
 * venue's menu), the first publish's approval, plans, and Mana's own leads. Every one of these is logged with a reason
 * the owner sees (leads: every read is logged, never with the contact).
 */
import { isInt, isObject, isString, isUuid, oneOf, type Validation } from './common.ts';
import type { DishRow } from './domain.ts';
import {
  ACT_FOR_OWNER_ACTIONS, CASE_STATUSES, ENTITLEMENT_STATUSES, LIMITS, ONBOARDING_STATES, ONBOARDING_STEPS, PLANS, TAGS, TARGET_KINDS,
  type ActForOwnerAction, type CaseStatus, type EntitlementStatus, type OnboardingState, type OnboardingStep, type Plan, type TargetKind,
} from './enums.ts';
import { EVENT_TIME_RE } from './events.ts';
import { BLOCKER_RE, BLOCKERS_MAX, isAutoStep } from './onboarding.ts';
import { isReason, optionalText, validateInput, type RpcFail, type RpcOk } from './rpc.ts';
import { AVAILABILITY_NOTE_MAX } from './availability.ts';
import { isUntilSpec, type UntilSpec } from './time.ts';

const isInstant = (v: unknown): v is string => isString(v) && EVENT_TIME_RE.test(v) && !Number.isNaN(Date.parse(v));

// ---------------------------------------------------------------- act for owner (D25)

/** The dish columns support may change for the owner (`app.afo_dish_update`'s allow-list). */
export const DISH_PATCH_COLUMNS = [
  'name_he', 'name_en', 'desc_he', 'desc_en', 'price', 'price_note_he', 'price_note_en', 'tags', 'allergens_he', 'allergens_en', 'hidden', 'stock_id',
  'position',
] as const satisfies readonly (keyof DishRow)[];
export type DishPatch = Partial<Pick<DishRow, (typeof DISH_PATCH_COLUMNS)[number]>>;

/** What each `act_for_owner` action takes. */
export type ActForOwnerPayloads = {
  'availability.set': { readonly targetKind: TargetKind; readonly targetId: string; readonly until: UntilSpec; readonly note?: string | null };
  'availability.restore': { readonly targetKind: TargetKind; readonly targetId: string };
  'dish.update': { readonly dishId: string; readonly patch: DishPatch };
  'menu.publish': { readonly note?: string | null };
  'onboarding.set': { readonly step: OnboardingStep; readonly state: OnboardingState; readonly blockers?: readonly string[] };
  'support_case.update': { readonly caseId: string; readonly status: CaseStatus };
};

/** `act_for_owner(p_venue, p_reason, p_action, p_payload)`: one input per action. */
export type ActForOwnerInput = {
  [A in ActForOwnerAction]: { readonly venueId: string; readonly reason: string; readonly action: A; readonly payload: ActForOwnerPayloads[A] };
}[ActForOwnerAction];

export type ActForOwnerCode =
  | 'reason_required' | 'venue_unknown' | 'owner_declined' | 'action_unknown' | 'payload_invalid' | 'target_unknown' | 'until_invalid'
  | 'until_in_past' | 'step_automatic' | 'step_done' | 'plan_expired' | 'plan_suspended' | 'empty_menu' | 'invalid_menu';
/** `result` holds what the action did, ids and numbers only (the log keeps the same). */
export type ActForOwnerReply =
  | RpcOk<{ readonly action: ActForOwnerAction; readonly result: Readonly<Record<string, unknown>>; readonly logId: number }>
  | RpcFail<ActForOwnerCode>;

const PAYLOAD_KEYS: Readonly<Record<ActForOwnerAction, readonly string[]>> = {
  'availability.set': ['targetKind', 'targetId', 'until', 'note'],
  'availability.restore': ['targetKind', 'targetId'],
  'dish.update': ['dishId', 'patch'],
  'menu.publish': ['note'],
  'onboarding.set': ['step', 'state', 'blockers'],
  'support_case.update': ['caseId', 'status'],
};
const STOCK_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

/**
 * Codes: type, field_not_allowed, id_invalid, reason_required, action_unknown, enum_invalid, until_invalid,
 * text_invalid, text_too_long, price_invalid, stock_invalid, nothing_to_change, step_automatic, blocker_invalid,
 * too_many. Paths inside the payload start with `payload.`.
 */
export function validateActForOwner(raw: unknown): Validation<ActForOwnerInput> {
  return validateInput<ActForOwnerInput>(raw, ['venueId', 'reason', 'action', 'payload'], (x, o) => {
    if (!isUuid(o.venueId)) x.add('id_invalid', 'venueId');
    if (!isReason(o.reason)) x.add('reason_required', 'reason');
    if (!oneOf(ACT_FOR_OWNER_ACTIONS, o.action)) return void x.add('action_unknown', 'action');
    const p = o.payload;
    if (!isObject(p)) return void x.add('type', 'payload');
    for (const k of Object.keys(p)) if (!PAYLOAD_KEYS[o.action].includes(k)) x.add('field_not_allowed', `payload.${k}`);
    switch (o.action) {
      case 'availability.set':
      case 'availability.restore':
        if (!oneOf(TARGET_KINDS, p.targetKind)) x.add('enum_invalid', 'payload.targetKind');
        if (!isUuid(p.targetId)) x.add('id_invalid', 'payload.targetId');
        if (o.action === 'availability.set') {
          if (!isUntilSpec(p.until)) x.add('until_invalid', 'payload.until');
          optionalText(x, p.note, 'payload.note', AVAILABILITY_NOTE_MAX);
        }
        break;
      case 'dish.update': {
        if (!isUuid(p.dishId)) x.add('id_invalid', 'payload.dishId');
        const patch = p.patch;
        if (!isObject(patch)) return void x.add('type', 'payload.patch');
        if (Object.keys(patch).length === 0) x.add('nothing_to_change', 'payload.patch');
        for (const k of Object.keys(patch)) if (!(DISH_PATCH_COLUMNS as readonly string[]).includes(k)) x.add('field_not_allowed', `payload.patch.${k}`);
        const max: Record<string, number> = {
          name_he: LIMITS.nameLength, name_en: LIMITS.nameLength, desc_he: LIMITS.descLength, desc_en: LIMITS.descLength,
          price_note_he: LIMITS.noteLength, price_note_en: LIMITS.noteLength, allergens_he: 300, allergens_en: 300,
        };
        for (const [k, v] of Object.entries(patch)) {
          const path = `payload.patch.${k}`;
          if (k in max) {
            if (!isString(v)) x.add('type', path);
            else optionalText(x, v, path, max[k]!);
          } else if (k === 'price' && !(v === null || (isInt(v) && v >= 0 && v <= LIMITS.price))) x.add('price_invalid', path);
          else if (k === 'tags' && !(Array.isArray(v) && v.every((t) => oneOf(TAGS, t)) && new Set(v).size === v.length)) x.add('enum_invalid', path);
          else if (k === 'hidden' && typeof v !== 'boolean') x.add('type', path);
          else if (k === 'stock_id' && !(v === null || (isString(v) && STOCK_RE.test(v)))) x.add('stock_invalid', path);
          else if (k === 'position' && !(isInt(v) && v >= 0)) x.add('type', path);
        }
        break;
      }
      case 'menu.publish':
        optionalText(x, p.note, 'payload.note', 200);
        break;
      case 'onboarding.set':
        if (!oneOf(ONBOARDING_STEPS, p.step)) x.add('enum_invalid', 'payload.step');
        if (!oneOf(ONBOARDING_STATES, p.state)) x.add('enum_invalid', 'payload.state');
        else if (oneOf(ONBOARDING_STEPS, p.step) && isAutoStep(p.step) && (p.state === 'done' || (p.state === 'skipped' && p.step !== 'review'))) {
          x.add('step_automatic', 'payload.state');
        }
        if (p.blockers !== undefined) {
          if (!Array.isArray(p.blockers)) x.add('type', 'payload.blockers');
          else {
            if (p.blockers.length > BLOCKERS_MAX) x.add('too_many', 'payload.blockers');
            p.blockers.forEach((b, i) => { if (!isString(b) || !BLOCKER_RE.test(b)) x.add('blocker_invalid', `payload.blockers[${i}]`); });
          }
        }
        break;
      case 'support_case.update':
        if (!isUuid(p.caseId)) x.add('id_invalid', 'payload.caseId');
        if (!oneOf(CASE_STATUSES, p.status)) x.add('enum_invalid', 'payload.status');
        break;
    }
  });
}

// ---------------------------------------------------------------- the first publish's approval, plans

/** `ops_approve_venue(p_venue, p_reason)`: staff approve a venue's first publish; guests see it and the trial starts. */
export type ApproveVenueInput = { readonly venueId: string; readonly reason: string };
export type ApproveVenueReply =
  | RpcOk<{ readonly trialEndsAt: string | null }>
  | RpcFail<'reason_required' | 'venue_unknown' | 'already_approved' | 'not_published'>;

/** Codes: type, field_not_allowed, id_invalid, reason_required. */
export function validateApproveVenue(raw: unknown): Validation<ApproveVenueInput> {
  return validateInput<ApproveVenueInput>(raw, ['venueId', 'reason'], (x, o) => {
    if (!isUuid(o.venueId)) x.add('id_invalid', 'venueId');
    if (!isReason(o.reason)) x.add('reason_required', 'reason');
  });
}

/**
 * `ops_set_plan(p_venue, p_state, p_until, p_reason, p_plan)` (admins): the plan by hand until billing exists. `until`
 * ends a trial (`trialing`; absent = the trial's length) or a paid period (`active`); a live state also approves the
 * venue; `suspended` takes it offline.
 */
export type SetPlanInput = {
  readonly venueId: string;
  readonly state: EntitlementStatus;
  readonly until?: string | null;
  readonly reason: string;
  readonly plan?: Plan | null;
};
export type SetPlanReply = RpcOk<{ readonly state: EntitlementStatus }> | RpcFail<'reason_required' | 'state_invalid' | 'plan_invalid' | 'until_in_past' | 'venue_unknown'>;

/** Codes: type, field_not_allowed, id_invalid, state_invalid, plan_invalid, time_invalid, until_in_past, reason_required. */
export function validateSetPlan(raw: unknown, opts: { readonly now?: number } = {}): Validation<SetPlanInput> {
  return validateInput<SetPlanInput>(raw, ['venueId', 'state', 'until', 'reason', 'plan'], (x, o) => {
    if (!isUuid(o.venueId)) x.add('id_invalid', 'venueId');
    if (!oneOf(ENTITLEMENT_STATUSES, o.state)) x.add('state_invalid', 'state');
    if (o.plan !== undefined && o.plan !== null && !oneOf(PLANS, o.plan)) x.add('plan_invalid', 'plan');
    if (o.until !== undefined && o.until !== null) {
      if (!isInstant(o.until)) x.add('time_invalid', 'until');
      else if ((o.state === 'trialing' || o.state === 'active') && Date.parse(o.until) <= (opts.now ?? Date.now())) x.add('until_in_past', 'until');
    }
    if (!isReason(o.reason)) x.add('reason_required', 'reason');
  });
}

// ---------------------------------------------------------------- Mana's own leads (personal data)

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'onboarding', 'won', 'lost', 'spam'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
const LEAD_SOURCE_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;

/** One lead as `ops_leads` returns it (the table's own column names). Personal data: shown to staff, never logged. */
export type OpsLead = {
  readonly id: string;
  readonly ref: string;
  readonly created_at: string;
  readonly source: string;
  readonly message: string;
  readonly contact: string;
  readonly name: string | null;
  readonly venue_name: string | null;
  readonly locale: 'he' | 'en' | null;
  readonly status: LeadStatus;
  readonly owner: string | null;
  readonly notes: string | null;
};

/**
 * `ops_leads(p_status, p_source, p_since, p_limit)` (staff): every read is logged (`leads.read`, with the count and
 * the filter, never a contact). `status` null = every status except spam; 'all' = everything.
 */
export type OpsLeadsQuery = {
  readonly status?: LeadStatus | 'all' | null;
  readonly source?: string | null;
  readonly since?: string | null;
  /** 1–500; default 100. */
  readonly limit?: number;
};
export type OpsLeads = { readonly leads: readonly OpsLead[]; readonly count: number };

/** Codes: type, field_not_allowed, enum_invalid, source_invalid, time_invalid, limit_invalid. */
export function validateOpsLeadsQuery(raw: unknown): Validation<OpsLeadsQuery> {
  return validateInput<OpsLeadsQuery>(raw, ['status', 'source', 'since', 'limit'], (x, o) => {
    if (o.status !== undefined && o.status !== null && o.status !== 'all' && !oneOf(LEAD_STATUSES, o.status)) x.add('enum_invalid', 'status');
    if (o.source !== undefined && o.source !== null && !(isString(o.source) && LEAD_SOURCE_RE.test(o.source))) x.add('source_invalid', 'source');
    if (o.since !== undefined && o.since !== null && !isInstant(o.since)) x.add('time_invalid', 'since');
    if (o.limit !== undefined && !(isInt(o.limit) && o.limit >= 1 && o.limit <= 500)) x.add('limit_invalid', 'limit');
  });
}

/** `ops_update_lead(p_id, p_status, p_owner, p_notes)` (staff): a field left out (or null) stays as it is. */
export type UpdateLeadInput = {
  readonly id: string;
  readonly status?: LeadStatus | null;
  readonly owner?: string | null;
  readonly notes?: string | null;
};
export type UpdateLeadReply = RpcOk | RpcFail<'status_invalid' | 'not_found'>;

/** Codes: type, field_not_allowed, id_invalid, status_invalid, text_invalid, text_too_long. */
export function validateUpdateLead(raw: unknown): Validation<UpdateLeadInput> {
  return validateInput<UpdateLeadInput>(raw, ['id', 'status', 'owner', 'notes'], (x, o) => {
    if (!isUuid(o.id)) x.add('id_invalid', 'id');
    if (o.status !== undefined && o.status !== null && !oneOf(LEAD_STATUSES, o.status)) x.add('status_invalid', 'status');
    optionalText(x, o.owner, 'owner', 80);
    optionalText(x, o.notes, 'notes', 4000);
  });
}
