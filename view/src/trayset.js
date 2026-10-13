/* "My table" sets itself: when the guest opens their table, a cloth floats down onto the wood and settles, then a plate for each
   dish they chose arrives in turn (its own small picture), with a little weight and a bounce; a glass for each drink, the cutlery
   beside. About two seconds, drawn on a small canvas at the top of the sheet, on the page's one clock (so it can be filmed frame by
   frame). Reduced motion: the table is shown set, at once. The words are the list under it; the canvas has a text equivalent.

   layoutSet(n, W, H) and poseAt(t, i) are pure (unit-tested); paint() draws one instant. */

export const CLOTH_T = .55, STEP = .2, LAND = .42;            // the cloth has settled by CLOTH_T · each place arrives STEP after the one before · and takes LAND to land
export const durationOf = (n) => CLOTH_T + Math.max(0, n - 1) * STEP + LAND + .1;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
/* the spring of the brief's motion language, cubic-bezier(.34,1.36,.64,1), as a function of time 0…1 */
function springEase(x) {
  x = clamp(x); if (x === 0 || x === 1) return x; let lo = 0, hi = 1, u = x;
  for (let k = 0; k < 18; k++) { u = (lo + hi) / 2; const bx = 3 * u * (1 - u) * (1 - u) * .34 + 3 * u * u * (1 - u) * .64 + u * u * u; if (bx < x) lo = u; else hi = u; }
  return 3 * u * (1 - u) * (1 - u) * 1.36 + 3 * u * u * (1 - u) * 1 + u * u * u;
}
/* where the places are on the cloth: one row up to four, two rows beyond; at most eight */
export function layoutSet(n, W, H) {
  const m = Math.min(n, 8), rows = m > 4 ? 2 : 1, per = Math.ceil(m / rows), cw = W * .86, ch = H * .74, x0 = (W - cw) / 2, y0 = (H - ch) / 2;
  const r = Math.max(8, Math.min(cw / per / 2.9, ch / rows / 2.5)), out = [];
  for (let i = 0; i < m; i++) { const row = rows === 2 ? Math.floor(i / per) : 0, inRow = rows === 2 && row === 1 ? m - per : Math.min(m, per), k = i - row * per;
    out.push({ x: x0 + cw * (k + .5) / inRow, y: y0 + ch * (row + .5) / rows, r }); }
  return { places: out, cloth: [x0, y0, cw, ch] };
}
/* one place at time t: how far it has come down (0 = landed), its scale, its opacity */
export function poseAt(t, i) {
  const k = clamp((t - CLOTH_T - i * STEP) / LAND); if (k <= 0) return { on: 0, drop: 1, scale: 1.3 };
  const e = springEase(k); return { on: clamp(k * 3), drop: 1 - e, scale: 1 + .3 * (1 - e) };
}
export function clothAt(t) { const k = clamp(t / CLOTH_T), e = springEase(k); return { on: clamp(k * 2.2), drop: 1 - e, scale: 1 + .12 * (1 - e) }; }

/* items: [{ drink, img (a loaded <img> or null), colour, initial }] */
export function paint(cv, t, items, rtl) {
  const x = cv.getContext('2d'), W = cv.width, H = cv.height, L = layoutSet(items.length, W, H);
  x.clearRect(0, 0, W, H);
  const wood = x.createLinearGradient(0, 0, W, H); wood.addColorStop(0, '#2c1f15'); wood.addColorStop(1, '#1b130d'); x.fillStyle = wood; x.fillRect(0, 0, W, H);
  x.globalAlpha = .07; x.strokeStyle = '#f0c89a'; x.lineWidth = 1; for (let k = 0; k < 9; k++) { x.beginPath(); const y = H * (k + .5) / 9; x.moveTo(0, y); x.bezierCurveTo(W * .3, y + 4, W * .7, y - 4, W, y + 2); x.stroke(); } x.globalAlpha = 1;
  const c = clothAt(t), [cx0, cy0, cw, ch] = L.cloth;
  if (c.on > 0) {
    x.save(); x.globalAlpha = c.on;
    const mx = cx0 + cw / 2, my = cy0 + ch / 2 - c.drop * H * .22;
    x.fillStyle = 'rgba(0,0,0,' + (.35 * (1 - c.drop * .7)) + ')'; x.filter = 'blur(' + Math.round(6 + 10 * c.drop) + 'px)'; x.fillRect(cx0 + 4, cy0 + 8, cw, ch); x.filter = 'none';
    x.translate(mx, my); x.scale(c.scale, c.scale); x.translate(-cw / 2, -ch / 2);
    const lin = x.createLinearGradient(0, 0, 0, ch); lin.addColorStop(0, '#f3ece0'); lin.addColorStop(1, '#e6dccb'); x.fillStyle = lin; x.beginPath(); x.roundRect ? x.roundRect(0, 0, cw, ch, 6) : x.rect(0, 0, cw, ch); x.fill();
    x.globalAlpha = c.on * .1; x.strokeStyle = '#8a7a63'; for (let k = 6; k < cw; k += 6) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k, ch); x.stroke(); } for (let k = 6; k < ch; k += 6) { x.beginPath(); x.moveTo(0, k); x.lineTo(cw, k); x.stroke(); }
    x.globalAlpha = c.on * .5; x.strokeStyle = '#c8b89c'; x.lineWidth = 1.2; x.strokeRect(5, 5, cw - 10, ch - 10);
    x.restore();
  }
  L.places.forEach((p, i) => {
    const it = items[i], q = poseAt(t, i); if (!q.on) return;
    const py = p.y - q.drop * H * .5, r = p.r * q.scale;
    x.save(); x.globalAlpha = q.on;
    x.fillStyle = 'rgba(40,26,14,' + (.32 * (1 - q.drop)) + ')'; x.beginPath(); x.ellipse(p.x + r * .12, p.y + r * .2, r * (1 + q.drop * .3), r * .92, 0, 0, 7); x.fill();
    if (it.drink) {
      x.beginPath(); x.arc(p.x, py, r * .62, 0, 7); x.fillStyle = 'rgba(255,255,255,.16)'; x.fill();
      x.save(); x.beginPath(); x.arc(p.x, py, r * .5, 0, 7); x.clip();
      if (it.img) x.drawImage(it.img, p.x - r * .5, py - r * .5, r, r); else { x.fillStyle = it.colour || '#d9a441'; x.fillRect(p.x - r, py - r, 2 * r, 2 * r); }
      x.restore();
      x.lineWidth = Math.max(1.2, r * .06); x.strokeStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.arc(p.x, py, r * .62, 0, 7); x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(p.x, py, r * .5, Math.PI * 1.1, Math.PI * 1.5); x.stroke();
    } else {
      const g = x.createRadialGradient(p.x - r * .2, py - r * .25, r * .1, p.x, py, r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e7e1d8'); x.fillStyle = g; x.beginPath(); x.arc(p.x, py, r, 0, 7); x.fill();
      x.strokeStyle = 'rgba(120,104,84,.35)'; x.lineWidth = 1; x.beginPath(); x.arc(p.x, py, r * .8, 0, 7); x.stroke();
      x.save(); x.beginPath(); x.arc(p.x, py, r * .74, 0, 7); x.clip();
      if (it.img) x.drawImage(it.img, p.x - r * .74, py - r * .74, r * 1.48, r * 1.48); else { x.fillStyle = '#efe8dc'; x.fillRect(p.x - r, py - r, 2 * r, 2 * r); x.fillStyle = '#6b5a45'; x.font = '700 ' + Math.round(r * .7) + 'px "Frank Ruhl Libre",serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(it.initial || '·', p.x, py + r * .04); }
      x.restore();
      /* the cutlery, beside the plate as it is set: fork on the left, knife on the right (mirrored in Hebrew) */
      const s = rtl ? -1 : 1, fx = p.x - s * r * 1.22, kx = p.x + s * r * 1.22, top = py - r * .8, bot = py + r * .8;
      x.strokeStyle = 'rgba(214,214,220,.92)'; x.lineCap = 'round'; x.lineWidth = Math.max(1.4, r * .08);
      x.beginPath(); x.moveTo(fx, top + r * .45); x.lineTo(fx, bot); x.stroke();
      x.lineWidth = Math.max(.8, r * .035); for (let k = -1.5; k <= 1.5; k++) { x.beginPath(); x.moveTo(fx + k * r * .07, top); x.lineTo(fx + k * r * .07, top + r * .42); x.stroke(); }
      x.lineWidth = Math.max(1.6, r * .1); x.beginPath(); x.moveTo(kx, top); x.lineTo(kx, bot); x.stroke();
    }
    x.restore();
  });
}
