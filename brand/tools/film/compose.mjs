/* The film composer: renders a film frame by frame from tools/film/timeline.json.
   The stage is an HTML page with its own clock (film.html); this script asks it for one moment at a time, takes a
   picture of each frame with Playwright and hands the pictures to ffmpeg (30 fps, H.264, yuv420p, faststart). No sound.

   Inputs, in tools/film/clips/ — put a file there and it replaces the placeholder of the same name on the next run:
     <clip>.mp4 | .webm | .mov     a screen recording (any size, any frame rate; it is re-timed to 30 fps and cut or held
                                   to the length of its shot)
     <clip>.jpg | .png             a still (the stage moves it slowly); <clip>-9x16.jpg, when present, is used in the tall cut
   The clip names and what each should show are in tools/film/SCRIPT.md. A shot whose clip is missing is drawn from
   today's pictures and carries a yellow PLACEHOLDER tag, so an unfinished film cannot be mistaken for a finished one.

     node tools/film/compose.mjs                         both cuts, Hebrew, half size (a quick sample: 960 × 540 and 540 × 960)
     node tools/film/compose.mjs --scale 1 --lang both   the real thing: 1920 × 1080 and 1080 × 1920, Hebrew and English
     node tools/film/compose.mjs --format 9x16 --from 18 --to 27     one cut, a part of it
     options: --format 16x9|9x16|both   --lang he|en|both   --scale 0.5   --from s --to s   --out <folder>   --crf 18   --no-sheet
              --stills 2,6.5,22   (single frames at those seconds instead of a film)
   Output: tools/film/out/mana-film-<format>-<lang>.mp4 and a contact sheet sheet-<format>-<lang>.jpg (one frame a second).
   For the product page, copy the full-size Hebrew cuts to site/img/film-16x9.mp4 and site/img/film-9x16.mp4 (English:
   film-16x9-en.mp4, film-9x16-en.mp4) and run tools/build-site.mjs. Do that only when no shot is a placeholder: the
   script prints which are. */
import http from 'node:http';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, statSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright'); const sharp = require('sharp');
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..'), CLIPS = join(HERE, 'clips'), CACHE = join(ROOT, '.scratch', 'film-cache');
const FFMPEG = '/usr/bin/ffmpeg', FFPROBE = '/usr/bin/ffprobe';
const arg = (name, def) => { const i = process.argv.indexOf('--' + name); return i < 0 ? def : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true); };
const scale = Number(arg('scale', 0.5)), crf = String(arg('crf', 18)), OUT = arg('out', join(HERE, 'out')), wantSheet = !process.argv.includes('--no-sheet');
const formats = arg('format', 'both') === 'both' ? ['16x9', '9x16'] : [arg('format')], langs = arg('lang', 'he') === 'both' ? ['he', 'en'] : [arg('lang', 'he')];
const TL = JSON.parse(readFileSync(join(HERE, 'timeline.json'), 'utf8'));
const FPS = TL.fps, total = Math.max(...TL.shots.map((s) => s.start + s.dur)), from = Number(arg('from', 0)), to = Math.min(total, Number(arg('to', total)));
mkdirSync(OUT, { recursive: true }); mkdirSync(CACHE, { recursive: true }); mkdirSync(CLIPS, { recursive: true });

/* ---- the clips that exist: stills are used as they are, recordings become a folder of frames at 30 fps */
const clips = {}, tallClips = {};          // tallClips: a file named <clip>-9x16.* is used in the tall cut instead (a still framed for it)
const EXTS = ['.mp4', '.webm', '.mov', '.m4v', '.jpg', '.jpeg', '.png'];
for (const name of new Set(TL.shots.map((s) => s.clip).filter(Boolean))) {
  const alt = ['.jpg', '.jpeg', '.png'].map((e) => join(CLIPS, name + '-9x16' + e)).find(existsSync);
  if (alt) tallClips[name] = { still: '/tools/film/clips/' + name + '-9x16' + extname(alt) };
  const file = EXTS.map((e) => join(CLIPS, name + e)).find(existsSync);
  if (!file) { clips[name] = null; continue; }
  if (/\.(jpe?g|png)$/.test(file)) { clips[name] = { still: '/tools/film/clips/' + name + extname(file) }; continue; }
  const st = statSync(file), dir = join(CACHE, name + '-' + Math.round(st.mtimeMs) + '-' + st.size);
  if (!existsSync(join(dir, 'done'))) {
    for (const d of readdirSync(CACHE).filter((d) => d.startsWith(name + '-'))) rmSync(join(CACHE, d), { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', file, '-an', '-vf', `fps=${FPS},scale='min(1080,iw)':-2`, '-q:v', '3', join(dir, '%05d.jpg')]);
    writeFileSync(join(dir, 'done'), '');
  }
  const n = readdirSync(dir).filter((f) => f.endsWith('.jpg')).length;
  const dim = execFileSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim();
  clips[name] = { frames: n, fps: FPS, dir: '/__film/cache/' + dir.slice(CACHE.length + 1) + '/', size: dim, seconds: +(n / FPS).toFixed(2) };
}
const placeholders = Object.keys(clips).filter((k) => !clips[k]);
console.log('clips found:', Object.keys(clips).filter((k) => clips[k]).map((k) => k + (clips[k].frames ? ` (${clips[k].size}, ${clips[k].seconds} s)` : ' (still)')).join(', ') || 'none');
console.log('placeholders:', placeholders.join(', ') || 'none: every shot has its real clip');
for (const s of TL.shots) { const c = s.clip && clips[s.clip]; if (c && c.frames && c.seconds + 0.05 < s.dur) console.log(`note: ${s.clip} is ${c.seconds} s and its shot is ${s.dur} s: the last frame is held`); }

/* ---- a small server for the stage (the lane folder, read-only) */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/__film/data.json') { const tall = new URL(req.url, 'http://x').searchParams.get('format') === '9x16'; res.writeHead(200, { 'Content-Type': TYPES['.json'] }); return res.end(JSON.stringify({ clips: tall ? Object.assign({}, clips, tallClips) : clips })); }
    const file = path.startsWith('/__film/cache/') ? join(CACHE, normalize(path.slice(14))) : join(ROOT, normalize(path));
    if (!(file.startsWith(ROOT) || file.startsWith(CACHE)) || /(^|\/)(\.git|node_modules)(\/|$)/.test(path)) { res.writeHead(404); return res.end(); }
    const st = await stat(file).catch(() => null); if (!st || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=3600' }); res.end(await readFile(file));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r)); const origin = 'http://127.0.0.1:' + server.address().port;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
for (const format of formats) for (const lang of langs) {
  const [W0, H0] = TL.formats[format], W = Math.round(W0 * scale / 2) * 2, H = Math.round(H0 * scale / 2) * 2;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 }); const page = await ctx.newPage();
  page.on('pageerror', (e) => { console.error('stage error:', e.message); process.exitCode = 1; });
  await page.goto(`${origin}/tools/film/film.html?format=${format}&lang=${lang}&scale=${W / W0}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__filmReady === true, null, { timeout: 60000 });
  if (arg('stills')) {                                                          // --stills 2,6.5,22: single frames to look at, no film
    for (const t of String(arg('stills')).split(',').map(Number)) { await page.evaluate((x) => window.__film.seek(x), t); const f = join(OUT, `still-${format}-${lang}-${String(t).padStart(4, '0')}.jpg`); await page.screenshot({ path: f, type: 'jpeg', quality: 90 }); console.log(f.replace(ROOT + '/', '')); }
    await ctx.close(); continue;
  }
  const file = join(OUT, `mana-film-${format}-${lang}.mp4`), t0 = Date.now();
  const ff = spawn(FFMPEG, ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-movflags', '+faststart', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ended with ' + c)))));
  const first = Math.round(from * FPS), last = Math.round(to * FPS), sheet = [];
  for (let i = first; i < last; i++) {
    await page.evaluate((t) => window.__film.seek(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (wantSheet && i % FPS === Math.round(FPS / 2)) sheet.push(buf);                      // one frame a second, taken mid-second
    if ((i - first) % (FPS * 5) === 0) process.stdout.write(`\r${format} ${lang}: ${(i / FPS).toFixed(0)} / ${to} s`);
  }
  ff.stdin.end(); await done; await ctx.close();
  console.log(`\r${file.replace(ROOT + '/', '')}  ${W}×${H}, ${((last - first) / FPS).toFixed(1)} s, ${(statSync(file).size / 1e6).toFixed(2)} MB, rendered in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (wantSheet && sheet.length) {
    const cols = format === '16x9' ? 6 : 11, tw = format === '16x9' ? 400 : 218, th = Math.round(tw * H / W), rows = Math.ceil(sheet.length / cols);
    const comp = await Promise.all(sheet.map(async (b, n) => ({ input: await sharp(b).resize({ width: tw }).toBuffer(), left: (n % cols) * (tw + 6), top: Math.floor(n / cols) * (th + 6) })));
    const sf = join(OUT, `sheet-${format}-${lang}.jpg`);
    await sharp({ create: { width: cols * (tw + 6) - 6, height: rows * (th + 6) - 6, channels: 3, background: '#3a3a3a' } }).composite(comp).jpeg({ quality: 82 }).toFile(sf); console.log(sf.replace(ROOT + '/', ''));
  }
}
await browser.close(); server.close();
if (placeholders.length) console.log('NOT for publishing yet: ' + placeholders.length + ' shot(s) still use placeholders.');
