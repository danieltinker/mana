/* The floor plan as SVG, drawn once from layout.v1: walls, the door and the window, zones as soft areas, tables by shape with
   their seats. Nothing in it is the keyboard path (the lists in the sheet are): the picture is role="img" and taps on it are a
   shortcut. update(state) only toggles classes; the colours and the 240 ms transitions are in seat.css. Metres are the unit:
   the viewBox is the room, so a 0.06 line is 6 cm of wall. */
import { tableNo } from '../../../../seating/validate.mjs';

const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k])); if (parent) parent.appendChild(e); return e; }
const f = (n) => Number(n.toFixed(3));

/* the footprint of a table in metres, from its shape and seats */
export function footprint(t) {
  if (t.shape === 'round') { const r = .3 + Math.min(8, t.seats) * .045; return { r, w: 2 * r, h: 2 * r }; }
  if (t.shape === 'square') { const s = t.seats <= 2 ? .72 : .92; return { w: s, h: s }; }
  if (t.shape === 'long') return { w: 1 + Math.ceil(t.seats / 2) * .62, h: .92 };
  return { w: Math.max(2.2, t.seats * .58), h: .5 };                   // bar: a counter; the stools are on one side
}
/* where the chairs stand: [x, z, angle] around the footprint (angle: which way the seat faces, towards the table) */
export function seatsOf(t) {
  const fp = footprint(t), out = [], n = t.seats;
  if (t.shape === 'round') { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / n, R = fp.r + .24; out.push([Math.cos(a) * R, Math.sin(a) * R, a * 180 / Math.PI + 90]); } return out; }
  if (t.shape === 'bar') { const step = fp.w / n; for (let i = 0; i < n; i++) out.push([-fp.w / 2 + step * (i + .5), fp.h / 2 + .3, 0]); return out; }
  const sides = t.shape === 'square' && n <= 2 ? [[0, -1], [0, 1]] : t.shape === 'square' ? [[0, -1], [1, 0], [0, 1], [-1, 0]] : [[0, -1], [0, 1]];
  const per = Math.ceil(n / sides.length);
  let left = n;
  sides.forEach(([sx, sz]) => {
    const k = Math.min(per, left); left -= k;
    for (let i = 0; i < k; i++) {
      const along = (i - (k - 1) / 2) * (t.shape === 'long' ? .62 : .5);
      if (sz) out.push([along, sz * (fp.h / 2 + .22), sz < 0 ? 180 : 0]); else out.push([sx * (fp.w / 2 + .22), along, sx < 0 ? 90 : -90]);
    }
  });
  return out;
}

export function drawPlan(svg, layout, opts = {}) {
  const pad = .7, W = layout.room.w, D = layout.room.d;
  svg.setAttribute('viewBox', [-pad, -pad, W + 2 * pad, D + 2 * pad].map(f).join(' '));
  svg.setAttribute('direction', 'ltr'); svg.textContent = '';
  const zones = new Map(), tables = new Map(), labels = new Map();
  /* floor */
  el('rect', { class: 'floor', x: 0, y: 0, width: W, height: D }, svg);
  /* zones: soft areas under everything */
  const gz = el('g', { class: 'zones' }, svg);
  layout.zones.forEach((z) => {
    const [x1, z1, x2, z2] = z.rect, inset = .14, g = el('g', { class: 'zone', 'data-id': z.id }, gz);
    el('rect', { x: f(x1 + inset), y: f(z1 + inset), width: f(x2 - x1 - 2 * inset), height: f(z2 - z1 - 2 * inset), rx: .36 }, g);
    const tx = el('text', { class: 'zone-name', x: f((x1 + x2) / 2), y: f(z1 + .62), 'text-anchor': 'middle' }, g);
    labels.set(z.id, tx); zones.set(z.id, g);
    g.addEventListener('click', () => { if (opts.onZone && !g.classList.contains('dim')) opts.onZone(z.id); });
  });
  /* walls, with the door's gap and swing and the window's lighter line */
  const gw = el('g', { class: 'walls' }, svg);
  layout.walls.forEach((w) => {
    const [ax, az] = w.from, [bx, bz] = w.to, len = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / len, uz = (bz - az) / len;
    const seg = (a, b, cls) => el('line', { class: cls, x1: f(ax + ux * a), y1: f(az + uz * a), x2: f(ax + ux * b), y2: f(az + uz * b), pathLength: 1 }, gw);
    if (w.kind === 'door' && w.gap) {
      seg(0, w.gap[0], 'wall'); seg(w.gap[1], len, 'wall');
      const d = w.gap[1] - w.gap[0], hx = ax + ux * w.gap[0], hz = az + uz * w.gap[0], nx = -uz, nz = ux;      // the leaf hangs at the gap's start and swings into the room
      el('path', { class: 'door', d: 'M' + f(hx) + ' ' + f(hz) + ' L' + f(hx + nx * d) + ' ' + f(hz + nz * d) + ' A' + f(d) + ' ' + f(d) + ' 0 0 1 ' + f(hx + ux * d) + ' ' + f(hz + uz * d), pathLength: 1 }, gw);
    } else seg(0, len, w.kind === 'window' ? 'window' : 'wall');
    if (w.kind === 'window') { const nx = -uz, nz = ux, k = .22; el('line', { class: 'window-light', x1: f(ax + nx * k), y1: f(az + nz * k), x2: f(bx + nx * k), y2: f(bz + nz * k) }, gw); }
  });
  /* tables and their seats */
  const gt = el('g', { class: 'tables' }, svg);
  layout.tables.forEach((t) => {
    const g = el('g', { class: 'table shape-' + t.shape + (t.bookable ? '' : ' fixed'), 'data-id': t.id, transform: 'translate(' + f(t.x) + ' ' + f(t.z) + ') rotate(' + f(t.rot) + ')' }, gt);
    seatsOf(t).forEach(([x, z, a]) => {
      if (t.shape === 'bar') el('circle', { class: 'seat', cx: f(x), cy: f(z), r: .13 }, g);
      else el('rect', { class: 'seat', x: f(x - .17), y: f(z - .07), width: .34, height: .14, rx: .06, transform: 'rotate(' + f(a) + ' ' + f(x) + ' ' + f(z) + ')' }, g);
    });
    const fp = footprint(t);
    if (t.shape === 'round') el('circle', { class: 'top', cx: 0, cy: 0, r: f(fp.r) }, g);
    else el('rect', { class: 'top', x: f(-fp.w / 2), y: f(-fp.h / 2), width: f(fp.w), height: f(fp.h), rx: t.shape === 'bar' ? .1 : .14 }, g);
    if (t.bookable) el('text', { class: 'no', x: 0, y: .12, 'text-anchor': 'middle' }, g).textContent = String(tableNo(layout, t.id));
    tables.set(t.id, g);
    g.addEventListener('click', () => { if (opts.onTable && t.bookable && !g.classList.contains('dim')) opts.onTable(t.id); });
  });
  const api = {
    /* state: { lang, zone, table, fitTables: Set|null, fitZones: Set|null, muted: bool } */
    update(s) {
      layout.zones.forEach((z) => {
        const g = zones.get(z.id), fit = !s.fitZones || s.fitZones.has(z.id);
        g.classList.toggle('on', s.zone === z.id); g.classList.toggle('dim', !fit); g.classList.toggle('muted', !!s.muted);
        labels.get(z.id).textContent = z.name[s.lang] || z.name.en;
      });
      layout.tables.forEach((t) => {
        const g = tables.get(t.id), fit = t.bookable && (!s.fitTables || s.fitTables.has(t.id));
        g.classList.toggle('on', s.table === t.id); g.classList.toggle('dim', !fit); g.classList.toggle('in-zone', !!s.zone && t.zone === s.zone);
      });
      svg.classList.toggle('has-zone', !!s.zone);
    },
    bbox: () => svg.getBoundingClientRect()
  };
  return api;
}
