// Finds (or fetches once) the two real binaries the stack runs: PostgREST 12.2.3 and GoTrue (Supabase Auth) 2.180.0,
// the same versions as the owner app's stack (apps/studio/test/README.md). Not in git.
//
// Looked for, in order: $SIM_STACK_BIN, sim/.stack/bin, apps/studio/test/.stack/bin (the studio stack's copy).
// Missing: downloaded from the GitHub releases into sim/.stack/bin with curl (it follows HTTPS_PROXY), checked
// against the SHA-256 below, then unpacked. SIM_NO_DOWNLOAD=1 turns the download off.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SIM = path.resolve(HERE, '..');
export const ROOT = path.resolve(SIM, '..');
export const OWN_BIN = path.join(SIM, '.stack/bin');

const RELEASES = {
  postgrest: {
    url: 'https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz',
    sha256: '9f71269e61ac3a940281e93ff415760f5957e430e475ba4c3889f3ede7d5527c',
    tar: ['-xJf'],
    dest: '.',
  },
  gotrue: {
    url: 'https://github.com/supabase/auth/releases/download/v2.180.0/auth-v2.180.0-x86.tar.gz',
    sha256: '3fe064281f5cf7bda94251a3bd9e87a690d081381d9ea93b1491163735209e2e',
    tar: ['-xzf'],
    dest: 'gotrue',
  },
};

const has = (dir) => fs.existsSync(path.join(dir, 'postgrest')) && fs.existsSync(path.join(dir, 'gotrue/auth'))
  && fs.existsSync(path.join(dir, 'gotrue/migrations'));

function fetchOne(name, bin, log) {
  const r = RELEASES[name];
  const tmp = path.join(bin, `.${name}.download`);
  fs.mkdirSync(path.join(bin, r.dest), { recursive: true });
  log(`downloading ${r.url}`);
  const dl = spawnSync('curl', ['-sSfL', '--retry', '3', '-o', tmp, r.url], { stdio: ['ignore', 'ignore', 'pipe'], encoding: 'utf8' });
  if (dl.status !== 0) throw new Error(`download of ${name} failed: ${dl.stderr}`);
  const got = crypto.createHash('sha256').update(fs.readFileSync(tmp)).digest('hex');
  if (got !== r.sha256) {
    fs.rmSync(tmp, { force: true });
    throw new Error(`${name}: SHA-256 ${got} is not the pinned ${r.sha256}; not unpacked`);
  }
  const x = spawnSync('tar', [...r.tar, tmp, '-C', path.join(bin, r.dest)], { encoding: 'utf8' });
  fs.rmSync(tmp, { force: true });
  if (x.status !== 0) throw new Error(`unpacking ${name} failed: ${x.stderr}`);
}

/** The folder that holds `postgrest` and `gotrue/auth` (+ `gotrue/migrations`). */
export function locateBinaries({ log = () => {} } = {}) {
  const candidates = [process.env.SIM_STACK_BIN, OWN_BIN, path.join(ROOT, 'apps/studio/test/.stack/bin')].filter(Boolean);
  for (const dir of candidates) if (has(dir)) return path.resolve(dir);
  if (process.env.SIM_NO_DOWNLOAD === '1') {
    throw new Error(`PostgREST and GoTrue not found in ${candidates.join(', ')} (SIM_NO_DOWNLOAD=1). See sim/README.md.`);
  }
  if (!fs.existsSync(path.join(OWN_BIN, 'postgrest'))) fetchOne('postgrest', OWN_BIN, log);
  if (!fs.existsSync(path.join(OWN_BIN, 'gotrue/auth'))) fetchOne('gotrue', OWN_BIN, log);
  if (!has(OWN_BIN)) throw new Error('binaries incomplete in ' + OWN_BIN);
  return OWN_BIN;
}
