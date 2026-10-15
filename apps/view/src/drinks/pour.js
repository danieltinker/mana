/* The pour: one timeline for every drink. Pure: time in, a pose out. No simulation, nothing random, nothing that loops.
   It plays once and ends in exactly the rest pose (a filled, still glass), which is also what reduced motion shows from the start.

   pose = { fade, tilt, head, tail, level, wobble, foam, bubbles, cam, done }
     fade     0…1  the wine already in the glass fades out while the camera arrives (lead-in), so the pour starts from empty
     tilt     0…1  how far the bottle / can / tap handle has moved towards pouring
     head     0…1  how far down the stream has reached      tail 0…1  how much of it has already left the spout
     level    0…1  liquid height in the glass (1 = the merchant's serving)
     wobble   small signed number: the surface rocks, then settles to 0
     foam     head thickness as a fraction of the settled collar (beer grows past 1, then settles to exactly 1)
     bubbles  0…1  strength of the rising bubbles; 0 = none drawn
     cam      0…1  camera pulled back to hold the whole movement (1) or closed in on the still drink (0) */

const clamp = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const smoother = (x) => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };

export const LEAD = 0.5;                          // seconds before the pour proper: the glass empties out of sight of nobody, quietly

export function pourPlan(o = {}) {                // o: { beer, sparkling, source: 'bottle' | 'tap' | 'above' }
  const still = o.source === 'above' || o.source === 'tap', tiltIn = still ? .3 : .5, flow = o.beer ? 2.1 : 1.9, tiltOut = still ? .3 : .55;      // a tap handle moves faster than a bottle
  const t0 = tiltIn, t1 = t0 + flow, tb = t1 + .17, t2 = tb + tiltOut;      // tb: the last of the stream has left before the bottle (or the tap handle) starts back
  const fizz = o.beer ? 5.5 : o.sparkling ? 6 : .7;                // how long bubbles keep rising after the stream stops
  const settle = o.beer ? 3.2 : .9;                                // surface (and foam) come to rest
  return { t0, t1, tb, t2, fizz, settle, beer: !!o.beer, sparkling: !!o.sparkling, action: t2, end: Math.max(t2 + .25, t1 + settle, t1 + fizz) };
}
export const REST = (o = {}) => ({ fade: 1, tilt: 0, head: 0, tail: 1, level: 1, wobble: 0, foam: o.beer ? 1 : 0, bubbles: 0, cam: 0, done: true });

export function pourAt(t, o = {}) {
  const p = pourPlan(o);
  if (t >= p.end) return REST(o);
  if (t < 0) return Object.assign(REST(o), { fade: 1 - smooth((t + LEAD) / (LEAD * .7)), cam: smooth((t + LEAD) / LEAD), done: false });
  const tilt = t < p.t0 ? smooth(t / p.t0) : t < p.tb ? 1 : 1 - smooth((t - p.tb) / (p.t2 - p.tb));
  const head = clamp((t - (p.t0 - .06)) / .2), tail = clamp((t - p.t1) / .16);
  const level = smoother((t - p.t0 - .12) / (p.t1 - p.t0 - .04));
  const amp = t < p.t0 ? 0 : t < p.t1 ? .9 * clamp((t - p.t0) / .3) : .9 * Math.exp(-(t - p.t1) * 4.2);
  const wobble = amp < .004 ? 0 : amp * Math.sin(t * 12.5);
  let foam = 0, bubbles = 0;
  if (p.beer) { foam = t < p.t1 ? 1.55 * Math.pow(level, .7) : 1 + .55 * Math.exp(-(t - p.t1) / .75); if (t >= p.t1 && foam < 1.004) foam = 1;
    bubbles = t < p.t0 ? 0 : t < p.t1 ? 1 : 1 - smooth((t - p.t1) / p.fizz); }
  else if (p.sparkling) { foam = t < p.t1 ? .55 * Math.pow(level, .7) : .55 * (1 - smooth((t - p.t1) / 1.3)); bubbles = t < p.t0 ? 0 : t < p.t1 ? 1 : 1 - smooth((t - p.t1) / p.fizz); }
  else bubbles = t < p.t0 ? 0 : t < p.t1 ? .7 : .7 * (1 - smooth((t - p.t1) / p.fizz));
  const cam = t < p.tb ? 1 : 1 - smooth((t - p.tb) / (p.t2 - p.tb + .25));
  return { fade: 1, tilt, head, tail, level, wobble, foam, bubbles, cam, done: false };
}
