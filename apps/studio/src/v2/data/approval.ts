// A first publish waits for Halom's approval (publish_requires_approval). While the open place waits, the app learns of
// the approval by itself (backlog B4), so the publish screen and Home flip to "live" without "check again": the venue
// row is read every LIVE_REFRESH.pollMs.owner while the page is visible (ADR-007's polling, with pollDelay's backoff
// after a failure), and at once when the page comes back to the foreground. When it is no longer waiting, the place is
// read again (refreshVenue) and the watch ends.
//
// Polling, also where Realtime runs: in phase 1 the Realtime publication holds only the rollups and
// availability_overrides (ADR-007), and `venues` stays out of it, so there is no channel to listen to for an approval.
import { effect } from '@preact/signals';
import { LIVE_REFRESH } from '@mana/contracts';
import { toast } from '../../lib/store.ts';
import { t } from '../i18n.ts';
import { standingOf } from './changes.ts';
import * as api from './menu.ts';
import { refresher, type Refresher } from './refresher.ts';
import { menu, onReset, refreshVenue } from './store.ts';

let watching: string | null = null, live: Refresher | null = null;

async function check(id: string): Promise<void> {
  const row = await api.venueRow(id);
  if (watching !== id || standingOf(row) === 'pending') return;
  await refreshVenue();
  if (standingOf(row) === 'live') toast(t('home2.approved'));
}

const onVisible = () => { if (document.visibilityState === 'visible') void live?.now(); };

function stop() {
  watching = null;
  live?.stop();
  live = null;
  document.removeEventListener('visibilitychange', onVisible);
}

function start(id: string) {
  stop();
  watching = id;
  live = refresher({ fetch: () => check(id), pollMs: LIVE_REFRESH.pollMs.owner, visible: () => document.visibilityState === 'visible' });
  document.addEventListener('visibilitychange', onVisible);
  live.start({ poll: true });
}

onReset(stop);
effect(() => {
  const v = menu.value?.venue;
  const want = v && standingOf(v) === 'pending' ? v.id : null;
  if (want !== watching) { if (want) start(want); else stop(); }
});
