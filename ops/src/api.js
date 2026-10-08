// The only file that talks to Supabase. Every call resolves to { ok, data } or { ok:false, kind, message }:
// kind is 'signed_out' | 'not_staff' | 'timeout' | 'network' | 'server'. Nothing here throws.
import { createClient } from '@supabase/supabase-js';

const TIMEOUT_MS = 15000;
let client = null;
let configProblem = null;

function timeoutFetch(input, init = {}) {
  const ctl = new AbortController();
  const outer = init.signal;
  if (outer) { if (outer.aborted) ctl.abort(outer.reason); else outer.addEventListener('abort', () => ctl.abort(outer.reason), { once: true }); }
  const ms = (typeof window !== 'undefined' && window.__OPS_TIMEOUT_MS) || TIMEOUT_MS;   // tests shorten it
  const t = setTimeout(() => ctl.abort(new DOMException('timeout', 'TimeoutError')), ms);
  return fetch(input, { ...init, signal: ctl.signal }).finally(() => clearTimeout(t));
}

export function init() {
  const cfg = (typeof window !== 'undefined' && window.HALOM_MENUS_CONFIG) || null;
  if (!cfg || typeof cfg.supabaseUrl !== 'string' || typeof cfg.supabaseKey !== 'string') {
    configProblem = 'config.js did not load (expected ../config.js next to the ops folder).';
    return { ok: false, message: configProblem };
  }
  try {
    const u = new URL(cfg.supabaseUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('bad protocol');
    client = createClient(cfg.supabaseUrl, cfg.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { fetch: timeoutFetch },
    });
    return { ok: true };
  } catch (e) {
    configProblem = 'config.js has no usable supabaseUrl.';
    return { ok: false, message: configProblem };
  }
}
export const config = () => (typeof window !== 'undefined' && window.HALOM_MENUS_CONFIG) || {};

function fail(error) {
  const msg = String((error && error.message) || error || '');
  const code = String((error && error.code) || '');
  const status = Number(error && error.status) || 0;
  if (/timeout|TimeoutError|aborted/i.test(msg) || (error && error.name === 'TimeoutError')) {
    return { ok: false, kind: 'timeout', message: 'The server did not answer in time.' };
  }
  if (code === '42501' || /not_staff/.test(msg)) return { ok: false, kind: 'not_staff', message: 'This account does not have staff access.' };
  if (code === 'PGRST301' || code === 'PGRST303' || /JWT|jwt|invalid claim|session_not_found/.test(msg) || status === 401) {
    return { ok: false, kind: 'signed_out', message: 'Your session ended. Sign in again.' };
  }
  if (/Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg)) {
    return { ok: false, kind: 'network', message: 'Could not reach the server. Check the connection.' };
  }
  return { ok: false, kind: 'server', message: msg ? `The server refused: ${msg.slice(0, 200)}` : 'The server returned an error.', code };
}

async function rpc(name, args) {
  if (!client) return { ok: false, kind: 'server', message: configProblem || 'Not configured.' };
  try {
    const { data, error, status } = await client.rpc(name, args || {});
    if (error) return fail(status === 401 ? { ...error, message: error.message, code: 'PGRST301', status } : error);
    return { ok: true, data };
  } catch (e) { return fail(e); }
}

export async function currentUser() {
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    const u = data && data.session && data.session.user;
    return u ? { id: u.id, email: u.email || '' } : null;
  } catch { return null; }
}
export function onSignedOut(fn) {
  if (!client) return () => {};
  const { data } = client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') fn(); });
  return () => data.subscription.unsubscribe();
}
export async function signIn(email, password) {
  if (!client) return { ok: false, kind: 'server', message: configProblem || 'Not configured.' };
  try {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
      const f = fail(error);
      if (f.kind === 'timeout' || f.kind === 'network') return f;
      if (error.status === 400 || error.code === 'invalid_credentials') return { ok: false, kind: 'credentials', message: 'Wrong e-mail or password.' };
      if (error.status === 429) return { ok: false, kind: 'server', message: 'Too many attempts. Wait a minute and try again.' };
      return { ok: false, kind: 'server', message: 'Could not sign in: ' + String(error.message || 'unknown error').slice(0, 160) };
    }
    return { ok: true, data: { id: data.user.id, email: data.user.email || '' } };
  } catch (e) { return fail(e); }
}
export async function signOut() {
  if (!client) return;
  try { await client.auth.signOut({ scope: 'local' }); } catch { /* the local session is gone either way */ }
}

export async function isStaff() {
  const r = await rpc('is_staff');
  return r.ok ? { ok: true, data: r.data === true } : r;
}
export async function redeemInvite(code) {
  const r = await rpc('redeem_staff_invite', { p_code: code });
  if (!r.ok) return r;
  if (r.data && r.data.ok === true) return { ok: true };
  const c = r.data && r.data.code;
  if (c === 'signed_out') return { ok: false, kind: 'signed_out', message: 'Your session ended. Sign in again.' };
  return { ok: false, kind: 'invalid', message: 'That code is not valid, or it was already used. A staff code works once.' };
}
export async function overview() {
  const r = await rpc('ops_overview');
  if (r.ok && (!r.data || typeof r.data !== 'object')) return { ok: false, kind: 'server', message: 'The server sent an empty answer.' };
  return r;
}
function okFlag(r, codes) {
  if (!r.ok) return r;
  if (r.data && r.data.ok === true) return { ok: true };
  const c = String((r.data && r.data.code) || 'failed');
  return { ok: false, kind: 'server', message: codes[c] || `The server answered: ${c.slice(0, 60)}` };
}
export async function setEntitlement(args) {
  return okFlag(await rpc('ops_set_entitlement', args), { no_business: 'This business no longer exists.' });
}
export async function updateLead(args) {
  return okFlag(await rpc('ops_update_lead', args), { no_lead: 'This enquiry no longer exists.' });
}
