// The clean schema, table by table, as the owner app uses it: direct table access under row-level security (as
// sim/src/owner.mjs does) and the RPCs. Stateless: every function returns what the database stored; data/store.ts keeps
// it in memory. Rows are typed with @mana/contracts.
import type {
  AddonGroupRow, AddonOptionRow, DishAddonGroupRow, DishRelationRow, DishRow, EntitlementRow, Issue, MemberRole, MenuRevisionRow,
  PublishWarning, ScheduleRow, SectionRow, SnapshotV2, VenueKind, VenueRow,
} from '@mana/contracts';
import { q, rpc, sb } from './client.ts';
import { toV2Error, V2Error } from './errors.ts';

export type Membership = { readonly venue: VenueRow; readonly role: MemberRole };
export type RevisionInfo = Pick<MenuRevisionRow, 'id' | 'number' | 'note' | 'created_at'>;
export type MenuData = {
  venue: VenueRow;
  role: MemberRole;
  /** null when this account may not read it (a counter). */
  entitlement: EntitlementRow | null;
  sections: SectionRow[];
  dishes: DishRow[];
  groups: AddonGroupRow[];
  options: AddonOptionRow[];
  dishGroups: DishAddonGroupRow[];
  relations: DishRelationRow[];
  schedules: ScheduleRow[];
  revisions: RevisionInfo[];
};

/** The tables the menu editor writes (all under RLS: owner and manager). */
export type MenuTable = 'sections' | 'dishes' | 'addon_groups' | 'addon_options' | 'dish_addon_groups' | 'dish_relations';

// ---------------------------------------------------------------- venues
/** The places this account belongs to, oldest first, with its role in each. */
export async function myVenues(userId: string): Promise<Membership[]> {
  const rows = await q<{ role: MemberRole; venue: VenueRow | null }[]>(sb.from('venue_members').select('role, venue:venues(*)').eq('user_id', userId));
  return rows.filter((r) => r.venue && !r.venue.archived_at).map((r) => ({ venue: r.venue!, role: r.role }))
    .sort((a, b) => (a.venue.created_at < b.venue.created_at ? -1 : 1));
}

export const slugAvailable = (slug: string) => q<boolean>(sb.rpc('slug_available', { p_slug: slug }));

export function createVenue(v: { slug: string; nameHe: string; nameEn: string; kind: VenueKind; defaultLang: 'he' | 'en' }) {
  return rpc<{ ok: true; id: string; slug: string }>('create_venue', { p_slug: v.slug, p_name_he: v.nameHe, p_name_en: v.nameEn, p_kind: v.kind, p_default_lang: v.defaultLang });
}

export const venueRow = (id: string) => q<VenueRow>(sb.from('venues').select('*').eq('id', id).single());
export const entitlementOf = (venueId: string) => q<EntitlementRow | null>(sb.from('entitlements').select('*').eq('venue_id', venueId).maybeSingle());
export const revisionsOf = (venueId: string) =>
  q<RevisionInfo[]>(sb.from('menu_revisions').select('id, number, note, created_at').eq('venue_id', venueId).order('number', { ascending: false }).limit(50));

// ---------------------------------------------------------------- the whole menu of one venue
export async function loadMenu(venueId: string, role: MemberRole): Promise<MenuData> {
  const of = <T>(table: string) => q<T[]>(sb.from(table).select('*').eq('venue_id', venueId));
  const records = role === 'owner' || role === 'manager';
  const [venue, entitlement, sections, dishes, groups, options, dishGroups, relations, schedules, revisions] = await Promise.all([
    venueRow(venueId),
    records ? entitlementOf(venueId) : Promise.resolve(null),
    of<SectionRow>('sections'), of<DishRow>('dishes'), of<AddonGroupRow>('addon_groups'), of<AddonOptionRow>('addon_options'),
    of<DishAddonGroupRow>('dish_addon_groups'), of<DishRelationRow>('dish_relations'), of<ScheduleRow>('schedules'),
    records ? revisionsOf(venueId) : Promise.resolve([] as RevisionInfo[]),
  ]);
  return { venue, role, entitlement, sections, dishes, groups, options, dishGroups, relations, schedules, revisions };
}

// ---------------------------------------------------------------- rows
export function rowsById<T>(table: MenuTable, ids: readonly string[]): Promise<T[]> {
  return q<T[]>(sb.from(table).select('*').in('id', ids as string[]));
}
export function insertRows<T>(table: MenuTable, rows: object[]): Promise<T[]> {
  return q<T[]>(sb.from(table).insert(rows).select());
}
/**
 * One new row with the client's own id: when the answer to an earlier try was lost and the row is already stored, the
 * same id answers with that row instead of adding a second one.
 */
export async function insertOnce<T extends { id: string }>(table: MenuTable, row: { id: string; [column: string]: unknown }): Promise<T> {
  try {
    return (await insertRows<T>(table, [row]))[0]!;
  } catch (e) {
    const err = toV2Error(e);
    if (err.code === 'duplicate') { const [had] = await rowsById<T>(table, [row.id]); if (had) return had; }
    throw err;
  }
}

/** A value a guarded write expects the stored row to still hold. */
export type Expected = Readonly<Record<string, string | number | boolean | null>>;
/** What a guarded write did: stored (with the row as it is now), or why not. */
export type Guarded<T> =
  | { readonly ok: true; readonly row: T }
  | { readonly ok: false; readonly why: 'stale'; readonly row: T }        // the row changed since it was read: here it is now
  | { readonly ok: false; readonly why: 'forbidden' | 'gone' };

/**
 * Change one row only while it still holds `expected` (its `updated_at` as last read, or the values a move started
 * from). Zero rows back means it did not: the row read again tells why (gone, changed meanwhile, or row-level security
 * said no).
 */
export async function updateIf<T extends { id: string }>(table: MenuTable, id: string, expected: Expected, patch: object): Promise<Guarded<T>> {
  let query = sb.from(table).update(patch).eq('id', id);
  for (const [k, v] of Object.entries(expected)) query = v === null ? query.is(k, null) : query.eq(k, v);
  const rows = await q<T[]>(query.select());
  if (rows.length) return { ok: true, row: rows[0]! };
  const [now] = await rowsById<T>(table, [id]);
  if (!now) return { ok: false, why: 'gone' };
  const same = Object.entries(expected).every(([k, v]) => (now as Record<string, unknown>)[k] === v);
  return same ? { ok: false, why: 'forbidden' } : { ok: false, why: 'stale', row: now };
}

export async function deleteRows(table: MenuTable, ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  const gone = await q<{ id: string }[]>(sb.from(table).delete().in('id', ids as string[]).select('id'));
  if (gone.length === ids.length) return;
  // row-level security hides what it refuses: still there means not allowed, not there means already deleted
  const left = await rowsById<{ id: string }>(table, ids);
  throw new V2Error(left.length ? 'forbidden' : 'not_found');
}

// ---------------------------------------------------------------- an add-on group and its options, as one (save_addon_group)
/** A group's whole state as the owner left it; the ids are the client's own (new rows included), so a retry is safe. */
export type SaveGroupInput = {
  readonly venueId: string;
  readonly group: Pick<AddonGroupRow, 'id' | 'label' | 'name_he' | 'name_en' | 'selection' | 'min_units' | 'max_units'>;
  readonly options: readonly Pick<AddonOptionRow, 'id' | 'position' | 'name_he' | 'name_en' | 'price' | 'max_qty' | 'is_default' | 'opens_group_id'>[];
};
export type GroupRows = { readonly group: AddonGroupRow; readonly options: AddonOptionRow[] };
export type SaveGroupAnswer =
  | ({ readonly ok: true } & GroupRows)
  | { readonly ok: false; readonly code: string; readonly path?: string; readonly current?: GroupRows; readonly rules?: string[] };

/**
 * One transaction: the group, its options added, changed and deleted. `expected` is the group's `updated_at` as last
 * read (null for a new group); `stale` comes back with the stored group when it moved since. Deleting options that
 * suggestion rules use answers `option_in_rules` until `confirmRules` is true. The answer comes back as it is.
 */
export const saveAddonGroup = (input: SaveGroupInput, expected: string | null, confirmRules: boolean) =>
  q<SaveGroupAnswer>(sb.rpc('save_addon_group', {
    p_venue: input.venueId, p_group: input.group, p_options: input.options, p_expected_updated_at: expected, p_confirm_rule_removal: confirmRules,
  }));

/** The suggestion rules an answer names, with what the owner calls them. */
export const rulesNamed = (ids: readonly string[]) =>
  q<{ id: string; label: string; line_he: string; line_en: string }[]>(sb.from('upsell_rules').select('id, label, line_he, line_en').in('id', ids as string[]));

// ---------------------------------------------------------------- drafts, publishing, versions
export type Preview = { snapshot: SnapshotV2; issues: Issue[]; warnings: PublishWarning[] };
export type PublishResult = { ok: true; revision: number; slug: string; path: string; review: 'pending' | 'approved'; warnings: PublishWarning[] };

/** The snapshot as publishing would build it now, what would stop the publish, and what would only warn. */
export const previewMenu = (venueId: string) => q<Preview>(sb.rpc('preview_menu', { p_venue: venueId }));
export const publishMenu = (venueId: string, note: string | null) => rpc<PublishResult>('publish_menu', { p_venue: venueId, p_note: note });
export const restoreRevision = (venueId: string, n: number) =>
  rpc<{ ok: true; revision: number; review: 'not_requested' | 'pending' | 'approved' }>('restore_revision', { p_venue: venueId, p_revision: n });
export const unpublishMenu = (venueId: string) => rpc<{ ok: true }>('unpublish_menu', { p_venue: venueId });
export const revisionSnapshot = async (id: string) =>
  (await q<{ snapshot: SnapshotV2 }>(sb.from('menu_revisions').select('snapshot').eq('id', id).single())).snapshot;
