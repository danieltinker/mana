/* One still per live look for the gallery (apps/view/looks/): the Olea demo in that look on a phone frame (390×844), the table
   settled on the first dish, saved as apps/view/looks/img/<id>.webp at 60 kB or less. Headless Chromium with software WebGL,
   through the view's own test API (?test=1, __mana.settle()); the local server is apps/view/tools/serve.mjs. Nothing leaves this machine.

     node templates/tools/stills.mjs [id …]          all live looks, or the ones named
   Takes the shared browser lock yourself:  flock /tmp/mana-browser.lock node templates/tools/stills.mjs */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..'), VIEW = join(ROOT, 'apps', 'view'), OUT = join(VIEW, 'looks', 'img');
let pw; try { pw = require(join(VIEW, 'node_modules', 'playwright')); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
let sharp; try { sharp = require(join(VIEW, 'node_modules', 'sharp')); } catch (e) { sharp = require('/opt/npm-tools/node_modules/sharp'); }
const { listen } = await import(join(VIEW, 'tools', 'serve.mjs'));
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--no-proxy-server',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-pings'];
const LIMIT = 60 * 1024;

const all = JSON.parse(readFileSync(join(ROOT, 'templates', 'templates.v1.json'), 'utf8')).looks, want = process.argv.slice(2);
const looks = want.length ? all.filter((l) => want.includes(l.id)) : all;
if (!looks.length) { console.error('no such look: ' + want.join(', ')); process.exit(1); }
mkdirSync(OUT, { recursive: true });
const srv = await listen(0, { stock: 'library' });
const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true, args: GL });
let failed = 0;
for (const look of looks) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 }), page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(srv.origin + '/projects/menus/view/?demo=olea&test=1&hint=0&lang=he&template=' + look.id, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.__mana.settle());
  await page.evaluate(() => window.__mana.tick(12, 1 / 30, true));
  const png = await page.screenshot({ type: 'png' });
  let q = 78, buf;
  for (;;) { buf = await sharp(png).webp({ quality: q, effort: 6 }).toBuffer(); if (buf.length <= LIMIT || q <= 30) break; q -= 8; }
  const file = join(OUT, look.id + '.webp'); writeFileSync(file, buf);
  const ok = buf.length <= LIMIT && !errors.length; if (!ok) failed++;
  console.log((ok ? '✓ ' : '✗ ') + look.id + '  ' + (statSync(file).size / 1024).toFixed(1) + ' kB  q' + q + (errors.length ? '  errors: ' + errors.join(' | ') : ''));
  await ctx.close();
}
await browser.close(); srv.server.close();
process.exit(failed ? 1 : 0);
