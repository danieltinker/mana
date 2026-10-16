/**
 * Is a section, dish or add-on option available right now, and if not, why and until when?
 *
 * Three layers, checked in this order (the first that says "no" is the reason the guest is told):
 * 1. `off`: an availability override (sold out now, for 2 h, until opening tomorrow, until a date, indefinitely).
 *    A dish is also off while its section is.
 * 2. `schedule`: the section's or dish's schedule (a day part such as breakfast, or a special on chosen days) is
 *    not in effect.
 * 3. `closed`: the venue is outside its opening hours. A view-only menu may choose to ignore this reason.
 * And for dishes, `choices`: a required add-on group has nothing left to choose (every option off, or every
 * option that opens a required nested group leads to a group with nothing left).
 */
import { isObject, isUuid, oneOf, type Validation } from './common.ts';
import { TARGET_KINDS, type TargetKind } from './enums.ts';
import type { LiveOverlay } from './live.ts';
import { optionalText, validateInput } from './rpc.ts';
import type { AddonGroupV2, DishV2, SnapshotV2 } from './snapshot.ts';
import { inSchedule, isOpenAt, isUntilSpec, nextOpening, nextScheduleStart, type ScheduleTimes, type UntilSpec, type VenueHours } from './time.ts';

export type AvailabilityTarget =
  | { readonly kind: 'section'; readonly id: string }
  | { readonly kind: 'dish'; readonly id: string; readonly sectionId?: string | null }
  | { readonly kind: 'option'; readonly id: string };

type Instant = string | number | Date;
export type OverrideLike = {
  readonly kind: TargetKind;
  readonly id: string;
  readonly from?: Instant | null;
  readonly until: Instant | null;
};

export type UnavailableReason = 'off' | 'schedule' | 'closed' | 'choices';
export type Availability =
  | { readonly available: true }
  | { readonly available: false; readonly reason: UnavailableReason; readonly back: Date | null };

const ms = (v: Instant): number => (v instanceof Date ? v.getTime() : typeof v === 'number' ? v : Date.parse(v));

function activeAt(o: OverrideLike, t: number): boolean {
  const from = o.from == null ? -Infinity : ms(o.from);
  const until = o.until == null ? Infinity : ms(o.until);
  return from <= t && t < until;
}

/** The overrides that cover a target now (a dish is also covered by its section's). */
function covering(target: AvailabilityTarget, overrides: readonly OverrideLike[], t: number): OverrideLike[] {
  return overrides.filter(
    (o) =>
      activeAt(o, t) &&
      ((o.kind === target.kind && o.id === target.id) ||
        (target.kind === 'dish' && target.sectionId != null && o.kind === 'section' && o.id === target.sectionId)),
  );
}

/** When every covering override has ended (null if any is indefinite). */
function backFrom(cover: readonly OverrideLike[]): Date | null {
  let latest = -Infinity;
  for (const o of cover) {
    if (o.until == null) return null;
    latest = Math.max(latest, ms(o.until));
  }
  return new Date(latest);
}

/**
 * @param schedule the target's schedule, or several that must all be in effect (a dish's and its section's), or null.
 * @param hours the venue's hours, or null to ignore opening hours (options never depend on them).
 */
export function isAvailable(
  target: AvailabilityTarget,
  overrides: readonly OverrideLike[],
  schedule: ScheduleTimes | readonly ScheduleTimes[] | null,
  hours: VenueHours | null,
  now: Date | number,
): Availability {
  const t = typeof now === 'number' ? now : now.getTime();
  const cover = covering(target, overrides, t);
  if (cover.length > 0) return { available: false, reason: 'off', back: backFrom(cover) };

  const schedules: readonly ScheduleTimes[] = schedule == null ? [] : Array.isArray(schedule) ? schedule : [schedule as ScheduleTimes];
  const tz = hours?.timeZone ?? 'Asia/Jerusalem';
  const outside = schedules.filter((s) => !inSchedule(s, t, tz));
  if (outside.length > 0) {
    const starts = outside.map((s) => nextScheduleStart(s, t, tz));
    const back = starts.some((d) => d === null) ? null : new Date(Math.max(...starts.map((d) => d!.getTime())));
    return { available: false, reason: 'schedule', back };
  }

  if (hours && !isOpenAt(hours, t)) return { available: false, reason: 'closed', back: nextOpening(hours, t) };
  return { available: true };
}

export type MenuAvailability = {
  readonly open: boolean;
  readonly sections: ReadonlyMap<string, Availability>;
  readonly dishes: ReadonlyMap<string, Availability>;
  readonly options: ReadonlyMap<string, Availability>;
};

/** Ids that cannot be chosen now: the input of `priceDish` and `matchSuggestion`. */
export type Unavailable = { readonly dishes: ReadonlySet<string>; readonly options: ReadonlySet<string> };

export function venueHoursOf(s: SnapshotV2, live: LiveOverlay): VenueHours {
  return { timeZone: s.venue.timeZone, weekly: live.hours.weekly, closures: live.hours.closures };
}

/** How many units of a group can still be chosen, given what is off. An opener counts only if its own group can be satisfied. */
export function groupCapacity(group: AddonGroupV2, groups: ReadonlyMap<string, AddonGroupV2>, offOptions: ReadonlySet<string>, depth = 0): number {
  let units = 0;
  for (const o of group.options) {
    if (offOptions.has(o.id)) continue;
    if (o.opensGroupId !== null) {
      const nested = groups.get(o.opensGroupId);
      if (!nested) continue;
      if (depth === 0 && nested.min > 0 && groupCapacity(nested, groups, offOptions, 1) < nested.min) continue;
    }
    units += o.maxQty;
  }
  return units;
}

/** Does a dish have a required group that can no longer be satisfied? */
export function choicesExhausted(dish: DishV2, groups: ReadonlyMap<string, AddonGroupV2>, offOptions: ReadonlySet<string>): boolean {
  return dish.addons.some((a) => {
    if (a.min < 1) return false;
    const g = groups.get(a.groupId);
    return !g || groupCapacity(g, groups, offOptions) < a.min;
  });
}

/** Everything on a menu at once: the guest menu's single source for greying, ordering and suggestions. */
export function menuAvailability(s: SnapshotV2, live: LiveOverlay, now: Date | number): MenuAvailability {
  const t = typeof now === 'number' ? now : now.getTime();
  const hours = venueHoursOf(s, live);
  const sched = new Map(s.schedules.map((x) => [x.id, x] as const));
  const groups = new Map(s.addonGroups.map((g) => [g.id, g] as const));
  const off = live.off;

  const options = new Map<string, Availability>();
  const offOptions = new Set<string>();
  for (const g of s.addonGroups)
    for (const o of g.options) {
      const a = isAvailable({ kind: 'option', id: o.id }, off, null, null, t);
      options.set(o.id, a);
      if (!a.available) offOptions.add(o.id);
    }

  const sections = new Map<string, Availability>();
  const dishes = new Map<string, Availability>();
  for (const sec of s.sections) {
    const secSched = sec.scheduleId ? sched.get(sec.scheduleId) : undefined;
    sections.set(sec.id, isAvailable({ kind: 'section', id: sec.id }, off, secSched ?? null, hours, t));
    for (const d of sec.dishes) {
      const list: ScheduleTimes[] = [];
      if (secSched) list.push(secSched);
      const ds = d.scheduleId ? sched.get(d.scheduleId) : undefined;
      if (ds) list.push(ds);
      let a = isAvailable({ kind: 'dish', id: d.id, sectionId: sec.id }, off, list, hours, t);
      if (a.available && choicesExhausted(d, groups, offOptions)) a = { available: false, reason: 'choices', back: null };
      dishes.set(d.id, a);
    }
  }
  return { open: isOpenAt(hours, t), sections, dishes, options };
}

/**
 * The ids a guest cannot choose now. `includeClosed: false` (the default for a view-only menu) keeps dishes that are
 * unavailable only because the venue is closed.
 */
export function unavailableOf(av: MenuAvailability, includeClosed = false): Unavailable {
  const dishes = new Set<string>();
  for (const [id, a] of av.dishes) if (!a.available && (includeClosed || a.reason !== 'closed')) dishes.add(id);
  const options = new Set<string>();
  for (const [id, a] of av.options) if (!a.available) options.add(id);
  return { dishes, options };
}

// ---------------------------------------------------------------- the quick actions' inputs (F05, F08; ADR-008)

/** An availability override's note (who asked, why): at most this many characters; never shown to guests. */
export const AVAILABILITY_NOTE_MAX = 200;

/**
 * `set_availability`: take a section, dish or add-on option off until `until` (resolved by `resolveUntil` when stored),
 * or bring it back now (`until: null`). The newest answer counts: whatever is off for the same target now is restored
 * in the same transaction. Owners, managers and counters; Halom through `act_for_owner`.
 */
export type SetAvailabilityInput = {
  readonly venueId: string;
  readonly target: { readonly kind: TargetKind; readonly id: string };
  readonly until: UntilSpec | null;
  readonly note?: string | null;
};
export type SetAvailabilityReply = {
  readonly ok: true;
  /** The new override; null when `until` was null. */
  readonly overrideId: string | null;
  /** When it comes back (whole minutes); null = until the owner restores it, or back now. */
  readonly untilAt: string | null;
  /** How many overrides of this target were restored first. */
  readonly restored: number;
};

/** Codes: type, field_not_allowed, id_invalid, enum_invalid, until_invalid, text_too_long. */
export function validateSetAvailability(raw: unknown): Validation<SetAvailabilityInput> {
  return validateInput<SetAvailabilityInput>(raw, ['venueId', 'target', 'until', 'note'], (x, o) => {
    if (!isUuid(o.venueId)) x.add('id_invalid', 'venueId');
    const t = o.target;
    if (!isObject(t)) x.add('type', 'target');
    else {
      if (!oneOf(TARGET_KINDS, t.kind)) x.add('enum_invalid', 'target.kind');
      if (!isUuid(t.id)) x.add('id_invalid', 'target.id');
    }
    if (o.until !== null && !isUntilSpec(o.until)) x.add('until_invalid', 'until');
    optionalText(x, o.note, 'note', AVAILABILITY_NOTE_MAX);
  });
}

/**
 * `restore_today`: bring back everything taken off today (the venue's local date) that is still off. An override that
 * started on an earlier day ("until Sunday", "indefinitely" from last week) stays.
 */
export type RestoreTodayInput = { readonly venueId: string };
export type RestoreTodayReply = {
  readonly ok: true;
  readonly restored: number;
  readonly targets: ReadonlyArray<{ readonly kind: TargetKind; readonly id: string }>;
};

export function validateRestoreToday(raw: unknown): Validation<RestoreTodayInput> {
  return validateInput<RestoreTodayInput>(raw, ['venueId'], (x, o) => void (isUuid(o.venueId) || x.add('id_invalid', 'venueId')));
}
