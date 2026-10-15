/**
 * Runtime validation of the published snapshot v2. Hand-written, no dependencies.
 *
 * Unknown fields are ignored (a reader of v2 accepts what a later writer adds). Every problem is reported with a
 * stable code and a path; the database's `app.validate_snapshot(jsonb)` uses the same codes for the structural rules
 * (supabase/tests checks the two agree on a set of broken menus), so `publish_menu` refuses exactly what this refuses.
 *
 * Codes: version, type, id_invalid, id_duplicate, slug_invalid, name_missing, enum_invalid, price_invalid,
 * ref_unknown, related_self, addon_duplicate, limits_invalid, limits_loosened, single_max, min_unreachable,
 * options_empty, option_qty_invalid, opener_qty, opens_self, nesting_too_deep, defaults_exceed, window_invalid,
 * date_invalid, rule_scope_empty, rule_condition_empty, rule_option_needs_dish, rule_option_group, priority_invalid,
 * cap_invalid, too_many, locale_invalid, url_invalid, path_invalid, time_zone_invalid, color_invalid, asset_invalid,
 * text_too_long.
 *
 * `lintSnapshotV2` (below) finds what is valid but will not behave as the owner expects; publish returns those as
 * warnings, never as errors. The database's `app.lint_snapshot` gives the same warnings.
 */
import { COLOR_RE, Issues, isBlank, isInt, isObject, isString, isUuid, oneOf, SLUG_RE, type Issue, type Validation } from './common.ts';
import {
  LIMITS, RELIEF_CLASSES, ROOMS, SCENES, SCHEDULE_KINDS, SECTION_KINDS, SELECTIONS, SOLD_OUT_DISPLAY, TAGS, TRIGGERS,
  VENUE_KINDS, VENUE_MODES,
} from './enums.ts';
import type { DishV2, SnapshotV2 } from './snapshot.ts';
import { isHHMM, isLocalDate, isTimeZone, isWeekday } from './time.ts';

type Obj = Record<string, unknown>;
const LANGS = ['he', 'en'] as const;
const STOCK_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const TEMPLATE_RE = /^[a-z0-9-]{1,40}$/;

function text(x: Issues, v: unknown, path: string, max: number, needName = false): void {
  if (!isObject(v) || !isString(v.he) || !isString(v.en)) {
    x.add('type', path, 'expected {he,en} strings');
    return;
  }
  if (v.he.length > max || v.en.length > max) x.add('text_too_long', path);
  if (needName && isBlank(v.he) && isBlank(v.en)) x.add('name_missing', path);
}

/**
 * A storage path relative to the snapshot's assetBase: 1–300 characters, not starting with "/", and no "..", "//",
 * ":" (so no scheme or host can be smuggled in) or backslash. The database adds that it starts with the venue's folder.
 */
export function isRelPath(s: unknown): s is string {
  return isString(s) && s.length > 0 && s.length <= 300 && !s.startsWith('/') && !s.includes('..') && !s.includes('//') &&
    !s.includes(':') && !s.includes('\\');
}

function pathOrNull(x: Issues, v: unknown, path: string): void {
  if (v !== null && !isRelPath(v)) x.add('path_invalid', path);
}

function httpsOrNull(x: Issues, v: unknown, path: string): void {
  if (v === null) return;
  if (!isString(v) || !/^https:\/\/\S+$/.test(v) || v.length > 300) x.add('url_invalid', path);
}

function strOrNull(x: Issues, v: unknown, path: string, max: number): void {
  if (v === null) return;
  if (!isString(v)) x.add('type', path);
  else if (v.length > max) x.add('text_too_long', path);
}

function uuidList(x: Issues, v: unknown, path: string, known: ReadonlySet<string> | null, max = 400): string[] {
  if (!Array.isArray(v)) {
    x.add('type', path);
    return [];
  }
  if (v.length > max) x.add('too_many', path);
  const seen = new Set<string>();
  v.forEach((id, i) => {
    if (!isUuid(id)) x.add('id_invalid', `${path}[${i}]`);
    else if (seen.has(id)) x.add('id_duplicate', `${path}[${i}]`);
    else {
      seen.add(id);
      if (known && !known.has(id)) x.add('ref_unknown', `${path}[${i}]`);
    }
  });
  return [...seen];
}

function windows(x: Issues, v: unknown, path: string): void {
  if (!Array.isArray(v) || v.length === 0) {
    x.add('window_invalid', path, 'at least one window');
    return;
  }
  if (v.length > LIMITS.windows) x.add('too_many', path);
  v.forEach((w, i) => {
    const p = `${path}[${i}]`;
    if (!isObject(w)) return void x.add('window_invalid', p);
    if (!Array.isArray(w.days) || w.days.length === 0 || !w.days.every(isWeekday) || new Set(w.days).size !== w.days.length)
      x.add('window_invalid', `${p}.days`);
    if (!isHHMM(w.from) || !isHHMM(w.to)) x.add('window_invalid', `${p}.from`);
  });
}

function asset(x: Issues, v: unknown, path: string): void {
  if (v === null) return;
  if (!isObject(v)) return void x.add('asset_invalid', path);
  const rel = isRelPath;
  if (v.state === 'relief') {
    const e = v.e, h = v.h;
    if (!rel(v.color) || !rel(v.aux) || !rel(v.thumb) || !oneOf(RELIEF_CLASSES, v.kind)) x.add('asset_invalid', path);
    if (typeof e !== 'number' || !(e > 5 && e <= 90) || typeof h !== 'number' || !(h >= 0)) x.add('asset_invalid', path);
  } else if (v.state === 'photo') {
    if (!rel(v.color) || !rel(v.thumb)) x.add('asset_invalid', path);
  } else if (v.state === 'stock') {
    if (!isString(v.id) || !STOCK_RE.test(v.id)) x.add('asset_invalid', path);
  } else x.add('asset_invalid', path);
}

export function validateSnapshotV2(raw: unknown): Validation<SnapshotV2> {
  const x = new Issues();
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  if (raw.v !== 2) return { ok: false, errors: [{ code: 'version', path: 'v' }] };
  const s = raw as Obj;

  if (!isUuid(s.venueId)) x.add('id_invalid', 'venueId');
  if (!isString(s.slug) || !SLUG_RE.test(s.slug)) x.add('slug_invalid', 'slug');
  if (!isInt(s.revision) || s.revision < 0) x.add('type', 'revision');
  if (!isString(s.publishedAt) || Number.isNaN(Date.parse(s.publishedAt))) x.add('type', 'publishedAt');
  if (!isString(s.assetBase) || !/^https?:\/\/\S+\/$/.test(s.assetBase)) x.add('url_invalid', 'assetBase');

  // ---- venue
  const v = s.venue;
  if (!isObject(v)) x.add('type', 'venue');
  else {
    text(x, v.name, 'venue.name', 80, true);
    text(x, v.area, 'venue.area', 80);
    text(x, v.cuisine, 'venue.cuisine', 80);
    if (!oneOf(VENUE_KINDS, v.kind)) x.add('enum_invalid', 'venue.kind');
    if (!oneOf(VENUE_MODES, v.mode)) x.add('enum_invalid', 'venue.mode');
    pathOrNull(x, v.logo, 'venue.logo');
    httpsOrNull(x, v.orderUrl, 'venue.orderUrl');
    httpsOrNull(x, v.bookUrl, 'venue.bookUrl');
    strOrNull(x, v.phone, 'venue.phone', 40);
    if (!oneOf(SOLD_OUT_DISPLAY, v.soldOut)) x.add('enum_invalid', 'venue.soldOut');
    if (!isTimeZone(v.timeZone)) x.add('time_zone_invalid', 'venue.timeZone');
  }

  // ---- locale, pricing, theme
  const loc = s.locale;
  if (!isObject(loc) || !Array.isArray(loc.langs) || loc.langs.length === 0 || !loc.langs.every((l) => oneOf(LANGS, l)) ||
      new Set(loc.langs).size !== loc.langs.length || !oneOf(LANGS, loc.default) || !loc.langs.includes(loc.default) || loc.currency !== 'ILS')
    x.add('locale_invalid', 'locale');
  const pr = s.pricing;
  if (!isObject(pr) || pr.includesVat !== true || !isInt(pr.vatBasisPoints) || pr.vatBasisPoints < 0 || pr.vatBasisPoints > 10000)
    x.add('type', 'pricing');
  const th = s.theme;
  if (!isObject(th)) x.add('type', 'theme');
  else {
    if (!isString(th.accent) || !COLOR_RE.test(th.accent)) x.add('color_invalid', 'theme.accent');
    if (!isString(th.surface) || th.surface.length > 40) x.add('type', 'theme.surface');
    if (th.template !== null && (!isString(th.template) || !TEMPLATE_RE.test(th.template))) x.add('type', 'theme.template');
    pathOrNull(x, th.tableImg, 'theme.tableImg');
  }

  // ---- schedules
  const scheduleIds = new Set<string>();
  if (!Array.isArray(s.schedules)) x.add('type', 'schedules');
  else {
    if (s.schedules.length > LIMITS.schedules) x.add('too_many', 'schedules');
    s.schedules.forEach((sc, i) => {
      const p = `schedules[${i}]`;
      if (!isObject(sc)) return void x.add('type', p);
      if (!isUuid(sc.id)) x.add('id_invalid', `${p}.id`);
      else if (scheduleIds.has(sc.id)) x.add('id_duplicate', `${p}.id`);
      else scheduleIds.add(sc.id);
      if (!oneOf(SCHEDULE_KINDS, sc.kind)) x.add('enum_invalid', `${p}.kind`);
      text(x, sc.name, `${p}.name`, 60);
      windows(x, sc.windows, `${p}.windows`);
      for (const k of ['validFrom', 'validTo'] as const) if (sc[k] !== null && !isLocalDate(sc[k])) x.add('date_invalid', `${p}.${k}`);
      if (isLocalDate(sc.validFrom) && isLocalDate(sc.validTo) && sc.validFrom > sc.validTo) x.add('date_invalid', `${p}.validTo`);
    });
  }

  // ---- add-on groups (first, so dishes can be checked against them)
  const groups = new Map<string, Obj>();
  const optionGroup = new Map<string, string>();
  const capacity = new Map<string, number>();
  if (!Array.isArray(s.addonGroups)) x.add('type', 'addonGroups');
  else {
    if (s.addonGroups.length > LIMITS.addonGroups) x.add('too_many', 'addonGroups');
    s.addonGroups.forEach((g, i) => {
      const p = `addonGroups[${i}]`;
      if (!isObject(g)) return void x.add('type', p);
      if (!isUuid(g.id)) return void x.add('id_invalid', `${p}.id`);
      if (groups.has(g.id)) return void x.add('id_duplicate', `${p}.id`);
      groups.set(g.id, g);
      text(x, g.name, `${p}.name`, 60, true);
      if (!oneOf(SELECTIONS, g.selection)) x.add('enum_invalid', `${p}.selection`);
      if (!isInt(g.min) || !isInt(g.max) || g.min < 0 || g.max < 1 || g.min > g.max) x.add('limits_invalid', p);
      if (g.selection === 'single' && g.max !== 1) x.add('single_max', p);
      if (!Array.isArray(g.options) || g.options.length === 0) return void x.add('options_empty', `${p}.options`);
      if (g.options.length > LIMITS.optionsPerGroup) x.add('too_many', `${p}.options`);
      let units = 0;
      let defaults = 0;
      g.options.forEach((o, j) => {
        const q = `${p}.options[${j}]`;
        if (!isObject(o)) return void x.add('type', q);
        if (!isUuid(o.id)) x.add('id_invalid', `${q}.id`);
        else if (optionGroup.has(o.id)) x.add('id_duplicate', `${q}.id`);
        else optionGroup.set(o.id, g.id as string);
        text(x, o.name, `${q}.name`, 60, true);
        if (!isInt(o.price) || o.price < 0 || o.price > LIMITS.price) x.add('price_invalid', `${q}.price`);
        if (!isInt(o.maxQty) || o.maxQty < 1 || o.maxQty > LIMITS.optionQuantity) x.add('option_qty_invalid', `${q}.maxQty`);
        else units += o.maxQty;
        if (typeof o.default !== 'boolean') x.add('type', `${q}.default`);
        else if (o.default) defaults += 1;
        if (o.opensGroupId !== null) {
          if (!isUuid(o.opensGroupId)) x.add('id_invalid', `${q}.opensGroupId`);
          else if (o.opensGroupId === g.id) x.add('opens_self', `${q}.opensGroupId`);
          if (o.maxQty !== 1) x.add('opener_qty', `${q}.maxQty`);
        }
      });
      capacity.set(g.id, units);
      if (isInt(g.max) && defaults > g.max) x.add('defaults_exceed', p);
      // a group whose minimum its own options cannot reach (matters most for a nested group, which no dish limits)
      if (isInt(g.min) && g.min > units) x.add('min_unreachable', p);
    });
    // nesting: an option may open a group whose options open nothing (one level)
    s.addonGroups.forEach((g, i) => {
      if (!isObject(g) || !Array.isArray(g.options)) return;
      g.options.forEach((o, j) => {
        if (!isObject(o) || !isUuid(o.opensGroupId) || o.opensGroupId === g.id) return;
        const nested = groups.get(o.opensGroupId);
        const q = `addonGroups[${i}].options[${j}].opensGroupId`;
        if (!nested) return void x.add('ref_unknown', q);
        if (Array.isArray(nested.options) && nested.options.some((n) => isObject(n) && n.opensGroupId !== null && n.opensGroupId !== undefined))
          x.add('nesting_too_deep', q);
      });
    });
  }

  // ---- sections and dishes
  const dishIds = new Set<string>();
  const sectionIds = new Set<string>();
  const dishRefs: Array<{ path: string; id: string; related: unknown }> = [];
  if (!Array.isArray(s.sections)) x.add('type', 'sections');
  else {
    if (s.sections.length > LIMITS.sections) x.add('too_many', 'sections');
    s.sections.forEach((sec, i) => {
      const p = `sections[${i}]`;
      if (!isObject(sec)) return void x.add('type', p);
      if (!isUuid(sec.id)) x.add('id_invalid', `${p}.id`);
      else if (sectionIds.has(sec.id)) x.add('id_duplicate', `${p}.id`);
      else sectionIds.add(sec.id);
      text(x, sec.name, `${p}.name`, 60, true);
      if (!oneOf(SECTION_KINDS, sec.kind)) x.add('enum_invalid', `${p}.kind`);
      if (!oneOf(SCENES, sec.scene)) x.add('enum_invalid', `${p}.scene`);
      if (sec.room !== null && !oneOf(ROOMS, sec.room)) x.add('enum_invalid', `${p}.room`);
      if (sec.scheduleId !== null && !(isUuid(sec.scheduleId) && scheduleIds.has(sec.scheduleId))) x.add('ref_unknown', `${p}.scheduleId`);
      if (!Array.isArray(sec.dishes)) return void x.add('type', `${p}.dishes`);
      sec.dishes.forEach((d, j) => {
        const q = `${p}.dishes[${j}]`;
        if (!isObject(d)) return void x.add('type', q);
        if (!isUuid(d.id)) x.add('id_invalid', `${q}.id`);
        else if (dishIds.has(d.id)) x.add('id_duplicate', `${q}.id`);
        else dishIds.add(d.id);
        text(x, d.name, `${q}.name`, LIMITS.nameLength, true);
        text(x, d.desc, `${q}.desc`, LIMITS.descLength);
        text(x, d.allergens, `${q}.allergens`, 300);
        if (d.price !== null) {
          if (!isObject(d.price) || !isInt(d.price.amount) || d.price.amount < 0 || d.price.amount > LIMITS.price) x.add('price_invalid', `${q}.price`);
          else text(x, d.price.note, `${q}.price.note`, LIMITS.noteLength);
        }
        if (!Array.isArray(d.tags) || !d.tags.every((t) => oneOf(TAGS, t)) || new Set(d.tags).size !== d.tags.length) x.add('enum_invalid', `${q}.tags`);
        if (!isObject(d.details)) x.add('type', `${q}.details`);
        else if (JSON.stringify(d.details).length > LIMITS.detailsBytes) x.add('text_too_long', `${q}.details`);
        asset(x, d.asset, `${q}.asset`);
        if (d.scheduleId !== null && !(isUuid(d.scheduleId) && scheduleIds.has(d.scheduleId))) x.add('ref_unknown', `${q}.scheduleId`);
        if (!Array.isArray(d.addons)) x.add('type', `${q}.addons`);
        else {
          if (d.addons.length > LIMITS.groupsPerDish) x.add('too_many', `${q}.addons`);
          const seen = new Set<string>();
          d.addons.forEach((a, k) => {
            const r = `${q}.addons[${k}]`;
            if (!isObject(a)) return void x.add('type', r);
            if (!isUuid(a.groupId) || !groups.has(a.groupId)) return void x.add('ref_unknown', `${r}.groupId`);
            if (seen.has(a.groupId)) return void x.add('addon_duplicate', r);
            seen.add(a.groupId);
            const g = groups.get(a.groupId)!;
            if (!isInt(a.min) || !isInt(a.max) || a.min < 0 || a.max < 1 || a.min > a.max) return void x.add('limits_invalid', r);
            if (g.selection === 'single' && a.max !== 1) x.add('single_max', r);
            // a dish may only tighten a group's limits
            else if (isInt(g.min) && isInt(g.max) && g.min <= g.max && (a.min < g.min || a.max > g.max)) x.add('limits_loosened', r);
            if (a.min > (capacity.get(a.groupId) ?? 0)) x.add('min_unreachable', r);
          });
        }
        if (isUuid(d.id)) dishRefs.push({ path: q, id: d.id, related: d.related });
      });
    });
  }
  for (const d of dishRefs) {
    const ids = uuidList(x, d.related, `${d.path}.related`, dishIds, LIMITS.related);
    if (ids.length > LIMITS.related) x.add('too_many', `${d.path}.related`);
    if (ids.includes(d.id)) x.add('related_self', `${d.path}.related`);
  }

  // ---- upsell rules
  if (!Array.isArray(s.upsellRules)) x.add('type', 'upsellRules');
  else {
    if (s.upsellRules.length > LIMITS.rules) x.add('too_many', 'upsellRules');
    const ruleIds = new Set<string>();
    s.upsellRules.forEach((r, i) => {
      const p = `upsellRules[${i}]`;
      if (!isObject(r)) return void x.add('type', p);
      if (!isUuid(r.id)) x.add('id_invalid', `${p}.id`);
      else if (ruleIds.has(r.id)) x.add('id_duplicate', `${p}.id`);
      else ruleIds.add(r.id);
      if (!oneOf(TRIGGERS, r.trigger)) x.add('enum_invalid', `${p}.trigger`);
      const sc = r.scope;
      if (!isObject(sc)) x.add('type', `${p}.scope`);
      else if (sc.kind === 'all') { /* nothing more */ }
      else if (sc.kind === 'dish' || sc.kind === 'section') {
        const ids = uuidList(x, sc.ids, `${p}.scope.ids`, sc.kind === 'dish' ? dishIds : sectionIds);
        if (ids.length === 0) x.add('rule_scope_empty', `${p}.scope`);
      } else x.add('enum_invalid', `${p}.scope.kind`);
      if (r.when !== null) {
        const w = r.when;
        if (!isObject(w) || !Array.isArray(w.days) || !w.days.every(isWeekday) || new Set(w.days).size !== w.days.length ||
            !((w.from === null && w.to === null) || (isHHMM(w.from) && isHHMM(w.to))))
          x.add('window_invalid', `${p}.when`);
      }
      for (const k of ['basketHas', 'basketLacks'] as const) {
        const m = r[k];
        if (m === null) continue; // no condition
        if (!isObject(m)) x.add('type', `${p}.${k}`);
        else {
          const a = uuidList(x, m.dishes, `${p}.${k}.dishes`, dishIds);
          const b = uuidList(x, m.sections, `${p}.${k}.sections`, sectionIds);
          // a condition names something; "no condition" is null (never an empty list, which would read as "always")
          if (Array.isArray(m.dishes) && Array.isArray(m.sections) && a.length + b.length === 0) x.add('rule_condition_empty', `${p}.${k}`);
        }
      }
      const sg = r.suggest;
      if (!isObject(sg)) x.add('type', `${p}.suggest`);
      else if (sg.kind === 'dish') {
        if (!isUuid(sg.dishId) || !dishIds.has(sg.dishId)) x.add('ref_unknown', `${p}.suggest.dishId`);
      } else if (sg.kind === 'option') {
        if (!isUuid(sg.optionId) || !optionGroup.has(sg.optionId)) x.add('ref_unknown', `${p}.suggest.optionId`);
        else if (optionGroup.get(sg.optionId) !== sg.groupId) x.add('rule_option_group', `${p}.suggest.groupId`);
        if (r.trigger === 'checkout') x.add('rule_option_needs_dish', `${p}.suggest`);
      } else x.add('enum_invalid', `${p}.suggest.kind`);
      text(x, r.line, `${p}.line`, LIMITS.ruleLine);
      if (!isInt(r.priority) || r.priority < 0 || r.priority > 100) x.add('priority_invalid', `${p}.priority`);
      if (!isInt(r.cap) || r.cap < 1 || r.cap > LIMITS.ruleCap) x.add('cap_invalid', `${p}.cap`);
      if (typeof r.active !== 'boolean') x.add('type', `${p}.active`);
    });
  }

  return x.ok ? { ok: true, value: raw as unknown as SnapshotV2 } : { ok: false, errors: x.list };
}

/**
 * Warnings for a valid snapshot: rules that can never fire as the owner wrote them.
 * - `rule_suggests_its_trigger`: a rule scoped to a dish suggests that same dish (a suggestion is never what the guest
 *   already has open or in the basket, so it never fires for it);
 * - `rule_option_unreachable`: an add-on suggestion whose group no dish in the rule's scope offers.
 */
export function lintSnapshotV2(s: SnapshotV2): Issue[] {
  const out: Issue[] = [];
  const dishes: Array<{ d: DishV2; section: string }> = [];
  for (const sec of s.sections) for (const d of sec.dishes) dishes.push({ d, section: sec.id });
  s.upsellRules.forEach((r, i) => {
    const p = `upsellRules[${i}]`;
    const inScope = dishes.filter(({ d, section }) =>
      r.scope.kind === 'all' ? true : r.scope.kind === 'dish' ? r.scope.ids.includes(d.id) : r.scope.ids.includes(section));
    if (r.suggest.kind === 'dish' && r.scope.kind === 'dish' && r.scope.ids.includes(r.suggest.dishId)) {
      out.push({ code: 'rule_suggests_its_trigger', path: p });
    }
    if (r.suggest.kind === 'option') {
      const g = r.suggest.groupId;
      if (!inScope.some(({ d }) => d.addons.some((a) => a.groupId === g))) out.push({ code: 'rule_option_unreachable', path: p });
    }
  });
  return out;
}
