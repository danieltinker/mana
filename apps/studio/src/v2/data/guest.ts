// A dish as the guest will get it, built from the draft rows the way the database's snapshot builder builds it
// (app.build_snapshot_full): the groups attached to it in order, with the dish's limits clamped to the group's, and the
// groups their options open. The editor's live preview prices it with @mana/contracts (priceDish, defaultSelection,
// fromPrice), exactly as the guest's phone and the server will. Pure.
import type {
  AddonGroupRow, AddonGroupV2, AddonOptionRow, ChosenOption, DishAddonGroupRow, DishRelationRow, DishRow, DishSelection, DishV2, FromPrice,
  GroupSelection, PricingContext, Unavailable,
} from '@mana/contracts';
import { fromPrice } from '@mana/contracts';
import { effectiveLimits } from './forms.ts';
import { byPosition } from './rows.ts';

export type MenuRows = {
  readonly dishes: readonly DishRow[];
  readonly groups: readonly AddonGroupRow[];
  readonly options: readonly AddonOptionRow[];
  readonly dishGroups: readonly DishAddonGroupRow[];
  readonly relations: readonly DishRelationRow[];
};

/**
 * Israel's VAT, the schema's default (app_config.vat_basis_points). The preview shows totals, which include VAT and do
 * not depend on it; the published snapshot carries the venue's own number.
 */
export const VAT_BASIS_POINTS = 1800;
const NOTHING_OFF: Unavailable = { dishes: new Set(), options: new Set() };

export function groupV2(g: AddonGroupRow, options: readonly AddonOptionRow[]): AddonGroupV2 {
  return {
    id: g.id, name: { he: g.name_he, en: g.name_en }, selection: g.selection, min: g.min_units, max: g.max_units,
    options: byPosition(options.filter((o) => o.group_id === g.id)).map((o) => ({
      id: o.id, name: { he: o.name_he, en: o.name_en }, price: o.price, maxQty: o.max_qty, default: o.is_default, opensGroupId: o.opens_group_id,
    })),
  };
}

export function dishV2(d: DishRow, rows: MenuRows): DishV2 {
  const groups = new Map(rows.groups.map((g) => [g.id, g] as const));
  return {
    id: d.id,
    name: { he: d.name_he, en: d.name_en },
    desc: { he: d.desc_he, en: d.desc_en },
    price: d.price === null ? null : { amount: d.price, note: { he: d.price_note_he, en: d.price_note_en } },
    tags: d.tags,
    allergens: { he: d.allergens_he, en: d.allergens_en },
    details: d.details,
    asset: null,
    scheduleId: d.schedule_id,
    addons: byPosition(rows.dishGroups.filter((a) => a.dish_id === d.id))
      .filter((a) => groups.has(a.group_id))
      .map((a) => ({ groupId: a.group_id, ...effectiveLimits(groups.get(a.group_id)!, a) })),
    related: byPosition(rows.relations.filter((r) => r.dish_id === d.id)).map((r) => r.related_dish_id),
  };
}

export type GuestModel = { readonly dish: DishV2; readonly groups: ReadonlyMap<string, AddonGroupV2> };

/** The dish and every group its sheet can show: attached, and opened by an attached group's option. */
export function guestModel(rows: MenuRows, dishId: string): GuestModel | null {
  const d = rows.dishes.find((x) => x.id === dishId);
  if (!d) return null;
  const dish = dishV2(d, rows);
  const attached = new Set(dish.addons.map((a) => a.groupId));
  const reached = new Set(attached);
  for (const o of rows.options) if (attached.has(o.group_id) && o.opens_group_id) reached.add(o.opens_group_id);
  const groups = new Map<string, AddonGroupV2>();
  for (const g of rows.groups) if (reached.has(g.id)) groups.set(g.id, groupV2(g, rows.options));
  return { dish, groups };
}

export const pricingOf = (m: GuestModel): PricingContext => ({ groups: m.groups, unavailable: NOTHING_OFF, vatBasisPoints: VAT_BASIS_POINTS });

// ---------------------------------------------------------------- the guest's choices, changed one tap at a time
/** Where a group sits in the choices: attached to the dish (parent null), or opened by an option. */
export type GroupPath = { readonly groupId: string; readonly parentOptionId: string | null };

/** The most units this group takes here: the dish's limit for an attached group, the group's own when nested. */
export function maxOf(m: GuestModel, p: GroupPath): number {
  if (p.parentOptionId === null) return m.dish.addons.find((a) => a.groupId === p.groupId)?.max ?? 0;
  return m.groups.get(p.groupId)?.max ?? 0;
}
export function minOf(m: GuestModel, p: GroupPath): number {
  if (p.parentOptionId === null) return m.dish.addons.find((a) => a.groupId === p.groupId)?.min ?? 0;
  return m.groups.get(p.groupId)?.min ?? 0;
}

function chosenIn(sel: DishSelection, p: GroupPath): readonly ChosenOption[] {
  if (p.parentOptionId === null) return sel.groups.find((g) => g.groupId === p.groupId)?.options ?? [];
  for (const g of sel.groups) for (const o of g.options) if (o.optionId === p.parentOptionId) return o.nested?.find((n) => n.groupId === p.groupId)?.options ?? [];
  return [];
}
export const chosenOption = (sel: DishSelection, p: GroupPath, optionId: string) => chosenIn(sel, p).find((o) => o.optionId === optionId);
export const unitsIn = (sel: DishSelection, p: GroupPath) => chosenIn(sel, p).reduce((s, o) => s + (o.qty ?? 1), 0);

function withGroup(sel: DishSelection, p: GroupPath, fn: (options: readonly ChosenOption[]) => ChosenOption[]): DishSelection {
  const swap = (list: readonly GroupSelection[], groupId: string): GroupSelection[] => {
    const all = list.some((g) => g.groupId === groupId) ? list : [...list, { groupId, options: [] }];
    return all.map((g) => (g.groupId === groupId ? { groupId, options: fn(g.options) } : g));
  };
  if (p.parentOptionId === null) return { ...sel, groups: swap(sel.groups, p.groupId) };
  return {
    ...sel,
    groups: sel.groups.map((g) => ({ ...g, options: g.options.map((o) => (o.optionId === p.parentOptionId ? { ...o, nested: swap(o.nested ?? [], p.groupId) } : o)) })),
  };
}

/** Tap an option on or off. A group of one unit swaps its choice; an opener brings its group's defaults with it. */
export function choose(sel: DishSelection, m: GuestModel, p: GroupPath, optionId: string, on: boolean): DishSelection {
  if (!on) return withGroup(sel, p, (list) => list.filter((o) => o.optionId !== optionId));
  const group = m.groups.get(p.groupId), opt = group?.options.find((o) => o.id === optionId);
  if (!group || !opt) return sel;
  const nested = p.parentOptionId === null && opt.opensGroupId !== null ? m.groups.get(opt.opensGroupId) : undefined;
  const fresh: ChosenOption = nested
    ? { optionId, nested: [{ groupId: nested.id, options: nested.options.filter((o) => o.default).slice(0, nested.max).map((o) => ({ optionId: o.id })) }] }
    : { optionId };
  const max = maxOf(m, p);
  return withGroup(sel, p, (list) => {
    if (list.some((o) => o.optionId === optionId)) return [...list];
    if (max === 1) return [fresh];
    return list.reduce((s, o) => s + (o.qty ?? 1), 0) >= max ? [...list] : [...list, fresh];
  });
}

/** Nothing chosen in this group ("none" in an optional group of one). */
export const clearGroup = (sel: DishSelection, p: GroupPath): DishSelection => withGroup(sel, p, () => []);

/** "Double cheese": how many of one chosen option. */
export function setQty(sel: DishSelection, p: GroupPath, optionId: string, qty: number): DishSelection {
  return withGroup(sel, p, (list) => list.map((o) => (o.optionId === optionId ? { ...o, qty } : o)));
}

/** "₪62" or "from ₪62" for a dish row (null: no price, or a required choice that cannot be made). */
export function menuPrice(rows: MenuRows, dishId: string): FromPrice | null {
  const m = guestModel(rows, dishId);
  return m ? fromPrice(m.dish, { groups: m.groups }) : null;
}
