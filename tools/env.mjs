/* Mana's three environments (docs/environments.md): where each one's config.js comes from, what each must say, how to
   read one the way a page does, and the writer of the local one. tools/build-site.sh (through tools/site-env.mjs),
   tools/check-site.mjs, npm run demo, npm run dev:local and the config guard (tools/check-config.mjs) all use it.

   The fields every app reads (window.HALOM_MENUS_CONFIG), besides the addresses and the key:
     env       'production' | 'demo' | 'local'    absent = 'production'
     schema    1 | 2                              absent = 1 (production is v1 until the cutover, ADR-005)
     realtime  boolean                            absent = true (the simulator's stack has no Realtime server) */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The file each environment's config.js is copied from (MANA_ENV in tools/build-site.sh). local is written by npm run dev:local and git-ignored. */
export const CONFIG_FILES = { production: 'config.js', demo: 'config/demo.js', local: 'config/local.js' };
export const ENVS = Object.keys(CONFIG_FILES);

/** halom.io/mana today: the Supabase project `halom-studio`, schema 1, and the short links printed QR codes carry. */
export const PRODUCTION = { supabaseUrl: 'https://zemdhczqlhkabfwxccqq.supabase.co', shortBase: 'https://halom.io/m/' };
/** The build and demo database `mana` (D35), schema 2. */
export const DEMO = { supabaseUrl: 'https://hhmjcudeiiycwqqklksc.supabase.co' };

/** Every config file keeps its key on this line: .gitleaksignore names the publishable keys by line, and its
    `config.js:generic-api-key:4` also covers _site/config.js, whichever environment the build copied there. */
export const KEY_LINE = 4;

export const isPublishableKey = (k) => typeof k === 'string' && /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(k);
export const isJwt = (k) => typeof k === 'string' && /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(k);
/** The `role` claim of a JWT (read, not verified), or null. */
export const jwtRole = (k) => { try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString('utf8')).role ?? null; } catch { return null; } };
export const isLoopback = (u) => { try { return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(u).hostname); } catch { return false; } };
const isHalomIo = (u) => { try { return /(^|\.)halom\.io$/.test(new URL(u).hostname); } catch { return false; } };

export const envOf = (cfg) => cfg.env ?? 'production';
export const schemaOf = (cfg) => cfg.schema ?? 1;
export const realtimeOf = (cfg) => cfg.realtime ?? true;

/** Runs a config.js as a page runs it (a classic script, `location` at `origin`) and returns its HALOM_MENUS_CONFIG. */
export function readConfig(file, { origin = 'http://127.0.0.1:4180' } = {}) {
  const window = {};
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), { window, location: new URL(origin) }, { filename: file, timeout: 1000 });
  const cfg = window.HALOM_MENUS_CONFIG;
  if (!cfg || typeof cfg !== 'object') throw new Error(`${file} does not set window.HALOM_MENUS_CONFIG`);
  return cfg;
}

/** What is wrong with `cfg` as the config of `env` (an empty list: nothing). `origin` is where the page was opened, as readConfig ran it. */
export function configProblems(env, cfg, { origin = 'http://127.0.0.1:4180' } = {}) {
  const out = [];
  if (!ENVS.includes(env)) return [`no environment called "${env}" (there are: ${ENVS.join(', ')})`];
  if (envOf(cfg) !== env) out.push(`env is "${envOf(cfg)}", not "${env}"`);
  if (typeof cfg.supabaseUrl !== 'string' || !/^https?:\/\/[^/]+\/?$/.test(cfg.supabaseUrl)) out.push('supabaseUrl is not an origin');
  if (env === 'local') {
    if (!isJwt(cfg.supabaseKey) || jwtRole(cfg.supabaseKey) !== 'anon') out.push('local\'s supabaseKey is not the stack\'s anon key');
  } else if (isJwt(cfg.supabaseKey)) out.push('supabaseKey is a JWT: a published site carries a publishable key (sb_publishable_…)');
  else if (!isPublishableKey(cfg.supabaseKey)) out.push('supabaseKey is not a publishable key (sb_publishable_…)');
  if (env === 'production') {
    if (cfg.supabaseUrl !== PRODUCTION.supabaseUrl) out.push(`production's supabaseUrl is ${cfg.supabaseUrl}, not halom-studio's ${PRODUCTION.supabaseUrl}`);
    if (schemaOf(cfg) !== 1) out.push(`production's schema is ${schemaOf(cfg)}: halom-studio is v1 until the cutover`);
    if (cfg.shortBase !== PRODUCTION.shortBase) out.push(`production's shortBase is ${cfg.shortBase}, not ${PRODUCTION.shortBase} (printed QR codes carry it)`);
    return out;
  }
  if (schemaOf(cfg) !== 2) out.push(`${env}'s schema is ${schemaOf(cfg)}, not 2`);
  if (cfg.supabaseUrl === PRODUCTION.supabaseUrl) out.push(`${env} points at halom-studio`);
  if (typeof cfg.shortBase !== 'string' || isHalomIo(cfg.shortBase)) out.push(`${env}'s shortBase (${cfg.shortBase}) would make its QR codes open production's short links`);
  else if (cfg.shortBase !== origin + '/m/') out.push(`${env}'s shortBase is ${cfg.shortBase}, not the serving origin's /m/ (${origin}/m/)`);
  if (env === 'demo') {
    if (cfg.supabaseUrl !== DEMO.supabaseUrl) out.push(`demo's supabaseUrl is ${cfg.supabaseUrl}, not mana's ${DEMO.supabaseUrl}`);
    if (realtimeOf(cfg) !== true) out.push('demo has Realtime (the hosted project runs it): realtime should be true');
  } else {
    if (!isLoopback(cfg.supabaseUrl)) out.push(`local's supabaseUrl (${cfg.supabaseUrl}) is not on this machine`);
    if (realtimeOf(cfg) !== false) out.push('local has no Realtime server: realtime must be false');
  }
  return out;
}

/** The text of config/local.js for a running simulator stack (npm run dev:local writes it; git ignores it). The stack's
    anon key is a JWT signed with the simulator's local-only secret (sim/stack/start.mjs); no project's key is ever here. */
export function localConfigText({ apiUrl, anonKey }) {
  if (!isLoopback(apiUrl) || !/^http:\/\/[\w.:[\]-]+$/.test(apiUrl)) throw new Error(`not a local stack address: ${apiUrl}`);
  if (!isJwt(anonKey) || jwtRole(anonKey) !== 'anon') throw new Error('not the stack\'s anon key');
  return [
    '/* Mana on this machine: the simulator\'s stack (schema 2). Written by npm run dev:local; git-ignored, never committed. */',
    'window.HALOM_MENUS_CONFIG = {',
    `  supabaseUrl: '${apiUrl}',`,
    `  supabaseKey: '${anonKey}',`,
    "  env: 'local', schema: 2, realtime: false,",
    "  shortBase: location.origin + '/m/',  // the short links of the server that serves this build (tools/serve-site.mjs)",
    '  shortLive: true,',
    "  viewPath: '../view/', genPath: '../gen/', stockPath: '../stock/', sitePath: '../',",
    '  auth: { providers: [] },',
    '  features: { scan: false }',
    '};',
    '',
  ].join('\n');
}

/** The line of `text` that holds supabaseKey (1-based), or 0. */
export const keyLine = (text) => text.split('\n').findIndex((l) => /^\s*supabaseKey\s*:/.test(l)) + 1;

/** Whether a CSP source (an origin, or a wildcard host such as https://*.supabase.co) allows `origin`. */
function allows(source, origin) {
  if (source === origin) return true;
  const w = /^(https?:)\/\/\*\.([^/:]+)$/.exec(source), o = new URL(origin);
  return !!w && o.protocol === w[1] && o.hostname.endsWith('.' + w[2]);
}

/** A page's Content-Security-Policy says which origins it may connect to. In a demo or local build, `from` (halom-studio)
    becomes `to` (the environment's Supabase origin), and a connect-src that does not allow `to` yet gets it (the back
    office allows https://*.supabase.co, which the local stack is not). The rest of the page is left as it is. */
export function retargetCsp(html, from, to) {
  return html.replace(/(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/gi, (m, a, policy, b) => a + policy.split(';').map((d) => {
    const [lead, body, tail] = /^(\s*)(.*?)(\s*)$/.exec(d).slice(1), parts = body.split(/\s+/);
    if (parts[0] !== 'connect-src') return d;
    const next = parts.map((t) => (t === from ? to : t));
    if (!next.slice(1).some((t) => allows(t, to))) next.push(to);
    return lead + next.join(' ') + tail;
  }).join(';') + b);
}
