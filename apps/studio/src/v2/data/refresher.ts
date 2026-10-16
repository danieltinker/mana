// How a live screen stays current (ADR-007, amended in round 3), as one small timer the dashboard and the approval watch
// share: with a Realtime channel, each message is a signal to fetch again (at most once per LIVE_REFRESH.debounceMs),
// and a slow safety poll every LIVE_REFRESH.safetyMs catches what the subscribed tables do not carry; without one, or
// when the channel fails, it polls every `pollMs`. Every poll waits for the page to be visible and backs off after a
// failure (pollDelay). A channel that subscribes again returns to the safety poll and catches up once. Pure: the
// timers, the randomness and "is the page visible" are passed in, so the unit tests drive it with a fake clock.
import { LIVE_REFRESH, pollDelay } from '@mana/contracts';

export type Timers = { readonly set: (fn: () => void, ms: number) => unknown; readonly clear: (handle: unknown) => void };
export const browserTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

export type RefresherOptions = {
  /** Fetch and apply the numbers; rejects on failure (counted for the backoff). */
  readonly fetch: () => Promise<void>;
  /** The poll without Realtime. */
  readonly pollMs: number;
  /** The slow poll beside a Realtime subscription (default `LIVE_REFRESH.safetyMs`). */
  readonly safetyMs?: number;
  readonly visible: () => boolean;
  readonly debounceMs?: number;
  readonly timers?: Timers;
  readonly random?: () => number;
};

/** `poll`: no Realtime (or the channel failed); `safety`: beside a subscription; `off`: stopped. */
export type RefreshMode = 'off' | 'poll' | 'safety';

export type Refresher = {
  /** Fetch now and stay current: polling every `pollMs` when `poll`, else the safety poll beside the channel. */
  start(o: { poll: boolean }): void;
  stop(): void;
  /** A Realtime message (or the owner's own write): fetch again within `debounceMs`, once for a burst. */
  signal(): void;
  /** A channel's status: SUBSCRIBED returns to the safety poll and fetches once; CHANNEL_ERROR, TIMED_OUT and CLOSED
   * poll every `pollMs`. */
  status(s: string): void;
  /** Fetch now (the page became visible, the range changed). Overlapping requests are folded into one more fetch. */
  now(): Promise<void>;
  readonly mode: RefreshMode;
  readonly failures: number;
};

const FAILED = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

export function refresher(o: RefresherOptions): Refresher {
  const timers = o.timers ?? browserTimers;
  const debounceMs = o.debounceMs ?? LIVE_REFRESH.debounceMs;
  const safetyMs = o.safetyMs ?? LIVE_REFRESH.safetyMs;
  let mode: RefreshMode = 'off', failures = 0;
  let pollHandle: unknown = null, debounceHandle: unknown = null;
  let inflight: Promise<void> | null = null, again = false;

  function run(): Promise<void> {
    if (mode === 'off') return Promise.resolve();
    if (inflight) { again = true; return inflight; }
    inflight = o.fetch().then(() => { failures = 0; }, () => { failures++; }).finally(() => {
      inflight = null;
      if (again && mode !== 'off') { again = false; void run(); }
    });
    return inflight;
  }

  function schedule() {
    if (pollHandle !== null) timers.clear(pollHandle);
    pollHandle = null;
    if (mode === 'off') return;
    pollHandle = timers.set(async () => {
      pollHandle = null;
      if (mode === 'off') return;
      if (o.visible()) await run();
      schedule();
    }, pollDelay(mode === 'poll' ? o.pollMs : safetyMs, failures, o.random));
  }
  const switchTo = (m: Exclude<RefreshMode, 'off'>) => { if (mode !== m) { mode = m; schedule(); } };

  return {
    start({ poll }) {
      mode = poll ? 'poll' : 'safety';
      // the first wait follows the first answer, so a failure there already counts for the backoff
      void run().then(schedule);
    },
    stop() {
      mode = 'off';
      if (pollHandle !== null) timers.clear(pollHandle);
      if (debounceHandle !== null) timers.clear(debounceHandle);
      pollHandle = debounceHandle = null;
      again = false;
      failures = 0;
    },
    signal() {
      if (mode === 'off' || debounceHandle !== null) return;
      debounceHandle = timers.set(() => { debounceHandle = null; void run(); }, debounceMs);
    },
    status(s) {
      if (mode === 'off') return;
      if (s === 'SUBSCRIBED') { switchTo('safety'); void run(); }
      else if (FAILED.has(s)) switchTo('poll');
    },
    now: () => run(),
    get mode() { return mode; },
    get failures() { return failures; },
  };
}
