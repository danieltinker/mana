// The AI helpers (edge function `menus-ai`, BACKEND.md v2): is it switched on, read a photographed menu page as a
// stream of lines, suggest a name and a description from a dish photo. Pictures are shrunk here, in the browser.
import { signal } from '@preact/signals';
import { cfg, sb, fnUrl, AppError, toAppError } from './api.ts';
import { decode } from './images.ts';

export const SCAN_CODES = ['not_configured', 'not_member', 'limit_ai', 'bad_image', 'too_big', 'not_a_menu', 'unreadable', 'empty', 'busy', 'bad_key', 'timeout', 'upstream', 'failed', 'bad_request', 'not_food', 'network', 'signed_out'];
const MAX_SCAN_B64 = 3_600_000, MAX_DISH_B64 = 1_200_000;

// ---------------------------------------------------------------- "is it switched on": asked once per session
export const aiOn = signal<'unknown' | 'on' | 'off'>('unknown');
let asked: Promise<void> | null = null;
export function askAi(): Promise<void> {
  if (!asked) asked = (async () => {
    try { const r = await call({ action: 'status' }); const j = await r.json(); aiOn.value = j && j.ok && j.configured ? 'on' : 'off'; }
    catch { aiOn.value = 'off'; asked = null; }                      // could not ask (offline): ask again next time
  })();
  return asked;
}

async function call(body: any, signal?: AbortSignal): Promise<Response> {
  let token = '';
  try { token = (await sb.auth.getSession()).data.session?.access_token || ''; } catch { /* signed out */ }
  try {
    return await fetch(fnUrl('menus-ai'), { method: 'POST', signal, headers: { apikey: cfg!.supabaseKey, Authorization: 'Bearer ' + (token || cfg!.supabaseKey), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) { throw toAppError(e); }
}

// ---------------------------------------------------------------- shrinking a picture for the function
const b64 = (blob: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new AppError('bad_image')); r.readAsDataURL(blob); });

/** A JPEG no longer than `maxSide` on its long side whose base64 text stays under `maxChars`: smaller and plainer until it fits. */
export async function shrink(file: Blob, maxSide: number, maxChars: number, quality = 0.82): Promise<{ media_type: 'image/jpeg'; data: string; width: number; height: number }> {
  const im = await decode(file);
  try {
    let side = maxSide, qual = quality;
    for (let i = 0; i < 7; i++) {
      const k = Math.min(1, side / Math.max(im.w, im.h)), w = Math.max(1, Math.round(im.w * k)), h = Math.max(1, Math.round(im.h * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.imageSmoothingQuality = 'high';
      im.draw(ctx, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', qual));
      if (!blob) throw new AppError('bad_image');
      const data = await b64(blob);
      if (data.length < maxChars) return { media_type: 'image/jpeg', data, width: w, height: h };
      if (qual > 0.7) qual -= 0.1; else side = Math.round(side * 0.8);
    }
    throw new AppError('too_big');
  } finally { im.close(); }
}

// ---------------------------------------------------------------- scan one page of a menu
export type ScanEvent =
  | { t: 'start' } | { t: 'lang'; v: 'he' | 'en' | 'other' }
  | { t: 'cat'; he: string; en: string; kind: string }
  | { t: 'item'; he: string; en: string; dhe: string; den: string; price_minor: number | null; note_he: string; note_en: string; tags: string[]; stock: string | null }
  | { t: 'done'; cats: number; items: number; lang: string; truncated: boolean }
  | { t: 'error'; code: string };

/** Reads one page. Calls onEvent for every line as it arrives. Resolves with how it ended; throws an AppError with one of SCAN_CODES. */
export async function scanPage(file: Blob, opts: { businessId: string; langs: string[]; stock: { id: string; label: string }[]; signal?: AbortSignal; onEvent: (e: ScanEvent) => void }): Promise<{ truncated: boolean; cut: boolean; items: number }> {
  const image = await shrink(file, 2400, MAX_SCAN_B64);
  const r = await call({ action: 'scan_menu', business_id: opts.businessId, image: { media_type: image.media_type, data: image.data }, langs: opts.langs, stock: opts.stock }, opts.signal);
  if (!r.ok || !r.body) {
    if (r.status === 401 || r.status === 403) throw new AppError('signed_out');
    throw new AppError(r.status === 404 ? 'not_configured' : r.status === 429 ? 'busy' : 'failed');
  }
  if (/application\/json/i.test(r.headers.get('content-type') || '')) {            // a plain refusal, not a stream
    const j = await r.json().catch(() => null);
    throw new AppError(j && typeof j.code === 'string' && SCAN_CODES.includes(j.code) ? j.code : 'failed');
  }
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '', items = 0, ended: { truncated: boolean } | null = null;
  const line = (raw: string) => {
    const s = raw.trim(); if (!s) return;
    let e: any; try { e = JSON.parse(s); } catch { return; }
    if (!e || typeof e.t !== 'string') return;
    if (e.t === 'error') throw new AppError(SCAN_CODES.includes(e.code) ? e.code : 'failed');
    if (e.t === 'item') items++;
    if (e.t === 'done') ended = { truncated: !!e.truncated };
    opts.onEvent(e as ScanEvent);
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf('\n')) >= 0) { const one = buf.slice(0, i); buf = buf.slice(i + 1); line(one); }
    }
    if (buf.trim()) line(buf);
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (opts.signal && opts.signal.aborted) throw new AppError('aborted');
    if (!items) throw new AppError('network');                       // the connection dropped before anything arrived
    return { truncated: true, cut: true, items };                     // keep what arrived
  }
  if (!ended) { if (!items) throw new AppError('failed'); return { truncated: true, cut: true, items }; }
  return { truncated: (ended as { truncated: boolean }).truncated, cut: false, items };
}

// ---------------------------------------------------------------- a name and a description from a dish photo
export type Suggestion = { name: { he: string; en: string }; desc: { he: string; en: string }; kind: string; stock: string | null };
export async function describeDish(photo: Blob, opts: { businessId: string; name?: string; langs: string[]; stock: { id: string; label: string }[] }): Promise<Suggestion> {
  const image = await shrink(photo, 1024, MAX_DISH_B64, 0.8);
  const r = await call({ action: 'describe_dish', business_id: opts.businessId, image: { media_type: image.media_type, data: image.data }, name: opts.name || undefined, langs: opts.langs, stock: opts.stock });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok || !j.suggestion) throw new AppError(j && typeof j.code === 'string' && SCAN_CODES.includes(j.code) ? j.code : r.status === 404 ? 'not_configured' : 'failed');
  const s = j.suggestion, str = (v: any) => (typeof v === 'string' ? v : '');
  return { name: { he: str(s.name?.he), en: str(s.name?.en) }, desc: { he: str(s.desc?.he), en: str(s.desc?.en) }, kind: str(s.kind) || 'food', stock: typeof s.stock === 'string' ? s.stock : null };
}
