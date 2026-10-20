/* Films the guest's view, frame by frame, from a small script. No screen recorder, no real time: the page is opened with
   ?capture=1, where ONE clock drives all motion, and this tool turns that clock a frame at a time (__mana.frame), presses
   and moves a scripted finger (__mana.pointer, the same code path as a real one), and saves each frame as a PNG.
   Then ffmpeg makes an MP4 (H.264, yuv420p, faststart) and, if the script asks, a contact sheet of consecutive frames.

   Usage:   node tools/film.mjs films/hero.json [--out .shots/v2] [--frames-only] [--keep]
   Script:  { "name": "hero", "url": "?demo=olea&lang=en", "width": 390, "height": 844, "dpr": 1, "fps": 30, "seconds": 9,
              "finger": true,                          show where the finger is
              "steps": [                               times in seconds from the first frame
                { "at": 0.6, "drag": [[195, 330], [195, 560]], "ms": 420, "ease": "out" },   press, move, let go ("hold": true keeps it down)
                { "at": 2.0, "tap": [195, 370] }, { "at": 3.1, "goTo": "kebab" }, { "at": 4, "lift": true }, { "at": 5, "lift": false },
                { "at": 6, "lang": "he" }, { "at": 6.5, "key": "ArrowDown" }, { "at": 7, "wheel": 120 }, { "at": 7.5, "click": "#listBtn" }, { "at": 8, "eval": "…" } ],
              "sheet": { "from": 0.5, "every": 0.05, "count": 20, "cols": 5, "width": 320 } }      a contact sheet: frames every 50 ms
   A script may also be an array of such objects. Needs a local server: this tool starts tools/serve.mjs itself. */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { listen } from './serve.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { try { pw = require('playwright-core'); } catch (e2) { pw = require('/opt/npm-tools/node_modules/playwright'); } }
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), VIEW = '/projects/menus/view/';
const argv = process.argv.slice(2), flag = (n) => argv.includes(n), opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const files = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--out' && argv[i - 1] !== '--only');
if (!files.length) { console.error('usage: node tools/film.mjs <script.json> [--out dir] [--only name] [--frames-only] [--keep]'); process.exit(2); }
const OUT = resolve(opt('--out', join(ROOT, '.shots', 'v2'))), only = opt('--only', '');
const EASE = { linear: (x) => x, out: (x) => 1 - (1 - x) * (1 - x), in: (x) => x * x, both: (x) => x * x * (3 - 2 * x) };

export async function film(browser, origin, sc, out) {
  const fps = sc.fps || (sc.sheet && !sc.video ? Math.round(1 / (sc.sheet.every || .05)) : 30), w = sc.width || 390, h = sc.height || 844, n = Math.round((sc.seconds || 3) * fps), dt = 1000 / fps;
  const dir = join(out, 'frames-' + sc.name); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: sc.dpr || 1, hasTouch: sc.touch !== false && w < 900, isMobile: sc.touch !== false && w < 900, reducedMotion: sc.reducedMotion || 'no-preference' });
  const page = await ctx.newPage(), errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const url = (/^https?:/.test(sc.url) ? sc.url : origin + (sc.url.startsWith('/') ? sc.url : VIEW + sc.url)), u = new URL(url); u.searchParams.set('capture', '1'); if (sc.finger) u.searchParams.set('finger', '1'); if (sc.hint) u.searchParams.set('hint', '1');
  await page.goto(u.href, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.__mana.settle());                       // the table is up and the first dish is sharp: the film starts here
  const wantVideo = sc.video !== false && !flag('--frames-only') && (!sc.sheet || !!sc.video);
  const firstShot = !wantVideo && sc.sheet ? Math.round((sc.sheet.from || 0) * fps) : 0;      // a sheet alone: the frames before it are lived through, not drawn
  const steps = (sc.steps || []).map((s) => Object.assign({ done: false, down: false }, s)).sort((a, b) => a.at - b.at), t0 = Date.now(), track = [];
  for (let f = 0; f < n; f++) {
    const t = f / fps;
    for (const s of steps) {
      if (s.done || t < s.at - 1e-9) continue;
      if (s.drag) {                                                        // a finger: down at `at`, at the far point `ms` later, up one frame after its last move (as a real one is)
        if (s.atEnd) { if (!s.hold) await page.evaluate(([px, py]) => window.__mana.pointer('up', px, py), s.drag[1]); s.done = true; continue; }
        const k = Math.min(1, (t - s.at) * 1000 / (s.ms || 300)), e = (EASE[s.ease] || EASE.linear)(k), x = s.drag[0][0] + (s.drag[1][0] - s.drag[0][0]) * e, y = s.drag[0][1] + (s.drag[1][1] - s.drag[0][1]) * e;
        if (!s.down) { s.down = true; await page.evaluate(([px, py]) => window.__mana.pointer('down', px, py), s.drag[0]); }
        if (k > 0) await page.evaluate(([px, py]) => window.__mana.pointer('move', px, py), [x, y]);
        if (k >= 1) s.atEnd = true;
        continue;
      }
      s.done = true;
      if (s.release) await page.evaluate(([px, py]) => window.__mana.pointer('up', px, py), s.release);
      else if (s.tap) await page.evaluate(([px, py]) => { window.__mana.pointer('down', px, py); window.__mana.pointer('up', px, py); }, s.tap);
      else if (s.goTo) await page.evaluate((id) => window.__mana.goTo(id), s.goTo);
      else if (s.lift != null) await page.evaluate((on) => window.__mana.lift(on), s.lift);
      else if (s.lang) await page.evaluate((l) => window.__mana.setLang(l), s.lang);
      else if (s.key) await page.evaluate((k) => window.__mana.key(k), s.key);
      else if (s.wheel != null) await page.evaluate((d) => window.__mana.wheel(d), s.wheel);
      else if (s.click) await page.evaluate((sel) => document.querySelector(sel).click(), s.click);
      else if (s.eval) await page.evaluate(s.eval);
    }
    if (f < firstShot) { await page.evaluate((sec) => window.__mana.tick(1, sec, false), f === 0 ? 0 : dt / 1000); continue; }
    await page.evaluate((ms) => window.__mana.frame(ms), f === 0 ? 0 : dt);
    track.push(await page.evaluate(() => { const i = window.__mana.info(), g = window.__mana.glide(), st = window.__mana.state(); return i ? [+g.p.toFixed(3), +i.lift.toFixed(3), +i.lampK.toFixed(2), st.itemId] : [+g.p.toFixed(3), 0, 1, st.itemId]; }));
    await page.screenshot({ path: join(dir, 'f' + String(f).padStart(4, '0') + '.png') });
    if (f % 20 === 19) console.log('  ' + sc.name + ': frame ' + (f + 1) + '/' + n + ' (' + Math.round((Date.now() - t0) / (f + 1)) + ' ms a frame)');
  }
  const end = await page.evaluate(() => { const st = window.__mana.state(), i = window.__mana.info(); return { category: st.categoryId, item: st.itemId, open: st.open, lang: st.lang, scene: i ? i.scene : null }; }).catch(() => null);
  await ctx.close();
  const res = { name: sc.name, frames: n, fps, dir, end, errors, track: { columns: ['p (dishes along the table)', 'lift 0..1', 'lamp 0..1', 'dish in focus'], firstFrame: firstShot, rows: track } };
  if (sc.sheet) {                                                          // consecutive frames, side by side: motion you can read on paper
    const s = sc.sheet, step = Math.max(1, Math.round((s.every || .05) * fps)), first = Math.round((s.from || 0) * fps), count = Math.min(s.count || 20, Math.floor((n - first - 1) / step) + 1), cols = s.cols || 5, rows = Math.ceil(count / cols), width = s.width || 320;
    const file = join(out, sc.name + '.jpg');
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-start_number', String(first), '-i', join(dir, 'f%04d.png'), '-vf', `select='not(mod(n\\,${step}))',scale=${width}:-2,tile=${cols}x${rows}:padding=8:margin=8:color=0x101010`, '-frames:v', '1', '-q:v', '3', file]);
    if (r.status !== 0) errors.push('sheet: ' + String(r.stderr)); else res.sheet = file;
    res.sheetInfo = { first: +(first / fps).toFixed(3), every: +(step / fps).toFixed(3), count, cols, rows, width };
  }
  if (wantVideo) {
    const file = join(out, sc.name + '.mp4');
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, 'f%04d.png'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(sc.crf || 17), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(fps), file]);
    if (r.status !== 0) errors.push('video: ' + String(r.stderr)); else res.video = file;
  }
  if (!flag('--keep') && !sc.keep) rmSync(dir, { recursive: true, force: true });
  return res;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(OUT, { recursive: true });
  const srv = await listen(0, { stock: process.env.STOCK === 'fixture' ? undefined : 'library' });      // the real placeholder library next door, when it is there (STOCK=fixture: the eight test entries)
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || (existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined), headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox',
      '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-pings'] });      // this machine only
  const log = [];
  try {
    for (const f of files) {
      const j = JSON.parse(readFileSync(f, 'utf8'));
      for (const sc of (Array.isArray(j) ? j : [j])) { if (only && sc.name !== only) continue; const t = Date.now(), r = await film(browser, srv.origin, sc, OUT); r.ms = Date.now() - t; log.push(r); console.log(sc.name, '→', r.sheet || '', r.video || '', r.errors.length ? r.errors : '', Math.round(r.ms / 1000) + ' s'); }
    }
  } finally { await browser.close(); srv.server.close(); }
  /* one log for the folder: a later run replaces only the films it made again */
  let old = []; try { old = JSON.parse(readFileSync(join(OUT, 'film-log.json'), 'utf8')); } catch (e) { /* the first run */ }
  const all = old.filter((o) => !log.some((r) => r.name === o.name)).concat(log.map((r) => Object.assign({}, r, { dir: undefined, at: new Date().toISOString() })));
  writeFileSync(join(OUT, 'film-log.json'), JSON.stringify(all).replace(/\{"name"/g, '\n{"name"'));
}
