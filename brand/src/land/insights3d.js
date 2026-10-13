/* "What you learn" as one living scene (round two): a glass table in three-quarter view. The week's views flow in as light and
   gather in its heart; the 24 hours stand round its edge as a ring that rises and falls while a clock runs round it, day by
   day; on the table the week's top dishes race, and when one overtakes another they smoothly swap lanes. The share from the
   QR, the tourists and "my table" float beside it as calm glass chips (HTML, crisp, in the page's language). Every number is
   the page's sample (the page says so); the race ends on the sample's order.
   Contract: mountInsights(host, { data, layer, lang, reduced, lowPower, speed, onReady, onFail, onOrder, onDay }) →
   { pause, resume, setLang, destroy } or null without WebGL. host: an empty, CSS-sized element; layer: the HTML overlay that
   holds the plates (.ip[data-id]), which this module places on the track, and the chips (.ic-*), which stay where the page
   puts them (only the views count moves). reduced: one still frame
   (the end of the week), again on resize. No requests: the dishes' pictures are the overlay's own <img>. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, CylinderGeometry, TorusGeometry, BoxGeometry, PlaneGeometry, CircleGeometry, SphereGeometry,
  MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, Points, BufferGeometry, BufferAttribute, PointsMaterial, CanvasTexture,
  HemisphereLight, DirectionalLight, PMREMGenerator, Color, Vector3, ACESFilmicToneMapping, sRGBEncoding, NormalBlending
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const R = 3, RING = R + .34, DAY = 4, HOLD = 5, BACK = 1.4, FOV = 30, DEG = Math.PI / 180;
/* the race track on the glass: five lanes across the table (x: the week's opens; z: the rank, 1 at the back) */
const TW = 4.4, LP = .92, TD = LP * 5 + .0, FIN = TW / 2 - .5, ALLOW = { wide: 1.15, narrow: 1.6 }, SWAP = .9;
const laneZ = (r) => (r - 2) * LP;
const outBack = (x) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const DAYS = { he: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'], en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] };
const LEVEL = (k) => (k >= .999 ? 0xFF7A45 : k > .75 ? 0xF06B6E : k > .5 ? 0xFF8A55 : k > .25 ? 0xF5B120 : k > .05 ? 0xF1D49A : 0xE4DCD0);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const hh = (h) => String(h).padStart(2, '0') + ':00';

function radial(stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => r.addColorStop(o, col)); g.fillStyle = r; g.fillRect(0, 0, size, size); return new CanvasTexture(c);
}

export async function mountInsights(host, opts = {}) {
  const fail = (e) => { try { if (opts.onFail) opts.onFail(e); } catch (x) { /* the page's handler */ } return null; };
  const D = opts.data, layer = opts.layer; if (!host || !D || !layer) return null;
  const reduced = !!opts.reduced, low = !!opts.lowPower, speed = Math.max(.25, +opts.speed || 1);
  let lang = opts.lang === 'en' ? 'en' : 'he';
  const canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
  let renderer, dead = false, raf = 0;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dead = true; if (raf) cancelAnimationFrame(raf); raf = 0; fail(new Error('insights: the GL context was lost')); }, { once: true });
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: low ? 'low-power' : 'default' }); if (!renderer.getContext()) throw new Error('no WebGL'); } catch (e) { return fail(e); }
  try {
  renderer.setClearColor(0x000000, 0); renderer.outputEncoding = sRGBEncoding; renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.5 : 1.75));
  host.appendChild(canvas);
  const scene = new Scene(), camera = new PerspectiveCamera(FOV, 1, .5, 100);
  const pmrem = new PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture; pmrem.dispose();
  scene.add(new HemisphereLight(0xffffff, 0xf1e6d8, .5));
  const key = new DirectionalLight(0xfff2e2, 1.6); key.position.set(-5, 10, 6); scene.add(key);
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  /* the table: a floating glass disc, a bright rim, lanes, a warm heart that the views light up, its shadow on the floor below */
  const world = new Group(); scene.add(world);
  const lin = (hex) => new Color(hex).convertSRGBToLinear();
  const glass = keep(new MeshPhysicalMaterial({ color: lin(0xFFFBF5), roughness: .08, metalness: 0, clearcoat: 1, clearcoatRoughness: .06, transparent: true, opacity: .82, envMapIntensity: 1.3 }));
  const edge = keep(new MeshStandardMaterial({ color: lin(0xE6D9C8), roughness: .28, metalness: 0, transparent: true, opacity: .95, envMapIntensity: 1.1 }));
  const top = new Mesh(keep(new CylinderGeometry(R, R * .97, .18, low ? 64 : 112)), [edge, glass, edge]); world.add(top);
  const rim = new Mesh(keep(new TorusGeometry(R, .03, 8, 140)), keep(new MeshBasicMaterial({ color: 0xffffff }))); rim.rotation.x = Math.PI / 2; rim.position.y = .08; world.add(rim);
  const heartTex = keep(radial([[0, 'rgba(255,214,140,1)'], [.35, 'rgba(255,150,90,.55)'], [.7, 'rgba(255,122,69,.12)'], [1, 'rgba(255,122,69,0)']]));
  const heartMat = keep(new MeshBasicMaterial({ map: heartTex, transparent: true, depthWrite: false, blending: NormalBlending, opacity: .6, toneMapped: false }));
  const heart = new Mesh(keep(new CircleGeometry(1.5, 48)), heartMat); heart.rotation.x = -Math.PI / 2; heart.position.y = .085; world.add(heart);
  /* the track: drawn once on a canvas (lanes, their edges), laid on the glass; the start and the finish are their own lines */
  const trackTex = keep(new CanvasTexture((() => {
    const c = document.createElement('canvas'), Wc = 1024, Hc = Math.round(1024 * TD / TW); c.width = Wc; c.height = Hc; const g = c.getContext('2d'), rr = 150, lh = Hc / 5;
    g.beginPath(); g.moveTo(rr, 0); g.arcTo(Wc, 0, Wc, Hc, rr); g.arcTo(Wc, Hc, 0, Hc, rr); g.arcTo(0, Hc, 0, 0, rr); g.arcTo(0, 0, Wc, 0, rr); g.closePath(); g.save(); g.clip();
    g.fillStyle = 'rgba(255,253,248,.82)'; g.fillRect(0, 0, Wc, Hc);
    for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? 'rgba(245,177,32,.16)' : 'rgba(255,226,190,.34)'; g.fillRect(0, i * lh, Wc, lh); }
    g.strokeStyle = 'rgba(22,18,14,.34)'; g.lineWidth = 5; g.setLineDash([26, 18]);
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(24, i * lh); g.lineTo(Wc - 24, i * lh); g.stroke(); }
    g.restore(); g.setLineDash([]); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 6; g.stroke();
    return c; })()));
  const track = new Mesh(keep(new PlaneGeometry(TW, TD)), keep(new MeshBasicMaterial({ map: trackTex, transparent: true, depthWrite: false, toneMapped: false })));
  track.rotation.x = -Math.PI / 2; track.position.y = .092; world.add(track);
  const startLine = new Mesh(keep(new PlaneGeometry(.05, TD - .3)), keep(new MeshBasicMaterial({ color: lin(0x16120E), transparent: true, opacity: .4, depthWrite: false, toneMapped: false })));
  startLine.rotation.x = -Math.PI / 2; startLine.position.y = .094; world.add(startLine);
  const finTex = keep(new CanvasTexture((() => { const c = document.createElement('canvas'); c.width = 16; c.height = 160; const g = c.getContext('2d');
    for (let y = 0; y < 20; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#16120E' : '#FFFFFF'; g.fillRect(x * 8, y * 8, 8, 8); } return c; })()));
  const finish = new Mesh(keep(new PlaneGeometry(.16, TD - .3)), keep(new MeshBasicMaterial({ map: finTex, transparent: true, opacity: .6, depthWrite: false, toneMapped: false })));
  finish.rotation.x = -Math.PI / 2; finish.position.y = .094; world.add(finish);
  const shTex = keep(radial([[0, 'rgba(70,45,20,.42)'], [.5, 'rgba(70,45,20,.16)'], [1, 'rgba(70,45,20,0)']]));
  const ground = new Mesh(keep(new PlaneGeometry(R * 2.8, R * 2.8)), keep(new MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false }))); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.7; world.add(ground);

  /* the hours: 24 bars round the edge, hour 0 at the back, clockwise as seen from above (a clock face lying on the table) */
  const hMax = Math.max(...D.hours), bars = [];
  const barGeo = keep(new BoxGeometry(.2, 1, .26)); barGeo.translate(0, .5, 0);
  D.hours.forEach((v, h) => {
    const k = v / hMax, a = h / 24 * Math.PI * 2, col = lin(LEVEL(k));
    const m = keep(new MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .05, roughness: .42, metalness: 0 }));
    const b = new Mesh(barGeo, m); b.position.set(Math.sin(a) * RING, -.08, -Math.cos(a) * RING); b.rotation.y = -a; world.add(b);
    bars.push({ b, m, k, base: .1 + k * 1.3 });
  });
  const hand = new Mesh(keep(new SphereGeometry(.11, 16, 12)), keep(new MeshBasicMaterial({ color: lin(0xFF9A50), toneMapped: false }))); world.add(hand);
  const handGlow = new Mesh(keep(new CircleGeometry(.6, 32)), keep(new MeshBasicMaterial({ map: heartTex, transparent: true, depthWrite: false, opacity: .85, toneMapped: false }))); world.add(handGlow);

  /* the views: light flowing in from all round and gathering in the table's heart */
  const N = low ? 150 : 300, pos = new Float32Array(N * 3), P = [];
  for (let i = 0; i < N; i++) P.push({ a: Math.random() * Math.PI * 2, r0: 5.5 + Math.random() * 3, y0: .6 + Math.random() * 2.6, life: 2.4 + Math.random() * 2, t: Math.random(), swirl: (Math.random() < .5 ? -1 : 1) * (.6 + Math.random() * .8) });
  const pGeo = keep(new BufferGeometry()); pGeo.setAttribute('position', new BufferAttribute(pos, 3));
  const dotTex = keep(radial([[0, 'rgba(255,190,110,1)'], [.3, 'rgba(255,150,80,.8)'], [.65, 'rgba(240,100,110,.22)'], [1, 'rgba(226,92,122,0)']], 64));
  const pMat = keep(new PointsMaterial({ size: .2, map: dotTex, transparent: true, depthWrite: false, color: 0xffffff, sizeAttenuation: true, toneMapped: false }));
  const points = new Points(pGeo, pMat); scene.add(points);

  /* the race: five plates (HTML, over the canvas), each with a soft shadow on the glass */
  const rtl = () => (document.documentElement.dir || 'rtl') === 'rtl';
  const nMax = Math.max(...D.race.map((d) => d.n));
  const plates = D.race.map((d, i) => {
    const el = layer.querySelector('.ip[data-id="' + d.id + '"]'), sh = new Mesh(keep(new CircleGeometry(.5, 32)), keep(new MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: .9 }))); sh.rotation.x = -Math.PI / 2; sh.position.y = .096; world.add(sh);
    const cum = [0]; d.d.forEach((v) => cum.push(cum[cum.length - 1] + v));
    return { d, el, sh, cum, z: laneZ(i), from: laneZ(i), to: laneZ(i), t0: -9, lift: 0, rank: i, count: 0, num: el && el.querySelector('.ip-w b'), badge: el && el.querySelector('.ip-r') };
  });
  /* the leader's light: a warm pool under the first plate */
  const leadGlow = new Mesh(keep(new CircleGeometry(.95, 40)), keep(new MeshBasicMaterial({ map: heartTex, transparent: true, depthWrite: false, opacity: .85, toneMapped: false })));
  leadGlow.rotation.x = -Math.PI / 2; leadGlow.position.y = .095; world.add(leadGlow);
  const viewsNum = layer.querySelector('.ic-views [data-v="views"]');      // the chips stand where the page puts them; only the views count moves
  const handChip = document.createElement('span'); handChip.className = 'ic ic-hand'; handChip.innerHTML = '<b class="num"><bdi dir="ltr"></bdi></b>'; layer.appendChild(handChip);
  const handText = handChip.querySelector('bdi');
  const dayCum = [0]; D.days.forEach((v) => dayCum.push(dayCum[dayCum.length - 1] + v));
  const dayMax = Math.max(...D.days), dayMean = dayCum[7] / 7;

  let W = 1, H = 1, narrow = false;
  function fit() {
    W = Math.max(1, host.clientWidth); H = Math.max(1, host.clientHeight); narrow = W / H < 1.15;
    renderer.setSize(W, H, false); camera.aspect = W / H;
    /* the framing matches the page's still: the table's centre at 52 % of the height on a wide stage, 38.7 % on a phone */
    const elev = (narrow ? 58 : 44) * DEG, half = narrow ? 3.62 : 5.05, hf = Math.atan(Math.tan(FOV * DEG / 2) * camera.aspect), dist = half / Math.tan(hf);
    camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist); camera.lookAt(0, 0, 0);
    camera.setViewOffset(W, H, 0, (.5 - (narrow ? .387 : .522)) * H, W, H); camera.updateProjectionMatrix();
  }
  const v3 = new Vector3();
  function place(el, p, sc) {
    if (!el) return; v3.copy(p).project(camera);
    const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H;
    el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%)${sc ? ' scale(' + sc.toFixed(3) + ')' : ''}`;
  }

  /* the clock of the scene: a week of DAY seconds a day, a hold on the result, a short glide back */
  const LOOP = 7 * DAY + HOLD + BACK;
  let t = reduced ? 7 * DAY + HOLD * .5 : 0, last = 0, running = false, lastOrder = '', lastDay = -1, lastHour = -1, ready = false;
  function weekAt(tt) {                                            // → { f: 0..7 days done, back: 0..1 gliding back to the start }
    if (tt < 7 * DAY) return { f: tt / DAY, back: 0 };
    if (tt < 7 * DAY + HOLD) return { f: 7, back: 0 };
    return { f: 7, back: smooth((tt - 7 * DAY - HOLD) / BACK) };
  }
  const cumAt = (cum, f) => { const d = Math.min(6, Math.floor(f)), k = f - d; return f >= 7 ? cum[7] : cum[d] + (cum[d + 1] - cum[d]) * k; };

  function draw(dt) {
    const { f, back } = weekAt(t), day = Math.min(6, Math.floor(f)), dayK = f >= 7 ? 1 : f - day, s = rtl() ? -1 : 1, time = performance.now() / 1000;
    /* the clock hand: one turn a day; at rest it waits on the busiest hour */
    const clock = f >= 7 ? D.peaks[1] + .5 : dayK * 24, ca = clock / 24 * Math.PI * 2;
    const todays = D.days[day] / dayMean;
    bars.forEach((o, h) => {
      let dh = Math.abs(h + .5 - clock); dh = Math.min(dh, 24 - dh);
      const near = Math.exp(-(dh * dh) / 1.6), breathe = reduced ? 0 : Math.sin(time * 1.3 + h * .55) * .06;
      const hgt = o.base * (.86 + .14 * todays + breathe) * (1 - back * .5) + near * .28 * (.4 + o.k);
      o.b.scale.y += (hgt - o.b.scale.y) * (reduced ? 1 : Math.min(1, dt * 6));
      o.m.emissiveIntensity = .06 + near * .85;
    });
    const hb = bars[Math.floor(clock) % 24];
    hand.position.set(Math.sin(ca) * RING, hb.b.scale.y + .12, -Math.cos(ca) * RING); handGlow.position.copy(hand.position); handGlow.lookAt(camera.position);
    /* the views: the stream runs with the day's views; the heart glows with the week's */
    const flow = (D.days[day] / dayMax) * (1 - back), arr = pGeo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const q = P[i]; if (!reduced) q.t += dt / q.life * (.55 + flow * .9);
      if (q.t >= 1) { q.t -= 1; q.a = Math.random() * Math.PI * 2; q.r0 = 5.5 + Math.random() * 3; q.y0 = .6 + Math.random() * 2.6; }
      const k = q.t, e = k * k, a = q.a + q.swirl * k * 1.6, r = q.r0 * (1 - e), on = i < N * (.35 + .65 * flow);
      arr[i * 3] = on ? Math.sin(a) * r : 0; arr[i * 3 + 1] = on ? .1 + q.y0 * (1 - k) * (1 - k * .4) : -50; arr[i * 3 + 2] = on ? -Math.cos(a) * r * .9 : 0;
    }
    pGeo.attributes.position.needsUpdate = true;
    const viewsNow = cumAt(dayCum, f) * (1 - back);
    heartMat.opacity = .25 + .65 * (viewsNow / dayCum[7]) + (reduced ? 0 : Math.sin(time * 2.1) * .04); heart.scale.setScalar(.7 + .5 * viewsNow / dayCum[7]);
    if (viewsNum) viewsNum.textContent = String(Math.round(viewsNow));
    /* the race: counts through the week along the lanes; the lanes are the ranking (1 at the back). When a dish overtakes,
       both plates change lanes in a little arc and settle (a spring's overshoot), never a jump. */
    const now = time, A = narrow ? ALLOW.narrow : ALLOW.wide, x0 = -TW / 2 + A;
    track.scale.x = s; startLine.position.x = s * x0; finish.position.x = s * FIN;
    plates.forEach((p) => { p.count = cumAt(p.cum, f) * (1 - back); });
    const order = plates.slice().sort((a, b) => b.count - a.count || b.d.n - a.d.n);       // ties: as the sample ends
    order.forEach((p, r) => { if (p.rank !== r) { p.from = p.z; p.to = laneZ(r); p.t0 = now; p.up = r < p.rank; } p.rank = r; });
    plates.forEach((p) => {
      let lift = 0;
      if (reduced) p.z = p.to = laneZ(p.rank);
      else { const k = clamp01((now - p.t0) / SWAP); p.z = p.from + (p.to - p.from) * (k >= 1 ? 1 : outBack(k)); lift = k < 1 ? Math.sin(k * Math.PI) * (p.up ? .55 : .18) : 0; }
      const x = s * (x0 + (FIN - x0) * p.count / nMax);
      p.sh.position.set(x, .096, p.z); p.sh.scale.setScalar(1 - lift * .5); p.sh.material.opacity = .9 - lift * .8;
      if (p.rank === 0) leadGlow.position.set(x, .095, p.z);
      if (p.el) {
        v3.set(x, .34 + lift, p.z); const dz = camera.position.distanceTo(v3), base = camera.position.length();
        place(p.el, v3, Math.min(1.08, Math.max(.92, base / dz)) * (1 + lift * .22));
        p.el.style.zIndex = String(10 + p.rank + (lift > .05 ? 20 : 0));      // front lanes over back ones; a plate in the air over all
        p.el.classList.toggle('lead', p.rank === 0);
      }
      if (p.num) p.num.textContent = String(Math.round(p.count));
      if (p.badge) p.badge.textContent = String(p.rank + 1);
    });
    leadGlow.material.opacity = (.55 + (reduced ? 0 : Math.sin(time * 2.4) * .15)) * (1 - back);
    const ord = order.map((p) => p.d.id).join(',');
    if (ord !== lastOrder) { lastOrder = ord; try { if (opts.onOrder) opts.onOrder(ord); } catch (e) { /* the page */ } }
    const dd = f >= 7 ? 6 : day;
    if (dd !== lastDay) { lastDay = dd; try { if (opts.onDay) opts.onDay(DAYS[lang][dd]); } catch (e) { /* the page */ } }
    const hr = Math.floor(clock) % 24; if (hr !== lastHour) { lastHour = hr; handText.textContent = hh(hr); }
    v3.copy(hand.position); v3.y += .55; place(handChip, v3);
    world.rotation.y = reduced ? 0 : Math.sin(time * .12) * .05;
    renderer.render(scene, camera);
  }
  function frame(now) {
    raf = 0; if (!running || dead) return;
    const dt = Math.min(.25, last ? (now - last) / 1000 : .016); last = now;
    t = (t + dt * speed) % LOOP; draw(dt);
    if (!ready) { ready = true; try { if (opts.onReady) opts.onReady(); } catch (e) { /* the page */ } }
    raf = requestAnimationFrame(frame);
  }
  fit();
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { fit(); if (reduced || !running) draw(1); }) : null; if (ro) ro.observe(host);
  if (reduced) { draw(1); draw(1); ready = true; try { if (opts.onReady) opts.onReady(); } catch (e) { /* the page */ } }
  return {
    pause() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; },
    resume() { if (dead || reduced || running) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
    setLang(l) { lang = l === 'en' ? 'en' : 'he'; lastDay = -1; if (reduced || !running) draw(0); },
    destroy() { dead = true; this.pause(); if (ro) ro.disconnect(); disposables.forEach((x) => { try { x.dispose(); } catch (e) { /* gone */ } }); if (scene.environment) scene.environment.dispose(); renderer.dispose(); if (canvas.parentNode) canvas.parentNode.removeChild(canvas); if (handChip.parentNode) handChip.parentNode.removeChild(handChip); }
  };
  } catch (e) { try { renderer.dispose(); } catch (x) { /* gone */ } if (canvas.parentNode) canvas.parentNode.removeChild(canvas); return fail(e); }
}
