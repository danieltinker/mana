/**
 * `parseWoltText(text)`: text an owner copied from their own Wolt venue page (D33: we never fetch Wolt; this is only
 * what the owner pastes), in Hebrew or English, with or without the copied text of dish sheets and their choices.
 *
 * Two steps, each rule named so a real paste can tune it (packages/import/README.md lists what a real paste must
 * confirm):
 * 1. **Lines** (`classifyWoltLine`): every line is noise (the venue header, ratings, delivery times, opening hours,
 *    fees, buttons, the footer), a label (popular, new, sold out, a tag, another label), allergens, a group's rule
 *    ("Required", "Choose up to 2"), an option's price ("+₪5.00"), a dish's price ("₪42.00", "from ₪42", "₪42–58"),
 *    the end of a dish sheet ("Add to order"), or text.
 * 2. **Grammar** (`WoltReader`): text runs are closed by what follows them. A dish price closes a dish (its name, an
 *    optional description, and before them a section heading); a rule line closes a group heading; an option price
 *    closes an option. The venue's own list of sections at the top of the page, when it is there, tells headings from
 *    dishes (rule `nav_headings`).
 */
import { importKey, stripBlank, type Lang, type Tag, type Text } from '@mana/contracts';
import { buildDraft, nameIdentity, type ReadResult } from './build.ts';
import { DEFAULT_SECTION_NAME, newDish, newGroup, newOption, newSection, note, optionNamed, setPrice, type MDish, type MGroup, type MSection } from './model.ts';
import { NoteBook } from './notes.ts';
import { hasMoney, readOptionPrice, readPrice, splitPrice, type PriceRead } from './price.ts';
import { guessKind, isPopularSection, joinRules, nameMarkers, NO_RULE, readAllergens, readLabel, readRule, readTags, ruleLimits, type GroupRule, type Label } from './rules.ts';
import { append, bilingual, descShaped, headingShaped, lower, mainLang, scriptOf, sourceLines } from './text.ts';

// ---------------------------------------------------------------- 1. lines

export type WoltToken =
  | { readonly k: 'text'; readonly text: string }
  | { readonly k: 'price'; readonly price: PriceRead }
  | { readonly k: 'option_price'; readonly agorot: number | null; readonly text: string }
  | { readonly k: 'rule'; readonly rule: GroupRule; readonly heading: string | null }
  | { readonly k: 'tags'; readonly tags: readonly Tag[] }
  | { readonly k: 'label'; readonly label: Label; readonly text: string }
  | { readonly k: 'allergens'; readonly text: string | null }
  | { readonly k: 'end'; readonly price: PriceRead | null }
  | { readonly k: 'noise'; readonly rule: string };

const set = (...w: string[]): ReadonlySet<string> => new Set(w.map(lower));
const plain = (s: string): string => lower(s).replace(/[.!:]+$/u, '');

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
/** Rule `noise_footer`: the page's footer and anything naming Wolt itself. */
const FOOTER = set(
  'privacy', 'privacy policy', 'privacy statement', 'terms', 'terms of service', 'terms and conditions', 'cookies', 'cookie settings', 'cookie policy',
  'accessibility', 'accessibility statement', 'contact', 'contact us', 'support', 'help', 'careers', 'jobs', 'press', 'blog', 'download the app',
  'get the app', 'app store', 'google play', 'language', 'english', 'עברית', 'israel', 'ישראל', 'מדיניות פרטיות', 'תנאי שימוש', 'עוגיות',
  'הגדרות עוגיות', 'נגישות', 'הצהרת נגישות', 'צור קשר', 'צרו קשר', 'תמיכה', 'עזרה', 'קריירה', 'דרושים', 'הורדת האפליקציה', 'הורידו את האפליקציה',
);
const FOOTER_RE = /\bwolt\b|^©|all rights reserved|כל הזכויות שמורות/iu;
/** Rule `noise_fee`: delivery fees, minimum order, surcharges ("Delivery ₪9.90", "מינימום הזמנה 50 ₪", "Free delivery"). */
const FEE_RE = /^(?:free delivery|delivery(?: fee| cost)?|min(?:imum)?\.? order(?: value)?|small order (?:surcharge|fee)|service fee|דמי משלוח|משלוח|עלות משלוח|מינימום(?: הזמנה| להזמנה)?|הזמנת מינימום|תוספת להזמנה קטנה|דמי שירות)(?:[\s:.]|$)/iu;
/** Rule `noise_delivery`: delivery times and distances. */
const DELIVERY_RE = [
  /^\d{1,3} ?[–—-] ?\d{1,3} ?(?:min|mins|minutes|דק['׳]?|דקות)\.?$/iu,
  /^\d{1,3} ?(?:min|mins|minutes|דק['׳]?|דקות)\.?$/iu,
  /^(?:delivery|pickup|ready|משלוח|איסוף|מוכן)(?: in| תוך| בעוד)? ?\d.*(?:min|דק)/iu,
  /^\d+(?:[.,]\d+)? ?(?:km|ק["״]מ|m|מ['׳])$/iu,
  /^(?:estimated delivery|delivery time|זמן משלוח|זמן הכנה)/iu,
];
/** Rule `noise_hours`: opening hours ("Open until 23:00", "פתוח עד 22:00", "Sun–Thu 10:00–22:00", "Closed"). */
const HOURS = set('open', 'open now', 'closed', 'closed now', 'closed today', 'opening hours', 'opening times', 'hours', 'פתוח', 'פתוח עכשיו', 'פתוח כעת',
  'סגור', 'סגור כעת', 'סגור היום', 'שעות פתיחה', 'שעות פעילות');
const HOURS_RE = [
  /(?:open|opens|closes|closed|opening|until|פתוח|נפתח|נפתחת|נסגר|נסגרת|סגור|ייפתח|יפתח)[^\d₪]{0,20}\d{1,2}:\d{2}/iu,
  /\d{1,2}:\d{2} ?[–—-] ?\d{1,2}:\d{2}/u,
];
/** Rule `noise_rating`: venue and dish ratings, review counts, price levels. */
const RATING_RE = [
  /^(?:[★⭐☆✩] ?)?\d(?:[.,]\d)?(?: ?\/ ?(?:5|10))?(?: ?\(\d[\d,.]*\+?\))?$/u,
  /^(?:👍|♥|❤️?)? ?\d{1,3}%(?: ?\(\d[\d,.]*\+?\))?$/u,
  /^\(\d[\d,.]*\+?\)$/u,
  /^\d[\d,.]*\+? ?(?:ratings?|reviews?|דירוגים|ביקורות|חוות דעת)$/iu,
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
  const end = END_RE.exec(s);
  if (end) {
    const rest = end[1]!.trim();
    const price = rest === '' ? null : readPrice(rest, false);
    if (rest === '' || (price && price.kind !== 'unreadable')) return one('sheet_end', { k: 'end', price });
  }
  if (BUTTONS.has(p)) return noise('noise_button');
  if (FOOTER.has(p) || FOOTER_RE.test(s)) return noise('noise_footer');
  if (FEE_RE.test(s) && (hasMoney(s) || /free|חינם|\d/iu.test(s))) return noise('noise_fee');
  if (DELIVERY_RE.some((re) => re.test(s))) return noise('noise_delivery');
  if (HOURS.has(p) || HOURS_RE.some((re) => re.test(s))) return noise('noise_hours');
  const lbl = readLabel(s);
  if (lbl) return one(`label_${lbl}`, { k: 'label', label: lbl, text: s });
  if (/^\d{1,2}$/u.test(s)) return noise('noise_quantity');
  if (RATING_WORDS.has(p) || RATING_RE.some((re) => re.test(s))) return noise('noise_rating');
  const tags = readTags(s);
  if (tags) return one('tags', { k: 'tags', tags });
  const allergens = readAllergens(s);
  if (allergens) return one('allergens', { k: 'allergens', text: allergens.text });
  const rule = readRule(s);
  if (rule) return one('group_rule', { k: 'rule', rule: rule.rule, heading: rule.heading });
  const option = readOptionPrice(s);
  if (option) return one('option_price', { k: 'option_price', agorot: option.agorot, text: option.text });
  const price = readPrice(s, false);
  if (price) return one('price', { k: 'price', price });
  const split = splitPrice(s, false);
  if (split) {
    const second: WoltToken = split.option
      ? { k: 'option_price', agorot: split.price.kind === 'unreadable' ? null : split.price.agorot, text: s.slice(split.text.length).trim() }
      : { k: 'price', price: split.price };
    return { rule: 'text_price', tokens: [{ k: 'text', text: split.text }, second] };
  }
  return one('text', { k: 'text', text: s });
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
  private orphan = false;
  private run: Line[] = [];
  private pending: Pending[] = [];
  private awaitingAllergens = false;
  private dishesRead = 0;
  private last: WoltToken['k'] | null = null;
  private readonly lang: Lang;
  private readonly headings: ReadonlySet<string>;

  constructor(lang: Lang, headings: ReadonlySet<string>) {
    this.lang = lang;
    this.headings = headings;
  }

  read(n: number, t: WoltToken): void {
    switch (t.k) {
      case 'text': this.text(n, t.text); break;
      case 'label': this.label(n, t.label); break;
      case 'tags': this.attach(n, (d) => { d.tags = [...new Set([...d.tags, ...t.tags])]; }); break;
      case 'allergens': this.allergens(n, t.text); break;
      case 'rule': this.rule(n, t.rule, t.heading); break;
      case 'option_price': this.optionPrice(n, t.agorot, t.text); break;
      case 'price': this.price(n, t.price); break;
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
    if (this.awaitingAllergens) {
      this.awaitingAllergens = false;
      this.attach(n, (d) => this.setAllergens(d, text));
      return;
    }
    this.run.push({ n, text });
  }

  private label(n: number, label: Label): void {
    if (label === 'sold_out') this.attach(n, (d) => note(d, 'sold_out', n));
    else if (label === 'other') this.attach(n, (d) => note(d, 'label_dropped', n));
    else this.book.add('noise', [n], { rule: 'label' });
  }

  private allergens(n: number, text: string | null): void {
    if (text === null) { this.awaitingAllergens = true; return; }
    this.attach(n, (d) => this.setAllergens(d, text));
  }

  private rule(n: number, rule: GroupRule, heading: string | null): void {
    if (heading !== null) {
      this.flushLeftovers();
      this.startGroup(heading, rule, n);
    } else if (this.run.length > 0) {
      const h = this.run.pop()!;
      this.flushLeftovers();
      this.startGroup(h.text, rule, h.n);
    } else if (this.last === 'rule' && this.group) {
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
      if (!this.dish || this.run.length < 2) { this.orphanLines([...this.run.map((l) => l.n), n]); this.run = []; this.pending = []; return; }
      const h = this.run.shift()!;
      this.startGroup(h.text, NO_RULE, h.n);
    }
    const last = this.run.pop()!;
    this.freeOptions();
    this.group!.options.push(newOption(bilingual(last.text, this.lang), agorot, { priceText: agorot === null ? text : null }));
    this.dropPending();
  }

  private price(n: number, price: PriceRead): void {
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
    this.resolveDish(price, n);
  }

  private end(n: number, price: PriceRead | null): void {
    if (this.orphan) { this.orphanLines(this.run.map((l) => l.n)); this.run = []; this.orphan = false; return; }
    if (this.run.length > 0 && !this.group && !this.sheet && price && price.kind !== 'unreadable') {
      this.resolveDish(price, n);
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

  /** A run closed by a dish price: [heading, section text…] [name] [description]. */
  private resolveDish(price: PriceRead, n: number): void {
    const lines = this.run;
    this.run = [];
    let nameAt = lines.length - 1;
    if (lines.length >= 2) {
      const a = lines[lines.length - 2]!, b = lines[lines.length - 1]!;
      const known = this.headings.size > 0;
      if (!this.isHeading(a.text) && descShaped(b.text)) nameAt = lines.length - 2;
      // rule `desc_by_nav`: the page lists its sections, and neither line is one: a name and its description
      else if (known && lines.length === 2 && !this.isHeading(a.text) && !this.isHeading(b.text)) nameAt = 0;
    }
    const head = lines.slice(0, nameAt);
    if (head.length > 0) this.openFromHead(head);
    this.addDish(lines[nameAt]!, lines.slice(nameAt + 1), price, n);
  }

  /** The lines before a dish's name: the section heading, with the venue header or the page's section list before it. */
  private openFromHead(head: readonly Line[]): void {
    let at = -1;
    for (let i = head.length - 1; i >= 0 && at < 0; i--) if (this.isHeading(head[i]!.text)) at = i;
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
    if (!d) { this.orphan = true; this.orphanLines([n]); this.group = null; return; }
    this.orphan = false;
    this.sheet = true;
    this.sheets.add(d);
    const g = newGroup(NO_NAME, ruleLimits(rule));
    this.groupRule = rule;
    let name = heading, nested = false;
    for (const form of NESTED) {
      const m = form.re.exec(heading);
      if (!m) continue;
      const opener = optionNamed(d, form.opener(m));
      if (opener) { name = form.name(m); opener.opens = g; nested = true; break; }
      if (form.explicit) { note(d, 'nesting_unmatched', n); break; }
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
  private endSheet(): void { this.sheet = false; this.group = null; this.groupRule = NO_RULE; }
  private isHeading(text: string): boolean { return this.headings.has(importKey(text)); }
  private unknown(lines: readonly number[]): void { if (lines.length) { this.book.add('line_unknown', lines); this.dropped += lines.length; } }
  private orphanLines(lines: readonly number[]): void { if (lines.length) { this.book.add('group_orphan', lines); this.dropped += lines.length; } }
}

const NO_NAME: Text = { he: '', en: '' };

/**
 * Rule `nav_headings`: the page's own list of sections (copied from the top of the page) and its headings. In a run of
 * text lines that a dish price closes, with two lines or more before the dish's name and description (the list and the
 * first heading), those lines are candidates; a candidate that appears more than once in the text (in the list and
 * over its section) is a heading. Trusted only when there are two or more.
 */
function navHeadings(lines: ReadonlyArray<{ n: number; tokens: readonly WoltToken[] }>): Set<string> {
  const count = new Map<string, number>();
  const candidates: string[] = [];
  let run: string[] = [];
  const isText = (t: WoltToken): t is WoltToken & { text: string } => t.k === 'text' || (t.k === 'label' && t.label === 'popular');
  for (const t of lines.flatMap((l) => l.tokens)) {
    if (isText(t)) {
      run.push(t.text);
      const k = importKey(t.text);
      if (k !== '') count.set(k, (count.get(k) ?? 0) + 1);
      continue;
    }
    if (t.k === 'noise' || t.k === 'label' || t.k === 'tags') continue;
    if (t.k === 'price') {
      const tail = run.length >= 2 && descShaped(run[run.length - 1]!) ? 2 : 1;
      const head = run.slice(0, Math.max(0, run.length - tail));
      if (head.length >= 2) candidates.push(...head.map(importKey));
    }
    run = [];
  }
  const found = new Set(candidates.filter((k) => k !== '' && count.get(k)! >= 2));
  return found.size >= 2 ? found : new Set();
}

/**
 * Reads text copied from the owner's own Wolt venue page into a draft (source `wolt_text`). Never fetches anything.
 * The draft passes `validateDraft`; the notes say what was left out and what to check.
 */
export function parseWoltText(text: string): ReadResult {
  const { lines, truncated } = sourceLines(text);
  const classified = lines.map((l) => ({ n: l.n, tokens: [...classifyWoltLine(l.text).tokens] }));
  const headings = navHeadings(classified);
  popularHeadings(classified, headings);
  const words = classified.flatMap((l) => l.tokens.flatMap((t) => (t.k === 'text' ? [t.text] : [])));
  const reader = new WoltReader(mainLang(words), headings);
  if (truncated) reader.book.add('input_truncated');
  if (lines.every((l) => l.text === '')) reader.book.add('empty_input', [], { count: 1 });
  for (const l of classified) for (const t of l.tokens) reader.read(l.n, t);
  reader.finish();
  const sections = settle(reader);
  return buildDraft('wolt_text', [{ model: { sections }, notes: reader.book.list(), dropped: reader.dropped }]);
}

/**
 * Rule `popular_heading`: a "Popular" line is the page's section of that name, not a dish's mark, when it is one of the
 * page's own sections, or when it comes before the first dish price and the next line that counts is not a price.
 * Such a line becomes text (a heading candidate); otherwise it stays a label (noise).
 */
function popularHeadings(lines: Array<{ n: number; tokens: WoltToken[] }>, headings: ReadonlySet<string>): void {
  const flat = lines.flatMap((l, i) => l.tokens.map((t, j) => ({ i, j, t })));
  let priced = false;
  flat.forEach(({ i, j, t }, at) => {
    if (t.k === 'price') priced = true;
    if (t.k !== 'label' || t.label !== 'popular') return;
    const next = flat.slice(at + 1).find((x) => x.t.k !== 'noise' && x.t.k !== 'label' && x.t.k !== 'tags');
    const nextIsPrice = next !== undefined && (next.t.k === 'price' || next.t.k === 'option_price');
    if (headings.has(importKey(t.text)) || (!priced && !nextIsPrice)) lines[i]!.tokens[j] = { k: 'text', text: t.text };
  });
}

/**
 * After reading: the "Popular" section is left out (its dishes are listed again in their own sections), and each dish
 * read from a sheet joins the listed dish of the same name, when exactly one section lists it.
 */
function settle(r: WoltReader): MSection[] {
  const id = (d: MDish) => nameIdentity(d.name, d.translated);
  const regular = r.sections.filter((s) => !r.popular.has(s));
  const listed = new Set(regular.flatMap((s) => s.dishes.map(id)));
  for (const s of r.popular) {
    const only = s.dishes.filter((d) => !listed.has(id(d)));
    if (s.dishes.length > only.length) r.book.add('popular_dropped', s.line === null ? [] : [s.line], { count: s.dishes.length - only.length });
    if (only.length > 0) r.book.add('popular_only', only.flatMap((d) => (d.line === null ? [] : [d.line])), { count: only.length });
  }
  // a section is the same section wherever its heading repeats (a page pasted twice)
  const sid = (s: MSection) => nameIdentity(s.name, s.translated);
  const listedIn = (s: MSection, d: MDish) => s.dishes.some((x) => x !== d && !r.sheets.has(x) && id(x) === id(d));
  for (const d of r.sheets) {
    const own = regular.find((s) => s.dishes.includes(d));
    if (!own || regular.some((s) => sid(s) === sid(own) && listedIn(s, d))) continue;
    const homes = new Set(regular.filter((s) => listedIn(s, d)).map(sid));
    if (homes.size !== 1) continue;
    const home = regular.find((s) => homes.has(sid(s)) && listedIn(s, d))!;
    own.dishes.splice(own.dishes.indexOf(d), 1);
    home.dishes.splice(home.dishes.findIndex((x) => id(x) === id(d)) + 1, 0, d);
  }
  // the section opened for dishes before any heading, when its dishes all found their own sections
  return regular.filter((s) => s.line !== null || s.dishes.length > 0);
}
