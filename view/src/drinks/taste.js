/* What a guest wants to know about a wine or a beer before ordering, as small tags. Pure: no DOM.

   Only what the merchant said. A tag is either a FIELD (the merchant filled it in: details.wine.color, .notes, .taste,
   details.beer.style, .abv, .taste) or SUGGESTED (read from the merchant's own words: the description, the free-text notes,
   the style). Suggested tags are marked as such wherever they are shown, and nothing is ever guessed beyond the words:
   no word, no tag.

   tasteOf(item, kind) → null | {
     kind: 'wine' | 'beer',
     style:  { id, src }                         wine: red | white | rose | orange | sparkling · beer: lager | wheat | pale | ipa | amber | stout | sour
     scales: [{ id, v, of, src }]                wine: sweet (0 dry … 3 sweet), body (1 light … 3 full), acid (1 soft … 3 crisp) · beer: bitter (1 … 3)
     notes:  [{ id, src }]                       wine: mineral citrus redfruit stonefruit floral oak spice earthy · beer: citrus malt roast hop sour fruit spice
     abv:    { text, src } | null                as the merchant wrote it ("4.8%")
   }   src = 'field' | 'words' */

export const WINE_STYLES = ['red', 'white', 'rose', 'orange', 'sparkling'];
export const BEER_STYLES = ['lager', 'wheat', 'pale', 'ipa', 'amber', 'stout', 'sour'];
export const WINE_NOTES = ['mineral', 'citrus', 'redfruit', 'stonefruit', 'floral', 'oak', 'spice', 'earthy'];
export const BEER_NOTES = ['citrus', 'malt', 'roast', 'hop', 'sour', 'fruit', 'spice'];
export const SCALES = { sweet: [0, 3], body: [1, 3], acid: [1, 3], bitter: [1, 3] };

/* words → meaning, Hebrew and English. A key matches whole words only (one Hebrew prefix letter ו, ה, ב, מ, ל or ש may stand
   in front), case and niqqud ignored. Longer phrases are tried first, so "חצי יבש" is not read as "יבש". */
const W = {
  sweet: [[1, ['off-dry', 'off dry', 'semi-dry', 'medium dry', 'חצי יבש', 'חצי-יבש']], [2, ['semi-sweet', 'medium sweet', 'medium-sweet', 'חצי מתוק', 'חצי-מתוק']],
    [3, ['sweet', 'dessert wine', 'מתוק', 'מתוקה', 'קינוח']], [0, ['bone dry', 'dry', 'brut', 'יבש', 'יבשה', 'ברוט']]],
  body: [[1, ['light-bodied', 'light bodied', 'light', 'קליל', 'קלילה', 'קל', 'קלה']], [3, ['full-bodied', 'full bodied', 'full', 'rich', 'bold', 'מלא', 'מלאה', 'עשיר', 'עשירה']], [2, ['medium-bodied', 'medium bodied', 'medium', 'בינוני', 'בינונית']]],
  acid: [[3, ['high acidity', 'crisp', 'zesty', 'fresh', 'high', 'רענן', 'רעננה', 'חומציות גבוהה', 'גבוהה', 'גבוה']], [1, ['soft', 'low', 'round', 'עגול', 'עגולה', 'נמוכה', 'רכה']], [2, ['medium', 'בינונית', 'בינוני']]],
  bitter: [[3, ['very bitter', 'bitter', 'hoppy', 'מרירה', 'מריר', 'מרירות']], [1, ['smooth', 'mild', 'soft', 'רכה', 'עדינה', 'עדין']]],
  wine: {
    mineral: ['mineral', 'minerality', 'flint', 'saline', 'chalk', 'מינרלי', 'מינרלית', 'מינרליות', 'צור', 'מלוח'],
    citrus: ['citrus', 'citrusy', 'lemon', 'lime', 'grapefruit', 'green apple', 'הדרים', 'הדרי', 'הדרית', 'לימון', 'ליים', 'אשכולית', 'תפוח ירוק'],
    redfruit: ['red fruit', 'strawberry', 'cherry', 'raspberry', 'berry', 'berries', 'plum', 'dark fruit', 'פרי אדום', 'פירות אדומים', 'תות', 'דובדבן', 'פטל', 'שזיף', 'פרי כהה', 'פירות יער'],
    stonefruit: ['apricot', 'peach', 'stone fruit', 'משמש', 'אפרסק', 'נקטרינה'],
    floral: ['floral', 'flowers', 'rose', 'violet', 'blossom', 'פרחוני', 'פרחונית', 'פרחים', 'ורד', 'סיגלית'],
    oak: ['oak', 'oaked', 'barrel', 'vanilla', 'toast', 'עץ', 'אלון', 'חבית', 'חביות', 'וניל'],
    spice: ['spice', 'spicy', 'pepper', 'black pepper', 'clove', 'cinnamon', 'תבלין', 'תבלינים', 'פלפל', 'ציפורן', 'קינמון'],
    earthy: ['earthy', 'earth', 'forest floor', 'mushroom', 'אדמה', 'אדמתי', 'אדמתית', 'פטריות']
  },
  beer: {
    citrus: ['citrus', 'grapefruit', 'orange peel', 'lemon', 'הדרים', 'אשכולית', 'קליפת תפוז', 'לימון'],
    malt: ['malt', 'malty', 'bread', 'biscuit', 'caramel', 'honey', 'לתת', 'לתתית', 'לתתי', 'לחם', 'קרמל', 'דבש'],
    roast: ['roast', 'roasted', 'coffee', 'chocolate', 'espresso', 'קלוי', 'קלויה', 'קפה', 'שוקולד'],
    hop: ['hop', 'hops', 'hoppy', 'pine', 'resin', 'herbal', 'כשות', 'אורן', 'שרף', 'צמחי'],
    sour: ['sour', 'tart', 'חמוץ', 'חמוצה', 'חמצמץ'],
    fruit: ['banana', 'tropical', 'mango', 'passion fruit', 'stone fruit', 'בננה', 'טרופי', 'מנגו', 'פסיפלורה'],
    spice: ['clove', 'pepper', 'coriander', 'spice', 'ציפורן', 'פלפל', 'כוסברה', 'תבלין']
  },
  beerStyle: [['sour', ['sour', 'gose', 'lambic', 'berliner', 'חמוצה']], ['stout', ['stout', 'porter', 'סטאוט', 'פורטר']], ['ipa', ['ipa', 'india pale']],
    ['wheat', ['wheat', 'weizen', 'hefeweizen', 'witbier', 'weiss', 'blanche', 'חיטה', 'חיטים']], ['amber', ['amber', 'red ale', 'bock', 'dunkel', 'ענבר', 'ענברית']],
    ['pale', ['pale ale', 'apa', 'blonde', 'golden ale', 'פייל']], ['lager', ['lager', 'pils', 'pilsner', 'helles', 'לאגר', 'פילזנר']]],
  wineStyle: [['sparkling', ['sparkling', 'brut', 'prosecco', 'cava', 'champagne', 'crémant', 'cremant', 'מבעבע', 'קאווה', 'שמפניה', 'פרוסקו']], ['rose', ['rosé', 'rose wine', 'רוזה']],
    ['orange', ['orange wine', 'skin contact', 'on the skins', 'כתום', 'על הקליפות']], ['red', ['red wine', 'יין אדום']], ['white', ['white wine', 'יין לבן']]]
};

const str = (v) => (typeof v === 'string' ? v : '');
const both = (v) => (v && typeof v === 'object' ? [str(v.he), str(v.en)] : [str(v)]);
export const norm = (s) => String(s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[״"׳'`’]/g, '').replace(/[^\p{L}\p{N}%.\- ]+/gu, ' ').replace(/\s+/g, ' ').trim();
/* does the text contain the key as a word (or a word's start, after an optional Hebrew prefix letter)? */
export function hasWord(text, key) {
  const t = ' ' + norm(text) + ' ', k = norm(key); if (!k) return false;
  let at = t.indexOf(k);
  while (at >= 0) {
    const before = t[at - 1], after = t[at + k.length], heb = /[א-ת]/.test(k[0]);
    const startOk = before === ' ' || before === '-' || (heb && /[והבמלש]/.test(before) && (t[at - 2] === ' ' || t[at - 2] === '-'));
    const endOk = after === ' ' || after === '-' || after === '.' || after === undefined || (!heb && /[a-z]/.test(after || '') === false);
    if (startOk && endOk) return true;
    at = t.indexOf(k, at + 1);
  }
  return false;
}
/* the first meaning whose words appear in the texts; longer keys first */
function firstOf(table, texts) {
  const rows = []; table.forEach(([v, keys]) => keys.forEach((k) => rows.push([v, k]))); rows.sort((a, b) => b[1].length - a[1].length);
  for (const [v, k] of rows) if (texts.some((t) => hasWord(t, k))) return v;
  return null;
}
const clampInt = (v, [a, b]) => (Number.isInteger(v) && v >= a && v <= b ? v : null);

export function tasteOf(item, kind) {
  if (!item || (kind !== 'wine' && kind !== 'beer')) return null;
  const d = item.details || {}, words = both(item.desc);
  if (kind === 'wine') {
    const w = d.wine; if (!w && !words.join('')) return null;
    const ww = w || {}, n = ww.notes || {}, t = ww.taste || {}, out = { kind, style: null, scales: [], notes: [], abv: null };
    if (WINE_STYLES.includes(ww.color)) out.style = { id: ww.color, src: 'field' };
    else { const s = firstOf(W.wineStyle, words); if (s) out.style = { id: s, src: 'words' }; }
    const scale = (id, field, free) => {
      const f = clampInt(t[id], SCALES[id]); if (f != null) return out.scales.push({ id, v: f, of: SCALES[id], src: 'field' });
      const v = firstOf(W[id], both(free)); if (v != null) return out.scales.push({ id, v, of: SCALES[id], src: 'field' });      // the merchant's own notes field ("Dry")
      const s = firstOf(W[id], words); if (s != null && field) out.scales.push({ id, v: s, of: SCALES[id], src: 'words' });
    };
    scale('sweet', true, n.sweetness); scale('body', true, n.body); scale('acid', false, n.acidity);
    const seen = new Set(), note = (id, src) => { if (!seen.has(id) && WINE_NOTES.includes(id)) { seen.add(id); out.notes.push({ id, src }); } };
    (Array.isArray(t.notes) ? t.notes : []).forEach((id) => note(id, 'field'));
    const fieldText = [n.fruit, n.minerality].flatMap(both);
    if (both(n.minerality).some((x) => x && !/^(low|none|no|נמוכה|נמוך|אין|ללא)$/.test(norm(x)))) note('mineral', 'field');      // the merchant gave it a minerality worth naming
    Object.keys(W.wine).forEach((id) => { if (W.wine[id].some((k) => fieldText.some((x) => hasWord(x, k)))) note(id, 'field'); });
    Object.keys(W.wine).forEach((id) => { if (W.wine[id].some((k) => words.some((x) => hasWord(x, k)))) note(id, 'words'); });
    out.notes = out.notes.slice(0, 4);
    return out.style || out.scales.length || out.notes.length ? out : null;
  }
  const b = d.beer; if (!b && !words.join('')) return null;
  const bb = b || {}, t = bb.taste || {}, out = { kind, style: null, scales: [], notes: [], abv: null };
  if (BEER_STYLES.includes(t.style)) out.style = { id: t.style, src: 'field' };
  else { const s = firstOf(W.beerStyle, both(bb.style)); if (s) out.style = { id: s, src: 'field' }; else { const w2 = firstOf(W.beerStyle, words); if (w2) out.style = { id: w2, src: 'words' }; } }
  const f = clampInt(t.bitter, SCALES.bitter); if (f != null) out.scales.push({ id: 'bitter', v: f, of: SCALES.bitter, src: 'field' });
  else { const s = firstOf(W.bitter, words); if (s != null) out.scales.push({ id: 'bitter', v: s, of: SCALES.bitter, src: 'words' }); }
  const abv = both(bb.abv).find((x) => x && /\d/.test(x)); if (abv) out.abv = { text: abv.trim(), src: 'field' };
  const seen = new Set(), note = (id, src) => { if (!seen.has(id) && BEER_NOTES.includes(id)) { seen.add(id); out.notes.push({ id, src }); } };
  (Array.isArray(t.notes) ? t.notes : []).forEach((id) => note(id, 'field'));
  Object.keys(W.beer).forEach((id) => { if (W.beer[id].some((k) => words.some((x) => hasWord(x, k)))) note(id, 'words'); });
  out.notes = out.notes.slice(0, 4);
  return out.style || out.scales.length || out.notes.length || out.abv ? out : null;
}

/* the snapshot's optional taste fields, made safe (used by snapshot.js) */
export function cleanTaste(t, kind) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
  const out = {}, notes = kind === 'wine' ? WINE_NOTES : BEER_NOTES;
  (kind === 'wine' ? ['sweet', 'body', 'acid'] : ['bitter']).forEach((k) => { const v = clampInt(t[k], SCALES[k]); if (v != null) out[k] = v; });
  if (kind === 'beer' && BEER_STYLES.includes(t.style)) out.style = t.style;
  if (Array.isArray(t.notes)) { const n = [...new Set(t.notes.filter((x) => notes.includes(x)))].slice(0, 6); if (n.length) out.notes = n; }
  return Object.keys(out).length ? out : null;
}
