// Shared by the scenario tests: one fresh local stack per test file (free ports, removed afterwards), and the checks
// that compare what each side sees. Tests read the database directly only as an oracle (to look at stored rows) and
// for setup the README names; everything they assert about behaviour went through the public interfaces.
import { after, before } from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { EXPORT_TABLES } from '@mana/contracts';
import { startStack } from '../stack/start.mjs';
import { halomTeam, ownerWithMenu } from '../src/scenarios.mjs';

/**
 * A stack for this file, then `setup(stack)` once: `const S = useStack(async (stack) => ({ … }))`; inside tests,
 * `S.stack` and `S.ctx` (what setup returned). One hook does both: node:test does not wait for one root `before`
 * before starting the next.
 */
export function useStack(setup = null, opts = {}) {
  const box = { stack: null, ctx: null };
  before(async () => {
    box.stack = await startStack({ ports: 'auto', ...opts });
    if (setup) box.ctx = await setup(box.stack);
  }, { timeout: 180000 });
  after(async () => { await box.stack?.stop(); });
  return box;
}

/** A published, approved venue from a seed, with its owner, ids and Halom's team. */
export async function liveVenue(stack, seed, slug, team = null) {
  const t = team ?? (await halomTeam(stack, slug));
  const { owner, ids } = await ownerWithMenu(stack, seed, { slug, halom: t.admin });
  const pub = await owner.publish('test');
  if (!pub.ok) throw new Error(JSON.stringify(pub));
  if (pub.review === 'pending') {
    const ok = await t.support.approve(owner.venueId, 'Synthetic test venue checked', pub.revision);
    if (!ok.ok) throw new Error(JSON.stringify(ok));
  }
  return { owner, ids, team: t, venueId: owner.venueId, slug };
}

const T = (t) => ({ he: t?.he ?? '', en: t?.en ?? '' });

/**
 * What in a published snapshot differs from the seed it was built from (an empty list = the guest gets exactly what the
 * owner built): sections and dishes in order with names, prices, tags, groups and "goes well with"; the add-on groups
 * with their options, prices, defaults and the nested group an option opens; the rules with their trigger, scope,
 * suggestion, priority and cap.
 */
export function snapshotVsSeed(snap, seed, ids) {
  const out = [];
  const eq = (path, got, want) => { if (!isDeepStrictEqual(got, want)) out.push(`${path}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };
  const visible = (seed.sections ?? []).filter((s) => !s.hidden && (s.dishes ?? []).some((d) => !d.hidden));
  eq('sections', snap.sections.map((s) => s.id), visible.map((s) => ids.sections[s.key]));
  for (const [i, s] of visible.entries()) {
    const got = snap.sections[i];
    if (!got) continue;
    eq(`sections[${i}].name`, got.name, T(s.name));
    eq(`sections[${i}].kind`, got.kind, s.kind ?? 'food');
    eq(`sections[${i}].scheduleId`, got.scheduleId, s.schedule ? ids.schedules[s.schedule] : null);
    const dishes = (s.dishes ?? []).filter((d) => !d.hidden);
    eq(`sections[${i}].dishes`, got.dishes.map((d) => d.id), dishes.map((d) => ids.dishes[d.key]));
    for (const [j, d] of dishes.entries()) {
      const gd = got.dishes[j];
      if (!gd) continue;
      const p = `sections[${i}].dishes[${j}]`;
      eq(p + '.name', gd.name, T(d.name));
      eq(p + '.price', gd.price?.amount ?? null, d.price ?? null);
      eq(p + '.tags', gd.tags, d.tags ?? []);
      eq(p + '.addons', gd.addons.map((a) => a.groupId), (d.groups ?? []).map((g) => ids.groups[typeof g === 'string' ? g : g.group]));
      eq(p + '.related', gd.related, (d.related ?? []).map((k) => ids.dishes[k]));
      eq(p + '.scheduleId', gd.scheduleId, d.schedule ? ids.schedules[d.schedule] : null);
    }
  }
  const groups = new Map(snap.addonGroups.map((g) => [g.id, g]));
  for (const g of seed.groups ?? []) {
    const gg = groups.get(ids.groups[g.key]);
    const reached = snap.sections.some((s) => s.dishes.some((d) => d.addons.some((a) => a.groupId === ids.groups[g.key])))
      || (seed.groups ?? []).some((x) => (x.options ?? []).some((o) => o.opens === g.key));
    if (!gg) { if (reached) out.push(`addonGroups: ${g.key} missing`); continue; }
    eq(`group ${g.key}`, [gg.name, gg.selection, gg.min, gg.max], [T(g.name), g.selection ?? 'single', g.min ?? 0, g.max ?? 1]);
    eq(`group ${g.key}.options`, gg.options.map((o) => [o.id, o.name, o.price, o.maxQty, o.default, o.opensGroupId]),
      (g.options ?? []).map((o) => [ids.options[o.key], T(o.name), o.price ?? 0, o.maxQty ?? 1, !!o.default, o.opens ? ids.groups[o.opens] : null]));
  }
  const rules = new Map(snap.upsellRules.map((r) => [r.id, r]));
  for (const r of seed.rules ?? []) {
    const rr = rules.get(ids.rules[r.key]);
    if (!rr) { out.push(`upsellRules: ${r.key} missing`); continue; }
    const suggest = r.suggest.dish ? { kind: 'dish', dishId: ids.dishes[r.suggest.dish] } : { kind: 'option', optionId: ids.options[r.suggest.option] };
    eq(`rule ${r.key}`, [rr.trigger, rr.priority, rr.cap, rr.suggest.kind, rr.suggest.dishId ?? rr.suggest.optionId, rr.line],
      [r.trigger, r.priority ?? 50, r.cap ?? 1, suggest.kind, suggest.dishId ?? suggest.optionId, T(r.line)]);
  }
  return out;
}

/**
 * What in an export_menu answer differs from the seed the menu was built from (an empty list = exactly the seed's
 * menu, nothing more): every table's rows by id, with the columns the seed sets, and no row the seed does not describe.
 */
export function exportVsSeed(x, seed, ids) {
  const out = [];
  const eq = (path, got, want) => { if (!isDeepStrictEqual(got, want)) out.push(`${path}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`); };
  const byId = (rows) => new Map(rows.map((r) => [r.id, r]));
  const t = x.tables;
  // a JSON object's keys have no order (jsonb sorts them): a reader walks EXPORT_TABLES
  eq('tables', Object.keys(t).sort(), [...EXPORT_TABLES].sort());
  const schedules = byId(t.schedules);
  eq('schedules', t.schedules.length, (seed.schedules ?? []).length);
  for (const s of seed.schedules ?? []) {
    const r = schedules.get(ids.schedules[s.key]);
    eq(`schedule ${s.key}`, r && [r.kind, r.name_he, r.name_en, r.windows], [s.kind ?? 'day_part', T(s.name).he, T(s.name).en, s.windows]);
  }
  eq('sections', t.sections.map((s) => s.id), (seed.sections ?? []).map((s) => ids.sections[s.key]));
  const sections = byId(t.sections), dishes = byId(t.dishes);
  const dishSeeds = (seed.sections ?? []).flatMap((s) => (s.dishes ?? []).map((d, i) => ({ s, d, i })));
  eq('dishes', t.dishes.length, dishSeeds.length);
  (seed.sections ?? []).forEach((s, i) => {
    const r = sections.get(ids.sections[s.key]);
    eq(`section ${s.key}`, r && [r.position, r.name_he, r.name_en, r.kind, r.schedule_id, r.hidden], [i, T(s.name).he, T(s.name).en, s.kind ?? 'food',
      s.schedule ? ids.schedules[s.schedule] : null, !!s.hidden]);
  });
  for (const { s, d, i } of dishSeeds) {
    const r = dishes.get(ids.dishes[d.key]);
    eq(`dish ${d.key}`, r && [r.section_id, r.position, r.name_he, r.name_en, r.desc_he, r.desc_en, r.price, r.tags, r.hidden],
      [ids.sections[s.key], i, T(d.name).he, T(d.name).en, T(d.desc).he, T(d.desc).en, d.price ?? null, d.tags ?? [], !!d.hidden]);
  }
  const groups = byId(t.addon_groups), options = byId(t.addon_options);
  eq('addon_groups', t.addon_groups.length, (seed.groups ?? []).length);
  eq('addon_options', t.addon_options.length, (seed.groups ?? []).reduce((n, g) => n + (g.options ?? []).length, 0));
  for (const g of seed.groups ?? []) {
    const r = groups.get(ids.groups[g.key]);
    eq(`group ${g.key}`, r && [r.label, r.name_he, r.name_en, r.selection, r.min_units, r.max_units, r.limits_confirmed],
      [g.label ?? '', T(g.name).he, T(g.name).en, g.selection ?? 'single', g.min ?? 0, g.max ?? 1, true]);
    (g.options ?? []).forEach((o, i) => {
      const ro = options.get(ids.options[o.key]);
      eq(`option ${o.key}`, ro && [ro.group_id, ro.position, ro.name_he, ro.name_en, ro.price, ro.max_qty, ro.is_default, ro.opens_group_id],
        [ids.groups[g.key], i, T(o.name).he, T(o.name).en, o.price ?? 0, o.maxQty ?? 1, !!o.default, o.opens ? ids.groups[o.opens] : null]);
    });
  }
  const links = (rows, f) => rows.map(f).sort();
  eq('dish_addon_groups', links(t.dish_addon_groups, (r) => `${r.dish_id}>${r.group_id}#${r.position}`),
    links(dishSeeds.flatMap(({ d }) => (d.groups ?? []).map((g, i) => ({ d: ids.dishes[d.key], g: ids.groups[typeof g === 'string' ? g : g.group], i }))), (r) => `${r.d}>${r.g}#${r.i}`));
  eq('dish_relations', links(t.dish_relations, (r) => `${r.dish_id}>${r.related_dish_id}#${r.position}`),
    links(dishSeeds.flatMap(({ d }) => (d.related ?? []).map((k, i) => ({ d: ids.dishes[d.key], r: ids.dishes[k], i }))), (r) => `${r.d}>${r.r}#${r.i}`));
  const rules = byId(t.upsell_rules);
  eq('upsell_rules', t.upsell_rules.length, (seed.rules ?? []).length);
  for (const r of seed.rules ?? []) {
    const rr = rules.get(ids.rules[r.key]);
    eq(`rule ${r.key}`, rr && [rr.label, rr.trigger, rr.suggest_kind, rr.suggest_dish_id, rr.suggest_option_id, rr.priority, rr.cap, rr.line_he, rr.line_en, rr.active],
      [r.label ?? '', r.trigger, r.suggest.dish ? 'dish' : 'option', r.suggest.dish ? ids.dishes[r.suggest.dish] : null, r.suggest.option ? ids.options[r.suggest.option] : null,
        r.priority ?? 50, r.cap ?? 1, T(r.line).he, T(r.line).en, r.active ?? true]);
  }
  const hours = (seed.hours ?? []).flatMap((h) => h.days.map((d) => `${d} ${h.opens}-${h.closes}`)).sort();
  eq('venue_hours', t.venue_hours.map((h) => `${h.weekday} ${String(h.opens).slice(0, 5)}-${String(h.closes).slice(0, 5)}`).sort(), hours);
  eq('venue_closures', t.venue_closures.length, (seed.closures ?? []).length);
  eq('assets', t.assets, []);
  return out;
}

const GUEST = new Set(['menu_opened', 'dish_viewed', 'addon_chosen', 'basket_added', 'suggestion_shown', 'suggestion_accepted', 'suggestion_dismissed']);

/** The venue's guest-event day rollups per (name, key), summed over days, as the owner reads them (rollups_day under RLS). */
export async function guestRollups(owner) {
  const sums = new Map();
  for (const r of await owner.rollupsDay()) {
    if (!GUEST.has(r.name)) continue;
    const k = r.name + '|' + r.key;
    sums.set(k, (sums.get(k) ?? 0) + Number(r.n));
  }
  return [...sums].map(([k, n]) => ({ name: k.split('|')[0], key: k.split('|')[1], n })).sort((a, b) => (a.name + '|' + a.key < b.name + '|' + b.key ? -1 : 1));
}
