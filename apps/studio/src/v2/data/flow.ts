// The setup flow (F03) as one guided path, pure: the steps in journey order (the contracts' ONBOARDING_STEPS), which
// step a place opens on (where its owner left off, on any device: the first step neither done nor skipped), what holds
// each step back (machine words, as the database's blockers are), and how each step ends. Nothing here writes: the
// state's writes are in data/onboarding.ts (set_onboarding_step), and the screens decide when.
//
// How a step ends:
// - `venue`, `menu`, `review` and `publish` are the database's own (ONBOARDING_AUTO_STEPS): it marks them done itself
//   (create_venue, the first dish, apply_import, publish_menu). The app never sets them done; of them it may only skip
//   `review`, for a menu built by hand (nothing was imported, so there is nothing to check).
// - `addons` is done when every add-on group's limits are confirmed; `hours` and `test` when the owner says so.
// - `photos` and `style` have no screen of their own in this app yet: the owner can only leave them for later
//   (skipped), which is what happened, never "done".
// - Any step but the database's may be left for later (skipped): a skipped step counts as finished, so the flow goes on;
//   what still needs doing comes back as Home's nudges.
import { isAutoStep, ONBOARDING_STEPS, type OnboardingProgress, type OnboardingState, type OnboardingStep } from '@mana/contracts';

export const FLOW_STEPS: readonly OnboardingStep[] = ONBOARDING_STEPS;

export const isStep = (s: unknown): s is OnboardingStep => typeof s === 'string' && (FLOW_STEPS as readonly string[]).includes(s);
export const stepNumber = (s: OnboardingStep): number => FLOW_STEPS.indexOf(s) + 1;
export const isFinished = (state: OnboardingState): boolean => state === 'done' || state === 'skipped';
export const stateOf = (p: OnboardingProgress | null, s: OnboardingStep): OnboardingState => p?.steps.find((x) => x.step === s)?.state ?? 'todo';

/**
 * Where the flow opens: the first step, in journey order, that is neither done nor skipped (the contracts'
 * `onboardingProgress(…).next`), so an owner who leaves comes back to the same step on any device. null: all set.
 */
export const resumeStep = (p: OnboardingProgress): OnboardingStep | null => p.next;

/**
 * The address (inside `#/onboarding/`) the flow opens on by itself: the resume step, except that an imported menu
 * waiting for its check is that check (the menu step is done by applying the import); `done` once every step is
 * finished.
 */
export function openStep(p: OnboardingProgress, f: Pick<PlaceFacts, 'importsWaiting'>): OnboardingStep | 'done' {
  const next = resumeStep(p);
  if (!next) return 'done';
  return next === 'menu' && f.importsWaiting > 0 ? 'review' : next;
}

/** The step after `s` that is still open (after it in order first, then from the start); null when every step is finished. */
export function nextOpenAfter(p: OnboardingProgress, s: OnboardingStep): OnboardingStep | null {
  const i = FLOW_STEPS.indexOf(s);
  const open = (x: OnboardingStep) => x !== s && !isFinished(stateOf(p, x));
  return FLOW_STEPS.slice(i + 1).find(open) ?? FLOW_STEPS.slice(0, i).find(open) ?? null;
}

/** What the flow knows about the place, read from what is loaded (the menu, the imports, where the menu stands). */
export type PlaceFacts = {
  readonly dishes: number;
  /** Add-on groups whose limits an import guessed and the owner has not confirmed yet. */
  readonly groupsUnconfirmed: number;
  /** Imports read and waiting for the owner's review (`parsed`). */
  readonly importsWaiting: number;
  /** Imports being read now (`uploaded` or `parsing`). */
  readonly importsReading: number;
  readonly importsApplied: number;
  readonly hours: number;
  /** The publish screen's issues: what would stop a publish now. */
  readonly publishIssues: number;
};

/**
 * What holds a step back, as machine words (`BLOCKER_RE`; what `set_onboarding_step` stores and Halom's back office
 * shows). An empty list: nothing does.
 */
export function blockersOf(s: OnboardingStep, f: PlaceFacts): string[] {
  switch (s) {
    case 'menu': return f.dishes === 0 ? (f.importsWaiting > 0 ? ['import_waiting'] : f.importsReading > 0 ? ['import_reading'] : ['menu_empty']) : [];
    case 'review': return f.importsWaiting > 0 ? ['import_waiting'] : f.importsReading > 0 ? ['import_reading'] : [];
    case 'addons': return f.groupsUnconfirmed > 0 ? ['group_without_limits'] : [];
    case 'publish': return f.dishes === 0 ? ['menu_empty'] : f.publishIssues > 0 ? ['publish_issues'] : [];
    default: return [];
  }
}

/**
 * How a step's screen can end it now, from the owner's side:
 * - `done`: the owner says it is done (`set_onboarding_step(step, 'done')`);
 * - `skip`: left for later (`'skipped'`), the only end of `photos` and `style` here;
 * - `review_skip`: a menu built by hand has nothing to review (`review` → `'skipped'`, the one automatic step a client
 *   may skip);
 * - `wait`: only the database ends it (an automatic step not done yet), so the screen leads to what does (an import to
 *   apply, a publish).
 * `later` says whether "do this later" (skipped) is offered beside it.
 */
export type StepEnd = { readonly end: 'done' | 'skip' | 'review_skip' | 'wait'; readonly later: boolean };

export function stepEnd(s: OnboardingStep, f: PlaceFacts): StepEnd {
  switch (s) {
    case 'venue': case 'menu': case 'publish': return { end: 'wait', later: false };
    case 'review':
      // built by hand (dishes, nothing imported, nothing waiting): nothing to review
      return f.importsApplied === 0 && f.importsWaiting === 0 && f.importsReading === 0 && f.dishes > 0 ? { end: 'review_skip', later: false } : { end: 'wait', later: false };
    case 'addons': return f.groupsUnconfirmed > 0 ? { end: 'wait', later: true } : { end: 'done', later: false };
    case 'photos': case 'style': return { end: 'skip', later: false };
    case 'hours': case 'test': return { end: 'done', later: true };
  }
}

/** The state a step is written with when the owner first opens it: `doing` (with what holds it back), never over a finished one. */
export function visitWrite(s: OnboardingStep, state: OnboardingState, f: PlaceFacts): { state: 'doing'; blockers: string[] } | null {
  if (state !== 'todo') return null;
  if (s === 'venue') return null;                        // create_venue marks it; nothing to visit
  return { state: 'doing', blockers: blockersOf(s, f) };
}

/** The write that ends a step from the owner's side, or null when only the database may end it (and `end` says so). */
export function endWrite(s: OnboardingStep, how: 'done' | 'skip' | 'review_skip'): { step: OnboardingStep; state: 'done' | 'skipped' } | null {
  if (how === 'review_skip') return s === 'review' ? { step: 'review', state: 'skipped' } : null;
  if (isAutoStep(s)) return null;
  return { step: s, state: how === 'done' ? 'done' : 'skipped' };
}
