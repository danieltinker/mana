/* The place, built from layout.v1: the architecture (floors, walls with their openings, glazing that reads as glass, the
   arched doorways, the awnings, posts, trees) and the furniture by each table's `look` (round marble tops on black
   pedestals, wooden and glass-top tables, white slatted chairs, sage velvet chairs, saddle stools, the lounge pair with
   sling chairs) and the fixtures (the counter with its vitrine and espresso machine, the boutique shelf, benches, the
   banquette, the fridge, paper lanterns). Low poly, merged per material: the whole room is a few dozen draw calls, each
   table its own group so the floor's edit mode can move it. Metres; the layout's (x, z) is the world's (x, 0, z).
   Textures are drawn on small canvases here: no image file is loaded. Nothing in it is a photo of the café. */
import { BufferGeometry, BufferAttribute, BoxGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, CircleGeometry, ExtrudeGeometry, Shape, Path,
  Matrix4, Euler, Quaternion, Vector3, Mesh, Group, Color, MeshStandardMaterial, MeshBasicMaterial, CanvasTexture, RepeatWrapping, DoubleSide, sRGBEncoding, MultiplyBlending } from 'three';
import { sizeOf } from '../../../seating/edit.mjs';

export const WALL_H = 3.1, WALL_T = 0.2, TOP_H = 0.74;
const lin = (hex) => new Color(hex).convertSRGBToLinear();
export const M4 = (x, y, z, ry = 0, rx = 0, rz = 0, s = 1) => new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, rz)), typeof s === 'number' ? new Vector3(s, s, s) : new Vector3(s[0], s[1], s[2]));

/* many [geometry, matrix] as one non-indexed geometry (position, normal, uv) */
export function merge(parts) {
  let n = 0; const flat = parts.map(([g, m]) => { const ng = g.index ? g.toNonIndexed() : g.clone(); ng.applyMatrix4(m); n += ng.attributes.position.count; return ng; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
  flat.forEach((g) => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); });
  parts.forEach(([g]) => g.dispose());
  const out = new BufferGeometry(); out.setAttribute('position', new BufferAttribute(pos, 3)); out.setAttribute('normal', new BufferAttribute(nor, 3)); out.setAttribute('uv', new BufferAttribute(uv, 2));
  out.computeBoundingSphere(); return out;
}
/* a bag of parts per material, turned into meshes once */
function bag() {
  const lists = new Map();
  const api = {
    add(mat, g, m) { if (!lists.has(mat)) lists.set(mat, []); lists.get(mat).push([g, m]); return api; },
    box(mat, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) { return api.add(mat, new BoxGeometry(w, h, d), M4(x, y, z, ry, rx, rz)); },
    cyl(mat, r1, r2, h, x, y, z, seg = 18, open = false, rx = 0, rz = 0, ry = 0) { return api.add(mat, new CylinderGeometry(r1, r2, h, seg, 1, open), M4(x, y, z, ry, rx, rz)); },
    /* a contact shadow on the floor: a soft patch w × d, centred at (x, z) */
    decal(mat, w, d, x, z, rz = 0) { return api.add(mat, new PlaneGeometry(w, d), M4(x, .021, z, 0, -Math.PI / 2, rz)); },
    into(group, under) { lists.forEach((parts, mat) => { const mesh = new Mesh(merge(parts.map(([g, m]) => [g, under ? under.clone().multiply(m) : m])), mat); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); group.add(mesh); }); lists.clear(); return group; }
  };
  return api;
}

/* ---------- canvas textures ---------- */
function tex(size, draw, rx = 1, ry = 1) { const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size); const t = new CanvasTexture(c); t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(rx, ry); t.encoding = sRGBEncoding; t.anisotropy = 4; return t; }
const rnd = (seed) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pavers = (rx, ry) => tex(256, (x, s) => { const r = rnd(7); x.fillStyle = '#4a4a4f'; x.fillRect(0, 0, s, s); const h = s / 8, w = s / 4; for (let j = 0; j < 8; j++) for (let i = -1; i < 5; i++) { const g = 112 + Math.floor(r() * 30); x.fillStyle = 'rgb(' + g + ',' + g + ',' + (g + 5) + ')'; x.fillRect(i * w + (j % 2) * w / 2 + 3, j * h + 3, w - 6, h - 6); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(i * w + (j % 2) * w / 2 + 3, j * h + 3, w - 6, 2); } }, rx, ry);
const tiles = (rx, ry, base = 214) => tex(128, (x, s) => { const r = rnd(11); x.fillStyle = '#ada69a'; x.fillRect(0, 0, s, s); const n = 4, k = s / n; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const g = base + Math.floor(r() * 12) - 6; x.fillStyle = 'rgb(' + g + ',' + (g - 3) + ',' + (g - 9) + ')'; x.fillRect(i * k + 1, j * k + 1, k - 2, k - 2); } }, rx, ry);
const terrazzo = (rx, ry) => tex(256, (x, s) => { const r = rnd(5); x.fillStyle = '#e6dac4'; x.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++) { const g = r(); x.fillStyle = g < .5 ? 'rgba(160,140,115,.55)' : g < .8 ? 'rgba(255,255,255,.7)' : 'rgba(120,110,100,.5)'; x.beginPath(); x.arc(r() * s, r() * s, .6 + r() * 1.6, 0, 7); x.fill(); } x.strokeStyle = 'rgba(150,135,115,.35)'; x.lineWidth = 1.2; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * s / 8, 0); x.lineTo(i * s / 8, s); x.moveTo(0, i * s / 8); x.lineTo(s, i * s / 8); x.stroke(); } }, rx, ry);
const asphalt = (rx, ry) => tex(128, (x, s) => { const r = rnd(3); x.fillStyle = '#5d5d5f'; x.fillRect(0, 0, s, s); for (let i = 0; i < 700; i++) { const g = 70 + Math.floor(r() * 40); x.fillStyle = 'rgba(' + g + ',' + g + ',' + g + ',.6)'; x.fillRect(r() * s, r() * s, 1.5, 1.5); } }, rx, ry);
const marbleTex = () => tex(256, (x, s) => { const r = rnd(13); x.fillStyle = '#f3f0ea'; x.fillRect(0, 0, s, s);
  for (let k = 0; k < 7; k++) { x.strokeStyle = 'rgba(120,112,104,' + (.08 + r() * .12) + ')'; x.lineWidth = .6 + r() * 1.4; x.beginPath(); let px = r() * s, py = 0; x.moveTo(px, py); for (let i = 0; i < 6; i++) { const nx = px + (r() - .5) * 90, ny = py + s / 6; x.quadraticCurveTo(px + (r() - .5) * 60, py + s / 12, nx, ny); px = nx; py = ny; } x.stroke(); } });
/* a soft dark patch under things: the contact shadow (warm, never black) */
export const contactTex = () => { const t = tex(128, (x, s) => { x.fillStyle = '#fff'; x.fillRect(0, 0, s, s); const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, 'rgb(150,132,112)'); g.addColorStop(.4, 'rgb(180,166,150)'); g.addColorStop(.72, 'rgb(226,219,210)'); g.addColorStop(1, '#fff'); x.fillStyle = g; x.fillRect(0, 0, s, s); }); t.wrapS = t.wrapT = 1001; return t; };
export const radial = (inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') => { const t = tex(128, (x, s) => { const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); g.addColorStop(0, inner); g.addColorStop(.55, inner.replace(/[\d.]+\)$/, '.45)')); g.addColorStop(1, outer); x.fillStyle = g; x.fillRect(0, 0, s, s); }); t.wrapS = t.wrapT = 1001; return t; };

/* ---------- materials ---------- */
export function materials() {
  const std = (c, o) => new MeshStandardMaterial(Object.assign({ color: lin(c), roughness: .7, metalness: 0 }, o || {}));
  const M = {
    wall: std(0xe2d2b6, { roughness: .92 }), wallIn: std(0xede5d6, { roughness: .95 }), trim: std(0xfbfaf7, { roughness: .4 }),
    glass: std(0xcfe3ee, { roughness: .05, transparent: true, opacity: .26, depthWrite: false, metalness: .1 }),
    frame: std(0xfdfdfb, { roughness: .35 }), shutter: std(0xc4bea4, { roughness: .8 }),
    marble: std(0xffffff, { map: marbleTex(), roughness: .22 }), black: std(0x1b1918, { roughness: .4, metalness: .35 }), white: std(0xeeebe5, { roughness: .42 }),
    oak: std(0x986638, { roughness: .58 }), honey: std(0xb87430, { roughness: .42 }), plank: std(0x7a5434, { roughness: .8 }), darkwood: std(0x573722, { roughness: .6 }),
    velvet: std(0xa2b27c, { roughness: .95 }), mustard: std(0xc08823, { roughness: .95 }), canvas: std(0xf2efe8, { roughness: .9 }), chrome: std(0xd8dadc, { roughness: .2, metalness: .9 }),
    awning: std(0xb09b7e, { roughness: .95, side: DoubleSide, transparent: true, opacity: .92 }), awningEdge: std(0xa18c70, { roughness: .95, side: DoubleSide }),
    leaf: std(0x5f8048, { roughness: .9 }), leafDark: std(0x4b6a3a, { roughness: .9 }), bark: std(0x7a6450, { roughness: .9 }), pot: std(0x54524f, { roughness: .8 }),
    terracotta: std(0xa4553c, { roughness: .35 }), steel: std(0xbfc3c6, { roughness: .3, metalness: .7 }), concrete: std(0xb9b3aa, { roughness: .95 }),
    kerbRed: std(0xb4433a, { roughness: .8 }), kerbWhite: std(0xe8e6e1, { roughness: .8 }), print: std(0xf3a37e, { roughness: .8 }), printIn: std(0xe0704c, { roughness: .8 }),
    lantern: new MeshStandardMaterial({ color: lin(0xfff3dc), emissive: lin(0xffc982), emissiveIntensity: 1.35, roughness: .9 }),
    /* contact shadows multiply the floor (white leaves it as it is), drawn with the solid things, after the floors and before any glow */
    contact: new MeshBasicMaterial({ map: contactTex(), blending: MultiplyBlending, premultipliedAlpha: true, transparent: false, depthWrite: false, toneMapped: false, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    pastry: std(0xd39a4c, { roughness: .7 }), bottle: std(0xf0a59a, { roughness: .2, transparent: true, opacity: .85 }), tin: std(0x34506e, { roughness: .4, metalness: .4 }), drink: std(0x6aa6c9, { roughness: .3 }),
    linen: std(0xfbfaf6, { roughness: .95, side: DoubleSide }), plate: std(0xffffff, { roughness: .25 }), cutlery: std(0xd5d7d9, { roughness: .2, metalness: .9 }),
    tumbler: std(0xe8f1f5, { roughness: .05, transparent: true, opacity: .45, depthWrite: false }), wax: std(0xfaf3e3, { roughness: .8 }),
    flame: new MeshBasicMaterial({ color: lin(0xffc46a), transparent: true, opacity: .95 }),
    pavers: std(0xffffff, { map: pavers(24, 3), roughness: .95 }), tiles: std(0xffffff, { map: tiles(20, 4), roughness: .7 }), terrazzo: std(0xffffff, { map: terrazzo(5, 7), roughness: .5 }),
    road: std(0xffffff, { map: asphalt(10, 2), roughness: 1 }), kitchenFloor: std(0xffffff, { map: tiles(6, 4, 205), roughness: .7 }), closed: std(0xd8d1c5, { roughness: 1 })
  };
  ['glass', 'tumbler', 'bottle', 'lantern', 'flame', 'linen', 'plate', 'cutlery', 'wax', 'contact', 'awning', 'awningEdge'].forEach((k) => { M[k].userData.noCast = true; });      /* see-through or tiny: no shadow */
  return M;
}

/* ---------- the architecture ---------- */
const inRect = (r, x, z, pad = 0) => x >= r[0] - pad && x <= r[2] + pad && z >= r[1] - pad && z <= r[3] + pad;
const fixturesOf = (L, kind) => (L.fixtures || []).filter((f) => f.kind === kind);
/* a floor patch: a plane with a texture scaled to metres (k metres per repeat) */
function patch(group, mat, x1, z1, x2, z2, y, k) {
  const m = mat.clone(); if (m.map) { m.map = m.map.clone(); m.map.needsUpdate = true; m.map.repeat.set((x2 - x1) / k, (z2 - z1) / k); }
  const p = new Mesh(new PlaneGeometry(x2 - x1, z2 - z1), m); p.rotation.x = -Math.PI / 2; p.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); p.userData.floor = true; group.add(p); return p;
}

/* → { group, walls: [{ group, a: [x, z], b: [x, z], mats: [material] }], lights: [[x, y, z]] } */
export function buildArchitecture(L, M) {
  const W = L.room.w, D = L.room.d, root = new Group(), base = bag();
  /* the ground: the road, the kerb, the pavement, the terrace, inside */
  patch(root, M.road, -4, -5, W + 4, 0, 0, 3);
  for (let x = -4, i = 0; x < W + 4; x += 1.6, i++) base.box(i % 2 ? M.kerbWhite : M.kerbRed, 1.58, .14, .22, x + .8, .07, .11);
  const walk = fixturesOf(L, 'walkway')[0], terraceZ = walk ? walk.rect[3] : 1.2;
  patch(root, M.pavers, -4, .22, W + 4, terraceZ, .012, 1.6);
  patch(root, M.tiles, 0, terraceZ, W, 4, .016, 1.2);
  const closed = fixturesOf(L, 'closed'), kitchen = fixturesOf(L, 'kitchen');
  closed.forEach((f) => patch(root, M.closed, f.rect[0], f.rect[1], f.rect[2], f.rect[3], .014, 4));
  kitchen.forEach((f) => patch(root, M.kitchenFloor, f.rect[0], f.rect[1], f.rect[2], f.rect[3], .015, 1.2));
  /* inside: every part of the room behind the façade that is neither closed nor the kitchen gets terrazzo */
  const inside = [], cell = .5;
  for (let x = 0; x < W; x += cell) for (let z = 4; z < D; z += cell) { const cx = x + cell / 2, cz = z + cell / 2; if (!closed.concat(kitchen).some((f) => inRect(f.rect, cx, cz))) inside.push([x, z]); }
  if (inside.length) { const xs = inside.map((p) => p[0]), zs = inside.map((p) => p[1]); const x1 = Math.min(...xs), x2 = Math.max(...xs) + cell, z1 = Math.min(...zs), z2 = Math.max(...zs) + cell; patch(root, M.terrazzo, x1, z1, x2, z2, .013, 1.6); }
  base.into(root);
  /* the walls: each its own group (it fades when it stands between the camera and what it looks at) */
  const walls = [];
  const facadeZ = 4;
  L.walls.forEach((w, wi) => {
    const [ax, az] = w.from, [bx, bz] = w.to, len = Math.hypot(bx - ax, bz - az) || 1, ang = -Math.atan2(bz - az, bx - ax);
    const mid = (a, b) => [ax + (bx - ax) * (a + b) / (2 * len), az + (bz - az) * (a + b) / (2 * len)];
    const g = new Group(), mats = { wall: (az === facadeZ && bz === facadeZ ? M.wall : M.wallIn).clone(), glass: M.glass.clone(), frame: M.frame.clone(), shutter: M.shutter.clone() };
    Object.values(mats).forEach((m) => { m.transparent = true; m.userData.base = m.opacity; });
    const b = bag();
    const piece = (a, c, h, y0, mat = mats.wall, t = WALL_T) => { const [cx, cz] = mid(a, c); b.box(mat, c - a + (mat === mats.wall ? t : 0), h, t, cx, y0 + h / 2, cz, ang); };
    const closedInside = (s) => { const [cx, cz] = mid(s, s); const nx = Math.sin(ang), nz = Math.cos(ang); return closed.some((f) => inRect(f.rect, cx + nx * .4, cz + nz * .4) || inRect(f.rect, cx - nx * .4, cz - nz * .4)); };
    if (w.kind === 'door' && w.gap) {
      const [g0, g1] = w.gap, gw = g1 - g0, arched = gw <= 1.3;
      piece(0, g0, WALL_H, 0); piece(g1, len, WALL_H, 0);
      const top = arched ? 2.25 + gw / 2 : 2.55;
      piece(g0, g1, WALL_H - top, top);
      if (arched) {                                                    // the arch: the lintel's lower edge is a half circle
        const s = new Shape(); s.moveTo(-gw / 2, 0); s.lineTo(gw / 2, 0); s.lineTo(gw / 2, gw / 2); s.lineTo(-gw / 2, gw / 2); s.lineTo(-gw / 2, 0);
        const hole = new Path(); hole.absarc(0, 0, gw / 2 - .001, 0, Math.PI, false); hole.lineTo(-gw / 2 + .001, 0); s.holes.push(hole);
        const eg = new ExtrudeGeometry(s, { depth: WALL_T, bevelEnabled: false, curveSegments: 14 }); eg.translate(0, 0, -WALL_T / 2);
        const [cx, cz] = mid(g0, g1); b.add(mats.wall, eg, M4(cx, 2.25, cz, ang));
      }
    } else if (w.kind === 'window') {
      const shut = closedInside(len / 2);
      piece(0, len, .9, 0); piece(0, len, WALL_H - 2.45, 2.45);
      if (shut) {                                                      // a window of the building's other part: wooden shutters
        const [cx, cz] = mid(0, len); b.box(mats.shutter, len - .04, 1.5, .06, cx, 1.68, cz, ang);
        for (let k = 0; k < 10; k++) b.box(mats.frame, len - .1, .02, .07, cx, 1.0 + k * .15, cz, ang);
      } else {
        const [cx, cz] = mid(0, len); b.box(mats.glass, len, 1.55, .03, cx, 1.675, cz, ang);
        const n = Math.max(2, Math.round(len / .55));
        for (let k = 0; k <= n; k++) { const [mx, mz] = mid(k * len / n, k * len / n); b.box(mats.frame, .05, 1.55, .07, mx, 1.675, mz, ang); }
        [.9, 1.65, 2.45].forEach((y) => b.box(mats.frame, len, .05, .07, cx, y, cz, ang));
      }
    } else piece(0, len, WALL_H, 0);
    b.into(g); root.add(g);
    walls.push({ group: g, a: [ax, az], b: [bx, bz], mats: Object.values(mats), i: wi });
  });
  /* the back wall's decoration, if there is an arched doorway: a round mirror and a concrete basin behind it */
  L.walls.filter((w) => w.kind === 'door' && w.gap && w.gap[1] - w.gap[0] <= 1.3 && w.from[1] === w.to[1] && w.from[1] > 8).forEach((w) => {
    const d = bag(), c = w.from[0] + (w.gap[0] + w.gap[1]) / 2 * Math.sign(w.to[0] - w.from[0]), z = w.from[1];
    d.box(M.darkwood, w.gap[1] - w.gap[0], 2.6, .05, c, 1.3, z + .75);
    d.cyl(M.concrete, .2, .2, .85, c, .425, z + .5, 20); d.add(M.trim, new CircleGeometry(.24, 24), M4(c, 1.55, z + .72));
    d.box(M.print, .9, 1.3, .03, c + 1.6, 1.9, z - .12); d.box(M.printIn, .5, .85, .035, c + 1.6, 1.9, z - .12);
    d.into(root);
  });
  return { group: root, walls };
}

/* ---------- the fixtures ---------- */
export function buildFixtures(L, M) {
  const root = new Group(), b = bag(), lamps = [];
  (L.fixtures || []).forEach((f) => {
    const r = f.rect, at = f.at;
    const cx = r ? (r[0] + r[2]) / 2 : at[0], cz = r ? (r[1] + r[3]) / 2 : at[1], w = r ? r[2] - r[0] : 0, d = r ? r[3] - r[1] : 0;
    switch (f.kind) {
      case 'awning': {                                                 // sloped fabric from the façade down to the front, a valance, white arms
        const y0 = 2.95, y1 = 2.35, run = d, slope = Math.atan2(y0 - y1, run), lenS = Math.hypot(run, y0 - y1);
        b.box(M.awning, w - .04, .02, lenS, cx, (y0 + y1) / 2, cz, 0, slope);
        b.box(M.awningEdge, w - .04, .26, .02, cx, y1 - .12, r[1]);
        b.cyl(M.frame, .03, .03, w, cx, y1, r[1] + .02, 10, false, 0, Math.PI / 2);
        for (let k = 0; k < 3; k++) { const ax = r[0] + .3 + k * (w - .6) / 2; b.box(M.frame, .04, .04, lenS * .95, ax, (y0 + y1) / 2 - .06, cz, 0, slope + .12); }
        break;
      }
      case 'post': b.decal(M.contact, .5, .5, cx, cz); b.cyl(M.frame, .05, .05, 2.75, cx, 1.375, cz, 14); b.cyl(M.frame, .08, .08, .04, cx, .02, cz, 14); break;
      case 'tree': b.decal(M.contact, 2.6, 2.6, cx, cz); b.cyl(M.bark, .1, .14, 3.2, cx, 1.6, cz, 10); [[0, 4.2, 0, 1.1], [.6, 3.8, .3, .8], [-.5, 3.9, -.2, .85], [.15, 3.5, -.5, .7]].forEach(([dx, y, dz, s]) => b.add(M.leaf, new SphereGeometry(s, 9, 7), M4(cx + dx, y, cz + dz, 0, 0, 0, [1, .78, 1]))); break;
      case 'planter': b.decal(M.contact, .8, .8, cx, cz); b.cyl(M.pot, .22, .17, .45, cx, .225, cz, 16); b.cyl(M.bark, .02, .025, 2.0, cx, 1.4, cz, 6);
        for (let k = 0; k < 9; k++) { const y = 1.2 + k * .14, a = k * 2.4; b.add(k % 2 ? M.leaf : M.leafDark, new SphereGeometry(.13, 6, 4), M4(cx + Math.cos(a) * .14, y, cz + Math.sin(a) * .1, a, 0, 0, [1, .18, .75])); } break;
      case 'bench': b.decal(M.contact, w + .4, d + .5, cx, cz); b.box(M.plank, w, .06, d * .9, cx, .45, cz); [r[0] + .12, r[2] - .12].forEach((x) => b.box(M.plank, .06, .42, d * .7, x, .21, cz)); break;
      case 'banquette': { const wallSide = r[2] >= L.room.w - .5 || cx > L.room.w / 2 ? 1 : -1;
        b.decal(M.contact, w + .5, d + .4, cx, cz); b.box(M.darkwood, w, .42, d, cx, .21, cz); b.box(M.oak, w * .96, .05, d - .04, cx - wallSide * .02, .445, cz); b.box(M.darkwood, .1, .55, d, cx + wallSide * (w / 2 - .05), .75, cz); break; }
      case 'fridge': b.decal(M.contact, w + .4, d + .4, cx, cz); b.box(M.white, w, 1.0, d, cx, .5, cz); b.box(M.glass, w - .1, .78, .02, cx, .55, r[1] - .005);
        for (let k = 0; k < 3; k++) for (let i = 0; i < 6; i++) b.cyl(i % 3 === 0 ? M.drink : M.bottle, .035, .035, .2, r[0] + .1 + i * (w - .2) / 5, .3 + k * .26, cz - .02, 8); break;
      case 'counter': b.decal(M.contact, w + .6, d + .6, cx, cz); b.box(M.white, w, .95, d, cx, .475, cz); b.box(M.terracotta, w + .06, .05, d + .08, cx, .975, cz); break;
      case 'vitrine': b.box(M.glass, w - .06, .42, d - .06, cx, 1.22, cz); b.box(M.frame, w - .04, .025, d - .04, cx, 1.43, cz);
        for (let k = 0; k < 7; k++) b.add(M.pastry, new SphereGeometry(.07, 8, 5), M4(r[0] + .18 + k * (w - .36) / 6, 1.06, cz + (k % 2 ? .08 : -.08), k, 0, 0, [1.4, .55, 1])); break;
      case 'espresso': b.box(M.steel, .62, .42, .42, cx, 1.21, cz); b.box(M.black, .5, .06, .3, cx, 1.03, cz - .02); [-.15, .15].forEach((dx) => b.cyl(M.black, .03, .03, .1, cx + dx, 1.0, cz - .18, 8)); b.cyl(M.steel, .08, .1, .12, cx + .45, 1.06, cz, 12); break;
      case 'shelf': { const along = d > w; const L2 = along ? d : w; b.decal(M.contact, w + .4, d + .4, cx, cz);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([u, v]) => b.cyl(M.chrome, .012, .012, 1.8, cx + u * (w / 2 - .02), .9, cz + v * (d / 2 - .02), 6));
        for (let k = 0; k < 4; k++) { const y = .35 + k * .42; b.box(M.oak, w - .02, .025, d - .02, cx, y, cz);
          for (let i = 0; i < 6; i++) { const t = -L2 / 2 + .14 + i * (L2 - .28) / 5, x = along ? cx : cx + t, z = along ? cz + t : cz; if (k < 2) b.cyl(M.bottle, .035, .035, .3, x, y + .16, z, 8); else b.cyl(M.tin, .045, .045, .12, x, y + .07, z, 10); } } break; }
      case 'hatch': b.box(M.marble, w, .04, .32, cx, .92, (r[1] + r[3]) / 2 - .1); break;
      case 'lamp': lamps.push([cx, 2.35, cz]); break;                     // the paper lanterns are built by place.js, one by one (they glow, and fade when in the way)
      case 'kitchen': b.box(M.steel, Math.min(w - .4, 3), .9, .6, cx, .45, r[3] - .45); b.box(M.steel, .6, .9, Math.min(d - .6, 2), r[0] + .45, .45, cz); break;
      default: break;                                                  // walkway, closed: drawn by the floors
    }
  });
  b.into(root);
  return { group: root, lamps };
}

/* ---------- the furniture: one group per table ---------- */
/* where the bench or banquette is for a table (the side it leans on), or null */
function benchSide(L, t) {
  let best = null;
  (L.fixtures || []).filter((f) => (f.kind === 'bench' || f.kind === 'banquette') && f.rect).forEach((f) => {
    const px = Math.max(f.rect[0], Math.min(f.rect[2], t.x)), pz = Math.max(f.rect[1], Math.min(f.rect[3], t.z)), dist = Math.hypot(px - t.x, pz - t.z);
    if (dist < 1.0 && (!best || dist < best.dist)) best = { dist, dx: (px - t.x) / (dist || 1), dz: (pz - t.z) / (dist || 1) };
  });
  return best;
}
/* chairs by kind, built facing -z in their own space (the table is at -z), then placed */
function chair(b, M, kind, m) {
  b.add(M.contact, new PlaneGeometry(kind === 'stools' ? .58 : .66, kind === 'stools' ? .48 : .66), m.clone().multiply(M4(0, .021, .02, 0, -Math.PI / 2)));
  const P = (mat, w, h, d, x, y, z, rx = 0) => b.add(mat, new BoxGeometry(w, h, d), m.clone().multiply(M4(x, y, z, 0, rx)));
  const C = (mat, r, h, x, y, z) => b.add(mat, new CylinderGeometry(r, r, h, 6), m.clone().multiply(M4(x, y, z)));
  if (kind === 'stools') { P(M.oak, .4, .05, .27, 0, .45, 0); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([u, v]) => P(M.oak, .035, .43, .035, u * .16, .215, v * .1)); P(M.oak, .32, .025, .025, 0, .16, .1); P(M.oak, .32, .025, .025, 0, .16, -.1); return; }
  if (kind === 'velvet') { P(M.velvet, .44, .09, .44, 0, .46, 0); P(M.velvet, .46, .4, .07, 0, .74, .21, -.12); [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([u, v]) => P(M.oak, .035, .42, .035, u * .18, .21, v * .18)); return; }
  /* white slatted aluminium chair: slats on the seat and the back, thin tube legs */
  for (let k = 0; k < 5; k++) P(M.white, .065, .025, .42, -.17 + k * .085, .45, 0);
  for (let k = 0; k < 5; k++) P(M.white, .06, .44, .02, -.17 + k * .085, .7, .21, -.1);
  P(M.white, .44, .035, .03, 0, .91, .23, -.1);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([u, v]) => C(M.white, .013, .45, u * .19, .225, v * .19));
}
function lounge(b, M, m, side) {           // the mustard lounge pair on one side, two white sling chairs on the other
  const P = (mat, w, h, d, x, y, z, ry = 0, rx = 0) => b.add(mat, new BoxGeometry(w, h, d), m.clone().multiply(M4(x, y, z, ry, rx)));
  const C = (mat, r, h, x, y, z, rz = 0, rx = 0) => b.add(mat, new CylinderGeometry(r, r, h, 6), m.clone().multiply(M4(x, y, z, 0, rx, rz)));
  b.add(M.contact, new PlaneGeometry(2.2, 1.3), m.clone().multiply(M4(0, .021, side * .85, 0, -Math.PI / 2))); b.add(M.contact, new PlaneGeometry(2, 1.1), m.clone().multiply(M4(0, .021, -side * .85, 0, -Math.PI / 2)));
  [-.38, .38].forEach((x) => { P(M.mustard, .72, .3, .7, x, .2, side * .78); P(M.mustard, .72, .5, .2, x, .55, side * 1.08, 0, side * .14); P(M.black, .66, .05, .62, x, .03, side * .8); });
  [-.36, .36].forEach((x) => { const z = -side * .85;
    [-1, 1].forEach((u) => { C(M.chrome, .014, .62, x + u * .27, .3, z, 0, 0); C(M.chrome, .014, .6, x + u * .27, .35, z - side * .02, Math.PI / 2, 0); });
    P(M.canvas, .5, .02, .46, x, .34, z, 0, side * -.18); P(M.canvas, .5, .44, .02, x, .6, z - side * .24, 0, side * .2); });
}
/* one table: its top by look, its pedestal or legs, its chairs; → { group, top: y of the top, size } */
export function buildTable(L, t, M) {
  const g = new Group(); g.position.set(t.x, 0, t.z); g.rotation.y = -t.rot * Math.PI / 180; g.userData.id = t.id;
  const b = bag(), s = sizeOf(t), look = t.look || { top: 'wood', seat: 'chairs', w: s.w, d: s.d }, sofa = look.seat === 'sofa';
  const h = sofa ? .42 : TOP_H;
  /* the top */
  if (s.round) {
    const r = s.w / 2, topMat = look.top === 'wood' ? M.oak : look.top === 'iron' ? M.white : M.marble;
    b.cyl(topMat, r, r, .03, 0, h - .015, 0, 28);
    if (look.top === 'iron') { for (let k = 0; k < 3; k++) { const a = k * 2.094; b.cyl(M.white, .012, .012, h, Math.cos(a) * r * .45, h / 2, Math.sin(a) * r * .45, 6, false, Math.sin(a) * .18, -Math.cos(a) * .18); } b.cyl(M.white, r * .5, r * .5, .015, 0, .28, 0, 18, true); }
    else { b.cyl(M.black, .035, .035, h - .03, 0, (h - .03) / 2, 0, 10); b.cyl(M.black, .2, .22, .035, 0, .018, 0, 20); }
  } else {
    const topMat = look.top === 'glass' ? M.honey : look.top === 'marble' ? M.marble : look.seat === 'sofa' ? M.oak : M.plank;
    b.box(topMat, s.w, .045, s.d, 0, h - .023, 0);
    if (look.top === 'glass') b.box(M.tumbler, s.w - .02, .012, s.d - .02, 0, h + .006, 0);
    const lx = s.w / 2 - .06, lz = s.d / 2 - .06;
    if (sofa) b.box(M.oak, s.w - .04, h - .05, s.d - .04, 0, (h - .05) / 2, 0);
    else [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([u, v]) => b.box(topMat === M.marble ? M.black : topMat, .05, h - .045, .05, u * lx, (h - .045) / 2, v * lz));
  }
  /* the seats */
  const n = t.seats, bench = (look.seat === 'bench' || look.seat === 'velvet') ? benchSide(L, t) : null;
  const rot = t.rot * Math.PI / 180, toLocal = (dx, dz) => [dx * Math.cos(rot) + dz * Math.sin(rot), -dx * Math.sin(rot) + dz * Math.cos(rot)];      // world direction → the table's own axes
  const kind = look.seat === 'velvet' ? 'velvet' : look.seat === 'stools' || look.seat === 'bench' ? 'stools' : 'chairs';
  const place = (x, z, faceAngle) => chair(b, M, kind, M4(x, 0, z, faceAngle));          // faceAngle: the chair's back points away from the table
  if (sofa) lounge(b, M, new Matrix4(), 1);
  else if (s.round) {
    const r = s.w / 2 + .32; let angles = [];
    const free = bench ? Math.max(1, n - 1) : n;                                         // one guest sits on the bench or banquette
    if (bench) { const [lx, lz] = toLocal(-bench.dx, -bench.dz), a0 = Math.atan2(lz, lx), spread = free === 1 ? 0 : 1.1; for (let i = 0; i < free; i++) angles.push(a0 + (free === 1 ? 0 : -spread / 2 + i * spread / (free - 1))); }
    else for (let i = 0; i < n; i++) angles.push(-Math.PI / 2 + i * 2 * Math.PI / n + (n === 2 ? Math.PI / 2 : 0));
    angles.forEach((a) => place(Math.cos(a) * r, Math.sin(a) * r, Math.atan2(Math.cos(a), Math.sin(a))));
  } else {
    const per = Math.ceil(n / 2), sides = [-1, 1];
    let skip = 0; if (bench) { const [, lz] = toLocal(bench.dx, bench.dz); skip = lz > 0 ? 1 : -1; }
    sides.forEach((sz) => { if (sz === skip) return; const k = sz === -1 ? per : n - per; for (let i = 0; i < k; i++) { const x = (i - (k - 1) / 2) * Math.min(.62, (s.w - .1) / Math.max(1, k)); place(x, sz * (s.d / 2 + .3), sz < 0 ? Math.PI : 0); } });
  }
  /* contact shadows: one under the table, one under every chair (they are what makes white chairs read on light tiles) */
  if (s.round) b.decal(M.contact, s.w * 1.25, s.w * 1.25, 0, 0); else b.decal(M.contact, s.w + .3, s.d + .3, 0, 0);
  b.into(g);
  return { group: g, top: h, size: s };
}

/* the table setting: a cloth, plates and cutlery for each seat (up to six), glasses, a candle; one group per piece, so
   each can arrive on its own. Built at rest on the top; place.js animates them in. */
export function buildSetting(L, t, M, top) {
  const s = sizeOf(t), g = new Group(), pieces = [], n = Math.min(6, t.seats), round = s.round;
  const cloth = new Group(), cb = bag();
  if (round) { const r = s.w / 2 + .05; cb.cyl(M.linen, r, r, .006, 0, .003, 0, 32); cb.cyl(M.linen, r + .015, r + .05, .14, 0, -.07, 0, 32, true); }
  else { cb.box(M.linen, s.w + .08, .006, s.d + .08, 0, .003, 0); cb.box(M.linen, s.w * .3, .007, s.d + .1, 0, .004, 0); }
  cb.into(cloth); cloth.position.y = top + .002; g.add(cloth); pieces.push({ obj: cloth, kind: 'cloth' });
  const spots = [];
  if (round) { const r = s.w / 2 * .6; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / n + (n === 2 ? Math.PI / 2 : 0); spots.push([Math.cos(a) * r, Math.sin(a) * r, a]); } }
  else { const per = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const side = i < per ? -1 : 1, k = side < 0 ? per : n - per, j = side < 0 ? i : i - per; spots.push([(j - (k - 1) / 2) * Math.min(.55, s.w / Math.max(1, k)), side * s.d * .28, side < 0 ? -Math.PI / 2 : Math.PI / 2]); } }
  spots.forEach(([x, z, a]) => {
    const plate = new Group(), pb = bag(); pb.cyl(M.plate, .1, .085, .014, 0, .007, 0, 24); pb.cyl(M.plate, .065, .065, .016, 0, .009, 0, 20); pb.into(plate);
    plate.position.set(x, top + .008, z); g.add(plate); pieces.push({ obj: plate, kind: 'plate' });
    const cut = new Group(), kb = bag(), tx = -Math.sin(a), tz = Math.cos(a);
    kb.box(M.cutlery, .012, .004, .16, 0, .002, 0); kb.box(M.cutlery, .022, .004, .04, 0, .002, -.07); kb.into(cut);
    const c2 = cut.clone(); cut.position.set(x + tx * .13, top + .01, z + tz * .13); c2.position.set(x - tx * .13, top + .01, z - tz * .13); cut.rotation.y = c2.rotation.y = -a + Math.PI / 2;
    g.add(cut, c2); pieces.push({ obj: cut, kind: 'cutlery' }, { obj: c2, kind: 'cutlery' });
    const glass = new Group(), gb = bag(); gb.cyl(M.tumbler, .032, .027, .095, 0, .048, 0, 14, true); gb.cyl(M.tumbler, .027, .027, .004, 0, .002, 0, 14); gb.into(glass);
    glass.position.set(x * .55 + tx * .14, top + .006, z * .55 + tz * .14); g.add(glass); pieces.push({ obj: glass, kind: 'glass' });
  });
  const candle = new Group(), kb = bag(); kb.cyl(M.tumbler, .04, .04, .08, 0, .04, 0, 16, true); kb.cyl(M.wax, .028, .028, .05, 0, .025, 0, 14); kb.into(candle);
  const flame = new Mesh(new SphereGeometry(.012, 8, 6), M.flame); flame.scale.set(1, 2, 1); flame.position.y = .07; candle.add(flame);
  candle.position.set(0, top + .006, 0); g.add(candle); pieces.push({ obj: candle, kind: 'candle', flame });
  pieces.forEach((p) => { p.rest = p.obj.position.clone(); p.restRot = p.obj.rotation.y; });
  return { group: g, pieces };
}
