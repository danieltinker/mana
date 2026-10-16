/**
 * The domain as stored: one row type per table of the clean schema (supabase/migrations), column for column, in the
 * database's snake_case so supabase-js results type-check without mapping. Money is integer agorot with VAT included.
 * Timestamps arrive as ISO strings, dates as 'YYYY-MM-DD', times as 'HH:MM:SS'.
 *
 * `TABLE_COLUMNS` lists the same columns at run time; supabase/tests compares it with information_schema, and the
 * type-level check at the bottom keeps it equal to the row types. A column added in one place only fails a test.
 */
import type {
  ActorKind, AssetKind, AssetStatus, CaseStatus, CaseTopic, EntitlementStatus, ImportSource, ImportStatus, MemberRole,
  OnboardingState, OnboardingStep, Plan, ReliefClass, Room, Scene, ScheduleKind, ScopeKind, SectionKind, SelectionKind,
  SoldOutDisplay, StaffRole, Tag, TargetKind, Trigger, UntilKind, VenueKind, VenueMode,
} from './enums.ts';
import type { Lang } from './common.ts';
import type { TimeWindow, UntilSpec, Weekday } from './time.ts';

type Uuid = string;
type Iso = string;

export type VenueRow = {
  id: Uuid;
  /** Permanent: what QR codes encode. A trigger refuses any change. */
  slug: string;
  name_he: string;
  name_en: string;
  area_he: string;
  area_en: string;
  cuisine_he: string;
  cuisine_en: string;
  kind: VenueKind;
  mode: VenueMode;
  default_lang: Lang;
  langs: Lang[];
  time_zone: string;
  currency: 'ILS';
  accent: string;
  surface: string;
  template: string | null;
  logo_path: string | null;
  table_img_path: string | null;
  order_url: string | null;
  book_url: string | null;
  phone: string | null;
  sold_out_display: SoldOutDisplay;
  /** The owner's switch for Halom's "act for owner" (D25); on by default. */
  support_can_act: boolean;
  /** Demo venues are labelled everywhere and left out of real totals. Set by Halom only. */
  is_demo: boolean;
  /** When Halom approved the venue's first publish (app_config.publish_requires_approval); null = not yet. */
  approved_at: Iso | null;
  approved_by: Uuid | null;
  published_revision_id: Uuid | null;
  first_published_at: Iso | null;
  last_published_at: Iso | null;
  archived_at: Iso | null;
  created_by: Uuid | null;
  created_at: Iso;
  updated_at: Iso;
};

export type VenueMemberRow = { venue_id: Uuid; user_id: Uuid; role: MemberRole; invited_by: Uuid | null; created_at: Iso };
export type StaffRow = { user_id: Uuid; role: StaffRole; note: string | null; created_at: Iso };

export type SectionRow = {
  id: Uuid;
  venue_id: Uuid;
  position: number;
  name_he: string;
  name_en: string;
  kind: SectionKind;
  scene: Scene;
  room: Room | null;
  schedule_id: Uuid | null;
  hidden: boolean;
  created_at: Iso;
  updated_at: Iso;
};

export type DishRow = {
  id: Uuid;
  venue_id: Uuid;
  section_id: Uuid;
  position: number;
  name_he: string;
  name_en: string;
  desc_he: string;
  desc_en: string;
  /** Agorot, VAT included; null = no price shown. */
  price: number | null;
  price_note_he: string;
  price_note_en: string;
  tags: Tag[];
  allergens_he: string;
  allergens_en: string;
  details: Record<string, unknown>;
  asset_id: Uuid | null;
  stock_id: string | null;
  schedule_id: Uuid | null;
  hidden: boolean;
  created_at: Iso;
  updated_at: Iso;
};

export type AssetRow = {
  id: Uuid;
  venue_id: Uuid;
  dish_id: Uuid | null;
  status: AssetStatus;
  kind: AssetKind;
  relief_class: ReliefClass | null;
  /** In the private bucket: the owner's upload. */
  original_path: string | null;
  /** In the public bucket once approved. */
  color_path: string | null;
  aux_path: string | null;
  thumb_path: string | null;
  meta: Record<string, unknown>;
  provenance: Record<string, unknown>;
  error_code: string | null;
  attempts: number;
  created_by: Uuid | null;
  reviewed_at: Iso | null;
  created_at: Iso;
  updated_at: Iso;
};

export type AddonGroupRow = {
  id: Uuid;
  venue_id: Uuid;
  /** The owner's own label to tell groups apart in the library ("Side, burgers"); never shown to guests. */
  label: string;
  name_he: string;
  name_en: string;
  selection: SelectionKind;
  min_units: number;
  max_units: number;
  /** false when an import guessed the limits (the source stated none): the dashboard's `group_without_limits` nudge
   * shows until the owner edits or confirms them. */
  limits_confirmed: boolean;
  created_at: Iso;
  updated_at: Iso;
};

export type AddonOptionRow = {
  id: Uuid;
  venue_id: Uuid;
  group_id: Uuid;
  position: number;
  name_he: string;
  name_en: string;
  price: number;
  max_qty: number;
  is_default: boolean;
  /** One nesting level: the group this option opens. That group's options may not open another. */
  opens_group_id: Uuid | null;
  created_at: Iso;
  updated_at: Iso;
};

export type DishAddonGroupRow = {
  id: Uuid;
  venue_id: Uuid;
  dish_id: Uuid;
  group_id: Uuid;
  position: number;
  /** null = the group's own limit. */
  min_units: number | null;
  max_units: number | null;
  created_at: Iso;
};

export type DishRelationRow = { id: Uuid; venue_id: Uuid; dish_id: Uuid; related_dish_id: Uuid; position: number; created_at: Iso };

export type UpsellRuleRow = {
  id: Uuid;
  venue_id: Uuid;
  label: string;
  trigger: Trigger;
  scope_kind: ScopeKind;
  scope_ids: Uuid[];
  days: Weekday[];
  from_time: string | null;
  to_time: string | null;
  basket_has_dishes: Uuid[];
  basket_has_sections: Uuid[];
  basket_lacks_dishes: Uuid[];
  basket_lacks_sections: Uuid[];
  suggest_kind: 'dish' | 'option';
  suggest_dish_id: Uuid | null;
  suggest_option_id: Uuid | null;
  line_he: string;
  line_en: string;
  priority: number;
  cap: number;
  active: boolean;
  /** Why the database switched the rule off: 'basket_has_emptied' (the last dish or section its "basket has" named
   * was deleted). Such a rule is turned on again only with a new condition. */
  inactive_reason: 'basket_has_emptied' | null;
  created_at: Iso;
  updated_at: Iso;
};

export type AvailabilityOverrideRow = {
  id: Uuid;
  venue_id: Uuid;
  target_kind: TargetKind;
  target_id: Uuid;
  starts_at: Iso;
  until_kind: UntilKind;
  until_spec: UntilSpec;
  /** Resolved when stored; null = indefinitely. Restores by the clock, no job needed. */
  until_at: Iso | null;
  note: string | null;
  created_by: Uuid | null;
  created_by_kind: ActorKind;
  restored_at: Iso | null;
  restored_by: Uuid | null;
  created_at: Iso;
};

export type ScheduleRow = {
  id: Uuid;
  venue_id: Uuid;
  kind: ScheduleKind;
  name_he: string;
  name_en: string;
  windows: TimeWindow[];
  valid_from: string | null;
  valid_to: string | null;
  created_at: Iso;
  updated_at: Iso;
};

export type VenueHoursRow = { id: Uuid; venue_id: Uuid; weekday: Weekday; opens: string; closes: string; created_at: Iso };
export type VenueClosureRow = { id: Uuid; venue_id: Uuid; from_date: string; to_date: string; note_he: string; note_en: string; created_at: Iso };

export type MenuRevisionRow = {
  id: Uuid;
  venue_id: Uuid;
  number: number;
  snapshot_version: number;
  snapshot: unknown;
  note: string | null;
  created_by: Uuid | null;
  created_at: Iso;
};

export type OnboardingProgressRow = {
  venue_id: Uuid;
  step: OnboardingStep;
  state: OnboardingState;
  blockers: string[];
  updated_by: Uuid | null;
  updated_at: Iso;
};

export type MenuImportRow = {
  id: Uuid;
  venue_id: Uuid;
  source: ImportSource;
  status: ImportStatus;
  /** Private bucket paths of uploaded screenshots or photos. Never public. */
  raw_paths: string[];
  /** Pasted text (a list, or text copied from the venue's own Wolt page). Never public. */
  raw_text: string | null;
  input_sha256: string | null;
  /** D33: photos from Wolt come in only when the owner confirms they own them. */
  rights_confirmed: boolean;
  parsed: unknown;
  exceptions: unknown[];
  error_code: string | null;
  created_by: Uuid | null;
  applied_at: Iso | null;
  created_at: Iso;
  updated_at: Iso;
  /** When the raw input (`raw_text`, or the screenshots of `raw_paths`) was purged after the retention period; the
   * draft (`parsed`) stays. */
  raw_purged_at: Iso | null;
  /** What the reader noticed, as codes and counts (never text): written by save_import_draft, readable by clients.
   * The contract's `ReaderNote` type comes with the importer's round 3. */
  notes: unknown[];
};

export type SupportCaseRow = {
  id: Uuid;
  venue_id: Uuid;
  topic: CaseTopic;
  status: CaseStatus;
  subject: string;
  body: string;
  opened_by: Uuid | null;
  resolved_at: Iso | null;
  created_at: Iso;
  updated_at: Iso;
};

export type ActivityRow = {
  id: number;
  venue_id: Uuid | null;
  at: Iso;
  actor_id: Uuid | null;
  actor_kind: ActorKind;
  via: 'direct' | 'rpc' | 'act_for_owner' | 'system';
  reason: string | null;
  action: string;
  target_table: string | null;
  target_ids: string[];
  n: number;
  detail: Record<string, unknown>;
};

export type EntitlementRow = {
  venue_id: Uuid;
  plan: Plan;
  status: EntitlementStatus;
  trial_started_at: Iso | null;
  trial_ends_at: Iso | null;
  current_period_end: Iso | null;
  note: string | null;
  updated_at: Iso;
};

/** Column lists at run time, compared with the database by supabase/tests. */
export const TABLE_COLUMNS = {
  venues: ['id', 'slug', 'name_he', 'name_en', 'area_he', 'area_en', 'cuisine_he', 'cuisine_en', 'kind', 'mode', 'default_lang', 'langs', 'time_zone', 'currency', 'accent', 'surface', 'template', 'logo_path', 'table_img_path', 'order_url', 'book_url', 'phone', 'sold_out_display', 'support_can_act', 'is_demo', 'approved_at', 'approved_by', 'published_revision_id', 'first_published_at', 'last_published_at', 'archived_at', 'created_by', 'created_at', 'updated_at'],
  venue_members: ['venue_id', 'user_id', 'role', 'invited_by', 'created_at'],
  staff: ['user_id', 'role', 'note', 'created_at'],
  sections: ['id', 'venue_id', 'position', 'name_he', 'name_en', 'kind', 'scene', 'room', 'schedule_id', 'hidden', 'created_at', 'updated_at'],
  dishes: ['id', 'venue_id', 'section_id', 'position', 'name_he', 'name_en', 'desc_he', 'desc_en', 'price', 'price_note_he', 'price_note_en', 'tags', 'allergens_he', 'allergens_en', 'details', 'asset_id', 'stock_id', 'schedule_id', 'hidden', 'created_at', 'updated_at'],
  assets: ['id', 'venue_id', 'dish_id', 'status', 'kind', 'relief_class', 'original_path', 'color_path', 'aux_path', 'thumb_path', 'meta', 'provenance', 'error_code', 'attempts', 'created_by', 'reviewed_at', 'created_at', 'updated_at'],
  addon_groups: ['id', 'venue_id', 'label', 'name_he', 'name_en', 'selection', 'min_units', 'max_units', 'limits_confirmed', 'created_at', 'updated_at'],
  addon_options: ['id', 'venue_id', 'group_id', 'position', 'name_he', 'name_en', 'price', 'max_qty', 'is_default', 'opens_group_id', 'created_at', 'updated_at'],
  dish_addon_groups: ['id', 'venue_id', 'dish_id', 'group_id', 'position', 'min_units', 'max_units', 'created_at'],
  dish_relations: ['id', 'venue_id', 'dish_id', 'related_dish_id', 'position', 'created_at'],
  upsell_rules: ['id', 'venue_id', 'label', 'trigger', 'scope_kind', 'scope_ids', 'days', 'from_time', 'to_time', 'basket_has_dishes', 'basket_has_sections', 'basket_lacks_dishes', 'basket_lacks_sections', 'suggest_kind', 'suggest_dish_id', 'suggest_option_id', 'line_he', 'line_en', 'priority', 'cap', 'active', 'inactive_reason', 'created_at', 'updated_at'],
  availability_overrides: ['id', 'venue_id', 'target_kind', 'target_id', 'starts_at', 'until_kind', 'until_spec', 'until_at', 'note', 'created_by', 'created_by_kind', 'restored_at', 'restored_by', 'created_at'],
  schedules: ['id', 'venue_id', 'kind', 'name_he', 'name_en', 'windows', 'valid_from', 'valid_to', 'created_at', 'updated_at'],
  venue_hours: ['id', 'venue_id', 'weekday', 'opens', 'closes', 'created_at'],
  venue_closures: ['id', 'venue_id', 'from_date', 'to_date', 'note_he', 'note_en', 'created_at'],
  menu_revisions: ['id', 'venue_id', 'number', 'snapshot_version', 'snapshot', 'note', 'created_by', 'created_at'],
  onboarding_progress: ['venue_id', 'step', 'state', 'blockers', 'updated_by', 'updated_at'],
  menu_imports: ['id', 'venue_id', 'source', 'status', 'raw_paths', 'raw_text', 'input_sha256', 'rights_confirmed', 'parsed', 'exceptions', 'error_code', 'created_by', 'applied_at', 'created_at', 'updated_at', 'raw_purged_at', 'notes'],
  support_cases: ['id', 'venue_id', 'topic', 'status', 'subject', 'body', 'opened_by', 'resolved_at', 'created_at', 'updated_at'],
  activity_log: ['id', 'venue_id', 'at', 'actor_id', 'actor_kind', 'via', 'reason', 'action', 'target_table', 'target_ids', 'n', 'detail'],
  entitlements: ['venue_id', 'plan', 'status', 'trial_started_at', 'trial_ends_at', 'current_period_end', 'note', 'updated_at'],
} as const;

// ---- type-level check: each list above has exactly the keys of its row type (fails `npm run check` otherwise)
type Rows = {
  venues: VenueRow; venue_members: VenueMemberRow; staff: StaffRow; sections: SectionRow; dishes: DishRow; assets: AssetRow;
  addon_groups: AddonGroupRow; addon_options: AddonOptionRow; dish_addon_groups: DishAddonGroupRow; dish_relations: DishRelationRow;
  upsell_rules: UpsellRuleRow; availability_overrides: AvailabilityOverrideRow; schedules: ScheduleRow; venue_hours: VenueHoursRow;
  venue_closures: VenueClosureRow; menu_revisions: MenuRevisionRow; onboarding_progress: OnboardingProgressRow;
  menu_imports: MenuImportRow; support_cases: SupportCaseRow; activity_log: ActivityRow; entitlements: EntitlementRow;
};
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type ColumnsMatch = { [T in keyof Rows]: Same<keyof Rows[T], (typeof TABLE_COLUMNS)[T][number]> };
type AllTrue<O> = O[keyof O] extends true ? true : false;
export const COLUMNS_MATCH_ROW_TYPES: AllTrue<ColumnsMatch> = true;
