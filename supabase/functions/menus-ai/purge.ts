/**
 * The `purge` mode (ADR-006, ADR-008): an import's images in `menu-private` are deleted through the Storage API once
 * the import has been applied, discarded or failed for `app_config.import_raw_retention_days` (30 by default), and
 * the import records it (`raw_paths` emptied, `raw_purged_at` set). The text sources' `raw_text` is the database's
 * daily job. Called by a schedule with the service role key, never by a client.
 */
import type { Deps } from './deps.ts';
import { markPurged, purgeable, removeFiles, retentionDays } from './rest.ts';

/** Imports handled per call: a schedule calls again until nothing is left. */
export const PURGE_BATCH = 50;
const DAY_MS = 86_400_000;

export type PurgeReply = { readonly ok: true; readonly purged: number; readonly failed: readonly string[] } | { readonly ok: false; readonly code: string };

export async function purge(d: Deps, importId: string | null): Promise<PurgeReply> {
  const days = await retentionDays(d);
  const before = new Date(d.now() - days * DAY_MS).toISOString();
  const rows = await purgeable(d, before, importId, PURGE_BATCH);
  if (rows === null) return { ok: false, code: 'failed' };
  const at = new Date(d.now()).toISOString();
  let purged = 0;
  const failed: string[] = [];
  for (const row of rows) {
    if (await removeFiles(d, row.raw_paths) && await markPurged(d, row.id, at)) purged += 1;
    else failed.push(row.id);
  }
  d.log({ fn: 'menus-ai', action: 'purge', purged, failed: failed.length, retentionDays: days });
  return { ok: true, purged, failed };
}

/** Is this caller the service role? (Constant time, so the comparison says nothing about the key.) */
export function isServiceCaller(authorization: string, serviceKey: string): boolean {
  const given = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (serviceKey === '' || given.length !== serviceKey.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ serviceKey.charCodeAt(i);
  return diff === 0;
}
