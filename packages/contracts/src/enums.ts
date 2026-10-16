/**
 * Every closed list of words Mana uses. The database's check constraints use the same lists; a test in
 * supabase/tests compares them, so a word added here and not there (or the reverse) fails the build.
 */

export const VENUE_KINDS = ['restaurant', 'cafe', 'bar', 'bakery', 'food_truck', 'hotel', 'other'] as const;
export type VenueKind = (typeof VENUE_KINDS)[number];

/** Which flows a venue has (B1): a menu only; Mana's own ordering and payment; or beside a POS (later). */
export const VENUE_MODES = ['view_only', 'standalone', 'companion'] as const;
export type VenueMode = (typeof VENUE_MODES)[number];

export const MEMBER_ROLES = ['owner', 'manager', 'counter'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const STAFF_ROLES = ['support', 'admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const SECTION_KINDS = ['food', 'dessert', 'drinks', 'wine', 'beer'] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const ROOMS = ['table', 'vitrine', 'cellar', 'taps', 'cocktail'] as const;
export type Room = (typeof ROOMS)[number];

export const SCENES = ['auto', 'table', 'bar', 'holo'] as const;
export type Scene = (typeof SCENES)[number];

export const TAGS = ['vegan', 'vegetarian', 'spicy', 'gf'] as const;
export type Tag = (typeof TAGS)[number];

export const SELECTIONS = ['single', 'multiple'] as const;
export type SelectionKind = (typeof SELECTIONS)[number];

export const TRIGGERS = ['sheet', 'add', 'checkout'] as const;
export type Trigger = (typeof TRIGGERS)[number];

export const SCOPE_KINDS = ['all', 'section', 'dish'] as const;
export type ScopeKind = (typeof SCOPE_KINDS)[number];

export const TARGET_KINDS = ['section', 'dish', 'option'] as const;
export type TargetKind = (typeof TARGET_KINDS)[number];

/** How long an availability override lasts: "now" is any of these starting now. */
export const UNTIL_KINDS = ['duration', 'time', 'next_opening', 'date', 'indefinite'] as const;
export type UntilKind = (typeof UNTIL_KINDS)[number];

export const SCHEDULE_KINDS = ['day_part', 'special'] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

export const SOLD_OUT_DISPLAY = ['bottom', 'hide'] as const;
export type SoldOutDisplay = (typeof SOLD_OUT_DISPLAY)[number];

export const RELIEF_CLASSES = ['flat', 'low', 'medium', 'tall', 'stand'] as const;
export type ReliefClass = (typeof RELIEF_CLASSES)[number];

export const ASSET_STATUSES = ['uploaded', 'processing', 'ready_for_review', 'approved', 'rejected', 'failed'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_KINDS = ['relief', 'photo'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

/** The onboarding journey (feature map F03), in order. */
export const ONBOARDING_STEPS = ['venue', 'menu', 'review', 'addons', 'photos', 'hours', 'style', 'test', 'publish'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_STATES = ['todo', 'doing', 'done', 'skipped', 'blocked'] as const;
export type OnboardingState = (typeof ONBOARDING_STATES)[number];

/** Where an imported menu came from (D33: Wolt only as what the owner gives us). */
export const IMPORT_SOURCES = ['scan', 'paste', 'wolt_screenshots', 'wolt_text'] as const;
export type ImportSource = (typeof IMPORT_SOURCES)[number];

export const IMPORT_STATUSES = ['uploaded', 'parsing', 'parsed', 'failed', 'applied', 'discarded'] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const CASE_STATUSES = ['open', 'waiting_owner', 'waiting_halom', 'resolved'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_TOPICS = ['onboarding', 'import', 'menu', 'photos', 'account', 'other'] as const;
export type CaseTopic = (typeof CASE_TOPICS)[number];

/** A venue's first publish: Halom reviews it before guests see it (app_config.publish_requires_approval). */
export const REVIEW_STATES = ['not_requested', 'pending', 'approved'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const PLANS = ['trial', 'pilot', 'paid'] as const;
export type Plan = (typeof PLANS)[number];

export const ENTITLEMENT_STATUSES = ['pending', 'trialing', 'active', 'expired', 'suspended'] as const;
export type EntitlementStatus = (typeof ENTITLEMENT_STATUSES)[number];

export const ACTOR_KINDS = ['owner', 'manager', 'counter', 'staff', 'system'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

/**
 * The only things Halom support can do inside a venue, each through act_for_owner with a reason (D25). Phase 1 has no
 * `menu.publish`: it would publish the owner's draft unreviewed; staff help through the approval (`ops_approve_venue`).
 */
export const ACT_FOR_OWNER_ACTIONS = [
  'availability.set',
  'availability.restore',
  'dish.update',
  'onboarding.set',
  'support_case.update',
] as const;
export type ActForOwnerAction = (typeof ACT_FOR_OWNER_ACTIONS)[number];

/** Size limits. The database enforces the same numbers where it can (see supabase/migrations). */
export const LIMITS = {
  sections: 40,
  dishes: 400,
  addonGroups: 200,
  optionsPerGroup: 30,
  groupsPerDish: 8,
  related: 6,
  rules: 50,
  schedules: 20,
  windows: 14,
  /** Opening-hours windows per venue (`venue_hours` rows; `limits.hours` in the database). */
  hours: 21,
  closures: 60,
  lineQuantity: 50,
  optionQuantity: 10,
  price: 10_000_000,
  ruleCap: 5,
  nameLength: 90,
  descLength: 600,
  noteLength: 80,
  ruleLine: 120,
  detailsBytes: 6000,
} as const;
