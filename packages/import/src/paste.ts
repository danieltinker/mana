/**
 * `parsePaste(text)`: a menu the owner typed or pasted, in Hebrew, English or both. Every line is first recognised on
 * its own (`classifyPasteLine`), then given its role by its neighbours:
 * - **Headings**: "# Mains", "Mains:", a line underlined with "===" or "---", a common section name ("Desserts",
 *   "קינוחים"), or a short line followed by a dish.
 * - **Dishes**: "Schnitzel 64", "Schnitzel …… 64", "Schnitzel ₪64.00", "₪64 Schnitzel", "Wine 38 / 140", a name with its
 *   price on the next line, and the v1 owner app's "name | price | description". A line with no price where a dish is
 *   expected is a dish with no price (the draft asks the owner about it: `price_missing`).
 * - **Descriptions**: a line right under a dish (no blank line between) that reads like a description.
 * - **Both languages**: "שניצל / Schnitzel 64", or the other language's name right under the dish ("שניצל 64" then
 *   "Schnitzel"), and the same for a heading.
 */
import type { Lang, Tag } from '@mana/contracts';
import { buildDraft, type ReadResult } from './build.ts';
import { DEFAULT_SECTION_NAME, newDish, newSection, note, setPrice, type MDish, type MSection } from './model.ts';
import { NoteBook } from './notes.ts';
import { readPrice, splitPrice, type PriceRead } from './price.ts';
import { guessKind, isCommonSection, nameMarkers, readAllergens, readLabel, readTags } from './rules.ts';
import { append, bilingual, descShaped, headingShaped, inScript, mainLang, scriptOf, sourceLines } from './text.ts';

export type PasteToken =
  | { readonly k: 'heading'; readonly text: string }
  | { readonly k: 'underline' }
  | { readonly k: 'dish'; readonly text: string; readonly price: PriceRead | null; readonly desc: string }
  | { readonly k: 'price'; readonly price: PriceRead }
  | { readonly k: 'tags'; readonly tags: readonly Tag[] }
  | { readonly k: 'sold_out' }
  | { readonly k: 'label' }
  | { readonly k: 'allergens'; readonly text: string | null }
  | { readonly k: 'text'; readonly text: string };

/** One pasted line on its own: the rule that recognised it and what it is. null for a blank line. */
export function classifyPasteLine(line: string): { readonly rule: string; readonly token: PasteToken } | null {
  if (line === '') return null;
  const hash = /^#{1,6}\s*(.*\S)\s*#*$/u.exec(line);
  if (hash) return { rule: 'heading_hash', token: { k: 'heading', text: hash[1]! } };
  if (/^(?:={3,}|-{3,}|\*{3,}|_{3,})$/u.test(line)) return { rule: 'heading_underline', token: { k: 'underline' } };
  if (line.includes('|')) {
    const [name = '', price = '', ...rest] = line.split('|').map((p) => p.trim());
    const read = price === '' ? null : readPrice(price, true) ?? { kind: 'unreadable' as const, text: price.slice(0, 40) };
    if (name !== '') return { rule: 'pipe', token: { k: 'dish', text: name, price: read, desc: rest.filter((p) => p !== '').join(' | ') } };
  }
  const tags = readTags(line);
  if (tags) return { rule: 'tags', token: { k: 'tags', tags } };
  const label = readLabel(line);
  if (label === 'sold_out') return { rule: 'label_sold_out', token: { k: 'sold_out' } };
  if (label !== null) return { rule: `label_${label}`, token: { k: 'label' } };
  const allergens = readAllergens(line);
  if (allergens) return { rule: 'allergens', token: { k: 'allergens', text: allergens.text } };
  const price = readPrice(line, true);
  if (price) return { rule: 'price', token: { k: 'price', price } };
  const split = splitPrice(line, true);
  if (split) return { rule: 'dish_inline', token: { k: 'dish', text: split.text, price: split.price, desc: '' } };
  const colon = /^(.{1,40}\S)\s*:$/u.exec(line);
  if (colon) return { rule: 'heading_colon', token: { k: 'heading', text: colon[1]! } };
  return { rule: 'text', token: { k: 'text', text: line } };
}

type Tok = { readonly n: number; readonly t: PasteToken; readonly blankBefore: boolean };

/** Rule `strong_heading`: a heading by its own look: a common section name, or capitals only ("MAINS"). */
const strongHeading = (s: string): boolean => isCommonSection(s) || (/[A-Z]{3}/u.test(s) && !/[a-z]/u.test(s) && headingShaped(s));
type Role = 'heading' | 'dish' | 'desc' | null;

/** Reads a pasted menu into a draft (source `paste`). No model, no network. */
export function parsePaste(text: string): ReadResult {
  const { lines, truncated } = sourceLines(text);
  const book = new NoteBook();
  if (truncated) book.add('input_truncated');
  if (lines.every((l) => l.text === '')) book.add('empty_input', [], { count: 1 });
  const toks: Tok[] = [];
  let blank = true;
  for (const l of lines) {
    const c = classifyPasteLine(l.text);
    if (!c) { blank = true; continue; }
    toks.push({ n: l.n, t: c.token, blankBefore: blank });
    blank = false;
  }
  const lang: Lang = mainLang(toks.flatMap((x) => ('text' in x.t && x.t.text !== null ? [x.t.text] : [])));
  const sections: MSection[] = [];
  let section: MSection | null = null;
  let dish: MDish | null = null;
  let role = null as Role;
  let dropped = 0;
  const unknown = (n: number) => { book.add('line_unknown', [n]); dropped += 1; };

  const open = (text: string, n: number): void => {
    section = newSection(bilingual(text, lang), guessKind(text), { line: n });
    sections.push(section);
    dish = null;
    role = 'heading';
  };
  const add = (name: string, n: number, price: PriceRead | null, desc = ''): void => {
    if (!section) { section = newSection(DEFAULT_SECTION_NAME, 'food'); sections.push(section); }
    const marked = nameMarkers(name);
    const d = newDish(bilingual(marked.name, lang), { tags: marked.tags, line: n });
    if (desc !== '') d.desc = inScript(desc, lang);
    if (price) setPrice(d, price, lang, n);
    section.dishes.push(d);
    dish = d;
    role = 'dish';
  };
  /** Does a dish start at token i (a priced line, or a name with its price on the next line)? */
  const dishAt = (i: number): boolean => {
    const x = toks[i];
    if (!x) return false;
    if (x.t.k === 'dish') return true;
    const y = toks[i + 1];
    return x.t.k === 'text' && y !== undefined && y.t.k === 'price' && !y.blankBefore;
  };

  for (let i = 0; i < toks.length; i++) {
    const { n, t, blankBefore } = toks[i]!;
    const next = toks[i + 1];
    const d = dish as MDish | null;
    const s = section as MSection | null;
    switch (t.k) {
      case 'heading': open(t.text, n); break;
      case 'underline': unknown(n); break;
      case 'dish': add(t.text, n, t.price, t.desc); break;
      case 'price':
        if (d && role === 'dish' && d.price === null && d.priceText === null) setPrice(d, t.price, lang, n);
        else unknown(n);
        break;
      case 'tags': if (d) d.tags = [...new Set([...d.tags, ...t.tags])]; else unknown(n); break;
      case 'sold_out': if (d) note(d, 'sold_out', n); else unknown(n); break;
      case 'label': book.add('noise', [n], { rule: 'label' }); break;
      case 'allergens':
        if (d && t.text !== null) d.allergens = append(d.allergens, scriptOf(t.text) ?? lang, t.text);
        else if (d && next?.t.k === 'text') { d.allergens = append(d.allergens, scriptOf(next.t.text) ?? lang, next.t.text); i++; }
        else unknown(n);
        break;
      case 'text': {
        const script = scriptOf(t.text) ?? lang;
        const contiguous = !blankBefore;
        if (next?.t.k === 'underline' && !next.blankBefore) { open(t.text, n); i++; break; }
        if (next?.t.k === 'price' && !next.blankBefore) { add(t.text, n, next.t.price); i++; break; }
        // rule `second_language`: the other language's name, right under a dish or a heading
        if (contiguous && role === 'dish' && d && d.name[script] === '' && d.desc[script] === '' && headingShaped(t.text) && !isCommonSection(t.text)) {
          d.name = { ...d.name, [script]: t.text };
          break;
        }
        if (contiguous && role === 'heading' && s && s.name[script] === '' && headingShaped(t.text) && !dishAt(i)) {
          s.name = { ...s.name, [script]: t.text };
          break;
        }
        // rule `description`: right under a dish (or its description), not a heading by its own look, and reading like
        // a description or followed by the next dish (a heading would have a blank line before it)
        if (contiguous && (role === 'dish' || role === 'desc') && d && !strongHeading(t.text) && (descShaped(t.text) || dishAt(i + 1))) {
          d.desc = append(d.desc, script, t.text);
          role = 'desc';
          break;
        }
        // rule `heading`: a heading by its own look, or a short line followed by a dish (or by a heading: an empty section)
        if (strongHeading(t.text) || (headingShaped(t.text) && (dishAt(i + 1) || next?.t.k === 'heading'))) { open(t.text, n); break; }
        add(t.text, n, null);
        break;
      }
    }
  }
  return buildDraft('paste', [{ model: { sections }, notes: book.list(), dropped }]);
}
