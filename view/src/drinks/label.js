/* Labels, typeset on a canvas from the merchant's own words (see labelText in spec.js) in the menu's two typefaces.
   A plain typographic label: a frame, a rule, the name. It copies no real label; an empty field leaves an empty place. */
import { isRtlText } from './spec.js';

const SERIF = '"Frank Ruhl Libre","Times New Roman",serif', SANS = '"IBM Plex Sans Hebrew",Arial,sans-serif';
const css = (c) => (typeof c === 'string' ? c : 'rgb(' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',') + ')');

function setDir(x, s) { try { x.direction = isRtlText(s) ? 'rtl' : 'ltr'; } catch (e) { /* older canvases draw left to right */ } }
function spaced(x, s, px) { try { x.letterSpacing = isRtlText(s) ? '0px' : px + 'px'; } catch (e) { /* optional */ } }
/* draw s centred at (cx, y), as large as fits maxW (between min and max px), on up to `lines` lines; returns the height used */
function fitText(x, s, cx, y, maxW, font, max, min, lines = 1, upper = false) {
  s = String(s || '').trim(); if (!s) return 0;
  if (upper && !isRtlText(s)) s = s.toUpperCase();
  setDir(x, s);
  const words = s.split(/\s+/); let rows = [s], size = max;
  const widest = () => Math.max.apply(null, rows.map((r) => x.measureText(r).width));
  const shrink = () => { size = max; x.font = font(size); while (widest() > maxW && size > min) { size -= 2; x.font = font(size); } };
  shrink();
  if (lines > 1 && words.length > 1 && size < max * .72) {            // better two comfortable lines than one small one
    let best = 1, bd = 1e9; for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (d < bd) { bd = d; best = i; } }
    rows = [words.slice(0, best).join(' '), words.slice(best).join(' ')]; shrink();
  }
  if (widest() > maxW) rows = rows.map((r) => { while (x.measureText(r + '…').width > maxW && r.length > 3) r = r.slice(0, -1); return r === s ? r : r + '…'; });
  const lh = size * 1.08; rows.forEach((r, i) => x.fillText(r, cx, y + i * lh + size * .5));
  return rows.length * lh;
}

/* style: 'wine' | 'sparkling' | 'beer' | 'can' | 'badge' | 'back' */
export function paintLabel(cv, t, o) {
  const st = o.style, W = cv.width, H = cv.height, x = cv.getContext('2d'), ink = css(o.ink), paper = css(o.paper);
  x.clearRect(0, 0, W, H); x.textAlign = 'center'; x.textBaseline = 'middle';
  if (st === 'can') {                                                 // the whole wrap; the front is the middle of the strip
    x.fillStyle = css(o.wrap); x.fillRect(0, 0, W, H);
    x.fillStyle = ink; x.globalAlpha = .9; x.fillRect(0, H * .1, W, H * .012); x.fillRect(0, H * .888, W, H * .012); x.globalAlpha = 1;
    const cx = W / 2, mw = W * .3; let y = H * .2;
    spaced(x, t.top, 3); y += fitText(x, t.top, cx, y, mw, (s) => '600 ' + s + 'px ' + SANS, 30, 16, 1, true) + H * .05; spaced(x, '', 0);
    y += fitText(x, t.title, cx, y, mw, (s) => '700 ' + s + 'px ' + SERIF, 104, 40, 2) + H * .03;
    x.fillRect(cx - 34, y, 68, 3); y += H * .045;
    y += fitText(x, t.mid, cx, y, mw, (s) => '500 ' + s + 'px ' + SANS, 34, 18, 2) + H * .02;
    fitText(x, t.foot, cx, H * .8, mw, (s) => '500 ' + s + 'px ' + SANS, 30, 16);
    return;
  }
  x.fillStyle = paper; x.fillRect(0, 0, W, H);
  if (st === 'back') {
    x.fillStyle = ink; let y = H * .2; (t.back || []).slice(0, 3).forEach((s) => { y += fitText(x, s, W / 2, y, W * .8, (z) => '400 ' + z + 'px ' + SANS, 34, 18, 2) + H * .07; });
    return;
  }
  const m = st === 'badge' ? W * .07 : W * .055;
  x.strokeStyle = ink; x.fillStyle = ink;
  x.globalAlpha = .85; x.lineWidth = Math.max(2, W * .008); x.strokeRect(m, m, W - 2 * m, H - 2 * m);
  x.globalAlpha = .5; x.lineWidth = Math.max(1, W * .003); x.strokeRect(m + W * .022, m + W * .022, W - 2 * m - W * .044, H - 2 * m - W * .044); x.globalAlpha = 1;
  const cx = W / 2, mw = W - 2 * m - W * .11;
  if (st === 'badge') { let y = H * .2; y += fitText(x, t.top, cx, y, mw, (s) => '600 ' + s + 'px ' + SANS, 26, 14, 1, true) + H * .06; fitText(x, t.title, cx, y, mw, (s) => '700 ' + s + 'px ' + SERIF, 76, 26, 2); return; }
  const blockH = H * (st === 'beer' ? .3 : .34); let y = H * .15;
  spaced(x, t.top, W * .008); y += fitText(x, t.top, cx, y, mw, (s) => '600 ' + s + 'px ' + SANS, W * .062, W * .034, 2, true); spaced(x, '', 0);
  y = Math.max(y + H * .03, H * .26);
  x.globalAlpha = .7; x.fillRect(cx - W * .09, y, W * .18, Math.max(2, H * .005)); x.globalAlpha = 1;
  x.save(); x.translate(cx, y + Math.max(2, H * .005) / 2); x.rotate(Math.PI / 4); x.fillRect(-W * .012, -W * .012, W * .024, W * .024); x.restore();
  y += H * .06;
  const used = fitText(x, t.title, cx, y + (blockH - Math.min(blockH, W * .21)) * .25, mw, (s) => '700 ' + s + 'px ' + SERIF, W * .21, W * .075, 2);
  y += Math.max(used, blockH * .7) + H * .04;
  y += fitText(x, t.mid, cx, y, mw, (s) => 'italic 400 ' + s + 'px ' + SERIF, W * .068, W * .04, 2);
  fitText(x, t.foot, cx, H * .835, mw, (s) => '500 ' + s + 'px ' + SANS, W * .056, W * .032);
}
