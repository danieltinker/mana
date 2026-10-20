// The menu import's calls (F03, ADR-006, ADR-008), stateless: each input is checked with the contracts' validator before
// it leaves the phone (the same codes the database answers), and every answer comes back as the database gave it.
// - Text sources (a pasted list, text copied from the owner's own Wolt page) are read here, on the phone, by
//   @mana/import's readers: no network, no model, no cost. Wolt is never fetched (D33): only what the owner pasted.
// - Image sources (photos of a printed menu, the owner's own Wolt screenshots) are uploaded to the private bucket under
//   the import's own folder, with an id made here, then read by the scanner (`menus-ai`), which claims the import with the
//   owner's own token before any paid call. The scanner is not always there: `scannerStatus` says so first.
// `importsApi(call)` takes the RPC caller, so the unit tests pass a fake one.
import {
  IMPORT_CLIENT_COLUMNS, IMPORT_IMAGES_MAX, IMPORT_TEXT_MAX, textLength, validateApplyImport, validateCreateImport, validateSaveDraft,
  type ApplyImportReply, type CreateImportInput, type CreateImportReply, type DiscardImportReply, type ExistingMenu, type ImportDecisions, type ImportDraft, type ImportSource,
  type MenuImportView, type ReaderNote as ContractNote, type SaveDraftReply, type Validation,
} from '@mana/contracts';
import { contractNote, parsePaste, parseWoltText, type ReaderNote } from '@mana/import';
import { V2Error } from './errors.ts';

export type TextSource = 'paste' | 'wolt_text';
export type ImageSource = 'scan' | 'wolt_screenshots';
export const isTextSource = (s: ImportSource): s is TextSource => s === 'paste' || s === 'wolt_text';

function checked<T>(v: Validation<T>): T {
  if (!v.ok) throw new V2Error(v.errors[0]!.code, v.errors);
  return v.value;
}

/** What a reader made of a text: the draft and its notes on the source (the readers' own codes among them). */
export type Reading = { readonly draft: ImportDraft; readonly notes: readonly ReaderNote[] };

/** Read a text on the phone. `text_missing` / `text_too_long` before reading, as `create_import` would answer. */
export function readText(source: TextSource, text: string): Reading {
  if (!text.trim()) throw new V2Error('text_missing');
  if (textLength(text) > IMPORT_TEXT_MAX) throw new V2Error('text_too_long');
  return source === 'paste' ? parsePaste(text) : parseWoltText(text);
}

/** The notes `save_import_draft` stores: the ones the contracts know (a reader's own codes stay on this screen only). */
export const storableNotes = (notes: readonly ReaderNote[]): ContractNote[] => notes.filter(contractNote);

/** A draft with no dish at all: nothing to review (an empty paste, or text that held no menu). */
export const isEmptyDraft = (d: ImportDraft): boolean => d.sections.every((s) => s.dishes.length === 0);

type Call = <T>(fn: string, args: Record<string, unknown>) => Promise<T>;

/**
 * The import RPCs over a caller that throws an RPC's `{ ok: false, code }` as a V2Error (`data/client.ts` `rpc`), so
 * each function answers its success or rejects with the code (an input its validator refuses too, before any call).
 */
export function importsApi(call: Call) {
  return {
    /** `create_import`: the same input as a live import of the place answers that import (`reused`), writing nothing. */
    async create(input: CreateImportInput): Promise<Extract<CreateImportReply, { ok: true }>> {
      const i = checked(validateCreateImport(input));
      return call('create_import', {
        p_venue: i.venueId, p_source: i.source, p_text: i.text ?? null, p_paths: i.paths ?? null, p_input_sha256: i.inputSha256 ?? null,
        p_rights_confirmed: i.rightsConfirmed, p_import_id: i.importId ?? null,
      });
    },
    /** `save_import_draft`: the draft read on the phone (or edited in the preview), with the notes the contracts know. */
    async saveDraft(importId: string, draft: ImportDraft, notes: readonly ReaderNote[] = []): Promise<Extract<SaveDraftReply, { ok: true }>> {
      const i = checked(validateSaveDraft({ importId, draft, notes: storableNotes(notes) }));
      return call('save_import_draft', { p_import: i.importId, p_draft: i.draft, p_notes: i.notes ?? [] });
    },
    /** `apply_import`: exactly the draft the database holds, with the owner's answers; the reply is the plan it ran. */
    async apply(importId: string, draft: ImportDraft, decisions: ImportDecisions): Promise<Extract<ApplyImportReply, { ok: true }>> {
      const i = checked(validateApplyImport({ importId, draft, decisions }));
      return call('apply_import', { p_import: i.importId, p_draft: i.draft, p_decisions: i.decisions });
    },
    /** `discard_import`: the owner gives an import up (twice is fine). */
    async discard(importId: string): Promise<DiscardImportReply> {
      return call('discard_import', { p_import: importId });
    },
  };
}

/** The columns a client may read of an import (never the raw text), as one select list. */
export const IMPORT_SELECT = IMPORT_CLIENT_COLUMNS.join(', ');
/** An import as read, with `notes` ([] until the column exists: `menu_imports.notes` comes with the backend's stage 2). */
export type ImportLine = MenuImportView;
export const asImportLine = (row: Record<string, unknown>): ImportLine => ({ notes: [], ...row }) as unknown as ImportLine;

/** The place's menu as the plan reads it (`ExistingMenu`), from the rows the app holds and the pictures read beside them. */
export function existingMenu(d: {
  sections: ExistingMenu['sections']; dishes: ExistingMenu['dishes']; groups: ExistingMenu['groups']; options: ExistingMenu['options'];
  dishGroups: ExistingMenu['dishGroups'];
}, assets: ExistingMenu['assets']): ExistingMenu {
  return { sections: d.sections, dishes: d.dishes, groups: d.groups, options: d.options, dishGroups: d.dishGroups, assets };
}

// ---------------------------------------------------------------- pictures for the scanner
/** The most images one import of this source takes (`IMPORT_IMAGES_MAX`); more are another import. */
export const imagesMax = (s: ImageSource): number => IMPORT_IMAGES_MAX[s];
/** The scanner reads at most this many bytes of one image (supabase/functions/menus-ai, `MAX_IMAGE_BYTES`). */
export const IMAGE_BYTES_MAX = 3_750_000;

const hex = (b: ArrayBuffer): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function sha256(data: BufferSource): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', data));
}

/**
 * The input's hash for `create_import` (`inputSha256`): the SHA-256 of the files' own SHA-256s, lowercase hex, joined in
 * order. The same pictures in the same order are the same input, so importing them again finds the earlier import.
 */
export async function imagesHash(files: readonly Uint8Array<ArrayBuffer>[]): Promise<string> {
  const each: string[] = [];
  for (const f of files) each.push(await sha256(f));
  return sha256(new TextEncoder().encode(each.join('')));
}

/** Where an import's n-th picture goes: `<venue>/imports/<import>/<n>.<ext>` (the folder the claim checks). */
export const imagePath = (venueId: string, importId: string, n: number, ext: 'jpg' | 'png' | 'webp'): string =>
  `${venueId.toLowerCase()}/imports/${importId.toLowerCase()}/${String(n + 1).padStart(2, '0')}.${ext}`;

/** What the scanner answers (supabase/functions/menus-ai, `ReadReply`), as far as this app reads it. */
export type ScanReply =
  | { readonly ok: true; readonly importId: string; readonly notes: readonly ReaderNote[]; readonly dropped: number }
  | { readonly ok: false; readonly code: string };
