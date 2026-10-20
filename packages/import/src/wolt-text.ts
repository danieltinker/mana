/**
 * `parseWoltText(text)`: text an owner copied from their own Wolt venue page (D33: we never fetch Wolt; this is only
 * what the owner pastes), in Hebrew or English, with or without the copied text of dish sheets and their choices.
 *
 * Written before any real paste existed (Mana HQ m051 asks for one in `private/`), from how such pages read when
 * copied. What a real paste must confirm, by rule (the tuning pass changes the rule named):
 *  1. Each element (name, description, price, label, button) is a line of its own; a name and its price may run
 *     together with nothing between them ("Schnitzel₪64.00", `text_price`); a price after a space inside a line is
 *     the line's own words ("Family size ₪120" is a description).
 *  2. A listed dish reads name, then a one-line description, then its price; its labels come after the name or after
 *     the price, never before the name (`resolveDish`, `attach`). A tag word ("Vegan") right after a price with the
 *     next dish under it reads as a section heading, not as the dish's tag (`tags`: a heading read as a tag would
 *     put a false diet tag on a dish; a tag read as a heading costs one wrong section, which the preview shows).
 *  3. Every price shows the shekel sign, so a bare number is never a price ("9.2" is a rating: `noise_rating`).
 *  4. A discount shows two prices side by side, and the higher one is the regular price (`price_discount`).
 *  5. A sold-out dish still shows its price (`label_sold_out`).
 *  6. The venue's header comes first, then the page's own list of sections, then the sections (`nav_headings`);
 *     without the list, a dish's first line is its name, and a line before it is a heading only when it is a common
 *     section name ("Desserts", "קינוחים") or the page's first (`resolveDish`).
 *  7. "Popular" / "Most ordered" / "פופולרי" is the first section and repeats dishes of other sections
 *     (`popular_heading`); the same word on a dish is a mark, not a heading. The section is kept: the draft's
 *     `dish_repeated` asks about each repeat, and a dish sheet copied under it joins the dish in its own section.
 *  8. A dish sheet reads: name, price and description (either order), allergens, then its groups; each group is a
 *     heading, a rule line, then its options, each option's "+₪" price after its name (same line or the next), a
 *     free option showing no price; the sheet ends with "Add to order" (with or without the total) (`sheet_end`).
 *  9. A group shows a rule line under its heading ("Required", "Optional", "Choose up to 2", "חובה", "בחרו עד 2"); a
 *     heading with none is known by its words ("Choose a sauce", "בחרו רוטב", "Add a drink?", and inside a sheet
 *     "Extras" or "Sauces:"): `group_heading`. Any other line before an option's price is an option.
 * 10. A count states the group's limits; "Required" or "Optional" alone states none, and the owner confirms the
 *     guess (`ruleLimits`, the draft's `limits_guessed`).
 * 11. A nested choice shows as "<option> › <group>", "<group> for <option>", "<group> (for <option>)",
 *     "<group> עבור <option>" or "<group> ל<option>" (`NESTED`); otherwise a group is never nested.
 * 12. Allergens read "Allergens: …" / "אלרגנים: …", or a bare heading with the list on the next line; a bare heading
 *     whose next line is a group's heading has no list and is left out (`allergens`).
 * 13. The card's own "Add" button does not come between a dish's name and its price; a quantity stepper copies as a
 *     bare "1" (`noise_quantity`).
 * 14. The words of every noise list (buttons, footer, fees, delivery, hours, ratings) and label list (`rules.ts`),
 *     in both languages, are the ones the page uses. A noise rule matches a whole line only, and a line with a price
 *     right under it is a dish's name whatever its words ("Share", "Delivery Box 2"); a fee shows on one line with
 *     its price ("Delivery ₪9.90"); opening hours are a line of their own ("Open until 23:00", "Sun–Thu 10:00–22:00"),
 *     so "Business lunch 12:00–16:00" is a heading.
 *
 * Two steps, each rule named:
 * 1. **Lines** (`classifyWoltLine`): every line is noise (the venue header, ratings, delivery times, opening hours,
 *    fees, buttons, the footer), a label (popular, new, sold out, a tag, another label), allergens, a group's rule
 *    ("Required", "Choose up to 2"), an option's price ("+₪5.00"), a dish's price ("₪42.00", "from ₪42", "₪42–58"),
 *    the end of a dish sheet ("Add to order"), or text. Then the lines are read against their neighbours (`refine`).
 * 2. **Grammar** (`WoltReader`): text runs are closed by what follows them. A dish price closes a dish (its name, an
 *    optional description, and before them a section heading); a rule line closes a group heading; an option price
 *    closes an option. The venue's own list of sections at the top of the page, when it is there, tells headings from
 *    dishes (rule `nav_headings`).
 * Every rule runs in time linear in its line, and lines are at most `LINE_MAX` long.
 */
import { importKey, stripBlank, type Lang, type Tag, type Text } from '@mana/contracts';
import { buildDraft, nameIdentity, type ReadResult } from './build.ts';
import { DEFAULT_SECTION_NAME, guessed, newDish, newGroup, newOption, newSection, note, optionNamed, setPrice, type MDish, type MGroup, type MSection } from './model.ts';
import { NoteBook } from './notes.ts';
import { hasMoney, readOptionPrice, readPrice, splitPrice, type PriceRead } from './price.ts';
import {
  groupCue, guessKind, isCommonSection, isPopularSection, joinRules, nameMarkers, NO_RULE, readAllergens, readLabel, readRule, readTags, ruleLimits,
  type GroupRule, type Label,
} from './rules.ts';
import { append, bilingual, descMarked, descShaped, headingShaped, lower, mainLang, scriptOf, sourceLines } from './text.ts';

// ---------------------------------------------------------------- 1. lines

export type WoltToken =
  | { readonly k: 'text'; readonly text: string }
  /** `next`: the lines of the next dish when only its lines come before its price (set by `lookahead`; 0: none). */
  | { readonly k: 'price'; readonly price: PriceRead; readonly next?: number }
  | { readonly k: 'option_price'; readonly agorot: number | null; readonly text: string }
  | { readonly k: 'rule'; readonly rule: GroupRule; readonly heading: string | null }
  /** `guess`: in the slot between a price and the next dish, read as the dish's own label (`refine`): checked. */
  | { readonly k: 'tags'; readonly tags: readonly Tag[]; readonly text: string; readonly guess?: boolean }
  /** Tag words between a price and the next dish that nothing tells from a heading: left out, the dish checked. */
  | { readonly k: 'unplaced'; readonly text: string }
  | { readonly k: 'label'; readonly label: Label; readonly text: string }
  | { readonly k: 'allergens'; readonly text: string | null }
  | { readonly k: 'end'; readonly price: PriceRead | null }
  | { readonly k: 'noise'; readonly rule: string }
  /** A group's heading known by its words (`group_heading`, set by `refine`); `strong` = also outside a sheet. */
  | { readonly k: 'head'; readonly text: string; readonly strong: boolean };

const set = (...w: string[]): ReadonlySet<string> => new Set(w.map(lower));
/** A line as the noise lists hold it: lowercase A–Z, no final ".", "!" or ":". */
function plain(s: string): string {
  const t = lower(s);
  let e = t.length;
  while (e > 0 && (t[e - 1] === '.' || t[e - 1] === '!' || t[e - 1] === ':')) e--;
  return t.slice(0, e);
}

/** Rule `noise_button`: the page's buttons and links. */
const BUTTONS = set(
  'close', 'search', 'share', 'back', 'more', 'see all', 'show more', 'show all', 'view all', 'more info', 'info', 'venue information', 'venue info',
  'group order', 'order together', 'schedule order', 'schedule', 'log in', 'login', 'sign up', 'add a comment', 'add comment', 'special instructions',
  'add special instructions', 'comment', 'remove', 'cancel', 'save', 'ok', 'done', 'continue', 'checkout', 'go to checkout', 'view order',
  'view basket', 'basket', 'cart', 'translate', 'show original', 'reviews', 'about', 'map', 'directions', 'call', 'delivery', 'pickup', 'takeaway',
  '+', '-', '−', '×', '✕',
  'חיפוש', 'שיתוף', 'חזרה', 'עוד', 'הצג הכל', 'הצגת הכל', 'לכל המנות', 'מידע נוסף', 'מידע', 'מידע על המקום', 'מידע על המסעדה', 'הזמנה קבוצתית',
  'הזמנה משותפת', 'תזמון הזמנה', 'הזמנה מתוזמנת', 'התחברות', 'הרשמה', 'הוספת הערה', 'הערות', 'הערה', 'בקשות מיוחדות', 'הסרה', 'ביטול', 'שמירה',
  'אישור', 'המשך', 'לתשלום', 'מעבר לתשלום', 'צפייה בהזמנה', 'סל', 'הסל שלי', 'תרגום', 'הצגת המקור', 'ביקורות', 'מפה', 'הוראות הגעה', 'התקשרו',
  'משלוח', 'איסוף', 'איסוף עצמי',
);
/** Rule `noise_footer`: the page's footer, as whole lines. */
const FOOTER = set(
  'privacy', 'privacy policy', 'privacy statement', 'terms', 'terms of service', 'terms and conditions', 'cookies', 'cookie settings', 'cookie policy',
  'accessibility', 'accessibility statement', 'contact', 'contact us', 'support', 'help', 'careers', 'jobs', 'press', 'blog', 'download the app',
  'get the app', 'app store', 'google play', 'language', 'english', 'עברית', 'israel', 'ישראל', 'מדיניות פרטיות', 'תנאי שימוש', 'עוגיות',
  'הגדרות עוגיות', 'נגישות', 'הצהרת נגישות', 'צור קשר', 'צרו קשר', 'תמיכה', 'עזרה', 'קריירה', 'דרושים', 'הורדת האפליקציה', 'הורידו את האפליקציה',
  'wolt', 'wolt+', 'powered by wolt', 'וולט',
);
const FOOTER_RE = /^(?:©|\(c\) )|all rights reserved|כל הזכויות שמורות/iu;
/** Rule `noise_fee`: a fee's words and its price, the whole line ("Delivery ₪9.90", "מינימום הזמנה: 50 ₪"), or "Free delivery". */
const FEE_PHRASES = set(
  'delivery', 'delivery fee', 'delivery cost', 'delivery price', 'min order', 'min. order', 'minimum order', 'minimum order value', 'min order value',
  'small order surcharge', 'small order fee', 'service fee', 'דמי משלוח', 'משלוח', 'עלות משלוח', 'מחיר משלוח', 'מינימום', 'מינימום הזמנה',
  'מינימום להזמנה', 'הזמנת מינימום', 'תוספת להזמנה קטנה', 'דמי שירות',
);
const FEE_FREE = set('free delivery', 'delivery free', 'no delivery fee', 'משלוח חינם', 'ללא דמי משלוח');
function isFee(s: string): boolean {
  if (s.length > 80) return false;
  if (FEE_FREE.has(plain(s))) return true;
  const free = /(?:free|חינם)$/iu.test(s) ? /^(.{1,40}?) ?[:：]? ?(?:free|חינם)$/iu.exec(s) : null;
  if (free && FEE_PHRASES.has(plain(free[1]!.trim()))) return true;
  if (!hasMoney(s)) return false;
  const split = splitPrice(s, false);
  return split !== null && !split.option && split.price.kind !== 'unreadable' && FEE_PHRASES.has(plain(split.text.trim()));
}
/** Rule `noise_delivery`: delivery times and distances, as whole lines. */
const MINS = String.raw`(?:min|mins|minutes|דק['׳]?|דקות)\.?`;
const DELIVERY_RE = [
  new RegExp(`^\\d{1,3} ?[–—-] ?\\d{1,3} ?${MINS}$`, 'iu'),
  new RegExp(`^\\d{1,3} ?${MINS}$`, 'iu'),
  new RegExp(`^(?:delivery|pickup|ready|estimated delivery|delivery time|משלוח|איסוף|מוכן|זמן משלוח|זמן הכנה)(?: in| תוך| בעוד)?(?: ?[:：])? ?\\d{1,3}(?: ?[–—-] ?\\d{1,3})? ?${MINS}$`, 'iu'),
  /^\d{1,3}(?:[.,]\d{1,2})? ?(?:km|ק["״]מ|m|מ['׳])$/iu,
];
const DELIVERY_WORDS = set('estimated delivery', 'delivery time', 'זמן משלוח', 'זמן הכנה');
/** Rule `noise_hours`: opening hours, as whole lines ("Open until 23:00", "פתוח עד 22:00", "Sun–Thu 10:00–22:00", "Closed"). */
const HOURS = set('open', 'open now', 'closed', 'closed now', 'closed today', 'opening hours', 'opening times', 'hours', 'פתוח', 'פתוח עכשיו', 'פתוח כעת',
  'סגור', 'סגור כעת', 'סגור היום', 'שעות פתיחה', 'שעות פעילות');
const T = String.raw`\d{1,2}[:.]\d{2}`;
const DAY = String.raw`(?:(?:sun|mon|tue|wed|thu|fri|sat)[a-z]{0,6}\.?|(?:יום )?[א-ו]['׳]|שבת|ראשון|שני|שלישי|רביעי|חמישי|שישי)`;
const HOURS_RE = [
  new RegExp(`^(?:open|opens|closes|closed|opening|until|פתוח|נפתח|נפתחת|נסגר|נסגרת|סגור|ייפתח|יפתח)[^\\d₪]{0,20}${T}(?: ?[–—-] ?${T})?$`, 'iu'),
  new RegExp(`^${DAY}(?: ?[–—-] ?${DAY})?:? ?${T} ?[–—-] ?${T}$`, 'iu'),
  new RegExp(`^${T} ?[–—-] ?${T}$`, 'u'),
];
/** Rule `noise_rating`: venue and dish ratings, review counts, price levels. */
const RATING_RE = [
  /^(?:[★⭐☆✩] ?)?\d(?:[.,]\d)?(?: ?\/ ?(?:5|10))?(?: ?\(\d[\d,.]{0,12}\+?\))?$/u,
  /^(?:👍|♥|❤️?)? ?\d{1,3}%(?: ?\(\d[\d,.]{0,12}\+?\))?$/u,
  /^\(\d[\d,.]{0,12}\+?\)$/u,
  /^\d[\d,.]{0,12}\+? ?(?:ratings?|reviews?|דירוגים|ביקורות|חוות דעת)$/iu,
  /^[₪$]{2,4}$/u,
];
const RATING_WORDS = set('excellent', 'very good', 'good', 'okay', 'amazing', 'great', 'superb', 'fantastic', 'מצוין', 'מעולה', 'טוב מאוד', 'טוב', 'מדהים', 'סביר');
/** Rule `sheet_end`: the dish sheet's "Add to order" button, alone or with its total. */
const END_RE = /^(?:add|הוספה|הוסף|הוסיפו)(?: \d{1,2})?(?: (?:to order|to cart|for|item|items|להזמנה|לסל|להזמנה שלי))?(?: ?[·•|–-] ?| )?(.*)$/iu;

/**
 * One line of a copied Wolt page: the rule that recognised it and its tokens (two when a name and its price share a
 * line, as copied text sometimes runs them together: "Schnitzel₪64.00").
 */
export function classifyWoltLine(line: string): { readonly rule: string; readonly tokens: readonly WoltToken[] } {
  const s = line;
  const p = plain(s);
  const one = (rule: string, t: WoltToken) => ({ rule, tokens: [t] });
  const noise = (rule: string) => one(rule, { k: 'noise', rule: rule.replace(/^noise_/u, '') });
  if (s === '') return { rule: 'blank', tokens: [] };
  const end = s.length <= 80 ? END_RE.exec(s) : null;
  if (end) {
    const rest = end[1]!.trim();
    const price = rest === '' ? null : readPrice(rest, false);
    if (rest === '' || (price && price.kind !== 'unreadable')) return one('sheet_end', { k: 'end', price });
  }
  if (BUTTONS.has(p)) return noise('noise_button');
  if (FOOTER.has(p) || FOOTER_RE.test(s)) return noise('noise_footer');
  if (isFee(s)) return noise('noise_fee');
  if (s.length <= 80 && (DELIVERY_WORDS.has(p) || DELIVERY_RE.some((re) => re.test(s)))) return noise('noise_delivery');
  if (HOURS.has(p) || (s.length <= 80 && HOURS_RE.some((re) => re.test(s)))) return noise('noise_hours');
  const lbl = readLabel(s);
  if (lbl) return one(`label_${lbl}`, { k: 'label', label: lbl, text: s });
  if (/^\d{1,2}$/u.test(s)) return noise('noise_quantity');
  if (RATING_WORDS.has(p) || (s.length <= 40 && RATING_RE.some((re) => re.test(s)))) return noise('noise_rating');
  const tags = readTags(s);
  if (tags) return one('tags', { k: 'tags', tags, text: s });
  const allergens = readAllergens(s);
  if (allergens) return one('allergens', { k: 'allergens', text: allergens.text });
  const rule = readRule(s);
  if (rule) return one('group_rule', { k: 'rule', rule: rule.rule, heading: rule.heading });
  const option = readOptionPrice(s);
  if (option) return one('option_price', { k: 'option_price', agorot: option.agorot, text: option.text });
  const price = readPrice(s, false);
  if (price) return one('price', { k: 'price', price });
  const split = splitPrice(s, false);
  // a dish's price runs into its name with nothing between ("Schnitzel₪64.00") or comes first ("₪64.00 Schnitzel");
  // an option's "+₪" price may follow its name after a space ("Fries +₪5.00")
  const at = split ? s.length - split.token.length : -1;
  if (split && (split.option || s.startsWith(split.token) || s[at - 1] !== ' ')) {
    const second: WoltToken = split.option
      ? { k: 'option_price', agorot: split.price.kind === 'unreadable' ? null : split.price.agorot, text: split.token }
      : { k: 'price', price: split.price };
    return { rule: 'text_price', tokens: [{ k: 'text', text: split.text }, second] };
  }
  return one('text', { k: 'text', text: s });
}

// ---------------------------------------------------------------- reading lines against their neighbours

type Classified = { readonly n: number; readonly text: string; tokens: WoltToken[] };

/** How many lines after a tag word the reader looks for a common heading. */
const SLOT_LOOK = 6;
/** Noise found by its words, which a dish's name may also be: a price right under the line makes it a name. */
const WORD_NOISE = new Set(['button', 'footer', 'hours', 'rating', 'delivery']);
const LETTER = /[A-Za-zא-ת]/u;

/**
 * The rules that need a line's neighbours, before the grammar: noise words over a price become a name (`noise_*`);
 * the page's "Popular" heading (`popular_heading`); tag words outside a dish become text, a heading (`tags`); a bare
 * allergens heading takes the next line, or none (`allergens`); a group's heading known by its words (`group_heading`).
 */
function refine(lines: Classified[], headings: ReadonlySet<string>): void {
  type At = { readonly line: Classified; readonly j: number };
  const flat: At[] = lines.flatMap((line) => line.tokens.map((_, j) => ({ line, j })));
  const tok = (a: At | undefined): WoltToken | undefined => a?.line.tokens[a.j];
  const put = (a: At, t: WoltToken): void => { a.line.tokens[a.j] = t; };

  // rule `noise_*`: a whole noise line of words only ("Share", "Excellent"), with a dish price right under it, is that
  // dish's name ("Open until 23:00" or "25–35 min" never is)
  flat.forEach((a, f) => {
    const t = tok(a)!;
    if (t.k === 'noise' && WORD_NOISE.has(t.rule) && a.line.tokens.length === 1 && LETTER.test(a.line.text) && !/\d/u.test(a.line.text) && tok(flat[f + 1])?.k === 'price') {
      put(a, { k: 'text', text: a.line.text });
    }
  });
  popularHeadings(flat.map(tok) as WoltToken[], headings).forEach((f) => put(flat[f]!, { k: 'text', text: (tok(flat[f]) as { text: string }).text }));

  // what closes the run of text that starts at each token (skipping noise, labels and tags): a dish's price, a rule…
  const quiet = (t: WoltToken) => t.k === 'noise' || t.k === 'label' || t.k === 'tags';
  const closes: Array<WoltToken['k'] | null> = new Array(flat.length).fill(null);
  for (let f = flat.length - 1, after: WoltToken['k'] | null = null; f >= 0; f--) {
    const t = tok(flat[f])!;
    if (t.k !== 'text' && !quiet(t)) after = t.k;
    closes[f] = after;
  }
  const near = (f: number, step: 1 | -1): number => { let g = f + step; while (g >= 0 && g < flat.length && quiet(tok(flat[g])!)) g += step; return g; };

  for (let f = 0; f < flat.length; f++) {
    const a = flat[f]!, t = tok(a)!;
    if (t.k === 'tags') {
      // rule `tags`: tag words are a heading only where the evidence says so (one of the page's own sections, or
      // before any dish, where only a heading stands); inside a dish's lines, or after its price with no dish after
      // them, they are its tags. Between a price and the next dish's lines they may be either dish's label or a
      // heading: with a common heading after them ("Vegan", "Mains": "Mains" wins) they are the dish before's, checked;
      // otherwise neither a tag nor a heading (a diet tag is never guessed onto a dish): left out, the dish before checked.
      // the next line past other tag words and labels (noise there, a footer, ends the page: the tag is the dish's)
      let ahead = f + 1;
      while (ahead < flat.length && (tok(flat[ahead])!.k === 'tags' || tok(flat[ahead])!.k === 'label')) ahead++;
      const prev = tok(flat[near(f, -1)]), next = tok(flat[ahead]);
      if (headings.has(importKey(t.text))) { put(a, { k: 'text', text: t.text }); continue; }
      if (prev?.k === 'text' || next?.k !== 'text' || closes[ahead] !== 'price') continue;
      if (prev === undefined) { put(a, { k: 'text', text: t.text }); continue; }
      let common = false;
      for (let g = ahead, seen = 0; g < flat.length && seen < SLOT_LOOK && !common; g++) {
        const u = tok(flat[g])!;
        if (u.k === 'text') { seen += 1; common = isCommonSection(u.text); } else if (!quiet(u)) break;
      }
      put(a, common ? { ...t, guess: true } : { k: 'unplaced', text: t.text });
    } else if (t.k === 'allergens' && t.text === null) {
      // rule `allergens`: a bare heading takes the next line as its list, unless that line heads a group
      const b = flat[f + 1], next = tok(b), after = tok(flat[f + 2]);
      if (b && next?.k === 'text' && after?.k !== 'rule' && groupCue(next.text) === null) {
        put(a, { k: 'allergens', text: next.text });
        put(b, { k: 'noise', rule: 'allergens' });
        f++;
      } else put(a, { k: 'noise', rule: 'allergens' });
    } else if (t.k === 'text') {
      // rule `group_heading`: a group's heading by its words, unless a price is right under it (then it is an option's
      // name) or the lines from it end at a dish's price (a listed dish: "Pick of the day", its description, its price)
      const cue = groupCue(t.text);
      const next = tok(flat[f + 1]);
      if (cue !== null && a.line.tokens.length === 1 && next?.k !== 'price' && next?.k !== 'option_price' && closes[f] !== 'price') {
        put(a, { k: 'head', text: t.text, strong: cue === 'strong' });
      }
    }
  }
}

// ---------------------------------------------------------------- 2. grammar

type Line = { readonly n: number; readonly text: string };
/** A label seen while a dish was still being read: applied to the dish its lines become. */
type Pending = { readonly n: number; readonly apply: (d: MDish) => void };

/** "Fries › Choose a sauce", "Sauce for fries", "Sauce (for fries)", "רוטב עבור צ׳יפס", "רוטב לצ׳יפס". */
const NESTED: ReadonlyArray<{ readonly re: RegExp; readonly explicit: boolean; readonly name: (m: RegExpExecArray) => string; readonly opener: (m: RegExpExecArray) => string }> = [
  { re: /^(.+?) ?[›>»] ?(.+)$/u, explicit: true, name: (m) => m[2]!, opener: (m) => m[1]! },
  { re: /^(.+?) \((?:for|עבור|ל[-־]?) ?(.+)\)$/u, explicit: true, name: (m) => m[0], opener: (m) => m[2]! },
  { re: /^(.+?) (?:for|עבור) (.+)$/u, explicit: true, name: (m) => m[0], opener: (m) => m[2]! },
  { re: /^(.+?) ל[-־]?(\S.*)$/u, explicit: false, name: (m) => m[0], opener: (m) => m[2]! },
];
/** A group heading longer than this is never read as nested (a heading is a few words). */
const NESTED_MAX = 120;

class WoltReader {
  readonly book = new NoteBook();
  readonly sections: MSection[] = [];
  /** Dishes read from a dish sheet (they show choices); matched to the listed dish of the same name afterwards. */
  readonly sheets = new Set<MDish>();
  readonly popular = new Set<MSection>();
  dropped = 0;
  private section: MSection | null = null;
  private dish: MDish | null = null;
  private sheet = false;
  private group: MGroup | null = null;
  private groupRule: GroupRule = NO_RULE;
  /** The group was just opened by its heading's words: a rule line right under it is its rule. */
  private fresh = false;
  private orphan = false;
  private run: Line[] = [];
  private pending: Pending[] = [];
  private dishesRead = 0;
  private last: WoltToken['k'] | null = null;
  private readonly lang: Lang;
  private readonly headings: ReadonlySet<string>;

  constructor(lang: Lang, headings: ReadonlySet<string>) {
    this.lang = lang;
    this.headings = headings;
  }

  read(n: number, t: WoltToken): void {
    if (t.k !== 'head' && t.k !== 'rule' && t.k !== 'noise') this.fresh = false;
    switch (t.k) {
      case 'text': this.text(n, t.text); break;
      case 'head': this.head(n, t.text, t.strong); break;
      case 'label': this.label(n, t.label); break;
      case 'tags': this.attach(n, (d) => { d.tags = [...new Set([...d.tags, ...t.tags])]; if (t.guess) guessed(d, 'tag_or_heading', n); }); break;
      case 'unplaced': if (this.dish) guessed(this.dish, 'tag_or_heading', n); else this.unknown([n]); break;
      case 'allergens': if (t.text !== null) this.attach(n, (d) => this.setAllergens(d, t.text!)); else this.unknown([n]); break;
      case 'rule': this.rule(n, t.rule, t.heading); break;
      case 'option_price': this.optionPrice(n, t.agorot, t.text); break;
      case 'price': this.price(n, t.price, t.next ?? 0); break;
      case 'end': this.end(n, t.price); break;
      case 'noise': this.book.add('noise', [n], { rule: t.rule }); break;
    }
    this.last = t.k;
  }

  /** The end of the input: what is left is the last group's options, or the sheet's description, or unread. */
  finish(): void {
    if (this.orphan) this.orphanLines(this.run.map((l) => l.n));
    else if (this.group) this.freeOptions();
    else if (this.sheet && this.dish) this.flushLeftovers();
    else this.unknown(this.run.map((l) => l.n));
    this.run = [];
    this.dropPending();
  }

  // ---- tokens

  private text(n: number, text: string): void {
    this.run.push({ n, text });
  }

  /** A group's heading known by its words: a new group of the dish being read (a weak cue only inside its sheet). */
  private head(n: number, text: string, strong: boolean): void {
    if (!this.dish || this.orphan || (!strong && !this.group)) return this.text(n, text);
    this.flushLeftovers();
    this.startGroup(text, NO_RULE, n);
    this.fresh = this.group !== null;
  }

  private label(n: number, label: Label): void {
    if (label === 'sold_out') this.attach(n, (d) => note(d, 'sold_out', n));
    else if (label === 'other') this.attach(n, (d) => note(d, 'label_dropped', n));
    else this.book.add('noise', [n], { rule: 'label' });
  }

  private rule(n: number, rule: GroupRule, heading: string | null): void {
    if (heading !== null) {
      this.flushLeftovers();
      this.startGroup(heading, rule, n);
    } else if (this.run.length > 0) {
      const h = this.run.pop()!;
      this.flushLeftovers();
      this.startGroup(h.text, rule, h.n);
      if (this.orphan) this.orphanLines([n]);
    } else if ((this.last === 'rule' || this.fresh) && this.group) {
      this.groupRule = joinRules(this.groupRule, rule);
      Object.assign(this.group, ruleLimits(this.groupRule));
    } else if (this.last === 'rule' && this.orphan) {
      this.orphanLines([n]);
    } else this.unknown([n]);
  }

  private optionPrice(n: number, agorot: number | null, text: string): void {
    if (this.orphan) { this.orphanLines([...this.run.map((l) => l.n), n]); this.run = []; return; }
    if (this.run.length === 0) return this.unknown([n]);
    if (!this.group) {
      // choices with no rule line under their heading: the first line of the run is the heading
      if (!this.dish || this.run.length < 2) { this.orphanLines([...this.run.map((l) => l.n), n]); this.run = []; this.dropPending(); return; }
      const h = this.run.shift()!;
      this.startGroup(h.text, NO_RULE, h.n);
    }
    const last = this.run.pop()!;
    this.freeOptions();
    this.group!.options.push(newOption(bilingual(last.text, this.lang), agorot, { priceText: agorot === null ? text : null }));
    this.dropPending();
  }

  private price(n: number, price: PriceRead, next: number): void {
    this.orphan = false;
    if (this.run.length === 0) {
      const d = this.dish;
      if (d && d.price === null && d.priceText === null && !this.sheet) setPrice(d, price, this.lang, n);
      else if (d && this.last === 'price' && d.price !== null && price.kind === 'one') {
        // a discount and the regular price on two lines
        d.price = Math.max(d.price, price.agorot);
        note(d, 'price_discount', n);
      } else this.unknown([n]);
      return;
    }
    if (this.group) {
      // the next dish begins after the last choices of a sheet: its name (and description) end the run, after a
      // section heading when one of the page's own sections comes first
      const lines = this.run;
      const nameAt = lines.length >= 2 && descShaped(lines[lines.length - 1]!.text) ? lines.length - 2 : lines.length - 1;
      let cut = nameAt;
      for (let i = nameAt - 1; i >= 0; i--) if (this.isHeading(lines[i]!.text)) { cut = i; break; }
      this.run = lines.slice(0, cut);
      this.freeOptions();
      this.endSheet();
      this.run = lines.slice(cut);
    }
    this.resolveDish(price, n, next);
  }

  private end(n: number, price: PriceRead | null): void {
    if (this.orphan) { this.orphanLines(this.run.map((l) => l.n)); this.run = []; this.orphan = false; return; }
    if (this.run.length > 0 && !this.group && !this.sheet && price && price.kind !== 'unreadable') {
      this.resolveDish(price, n, 0);
      note(this.dish!, 'price_from_button', n);
    } else {
      this.flushLeftovers();
      const d = this.dish;
      if (d && d.price === null && d.priceText === null && price && price.kind !== 'unreadable') {
        setPrice(d, price, this.lang, n);
        note(d, 'price_from_button', n);
      }
    }
    this.endSheet();
  }

  // ---- runs

  /** A line that heads a section by itself: one of the page's own sections, a common section name, or tag words. */
  private strong(l: Line): boolean { return this.isHeading(l.text) || isCommonSection(l.text) || readTags(l.text) !== null; }

  /**
   * A run closed by a dish price: [heading, section text…] [name] [description]. With the page's own sections, the
   * line after the last of them is the name (and the rest its description). Otherwise, of the last two lines:
   * - the second is the name when the first is a section heading by itself ("Desserts", then a long name);
   * - else the first is the name and the second its description when it reads like one ("Crispy chicken, lemon",
   *   "Family size ₪120");
   * - else (two short lines, "Malabi", "Homemade", or "Business lunch", "Lunch schnitzel") the page's habit decides
   *   (rule `desc_habit`): the next dish shows a description (two lines or more): a name and its description; the
   *   next shows none (one line): a heading and a name; no next dish: as the dish before in the section;
   * - at the top of the page, before any dish, a short last line is a name after its heading.
   */
  private resolveDish(price: PriceRead, n: number, next: number): void {
    const lines = this.run;
    this.run = [];
    const k = lines.length;
    let nameAt = k - 1;
    /** A reading the lines allow two ways: the rule that chose, checked on the section it opened and on the dish. */
    let guess: string | null = null;
    // a common name with a line marked as a description under it is the dish's name ("Coffee", "Filter coffee, refill")
    const named = (i: number) => i === k - 2 && descMarked(lines[k - 1]!.text);
    let known = -1;
    for (let i = k - 2; i >= 0 && known < 0; i--) if (this.isHeading(lines[i]!.text)) known = i;
    // without the page's list, a heading by itself (a common section name, tag words) among three lines or more
    if (known < 0 && k >= 3) for (let i = k - 2; i >= 0 && known < 0; i--) if (this.strong(lines[i]!) && !named(i)) known = i;
    if (known >= 0) nameAt = known + 1;
    else if (k >= 2) {
      const a = lines[k - 2]!, b = lines[k - 1]!;
      if (this.dishesRead === 0 && this.section === null) nameAt = (!this.strong(a) && descShaped(b.text)) || named(k - 2) ? k - 2 : k - 1;
      else if (named(k - 2)) nameAt = k - 2;
      else if (this.strong(a)) { nameAt = k - 1; guess = 'common_name'; }
      else if (descShaped(b.text) || hasMoney(b.text) || k > 2) nameAt = k - 2;
      else {
        const before = this.section?.dishes[this.section.dishes.length - 1];
        const described = next >= 2 || (next === 0 && before !== undefined && (before.desc.he !== '' || before.desc.en !== ''));
        nameAt = described ? k - 2 : k - 1;
        guess = 'desc_habit';
      }
    }
    const head = lines.slice(0, nameAt);
    if (head.length > 0) {
      this.openFromHead(head);
      if (guess) guessed(this.section!, guess, head[head.length - 1]!.n);
    }
    this.addDish(lines[nameAt]!, lines.slice(nameAt + 1), price, n);
    if (guess) guessed(this.dish!, guess, lines[nameAt]!.n);
  }

  /** The lines before a dish's name: the section heading, with the venue header or the page's section list before it. */
  private openFromHead(head: readonly Line[]): void {
    let at = -1;
    for (let i = head.length - 1; i >= 0 && at < 0; i--) if (this.isHeading(head[i]!.text)) at = i;
    // a common section name wins over tag words before it ("Vegan", "Mains": the heading is "Mains")
    for (let i = head.length - 1; i > 0 && at < 0; i--) if (isCommonSection(head[i]!.text) && head.slice(0, i).every((l) => readTags(l.text) !== null)) at = i;
    if (at < 0) {
      if (this.dishesRead > 0) at = 0;
      else {
        for (let i = head.length - 1; i >= 0 && at < 0; i--) if (headingShaped(head[i]!.text)) at = i;
        if (at < 0) at = head.length - 1;
      }
    }
    const s = this.openSection(head[at]!);
    for (const l of head.slice(0, at)) {
      if (this.isHeading(l.text)) this.book.add('noise', [l.n], { rule: 'nav' });
      else if (this.dishesRead === 0) this.book.add('noise', [l.n], { rule: 'header' });
      else note(s, 'section_text', l.n);
    }
    for (const l of head.slice(at + 1)) note(s, 'section_text', l.n);
  }

  /** What is left in the run when a group or a sheet closes: options of the group, else the sheet's description. */
  private flushLeftovers(): void {
    if (this.run.length === 0) return;
    if (this.orphan) { this.orphanLines(this.run.map((l) => l.n)); this.run = []; return; }
    if (this.group) { this.freeOptions(); this.dropPending(); return; }
    const d = this.dish;
    if (d && this.run.length > 0) {
      for (const l of this.run) d.desc = append(d.desc, scriptOf(l.text) ?? this.lang, l.text);
      this.run = [];
      this.applyPending(d);
      return;
    }
    this.unknown(this.run.map((l) => l.n));
    this.run = [];
  }

  /** Lines before a priced option in the same group: options with no price shown, which Wolt shows for free ones. */
  private freeOptions(): void {
    for (const l of this.run) this.group!.options.push(newOption(bilingual(l.text, this.lang), 0));
    this.run = [];
  }

  // ---- nodes

  private openSection(l: Line): MSection {
    const s = newSection(bilingual(l.text, this.lang), guessKind(l.text), { line: l.n });
    if (isPopularSection(l.text)) this.popular.add(s);
    this.sections.push(s);
    this.section = s;
    this.dish = null;
    this.endSheet();
    return s;
  }

  private addDish(name: Line, desc: readonly Line[], price: PriceRead, n: number): void {
    if (!this.section) {
      this.section = newSection(DEFAULT_SECTION_NAME, 'food');
      this.sections.push(this.section);
    }
    const marked = nameMarkers(name.text);
    const d = newDish(bilingual(stripBlank(marked.name), this.lang), { tags: marked.tags, line: name.n });
    for (const l of desc) d.desc = append(d.desc, scriptOf(l.text) ?? this.lang, l.text);
    setPrice(d, price, this.lang, n);
    this.applyPending(d);
    this.section.dishes.push(d);
    this.dish = d;
    this.dishesRead += 1;
    this.endSheet();
  }

  private startGroup(heading: string, rule: GroupRule, n: number): void {
    const d = this.dish;
    this.fresh = false;
    if (!d) { this.orphan = true; this.orphanLines([n]); this.group = null; return; }
    this.orphan = false;
    this.sheet = true;
    this.sheets.add(d);
    const g = newGroup(NO_NAME, ruleLimits(rule));
    this.groupRule = rule;
    let name = heading, nested = false;
    if (heading.length <= NESTED_MAX) {
      for (const form of NESTED) {
        const m = form.re.exec(heading);
        if (!m) continue;
        const opener = optionNamed(d, form.opener(m));
        if (opener) { name = form.name(m); opener.opens = g; nested = true; break; }
        if (form.explicit) { note(d, 'nesting_unmatched', n); break; }
      }
    }
    g.name = bilingual(name, this.lang);
    if (!nested) d.links.push({ group: g, min: null, max: null });
    this.group = g;
  }

  private setAllergens(d: MDish, text: string): void {
    d.allergens = append(d.allergens, scriptOf(text) ?? this.lang, text);
  }

  // ---- helpers

  private attach(n: number, apply: (d: MDish) => void): void {
    if (this.run.length > 0) this.pending.push({ n, apply });
    else if (this.dish) apply(this.dish);
    else this.unknown([n]);
  }
  private applyPending(d: MDish): void { for (const p of this.pending) p.apply(d); this.pending = []; }
  private dropPending(): void { for (const p of this.pending) this.book.add('noise', [p.n], { rule: 'label' }); this.pending = []; }
  private endSheet(): void { this.sheet = false; this.group = null; this.groupRule = NO_RULE; this.fresh = false; }
  private isHeading(text: string): boolean { return this.headings.has(importKey(text)); }
  private unknown(lines: readonly number[]): void { if (lines.length) { this.book.add('line_unknown', lines); this.dropped += lines.length; } }
  private orphanLines(lines: readonly number[]): void { if (lines.length) { this.book.add('group_orphan', lines); this.dropped += lines.length; } }
}

const NO_NAME: Text = { he: '', en: '' };

/**
 * Rule `nav_headings`: the page's own list of sections (copied from the top of the page) and its headings. In a run of
 * text lines that a dish price closes, with two lines or more before the dish's name and description (the list and the
 * first heading), those lines are candidates; a candidate that appears more than once in the text (in the list and
 * over its section) is a heading. Trusted only when there are two or more. "Popular" counts as text here, and so do
 * tag words among the list's lines (a page may have a "Vegan" section), but not those inside a dish's own lines.
 */
function navHeadings(lines: readonly Classified[]): Set<string> {
  const count = new Map<string, number>();
  const candidates: string[] = [];
  let run: Array<{ readonly text: string; readonly tag: boolean }> = [];
  const isText = (t: WoltToken): t is WoltToken & { text: string } => t.k === 'text' || t.k === 'tags' || (t.k === 'label' && t.label === 'popular');
  for (const l of lines) {
    for (const t of l.tokens) {
      if (isText(t)) {
        run.push({ text: t.text, tag: t.k === 'tags' });
        const k = importKey(t.text);
        if (k !== '') count.set(k, (count.get(k) ?? 0) + 1);
        continue;
      }
      if (t.k === 'noise' || t.k === 'label') continue;
      if (t.k === 'price') {
        // the dish is its last one or two lines of text (tag words among them are its labels); the head is what is
        // before them
        const texts = run.flatMap((e, i) => (e.tag ? [] : [i]));
        const tail = texts.length >= 2 && descShaped(run[texts[texts.length - 1]!]!.text) ? 2 : 1;
        const cut = texts.length > tail ? texts[texts.length - tail]! : 0;
        const head = run.slice(0, cut);
        if (head.filter((e) => !e.tag).length >= 2) candidates.push(...head.map((e) => importKey(e.text)));
      }
      run = [];
    }
  }
  const found = new Set(candidates.filter((k) => k !== '' && count.get(k)! >= 2));
  return found.size >= 2 ? found : new Set();
}

/**
 * Reads text copied from the owner's own Wolt venue page into a draft (source `wolt_text`). Never fetches anything.
 * The draft passes `validateDraft`; the notes say what was left out and what to check.
 */
export function parseWoltText(text: string): ReadResult {
  const { lines, truncated, clipped } = sourceLines(text);
  const classified: Classified[] = lines.map((l) => ({ n: l.n, text: l.text, tokens: [...classifyWoltLine(l.text).tokens] }));
  const headings = navHeadings(classified);
  refine(classified, headings);
  lookahead(classified);
  const words = classified.flatMap((l) => l.tokens.flatMap((t) => (t.k === 'text' ? [t.text] : [])));
  const reader = new WoltReader(mainLang(words), headings);
  if (truncated) reader.book.add('input_truncated');
  if (clipped.length) reader.book.add('text_clipped', clipped, { rule: 'line' });
  if (lines.every((l) => l.text === '')) reader.book.add('empty_input', [], { count: 1 });
  for (const l of classified) for (const t of l.tokens) reader.read(l.n, t);
  reader.finish();
  const sections = settle(reader);
  return buildDraft('wolt_text', [{ model: { sections }, notes: reader.book.list(), dropped: reader.dropped }]);
}

/**
 * For each dish price, how many text lines the next dish price closes, when nothing but those lines (and labels,
 * tags, allergens or noise) comes between them: the page's habit for rule `desc_habit`. 0: no such next dish.
 */
function lookahead(lines: Classified[]): void {
  const quiet = (k: WoltToken['k']) => k === 'noise' || k === 'label' || k === 'tags' || k === 'allergens';
  let run = 0;
  let open: { line: Classified; j: number } | null = null;
  const close = (next: number): void => {
    if (!open) return;
    const t = open.line.tokens[open.j] as Extract<WoltToken, { k: 'price' }>;
    open.line.tokens[open.j] = { ...t, next };
    open = null;
  };
  for (const line of lines) {
    line.tokens.forEach((t, j) => {
      if (t.k === 'text') { run += 1; return; }
      if (quiet(t.k)) return;
      close(t.k === 'price' ? run : 0);
      if (t.k === 'price') open = { line, j };
      run = 0;
    });
  }
  close(0);
}

/**
 * Rule `popular_heading`: a "Popular" line is the page's section of that name, not a dish's mark, when it is one of the
 * page's own sections, or when it comes before the first dish price and the next line that counts is not a price.
 * Returns the tokens (by index) that become text (a heading candidate); the others stay labels (noise).
 */
function popularHeadings(flat: readonly WoltToken[], headings: ReadonlySet<string>): number[] {
  const out: number[] = [];
  let priced = false;
  // the next token that counts after each one, found in one pass from the end
  const nextCounts: Array<WoltToken | undefined> = new Array(flat.length);
  for (let f = flat.length - 1, after: WoltToken | undefined; f >= 0; f--) {
    nextCounts[f] = after;
    const t = flat[f]!;
    if (t.k !== 'noise' && t.k !== 'label' && t.k !== 'tags') after = t;
  }
  flat.forEach((t, f) => {
    if (t.k === 'price') priced = true;
    if (t.k !== 'label' || t.label !== 'popular') return;
    const next = nextCounts[f];
    const nextIsPrice = next !== undefined && (next.k === 'price' || next.k === 'option_price');
    if (headings.has(importKey(t.text)) || (!priced && !nextIsPrice)) out.push(f);
  });
  return out;
}

/**
 * After reading: the "Popular" section stays (the draft's `dish_repeated` asks about each dish it repeats; a dish
 * found only there is noted), and each dish read from a sheet joins the listed dish of the same name, when exactly one
 * section other than "Popular" lists it (so a sheet copied under "Popular" lands in the dish's own section).
 */
function settle(r: WoltReader): MSection[] {
  const ids = new Map<MDish, string>();
  const id = (d: MDish): string => { let v = ids.get(d); if (v === undefined) ids.set(d, (v = nameIdentity(d.name, d.translated))); return v; };
  const regular = r.sections.filter((s) => !r.popular.has(s));
  const listed = new Set(regular.flatMap((s) => s.dishes.map(id)));
  for (const s of r.popular) {
    const only = s.dishes.filter((d) => !listed.has(id(d)));
    if (only.length > 0) r.book.add('popular_only', only.flatMap((d) => (d.line === null ? [] : [d.line])), { count: only.length });
  }
  // a section is the same section wherever its heading repeats (a page pasted twice)
  const sid = (s: MSection) => nameIdentity(s.name, s.translated);
  const ownOf = new Map<MDish, MSection>();
  for (const s of r.sections) for (const d of s.dishes) ownOf.set(d, s);
  // the listed (not sheet) dishes of each section identity, by dish identity
  const listing = new Map<string, Map<string, MSection>>();
  for (const s of regular) {
    for (const x of s.dishes) {
      if (r.sheets.has(x)) continue;
      let m = listing.get(id(x));
      if (!m) listing.set(id(x), (m = new Map()));
      if (!m.has(sid(s))) m.set(sid(s), s);
    }
  }
  // the moves first, then each section rebuilt once (so many sheets cost one pass, not one search each)
  const moved = new Map<MDish, MDish | null>();
  const arriving = new Map<MSection, Map<string, MDish[]>>();
  for (const d of r.sheets) {
    const own = ownOf.get(d);
    const homes = listing.get(id(d));
    if (!own || !homes) continue;
    // already in a section that lists it
    if (!r.popular.has(own) && homes.has(sid(own))) continue;
    if (homes.size !== 1) continue;
    const home = [...homes.values()][0]!;
    // under "Popular" the listing stays as it was read (without the sheet's choices): `dish_repeated` asks about it
    moved.set(d, r.popular.has(own) ? { ...d, links: [], notes: [] } : null);
    let by = arriving.get(home);
    if (!by) arriving.set(home, (by = new Map()));
    const list = by.get(id(d));
    if (list) list.push(d); else by.set(id(d), [d]);
  }
  for (const s of r.sections) {
    const by = arriving.get(s);
    if (!by && !s.dishes.some((d) => moved.has(d))) continue;
    const out: MDish[] = [];
    for (const x of s.dishes) {
      if (moved.has(x)) { const stays = moved.get(x); if (stays) out.push(stays); continue; }
      out.push(x);
      // each sheet joins right after the first listing of its dish
      const come = by?.get(id(x));
      if (come) { out.push(...come); by!.delete(id(x)); }
    }
    s.dishes = out;
  }
  // the section opened for dishes before any heading, when its dishes all found their own sections
  return r.sections.filter((s) => s.line !== null || s.dishes.length > 0);
}
