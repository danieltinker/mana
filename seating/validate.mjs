/* Seating contracts: layout.v1 (a room: walls, zones, tables) and booking_request.v1 (a guest asks for an area or a
   table; the owner approves, swaps the table or declines with a reason). Pure ESM, no dependencies, no DOM: the same
   file runs in the guest's browser, in the owner's, in tests and, later, in a database function's twin.
   Nothing from a file or the network reaches a screen without passing validateLayout / validateRequest. */

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const ID = /^[a-z0-9][a-z0-9_-]{0,39}$/, SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PHONE = /^\+?[0-9][0-9 \-]{4,19}$/;
const pt = (p) => Array.isArray(p) && p.length === 2 && isNum(p[0], -1000, 1000) && isNum(p[1], -1000, 1000);
const str = (v, max) => typeof v === 'string' && v.length <= max;
const text = (v) => isObj(v) && str(v.he, 80) && str(v.en, 80) && (v.he.trim() || v.en.trim());

export const SHAPES = ['round', 'square', 'long', 'bar'];
export const WALLS = ['wall', 'window', 'door'];
export const STATUS = ['pending', 'approved', 'declined'];
/* optional, round two (Café Lima): how a table looks, and the room's fixed things */
export const TOPS = ['marble', 'wood', 'iron', 'glass'];
export const SEATS = ['chairs', 'bench', 'stools', 'velvet', 'sofa'];
export const FIXTURES = ['walkway', 'closed', 'kitchen', 'hatch', 'counter', 'vitrine', 'espresso', 'fridge', 'shelf', 'bench', 'banquette', 'post', 'planter', 'tree', 'awning', 'lamp'];
const rectOk = (r) => Array.isArray(r) && r.length === 4 && r.every((n) => isNum(n, -1000, 1000)) && r[2] > r[0] && r[3] > r[1];

/* ---------- layout.v1 ---------- */
/* → { ok: true, layout } (a normalised copy: defaults filled, nothing else kept) | { ok: false, errors: [string] } */
export function validateLayout(raw) {
  const errors = [], err = (m) => { errors.push(m); };
  if (!isObj(raw)) return { ok: false, errors: ['not an object'] };
  if (raw.v !== 1) err('v must be 1');
  if (!(typeof raw.venue === 'string' && SLUG.test(raw.venue))) err('venue must be a slug');
  const room = isObj(raw.room) ? raw.room : {};
  if (!isNum(room.w, 1, 200) || !isNum(room.d, 1, 200)) err('room.w and room.d must be metres between 1 and 200');
  const W = isNum(room.w, 1, 200) ? room.w : 1, D = isNum(room.d, 1, 200) ? room.d : 1;
  const inRoom = (x, z) => isNum(x, 0, W) && isNum(z, 0, D);
  const walls = Array.isArray(raw.walls) ? raw.walls : (err('walls must be an array'), []);
  const outWalls = walls.map((w, i) => {
    if (!isObj(w) || !pt(w.from) || !pt(w.to)) { err('walls[' + i + '] needs from and to'); return null; }
    if (!inRoom(w.from[0], w.from[1]) || !inRoom(w.to[0], w.to[1])) err('walls[' + i + '] leaves the room');
    const kind = WALLS.includes(w.kind) ? w.kind : 'wall';
    const out = { from: [w.from[0], w.from[1]], to: [w.to[0], w.to[1]], kind };
    if (w.gap != null) { if (!pt(w.gap) || !(w.gap[0] >= 0 && w.gap[1] > w.gap[0])) err('walls[' + i + '].gap must be [start, end] along the wall'); else out.gap = [w.gap[0], w.gap[1]]; }
    return out;
  }).filter(Boolean);
  const zones = Array.isArray(raw.zones) ? raw.zones : (err('zones must be an array'), []);
  const zoneIds = new Set();
  const outZones = zones.map((z, i) => {
    if (!isObj(z) || !(typeof z.id === 'string' && ID.test(z.id))) { err('zones[' + i + '].id must be an id'); return null; }
    if (zoneIds.has(z.id)) err('zones[' + i + '].id repeats ' + z.id); zoneIds.add(z.id);
    if (!text(z.name)) err('zones[' + i + '].name needs he and en');
    const r = z.rect;
    if (!(Array.isArray(r) && r.length === 4 && r.every((n) => isNum(n, 0, 200)) && r[2] > r[0] && r[3] > r[1] && r[2] <= W && r[3] <= D)) err('zones[' + i + '].rect must be [x1, z1, x2, z2] inside the room');
    if (z.outdoor != null && typeof z.outdoor !== 'boolean') err('zones[' + i + '].outdoor must be true or false');
    const oz = { id: z.id, name: { he: String(z.name && z.name.he || ''), en: String(z.name && z.name.en || '') }, rect: Array.isArray(r) && r.length === 4 ? r.map(Number) : [0, 0, 1, 1] };
    if (typeof z.outdoor === 'boolean') oz.outdoor = z.outdoor;          // optional: kept only when the file says it
    return oz;
  }).filter(Boolean);
  if (!outZones.length) err('at least one zone');
  const tables = Array.isArray(raw.tables) ? raw.tables : (err('tables must be an array'), []);
  const tableIds = new Set();
  const outTables = tables.map((t, i) => {
    if (!isObj(t) || !(typeof t.id === 'string' && ID.test(t.id))) { err('tables[' + i + '].id must be an id'); return null; }
    if (tableIds.has(t.id)) err('tables[' + i + '].id repeats ' + t.id); tableIds.add(t.id);
    if (!zoneIds.has(t.zone)) err('tables[' + i + '].zone ' + t.zone + ' is not a zone');
    if (!inRoom(t.x, t.z)) err('tables[' + i + '] is outside the room');
    if (!SHAPES.includes(t.shape)) err('tables[' + i + '].shape must be one of ' + SHAPES.join('|'));
    if (!isInt(t.seats, 1, 40)) err('tables[' + i + '].seats must be 1..40');
    if (!isInt(t.minParty, 1, 40) || !isInt(t.maxParty, 1, 40) || t.minParty > t.maxParty) err('tables[' + i + '] needs minParty <= maxParty');
    else if (isInt(t.seats, 1, 40) && t.maxParty > t.seats) err('tables[' + i + '].maxParty exceeds its seats');
    if (typeof t.bookable !== 'boolean') err('tables[' + i + '].bookable must be true or false');
    if (t.name != null && !str(t.name, 40)) err('tables[' + i + '].name must be a short string');
    let look = null;
    if (t.look != null) {
      const k = t.look;
      if (!isObj(k)) err('tables[' + i + '].look must be an object');
      else {
        if (!TOPS.includes(k.top)) err('tables[' + i + '].look.top must be one of ' + TOPS.join('|'));
        if (!SEATS.includes(k.seat)) err('tables[' + i + '].look.seat must be one of ' + SEATS.join('|'));
        if (!isNum(k.w, .3, 4)) err('tables[' + i + '].look.w must be metres between 0.3 and 4');
        if (k.d != null && !isNum(k.d, .3, 4)) err('tables[' + i + '].look.d must be metres between 0.3 and 4');
        look = { top: k.top, seat: k.seat, w: k.w }; if (k.d != null) look.d = k.d;
      }
    }
    const ot = { id: t.id, zone: String(t.zone), x: Number(t.x), z: Number(t.z), rot: isNum(t.rot, -360, 360) ? t.rot : 0, shape: SHAPES.includes(t.shape) ? t.shape : 'square',
      seats: isInt(t.seats, 1, 40) ? t.seats : 1, minParty: isInt(t.minParty, 1, 40) ? t.minParty : 1, maxParty: isInt(t.maxParty, 1, 40) ? t.maxParty : 1, bookable: t.bookable === true, name: typeof t.name === 'string' ? t.name : null };
    if (look) ot.look = look;                                           // optional: kept only when the file says it
    return ot;
  }).filter(Boolean);
  if (!outTables.length) err('at least one table');
  /* fixtures: optional; the room's fixed things (the counter, the awnings, a tree). A rect or a point, in metres; they may
     reach past the room (a tree on the pavement, an awning over the kerb) by up to 2 m. Unknown kinds are refused. */
  const fixtures = raw.fixtures == null ? [] : Array.isArray(raw.fixtures) ? raw.fixtures : (err('fixtures must be an array'), []);
  const near = (x, z) => isNum(x, -2, W + 2) && isNum(z, -2, D + 2);
  const outFixtures = fixtures.map((f, i) => {
    if (!isObj(f)) { err('fixtures[' + i + '] must be an object'); return null; }
    if (!FIXTURES.includes(f.kind)) { err('fixtures[' + i + '].kind ' + JSON.stringify(f.kind) + ' is not a known kind (' + FIXTURES.join('|') + ')'); return null; }
    const o = { kind: f.kind };
    if (f.rect != null) { if (!rectOk(f.rect) || !near(f.rect[0], f.rect[1]) || !near(f.rect[2], f.rect[3])) err('fixtures[' + i + '].rect must be [x1, z1, x2, z2] at the room'); else o.rect = f.rect.map(Number); }
    if (f.at != null) { if (!pt(f.at) || !near(f.at[0], f.at[1])) err('fixtures[' + i + '].at must be [x, z] at the room'); else o.at = [f.at[0], f.at[1]]; }
    if (f.rect == null && f.at == null) err('fixtures[' + i + '] needs a rect or an at');
    if (f.name != null) { if (!text(f.name)) err('fixtures[' + i + '].name needs he and en'); else o.name = { he: String(f.name.he), en: String(f.name.en) }; }
    return o;
  }).filter(Boolean);
  if (raw.tableChoice != null && typeof raw.tableChoice !== 'boolean') err('tableChoice must be true or false');
  if (raw.note != null && !str(raw.note, 300)) err('note must be a short string');
  if (errors.length) return { ok: false, errors };
  return { ok: true, layout: { v: 1, venue: raw.venue, note: typeof raw.note === 'string' ? raw.note : '', room: { w: W, d: D }, walls: outWalls, zones: outZones, tables: outTables, tableChoice: raw.tableChoice !== false, fixtures: outFixtures } };
}

/* ---------- who fits where ---------- */
export const fits = (table, party) => table.bookable && Number.isInteger(party) && party >= table.minParty && party <= table.maxParty;
/* the bookable tables a party of n may ask for, in the whole room or in one zone */
export const tablesFor = (layout, party, zone) => layout.tables.filter((t) => fits(t, party) && (zone == null || t.zone === zone));
/* the zones that have at least one fitting table */
export const zonesFor = (layout, party) => layout.zones.filter((z) => tablesFor(layout, party, z.id).length > 0);
export const tableById = (layout, id) => layout.tables.find((t) => t.id === id) || null;
export const zoneById = (layout, id) => layout.zones.find((z) => z.id === id) || null;
/* the number a table is called by in its zone ("table 3 by the window"): the position among its zone's tables, from 1 */
export const tableNo = (layout, id) => { const t = tableById(layout, id); if (!t) return 0; return layout.tables.filter((x) => x.zone === t.zone).indexOf(t) + 1; };

/* ---------- booking_request.v1 ---------- */
/* → { ok: true, request } | { ok: false, errors }. With a layout, the zone and the table are checked against it. */
export function validateRequest(raw, layout) {
  const errors = [], err = (m) => { errors.push(m); };
  if (!isObj(raw)) return { ok: false, errors: ['not an object'] };
  if (raw.v !== 1) err('v must be 1');
  if (!(typeof raw.id === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(raw.id))) err('id must be 4..64 url-safe characters');
  if (!(typeof raw.venue === 'string' && SLUG.test(raw.venue))) err('venue must be a slug');
  if (layout && raw.venue !== layout.venue) err('venue does not match the layout');
  if (!(typeof raw.zone === 'string' && ID.test(raw.zone))) err('zone must be an id');
  else if (layout && !zoneById(layout, raw.zone)) err('zone ' + raw.zone + ' is not in the layout');
  if (!(raw.table === null || (typeof raw.table === 'string' && ID.test(raw.table)))) err('table must be an id or null');
  if (!(typeof raw.date === 'string' && DATE.test(raw.date))) err('date must be YYYY-MM-DD');
  if (!(typeof raw.time === 'string' && TIME.test(raw.time))) err('time must be HH:MM');
  if (!isInt(raw.party, 1, 40)) err('party must be 1..40');
  if (!(str(raw.name, 80) && raw.name.trim().length >= 1)) err('name must be 1..80 characters');
  if (!(typeof raw.phone === 'string' && PHONE.test(raw.phone.trim()))) err('phone must be digits (5..20) with an optional +');
  if (raw.note != null && !str(raw.note, 300)) err('note must be at most 300 characters');
  if (!STATUS.includes(raw.status)) err('status must be ' + STATUS.join('|'));
  if (raw.status === 'declined' && !(str(raw.reason, 200) && raw.reason.trim())) err('a declined request carries a reason');
  if (raw.status !== 'declined' && raw.reason != null && raw.reason !== '') err('only a declined request carries a reason');
  if (layout && typeof raw.table === 'string') {
    const t = tableById(layout, raw.table);
    if (!t) err('table ' + raw.table + ' is not in the layout');
    else { if (t.zone !== raw.zone) err('table ' + raw.table + ' is not in zone ' + raw.zone); if (isInt(raw.party, 1, 40) && !fits(t, raw.party)) err('table ' + raw.table + ' does not fit a party of ' + raw.party); }
  }
  ['createdAt', 'decidedAt'].forEach((k) => { if (raw[k] != null && !(typeof raw[k] === 'string' && !Number.isNaN(Date.parse(raw[k])))) err(k + ' must be an ISO date'); });
  if (errors.length) return { ok: false, errors };
  return { ok: true, request: { v: 1, id: raw.id, venue: raw.venue, zone: raw.zone, table: raw.table, date: raw.date, time: raw.time, party: raw.party, name: raw.name.trim(), phone: raw.phone.trim(),
    note: typeof raw.note === 'string' ? raw.note.trim() : '', status: raw.status, reason: raw.status === 'declined' ? raw.reason.trim() : '', createdAt: raw.createdAt || null, decidedAt: raw.decidedAt || null } };
}

/* a new request from what the guest typed: pending, with an id and a time stamp (now() is injected so tests are repeatable) */
export function newRequest(fields, layout, opts = {}) {
  const id = opts.id || ('r' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36));
  const createdAt = opts.now ? new Date(opts.now).toISOString() : new Date().toISOString();
  return validateRequest(Object.assign({ v: 1, id, venue: layout.venue, table: null, note: '', status: 'pending', createdAt }, fields, { status: 'pending', reason: undefined, decidedAt: undefined }), layout);
}

/* ---------- the state machine ----------
   pending ──approve(table?)──▶ approved ──swap(table)──▶ approved
   pending ──decline(reason)──▶ declined                                    (declined and approved never go back to pending)
   approve may carry another fitting table (the owner moves the party); swap changes an approved request's table.
   → { ok: true, request } (a new object) | { ok: false, error } */
export function transition(request, action, layout, opts = {}) {
  const fail = (error) => ({ ok: false, error });
  const v = validateRequest(request, layout); if (!v.ok) return fail('request: ' + v.errors.join('; '));
  const r = v.request; if (!isObj(action) || typeof action.type !== 'string') return fail('action must have a type');
  const when = opts.now ? new Date(opts.now).toISOString() : new Date().toISOString();
  const placed = (table) => {
    if (table === null) return { table: null, zone: r.zone };
    const t = tableById(layout, table); if (!t) return fail('table ' + table + ' is not in the layout');
    if (!fits(t, r.party)) return fail('table ' + table + ' does not fit a party of ' + r.party);
    return { table: t.id, zone: t.zone };
  };
  if (action.type === 'approve') {
    if (r.status !== 'pending') return fail('only a pending request can be approved');
    const p = placed(action.table === undefined ? r.table : action.table); if (p.ok === false) return p;
    return { ok: true, request: Object.assign({}, r, p, { status: 'approved', reason: '', decidedAt: when }) };
  }
  if (action.type === 'decline') {
    if (r.status !== 'pending') return fail('only a pending request can be declined');
    if (!(str(action.reason, 200) && action.reason.trim())) return fail('a decline needs a reason the guest will read');
    return { ok: true, request: Object.assign({}, r, { status: 'declined', reason: action.reason.trim(), decidedAt: when }) };
  }
  if (action.type === 'swap') {
    if (r.status !== 'approved') return fail('only an approved request can change its table');
    if (!(typeof action.table === 'string')) return fail('swap needs a table');
    const p = placed(action.table); if (p.ok === false) return p;
    return { ok: true, request: Object.assign({}, r, p, { decidedAt: when }) };
  }
  return fail('unknown action ' + action.type);
}
