// One base URL like a Supabase project: /rest/v1 → PostgREST, /auth/v1 → GoTrue. Adapted from
// apps/studio/test/stack/gateway.mjs (the router and CORS), without the old schema's storage shim and edge functions.
//
// What it does like the hosted gateway:
//   * every /rest/v1 and /auth/v1 request needs an `apikey` header holding the anon or the service key (401 otherwise);
//     without an Authorization header the apikey is sent on as the bearer token (what supabase-js does);
//   * the caller's address reaches the database the way the hosted edge puts it there: `cf-connecting-ip` is set by the
//     gateway (a caller's own cf-connecting-ip / x-real-ip are dropped) and the address is appended to X-Forwarded-For.
// What is local only:
//   * `x-sim-client-ip` (honoured only when the stack was started with simClientIp, the default): the simulator's guest
//     bots each get an address of their own, as phones would, so per-source caps behave as they would with real guests.
//     The header itself never reaches PostgREST.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
  'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,x-upsert,prefer,range,accept-profile,content-profile,cache-control,x-supabase-api-version,accept,x-retry-count',
  'access-control-expose-headers': 'content-range,content-length,content-type,x-total-count',
  'access-control-max-age': '600',
};
const DROP = new Set(['cf-connecting-ip', 'x-real-ip', 'x-sim-client-ip', 'host', 'connection']);

export function startGateway({ port, restPort, authPort, anonKey, serviceKey, simClientIp = true, log = () => {} }) {
  const keys = new Set([anonKey, serviceKey]);
  const send = (res, status, body) => {
    const buf = Buffer.from(JSON.stringify(body));
    res.writeHead(status, { 'content-type': 'application/json', ...CORS, 'content-length': buf.length });
    res.end(buf);
  };

  function proxy(req, res, targetPort, newPath) {
    const headers = {};
    for (const [k, v] of Object.entries(req.headers)) if (!DROP.has(k)) headers[k] = v;
    const sim = simClientIp ? String(req.headers['x-sim-client-ip'] || '').trim() : '';
    const peer = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    const ip = /^[0-9a-f.:]{3,45}$/i.test(sim) ? sim : peer;
    headers['cf-connecting-ip'] = ip;
    headers['x-forwarded-for'] = req.headers['x-forwarded-for'] ? `${req.headers['x-forwarded-for']}, ${ip}` : ip;
    if (!headers.authorization) headers.authorization = 'Bearer ' + req.headers.apikey;
    headers.host = '127.0.0.1:' + targetPort;
    const up = http.request({ host: '127.0.0.1', port: targetPort, method: req.method, path: newPath, headers }, (ur) => {
      const h = { ...ur.headers };
      for (const k of Object.keys(h)) if (k.startsWith('access-control-')) delete h[k];
      res.writeHead(ur.statusCode, { ...h, ...CORS });
      ur.pipe(res);
    });
    up.on('error', (e) => { log('upstream', e.message); if (!res.headersSent) send(res, 502, { message: 'upstream: ' + e.message }); else res.end(); });
    req.pipe(up);
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
      const rest = url.pathname === '/rest/v1' || url.pathname.startsWith('/rest/v1/');
      const auth = url.pathname.startsWith('/auth/v1/');
      if (!rest && !auth) return send(res, 404, { message: 'no route' });
      if (url.pathname === '/auth/v1/health') return proxy(req, res, authPort, '/health');
      if (!req.headers.apikey) return send(res, 401, { message: 'No API key found in request', hint: 'No `apikey` request header or url param was found.' });
      if (!keys.has(req.headers.apikey)) return send(res, 401, { message: 'Invalid API key', hint: 'Double check your Supabase `anon` or `service_role` API key.' });
      if (rest) return proxy(req, res, restPort, req.url.replace(/^\/rest\/v1/, '') || '/');
      return proxy(req, res, authPort, req.url.replace(/^\/auth\/v1/, ''));
    } catch (e) { log('gateway', e); if (!res.headersSent) send(res, 500, { message: e.message }); else res.end(); }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, close: () => new Promise((r) => { server.close(() => r()); server.closeAllConnections(); }) }));
  });
}

// ---- static files (the e2e harness serves _site and the apps through it), under a path prefix
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.mp4': 'video/mp4' };

/** mounts: { '': dir } serves dir at the prefix; { name: dir } at prefix + name/. virtual: { 'config.js': text }.
    shortLinks: /m/<slug> (and /m/<slug>/) serve prefix + view/index.html, as halom.io and tools/serve-site.mjs do, so a
    page's "Open the menu" and "Share" links (config.shortBase + slug) lead somewhere in a test too. */
export function startStatic({ port, prefix = '/', mounts, virtual = {}, shortLinks = false }) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let p; try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
    if (shortLinks && /^\/m\/[^/]+\/?$/.test(p)) p = prefix + 'view/index.html';
    if (!p.startsWith(prefix)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not under ' + prefix); }
    const rel = p.slice(prefix.length);
    // a virtual folder ("ops/") is its index page
    if (virtual[rel] !== undefined) { res.writeHead(200, { 'content-type': TYPES[rel.endsWith('/') ? '.html' : path.extname(rel)] || 'text/plain', 'cache-control': 'no-store' }); return res.end(virtual[rel]); }
    const first = rel.split('/')[0];
    const [root, inner] = mounts[first] !== undefined && first !== '' ? [mounts[first], rel.slice(first.length + 1)] : [mounts[''], rel];
    if (!root) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    let file = path.join(root, inner);
    if (!file.startsWith(path.resolve(root))) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    const st = fs.statSync(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-cache' });
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ server, close: () => new Promise((r) => { server.close(() => r()); server.closeAllConnections(); }) }));
  });
}
