// Small canvas helpers: everything here runs on the owner's device.
import { AppError } from './api.ts';

/** What a file really is, read from its first bytes: phones hand over photos with an empty or a wrong type. '' = not a picture format we know. */
export type PictureKind = '' | 'jpeg' | 'png' | 'webp' | 'gif' | 'bmp' | 'avif' | 'heic' | 'tiff';
const KIND_TYPE: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif', heic: 'image/heic', tiff: 'image/tiff' };
export async function sniff(blob: Blob): Promise<PictureKind> {
  let b: Uint8Array;
  try { b = new Uint8Array(await blob.slice(0, 40).arrayBuffer()); } catch { return ''; }
  const text = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b[0] === 0x89 && text(1, 4) === 'PNG') return 'png';
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') return 'webp';
  if (text(0, 4) === 'GIF8') return 'gif';
  if (text(0, 2) === 'BM') return 'bmp';
  if (text(0, 4) === 'II*\0' || text(0, 4) === 'MM\0*') return 'tiff';
  if (text(4, 8) === 'ftyp') {                                        // the iPhone's HEIC and AVIF share one container: the brands tell them apart
    const brands = text(8, 12) + ' ' + text(16, 40);
    if (/avif|avis/.test(brands)) return 'avif';
    if (/hei[cxms]|hev[cxms]|mif1|msf1/.test(brands)) return 'heic';
  }
  return '';
}

type Opened = { w: number; h: number; draw: (ctx: CanvasRenderingContext2D, dx: number, dy: number, dw: number, dh: number, sx?: number, sy?: number, sw?: number, sh?: number) => void; close: () => void };
/**
 * A JPEG has no see-through parts. When part of one comes out empty, the file was cut short (a download or a transfer that
 * never finished) and the browser drew only what was there, or nothing at all, without reporting an error. Such a file
 * counts as unreadable, so a blank or half page is never sent to be "read". Looked at twice: the whole picture made tiny,
 * and three spots at full size (Chrome opens a small version of a cut file and still draws the real one empty).
 */
function cutShort(im: Opened): boolean {
  const n = 16, c = document.createElement('canvas');
  try {
    c.width = n * 4; c.height = n;
    const ctx = c.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
    if (!ctx) return false;
    im.draw(ctx, 0, 0, n, n);
    const full = im.w >= n && im.h >= n;
    if (full) {
      im.draw(ctx, n, 0, n, n, 0, 0, n, n);
      im.draw(ctx, n * 2, 0, n, n, Math.floor((im.w - n) / 2), Math.floor((im.h - n) / 2), n, n);
      im.draw(ctx, n * 3, 0, n, n, im.w - n, im.h - n, n, n);
    }
    const px = ctx.getImageData(0, 0, full ? n * 4 : n, n).data;
    let empty = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] < 16) empty++;
    return empty > 3;
  } catch { return false; } finally { c.width = c.height = 0; }
}

const why = (e: unknown) => (e && typeof e === 'object' && ('name' in e || 'message' in e) ? `${(e as any).name || 'Error'}: ${(e as any).message || ''}` : String(e));

/**
 * Opens a picture for drawing, upright (the camera's rotation note is applied). Tries the fast decoder first and an <img>
 * second, which reads a few more formats in some browsers (HEIC in Safari). Throws AppError 'heic' for an iPhone HEIC photo
 * this browser cannot open and 'bad_image' for anything else it cannot read; the reasons go to the console.
 */
export async function decode(blob: Blob): Promise<Opened> {
  const tried: string[] = [];
  const kind = blob && blob.size ? await sniff(blob) : '';
  const whole = (im: Opened): Opened => { if (kind === 'jpeg' && cutShort(im)) { im.close(); throw new Error('only part of the picture is in the file (it was cut short)'); } return im; };
  // a known picture under a missing or wrong label (no type from a file manager, "application/octet-stream", a JPEG named .HEIC) gets its real type
  const src = kind && blob.type !== KIND_TYPE[kind] ? new Blob([blob], { type: KIND_TYPE[kind] }) : blob;
  if (blob && blob.size) {
    try {
      const bmp = await createImageBitmap(src, { imageOrientation: 'from-image' } as any);
      if (!bmp.width || !bmp.height) { bmp.close(); throw new Error('empty bitmap'); }
      return whole({ w: bmp.width, h: bmp.height, close: () => bmp.close(),
        draw: (ctx, dx, dy, dw, dh, sx = 0, sy = 0, sw = bmp.width, sh = bmp.height) => ctx.drawImage(bmp, sx, sy, sw, sh, dx, dy, dw, dh) });
    } catch (e) { tried.push('createImageBitmap → ' + why(e)); }
    const url = URL.createObjectURL(src);
    try {
      const img = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('the browser could not decode it')); im.src = url; });
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('no size');
      return whole({ w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url),
        draw: (ctx, dx, dy, dw, dh, sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight) => ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) });
    } catch (e) { URL.revokeObjectURL(url); tried.push('<img> → ' + why(e)); }
  } else tried.push('the file is empty');
  const code = kind === 'heic' ? 'heic' : 'bad_image';
  console.warn('[mana] picture not readable: ' + JSON.stringify({ code, looksLike: kind || 'not a picture', name: (blob as File)?.name || '', type: blob?.type || '', bytes: blob?.size || 0, tried }));
  throw new AppError(code, code === 'heic' ? 'A HEIC photo, which this browser cannot open.' : 'This file is not a picture this browser can read.');
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
