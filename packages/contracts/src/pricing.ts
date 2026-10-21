/**
 * Prices, computed the same way on the guest's phone and on the server: integer agorot, VAT included.
 *
 * The guest's choices are a tree that mirrors the one nesting level: a dish's groups → chosen options → for an
 * option that opens a group, that group's choices (`nested`). A nested group's options carry no `nested` of their
 * own; sending one is `nesting_too_deep`.
 *
 * Defaults (`option.default`) are what the guest's sheet pre-selects; pricing never adds anything by itself: the
 * selection is explicit, and what was not chosen is not charged.
 */
import type { Text } from './common.ts';
import { LIMITS } from './enums.ts';
import { choicesExhausted, groupCapacity, type Unavailable } from './availability.ts';
import type { AddonGroupV2, AddonOptionV2, DishV2, SnapshotV2 } from './snapshot.ts';

export type ChosenOption = {
  readonly optionId: string;
  /** Units of this option; 1 when left out. */
  readonly qty?: number;
  /** The choices of the group this option opens. */
  readonly nested?: readonly GroupSelection[];
};
export type GroupSelection = { readonly groupId: string; readonly options: readonly ChosenOption[] };
export type DishSelection = {
  /** How many of this dish, with these choices. */
  readonly quantity: number;
  readonly groups: readonly GroupSelection[];
};

export type PricingContext = {
  readonly groups: ReadonlyMap<string, AddonGroupV2>;
  readonly unavailable: Unavailable;
  /** VAT included in every price, in basis points (18% = 1800). */
  readonly vatBasisPoints: number;
};

const NONE: Unavailable = { dishes: new Set(), options: new Set() };

/** The context a snapshot gives, with what cannot be chosen now (`unavailableOf(menuAvailability(...))`). */
export function pricingContext(s: SnapshotV2, unavailable: Unavailable = NONE): PricingContext {
  return { groups: new Map(s.addonGroups.map((g) => [g.id, g] as const)), unavailable, vatBasisPoints: s.pricing.vatBasisPoints };
}

export type PriceLine =
  | { readonly kind: 'dish'; readonly dishId: string; readonly name: Text; readonly unitPrice: number; readonly qty: 1; readonly amount: number }
  | {
      readonly kind: 'option';
      readonly groupId: string;
      readonly optionId: string;
      /** The opener when this option sits in a nested group. */
      readonly parentOptionId: string | null;
      readonly name: Text;
      readonly unitPrice: number;
      readonly qty: number;
      readonly amount: number;
    };

export type PriceError =
  | { readonly code: 'dish_unavailable'; readonly dishId: string }
  | { readonly code: 'no_price'; readonly dishId: string }
  | { readonly code: 'quantity_invalid'; readonly max: number }
  | { readonly code: 'group_unknown'; readonly groupId: string; readonly parentOptionId: string | null }
  | { readonly code: 'group_repeated'; readonly groupId: string; readonly parentOptionId: string | null }
  | { readonly code: 'option_unknown'; readonly groupId: string; readonly optionId: string }
  | { readonly code: 'option_repeated'; readonly groupId: string; readonly optionId: string }
  | { readonly code: 'option_unavailable'; readonly groupId: string; readonly optionId: string }
  | { readonly code: 'option_qty_invalid'; readonly groupId: string; readonly optionId: string; readonly max: number }
  | { readonly code: 'below_min'; readonly groupId: string; readonly parentOptionId: string | null; readonly min: number; readonly got: number }
  | { readonly code: 'above_max'; readonly groupId: string; readonly parentOptionId: string | null; readonly max: number; readonly got: number }
  | { readonly code: 'nested_unexpected'; readonly groupId: string; readonly optionId: string }
  | { readonly code: 'nesting_too_deep'; readonly groupId: string; readonly optionId: string }
  | { readonly code: 'total_overflow' };

export type PriceOk = {
  readonly ok: true;
  readonly quantity: number;
  /** One dish with its choices. */
  readonly unit: number;
  /** unit × quantity: what the guest pays, VAT included. */
  readonly total: number;
  /** The VAT inside `total` (extracted, never added on top). */
  readonly vat: number;
  readonly net: number;
  /** One dish's breakdown; the amounts add up to `unit`. */
  readonly lines: readonly PriceLine[];
};
export type PriceResult = PriceOk | { readonly ok: false; readonly error: PriceError; readonly errors: readonly PriceError[] };

/** The VAT inside a VAT-inclusive amount, rounded half up to the agora. */
export function vatIncluded(total: number, basisPoints: number): number {
  const den = 10_000 + basisPoints;
  return Math.floor((total * basisPoints * 2 + den) / (den * 2));
}

type Limits = { readonly min: number; readonly max: number };

function priceGroup(
  group: AddonGroupV2,
  limits: Limits,
  chosen: GroupSelection | undefined,
  parentOptionId: string | null,
  ctx: PricingContext,
  errors: PriceError[],
  lines: PriceLine[],
): number {
  let units = 0;
  let sum = 0;
  const seen = new Set<string>();
  for (const c of chosen?.options ?? []) {
    const opt: AddonOptionV2 | undefined = group.options.find((o) => o.id === c.optionId);
    if (!opt) {
      errors.push({ code: 'option_unknown', groupId: group.id, optionId: c.optionId });
      continue;
    }
    if (seen.has(opt.id)) {
      errors.push({ code: 'option_repeated', groupId: group.id, optionId: opt.id });
      continue;
    }
    seen.add(opt.id);
    if (ctx.unavailable.options.has(opt.id)) errors.push({ code: 'option_unavailable', groupId: group.id, optionId: opt.id });
    const qty = c.qty ?? 1;
    if (!Number.isInteger(qty) || qty < 1 || qty > opt.maxQty) {
      errors.push({ code: 'option_qty_invalid', groupId: group.id, optionId: opt.id, max: opt.maxQty });
      continue;
    }
    units += qty;
    sum += opt.price * qty;
    lines.push({ kind: 'option', groupId: group.id, optionId: opt.id, parentOptionId, name: opt.name, unitPrice: opt.price, qty, amount: opt.price * qty });

    // the one nesting level
    if (parentOptionId !== null) {
      if (c.nested && c.nested.length > 0) errors.push({ code: 'nesting_too_deep', groupId: group.id, optionId: opt.id });
      continue;
    }
    if (opt.opensGroupId === null) {
      if (c.nested && c.nested.length > 0) errors.push({ code: 'nested_unexpected', groupId: group.id, optionId: opt.id });
      continue;
    }
    const nestedGroup = ctx.groups.get(opt.opensGroupId);
    const given = c.nested ?? [];
    for (const n of given) if (n.groupId !== opt.opensGroupId) errors.push({ code: 'group_unknown', groupId: n.groupId, parentOptionId: opt.id });
    const mine = given.filter((n) => n.groupId === opt.opensGroupId);
    if (mine.length > 1) errors.push({ code: 'group_repeated', groupId: opt.opensGroupId, parentOptionId: opt.id });
    if (!nestedGroup) {
      errors.push({ code: 'group_unknown', groupId: opt.opensGroupId, parentOptionId: opt.id });
      continue;
    }
    sum += priceGroup(nestedGroup, nestedGroup, mine[0], opt.id, ctx, errors, lines);
  }
  if (units < limits.min) errors.push({ code: 'below_min', groupId: group.id, parentOptionId, min: limits.min, got: units });
  if (units > limits.max) errors.push({ code: 'above_max', groupId: group.id, parentOptionId, max: limits.max, got: units });
  return sum;
}

/**
 * The price of one line: a dish, its choices, a quantity. Every rule of the add-on model is checked; all problems
 * are returned (`errors`), the first one also as `error`.
 */
export function priceDish(dish: DishV2, selection: DishSelection, ctx: PricingContext): PriceResult {
  const errors: PriceError[] = [];
  const fail = (): PriceResult => ({ ok: false, error: errors[0]!, errors });

  if (ctx.unavailable.dishes.has(dish.id) || choicesExhausted(dish, ctx.groups, ctx.unavailable.options)) {
    errors.push({ code: 'dish_unavailable', dishId: dish.id });
    return fail();
  }
  if (dish.price === null) {
    errors.push({ code: 'no_price', dishId: dish.id });
    return fail();
  }
  const q = selection.quantity;
  if (!Number.isInteger(q) || q < 1 || q > LIMITS.lineQuantity) errors.push({ code: 'quantity_invalid', max: LIMITS.lineQuantity });

  const lines: PriceLine[] = [{ kind: 'dish', dishId: dish.id, name: dish.name, unitPrice: dish.price.amount, qty: 1, amount: dish.price.amount }];
  let unit = dish.price.amount;

  const attached = new Map(dish.addons.map((a) => [a.groupId, a] as const));
  const byGroup = new Map<string, GroupSelection>();
  for (const g of selection.groups) {
    if (!attached.has(g.groupId)) errors.push({ code: 'group_unknown', groupId: g.groupId, parentOptionId: null });
    else if (byGroup.has(g.groupId)) errors.push({ code: 'group_repeated', groupId: g.groupId, parentOptionId: null });
    else byGroup.set(g.groupId, g);
  }
  for (const a of dish.addons) {
    const group = ctx.groups.get(a.groupId);
    if (!group) {
      errors.push({ code: 'group_unknown', groupId: a.groupId, parentOptionId: null });
      continue;
    }
    unit += priceGroup(group, a, byGroup.get(a.groupId), null, ctx, errors, lines);
  }
  if (errors.length > 0) return fail();

  const total = unit * q;
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(total * Math.max(ctx.vatBasisPoints, 1) * 2)) {
    errors.push({ code: 'total_overflow' });
    return fail();
  }
  const vat = vatIncluded(total, ctx.vatBasisPoints);
  return { ok: true, quantity: q, unit, total, vat, net: total - vat, lines };
}

/**
 * The owner's defaults as a starting selection for the guest's sheet (available options only; an opener's nested
 * group starts from its own defaults). The guest changes it before anything is priced; it is never an upsell.
 * A default opener whose own required group cannot be satisfied now (every sauce sold out) is not pre-selected either:
 * it could not be added, so the guest starts from a choice that can.
 */
export function defaultSelection(dish: DishV2, ctx: Pick<PricingContext, 'groups'> & { readonly unavailable?: Unavailable }): DishSelection {
  const off = ctx.unavailable?.options ?? new Set<string>();
  const dead = (o: AddonOptionV2): boolean => {
    if (o.opensGroupId === null) return false;
    const nested = ctx.groups.get(o.opensGroupId);
    return !nested || (nested.min > 0 && groupCapacity(nested, ctx.groups, off, 1) < nested.min);
  };
  const pick = (g: AddonGroupV2, depth: number): ChosenOption[] =>
    g.options
      .filter((o) => o.default && !off.has(o.id) && !(depth === 0 && dead(o)))
      .slice(0, g.max)
      .map((o) => {
        const nested = depth === 0 && o.opensGroupId !== null ? ctx.groups.get(o.opensGroupId) : undefined;
        return nested ? { optionId: o.id, nested: [{ groupId: nested.id, options: pick(nested, 1) }] } : { optionId: o.id };
      });
  const groups: GroupSelection[] = [];
  for (const a of dish.addons) {
    const g = ctx.groups.get(a.groupId);
    if (g) groups.push({ groupId: g.id, options: pick(g, 0).slice(0, a.max) });
  }
  return { quantity: 1, groups };
}

/** The least that satisfying a group costs (null when it cannot be satisfied with what is available). */
function cheapest(group: AddonGroupV2, min: number, ctx: PricingContext, depth: number): number | null {
  if (min <= 0) return 0;
  const units: number[] = [];
  for (const o of group.options) {
    if (ctx.unavailable.options.has(o.id)) continue;
    let cost = o.price;
    if (depth === 0 && o.opensGroupId !== null) {
      const nested = ctx.groups.get(o.opensGroupId);
      if (!nested) continue;
      const extra = cheapest(nested, nested.min, ctx, 1);
      if (extra === null) continue;
      cost += extra;
    }
    for (let i = 0; i < o.maxQty; i++) units.push(cost);
  }
  if (units.length < min) return null;
  units.sort((a, b) => a - b);
  return units.slice(0, min).reduce((s, x) => s + x, 0);
}

/**
 * Can a required choice of this group (or of a required group one of its options opens) cost money, with what is
 * available now? A sold-out paid option does not count, nor an opener whose own required group cannot be satisfied.
 */
function requiredIsPaid(group: AddonGroupV2, ctx: PricingContext, depth: number): boolean {
  return group.options.some((o) => {
    if (ctx.unavailable.options.has(o.id)) return false;
    if (depth > 0 || o.opensGroupId === null) return o.price > 0;
    const nested = ctx.groups.get(o.opensGroupId);
    if (!nested) return false;
    if (cheapest(nested, nested.min, ctx, 1) === null) return false;
    return o.price > 0 || (nested.min > 0 && requiredIsPaid(nested, ctx, 1));
  });
}

export type FromPrice = {
  /** The least a guest can pay for one of this dish, VAT included: never lower than what can be ordered. */
  readonly amount: number;
  /** Show "from …": a required group has an available choice that costs money, so the price can be higher. */
  readonly from: boolean;
};

/**
 * The price to show on the menu. A required group with an available paid choice makes it "from ₪…" (price honesty):
 * the amount is the base plus the cheapest way to make every required choice with what is available now, so the
 * number shown is always payable. When the only paid choices are sold out, the price is plain again.
 * null when the dish has no price, or when a required choice cannot be made now.
 */
export function fromPrice(dish: DishV2, ctx: Pick<PricingContext, 'groups'> & { readonly unavailable?: Unavailable }): FromPrice | null {
  if (dish.price === null) return null;
  const full: PricingContext = { groups: ctx.groups, unavailable: ctx.unavailable ?? NONE, vatBasisPoints: 0 };
  let amount = dish.price.amount;
  let from = false;
  for (const a of dish.addons) {
    if (a.min < 1) continue;
    const g = full.groups.get(a.groupId);
    if (!g) return null;
    const extra = cheapest(g, a.min, full, 0);
    if (extra === null) return null;
    amount += extra;
    if (requiredIsPaid(g, full, 0)) from = true;
  }
  return { amount, from };
}
