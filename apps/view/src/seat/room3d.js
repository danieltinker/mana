/* The same room, standing up: a 3D view of layout.v1 drawn with three.js r128 (the stage's own copy, bundled once by
   esbuild into a shared chunk). Loaded only when the guest taps "3D"; the 2D plan stays the page's truth and its
   fallback. Simple warm materials, one lamp, a slow drag to turn; the chosen table and area are lit in yolk. The quality
   ladder of the guest menu, in one rung: if the first frames are slow (software GL, a weak phone) the page goes back to
   2D and says nothing more about it. Metres: a table at plan (x, z) stands at (x, 0, z). */
import { Scene, PerspectiveCamera, WebGLRenderer, Color, Fog, AmbientLight, PointLight, SpotLight, Mesh, Group, PlaneGeometry, BoxGeometry, CylinderGeometry, MeshStandardMaterial, MeshBasicMaterial, Raycaster, Vector2, Vector3, sRGBEncoding } from 'three';
import { footprint, seatsOf } from './plan.js';

const COL = { floor: 0x1a110a, zone: 0x24180e, wall: 0x4a3b2e, window: 0xb7c3cc, door: 0x4a3018, top: 0x4b2f1a, leg: 0x120c08, chair: 0x5e4b39, bar: 0x2e1d10, yolk: 0xf5b120, ivory: 0xfcf8f6 };
const TABLE_H = .75, CHAIR_H = .45, WALL_H = 3;

export function createRoom(canvas, layout, opts = {}) {
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); } catch (e) { return null; }
  renderer.outputEncoding = sRGBEncoding; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const W = layout.room.w, D = layout.room.d, scene = new Scene(); scene.fog = new Fog(0x0b0907, 18, 40);
  const camera = new PerspectiveCamera(42, 1, .1, 80);
  const mat = (c, extra) => new MeshStandardMaterial(Object.assign({ color: c, roughness: .82, metalness: 0 }, extra || {}));
  const M = { floor: mat(COL.floor), zone: mat(COL.zone), wall: mat(COL.wall), window: mat(COL.window, { transparent: true, opacity: .28, roughness: .1 }), door: mat(COL.door), top: mat(COL.top, { roughness: .55 }), leg: mat(COL.leg), chair: mat(COL.chair), bar: mat(COL.bar) };
  const yolk = mat(COL.yolk, { emissive: COL.yolk, emissiveIntensity: .35, roughness: .5 }), zoneOn = mat(0x33261a, { emissive: COL.yolk, emissiveIntensity: .025 });
  const box = (sx, sy, sz, m, x, y, z, rotY) => { const o = new Mesh(new BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); if (rotY) o.rotation.y = rotY; return o; };
  const cyl = (r, h, m, x, y, z, seg) => { const o = new Mesh(new CylinderGeometry(r, r, h, seg || 28), m); o.position.set(x, y, z); return o; };
  /* floor and zones */
  const floor = new Mesh(new PlaneGeometry(W, D), M.floor); floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, D / 2); scene.add(floor);
  const zones = new Map();
  layout.zones.forEach((z) => { const [x1, z1, x2, z2] = z.rect, p = new Mesh(new PlaneGeometry(x2 - x1 - .2, z2 - z1 - .2), M.zone); p.rotation.x = -Math.PI / 2; p.position.set((x1 + x2) / 2, .005, (z1 + z2) / 2); scene.add(p); zones.set(z.id, p); });
  /* walls, the door's opening and leaf, the window */
  layout.walls.forEach((w) => {
    const [ax, az] = w.from, [bx, bz] = w.to, L = Math.hypot(bx - ax, bz - az) || 1, ang = -Math.atan2(bz - az, bx - ax);
    const seg = (a, b, m, h, y0) => scene.add(box(b - a, h || WALL_H, .12, m, ax + (bx - ax) * (a + b) / (2 * L), (y0 || 0) + (h || WALL_H) / 2, az + (bz - az) * (a + b) / (2 * L), ang));
    if (w.kind === 'door' && w.gap) {
      seg(0, w.gap[0], M.wall); seg(w.gap[1], L, M.wall); seg(w.gap[0], w.gap[1], M.wall, WALL_H - 2.1, 2.1);
      const d = w.gap[1] - w.gap[0], hx = ax + (bx - ax) * w.gap[0] / L, hz = az + (bz - az) * w.gap[0] / L, nx = -(bz - az) / L, nz = (bx - ax) / L;      // the leaf open into the room
      scene.add(box(d, 2.1, .05, M.door, hx + nx * d / 2, 1.05, hz + nz * d / 2, ang + Math.PI / 2));
    } else if (w.kind === 'window') { seg(0, L, M.wall, .9); seg(0, L, M.wall, WALL_H - 2.4, 2.4); seg(0, L, M.window, 1.5, .9); }
    else seg(0, L, M.wall);
  });
  /* tables, chairs */
  const tables = new Map(), pick = [];
  layout.tables.forEach((t) => {
    const g = new Group(), fp = footprint(t), rot = -t.rot * Math.PI / 180; g.position.set(t.x, 0, t.z); g.rotation.y = rot;
    let top;
    if (t.shape === 'round') { top = cyl(fp.r, .04, M.top, 0, TABLE_H - .02, 0); g.add(top, cyl(.05, TABLE_H, M.leg, 0, TABLE_H / 2, 0, 12), cyl(fp.r * .6, .03, M.leg, 0, .015, 0)); }
    else if (t.shape === 'bar') { top = box(fp.w + .1, .05, fp.h + .1, M.top, 0, 1.12, 0); g.add(box(fp.w, 1.1, fp.h, M.bar, 0, .55, 0), top); }
    else { top = box(fp.w, .04, fp.h, M.top, 0, TABLE_H - .02, 0); g.add(top); [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => g.add(box(.05, TABLE_H - .04, .05, M.leg, sx * (fp.w / 2 - .08), (TABLE_H - .04) / 2, sz * (fp.h / 2 - .08))))); }
    seatsOf(t).forEach(([sx, sz, a]) => {
      if (t.shape === 'bar') { g.add(cyl(.16, .06, M.chair, sx, .7, sz, 16), cyl(.03, .7, M.leg, sx, .35, sz, 8)); return; }
      const rad = a * Math.PI / 180, out = t.shape === 'round' ? [sx / (Math.hypot(sx, sz) || 1), sz / (Math.hypot(sx, sz) || 1)] : [-Math.sin(rad), Math.cos(rad)], yaw = -Math.atan2(out[1], out[0]) + Math.PI / 2;
      g.add(box(.42, .06, .42, M.chair, sx, CHAIR_H - .03, sz, yaw), box(.42, .5, .04, M.chair, sx + .19 * out[0], CHAIR_H + .22, sz + .19 * out[1], yaw));
    });
    top.userData.id = t.id; pick.push(top); tables.set(t.id, { g, top, dim: false });
    scene.add(g);
  });
  /* light: one warm lamp over the room, a little fill so the far walls read */
  scene.add(new AmbientLight(0x6a5a48, .55));
  const lamp = new PointLight(0xffd29a, 1.1, 40, 1.6); lamp.position.set(W / 2, 3.2, D / 2); scene.add(lamp);
  const spot = new SpotLight(0xffc46a, 0, 12, .5, .6, 1.4); spot.position.set(0, 4, 0); scene.add(spot); scene.add(spot.target);
  /* the camera: a slow turn around the room's middle, pitched down; a drag turns it, nothing loops */
  let yaw = -.35, pitch = .92, dist = Math.max(W, D) * 1.15, w0 = 1, h0 = 1, dirty = true;
  const target = new Vector3(W / 2, .4, D / 2);
  function place() { camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist); camera.lookAt(target); dirty = true; }
  function size() { const r = canvas.getBoundingClientRect(); w0 = Math.max(1, Math.round(r.width)); h0 = Math.max(1, Math.round(r.height)); renderer.setSize(w0, h0, false); camera.aspect = w0 / h0; camera.updateProjectionMatrix(); dist = Math.max(W, D) * (w0 < h0 ? 1.55 : 1.1); place(); }
  size(); place();
  /* state → colours */
  let state = { zone: null, table: null, fitTables: null };
  function update(s) {
    state = s;
    layout.zones.forEach((z) => { zones.get(z.id).material = s.zone === z.id ? zoneOn : M.zone; });
    layout.tables.forEach((t) => { const e = tables.get(t.id); e.dim = !(t.bookable && (!s.fitTables || s.fitTables.has(t.id))); });
    if (s.table) { const t = layout.tables.find((x) => x.id === s.table); spot.intensity = 1.6; spot.position.set(t.x, 3.6, t.z); spot.target.position.set(t.x, 0, t.z); } else spot.intensity = 0;
    dirty = true;
  }
  /* dim tables that do not fit: a darker top (materials are shared, so each dim table gets its own) */
  const dimTop = mat(0x2a1c10, { roughness: .9 });
  function paint() { layout.tables.forEach((t) => { const e = tables.get(t.id); if (state.table === t.id) e.top.material = yolk; else e.top.material = e.dim ? dimTop : M.top; }); }
  /* draw: only when something changed; the first ten frames are timed for the ladder */
  const times = []; let raf = 0, dead = false;
  function frame() {
    raf = 0; if (dead) return;
    if (dirty) { dirty = false; paint(); const t0 = performance.now(); renderer.render(scene, camera); const dt = performance.now() - t0; if (times.length < 10 && opts.onSlow) { times.push(dt); const avg = times.reduce((a, b) => a + b, 0) / times.length; if ((times.length === 1 && dt > 400) || (times.length === 10 && avg > 70)) opts.onSlow(avg); } else if (times.length < 10) times.push(dt); }      // one rung of the ladder: a very slow first frame, or ten slow ones, and the page is back on the 2D plan
    if (dirty) raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf && !dead) raf = requestAnimationFrame(frame); }
  /* a drag turns the room; a tap picks a table */
  let p = null;
  const ray = new Raycaster(), v2 = new Vector2();
  canvas.addEventListener('pointerdown', (e) => { if (e.button) return; p = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw, pitch, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!p || e.pointerId !== p.id) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; if (Math.abs(dx) + Math.abs(dy) > 4) p.moved = true; yaw = p.yaw - dx * .006; pitch = Math.min(1.35, Math.max(.35, p.pitch + dy * .005)); place(); wake(); });
  const end = (e) => { if (!p || e.pointerId !== p.id) return; const moved = p.moved; p = null; if (moved || !opts.onTable) return; const r = canvas.getBoundingClientRect(); v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(v2, camera); const hit = ray.intersectObjects(pick, false)[0]; if (hit) opts.onTable(hit.object.userData.id); };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', () => { p = null; });
  /* the first look: the camera settles from a little further, once (600 ms); reduced motion: it is simply there */
  if (!opts.reduce) { const d0 = dist; let t0 = 0; const ease = (k) => 1 - Math.pow(1 - k, 3); const go = (now) => { if (!t0) t0 = now; const k = Math.min(1, (now - t0) / 600); dist = d0 * (1.18 - .18 * ease(k)); place(); frame(); if (k < 1 && !dead) requestAnimationFrame(go); }; requestAnimationFrame(go); }
  const ro = window.ResizeObserver ? new ResizeObserver(() => { size(); wake(); }) : null; if (ro) ro.observe(canvas);
  return {
    update(s) { update(s); wake(); }, wake, size,
    dispose() { dead = true; if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); renderer.dispose(); scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); },
    info: () => ({ frames: times.slice(), w: w0, h: h0, yaw, pitch })
  };
}
