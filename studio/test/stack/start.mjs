// Starts a local Supabase-compatible stack for the studio's end-to-end tests:
//   PostgreSQL 16  →  GoTrue (auth)  →  every db/00*.sql in order  →  PostgREST  →  gateway (+ storage shim, sign-up function,
//   a stand-in for the menus-ai function)  →  static server
// Options: gen 'real' | 'fake' (a light stand-in generator for tests that are not about the generator itself),
//          providers ['google', …] (config.auth.providers). Folders can be swapped with STACK_VIEW / STACK_STOCK / STACK_GEN.
// Usage: node test/stack/start.mjs            (keeps running; Ctrl-C stops everything)
//        import { startStack } from './start.mjs'   (tests)
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import { startGateway, startStatic } from './gateway.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(HERE, '../..');
const MENUS = path.resolve(STUDIO, '..');
const STACK = path.join(STUDIO, 'test/.stack');
const PGBIN = process.env.PGBIN || '/usr/lib/postgresql/16/bin';
// Ports of this lane's own range (other work on the same machine uses 8791 and the usual Supabase ports); STACK_PORT_BASE moves them all.
const BASE = Number(process.env.STACK_PORT_BASE) || 57300;
export const PORTS = { pg: BASE + 29, auth: BASE + 31, rest: BASE + 32, api: BASE + 21, web: BASE + 80 };
export const PREFIX = '/halom-projects/projects/menus/';
export const JWT_SECRET = 'local-test-secret-not-for-production-0123456789abcdef';
export const ANON_KEY = jwt.sign({ role: 'anon', iss: 'supabase-local' }, JWT_SECRET, { expiresIn: '10y' });
export const SERVICE_KEY = jwt.sign({ role: 'service_role', iss: 'supabase-local' }, JWT_SECRET, { expiresIn: '10y' });
export const API_URL = 'http://127.0.0.1:' + PORTS.api;
export const WEB_URL = 'http://127.0.0.1:' + PORTS.web + PREFIX;
export const DB_URL = `postgres://postgres@127.0.0.1:${PORTS.pg}/postgres`;

const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const PGUSER = process.env.STACK_OS_USER || 'claude';
const asPg = (cmd, args) => (isRoot ? ['runuser', ['-u', PGUSER, '--', cmd, ...args]] : [cmd, args]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, args, opts = {}) {
  const [c, a] = opts.pg ? asPg(cmd, args) : [cmd, args];
  const r = spawnSync(c, a, { encoding: 'utf8', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
const psql = (args, opts) => run(path.join(PGBIN, 'psql'), ['-v', 'ON_ERROR_STOP=1', '-q', '-h', '127.0.0.1', '-p', String(PORTS.pg), '-U', 'postgres', '-d', 'postgres', ...args], opts);

async function waitFor(fn, what, ms = 30000) {
  const t0 = Date.now(); let last;
  while (Date.now() - t0 < ms) { try { if (await fn()) return; } catch (e) { last = e; } await sleep(150); }
  throw new Error('timed out waiting for ' + what + (last ? ': ' + last.message : ''));
}

export async function startStack({ quiet = true, fresh = true, gen = 'real', providers = [] } = {}) {
  const children = [];
  const logDir = path.join(STACK, 'logs');
  const pgdata = path.join(STACK, 'pgdata');
  fs.mkdirSync(logDir, { recursive: true });
  // a stack left over from an earlier run
  if (fs.existsSync(path.join(pgdata, 'postmaster.pid'))) { try { run(path.join(PGBIN, 'pg_ctl'), ['-D', pgdata, '-m', 'immediate', 'stop'], { pg: true }); } catch { /* not running */ } }
  spawnSync('pkill', ['-f', path.join(STACK, 'bin')]);
  if (fresh) { fs.rmSync(pgdata, { recursive: true, force: true }); fs.rmSync(path.join(STACK, 'storage'), { recursive: true, force: true }); }
  if (isRoot) run('chown', ['-R', PGUSER, STACK]);
  if (isRoot) for (let d = STACK; d !== '/' && d !== path.dirname(MENUS); d = path.dirname(d)) fs.chmodSync(d, fs.statSync(d).mode | 0o055);

  // ---- PostgreSQL
  const first = !fs.existsSync(path.join(pgdata, 'PG_VERSION'));
  if (first) {
    run(path.join(PGBIN, 'initdb'), ['-D', pgdata, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C.UTF-8'], { pg: true });
    fs.appendFileSync(path.join(pgdata, 'postgresql.conf'), `\nport = ${PORTS.pg}\nlisten_addresses = '127.0.0.1'\nunix_socket_directories = ''\nfsync = off\nsynchronous_commit = off\nfull_page_writes = off\nmax_connections = 60\nlog_min_messages = warning\n`);
  }
  run(path.join(PGBIN, 'pg_ctl'), ['-D', pgdata, '-l', path.join(logDir, 'postgres.log'), '-w', 'start'], { pg: true, stdio: 'ignore' });
  if (first) psql(['-f', path.join(HERE, 'bootstrap.sql')]);

  const spawnLogged = (name, cmd, args, opts) => {
    const out = fs.openSync(path.join(logDir, name + '.log'), 'a');
    const ch = spawn(cmd, args, { stdio: ['ignore', out, out], ...opts });
    children.push(ch);
    ch.on('exit', (code) => { if (!stopping && code) console.error(`[stack] ${name} exited with ${code}; see ${path.join(logDir, name + '.log')}`); });
    return ch;
  };
  let stopping = false;

  // ---- GoTrue (creates and migrates the auth schema itself)
  const authEnv = {
    ...process.env, GOTRUE_API_HOST: '127.0.0.1', PORT: String(PORTS.auth), GOTRUE_API_PORT: String(PORTS.auth),
    GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:local@127.0.0.1:${PORTS.pg}/postgres`,
    DATABASE_URL: `postgres://supabase_auth_admin:local@127.0.0.1:${PORTS.pg}/postgres`,
    GOTRUE_SITE_URL: WEB_URL, API_EXTERNAL_URL: API_URL + '/auth/v1', GOTRUE_JWT_SECRET: JWT_SECRET, GOTRUE_JWT_EXP: '3600', GOTRUE_JWT_AUD: 'authenticated',
    GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated', GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_DISABLE_SIGNUP: 'true', GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
    GOTRUE_MAILER_AUTOCONFIRM: 'true', GOTRUE_RATE_LIMIT_TOKEN_REFRESH: '10000', GOTRUE_RATE_LIMIT_VERIFY: '10000', GOTRUE_LOG_LEVEL: 'warn',
    HTTPS_PROXY: '', HTTP_PROXY: '', https_proxy: '', http_proxy: '', NO_PROXY: '*',
  };
  const gotrueDir = path.join(STACK, 'bin/gotrue');
  if (first) {
    const m = spawnSync(path.join(gotrueDir, 'auth'), ['migrate'], { cwd: gotrueDir, env: authEnv, encoding: 'utf8' });
    fs.writeFileSync(path.join(logDir, 'gotrue-migrate.log'), (m.stdout || '') + (m.stderr || ''));
    if (m.status !== 0) throw new Error('GoTrue migrations failed, see ' + path.join(logDir, 'gotrue-migrate.log'));
  }
  spawnLogged('gotrue', path.join(gotrueDir, 'auth'), ['serve'], { cwd: gotrueDir, env: authEnv });
  await waitFor(async () => (await fetch(`http://127.0.0.1:${PORTS.auth}/health`)).ok, 'GoTrue', 60000);
  if (first) {
    psql(['-f', path.join(HERE, 'after-auth.sql')]);
    // the live schema, unchanged: every migration in order (0001_core, 0002_mana_v2, …)
    for (const f of fs.readdirSync(path.join(MENUS, 'db')).filter((n) => /^00\d+.*\.sql$/.test(n)).sort()) psql(['-f', path.join(MENUS, 'db', f)]);
    // the only local difference: public files are served by the local gateway, not by the hosted project
    psql(['-c', `update public.app_config set value = to_jsonb('${API_URL}/storage/v1/object/public/menu-public/'::text) where key = 'public_base'`]);
  }

  // ---- PostgREST
  spawnLogged('postgrest', path.join(STACK, 'bin/postgrest'), [], { env: { ...process.env,
    PGRST_DB_URI: `postgres://authenticator:local@127.0.0.1:${PORTS.pg}/postgres`, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: JWT_SECRET,
    PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: String(PORTS.rest), PGRST_DB_EXTRA_SEARCH_PATH: 'public,extensions', PGRST_DB_MAX_ROWS: '1000', PGRST_LOG_LEVEL: 'error' } });
  await waitFor(async () => (await fetch(`http://127.0.0.1:${PORTS.rest}/`)).status < 500, 'PostgREST');

  // ---- gateway + static
  const gw = await startGateway({ port: PORTS.api, restPort: PORTS.rest, authPort: PORTS.auth, jwtSecret: JWT_SECRET, serviceKey: SERVICE_KEY, anonKey: ANON_KEY,
    dbUrl: `postgres://supabase_storage_admin:local@127.0.0.1:${PORTS.pg}/postgres`, dataDir: path.join(STACK, 'storage'), log: (...a) => { if (!quiet) console.error('[gateway]', ...a); } });
  const config = `window.HALOM_MENUS_CONFIG = ${JSON.stringify({ supabaseUrl: API_URL, supabaseKey: ANON_KEY, shortBase: 'https://halom.io/m/', shortLive: true,
    viewPath: '../view/', genPath: gen === 'fake' ? '../gen-fake/' : '../gen/', stockPath: '../stock/', sitePath: '../', auth: { providers }, features: { scan: true } }, null, 2)};\n`;
  const dir = (env, fallback) => (process.env[env] ? path.resolve(process.env[env]) : fallback);
  const web = await startStatic({ port: PORTS.web, prefix: PREFIX, virtual: { 'config.js': config }, mounts: {
    studio: dir('STACK_STUDIO', path.join(STUDIO, 'dist')), gen: dir('STACK_GEN', path.join(MENUS, 'gen')), 'gen-fake': path.join(HERE, 'fake-gen'),
    view: dir('STACK_VIEW', path.join(MENUS, 'view')), stock: dir('STACK_STOCK', path.join(MENUS, 'stock')) } });

  const stop = async () => {
    stopping = true;
    await gw.close(); web.close();
    for (const ch of children) { try { ch.kill('SIGTERM'); } catch { /* gone */ } }
    try { run(path.join(PGBIN, 'pg_ctl'), ['-D', pgdata, '-m', 'fast', '-w', 'stop'], { pg: true, stdio: 'ignore' }); } catch { /* already down */ }
  };
  return { stop, sql: (q) => psql(['-At', '-c', q]), API_URL, WEB_URL, ANON_KEY, SERVICE_KEY, DB_URL };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t0 = Date.now();
  const s = await startStack({ quiet: false, fresh: !process.argv.includes('--keep'), gen: process.argv.includes('--fake-gen') ? 'fake' : 'real' });
  console.log(`stack up in ${((Date.now() - t0) / 1000).toFixed(1)} s\n  app      ${WEB_URL}studio/\n  viewer   ${WEB_URL}view/?m=<slug>\n  api      ${API_URL}  (rest/v1, auth/v1, storage/v1, functions/v1/menus-signup, functions/v1/menus-ai)\n  postgres ${DB_URL}\n  anon key ${ANON_KEY}\n  host     ${os.hostname()}`);
  const bye = async () => { await s.stop(); process.exit(0); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}
