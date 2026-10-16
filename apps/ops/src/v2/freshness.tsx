/**
 * How fresh a page's numbers are: with Realtime, what the channel covers is live and the rest comes with the safety poll;
 * without it, refreshed every 30 s. When this page last loaded them, and up to which minute the rollups are built
 * (ADR-004: about a minute behind at most). A refresh button beside it. Not a live region: a poll is not news.
 */
import { useEffect, useState } from 'preact/hooks';
import { LIVE_REFRESH } from '@mana/contracts';
import type { LiveData } from './hooks.ts';
import { SAFETY_MS } from './live.ts';
import { fmtClock, fmtTime, freshnessWords } from './model.ts';
import { Icon } from './ui.tsx';

export function Freshness({ live, rolledUpAt, polls = true, liveWhat }: { live: LiveData<unknown>; rolledUpAt?: string | null; polls?: boolean; liveWhat?: string }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15_000); return () => clearInterval(t); }, []);
  const how = freshnessWords({ mode: live.mode, polls, pollMs: window.__OPS_POLL_MS || LIVE_REFRESH.pollMs.ops, safetyMs: window.__OPS_SAFETY_MS || SAFETY_MS, liveWhat });
  return (
    <div class="fresh" data-fresh={live.mode}>
      <span class={'fresh-dot' + (live.mode === 'realtime' ? ' is-live' : '')} aria-hidden="true" />
      <span class="fresh-text">
        {live.loadedAt ? <>Updated <strong data-updated-at>{fmtClock(live.loadedAt)}</strong> · <span data-fresh-how>{how}</span></> : <span class="muted">Not loaded yet</span>}
        {rolledUpAt !== undefined && <span class="muted fresh-rollup"> · numbers to {rolledUpAt ? fmtTime(rolledUpAt) : '—'}</span>}
      </span>
      <button type="button" class="btn btn-sm btn-ghost" onClick={() => void live.refresh()} disabled={live.busy} data-refresh aria-label={live.busy ? 'Refreshing' : 'Refresh now'}>
        <span class={live.busy ? 'spin' : ''}><Icon name="refresh" /></span>
      </button>
    </div>
  );
}
