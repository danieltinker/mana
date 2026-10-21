/**
 * `parsePaste(text)`: a menu the owner typed or pasted, in Hebrew, English or both. Every line is first recognised on
 * its own (`classifyPasteLine`), then given its role by its neighbours:
 * - **Headings**: "# Mains", "Mains:", a line underlined with "===" or "---", a common section name ("Desserts",
 *   "קינוחים"), or a short line followed by a dish.
 * - **Dishes**: "Schnitzel 64", "Schnitzel …… 64", "Schnitzel ₪64.00", "₪64 Schnitzel", "Wine 38 / 140", "Funghi
 *   ₪46–62", a name with its price on the next line, and the v1 owner app's "name | price | description" (or columns
 *   copied from a spreadsheet, split by tabs). A line with no price where a dish is expected is a dish with no price
 *   (the draft asks the owner about it: `price_missing`).
 * - **A number that may be the name's** (rule `price_ambiguous`): "Combo 1", "Tea for 2", "Pizza No. 5", "Serves 4",
 *   "since 1998", a phone number, "House red 38 140", or a bare number first ("64 Schnitzel"): no price is taken from
 *   inside a name. The line stays whole (a name, a description or a heading, by its neighbours) and a dish it names
 *   gets a note to check. A number first is a heading only after a blank line (or first) and over a priced dish
 *   ("3 course lunch"); right under a heading it is a dish.
 * - **Descriptions**: a line right under a dish (no blank line between) that reads like a description, or a short
 *   line under a priced dish that the next dish or the end of the block follows.
 * - **Tags**: a line of tag words ("Vegan", "ללא גלוטן") right under its dish, with no blank line between. After a
 *   blank line, or with no dish above it, it is a heading ("Vegan" sections), never a tag.
 * - **Both languages**: "שניצל / Schnitzel 64", or the other language's name right under the dish ("שניצל 64" then
 *   "Schnitzel"), and the same for a heading. A common section name there ("פסטה 52" then "Pasta") is the dish's name
 *   when the dishes around it are named that way too, checked (`layout_guessed`); otherwise a heading, checked.
 */
import type { Lang, Tag } from '@mana/contracts';
import { buildDraft, type ReadResult } from './build.ts';
import { DEFAULT_SECTION_NAME, guessed, newDish, newSection, note, setPrice, type MDish, type MSection } from './model.ts';
import { NoteBook } from './notes.ts';
import { readPrice, splitPrice, type PriceRead, type SplitPrice } from './price.ts';
import { guessKind, isCommonSection, nameMarkers, readAllergens, readLabel, readTags } from './rules.ts';
import { append, bilingual, descShaped, headingShaped, inScript, lower, mainLang, scriptOf, sourceLines } from './text.ts';

export type PasteToken =
  | { readonly k: 'heading'; readonly text: string }
  | { readonly k: 'underline' }
  | { readonly k: 'dish'; readonly text: string; readonly price: PriceRead | null; readonly desc: string }
  | { readonly k: 'price'; readonly price: PriceRead }
  | { readonly k: 'tags'; readonly tags: readonly Tag[]; readonly text: string }
  | { readonly k: 'sold_out' }
  | { readonly k: 'label' }
  | { readonly k: 'allergens'; readonly text: string | null }
  | { readonly k: 'noise'; readonly rule: string }
  /** `number`: the line ends with a number no price was taken from (`price_ambiguous`): one that may be the name's
   * (`name`), or two that may be two prices (`prices`: the line is a dish, never a description or a heading); or it
   * starts with a bare number that may be the price ("64 Schnitzel": `leading`). */
  | { readonly k: 'text'; readonly text: string; readonly number: 'name' | 'prices' | 'leading' | null };

/** Words before a number that make it the name's: "No. 5", "Tea for 2", "Serves 4", "since 1998", "שולחן 4". */
const NUMBER_CUES = new Set([
  'no', 'no.', 'nr', 'nr.', 'number', '#', 'for', 'serves', 'serving', 'servings', 'since', 'est', 'est.', 'table', 'x', '×', 'size', 'part', 'vol', 'vol.',
  'מס׳', "מס'", 'מס', 'מספר', 'עבור', 'משנת', 'מאז', 'ל', 'ל-', 'שולחן', 'גודל', 'חלק',
]);
/** Words before a single digit that number the item itself: "Combo 1", "Menu 2", "ארוחה 3". */
const ITEM_WORDS = new Set([
  'combo', 'menu', 'set', 'meal', 'deal', 'box', 'pack', 'option', 'choice', 'platter', 'tray', 'bucket', 'kit', 'level', 'step', 'round',
  'קומבו', 'ארוחה', 'מגש', 'מארז', 'סט', 'מנה', 'אופציה', 'דיל', 'שלב',
]);
const isNumberWord = (w: string | undefined): boolean => w !== undefined && /^\d+(?:[.,]\d{1,2})?$/u.test(w);

/**
 * Rule `price_ambiguous`: a number without a currency at the end of a line that may be the name's, not its price:
 * a single digit after an item word ("Combo 1"); a number after a word that counts ("Tea for 2", "No. 5", "Serves 4");
 * a year or five digits or more ("since 1998", "5551234"); or a second number right before it, or one word before
 * that ("House red 38 140", "Rosé glass 36 bottle 130"), which may be two prices.
 */
function ambiguousBare(split: SplitPrice): 'name' | 'prices' | null {
  const token = split.token.trim();
  const ws = lower(split.text).split(' ');
  const prev = ws[ws.length - 1], prev2 = ws.length >= 3 ? ws[ws.length - 2] : undefined;
  if (/^\d{5,}/u.test(token) || /^(?:19|20)\d{2}$/u.test(token)) return 'name';
  if (/^\d$/u.test(token) && ITEM_WORDS.has(prev ?? '')) return 'name';
  if (NUMBER_CUES.has(prev ?? '')) return 'name';
  const priceLike = (w: string | undefined) => isNumberWord(w) && (w!.length >= 2 || /[.,]/u.test(w!));
  if (/^\d/u.test(token) && (priceLike(prev) || priceLike(prev2))) return 'prices';
  return null;
}

const PHONE_RE = /^\+?\d[\d\- ]{6,18}\d$/u;
/** A bare number first, then a word: "64 Schnitzel" (the number may be its price; "₪64 Schnitzel" is read as one). */
const LEADING_NUMBER = /^\d{1,4}(?:[.,]\d{1,2})? \p{L}/u;

/** "# Mains", "## Mains ##": the heading's text (null when the line is not one). Read by hand: no pattern backtracks. */
function hashHeading(line: string): string | null {
  let i = 0;
  while (i < line.length && i < 7 && line[i] === '#') i++;
  if (i === 0 || i > 6) return null;
  // "#5 Burger 50" is a numbered dish, not a heading
  if (line[i] !== ' ' && /\d/u.test(line[i] ?? '')) return null;
  let e = line.length;
  while (e > i && (line[e - 1] === '#' || line[e - 1] === ' ')) e--;
  const text = line.slice(i, e).trim();
  return text === '' ? null : text;
}

/** One pasted line on its own: the rule that recognised it and what it is. null for a blank line. */
export function classifyPasteLine(line: string): { readonly rule: string; readonly token: PasteToken } | null {
  if (line === '') return null;
  const hash = hashHeading(line);
  if (hash !== null) return { rule: 'heading_hash', token: { k: 'heading', text: hash } };
  if (/^(?:={3,}|-{3,}|\*{3,}|_{3,})$/u.test(line)) return { rule: 'heading_underline', token: { k: 'underline' } };
  if (line.includes('|')) {
    const [name = '', price = '', ...rest] = line.split('|').map((p) => p.trim());
    const read = price === '' ? null : readPrice(price, true) ?? { kind: 'unreadable' as const, text: price.slice(0, 40) };
    if (name !== '') return { rule: 'pipe', token: { k: 'dish', text: name, price: read, desc: rest.filter((p) => p !== '').join(' | ') } };
  }
  const allergens = readAllergens(line);
  if (allergens) return { rule: 'allergens', token: { k: 'allergens', text: allergens.text } };
  // a heading written with a colon, before the label words ("Kosher:", "Vegan:" head sections)
  const colon = line.length <= 42 && line.endsWith(':') ? line.slice(0, -1).trim() : '';
  if (colon !== '' && !colon.endsWith(':')) return { rule: 'heading_colon', token: { k: 'heading', text: colon } };
  const tags = readTags(line);
  if (tags) return { rule: 'tags', token: { k: 'tags', tags, text: line } };
  const label = readLabel(line);
  if (label === 'sold_out') return { rule: 'label_sold_out', token: { k: 'sold_out' } };
  if (label !== null) return { rule: `label_${label}`, token: { k: 'label' } };
  if (PHONE_RE.test(line) && (line.match(/\d/gu)?.length ?? 0) >= 8) return { rule: 'noise_phone', token: { k: 'noise', rule: 'phone' } };
  const price = readPrice(line, true);
  if (price) return { rule: 'price', token: { k: 'price', price } };
  const split = splitPrice(line, true);
  if (split && !split.option) {
    const doubt = split.bare ? ambiguousBare(split) : null;
    if (doubt !== null) return { rule: 'price_ambiguous', token: { k: 'text', text: line, number: doubt } };
    return { rule: 'dish_inline', token: { k: 'dish', text: split.text, price: split.price, desc: '' } };
  }
  if (LEADING_NUMBER.test(line)) return { rule: 'price_ambiguous', token: { k: 'text', text: line, number: 'leading' } };
  return { rule: 'text', token: { k: 'text', text: line, number: null } };
}

type Tok = { readonly n: number; readonly t: PasteToken; readonly blankBefore: boolean };
/** Lines that belong to the dish above them (so a short line before them is still that dish's description). */
const ATTACHED: ReadonlySet<PasteToken['k']> = new Set(['tags', 'sold_out', 'label', 'allergens']);

/** Rule `strong_heading`: a heading by its own look: a common section name, or capitals only ("MAINS"). */
const strongHeading = (s: string): boolean => isCommonSection(s) || (/[A-Z]{3}/u.test(s) && !/[a-z]/u.test(s) && headingShaped(s));
type Role = 'heading' | 'dish' | 'desc' | null;

/** Reads a pasted menu into a draft (source `paste`). No model, no network. */
export function parsePaste(text: string): ReadResult {
  const { lines, truncated, clipped } = sourceLines(text, { tabs: 'pipe' });
  const book = new NoteBook();
  if (truncated) book.add('input_truncated');
  if (clipped.length) book.add('text_clipped', clipped, { rule: 'line' });
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
  const add = (name: string, n: number, price: PriceRead | null, desc = ''): MDish => {
    if (!section) { section = newSection(DEFAULT_SECTION_NAME, 'food'); sections.push(section); }
    const marked = nameMarkers(name);
    const d = newDish(bilingual(marked.name, lang), { tags: marked.tags, line: n });
    if (desc !== '') d.desc = inScript(desc, lang);
    if (price) setPrice(d, price, lang, n);
    section.dishes.push(d);
    dish = d;
    role = 'dish';
    return d;
  };
  /** Does a dish start at token i (a priced line, or a name with its price on the next line)? */
  const dishAt = (i: number): boolean => {
    const x = toks[i];
    if (!x) return false;
    if (x.t.k === 'dish') return true;
    const y = toks[i + 1];
    return x.t.k === 'text' && y !== undefined && y.t.k === 'price' && !y.blankBefore;
  };
  /** A line in `script`, heading-shaped, right under the dish that starts at token i: its name in that language. */
  const namedUnder = (i: number, script: Lang): boolean => {
    if (!dishAt(i) || toks[i]!.blankBefore) return false;
    const x = toks[toks[i]!.t.k === 'dish' ? i + 1 : i + 2];
    return x !== undefined && !x.blankBefore && x.t.k === 'text' && scriptOf(x.t.text) === script && headingShaped(x.t.text);
  };

  for (let i = 0; i < toks.length; i++) {
    const { n, blankBefore } = toks[i]!;
    let t = toks[i]!.t;
    const next = toks[i + 1];
    const d = dish as MDish | null;
    const s = section as MSection | null;
    // rule `tags`: tag words are the dish's only right under it; otherwise the line is read as text (a heading)
    if (t.k === 'tags' && !(d && !blankBefore && (role === 'dish' || role === 'desc'))) t = { k: 'text', text: t.text, number: null };
    switch (t.k) {
      case 'heading': open(t.text, n); break;
      case 'underline': unknown(n); break;
      case 'dish': add(t.text, n, t.price, t.desc); break;
      case 'price':
        if (d && role === 'dish' && d.price === null && d.priceText === null) setPrice(d, t.price, lang, n);
        else unknown(n);
        break;
      case 'tags': d!.tags = [...new Set([...d!.tags, ...t.tags])]; break;
      case 'sold_out': if (d) note(d, 'sold_out', n); else unknown(n); break;
      case 'label': book.add('noise', [n], { rule: 'label' }); break;
      case 'noise': book.add('noise', [n], { rule: t.rule }); break;
      case 'allergens':
        if (d && t.text !== null) d.allergens = append(d.allergens, scriptOf(t.text) ?? lang, t.text);
        // a bare "Allergens:" takes the next line only when it follows right under it
        else if (d && next?.t.k === 'text' && !next.blankBefore) { d.allergens = append(d.allergens, scriptOf(next.t.text) ?? lang, next.t.text); i++; }
        else unknown(n);
        break;
      case 'text': {
        const script = scriptOf(t.text) ?? lang;
        const contiguous = !blankBefore;
        if (next?.t.k === 'underline' && !next.blankBefore) { open(t.text, n); i++; break; }
        if (next?.t.k === 'price' && !next.blankBefore) { add(t.text, n, next.t.price); i++; break; }
        // "House red 38 140": a dish whose prices could not be told apart
        if (t.number === 'prices') { note(add(t.text, n, null), 'price_ambiguous', n); break; }
        // rule `second_language`: the other language's name, right under a dish or a heading. A common section name
        // there ("פסטה 52", "Pasta") is the dish's when the dish before it, or the next one, is named in both languages
        // the same way; either way the reading is checked (`other_language`)
        const otherName = contiguous && role === 'dish' && d !== null && d.name[script] === '' && d.desc[script] === '' && headingShaped(t.text);
        if (otherName && !isCommonSection(t.text)) {
          d!.name = { ...d!.name, [script]: t.text };
          break;
        }
        if (otherName) {
          const before = s?.dishes[s.dishes.length - 2];
          if ((before !== undefined && before.name.he !== '' && before.name.en !== '') || namedUnder(i + 1, script)) {
            d!.name = { ...d!.name, [script]: t.text };
            guessed(d!, 'other_language', n);
            break;
          }
        }
        if (contiguous && role === 'heading' && s && s.name[script] === '' && headingShaped(t.text) && !dishAt(i)) {
          s.name = { ...s.name, [script]: t.text };
          break;
        }
        // rule `description`: right under a dish (or its description), not a heading by its own look, and reading like
        // a description; or under a priced dish when the next dish, a blank line or the end comes next (a heading has a
        // blank line before it; under a dish with no price, a short line is the next dish of a list without prices)
        const priced = d !== null && (d.price !== null || d.priceText !== null);
        const blockEnds = next === undefined || next.blankBefore || next.t.k === 'heading' || ATTACHED.has(next.t.k);
        const aside = priced && (dishAt(i + 1) || (blockEnds && (t.number === 'name' || (next !== undefined && ATTACHED.has(next.t.k) && !next.blankBefore))));
        if (contiguous && (role === 'dish' || role === 'desc') && d && !strongHeading(t.text) && (descShaped(t.text) || aside)) {
          d.desc = append(d.desc, script, t.text);
          role = 'desc';
          break;
        }
        // rule `heading`: a heading by its own look; or a short line followed by a dish (or by a heading: an empty
        // section), when a blank line, the start or another heading comes before it (right under a dish it is a dish).
        // A number first ("3 course lunch", "64 Schnitzel") is a heading only after a blank line or at the start and
        // over a priced dish; right under a heading it is a dish whose number is checked
        const free = blankBefore || role === null || role === 'heading';
        const numbered = t.number === 'leading' && !(blankBefore || role === null);
        if (strongHeading(t.text) || (free && !numbered && headingShaped(t.text) && (dishAt(i + 1) || (t.number !== 'leading' && next?.t.k === 'heading')))) {
          open(t.text, n);
          if (otherName) guessed(section!, 'other_language', n);
          break;
        }
        const added = add(t.text, n, null);
        if (t.number !== null) note(added, 'price_ambiguous', n);
        break;
      }
    }
  }
  return buildDraft('paste', [{ model: { sections }, notes: book.list(), dropped }]);
}
