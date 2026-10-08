// A local stand-in for the Supabase project, good enough for this page: the calls supabase-js makes for password
// sign-in, sign-out and the five RPCs, with the same rules as db/0001_core.sql. It also serves dist/ under the two
// path prefixes the page will live at. Start: `node test/stub.mjs [port]` → http://127.0.0.1:8787/projects/menus/ops/
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenario, USERS, INVITES } from './fixtures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(root, 'dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const DAY = 86400000;
const ilDay = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const LEAD_STATUS = ['new', 'qualified', 'scoped', 'agreed', 'production', 'review', 'deployed', 'support', 'lost', 'spam'];

export function createStub() {
  const S = { users: USERS(), invites: INVITES(), data: scenario('many'), faults: {}, delay: 0, tokens: new Map(), calls: [] };
  const reset = (name = 'many') => { S.users = USERS(); S.invites = INVITES(); S.data = scenario(name); S.faults = {}; S.delay = 0; S.calls = []; };

  const planState = (b) => {
    const now = Date.now();
    if (b.plan_status === 'trialing' && b.trial_ends_at && Date.parse(b.trial_ends_at) < now) return 'expired';
    if (b.plan_status === 'active' && b.current_period_end && Date.parse(b.current_period_end) < now) return 'expired';
    return b.plan_status;
  };
  function overview() {
    const now = Date.now(), today = ilDay(now);
    const dayBack = (n) => new Date(Date.parse(today + 'T00:00:00Z') - n * DAY).toISOString().slice(0, 10);
    const views = new Map(), signups = new Map();
    const businesses = S.data.businesses.map((b) => {
      const { _views, ...row } = b;
      let total = 0, v7 = 0;
      for (const [day, n] of Object.entries(_views)) { total += n; if (day > dayBack(7)) v7 += n; if (day > dayBack(30)) views.set(day, (views.get(day) || 0) + n); }
      if (Date.parse(b.created_at) > now - 30 * DAY) { const d = ilDay(Date.parse(b.created_at)); signups.set(d, (signups.get(d) || 0) + 1); }
      return { ...row, plan_state: planState(b), views_total: total, views_7d: v7 };
    }).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return {
      generatedAt: new Date(now).toISOString(), businesses,
      viewsByDay: [...views].sort().map(([day, v]) => ({ day, views: v })),
      signupsByDay: [...signups].sort().map(([day, n]) => ({ day, businesses: n })),
      accountsWithoutBusiness: S.data.accountsWithoutBusiness,
      leads: [...S.data.leads].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 300),
    };
  }
  const pgErr = (res, status, code, message) => json(res, status, { code, details: null, hint: null, message });
  const notStaff = (res) => pgErr(res, 403, '42501', 'not_staff');

  const rpc = {
    is_staff: (u) => u.staff === true,
    redeem_staff_invite: async (u, a) => {
      if (u.staff) return { ok: true };
      const i = S.invites.indexOf(String(a.p_code ?? '').trim());
      if (i < 0) { await new Promise((r) => setTimeout(r, 150)); return { ok: false, code: 'invalid' }; }
      S.invites.splice(i, 1); u.staff = true; return { ok: true };
    },
    ops_overview: (u, a, res) => (u.staff ? overview() : notStaff(res)),
    ops_set_entitlement: (u, a, res) => {
      if (!u.staff) return notStaff(res);
      if (!['trial', 'pilot', 'paid'].includes(a.p_plan)) return pgErr(res, 400, '23514', 'new row for relation "entitlements" violates check constraint "entitlements_plan_check"');
      if (!['pending', 'trialing', 'active', 'expired', 'suspended'].includes(a.p_status)) return pgErr(res, 400, '23514', 'new row for relation "entitlements" violates check constraint "entitlements_status_check"');
      if (a.p_until != null && Number.isNaN(Date.parse(a.p_until))) return pgErr(res, 400, '22007', `invalid input syntax for type timestamp with time zone: "${a.p_until}"`);
      const b = S.data.businesses.find((x) => x.id === a.p_business);
      if (!b) return { ok: false, code: 'no_business' };
      const until = a.p_until ? new Date(a.p_until).toISOString() : null;
      b.plan = a.p_plan; b.plan_status = a.p_status;
      if (a.p_status === 'trialing') { b.trial_ends_at = until ?? b.trial_ends_at ?? new Date(Date.now() + 30 * DAY).toISOString(); b.trial_started_at = b.trial_started_at ?? new Date().toISOString(); }
      if (a.p_status === 'active') b.current_period_end = until;
      const note = String(a.p_note ?? '').slice(0, 500);
      if (note !== '') b.plan_note = note;
      return { ok: true };
    },
    ops_update_lead: (u, a, res) => {
      if (!u.staff) return notStaff(res);
      if (a.p_status != null && !LEAD_STATUS.includes(a.p_status)) return pgErr(res, 400, '23514', 'new row for relation "leads" violates check constraint "leads_status_check"');
      if ((a.p_owner ?? '').length > 80 || (a.p_next_action ?? '').length > 300 || (a.p_notes ?? '').length > 4000) return pgErr(res, 400, '23514', 'new row for relation "leads" violates check constraint');
      if (a.p_next_action_on != null && !/^\d{4}-\d{2}-\d{2}$/.test(a.p_next_action_on)) return pgErr(res, 400, '22007', `invalid input syntax for type date: "${a.p_next_action_on}"`);
      const l = S.data.leads.find((x) => x.id === a.p_id);
      if (!l) return { ok: false, code: 'no_lead' };
      l.status = a.p_status ?? l.status; l.owner = a.p_owner ?? l.owner; l.next_action = a.p_next_action ?? l.next_action;
      l.next_action_on = a.p_next_action_on ?? l.next_action_on; l.notes = a.p_notes ?? l.notes;
      return { ok: true };
    },
  };

  function json(res, status, body) {
    if (res.writableEnded) return undefined;
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body)); return undefined;
  }
  const body = (req) => new Promise((resolve) => { let s = ''; req.on('data', (c) => { s += c; }); req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { resolve({}); } }); });
  function session(email) {
    const u = S.users[email]; const now = Math.floor(Date.now() / 1000);
    const access = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, email, role: 'authenticated', aud: 'authenticated', exp: now + 3600, iat: now })}.stub${Math.random().toString(36).slice(2)}`;
    S.tokens.set(access, email);
    const user = { id: u.id, aud: 'authenticated', role: 'authenticated', email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-06T00:00:00Z' };
    return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: 'r-' + access.slice(-12), user };
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    try {
      // ---- test control
      if (p === '/__stub/control' && req.method === 'POST') {
        const c = await body(req);
        if (c.reset !== undefined) reset(c.reset || 'many');
        if (c.faults) S.faults = c.faults;
        if (c.delay !== undefined) S.delay = c.delay;
        if (c.addBusiness) S.data.businesses.push(scenario('one').businesses[0]);
        if (c.revokeStaff) S.users[c.revokeStaff].staff = false;
        return json(res, 200, { ok: true, calls: S.calls, leads: S.data.leads, businesses: S.data.businesses });
      }
      // ---- auth
      if (p === '/auth/v1/token' && req.method === 'POST') {
        const a = await body(req);
        if (S.faults.signin === 'timeout') return undefined;            // never answers
        if (url.searchParams.get('grant_type') === 'password') {
          const u = S.users[String(a.email || '').toLowerCase()];
          if (!u || u.password !== a.password) return json(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
          return json(res, 200, session(String(a.email).toLowerCase()));
        }
        return json(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
      }
      if (p === '/auth/v1/logout') { res.writeHead(204); return res.end(); }
      if (p === '/auth/v1/user') {
        const email = S.tokens.get((req.headers.authorization || '').replace(/^Bearer /, ''));
        return email ? json(res, 200, session(email).user) : json(res, 401, { code: 401, msg: 'invalid JWT' });
      }
      // ---- RPC
      if (p.startsWith('/rest/v1/rpc/') && req.method === 'POST') {
        const name = p.slice('/rest/v1/rpc/'.length);
        const args = await body(req);
        S.calls.push({ name, args, at: Date.now() });
        if (!req.headers.apikey) return json(res, 401, { message: 'No API key found in request' });
        const email = S.tokens.get((req.headers.authorization || '').replace(/^Bearer /, ''));
        if (!email || !S.users[email]) return pgErr(res, 401, 'PGRST301', 'JWT expired');
        if (!rpc[name]) return pgErr(res, 404, 'PGRST202', `Could not find the function public.${name} in the schema cache`);
        const f = S.faults[name];
        if (f) {
          if (f.times !== undefined) { f.times -= 1; if (f.times <= 0) delete S.faults[name]; }
          if (f.mode === 'timeout') return undefined;                    // never answers
          if (f.mode === 'error') return pgErr(res, 500, 'XX000', 'stub: simulated database error');
          if (f.mode === 'jwt') return pgErr(res, 401, 'PGRST301', 'JWT expired');
          if (f.mode === 'not_staff') return notStaff(res);
          if (f.mode === 'okfalse') return json(res, 200, { ok: false, code: f.code || 'failed' });
          if (f.mode === 'garbage') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('null'); }
        }
        if (S.delay) await new Promise((r) => setTimeout(r, S.delay));
        const out = await rpc[name](S.users[email], args, res);
        return res.writableEnded ? undefined : json(res, 200, out);
      }
      // ---- static: the page under both public prefixes
      for (const prefix of ['/projects/menus', '/mana']) {
        if (p === `${prefix}/config.js`) {
          const origin = `http://${req.headers.host}`;
          res.writeHead(200, { 'content-type': MIME['.js'], 'cache-control': 'no-store' });
          return res.end(`window.HALOM_MENUS_CONFIG = ${JSON.stringify({ supabaseUrl: origin, supabaseKey: 'sb_publishable_stub', shortBase: 'https://halom.io/m/', viewPath: '../view/', genPath: '../gen/' })};`);
        }
        if (p === `${prefix}/ops`) { res.writeHead(301, { location: `${prefix}/ops/` }); return res.end(); }
        if (p.startsWith(`${prefix}/ops/`)) {
          const rel = p.slice(`${prefix}/ops/`.length) || 'index.html';
          const file = path.join(DIST, rel);
          if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
          const data = await readFile(file);
          res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
          return res.end(data);
        }
        if (p === `${prefix}/studio/` || p === `${prefix}/view/`) { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(`<!doctype html><title>stub</title><p>stub page for ${p}${url.search}</p>`); }
      }
      res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found');
    } catch (e) {
      if (!res.writableEnded) { res.writeHead(e && e.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain' }); res.end(String(e && e.message)); }
    }
  });
  return {
    state: S, reset, server, overview,
    listen: (port = 0) => new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server.address().port))),
    close: () => new Promise((resolve) => { server.closeAllConnections?.(); server.close(() => resolve()); }),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stub = createStub();
  const port = await stub.listen(Number(process.argv[2]) || 8787);
  if (process.argv[3]) stub.reset(process.argv[3]);
  console.log(`Mana ops stub: http://127.0.0.1:${port}/projects/menus/ops/\n  staff: staff@halom.test / correct-horse\n  not staff: owner@cafe.test / owner-pass-1 (staff code HALOM-STAFF-1)`);
}
