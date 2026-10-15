// A throwaway PostgreSQL 16 cluster for the schema tests: initdb in a temp dir, a free port, the auth stub, every
// migration in order. Nothing here touches a remote database. When run as root, PostgreSQL runs as an ordinary OS user
// (STACK_OS_USER, default "claude"), as apps/studio/test/stack/start.mjs does.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SUPABASE = path.resolve(HERE, '../..');
export const MIGRATIONS = path.join(SUPABASE, 'migrations');
const PGBIN = process.env.PGBIN || '/usr/lib/postgresql/16/bin';
const OSUSER = process.env.STACK_OS_USER || 'claude';
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
const asPg = (cmd, args) => (isRoot ? ['runuser', ['-u', OSUSER, '--', cmd, ...args]] : [cmd, args]);

function run(cmd, args) {
  const [c, a] = asPg(cmd, args);
  const r = spawnSync(c, a, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

export function migrationFiles() {
  return fs.readdirSync(MIGRATIONS).filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort();
}

/** Starts a cluster with the stub and every migration applied. Returns { url, admin (pg.Client), stop() }. */
export async function startCluster({ migrations = true, seed = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mana-schema-'));
  if (isRoot) spawnSync('chown', ['-R', OSUSER, dir]);
  const data = path.join(dir, 'data');
  run(path.join(PGBIN, 'initdb'), ['-D', data, '-U', 'postgres', '-A', 'trust', '-E', 'UTF8', '--locale=C.UTF-8']);
  const port = await freePort();
  const [c, a] = asPg(path.join(PGBIN, 'postgres'), ['-D', data, '-p', String(port), '-k', dir, '-c', 'listen_addresses=127.0.0.1',
    '-c', 'fsync=off', '-c', 'synchronous_commit=off', '-c', 'full_page_writes=off', '-c', 'max_connections=40', '-c', 'TimeZone=UTC',
    '-c', 'statement_timeout=20s', '-c', 'lock_timeout=10s']);
  const proc = spawn(c, a, { stdio: ['ignore', 'ignore', 'pipe'] });
  let log = '';
  proc.stderr.on('data', (d) => { log = (log + d).slice(-8000); });
  const url = `postgres://postgres@127.0.0.1:${port}/postgres`;
  let admin;
  for (let i = 0; ; i++) {
    try {
      admin = new pg.Client({ connectionString: url });
      await admin.connect();
      break;
    } catch (e) {
      if (i > 150) throw new Error('postgres did not start:\n' + log);
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  const exited = new Promise((r) => proc.once('exit', r));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms).unref());
  const stop = async () => {
    await Promise.race([admin.end().catch(() => {}), sleep(2000)]);
    const [sc, sa] = asPg(path.join(PGBIN, 'pg_ctl'), ['-D', data, '-m', 'fast', '-w', '-t', '20', 'stop']);
    spawnSync(sc, sa, { stdio: 'ignore' });
    await Promise.race([exited, sleep(3000)]);
    if (proc.exitCode === null && proc.signalCode === null) proc.kill('SIGKILL');
    proc.stderr.destroy();
    proc.unref();
    fs.rmSync(dir, { recursive: true, force: true });
  };
  try {
    await admin.query(fs.readFileSync(path.join(HERE, 'auth-stub.sql'), 'utf8'));
    if (migrations) for (const f of migrationFiles()) {
      try {
        await admin.query(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'));
      } catch (e) {
        throw new Error(`migration ${f} failed: ${e.message}${e.where ? '\n' + e.where : ''}${e.position ? ' @' + e.position : ''}`);
      }
    }
    await admin.query(`update public.app_config set value = '"https://example.invalid/storage/v1/object/public/menu-public/"' where key = 'public_base'`);
    if (seed) await admin.query(fs.readFileSync(path.join(SUPABASE, 'seed/synthetic.sql'), 'utf8'));
  } catch (e) {
    await stop();
    throw e;
  }
  return { url, admin, stop };
}

/**
 * Runs SQL the way PostgREST does: in a transaction, as the role, with the JWT claims set. `uid` null = anonymous.
 * Every statement in `fn` sees the same session; the transaction commits unless `fn` throws (then it rolls back).
 */
export async function as(url, who, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  // who: 'anon' | 'service' | a user id | { sub, aal } (aal: 'aal1' by default, 'aal2' after MFA)
  const role = who === 'anon' ? 'anon' : who === 'service' ? 'service_role' : 'authenticated';
  const claims = who === 'anon' ? { role: 'anon' } : who === 'service' ? { role: 'service_role' }
    : typeof who === 'object' ? { sub: who.sub, role: 'authenticated', aal: who.aal ?? 'aal1' } : { sub: who, role: 'authenticated', aal: 'aal1' };
  try {
    await client.query('begin');
    await client.query(`select set_config('request.jwt.claims', $1, true), set_config('role', $2, true)`, [JSON.stringify(claims), role]);
    const out = await fn(client);
    await client.query('commit');
    return out;
  } catch (e) {
    try { await client.query('rollback'); } catch { /* closed */ }
    throw e;
  } finally {
    await client.end();
  }
}

/** One statement as someone; returns rows, or { error: { code, message } } instead of throwing. */
export async function q(url, who, text, params = []) {
  try {
    return await as(url, who, async (c) => (await c.query(text, params)).rows);
  } catch (e) {
    return { error: { code: e.code, message: e.message } };
  }
}

/** Calls an RPC as someone and returns its single value (json or scalar), or { error }. */
export async function rpc(url, who, fn, args = {}) {
  const names = Object.keys(args);
  const text = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as v`;
  const vals = names.map((n) => (args[n] !== null && typeof args[n] === 'object' ? JSON.stringify(args[n]) : args[n]));
  const r = await q(url, who, text, vals);
  return r.error ? r : r[0].v;
}
