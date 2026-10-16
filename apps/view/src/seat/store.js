/* The demo's request store: sessionStorage, one key per venue, gone when the tab closes. A name and a phone are personal
   data: in the demo they are fictional and never leave this browser; in production this store is a Supabase table behind
   RLS (owner-only reads, a retention period Daniel sets). The same store serves the guest's page and the owner's page, so
   the round trip (request → approve) shows in one browser. Pure apart from the injected storage: unit-tested with a Map. */
import { validateRequest, transition } from '../../../../seating/validate.mjs';

export function createSessionStore(venue, storage) {
  const KEY = 'mana-seat:' + venue, MINE = KEY + ':mine';
  let mem = {};                                                          // a fallback when storage is refused (a private window with storage off)
  const get = (k) => { try { return storage && storage.getItem(k); } catch (e) { return mem[k] == null ? null : mem[k]; } };
  const set = (k, v) => { try { storage && storage.setItem(k, v); } catch (e) { /* kept in memory instead */ } mem[k] = v; };
  const read = (layout) => {
    let raw = null; try { raw = JSON.parse(get(KEY) || 'null'); } catch (e) { raw = null; }
    const list = raw && Array.isArray(raw.requests) ? raw.requests : [];
    return list.map((r) => validateRequest(r, layout)).filter((v) => v.ok).map((v) => v.request);      // anything malformed in storage is dropped, never shown
  };
  const write = (list) => set(KEY, JSON.stringify({ v: 1, requests: list }));
  return {
    list: (layout) => read(layout),
    byId: (layout, id) => read(layout).find((r) => r.id === id) || null,
    add(request, layout) { const v = validateRequest(request, layout); if (!v.ok) return v; const list = read(layout).filter((r) => r.id !== request.id); list.push(v.request); write(list); return v; },
    /* the owner acts: the state machine decides, the store only keeps what it allowed */
    act(id, action, layout, opts) {
      const list = read(layout), i = list.findIndex((r) => r.id === id); if (i < 0) return { ok: false, error: 'no such request' };
      const res = transition(list[i], action, layout, opts); if (!res.ok) return res;
      list[i] = res.request; write(list); return res;
    },
    mine: () => get(MINE) || null, setMine: (id) => set(MINE, id || ''),
    clear() { write([]); set(MINE, ''); }
  };
}
