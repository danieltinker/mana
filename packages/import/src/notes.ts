/**
 * What a reader tells the owner beside the draft: the contracts' `READER_NOTES` (what it left out and why, and what it
 * read but wants checked), stored with the draft (`SaveDraftInput.notes`, `menu_imports.notes`). The draft's own
 * exceptions (`draftExceptions`) are about the draft; these notes are about the source. A note never carries the
 * source's text, only line numbers, counts and the draft key it concerns.
 *
 * One code is the text readers' own until the contracts have it (an open item for the architect): `price_ambiguous`.
 */
import { NOTE_LINES_MAX, NOTES_MAX, READER_NOTES, type ReaderNote as ContractNote, type ReaderNoteCode } from '@mana/contracts';

export const NOTES = {
  ...READER_NOTES,
  /** The name ends with a number that may be part of the name ("Combo 1", "Tea for 2", "since 1998") or two prices
   * ("House red 38 140"): the name was kept whole, with no price taken from it. */
  price_ambiguous: 'check',
} as const;
export type NoteCode = keyof typeof NOTES;
export type NoteSeverity = (typeof NOTES)[NoteCode];
export const NOTE_CODES = Object.keys(NOTES) as NoteCode[];
export { NOTE_LINES_MAX, NOTES_MAX };

/** A reader note: the contracts' `ReaderNote`, with the readers' own code. */
export type ReaderNote = Omit<ContractNote, 'code' | 'severity'> & { readonly code: NoteCode; readonly severity: NoteSeverity };

/** Is this note one the contracts know (so `save_import_draft` stores it)? */
export const contractNote = (n: ReaderNote): n is ContractNote => n.code in READER_NOTES;
export type { ReaderNoteCode };

/** A note on a node before the draft has keys: resolved to the node's key when the draft is built. */
export type PendingNote = { readonly code: NoteCode; readonly lines: readonly number[] };

/** Collects whole-input notes, merging those with the same code and rule. */
export class NoteBook {
  private readonly byId = new Map<string, { code: NoteCode; key: string | null; rule: string | null; lines: Set<number>; count: number }>();

  add(code: NoteCode, lines: readonly number[] = [], o: { key?: string | null; rule?: string | null; count?: number } = {}): void {
    const key = o.key ?? null, rule = o.rule ?? null;
    const id = `${code}|${key ?? ''}|${rule ?? ''}`;
    let n = this.byId.get(id);
    if (!n) this.byId.set(id, (n = { code, key, rule, lines: new Set(), count: 0 }));
    for (const l of lines) if (n.lines.size < NOTE_LINES_MAX) n.lines.add(l);
    n.count += o.count ?? Math.max(1, lines.length);
  }

  /**
   * In a stable order: by code (the order of `NOTES`), then key, then rule. At most `NOTES_MAX`: past it, the notes on
   * nodes of a code become one note on the whole input (their lines and counts joined), so nothing is lost but the key.
   */
  list(): ReaderNote[] {
    const rank = new Map(NOTE_CODES.map((c, i) => [c, i] as const));
    let notes = [...this.byId.values()].map((n) => ({ code: n.code, key: n.key, rule: n.rule, lines: [...n.lines], count: n.count }));
    if (notes.length > NOTES_MAX) {
      const joined = new Map<string, (typeof notes)[number]>();
      for (const n of notes) {
        const id = `${n.code}|${n.rule ?? ''}`;
        const j = joined.get(id);
        if (!j) { joined.set(id, { ...n, key: null, lines: [...n.lines] }); continue; }
        j.count = Math.min(1_000_000, j.count + n.count);
        for (const l of n.lines) if (j.lines.length < NOTE_LINES_MAX && !j.lines.includes(l)) j.lines.push(l);
      }
      notes = [...joined.values()];
    }
    return notes
      .map((n) => ({ code: n.code, severity: NOTES[n.code], key: n.key, lines: n.lines.sort((a, b) => a - b), count: Math.min(n.count, 1_000_000), rule: n.rule }))
      .sort((a, b) => rank.get(a.code)! - rank.get(b.code)! || cmp(a.key ?? '', b.key ?? '') || cmp(a.rule ?? '', b.rule ?? ''));
  }
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
