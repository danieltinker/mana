// Halom relief generator: the worker. Everything heavy happens here so the dashboard never freezes.
//
//   onnxruntime-web (WASM, one thread)  -> the two networks (cut-out, depth)
//   Pyodide (Python + numpy + OpenCV + Pillow) -> pipeline.py, Halom's own post-processing, unchanged
//
// All runtime and model files are fetched once, checked against manifest.js (size + SHA-256) and kept in the
// Cache API under a content-hashed key. After that this worker makes no network request for them.
import manifest from './manifest.js';

const BASE = new URL('./', import.meta.url);
const CACHE_NAME = 'halom-gen-v1';
const MAX_FILE = 15 * 1024 * 1024;
const MAX_SIDE = 1280;
const RETRIES = 4;
const realFetch = self.fetch.bind(self);

class GenError extends Error {
  constructor(code, message, fatal = false) { super(message); this.code = code; this.fatal = fatal; }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();

// ---------------------------------------------------------------------------------------------------------
// wasm memory bookkeeping (for stats only): remember every WebAssembly.Memory this worker creates
const wasmMemories = [];
{
  const NativeMemory = WebAssembly.Memory;
  const Tracked = function Memory(desc) { const m = new NativeMemory(desc); wasmMemories.push(m); return m; };
  Tracked.prototype = NativeMemory.prototype;
  try { WebAssembly.Memory = Tracked; } catch { /* stats only */ }
  for (const fn of ['instantiate', 'instantiateStreaming']) {
    const orig = WebAssembly[fn];
    if (typeof orig !== 'function') continue;
    WebAssembly[fn] = async function (...args) {
      const r = await orig.apply(this, args);
      try {
        const inst = r instanceof WebAssembly.Instance ? r : r.instance;
        for (const v of Object.values(inst.exports)) if (v instanceof NativeMemory && !wasmMemories.includes(v)) wasmMemories.push(v);
      } catch { /* stats only */ }
      return r;
    };
  }
}

// ---------------------------------------------------------------------------------------------------------
// files: download with progress, resume and verification; Cache API with an in-memory fallback
const MIME = { wasm: 'application/wasm', mjs: 'text/javascript', js: 'text/javascript', json: 'application/json', py: 'text/x-python', zip: 'application/zip' };
const mime = (p) => MIME[p.split('.').pop()] || 'application/octet-stream';
const keyUrl = (e) => new URL(e.path, BASE).href + '?h=' + e.sha256.slice(0, 16);
const mem = new Map();            // key -> Uint8Array, only used when the Cache API is missing or full
let cache = null, cacheState = 'none';

function entriesOf(path) {
  const f = manifest.files[path];
  if (!f) throw new GenError('internal', 'Not in manifest: ' + path);
  return f.parts ? f.parts : [{ path, size: f.size, sha256: f.sha256 }];
}

async function openCache() {
  try {
    if (!self.caches) return;
    cache = await caches.open(CACHE_NAME);
    cacheState = 'ok';
    // drop entries that no longer belong to this build (old model or runtime versions)
    const wanted = new Set();
    for (const p of Object.keys(manifest.files)) for (const e of entriesOf(p)) { wanted.add(keyUrl(e)); wanted.add(okUrl(e)); }
    for (const req of await cache.keys()) if (!wanted.has(req.url)) await cache.delete(req);
  } catch { cache = null; cacheState = 'unavailable'; }
}

async function sha256hex(bytes) {
  if (!self.crypto || !crypto.subtle) return null;       // not a secure context: size check only
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  let s = '';
  for (const b of d) s += b.toString(16).padStart(2, '0');
  return s;
}

// An entry counts as cached only once its "ok" marker is written, which happens after the body is fully stored.
// (A worker stopped in the middle of cache.put can leave an entry whose body cannot be read.)
const okUrl = (e) => keyUrl(e) + '&ok=1';

async function isCached(e) {
  const k = keyUrl(e);
  if (mem.has(k)) return true;
  if (!cache) return false;
  try {
    const r = await cache.match(k);
    return !!r && r.headers.get('content-length') === String(e.size) && !!(await cache.match(okUrl(e)));
  } catch { return false; }
}

async function store(e, bytes) {
  const k = keyUrl(e);
  if (cache) {
    try {
      await cache.delete(okUrl(e));
      await cache.put(k, new Response(bytes, { headers: { 'content-type': mime(e.path), 'content-length': String(bytes.length) } }));
      await cache.put(okUrl(e), new Response('ok'));
      return;
    } catch { cacheState = 'full'; }                      // quota: carry on from memory
  }
  mem.set(k, bytes);
}

async function downloadEntry(e, signal, onBytes) {
  const url = keyUrl(e);
  let chunks = [], got = 0, attempt = 0, lastErr = null;
  for (;;) {
    if (signal.aborted) throw new GenError('aborted', 'Cancelled');
    try {
      const res = await realFetch(url, { signal, cache: cache ? 'no-store' : 'default', headers: got > 0 ? { Range: `bytes=${got}-` } : {} });
      if (res.status === 404 || res.status === 403 || res.status === 410) throw new GenError('model_download', `${e.path}: HTTP ${res.status}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (got > 0 && res.status !== 206) { onBytes(-got); chunks = []; got = 0; }   // server sent the whole file again
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length; onBytes(value.length);
      }
      if (got < e.size) throw new Error(`short read ${got}/${e.size}`);            // resume from here
      const bytes = new Uint8Array(got);
      let o = 0;
      for (const c of chunks) { bytes.set(c, o); o += c.length; }
      const h = got === e.size ? await sha256hex(bytes) : 'size';
      if (h !== null && h !== e.sha256) { onBytes(-got); chunks = []; got = 0; throw new Error('checksum mismatch'); }   // clean retry
      await store(e, bytes);
      return;
    } catch (err) {
      if (signal.aborted || err.name === 'AbortError') throw new GenError('aborted', 'Cancelled');
      if (err instanceof GenError) throw err;
      lastErr = err;
      if (++attempt > RETRIES) throw new GenError('model_download', `Could not download ${e.path}: ${lastErr.message}`);
      await sleep(Math.min(4000, 300 * 2 ** attempt));
    }
  }
}

async function ensureFiles(paths, signal, report) {
  const entries = paths.flatMap(entriesOf);
  const total = entries.reduce((s, e) => s + e.size, 0);
  let loaded = 0, lastT = 0;
  const missing = [];
  for (const e of entries) { if (await isCached(e)) loaded += e.size; else missing.push(e); }
  const tell = (force) => { const t = now(); if (force || t - lastT > 100) { lastT = t; report(loaded, total, missing.length); } };
  tell(true);
  // three downloads at a time; the first failure stops the others
  const inner = new AbortController();
  const onAbort = () => inner.abort();
  signal.addEventListener('abort', onAbort);
  let i = 0, firstErr = null;
  const lane = async () => {
    while (i < missing.length && !firstErr) {
      const e = missing[i++];
      try { await downloadEntry(e, inner.signal, (n) => { loaded += n; tell(false); }); }
      catch (err) { if (!firstErr) { firstErr = err; inner.abort(); } }
    }
  };
  await Promise.all([lane(), lane(), lane()]);
  signal.removeEventListener('abort', onAbort);
  if (firstErr) throw signal.aborted ? new GenError('aborted', 'Cancelled') : firstErr;
  tell(true);
  return { total, downloaded: missing.reduce((s, e) => s + e.size, 0) };
}

async function readEntry(e, retry = true) {
  const k = keyUrl(e);
  let bytes = mem.get(k);
  if (!bytes && cache) {
    try {
      const r = await cache.match(k);
      if (r) bytes = new Uint8Array(await r.arrayBuffer());
    } catch { bytes = null; }                            // unreadable entry: treat as missing
  }
  if (bytes && bytes.length === e.size) return bytes;
  if (!retry) throw new GenError('model_download', 'Cached file is damaged: ' + e.path);
  mem.delete(k);                                         // missing, evicted or damaged: fetch it again once
  if (cache) { await cache.delete(k).catch(() => {}); await cache.delete(okUrl(e)).catch(() => {}); }
  await downloadEntry(e, new AbortController().signal, () => {});
  return readEntry(e, false);
}

async function readFile(path) {
  const f = manifest.files[path];
  if (!f.parts) return readEntry(entriesOf(path)[0]);
  const out = new Uint8Array(f.size);                    // one allocation; parts are read into it one by one
  let o = 0;
  for (const p of f.parts) { out.set(await readEntry(p), o); o += p.size; }
  return out;
}

// Pyodide (and anything else here) fetches its files by URL: answer those from the verified store
self.fetch = async (input, init) => {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;   // Pyodide passes URL objects
    const href = new URL(raw, self.location.href).href.split(/[?#]/)[0];
    if (href.startsWith(BASE.href)) {
      const rel = href.slice(BASE.href.length);
      if (manifest.files[rel]) return new Response(await readFile(rel), { status: 200, headers: { 'content-type': mime(rel) } });
    }
  } catch (e) {
    if (e instanceof GenError) throw e;
    console.debug('[halom-gen] could not serve from the store, using the network:', String((input && input.url) || input), e);
  }
  return realFetch(input, init);
};

async function importFile(path) {
  const url = URL.createObjectURL(new Blob([await readFile(path)], { type: 'text/javascript' }));
  try { return await import(url); }
  catch { return await import(new URL(path, BASE).href); }      // e.g. a page policy that forbids blob: scripts
  finally { URL.revokeObjectURL(url); }
}

// ---------------------------------------------------------------------------------------------------------
// runtime
let ort = null, py = null, bridge = null, cfg = null, versions = null;
const sessions = {};
const timings = { download: 0, runtime: 0, models: 0 };

function fatalise(err, fallbackCode) {
  if (err instanceof GenError) return err;
  const msg = String((err && err.message) || err);
  if (/out of memory|cannot enlarge memory|allocation failed|oom|memory\.grow|could not allocate/i.test(msg) || err instanceof RangeError)
    return new GenError('memory', 'This device ran out of memory for the generator. ' + msg.slice(0, 200), true);
  return new GenError(fallbackCode, msg.slice(0, 600));
}

async function session(kind) {
  if (sessions[kind]) return sessions[kind];
  const m = manifest.models[kind][cfg[kind]];
  const bytes = await readFile(m.file);
  const s = await ort.InferenceSession.create(bytes, {
    executionProviders: ['wasm'], graphOptimizationLevel: 'all', logSeverityLevel: 3,
    enableCpuMemArena: false, enableMemPattern: false,   // measured: the smallest wasm heap, same speed
    ...(cfg.sessionOptions || {}),
  });
  sessions[kind] = s;
  return s;
}

async function releaseSession(kind) {
  const s = sessions[kind];
  delete sessions[kind];
  if (s) await s.release().catch(() => {});
}

async function init(id, opts) {
  const preset = manifest.presets[opts.quality || 'default'];
  if (!preset) throw new GenError('internal', 'Unknown quality: ' + opts.quality);
  cfg = { matte: (opts.models && opts.models.matte) || preset.matte, depth: (opts.models && opts.models.depth) || preset.depth, lowMemory: !!opts.lowMemory, sessionOptions: opts.sessionOptions || null };
  for (const k of ['matte', 'depth']) if (!manifest.models[k][cfg[k]]) throw new GenError('internal', `Unknown ${k} model: ${cfg[k]}`);
  const ctl = new AbortController();
  aborters.set(id, ctl);

  let t = now();
  await openCache();
  const paths = [...manifest.runtime, manifest.models.matte[cfg.matte].file, manifest.models.depth[cfg.depth].file];
  const dl = await ensureFiles(paths, ctl.signal, (loaded, total, pending) =>
    progress(id, { phase: 'download', loaded, total, message: pending ? 'downloading the generator' : 'generator files ready' }));
  timings.download = now() - t;
  checkAbort(id);

  t = now();
  progress(id, { phase: 'runtime', loaded: 0, total: 2, message: 'starting' });
  try {
    ort = await importFile('vendor/ort/ort.wasm.bundle.min.mjs');
    ort.env.wasm.numThreads = 1;                         // no SharedArrayBuffer on plain static hosting
    ort.env.wasm.proxy = false;
    ort.env.wasm.wasmBinary = (await readFile('vendor/ort/ort-wasm-simd-threaded.wasm')).buffer;
    ort.env.logLevel = 'error';
    await importFile('vendor/pyodide/pyodide.asm.js');   // defines _createPyodideModule, so Pyodide does not fetch it itself
    const { loadPyodide } = await importFile('vendor/pyodide/pyodide.mjs');
    const index = new URL('vendor/pyodide/', BASE).href;
    py = await loadPyodide({ indexURL: index, packageBaseUrl: index, stdout: () => {}, stderr: (s) => console.debug('[halom-gen py]', s) });
    progress(id, { phase: 'runtime', loaded: 1, total: 2, message: 'starting' });
    checkAbort(id);
    await py.loadPackage(['numpy', 'opencv-python', 'pillow'], { messageCallback: () => {}, errorCallback: (s) => console.debug('[halom-gen py]', s) });
    const dec = new TextDecoder();
    py.FS.mkdirTree('/gen');
    py.FS.writeFile('/gen/pipeline.py', dec.decode(await readFile('pipeline.py')));
    py.FS.writeFile('/gen/bridge.py', dec.decode(await readFile('bridge.py')));
    py.runPython('import sys\nsys.path.insert(0, "/gen")');
    bridge = py.pyimport('bridge');
    versions = bridge.versions().toJs({ dict_converter: Object.fromEntries });
  } catch (err) {
    if (err instanceof GenError) throw err;
    throw fatalise(err, 'unsupported');                  // the files were verified, so this is the browser
  }
  timings.runtime = now() - t;
  progress(id, { phase: 'runtime', loaded: 2, total: 2, message: 'starting' });
  checkAbort(id);

  t = now();
  if (!cfg.lowMemory) {
    progress(id, { phase: 'models', loaded: 0, total: 2, message: 'preparing the models' });
    try {
      await session('matte');
      progress(id, { phase: 'models', loaded: 1, total: 2, message: 'preparing the models' });
      checkAbort(id);
      await session('depth');
    } catch (err) { throw fatalise(err, 'unsupported'); }
    progress(id, { phase: 'models', loaded: 2, total: 2, message: 'preparing the models' });
  }
  timings.models = now() - t;
  if (mem.size) {
    // no Cache Storage (private window, quota): do not sit on a second copy of what is already loaded
    const keep = cfg.lowMemory ? new Set([manifest.models.matte[cfg.matte].file, manifest.models.depth[cfg.depth].file].flatMap(entriesOf).map(keyUrl)) : new Set();
    for (const k of [...mem.keys()]) if (!keep.has(k)) mem.delete(k);
  }
  aborters.delete(id);
  progress(id, { phase: 'ready', loaded: 1, total: 1, message: 'ready' });
  return {
    matteModel: cfg.matte, depthModel: cfg.depth, lowMemory: cfg.lowMemory,
    runtime: runtimeString(), versions: { ...versions, pyodide: py.version, onnxruntimeWeb: manifest.versions.onnxruntimeWeb },
    cache: cacheState, downloadedBytes: dl.downloaded, totalBytes: dl.total,
    ms: { download: Math.round(timings.download), runtime: Math.round(timings.runtime), models: Math.round(timings.models) },
  };
}

const runtimeString = () =>
  `pyodide ${py.version} (python ${versions.python}, opencv ${versions.opencv}, numpy ${versions.numpy}, pillow ${versions.pillow}) + onnxruntime-web ${manifest.versions.onnxruntimeWeb} wasm x1`;

// ---------------------------------------------------------------------------------------------------------
// jobs. Only ONE analysed photo lives in the Python heap; the others are parked as Blobs (the browser may
// keep those on disk) and brought back when build() needs them.
const jobs = new Map();
let hydrated = null, jobSeq = 0;

function u8(pyBytes) {                                    // Python bytes/memoryview -> Uint8Array copy
  const b = pyBytes.getBuffer();
  try { return b.data.slice(); } finally { b.release(); pyBytes.destroy(); }
}

async function park() {
  if (hydrated === null) return;
  const j = jobs.get(hydrated);
  if (j && !j.blob) j.blob = new Blob([u8(bridge.pack())]);
  bridge.drop();
  hydrated = null;
}

async function hydrate(jobId) {
  if (hydrated === jobId) return;
  await park();
  const j = jobs.get(jobId);
  bridge.unpack(new Uint8Array(await j.blob.arrayBuffer()), j.w, j.h);
  hydrated = jobId;
}

async function infer(kind, data, dims) {
  const s = await session(kind);
  const input = new ort.Tensor('float32', data, dims);
  const name = s.outputNames[0];
  let out;
  try { out = await s.run({ [s.inputNames[0]]: input }, [name]); }
  finally { input.dispose(); }
  const t = out[name];
  const res = { data: t.data, dims: Array.from(t.dims) };
  t.dispose();
  return res;
}

async function browserDecode(blob) {
  // for formats Pillow does not read but this browser does (HEIC in Safari, AVIF): the browser turns and scales it
  let bmp;
  try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch { return null; }
  try {
    const sw = bmp.width, sh = bmp.height;
    if (!sw || !sh || sw * sh > 120e6) return null;
    const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
    const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
    const c = new OffscreenCanvas(w, h);
    const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.drawImage(bmp, 0, 0, w, h);
    return { rgba: new Uint8Array(g.getImageData(0, 0, w, h).data.buffer), w, h, sw, sh };
  } catch { return null; }
  finally { bmp.close(); }
}

async function analyse(id, { blob, name }) {
  if (!(blob instanceof Blob)) throw new GenError('bad_image', 'Not a file.');
  if (blob.size === 0) throw new GenError('bad_image', 'The file is empty.');
  if (blob.size > MAX_FILE) throw new GenError('bad_image', 'The photo is larger than 15 MB.');
  const t0 = now();
  progress(id, { phase: 'decode', loaded: 0, total: 1, message: 'reading the photo' });
  await park();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  checkAbort(id);
  let info;
  try {
    info = bridge.open_photo(bytes).toJs({ dict_converter: Object.fromEntries });
    if (info.error === 'too_large') throw new GenError('bad_image', 'The photo has too many pixels.');
    if (info.error) {
      const d = await browserDecode(blob);
      if (!d) throw new GenError('bad_image', 'This file is not a photo this browser can read.');
      info = bridge.open_rgba(d.rgba, d.w, d.h, d.sw, d.sh, info.sha256, info.bytes).toJs({ dict_converter: Object.fromEntries });
    }
    hydrated = -1;                                          // Python holds a photo that is not a job yet
    const ms = { decode: now() - t0, matte: 0, depth: 0 };
    let prev = null;
    for (;;) {
      await sleep(0);                                       // let an abort message in
      checkAbort(id);
      const need = bridge.step();
      if (need === undefined || need === null) break;
      const [kind, index, shape] = need.toJs();
      need.destroy();
      if (cfg.lowMemory && prev && prev !== kind) await releaseSession(prev);   // one model in memory at a time
      prev = kind;
      progress(id, kind === 'matte'
        ? { phase: 'matte', loaded: index, total: 2, message: 'finding the dish' }
        : { phase: 'depth', loaded: 0, total: 1, message: 'measuring depth' });
      const x = new Float32Array(u8(bridge.take_input()).buffer);
      const t = now();
      const out = await infer(kind, x, shape);
      ms[kind] += now() - t;
      bridge.feed(kind, out.data, out.dims);
    }
    if (cfg.lowMemory) for (const k of Object.keys(sessions)) await releaseSession(k);
    const jobId = ++jobSeq;
    jobs.set(jobId, { w: info.work_width, h: info.work_height, blob: null, info, name: name || '', ms });
    hydrated = jobId;
    progress(id, { phase: 'depth', loaded: 1, total: 1, message: 'measuring depth' });
    return { job: jobId, width: info.width, height: info.height, sourceSha256: info.sha256, name: name || '' };
  } catch (err) {
    try { bridge.drop(); } catch { /* runtime gone */ }
    hydrated = null;
    if (cfg.lowMemory) for (const k of Object.keys(sessions)) await releaseSession(k);
    throw fatalise(err, 'internal');
  }
}

async function build(id, { job, relief, angle, name, debug }) {
  const j = jobs.get(job);
  if (!j) throw new GenError('released', 'This photo was released; analyse it again.');
  const t0 = now();
  progress(id, { phase: 'build', loaded: 0, total: 1, message: 'building' });
  let r;
  try {
    await hydrate(job);
    await sleep(0);
    checkAbort(id);
    const res = bridge.build(relief, angle, name === undefined || name === null ? j.name : name, !!debug);
    r = res.toJs({ dict_converter: Object.fromEntries, create_pyproxies: false });
    res.destroy();
  } catch (err) { throw fatalise(err, 'internal'); }
  if (r.error === 'no_dish') throw new GenError('no_dish', r.message);
  const buildMs = now() - t0;
  const meta = { e: r.meta.e, h: r.meta.h };
  if (r.meta.o) { meta.o = Array.from(r.meta.o); meta.s = r.meta.s; }
  if (r.meta.warn) meta.warn = r.meta.warn;
  progress(id, { phase: 'build', loaded: 1, total: 1, message: 'building' });
  return {
    color: new Blob([r.color], { type: 'image/jpeg' }),
    aux: new Blob([r.aux], { type: 'image/png' }),
    thumb: new Blob([r.thumb], { type: 'image/jpeg' }),
    debug: r.debug ? new Blob([r.debug], { type: 'image/jpeg' }) : null,
    kind: r.kind, meta,
    provenance: {
      pipeline: manifest.pipeline,
      matteModel: cfg.matte + '@' + manifest.files[manifest.models.matte[cfg.matte].file].sha256.slice(0, 12),
      depthModel: cfg.depth + '@' + manifest.files[manifest.models.depth[cfg.depth].file].sha256.slice(0, 12),
      runtime: runtimeString(),
      ms: Math.round(j.ms.decode + j.ms.matte + j.ms.depth + buildMs),
      msParts: { decode: Math.round(j.ms.decode), matte: Math.round(j.ms.matte), depth: Math.round(j.ms.depth), build: Math.round(buildMs) },
      sourceSha256: j.info.sha256, width: j.info.width, height: j.info.height,
      workWidth: j.info.work_width, workHeight: j.info.work_height, decoder: j.info.decoder,
    },
  };
}

function release({ job }) {
  jobs.delete(job);
  if (hydrated === job) { try { bridge.drop(); } catch { /* */ } hydrated = null; }
}

function stats() {
  return {
    jobs: jobs.size, hydrated,
    parkedBytes: [...jobs.values()].reduce((s, j) => s + (j.blob ? j.blob.size : 0), 0),
    wasmBytes: wasmMemories.map((m) => m.buffer.byteLength),
    cache: cacheState, sessions: Object.keys(sessions),
  };
}

// ---------------------------------------------------------------------------------------------------------
// messages
const aborted = new Set(), aborters = new Map(), pending = new Set();
const checkAbort = (id) => { if (aborted.has(id)) throw new GenError('aborted', 'Cancelled'); };
const progress = (id, p) => self.postMessage({ id, type: 'progress', progress: p });
let queue = Promise.resolve();

const OPS = { init, analyse, build, release: (_id, a) => release(a), stats: () => stats() };

self.onmessage = (ev) => {
  const { id, op, args } = ev.data;
  if (op === 'abort') {
    if (pending.has(args.id)) { aborted.add(args.id); const c = aborters.get(args.id); if (c) c.abort(); }
    return;
  }
  pending.add(id);
  queue = queue.then(async () => {
    try {
      checkAbort(id);
      if (op !== 'init' && op !== 'stats' && !bridge) throw new GenError('internal', 'Generator is not ready.');
      const value = await OPS[op](id, args || {});
      self.postMessage({ id, type: 'result', value });
    } catch (err) {
      const e = err instanceof GenError ? err : fatalise(err, 'internal');
      self.postMessage({ id, type: 'error', code: e.code, message: e.message, fatal: !!e.fatal });
    } finally { pending.delete(id); aborted.delete(id); aborters.delete(id); }
  });
};
self.postMessage({ type: 'hello' });
