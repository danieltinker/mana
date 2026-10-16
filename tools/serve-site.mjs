#!/usr/bin/env node
/* Serves a built site (_site/) on this machine the way halom.io serves it (its routes in danieltinker/halom,
   public/vercel.json; docs/separation-checklist.md):
     /mana/<path>    → _site/<path>             a folder → its index.html; /mana and a folder without "/" are redirected
     /m/<slug>       → _site/view/index.html    and /m/<slug>/: the guest menu sets <base href="/mana/view/"> itself
     /               → /mana/
   with byte ranges (Safari plays the product page's films only with them) and the headers halom.io sets on every path.
   Node only, no packages: it runs on a Mac as it does on Linux. The settings are whatever the build put in
   _site/config.js (MANA_ENV, docs/environments.md).

     node tools/serve-site.mjs [--port 4180] [--host 127.0.0.1] [--site _site]       (= npm run serve)
   --host 0.0.0.0 opens it to the local network (a phone on the same Wi-Fi). */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './env.mjs';

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

/** An http.Server for `site`, routed as halom.io routes Mana. */
export function createSiteServer({ site }) {
  const root = path.resolve(site);
  return http.createServer((req, res) => {
    const head = (code, extra = {}) => res.writeHead(code, { ...HALOM_HEADERS, 'Cache-Control': 'no-cache', ...extra });
    const text = (code, body) => { head(code, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(body); };
    if (req.method !== 'GET' && req.method !== 'HEAD') return text(405, 'GET and HEAD only');
    const url = new URL(req.url, 'http://x');
    let p; try { p = decodeURIComponent(url.pathname); } catch { return text(400, 'bad address'); }
    const redirect = (to) => { head(302, { Location: to + url.search }); res.end(); };
    const send = (f, s) => {
      const type = TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream';
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      let start = 0, end = s.size - 1, code = 200;
      if (range && (range[1] || range[2])) {
        if (range[1] === '') start = Math.max(0, s.size - Number(range[2]));
        else { start = Number(range[1]); if (range[2] !== '') end = Math.min(end, Number(range[2])); }
        if (start > end || start >= s.size) { head(416, { 'Content-Range': `bytes */${s.size}` }); return res.end(); }
        code = 206;
      }
      head(code, { 'Content-Type': type, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes', ...(code === 206 ? { 'Content-Range': `bytes ${start}-${end}/${s.size}` } : {}) });
      if (req.method === 'HEAD' || s.size === 0) return res.end();
      fs.createReadStream(f, { start, end }).pipe(res);
    };
    if (p === '/' || p === '/mana') return redirect('/mana/');
    let rel;
    if (/^\/m\/[^/]+\/?$/.test(p)) rel = 'view/index.html';
    else if (p.startsWith('/mana/')) rel = p.slice('/mana/'.length);
    else return text(404, 'not found (the site is at /mana/, menus at /m/<name>)');
    const file = path.resolve(root, rel);
    if (file !== root && !file.startsWith(root + path.sep)) return text(404, 'not found');
    const st = fs.statSync(file, { throwIfNoEntry: false });
    if (st?.isDirectory()) {
      if (!p.endsWith('/')) return redirect(p + '/');
      const index = fs.statSync(path.join(file, 'index.html'), { throwIfNoEntry: false });
      return index?.isFile() ? send(path.join(file, 'index.html'), index) : text(404, 'not found');
    }
    return st?.isFile() ? send(file, st) : text(404, 'not found');
  });
}

/** Starts the server; resolves with its origin (as this machine opens it) and close(). */
export function serveSite({ site = path.join(ROOT, '_site'), port = DEFAULT_PORT, host = '127.0.0.1' } = {}) {
  if (!fs.existsSync(path.join(site, 'index.html'))) throw new Error(`no built site in ${site} (bash tools/build-site.sh)`);
  const server = createSiteServer({ site });
  return new Promise((resolve, reject) => {
    server.once('error', (e) => reject(e.code === 'EADDRINUSE' ? new Error(`port ${port} is taken: pass --port <another>`) : e));
    server.listen(port, host, () => {
      const at = server.address().port, local = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
      resolve({ server, port: at, origin: `http://${local}:${at}`, lan: host === '0.0.0.0' || host === '::' ? lanOrigins(at) : [],
        close: () => new Promise((r) => { server.close(() => r()); server.closeAllConnections(); }) });
    });
  });
}

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
    const a = parseArgs(process.argv.slice(2));
    const s = await serveSite({ site: a.site ? path.resolve(a.site) : undefined, port: a.port ? Number(a.port) : DEFAULT_PORT, host: a.host || '127.0.0.1' });
    console.log(`serving ${path.relative(ROOT, path.resolve(a.site || path.join(ROOT, '_site'))) || '.'} as halom.io would; Ctrl-C stops it`);
    printLinks([...siteLinks(s.origin), ...s.lan.map((o) => ['on the Wi-Fi', `${o}/mana/`])]);
  } catch (e) { console.error('✗ ' + e.message); process.exit(1); }
}
