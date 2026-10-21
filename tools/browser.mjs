/* The headless Chromium the repository's browser checks drive (e2e/, tools/check-old-phones.mjs): playwright-core,
   found the way the apps' browser tests find it, and the browser binary (CHROME). The browser may reach 127.0.0.1
   only: no proxy, and every other host fails to resolve. */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const ARGS = ['--no-sandbox', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost',
  '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-pings'];

/** playwright-core, found the way the apps' browser tests find it: this workspace, the apps' installs, the machine's tools. */
export function playwright() {
  const tries = [import.meta.url, path.join(ROOT, 'e2e/package.json'), path.join(ROOT, 'apps/ops/package.json'), path.join(ROOT, 'apps/studio/package.json'), '/opt/npm-tools/node_modules/'];
  for (const from of tries) {
    try { return createRequire(from)('playwright-core'); } catch { /* next */ }
  }
  throw new Error('playwright-core not found (npm ci at the root installs it for apps/ops and apps/studio)');
}
