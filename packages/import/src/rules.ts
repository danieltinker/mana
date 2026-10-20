/**
 * The words the text readers recognise, in Hebrew and English, each list a named rule with its own tests: a group's
 * limits ("Required", "Choose up to 2", "בחרו עד 2"), a group's heading, the dish labels that are tags (`TAGS` only),
 * sold out, allergens, the labels that are not tags, and the kind of a section by its heading. A label is a whole
 * line (or a whole part of one); a word inside a dish's name or description is never a label. Every rule here runs
 * in time linear in its line (no pattern can backtrack over the line twice), and labels are short: a longer line is
 * never one.
 */
import type { SectionKind, SelectionKind, Tag } from '@mana/contracts';
import { lower } from './text.ts';

/** The longest line any label, rule or heading cue can be. */
const LABEL_MAX = 80;
const isSpace = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r';
const EDGE_START = new Set(['"', "'", '“', '”', '«', '»', '(', '[']);
const EDGE_END = new Set(['"', "'", '“', '”', '«', '»', ')', ']', '.', '!', ':']);

/** A line as a label: lowercase A–Z, no edge quotes, brackets or final punctuation, single spaces. */
function label(s: string): string {
  const t = lower(s);
  let a = 0, b = t.length;
  while (a < b && (isSpace(t[a]!) || EDGE_START.has(t[a]!))) a++;
  while (b > a && (isSpace(t[b - 1]!) || EDGE_END.has(t[b - 1]!))) b--;
  const inner = t.slice(a, b);
  return /\s\s|[^\S ]/u.test(inner) ? inner.split(/\s+/u).filter((w) => w !== '').join(' ') : inner;
}
const words = (...list: string[]): ReadonlySet<string> => new Set(list.map(label));
const has = (set: ReadonlySet<string>, line: string): boolean => line.length <= LABEL_MAX && set.has(label(line));

// ---------------------------------------------------------------- group limits

/** What a group's rule lines state. Every field null = nothing stated. */
export type GroupRule = {
  readonly required: boolean | null;
  readonly exact: number | null;
  readonly upTo: number | null;
  readonly atLeast: number | null;
  readonly range: readonly [number, number] | null;
};

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, אחד: 1, אחת: 1, שניים: 2, שתיים: 2, שני: 2, שתי: 2, שלושה: 3, שלוש: 3, ארבעה: 4, ארבע: 4, חמישה: 5, חמש: 5,
};
const N = String.raw`(\d{1,2}|one|two|three|four|five|אחד|אחת|שניים|שתיים|שני|שתי|שלושה|שלוש|ארבעה|ארבע|חמישה|חמש)`;
const VERB = String.raw`(?:choose|select|pick|בחרו|בחר|בחרי|ניתן לבחור|אפשר לבחור|יש לבחור|לבחור)`;
const TAIL = String.raw`(?: (\S.*))?`;
const RULE_RE = {
  required: /^(?:required|mandatory|חובה|שדה חובה|נדרש|בחירת חובה)$/u,
  optional: /^(?:optional|not required|רשות|אופציונלי|אופציונאלי|לא חובה)$/u,
  oneChoice: /^(?:בחירה אחת|one choice|single choice)$/u,
  upTo: new RegExp(`^(?:${VERB} )?(?:up to|max(?:imum)?\\.?|עד|מקסימום) ${N}${TAIL}$`, 'u'),
  atLeast: new RegExp(`^(?:${VERB} )?(?:at least|min(?:imum)?\\.?|לפחות|מינימום) ${N}${TAIL}$`, 'u'),
  // a range is a rule only with a verb or "between": "Choose 1-3", "between 1 and 3", "בין 1 ל-3"; never "12-23"
  range: new RegExp(`^(?:${VERB} (?:between |בין )?|between |בין )${N} ?(?:[-–]|and|to|ל[-־]?|עד) ?${N}${TAIL}$`, 'u'),
  exact: new RegExp(`^${VERB} ${N}${TAIL}$`, 'u'),
};
/** Words after a count that only say what is counted ("Choose 2 items"): the line names no group. */
const COUNTED = words('item', 'items', 'option', 'options', 'choice', 'choices', 'פריט', 'פריטים', 'אפשרות', 'אפשרויות', 'מתוך', 'בחירות');

const num = (s: string): number => NUMBER_WORDS[s] ?? Number(s);

/** One fragment of a rule line; `tail` = the words after the count, when they name something. */
function fragment(f: string): { rule: Partial<GroupRule>; tail: string | null } | null {
  const s = label(f);
  if (RULE_RE.required.test(s)) return { rule: { required: true }, tail: null };
  if (RULE_RE.optional.test(s)) return { rule: { required: false }, tail: null };
  if (RULE_RE.oneChoice.test(s)) return { rule: { exact: 1 }, tail: null };
  const tail = (t: string | undefined): string | null => (t === undefined || COUNTED.has(label(t)) ? null : t);
  let m = RULE_RE.upTo.exec(s);
  if (m) return { rule: { upTo: num(m[1]!) }, tail: tail(m[2]) };
  if ((m = RULE_RE.atLeast.exec(s))) return { rule: { atLeast: num(m[1]!) }, tail: tail(m[2]) };
  if ((m = RULE_RE.range.exec(s))) return { rule: { range: [num(m[1]!), num(m[2]!)] }, tail: tail(m[3]) };
  if ((m = RULE_RE.exact.exec(s))) return { rule: { exact: num(m[1]!) }, tail: tail(m[2]) };
  return null;
}

/**
 * Rule `group_rule`: a line that states a group's limits, as fragments joined by "·", "•", "|", "," or brackets:
 * "Required", "Optional", "Choose 1", "Choose up to 2", "Choose at least 1", "Choose 1-3", "בחרו עד 2", "חובה · בחרו 1".
 * `heading` is set when the line also names the group: "Choose up to 2 sauces", "Choose a side (required)". null: not a
 * rule line.
 */
export function readRule(line: string): { rule: GroupRule; heading: string | null } | null {
  if (line.length > LABEL_MAX) return null;
  const parts = line.split(/[·•|,()]/u).map((p) => p.trim()).filter((p) => p !== '');
  if (parts.length === 0) return null;
  const read = parts.map(fragment);
  // "Choose a side (required)": a name first, then only rule fragments
  const firstRule = read.findIndex((r) => r !== null);
  if (firstRule < 0 || read.slice(firstRule).some((r) => r === null)) return null;
  let heading = firstRule > 0 ? parts.slice(0, firstRule).join(' ') : null;
  let rule = NO_RULE;
  for (const r of read.slice(firstRule) as Array<NonNullable<ReturnType<typeof fragment>>>) {
    rule = joinRules(rule, { ...NO_RULE, ...r.rule });
    if (r.tail !== null && heading === null) heading = line;
  }
  return { rule, heading };
}

/** Joins two rules read on separate lines ("Required", then "Choose 1"); what the first stated stays. */
export function joinRules(a: GroupRule, b: GroupRule): GroupRule {
  return {
    required: a.required ?? b.required, exact: a.exact ?? b.exact, upTo: a.upTo ?? b.upTo, atLeast: a.atLeast ?? b.atLeast, range: a.range ?? b.range,
  };
}

/** A rule that states a count ("Choose 1", "up to 2", "at least 1", "1-3"), not only required or optional. */
export const counted = (r: GroupRule): boolean => r.exact !== null || r.upTo !== null || r.range !== null || r.atLeast !== null;

/**
 * What a rule means for the group, stating only what the source stated: a count of 1 is a single choice. "Required"
 * or "Optional" alone states no count, so the group's limits are the owner's to confirm (`limits_guessed`): "Required"
 * alone reads as a single choice; "Optional" alone, or no rule at all, as a multiple one.
 */
export function ruleLimits(r: GroupRule): { selection: SelectionKind; min: number | null; max: number | null } {
  const req = r.required;
  if (r.exact !== null) {
    if (r.exact === 1) return { selection: 'single', min: req === false ? 0 : 1, max: 1 };
    return { selection: 'multiple', min: req === false ? 0 : r.exact, max: r.exact };
  }
  if (r.range !== null) {
    const [lo, hi] = r.range;
    return hi === 1 ? { selection: 'single', min: lo, max: 1 } : { selection: 'multiple', min: lo, max: hi };
  }
  if (r.upTo !== null) {
    if (r.upTo === 1) return { selection: 'single', min: req === true ? 1 : 0, max: 1 };
    return { selection: 'multiple', min: req === true ? 1 : req === false ? 0 : null, max: r.upTo };
  }
  if (r.atLeast !== null) return { selection: 'multiple', min: r.atLeast, max: null };
  if (req === true) return { selection: 'single', min: null, max: null };
  return { selection: 'multiple', min: null, max: null };
}

export const NO_RULE: GroupRule = { required: null, exact: null, upTo: null, atLeast: null, range: null };

/** Words that name a group of choices ("Extras", "תוספות"): a heading inside a dish sheet even with no rule line. */
const GROUP_NOUNS = words(
  'extras', 'extra', 'toppings', 'topping', 'sides', 'side', 'side dish', 'sauces', 'sauce', 'add-ons', 'addons', 'dressing', 'dressings', 'dips', 'dip',
  'size', 'sizes', 'bread', 'drink', 'drinks', 'תוספות', 'תוספת', 'רטבים', 'רוטב', 'גודל', 'גדלים', 'ממרחים', 'מטבלים', 'לחם', 'שתייה', 'שתיה',
);
const GROUP_VERB = /^(?:choose|select|pick|בחרו|בחר|בחרי|בחירת|בחירה של) \S/u;
/**
 * Rule `group_heading`: a line of a dish sheet that opens a new group even without a rule line under it. `strong`: it
 * opens with a choice verb ("Choose a sauce", "בחרו רוטב") or asks ("Add a drink?"), which no section heading does;
 * `weak`: it ends with ":" or is a group's common name ("Extras", "תוספות"), which a section heading of the page may
 * also be, so it counts only inside a sheet. null: neither. (A line with a price right under it is an option, whatever
 * its words: the reader checks that.)
 */
export function groupCue(line: string): 'strong' | 'weak' | null {
  if (line.length > LABEL_MAX) return null;
  const s = lower(line.trim());
  if (GROUP_VERB.test(s) || s.endsWith('?')) return 'strong';
  if (s.endsWith(':') || GROUP_NOUNS.has(label(line))) return 'weak';
  return null;
}

// ---------------------------------------------------------------- labels

const TAG_WORDS: ReadonlyArray<readonly [Tag, ReadonlySet<string>]> = [
  ['vegan', words('vegan', 'טבעוני', 'טבעונית', 'טבעוניים')],
  ['vegetarian', words('vegetarian', 'צמחוני', 'צמחונית', 'צמחוניים')],
  ['spicy', words('spicy', 'חריף', 'חריפה', 'חריפים', '🌶', '🌶️')],
  ['gf', words('gluten free', 'gluten-free', 'gf', 'ללא גלוטן', 'נטול גלוטן', 'נטולת גלוטן')],
];
const tagOf = (s: string): Tag | null => { const l = label(s); return TAG_WORDS.find(([, w]) => w.has(l))?.[0] ?? null; };

/** Rule `tags`: a line made only of tag labels ("Vegan", "טבעוני · ללא גלוטן", "🌶️"). null: not such a line. */
export function readTags(line: string): Tag[] | null {
  if (line.length > LABEL_MAX || /:\s*$/u.test(line)) return null;
  const parts = line.split(/[·•|,/]| [-–] /u).map((p) => p.trim()).filter((p) => p !== '');
  const tags = parts.map(tagOf);
  if (parts.length === 0 || tags.some((t) => t === null)) return null;
  return [...new Set(tags as Tag[])];
}

/** How far from the end of a name the markers are looked for, and how many. */
const MARKERS_SPAN = 60, MARKERS_MAX = 3;
/**
 * Rule `name_markers`: tag labels written at the end of a name, "Falafel (vegan)", "Curry 🌶️", "סלט (ללא גלוטן)": the
 * name without them, and their tags. A marker that is not a tag ("(V)", which may mean vegan or vegetarian) stays in
 * the name. At most three, within the name's last 60 characters.
 */
export function nameMarkers(name: string): { name: string; tags: Tag[] } {
  let rest = name.trimEnd();
  const tags: Tag[] = [];
  const floor = Math.max(0, rest.length - MARKERS_SPAN);
  for (let i = 0; i < MARKERS_MAX; i++) {
    let marker: string, at: number;
    if (rest.endsWith(')')) {
      at = rest.lastIndexOf('(');
      if (at <= floor || rest.length - at > 22) break;
      marker = rest.slice(at + 1, -1);
    } else if (rest.endsWith('🌶️') || rest.endsWith('🌶')) {
      marker = '🌶';
      at = rest.length - (rest.endsWith('🌶️') ? '🌶️'.length : '🌶'.length);
    } else break;
    const t = tagOf(marker);
    const before = rest.slice(0, at).trimEnd();
    if (t === null || before === '') break;
    if (!tags.includes(t)) tags.unshift(t);
    rest = before;
  }
  return { name: rest, tags };
}

/** Rule `sold_out`: the dish is marked sold out or unavailable. */
const SOLD_OUT = words(
  'sold out', 'out of stock', 'unavailable', 'not available', 'currently unavailable', 'temporarily unavailable',
  'אזל', 'אזל מהמלאי', 'אזלו', 'לא זמין', 'לא זמין כרגע', 'לא זמינה', 'לא במלאי', 'אזל זמנית',
);
/** Rule `label_popular`: the "popular" mark on a dish (never a tag). */
const POPULAR = words('popular', 'פופולרי', 'פופולארי', 'פופולרית', 'bestseller', 'best seller', 'רב מכר', 'רבי מכר', 'הכי נמכר');
/** Rule `label_new`. */
const NEW = words('new', 'new!', 'חדש', 'חדשה', 'חדש!');
/** Rule `label_discount`: a percentage mark ("-20%", "20% off", "15% הנחה"); words like "Special offer" may head a
 * section, so they are not labels. */
const DISCOUNT_RE = /^-?\d{1,2}%(?: off| הנחה)?$/u;
/** Rule `label_other`: labels that are not among Mana's tags; left out with a note. */
const OTHER_LABELS = words(
  'kosher', 'kosher dairy', 'kosher meat', 'כשר', 'כשר למהדרין', 'בשרי', 'חלבי', 'פרווה', 'halal', 'organic', 'אורגני', 'contains alcohol', 'מכיל אלכוהול', '18+',
  'sugar free', 'ללא סוכר', 'ללא תוספת סוכר', 'dairy free', 'ללא חלב', 'lactose free', 'ללא לקטוז', 'keto', 'קטו', 'low carb', 'דל פחמימות',
);
/** Section headings of a Wolt page that repeat dishes shown in other sections. */
const POPULAR_SECTIONS = words(
  'popular', 'most ordered', 'most popular', 'popular items', 'popular dishes', 'top picks', 'bestsellers',
  'פופולרי', 'פופולריים', 'פופולארי', 'הכי מוזמנים', 'הכי פופולרי', 'הכי פופולריים', 'המנות הפופולריות', 'הפריטים הפופולריים', 'רבי מכר',
);

export type Label = 'sold_out' | 'popular' | 'new' | 'discount' | 'other';
/** The label a whole line is, if it is one. */
export function readLabel(line: string): Label | null {
  if (line.length > LABEL_MAX) return null;
  const s = label(line);
  if (SOLD_OUT.has(s)) return 'sold_out';
  if (POPULAR.has(s)) return 'popular';
  if (NEW.has(s)) return 'new';
  if (DISCOUNT_RE.test(s)) return 'discount';
  if (OTHER_LABELS.has(s)) return 'other';
  return null;
}
export const isPopularSection = (heading: string): boolean => has(POPULAR_SECTIONS, heading);

const ALLERGENS_RE = /^(?:allergens|allergen info(?:rmation)?|allergy info(?:rmation)?|contains allergens|אלרגנים|מידע על אלרגנים|מידע אלרגני|רכיבים אלרגניים)(?: ?[:：–-] ?| ?$)(.*)$/iu;
/**
 * Rule `allergens`: "Allergens: gluten, egg", "אלרגנים: גלוטן, ביצים" (the words after the label, copied as they are), or
 * a bare "Allergens" heading (`text` null: the list may be on the next line).
 */
export function readAllergens(line: string): { text: string | null } | null {
  const m = ALLERGENS_RE.exec(line);
  if (!m) return null;
  const rest = m[1]!.trim();
  return { text: rest === '' ? null : rest };
}

// ---------------------------------------------------------------- sections

/** Words of a heading that say its kind, matched as whole words (so "Sweet potato" or "Salad bar" stay food). */
const KIND_WORDS: ReadonlyArray<readonly [SectionKind, ReadonlySet<string>]> = [
  ['wine', words('wine', 'wines', 'יין', 'יינות')],
  ['beer', words('beer', 'beers', 'בירה', 'בירות')],
  ['dessert', words('dessert', 'desserts', 'sweets', 'קינוח', 'קינוחים', 'מתוקים')],
  ['drinks', words(
    'drinks', 'drink', 'beverages', 'cocktails', 'coffee', 'tea', 'teas', 'juices', 'smoothies', 'lemonades', 'spirits', 'alcohol',
    'שתייה', 'שתיה', 'משקאות', 'קוקטיילים', 'קפה', 'תה', 'מיצים', 'שייקים', 'אלכוהול',
  )],
];
/** Whole headings that say a kind though none of their words does on its own ("Cakes", where "Fish cakes" is food). */
const KIND_HEADINGS: ReadonlyArray<readonly [SectionKind, ReadonlySet<string>]> = [
  ['dessert', words('cakes', 'cakes & pastries', 'cakes and pastries', 'עוגות', 'עוגות ומאפים')],
];
/**
 * Rule `section_kind`: the kind of a section by the whole words of its heading (the owner can change it): "Hot drinks"
 * and "קינוחים" say theirs; "Pancakes", "Sweet potato", "Salad bar" or "שתי פיצות" stay food. "food" when nothing says
 * otherwise.
 */
export function guessKind(heading: string): SectionKind {
  if (heading.length > LABEL_MAX) return 'food';
  const whole = label(heading);
  for (const [k, set] of KIND_HEADINGS) if (set.has(whole)) return k;
  const ws = whole.split(/[ ,&/+]+/u).map(label);
  for (const [k, set] of KIND_WORDS) if (ws.some((w) => set.has(w))) return k;
  return 'food';
}

/** Rule `common_section`: headings menus often use (a strong sign that a line opens a section). */
const COMMON_SECTIONS = words(
  'starters', 'appetizers', 'first courses', 'mains', 'main courses', 'main dishes', 'desserts', 'drinks', 'beverages', 'soft drinks', 'hot drinks',
  'cold drinks', 'salads', 'soups', 'pizzas', 'pasta', 'sandwiches', 'burgers', 'sides', 'side dishes', 'extras', 'kids', 'kids menu', 'breakfast',
  'brunch', 'lunch', 'dinner', 'cocktails', 'wines', 'wine', 'beers', 'beer', 'coffee', 'specials', 'menu',
  'ראשונות', 'מנות ראשונות', 'עיקריות', 'מנות עיקריות', 'קינוחים', 'שתייה', 'שתיה', 'משקאות', 'שתייה חמה', 'שתייה קרה', 'סלטים', 'מרקים',
  'פיצות', 'פסטות', 'פסטה', 'כריכים', 'סנדוויצ׳ים', 'המבורגרים', 'תוספות', 'ילדים', 'מנות ילדים', 'ארוחות בוקר', 'ארוחת בוקר', 'בוקר', 'צהריים',
  'ערב', 'קוקטיילים', 'יינות', 'יין', 'בירות', 'בירה', 'קפה', 'מיוחדים', 'ספיישלים', 'תפריט',
);
export const isCommonSection = (line: string): boolean => has(COMMON_SECTIONS, line);
