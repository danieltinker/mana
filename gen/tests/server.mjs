// Test static server that behaves like GitHub Pages where it matters to the generator:
// path prefix, Range requests, gzip for text/wasm, Cache-Control: max-age=600, no COOP/COEP headers.
// Extras for tests: overlay roots, request log, fault injection (cut a response short, or answer 5xx), throttling.
//   node tests/server.mjs [--port 8791] [--gzip] [--mount /prefix=dir[,dir2] ...]     (default: this folder's parent under PREFIX)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8', json: 'application/json',
  wasm: 'application/wasm', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', py: 'text/x-python', css: 'text/css', zip: 'application/zip' };
const GZ = new Set(['html', 'js', 'mjs', 'json', 'wasm', 'py', 'css']);

export function startServer({ port = 0, mounts = [], gzip = false } = {}) {
  const log = [];
  let faults = [], bps = 0;
  const gzCache = new Map();
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/__log') {
      const body = JSON.stringify(log);
      if (u.searchParams.get('clear')) log.length = 0;
      return res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(body);
    }
    if (u.pathname === '/__fault') {
      if (u.searchParams.get('clear')) faults = [];
      else faults.push({ match: u.searchParams.get('match'), after: +(u.searchParams.get('after') || 0), times: +(u.searchParams.get('times') || 1), status: +(u.searchParams.get('status') || 0) });
      return res.writeHead(200, { 'cache-control': 'no-store' }).end('ok');
    }
    if (u.pathname === '/__throttle') { bps = +(u.searchParams.get('bps') || 0); return res.writeHead(200).end('ok'); }
    let file = null;
    const pn = decodeURIComponent(u.pathname);
    for (const m of mounts) {
      if (pn === m.prefix || pn.startsWith(m.prefix + '/')) {
        let rel = pn.slice(m.prefix.length).replace(/^\/+/, '');
        if (rel === '' || rel.endsWith('/')) rel += 'index.html';
        for (const root of m.roots) {
          const p = path.join(root, rel);
          if (p.startsWith(root) && fs.existsSync(p) && fs.statSync(p).isFile()) { file = p; break; }
        }
        if (file) break;
      }
    }
    const entry = { method: req.method, url: req.url, range: req.headers.range || null, status: 0 };
    log.push(entry);
    if (!file) { entry.status = 404; return res.writeHead(404).end('not found'); }
    const ext = file.split('.').pop().toLowerCase();
    const fault = faults.find((f) => f.times > 0 && req.url.includes(f.match));
    if (fault) fault.times--;
    if (fault && fault.status) { entry.status = fault.status; return res.writeHead(fault.status).end('fault'); }
    const size = fs.statSync(file).size;
    const head = { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'max-age=600', 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' };
    let start = 0, end = size - 1, status = 200;
    const rg = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (rg) {
      start = +rg[1]; end = rg[2] ? Math.min(+rg[2], size - 1) : size - 1; status = 206;
      if (start >= size) { entry.status = 416; return res.writeHead(416, { 'content-range': `bytes */${size}` }).end(); }
      head['content-range'] = `bytes ${start}-${end}/${size}`;
    }
    entry.status = status;
    const send = (buf) => {
      if (fault && fault.after >= 0 && !fault.status) {               // cut the response short, like a dropped connection
        res.writeHead(status, head);
        // send the first part, give the client time to read it, then drop the connection
        res.write(buf.subarray(0, Math.min(fault.after, buf.length)), () => setTimeout(() => res.socket.destroy(), 400));
        entry.status = -status;
        return;
      }
      if (!bps) { res.writeHead(status, head); return res.end(buf); }
      res.writeHead(status, head);
      let o = 0;
      const step = Math.max(1024, Math.floor(bps / 20));
      const t = setInterval(() => {
        if (res.destroyed) return clearInterval(t);
        res.write(buf.subarray(o, o + step)); o += step;
        if (o >= buf.length) { clearInterval(t); res.end(); }
      }, 50);
    };
    if (gzip && !rg && GZ.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      let z = gzCache.get(file);
      if (!z) { z = zlib.gzipSync(fs.readFileSync(file), { level: 6 }); gzCache.set(file, z); }
      head['content-encoding'] = 'gzip'; head['content-length'] = z.length; head.vary = 'Accept-Encoding';
      return send(z);
    }
    const buf = fs.readFileSync(file).subarray(start, end + 1);
    head['content-length'] = buf.length;
    send(buf);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port, log, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) })));
}

export function parseMounts(specs) {
  return specs.map((s) => { const [prefix, roots] = s.split('='); return { prefix: prefix.replace(/\/+$/, ''), roots: roots.split(',').map((r) => path.resolve(process.cwd(), r)) }; });
}
export const PREFIX = '/halom-projects/projects/menus/gen';
export const GEN = path.resolve(HERE, '..');
export const shipMounts = () => [{ prefix: PREFIX, roots: [GEN] }];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const get = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const ms = args.flatMap((a, i) => (a === '--mount' ? [args[i + 1]] : []));
  const s = await startServer({ port: +get('--port', 8791), mounts: ms.length ? parseMounts(ms) : shipMounts(), gzip: args.includes('--gzip') });
  console.log(`http://127.0.0.1:${s.port}${PREFIX}/test.html`);
}
