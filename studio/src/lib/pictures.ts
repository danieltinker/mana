// The picture flow of BACKEND.md, step by step, and the queue that runs it one photo at a time.
// The queue lives in this module (not in a screen), so it keeps working while the owner moves around the app.
import { signal } from '@preact/signals';
import { sb, q, cfg, sibling, toAppError, AppError, publicUrl } from './api.ts';
import { D, applyLocal, onReset, currentGeneration, bumpDraft, type Asset } from './store.ts';
import { resize, squareThumb } from './images.ts';

const PRIVATE = 'menu-private', PUBLIC = 'menu-public';
const UPLOAD_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_BYTES = 15 * 1024 * 1024;

// ---------------------------------------------------------------- the generator ("the studio")
export type Studio = { status: 'unknown' | 'checking' | 'unsupported' | 'unavailable' | 'idle' | 'loading' | 'ready' | 'failed'; phase: string; loaded: number; total: number; size: number; cached: boolean; error: string };
export const studio = signal<Studio>({ status: 'unknown', phase: '', loaded: 0, total: 0, size: 0, cached: false, error: '' });
let genModule: any = null, genPromise: Promise<any> | null = null, genCtl: AbortController | null = null;
const setStudio = (p: Partial<Studio>) => { studio.value = { ...studio.value, ...p }; };

/** Cheap: loads the small generator module (not the models) and asks whether this browser can run it. */
export async function checkStudio(): Promise<Studio> {
  if (studio.value.status !== 'unknown') return studio.value;
  setStudio({ status: 'checking' });
  try {
    genModule = await import(/* @vite-ignore */ sibling(cfg!.genPath || '../gen/', 'gen.js'));
    let cached = false;
    try { cached = typeof caches !== 'undefined' && (await caches.keys()).some((k) => k.startsWith('halom-gen-')); } catch { /* private window */ }
    setStudio({ status: genModule.supported() ? 'idle' : 'unsupported', size: genModule.downloadSize('default') || 0, cached });
  } catch (e) {
    setStudio({ status: 'unavailable', error: String((e as any)?.message || e) });
  }
  return studio.value;
}

/** Download (first time on this device) and start the generator. Safe to call many times. */
export function prepareStudio(): Promise<any> {
  if (genPromise) return genPromise;
  genCtl = new AbortController();
  const ctl = genCtl;
  genPromise = (async () => {
    const st = await checkStudio();
    if (st.status === 'unsupported') throw new AppError('unsupported');
    if (st.status === 'unavailable') throw new AppError('model_download');
    setStudio({ status: 'loading', phase: 'download', loaded: 0, total: st.size, error: '' });
    const gen = await genModule.createGenerator({
      signal: ctl.signal,
      onProgress: (p: any) => {
        if (studio.value.status !== 'loading') return;
        if (p.phase === 'download') setStudio({ phase: 'download', loaded: p.loaded || 0, total: p.total || studio.value.total });
        else if (p.phase === 'runtime' || p.phase === 'models') setStudio({ phase: p.phase });
      },
    });
    setStudio({ status: 'ready', phase: 'ready', cached: true });
    return gen;
  })();
  genPromise.catch((e) => {
    genPromise = null;
    const code = (e && e.code) || 'internal';
    if (code === 'aborted') setStudio({ status: 'idle', phase: '' });
    else if (code === 'unsupported') setStudio({ status: 'unsupported' });
    else setStudio({ status: 'failed', error: code });
  });
  return genPromise;
}
export function cancelStudioDownload() { if (genCtl && studio.value.status === 'loading') genCtl.abort(); }
async function dropGenerator() {
  const p = genPromise; genPromise = null; handles.clear();
  if (p) { try { (await p).dispose(); } catch { /* never started */ } }
  if (studio.value.status === 'ready') setStudio({ status: 'idle', phase: '' });
}

// ---------------------------------------------------------------- what this session remembers about pictures
export type Job = { assetId: string; itemId: string | null; phase: 'waiting' | 'upload' | 'studio' | 'decode' | 'matte' | 'depth' | 'build' | 'save'; ctl: AbortController; cancelled?: boolean };
export const jobs = signal<Job[]>([]);
export const busyAsset = signal<Record<string, string>>({});          // assetId → what is being done to it outside the queue
export const localError = signal<Record<string, string>>({});         // assetId → error code this session saw (e.g. limit_attempts)
const originals = new Map<string, Blob>();                              // assetId → the photo as chosen
const handles = new Map<string, any>();                                 // assetId → analysed photo (quick rebuild)
const blobUrls = new Map<string, string>();                             // "<assetId>/<file>" → object URL of what we just made
const signed = new Map<string, { url: string; until: number }>();
export const urlVersion = signal(0);                                    // bumps when a picture's files change

onReset(() => {
  for (const j of jobs.value) j.ctl.abort();
  uploads.clear();
  jobs.value = []; busyAsset.value = {}; localError.value = {};
  originals.clear(); handles.clear(); signed.clear();
  for (const u of blobUrls.values()) URL.revokeObjectURL(u);
  blobUrls.clear();
});

const assetOf = (id: string): Asset | undefined => D.value?.assets.find((a) => a.id === id);
const setJob = (id: string, patch: Partial<Job>) => { jobs.value = jobs.value.map((j) => (j.assetId === id ? { ...j, ...patch } : j)); };
const setBusy = (id: string, what: string | null) => { const b = { ...busyAsset.value }; if (what) b[id] = what; else delete b[id]; busyAsset.value = b; };
const setLocalError = (id: string, code: string | null) => { const b = { ...localError.value }; if (code) b[id] = code; else delete b[id]; localError.value = b; };
function rememberBlob(assetId: string, file: string, blob: Blob) {
  const k = assetId + '/' + file, old = blobUrls.get(k);
  if (old) URL.revokeObjectURL(old);
  blobUrls.set(k, URL.createObjectURL(blob));
  urlVersion.value++;
}
async function updateAsset(id: string, patch: any): Promise<Asset> {
  const gen = currentGeneration();
  const row = await q<Asset>(sb.from('assets').update(patch).eq('id', id).select().single());
  if (gen === currentGeneration()) applyLocal('assets', id, row);
  return row;
}
async function upload(bucket: string, path: string, blob: Blob, type: string, upsert = true) {
  const body = blob.type === type ? blob : new Blob([blob], { type });
  try { await q(sb.storage.from(bucket).upload(path, body, { contentType: type, upsert, cacheControl: '3600' })); }
  catch (e) { const err = toAppError(e); throw err.code === 'network' ? err : new AppError(['too_large', 'bad_type', 'forbidden', 'signed_out'].includes(err.code) ? err.code : 'upload', err.message); }
}

/** A URL to show one of a picture's files: what we made in this session, the public copy once approved, or a signed link. */
export async function fileUrl(asset: Asset, file: 'original' | 'color' | 'aux' | 'thumb'): Promise<string | null> {
  const local = blobUrls.get(asset.id + '/' + file);
  if (local) return local;
  const path = asset[file + '_path'];
  if (!path) return null;
  if (asset.status === 'approved' && file !== 'original') return publicUrl(path) + '?v=' + encodeURIComponent(asset.updated_at || '');
  const hit = signed.get(path + '|' + asset.updated_at);
  if (hit && hit.until > Date.now() + 60000) return hit.url;
  const data = await q<any>(sb.storage.from(PRIVATE).createSignedUrl(path, 3600));
  signed.set(path + '|' + asset.updated_at, { url: data.signedUrl, until: Date.now() + 3600e3 });
  return data.signedUrl;
}

export async function originalOf(asset: Asset): Promise<Blob> {
  const mem = originals.get(asset.id);
  if (mem) return mem;
  if (!asset.original_path) throw new AppError('upload_lost');
  const blob = await q<Blob>(sb.storage.from(PRIVATE).download(asset.original_path));
  originals.set(asset.id, blob);
  return blob;
}

// ---------------------------------------------------------------- step 1: a photo is chosen
/** Make sure the photo is something both the storage bucket and the generator accept; re-encode it here if not. */
async function prepareOriginal(file: Blob): Promise<{ blob: Blob; ext: string; type: string }> {
  if (!file || file.size === 0) throw new AppError('bad_image');
  if (UPLOAD_TYPES[file.type] && file.size <= MAX_BYTES) return { blob: file, ext: UPLOAD_TYPES[file.type], type: file.type };
  const jpeg = await resize(file, 4096, 'image/jpeg', 0.92);          // HEIC/AVIF/huge photos: only if this browser can read them
  if (jpeg.size > MAX_BYTES) throw new AppError('too_large');
  return { blob: jpeg, ext: 'jpg', type: 'image/jpeg' };
}

const uploads = new Map<string, Promise<void>>();                    // assetId → the upload of its original, started the moment it is chosen
function startUpload(assetId: string, businessId: string, blob: Blob, ext: string): Promise<void> {
  const path = `${businessId}/${assetId}/original.${ext}`;
  const p = (async () => { await upload(PRIVATE, path, blob, blob.type || 'image/jpeg'); await updateAsset(assetId, { original_path: path }); })();
  uploads.set(assetId, p);
  p.catch(() => {}).finally(() => { if (uploads.get(assetId) === p) uploads.delete(assetId); });
  return p;
}

export async function addPhoto(itemId: string, file: Blob): Promise<string> {
  const d = D.value!; const gen = currentGeneration();
  const prepared = await prepareOriginal(file);
  const row = await q<Asset>(sb.from('assets').insert({ business_id: d.biz.id, item_id: itemId, status: 'uploaded', kind: 'relief' }).select().single());
  if (gen !== currentGeneration()) return row.id;
  D.value = { ...D.value!, assets: [row, ...D.value!.assets] };
  originals.set(row.id, prepared.blob);
  rememberBlob(row.id, 'original', prepared.blob);
  startUpload(row.id, row.business_id, prepared.blob, prepared.ext).catch(() => {});      // the original is safe in storage even if the tab closes while it waits its turn
  enqueue(row.id, itemId);
  return row.id;
}

function enqueue(assetId: string, itemId: string | null) {
  if (jobs.value.some((j) => j.assetId === assetId)) return;
  setLocalError(assetId, null);
  jobs.value = [...jobs.value, { assetId, itemId, phase: 'waiting', ctl: new AbortController() }];
  pump();
}

// ---------------------------------------------------------------- step 2: the queue
let pumping = false;
async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    for (;;) {
      const job = jobs.value.find((j) => j.phase === 'waiting');
      if (!job) break;
      const gen = currentGeneration();
      await runJob(job).catch(() => {});
      if (gen !== currentGeneration()) break;
      jobs.value = jobs.value.filter((j) => j.assetId !== job.assetId);
    }
  } finally { pumping = false; }
}

async function runJob(job: Job) {
  const id = job.assetId, signal = job.ctl.signal;
  const gen0 = currentGeneration();
  const stale = () => gen0 !== currentGeneration();
  const check = () => { if (signal.aborted) throw new AppError('aborted'); };
  try {
    let row = assetOf(id);
    if (!row) return;
    if (!row.original_path) {
      setJob(id, { phase: 'upload' });
      let pending = uploads.get(id);
      if (!pending) {
        const blob = originals.get(id);
        if (!blob) throw new AppError('upload_lost');
        pending = startUpload(id, row.business_id, blob, UPLOAD_TYPES[blob.type] || 'jpg');
      }
      await pending;
      check();
      row = assetOf(id)!;
    }
    check();
    if (row.status !== 'processing') row = await updateAsset(id, { status: 'processing', error_code: null });       // the database counts the attempt here
    const blob = await originalOf(row);
    check();
    setJob(id, { phase: 'studio' });
    const g = await prepareStudio();
    check();
    const item = D.value?.items.find((i) => i.id === row!.item_id);
    const name = item ? item.name_en || item.name_he || '' : '';
    const onProgress = (p: any) => { if (['decode', 'matte', 'depth', 'build'].includes(p.phase)) setJob(id, { phase: p.phase }); };
    setJob(id, { phase: 'decode' });
    const old = handles.get(id); if (old) { try { g.release(old); } catch { /* gone */ } handles.delete(id); }
    const handle = await g.analyse(blob, { name, signal, onProgress });
    keepHandle(g, id, handle);
    const out = await g.build(handle, { relief: 'auto', name, signal, onProgress });
    check();
    setJob(id, { phase: 'save' });
    await saveResult(row, out);
  } catch (e: any) {
    if (stale()) return;
    const code = failureCode(e);
    if (code === 'memory') dropGenerator();
    setLocalError(id, code);
    const row = assetOf(id);
    if (row && code !== 'limit_attempts') {
      try { await updateAsset(id, { status: 'failed', error_code: code }); }
      catch { applyLocal('assets', id, { status: 'failed', error_code: code }); }         // offline: say so on screen; the row is picked up again on the next visit
    }
  }
}
const GEN_CODES = ['no_dish', 'bad_image', 'unsupported', 'model_download', 'aborted', 'memory', 'released', 'internal'];
function failureCode(e: any): string {
  const c = e && e.code;
  if (typeof c === 'string' && GEN_CODES.includes(c)) return c;
  const err = toAppError(e);
  return err.code === 'unknown' ? 'internal' : err.code;
}
function keepHandle(g: any, id: string, handle: any) {
  handles.set(id, handle);
  while (handles.size > 3) {                                   // each analysed photo parks ~15 MB: keep only the latest few
    const [oldId, oldHandle] = handles.entries().next().value as [string, any];
    handles.delete(oldId);
    try { g.release(oldHandle); } catch { /* gone */ }
  }
}

async function saveResult(row: Asset, out: any) {
  const base = `${row.business_id}/${row.id}/`;
  await upload(PRIVATE, base + 'color.jpg', out.color, 'image/jpeg');
  await upload(PRIVATE, base + 'aux.png', out.aux, 'image/png');
  await upload(PRIVATE, base + 'thumb.jpg', out.thumb, 'image/jpeg');
  rememberBlob(row.id, 'color', out.color); rememberBlob(row.id, 'aux', out.aux); rememberBlob(row.id, 'thumb', out.thumb);
  const meta: any = { e: out.meta.e, h: out.meta.h };
  if (out.meta.o != null) meta.o = out.meta.o;
  if (out.meta.s != null) meta.s = out.meta.s;
  if (out.meta.warn) meta.warn = String(out.meta.warn).slice(0, 400);
  await updateAsset(row.id, { status: 'ready_for_review', kind: 'relief', relief_class: out.kind, color_path: base + 'color.jpg', aux_path: base + 'aux.png', thumb_path: base + 'thumb.jpg',
    meta, provenance: out.provenance || {}, error_code: null });
  setLocalError(row.id, null);
}

export function cancelJob(assetId: string) {
  const job = jobs.value.find((j) => j.assetId === assetId);
  if (!job) return;
  job.ctl.abort();
  if (job.phase === 'waiting') {
    jobs.value = jobs.value.filter((j) => j.assetId !== assetId);
    updateAsset(assetId, { status: 'failed', error_code: 'aborted' }).catch(() => applyLocal('assets', assetId, { status: 'failed', error_code: 'aborted' }));
  }
}

/** "Try again": back to step 2 with the same photo (the database allows five tries per picture). */
export function retry(assetId: string) {
  const row = assetOf(assetId);
  if (row) enqueue(assetId, row.item_id);
}

/** Pictures a closed tab left half-way. */
export function unfinished(): Asset[] {
  const d = D.value; if (!d) return [];
  const active = new Set(jobs.value.map((j) => j.assetId));
  return d.assets.filter((a) => (a.status === 'uploaded' || a.status === 'processing') && !active.has(a.id));
}
export async function resumeUnfinished() {
  for (const a of unfinished()) {
    if (!a.original_path && !originals.has(a.id)) {            // the upload itself never finished: there is nothing to continue from
      await updateAsset(a.id, { status: 'failed', error_code: 'upload_lost' }).catch(() => {});
      continue;
    }
    enqueue(a.id, a.item_id);
  }
}
export async function discardUnfinished() {
  for (const a of unfinished()) await updateAsset(a.id, { status: 'failed', error_code: 'aborted' }).catch(() => {});
}

// ---------------------------------------------------------------- step 3: review
/** Build again with another depth class (no new attempt is counted: the picture stays in review). */
export async function rebuild(assetId: string, relief: string) {
  const row = assetOf(assetId); if (!row) return;
  setBusy(assetId, 'rebuild');
  try {
    const g = await prepareStudio();
    let handle = handles.get(assetId);
    const item = D.value?.items.find((i) => i.id === row.item_id);
    const name = item ? item.name_en || item.name_he || '' : '';
    if (!handle) {                                               // after a reload the analysed photo is gone: analyse the stored original again
      setBusy(assetId, 'analyse');
      handle = await g.analyse(await originalOf(row), { name });
      keepHandle(g, assetId, handle);
      setBusy(assetId, 'rebuild');
    }
    const out = await g.build(handle, { relief, name });
    await saveResult(row, out);
  } catch (e) {
    const code = failureCode(e);
    if (code === 'memory') dropGenerator();
    throw new AppError(code);
  } finally { setBusy(assetId, null); }
}

/** "Use the photo as it is": a plain photo, never presented as 3D. Goes to review like any other picture. */
export async function usePhoto(assetId: string) {
  const row = assetOf(assetId); if (!row) return;
  setBusy(assetId, 'photo');
  try {
    const src = await originalOf(row);
    const color = await resize(src, 1280, 'image/jpeg', 0.88), thumb = await squareThumb(src, 256);
    const base = `${row.business_id}/${row.id}/`;
    await upload(PRIVATE, base + 'color.jpg', color, 'image/jpeg');
    await upload(PRIVATE, base + 'thumb.jpg', thumb, 'image/jpeg');
    rememberBlob(assetId, 'color', color); rememberBlob(assetId, 'thumb', thumb);
    blobUrls.delete(assetId + '/aux');
    await updateAsset(assetId, { status: 'ready_for_review', kind: 'photo', relief_class: null, color_path: base + 'color.jpg', thumb_path: base + 'thumb.jpg', aux_path: null, meta: {}, error_code: null });
    setLocalError(assetId, null);
  } catch (e) { throw toAppError(e); }
  finally { setBusy(assetId, null); }
}

// ---------------------------------------------------------------- step 4: approve
async function copyToPublic(path: string) {
  const copy = () => q(sb.storage.from(PRIVATE).copy(path, path, { destinationBucket: PUBLIC }));
  try { await copy(); }
  catch (e) {
    if (toAppError(e).code !== 'duplicate') throw e;
    await q(sb.storage.from(PUBLIC).remove([path]));               // an earlier approval of the same picture: replace the copy
    await copy();
  }
}
export async function approve(assetId: string) {
  const row = assetOf(assetId); if (!row) return;
  setBusy(assetId, 'approve');
  try {
    if (row.status !== 'approved') {
      await copyToPublic(row.color_path);
      await copyToPublic(row.thumb_path);
      if (row.kind === 'relief') await copyToPublic(row.aux_path);
    }
    // one call marks the picture approved AND points its dish at it (BACKEND.md v2), so a closed tab cannot leave it half done
    const gen = currentGeneration();
    const r = await q<any>(sb.rpc('approve_asset', { p_asset: assetId }));
    if (!r || !r.ok) throw new AppError(String((r && r.code) || 'unknown'));
    const fresh = await q<Asset>(sb.from('assets').select('*').eq('id', assetId).single());
    if (gen === currentGeneration()) { applyLocal('assets', assetId, fresh); if (row.item_id) applyLocal('items', row.item_id, { asset_id: assetId }); bumpDraft(); }
    const h = handles.get(assetId);
    if (h && genPromise) { try { (await genPromise).release(h); } catch { /* gone */ } handles.delete(assetId); }
  } catch (e) { throw toAppError(e); }
  finally { setBusy(assetId, null); }
}

export async function reject(assetId: string) {
  const row = assetOf(assetId); if (!row) return;
  setBusy(assetId, 'reject');
  try {
    const user = D.value?.items.find((i) => i.asset_id === assetId);
    if (user) {                                                    // an approved picture in use: the item lets go of it first
      const gen = currentGeneration();
      await q(sb.from('items').update({ asset_id: null }).eq('id', user.id).select('id').single());
      if (gen === currentGeneration()) applyLocal('items', user.id, { asset_id: null });
    }
    await updateAsset(assetId, { status: 'rejected' });
    bumpDraft();
  } catch (e) { throw toAppError(e); }
  finally { setBusy(assetId, null); }
}

/** The picture an item is working with right now: the newest attempt that was not rejected, else the approved one in use. */
export function currentAsset(itemId: string): Asset | null {
  const d = D.value; if (!d) return null;
  const item = d.items.find((i) => i.id === itemId);
  const mine = d.assets.filter((a) => a.item_id === itemId && a.status !== 'rejected');           // newest first (load order)
  const live = item && item.asset_id ? d.assets.find((a) => a.id === item.asset_id) : null;
  const newest = mine[0] || null;
  if (newest && live && newest.id !== live.id && (newest.status === 'failed' && newest.error_code === 'aborted')) return live;
  return newest || live || null;
}

export function statusKey(a: any): string {
  if (a.status === 'ready_for_review') return a.kind === 'photo' ? 'pic.st.ready_photo' : 'pic.st.ready_relief';
  if (a.status === 'approved') return a.kind === 'photo' ? 'pic.st.approved_photo' : 'pic.st.approved_relief';
  return 'pic.st.' + a.status;
}
