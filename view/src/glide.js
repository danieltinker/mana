/* The glide controller: turns a finger, a wheel or a request ("go to dish 4") into one number, p = where the camera is along
   the table, in dishes. No DOM and no three.js: it is handed a clock and the size of a dish in pixels, so it runs in node tests
   and, in filming mode, on the scripted clock.

     drag    p follows the finger exactly (past the ends: a rubber band)
     settle  after the finger leaves: one spring carries the finger's speed to the dish it lands on (see physics.js)
     fly     the same spring, when something else chose the dish (a key, a chip, a row of the list, a link)

   It reports which dish is nearest the focus line (onFocus) while the GUEST is moving the table; when the dish was chosen
   elsewhere the state already knows, and nothing is reported back.

   Dishes do not all take the same room on a set table (a name card stands closer than a plate). h.along(p) says how far along
   the table p is, in the units h.depth(y) measures, and h.dish(u) is its inverse; a finger and a trackpad move the table by
   distance, so the point that was grabbed stays under the finger. Without them a dish is one unit, as in the tests. */
import { velocity, rubber, unrubber, settleTarget, stiffnessFor, springStep, atRest, clamp, OMEGA_FLY, EDGE_PULL } from './physics.js';

const WHEEL_IDLE = 110;          // ms without a wheel event = the wheel gesture is over
const WHEEL_STEP = 0.06;         // dishes of trackpad travel that commit to the next dish (a deliberate nudge, not a tremble)
const NOTCH = 50;                // px in one event, out of the blue: a mouse wheel's notch, not a trackpad's stream

export function createGlide(h) {
  const G = { n: 1, max: 0, p: 0, v: 0, target: 0, omega: OMEGA_FLY, mode: 'rest', focus: 0, own: false,
    raw0: 0, d0: 0, from: 0, samples: [], wheelAt: 0, wheelRaw: 0, px: 300, lock: 0 };
  const s = { x: 0, v: 0 }, along = h.along || ((p) => p), dish = h.dish || ((u) => u);
  const nearest = () => clamp(Math.round(G.p), 0, G.max);
  function report() { const i = nearest(); if (i !== G.focus) { G.focus = i; if (G.own) h.onFocus(i); } }
  function settle(target, v) { G.target = clamp(target, 0, G.max); G.v = v; G.omega = stiffnessFor(G.p, v, G.target); G.mode = 'settle'; h.wake(); }
  function release(v) {
    const r = settleTarget(G.p, v, G.max);
    if (r.edge && h.onEdge(r.edge)) return;                 // a category change is under way: enter() has been called with the new table
    settle(r.target, v);
  }
  return {
    state: G,
    /* a new table: n dishes, standing at index */
    enter(n, index) { G.n = Math.max(1, n); G.max = G.n - 1; G.p = G.target = G.focus = clamp(index, 0, G.max); G.v = 0; G.mode = 'rest'; G.own = false; G.lock = h.now() + 380; h.wake(); },
    /* same table, a dish chosen elsewhere */
    goTo(index, instant) {
      const t = clamp(index, 0, G.max); G.focus = t; G.own = false;
      if (instant) { G.p = G.target = t; G.v = 0; G.mode = 'rest'; h.wake(); return; }
      if (G.mode === 'rest' && Math.abs(G.p - t) < 1e-4) return;
      G.target = t; G.omega = OMEGA_FLY; G.mode = 'settle'; h.wake();
    },
    /* h.depth(y) = how far along the table, in dishes from the focus line, the point under a finger at screen height y lies.
       Holding that point under the finger is what makes the table follow the hand exactly, perspective and all. */
    dragStart(y) { G.mode = 'drag'; G.own = true; G.d0 = h.depth(y); G.raw0 = along(unrubber(G.p, G.max)); G.from = G.focus; G.v = 0; G.samples = [{ t: h.now(), x: G.p }]; h.wake(); },
    dragMove(y) {
      if (G.mode !== 'drag') return;
      G.p = rubber(dish(G.raw0 + h.walk() * (h.depth(y) - G.d0)), G.max);
      G.samples.push({ t: h.now(), x: G.p }); if (G.samples.length > 24) G.samples.shift();
      report(); h.wake();
    },
    dragEnd(cancelled) { if (G.mode !== 'drag') return; if (cancelled) { settle(nearest(), 0); return; } release(velocity(G.samples, h.now())); },
    /* a wheel or a trackpad: the table follows it while it turns, and settles when it stops */
    wheel(dy) {
      if (h.now() < G.lock || G.mode === 'drag') return;     // the tail of a trackpad's own momentum does not run on through the next table
      if (G.mode !== 'wheel' && Math.abs(dy) >= NOTCH) {     // a notch of a mouse wheel: one dish, in ONE glide (more notches: further, without stopping)
        const dir = Math.sign(dy), t = (G.mode === 'settle' ? G.target : nearest()) + dir, out = t > G.max || t < 0;
        G.own = true; G.wheelAt = h.now();
        if (out && h.onEdge(dir)) return;                    // past the end: the next table, if there is one
        settle(t, out ? dir * 1.4 : G.v); G.omega = Math.max(G.omega, 14); return;      // (nothing that way: a nudge against the end)
      }
      if (G.mode !== 'wheel') { G.px = Math.max(40, h.pxPerDish()); G.mode = 'wheel'; G.own = true; G.wheelRaw = unrubber(G.p, G.max); G.from = G.focus; G.v = 0; }
      G.wheelRaw = clamp(dish(along(G.wheelRaw) + dy / G.px), -1.2, G.max + 1.2); G.p = rubber(G.wheelRaw, G.max); G.wheelAt = h.now(); report(); h.wake();
    },
    step(dt) {
      if (G.mode === 'wheel') {
        if (h.now() - G.wheelAt < WHEEL_IDLE) return true;
        const d = G.p - G.from;
        if (G.p > G.max + EDGE_PULL * .6 && h.onEdge(1)) return true;
        if (G.p < -EDGE_PULL * .6 && h.onEdge(-1)) return true;
        settle(Math.abs(d) >= WHEEL_STEP && Math.abs(d) < .5 ? G.from + Math.sign(d) : nearest(), 0);      // one notch is one dish
      }
      if (G.mode !== 'settle') return G.mode === 'drag';
      s.x = G.p; s.v = G.v; springStep(s, G.target, G.omega, dt); G.p = s.x; G.v = s.v;
      if (atRest(s, G.target)) { G.p = G.target; G.v = 0; G.mode = 'rest'; report(); const was = G.own; G.own = false; h.onRest(G.target, was); return false; }
      report(); return true;
    },
    busy: () => G.mode !== 'rest'
  };
}
