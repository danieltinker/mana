/* Editing a floor: the owner moves a table (it snaps to 5 cm and 15°), adds one from a small palette, duplicates, deletes,
   changes its seats, party sizes and zone, and undoes or redoes. Pure ESM, no DOM: each operation takes a layout.v1 (as
   validateLayout returned it) and returns a new one; the screen keeps a history of them. warnings() says what is wrong
   with a floor (two tables in each other's way, a table outside the venue) without refusing it: the owner may be
   halfway through a change. Save passes the result through validateLayout. The table's size (sizeOf) is shared with the
   3D place and the 2D plan, so what overlaps here is what overlaps on screen. */
import { footprint } from '../view/src/seat/plan.js';

export const SNAP = 0.05, TURN = 15, CHAIR = 0.46;
/* the small palette: what "Add a table" offers */
export const PALETTE = {
  round2: { shape: 'round', seats: 2, minParty: 1, maxParty: 2, look: { top: 'marble', seat: 'chairs', w: 0.6 } },
  round3: { shape: 'round', seats: 3, minParty: 1, maxParty: 3, look: { top: 'marble', seat: 'chairs', w: 0.7 } },
  square2: { shape: 'square', seats: 2, minParty: 1, maxParty: 2, look: { top: 'wood', seat: 'chairs', w: 0.7, d: 0.7 } },
  long4: { shape: 'long', seats: 4, minParty: 2, maxParty: 4, look: { top: 'wood', seat: 'chairs', w: 1.4, d: 0.8 } },
  lounge: { shape: 'square', seats: 4, minParty: 2, maxParty: 4, look: { top: 'wood', seat: 'sofa', w: 0.7, d: 0.5 } }
};
const OUTSIDE = ['walkway', 'closed', 'kitchen', 'counter'];
const r2 = (v) => Math.round(v * 1000) / 1000;
export const snap = (v, step = SNAP) => r2(Math.round(v / step) * step);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const copy = (layout) => JSON.parse(JSON.stringify(layout));
/* a refusal: a plain reason and a code the screens translate (floor/i18n.js err_*) */
export class EditError extends Error { constructor(m, code) { super(m); this.name = 'EditError'; this.code = code; } }
const refuse = (m, code) => { throw new EditError(m, code); };
const find = (layout, id) => { const t = layout.tables.find((x) => x.id === id); if (!t) refuse('unknown table ' + JSON.stringify(id), 'no-table'); return t; };
const inRect = (r, x, z) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];

/* a table's top in metres: { round, w, d } (round: w = d = the diameter). From `look` when the layout has it, else from
   the seat map's footprint (layout.v1 without looks still edits and draws the same). */
export function sizeOf(t) {
  if (t.look) { if (t.shape === 'round') return { round: true, w: t.look.w, d: t.look.w }; return { round: false, w: t.look.w, d: t.look.d || t.look.w }; }
  const fp = footprint(t); return t.shape === 'round' ? { round: true, w: 2 * fp.r, d: 2 * fp.r } : { round: false, w: fp.w, d: fp.h };
}
/* the space a table takes with its chairs (a sofa corner takes more), as an oriented box: { x, z, hw, hd, rot } */
export function reachOf(t) {
  const s = sizeOf(t), sofa = t.look && t.look.seat === 'sofa', c = sofa ? 0.75 : CHAIR;
  if (s.round) { const r = s.w / 2 + (sofa ? c : 0.38); return { x: t.x, z: t.z, hw: r, hd: r, rot: 0, round: true }; }
  const twoSides = t.shape === 'long' || (t.shape === 'square' && t.seats <= 2 && !sofa);
  return { x: t.x, z: t.z, hw: s.w / 2 + (twoSides ? 0.06 : c), hd: s.d / 2 + c, rot: t.rot || 0, round: false };
}
const corners = (b) => { const a = b.rot * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [b.x + u * b.hw * c - v * b.hd * s, b.z + u * b.hw * s + v * b.hd * c]); };
/* do two tables (with their chairs) get in each other's way? circles for two round ones, the separating axis otherwise */
export function overlaps(a, b) {
  const A = reachOf(a), B = reachOf(b), slack = 0.04;
  if (A.round && B.round) return Math.hypot(A.x - B.x, A.z - B.z) < A.hw + B.hw - slack;
  const pa = corners(A), pb = corners(B);
  const axes = [A, B].flatMap((o) => { const r = o.rot * Math.PI / 180; return [[Math.cos(r), Math.sin(r)], [-Math.sin(r), Math.cos(r)]]; });
  return axes.every(([ax, az]) => { const pr = (ps) => ps.map(([x, z]) => x * ax + z * az); const ra = pr(pa), rb = pr(pb); return Math.min(...ra) < Math.max(...rb) - slack && Math.min(...rb) < Math.max(...ra) - slack; });
}
/* the zone a point is in (the smallest that holds it), or null */
export function zoneAt(layout, x, z) {
  const hit = layout.zones.filter((zn) => inRect(zn.rect, x, z)).sort((a, b) => (a.rect[2] - a.rect[0]) * (a.rect[3] - a.rect[1]) - (b.rect[2] - b.rect[0]) * (b.rect[3] - b.rect[1]));
  return hit.length ? hit[0].id : null;
}
/* what is wrong with the floor, table by table: [{ id, type: 'overlap', with } | { id, type: 'outside', why: 'zone' | kind }] */
export function warnings(layout) {
  const out = [], T = layout.tables;
  T.forEach((t, i) => {
    for (let j = i + 1; j < T.length; j++) if (overlaps(t, T[j])) { out.push({ id: t.id, type: 'overlap', with: T[j].id }); out.push({ id: T[j].id, type: 'overlap', with: t.id }); }
    const f = (layout.fixtures || []).find((fx) => OUTSIDE.includes(fx.kind) && fx.rect && inRect(fx.rect, t.x, t.z));
    if (f) out.push({ id: t.id, type: 'outside', why: f.kind });
    else if (!zoneAt(layout, t.x, t.z)) out.push({ id: t.id, type: 'outside', why: 'zone' });
  });
  return out;
}

/* ---------- the operations: each returns a new layout ---------- */
export function moveTable(layout, id, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) refuse('a move needs a point on the floor', 'no-point');
  const L = copy(layout), t = find(L, id);
  t.x = clamp(snap(x), 0, L.room.w); t.z = clamp(snap(z), 0, L.room.d);
  const zn = zoneAt(L, t.x, t.z); if (zn) t.zone = zn;                                   // the zone follows the table
  return L;
}
export function rotateTable(layout, id, by = TURN) { if (!Number.isFinite(by)) refuse('a turn needs degrees', 'no-point'); const L = copy(layout), t = find(L, id); t.rot = ((Math.round(((t.rot || 0) + by) / TURN) * TURN) % 360 + 360) % 360; return L; }
const freshId = (layout) => { let n = 1; const have = new Set(layout.tables.map((t) => t.id)); while (have.has('n' + n)) n++; return 'n' + n; };
/* a free spot near (x, z): the point itself, else rings of 0.6 m around it */
function freeSpot(L, probe, x, z) {
  for (let ring = 0; ring < 8; ring++) for (let k = 0; k < Math.max(1, ring * 8); k++) {
    const a = k / Math.max(1, ring * 8) * 2 * Math.PI, px = clamp(snap(x + Math.cos(a) * ring * 0.6), 0, L.room.w), pz = clamp(snap(z + Math.sin(a) * ring * 0.6), 0, L.room.d);
    const p = Object.assign({}, probe, { x: px, z: pz });
    if (!L.tables.some((o) => o.id !== probe.id && overlaps(p, o)) && zoneAt(L, px, pz) && !warnings(Object.assign({}, L, { tables: [p] })).length) return [px, pz];
  }
  return [clamp(snap(x), 0, L.room.w), clamp(snap(z), 0, L.room.d)];
}
/* addTable(layout, 'round2', { x, z }) → { layout, id }: placed at the nearest free spot, in the zone under it */
export function addTable(layout, kind, at = {}) {
  const P = PALETTE[kind]; if (!P) refuse('unknown kind ' + JSON.stringify(kind), 'bad-kind');
  const L = copy(layout), id = freshId(L), z0 = L.zones[0], cx = at.x == null ? (z0.rect[0] + z0.rect[2]) / 2 : at.x, cz = at.z == null ? (z0.rect[1] + z0.rect[3]) / 2 : at.z;
  const t = Object.assign({ id, zone: z0.id, x: cx, z: cz, rot: 0, bookable: true, name: null }, JSON.parse(JSON.stringify(P)));
  const [x, z] = freeSpot(L, t, cx, cz); t.x = x; t.z = z; t.zone = zoneAt(L, x, z) || z0.id;
  L.tables.push(t); return { layout: L, id };
}
export function duplicateTable(layout, id) {
  const L = copy(layout), src = find(L, id), nid = freshId(L), t = Object.assign(JSON.parse(JSON.stringify(src)), { id: nid, name: null });
  const [x, z] = freeSpot(L, t, src.x + 1.2, src.z); t.x = x; t.z = z; t.zone = zoneAt(L, x, z) || src.zone;
  L.tables.push(t); return { layout: L, id: nid };
}
export function removeTable(layout, id) { find(layout, id); if (layout.tables.length <= 1) refuse('a floor keeps at least one table', 'last-table'); const L = copy(layout); L.tables = L.tables.filter((t) => t.id !== id); return L; }
/* seats 1–40; the party sizes follow so that minParty ≤ maxParty ≤ seats always holds */
export function setSeats(layout, id, { seats, minParty, maxParty } = {}) {
  const L = copy(layout), t = find(L, id);
  if (seats != null) t.seats = clamp(Math.round(seats), 1, 40);
  if (maxParty != null) t.maxParty = clamp(Math.round(maxParty), 1, t.seats);
  if (minParty != null) t.minParty = clamp(Math.round(minParty), 1, 40);
  t.maxParty = clamp(t.maxParty, 1, t.seats); t.minParty = clamp(t.minParty, 1, t.maxParty);
  return L;
}
export function setZone(layout, id, zone) { if (!layout.zones.some((z) => z.id === zone)) refuse('unknown zone ' + JSON.stringify(zone), 'no-zone'); const L = copy(layout); find(L, id).zone = zone; return L; }

/* ---------- undo / redo ---------- */
export const createHistory = (layout) => ({ past: [], present: layout, future: [] });
export const commit = (h, layout, cap = 60) => ({ past: h.past.concat([h.present]).slice(-cap), present: layout, future: [] });
export const undo = (h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present].concat(h.future) } : h);
export const redo = (h) => (h.future.length ? { past: h.past.concat([h.present]), present: h.future[0], future: h.future.slice(1) } : h);
