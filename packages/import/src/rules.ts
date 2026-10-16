/**
 * The words the text readers recognise, in Hebrew and English, each list a named rule with its own tests: a group's
 * limits ("Required", "Choose up to 2", "בחרו עד 2"), the dish labels that are tags (`TAGS` only), sold out, allergens,
 * the labels that are not tags, and the kind of a section by its heading. A label is a whole line (or a whole part
 * of one); a word inside a dish's name or description is never a label.
 */
import type { SectionKind, SelectionKind, Tag } from '@mana/contracts';
import { lower } from './text.ts';

/** A line as a label: lowercase A–Z, no edge punctuation, single spaces. */
const label = (s: string): string => lower(s).replace(/^[\s"'“”«»(\[]+|[\s"'“”«»)\].!:]+$/gu, '').replace(/\s+/gu, ' ');
const words = (...list: string[]): ReadonlySet<string> => new Set(list.map(label));

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
const TAIL = String.raw`(?:\s+(.+))?`;
const RULE_RE = {
  required: /^(?:required|mandatory|חובה|שדה חובה|נדרש|בחירת חובה)$/u,
  optional: /^(?:optional|not required|רשות|אופציונלי|אופציונאלי|לא חובה)$/u,
  oneChoice: /^(?:בחירה אחת|one choice|single choice)$/u,
  upTo: new RegExp(`^(?:${VERB}\\s+)?(?:up to|max(?:imum)?\\.?|עד|מקסימום)\\s+${N}${TAIL}$`, 'u'),
  atLeast: new RegExp(`^(?:${VERB}\\s+)?(?:at least|min(?:imum)?\\.?|לפחות|מינימום)\\s+${N}${TAIL}$`, 'u'),
  range: new RegExp(`^(?:${VERB}\\s+)?(?:between\\s+|בין\\s+)?${N}\\s?(?:[-–]|and|to|ל[-־]?|עד)\\s?${N}${TAIL}$`, 'u'),
  exact: new RegExp(`^${VERB}\\s+${N}${TAIL}$`, 'u'),
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
  if (line.length > 80) return null;
  const parts = line.split(/\s*[·•|,()]\s*/u).filter((p) => p !== '');
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

/**
 * What a rule means for the group, stating only what the source stated: a count of 1 is a single choice; "Required"
 * alone is a single required choice; "Optional" alone, or no rule at all, states nothing (a multiple choice whose
 * limits the owner confirms: `limits_guessed`).
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
  if (req === true) return { selection: 'single', min: 1, max: null };
  return { selection: 'multiple', min: null, max: null };
}

export const NO_RULE: GroupRule = { required: null, exact: null, upTo: null, atLeast: null, range: null };

// ---------------------------------------------------------------- labels

const TAG_WORDS: ReadonlyArray<readonly [Tag, ReadonlySet<string>]> = [
  ['vegan', words('vegan', 'טבעוני', 'טבעונית', 'טבעוניים')],
  ['vegetarian', words('vegetarian', 'צמחוני', 'צמחונית', 'צמחוניים')],
  ['spicy', words('spicy', 'חריף', 'חריפה', 'חריפים', '🌶', '🌶️')],
  ['gf', words('gluten free', 'gluten-free', 'gf', 'ללא גלוטן', 'נטול גלוטן', 'נטולת גלוטן')],
];
const tagOf = (s: string): Tag | null => TAG_WORDS.find(([, w]) => w.has(label(s)))?.[0] ?? null;

/** Rule `tags`: a line made only of tag labels ("Vegan", "טבעוני · ללא גלוטן", "🌶️"). null: not such a line. */
export function readTags(line: string): Tag[] | null {
  const parts = line.split(/\s*[·•|,/]\s*|\s+[-–]\s+/u).filter((p) => p !== '');
  const tags = parts.map(tagOf);
  if (parts.length === 0 || tags.some((t) => t === null)) return null;
  return [...new Set(tags as Tag[])];
}

const MARKER = /\s*(?:\(\s*([^()]{1,20})\s*\)|(🌶️?))\s*$/u;
/**
 * Rule `name_markers`: tag labels written at the end of a name, "Falafel (vegan)", "Curry 🌶️", "סלט (ללא גלוטן)": the
 * name without them, and their tags. A marker that is not a tag ("(V)", which may mean vegan or vegetarian) stays in
 * the name.
 */
export function nameMarkers(name: string): { name: string; tags: Tag[] } {
  let rest = name;
  const tags: Tag[] = [];
  for (let m = MARKER.exec(rest); m; m = MARKER.exec(rest)) {
    const t = tagOf(m[1] ?? m[2]!);
    if (t === null || m.index === 0) break;
    if (!tags.includes(t)) tags.unshift(t);
    rest = rest.slice(0, m.index);
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
/** Rule `label_discount`: "-20%", "Sale", "מבצע". */
const DISCOUNT = words('discount', 'sale', 'deal', 'offer', 'special offer', 'מבצע', 'הנחה', 'דיל');
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
  const s = label(line);
  if (SOLD_OUT.has(s)) return 'sold_out';
  if (POPULAR.has(s)) return 'popular';
  if (NEW.has(s)) return 'new';
  if (DISCOUNT.has(s) || DISCOUNT_RE.test(s)) return 'discount';
  if (OTHER_LABELS.has(s)) return 'other';
  return null;
}
export const isPopularSection = (heading: string): boolean => POPULAR_SECTIONS.has(label(heading));

const ALLERGENS_RE = /^(?:allergens|allergen info(?:rmation)?|allergy info(?:rmation)?|contains allergens|אלרגנים|מידע על אלרגנים|מידע אלרגני|רכיבים אלרגניים)(?:\s*[:：–-]\s*|\s*$)(.*)$/iu;
/**
 * Rule `allergens`: "Allergens: gluten, egg", "אלרגנים: גלוטן, ביצים" (the words after the label, copied as they are), or
 * a bare "Allergens" heading (`text` null: the list is on the next line).
 */
export function readAllergens(line: string): { text: string | null } | null {
  const m = ALLERGENS_RE.exec(line);
  if (!m) return null;
  const rest = m[1]!.trim();
  return { text: rest === '' ? null : rest };
}

// ---------------------------------------------------------------- sections

const KIND_WORDS: ReadonlyArray<readonly [SectionKind, RegExp]> = [
  ['wine', /\bwines?\b|יין|יינות/iu],
  ['beer', /\bbeers?\b|בירה|בירות/iu],
  ['dessert', /dessert|sweets?\b|cakes?\b|קינוח|מתוק|עוג/iu],
  ['drinks', /drink|beverage|cocktail|coffee|juice|soft|\bbar\b|שתי|משק|קוקטייל|קפה|מיצ|אלכוהול/iu],
];
/** The kind of a section by the words of its heading (the owner can change it); "food" when nothing says otherwise. */
export function guessKind(heading: string): SectionKind {
  for (const [k, re] of KIND_WORDS) if (re.test(heading)) return k;
  return 'food';
}

/** Rule `common_section`: headings menus often use (a strong sign that a pasted line opens a section). */
const COMMON_SECTIONS = words(
  'starters', 'appetizers', 'first courses', 'mains', 'main courses', 'main dishes', 'desserts', 'drinks', 'beverages', 'soft drinks', 'hot drinks',
  'cold drinks', 'salads', 'soups', 'pizzas', 'pasta', 'sandwiches', 'burgers', 'sides', 'side dishes', 'extras', 'kids', 'kids menu', 'breakfast',
  'brunch', 'lunch', 'dinner', 'cocktails', 'wines', 'wine', 'beers', 'beer', 'coffee', 'specials', 'menu',
  'ראשונות', 'מנות ראשונות', 'עיקריות', 'מנות עיקריות', 'קינוחים', 'שתייה', 'שתיה', 'משקאות', 'שתייה חמה', 'שתייה קרה', 'סלטים', 'מרקים',
  'פיצות', 'פסטות', 'פסטה', 'כריכים', 'סנדוויצ׳ים', 'המבורגרים', 'תוספות', 'ילדים', 'מנות ילדים', 'ארוחות בוקר', 'ארוחת בוקר', 'בוקר', 'צהריים',
  'ערב', 'קוקטיילים', 'יינות', 'יין', 'בירות', 'בירה', 'קפה', 'מיוחדים', 'ספיישלים', 'תפריט',
);
export const isCommonSection = (line: string): boolean => COMMON_SECTIONS.has(label(line));
