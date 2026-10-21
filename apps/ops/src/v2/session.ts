/**
 * The page's connection to Supabase: the client, password sign-in and sign-out, the session's assurance level (for
 * when staff need MFA), the `Backend` the data layer uses, and Realtime subscriptions (ADR-007). The only file of v2
 * that imports supabase-js.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { configFlags } from '@mana/contracts';
import type { Backend, Raw, RawError, Result } from './api.ts';
import { DISH_NOW, failOf } from './api.ts';
import type { ChannelStatus, Subscribe } from './live.ts';

const TIMEOUT_MS = 15_000;

declare global {
  interface Window {
    HALOM_MENUS_CONFIG?: unknown;
    /** Tests shorten the request timeout. */
    __OPS_TIMEOUT_MS?: number;
  }
}

/** Every request gives up after TIMEOUT_MS (a hung network must not hang the page). */
function timeoutFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const ctl = new AbortController();
  const outer = init.signal;
  if (outer) { if (outer.aborted) ctl.abort(outer.reason); else outer.addEventListener('abort', () => ctl.abort(outer.reason), { once: true }); }
  const t = setTimeout(() => ctl.abort(new DOMException('timeout', 'TimeoutError')), window.__OPS_TIMEOUT_MS || TIMEOUT_MS);
  return fetch(input, { ...init, signal: ctl.signal }).finally(() => clearTimeout(t));
}

export type User = { readonly id: string; readonly email: string };

export type Connection = {
  readonly client: SupabaseClient;
  readonly backend: Backend;
  readonly config: Readonly<Record<string, unknown>>;
};

/**
 * Where v2 keeps its session in the browser: its own key, so it never reads or overwrites the session of v1 or of the
 * owner app on the same origin (each app signs in for itself).
 */
export const AUTH_STORAGE_KEY = 'mana.ops.v2.auth';

/** The client for the config's project; a plain message when the config cannot be used. Plain `http:` only on a local
 * stack (`env: 'local'`): anywhere else the session token would cross the network unencrypted. */
export function connect(raw: unknown): { ok: true; value: Connection } | { ok: false; message: string } {
  const cfg = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!cfg || typeof cfg.supabaseUrl !== 'string' || typeof cfg.supabaseKey !== 'string') {
    return { ok: false, message: 'config.js did not load (expected ../config.js next to the ops folder).' };
  }
  let protocol: string;
  try { protocol = new URL(cfg.supabaseUrl).protocol; } catch { return { ok: false, message: 'config.js has no usable supabaseUrl.' }; }
  if (protocol !== 'https:' && !(protocol === 'http:' && configFlags(cfg).env === 'local')) {
    return { ok: false, message: protocol === 'http:' ? 'config.js points at a plain http:// backend outside a local stack. The back office needs https://.' : 'config.js has no usable supabaseUrl.' };
  }
  const client = createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTH_STORAGE_KEY },
    global: { fetch: timeoutFetch },
  });
  return { ok: true, value: { client, backend: supabaseBackend(client), config: cfg } };
}

const thrown = (e: unknown): RawError => (e && typeof e === 'object' ? (e as RawError) : { message: String(e) });

export function supabaseBackend(client: SupabaseClient): Backend {
  return {
    async rpc(fn, args): Promise<Raw> {
      try {
        const { data, error, status } = await client.rpc(fn, args);
        return { data, error: error ? { message: error.message, code: error.code, status } : null };
      } catch (e) { return { data: null, error: thrown(e) }; }
    },
    async dishRow(dishId): Promise<Raw> {
      try {
        const { data, error, status } = await client.from('dishes').select(DISH_NOW.join(',')).eq('id', dishId).maybeSingle();
        return { data, error: error ? { message: error.message, code: error.code, status } : null };
      } catch (e) { return { data: null, error: thrown(e) }; }
    },
    async staffRow(userId): Promise<Raw> {
      try {
        const { data, error, status } = await client.from('staff').select('role').eq('user_id', userId).maybeSingle();
        return { data, error: error ? { message: error.message, code: error.code, status } : null };
      } catch (e) { return { data: null, error: thrown(e) }; }
    },
  };
}

/** The `aal` claim of the session's access token ('aal1' = password only, 'aal2' = with a second factor), read, not verified. */
export function aalOf(token: string | null | undefined): string | null {
  try {
    const part = String(token ?? '').split('.')[1];
    if (!part) return null;
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.aal === 'string' ? json.aal : null;
  } catch { return null; }
}

export async function currentUser(client: SupabaseClient): Promise<(User & { aal: string | null }) | null> {
  try {
    const { data } = await client.auth.getSession();
    const s = data.session;
    return s ? { id: s.user.id, email: s.user.email ?? '', aal: aalOf(s.access_token) } : null;
  } catch { return null; }
}

export async function signIn(client: SupabaseClient, email: string, password: string): Promise<Result<User & { aal: string | null }>> {
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      const f = failOf({ message: error.message, code: error.code ?? '', status: 0, name: error.name });
      if (f.kind === 'timeout' || f.kind === 'network') return f;
      if (error.status === 400 || error.code === 'invalid_credentials') return { ok: false, kind: 'invalid', message: 'Wrong e-mail or password.' };
      if (error.status === 429) return { ok: false, kind: 'server', message: 'Too many attempts. Wait a minute and try again.' };
      return { ok: false, kind: 'server', message: 'Could not sign in: ' + String(error.message || 'unknown error').slice(0, 160) };
    }
    return { ok: true, data: { id: data.user.id, email: data.user.email ?? '', aal: aalOf(data.session.access_token) } };
  } catch (e) { return failOf(thrown(e)); }
}

// ---------------------------------------------------------------- the second step (staff TOTP, B118)

/** The name this back office gives the TOTP factor it sets up: an unverified one by this name is its own leftover. */
export const FACTOR_NAME = 'Mana back office';
/** What the authenticator app shows above the codes. */
const ISSUER = 'Halom back office';

export type Factors = { readonly verified: string | null; readonly leftovers: readonly string[] };
/** An enrollment in progress: the factor, its QR image (a data: URL, never markup) and its secret, for this screen only. */
export type Enrollment = { readonly factorId: string; readonly qr: string | null; readonly secret: string };
/** Why a second-step call failed, for the screen's words (mfa.ts `mfaWords`). */
export type MfaFail = { readonly ok: false; readonly why: 'wrong' | 'rate' | 'signed_out' | 'timeout' | 'network' | 'other'; readonly message: string };
type MfaResult<T> = { readonly ok: true; readonly data: T } | MfaFail;

const mfaFail = (e: RawError | null | undefined): MfaFail => {
  const message = String(e?.message ?? 'unknown error').slice(0, 160);
  const f = failOf({ message, code: e?.code ?? '', status: e?.status ?? 0, name: e?.name ?? '' });
  if (f.kind === 'timeout' || f.kind === 'network') return { ok: false, why: f.kind, message: f.message };
  if (e?.status === 429 || e?.code === 'over_request_rate_limit') return { ok: false, why: 'rate', message };
  if (e?.code === 'mfa_verification_failed' || e?.code === 'mfa_challenge_expired' || /invalid totp code|code.*(invalid|expired)/i.test(message)) return { ok: false, why: 'wrong', message };
  if (e?.status === 401 || e?.name === 'AuthSessionMissingError') return { ok: false, why: 'signed_out', message };
  return { ok: false, why: 'other', message };
};

/** The caller's TOTP factors: the verified one (its id), and the unverified ones this back office left (to remove). */
export async function mfaFactors(client: SupabaseClient): Promise<MfaResult<Factors>> {
  try {
    const { data, error } = await client.auth.mfa.listFactors();
    if (error || !data) return mfaFail(error);
    const verified = data.totp.find((f) => f.status === 'verified')?.id ?? null;
    const leftovers = data.all.filter((f) => f.factor_type === 'totp' && f.status !== 'verified' && f.friendly_name === FACTOR_NAME).map((f) => f.id);
    return { ok: true, data: { verified, leftovers } };
  } catch (e) { return mfaFail(thrown(e)); }
}

/** Removes this back office's unverified leftovers, then starts a new TOTP enrollment. */
export async function mfaEnroll(client: SupabaseClient, leftovers: readonly string[], qrOf: (raw: unknown) => string | null): Promise<MfaResult<Enrollment>> {
  try {
    for (const factorId of leftovers) {
      const { error } = await client.auth.mfa.unenroll({ factorId });
      if (error) return mfaFail(error);
    }
    const { data, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: FACTOR_NAME, issuer: ISSUER });
    if (error || !data || data.type !== 'totp' || typeof data.totp?.secret !== 'string') return mfaFail(error);
    return { ok: true, data: { factorId: data.id, qr: qrOf(data.totp.qr_code), secret: data.totp.secret } };
  } catch (e) { return mfaFail(thrown(e)); }
}

/** One code for a factor: a challenge, then the code. On success the client keeps the new session (aal2). */
export async function mfaVerify(client: SupabaseClient, factorId: string, code: string): Promise<MfaResult<User & { aal: string | null }>> {
  try {
    const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (error || !data) return mfaFail(error);
    const u = await currentUser(client);
    return u ? { ok: true, data: u } : { ok: false, why: 'signed_out', message: 'The session ended.' };
  } catch (e) { return mfaFail(thrown(e)); }
}

export async function signOut(client: SupabaseClient): Promise<void> {
  try { await client.auth.signOut({ scope: 'local' }); } catch { /* the local session is gone either way */ }
}

export function onSignedOut(client: SupabaseClient, fn: () => void): () => void {
  const { data } = client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') fn(); });
  return () => data.subscription.unsubscribe();
}

/** One `postgres_changes` listener (ADR-007: event `*`, an optional filter). */
export type Listen = { readonly table: 'rollups_minute' | 'rollups_day' | 'availability_overrides'; readonly filter?: string };

let channels = 0;
/** A Realtime channel with these listeners, as a `Subscribe` for the live controller: each message is a signal only. */
export function realtime(client: SupabaseClient, name: string, listens: readonly Listen[]): Subscribe {
  return (signal, status) => {
    const ch = client.channel(`ops-${name}-${++channels}`);
    for (const l of listens) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: l.table, ...(l.filter ? { filter: l.filter } : {}) }, () => signal());
    }
    ch.subscribe((s) => status(s as ChannelStatus));
    return () => { void client.removeChannel(ch); };
  };
}
