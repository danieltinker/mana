// Stored rows ↔ what the owner edits in a form, and back, with every check the database would make (same codes as
// packages/contracts' validators where one exists). Prices are typed in shekels and stored in agorot. Pure.
import { LIMITS, ROOMS, SECTION_KINDS, TAGS, isBlank, oneOf, stripBlank, validateAddonGroup } from '@mana/contracts';
import type { AddonGroupRow, AddonOptionRow, DishRow, Issue, Room, SectionKind, SectionRow, SelectionKind, Tag } from '@mana/contracts';
import { formatMinor, parsePrice } from '../../lib/money.ts';
import { byPosition, newId } from './rows.ts';

export type FieldError = { readonly field: string; readonly code: string };
export type Mapped<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly errors: readonly FieldError[] };

const done = <T>(errors: FieldError[], value: T): Mapped<T> => (errors.length ? { ok: false, errors } : { ok: true, value });

/** Group and section names, option names and the library label: the schema's 60 characters. */
const SHORT = 60;
const ALLERGENS = 300;

// ---------------------------------------------------------------- money
/** ₪ as a person types it ("62", "62.50", "₪ 48") → agorot; '' → null; anything else, or more than the schema allows → 'invalid'. */
export function agorotOf(text: string): number | null | 'invalid' {
  const p = parsePrice(text);
  if (p === null || p === 'invalid') return p;
  return p <= LIMITS.price ? p : 'invalid';
}
/** Agorot → the digits a price field shows (6200 → "62", 6250 → "62.50"). */
export const shekelsOf = (agorot: number | null | undefined): string => formatMinor(agorot);

function text(errors: FieldError[], field: string, value: string, max: number): string {
  const v = stripBlank(value);
  if (v.length > max) errors.push({ field, code: 'too_long' });
  return v;
}
function names(errors: FieldError[], he: string, en: string, max: number, field = 'name'): { he: string; en: string } {
  const out = { he: text(errors, field + '_he', he, max), en: text(errors, field + '_en', en, max) };
  if (isBlank(out.he) && isBlank(out.en)) errors.push({ field, code: 'name_missing' });
  return out;
}

/** Only the columns whose value differs from the stored row (arrays and objects compared by value). */
export function changed<T extends object>(row: Partial<T>, write: T): Partial<T> {
  const out: Partial<T> = {};
  for (const k of Object.keys(write) as (keyof T)[]) if (JSON.stringify(row[k]) !== JSON.stringify(write[k])) out[k] = write[k];
  return out;
}

// ---------------------------------------------------------------- sections
/** `scheduleId`: a day part or special the whole section follows (null: all opening hours). */
export type SectionForm = { nameHe: string; nameEn: string; kind: SectionKind; room: Room | null; scheduleId: string | null; hidden: boolean };
export type SectionWrite = Pick<SectionRow, 'name_he' | 'name_en' | 'kind' | 'room' | 'schedule_id' | 'hidden'>;

export const newSectionForm = (kind: SectionKind = 'food'): SectionForm => ({ nameHe: '', nameEn: '', kind, room: null, scheduleId: null, hidden: false });
export const sectionToForm = (r: SectionRow): SectionForm => ({ nameHe: r.name_he, nameEn: r.name_en, kind: r.kind, room: r.room, scheduleId: r.schedule_id, hidden: r.hidden });

export function sectionFromForm(f: SectionForm): Mapped<SectionWrite> {
  const errors: FieldError[] = [];
  const n = names(errors, f.nameHe, f.nameEn, SHORT);
  if (!oneOf(SECTION_KINDS, f.kind)) errors.push({ field: 'kind', code: 'enum_invalid' });
  if (f.room !== null && !oneOf(ROOMS, f.room)) errors.push({ field: 'room', code: 'enum_invalid' });
  return done(errors, { name_he: n.he, name_en: n.en, kind: f.kind, room: f.room, schedule_id: f.scheduleId, hidden: f.hidden });
}

// ---------------------------------------------------------------- dishes
export type DishForm = {
  sectionId: string;
  nameHe: string; nameEn: string; descHe: string; descEn: string;
  /** Shekels, as typed. */
  price: string;
  priceNoteHe: string; priceNoteEn: string;
  tags: Tag[];
  /** The owner's own words; never generated. */
  allergensHe: string; allergensEn: string;
  scheduleId: string | null;
  hidden: boolean;
};
export type DishWrite = Pick<DishRow, 'section_id' | 'name_he' | 'name_en' | 'desc_he' | 'desc_en' | 'price' | 'price_note_he' | 'price_note_en'
  | 'tags' | 'allergens_he' | 'allergens_en' | 'schedule_id' | 'hidden'>;

export const dishToForm = (r: DishRow): DishForm => ({
  sectionId: r.section_id, nameHe: r.name_he, nameEn: r.name_en, descHe: r.desc_he, descEn: r.desc_en, price: shekelsOf(r.price),
  priceNoteHe: r.price_note_he, priceNoteEn: r.price_note_en, tags: TAGS.filter((t) => r.tags.includes(t)), allergensHe: r.allergens_he,
  allergensEn: r.allergens_en, scheduleId: r.schedule_id, hidden: r.hidden,
});

/**
 * A dish's columns from its form, with their problems beside them (not instead of them): autosave stores the fields
 * without a problem while the owner fixes the others. A field is a column name, or `name` for both names (one language
 * at least).
 */
export function dishDraft(f: DishForm): { value: DishWrite; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const n = names(errors, f.nameHe, f.nameEn, LIMITS.nameLength);
  const price = agorotOf(f.price);
  if (price === 'invalid') errors.push({ field: 'price', code: 'price_invalid' });
  if (f.tags.some((t) => !oneOf(TAGS, t))) errors.push({ field: 'tags', code: 'enum_invalid' });
  const value: DishWrite = {
    section_id: f.sectionId, name_he: n.he, name_en: n.en,
    desc_he: text(errors, 'desc_he', f.descHe, LIMITS.descLength), desc_en: text(errors, 'desc_en', f.descEn, LIMITS.descLength),
    price: price === 'invalid' ? null : price,
    price_note_he: text(errors, 'price_note_he', f.priceNoteHe, LIMITS.noteLength), price_note_en: text(errors, 'price_note_en', f.priceNoteEn, LIMITS.noteLength),
    tags: TAGS.filter((t) => f.tags.includes(t)),
    allergens_he: text(errors, 'allergens_he', f.allergensHe, ALLERGENS), allergens_en: text(errors, 'allergens_en', f.allergensEn, ALLERGENS),
    schedule_id: f.scheduleId, hidden: f.hidden,
  };
  return { value, errors };
}

/** The columns a problem keeps from being saved. */
export const blockedColumns = (errors: readonly FieldError[]): Set<string> =>
  new Set(errors.flatMap((e) => (e.field === 'name' ? ['name_he', 'name_en'] : [e.field])));

/**
 * What one edit of a dish's form asks to store: only the columns that edit changed (so a column changed somewhere else
 * is never written back from this screen), without those that now have a problem. A column that had a problem and has
 * none now goes too. The section is its own write (a dish moving to another section takes a new position there).
 */
export function dishEdit(before: DishForm, after: DishForm): { patch: Partial<DishWrite>; errors: FieldError[] } {
  const a = dishDraft(before), b = dishDraft(after);
  const blocked = blockedColumns(b.errors), had = blockedColumns(a.errors);
  const patch: Partial<DishWrite> = {};
  for (const k of Object.keys(b.value) as (keyof DishWrite)[]) {
    if (k === 'section_id' || blocked.has(k)) continue;
    if (had.has(k) || JSON.stringify(a.value[k]) !== JSON.stringify(b.value[k])) (patch as Record<string, unknown>)[k] = b.value[k];
  }
  return { patch, errors: b.errors };
}

// ---------------------------------------------------------------- add-on groups (D37, ADR-002)
export type OptionForm = {
  /** The option's id: the stored one, or the one it will be stored under (made here, so a retry names the same row). */
  key: string;
  /** null until stored. */
  id: string | null;
  nameHe: string; nameEn: string;
  /** Shekels added per unit, as typed; '' is free. */
  price: string;
  maxQty: number;
  isDefault: boolean;
  /** The one nesting level: the group choosing this option opens. */
  opensGroupId: string | null;
};
export type GroupForm = { label: string; nameHe: string; nameEn: string; selection: SelectionKind; min: number; max: number; options: OptionForm[] };
/** An option as save_addon_group takes it: its id is the stored one, or the client's own for a new option. */
export type OptionWrite = Pick<AddonOptionRow, 'id' | 'position' | 'name_he' | 'name_en' | 'price' | 'max_qty' | 'is_default' | 'opens_group_id'>;
export type GroupWrite = { group: Pick<AddonGroupRow, 'label' | 'name_he' | 'name_en' | 'selection' | 'min_units' | 'max_units'>; options: OptionWrite[] };

export const newOptionForm = (): OptionForm => ({ key: newId(), id: null, nameHe: '', nameEn: '', price: '', maxQty: 1, isDefault: false, opensGroupId: null });
/** "Choose one", required: the most common group (a side, a size). */
export const newGroupForm = (): GroupForm => ({ label: '', nameHe: '', nameEn: '', selection: 'single', min: 1, max: 1, options: [newOptionForm()] });

export function groupToForm(g: AddonGroupRow, options: readonly AddonOptionRow[]): GroupForm {
  return {
    label: g.label, nameHe: g.name_he, nameEn: g.name_en, selection: g.selection, min: g.min_units, max: g.max_units,
    options: byPosition(options.filter((o) => o.group_id === g.id)).map((o) => ({
      key: o.id, id: o.id, nameHe: o.name_he, nameEn: o.name_en, price: o.price === 0 ? '' : shekelsOf(o.price), maxQty: o.max_qty,
      isDefault: o.is_default, opensGroupId: o.opens_group_id,
    })),
  };
}

/** Switching between "choose one" and "choose several" keeps the form valid: one unit, one default, one of each option. */
export function withSelection(f: GroupForm, selection: SelectionKind): GroupForm {
  if (selection === f.selection) return f;
  if (selection === 'multiple') return { ...f, selection };
  let seenDefault = false;
  const options = f.options.map((o) => {
    const isDefault = o.isDefault && !seenDefault;
    if (isDefault) seenDefault = true;
    return { ...o, maxQty: 1, isDefault };
  });
  return { ...f, selection, min: Math.min(f.min, 1), max: 1, options };
}

/** How many units the options can add up to: the most a group can ever ask for. */
export const capacityOf = (options: readonly { maxQty: number }[]): number => options.reduce((s, o) => s + (Number.isInteger(o.maxQty) ? o.maxQty : 0), 0);

/**
 * A group's form as save_addon_group takes it (`groupId`: the stored id, or the one made for a new group). The rules are
 * the contracts' (`validateAddonGroup`, the twin of the database's own check, so the same codes); only what a form alone
 * has is checked here: a price as typed, and more choices than a group may hold. Each problem comes back at the form's
 * field (`name`, `label`, `limits`, `options`, `defaults`, `options.<i>.name|price|maxQty|opens`).
 */
export function groupFromForm(f: GroupForm, groupId: string): Mapped<GroupWrite> {
  const errors: FieldError[] = [];
  if (f.options.length > LIMITS.optionsPerGroup) errors.push({ field: 'options', code: 'too_many' });
  const options: OptionWrite[] = f.options.map((o, i) => {
    const price = agorotOf(o.price);
    if (price === 'invalid') errors.push({ field: `options.${i}.price`, code: 'price_invalid' });
    return {
      id: o.id ?? o.key, position: i, name_he: stripBlank(o.nameHe), name_en: stripBlank(o.nameEn), price: price === 'invalid' || price === null ? 0 : price,
      max_qty: o.maxQty, is_default: o.isDefault, opens_group_id: o.opensGroupId,
    };
  });
  const group = { label: stripBlank(f.label), name_he: stripBlank(f.nameHe), name_en: stripBlank(f.nameEn), selection: f.selection, min_units: f.min, max_units: f.max };
  const checked = validateAddonGroup({ id: groupId, ...group }, options);
  if (!checked.ok) for (const e of checked.errors) errors.push(groupFieldError(e, f));
  return done(errors, { group, options });
}

/**
 * "Save my changes over it": the group as stored now (`stored`), with only what the owner changed in this form since it
 * was read (`opened` → `mine`) put over it, field by field and choice by choice, the way the dish dialog keeps only the
 * owner's columns. A choice deleted here goes; one added here comes; a choice changed elsewhere keeps those changes
 * unless the owner changed the same field; a choice deleted elsewhere stays deleted unless the owner changed it here; a
 * choice added elsewhere stays. The owner's order wins only when they changed the order. Prices are compared as agorot
 * ("5" read and "5.0" typed is no change). When the owner changed which choices are pre-selected, their pre-selection
 * wins as a whole (one default in a choose-one group, never theirs and another device's together).
 */
export function mergeGroupForms(opened: GroupForm, mine: GroupForm, stored: GroupForm): GroupForm {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const pick = <K extends 'label' | 'nameHe' | 'nameEn' | 'selection' | 'min' | 'max'>(k: K): GroupForm[K] => (same(mine[k], opened[k]) ? stored[k] : mine[k]);
  const idOf = (o: OptionForm) => o.id ?? o.key;
  const openedBy = new Map(opened.options.map((o) => [idOf(o), o] as const));
  const storedBy = new Map(stored.options.map((o) => [idOf(o), o] as const));
  const mineBy = new Map(mine.options.map((o) => [idOf(o), o] as const));
  const FIELDS = ['nameHe', 'nameEn', 'price', 'maxQty', 'isDefault', 'opensGroupId'] as const;
  const sameField = (f: (typeof FIELDS)[number], a: OptionForm, b: OptionForm) => (f === 'price' ? agorotOf(a.price) === agorotOf(b.price) : same(a[f], b[f]));
  const defaultsHere = mine.options.some((m) => { const o = openedBy.get(idOf(m)); return o ? m.isDefault !== o.isDefault : m.isDefault; });
  const merge = (m: OptionForm, o: OptionForm | undefined, s: OptionForm | undefined): OptionForm | null => {
    if (!o) return m;                                                          // added here
    const here = FIELDS.filter((f) => !sameField(f, m, o));
    if (!s) return here.length ? m : null;                                     // deleted elsewhere: back only if changed here
    const out: OptionForm = { ...s };
    for (const f of here) (out as Record<string, unknown>)[f] = m[f];
    return out;
  };
  const options: OptionForm[] = [];
  const reordered = !same(opened.options.map(idOf).filter((id) => mineBy.has(id)), mine.options.map(idOf).filter((id) => openedBy.has(id)));
  if (reordered) {
    for (const m of mine.options) { const r = merge(m, openedBy.get(idOf(m)), storedBy.get(idOf(m))); if (r) options.push(r); }
    for (const s of stored.options) if (!openedBy.has(idOf(s)) && !mineBy.has(idOf(s))) options.push(s);        // added elsewhere
  } else {
    for (const s of stored.options) {
      const id = idOf(s);
      if (openedBy.has(id) && !mineBy.has(id)) continue;                                                       // deleted here
      const m = mineBy.get(id);
      options.push(m ? merge(m, openedBy.get(id), s)! : s);
    }
    for (const m of mine.options) if (!storedBy.has(idOf(m))) { const r = merge(m, openedBy.get(idOf(m)), undefined); if (r) options.push(r); }
  }
  const out = defaultsHere ? options.map((o) => ({ ...o, isDefault: mineBy.get(idOf(o))?.isDefault ?? false })) : options;
  return { label: pick('label'), nameHe: pick('nameHe'), nameEn: pick('nameEn'), selection: pick('selection'), min: pick('min'), max: pick('max'), options: out };
}

/** A contracts issue about a group (path `group.min_units`, `options[2].price` …) at the form's field. */
export function groupFieldError(e: Issue, f?: GroupForm): FieldError {
  const opt = /^options\[(\d+)\](?:\.(\w+))?$/.exec(e.path);
  if (opt) {
    const i = Number(opt[1]), col = opt[2] ?? '';
    const field = col === 'max_qty' ? 'maxQty' : col === 'opens_group_id' ? 'opens' : col === 'price' ? 'price' : col.startsWith('name_') ? col : col || 'name';
    // the most per dish of a choice that opens a group is always one: said as such
    const code = e.code === 'qty_invalid' && f?.options[i]?.opensGroupId ? 'opener_qty' : e.code;
    return { field: `options.${i}.${field}`, code };
  }
  if (e.path === 'group') return { field: 'name', code: e.code };
  if (e.path === 'options') return { field: e.code === 'defaults_invalid' ? 'defaults' : 'options', code: e.code };
  const col = e.path.replace(/^group\./, '');
  if (col === 'label' || col.startsWith('name_') || col === 'selection') return { field: col, code: e.code };
  return { field: 'limits', code: e.code };                                   // min_units, max_units, limits_confirmed
}

// ---------------------------------------------------------------- a group on one dish: limits that only tighten
export type GroupLimits = Pick<AddonGroupRow, 'selection' | 'min_units' | 'max_units'>;
export type DishLimits = { min_units: number | null; max_units: number | null };

/** What the guest gets on this dish: the dish's limits clamped to the group's (as the snapshot builder does). */
export function effectiveLimits(g: GroupLimits, dag: DishLimits): { min: number; max: number } {
  return { min: Math.max(dag.min_units ?? g.min_units, g.min_units), max: Math.min(dag.max_units ?? g.max_units, g.max_units) };
}

const range = (lo: number, hi: number): number[] => (hi < lo ? [] : Array.from({ length: hi - lo + 1 }, (_, i) => lo + i));

/**
 * The limits a dish may choose for an attached group: never looser than the group's own, and a minimum the options
 * can reach. `min` is the minimum chosen so far (the maximum cannot go below it).
 */
export function limitChoices(g: GroupLimits, capacity: number, min: number): { mins: number[]; maxes: number[] } {
  return { mins: range(g.min_units, Math.min(g.max_units, capacity)), maxes: g.selection === 'single' ? [1] : range(Math.max(min, 1, g.min_units), g.max_units) };
}

/** A dish's limits to store: null where it keeps the group's own. */
export function dishLimitsFromForm(g: GroupLimits, capacity: number, min: number, max: number): Mapped<DishLimits> {
  const errors: FieldError[] = [];
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1 || min > max) errors.push({ field: 'limits', code: 'limits_invalid' });
  else if (g.selection === 'single' && max !== 1) errors.push({ field: 'limits', code: 'single_max' });
  else if (min < g.min_units || max > g.max_units) errors.push({ field: 'limits', code: 'limits_loosened' });
  else if (min > capacity) errors.push({ field: 'limits', code: 'min_unreachable' });
  return done(errors, { min_units: min === g.min_units ? null : min, max_units: max === g.max_units ? null : max });
}
