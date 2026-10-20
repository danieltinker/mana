/**
 * Onboarding progress (F03): one row per step of `ONBOARDING_STEPS`, saved at every step so the owner can leave and
 * come back. Some steps the database marks done by itself, from what happened; the others the client app marks.
 */
import { isUuid, oneOf, type Validation } from './common.ts';
import { ONBOARDING_STATES, ONBOARDING_STEPS, type OnboardingState, type OnboardingStep } from './enums.ts';
import { validateInput, type RpcFail, type RpcOk } from './rpc.ts';

/**
 * Steps only the database marks `done`:
 * - `venue`: `create_venue`;
 * - `menu`: the venue's first dish (by hand or by an import);
 * - `review`: an applied import (`apply_import`);
 * - `publish`: a publish (`publish_menu`, or Halom's `act_for_owner`).
 * A client may set them to `doing`, never to `done`; of them only `review` may be `skipped` (a menu built by hand has
 * nothing to review); and a step the database marked `done` stays done.
 */
export const ONBOARDING_AUTO_STEPS = ['venue', 'menu', 'review', 'publish'] as const satisfies readonly OnboardingStep[];
export type AutoOnboardingStep = (typeof ONBOARDING_AUTO_STEPS)[number];
export const isAutoStep = (s: OnboardingStep): s is AutoOnboardingStep => (ONBOARDING_AUTO_STEPS as readonly string[]).includes(s);

/** A blocker is a machine word (`dish_without_price`), shown through the nudges' wording; never free text. */
export const BLOCKER_RE = /^[a-z][a-z0-9_]{1,40}$/;
export const BLOCKERS_MAX = 20;

export type OnboardingStepView = {
  readonly step: OnboardingStep;
  readonly state: OnboardingState;
  readonly blockers: readonly string[];
  /** The database marks this step done by itself. */
  readonly auto: boolean;
  /** The step row's `updated_at` at **full precision** (microseconds, as `to_jsonb` writes a `timestamptz`; never
   * `app.iso`, which drops the fraction), null when the step was never written. Staff send it back unchanged as
   * `onboarding.set`'s `expectedUpdatedAt` (one of ADR-008's exceptions to the `app.iso` rule). */
  readonly updatedAt: string | null;
};

export type OnboardingProgress = {
  readonly steps: readonly OnboardingStepView[];
  /** Steps done or skipped. */
  readonly done: number;
  readonly total: number;
  /** The first step, in journey order, that is neither done nor skipped; null when complete. */
  readonly next: OnboardingStep | null;
  readonly complete: boolean;
};

/** Progress from the stored rows (a missing row is `todo`). The back office's "stage" is `next ?? 'complete'`. */
export function onboardingProgress(
  rows: ReadonlyArray<{ readonly step: OnboardingStep; readonly state: OnboardingState; readonly blockers?: readonly string[]; readonly updatedAt?: string | null }>,
): OnboardingProgress {
  const byStep = new Map(rows.map((r) => [r.step, r] as const));
  const steps = ONBOARDING_STEPS.map((step): OnboardingStepView => {
    const r = byStep.get(step);
    return { step, state: r?.state ?? 'todo', blockers: r?.blockers ?? [], auto: isAutoStep(step), updatedAt: r?.updatedAt ?? null };
  });
  const finished = (s: OnboardingStepView): boolean => s.state === 'done' || s.state === 'skipped';
  const next = steps.find((s) => !finished(s))?.step ?? null;
  return { steps, done: steps.filter(finished).length, total: steps.length, next, complete: next === null };
}

/** `set_onboarding_step`: the client app marks a step (owners and managers; Halom through `act_for_owner`). */
export type SetStepInput = {
  readonly venueId: string;
  readonly step: OnboardingStep;
  readonly state: OnboardingState;
  readonly blockers?: readonly string[];
};
export type SetStepReply =
  | RpcOk<{ readonly progress: OnboardingProgress }>
  | RpcFail<'venue_unknown' | 'step_done' | 'step_automatic' | 'enum_invalid' | 'blocker_invalid' | 'too_many'>;

/** Codes: type, field_not_allowed, id_invalid, enum_invalid, blocker_invalid, too_many, step_automatic. The database
 * adds `step_done` (an automatic step it already marked done). */
export function validateSetStep(raw: unknown): Validation<SetStepInput> {
  return validateInput<SetStepInput>(raw, ['venueId', 'step', 'state', 'blockers'], (x, o) => {
    if (!isUuid(o.venueId)) x.add('id_invalid', 'venueId');
    if (!oneOf(ONBOARDING_STEPS, o.step)) x.add('enum_invalid', 'step');
    if (!oneOf(ONBOARDING_STATES, o.state)) x.add('enum_invalid', 'state');
    else if (oneOf(ONBOARDING_STEPS, o.step) && isAutoStep(o.step) && (o.state === 'done' || (o.state === 'skipped' && o.step !== 'review'))) {
      x.add('step_automatic', 'state');
    }
    if (o.blockers !== undefined) {
      if (!Array.isArray(o.blockers)) x.add('type', 'blockers');
      else {
        if (o.blockers.length > BLOCKERS_MAX) x.add('too_many', 'blockers');
        o.blockers.forEach((b, i) => { if (typeof b !== 'string' || !BLOCKER_RE.test(b)) x.add('blocker_invalid', `blockers[${i}]`); });
      }
    }
  });
}
