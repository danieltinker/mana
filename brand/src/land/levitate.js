/* The hero's ingredients, levitating (round two). Twelve AI-made ingredients drift through the hero's air from side to side in
   four depth layers: each on its own slow path (two octaves of 1-D gradient noise per axis, never a visible loop), tumbling and
   turning, rising and sinking; near ones larger, faster and softly out of focus, far ones small, slow and hazed. Now and then
   one drifts close past the camera. The pointer disturbs the air (a wake that pushes them; a spring brings them back), the
   scroll adds depth parallax. Every item is transform-only on its own compositor layer; one requestAnimationFrame loop for all.
   Near ones carry a soft contact shadow (its own element: the light stays where it is while the ingredient turns).
   Behind the words an ingredient fades to a whisper, so the headline always reads.
   mountLevitate(hero, { lowPower }) → { pause(), resume(), destroy(), running() }. Without this (no script, reduced motion) the
   CSS composition in land.css is the still. The hero's "made with AI" label covers the ingredients.                     */
const LAYERS = [                    // far → near: speed (px/s at a 1280 px hero), vertical sway (px), spin (deg/s), parallax, the wake's push
  { v: [9, 14], sway: 26, spin: 5, par: .06, push: .35 },
  { v: [16, 24], sway: 34, spin: 8, par: .14, push: .6 },
  { v: [26, 38], sway: 42, spin: 11, par: .24, push: .85 },
  { v: [46, 66], sway: 54, spin: 15, par: .42, push: 1.15 }
];

/* 1-D gradient noise in [-1, 1] (Perlin's, with a quintic fade); seeds pick a different line through the same lattice */
const P = new Uint8Array(512); { let s = 1234567; const a = []; for (let i = 0; i < 256; i++) a[i] = i; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } for (let i = 0; i < 512; i++) P[i] = a[i & 255]; }
const grad = (h, x) => ((h & 1) ? -1 : 1) * (1 + (h & 7) / 7) * x;
function noise(x) { const i = Math.floor(x), f = x - i, u = f * f * f * (f * (f * 6 - 15) + 10), a = grad(P[i & 255], f), b = grad(P[(i + 1) & 255], f - 1); return (a + (b - a) * u) * .9; }
const fbm = (x, seed) => noise(x + seed) * .72 + noise(x * 2.13 + seed * 1.7 + 19.3) * .28;

let rnd = 0x9e3779b9; const rand = () => { rnd ^= rnd << 13; rnd ^= rnd >>> 17; rnd ^= rnd << 5; return ((rnd >>> 0) % 100000) / 100000; };
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export function mountLevitate(hero, opts = {}) {
  const layer = hero && hero.querySelector('.lev');
  if (!layer) return null;
  const low = !!opts.lowPower;
  const words = hero.querySelector('.hero-words');
  const items = Array.prototype.slice.call(layer.querySelectorAll('.lv')).filter((el) => getComputedStyle(el).display !== 'none').map((el, n) => {
    const d = +el.getAttribute('data-depth') || 0, L = LAYERS[d], dir = rand() < .5 ? -1 : 1;
    return { el, img: el.querySelector('img'), sh: el.querySelector('.lv-sh'), d, L, dir, v: lerp(L.v[0], L.v[1], rand()), seed: n * 17.31 + rand() * 50,
      fy: .05 + rand() * .05, fr: .04 + rand() * .05, spin: (rand() < .5 ? -1 : 1) * L.spin * (.5 + rand()), r0: rand() * 360,
      x: 0, y0: 0, size: 0, ox: 0, oy: 0, vx: 0, vy: 0, vr: 0, rk: 0, fade: 1 };
  });
  if (!items.length) return null;

  let W = 0, H = 0, unit = 1, wr = null, raf = 0, running = false, dead = false, last = 0, t = 0, sy = 0;
  const ptr = { x: -1e4, y: -1e4, vx: 0, vy: 0, at: 0, on: false };
  function measure() {
    const r = hero.getBoundingClientRect(); W = r.width; H = r.height; unit = Math.max(.55, Math.min(1.25, W / 1280));
    if (words) { const w = words.getBoundingClientRect(); wr = { l: w.left - r.left - 12, r: w.right - r.left + 12, t: w.top - r.top - 8, b: w.bottom - r.top + 8 }; }
    items.forEach((it) => { it.size = it.el.offsetWidth || 80; });
  }
  /* the still's composition is where they start: read once from the CSS layout, then the loop owns the transform */
  measure();
  const hr = hero.getBoundingClientRect();
  items.forEach((it) => { const b = it.el.getBoundingClientRect(); it.x = b.left - hr.left + b.width / 2; it.y0 = b.top - hr.top + b.height / 2; });
  layer.classList.add('on');

  /* one ingredient now and then drifts close past the camera: big, fast, deeply out of focus, across the dish's side */
  const pass = low ? null : document.createElement('span');
  let passT = -1, passNext = 7 + rand() * 6, passFrom = null;
  if (pass) { pass.className = 'lv lv-pass'; pass.setAttribute('aria-hidden', 'true'); pass.appendChild(document.createElement('img')); pass.firstChild.alt = ''; pass.firstChild.decoding = 'async'; pass.firstChild.src = items[0].img.getAttribute('src'); layer.appendChild(pass); }
  function startPass() {
    const src = items[Math.floor(rand() * items.length)].img; if (!src || !src.complete) { passNext = t + 4; return; }
    pass.firstChild.src = src.currentSrc || src.src;
    const rtl = (document.documentElement.dir || 'rtl') === 'rtl', stageSide = rtl ? 0 : 1;            // the dish stands on the inline-end side
    const wide = W >= 900, x0 = wide ? W * (stageSide ? .55 : .02) : -W * .2, x1 = wide ? W * (stageSide ? 1.1 : .5) : W * 1.2, down = rand() < .5;
    passFrom = { ax: down ? x0 : x1, bx: down ? x1 : x0, ay: H * (wide ? .05 + rand() * .2 : .62), by: H * (wide ? .75 + rand() * .2 : .95), r: rand() * 360, s: (wide ? 330 : 220) * unit };
    passT = t;
  }

  function frame(now) {
    raf = 0; if (!running || dead) return;
    const dt = Math.min(.05, last ? (now - last) / 1000 : .016); last = now; t += dt;
    const pfresh = now - ptr.at < 120;
    for (let i = 0; i < items.length; i++) {
      const it = items[i], L = it.L, s = it.size, m = s * .6 + 40 * unit;
      /* the drift: across, at its own speed, with a little give; off one edge, back from the other at a new height */
      it.x += it.dir * it.v * unit * dt * (1 + fbm(t * .05, it.seed + 3) * .35);
      if (it.x > W + m || it.x < -m) { it.x = it.x > W + m ? -m : W + m; it.y0 = H * (.08 + rand() * .84); }
      const ny = fbm(t * it.fy, it.seed), ny2 = fbm(t * it.fy * .37, it.seed + 41);
      const y = it.y0 + (ny * L.sway + ny2 * L.sway * 1.6) * unit - sy * L.par * H;
      /* the air: a moving pointer pushes what is near it; a spring brings it back, with a little turn for the trouble */
      if (pfresh) {
        const dx = it.x + it.ox - ptr.x, dy = y + it.oy - ptr.y, R = (150 + s * .6) * unit, k = Math.exp(-(dx * dx + dy * dy) / (R * R));
        if (k > .01) { const f = k * L.push * 1.8; it.vx += (ptr.vx * f + dx / R * k * 220 * L.push) * dt; it.vy += (ptr.vy * f + dy / R * k * 220 * L.push) * dt; it.vr += (ptr.vx * dy - ptr.vy * dx) / (R * R) * k * 40 * dt; }
      }
      it.vx += (-2.1 * it.ox - 1.5 * it.vx) * dt; it.vy += (-2.1 * it.oy - 1.5 * it.vy) * dt; it.vr += (-1.6 * it.rk - 1.4 * it.vr) * dt;
      it.ox += it.vx * dt; it.oy += it.vy * dt; it.rk += it.vr * dt;
      const X = it.x + it.ox, Y = y + it.oy;
      /* turning: a steady spin, tumbling on the two other axes (never far enough to show a cut-out's edge) */
      const rz = it.r0 + it.spin * t + fbm(t * it.fr, it.seed + 7) * 40 + it.rk * 57, rx = fbm(t * it.fr * 1.3, it.seed + 11) * 34, ry = fbm(t * it.fr * 1.1, it.seed + 13) * 38;
      const lift = (ny + ny2 * .6) * .5;                                                                 // -1 sinking … 1 rising
      it.el.style.transform = `translate3d(${(X - s / 2).toFixed(1)}px,${(Y - s / 2).toFixed(1)}px,0)`;
      it.img.style.transform = `perspective(700px) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) rotateZ(${rz.toFixed(1)}deg) scale(${(1 + lift * .04).toFixed(3)})`;
      if (it.sh) { const k2 = .5 - lift * .5; it.sh.style.transform = `translate3d(0,${(s * (.12 - lift * .08)).toFixed(1)}px,0) scale(${(.7 + k2 * .45).toFixed(3)},${(.7 + k2 * .3).toFixed(3)})`; it.sh.style.opacity = (.35 + k2 * .5).toFixed(2); }
      /* behind the words: a whisper */
      let fade = 1;
      if (wr) { const ix = Math.max(0, Math.min(X + s * .3, wr.r) - Math.max(X - s * .3, wr.l)), iy = Math.max(0, Math.min(Y + s * .3, wr.b) - Math.max(Y - s * .3, wr.t)); if (ix > 0 && iy > 0) fade = .2; }
      it.fade += (fade - it.fade) * Math.min(1, dt * 5);
      it.el.style.opacity = it.fade.toFixed(2);
    }
    if (pass) {
      if (passT < 0 && t > passNext) startPass();
      if (passT >= 0) {
        const k = (t - passT) / 2.6, e = ease(Math.min(1, k)), f = passFrom;
        if (k >= 1) { passT = -1; passNext = t + 12 + rand() * 12; pass.style.opacity = '0'; }
        else { const x = lerp(f.ax, f.bx, e), y = lerp(f.ay, f.by, e) + Math.sin(k * Math.PI) * -40 * unit, sc = .8 + Math.sin(k * Math.PI) * .45;
          pass.style.transform = `translate3d(${(x - f.s / 2).toFixed(1)}px,${(y - f.s / 2).toFixed(1)}px,0) scale(${sc.toFixed(3)})`; pass.style.width = f.s.toFixed(0) + 'px';
          pass.firstChild.style.transform = `rotate(${(f.r + k * 120).toFixed(1)}deg)`; pass.style.opacity = Math.min(1, Math.sin(k * Math.PI) * 1.8).toFixed(2); }
      }
    }
    ptr.vx *= .9; ptr.vy *= .9;
    raf = requestAnimationFrame(frame);
  }
  const ask = () => { if (running && !raf && !dead) raf = requestAnimationFrame(frame); };
  const onMove = (e) => {
    const r = hero.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now(), dtm = Math.max(8, now - ptr.at);
    if (now - ptr.at < 200) { ptr.vx = lerp(ptr.vx, (x - ptr.x) / dtm * 1000, .5); ptr.vy = lerp(ptr.vy, (y - ptr.y) / dtm * 1000, .5); } else { ptr.vx = ptr.vy = 0; }
    const cap = 2600; ptr.vx = Math.max(-cap, Math.min(cap, ptr.vx)); ptr.vy = Math.max(-cap, Math.min(cap, ptr.vy));
    ptr.x = x; ptr.y = y; ptr.at = now;
  };
  const onScroll = () => { sy = Math.min(1.4, (window.pageYOffset || 0) / Math.max(1, H)); };
  let rt = 0; const onResize = () => { clearTimeout(rt); rt = setTimeout(measure, 120); };
  hero.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onResize);
  onScroll();
  return {
    pause() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; layer.removeAttribute('data-run'); },
    resume() { if (dead || running) return; running = true; last = 0; layer.setAttribute('data-run', '1'); ask(); },
    running: () => running,
    destroy() { dead = true; this.pause(); hero.removeEventListener('pointermove', onMove); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); if (pass && pass.parentNode) pass.parentNode.removeChild(pass); layer.classList.remove('on'); }
  };
}
