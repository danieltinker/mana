/* The Olea room as a small porcelain object: a rounded, thick, frosted-white slab a little larger than the room; on it the
   room's floor, pale zones, low walls (the window wall as clear glass with a bright edge, the door as a gap with an oak
   threshold), and the furniture: white table tops with a thin oak edge, light grey chairs, a pale bar counter. Static
   parts are merged by material, so the whole room is a handful of draw calls. Metres; the room's middle is the origin
   and the slab's top is y = 0. The plan maths (footprints, where chairs stand) is the seat demo's (view/src/seat/plan.js). */
import { BufferGeometry, BufferAttribute, BoxGeometry, CylinderGeometry, ShapeGeometry, ExtrudeGeometry, Shape, Matrix4, Euler, Quaternion, Vector3, Mesh, Group, Color, MeshStandardMaterial, MeshPhysicalMaterial } from 'three';
import { footprint, seatsOf } from '../../../../view/src/seat/plan.js';

export const TABLE_H = .74, WALL_H = 1.0, WALL_T = .14, MARGIN = 1.0, SLAB_T = .5;
const lin = (hex) => new Color(hex).convertSRGBToLinear();

/* positions + normals of many geometries, each placed by a matrix, as one non-indexed geometry */
function merge(parts) {
  let n = 0; const flat = parts.map(([g, m]) => { const ng = g.index ? g.toNonIndexed() : g; ng.applyMatrix4(m); n += ng.attributes.position.count; return ng; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  flat.forEach((g) => { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; g.dispose(); });
  parts.forEach(([g]) => g.dispose());
  const out = new BufferGeometry(); out.setAttribute('position', new BufferAttribute(pos, 3)); out.setAttribute('normal', new BufferAttribute(nor, 3));
  out.computeBoundingSphere(); return out;
}
const M4 = (x, y, z, ry = 0, rx = 0) => new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(rx, ry, 0)), new Vector3(1, 1, 1));
function rounded(w, h, r) {
  const s = new Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}

export function buildRoom(layout, { quality = 1 } = {}) {
  const W = layout.room.w, D = layout.room.d, X = (x) => x - W / 2, Z = (z) => z - D / 2, seg = quality < 1 ? 20 : 32;
  const mat = {
    slab: new MeshPhysicalMaterial({ color: lin(0xfbfaf7), roughness: .38, metalness: 0, clearcoat: .55, clearcoatRoughness: .32 }),
    slabSide: new MeshPhysicalMaterial({ color: lin(0xebe7e1), roughness: .22, metalness: 0, clearcoat: .9, clearcoatRoughness: .12 }),
    floor: new MeshStandardMaterial({ color: lin(0xede7de), roughness: .8, metalness: 0 }),
    wall: new MeshStandardMaterial({ color: lin(0xfbfaf8), roughness: .5, metalness: 0 }),
    glass: new MeshPhysicalMaterial({ color: lin(0xb3d3ea), roughness: .05, metalness: 0, transparent: true, opacity: .55, clearcoat: 1, clearcoatRoughness: .05, depthWrite: false }),
    edge: new MeshStandardMaterial({ color: lin(0xffffff), emissive: lin(0xdff0ff), emissiveIntensity: .8, roughness: .2 }),
    oak: new MeshStandardMaterial({ color: lin(0xc08b57), roughness: .5, metalness: 0 }),
    top: new MeshStandardMaterial({ color: lin(0xfefdfb), roughness: .3, metalness: 0 }),
    chair: new MeshStandardMaterial({ color: lin(0xd2cfca), roughness: .6, metalness: 0 }),
    leg: new MeshStandardMaterial({ color: lin(0xcfccc6), roughness: .45, metalness: .1 }),
    counter: new MeshStandardMaterial({ color: lin(0xf0ebe3), roughness: .5, metalness: 0 })
  };
  Object.keys(mat).forEach((k) => { mat[k].envMapIntensity = .5; }); mat.glass.envMapIntensity = 1.4; mat.slab.envMapIntensity = .7;
  const zoneTint = { window: 0xdde9f5, hall: 0xf4e8d2, bar: 0xf4ded7, corner: 0xdbebe0 };
  const root = new Group();

  /* the slab: a rounded tile with a soft bevel; its top face at y = 0 */
  const sw = W + 2 * MARGIN, sd = D + 2 * MARGIN, bev = .14;
  const slabG = new ExtrudeGeometry(rounded(sw - 2 * bev, sd - 2 * bev, 1.1), { depth: SLAB_T - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: quality < 1 ? 3 : 5, curveSegments: quality < 1 ? 10 : 16 });
  slabG.rotateX(-Math.PI / 2); slabG.translate(0, -SLAB_T + bev, 0);
  const slab = new Mesh(slabG, [mat.slab, mat.slabSide]); slab.receiveShadow = true; root.add(slab);

  /* the room's floor (a thin plate) and its zones */
  const floor = new Mesh(new BoxGeometry(W + WALL_T, .03, D + WALL_T), mat.floor); floor.position.y = .015; floor.receiveShadow = true; root.add(floor);
  layout.zones.forEach((z) => {
    const [x1, z1, x2, z2] = z.rect, inset = .16, g = new ShapeGeometry(rounded(x2 - x1 - 2 * inset, z2 - z1 - 2 * inset, .34), 6);
    g.rotateX(-Math.PI / 2); g.translate(X((x1 + x2) / 2), .032, Z((z1 + z2) / 2));
    const m = new Mesh(g, new MeshStandardMaterial({ envMapIntensity: .5, color: lin(zoneTint[z.id] || 0xf4efe7), roughness: .8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    m.receiveShadow = true; root.add(m);
  });

  /* walls, the window, the door's gap */
  const walls = [], glass = [], edges = [], oak = [];
  layout.walls.forEach((w) => {
    const [ax, az] = w.from, [bx, bz] = w.to, L = Math.hypot(bx - ax, bz - az) || 1, ang = -Math.atan2(bz - az, bx - ax);
    const at = (a, b) => [X(ax + (bx - ax) * (a + b) / (2 * L)), Z(az + (bz - az) * (a + b) / (2 * L))];
    const piece = (list, a, b, h, y0, t) => { const [cx, cz] = at(a, b); list.push([new BoxGeometry(b - a + (t || WALL_T), h, t || WALL_T), M4(cx, (y0 || 0) + h / 2 + .03, cz, ang)]); };
    if (w.kind === 'door' && w.gap) {
      piece(walls, 0, w.gap[0], WALL_H); piece(walls, w.gap[1], L, WALL_H);
      const [cx, cz] = at(w.gap[0], w.gap[1]); oak.push([new BoxGeometry(w.gap[1] - w.gap[0] - WALL_T, .012, WALL_T + .06), M4(cx, .036, cz, ang)]);
    } else if (w.kind === 'window') {
      piece(walls, 0, L, .12, 0);                                                 // a low sill
      const [cx, cz] = at(0, L);
      glass.push([new BoxGeometry(L - WALL_T, WALL_H - .12, .05), M4(cx, .12 + (WALL_H - .12) / 2 + .03, cz, ang)]);
      edges.push([new BoxGeometry(L + WALL_T, .035, .07), M4(cx, WALL_H + .03, cz, ang)]);
      [0, L / 3, 2 * L / 3, L].forEach((a) => { const [mx, mz] = at(a, a); edges.push([new BoxGeometry(.05, WALL_H - .12, .06), M4(mx, .12 + (WALL_H - .12) / 2 + .03, mz, ang)]); });
    } else piece(walls, 0, L, WALL_H);
  });

  /* tables and chairs */
  const tops = [], legs = [], chairs = [], counter = [], anchors = [];
  layout.tables.forEach((t) => {
    const fp = footprint(t), cx = X(t.x), cz = Z(t.z), ry = -t.rot * Math.PI / 180, base = M4(cx, .03, cz, ry);
    const put = (list, g, x, y, z, r) => list.push([g, base.clone().multiply(M4(x, y, z, r || 0))]);
    if (t.shape === 'round') {
      put(oak, new CylinderGeometry(fp.r, fp.r, .045, seg), 0, TABLE_H - .03, 0);
      put(tops, new CylinderGeometry(fp.r - .018, fp.r - .018, .012, seg), 0, TABLE_H - .002, 0);
      put(legs, new CylinderGeometry(.035, .035, TABLE_H - .05, 10), 0, (TABLE_H - .05) / 2, 0);
      put(legs, new CylinderGeometry(fp.r * .5, fp.r * .55, .025, seg), 0, .0125, 0);
    } else if (t.shape === 'bar') {
      put(counter, new BoxGeometry(fp.w, 1.02, fp.h), 0, .51, 0);
      put(oak, new BoxGeometry(fp.w + .12, .045, fp.h + .14), 0, 1.04, 0);
      put(tops, new BoxGeometry(fp.w + .08, .012, fp.h + .1), 0, 1.066, 0);
    } else {
      put(oak, new BoxGeometry(fp.w, .045, fp.h), 0, TABLE_H - .03, 0);
      put(tops, new BoxGeometry(fp.w - .036, .012, fp.h - .036), 0, TABLE_H - .002, 0);
      [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => put(legs, new BoxGeometry(.035, TABLE_H - .05, .035), sx * (fp.w / 2 - .07), (TABLE_H - .05) / 2, sz * (fp.h / 2 - .07))));
    }
    seatsOf(t).forEach(([sx, sz, a]) => {
      if (t.shape === 'bar') { put(chairs, new CylinderGeometry(.17, .17, .05, 18), sx, .74, sz); put(legs, new CylinderGeometry(.022, .022, .72, 8), sx, .36, sz); put(legs, new CylinderGeometry(.15, .16, .02, 18), sx, .01, sz); return; }
      const out = t.shape === 'round' ? [sx / (Math.hypot(sx, sz) || 1), sz / (Math.hypot(sx, sz) || 1)] : [-Math.sin(a * Math.PI / 180), Math.cos(a * Math.PI / 180)];
      const yaw = Math.atan2(out[0], out[1]), c = new Matrix4().compose(new Vector3(sx, 0, sz), new Quaternion().setFromEuler(new Euler(0, yaw, 0)), new Vector3(1, 1, 1));
      const part = (list, g, x, y, z) => list.push([g, base.clone().multiply(c).multiply(M4(x, y, z))]);
      part(chairs, new BoxGeometry(.42, .05, .4), 0, .45, 0);                             // seat
      part(chairs, new BoxGeometry(.42, .36, .045), 0, .66, .18);                         // back, on the side away from the table
      [-1, 1].forEach((lx) => [-1, 1].forEach((lz) => part(legs, new BoxGeometry(.025, .43, .025), lx * .17, .215, lz * .16)));
    });
    anchors.push({ id: t.id, x: cx, z: cz, top: t.shape === 'bar' ? 1.07 : TABLE_H, r: t.shape === 'round' ? fp.r : Math.hypot(fp.w, fp.h) / 2, w: fp.w, h: fp.h, shape: t.shape });
  });

  const add = (list, m, cast = true) => { if (!list.length) return null; const mesh = new Mesh(merge(list), m); mesh.castShadow = cast; mesh.receiveShadow = true; root.add(mesh); return mesh; };
  add(walls, mat.wall); add(glass, mat.glass, false); add(edges, mat.edge, false); add(oak, mat.oak); add(tops, mat.top); add(legs, mat.leg); add(chairs, mat.chair); add(counter, mat.counter);
  return { root, anchors, mats: mat, size: { w: sw, d: sd, W, D } };
}
