/* Hero mode: the guest view with no chrome, one dish alone on its table under the lamp, for the product page's first screen.
   Opened as   view/?demo=solo&embed=hero[&lang=he|en][&debug=1]   inside an iframe (or on its own).

   What it does, once:  the poster (the dish's flat photo, cut out, lying where the dish will stand) paints first; when the
   stage reports the dish ready (heroReady) the lamp comes up over 1.6 s, the dish rises into its relief (the engine's own lift),
   and a ring of light is drawn once round the plate (one stroke, 600 ms, starting on the lamp's side). Then the one loop: the
   engine's rest sway. A drag or the arrow keys turn the dish; Enter asks the page to open the demo.

   Talks to the page around it with postMessage, {type:'mana-hero', …}:
     out   {state:'poster'|'ready'|'rise'|'rest'}      where the sequence is (poster = the fallback: tier 4 or a lost context)
           {open:'demo'}                                Enter was pressed: open the full guest menu
     in    {run:false|true}                             the page scrolled the hero off screen (or back): stop or start the clock
   Reduced motion: the still with the lamp up, nothing moves. ?debug=1 prints the quality tier and the marks on screen.
   Nothing here touches the engine: the lamp and the ring are drawn over the canvas, the rise is the engine's lift. */
import { presetById, frameOf } from './scenes/walk.js';
import { SIZE } from './scenes/common.js';
import { tx } from './store.js';

const CSS = `
.app.hero .top,.app.hero .card,.app.hero .hint,.app.hero .edge,.app.hero .list,.app.hero .backdrop,.app.hero .tray,.app.hero .standin,.app.hero .busy,.app.hero .skip,.app.hero .status,.app.hero .cut,.app.hero .finger{display:none!important}
.app.hero{background:#0b0907}
.app.hero .scene{background:#0b0907;touch-action:pan-y;cursor:grab}
.app.hero .scene:active{cursor:grabbing}
.app.hero #gl{opacity:0}
.app.hero[data-hero="rest"] #gl,.app.hero[data-hero="rise"] #gl{opacity:var(--hero-gl,0)}
.hero-poster{position:absolute;pointer-events:none;opacity:1;will-change:opacity;filter:drop-shadow(0 18px 24px rgba(0,0,0,.55))}
.app.hero[data-hero="poster"] .hero-poster{opacity:1!important}
.hero-lamp{position:absolute;inset:-300%;pointer-events:none;background:radial-gradient(ellipse 14% 9% at 50% 50%,rgba(11,9,7,0) 0,rgba(11,9,7,0) 45%,rgba(11,9,7,.985) 100%);will-change:transform,opacity;opacity:0}
.hero-ring{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}
.hero-ring path{fill:none;stroke:#f5b120;stroke-width:1.4;stroke-linecap:round;opacity:0;filter:drop-shadow(0 0 2px rgba(245,177,32,.55))}
.hero-debug{position:absolute;inset-inline-start:8px;bottom:8px;z-index:70;margin:0;padding:6px 8px;border-radius:6px;background:rgba(0,0,0,.72);color:#f4ede2;font:11px/1.35 ui-monospace,Menlo,monospace;white-space:pre;pointer-events:none;direction:ltr}
`;
const LAMP_MS = 1600, LIFT_AT = 560, RING_MS = 600, RING_K = 1.08, RING_REST = .42;
const easeInOut = (x) => (x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2), easeOut = (x) => 1 - Math.pow(1 - x, 3), clamp01 = (x) => Math.min(1, Math.max(0, x));

export function start(env) {
  const { api, ticker, reduce } = env, $ = (id) => document.getElementById(id), app = $('app'), scene = $('scene'), gl = $('gl');
  const framed = (() => { try { return window.parent && window.parent !== window; } catch (e) { return true; } })();
  const post = (msg) => { if (!framed) return; try { window.parent.postMessage(Object.assign({ type: 'mana-hero' }, msg), '*'); } catch (e) { /* no parent to tell */ } };
  const mark = (n) => { try { performance.mark(n); } catch (e) { /* optional */ } };
  /* inside the page's iframe the lift must not write to the joint history (Back on the page would land in here): every push is a replace, and no going back */
  try { history.pushState = function (s, t, u) { return History.prototype.replaceState.call(this, s, t, u); }; history.back = () => {}; } catch (e) { /* locked down: fine */ }
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: CSS }));
  app.classList.add('hero'); app.dataset.hero = 'poster';
  const poster = document.createElement('canvas'); poster.className = 'hero-poster'; poster.setAttribute('aria-hidden', 'true'); scene.appendChild(poster);
  const lamp = document.createElement('div'); lamp.className = 'hero-lamp'; lamp.setAttribute('aria-hidden', 'true'); scene.appendChild(lamp);
  const ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ringSvg.setAttribute('class', 'hero-ring'); ringSvg.setAttribute('aria-hidden', 'true');
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'path'); ring.setAttribute('pathLength', '1'); ringSvg.appendChild(ring); scene.appendChild(ringSvg);
  let phase = 'poster', item = null, kind = 'food', rect = null, posterReady = false, running = true, paused = false, timer = 0, ringOn = 0, rtl = false, wakeReal = ticker.wake, waitT = 0;
  const setPhase = (p) => { phase = p; app.dataset.hero = p; post({ state: p }); };

  /* ---- the poster: the dish's own photo, cut out by its matte (the green channel of the aux picture), where it will stand ---- */
  function place() {
    const W = scene.clientWidth || innerWidth, H = scene.clientHeight || innerHeight, f = frameOf(presetById('table'), W, H, rtl), side = SIZE * f.ppu;
    rect = { x: f.cx - side / 2, y: f.cy - side / 2, w: side, cx: f.cx, cy: f.cy };
    poster.style.left = rect.x + 'px'; poster.style.top = rect.y + 'px'; poster.style.width = side + 'px'; poster.style.height = side + 'px';
    const ox = ((f.cx / W * 100 + 300) / 7).toFixed(3) + '%', oy = ((f.cy / H * 100 + 300) / 7).toFixed(3) + '%';      // the dish's point, in the lamp layer's own percent (it is 7 × the scene, offset by 3)
    lamp.style.transformOrigin = ox + ' ' + oy;
    lamp.style.background = 'radial-gradient(ellipse 11% 8% at ' + ox + ' ' + oy + ',rgba(11,9,7,0) 0,rgba(11,9,7,0) 45%,rgba(11,9,7,.985) 100%)';
  }
  function paintPoster() {
    const a = item && item.asset; if (!a || !a.color) return;
    const im = (u) => new Promise((res) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => res(null); i.src = u; });
    Promise.all([im(a.color), a.aux ? im(a.aux) : null]).then(([c, m]) => {
      if (!c) return; const n = 512; poster.width = poster.height = n; const x = poster.getContext('2d');
      x.drawImage(c, 0, 0, n, n);
      if (m) { try { const tmp = document.createElement('canvas'); tmp.width = tmp.height = n; const y = tmp.getContext('2d'); y.drawImage(m, 0, 0, n, n); const md = y.getImageData(0, 0, n, n).data, cd = x.getImageData(0, 0, n, n); for (let i = 0; i < md.length; i += 4) cd.data[i + 3] = md[i + 1]; x.putImageData(cd, 0, 0); } catch (e) { /* a picture from elsewhere: shown as it is */ } }
      posterReady = true; mark('menu-hero-poster');
    });
  }

  /* ---- the ring: one stroke round the plate, drawn where the engine says the plate is on screen ---- */
  /* the rim, as one path that starts on the lamp's side (the near rim) and runs round towards the inline end */
  function ringAt(h) { if (!h) return; const rx = h.rx * RING_K, ry = Math.max(h.ry * RING_K, rx * .34), sw = rtl ? 1 : 0, f = (n) => n.toFixed(1);      // sweep 1 = clockwise on screen: from the near rim, leftwards first (the inline end in Hebrew)
    ring.setAttribute('d', 'M' + f(h.cx) + ' ' + f(h.cy + ry) + 'A' + f(rx) + ' ' + f(ry) + ' 0 1 ' + sw + ' ' + f(h.cx) + ' ' + f(h.cy - ry) + 'A' + f(rx) + ' ' + f(ry) + ' 0 1 ' + sw + ' ' + f(h.cx) + ' ' + f(h.cy + ry)); }
  const hero = () => { const i = api.info(); return i && i.hot && i.hot[0] ? i.hot[0] : null; };
  function sweep(ms) {
    /* the stroke starts on the lamp's side (the near rim) and runs round towards the inline end: a mirrored gesture in Hebrew */
    ring.setAttribute('stroke-dasharray', '1 1'); const t0 = performance.now();
    const step = (now) => { const k = ms ? easeInOut(clamp01((now - t0) / ms)) : 1; ring.setAttribute('stroke-dashoffset', String(1 - k)); ring.style.opacity = String(.35 + .5 * k); if (k < 1 && running) requestAnimationFrame(step); else { ring.setAttribute('stroke-dasharray', 'none'); ring.style.opacity = String(RING_REST); ringOn = 1; } };
    requestAnimationFrame(step);
  }

  /* ---- the sequence ---- */
  function fallback() { if (phase === 'poster') return; running = false; mark('menu-hero-fallback'); clearTimeout(timer); ring.style.opacity = '0'; lamp.style.opacity = '0'; app.style.setProperty('--hero-gl', '0'); poster.style.opacity = '1'; setPhase('poster'); }
  function run() {
    mark('menu-hero-rise'); setPhase('rise'); const t0 = performance.now(); let lifted = false, rung = false;
    if (reduce) { app.style.setProperty('--hero-gl', '1'); poster.style.opacity = '0'; api.lift(true); setTimeout(() => { ringAt(hero()); ring.setAttribute('stroke-dasharray', 'none'); ring.style.opacity = String(RING_REST); ringOn = 1; mark('menu-hero-rest'); setPhase('rest'); }, 60); return; }
    lamp.style.opacity = '1'; lamp.style.transform = 'scale(.32)';
    const step = (now) => {
      if (!running) return; const t = now - t0, k = easeInOut(clamp01(t / LAMP_MS));
      app.style.setProperty('--hero-gl', String(clamp01(k * 1.25)));
      lamp.style.transform = 'scale(' + (.32 + 1.9 * easeInOut(clamp01(t / LAMP_MS))) + ')'; lamp.style.opacity = String(1 - easeInOut(clamp01((t - LAMP_MS * .62) / (LAMP_MS * .38))));
      poster.style.opacity = String(1 - easeInOut(clamp01((t - 380) / 820)));
      if (!lifted && t >= LIFT_AT) { lifted = true; api.lift(true); }
      if (!rung && t >= LAMP_MS + 160) { rung = true; ringAt(hero()); sweep(RING_MS); setTimeout(() => { mark('menu-hero-rest'); setPhase('rest'); }, RING_MS); }
      if (t < LAMP_MS + 200) requestAnimationFrame(step); else { lamp.style.opacity = '0'; app.style.setProperty('--hero-gl', '1'); poster.style.opacity = '0'; }
    };
    requestAnimationFrame(step);
  }
  /* at rest: the ring follows the plate (the engine's rest sway moves it a few pixels), the dish stays lifted, the fallbacks are watched */
  function watch() {
    clearTimeout(waitT); if (!running || paused) return;      // one chain of checks, whoever called
    const s = api.state(), i = api.info();
    if ((s && s.simple) || (i && (i.lost || i.tier >= 4))) return fallback();
    if (phase === 'rest') { if (ringOn) ringAt(hero()); if (s && !s.open) api.lift(true); }
    waitT = setTimeout(watch, 80);
  }
  function wait() {                                            // the dish and the table are drawn: that is the cue
    if (!running) return; const s = api.state(), i = api.info();
    if ((s && s.simple) || (i && i.lost)) { setPhase('poster'); return; }
    if (i && i.heroReady) { setPhase('ready'); run(); watch(); return; }
    timer = setTimeout(wait, 60);
  }

  /* ---- input: Enter opens the demo; Escape and the step keys do nothing here ---- */
  window.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); post({ open: 'demo' }); }
    else if (e.key === 'Escape' || e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown' || e.key === 'Home' || e.key === 'End') { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('message', (e) => {
    const d = e.data; if (!d || d.type !== 'mana-hero' || !('run' in d)) return;
    if (d.run === false && !paused) { paused = true; clearTimeout(waitT); ticker.stop(); ticker.wake = () => {}; }
    else if (d.run !== false && paused) { paused = false; ticker.wake = wakeReal; ticker.wake(); watch(); }
  });
  window.addEventListener('resize', () => { if (item) place(); });

  /* ---- debug: the quality tier and the marks, for the morning's go/no-go ---- */
  if (env.debug) {
    const pre = document.createElement('pre'); pre.className = 'hero-debug'; app.appendChild(pre);
    const show = () => { const i = api.info(), fp = performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint');
      pre.textContent = 'tier ' + (i ? i.tier : '-') + (i && i.lost ? ' lost' : '') + ' · ' + phase + (paused ? ' · paused' : '') + '\nfirst paint ' + (fp ? Math.round(fp.startTime) : '-') + ' ms\n' + api.marks().map((m) => m.name.replace('menu-', '') + ' ' + m.t).join('\n'); };
    show(); setInterval(show, 500);
  }

  api.ready.then(() => {
    const m = api.model(), cat = m.cats[0]; if (!cat) return; item = cat.items[0]; kind = cat.raw.kind; const s = api.state(); rtl = s ? s.lang === 'he' : true;
    scene.setAttribute('aria-label', tx(item.name, s ? s.lang : 'he')); scene.setAttribute('role', 'img'); scene.tabIndex = 0;      // the keyboard path: Tab to the dish, arrows turn it, Enter opens the demo
    place(); paintPoster(); wait();
  });
  window.__manaHero = { phase: () => phase, posterReady: () => posterReady, paused: () => paused, rect: () => rect };
}
