// The slot for each suggestion rule's numbers (shown, accepted, dismissed) on the rules list. The dashboard lane (F08)
// fills it from my_dashboard's `rules` (RuleNumbers, @mana/contracts) with `setRuleNumbers`, with the period they count
// (the dashboard's range, which the list says); until then it stays null and the list shows no numbers. Dropped with the
// place.
import { signal } from '@preact/signals';
import type { DashboardRange, RuleNumbers } from '@mana/contracts';
import { onReset } from './store.ts';

export const ruleNumbers = signal<ReadonlyMap<string, RuleNumbers> | null>(null);
/** The period the numbers count (today, the last 7 or 30 days on the place's clock); null with no numbers. */
export const ruleNumbersRange = signal<DashboardRange | null>(null);
export const setRuleNumbers = (list: readonly RuleNumbers[] | null, range: DashboardRange | null = null) => {
  ruleNumbers.value = list ? new Map(list.map((r) => [r.ruleId, r] as const)) : null;
  ruleNumbersRange.value = list ? range : null;
};
onReset(() => { ruleNumbers.value = null; ruleNumbersRange.value = null; });
