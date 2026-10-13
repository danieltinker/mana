/* The table clocks' demo: a calm, compressed evening in the Olea room. One restaurant minute passes each second. Every seated
   table has a time frame (90 minutes, the owner's default; table 8 has its own 60); its clock runs down; at five minutes
   or less it is "ending soon"; at zero the time is up, the manager is told (one toast at a time, 2.5 s), and the table
   frees. A few seconds later another party sits. Deterministic (no randomness), so ?t= in the lab always shows the same
   moment. advance(dt) takes seconds; view() is what the floor draws. Numbers here are a demo, not anyone's data. */

export const RATE = 1;                     // restaurant minutes per second
export const SOON = 5;                     // minutes left at which a table is "ending soon"
const TOAST_S = 2.5, GAP_S = .7, RESEAT_S = 6, ARRIVE_EVERY_S = 41, SEATED_TARGET = 4, FRAME = 90;

/* layout order numbers the tables 1..12 (the bar is "Bar"); the evening starts with four tables seated and one reserved */
const START = { 4: { left: 8 }, 6: { left: 39 }, 8: { left: 23, frame: 60 }, 9: { left: 61 } };
const RESERVED = 2, OWN_FRAME = { 8: 60 };
const ROTATION = [12, 3, 7, 1, 5, 11, 6, 4, 9, 8, 2];      // who sits next, skipping tables that are not free

export function createSim(layout) {
  const tables = layout.tables.map((t, i) => ({ id: t.id, no: i + 1, bar: t.shape === 'bar', live: !!t.bookable && t.shape !== 'bar', st: 'free', start: 0, frame: FRAME }));
  const byNo = (n) => tables[n - 1];
  let now = 0, rot = 0, nextArrive = 34, toast = null, toastQ = [], reseatAt = [], gapUntil = 0;
  Object.keys(START).forEach((n) => { const s = START[n], t = byNo(+n); t.st = 'seated'; t.frame = s.frame || FRAME; t.start = -(t.frame - s.left) / RATE; });
  byNo(RESERVED).st = 'reserved';

  const seatedCount = () => tables.filter((t) => t.st === 'seated' || t.st === 'up').length;
  function nextFree() {
    for (let k = 0; k < ROTATION.length; k++) { const t = byNo(ROTATION[(rot + k) % ROTATION.length]); if (t.live && t.st === 'free') { rot = (rot + k + 1) % ROTATION.length; return t; } }
    return null;
  }
  function seat(t) { t.st = 'seated'; t.start = now; t.frame = OWN_FRAME[t.no] || FRAME; }
  const left = (t) => t.frame - (now - t.start) * RATE;

  function step(dt) {
    now += dt;
    tables.forEach((t) => { if (t.st === 'seated' && left(t) <= 0) { t.st = 'up'; toastQ.push(t); } });
    if (toast && now >= toast.until) { toast.table.st = 'free'; reseatAt.push(now + RESEAT_S); toast = null; gapUntil = now + GAP_S; }
    if (!toast && toastQ.length && now >= gapUntil) { const t = toastQ.shift(); toast = { table: t, no: t.no, since: now, until: now + TOAST_S }; }
    reseatAt = reseatAt.filter((at) => { if (now < at) return true; if (seatedCount() < SEATED_TARGET) { const t = nextFree(); if (t) seat(t); } return false; });
    if (now >= nextArrive) {                                       // the reserved party arrives; the next reservation is booked
      nextArrive += ARRIVE_EVERY_S;
      const r = tables.find((t) => t.st === 'reserved'); if (r) seat(r);
      const n = nextFree(); if (n) n.st = 'reserved';
    }
  }
  return {
    advance(dt) { let d = Math.max(0, dt); while (d > 1e-6) { const s = Math.min(d, .05); step(s); d -= s; } },
    get time() { return now; },
    /* per table: { id, no, bar, live, st: free|seated|soon|up|reserved, left (minutes, rounded up), frac (0..1 of the frame left) } */
    view() {
      return tables.map((t) => {
        if (t.st !== 'seated' && t.st !== 'up') return { id: t.id, no: t.no, bar: t.bar, live: t.live, st: t.st, left: 0, frac: 0 };
        const l = Math.max(0, left(t));
        return { id: t.id, no: t.no, bar: t.bar, live: t.live, st: t.st === 'up' ? 'up' : l <= SOON ? 'soon' : 'seated', left: Math.ceil(l - 1e-6), frac: l / t.frame };
      });
    },
    /* the toast showing now, if any: { no, since, until } */
    toast: () => (toast ? { no: toast.no, since: toast.since, until: toast.until } : null)
  };
}
