#!/usr/bin/env node
/* Performance budgets, measured on the built site (plan §9, §18): static, no browser, no network, so CI can run it.
   Run:  node tools/check-budgets.mjs [_site]        (tools/build-site.sh runs it after the site is assembled)
   Exit 1 on a breach. Prints a table of every file counted.

   What is counted ("sent" = what a static host sends: text gzipped at level 9, pictures and fonts as they are, the same
   convention as view/test/load.mjs, which measures the same set in a browser and is a local tool):
   (a) The guest menu's first-dish set, ≤ 800 kB: view/index.html, app.js (and the chunks it imports statically), app.css,
       the stage chunk (imported on demand, needed before the first dish is drawn), the default table's two textures
       (oak, oak_h), the fonts app.css declares (both scripts load for a Hebrew page with Latin prices), Olea's menu.json
       and the first dish's three pictures (colour, matte, thumb).
   (b) The product page's scripts before the hero, ≤ 60 kB: every <script> in _site/index.html (inline, and the files it
       names: config.js, mana.js).
   (c) The seat map page, when present (view/seat/index.html, the scripts it names, their own chunks; chunks the guest menu's
       app.js also imports, such as three.js, are shared and left out), ≤ 150 kB.
   (d) Media: on the product page a <video> that has a source must have preload="none" and no autoplay (a <video> without
       a src or <source> loads nothing, whatever its preload says: mana.js adds the address after first paint); and no file
       over 3 MB is loaded by any HTML at first paint (its scripts, stylesheets, preloads, icons, images, posters, iframes,
       the url() of its stylesheets; a video's sources only when it would fetch them, i.e. preload≠none or autoplay). */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative, extname, basename } from 'node:path';
import { gzipSync } from 'node:zlib';

const SITE = resolve(process.argv[2] || '_site');
const KB = 1024, BUDGET = { first: 800 * KB, page: 60 * KB, seat: 150 * KB, seat3d: 2.5 * KB * KB, file: 3 * KB * KB };
const TEXT = /\.(html?|css|m?js|json|svg|txt|md|xml|webmanifest)$/i;
if (!existsSync(SITE)) { console.error('✗ no built site at ' + SITE + ' (run tools/build-site.sh first)'); process.exit(2); }

const breaches = [], notes = [];
const kb = (n) => (n / KB).toFixed(1);
const rel = (p) => relative(SITE, p) || '.';
const read = (p) => readFileSync(p);
const sent = (p) => { const b = read(p); return TEXT.test(p) ? gzipSync(b, { level: 9 }).length : b.length; };
const row = (p, why) => ({ file: rel(p), why, raw: statSync(p).size, sent: sent(p) });
const need = (p, why) => { if (!p) { notes.push('not a file of the site (' + why + ')'); return null; } if (!existsSync(p)) { breaches.push('missing: ' + rel(p) + ' (' + why + ')'); return null; } return row(p, why); };
const attr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i')); return m ? (m[2] ?? m[3] ?? m[4]) : null; };
const has = (tag, name) => new RegExp('\\s' + name + '(\\s|=|>|/)', 'i').test(tag + '>');
const tags = (html, name) => [...html.matchAll(new RegExp('<' + name + '\\b[^>]*>', 'gi'))].map((m) => ({ tag: m[0], at: m.index }));

/** Resolves a URL found in a file at `from` to a path under _site, or null when it is not a file of the site. */
function local(url, from) {
  if (!url) return null;
  url = url.trim().replace(/[?#].*$/, '');
  if (!url || /^(data|blob|about|javascript|mailto|tel):/i.test(url)) return null;
  if (/^https?:\/\//i.test(url)) { const m = url.match(/^https:\/\/halom\.io\/mana\/(.*)$/i); if (!m) return null; url = '/mana/' + m[1]; }
  if (/^\/\//.test(url)) return null;
  if (/^\/mana\//i.test(url)) return join(SITE, url.slice(6));
  if (/^\/m\//i.test(url)) return null;                                    // /m/<slug> is the guest menu by another name
  if (url.startsWith('/')) return join(SITE, url);
  return resolve(dirname(from), url);
}
const srcset = (v) => (v || '').split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);

/** Every file an HTML page fetches at first paint, with the reason, each file once. */
function firstPaint(htmlPath) {
  const html = read(htmlPath).toString().replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (m, a, b, c) => a + b.replace(/[^\n]/g, ' ') + c), out = new Map(), base = (() => { const b = tags(html, 'base')[0]; return b ? attr(b.tag, 'href') : null; })();
  const from = base ? join(SITE, base.replace(/^\/mana\//, '')) + '/x' : htmlPath;
  const add = (url, why) => { const p = local(url, from); if (p && existsSync(p) && statSync(p).isFile() && !out.has(p)) out.set(p, why); };
  for (const { tag } of tags(html, 'script')) add(attr(tag, 'src'), 'script');
  for (const { tag } of tags(html, 'link')) {
    const r = (attr(tag, 'rel') || '').toLowerCase();
    if (/stylesheet|preload|modulepreload|prefetch|icon|manifest/.test(r)) add(attr(tag, 'href'), 'link ' + r);
  }
  for (const { tag } of tags(html, 'img')) { add(attr(tag, 'src'), 'img'); srcset(attr(tag, 'srcset')).forEach((u) => add(u, 'img srcset')); }
  for (const { tag } of tags(html, 'iframe')) add(attr(tag, 'src'), 'iframe');
  for (const { tag } of tags(html, 'embed')) add(attr(tag, 'src'), 'embed');
  for (const { tag } of tags(html, 'object')) add(attr(tag, 'data'), 'object');
  for (const el of ['video', 'audio']) for (const m of html.matchAll(new RegExp('<' + el + '\\b[^>]*>([\\s\\S]*?)</' + el + '>', 'gi'))) {
    const open = m[0].match(/^<[^>]*>/)[0], fetches = (attr(open, 'preload') || 'auto').toLowerCase() !== 'none' || has(open, 'autoplay');
    add(attr(open, 'poster'), el + ' poster');
    if (fetches) { add(attr(open, 'src'), el + ' src'); for (const { tag } of tags(m[1], 'source')) { add(attr(tag, 'src'), el + ' source'); srcset(attr(tag, 'srcset')).forEach((u) => add(u, el + ' source')); } }
  }
  for (const m of html.matchAll(/<picture\b[^>]*>([\s\S]*?)<\/picture>/gi)) for (const { tag } of tags(m[1], 'source')) srcset(attr(tag, 'srcset')).forEach((u) => add(u, 'picture source'));
  for (const [p, why] of [...out]) if (/\.css$/i.test(p) && why.startsWith('link')) for (const u of cssUrls(p)) { const q = local(u, p); if (q && existsSync(q) && statSync(q).isFile() && !out.has(q)) out.set(q, 'css url() in ' + rel(p)); }
  return out;
}
function cssUrls(cssPath) { return [...read(cssPath).toString().matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/g)].map((m) => m[1] ?? m[2] ?? m[3]); }
function chunksOf(jsPath) { const s = read(jsPath).toString(); return [...s.matchAll(/(?:from\s*|import\s*\(\s*)["'](\.\/(?:chunks\/)?[^"']+\.js)["']/g)].map((m) => resolve(dirname(jsPath), m[1])); }

/* static imports (what loads with a script) and on-demand ones (import()) of a built script, relative to it */
const staticImports = (js) => [...read(js).toString().matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.\.?\/(?:chunks\/)?[^"']+\.js)["']/g)].map((m) => resolve(dirname(js), m[1]));
const dynamicImports = (js) => [...read(js).toString().matchAll(/import\s*\(\s*["'](\.\.?\/(?:chunks\/)?[^"']+\.js)["']/g)].map((m) => resolve(dirname(js), m[1]));
const sections = [];
function section(title, rows, budget) { const total = rows.reduce((n, r) => n + (r ? r.sent : 0), 0); sections.push({ title, rows: rows.filter(Boolean), total, budget }); if (budget && total > budget) breaches.push(title + ': ' + kb(total) + ' kB sent > ' + kb(budget) + ' kB'); return total; }

/* (a) the guest menu's first dish */
{
  const V = join(SITE, 'view'), rows = [];
  rows.push(need(join(V, 'index.html'), 'the page'), need(join(V, 'app.css'), 'style'));
  const app = need(join(V, 'app.js'), 'entry script'); rows.push(app);
  if (app) {
    /* What a guest's phone fetches before the first dish: app.js, every chunk it imports statically, the stage chunk it
       imports on demand, and everything those import statically in turn (three.js sits in its own chunk since the seat map
       shares it). Other on-demand chunks (the hero mode, the 3D room) are not part of a guest's first dish. */
    const staticOf = (js) => { const s = read(js).toString(); return [...s.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.\.?\/(?:chunks\/)?[^"']+\.js)["']/g)].map((m) => resolve(dirname(js), m[1])); };
    const dynamicOf = (js) => { const s = read(js).toString(); return [...s.matchAll(/import\s*\(\s*["'](\.\.?\/(?:chunks\/)?[^"']+\.js)["']/g)].map((m) => resolve(dirname(js), m[1])); };
    const seen = new Map(), walk = (js, why) => { if (seen.has(js) || !existsSync(js)) return; seen.set(js, why); for (const c of staticOf(js)) walk(c, 'chunk ' + rel(js) + ' imports'); };
    for (const c of staticOf(join(V, 'app.js'))) walk(c, 'chunk app.js imports');
    const stage = dynamicOf(join(V, 'app.js')).filter((c) => /\/stage-[^/]+\.js$/.test(c));
    if (!stage.length) breaches.push('view/app.js names no stage chunk');
    for (const c of stage) walk(c, 'the stage chunk (on demand, before the first dish)');
    for (const [c, why] of seen) rows.push(need(c, why));
  }
  rows.push(need(join(V, 'themes/oak.jpg'), 'the default table'), need(join(V, 'themes/oak_h.jpg'), 'the default table, height'));
  if (existsSync(join(V, 'app.css'))) {
    const fonts = cssUrls(join(V, 'app.css')).filter((u) => /\.woff2?$/i.test(u));
    if (!fonts.length) breaches.push('view/app.css declares no fonts');
    for (const u of fonts) rows.push(need(local(u, join(V, 'app.css')), 'font app.css declares'));
  }
  const menuPath = join(V, 'demo/olea/menu.json'), menu = need(menuPath, "Olea's menu"); rows.push(menu);
  if (menu) {
    const m = JSON.parse(read(menuPath).toString()), first = (m.categories || []).flatMap((c) => c.items || [])[0];
    if (!first || !first.asset) breaches.push('Olea has no first dish with an asset');
    else for (const k of ['color', 'aux', 'thumb']) if (first.asset[k]) rows.push(need(local(first.asset[k], menuPath), 'first dish ' + first.id + ' ' + k));
  }
  section('(a) guest menu, first dish', rows, BUDGET.first);
}

/* (b) the product page's scripts before the hero */
{
  const page = join(SITE, 'index.html'), rows = [];
  if (!existsSync(page)) breaches.push('missing: index.html');
  else {
    const html = read(page).toString(); let inline = '', n = 0;
    for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) { const src = attr('<script' + m[1] + '>', 'src'); if (src) rows.push(need(local(src, page), 'script the page names')); else { inline += m[2] + '\n'; n++; } }
    rows.push({ file: 'index.html <script> (inline, ' + n + ')', why: 'inline scripts', raw: Buffer.byteLength(inline), sent: gzipSync(Buffer.from(inline), { level: 9 }).length });
    if (!rows.some((r) => r && /mana\.js$/.test(r.file))) notes.push('index.html does not name mana.js');
  }
  section("(b) product page, scripts before the hero", rows, BUDGET.page);
}

/* (c) the seat map page, if present */
{
  const seat = join(SITE, 'view/seat/index.html'), rows = [];
  if (!existsSync(seat)) notes.push('(c) no seat map page at view/seat/index.html: nothing to measure');
  else {
    rows.push(row(seat, 'the page'));
    const shared = new Set(existsSync(join(SITE, 'view/app.js')) ? chunksOf(join(SITE, 'view/app.js')) : []);
    const html = read(seat).toString();
    for (const { tag } of tags(html, 'script')) { const p = local(attr(tag, 'src'), seat); if (!p || !existsSync(p)) continue; rows.push(row(p, 'script'));
      for (const c of staticImports(p)) if (existsSync(c)) rows.push(shared.has(c) ? null : row(c, 'its own chunk')); if ([...shared].some((c) => staticImports(p).includes(c))) notes.push('(c) shared chunks left out: ' + [...shared].filter((c) => staticImports(p).includes(c)).map(rel).join(', '));
      const later = dynamicImports(p).filter((c) => existsSync(c) && !shared.has(c));
      if (later.length) section('(c) seat map, the 3D room (on demand, when a guest taps 3D)', later.map((c) => row(c, 'on-demand chunk')), BUDGET.seat3d); }
    for (const { tag } of tags(html, 'link')) if (/stylesheet/i.test(attr(tag, 'rel') || '')) { const p = local(attr(tag, 'href'), seat); if (p && existsSync(p)) rows.push(row(p, 'style')); }
    section('(c) seat map page', rows, BUDGET.seat);
  }
}

/* (d) media */
{
  const page = join(SITE, 'index.html');
  if (existsSync(page)) {
    const html = read(page).toString();
    for (const m of html.matchAll(/<video\b[^>]*>([\s\S]*?)<\/video>/gi)) {
      const open = m[0].match(/^<[^>]*>/)[0], pre = (attr(open, 'preload') || 'auto').toLowerCase(), auto = has(open, 'autoplay');
      const source = attr(open, 'src') || tags(m[1], 'source').length > 0, name = (attr(open, 'class') || attr(open, 'id') || 'video').split(/\s+/)[0];
      if (source && (pre !== 'none' || auto)) breaches.push('(d) index.html <video.' + name + '> has a source and preload="' + pre + '"' + (auto ? ' autoplay' : '') + ': it must be preload="none" without autoplay');
      else if (!source && (pre !== 'none' || auto)) notes.push('(d) index.html <video.' + name + '> preload="' + pre + '"' + (auto ? ' autoplay' : '') + ' has no source, so it loads nothing at first paint (mana.js adds it after)');
    }
  }
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : /\.html?$/i.test(e.name) ? [join(d, e.name)] : []);
  const big = [];
  for (const h of walk(SITE)) for (const [p, why] of firstPaint(h)) { const n = statSync(p).size; if (n > BUDGET.file) { big.push({ file: rel(p), why: why + ' of ' + rel(h), raw: n, sent: n }); breaches.push('(d) ' + rel(h) + ' loads ' + rel(p) + ' (' + kb(n) + ' kB, ' + why + ') at first paint: over 3 MB'); } }
  sections.push({ title: '(d) files over 3 MB at first paint', rows: big, total: big.reduce((n, r) => n + r.raw, 0), budget: null });
}

/* the table */
for (const s of sections) {
  console.log('\n' + s.title + (s.budget ? '   ' + kb(s.total) + ' kB sent of ' + kb(s.budget) + ' kB' : s.rows.length ? '' : '   none'));
  for (const r of s.rows) console.log('  ' + kb(r.sent).padStart(7) + ' kB sent  ' + kb(r.raw).padStart(7) + ' kB raw   ' + r.file + '   (' + r.why + ')');
}
for (const n of notes) console.log('\n· ' + n);
if (breaches.length) { console.log('\n✗ budgets: ' + breaches.length + ' breach' + (breaches.length === 1 ? '' : 'es')); breaches.forEach((b) => console.log('  ✗ ' + b)); process.exit(1); }
console.log('\n✓ budgets: ' + sections.filter((s) => s.budget).map((s) => s.title.slice(0, 3) + ' ' + kb(s.total) + '/' + kb(s.budget) + ' kB').join(' · '));
