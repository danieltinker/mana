// HS256 JSON Web Tokens with node:crypto only (the stack mints its own anon and service keys with a LOCAL secret).
import crypto from 'node:crypto';

// LOCAL ONLY. Never a project's secret: it signs the stack's own anon and service keys and GoTrue's sessions. Kept in
// this module, which needs no package, so tools/env.mjs can verify the local anon key on a machine without the stack.
export const JWT_SECRET = 'sim-local-only-secret-not-for-any-project-0123456789';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function signJwt(payload, secret, { expiresInSec = 10 * 365 * 24 * 3600, issuedAt = null } = {}) {
  const now = issuedAt ?? Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iat: now, exp: now + expiresInSec, ...payload }));
  const sig = b64url(crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest());
  return `${head}.${body}.${sig}`;
}

/** The payload of a valid token, or null (bad signature, bad shape, expired). */
export function verifyJwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const want = b64url(crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest());
  const a = Buffer.from(want), b = Buffer.from(parts[2]);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const head = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (head.alg !== 'HS256') return null;
    const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (typeof p.exp === 'number' && p.exp < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}

/** The payload without checking the signature (to read `sub` from a token GoTrue issued). */
export function decodeJwt(token) {
  try {
    return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
