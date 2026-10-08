/* Local stand-in for the host, for development and tests only (never deployed).
   It serves brand/site the way it will be published, under BOTH path prefixes the contract names:
     /projects/menus/            ← GitHub Pages / halom.io generic rewrite
     /mana/                      ← halom.io/mana/ after the next release
   next to the real viewer at <prefix>view/ (read, not copied), the placeholder library at <prefix>stock/, a stub studio
   page at <prefix>studio/, a local config.js (v2 shape), and a stub of the leads function:
     POST /stub/rest/v1/rpc/submit_lead   →  {ok:true,ref} | {ok:false,code}     (contact "fail@x.io" → 500; "limit@x.io" → rate_limited)
   Which viewer: MANA_VIEW=<folder> (or opts.view); default ../view. While the viewer lane is rebuilding ../view, point it at
   a stable copy, e.g. MANA_VIEW=/home/claude/halom-projects/projects/menus/view.
   Options: { delay, view, scan (config.features.scan), providers (config.auth.providers), media: {'img/hero.mp4': '/abs/file'},
   pages: {'index.html': '<html…>'} }. `media` and `pages` overlay what is not in site/ yet (the hero video, the films, the
   page built for them), so both states of the page can be tested without touching site/.
   Usage: node tools/serve.mjs [port] [--scan]  →  http://127.0.0.1:8791/mana/ */
import http from 'node:http';
import { readFile, stat, open } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = join(HERE, '..', 'site');
const STOCK = join(HERE, '..', '..', 'stock');
const PREFIXES = ['/projects/menus/', '/mana/'];
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4', '.webm': 'video/webm' };
export const KEY = 'sb_publishable_test';

export function createServer(opts = {}) {
  const leads = [], log = [];
  const VIEW = resolve(opts.view || process.env.MANA_VIEW || join(HERE, '..', '..', 'view'));
  const SITE_DIR = opts.site ? resolve(opts.site) : SITE;                 // another build of the page (for example yesterday's, to measure it)
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'); let path = decodeURIComponent(url.pathname);
    log.push({ method: req.method, path, range: req.headers.range || null });
    const send = (code, body, type, extra) => {
      let buf = Buffer.isBuffer(body) ? body : Buffer.from(body); const h = Object.assign({ 'Content-Type': type, 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' }, extra || {});
      if (/^(text|application\/json|image\/svg)/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '') && buf.length > 512) { buf = gzipSync(buf); h['Content-Encoding'] = 'gzip'; }
      h['Content-Length'] = buf.length; res.writeHead(code, h); res.end(req.method === 'HEAD' ? undefined : buf);
    };
    try {
      if (path === '/stub/rest/v1/rpc/submit_lead') {
        if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, content-type, accept', 'Access-Control-Allow-Methods': 'POST' }); return res.end(); }
        let body = ''; for await (const c of req) body += c;
        const json = (code, o) => send(code, JSON.stringify(o), TYPES['.json'], { 'Cache-Control': 'no-store' });
        if (req.method !== 'POST' || req.headers.apikey !== KEY) return json(401, { message: 'No API key found in request' });
        let b = {}; try { b = JSON.parse(body); } catch (e) { return json(400, { message: 'bad json' }); }
        if (opts.delay) await new Promise((r) => setTimeout(r, opts.delay));
        if (/^fail@/.test(b.p_contact || '')) return json(500, { message: 'boom' });
        if (/^limit@/.test(b.p_contact || '')) return json(200, { ok: false, code: 'rate_limited' });
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuid.test(b.p_token || '')) return json(200, { ok: false, code: 'invalid' });
        const again = leads.find((l) => l.p_token === b.p_token); if (again) return json(200, { ok: true, ref: again.ref });
        if ((b.p_hp || '') !== '' || (b.p_elapsed_ms != null && b.p_elapsed_ms < 1500)) return json(200, { ok: false, code: 'spam' });
        const c = String(b.p_contact || '').trim(), d = String(b.p_dream || '').trim();
        if (d.length < 3 || d.length > 4000 || c.length < 5 || c.length > 200 || !(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) || /^\d{7,15}$/.test(c.replace(/\D/g, ''))) || b.p_package !== 'menus') return json(200, { ok: false, code: 'invalid' });
        b.ref = 'HL-' + String(1000 + leads.length + 1); leads.push(b);
        return json(200, { ok: true, ref: b.ref });
      }
      const prefix = PREFIXES.find((p) => path.startsWith(p));
      if (!prefix) { if (PREFIXES.some((p) => path === p.slice(0, -1))) { res.writeHead(302, { Location: path + '/' }); return res.end(); } return send(404, 'not found', TYPES['.txt']); }
      let rel = normalize(path.slice(prefix.length)); if (rel === '.') rel = '';
      if (rel === 'config.js') {
        const origin = 'http://' + req.headers.host;
        const cfg = { supabaseUrl: origin + '/stub', supabaseKey: KEY, shortBase: origin + '/m/', shortLive: true, viewPath: '../view/', genPath: '../gen/', stockPath: '../stock/', sitePath: '../',
          auth: { providers: opts.providers || [] }, features: { scan: !!opts.scan } };
        return send(200, 'window.HALOM_MENUS_CONFIG = ' + JSON.stringify(cfg) + ';', TYPES['.js']);
      }
      if (rel === 'studio' || rel === 'view' || rel === 'privacy' || rel === 'terms' || rel === 'guide') { res.writeHead(302, { Location: path + '/' + url.search }); return res.end(); }
      if (rel === 'studio/' || rel === 'studio/index.html') return send(200, '<!doctype html><meta charset="utf-8"><title>Studio (stub)</title><body style="font:16px sans-serif;padding:40px"><h1 id="studio-stub">Studio stub</h1><p>The owner app lives here in production.</p><p><a href="../">← Mana</a></p>', TYPES['.html']);
      let root = SITE_DIR, file = null;
      const pageKey = rel === '' ? 'index.html' : rel.endsWith('/') ? rel + 'index.html' : rel;
      if (opts.pages && opts.pages[pageKey] != null) return send(200, opts.pages[pageKey], TYPES['.html']);
      if (opts.media && opts.media[rel]) file = opts.media[rel];
      else if (rel.startsWith('view/')) {
        root = VIEW; rel = rel.slice(5);
        if (rel.startsWith('demo/howto/')) { root = join(HERE, 'howto-demo'); rel = rel.slice(11); }   // one real phone photo run through the generator
        if (/(^|\/)(node_modules|\.git|test|tools|src|\.shots|\.scratch)(\/|$)/.test(rel)) return send(404, 'not found', TYPES['.txt']);
      } else if (rel.startsWith('stock/')) {
        root = STOCK; rel = rel.slice(6);
        if (/(^|\/)(node_modules|\.git|tools|sheets|\.scratch)(\/|$)/.test(rel)) return send(404, 'not found', TYPES['.txt']);
      }
      if (!file) {
        if (rel === '' || rel.endsWith('/')) rel = join(rel, 'index.html');
        if (rel.startsWith('..')) return send(404, 'not found', TYPES['.txt']);
        file = join(root, rel);
      }
      const st = await stat(file).catch(() => null);
      if (st && st.isDirectory()) { res.writeHead(302, { Location: path + '/' }); return res.end(); }
      if (!st || !st.isFile()) return send(404, 'not found', TYPES['.txt']);
      const type = TYPES[extname(file)] || 'application/octet-stream';
      if (/^video\//.test(type)) {                                  // byte ranges, as a real static host answers them
        const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || ''); let a = 0, b = st.size - 1, code = 200;
        if (m) { if (m[1] === '' && m[2] !== '') { a = Math.max(0, st.size - Number(m[2])); } else { a = Number(m[1] || 0); if (m[2] !== '') b = Math.min(b, Number(m[2])); } code = 206; }
        if (a > b || a >= st.size) { res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); return res.end(); }
        const h = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': b - a + 1, 'Cache-Control': 'no-cache' }; if (code === 206) h['Content-Range'] = `bytes ${a}-${b}/${st.size}`;
        res.writeHead(code, h); if (req.method === 'HEAD') return res.end();
        const fh = await open(file, 'r'); const buf = Buffer.alloc(b - a + 1); await fh.read(buf, 0, buf.length, a); await fh.close(); return res.end(buf);
      }
      send(200, await readFile(file), type);
    } catch (e) { send(500, String(e && e.message), TYPES['.txt']); }
  });
  server.leads = leads; server.requests = log; server.viewDir = VIEW;
  return server;
}
export function listen(port = 0, opts) { const s = createServer(opts); return new Promise((res) => s.listen(port, '127.0.0.1', () => res({ server: s, port: s.address().port, origin: 'http://127.0.0.1:' + s.address().port }))); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || 8791;
  listen(port, { scan: process.argv.includes('--scan') }).then((s) => console.log(PREFIXES.map((p) => s.origin + p).join('\n') + '\nviewer from ' + s.server.viewDir));
}
