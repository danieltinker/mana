// Every failure the v2 app can meet, turned into one short code the screens explain in plain words (i18n.ts, 'e.<code>').
// Pure: no browser, no network (the unit tests import it as it is).

export class V2Error extends Error {
  readonly code: string;
  /** What came back with it (an RPC's answer, the database's detail), for the screens that show more. */
  readonly detail: unknown;
  constructor(code: string, detail: unknown = null, message?: string) {
    super(message || code);
    this.name = 'V2Error';
    this.code = code;
    this.detail = detail;
  }
}

/**
 * What the clean schema raises by name (`raise exception '<code>'` in supabase/migrations), kept as the code itself.
 * `limit_<name>` (a size limit per venue, group or dish) is matched by its prefix.
 */
export const DB_CODES: ReadonlySet<string> = new Set([
  'nesting_too_deep', 'limits_loosened', 'limits_invalid', 'single_max', 'venue_fixed', 'id_fixed', 'asset_not_approved',
  'rule_ref_unknown', 'rule_condition_emptied', 'owner_only', 'last_owner', 'append_only', 'target_unknown', 'not_allowed',
  'until_invalid', 'until_in_past', 'override_fixed',
]);

/** Supabase Auth's error codes (GoTrue), in the app's words. */
const AUTH_CODES: Readonly<Record<string, string>> = {
  invalid_credentials: 'bad_login',
  email_not_confirmed: 'email_unconfirmed',
  signup_disabled: 'signup_closed',
  user_already_exists: 'exists',
  email_exists: 'exists',
  weak_password: 'weak_password',
  email_address_invalid: 'email_rejected',
  validation_failed: 'invalid_email',
  over_email_send_rate_limit: 'rate_limited',
  over_request_rate_limit: 'rate_limited',
  session_not_found: 'signed_out',
  refresh_token_not_found: 'signed_out',
};

const NETWORK = /failed to fetch|networkerror|load failed|fetch failed|network request failed|err_internet|timeout/i;

type Raw = { message?: unknown; error_description?: unknown; msg?: unknown; error?: unknown; code?: unknown; status?: unknown; statusCode?: unknown; name?: unknown };

export function toV2Error(e: unknown): V2Error {
  if (e instanceof V2Error) return e;
  const r: Raw = e && typeof e === 'object' ? (e as Raw) : {};
  const msg = String(r.message ?? r.error_description ?? r.msg ?? r.error ?? (typeof e === 'string' ? e : ''));
  const code = String(r.code ?? '');
  const status = Number(r.status ?? r.statusCode) || 0;
  const as = (c: string) => new V2Error(c, e, msg);

  if (r.name === 'AbortError') return as('aborted');
  if (NETWORK.test(msg) || r.name === 'AuthRetryableFetchError') return as('network');
  if (code in AUTH_CODES) return as(AUTH_CODES[code]!);
  if (/invalid login credentials/i.test(msg)) return as('bad_login');
  if (/email not confirmed/i.test(msg)) return as('email_unconfirmed');
  if (/signups? not allowed/i.test(msg)) return as('signup_closed');
  // the schema's permission refusal ('not_allowed', 42501) is the same as row-level security's: one code, so every write
  // path that meets it reads the role again
  if (msg === 'not_allowed' || msg === 'owner_only') return as('forbidden');
  if (DB_CODES.has(msg) || /^limit_[a-z_]+$/.test(msg)) return as(msg);
  if (code === 'PGRST301' || status === 401 || /jwt expired|invalid jwt|jwt malformed/i.test(msg)) return as('signed_out');
  if (code === '42501' || status === 403 || /row-level security|permission denied/i.test(msg)) return as('forbidden');
  if (code === '23505' || status === 409) return as('duplicate');
  if (code === '23503') return as('not_found');
  if (code === '22001') return as('too_long');
  if (code === '23514' || code === '22P02' || code === '23502') return as('invalid');
  if (code === 'PGRST116' || status === 404) return as('not_found');
  if (status === 429 || /rate limit/i.test(msg)) return as('rate_limited');
  return as('unknown');
}

/** An RPC's own refusal (`{ ok: false, code }`) as an error; anything else passes through. */
export function refusal<T>(answer: T): T {
  const a = answer as { ok?: unknown; code?: unknown } | null;
  if (a && typeof a === 'object' && a.ok === false) throw new V2Error(typeof a.code === 'string' && a.code ? a.code : 'unknown', answer);
  return answer;
}
