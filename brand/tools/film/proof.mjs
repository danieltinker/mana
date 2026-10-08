/* Proof sheets for the films that are on the page: one frame from the middle of each shot, taken from the files the
   visitor gets (site/img/film-16x9.mp4, film-9x16.mp4; with --lang en the -en files), plus each file's size and length.
   It also reads the QR code in the table-card shot of each cut and says what it opens.

     node tools/film/proof.mjs            → review/v2/film/sheet-16x9.jpg, sheet-9x16.jpg, guest-24s.jpg, files.json (every video on the page)
     node tools/film/proof.mjs --lang en  → review/v2/film/sheet-16x9-en.jpg, sheet-9x16-en.jpg, guest-24s-en.jpg, files-en.json     */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire('/opt/npm-tools/node_modules/'); const sharp = require('sharp');
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..'), OUT = join(ROOT, 'review', 'v2', 'film'), TMP = join(ROOT, '.scratch', 'film-proof');
const FFMPEG = '/usr/bin/ffmpeg', FFPROBE = '/usr/bin/ffprobe';
const en = process.argv.includes('--lang') && process.argv[process.argv.indexOf('--lang') + 1] === 'en', suffix = en ? '-en' : '';
const TL = JSON.parse(readFileSync(join(HERE, 'timeline.json'), 'utf8'));
mkdirSync(OUT, { recursive: true }); mkdirSync(TMP, { recursive: true });
const probe = (f) => { const j = JSON.parse(execFileSync(FFPROBE, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,profile,width,height,r_frame_rate,pix_fmt,nb_frames', '-of', 'json', f]).toString()); const s = j.streams[0];
  return { file: f.replace(ROOT + '/', ''), bytes: +j.format.size, MB: +(j.format.size / 1e6).toFixed(2), seconds: +(+j.format.duration).toFixed(2), kbps: Math.round(j.format.bit_rate / 1000), codec: s.codec_name + ' ' + s.profile, size: s.width + '×' + s.height, fps: s.r_frame_rate, pixels: s.pix_fmt, frames: +s.nb_frames }; };
const report = []; let bad = 0;
/* A close look at the guest shot six seconds in (the dish is lifted, its sheet is open): the lower part of the phone's screen
   from each cut, at the recording's own size, so the words on the sheet's buttons can be read. Where the screen is: the same
   arithmetic as film.html. */
const guest = TL.shots.find((s) => s.clip === 'guest-glide'), close = [];
const screenOf = (format) => { const [W, H] = TL.formats[format], tall = format === '9x16', big = !!guest.big;
  const scrH = tall ? H * (big ? 0.69 : 0.63) : H * (big ? 0.86 : 0.8), scrW = scrH * 390 / 844, pad = scrW * 0.045, phW = scrW + 2 * pad, phH = scrH + 2 * pad;
  const x = tall ? (W - phW) / 2 : (en ? W * 0.87 - phW : W * 0.13), y = tall ? H * (big ? 0.245 : 0.275) : (H - phH) / 2;
  return { left: Math.round(x + pad), top: Math.round(y + pad + scrH * 0.55), width: Math.round(scrW), height: Math.round(scrH * 0.45) }; };
for (const format of ['16x9', '9x16']) {
  const film = join(ROOT, 'site', 'img', `film-${format}${suffix}.mp4`);
  if (!existsSync(film)) { console.log('missing:', film.replace(ROOT + '/', '')); bad = 1; continue; }
  const info = probe(film); report.push(info);
  console.log(`${info.file}  ${info.size}  ${info.seconds} s  ${info.fps} fps  ${info.MB} MB  ${info.kbps} kb/s  ${info.codec} ${info.pixels}`);
  const wide = format === '16x9', tw = wide ? 960 : 540, th = wide ? 540 : 960, cols = wide ? 4 : 8, gap = 6, tiles = [];
  for (const [n, s] of TL.shots.entries()) {
    const t = s.start + s.dur / 2, png = join(TMP, `${format}${suffix}-${s.id}.png`);
    execFileSync(FFMPEG, ['-v', 'error', '-y', '-ss', String(t), '-i', film, '-frames:v', '1', png]);
    tiles.push({ input: await sharp(png).resize(tw, th).toBuffer(), left: (n % cols) * (tw + gap), top: Math.floor(n / cols) * (th + gap) });
    if (s.clip === 'qr-table') {                                             // the code must open the demo from the film itself
      const read = execFileSync('python3', ['-c', 'import cv2,sys\nim=cv2.imread(sys.argv[1])\nd=cv2.QRCodeDetector()\nfor k in (1,2,3):\n    v,_,_=d.detectAndDecode(cv2.resize(im,None,fx=k,fy=k,interpolation=cv2.INTER_CUBIC) if k>1 else im)\n    if v: break\nprint(v)', png]).toString().trim();
      console.log(`  QR in the ${format} cut at ${t} s reads: ${read || 'NOT READ'}`); info.qr = read || null; if (!read) bad = 1;
    }
  }
  if (guest) { const t = guest.start + 6, png = join(TMP, `${format}${suffix}-guest-close.png`);
    execFileSync(FFMPEG, ['-v', 'error', '-y', '-ss', String(t), '-i', film, '-frames:v', '1', png]);
    close.push({ input: await sharp(png).extract(screenOf(format)).resize(780, 760, { fit: 'fill' }).toBuffer(), left: close.length * 786, top: 0 }); }
  const rows = Math.ceil(tiles.length / cols), sheet = join(OUT, `sheet-${format}${suffix}.jpg`);
  await sharp({ create: { width: cols * (tw + gap) - gap, height: rows * (th + gap) - gap, channels: 3, background: '#2c2c2c' } }).composite(tiles).jpeg({ quality: 86 }).toFile(sheet);
  console.log('  ' + sheet.replace(ROOT + '/', '') + '  (shots: ' + TL.shots.map((s) => s.id + ' at ' + (s.start + s.dur / 2) + ' s').join(', ') + ')');
}
if (close.length) { const f = join(OUT, `guest-24s${suffix}.jpg`);
  await sharp({ create: { width: close.length * 786 - 6, height: 760, channels: 3, background: '#2c2c2c' } }).composite(close).jpeg({ quality: 90 }).toFile(f);
  console.log(`${f.replace(ROOT + '/', '')}  (the open sheet in the guest shot at ${guest.start + 6} s: the wide cut, then the tall cut)`); }
for (const f of [`film-16x9${en ? '' : '-en'}.mp4`, `film-9x16${en ? '' : '-en'}.mp4`, 'hero.mp4', 'hero-en.mp4', 'hero-poster.jpg', 'hero-poster-480.jpg']) { const p = join(ROOT, 'site', 'img', f); if (!existsSync(p)) continue;      // the other language's cuts and the hero files: sizes only
  if (f.endsWith('.mp4')) { const i = probe(p); report.push(i); console.log(`${i.file}  ${i.size}  ${i.seconds} s  ${i.fps} fps  ${i.MB} MB  ${i.kbps} kb/s  ${i.codec} ${i.pixels}`); }
  else { const m = await sharp(p).metadata(); report.push({ file: 'site/img/' + f, bytes: statSync(p).size, size: m.width + '×' + m.height }); console.log(`site/img/${f}  ${m.width}×${m.height}  ${(statSync(p).size / 1000).toFixed(0)} kB`); } }
writeFileSync(join(OUT, `files${suffix}.json`), JSON.stringify(report, null, 1) + '\n');
process.exitCode = bad;
