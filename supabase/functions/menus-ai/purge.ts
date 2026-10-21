/**
 * The `purge` mode (ADR-006, ADR-008): the images in `menu-private` of the imports `list_purgeable_imports` names are
 * deleted through the Storage API, and the import records it (`raw_paths` emptied, `raw_purged_at` set, only on a row
 * not purged and not being read; the table's guard refuses anything else). The text sources' `raw_text` is the
 * database's daily job. Called by a schedule with the service role key, never by a client.
 *
 * The list is the database's rule, retention included (finished, or left waiting, longer ago than
 * `import_raw_retention_days`), oldest first. Only files of the import's own folder are deleted
 * (`<venue_id>/imports/<id>/<name>`), and only of an import in a status that may be purged (`PURGEABLE`, never
 * `parsing`); any other row is left as it is and reported.
 *
 * The pages are walked with the list's cursor (the last row's `{finishedAt, importId}`, as it came), so rows that keep
 * failing never hold back the rows after them. One call reads at most `PURGE_PAGES` pages and stops after
 * `PURGE_TIME_MS`; it answers `next`, the cursor to pass back as `after`, while rows may remain.
 */
import { isUuid, validateListPurgeableQuery, type PurgeCursor } from '@mana/contracts';
import type { Deps } from './deps.ts';
import { pathsOk } from './read.ts';
import { markPurged, purgeable, PURGEABLE, removeFiles } from './rest.ts';

/** Rows per page, pages per call, and the time one call works before it answers (the platform stops at 150 s). */
export const PURGE_BATCH = 100;
export const PURGE_PAGES = 20;
export const PURGE_TIME_MS = 100_000;

export type PurgeReply =
  | { readonly ok: true; readonly purged: number; readonly failed: readonly string[]; readonly next: PurgeCursor | null }
  | { readonly ok: false; readonly code: string };

export async function purge(d: Deps, importId: string | null, after: PurgeCursor | null = null): Promise<PurgeReply> {
  const t0 = d.now();
  const at = new Date(t0).toISOString();
  let purged = 0, refused = 0, pages = 0, handled = 0, stop: string | null = null;
  const failed: string[] = [];
  let cursor = after, next: PurgeCursor | null = null;
  for (;;) {
    const query = { limit: PURGE_BATCH, after: cursor };
    // the cursor is the list's own last row: one the contracts refuse ends the walk (the log says so)
    if (!validateListPurgeableQuery(query).ok) { stop = 'cursor_invalid'; break; }
    const rows = await purgeable(d, query);
    if (rows === null) {
      if (pages === 0) return { ok: false, code: 'failed' };
      next = cursor;
      stop = 'list_failed';
      break;
    }
    pages += 1;
    let late = false;
    for (const row of rows) {
      if (handled > 0 && d.now() - t0 > PURGE_TIME_MS) { late = true; break; }
      handled += 1;
      cursor = { finishedAt: row.finishedAt, importId: row.importId };
      if (importId !== null && row.importId !== importId) continue;
      // never an import being read (or any status the list should not name), never a path outside its own folder
      if (!(PURGEABLE as readonly string[]).includes(row.status) || !isUuid(row.importId) || !pathsOk(row.paths, row.venueId, row.importId)) {
        refused += 1;
        failed.push(row.importId);
        continue;
      }
      if (await removeFiles(d, row.paths) && await markPurged(d, row.importId, at)) purged += 1;
      else failed.push(row.importId);
    }
    if (late) { next = cursor; stop = 'time'; break; }
    if (rows.length < PURGE_BATCH) break;
    if (pages >= PURGE_PAGES) { next = cursor; stop = 'pages'; break; }
  }
  d.log({ fn: 'menus-ai', action: 'purge', purged, failed: failed.length, refused, pages, stop, more: next !== null });
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
