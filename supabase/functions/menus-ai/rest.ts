/**
 * The scanner's calls to its own Supabase project (PostgREST and Storage), with the caller's token where the caller
 * is checked (`claim_import_scan`) and the service role where only the scanner may act (ADR-006, ADR-008).
 */
import type { ClaimScanReply, ImportDraft, SaveDraftReply, ScanErrorCode } from '@mana/contracts';
import type { Deps } from './deps.ts';

export const BUCKET = 'menu-private';

type Fail = { readonly ok: false; readonly code: string; readonly errors?: unknown };

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

/** The import's source, read before the claim so a wrong mode is refused before anything is counted. */
export async function importSource(d: Deps, importId: string): Promise<string | null> {
  const r = await d.fetch(`${d.env.url}/rest/v1/menu_imports?id=eq.${importId}&select=source`, { headers: service(d) });
  if (!r.ok) return null;
  const rows = await r.json().catch(() => []) as Array<{ source?: unknown }>;
  return typeof rows[0]?.source === 'string' ? rows[0].source : null;
}

/** `claim_import_scan(p_import)` as the caller: membership, the daily cap, and `uploaded | failed → parsing`. */
export async function claim(d: Deps, importId: string, auth: { apikey: string; authorization: string }): Promise<ClaimScanReply | Fail> {
  const r = await d.fetch(`${d.env.url}/rest/v1/rpc/claim_import_scan`, {
    method: 'POST', headers: { apikey: auth.apikey, Authorization: auth.authorization, ...json }, body: JSON.stringify({ p_import: importId }),
  });
  return answer<ClaimScanReply>(r);
}

/** `save_import_draft(p_import, p_draft)` as the service role (the import is `parsing`). */
export async function saveDraft(d: Deps, importId: string, draft: ImportDraft): Promise<SaveDraftReply | Fail> {
  const r = await d.fetch(`${d.env.url}/rest/v1/rpc/save_import_draft`, {
    method: 'POST', headers: { ...service(d), ...json }, body: JSON.stringify({ p_import: importId, p_draft: draft }),
  });
  return answer<SaveDraftReply>(r);
}

/** Marks a claimed import `failed` with a code from the closed list (only while it is still `parsing`). */
export async function markFailed(d: Deps, importId: string, code: ScanErrorCode): Promise<boolean> {
  const r = await d.fetch(`${d.env.url}/rest/v1/menu_imports?id=eq.${importId}&status=eq.parsing`, {
    method: 'PATCH', headers: { ...service(d), ...json, Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'failed', error_code: code }),
  });
  return r.ok;
}

/** One private image, as bytes (the service role reads `menu-private`). */
export async function download(d: Deps, path: string, signal: AbortSignal): Promise<Uint8Array | null> {
  const r = await d.fetch(`${d.env.url}/storage/v1/object/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`, { headers: service(d), signal });
  if (!r.ok) return null;
  return new Uint8Array(await r.arrayBuffer());
}

// ---------------------------------------------------------------- purge

export type PurgeRow = { readonly id: string; readonly raw_paths: readonly string[] };

/** `app_config.import_raw_retention_days` (ADR-008), 30 when it is not set. */
export async function retentionDays(d: Deps): Promise<number> {
  const r = await d.fetch(`${d.env.url}/rest/v1/app_config?key=eq.import_raw_retention_days&select=value`, { headers: service(d) });
  const rows = r.ok ? await r.json().catch(() => []) as Array<{ value?: unknown }> : [];
  const v = rows[0]?.value;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 30;
}

/** Imports whose images may go: applied, discarded or failed before `before`, images still there, not purged yet. */
export async function purgeable(d: Deps, before: string, importId: string | null, limit: number): Promise<PurgeRow[] | null> {
  const q = [
    'select=id,raw_paths', 'status=in.(applied,discarded,failed)', 'raw_purged_at=is.null', `raw_paths=neq.${encodeURIComponent('{}')}`,
    `updated_at=lt.${encodeURIComponent(before)}`, 'order=updated_at.asc', `limit=${limit}`, ...(importId ? [`id=eq.${importId}`] : []),
  ].join('&');
  const r = await d.fetch(`${d.env.url}/rest/v1/menu_imports?${q}`, { headers: service(d) });
  if (!r.ok) return null;
  return await r.json().catch(() => null) as PurgeRow[] | null;
}

/** Deletes files through the Storage API (deleting `storage.objects` rows would orphan the files). */
export async function removeFiles(d: Deps, paths: readonly string[]): Promise<boolean> {
  const r = await d.fetch(`${d.env.url}/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: { ...service(d), ...json }, body: JSON.stringify({ prefixes: paths }) });
  return r.ok;
}

/** Records the purge: no paths left, and when (ADR-008: the service role may update `raw_paths` and `raw_purged_at`). */
export async function markPurged(d: Deps, importId: string, at: string): Promise<boolean> {
  const r = await d.fetch(`${d.env.url}/rest/v1/menu_imports?id=eq.${importId}`, {
    method: 'PATCH', headers: { ...service(d), ...json, Prefer: 'return=minimal' }, body: JSON.stringify({ raw_paths: [], raw_purged_at: at }),
  });
  return r.ok;
}
