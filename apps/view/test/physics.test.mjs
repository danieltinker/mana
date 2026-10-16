/* The glide as numbers: momentum, which dish it settles on, the rubber band, flick thresholds, the settle spring, turning. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TAU, FLICK, OMEGA_MIN, OMEGA_MAX, BAND, BAND_SLOPE, EDGE_PULL, velocity, rubber, unrubber, project, settleTarget, stiffnessFor, springStep, atRest, turnStep, turnDrag } from '../src/physics.js';

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
/* run the settle spring from (p, v) to target at a given frame rate; returns the samples */
function run(p, v, target, fps = 120, seconds = 2.5) {
  const s = { x: p, v }, w = stiffnessFor(p, v, target), out = [{ t: 0, x: p, v }];
  for (let i = 1; i <= seconds * fps; i++) { springStep(s, target, w, 1 / fps); out.push({ t: i / fps, x: s.x, v: s.v }); }
  return out;
}

test('the finger\'s speed comes from its last 80 ms only; a finger that stopped has none', () => {
  const line = (t0, x0, v, n, step) => Array.from({ length: n }, (_, i) => ({ t: t0 + i * step, x: x0 + v * i * step / 1000 }));
  assert.ok(near(velocity(line(0, 0, 3, 10, 16), 144), 3, 1e-9), 'a steady drag: its own speed');
  const slowThenFast = line(0, 0, .2, 20, 16).concat(line(320, .064, 6, 6, 16));      // crawled, then flicked for the last 80 ms
  assert.ok(Math.abs(velocity(slowThenFast, 400) - 6) < .01, 'only the end of the gesture counts: ' + velocity(slowThenFast, 400));
  assert.equal(velocity(line(0, 0, 5, 10, 16), 144 + 200), 0, 'paused 200 ms before lifting: no momentum');
  assert.equal(velocity([{ t: 0, x: 1 }], 0), 0); assert.equal(velocity([], 0), 0);
  assert.equal(velocity([{ t: 0, x: 0 }, { t: 2, x: 1 }], 2), 0, 'two samples 2 ms apart are noise, not a speed');
});

test('momentum: a release at v would coast v·TAU, and the dish nearest to that point is where it lands', () => {
  assert.ok(near(project(2, 3), 2 + 3 * TAU));
  assert.deepEqual(settleTarget(2.1, 0, 8), { target: 2, edge: 0 }); assert.deepEqual(settleTarget(2.6, 0, 8), { target: 3, edge: 0 });
  assert.deepEqual(settleTarget(2.3, .5, 8), { target: 2, edge: 0 }, 'slower than a flick and short of half way: back to where it was');
  assert.equal(settleTarget(2.4, .8, 8).target, 3, 'not a flick, but its momentum carries it past half way');
});

test('flick thresholds: a flick moves one dish, a hard flick may pass several, never past the ends', () => {
  assert.equal(settleTarget(2.05, FLICK, 8).target, 3, 'a short quick flick: the next dish');
  assert.equal(settleTarget(2.05, FLICK - .01, 8).target, 2, 'just under the threshold: it stays');
  assert.equal(settleTarget(2.0, -FLICK, 8).target, 1); assert.equal(settleTarget(1.95, -1.2, 8).target, 1);
  assert.equal(settleTarget(1.6, 1.2, 8).target, 2, 'pulled back, then flicked forward: the dish ahead of the finger, not two');
  assert.equal(settleTarget(2.2, 4, 8).target, 3); assert.equal(settleTarget(2.0, 6, 8).target, 3, 'an ordinary quick flick (about 1,600 px a second on a phone) is still one dish'); assert.equal(settleTarget(2.2, 7, 8).target, 4); assert.equal(settleTarget(2.2, 15, 8).target, 5, 'a hard flick passes several');
  assert.deepEqual(settleTarget(2.2, 40, 8), { target: 8, edge: 0 }, 'from the middle a flick stops at the last dish; it does not jump table');
  assert.deepEqual(settleTarget(6.5, -40, 8), { target: 0, edge: 0 });
  for (let p = -.2; p <= 8.2; p += .13) for (let v = -12; v <= 12; v += .7) { const r = settleTarget(p, v, 8); assert.ok(Number.isInteger(r.target) && r.target >= 0 && r.target <= 8); if (Math.abs(v) >= FLICK && p > .4 && p < 7.6) assert.ok(v > 0 ? r.target > p - 1e-6 : r.target < p + 1e-6, 'a flick never lands behind itself'); }
  assert.deepEqual(settleTarget(0, 0, 0), { target: 0, edge: 0 }, 'a menu of one dish has nowhere to go');
  assert.deepEqual(settleTarget(0, 5, 0), { target: 0, edge: 1 }, 'and a flick on it asks for the next table');
});

test('the ends: pulled or flicked past the last dish means "the next table", a small pull only stretches', () => {
  assert.deepEqual(settleTarget(8 + EDGE_PULL + .01, 0, 8), { target: 8, edge: 1 }); assert.deepEqual(settleTarget(8 + EDGE_PULL - .05, 0, 8), { target: 8, edge: 0 });
  assert.deepEqual(settleTarget(-EDGE_PULL - .01, 0, 8), { target: 0, edge: -1 });
  assert.deepEqual(settleTarget(8.05, 2, 8), { target: 8, edge: 1 }, 'a flick onwards while standing at the last dish');
  assert.deepEqual(settleTarget(7.2, 2, 8), { target: 8, edge: 0 }, 'a flick from the dish before it only arrives at the last');
  assert.deepEqual(settleTarget(-.05, -2, 8), { target: 0, edge: -1 }); assert.deepEqual(settleTarget(.1, -2, 8), { target: 0, edge: 0 }, 'dragged a little forward and flicked back: only back to the first dish');
});

test('rubber band: inside nothing changes; outside it gives less and less, never more than BAND; and it can be undone', () => {
  for (let x = 0; x <= 8; x += .37) { assert.equal(rubber(x, 8), x); assert.equal(unrubber(x, 8), x); }
  let last = 8; for (let over = .01; over < 30; over *= 1.4) { const y = rubber(8 + over, 8); assert.ok(y > last && y < 8 + BAND && y - 8 < over, 'stretched ' + over); assert.ok(near(unrubber(y, 8), 8 + over, 1e-6 * (1 + over * over))); last = y; }
  assert.ok(near((rubber(8.001, 8) - 8) / .001, BAND_SLOPE, .01), 'the band starts at ' + BAND_SLOPE + ' of the finger\'s travel');
  assert.ok(near(rubber(-.7, 8), -(rubber(8.7, 8) - 8)), 'the same at both ends');
  assert.ok(rubber(8 + 1000, 8) < 8 + BAND);
});

test('the settle: lands exactly, never speeds up on real momentum, a hair of overshoot at most, the same at any frame rate', () => {
  for (const [p, v] of [[0, 2], [.3, 4], [.6, 3], [1.2, 7], [2.2, 11], [.1, 1], [0, .9], [.45, 0], [.55, 0], [3, -5], [8.25, 0], [-.2, 0], [7.6, 14]]) {
    const { target } = settleTarget(p, v, 8), tr = run(p, v, target), d = target - p, end = tr[tr.length - 1], name = `p=${p} v=${v} → ${target}`;
    assert.ok(Math.abs(end.x - target) < 1e-4 && Math.abs(end.v) < 1e-3, name + ': it arrives');
    const settled = tr.find((s) => atRest(s, target)); assert.ok(settled && settled.t <= 1.25, name + ': at rest after ' + (settled ? settled.t.toFixed(2) : '∞') + ' s');
    const past = Math.max(...tr.map((s) => (s.x - target) * Math.sign(d || 1))), stopped = Math.abs(project(p, v) - target) > .5;      // stopped = the end of the table cut the glide short
    assert.ok(past < (stopped ? .15 : .02), name + ': overshoot ' + past.toFixed(4) + ' of a dish'); if (stopped && Math.abs(v) > 8) assert.ok(past > .01, 'a hard flick into the end bounces a little');
    const w = stiffnessFor(p, v, target); assert.ok(w >= OMEGA_MIN && w <= OMEGA_MAX);
    if (d * v > 0 && 2 * Math.abs(v) / Math.abs(d) >= OMEGA_MIN && 2 * Math.abs(v) / Math.abs(d) <= OMEGA_MAX) {      // the momentum was enough: the table only ever slows down
      for (let i = 1; i < tr.length; i++) assert.ok(Math.abs(tr[i].v) <= Math.abs(tr[i - 1].v) + 1e-9, name + ': it speeds up at ' + tr[i].t.toFixed(3));
      for (let i = 1; i < tr.length; i++) assert.ok((tr[i].x - tr[i - 1].x) * Math.sign(d) >= -1e-9, name + ': it never turns back');
    }
    const slow = run(p, v, target, 30); for (let i = 0; i < slow.length; i += 5) assert.ok(near(slow[i].x, tr[i * 4].x, 1e-7), name + ': 30 and 120 frames a second disagree at ' + slow[i].t);
  }
  const flick = run(.2, 3, 1); assert.ok(flick.find((s) => atRest(s, 1)).t < 1, 'a one-dish flick is at rest within a second'); assert.ok(flick.find((s) => Math.abs(s.x - 1) < .02).t < .6, 'and within a few pixels of its dish well before that');
  const hard = run(.2, 11, settleTarget(.2, 11, 8).target), half = hard.find((s) => s.x > 1.85); assert.ok(half.t < .35, 'a hard flick is nearly there after a third of a second');
});

test('turning a lifted dish: it follows the finger to its limit, carries on when let go, and comes back straight; a bottle stays', () => {
  assert.equal(turnDrag(.2, .1, .45), .30000000000000004); assert.equal(turnDrag(.4, .3, .45), .45); assert.equal(turnDrag(-.4, -.3, .45), -.45); assert.equal(turnDrag(5, 2, Infinity), 7);
  const s = { x: .1, v: 3 }; let peak = 0, back = false;
  for (let i = 0; i < 300; i++) { turnStep(s, .45, 1 / 60); assert.ok(Math.abs(s.x) <= .45 + 1e-9); peak = Math.max(peak, s.x); if (i > 10 && s.x < peak - .05) back = true; }
  assert.ok(peak > .3, 'inertia carries it on: ' + peak); assert.ok(back); assert.equal(s.x, 0); assert.equal(s.v, 0);
  const b = { x: 1, v: 4 }; for (let i = 0; i < 600; i++) turnStep(b, Infinity, 1 / 60);
  assert.ok(b.x > 2 && b.v === 0, 'a bottle turns on and stays where it stops: ' + b.x);
  const a = { x: .3, v: 0 }, c = { x: .3, v: 0 }; for (let i = 0; i < 30; i++) turnStep(a, .45, 1 / 30); for (let i = 0; i < 120; i++) turnStep(c, .45, 1 / 120);
  assert.ok(Math.abs(a.x - c.x) < .01, 'near enough the same at 30 and 120 frames a second');
});
