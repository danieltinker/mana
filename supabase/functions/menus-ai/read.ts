/**
 * Reading one import (ADR-006): configured? → the import's source matches the mode → `claim_import_scan` with the
 * owner's token (membership, the daily cap; nothing paid before it) → the images, with the service role → one call
 * per printed page, or per run of screenshots → `readScanReply` / `scanDraft` (@mana/import) → `validateSaveDraft` →
 * `save_import_draft`. Any failure after the claim marks the import `failed` with a code of `SCAN_ERROR_CODES`, and
 * nothing else is written.
 */
import { LANGS, validateSaveDraft, type DraftCounts, type ImportException, type ScanErrorCode } from '@mana/contracts';
import { MODE_SOURCE, readScanReply, scanDraft, type PageReading, type ReaderNote, type ScanMode, type StockHint } from '@mana/import';
import { callModel, requestBody, sniffMedia, toBase64, type Image } from './anthropic.ts';
import type { Deps } from './deps.ts';
import { claim, download, importSource, markFailed, saveDraft } from './rest.ts';

/** The platform stops a worker at 150 s (v1's measure): close cleanly before that. */
export const SCAN_DEADLINE_MS = 138_000;
/** Screenshots read together in one call, so a dish sheet that runs over two of them reads as one. */
export const WOLT_BATCH = 5;
/** Calls in flight at once for one import. */
export const CONCURRENCY = 2;
/** One image's base64 at most: five of them stay under the API's 32 MB request (its per-image limit is 10 MB). */
export const MAX_IMAGE_B64 = 5_000_000;

export type ReadReply =
  | {
    readonly ok: true; readonly importId: string; readonly counts: DraftCounts; readonly exceptions: readonly ImportException[];
    readonly notes: readonly ReaderNote[]; readonly dropped: number; readonly calls: number; readonly usage: { readonly in: number; readonly out: number };
  }
  | { readonly ok: false; readonly code: string; readonly upstream?: number };

/**
 * The calls one import needs, as lists of image indexes: one per printed page; screenshots in runs of `WOLT_BATCH`,
 * each run after the first starting with the previous run's last screenshot (what one cuts, the next one shows whole;
 * the merge reads the overlap once).
 */
export function plan(mode: ScanMode, count: number): number[][] {
  const all = Array.from({ length: count }, (_, i) => i);
  if (mode === 'scan_menu') return all.map((i) => [i]);
  if (count <= WOLT_BATCH) return count ? [all] : [];
  const out: number[][] = [];
  for (let start = 0; start < count - 1; start += WOLT_BATCH - 1) out.push(all.slice(start, start + WOLT_BATCH));
  return out;
}

/** Runs `fn` over `items`, at most `n` at a time, keeping the order of the results. */
async function pool<T, R>(items: readonly T[], n: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => { for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]!, i); };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

const MODE_OF = { scan: 'scan_menu', wolt_screenshots: 'wolt_screenshots' } as const;

export async function readImport(d: Deps, asked: ScanMode, importId: string, auth: { apikey: string; authorization: string }, stock: readonly StockHint[]): Promise<ReadReply> {
  const t0 = d.now();
  const log: Record<string, unknown> = { fn: 'menus-ai', action: asked, import: importId, model: d.env.model };
  const done = (r: ReadReply): ReadReply => {
    d.log({ ...log, ok: r.ok, code: r.ok ? undefined : r.code, ms: d.now() - t0 });
    return r;
  };
  if (!d.env.anthropicKey || !d.env.serviceKey || !d.env.url) return done({ ok: false, code: 'not_configured' });
  const source = await importSource(d, importId);
  if (source !== null && source !== MODE_SOURCE[asked]) return done({ ok: false, code: 'source_mismatch' });

  const claimed = await claim(d, importId, auth);
  if (!claimed.ok) return done({ ok: false, code: claimed.code });
  if (!Array.isArray(claimed.paths) || !(claimed.source in MODE_OF)) return done({ ok: false, code: 'failed' });
  // the claim is the authority on what the import is, and on the venue's languages
  const mode: ScanMode = MODE_OF[claimed.source];
  const langs = Array.isArray(claimed.langs) && claimed.langs.length ? claimed.langs : LANGS;
  log.images = claimed.paths.length;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), Math.max(0, SCAN_DEADLINE_MS - (d.now() - t0)));
  const fail = async (code: ScanErrorCode, upstream?: number): Promise<ReadReply> => {
    await markFailed(d, importId, code);
    return done(upstream === undefined ? { ok: false, code } : { ok: false, code, upstream });
  };
  try {
    const images = await pool(claimed.paths, 4, async (path): Promise<Image | null> => {
      const bytes = await download(d, path, ac.signal);
      const mediaType = bytes ? sniffMedia(bytes) : null;
      if (!bytes || !mediaType) return null;
      const data = toBase64(bytes);
      return data.length > MAX_IMAGE_B64 ? null : { mediaType, data };
    });
    if (images.some((im) => im === null)) return await fail('image_unreadable');

    const calls = plan(mode, images.length);
    let tokensIn = 0, tokensOut = 0;
    const answers = await pool(calls, CONCURRENCY, async (batch, i) => {
      const body = requestBody(d.env.model, mode, batch.map((k) => images[k]!), langs, stock);
      const a = await callModel(d, body, ac.signal);
      if (!a.ok) return a;
      tokensIn += a.usage.in;
      tokensOut += a.usage.out;
      return { ok: true as const, page: readScanReply(a.text, { langs, stock, page: i + 1, truncated: a.truncated }) };
    });
    Object.assign(log, { calls: calls.length, in: tokensIn, out: tokensOut });
    const refused = answers.find((a) => !a.ok);
    if (refused && !refused.ok) {
      return await fail(refused.code === 'bad_image' || refused.code === 'too_big' ? 'image_unreadable' : 'model_failed', refused.status);
    }
    const pages = answers.map((a) => (a as { page: PageReading }).page);
    if (pages.every((p) => p.dishes === 0)) return await fail('image_unreadable');

    const read = scanDraft(mode, pages);
    const valid = validateSaveDraft({ importId, draft: read.draft });
    if (!valid.ok) {
      log.errors = valid.errors.slice(0, 20).map((e) => `${e.code}@${e.path}`);
      return await fail('draft_invalid');
    }
    const saved = await saveDraft(d, importId, read.draft);
    if (!saved.ok) {
      // the import moved on meanwhile (discarded, or claimed again after 10 minutes): leave it as it is
      if (saved.code === 'import_busy' || saved.code === 'import_closed' || saved.code === 'import_unknown') return done({ ok: false, code: saved.code });
      log.errors = saved.code;
      return await fail('draft_invalid');
    }
    return done({
      ok: true, importId, counts: saved.counts, exceptions: saved.exceptions, notes: read.notes, dropped: read.draft.dropped, calls: calls.length,
      usage: { in: tokensIn, out: tokensOut },
    });
  } catch (e) {
    log.thrown = String((e as Error)?.name ?? 'Error');
    return await fail(ac.signal.aborted ? 'timeout' : 'model_failed');
  } finally {
    clearTimeout(timer);
  }
}
