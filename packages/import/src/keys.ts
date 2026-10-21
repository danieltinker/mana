/**
 * Node keys that depend only on what a node is (its names, and for a group its whole content), never on when it was
 * read: the same text read again, or the same menu merged from overlapping inputs, gets the same keys, so an owner's
 * answers (`<code>@<key>`) still point at the same nodes. A key is `<kind>-<english words>-<hash>`, e.g.
 * `d-schnitzel-1f3a9c02`, or `<kind>-<hash>` for a name with no Latin letters.
 */
import { DRAFT_KEY_RE, importKey } from '@mana/contracts';

/** FNV-1a, 32 bits, over UTF-16 units: 8 lowercase hex digits. Not for security; for short stable names. */
export function hash8(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The English words of a name as a key fragment: at most 24 characters of a–z, 0–9 and "-". */
export function slug(en: string): string {
  const words = importKey(en).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (words.length <= 24) return words;
  const cut = words.slice(0, 25);
  const end = cut.lastIndexOf('-');
  return (end > 0 ? cut.slice(0, end) : words.slice(0, 24)).replace(/-+$/g, '');
}

/** Hands out keys, unique within one draft (a second node with the same seed, or a hash collision, gets "-2", "-3"…). */
export class KeyMaker {
  private readonly used = new Set<string>();

  make(kind: 's' | 'd' | 'g' | 'o', en: string, seed: string): string {
    const words = slug(en);
    const base = `${kind}-${words ? `${words}-` : ''}${hash8(`${kind}|${seed}`)}`;
    let key = base;
    for (let n = 2; this.used.has(key); n++) key = `${base}-${n}`;
    if (!DRAFT_KEY_RE.test(key)) throw new Error(`key_invalid: ${key}`);
    this.used.add(key);
    return key;
  }
}
