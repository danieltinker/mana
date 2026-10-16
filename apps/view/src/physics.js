/* The glide, as numbers. Pure: no DOM, no three.js, no clock of its own, so it is unit-tested in node.

   Positions are in dishes: 0 is the first dish of the open category, 1 the next one. A finger moves the table by
   pixels / pxPerDish. Letting go hands the table a velocity (dishes per second); from there:

     1. where it would coast to     project(p, v) = p + v·TAU      (the rest point of an exponential decay with time constant TAU,
                                                                     which is how a native scroll loses speed)
     2. which dish that means       settleTarget(…)                 the nearest dish to that point; a flick always moves at least one
     3. how it gets there           springStep(…)                   ONE critically damped spring that starts with the finger's own
                                                                     velocity. Its stiffness is chosen per release (stiffnessFor) so that
                                                                     the table never speeds up after the finger has left it when the
                                                                     momentum was enough: it only slows down and lands exactly on the dish.

   Past the first and the last dish the table stretches like a rubber band (rubber / unrubber). */

export const TAU = 0.2;           // s      how long momentum lasts: a release at v carries about v·TAU (short: a flick is ONE dish, only a hard one passes several)
export const FLICK = 0.9;         // dish/s faster than this when the finger leaves is a flick
export const OMEGA_MIN = 9.5;     // 1/s    the softest settle (a slow release, a long glide)
export const OMEGA_MAX = 17;      // 1/s    the firmest (a hard flick into a near dish or into the end)
export const OMEGA_FLY = 10.5;    // 1/s    travel asked for by a key, a chip or the list
export const BAND = 0.85;         // dish   the furthest the rubber band stretches
export const BAND_SLOPE = 0.55;   //        how much of the finger's travel the band gives at its start
export const EDGE_PULL = 0.22;        // dish   stretched this far past the last dish and let go: on to the next category (about 160 px of finger on a phone)
export const VELOCITY_WINDOW = 80; // ms    the finger's speed is measured over its last samples only

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

/* Speed of the finger when it left, in units per second, from samples [{ t (ms), x }] (oldest first).
   Only the last VELOCITY_WINDOW ms count; a finger that stopped before lifting has no speed. */
export function velocity(samples, now, windowMs = VELOCITY_WINDOW) {
  const n = samples.length; if (n < 2) return 0;
  const last = samples[n - 1]; if (now - last.t > windowMs) return 0;
  let first = last;
  for (let i = n - 2; i >= 0; i--) { if (last.t - samples[i].t > windowMs) break; first = samples[i]; }
  const dt = last.t - first.t; if (dt < 4) return 0;
  return (last.x - first.x) / dt * 1000;
}

/* Rubber band. raw = where the finger asks the table to be, shown = where it is drawn. Inside 0…max they are the same. */
function stretch(over) { return BAND * (1 - 1 / (over * BAND_SLOPE / BAND + 1)); }
function unstretch(shown) { const s = Math.min(shown, BAND * 0.999); return (BAND / BAND_SLOPE) * (1 / (1 - s / BAND) - 1); }
export function rubber(raw, max) { return raw < 0 ? -stretch(-raw) : raw > max ? max + stretch(raw - max) : raw; }
export function unrubber(shown, max) { return shown < 0 ? -unstretch(-shown) : shown > max ? max + unstretch(shown - max) : shown; }

export const project = (p, v) => p + v * TAU;

/* Which dish the table settles on after the finger leaves at position p (as drawn) with velocity v.
   max = index of the last dish. Returns { target, edge }: edge is -1 / +1 when the guest pulled or flicked past an end,
   which the caller turns into "previous / next category" (or a bounce when there is none). */
export function settleTarget(p, v, max) {
  const flick = Math.abs(v) >= FLICK;
  let t = Math.round(project(p, v));
  if (flick && v > 0) t = Math.max(t, Math.floor(p + 1e-6) + 1);          // a flick moves at least one dish, even a short one
  if (flick && v < 0) t = Math.min(t, Math.ceil(p - 1e-6) - 1);
  let edge = 0;
  if (p > max + EDGE_PULL || (flick && v > 0 && p > max - 0.3 && t > max)) edge = 1;
  else if (p < -EDGE_PULL || (flick && v < 0 && p < 0.3 && t < 0)) edge = -1;
  return { target: clamp(t, 0, max), edge };
}

/* Stiffness of the settle spring for a release at p with velocity v towards target. A critically damped spring starts by
   slowing down only if omega <= 2·v / distance; within the limits we take exactly that, so a real momentum glide never speeds up. */
export function stiffnessFor(p, v, target) {
  const d = target - p;
  if (Math.abs(d) < 1e-4 || d * v <= 0) return OMEGA_MIN + 2.5;            // coming back from a stretch, or let go while still
  return clamp(2 * Math.abs(v) / Math.abs(d), OMEGA_MIN, OMEGA_MAX);
}

/* One exact step of a critically damped spring (closed form, so 30 and 120 frames a second trace the same curve).
   s = { x, v }, towards target with stiffness omega, over dt seconds. Mutates and returns s. */
export function springStep(s, target, omega, dt) {
  const a = s.x - target, b = s.v + omega * a, e = Math.exp(-omega * dt);
  s.x = target + (a + b * dt) * e; s.v = (b - omega * (a + b * dt)) * e;
  return s;
}
export const atRest = (s, target, eps = 0.0012, veps = 0.02) => Math.abs(s.x - target) < eps && Math.abs(s.v) < veps;

/* A turned dish: free to spin with the finger's speed, pulled back to straight by a soft spring, never past its limit.
   s = { x (radians), v }, limit in radians (Infinity = a bottle, which turns all the way and stays where it stops). */
export function turnStep(s, limit, dt) {
  if (!isFinite(limit)) { s.x += s.v * dt; s.v *= Math.exp(-dt * 2.6); if (Math.abs(s.v) < 0.01) s.v = 0; return s; }
  const sub = Math.max(1, Math.ceil(dt / 0.008)), h = dt / sub, w = 5.2, z = 0.82;      // a little under-damped: it comes back with weight
  for (let i = 0; i < sub; i++) { s.v += (-w * w * s.x - 2 * z * w * s.v) * h; s.x += s.v * h; if (Math.abs(s.x) > limit) { s.x = Math.sign(s.x) * limit; if (s.x * s.v > 0) s.v = 0; } }
  if (Math.abs(s.x) < 0.0015 && Math.abs(s.v) < 0.01) { s.x = 0; s.v = 0; }
  return s;
}
/* while the finger holds it: the turn follows the finger, softly resisting towards the limit */
export function turnDrag(x, dx, limit) {
  const nx = x + dx; if (!isFinite(limit)) return nx;
  return clamp(nx, -limit, limit);
}
