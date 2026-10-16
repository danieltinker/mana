/* The demo's memory: localStorage, one versioned key per venue (and per clock speed, so a sped-up pitch never mixes its
   times with the real clock's). What is kept: the table clock's state (seating/timers.mjs, checked by validateState on the
   way in), the alerts the manager has seen, and, for a sped-up clock, where its time stood. No names, no phones: a party
   is a number. In production this is the seatings table behind RLS (db/proposed/0006_table_clock.sql). */
import { validateState } from '../../../../seating/timers.mjs';

export function createStore(venue, speed, storage) {
  const KEY = 'mana-host:v1:' + venue + (speed !== 1 ? ':x' + speed : '');
  let mem = null;
  const get = () => { try { return storage ? storage.getItem(KEY) : mem; } catch (e) { return mem; } };
  const set = (v) => { mem = v; try { if (storage) storage.setItem(KEY, v); } catch (e) { /* kept in memory instead */ } };
  return {
    key: KEY,
    /* → { state, seen: [key], clock: { real, virt } | null } or null when there is nothing (or nothing valid) kept */
    load(ids) {
      let raw = null; try { raw = JSON.parse(get() || 'null'); } catch (e) { raw = null; }
      if (!raw || raw.v !== 1) return null;
      const v = validateState(raw.state, ids); if (!v.ok) return null;
      const seen = Array.isArray(raw.seen) ? raw.seen.filter((k) => typeof k === 'string').slice(-100) : [];
      const clock = raw.clock && Number.isFinite(raw.clock.real) && Number.isFinite(raw.clock.virt) ? { real: raw.clock.real, virt: raw.clock.virt } : null;
      return { state: v.state, seen, clock };
    },
    save(state, seen, clock) { set(JSON.stringify({ v: 1, state, seen: seen.slice(-100), clock: clock || null })); },
    clear() { set(''); try { if (storage) storage.removeItem(KEY); } catch (e) { /* fine */ } }
  };
}
