/* A QR code as one SVG path (square modules, no styling tricks: plain codes scan best).
   qrPath(text, { ecc }) → { n, d }   n = modules per side (without quiet zone), d = path data on an n × n grid. */
import QRCode from 'qrcode';
export function qrPath(text, { ecc = 'Q' } = {}) {
  const q = QRCode.create(text, { errorCorrectionLevel: ecc }), n = q.modules.size, m = q.modules.data; let d = '';
  for (let y = 0; y < n; y++) { let x = 0; while (x < n) { if (!m[y * n + x]) { x++; continue; } let x1 = x; while (x1 < n && m[y * n + x1]) x1++; d += `M${x} ${y}h${x1 - x}v1h-${x1 - x}z`; x = x1; } }
  return { n, d };
}
/* <svg> element with a 4-module quiet zone; fg/bg are colours */
export function qrSvg(text, { ecc = 'Q', fg = '#0F0F0F', bg = '#FFFFFF', title = 'QR', attrs = '' } = {}) {
  const { n, d } = qrPath(text, { ecc }), s = n + 8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges" role="img" ${attrs}><title>${title}</title><rect width="${s}" height="${s}" fill="${bg}"/><path transform="translate(4 4)" fill="${fg}" d="${d}"/></svg>`;
}
