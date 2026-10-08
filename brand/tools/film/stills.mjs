/* Renders the film's two designed stills from tools/film/stills.html:
     clips/menu-paper.jpg, clips/qr-table.jpg            3840 × 2160, for the wide cut
     clips/menu-paper-9x16.jpg, clips/qr-table-9x16.jpg  2160 × 3840, framed for the tall cut (the composer prefers them there)
   and reads the QR code back from both card pictures: it must say https://halom.io/mana/view/?demo=olea.
     node tools/film/stills.mjs              all four, full size
     node tools/film/stills.mjs --preview    quarter size into .scratch/stills/ (for looking while designing) */
import http from 'node:http';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright'); const sharp = require('sharp');
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = join(HERE, '..', '..'), preview = process.argv.includes('--preview');
const OUT = preview ? join(ROOT, '.scratch', 'stills') : join(HERE, 'clips'); mkdirSync(OUT, { recursive: true });
const WANT = 'https://halom.io/mana/view/?demo=olea';
const TYPES = { '.html': 'text/html; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  const file = join(ROOT, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  const st = file.startsWith(ROOT) ? await stat(file).catch(() => null) : null; if (!st || !st.isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }); res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r)); const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true, args: ['--no-sandbox', '--force-color-profile=srgb'] });
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
for (const [shot, format, name] of [['menu', '16x9', 'menu-paper'], ['qr', '16x9', 'qr-table'], ['menu', '9x16', 'menu-paper-9x16'], ['qr', '9x16', 'qr-table-9x16']]) {
  if (only && !name.includes(only)) continue;
  const [W, H] = format === '16x9' ? [3840, 2160] : [2160, 3840];
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: preview ? 0.25 : 1 }); const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('still error:', e.message));
  await page.goto(`${origin}/tools/film/stills.html?shot=${shot}&format=${format}`, { waitUntil: 'load' }); await page.waitForFunction(() => window.__stillReady === true, null, { timeout: 60000 });
  await page.waitForTimeout(300);
  const file = join(OUT, name + '.jpg'); await sharp(await page.screenshot({ type: 'png' })).jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toFile(file); await ctx.close();
  let note = '';
  if (shot === 'qr' && !preview) {
    const got = execFileSync('python3', ['-c', 'import cv2,sys\nim=cv2.imread(sys.argv[1])\nv,_,_=cv2.QRCodeDetector().detectAndDecode(im)\nprint(v)', file]).toString().trim();
    note = got === WANT ? '  QR reads: ' + got : '  QR DOES NOT READ AS EXPECTED: "' + got + '"'; if (got !== WANT) process.exitCode = 1;
  }
  console.log(file.replace(ROOT + '/', ''), W + '×' + H + (preview ? ' (preview at 25%)' : '') + note);
}
await browser.close(); server.close();
