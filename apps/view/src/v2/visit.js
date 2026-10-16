/* One visit's suggestions (F06 on the guest's phone): which one is on screen, how often each rule was shown, which
   ones the guest dismissed. In memory only: never stored, never sent (the events say what happened, not to whom).
   The choice itself is matchSuggestion's (the contracts: one at a time, never in the basket, sold out or filtered
   out, priority, cap, never chained); this keeps its inputs `shown` and `dismissed` true to what the guest saw. */
import { matchSuggestion, recordShown } from '@mana/contracts';

/**
 * @param rules the snapshot's upsell rules     @param menu indexMenu(snapshot)
 * Every offer replaces what was on screen: a suggestion the guest ignored simply goes, and is not "dismissed".
 */
export function createVisit(rules, menu) {
  let shown = new Map(), pending = null;
  const dismissed = new Set();
  return {
    /**
     * The suggestion for this moment, or null. `where` (sheet, float, tray) and `lineKey` (the line an "add"
     * suggestion is about) travel with it for the page. Counted as shown once, here.
     */
    offer(trigger, { dishId = null, selection = null, basket, unavailable, filteredOut, fromSuggestion = false, now = Date.now(), where = null, lineKey = null }) {
      pending = null;
      const sug = matchSuggestion(rules, { trigger, menu, dishId, selection, basket, now, unavailable, filteredOut, shown, dismissed, fromSuggestion });
      if (!sug) return null;
      shown = recordShown(shown, sug.ruleId);
      pending = { ruleId: sug.ruleId, suggest: sug.suggest, line: sug.line, trigger, dishId, selection, where, lineKey, seen: shown.get(sug.ruleId) };
      return pending;
    },
    /**
     * Does the suggestion on screen still qualify, with what is true now (an option or dish sold out, the filter, the
     * guest's own choices, the basket)? The same matchSuggestion, for that one rule, with its own showing not counted
     * twice. One that no longer does goes, unrecorded. `selection`: the choices it is about now (the sheet's, or the
     * line's), else those it was offered with.
     */
    still({ selection, basket, unavailable, filteredOut, now = Date.now() }) {
      const p = pending;
      if (!p) return false;
      const rule = rules.find((r) => r.id === p.ruleId), seen = new Map(shown);
      seen.set(p.ruleId, Math.max(0, (seen.get(p.ruleId) || 0) - 1));
      const ok = !!rule && !!matchSuggestion([rule], { trigger: p.trigger, menu, dishId: p.dishId, selection: selection === undefined ? p.selection : selection, basket, now,
        unavailable, filteredOut, shown: seen, dismissed, fromSuggestion: false });
      if (!ok) pending = null;
      return ok;
    },
    /** The guest took it: it leaves the screen (what it adds is the page's to do). */
    accept() { const p = pending; pending = null; return p; },
    /** The guest said no: it leaves the screen and that rule stays quiet for the rest of the visit. */
    dismiss() { const p = pending; pending = null; if (p) dismissed.add(p.ruleId); return p; },
    /** It no longer applies (the sheet closed, the guest moved on, or chose it themselves): it goes, unrecorded. */
    drop() { pending = null; },
    get pending() { return pending; },
    /** A new revision of the menu mid-visit: its rules from now on; what the guest saw and dismissed still counts. */
    use(nextRules, nextMenu) { rules = nextRules; menu = nextMenu; pending = null; },
    /** What this visit remembers, for tests and the page's debugging hook. */
    memory: () => ({ shown: Object.fromEntries(shown), dismissed: [...dismissed] })
  };
}
