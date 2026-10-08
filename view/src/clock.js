/* One clock for everything that moves: the glide, the stage's springs, and the few DOM motions (the card's cross-fade, the
   sheets, the hint). Nothing here animates with CSS, so in filming mode (?capture=1) and in tests the same clock can be turned
   by hand, frame by frame, and every run comes out the same.

     ticker.add(fn)      fn(dt seconds) → true (more to do), 'slow' (more to do, half the frames are enough) or false
     ticker.wake()       something changed: run frames until every fn says false
     ticker.advance(dt)  manual mode only: one frame of dt seconds
     ticker.now()        milliseconds on this clock (the real clock, or the hand-turned one) */
export function createTicker({ manual = false, onFrameTime = null } = {}) {
  const subs = []; let raf = 0, last = 0, running = false, virtual = 0, skip = false, slow = false;
  function run(dt) { let more = false, quick = false; for (let i = 0; i < subs.length; i++) { const r = subs[i](dt); if (r === true) { more = true; quick = true; } else if (r === 'slow') more = true; } slow = more && !quick; return more; }
  function frame(now) {
    raf = 0; if (document.hidden) { running = false; last = 0; return; }
    if (slow && (skip = !skip)) { raf = requestAnimationFrame(frame); return; }            // at rest only the gentle sway moves: 30 frames a second are plenty
    const raw = last ? Math.max(0, (now - last) / 1000) : 0, dt = Math.min(.05, raw || 1 / 60); last = now;
    if (onFrameTime && raw > 0 && !slow) onFrameTime(raw);
    if (run(dt)) raf = requestAnimationFrame(frame); else { running = false; last = 0; }
  }
  const api = {
    manual,
    add(fn) { subs.push(fn); return () => { const i = subs.indexOf(fn); if (i >= 0) subs.splice(i, 1); }; },
    wake() { if (manual || running) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
    advance(dt) { virtual += dt * 1000; return run(dt); },
    now: () => (manual ? virtual : performance.now()),
    running: () => running, stop() { if (raf) cancelAnimationFrame(raf); raf = 0; running = false; }
  };
  if (!manual && typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden) api.wake(); });
  return api;
}

/* Small tweens on that clock. tween(key, ms, draw, done): draw(k) is called with k from 0 to 1 (eased); a new tween on the
   same key replaces the old one. */
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
export function createTweens(ticker) {
  const live = new Map();
  ticker.add((dt) => {
    if (!live.size) return false;
    Array.from(live.entries()).forEach(([key, tw]) => { if (live.get(key) !== tw) return; tw.t += dt * 1000; const k = tw.ms <= 0 ? 1 : Math.min(1, tw.t / tw.ms); tw.draw(tw.linear ? k : easeOut(k)); if (k >= 1) { if (live.get(key) === tw) live.delete(key); if (tw.done) tw.done(); } });
    return live.size > 0;
  });
  return {
    run(key, ms, draw, done, linear) { const tw = { t: 0, ms, draw, done, linear: !!linear }; live.set(key, tw); draw(0); if (ms <= 0) { live.delete(key); draw(1); if (done) done(); return; } ticker.wake(); },
    cancel(key) { live.delete(key); }, active: (key) => live.has(key), count: () => live.size
  };
}
