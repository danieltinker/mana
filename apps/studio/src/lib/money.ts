// Prices are typed in shekels and stored in agorot (integers). No floating point anywhere on the way.

/** "62", "62.5", "62,50", "1,250", "₪ 48.00", '48 ש"ח' → agorot. '' → null (no price). Anything else → 'invalid'. */
export function parsePrice(input: string): number | null | 'invalid' {
  let s = String(input ?? '').replace(/[‎‏‪-‮⁦-⁩]/g, '').trim();
  if (s === '') return null;
  s = s.replace(/₪|ש"ח|ש״ח|שח|nis|ils/gi, '').trim();
  if (s === '') return 'invalid';
  if (!/^\d[\d.,]*$/.test(s)) return 'invalid';
  let whole = s, frac = '';
  const m = /^(.*)[.,](\d{1,2})$/.exec(s);          // a final separator followed by one or two digits is the decimal point
  if (m) { whole = m[1]; frac = m[2]; }
  if (whole === '') return 'invalid';
  if (/[.,]/.test(whole)) {                          // what is left may only be thousands separators: 1,250 or 1.250,50
    const sep = m ? s[s.length - frac.length - 1] : '';
    const okComma = /^\d{1,3}(,\d{3})+$/.test(whole) && sep !== ',';
    const okDot = /^\d{1,3}(\.\d{3})+$/.test(whole) && sep === ',';      // "12.500" alone is refused: it is more often a typo for 12.50
    if (!okComma && !okDot) return 'invalid';
    whole = whole.replace(/[.,]/g, '');
  }
  whole = whole.replace(/^0+(?=\d)/, '');
  if (whole.length > 7) return 'invalid';            // the database allows up to 1,000,000.00
  const minor = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  return minor <= 100000000 ? minor : 'invalid';
}

/** 6200 → "62", 6250 → "62.50" (plain digits, for inputs and lists). */
export function formatMinor(minor: number | null | undefined): string {
  if (minor == null || !Number.isInteger(minor)) return '';
  const whole = Math.trunc(minor / 100), frac = minor % 100;
  return frac === 0 ? String(whole) : whole + '.' + String(frac).padStart(2, '0');
}

const SYMBOL: Record<string, string> = { ILS: '₪', USD: '$', EUR: '€', GBP: '£' };
export function formatPrice(minor: number | null | undefined, currency = 'ILS'): string {
  const n = formatMinor(minor);
  return n === '' ? '' : (SYMBOL[currency] || '') + n;
}
