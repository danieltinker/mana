// A local stand-in for a schema-2 Supabase project, for the v2 back office's browser tests and for looking at it: the
// calls supabase-js makes for password sign-in, the caller's own staff row, and the staff RPCs, answered by the typed
// fake (fake.ts, contract-valid shapes). It serves dist/ at /mana/ops/ with a config that says schema 2, realtime off.
// Start: `npm run serve:v2` → http://127.0.0.1:8788/mana/ops/ (the accounts are below; they exist only in this stub).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { USERS, addTraffic, fakeBackend, world } from './fake.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(root, 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** Test accounts of this stub only (localhost). */
export const ACCOUNTS = {
  admin: { email: 'admin@halom.test', password: 'stub-admin-pass', id: USERS.admin },
  support: { email: 'support@halom.test', password: 'stub-support-pass', id: USERS.support },
  owner: { email: 'owner@cafe.test', password: 'stub-owner-pass', id: USERS.owner },
};
/** The staff RPCs: the ones `staff_require_aal2` closes to a password-only session. */
const STAFF_RPC = new Set(['ops_venues', 'ops_venue', 'ops_analytics', 'ops_update_case', 'ops_set_demo', 'ops_approve_venue', 'act_for_owner', 'ops_set_plan', 'ops_leads', 'ops_update_lead']);

export function createStub() {
  const S = { w: world(), tokens: new Map(), requireAal2: false };
  const reset = ({ traffic = true } = {}) => { S.w = world({ traffic }); S.tokens.clear(); S.requireAal2 = false; };

  const json = (res, status, body) => {
    if (res.writableEnded) return;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const body = (req) => new Promise((resolve) => { let s = ''; req.on('data', (c) => { s += c; }); req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { resolve({}); } }); });
  const session = (a) => {
    const now = Math.floor(Date.now() / 1000);
    const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: a.id, email: a.email, role: 'authenticated', aud: 'authenticated', aal: 'aal1', exp: now + 3600, iat: now })}.stub${Math.random().toString(36).slice(2)}`;
    S.tokens.set(access, a);
    const user = { id: a.id, aud: 'authenticated', role: 'authenticated', email: a.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' };
    return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r-' + access.slice(-12), user };
  };
  const who = (req) => S.tokens.get((req.headers.authorization || '').replace(/^Bearer /, '')) ?? null;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    try {
      if (p === '/__stub/control' && req.method === 'POST') {
        const c = await body(req);
        if (c.reset) reset(c.reset === true ? {} : c.reset);
        if (c.faults) S.w.faults = c.faults;
        if (c.requireAal2 !== undefined) S.requireAal2 = c.requireAal2;
        if (c.traffic) addTraffic(S.w, c.traffic.venueId, c.traffic.counts);
        if (c.revokeStaff) S.w.staff.delete(c.revokeStaff);
        return json(res, 200, { ok: true, calls: S.w.calls });
      }
      if (p === '/auth/v1/token' && req.method === 'POST') {
        const a = await body(req);
        if (url.searchParams.get('grant_type') === 'password') {
          const acc = Object.values(ACCOUNTS).find((x) => x.email === String(a.email || '').toLowerCase());
          if (!acc || acc.password !== a.password) return json(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
          return json(res, 200, session(acc));
        }
        return json(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
      }
      if (p === '/auth/v1/logout') { res.writeHead(204); return res.end(); }
      if (p === '/auth/v1/user') { const a = who(req); return a ? json(res, 200, session(a).user) : json(res, 401, { code: 401, msg: 'invalid JWT' }); }
      if (p === '/rest/v1/staff' && req.method === 'GET') {
        const a = who(req);
        if (!a) return json(res, 401, { code: 'PGRST301', message: 'JWT expired' });
        const want = String(url.searchParams.get('user_id') || '').replace(/^eq\./, '');
        const r = await fakeBackend(S.w, a.id).staffRow(want === a.id ? a.id : '');      // RLS: your own row only
        return json(res, 200, r.data ? [r.data] : []);
      }
      if (p.startsWith('/rest/v1/rpc/') && req.method === 'POST') {
        const name = p.slice('/rest/v1/rpc/'.length);
        const args = await body(req);
        if (!req.headers.apikey) return json(res, 401, { message: 'No API key found in request' });
        const a = who(req);
        if (S.requireAal2 && STAFF_RPC.has(name)) {
          S.w.calls.push({ fn: name, args, user: a?.id ?? null });
          return json(res, 403, { code: '42501', details: null, hint: null, message: 'not_staff' });
        }
        const r = await fakeBackend(S.w, a?.id ?? null).rpc(name, args);
        if (r.error?.name === 'TimeoutError') return undefined;                          // never answers
        if (r.error) return json(res, r.error.status || 500, { code: r.error.code, details: null, hint: null, message: r.error.message });
        return json(res, 200, r.data);
      }
      if (p === '/mana/config.js') {
        res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' });
        return res.end(`window.HALOM_MENUS_CONFIG = ${JSON.stringify({ supabaseUrl: `http://${req.headers.host}`, supabaseKey: 'sb_publishable_stub', env: 'local', schema: 2, realtime: false,
          shortBase: `http://${req.headers.host}/m/`, viewPath: '../view/' })};`);
      }
      if (p === '/mana/ops') { res.writeHead(301, { location: '/mana/ops/' }); return res.end(); }
      if (p.startsWith('/mana/ops/')) {
        const file = path.join(DIST, p.slice('/mana/ops/'.length) || 'index.html');
        if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
        const data = await readFile(file);
        res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
        return res.end(data);
      }
      if (p === '/mana/view/') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(`<!doctype html><title>stub</title><p>the guest menu for ${url.search}</p>`); }
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
    } catch (e) {
      if (!res.writableEnded) { res.writeHead(e && e.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain' }); res.end(String(e && e.message)); }
    }
  });
  return {
    get world() { return S.w; },
    reset, server,
    listen: (port = 0) => new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server.address().port))),
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stub = createStub();
  const port = await stub.listen(Number(process.argv[2]) || 8788);
  console.log(`Mana command center (v2) stub: http://127.0.0.1:${port}/mana/ops/\n  admin, support and a non-staff owner: see ACCOUNTS in test/v2/stub.mjs`);
}
