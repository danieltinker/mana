/* Peak windows and time frames: when a venue is busy (the owner's days and hours), the slots a table can be bid for
   inside a window, and the time frame a new seating gets (per table, per zone, and shorter at peak if the owner wants).
   Pure ESM, no DOM, no clock of its own (`at` / `now` is passed in: ms since the epoch or a Date; days and hours are
   read in the browser's local time, the venue's). Works with seating/timers.mjs, which it does not change: the board
   asks frameFor() and passes the answer to timers.seat(…, { minutes }).

   peaks (v1): { windows: [{ days: [0..6] (0 = Sunday), from: 'HH:MM', to: 'HH:MM' }], slot: minutes (a bid slot's length),
                 opensBefore: minutes (bidding for a slot opens this long before it starts),
                 closeBefore: minutes (bidding closes this long before it starts) }
   frames (v1): { zones: { zoneId: minutes }, peak: { minutes: minutes | null, zones: { zoneId: minutes } } }
   Which frame a new seating gets, first match wins: the table's own (timers' overrides) → at peak, the zone's peak frame →
   at peak, the venue's peak frame → the zone's frame → the venue's default (timers' settings.minutes). */
import { LIMITS } from './timers.mjs';

export const MIN = 60000;
export const PEAK_LIMITS = Object.freeze({ slot: [30, 240, 15], opensBefore: [15, 720, 15], closeBefore: [0, 60, 5] });
export const PEAK_DEFAULTS = Object.freeze({ slot: 90, opensBefore: 120, closeBefore: 10 });
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const onScale = (v, [lo, hi, step]) => Number.isInteger(v) && v >= lo && v <= hi && (v - lo) % step === 0;
const ms = (v) => (v instanceof Date ? v.getTime() : v);
const mins = (hm) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
const dayStart = (at) => { const d = new Date(ms(at)); d.setHours(0, 0, 0, 0); return d.getTime(); };
const atMinute = (day0, m) => { const d = new Date(day0); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.getTime(); };

/* → { ok: true, peaks } | { ok: false, errors, codes }. Never throws. Windows of one day may not overlap (one table would
   otherwise belong to two slots at once). */
export function validatePeaks(raw) { try { return checkPeaks(raw); } catch (e) { return { ok: false, errors: ['malformed peaks'], codes: ['bad-peaks'] }; } }
function checkPeaks(raw) {
  const errors = [], err = (m) => errors.push(m);
  if (!isObj(raw)) return { ok: false, errors: ['not an object'] };
  const windows = Array.isArray(raw.windows) ? raw.windows : (err('windows must be an array'), []);
  const out = windows.map((w, i) => {
    if (!isObj(w)) { err('windows[' + i + '] must be an object'); return null; }
    const days = Array.isArray(w.days) ? [...new Set(w.days)].sort() : [];
    if (!days.length || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) err('windows[' + i + '].days must be days 0..6 (0 = Sunday)');
    if (!(typeof w.from === 'string' && HM.test(w.from)) || !(typeof w.to === 'string' && HM.test(w.to))) err('windows[' + i + '] needs from and to as HH:MM');
    else if (mins(w.to) <= mins(w.from)) err('windows[' + i + '] must end after it starts (the same day)');
    return { days, from: w.from, to: w.to };
  }).filter(Boolean);
  const pick = (k) => { const v = raw[k] == null ? PEAK_DEFAULTS[k] : raw[k]; if (!onScale(v, PEAK_LIMITS[k])) err(k + ' must be ' + PEAK_LIMITS[k][0] + '–' + PEAK_LIMITS[k][1] + ' in steps of ' + PEAK_LIMITS[k][2]); return v; };
  const peaks = { windows: out, slot: pick('slot'), opensBefore: pick('opensBefore'), closeBefore: pick('closeBefore') };
  if (peaks.closeBefore >= peaks.opensBefore) err('bidding must open before it closes');
  const codes = errors.map(() => 'bad-peaks');
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const A = out[i], B = out[j];
    if (A.days.some((d) => B.days.includes(d)) && HM.test(A.from) && HM.test(B.from) && HM.test(A.to) && HM.test(B.to) && mins(A.from) < mins(B.to) && mins(B.from) < mins(A.to)) { errors.push('windows[' + i + '] and windows[' + j + '] overlap'); codes.push('peak-overlap'); }
  }
  return errors.length ? { ok: false, errors, codes } : { ok: true, peaks };
}

/* the window `at` falls in, as { from, to } in ms on that day, or null */
export function peakAt(peaks, at) {
  const t = ms(at), d0 = dayStart(t), day = new Date(t).getDay();
  for (const w of peaks.windows) {
    if (!w.days.includes(day)) continue;
    const a = atMinute(d0, mins(w.from)), b = atMinute(d0, mins(w.to));
    if (t >= a && t < b) return { from: a, to: b, window: w };
  }
  return null;
}
/* every window of the day `at` is in, in order: [{ from, to }] */
export function windowsOn(peaks, at) {
  const d0 = dayStart(at), day = new Date(ms(at)).getDay();
  return peaks.windows.filter((w) => w.days.includes(day)).map((w) => ({ from: atMinute(d0, mins(w.from)), to: atMinute(d0, mins(w.to)), window: w })).sort((a, b) => a.from - b.from);
}
/* the bid slots of a window: back to back from its start, `slot` minutes each; the last one ends with the window */
export function slotsOf(peaks, win) {
  const out = [], len = peaks.slot * MIN;
  for (let s = win.from; s < win.to; s += len) { const e = Math.min(win.to, s + len); if (e - s >= LIMITS.minutes[0] * MIN) out.push(slotOf(peaks, s, e)); }
  return out;
}
const slotOf = (peaks, start, end) => ({ start, end, opensAt: start - peaks.opensBefore * MIN, closesAt: start - peaks.closeBefore * MIN });
/* the slot that starts at `start` (a slot of some peak window that day), or null */
export function slotAt(peaks, start) {
  for (const w of windowsOn(peaks, start)) { const s = slotsOf(peaks, w).find((x) => x.start === ms(start)); if (s) return s; }
  return null;
}
/* the slots whose bidding is open at `now` (today's and tomorrow's windows), in order */
export function openSlots(peaks, now) {
  const t = ms(now), days = [t, t + 24 * 60 * MIN];
  return days.flatMap((d) => windowsOn(peaks, d).flatMap((w) => slotsOf(peaks, w))).filter((s) => t >= s.opensAt && t < s.closesAt);
}
/* the next moment a peak window starts after `now` (within a week), or null */
export function nextPeak(peaks, now) {
  const t = ms(now);
  for (let k = 0; k < 8; k++) { const w = windowsOn(peaks, t + k * 24 * 60 * MIN).find((x) => x.from > t); if (w) return w; }
  return null;
}

/* ---------- time frames ---------- */
export function validateFrames(raw, layout) { try { return checkFrames(raw, layout); } catch (e) { return { ok: false, errors: ['malformed frames'] }; } }
function checkFrames(raw, layout) {
  const errors = [], err = (m) => errors.push(m), zones = new Set(layout ? layout.zones.map((z) => z.id) : []);
  if (!isObj(raw)) return { ok: false, errors: ['not an object'] };
  const map = (o, where) => {
    const out = {}; if (o == null) return out; if (!isObj(o)) { err(where + ' must be an object of zone → minutes'); return out; }
    Object.keys(o).sort().forEach((z) => { if (o[z] == null) return; if (layout && !zones.has(z)) return;      // a zone that left the layout is dropped
      if (!onScale(o[z], LIMITS.minutes)) err(where + '.' + z + ' must be 15–360 minutes in steps of 5'); else out[z] = o[z]; });
    return out;
  };
  const peak = isObj(raw.peak) ? raw.peak : {};
  if (peak.minutes != null && !onScale(peak.minutes, LIMITS.minutes)) err('peak.minutes must be 15–360 in steps of 5');
  const frames = { zones: map(raw.zones, 'zones'), peak: { minutes: peak.minutes == null ? null : peak.minutes, zones: map(peak.zones, 'peak.zones') } };
  return errors.length ? { ok: false, errors } : { ok: true, frames };
}
/* the frame a new seating at `tableId` gets at `at`, and why: { minutes, why: 'table' | 'peak-zone' | 'peak' | 'zone' | 'default' } */
export function frameFor({ timers, frames, peaks, layout }, tableId, at) {
  const t = layout.tables.find((x) => x.id === tableId); if (!t) throw new Error('unknown table ' + JSON.stringify(tableId));
  const own = timers.settings.overrides[tableId];
  if (own != null) return { minutes: own, why: 'table' };
  if (peaks && peakAt(peaks, at)) {
    if (frames.peak.zones[t.zone] != null) return { minutes: frames.peak.zones[t.zone], why: 'peak-zone' };
    if (frames.peak.minutes != null) return { minutes: frames.peak.minutes, why: 'peak' };
  }
  if (frames.zones[t.zone] != null) return { minutes: frames.zones[t.zone], why: 'zone' };
  return { minutes: timers.settings.minutes, why: 'default' };
}
