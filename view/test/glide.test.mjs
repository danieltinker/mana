/* The glide controller on a fake clock: what a finger, a wheel and a request do to p (where the camera is, in dishes). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlide } from '../src/glide.js';
import { BAND, EDGE_PULL } from '../src/physics.js';

function rig({ n = 9, at = 0, walk = 1, px = 300, onEdge = () => false } = {}) {
  let t = 0; const log = [];
  const g = createGlide({ now: () => t, wake() {}, walk: () => walk, pxPerDish: () => px, depth: (y) => y / px, onFocus: (i) => log.push('focus ' + i), onEdge: (d) => { log.push('edge ' + d); return onEdge(d, g); }, onRest: (i, own) => log.push('rest ' + i + (own ? ' own' : '')) });
  g.enter(n, at); t = 1000;                                                    // (a table just entered ignores the wheel for a moment: see the wheel test)
  const tick = (ms = 16) => { t += ms; return g.step(ms / 1000); };
  const run = (ms = 2500) => { for (let i = 0; i < ms / 8 && g.busy(); i++) tick(8); };
  /* a finger: from y0 by dy over ms, in 8 ms samples; released unless hold */
  const drag = (dy, ms, { y0 = 400, hold = false, ease = (k) => k } = {}) => { g.dragStart(y0); const steps = Math.max(1, Math.round(ms / 8)); for (let i = 1; i <= steps; i++) { tick(8); g.dragMove(y0 + dy * ease(i / steps)); } if (!hold) g.dragEnd(false); return y0 + dy; };
  return { g, S: g.state, log, tick, run, drag, time: () => t };
}

test('while the finger is down the table follows it exactly; the dish in focus changes as the next one crosses the line', () => {
  const r = rig();
  r.drag(120, 200, { hold: true }); assert.ok(Math.abs(r.S.p - 120 / 300) < 1e-9, 'p = pixels / pixels per dish'); assert.deepEqual(r.log, []);
  r.g.dragMove(400 + 156); assert.ok(Math.abs(r.S.p - .52) < 1e-9); assert.deepEqual(r.log, ['focus 1'], 'crossed half way');
  r.g.dragMove(400 + 140); assert.deepEqual(r.log, ['focus 1', 'focus 0'], 'and back');
  r.tick(300); r.g.dragEnd(false); r.run();
  assert.equal(r.S.p, 0); assert.equal(r.S.mode, 'rest'); assert.deepEqual(r.log.slice(-1), ['rest 0 own']);
});

test('a flick moves one dish; a hard flick passes several; both land exactly on a dish', () => {
  const r = rig();
  r.drag(70, 64); r.run();                                                    // 70 px in 64 ms ≈ 3.6 dishes a second
  assert.equal(r.S.p, 1); assert.deepEqual(r.log, ['focus 1', 'rest 1 own']);
  const h = rig(); h.drag(260, 72); h.run();                                  // ≈ 12 dishes a second
  assert.ok(h.S.p >= 3 && Number.isInteger(h.S.p), 'landed on dish ' + h.S.p); assert.deepEqual(h.log.filter((l) => l.startsWith('focus')).map((l) => +l.slice(6)), Array.from({ length: h.S.p }, (_, i) => i + 1), 'every dish it passed was in focus on the way');
  const slow = rig(); slow.drag(100, 700); slow.tick(200); slow.run(); assert.equal(slow.S.p, 0, 'a slow drag of a third of a dish goes back');
  const b = rig({ at: 4 }); b.drag(-70, 64); b.run(); assert.equal(b.S.p, 3, 'and the other way');
});

test('the scene never jumps: grabbing it in mid-flight takes it from where it is', () => {
  const r = rig(); r.drag(260, 72); for (let i = 0; i < 6; i++) r.tick(8);
  const mid = r.S.p; assert.ok(mid > .9 && r.S.mode === 'settle');
  r.g.dragStart(300); assert.equal(r.S.p, mid); r.tick(8); r.g.dragMove(300); assert.ok(Math.abs(r.S.p - mid) < 1e-9);
  r.tick(120); r.g.dragEnd(false); r.run(); assert.equal(r.S.p, Math.round(mid));
});

test('both ends stretch like a rubber band; a pull or a flick past the last dish asks for the next table', () => {
  const r = rig({ at: 0 });
  r.drag(-240, 300, { hold: true }); assert.ok(r.S.p < 0 && r.S.p > -BAND, 'before the first dish: ' + r.S.p); assert.ok(-r.S.p < 240 / 300 * .6, 'it gives less than the finger asks');
  r.tick(200); r.g.dragEnd(false); r.run(); assert.equal(r.S.p, 0); assert.ok(r.log.includes('edge -1'), 'pulled far enough: it asked'); assert.ok(r.log.includes('rest 0 own'), 'nothing that way: it comes back');
  const small = rig({ at: 8 }); small.drag(60, 300, { hold: true }); small.tick(200); small.g.dragEnd(false); small.run(); assert.equal(small.S.p, 8); assert.ok(!small.log.some((l) => l.startsWith('edge')), 'a small pull is only a stretch');
  let entered = 0; const e = rig({ at: 8, onEdge: (d, g) => { entered++; g.enter(8, 0); return true; } });
  e.drag(70, 64); assert.equal(entered, 1); assert.equal(e.S.p, 0); assert.equal(e.S.n, 8); assert.equal(e.S.mode, 'rest', 'the next table: first dish, standing still');
  const pull = rig({ at: 8, onEdge: (d, g) => { g.enter(8, 0); return true; } }); pull.drag(260, 400, { hold: true }); assert.ok(pull.S.p > 8 + EDGE_PULL); pull.tick(200); pull.g.dragEnd(false); assert.equal(pull.S.p, 0);
  const one = rig({ n: 1 }); one.drag(200, 300, { hold: true }); assert.ok(one.S.p > 0 && one.S.p < BAND, 'a single dish still moves under the finger'); one.tick(200); one.g.dragEnd(false); one.run(); assert.equal(one.S.p, 0);
});

test('dishes of different sizes: the finger and the trackpad move the table by distance, so what was grabbed stays under the finger', () => {
  /* a table where dish 2 is a name card: it takes half the room of a plate. along(p) = how far along the table p is, in plates */
  const Z = [0, 1, 1.75, 2.5, 3.5], along = (p) => { const a = Math.max(0, Math.min(Z.length - 2, Math.floor(p))); return Z[a] + (p - a) * (Z[a + 1] - Z[a]); }, dish = (u) => { let a = 0; while (a < Z.length - 2 && u > Z[a + 1]) a++; return a + (u - Z[a]) / (Z[a + 1] - Z[a]); };
  let t = 0; const g = createGlide({ now: () => t, wake() {}, walk: () => 1, pxPerDish: () => 300, depth: (y) => y / 300, along, dish, onFocus() {}, onEdge: () => false, onRest() {} }), S = g.state;
  g.enter(5, 0); t = 1000;
  g.dragStart(400); t += 8; g.dragMove(400 + 300); assert.ok(Math.abs(S.p - 1) < 1e-9, 'a plate\'s room of finger travel: one dish');
  t += 8; g.dragMove(400 + 300 + 225); assert.ok(Math.abs(S.p - 2) < 1e-9, 'three quarters of that reaches the name card, which stands closer: ' + S.p);
  t += 8; g.dragMove(400 + 300 + 225 + 112.5); assert.ok(Math.abs(S.p - 2.5) < 1e-9, 'and half its own room is half a dish: ' + S.p);
  for (const y of [450, 700, 990, 1270]) { t += 8; g.dragMove(y); assert.ok(Math.abs(along(S.p) - (y - 400) / 300) < 1e-9, 'the table has moved exactly as far as the finger, at ' + y); }
  t += 300; g.dragEnd(false); for (let i = 0; i < 400 && g.busy(); i++) { t += 8; g.step(.008); } assert.equal(S.p, 3); assert.equal(S.mode, 'rest');
  t += 1000; for (let k = 0; k < 10; k++) { g.wheel(15); t += 16; g.step(.016); } assert.ok(Math.abs(along(S.p) - (along(3) + 150 / 300)) < 1e-9, 'a trackpad too: half a plate of scrolling is half a plate of table, ' + S.p);
});

test('the other way round (walk = -1, the feed): a swipe up is the next dish', () => {
  const r = rig({ walk: -1 }); r.drag(-70, 64); r.run(); assert.equal(r.S.p, 1);
  const d = rig({ walk: -1 }); d.drag(-150, 200, { hold: true }); assert.ok(Math.abs(d.S.p - .5) < 1e-9);
});

test('a dish chosen elsewhere (key, chip, list): the table travels there and reports nothing back', () => {
  const r = rig(); r.g.goTo(3); assert.equal(r.S.mode, 'settle'); r.run(); assert.equal(r.S.p, 3); assert.deepEqual(r.log, ['rest 3']);
  r.g.goTo(3); assert.equal(r.S.mode, 'rest'); r.g.goTo(99); r.run(); assert.equal(r.S.p, 8);
  const i = rig(); i.g.goTo(5, true); assert.equal(i.S.p, 5); assert.equal(i.S.mode, 'rest');      // reduced motion: no travel
  const mid = rig(); mid.g.goTo(4); for (let k = 0; k < 10; k++) mid.tick(8); mid.g.goTo(1); mid.run(); assert.equal(mid.S.p, 1, 'a second request in mid-flight simply wins');
});

test('a mouse wheel: one notch is one dish in one glide, more notches go further without stopping, the ends answer', () => {
  const r = rig(); r.g.wheel(100); assert.equal(r.S.mode, 'settle'); assert.equal(r.S.target, 1); assert.equal(r.S.p, 0, 'the table does not jump');
  let last = 0, peak = 0, fell = false; for (let k = 0; k < 200 && r.g.busy(); k++) { r.tick(8); assert.ok(r.S.p >= last - 1e-9, 'never backwards'); if (r.S.v > peak) { assert.ok(!fell, 'one rise and one fall of speed, no second push'); peak = r.S.v; } else if (r.S.v < peak - 1e-6) fell = true; last = r.S.p; }
  assert.equal(r.S.p, 1); assert.deepEqual(r.log, ['focus 1', 'rest 1 own']); assert.ok(r.time() - 1000 < 700, 'in about half a second: ' + (r.time() - 1000) + ' ms');
  for (let k = 0; k < 3; k++) { r.g.wheel(100); r.tick(30); } assert.equal(r.S.target, 4); assert.ok(r.S.v > 0); r.run(); assert.equal(r.S.p, 4, 'three notches, three dishes');
  r.g.wheel(-120); r.run(); assert.equal(r.S.p, 3);
  const end = rig({ at: 8 }); end.g.wheel(100); assert.ok(end.log.includes('edge 1'), 'past the last dish it asks for the next table'); end.tick(40); assert.ok(end.S.p > 8 && end.S.p < 8.08, 'none: a nudge against the end, ' + end.S.p); end.run(); assert.equal(end.S.p, 8);
  const lock = rig(); lock.g.enter(5, 0); lock.g.wheel(300); assert.equal(lock.S.mode, 'rest', 'just arrived at a new table: the wheel\'s own momentum is ignored for a moment'); lock.tick(400); lock.g.wheel(100); assert.equal(lock.S.mode, 'settle');
  let went = 0; const e = rig({ at: 8, onEdge: (d, g) => { went += d; g.enter(5, 0); return true; } }); for (let k = 0; k < 5; k++) { e.g.wheel(120); e.tick(20); } e.tick(200); assert.equal(went, 1); assert.equal(e.S.p, 0, 'one spin of the wheel changes table once: the rest of it does not carry on along the new one');
  const held = rig(); held.drag(60, 100, { hold: true }); const p0 = held.S.p; held.g.wheel(100); assert.equal(held.S.mode, 'drag'); assert.equal(held.S.p, p0, 'a finger on the table outranks the wheel');
});

test('a trackpad: the table follows the fingers exactly and settles when they stop; a nudge is enough, a tremble is not', () => {
  const r = rig(); for (let k = 0; k < 10; k++) { r.g.wheel(12); r.tick(16); } assert.equal(r.S.mode, 'wheel'); assert.ok(Math.abs(r.S.p - 120 / 300) < 1e-9, 'p = pixels scrolled / pixels per dish');
  r.g.wheel(80); assert.ok(Math.abs(r.S.p - 200 / 300) < 1e-9, 'a large step inside a stream is still the stream, not a notch'); r.tick(200); r.run(); assert.equal(r.S.p, 1);
  r.g.wheel(-10); r.tick(200); r.run(); assert.equal(r.S.p, 1, 'a tremble goes back'); r.g.wheel(-12); r.tick(16); r.g.wheel(-12); r.tick(200); r.run(); assert.equal(r.S.p, 0, 'a nudge of 24 px is the previous dish');
  let went = 0; const e = rig({ at: 8, onEdge: (d, g) => { went += d; g.enter(5, 0); return true; } }); for (let k = 0; k < 12; k++) { e.g.wheel(30); e.tick(16); } e.tick(200); assert.equal(went, 1); assert.equal(e.S.p, 0); for (let k = 0; k < 8; k++) { e.g.wheel(30); e.tick(16); } e.tick(200); e.run(); assert.equal(e.S.p, 0, 'the tail of the same swipe does not run on along the new table');
});
