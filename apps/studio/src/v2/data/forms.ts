// Stored rows ↔ what the owner edits in a form, and back, with every check the database would make (same codes as
// packages/contracts' validators where one exists). Prices are typed in shekels and stored in agorot. Pure.
import { LIMITS, ROOMS, SECTION_KINDS, SELECTIONS, TAGS, isBlank, oneOf, stripBlank } from '@mana/contracts';
import type { AddonGroupRow, AddonOptionRow, DishRow, Room, SectionKind, SectionRow, SelectionKind, Tag } from '@mana/contracts';
import { formatMinor, parsePrice } from '../../lib/money.ts';
import { byPosition } from './rows.ts';

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

// ---------------------------------------------------------------- add-on groups (D37, ADR-002)
export type OptionForm = {
  /** A stable key for the list (the id, or a made-up one for an option not saved yet). */
  key: string;
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
export type OptionWrite = Pick<AddonOptionRow, 'position' | 'name_he' | 'name_en' | 'price' | 'max_qty' | 'is_default' | 'opens_group_id'> & { id: string | null };
export type GroupWrite = { group: Pick<AddonGroupRow, 'label' | 'name_he' | 'name_en' | 'selection' | 'min_units' | 'max_units'>; options: OptionWrite[] };

let seq = 0;
export const newOptionForm = (): OptionForm => ({ key: 'new-' + ++seq, id: null, nameHe: '', nameEn: '', price: '', maxQty: 1, isDefault: false, opensGroupId: null });
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

export function groupFromForm(f: GroupForm, groupId: string | null): Mapped<GroupWrite> {
  const errors: FieldError[] = [];
  const label = text(errors, 'label', f.label, SHORT);
  const n = names(errors, f.nameHe, f.nameEn, SHORT);
  if (!oneOf(SELECTIONS, f.selection)) errors.push({ field: 'selection', code: 'enum_invalid' });
  if (f.options.length === 0) errors.push({ field: 'options', code: 'options_empty' });
  if (f.options.length > LIMITS.optionsPerGroup) errors.push({ field: 'options', code: 'too_many' });

  const options: OptionWrite[] = f.options.map((o, i) => {
    const p = `options.${i}`;
    const on = names(errors, o.nameHe, o.nameEn, SHORT, p + '.name');
    const price = agorotOf(o.price);
    if (price === 'invalid') errors.push({ field: p + '.price', code: 'price_invalid' });
    if (!Number.isInteger(o.maxQty) || o.maxQty < 1 || o.maxQty > LIMITS.optionQuantity) errors.push({ field: p + '.maxQty', code: 'option_qty_invalid' });
    if (o.opensGroupId !== null) {
      if (o.opensGroupId === groupId) errors.push({ field: p + '.opens', code: 'opens_self' });
      if (o.maxQty !== 1) errors.push({ field: p + '.maxQty', code: 'opener_qty' });
    }
    return { id: o.id, position: i, name_he: on.he, name_en: on.en, price: price === 'invalid' || price === null ? 0 : price, max_qty: o.maxQty, is_default: o.isDefault, opens_group_id: o.opensGroupId };
  });

  if (!Number.isInteger(f.min) || !Number.isInteger(f.max) || f.min < 0 || f.max < 1 || f.min > f.max || f.max > 30) errors.push({ field: 'limits', code: 'limits_invalid' });
  else if (f.selection === 'single' && f.max !== 1) errors.push({ field: 'limits', code: 'single_max' });
  else if (f.options.length > 0 && f.min > capacityOf(f.options)) errors.push({ field: 'limits', code: 'min_unreachable' });
  if (f.options.filter((o) => o.isDefault).length > f.max) errors.push({ field: 'defaults', code: 'defaults_exceed' });

  return done(errors, { group: { label, name_he: n.he, name_en: n.en, selection: f.selection, min_units: f.min, max_units: f.max }, options });
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
