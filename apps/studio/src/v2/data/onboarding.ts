// The setup flow's state (F03): the open place's onboarding progress (saved at every step, so its owner comes back to
// the same step on any device), its menu imports, the scanner's availability, and where "back to setup" leads from a
// screen the flow sent the owner to. One place at a time: switching place or account drops it (`onReset`).
//
// Reads: `onboarding_progress` and `menu_imports` (the client columns, never the raw text) under their row-level security
// (owners, managers, Halom). Writes: only the RPCs (`set_onboarding_step`, the import RPCs in data/imports.ts), each input
// checked with the contracts' validator first; an account that may not edit (a counter) is refused before the network.
import { signal } from '@preact/signals';
import { onboardingProgress, validateSetStep, type OnboardingProgress, type OnboardingState, type OnboardingStep, type ImportDraft } from '@mana/contracts';
import { decode, resize, sniff } from '../../lib/images.ts';
import { fnUrl } from '../../lib/api.ts';
import { cfg, q, rpc, sb } from './client.ts';
import { toV2Error, V2Error } from './errors.ts';
import { asImportLine, IMAGE_BYTES_MAX, imagePath, imagesHash, importsApi, IMPORT_SELECT, type ImageSource, type ImportLine, type ScanReply } from './imports.ts';
import type { ReaderNote } from '@mana/import';
import { mayWrite, menu, onReset } from './store.ts';

export const progress = signal<OnboardingProgress | null>(null);
export const progressError = signal('');
/** The place's imports, newest first (null until read). */
export const imports = signal<ImportLine[] | null>(null);
/** The scanner here: `off` when the config does not offer it or the function says it is not configured. */
export const scanner = signal<'unknown' | 'checking' | 'on' | 'off'>('unknown');
/** The step that sent the owner to another screen of the app (hours, an add-on group, the menu): the shell offers the way back. */
export const returnTo = signal<OnboardingStep | null>(null);
/**
 * What a reader said about a source, kept for this session by import (until `menu_imports.notes` stores them, the
 * preview of an import read on another device shows the stored notes only). A reader's own codes stay here.
 */
const sessionNotes = new Map<string, readonly ReaderNote[]>();
export const notesFor = (importId: string): readonly ReaderNote[] | null => sessionNotes.get(importId) ?? null;
export const keepNotes = (importId: string, notes: readonly ReaderNote[]) => { sessionNotes.set(importId, notes); };

let generation = 0;
onReset(() => { generation++; progress.value = null; progressError.value = ''; imports.value = null; returnTo.value = null; sessionNotes.clear(); });

export const importApi = importsApi(rpc);

const vid = () => menu.value!.venue.id;

/** The place's progress, from its stored steps (a step never written is `todo`). */
export async function loadProgress(): Promise<OnboardingProgress | null> {
  const d = menu.value; if (!d) return null;
  const gen = generation;
  try {
    const rows = await q<{ step: OnboardingStep; state: OnboardingState; blockers: string[]; updated_at: string }[]>(
      sb.from('onboarding_progress').select('step, state, blockers, updated_at').eq('venue_id', d.venue.id));
    if (gen !== generation) return null;
    const p = onboardingProgress(rows.map((r) => ({ step: r.step, state: r.state, blockers: r.blockers, updatedAt: r.updated_at })));
    progress.value = p; progressError.value = '';
    return p;
  } catch (e) {
    if (gen === generation) progressError.value = toV2Error(e).code;
    return null;
  }
}

/** Mark a step (set_onboarding_step); the reply is the whole progress, which goes on screen. */
export async function setStep(step: OnboardingStep, state: OnboardingState, blockers?: readonly string[]): Promise<OnboardingProgress> {
  mayWrite();
  const gen = generation;
  const v = validateSetStep({ venueId: vid(), step, state, ...(blockers ? { blockers } : {}) });
  if (!v.ok) throw new V2Error(v.errors[0]!.code, v.errors);
  const r = await rpc<{ ok: true; progress: OnboardingProgress }>('set_onboarding_step', { p_venue: v.value.venueId, p_step: step, p_state: state, p_blockers: blockers ?? null });
  if (gen === generation) progress.value = r.progress;
  return r.progress;
}

/** The place's imports, newest first, without the raw input. */
export async function loadImports(): Promise<ImportLine[] | null> {
  const d = menu.value; if (!d) return null;
  const gen = generation;
  const rows = await q<Record<string, unknown>[]>(sb.from('menu_imports').select(IMPORT_SELECT).eq('venue_id', d.venue.id).order('created_at', { ascending: false }).limit(30));
  if (gen !== generation) return null;
  const list = rows.map(asImportLine);
  imports.value = list;
  return list;
}

/** One import, read again (after the scanner or another device changed it). */
export async function loadImport(id: string): Promise<ImportLine | null> {
  const rows = await q<Record<string, unknown>[]>(sb.from('menu_imports').select(IMPORT_SELECT).eq('id', id));
  const line = rows[0] ? asImportLine(rows[0]) : null;
  if (line && imports.value) imports.value = [line, ...imports.value.filter((x) => x.id !== id)].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return line;
}

/** The pictures of the place's dishes and their states, as the plan reads them (an import never adds a second photo). */
export const loadAssets = () => q<{ id: string; dish_id: string | null; status: string }[]>(sb.from('assets').select('id, dish_id, status').eq('venue_id', vid()));

// ---------------------------------------------------------------- the scanner
/**
 * Is the scanner here? Only when the config offers it (`features.scan`, as the v1 app reads it) and the function says
 * it is configured (its key is set: Daniel's gate). Otherwise the screens say so plainly and offer the text sources.
 */
export async function checkScanner(): Promise<'on' | 'off'> {
  if (!cfg?.features.scan) { scanner.value = 'off'; return 'off'; }
  if (scanner.value === 'on' || scanner.value === 'off') return scanner.value;
  scanner.value = 'checking';
  try {
    const r = await fetch(fnUrl('menus-ai'), { method: 'POST', headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'status' }) });
    const j = await r.json().catch(() => null) as { ok?: boolean; configured?: boolean } | null;
    scanner.value = j?.ok === true && j.configured === true ? 'on' : 'off';
  } catch { scanner.value = 'off'; }
  return scanner.value;
}

/** A picture ready to upload: the file as it is when the scanner can read it, else a JPEG at most 2400 px long. */
export type Prepared = { readonly bytes: Uint8Array; readonly type: 'image/jpeg' | 'image/png' | 'image/webp'; readonly ext: 'jpg' | 'png' | 'webp' };

/** The longest side the scanner's model reads in full (supabase/functions/menus-ai/README.md). */
const LONG_SIDE = 2400;

export async function prepareImage(file: Blob): Promise<Prepared> {
  const kind = await sniff(file);
  if (kind === 'heic' || kind === 'avif') throw new V2Error('heic');
  if (!kind) throw new V2Error('bad_image');
  const im = await decode(file).catch((e) => { throw new V2Error(toV2Error(e).code === 'heic' ? 'heic' : 'bad_image'); });
  const long = Math.max(im.w, im.h);
  im.close();
  const keep = (kind === 'jpeg' || kind === 'png' || kind === 'webp') && file.size <= IMAGE_BYTES_MAX && long <= LONG_SIDE;
  if (keep) {
    const type = kind === 'jpeg' ? 'image/jpeg' : kind === 'png' ? 'image/png' : 'image/webp';
    return { bytes: new Uint8Array(await file.arrayBuffer()), type, ext: kind === 'jpeg' ? 'jpg' : kind };
  }
  for (const [side, quality] of [[LONG_SIDE, 0.86], [1800, 0.8]] as const) {
    const out = await resize(file, side, 'image/jpeg', quality);
    if (out.size <= IMAGE_BYTES_MAX) return { bytes: new Uint8Array(await out.arrayBuffer()), type: 'image/jpeg', ext: 'jpg' };
  }
  throw new V2Error('too_big');
}

/**
 * Upload an import's pictures to the private bucket under its own folder (the id made here becomes the import's), then
 * create the import. An upload that was already stored (a try sent again) counts as stored.
 */
export async function createImageImport(source: ImageSource, importId: string, files: readonly Prepared[]): Promise<{ importId: string; status: string; reused: boolean }> {
  mayWrite();
  const venue = vid();
  const paths = files.map((f, i) => imagePath(venue, importId, i, f.ext));
  const inputSha256 = await imagesHash(files.map((f) => f.bytes));
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    const { error } = await sb.storage.from('menu-private').upload(paths[i]!, new Blob([f.bytes], { type: f.type }), { contentType: f.type, upsert: false });
    if (error) {
      const code = toV2Error(error).code;
      if (code !== 'duplicate' && !/exists|duplicate/i.test(String(error.message))) throw toV2Error(error);
    }
  }
  return importApi.create({ venueId: venue, source, importId, paths, inputSha256, rightsConfirmed: false });
}

/** Ask the scanner to read an image import (it claims the import with the owner's own token first). Never throws. */
export async function runScan(source: ImageSource, importId: string): Promise<ScanReply> {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, code: 'signed_out' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 150_000);
  try {
    const r = await fetch(fnUrl('menus-ai'), {
      method: 'POST', signal: ctl.signal,
      headers: { apikey: cfg!.supabaseKey, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: source === 'scan' ? 'scan_menu' : 'wolt_screenshots', import_id: importId }),
    });
    const j = await r.json().catch(() => null) as ScanReply | null;
    if (j && typeof j.ok === 'boolean') return j;
    return { ok: false, code: r.status === 429 ? 'rate_limited' : 'failed' };
  } catch (e) {
    const err = toV2Error(e);
    return { ok: false, code: err.code === 'aborted' ? 'timeout' : err.code === 'network' ? 'network' : 'failed' };
  } finally { clearTimeout(timer); }
}

/** Read a text import's draft into the database (save_import_draft), keeping the reader's notes for this session. */
export async function saveTextDraft(importId: string, draft: ImportDraft, notes: readonly ReaderNote[]) {
  mayWrite();
  keepNotes(importId, notes);
  return importApi.saveDraft(importId, draft, notes);
}
