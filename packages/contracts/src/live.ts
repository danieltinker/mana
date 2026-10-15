/**
 * The live overlay that `public_menu(slug)` sends beside the immutable snapshot: what is off right now, the opening
 * hours as they are now, and whether the venue is open. The guest menu combines it with the snapshot through
 * `menuAvailability()`; nothing here needs a publish.
 */
import type { TargetKind } from './enums.ts';
import type { Closure, TimeWindow } from './time.ts';

/** One availability override, as the guest sees it. `until: null` = until the owner restores it. */
export type OffEntry = { readonly kind: TargetKind; readonly id: string; readonly from: string; readonly until: string | null };

export type LiveOverlay = {
  /** The server's clock when it answered (ISO, UTC). */
  readonly at: string;
  /** null when the venue has no opening hours set (then it is never treated as closed). */
  readonly open: boolean | null;
  readonly nextOpening: string | null;
  /** Weekly windows (each opens on its day; `to <= from` runs past midnight) and closed dates from yesterday on. */
  readonly hours: { readonly weekly: readonly TimeWindow[]; readonly closures: readonly Closure[] };
  readonly off: readonly OffEntry[];
};

export const EMPTY_LIVE: LiveOverlay = {
  at: new Date(0).toISOString(),
  open: null,
  nextOpening: null,
  hours: { weekly: [], closures: [] },
  off: [],
};
