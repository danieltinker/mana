#!/usr/bin/env node
/* What the built site may not contain and whom it may not talk to (plan §7, §11, §17): static, no browser, no network.
   Run:  node tools/check-site.mjs [_site]        (tools/build-site.sh runs it after the site is assembled)
   Exit 1 on a breach.

   (a) Names: none of the venue names in templates/sources.md (one name per line, in a fenced block or a table; the file
       may be absent) and no "inspiredBy" appear in any text file of _site. The looks are ours; the venues that inspired
       them stay in the repository's notes.
   (b) Loads: in HTML and CSS only (src=, srcset=, poster=, <link> href of stylesheets, preloads and icons, <iframe src>,
       @import and url()), a resource comes only from the site itself (relative, /mana/, /m/, https://halom.io/mana/) or
       the Supabase origin named in config.js. Ordinary <a href> links may also go to an allow-list: wa.me, halom.io,
       instagram.com, tiktok.com, x.com, facebook.com, github.com/danieltinker, mailto:, tel:. Scripts are covered at run
       time by brand/tools/test-site.mjs (the page asks only its own host and Supabase).
   (c) Secrets: no sb_secret_, service_role, -----BEGIN (a private key) or .env content (a file named .env*, or a line
       that assigns a SUPABASE_/HALOM_/…_SECRET/…_KEY variable) anywhere in _site. Every JWT is decoded: the only one a
       site may hold is the simulator's anon key (verified with its local-only secret), on config.js's key line of a
       local build (config.js says env 'local' and points at this machine); any other JWT anywhere is a breach.
   (d) gitleaks: when `gitleaks` is on PATH (or $GITLEAKS names it), `gitleaks dir _site` runs with the repository's
       .gitleaks.toml and .gitleaksignore (plus that one line of a local build); absent (as in CI) it is skipped and
       said so. */
import { readFileSync, existsSync, statSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname, join, relative, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { envOf, isLocalAnonKey, isLoopback, jwtRole, keyLine, readConfig } from './env.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = resolve(process.argv[2] || '_site');
if (!existsSync(SITE)) { console.error('✗ no built site at ' + SITE + ' (run tools/build-site.sh first)'); process.exit(2); }
const TEXT = /\.(html?|css|m?js|json|svg|txt|md|xml|webmanifest|py)$/i;
const LINK_HOSTS = ['wa.me', 'halom.io', 'instagram.com', 'tiktok.com', 'x.com', 'facebook.com'], LINK_PATHS = ['github.com/danieltinker'];

const breaches = [], notes = [], rel = (p) => relative(SITE, p);
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const files = walk(SITE), text = files.filter((f) => TEXT.test(f));
const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? (m[2] ?? m[3] ?? m[4]) : null; };
const tags = (html, name) => [...html.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'gi'))].map((m) => m[0]);
const lineOf = (s, i) => s.slice(0, i).split('\n').length;
const blank = (c) => c.replace(/[^\n]/g, ' ');   // keeps line numbers

/* the Supabase origin, from the site's own config.js */
let supabase = null;
{ const c = join(SITE, 'config.js'); if (existsSync(c)) { const m = readFileSync(c).toString().match(/supabaseUrl\s*:\s*['"]([^'"]+)['"]/); if (m) try { supabase = new URL(m[1]).origin; } catch (e) { breaches.push('config.js: supabaseUrl is not a URL'); } }
  if (!supabase) notes.push('(b) no Supabase origin found in config.js; only the site itself is allowed'); }

/* (a) names */
{
  const src = join(ROOT, 'templates/sources.md'), names = [];
  if (!existsSync(src)) notes.push('(a) templates/sources.md is not there yet: only "inspiredBy" is checked');
  else {
    const md = readFileSync(src).toString(); let fenced = false, col = null;
    for (let line of md.split('\n')) {
      if (/^\s*```/.test(line)) { fenced = !fenced; continue; }
      line = line.trim(); if (!line) continue;
      if (fenced) names.push(line.replace(/^[-*+]\s+|^\d+[.)]\s+/, ''));
      else if (/^\|/.test(line)) {
        const cells = line.split('|').slice(1, -1).map((c) => c.trim());
        if (cells.every((c) => /^:?-+:?$/.test(c))) continue;                                   // the rule under the header
        if (col === null) { col = Math.max(0, cells.findIndex((c) => /venue|source|inspired|place|מקום|מקור|השראה/i.test(c))); if (cells.some((c) => /venue|source|inspired|place|name|look|שם|מקום|מקור|השראה/i.test(c))) continue; }   // the header names the column
        if (cells[col]) names.push(cells[col]);
      }
    }
  }
  /* our own looks (templates/templates.v1.json) are never "sources" */
  const ours = new Set(); const tv = join(ROOT, 'templates/templates.v1.json');
  if (existsSync(tv)) try { for (const l of JSON.parse(readFileSync(tv).toString()).looks || []) { ours.add(String(l.id || '').toLowerCase()); for (const v of Object.values(l.name || {})) ours.add(String(v).toLowerCase()); } } catch (e) { notes.push('(a) templates/templates.v1.json did not parse: ' + e.message); }
  const clean = [...new Set(names.map((n) => n.replace(/[*_`]/g, '').replace(/\s*\(.*\)$/, '').trim()).filter((n) => n.length >= 3 && !ours.has(n.toLowerCase())))];
  const find = (needle) => { const re = new RegExp((/^[\w .'-]+$/.test(needle) ? '\\b' : '') + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (/^[\w .'-]+$/.test(needle) ? '\\b' : ''), 'i'); const hits = []; for (const f of text) { const s = readFileSync(f).toString(), m = s.match(re); if (m) hits.push(rel(f) + ':' + lineOf(s, m.index)); } return hits; };
  for (const n of clean) { const h = find(n); if (h.length) breaches.push('(a) a source venue\'s name, "' + n + '", is in ' + h.slice(0, 5).join(', ') + (h.length > 5 ? ' …' : '')); }
  const h = find('inspiredBy'); if (h.length) breaches.push('(a) "inspiredBy" is in ' + h.slice(0, 5).join(', ') + (h.length > 5 ? ' …' : ''));
  notes.push('(a) ' + clean.length + ' venue name' + (clean.length === 1 ? '' : 's') + ' from templates/sources.md checked in ' + text.length + ' text files' + (clean.length ? ': ' + clean.join(', ') : ''));
}

/* (b) loads and links */
const isSite = (u) => !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(u) || /^https:\/\/halom\.io\/(mana|m)(\/|$)/i.test(u) || /^(data|blob|about):/i.test(u);
const isSupabase = (u) => supabase && (u.toLowerCase() === supabase.toLowerCase() || u.toLowerCase().startsWith(supabase.toLowerCase() + '/'));
const linkOk = (u) => { if (/^(mailto|tel):/i.test(u)) return true; let h; try { h = new URL(u); } catch (e) { return false; } const host = h.hostname.replace(/^www\./, '');
  return LINK_HOSTS.some((d) => host === d) || LINK_PATHS.some((p) => (host + h.pathname).startsWith(p)); };
let loads = 0, links = 0;
const load = (f, u, what, at) => { if (u == null) return; u = u.trim(); if (!u) return; loads++; if (isSite(u) || isSupabase(u)) return; breaches.push('(b) ' + rel(f) + ':' + at + ' loads ' + what + ' from outside the site: ' + u.slice(0, 120)); };
const link = (f, u, at) => { if (u == null) return; u = u.trim(); if (!u) return; links++; if (isSite(u) || linkOk(u)) return; breaches.push('(b) ' + rel(f) + ':' + at + ' links to a host not on the allow-list: ' + u.slice(0, 120)); };
const srcset = (v) => (v || '').split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
for (const f of text.filter((f) => /\.html?$/i.test(f))) {
  const s = readFileSync(f).toString(), body = s.replace(/<!--[\s\S]*?-->/g, blank).replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, b, c) => a + blank(b) + c);
  for (const m of body.matchAll(/<(script|img|iframe|source|video|audio|embed|track|frame)\b[^>]*>/gi)) { const t = m[0], at = lineOf(body, m.index);
    load(f, attr(t, 'src'), '<' + m[1].toLowerCase() + ' src>', at); load(f, attr(t, 'poster'), 'a poster', at); for (const u of srcset(attr(t, 'srcset'))) load(f, u, 'a srcset', at); }
  for (const m of body.matchAll(/<object\b[^>]*>/gi)) load(f, attr(m[0], 'data'), '<object data>', lineOf(body, m.index));
  for (const m of body.matchAll(/<link\b[^>]*>/gi)) { const r = (attr(m[0], 'rel') || '').toLowerCase(); if (/stylesheet|preload|modulepreload|prefetch|preconnect|dns-prefetch|icon|manifest/.test(r)) load(f, attr(m[0], 'href'), '<link rel="' + r + '">', lineOf(body, m.index)); }
  for (const m of body.matchAll(/<(a|area)\b[^>]*>/gi)) link(f, attr(m[0], 'href'), lineOf(body, m.index));
  for (const m of body.matchAll(/<form\b[^>]*>/gi)) load(f, attr(m[0], 'action'), '<form action>', lineOf(body, m.index));
  for (const m of body.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) css(f, m[1], lineOf(body, m.index));
  for (const m of body.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)) css(f, m[1], lineOf(body, m.index));
}
for (const f of text.filter((f) => /\.css$/i.test(f))) css(f, readFileSync(f).toString(), 1);
function css(f, s, base) {
  for (const m of s.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g)) load(f, m[1] ?? m[2] ?? m[3], 'url()', base - 1 + lineOf(s, m.index));
  for (const m of s.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/g)) load(f, m[1], '@import', base - 1 + lineOf(s, m.index));
}
notes.push('(b) ' + loads + ' loads and ' + links + ' links read in HTML and CSS' + (supabase ? '; Supabase origin ' + supabase : ''));

/* (c) secrets */
/* a local build (npm run dev:local) carries the simulator's anon key, a JWT signed with its local-only secret, on
   config.js's key line: allowed there only, and only while config.js says local, points at this machine and holds that key */
const localKeyLine = (() => {
  const f = join(SITE, 'config.js'); if (!existsSync(f)) return 0;
  let cfg; try { cfg = readConfig(f); } catch (e) { return 0; }
  return envOf(cfg) === 'local' && isLoopback(cfg.supabaseUrl) && isLocalAnonKey(cfg.supabaseKey) ? keyLine(readFileSync(f, 'utf8')) : 0;
})();
for (const f of files) if (/^\.env($|\.)/.test(basename(f))) breaches.push('(c) a .env file is in the site: ' + rel(f));
for (const f of text) {
  const s = readFileSync(f).toString();
  for (const [re, what] of [[/sb_secret_[A-Za-z0-9_-]+/, 'a Supabase secret key'], [/service_role/, 'service_role'], [/-----BEGIN [A-Z ]*(PRIVATE|RSA|EC|OPENSSH|PGP)[A-Z ]*-----/, 'a private key block'], [/^\s*(export\s+)?(SUPABASE|HALOM|MENUS|MANA|GROW|PAYPLUS|OPENAI|GEMINI|ANTHROPIC|AWS|GCP|GOOGLE)_[A-Z0-9_]*(SECRET|KEY|TOKEN|PASSWORD)[A-Z0-9_]*\s*=\s*\S+/m, '.env-style secret assignment']]) {
    const m = s.match(re); if (m) breaches.push('(c) ' + what + ' in ' + rel(f) + ':' + lineOf(s, m.index));
  }
  /* every JWT: the only one a site may hold is the simulator's anon key (a local build), verified with its local secret */
  for (const m of s.matchAll(/eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g)) {
    const role = jwtRole(m[0]), at = lineOf(s, m.index), where = `${rel(f)}:${at}`;
    if (role !== 'anon') breaches.push(`(c) a JWT with the role ${role ?? '(none)'} in ${where}`);
    else if (!isLocalAnonKey(m[0])) breaches.push(`(c) an anon JWT that is not the simulator's local key in ${where}`);
    else if (!(rel(f) === 'config.js' && at === localKeyLine)) breaches.push(`(c) the simulator's local key outside config.js's key line of a local build, in ${where}`);
  }
}

/* (d) gitleaks */
{
  const which = process.env.GITLEAKS || (spawnSync('which', ['gitleaks']).stdout || '').toString().trim();
  if (!which || !existsSync(which)) notes.push('(d) gitleaks is not on PATH: skipped (run it locally before a hand-off)');
  else {
    /* the repository's .gitleaks.toml (the default rules; publishable keys allowed by their value); run from inside _site
       on ".", so a finding's fingerprint is "config.js:<rule>:<line>", the form an ignore file names */
    const ignore = join(ROOT, '.gitleaksignore'), toml = join(ROOT, '.gitleaks.toml'), args = ['dir', '.', '--no-banner', '--exit-code', '1', '--redact', '-v'];
    if (existsSync(toml)) args.push('--config', toml);
    let ignoreDir = existsSync(ignore) ? ROOT : null;
    if (localKeyLine) {                                    // the simulator's key on config.js's key line of a local build, as (c)
      ignoreDir = mkdtempSync(join(tmpdir(), 'mana-gitleaks-'));
      writeFileSync(join(ignoreDir, '.gitleaksignore'), (existsSync(ignore) ? readFileSync(ignore, 'utf8') : '') + `\nconfig.js:jwt:${localKeyLine}\n`);
      notes.push('(d) a local build: the simulator\'s local key on config.js\'s key line is allowed');
    }
    if (ignoreDir) args.push('--gitleaks-ignore-path', ignoreDir);
    const r = spawnSync(which, args, { encoding: 'utf8', cwd: SITE });
    if (ignoreDir && ignoreDir !== ROOT) rmSync(ignoreDir, { recursive: true, force: true });
    const out = (r.stdout || '') + (r.stderr || '');
    if (r.status === 0) notes.push('(d) gitleaks dir: no leaks (' + (out.match(/scanned[^\n]*/) || [''])[0].trim() + ')');
    else if (r.status === 1) { breaches.push('(d) gitleaks found leaks in _site:'); out.split('\n').filter((l) => /Finding|File:|Line:|RuleID|Fingerprint/.test(l)).forEach((l) => breaches.push('    ' + l.trim())); }
    else breaches.push('(d) gitleaks failed to run (exit ' + r.status + '): ' + out.trim().split('\n').slice(-3).join(' | '));
  }
}

for (const n of notes) console.log('· ' + n);
if (breaches.length) { console.log('\n✗ site: ' + breaches.length + ' breach' + (breaches.length === 1 ? '' : 'es')); breaches.forEach((b) => console.log('  ✗ ' + b)); process.exit(1); }
console.log('✓ site: no outside loads, links on the allow-list, no source names, no secrets');
