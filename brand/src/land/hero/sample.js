/* Geometry helpers for the shape-shifting dish: bake a glTF mesh (quantized, with a node transform) into plain float
   attributes in "dish space" (bounding sphere radius 1, centred on x/z, base at y = 0), and sample N points on its
   surface (area-weighted, barycentric) with the base colour under each point. Points are ordered by a spatial key
   (equal-count height slices, then angle around the vertical axis) and then put through one shared permutation, so
   index i pairs dish A with dish B neighbour-to-neighbour, and any prefix of the buffer is an even subset of the dish. */

const yieldNow = () => new Promise((r) => setTimeout(r, 0));
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/* Runs fn(i) for i in [0, n) in slices of ~budget ms, yielding to the browser in between. */
export async function sliced(n, fn, budget = 8) {
  let t = now();
  for (let i = 0; i < n; i++) {
    fn(i);
    if ((i & 255) === 255 && now() - t > budget) { await yieldNow(); t = now(); }
  }
}

function floats(attr) {
  const n = attr.count, k = attr.itemSize, src = attr.array, out = new Float32Array(n * k);
  let div = 1;
  if (attr.normalized) {
    if (src instanceof Int8Array) div = 127; else if (src instanceof Uint8Array) div = 255;
    else if (src instanceof Int16Array) div = 32767; else if (src instanceof Uint16Array) div = 65535;
  }
  const stride = attr.isInterleavedBufferAttribute ? attr.data.stride : k, off = attr.isInterleavedBufferAttribute ? attr.offset : 0;
  const arr = attr.isInterleavedBufferAttribute ? attr.data.array : src;
  for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) {
    const v = arr[i * stride + off + j] / div;
    out[i * k + j] = attr.normalized && div !== 1 ? Math.max(v, -1) : v;
  }
  return out;
}

/* mesh: the loaded THREE.Mesh (world matrix up to date). Returns { pos, nrm, uv, index, height, foot } in dish space. */
export function bake(mesh) {
  const g = mesh.geometry, m = mesh.matrixWorld.elements;
  const pos = floats(g.attributes.position), nrm = g.attributes.normal ? floats(g.attributes.normal) : null;
  const uv = g.attributes.uv ? floats(g.attributes.uv) : null, n = pos.length / 3;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    const X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], Z = m[2] * x + m[6] * y + m[10] * z + m[14];
    pos[i * 3] = X; pos[i * 3 + 1] = Y; pos[i * 3 + 2] = Z;
    if (X < minX) minX = X; if (X > maxX) maxX = X; if (Y < minY) minY = Y; if (Y > maxY) maxY = Y; if (Z < minZ) minZ = Z; if (Z > maxZ) maxZ = Z;
    if (nrm) {
      const a = nrm[i * 3], b = nrm[i * 3 + 1], c = nrm[i * 3 + 2];
      let p = m[0] * a + m[4] * b + m[8] * c, q = m[1] * a + m[5] * b + m[9] * c, r = m[2] * a + m[6] * b + m[10] * c;
      const l = Math.hypot(p, q, r) || 1; nrm[i * 3] = p / l; nrm[i * 3 + 1] = q / l; nrm[i * 3 + 2] = r / l;
    }
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  let r2 = 0;
  for (let i = 0; i < n; i++) { const dx = pos[i * 3] - cx, dy = pos[i * 3 + 1] - cy, dz = pos[i * 3 + 2] - cz; const d = dx * dx + dy * dy + dz * dz; if (d > r2) r2 = d; }
  const s = 1 / Math.sqrt(r2 || 1);
  for (let i = 0; i < n; i++) { pos[i * 3] = (pos[i * 3] - cx) * s; pos[i * 3 + 1] = (pos[i * 3 + 1] - minY) * s; pos[i * 3 + 2] = (pos[i * 3 + 2] - cz) * s; }
  let index = g.index ? g.index.array : null;
  if (!index) { index = new Uint32Array(n); for (let i = 0; i < n; i++) index[i] = i; }
  return { pos, nrm, uv, index, height: (maxY - minY) * s, foot: Math.max(maxX - minX, maxZ - minZ) * s / 2 };
}

/* Reads an image (HTMLImageElement / ImageBitmap / canvas) into RGBA bytes at size×size. */
export function pixels(image, size = 256) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size).data;
  } catch (e) { return null; }
}

/* A seeded permutation of 0..n-1 (the same one for every dish). */
export function permutation(n, seed = 7) {
  let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const p = new Uint32Array(n); for (let i = 0; i < n; i++) p[i] = i;
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  return p;
}

/* Samples N surface points. Returns { pos: Float32Array(3N), col: Uint8Array(3N) } ordered as described above. */
export async function sampleSurface(baked, rgba, size, N, perm, seed = 1) {
  const { pos, nrm, uv, index } = baked, T = index.length / 3;
  let s = (seed * 2654435761) >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const cdf = new Float64Array(T); let total = 0;
  for (let t = 0; t < T; t++) {
    const a = index[t * 3] * 3, b = index[t * 3 + 1] * 3, c = index[t * 3 + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    total += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); cdf[t] = total;
  }
  const P = new Float32Array(N * 3), C = new Float32Array(N * 3);
  await sliced(N, (i) => {
    const r = rnd() * total; let lo = 0, hi = T - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < r) lo = mid + 1; else hi = mid; }
    const ia = index[lo * 3], ib = index[lo * 3 + 1], ic = index[lo * 3 + 2];
    let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; } const w = 1 - u - v;
    for (let k = 0; k < 3; k++) P[i * 3 + k] = pos[ia * 3 + k] * w + pos[ib * 3 + k] * u + pos[ic * 3 + k] * v;
    let R = 0.85, G = 0.6, B = 0.35;
    if (uv && rgba) {
      const tu = uv[ia * 2] * w + uv[ib * 2] * u + uv[ic * 2] * v, tv = uv[ia * 2 + 1] * w + uv[ib * 2 + 1] * u + uv[ic * 2 + 1] * v;
      const px = Math.min(size - 1, Math.max(0, Math.floor((tu - Math.floor(tu)) * size)));
      const py = Math.min(size - 1, Math.max(0, Math.floor((tv - Math.floor(tv)) * size)));
      const o = (py * size + px) * 4; R = rgba[o] / 255; G = rgba[o + 1] / 255; B = rgba[o + 2] / 255;
    }
    let shade = 1;
    if (nrm) { const ny = nrm[ia * 3 + 1] * w + nrm[ib * 3 + 1] * u + nrm[ic * 3 + 1] * v; shade = 0.8 + 0.25 * ny; }
    C[i * 3] = R * shade; C[i * 3 + 1] = G * shade; C[i * 3 + 2] = B * shade;
  });
  // order: equal-count height slices, then angle in each slice (packed keys sort natively and fast)
  const slices = Math.max(8, Math.round(Math.sqrt(N / 40))), key = new Float64Array(N);
  for (let i = 0; i < N; i++) key[i] = Math.floor(Math.min(1, Math.max(0, P[i * 3 + 1] / 2.2)) * 1048575) * 65536 + i;
  key.sort();
  const order = new Uint32Array(N);
  for (let sl = 0; sl < slices; sl++) {
    const a = Math.floor(sl * N / slices), b = Math.floor((sl + 1) * N / slices), k2 = new Float64Array(b - a);
    for (let j = a; j < b; j++) { const i = key[j] % 65536; k2[j - a] = Math.floor(((Math.atan2(P[i * 3 + 2], P[i * 3]) / (2 * Math.PI)) + 0.5) * 1048575) * 65536 + i; }
    k2.sort();
    for (let j = a; j < b; j++) order[j] = k2[j - a] % 65536;
    if (sl % 8 === 7) await yieldNow();
  }
  const pos3 = new Float32Array(N * 3), col = new Uint8Array(N * 3);
  for (let k = 0; k < N; k++) {
    const i = order[perm[k]];
    for (let j = 0; j < 3; j++) { pos3[k * 3 + j] = P[i * 3 + j]; col[k * 3 + j] = Math.max(0, Math.min(255, Math.round(C[i * 3 + j] * 255))); }
  }
  return { pos: pos3, col };
}
