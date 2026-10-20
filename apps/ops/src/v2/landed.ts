/**
 * After a lost answer (a timeout or a network failure once the call had left), did this page's own write commit?
 *
 * A row's values cannot tell: a value may already have been so (a dish taken off that was off), another person may
 * have made the same change, and some of what a write sets never comes back to the page (an active plan's period end).
 * The log can: every staff write logs one entry in the transaction that makes the change, as the reader (`you`), with
 * the reason as it was sent and what the write set (its action, its target, its state, plan and date, its "until").
 * Found above the newest entry the page had seen at the review (`mark`; log ids only grow): it was made, once. Not
 * found, and the read reaches back to the mark: not made (yet: a slow server may still make it). A read that failed or
 * does not reach back to the mark: unknown. Never "made" on a value alone.
 */
import type { ActForOwnerInput, ActivityEntry, ActivityPage, ActivityQuery } from '@mana/contracts';
import type { Result } from './api.ts';

/** Is the reviewed change there now? */
export type Landed = 'yes' | 'no' | 'unknown';
/** What a check knows of the write it looks for: the reason as sent, and the newest log id seen at the review. */
export type LandedAt = { readonly reason: string; readonly mark: number };

/** The newest log id among `entries` (0 when there is none). */
export const logMark = (entries: readonly { readonly id: number }[]): number => entries.reduce((m, e) => Math.max(m, e.id), 0);

/** The entry a write logs: its action, and what it set (`match`). */
export type Want = { readonly action: string; readonly match?: (e: ActivityEntry) => boolean };

/** `page`: the venue's staff entries, newest first (null: the read failed). */
export function ownEntry(page: ActivityPage | null, at: LandedAt, want: Want): Landed {
  if (!page) return 'unknown';
  const mine = page.entries.some((e) => e.id > at.mark && e.you && e.action === want.action && (e.reason ?? '') === at.reason && (want.match?.(e) ?? true));
  if (mine) return 'yes';
  const reaches = page.next === null || page.entries.some((e) => e.id <= at.mark);
  return reaches ? 'no' : 'unknown';
}

/** Reads the venue's newest staff entries and looks for the write's own. */
export async function checkLog(api: { activity(q: ActivityQuery): Promise<Result<ActivityPage>> }, venueId: string, at: LandedAt, want: Want): Promise<Landed> {
  const r = await api.activity({ venueId, actor: 'staff', limit: 100 });
  return ownEntry(r.ok ? r.data : null, at, want);
}

/** Two times the same to the second (the log keeps whole seconds), or both absent. */
export function sameInstant(a: unknown, b: unknown): boolean {
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Date.parse(a), y = Date.parse(b);
  return !Number.isNaN(x) && !Number.isNaN(y) && Math.floor(x / 1000) === Math.floor(y / 1000);
}

const sameKeys = (logged: unknown, keys: readonly string[]): boolean =>
  Array.isArray(logged) && logged.length === keys.length && [...keys].sort().every((k, i) => logged[i] === k);
const ids = (e: ActivityEntry): readonly string[] => e.targetIds.map((x) => x.toLowerCase());
const has = (e: ActivityEntry, id: unknown): boolean => typeof id === 'string' && ids(e).includes(id.toLowerCase());

/**
 * `act_for_owner`'s own entry (`support.act_for_owner`): the action, and what it names: the target taken off with the
 * kind of its "until", the target brought back, the dish and the columns changed, the step and its state, the case.
 */
export function actWant(input: ActForOwnerInput): Want {
  const p = input.payload as Readonly<Record<string, unknown>>;
  const result = (e: ActivityEntry): Readonly<Record<string, unknown>> =>
    (e.detail.result && typeof e.detail.result === 'object' ? e.detail.result : {}) as Readonly<Record<string, unknown>>;
  return {
    action: 'support.act_for_owner',
    match: (e) => {
      if (e.detail.action !== input.action) return false;
      switch (input.action) {
        case 'availability.set': return has(e, p.targetId) && e.detail.until === (p.until as { kind?: unknown } | undefined)?.kind;
        case 'availability.restore': return has(e, p.targetId);
        case 'dish.update': return has(e, p.dishId) && sameKeys(e.detail.patchKeys, Object.keys((p.patch ?? {}) as object));
        case 'onboarding.set': return result(e).step === p.step && result(e).state === p.state;
        case 'support_case.update': return has(e, p.caseId);
        default: return false;
      }
    },
  };
}
