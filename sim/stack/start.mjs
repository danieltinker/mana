// A local Supabase-compatible stack for Mana's CLEAN schema (supabase/migrations), for the simulator and the e2e tests:
//
//   PostgreSQL 16 → bootstrap.sql (roles, auth/storage/extensions schemas, storage tables, realtime publication)
//   → GoTrue 2.180.0 (the real binary; it migrates the auth schema itself) → after-auth.sql (auth.uid/role/jwt)
//   → every supabase/migrations/*.sql in name order, unchanged → app_config.public_base set to a local URL
//   → PostgREST 12.2.3 (the real binary, same JWT secret) → gateway.mjs (/auth/v1, /rest/v1, apikey check)
//
// Nothing here touches a remote database. The studio's own stack (apps/studio/test/stack, the OLD schema in db/) is
// untouched; only its binaries are reused when present (binaries.mjs).
//
// Usage: npm run stack -w sim  (= node sim/src/cli.mjs stack [--keep]; keeps running, Ctrl-C stops everything)
//        import { startStack } from '@mana/sim/stack'   (tests: await startStack({ ports: 'auto' }) … await stack.stop())
// Ports: SIM_PORT_BASE (default 57500): gateway +21, PostgreSQL +29, GoTrue +31, PostgREST +32, web (e2e) +80.
//        ports: 'auto' takes free ports instead (the tests do, so they never collide with a running `sim stack`).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { locateBinaries, ROOT } from './binaries.mjs';
import { startGateway } from './gateway.mjs';
import { signJwt } from './jwt.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS = path.join(ROOT, 'supabase/migrations');
const PGBIN = process.env.PGBIN || '/usr/lib/postgresql/16/bin';
const OSUSER = process.env.STACK_OS_USER || 'claude';
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const asPg = (cmd, args) => (isRoot ? ['runuser', ['-u', OSUSER, '--', cmd, ...args]] : [cmd, args]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// LOCAL ONLY. Never a project's secret: it signs the stack's own anon and service keys and GoTrue's sessions.
export const JWT_SECRET = 'sim-local-only-secret-not-for-any-project-0123456789';
// The demo caps the architect's schema gives demo venues (app_config.event_caps_demo); used locally when the
// migrations on this branch do not have that key yet (stack.notes says so).
const DEMO_CAPS = { per_source_hour: 100000, per_venue_source_day: 1000000, per_venue_day: 1000000 };

function run(cmd, args, { pg: asPostgres = false, ...opts } = {}) {
  const [c, a] = asPostgres ? asPg(cmd, args) : [cmd, args];
  const r = spawnSync(c, a, { encoding: 'utf8', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${r.stdout || ''}\n${r.stderr || ''}`);
  return r.stdout;
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  });
}
async function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
  });
}

async function waitFor(fn, what, ms = 30000) {
  const t0 = Date.now(); let last;
  while (Date.now() - t0 < ms) { try { if (await fn()) return; } catch (e) { last = e; } await sleep(120); }
  throw new Error('timed out waiting for ' + what + (last ? ': ' + last.message : ''));
}

export function migrationFiles() {
  return fs.readdirSync(MIGRATIONS).filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort();
}

// The keys are the same on every start (a fixed issue time), so a second process can attach to a running stack.
const ISSUED = 1760000000;
function addresses(P) {
  return {
    API_URL: `http://127.0.0.1:${P.api}`,
    DB_URL: `postgres://postgres@127.0.0.1:${P.pg}/postgres`,
    ANON_KEY: signJwt({ role: 'anon', iss: 'mana-sim-local' }, JWT_SECRET, { issuedAt: ISSUED, expiresInSec: 20 * 365 * 24 * 3600 }),
    SERVICE_KEY: signJwt({ role: 'service_role', iss: 'mana-sim-local' }, JWT_SECRET, { issuedAt: ISSUED, expiresInSec: 20 * 365 * 24 * 3600 }),
  };
}

export async function resolvePorts(ports = process.env.SIM_PORT_BASE || 57500) {
  if (ports && typeof ports === 'object') return { ...ports };
  if (ports === 'auto') return { api: await freePort(), pg: await freePort(), auth: await freePort(), rest: await freePort(), web: await freePort() };
  const base = Number(ports);
  if (!Number.isInteger(base) || base < 1024 || base > 65400) throw new Error('SIM_PORT_BASE must be a port number (1024–65400), got ' + ports);
  return { api: base + 21, pg: base + 29, auth: base + 31, rest: base + 32, web: base + 80 };
}

/**
 * Starts the stack. Options:
 *   ports       'auto' | a base port (default $SIM_PORT_BASE or 57500) | { api, pg, auth, rest, web }
 *   dir         where the database and the logs live (default: a fresh temp folder, removed by stop())
 *   keep        stop() leaves `dir` in place (a later start with the same dir reuses the database)
 *   eventCaps   'auto' (default: demo caps from the schema, or raised locally when the schema has none) | 'schema'
 *   approval    true (default: the schema's publish_requires_approval) | false (turned off locally)
 *   simClientIp honour x-sim-client-ip (default true; see gateway.mjs)
 *   quiet       no progress lines (default true)
 */
export async function startStack({ ports, dir, keep = false, eventCaps = 'auto', approval = true, simClientIp = true, quiet = true } = {}) {
  const log = (...a) => { if (!quiet) console.error('[sim]', ...a); };
  const P = await resolvePorts(ports);
  // keep without a dir: the database lives on in a fixed folder per port base, and the next keep start reuses it
  if (keep && !dir) dir = path.join(os.tmpdir(), `mana-sim-data-${P.pg}`);
  for (const [k, p] of Object.entries(P)) if (k !== 'web' && !(await portFree(p))) throw new Error(`port ${p} (${k}) is taken; set SIM_PORT_BASE or use ports: 'auto'`);
  const bin = locateBinaries({ log });
  const work = dir ? path.resolve(dir) : fs.mkdtempSync(path.join(os.tmpdir(), 'mana-sim-'));
  fs.mkdirSync(work, { recursive: true });
  const pgdata = path.join(work, 'pgdata');
  const logs = path.join(work, 'logs');
  fs.mkdirSync(logs, { recursive: true });
  if (isRoot) run('chown', ['-R', OSUSER, work]);

  const { API_URL, DB_URL, ANON_KEY, SERVICE_KEY } = addresses(P);
  const children = [];
  const notes = [];
  let stopping = false;
  let pool = null;
  let gw = null;

  const pgStop = (mode = 'fast') => {
    try { run(path.join(PGBIN, 'pg_ctl'), ['-D', pgdata, '-m', mode, '-w', '-t', '20', 'stop'], { pg: true, stdio: 'ignore' }); } catch { /* not running */ }
  };
  // a crashed test must not leave processes behind
  const onExit = () => { for (const ch of children) { try { ch.kill('SIGKILL'); } catch { /* gone */ } } pgStop('immediate'); };
  process.once('exit', onExit);

  const stop = async () => {
    if (stopping) return;
    stopping = true;
    process.removeListener('exit', onExit);
    if (gw) await gw.close().catch(() => {});
    if (pool) await Promise.race([pool.end().catch(() => {}), sleep(2000)]);
    for (const ch of children) { try { ch.kill('SIGTERM'); } catch { /* gone */ } }
    await Promise.race([Promise.all(children.map((ch) => (ch.exitCode !== null || ch.signalCode !== null ? null : new Promise((r) => ch.once('exit', r))))), sleep(3000)]);
    for (const ch of children) if (ch.exitCode === null && ch.signalCode === null) { try { ch.kill('SIGKILL'); } catch { /* gone */ } }
    pgStop('fast');
    if (!keep && !dir) fs.rmSync(work, { recursive: true, force: true });
  };

  try {
    // ---- PostgreSQL 16
    const first = !fs.existsSync(path.join(pgdata, 'PG_VERSION'));
    if (first) {
      run(path.join(PGBIN, 'initdb'), ['-D', pgdata, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C.UTF-8'], { pg: true });
      fs.appendFileSync(path.join(pgdata, 'postgresql.conf'), [
        '', `port = ${P.pg}`, `listen_addresses = '127.0.0.1'`, `unix_socket_directories = ''`, 'fsync = off', 'synchronous_commit = off',
        'full_page_writes = off', 'max_connections = 40', 'shared_buffers = 32MB', `timezone = 'UTC'`, 'log_min_messages = warning', '',
      ].join('\n'));
    } else {
      fs.writeFileSync(path.join(pgdata, 'postgresql.auto.conf'), `port = ${P.pg}\n`);
    }
    run(path.join(PGBIN, 'pg_ctl'), ['-D', pgdata, '-l', path.join(logs, 'postgres.log'), '-w', '-t', '30', 'start'], { pg: true, stdio: 'ignore' });
    pool = new pg.Pool({ connectionString: DB_URL, max: 4 });
    pool.on('error', () => {});
    if (first) await pool.query(fs.readFileSync(path.join(HERE, 'bootstrap.sql'), 'utf8'));

    const spawnLogged = (name, cmd, args, opts) => {
      const out = fs.openSync(path.join(logs, name + '.log'), 'a');
      const ch = spawn(cmd, args, { stdio: ['ignore', out, out], ...opts });
      fs.closeSync(out);
      children.push(ch);
      ch.on('exit', (code) => { if (!stopping && code) console.error(`[sim] ${name} exited with ${code}; see ${path.join(logs, name + '.log')}`); });
      return ch;
    };

    // ---- GoTrue: real Supabase Auth. Public sign-up is off locally (no mail service); accounts are made through the
    // admin API with a confirmed e-mail, as the simulator's bots do.
    const noProxy = { HTTPS_PROXY: '', HTTP_PROXY: '', https_proxy: '', http_proxy: '', NO_PROXY: '*', no_proxy: '*' };
    const authEnv = {
      PATH: process.env.PATH, ...noProxy,
      GOTRUE_API_HOST: '127.0.0.1', PORT: String(P.auth), GOTRUE_API_PORT: String(P.auth),
      GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:local@127.0.0.1:${P.pg}/postgres`,
      DATABASE_URL: `postgres://supabase_auth_admin:local@127.0.0.1:${P.pg}/postgres`,
      GOTRUE_SITE_URL: `http://127.0.0.1:${P.web}/`, API_EXTERNAL_URL: API_URL + '/auth/v1',
      GOTRUE_JWT_SECRET: JWT_SECRET, GOTRUE_JWT_EXP: '3600', GOTRUE_JWT_AUD: 'authenticated', GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
      GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_DISABLE_SIGNUP: 'true', GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'false',
      GOTRUE_RATE_LIMIT_TOKEN_REFRESH: '100000', GOTRUE_RATE_LIMIT_VERIFY: '100000', GOTRUE_RATE_LIMIT_EMAIL_SENT: '100000', GOTRUE_LOG_LEVEL: 'warn',
    };
    const gotrueDir = path.join(bin, 'gotrue');
    if (first) {
      const m = spawnSync(path.join(gotrueDir, 'auth'), ['migrate'], { cwd: gotrueDir, env: authEnv, encoding: 'utf8' });
      fs.writeFileSync(path.join(logs, 'gotrue-migrate.log'), (m.stdout || '') + (m.stderr || ''));
      if (m.status !== 0) throw new Error('GoTrue migrations failed, see ' + path.join(logs, 'gotrue-migrate.log'));
    }
    spawnLogged('gotrue', path.join(gotrueDir, 'auth'), ['serve'], { cwd: gotrueDir, env: authEnv });
    await waitFor(async () => (await fetch(`http://127.0.0.1:${P.auth}/health`)).ok, 'GoTrue', 60000);

    // ---- the clean schema, unchanged, in name order
    if (first) {
      await pool.query(fs.readFileSync(path.join(HERE, 'after-auth.sql'), 'utf8'));
      for (const f of migrationFiles()) {
        try { await pool.query(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')); } catch (e) {
          throw new Error(`migration ${f} failed: ${e.message}${e.where ? '\n' + e.where : ''}${e.position ? ' @' + e.position : ''}`);
        }
      }
      // the local differences, each named in stack.notes
      await pool.query(`update public.app_config set value = to_jsonb($1::text) where key = 'public_base'`, [`${API_URL}/storage/v1/object/public/menu-public/`]);
      notes.push(`public_base = ${API_URL}/storage/v1/object/public/menu-public/ (no storage service runs locally)`);
      const hasDemoCaps = (await pool.query(`select 1 from public.app_config where key = 'event_caps_demo'`)).rowCount > 0;
      if (eventCaps === 'auto' && !hasDemoCaps) {
        await pool.query(`update public.app_config set value = value || $1::jsonb where key = 'event_caps'`, [JSON.stringify(DEMO_CAPS)]);
        notes.push('event_caps raised locally (this schema has no event_caps_demo yet)');
      }
      if (!approval) {
        await pool.query(`update public.app_config set value = 'false' where key = 'publish_requires_approval'`);
        notes.push('publish_requires_approval = false (local)');
      }
    }

    // ---- PostgREST: the real binary, the same JWT secret, so RLS, triggers and RPCs answer exactly as written
    spawnLogged('postgrest', path.join(bin, 'postgrest'), [], { env: { PATH: process.env.PATH, ...noProxy,
      PGRST_DB_URI: `postgres://authenticator:local@127.0.0.1:${P.pg}/postgres`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: JWT_SECRET, PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: String(P.rest), PGRST_DB_EXTRA_SEARCH_PATH: 'public,extensions',
      PGRST_DB_MAX_ROWS: '1000', PGRST_DB_POOL: '6', PGRST_LOG_LEVEL: 'error' } });
    await waitFor(async () => (await fetch(`http://127.0.0.1:${P.rest}/`)).status < 500, 'PostgREST');

    // ---- the gateway
    gw = await startGateway({ port: P.api, restPort: P.rest, authPort: P.auth, anonKey: ANON_KEY, serviceKey: SERVICE_KEY, simClientIp, log });
  } catch (e) {
    const tail = (f) => { try { return fs.readFileSync(path.join(logs, f), 'utf8').slice(-1500); } catch { return ''; } };
    await stop();
    throw new Error(`${e.message}\n--- postgres.log\n${tail('postgres.log')}\n--- gotrue.log\n${tail('gotrue.log')}\n--- postgrest.log\n${tail('postgrest.log')}`);
  }

  return { ...handle(P, pool), dir: work, notes, stop };
}

/** A stack another process started (`sim stack`), found by its ports: the same handle, and stop() only lets go. */
export async function attachStack({ ports } = {}) {
  const P = await resolvePorts(ports);
  const { API_URL } = addresses(P);
  try {
    const r = await fetch(API_URL + '/auth/v1/health');
    if (!r.ok) throw new Error('HTTP ' + r.status);
  } catch (e) {
    throw new Error(`no simulator stack answers at ${API_URL} (${e.message}); start one with: npm run stack -w sim`);
  }
  const pool = new pg.Pool({ connectionString: addresses(P).DB_URL, max: 2 });
  pool.on('error', () => {});
  return { ...handle(P, pool), notes: [], stop: () => pool.end() };
}

function handle(P, pool) {
  const { API_URL, DB_URL, ANON_KEY, SERVICE_KEY } = addresses(P);
  const sql = async (text, params = []) => (await pool.query(text, params)).rows;
  return {
    apiUrl: API_URL, dbUrl: DB_URL, anonKey: ANON_KEY, serviceKey: SERVICE_KEY, ports: P,
    /** Superuser SQL: SETUP ONLY (what a person with the database does by hand). The bots never use it. */
    sql,
    /**
     * What a Supabase project's pg_cron does every minute (20261015120600_jobs.sql): turn queued events into the minute
     * and day rollups. Locally nothing is scheduled, so the simulator calls it when it wants the dashboards current.
     */
    buildRollups: async () => (await sql('select app.build_rollups() as r'))[0].r,
    /** README "the first admin is added once by SQL": make a signed-up user Halom staff. */
    addStaff: (userId, role = 'admin') => sql(`insert into public.staff (user_id, role, note) values ($1, $2, 'sim setup') on conflict (user_id) do nothing`, [userId, role]),
    /** A venue member with a role no RPC hands out yet (team invites are phase 2): manager or counter. */
    addMember: (venueId, userId, role) => sql(`insert into public.venue_members (venue_id, user_id, role) values ($1, $2, $3)`, [venueId, userId, role]),
    /** A setting in public.app_config (tests that change a switch). */
    setConfig: (key, value) => sql(`update public.app_config set value = $2::jsonb, updated_at = now() where key = $1`, [key, JSON.stringify(value)]),
  };
}
