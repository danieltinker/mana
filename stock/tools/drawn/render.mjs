#!/usr/bin/env node
/* Renders the objects in objects/ to the pictures build_drawn.py turns into reliefs. Headless Chromium, software WebGL, no network.
   node tools/drawn/render.mjs [--ids a,b] [--preview 512] [--out DIR]
   Without --preview each object gets <id>_c.png (colour, 1536 px), <id>_d.png (height + coverage, 1024 px) and <id>.json
   (the window on the picture plane, in cm). With --preview N it writes one N px colour picture per object, for looking. */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((s) => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; }));
const OUT = path.resolve(args.out || path.join(HERE, '..', '..', '.scratch', 'drawn'));
const PLAY = process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright/index.mjs';
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const { chromium } = await import(pathToFileURL(PLAY).href);
const objects = JSON.parse(fs.readFileSync(path.join(HERE, 'objects.json'), 'utf8'));
const ids = (typeof args.ids === 'string' ? args.ids.split(',') : Object.keys(objects)).filter((id) => { if (!objects[id]) { console.error('unknown object', id); return false; } return true; });
const lib = fs.readFileSync(path.join(HERE, 'lib.glsl'), 'utf8');
const PRELUDE = 'vec3 srgb(vec3 c) { return pow(c, vec3(2.2)); }\n#define RGB(r, g, b) srgb(vec3(r, g, b) / 255.)\n';
function source(id) {
  const o = objects[id], body = fs.readFileSync(path.join(HERE, 'objects', id + '.glsl'), 'utf8');
  const nl = lib.indexOf('\n');
  const defs = Object.entries(o.defines || {}).map(([k, v]) => `#define ${k} ${v}\n`).join('');
  return lib.slice(0, nl + 1) + '#define STEP ' + (o.step || 0.85).toFixed(3) + '\n' + defs + 'precision highp float;\n' + PRELUDE + lib.slice(nl + 1) + '#line 1\n' + body;
}

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog',
  '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--disable-default-apps'] });   // the browser asks nobody anything
const page = await browser.newPage({ viewport: { width: 400, height: 300 }, deviceScaleFactor: 1 });
await page.setContent('<canvas id="c"></canvas>');
await page.evaluate(() => {
  const cv = document.getElementById('c'), gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
  const VS = '#version 300 es\nin vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }';
  let prog = null;
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  window.R = {
    use(fs) {
      if (prog) gl.deleteProgram(prog);
      prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const l = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
    },
    draw(W, win, e, mode) {                 // in tiles, so no single draw runs long
      cv.width = cv.height = W; gl.viewport(0, 0, W, W);
      gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), W, W); gl.uniform3f(gl.getUniformLocation(prog, 'uWin'), win[0], win[1], win[2]);
      gl.uniform1f(gl.getUniformLocation(prog, 'uE'), e * Math.PI / 180); gl.uniform1i(gl.getUniformLocation(prog, 'uMode'), mode);
      gl.disable(gl.BLEND); gl.enable(gl.SCISSOR_TEST); const T = 384;
      for (let y = 0; y < W; y += T) for (let x = 0; x < W; x += T) { gl.scissor(x, y, T, T); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish(); }
      gl.disable(gl.SCISSOR_TEST);
      const px = new Uint8Array(W * W * 4); gl.readPixels(0, 0, W, W, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px;
    },
    b64(px) { let s = ''; const C = 0x8000; for (let i = 0; i < px.length; i += C) s += String.fromCharCode.apply(null, px.subarray(i, i + C)); return btoa(s); },
    bbox(W, win, e) {                       // where the object is on the picture plane
      const px = this.draw(W, win, e, 1); let x0 = W, x1 = -1, y0 = W, y1 = -1;
      for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 2] > 127) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const u = (i) => (i / W - .5) * 2 * win[2];
      return x1 < 0 ? null : { x0: win[0] + u(x0), x1: win[0] + u(x1 + 1), y0: win[1] + u(y0), y1: win[1] + u(y1 + 1), edge: x0 === 0 || y0 === 0 || x1 === W - 1 || y1 === W - 1 };
    },
    image(W, win, e, mode) { return this.b64(this.draw(W, win, e, mode)); }
  };
});
/* an 8-bit RGBA PNG, rows flipped (WebGL reads bottom row first); nothing but node's zlib */
function save(b64, W, file) {
  const px = Buffer.from(b64, 'base64'), raw = Buffer.alloc((W * 4 + 1) * W);
  for (let y = 0; y < W; y++) px.copy(raw, y * (W * 4 + 1) + 1, (W - 1 - y) * W * 4, (W - y) * W * 4);
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(W, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 3 })), chunk('IEND', Buffer.alloc(0))]));
}

let failed = 0;
for (const id of ids) {
  const o = objects[id], t0 = Date.now(), e = o.e || 48;
  try {
    await page.evaluate((fs) => window.R.use(fs), source(id));
    let box = await page.evaluate(([e]) => window.R.bbox(256, [0, 8, 36], e), [e]);
    if (!box) throw new Error('nothing to see');
    if (box.edge) console.error(id, 'touches the edge of the search window');
    const pad = 1.5, c0 = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2], h0 = Math.max(box.x1 - box.x0, box.y1 - box.y0) / 2 + pad;
    box = await page.evaluate(([w, e]) => window.R.bbox(640, w, e), [[c0[0], c0[1], h0], e]);       // second look, close in, for an exact outline
    const side = Math.max(box.x1 - box.x0, box.y1 - box.y0) * 1.10, win = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2, side / 2];   // 5% margin on each side, as the photo pipeline crops
    if (args.preview) {
      const W = +args.preview || 512; fs.mkdirSync(path.join(OUT, 'preview'), { recursive: true });
      await save(await page.evaluate(([W, w, e]) => window.R.image(W, w, e, 0), [W, win, e]), W, path.join(OUT, 'preview', id + '.png'));
    } else {
      await save(await page.evaluate(([w, e]) => window.R.image(1536, w, e, 0), [win, e]), 1536, path.join(OUT, id + '_c.png'));
      await save(await page.evaluate(([w, e]) => window.R.image(1024, w, e, 1), [win, e]), 1024, path.join(OUT, id + '_d.png'));
      fs.writeFileSync(path.join(OUT, id + '.json'), JSON.stringify({ id, e, win, stand: !!o.stand, s: o.s || null, henc: 64 }));
    }
    console.log(id, 'ok', ((Date.now() - t0) / 1000).toFixed(1) + ' s', 'side', side.toFixed(1), 'cm');
  } catch (err) { failed++; console.error(id, 'FAILED:', String(err.message || err).split('\n').slice(0, 12).join('\n')); }
}
await browser.close();
process.exit(failed ? 1 : 0);
