/* The stage: one scene that fills the screen. A long table runs away from the guest; the dishes of the open category stand on
   it; the camera glides along it. The stage draws what it is told and nothing else:

     sync(view)   which category is open, which dish is in focus, whether it is lifted   (from the navigation state)
     glide.p      where the camera is along the table, in dishes                          (from the glide controller)

   step(dt) moves everything towards those with exact springs, so 30 or 120 frames a second trace the same motion and the
   filming clock can drive it frame by frame. Only the dishes near the camera exist; their pictures are loaded as the guest
   approaches and let go behind them.

   Kept from the original engine: the relief shader (a dish is its photo, un-projected from the photo's own angle), shadows cut
   from each dish's own matte, the lit table with one lamp, mirror reflections on glossy tables, selective bloom, the projector
   look (now used for placeholder pictures), and the order in which a slow phone gives things up (bloom, then pixels). */
import {
  WebGLRenderer, Scene, PerspectiveCamera, OrthographicCamera, TextureLoader, PlaneGeometry, CircleGeometry, CylinderGeometry, RingGeometry,
  Mesh, Group, Points, Sprite, SpriteMaterial, ShaderMaterial, BufferGeometry, BufferAttribute, DataTexture, CanvasTexture,
  WebGLRenderTarget, Color, Vector2, Vector3, Vector4, AdditiveBlending, CustomBlending, AddEquation, OneFactor, OneMinusSrcAlphaFactor,
  DoubleSide, BackSide, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, MirroredRepeatWrapping, RGBFormat
} from 'three';
import * as SH from './shaders.js';
import { SIZE, RAD, clamp, shapeOf } from '../scenes/common.js';
import { presetById, frameOf, placesOf, centreAt, alongAt, dishAt, cameraFor, liftCyFor, LANE } from '../scenes/walk.js';
import { springStep, turnStep } from '../physics.js';
import { createDrinkKit } from './drinks.js';
import { pourAt, REST, LEAD } from '../drinks/pour.js';
import { labelText } from '../drinks/spec.js';

const PI = Math.PI, TAU = PI * 2, PUCK = .07, FLOAT = .5, BARP = presetById('bar');
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const ease = (dt, rate) => 1 - Math.exp(-dt * rate);
const BEHIND = 3, AHEAD = 3, KEEP = 3.6;        // dishes that exist around the camera · beyond KEEP they are let go
const TEX_KEEP = 10;                            // pictures kept ready after their dish has left (most recent first)
const GAP = .62;                                // between two sections on the same table: this much more than a dish's place, for the section's name
const IDLE_AFTER = 45;                          // seconds without a touch before the gentle sway comes to rest and the loop sleeps
const ROOMS = ['table', 'bar'];
const LEAVE = 1.3, DARK = 1.5, ARRIVE = 1.45, FAR = 16;   // from one room to the other, along the walk: past what stands where we are · the dark between the two (each side of the line) · up to the first thing of the next room · where a room's far end is, for the line
const CARD = [1.5, .95], LEAN = 28 * RAD;       // a folded name card: width, slant height, how far its faces lean
const RISE = .075, CALM = [.5, 2.6];             // the dish the table settles on comes up this far (a tap lifts it the rest of the way) · it waits until the glide is slower than this (dishes a second: fully calm, not calm at all)
const BREATH = .022;                            // while the table is still travelling fast the camera stands back by this much, and comes in as it lands
/* 1 when the table is still or under a finger, 0 while it still travels fast on its own */
const calmOf = (G) => (G.mode === 'settle' ? 1 - smooth((Math.abs(G.v) - CALM[0]) / (CALM[1] - CALM[0])) : 1);

export function createStage(opts) {
  const canvas = opts.canvas, reduce = !!opts.reduce, themes = opts.themes || 'themes/', glide = opts.glide;
  let theme = opts.theme || {};
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  const gl = renderer.getContext(); if (!gl) return null;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  let pr = opts.pixelRatio || Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pr); renderer.setClearColor(0x000000, 0); renderer.info.autoReset = false;      // counted per frame in draw()

  const U = { time: { value: 0 }, accent: { value: new Color(theme.accent || '#5fd0ff') }, px: { value: pr }, hub: { value: new Vector2() }, glow: { value: 0 }, pulse: { value: 9 },
    refl: { value: 0 }, mask: { value: new Vector4(0, 2, 0, 0) }, at: { value: new Vector2() } };
  const scene = new Scene(), camera = new PerspectiveCamera(30, 1, .1, 160), loader = new TextureLoader();
  camera.layers.enable(1);                                   // layer 1: what stands on the food table (see draw: it can sit out the light-only pass)
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  const geoHi = new PlaneGeometry(1, 1, small ? 220 : 300, small ? 220 : 300), geoLo = new PlaneGeometry(1, 1, 96, 96), geoFlat = new PlaneGeometry(1, 1);
  const px1 = (r, g, b) => { const t = new DataTexture(new Uint8Array([r, g, b]), 1, 1, RGBFormat); t.needsUpdate = true; return t; };
  const flatTex = px1(128, 128, 128), darkTex = px1(18, 16, 14);
  const addMat = (fs, uniforms, vs, extra) => new ShaderMaterial(Object.assign({ uniforms, vertexShader: vs || SH.UV_VS, fragmentShader: fs, transparent: true, depthWrite: false, blending: AdditiveBlending }, extra || {}));

  /* ---- the tables: one plane that goes wherever the camera goes; the shader lays the long tables out on it ----
     Two rooms can be in the picture at once, the table and the bar (the guest walks from one to the other): the lamp, the
     camera and the lanes are shared, and each room has its own surface, its own level of light (uFade) and its own side of
     the line where one gives way to the other (uEdge). */
  const lit = { uGlow: U.glow, uCam: { value: camera.position }, uLampPos: { value: new Vector3(.5, 3.6, 1.5) }, uPool: { value: new Vector3(0, .1, 9.5) }, uDim: { value: 1 },
    uLane: { value: new Vector4(0, 2.1, LANE, 0) }, uLanes: { value: new Vector2(0, 0) } };
  const surfaceU = () => Object.assign({ map: { value: darkTex }, hmap: { value: flatTex }, uSize: { value: 6 }, uSpec: { value: .1 }, uShin: { value: 20 }, uBump: { value: 0 }, uFade: { value: 0 },
    uLamp: { value: new Color(1, .95, .86) }, uFar: { value: new Vector2(5.5, 13) }, uEdge: { value: new Vector3(0, 0, 1) } }, lit);
  const tU = surfaceU();
  const groundG = new PlaneGeometry(1, 1).rotateX(-PI / 2);
  const tableM = new Mesh(groundG, new ShaderMaterial({ uniforms: tU, vertexShader: SH.WORLD_VS, fragmentShader: SH.TABLE_FS })); tableM.frustumCulled = false; tableM.scale.set(260, 1, 260); scene.add(tableM);
  const actorsG = new Group(); scene.add(actorsG);
  const kit = createDrinkKit({ U, cam: camera.position, lampPos: lit.uLampPos, maxAniso, blank: flatTex, motion: !reduce });
  const rooms = { table: { u: tU, far: presetById('table').far, s: null, want: null, live: false, fade: 0 }, bar: { u: null, far: null, s: null, want: null, live: false, fade: 0 } };      // s: the surface in use · want: one on its way · live: its numbers are in the shader

  /* ---- the bar: the same long slab in stone, and the back-bar far ahead ---- */
  let BAR = null;
  function buildBar() {
    if (BAR) return BAR;
    const cu = Object.assign(surfaceU(), { uBack: { value: -12 }, uGloss: { value: 1 } }), g = new Group();
    const counter = new Mesh(groundG, new ShaderMaterial({ uniforms: cu, vertexShader: SH.WORLD_VS, fragmentShader: SH.COUNTER_FS })); counter.frustumCulled = false; counter.scale.set(260, 1, 260); g.add(counter);
    const wall = new Mesh(new PlaneGeometry(160, 30), new ShaderMaterial({ uniforms: { uFade: cu.uFade, uGlow: U.glow }, vertexShader: SH.WORLD_VS, fragmentShader: SH.WALL_FS })); wall.frustumCulled = false; g.add(wall);
    g.visible = false; scene.add(g); BAR = { g, counter, wall, cu }; rooms.bar.u = cu; rooms.bar.far = BARP.far; return BAR;
  }

  /* ---- the projector look: a puck on the table, a cone of light, the picture floating over it (placeholders, and surface 'holo') ---- */
  let H = null;
  function buildHolo() {
    if (H) return H;
    const softTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new CanvasTexture(cv); })();
    const h = { g: new Group(), fxU: { uAccent: U.accent, uTime: U.time, uOn: { value: 0 } }, fxOn: 0, scanAt: 2.2, softTex };
    h.geoBase = new CircleGeometry(1.36, 72).rotateX(-PI / 2).translate(0, PUCK, 0);
    h.geoSide = new CylinderGeometry(1.36, 1.4, PUCK + .03, 72, 1, true).translate(0, (PUCK - .03) / 2, 0);
    h.geoCone = new CylinderGeometry(1.2, .42, FLOAT - PUCK + .05, 64, 1, true).translate(0, PUCK + (FLOAT - PUCK + .05) / 2, 0);
    h.geoRing = new CircleGeometry(1.3, 72).rotateX(-PI / 2).translate(0, .012, 0);
    h.floor = new Mesh(new CircleGeometry(40, 64).rotateX(-PI / 2), addMat(SH.FLOOR_FS, { uAccent: U.accent, uTime: U.time, uHub: U.hub, uPulse: U.pulse, uGlow: U.glow, uAt: U.at }, SH.WORLD_VS)); h.floor.position.y = -.02; h.floor.renderOrder = -6; h.floor.frustumCulled = false; h.g.add(h.floor);
    h.halo = new Sprite(new SpriteMaterial({ map: softTex, color: U.accent.value, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: .16 })); h.halo.scale.set(9, 6, 1); h.halo.renderOrder = -4; h.g.add(h.halo);
    h.fx = new Group(); h.g.add(h.fx);
    const beam = new Mesh(new CylinderGeometry(1.5, 1.36, 2.7, 64, 1, true).translate(0, PUCK + 1.35, 0), addMat(SH.BEAM_FS, h.fxU, SH.UV_VS, { side: BackSide })); beam.renderOrder = -1; h.fx.add(beam);
    const dial = new Mesh(new RingGeometry(1.44, 1.74, 128).rotateX(-PI / 2), addMat(SH.HUD_FS, Object.assign({ uKind: { value: 0 } }, h.fxU), SH.LOCAL_VS, { side: DoubleSide })); dial.position.y = .012; dial.renderOrder = -2; h.fx.add(dial);
    h.hoop = new Mesh(new RingGeometry(1.1, 1.5, 96).rotateX(-PI / 2), addMat(SH.HUD_FS, { uAccent: U.accent, uTime: U.time, uOn: { value: 0 }, uKind: { value: 2 } }, SH.LOCAL_VS, { side: DoubleSide })); h.hoop.renderOrder = 5; h.fx.add(h.hoop);
    h.g.visible = false; scene.add(h.g); H = h; return h;
  }

  /* ---- bloom: the light-only render, blurred twice, added over the picture ---- */
  const rt = (depth) => new WebGLRenderTarget(4, 4, { minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: depth, stencilBuffer: false });
  const rtG = rt(true), rtB1 = rt(false), rtB2 = rt(false), rtC1 = rt(false), rtC2 = rt(false);
  const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new Scene();
  const blurM = new ShaderMaterial({ uniforms: { tex: { value: null }, dir: { value: new Vector2() } }, vertexShader: SH.QUAD_VS, fragmentShader: SH.BLUR_FS, depthTest: false, depthWrite: false });
  const bloomM = new ShaderMaterial({ uniforms: { a: { value: rtB2.texture }, b: { value: rtC2.texture }, k: { value: .75 } }, vertexShader: SH.QUAD_VS, fragmentShader: SH.BLOOM_FS, depthTest: false, depthWrite: false, transparent: true,
    blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor });
  const quad = new Mesh(new PlaneGeometry(2, 2), blurM); quad.frustumCulled = false; quadScene.add(quad);
  const blur = (src, dst, dx, dy) => { quad.material = blurM; blurM.uniforms.tex.value = src.texture; blurM.uniforms.dir.value.set(dx, dy); renderer.setRenderTarget(dst); renderer.render(quadScene, quadCam); };

  /* ---- what the stage knows ---- */
  const spring = (x) => ({ x, v: 0 });
  const S = { w: 0, h: 0, frame: null, view: null, preset: null, walk: opts.walk === -1 ? -1 : 1, first: true, clock: 0,
    lane: { x: 0, z: 0, places: [], n: 0, cat: null, kind: 'food' }, guests: { prev: null, next: null }, mounts: 0, actors: new Map(),
    dev: spring(0), E: spring(45), zoom: spring(1), cy: spring(300), lookY: spring(0), offX: spring(0), lift: spring(0), pool: spring(8.5),
    lampK: 1, room: 'table', edge: null, fov: spring(30), D: spring(10), lens: { W: 0, H: 0, D: 10, fov: 30 }, devZ: { x: 0, v: 0 }, titles: [], dragX: { dx: 0, active: false }, touchAt: 0, sway: 0, tilt: [0, 0], tiltT: [0, 0], ptr: [0, 0], ptrT: [0, 0],
    turning: false, bump: 0, swayK: 0, hot: [], bloom: opts.bloom !== false, tier: 0, slow: 0, lost: false, auto: opts.auto !== false, moving: true, frames: 0, disposed: false, pours: 0, hush: false,
    heroReady: null, stats: { calls: 0, triangles: 0 }, base: new Vector3(), focus: new Vector3(), intro: 0 };
  const texCache = new Map(); let pending = 0, texTick = 0;
  const waiters = [];
  const busy = (d) => { const was = pending; pending += d; if (opts.onBusy && (was === 0) !== (pending === 0)) opts.onBusy(pending > 0); if (pending === 0) waiters.splice(0).forEach((f) => f()); };

  function getTex(url, mip, onReady, soft) {
    let e = texCache.get(url);
    if (e) { e.refs++; e.last = ++texTick; if (e.ready) onReady(e.tex); else e.wait.push(onReady); return e; }
    e = { tex: null, refs: 1, ready: false, failed: false, wait: [onReady], url, last: ++texTick }; texCache.set(url, e); busy(1);
    e.tex = loader.load(url, (t) => {
      if (!texCache.has(url) || texCache.get(url) !== e) { t.dispose(); busy(-1); return; }
      t.generateMipmaps = mip; t.minFilter = mip ? LinearMipmapLinearFilter : LinearFilter; t.anisotropy = mip && !soft ? maxAniso : 1; t.needsUpdate = true;
      e.ready = true; e.wait.splice(0).forEach((f) => f(t)); busy(-1); wake();
    }, undefined, () => { e.failed = true; e.wait.length = 0; if (opts.onAssetError) opts.onAssetError(url); busy(-1); wake(); });
    return e;
  }
  function sweepTextures() {                                 // pictures nobody stands on any more: the most recent few stay ready, the rest are freed
    const idle = []; texCache.forEach((e) => { if (e.refs <= 0) idle.push(e); });
    if (idle.length <= TEX_KEEP) return;
    idle.sort((a, b) => b.last - a.last).slice(TEX_KEEP).forEach((e) => { if (e.tex) e.tex.dispose(); texCache.delete(e.url); });
  }

  /* ---- surfaces: what a room's table is made of ---- */
  const surf = { texs: new Map() };                          // id → { map, h, ready }
  function loadSurface(def) {
    let s = surf.texs.get(def.id + (def.img || '')); if (s) return s;
    s = { map: null, h: null, ready: false, def }; surf.texs.set(def.id + (def.img || ''), s);
    const set = (tex) => { tex.wrapS = tex.wrapT = def.mirror ? MirroredRepeatWrapping : RepeatWrapping; tex.anisotropy = maxAniso; tex.needsUpdate = true; return tex; };
    busy(1); s.map = loader.load(def.img || themes + def.id + '.jpg', (t) => { set(t); s.ready = true; busy(-1); wake(); }, undefined, () => { s.map = darkTex; s.ready = true; busy(-1); wake(); });
    if (!def.img) s.h = loader.load(themes + def.id + '_h.jpg', (t) => { set(t); wake(); });
    return s;
  }
  const roomOf = (preset) => (preset.holo ? null : rooms[preset.kind] || rooms.table);
  const inUse = (s) => rooms.table.s === s || rooms.table.want === s || rooms.bar.s === s || rooms.bar.want === s;
  function wantSurface(def) {
    if (def.id === 'holo') { S.room = 'holo'; U.refl.value = 0; buildHolo(); bloomM.uniforms.k.value = 1; return; }
    bloomM.uniforms.k.value = .75;
    const kind = def.kind || 'table'; if (kind === 'bar') buildBar();
    const R = rooms[kind], s = loadSurface(def); S.room = kind;
    if (R.s === s) R.want = null; else if (!R.s) { R.s = s; R.live = false; } else R.want = s;      // another table for the same room (the theme changed): swapped in the dark
    if (surf.texs.size > 3) surf.texs.forEach((v, k) => { if (!inUse(v)) { if (v.map && v.map !== darkTex) v.map.dispose(); if (v.h) v.h.dispose(); surf.texs.delete(k); } });
  }
  function dress(R) {                                        // the surface's own numbers into its shader
    const s = R.s, d = s.def, u = R.u, tint = d.tint || [1, .95, .86];
    u.map.value = s.map; u.hmap.value = s.h || flatTex; u.uSize.value = d.size; u.uSpec.value = d.spec; u.uShin.value = d.shin; u.uBump.value = d.bump; u.uLamp.value.setRGB(tint[0], tint[1], tint[2]); u.uFar.value.set(R.far[0], R.far[1]);
    if (u.uGloss) u.uGloss.value = d.gloss == null ? 1 : d.gloss;
    R.live = true;
  }
  /* each room's light: up in the room the guest is in, down in the one they have left. Walking from one to the other, both
     are in the picture for a moment, each on its own side of the line (S.edge) */
  function stepRooms(dt) {
    let moving = false;
    for (let k = 0; k < ROOMS.length; k++) {
      const kind = ROOMS[k], R = rooms[kind]; if (!R.u) continue;
      if (R.want && R.want.ready && (R.fade < .04 || reduce)) { R.s = R.want; R.want = null; R.live = false; }
      if (R.s && R.s.ready && !R.live) dress(R);
      const target = S.room === kind && R.live && !R.want ? 1 : 0, was = R.fade;
      R.fade = reduce ? target : was + (target - was) * ease(dt, R.want ? 12 : target ? 5.5 : 4.2);
      if (Math.abs(R.fade - target) > .004) moving = true; else R.fade = target;
      R.u.uFade.value = R.fade;
      const e = S.edge; if (e) R.u.uEdge.value.set(e.z, kind === e.to ? e.s : -e.s, e.w); else R.u.uEdge.value.set(0, 0, 1);
    }
    tableM.visible = rooms.table.fade > .002; if (BAR) BAR.g.visible = rooms.bar.fade > .002; if (H) H.g.visible = S.room === 'holo';
    const R = rooms[S.room]; U.refl.value = R && R.live ? R.s.def.refl * R.fade : 0;
    return moving;
  }

  /* ---- actors: one per dish near the camera ---- */
  function paintCard(a) {                                    // a dish with no picture: its name on a folded card, typeset, nothing more
    const info = opts.cardInfo ? opts.cardInfo(a.item) : { title: '', price: '', rtl: false };
    const cv = a.canvas || (a.canvas = document.createElement('canvas')); cv.width = 760; cv.height = 480;
    const x = cv.getContext('2d'), W = cv.width, Hh = cv.height;
    x.fillStyle = '#f4efe5'; x.fillRect(0, 0, W, Hh);
    x.strokeStyle = 'rgba(60,44,28,.6)'; x.lineWidth = 4; x.strokeRect(24, 24, W - 48, Hh - 48); x.lineWidth = 1.5; x.strokeRect(36, 36, W - 72, Hh - 72);
    try { x.direction = info.rtl ? 'rtl' : 'ltr'; } catch (e) { /* older canvases */ }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#2a1e12';
    const words = String(info.title || '').split(/\s+/).filter(Boolean), maxW = W - 120; let lines = [words.join(' ')], size = 0;
    const fit = (from) => { size = from; do { size -= 4; x.font = '700 ' + size + 'px "Frank Ruhl Libre","Times New Roman",serif'; } while (Math.max.apply(null, lines.map((l) => x.measureText(l).width)) > maxW && size > 34); };
    fit(150);
    if (size < 96 && words.length > 1) { let best = 1, bd = 1e9; for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (d < bd) { bd = d; best = i; } } lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')]; fit(128); }
    const lh = size * 1.04, hasPrice = !!info.price, block = lines.length * lh + (hasPrice ? 96 : 0), y0 = Hh / 2 - block / 2 + lh / 2 + 4;
    lines.forEach((l, i) => x.fillText(l, W / 2, y0 + i * lh));
    if (hasPrice) { const y = y0 + (lines.length - 1) * lh + lh / 2; x.fillStyle = 'rgba(60,44,28,.55)'; x.fillRect(W / 2 - 34, y + 16, 68, 3); x.font = '500 62px "Frank Ruhl Libre","Times New Roman",serif'; x.fillStyle = '#2a1e12'; try { x.direction = 'ltr'; } catch (e) { /* fine */ } x.fillText(String(info.price), W / 2, y + 62); }
    if (a.cardTex) a.cardTex.needsUpdate = true; else { a.cardTex = new CanvasTexture(cv); a.cardTex.anisotropy = maxAniso; }
    a.um.map.value = a.cardTex; a.ready = true;
  }
  function makeActor(item, i, L) {
    const view = S.view, P = S.preset, kind = L.kind, shape = shapeOf(item, kind), as = item.asset, g = new Group(), place = L.places[i];
    const a = { id: item.id, item, i, cat: L.cat, kind, shape, type: shape.type, g, x: L.x + place.dx, z: zOf(L, i) + place.dz, spin: place.spin, guest: L !== S.lane, seen: 0,
      room: roomOf(P), vis: 0, visT: 1, light: 1, turn: { x: 0, v: 0 }, lift: 0, near: 0, ready: false, leaving: false, tex: [], sat: 1, pour: null, pose: null, holo: !!(P.holo || shape.holo), stock: !!shape.holo };
    if (shape.type === 'relief' || shape.type === 'stand') {
      const um = a.um = { map: { value: darkTex }, aux: { value: flatTex }, uH: { value: as.h }, uE: { value: as.e * RAD }, uFocus: { value: 0 }, uReveal: { value: 0 }, uTime: U.time, uScan: { value: -9 }, uGlitch: { value: 0 }, uGlow: U.glow,
        uMirror: { value: 0 }, uAccent: U.accent, uCenter: { value: g.position }, uHolo: { value: a.holo ? 1 : 0 }, uLight: { value: 1 }, uRefl: U.refl, uMask: U.mask, uSat: { value: 1 }, uO: { value: new Vector2(as.o ? as.o[0] : 0, as.o ? as.o[1] : 0) } };
      const dishMat = (mirror) => new ShaderMaterial({ uniforms: mirror ? Object.assign({}, um, { uMirror: { value: 1 } }) : um, vertexShader: SH.DISH_VS, fragmentShader: SH.DISH_FS, transparent: true, side: DoubleSide, depthWrite: !mirror });
      a.mesh = new Mesh(geoLo, dishMat(false)); a.mesh.frustumCulled = false; a.mesh.rotation.order = 'YXZ'; a.mesh.visible = false; g.add(a.mesh);
      a.mir = new Group(); a.mir.scale.y = -1; g.add(a.mir);
      a.refl = new Mesh(geoLo, dishMat(true)); a.refl.frustumCulled = false; a.refl.rotation.order = 'YXZ'; a.refl.renderOrder = -1.5; a.refl.visible = false; a.mir.add(a.refl);
      a.shadow = new Mesh(geoFlat, new ShaderMaterial({ uniforms: { aux: um.aux, uE: um.uE, uO: um.uO, uLen: { value: as.o ? .5 : 1 }, uK: { value: 0 }, uCast: { value: new Vector2() }, uSoft: { value: 0 } }, vertexShader: SH.SHADOW_VS, fragmentShader: SH.SHADOW_FS, transparent: true, depthWrite: false }));
      a.shadow.frustumCulled = false; a.shadow.renderOrder = -2; a.shadow.position.y = .006; a.shadow.visible = false; g.add(a.shadow);
      if (shape.reliefX) a.mesh.position.x = a.refl.position.x = a.shadow.position.x = shape.reliefX;      // a glass will stand beside it
      let got = 0; const done = () => { if (++got >= 2) { a.ready = true; a.mesh.visible = true; } };
      a.tex.push(getTex(as.color, true, (t) => { um.map.value = t; done(); }), getTex(as.aux, true, (t) => { um.aux.value = t; done(); }, true));
    } else if (shape.type === 'drink') {
      a.ready = true;                                        // drawn in code: nothing to wait for
    } else {
      const photo = shape.type === 'photo', w = photo ? 1.9 : CARD[0], h = photo ? 1.9 : CARD[1];
      a.cardSize = [w, h];
      const um = a.um = { map: { value: darkTex }, uLight: { value: 1 }, uReveal: { value: 0 }, uGlow: U.glow, uSat: { value: 1 }, uSize: { value: new Vector2(w, h) }, uBorder: { value: photo ? .07 : 0 }, uFit: { value: new Vector4(1, 1, 0, 0) }, uTint: { value: new Color(1, 1, 1) }, uBlank: { value: 0 } };
      const mat = (extra) => new ShaderMaterial({ uniforms: extra ? Object.assign({}, um, extra) : um, vertexShader: SH.UV_VS, fragmentShader: SH.CARD_FS, transparent: true, side: DoubleSide });
      a.mesh = new Mesh(new PlaneGeometry(w, h), mat()); a.mesh.rotation.order = 'YXZ'; a.mesh.frustumCulled = false;
      a.shadow = new Mesh(geoFlat, new ShaderMaterial({ uniforms: { uK: { value: 0 } }, vertexShader: SH.UV_VS, fragmentShader: SH.BLOB_FS, transparent: true, depthWrite: false })); a.shadow.rotation.x = -PI / 2; a.shadow.position.y = .006; a.shadow.renderOrder = -2; g.add(a.shadow);
      if (photo) { g.add(a.mesh); a.tex.push(getTex(as.color, true, (t) => { um.map.value = t; const im = t.image, ar = im && im.width && im.height ? im.width / im.height : 1; um.uFit.value.set(ar > 1 ? 1 / ar : 1, ar > 1 ? 1 : ar, 0, 0); a.ready = true; })); }
      else {                                                 // a folded card standing at the dish's place: the name faces the guest, the other side is blank
        a.tent = new Group(); a.tent.rotation.order = 'YXZ'; g.add(a.tent);
        const foot = Math.sin(LEAN) * h, top = Math.cos(LEAN) * h;
        a.mesh.rotation.x = -LEAN; a.mesh.position.set(0, top / 2, foot / 2); a.tent.add(a.mesh);
        a.back = new Mesh(a.mesh.geometry, mat({ uBlank: { value: 1 }, uTint: { value: new Color(.62, .6, .58) } })); a.back.frustumCulled = false; a.back.rotation.x = LEAN; a.back.position.set(0, top / 2, -foot / 2); a.tent.add(a.back);
        paintCard(a);
      }
    }
    if (shape.drink) {                                       // a bottle and glass, or just the glass beside a photographed bottle
      a.drink = kit.build(shape.drink, labelText(item, kind, view.lang)); a.drink.group.position.set(shape.drinkX, 0, shape.drinkZ); g.add(a.drink.group);
      a.pose = REST(shape.drink); if (shape.type === 'drink') a.um = a.drink.shared;
    }
    if (a.holo) {                                            // the projector under a picture that is only a projection
      const hh = buildHolo(); a.ub = { uAccent: U.accent, uTime: U.time, uOn: { value: 0 } };
      const k = shape.type === 'stand' ? .62 : shape.type === 'text' || shape.type === 'photo' ? .8 : 1;
      if (P.holo) {                                          // the projector stage: a puck of dark glass, a cone of light, the picture half a unit above it
        const side = new Mesh(hh.geoSide, new ShaderMaterial({ uniforms: a.ub, vertexShader: SH.UV_VS, fragmentShader: SH.SIDE_FS })); side.renderOrder = -3;
        const base = new Mesh(hh.geoBase, new ShaderMaterial({ uniforms: a.ub, vertexShader: SH.UV_VS, fragmentShader: SH.BASE_FS, transparent: true, depthWrite: false, blending: CustomBlending, blendEquation: AddEquation, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor, blendSrcAlpha: OneFactor, blendDstAlpha: OneMinusSrcAlphaFactor })); base.renderOrder = -2.5;
        a.kit = [side, base]; a.float = shape.type === 'stand' ? PUCK + .1 : FLOAT;
        if (shape.type === 'relief') { const cone = new Mesh(hh.geoCone, addMat(SH.CONE_FS, a.ub, SH.UV_VS, { side: DoubleSide })); cone.renderOrder = -1; a.kit.push(cone); }
        a.kit.forEach((m) => { m.scale.set(k * .8, 1, k * .8); m.frustumCulled = false; g.add(m); });
      } else {                                               // a placeholder on a real table: it hovers a finger's width over the wood, in a ring of light
        const ring = new Mesh(hh.geoRing, addMat(SH.RING_FS, a.ub)); ring.renderOrder = -2.5; ring.scale.set(k * .92, 1, k * .92); ring.frustumCulled = false; g.add(ring);
        a.kit = [ring]; a.float = shape.type === 'stand' ? .03 : .15;
      }
    }
    if (a.room === rooms.table) g.traverse(onTable);
    g.position.set(a.x, 0, a.z); actorsG.add(g);
    return a;
  }
  const onTable = (o) => { o.layers.set(1); };
  function dropActor(a) {
    actorsG.remove(a.g); a.tex.forEach((e) => { e.refs--; e.last = ++texTick; });
    a.g.traverse((o) => { if (o.material) o.material.dispose(); });
    if (a.drink) a.drink.dispose();
    if (a.cardTex) a.cardTex.dispose(); if (a.type === 'photo' || a.type === 'text') a.mesh.geometry.dispose();
    S.actors.delete(a.id);
  }
  /* only the dishes near the camera exist */
  function mount() {
    const view = S.view; if (!view) return;
    const n = view.items.length, p = glide.state.p, c = clamp(Math.round(p), 0, n - 1), lo = Math.max(0, c - BEHIND), hi = Math.min(n - 1, c + AHEAD), f = clamp(view.index, 0, n - 1);
    let dropped = false;
    const want = (i) => {
      const it = view.items[i]; let a = S.actors.get(it.id);
      if (a && a.leaving) {                                    // left behind on the same table and walked back to: it is the same dish, it does not blink
        const pl = S.lane.places[i];
        if (a.visT > 0 && Math.abs(a.z - (zOf(S.lane, i) + pl.dz)) < .03 && Math.abs(a.x - (S.lane.x + pl.dx)) < .03) { a.leaving = false; a.guest = false; a.i = i; a.cat = view.catId; return; }
        dropActor(a); a = null;
      }
      if (!a) S.actors.set(it.id, makeActor(it, i, S.lane));
    };
    S.actors.forEach((a) => { if (!a.leaving && !a.guest && a.cat === view.catId && Math.abs(a.i - p) > KEEP && Math.abs(a.i - f) > 1) { dropActor(a); dropped = true; } });
    for (let i = lo; i <= hi; i++) want(i);
    for (let i = Math.max(0, f - 1); i <= Math.min(n - 1, f + 1); i++) want(i);      // and the dish we are travelling to, so its picture is there when the camera arrives
    /* Near either end of a section the table does not stop: the neighbouring course is laid a little further along it, its
       name lettered in the gap. As many of its dishes exist as the camera would see of our own (never more in all). */
    const tick = ++S.mounts;
    guests(S.guests.next, 1, c + AHEAD - (n - 1), tick); guests(S.guests.prev, -1, BEHIND - c, tick);
    S.actors.forEach(unseen);
    if (dropped) sweepTextures();
  }
  /* (two small callbacks made once, not once a frame) a guest nobody asked for this time leaves · something else still stands where a neighbouring course would go */
  const spot = { L: null, end: 0, way: 0, free: true };
  const unseen = (a) => { if (a.guest && !a.leaving && a.seen !== S.mounts) { a.leaving = true; a.visT = 0; } };
  const taken = (a) => { const L = spot.L; if (a.leaving && a.visT > 0 && (a.z - spot.end) * spot.way > .4 * S.preset.S && !(a.cat === L.cat && a.i < L.n && Math.abs(a.z - (zOf(L, a.i) + L.places[a.i].dz)) < .03)) spot.free = false; };
  function guests(L, side, k, tick) {
    if (!L || k <= 0 || !S.view) return;
    const m = L.items.length, own = S.lane, end = zOf(own, side > 0 ? own.n - 1 : 0), way = -S.walk * side;      // way: from our last dish on towards theirs, along z
    spot.L = L; spot.end = end; spot.way = way; spot.free = true; S.actors.forEach(taken);      // a section we jumped away from keeps its place until it has gone
    if (!spot.free) return;
    for (let q = 0; q < Math.min(k, m); q++) {
      const j = side > 0 ? q : m - 1 - q, it = L.items[j]; let a = S.actors.get(it.id);
      if (a && a.leaving) { if (a.visT > 0 && Math.abs(a.z - (zOf(L, j) + L.places[j].dz)) < .03) { a.leaving = false; a.guest = true; a.i = j; a.cat = L.cat; } else { dropActor(a); a = null; } }
      if (!a) { a = makeActor(it, j, L); S.actors.set(it.id, a); }
      a.seen = tick;
    }
    addTitle(L.title, own.x, end + way * (1 + GAP) / 2 * S.preset.S, S.view.rtl);
  }
  /* the sections before and after the open one, as lanes on the same table: theirs begins a gap beyond where ours ends */
  function layGuests(view) {
    const P = S.preset, own = S.lane, gap = (1 + GAP) * P.S, side = (o, dir) => {
      if (!o || !o.items.length || presetById(o.scene).id !== P.id || !own.n) return null;
      const places = placesOf(P, o.items, o.kind, view.rtl), at = dir > 0 ? zOf(own, own.n - 1) - S.walk * gap : zOf(own, 0) + S.walk * gap;      // where their dish nearest to us stands
      return { x: own.x, z: at + S.walk * places[dir > 0 ? 0 : places.length - 1].z, places, n: places.length, cat: o.id, kind: o.kind, items: o.items, title: dir > 0 ? o.name : view.catName };
    };
    S.guests.next = side(view.next, 1); S.guests.prev = side(view.prev, -1);
    /* a neighbour in the other room (the bar after the desserts): its counter is fetched now, so the walk there does not arrive in the dark */
    for (let k = 0; k < 2; k++) { const o = k ? view.next : view.prev, Q = o ? presetById(o.scene) : null; if (Q && Q.id !== P.id && !Q.holo && !P.holo) loadSurface(Q.surface(theme)); }
  }

  /* ---- what the navigation state asks for ---- */
  /* a lane: the section that is open, laid along the table from lane.z (its first dish); see placesOf */
  const zOf = (L, i) => L.z - S.walk * L.places[i].z;
  function focusPoint(p) { const P = S.preset, L = S.lane; return [L.x + centreAt(L.places, p), L.z - S.walk * alongAt(L.places, p, P.S)]; }
  function sync(view) {
    if (S.lost || S.disposed) { S.view = view; return; }
    const prev = S.view, preset = presetById(view.scene), presetChanged = !S.preset || S.preset.id !== preset.id, P0 = S.preset;
    const catChanged = !prev || prev.catId !== view.catId || presetChanged || prev.rtl !== view.rtl || prev.rev !== view.rev;
    const at = prev && P0 && S.lane.cat != null ? focusPoint(S.lastP == null ? glide.state.p : S.lastP) : [0, 0];      // where the camera stands now
    if (reduce && prev && !S.first && opts.onCut && (prev.catId !== view.catId || presetChanged) && S.w) { draw(); opts.onCut(canvas); }      // reduced motion: no travel. The page keeps the picture as it is now and cross-fades from it
    S.view = view; S.preset = preset;
    if (presetChanged || !prev) wantSurface(preset.surface(theme));
    if (!S.frame || presetChanged || (prev && prev.rtl !== view.rtl)) refit();
    if (catChanged) {
      const dir = prev && view.nav && view.nav.kind === 'category' ? (view.nav.dir || 1) : 0;
      const P = preset, n = view.items.length, i = clamp(view.index, 0, n - 1), camX = at[0] + S.dev.x, camZ = at[1] + S.devZ.x, way = -S.walk, fwd = way * P.S;      // way: from one dish to the next, along z · fwd: the room of one dish that way
      const places = placesOf(P, view.items, view.kind, view.rtl);
      const walked = !!prev && prev.rtl === view.rtl && prev.rev === view.rev && !!dir && !S.first, same = walked && !presetChanged;
      const across = walked && presetChanged && !reduce && !!P0 && !!roomOf(P0) && !!roomOf(P) && roomOf(P0) !== roomOf(P);
      if (same) {
        /* The next section is further along the SAME table. The dish we walk to stands one place and a gap beyond where we
           are (and beyond its own neighbours on our side); the section's name is lettered in the gap. Nothing goes dark. */
        const G = dir > 0 ? S.guests.next : S.guests.prev, was = S.lastP == null ? glide.state.p : S.lastP, there = S.actors.get(view.itemId);
        if (G && G.cat === view.catId && !reduce && there && there.guest && !there.leaving && (dir > 0 ? was > S.lane.n - 2.4 : was < 1.4)) {
          /* We were near the end, and that section is already laid a gap further on: its dishes are these very dishes. The
             camera only has to go on (what is left behind stays, and is now the course before). */
          S.actors.forEach((a) => { if (a.guest && a.cat === view.catId && !a.leaving) a.guest = false; else if (!a.leaving) { a.leaving = true; a.guest = false; } });
          S.lane = { x: G.x, z: G.z, cat: view.catId, kind: view.kind, n, places: G.places }; S.lastP = i;
          S.devZ.x = camZ - zOf(S.lane, i); S.dev.x = camX - focusPoint(i)[0];
        } else {
          const pad = dir > 0 ? Math.min(BEHIND, i) : Math.min(AHEAD, n - 1 - i), own = Math.abs(places[i].z - places[i - dir * pad].z), T = own + (1 + GAP) * P.S, zT = camZ + dir * way * T;
          S.actors.forEach((a) => { const u = (a.z - camZ) / fwd * dir; a.leaving = true; a.guest = false; a.visT = a.visT > 0 && u < .5 ? 1 : 0; });      // what stands in our way makes room; what we leave behind stays on the table
          S.lane = { x: S.lane.x, z: zT + S.walk * places[i].z, cat: view.catId, kind: view.kind, n, places }; S.lastP = i;
          if (reduce) { S.devZ.x = 0; S.dev.x = 0; S.actors.forEach((a) => { a.visT = 0; }); dropTitles(); }
          else { S.devZ.x = camZ - zT; S.dev.x = camX - focusPoint(i)[0]; addTitle(dir > 0 ? view.catName : prev.catName, S.lane.x, zT - dir * way * (own + (1 + GAP) / 2 * P.S), view.rtl); }
        }
      } else if (across) {
        /* Another room: from the table to the bar, or back. It lies further along the same walk, beyond a stretch of dark.
           The camera travels there in one move, the lamp with it; each room keeps to its own side of a line across the walk
           (S.edge) and its own light goes down, or comes up, on the way. Turning round half way is the same move the other
           way, across the same line. */
        const t = dir * way, pad = dir > 0 ? Math.min(BEHIND, i) : Math.min(AHEAD, n - 1 - i), own = Math.abs(places[i].z - places[i - dir * pad].z), e = S.edge;
        const back = !!e && e.s === -t, zL = back && !e.away ? e.zTo : camZ + t * (LEAVE + DARK), zT = zL + t * (DARK + ARRIVE + own);      // back: the room we go to lies beyond a line we crossed a moment ago; it is still the line between the two
        S.actors.forEach((a) => { const u = (a.z - camZ) * t / P0.S; a.leaving = true; a.guest = false; a.visT = a.visT > 0 && u < .5 ? 1 : 0; }); dropTitles();
        S.edge = { z: back && (e.z - zL) * t < FAR ? e.z : zL + t * FAR, zTo: zL, to: P.kind, s: t, w: DARK, away: 0 };      // a new line comes in from the far end of the room, and one that was drawing away turns round: nothing that is lit goes dark at once
        S.lane = { x: S.lane.x, z: zT + S.walk * places[i].z, cat: view.catId, kind: view.kind, n, places }; S.lastP = i;
        S.devZ.x = camZ - zT; S.dev.x = camX - focusPoint(i)[0];
      } else {
        /* another language's direction, a new edition of the menu, or no travel wanted (reduced motion): laid afresh where we stand */
        S.actors.forEach((a) => { a.leaving = true; a.guest = false; a.visT = 0; }); dropTitles(); S.edge = null;
        S.lane = { x: prev ? S.lane.x : 0, z: at[1] + S.walk * places[i].z, cat: view.catId, kind: view.kind, n, places }; S.lastP = i;
        S.dev.x = 0; S.dev.v = 0; S.devZ.x = 0; S.devZ.v = 0;
      }
      layGuests(view); S.heroReady = null;
    }
    mount();
    /* the pour: once when a drink is lifted, once more each time the guest asks; anything else that happens ends it */
    const heroA = S.actors.get(view.itemId), lifted = !!view.lifted;
    const entered = lifted && heroA && (!prev || !prev.lifted || prev.itemId !== view.itemId), again = !!prev && prev.pourSeq !== view.pourSeq;
    S.actors.forEach((a) => { if (a !== heroA || !lifted) a.pour = null; });
    const hush = S.hush; S.hush = false;                     // the picture came back after a lost GPU: show the drink at rest, do not replay
    if (lifted && heroA && heroA.drink && heroA.drink.spec.pourable && !reduce && !hush && (entered || again)) { heroA.pour = { t: -LEAD }; heroA.pose = pourAt(-LEAD, heroA.drink.spec); S.pours++; }
    if (view.nav && view.nav.kind === 'edge' && view.nav.seq !== S.navSeq && !reduce) S.bump = -(view.nav.axis === 'x' ? (view.rtl ? -1 : 1) : 0) * view.nav.dir * .5;      // a nudge against the end
    if (view.nav) S.navSeq = view.nav.seq;
    if (prev && prev.lang !== view.lang) repaintCards();
    if (S.first) { S.first = false; S.intro = reduce || !opts.intro ? 0 : 1; snapCamera(); }
    touch(); wake();
  }
  /* the name of a section, lettered on the table in the gap before its first dish */
  function addTitle(text, x, z, rtl) {
    if (!text) return; for (let k = 0; k < S.titles.length; k++) if (Math.abs(S.titles[k].z - z) < .3) { if (S.titles[k].text === text) return; dropTitle(S.titles[k]); break; }      // it is lettered there already
    while (S.titles.length > 2) dropTitle(S.titles[0]);
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const c = cv.getContext('2d');
    const font = (px) => '700 ' + px + 'px "Frank Ruhl Libre","Times New Roman",serif';
    let px = 132; c.font = font(px); const w0 = c.measureText(text).width; if (w0 > 900) { px = Math.max(40, Math.floor(px * 900 / w0)); c.font = font(px); }
    try { c.direction = rtl ? 'rtl' : 'ltr'; } catch (e) { /* older canvases */ }
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 26; c.fillStyle = 'rgba(250,243,230,.95)'; c.fillText(text, 512, 132); c.shadowBlur = 8; c.fillText(text, 512, 132);
    const tex = new CanvasTexture(cv); tex.anisotropy = maxAniso;
    const wide = Math.min(S.frame ? S.frame.W / S.frame.ppu * .9 : 2.2, 3.0), w = Math.min(wide, 1024 / Math.max(260, Math.min(900, w0)) * 1.15), u = { map: { value: tex }, uGlow: U.glow, uK: { value: 0 }, uLight: { value: 1 } };
    const m = new Mesh(groundG, new ShaderMaterial({ uniforms: u, vertexShader: SH.UV_VS, fragmentShader: SH.TITLE_FS, transparent: true, depthWrite: false }));
    m.frustumCulled = false; m.renderOrder = -4; m.scale.set(w, 1, w / 4); m.position.set(x, .012, z); scene.add(m);
    S.titles.push({ m, u, tex, x, z, k: 0, text });
  }
  function dropTitle(t) { scene.remove(t.m); t.tex.dispose(); t.m.material.dispose(); const i = S.titles.indexOf(t); if (i >= 0) S.titles.splice(i, 1); }
  function dropTitles() { S.titles.slice().forEach(dropTitle); }
  function repaintCards() { S.actors.forEach((a) => { if (a.type === 'text') paintCard(a); if (a.drink && S.view) a.drink.paint(labelText(a.item, a.kind, S.view.lang)); }); wake(); }
  function refit() { if (!S.w || !S.preset || !S.view) return; S.frame = frameOf(S.preset, S.w, S.h, !!S.view.rtl); if (opts.onFrame) opts.onFrame(S.frame); }
  function camTargets() {
    const P = S.preset, F = S.frame, view = S.view, hero = S.actors.get(view.itemId), lifted = !!view.lifted;
    let E = P.E, zoom = 1, cy = F.cy, lookY = 0, offX = 0;
    if (!lifted && glide.state.mode === 'settle') zoom = 1 - BREATH * smooth((Math.abs(glide.state.v) - CALM[0]) / 5);      // never under a finger: there the table follows the hand exactly
    if (lifted) {
      const drink = hero && hero.type === 'drink', stand = hero && hero.type === 'stand';
      const sheet = F.wide ? F.sheetH : clamp((opts.sheet && opts.sheet()) || F.sheetH, F.cardH, F.sheetH);      // how much of the phone the open sheet takes: as much as it has to say
      E = P.kind === 'bar' ? (drink ? P.liftE : stand ? P.liftEStand : 38) : P.liftE; zoom = F.liftZoom; cy = F.wide ? F.liftCy : liftCyFor(F.H, sheet, F.standing);
      lookY = P.liftY + (hero ? (hero.float || 0) + Math.min(.5, hero.shape.top * .4) : 0);
      if (P.kind === 'bar' && hero) {                        // a standing drink: the eye comes down to the counter; while it pours, far enough back to hold the bottle's swing
        const sh = hero.shape, w = hero.pose && hero.pour ? hero.pose.cam : 0, box = sh.drink ? { r: sh.drink.rest.r + (sh.drink.pour.r - sh.drink.rest.r) * w, cx: sh.drink.rest.cx + (sh.drink.pour.cx - sh.drink.rest.cx) * w, top: sh.drink.rest.top + (sh.drink.pour.top - sh.drink.rest.top) * w } : { r: sh.r, cx: 0, top: sh.top };
        const roomW = (F.wide ? (F.W - F.cardW) * .56 : F.W * .86), roomH = (F.wide ? F.H - F.top - 40 : F.H - sheet - 64), e = E * RAD;
        const ppu = Math.min(roomW / (2 * box.r + .1), roomH / (box.top * Math.cos(e) + box.r * 1.2 * Math.sin(e) + .1));
        zoom = clamp(ppu / F.ppu, .45, 1.5); offX = box.cx + (sh.drinkX || 0) * 0; lookY = 0; cy = (F.wide ? F.top + (F.H - F.top) * .86 : F.H - sheet - 14 - box.r * .6 * Math.sin(e) * ppu);
      }
    }
    return { E, zoom, cy, lookY, offX };
  }
  function snapCamera() { const t = camTargets(); S.fov.x = S.frame.fov; S.D.x = S.frame.D; S.fov.v = S.D.v = 0; S.E.x = t.E; S.zoom.x = t.zoom; S.cy.x = t.cy; S.lookY.x = t.lookY; S.offX.x = t.offX; S.E.v = S.zoom.v = S.cy.v = S.lookY.v = S.offX.v = 0; S.lift.x = S.view && S.view.lifted ? 1 : 0; S.lift.v = 0; S.pool.x = S.preset.pool; }
  function touch() { S.touchAt = S.clock; }

  /* ---- one step of motion ---- */
  const V = new Vector3(), V2 = new Vector3();
  function step(dt) {
    S.clock += dt; const t = S.clock; U.time.value = t; U.pulse.value += dt;
    const view = S.view; if (!view || !S.frame || S.lost) return false;
    let moving = stepRooms(dt);
    const P = S.preset, F = S.frame, G = glide.state, p = G.p, lifted = !!view.lifted, holoScene = !!P.holo, isBar = P.kind === 'bar';
    S.lastP = p; mount();
    const hero = S.actors.get(view.itemId) || null;
    const go = (s, target, w) => { if (reduce) { s.x = target; s.v = 0; return; } springStep(s, target, w, dt); if (Math.abs(s.x - target) > 1e-3 || Math.abs(s.v) > 1e-2) moving = true; else { s.x = target; s.v = 0; } };
    /* camera */
    const tg = camTargets();
    go(S.E, tg.E, S.edge ? 6.5 : 9); go(S.fov, F.fov, 6.5); go(S.D, F.D, 6.5); go(S.zoom, tg.zoom, 10); go(S.cy, tg.cy, S.edge && !lifted ? 6.5 : 11);      // into another room the eye comes down (or up) as slowly as the camera travels
    go(S.lookY, tg.lookY, 11); go(S.offX, tg.offX, 9); go(S.lift, lifted ? 1 : 0, 12); go(S.pool, lifted ? P.pool * (P.open ? .8 : .46) : P.pool * (1 + (reduce ? 0 : P.open || 0) * (G.mode === 'drag' || G.mode === 'wheel' ? 1 : 1 - calmOf(G))), lifted ? 7 : 4.2);      // on a set table the lamp opens while the guest is moving along it, and closes on the dish they stop at
    if (opts.onLift) opts.onLift(clamp(S.lift.x, 0, 1.2));
    if (S.dragX.active) { S.dev.x = -S.dragX.dx / F.ppu * .3; S.dev.v = 0; moving = true; } else go(S.dev, 0, 12);      // a sideways push: the table gives a little; let go and the walk goes on to the next section
    go(S.devZ, 0, 5.6);                                      // on to the next section: a longer glide along the same table
    if (Math.abs(S.bump) > .002) { moving = true; S.bump *= Math.exp(-dt * 8); } else S.bump = 0;
    if (S.intro > .002) { S.intro *= Math.exp(-dt * 3.2); moving = true; } else S.intro = 0;
    const fp = focusPoint(p), fx = fp[0] + S.dev.x + S.bump + S.offX.x, fz = fp[1] + S.devZ.x + S.walk * S.intro * 1.1;
    /* alive at rest: a slow sway, the phone's tilt, the pointer; all of it small and low-passed */
    const idle = t - S.touchAt, swayT = reduce || idle > IDLE_AFTER ? 0 : G.mode === 'rest' && !S.dragX.active && !S.turning ? 1 : .25;
    S.swayK += (swayT - S.swayK) * ease(dt, 2.2); if (Math.abs(swayT - S.swayK) < .002) S.swayK = swayT;
    const env = S.swayK, live = env > 0 || swayT > 0;
    const kf = ease(dt, 5);
    for (let k = 0; k < 2; k++) { S.tilt[k] += (S.tiltT[k] - S.tilt[k]) * kf; S.ptr[k] += (S.ptrT[k] - S.ptr[k]) * kf; if (Math.abs(S.tiltT[k] - S.tilt[k]) + Math.abs(S.ptrT[k] - S.ptr[k]) > .002) moving = true; }
    /* night:page */ const swayK = env * (opts.sway == null ? 1 : opts.sway);      /* hero mode asks for a smaller rest sway (≤ 2°); a guest's menu keeps its own */ /* /night:page */
    const yaw = reduce ? 0 : Math.sin(t * .52) * .06 * swayK + S.tilt[0] * .13 + S.ptr[0] * -.075, pitch = reduce ? 0 : Math.sin(t * .37 + 1) * .7 * swayK + S.tilt[1] * 3 + S.ptr[1] * 1.6;
    if (live) moving = moving || 'slow';
    const L = S.lens; L.W = F.W; L.H = F.H; L.D = S.D.x; L.fov = S.fov.x;
    const look = [fx, S.lookY.x, fz], cam = cameraFor(L, look, S.E.x + pitch, S.zoom.x, yaw, F.cx, S.cy.x), base = cameraFor(L, look, S.E.x, S.zoom.x, 0, F.cx, S.cy.x);
    camera.position.fromArray(cam.pos); V.fromArray(look); camera.lookAt(V);
    if (Math.abs(camera.fov - cam.fov) > 1e-4 || camera.aspect !== S.w / S.h) { camera.fov = cam.fov; camera.aspect = S.w / S.h; }
    camera.setViewOffset(S.w, S.h, cam.offset[0], cam.offset[1], S.w, S.h); camera.updateMatrixWorld();
    S.base.fromArray(base.pos); S.focus.set(fp[0], 0, fp[1]);
    /* lamp and table: the pool of light travels with the focus, into the other room too (each room has its own level of light: stepRooms) */
    S.lampK = 1;
    const lampX = fp[0] + S.offX.x, lampZ = fp[1] + S.devZ.x;      // the lamp walks with us
    lit.uPool.value.set(lampX, lampZ + .1, S.pool.x); lit.uLampPos.value.set(lampX + .5, 3.6, lampZ + 1.5); lit.uDim.value = S.lampK;
    lit.uLane.value.set(S.lane.x, P.width / 2, LANE, 0); U.mask.value.set(S.lane.x, P.width / 2, 0, 0);
    /* the line between two rooms stays where it is while the guest crosses it; once they are over it, it draws away behind them, fast enough for the new room to be lit to its far end by the time they arrive */
    const here = roomOf(P), E_ = S.edge;
    if (E_) { moving = true; if (!E_.away) E_.z += (E_.zTo - E_.z) * ease(dt, 9); if (E_.away || (fz - E_.zTo) * E_.s > 0) { E_.away += dt; E_.z -= E_.s * dt * (4 + 90 * E_.away); if (Math.abs(E_.z - fz) > 34) S.edge = null; } }
    tableM.position.set(fx, 0, fz); if (BAR) { BAR.counter.position.set(fx, 0, fz); BAR.cu.uBack.value = fz - BARP.wall; BAR.wall.position.set(fx, 9, BAR.cu.uBack.value); }
    U.hub.value.set(S.lane.x, fz); U.at.value.set(lampX, lampZ);
    /* things on the table */
    const C = camera.position, B = S.base, kv = reduce ? 1 : ease(dt, 7), calm = calmOf(G), set = P.rim != null;      // set: a table laid for a meal (see placesOf), where the dish in focus is presented; on the bar nothing leaves the counter
    let scan = -9;
    if (H) { const ph = t - H.scanAt; if (ph > 0 && ph < 1.6 && !reduce) scan = -.06 + ph / 1.6; if (ph > 7) H.scanAt = t; }
    const dead = []; let anyHolo = false; S.glowing = false;
    S.titles.slice().forEach((tt) => {
      if (Math.abs(tt.z - fz) > (KEEP + 1.4) * P.S) { dropTitle(tt); return; }
      if (tt.k < 1) { tt.k = reduce ? 1 : Math.min(1, tt.k + dt * 5); moving = true; }
      const dl = Math.hypot(tt.x - lampX, tt.z - lampZ); tt.u.uK.value = tt.k * (here ? here.fade : 1) * (lifted ? .45 : 1); tt.u.uLight.value = (.34 + .66 / Math.pow(1 + dl * dl / S.pool.x, 1.5)) * (.25 + .75 * S.lampK);
    });
    S.actors.forEach((a) => {
      const isHero = a === hero && !a.leaving, P_ = a.g.position;
      const hide = lifted && isBar && !isHero && hero && (hero.type === 'drink' || hero.type === 'stand');      // an open drink has the counter to itself
      if (a.leaving && a.visT > 0 && a.room && a.room !== here && a.room.fade < .2) a.visT = 0;      // left behind in the other room: gone with its light
      const visT = a.ready ? (hide ? 0 : a.visT) : 0; a.vis += (visT - a.vis) * (a.leaving && !reduce ? ease(dt, 11) : kv);
      if (Math.abs(visT - a.vis) > .004 || (!a.ready && !a.leaving)) moving = true;
      if (a.leaving && a.visT > 0 && Math.abs(a.z - fz) > (KEEP + .8) * P.S) a.visT = 0;      // left behind on the table, and now far behind
      if (a.leaving && a.visT === 0 && !a.ghost) { a.ghost = true; a.g.traverse((o) => { if (o.material) o.material.depthWrite = false; }); }      // on its way out it hides nothing: the dish that takes its place shows through at once
      if (a.leaving && a.vis < .012) { dead.push(a); return; }
      a.g.visible = a.vis > .004;
      const wx = a.x, wz = a.z, rev = reduce ? (a.vis > .5 ? 1 : 0) : smooth(a.vis);
      const dl = Math.hypot(wx - lampX, wz - lampZ); const pool = 1 / Math.pow(1 + dl * dl / S.pool.x, 1.5); let lf = (set ? Math.sqrt((.2 + pool) / 1.2) : .16 + .84 * pool) * (.25 + .75 * S.lampK) * (a.room ? a.room.fade : 1);      // the lamp's pool, as the table under it takes it (a plate is never darker than the wood it stands on), in the light of its own room
      const sold = a.item.available === false; if (sold && !isHero) lf *= .86;
      a.light += (lf - a.light) * (reduce ? 1 : ease(dt, 9)); if (Math.abs(lf - a.light) > .004) moving = true;
      const satT = sold ? (isHero ? .12 : .08) : 1; a.sat += (satT - a.sat) * kv; if (Math.abs(satT - a.sat) > .01) moving = true;
      /* lift: the dish in focus comes up towards the eye; a standing drink stays on the counter and the eye comes down instead */
      const liftT = isHero ? S.lift.x : 0; a.lift = isHero ? liftT : a.lift + (0 - a.lift) * (reduce ? 1 : ease(dt, 10)); if (a.lift > .002 && !isHero) moving = true;
      /* presence: the dish the table settles on comes up a little towards the guest, straightens, and its shadow opens; it goes back down as the table moves on */
      const nearT = a.leaving || a.guest || a.cat !== view.catId || reduce || !set ? 0 : smooth(1 - Math.abs(a.i - p) * 2.2) * calm; a.near += (nearT - a.near) * ease(dt, nearT > a.near ? 6.5 : 10);
      if (Math.abs(nearT - a.near) > .003) moving = true; else a.near = nearT;
      /* turn: only the lifted dish, by the finger; let go and it carries on, then comes back straight (a bottle stays where it stops) */
      const lim = a.type === 'drink' ? (a.drink.spec.turns ? Infinity : 0) : a.type === 'stand' ? .95 : a.type === 'relief' ? .45 : a.type === 'photo' ? .3 : .5;
      if (isHero && lifted) { if (!S.turning) { if (lim === 0) { a.turn.x = 0; a.turn.v = 0; } else turnStep(a.turn, lim, reduce ? 0 : dt); } }
      else if (!isFinite(lim)) { a.turn.v = 0; a.turn.x = Math.atan2(Math.sin(a.turn.x), Math.cos(a.turn.x)); a.turn.x *= reduce ? 0 : Math.exp(-dt * 9); if (Math.abs(a.turn.x) < .002) a.turn.x = 0; }
      else turnStep(a.turn, Math.max(lim, .01), reduce ? 0 : dt);
      if (reduce && !(isHero && lifted)) { a.turn.x = 0; a.turn.v = 0; }
      if (Math.abs(a.turn.x) > .0015 || Math.abs(a.turn.v) > .01) moving = true;
      const pres = a.near * (1 - a.lift), yaw_ = a.turn.x, up = a.lift * P.liftY + pres * RISE;
      P_.set(wx, 0, wz);
      const ry = Math.atan2(B.x - wx, B.z - wz) * .85 + (a.holo ? 0 : a.spin * (1 - .6 * a.near)) + yaw_;
      a.um.uReveal.value = rev; a.um.uLight.value = a.light; a.um.uSat.value = a.sat;
      if (a.drink) {
        const sp = a.drink.spec;
        if (a.pour) { a.pour.t += dt; a.pose = pourAt(a.pour.t, sp); if (a.pose.done) a.pour = null; moving = true; }
        else if (!a.pose.done) {                             // a pour that was cut short: bottle and glass return to rest quickly, they do not jump
          const r = REST(sp), k = reduce ? 1 : ease(dt, 9), q = a.pose; let far = 0;
          ['fade', 'tilt', 'level', 'wobble', 'foam', 'bubbles', 'cam'].forEach((f) => { q[f] += (r[f] - q[f]) * k; far = Math.max(far, Math.abs(r[f] - q[f])); });
          q.head = 0; q.tail = 1; if (far < .004) a.pose = r; else moving = true;
        }
        if (a.type !== 'drink') { const u = a.drink.shared; u.uReveal.value = rev; u.uLight.value = a.light; u.uSat.value = a.sat; }
        a.drink.update(a.pose, { cx: B.x, cz: B.z, wx: wx + a.shape.drinkX, wz: wz + a.shape.drinkZ, baseY: a.holo && a.type === 'drink' ? PUCK : 0, yaw: a.type === 'drink' ? yaw_ : 0, refl: U.refl.value, holo: a.holo });
      }
      if (a.type === 'relief' || a.type === 'stand') {
        const geo = isHero ? geoHi : geoLo; if (a.mesh.geometry !== geo) a.mesh.geometry = geo;
        const s = a.shape.s || 1;
        if (a.holo) {                                        // a projection: it floats over its puck, tinted and scan-lined; it is never the dish itself
          anyHolo = true;
          const fT = holoScene && !a.stock && isHero ? 1 : 0; a.um.uFocus.value += (fT - a.um.uFocus.value) * ease(dt, 6); a.ub.uOn.value += ((isHero ? 1 : .4) * rev - a.ub.uOn.value) * ease(dt, 5);
          a.um.uGlitch.value *= Math.exp(-dt * 7); if (a.um.uGlitch.value < .004) a.um.uGlitch.value = 0; else moving = true; a.um.uScan.value = isHero ? scan / (SIZE * s) : -9;
          const y0 = a.float + up + (reduce ? 0 : Math.sin(t * 1.1 + a.x * 2.1) * .018), el = Math.atan2(C.y - y0, Math.hypot(C.x - wx, C.z - wz));
          const tip = clamp(a.um.uE.value - el, -.4, .4), sc = SIZE * s * (isHero ? 1.04 : 1);
          [a.mesh, a.refl].forEach((m) => { m.position.y = y0; m.rotation.y = ry; m.rotation.x = tip; m.scale.setScalar(sc); });
          a.mir.position.y = 2 * PUCK; a.refl.material.depthTest = true; a.refl.visible = a.ready && holoScene; a.shadow.visible = false;
          if (live) moving = moving || 'slow';
        } else {
          const sc = SIZE * s * (.96 + .04 * rev) * (1 + .035 * a.lift + .012 * pres);
          [a.mesh, a.refl].forEach((m) => { m.position.y = .016 + up; m.rotation.y = ry; m.rotation.x = 0; m.scale.setScalar(sc); });
          a.mir.position.y = 0; a.refl.material.depthTest = false; a.refl.visible = a.ready && a.lift < .02 && a.room === here && U.refl.value > .02 && (a.type === 'stand' || a.shape.top > .5);
          const su = a.shadow.material.uniforms; a.shadow.visible = a.ready; a.shadow.rotation.y = ry; a.shadow.scale.setScalar(sc * (1 + .16 * a.lift + .03 * pres)); su.uK.value = (a.type === 'stand' ? .5 : .74) * rev * (1 - .42 * a.lift - .1 * pres); su.uSoft.value = 1.6 * a.lift + .7 * pres;
          const cx = wx - (lampX + .5), cz = wz - (lampZ + 1.5), cl = Math.hypot(cx, cz) || 1, push = (Math.min(.1, .035 + cl * .016) + .22 * a.lift + .05 * pres) / sc; su.uCast.value.set(cx / cl * push, cz / cl * push - (.1 * a.lift + .02 * pres) / sc);      // it falls away from the lamp, and opens as the dish comes up
        }
      } else if (a.type === 'drink') {
        if (a.holo) { anyHolo = true; a.ub.uOn.value += ((isHero ? 1 : .4) * rev - a.ub.uOn.value) * ease(dt, 5); }
      } else if (a.type === 'photo') {
        const w = a.cardSize[0], h = a.cardSize[1];
        a.mesh.position.y = .014 + up; a.mesh.rotation.y = a.spin * 1.6 + yaw_; a.mesh.rotation.x = -PI / 2;                 // it lies flat, like a print someone put down
        a.shadow.rotation.z = a.spin * 1.6; a.shadow.position.set(.03 + .2 * a.lift, .006, .05 + .16 * a.lift); a.shadow.scale.set(w * 1.22, h * 1.3, 1); a.shadow.material.uniforms.uK.value = .55 * rev * (1 - .4 * a.lift);
      } else {
        a.tent.position.y = up; a.tent.rotation.y = Math.atan2(B.x - wx, B.z - wz) * .5 + a.spin + yaw_;
        a.shadow.position.set(.04, .006, 0); a.shadow.scale.set(CARD[0] * 1.3, CARD[1] * 1.5, 1); a.shadow.material.uniforms.uK.value = .5 * rev * (1 - .5 * a.lift);
        if (a.holo) a.ub.uOn.value += ((isHero ? 1 : .4) * rev - a.ub.uOn.value) * ease(dt, 5);
      }
    });
    dead.forEach(dropActor); if (dead.length) sweepTextures(); S.glowing = anyHolo;
    if (H && H.g.visible) {
      const on = hero && hero.ready ? 1 : 0; H.fxOn += (on - H.fxOn) * ease(dt, 6); H.fxU.uOn.value = H.fxOn; if (hero) H.fx.position.copy(hero.g.position);
      H.hoop.position.y = FLOAT + Math.max(scan, 0) * .92; H.hoop.material.uniforms.uOn.value = scan > -1 ? H.fxOn * Math.sin(clamp((scan + .06) / 1.0) * PI) : 0;
      H.halo.position.set(lampX, .8, lampZ - 1.4); H.halo.material.opacity = .14 + (reduce ? 0 : Math.sin(t * .9) * .02); H.floor.position.set(fx, -.02, fz);
    }
    const ready = !!(hero && hero.ready && hero.vis > .9 && here && here.fade > .85 || (hero && hero.ready && holoScene));
    if (ready !== S.heroReady) { S.heroReady = ready; if (opts.onHero) opts.onHero(ready, hero ? hero.id : null); }
    if (S.dragX.active || S.turning || glide.busy()) moving = true;
    S.moving = moving; return moving;
  }
  function draw() {
    if (S.lost || !S.w || !S.view) return;
    const bloom = S.bloom && (S.glowing || S.room === 'holo' || rooms.bar.fade > .01); renderer.info.reset();      // the bar glows for as long as any of it is in the picture
    if (bloom) {
      /* the light-only pass. If nothing on the food table gives off light (no projected placeholder there), its dishes sit this
         pass out: the only light is the bar's, far behind anything flat on a table. On the walk between the two rooms that
         saves drawing every relief a second time. */
      const hv = H ? H.halo.visible : false, flat = !S.glowing && S.room !== 'holo'; U.glow.value = 1; if (H) H.halo.visible = false; if (flat) camera.layers.disable(1);
      renderer.setRenderTarget(rtG); renderer.render(scene, camera); U.glow.value = 0; if (H) H.halo.visible = hv; if (flat) camera.layers.enable(1);
      blur(rtG, rtB1, 2 / rtG.width, 0); blur(rtB1, rtB2, 0, 1.5 / rtB1.height); blur(rtB2, rtC1, 2 / rtB2.width, 0); blur(rtC1, rtC2, 0, 2 / rtC1.height);
    }
    renderer.setRenderTarget(null); renderer.render(scene, camera);
    if (bloom) { quad.material = bloomM; renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = true; }
    S.frames++; S.stats.calls = renderer.info.render.calls; S.stats.triangles = renderer.info.render.triangles; hotspots();
    if (!S.full && opts.onFull && S.heroReady) { S.full = true; opts.onFull(); }
  }
  /* where each thing is on screen, so a tap can be matched to it */
  const pj = (x, y, z) => { V2.set(x, y, z).project(camera); return [(V2.x * .5 + .5) * S.w, (.5 - V2.y * .5) * S.h]; };
  function hotspots() {
    const out = [];
    S.actors.forEach((a) => {
      if (a.leaving || !a.ready || a.vis < .5) return;
      const up = a.type === 'stand' || a.type === 'drink' || a.type === 'text', x = a.x, z = a.z, r = a.type === 'text' ? CARD[0] / 2 : a.shape.r, y0 = a.lift * S.preset.liftY + (a.holo ? (a.float || 0) * .8 : 0), top = a.type === 'text' ? CARD[1] * .9 : up ? a.shape.top : a.shape.top * .5;
      const l = pj(x - r, y0, z), rr = pj(x + r, y0, z), f = pj(x, y0, z + (up ? r * .5 : r)), bk = pj(x, y0 + top, up ? z : z - r);
      out.push({ id: a.id, i: a.i, cx: (l[0] + rr[0]) / 2, cy: (f[1] + bk[1]) / 2, rx: Math.abs(rr[0] - l[0]) / 2, ry: Math.abs(f[1] - bk[1]) / 2, z: a.z });
    });
    S.hot = out;
  }
  function hit(x, y) {
    let best = null; const hero = S.view ? S.view.itemId : null;
    S.hot.forEach((h) => { const dx = (x - h.cx) / (h.rx * 1.04), dy = (y - h.cy) / (h.ry * 1.06); if (dx * dx + dy * dy <= 1 && (!best || h.id === hero || (best.id !== hero && h.z > best.z))) best = h; });
    return best ? best.id : null;
  }

  /* ---- waking: the page's one ticker calls step and draw; the stage only says when there is something to do ---- */
  function wake() { if (S.disposed || S.lost) return; if (opts.wake) opts.wake(); }
  /* a phone that cannot keep up loses the bloom first, then the extra pixels; if it still crawls, the menu becomes a list */
  function perf(raw) {
    S.slow = raw > .045 ? S.slow + (raw > .12 ? 3 : 1) : Math.max(0, S.slow - 2);
    if (S.slow > 45) { S.slow = 0; S.tier++; if (S.tier === 1) S.bloom = false; else if (S.tier === 2) { pr = 1; renderer.setPixelRatio(1); U.px.value = 1; size(true); } else if (S.tier === 3) { pr = .7; renderer.setPixelRatio(pr); size(true); } if (opts.onTier) opts.onTier(S.tier); }      // tier 4: the caller shows the list instead
  }
  function size(force) {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    if (!force && w === S.w && h === S.h) return;
    S.w = w; S.h = h; renderer.setSize(w, h, false); camera.aspect = w / h;
    const bw = renderer.domElement.width, bh = renderer.domElement.height, s2 = (n) => Math.max(2, Math.round(n));
    rtG.setSize(s2(bw / 2), s2(bh / 2)); rtB1.setSize(s2(bw / 4), s2(bh / 4)); rtB2.setSize(s2(bw / 4), s2(bh / 4)); rtC1.setSize(s2(bw / 8), s2(bh / 8)); rtC2.setSize(s2(bw / 8), s2(bh / 8));
    if (S.view && S.preset) { refit(); snapCamera(); }
    wake();
  }
  const onLost = (e) => { e.preventDefault(); S.actors.forEach((a) => { a.pour = null; if (a.drink) a.pose = REST(a.drink.spec); }); S.lost = true; if (opts.onLost) opts.onLost(true); };
  const onRestored = () => { S.lost = false; S.w = 0; reset(); size(true); if (opts.onLost) opts.onLost(false); wake(); };
  canvas.addEventListener('webglcontextlost', onLost, false); canvas.addEventListener('webglcontextrestored', onRestored, false);

  /* a rough count of what sits on the GPU, in megabytes: pictures (with their mip chains), printed labels, the bloom buffers */
  function memory() {
    const px = (im, mip) => (im && im.width ? im.width * im.height * 4 * (mip ? 1.33 : 1) : 0); let pictures = 0, labels = 0, surfaces = 0;
    texCache.forEach((e) => { if (e.ready) pictures += px(e.tex.image, e.tex.generateMipmaps); });
    surf.texs.forEach((v) => { if (v.map && v.map.image) surfaces += px(v.map.image, true); if (v.h && v.h.image) surfaces += px(v.h.image, true); });
    actorsG.traverse((o) => { const m = o.material && o.material.uniforms && o.material.uniforms.map; if (m && m.value && m.value.isCanvasTexture && !(o.material.uniforms.uMirror && o.material.uniforms.uMirror.value) && !(o.material.uniforms.uBlank && o.material.uniforms.uBlank.value)) labels += px(m.value.image, true); });
    const targets = [rtG, rtB1, rtB2, rtC1, rtC2].reduce((n, t) => n + t.width * t.height * 4, 0) + rtG.width * rtG.height * 4;
    const mb = (n) => +(n / 1048576).toFixed(1);
    return { pictures: mb(pictures), labels: mb(labels), surfaces: mb(surfaces), targets: mb(targets), total: mb(pictures + labels + surfaces + targets) };
  }
  /* let go of everything that stands on the table; the next sync lays it again */
  function reset() { dropTitles(); S.devZ.x = 0; S.devZ.v = 0; [...S.actors.values()].forEach(dropActor); S.view = null; S.first = true; S.hot = []; S.heroReady = null; S.lane = { x: 0, z: 0, places: [], n: 0, cat: null, kind: 'food' }; S.guests.prev = S.guests.next = null; S.lastP = null; S.dev.x = 0; S.dev.v = 0; S.lampK = 1; S.edge = null; S.full = false; }
  return {
    sync, size, hit, repaintCards, step, draw, perf, touch,
    /* a sideways drag: the table follows the finger; let go and it slides to wherever the state now says */
    dragX(dx, active) { S.dragX.active = !!active; S.dragX.dx = active ? dx : 0; touch(); wake(); },
    /* turning the lifted dish */
    turn(dx, active, v) { const view = S.view; if (!view || !view.lifted) { S.turning = false; return; } const a = S.actors.get(view.itemId); if (!a) return;
      const lim = a.type === 'drink' ? (a.drink.spec.turns ? Infinity : 0) : a.type === 'stand' ? .95 : a.type === 'relief' ? .45 : a.type === 'photo' ? .3 : .5;
      if (active) { S.turning = true; a.pour = null;                                   // a bottle that is being turned is not pouring
        const nx = a.turn.x + dx * .0085; a.turn.x = isFinite(lim) ? clamp(nx, -lim, lim) : nx; a.turn.v = 0; } else { S.turning = false; a.turn.v = reduce || lim === 0 ? 0 : clamp((v || 0) * .0085, -9, 9); }
      touch(); wake(); },
    turnBy(rad) { const view = S.view; if (!view || !view.lifted) return; const a = S.actors.get(view.itemId); if (a) { if (reduce) a.turn.x += rad; else a.turn.v += rad * 6; touch(); wake(); } },
    setPointer(x, y) { S.ptrT[0] = clamp(x, -1, 1); S.ptrT[1] = clamp(y, -1, 1); wake(); },
    setTilt(x, y) { S.tiltT[0] = clamp(x, -1, 1); S.tiltT[1] = clamp(y, -1, 1); wake(); },
    feedFrameTime(raw) { S.frames = 99; perf(raw); },
    metrics: () => (S.frame ? S.frame : null),
    /* how far along the table dish p stands, in the room of one plate (what a finger's travel is measured in), and back */
    along: (p) => (S.preset && S.lane.n ? alongAt(S.lane.places, p, S.preset.S) / S.preset.S : p), dish: (u) => (S.preset && S.lane.n ? dishAt(S.lane.places, u * S.preset.S, S.preset.S) : u),
    pending: () => pending,
    loaded: (ms = 8000) => (pending === 0 ? Promise.resolve() : new Promise((res) => { waiters.push(res); setTimeout(res, ms); })),
    info: () => ({ moving: S.moving, tier: S.tier, bloom: S.bloom, pixelRatio: pr, frames: S.frames, p: +glide.state.p.toFixed(4), mode: glide.state.mode, lampK: +S.lampK.toFixed(3), lift: +S.lift.x.toFixed(3), fade: +(S.room === 'holo' ? 1 : rooms[S.room].fade).toFixed(3), rooms: { table: +rooms.table.fade.toFixed(3), bar: +rooms.bar.fade.toFixed(3) }, edge: S.edge ? { z: +S.edge.z.toFixed(2), at: +S.edge.zTo.toFixed(3), to: S.edge.to, s: S.edge.s, away: +S.edge.away.toFixed(2) } : null, heroReady: !!S.heroReady,
      actors: [...S.actors.values()].map((a) => ({ id: a.id, i: a.i, type: a.type, holo: a.holo, ready: a.ready, leaving: a.leaving, left: a.leaving && a.visT > 0, guest: a.guest, cat: a.cat, vis: +a.vis.toFixed(3), yaw: +a.turn.x.toFixed(3), lift: +a.lift.toFixed(3), near: +a.near.toFixed(3), light: +a.light.toFixed(3), sat: +a.sat.toFixed(2), x: +a.x.toFixed(2), z: +a.z.toFixed(2), pouring: !!a.pour, pose: a.pose ? { tilt: +a.pose.tilt.toFixed(3), level: +a.pose.level.toFixed(3), foam: +a.pose.foam.toFixed(3), fade: +a.pose.fade.toFixed(3), t: a.pour ? +a.pour.t.toFixed(2) : null } : null, tris: a.drink ? a.drink.tris : undefined })),
      hot: S.hot.map((h) => ({ id: h.id, cx: Math.round(h.cx), cy: Math.round(h.cy), rx: Math.round(h.rx), ry: Math.round(h.ry) })),
      pours: S.pours, drinks: kit.stats(), stats: { calls: S.stats.calls, triangles: S.stats.triangles }, memory: memory(), lane: { x: +S.lane.x.toFixed(2), z: +S.lane.z.toFixed(2) }, walkOn: +S.devZ.x.toFixed(3), titles: S.titles.map((t) => ({ text: t.text, z: +t.z.toFixed(2), k: +t.k.toFixed(2) })),
      textures: texCache.size, surfaces: surf.texs.size, scene: S.preset ? S.preset.id : null, lost: S.lost, frame: S.frame, cam: { pos: camera.position.toArray(), line: +S.focus.x.toFixed(4), E: +S.E.x.toFixed(2), zoom: +S.zoom.x.toFixed(3), cy: +S.cy.x.toFixed(1), fov: camera.fov }, gl: { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures } }),
    /* no table for now (the list is the menu): let go of everything heavy; the next sync builds it again */
    sleep() { reset(); texCache.forEach((e) => e.tex && e.tex.dispose()); texCache.clear(); renderer.setRenderTarget(null); renderer.clear(); },
    reset, isLost: () => S.lost,
    /* filming: every take starts from the same instant (the sway, the scan line and the intro all hang on the clock) */
    rewind() { S.clock = 0; S.touchAt = 0; S.swayK = 0; S.intro = 0; S.tilt = [0, 0]; S.tiltT = [0, 0]; S.ptr = [0, 0]; S.ptrT = [0, 0]; U.pulse.value = 9; if (H) H.scanAt = 2.2; },
    hush() { S.hush = true; },
    setWalk(w) { S.walk = w === -1 ? -1 : 1; },
    setTheme(th) { if (!th) return; theme = th; if (th.accent) U.accent.value.set(th.accent); S.preset = null; },
    resetPerf() { S.tier = 0; S.slow = 0; S.bloom = true; pr = opts.pixelRatio || Math.min(window.devicePixelRatio || 1, 2); renderer.setPixelRatio(pr); U.px.value = pr; S.w = 0; },
    dispose() { S.disposed = true; dropTitles(); canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
      [...S.actors.values()].forEach(dropActor); texCache.forEach((e) => e.tex && e.tex.dispose()); texCache.clear(); surf.texs.forEach((v) => { if (v.map) v.map.dispose(); if (v.h) v.h.dispose(); }); renderer.dispose(); }
  };
}
