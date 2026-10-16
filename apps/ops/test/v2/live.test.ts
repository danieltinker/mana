// The live controller (src/v2/live.ts) on a fake clock: polling every pollMs only while visible, at once when the page
// comes back after a poll fell due, backoff after failures, Realtime signals debounced, polling as the fallback when a
// channel fails and stopped when it subscribes again, refresh after the user's own write.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_REFRESH } from '@mana/contracts';
import { startLive, type ChannelStatus, type Clock, type Visibility } from '../../src/v2/live.ts';

function fakeClock() {
  let now = 0;
  let next = 1;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const clock: Clock = {
    setTimeout: (fn, ms) => { const id = next++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout: (h) => { timers.delete(h as number); },
    now: () => now,
  };
  /** Moves time on, running every timer that falls due (in order), and lets promises settle after each. */
  async function advance(ms: number): Promise<void> {
    const end = now + ms;
    for (;;) {
      const due = [...timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      now = due[1].at;
      due[1].fn();
      await settle();
    }
    now = end;
    await settle();
  }
  return { clock, advance, pending: () => timers.size };
}
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

function fakeVisibility(start = true) {
  let visible = start;
  const fns = new Set<() => void>();
  const v: Visibility = { visible: () => visible, onChange: (fn) => { fns.add(fn); return () => fns.delete(fn); } };
  return { v, set: (x: boolean) => { visible = x; for (const fn of fns) fn(); }, listeners: () => fns.size };
}

function loader(results: boolean[] = []) {
  const calls: number[] = [];
  let i = 0;
  const load = async () => { calls.push(i); const ok = results[i] ?? true; i++; return ok; };
  return { load, calls };
}

const POLL = LIVE_REFRESH.pollMs.ops;
const noJitter = () => 0.5;                     // pollDelay's jitter at its middle: exactly the base

test('polling: a fetch at start, then every pollMs while visible', async () => {
  const { clock, advance } = fakeClock();
  const { v } = fakeVisibility();
  const l = loader();
  const live = startLive({ load: l.load, pollMs: POLL, clock, visibility: v, random: noJitter });
  await settle();
  assert.equal(l.calls.length, 1);
  assert.equal(live.mode, 'polling');
  await advance(POLL - 1);
  assert.equal(l.calls.length, 1);
  await advance(1);
  assert.equal(l.calls.length, 2);
  await advance(POLL * 3);
  assert.equal(l.calls.length, 5);
  live.stop();
  await advance(POLL * 3);
  assert.equal(l.calls.length, 5, 'nothing after stop');
});

test('polling: never while hidden; at once when visible again, only if a poll fell due', async () => {
  const { clock, advance } = fakeClock();
  const vis = fakeVisibility();
  const l = loader();
  const live = startLive({ load: l.load, pollMs: POLL, clock, visibility: vis.v, random: noJitter });
  await settle();
  vis.set(false);
  await advance(POLL * 4);
  assert.equal(l.calls.length, 1, 'hidden: no fetch');
  vis.set(true);
  await settle();
  assert.equal(l.calls.length, 2, 'visible again: at once');
  await advance(POLL);
  assert.equal(l.calls.length, 3, 'and on schedule after it');
  vis.set(false); vis.set(true);
  await settle();
  assert.equal(l.calls.length, 3, 'a quick switch away and back, before a poll fell due: no extra fetch');
  live.stop();
  assert.equal(vis.listeners(), 0);
});

test('polling: backoff doubles per failure, at most maxBackoffMs, back to pollMs after a success', async () => {
  const { clock, advance } = fakeClock();
  const { v } = fakeVisibility();
  const l = loader([true, false, false, false, false, false, true]);
  const live = startLive({ load: l.load, pollMs: POLL, clock, visibility: v, random: noJitter });
  await settle();
  const gaps: number[] = [];
  let last = 0;
  for (let n = 2; n <= 8; n++) {
    for (let t = 0; t < 400 && l.calls.length < n; t++) await advance(1000);
    gaps.push(clock.now() - last); last = clock.now();
  }
  assert.deepEqual(gaps, [30_000, 60_000, 120_000, 120_000, 120_000, 120_000, 30_000]);
  assert.equal(live.failures, 0);
  live.stop();
});

test('realtime: subscribed stops polling; messages are signals, debounced to one fetch per debounceMs', async () => {
  const { clock, advance } = fakeClock();
  const { v } = fakeVisibility();
  const l = loader();
  let signal = () => {};
  let status: (s: ChannelStatus) => void = () => {};
  let unsubscribed = 0;
  const live = startLive({ load: l.load, pollMs: POLL, clock, visibility: v, random: noJitter, debounceMs: 1500,
    subscribe: (sig, st) => { signal = sig; status = st; return () => { unsubscribed++; }; } });
  await settle();
  status('SUBSCRIBED');
  assert.equal(live.mode, 'realtime');
  await advance(POLL * 3);
  assert.equal(l.calls.length, 1, 'no polling while subscribed');
  for (let i = 0; i < 10; i++) signal();
  await advance(0);
  assert.equal(l.calls.length, 2, 'the first signal after a quiet spell fetches at once (the last fetch was long ago), once for the burst');
  signal(); signal();
  await advance(1000);
  assert.equal(l.calls.length, 2, 'within debounceMs of the last fetch: wait');
  await advance(499);
  assert.equal(l.calls.length, 2);
  await advance(1);
  assert.equal(l.calls.length, 3, 'then one fetch for the burst, debounceMs after the last one');
  live.stop();
  assert.equal(unsubscribed, 1);
});

test('realtime: a failing channel falls back to polling; subscribing again stops it and catches up once', async () => {
  const { clock, advance } = fakeClock();
  const { v } = fakeVisibility();
  const l = loader();
  let status: (s: ChannelStatus) => void = () => {};
  const live = startLive({ load: l.load, pollMs: POLL, clock, visibility: v, random: noJitter, subscribe: (_s, st) => { status = st; return () => {}; } });
  await settle();
  status('SUBSCRIBED');
  for (const bad of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'] as const) {
    status(bad);
    assert.equal(live.mode, 'polling', bad);
    const before = l.calls.length;
    await advance(POLL);
    assert.equal(l.calls.length, before + 1, `${bad}: polls`);
    status('SUBSCRIBED');
    assert.equal(live.mode, 'realtime');
    await advance(LIVE_REFRESH.debounceMs);
    assert.equal(l.calls.length, before + 2, 'catches up once after the gap');
    await advance(POLL * 2);
    assert.equal(l.calls.length, before + 2, 'and stops polling');
  }
  live.stop();
});

test('refresh after a write: waits for the fetch in flight, then fetches again', async () => {
  const { clock } = fakeClock();
  const { v } = fakeVisibility();
  const resolvers: ((ok: boolean) => void)[] = [];
  let started = 0;
  const load = () => { started++; return new Promise<boolean>((r) => resolvers.push(r)); };
  const live = startLive({ load, pollMs: POLL, clock, visibility: v, random: noJitter });
  assert.equal(started, 1);
  const done = live.refresh();
  await settle();
  assert.equal(started, 1, 'the fetch in flight started before the write: not reused, not doubled');
  resolvers[0]!(true);
  await settle();
  assert.equal(started, 2);
  resolvers[1]!(true);
  assert.equal(await done, true);
  live.stop();
});

test('poll: false fetches at start and on refresh only (a page whose every read is logged)', async () => {
  const { clock, advance, pending } = fakeClock();
  const { v } = fakeVisibility();
  const l = loader();
  const live = startLive({ load: l.load, pollMs: POLL, poll: false, clock, visibility: v, random: noJitter });
  await settle();
  await advance(POLL * 10);
  assert.equal(l.calls.length, 1);
  assert.equal(pending(), 0, 'no timer at all');
  await live.refresh();
  assert.equal(l.calls.length, 2);
  live.stop();
});

test('a signal while hidden waits for the page to be visible', async () => {
  const { clock, advance } = fakeClock();
  const vis = fakeVisibility();
  const l = loader();
  let signal = () => {};
  let status: (s: ChannelStatus) => void = () => {};
  const live = startLive({ load: l.load, pollMs: POLL, clock, visibility: vis.v, subscribe: (sig, st) => { signal = sig; status = st; return () => {}; } });
  await settle();
  status('SUBSCRIBED');
  vis.set(false);
  signal();
  await advance(10_000);
  assert.equal(l.calls.length, 1);
  vis.set(true);
  await settle();
  assert.equal(l.calls.length, 2);
  live.stop();
});
