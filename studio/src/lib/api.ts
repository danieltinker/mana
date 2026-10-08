// The one place that talks to Supabase. Every call goes through q(), which turns whatever came back into an AppError
// with a short code the screens can explain in plain words.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Provider = 'google' | 'apple' | 'facebook';
export type Config = {
  supabaseUrl: string; supabaseKey: string; shortBase: string; shortLive: boolean;
  viewPath: string; genPath: string; stockPath: string; sitePath: string;
  auth: { providers: Provider[] }; features: { scan?: boolean };
};
const raw = (window as any).HALOM_MENUS_CONFIG;
const PROVIDERS: Provider[] = ['google', 'apple', 'facebook'];
export const cfg: Config | null = raw && raw.supabaseUrl && raw.supabaseKey
  ? { shortBase: 'https://halom.io/m/', shortLive: false, viewPath: '../view/', genPath: '../gen/', stockPath: '../stock/', sitePath: '../', ...raw,
      auth: { providers: PROVIDERS.filter((p) => Array.isArray(raw.auth?.providers) && raw.auth.providers.includes(p)) }, features: { ...(raw.features || {}) } }
  : null;

/** An address next to the app (the viewer, the generator, the stock library, the product page), made absolute. */
export const sibling = (rel: string, file = '') => new URL(rel + file, document.baseURI).href;
/** The app's own address without hash or query: where a provider sends the owner back to. */
export const ownAddress = () => location.origin + location.pathname;

// PKCE: the answer of Google / Apple / Facebook comes back as ?code=… in the query string, so it never fights the hash router.
export const sb: SupabaseClient = cfg
  ? createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'mana-studio-auth' } })
  : (null as any);

export class AppError extends Error {
  code: string;
  constructor(code: string, message?: string) { super(message || code); this.code = code; }
}

const NET = /failed to fetch|networkerror|load failed|fetch failed|network request failed|err_internet|timeout/i;
const DB_CODES = ['limit_categories', 'limit_items', 'limit_assets_per_day', 'limit_assets_total', 'limit_attempts', 'category_of_other_business', 'item_of_other_business',
  'asset_not_approved', 'asset_incomplete', 'asset_files_missing', 'asset_in_use', 'asset_bad_start', 'path_of_other_business', 'business_fixed', 'not_member', 'not_staff'];

export function toAppError(e: any): AppError {
  if (e instanceof AppError) return e;
  const msg = String((e && (e.message || e.error_description || e.msg || e.error)) || e || '');
  const status = Number(e && (e.status ?? e.statusCode)) || 0;
  if (e && e.name === 'AbortError') return new AppError('aborted', msg);
  if (NET.test(msg) || (typeof navigator !== 'undefined' && navigator.onLine === false) || (e && e.name === 'AuthRetryableFetchError') || (e && e.name === 'StorageUnknownError' && !status)) return new AppError('network', msg);
  if (DB_CODES.includes(msg)) return new AppError(msg, msg);
  const code = String((e && e.code) || '');
  if (code === 'PGRST301' || status === 401 || /jwt expired|invalid jwt|jwt malformed/i.test(msg)) return new AppError('signed_out', msg);
  if (code === '42501' || status === 403 || /row-level security|permission denied/i.test(msg)) return new AppError('forbidden', msg);
  if (code === '23514' || code === '22001' || code === '22P02') return new AppError('invalid', msg);
  if (code === '23505' || status === 409 || /already exists|duplicate/i.test(msg)) return new AppError('duplicate', msg);
  if (status === 413 || /maximum allowed size|too large/i.test(msg)) return new AppError('too_large', msg);
  if (status === 415 || /mime type/i.test(msg)) return new AppError('bad_type', msg);
  if (code === 'PGRST116') return new AppError('not_found', msg);
  if (status === 404 || /not found/i.test(msg)) return new AppError('not_found', msg);
  if (/invalid login credentials/i.test(msg)) return new AppError('bad_login', msg);
  if (status === 429 || /rate limit/i.test(msg)) return new AppError('rate_limited', msg);
  return new AppError('unknown', msg);
}

/** Await a supabase-js call; return its data or throw an AppError. */
export async function q<T = any>(p: PromiseLike<{ data: T; error: any }>): Promise<T> {
  let r: { data: T; error: any };
  try { r = await p; } catch (e) { throw toAppError(e); }
  if (r.error) throw toAppError(r.error);
  return r.data;
}

export const fnUrl = (name: string) => cfg!.supabaseUrl.replace(/\/+$/, '') + '/functions/v1/' + name;

export async function signUp(email: string, password: string, hp: string, elapsedMs: number): Promise<{ ok: boolean; code?: string }> {
  let r: Response;
  try {
    r = await fetch(fnUrl('menus-signup'), {
      method: 'POST', headers: { apikey: cfg!.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, hp, elapsed_ms: Math.round(elapsedMs) }),
    });
  } catch (e) { throw toAppError(e); }
  let j: any = null;
  try { j = await r.json(); } catch { /* not JSON */ }
  if (j && typeof j.ok === 'boolean') return j;
  if (r.status === 429) return { ok: false, code: 'rate_limited' };
  return { ok: false, code: 'failed' };
}

/** Was this page opened as the answer of a provider (?code=… or ?error=…)? Read once; the query is then cleaned from the address bar. */
export function takeAuthReturn(): { error: string } | null {
  const u = new URL(location.href);
  const had = ['code', 'error', 'error_code', 'error_description'].some((k) => u.searchParams.has(k));
  if (!had) return null;
  const error = u.searchParams.get('error_description') || u.searchParams.get('error') || '';
  history.replaceState(history.state, '', u.pathname + u.hash);
  return { error };
}

export const publicUrl = (path: string) => sb.storage.from('menu-public').getPublicUrl(path).data.publicUrl;
