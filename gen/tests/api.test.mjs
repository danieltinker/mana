// Unit tests for the public API of gen.js. Real Chromium (Playwright) against tests/server.mjs, which serves this
// folder the way GitHub Pages would (path prefix, gzip, Range, no COOP/COEP).
//   node tests/api.test.mjs            needs `playwright` resolvable from node and a Chromium (CHROMIUM=/path/to/chrome)
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, shipMounts, PREFIX } from './server.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const WARN_CUT = 'The dish is cut off by the edge of the photo. A photo with the whole dish in frame looks better.';
const only = process.argv[2] ? new RegExp(process.argv[2]) : null;

const s = await startServer({ mounts: shipMounts(), gzip: true });
const ORIGIN = `http://127.0.0.1:${s.port}`;
const PAGE = `${ORIGIN}${PREFIX}/tests/page.html`;
const ctl = (q) => fetch(`${ORIGIN}/${q}`).then((r) => r.text());
const heavy = (l) => l.filter((r) => /\/(vendor|models)\/|\.py(\?|$)/.test(r.url));
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

const results = [];
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`);
async function test(name, fn) {
  if (only && !only.test(name)) return;
  const t = Date.now();
  try { await fn(); results.push({ name, ok: true }); console.log(`PASS  ${name}  (${((Date.now() - t) / 1000).toFixed(1)} s)`); }
  catch (e) { results.push({ name, ok: false, error: e.message }); console.log(`FAIL  ${name}\n      ${e.message.split('\n')[0]}`); }
}
async function open(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('      [pageerror]', e.message));
  await page.goto(PAGE);
  await page.waitForFunction(() => document.title === 'ready');
  return page;
}

// ---------------------------------------------------------------------------------------------------------
const A = await browser.newContext();
let page = await open(A);
let firstLog = null, plate = null, total = 0;

await test('supported() and capabilities() are cheap and true in Chromium', async () => {
  const r = await page.evaluate(() => ({ s: T.G.supported(), c: T.G.capabilities(), d: T.G.downloadSize(), inst: typeof T.G.createGenerator.supported }));
  assert(r.s === true && r.c.ok === true && r.c.simd && r.c.moduleWorker, 'capabilities ' + JSON.stringify(r.c));
  assert(r.d > 10e6 && r.inst === 'function', 'downloadSize ' + r.d);
  total = r.d;
});

await test('abort during the first download rejects with "aborted" and keeps what was finished', async () => {
  await ctl('__log?clear=1');
  await ctl('__throttle?bps=24000000');
  const r = await page.evaluate(async () => {
    const ac = new AbortController();
    let seen = 0, tAbort = 0;
    const e = await T.err(() => T.G.createGenerator({ signal: ac.signal, onProgress: (p) => { if (p.phase === 'download' && p.loaded > 0.45 * p.total && !tAbort) { seen = p.loaded; tAbort = performance.now(); ac.abort(); } } }));
    return { e, seen, lag: performance.now() - tAbort };
  });
  await ctl('__throttle?bps=0');
  assert(r.e && r.e.code === 'aborted', 'error ' + JSON.stringify(r.e));
  assert(r.lag < 1000, 'rejection took ' + r.lag + ' ms');
  await new Promise((res) => setTimeout(res, 500));
  const c = await page.evaluate(() => T.create('g'));
  firstLog = c.log;
  assert(c.info.downloadedBytes > 0 && c.info.downloadedBytes < c.info.totalBytes, `second attempt downloaded ${c.info.downloadedBytes} of ${c.info.totalBytes}: nothing was kept`);
  eq(c.info.totalBytes, total, 'total bytes');
  eq(c.info.cache, 'ok', 'cache state');
  const log = heavy(JSON.parse(await ctl('__log')));
  assert(log.length > 10 && log.every((r) => /\?h=[0-9a-f]{16}$/.test(r.url)), 'a runtime or model file was fetched outside the verified store: ' + log.filter((r) => !/\?h=/.test(r.url)).map((r) => r.url).join(', '));
});

await test('createGenerator reports progress: download (bytes) -> runtime -> models -> ready', async () => {
  const phases = firstLog.map((p) => p.phase).filter((p, i, a) => p !== a[i - 1]);
  eq(phases, ['download', 'runtime', 'models', 'ready'], 'phase order');
  const d = firstLog.filter((p) => p.phase === 'download');
  assert(d.every((p) => p.total === total && p.loaded >= 0 && p.loaded <= p.total && typeof p.message === 'string'), 'download events malformed');
  assert(d.every((p, i) => i === 0 || p.loaded >= d[i - 1].loaded), 'download bytes went backwards');
  eq(d[d.length - 1].loaded, total, 'final loaded');
});

await test('analyse + build: three images of the right size and type, numbers and provenance', async () => {
  plate = await page.evaluate(() => T.run('g', 'plate', 'plate.jpg', 'Shawarma Plate', { debug: true }));
  eq(plate.types, ['image/jpeg', 'image/png', 'image/jpeg', 'image/jpeg'], 'blob types');
  eq(plate.sizes, [[768, 768], [512, 512], [256, 256]], 'pixel sizes');
  eq(plate.kind, 'tall', 'kind (the name says shawarma)');
  assert(plate.meta.e >= 32 && plate.meta.e <= 85 && plate.meta.h > 0.02 && plate.meta.h < 1, 'meta ' + JSON.stringify(plate.meta));
  assert(!('o' in plate.meta) && !('warn' in plate.meta), 'unexpected o/warn');
  const p = plate.provenance;
  const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(HERE, 'fixtures/plate.jpg'))).digest('hex');
  eq([p.pipeline, p.sourceSha256, p.width, p.height, p.decoder], ['halom-relief/1', sha, 960, 768, 'pillow'], 'provenance');
  assert(/^u2netp@[0-9a-f]{12}$/.test(p.matteModel) && /^da2s[\w-]*@[0-9a-f]{12}$/.test(p.depthModel), 'model ids ' + p.matteModel + ' ' + p.depthModel);
  assert(/pyodide .*opencv .*onnxruntime-web/.test(p.runtime) && Number.isInteger(p.ms) && p.ms > 0, 'runtime/ms');
  eq([plate.job.width, plate.job.height, plate.job.name, plate.job.sourceSha256], [960, 768, 'Shawarma Plate', sha], 'job handle');
});

await test('per-photo progress: decode -> matte (two passes) -> depth -> build', async () => {
  const seq = plate.log.map((p) => `${p.phase}:${p.loaded}/${p.total}`);
  eq(seq, ['decode:0/1', 'matte:0/2', 'matte:1/2', 'depth:0/1', 'depth:1/1', 'build:0/1', 'build:1/1'], 'progress sequence');
  eq([...new Set(plate.log.map((p) => p.message))], ['reading the photo', 'finding the dish', 'measuring depth', 'building'], 'messages');
});

await test('build again with another depth class: no new analysis, kind and height follow', async () => {
  const flat = await page.evaluate(() => T.build('g', 'plate', { relief: 'flat' }));
  const tall = await page.evaluate(() => T.build('g', 'plate', { relief: 'tall', angle: 60 }));
  eq([flat.kind, tall.kind], ['flat', 'tall'], 'kinds');
  assert(flat.meta.h < 0.5 * tall.meta.h, `flat ${flat.meta.h} vs tall ${tall.meta.h}`);
  eq(tall.meta.e, 60, 'explicit angle');
  assert(flat.buildMs < 0.6 * plate.analyseMs, `build ${flat.buildMs} ms is not clearly quicker than analyse ${plate.analyseMs} ms`);
  eq(flat.log.map((p) => p.phase), ['build', 'build'], 'only the build phase ran');
  eq(flat.provenance.sourceSha256, plate.provenance.sourceSha256, 'same source');
});

await test('a standing drink becomes "stand" with a pivot (o) and scale (s)', async () => {
  const r = await page.evaluate(() => T.run('g', 'drink', 'drink.jpg', 'Kirin Beer'));
  eq(r.kind, 'stand', 'kind');
  assert(Array.isArray(r.meta.o) && r.meta.o.length === 2 && r.meta.o.every((v) => typeof v === 'number'), 'o ' + JSON.stringify(r.meta.o));
  eq([r.meta.s, r.meta.e], [0.62, 45], 's and e');
});

await test('two photos in sequence: an earlier job still builds, byte for byte', async () => {
  const again = await page.evaluate(() => T.build('g', 'plate', {}));       // plate was parked when the drink came in
  eq(again.auxHex, plate.auxHex, 'aux.png of the first photo after a second photo');
  eq(again.colorHex, plate.colorHex, 'colour.jpg of the first photo after a second photo');
  const st = await page.evaluate(() => T.gens.g.stats());
  eq(st.jobs, 2, 'live jobs');
  assert(st.parkedBytes > 0, 'nothing was parked outside the Python heap');
});

await test('two analyse calls at once are queued and both finish', async () => {
  const r = await page.evaluate(async () => {
    const g = T.gens.g;
    const [a, b] = await Promise.all([g.analyse(await T.blob('plate.webp'), { name: 'x' }), g.analyse(await T.blob('plate.png'), { name: 'y' })]);
    const oa = await g.build(a), ob = await g.build(b);
    const iou = await T.iou(oa.aux, ob.aux);
    g.release(a); g.release(b);
    return { ka: oa.kind, kb: ob.kind, iou, da: oa.provenance.decoder, db: ob.provenance.decoder };
  });
  eq([r.ka, r.kb, r.da, r.db], ['medium', 'medium', 'pillow', 'pillow'], 'kinds and decoders');
  assert(r.iou > 0.97, 'WebP and PNG of the same picture disagree: IoU ' + r.iou);
});

await test('EXIF orientation is respected', async () => {
  const r = await page.evaluate(async () => {
    const x = await T.run('g', 'exif', 'plate-exif6.jpg', 'Shawarma Plate');
    const iou = await T.iou(T.outs.exif.aux, T.outs.plate.aux);
    T.gens.g.release(T.jobs.exif);
    return { x, iou };
  });
  eq([r.x.job.width, r.x.job.height, r.x.kind], [960, 768, 'tall'], 'turned upright');
  assert(r.iou > 0.97 && Math.abs(r.x.meta.e - plate.meta.e) <= 1.5, `IoU ${r.iou}, e ${r.x.meta.e} vs ${plate.meta.e}`);
});

await test('a format Pillow cannot read falls back to the browser decoder (AVIF here; the HEIC path on Safari)', async () => {
  const r = await page.evaluate(async () => {
    const x = await T.run('g', 'avif', 'plate.avif', 'Shawarma Plate');
    const iou = await T.iou(T.outs.avif.aux, T.outs.plate.aux);
    T.gens.g.release(T.jobs.avif);
    return { x, iou };
  });
  eq([r.x.provenance.decoder, r.x.kind, r.x.job.width, r.x.job.height], ['browser', 'tall', 640, 512], 'decoder');
  assert(r.iou > 0.95, 'IoU against the JPEG of the same picture ' + r.iou);
});

await test('a 29-megapixel JPEG goes through the reduced-size decoder and still gives the same dish', async () => {
  const r = await page.evaluate(async () => {
    const bmp = await createImageBitmap(await T.blob('plate.jpg'));
    const c = new OffscreenCanvas(6000, 4800);
    c.getContext('2d').drawImage(bmp, 0, 0, 6000, 4800);
    const big = await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    T.jobs.big = await T.gens.g.analyse(big, { name: 'Shawarma Plate' });
    const x = await T.build('g', 'big');
    const iou = await T.iou(T.outs.big.aux, T.outs.plate.aux);
    T.gens.g.release(T.jobs.big);
    return { x, iou, bytes: big.size, job: T.jobs.big };
  });
  assert(r.bytes < 15 * 1024 * 1024, 'test image too large: ' + r.bytes);
  eq([r.job.width, r.job.height, r.x.provenance.decoder, r.x.provenance.workWidth, r.x.provenance.workHeight, r.x.kind], [6000, 4800, 'pillow-draft', 1280, 1024, 'tall'], 'big photo');
  assert(r.iou > 0.97, 'IoU against the small version ' + r.iou);
});

await test('the pipeline\'s warning is passed through in meta.warn', async () => {
  const r = await page.evaluate(async () => { const x = await T.run('g', 'cut', 'cutoff.jpg', 'Shawarma Plate'); T.gens.g.release(T.jobs.cut); return x; });
  eq(r.meta.warn, WARN_CUT, 'warn');
});

await test('bad input is rejected with bad_image', async () => {
  const r = await page.evaluate(async () => {
    const g = T.gens.g;
    const big = new Blob([new Uint8Array(15 * 1024 * 1024 + 1)], { type: 'image/jpeg' });
    return {
      text: await T.err(() => g.analyse(new Blob(['this is not a photo'], { type: 'text/plain' }))),
      lying: await T.err(() => g.analyse(new Blob([crypto.getRandomValues(new Uint8Array(4096))], { type: 'image/jpeg' }))),
      empty: await T.err(() => g.analyse(new Blob([]))),
      big: await T.err(() => g.analyse(big)),
      string: await T.err(() => g.analyse('photo.jpg')),
      nothing: await T.err(() => g.analyse(null)),
    };
  });
  for (const [k, e] of Object.entries(r)) assert(e && e.code === 'bad_image', `${k}: ${JSON.stringify(e)}`);
});

await test('a photo with no dish: build rejects with no_dish', async () => {
  const r = await page.evaluate(async () => {
    const g = T.gens.g;
    const job = await g.analyse(await T.blob('blank.jpg'), { name: 'Soup' });
    const e = await T.err(() => g.build(job));
    g.release(job);
    return e;
  });
  assert(r && r.code === 'no_dish' && /No dish found/.test(r.message), JSON.stringify(r));
});

await test('wrong options are a TypeError, not a wrong picture', async () => {
  const r = await page.evaluate(async () => ({
    relief: await T.err(() => T.gens.g.build(T.jobs.plate, { relief: 'huge' })),
    angle: await T.err(() => T.gens.g.build(T.jobs.plate, { angle: 'sideways' })),
    quality: await T.err(() => T.G.createGenerator({ quality: 'nope' })),
  }));
  eq([r.relief.name, r.angle.name], ['TypeError', 'TypeError'], 'error types');
  eq(r.quality.code, 'internal', 'unknown quality');
});

await test('abort during analyse rejects at once; the generator keeps working', async () => {
  const r = await page.evaluate(async () => {
    const g = T.gens.g, ac = new AbortController();
    let t = 0;
    const e = await T.err(async () => g.analyse(await T.blob('plate.jpg'), { signal: ac.signal, onProgress: (p) => { if (p.phase === 'matte' && !t) { t = performance.now(); ac.abort(); } } }));
    const lag = performance.now() - t;
    const pre = new AbortController(); pre.abort();
    const e2 = await T.err(async () => g.analyse(await T.blob('plate.jpg'), { signal: pre.signal }));
    const e3 = await T.err(() => g.build(T.jobs.plate, { signal: pre.signal }));
    const after = await T.build('g', 'plate', {});
    const st = await g.stats();
    return { e, lag, e2, e3, after: after.auxHex, jobs: st.jobs };
  });
  eq([r.e && r.e.code, r.e2 && r.e2.code, r.e3 && r.e3.code], ['aborted', 'aborted', 'aborted'], 'codes');
  assert(r.lag < 300, 'abort took ' + r.lag + ' ms to reject');
  eq(r.after, plate.auxHex, 'build after an aborted analyse');
  eq(r.jobs, 2, 'the aborted photo left no job behind');
});

await test('release frees the job; using it afterwards is "released"', async () => {
  const r = await page.evaluate(async () => {
    const g = T.gens.g;
    g.release(T.jobs.drink); g.release(T.jobs.drink); g.release(null); g.release({});
    const e = await T.err(() => g.build(T.jobs.drink));
    const foreign = await T.err(() => g.build({ name: 'x', width: 1, height: 1 }));
    return { e, foreign, st: await g.stats() };
  });
  eq([r.e.code, r.foreign.code, r.st.jobs], ['released', 'released', 1], 'after release');
});

await test('dispose stops everything; later calls are "released"', async () => {
  const r = await page.evaluate(async () => {
    const g = T.gens.g;
    const pending = T.err(async () => g.analyse(await T.blob('plate.jpg')));
    await new Promise((res) => setTimeout(res, 50));
    g.dispose(); g.dispose();
    return { pending: await pending, later: await T.err(() => g.build(T.jobs.plate)), again: await T.err(async () => g.analyse(await T.blob('plate.jpg'))) };
  });
  eq([r.pending.code, r.later.code, r.again.code], ['released', 'released', 'released'], 'codes');
});

await test('second run: runtime and models come from the cache, no network for them', async () => {
  await page.close();
  page = await open(A);
  await ctl('__log?clear=1');
  const c = await page.evaluate(() => T.create('g'));
  eq(c.info.downloadedBytes, 0, 'bytes downloaded on the second run');
  const log = JSON.parse(await ctl('__log'));
  eq(heavy(log).map((r) => r.url), [], 'requests for runtime, models or pipeline');
  const names = log.map((r) => r.url.split('/').pop().split('?')[0]);
  const allowed = ['page.html', 'favicon.ico', 'gen.js', 'manifest.js', 'worker.js'];
  assert(names.every((n) => allowed.includes(n)), 'unexpected requests: ' + names.filter((n) => !allowed.includes(n)).join(', '));
  const d = c.log.filter((p) => p.phase === 'download');
  assert(d.length >= 1 && d.every((p) => p.loaded === p.total), 'download progress on a warm start should be complete at once');
});

await test('second run still works when the server refuses every runtime and model file', async () => {
  await page.evaluate(() => T.gens.g.dispose());
  await ctl('__fault?match=/vendor/&status=404&times=100000');
  await ctl('__fault?match=/models/&status=404&times=100000');
  await ctl('__fault?match=.py&status=404&times=100000');
  try {
    const r = await page.evaluate(async () => { await T.create('g'); return T.run('g', 'plate', 'plate.jpg', 'Shawarma Plate'); });
    eq(r.auxHex, plate.auxHex, 'same aux.png as the first run');
  } finally { await ctl('__fault?clear=1'); }
});

await test('a damaged cache entry is noticed and fetched again', async () => {
  await page.evaluate(() => T.gens.g.dispose());
  const key = await page.evaluate(async () => {
    const c = await caches.open('halom-gen-v1');
    const req = (await c.keys()).find((r) => /u2netp\.onnx/.test(r.url) && !/&ok=1$/.test(r.url));
    const full = new Uint8Array(await (await c.match(req)).arrayBuffer());
    await c.put(req, new Response(full.slice(0, 1000), { headers: { 'content-length': String(full.length) } }));   // truncated body, plausible header
    return req.url;
  });
  await ctl('__log?clear=1');
  const r = await page.evaluate(async () => { await T.create('g'); return T.run('g', 'plate', 'plate.jpg', 'Shawarma Plate'); });
  const log = heavy(JSON.parse(await ctl('__log')));
  eq(log.map((x) => x.url.split('/').pop().split('?')[0]), ['u2netp.onnx'], 'files fetched again');
  eq(r.auxHex, plate.auxHex, 'result after repair');
  assert(key.includes('?h='), 'cache keys carry the content hash');
});

await test('lowMemory mode (one model in memory at a time) gives the same files', async () => {
  await page.evaluate(() => T.gens.g.dispose());
  const r = await page.evaluate(async () => { await T.create('low', { lowMemory: true }); const x = await T.run('low', 'plate', 'plate.jpg', 'Shawarma Plate'); const st = await T.gens.low.stats(); T.gens.low.dispose(); return { x, st }; });
  eq(r.x.auxHex, plate.auxHex, 'aux.png');
  eq(r.st.sessions, [], 'no model session is kept between photos');
});

await test('quality "best": only the bigger cut-out model is downloaded on top of the default', async () => {
  const man = (await import('../manifest.js')).default;
  if (!man.presets.best) return;
  await ctl('__log?clear=1');
  const r = await page.evaluate(async () => {
    const c = await T.create('best', { quality: 'best' });
    const x = await T.run('best', 'bplate', 'plate.jpg', 'Shawarma Plate');
    const iou = await T.iou(T.outs.bplate.aux, T.outs.plate.aux);
    T.gens.best.dispose();
    return { info: c.info, x, iou };
  });
  const matte = man.files[man.models.matte[man.presets.best.matte].file];
  const shared = man.presets.best.depth === man.presets.default.depth;
  if (shared) eq(r.info.downloadedBytes, matte.size, 'bytes downloaded when switching to best');
  assert(r.x.provenance.matteModel.startsWith(man.presets.best.matte + '@'), 'matte model ' + r.x.provenance.matteModel);
  eq([r.x.kind, r.x.sizes], ['tall', [[768, 768], [512, 512], [256, 256]]], 'result');
  assert(r.iou > 0.97, 'best and default disagree on a plain plate: IoU ' + r.iou);
  assert(heavy(JSON.parse(await ctl('__log'))).every((q) => /\?h=[0-9a-f]{16}$/.test(q.url)), 'unverified download');
});
await A.close();

// ---------------------------------------------------------------------------------------------------------
const B = await browser.newContext();          // a new profile: empty cache
page = await open(B);
await test('a dropped connection resumes with a Range request; a failing file ends in model_download, then a clean retry works', async () => {
  const man = (await import('../manifest.js')).default;
  const depthFile = man.models.depth[man.presets.default.depth].file;
  const part = man.files[depthFile].parts ? man.files[depthFile].parts[1].path : depthFile;
  const matteFile = man.models.matte[man.presets.default.matte].file;
  await ctl(`__fault?match=${encodeURIComponent(part.split('/').pop())}&after=2000000&times=1`);
  await ctl(`__fault?match=${encodeURIComponent(matteFile.split('/').pop())}&status=503&times=100000`);
  await ctl('__log?clear=1');
  const t = Date.now();
  const e = await page.evaluate(() => T.err(() => T.G.createGenerator()));
  assert(e && e.code === 'model_download', 'error ' + JSON.stringify(e));
  assert(Date.now() - t > 2000, 'gave up without retrying');
  const log = JSON.parse(await ctl('__log'));
  const ranged = log.filter((r) => r.url.includes(part.split('/').pop()) && r.range);
  assert(ranged.length >= 1 && /^bytes=\d+-$/.test(ranged[0].range) && ranged[0].status === 206, 'no Range request for the cut file: ' + JSON.stringify(log.filter((r) => r.url.includes(part.split('/').pop()))));
  assert(log.filter((r) => r.url.includes(matteFile.split('/').pop())).length === 5, 'expected 1 try + 4 retries of the failing file');
  await ctl('__fault?clear=1');
  await new Promise((res) => setTimeout(res, 300));
  const c = await page.evaluate(() => T.create('g'));
  assert(c.info.downloadedBytes > 0 && c.info.downloadedBytes < c.info.totalBytes, `retry downloaded ${c.info.downloadedBytes} of ${c.info.totalBytes}`);
  const r = await page.evaluate(() => T.run('g', 'plate', 'plate.jpg', 'Shawarma Plate'));
  eq(r.auxHex, plate.auxHex, 'result after resume and retry');
});
await B.close();

const C = await browser.newContext();
page = await open(C);
await test('a missing file is model_download straight away (no retries)', async () => {
  await ctl('__fault?match=pyodide.asm.wasm&status=404&times=100000');
  const t = Date.now();
  const e = await page.evaluate(() => T.err(() => T.G.createGenerator()));
  await ctl('__fault?clear=1');
  assert(e && e.code === 'model_download' && /pyodide\.asm\.wasm/.test(e.message), JSON.stringify(e));
  assert(Date.now() - t < 6000, 'took ' + (Date.now() - t) + ' ms');
});
await test('clearCache() removes the downloaded files', async () => {
  const r = await page.evaluate(async () => ({ cleared: await T.G.clearCache(), left: (await caches.keys()).filter((k) => k.startsWith('halom-gen-')) }));
  eq([r.cleared, r.left], [true, []], 'cache after clearCache');
});
await C.close();

await browser.close();
await s.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
