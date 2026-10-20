// A place's onboarding steps as this phone writes them (set_onboarding_step), pure (QA2-M2): one step's writes go out
// one after another, never together and never out of order, so a visit's late `doing` cannot land after the owner's
// "done" or "later" and reopen the step. A `doing` asked for a step already finished is not sent at all. A refusal that
// carries the progress as stored (the database keeps `done` or `skipped` over a late `doing`) puts that progress on
// screen as the answer, so the screen shows the real state.
import type { OnboardingProgress, OnboardingState, OnboardingStep } from '@mana/contracts';

/** Sends one write; answers the progress the database stored (or kept). */
export type StepSend = (step: OnboardingStep, state: OnboardingState, blockers: readonly string[] | null) => Promise<OnboardingProgress>;

const finished = (s: OnboardingState | undefined) => s === 'done' || s === 'skipped';

/**
 * `write(step, state, blockers)`: queued behind that step's earlier writes. `current()` is the progress on screen,
 * `show(p)` puts an answer there. Each place gets its own writer (data/onboarding.ts makes a new one on a reset).
 */
export function stepWriter(send: StepSend, current: () => OnboardingProgress | null, show: (p: OnboardingProgress) => void) {
  const chains = new Map<OnboardingStep, Promise<unknown>>();
  return function write(step: OnboardingStep, state: OnboardingState, blockers: readonly string[] | null = null): Promise<OnboardingProgress | null> {
    const run = async (): Promise<OnboardingProgress | null> => {
      // a visit asked while the step was being finished: by now it is finished, and stays so
      if (state === 'doing' && finished(current()?.steps.find((x) => x.step === step)?.state)) return current();
      const p = await send(step, state, blockers);
      show(p);
      return p;
    };
    const out = (chains.get(step) ?? Promise.resolve()).then(run, run);
    chains.set(step, out.catch(() => undefined));
    return out;
  };
}

/** The progress a refused write carries back as stored (`{ ok: false, code, progress }`), or null for any other refusal. */
export function keptProgress(answer: unknown): OnboardingProgress | null {
  const p = answer && typeof answer === 'object' ? (answer as { progress?: unknown }).progress : null;
  return p && typeof p === 'object' && Array.isArray((p as { steps?: unknown }).steps) ? (p as OnboardingProgress) : null;
}
