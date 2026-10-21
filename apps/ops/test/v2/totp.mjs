// TOTP for the tests (RFC 6238 over RFC 4226: HMAC-SHA1, 30-second steps, 6 digits), node:crypto only: the stub's
// Supabase Auth checks codes with it, and the browser and e2e tests compute the code an authenticator app would show.
import crypto from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32, as an authenticator app is given a secret (no padding). */
export function base32Encode(bytes) {
  let bits = 0, value = 0, out = '';
  for (const b of bytes) {
    value = (value << 8) | b; bits += 8;
    while (bits >= 5) { out += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

/** base32 back to bytes: spaces, dashes and padding ignored, any case. */
export function base32Decode(text) {
  const s = String(text).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const c of s) {
    const v = BASE32.indexOf(c);
    if (v < 0) throw new Error('not base32');
    value = (value << 5) | v; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

/** A new secret, as Supabase Auth makes one (20 random bytes, base32). */
export const newSecret = () => base32Encode(crypto.randomBytes(20));

/** The code at `time` (ms since the epoch). */
export function totp(secret, time = Date.now(), { step = 30, digits = 6 } = {}) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / step)));
  const mac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const at = mac[mac.length - 1] & 0x0f;
  return String((mac.readUInt32BE(at) & 0x7fffffff) % 10 ** digits).padStart(digits, '0');
}

/** A code another 30-second step gives (never the one now): what a "wrong code" test types. */
export function wrongCode(secret, time = Date.now()) {
  const now = totp(secret, time);
  for (let k = 3; ; k++) { const c = totp(secret, time - k * 30_000); if (c !== now && c !== totp(secret, time - 30_000) && c !== totp(secret, time + 30_000)) return c; }
}
