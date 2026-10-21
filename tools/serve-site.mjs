#!/usr/bin/env node
/* Serves a built site (_site/) on this machine the way halom.io serves it (its routes in danieltinker/halom,
   public/vercel.json; docs/separation-checklist.md):
     /mana/<path>    → _site/<path>             a folder → its index.html; /mana and a folder without "/" are redirected
     /m/<slug>       → _site/view/index.html    and /m/<slug>/: the guest menu sets <base href="/mana/view/"> itself
     /               → /mana/
   with byte ranges (Safari plays the product page's films only with them) and the headers halom.io sets on every path.
   Node only, no packages: it runs on a Mac as it does on Linux. The settings are whatever the build put in
   _site/config.js (MANA_ENV, docs/environments.md).

     node tools/serve-site.mjs [--port 4180] [--host 127.0.0.1] [--site _site] [--live]       (= npm run serve)
   It says which environment the build is for. A production build talks to halom-studio, the live database, so its
   config.js is withheld (no page can reach the database; the in-build demo still works) unless --live is given. The
   settings are checked on every request: if _site/ is rebuilt for another environment while it runs, config.js is
   refused and the terminal says so.
   --host 0.0.0.0 opens it to the local network (a phone on the same Wi-Fi). */
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configProblems, envOf, PRODUCTION, readConfig, readConfigText, ROOT, schemaOf } from './env.mjs';

export const DEFAULT_PORT = 4180;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.py': 'text/x-python; charset=utf-8', '.pdf': 'application/pdf',
};
/* halom.io's vercel.json sets these for every path, /mana/ and /m/ included */
const HALOM_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };

/* every file this small is read whole, judged and sent from that one reading: a file that assigns the settings is
   judged whatever its name (a copy of config.js, a page that inlines them, config.js itself between a rebuild's unlink
   and write). Larger files (films, images) are streamed. */
const SMALL_FILE = 256 * 1024, ASSIGNS_SETTINGS = /HALOM_MENUS_CONFIG\s*=(?!=)/;
const sameOrigin = (a, b) => { try { return new URL(a).origin === new URL(b).origin; } catch { return false; } };

/** The settings guard, decided on every request, never once at start: `_site/` can be rebuilt under a running server.
    A file is the site's settings when it is config.js, a hard link to it (the same inode), a copy (the same content) or
    holds a script that assigns HALOM_MENUS_CONFIG; it is identified by what it holds now, read through the very handle
    the answer is sent from, so the bytes judged are the bytes sent:
      settings that are not `expected`'s (the environment checked at start: its label, and every check configProblems
        makes, address and key included)  refused (409), and `warn` says so once;
      production's settings, by their label or by halom-studio's address  withheld (404), unless `live`;
      settings it cannot read  refused (409).
    Returns, for a request of `file` opened as `fd` (fstat `st`): null (a large file that is not the settings: stream
    it), { code, body } (not served) or { body } (send exactly these bytes). It throws when it cannot tell: fail closed. */
function settingsGuard(root, { expected = null, live = false, stack = null, warn = (line) => console.error(line) } = {}) {
  const settings = path.join(root, 'config.js'), verdicts = new Map(), warned = new Set();
  const digest = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
  const withheld = { code: 404, body: 'withheld: a production build\'s settings are served only with --live' };
  const judge = (text, name) => {
    let cfg = null; try { cfg = readConfigText(text); } catch { /* unreadable */ }
    if (!cfg) return { code: 409, body: `refused: ${name} assigns the settings but cannot be read`, warn: `! _site/${name} assigns the settings but cannot be read: refused` };
    const env = envOf(cfg), production = env === 'production' || sameOrigin(cfg.supabaseUrl, PRODUCTION.supabaseUrl);
    if (expected && env !== expected) {
      return { code: 409, body: `refused: _site/ was rebuilt for ${env}, not ${expected}; restart the server`,
        warn: `! _site/${name} is now ${env}'s${env === 'production' ? ' (halom-studio, the live database)' : ''}, not the ${expected} build this server checked at start: refused; restart it after a rebuild` };
    }
    const problems = expected ? configProblems(expected, cfg, { stack }) : [];
    if (problems.length) {
      return { code: 409, body: `refused: ${name} does not hold the ${expected} settings; restart the server after a rebuild`,
        warn: `! _site/${name} says ${expected}, but ${problems[0]}: refused; restart the server after a rebuild` };
    }
    return production && !live ? withheld : null;
  };
  const readAll = (fd, size) => {
    const buf = Buffer.alloc(size); let got = 0;
    while (got < size) { const n = fs.readSync(fd, buf, got, size - got, got); if (!n) break; got += n; }
    return buf.subarray(0, got);
  };
  return (file, fd, st) => {
    let cur = null; try { cur = fs.statSync(settings); } catch { /* none now: a rebuild in progress */ }
    const named = file === settings, linked = !!cur && st.dev === cur.dev && st.ino === cur.ino;
    if (!named && !linked && st.size > SMALL_FILE) return null;
    const body = readAll(fd, st.size), id = digest(body);
    let copy = false;
    if (!named && !linked && cur && body.length === cur.size) { try { copy = digest(fs.readFileSync(settings)) === id; } catch { /* gone */ } }
    if (!named && !linked && !copy && !ASSIGNS_SETTINGS.test(body.toString('latin1'))) return { body };
    if (!verdicts.has(id)) verdicts.set(id, judge(body.toString('utf8'), path.relative(root, file).split(path.sep).join('/')));
    const v = verdicts.get(id);
    if (v?.warn && !warned.has(v.warn)) { warned.add(v.warn); warn(v.warn); }       // each line once, however many versions
    return v ? { code: v.code, body: v.body } : { body };
  };
}

/** An http.Server for `site`, routed as halom.io routes Mana. It never serves a file whose real path (symbolic links
    resolved) is outside `site`, and a request it cannot make sense of gets a 4xx, never a crash. `settings` configures
    the settings guard above ({ expected, live, stack, warn }); by default production's settings are withheld. */
export function createSiteServer({ site, settings = {} }) {
  const root = fs.realpathSync(path.resolve(site));
  const inside = (f) => f === root || f.startsWith(root + path.sep);
  const guard = settingsGuard(root, settings);
  /* the file's stat, if its real path is inside the site; null when missing, outside the site, a name too long, a NUL */
  const realOf = (f) => { try { return fs.realpathSync(f); } catch { return null; } };
  const look = (f) => {
    try {
      const st = fs.statSync(f, { throwIfNoEntry: false }), real = st && realOf(f);
      return real && inside(real) ? st : null;
    } catch { return null; }
  };
  return http.createServer((req, res) => {
    const head = (code, extra = {}) => res.writeHead(code, { ...HALOM_HEADERS, 'Cache-Control': 'no-cache', ...extra });
    const text = (code, body) => { head(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(body); };
    try { route(); } catch { if (!res.headersSent) text(500, 'the server could not answer this'); else res.destroy(); }

    function route() {
      if (req.method !== 'GET' && req.method !== 'HEAD') return text(405, 'GET and HEAD only');
      const url = new URL(req.url, 'http://x');
      let p; try { p = decodeURIComponent(url.pathname); } catch { return text(400, 'bad address'); }
      if (p.includes('\0') || p.length > 2048) return text(400, 'bad address');
      /* Location is built from the still-encoded address, so no decoded byte (CR, LF, Hebrew) ever reaches a header */
      const redirect = (to) => { head(302, { Location: to + url.search }); res.end(); };
      if (p === '/' || p === '/mana') return redirect('/mana/');
      let rel;
      if (/^\/m\/[^/]+\/?$/.test(p)) rel = 'view/index.html';
      else if (p.startsWith('/mana/')) rel = p.slice('/mana/'.length);
      else return text(404, 'not found (the site is at /mana/, menus at /m/<name>)');
      const file = path.resolve(root, rel);
      if (!inside(file)) return text(404, 'not found');
      const st = look(file);
      if (st?.isDirectory()) {
        if (!p.endsWith('/')) return redirect(url.pathname + '/');
        const index = look(path.join(file, 'index.html'));
        return index?.isFile() ? send(path.join(file, 'index.html')) : text(404, 'not found');
      }
      return st?.isFile() ? send(file) : text(404, 'not found');
    }

    /* the file is opened once; its stat, the guard's reading and what is sent all go through that one handle */
    function send(f) {
      let fd; try { fd = fs.openSync(f, 'r'); } catch { return text(404, 'not found'); }
      let streaming = false;
      try {
        const s = fs.fstatSync(fd);
        if (!s.isFile()) return text(404, 'not found');
        let held;
        try { held = guard(f, fd, s); } catch { return text(409, 'refused: the settings could not be checked'); }    // fail closed
        if (held?.code) return text(held.code, held.body);
        const type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
        streaming = deliver(type, held ? { body: held.body } : { fd, size: s.size });    // a body read by the guard: the bytes it checked
      } finally { if (!streaming) fs.closeSync(fd); }
    }

    /** Sends `body`, or streams the opened `fd` of `size` bytes, with byte ranges; true when a stream now owns `fd`. */
    function deliver(type, { body = null, fd, size = body.length }) {
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      let start = 0, end = size - 1, code = 200;
      if (range && (range[1] || range[2])) {
        if (range[1] === '') start = Math.max(0, size - Number(range[2]));
        else { start = Number(range[1]); if (range[2] !== '') end = Math.min(end, Number(range[2])); }
        if (start > end || start >= size) { head(416, { 'Content-Range': `bytes */${size}` }); res.end(); return false; }
        code = 206;
      }
      head(code, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', ...(code === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}) });
      if (req.method === 'HEAD' || size === 0) { res.end(); return false; }
      if (body) { res.end(body.subarray(start, end + 1)); return false; }
      fs.createReadStream(null, { fd, start, end, autoClose: true }).on('error', () => res.destroy()).pipe(res);
      return true;
    }
  });
}

/** Starts the server; resolves with its origin (as this machine opens it) and close(). */
export function serveSite({ site = path.join(ROOT, '_site'), port = DEFAULT_PORT, host = '127.0.0.1', settings = {} } = {}) {
  if (!fs.existsSync(path.join(site, 'index.html'))) throw new Error(`no built site in ${site} (bash tools/build-site.sh)`);
  const server = createSiteServer({ site, settings });
  return new Promise((resolve, reject) => {
    server.once('error', (e) => reject(e.code === 'EADDRINUSE' ? new Error(`port ${port} is taken: pass --port <another>`) : e));
    server.listen(port, host, () => {
      const at = server.address().port;
      resolve({ server, port: at, origin: originOf(host, at), lan: host === '0.0.0.0' || host === '::' ? lanOrigins(at) : [],
        close: () => new Promise((r) => { server.close(() => r()); server.closeAllConnections(); }) });
    });
  });
}

/** The origin this machine opens a server listening on `host`:`port` at. */
export const originOf = (host, port) => `http://${host === '0.0.0.0' || host === '::' ? 'localhost' : host}:${port}`;

/** This machine's addresses on the local network, for a phone on the same Wi-Fi. */
const lanOrigins = (port) => Object.values(os.networkInterfaces()).flat().filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => `http://${a.address}:${port}`);

/** The addresses worth opening on a served build: [label, url]. */
export function siteLinks(origin, { slug } = {}) {
  return [
    ['product page', `${origin}/mana/`],
    ['guest menu', slug ? `${origin}/m/${slug}` : `${origin}/m/<name>`],
    ['guest menu (the in-build demo, no database)', `${origin}/mana/view/?demo=olea`],
    ['owner app', `${origin}/mana/studio/`],
    ['back office', `${origin}/mana/ops/`],
  ];
}

export function parseArgs(argv, flags = []) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const k = a.slice(2);
    if (flags.includes(k)) { out[k] = true; continue; }
    if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`--${k} needs a value`);
    out[k] = argv[++i];
  }
  return out;
}

export const printLinks = (links) => { const w = Math.max(...links.map(([l]) => l.length)); for (const [l, u] of links) console.log(`  ${l.padEnd(w)}  ${u}`); };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const a = parseArgs(process.argv.slice(2), ['live']);
    const site = path.resolve(a.site || path.join(ROOT, '_site'));
    let cfg; try { cfg = readConfig(path.join(site, 'config.js')); } catch (e) { throw new Error(`no readable config.js in ${site} (bash tools/build-site.sh): ${e.message}`); }
    const production = envOf(cfg) === 'production', guarded = production && !a.live;
    const s = await serveSite({ site, port: a.port ? Number(a.port) : DEFAULT_PORT, host: a.host || '127.0.0.1', settings: { expected: envOf(cfg), live: !!a.live } });
    console.log(`serving ${path.relative(ROOT, site) || '.'} as halom.io would; Ctrl-C stops it`);
    console.log(`settings: ${envOf(cfg)} (${cfg.supabaseUrl}, schema ${schemaOf(cfg)})`);
    const problems = configProblems(envOf(cfg), cfg);
    if (problems.length) console.log(`! config.js says ${envOf(cfg)}, but ${problems.join('; ')}: it is refused, so pages run without settings. Rebuild (bash tools/build-site.sh).`);
    if (guarded) {
      console.log('! a production build: its settings point at halom-studio, the live database. config.js is withheld, so no page');
      console.log('  can reach it; only the in-build demo works. --live serves the build whole (never as an agent).');
      printLinks([siteLinks(s.origin).find(([l]) => l.includes('in-build demo'))]);
    } else {
      if (production) console.log('! --live: every page talks to halom-studio, the live database. A menu opened here records guest events in it.');
      printLinks([...siteLinks(s.origin), ...s.lan.map((o) => ['on the Wi-Fi', `${o}/mana/`])]);
    }
  } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
