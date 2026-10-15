// A light stand-in for ../../../../../gen/gen.js, for tests that are about the app around the generator (queue, resume,
// failures, review) and not about the generator itself. Same exports, phases and error codes as CONTRACT.md describes;
// the "relief" is the photo with a round matte and a dome for height. The real generator is exercised once, in a-journey.
// a test may slow it down (window.__fakeGenSlow = 5) to catch a photo while it is being worked on
const sleep = (ms) => new Promise((r) => setTimeout(r, ms * (Number(globalThis.__fakeGenSlow) || 1)));
const fail = (code, message) => Object.assign(new Error(message || code), { code });
const SIZE = 72 * 1000 * 1000;
export const supported = () => { try { return typeof WebAssembly === 'object' && WebAssembly.validate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])); } catch { return false; } };
export const capabilities = () => ({ wasm: supported(), fake: true });
export const downloadSize = () => SIZE;
export async function clearCache() { /* nothing is cached */ }

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const toBlob = (c, type, q) => new Promise((res) => c.toBlob((b) => res(b), type, q));

export async function createGenerator({ onProgress = () => {}, signal } = {}) {
  const check = () => { if (signal && signal.aborted) throw fail('aborted'); };
  if (!supported()) throw fail('unsupported');
  // the "download": one real request (so a test can make it fail), reported as the bytes of the real studio
  let r;
  try { r = await fetch(new URL('models/fake.bin', import.meta.url), { signal, cache: 'no-store' }); } catch (e) { throw fail(signal && signal.aborted ? 'aborted' : 'model_download'); }
  if (!r.ok) throw fail('model_download');
  await r.arrayBuffer();
  for (let i = 1; i <= 8; i++) { check(); onProgress({ phase: 'download', loaded: Math.round((SIZE * i) / 8), total: SIZE, message: 'downloading' }); await sleep(90); }
  onProgress({ phase: 'runtime', message: 'starting' }); await sleep(60); check();
  onProgress({ phase: 'models', message: 'loading models' }); await sleep(60); check();
  onProgress({ phase: 'ready', message: 'ready' });
  let live = true;
  const HEIGHT = { flat: 0.06, low: 0.12, medium: 0.2, tall: 0.35, stand: 1.82 };

  async function analyse(blob, { name = '', signal: s2, onProgress: p2 = () => {} } = {}) {
    const stop = () => { if ((s2 && s2.aborted) || (signal && signal.aborted)) throw fail('aborted'); if (!live) throw fail('released'); };
    p2({ phase: 'decode' });
    let bmp;
    try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { throw fail('bad_image'); }
    await sleep(250); stop();
    p2({ phase: 'matte' });
    // "is there a dish": a photo that is one flat colour has nothing in it
    const probe = canvas(32, 32), px = probe.getContext('2d', { willReadFrequently: true });
    px.drawImage(bmp, 0, 0, 32, 32);
    const d = px.getImageData(0, 0, 32, 32).data; let sum = 0, sq = 0;
    for (let i = 0; i < d.length; i += 4) { const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]; sum += l; sq += l * l; }
    const n = d.length / 4, variance = sq / n - (sum / n) ** 2;
    await sleep(350); stop();
    p2({ phase: 'depth' });
    await sleep(350); stop();
    return { bmp, w: bmp.width, h: bmp.height, empty: variance < 40, blob, drink: /beer|juice|wine|cola|drink|lemonade|coffee/i.test(name) };
  }

  async function build(job, { relief = 'auto', signal: s2, onProgress: p2 = () => {} } = {}) {
    if (!job || !job.bmp) throw fail('released');
    if ((s2 && s2.aborted) || (signal && signal.aborted)) throw fail('aborted');
    p2({ phase: 'build' });
    await sleep(180);
    if (job.empty) throw fail('no_dish');
    const kind = relief && relief !== 'auto' ? relief : job.drink || job.h > job.w * 1.15 ? 'stand' : 'medium';
    const side = Math.min(job.w, job.h), sx = (job.w - side) / 2, sy = (job.h - side) / 2;
    const draw = (S) => { const c = canvas(S, S), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); x.drawImage(job.bmp, sx, sy, side, side, 0, 0, S, S); return c; };
    const aux = canvas(512, 512), ax = aux.getContext('2d');
    ax.fillStyle = '#000'; ax.fillRect(0, 0, 512, 512);
    const g = ax.createRadialGradient(256, 256, 0, 256, 256, 200); g.addColorStop(0, 'rgb(255,255,0)'); g.addColorStop(1, 'rgb(40,255,0)');      // R = height (a dome), G = matte (solid inside the circle)
    ax.fillStyle = g; ax.beginPath(); ax.arc(256, 256, 200, 0, Math.PI * 2); ax.fill();
    const meta = { e: 48, h: HEIGHT[kind] ?? 0.2 };
    if (kind === 'stand') { meta.o = [0, -0.4]; meta.s = 0.62; }
    return { color: await toBlob(draw(768), 'image/jpeg', 0.86), aux: await toBlob(aux, 'image/png'), thumb: await toBlob(draw(256), 'image/jpeg', 0.84), debug: null, kind, meta,
      provenance: { pipeline: 'halom-relief/1', matteModel: 'fake', depthModel: 'fake', runtime: 'fake', ms: 1100, sourceSha256: '', width: job.w, height: job.h } };
  }
  return { analyse, build, release: (job) => { try { job && job.bmp && job.bmp.close(); } catch { /* closed */ } if (job) job.bmp = null; }, dispose: () => { live = false; }, info: { fake: true }, stats: () => ({}) };
}
