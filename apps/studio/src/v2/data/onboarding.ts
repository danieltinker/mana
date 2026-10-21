// The setup flow's state (F03): the open place's onboarding progress (saved at every step, so its owner comes back to
// the same step on any device), its menu imports, the scanner's availability, and where "back to setup" leads from a
// screen the flow sent the owner to. One place at a time: switching place or account drops it (`onReset`).
//
// Reads: `onboarding_progress` and `menu_imports` (the client columns, never the raw text) under their row-level security
// (owners, managers, Halom). Writes: only the RPCs (`set_onboarding_step`, the import RPCs in data/imports.ts), each input
// checked with the contracts' validator first; an account that may not edit (a counter) is refused before the network.
import { effect, signal } from '@preact/signals';
import {
  onboardingProgress, validateSetStep, type ImportDecisions, type ImportDraft, type OnboardingProgress, type OnboardingState, type OnboardingStep,
} from '@mana/contracts';
import { decode, resize, sniff } from '../../lib/images.ts';
import { fnUrl } from '../../lib/api.ts';
import { answersKey, forgetAnswersBut, readAnswers, writeAnswers } from './answers.ts';
import { cfg, q, rpc, sb } from './client.ts';
import { toV2Error, V2Error } from './errors.ts';
import { asImportLine, IMAGE_BYTES_MAX, imagePath, imagesHash, importsApi, IMPORT_SELECT, type ImageSource, type ImportLine, type ScanReply } from './imports.ts';
import { keptProgress, stepWriter } from './step-writes.ts';
import type { ReaderNote } from '@mana/import';
import { NO_DECISIONS } from './review.ts';
import { mayWrite, menu, onReset, session } from './store.ts';

export const progress = signal<OnboardingProgress | null>(null);
export const progressError = signal('');
/** The place's imports, newest first (null until read). */
export const imports = signal<ImportLine[] | null>(null);
/** Why the place's imports could not be read (the screens offer to try again), or ''. */
export const importsError = signal('');
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
onReset(() => { generation++; progress.value = null; progressError.value = ''; imports.value = null; importsError.value = ''; returnTo.value = null; sessionNotes.clear(); });

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

/** This place's step writes, one step's after another (data/step-writes.ts); a new writer with every place. */
function makeWriter() {
  const gen = generation;
  return stepWriter(async (step, state, blockers) => {
    try {
      const r = await rpc<{ ok: true; progress: OnboardingProgress }>('set_onboarding_step', { p_venue: vid(), p_step: step, p_state: state, p_blockers: blockers });
      return r.progress;
    } catch (e) {
      // the database kept what it has (a late `doing` over `done` or `skipped`): its progress is the answer
      const kept = keptProgress(toV2Error(e).detail);
      if (kept) return kept;
      throw e;
    }
  }, () => (gen === generation ? progress.value : null), (p) => { if (gen === generation) progress.value = p; });
}
let writeStep = makeWriter();
onReset(() => { writeStep = makeWriter(); });

/** Mark a step (set_onboarding_step), after that step's earlier writes; the reply is the whole progress, on screen. */
export async function setStep(step: OnboardingStep, state: OnboardingState, blockers?: readonly string[]): Promise<OnboardingProgress> {
  mayWrite();
  const v = validateSetStep({ venueId: vid(), step, state, ...(blockers ? { blockers } : {}) });
  if (!v.ok) throw new V2Error(v.errors[0]!.code, v.errors);
  const p = await writeStep(step, state, blockers ?? null);
  if (!p) throw new V2Error('not_found');
  return p;
}

/** The place's imports, newest first, without the raw input. */
export async function loadImports(): Promise<ImportLine[] | null> {
  const d = menu.value; if (!d) return null;
  const gen = generation;
  try {
    const rows = await q<Record<string, unknown>[]>(sb.from('menu_imports').select(IMPORT_SELECT).eq('venue_id', d.venue.id).order('created_at', { ascending: false }).limit(30));
    if (gen !== generation) return null;
    const list = rows.map(asImportLine).filter((x) => x.venue_id === d.venue.id);
    imports.value = list; importsError.value = '';
    return list;
  } catch (e) {
    if (gen === generation) importsError.value = toV2Error(e).code;
    throw e;
  }
}

/**
 * One import of the open place, read again (after the scanner or another device changed it). An import of another
 * place is never read here, and never joins the open place's list: `null`, as for one that does not exist.
 */
export async function loadImport(id: string): Promise<ImportLine | null> {
  const d = menu.value; if (!d) return null;
  const gen = generation;
  const rows = await q<Record<string, unknown>[]>(sb.from('menu_imports').select(IMPORT_SELECT).eq('id', id).eq('venue_id', d.venue.id));
  if (gen !== generation) return null;
  const line = rows[0] ? asImportLine(rows[0]) : null;
  if (!line || line.venue_id !== d.venue.id) return null;
  if (imports.value) imports.value = [line, ...imports.value.filter((x) => x.id !== id)].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return line;
}

/**
 * Which of the account's places an import belongs to, when it is not the open one (an address kept from another place:
 * Back after switching place, a link): its id, so the screen can offer to open that place. Only the id is read.
 */
export async function importPlace(id: string): Promise<string | null> {
  const rows = await q<{ venue_id: string }[]>(sb.from('menu_imports').select('venue_id').eq('id', id));
  return rows[0]?.venue_id ?? null;
}

// ---------------------------------------------------------------- the owner's answers, on this device
/** The signed-in account's answers to an import's questions (data/answers.ts). */
export function loadAnswers(importId: string): ImportDecisions {
  const u = session.value?.user?.id;
  if (!u) return NO_DECISIONS;
  try { return readAnswers(localStorage.getItem(answersKey(u, importId))); } catch { return NO_DECISIONS; }
}
export function keepAnswers(importId: string, d: ImportDecisions) {
  const u = session.value?.user?.id;
  if (!u) return;
  try { localStorage.setItem(answersKey(u, importId), writeAnswers(d)); } catch { /* storage is optional */ }
}
export function dropAnswers(importId: string) {
  const u = session.value?.user?.id;
  if (!u) return;
  try { localStorage.removeItem(answersKey(u, importId)); } catch { /* storage is optional */ }
}
// signed out (null), or another account signed in: every answer that is not the account's own goes (undefined: still
// finding out who is signed in)
effect(() => {
  const s = session.value;
  if (s === undefined) return;
  try { forgetAnswersBut(s?.user?.id ?? null, localStorage); } catch { /* storage is optional */ }
});

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

/** A picture ready to upload: drawn again and encoded anew (PNG or JPEG), at most 2400 px long. */
export type Prepared = { readonly bytes: Uint8Array<ArrayBuffer>; readonly type: 'image/jpeg' | 'image/png'; readonly ext: 'jpg' | 'png' };

/** The longest side the scanner's model reads in full (supabase/functions/menus-ai/README.md). */
const LONG_SIDE = 2400;

/**
 * Every picture is drawn again and encoded anew before it leaves the phone, whatever its size: what a camera writes
 * beside the picture (EXIF: where it was taken, the device, the time) is never uploaded, kept or sent to the model. A
 * screenshot (PNG) stays PNG when it fits, for its small text; anything else, or a PNG too large, becomes a JPEG.
 */
export async function prepareImage(file: Blob): Promise<Prepared> {
  const kind = await sniff(file);
  if (kind === 'heic' || kind === 'avif') throw new V2Error('heic');
  if (!kind) throw new V2Error('bad_image');
  const im = await decode(file).catch((e) => { throw new V2Error(toV2Error(e).code === 'heic' ? 'heic' : 'bad_image'); });
  im.close();
  const tries: readonly (readonly [number, 'image/png' | 'image/jpeg', number])[] = kind === 'png'
    ? [[LONG_SIDE, 'image/png', 1], [LONG_SIDE, 'image/jpeg', 0.9], [1800, 'image/jpeg', 0.8]]
    : [[LONG_SIDE, 'image/jpeg', 0.9], [1800, 'image/jpeg', 0.8]];
  for (const [side, type, quality] of tries) {
    const out = await resize(file, side, type, quality);
    if (out.size <= IMAGE_BYTES_MAX) return { bytes: new Uint8Array(await out.arrayBuffer()), type, ext: type === 'image/png' ? 'png' : 'jpg' };
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
