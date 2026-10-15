// What the guests did, counted the way the rollups count it (rollupKeys from the contracts), so a scenario can say
// exactly which numbers the owner's dashboard and Halom's back office must show.
import { rollupKeys } from '@mana/contracts';

export class Ledger {
  constructor() {
    /** name → key → n, for the events the database ACCEPTED (not rejected, not duplicates, not capped). */
    this.counts = new Map();
    this.events = 0;
  }

  add(event) {
    this.events += 1;
    let byKey = this.counts.get(event.name);
    if (!byKey) { byKey = new Map(); this.counts.set(event.name, byKey); }
    for (const k of rollupKeys(event.name, event.props)) byKey.set(k, (byKey.get(k) ?? 0) + 1);
  }

  merge(other) {
    for (const [name, byKey] of other.counts) {
      let mine = this.counts.get(name);
      if (!mine) { mine = new Map(); this.counts.set(name, mine); }
      for (const [k, n] of byKey) mine.set(k, (mine.get(k) ?? 0) + n);
    }
    this.events += other.events;
    return this;
  }

  n(name, key = '') { return this.counts.get(name)?.get(key) ?? 0; }

  /** my_dashboard().totals as these events make it. */
  totals() {
    return {
      menuOpens: this.n('menu_opened'), dishViews: this.n('dish_viewed'), addonsChosen: this.n('addon_chosen'), basketAdds: this.n('basket_added'),
      suggestionsShown: this.n('suggestion_shown'), suggestionsAccepted: this.n('suggestion_accepted'), suggestionsDismissed: this.n('suggestion_dismissed'),
    };
  }

  opensBy() {
    return { qr: this.n('menu_opened', 'src:qr'), link: this.n('menu_opened', 'src:link'), he: this.n('menu_opened', 'lang:he'), en: this.n('menu_opened', 'lang:en') };
  }

  rule(ruleId) {
    const k = 'rule:' + ruleId.toLowerCase();
    return { shown: this.n('suggestion_shown', k), accepted: this.n('suggestion_accepted', k), dismissed: this.n('suggestion_dismissed', k) };
  }

  dish(dishId) {
    const k = 'dish:' + dishId.toLowerCase();
    return { views: this.n('dish_viewed', k), adds: this.n('basket_added', k) };
  }

  /** Every (name, key) → n, sorted: what rollups_day must hold for these events (all on one local day). */
  rows() {
    const out = [];
    for (const [name, byKey] of this.counts) for (const [key, n] of byKey) out.push({ name, key, n });
    return out.sort((a, b) => (a.name + '|' + a.key < b.name + '|' + b.key ? -1 : 1));
  }
}
