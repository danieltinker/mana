/**
 * How fresh a page's numbers are: live (Realtime) or refreshed every 30 s, when this page last loaded them, and up to
 * which minute the rollups are built (ADR-004: about a minute behind at most). A refresh button beside it.
 */
import { useEffect, useState } from 'preact/hooks';
import { LIVE_REFRESH } from '@mana/contracts';
import type { LiveData } from './hooks.ts';
import { fmtClock, fmtTime } from './model.ts';
import { Icon } from './ui.tsx';

export function Freshness({ live, rolledUpAt, polls = true }: { live: LiveData<unknown>; rolledUpAt?: string | null; polls?: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15_000); return () => clearInterval(t); }, []);
  const how = live.mode === 'realtime' ? 'live' : polls ? `refreshes every ${Math.round((window.__OPS_POLL_MS || LIVE_REFRESH.pollMs.ops) / 1000)} s` : 'loaded on demand';
  return (
    <div class="fresh" aria-live="polite" data-fresh={live.mode}>
      <span class={'fresh-dot' + (live.mode === 'realtime' ? ' is-live' : '')} aria-hidden="true" />
      <span class="fresh-text">
        {live.loadedAt ? <>Updated <strong data-updated-at>{fmtClock(live.loadedAt)}</strong> · {how}</> : <span class="muted">Not loaded yet</span>}
        {rolledUpAt !== undefined && <span class="muted fresh-rollup"> · numbers to {rolledUpAt ? fmtTime(rolledUpAt) : '—'}</span>}
      </span>
      <button type="button" class="btn btn-sm btn-ghost" onClick={() => void live.refresh()} disabled={live.busy} data-refresh aria-label={live.busy ? 'Refreshing' : 'Refresh now'}>
        <span class={live.busy ? 'spin' : ''}><Icon name="refresh" /></span>
      </button>
    </div>
  );
}
