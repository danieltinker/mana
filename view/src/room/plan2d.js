/* The place as a 2D plan: the same layout drawn from above as SVG, with the street at the bottom (as you see the café
   when you stand on the pavement). It is the fallback when there is no WebGL, the context is lost or the first frame is
   very slow, and the edit mode's top view. Tables are real buttons (role, tabindex, Enter); in edit mode they can be
   dragged (snapped to 5 cm). The same api as place.js where it makes sense: setRows, select, edit, setLayout, setTable,
   flyTo / view (no-ops that resolve), so a screen does not care which one it has. Metres are the viewBox's unit. */
import { sizeOf, reachOf, snap } from '../../../seating/edit.mjs';
import { STATE_COLOURS } from './colours.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k])); if (parent) parent.appendChild(e); return e; };
const f = (n) => Number(n.toFixed(3));
const FIX = { counter: '#EADFD3', vitrine: '#D9E7EE', espresso: '#B9BEC2', fridge: '#E7EEF2', shelf: '#D8C3A5', bench: '#B98E62', banquette: '#8A6446', kitchen: '#E2E0DB', closed: '#E9E5DE', walkway: '#D9D8DA', hatch: '#CFE3EE' };

export function createPlan(host, layout, opts = {}) {
  const svg = el('svg', { class: 'pl-plan', role: 'group', 'aria-label': opts.label || '' }); host.appendChild(svg);
  let L = layout, editing = false, selected = null, rows = new Map();
  const T = new Map(), set = new Set();
  const Y = (z) => L.room.d - z;                                             // the street at the bottom
  function draw() {
    svg.textContent = ''; T.clear();
    const W = L.room.w, D = L.room.d, pad = .5;
    svg.setAttribute('viewBox', [-pad, -pad, W + 2 * pad, D + 2 * pad + .6].map(f).join(' ')); svg.setAttribute('direction', 'ltr');
    el('rect', { class: 'pp-road', x: -pad, y: D, width: W + 2 * pad, height: pad + .6 }, svg);
    el('rect', { class: 'pp-floor', x: 0, y: 0, width: W, height: D }, svg);
    const gf = el('g', { class: 'pp-fix' }, svg);
    (L.fixtures || []).forEach((x) => {
      if (x.rect && FIX[x.kind]) { const [x1, z1, x2, z2] = x.rect; el('rect', { class: 'k-' + x.kind, x: f(x1), y: f(Y(z2)), width: f(x2 - x1), height: f(z2 - z1), rx: .06, fill: FIX[x.kind] }, gf); }
      else if (x.kind === 'awning') { const [x1, z1, x2, z2] = x.rect; el('rect', { class: 'k-awning', x: f(x1 + .05), y: f(Y(z2)), width: f(x2 - x1 - .1), height: f(z2 - z1), rx: .1 }, gf); }
      else if (x.at && (x.kind === 'tree' || x.kind === 'planter')) el('circle', { class: 'k-' + x.kind, cx: f(x.at[0]), cy: f(Y(x.at[1])), r: x.kind === 'tree' ? .55 : .25 }, gf);
      else if (x.at && x.kind === 'post') el('circle', { class: 'k-post', cx: f(x.at[0]), cy: f(Y(x.at[1])), r: .07 }, gf);
      else if (x.at && x.kind === 'espresso') el('rect', { class: 'k-espresso', x: f(x.at[0] - .3), y: f(Y(x.at[1]) - .2), width: .6, height: .4, rx: .05 }, gf);
    });
    const gz = el('g', { class: 'pp-zones' }, svg);
    L.zones.forEach((z) => { const [x1, z1, x2, z2] = z.rect; el('rect', { class: 'pp-zone' + (z.outdoor ? ' out' : ''), x: f(x1 + .08), y: f(Y(z2) + .08), width: f(x2 - x1 - .16), height: f(z2 - z1 - .16), rx: .25 }, gz);
      const tx = el('text', { class: 'pp-zl', x: f(x1 + .25), y: f(Y(z2) + .42), 'data-zone': z.id }, gz); tx.textContent = (z.name[opts.lang || 'he'] || z.name.en); });
    const gw = el('g', { class: 'pp-walls' }, svg);
    L.walls.forEach((w) => {
      const [ax, az] = w.from, [bx, bz] = w.to, len = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / len, uz = (bz - az) / len;
      const seg = (a, b, cls) => el('line', { class: cls, x1: f(ax + ux * a), y1: f(Y(az + uz * a)), x2: f(ax + ux * b), y2: f(Y(az + uz * b)) }, gw);
      if (w.kind === 'door' && w.gap) { seg(0, w.gap[0], 'wall'); seg(w.gap[1], len, 'wall'); } else seg(0, len, w.kind === 'window' ? 'window' : 'wall');
    });
    const gt = el('g', { class: 'pp-tables' }, svg);
    L.tables.forEach((t) => {
      const s = sizeOf(t), r = reachOf(t), g = el('g', { class: 'pp-t', 'data-id': t.id, role: 'button', tabindex: '0', transform: 'translate(' + f(t.x) + ' ' + f(Y(t.z)) + ')' }, gt);
      const ring = r.round ? el('circle', { class: 'pp-ring', r: f(r.hw + .02) }, g) : el('rect', { class: 'pp-ring', x: f(-r.hw), y: f(-r.hd), width: f(2 * r.hw), height: f(2 * r.hd), rx: .3, transform: 'rotate(' + f(-t.rot) + ')' }, g);
      const body = el('g', { transform: 'rotate(' + f(-t.rot) + ')' }, g);
      const n = t.seats, rr = s.round ? s.w / 2 + .26 : 0;
      for (let i = 0; i < n; i++) {
        if (s.round) { const a = -Math.PI / 2 + i * 2 * Math.PI / n; el('circle', { class: 'pp-seat', cx: f(Math.cos(a) * rr), cy: f(Math.sin(a) * rr), r: .15 }, body); }
        else { const per = Math.ceil(n / 2), side = i < per ? -1 : 1, k = side < 0 ? per : n - per, j = side < 0 ? i : i - per; el('circle', { class: 'pp-seat', cx: f((j - (k - 1) / 2) * Math.min(.6, s.w / Math.max(1, k))), cy: f(side * (s.d / 2 + .22)), r: .15 }, body); }
      }
      if (s.round) el('circle', { class: 'pp-top', r: f(s.w / 2) }, body); else el('rect', { class: 'pp-top', x: f(-s.w / 2), y: f(-s.d / 2), width: f(s.w), height: f(s.d), rx: .06 }, body);
      const cloth = el('g', { class: 'pp-set' }, body);
      if (s.round) el('circle', { r: f(s.w / 2 + .05) }, cloth); else el('rect', { x: f(-s.w / 2 - .05), y: f(-s.d / 2 - .05), width: f(s.w + .1), height: f(s.d + .1), rx: .05 }, cloth);
      const lab = el('text', { class: 'pp-lab', y: .02, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
      const o = { t, g, ring, lab, cloth };
      g.addEventListener('click', () => { if (!o.dragged && opts.onTable) opts.onTable(t.id); o.dragged = false; });
      g.addEventListener('keydown', (e) => { if (editing && opts.onKey && opts.onKey(e, t.id)) { e.preventDefault(); return; } if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (opts.onTable) opts.onTable(t.id); } });
      g.addEventListener('pointerdown', (e) => {
        if (!editing) return; e.preventDefault(); const p0 = pt(e), x0 = t.x, z0 = t.z; let moved = false; g.setPointerCapture(e.pointerId);
        const mv = (ev) => { const p = pt(ev), dx = p[0] - p0[0], dz = p[1] - p0[1]; if (Math.abs(dx) + Math.abs(dz) > .05) moved = true; if (moved) { o.live = [snap(x0 + dx), snap(z0 + dz)]; g.setAttribute('transform', 'translate(' + f(o.live[0]) + ' ' + f(Y(o.live[1])) + ')'); } };
        const upH = () => { g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', upH); g.removeEventListener('pointercancel', upH); if (moved && o.live) { o.dragged = true; if (opts.onMove) opts.onMove(t.id, o.live[0], o.live[1]); } };
        g.addEventListener('pointermove', mv); g.addEventListener('pointerup', upH); g.addEventListener('pointercancel', upH);
      });
      T.set(t.id, o);
    });
    paint();
  }
  const pt = (e) => { const m = svg.getScreenCTM(); if (!m) return [0, 0]; const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; const q = p.matrixTransform(m.inverse()); return [q.x, L.room.d - q.y]; };
  function paint() {
    T.forEach((o, id) => {
      const r = rows.get(id) || { phase: 'free', text: '' }, c = r.warn ? '#E25C7A' : STATE_COLOURS[r.phase] || STATE_COLOURS.free;
      o.g.setAttribute('data-phase', r.phase); o.g.classList.toggle('sel', selected === id); o.g.classList.toggle('warn', !!r.warn);
      o.ring.style.stroke = c; o.ring.style.fill = c; o.lab.textContent = r.text || ''; if (r.aria) o.g.setAttribute('aria-label', r.aria);
      o.cloth.classList.toggle('on', set.has(id));
    });
  }
  draw();
  return {
    kind: '2d', svg,
    setRows(list) { list.forEach((r) => rows.set(r.id, r)); paint(); },
    select(id) { selected = id; paint(); },
    edit(on) { editing = !!on; svg.classList.toggle('pp-edit', editing); },
    setLang(next, label) { opts.lang = next; if (label != null) svg.setAttribute('aria-label', label); svg.querySelectorAll('.pp-zl').forEach((x) => { const z = L.zones.find((zz) => zz.id === x.getAttribute('data-zone')); if (z) x.textContent = z.name[next] || z.name.en; }); },
    setLayout(next) { const a = document.activeElement, id = a && a.closest && a.closest('.pp-t') ? a.closest('.pp-t').getAttribute('data-id') : null; L = next; draw(); if (id && T.has(id)) T.get(id).g.focus(); },
    setTable(id, on = true) { if (on) set.add(id); else set.delete(id); paint(); return Promise.resolve(); },
    isSet: (id) => set.has(id),
    flyTo() { return Promise.resolve(); }, view() { return Promise.resolve(); },
    focusTable(id) { const o = T.get(id); if (o) o.g.focus(); },
    screenOf(id) { const o = T.get(id); if (!o) return null; const b = o.g.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; },
    info: () => ({ kind: '2d', set: [...set] }),
    wake() {}, size() {},
    dispose() { svg.remove(); }
  };
}
