// Mana placeholder ("stock") pictures: find the one that fits a menu item by its words.
// Plain ES module, no dependencies, the same file for the owner app and for tests (node --test tools/match.test.mjs).
//
//   const manifest = await (await fetch(stockBase + 'stock.json')).json();
//   matchStock(manifest, { name_he: 'פיצה מרגריטה', name_en: '', category_he: 'פיצות', category_en: '' })  → 'pizza' | null
//   searchStock(manifest, 'piz')  → [{ id, score }]   (for the picker's search box; an empty query lists everything)
//
// Matching is deliberately cautious: a wrong picture is worse than a name card. An item gets a picture only when one of
// an entry's keys appears in the item's NAME, or (for entries marked "cat": true) in the name of its category.
//
// How a name is read (v2, 7 Oct 2026):
//  · Only the dish itself counts, not what comes with it: words after "with / עם / על / + / (" and words joined on with
//    ו ("and") never choose the picture. "Burger with side salad" is a burger; "פילה ביין אדום" is not a glass of wine.
//  · Hebrew names put the dish first ("סלט פסטה" is a salad), English names put it last ("pasta salad" is a salad too).
//    The Hebrew name decides when both are given.
//  · A key written with a leading ^ ("^קפה", "^wine") counts only when it leads the name (after words like כוס, חצי,
//    glass, house). Used for short words that mean something else inside other dishes.
//  · A category that names several things ("פיצה, פסטה ועוד", "Coffee & pastry") gives no picture by itself.
//  · A name whose dish is something the library has no picture of (ריזוטו, קרפצ׳יו, בוריטו, pie, wrap, rolls…) gets none,
//    whatever else it mentions: "ריזוטו פירות ים" is not a plate of shrimp.
//  · An entry may carry "not": ["כרובית", …]: words that rule it out ("סטייק כרובית" is not a steak).

const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

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

const words = (list) => new Set(list.map((w) => normalize(w)));
const isHebrew = (w) => { const c = w.codePointAt(0); return c >= 0x05d0 && c <= 0x05ea; };
// what follows these belongs beside the dish, not to it
const BESIDE = words(['עם', 'על', 'ליד', 'לצד', 'בתוספת', 'בליווי', 'מוגש', 'מוגשת', 'מוגשים', 'כולל', 'ברוטב', 'בציפוי', 'במילוי', 'ממולא', 'ממולאת', 'ממולאים',
  'with', 'w', 'served', 'topped', 'on', 'in', 'over', 'and', 'plus', 'incl', 'including', 'stuffed', 'filled', 'next', 'beside', 'besides', 'alongside']);
// dishes the library has no picture of: when one of these is what the name is about, nothing else in the name may choose a picture
const OTHER = words(['ריזוטו', 'בוריטו', 'קסדייה', 'טורטייה', 'ראפ', 'קרפצ׳יו', 'טרטר', 'סביצ׳ה', 'סשימי', 'פוקצ׳ה', 'קיש', 'פשטידה', 'פאייה', 'קוסקוס',
  'מג׳דרה', 'ממולאים', 'קובה', 'ג׳חנון', 'מלוואח', 'סביח', 'לחם', 'רוטב', 'ליקר', 'ריבה', 'מוס', 'פאי', 'טארט', 'אגרול', 'באן', 'באו',
  'burrito', 'quesadilla', 'tortilla', 'wrap', 'wraps', 'carpaccio', 'tartare', 'tartar', 'ceviche', 'sashimi', 'focaccia', 'quiche', 'paella', 'couscous',
  'risotto', 'pie', 'tart', 'tarte', 'roll', 'rolls', 'bread', 'bun', 'buns', 'sauce', 'dressing', 'liqueur', 'jam', 'syrup', 'mousse', 'stew', 'bao', 'nachos', 'dip']);
// words that may follow the dish in an English name without being it
const TAIL = words(['plate', 'platter', 'bowl', 'cup', 'glass', 'bottle', 'pitcher', 'small', 'large', 'medium', 'big', 'classic', 'special', 'deluxe', 'royal', 'vegan', 'vegetarian',
  'kids', 'portion', 'slice', 'piece', 'pieces', 'pcs', 'ml', 'cl', 'l', 'g', 'gr', 'kg', 'oz', 'draught', 'draft']);
// words that may stand before the dish without being it
const LEAD = words(['כוס', 'כוסית', 'בקבוק', 'קנקן', 'חצי', 'רבע', 'שליש', 'מנת', 'מנה', 'צלחת', 'קערת', 'מגש', 'זוג', 'מיני', 'קטן', 'גדול', 'חם', 'קר',
  'glass', 'cup', 'bottle', 'pitcher', 'pot', 'half', 'small', 'large', 'medium', 'mini', 'double', 'single', 'hot', 'fresh', 'house', 'a', 'the', 'our']);

/** How token `tok` stands for key word `kw`: 0 not at all · 1 itself (a plural or construct ending, or ה in front) ·
    2 with ב ל מ כ ש in front ("in the…", "from the…") · 3 with ו in front ("and…"). */
function tokenIs(tok, kw, depth = 0) {
  if (tok === kw) return 1;
  if (kw.length < 3) return 0;
  const rest = tok.startsWith(kw) ? tok.slice(kw.length) : null;
  if (!isHebrew(kw)) return rest === 's' || rest === 'es' ? 1 : 0;
  if (rest !== null && /^(ימ|ות|ה|י|ונ|ית)$/.test(rest)) return 1;
  if (kw.endsWith('ה') && (tok === kw.slice(0, -1) + 'ות' || tok === kw.slice(0, -1) + 'ת')) return 1;         // פיצה → פיצות, עוגה → עוגת
  if (depth < 2 && tok.length > kw.length && 'הובלמשכ'.includes(tok[0])) {
    const inner = tokenIs(tok.slice(1), kw, depth + 1);
    if (inner) return Math.max(inner, tok[0] === 'ה' ? 1 : tok[0] === 'ו' ? 3 : 2);
  }
  return 0;
}

/** Every place the key phrase stands in the token list: [{ at, how }] (how as in tokenIs, taken from its first word). */
function findKey(tokens, keyTokens) {
  const out = [];
  outer: for (let i = 0; i + keyTokens.length <= tokens.length; i++) {
    const how = tokenIs(tokens[i], keyTokens[0]);
    if (!how) continue;
    for (let j = 1; j < keyTokens.length; j++) if (!tokenIs(tokens[i + j], keyTokens[j])) continue outer;
    out.push({ at: i, how });
  }
  return out;
}

const cache = new WeakMap();
function prepared(manifest) {
  let p = cache.get(manifest);
  if (!p) {
    p = (manifest?.items || []).filter((e) => e && e.id).map((e) => ({
      id: e.id, cat: !!e.cat, hidden: !!e.hidden, group: e.group || '',
      keys: (e.keys || []).map((k) => ({ lead: typeof k === 'string' && k.trim().startsWith('^'), text: normalize(k) })).filter((k) => k.text)
        .map((k) => ({ ...k, tokens: k.text.split(' '), len: k.text.replace(/ /g, '').length, he: isHebrew(k.text) })),
      not: (e.not || []).map((k) => normalize(k)).filter(Boolean).map((k) => k.split(' ')),
      names: [normalize(e.name?.he), normalize(e.name?.en)].filter(Boolean),
    }));
    cache.set(manifest, p);
  }
  return p;
}

/** The part of a name that is the dish: before "+", "(", " - " and the like. */
function mainPart(raw) {
  if (typeof raw !== 'string') return '';
  const cut = raw.split(/[+(\[|•]|\s[-–—]\s/).find((s) => normalize(s));
  return cut === undefined ? raw : cut;
}

/** Every key of one language that stands in these words, with where and how. */
function candidates(entries, tokens, he) {
  const out = [];
  if (!tokens.length) return out;
  let beside = tokens.findIndex((t) => BESIDE.has(t)); if (beside < 0) beside = tokens.length;      // a name or category that opens with "with" / "ליד" names nothing itself
  let lead = 0; while (lead < tokens.length - 1 && (LEAD.has(tokens[lead]) || /^\d+$/.test(tokens[lead]))) lead++;
  for (const e of entries) {
    if (e.hidden) continue;
    for (const k of e.keys) {
      if (k.he !== he) continue;
      for (const m of findKey(tokens, k.tokens)) {
        if (m.at >= beside) continue;                       // it comes after "with": a side, not the dish
        if (k.lead && m.at > lead) continue;                // a ^key that does not lead the name
        if (m.how === 3 && m.at > 0) continue;              // "…and X"
        out.push({ id: e.id, key: k.text, at: m.at, end: m.at + k.tokens.length, len: k.len, n: k.tokens.length, how: m.how });
      }
    }
  }
  return out;
}
const longer = (a, b) => b.len - a.len || b.n - a.n;
const heFirst = (a, b) => a.at - b.at || longer(a, b);       // Hebrew: the dish is named first
const enLast = (a, b) => b.end - a.end || longer(a, b);      // English: the dish is named last

/** What one name field says: { sure, weak, other }. Hebrew words are read first, then English ones (a field may hold either). */
function readName(entries, raw) {
  const tokens = normalize(mainPart(raw)).split(' ').filter(Boolean);
  if (!tokens.length) return { sure: null, weak: null };
  let lead = 0; while (lead < tokens.length - 1 && (LEAD.has(tokens[lead]) || /^\d+$/.test(tokens[lead]))) lead++;
  const he = candidates(entries, tokens, true);
  const own = he.filter((x) => x.how === 1 || x.at === 0).sort(heFirst)[0] || null;
  // Hebrew names the dish first. When that first word is a dish we have no picture of, only a key that starts there may speak.
  if (isHebrew(tokens[lead]) && OTHER.has(tokens[lead])) return own && own.at <= lead ? { sure: own, weak: null } : { sure: null, weak: null, other: true };
  if (own) return { sure: own, weak: null };
  const weak = he.sort(heFirst)[0] || null;                  // "ירקות בקארי": only if nothing names the dish outright
  const of = tokens.indexOf('of');                           // "glass of wine", "soup of the day": what follows "of" first, then what precedes it
  const parts = of > 0 ? [tokens.slice(of + 1), tokens.slice(0, of)] : [tokens];
  for (const part of parts) {
    const c = candidates(entries, part, false).sort(enLast)[0];
    let beside = part.findIndex((t) => BESIDE.has(t)); if (beside < 0) beside = part.length;
    let last = Math.max(0, beside - 1); while (last > 0 && (TAIL.has(part[last]) || /^\d+$/.test(part[last]))) last--;
    // English names the dish last. When that last word is a dish we have no picture of, only a key that reaches it may speak.
    if (!isHebrew(part[last]) && OTHER.has(part[last]) && !(c && c.end > last)) return { sure: null, weak, other: !weak };
    if (c) return { sure: c, weak };
  }
  return { sure: null, weak };
}

/** A category that lists several things cannot speak for each item in it. */
function mixed(raw) {
  if (/[&+,/|]/.test(raw)) return true;
  const t = normalize(raw).split(' ');
  return t.includes('and') || t.some((w, i) => i > 0 && w.length > 2 && w[0] === 'ו' && isHebrew(w));
}
function readCategory(entries, raw) {
  if (typeof raw !== 'string' || mixed(raw)) return null;
  const tokens = normalize(raw).split(' ').filter(Boolean);
  const all = candidates(entries, tokens, true).concat(candidates(entries, tokens, false));
  return all.filter((x) => x.how === 1).sort(longer)[0] || null;
}

/** The best entry for an item with how sure we are; null when nothing fits. */
export function explainStock(manifest, item) {
  const all = prepared(manifest);
  const said = (normalize(item?.name_he) + ' ' + normalize(item?.name_en)).split(' ').filter(Boolean);
  const entries = all.filter((e) => !e.not.some((n) => findKey(said, n).length));           // entries the name itself rules out
  const he = readName(entries, item?.name_he), en = readName(entries, item?.name_en);
  const hit = he.sure || en.sure, weak = hit ? null : he.weak || en.weak;
  if (hit || weak) { const x = hit || weak; return { id: x.id, score: (hit ? 100 : 60) + x.len * 4 + x.n * 6, via: 'name', key: x.key }; }
  if (he.other || en.other) return null;                   // the name is about something else: its category cannot know better
  const cats = entries.filter((e) => e.cat);
  const cat = readCategory(cats, item?.category_he) || readCategory(cats, item?.category_en);
  return cat ? { id: cat.id, score: 20 + cat.len, via: 'category', key: cat.key } : null;
}

/** The id of the placeholder picture that fits this item, or null. */
export function matchStock(manifest, item) {
  const b = explainStock(manifest, item);
  return b ? b.id : null;
}

/** For the picker: entries that fit the typed words, best first. An empty query returns every visible entry in manifest order. */
export function searchStock(manifest, query, limit = 200) {
  const q = normalize(query).split(' ').filter(Boolean);
  const all = prepared(manifest).filter((e) => !e.hidden);
  if (!q.length) return all.slice(0, limit).map((e) => ({ id: e.id, score: 0 }));
  const out = [];
  for (const e of all) {
    const own = new Set(), other = new Set();              // the entry's own name counts for more than its match words
    for (const n of e.names) for (const t of n.split(' ')) own.add(t);
    for (const k of e.keys) for (const t of k.tokens) if (!own.has(t)) other.add(t);
    for (const t of normalize(e.group).split(' ')) if (t && !own.has(t)) other.add(t);
    let score = 0;
    for (const w of q) {
      let s = 0;
      const look = (set, bonus) => { for (const t of set) {
        if (t === w) s = Math.max(s, 10 + bonus);
        else if (t.startsWith(w)) s = Math.max(s, 6 + bonus);
        else if (w.length >= 3 && (tokenIs(w, t) || t.includes(w))) s = Math.max(s, 3 + bonus);
      } };
      look(own, 2); look(other, 0);
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
