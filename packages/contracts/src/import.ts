/**
 * The menu import (F03, D33, Hopa H01–H03 and acceptance test 1): what every source produces before anything is saved,
 * the exceptions the owner sees, and the plan that merges it into the venue's menu.
 *
 * The flow (ADR-006): a source (`IMPORT_SOURCES`) → a reader (the paste and Wolt-text parsers in `packages/import`, or
 * the scanner for photos and Wolt screenshots) → an `ImportDraft` → `save_import_draft` (validated, exceptions computed
 * by the database) → the owner's preview with `draftExceptions` → `apply_import` with the owner's `ImportDecisions`,
 * which runs exactly the plan `planApply` describes: create, update or keep, **never a delete**, logged.
 *
 * Rules the readers and the plan keep:
 * - **Nothing is invented.** Tags only from `TAGS` and only when the source states them; allergens only as the
 *   source's own words (never generated, never inferred from a dish name); a price only as read.
 * - **Prices are shown before they count.** Applying needs `decisions.pricesConfirmed` when the draft carries a price,
 *   and an import never publishes: the menu goes live only through `publish_menu`.
 * - **Photos need rights (D33).** A photo from Wolt enters only with `rights: 'confirmed'` (the owner said so when
 *   uploading) or the owner's `confirm_rights` choice; otherwise the dish gets a labelled illustration.
 * - **No server-side fetching of Wolt** (D33): Wolt arrives only as what the owner gives us (screenshots or text).
 *
 * The database implements the same functions in SQL (`app.validate_import_draft`, `app.import_key`,
 * `app.import_exceptions`, `app.plan_import`); `supabase/tests` compares them with these on the same inputs. Every rule
 * below is written so it can be implemented there: no Unicode categories (explicit code point ranges), no locale (ASCII
 * lowercasing only), ties broken by position and then by id (uuid order = lowercase hex order in both).
 */
import {
  BLANK_CLASS, cleanText, Issues, isBlank, isInt, isObject, isString, isUuid, LANGS, oneOf, stripBlank, type Issue, type Lang, type Text,
  type Validation,
} from './common.ts';
import type { AddonGroupRow, AddonOptionRow, DishAddonGroupRow, DishRow, MenuImportRow, SectionRow } from './domain.ts';
import {
  IMPORT_SOURCES, LIMITS, ROOMS, SECTION_KINDS, SELECTIONS, TAGS, type ImportSource, type Room, type SectionKind, type SelectionKind, type Tag,
} from './enums.ts';
import { isRelPath } from './validate-snapshot.ts';

export const IMPORT_DRAFT_VERSION = 1 as const;

/** D33: a photo's rights as the owner stated them. `unknown` = not confirmed; such a photo is never used. */
export const PHOTO_RIGHTS = ['confirmed', 'unknown'] as const;
export type PhotoRights = (typeof PHOTO_RIGHTS)[number];

/** A node's key: stable inside one draft, unique across it. Lowercase letters, digits, `_`, `.`, `-`; at most 64. */
export const DRAFT_KEY_RE = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const STOCK_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
/** A group's units, as the database bounds them (`addon_groups.min_units` 0–30, `max_units` 1–30). */
export const GROUP_UNITS_MAX = 30;
/** What a price looked like in the source when it could not be read as a number ("₪ 4O", "market price"). */
export const PRICE_TEXT_MAX = 40;
/** Hard bounds on a draft's shape: a reader that goes past them is broken, so the draft is refused (`too_large`).
 * Between `LIMITS` and these, the draft is kept and the extra nodes are `too_many` exceptions. The database also
 * refuses a draft whose stored size reaches 400 kB (`menu_imports.parsed`). */
export const DRAFT_CAPS = { sections: 80, dishes: 800, groups: 400, optionsPerGroup: 60, groupsPerDish: 16 } as const;

export type DraftPhoto = {
  /** In the private bucket, under the venue's folder (`<venue id>/imports/<import id>/…`). */
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

/** A group attached to a dish; `min`/`max` may only tighten the group's own (null = the group's). */
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
};

// ---------------------------------------------------------------- the matching key

/** Combining marks dropped from a key: Latin diacritics, and Hebrew points and cantillation (letters stay). */
const KEY_MARKS = /[\u0300-\u036F\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7]/gu;
/**
 * Characters that separate words in a key: every blank (`BLANK_CLASS`), ASCII punctuation and symbols, Latin-1
 * punctuation and symbols (U+00A1–U+00BF, × ÷), Hebrew punctuation (maqaf, paseq, sof pasuq, nun hafukha, geresh,
 * gershayim), general punctuation (U+2010–U+2027, U+2030–U+205E), currency signs (U+20A0–U+20C0), arrows, maths,
 * technical and other symbols and dingbats (U+2190–U+2BFF), and the emoji blocks (U+1F000–U+1FAFF).
 */
const KEY_SEPARATORS = new RegExp(
  `[${BLANK_CLASS}\\x21-\\x2F\\x3A-\\x40\\x5B-\\x60\\x7B-\\x7E\\u00A1-\\u00BF\\u00D7\\u00F7\\u05BE\\u05C0\\u05C3\\u05C6\\u05F3\\u05F4` +
    `\\u2010-\\u2027\\u2030-\\u205E\\u20A0-\\u20C0\\u2190-\\u2BFF\\u{1F000}-\\u{1FAFF}]+`,
  'gu',
);

/**
 * The normalisation that decides whether two names are "the same" for an import (a section, dish, group or option the
 * venue already has): NFKD; drop `KEY_MARKS`; lowercase A–Z only (no locale, so the database agrees exactly; Hebrew
 * has no case); every run of `KEY_SEPARATORS` becomes one space; no space at either end.
 * "Crème Brûlée!" → "creme brulee"; "שַׁקְשׁוּקָה" → "שקשוקה"; "צ׳יפס" and "צ'יפס" → "צ יפס"; "Coffee ☕️" → "coffee".
 *
 * SQL (`app.import_key`): `btrim(regexp_replace(translate(regexp_replace(normalize(p, NFKD), <marks>, '', 'g'),
 * 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '[' || <separators> || ']+', ' ', 'g'), ' ')`.
 */
export function importKey(text: string): string {
  return text
    .normalize('NFKD')
    .replace(KEY_MARKS, '')
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
    .replace(KEY_SEPARATORS, ' ')
    .replace(/^ | $/g, '');
}

/** How well two bilingual names match: 2 when the Hebrew keys are equal (and not empty), plus 1 for English. */
export function nameScore(a: Text, b: Text): number {
  const he = importKey(a.he);
  const en = importKey(a.en);
  return (he !== '' && he === importKey(b.he) ? 2 : 0) + (en !== '' && en === importKey(b.en) ? 1 : 0);
}

// ---------------------------------------------------------------- validation

function text(x: Issues, v: unknown, path: string, max: number, needName = false): void {
  if (!isObject(v) || !isString(v.he) || !isString(v.en)) return void x.add('type', path);
  if (v.he.length > max || v.en.length > max) x.add('text_too_long', path);
  if (needName && isBlank(v.he) && isBlank(v.en)) x.add('name_missing', path);
}

function translated(x: Issues, v: unknown, path: string, texts: readonly unknown[]): void {
  if (!Array.isArray(v) || !v.every((l) => oneOf(LANGS, l)) || new Set(v).size !== v.length) return void x.add('translated_invalid', path);
  // a translated language has text of its own in at least one of the node's fields
  for (const l of v as Lang[]) if (!texts.some((t) => isObject(t) && isString(t[l]) && !isBlank(t[l]))) x.add('translated_invalid', path);
}

function priceOk(v: unknown): boolean {
  return v === null || (isInt(v) && v >= 0 && v <= LIMITS.price);
}

function priceTextOk(x: Issues, v: unknown, path: string): void {
  if (v === null) return;
  if (!isString(v)) x.add('type', path);
  else if (v.length > PRICE_TEXT_MAX) x.add('text_too_long', path);
}

function limitsOk(min: unknown, max: unknown): boolean {
  const lo = min === null || (isInt(min) && min >= 0 && min <= GROUP_UNITS_MAX);
  const hi = max === null || (isInt(max) && max >= 1 && max <= GROUP_UNITS_MAX);
  return lo && hi && !(isInt(min) && isInt(max) && min > max);
}

/**
 * Is this a well-formed draft? Codes (the database's `app.validate_import_draft` uses the same): version, type,
 * enum_invalid, key_invalid, key_duplicate, too_large, name_missing, text_too_long, translated_invalid, price_invalid,
 * path_invalid, stock_invalid, limits_invalid, limits_loosened, single_max, options_empty, option_qty_invalid,
 * opener_qty, opens_self, defaults_exceed, ref_unknown, addon_duplicate.
 *
 * What the owner can fix in the preview (no price, limits guessed, a duplicate, two levels of nesting, too many) is
 * not an error here: it is an exception (`draftExceptions`).
 */
export function validateDraft(raw: unknown): Validation<ImportDraft> {
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  if (raw.v !== IMPORT_DRAFT_VERSION) return { ok: false, errors: [{ code: 'version', path: 'v' }] };
  const x = new Issues();
  if (!oneOf(IMPORT_SOURCES, raw.source)) x.add('enum_invalid', 'source');
  if (!Array.isArray(raw.sections)) x.add('type', 'sections');
  if (!Array.isArray(raw.groups)) x.add('type', 'groups');
  if (!x.ok) return { ok: false, errors: x.list };
  const sections = raw.sections as unknown[];
  const groups = raw.groups as unknown[];

  const keys = new Set<string>();
  const key = (v: unknown, path: string): void => {
    if (!isString(v) || !DRAFT_KEY_RE.test(v)) x.add('key_invalid', path);
    else if (keys.has(v)) x.add('key_duplicate', path);
    else keys.add(v);
  };

  // ---- groups first, so dishes and openers can be checked against them
  if (groups.length > DRAFT_CAPS.groups) x.add('too_large', 'groups');
  const groupByKey = new Map<string, Record<string, unknown>>();
  const groupLimits = new Map<string, { min: number; max: number }>();
  groups.forEach((g, i) => {
    const p = `groups[${i}]`;
    if (!isObject(g)) return void x.add('type', p);
    key(g.key, `${p}.key`);
    if (isString(g.key) && !groupByKey.has(g.key)) groupByKey.set(g.key, g);
    text(x, g.name, `${p}.name`, 60, true);
    translated(x, g.translated, `${p}.translated`, [g.name]);
    if (!oneOf(SELECTIONS, g.selection)) x.add('enum_invalid', `${p}.selection`);
    const limits = limitsOk(g.min, g.max);
    if (!limits || (g.selection === 'single' && isInt(g.min) && g.min > 1)) x.add('limits_invalid', p);
    else if (g.selection === 'single' && g.max !== null && g.max !== 1) x.add('single_max', p);
    if (!Array.isArray(g.options) || g.options.length === 0) return void x.add('options_empty', `${p}.options`);
    if (g.options.length > DRAFT_CAPS.optionsPerGroup) x.add('too_large', `${p}.options`);
    let defaults = 0;
    let capacity = 0;
    let quantitiesOk = true;
    g.options.forEach((o, j) => {
      const q = `${p}.options[${j}]`;
      if (!isObject(o)) return void x.add('type', q);
      key(o.key, `${q}.key`);
      text(x, o.name, `${q}.name`, 60, true);
      translated(x, o.translated, `${q}.translated`, [o.name]);
      if (!priceOk(o.price)) x.add('price_invalid', `${q}.price`);
      priceTextOk(x, o.priceText, `${q}.priceText`);
      if (!isInt(o.maxQty) || o.maxQty < 1 || o.maxQty > LIMITS.optionQuantity) {
        x.add('option_qty_invalid', `${q}.maxQty`);
        quantitiesOk = false;
      } else capacity += o.maxQty;
      if (typeof o.default !== 'boolean') x.add('type', `${q}.default`);
      else if (o.default) defaults += 1;
      if (o.opens !== null) {
        if (!isString(o.opens)) x.add('type', `${q}.opens`);
        else if (o.opens === g.key) x.add('opens_self', `${q}.opens`);
        if (o.maxQty !== 1) x.add('opener_qty', `${q}.maxQty`);
      }
    });
    if (limits && quantitiesOk && oneOf(SELECTIONS, g.selection)) {
      const own = effectiveLimits(g.selection, g.min as number | null, g.max as number | null, capacity);
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
      key(d.key, `${q}.key`);
      text(x, d.name, `${q}.name`, LIMITS.nameLength, true);
      text(x, d.desc, `${q}.desc`, LIMITS.descLength);
      translated(x, d.translated, `${q}.translated`, [d.name, d.desc]);
      if (!priceOk(d.price)) x.add('price_invalid', `${q}.price`);
      priceTextOk(x, d.priceText, `${q}.priceText`);
      text(x, d.priceNote, `${q}.priceNote`, LIMITS.noteLength);
      if (!Array.isArray(d.tags) || !d.tags.every((t) => oneOf(TAGS, t)) || new Set(d.tags).size !== d.tags.length) x.add('enum_invalid', `${q}.tags`);
      text(x, d.allergens, `${q}.allergens`, 300);
      if (d.photo !== null) {
        if (!isObject(d.photo)) x.add('type', `${q}.photo`);
        else {
          if (!isRelPath(d.photo.path) || d.photo.path.length > 200) x.add('path_invalid', `${q}.photo.path`);
          if (!oneOf(PHOTO_RIGHTS, d.photo.rights)) x.add('enum_invalid', `${q}.photo.rights`);
        }
      }
      if (d.illustration !== null && !(isString(d.illustration) && STOCK_RE.test(d.illustration))) x.add('stock_invalid', `${q}.illustration`);
      if (!Array.isArray(d.groups)) return void x.add('type', `${q}.groups`);
      if (d.groups.length > DRAFT_CAPS.groupsPerDish) x.add('too_large', `${q}.groups`);
      const seen = new Set<string>();
      d.groups.forEach((a, k) => {
        const r = `${q}.groups[${k}]`;
        if (!isObject(a)) return void x.add('type', r);
        const g = isString(a.group) ? groupByKey.get(a.group) : undefined;
        if (!g) return void x.add('ref_unknown', `${r}.group`);
        if (seen.has(a.group as string)) return void x.add('addon_duplicate', r);
        seen.add(a.group as string);
        if (!limitsOk(a.min, a.max)) return void x.add('limits_invalid', r);
        if (g.selection === 'single' && a.max !== null && a.max !== 1) return void x.add('single_max', r);
        const own = groupLimits.get(a.group as string);
        if (own && ((isInt(a.min) && a.min < own.min) || (isInt(a.max) && a.max > own.max))) x.add('limits_loosened', r);
      });
    });
  });
  if (dishCount > DRAFT_CAPS.dishes) x.add('too_large', 'sections');

  return x.ok ? { ok: true, value: raw as unknown as ImportDraft } : { ok: false, errors: x.list };
}

/**
 * A group's limits as the plan uses them. A stated limit is kept; a missing one is guessed: a single choice is
 * required (min 1, max 1); a multiple choice is optional (min 0) up to everything its options allow (the sum of
 * `maxQty`, at most `GROUP_UNITS_MAX`). `stated` = the source gave at least one of the two; `capacity` = the sum of
 * `maxQty` (a minimum above it can never be met).
 */
export function draftGroupLimits(g: DraftGroup): { min: number; max: number; stated: boolean; capacity: number } {
  const capacity = g.options.reduce((n, o) => n + o.maxQty, 0);
  return { ...effectiveLimits(g.selection, g.min, g.max, capacity), stated: g.min !== null || g.max !== null, capacity };
}

function effectiveLimits(selection: SelectionKind, min: number | null, max: number | null, capacity: number): { min: number; max: number } {
  if (selection === 'single') return { min: min ?? 1, max: 1 };
  return { min: min ?? 0, max: max ?? Math.max(1, Math.min(capacity, GROUP_UNITS_MAX), min ?? 0) };
}

// ---------------------------------------------------------------- exceptions

/**
 * What the owner sees before anything is saved. `fix` blocks applying until it is answered (by a choice from
 * `EXCEPTION_CHOICES`, or by editing the draft so the exception goes away); `check` is shown and applying accepts it
 * with its first choice unless the owner picks another.
 */
export const IMPORT_EXCEPTIONS = {
  /** dish: the source shows no price. */
  price_missing: 'fix',
  /** dish: the source shows a price the reader could not read (`priceText`). */
  price_unreadable: 'fix',
  /** option: the reader could not read the option's price (an option always has one; 0 = free). */
  option_price_unreadable: 'fix',
  /** group: the source states no limits; the plan uses `draftGroupLimits`' guess. */
  limits_guessed: 'check',
  /** group: the stated minimum is more than its options can add up to. */
  limits_unreachable: 'fix',
  /** section: the same name (`importKey`) as an earlier section of the draft. */
  section_duplicate: 'fix',
  /** dish: the same name as an earlier dish of the same section. */
  dish_duplicate: 'fix',
  /** any named node: no name in one of the venue's languages (the guest menu falls back to the other). */
  name_missing_lang: 'check',
  /** any named node: text the reader translated; Hebrew and French need a native read. */
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
} as const;
export type ImportExceptionCode = keyof typeof IMPORT_EXCEPTIONS;
export type ExceptionSeverity = 'fix' | 'check';
export const IMPORT_EXCEPTION_CODES = Object.keys(IMPORT_EXCEPTIONS) as ImportExceptionCode[];

export const IMPORT_CHOICES = [
  'accept', 'skip', 'no_price', 'free', 'clamp', 'merge', 'keep_both', 'unlink', 'illustration', 'confirm_rights',
] as const;
/** What the owner may answer to an exception. For a `check`, the first is what applying does by default. */
export type ImportChoice = (typeof IMPORT_CHOICES)[number];
export const EXCEPTION_CHOICES: Readonly<Record<ImportExceptionCode, readonly ImportChoice[]>> = {
  price_missing: ['no_price', 'skip'],
  price_unreadable: ['no_price', 'skip'],
  option_price_unreadable: ['free', 'skip'],
  limits_guessed: ['accept', 'skip'],
  limits_unreachable: ['clamp', 'skip'],
  section_duplicate: ['merge', 'keep_both'],
  dish_duplicate: ['skip', 'keep_both'],
  name_missing_lang: ['accept'],
  translation_check: ['accept'],
  nesting_too_deep: ['unlink', 'skip'],
  too_many: ['skip'],
  photo_rights_unknown: ['illustration', 'confirm_rights'],
  allergens_check: ['accept'],
};

/**
 * One exception, pointing at a node of the draft by key. A dish's group is keyed `<dish key>><group key>` (a `>` never
 * appears in a node key). `path` locates the node in the draft for the preview.
 */
export type ImportException = {
  readonly code: ImportExceptionCode;
  readonly severity: ExceptionSeverity;
  readonly key: string;
  readonly path: string;
};

/** The id an owner's choice is filed under: `<code>@<key>`. */
export const exceptionId = (e: { readonly code: string; readonly key: string }): string => `${e.code}@${e.key}`;
export const linkKey = (dishKey: string, groupKey: string): string => `${dishKey}>${groupKey}`;

export type DraftExceptionOptions = {
  /** The venue's languages: a name missing in one of these is `name_missing_lang`. Default: Hebrew and English. */
  readonly langs?: readonly Lang[];
};

/**
 * Every exception of a draft, pure, in this order: sections (each, then its dishes in order), then groups (each, then
 * its options). Within one node the codes come in `IMPORT_EXCEPTIONS` order. The database's `app.import_exceptions`
 * returns the same list in the same order, and `save_import_draft` stores it in `menu_imports.exceptions`.
 * Expects a draft that `validateDraft` accepted.
 */
export function draftExceptions(draft: ImportDraft, opts: DraftExceptionOptions = {}): ImportException[] {
  const langs = opts.langs ?? LANGS;
  const out: ImportException[] = [];
  const push = (code: ImportExceptionCode, key: string, path: string): void => void out.push({ code, severity: IMPORT_EXCEPTIONS[code], key, path });
  const named = (name: Text, tr: readonly Lang[], key: string, path: string, extra: readonly Text[] = []): void => {
    if (langs.some((l) => isBlank(name[l]))) push('name_missing_lang', key, path);
    if (tr.length > 0 && [name, ...extra].some((t) => tr.some((l) => !isBlank(t[l])))) push('translation_check', key, path);
  };

  // which groups are opened, and by which options: an opener inside an opened group is two levels deep
  const opened = new Set<string>();
  for (const g of draft.groups) for (const o of g.options) if (o.opens !== null) opened.add(o.opens);

  const seenSections: Text[] = [];
  let dishN = 0;
  draft.sections.forEach((s, i) => {
    const p = `sections[${i}]`;
    if (i >= LIMITS.sections) push('too_many', s.key, p);
    if (seenSections.some((t) => nameScore(s.name, t) > 0)) push('section_duplicate', s.key, p);
    seenSections.push(s.name);
    named(s.name, s.translated, s.key, p);
    const seenDishes: Text[] = [];
    s.dishes.forEach((d, j) => {
      const q = `${p}.dishes[${j}]`;
      const priceRead = d.price !== null;
      const priceShown = d.priceText !== null && !isBlank(d.priceText);
      if (!priceRead && !priceShown) push('price_missing', d.key, q);
      if (!priceRead && priceShown) push('price_unreadable', d.key, q);
      if (seenDishes.some((t) => nameScore(d.name, t) > 0)) push('dish_duplicate', d.key, q);
      seenDishes.push(d.name);
      named(d.name, d.translated, d.key, q, [d.desc]);
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
    const lim = draftGroupLimits(g);
    if (!lim.stated) push('limits_guessed', g.key, p);
    if (lim.min > lim.capacity) push('limits_unreachable', g.key, p);
    named(g.name, g.translated, g.key, p);
    if (i >= LIMITS.addonGroups) push('too_many', g.key, p);
    g.options.forEach((o, j) => {
      const q = `${p}.options[${j}]`;
      if (o.price === null) push('option_price_unreadable', o.key, q);
      named(o.name, o.translated, o.key, q);
      if (o.opens !== null && opened.has(g.key)) push('nesting_too_deep', o.key, q);
      if (j >= LIMITS.optionsPerGroup) push('too_many', o.key, q);
    });
  });
  return sortWithinNode(out);
}

/** Keeps the node order and puts each node's codes in `IMPORT_EXCEPTIONS` order (a stable rule SQL can follow). */
function sortWithinNode(list: ImportException[]): ImportException[] {
  const rank = new Map(IMPORT_EXCEPTION_CODES.map((c, i) => [c, i] as const));
  const firstAt = new Map<string, number>();
  list.forEach((e, i) => { if (!firstAt.has(e.key)) firstAt.set(e.key, i); });
  return [...list].sort((a, b) => firstAt.get(a.key)! - firstAt.get(b.key)! || rank.get(a.code)! - rank.get(b.code)!);
}

export type DraftCounts = { readonly sections: number; readonly dishes: number; readonly groups: number; readonly options: number; readonly photos: number };
export function draftCounts(d: ImportDraft): DraftCounts {
  let dishes = 0;
  let photos = 0;
  for (const s of d.sections) for (const x of s.dishes) { dishes += 1; if (x.photo) photos += 1; }
  return { sections: d.sections.length, dishes, groups: d.groups.length, options: d.groups.reduce((n, g) => n + g.options.length, 0), photos };
}

// ---------------------------------------------------------------- the owner's decisions

export type ImportDecisions = {
  readonly v: 1;
  /** The owner saw the prices the draft carries (required when it carries any). */
  readonly pricesConfirmed: boolean;
  /** `exceptionId(e)` → the owner's choice. Ids that match no exception of the draft are ignored. */
  readonly choices: Readonly<Record<string, ImportChoice>>;
};

const CHOICE_ID_RE = /^[a-z_]{1,40}@[a-z0-9][a-z0-9_.>-]{0,129}$/;

/** Codes: type, version, choice_invalid. */
export function validateDecisions(raw: unknown): Validation<ImportDecisions> {
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  const x = new Issues();
  if (raw.v !== 1) x.add('version', 'v');
  if (typeof raw.pricesConfirmed !== 'boolean') x.add('type', 'pricesConfirmed');
  if (!isObject(raw.choices)) x.add('type', 'choices');
  else {
    const entries = Object.entries(raw.choices);
    if (entries.length > 5000) x.add('too_large', 'choices');
    for (const [k, v] of entries) if (!CHOICE_ID_RE.test(k) || !oneOf(IMPORT_CHOICES, v)) x.add('choice_invalid', `choices.${k}`);
  }
  return x.ok ? { ok: true, value: raw as unknown as ImportDecisions } : { ok: false, errors: x.list };
}

// ---------------------------------------------------------------- the plan

/** What the venue already has, as the plan needs it (the client app reads it under RLS; SQL reads the tables). */
export type ExistingMenu = {
  readonly sections: ReadonlyArray<Pick<SectionRow, 'id' | 'position' | 'name_he' | 'name_en'>>;
  readonly dishes: ReadonlyArray<Pick<DishRow,
    'id' | 'section_id' | 'position' | 'name_he' | 'name_en' | 'desc_he' | 'desc_en' | 'price' | 'price_note_he' | 'price_note_en' | 'tags' |
    'allergens_he' | 'allergens_en' | 'asset_id' | 'stock_id'>>;
  readonly groups: ReadonlyArray<Pick<AddonGroupRow, 'id' | 'name_he' | 'name_en' | 'selection'>>;
  readonly options: ReadonlyArray<Pick<AddonOptionRow, 'id' | 'group_id' | 'position' | 'name_he' | 'name_en' | 'price' | 'opens_group_id'>>;
  readonly dishGroups: ReadonlyArray<Pick<DishAddonGroupRow, 'dish_id' | 'group_id' | 'position'>>;
};

export const EMPTY_MENU: ExistingMenu = { sections: [], dishes: [], groups: [], options: [], dishGroups: [] };

export const PLAN_KINDS = ['section', 'group', 'option', 'dish', 'dish_group', 'photo'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];
export const PLAN_OPS = ['create', 'update', 'keep', 'skip'] as const;
export type PlanOp = (typeof PLAN_OPS)[number];
/** Why a node is left out: the owner's choice; a duplicate section merged into the first; a section with nothing to
 * create; a node whose section or group is left out. */
export const SKIP_REASONS = ['choice', 'merged', 'empty', 'parent_skipped'] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

/**
 * One row the import creates, updates, keeps or leaves out. `set` holds database columns (snake_case) and their
 * values: every column the import writes for `create`, only the changed ones for `update`, nothing for `keep` and
 * `skip`. `refs` names, per column, the draft key of a row this same plan creates (its id exists only once applied).
 * `id` is the existing row for `update` and `keep`. A `dish_group` is keyed `linkKey(dish, group)`; a `photo` by its
 * dish's key (it creates an `assets` row for the picture pipeline and the owner's approval).
 */
export type PlanStep = {
  readonly kind: PlanKind;
  readonly key: string;
  readonly op: PlanOp;
  readonly id: string | null;
  readonly set: Readonly<Record<string, unknown>>;
  readonly refs: Readonly<Record<string, string>>;
  readonly reason: SkipReason | null;
};

export type PlanSummary = Readonly<Record<PlanKind, Readonly<Record<PlanOp, number>>>>;
export type ImportPlan = { readonly v: 1; readonly steps: readonly PlanStep[]; readonly summary: PlanSummary };

/**
 * Turns a draft and the owner's decisions into what `apply_import` will do to the venue's menu: never a delete, never
 * a duplicate of what the venue has (Hopa test 1). Errors (the plan is not made): `exception_unresolved` (a `fix`
 * without an allowed answer), `choice_invalid` (an answer the exception does not allow), `prices_unconfirmed`,
 * `too_many` (with what the venue has, past `LIMITS`), `nesting_too_deep` (a new choice would open an existing group
 * that has choices opening groups of its own).
 *
 * The rules, in the order the database's `app.plan_import` applies them:
 * 1. **Answers.** Every exception of `draftExceptions(draft, opts)` is answered by its choice, or by its first choice
 *    when it is a `check`. `skip` leaves the node out (a section takes its dishes with it; a group takes its options,
 *    the dish links to it, and the `opens` pointing at it). `merge` sends a duplicate section's dishes to the first
 *    section of that name. `no_price` keeps the price empty; `free` makes an option's price 0; `clamp` lowers a group's
 *    minimum to what its options allow; `unlink` keeps an option but it opens nothing; `confirm_rights` brings a photo
 *    in (`illustration`, the default, does not).
 * 2. **Matching.** Two names match when `nameScore > 0`. Draft order; the best score wins; ties go to the lower
 *    position, then the smaller id. A section matches an unclaimed existing section. A group matches an existing group
 *    with the same `selection` whose options cover the draft's (every draft option matches a distinct existing option
 *    of that group); among those, the best score, then the fewest existing options, then the smaller id; several
 *    draft groups may match the same one. A dish matches an unclaimed existing dish anywhere on the menu, preferring
 *    the section its draft section resolved to.
 * 3. **Updates** never take anything away: a name, description, price note or allergen text is written only where
 *    the venue's is blank; a dish's or option's price is replaced when the draft read one and it differs (a missing or
 *    unreadable price never replaces the venue's, whatever the answer); tags only gain (the venue's, then the draft's
 *    new ones in draft order); a dish's illustration is set only when it has neither a photo nor an illustration; a
 *    matched dish stays in its section; a matched group keeps its limits, selection and options (and their `opens`).
 * 4. **Creates** append: positions continue after the highest existing one (or from 0), in draft order. A created
 *    group's label is its English name, else its Hebrew one; its limits count as confirmed only when the source stated
 *    them (`limits_confirmed`, which the dashboard's `group_without_limits` nudge reads). A link is created when the
 *    dish and group are not linked yet, with the draft's own dish limits. A draft section with nothing to create and
 *    no match is left out (`empty`). A photo is created for a dish with no photo yet when its rights are confirmed (by
 *    the draft or `confirm_rights`).
 * 5. **Order** of the steps: sections, groups, options, dishes, dish groups, photos; each kind in draft order.
 */
export function planApply(draft: ImportDraft, existing: ExistingMenu, decisions: ImportDecisions, opts: DraftExceptionOptions = {}): Validation<ImportPlan> {
  const x = new Issues();

  // ---- 1. answers
  const choice = new Map<string, ImportChoice>();
  for (const e of draftExceptions(draft, opts)) {
    const allowed = EXCEPTION_CHOICES[e.code];
    const c = decisions.choices[exceptionId(e)];
    if (c === undefined) {
      if (e.severity === 'fix') x.add('exception_unresolved', e.key, e.code);
      else choice.set(exceptionId(e), allowed[0]!);
    } else if (!allowed.includes(c)) x.add('choice_invalid', e.key, e.code);
    else choice.set(exceptionId(e), c);
  }
  const chosen = (code: ImportExceptionCode, key: string): ImportChoice | undefined => choice.get(`${code}@${key}`);
  const skipped = (key: string): boolean => IMPORT_EXCEPTION_CODES.some((code) => chosen(code, key) === 'skip');
  const groupSkipped = new Set(draft.groups.filter((g) => skipped(g.key)).map((g) => g.key));

  const pricesShown =
    draft.sections.some((s) => !skipped(s.key) && s.dishes.some((d) => d.price !== null && !skipped(d.key))) ||
    draft.groups.some((g) => !groupSkipped.has(g.key) && g.options.some((o) => o.price !== null && o.price > 0 && !skipped(o.key)));
  if (pricesShown && !decisions.pricesConfirmed) x.add('prices_unconfirmed', 'pricesConfirmed');
  if (!x.ok) return { ok: false, errors: x.list };

  const textOf = (r: { name_he: string; name_en: string }): Text => ({ he: r.name_he, en: r.name_en });
  const byPosThenId = (a: { position: number; id: string }, b: { position: number; id: string }): number =>
    a.position - b.position || compareIds(a.id, b.id);
  const best = <T extends { position: number; id: string; name_he: string; name_en: string }>(name: Text, rows: readonly T[],
    tie: (a: T, b: T) => number = () => 0): T | undefined =>
    rows.filter((r) => nameScore(name, textOf(r)) > 0)
      .sort((a, b) => nameScore(name, textOf(b)) - nameScore(name, textOf(a)) || tie(a, b) || byPosThenId(a, b))[0];
  type Target = { readonly id: string | null; readonly ref: string | null };

  // ---- 2. sections: matched, merged or left out now; created ones are decided once their dishes are known
  const sectionStep = new Map<string, PlanStep>();
  const sectionTarget = new Map<string, Target>();
  const mergedInto = new Map<string, string>();
  const claimedSections = new Set<string>();
  draft.sections.forEach((s, i) => {
    if (skipped(s.key)) return void sectionStep.set(s.key, skipStep('section', s.key, 'choice'));
    if (chosen('section_duplicate', s.key) === 'merge') {
      const first = draft.sections.slice(0, i).find((t) => nameScore(s.name, t.name) > 0)!;
      mergedInto.set(s.key, mergedInto.get(first.key) ?? first.key);
      return void sectionStep.set(s.key, skipStep('section', s.key, 'merged'));
    }
    const m = best(s.name, existing.sections.filter((e) => !claimedSections.has(e.id)));
    if (!m) return void sectionTarget.set(s.key, { id: null, ref: s.key });
    claimedSections.add(m.id);
    sectionTarget.set(s.key, { id: m.id, ref: null });
    const set = fillBlank(m, { name_he: s.name.he, name_en: s.name.en });
    sectionStep.set(s.key, changeStep('section', s.key, m.id, set));
  });
  for (const [dup, first] of mergedInto) {
    const t = sectionTarget.get(first);
    if (t) sectionTarget.set(dup, t);
  }

  // ---- 3. groups and their options
  const groupTarget = new Map<string, Target>();
  const groupSteps: PlanStep[] = [];
  const optionSteps: PlanStep[] = [];
  const optionsOf = (gid: string) => existing.options.filter((o) => o.group_id === gid);
  /** The existing option each kept draft option matches (each at most once), or null when one has no match. */
  const cover = (g: DraftGroup, gid: string): Map<string, string> | null => {
    const claimed = new Set<string>();
    const out = new Map<string, string>();
    for (const o of g.options) {
      if (skipped(o.key)) continue;
      const m = best(o.name, optionsOf(gid).filter((e) => !claimed.has(e.id)));
      if (!m) return null;
      claimed.add(m.id);
      out.set(o.key, m.id);
    }
    return out;
  };
  const createdGroups: DraftGroup[] = [];
  for (const g of draft.groups) {
    if (groupSkipped.has(g.key)) {
      groupSteps.push(skipStep('group', g.key, 'choice'));
      for (const o of g.options) optionSteps.push(skipStep('option', o.key, 'parent_skipped'));
      continue;
    }
    const m = existing.groups
      .filter((e) => e.selection === g.selection && nameScore(g.name, textOf(e)) > 0)
      .map((e) => ({ e, covered: cover(g, e.id), n: optionsOf(e.id).length, score: nameScore(g.name, textOf(e)) }))
      .filter((c) => c.covered !== null)
      .sort((a, b) => b.score - a.score || a.n - b.n || compareIds(a.e.id, b.e.id))[0];
    if (!m) {
      groupTarget.set(g.key, { id: null, ref: g.key });
      createdGroups.push(g);
      continue;
    }
    groupTarget.set(g.key, { id: m.e.id, ref: null });
    groupSteps.push(changeStep('group', g.key, m.e.id, fillBlank(m.e, { name_he: g.name.he, name_en: g.name.en })));
    for (const o of g.options) {
      if (skipped(o.key)) { optionSteps.push(skipStep('option', o.key, 'choice')); continue; }
      const e = existing.options.find((y) => y.id === m.covered!.get(o.key))!;
      const set = fillBlank(e, { name_he: o.name.he, name_en: o.name.en });
      if (o.price !== null && o.price !== e.price) set.price = o.price;
      optionSteps.push(changeStep('option', o.key, e.id, set));
    }
  }
  const nestsAlready = (gid: string): boolean => existing.options.some((o) => o.group_id === gid && o.opens_group_id !== null);
  for (const g of createdGroups) {
    const lim = draftGroupLimits(g);
    const name = cleanText(g.name);
    const min = chosen('limits_unreachable', g.key) === 'clamp' ? Math.min(lim.min, lim.capacity) : lim.min;
    groupSteps.push(createStep('group', g.key,
      {
        label: (name.en || name.he).slice(0, 60), name_he: name.he, name_en: name.en, selection: g.selection, min_units: min, max_units: lim.max,
        limits_confirmed: lim.stated,
      }, {}));
    let position = 0;
    for (const o of g.options) {
      if (skipped(o.key)) { optionSteps.push(skipStep('option', o.key, 'choice')); continue; }
      const n = cleanText(o.name);
      const set: Record<string, unknown> = {
        position: position++, name_he: n.he, name_en: n.en, price: o.price ?? 0,
        max_qty: o.maxQty, is_default: o.default,
      };
      const refs: Record<string, string> = { group_id: g.key };
      const opens = o.opens !== null && chosen('nesting_too_deep', o.key) !== 'unlink' && !groupSkipped.has(o.opens) ? groupTarget.get(o.opens) : undefined;
      if (opens?.id) {
        if (nestsAlready(opens.id)) x.add('nesting_too_deep', o.key);
        set.opens_group_id = opens.id;
      } else if (opens?.ref) refs.opens_group_id = opens.ref;
      else set.opens_group_id = null;
      optionSteps.push(createStep('option', o.key, set, refs));
    }
  }

  // ---- 4. dishes
  const dishTarget = new Map<string, Target>();
  const dishSteps: PlanStep[] = [];
  const claimedDishes = new Set<string>();
  const nextDishPosition = new Map<string, number>();
  const targetKey = (t: Target): string => t.id ?? `ref:${t.ref}`;
  for (const s of draft.sections) {
    const target = sectionTarget.get(s.key);
    for (const d of s.dishes) {
      if (!target) { dishSteps.push(skipStep('dish', d.key, 'parent_skipped')); continue; }
      if (skipped(d.key)) { dishSteps.push(skipStep('dish', d.key, 'choice')); continue; }
      const m = best(d.name, existing.dishes.filter((e) => !claimedDishes.has(e.id)),
        (a, b) => Number(b.section_id === target.id) - Number(a.section_id === target.id));
      if (m) {
        claimedDishes.add(m.id);
        dishTarget.set(d.key, { id: m.id, ref: null });
        const set = fillBlank(m, {
          name_he: d.name.he, name_en: d.name.en, desc_he: d.desc.he, desc_en: d.desc.en, price_note_he: d.priceNote.he,
          price_note_en: d.priceNote.en, allergens_he: d.allergens.he, allergens_en: d.allergens.en,
        });
        if (d.price !== null && d.price !== m.price) set.price = d.price;
        const gained = d.tags.filter((t) => !m.tags.includes(t));
        if (gained.length > 0) set.tags = [...m.tags, ...gained];
        if (m.asset_id === null && m.stock_id === null && d.illustration !== null) set.stock_id = d.illustration;
        dishSteps.push(changeStep('dish', d.key, m.id, set));
        continue;
      }
      dishTarget.set(d.key, { id: null, ref: d.key });
      const tk = targetKey(target);
      if (!nextDishPosition.has(tk)) nextDishPosition.set(tk, nextPosition(target.id ? existing.dishes.filter((e) => e.section_id === target.id) : []));
      const position = nextDishPosition.get(tk)!;
      nextDishPosition.set(tk, position + 1);
      const n = cleanText(d.name), ds = cleanText(d.desc), pn = cleanText(d.priceNote), al = cleanText(d.allergens);
      const set: Record<string, unknown> = {
        position, name_he: n.he, name_en: n.en, desc_he: ds.he, desc_en: ds.en, price: d.price, price_note_he: pn.he, price_note_en: pn.en,
        tags: [...d.tags], allergens_he: al.he, allergens_en: al.en, stock_id: d.illustration,
      };
      const refs: Record<string, string> = {};
      if (target.id) set.section_id = target.id;
      else refs.section_id = target.ref!;
      dishSteps.push(createStep('dish', d.key, set, refs));
    }
  }

  // ---- created sections: appended in draft order; one that receives no new dish is left out
  let sectionPosition = nextPosition(existing.sections);
  for (const s of draft.sections) {
    if (sectionStep.has(s.key)) continue;
    if (!nextDishPosition.has(`ref:${s.key}`)) { sectionStep.set(s.key, skipStep('section', s.key, 'empty')); continue; }
    const n = cleanText(s.name);
    sectionStep.set(s.key, createStep('section', s.key, { position: sectionPosition++, name_he: n.he, name_en: n.en, kind: s.kind, room: s.room }, {}));
  }

  // ---- 5. dish groups
  const linkSteps: PlanStep[] = [];
  const nextLinkPosition = new Map<string, number>();
  const linksOf = (dishId: string) => existing.dishGroups.filter((l) => l.dish_id === dishId);
  for (const s of draft.sections) for (const d of s.dishes) for (const a of d.groups) {
    const key = linkKey(d.key, a.group);
    const dt = dishTarget.get(d.key);
    if (!dt || groupSkipped.has(a.group)) { linkSteps.push(skipStep('dish_group', key, 'parent_skipped')); continue; }
    if (skipped(key)) { linkSteps.push(skipStep('dish_group', key, 'choice')); continue; }
    const gt = groupTarget.get(a.group)!;
    if (dt.id && gt.id && linksOf(dt.id).some((l) => l.group_id === gt.id)) { linkSteps.push(changeStep('dish_group', key, null, {})); continue; }
    const tk = targetKey(dt);
    if (!nextLinkPosition.has(tk)) nextLinkPosition.set(tk, nextPosition(dt.id ? linksOf(dt.id) : []));
    const position = nextLinkPosition.get(tk)!;
    nextLinkPosition.set(tk, position + 1);
    const set: Record<string, unknown> = { position, min_units: a.min, max_units: a.max };
    const refs: Record<string, string> = {};
    if (dt.id) set.dish_id = dt.id; else refs.dish_id = dt.ref!;
    if (gt.id) set.group_id = gt.id; else refs.group_id = gt.ref!;
    linkSteps.push(createStep('dish_group', key, set, refs));
  }

  // ---- 6. photos (D33: only with rights; each enters the picture pipeline and waits for the owner's approval)
  const photoSteps: PlanStep[] = [];
  for (const s of draft.sections) for (const d of s.dishes) {
    if (d.photo === null) continue;
    const dt = dishTarget.get(d.key);
    if (!dt) { photoSteps.push(skipStep('photo', d.key, 'parent_skipped')); continue; }
    const confirmedAtUpload = d.photo.rights === 'confirmed';
    if (!confirmedAtUpload && chosen('photo_rights_unknown', d.key) !== 'confirm_rights') { photoSteps.push(skipStep('photo', d.key, 'choice')); continue; }
    const current = dt.id ? existing.dishes.find((e) => e.id === dt.id)!.asset_id : null;
    if (current !== null) { photoSteps.push(changeStep('photo', d.key, current, {})); continue; }
    const set: Record<string, unknown> = {
      kind: 'photo', status: 'uploaded', original_path: d.photo.path,
      provenance: { from: 'import', source: draft.source, rights: confirmedAtUpload ? 'confirmed_at_upload' : 'confirmed_at_apply' },
    };
    const refs: Record<string, string> = {};
    if (dt.id) set.dish_id = dt.id; else refs.dish_id = dt.ref!;
    photoSteps.push(createStep('photo', d.key, set, refs));
  }

  // ---- limits, counting what the venue already has
  const sectionSteps = draft.sections.map((s) => sectionStep.get(s.key)!);
  const creates = (list: readonly PlanStep[]): PlanStep[] => list.filter((p) => p.op === 'create');
  if (existing.sections.length + creates(sectionSteps).length > LIMITS.sections) x.add('too_many', 'sections');
  if (existing.dishes.length + creates(dishSteps).length > LIMITS.dishes) x.add('too_many', 'dishes');
  if (existing.groups.length + creates(groupSteps).length > LIMITS.addonGroups) x.add('too_many', 'groups');
  const perDish = new Map<string, number>();
  for (const l of existing.dishGroups) perDish.set(l.dish_id, (perDish.get(l.dish_id) ?? 0) + 1);
  for (const p of creates(linkSteps)) {
    const k = (p.set.dish_id as string | undefined) ?? `ref:${p.refs.dish_id}`;
    perDish.set(k, (perDish.get(k) ?? 0) + 1);
    if (perDish.get(k)! > LIMITS.groupsPerDish) x.add('too_many', p.key);
  }
  if (!x.ok) return { ok: false, errors: x.list };

  const steps = [...sectionSteps, ...groupSteps, ...optionSteps, ...dishSteps, ...linkSteps, ...photoSteps];
  return { ok: true, value: { v: 1, steps, summary: summarize(steps) } };
}

const compareIds = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const nextPosition = (rows: ReadonlyArray<{ position: number }>): number => (rows.length ? Math.max(...rows.map((r) => r.position)) + 1 : 0);
const skipStep = (kind: PlanKind, key: string, reason: SkipReason): PlanStep => ({ kind, key, op: 'skip', id: null, set: {}, refs: {}, reason });
const createStep = (kind: PlanKind, key: string, set: Record<string, unknown>, refs: Record<string, string>): PlanStep =>
  ({ kind, key, op: 'create', id: null, set, refs, reason: null });
/** `update` when something changes, else `keep`. */
const changeStep = (kind: PlanKind, key: string, id: string | null, set: Record<string, unknown>): PlanStep =>
  ({ kind, key, op: Object.keys(set).length > 0 ? 'update' : 'keep', id, set, refs: {}, reason: null });

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

function summarize(steps: readonly PlanStep[]): PlanSummary {
  const out = {} as Record<PlanKind, Record<PlanOp, number>>;
  for (const k of PLAN_KINDS) out[k] = { create: 0, update: 0, keep: 0, skip: 0 };
  for (const s of steps) out[s.kind][s.op] += 1;
  return out;
}

// ---------------------------------------------------------------- the import RPCs' inputs (ADR-008)

/** The columns of `menu_imports` a client may read: everything except the raw text, which nobody reads back. */
export const IMPORT_CLIENT_COLUMNS = [
  'id', 'venue_id', 'source', 'status', 'raw_paths', 'input_sha256', 'rights_confirmed', 'parsed', 'exceptions', 'error_code', 'created_by',
  'applied_at', 'created_at', 'updated_at', 'raw_purged_at',
] as const;
export type MenuImportView = Pick<MenuImportRow, (typeof IMPORT_CLIENT_COLUMNS)[number]>;

export const TEXT_SOURCES = ['paste', 'wolt_text'] as const satisfies readonly ImportSource[];
export const IMAGE_SOURCES = ['scan', 'wolt_screenshots'] as const satisfies readonly ImportSource[];
export const IMPORT_TEXT_MAX = 60_000;
export const IMPORT_IMAGES_MAX = 20;
export const SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * `create_import`. Text sources send `text` (the database stores it privately and hashes it itself); image sources
 * upload to the private bucket first (`<venue id>/imports/…`) and send the `paths` and `inputSha256` (the SHA-256 of
 * the files' own SHA-256s, lowercase hex, joined in order). `rightsConfirmed`: the owner owns the photos in these
 * screenshots (D33); only `wolt_screenshots` may say so.
 */
export type CreateImportInput = {
  readonly venueId: string;
  readonly source: ImportSource;
  readonly text?: string | null;
  readonly paths?: readonly string[] | null;
  readonly inputSha256?: string | null;
  readonly rightsConfirmed: boolean;
};
export type CreateImportReply = { readonly ok: true; readonly importId: string; readonly status: MenuImportRow['status']; readonly reused: boolean };

/** Codes: type, id_invalid, enum_invalid, text_missing, text_too_long, paths_missing, path_invalid, sha_invalid, input_mismatch, rights_invalid. */
export function validateCreateImport(raw: unknown): Validation<CreateImportInput> {
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  const x = new Issues();
  if (!isUuid(raw.venueId)) x.add('id_invalid', 'venueId');
  if (!oneOf(IMPORT_SOURCES, raw.source)) return { ok: false, errors: [...x.list, { code: 'enum_invalid', path: 'source' }] };
  const textSource = (TEXT_SOURCES as readonly string[]).includes(raw.source);
  // a field left out counts as null
  const text = raw.text ?? null, paths = raw.paths ?? null, sha = raw.inputSha256 ?? null;
  if (textSource) {
    if (paths !== null || sha !== null) x.add('input_mismatch', 'paths');
    if (!isString(text) || isBlank(text)) x.add('text_missing', 'text');
    else if (text.length > IMPORT_TEXT_MAX) x.add('text_too_long', 'text');
  } else {
    if (text !== null) x.add('input_mismatch', 'text');
    if (!Array.isArray(raw.paths) || raw.paths.length === 0) x.add('paths_missing', 'paths');
    else if (raw.paths.length > IMPORT_IMAGES_MAX) x.add('too_many', 'paths');
    else raw.paths.forEach((p, i) => {
      if (!isRelPath(p) || p.length > 200 || (isUuid(raw.venueId) && !p.startsWith(`${(raw.venueId as string).toLowerCase()}/`))) x.add('path_invalid', `paths[${i}]`);
    });
    if (!isString(raw.inputSha256) || !SHA256_RE.test(raw.inputSha256)) x.add('sha_invalid', 'inputSha256');
  }
  if (typeof raw.rightsConfirmed !== 'boolean') x.add('type', 'rightsConfirmed');
  else if (raw.rightsConfirmed && raw.source !== 'wolt_screenshots') x.add('rights_invalid', 'rightsConfirmed');
  return x.ok ? { ok: true, value: raw as unknown as CreateImportInput } : { ok: false, errors: x.list };
}

/**
 * `claim_import_scan` (called by the scanner with the owner's own token, before any paid call): the import moves to
 * `parsing` and the scanner gets what it reads. A claim older than 10 minutes (a crashed read) may be claimed again.
 */
export type ClaimScanReply = {
  readonly ok: true;
  readonly importId: string;
  readonly venueId: string;
  readonly source: (typeof IMAGE_SOURCES)[number];
  readonly paths: readonly string[];
  readonly rightsConfirmed: boolean;
  /** The venue's languages, for the reader's prompt and `draftExceptions`. */
  readonly langs: readonly Lang[];
};
/** Why the scanner marks an import `failed` (`menu_imports.error_code`). */
export const SCAN_ERROR_CODES = ['image_unreadable', 'model_failed', 'draft_invalid', 'timeout'] as const;
export type ScanErrorCode = (typeof SCAN_ERROR_CODES)[number];

/** `save_import_draft`: the client (text sources) or the scanner (image sources) stores what it read. */
export type SaveDraftInput = { readonly importId: string; readonly draft: ImportDraft };
export type SaveDraftReply = { readonly ok: true; readonly exceptions: readonly ImportException[]; readonly counts: DraftCounts };

export function validateSaveDraft(raw: unknown): Validation<SaveDraftInput> {
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  const errors: Issue[] = [];
  if (!isUuid(raw.importId)) errors.push({ code: 'id_invalid', path: 'importId' });
  const d = validateDraft(raw.draft);
  if (!d.ok) errors.push(...d.errors.map((e) => ({ ...e, path: e.path ? `draft.${e.path}` : 'draft' })));
  return errors.length ? { ok: false, errors } : { ok: true, value: raw as unknown as SaveDraftInput };
}

/**
 * `apply_import`: `draft` is the one the owner looked at (the database refuses with `draft_changed` when the stored
 * draft is another), `decisions` their answers. The reply carries the plan that was applied.
 */
export type ApplyImportInput = { readonly importId: string; readonly draft: ImportDraft; readonly decisions: ImportDecisions };
export type ApplyImportReply = { readonly ok: true; readonly plan: ImportPlan };

export function validateApplyImport(raw: unknown): Validation<ApplyImportInput> {
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  const base = validateSaveDraft({ importId: raw.importId, draft: raw.draft });
  const errors: Issue[] = base.ok ? [] : [...base.errors];
  const dec = validateDecisions(raw.decisions);
  if (!dec.ok) errors.push(...dec.errors.map((e) => ({ ...e, path: e.path ? `decisions.${e.path}` : 'decisions' })));
  return errors.length ? { ok: false, errors } : { ok: true, value: raw as unknown as ApplyImportInput };
}
