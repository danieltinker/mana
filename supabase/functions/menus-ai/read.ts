/**
 * Reading one import (ADR-006): configured? → `claim_import_scan` with the owner's token and the mode (membership,
 * the daily cap, the import's source; nothing paid, nothing read before it) → the claim's paths checked (all under
 * `<venue>/imports/<import>/`, at most `IMPORT_IMAGES_MAX` of them) → the images, read with the owner's token (Storage's
 * row-level security) and at most `MAX_IMAGE_BYTES` each → one call per printed page, or per run of screenshots, at
 * most `CONCURRENCY` at once, all stopped at the first failure → `readScanReply` / `scanDraft` (@mana/import) →
 * `validateSaveDraft` → `save_import_draft` (the draft and the reader's notes). Any failure after the claim marks the import `failed` with a code of
 * `SCAN_ERROR_CODES` (a timeout too: an import is never left `parsing`), and nothing else is written.
 */
import { IMPORT_IMAGES_MAX, isUuid, LANGS, validateSaveDraft, type DraftCounts, type ImportException, type ScanErrorCode } from '@mana/contracts';
import { MODE_SOURCE, readScanReply, scanDraft, type PageReading, type ReaderNote, type ScanMode, type StockHint } from '@mana/import';
import { callModel, requestBody, sniffMedia, toBase64, type Image, type ModelAnswer } from './anthropic.ts';
import type { Deps } from './deps.ts';
import { claim, download, markFailed, saveDraft, type Auth } from './rest.ts';

/** The platform stops a worker at 150 s (v1's measure): close cleanly before that, with time left to mark the import. */
export const SCAN_DEADLINE_MS = 138_000;
/** Screenshots read together in one call, so a dish sheet that runs over two of them reads as one. */
export const WOLT_BATCH = 5;
/** Calls in flight at once for one import (and downloads). */
export const CONCURRENCY = 4;
/** One image's base64 at most: five of them stay under the API's 32 MB request (its per-image limit is 10 MB). */
export const MAX_IMAGE_B64 = 5_000_000;
/** The bytes of one image at most, checked before it is read whole: what makes `MAX_IMAGE_B64` of base64. */
export const MAX_IMAGE_BYTES = Math.floor((MAX_IMAGE_B64 * 3) / 4);

export type ReadReply =
  | {
    readonly ok: true; readonly importId: string; readonly counts: DraftCounts; readonly exceptions: readonly ImportException[];
    readonly notes: readonly ReaderNote[]; readonly dropped: number; readonly calls: number; readonly usage: { readonly in: number; readonly out: number };
  }
  /** `cap`: with `rate_limited`, the claim's cap that was reached (`scan_images_per_venue_day`, …). */
  | { readonly ok: false; readonly code: string; readonly upstream?: number; readonly cap?: string };

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

/**
 * Runs `fn` over `items`, at most `n` at a time, keeping the order of the results; once `signal` is aborted no new
 * item starts (an item not started is `undefined`). `fn` must not throw.
 */
export async function pool<T, R>(items: readonly T[], n: number, signal: AbortSignal, fn: (item: T, i: number) => Promise<R>): Promise<Array<R | undefined>> {
  const out = new Array<R | undefined>(items.length).fill(undefined);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < items.length && !signal.aborted; i = next++) out[i] = await fn(items[i]!, i);
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

const MODE_OF = { scan: 'scan_menu', wolt_screenshots: 'wolt_screenshots' } as const;
/** A file of the import's own folder: `<venue>/imports/<import>/<name>`, the name of letters, digits, ".", "_" and "-". */
const FILE_RE = /^[A-Za-z0-9._-]{1,100}$/;

/** Every path is exactly a file of this venue's folder for this import (nothing else is ever read). */
export function pathsOk(paths: unknown, venueId: string, importId: string): paths is string[] {
  if (!Array.isArray(paths) || !isUuid(venueId)) return false;
  const prefix = `${venueId.toLowerCase()}/imports/${importId}/`;
  return paths.every((p) => {
    if (typeof p !== 'string' || !p.startsWith(prefix)) return false;
    const name = p.slice(prefix.length);
    return FILE_RE.test(name) && name !== '.' && name !== '..';
  });
}

type Fetched = { readonly ok: true; readonly image: Image } | { readonly ok: false };
type Answered = { readonly ok: true; readonly page: PageReading; readonly usage: { in: number; out: number } } | (ModelAnswer & { readonly ok: false }) | { readonly ok: false; readonly code: 'aborted'; readonly status: 0 };

export async function readImport(d: Deps, asked: ScanMode, importId: string, auth: Auth, stock: readonly StockHint[]): Promise<ReadReply> {
  const t0 = d.now();
  const log: Record<string, unknown> = { fn: 'menus-ai', action: asked, import: importId, model: d.env.model };
  const done = (r: ReadReply): ReadReply => {
    d.log({ ...log, ok: r.ok, code: r.ok ? undefined : r.code, ms: d.now() - t0 });
    return r;
  };
  if (!d.env.anthropicKey || !d.env.serviceKey || !d.env.url) return done({ ok: false, code: 'not_configured' });

  const ac = new AbortController();
  let deadline = false;
  const timer = setTimeout(() => { deadline = true; ac.abort(); }, Math.max(0, SCAN_DEADLINE_MS - (d.now() - t0)));
  let claimed = false;
  /** After the claim, every failure marks the import (the result is logged: a mark that did not go through is said). */
  const fail = async (code: ScanErrorCode, reply: string = code, upstream?: number): Promise<ReadReply> => {
    log.marked = await markFailed(d, importId, code);
    return done(upstream === undefined ? { ok: false, code: reply } : { ok: false, code: reply, upstream });
  };
  try {
    const source = MODE_SOURCE[asked];
    // the claim is not cut by the deadline: it is quick, and its answer says whether the import is now this read's
    const c = await claim(d, importId, source, auth);
    if (!c.ok) {
      const cap = (c as { cap?: unknown }).cap;
      return done({ ok: false, code: c.code, ...(c.code === 'rate_limited' && typeof cap === 'string' && /^[a-z_]{1,40}$/.test(cap) ? { cap } : {}) });
    }
    claimed = true;
    // the claim is the authority on what the import is; the scanner still reads only what it asked for
    if (c.importId !== importId) return await fail('image_unreadable', 'paths_invalid');
    if (c.source !== source || !(c.source in MODE_OF)) return await fail('image_unreadable', 'source_mismatch');
    if (!pathsOk(c.paths, c.venueId, importId)) return await fail('image_unreadable', 'paths_invalid');
    const max = IMPORT_IMAGES_MAX[c.source];
    log.images = c.paths.length;
    if (c.paths.length === 0 || c.paths.length > max) return await fail('image_unreadable', c.paths.length ? 'too_many_images' : 'image_unreadable');
    const mode: ScanMode = MODE_OF[c.source];
    const langs = Array.isArray(c.langs) && c.langs.length ? c.langs : LANGS;

    const fetched = await pool(c.paths, CONCURRENCY, ac.signal, async (path): Promise<Fetched> => {
      try {
        const got = await download(d, path, auth, MAX_IMAGE_BYTES, ac.signal);
        const mediaType = got.ok ? sniffMedia(got.bytes) : null;
        if (!got.ok || !mediaType) { ac.abort(); return { ok: false }; }
        const data = toBase64(got.bytes);
        if (data.length > MAX_IMAGE_B64) { ac.abort(); return { ok: false }; }
        return { ok: true, image: { mediaType, data } };
      } catch {
        ac.abort();
        return { ok: false };
      }
    });
    if (deadline) return await fail('timeout');
    if (fetched.some((x) => !x?.ok)) return await fail('image_unreadable');
    const images = fetched.map((x) => (x as Extract<Fetched, { ok: true }>).image);

    const calls = plan(mode, images.length);
    let tokensIn = 0, tokensOut = 0;
    // the first refusal stops the rest: no call starts after it, and the ones in flight are cancelled
    const answers = await pool(calls, CONCURRENCY, ac.signal, async (batch, i): Promise<Answered> => {
      try {
        const a = await callModel(d, requestBody(d.env.model, mode, batch.map((k) => images[k]!), langs, stock), ac.signal);
        if (!a.ok) { ac.abort(); return a; }
        tokensIn += a.usage.in;
        tokensOut += a.usage.out;
        return { ok: true, page: readScanReply(a.text, { langs, stock, page: i + 1, truncated: a.truncated }), usage: a.usage };
      } catch {
        ac.abort();
        return { ok: false, code: 'aborted', status: 0 };
      }
    });
    Object.assign(log, { calls: answers.filter((a) => a !== undefined).length, in: tokensIn, out: tokensOut });
    if (deadline) return await fail('timeout');
    const refused = answers.find((a): a is Exclude<Answered, { ok: true }> => a !== undefined && !a.ok && a.code !== 'aborted')
      ?? answers.find((a): a is Exclude<Answered, { ok: true }> => a !== undefined && !a.ok);
    if (refused) {
      if (refused.code === 'aborted') return await fail('model_failed');
      return await fail(refused.code === 'bad_image' || refused.code === 'too_big' ? 'image_unreadable' : 'model_failed', undefined, refused.status);
    }
    if (answers.some((a) => a === undefined)) return await fail('model_failed');
    const pages = answers.map((a) => (a as Extract<Answered, { ok: true }>).page);
    if (pages.every((p) => p.dishes === 0)) return await fail('image_unreadable');

    const read = scanDraft(mode, pages);
    // the notes are stored with the draft (`menu_imports.notes`)
    const notes = read.notes;
    const valid = validateSaveDraft({ importId, draft: read.draft, notes });
    if (!valid.ok) {
      log.errors = valid.errors.slice(0, 20).map((e) => `${e.code}@${e.path}`);
      return await fail('draft_invalid');
    }
    const saved = await saveDraft(d, importId, read.draft, notes, ac.signal);
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
    if (!claimed) return done({ ok: false, code: deadline ? 'timeout' : 'failed' });
    return await fail(deadline ? 'timeout' : 'model_failed');
  } finally {
    clearTimeout(timer);
    // nothing of this read goes on after its answer
    ac.abort();
  }
}
