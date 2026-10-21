// Leaving a screen that holds changes not saved yet (a group form, a section sheet): the screen registers a guard while
// it holds them, and every way out of it asks through it first: its own close or back link, the bottom bar, the brand,
// another place, signing out (through `leave`), and the browser's Back and Forward or a typed address (`popstate`: the
// address is put back before the router hears of it, and the owner is asked).
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { route } from '../ui.tsx';
import { session } from './data/store.ts';

type Ask = (proceed: () => void) => void;
type Guard = { readonly holds: () => boolean; readonly ask: Ask };
const guard = signal<Guard | null>(null);
/** The guard whose screen the owner already agreed to leave (or that saved): it asks no more. */
let released: Guard | null = null;

/**
 * While `active`, leaving calls `ask(proceed)` (the screen asks the owner, then calls `proceed`) instead of going. Whether
 * the screen holds changes is read from its latest render, at once (an Escape right after typing is asked too).
 */
export function useLeaveGuard(active: boolean, ask: Ask) {
  const now = useRef({ active, ask });
  now.current = { active, ask };
  const mine = useRef<Guard | null>(null);
  if (!active && mine.current && released === mine.current) released = null;     // clean again: the next change asks
  useEffect(() => {
    const g: Guard = { holds: () => now.current.active, ask: (proceed) => now.current.ask(proceed) };
    mine.current = g; guard.value = g;
    return () => { if (guard.value === g) guard.value = null; if (released === g) released = null; };
  }, []);
}

const holding = (): Ask | null => { const g = guard.value; return g && g !== released && g.holds() ? g.ask : null; };

/** A screen holds changes: a way out should ask first. */
export const leaveGuarded = () => holding() !== null;

/** Go (`proceed`), or ask first when a screen holds changes. */
export function leave(proceed: () => void) {
  const ask = holding(), g = guard.value;
  if (ask) ask(() => { released = g; proceed(); }); else proceed();
}

/** Go without asking: the screen saved (or decided) what it held. */
export function pass(proceed: () => void) {
  released = guard.value;
  proceed();
}

// the browser's own ways out. `popstate` comes before `hashchange`, which the router listens to: the address is put back
// first, so the router reads the screen's own address and the screen stays as it is
const hashOf = (r: readonly string[]) => '#/' + r.map(encodeURIComponent).join('/');
window.addEventListener('popstate', () => {
  const ask = holding(), g = guard.value;
  if (!ask || !session.value) return;                   // signed out (the session ended): nothing is left to guard
  history.pushState(null, '', hashOf(route.value));     // Back once more asks again
  ask(() => { released = g; history.back(); });        // leaving: back to the address the owner went to
});
