/**
 * How a page of the back office stays current (ADR-007, `LIVE_REFRESH`):
 * - with a Realtime channel, each message is a signal to fetch again, at most once per `debounceMs`, never the data;
 * - without one (realtime off, a channel that reports CHANNEL_ERROR, TIMED_OUT or CLOSED, or a page that always polls),
 *   it polls every `pollMs`, only while the page is visible, at once when it becomes visible again after a poll fell due,
 *   with `pollDelay`'s backoff after failures; polling stops when the channel subscribes again;
 * - `refresh()` after the user's own write waits for a fetch in flight and fetches again (never reuses a request that
 *   started before the change).
 * One fetch at a time. Pure: the clock, the visibility and the subscription are passed in, so the rules are tested.
 */
import { LIVE_REFRESH, pollDelay } from '@mana/contracts';

export type ChannelStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR';
/** Subscribes; calls `signal` per message and `status` per channel state; returns the unsubscribe. */
export type Subscribe = (signal: () => void, status: (s: ChannelStatus) => void) => () => void;

export type Clock = { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void; now(): number };
export type Visibility = { visible(): boolean; onChange(fn: () => void): () => void };

export const browserClock: Clock = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};
export const documentVisibility: Visibility = {
  visible: () => document.visibilityState === 'visible',
  onChange: (fn) => { document.addEventListener('visibilitychange', fn); return () => document.removeEventListener('visibilitychange', fn); },
};

export type LiveOptions = {
  /** Fetches the page's data; true when it worked. */
  readonly load: () => Promise<boolean>;
  readonly pollMs: number;
  /** false: fetch at start and on refresh() only (a page whose every read is logged). */
  readonly poll?: boolean;
  readonly debounceMs?: number;
  /** A Realtime subscription; absent = polling only. */
  readonly subscribe?: Subscribe;
  readonly clock?: Clock;
  readonly visibility?: Visibility;
  readonly random?: () => number;
};
export type LiveMode = 'realtime' | 'polling';
export type Live = {
  refresh(): Promise<boolean>;
  stop(): void;
  readonly mode: LiveMode;
  readonly failures: number;
};

export function startLive(o: LiveOptions): Live {
  const clock = o.clock ?? browserClock;
  const vis = o.visibility ?? documentVisibility;
  const debounceMs = o.debounceMs ?? LIVE_REFRESH.debounceMs;
  let mode: LiveMode = 'polling';
  let failures = 0;
  let stopped = false;
  let inFlight: Promise<boolean> | null = null;
  let lastStart = -Infinity;
  let pollTimer: unknown = null;
  let signalTimer: unknown = null;
  /** A poll fell due, or a signal came, while the page was hidden. */
  let due = false;
  /** A signal came while a fetch was in flight: fetch again after it. */
  let again = false;
  let everSubscribed = false;

  const clearPoll = (): void => { if (pollTimer !== null) { clock.clearTimeout(pollTimer); pollTimer = null; } };
  function schedule(): void {
    clearPoll();
    if (stopped || mode !== 'polling' || o.poll === false) return;
    pollTimer = clock.setTimeout(() => {
      pollTimer = null;
      if (stopped) return;
      if (vis.visible()) void run(); else due = true;
    }, pollDelay(o.pollMs, failures, o.random));
  }

  function run(): Promise<boolean> {
    if (inFlight) { again = true; return inFlight; }
    lastStart = clock.now();
    const p = o.load().then((ok) => ok, () => false).then((ok) => {
      failures = ok ? 0 : failures + 1;
      inFlight = null;
      if (!stopped) {
        if (again) { again = false; signal(); }
        if (mode === 'polling') schedule();
      }
      return ok;
    });
    inFlight = p;
    return p;
  }

  function signal(): void {
    if (stopped || signalTimer !== null) return;
    if (!vis.visible()) { due = true; return; }
    if (inFlight) { again = true; return; }
    signalTimer = clock.setTimeout(() => { signalTimer = null; if (!stopped) void run(); }, Math.max(0, lastStart + debounceMs - clock.now()));
  }

  function onStatus(s: ChannelStatus): void {
    if (stopped) return;
    if (s === 'SUBSCRIBED') {
      mode = 'realtime';
      clearPoll();
      if (everSubscribed) signal();      // back after a gap that polling covered: catch up once
      everSubscribed = true;
    } else if (mode !== 'polling') {
      mode = 'polling';
      schedule();
    }
  }

  const offVisibility = vis.onChange(() => {
    if (stopped || !vis.visible() || !due) return;
    due = false;
    void run();
  });
  const unsubscribe = o.subscribe ? o.subscribe(signal, onStatus) : null;
  void run();

  return {
    // a fetch that started after the wait began already sees the change, so it is shared
    refresh: () => (inFlight ?? Promise.resolve(true)).then(() => (stopped ? false : inFlight ?? run())),
    stop() {
      stopped = true;
      clearPoll();
      if (signalTimer !== null) clock.clearTimeout(signalTimer);
      offVisibility();
      unsubscribe?.();
    },
    get mode() { return mode; },
    get failures() { return failures; },
  };
}
