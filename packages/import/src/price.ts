/**
 * Prices as menus and Wolt pages write them, read into agorot (integers, VAT included) without floating point:
 * "₪42.00", "42.00 ₪", "42 ₪", "₪ 42", '42 ש"ח', "1,250", "62,50"; options "+₪5.00"; "from ₪42"; "₪42–58"; two prices
 * side by side (a discount). Nothing is converted: a price in another currency is not a price Mana can read.
 *
 * A price is short: every rule here looks at most at `PRICE_MAX` characters (a whole line that is longer is not a
 * price; on a name's line only its last `PRICE_MAX` characters are tried), so no pattern runs over a long line.
 */
import { LIMITS, PRICE_TEXT_MAX } from '@mana/contracts';

/** The longest text read as a price ("from ₪1,250.00 / ₪1,400.00" is 26). */
export const PRICE_MAX = 48;
/** A number shown without a currency is a price only below this (₪10,000, in agorot). */
const BARE_MAX = 1_000_000;

/** The shekel's signs: ₪, and ש"ח (with any quote mark) as a word of its own. */
const SIGN = String.raw`(?:₪|(?<![א-ת])ש["״”']{1,2}ח(?![א-ת]))`;
/** Its codes, NIS and ILS, only as whole words (never the end of "Cocktails", "Lentils" or "Tennis"). */
const CODE = String.raw`(?:(?<!\p{L})(?:NIS|ILS)(?!\p{L}))`;
/** The shekel as menus write it. */
const SHEKEL = String.raw`(?:${SIGN}|${CODE})`;
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{1,7}(?:[.,]\d{1,2})?`;
const MONEY = String.raw`(?:${SHEKEL} ?(?:${NUM})|(?:${NUM}) ?${SHEKEL})`;
/** Something shown as a price Mana cannot read: a sign and up to `n` more characters, or a code beside up to `n`
 * characters one of which is a digit (so a word that only holds the code's letters is never price-like). */
const ODD = (n: number) => String.raw`(?:${SIGN} ?\S{1,${n}}|\S{1,${n}} ?${SIGN}|${CODE} ?(?=\S{0,${n - 1}}\d)\S{1,${n}}|(?=\S{0,${n - 1}}\d)\S{1,${n}} ?${CODE})`;
const FROM = String.raw`(?:from|starting at|starts at|החל מ[-־]?|מ[-־])`;
const DASH = String.raw` ?[–—-] ?`;

const RE = {
  money: new RegExp(`^${MONEY}$`, 'iu'),
  bare: new RegExp(`^(?:${NUM})$`, 'u'),
  option: new RegExp(`^(?:\\+ ?(${MONEY}|${NUM})|(${MONEY}) ?\\+)$`, 'iu'),
  from: new RegExp(`^${FROM} ?(${MONEY}|${NUM})$`, 'iu'),
  range: new RegExp(`^(${MONEY}|${NUM})${DASH}(${MONEY}|${NUM})$`, 'iu'),
  several: new RegExp(`^(${MONEY}|${NUM})(?: ?\\/ ?(?:${MONEY}|${NUM}))+$`, 'iu'),
  pair: new RegExp(`^(${MONEY}) ?(${MONEY})$`, 'iu'),
  /** Looks like a price (a shekel sign and something) but is not one Mana can read: "₪ 4O", "₪--". */
  shekelish: new RegExp(`^\\+? ?${ODD(12)}$`, 'iu'),
  /** The same after a name: a shekel and at most 8 more characters, one of them a digit or a letter often read for one. */
  oddTail: new RegExp(`^${ODD(8)}$`, 'iu'),
  free: /^(?:free|no charge|חינם|ללא תשלום|ללא תוספת תשלום|ללא עלות|\+ ?0)$/iu,
  leading: new RegExp(`^(${MONEY}) (?=\\S)`, 'iu'),
  digits: /\d[\d.,]*/u,
  shekel: new RegExp(SHEKEL, 'iu'),
  /** A shekel beside a digit, anywhere (each try is a few characters long). */
  hasMoney: new RegExp(`${SHEKEL} ?\\d|\\d ?${SHEKEL}`, 'iu'),
};

/** A number as written ("62", "62.5", "62,50", "1,250", "1,250.50") → agorot; null when it is not one. */
export function amount(s: string): number | null {
  if (s.length > 16) return null;
  let whole: string, frac = '';
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/u.test(s)) [whole, frac = ''] = s.replace(/,/g, '').split('.') as [string, string?];
  else if (/^\d+(?:[.,]\d{1,2})?$/u.test(s)) [whole, frac = ''] = s.split(/[.,]/u) as [string, string?];
  else return null;
  whole = whole.replace(/^0+(?=\d)/u, '');
  if (whole.length > 7) return null;
  const agorot = Number(whole) * 100 + Number(`${frac}00`.slice(0, 2));
  return agorot <= LIMITS.price ? agorot : null;
}

/** The amount inside one money token ("₪42.00", "42 ₪", "42"). */
function moneyAmount(token: string): number | null {
  const m = RE.digits.exec(token);
  return m ? amount(m[0].replace(/[.,]$/u, '')) : null;
}

/**
 * Numbers written without a currency read as prices only when they look like menu prices: at most four whole digits,
 * no leading zero, and a range that goes up ("12-14"; never "03-5551234" or "2026-10-16").
 */
function plausibleBare(s: string, range: boolean): boolean {
  const nums = s.match(/\d+(?:[.,]\d{1,2})?/gu) ?? [];
  if (!nums.every((x) => /^[1-9]\d{0,3}(?:[.,]\d{1,2})?$/u.test(x))) return false;
  return !range || (nums.length === 2 && (amount(nums[0]!) ?? 0) < (amount(nums[1]!) ?? 0));
}

export type PriceRead =
  /** One price. */
  | { readonly kind: 'one'; readonly agorot: number }
  /** "from ₪42", "₪42–58", "38 / 140": the first price, and the text to keep as the price note. */
  | { readonly kind: 'several'; readonly agorot: number; readonly note: string }
  /** "₪36.00 ₪42.00": a discount beside the regular price; `agorot` is the higher (regular) one. */
  | { readonly kind: 'discount'; readonly agorot: number }
  /** A price Mana cannot read, as the source showed it (at most `PRICE_TEXT_MAX`). */
  | { readonly kind: 'unreadable'; readonly text: string };

/**
 * A whole line that is a dish's price. `bare`: a number without a currency counts (pasted menus and printed pages
 * leave it out; a Wolt page always shows it, so its reader passes false). null: the line is not a price.
 */
export function readPrice(line: string, bare: boolean): PriceRead | null {
  const s = line.trim();
  if (s.length > PRICE_MAX) return null;
  const one = (token: string): number | null => (RE.money.test(token) || (bare && RE.bare.test(token)) ? moneyAmount(token) : null);
  if (RE.money.test(s)) {
    const a = moneyAmount(s);
    return a === null ? unreadable(s) : { kind: 'one', agorot: a };
  }
  if (bare && RE.bare.test(s)) {
    // without a currency, a number is a price only below ₪10,000 and without a leading zero ("12345", "03" are not)
    const a = moneyAmount(s);
    return a === null || a >= BARE_MAX || /^0\d/u.test(s) ? null : { kind: 'one', agorot: a };
  }
  const pair = RE.pair.exec(s);
  if (pair) {
    const a = one(pair[1]!), b = one(pair[2]!);
    return a === null || b === null ? unreadable(s) : { kind: 'discount', agorot: Math.max(a, b) };
  }
  for (const re of [RE.from, RE.range, RE.several]) {
    const m = re.exec(s);
    if (!m) continue;
    const currency = RE.shekel.test(s);
    // without a currency anywhere, "12-14" is not a price where prices always show one, nor "03-5551234" anywhere
    if (!currency && (!bare || !plausibleBare(s, re === RE.range))) return null;
    const a = moneyAmount(m[1]!);
    return a === null ? unreadable(s) : { kind: 'several', agorot: a, note: s };
  }
  if (RE.shekelish.test(s)) return unreadable(s);
  return null;
}

/** An option's price: "+₪5.00", "+5 ₪", "₪5.00+", "+5"; "Free" is 0. null: not an option price. */
export function readOptionPrice(line: string): { readonly agorot: number | null; readonly text: string } | null {
  const s = line.trim();
  if (s.length > PRICE_MAX) return null;
  if (RE.free.test(s)) return { agorot: 0, text: s };
  const m = RE.option.exec(s);
  if (m) {
    const a = moneyAmount(m[1] ?? m[2]!);
    return { agorot: a, text: s.slice(0, PRICE_TEXT_MAX) };
  }
  if (s.startsWith('+') && RE.shekelish.test(s)) return { agorot: null, text: s.slice(0, PRICE_TEXT_MAX) };
  return null;
}

/** The characters menus put between a name and its price ("Schnitzel …… 64"). */
const LEADERS = new Set([' ', '.', '·', '…', '_', '–', '—', '-']);
const LEADER_MARKS = new Set(['.', '·', '…', '_', '–', '—', '-']);

/** A name without the spaces and leaders at its end. */
export function trimLeaders(s: string): string {
  let e = s.length;
  while (e > 0 && LEADERS.has(s[e - 1]!)) e--;
  return s.slice(0, e);
}

export type SplitPrice = {
  readonly text: string;
  readonly price: PriceRead;
  /** The price had a "+" (an option's). */
  readonly option: boolean;
  /** The price showed no currency (only a pasted or printed menu reads such a price): the reader may doubt it. */
  readonly bare: boolean;
  /** The price as written. */
  readonly token: string;
};

/**
 * A name and its price on one line: "Schnitzel 64", "Schnitzel ₪64.00", "Schnitzel₪64.00", "Schnitzel …… 64",
 * "Wine 38 / 140", "Funghi ₪46–62", "Calzone from 50", "₪64 Schnitzel" (a right-to-left copy), "Kids burger ₪ 4O"
 * (a shekel price Mana cannot read). The price is the longest end of the line that reads as one, after a space, a
 * run of two leaders or (for "₪…") nothing; `bare`: a number without a currency counts. null: no price on the line.
 */
export function splitPrice(line: string, bare: boolean): SplitPrice | null {
  const n = line.length;
  for (let p = Math.max(1, n - PRICE_MAX); p < n; p++) {
    const c = line[p]!, before = line[p - 1]!;
    if (LEADERS.has(c)) continue;
    if (before !== ' ') {
      if (LEADER_MARKS.has(before)) { if (!(p >= 2 && LEADER_MARKS.has(line[p - 2]!))) continue; }
      else if (c !== '₪') continue;
    }
    const text = trimLeaders(line.slice(0, p));
    if (text === '') continue;
    const tail = line.slice(p);
    const currency = RE.shekel.test(tail);
    if (c === '+') {
      const o = readOptionPrice(tail);
      if (o && (currency || bare)) {
        return { text, price: o.agorot === null ? unreadable(tail) : { kind: 'one', agorot: o.agorot }, option: true, bare: !currency, token: tail };
      }
      continue;
    }
    const price = readPrice(tail, bare);
    if (!price) continue;
    if (price.kind === 'unreadable') {
      // a shekel price Mana cannot read: only a short one with a digit (or a letter often misread for one) in it
      if (RE.oddTail.test(tail) && /[\dOoIl]/u.test(tail.replace(RE.shekel, ''))) return { text, price, option: false, bare: false, token: tail };
      continue;
    }
    if (!currency && (!bare || /^\d+$/u.test(text))) continue;
    return { text, price, option: false, bare: !currency, token: tail };
  }
  // "₪64 Schnitzel": the price first, as a right-to-left copy can put it
  const lead = RE.leading.exec(line.slice(0, PRICE_MAX + 1));
  if (lead) {
    const text = line.slice(lead[0].length).trim();
    const price = readPrice(lead[1]!, false);
    if (text !== '' && !RE.digits.test(text.slice(0, 1)) && price) return { text, price, option: false, bare: false, token: lead[1]! };
  }
  return null;
}

/** Does the line hold a shekel price anywhere (a fee line, a button with a total)? */
export const hasMoney = (line: string): boolean => RE.hasMoney.test(line);

function unreadable(s: string): PriceRead {
  return { kind: 'unreadable', text: s.slice(0, PRICE_TEXT_MAX) };
}
