/* Puts the finished films on the product page: tools/film/out/mana-film-<format>-<lang>.mp4 (the full-size masters from
   compose.mjs --scale 1) → site/img/film-<format>.mp4 (Hebrew) and film-<format>-en.mp4 (English), each at most 8 MB.
   A master that already fits is copied; a larger one is encoded again in two passes aimed just under the limit
   (H.264 high, yuv420p, 30 fps, a key frame every 3 s, faststart, no sound). Then run tools/build-site.mjs.

     node tools/film/to-site.mjs            Hebrew
     node tools/film/to-site.mjs --lang en  English        options: --max 8 (MB)

   The hero's two loops, each at most 2.5 MB (then: node tools/build-site.mjs --poster-from-video --demo-still-from-clip):
     node tools/film/to-site.mjs --hero [--hero-en <file>]
       site/img/hero.mp4     the Hebrew guest recording, tools/film/clips/guest-glide.mp4, scaled to 390 × 844
       site/img/hero-en.mp4  the English loop the viewer lane recorded (--hero-en <its path>): copied byte for byte when it
                             fits, encoded again like the Hebrew one when it does not                                    */
import { execFileSync } from 'node:child_process';
import { existsSync, statSync, copyFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const lang = arg('lang', 'he'), MAX = Number(arg('max', 8)) * 1e6, TL = JSON.parse(readFileSync(join(HERE, 'timeline.json'), 'utf8')), TMP = join(ROOT, '.scratch', 'film-2pass-' + lang);
const probe = (f) => JSON.parse(execFileSync('/usr/bin/ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'format=duration,size:stream=width,height', '-of', 'json', f]).toString());
const rel = (f) => f.replace(ROOT + '/', '');
let bad = 0;

if (process.argv.includes('--hero')) {
  const HERO_MAX = 2.5e6, small = (src, dst) => { for (let crf = 20; ; crf += 2) {           // 390 × 844: the size the hero's phone frame is drawn at
    execFileSync('/usr/bin/ffmpeg', ['-v', 'error', '-y', '-i', src, '-an', '-vf', 'scale=390:844:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', '30', dst]);
    if (statSync(dst).size <= HERO_MAX || crf >= 30) return crf; } };
  const say = (dst, how) => { const p = probe(dst), size = statSync(dst).size; if (size > HERO_MAX) bad = 1; console.log(`${rel(dst)}  ${p.streams[0].width}×${p.streams[0].height}  ${(+p.format.duration).toFixed(1)} s  ${(size / 1e6).toFixed(2)} MB${size > HERO_MAX ? '  OVER 2.5 MB' : ''}  (${how})`); };
  const he = join(HERE, 'clips', 'guest-glide.mp4'), dstHe = join(ROOT, 'site', 'img', 'hero.mp4');
  if (!existsSync(he)) { console.log('no tools/film/clips/guest-glide.mp4: hero.mp4 was left as it is'); bad = 1; }
  else { const crf = small(he, dstHe); say(dstHe, `${rel(he)} scaled down, CRF ${crf}`); }
  const en = arg('hero-en', null);
  if (en) { const src = resolve(en), dstEn = join(ROOT, 'site', 'img', 'hero-en.mp4');
    if (!existsSync(src)) { console.log('no file at ' + src + ': hero-en.mp4 was left as it is'); bad = 1; }
    else if (statSync(src).size <= HERO_MAX) { copyFileSync(src, dstEn); say(dstEn, 'copied byte for byte from ' + src); }
    else { const crf = small(src, dstEn); say(dstEn, `${src} encoded again, CRF ${crf}`); } }
  process.exit(bad);
}

mkdirSync(TMP, { recursive: true });
for (const format of Object.keys(TL.formats)) {
  const src = join(HERE, 'out', `mana-film-${format}-${lang}.mp4`), dst = join(ROOT, 'site', 'img', `film-${format}${lang === 'en' ? '-en' : ''}.mp4`);
  if (!existsSync(src)) { console.log('no master:', rel(src), '(run compose.mjs --scale 1 first)'); bad = 1; continue; }
  const p = probe(src), [W, H] = TL.formats[format];
  if (p.streams[0].width !== W || p.streams[0].height !== H) { console.log(`${rel(src)} is ${p.streams[0].width}×${p.streams[0].height}, not the full ${W}×${H}: not placed`); bad = 1; continue; }
  if (+p.format.size <= MAX) copyFileSync(src, dst);
  else for (let share = 0.95; ; share -= 0.04) {                      // aim a little under the limit; the container adds a few kB
    const kbps = Math.floor(MAX * 8 * share / +p.format.duration / 1000), log = join(TMP, `${format}-${lang}`);
    const common = ['-v', 'error', '-y', '-i', src, '-an', '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-b:v', kbps + 'k', '-g', '90', '-r', String(TL.fps), '-passlogfile', log];
    execFileSync('/usr/bin/ffmpeg', [...common, '-pass', '1', '-f', 'null', '/dev/null']);
    execFileSync('/usr/bin/ffmpeg', [...common, '-pass', '2', '-movflags', '+faststart', dst]);
    if (statSync(dst).size <= MAX || share < 0.6) break;
  }
  const size = statSync(dst).size; if (size > MAX) bad = 1;
  console.log(`${rel(dst)}  ${(size / 1e6).toFixed(2)} MB${size > MAX ? '  OVER THE LIMIT' : ''}  (master ${(+p.format.size / 1e6).toFixed(2)} MB${+p.format.size <= MAX ? ', copied as it is' : ', encoded again'})`);
}
rmSync(TMP, { recursive: true, force: true });
process.exitCode = bad;
