/**
 * What a reader fills as it reads, before the draft exists: the same shape as `ImportDraft`, without keys, with a
 * dish's groups held by reference (so a reader never names or dedupes anything) and with notes on the nodes they
 * concern. `buildDraft` turns one or more of these into one draft.
 */
import { importKey, type DraftPhoto, type Lang, type LayoutGuessRule, type Room, type SectionKind, type SelectionKind, type Tag, type Text } from '@mana/contracts';
import type { PendingNote } from './notes.ts';
import type { PriceRead } from './price.ts';
import { inScript, NO_TEXT } from './text.ts';

export type MOption = {
  name: Text;
  translated: Lang[];
  price: number | null;
  priceText: string | null;
  maxQty: number;
  isDefault: boolean;
  opens: MGroup | null;
};

export type MGroup = {
  name: Text;
  translated: Lang[];
  selection: SelectionKind;
  min: number | null;
  max: number | null;
  options: MOption[];
  notes: PendingNote[];
};

export type MLink = { group: MGroup; min: number | null; max: number | null };

export type MDish = {
  name: Text;
  desc: Text;
  translated: Lang[];
  price: number | null;
  priceText: string | null;
  priceNote: Text;
  tags: Tag[];
  allergens: Text;
  photo: DraftPhoto | null;
  illustration: string | null;
  links: MLink[];
  notes: PendingNote[];
  /** The source line of its name (text readers), for notes; null when there is none (the scanner, a draft). */
  line: number | null;
};

export type MSection = {
  name: Text;
  translated: Lang[];
  kind: SectionKind;
  room: Room | null;
  dishes: MDish[];
  notes: PendingNote[];
  line: number | null;
};

export type MenuModel = { sections: MSection[] };

export const newSection = (name: Text, kind: SectionKind, o: Partial<MSection> = {}): MSection =>
  ({ name, translated: [], kind, room: null, dishes: [], notes: [], line: null, ...o });

export const newDish = (name: Text, o: Partial<MDish> = {}): MDish => ({
  name, desc: NO_TEXT, translated: [], price: null, priceText: null, priceNote: NO_TEXT, tags: [], allergens: NO_TEXT, photo: null,
  illustration: null, links: [], notes: [], line: null, ...o,
});

export const newGroup = (name: Text, o: Partial<MGroup> = {}): MGroup =>
  ({ name, translated: [], selection: 'multiple', min: null, max: null, options: [], notes: [], ...o });

export const newOption = (name: Text, price: number | null, o: Partial<MOption> = {}): MOption =>
  ({ name, translated: [], price, priceText: null, maxQty: 1, isDefault: false, opens: null, ...o });

/** The section a reader opens for dishes that come before any heading (a native read is needed for the Hebrew). */
export const DEFAULT_SECTION_NAME: Text = { he: 'תפריט', en: 'Menu' };

export function note(target: { notes: PendingNote[] }, code: PendingNote['code'], ...lines: number[]): void {
  target.notes.push({ code, lines });
}

/** A `layout_guessed` note on a node: the reader chose one of two readings, by the rule named. */
export function guessed(target: { notes: PendingNote[] }, rule: LayoutGuessRule, ...lines: number[]): void {
  target.notes.push({ code: 'layout_guessed', lines, rule });
}

/** An option of the dish's groups so far, by name (`importKey`), that opens nothing yet: where a nested group hangs. */
export function optionNamed(d: MDish, name: string): MOption | null {
  const key = importKey(name);
  if (key === '') return null;
  for (const l of d.links) for (const o of l.group.options) if (o.opens === null && (importKey(o.name.he) === key || importKey(o.name.en) === key)) return o;
  return null;
}

/**
 * A price as read onto a dish: one price; several (the first, with the source's text kept as the price note, which
 * the owner checks); a discount beside the regular price (the regular one, checked); or unreadable (`priceText`).
 */
export function setPrice(d: MDish, p: PriceRead, lang: Lang, line: number | null): void {
  const lines = line === null ? [] : [line];
  switch (p.kind) {
    case 'one': d.price = p.agorot; break;
    case 'several': d.price = p.agorot; d.priceNote = inScript(p.note, lang); d.notes.push({ code: 'price_range', lines }); break;
    case 'discount': d.price = p.agorot; d.notes.push({ code: 'price_discount', lines }); break;
    case 'unreadable': d.priceText = p.text; break;
  }
}
