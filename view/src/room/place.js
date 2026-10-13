/* The place, live: the café as a small 3D model (build.js) with a camera that feels premium (orbit, pan and zoom by mouse,
   touch and keys; presets: the terrace, inside, from above; a smooth flight to a table; a gentle drift when nobody
   touches it), the tables' states on the floor (a soft ring and glow in the state's colour, a floating label with the
   clock's minutes, a pulse when time is up, violet when a bid holds it), "the table sets itself" (a cloth floats down,
   then plates, cutlery, glasses and a candle arrive from above with a little bounce, and the table glows once), and the
   floor's edit mode (drag a table on the floor). Walls fade when they stand between the camera and what it looks at.
   createPlace(host, layout, opts) → api, or null when WebGL is not there. opts.onSlow(reason) is called when the first
   frame is very slow or the context is lost: the page shows its 2D plan instead (plan2d.js). Reduced motion: no drift,
   no pulse, flights and the setting arrive at once. ?test=1 pages: no drift either (screenshots are repeatable). */
import { WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Vector3, Vector2, Color, Plane, Raycaster, HemisphereLight, DirectionalLight, AmbientLight, PointLight, Fog,
  RingGeometry, CircleGeometry, CylinderGeometry, SphereGeometry, MeshBasicMaterial, SpriteMaterial, Sprite, AdditiveBlending, PMREMGenerator, ACESFilmicToneMapping, sRGBEncoding, PCFSoftShadowMap } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { materials, buildArchitecture, buildFixtures, buildTable, buildSetting, radial } from './build.js';
import { reachOf, snap } from '../../../seating/edit.mjs';

import { STATE_COLOURS } from './colours.js';
export { STATE_COLOURS };
const EASE = (k) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const OUT_BACK = (k) => { const c = 1.4; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const DROP = (k) => { if (k < .62) return (k / .62) * (k / .62); const u = (k - .62) / .38; return 1 - Math.sin(u * Math.PI) * .09 * (1 - u); };     // falls, lands, a small bounce
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* the inside's middle (the seating room behind the façade), in layout metres */
const insideOf = (L) => { const zs = L.zones.filter((z) => z.outdoor === false); if (!zs.length) return [L.room.w / 2, L.room.d / 2]; const x1 = Math.min(...zs.map((z) => z.rect[0])), x2 = Math.max(...zs.map((z) => z.rect[2])), z1 = Math.min(...zs.map((z) => z.rect[1])), z2 = Math.max(...zs.map((z) => z.rect[3])); return [(x1 + x2) / 2, (z1 + z2) / 2]; };
/* the camera's presets, in the world (the street is towards +z: yaw 0 looks at the façade from the street) */
/* `fit` is how much a tall stage steps the camera back to keep the whole café in frame (1: all of it; 0: not at all) */
export function presets(L, aspect = 1.6) {
  const W = L.room.w, D = L.room.d, [ix, iz] = insideOf(L), tall = aspect < 1.1;
  return {
    hero: { tx: W * .55, ty: .4, tz: -D * .46, yaw: -.38, pitch: .64, dist: Math.max(W, D) * 1.1, fit: 1 },
    /* a tall stage looks along the terrace from its left end instead of stepping far back to see all of it */
    terrace: tall ? { tx: W * .42, ty: .9, tz: -2.7, yaw: -1.02, pitch: .3, dist: 9.5, fit: 0 } : { tx: W * .52, ty: 1.35, tz: -2.8, yaw: -.18, pitch: .13, dist: W * .78, fit: 0 },
    inside: { tx: ix, ty: .5, tz: -iz, yaw: .3, pitch: .82, dist: 8.4, fit: .6 },
    above: { tx: W / 2, ty: 0, tz: -D / 2, yaw: 0, pitch: 1.45, dist: Math.max(W, D) * 1.22, fit: 1 }
  };
}
const KEYS = ['tx', 'ty', 'tz', 'yaw', 'pitch', 'dist', 'fit'];

export function createPlace(host, layout, opts = {}) {
  const reduced = !!opts.reduced, test = !!opts.test, slowMs = opts.slowMs || 2500;
  /* the clock: real time, or a fixed moment set by film(t) (a film or a contact sheet is captured frame by frame) */
  let fixedT = null; const tnow = () => (fixedT != null ? fixedT : performance.now());
  let shadows = !opts.lowPower;                                         // off on a weak device; the quality ladder turns it off when slow
  const canvas = document.createElement('canvas'); canvas.className = 'pl-canvas'; canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', opts.label || '');
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'default', preserveDrawingBuffer: test }); if (!renderer.getContext()) throw new Error('no context'); }
  catch (e) { return null; }
  let dead = false, raf = 0;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dead = true; if (raf) cancelAnimationFrame(raf); if (opts.onSlow) opts.onSlow('the GL context was lost'); }, { once: true });
  renderer.setClearColor(0x000000, 0); renderer.outputEncoding = sRGBEncoding; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = .98;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, test ? 1 : 1.6));
  renderer.shadowMap.enabled = shadows; renderer.shadowMap.type = PCFSoftShadowMap; renderer.shadowMap.autoUpdate = true;      /* frames are drawn only when something changes, so the shadow map follows them */
  host.appendChild(canvas);
  const layer = document.createElement('div'); layer.className = 'pl-layer'; layer.setAttribute('aria-hidden', 'true'); host.appendChild(layer);

  const scene = new Scene(), camera = new PerspectiveCamera(36, 1, .2, 200), M = materials();
  /* reflections only where a surface shines (chrome, steel, glass, marble): a room environment on everything floods the
     shade and the sun's shadows disappear */
  try { const pm = new PMREMGenerator(renderer), env = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
    [['chrome', .7], ['steel', .6], ['glass', .9], ['marble', .25], ['tumbler', .8], ['black', .3]].forEach(([k, i]) => { M[k].envMap = env; M[k].envMapIntensity = i; }); } catch (e) { /* without reflections */ }
  /* a warm, low sun from the street's left (a Tel Aviv morning), soft shadows fitted to the venue; a sky / ground fill */
  scene.add(new HemisphereLight(0xfff0d8, 0x9c8669, .62), new AmbientLight(0xfff1e2, .06));
  const VX = layout.room.w / 2, VZ = -layout.room.d / 2;
  const sun = new DirectionalLight(0xffd6a0, 2.5); sun.position.set(VX - 9, 9, VZ + 12); sun.target.position.set(VX, 0, VZ); scene.add(sun, sun.target);
  sun.castShadow = shadows; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  { const c = sun.shadow.camera; c.left = c.bottom = -12.5; c.right = c.top = 12.5; c.near = 2; c.far = 46; c.updateProjectionMatrix(); }
  /* the stage's light fog: the far road and the ground melt into the page's warm light */
  scene.fog = new Fog(0xece3d4, 34, 78);
  /* layout.v1's x runs along the façade from the left as seen from the street and z from the kerb inwards: a mirror of
     three.js's right-handed world. The whole place lives in a group mirrored in z, so the café is the right way round;
     the camera works in the world (the street is towards +z), and wz() turns a layout z into the world's. */
  const root = new Group(); root.scale.z = -1; scene.add(root);
  const wz = (z) => -z;
  /* a soft porcelain floor under everything, melting into the page */
  const groundMat = new MeshBasicMaterial({ map: radial('rgba(222,211,193,1)', 'rgba(222,211,193,0)'), transparent: true, depthWrite: false, toneMapped: false });
  const ground = new Mesh(new CircleGeometry(30, 48), groundMat); ground.rotation.x = -Math.PI / 2; ground.position.set(layout.room.w / 2, -.02, layout.room.d / 2); ground.renderOrder = -2; root.add(ground);

  let L = layout, arch = null, fix = null;
  const lampLights = [], lanterns = [];
  const glowTexL = radial('rgba(255,196,120,1)', 'rgba(255,196,120,0)');
  /* shadows: everything solid casts and receives; floors only receive; glass, the lanterns and small things cast none */
  function shade(g) { g.traverse((x) => { if (x.isMesh && x.material === M.contact) x.renderOrder = 10; if (!x.isMesh || !x.material || !x.material.isMeshStandardMaterial) return; x.receiveShadow = true; x.castShadow = !x.userData.floor && !x.material.userData.noCast; }); }
  function buildStatic() {
    arch = buildArchitecture(L, M); fix = buildFixtures(L, M); root.add(arch.group, fix.group); shade(arch.group); shade(fix.group);
    /* the paper lanterns: each its own mesh with a warm glow (so one can fade when it hangs between the camera and its table) and a small warm light */
    fix.lamps.forEach(([x, y, z], i) => {
      const g = new Group(); g.position.set(x, y, z);
      const mat = M.lantern.clone(); mat.transparent = true;
      const shell = new Mesh(new SphereGeometry(.21, 18, 14), mat); shell.scale.set(1, 1.35, 1);
      const cord = new Mesh(new CylinderGeometry(.004, .004, 3.1 - y - .28, 4), M.black.clone()); cord.material.transparent = true; cord.position.y = (3.1 - y + .28) / 2;
      const glow = new Sprite(new SpriteMaterial({ map: glowTexL, color: 0xffffff, transparent: true, opacity: .55, depthWrite: false, blending: AdditiveBlending, toneMapped: false })); glow.scale.set(1.5, 1.5, 1);
      g.add(shell, cord, glow); root.add(g); lanterns.push({ g, mats: [mat, cord.material], glow, k: 1, x, y, z });
      if (i < 3) { const p = new PointLight(0xffb469, .75, 6.5, 2); p.position.set(x, y - .3, z); root.add(p); lampLights.push(p); }
    });
    renderer.shadowMap.needsUpdate = true;
  }
  buildStatic();

  /* ---------- tables: furniture, a hit proxy, the ring and glow, the setting ---------- */
  const T = new Map(), tablesG = new Group(); root.add(tablesG);
  const glowTex = radial('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const proxyMat = new MeshBasicMaterial({ visible: false });
  const setOn = new Set();
  function buildTables() {
    T.forEach((o) => { tablesG.remove(o.root); o.root.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); });
    T.clear();
    L.tables.forEach((t) => {
      const root = new Group(), { group, top } = buildTable(L, t, M), reach = reachOf(t);
      root.add(group);
      const ringG = new Group(); ringG.position.set(t.x, .03, t.z); ringG.rotation.y = -(reach.round ? 0 : t.rot) * Math.PI / 180;
      const sx = reach.hw + .04, sz = reach.hd + .04, R = 1;
      const ringMat = new MeshBasicMaterial({ color: new Color(STATE_COLOURS.free).convertSRGBToLinear(), transparent: true, opacity: .9, depthWrite: false, toneMapped: false });
      const ring = new Mesh(new RingGeometry(R - .05 / Math.max(sx, sz), R, 72), ringMat); ring.rotation.x = -Math.PI / 2; ring.scale.set(sx, sz, 1); ring.renderOrder = 2;
      const glowMat = new MeshBasicMaterial({ map: glowTex, color: new Color(STATE_COLOURS.free).convertSRGBToLinear(), transparent: true, opacity: .3, depthWrite: false, toneMapped: false });
      const glow = new Mesh(new CircleGeometry(1, 40), glowMat); glow.rotation.x = -Math.PI / 2; glow.scale.set(sx + .45, sz + .45, 1); glow.position.y = -.005; glow.renderOrder = 1;
      const selMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
      const sel = new Mesh(new RingGeometry(1 - .07 / Math.max(sx, sz), 1, 72), selMat); sel.rotation.x = -Math.PI / 2; sel.scale.set(sx + .14, sz + .14, 1); sel.renderOrder = 3;
      ringG.add(glow, ring, sel); root.add(ringG);
      const proxy = new Mesh(new CylinderGeometry(1, 1, 1.2, 16), proxyMat); proxy.scale.set(Math.max(sx, sz), 1, Math.max(sx, sz)); proxy.position.set(t.x, .6, t.z); proxy.userData.id = t.id; root.add(proxy);
      shade(group);
      const setting = buildSetting(L, t, M, top); group.add(setting.group); setting.group.visible = false;
      const lab = document.createElement('div'); lab.className = 'pl-lab'; lab.dataset.id = t.id; lab.innerHTML = '<i></i><span></span>'; layer.appendChild(lab);
      const o = { t, root, group, top, ringG, ring, ringMat, glow, glowMat, sel, selMat, proxy, setting, lab, phase: 'free', colour: new Color(STATE_COLOURS.free), flash: 0, warn: false, text: '' };
      T.set(t.id, o); tablesG.add(root);
      if (setOn.has(t.id)) showSetting(o, true);
    });
    layer.querySelectorAll('.pl-lab').forEach((el) => { if (!T.has(el.dataset.id) || T.get(el.dataset.id).lab !== el) el.remove(); });
    renderer.shadowMap.needsUpdate = true;
  }
  buildTables();

  /* ---------- the camera ---------- */
  const insideCentre = () => insideOf(L);
  const hostBox = host.getBoundingClientRect(), P = presets(L, hostBox.width / Math.max(1, hostBox.height)), cur = Object.assign({}, opts.start ? P[opts.start] || P.hero : P.hero), goal = Object.assign({}, cur);
  let flight = null, lastInput = -1e9, presetName = opts.start || 'hero', W = 1, H = 1, t0 = tnow(), clock = 0;
  const target = new Vector3();
  function apply(c, drift) {
    const aspect = W / Math.max(1, H), fit = 1 + (aspect < 1.5 ? clamp(Math.pow(1.5 / aspect, .55), 1, 1.6) - 1 : 0) * clamp(c.fit == null ? 1 : c.fit, 0, 1);      // a tall stage steps back so the café still fits
    const yaw = c.yaw + (drift ? Math.sin(clock * .07) * .07 : 0), dist = c.dist * fit * (drift ? 1 + Math.sin(clock * .05) * .015 : 1), p = clamp(c.pitch, .08, 1.5);
    target.set(c.tx, c.ty, c.tz);
    camera.position.set(c.tx + Math.sin(yaw) * Math.cos(p) * dist, c.ty + Math.sin(p) * dist, c.tz + Math.cos(yaw) * Math.cos(p) * dist);
    camera.lookAt(target); camera.updateMatrixWorld();
  }
  function fly(to, ms = 1600) {
    const dest = Object.assign({}, cur, to);
    while (dest.yaw - cur.yaw > Math.PI) dest.yaw -= 2 * Math.PI; while (dest.yaw - cur.yaw < -Math.PI) dest.yaw += 2 * Math.PI;
    if (reduced || ms <= 0) { Object.assign(cur, dest); Object.assign(goal, dest); flight = null; wake(); return Promise.resolve(); }
    return new Promise((res) => { flight = { from: Object.assign({}, cur), to: dest, t0: tnow(), ms, res }; Object.assign(goal, dest); wake(); });
  }
  function tableView(id) {
    const o = T.get(id); if (!o) return null; const t = o.t, outdoor = (L.zones.find((z) => z.id === t.zone) || {}).outdoor === true || t.z < 4.05;
    const c = insideCentre(), yaw = outdoor ? (t.x < L.room.w / 2 ? -.35 : .35) : Math.atan2(c[0] - t.x, -(c[1] - t.z)) + (c[0] < t.x ? .35 : -.35);
    return { tx: t.x, ty: .55, tz: wz(t.z), yaw, pitch: outdoor ? .5 : .74, dist: outdoor ? 4.4 : 4.6, fit: .35 };
  }

  /* ---------- input ---------- */
  const pointers = new Map(); let drag = null, editing = false, selected = null, frozen = null;
  const ray = new Raycaster(), v2 = new Vector2(), floorPlane = new Plane(new Vector3(0, 1, 0), 0), hitP = new Vector3();
  const toNdc = (e) => { const r = canvas.getBoundingClientRect(); v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); return v2; };
  const pickAt = (e) => { ray.setFromCamera(toNdc(e), camera); const hit = ray.intersectObjects([...T.values()].map((o) => o.proxy), false)[0]; return hit ? hit.object.userData.id : null; };
  const floorAt = (e) => { ray.setFromCamera(toNdc(e), camera); return ray.ray.intersectPlane(floorPlane, hitP) ? [hitP.x, wz(hitP.z)] : null; };
  const touched = () => { lastInput = tnow(); if (flight) { flight.res(); flight = null; } };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus({ preventScroll: true }); touched(); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
    const id = pointers.size === 1 ? pickAt(e) : null;
    drag = { id, sx: e.clientX, sy: e.clientY, moved: false, pan: e.button === 2 || e.shiftKey || pointers.size > 1, moving: editing && id ? id : null, pinch: pointers.size === 2 ? pinchDist() : 0 };
    if (drag.moving) { const f = floorAt(e), o = T.get(id); drag.off = f ? [o.t.x - f[0], o.t.z - f[1]] : [0, 0]; }
  });
  const pinchDist = () => { const p = [...pointers.values()]; return p.length < 2 ? 0 : Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); };
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId); if (!p || !drag) return; touched();
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 5) drag.moved = true;
    if (pointers.size === 2) { const d = pinchDist(); if (drag.pinch) goal.dist = clamp(goal.dist * drag.pinch / Math.max(1, d), 2.5, 34); drag.pinch = d; panBy(dx / 2, dy / 2); }
    else if (drag.moving && drag.moved) { const f = floorAt(e); if (f) { const o = T.get(drag.moving); const x = snap(f[0] + drag.off[0]), z = snap(f[1] + drag.off[1]); moveLive(o, x, z); } }
    else if (drag.pan) panBy(dx, dy);
    else { goal.yaw -= dx * .0052; goal.pitch = clamp(goal.pitch + dy * .004, .1, 1.48); }
    wake();
  });
  const up = (e) => {
    if (!pointers.has(e.pointerId)) return; pointers.delete(e.pointerId);
    if (drag && !pointers.size) {
      if (drag.moving && drag.moved) { const o = T.get(drag.moving); if (opts.onMove) opts.onMove(drag.moving, o.liveX, o.liveZ); }
      else if (!drag.moved && drag.id && opts.onTable) opts.onTable(drag.id);
      else if (!drag.moved && !drag.id && opts.onTable && editing) opts.onTable(null);
      drag = null;
    }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); touched(); goal.dist = clamp(goal.dist * Math.exp(e.deltaY * .0012), 2.5, 34); wake(); }, { passive: false });
  canvas.addEventListener('keydown', (e) => {
    const k = e.key; let used = true; touched();
    if (editing && selected && opts.onKey && opts.onKey(e, selected)) { e.preventDefault(); return; }
    if (k === 'ArrowLeft' || k === 'ArrowRight') { if (e.shiftKey) panBy(k === 'ArrowLeft' ? 40 : -40, 0); else goal.yaw += k === 'ArrowLeft' ? .12 : -.12; }
    else if (k === 'ArrowUp' || k === 'ArrowDown') { if (e.shiftKey) panBy(0, k === 'ArrowUp' ? 40 : -40); else goal.pitch = clamp(goal.pitch + (k === 'ArrowUp' ? .08 : -.08), .1, 1.48); }
    else if (k === '+' || k === '=') goal.dist = clamp(goal.dist * .88, 2.5, 34);
    else if (k === '-' || k === '_') goal.dist = clamp(goal.dist * 1.14, 2.5, 34);
    else if (k === '1') api.view('terrace'); else if (k === '2') api.view('inside'); else if (k === '3') api.view('above');
    else used = false;
    if (used) { e.preventDefault(); wake(); }
  });
  function panBy(dx, dy) {
    const k = goal.dist * .0016, fx = -Math.sin(goal.yaw), fz = -Math.cos(goal.yaw), rx = -fz, rz = fx;      // forward on the ground, and right
    goal.tx = clamp(goal.tx - rx * dx * k + fx * dy * k, -2, L.room.w + 2); goal.tz = clamp(goal.tz - rz * dx * k + fz * dy * k, -L.room.d - 2, 3);
  }
  function moveLive(o, x, z) {
    o.liveX = x; o.liveZ = z; const dx = x - o.t.x, dz = z - o.t.z;
    o.group.position.set(x, 0, z); o.ringG.position.set(x, .03, z); o.proxy.position.set(x, .6, z); void dx; void dz; renderer.shadowMap.needsUpdate = true;
  }

  /* ---------- states and labels ---------- */
  function setRows(rows) {
    let changed = false;
    rows.forEach((r) => {
      const o = T.get(r.id); if (!o) return;
      const phase = r.phase in STATE_COLOURS ? r.phase : 'free';
      if (o.phase !== phase || o.warn !== !!r.warn) {
        o.phase = phase; o.warn = !!r.warn; o.colour.set(o.warn ? '#E25C7A' : STATE_COLOURS[phase]); const c = o.colour.clone().convertSRGBToLinear();
        o.ringMat.color.copy(c); o.glowMat.color.copy(c); o.lab.dataset.phase = phase; o.lab.classList.toggle('warn', o.warn); changed = true;
      }
      const text = r.text || ''; if (text !== o.text) { o.text = text; o.lab.lastChild.textContent = text; o.lab.classList.toggle('on', !!text); changed = true; }
    });
    if (changed) wake();                                                  // the clock's minutes change once a minute: no frame in between
  }
  function showSetting(o, instant) {
    const s = o.setting; s.group.visible = true; o.setAt = tnow();
    s.pieces.forEach((p, i) => { p.obj.position.copy(p.rest); p.obj.rotation.y = p.restRot; p.obj.scale.set(1, 1, 1); p.obj.visible = true; p.delay = p.kind === 'cloth' ? 0 : 520 + i * 62 + (p.kind === 'candle' ? 160 : 0); p.ms = p.kind === 'cloth' ? 700 : 430; });
    o.anim = instant || reduced ? null : { t0: tnow() };
    if (o.anim) s.pieces.forEach((p) => { p.obj.visible = false; });
    o.flash = instant || reduced ? 0 : 1; o.flashAt = tnow() + 1700;
  }
  function animateSetting(o, now) {
    if (!o.anim) return false; const el = frozen != null ? frozen : now - o.anim.t0; let live = false;
    o.setting.pieces.forEach((p) => {
      const k = clamp((el - p.delay) / p.ms, 0, 1); p.obj.visible = el >= p.delay;
      if (k < 1) live = true;
      if (p.kind === 'cloth') { const e = OUT_BACK(k); p.obj.position.y = p.rest.y + (1 - EASE(k)) * 1.05; p.obj.scale.set(.75 + .25 * e, 1, .75 + .25 * e); p.obj.rotation.y = p.restRot + (1 - k) * .5 * Math.sin(k * 7); p.obj.rotation.z = (1 - k) * .08 * Math.sin(k * 9); }
      else { const d = DROP(k); p.obj.position.y = p.rest.y + (1 - d) * .55; p.obj.rotation.y = p.restRot + (1 - k) * .35; }
    });
    if (!live) { o.anim = null; if (o.onSet) { o.onSet(); o.onSet = null; } }
    return live;
  }

  /* ---------- walls that stand between the camera and its target fade ---------- */
  const crosses = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
  function fades(dt) {
    let live = false; const cam = [camera.position.x, wz(camera.position.z)], tg = [cur.tx, wz(cur.tz)], high = cur.pitch > 1.25;
    arch.walls.forEach((w) => {
      const want = !high && crosses(cam, tg, w.a, w.b) ? .16 : 1; w.k = w.k == null ? want : w.k + (want - w.k) * Math.min(1, dt * 5);
      if (Math.abs(w.k - want) > .01) live = true;
      w.mats.forEach((m) => { m.opacity = (m.userData.base == null ? 1 : m.userData.base) * w.k; m.depthWrite = w.k > .98 && m.userData.base === 1; });
    });
    /* from above the awnings would hide the terrace: they thin out as the camera rises */
    const aw = clamp((1.05 - cur.pitch) / .3, .18, 1); M.awning.opacity = .9 * aw; M.awningEdge.opacity = aw; M.awningEdge.transparent = true; M.awning.depthWrite = aw > .95;
    /* a lantern hanging between the camera and what it looks at fades away */
    const tg3 = new Vector3(cur.tx, cur.ty, cur.tz), cam3 = camera.position, seg = tg3.clone().sub(cam3), len = seg.length();
    lanterns.forEach((ln) => {
      const p = new Vector3(ln.x, ln.y, wz(ln.z)), u = clamp(p.clone().sub(cam3).dot(seg) / (len * len), 0, 1), d = p.distanceTo(cam3.clone().add(seg.clone().multiplyScalar(u)));
      const want = u > .02 && u < .97 && d < .9 ? .08 : 1; ln.k += (want - ln.k) * Math.min(1, dt * 5); if (Math.abs(ln.k - want) > .01) live = true;
      ln.mats.forEach((m) => { m.opacity = ln.k; m.depthWrite = ln.k > .98; }); ln.glow.material.opacity = .55 * ln.k;
    });
    return live;
  }

  /* ---------- the frame ---------- */
  const v = new Vector3(); let firstMs = null, secondMs = null, frames = 0, lastT = tnow(), dirty = true;
  function labels() {
    const half = [W / 2, H / 2];
    T.forEach((o) => {
      if (!o.lab.classList.contains('on')) return;
      const x = o.liveX != null ? o.liveX : o.t.x, z = o.liveZ != null ? o.liveZ : o.t.z;
      v.set(x, o.top + .62, wz(z)).project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      o.lab.style.transform = 'translate(' + Math.round(half[0] + v.x * half[0]) + 'px,' + Math.round(half[1] - v.y * half[1]) + 'px) translate(-50%,-100%)';
      o.lab.style.visibility = vis ? 'visible' : 'hidden';
    });
  }
  function frame() {
    raf = 0; if (dead) return;
    const now = tnow(), dt = fixedT != null ? 1 / 25 : Math.min(.1, (now - lastT) / 1000); lastT = now; clock = (now - t0) / 1000;
    let live = false;
    if (flight) { const k = clamp((now - flight.t0) / flight.ms, 0, 1), e = EASE(k); KEYS.forEach((key) => { cur[key] = flight.from[key] + (flight.to[key] - flight.from[key]) * e; }); live = true; if (k >= 1) { const r = flight.res; flight = null; r(); } }
    else KEYS.forEach((key) => { const d = goal[key] - cur[key]; if (Math.abs(d) > 1e-4) { cur[key] += d * Math.min(1, dt * 7); live = true; } else cur[key] = goal[key]; });
    const drift = !reduced && !test && !editing && !flight && now - lastInput > 5000;
    apply(cur, drift); if (drift) live = true;
    T.forEach((o) => {
      if (animateSetting(o, now)) live = true;
      let pulse = 0;
      if ((o.phase === 'over' || o.warn) && !reduced && !test) { pulse = .5 + .5 * Math.sin(clock * 5.2); live = true; }
      if (o.flash > 0 && now >= o.flashAt) { o.flash = Math.max(0, 1 - (now - o.flashAt) / 700); live = true; }
      const f = o.flash > 0 && now >= o.flashAt ? o.flash : 0;
      o.ringMat.opacity = .92 - pulse * .45; o.glowMat.opacity = (o.phase === 'free' ? .2 : .36) + pulse * .25 + f * .6;
      o.selMat.opacity = selected === o.t.id ? .95 : 0;
    });
    if (fades(dt)) live = true;
    const r0 = performance.now(); renderer.render(scene, camera); const ms = performance.now() - r0; frames++;
    /* the quality ladder: a slow first frame with shadows turns the shadows off and tries again; still slow, the page goes 2D */
    if (firstMs == null) { firstMs = ms; if (opts.onReady) opts.onReady(ms); if (ms > slowMs && !opts.forceGL) { if (shadows) { shadows = false; renderer.shadowMap.enabled = false; sun.castShadow = false; scene.traverse((x) => { if (x.material && x.material.isMaterial) x.material.needsUpdate = true; }); live = true; } else if (opts.onSlow) opts.onSlow('the first frame took ' + Math.round(ms) + ' ms'); } }
    else if (secondMs == null && frames === 2) { secondMs = ms; if (ms > slowMs && !opts.forceGL && opts.onSlow && !shadows && firstMs > slowMs) opts.onSlow('the frames took ' + Math.round(ms) + ' ms without shadows'); }
    labels();
    if ((live || dirty) && !dead && fixedT == null) { dirty = false; raf = requestAnimationFrame(frame); }
    else if (fixedT != null) dirty = false;
  }
  function wake() { dirty = true; if (!raf && !dead) raf = requestAnimationFrame(frame); }
  function size() { const r = host.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height)); renderer.setSize(W, H, false); camera.aspect = W / H; camera.fov = W / H < .8 ? 48 : 36; camera.updateProjectionMatrix(); wake(); }
  const aspectNow = () => W / Math.max(1, H);
  const ro = window.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(host); size();

  const api = {
    canvas, layer,
    setRows,
    select(id) { if (selected !== id) { selected = id; wake(); } },
    view(name, o = {}) { const p = presets(L, aspectNow())[name]; if (!p) return Promise.resolve(); presetName = name; return fly(p, o.ms == null ? 1500 : o.ms); },
    flyTo(id, o = {}) { const tv = tableView(id); if (!tv) return Promise.resolve(); presetName = 'table'; return fly(tv, o.ms == null ? 1700 : o.ms); },
    /* "the table sets itself": → a promise that resolves when the last piece has landed */
    setTable(id, on = true, o = {}) {
      const tb = T.get(id); if (!tb) return Promise.resolve();
      if (!on) { setOn.delete(id); tb.setting.group.visible = false; tb.anim = null; wake(); return Promise.resolve(); }
      setOn.add(id); showSetting(tb, !!o.instant); wake();
      return tb.anim ? new Promise((res) => { tb.onSet = res; }) : Promise.resolve();
    },
    isSet: (id) => setOn.has(id),
    edit(on) { editing = !!on; canvas.classList.toggle('pl-edit', editing); wake(); },
    setLayout(next) {
      L = next; root.remove(arch.group, fix.group); lampLights.forEach((p) => root.remove(p)); lampLights.length = 0; lanterns.forEach((ln) => root.remove(ln.g)); lanterns.length = 0;
      [arch.group, fix.group].forEach((g) => g.traverse((x) => { if (x.geometry) x.geometry.dispose(); }));
      buildStatic(); buildTables(); [...setOn].forEach((id) => { if (!T.has(id)) setOn.delete(id); }); wake();
    },
    /* where a table's label is on screen (for tests and for the page's own overlays) */
    screenOf(id) { const o = T.get(id); if (!o) return null; v.set(o.liveX != null ? o.liveX : o.t.x, o.top, wz(o.liveZ != null ? o.liveZ : o.t.z)).project(camera); const r = canvas.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; },
    /* a film or a contact sheet: put every running table setting at `ms` after its start */
    seek(ms) { frozen = ms; T.forEach((o) => { if (!o.anim && setOn.has(o.t.id)) showSetting(o, false); }); wake(); },      /* holds every table setting at `ms` until seek(null) */
    /* a film: hold the clock at t (ms) and draw one frame now; film(null) gives the clock back */
    film(t) { if (t == null) { fixedT = null; wake(); return; } fixedT = t; if (raf) { cancelAnimationFrame(raf); raf = 0; } frame(); },
    info: () => ({ frames, firstMs, shadows, preset: presetName, cur: Object.assign({}, cur), flying: !!flight, setting: [...T.values()].some((o) => !!o.anim), set: [...setOn] }),
    wake, size,
    dispose() { dead = true; if (raf) cancelAnimationFrame(raf); if (ro) ro.disconnect(); renderer.dispose(); scene.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); canvas.remove(); layer.remove(); }
  };
  wake();
  return api;
}
