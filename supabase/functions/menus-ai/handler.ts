/**
 * Mana's scanner, v2 (ADR-006), for the clean schema (`mana`); the v1 copy in `functions/menus-ai` stays as it is for
 * production. Every request is JSON:
 *
 *   { action: "status" }                                          → { ok, configured }
 *   { action: "scan_menu" | "wolt_screenshots", import_id, stock? } → { ok, importId, counts, exceptions, notes, dropped, calls, usage }
 *                                                                    | { ok: false, code }
 *   { action: "purge", import_id? }  (service role only)           → { ok, purged, failed } | { ok: false, code }
 *
 * The read modes run with the owner's own token (the claim checks it) and read images the owner already uploaded to
 * `menu-private`; the request carries no image. No code here fetches a Wolt address (D33).
 * stock = [{ id, label }]: the placeholder pictures the owner app has; the model may propose one per dish.
 */
import { isUuid } from '@mana/contracts';
import { SCAN_MODES, type ScanMode, type StockHint } from '@mana/import';
import type { Deps } from './deps.ts';
import { isServiceCaller, purge } from './purge.ts';
import { readImport } from './read.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
/** The request is a few ids and a stock list; anything bigger is not ours. */
const MAX_BODY = 64_000;

/** The owner app's stock list, cleaned as v1 does: ids as stock ids, labels as short plain words. */
export function cleanStock(v: unknown): StockHint[] {
  if (!Array.isArray(v)) return [];
  const out: StockHint[] = [];
  for (const s of v.slice(0, 160)) {
    const o = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim() : '';
    const label = typeof o.label === 'string' ? o.label.replace(/[,;()\s]+/g, ' ').trim().slice(0, 60) : '';
    if (/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) out.push({ id, label });
  }
  return out;
}

export async function handle(req: Request, d: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, code: 'method' }, 405);
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return json({ ok: false, code: 'too_big' }, 413);
  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ ok: false, code: 'too_big' }, 413);
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, code: 'bad_request' }, 400);
  }
  const action = String(body.action ?? '');
  const authorization = req.headers.get('Authorization') ?? '';

  if (action === 'status') return json({ ok: true, configured: d.env.anthropicKey !== '' });

  if (action === 'purge') {
    if (!isServiceCaller(authorization, d.env.serviceKey)) return json({ ok: false, code: 'not_allowed' }, 403);
    const id = body.import_id ?? null;
    if (id !== null && !isUuid(id)) return json({ ok: false, code: 'bad_request' }, 400);
    return json(await purge(d, id === null ? null : id.toLowerCase()));
  }

  if (!(SCAN_MODES as readonly string[]).includes(action)) return json({ ok: false, code: 'bad_request' }, 400);
  if (!isUuid(body.import_id)) return json({ ok: false, code: 'bad_request' }, 400);
  if (!authorization) return json({ ok: false, code: 'not_allowed' }, 401);
  const work = readImport(d, action as ScanMode, body.import_id.toLowerCase(), { apikey: req.headers.get('apikey') || d.env.anonKey, authorization }, cleanStock(body.stock));
  // the read goes on (and marks the import) even if the owner's phone leaves
  d.waitUntil?.(work);
  return json(await work);
}
