/**
 * A SYNTHETIC import draft for tests, invented from scratch: "Bistro Draft", with a schnitzel whose side of choice
 * opens a nested sauce, a burger with paid extras, and a lemonade. No real venue's menu belongs in this repository.
 * Also a reference executor that applies an `ImportPlan` to an `ExistingMenu` in memory, the way `apply_import` writes
 * the tables, so a test can re-import into the result.
 */
import {
  appliedIds, mergePrevious, type DraftDish, type DraftGroup, type DraftOption, type DraftSection, type ExistingMenu, type ImportDraft, type ImportedIds, type ImportPlan,
  type PlanStep,
} from '../src/import.ts';

export const tx = (he: string, en: string) => ({ he, en });
export const NONE = tx('', '');

export const dish = (key: string, he: string, en: string, price: number | null, o: Partial<DraftDish> = {}): DraftDish => ({
  key, name: tx(he, en), desc: NONE, translated: [], price, priceText: null, priceNote: NONE, tags: [], allergens: NONE, photo: null,
  illustration: null, groups: [], ...o,
});
export const opt = (key: string, he: string, en: string, price: number | null, o: Partial<DraftOption> = {}): DraftOption => ({
  key, name: tx(he, en), translated: [], price, priceText: null, maxQty: 1, default: false, opens: null, ...o,
});
export const group = (key: string, he: string, en: string, o: Partial<DraftGroup> & Pick<DraftGroup, 'options'>): DraftGroup => ({
  key, name: tx(he, en), translated: [], selection: 'single', min: 1, max: 1, ...o,
});
export const section = (key: string, he: string, en: string, dishes: DraftDish[], o: Partial<DraftSection> = {}): DraftSection => ({
  key, name: tx(he, en), translated: [], kind: 'food', room: null, dishes, ...o,
});
export const link = (g: string, min: number | null = null, max: number | null = null) => ({ group: g, min, max });
export const draftOf = (sections: DraftSection[], groups: DraftGroup[] = [], o: Partial<ImportDraft> = {}): ImportDraft =>
  ({ v: 1, source: 'wolt_text', sections, groups, dropped: 0, ...o });

/** The base draft: two sections, three dishes, three groups (one nested), as a Wolt-text reader would produce it. */
export function bistroDraft(): ImportDraft {
  return draftOf(
    [
      section('s-mains', 'עיקריות', 'Mains', [
        dish('d-schnitzel', 'שניצל', 'Schnitzel', 6400, { groups: [link('g-side')] }),
        dish('d-burger', 'המבורגר', 'Burger', 7200, { tags: ['spicy'], groups: [link('g-side'), link('g-extras')] }),
      ]),
      section('s-drinks', 'שתייה', 'Drinks', [dish('d-lemonade', 'לימונדה', 'Lemonade', 1800)], { kind: 'drinks' }),
    ],
    [
      group('g-side', 'תוספת', 'Side of choice', { options: [opt('o-fries', 'צ׳יפס', 'Fries', 0, { opens: 'g-sauce' }), opt('o-salad', 'סלט', 'Salad', 0)] }),
      group('g-sauce', 'רוטב', 'Sauce', { options: [opt('o-aioli', 'איולי', 'Aioli', 0), opt('o-ketchup', 'קטשופ', 'Ketchup', 0)] }),
      group('g-extras', 'תוספות', 'Extras', {
        selection: 'multiple', min: null, max: null, options: [opt('o-cheese', 'גבינה', 'Cheese', 300, { maxQty: 2 }), opt('o-egg', 'ביצה', 'Egg', 400)],
      }),
    ],
  );
}

/** A deep copy that a test may change. */
export const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const REF_KIND: Record<string, PlanStep['kind']> = { section_id: 'section', group_id: 'group', opens_group_id: 'group', dish_id: 'dish' };

/**
 * Checks what every plan must be: no op but create, update, keep or skip; `set` only on create and update (never
 * empty on update); an id exactly on update and keep; a reason exactly on skip; every ref names a node the same plan
 * creates, of the right kind, earlier in apply order; no step key twice for one kind; no venue row updated twice
 * (round 10e: two draft groups on one venue group write each of its rows once).
 */
export function planProblems(plan: ImportPlan): string[] {
  const out: string[] = [];
  const created = new Map<string, PlanStep['kind']>();
  const seen = new Set<string>();
  const updated = new Set<string>();
  for (const s of plan.steps) {
    if (seen.has(`${s.kind}:${s.key}`)) out.push(`${s.kind}:${s.key}: twice`);
    seen.add(`${s.kind}:${s.key}`);
    if (s.op === 'update') {
      if (updated.has(`${s.kind}:${s.id}`)) out.push(`${s.kind}:${s.key}: updates row ${s.id} a second time`);
      updated.add(`${s.kind}:${s.id}`);
    }
    if (!['create', 'update', 'keep', 'skip'].includes(s.op)) out.push(`${s.key}: op ${s.op}`);
    if ((s.op === 'keep' || s.op === 'skip') && Object.keys(s.set).length > 0) out.push(`${s.key}: set on ${s.op}`);
    if (s.op === 'update' && Object.keys(s.set).length === 0 && Object.keys(s.refs).length === 0) out.push(`${s.key}: empty update`);
    // the type already promises these; the plan arrives as JSON from the database too, so check them at run time
    const loose = s as { op: string; id: string | null; key: string };
    if ((loose.op === 'update' || loose.op === 'keep') && loose.id === null) out.push(`${loose.key}: ${loose.op} without id`);
    if ((loose.op === 'create' || loose.op === 'skip') && loose.id !== null) out.push(`${loose.key}: id on ${loose.op}`);
    if ((s.op === 'skip') !== (s.reason !== null)) out.push(`${s.key}: reason on ${s.op}`);
    for (const [col, ref] of Object.entries(s.refs as Record<string, string>)) {
      if (created.get(ref) !== REF_KIND[col]) out.push(`${s.key}: ${col} → ${ref} is not a ${REF_KIND[col]} created earlier`);
      if (col in s.set) out.push(`${s.key}: ${col} both set and ref`);
    }
    if (s.op === 'create' && !s.key.includes('@')) created.set(s.key, s.kind);
  }
  return out;
}

/**
 * What the database would refuse in a menu, or a guest could never meet, as TypeScript: `addon_groups`' checks (min
 * 0–30, max 1–30, min ≤ max, a single choice's max 1); `addon_options`' checks (a name, `max_qty` 1–10, an opener's
 * `max_qty` 1, never opening its own group, opening a group the venue has) and `app.guard_nesting` (one level: no group
 * is both opened by an option and holds an option that opens a group); `dish_addon_groups`' checks and
 * `app.guard_dish_addon` (a link's own limits only tighten its group's; its effective min, its own else the group's, at
 * most its effective max; a single choice's effective max 1); and the reach: a group with an option, and a group's and
 * a link's effective minimum within the group's capacity (its options' `max_qty`).
 */
export function menuRuleBreaks(m: ExistingMenu): string[] {
  const out: string[] = [];
  const capacity = new Map<string, number>();
  for (const o of m.options) capacity.set(o.group_id, (capacity.get(o.group_id) ?? 0) + o.max_qty);
  const between = (v: number, lo: number, hi: number) => Number.isInteger(v) && v >= lo && v <= hi;
  for (const g of m.groups) {
    const name = g.name_en || g.name_he;
    if (!between(g.min_units, 0, 30) || !between(g.max_units, 1, 30) || g.min_units > g.max_units) out.push(`group ${name}: limits ${g.min_units}-${g.max_units}`);
    if (g.selection === 'single' && g.max_units !== 1) out.push(`group ${name}: single with max ${g.max_units}`);
    if (!capacity.has(g.id)) out.push(`group ${name}: no option`);
    else if (g.min_units > capacity.get(g.id)!) out.push(`group ${name}: min ${g.min_units} above capacity ${capacity.get(g.id)}`);
  }
  const groupIds = new Set(m.groups.map((g) => g.id));
  const opened = new Set(m.options.filter((o) => o.opens_group_id !== null).map((o) => o.opens_group_id!));
  for (const o of m.options) {
    const name = o.name_en || o.name_he;
    if (o.name_he === '' && o.name_en === '') out.push(`option ${o.id}: no name`);
    if (!between(o.max_qty, 1, 10)) out.push(`option ${name}: max_qty ${o.max_qty}`);
    if (o.opens_group_id === null) continue;
    if (o.max_qty !== 1) out.push(`option ${name}: opens a group with max_qty ${o.max_qty}`);
    if (o.opens_group_id === o.group_id) out.push(`option ${name}: opens its own group`);
    if (!groupIds.has(o.opens_group_id)) out.push(`option ${name}: opens a group the venue does not have`);
    if (opened.has(o.group_id)) out.push(`option ${name}: nesting_too_deep (its group is opened by another option)`);
  }
  for (const l of m.dishGroups as ReadonlyArray<ExistingMenu['dishGroups'][number] & { min_units?: number | null; max_units?: number | null }>) {
    const g = m.groups.find((x) => x.id === l.group_id)!;
    const name = g.name_en || g.name_he;
    const min = l.min_units ?? null, max = l.max_units ?? null;
    if ((min !== null && !between(min, 0, 30)) || (max !== null && !between(max, 1, 30)) || (min !== null && max !== null && min > max)) {
      out.push(`link to ${name}: limits ${min}-${max}`);
    }
    const lo = min ?? g.min_units, hi = max ?? g.max_units;
    if (g.selection === 'single' && hi !== 1) out.push(`link to ${name}: single_max (${hi})`);
    if (lo > hi) out.push(`link to ${name}: limits_invalid (${lo} > ${hi})`);
    if ((min !== null && min < g.min_units) || (max !== null && max > g.max_units)) out.push(`link to ${name}: limits_loosened (${min}-${max} under ${g.min_units}-${g.max_units})`);
    if (lo > (capacity.get(g.id) ?? 0)) out.push(`link to ${name}: min ${lo} above capacity ${capacity.get(g.id) ?? 0}`);
  }
  return out;
}

let nextId = 0xa00000000000;
const freshId = (): string => `00000000-0000-4000-8000-${(nextId++).toString(16).padStart(12, '0')}`;

type Rows = { -readonly [K in Exclude<keyof ExistingMenu, 'previous'>]: Array<Record<string, unknown>> } & { previous?: ImportedIds };

/** Applies a plan in memory, as `apply_import` writes the tables (ids are made up, new on every call), and folds what
 * it put each section and dish on (what `apply_import` stores as `menu_imports.applied_ids`) into `previous`, as the
 * newest applied import (`mergePrevious`). With the plan's `draft`, a section it left empty with all its dishes
 * placed is recorded `null`, as `apply_import` does; without it, no such section is recorded. */
export function applyPlan(menu: ExistingMenu, plan: ImportPlan, draft: ImportDraft = { v: 1, source: 'paste', sections: [], groups: [], dropped: 0 }): ExistingMenu {
  const out = copy(menu) as unknown as Rows;
  const idOf = new Map<string, string>();
  const resolved = (set: object, refs: object): Record<string, unknown> => {
    const row: Record<string, unknown> = { ...set };
    for (const [col, ref] of Object.entries(refs as Record<string, string>)) row[col] = idOf.get(ref);
    return row;
  };
  const table = { section: out.sections, group: out.groups, option: out.options, dish: out.dishes, dish_group: out.dishGroups, photo: out.assets } as const;
  for (const s of plan.steps) {
    if (s.op === 'keep' || s.op === 'skip') continue;
    const rows = table[s.kind];
    if (s.op === 'create') {
      const id = freshId();
      const r = resolved(s.set, s.refs);
      if (!s.key.includes('@') && s.kind !== 'photo') idOf.set(s.key, id);
      if (s.kind === 'dish') rows.push({ asset_id: null, ...r, id });
      else if (s.kind === 'photo') rows.push({ id, dish_id: r.dish_id, status: 'uploaded' });
      else rows.push({ ...r, id });
    } else Object.assign(rows.find((r) => r.id === s.id)!, resolved(s.set, s.refs));
  }
  out.previous = mergePrevious([
    { id: 'earlier', appliedAt: '2026-01-01T00:00:00Z', appliedIds: menu.previous ?? null },
    { id: 'this', appliedAt: '2026-01-01T00:00:01Z', appliedIds: appliedIds(draft, plan, (_, key) => idOf.get(key)) },
  ]);
  return out as unknown as ExistingMenu;
}
