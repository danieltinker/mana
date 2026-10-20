/* Local stand-in for the hosts the viewer talks to, for development and tests only (never deployed):
     static files   like GitHub Pages: this folder at /projects/menus/view/ (and at /mana/view/, as on halom.io), the placeholder library at /projects/menus/stock/,
                    gzip, 10-minute cache, and /m/<slug> rewritten to index.html
     Supabase stub  POST /stub/rest/v1/rpc/open_menu | public_menu  →  the three answers in CONTRACT.md (plus a 500 and a slow one)
                    POST /stub/rest/v1/rpc/track_item               →  204, and the call is kept in server.calls for tests
   Usage: node tools/serve.mjs [port]      then open  http://localhost:8787/projects/menus/view/?demo=olea   or   http://localhost:8787/m/olea */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PREFIX = '/projects/menus/view/', STOCK = '/projects/menus/stock/';
const FIXTURE = join(ROOT, 'test/fixtures/stock'), LIBRARY = join(ROOT, '..', '..', 'stock');      // the eight fixed starter entries · the real library, when it is there
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4' };
const KEY = 'sb_publishable_test';
const flaky = new Map();
const MENUS = { olea: 'olea', flaky: 'olea', slow: 'olea', kiosk: 'kiosk' };

export function createServer(opts = {}) {
  const log = [], calls = [];
  const stockDir = opts.stockDir || (opts.stock === 'library' && existsSync(join(LIBRARY, 'stock.json')) ? LIBRARY : FIXTURE);
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'); let path = decodeURIComponent(url.pathname);
    log.push({ method: req.method, path, apikey: req.headers.apikey || null });
    if (path.startsWith('/mana/')) path = '/projects/menus/' + path.slice('/mana/'.length);     // halom.io serves the same folder at /mana/ (the /m/<slug> base)
    const send = (code, body, type, extra) => {
      let buf = Buffer.isBuffer(body) ? body : Buffer.from(body); const h = Object.assign({ 'Content-Type': type, 'Cache-Control': 'max-age=600', 'Access-Control-Allow-Origin': '*' }, extra || {});
      if (/^(text|application\/json)/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '') && buf.length > 512) { buf = gzipSync(buf); h['Content-Encoding'] = 'gzip'; }
      h['Content-Length'] = buf.length; res.writeHead(code, h); res.end(buf);
    };
    try {
      if (path === '/projects/menus/config.js') {
        if (opts.noConfig) return send(404, 'not found', 'text/plain; charset=utf-8');
        const origin = 'http://' + req.headers.host;
        return send(200, 'window.HALOM_MENUS_CONFIG = ' + JSON.stringify(Object.assign({ supabaseUrl: origin + '/stub', supabaseKey: KEY, shortBase: origin + '/m/', shortLive: true, viewPath: '../view/', genPath: '../gen/', stockPath: '../stock/', sitePath: '../' }, opts.config || {})) + ';', TYPES['.js']);
      }
      const rpc = /^\/stub\/rest\/v1\/rpc\/(open_menu|public_menu|track_item)$/.exec(path);
      if (rpc) {
        if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, content-type, accept', 'Access-Control-Allow-Methods': 'POST' }); return res.end(); }
        let body = ''; for await (const c of req) body += c;
        let args = {}; try { args = JSON.parse(body) || {}; } catch (e) { /* bad body */ }
        const json = (code, o) => send(code, JSON.stringify(o), TYPES['.json'], { 'Cache-Control': 'no-store' });
        if (req.method !== 'POST' || req.headers.apikey !== KEY) return json(401, { message: 'No API key found in request' });
        if (rpc[1] === 'open_menu' && opts.oldBackend) return json(404, { code: 'PGRST202', message: 'Could not find the function public.open_menu' });      // a backend from before v2
        calls.push({ fn: rpc[1], args });
        if (rpc[1] === 'track_item') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*' }); return res.end(); }
        const slug = args.p_slug;
        if (slug === 'paused') return json(200, { state: 'unavailable', business: { name: { he: 'אוליאה', en: 'Olea' } } });
        if (slug === 'broken') return json(500, { message: 'boom' });
        if (slug === 'flaky') { const n = (flaky.get(slug) || 0) + 1; flaky.set(slug, n); if (n === 1) return json(503, { message: 'try later' }); }
        if (MENUS[slug]) {
          if (slug === 'slow') await new Promise((r) => setTimeout(r, 1500));
          const dir = MENUS[slug], snap = JSON.parse(await readFile(join(ROOT, 'demo', dir, 'menu.json'), 'utf8')), abs = (u) => (u ? 'http://' + req.headers.host + PREFIX + 'demo/' + dir + '/' + u : u);
          snap.categories.forEach((c) => c.items.forEach((it) => { if (it.asset && it.asset.state !== 'stock') ['color', 'aux', 'thumb'].forEach((k) => { it.asset[k] = abs(it.asset[k]); }); }));
          if (opts.mutate) opts.mutate(snap, slug);
          return json(200, { state: 'ok', snapshot: snap });
        }
        return json(200, { state: 'not_found' });
      }
      if (/^\/m\/[^/]+\/?$/.test(path)) path = PREFIX + 'index.html';             // the halom.io rewrite for the diner short link
      if (path === '/projects/menus/' || path === '/projects/menus/index.html') return send(200, '<!doctype html><meta charset="utf-8"><title>Mana</title><h1 id="landing">Mana</h1>', TYPES['.html']);      // stands in for the product page
      let root = ROOT, rel;
      if (path.startsWith(STOCK)) { root = stockDir; rel = normalize(path.slice(STOCK.length)); }
      else if (path.startsWith(PREFIX)) rel = normalize(path.slice(PREFIX.length));
      else return send(404, 'not found', 'text/plain; charset=utf-8');
      if (rel === '.' || rel === '' || rel.endsWith('/')) rel = join(rel, 'index.html');
      if (rel.startsWith('..') || (root === ROOT && /(^|\/)(node_modules|\.git|test|tools|src|\.scratch)(\/|$)/.test(rel) && !opts.dev)) return send(404, 'not found', 'text/plain; charset=utf-8');
      const file = join(root, rel), st = await stat(file).catch(() => null);
      if (!st || !st.isFile()) return send(404, 'not found', 'text/plain; charset=utf-8');
      send(200, await readFile(file), TYPES[extname(file)] || 'application/octet-stream');
    } catch (e) { send(500, String(e && e.message), 'text/plain; charset=utf-8'); }
  });
  server.requests = log; server.calls = calls;
  return server;
}
export function listen(port = 0, opts) { const s = createServer(opts); return new Promise((res) => s.listen(port, '127.0.0.1', () => res({ server: s, port: s.address().port, origin: 'http://127.0.0.1:' + s.address().port, key: KEY }))); }

if (process.argv[1] === fileURLToPath(import.meta.url)) { const port = Number(process.argv[2]) || 8787; listen(port, { stock: 'library' }).then((s) => console.log('viewer:  ' + s.origin + PREFIX + '?demo=olea\nkiosk:   ' + s.origin + PREFIX + '?demo=kiosk\nshort:   ' + s.origin + '/m/olea')); }
