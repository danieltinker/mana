/* "The Lift": renders lift.html frame by frame and makes an MP4 (H.264, yuv420p, faststart, 30 fps, no sound) and a
   contact sheet. Headless Chromium draws WebGL in software here, so a full-size frame takes a few seconds.

     node brand/tools/lift/render.mjs --view <folder of the guest view WITH its media: fonts/, themes/, demo/olea/img/>
     options: --dish shakshuka   --lang en|he|both   --label demo|real   --scale 1 (0.5 = 540 × 960, a quick look)
              --fps 30   --from 0 --to 10   --stills 0,3,6,9.5   --out <folder>   --crf 17
   Output: <out>/the-lift-<dish>-<lang>.mp4 and sheet-<dish>-<lang>.jpg (one frame every half second).

   Point --view at the guest view with its media (pictures, fonts, table textures): this repository's apps/view/ folder, or
   _site/view after tools/build-site.sh. three.js comes from apps/view/node_modules (npm ci at the root once). */
import http from 'node:http';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = createRequire('/opt/npm-tools/node_modules/')('playwright'); }
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const VIEW = resolve(arg('view', join(HERE, '../../../apps/view')));
const THREE = resolve(HERE, '../../../apps/view/node_modules/three/build/three.module.js');
const dish = arg('dish', 'shakshuka'), label = arg('label', 'demo'), scale = Number(arg('scale', 1)), fps = Number(arg('fps', 30)), crf = String(arg('crf', 17));
const langs = arg('lang', 'en') === 'both' ? ['en', 'he'] : [arg('lang', 'en')];
const from = Number(arg('from', 0)), to = Number(arg('to', 10)), OUT = resolve(arg('out', join(HERE, 'out')));
const stills = arg('stills', '') ? String(arg('stills')).split(',').map(Number) : null;
const W = Math.round(1080 * scale / 2) * 2, H = Math.round(1920 * scale / 2) * 2;
for (const need of [join(VIEW, 'demo/olea/menu.json'), join(VIEW, 'themes/oak.jpg'), THREE]) if (!existsSync(need)) { console.error('missing: ' + need); process.exit(1); }
mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = null;
  if (p === '/three.module.js') file = THREE;
  else if (p === '/mark.mjs') file = join(HERE, '..', 'mark.mjs');
  else if (p.startsWith('/lift/')) file = join(HERE, normalize(p.slice(6)));
  else if (p.startsWith('/view/')) file = join(VIEW, normalize(p.slice(6)));
  const st = file && await stat(file).catch(() => null);
  if (!st || !st.isFile() || p.includes('..')) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = 'http://127.0.0.1:' + server.address().port;

const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
try {
  for (const lang of langs) {
    const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })).newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${origin}/lift/lift.html?dish=${dish}&lang=${lang}&label=${label}&w=${W}&h=${H}`);
    await page.waitForFunction(() => window.lift && window.lift.ready, null, { timeout: 120000 }).catch(() => {});
    if (errors.length) throw new Error(errors.join('\n'));
    const el = await page.$('#frame');
    if (stills) {
      for (const s of stills) { await page.evaluate((x) => window.lift.at(x), s); const f = join(OUT, `still-${dish}-${lang}-${String(s).replace('.', '_')}s.png`); await el.screenshot({ path: f }); log('still', f); }
      continue;
    }
    const dir = join(OUT, `frames-${dish}-${lang}`); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    const n0 = Math.round(from * fps), n1 = Math.round(to * fps);
    for (let n = n0; n < n1; n++) {
      await page.evaluate((x) => window.lift.at(x), n / fps);
      await el.screenshot({ path: join(dir, 'f' + String(n - n0).padStart(4, '0') + '.png') });
      if (n % 15 === 0) log(lang, 'frame', n, 'of', n1);
    }
    const mp4 = join(OUT, `the-lift-${dish}-${lang}.mp4`);
    let r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%04d.png'), '-c:v', 'libx264', '-preset', 'slow', '-crf', crf, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    if (r.status) throw new Error(String(r.stderr));
    const every = Math.max(1, Math.round(fps / 2)), count = Math.ceil(readdirSync(dir).length / every), cols = 7;
    r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', join(dir, 'f%04d.png'), '-vf', `select='not(mod(n\\,${every}))',scale=270:-2,tile=${cols}x${Math.ceil(count / cols)}:padding=6:margin=6:color=0x111111`, '-frames:v', '1', '-q:v', '3', join(OUT, `sheet-${dish}-${lang}.jpg`)]);
    if (r.status) throw new Error(String(r.stderr));
    log('wrote', mp4);
  }
} finally { await browser.close(); server.close(); }
