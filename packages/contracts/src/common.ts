/** Shared primitives of the Mana contracts: languages, bilingual text, ids and validation results. */

export const LANGS = ['he', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/** Bilingual text. Both keys are always present; either may be the empty string. */
export type Text = { readonly he: string; readonly en: string };

/** One problem found by a validator. `code` is a stable machine word shared with the database's validators. */
export type Issue = { readonly code: string; readonly path: string; readonly message?: string };

/** What every validator returns: the typed value, or every problem it found. */
export type Validation<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly errors: readonly Issue[] };

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
export const isString = (v: unknown): v is string => typeof v === 'string';

export function oneOf<T extends string>(values: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (values as readonly string[]).includes(v);
}

/** A collector of issues, so validators read top to bottom. */
export class Issues {
  readonly list: Issue[] = [];
  add(code: string, path: string, message?: string): false {
    this.list.push(message === undefined ? { code, path } : { code, path, message });
    return false;
  }
  get ok(): boolean {
    return this.list.length === 0;
  }
}

export function textOk(v: unknown, max: number): v is Text {
  return isObject(v) && isString(v.he) && isString(v.en) && v.he.length <= max && v.en.length <= max;
}

/**
 * What counts as "blank", in one place (the database's app.blank_class() is the same list; supabase/tests compares
 * them code point by code point): ASCII whitespace and controls \t \n \v \f \r, U+0085, every Unicode space separator
 * (Zs: U+0020, U+00A0, U+1680, U+2000–U+200A, U+202F, U+205F, U+3000), the line and paragraph separators U+2028–U+2029,
 * the invisible format characters people paste by accident (U+00AD soft hyphen, U+061C Arabic letter mark, U+180E,
 * U+200B–U+200F zero-width and LRM/RLM, U+202A–U+202E bidi embeddings, U+2060–U+2064 word joiner and invisible
 * operators, U+2066–U+206F bidi isolates and the deprecated format controls, U+FEFF BOM, U+E0000–U+E007F tags), the
 * combining grapheme joiner U+034F, the variation selectors U+FE00–U+FE0F, and the characters that draw nothing: the
 * Hangul fillers U+115F, U+1160, U+3164, U+FFA0 and the braille blank U+2800.
 */
export const BLANK_CLASS =
  '\\u0009-\\u000D\\u0020\\u0085\\u00A0\\u00AD\\u034F\\u061C\\u115F\\u1160\\u1680\\u180E\\u2000-\\u200F\\u2028-\\u202F' +
  '\\u205F-\\u2064\\u2066-\\u206F\\u2800\\u3000\\u3164\\uFE00-\\uFE0F\\uFEFF\\uFFA0\\u{E0000}-\\u{E007F}';
/**
 * Blank characters that belong to the character before them: a variation selector ("☕️" is U+2615 U+FE0F) and the
 * tag characters of a subdivision flag. Stripping keeps them after the last visible character, so an emoji at the end
 * of a name keeps its look; on their own, or at the start, they are blank like the rest.
 */
export const BLANK_EXTENDERS = '\\uFE00-\\uFE0F\\u{E0020}-\\u{E007F}';
const BLANK_LEAD = new RegExp(`^[${BLANK_CLASS}]+`, 'u');
const BLANK_TRAIL = new RegExp(`([^${BLANK_CLASS}][${BLANK_EXTENDERS}]*)[${BLANK_CLASS}]*$`, 'u');
const BLANK_ONE = new RegExp(`^[${BLANK_CLASS}]$`, 'u');

/** Is this one character blank? */
export const isBlankChar = (ch: string): boolean => BLANK_ONE.test(ch);
/**
 * Removes blank characters at both ends (names and descriptions are stored this way), except the variation selectors
 * and tags that finish the last visible character. The database's app.strip_blank() does the same.
 */
export const stripBlank = (s: string): string => s.replace(BLANK_LEAD, '').replace(BLANK_TRAIL, '$1');
/** Nothing but blank characters (or nothing at all). */
export const isBlank = (s: string): boolean => stripBlank(s) === '';
/** Both languages' text with blank edges removed: what the client app saves. */
export const cleanText = (t: Text): Text => ({ he: stripBlank(t.he), en: stripBlank(t.en) });

export const hasName = (t: Text): boolean => !isBlank(t.he) || !isBlank(t.en);
