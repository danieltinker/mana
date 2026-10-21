// Small helpers over stored rows, shared by the data layer and the screens. Pure.
import { newUuid } from '@mana/contracts';

/**
 * A new row's id, made here rather than by the database: the same try sent again (after a lost answer) names the same
 * row, so it is never stored twice. The contracts' uuid (with its fallback where Safari and iOS before 15.4 have no
 * `crypto.randomUUID`).
 */
export const newId: () => string = newUuid;

/**
 * A value this screen sent and the value the database stored are the same: times come back with seconds ('07:00' is
 * '07:00:00'), text without blank ends, and a jsonb object with its keys in another order (Postgres orders them its own
 * way), at any depth.
 */
export function sameStored(sent: unknown, stored: unknown): boolean {
  if (typeof sent === 'string' && typeof stored === 'string') {
    if (/^\d\d:\d\d$/.test(sent) && /^\d\d:\d\d:\d\d$/.test(stored)) return stored.startsWith(sent + ':');
    return sent.trim() === stored.trim();
  }
  if (Array.isArray(sent) || Array.isArray(stored)) {
    return Array.isArray(sent) && Array.isArray(stored) && sent.length === stored.length && sent.every((x, i) => sameStored(x, stored[i]));
  }
  if (sent && stored && typeof sent === 'object' && typeof stored === 'object') {
    const a = sent as Record<string, unknown>, b = stored as Record<string, unknown>;
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((k) => sameStored(a[k] ?? null, b[k] ?? null));
  }
  return (sent ?? null) === (stored ?? null);
}

type Ordered = { readonly position: number; readonly created_at: string; readonly id: string };

/** The order the snapshot builder uses (app.build_snapshot_full): position, then creation, then id. */
export function byPosition<T extends Ordered>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.position - b.position || (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Rows without a position (the add-on library), oldest first, as the snapshot lists its groups. */
export function byCreated<T extends { readonly created_at: string; readonly id: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The position a new row takes at the end of its siblings. */
export const nextPosition = (rows: readonly { position: number }[]): number => rows.reduce((m, r) => Math.max(m, r.position), -1) + 1;

/**
 * Move the row at `from` to `to` among siblings (already in order) and return the positions to store (id → position):
 * the siblings are numbered 0, 1, 2… and only the rows whose stored position differs are written.
 */
export function reorder(rows: readonly { id: string; position: number }[], from: number, to: number): Map<string, number> {
  const out = new Map<string, number>();
  if (from < 0 || from >= rows.length) return out;
  const target = Math.max(0, Math.min(rows.length - 1, to));
  if (target === from) return out;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved!);
  next.forEach((r, i) => { if (r.position !== i) out.set(r.id, i); });
  return out;
}

/** An `updated_at` in microseconds since 1970 (the database keeps six fractional digits; Date keeps three), or null. */
function micros(stamp: string | null | undefined): number | null {
  const m = stamp ? /^(.+T\d\d:\d\d:\d\d)(?:\.(\d+))?(.*)$/.exec(stamp) : null;
  if (!m) return null;
  const ms = Date.parse(m[1] + (m[3] || 'Z'));
  return Number.isNaN(ms) ? null : ms * 1000 + Number(((m[2] ?? '') + '000000').slice(0, 6));
}

/** Two versions of a row (`updated_at`) in order, at full precision: negative, 0 or positive. Unknown counts as equal. */
export function stampOrder(a: string | null | undefined, b: string | null | undefined): number {
  const x = micros(a), y = micros(b);
  return x === null || y === null ? 0 : Math.sign(x - y);
}

/**
 * When a read was sent, and what this screen did to rows since: a clock that counts what it put on screen
 * (`since` is its value when the read was sent), when it last put each row on screen, when it deleted one.
 */
export type ReadClock = { readonly since: number; storedAt(id: string): number; droppedAt(id: string): number };

/**
 * A table's rows on screen after a read of the whole table answered, which may be late (a slow link): it never takes a
 * screen back to an older state of the database.
 * - a row read replaces the one on screen, unless the one on screen is a later version (its `updated_at`), or, for a
 *   row without a version (a dish's link to a group, "goes well with"), unless this screen stored it after the read was
 *   sent;
 * - a row read that this screen deleted after the read was sent does not come back;
 * - a row on screen the read does not have stays only when this screen put it there after the read was sent (a row it
 *   just added); otherwise it was deleted elsewhere and goes.
 * `taken` are the rows read that replaced or joined the screen's.
 */
export function rowsAfterRead<T extends { readonly id: string; readonly updated_at?: string }>(screen: readonly T[], read: readonly T[], clock: ReadClock): { rows: T[]; taken: T[] } {
  const on = new Map(screen.map((r) => [r.id, r] as const)), seen = new Set<string>();
  const rows: T[] = [], taken: T[] = [];
  for (const r of read) {
    seen.add(r.id);
    if (clock.droppedAt(r.id) > clock.since) continue;
    const mine = on.get(r.id);
    const versioned = !!(mine?.updated_at && r.updated_at);
    if (mine && (versioned ? stampOrder(mine.updated_at, r.updated_at) > 0 : clock.storedAt(r.id) > clock.since)) { rows.push(mine); continue; }
    rows.push(r); taken.push(r);
  }
  for (const r of screen) if (!seen.has(r.id) && clock.storedAt(r.id) > clock.since) rows.push(r);
  return { rows, taken };
}

/** A bilingual name in the language asked for, else the other one. */
export function named(row: { name_he: string; name_en: string } | null | undefined, lang: 'he' | 'en'): string {
  if (!row) return '';
  const first = lang === 'he' ? row.name_he : row.name_en;
  return first || (lang === 'he' ? row.name_en : row.name_he) || '';
}
