/**
 * `useLive`: a page's data, kept current by the live controller (live.ts): Realtime signals when the environment has
 * Realtime and the page names a channel, polling otherwise. A poll or a refresh keeps the last good answer on screen
 * while it loads, and when it fails (with the error), so nothing jumps. A new question (other deps: another venue, range
 * or filter) starts from nothing: an answer about something else is never shown under the new question.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { LIVE_REFRESH } from '@mana/contracts';
import type { Fail, Result } from './api.ts';
import { SAFETY_MS, startLive, type Live, type LiveMode, type Subscribe } from './live.ts';
import { useCtx } from './ui.tsx';

declare global {
  interface Window {
    /** Tests shorten the polling interval (the default is LIVE_REFRESH.pollMs.ops). */
    __OPS_POLL_MS?: number;
    /** Tests shorten the safety poll while subscribed (the default is SAFETY_MS). */
    __OPS_SAFETY_MS?: number;
  }
}

export type LiveData<T> = {
  readonly data: T | null;
  readonly fail: Fail | null;
  /** When the shown data arrived (this page's clock). */
  readonly loadedAt: number | null;
  readonly busy: boolean;
  readonly mode: LiveMode;
  /** Fetch again now (after the user's own write); true when it worked. */
  readonly refresh: () => Promise<boolean>;
};

export function useLive<T>(fetch: () => Promise<Result<T>>, deps: readonly unknown[], o: { subscribe?: Subscribe | null; poll?: boolean } = {}): LiveData<T> {
  const ctx = useCtx();
  const [state, setState] = useState<{ data: T | null; fail: Fail | null; loadedAt: number | null; busy: boolean; mode: LiveMode }>(
    { data: null, fail: null, loadedAt: null, busy: true, mode: 'polling' });
  const live = useRef<Live | null>(null);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: null, fail: null, loadedAt: null, busy: true, mode: s.mode }));
    const load = async (): Promise<boolean> => {
      setState((s) => ({ ...s, busy: true }));
      const r = await fetch();
      if (!alive) return false;
      if (r.ok) {
        setState({ data: r.data, fail: null, loadedAt: Date.now(), busy: false, mode: live.current?.mode ?? 'polling' });
        return true;
      }
      if (r.kind === 'not_staff') ctx.notStaff(r);
      else if (r.kind === 'signed_out') ctx.signedOut();
      setState((s) => ({ ...s, fail: r, busy: false, mode: live.current?.mode ?? 'polling' }));
      return false;
    };
    const subscribe = ctx.realtime && o.subscribe ? o.subscribe : undefined;
    // a page that does not poll (leads: every read is logged) fetches once and on demand
    live.current = startLive({
      load, pollMs: window.__OPS_POLL_MS || LIVE_REFRESH.pollMs.ops, safetyMs: window.__OPS_SAFETY_MS || SAFETY_MS, poll: o.poll !== false,
      ...(subscribe ? { subscribe } : {}),
      onMode: (mode) => { if (alive) setState((s) => ({ ...s, mode })); },
    });
    return () => { alive = false; live.current?.stop(); live.current = null; };
  }, deps);
  return { ...state, refresh: () => live.current?.refresh() ?? Promise.resolve(false) };
}
