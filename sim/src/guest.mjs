// A guest bot: a diner's phone. Anonymous (the anon key only), it does what the guest menu does: public_menu(slug) for
// the snapshot and the live overlay, the contracts for availability, prices and suggestions, track_events for counts.
// It sends no name, phone, note, visitor id or session id: there is no field for one (and track_events refuses them).
import {
  allDishes, defaultSelection, indexMenu, matchSuggestion, menuAvailability, newEventId, priceDish, pricingContext, recordShown, unavailableOf,
} from '@mana/contracts';
import { asAnon } from './client.mjs';
import { autoSelection, chosenOptions, withOption } from './choices.mjs';
import { isoAt, realClock } from './clock.mjs';
import { Ledger } from './ledger.mjs';

export class GuestBot {
  /**
   * @param target the stack ({ apiUrl, anonKey })
   * @param o.ip      the phone's address (the local gateway passes it on as the edge would); null = this machine's
   * @param o.lang    'he' | 'en' (what the menu opens in)
   * @param o.src     'qr' | 'link' (how the menu was opened)
   * @param o.clock   { now(), advance(ms) } (clock.mjs); event times come from it, availability from the wall clock
   * @param o.filter  a tag the guest filters by ('vegan', …): other dishes are "filtered out"
   * @param o.tz      the time zone the phone writes its event times in (with that offset)
   */
  constructor(target, { ip = null, lang = 'he', src = 'qr', clock = realClock, filter = null, tz = 'Asia/Jerusalem', newId = newEventId, includeClosed = false } = {}) {
    this.api = asAnon(target, { ip });
    Object.assign(this, { lang, src, clock, filter, tz, newId, includeClosed });
    this.state = null;
    this.queue = [];
    this.sent = [];
    this.ledger = new Ledger();
    this.results = { accepted: 0, duplicates: 0, capped: 0, rejected: [] };
    this.basket = [];
    this.shown = new Map();
    this.dismissed = new Set();
    this.pending = null;
    this.sheet = null;
    this.violations = [];
    this.actions = [];
    this.uncertain = false;
  }

  // ---- the menu
  /** Opens the menu (menu_opened); `track: false` = a phone that is already on it (no event). */
  async open(slug, { track = true } = {}) {
    this.slug = slug;
    const r = await this.api.rpc('public_menu', { p_slug: slug });
    this.state = r.state;
    this.response = r;
    if (r.state !== 'ok') return r;
    this.load(r);
    if (track) this.emit('menu_opened', { src: this.src, lang: this.lang, revision: r.snapshot.revision });
    return r;
  }

  /** The live overlay again (what the phone polls): sold out, restored, hours. No event. */
  async refresh() {
    const r = await this.api.rpc('public_menu', { p_slug: this.slug });
    this.state = r.state;
    this.response = r;
    if (r.state === 'ok') this.load(r);
    return r;
  }

  load(r) {
    this.snapshot = r.snapshot;
    this.live = r.live;
    this.menu = indexMenu(r.snapshot);
    this.recompute();
  }

  recompute(now = Date.now()) {
    this.av = menuAvailability(this.snapshot, this.live, now);
    this.unavailable = unavailableOf(this.av, this.includeClosed);
    this.ctx = pricingContext(this.snapshot, this.unavailable);
    this.filteredOut = new Set(this.filter ? allDishes(this.snapshot).filter(({ dish }) => !dish.tags.includes(this.filter)).map(({ dish }) => dish.id) : []);
  }

  dish(id) {
    const d = this.menu.dishes.get(id);
    if (!d) throw new Error('no dish ' + id + ' on this menu');
    return d;
  }

  /** What the overlay says about a dish now: { available } or { available: false, reason, back }. */
  availability(dishId) { return this.av.dishes.get(dishId); }

  canChoose(dishId) { return !this.unavailable.dishes.has(dishId) && this.dish(dishId).price !== null; }

  /** Dishes the guest can open (priced, not hidden by the filter), in menu order. */
  browsable() {
    return allDishes(this.snapshot).map((x) => x.dish).filter((d) => d.price !== null && !this.filteredOut.has(d.id));
  }

  // ---- the dish sheet
  /** Opens a dish's sheet (the owner's defaults, or the guest's own choices) and shows at most one suggestion. */
  view(dishId, { selection = null } = {}) {
    const dish = this.dish(dishId);
    this.emit('dish_viewed', { dishId });
    this.sheet = { dishId, selection: selection ?? defaultSelection(dish, this.ctx) };
    if (selection) for (const c of chosenOptions(selection)) this.emit('addon_chosen', { dishId, groupId: c.groupId, optionId: c.optionId, parentOptionId: c.parentOptionId });
    return this.suggest('sheet', dishId, this.sheet.selection);
  }

  /** One choice in the open sheet (a single-choice group's choice replaces the one before; a nested group's needs its opener). */
  choose(groupId, optionId, { parentOptionId = null, qty = 1 } = {}) {
    const s = this.sheet;
    if (!s) throw new Error('no sheet open');
    const groups = s.selection.groups.map((g) => ({ groupId: g.groupId, options: g.options.map((o) => ({ ...o, nested: o.nested?.map((n) => ({ ...n, options: [...n.options] })) })) }));
    const single = (gid) => this.ctx.groups.get(gid)?.selection === 'single';
    const set = (list, gid, entry) => {
      let g = list.find((x) => x.groupId === gid);
      if (!g) { g = { groupId: gid, options: [] }; list.push(g); }
      if (single(gid)) g.options = [entry];
      else { const i = g.options.findIndex((o) => o.optionId === entry.optionId); if (i >= 0) g.options[i] = entry; else g.options.push(entry); }
    };
    const entry = qty === 1 ? { optionId } : { optionId, qty };
    if (parentOptionId === null) {
      const opt = this.ctx.groups.get(groupId)?.options.find((o) => o.id === optionId);
      const nestedGroup = opt?.opensGroupId ? this.ctx.groups.get(opt.opensGroupId) : null;
      if (nestedGroup) entry.nested = [{ groupId: nestedGroup.id, options: defaultSelectionOf(nestedGroup) }];
      set(groups, groupId, entry);
    } else {
      const opener = groups.flatMap((g) => g.options).find((o) => o.optionId === parentOptionId);
      if (!opener) throw new Error('choose the opener first');
      opener.nested = opener.nested ?? [];
      set(opener.nested, groupId, entry);
    }
    s.selection = { ...s.selection, groups };
    this.emit('addon_chosen', { dishId: s.dishId, groupId, optionId, parentOptionId });
    return s.selection;
  }

  /** The price of the open sheet (or of any dish and selection) as the guest's phone computes it. */
  price(dishId = this.sheet?.dishId, selection = this.sheet?.selection) {
    return priceDish(this.dish(dishId), selection, this.ctx);
  }

  /** "Add to my table": priced first (a dish that cannot be ordered is refused), then at most one suggestion. */
  add({ quantity = 1, fromSuggestion = false } = {}) {
    const s = this.sheet;
    if (!s) throw new Error('no sheet open');
    const sel = { ...s.selection, quantity };
    const p = priceDish(this.dish(s.dishId), sel, this.ctx);
    if (!p.ok) return { ok: false, error: p.error, errors: p.errors };
    this.basket.push({ dishId: s.dishId, selection: sel, unit: p.unit, total: p.total });
    this.emit('basket_added', { dishId: s.dishId, qty: quantity, fromSuggestion });
    this.sheet = null;
    // never chained: matchSuggestion answers null after an accepted suggestion
    const suggestion = this.suggest('add', s.dishId, sel, { fromSuggestion });
    return { ok: true, price: p, suggestion };
  }

  // ---- suggestions (F06): one at a time; never pre-selected or added for the guest
  suggest(trigger, dishId, selection, { fromSuggestion = false } = {}) {
    this.pending = null; // a suggestion the guest ignored simply goes away
    const sug = matchSuggestion(this.snapshot.upsellRules, {
      trigger, menu: this.menu, dishId, selection, basket: this.basket, now: Date.now(), unavailable: this.unavailable,
      filteredOut: this.filteredOut, shown: this.shown, dismissed: this.dismissed, fromSuggestion,
    });
    if (!sug) return null;
    this.check(sug, dishId, selection);
    this.shown = recordShown(this.shown, sug.ruleId);
    this.pending = { ...sug, trigger, dishId: dishId ?? null };
    this.emit('suggestion_shown', { ruleId: sug.ruleId, trigger, dishId: dishId ?? null });
    return this.pending;
  }

  /** Test 10, checked at every suggestion the guest sees: never in the basket, sold out, filtered out or already chosen. */
  check(sug, dishId, selection) {
    const bad = (why) => this.violations.push({ why, ruleId: sug.ruleId, suggest: sug.suggest });
    if (sug.suggest.kind === 'dish') {
      const id = sug.suggest.dishId;
      if (this.basket.some((l) => l.dishId === id)) bad('in_basket');
      if (id === dishId) bad('same_dish');
      if (this.unavailable.dishes.has(id)) bad('unavailable');
      if (this.filteredOut.has(id)) bad('filtered_out');
    } else {
      if (chosenOptions(selection).some((c) => c.optionId === sug.suggest.optionId)) bad('already_chosen');
      if (this.unavailable.options.has(sug.suggest.optionId)) bad('unavailable');
    }
  }

  accept() {
    const s = this.pending;
    if (!s) throw new Error('no suggestion on screen');
    this.pending = null;
    this.emit('suggestion_accepted', { ruleId: s.ruleId, trigger: s.trigger, dishId: s.dishId });
    if (s.suggest.kind === 'dish') {
      // the suggested dish, ready to add with the owner's defaults; then back to the sheet the guest had open
      const back = this.sheet;
      const dish = this.dish(s.suggest.dishId);
      const sel = autoSelection(dish, this.ctx);
      if (!sel) { this.sheet = back; return { ok: false, error: { code: 'dish_unavailable', dishId: dish.id } }; }
      this.sheet = { dishId: dish.id, selection: sel };
      const r = this.add({ fromSuggestion: true });
      this.sheet = back;
      return r;
    }
    // an add-on of the dish in context: added to the open sheet (sheet), or to the line just added (add)
    const { groupId, optionId } = s.suggest;
    if (s.trigger === 'sheet' && this.sheet?.dishId === s.dishId) {
      this.sheet = { ...this.sheet, selection: withOption(this.sheet.selection, groupId, optionId) };
    } else {
      const i = this.basket.findLastIndex((l) => l.dishId === s.dishId);
      if (i < 0) return { ok: false, error: { code: 'line_gone' } };
      const sel = withOption(this.basket[i].selection, groupId, optionId);
      const p = priceDish(this.dish(s.dishId), sel, this.ctx);
      if (!p.ok) return { ok: false, error: p.error };
      this.basket[i] = { ...this.basket[i], selection: sel, unit: p.unit, total: p.total };
    }
    this.emit('addon_chosen', { dishId: s.dishId, groupId, optionId, parentOptionId: null });
    return { ok: true };
  }

  /** Dismissing changes nothing the guest chose; the rule stays quiet for the rest of the visit. */
  dismiss() {
    const s = this.pending;
    if (!s) throw new Error('no suggestion on screen');
    this.pending = null;
    this.dismissed.add(s.ruleId);
    this.emit('suggestion_dismissed', { ruleId: s.ruleId, trigger: s.trigger, dishId: s.dishId });
    return s;
  }

  /** "My table" before checkout (the checkout trigger; ordering itself is phase 2). */
  checkout() { return this.suggest('checkout', null, null); }

  /** Test 2: what in the basket cannot be ordered now, and why (the phone re-prices every line on refresh). */
  basketIssues() {
    const out = [];
    this.basket.forEach((l, index) => {
      const p = priceDish(this.dish(l.dishId), l.selection, this.ctx);
      if (!p.ok) out.push({ index, dishId: l.dishId, error: p.error });
    });
    return out;
  }

  basketTotal() { return this.basket.reduce((s, l) => s + l.total, 0); }

  removeLine(index) { this.basket.splice(index, 1); }

  // ---- events
  emit(name, props) {
    const at = Math.min(this.clock.now(), Date.now());
    this.queue.push({ id: this.newId(), name, venueId: this.snapshot.venueId, at: isoAt(at, this.tz), props });
    this.actions.push(name);
  }

  /** Sends what is queued, 50 at a time; the ledger counts what the database accepted. */
  async flush() {
    while (this.queue.length) {
      const batch = this.queue.splice(0, 50);
      const r = await this.api.rpc('track_events', { p_events: batch });
      if (!r.ok) throw new Error('track_events: ' + JSON.stringify(r));
      const rejected = new Set(r.rejected.map((x) => x.index));
      batch.forEach((e, i) => { if (!rejected.has(i)) this.sent.push(e); });
      // duplicates and capped events are not named one by one: the ledger then cannot be exact, and says so
      if (r.duplicates === 0 && r.capped === 0) batch.forEach((e, i) => { if (!rejected.has(i)) this.ledger.add(e); });
      else this.uncertain = true;
      this.results.accepted += r.accepted;
      this.results.duplicates += r.duplicates;
      this.results.capped += r.capped;
      this.results.rejected.push(...r.rejected.map((x) => ({ ...x, name: batch[x.index].name })));
    }
    return this.results;
  }

  /** Sends exactly these events again (a phone retrying a batch it thinks was lost). */
  async resend(events) {
    const out = { accepted: 0, duplicates: 0, capped: 0, rejected: [] };
    for (let i = 0; i < events.length; i += 50) {
      const r = await this.api.rpc('track_events', { p_events: events.slice(i, i + 50) });
      out.accepted += r.accepted; out.duplicates += r.duplicates; out.capped += r.capped; out.rejected.push(...r.rejected);
    }
    return out;
  }
}

function defaultSelectionOf(group) {
  return group.options.filter((o) => o.default).slice(0, group.max).map((o) => ({ optionId: o.id }));
}
