/** Lines and words as the text readers see them: cleaned, in a script, with a shape (heading, description). */
import { IMPORT_TEXT_MAX, isStorableText, stripBlank, type Lang, type Text } from '@mana/contracts';

/** Direction marks, zero-width spaces, the word joiner, the BOM and the soft hyphen: they draw nothing, so they go. */
const INVISIBLE = /[\u00AD\u061C\u180E\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/gu;
/** Tabs and every Unicode space become one plain space. */
const SPACES = /[\t\v\f\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]+/gu;
const LINE_BREAK = /\r\n|[\n\r\u0085\u2028\u2029]/u;

/** Text the database can store (`isStorableText`): NUL characters and lone surrogates (half an emoji) removed. */
export function storable(s: string): string {
  if (isStorableText(s)) return s;
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0 || (c >= 0xdc00 && c <= 0xdfff)) continue;
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) { out += s.slice(i, i + 2); i += 1; }
      continue;
    }
    out += s[i]!;
  }
  return out;
}

/** One line of source text, cleaned: storable, no invisible characters, single spaces, no blank edges. */
export function cleanLine(raw: string): string {
  return stripBlank(storable(raw).replace(INVISIBLE, '').replace(SPACES, ' ').replace(/ {2,}/g, ' '));
}

export type SourceLine = { readonly n: number; readonly text: string };

/**
 * The input's lines (1-based numbers), cleaned, blank ones kept as ''. Reads at most `IMPORT_TEXT_MAX` characters
 * (what `create_import` accepts); `truncated` says the rest was left.
 */
export function sourceLines(text: string): { lines: SourceLine[]; truncated: boolean } {
  const s = typeof text === 'string' ? text : '';
  const truncated = s.length > IMPORT_TEXT_MAX;
  const body = truncated ? s.slice(0, s.lastIndexOf('\n', IMPORT_TEXT_MAX) + 1 || IMPORT_TEXT_MAX) : s;
  return { lines: body.split(LINE_BREAK).map((raw, i) => ({ n: i + 1, text: cleanLine(raw) })), truncated };
}

const HEBREW_LETTER = /[א-תװ-ײיִ-ﭏ]/u;
const LATIN_LETTER = /[A-Za-zÀ-ɏ]/u;
const STRONG = /[א-תװ-ײיִ-ﭏA-Za-zÀ-ɏ]/u;

/** The language of a text by its first letter (Hebrew → he, Latin → en), as `dir="auto"` decides; null when none. */
export function scriptOf(s: string): Lang | null {
  const m = STRONG.exec(s);
  if (!m) return null;
  return HEBREW_LETTER.test(m[0]) ? 'he' : 'en';
}

/** The input's main language: the script with more letters (Hebrew on a tie, Mana's first language). */
export function mainLang(texts: readonly string[]): Lang {
  let he = 0, en = 0;
  for (const t of texts) for (const ch of t) { if (HEBREW_LETTER.test(ch)) he++; else if (LATIN_LETTER.test(ch)) en++; }
  return en > he ? 'en' : 'he';
}

export const NO_TEXT: Text = { he: '', en: '' };

/** A text placed in the language of its script (`fallback` when it has no letters). */
export function inScript(s: string, fallback: Lang): Text {
  return (scriptOf(s) ?? fallback) === 'he' ? { he: s, en: '' } : { he: '', en: s };
}

/**
 * A name given in both languages on one line: "שניצל / Schnitzel" (either order), when one side is written only in
 * Hebrew letters and the other only in Latin ones. Otherwise the whole line in the language of its script.
 */
export function bilingual(s: string, fallback: Lang): Text {
  const parts = s.split(/\s+\/\s+/u);
  if (parts.length === 2) {
    const [a, b] = parts as [string, string];
    const sa = onlyScript(a), sb = onlyScript(b);
    if (sa && sb && sa !== sb) return sa === 'he' ? { he: a, en: b } : { he: b, en: a };
  }
  return inScript(s, fallback);
}

function onlyScript(s: string): Lang | null {
  const he = HEBREW_LETTER.test(s), en = LATIN_LETTER.test(s);
  return he && !en ? 'he' : en && !he ? 'en' : null;
}

/** Adds a text to one language of a bilingual text (joined with a space when there is one already). */
export function append(t: Text, lang: Lang, s: string): Text {
  const now = t[lang];
  return { ...t, [lang]: now ? `${now} ${s}` : s };
}

/**
 * A text cut to at most `max` UTF-16 units and so at most `max` code points (whichever way the contracts count),
 * never inside a surrogate pair, with no blank end.
 */
export function clip(s: string, max: number): { text: string; clipped: boolean } {
  if (s.length <= max) return { text: s, clipped: false };
  let out = '';
  for (const ch of s) { if (out.length + ch.length > max) break; out += ch; }
  return { text: stripBlank(out), clipped: true };
}

const wordCount = (s: string): number => s.split(' ').filter((w) => w !== '').length;

/**
 * Rule `heading_shape`: a line that reads like a section heading: at most 5 words and 40 characters, with no sentence
 * punctuation inside it (a final "!" or "." is allowed).
 */
export function headingShaped(s: string): boolean {
  return wordCount(s) <= 5 && s.length <= 40 && !/[,;:.!?…]/u.test(s.replace(/[.!]$/u, ''));
}

/** Words that open a description, not a name: "with tahini", "served with", "עם טחינה", "מוגש עם". */
const DESC_START = /^(?:with|served|topped|comes with|עם|מוגש|מוגשת|מוגשים|בתוספת|ברוטב|לצד)\s/iu;

/**
 * Rule `desc_shape`: a line that reads like a description: 4 words or more, or a comma, semicolon, colon or full stop
 * inside it, or an ellipsis at its end (a description cut short in a list), or 40 characters or more, or it opens
 * with a word like "with" / "עם".
 */
export function descShaped(s: string): boolean {
  return wordCount(s) >= 4 || /[,;:،]|\.(?!\d)/u.test(s.replace(/[.!]$/u, '')) || /(…|\.\.\.)$/u.test(s) || s.length >= 40 || DESC_START.test(s);
}

/** Lowercase A–Z only (as the contracts' keys do); Hebrew has no case. */
export const lower = (s: string): string => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
