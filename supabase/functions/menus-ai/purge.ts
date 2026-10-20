/**
 * The `purge` mode (ADR-006, ADR-008): an import's images in `menu-private` are deleted through the Storage API once
 * the import has been applied, discarded or failed for `app_config.import_raw_retention_days` (30 by default), and
 * the import records it (`raw_paths` emptied, `raw_purged_at` set, only on a row still closed and not purged). The
 * text sources' `raw_text` is the database's daily job. Called by a schedule with the service role key, never by a
 * client.
 *
 * Only files of the import's own folder are deleted (`<venue_id>/imports/<id>/<name>`); a row with any other path is
 * left as it is and reported. Rows are read in id order (keyset paging), so rows that keep failing never hold back
 * the others: one call reads up to `PURGE_PAGES` pages, and answers `next` (pass it back as `after`) when more remain.
 */
import type { Deps } from './deps.ts';
import { pathsOk } from './read.ts';
import { markPurged, purgeable, removeFiles, retentionDays } from './rest.ts';

/** Imports read per page, and pages per call. */
export const PURGE_BATCH = 50;
export const PURGE_PAGES = 20;
const DAY_MS = 86_400_000;

export type PurgeReply =
  | { readonly ok: true; readonly purged: number; readonly failed: readonly string[]; readonly next: string | null }
  | { readonly ok: false; readonly code: string };

export async function purge(d: Deps, importId: string | null, after: string | null = null): Promise<PurgeReply> {
  const days = await retentionDays(d);
  const before = new Date(d.now() - days * DAY_MS).toISOString();
  const at = new Date(d.now()).toISOString();
  let purged = 0, refused = 0;
  const failed: string[] = [];
  let cursor = after, next: string | null = null;
  for (let page = 0; page < PURGE_PAGES; page++) {
    const rows = await purgeable(d, before, importId, cursor, PURGE_BATCH);
    if (rows === null) {
      if (page === 0) return { ok: false, code: 'failed' };
      next = cursor;
      break;
    }
    for (const row of rows) {
      if (!pathsOk(row.raw_paths, row.venue_id, row.id)) { refused += 1; failed.push(row.id); continue; }
      if (await removeFiles(d, row.raw_paths) && await markPurged(d, row.id, at)) purged += 1;
      else failed.push(row.id);
    }
    if (rows.length < PURGE_BATCH) { next = null; break; }
    cursor = rows[rows.length - 1]!.id;
    next = cursor;
  }
  d.log({ fn: 'menus-ai', action: 'purge', purged, failed: failed.length, refused, retentionDays: days, more: next !== null });
  return { ok: true, purged, failed, next };
}

/** Is this caller the service role? (Constant time, so the comparison says nothing about the key.) */
export function isServiceCaller(authorization: string, serviceKey: string): boolean {
  const given = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (serviceKey === '' || given.length !== serviceKey.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ serviceKey.charCodeAt(i);
  return diff === 0;
}
