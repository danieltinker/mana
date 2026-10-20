/**
 * The `purge` mode (ADR-006, ADR-008): the images in `menu-private` of the imports `list_purgeable_imports` names are
 * deleted through the Storage API, and the import records it (`raw_paths` emptied, `raw_purged_at` set, only on a row
 * not purged and not being read; the table's guard refuses anything else). The text sources' `raw_text` is the
 * database's daily job. Called by a schedule with the service role key, never by a client.
 *
 * The retention holds whatever the list says: an import goes only once it finished (`applied_at`, else `updated_at`)
 * more than `app_config.import_raw_retention_days` ago (30 by default), as the daily job measures the pasted text. An
 * import the list names sooner is kept for a later run (`kept`).
 *
 * Only files of the import's own folder are deleted (`<venue_id>/imports/<id>/<name>`); a row with any other path is
 * left as it is and reported. The list comes oldest first and has no cursor: one call reads it again while a full page
 * purged something (what was purged leaves the list), at most `PURGE_PAGES` times, and says `more` when a next call
 * would find more.
 */
import { isUuid } from '@mana/contracts';
import type { Deps } from './deps.ts';
import { pathsOk } from './read.ts';
import { finishedAt, markPurged, purgeable, removeFiles, retentionDays } from './rest.ts';

/** Imports read per page (the most `list_purgeable_imports` gives), and pages per call. */
export const PURGE_BATCH = 500;
export const PURGE_PAGES = 4;
const DAY_MS = 86_400_000;

export type PurgeReply =
  | { readonly ok: true; readonly purged: number; readonly failed: readonly string[]; readonly kept: number; readonly more: boolean }
  | { readonly ok: false; readonly code: string };

export async function purge(d: Deps, importId: string | null): Promise<PurgeReply> {
  const days = await retentionDays(d);
  const before = d.now() - days * DAY_MS;
  const at = new Date(d.now()).toISOString();
  let purged = 0, refused = 0, more = false;
  const failed = new Set<string>(), kept = new Set<string>();
  for (let page = 0; page < PURGE_PAGES; page++) {
    const listed = await purgeable(d, PURGE_BATCH);
    const rows = listed?.filter((r) => importId === null || r.importId === importId) ?? null;
    const ages = rows === null ? null : await finishedAt(d, rows.map((r) => r.importId).filter((id) => isUuid(id)));
    if (listed === null || rows === null || ages === null) {
      if (page === 0) return { ok: false, code: 'failed' };
      more = true;
      break;
    }
    let progress = 0;
    for (const row of rows) {
      if (failed.has(row.importId)) continue;
      if (!isUuid(row.importId) || !pathsOk(row.paths, row.venueId, row.importId)) { refused += 1; failed.add(row.importId); continue; }
      // the retention, whatever the list says: finished long enough ago, or kept for a later run
      const finished = ages.get(row.importId);
      if (finished === undefined || !(finished < before)) { kept.add(row.importId); continue; }
      if (await removeFiles(d, row.paths) && await markPurged(d, row.importId, at)) { purged += 1; progress += 1; }
      else failed.add(row.importId);
    }
    // what was purged left the list: a full page that purged something may have more behind it
    more = listed.length === PURGE_BATCH && progress > 0;
    if (!more || importId !== null) break;
  }
  d.log({ fn: 'menus-ai', action: 'purge', purged, failed: failed.size, refused, kept: kept.size, retentionDays: days, more });
  return { ok: true, purged, failed: [...failed], kept: kept.size, more };
}

/** Is this caller the service role? (Constant time, so the comparison says nothing about the key.) */
export function isServiceCaller(authorization: string, serviceKey: string): boolean {
  const given = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (serviceKey === '' || given.length !== serviceKey.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ serviceKey.charCodeAt(i);
  return diff === 0;
}
