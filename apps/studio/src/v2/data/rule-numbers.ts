// The slot for each suggestion rule's numbers (shown, accepted, dismissed) on the rules list. The dashboard lane (F08)
// fills it from my_dashboard's `rules` (RuleNumbers, @mana/contracts) with `setRuleNumbers`; until then it stays null and
// the list shows no numbers. Dropped with the place.
import { signal } from '@preact/signals';
import type { RuleNumbers } from '@mana/contracts';
import { onReset } from './store.ts';

export const ruleNumbers = signal<ReadonlyMap<string, RuleNumbers> | null>(null);
export const setRuleNumbers = (list: readonly RuleNumbers[] | null) => { ruleNumbers.value = list ? new Map(list.map((r) => [r.ruleId, r] as const)) : null; };
onReset(() => { ruleNumbers.value = null; });
