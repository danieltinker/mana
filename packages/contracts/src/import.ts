/**
 * The menu import (F03, D33, Hopa H01–H03 and acceptance test 1): what every source produces before anything is saved,
 * the exceptions the owner sees, and the plan that merges it into the venue's menu.
 *
 * The flow (ADR-006): a source (`IMPORT_SOURCES`) → a reader (the paste and Wolt-text parsers in `packages/import`, or
 * the scanner for photos and Wolt screenshots) → an `ImportDraft` → `save_import_draft` (validated, exceptions computed
 * by the database) → the owner's preview with `draftExceptions` and `planApply` → `apply_import` with the owner's
 * `ImportDecisions`, which runs exactly the plan `planApply` describes: create, update or keep, **never a delete**.
 *
 * Rules the readers and the plan keep:
 * - **Nothing is invented.** Tags only from `TAGS` and only when the source states them; allergens only as the
 *   source's own words (never generated, never inferred from a dish name); a price only as read.
 * - **Prices are shown before they count.** Applying needs `decisions.pricesConfirmed` when the draft carries a price;
 *   a price that differs from the venue's is a question whose default keeps the venue's; an import never publishes.
 * - **Photos need rights (D33).** A photo from Wolt enters only with `rights: 'confirmed'` (the owner said so when
 *   uploading) or the owner's `confirm_rights` answer; otherwise the dish gets a labelled illustration.
 * - **No server-side fetching of Wolt** (D33): Wolt arrives only as what the owner gives us (screenshots or text).
 *
 * The database implements the same functions in SQL (`app.validate_import_draft`, `app.import_key`,
 * `app.import_exceptions`, `app.plan_import`); `supabase/tests` compares them with these on the same inputs. Every rule
 * below is written so it can be implemented there: no Unicode categories (explicit code point ranges), no locale (ASCII
 * lowercasing only), lengths in code points, ties broken by position, then by id (uuid order = lowercase hex order),
 * then by draft key, never by the order of the draft.
 */
import {
  BLANK_CLASS, cleanText, Issues, isBlank, isInt, isObject, isStorableText, isString, isUuid, LANGS, oneOf, stripBlank, textLength,
  type Lang, type Text, type Validation,
} from './common.ts';
import type {
  AddonGroupRow, AddonOptionRow, AssetRow, DishAddonGroupRow, DishRow, MenuImportRow, SectionRow,
} from './domain.ts';
import {
  IMPORT_SOURCES, LIMITS, ROOMS, SECTION_KINDS, SELECTIONS, TAGS, type ImportSource, type Room, type SectionKind, type SelectionKind, type Tag,
} from './enums.ts';
import type { RpcFail, RpcOk } from './rpc.ts';
import { isRelPath } from './validate-snapshot.ts';

export const IMPORT_DRAFT_VERSION = 1 as const;

/** D33: a photo's rights as the owner stated them. `unknown` = not confirmed; such a photo is never used. */
export const PHOTO_RIGHTS = ['confirmed', 'unknown'] as const;
export type PhotoRights = (typeof PHOTO_RIGHTS)[number];

/** A node's key: stable inside one draft, unique across it. Lowercase letters, digits, `_`, `.`, `-`; at most 64. */
export const DRAFT_KEY_RE = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
/** The key of an exception about the whole draft (no node key starts with `_`). */
export const DRAFT_ROOT = '_draft';
const STOCK_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** A group's units, as the database bounds them (`addon_groups.min_units` 0–30, `max_units` 1–30). */
export const GROUP_UNITS_MAX = 30;
/** What a price looked like in the source when it could not be read as a number ("₪ 4O", "market price"). */
export const PRICE_TEXT_MAX = 40;
/** Lines a reader could not read at all (a count, never the text). */
export const DROPPED_MAX = 100_000;
/** A draft's size: the bytes of its jsonb text form (`octet_length(parsed::text)`, which `draftBytes` computes); the
 * same number is `menu_imports.parsed`'s column check. */
export const DRAFT_BYTES_MAX = 400_000;
/** At most this many exceptions per draft (`menu_imports.exceptions` holds no more); a draft with more is refused. */
export const EXCEPTIONS_MAX = 2000;
/** Hard bounds on a draft's shape: a reader that goes past them is broken, so the draft is refused (`too_large`).
 * Between `LIMITS` and these, the draft is kept and the extra nodes are `too_many` exceptions. */
export const DRAFT_CAPS = { sections: 80, dishes: 800, groups: 400, optionsPerGroup: 60, groupsPerDish: 16 } as const;

export type DraftPhoto = {
  /** In the private bucket, under the import's folder (`<venue id>/imports/<import id>/…`). */
  readonly path: string;
  readonly rights: PhotoRights;
};

export type DraftOption = {
  readonly key: string;
  readonly name: Text;
  /** The languages of `name` the reader translated (not in the source): the owner checks them. */
  readonly translated: readonly Lang[];
  /** Agorot added per unit; 0 = free. null = the source showed a price the reader could not read (`priceText`). */
  readonly price: number | null;
  readonly priceText: string | null;
  readonly maxQty: number;
  readonly default: boolean;
  /** The key of the draft group this option opens (one nesting level). */
  readonly opens: string | null;
};

export type DraftGroup = {
  readonly key: string;
  readonly name: Text;
  readonly translated: readonly Lang[];
  readonly selection: SelectionKind;
  /** As the source states them; null = not stated (the plan uses `draftGroupLimits`' guess, shown as an exception). */
  readonly min: number | null;
  readonly max: number | null;
  readonly options: readonly DraftOption[];
};

/** A group attached to a dish; `min`/`max` may only tighten the group's stated limits (null = the group's). */
export type DraftDishGroup = { readonly group: string; readonly min: number | null; readonly max: number | null };

export type DraftDish = {
  readonly key: string;
  readonly name: Text;
  readonly desc: Text;
  /** The languages of `name` and `desc` the reader translated. */
  readonly translated: readonly Lang[];
  /** Agorot, VAT included. null = no price read: `priceText` says what the source showed, or null when it showed none. */
  readonly price: number | null;
  readonly priceText: string | null;
  readonly priceNote: Text;
  /** Only from `TAGS`, and only when the source states them. */
  readonly tags: readonly Tag[];
  /** The source's own words, never generated. */
  readonly allergens: Text;
  /** Image sources only (a text source has no photos). */
  readonly photo: DraftPhoto | null;
  /** A stock illustration the reader proposes (`stock/`): shown, labelled as one, until the owner adds a photo. */
  readonly illustration: string | null;
  readonly groups: readonly DraftDishGroup[];
};

export type DraftSection = {
  readonly key: string;
  readonly name: Text;
  readonly translated: readonly Lang[];
  readonly kind: SectionKind;
  readonly room: Room | null;
  readonly dishes: readonly DraftDish[];
};

/** What every reader produces, before anything is saved. Stored in `menu_imports.parsed`. */
export type ImportDraft = {
  readonly v: typeof IMPORT_DRAFT_VERSION;
  readonly source: ImportSource;
  readonly sections: readonly DraftSection[];
  /** The option groups the draft's dishes use; a reader merges identical groups into one. */
  readonly groups: readonly DraftGroup[];
  /** How many lines or blocks the reader could not read at all (shown as a number; the text is never kept here). */
  readonly dropped: number;
};

// ---------------------------------------------------------------- the matching key

const KEY_NON_BMP = new RegExp('[\\u{10000}-\\u{10FFFF}]', 'gu');
/** Removed outright: © ® ™, the keycap U+20E3 and the variation selectors. */
const KEY_DROP = new RegExp('[\\u00A9\\u00AE\\u2122\\u20E3\\uFE00-\\uFE0F]', 'gu');
/** Combining marks dropped after NFKD: Latin diacritics, and Hebrew points and cantillation (letters stay). */
const KEY_MARKS = new RegExp('[\\u0300-\\u036F\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7]', 'gu');
/** Geresh and gershayim, and an ASCII ' or " right after a Hebrew letter (the way people type them): removed. */
const KEY_GERESH = new RegExp('[\\u05F3\\u05F4]|(?<=[\\u05D0-\\u05EA])[\\x22\\x27]', 'gu');
/**
 * Characters that separate words: every blank (`BLANK_CLASS`), ASCII punctuation and symbols, Latin-1 punctuation and
 * symbols (U+00A1–U+00BF, × ÷), Hebrew punctuation (maqaf, paseq, sof pasuq, nun hafukha), general punctuation
 * (U+2010–U+2027, U+2030–U+205E), currency signs (U+20A0–U+20C0), and arrows, maths, technical and other symbols and
 * dingbats (U+2190–U+2BFF).
 */
const KEY_SEPARATORS = new RegExp(
  `[${BLANK_CLASS}\\x21-\\x2F\\x3A-\\x40\\x5B-\\x60\\x7B-\\x7E\\u00A1-\\u00BF\\u00D7\\u00F7\\u05BE\\u05C0\\u05C3\\u05C6` +
    `\\u2010-\\u2027\\u2030-\\u205E\\u20A0-\\u20C0\\u2190-\\u2BFF]+`,
  'gu',
);

/**
 * When two names are "the same" for an import (a section, dish, group or option the venue already has). In order:
 * 1. every code point outside the BMP (emoji, and characters newer than both sides' Unicode tables) becomes a space;
 * 2. © ® ™, the keycap U+20E3 and the variation selectors U+FE00–U+FE0F are removed;
 * 3. NFKD; 4. Latin diacritics and Hebrew points are removed (`KEY_MARKS`);
 * 5. geresh and gershayim are removed, and so is an ASCII ' or " right after a Hebrew letter (צ׳יפס = צ'יפס = ציפס);
 * 6. A–Z become a–z (no locale; Hebrew has no case); 7. every run of `KEY_SEPARATORS` becomes one space;
 * 8. no space at either end.
 * "Crème Brûlée!" → "creme brulee"; "Coke™" → "coke"; "Coffee ☕️" → "coffee"; "Keycap 1️⃣" → "keycap 1".
 *
 * SQL (`app.import_key`): the same steps with `regexp_replace(…, 'g')`, `normalize(…, NFKD)` and `translate(…)`, the
 * classes written with `\uXXXX` / `\UXXXXXXXX` escapes and the lookbehind `(?<=[א-ת])`.
 */
export function importKey(text: string): string {
  return text
    .replace(KEY_NON_BMP, ' ')
    .replace(KEY_DROP, '')
    .normalize('NFKD')
    .replace(KEY_MARKS, '')
    .replace(KEY_GERESH, '')
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
    .replace(KEY_SEPARATORS, ' ')
    .replace(/^ | $/g, '');
}

type Keys = { readonly he: string; readonly en: string };
const keysOf = (t: Text): Keys => ({ he: importKey(t.he), en: importKey(t.en) });
const scoreKeys = (a: Keys, b: Keys): number => (a.he !== '' && a.he === b.he ? 2 : 0) + (a.en !== '' && a.en === b.en ? 1 : 0);

/** How well two bilingual names match: 2 when the Hebrew keys are equal (and not empty), plus 1 for English. */
export const nameScore = (a: Text, b: Text): number => scoreKeys(keysOf(a), keysOf(b));

/** Dishes match across sections only within one family of section kinds: food (food, dessert) or drink. */
export const KIND_FAMILY: Readonly<Record<SectionKind, 'food' | 'drink'>> = { food: 'food', dessert: 'food', drinks: 'drink', wine: 'drink', beer: 'drink' };

// ---------------------------------------------------------------- size

const utf8Bytes = (s: string): number => {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
};

/**
 * The bytes of a value's jsonb text form, as PostgreSQL writes it (`octet_length(v::text)`): JSON with `": "` between
 * a key and its value and `", "` between items. The order of keys does not change the length.
 */
export function draftBytes(v: unknown): number {
  if (v === null || v === undefined) return 4;
  if (typeof v === 'boolean') return v ? 4 : 5;
  if (typeof v === 'number') return String(v).length;
  if (typeof v === 'string') return utf8Bytes(JSON.stringify(v));
  if (Array.isArray(v)) return v.reduce((n: number, x) => n + draftBytes(x), 2) + Math.max(0, v.length - 1) * 2;
  if (typeof v === 'object') {
    const entries = Object.entries(v as Record<string, unknown>);
    return entries.reduce((n, [k, x]) => n + utf8Bytes(JSON.stringify(k)) + 2 + draftBytes(x), 2) + Math.max(0, entries.length - 1) * 2;
  }
  return 4;
}

// ---------------------------------------------------------------- validation

const KEYS = {
  draft: ['v', 'source', 'sections', 'groups', 'dropped'],
  section: ['key', 'name', 'translated', 'kind', 'room', 'dishes'],
  dish: ['key', 'name', 'desc', 'translated', 'price', 'priceText', 'priceNote', 'tags', 'allergens', 'photo', 'illustration', 'groups'],
  photo: ['path', 'rights'],
  link: ['group', 'min', 'max'],
  group: ['key', 'name', 'translated', 'selection', 'min', 'max', 'options'],
  option: ['key', 'name', 'translated', 'price', 'priceText', 'maxQty', 'default', 'opens'],
  text: ['he', 'en'],
} as const;

function only(x: Issues, o: Record<string, unknown>, allowed: readonly string[], path: string): void {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) x.add('field_not_allowed', path ? `${path}.${k}` : k);
}

function str(x: Issues, v: unknown, path: string, max: number): void {
  if (!isString(v)) return void x.add('type', path);
  if (!isStorableText(v)) x.add('text_invalid', path);
  else if (textLength(v) > max) x.add('text_too_long', path);
}

function text(x: Issues, v: unknown, path: string, max: number, needName = false): void {
  if (!isObject(v) || !isString(v.he) || !isString(v.en)) return void x.add('type', path);
  only(x, v, KEYS.text, path);
  for (const l of LANGS) {
    if (!isStorableText(v[l] as string)) x.add('text_invalid', `${path}.${l}`);
    else if (textLength(v[l] as string) > max) x.add('text_too_long', `${path}.${l}`);
  }
  if (needName && isBlank(v.he) && isBlank(v.en)) x.add('name_missing', path);
}

function translated(x: Issues, v: unknown, path: string, texts: readonly unknown[]): void {
  if (!Array.isArray(v) || !v.every((l) => oneOf(LANGS, l)) || new Set(v).size !== v.length) return void x.add('translated_invalid', path);
  // a translated language has text of its own in at least one of the node's fields
  for (const l of v as Lang[]) if (!texts.some((t) => isObject(t) && isString(t[l]) && !isBlank(t[l]))) x.add('translated_invalid', path);
}

const priceOk = (v: unknown): boolean => v === null || (isInt(v) && v >= 0 && v <= LIMITS.price);
const limitOk = (v: unknown, lo: number): boolean => v === null || (isInt(v) && v >= lo && v <= GROUP_UNITS_MAX);

type LimitOption = Pick<DraftOption, 'price' | 'maxQty' | 'default'>;

/**
 * A group's limits, from its (kept) options. A stated limit is kept. A missing one is guessed: a **single** choice is
 * required (min 1) when it offers a free option or has a default, and optional (min 0) otherwise ("add a drink?"); its
 * max is 1. A **multiple** choice is optional (min 0) up to everything its options allow (the sum of `maxQty`, at most
 * `GROUP_UNITS_MAX`, and never below the stated min). `stated` = the source gave at least one of the two; `capacity` =
 * the sum of `maxQty` (a minimum above it can never be met).
 */
export function draftGroupLimits(g: Pick<DraftGroup, 'selection' | 'min' | 'max'>, options: readonly LimitOption[]):
  { min: number; max: number; stated: boolean; capacity: number } {
  const capacity = options.reduce((n, o) => n + o.maxQty, 0);
  const stated = g.min !== null || g.max !== null;
  if (g.selection === 'single') {
    const required = options.some((o) => o.price === 0 || o.default);
    return { min: g.min ?? (required ? 1 : 0), max: 1, stated, capacity };
  }
  const min = g.min ?? 0;
  return { min, max: g.max ?? Math.max(1, Math.min(capacity, GROUP_UNITS_MAX), min), stated, capacity };
}

/**
 * Is this a well-formed draft? Codes (the database's `app.validate_import_draft` uses the same): version, type,
 * field_not_allowed, enum_invalid, key_invalid, key_duplicate, too_large, too_many_exceptions, name_missing,
 * text_invalid, text_too_long, translated_invalid, price_invalid, path_invalid, photo_unexpected, stock_invalid,
 * limits_invalid, limits_loosened, single_max, options_empty, option_qty_invalid, opener_qty, opens_self,
 * defaults_exceed, ref_unknown, addon_duplicate, count_invalid.
 *
 * - Sizes: at most `DRAFT_BYTES_MAX` bytes (`draftBytes`), within `DRAFT_CAPS`, and at most `EXCEPTIONS_MAX`
 *   exceptions; text lengths in code points; no NUL and no lone surrogate (`text_invalid`); no key the type does not
 *   have, at any level (`field_not_allowed`).
 * - A dish's limits: each 0–30 and min ≤ max; under a group's **stated** limits they may only tighten
 *   (`limits_loosened`; a guess yields to what a dish states); the dish's effective min (its own, else the group's) may
 *   not exceed its effective max nor the group's capacity (`limits_invalid`).
 * - A dish may not carry two groups with the same name and selection (`addon_duplicate`).
 * - A text source carries no photos (`photo_unexpected`).
 *
 * What the owner can fix in the preview (no price, limits guessed, a duplicate, two levels of nesting, too many) is not
 * an error here: it is an exception (`draftExceptions`).
 */
export function validateDraft(raw: unknown): Validation<ImportDraft> {
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  if (raw.v !== IMPORT_DRAFT_VERSION) return { ok: false, errors: [{ code: 'version', path: 'v' }] };
  if (draftBytes(raw) > DRAFT_BYTES_MAX) return { ok: false, errors: [{ code: 'too_large', path: '' }] };
  const x = new Issues();
  only(x, raw, KEYS.draft, '');
  if (!oneOf(IMPORT_SOURCES, raw.source)) x.add('enum_invalid', 'source');
  if (!isInt(raw.dropped) || raw.dropped < 0 || raw.dropped > DROPPED_MAX) x.add('count_invalid', 'dropped');
  if (!Array.isArray(raw.sections)) x.add('type', 'sections');
  if (!Array.isArray(raw.groups)) x.add('type', 'groups');
  if (!Array.isArray(raw.sections) || !Array.isArray(raw.groups)) return { ok: false, errors: x.list };
  const sections = raw.sections as unknown[];
  const groups = raw.groups as unknown[];
  const textSource = (TEXT_SOURCES as readonly unknown[]).includes(raw.source);

  const keys = new Set<string>();
  const key = (v: unknown, path: string): void => {
    if (!isString(v) || !DRAFT_KEY_RE.test(v)) x.add('key_invalid', path);
    else if (keys.has(v)) x.add('key_duplicate', path);
    else keys.add(v);
  };

  // ---- groups first, so dishes and openers can be checked against them
  if (groups.length > DRAFT_CAPS.groups) x.add('too_large', 'groups');
  const groupByKey = new Map<string, Record<string, unknown>>();
  const groupLimits = new Map<string, { min: number; max: number; stated: boolean; capacity: number }>();
  groups.forEach((g, i) => {
    const p = `groups[${i}]`;
    if (!isObject(g)) return void x.add('type', p);
    only(x, g, KEYS.group, p);
    key(g.key, `${p}.key`);
    if (isString(g.key) && !groupByKey.has(g.key)) groupByKey.set(g.key, g);
    text(x, g.name, `${p}.name`, 60, true);
    translated(x, g.translated, `${p}.translated`, [g.name]);
    if (!oneOf(SELECTIONS, g.selection)) x.add('enum_invalid', `${p}.selection`);
    const limits = limitOk(g.min, 0) && limitOk(g.max, 1) && !(isInt(g.min) && isInt(g.max) && g.min > g.max) &&
      !(g.selection === 'single' && isInt(g.min) && g.min > 1);
    if (!limits) x.add('limits_invalid', p);
    else if (g.selection === 'single' && g.max !== null && g.max !== 1) x.add('single_max', p);
    if (!Array.isArray(g.options) || g.options.length === 0) return void x.add('options_empty', `${p}.options`);
    if (g.options.length > DRAFT_CAPS.optionsPerGroup) x.add('too_large', `${p}.options`);
    let defaults = 0;
    let quantitiesOk = true;
    g.options.forEach((o, j) => {
      const q = `${p}.options[${j}]`;
      if (!isObject(o)) { quantitiesOk = false; return void x.add('type', q); }
      only(x, o, KEYS.option, q);
      key(o.key, `${q}.key`);
      text(x, o.name, `${q}.name`, 60, true);
      translated(x, o.translated, `${q}.translated`, [o.name]);
      if (!priceOk(o.price)) x.add('price_invalid', `${q}.price`);
      if (o.priceText !== null) str(x, o.priceText, `${q}.priceText`, PRICE_TEXT_MAX);
      if (!isInt(o.maxQty) || o.maxQty < 1 || o.maxQty > LIMITS.optionQuantity) {
        x.add('option_qty_invalid', `${q}.maxQty`);
        quantitiesOk = false;
      }
      if (typeof o.default !== 'boolean') x.add('type', `${q}.default`);
      else if (o.default) defaults += 1;
      if (o.opens !== null) {
        if (!isString(o.opens)) x.add('type', `${q}.opens`);
        else if (o.opens === g.key) x.add('opens_self', `${q}.opens`);
        if (o.maxQty !== 1) x.add('opener_qty', `${q}.maxQty`);
      }
    });
    if (limits && quantitiesOk && oneOf(SELECTIONS, g.selection)) {
      const own = draftGroupLimits(g as unknown as DraftGroup, g.options as LimitOption[]);
      if (isString(g.key)) groupLimits.set(g.key, own);
      if (defaults > own.max) x.add('defaults_exceed', p);
    }
  });
  groups.forEach((g, i) => {
    if (!isObject(g) || !Array.isArray(g.options)) return;
    g.options.forEach((o, j) => {
      if (isObject(o) && isString(o.opens) && o.opens !== g.key && !groupByKey.has(o.opens)) x.add('ref_unknown', `groups[${i}].options[${j}].opens`);
    });
  });

  // ---- sections and dishes
  if (sections.length > DRAFT_CAPS.sections) x.add('too_large', 'sections');
  let dishCount = 0;
  sections.forEach((s, i) => {
    const p = `sections[${i}]`;
    if (!isObject(s)) return void x.add('type', p);
    only(x, s, KEYS.section, p);
    key(s.key, `${p}.key`);
    text(x, s.name, `${p}.name`, 60, true);
    translated(x, s.translated, `${p}.translated`, [s.name]);
    if (!oneOf(SECTION_KINDS, s.kind)) x.add('enum_invalid', `${p}.kind`);
    if (s.room !== null && !oneOf(ROOMS, s.room)) x.add('enum_invalid', `${p}.room`);
    if (!Array.isArray(s.dishes)) return void x.add('type', `${p}.dishes`);
    dishCount += s.dishes.length;
    s.dishes.forEach((d, j) => {
      const q = `${p}.dishes[${j}]`;
      if (!isObject(d)) return void x.add('type', q);
      only(x, d, KEYS.dish, q);
      key(d.key, `${q}.key`);
      text(x, d.name, `${q}.name`, LIMITS.nameLength, true);
      text(x, d.desc, `${q}.desc`, LIMITS.descLength);
      translated(x, d.translated, `${q}.translated`, [d.name, d.desc]);
      if (!priceOk(d.price)) x.add('price_invalid', `${q}.price`);
      if (d.priceText !== null) str(x, d.priceText, `${q}.priceText`, PRICE_TEXT_MAX);
      text(x, d.priceNote, `${q}.priceNote`, LIMITS.noteLength);
      if (!Array.isArray(d.tags) || !d.tags.every((t) => oneOf(TAGS, t)) || new Set(d.tags).size !== d.tags.length) x.add('enum_invalid', `${q}.tags`);
      text(x, d.allergens, `${q}.allergens`, 300);
      if (d.photo !== null) {
        if (!isObject(d.photo)) x.add('type', `${q}.photo`);
        else {
          only(x, d.photo, KEYS.photo, `${q}.photo`);
          if (textSource) x.add('photo_unexpected', `${q}.photo`);
          if (!isRelPath(d.photo.path) || textLength(d.photo.path) > 200 || !isStorableText(d.photo.path)) x.add('path_invalid', `${q}.photo.path`);
          if (!oneOf(PHOTO_RIGHTS, d.photo.rights)) x.add('enum_invalid', `${q}.photo.rights`);
        }
      }
      if (d.illustration !== null && !(isString(d.illustration) && STOCK_RE.test(d.illustration))) x.add('stock_invalid', `${q}.illustration`);
      if (!Array.isArray(d.groups)) return void x.add('type', `${q}.groups`);
      if (d.groups.length > DRAFT_CAPS.groupsPerDish) x.add('too_large', `${q}.groups`);
      const seen: Array<{ key: string; group: Record<string, unknown> }> = [];
      d.groups.forEach((a, k) => {
        const r = `${q}.groups[${k}]`;
        if (!isObject(a)) return void x.add('type', r);
        only(x, a, KEYS.link, r);
        const g = isString(a.group) ? groupByKey.get(a.group) : undefined;
        if (!g) return void x.add('ref_unknown', `${r}.group`);
        if (seen.some((e) => e.key === a.group || (e.group.selection === g.selection && isObject(e.group.name) && isObject(g.name) &&
            nameScore(e.group.name as Text, g.name as Text) > 0))) return void x.add('addon_duplicate', r);
        seen.push({ key: a.group as string, group: g });
        if (!limitOk(a.min, 0) || !limitOk(a.max, 1) || (isInt(a.min) && isInt(a.max) && a.min > a.max)) return void x.add('limits_invalid', r);
        if (g.selection === 'single' && a.max !== null && a.max !== 1) return void x.add('single_max', r);
        const own = groupLimits.get(a.group as string);
        if (!own) return;
        // under stated limits a dish only tightens; a guess yields to what the dish states
        if (own.stated && ((isInt(a.min) && isInt(g.min) && a.min < g.min) || (isInt(a.max) && isInt(g.max) && a.max > g.max))) {
          return void x.add('limits_loosened', r);
        }
        const lo = (a.min as number | null) ?? own.min;
        const hi = (a.max as number | null) ?? own.max;
        if (lo > hi || lo > own.capacity) x.add('limits_invalid', r);
      });
    });
  });
  if (dishCount > DRAFT_CAPS.dishes) x.add('too_large', 'sections');
  if (!x.ok) return { ok: false, errors: x.list };
  const draft = raw as unknown as ImportDraft;
  if (draftExceptions(draft).length > EXCEPTIONS_MAX) return { ok: false, errors: [{ code: 'too_many_exceptions', path: '' }] };
  return { ok: true, value: draft };
}

// ---------------------------------------------------------------- exceptions

/**
 * What the owner sees before anything is saved. `fix` blocks applying until it is answered (by a choice from
 * `EXCEPTION_CHOICES`, or by editing the draft so the exception goes away); `check` is shown and applying takes its
 * first choice unless the owner picks another. Codes marked "plan" depend on the venue's menu: `planApply` raises them
 * (`ImportPlan.exceptions`); the others are the draft's own (`draftExceptions`).
 */
export const IMPORT_EXCEPTIONS = {
  /** dish: the source shows no price. */
  price_missing: 'fix',
  /** dish: the source shows a price the reader could not read (`priceText`). */
  price_unreadable: 'fix',
  /** dish: the price read is 0 (often a misread). */
  price_zero: 'check',
  /** option: the reader could not read the option's price (an option always has one; 0 = free). */
  option_price_unreadable: 'fix',
  /** group: the source states no limits; the plan uses `draftGroupLimits`' guess. */
  limits_guessed: 'check',
  /** group: the minimum is more than its (kept) options can add up to. Also raised by the plan after skips. */
  limits_unreachable: 'fix',
  /** section: the same name (`importKey`) as an earlier section of the draft. */
  section_duplicate: 'fix',
  /** dish: the same name as an earlier dish of the same section, or of a section with the same name. */
  dish_duplicate: 'fix',
  /** dish: the same name and the same price as an earlier dish of another section (Wolt's "Popular" repeats dishes;
   * a same-name dish at another price is another dish). */
  dish_repeated: 'check',
  /** the draft (key `DRAFT_ROOT`, `count` nodes): names missing in one of the venue's languages (the guest menu falls
   * back to the other). */
  name_missing_lang: 'check',
  /** the draft (key `DRAFT_ROOT`, `count` nodes): text the reader translated; Hebrew and French need a native read. */
  translation_check: 'check',
  /** option: opens a group from inside a group that is itself opened (two levels; one is the limit, D37). */
  nesting_too_deep: 'fix',
  /** section, dish, group, option or a dish's group: past `LIMITS` (sections, dishes, groups, options per group,
   * groups per dish), counted in draft order. */
  too_many: 'fix',
  /** dish: a photo whose rights the owner has not confirmed (D33): the dish gets a labelled illustration instead. */
  photo_rights_unknown: 'check',
  /** dish: allergens in the source's words; the owner checks them. */
  allergens_check: 'check',
  /** plan, section: no section has this name, but most of its dishes are in one of the venue's sections ("renamed?"). */
  section_renamed: 'check',
  /** plan, dish: the same dish is in another section of the venue (same family of kinds). */
  dish_elsewhere: 'check',
  /** plan, dish: a dish of that name is in a section of another kind (a drink among the food): new unless answered. */
  dish_other_kind: 'check',
  /** plan, dish or option: the price read differs from the venue's (`count` = the venue's price in agorot, or -1 when
   * the venue shows none). */
  price_differs: 'check',
  /** plan, a dish's group (`<dish>><group>`) or an option's nested group (`<option>><group>`): the venue's dish or
   * option already has this group, but its options differ from the source's. */
  group_changed: 'check',
  /** plan, an option's nested group (`<option>><group>`): the venue's option opens another group, or none. */
  opens_changed: 'check',
} as const;
export type ImportExceptionCode = keyof typeof IMPORT_EXCEPTIONS;
export type ExceptionSeverity = 'fix' | 'check';
export const IMPORT_EXCEPTION_CODES = Object.keys(IMPORT_EXCEPTIONS) as ImportExceptionCode[];
export const PLAN_EXCEPTION_CODES = [
  'section_renamed', 'dish_elsewhere', 'dish_other_kind', 'price_differs', 'group_changed', 'opens_changed', 'limits_unreachable',
] as const;

export const IMPORT_CHOICES = [
  'accept', 'skip', 'no_price', 'free', 'clamp', 'merge', 'keep_both', 'unlink', 'illustration', 'confirm_rights', 'same_section', 'rename',
  'same_dish', 'new_dish', 'keep_mine', 'take_new', 'add_options', 'new_group',
] as const;
/** What the owner may answer to an exception. For a `check`, the first is what applying does by default. */
export type ImportChoice = (typeof IMPORT_CHOICES)[number];
export const EXCEPTION_CHOICES: Readonly<Record<ImportExceptionCode, readonly ImportChoice[]>> = {
  price_missing: ['no_price', 'skip'],
  price_unreadable: ['no_price', 'skip'],
  price_zero: ['accept', 'no_price', 'skip'],
  option_price_unreadable: ['free', 'skip'],
  limits_guessed: ['accept', 'skip'],
  limits_unreachable: ['clamp', 'skip'],
  section_duplicate: ['merge', 'keep_both'],
  dish_duplicate: ['skip', 'keep_both'],
  dish_repeated: ['skip', 'keep_both'],
  name_missing_lang: ['accept'],
  translation_check: ['accept'],
  nesting_too_deep: ['unlink', 'skip'],
  too_many: ['skip'],
  photo_rights_unknown: ['illustration', 'confirm_rights'],
  allergens_check: ['accept'],
  section_renamed: ['same_section', 'rename', 'keep_both'],
  dish_elsewhere: ['same_dish', 'new_dish'],
  dish_other_kind: ['new_dish', 'same_dish'],
  price_differs: ['keep_mine', 'take_new'],
  group_changed: ['keep_mine', 'add_options', 'new_group'],
  opens_changed: ['keep_mine', 'new_group'],
};

/**
 * One exception, pointing at a node of the draft by key: a node key; `<dish key>><group key>` for a dish's group; for
 * a plan exception about one of several existing groups, `<node key>@<group id>`; `DRAFT_ROOT` for the whole draft.
 * `path` locates the node in the draft ('' for the draft); `count` is how many nodes a grouped exception covers (1
 * otherwise; for `price_differs` the venue's price).
 */
export type ImportException = {
  readonly code: ImportExceptionCode;
  readonly severity: ExceptionSeverity;
  readonly key: string;
  readonly path: string;
  readonly count: number;
};
/** An exception with the answer the plan used (the owner's, or the default of a `check`). */
export type AnsweredException = ImportException & { readonly choice: ImportChoice };

/** The id an owner's choice is filed under: `<code>@<key>`. */
export const exceptionId = (e: { readonly code: string; readonly key: string }): string => `${e.code}@${e.key}`;
export const linkKey = (dishKey: string, groupKey: string): string => `${dishKey}>${groupKey}`;
/** A step's key when the draft node lands on one of several existing groups (not the group's first target). */
export const targetKey = (nodeKey: string, groupId: string): string => `${nodeKey}@${groupId}`;

export type DraftExceptionOptions = {
  /** The venue's languages: a name missing in one of these counts for `name_missing_lang`. Default: Hebrew and English. */
  readonly langs?: readonly Lang[];
};

/**
 * Every exception of a draft, pure, in this order: the draft's grouped ones (`name_missing_lang`, then
 * `translation_check`, only when their count is above 0), then sections in order (each, then its dishes in order), then
 * groups in order (each, then its options). Within one node the codes come in `IMPORT_EXCEPTIONS` order. The database's
 * `app.import_exceptions` returns the same list in the same order, and `save_import_draft` stores it. Expects a draft
 * that `validateDraft` accepted (which also bounds the list at `EXCEPTIONS_MAX`).
 */
export function draftExceptions(draft: ImportDraft, opts: DraftExceptionOptions = {}): ImportException[] {
  const langs = opts.langs ?? LANGS;
  const out: ImportException[] = [];
  const push = (code: ImportExceptionCode, key: string, path: string, count = 1): void =>
    void out.push({ code, severity: IMPORT_EXCEPTIONS[code], key, path, count });
  let missingLang = 0;
  let translatedN = 0;
  const named = (name: Text, tr: readonly Lang[], extra: readonly Text[] = []): void => {
    if (langs.some((l) => isBlank(name[l]))) missingLang += 1;
    if (tr.length > 0 && [name, ...extra].some((t) => tr.some((l) => !isBlank(t[l])))) translatedN += 1;
  };

  // which groups are opened: an opener inside an opened group is two levels deep
  const opened = new Set<string>();
  for (const g of draft.groups) for (const o of g.options) if (o.opens !== null) opened.add(o.opens);

  const sectionKeys = draft.sections.map((s) => keysOf(s.name));
  type Seen = { section: number; price: number | null };
  const byHe = new Map<string, Seen[]>();
  const byEn = new Map<string, Seen[]>();
  const sameName = (k: Keys): Seen[] => [...(k.he !== '' ? byHe.get(k.he) ?? [] : []), ...(k.en !== '' ? byEn.get(k.en) ?? [] : [])];
  let dishN = 0;
  draft.sections.forEach((s, i) => {
    const p = `sections[${i}]`;
    if (i >= LIMITS.sections) push('too_many', s.key, p);
    if (sectionKeys.slice(0, i).some((k) => scoreKeys(sectionKeys[i]!, k) > 0)) push('section_duplicate', s.key, p);
    named(s.name, s.translated);
    s.dishes.forEach((d, j) => {
      const q = `${p}.dishes[${j}]`;
      const dk = keysOf(d.name);
      if (d.price === null && (d.priceText === null || isBlank(d.priceText))) push('price_missing', d.key, q);
      if (d.price === null && d.priceText !== null && !isBlank(d.priceText)) push('price_unreadable', d.key, q);
      if (d.price === 0) push('price_zero', d.key, q);
      const same = sameName(dk);
      if (same.some((e) => e.section === i || scoreKeys(sectionKeys[e.section]!, sectionKeys[i]!) > 0)) push('dish_duplicate', d.key, q);
      else if (same.some((e) => e.price === d.price)) push('dish_repeated', d.key, q);
      const seen: Seen = { section: i, price: d.price };
      if (dk.he !== '') pushTo(byHe, dk.he, seen);
      if (dk.en !== '') pushTo(byEn, dk.en, seen);
      named(d.name, d.translated, [d.desc]);
      if (dishN >= LIMITS.dishes) push('too_many', d.key, q);
      dishN += 1;
      if (d.photo !== null && d.photo.rights !== 'confirmed') push('photo_rights_unknown', d.key, q);
      if (!isBlank(d.allergens.he) || !isBlank(d.allergens.en)) push('allergens_check', d.key, q);
      d.groups.forEach((a, k) => {
        if (k >= LIMITS.groupsPerDish) push('too_many', linkKey(d.key, a.group), `${q}.groups[${k}]`);
      });
    });
  });

  draft.groups.forEach((g, i) => {
    const p = `groups[${i}]`;
    const lim = draftGroupLimits(g, g.options);
    if (!lim.stated) push('limits_guessed', g.key, p);
    if (lim.min > lim.capacity) push('limits_unreachable', g.key, p);
    named(g.name, g.translated);
    if (i >= LIMITS.addonGroups) push('too_many', g.key, p);
    g.options.forEach((o, j) => {
      const q = `${p}.options[${j}]`;
      if (o.price === null) push('option_price_unreadable', o.key, q);
      named(o.name, o.translated);
      if (o.opens !== null && opened.has(g.key)) push('nesting_too_deep', o.key, q);
      if (j >= LIMITS.optionsPerGroup) push('too_many', o.key, q);
    });
  });
  const root: ImportException[] = [];
  if (missingLang > 0) root.push({ code: 'name_missing_lang', severity: 'check', key: DRAFT_ROOT, path: '', count: missingLang });
  if (translatedN > 0) root.push({ code: 'translation_check', severity: 'check', key: DRAFT_ROOT, path: '', count: translatedN });
  return [...root, ...sortWithinNode(out)];
}

/** Keeps the node order and puts each node's codes in `IMPORT_EXCEPTIONS` order (a stable rule SQL can follow). */
function sortWithinNode(list: ImportException[]): ImportException[] {
  const rank = new Map(IMPORT_EXCEPTION_CODES.map((c, i) => [c, i] as const));
  const firstAt = new Map<string, number>();
  list.forEach((e, i) => { if (!firstAt.has(e.key)) firstAt.set(e.key, i); });
  return [...list].sort((a, b) => firstAt.get(a.key)! - firstAt.get(b.key)! || rank.get(a.code)! - rank.get(b.code)!);
}

export type DraftCounts = {
  readonly sections: number; readonly dishes: number; readonly groups: number; readonly options: number; readonly photos: number;
  /** Lines the reader could not read (`ImportDraft.dropped`). */
  readonly dropped: number;
};
export function draftCounts(d: ImportDraft): DraftCounts {
  let dishes = 0;
  let photos = 0;
  for (const s of d.sections) for (const x of s.dishes) { dishes += 1; if (x.photo) photos += 1; }
  return { sections: d.sections.length, dishes, groups: d.groups.length, options: d.groups.reduce((n, g) => n + g.options.length, 0), photos, dropped: d.dropped };
}

// ---------------------------------------------------------------- the owner's decisions

export type ImportDecisions = {
  readonly v: 1;
  /** The owner saw the prices the draft carries (required when it carries any). */
  readonly pricesConfirmed: boolean;
  /** `exceptionId(e)` → the owner's choice. Ids that match no exception of the draft or the plan are ignored. */
  readonly choices: Readonly<Record<string, ImportChoice>>;
  /** Keys of sections, dishes, groups, options or a dish's groups (`linkKey`) the owner leaves out, with or without an
   * exception. */
  readonly skip?: readonly string[];
};

const CHOICE_ID_RE = /^[a-z_]{1,40}@[a-z0-9_][a-z0-9_.>@-]{0,170}$/;
const SKIP_KEY_RE = /^[a-z0-9][a-z0-9_.-]{0,63}(>[a-z0-9][a-z0-9_.-]{0,63})?$/;

/** Codes: type, version, field_not_allowed, too_large, choice_invalid, key_invalid. */
export function validateDecisions(raw: unknown): Validation<ImportDecisions> {
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  const x = new Issues();
  only(x, raw, ['v', 'pricesConfirmed', 'choices', 'skip'], '');
  if (raw.v !== 1) x.add('version', 'v');
  if (typeof raw.pricesConfirmed !== 'boolean') x.add('type', 'pricesConfirmed');
  if (!isObject(raw.choices)) x.add('type', 'choices');
  else {
    const entries = Object.entries(raw.choices);
    if (entries.length > 5000) x.add('too_large', 'choices');
    for (const [k, v] of entries) if (!CHOICE_ID_RE.test(k) || !oneOf(IMPORT_CHOICES, v)) x.add('choice_invalid', `choices.${k}`);
  }
  if (raw.skip !== undefined) {
    if (!Array.isArray(raw.skip)) x.add('type', 'skip');
    else {
      if (raw.skip.length > 5000) x.add('too_large', 'skip');
      raw.skip.forEach((k, i) => { if (!isString(k) || !SKIP_KEY_RE.test(k)) x.add('key_invalid', `skip[${i}]`); });
    }
  }
  return x.ok ? { ok: true, value: raw as unknown as ImportDecisions } : { ok: false, errors: x.list };
}

// ---------------------------------------------------------------- the plan

/** The live states of a picture: a dish with one of these already has a photo (an import never adds a second). */
export const LIVE_ASSET_STATUSES = ['uploaded', 'processing', 'ready_for_review', 'approved'] as const;

/** What the venue already has, as the plan needs it (the client app reads it under RLS; SQL reads the tables). */
export type ExistingMenu = {
  readonly sections: ReadonlyArray<Pick<SectionRow, 'id' | 'position' | 'name_he' | 'name_en' | 'kind'>>;
  readonly dishes: ReadonlyArray<Pick<DishRow,
    'id' | 'section_id' | 'position' | 'name_he' | 'name_en' | 'desc_he' | 'desc_en' | 'price' | 'price_note_he' | 'price_note_en' | 'tags' |
    'allergens_he' | 'allergens_en' | 'asset_id' | 'stock_id'>>;
  readonly groups: ReadonlyArray<Pick<AddonGroupRow, 'id' | 'name_he' | 'name_en' | 'selection' | 'min_units' | 'max_units'>>;
  readonly options: ReadonlyArray<Pick<AddonOptionRow, 'id' | 'group_id' | 'position' | 'name_he' | 'name_en' | 'price' | 'opens_group_id'>>;
  readonly dishGroups: ReadonlyArray<Pick<DishAddonGroupRow, 'id' | 'dish_id' | 'group_id' | 'position'>>;
  /** Every picture of the venue's dishes, whatever its state. */
  readonly assets: ReadonlyArray<Pick<AssetRow, 'id' | 'dish_id' | 'status'>>;
};

export const EMPTY_MENU: ExistingMenu = { sections: [], dishes: [], groups: [], options: [], dishGroups: [], assets: [] };

export const PLAN_KINDS = ['section', 'group', 'option', 'dish', 'dish_group', 'photo'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];
export const PLAN_OPS = ['create', 'update', 'keep', 'skip'] as const;
export type PlanOp = (typeof PLAN_OPS)[number];
/** Why a node is left out: the owner's choice (or `ImportDecisions.skip`); a duplicate section merged into the first;
 * a section that receives nothing new, or a group left with no options; a node whose section, dish or group is left
 * out; a group no dish of this import uses. */
export const SKIP_REASONS = ['choice', 'merged', 'empty', 'parent_skipped', 'unused'] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

/** The columns each step writes (database names). On `create` every column listed; on `update` only those that change. */
export type SectionCreate = { position: number; name_he: string; name_en: string; kind: SectionKind; room: Room | null };
export type GroupCreate = {
  label: string; name_he: string; name_en: string; selection: SelectionKind; min_units: number; max_units: number; limits_confirmed: boolean;
};
export type OptionCreate = {
  group_id?: string; position: number; name_he: string; name_en: string; price: number; max_qty: number; is_default: boolean;
  opens_group_id?: string | null;
};
export type DishCreate = {
  section_id?: string; position: number; name_he: string; name_en: string; desc_he: string; desc_en: string; price: number | null;
  price_note_he: string; price_note_en: string; tags: Tag[]; allergens_he: string; allergens_en: string; stock_id: string | null;
};
export type LinkCreate = { dish_id?: string; group_id?: string; position: number; min_units: number | null; max_units: number | null };
export type PhotoCreate = {
  dish_id?: string; kind: 'photo'; status: 'uploaded'; original_path: string;
  provenance: { from: 'import'; source: ImportSource; rights: 'confirmed_at_upload' | 'confirmed_at_apply' };
};
type Names = { name_he?: string; name_en?: string };
type Sets = {
  section: { create: SectionCreate; update: Names };
  group: { create: GroupCreate; update: Names };
  option: { create: OptionCreate; update: Names & { price?: number } };
  dish: {
    create: DishCreate;
    update: Names & Partial<Pick<DishCreate, 'desc_he' | 'desc_en' | 'price_note_he' | 'price_note_en' | 'allergens_he' | 'allergens_en' | 'tags'>> &
      { price?: number; stock_id?: string };
  };
  dish_group: { create: LinkCreate; update: { min_units?: number | null; max_units?: number | null } };
  photo: { create: PhotoCreate; update: never };
};
/** Columns that may point at a row this same plan creates (by its draft key). */
type RefColumn = { section: never; group: never; option: 'group_id' | 'opens_group_id'; dish: 'section_id'; dish_group: 'dish_id' | 'group_id'; photo: 'dish_id' };
type NoColumns = Readonly<Record<string, never>>;

/**
 * One row the import creates, updates, keeps or leaves out. `set` holds database columns and their values; `refs`
 * names, per column, the draft key of a row this same plan creates (its id exists only once applied). `id` is the
 * existing row for `update` and `keep` (for a dish's group, the `dish_addon_groups` row; for a photo, the picture the
 * dish already has). A `dish_group` is keyed `linkKey(dish, group)`; a `photo` by its dish's key; a group or option
 * that lands on one of several existing groups by `targetKey`.
 */
export type PlanStep = {
  [K in PlanKind]:
    | { readonly kind: K; readonly key: string; readonly op: 'create'; readonly id: null; readonly set: Readonly<Sets[K]['create']>; readonly refs: Readonly<Partial<Record<RefColumn[K], string>>>; readonly reason: null }
    | { readonly kind: K; readonly key: string; readonly op: 'update'; readonly id: string; readonly set: Readonly<Sets[K]['update']>; readonly refs: Readonly<Partial<Record<RefColumn[K], string>>>; readonly reason: null }
    | { readonly kind: K; readonly key: string; readonly op: 'keep'; readonly id: string; readonly set: NoColumns; readonly refs: NoColumns; readonly reason: null }
    | { readonly kind: K; readonly key: string; readonly op: 'skip'; readonly id: null; readonly set: NoColumns; readonly refs: NoColumns; readonly reason: SkipReason };
}[PlanKind];

export type PlanSummary = Readonly<Record<PlanKind, Readonly<Record<PlanOp, number>>>>;
export type ImportPlan = {
  readonly v: 1;
  readonly steps: readonly PlanStep[];
  readonly summary: PlanSummary;
  /** Every exception, the draft's and the plan's, with the answer used: the draft's in `draftExceptions` order, then the
   * plan's in the order of the steps they concern (then `IMPORT_EXCEPTIONS` order). */
  readonly exceptions: readonly AnsweredException[];
};

type Target = { readonly id: string; readonly ref: null } | { readonly id: null; readonly ref: string };
type Row<T> = T & { readonly keys: Keys };

function byIndex<T>(rows: readonly Row<T>[]): { he: Map<string, Row<T>[]>; en: Map<string, Row<T>[]> } {
  const he = new Map<string, Row<T>[]>();
  const en = new Map<string, Row<T>[]>();
  for (const r of rows) {
    if (r.keys.he !== '') pushTo(he, r.keys.he, r);
    if (r.keys.en !== '') pushTo(en, r.keys.en, r);
  }
  return { he, en };
}
function candidates<T>(index: { he: Map<string, Row<T>[]>; en: Map<string, Row<T>[]> }, k: Keys): Row<T>[] {
  const a = k.he !== '' ? (index.he.get(k.he) ?? []) : [];
  const b = k.en !== '' ? (index.en.get(k.en) ?? []) : [];
  return b.length === 0 ? a : [...new Set([...a, ...b])];
}
const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
function pushTo<K, V>(m: Map<K, V[]>, k: K, v: V): void {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
}

/**
 * Pairs draft nodes with existing rows, each at most once, by the best score first; ties by the row's position, then
 * its id, then the draft key. Order-independent: the result does not depend on the order of `nodes`.
 */
function assign<N extends { key: string; keys: Keys }, R extends { id: string; position: number; keys: Keys }>(
  nodes: readonly N[], rowsFor: (n: N) => readonly R[], taken: Set<string>,
): Map<string, R> {
  const pairs: Array<{ n: N; r: R; score: number }> = [];
  for (const n of nodes) for (const r of rowsFor(n)) {
    const score = scoreKeys(n.keys, r.keys);
    if (score > 0 && !taken.has(r.id)) pairs.push({ n, r, score });
  }
  pairs.sort((a, b) => b.score - a.score || a.r.position - b.r.position || compareIds(a.r.id, b.r.id) || compareIds(a.n.key, b.n.key));
  const out = new Map<string, R>();
  for (const p of pairs) {
    if (out.has(p.n.key) || taken.has(p.r.id)) continue;
    out.set(p.n.key, p.r);
    taken.add(p.r.id);
  }
  return out;
}

/**
 * Turns a draft, the venue's menu and the owner's decisions into what `apply_import` will do: never a delete, never a
 * duplicate of what the venue has (Hopa test 1), and the same plan whatever the order of the draft. Errors (no plan):
 * `exception_unresolved` (a `fix` without an allowed answer), `choice_invalid`, `prices_unconfirmed`, `too_many` (with
 * what the venue has, past `LIMITS`), `nesting_too_deep` (a new choice would open an existing group that has choices
 * opening groups of their own).
 *
 * The rules, in the order the database's `app.plan_import` applies them:
 * 1. **Answers.** Each exception takes its answer, or its first choice when it is a `check`.
 * 2. **What is left out** (`skip`): the keys in `decisions.skip` and every node answered `skip`; then, until nothing
 *    changes: a section takes its dishes; a dish takes its links and photo; a group takes its options, its links and
 *    the options that open it; a group whose options are all left out is left out too (`empty`). `unlink` keeps an
 *    option but it opens nothing. Limits and capacity count only the options kept.
 * 3. **Sections by name**, in draft order: a section merged into an earlier one (`merge`) goes where that one goes;
 *    otherwise the best unclaimed existing section by `nameScore` (then position, then id).
 * 4. **Dishes in their section:** every kept dish whose section resolved, against the dishes of that existing section,
 *    in one pass over all of them (`assign`: best score, then the row's position, id, then the draft key).
 * 5. **Dishes elsewhere:** the dishes still unmatched against the existing dishes still free, only in a section of the
 *    same family of kinds (`KIND_FAMILY`), one pass.
 * 6. **Renamed sections:** a draft section with no name match whose step-5 matches are, for more than half of them, in
 *    one existing section that no other draft section resolved to or proposes: `section_renamed` (`same_section`, the
 *    default, keeps the venue's name; `rename` takes the source's; `keep_both` makes a new section).
 * 7. **Dishes of another kind:** the dishes still unmatched against the existing dishes still free, in a section of the
 *    other family, one pass: `dish_other_kind` (default `new_dish`).
 * 8. **Dish outcomes.** A step-4 match, or a step-5 match now in its own resolved section, updates or keeps the
 *    venue's dish; any other step-5 match asks `dish_elsewhere` (default `same_dish`). A price read that differs from
 *    the venue's asks `price_differs` (default `keep_mine`). Updates never take anything away: names, descriptions,
 *    price notes and allergen text are written only where the venue's are blank; tags only gain (the venue's, then the
 *    draft's new ones in draft order); the illustration is set only when the dish has neither a photo nor one. A matched
 *    dish stays in its section. An unmatched dish is created in its section's target.
 * 9. **New sections** (draft order) are created only when a dish is created in them; else `empty`.
 * 10. **Groups.** A group's global match: an existing group with the same `selection`, `nameScore > 0`, whose options
 *    cover its kept options (`assign` over the options); the best score, then the fewest existing options, then the
 *    smaller id. Each kept link of a matched dish whose dish already has a group with the same selection and a
 *    matching name (the best score, then the link's position, then its id) **stays on that group**: if its options do
 *    not cover the draft's, `group_changed` (`keep_mine` by default; `add_options` adds the missing ones to it;
 *    `new_group` creates the draft's group and moves this dish's link to it). Every other kept link goes to the global
 *    target: the global match, or the draft's group created (always created when a link answered `new_group`). A group
 *    opened by a created option needs the global target too. A group's targets, in order: the global target, then the
 *    dishes' own groups by id; the first is keyed by the group's key, the others by `targetKey`. A group with no target
 *    is `unused`. A created group's limits: as stated, else the guess, loosened to what its new links state; a minimum
 *    above the kept capacity asks `limits_unreachable` (`clamp` lowers it). Its limits are confirmed only when stated
 *    (`limits_confirmed`).
 * 11. **Options**, per target: created in a created target; matched ones in an existing target update (names fill
 *    blanks; a different price asks `price_differs`); the unmatched ones are created under `add_options` (not default,
 *    opening nothing) and left out otherwise. A created option opens its group's global target.
 * 12. **Links:** a link staying on the dish's own group is kept (moved under `new_group`); others are created with the
 *    draft's dish limits (for an existing group, only the limits that lie within its own). **Photos:** created for a
 *    dish with no picture in a live state (`LIVE_ASSET_STATUSES`) when its rights are confirmed (by the draft or
 *    `confirm_rights`); kept otherwise.
 * 13. **Positions** continue after the highest existing one (or from 0), in draft order.
 * 14. **Order of the steps:** sections (draft order); groups (draft order, each with its targets in order); options
 *    (draft group order, then target order, then draft option order); dishes (draft order); dish groups (dish order,
 *    then link order); photos (dish order).
 */
export function planApply(draft: ImportDraft, existing: ExistingMenu, decisions: ImportDecisions, opts: DraftExceptionOptions = {}): Validation<ImportPlan> {
  const x = new Issues();
  const answered: AnsweredException[] = [];
  const planAsked: Array<{ e: AnsweredException; step: `${PlanKind}:${string}` }> = [];
  const answer = (e: ImportException): ImportChoice | undefined => {
    const allowed = EXCEPTION_CHOICES[e.code];
    const c = decisions.choices[exceptionId(e)];
    if (c === undefined) {
      if (e.severity === 'fix') return void x.add('exception_unresolved', e.key, e.code);
      return allowed[0];
    }
    if (!allowed.includes(c)) return void x.add('choice_invalid', e.key, e.code);
    return c;
  };

  // ---- 1. the draft's answers
  const choice = new Map<string, ImportChoice>();
  for (const e of draftExceptions(draft, opts)) {
    const c = answer(e);
    if (c !== undefined) { choice.set(exceptionId(e), c); answered.push({ ...e, choice: c }); }
  }
  const chosen = (code: ImportExceptionCode, key: string): ImportChoice | undefined => choice.get(`${code}@${key}`);
  /** A plan exception: asked once, answered like the draft's, filed against the step it concerns. */
  const ask = (code: ImportExceptionCode, key: string, path: string, step: `${PlanKind}:${string}`, count = 1): ImportChoice | undefined => {
    const e: ImportException = { code, severity: IMPORT_EXCEPTIONS[code], key, path, count };
    const c = answer(e);
    if (c !== undefined) { choice.set(exceptionId(e), c); planAsked.push({ e: { ...e, choice: c }, step }); }
    return c;
  };

  // ---- 2. what is left out
  const skipped = new Map<string, SkipReason>();
  const asked = new Set(decisions.skip ?? []);
  for (const [id, c] of choice) if (c === 'skip') asked.add(id.slice(id.indexOf('@') + 1));
  const opensOf = (o: DraftOption): string | null => (o.opens !== null && chosen('nesting_too_deep', o.key) !== 'unlink' ? o.opens : null);
  for (const s of draft.sections) {
    if (asked.has(s.key)) skipped.set(s.key, 'choice');
    for (const d of s.dishes) {
      if (skipped.has(s.key)) skipped.set(d.key, 'parent_skipped');
      else if (asked.has(d.key)) skipped.set(d.key, 'choice');
    }
  }
  for (const g of draft.groups) {
    if (asked.has(g.key)) skipped.set(g.key, 'choice');
    for (const o of g.options) if (asked.has(o.key)) skipped.set(o.key, 'choice');
  }
  const openersOf = new Map<string, DraftOption[]>();
  for (const h of draft.groups) for (const o of h.options) {
    const opens = opensOf(o);
    if (opens !== null) pushTo(openersOf, opens, o);
  }
  for (let changed = true; changed;) {
    changed = false;
    for (const g of draft.groups) {
      if (!skipped.has(g.key) && g.options.every((o) => skipped.has(o.key))) { skipped.set(g.key, 'empty'); changed = true; }
      if (!skipped.has(g.key)) continue;
      for (const o of [...g.options, ...(openersOf.get(g.key) ?? [])]) if (!skipped.has(o.key)) { skipped.set(o.key, 'parent_skipped'); changed = true; }
    }
  }
  const out = (key: string): boolean => skipped.has(key);
  const linkOut = (d: DraftDish, a: DraftDishGroup): SkipReason | null =>
    out(d.key) || out(a.group) ? 'parent_skipped' : asked.has(linkKey(d.key, a.group)) ? 'choice' : null;
  const keptOptions = (g: DraftGroup): DraftOption[] => g.options.filter((o) => !out(o.key));

  const pricesShown =
    draft.sections.some((s) => s.dishes.some((d) => d.price !== null && !out(d.key))) ||
    draft.groups.some((g) => keptOptions(g).some((o) => o.price !== null && o.price > 0));
  if (pricesShown && !decisions.pricesConfirmed) x.add('prices_unconfirmed', 'pricesConfirmed');

  // ---- keys, once per row
  const exSections = existing.sections.map((r) => ({ ...r, keys: keysOf({ he: r.name_he, en: r.name_en }) }));
  const sectionById = new Map(exSections.map((r) => [r.id, r] as const));
  const exDishes = existing.dishes.map((r) => ({ ...r, keys: keysOf({ he: r.name_he, en: r.name_en }) }));
  const dishById = new Map(exDishes.map((r) => [r.id, r] as const));
  const dishIndex = byIndex(exDishes);
  const exGroups = existing.groups.map((r) => ({ ...r, keys: keysOf({ he: r.name_he, en: r.name_en }) }));
  const groupById = new Map(exGroups.map((r) => [r.id, r] as const));
  const groupIndex = byIndex(exGroups);
  const optionsOf = new Map<string, Array<Row<ExistingMenu['options'][number]>>>();
  for (const o of existing.options) pushTo(optionsOf, o.group_id, { ...o, keys: keysOf({ he: o.name_he, en: o.name_en }) });
  const linksOf = new Map<string, Array<ExistingMenu['dishGroups'][number]>>();
  for (const l of existing.dishGroups) pushTo(linksOf, l.dish_id, l);
  const familyOfDish = (r: { section_id: string }): string | undefined => {
    const s = sectionById.get(r.section_id);
    return s ? KIND_FAMILY[s.kind] : undefined;
  };
  const draftSectionOf = new Map<string, DraftSection>();
  for (const s of draft.sections) for (const d of s.dishes) draftSectionOf.set(d.key, s);
  const sectionPath = new Map(draft.sections.map((s, i) => [s.key, `sections[${i}]`] as const));
  const dishPath = new Map<string, string>();
  draft.sections.forEach((s, i) => s.dishes.forEach((d, j) => dishPath.set(d.key, `sections[${i}].dishes[${j}]`)));

  // ---- 3. sections by name
  const target = new Map<string, Target>();
  const mergedInto = new Map<string, string>();
  const nameMatched = new Set<string>();
  const claimedSections = new Set<string>();
  const sectionKeys = new Map(draft.sections.map((s) => [s.key, keysOf(s.name)] as const));
  draft.sections.forEach((s, i) => {
    if (out(s.key)) return;
    if (chosen('section_duplicate', s.key) === 'merge') {
      const first = draft.sections.slice(0, i).find((t) => scoreKeys(sectionKeys.get(s.key)!, sectionKeys.get(t.key)!) > 0)!;
      mergedInto.set(s.key, mergedInto.get(first.key) ?? first.key);
      return;
    }
    const k = sectionKeys.get(s.key)!;
    const m = exSections
      .filter((e) => !claimedSections.has(e.id) && scoreKeys(k, e.keys) > 0)
      .sort((a, b) => scoreKeys(k, b.keys) - scoreKeys(k, a.keys) || a.position - b.position || compareIds(a.id, b.id))[0];
    if (m) { claimedSections.add(m.id); target.set(s.key, { id: m.id, ref: null }); nameMatched.add(s.key); }
  });
  const rootOf = (sectionKey: string): string => mergedInto.get(sectionKey) ?? sectionKey;

  // ---- 4–7. dishes: in their section, elsewhere in the family, renamed sections, another kind
  type DNode = { key: string; keys: Keys; dish: DraftDish; section: DraftSection };
  const kept: DNode[] = [];
  for (const s of draft.sections) for (const d of s.dishes) if (!out(d.key) && !out(rootOf(s.key))) kept.push({ key: d.key, keys: keysOf(d.name), dish: d, section: s });
  const takenDishes = new Set<string>();
  const homeOf = (n: DNode): string | null => target.get(rootOf(n.section.key))?.id ?? null;
  const inSection = assign(kept.filter((n) => homeOf(n) !== null), (n) => candidates(dishIndex, n.keys).filter((r) => r.section_id === homeOf(n)), takenDishes);
  const family = (n: DNode): string => KIND_FAMILY[draftSectionOf.get(n.key)!.kind];
  const elsewhere = assign(kept.filter((n) => !inSection.has(n.key)),
    (n) => candidates(dishIndex, n.keys).filter((r) => familyOfDish(r) === family(n)), takenDishes);

  const renamed = new Map<string, string>(); // draft section → the existing section it proposes
  for (const s of draft.sections) {
    if (out(s.key) || mergedInto.has(s.key) || nameMatched.has(s.key)) continue;
    const mine = kept.filter((n) => rootOf(n.section.key) === s.key && elsewhere.has(n.key)).map((n) => elsewhere.get(n.key)!.section_id);
    const count = new Map<string, number>();
    for (const id of mine) count.set(id, (count.get(id) ?? 0) + 1);
    const top = [...count].find(([, n]) => n * 2 > mine.length);
    if (top && !claimedSections.has(top[0])) renamed.set(s.key, top[0]);
  }
  for (const [s, e] of renamed) {
    if ([...renamed.values()].filter((v) => v === e).length > 1) continue; // two sections propose the same one: neither
    const c = ask('section_renamed', s, sectionPath.get(s)!, `section:${s}`);
    if (c === 'same_section' || c === 'rename') { target.set(s, { id: e, ref: null }); claimedSections.add(e); }
  }
  for (const s of draft.sections) if (!out(s.key) && !mergedInto.has(s.key) && !target.has(s.key)) target.set(s.key, { id: null, ref: s.key });
  const sectionTarget = (sectionKey: string): Target => target.get(rootOf(sectionKey))!;

  const otherKind = assign(kept.filter((n) => !inSection.has(n.key) && !elsewhere.has(n.key)),
    (n) => candidates(dishIndex, n.keys).filter((r) => familyOfDish(r) !== family(n)), takenDishes);

  // ---- 8. dish outcomes
  const dishTarget = new Map<string, Target>();
  const dishSteps: PlanStep[] = [];
  const nextDishPosition = new Map<string, number>();
  const targetKeyOf = (t: Target): string => t.id ?? `ref:${t.ref}`;
  const createdInSection = new Set<string>();
  for (const s of draft.sections) for (const d of s.dishes) {
    const reason = skipped.get(d.key) ?? (out(rootOf(s.key)) ? 'parent_skipped' : undefined);
    if (reason) { dishSteps.push(skipStep('dish', d.key, reason)); continue; }
    const home = sectionTarget(s.key);
    let m = inSection.get(d.key);
    const near = elsewhere.get(d.key);
    if (!m && near) {
      if (home.id === near.section_id || ask('dish_elsewhere', d.key, dishPath.get(d.key)!, `dish:${d.key}`) === 'same_dish') m = near;
    }
    const far = otherKind.get(d.key);
    if (!m && !near && far && ask('dish_other_kind', d.key, dishPath.get(d.key)!, `dish:${d.key}`) === 'same_dish') m = far;
    if (m) {
      dishTarget.set(d.key, { id: m.id, ref: null });
      const set: Record<string, unknown> = fillBlank(m, {
        name_he: d.name.he, name_en: d.name.en, desc_he: d.desc.he, desc_en: d.desc.en, price_note_he: d.priceNote.he,
        price_note_en: d.priceNote.en, allergens_he: d.allergens.he, allergens_en: d.allergens.en,
      });
      const price = d.price !== null && chosen('price_zero', d.key) === 'no_price' ? null : d.price;
      if (price !== null && price !== m.price && ask('price_differs', d.key, dishPath.get(d.key)!, `dish:${d.key}`, m.price ?? -1) === 'take_new') {
        set.price = price;
      }
      const gained = d.tags.filter((t) => !m!.tags.includes(t));
      if (gained.length > 0) set.tags = [...m.tags, ...gained];
      if (m.asset_id === null && m.stock_id === null && d.illustration !== null) set.stock_id = d.illustration;
      dishSteps.push(changeStep('dish', d.key, m.id, set));
      continue;
    }
    dishTarget.set(d.key, { id: null, ref: d.key });
    const tk = targetKeyOf(home);
    if (!nextDishPosition.has(tk)) nextDishPosition.set(tk, nextPosition(home.id ? existing.dishes.filter((e) => e.section_id === home.id) : []));
    const position = nextDishPosition.get(tk)!;
    nextDishPosition.set(tk, position + 1);
    if (home.ref) createdInSection.add(home.ref);
    const n = cleanText(d.name), ds = cleanText(d.desc), pn = cleanText(d.priceNote), al = cleanText(d.allergens);
    const price = chosen('price_zero', d.key) === 'no_price' ? null : d.price;
    const set: DishCreate = {
      position, name_he: n.he, name_en: n.en, desc_he: ds.he, desc_en: ds.en, price, price_note_he: pn.he, price_note_en: pn.en,
      tags: [...d.tags], allergens_he: al.he, allergens_en: al.en, stock_id: d.illustration,
    };
    if (home.id) set.section_id = home.id;
    dishSteps.push(createStep('dish', d.key, set, home.ref ? { section_id: home.ref } : {}));
  }

  // ---- 9. sections' steps
  let sectionPosition = nextPosition(existing.sections);
  const sectionSteps: PlanStep[] = draft.sections.map((s): PlanStep => {
    const reason = skipped.get(s.key);
    if (reason) return skipStep('section', s.key, reason);
    if (mergedInto.has(s.key)) return skipStep('section', s.key, 'merged');
    const t = target.get(s.key)!;
    if (t.id) {
      const e = sectionById.get(t.id)!;
      const set = chosen('section_renamed', s.key) === 'rename' ? replaceNames(e, s.name) : fillBlank(e, { name_he: s.name.he, name_en: s.name.en });
      return changeStep('section', s.key, t.id, set);
    }
    if (!createdInSection.has(s.key)) return skipStep('section', s.key, 'empty');
    const n = cleanText(s.name);
    return createStep('section', s.key, { position: sectionPosition++, name_he: n.he, name_en: n.en, kind: s.kind, room: s.room }, {});
  });

  // ---- 10. groups: global matches, the dishes' own groups, targets
  const groupKeys = new Map(draft.groups.map((g) => [g.key, keysOf(g.name)] as const));
  const optionNodes = new Map(draft.groups.map((g) => [g.key, keptOptions(g).map((o) => ({ key: o.key, keys: keysOf(o.name), option: o }))] as const));
  const coverCache = new Map<string, Map<string, Row<ExistingMenu['options'][number]>>>();
  /** The existing options the kept options of `g` match in group `gid` (each at most once). */
  const cover = (g: DraftGroup, gid: string): Map<string, Row<ExistingMenu['options'][number]>> => {
    const ck = `${g.key}|${gid}`;
    let c = coverCache.get(ck);
    if (!c) { c = assign(optionNodes.get(g.key)!, () => optionsOf.get(gid) ?? [], new Set()); coverCache.set(ck, c); }
    return c;
  };
  const covers = (g: DraftGroup, gid: string): boolean => cover(g, gid).size === optionNodes.get(g.key)!.length;
  const globalMatch = new Map<string, string>();
  for (const g of draft.groups) {
    if (out(g.key)) continue;
    const k = groupKeys.get(g.key)!;
    const m = candidates(groupIndex, k)
      .filter((e) => e.selection === g.selection && covers(g, e.id))
      .sort((a, b) => scoreKeys(k, b.keys) - scoreKeys(k, a.keys) || (optionsOf.get(a.id)?.length ?? 0) - (optionsOf.get(b.id)?.length ?? 0) ||
        compareIds(a.id, b.id))[0];
    if (m) globalMatch.set(g.key, m.id);
  }
  type LinkRes = { kind: 'own'; link: ExistingMenu['dishGroups'][number]; groupId: string; answer: ImportChoice | null } | { kind: 'global' };
  const linkRes = new Map<string, LinkRes>();
  const needsGlobal = new Set<string>();
  const forcedNew = new Set<string>();
  const groupOf = new Map(draft.groups.map((g) => [g.key, g] as const));
  for (const s of draft.sections) for (const d of s.dishes) for (const a of d.groups) {
    if (linkOut(d, a)) continue;
    const g = groupOf.get(a.group)!;
    const dt = dishTarget.get(d.key);
    const k = groupKeys.get(g.key)!;
    const own = dt?.id ? (linksOf.get(dt.id) ?? [])
      .map((l) => ({ l, y: groupById.get(l.group_id)! }))
      .filter(({ y }) => y && y.selection === g.selection && scoreKeys(k, y.keys) > 0)
      .sort((p, q) => scoreKeys(k, q.y.keys) - scoreKeys(k, p.y.keys) || p.l.position - q.l.position || compareIds(p.l.id, q.l.id))[0] : undefined;
    const lk = linkKey(d.key, g.key);
    if (own) {
      const answer = covers(g, own.y.id) ? null : ask('group_changed', lk, `${dishPath.get(d.key)!}.groups[${d.groups.indexOf(a)}]`, `dish_group:${lk}`);
      linkRes.set(lk, { kind: 'own', link: own.l, groupId: own.y.id, answer: answer ?? null });
      if (answer === 'new_group') { forcedNew.add(g.key); needsGlobal.add(g.key); }
    } else {
      linkRes.set(lk, { kind: 'global' });
      needsGlobal.add(g.key);
    }
  }
  const globalOf = (gk: string): Target => (!forcedNew.has(gk) && globalMatch.has(gk) ? { id: globalMatch.get(gk)!, ref: null } : { id: null, ref: gk });
  const tkey = (nodeKey: string, t: Target, primary: Target): string => (t.id === null || t.id === primary.id ? nodeKey : targetKey(nodeKey, t.id));
  // a group opened by a created option needs its global target too (until nothing changes; one nesting level)
  for (let changed = true; changed;) {
    changed = false;
    for (const g of draft.groups) {
      if (!needsGlobal.has(g.key) || globalOf(g.key).id) continue;
      for (const o of keptOptions(g)) {
        const opens = opensOf(o);
        if (opens !== null && !out(opens) && !needsGlobal.has(opens)) { needsGlobal.add(opens); changed = true; }
      }
    }
  }
  /** How the kept links of each draft group resolved, in draft order. */
  const resByGroup = new Map<string, LinkRes[]>();
  for (const s of draft.sections) for (const d of s.dishes) for (const a of d.groups) {
    const r = linkRes.get(linkKey(d.key, a.group));
    if (r) pushTo(resByGroup, a.group, r);
  }
  const linksOfGroup = (g: DraftGroup): readonly LinkRes[] => resByGroup.get(g.key) ?? [];
  // an option the venue already has keeps the group it opens: that group is a target of the draft's nested group
  const openerOwn = new Map<string, Set<string>>();
  const openerAdd = new Map<string, Set<string>>();
  const openerMove = new Map<string, string>();
  const linkTargets = (g: DraftGroup): Target[] => {
    const list: Target[] = needsGlobal.has(g.key) ? [globalOf(g.key)] : [];
    const own = new Set<string>();
    for (const r of linksOfGroup(g)) if (r.kind === 'own' && r.answer !== 'new_group') own.add(r.groupId);
    for (const id of [...own].sort(compareIds)) if (list[0]?.id !== id) list.push({ id, ref: null });
    return list;
  };
  draft.groups.forEach((g, gi) => {
    if (out(g.key)) return;
    const targets = linkTargets(g);
    for (const t of targets) {
      if (t.id === null) continue;
      const cov = cover(g, t.id);
      g.options.forEach((o, oi) => {
        const nested = opensOf(o);
        const e = cov.get(o.key);
        if (nested === null || out(nested) || out(o.key) || !e) return;
        const ng = groupOf.get(nested)!;
        const ok = tkey(o.key, t, targets[0]!);
        const ek = linkKey(ok, nested);
        const path = `groups[${gi}].options[${oi}]`;
        const y = e.opens_group_id ? groupById.get(e.opens_group_id) : undefined;
        let answer: ImportChoice | undefined;
        if (y && y.selection === ng.selection && scoreKeys(groupKeys.get(nested)!, y.keys) > 0) {
          answer = covers(ng, y.id) ? undefined : ask('group_changed', ek, path, `option:${ok}`);
          if (answer !== 'new_group') openerOwn.set(nested, (openerOwn.get(nested) ?? new Set()).add(y.id));
          if (answer === 'add_options') openerAdd.set(nested, (openerAdd.get(nested) ?? new Set()).add(y.id));
        } else answer = ask('opens_changed', ek, path, `option:${ok}`);
        if (answer === 'new_group') {
          forcedNew.add(nested);
          needsGlobal.add(nested);
          openerMove.set(ok, nested);
          if (existing.options.some((x2) => x2.opens_group_id === t.id)) x.add('nesting_too_deep', o.key);
        }
      });
    }
  });
  const targetsOf = (g: DraftGroup): Target[] => {
    const list: Target[] = needsGlobal.has(g.key) ? [globalOf(g.key)] : [];
    const own = new Set<string>(openerOwn.get(g.key) ?? []);
    for (const r of linksOfGroup(g)) if (r.kind === 'own' && r.answer !== 'new_group') own.add(r.groupId);
    for (const id of [...own].sort(compareIds)) if (list[0]?.id !== id) list.push({ id, ref: null });
    return list;
  };

  const groupSteps: PlanStep[] = [];
  const optionSteps: PlanStep[] = [];
  const createdCapacity = new Map<string, number>();
  const nestsAlready = (gid: string): boolean => (optionsOf.get(gid) ?? []).some((o) => o.opens_group_id !== null);
  draft.groups.forEach((g, gi) => {
    const p = `groups[${gi}]`;
    const reason = skipped.get(g.key);
    if (reason) {
      groupSteps.push(skipStep('group', g.key, reason));
      for (const o of g.options) optionSteps.push(skipStep('option', o.key, skipped.get(o.key) ?? 'parent_skipped'));
      return;
    }
    const targets = targetsOf(g);
    if (targets.length === 0) {
      groupSteps.push(skipStep('group', g.key, 'unused'));
      for (const o of g.options) optionSteps.push(skipStep('option', o.key, skipped.get(o.key) ?? 'unused'));
      return;
    }
    const primary = targets[0]!;
    const kept1 = keptOptions(g);
    for (const t of targets) {
      const key = tkey(g.key, t, primary);
      if (t.id === null) {
        // created: limits from the kept options, loosened to what its new links state when they are only a guess
        const lim = draftGroupLimits(g, kept1);
        let min = lim.min;
        let max = lim.max;
        if (!lim.stated) {
          for (const s of draft.sections) for (const d of s.dishes) for (const a of d.groups) {
            const r = a.group === g.key ? linkRes.get(linkKey(d.key, g.key)) : undefined;
            if (!r || linkOut(d, a) || (r.kind === 'own' && r.answer !== 'new_group')) continue;
            if (a.min !== null) min = Math.min(min, a.min);
            if (a.max !== null && g.selection === 'multiple') max = Math.max(max, Math.min(a.max, GROUP_UNITS_MAX));
          }
        }
        if (min > lim.capacity && ask('limits_unreachable', g.key, p, `group:${g.key}`) === 'clamp') min = lim.capacity;
        createdCapacity.set(g.key, lim.capacity);
        const name = cleanText(g.name);
        groupSteps.push(createStep('group', key, {
          label: name.en || name.he, name_he: name.he, name_en: name.en, selection: g.selection, min_units: min, max_units: max,
          limits_confirmed: lim.stated,
        }, {}));
        continue;
      }
      groupSteps.push(changeStep('group', key, t.id, fillBlank(groupById.get(t.id)!, { name_he: g.name.he, name_en: g.name.en })));
    }
    // ---- 11. options, per target
    for (const t of targets) {
      const isPrimary = t === primary;
      let position = t.id === null ? 0 : nextPosition(optionsOf.get(t.id) ?? []);
      const adding = t.id !== null && (linksOfGroup(g).some((r) => r.kind === 'own' && r.groupId === t.id && r.answer === 'add_options') ||
        (openerAdd.get(g.key)?.has(t.id) ?? false));
      const matched = t.id === null ? new Map<string, Row<ExistingMenu['options'][number]>>() : cover(g, t.id);
      g.options.forEach((o, oi) => {
        const key = tkey(o.key, t, primary);
        const q = `${p}.options[${oi}]`;
        const r = skipped.get(o.key);
        if (r) { if (isPrimary) optionSteps.push(skipStep('option', o.key, r)); return; }
        const e = matched.get(o.key);
        if (e) {
          const set: Record<string, unknown> = fillBlank(e, { name_he: o.name.he, name_en: o.name.en });
          if (o.price !== null && o.price !== e.price && ask('price_differs', key, q, `option:${key}`, e.price) === 'take_new') set.price = o.price;
          const moveTo = openerMove.get(key);
          if (moveTo) optionSteps.push({ kind: 'option', key, op: 'update', id: e.id, set, refs: { opens_group_id: moveTo }, reason: null });
          else optionSteps.push(changeStep('option', key, e.id, set));
          return;
        }
        if (t.id !== null && !adding) { optionSteps.push(skipStep('option', key, 'choice')); return; }
        const n = cleanText(o.name);
        const set: OptionCreate = { position: position++, name_he: n.he, name_en: n.en, price: o.price ?? 0, max_qty: o.maxQty, is_default: t.id === null && o.default };
        const refs: { group_id?: string; opens_group_id?: string } = {};
        if (t.id === null) refs.group_id = g.key; else set.group_id = t.id;
        const opens = t.id === null ? opensOf(o) : null;
        const ot = opens !== null && !out(opens) ? globalOf(opens) : null;
        if (ot?.id) {
          if (nestsAlready(ot.id)) x.add('nesting_too_deep', o.key);
          set.opens_group_id = ot.id;
        } else if (ot?.ref) refs.opens_group_id = ot.ref;
        else set.opens_group_id = null;
        optionSteps.push(createStep('option', key, set, refs));
      });
    }
  });

  // ---- 12. links and photos
  const linkSteps: PlanStep[] = [];
  const nextLinkPosition = new Map<string, number>();
  for (const s of draft.sections) for (const d of s.dishes) d.groups.forEach((a) => {
    const lk = linkKey(d.key, a.group);
    const reason = linkOut(d, a);
    if (reason) return void linkSteps.push(skipStep('dish_group', lk, reason));
    const res = linkRes.get(lk)!;
    if (res.kind === 'own' && res.answer === 'new_group') {
      return void linkSteps.push({ kind: 'dish_group', key: lk, op: 'update', id: res.link.id, set: { min_units: a.min, max_units: a.max }, refs: { group_id: a.group }, reason: null });
    }
    if (res.kind === 'own') return void linkSteps.push(changeStep('dish_group', lk, res.link.id, {}));
    const dt = dishTarget.get(d.key)!;
    const gt = globalOf(a.group);
    const tk = targetKeyOf(dt);
    if (!nextLinkPosition.has(tk)) nextLinkPosition.set(tk, nextPosition(dt.id ? linksOf.get(dt.id) ?? [] : []));
    const position = nextLinkPosition.get(tk)!;
    nextLinkPosition.set(tk, position + 1);
    let min = a.min;
    let max = a.max;
    if (gt.id) {
      // a dish only tightens an existing group: a stated limit outside the group's own is dropped
      const y = groupById.get(gt.id)!;
      if (min !== null && (min < y.min_units || min > y.max_units)) min = null;
      if (max !== null && (max > y.max_units || max < y.min_units)) max = null;
      if (min !== null && max !== null && min > max) { min = null; max = null; }
    } else if (min !== null && min > (createdCapacity.get(a.group) ?? GROUP_UNITS_MAX)) min = null;
    const set: LinkCreate = { position, min_units: min, max_units: max };
    const refs: { dish_id?: string; group_id?: string } = {};
    if (dt.id) set.dish_id = dt.id; else refs.dish_id = dt.ref!;
    if (gt.id) set.group_id = gt.id; else refs.group_id = gt.ref!;
    linkSteps.push(createStep('dish_group', lk, set, refs));
  });

  const livePhoto = (dishId: string): string | null => {
    const d = dishById.get(dishId);
    if (d?.asset_id) return d.asset_id;
    const live = existing.assets.filter((a) => a.dish_id === dishId && (LIVE_ASSET_STATUSES as readonly string[]).includes(a.status)).map((a) => a.id).sort(compareIds);
    return live[0] ?? null;
  };
  const photoSteps: PlanStep[] = [];
  for (const s of draft.sections) for (const d of s.dishes) {
    if (d.photo === null) continue;
    const dt = dishTarget.get(d.key);
    if (!dt) { photoSteps.push(skipStep('photo', d.key, 'parent_skipped')); continue; }
    const atUpload = d.photo.rights === 'confirmed';
    if (!atUpload && chosen('photo_rights_unknown', d.key) !== 'confirm_rights') { photoSteps.push(skipStep('photo', d.key, 'choice')); continue; }
    const current = dt.id ? livePhoto(dt.id) : null;
    if (current !== null) { photoSteps.push(changeStep('photo', d.key, current, {})); continue; }
    const set: PhotoCreate = {
      kind: 'photo', status: 'uploaded', original_path: d.photo.path,
      provenance: { from: 'import', source: draft.source, rights: atUpload ? 'confirmed_at_upload' : 'confirmed_at_apply' },
    };
    if (dt.id) set.dish_id = dt.id;
    photoSteps.push(createStep('photo', d.key, set, dt.ref ? { dish_id: dt.ref } : {}));
  }

  // ---- limits, counting what the venue already has
  const creates = (list: readonly PlanStep[]): PlanStep[] => list.filter((p) => p.op === 'create');
  if (existing.sections.length + creates(sectionSteps).length > LIMITS.sections) x.add('too_many', 'sections');
  if (existing.dishes.length + creates(dishSteps).length > LIMITS.dishes) x.add('too_many', 'dishes');
  if (existing.groups.length + creates(groupSteps).length > LIMITS.addonGroups) x.add('too_many', 'groups');
  const added = new Map<string, number>();
  for (const p of creates(optionSteps)) {
    const gid = p.kind === 'option' && p.op === 'create' ? p.set.group_id : undefined;
    if (gid) added.set(gid, (added.get(gid) ?? 0) + 1);
  }
  for (const [gid, n] of added) if ((optionsOf.get(gid)?.length ?? 0) + n > LIMITS.optionsPerGroup) x.add('too_many', gid);
  const perDish = new Map<string, number>();
  for (const l of existing.dishGroups) perDish.set(l.dish_id, (perDish.get(l.dish_id) ?? 0) + 1);
  for (const p of creates(linkSteps)) {
    if (p.kind !== 'dish_group' || p.op !== 'create') continue;
    const k = p.set.dish_id ?? `ref:${p.refs.dish_id}`;
    perDish.set(k, (perDish.get(k) ?? 0) + 1);
    if (perDish.get(k)! > LIMITS.groupsPerDish) x.add('too_many', p.key);
  }
  if (!x.ok) return { ok: false, errors: x.list };

  const steps = [...sectionSteps, ...groupSteps, ...optionSteps, ...dishSteps, ...linkSteps, ...photoSteps];
  const stepIndex = new Map(steps.map((s, i) => [`${s.kind}:${s.key}`, i] as const));
  const rank = new Map(IMPORT_EXCEPTION_CODES.map((c, i) => [c, i] as const));
  const planExceptions = [...planAsked]
    .sort((a, b) => (stepIndex.get(a.step) ?? 0) - (stepIndex.get(b.step) ?? 0) || rank.get(a.e.code)! - rank.get(b.e.code)!)
    .map((p) => p.e);
  return { ok: true, value: { v: 1, steps, summary: summarize(steps), exceptions: [...answered, ...planExceptions] } };
}

const nextPosition = (rows: ReadonlyArray<{ position: number }>): number => (rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0);
const skipStep = (kind: PlanKind, key: string, reason: SkipReason): PlanStep => ({ kind, key, op: 'skip', id: null, set: {}, refs: {}, reason }) as PlanStep;
const createStep = <K extends PlanKind>(kind: K, key: string, set: Sets[K]['create'], refs: Partial<Record<RefColumn[K], string>>): PlanStep =>
  ({ kind, key, op: 'create', id: null, set, refs, reason: null }) as PlanStep;
/** `update` when something changes, else `keep`. */
const changeStep = (kind: PlanKind, key: string, id: string, set: Record<string, unknown>): PlanStep =>
  (Object.keys(set).length > 0 ? { kind, key, op: 'update', id, set, refs: {}, reason: null } : { kind, key, op: 'keep', id, set: {}, refs: {}, reason: null }) as PlanStep;

/** The columns whose current value is blank and the draft's is not: written; nothing else. */
function fillBlank(current: object, draft: Readonly<Record<string, string>>): Record<string, unknown> {
  const now = current as Readonly<Record<string, unknown>>;
  const set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(draft)) {
    const clean = stripBlank(v);
    const was = now[k];
    if (clean !== '' && (typeof was !== 'string' || isBlank(was))) set[k] = clean;
  }
  return set;
}

/** The owner answered `rename`: the source's names replace the section's (a blank one never does). */
function replaceNames(current: { name_he: string; name_en: string }, name: Text): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  const n = cleanText(name);
  if (n.he !== '' && n.he !== current.name_he) set.name_he = n.he;
  if (n.en !== '' && n.en !== current.name_en) set.name_en = n.en;
  return set;
}

function summarize(steps: readonly PlanStep[]): PlanSummary {
  const out = {} as Record<PlanKind, Record<PlanOp, number>>;
  for (const k of PLAN_KINDS) out[k] = { create: 0, update: 0, keep: 0, skip: 0 };
  for (const s of steps) out[s.kind][s.op] += 1;
  return out;
}

// ---------------------------------------------------------------- the import RPCs' inputs (ADR-008)

/** The columns of `menu_imports` a client may read: everything except the raw text, which nobody reads back. The
 * phase-1 migration adds `raw_purged_at` to the table and to this list. */
export const IMPORT_CLIENT_COLUMNS = [
  'id', 'venue_id', 'source', 'status', 'raw_paths', 'input_sha256', 'rights_confirmed', 'parsed', 'exceptions', 'error_code', 'created_by',
  'applied_at', 'created_at', 'updated_at',
] as const;
type ImportViewBase = Omit<Pick<MenuImportRow, (typeof IMPORT_CLIENT_COLUMNS)[number]>, 'status' | 'parsed' | 'exceptions' | 'error_code' | 'applied_at'>;
/** An import as a client reads it, by status. */
export type MenuImportView = ImportViewBase & (
  | { readonly status: 'uploaded' | 'parsing'; readonly parsed: null; readonly exceptions: readonly []; readonly error_code: null; readonly applied_at: null }
  | { readonly status: 'parsed'; readonly parsed: ImportDraft; readonly exceptions: readonly ImportException[]; readonly error_code: null; readonly applied_at: null }
  | { readonly status: 'failed'; readonly parsed: ImportDraft | null; readonly exceptions: readonly ImportException[]; readonly error_code: string; readonly applied_at: null }
  | { readonly status: 'applied'; readonly parsed: ImportDraft; readonly exceptions: readonly ImportException[]; readonly error_code: null; readonly applied_at: string }
  | { readonly status: 'discarded'; readonly parsed: ImportDraft | null; readonly exceptions: readonly ImportException[]; readonly error_code: string | null; readonly applied_at: null }
);

export const TEXT_SOURCES = ['paste', 'wolt_text'] as const satisfies readonly ImportSource[];
export const IMAGE_SOURCES = ['scan', 'wolt_screenshots'] as const satisfies readonly ImportSource[];
export const IMPORT_TEXT_MAX = 60_000;
export const IMPORT_IMAGES_MAX = 20;
export const SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * `create_import`. Text sources send `text` (the database stores it privately and hashes it itself). Image sources
 * first upload to the private bucket under `<venue id>/imports/<import id>/`, where `importId` is a uuid the client
 * makes (it becomes the import's id), then send the `paths` and `inputSha256` (the SHA-256 of the files' own SHA-256s,
 * lowercase hex, joined in order). `rightsConfirmed`: the owner owns the photos in these screenshots (D33); only
 * `wolt_screenshots` may say so. A field left out counts as null.
 */
export type CreateImportInput = {
  readonly venueId: string;
  readonly source: ImportSource;
  readonly importId?: string | null;
  readonly text?: string | null;
  readonly paths?: readonly string[] | null;
  readonly inputSha256?: string | null;
  readonly rightsConfirmed: boolean;
};
export type CreateImportCode =
  | 'venue_unknown' | 'rate_limited' | 'id_invalid' | 'enum_invalid' | 'text_missing' | 'text_invalid' | 'text_too_long' | 'paths_missing'
  | 'too_many' | 'path_invalid' | 'sha_invalid' | 'input_mismatch' | 'rights_invalid' | 'id_taken';
export type CreateImportReply =
  | RpcOk<{ readonly importId: string; readonly status: MenuImportRow['status']; readonly reused: boolean }>
  | RpcFail<CreateImportCode>;

/** Codes: type, field_not_allowed, id_invalid, enum_invalid, text_missing, text_invalid, text_too_long, paths_missing,
 * too_many, path_invalid, sha_invalid, input_mismatch, rights_invalid. */
export function validateCreateImport(raw: unknown): Validation<CreateImportInput> {
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  const x = new Issues();
  only(x, raw, ['venueId', 'source', 'importId', 'text', 'paths', 'inputSha256', 'rightsConfirmed'], '');
  if (!isUuid(raw.venueId)) x.add('id_invalid', 'venueId');
  if (!oneOf(IMPORT_SOURCES, raw.source)) return { ok: false, errors: [...x.list, { code: 'enum_invalid', path: 'source' }] };
  const importId = raw.importId ?? null;
  if (importId !== null && !isUuid(importId)) x.add('id_invalid', 'importId');
  const textSource = (TEXT_SOURCES as readonly string[]).includes(raw.source);
  const text = raw.text ?? null, paths = raw.paths ?? null, sha = raw.inputSha256 ?? null;
  if (textSource) {
    if (paths !== null || sha !== null) x.add('input_mismatch', 'paths');
    if (!isString(text) || isBlank(text)) x.add('text_missing', 'text');
    else if (!isStorableText(text)) x.add('text_invalid', 'text');
    else if (textLength(text) > IMPORT_TEXT_MAX) x.add('text_too_long', 'text');
  } else {
    if (text !== null) x.add('input_mismatch', 'text');
    if (importId === null) x.add('id_invalid', 'importId');
    const folder = isUuid(raw.venueId) && isUuid(importId) ? `${(raw.venueId as string).toLowerCase()}/imports/${(importId as string).toLowerCase()}/` : null;
    if (!Array.isArray(paths) || paths.length === 0) x.add('paths_missing', 'paths');
    else if (paths.length > IMPORT_IMAGES_MAX) x.add('too_many', 'paths');
    else paths.forEach((p, i) => {
      if (!isRelPath(p) || textLength(p) > 200 || !isStorableText(p) || (folder !== null && !p.startsWith(folder))) x.add('path_invalid', `paths[${i}]`);
    });
    if (!isString(sha) || !SHA256_RE.test(sha)) x.add('sha_invalid', 'inputSha256');
  }
  if (typeof raw.rightsConfirmed !== 'boolean') x.add('type', 'rightsConfirmed');
  else if (raw.rightsConfirmed && raw.source !== 'wolt_screenshots') x.add('rights_invalid', 'rightsConfirmed');
  return x.ok ? { ok: true, value: raw as unknown as CreateImportInput } : { ok: false, errors: x.list };
}

/**
 * `claim_import_scan` (called by the scanner with the owner's own token, before any paid call): the import moves to
 * `parsing` and the scanner gets what it reads. A claim older than 10 minutes (a crashed read) may be claimed again.
 */
export type ClaimScanReply =
  | RpcOk<{
      readonly importId: string;
      readonly venueId: string;
      readonly source: (typeof IMAGE_SOURCES)[number];
      readonly paths: readonly string[];
      readonly rightsConfirmed: boolean;
      /** The venue's languages, for the reader's prompt and `draftExceptions`. */
      readonly langs: readonly Lang[];
    }>
  | RpcFail<'import_unknown' | 'not_scannable' | 'import_busy' | 'import_closed' | 'rate_limited'>;
/** Why the scanner marks an import `failed` (`menu_imports.error_code`). */
export const SCAN_ERROR_CODES = ['image_unreadable', 'model_failed', 'draft_invalid', 'timeout'] as const;
export type ScanErrorCode = (typeof SCAN_ERROR_CODES)[number];

/** `save_import_draft`: the client (text sources) or the scanner (image sources) stores what it read. */
export type SaveDraftInput = { readonly importId: string; readonly draft: ImportDraft };
export type SaveDraftReply =
  | RpcOk<{ readonly exceptions: readonly ImportException[]; readonly counts: DraftCounts }>
  | RpcFail<'invalid_draft' | 'too_large' | 'source_mismatch' | 'rights_unconfirmed' | 'import_unknown' | 'import_busy' | 'import_closed'>;

export function validateSaveDraft(raw: unknown): Validation<SaveDraftInput> {
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  const x = new Issues();
  only(x, raw, ['importId', 'draft'], '');
  if (!isUuid(raw.importId)) x.add('id_invalid', 'importId');
  const d = validateDraft(raw.draft);
  if (d.ok === false) for (const e of d.errors) x.add(e.code, e.path ? `draft.${e.path}` : 'draft');
  return x.ok ? { ok: true, value: raw as unknown as SaveDraftInput } : { ok: false, errors: x.list };
}

/**
 * `apply_import`: `draft` is the one the owner looked at (the database refuses with `draft_changed` when the stored
 * draft is another), `decisions` their answers. The reply carries the plan that was applied.
 */
export type ApplyImportInput = { readonly importId: string; readonly draft: ImportDraft; readonly decisions: ImportDecisions };
export type ApplyImportReply =
  | RpcOk<{ readonly plan: ImportPlan }>
  | RpcFail<'draft_changed' | 'invalid_decisions' | 'plan_invalid' | 'apply_failed' | 'import_unknown' | 'not_parsed' | 'import_closed'>;

export function validateApplyImport(raw: unknown): Validation<ApplyImportInput> {
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  const x = new Issues();
  only(x, raw, ['importId', 'draft', 'decisions'], '');
  const base = validateSaveDraft({ importId: raw.importId, draft: raw.draft });
  if (base.ok === false) for (const e of base.errors) x.add(e.code, e.path);
  const dec = validateDecisions(raw.decisions);
  if (dec.ok === false) for (const e of dec.errors) x.add(e.code, e.path ? `decisions.${e.path}` : 'decisions');
  return x.ok ? { ok: true, value: raw as unknown as ApplyImportInput } : { ok: false, errors: x.list };
}
