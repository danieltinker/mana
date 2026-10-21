/* The guest's events (F10, ADR-004), sent to `track_events` in batches: the seven guest events of @mana/contracts with
   their props exactly as EVENT_PROPS lists them (ids, closed words, small numbers, booleans; nothing about the person).
   No cookie, no visitor, session or device id: the only id is a random dedupe id per event.

   Batched (at most MAX_BATCH, sent a moment after the first one queued, at once when the page is hidden) and retried
   with the SAME ids when the network or the server fails, so a retry that the server did receive counts once (the
   database keeps the ids). An answer that refuses the batch is not retried. Never two sends at a time. */
import { EVENT_PROPS, MAX_BATCH, newEventId, offsetAt } from '@mana/contracts';

/** A random dedupe id (uuid v4): the contracts' own (crypto.randomUUID where the phone has it, else getRandomValues). */
export const newId = () => newEventId();

const pad = (n, w = 2) => String(n).padStart(w, '0');
/** An instant in the venue's local time with its offset, as the contracts require: 2026-10-15T23:04:05.123+03:00. */
export function isoAt(ms, tz) {
  const off = Math.round(offsetAt(ms, tz) / 60000), local = new Date(ms + off * 60000).toISOString().slice(0, 23), a = Math.abs(off);
  return local + (off < 0 ? '-' : '+') + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
}

/**
 * @param o.send     (batch, { keepalive }) → Promise<{ ok, status }>  one track_events call
 * @param o.venueId  the menu's venue
 * @param o.tz       the venue's time zone (event times carry its offset)
 * @param o.delay    ms between the first queued event and the send
 * @param o.timers   { set(fn, ms), clear(t) }   (injected for tests)
 */
export function createEvents({ send, venueId, tz, now = Date.now, id = newId, delay = 1500, timers = { set: (f, ms) => setTimeout(f, ms), clear: (t) => clearTimeout(t) } }) {
  const queue = [], waiters = [];
  let timer = null, busy = null, failures = 0;
  const schedule = (ms) => { if (timer === null) timer = timers.set(() => { timer = null; flush(); }, ms); };

  /** Queues one event; its props are exactly the contract's (a missing one is a bug and throws). */
  function emit(name, props) {
    const spec = EVENT_PROPS[name], clean = {};
    for (const k of Object.keys(spec)) { if (!(k in props)) throw new Error(name + ': ' + k + ' is missing'); clean[k] = props[k]; }
    queue.push({ id: id(), name, venueId, at: isoAt(now(), tz), props: clean });
    schedule(delay);
  }

  const settle = () => { if (!queue.length) waiters.splice(0).forEach((f) => f()); };
  async function sendAll(keepalive) {
    while (queue.length) {
      const batch = queue.slice(0, MAX_BATCH);
      let r;
      try { r = await send(batch, { keepalive }); } catch (e) { r = { ok: false, status: 0 }; }
      if (r.ok || (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429)) {
        queue.splice(0, batch.length); failures = 0;          // stored (or refused for good: never retried)
        continue;
      }
      failures += 1;                                          // the network or the server: the same ids again, later
      schedule(Math.min(60000, 2000 * 2 ** (failures - 1)));
      return;
    }
  }
  /**
   * Sends what is queued, a batch at a time; resolves when the queue is empty or a send failed (then it retries later).
   * `busy` is the one send loop out: set before the loop can end and cleared only after it, so it is never left behind
   * by a flush that found nothing to send (the page hidden with nothing queued, a delay timer after its event went out).
   */
  function flush({ keepalive = false } = {}) {
    if (timer !== null) { timers.clear(timer); timer = null; }
    if (busy) return busy;
    if (!queue.length) { settle(); return Promise.resolve(); }
    busy = sendAll(keepalive).then(() => { busy = null; settle(); });
    return busy;
  }

  return {
    emit, flush,
    pending: () => queue.length,
    /** For tests and debugging: what is queued, whether a send is out, how many failed in a row. */
    state: () => ({ queued: queue.length, sending: !!busy, failures, waiting: timer !== null }),
    /** Resolves once everything queued so far has been sent (for tests and for leaving the page). */
    drained: () => (queue.length ? new Promise((r) => { waiters.push(r); flush(); }) : Promise.resolve())
  };
}
