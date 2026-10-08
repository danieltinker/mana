/* Fingers, measured. What a gesture MEANS is decided by the caller (main.js) and the navigation state; this file only says
   what the finger did, with times taken from the page's one clock so scripted input (filming, tests) goes down the same path.

   On the table:      a vertical drag glides along it (the scene follows the finger; past the ends it stretches)
                      a sideways drag pulls the neighbouring table in (the next or the previous category)
                      a tap picks the dish under the finger: the one in focus is lifted, another one is glided to
   While a dish is lifted:  a sideways drag turns it · a drag down or a tap beside it puts it back
   A wheel or trackpad glides (vertical) or changes table (sideways).

   bind(el, h) returns { pointer(type, x, y) } so a script can press, move and release exactly like a finger. */
import { velocity } from './physics.js';

const SLOP = 8, TAP_MS = 650;

export function bindGestures(el, h) {
  let p = null, wheelLock = 0, wheelAcc = 0;
  const rect = () => el.getBoundingClientRect();
  const interactive = (t) => !!(t && t.closest && t.closest('button,a,input,[role="button"]'));

  function down(e) {
    if (p) up({ id: p.id, x: p.lx, y: p.ly }, true);
    p = { id: e.id, x: e.x, y: e.y, lx: e.x, ly: e.y, t: h.now(), axis: null, type: e.type, sx: [{ t: h.now(), x: e.x }], lifted: h.lifted() };
    h.onDown();
  }
  function move(e) {
    if (!p || e.id !== p.id) return false;
    const dx = e.x - p.x, dy = e.y - p.y;
    if (!p.axis) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return false;
      p.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y'; el.classList.add('dragging');
      if (p.lifted) { /* turning or putting back: decided below */ } else if (p.axis === 'y') h.onGlide('start', p.y); else h.onSide('start', 0);
    }
    if (p.lifted) { if (p.axis === 'x') h.onTurn(e.x - p.lx, true, 0); else h.onPull(dy); }
    else if (p.axis === 'y') h.onGlide('move', e.y);
    else h.onSide('move', dx);
    p.sx.push({ t: h.now(), x: e.x }); if (p.sx.length > 24) p.sx.shift();
    p.lx = e.x; p.ly = e.y;
    return true;
  }
  function up(e, cancelled) {
    if (!p || e.id !== p.id) return;
    const q = p; p = null; el.classList.remove('dragging');
    const dx = e.x - q.x, dy = e.y - q.y, w = rect().width || 320, vx = velocity(q.sx, h.now());
    if (q.lifted) {
      if (q.axis === 'x') h.onTurn(0, false, vx);
      else if (q.axis === 'y') h.onPull(dy, true, cancelled);
      else if (!cancelled && h.now() - q.t < TAP_MS) { const r = rect(); h.onTap(e.x - r.left, e.y - r.top, true); }
      return;
    }
    if (q.axis === 'y') { h.onGlide(cancelled ? 'cancel' : 'end', e.y); return; }
    if (q.axis === 'x') {
      const far = Math.abs(dx) > Math.min(84, w * .22), fast = Math.abs(vx) > 420 && Math.abs(dx) > 22 && Math.sign(vx) === Math.sign(dx);
      h.onSide('end', dx, !cancelled && (far || fast) ? Math.sign(dx) : 0);
      return;
    }
    if (!cancelled && h.now() - q.t < TAP_MS) { const r = rect(); h.onTap(e.x - r.left, e.y - r.top, false); }
  }

  el.addEventListener('pointerdown', (e) => {
    if (e.button || interactive(e.target)) return;
    try { el.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
    down({ id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType });
  });
  el.addEventListener('pointermove', (e) => {
    if (!p || e.pointerId !== p.id) { if (e.pointerType === 'mouse' && !e.buttons) { const r = rect(); h.onPointer((e.clientX - r.left) / r.width * 2 - 1, (e.clientY - r.top) / r.height * 2 - 1, e.clientX - r.left, e.clientY - r.top); } return; }
    if (move({ id: e.pointerId, x: e.clientX, y: e.clientY }) && e.cancelable) e.preventDefault();
  });
  el.addEventListener('pointerup', (e) => up({ id: e.pointerId, x: e.clientX, y: e.clientY }, false));
  el.addEventListener('pointercancel', (e) => up({ id: e.pointerId, x: e.clientX, y: e.clientY }, true));
  el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !p) h.onPointer(0, 0, -1, -1); });
  /* the drag is ours from its first pixel: no pull-to-refresh, no swipe-back, and no browser fling that would swallow the next tap */
  el.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  el.addEventListener('wheel', (e) => {
    e.preventDefault(); if (h.lifted()) return;
    const k = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? 400 : 1;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.3) {                                   // a two-finger sideways swipe on a trackpad changes table
      const now = h.now(); if (now < wheelLock) return;
      wheelAcc += e.deltaX * k; if (Math.abs(wheelAcc) < 60) return;
      wheelLock = now + 520; const sx = -Math.sign(wheelAcc); wheelAcc = 0; h.onSide('end', 0, sx); return;
    }
    wheelAcc = 0; h.onWheel(e.deltaY * k);
  }, { passive: false });
  el.addEventListener('dragstart', (e) => e.preventDefault());
  el.addEventListener('contextmenu', (e) => { if (p) e.preventDefault(); });
  return {
    /* scripted input: the same three calls a finger makes */
    pointer(type, x, y) { const e = { id: -7, x, y, type: 'touch' }; if (type === 'down') down(e); else if (type === 'move') move(e); else if (type === 'up') up(e, false); else if (type === 'cancel') up(e, true); },
    active: () => !!p
  };
}
