// Leaving a screen that holds changes not saved yet (a group form): the screen registers a guard while it holds them,
// and every way out of it (its back link, the bottom bar, the brand, another place, signing out) asks through it first.
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

type Ask = (proceed: () => void) => void;
const guard = signal<Ask | null>(null);

/** While `active`, leaving calls `ask(proceed)` (the screen asks the owner, then calls `proceed`) instead of going. */
export function useLeaveGuard(active: boolean, ask: Ask) {
  useEffect(() => {
    if (!active) return;
    const mine: Ask = (proceed) => ask(proceed);
    guard.value = mine;
    return () => { if (guard.value === mine) guard.value = null; };
  }, [active]);
}

/** A screen holds changes: a way out should ask first. */
export const leaveGuarded = () => guard.value !== null;

/** Go (`proceed`), or ask first when a screen holds changes. */
export function leave(proceed: () => void) {
  const g = guard.value;
  if (g) g(proceed); else proceed();
}
