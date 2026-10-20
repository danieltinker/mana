// The owner bot: what a venue's owner does in the client app, through the same public interfaces (create_venue and
// the other RPCs, the menu tables under RLS with the owner's own JWT).
import { Api, asUser, createUser, signIn } from './client.mjs';

const pick = (t) => ({ he: t?.he ?? '', en: t?.en ?? '' });

export class OwnerBot {
  /** Sign up (local: GoTrue's admin API with a confirmed e-mail), then sign in. */
  static async signUp(target, { email, password = 'sim-owner-pass-1', confirmed = true }) {
    await createUser(target, { email, password, confirmed });
    return new OwnerBot(target, await signIn(target, { email, password }));
  }

  /** An existing account (a manager or a counter added by setup signs in the same way). */
  static async signInAs(target, { email, password = 'sim-owner-pass-1' }) {
    return new OwnerBot(target, await signIn(target, { email, password }));
  }

  constructor(target, session) {
    this.target = target;
    this.session = session;
    this.userId = session.userId;
    /** @type {Api} */
    this.api = asUser(target, session);
    this.venueId = null;
    this.slug = null;
  }

  /** Use a venue this account already belongs to. */
  forVenue(venueId, slug = null) { this.venueId = venueId; this.slug = slug; return this; }

  async createVenue({ slug, name, kind = 'cafe', defaultLang = 'he' }) {
    const r = await this.api.rpc('create_venue', { p_slug: slug, p_name_he: name?.he ?? '', p_name_en: name?.en ?? '', p_kind: kind, p_default_lang: defaultLang });
    if (r.ok) { this.venueId = r.id; this.slug = r.slug; }
    return r;
  }

  updateVenue(patch) { return this.api.update('venues', { id: `eq.${this.venueId}` }, patch); }

  // ---- the menu, table by table (bulk inserts: every row has the same keys)
  async insert(table, rows) {
    const list = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ venue_id: this.venueId, ...r }));
    if (!list.length) return [];
    const out = await this.api.insert(table, list);
    // the seed maps keys to ids by position: make sure the rows came back in the order they were sent
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const ok = out.length === list.length && list.every((r, i) => ['name_he', 'name_en', 'position', 'weekday', 'dish_id', 'group_id', 'section_id']
      .every((k) => !(k in r) || same(r[k], out[i][k])));
    if (!ok) throw new Error(`insert ${table}: the rows did not come back in the order they were sent`);
    return out;
  }

  /** Builds a whole menu from a seed description (sim/src/seed.mjs documents the shape). Returns key → id maps. */
  async buildMenu(seed) {
    const ids = { schedules: {}, sections: {}, dishes: {}, groups: {}, options: {}, rules: {} };
    const need = (map, key, what) => {
      if (key == null) return null;
      if (!(key in map)) throw new Error(`seed: unknown ${what} "${key}"`);
      return map[key];
    };
    const schedules = await this.insert('schedules', (seed.schedules ?? []).map((s) => ({
      kind: s.kind ?? 'day_part', name_he: pick(s.name).he, name_en: pick(s.name).en, windows: s.windows, valid_from: s.validFrom ?? null, valid_to: s.validTo ?? null,
    })));
    (seed.schedules ?? []).forEach((s, i) => { ids.schedules[s.key] = schedules[i].id; });

    const sections = await this.insert('sections', (seed.sections ?? []).map((s, i) => ({
      position: i, name_he: pick(s.name).he, name_en: pick(s.name).en, kind: s.kind ?? 'food', scene: s.scene ?? 'auto', room: s.room ?? null,
      schedule_id: need(ids.schedules, s.schedule ?? null, 'schedule'), hidden: !!s.hidden,
    })));
    (seed.sections ?? []).forEach((s, i) => { ids.sections[s.key] = sections[i].id; });

    const dishRows = [];
    const dishSeeds = [];
    for (const s of seed.sections ?? []) {
      (s.dishes ?? []).forEach((d, i) => {
        dishSeeds.push(d);
        dishRows.push({
          section_id: ids.sections[s.key], position: i, name_he: pick(d.name).he, name_en: pick(d.name).en, desc_he: pick(d.desc).he, desc_en: pick(d.desc).en,
          price: d.price ?? null, price_note_he: pick(d.priceNote).he, price_note_en: pick(d.priceNote).en, tags: d.tags ?? [],
          allergens_he: pick(d.allergens).he, allergens_en: pick(d.allergens).en, stock_id: d.stock ?? null,
          schedule_id: need(ids.schedules, d.schedule ?? null, 'schedule'), hidden: !!d.hidden,
        });
      });
    }
    const dishes = await this.insert('dishes', dishRows);
    dishSeeds.forEach((d, i) => { ids.dishes[d.key] = dishes[i].id; });

    const groups = await this.insert('addon_groups', (seed.groups ?? []).map((g) => ({
      label: g.label ?? '', name_he: pick(g.name).he, name_en: pick(g.name).en, selection: g.selection ?? 'single', min_units: g.min ?? 0, max_units: g.max ?? 1,
    })));
    (seed.groups ?? []).forEach((g, i) => { ids.groups[g.key] = groups[i].id; });

    const optSeeds = [];
    const optRows = [];
    for (const g of seed.groups ?? []) {
      (g.options ?? []).forEach((o, i) => {
        optSeeds.push(o);
        optRows.push({
          group_id: ids.groups[g.key], position: i, name_he: pick(o.name).he, name_en: pick(o.name).en, price: o.price ?? 0, max_qty: o.maxQty ?? 1,
          is_default: !!o.default, opens_group_id: need(ids.groups, o.opens ?? null, 'group'),
        });
      });
    }
    const options = await this.insert('addon_options', optRows);
    optSeeds.forEach((o, i) => { ids.options[o.key] = options[i].id; });

    const attach = [];
    const related = [];
    for (const d of dishSeeds) {
      (d.groups ?? []).forEach((g, i) => {
        const x = typeof g === 'string' ? { group: g } : g;
        attach.push({ dish_id: ids.dishes[d.key], group_id: need(ids.groups, x.group, 'group'), position: i, min_units: x.min ?? null, max_units: x.max ?? null });
      });
      (d.related ?? []).forEach((r, i) => related.push({ dish_id: ids.dishes[d.key], related_dish_id: need(ids.dishes, r, 'dish'), position: i }));
    }
    await this.insert('dish_addon_groups', attach);
    await this.insert('dish_relations', related);

    const match = (m) => ({
      dishes: (m?.dishes ?? []).map((k) => need(ids.dishes, k, 'dish')),
      sections: (m?.sections ?? []).map((k) => need(ids.sections, k, 'section')),
    });
    const rules = await this.insert('upsell_rules', (seed.rules ?? []).map((r) => {
      const scope = r.scope === 'all' || !r.scope ? { kind: 'all', ids: [] }
        : r.scope.dishes ? { kind: 'dish', ids: r.scope.dishes.map((k) => need(ids.dishes, k, 'dish')) }
          : { kind: 'section', ids: r.scope.sections.map((k) => need(ids.sections, k, 'section')) };
      const has = match(r.basketHas), lacks = match(r.basketLacks);
      return {
        label: r.label ?? '', trigger: r.trigger, scope_kind: scope.kind, scope_ids: scope.ids,
        days: r.when?.days ?? [], from_time: r.when?.from ?? null, to_time: r.when?.to ?? null,
        basket_has_dishes: has.dishes, basket_has_sections: has.sections, basket_lacks_dishes: lacks.dishes, basket_lacks_sections: lacks.sections,
        suggest_kind: r.suggest.dish ? 'dish' : 'option',
        suggest_dish_id: r.suggest.dish ? need(ids.dishes, r.suggest.dish, 'dish') : null,
        suggest_option_id: r.suggest.option ? need(ids.options, r.suggest.option, 'option') : null,
        line_he: pick(r.line).he, line_en: pick(r.line).en, priority: r.priority ?? 50, cap: r.cap ?? 1, active: r.active ?? true,
      };
    }));
    (seed.rules ?? []).forEach((r, i) => { ids.rules[r.key] = rules[i].id; });

    const hours = [];
    for (const h of seed.hours ?? []) for (const d of h.days) hours.push({ weekday: d, opens: h.opens, closes: h.closes });
    await this.insert('venue_hours', hours);
    await this.insert('venue_closures', (seed.closures ?? []).map((c) => ({ from_date: c.from, to_date: c.to, note_he: pick(c.note).he, note_en: pick(c.note).en })));
    return ids;
  }

  /** Onboarding steps the owner went through (the client app saves them at every step). */
  setOnboarding(steps, state = 'done') {
    return this.api.update('onboarding_progress', { venue_id: `eq.${this.venueId}`, step: `in.(${steps.join(',')})` }, { state });
  }

  preview() { return this.api.rpc('preview_menu', { p_venue: this.venueId }); }
  publish(note = null) { return this.api.rpc('publish_menu', { p_venue: this.venueId, p_note: note }); }
  restoreRevision(n) { return this.api.rpc('restore_revision', { p_venue: this.venueId, p_revision: n }); }
  unpublish() { return this.api.rpc('unpublish_menu', { p_venue: this.venueId }); }

  /** The revision as published (the owner may read the venue's records). */
  async revision(number) {
    const rows = await this.api.select('menu_revisions', { select: 'number,snapshot,created_at', venue_id: `eq.${this.venueId}`, number: `eq.${number}` });
    return rows[0] ?? null;
  }

  // ---- availability: sold out now / for a while / until opening, and restore
  /** `until`: { kind: 'duration', minutes } | { kind: 'time', at: 'HH:MM' } | { kind: 'next_opening' } | { kind: 'date', date } | { kind: 'indefinite' } */
  async soldOut(targetKind, targetId, until = { kind: 'duration', minutes: 120 }, note = null) {
    const rows = await this.api.insert('availability_overrides', [{ venue_id: this.venueId, target_kind: targetKind, target_id: targetId, until_kind: until.kind, until_spec: until, note }]);
    return rows[0];
  }

  restore(targetKind, targetId) {
    return this.api.update('availability_overrides',
      { venue_id: `eq.${this.venueId}`, target_kind: `eq.${targetKind}`, target_id: `eq.${targetId}`, restored_at: 'is.null' },
      { restored_at: new Date().toISOString() });
  }

  updateDish(dishId, patch) { return this.api.update('dishes', { id: `eq.${dishId}` }, patch); }

  dashboard(range = 'today') { return this.api.rpc('my_dashboard', { p_venue: this.venueId, p_range: range }); }

  /** The activity log as the owner sees it (newest first). */
  activity(limit = 200) {
    return this.api.select('activity_log', { select: 'id,at,actor_kind,via,reason,action,target_table,target_ids,n,detail', venue_id: `eq.${this.venueId}`, order: 'id.desc', limit });
  }

  rollupsDay() {
    return this.api.select('rollups_day', { select: 'day,name,key,demo,n', venue_id: `eq.${this.venueId}`, order: 'day,name,key' });
  }

  /** A support case from the client app's "get help". */
  async askForHelp(topic, subject, body = '') {
    return (await this.api.insert('support_cases', [{ venue_id: this.venueId, topic, subject, body }]))[0];
  }
}
