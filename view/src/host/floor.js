/* The host board's floor: the room drawn from layout.v1 (walls, door, window, zones), each table by its shape with its
   chairs, and around each table a thin ring that runs down with the table's time. Drawn once per orientation (a tall
   screen gets the room turned a quarter so it fills the width); update() only moves the rings and changes words, once a
   second, and the 1 s linear transition in host.css makes the sweep continuous. Every table is a real button (role,
   tabindex, Enter/Space) with its time in words for a screen reader. Metres are the unit; sizes that must stay readable
   (the ring's line, the numerals) are set in pixels per resize. */
import { footprint, seatsOf } from '../seat/plan.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k])); if (parent) parent.appendChild(e); return e; };
const f = (n) => Number(n.toFixed(3));
export const GAP = 0.14;                                         // between a table's edge and its ring, metres

/* a ring's path, starting at 12 o'clock and running clockwise (pathLength 1, so a dash offset is a share of the time) */
export function ringPath(shape, a, b) {
  if (shape === 'round') return 'M0 ' + f(-a) + 'A' + f(a) + ' ' + f(a) + ' 0 1 1 0 ' + f(a) + 'A' + f(a) + ' ' + f(a) + ' 0 1 1 0 ' + f(-a) + 'Z';
  const r = Math.min(a, b, 0.32);
  return 'M0 ' + f(-b) + 'H' + f(a - r) + 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(a) + ' ' + f(-b + r) + 'V' + f(b - r) + 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(a - r) + ' ' + f(b) +
    'H' + f(-a + r) + 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(-a) + ' ' + f(b - r) + 'V' + f(-b + r) + 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(-a + r) + ' ' + f(-b) + 'Z';
}

/* yolk → ember over the last minutes (u: 0 at the warning, 1 at the end) */
const mix = (u) => { const a = [0xF5, 0xB1, 0x20], b = [0xFF, 0x7A, 0x45], k = Math.max(0, Math.min(1, u)); return 'rgb(' + a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',') + ')'; };
export const ringColour = (s, endingMs) => (s.phase === 'over' ? '#E25C7A' : s.phase === 'ending' ? mix(1 - s.leftMs / endingMs) : s.phase === 'seated' ? '#F5B120' : s.phase === 'reserved' ? '#7FA9DB' : '#6FAE8E');

export function drawFloor(svg, layout, opts) {
  const tall = !!opts.tall, W = layout.room.w, D = layout.room.d, pad = 0.55;
  const P = tall ? (x, z) => [D - z, x] : (x, z) => [x, z];        // a tall screen: the room turned a quarter clockwise
  const turn = tall ? 90 : 0;
  svg.textContent = ''; svg.setAttribute('direction', 'ltr');
  svg.setAttribute('viewBox', [-pad, -pad, (tall ? D : W) + 2 * pad, (tall ? W : D) + 2 * pad].map(f).join(' '));
  const defs = el('defs', {}, svg);
  const blur = el('filter', { id: 'glow', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs); const fb = el('feGaussianBlur', { stdDeviation: 0.08 }, blur);
  const sh = el('filter', { id: 'lift', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
  const sb = el('feDropShadow', { dx: 0, dy: 0.05, stdDeviation: 0.07, 'flood-color': '#462d14', 'flood-opacity': 0.16 }, sh);
  /* floor and zones */
  const [fx, fz] = [0, 0]; el('rect', { class: 'fl', x: fx, y: fz, width: tall ? D : W, height: tall ? W : D, rx: 0.2 }, svg);
  const gz = el('g', { class: 'zones' }, svg);
  layout.zones.forEach((z) => {
    const [x1, z1, x2, z2] = z.rect, [ax, ay] = P(x1, z1), [bx, by] = P(x2, z2), X = Math.min(ax, bx), Y = Math.min(ay, by), Wd = Math.abs(bx - ax), Hd = Math.abs(by - ay), i = 0.12;
    el('rect', { class: 'zn', x: f(X + i), y: f(Y + i), width: f(Wd - 2 * i), height: f(Hd - 2 * i), rx: 0.3 }, gz);
    const tx = el('text', { class: 'zl', x: f(X + 0.36), y: f(Y + 0.52), 'text-anchor': 'start', 'data-zone': z.id, 'data-x0': f(X + 0.36), 'data-x1': f(X + Wd - 0.36) }, gz); tx.textContent = '';      // a top corner of its area (the reading side), clear of the door's swing
  });
  /* walls, the door's swing, the window */
  const gw = el('g', { class: 'walls' }, svg);
  layout.walls.forEach((w) => {
    const [ax, az] = w.from, [bx, bz] = w.to, len = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / len, uz = (bz - az) / len;
    const at = (s) => P(ax + ux * s, az + uz * s);
    const seg = (a, b, cls) => { const p = at(a), q = at(b); el('line', { class: cls, x1: f(p[0]), y1: f(p[1]), x2: f(q[0]), y2: f(q[1]) }, gw); };
    if (w.kind === 'door' && w.gap) {
      seg(0, w.gap[0], 'wall'); seg(w.gap[1], len, 'wall');
      const d = w.gap[1] - w.gap[0], h = at(w.gap[0]), nx = -uz, nz = ux, leaf = P(ax + ux * w.gap[0] + nx * d, az + uz * w.gap[0] + nz * d), end = at(w.gap[1]);
      el('path', { class: 'door', d: 'M' + f(h[0]) + ' ' + f(h[1]) + 'L' + f(leaf[0]) + ' ' + f(leaf[1]) + 'A' + f(d) + ' ' + f(d) + ' 0 0 ' + (tall ? 1 : 1) + ' ' + f(end[0]) + ' ' + f(end[1]) }, gw);
    } else seg(0, len, w.kind === 'window' ? 'window' : 'wall');
  });
  /* tables: chairs, the top, the ring (track, glow, the running line), the words */
  const gt = el('g', { class: 'tables' }, svg), T = new Map();
  layout.tables.forEach((t) => {
    const [X, Y] = P(t.x, t.z), fp = footprint(t), rot = ((t.rot + turn) % 360 + 360) % 360, square = rot % 90 === 0;
    const swap = square && rot % 180 === 90, round = t.shape === 'round' || !square;
    const a = (round ? (t.shape === 'round' ? fp.r : Math.hypot(fp.w, fp.h) / 2) : (swap ? fp.h : fp.w) / 2) + GAP, b = round ? a : (swap ? fp.w : fp.h) / 2 + GAP;
    const g = el('g', { class: 'tb', 'data-id': t.id, 'data-phase': 'free', role: 'button', tabindex: '0', transform: 'translate(' + f(X) + ' ' + f(Y) + ')' }, gt);
    const hit = el('circle', { class: 'hit', r: f(Math.max(a, b) + 0.12) }, g);
    const body = el('g', { class: 'body', transform: 'rotate(' + f(rot) + ')' }, g);
    seatsOf(t).forEach(([x, z, ang]) => {
      let sx = x, sz = z;                                        // the chairs step back a little to leave the ring its own line
      if (t.shape === 'round') { const k = (fp.r + 0.24 + GAP) / (fp.r + 0.24); sx *= k; sz *= k; } else { if (Math.abs(sz) > fp.h / 2) sz += Math.sign(sz) * GAP; if (Math.abs(sx) > fp.w / 2) sx += Math.sign(sx) * GAP; }
      if (t.shape === 'bar') el('circle', { class: 'chair', cx: f(sx), cy: f(sz), r: 0.12 }, body);
      else el('rect', { class: 'chair', x: f(sx - 0.17), y: f(sz - 0.065), width: 0.34, height: 0.13, rx: 0.065, transform: 'rotate(' + f(ang) + ' ' + f(sx) + ' ' + f(sz) + ')' }, body);
    });
    if (t.shape === 'round') el('circle', { class: 'top', r: f(fp.r), filter: 'url(#lift)' }, body);
    else el('rect', { class: 'top', x: f(-fp.w / 2), y: f(-fp.h / 2), width: f(fp.w), height: f(fp.h), rx: t.shape === 'bar' ? 0.12 : 0.16, filter: 'url(#lift)' }, body);
    const d = ringPath(round ? 'round' : 'rect', a, b), ring = el('g', { class: 'ring' }, g);
    if (!square && !round) ring.setAttribute('transform', 'rotate(' + f(rot) + ')');
    const track = el('path', { class: 'track', d, pathLength: 1 }, ring);
    const glow = el('path', { class: 'glow', d, pathLength: 1, filter: 'url(#glow)' }, ring);
    const run = el('path', { class: 'run', d, pathLength: 1 }, ring);
    const focus = el('path', { class: 'focus', d: ringPath(round ? 'round' : 'rect', a + 0.16, b + 0.16) }, g);
    const mins = el('text', { class: 'mins', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
    const tag = el('g', { class: 'tag', transform: 'translate(' + f(-a + (round ? a * 0.29 : 0)) + ' ' + f(-b + (round ? b * 0.29 : 0)) + ')' }, g);
    const tagBg = el('circle', { class: 'tag-bg', r: 0.2 }, tag), tagNo = el('text', { class: 'tag-no', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, tag);
    g.addEventListener('click', () => opts.onTable(t.id, g));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onTable(t.id, g); } });
    T.set(t.id, { g, hit, track, glow, run, mins, tag, tagBg, tagNo, focus, small: Math.min(2 * a, 2 * b), a, b, round });
  });

  let k = 40;                                                      // pixels per metre, measured on resize
  const api = {
    tall,
    /* sizes that must stay readable whatever the scale: the ring's line in px, the numerals, the hit area (44 px) */
    resize() {
      const box = svg.getBoundingClientRect(); if (!box.width) return k;
      const vb = svg.viewBox.baseVal; k = Math.min(box.width / vb.width, box.height / vb.height);
      const px = (n) => f(n / k);
      svg.style.setProperty('--px', String(1 / k));
      T.forEach((o) => {
        o.track.setAttribute('stroke-width', px(2)); o.run.setAttribute('stroke-width', px(3)); o.glow.setAttribute('stroke-width', px(7)); o.focus.setAttribute('stroke-width', px(2));
        const fs = Math.min(o.small * 0.46, Math.max(14 / k, Math.min(0.42, 24 / k)));
        o.mins.setAttribute('font-size', f(fs)); o.mins.setAttribute('y', f(fs * 0.04));
        const tr = Math.max(0.17, 9.5 / k); o.tagBg.setAttribute('r', f(tr)); o.tagNo.setAttribute('font-size', f(tr * 1.12));
        o.hit.setAttribute('r', f(Math.max(Math.max(o.a, o.b) + 0.1, 22 / k)));
      });
      fb.setAttribute('stdDeviation', f(3.2 / k)); sb.setAttribute('stdDeviation', f(5 / k)); sb.setAttribute('dy', f(2.5 / k));
      svg.querySelectorAll('.zl').forEach((z) => z.setAttribute('font-size', f(Math.max(0.27, 10 / k))));
      return k;
    },
    /* rows: [{ id, s (status), label, aria, mins, colour }], lang for the zone names */
    update(rows, zoneNames, snap, rtl) {
      svg.classList.toggle('snap', !!snap);
      svg.querySelectorAll('.zl').forEach((z) => { z.textContent = zoneNames[z.getAttribute('data-zone')] || ''; z.setAttribute('x', z.getAttribute(rtl ? 'data-x1' : 'data-x0')); z.setAttribute('text-anchor', rtl ? 'end' : 'start'); });
      rows.forEach((r) => {
        const o = T.get(r.id); if (!o) return;
        const busy = r.s.phase !== 'free';
        if (o.g.getAttribute('data-phase') !== r.s.phase) o.g.setAttribute('data-phase', r.s.phase);
        o.g.setAttribute('aria-label', r.aria);
        o.run.style.strokeDashoffset = o.glow.style.strokeDashoffset = String(busy && r.s.phase !== 'reserved' && r.s.phase !== 'over' ? -r.s.progress : 0);      // time is up: the whole ring, in rose
        o.run.style.stroke = r.colour; o.glow.style.stroke = r.colour;
        o.mins.textContent = busy ? r.mins : r.no; o.tagNo.textContent = r.no;
      });
      if (snap) requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.remove('snap')));
    },
    focusTable(id) { const o = T.get(id); if (o) o.g.focus(); }
  };
  return api;
}
