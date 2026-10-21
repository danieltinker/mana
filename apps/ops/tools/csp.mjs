// The back office's Content-Security-Policy for a demo or local build. Production's index.html is never changed (its
// v1 policy stays byte-identical until the cutover, B14). A demo or local build adds the environment's own menu
// picture storage, and only it, to img-src: the Supabase project's public bucket `menu-public`
// (<origin>/storage/v1/object/public/menu-public/, the database's public_base), so v2's "The menu to approve" shows the
// revision's pictures. Nothing else in the policy changes; a picture from anywhere else (another bucket of the same
// project included) stays blocked, and the panel says it cannot be shown. The platform's settings step
// (tools/site-env.mjs) calls this for demo and local builds; the sim-stack e2e calls it for its local build.
//
//   node tools/csp.mjs <index.html> <origin>     rewrites that file in place
import { readFileSync, writeFileSync } from 'node:fs';

const META = /(<meta http-equiv="Content-Security-Policy" content=")([^"]*)(")/;
/** Where a menu's pictures live in a Supabase project (src/v2/model.ts STORAGE_PATH says the same). */
export const STORAGE_PATH = '/storage/v1/object/public/menu-public/';

/** The menu picture storage of an http(s) origin (the environment's Supabase project). */
export function storageOf(origin) {
  const u = new URL(origin);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error(`not an http(s) origin: ${origin}`);
  return u.origin + STORAGE_PATH;
}

/** The policy of `html` with `origin`'s menu picture storage added to img-src. */
export function withStorageImages(html, origin) {
  const source = storageOf(origin);
  if (!META.test(html)) throw new Error('no Content-Security-Policy meta in this page');
  return html.replace(META, (_m, a, policy, z) => {
    const parts = policy.split(';').map((p) => p.trim()).filter(Boolean);
    const i = parts.findIndex((p) => p.split(/\s+/)[0] === 'img-src');
    if (i < 0) throw new Error('the policy has no img-src');
    const tokens = parts[i].split(/\s+/);
    if (!tokens.includes(source)) parts[i] = [...tokens, source].join(' ');
    return `${a}${parts.join('; ')}${z}`;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, origin] = process.argv.slice(2);
  if (!file || !origin) { console.error('usage: node tools/csp.mjs <index.html> <origin>'); process.exit(2); }
  writeFileSync(file, withStorageImages(readFileSync(file, 'utf8'), origin));
}
