/**
 * The scanner's calls to its own Supabase project (PostgREST and Storage): with the caller's own token wherever the
 * caller is the one checked (`claim_import_scan`, and reading the images, where Storage's row-level security decides
 * what the caller may read), and with the service role only where the scanner alone may act (saving the draft,
 * marking a failure, the purge) (ADR-006, ADR-008).
 */
import type { ClaimScanReply, ImportDraft, ListPurgeableQuery, PurgeableImport, ReaderNote, SaveDraftReply, ScanErrorCode } from '@mana/contracts';
import type { Deps } from './deps.ts';

export const BUCKET = 'menu-private';

type Fail = { readonly ok: false; readonly code: string; readonly errors?: unknown };
export type Auth = { readonly apikey: string; readonly authorization: string };

const service = (d: Deps): Record<string, string> => ({ apikey: d.env.serviceKey, Authorization: `Bearer ${d.env.serviceKey}` });
const json = { 'Content-Type': 'application/json' };

async function answer<T>(r: Response): Promise<T | Fail> {
  if (r.status === 401 || r.status === 403) return { ok: false, code: 'not_allowed' };
  const body = await r.json().catch(() => null) as Record<string, unknown> | null;
  if (!r.ok) {
    // PostgREST: a raised SQLSTATE comes back as { code, message }; the RPCs raise their validator's code as the message
    const message = typeof body?.message === 'string' ? body.message : '';
    return { ok: false, code: body?.code === '42501' ? 'not_allowed' : /^[a-z_]{2,40}$/.test(message) ? message : 'failed' };
  }
  return (body ?? { ok: false, code: 'failed' }) as T | Fail;
}

/**
 * `claim_import_scan(p_import, p_mode)` as the caller: membership, the daily cap, the import's source against the
 * mode asked (`p_mode` = the source the mode reads: `scan` or `wolt_screenshots`), and `uploaded | failed → parsing`.
 * Nothing is read about the import before it (no service-role look-up).
 */
export async function claim(d: Deps, importId: string, source: string, auth: Auth): Promise<ClaimScanReply | Fail> {
  const r = await d.fetch(`${d.env.url}/rest/v1/rpc/claim_import_scan`, {
    method: 'POST', headers: { apikey: auth.apikey, Authorization: auth.authorization, ...json }, body: JSON.stringify({ p_import: importId, p_mode: source }),
  });
  return answer<ClaimScanReply>(r);
}

/** `save_import_draft(p_import, p_draft, p_notes)` as the service role (the import is `parsing`): the draft and the reader's notes. */
export async function saveDraft(d: Deps, importId: string, draft: ImportDraft, notes: readonly ReaderNote[], signal: AbortSignal): Promise<SaveDraftReply | Fail> {
  const r = await d.fetch(`${d.env.url}/rest/v1/rpc/save_import_draft`, {
    method: 'POST', headers: { ...service(d), ...json }, body: JSON.stringify({ p_import: importId, p_draft: draft, p_notes: notes }), signal,
  });
  return answer<SaveDraftReply>(r);
}

/**
 * Marks a claimed import `failed` with a code from the closed list, only while it is still `parsing` (a read that
 * the import moved on from changes nothing). true = the request went through; never throws.
 */
export async function markFailed(d: Deps, importId: string, code: ScanErrorCode): Promise<boolean> {
  try {
    const r = await d.fetch(`${d.env.url}/rest/v1/menu_imports?id=eq.${importId}&status=eq.parsing`, {
      method: 'PATCH', headers: { ...service(d), ...json, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'failed', error_code: code }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Reads a body up to `max` bytes; null when it is longer (the rest is not read: the stream is cancelled). */
export async function readCapped(body: ReadableStream<Uint8Array> | null, declared: string | null, max: number): Promise<Uint8Array | null> {
  if (declared !== null && declared !== '' && !(Number(declared) <= max)) { await body?.cancel().catch(() => undefined); return null; }
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel().catch(() => undefined); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}

/**
 * One private image, as bytes, read with the caller's own token through Storage's authenticated path, so the
 * bucket's row-level security decides (a member of the venue only). At most `maxBytes`: a larger file is refused
 * before it is read whole (by its declared length when there is one, else while it streams).
 */
export async function download(d: Deps, path: string, auth: Auth, maxBytes: number, signal: AbortSignal): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; code: 'missing' | 'too_big' }> {
  const r = await d.fetch(`${d.env.url}/storage/v1/object/authenticated/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, {
    headers: { apikey: auth.apikey, Authorization: auth.authorization }, signal,
  });
  if (!r.ok) { await r.body?.cancel().catch(() => undefined); return { ok: false, code: 'missing' }; }
  const bytes = await readCapped(r.body, r.headers.get('content-length'), maxBytes);
  return bytes ? { ok: true, bytes } : { ok: false, code: 'too_big' };
}

// ---------------------------------------------------------------- purge

const isPurgeRow = (x: unknown): x is PurgeableImport => {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  return typeof o.importId === 'string' && typeof o.venueId === 'string' && typeof o.status === 'string' && Array.isArray(o.paths) &&
    typeof o.finishedAt === 'string';
};

/**
 * `list_purgeable_imports(p_limit, p_after)` as the service role: one page of the image imports past the retention
 * period whose screenshots are not purged yet, with their venue, paths and `finishedAt`, oldest first; `after`, the
 * page after that row (`PurgeCursor`). The query is the contracts' (`validateListPurgeableQuery`). null: the call failed.
 */
export async function purgeable(d: Deps, query: ListPurgeableQuery): Promise<PurgeableImport[] | null> {
  const r = await d.fetch(`${d.env.url}/rest/v1/rpc/list_purgeable_imports`, {
    method: 'POST', headers: { ...service(d), ...json }, body: JSON.stringify({ p_limit: query.limit ?? null, p_after: query.after ?? null }),
  });
  if (!r.ok) { await r.body?.cancel().catch(() => undefined); return null; }
  const rows = await r.json().catch(() => null) as unknown;
  return Array.isArray(rows) ? rows.filter(isPurgeRow) : null;
}

/** The statuses `list_purgeable_imports` may name (never `parsing`, an import being read). */
export const PURGEABLE = ['applied', 'discarded', 'failed', 'uploaded', 'parsed'] as const;

/** Deletes files through the Storage API (deleting `storage.objects` rows would orphan the files). */
export async function removeFiles(d: Deps, paths: readonly string[]): Promise<boolean> {
  const r = await d.fetch(`${d.env.url}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: { ...service(d), ...json }, body: JSON.stringify({ prefixes: paths }) });
  return r.ok;
}

/**
 * Records the purge (no paths left, and when), only on a row not purged yet and not being read (ADR-008: the service
 * role may update `raw_paths` and `raw_purged_at`; the table's guard lets it through only for an import that may be
 * purged). true = exactly that row was updated.
 */
export async function markPurged(d: Deps, importId: string, at: string): Promise<boolean> {
  const r = await d.fetch(`${d.env.url}/rest/v1/menu_imports?id=eq.${importId}&raw_purged_at=is.null&status=in.(${PURGEABLE.join(',')})&select=id`, {
    method: 'PATCH', headers: { ...service(d), ...json, Prefer: 'return=representation' }, body: JSON.stringify({ raw_paths: [], raw_purged_at: at }),
  });
  if (!r.ok) return false;
  const rows = await r.json().catch(() => null) as unknown[] | null;
  return Array.isArray(rows) && rows.length === 1;
}
