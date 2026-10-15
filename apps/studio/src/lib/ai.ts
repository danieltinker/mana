// The AI helpers (edge function `menus-ai`, BACKEND.md v2): is it switched on, read a photographed menu page as a
// stream of lines, suggest a name and a description from a dish photo. Pictures are shrunk here, in the browser.
import { signal } from '@preact/signals';
import { cfg, sb, fnUrl, AppError, toAppError } from './api.ts';
import { decode } from './images.ts';

export const SCAN_CODES = ['not_configured', 'not_member', 'limit_ai', 'bad_image', 'heic', 'too_big', 'not_a_menu', 'unreadable', 'empty', 'busy', 'bad_key', 'timeout', 'upstream', 'failed', 'bad_request', 'not_food', 'network', 'signed_out'];
// The function takes up to 3.6 million base64 characters for a menu page and 1.2 million for a dish. A page is sent well under
// that (about 1.8 MB of JPEG at most): quicker on a phone's connection, and never near the limit.
const MAX_SCAN_B64 = 2_400_000, MAX_DISH_B64 = 1_200_000;
// Longest side of a scanned page. The model reads pictures up to about 2,576 px on the long side and shrinks larger ones itself,
// so more than this only makes the upload heavier; less makes small print on a full page hard to read.
const SCAN_SIDE = 2400;
const SCAN_PATIENCE_MS = 180_000;    // the function closes a scan after 138 s: a call that is still open after this is stuck

/**
 * Every failure of an AI call leaves one line in the console with what is known about it (the screen shows only a sentence).
 * A warning, not an error: these are failures the app handles and explains; console errors stay reserved for bugs.
 */
export function logAi(what: string, info: Record<string, unknown>) {
  try { console.warn('[mana scan] ' + what + ' ' + JSON.stringify(info)); } catch { /* a console that cannot print */ }
}

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
  const text = JSON.stringify(body);
  try {
    return await fetch(fnUrl('menus-ai'), { method: 'POST', signal, headers: { apikey: cfg!.supabaseKey, Authorization: 'Bearer ' + (token || cfg!.supabaseKey), 'Content-Type': 'application/json' }, body: text });
  } catch (e) {
    // fetch fails only when the request never got an answer (no network, a dropped upload, a blocked address) or was cancelled
    const err = toAppError(e);
    if (err.code === 'aborted') throw err;
    logAi('no answer from the service', { action: body?.action, sent: text.length, online: typeof navigator !== 'undefined' ? navigator.onLine : null, error: `${(e as any)?.name || ''}: ${(e as any)?.message || e}` });
    throw new AppError('network', err.message);
  }
}
/**
 * A code the function answered with. "bad_image" from there is never the owner's file: what was sent is a JPEG this app made
 * a moment ago from a picture it could open, so the failure is on the service's side (the function deployed on 7 Oct 2026 also
 * says "bad_image" for every refusal of the model's API, a wrong key included). A file the owner must change is caught here,
 * before anything is sent.
 */
const fromService = (code: unknown): string => (typeof code !== 'string' || !SCAN_CODES.includes(code) ? 'failed' : code === 'bad_image' || code === 'heic' ? 'upstream' : code);
/** What an HTTP error from the function's address means (the function itself always answers 200 with a code inside). */
function httpCode(status: number): string {
  if (status === 401 || status === 403) return 'signed_out';
  if (status === 404) return 'not_configured';
  if (status === 413) return 'too_big';
  if (status === 429) return 'busy';
  if (status === 408 || status === 504) return 'timeout';
  if (status >= 500) return 'upstream';                              // the function crashed, was out of memory or did not start
  return 'failed';
}

// ---------------------------------------------------------------- shrinking a picture for the function
const b64 = (blob: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(new AppError('bad_image')); r.readAsDataURL(blob); });

/**
 * The one way a picture leaves this app for the AI helpers, whatever it was (camera or gallery; JPEG, PNG, WebP, HEIC where
 * the browser reads it; any size): opened upright, drawn no longer than `maxSide` on its long side, and saved as a JPEG whose
 * base64 text stays under `maxChars`: plainer first, then smaller, until it fits.
 */
export async function shrink(file: Blob, maxSide: number, maxChars: number, quality = 0.82): Promise<{ media_type: 'image/jpeg'; data: string; width: number; height: number }> {
  const im = await decode(file);
  try {
    let side = maxSide, qual = quality;
    for (let i = 0; i < 8; i++) {
      const k = Math.min(1, side / Math.max(im.w, im.h)), w = Math.max(1, Math.round(im.w * k)), h = Math.max(1, Math.round(im.h * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      let data = '';
      try {
        const ctx = c.getContext('2d');
        if (ctx) {                                                   // no context or no blob: the phone is out of canvas memory, so go smaller
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.imageSmoothingQuality = 'high';
          im.draw(ctx, 0, 0, w, h);
          const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', qual));
          if (blob && blob.size) data = await b64(blob);
        }
      } finally { c.width = c.height = 0; }                          // hand the canvas memory back now (Safari keeps it otherwise)
      if (data && data.length < maxChars) return { media_type: 'image/jpeg', data, width: w, height: h };
      if (data && qual > 0.7) qual -= 0.1; else side = Math.round(side * 0.8);
    }
    logAi('the picture could not be made small enough', { width: im.w, height: im.h, bytes: file.size, type: file.type, maxSide, maxChars });
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
  const image = await shrink(file, SCAN_SIDE, MAX_SCAN_B64);
  const sent = { width: image.width, height: image.height, b64: image.data.length };
  // one switch for "the owner closed the scan" and "this has been open far too long"
  const ac = new AbortController();
  let late = false;
  const stop = () => ac.abort();
  if (opts.signal) { if (opts.signal.aborted) ac.abort(); else opts.signal.addEventListener('abort', stop, { once: true }); }
  const timer = setTimeout(() => { late = true; ac.abort(); }, SCAN_PATIENCE_MS);
  const cancelled = () => !!opts.signal && opts.signal.aborted;
  let items = 0;
  try {
    let r: Response;
    try { r = await call({ action: 'scan_menu', business_id: opts.businessId, image: { media_type: image.media_type, data: image.data }, langs: opts.langs, stock: opts.stock }, ac.signal); }
    catch (e) {
      if (late && !cancelled()) { logAi('the service did not answer in time', { ...sent, ms: SCAN_PATIENCE_MS }); throw new AppError('timeout'); }
      throw e;
    }
    if (!r.ok || !r.body) {
      const code = r.ok ? 'failed' : httpCode(r.status);
      logAi('the service answered with an error', { code, http: r.status, type: r.headers.get('content-type') || '', body: (await r.text().catch(() => '')).slice(0, 300), ...sent });
      throw new AppError(code);
    }
    if (/application\/json/i.test(r.headers.get('content-type') || '')) {            // a plain refusal, not a stream
      const j = await r.json().catch(() => null);
      const code = fromService(j && j.code);
      logAi('the service refused the request', { code, answer: j, ...sent });
      throw new AppError(code);
    }
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = '', ended: { truncated: boolean } | null = null;
    const line = (raw: string) => {
      const s = raw.trim(); if (!s) return;
      let e: any; try { e = JSON.parse(s); } catch { return; }
      if (!e || typeof e.t !== 'string') return;
      if (e.t === 'error') {
        const code = fromService(e.code);
        logAi('the service could not read the page', { code, answer: e, ...sent });          // answer: the function's own code, and the API's status and error type when it has them
        throw new AppError(code);
      }
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
      if (cancelled()) throw new AppError('aborted');
      logAi('the answer stopped half way', { items, late, error: `${(e as any)?.name || ''}: ${(e as any)?.message || e}`, ...sent });
      if (!items) throw new AppError(late ? 'timeout' : 'network');     // the connection dropped before anything arrived
      return { truncated: true, cut: true, items };                     // keep what arrived
    }
    if (!ended) {
      logAi('the answer ended without its last line', { items, ...sent });
      if (!items) throw new AppError('failed');
      return { truncated: true, cut: true, items };
    }
    return { truncated: (ended as { truncated: boolean }).truncated, cut: false, items };
  } finally { clearTimeout(timer); if (opts.signal) opts.signal.removeEventListener('abort', stop); }
}

// ---------------------------------------------------------------- a name and a description from a dish photo
export type Suggestion = { name: { he: string; en: string }; desc: { he: string; en: string }; kind: string; stock: string | null };
export async function describeDish(photo: Blob, opts: { businessId: string; name?: string; langs: string[]; stock: { id: string; label: string }[] }): Promise<Suggestion> {
  const image = await shrink(photo, 1024, MAX_DISH_B64, 0.8);
  const r = await call({ action: 'describe_dish', business_id: opts.businessId, image: { media_type: image.media_type, data: image.data }, name: opts.name || undefined, langs: opts.langs, stock: opts.stock });
  const j = await r.json().catch(() => null);
  if (!j || !j.ok || !j.suggestion) {
    const code = r.ok ? fromService(j && j.code) : httpCode(r.status);          // not ok = the platform answered, not the function (its "code" is not ours)
    logAi('no suggestion for the photo', { code, http: r.status, answer: j, width: image.width, height: image.height, b64: image.data.length });
    throw new AppError(code);
  }
  const s = j.suggestion, str = (v: any) => (typeof v === 'string' ? v : '');
  return { name: { he: str(s.name?.he), en: str(s.name?.en) }, desc: { he: str(s.desc?.he), en: str(s.desc?.en) }, kind: str(s.kind) || 'food', stock: typeof s.stock === 'string' ? s.stock : null };
}
