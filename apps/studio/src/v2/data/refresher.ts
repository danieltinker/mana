// How a live screen stays current (ADR-007), as one small timer the dashboard and the approval watch share: with a
// Realtime channel, each message is a signal to fetch again (at most once per LIVE_REFRESH.debounceMs); without one,
// or when the channel fails, it polls every `pollMs` with pollDelay's backoff, only while the page is visible. A channel
// that subscribes again stops the polling and catches up once. Pure: the timers, the clock's randomness and "is the
// page visible" are passed in, so the unit tests drive it with a fake clock.
import { LIVE_REFRESH, pollDelay } from '@mana/contracts';

export type Timers = { readonly set: (fn: () => void, ms: number) => unknown; readonly clear: (handle: unknown) => void };
export const browserTimers: Timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) };

export type RefresherOptions = {
  /** Fetch and apply the numbers; rejects on failure (counted for the backoff). */
  readonly fetch: () => Promise<void>;
  readonly pollMs: number;
  readonly visible: () => boolean;
  readonly debounceMs?: number;
  readonly timers?: Timers;
  readonly random?: () => number;
};

export type Refresher = {
  /** Fetch now and stay current: polling from the start when `poll`, otherwise once a channel reports a failure. */
  start(o: { poll: boolean }): void;
  stop(): void;
  /** A Realtime message (or the owner's own write): fetch again within `debounceMs`, once for a burst. */
  signal(): void;
  /** A channel's status: SUBSCRIBED stops polling and fetches once; CHANNEL_ERROR, TIMED_OUT and CLOSED start it. */
  status(s: string): void;
  /** Fetch now (the page became visible, the range changed). Overlapping requests are folded into one more fetch. */
  now(): Promise<void>;
  readonly polling: boolean;
  readonly failures: number;
};

const FAILED = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

export function refresher(o: RefresherOptions): Refresher {
  const timers = o.timers ?? browserTimers;
  const debounceMs = o.debounceMs ?? LIVE_REFRESH.debounceMs;
  let running = false, polling = false, failures = 0;
  let pollHandle: unknown = null, debounceHandle: unknown = null;
  let inflight: Promise<void> | null = null, again = false;

  function run(): Promise<void> {
    if (!running) return Promise.resolve();
    if (inflight) { again = true; return inflight; }
    inflight = o.fetch().then(() => { failures = 0; }, () => { failures++; }).finally(() => {
      inflight = null;
      if (again && running) { again = false; void run(); }
    });
    return inflight;
  }

  function schedule() {
    if (pollHandle !== null) timers.clear(pollHandle);
    pollHandle = null;
    if (!running || !polling) return;
    pollHandle = timers.set(async () => {
      pollHandle = null;
      if (!running || !polling) return;
      if (o.visible()) await run();
      schedule();
    }, pollDelay(o.pollMs, failures, o.random));
  }
  const startPolling = () => { if (!polling) { polling = true; schedule(); } };
  const stopPolling = () => { polling = false; if (pollHandle !== null) timers.clear(pollHandle); pollHandle = null; };

  return {
    start({ poll }) {
      running = true;
      polling = poll;
      // the first wait follows the first answer, so a failure there already counts for the backoff
      void run().then(schedule);
    },
    stop() {
      running = false;
      stopPolling();
      if (debounceHandle !== null) timers.clear(debounceHandle);
      debounceHandle = null;
      again = false;
      failures = 0;
    },
    signal() {
      if (!running || debounceHandle !== null) return;
      debounceHandle = timers.set(() => { debounceHandle = null; void run(); }, debounceMs);
    },
    status(s) {
      if (!running) return;
      if (s === 'SUBSCRIBED') { stopPolling(); void run(); }
      else if (FAILED.has(s)) startPolling();
    },
    now: () => run(),
    get polling() { return polling; },
    get failures() { return failures; },
  };
}
