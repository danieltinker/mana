// The phone's quick actions (F05, Hopa H50–H51): take a section, a dish, an add-on choice or a whole add-on group off
// until a moment the owner picks, bring it back, bring back everything taken off today. Whether something is off now and
// until when is the contracts' isAvailable; the moments are the contracts' resolveUntil, in the venue's time zone (the
// database stores the same moment). The writes are set_availability and restore_today (ADR-008), each input checked
// first with the contracts' validator. Pure: the RPC is passed in, so the tests run every call against a fake.
import { LIVE_REFRESH, isAvailable, isOpenAt, localParts, nextOpening, pollDelay, resolveUntil, validateRestoreToday, validateSetAvailability } from '@mana/contracts';
import type {
  AddonOptionRow, AvailabilityOverrideRow, LiveOverlay, OffEntry, RestoreTodayReply, SetAvailabilityInput, SetAvailabilityReply, TargetKind, UntilSpec,
  VenueHours,
} from '@mana/contracts';
import { V2Error, refusal } from './errors.ts';

/** What the owner can take off: the schema's three kinds, or a whole add-on group (every choice in it). */
export type OffTarget = { readonly kind: TargetKind | 'group'; readonly id: string };

/** The choices the phone offers, in this order. `time` and `date` take the owner's value ('HH:MM', 'YYYY-MM-DD'). */
export const UNTIL_CHOICES = ['h1', 'h2', 'next_opening', 'time', 'date', 'indefinite'] as const;
export type UntilChoice = (typeof UNTIL_CHOICES)[number];

export function untilSpecOf(choice: UntilChoice, value = ''): UntilSpec {
  switch (choice) {
    case 'h1': return { kind: 'duration', minutes: 60 };
    case 'h2': return { kind: 'duration', minutes: 120 };
    case 'next_opening': return { kind: 'next_opening' };
    case 'time': return { kind: 'time', at: value };
    case 'date': return { kind: 'date', date: value };
    case 'indefinite': return { kind: 'indefinite' };
  }
}

/**
 * When it comes back if taken off at `now` (null: when the owner brings it back): shown beside each choice before the
 * tap. "Until the next opening" skips closed dates and, with no hours set, is the start of tomorrow.
 */
export const backAt = (spec: UntilSpec, now: number, hours: VenueHours): Date | null => resolveUntil(spec, now, hours);

// ---------------------------------------------------------------- what is off
type OverrideRow = Pick<AvailabilityOverrideRow, 'target_kind' | 'target_id' | 'starts_at' | 'until_at' | 'restored_at'>;

/** The overrides that count (not restored, not over), as public_menu sends them to the guest's phone. */
export function offEntries(rows: readonly OverrideRow[], now: number): OffEntry[] {
  return rows.filter((r) => r.restored_at === null && (r.until_at === null || Date.parse(r.until_at) > now))
    .map((r) => ({ kind: r.target_kind, id: r.target_id, from: r.starts_at, until: r.until_at }));
}

export type OffState = { readonly off: false } | { readonly off: true; readonly back: Date | null; readonly withSection: boolean };

/** Is it off at `now` and until when; a dish may be off only because its section is (`withSection`). */
export function offState(target: { kind: TargetKind; id: string; sectionId?: string | null }, entries: readonly OffEntry[], now: number): OffState {
  const own = isAvailable({ kind: target.kind, id: target.id } as Parameters<typeof isAvailable>[0], entries, null, null, now);
  const all = target.kind === 'dish' && target.sectionId ? isAvailable({ kind: 'dish', id: target.id, sectionId: target.sectionId }, entries, null, null, now) : own;
  if (all.available) return { off: false };
  return { off: true, back: all.back, withSection: own.available };
}

/** The live overlay the guest's phone would get now (public_menu's `live`), from the rows the owner app holds. */
export function liveOverlayOf(hours: VenueHours, rows: readonly OverrideRow[], now: number): LiveOverlay {
  const open = hours.weekly.length ? isOpenAt(hours, now) : null;
  const next = open === false ? nextOpening(hours, now) : null;
  return { at: new Date(now).toISOString(), open, nextOpening: next ? next.toISOString() : null, hours: { weekly: hours.weekly, closures: hours.closures }, off: offEntries(rows, now) };
}

/** Taken off on the venue's local today, started and still off: what restore_today brings back (an earlier day's stays). */
export function offToday<T extends OverrideRow>(rows: readonly T[], now: number, timeZone: string): T[] {
  const today = localParts(now, timeZone).date;
  return rows.filter((r) => r.restored_at === null && (r.until_at === null || Date.parse(r.until_at) > now)
    && Date.parse(r.starts_at) <= now && localParts(Date.parse(r.starts_at), timeZone).date === today);
}

// ---------------------------------------------------------------- keeping "off now" current (ADR-007)
/** Realtime messages with the slow safety poll beside them, or polling alone (no Realtime here, or the channel failed). */
export type LiveMode = 'realtime' | 'polling';

/**
 * What a Realtime channel's status means for "off now". `current` is false for a channel removed with an earlier place
 * or account (its CLOSED comes after the switch): that one changes nothing.
 */
export function channelMode(status: string, current: boolean): LiveMode | null {
  if (!current) return null;
  if (status === 'SUBSCRIBED') return 'realtime';
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') return 'polling';
  return null;
}

/** The wait before the next fetch: `pollMs.owner` while polling, `safetyMs` beside a subscription, with the backoff. */
export const liveDelay = (mode: LiveMode, failures: number, random?: () => number): number =>
  pollDelay(mode === 'realtime' ? LIVE_REFRESH.safetyMs : LIVE_REFRESH.pollMs.owner, failures, random);

/** The schema's targets behind what the owner picked: a group is each of its choices. */
export function targetsOf(t: OffTarget, options: readonly Pick<AddonOptionRow, 'id' | 'group_id'>[]): { kind: TargetKind; id: string }[] {
  return t.kind === 'group' ? options.filter((o) => o.group_id === t.id).map((o) => ({ kind: 'option', id: o.id })) : [{ kind: t.kind, id: t.id }];
}

// ---------------------------------------------------------------- the calls
/** An RPC by name with its `p_` arguments; resolves to the answer, rejects on a transport or permission failure. */
export type RpcCall = (fn: string, args: Record<string, unknown>) => Promise<unknown>;

/** What a call answers once a refusal (`{ ok: false, code }`) has been thrown as a V2Error. */
type Answered<R> = Extract<R, { ok: true }>;

function checked<T>(v: { ok: true; value: T } | { ok: false; errors: readonly { code: string; path: string }[] }): T {
  if (!v.ok) throw new V2Error(v.errors[0]!.code, v.errors);
  return v.value;
}

export function availabilityApi(call: RpcCall) {
  /** Take one target off until `until`, or bring it back now (`until: null`). The newest answer counts. */
  async function set(input: SetAvailabilityInput): Promise<Answered<SetAvailabilityReply>> {
    const i = checked(validateSetAvailability(input));
    return refusal(await call('set_availability', { p_venue: i.venueId, p_target_kind: i.target.kind, p_target_id: i.target.id, p_until: i.until, p_note: i.note ?? null })) as Answered<SetAvailabilityReply>;
  }
  return {
    set,
    /**
     * Several targets with one answer (a whole group): every call is made; when one is refused the first refusal is
     * thrown after the others finished, and the screen reloads what is stored.
     */
    async setAll(venueId: string, targets: readonly { kind: TargetKind; id: string }[], until: UntilSpec | null): Promise<Answered<SetAvailabilityReply>[]> {
      if (targets.length === 0) throw new V2Error('target_unknown');
      const out = await Promise.allSettled(targets.map((target) => set({ venueId, target, until })));
      const bad = out.find((x) => x.status === 'rejected');
      if (bad) throw (bad as PromiseRejectedResult).reason;
      return out.map((x) => (x as PromiseFulfilledResult<Answered<SetAvailabilityReply>>).value);
    },
    async restoreToday(venueId: string): Promise<Answered<RestoreTodayReply>> {
      const i = checked(validateRestoreToday({ venueId }));
      return refusal(await call('restore_today', { p_venue: i.venueId })) as Answered<RestoreTodayReply>;
    },
  };
}
