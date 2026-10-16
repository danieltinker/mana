/**
 * What every phase-1 RPC answers, and the checks their inputs share (ADR-008). An input type here is the object an app
 * builds before calling; its validator reports the same codes the database returns for the same mistake, so an app can
 * refuse a bad call before it leaves the phone. The database checks everything again.
 *
 * Conventions (unchanged from phase 0): a mistake the caller can act on comes back as `{ ok: false, code }`; "you may
 * not" raises SQLSTATE 42501, which supabase-js reports as an error, not as a reply.
 */
import { Issues, isBlank, isObject, isString, isUuid, stripBlank, type Issue } from './common.ts';

export type RpcOk<T extends object = object> = { readonly ok: true } & T;
export type RpcFail<C extends string = string> = { readonly ok: false; readonly code: C; readonly errors?: readonly Issue[] };
export type RpcReply<T extends object = object, C extends string = string> = RpcOk<T> | RpcFail<C>;

/** A staff reason (act for owner, approve, plans, cases, demo): 3–500 characters once blank edges are stripped. The
 * owner reads it, so it must not hold personal data. */
export const REASON_MIN = 3;
export const REASON_MAX = 500;
export const isReason = (v: unknown): v is string => isString(v) && stripBlank(v).length >= REASON_MIN && stripBlank(v).length <= REASON_MAX;

/** A free-text field that may be null: a string of at most `max` characters. */
export function optionalText(x: Issues, v: unknown, path: string, max: number): void {
  if (v === null || v === undefined) return;
  if (!isString(v)) x.add('type', path);
  else if (v.length > max) x.add('text_too_long', path);
}

export function requiredText(x: Issues, v: unknown, path: string, max: number, missing = 'text_missing'): void {
  if (!isString(v)) x.add('type', path);
  else if (isBlank(v)) x.add(missing, path);
  else if (stripBlank(v).length > max) x.add('text_too_long', path);
}

export const uuidAt = (x: Issues, v: unknown, path: string): void => void (isUuid(v) || x.add('id_invalid', path));

/** Keys an input does not have are refused: the database's arguments are fixed, so an unknown key is a client bug. */
export function onlyKeys(x: Issues, raw: Readonly<Record<string, unknown>>, allowed: readonly string[]): void {
  for (const k of Object.keys(raw)) if (!allowed.includes(k)) x.add('field_not_allowed', k);
}

/** Runs a validator body on an object input and wraps the result. */
export function validateInput<T>(raw: unknown, allowed: readonly string[], body: (x: Issues, o: Readonly<Record<string, unknown>>) => void):
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly errors: readonly Issue[] } {
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  const x = new Issues();
  onlyKeys(x, raw, allowed);
  body(x, raw);
  return x.ok ? { ok: true, value: raw as T } : { ok: false, errors: x.list };
}
