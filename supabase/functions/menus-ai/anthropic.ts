/** The one paid call: the Messages API with the page images and the prompt from @mana/import. */
import { scanPrompt, scanSystem, type ScanMode, type StockHint } from '@mana/import';
import type { Lang } from '@mana/contracts';
import type { Deps } from './deps.ts';

const API = 'https://api.anthropic.com/v1/messages';
/** The longest answer one call may give (as v1); a longer one is cut and its pages say so (`page_truncated`). */
export const MAX_TOKENS = 16_000;

export type Image = { readonly mediaType: string; readonly data: string };
export type ModelAnswer =
  | { readonly ok: true; readonly text: string; readonly truncated: boolean; readonly usage: { readonly in: number; readonly out: number } }
  | { readonly ok: false; readonly code: string; readonly status: number };

/** The image formats the API reads, by their first bytes (the bucket also takes HEIC and AVIF, which it does not). */
export function sniffMedia(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return 'image/webp';
  if (b.length >= 4 && String.fromCharCode(...b.subarray(0, 4)) === 'GIF8') return 'image/gif';
  return null;
}

/** Base64 without Node's Buffer (Deno and Node both have `btoa`). */
export function toBase64(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * What a refusal from the API means (as v1 learned on 11 Oct 2026: a 400 is not "a bad picture" by itself; a key
 * without a workspace, a spend limit or a request the API does not accept are 400s too).
 * bad_key = our key, billing or permissions · busy = try again later · bad_image / too_big = this image · upstream = anything else
 */
export function upstreamError(status: number, bodyText: string): string {
  let msg = '';
  try { const e = JSON.parse(bodyText)?.error; msg = typeof e?.message === 'string' ? e.message : ''; } catch { /* not JSON (a gateway page) */ }
  if (status === 401 || status === 402 || status === 403) return 'bad_key';
  if (status === 429 || status === 529 || status === 503) return 'busy';
  if (status === 413) return 'too_big';
  if (status === 400) {
    if (/workspace|api[ _-]?key|credit|billing|spend|usage limit|organization/i.test(msg)) return 'bad_key';
    if (/image|base64|media[_ ]type|pixels/i.test(msg)) return /exceed|maximum|too large|at most/i.test(msg) ? 'too_big' : 'bad_image';
  }
  return 'upstream';
}

/** The request body of one call (exported for its test: images first, then the prompt). */
export function requestBody(model: string, mode: ScanMode, images: readonly Image[], langs: readonly Lang[], stock: readonly StockHint[]): Record<string, unknown> {
  const content: unknown[] = [];
  images.forEach((im, i) => {
    if (images.length > 1) content.push({ type: 'text', text: `Image ${i + 1}:` });
    content.push({ type: 'image', source: { type: 'base64', media_type: im.mediaType, data: im.data } });
  });
  content.push({ type: 'text', text: scanPrompt(mode, langs, stock, images.length) });
  return { model, max_tokens: MAX_TOKENS, system: scanSystem(), messages: [{ role: 'user', content }] };
}

export async function callModel(d: Deps, body: Record<string, unknown>, signal: AbortSignal): Promise<ModelAnswer> {
  const headers: Record<string, string> = { 'x-api-key': d.env.anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
  if (d.env.workspaceId) headers['anthropic-workspace-id'] = d.env.workspaceId;
  const r = await d.fetch(API, { method: 'POST', headers, body: JSON.stringify(body), signal });
  if (!r.ok) return { ok: false, code: upstreamError(r.status, await r.text().catch(() => '')), status: r.status };
  const m = await r.json().catch(() => null) as { content?: Array<{ type?: string; text?: string }>; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number } } | null;
  if (!m || !Array.isArray(m.content)) return { ok: false, code: 'upstream', status: r.status };
  const text = m.content.filter((b) => b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('');
  return { ok: true, text, truncated: m.stop_reason === 'max_tokens', usage: { in: m.usage?.input_tokens ?? 0, out: m.usage?.output_tokens ?? 0 } };
}
