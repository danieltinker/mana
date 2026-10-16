/* "My table" as a basket (F07): lines of a dish, its choices and a quantity. Pure and immutable; every amount is
   priceDish's (integer agorot, VAT included), so the phone shows what the server will charge (phase 2 freezes these
   same lines into an order: the seam is `priced()`, one entry per line with its DishSelection and its total).

   A line that can no longer be ordered (sold out, a choice sold out, outside its hours, gone from the menu) stays in the
   basket, marked and explained, and is left out of the total (Hopa test 2). Kept on this phone only, per menu. */
import { LIMITS, priceDish } from '@mana/contracts';
import { selectionKey } from './choices.js';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The line that holds this dish with exactly these choices, if any. */
export const lineOf = (lines, dishId, selection) => { const k = selectionKey(selection); return lines.find((l) => l.dishId === dishId && selectionKey(l.selection) === k) || null; };
/**
 * Adds a dish with its choices; the same dish with the same choices adds to that line's quantity. `name` is the dish's
 * name as the guest saw it, kept on the line (a line whose dish leaves the menu can still say what it was).
 */
export function addLine(lines, dishId, selection, qty = 1, name = null) {
  const twin = lineOf(lines, dishId, selection);
  if (twin) return lines.map((l) => (l === twin ? Object.assign({}, l, { quantity: Math.min(LIMITS.lineQuantity, l.quantity + qty) }) : l));
  const n = lines.reduce((m, l) => Math.max(m, l.n), 0) + 1;
  return lines.concat({ key: 'l' + n, n, dishId, name, selection: { quantity: 1, groups: selection.groups }, quantity: Math.min(LIMITS.lineQuantity, qty) });
}
/** A new quantity for a line; 0 removes it. */
export function setQuantity(lines, key, qty) {
  const q = Math.max(0, Math.min(LIMITS.lineQuantity, qty | 0));
  return q === 0 ? lines.filter((l) => l.key !== key) : lines.map((l) => (l.key === key ? Object.assign({}, l, { quantity: q }) : l));
}
export const removeLine = (lines, key) => lines.filter((l) => l.key !== key);
/** The line's choices changed in the sheet ("Change"); when they now equal another line's, the two become one. */
export function replaceSelection(lines, key, selection) {
  const line = lines.find((l) => l.key === key);
  if (!line) return lines;
  const k = selectionKey(selection), twin = lines.find((l) => l.key !== key && l.dishId === line.dishId && selectionKey(l.selection) === k);
  if (twin) return lines.filter((l) => l.key !== key).map((l) => (l === twin ? Object.assign({}, l, { quantity: Math.min(LIMITS.lineQuantity, l.quantity + line.quantity) }) : l));
  return lines.map((l) => (l.key === key ? Object.assign({}, l, { selection: { quantity: 1, groups: selection.groups } }) : l));
}

/**
 * Every line priced now. `ok` lines carry unit and total; the others carry the first problem as `why`:
 * 'gone' (the dish is not on this menu), 'off' (the dish cannot be chosen now: sold out, outside its hours, or its
 * required choices ran out), 'option' (a chosen option is sold out, named by `optionId`), 'choose' (the choices no
 * longer fit the dish, e.g. after a new menu). Total and count are of the lines that can be ordered.
 */
export function priced(lines, menu, ctx) {
  let total = 0, count = 0;
  const out = lines.map((l) => {
    const dish = menu.dishes.get(l.dishId);
    if (!dish) return { line: l, ok: false, why: 'gone' };
    const r = priceDish(dish, Object.assign({}, l.selection, { quantity: l.quantity }), ctx);
    if (r.ok) { total += r.total; count += l.quantity; return { line: l, ok: true, unit: r.unit, total: r.total }; }
    const e = r.error;
    if (e.code === 'dish_unavailable') return { line: l, ok: false, why: 'off' };
    if (e.code === 'option_unavailable') return { line: l, ok: false, why: 'option', optionId: e.optionId };
    return { line: l, ok: false, why: 'choose' };
  });
  return { lines: out, total, count, problems: out.filter((x) => !x.ok).length };
}

/** "My table" counts per dish (the shape the menu's store keeps for its badges and the set table). */
export function counts(lines) {
  const out = {};
  for (const l of lines) out[l.dishId] = (out[l.dishId] || 0) + l.quantity;
  return out;
}

/* ---------- on this phone only ---------- */
function cleanSelection(sel) {
  const opts = (list, depth) => (Array.isArray(list) ? list : []).filter((o) => isObj(o) && UUID.test(o.optionId) && (o.qty == null || (Number.isInteger(o.qty) && o.qty >= 1 && o.qty <= LIMITS.optionQuantity)))
    .map((o) => { const c = { optionId: o.optionId }; if (o.qty != null && o.qty !== 1) c.qty = o.qty; if (depth === 0 && Array.isArray(o.nested) && o.nested.length) c.nested = groups(o.nested, 1); return c; });
  const groups = (list, depth) => (Array.isArray(list) ? list : []).filter((g) => isObj(g) && UUID.test(g.groupId)).map((g) => ({ groupId: g.groupId, options: opts(g.options, depth) }));
  return { quantity: 1, groups: groups(isObj(sel) ? sel.groups : [], 0) };
}
const cleanName = (t) => (isObj(t) && typeof t.he === 'string' && typeof t.en === 'string' && t.he.length <= LIMITS.nameLength && t.en.length <= LIMITS.nameLength ? { he: t.he, en: t.en } : null);
/** Lines read back from storage, as far as they are well formed (whatever is not, is dropped). */
export function readLines(raw) {
  if (!isObj(raw) || !Array.isArray(raw.lines)) return [];
  const seen = new Set();
  return raw.lines.filter((l) => isObj(l) && UUID.test(l.dishId) && Number.isInteger(l.quantity) && l.quantity >= 1 && l.quantity <= LIMITS.lineQuantity && Number.isInteger(l.n) && l.n > 0 && !seen.has(l.n) && seen.add(l.n))
    .map((l) => ({ key: 'l' + l.n, n: l.n, dishId: l.dishId, name: cleanName(l.name), selection: cleanSelection(l.selection), quantity: l.quantity }));
}
export const storedLines = (lines) => ({ v: 1, lines: lines.map((l) => ({ n: l.n, dishId: l.dishId, name: l.name, selection: l.selection, quantity: l.quantity })) });
