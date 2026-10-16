// Mana placeholder ("stock") pictures: find the one that fits a menu item by its words.
// Plain ES module, no dependencies, the same file for the owner app and for tests (node --test tools/match.test.mjs).
//
//   const manifest = await (await fetch(stockBase + 'stock.json')).json();
//   matchStock(manifest, { name_he: 'פיצה מרגריטה', name_en: '', category_he: 'פיצות', category_en: '' })  → 'pizza' | null
//   searchStock(manifest, 'piz')  → [{ id, score }]   (for the picker's search box; an empty query lists everything)
//
// Matching is deliberately cautious: a wrong picture is worse than a name card. An item gets a picture only when one of
// an entry's keys appears in the item's NAME, or (for entries marked "cat": true) in the name of its category.

const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
const HE_PREFIX = 'הובלמשכ';

/** Lower case, no niqqud, no punctuation, Hebrew final letters folded, single spaces. */
export function normalize(s) {
  if (typeof s !== 'string') return '';
  let out = '';
  for (const ch of s.normalize('NFKC').toLowerCase()) {
    const c = ch.codePointAt(0);
    if (c >= 0x0591 && c <= 0x05c7) continue;                                   // niqqud and cantillation
    if (ch === '׳' || ch === '״' || ch === "'" || ch === '’' || ch === '‘' || ch === '`' || ch === '"' || ch === '“' || ch === '”') continue;
    if (FINALS[ch]) { out += FINALS[ch]; continue; }
    if ((c >= 0x05d0 && c <= 0x05ea) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c > 0x00bf && /\p{L}/u.test(ch)) { out += ch; continue; }
    out += ' ';
  }
  return out.replace(/\s+/g, ' ').trim();
}

const isHebrew = (w) => { const c = w.codePointAt(0); return c >= 0x05d0 && c <= 0x05ea; };

/** Does text token `tok` stand for key word `kw`? Exact, a common plural or construct ending, or up to two one-letter Hebrew prefixes. */
function tokenIs(tok, kw, depth = 0) {
  if (tok === kw) return true;
  if (kw.length < 3) return false;
  if (!isHebrew(kw)) {
    const rest = tok.startsWith(kw) ? tok.slice(kw.length) : null;
    return rest === 's' || rest === 'es';
  }
  const rest = tok.startsWith(kw) ? tok.slice(kw.length) : null;
  if (rest !== null && /^(ימ|ות|ה|י|ונ|ית)$/.test(rest)) return true;
  if (kw.endsWith('ה') && (tok === kw.slice(0, -1) + 'ות' || tok === kw.slice(0, -1) + 'ת')) return true;      // פיצה → פיצות, עוגה → עוגת
  if (depth < 2 && tok.length > kw.length && HE_PREFIX.includes(tok[0]) && tokenIs(tok.slice(1), kw, depth + 1)) return true;
  return false;
}

/** Position of the key phrase in the token list, or -1. */
function findKey(tokens, keyTokens) {
  outer: for (let i = 0; i + keyTokens.length <= tokens.length; i++) {
    for (let j = 0; j < keyTokens.length; j++) if (!tokenIs(tokens[i + j], keyTokens[j])) continue outer;
    return i;
  }
  return -1;
}

const cache = new WeakMap();
function prepared(manifest) {
  let p = cache.get(manifest);
  if (!p) {
    p = (manifest?.items || []).filter((e) => e && e.id).map((e) => ({
      id: e.id, cat: !!e.cat, hidden: !!e.hidden, group: e.group || '',
      keys: (e.keys || []).map((k) => normalize(k)).filter(Boolean).map((k) => ({ text: k, tokens: k.split(' '), len: k.replace(/ /g, '').length })),
      names: [normalize(e.name?.he), normalize(e.name?.en)].filter(Boolean),
    }));
    cache.set(manifest, p);
  }
  return p;
}

/** The best entry for an item with how sure we are; null when nothing fits. */
export function explainStock(manifest, item) {
  const name = (normalize(item?.name_he) + ' ' + normalize(item?.name_en)).trim().split(' ').filter(Boolean);
  const cat = (normalize(item?.category_he) + ' ' + normalize(item?.category_en)).trim().split(' ').filter(Boolean);
  let best = null;
  for (const e of prepared(manifest)) {
    if (e.hidden) continue;
    for (const k of e.keys) {
      const at = name.length ? findKey(name, k.tokens) : -1;
      // a key in the name: longer keys are more specific; an earlier position means it is the dish itself, not a side
      let score = at >= 0 ? 100 + k.len * 4 + k.tokens.length * 6 - Math.min(at, 6) * 3 : 0;
      let via = 'name';
      if (!score && e.cat && cat.length && findKey(cat, k.tokens) >= 0) { score = 20 + k.len; via = 'category'; }
      if (score && (!best || score > best.score)) best = { id: e.id, score, via, key: k.text };
    }
  }
  return best;
}

/** The id of the placeholder picture that fits this item, or null. */
export function matchStock(manifest, item) {
  const b = explainStock(manifest, item);
  return b ? b.id : null;
}

/** For the picker: entries that fit the typed words, best first. An empty query returns every visible entry in manifest order. */
export function searchStock(manifest, query, limit = 60) {
  const q = normalize(query).split(' ').filter(Boolean);
  const all = prepared(manifest).filter((e) => !e.hidden);
  if (!q.length) return all.slice(0, limit).map((e) => ({ id: e.id, score: 0 }));
  const out = [];
  for (const e of all) {
    const words = new Set();
    for (const k of e.keys) for (const t of k.tokens) words.add(t);
    for (const n of e.names) for (const t of n.split(' ')) words.add(t);
    for (const t of normalize(e.group).split(' ')) if (t) words.add(t);
    let score = 0;
    for (const w of q) {
      let s = 0;
      for (const t of words) {
        if (t === w) s = Math.max(s, 10);
        else if (t.startsWith(w)) s = Math.max(s, 6);
        else if (w.length >= 3 && (tokenIs(w, t) || t.includes(w))) s = Math.max(s, 3);
      }
      if (!s) { score = 0; break; }
      score += s;
    }
    if (score) out.push({ id: e.id, score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** The short list the AI helpers get: [{ id, label }]. */
export function stockLabels(manifest) {
  return (manifest?.items || []).filter((e) => e && e.id && !e.hidden).map((e) => ({ id: e.id, label: [e.name?.en, e.name?.he].filter(Boolean).join(' / ') }));
}

/** What the viewer needs to draw an entry: a relief asset with absolute addresses, or null when the id is unknown. */
export function stockAsset(manifest, id, base) {
  const e = (manifest?.items || []).find((x) => x && x.id === id);
  if (!e) return null;
  const abs = (p) => (p ? new URL(p, base).href : null);
  if (e.draw) return { state: 'drawn', stock: e.id, draw: e.draw, thumb: abs(e.thumb), kind: e.kind || 'stand' };
  return { state: 'relief', stock: e.id, color: abs(e.color), aux: abs(e.aux), thumb: abs(e.thumb), kind: e.kind, e: e.e, h: e.h, o: e.o ?? null, s: e.s ?? null };
}
