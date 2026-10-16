/**
 * Prices as menus and Wolt pages write them, read into agorot (integers, VAT included) without floating point:
 * "₪42.00", "42.00 ₪", "42 ₪", "₪ 42", '42 ש"ח', "1,250", "62,50"; options "+₪5.00"; "from ₪42"; "₪42–58"; two prices
 * side by side (a discount). Nothing is converted: a price in another currency is not a price Mana can read.
 */
import { LIMITS, PRICE_TEXT_MAX } from '@mana/contracts';

/** The shekel as menus write it: the sign, ש"ח with any quote mark, NIS, ILS. */
const SHEKEL = String.raw`(?:₪|ש["״”']{1,2}ח|NIS|ILS)`;
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const MONEY = String.raw`(?:${SHEKEL} ?(?:${NUM})|(?:${NUM}) ?${SHEKEL})`;
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
  shekelish: new RegExp(`^\\+? ?(?:${SHEKEL} ?\\S{1,12}|\\S{1,12} ?${SHEKEL})$`, 'iu'),
  free: /^(?:free|no charge|חינם|ללא תשלום|ללא תוספת תשלום|ללא עלות|\+ ?0)$/iu,
  trailingMoney: new RegExp(`^(.*?\\S)(?: ?[.·…_–—-]{2,} ?| |(?=₪))(\\+ ?)?(${MONEY})$`, 'iu'),
  trailingBare: new RegExp(`^(.*?\\S)(?: ?[.·…_–—-]{2,} ?| )((?:${NUM})(?: ?\\/ ?(?:${NUM}))*)(?: ?${SHEKEL})?$`, 'iu'),
  leadingMoney: new RegExp(`^(${MONEY}) (.*\\S)$`, 'iu'),
  // a digit, or a letter a digit is often misread as, must be there: "₪₪" is a price level, not a price
  trailingShekelish: new RegExp(`^(.*?\\S) ((?:${SHEKEL} ?(?=\\S*[\\dOoIl])\\S{1,8}|(?=\\S*[\\dOoIl])\\S{1,8} ?${SHEKEL}))$`, 'iu'),
  digits: /\d[\d.,]*/u,
  shekel: new RegExp(SHEKEL, 'iu'),
};

/** A number as written ("62", "62.5", "62,50", "1,250", "1,250.50") → agorot; null when it is not one. */
export function amount(s: string): number | null {
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
  const one = (token: string): number | null => (RE.money.test(token) || (bare && RE.bare.test(token)) ? moneyAmount(token) : null);
  if (RE.money.test(s) || (bare && RE.bare.test(s))) {
    const a = moneyAmount(s);
    return a === null ? unreadable(s) : { kind: 'one', agorot: a };
  }
  const pair = RE.pair.exec(s);
  if (pair) {
    const a = one(pair[1]!), b = one(pair[2]!);
    return a === null || b === null ? unreadable(s) : { kind: 'discount', agorot: Math.max(a, b) };
  }
  for (const re of [RE.from, RE.range, RE.several]) {
    const m = re.exec(s);
    if (!m) continue;
    // without a currency anywhere, "12-14" is not a price where prices always show one
    if (!bare && !RE.shekel.test(s)) return null;
    const a = moneyAmount(m[1]!);
    return a === null ? unreadable(s) : { kind: 'several', agorot: a, note: s };
  }
  if (RE.shekelish.test(s)) return unreadable(s);
  return null;
}

/** An option's price: "+₪5.00", "+5 ₪", "₪5.00+", "+5"; "Free" is 0. null: not an option price. */
export function readOptionPrice(line: string): { readonly agorot: number | null; readonly text: string } | null {
  const s = line.trim();
  if (RE.free.test(s)) return { agorot: 0, text: s };
  const m = RE.option.exec(s);
  if (m) {
    const a = moneyAmount(m[1] ?? m[2]!);
    return { agorot: a, text: s.slice(0, PRICE_TEXT_MAX) };
  }
  if (/^\+/u.test(s) && RE.shekelish.test(s)) return { agorot: null, text: s.slice(0, PRICE_TEXT_MAX) };
  return null;
}

/**
 * A name and its price on one line: "Schnitzel 64", "Schnitzel ₪64.00", "Schnitzel …… 64", "Wine 38 / 140",
 * "₪64 Schnitzel" (a right-to-left copy). `bare`: a number without a currency counts. `option`: the price had a "+".
 */
export function splitPrice(line: string, bare: boolean): { readonly text: string; readonly price: PriceRead; readonly option: boolean } | null {
  const money = RE.trailingMoney.exec(line);
  if (money) {
    const price = readPrice(money[3]!, false);
    if (price) return { text: trimLeaders(money[1]!), price, option: money[2] !== undefined };
  }
  if (bare) {
    const m = RE.trailingBare.exec(line);
    if (m && !/^\d+$/u.test(m[1]!)) {
      const price = readPrice(m[2]!, true);
      if (price) return { text: trimLeaders(m[1]!), price, option: false };
    }
  }
  const lead = RE.leadingMoney.exec(line);
  if (lead && !RE.digits.test(lead[2]!.slice(0, 1))) {
    const price = readPrice(lead[1]!, false);
    if (price) return { text: lead[2]!, price, option: false };
  }
  // "Kids burger ₪ 4O": a shekel price Mana cannot read, after the name
  const odd = RE.trailingShekelish.exec(line);
  if (odd) {
    const price = readPrice(odd[2]!, false);
    if (price?.kind === 'unreadable') return { text: trimLeaders(odd[1]!), price, option: false };
  }
  return null;
}

/** Does the line hold a shekel price anywhere (a fee line, a button with a total)? */
const trimLeaders = (s: string): string => s.replace(/[ .·…_–—-]+$/u, '');

export const hasMoney = (line: string): boolean => new RegExp(MONEY, 'iu').test(line);

function unreadable(s: string): PriceRead {
  return { kind: 'unreadable', text: s.slice(0, PRICE_TEXT_MAX) };
}
