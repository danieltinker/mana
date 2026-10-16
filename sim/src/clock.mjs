// Time for the bots. An event's time always carries an offset (the contracts refuse one without), written the way a
// phone in the venue's time zone writes it: 2026-10-15T23:04:05.123+03:00.

const OFFSET_FMT = new Map();
function offsetMinutes(ms, tz) {
  let f = OFFSET_FMT.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }); OFFSET_FMT.set(tz, f); }
  const name = f.formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = /GMT([+-])(\d\d):(\d\d)/.exec(name);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** An ISO instant in a time zone's local time with its offset (or 'Z' when tz is 'UTC'). */
export function isoAt(ms, tz = 'Asia/Jerusalem') {
  if (tz === 'UTC') return new Date(ms).toISOString();
  const off = offsetMinutes(ms, tz);
  const local = new Date(ms + off * 60000).toISOString().replace('Z', '');
  const sign = off < 0 ? '-' : '+';
  const a = Math.abs(off);
  return `${local}${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/** The wall clock. */
export const realClock = { now: () => Date.now(), advance: async () => {} };

/**
 * A guest's own clock in a compressed run: it starts at `start` and moves on by the think times the script gives it,
 * without waiting. With `realtime`, it waits for the wall clock to reach each moment (for live-looking dashboards).
 */
export function guestClock(start, { realtime = false } = {}) {
  let t = start;
  return {
    now: () => t,
    advance: async (ms) => {
      t += ms;
      if (realtime) { const d = t - Date.now(); if (d > 0) await new Promise((r) => setTimeout(r, d)); }
    },
  };
}
