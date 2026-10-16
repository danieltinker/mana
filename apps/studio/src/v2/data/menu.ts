// The clean schema, table by table, as the owner app uses it: direct table access under row-level security (as
// sim/src/owner.mjs does) and the RPCs. Stateless: every function returns what the database stored; data/store.ts keeps
// it in memory. Rows are typed with @mana/contracts.
import type {
  AddonGroupRow, AddonOptionRow, DishAddonGroupRow, DishRelationRow, DishRow, EntitlementRow, Issue, MemberRole, MenuRevisionRow,
  PublishWarning, ScheduleRow, SectionRow, SnapshotV2, VenueKind, VenueRow,
} from '@mana/contracts';
import { q, rpc, sb } from './client.ts';
import { V2Error } from './errors.ts';
import { changed, type GroupWrite } from './forms.ts';

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
export function updateRow<T>(table: MenuTable, id: string, patch: object): Promise<T> {
  return q<T>(sb.from(table).update(patch).eq('id', id).select().single());
}
export async function deleteRows(table: MenuTable, ids: readonly string[]): Promise<void> {
  if (!ids.length) return;
  const gone = await q<{ id: string }[]>(sb.from(table).delete().in('id', ids as string[]).select('id'));
  if (gone.length !== ids.length) throw new V2Error('not_found');                       // RLS hides what it refuses
}
/** New positions after a move (data/rows.ts reorder): one small write per row that moved. */
export async function setPositions(table: MenuTable, positions: ReadonlyMap<string, number>): Promise<void> {
  await Promise.all([...positions].map(([id, position]) => updateRow(table, id, { position })));
}

/**
 * A group and its options, as the form left them: the group row first, then the options that went away, the ones that
 * changed, and the new ones. Returns what is stored now.
 */
export async function saveGroup(venueId: string, groupId: string | null, write: GroupWrite, before: readonly AddonOptionRow[]): Promise<{ group: AddonGroupRow; options: AddonOptionRow[] }> {
  const group = groupId
    ? await updateRow<AddonGroupRow>('addon_groups', groupId, write.group)
    : (await insertRows<AddonGroupRow>('addon_groups', [{ venue_id: venueId, ...write.group }]))[0]!;
  const mine = before.filter((o) => o.group_id === group.id);
  const kept = new Set(write.options.map((o) => o.id).filter(Boolean));
  await deleteRows('addon_options', mine.filter((o) => !kept.has(o.id)).map((o) => o.id));
  for (const o of write.options) {
    if (!o.id) continue;
    const old = mine.find((x) => x.id === o.id);
    const { id, ...cols } = o;
    const patch = old ? changed(old, cols) : cols;
    if (Object.keys(patch).length) await updateRow('addon_options', id, patch);
  }
  const fresh = write.options.filter((o) => !o.id).map(({ id: _new, ...cols }) => ({ venue_id: venueId, group_id: group.id, ...cols }));
  if (fresh.length) await insertRows('addon_options', fresh);
  const options = await q<AddonOptionRow[]>(sb.from('addon_options').select('*').eq('group_id', group.id));
  return { group, options };
}

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
