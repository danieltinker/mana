/* The shape-shifting dish in the hero of halom.io/mana: one textured dish floating in soft studio light, slowly turning;
   every few seconds it burns into particles of light (mana) that swirl and re-form into the next dish.
   Brand art made with AI (the page labels it so); it is not what the product makes.

   mountHero(host, opts) → { pause(), resume(), destroy() } | null (no WebGL)
     host  an empty, CSS-sized, position:relative element; the module appends its own transparent <canvas>
     opts  { base: './img/dishes/', ids: [...], reduced, lowPower, onDish(i), onReady(), onFail(err) }
   Lab only: opts.debug = { dish: i } (rest frame) or { from: a, to: b, t: 0..1 } (a frozen moment of a shift), with an
   optional angle (degrees) and onFrame(info); the loop then renders that frame only. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Points, PlaneGeometry, BufferGeometry, BufferAttribute,
  Float32BufferAttribute, MeshBasicMaterial, ShaderMaterial, CanvasTexture, HemisphereLight, DirectionalLight, Color,
  ACESFilmicToneMapping, sRGBEncoding, NormalBlending, PMREMGenerator, TextureLoader, MathUtils
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { KEY_GLSL, POINTS_VERT, POINTS_FRAG, MOTES_VERT, MOTES_FRAG } from './hero/glsl.js';
import { bake, pixels, permutation, sampleSurface } from './hero/sample.js';

const REST = 3000, SHIFT = 2000, TURN = 36000, FLOAT = 4200, EDGE = 0.07;
const FOV = 26, ELEV = MathUtils.degToRad(22);
const lin = (hex) => new Color(hex).convertSRGBToLinear();
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const isSafari = () => typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
}

/* One onBeforeCompile for every dish (one shader program): discard where the burn key is under uCut, glow at the edge. */
function dissolve(mat, u) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = u.uCut; sh.uniforms.uH = u.uH; sh.uniforms.uEdge = u.uEdge; sh.uniforms.uEdgeColor = u.uEdgeColor;
    sh.vertexShader = 'varying vec3 vDishPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvDishPos = transformed;');
    sh.fragmentShader = 'varying vec3 vDishPos;\nuniform float uCut, uH, uEdge;\nuniform vec3 uEdgeColor;\n' + KEY_GLSL +
      sh.fragmentShader
        .replace('void main() {', 'void main() {\nfloat hmK = 1.0;\nif (uCut > -0.9 * uEdge) hmK = hm_key(vDishPos, uH);\nif (hmK < uCut) discard;\nfloat hmGlow = 1.0 - smoothstep(uCut, uCut + uEdge * 0.4, hmK);\nfloat hmWarm = (1.0 - smoothstep(uCut, uCut + uEdge * 1.3, hmK)) * step(-0.5 * uEdge, uCut);')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uEdgeColor * (hmGlow * 1.9) + uEdgeColor * (hmWarm * 0.35);\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.0, 0.62, 0.32), hmWarm);')
        .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb = max(mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, 1.14), 0.0);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor, 0.5, 0.92);');
  };
}

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(74,48,24,0.5)'); r.addColorStop(0.3, 'rgba(74,48,24,0.3)'); r.addColorStop(0.65, 'rgba(74,48,24,0.08)'); r.addColorStop(1, 'rgba(74,48,24,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

export async function mountHero(host, opts = {}) {
  if (!host || !hasWebGL()) return null;
  const ids = opts.ids && opts.ids.length ? opts.ids : ['pizza', 'burger', 'ramen', 'croissant', 'shakshuka', 'gelato'];
  const base = opts.base || './img/dishes/', reduced = !!opts.reduced, lowPower = !!opts.lowPower, dbg = opts.debug || null;
  const call = (f, ...a) => { try { if (typeof f === 'function') f(...a); } catch (e) { /* the page's callbacks never break the loop */ } };
  const N = lowPower ? 11000 : 24000;

  let renderer;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail(new Error('hero: the GL context was lost')); }, { once: true });      // the page shows its stills again
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
  try {
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: !lowPower, premultipliedAlpha: true, powerPreference: lowPower ? 'default' : 'high-performance' });
  } catch (e) { return null; }
  host.appendChild(canvas);
  renderer.setClearColor(0x000000, 0);
  renderer.outputEncoding = sRGBEncoding;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  const maxDpr = lowPower ? 1.5 : 1.75;

  const scene = new Scene(), camera = new PerspectiveCamera(FOV, 1, 0.1, 50);
  const pmrem = new PMREMGenerator(renderer), env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();
  scene.environment = env; mark('hero-env');
  scene.add(new HemisphereLight(0xffffff, 0xf1dfc4, 0.55));
  const key = new DirectionalLight(0xfff0dc, 1.55); key.position.set(2.2, 4.2, 3.4); scene.add(key);
  const rim = new DirectionalLight(0xd9e6ff, 1.15); rim.position.set(-3.2, 2.4, -4.2); scene.add(rim);

  // root (pointer tilt) → stage (centres the dish) → shadow | float → spin → dishes, particles ; motes on the stage
  const root = new Group(), stage = new Group(), floatG = new Group(), spin = new Group();
  scene.add(root); root.add(stage); stage.add(floatG); floatG.add(spin);
  const shadowTex = shadowTexture();
  const shadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.07; shadow.renderOrder = -1; stage.add(shadow);

  const perm = permutation(N, 11);
  const dishes = ids.map((id) => ({ id, state: 'idle', mesh: null, u: null, height: 1, foot: 0.8, pos: null, col: null }));
  const edgeColor = lin(0xff8a1e).multiplyScalar(1.7);

  // particles: position = A, aB = B, colours A/B, per-particle randoms
  const pGeo = new BufferGeometry();
  const rnd = new Float32Array(N * 4); { let s = 99; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); for (let i = 0; i < N * 4; i++) rnd[i] = r(); }
  pGeo.setAttribute('aRnd', new BufferAttribute(rnd, 4));
  const pU = { uU: { value: 0 }, uW: { value: EDGE }, uHA: { value: 1 }, uHB: { value: 1 }, uTime: { value: 0 }, uScale: { value: 400 }, uSize: { value: lowPower ? 0.017 : 0.0125 }, uSwirl: { value: 2.4 }, uOpacity: { value: 1 } };
  const pMat = new ShaderMaterial({ uniforms: pU, vertexShader: POINTS_VERT, fragmentShader: POINTS_FRAG, transparent: true, depthWrite: false, depthTest: true, blending: NormalBlending });
  const points = new Points(pGeo, pMat); points.frustumCulled = false; points.visible = false; points.renderOrder = 2; spin.add(points);

  // motes
  const M = reduced ? 0 : lowPower ? 160 : 300;
  const mGeo = new BufferGeometry(), mPos = new Float32Array(Math.max(M, 1) * 3), mRnd = new Float32Array(Math.max(M, 1) * 4);
  { let s = 5; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < M; i++) { mPos[i * 3] = 1.02 + 0.55 * Math.pow(r(), 0.7); mPos[i * 3 + 1] = -0.9 + 1.9 * r(); mPos[i * 3 + 2] = 0; for (let k = 0; k < 4; k++) mRnd[i * 4 + k] = r(); } }
  mGeo.setAttribute('position', new BufferAttribute(mPos, 3)); mGeo.setAttribute('aRnd', new BufferAttribute(mRnd, 4));
  const mU = { uPhase: { value: 0 }, uTime: { value: 0 }, uScale: { value: 400 }, uSize: { value: 0.016 }, uEnergy: { value: 0 }, uOpacity: { value: 0 } };
  const motes = new Points(mGeo, new ShaderMaterial({ uniforms: mU, vertexShader: MOTES_VERT, fragmentShader: MOTES_FRAG, transparent: true, depthWrite: false }));
  motes.frustumCulled = false; motes.visible = M > 0; motes.renderOrder = 3; root.add(motes);

  // ---- loading ----
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  if (isSafari()) loader.register((parser) => { parser.textureLoader = new TextureLoader(parser.options.manager); return { name: 'hm_safari_textures' }; });
  let dead = false, failed = false;

  async function load(i) {
    const d = dishes[i]; if (d.state !== 'idle') return d.ready; d.state = 'loading';
    d.ready = (async () => {
      const gltf = await new Promise((res, rej) => loader.load(base + d.id + '.glb', res, undefined, rej));
      if (dead) return;
      mark('hero-glb-' + d.id);
      let src = null; gltf.scene.updateMatrixWorld(true); gltf.scene.traverse((o) => { if (!src && o.isMesh) src = o; });
      if (!src) throw new Error('no mesh in ' + d.id);
      const b = bake(src);
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute(b.pos, 3));
      if (b.nrm) g.setAttribute('normal', new Float32BufferAttribute(b.nrm, 3)); else g.computeVertexNormals();
      if (b.uv) g.setAttribute('uv', new Float32BufferAttribute(b.uv, 2));
      g.setIndex(new BufferAttribute(b.index, 1)); g.computeBoundingSphere();
      const mat = src.material;
      mat.metalness = 0; mat.metalnessMap = null; mat.roughness = 1; mat.envMapIntensity = 0.75;
      if (mat.normalMap) mat.normalScale.set(0.9, 0.9);
      if (lowPower && mat.roughnessMap) { mat.roughnessMap.dispose(); mat.roughnessMap = null; mat.roughness = 0.72; } // a third less texture memory on phones
      d.u = { uCut: { value: -EDGE }, uH: { value: b.height }, uEdge: { value: EDGE }, uEdgeColor: { value: edgeColor } };
      dissolve(mat, d.u);
      d.mesh = new Mesh(g, mat); d.mesh.visible = false; d.mesh.renderOrder = 1; spin.add(d.mesh);
      src.geometry.dispose();
      d.height = b.height; d.foot = b.foot;
      d.baked = b;
      mark('hero-mesh-' + d.id);
      for (const t of [mat.map, mat.normalMap, mat.roughnessMap]) if (t && renderer.initTexture) renderer.initTexture(t);
      d.state = 'ready';
    })().catch((e) => { d.state = 'failed'; if (i === firstId) fail(e); });
    return d.ready;
  }

  /* The dish's particles: N surface points with their colours (sliced so no frame stalls). */
  async function sample(i) {
    const d = dishes[i]; if (d.state !== 'ready' || d.pos || !d.baked) return;
    const mat = d.mesh.material, size = 256, rgba = mat.map && mat.map.image ? pixels(mat.map.image, size) : null;
    const s = await sampleSurface(d.baked, rgba, size, N, perm, i + 3);
    if (dead) return;
    d.pos = new BufferAttribute(s.pos, 3); d.col = new BufferAttribute(s.col, 3, true); d.baked = null;
    mark('hero-sampled-' + d.id);
  }

  // ---- layout ----
  let W = 1, H = 1;
  function resize() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    if (w === W && h === H && renderer.domElement.width) return false;
    W = w; H = h;
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    camera.aspect = W / H;
    const fv = MathUtils.degToRad(FOV), fh = 2 * Math.atan(Math.tan(fv / 2) * camera.aspect);
    const dist = Math.max(1 / Math.sin(fv / 2), 1 / Math.sin(fh / 2)) * 1.12;
    camera.position.set(0, Math.sin(ELEV) * dist, Math.cos(ELEV) * dist); camera.lookAt(0, -0.04, 0);
    camera.updateProjectionMatrix();
    const scale = (H * dpr) / (2 * Math.tan(fv / 2));
    pU.uScale.value = scale; mU.uScale.value = scale;
    return true;
  }

  // ---- state ----
  let cur = -1, next = -1, phase = 'rest', phaseT = 0, clock = 0, spinA = MathUtils.degToRad(-28), raf = 0, last = 0, running = false;
  let drawn = false, tiltX = 0, tiltY = 0, aimX = 0, aimY = 0, motePhase = 0, moteOn = 0;
  const frames = { rest: [], shift: [] };
  let drawFrac = 1, lastCost = 0, shiftFrom = 0;
  const firstId = dbg && dbg.from != null ? dbg.from : dbg && dbg.dish != null ? dbg.dish : 0;

  function setShift(a, b) {
    const A = dishes[a], B = dishes[b];
    pGeo.setAttribute('position', A.pos); pGeo.setAttribute('aB', B.pos);
    pGeo.setAttribute('aCA', A.col); pGeo.setAttribute('aCB', B.col);
    pU.uHA.value = A.height; pU.uHB.value = B.height;
    pGeo.setDrawRange(0, Math.floor(N * drawFrac));
  }

  /* Applies the scene for: resting on dish `a`, or a shift a → b at progress u (0..1). */
  function pose(a, b, u) {
    const A = dishes[a];
    for (const d of dishes) if (d.mesh) d.mesh.visible = false;
    let h = A.height, foot = A.foot, shadowK = 1;
    if (b < 0 || u <= 0) {
      A.mesh.visible = true; A.u.uCut.value = -EDGE; points.visible = false;
    } else {
      const B = dishes[b], pa = clamp01(u / 0.42), pb = clamp01((u - 0.58) / 0.42);
      A.u.uCut.value = pa * (1 + 2 * EDGE) - EDGE; A.mesh.visible = pa < 1;
      B.u.uCut.value = (1 - pb) * (1 + 2 * EDGE) - EDGE; B.mesh.visible = pb > 0;
      points.visible = true; pU.uU.value = u;
      const k = smooth(0.15, 0.85, u); h = A.height + (B.height - A.height) * k; foot = A.foot + (B.foot - A.foot) * k;
      shadowK = 1 - 0.85 * Math.sin(Math.PI * u);
    }
    stage.position.y = -h / 2;
    return { foot, shadowK };
  }

  function frame(dt) {
    clock += dt;
    if (!reduced && !dbg) {
      phaseT += dt;
      if (phase === 'rest' && phaseT >= REST) {
        const n = nextReady(cur);
        if (n >= 0) { next = n; phase = 'shift'; phaseT = 0; setShift(cur, next); }
        else phaseT = REST - 400;
      } else if (phase === 'shift' && phaseT >= SHIFT) {
        cur = next; next = -1; phase = 'rest'; phaseT = 0; call(opts.onDish, cur); adapt();
      }
      spinA += (dt / TURN) * Math.PI * 2;
    }
    const u = phase === 'shift' ? clamp01(phaseT / SHIFT) : 0;
    const { foot, shadowK } = pose(cur, phase === 'shift' ? next : -1, u);
    spin.rotation.y = spinA;
    const fl = reduced ? 0 : Math.sin((clock / FLOAT) * Math.PI * 2);
    floatG.position.y = 0.035 * fl + (phase === 'shift' ? 0.05 * Math.sin(Math.PI * u) : 0);
    const sc = foot * 2.5 * (1 - 0.06 * fl);
    shadow.scale.set(sc, sc, 1); shadow.material.opacity = shadowK * (1 - 0.14 * fl);
    // pointer tilt, smoothed
    const k = 1 - Math.exp(-dt / 260);
    tiltX += (aimX - tiltX) * k; tiltY += (aimY - tiltY) * k;
    root.rotation.set(tiltY * MathUtils.degToRad(6), tiltX * MathUtils.degToRad(8), 0);
    // motes
    const energy = phase === 'shift' ? Math.sin(Math.PI * u) : 0;
    motePhase += (dt / 1000) * (1 + 2.2 * energy);
    moteOn = Math.min(1, moteOn + dt / 1600);
    mU.uPhase.value = motePhase; mU.uTime.value = clock / 1000; mU.uEnergy.value = energy; mU.uOpacity.value = moteOn;
    pU.uTime.value = clock / 1000;
    renderer.render(scene, camera);
  }

  function nextReady(from) {
    for (let s = 1; s < ids.length; s++) { const j = (from + s) % ids.length; if (dishes[j].state === 'ready' && dishes[j].pos) return j; }
    return -1;
  }

  // if shifts run slow, draw fewer particles (any prefix of the buffer is an even subset)
  function adapt() {
    const f = frames.shift.slice(shiftFrom); shiftFrom = frames.shift.length; if (f.length < 20) return;
    const avg = f.reduce((a, b) => a + b, 0) / f.length;
    if (frames.shift.length > 600) { frames.shift.splice(0, 300); shiftFrom = frames.shift.length; }
    if (avg > 30 && drawFrac > 0.5) drawFrac = Math.max(0.5, drawFrac * 0.75);
  }

  function tick(t) {
    raf = 0; if (!running || dead) return;
    const raw = last ? t - last : 16, dt = Math.min(50, raw); last = t;
    const t0 = performance.now(); frame(dt);
    (phase === 'shift' ? frames.shift : frames.rest).push(raw);
    if (frames.rest.length > 240) frames.rest.splice(0, 120);
    if (!drawn) { drawn = true; firstDrawn(); }
    lastCost = performance.now() - t0;
    raf = requestAnimationFrame(tick);
  }

  function firstDrawn() { clearTimeout(timer); mark('hero-first-dish'); call(opts.onReady); call(opts.onDish, cur); }
  function mark(name) { try { performance.mark(name); } catch (e) { /* old browsers */ } }

  function renderStill() {
    if (dead || cur < 0) return;
    if (dbg && dbg.from != null && dbg.to != null) {
      phase = 'shift'; next = dbg.to; phaseT = clamp01(dbg.t || 0) * SHIFT; setShift(dbg.from, dbg.to);
    }
    frame(0);
    if (!drawn) { drawn = true; firstDrawn(); }
    if (dbg && dbg.onFrame) call(dbg.onFrame, { dish: cur, next, t: dbg.t, N: Math.floor(N * drawFrac) });
  }

  // ---- lifecycle ----
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (resize() && (reduced || dbg || !running)) renderStill(); }) : null;
  if (ro) ro.observe(host); else window.addEventListener('resize', onWinResize);
  function onWinResize() { if (resize() && (reduced || dbg || !running)) renderStill(); }
  const fine = !lowPower && window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  function onMove(e) { aimX = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1)); aimY = Math.max(-1, Math.min(1, (e.clientY / window.innerHeight) * 2 - 1)); }
  if (fine && !reduced && !dbg) window.addEventListener('pointermove', onMove, { passive: true });
  resize();

  function fail(e) {
    if (failed || dead) return; failed = true;
    call(opts.onFail, e instanceof Error ? e : new Error(String(e)));
    destroy();
  }
  const timer = setTimeout(() => { if (!drawn) fail(new Error('hero: nothing drawn after 8 s')); }, 8000);

  let paused = false;
  function start() { if (running || dead || reduced || dbg || cur < 0 || paused) return; running = true; last = 0; raf = requestAnimationFrame(tick); }
  function pause() { paused = true; running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function resume() { if (dead) return; paused = false; start(); }

  function destroy() {
    if (dead) return; dead = true; running = false; clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
    if (ro) ro.disconnect(); else window.removeEventListener('resize', onWinResize);
    window.removeEventListener('pointermove', onMove);
    for (const d of dishes) if (d.mesh) {
      d.mesh.geometry.dispose(); const m = d.mesh.material;
      for (const t of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap, m.emissiveMap, m.aoMap]) if (t) { if (t.image && t.image.close) try { t.image.close(); } catch (e) { /* closed */ } t.dispose(); }
      m.dispose();
    }
    pGeo.dispose(); pMat.dispose(); mGeo.dispose(); motes.material.dispose(); shadow.geometry.dispose(); shadow.material.dispose(); shadowTex.dispose(); env.dispose();
    renderer.dispose(); try { renderer.forceContextLoss(); } catch (e) { /* lost already */ }
    canvas.remove();
  }

  // first dish first, then the rest one by one in the background
  (async () => {
    await load(firstId);
    if (dead || dishes[firstId].state !== 'ready') return;
    cur = firstId;
    if (dbg && dbg.angle != null) spinA = MathUtils.degToRad(dbg.angle);
    if (dbg && dbg.to != null) { await load(dbg.to); await sample(firstId); await sample(dbg.to); if (dead) return; }
    renderStill();
    if (reduced || dbg) return;
    start();
    await sample(firstId);
    for (let s = 1; s < ids.length; s++) {
      await new Promise((r) => setTimeout(r, lowPower ? 900 : 400));
      while (paused && !dead) await new Promise((r) => setTimeout(r, 500));      // nothing is fetched while the dish is paused
      if (dead) return;
      const j = (firstId + s) % ids.length;
      await load(j); await sample(j);
    }
  })().catch((e) => fail(e));

  // _stats: lab and tests only (frame intervals, particle count, what has loaded)
  return { pause, resume, destroy, _stats: () => ({ frames, N, drawFrac, phase, cur, lastCost, loaded: dishes.filter((d) => d.state === 'ready').map((d) => d.id) }) };
}
