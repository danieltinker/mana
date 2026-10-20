/* The name guard's reader and matcher, without its tests, so other suites can check their own files with it (the
   simulator's seeds: sim/test/seeds.test.mjs). tools/check-names.mjs is the guard; its header says how text is read
   and what matches.

   The names are never in the repository, not even as hashes: they are read from a file outside git,
   MANA_FORBIDDEN_NAMES_FILE if it is set, else private/forbidden-names.txt (git-ignored). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where the list is: MANA_FORBIDDEN_NAMES_FILE, else private/forbidden-names.txt. */
export const listFile = (env = process.env) => env.MANA_FORBIDDEN_NAMES_FILE || path.join(ROOT, 'private/forbidden-names.txt');

/** The list: { file, named (MANA_FORBIDDEN_NAMES_FILE is set), names (null when there is no file), problem (a set
    MANA_FORBIDDEN_NAMES_FILE that points at nothing or at an empty list: a check must fail), note (no list here: a
    check says so and checks nothing) }. */
export function readList(env = process.env) {
  const file = listFile(env), named = !!env.MANA_FORBIDDEN_NAMES_FILE, names = fs.existsSync(file) ? parseList(fs.readFileSync(file, 'utf8')) : null;
  return {
    file, named, names: names?.length ? names : null,
    problem: named && !names?.length ? `MANA_FORBIDDEN_NAMES_FILE points at ${names ? 'an empty list' : 'nothing'}: set it to the list, or unset it` : null,
    note: !named && !names?.length ? `no list: nothing checked (private/forbidden-names.txt is ${names ? 'empty' : 'not there'}; the machines that push have it)` : null,
  };
}

const ENTITIES = { nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", shy: '', zwj: '', zwnj: '', lrm: '', rlm: '' };
const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const ESCAPED = { n: ' ', t: ' ', r: ' ' };
const codePoint = (n) => { try { return String.fromCodePoint(n); } catch { return ' '; } };

/** What a reader sees: escapes, %XX and entities decoded, tags and format characters dropped. */
export function decode(s) {
  return s
    .replace(/\\(?:u\{([0-9a-fA-F]{1,6})\}|u([0-9a-fA-F]{4})|([ntr])|([\\"'/]))/g, (m, a, b, c, d) => (a ?? b ? codePoint(parseInt(a ?? b, 16)) : c ? ESCAPED[c] : d))
    .replace(/(?:%[0-9a-fA-F]{2})+/g, (m) => { try { return decodeURIComponent(m); } catch { return m; } })
    .replace(/&(#[xX][0-9a-fA-F]+|#\d+|[A-Za-z][A-Za-z0-9]*);/g, (m, e) => {
      if (e[0] === '#') return codePoint(/^#[xX]/.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      const accented = /^([A-Za-z])(acute|grave|circ|uml|tilde|cedil|ring|slash|caron)$/.exec(e);
      return accented ? accented[1] : ENTITIES[e.toLowerCase()] ?? ' ';
    })
    .replace(/<\/?[A-Za-z][^<>]*>/g, '')
    .replace(/\p{Cf}/gu, '');
}
/** A line's words: decoded, NFKD, accents and points dropped, camel case split, lower case, Hebrew finals folded. */
export const wordsOf = (s) => decode(s).normalize('NFKD').replace(/\p{M}/gu, '')
  .replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2').replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
  .toLowerCase().replace(/[ךםןףץ]/g, (c) => FINALS[c]).match(/\p{L}+/gu) ?? [];

/** The names in a list file's text: [{ words, joined }] (a blank line or a # comment is skipped). */
export function parseList(text) {
  return text.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean).map((l) => wordsOf(l)).filter((w) => w.length)
    .map((words) => ({ words, joined: words.length > 1 ? words.join('') : null }));
}

const plural = (w, of) => w === of || w === of + 's' || w === of + 'es';
/** The lines of `text` that hold a listed name: [{ line, entry }] (the name's place in the list, never the name). */
export function findNames(text, names) {
  const out = [], longest = Math.max(1, ...names.map((n) => n.words.length));
  let recent = [];                                          // the last words read, across lines: { w, line }
  text.split('\n').forEach((s, i) => {
    for (const w of wordsOf(s)) {
      recent.push({ w, line: i + 1 });
      if (recent.length > longest) recent = recent.slice(-longest);
      names.forEach((n, entry) => {
        const k = n.words.length, tail = recent.slice(-k);
        if (tail.length === k && tail.every((x, j) => (j < k - 1 ? x.w === n.words[j] : plural(x.w, n.words[j])))) out.push({ line: tail[0].line, entry });
        else if (n.joined && w.includes(n.joined)) out.push({ line: i + 1, entry });
      });
    }
  });
  return out;
}

/** A path as the guard prints it: a part that holds a listed word (or a name written as one) is masked. */
export function maskPath(p, names) {
  const listed = new Set(names.flatMap((n) => n.words)), joined = names.map((n) => n.joined).filter(Boolean);
  return p.split('/').map((part) => (wordsOf(part).some((w) => listed.has(w) || [...listed].some((l) => plural(w, l)) || joined.some((j) => w.includes(j))) ? '[masked]' : part)).join('/');
}

/** What `text` (a file at `rel`, its path checked too) holds of the list, as a guard prints it: never the name. */
export function findingsIn(rel, text, names) {
  return [
    ...findNames(rel.replace(/\//g, ' / '), names).map((x) => `${maskPath(rel, names)}: its path holds forbidden name #${x.entry + 1}`),
    ...(text === null ? [] : findNames(text, names).map((x) => `${maskPath(rel, names)}:${x.line}: forbidden name #${x.entry + 1}`)),
  ];
}
