// The menu address (halom.io/m/<slug>): suggested from the English name, or from a rough transliteration of the Hebrew one.
const HE: Record<string, string> = { 'א': 'a', 'ב': 'b', 'ג': 'g', 'ד': 'd', 'ה': 'h', 'ו': 'o', 'ז': 'z', 'ח': 'h', 'ט': 't', 'י': 'i', 'כ': 'k', 'ך': 'k', 'ל': 'l', 'מ': 'm', 'ם': 'm',
  'נ': 'n', 'ן': 'n', 'ס': 's', 'ע': 'a', 'פ': 'p', 'ף': 'f', 'צ': 'ts', 'ץ': 'ts', 'ק': 'k', 'ר': 'r', 'ש': 'sh', 'ת': 't' };
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function transliterate(he: string): string {
  return Array.from(he.normalize('NFKD').replace(/[֑-ׇ]/g, '')).map((ch, i, all) => {
    if (ch === 'ה' && (i === all.length - 1 || /[\s-]/.test(all[i + 1]))) return 'a';     // a final ה reads as "a": פסטה → pasta
    return HE[ch] !== undefined ? HE[ch] : ch;
  }).join('');
}

/** Any text → something that fits the slug rule, or '' when nothing usable is left. */
export function slugify(text: string): string {
  let s = transliterate(String(text || '')).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  s = s.replace(/&/g, ' and ').replace(/['’`"״׳]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return s;
}

export function suggestSlug(nameEn: string, nameHe: string): string {
  let s = slugify(nameEn) || slugify(nameHe);
  if (s.length === 1) s += '-menu';
  if (s.length === 2) s += '-il';
  return s;
}

/** Why a typed address cannot be used ('' = looks fine; the database still has the last word). */
export function slugProblem(s: string): '' | 'short' | 'long' | 'chars' | 'edges' {
  if (s.length < 3) return 'short';
  if (s.length > 40) return 'long';
  if (!/^[a-z0-9-]+$/.test(s)) return 'chars';
  if (!SLUG_RE.test(s)) return 'edges';
  return '';
}
