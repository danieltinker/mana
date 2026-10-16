/**
 * What a reader tells the owner beside the draft: what it left out and why, and what it read but wants checked. The
 * draft's own exceptions (`draftExceptions`, @mana/contracts) are about the draft; these notes are about the source.
 * `info` = nothing to do; `check` = worth a look in the preview (a sold-out mark, a price shown as a range…).
 * A note never carries the source's text, only line numbers and the draft key it concerns.
 */

export const NOTES = {
  /** The input was empty, or held nothing but blank lines. */
  empty_input: 'info',
  /** The input was longer than `IMPORT_TEXT_MAX`; the rest was not read. */
  input_truncated: 'check',
  /** The source had more than `DRAFT_CAPS` allows (sections, dishes, groups, options); the rest was left out. */
  caps_reached: 'check',
  /** Lines recognised as not being menu content (`rule` says which: header, rating, delivery, hours, fee, …). */
  noise: 'info',
  /** A line no rule could place; left out (counted in `dropped`). */
  line_unknown: 'info',
  /** A section's own text (a sub-title, a line about the whole section): a draft section has no place for it. */
  section_text: 'info',
  /** A heading with no dish under it. */
  section_empty: 'info',
  /** The page's "Popular" section, which repeats dishes of other sections, was left out. */
  popular_dropped: 'info',
  /** Some dishes of the "Popular" section appear in no other section: the copy may be missing part of the page. */
  popular_only: 'check',
  /** A label outside Mana's tags (kosher, organic…), left out: tags come only from `TAGS`. */
  label_dropped: 'info',
  /** The source marks the dish sold out. Mana does not make it unavailable: the owner decides. */
  sold_out: 'check',
  /** Several prices, a range or "from": the first price was taken and the price note keeps what the source showed. */
  price_range: 'check',
  /** Two prices side by side (a discount and the regular price): the higher, regular price was taken. */
  price_discount: 'check',
  /** No price beside the dish; the price on the sheet's "Add to order" button was taken. */
  price_from_button: 'check',
  /** A text longer than the draft allows was shortened. */
  text_clipped: 'check',
  /** A group's stated limits are outside what Mana allows (or contradict each other); they were left unstated. */
  limits_dropped: 'check',
  /** More pre-selected options than the group allows; none is kept pre-selected. */
  defaults_cleared: 'check',
  /** Choices (a group heading, option lines) with no dish before them. */
  group_orphan: 'info',
  /** A group heading names an option ("Sauce for fries") that the dish does not show: kept as a plain group. */
  nesting_unmatched: 'info',
  /** The scanner's answer for a page stopped before its end (too long); what arrived is kept. */
  page_truncated: 'check',
  /** The scanner found no menu on a page, or could not read it. */
  page_unreadable: 'check',
} as const;
export type NoteCode = keyof typeof NOTES;
export type NoteSeverity = (typeof NOTES)[NoteCode];
export const NOTE_CODES = Object.keys(NOTES) as NoteCode[];

export type ReaderNote = {
  readonly code: NoteCode;
  readonly severity: NoteSeverity;
  /** The draft node it concerns (a section, dish or group key), or null for the whole input. */
  readonly key: string | null;
  /** 1-based lines of the source (text readers; the scanner's pages for page notes), at most `NOTE_LINES_MAX`. */
  readonly lines: readonly number[];
  /** How many lines or nodes the note stands for (can be more than `lines` holds). */
  readonly count: number;
  /** For `noise`: the rule that recognised the lines. */
  readonly rule: string | null;
};

export const NOTE_LINES_MAX = 100;

/** A note on a node before the draft has keys: resolved to the node's key when the draft is built. */
export type PendingNote = { readonly code: NoteCode; readonly lines: readonly number[] };

/** Collects whole-input notes, merging those with the same code and rule. */
export class NoteBook {
  private readonly byId = new Map<string, { code: NoteCode; key: string | null; rule: string | null; lines: number[]; count: number }>();

  add(code: NoteCode, lines: readonly number[] = [], o: { key?: string | null; rule?: string | null; count?: number } = {}): void {
    const key = o.key ?? null, rule = o.rule ?? null;
    const id = `${code}|${key ?? ''}|${rule ?? ''}`;
    let n = this.byId.get(id);
    if (!n) this.byId.set(id, (n = { code, key, rule, lines: [], count: 0 }));
    for (const l of lines) if (n.lines.length < NOTE_LINES_MAX && !n.lines.includes(l)) n.lines.push(l);
    n.count += o.count ?? Math.max(1, lines.length);
  }

  /** In a stable order: by code (the order of `NOTES`), then key, then rule. */
  list(): ReaderNote[] {
    const rank = new Map(NOTE_CODES.map((c, i) => [c, i] as const));
    return [...this.byId.values()]
      .map((n) => ({ code: n.code, severity: NOTES[n.code], key: n.key, lines: [...n.lines].sort((a, b) => a - b), count: n.count, rule: n.rule }))
      .sort((a, b) => rank.get(a.code)! - rank.get(b.code)! || cmp(a.key ?? '', b.key ?? '') || cmp(a.rule ?? '', b.rule ?? ''));
  }
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
