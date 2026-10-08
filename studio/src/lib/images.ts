// Small canvas helpers: everything here runs on the owner's device.
import { AppError } from './api.ts';

export async function decode(blob: Blob): Promise<{ w: number; h: number; draw: (ctx: CanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number, sx?: number, sy?: number, sw?: number, sh?: number) => void; close: () => void }> {
  try {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' } as any);
    return { w: bmp.width, h: bmp.height, close: () => bmp.close(),
      draw: (ctx, dx, dy, dw, dh, sx = 0, sy = 0, sw = bmp.width, sh = bmp.height) => ctx.drawImage(bmp, sx, sy, sw, sh, dx, dy, dw, dh) };
  } catch { /* fall through to <img>, which decodes a few more formats in some browsers */ }
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('decode')); im.src = url; });
    if (!img.naturalWidth) throw new Error('decode');
    return { w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url),
      draw: (ctx, dx, dy, dw, dh, sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight) => ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) };
  } catch { URL.revokeObjectURL(url); throw new AppError('bad_image', 'This file is not a picture this browser can read.'); }
}

const toBlob = (c: HTMLCanvasElement, type: string, quality?: number) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new AppError('bad_image', 'Could not encode the picture.'))), type, quality));

/** Fit inside maxSide (never enlarges). JPEG gets a white background; PNG keeps transparency. */
export async function resize(blob: Blob, maxSide: number, type: 'image/jpeg' | 'image/png' = 'image/jpeg', quality = 0.9): Promise<Blob> {
  const im = await decode(blob);
  try {
    const k = Math.min(1, maxSide / Math.max(im.w, im.h)), w = Math.max(1, Math.round(im.w * k)), h = Math.max(1, Math.round(im.h * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingQuality = 'high';
    im.draw(ctx, 0, 0, w, h);
    return await toBlob(c, type, quality);
  } finally { im.close(); }
}

/** Centre-cropped square JPEG (thumbnails of plain photos). */
export async function squareThumb(blob: Blob, side = 256): Promise<Blob> {
  const im = await decode(blob);
  try {
    const s = Math.min(im.w, im.h), c = document.createElement('canvas'); c.width = c.height = side;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, side, side); ctx.imageSmoothingQuality = 'high';
    im.draw(ctx, 0, 0, side, side, (im.w - s) / 2, (im.h - s) / 2, s, s);
    return await toBlob(c, 'image/jpeg', 0.86);
  } finally { im.close(); }
}

// ---- colour
export function hexToHsl(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
}
export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}
/** The viewer is dark: an accent must be a bright, clear hue to be readable there. */
export function brighten(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#ff8a5c';
  const [h, s, l] = hexToHsl(hex);
  if (s < 0.12) return hslToHex(h, 0.1, Math.min(0.86, Math.max(0.78, l)));        // greys stay grey, but light
  return hslToHex(h, Math.min(1, Math.max(0.55, s)), Math.min(0.74, Math.max(0.6, l)));
}
export const isBright = (hex: string) => { const [, s, l] = hexToHsl(hex); return l >= 0.58 && l <= 0.9 && (s >= 0.5 || s < 0.12); };

/** The most common clear colour of a logo, made bright enough for the viewer. null when the logo has no colour to speak of. */
export async function accentFromImage(blob: Blob): Promise<string | null> {
  const im = await decode(blob);
  try {
    const side = 48, c = document.createElement('canvas'); c.width = c.height = side;
    const ctx = c.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
    im.draw(ctx, 0, 0, side, side);
    const px = ctx.getImageData(0, 0, side, side).data, bins = new Map<number, { n: number; h: number; s: number; l: number }>();
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 128) continue;
      const [h, s, l] = hexToHsl('#' + [px[i], px[i + 1], px[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''));
      if (s < 0.25 || l < 0.12 || l > 0.92) continue;
      const k = Math.round(h / 20), b = bins.get(k) || { n: 0, h: 0, s: 0, l: 0 };
      const w = s; b.n += w; b.h += h * w; b.s += s * w; b.l += l * w; bins.set(k, b);
    }
    let best: { n: number; h: number; s: number; l: number } | null = null;
    for (const b of bins.values()) if (!best || b.n > best.n) best = b;
    if (!best || best.n < 6) return null;
    return brighten(hslToHex(best.h / best.n, best.s / best.n, best.l / best.n));
  } finally { im.close(); }
}
