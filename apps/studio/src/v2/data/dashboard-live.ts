// The dashboard (my_dashboard v2) for the open place, kept live while a screen that shows its numbers is open (Home,
// and the suggestion rules, whose per-rule numbers it fills with setRuleNumbers), as ADR-007 says: one Realtime channel
// per venue with a listener on each of LIVE_REFRESH.realtimeTables (filtered to the venue; RLS applies to every
// message) when the environment has Realtime, each message a signal to fetch again; otherwise polling every
// LIVE_REFRESH.pollMs.owner, only while the page is visible, with pollDelay's backoff. The page never patches itself
// from a message: the numbers, nudges and "off now" are the database's. It also fetches after the owner's own writes,
// when the page comes back to the foreground, and when the range changes. The last numbers stay on screen while the
// owner is elsewhere in the app, and go with the place.
import { effect, signal } from '@preact/signals';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { DASHBOARD_RANGES, LIVE_REFRESH, oneOf, venueFilter, type ClientDashboard, type DashboardRange } from '@mana/contracts';
import { route } from '../../ui.tsx';
import { runtime, sb } from './client.ts';
import { toV2Error } from './errors.ts';
import { myDashboard } from './records.ts';
import { refresher, type Refresher } from './refresher.ts';
import { setRuleNumbers } from './rule-numbers.ts';
import { canEdit, edits, menu, onReset, reloadMenuQuietly, signOut } from './store.ts';

/** The screens that show the dashboard's numbers. */
const SHOWN_ON: ReadonlySet<string> = new Set(['home', 'rules']);
const RANGE_KEY = 'mana-studio-v2-range';

function storedRange(): DashboardRange {
  try { const v = localStorage.getItem(RANGE_KEY); if (oneOf(DASHBOARD_RANGES, v)) return v; } catch { /* storage is optional */ }
  return 'today';
}

/** The range the owner picked (remembered on this phone). */
export const range = signal<DashboardRange>(storedRange());
/** The last reply for the open place (its `range` says which range it counts). */
export const dashboard = signal<ClientDashboard | null>(null);
export const dashLoading = signal(false);
/** The last failure's code ('' after a good fetch); what is on screen stays. */
export const dashError = signal('');

let venue: string | null = null, watching: string | null = null, generation = 0;
let live: Refresher | null = null, channel: RealtimeChannel | null = null;

async function fetchDashboard(): Promise<void> {
  const id = venue, gen = generation, r = range.value;
  if (!id) return;
  dashLoading.value = true;
  try {
    const d = await myDashboard(id, r);
    if (gen !== generation || r !== range.value) return;
    dashboard.value = d;
    dashError.value = '';
    setRuleNumbers(d.rules);
    catchUp(d);
  } catch (e) {
    if (gen !== generation) return;
    const err = toV2Error(e);
    dashError.value = err.code;
    if (err.code === 'signed_out') signOut();
    throw err;
  } finally {
    if (gen === generation) dashLoading.value = false;
  }
}

/**
 * A nudge or something off names a dish, a group or a section this phone has not loaded (another device or Halom made
 * it): read the menu again, once per such row, so the tap that fixes it opens it.
 */
const asked = new Set<string>();
function catchUp(d: ClientDashboard) {
  const m = menu.value;
  if (!m || m.venue.id !== d.venueId) return;
  const known = (kind: string, id: string) =>
    kind === 'dish' ? m.dishes.some((x) => x.id === id) : kind === 'group' ? m.groups.some((x) => x.id === id)
      : kind === 'section' ? m.sections.some((x) => x.id === id) : kind === 'option' ? m.options.some((x) => x.id === id) : true;
  const named = [...d.nudges.flatMap((n) => n.targets), ...d.offNow.map((o) => ({ kind: o.kind, id: o.id }))];
  const missing = named.filter((x) => !known(x.kind, x.id) && !asked.has(x.id));
  if (!missing.length) return;
  for (const x of missing) asked.add(x.id);
  void reloadMenuQuietly();
}

const onVisible = () => { if (document.visibilityState === 'visible') void live?.now(); };

function unwatch() {
  watching = null;
  live?.stop();
  live = null;
  if (channel) { sb.removeChannel(channel).catch(() => {}); channel = null; }
  document.removeEventListener('visibilitychange', onVisible);
}

function watch(id: string) {
  unwatch();
  if (id !== venue) { generation++; venue = id; dashboard.value = null; dashError.value = ''; }
  watching = id;
  live = refresher({ fetch: fetchDashboard, pollMs: LIVE_REFRESH.pollMs.owner, visible: () => document.visibilityState === 'visible' });
  document.addEventListener('visibilitychange', onVisible);
  if (runtime.realtime) {
    const filter = venueFilter(id);
    let ch = sb.channel('dash:' + id);
    for (const table of LIVE_REFRESH.realtimeTables) ch = ch.on('postgres_changes' as any, { event: '*', schema: 'public', table, filter }, () => live?.signal());
    channel = ch.subscribe((status: string) => live?.status(status));
  }
  live.start({ poll: !runtime.realtime });
}

onReset(() => {
  unwatch();
  generation++;
  venue = null;
  asked.clear();
  dashboard.value = null;
  dashError.value = '';
  dashLoading.value = false;
});

// live while a screen that shows the numbers is open, for an account that may read them (owners and managers)
effect(() => {
  const id = menu.value?.venue.id ?? null;
  const want = id && canEdit() && SHOWN_ON.has(route.value[0] || '') ? id : null;
  if (want !== watching) { if (want) watch(want); else unwatch(); }
});

// the owner's own writes: fetch again shortly (a burst of autosaves is one fetch)
let seenEdits = edits.peek();
effect(() => {
  const n = edits.value;
  if (n !== seenEdits) { seenEdits = n; live?.signal(); }
});

/** Another range: remembered, and fetched at once. */
export function setRange(r: DashboardRange) {
  if (r === range.value) return;
  range.value = r;
  try { localStorage.setItem(RANGE_KEY, r); } catch { /* storage is optional */ }
  void live?.now();
}

/** Fetch now (after a quick action, or "try again"). */
export const refreshDashboard = (): Promise<void> => live?.now() ?? Promise.resolve();
