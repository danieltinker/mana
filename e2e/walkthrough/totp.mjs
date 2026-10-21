// Halom's second step (MFA, B118) for a walkthrough on a database that asks staff for it (`staff_require_aal2`): a TOTP
// code computed here (RFC 6238: HMAC-SHA1, 30-second steps, 6 digits; node:crypto only). The walkthrough types it on
// the back office's own second-step screen; before anything is written, its checks complete the step the same way
// through Supabase Auth's challenge and verify (`secondStep`). The secret comes from private/demo.env
// (MANA_DEMO_STAFF_TOTP_SECRET); neither it nor a code is ever logged. The walkthrough never enrolls a factor: the
// account's authenticator is set up once, by its owner, on the back office's screen (m028).
import crypto from 'node:crypto';
import { Api } from '@mana/sim';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** RFC 4648 base32 (the form an authenticator app is given a secret in): spaces, dashes and padding ignored, any case. */
export function base32Decode(text) {
  const s = String(text).toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0, value = 0;
  const out = [];
  for (const c of s) {
    const v = BASE32.indexOf(c);
    if (v < 0) throw new Error('the TOTP secret is not base32');
    value = (value << 5) | v; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

/**
 * The TOTP code at `time` (RFC 6238 over RFC 4226's HOTP).
 * @param {string | Buffer} secret  base32 text, or the key's bytes
 * @param {{ time?: number, step?: number, digits?: number }} o  time in ms since the epoch; step in seconds
 */
export function totp(secret, { time = Date.now(), step = 30, digits = 6 } = {}) {
  const key = Buffer.isBuffer(secret) ? secret : base32Decode(secret);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / step)));
  const mac = crypto.createHmac('sha1', key).update(counter).digest();
  const at = mac[mac.length - 1] & 0x0f;
  const n = (mac.readUInt32BE(at) & 0x7fffffff) % 10 ** digits;
  return String(n).padStart(digits, '0');
}

/** What is left of the current 30-second step, in ms: a code typed with less than a few seconds left may expire on
 * its way, so the caller waits for the next step. */
export const stepLeftMs = (time = Date.now(), step = 30) => step * 1000 - (time % (step * 1000));

/** The staff member's verified TOTP factor, or null (Supabase Auth's user record, with their own token). */
export async function totpFactor(target, accessToken) {
  const api = new Api({ url: target.apiUrl, apikey: target.anonKey, token: accessToken });
  const user = await api.request('GET', '/auth/v1/user', { what: 'the staff member\'s factors' });
  return (user.factors ?? []).find((f) => f.factor_type === 'totp' && f.status === 'verified') ?? null;
}

/**
 * Completes the second step for a signed-in staff member: their verified TOTP factor, a challenge, the code. Returns the
 * aal2 session as Supabase Auth gives it (access_token, refresh_token, expires_in, expires_at, token_type, user).
 * A code is good for its 30 seconds; if the answer is "invalid" right at a step's edge, the next step's code is tried.
 * @param {{ apiUrl: string, anonKey: string }} target
 * @param {string} accessToken  the password session's token (aal1)
 * @param {string} secret       the factor's base32 secret
 */
export async function secondStep(target, accessToken, secret) {
  const api = new Api({ url: target.apiUrl, apikey: target.anonKey, token: accessToken });
  const factor = await totpFactor(target, accessToken);
  if (!factor) throw new Error('Halom\'s account has no second step set up (m028)');
  if (stepLeftMs() < 5000) await new Promise((r) => setTimeout(r, stepLeftMs() + 500));
  for (let attempt = 0; ; attempt++) {
    const challenge = await api.request('POST', `/auth/v1/factors/${factor.id}/challenge`, { body: {}, what: 'the second step\'s challenge' });
    try {
      const session = await api.request('POST', `/auth/v1/factors/${factor.id}/verify`, { body: { challenge_id: challenge.id, code: totp(secret) }, what: 'the second step' });
      if (!session?.access_token) throw new Error('the second step gave no session');
      return session;
    } catch (e) {
      // the code itself is never part of a message; at a step's edge, wait for the next one and try once more
      if (attempt > 0) throw new Error(`the second step was refused (${e.status ?? ''} ${e.code ?? ''}): check MANA_DEMO_STAFF_TOTP_SECRET`.replace(/\s+/g, ' '));
      await new Promise((r) => setTimeout(r, (30 - (Math.floor(Date.now() / 1000) % 30) + 1) * 1000));
    }
  }
}
