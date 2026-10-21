#!/usr/bin/env node
/* The environment a built site is for (tools/build-site.sh runs it once _site/ is assembled):
     node tools/site-env.mjs <_site> <production|demo|local>
   1. _site/config.js must be that environment's config (tools/env.mjs configProblems): production stays halom-studio,
      schema 1, its own short links; demo is `mana`, schema 2; local is this machine, schema 2, no Realtime.
   2. demo and local only: the pages whose Content-Security-Policy names halom-studio's origin (the product page, the
      photo guide, privacy, terms: brand/tools/build-site.mjs writes it from the root config.js) name this environment's
      Supabase origin instead, so their lead form can reach it; the back office's connect-src, which allows any
      Supabase project (https://*.supabase.co), allows exactly this environment's origin instead, over https and wss
      (local: http and ws) for Realtime. No other directive changes (tools/env.mjs retargetCsp). Production's files,
      the back office's included, are not touched until the cutover.
   3. demo and local only: no page's Content-Security-Policy may allow a Supabase host but the environment's own (no
      wildcard, no other project), and nothing in _site may name halom-studio any more. A build for a demo never talks
      to production.
   Exit 1 on a problem. */
import fs from 'node:fs';
import path from 'node:path';
import { configProblems, envOf, PRODUCTION, readConfig, realtimeOf, retargetCsp, schemaOf } from './env.mjs';

const [siteArg, env] = process.argv.slice(2);
const site = path.resolve(siteArg || '_site');
const fail = (msg) => { console.error('✗ ' + msg); process.exit(1); };
const file = path.join(site, 'config.js');
if (!fs.existsSync(file)) fail(`no ${file}`);

const cfg = readConfig(file);
const problems = configProblems(env, cfg);
if (problems.length) fail(`_site/config.js is not ${env}'s config:\n  ${problems.join('\n  ')}`);

const say = `${envOf(cfg)} (schema ${schemaOf(cfg)}, realtime ${realtimeOf(cfg) ? 'on' : 'off'}): ${cfg.supabaseUrl}`;
if (env === 'production') { console.log('✓ environment ' + say); process.exit(0); }

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(site);
const to = new URL(cfg.supabaseUrl).origin, from = new URL(PRODUCTION.supabaseUrl).origin;
let pages = 0;
const strays = [], own = new URL(to).hostname.toLowerCase();
for (const f of files.filter((f) => /\.html?$/i.test(f))) {
  const html = fs.readFileSync(f, 'utf8'), next = retargetCsp(html, from, to);
  if (next !== html) { fs.writeFileSync(f, next); pages++; }
  /* after the rewrite, a policy may name no Supabase host but this environment's (no wildcard, no other project) */
  for (const m of next.matchAll(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/gi))
    for (const h of m[1].match(/[a-z0-9*.-]*\.supabase\.(co|in)\b/gi) ?? []) if (h.toLowerCase() !== own) strays.push(`${path.relative(site, f)} (${h})`);
}
if (strays.length) fail(`a ${env} build's Content-Security-Policy still allows another Supabase host: ${strays.join(', ')}`);
const host = new URL(PRODUCTION.supabaseUrl).hostname, left = [];
for (const f of files.filter((f) => /\.(html?|css|m?js|json|svg|txt|md|xml|webmanifest)$/i.test(f))) if (fs.readFileSync(f, 'utf8').includes(host)) left.push(path.relative(site, f));
if (left.length) fail(`a ${env} build still names halom-studio (${host}) in: ${left.join(', ')}`);
console.log(`✓ environment ${say}; ${pages} page${pages === 1 ? '' : 's'}' Content-Security-Policy retargeted; nothing names halom-studio`);
