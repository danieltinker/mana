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

export const hasName = (t: Text): boolean => t.he.trim() !== '' || t.en.trim() !== '';
