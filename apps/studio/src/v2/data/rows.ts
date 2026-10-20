// Small helpers over stored rows, shared by the data layer and the screens. Pure.
import { newUuid } from '@mana/contracts';

/**
 * A new row's id, made here rather than by the database: the same try sent again (after a lost answer) names the same
 * row, so it is never stored twice. The contracts' uuid (with its fallback where Safari and iOS before 15.4 have no
 * `crypto.randomUUID`).
 */
export const newId: () => string = newUuid;

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

/** A bilingual name in the language asked for, else the other one. */
export function named(row: { name_he: string; name_en: string } | null | undefined, lang: 'he' | 'en'): string {
  if (!row) return '';
  const first = lang === 'he' ? row.name_he : row.name_en;
  return first || (lang === 'he' ? row.name_en : row.name_he) || '';
}
