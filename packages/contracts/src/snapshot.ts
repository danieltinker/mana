/**
 * The published menu snapshot, version 2: everything the guest menu needs, so it never reads the editor's tables.
 *
 * - Built by the database at publish time (`publish_menu` → `app.build_snapshot`) and stored in `menu_revisions`.
 * - Immutable once published. What changes live (sold out now, back at 14:30) comes beside it as the live overlay
 *   (`live.ts`), never inside it.
 * - Readers MUST ignore fields they do not know; writers add fields only in a backward-compatible way. A change that
 *   would break a reader is a new version (`v: 3`).
 * - Money is integer agorot, VAT included (`pricing.vatBasisPoints` says how much of it is VAT).
 * - Asset fields are paths relative to `assetBase` (a URL ending in `/`); `public_menu` sets `assetBase` to the
 *   current public storage address, so a change of host needs no republish.
 */
import type { Lang, Text } from './common.ts';
import type {
  ReliefClass, Room, Scene, ScopeKind, SectionKind, SelectionKind, SoldOutDisplay, Tag, Trigger, VenueKind, VenueMode,
  ScheduleKind,
} from './enums.ts';
import type { HHMM, LocalDate, TimeWindow, Weekday } from './time.ts';

export const SNAPSHOT_VERSION = 2 as const;

export type AssetV2 =
  | {
      readonly state: 'relief';
      readonly color: string;
      readonly aux: string;
      readonly thumb: string;
      readonly kind: ReliefClass;
      readonly e: number;
      readonly h: number;
      readonly o: readonly [number, number] | null;
      readonly s: number | null;
    }
  | { readonly state: 'photo'; readonly color: string; readonly thumb: string }
  /** A placeholder from the stock library: shown as an illustration, labelled as one. */
  | { readonly state: 'stock'; readonly id: string };

export type PriceV2 = { readonly amount: number; readonly note: Text };

/** A group attached to a dish, with the dish's effective limits (the dish may tighten the group's own). */
export type DishAddonV2 = { readonly groupId: string; readonly min: number; readonly max: number };

export type DishV2 = {
  readonly id: string;
  readonly name: Text;
  readonly desc: Text;
  /** null = no price shown (and not orderable). */
  readonly price: PriceV2 | null;
  readonly tags: readonly Tag[];
  /** The owner's own words; never generated. */
  readonly allergens: Text;
  /** Wine and beer details as in CONTRACT.md (free shape, ≤ 6 kB). */
  readonly details: Readonly<Record<string, unknown>>;
  readonly asset: AssetV2 | null;
  readonly scheduleId: string | null;
  readonly addons: readonly DishAddonV2[];
  /** "Goes well with": other dishes of this menu, in the owner's order. */
  readonly related: readonly string[];
};

export type SectionV2 = {
  readonly id: string;
  readonly name: Text;
  readonly kind: SectionKind;
  readonly scene: Scene;
  readonly room: Room | null;
  readonly scheduleId: string | null;
  readonly dishes: readonly DishV2[];
};

export type AddonOptionV2 = {
  readonly id: string;
  readonly name: Text;
  /** Agorot added per unit; 0 for free choices and removals. */
  readonly price: number;
  /** How many of this option one dish may carry ("double cheese" = 2). 1 when the option opens a group. */
  readonly maxQty: number;
  /** Pre-selected in the guest's sheet (the owner's default, never an upsell). */
  readonly default: boolean;
  /** The one nesting level: choosing this option opens that group. The opened group's options open nothing. */
  readonly opensGroupId: string | null;
};

/**
 * A reusable add-on group. `min`/`max` count units (the sum of quantities) across the group's options;
 * `min >= 1` makes it required. `single` groups have `max = 1`.
 */
export type AddonGroupV2 = {
  readonly id: string;
  readonly name: Text;
  readonly selection: SelectionKind;
  readonly min: number;
  readonly max: number;
  readonly options: readonly AddonOptionV2[];
};

export type ScheduleV2 = {
  readonly id: string;
  readonly kind: ScheduleKind;
  readonly name: Text;
  readonly windows: readonly TimeWindow[];
  readonly validFrom: LocalDate | null;
  readonly validTo: LocalDate | null;
};

export type IdMatch = { readonly dishes: readonly string[]; readonly sections: readonly string[] };

export type UpsellSuggestion =
  | { readonly kind: 'dish'; readonly dishId: string }
  /** An add-on of the dish in context (sheet or add triggers only). */
  | { readonly kind: 'option'; readonly groupId: string; readonly optionId: string };

export type RuleScope = { readonly kind: 'all' } | { readonly kind: Exclude<ScopeKind, 'all'>; readonly ids: readonly string[] };

export type RuleWhen = { readonly days: readonly Weekday[]; readonly from: HHMM | null; readonly to: HHMM | null };

/** An owner's upsell rule (F06). Exactly one suggestion, never chained, never pre-selected. */
export type UpsellRuleV2 = {
  readonly id: string;
  readonly trigger: Trigger;
  readonly scope: RuleScope;
  /** null = any time. Days empty = every day. */
  readonly when: RuleWhen | null;
  /**
   * null = no condition. Otherwise the basket must contain one of these, and the lists name at least one dish or
   * section (a condition never turns into "always": publish leaves a rule out when every target it names is gone).
   */
  readonly basketHas: IdMatch | null;
  /** null = no condition. Otherwise the basket must contain none of these (at least one id). */
  readonly basketLacks: IdMatch | null;
  readonly suggest: UpsellSuggestion;
  readonly line: Text;
  /** 0–100; the higher wins; ties go to the smaller id. */
  readonly priority: number;
  /** How many times one visit may see this rule's suggestion. */
  readonly cap: number;
  readonly active: boolean;
};

export type SnapshotV2 = {
  readonly v: typeof SNAPSHOT_VERSION;
  readonly venueId: string;
  readonly slug: string;
  /** 0 for a preview that was never published. */
  readonly revision: number;
  readonly publishedAt: string;
  readonly assetBase: string;
  readonly venue: {
    readonly name: Text;
    readonly area: Text;
    readonly cuisine: Text;
    readonly kind: VenueKind;
    readonly mode: VenueMode;
    readonly logo: string | null;
    readonly orderUrl: string | null;
    readonly bookUrl: string | null;
    readonly phone: string | null;
    readonly soldOut: SoldOutDisplay;
    /** Opening hours are live (they change from a phone without a publish): see `LiveOverlay.hours`. */
    readonly timeZone: string;
  };
  readonly locale: { readonly default: Lang; readonly langs: readonly Lang[]; readonly currency: 'ILS' };
  readonly pricing: { readonly includesVat: true; readonly vatBasisPoints: number };
  readonly theme: { readonly accent: string; readonly surface: string; readonly template: string | null; readonly tableImg: string | null };
  readonly schedules: readonly ScheduleV2[];
  readonly sections: readonly SectionV2[];
  readonly addonGroups: readonly AddonGroupV2[];
  readonly upsellRules: readonly UpsellRuleV2[];
};

/**
 * A warning from publishing or previewing: the menu is published, but something will not behave as the owner may
 * expect. Codes: `rule_left_out` (reason `scope_empty` | `basket_has_empty` | `suggestion_hidden`; the rule is not in the
 * snapshot), `rule_suggests_its_trigger`, `rule_option_unreachable` (from `lintSnapshotV2`, also in the database).
 */
export type PublishWarning = { readonly code: string; readonly path: string; readonly id?: string; readonly reason?: string; readonly label?: string };

/** What `public_menu(slug)` answers. */
export type PublicMenuResponse =
  | { readonly state: 'ok'; readonly snapshot: SnapshotV2; readonly live: import('./live.ts').LiveOverlay }
  | { readonly state: 'unavailable'; readonly venue: { readonly name: Text } }
  | { readonly state: 'not_found' };

/** Every dish of a snapshot, in menu order, with its section id. */
export function allDishes(s: SnapshotV2): Array<{ dish: DishV2; sectionId: string }> {
  const out: Array<{ dish: DishV2; sectionId: string }> = [];
  for (const sec of s.sections) for (const dish of sec.dishes) out.push({ dish, sectionId: sec.id });
  return out;
}
