// The only way the simulator talks to Mana: HTTP to the gateway, as the apps do (PostgREST under /rest/v1, GoTrue under
// /auth/v1), with the anon key and, for signed-in bots, the user's own JWT. No database connection, no service role
// except to create test accounts through GoTrue's admin API (what the local "sign up" is, since there is no mail service).
//
// A target is { apiUrl, anonKey, serviceKey? }: the local stack (sim/stack/start.mjs) is one.

export class ApiError extends Error {
  constructor(status, body, what) {
    const b = body && typeof body === 'object' ? body : { message: String(body ?? '') };
    super(`${what}: HTTP ${status} ${b.code ? b.code + ' ' : ''}${b.message || b.msg || b.error_description || b.error || ''}`.trim());
    this.status = status;
    this.code = b.code ?? b.error_code ?? null;
    this.details = b.details ?? null;
    this.hint = b.hint ?? null;
    this.body = b;
  }
}

const qs = (filter) => {
  if (!filter) return '';
  if (typeof filter === 'string') return filter.replace(/^\?/, '');
  return new URLSearchParams(Object.entries(filter).map(([k, v]) => [k, String(v)])).toString();
};

export class Api {
  /** @param o {{ url: string, apikey: string, token?: string|null, ip?: string|null }} */
  constructor({ url, apikey, token = null, ip = null }) {
    this.url = url.replace(/\/$/, '');
    this.apikey = apikey;
    this.token = token;
    this.ip = ip;
    /** The last response's headers (tests read set-cookie and friends). */
    this.lastHeaders = null;
  }

  headers(extra = {}) {
    const h = { apikey: this.apikey, 'content-type': 'application/json', ...extra };
    if (this.token) h.authorization = 'Bearer ' + this.token;
    if (this.ip) h['x-sim-client-ip'] = this.ip;
    return h;
  }

  async request(method, path, { body, headers = {}, what } = {}) {
    const res = await fetch(this.url + path, { method, headers: this.headers(headers), body: body === undefined ? undefined : JSON.stringify(body) });
    this.lastHeaders = res.headers;
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (res.status >= 400) throw new ApiError(res.status, data, what || `${method} ${path}`);
    return data;
  }

  /** POST /rest/v1/rpc/<fn> with named arguments. */
  rpc(fn, args = {}) {
    return this.request('POST', `/rest/v1/rpc/${fn}`, { body: args, what: `rpc ${fn}` });
  }

  select(table, filter = 'select=*') {
    return this.request('GET', `/rest/v1/${table}?${qs(filter)}`, { what: `select ${table}` });
  }

  /** Inserts one row or many (every row with the same keys) and returns the stored rows. */
  insert(table, rows, { select = '*' } = {}) {
    return this.request('POST', `/rest/v1/${table}?select=${select}`, { body: rows, headers: { prefer: 'return=representation' }, what: `insert ${table}` });
  }

  /** PATCH with filters; returns the rows changed (RLS may make that none, without an error). */
  update(table, filter, patch) {
    return this.request('PATCH', `/rest/v1/${table}?${qs(filter)}`, { body: patch, headers: { prefer: 'return=representation' }, what: `update ${table}` });
  }

  remove(table, filter) {
    return this.request('DELETE', `/rest/v1/${table}?${qs(filter)}`, { headers: { prefer: 'return=representation' }, what: `delete ${table}` });
  }
}

/** An account with a confirmed e-mail, made through GoTrue's admin API (local sign-up: there is no mail service). */
export async function createUser(target, { email, password, confirmed = true }) {
  if (!target.serviceKey) throw new Error('createUser needs the target\'s service key (local stack only)');
  const admin = new Api({ url: target.apiUrl, apikey: target.serviceKey, token: target.serviceKey });
  return admin.request('POST', '/auth/v1/admin/users', { body: { email, password, email_confirm: confirmed }, what: 'admin create user' });
}

/** Password sign-in, as the apps do: a session with the user's JWT. */
export async function signIn(target, { email, password }) {
  const anon = new Api({ url: target.apiUrl, apikey: target.anonKey });
  const s = await anon.request('POST', '/auth/v1/token?grant_type=password', { body: { email, password }, what: 'sign in' });
  return { token: s.access_token, userId: s.user.id, email: s.user.email };
}

/** A signed-in API client for a target. */
export function asUser(target, session, { ip = null } = {}) {
  return new Api({ url: target.apiUrl, apikey: target.anonKey, token: session.token, ip });
}

/** An anonymous API client (a guest's phone, the product page). */
export function asAnon(target, { ip = null } = {}) {
  return new Api({ url: target.apiUrl, apikey: target.anonKey, ip });
}
