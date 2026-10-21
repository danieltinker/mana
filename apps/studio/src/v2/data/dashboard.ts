// The owner's dashboard (F08) as the phone shows it, from my_dashboard's reply (ClientDashboard v2, @mana/contracts):
// whether anyone came, the bars of the chart (every day of the range, or every minute of the last hour), a clean top
// for its axis, shares, and where each nudge leads. Every number is the database's; nothing here invents one: a day or
// a minute the reply does not name is a zero, never an estimate. Pure.
import type { ClientDashboard, DashboardTotals, Nudge, OnboardingStep } from '@mana/contracts';

/** One bar: a local day ('YYYY-MM-DD') or a UTC minute (ISO), its menu opens, and whether a cap made it a floor. */
export type Bar = { readonly at: string; readonly value: number; readonly capped: boolean };

/** Did any guest do anything in the range? All zero is "no visits yet", not a chart of zeros. */
export const hasVisits = (t: DashboardTotals): boolean => Object.values(t).some((n) => n > 0);

/** Menu opens per day of the range, oldest first (the database sends every day, zeros included). */
export function dayBars(d: Pick<ClientDashboard, 'days'>): Bar[] {
  return d.days.map((x) => ({ at: x.day, value: x.opens, capped: x.capped }));
}

const MINUTE = 60_000;

/**
 * Menu opens per minute of the last hour: the sixty minutes ending with the minute of `generatedAt`, oldest first.
 * The database sends only the minutes that had something (`lastHour` is sparse), so the others are zero.
 */
export function minuteBars(d: Pick<ClientDashboard, 'lastHour' | 'generatedAt'>): Bar[] {
  const end = Math.floor(Date.parse(d.generatedAt) / MINUTE) * MINUTE;
  const by = new Map(d.lastHour.map((m) => [Math.floor(Date.parse(m.minute) / MINUTE) * MINUTE, m.opens] as const));
  return Array.from({ length: 60 }, (_, i) => {
    const t = end - (59 - i) * MINUTE;
    return { at: new Date(t).toISOString(), value: by.get(t) ?? 0, capped: false };
  });
}

/** The axis top: the smallest of 1, 2, 5 × 10ⁿ at or above the highest value (1 when everything is zero). */
export function axisTop(max: number): number {
  if (!(max > 1)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

/** Which bars carry their number on the chart: never one on every bar; the highest (the latest of equals) and the
 * latest bar, when they are not zero. Every value is in the table under the chart. */
export function labelledBars(bars: readonly Bar[]): ReadonlySet<number> {
  const out = new Set<number>();
  let top = -1;
  bars.forEach((b, i) => { if (b.value > 0 && (top < 0 || b.value >= bars[top]!.value)) top = i; });
  if (top >= 0) out.add(top);
  const last = bars.length - 1;
  if (last >= 0 && bars[last]!.value > 0) out.add(last);
  return out;
}

/** A part of a whole as a whole percent, or null when there is nothing to divide (never "0 %" of nothing). */
export const share = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 100) : null);

// ---------------------------------------------------------------- where each nudge leads
/**
 * The screen that fixes an onboarding step, while the onboarding lane's own screens (`onboarding/<step>`) do not exist.
 * null: no screen of this app fixes it yet (the import review, photos on a v2 dish, the place's style, the phone test).
 */
const STEP_SCREEN: Readonly<Record<OnboardingStep, string | null>> = {
  venue: null, menu: 'menu', review: null, addons: 'addons', photos: null, hours: 'hours', style: null, test: null, publish: 'publish',
};

/**
 * The address (without '#/') a nudge's tap opens: the screen that fixes it, at its first target. null when no screen of
 * this app fixes it yet; the nudge is then shown without a link. `hasScreen(path)` says whether a screen exists, so the
 * onboarding lane's screens are used as soon as they are there.
 */
export function nudgeHref(n: Nudge, hasScreen: (path: string) => boolean): string | null {
  const first = n.targets[0];
  switch (n.code) {
    case 'approval_pending': return 'publish';
    case 'onboarding_step': {
      const step = first?.kind === 'step' ? (first.id as OnboardingStep) : null;
      if (!step) return null;
      if (hasScreen('onboarding')) return 'onboarding/' + step;
      return STEP_SCREEN[step] ?? null;
    }
    case 'import_waiting': return hasScreen('onboarding') ? 'onboarding/review' : null;
    case 'case_waiting_owner': return 'help';
    case 'dish_no_price':
    case 'dish_no_photo': return first?.kind === 'dish' ? 'menu/d/' + first.id : 'menu';
    case 'group_without_limits': return first?.kind === 'group' ? 'addons/' + first.id : 'addons';
  }
}
