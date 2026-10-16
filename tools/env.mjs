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
import { JWT_SECRET, verifyJwt } from '../sim/stack/jwt.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The file each environment's config.js is copied from (MANA_ENV in tools/build-site.sh). local is written by npm run dev:local and git-ignored. */
export const CONFIG_FILES = { production: 'config.js', demo: 'config/demo.js', local: 'config/local.js' };
export const ENVS = Object.keys(CONFIG_FILES);

/** halom.io/mana today: the Supabase project `halom-studio`, schema 1, and the short links printed QR codes carry.
    siteBase is the address production's config gains at the cutover (it has no siteBase yet). */
export const PRODUCTION = { supabaseUrl: 'https://zemdhczqlhkabfwxccqq.supabase.co', shortBase: 'https://halom.io/m/', siteBase: 'https://halom.io/mana/' };
/** The build and demo database `mana` (D35), schema 2. */
export const DEMO = { supabaseUrl: 'https://hhmjcudeiiycwqqklksc.supabase.co' };

/** A Supabase publishable key's exact shape: sb_publishable_, 22 characters, "_", 8 characters (base64url), as in .gitleaks.toml. */
export const isPublishableKey = (k) => typeof k === 'string' && /^sb_publishable_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$/.test(k);
export const isJwt = (k) => typeof k === 'string' && /^eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/.test(k);
/** The `role` claim of a JWT (read, not verified), or null. */
export const jwtRole = (k) => { try { return JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString('utf8')).role ?? null; } catch { return null; } };
/** Whether `k` is the simulator's anon key: exactly the running stack's (`stackKey`, when given), or else a JWT that
    verifies with the simulator's local-only secret (sim/stack/jwt.mjs) and has the role anon. Nothing else is. */
export const isLocalAnonKey = (k, stackKey = null) => isJwt(k) && jwtRole(k) === 'anon' && (stackKey ? k === stackKey : verifyJwt(k, JWT_SECRET)?.role === 'anon');
export const isLoopback = (u) => { try { return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(u).hostname); } catch { return false; } };
const isHalomIo = (u) => { try { return /(^|\.)halom\.io$/.test(new URL(u).hostname); } catch { return false; } };
const isWhatsApp = (u) => typeof u === 'string' && /^https:\/\/wa\.me\/\d{8,15}$/.test(u);

export const envOf = (cfg) => cfg.env ?? 'production';
export const schemaOf = (cfg) => cfg.schema ?? 1;
export const realtimeOf = (cfg) => cfg.realtime ?? true;

/** Runs a config.js as a page runs it (a classic script, `location` at `origin`) and returns its HALOM_MENUS_CONFIG. */
export const readConfig = (file, opts) => readConfigText(fs.readFileSync(file, 'utf8'), { ...opts, filename: file });

/** The same, for a config.js's text (serve-site reads the bytes it is about to send). */
export function readConfigText(text, { origin = 'http://127.0.0.1:4180', filename = 'config.js' } = {}) {
  const window = {};
  vm.runInNewContext(text, { window, location: new URL(origin) }, { filename, timeout: 1000 });
  const cfg = window.HALOM_MENUS_CONFIG;
  if (!cfg || typeof cfg !== 'object') throw new Error(`${filename} does not set window.HALOM_MENUS_CONFIG`);
  return structuredClone(cfg);      // plain data of this realm (the script ran in its own)
}

/** What is wrong with `cfg` as the config of `env` (an empty list: nothing). `origin` is where the page was opened, as
    readConfig ran it. `stack` ({ apiUrl, anonKey }): for local, the running stack the config must be for. */
export function configProblems(env, cfg, { origin = 'http://127.0.0.1:4180', stack = null } = {}) {
  const out = [];
  if (!ENVS.includes(env)) return [`no environment called "${env}" (there are: ${ENVS.join(', ')})`];
  if (envOf(cfg) !== env) out.push(`env is "${envOf(cfg)}", not "${env}"`);
  if (typeof cfg.supabaseUrl !== 'string' || !/^https?:\/\/[^/]+\/?$/.test(cfg.supabaseUrl)) out.push('supabaseUrl is not an origin');
  if (env === 'local') {
    if (!isLocalAnonKey(cfg.supabaseKey, stack?.anonKey)) out.push(`local's supabaseKey is not ${stack ? 'the running' : 'the simulator\'s'} stack's anon key`);
    if (stack && cfg.supabaseUrl !== stack.apiUrl) out.push(`local's supabaseUrl is ${cfg.supabaseUrl}, not the running stack's ${stack.apiUrl}`);
  } else if (isJwt(cfg.supabaseKey)) out.push('supabaseKey is a JWT: a published site carries a publishable key (sb_publishable_…)');
  else if (!isPublishableKey(cfg.supabaseKey)) out.push('supabaseKey is not a publishable key (sb_publishable_…)');
  if (cfg.support !== undefined && !isWhatsApp(cfg.support?.whatsapp)) out.push(`support.whatsapp (${cfg.support?.whatsapp}) is not a https://wa.me/<number> link`);
  if (env === 'production') {
    if (cfg.supabaseUrl !== PRODUCTION.supabaseUrl) out.push(`production's supabaseUrl is ${cfg.supabaseUrl}, not halom-studio's ${PRODUCTION.supabaseUrl}`);
    if (schemaOf(cfg) !== 1) out.push(`production's schema is ${schemaOf(cfg)}: halom-studio is v1 until the cutover`);
    if (cfg.shortBase !== PRODUCTION.shortBase) out.push(`production's shortBase is ${cfg.shortBase}, not ${PRODUCTION.shortBase} (printed QR codes carry it)`);
    if (cfg.siteBase !== undefined && cfg.siteBase !== PRODUCTION.siteBase) out.push(`production's siteBase is ${cfg.siteBase}, not ${PRODUCTION.siteBase}`);
    return out;
  }
  if (schemaOf(cfg) !== 2) out.push(`${env}'s schema is ${schemaOf(cfg)}, not 2`);
  if (cfg.supabaseUrl === PRODUCTION.supabaseUrl) out.push(`${env} points at halom-studio`);
  if (typeof cfg.shortBase !== 'string' || isHalomIo(cfg.shortBase)) out.push(`${env}'s shortBase (${cfg.shortBase}) would make its QR codes open production's short links`);
  else if (cfg.shortBase !== origin + '/m/') out.push(`${env}'s shortBase is ${cfg.shortBase}, not the serving origin's /m/ (${origin}/m/)`);
  if (typeof cfg.siteBase !== 'string' || isHalomIo(cfg.siteBase)) out.push(`${env}'s siteBase (${cfg.siteBase}) would send people to production`);
  else if (cfg.siteBase !== origin + '/mana/') out.push(`${env}'s siteBase is ${cfg.siteBase}, not the serving origin's /mana/ (${origin}/mana/)`);
  if (cfg.support === undefined) out.push(`${env} has no support.whatsapp`);
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
    anon key is a JWT signed with the simulator's local-only secret (sim/stack/jwt.mjs); no project's key is ever here.
    The support number is the demo's (config/demo.js), so it is written in one place. */
export function localConfigText({ apiUrl, anonKey, support = readConfig(path.join(ROOT, CONFIG_FILES.demo)).support }) {
  if (!isLoopback(apiUrl) || !/^http:\/\/[\w.:[\]-]+$/.test(apiUrl)) throw new Error(`not a local stack address: ${apiUrl}`);
  if (!isLocalAnonKey(anonKey)) throw new Error('not the stack\'s anon key');
  if (!isWhatsApp(support?.whatsapp)) throw new Error('support.whatsapp is not a https://wa.me/<number> link');
  return [
    '/* Mana on this machine: the simulator\'s stack (schema 2). Written by npm run dev:local; git-ignored, never committed. */',
    'window.HALOM_MENUS_CONFIG = {',
    `  supabaseUrl: '${apiUrl}',`,
    `  supabaseKey: '${anonKey}',`,
    "  env: 'local', schema: 2, realtime: false,",
    "  shortBase: location.origin + '/m/',  // the short links of the server that serves this build (tools/serve-site.mjs)",
    '  shortLive: true,',
    "  siteBase: location.origin + '/mana/',",
    `  support: { whatsapp: '${support.whatsapp}' },`,
    "  viewPath: '../view/', genPath: '../gen/', stockPath: '../stock/', sitePath: '../',",
    '  auth: { providers: [] },',
    '  features: { scan: false }',
    '};',
    '',
  ].join('\n');
}

/** The line of `text` that holds supabaseKey (1-based), or 0. */
export const keyLine = (text) => text.split('\n').findIndex((l) => /^\s*supabaseKey\s*:/.test(l)) + 1;

/** Whether a CSP source (an origin, or a wildcard host such as https://*.supabase.co) allows `origin`. Both case-blind. */
const SUPABASE_WILDCARD = /^https:\/\/\*\.supabase\.co$/i;
/** The WebSocket origin beside an http(s) origin (Realtime): https → wss, http → ws. */
export const socketOf = (origin) => origin.replace(/^http(s?):/i, 'ws$1:');

/** A page's Content-Security-Policy says which origins it may reach. In a demo or local build only two kinds of directive
    change. One that names `from` (halom-studio) names `to` (the environment's Supabase origin) instead. A connect-src or
    default-src that allows any Supabase project (https://*.supabase.co: the back office) allows exactly `to` instead,
    over http(s) and over ws(s) for Realtime; the wildcard is gone. Every other directive, a 'none' or 'self'-only one
    included, is left exactly as it is; directive names and sources are compared case-blind. */
export function retargetCsp(html, from, to) {
  const same = (s) => s.toLowerCase() === from.toLowerCase();
  return html.replace(/(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/gi, (m, a, policy, b) => a + policy.split(';').map((d) => {
    const [lead, body, tail] = /^(\s*)(.*?)(\s*)$/s.exec(d).slice(1), [name = '', ...sources] = body.split(/\s+/);
    const named = sources.some(same), wild = /^(connect|default)-src$/i.test(name) && sources.some((s) => SUPABASE_WILDCARD.test(s));
    if (!named && !wild) return d;
    const next = sources.flatMap((s) => (same(s) ? [to] : wild && SUPABASE_WILDCARD.test(s) ? [to, socketOf(to)] : [s]));
    return lead + [name, ...new Set(next)].join(' ') + tail;
  }).join(';') + b);
}
