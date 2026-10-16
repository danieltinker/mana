/* The guest's choices in the dish sheet, as the contracts' `DishSelection` (pricing.ts): a dish's groups → chosen options
   (with a quantity) → for an option that opens a group, that group's choices (`nested`, the one nesting level).
   Pure and immutable: every change returns a new selection. Prices, defaults and limits are the contracts' own
   (`priceDish`, `defaultSelection`); this only edits the tree the guest is building and says what is still missing. */
import { defaultSelection, priceDish } from '@mana/contracts';

const copy = (sel) => ({ quantity: sel.quantity, groups: sel.groups.map((g) => ({ groupId: g.groupId, options: g.options.map((o) => (o.nested ? { ...o, nested: o.nested.map((n) => ({ groupId: n.groupId, options: n.options.map((x) => ({ ...x })) })) } : { ...o })) })) });

/** The owner's defaults (available ones only): where a sheet starts. Never an upsell. */
export const startOf = (dish, ctx) => defaultSelection(dish, ctx);

/** The group's choices in a selection: a dish's group, or (with `parentOptionId`) the group that opener opened. */
export function groupIn(sel, groupId, parentOptionId = null) {
  if (parentOptionId === null) return sel.groups.find((g) => g.groupId === groupId) || null;
  for (const g of sel.groups) for (const o of g.options) if (o.optionId === parentOptionId) return (o.nested || []).find((n) => n.groupId === groupId) || null;
  return null;
}
export const unitsOf = (g) => (g ? g.options.reduce((n, o) => n + (o.qty ?? 1), 0) : 0);
export function qtyOf(sel, groupId, optionId, parentOptionId = null) {
  const g = groupIn(sel, groupId, parentOptionId), o = g && g.options.find((x) => x.optionId === optionId);
  return o ? o.qty ?? 1 : 0;
}

/**
 * Sets how many of one option the guest wants (0 = not chosen). In a single-choice group a choice replaces the one
 * before. An opener that is newly chosen opens its group with that group's own defaults; one that is let go takes its
 * nested choices with it. The opener of a nested choice must already be chosen.
 */
export function setOption(sel, ctx, { groupId, optionId, parentOptionId = null, qty = 1 }) {
  const group = ctx.groups.get(groupId), opt = group && group.options.find((o) => o.id === optionId);
  if (!opt) return sel;
  const next = copy(sel);
  let list;
  if (parentOptionId === null) list = next.groups;
  else {
    const opener = next.groups.flatMap((g) => g.options).find((o) => o.optionId === parentOptionId);
    if (!opener) return sel;
    list = opener.nested || (opener.nested = []);
  }
  let g = list.find((x) => x.groupId === groupId);
  if (!g) { g = { groupId, options: [] }; list.push(g); }
  const at = g.options.findIndex((o) => o.optionId === optionId), had = at >= 0 ? g.options[at] : null;
  const n = Math.max(0, Math.min(opt.maxQty, qty | 0));
  if (n === 0) { if (at >= 0) g.options.splice(at, 1); return next; }
  const entry = n === 1 ? { optionId } : { optionId, qty: n };
  if (parentOptionId === null && opt.opensGroupId !== null) {
    const nested = ctx.groups.get(opt.opensGroupId);
    if (had && had.nested) entry.nested = had.nested;
    else if (nested) entry.nested = [{ groupId: nested.id, options: defaultSelection({ addons: [{ groupId: nested.id, min: nested.min, max: nested.max }] }, ctx).groups[0].options }];
  }
  if (group.selection === 'single') g.options = [entry];
  else if (at >= 0) g.options[at] = entry;
  else g.options.push(entry);
  return next;
}

/** Every chosen option, in the order the sheet shows them, with its group and (in a nested group) its opener. */
export function chosenList(sel) {
  const out = [];
  for (const g of (sel && sel.groups) || []) for (const o of g.options) {
    out.push({ groupId: g.groupId, optionId: o.optionId, parentOptionId: null, qty: o.qty ?? 1 });
    for (const n of o.nested || []) for (const x of n.options) out.push({ groupId: n.groupId, optionId: x.optionId, parentOptionId: o.optionId, qty: x.qty ?? 1 });
  }
  return out;
}

/**
 * What stops this selection from being added, in the guest's terms, from priceDish's own errors: `missing` = groups
 * below their minimum ({ groupId, parentOptionId, need }), `off` = chosen options that are sold out now (option ids).
 */
export function issues(dish, sel, ctx) {
  const r = priceDish(dish, sel, ctx);
  if (r.ok) return { missing: [], off: [] };
  return {
    missing: r.errors.filter((e) => e.code === 'below_min').map((e) => ({ groupId: e.groupId, parentOptionId: e.parentOptionId, need: e.min - e.got })),
    off: r.errors.filter((e) => e.code === 'option_unavailable').map((e) => e.optionId)
  };
}

/**
 * The running price while the sheet is being filled in: priceDish on what is chosen so far, with the minimums set aside
 * (a required side not yet chosen adds nothing yet). Once nothing is missing it is exactly priceDish's answer.
 */
export function runningPrice(dish, sel, ctx) {
  const groups = new Map([...ctx.groups].map(([id, g]) => [id, Object.assign({}, g, { min: 0 })]));
  return priceDish(Object.assign({}, dish, { addons: dish.addons.map((a) => Object.assign({}, a, { min: 0 })) }), sel, Object.assign({}, ctx, { groups }));
}

/** One string per selection: two selections are the same choice exactly when their keys are equal. */
export function selectionKey(sel) {
  const opts = (list) => [...list].sort((a, b) => (a.optionId < b.optionId ? -1 : 1)).map((o) => o.optionId + '*' + (o.qty ?? 1) + (o.nested && o.nested.length ? '(' + groups(o.nested) + ')' : ''));
  const groups = (list) => [...list].filter((g) => g.options.length).sort((a, b) => (a.groupId < b.groupId ? -1 : 1)).map((g) => g.groupId + ':' + opts(g.options).join(',')).join(';');
  return groups(sel.groups);
}
