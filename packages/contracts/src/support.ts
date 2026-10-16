/**
 * Support cases (F03 "get help", F09 support): the owner opens one from the client app; Halom sees it in the back
 * office and works it. A case's subject and body are the owner's words: the activity log records that a case was
 * opened or changed, never what it says.
 */
import { isUuid, oneOf, type Validation } from './common.ts';
import { CASE_STATUSES, CASE_TOPICS, type ActorKind, type CaseStatus, type CaseTopic } from './enums.ts';
import { isReason, optionalText, requiredText, validateInput, type RpcFail, type RpcOk } from './rpc.ts';

export const CASE_SUBJECT_MAX = 160;
export const CASE_BODY_MAX = 4000;

/** A case as the owner and Halom read it. */
export type SupportCase = {
  readonly id: string;
  readonly venueId: string;
  readonly topic: CaseTopic;
  readonly status: CaseStatus;
  readonly subject: string;
  readonly body: string;
  /** Who opened it: a member's role, or `staff` when Halom opened it for the venue. null = the account is gone. */
  readonly openedBy: Extract<ActorKind, 'owner' | 'manager' | 'staff'> | null;
  readonly openedAt: string;
  readonly updatedAt: string;
  readonly resolvedAt: string | null;
  /** The venue's switch at the time of reading: may Halom act for the owner (D25)? */
  readonly supportCanAct: boolean;
};

/**
 * `open_case` ("get help"): owners and managers. `allowAct` sets the venue's support switch in the same transaction;
 * only an owner may send it (a manager gets `owner_only`). Leaving it out keeps the switch as it is.
 */
export type OpenCaseInput = {
  readonly venueId: string;
  readonly topic: CaseTopic;
  readonly subject: string;
  /** Absent or null = no body (''). */
  readonly body?: string | null;
  readonly allowAct?: boolean;
};
export type OpenCaseReply =
  | RpcOk<{ readonly caseId: string; readonly supportCanAct: boolean }>
  | RpcFail<'venue_unknown' | 'rate_limited' | 'owner_only' | 'enum_invalid' | 'text_missing' | 'text_invalid' | 'text_too_long'>;

/** Codes: type, field_not_allowed, id_invalid, enum_invalid, text_missing, text_invalid, text_too_long. */
export function validateOpenCase(raw: unknown): Validation<OpenCaseInput> {
  return validateInput<OpenCaseInput>(raw, ['venueId', 'topic', 'subject', 'body', 'allowAct'], (x, o) => {
    if (!isUuid(o.venueId)) x.add('id_invalid', 'venueId');
    if (!oneOf(CASE_TOPICS, o.topic)) x.add('enum_invalid', 'topic');
    requiredText(x, o.subject, 'subject', CASE_SUBJECT_MAX);
    if (o.body !== undefined) optionalText(x, o.body, 'body', CASE_BODY_MAX);
    if (o.allowAct !== undefined && typeof o.allowAct !== 'boolean') x.add('type', 'allowAct');
  });
}

/**
 * `ops_update_case(p_case, p_status, p_topic, p_reason)`: Halom staff change a case's status or topic, with a reason
 * the owner sees. This is Halom's own record, so it does not need the owner's support switch (unlike
 * `act_for_owner`). `p_reason` defaults to null in SQL and is checked inside (`reason_required` when it is missing,
 * blank or shorter than 3); a caller who is not staff gets 42501 `not_staff`.
 */
export type UpdateCaseInput = {
  readonly caseId: string;
  readonly status?: CaseStatus;
  readonly topic?: CaseTopic;
  readonly reason?: string | null;
};
export type UpdateCaseReply =
  | RpcOk<{ readonly case: SupportCase }>
  | RpcFail<'reason_required' | 'enum_invalid' | 'nothing_to_change' | 'case_unknown'>;

/** Codes: type, field_not_allowed, id_invalid, enum_invalid, nothing_to_change, reason_required. */
export function validateUpdateCase(raw: unknown): Validation<UpdateCaseInput> {
  return validateInput<UpdateCaseInput>(raw, ['caseId', 'status', 'topic', 'reason'], (x, o) => {
    if (!isUuid(o.caseId)) x.add('id_invalid', 'caseId');
    if (o.status !== undefined && !oneOf(CASE_STATUSES, o.status)) x.add('enum_invalid', 'status');
    if (o.topic !== undefined && !oneOf(CASE_TOPICS, o.topic)) x.add('enum_invalid', 'topic');
    if (o.status === undefined && o.topic === undefined) x.add('nothing_to_change', '');
    if (!isReason(o.reason)) x.add('reason_required', 'reason');
  });
}
