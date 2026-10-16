// A guest's add-on choices: valid selections for a dish, at random (seeded) or the plain minimum. Every selection made
// here is still checked by priceDish before it is used; these helpers only avoid proposing impossible ones.
import { defaultSelection, groupCapacity, priceDish } from '@mana/contracts';
import { first } from './rng.mjs';

function pickUnits(group, min, max, ctx, r, depth) {
  const off = ctx.unavailable.options;
  const usable = group.options.filter((o) => {
    if (off.has(o.id)) return false;
    if (depth > 0 || o.opensGroupId === null) return true;
    const nested = ctx.groups.get(o.opensGroupId);
    return !!nested && groupCapacity(nested, ctx.groups, off, 1) >= nested.min;
  });
  const capacity = usable.reduce((s, o) => s + o.maxQty, 0);
  if (capacity < min) return null;
  const units = r.between(min, Math.min(max, capacity));
  const counts = new Map();
  for (let u = 0; u < units; u++) {
    const left = usable.filter((o) => (counts.get(o.id) ?? 0) < o.maxQty);
    const o = r.pick(left);
    counts.set(o.id, (counts.get(o.id) ?? 0) + 1);
  }
  const out = [];
  for (const [id, qty] of counts) {
    const o = group.options.find((x) => x.id === id);
    const c = { optionId: id };
    if (qty > 1) c.qty = qty;
    if (depth === 0 && o.opensGroupId !== null) {
      const nested = ctx.groups.get(o.opensGroupId);
      const inner = pickUnits(nested, nested.min, nested.max, ctx, r, 1);
      if (inner === null) return null;
      c.nested = [{ groupId: nested.id, options: inner }];
    }
    out.push(c);
  }
  return out;
}

/** A valid selection for one of this dish, chosen with `r` (rng.mjs); null when the dish cannot be chosen now. */
export function randomSelection(dish, ctx, r = first) {
  const groups = [];
  for (const a of dish.addons) {
    const g = ctx.groups.get(a.groupId);
    if (!g) return null;
    const options = pickUnits(g, a.min, a.max, ctx, r, 0);
    if (options === null) return null;
    groups.push({ groupId: g.id, options });
  }
  const sel = { quantity: 1, groups };
  return priceDish(dish, sel, ctx).ok ? sel : null;
}

/** The owner's defaults when they make a valid order, else the plain minimum (first available options). */
export function autoSelection(dish, ctx) {
  const d = defaultSelection(dish, ctx);
  return priceDish(dish, d, ctx).ok ? d : randomSelection(dish, ctx, first);
}

/** Every chosen option of a selection, with its group and (for a nested group) its opener. */
export function chosenOptions(sel) {
  const out = [];
  for (const g of sel?.groups ?? []) for (const o of g.options) {
    out.push({ groupId: g.groupId, optionId: o.optionId, parentOptionId: null, qty: o.qty ?? 1 });
    for (const n of o.nested ?? []) for (const x of n.options) out.push({ groupId: n.groupId, optionId: x.optionId, parentOptionId: o.optionId, qty: x.qty ?? 1 });
  }
  return out;
}

/** A copy of `sel` with one more unit of an option in a top-level group (what accepting an add-on suggestion does). */
export function withOption(sel, groupId, optionId) {
  const groups = sel.groups.map((g) => ({ groupId: g.groupId, options: g.options.map((o) => ({ ...o })) }));
  let g = groups.find((x) => x.groupId === groupId);
  if (!g) { g = { groupId, options: [] }; groups.push(g); }
  const o = g.options.find((x) => x.optionId === optionId);
  if (o) o.qty = (o.qty ?? 1) + 1; else g.options.push({ optionId });
  return { ...sel, groups };
}
