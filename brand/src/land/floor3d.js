/* "Your place": the Olea room as a small porcelain object floating in light, slowly orbiting, with the table clocks running.
   Every seated table has a time frame; a thin ring above it runs down, a glass label says the minutes left; at five minutes
   the ring turns ember and breathes; when the time is up it turns rose, the manager gets a toast, and the table frees.
   Contract (shared brief): mountFloor(host, { lang, reduced, lowPower, onReady, onFail }) → { pause, resume, setLang, destroy }
   or null when WebGL is not there. The canvas is transparent; labels and the toast are HTML inside host (crisp, in the page's
   language). A horizontal drag turns the room (with inertia); vertical moves are left to the page's scroll (touch-action:
   pan-y). After 3 s untouched the orbit comes back. reduced: one still frame (and on resize), no toasts. No requests: the
   room is bundled (seating/fixtures/olea.layout.json, an invented room). */
import { WebGLRenderer, Scene, PerspectiveCamera, Group, Object3D, Vector3, Color, HemisphereLight, DirectionalLight, PMREMGenerator, ACESFilmicToneMapping, sRGBEncoding, PCFSoftShadowMap } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import layout from '../../../seating/fixtures/olea.layout.json';
import { buildRoom, SLAB_T } from './floor/room.js';
import { makeRing, makeDot, makePool, makeGroundShadow, disposeShared, STATE } from './floor/fx.js';
import { createSim } from './floor/sim.js';

const WORDS = { he: { up: 'הזמן נגמר', table: 'שולחן', bar: 'בר' }, en: { up: 'Time is up', table: 'Table', bar: 'Bar' } };
const ORBIT = 2 * Math.PI / 52, IDLE_MS = 3000, FLOAT_S = 6.5, ELEV = 37 * Math.PI / 180, FOV = 30;
const RING_LIFT = .5, GROUND = -2.3;
const SC = {}; Object.keys(STATE).forEach((k) => { SC[k] = new Color(STATE[k]); });
const BELL = '<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.6 1.8H4.9z"/><path d="M10.2 20.6a2 2 0 0 0 3.6 0"/></svg>';
const CSS = `
.mf-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab;-webkit-tap-highlight-color:transparent;outline:none}
.mf-canvas.mf-grab{cursor:grabbing}
.mf-still *{transition:none!important}
.mf-layer{position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:"IBM Plex Sans Hebrew",system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.mf-lab{position:absolute;left:0;top:0;display:flex;align-items:center;gap:5px;padding:2px 8px 2px 6px;border-radius:999px;direction:ltr;white-space:nowrap;
 background:linear-gradient(135deg,rgba(255,255,255,.86),rgba(255,255,255,.6));-webkit-backdrop-filter:blur(10px) saturate(170%);backdrop-filter:blur(10px) saturate(170%);
 border:1px solid rgba(255,255,255,.9);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 10px 20px -12px rgba(70,45,20,.38),0 1px 3px rgba(70,45,20,.07);
 color:#16120E;font-weight:600;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;letter-spacing:.01em;opacity:0;transition:opacity .6s cubic-bezier(.2,.8,.2,1),color .6s,background .6s;will-change:transform}
.mf-lab i{display:block;width:6px;height:6px;border-radius:50%;background:var(--c);box-shadow:0 0 0 2.5px var(--h)}
.mf-lab.mf-on{opacity:1}
.mf-lab.mf-soon{color:#B4471A}
.mf-lab.mf-up{color:#fff;background:linear-gradient(135deg,rgba(234,104,136,.94),rgba(226,92,122,.86));border-color:rgba(255,214,224,.9);box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 10px 22px -10px rgba(226,92,122,.6)}
.mf-lab.mf-up i{background:#fff;box-shadow:0 0 0 2.5px rgba(255,255,255,.35)}
.mf-sm .mf-lab{font-size:11px;line-height:16px;padding:1px 7px 1px 5px;gap:4px}
.mf-toast{position:absolute;top:14px;inset-inline-start:14px;display:flex;align-items:center;gap:9px;padding:6px 14px 6px 6px;border-radius:999px;max-width:calc(100% - 28px);
 background:linear-gradient(135deg,rgba(255,255,255,.84),rgba(255,255,255,.56));-webkit-backdrop-filter:blur(18px) saturate(170%);backdrop-filter:blur(18px) saturate(170%);
 border:1px solid rgba(255,255,255,.9);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 18px 36px -18px rgba(70,45,20,.35),0 2px 6px rgba(70,45,20,.06);
 color:#16120E;font-size:13px;line-height:20px;font-weight:500;opacity:0;transform:translateY(-10px) scale(.96);transition:opacity .24s cubic-bezier(.2,.8,.2,1),transform .6s cubic-bezier(.34,1.36,.64,1)}
.mf-toast.mf-on{opacity:1;transform:none}
.mf-toast b{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;flex:none;color:#fff;background:linear-gradient(135deg,#EE7A96,#E25C7A);box-shadow:0 4px 12px -4px rgba(226,92,122,.7)}
.mf-toast span{font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-sm .mf-toast{top:10px;inset-inline-start:10px;font-size:12px;padding:5px 12px 5px 5px;gap:7px}
.mf-sm .mf-toast b{width:22px;height:22px}
`;
let styleRefs = 0, styleEl = null;
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export async function mountFloor(host, opts = {}) {
  const fail = (e) => { try { if (opts.onFail) opts.onFail(e); } catch (x) { /* the page's handler */ } return null; };
  const reduced = !!opts.reduced, low = !!opts.lowPower, dbg = opts.debug || {};
  let lang = opts.lang === 'en' ? 'en' : 'he';
  const canvas = document.createElement('canvas'); canvas.className = 'mf-canvas'; canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: low ? 'low-power' : 'default' });
    if (!renderer.getContext()) throw new Error('no WebGL context');
  } catch (e) { return fail(e); }
  try {                                                                       // anything that breaks while building: null, onFail, nothing left behind
  if (!styleRefs++) { styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl); }
  renderer.setClearColor(0x000000, 0); renderer.outputEncoding = sRGBEncoding; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = .98;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.5 : 1.75));
  if (!low) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFSoftShadowMap; renderer.shadowMap.autoUpdate = true; }
  host.appendChild(canvas);
  const layer = document.createElement('div'); layer.className = 'mf-layer' + (reduced ? ' mf-still' : ''); layer.setAttribute('aria-hidden', 'true'); host.appendChild(layer);

  /* the scene: light, the slab and its room, the shadow on the ground */
  const scene = new Scene(), camera = new PerspectiveCamera(FOV, 1, .5, 120);
  const pmrem = new PMREMGenerator(renderer), env = pmrem.fromScene(new RoomEnvironment(), .04).texture; pmrem.dispose();
  scene.environment = env;
  scene.add(new HemisphereLight(0xffffff, 0xf1e6d8, .22));
  const key = new DirectionalLight(0xfff4e6, 2.3); key.position.set(-8, 15, 7); scene.add(key); scene.add(key.target);
  if (!low) { key.castShadow = true; key.shadow.mapSize.set(1024, 1024); const c = key.shadow.camera; c.left = c.bottom = -11; c.right = c.top = 11; c.near = 4; c.far = 40; key.shadow.bias = -.0006; key.shadow.normalBias = .02; }
  const room = buildRoom(layout, { quality: low ? .5 : 1 });
  const floatG = new Group(), spinG = new Group(); floatG.add(spinG); spinG.add(room.root); scene.add(floatG);
  const ground = makeGroundShadow(room.size.w * 1.02, room.size.d * 1.02); ground.mesh.position.y = GROUND; scene.add(ground.mesh);

  /* the clocks: per table a ring, a dot, a colour pool and a label anchor; labels are HTML */
  const sim = createSim(layout);
  const marks = room.anchors.map((a, i) => {
    const t = layout.tables[i], live = t.bookable && t.shape !== 'bar';
    const ringR = Math.min(1.0, Math.max(.52, (t.shape === 'long' ? Math.max(a.w, a.h) * .36 : a.r) + .2));
    const ring = makeRing(ringR); ring.mesh.position.set(a.x, a.top + RING_LIFT, a.z);
    const dot = makeDot(); dot.sprite.position.set(a.x, a.top + .24, a.z);
    const pool = makePool(Math.max(1.1, a.r + .8)); pool.mesh.position.set(a.x, .036, a.z);
    if (t.shape === 'long') pool.mesh.scale.set(1.15, .7, 1);
    const anchor = new Object3D(); anchor.position.set(a.x, a.top + RING_LIFT, a.z);
    if (live) { room.root.add(ring.mesh, dot.sprite, pool.mesh, anchor); }
    let lab = null;
    if (live) { lab = document.createElement('div'); lab.className = 'mf-lab'; lab.innerHTML = '<i></i><span></span>'; layer.appendChild(lab); }
    return { id: t.id, live, ring, ringR, dot, pool, anchor, lab, txt: lab && lab.lastChild, shown: '', cls: '', c: { ring: new Color(STATE.seated), ringA: 0, dotA: 0, poolA: 0, dot: new Color(STATE.free), pool: new Color(STATE.free), labA: 0 } };
  });
  const toast = document.createElement('div'); toast.className = 'mf-toast'; toast.innerHTML = '<b>' + BELL + '</b><span></span>'; layer.appendChild(toast);
  let toastNo = 0;
  function toastText() { const w = WORDS[lang]; toast.lastChild.textContent = w.up + ' · ' + w.table + ' ' + toastNo; }
  function setDir() { layer.setAttribute('dir', lang === 'he' ? 'rtl' : 'ltr'); layer.setAttribute('lang', lang); }
  setDir();

  /* the camera: fixed, about 37° above; the slab turns. fit() finds the distance that frames the slab at every turn */
  let W = 1, H = 1, dist = 40, aimY = 0, yaw = dbg.yaw != null ? +dbg.yaw : -.5, vel = 0, orbitK = reduced || dbg.freeze ? 0 : 1, userAt = -1e9, time = 0, floatY = 0;
  const pts = []; { const hw = room.size.w / 2, hd = room.size.d / 2; [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => { pts.push(new Vector3(sx * hw, -SLAB_T, sz * hd), new Vector3(sx * hw, 1.9, sz * hd), new Vector3(sx * hw * .9, GROUND, sz * hd * .9)); })); }
  const v = new Vector3();
  function place() { camera.position.set(0, aimY + Math.sin(ELEV) * dist, Math.cos(ELEV) * dist); camera.lookAt(0, aimY, 0); camera.updateMatrixWorld(); }
  function fit() {
    camera.aspect = W / H; camera.fov = FOV * (W / H < .95 ? 1.12 : 1); camera.updateProjectionMatrix();
    const mx = W < 520 ? .99 : .97, my = W < 520 ? .95 : .93;      // the slab fills its stage (integrator: it read small inside the card)
    for (let k = 0; k < 7; k++) {
      place(); let ax = 0, y0 = 1, y1 = -1;
      for (let s = 0; s < 16; s++) { const c = Math.cos(s * Math.PI / 8), sn = Math.sin(s * Math.PI / 8); pts.forEach((p) => { v.set(p.x * c + p.z * sn, p.y, -p.x * sn + p.z * c).project(camera); ax = Math.max(ax, Math.abs(v.x)); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }); }
      dist *= Math.max(ax / mx, (y1 - y0) / (2 * my));
      aimY += ((y1 + y0) / 2) * dist * Math.tan(camera.fov * Math.PI / 360) / Math.cos(ELEV) * .9;
    }
    place();
  }
  function size() {
    const r = host.getBoundingClientRect(); W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false); layer.classList.toggle('mf-sm', W < 520); fit();
  }

  /* state → light: colours and strengths ease towards the sim's view */
  const PULSE = { soon: 1.6, up: .9 };
  function paint(dt, still) {
    const view = sim.view(), k = still ? 1 : 1 - Math.exp(-dt * 5);
    view.forEach((s, i) => {
      const m = marks[i]; if (!m.live) return;
      const ringOn = s.st === 'seated' || s.st === 'soon' || s.st === 'up', col = STATE[s.st] || STATE.free;
      const target = { ringA: ringOn ? 1 : 0, dotA: s.st === 'free' || s.st === 'reserved' ? 1 : 0, poolA: { free: .18, seated: .2, soon: .3, up: .38, reserved: .24 }[s.st] || .2 };
      const cc = SC[s.st] || SC.free; m.c.ring.lerp(cc, k); m.c.dot.lerp(cc, k); m.c.pool.lerp(cc, k);
      m.c.ringA += (target.ringA - m.c.ringA) * k; m.c.dotA += (target.dotA - m.c.dotA) * k; m.c.poolA += (target.poolA - m.c.poolA) * k;
      const pulse = still || !PULSE[s.st] ? (s.st === 'up' ? 1 : 0) : .5 + .5 * Math.sin(time * 2 * Math.PI / PULSE[s.st]);
      m.ring.set(m.c.ring, s.st === 'up' ? 1 : ringOn ? s.frac : m.ring.mesh.material.uniforms.uFrac.value, m.c.ringA * (s.st === 'up' ? .7 + .3 * pulse : 1), pulse, s.st === 'soon' ? .32 + .22 * pulse : .16);
      m.dot.set(m.c.dot, m.c.dotA * .95); m.pool.set(m.c.pool, m.c.poolA * (1 + (s.st === 'up' || s.st === 'soon' ? .35 * pulse : 0)));
      const txt = s.st === 'up' ? '0′' : ringOn ? s.left + '′' : '', cls = 'mf-lab' + (ringOn ? ' mf-on' : '') + (s.st === 'soon' ? ' mf-soon' : '') + (s.st === 'up' ? ' mf-up' : '');
      if (txt && txt !== m.shown) { m.txt.textContent = txt; m.shown = txt; }
      if (cls !== m.cls) { m.lab.className = cls; m.cls = cls; m.lab.style.setProperty('--c', col); m.lab.style.setProperty('--h', rgba(col, .22)); }
    });
    const t = reduced ? null : sim.toast();
    if (t && t.no !== toastNo) { toastNo = t.no; toastText(); toast.classList.add('mf-on'); }
    else if (!t && toastNo) { toastNo = 0; toast.classList.remove('mf-on'); }
  }
  function placeLabels() {
    marks.forEach((m) => {
      if (!m.live) return;
      m.anchor.getWorldPosition(v); v.y += .12; v.z -= m.ringR + .14; v.project(camera);
      const x = (v.x * .5 + .5) * W, y = (-v.y * .5 + .5) * H;
      m.lab.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-100%)`;
    });
  }

  /* one frame */
  const stats = { first: 0, frames: 0, renderMs: 0, intervals: [] }, t0 = performance.now();
  function draw(dt, still) {
    paint(dt, still);
    floatY = reduced || dbg.freeze ? 0 : Math.sin(time * 2 * Math.PI / FLOAT_S) * .16;
    floatG.position.y = floatY; floatG.rotation.x = reduced || dbg.freeze ? 0 : Math.sin(time * 2 * Math.PI / (FLOAT_S * 1.7)) * .012; floatG.rotation.z = reduced || dbg.freeze ? 0 : Math.cos(time * 2 * Math.PI / (FLOAT_S * 1.3)) * .01;
    spinG.rotation.y = yaw; ground.mesh.rotation.z = yaw; marks.forEach((m) => { m.ring.mesh.rotation.z = -yaw; });      // a clock's 12 stays at the back, as seen from the camera
    const lift = (floatY / .16 + 1) / 2; ground.mat.opacity = .34 - .08 * lift; ground.mesh.scale.setScalar(1 + .04 * lift);
    const r0 = performance.now(); renderer.render(scene, camera); placeLabels(); const r1 = performance.now();
    stats.frames++; stats.renderMs += r1 - r0; if (!stats.first) { stats.first = r1 - t0; if (opts.onReady) setTimeout(() => opts.onReady(), 0); }
  }

  /* motion: orbit, inertia, the float, the sim clock */
  let raf = 0, last = 0, paused = false, dead = false;
  if (dbg.t) sim.advance(+dbg.t); else if (reduced) sim.advance(4.5);      // reduced: a moment with one table ending soon
  if (dbg.t || reduced) time = dbg.t ? +dbg.t : 0;
  function frame(now) {
    raf = 0; if (dead || paused) return;
    const dt = last ? Math.min(.1, (now - last) / 1000) : 1 / 60; if (last) stats.intervals.push(now - last); if (stats.intervals.length > 240) stats.intervals.shift(); last = now;
    if (!dbg.freeze) { time += dt; sim.advance(dt); }
    const idle = performance.now() - userAt > IDLE_MS;
    if (!drag) { yaw += vel * dt; vel *= Math.exp(-dt * 2.6); if (Math.abs(vel) < .002) vel = 0; }
    orbitK += ((idle && !drag && !dbg.freeze ? 1 : 0) - orbitK) * (1 - Math.exp(-dt * (idle ? .9 : 6)));
    yaw += ORBIT * orbitK * dt;
    try { draw(dt, false); } catch (e) { dead = true; fail(e); return; }
    raf = requestAnimationFrame(frame);
  }
  function still() { if (dead) return; try { draw(0, true); } catch (e) { dead = true; fail(e); } }
  const wake = () => { if (!raf && !dead && !paused && !reduced) { last = 0; raf = requestAnimationFrame(frame); } };

  /* drag to turn: horizontal only; a mostly vertical move is the page's scroll */
  let drag = null;
  const K = () => 5.2 / Math.max(320, W);      // radians per pixel: a full stage width turns it about 300°
  function down(e) { if (e.button || !e.isPrimary) return; drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, t: performance.now(), on: e.pointerType === 'mouse' }; if (drag.on) { try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* fine */ } canvas.classList.add('mf-grab'); } }
  function move(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on) {
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0; if (Math.abs(dx) + Math.abs(dy) < 8) return;
      if (Math.abs(dy) >= Math.abs(dx)) { drag = null; return; }
      drag.on = true; try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
    }
    const now = performance.now(), d = (e.clientX - drag.x) * K(), ms = Math.max(8, now - drag.t);
    yaw += d; vel = vel * .4 + (d / ms * 1000) * .6; drag.x = e.clientX; drag.t = now; userAt = now; orbitK = 0;
    if (reduced) still(); else wake();
  }
  function up(e) { if (!drag || e.pointerId !== drag.id) return; if (performance.now() - drag.t > 90) vel = 0; vel = Math.max(-4, Math.min(4, vel)); if (reduced) vel = 0; drag = null; userAt = performance.now(); canvas.classList.remove('mf-grab'); }
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  const ro = window.ResizeObserver ? new ResizeObserver(() => { size(); if (reduced || paused) { if (!paused) still(); } }) : null;
  size(); if (ro) ro.observe(host);
  if (reduced || dbg.freeze) still(); if (!reduced) wake();

  return {
    pause() { paused = true; if (raf) cancelAnimationFrame(raf); raf = 0; },
    resume() { if (dead) return; paused = false; if (reduced) still(); else wake(); },
    setLang(l) { lang = l === 'en' ? 'en' : 'he'; setDir(); if (toastNo) toastText(); },
    destroy() {
      if (dead && !renderer) return; dead = true; if (raf) cancelAnimationFrame(raf); raf = 0; if (ro) ro.disconnect();
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); });
      marks.forEach((m) => { m.ring.dispose(); m.dot.dispose(); m.pool.dispose(); }); ground.dispose(); disposeShared(); env.dispose();
      renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { /* fine */ } renderer = null;
      canvas.remove(); layer.remove(); if (!--styleRefs && styleEl) { styleEl.remove(); styleEl = null; }
    },
    /* not part of the contract: numbers for the lab */
    info: () => { const iv = stats.intervals.slice().sort((a, b) => a - b); return { firstFrameMs: Math.round(stats.first), frames: stats.frames, renderMsAvg: +(stats.renderMs / Math.max(1, stats.frames)).toFixed(1), frameMsMedian: iv.length ? +iv[iv.length >> 1].toFixed(1) : 0, frameMsP90: iv.length ? +iv[Math.floor(iv.length * .9)].toFixed(1) : 0, simTime: +sim.time.toFixed(1), yaw: +yaw.toFixed(3), w: W, h: H, dist: +dist.toFixed(2), aimY: +aimY.toFixed(2) }; }
  };
  } catch (e) {
    try { renderer.dispose(); renderer.forceContextLoss(); } catch (x) { /* fine */ }
    canvas.remove(); const l = host.querySelector(':scope > .mf-layer'); if (l) l.remove();
    if (styleEl && !--styleRefs) { styleEl.remove(); styleEl = null; }
    return fail(e);
  }
}
