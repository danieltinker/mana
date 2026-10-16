// What is off right now at the open place, kept current (ADR-007): loaded with the place, fetched again after every quick
// action, and live: a Realtime channel on availability_overrides when the environment has one, otherwise polling every
// LIVE_REFRESH.pollMs (only while the page is visible, with pollDelay's backoff). A clock signal moves at the next
// "until", so a dish comes back on screen at the minute the database restores it, with no fetch.
import { effect, signal } from '@preact/signals';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { LIVE_REFRESH, pollDelay, venueFilter } from '@mana/contracts';
import type { AvailabilityOverrideRow, UntilSpec } from '@mana/contracts';
import { availabilityApi, offEntries, targetsOf, type OffTarget } from './availability.ts';
import { q, runtime, sb } from './client.ts';
import { toV2Error } from './errors.ts';
import { menu, onReset, signOut } from './store.ts';

/** The overrides that are not restored and not over, oldest first. */
export const overrides = signal<AvailabilityOverrideRow[]>([]);
/** The clock the screens read "off now" with (moves at the next "until", and at least every minute). */
export const clock = signal(Date.now());

const api = availabilityApi((fn, args) => q(sb.rpc(fn, args)));
let venue: string | null = null, generation = 0;
let pollTimer: ReturnType<typeof setTimeout> | null = null, tickTimer: ReturnType<typeof setTimeout> | null = null;
let debounce: ReturnType<typeof setTimeout> | null = null, failures = 0, channel: RealtimeChannel | null = null, polling = false;

/** The entries as the guest's phone reads them, at the clock's time. */
export const offNow = () => offEntries(overrides.value, clock.value);

async function fetchOff(): Promise<void> {
  const id = venue, gen = generation;
  if (!id) return;
  const rows = await q<AvailabilityOverrideRow[]>(sb.from('availability_overrides').select('*').eq('venue_id', id).is('restored_at', null)
    .or(`until_at.is.null,until_at.gt.${new Date().toISOString()}`).order('starts_at'));
  if (gen !== generation) return;
  overrides.value = rows;
  clock.value = Date.now();
  tick();
}

/** Fetch again; a failure is counted for the polling backoff (what is on screen stays). */
export async function refreshOff(): Promise<void> {
  try { await fetchOff(); failures = 0; }
  catch (e) { failures++; if (toV2Error(e).code === 'signed_out') signOut(); }
}

/** Move the clock at the next moment something comes back (or in a minute). */
function tick() {
  if (tickTimer) clearTimeout(tickTimer);
  const now = Date.now();
  const next = Math.min(now + 60_000, ...overrides.value.map((o) => (o.until_at ? Date.parse(o.until_at) : Infinity)).filter((x) => x > now));
  tickTimer = setTimeout(() => { clock.value = Date.now(); tick(); }, Math.max(1000, next - now + 250));
}

function poll() {
  if (pollTimer) clearTimeout(pollTimer);
  if (!polling) return;
  pollTimer = setTimeout(async () => {
    if (document.visibilityState === 'visible') await refreshOff();
    poll();
  }, pollDelay(LIVE_REFRESH.pollMs.owner, failures));
}
const startPolling = () => { if (!polling) { polling = true; poll(); } };
const stopPolling = () => { polling = false; if (pollTimer) clearTimeout(pollTimer); pollTimer = null; };
const onVisible = () => { if (document.visibilityState === 'visible' && venue) refreshOff(); };

function stop() {
  generation++;
  stopPolling();
  if (tickTimer) clearTimeout(tickTimer);
  if (debounce) clearTimeout(debounce);
  tickTimer = debounce = null;
  if (channel) { sb.removeChannel(channel).catch(() => {}); channel = null; }
  document.removeEventListener('visibilitychange', onVisible);
  venue = null; failures = 0;
  overrides.value = [];
}

function start(id: string) {
  stop();
  venue = id;
  const gen = generation;
  refreshOff();
  document.addEventListener('visibilitychange', onVisible);
  if (!runtime.realtime) { startPolling(); return; }
  // a message is a signal to fetch again, at most once per debounceMs; polling covers a channel that fails
  channel = sb.channel('off:' + id)
    .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'availability_overrides', filter: venueFilter(id) }, () => {
      if (gen !== generation || debounce) return;
      debounce = setTimeout(() => { debounce = null; refreshOff(); }, LIVE_REFRESH.debounceMs);
    })
    .subscribe((status: string) => {
      // a channel removed with its place (another place opened, or signed out) says CLOSED: that is not a failure to cover
      if (gen !== generation) return;
      if (status === 'SUBSCRIBED') { stopPolling(); refreshOff(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') startPolling();
    });
}

onReset(stop);
effect(() => {
  const id = menu.value?.venue.id ?? null;
  if (id !== venue) { if (id) start(id); else stop(); }
});

// ---------------------------------------------------------------- the quick actions
/** Take it off until `until` (each choice of a group). Answers when it comes back (null: until brought back). */
export async function takeOff(target: OffTarget, until: UntilSpec): Promise<string | null> {
  const d = menu.value!;
  try {
    const out = await api.setAll(d.venue.id, targetsOf(target, d.options), until);
    return out[0]?.untilAt ?? null;
  } finally { await refreshOff(); }
}

/** Bring it back now (each choice of a group). */
export async function bringBack(target: OffTarget): Promise<void> {
  const d = menu.value!;
  try { await api.setAll(d.venue.id, targetsOf(target, d.options), null); }
  finally { await refreshOff(); }
}

/** Everything taken off today comes back; what was taken off on an earlier day stays. Answers how many came back. */
export async function restoreToday(): Promise<number> {
  try { return (await api.restoreToday(menu.value!.venue.id)).restored; }
  finally { await refreshOff(); }
}
