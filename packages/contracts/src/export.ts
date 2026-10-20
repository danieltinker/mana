/**
 * The owner's menu as JSON (F08 "export, any time"): everything the owner built, as stored, with its ids, hidden
 * items and owner-only labels included. Not the records (activity, revisions, events) and nothing personal.
 * `export_menu(venue)`: owners, managers and Halom staff; each export is logged (`menu.export`, with the counts).
 */
import { isUuid, type Text, type Validation } from './common.ts';
import type {
  AddonGroupRow, AddonOptionRow, AssetRow, DishAddonGroupRow, DishRelationRow, DishRow, ScheduleRow, SectionRow, UpsellRuleRow, VenueClosureRow,
  VenueHoursRow,
} from './domain.ts';
import type { Lang } from './common.ts';
import type { SoldOutDisplay, VenueKind, VenueMode } from './enums.ts';
import { validateInput } from './rpc.ts';

export const MENU_EXPORT_VERSION = 1 as const;

/** An exported picture: its public files only (the owner's original upload stays in the private bucket). */
export type ExportAsset = Pick<AssetRow, 'id' | 'dish_id' | 'kind' | 'status' | 'relief_class' | 'color_path' | 'aux_path' | 'thumb_path'>;

/** The tables an export carries, in this order; each list is ordered by position (or by id where there is none). */
export const EXPORT_TABLES = [
  'schedules', 'sections', 'dishes', 'addon_groups', 'addon_options', 'dish_addon_groups', 'dish_relations', 'upsell_rules', 'venue_hours',
  'venue_closures', 'assets',
] as const;

export type MenuExport = {
  readonly v: typeof MENU_EXPORT_VERSION;
  readonly kind: 'mana.menu_export';
  readonly exportedAt: string;
  readonly venue: {
    readonly id: string;
    readonly slug: string;
    readonly name: Text;
    readonly kind: VenueKind;
    readonly mode: VenueMode;
    readonly timeZone: string;
    readonly defaultLang: Lang;
    readonly langs: readonly Lang[];
    readonly soldOutDisplay: SoldOutDisplay;
  };
  /** The live revision's number, or null when nothing is published. */
  readonly publishedRevision: number | null;
  /** Where the public picture paths below are served from (a URL ending in `/`). */
  readonly assetBase: string | null;
  readonly tables: {
    readonly schedules: readonly ScheduleRow[];
    readonly sections: readonly SectionRow[];
    readonly dishes: readonly DishRow[];
    readonly addon_groups: readonly AddonGroupRow[];
    readonly addon_options: readonly AddonOptionRow[];
    readonly dish_addon_groups: readonly DishAddonGroupRow[];
    readonly dish_relations: readonly DishRelationRow[];
    readonly upsell_rules: readonly UpsellRuleRow[];
    readonly venue_hours: readonly VenueHoursRow[];
    readonly venue_closures: readonly VenueClosureRow[];
    readonly assets: readonly ExportAsset[];
  };
};

export type ExportQuery = { readonly venueId: string };
export function validateExportQuery(raw: unknown): Validation<ExportQuery> {
  return validateInput<ExportQuery>(raw, ['venueId'], (x, o) => void (isUuid(o.venueId) || x.add('id_invalid', 'venueId')));
}
