// Halom relief generator, browser side. One photo of a dish -> a relief hologram (a cut-out plus an approximate
// height map made from that ONE photo; not a 3D model and not a measurement).
//
//   import { createGenerator, supported } from '../gen/gen.js';
//   const gen = await createGenerator({ onProgress: ({ phase, loaded, total, message }) => {} });
//   const job = await gen.analyse(fileOrBlob, { name: 'Shakshuka' });        // slow: cut-out + depth
//   const out = await gen.build(job, { relief: 'auto', angle: 'auto' });     // quick: call again to change the depth class
//   gen.release(job); gen.dispose();
//
// Runs fully in this browser: the photo is not uploaded anywhere by this module. The runtime and the models are
// downloaded once from this folder and kept in the browser's Cache Storage.
//
// Progress phases: download (bytes) -> runtime -> models -> ready; then per photo decode -> matte -> depth; build.
// Errors are Error objects with .code:
//   no_dish         nothing found in the photo (thrown by build)
//   bad_image       not a readable image, empty, or larger than 15 MB
//   unsupported     this browser cannot run the generator
//   model_download  a runtime or model file could not be fetched
//   aborted         cancelled through an AbortSignal
//   memory          the device ran out of memory (make a new generator, or use a computer)
//   released        the job was released or the generator disposed
//   internal        anything unexpected (message has the detail)
import manifest from './manifest.js';

const RELIEFS = ['auto', 'flat', 'low', 'medium', 'tall', 'stand'];
const ANGLES = ['auto', 'low', 'mid', 'high', 'top'];

function coded(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

let supportCache = null;
/** Why this browser can or cannot run the generator. Cheap, synchronous, no network. */
export function capabilities() {
  if (supportCache) return supportCache;
  const c = { wasm: false, simd: false, worker: typeof Worker === 'function', moduleWorker: false, bigint: typeof BigInt64Array === 'function',
    cacheStorage: typeof caches !== 'undefined', blob: typeof Blob === 'function' };
  try {
    c.wasm = typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
    // (module (func (result v128) i32.const 0 i8x16.splat i8x16.popcnt)): validates only with fixed-width SIMD
    c.simd = c.wasm && WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  } catch { /* stays false */ }
  try {
    // the options bag is only read for `type` by browsers that know module workers
    const probe = { get type() { c.moduleWorker = true; return 'module'; } };
    new Worker('data:text/javascript,', probe).terminate();
  } catch { /* stays as detected */ }
  c.ok = c.wasm && c.simd && c.worker && c.moduleWorker && c.bigint && c.blob;
  supportCache = Object.freeze(c);
  return supportCache;
}

/** true if this browser can run the generator. */
export function supported() {
  return capabilities().ok;
}

/** What createGenerator() will download the first time, in bytes, for a quality preset. */
export function downloadSize(quality = 'default') {
  const p = manifest.presets[quality];
  if (!p) return null;
  const paths = [...manifest.runtime, manifest.models.matte[p.matte].file, manifest.models.depth[p.depth].file];
  return paths.reduce((s, f) => s + manifest.files[f].size, 0);
}

/** Remove the downloaded runtime and models from this browser. */
export async function clearCache() {
  if (typeof caches === 'undefined') return false;
  let any = false;
  for (const k of await caches.keys()) if (k.startsWith('halom-gen-')) any = (await caches.delete(k)) || any;
  return any;
}

/** Phones and low-memory computers: keep one model in memory at a time (a little slower per photo). */
function guessLowMemory() {
  try {
    if (typeof navigator === 'undefined') return false;
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true;
    return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '') || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent || ''));
  } catch { return false; }
}

/**
 * Load the runtime and the models (cached after the first time) and return a generator.
 * @param {{ onProgress?: Function, signal?: AbortSignal, quality?: string,
 *           models?: { matte?: string, depth?: string }, lowMemory?: boolean|'auto' }} [options]
 *   quality: a preset from manifest.js. 'default' = small cut-out model, smallest download; 'best' = the full
 *   cut-out model (slower, bigger download, keeps thin parts such as pan handles and glass stems more often).
 *   lowMemory: 'auto' (default) turns it on for phones, tablets and devices reporting 4 GB or less.
 */
export async function createGenerator(options = {}) {
  const { onProgress, signal, quality = 'default', models, sessionOptions } = options;
  const lowMemory = options.lowMemory === undefined || options.lowMemory === 'auto' ? guessLowMemory() : !!options.lowMemory;
  if (!supported()) throw coded('unsupported', 'This browser cannot run the generator (needs WebAssembly with SIMD and module workers).');
  if (signal && signal.aborted) throw coded('aborted', 'Cancelled');

  let worker;
  try { worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module', name: 'halom-gen' }); }
  catch (e) { throw coded('unsupported', 'Could not start the generator worker: ' + e.message); }

  let seq = 0, dead = null;
  const calls = new Map();
  const tell = (cb, p) => { if (typeof cb === 'function') { try { cb(p); } catch { /* a listener must not break the run */ } } };
  const kill = (err) => {
    if (dead) return;
    dead = err;
    worker.terminate();
    for (const c of calls.values()) c.reject(err);
    calls.clear();
  };

  worker.onmessage = (ev) => {
    const m = ev.data;
    const c = calls.get(m.id);
    if (!c) {
      // an analysis that finished just as it was aborted: nobody holds its handle, so free it
      if (m.type === 'result' && m.value && m.value.job) worker.postMessage({ id: ++seq, op: 'release', args: { job: m.value.job } });
      return;
    }
    if (m.type === 'progress') return tell(c.onProgress, m.progress);
    calls.delete(m.id);
    c.cleanup();
    if (m.type === 'result') return c.resolve(m.value);
    const err = coded(m.code, m.message);
    c.reject(err);
    if (m.fatal) kill(coded(m.code, m.message));
  };
  worker.onerror = (ev) => {
    // the worker script itself failed to load or crashed
    kill(coded(seq <= 1 ? 'model_download' : 'internal', 'The generator worker stopped: ' + (ev.message || 'could not load worker.js')));
  };

  function call(op, args, { signal: sig, onProgress: cb } = {}) {
    if (dead) return Promise.reject(coded(dead.code === 'memory' ? 'memory' : 'released', dead.message));
    if (sig && sig.aborted) return Promise.reject(coded('aborted', 'Cancelled'));
    const id = ++seq;
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        if (!calls.has(id)) return;
        calls.delete(id);
        cleanup();
        worker.postMessage({ op: 'abort', args: { id } });   // the worker drops the work at its next checkpoint
        reject(coded('aborted', 'Cancelled'));
      };
      const cleanup = () => { if (sig) sig.removeEventListener('abort', onAbort); };
      if (sig) sig.addEventListener('abort', onAbort, { once: true });
      calls.set(id, { resolve, reject, cleanup, onProgress: cb || onProgress });
      worker.postMessage({ id, op, args });
    });
  }

  let info;
  try {
    info = await call('init', { quality, models, lowMemory, sessionOptions }, { signal, onProgress });
  } catch (e) {
    kill(e);
    throw e;
  }

  const handles = new WeakMap();
  const idOf = (job) => {
    const id = job && handles.get(job);
    if (!id) throw coded('released', 'This is not a live job of this generator.');
    return id;
  };

  const gen = {
    /** Models, runtime versions and what was downloaded for this generator. */
    info: Object.freeze({ ...info, pipeline: manifest.pipeline, build: manifest.build }),

    supported,

    /**
     * The slow part: read the photo, find the dish, measure depth. Returns a handle for build().
     * @param {Blob} file  JPEG, PNG or WebP (anything else only if this browser can decode it), at most 15 MB
     * @param {{ name?: string, signal?: AbortSignal, onProgress?: Function }} [opts]  name: the dish name, used to guess the depth class
     */
    async analyse(file, opts = {}) {
      if (typeof Blob !== 'function' || !(file instanceof Blob)) throw coded('bad_image', 'Not a file.');
      if (file.size === 0) throw coded('bad_image', 'The file is empty.');
      if (file.size > 15 * 1024 * 1024) throw coded('bad_image', 'The photo is larger than 15 MB.');
      const r = await call('analyse', { blob: file, name: opts.name == null ? '' : String(opts.name) }, opts);
      const job = Object.freeze({ name: r.name, width: r.width, height: r.height, sourceSha256: r.sourceSha256 });
      handles.set(job, r.job);
      return job;
    },

    /**
     * Turn an analysed photo into the files. Quick compared with analyse(); call it again to change the depth class.
     * @param {object} job  from analyse()
     * @param {{ relief?: 'auto'|'flat'|'low'|'medium'|'tall'|'stand', angle?: 'auto'|'low'|'mid'|'high'|'top'|number|[number,number],
     *           name?: string, debug?: boolean, signal?: AbortSignal, onProgress?: Function }} [opts]
     * @returns {Promise<{ color: Blob, aux: Blob, thumb: Blob, debug: Blob|null, kind: string,
     *                     meta: { e: number, h: number, o?: number[], s?: number, warn?: string }, provenance: object }>}
     */
    async build(job, opts = {}) {
      const { relief = 'auto', angle = 'auto', name, debug = false } = opts;
      if (!RELIEFS.includes(relief)) throw new TypeError('relief must be one of ' + RELIEFS.join(', '));
      const okAngle = ANGLES.includes(angle) || (typeof angle === 'number' && isFinite(angle))
        || (Array.isArray(angle) && angle.length === 2 && angle.every((v) => typeof v === 'number' && isFinite(v)));
      if (!okAngle) throw new TypeError('angle must be auto, low, mid, high, top, a number of degrees or [min, max]');
      return call('build', { job: idOf(job), relief, angle, name: name == null ? null : String(name), debug: !!debug }, opts);
    },

    /** Forget an analysed photo and free its memory. */
    release(job) {
      const id = job && handles.get(job);
      if (!id || dead) return;
      handles.delete(job);
      call('release', { job: id }).catch(() => {});
    },

    /** Memory and cache figures, for diagnostics. */
    stats() { return call('stats', {}); },

    /** Stop the worker and free everything. The generator cannot be used afterwards. */
    dispose() { kill(coded('released', 'The generator was disposed.')); },
  };
  return gen;
}

createGenerator.supported = supported;
export default createGenerator;
