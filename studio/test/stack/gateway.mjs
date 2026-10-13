// One base URL like a Supabase project: /rest/v1 → PostgREST, /auth/v1 → GoTrue, /storage/v1 → the shim below,
// /functions/v1/menus-signup → a local copy of the sign-up function (same contract as BACKEND.md),
// /functions/v1/menus-ai → a scripted stand-in for the AI helpers (ai-standin.mjs).
// The storage shim keeps bytes on disk and rows in storage.objects, written THROUGH the caller's role and JWT claims,
// so the storage policies of 0001_core.sql decide who may read or write, exactly as in the hosted product.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { createAiStandIn } from './ai-standin.mjs';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
  'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,x-upsert,prefer,range,accept-profile,content-profile,cache-control,x-supabase-api-version,accept,x-retry-count',
  'access-control-expose-headers': 'content-range,content-length,content-type,x-total-count',
  'access-control-max-age': '600',
};

export function startGateway({ port, restPort, authPort, dbUrl, jwtSecret, serviceKey, anonKey, dataDir, log = () => {} }) {
  const pool = new pg.Pool({ connectionString: dbUrl, max: 6 });
  pool.on('error', () => {});            // idle connections are cut when the test database stops
  fs.mkdirSync(dataDir, { recursive: true });
  const signupHits = new Map();       // ip → timestamps
  const state = { signupMinElapsed: 1200, signupPerHour: 40 };

  const send = (res, status, body, headers = {}) => {
    const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    res.writeHead(status, { 'content-type': 'application/json', ...CORS, ...headers, 'content-length': buf.length });
    res.end(buf);
  };
  const storageErr = (res, status, error, message) => send(res, status === 404 ? 400 : status, { statusCode: String(status), error, message });
  const readBody = (req, limit = 40 * 1024 * 1024) => new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { n += c.length; if (n > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  function proxy(req, res, targetPort, newPath) {
    const headers = { ...req.headers, host: '127.0.0.1:' + targetPort };
    const up = http.request({ host: '127.0.0.1', port: targetPort, method: req.method, path: newPath, headers }, (ur) => {
      const h = { ...ur.headers };
      for (const k of Object.keys(h)) if (k.startsWith('access-control-')) delete h[k];
      res.writeHead(ur.statusCode, { ...h, ...CORS });
      ur.pipe(res);
    });
    up.on('error', (e) => send(res, 502, { message: 'upstream: ' + e.message }));
    req.pipe(up);
  }

  // ---- who is calling (same rule as the hosted gateway: a valid JWT in Authorization, else anonymous)
  function claimsOf(req) {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    if (!m) return { role: 'anon' };
    try { const c = jwt.verify(m[1], jwtSecret, { algorithms: ['HS256'] }); return c && c.role ? c : { role: 'anon' }; }
    catch { return null; }
  }
  async function asCaller(claims, fn) {
    const c = await pool.connect();
    try {
      await c.query('begin');
      const role = ['anon', 'authenticated', 'service_role'].includes(claims.role) ? claims.role : 'anon';
      await c.query('select set_config($1, $2, true), set_config($3, $4, true)', ['role', role, 'request.jwt.claims', JSON.stringify(claims)]);
      const out = await fn(c);
      await c.query('commit');
      return out;
    } catch (e) { try { await c.query('rollback'); } catch { /* connection gone */ } throw e; }
    finally { c.release(); }
  }
  const fileOf = (bucket, name) => path.join(dataDir, bucket, crypto.createHash('sha256').update(name).digest('hex'));
  const validName = (n) => typeof n === 'string' && n.length > 0 && n.length <= 1024 && !n.startsWith('/') && !n.includes('//') && !/(^|\/)\.\.?(\/|$)/.test(n);

  function parseMultipart(buf, contentType) {
    const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
    if (!m) return null;
    const boundary = Buffer.from('--' + (m[1] || m[2]));
    const parts = []; let pos = buf.indexOf(boundary);
    while (pos !== -1) {
      const next = buf.indexOf(boundary, pos + boundary.length);
      if (next === -1) break;
      let part = buf.subarray(pos + boundary.length + 2, next - 2);       // skip CRLF after the boundary, drop CRLF before the next
      const hEnd = part.indexOf('\r\n\r\n');
      if (hEnd !== -1) {
        const head = part.subarray(0, hEnd).toString('utf8'), body = part.subarray(hEnd + 4);
        const name = (/name="([^"]*)"/i.exec(head) || [])[1], filename = (/filename="([^"]*)"/i.exec(head) || [])[1];
        const type = (/content-type:\s*([^\r\n]+)/i.exec(head) || [])[1];
        parts.push({ name, filename, type, body });
      }
      pos = next;
    }
    return parts;
  }

  async function storage(req, res, url) {
    const p = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ''));
    const seg = p.split('/').filter(Boolean);
    const claims = claimsOf(req);
    if (claims === null) return storageErr(res, 400, 'Unauthorized', 'jwt malformed');
    const bucketRow = async (id) => (await pool.query('select * from storage.buckets where id = $1', [id])).rows[0];
    const serve = (res2, row, bucket) => {
      const f = fileOf(bucket, row.name);
      if (!fs.existsSync(f)) return storageErr(res2, 404, 'not_found', 'Object not found');
      const buf = fs.readFileSync(f);
      res2.writeHead(200, { ...CORS, 'content-type': (row.metadata && row.metadata.mimetype) || 'application/octet-stream', 'content-length': buf.length, 'cache-control': 'max-age=3600', etag: '"' + (row.metadata && row.metadata.eTag || '') + '"' });
      res2.end(buf);
    };

    if (seg[0] !== 'object') return storageErr(res, 404, 'not_found', 'route');

    // public object
    if (seg[1] === 'public' && (req.method === 'GET' || req.method === 'HEAD')) {
      const bucket = seg[2], name = seg.slice(3).join('/');
      const b = await bucketRow(bucket);
      if (!b || !b.public) return storageErr(res, 404, 'Bucket not found', 'Bucket not found');
      const row = (await pool.query('select name, metadata from storage.objects where bucket_id = $1 and name = $2', [bucket, name])).rows[0];
      if (!row) return storageErr(res, 404, 'not_found', 'Object not found');
      return serve(res, row, bucket);
    }
    // signed URLs: create
    if (seg[1] === 'sign' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const bucket = seg[2], expiresIn = Math.max(1, Math.min(Number(body.expiresIn) || 60, 604800));
      const sign = (name) => '/object/sign/' + bucket + '/' + name.split('/').map(encodeURIComponent).join('/') + '?token=' + jwt.sign({ url: bucket + '/' + name }, jwtSecret, { expiresIn });
      if (seg.length > 3) {
        const name = seg.slice(3).join('/');
        const row = await asCaller(claims, async (c) => (await c.query('select name from storage.objects where bucket_id = $1 and name = $2', [bucket, name])).rows[0]);
        if (!row) return storageErr(res, 404, 'not_found', 'Object not found');
        return send(res, 200, { signedURL: sign(name) });
      }
      const paths = Array.isArray(body.paths) ? body.paths : [];
      const rows = await asCaller(claims, async (c) => (await c.query('select name from storage.objects where bucket_id = $1 and name = any($2)', [bucket, paths])).rows);
      const have = new Set(rows.map((r) => r.name));
      return send(res, 200, paths.map((n) => (have.has(n) ? { error: null, path: n, signedURL: sign(n) } : { error: 'Either the object does not exist or you do not have access to it', path: n, signedURL: null })));
    }
    // signed URLs: read
    if (seg[1] === 'sign' && (req.method === 'GET' || req.method === 'HEAD')) {
      const bucket = seg[2], name = seg.slice(3).join('/');
      try { const t = jwt.verify(url.searchParams.get('token') || '', jwtSecret); if (t.url !== bucket + '/' + name) throw new Error('mismatch'); }
      catch { return storageErr(res, 400, 'InvalidJWT', 'invalid or expired token'); }
      const row = (await pool.query('select name, metadata from storage.objects where bucket_id = $1 and name = $2', [bucket, name])).rows[0];
      if (!row) return storageErr(res, 404, 'not_found', 'Object not found');
      return serve(res, row, bucket);
    }
    // copy (also across buckets): the caller must be able to read the source and insert the destination
    if (seg[1] === 'copy' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const from = body.bucketId, to = body.destinationBucket || body.bucketId, src = body.sourceKey, dst = body.destinationKey;
      if (!validName(src) || !validName(dst)) return storageErr(res, 400, 'InvalidKey', 'Invalid key');
      const toBucket = await bucketRow(to);
      if (!toBucket || !(await bucketRow(from))) return storageErr(res, 404, 'Bucket not found', 'Bucket not found');
      try {
        const row = await asCaller(claims, async (c) => {
          const s = (await c.query('select name, metadata from storage.objects where bucket_id = $1 and name = $2', [from, src])).rows[0];
          if (!s) return null;
          const size = Number(s.metadata && s.metadata.size) || 0, mime = s.metadata && s.metadata.mimetype;
          if (toBucket.file_size_limit && size > Number(toBucket.file_size_limit)) throw Object.assign(new Error('The object exceeded the maximum allowed size'), { status: 413, tag: 'Payload too large' });
          if (toBucket.allowed_mime_types && !toBucket.allowed_mime_types.includes(mime)) throw Object.assign(new Error('mime type ' + mime + ' is not supported'), { status: 415, tag: 'invalid_mime_type' });
          await c.query('insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ($1, $2, $3, $4, $5)', [to, dst, claims.sub || null, claims.sub || null, s.metadata]);
          return s;
        });
        if (!row) return storageErr(res, 404, 'not_found', 'Object not found');
        fs.mkdirSync(path.dirname(fileOf(to, dst)), { recursive: true });
        fs.copyFileSync(fileOf(from, src), fileOf(to, dst));
        return send(res, 200, { Key: to + '/' + dst });
      } catch (e) { return pgErr(res, e); }
    }
    // list
    if (seg[1] === 'list' && req.method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const bucket = seg[2], prefix = String(body.prefix || '').replace(/^\/+|\/+$/g, '');
      const rows = await asCaller(claims, async (c) => (await c.query('select name, id, updated_at, created_at, metadata from storage.objects where bucket_id = $1 and name like $2 order by name limit $3',
        [bucket, (prefix ? prefix.replace(/[%_\\]/g, '\\$&') + '/' : '') + '%', Math.min(Number(body.limit) || 100, 1000)])).rows);
      const out = new Map();
      for (const r of rows) {
        const rest = r.name.slice(prefix ? prefix.length + 1 : 0), first = rest.split('/')[0];
        if (rest.includes('/')) { if (!out.has(first)) out.set(first, { name: first, id: null, updated_at: null, created_at: null, metadata: null }); }
        else out.set(first, { name: first, id: r.id, updated_at: r.updated_at, created_at: r.created_at, metadata: r.metadata });
      }
      return send(res, 200, [...out.values()]);
    }
    // remove many
    if (seg.length === 2 && req.method === 'DELETE') {
      const body = JSON.parse((await readBody(req)).toString('utf8') || '{}');
      const bucket = seg[1], prefixes = Array.isArray(body.prefixes) ? body.prefixes : [];
      const rows = await asCaller(claims, async (c) => (await c.query('delete from storage.objects where bucket_id = $1 and name = any($2) returning name, id, bucket_id, metadata', [bucket, prefixes])).rows);
      for (const r of rows) fs.rmSync(fileOf(bucket, r.name), { force: true });
      return send(res, 200, rows);
    }
    // authenticated download
    if (req.method === 'GET' || req.method === 'HEAD') {
      const bucket = seg[1] === 'authenticated' ? seg[2] : seg[1], name = seg.slice(seg[1] === 'authenticated' ? 3 : 2).join('/');
      const row = await asCaller(claims, async (c) => (await c.query('select name, metadata from storage.objects where bucket_id = $1 and name = $2', [bucket, name])).rows[0]);
      if (!row) return storageErr(res, 404, 'not_found', 'Object not found');
      return serve(res, row, bucket);
    }
    // upload / replace
    if (req.method === 'POST' || req.method === 'PUT') {
      const bucket = seg[1], name = seg.slice(2).join('/');
      if (!validName(name)) return storageErr(res, 400, 'InvalidKey', 'Invalid key: ' + name);
      const b = await bucketRow(bucket);
      if (!b) return storageErr(res, 404, 'Bucket not found', 'Bucket not found');
      let raw;
      try { raw = await readBody(req); } catch (e) { return storageErr(res, 413, 'Payload too large', 'The object exceeded the maximum allowed size'); }
      let body = raw, mime = (req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim(), cache = req.headers['cache-control'] || 'no-cache';
      if (/^multipart\/form-data/i.test(req.headers['content-type'] || '')) {
        const parts = parseMultipart(raw, req.headers['content-type']) || [];
        const file = parts.find((x) => x.filename !== undefined) || parts.find((x) => x.name === '');
        if (!file) return storageErr(res, 400, 'invalid_request', 'no file in the form');
        body = file.body; mime = (file.type || 'application/octet-stream').split(';')[0].trim();
        const cc = parts.find((x) => x.name === 'cacheControl'); if (cc) cache = 'max-age=' + cc.body.toString('utf8');
      }
      if (b.file_size_limit && body.length > Number(b.file_size_limit)) return storageErr(res, 413, 'Payload too large', 'The object exceeded the maximum allowed size');
      if (b.allowed_mime_types && !b.allowed_mime_types.includes(mime)) return storageErr(res, 415, 'invalid_mime_type', 'mime type ' + mime + ' is not supported');
      const upsert = req.method === 'PUT' || String(req.headers['x-upsert']) === 'true';
      const meta = { size: body.length, mimetype: mime, cacheControl: cache, eTag: crypto.createHash('md5').update(body).digest('hex'), lastModified: new Date().toISOString() };
      try {
        const row = await asCaller(claims, async (c) => {
          const q = upsert
            ? 'insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ($1, $2, $3, $4, $5) on conflict (bucket_id, name) do update set metadata = excluded.metadata, updated_at = now() returning id'
            : 'insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ($1, $2, $3, $4, $5) returning id';
          return (await c.query(q, [bucket, name, claims.sub || null, claims.sub || null, meta])).rows[0];
        });
        fs.mkdirSync(path.dirname(fileOf(bucket, name)), { recursive: true });
        fs.writeFileSync(fileOf(bucket, name), body);
        return send(res, 200, { Id: row.id, Key: bucket + '/' + name });
      } catch (e) { return pgErr(res, e); }
    }
    return storageErr(res, 404, 'not_found', 'route');
  }
  function pgErr(res, e) {
    if (e.code === '42501') return storageErr(res, 403, 'Unauthorized', 'new row violates row-level security policy');
    if (e.code === '23505') return storageErr(res, 409, 'Duplicate', 'The resource already exists');
    if (e.status) return storageErr(res, e.status, e.tag || 'error', e.message);
    log('storage error', e);
    return storageErr(res, 500, 'internal', e.message);
  }

  // ---- menus-signup (local copy of the edge function's contract)
  async function signup(req, res) {
    let b; try { b = JSON.parse((await readBody(req, 20000)).toString('utf8')); } catch { return send(res, 200, { ok: false, code: 'failed' }); }
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim() + '|' + (req.headers['x-test-client'] || '');
    const now = Date.now(), hits = (signupHits.get(ip) || []).filter((t) => now - t < 3600e3);
    if (hits.length >= state.signupPerHour) return send(res, 200, { ok: false, code: 'rate_limited' });
    hits.push(now); signupHits.set(ip, hits);
    // the same cleaning as functions/menus-signup/index.ts
    const email = String(b.email || '').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\u00AD]/g, '').replace(/\uFF20/g, '@').replace(/[\uFF0E\u3002]/g, '.').trim().replace(/\.+$/, '').toLowerCase();
    const password = String(b.password || '');
    if (String(b.hp || '') !== '' || (typeof b.elapsed_ms === 'number' && b.elapsed_ms < state.signupMinElapsed)) return send(res, 200, { ok: false, code: 'spam' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$/.test(email) || email.length > 200) return send(res, 200, { ok: false, code: 'invalid_email' });
    if (password.length < 8 || password.length > 72) return send(res, 200, { ok: false, code: 'weak_password' });
    try {
      const r = await fetch('http://127.0.0.1:' + authPort + '/admin/users', { method: 'POST', headers: { authorization: 'Bearer ' + serviceKey, 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, email_confirm: true }) });
      if (r.ok) return send(res, 200, { ok: true });
      const j = await r.json().catch(() => ({}));
      if (r.status === 422 || /already/i.test(j.msg || j.message || j.error_code || '')) return send(res, 200, { ok: false, code: 'exists' });
      if (j.error_code === 'email_address_invalid' || /email address .* is invalid/i.test(j.msg || '')) return send(res, 200, { ok: false, code: 'email_rejected' });
      if (/validate email/i.test(j.msg || '')) return send(res, 200, { ok: false, code: 'invalid_email' });
      log('signup upstream', r.status, j);
      return send(res, 200, { ok: false, code: 'failed' });
    } catch (e) { log('signup', e); return send(res, 200, { ok: false, code: 'failed' }); }
  }

  const ai = createAiStandIn({ restPort, anonKey, cors: CORS, readBody, log });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
      if (url.pathname.startsWith('/rest/v1/')) return proxy(req, res, restPort, req.url.replace(/^\/rest\/v1/, ''));
      if (url.pathname === '/rest/v1') return proxy(req, res, restPort, '/');
      if (url.pathname.startsWith('/auth/v1/')) return proxy(req, res, authPort, req.url.replace(/^\/auth\/v1/, ''));
      if (url.pathname.startsWith('/storage/v1/')) return await storage(req, res, url);
      if (url.pathname === '/functions/v1/menus-signup' && req.method === 'POST') return await signup(req, res);
      if (url.pathname === '/functions/v1/menus-ai' && req.method === 'POST') return await ai.handle(req, res);
      if (url.pathname === '/__test/config' && req.method === 'POST') {
        const patch = JSON.parse((await readBody(req)).toString('utf8') || '{}');
        if (patch.ai === 'reset') ai.reset(); else if (patch.ai) ai.configure(patch.ai);
        delete patch.ai; Object.assign(state, patch); signupHits.clear();
        return send(res, 200, { ...state, ai: ai.state });
      }
      if (url.pathname === '/__test/ai' && req.method === 'GET') return send(res, 200, ai.calls);
      return send(res, 404, { message: 'no route' });
    } catch (e) { log('gateway', e); if (!res.headersSent) send(res, 500, { message: e.message }); else res.end(); }
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve({ server, pool, close: async () => { server.close(); server.closeAllConnections(); await pool.end(); } })); });
}

// ---- static files: the app as it will sit on GitHub Pages, under a path prefix
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.py': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.zip': 'application/zip', '.ico': 'image/x-icon' };
export function startStatic({ port, prefix, mounts, virtual = {} }) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let p; try { p = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
    if (!p.startsWith(prefix)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not under ' + prefix); }
    const rel = p.slice(prefix.length);
    if (virtual[rel] !== undefined) { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' }); return res.end(virtual[rel]); }
    const first = rel.split('/')[0], root = mounts[first];
    if (!root) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    if (rel === first) { res.writeHead(301, { location: prefix + first + '/' + url.search }); return res.end(); }
    let file = path.join(root, rel.slice(first.length + 1));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (file.endsWith(path.sep) || (fs.existsSync(file) && fs.statSync(file).isDirectory())) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
    const st = fs.statSync(file), type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const head = { 'content-type': type, 'accept-ranges': 'bytes', 'cache-control': 'no-cache', 'last-modified': st.mtime.toUTCString() };
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const a = Number(range[1]), b = range[2] ? Math.min(Number(range[2]), st.size - 1) : st.size - 1;
      if (a >= st.size) { res.writeHead(416, { 'content-range': 'bytes */' + st.size }); return res.end(); }
      res.writeHead(206, { ...head, 'content-range': `bytes ${a}-${b}/${st.size}`, 'content-length': b - a + 1 });
      return req.method === 'HEAD' ? res.end() : fs.createReadStream(file, { start: a, end: b }).pipe(res);
    }
    res.writeHead(200, { ...head, 'content-length': st.size });
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => resolve({ server, close: () => { server.close(); server.closeAllConnections(); } })); });   // a taken port fails loudly instead of hanging
}
