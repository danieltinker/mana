/* The tags of a wine or a beer: style, sweetness or bitterness, body, acidity, strength, notes; each a small icon and a word.
   What they say comes from drinks/taste.js (the merchant's fields and words, nothing else); this file only draws them.
   Three sizes: 'card' (the card in focus: the style and a few notes), 'sheet' (the open dish: everything, scales as pips) and
   'row' (the list: icons, the words for a screen reader). A tag read from the description is drawn with a dotted edge and says so. */
import { tasteOf } from './drinks/taste.js';

const NS = 'http://www.w3.org/2000/svg';
/* one line weight, a 16 px grid, round ends; crisp at 14–20 px */
export const TASTE_ICON = {
  wine: 'M5 2.2h6c.6 3.6-.5 6.4-3 6.4S4.4 5.8 5 2.2zM8 8.6v5M5.4 13.8h5.2',
  wineFill: 'M5.2 4.6h5.6c-.3 2.3-1.3 3.5-2.8 3.5S5.5 6.9 5.2 4.6z',
  flute: 'M6.4 1.8h3.2c.4 4.2 0 6.6-1.6 7.4C6.4 8.4 6 6 6.4 1.8zM8 9.2v4.4M5.8 13.8h4.4',
  fluteFill: 'M6.6 4.4h2.8c.1 2.2-.3 3.6-1.4 4.2-1.1-.6-1.5-2-1.4-4.2z',
  beer: 'M4 3.6h6.4l-.7 10H4.7zM10.4 5.6h1.3c.8 0 1.3.6 1.3 1.4v2.2c0 .8-.5 1.4-1.3 1.4h-1.6',
  beerFill: 'M4.3 6.2h5.8l-.5 7.1H4.8z',
  sweet: 'M3.5 6.2L8 3.8l4.5 2.4v4.6L8 13.2l-4.5-2.4zM3.5 6.2L8 8.6l4.5-2.4M8 8.6v4.6',
  body: 'M8 2.4a5.6 5.6 0 1 1 0 11.2A5.6 5.6 0 0 1 8 2.4zM2.6 9.4c1.8-.9 3.6-.9 5.4 0s3.6.9 5.4 0',
  acid: 'M2.6 9.6l2.2-3.2 2.2 3.2 2.2-3.2 2.2 3.2 2.2-3.2',
  bitter: 'M8 2.2c1.6 1.2 2.4 2.6 2.4 4.2M8 2.2C6.4 3.4 5.6 4.8 5.6 6.4M5.6 6.4c0 1.6 1 2.6 2.4 2.6s2.4-1 2.4-2.6M5.9 8.6c-.2 2 .6 3.6 2.1 4.6 1.5-1 2.3-2.6 2.1-4.6M8 13.2v1.4',
  abv: 'M8 2.2c2.4 3 3.8 5.1 3.8 7a3.8 3.8 0 0 1-7.6 0c0-1.9 1.4-4 3.8-7zM6.5 11.6l3-3.4M6.6 8.6h.01M9.4 11.3h.01',
  mineral: 'M5 2.6h6l2.4 3.2L8 13.6 2.6 5.8zM2.6 5.8h10.8M6.4 5.8L8 13.6l1.6-7.8M5 2.6l1.4 3.2M11 2.6L9.6 5.8',
  citrus: 'M8 2.6a5.4 5.4 0 1 1 0 10.8A5.4 5.4 0 0 1 8 2.6zM8 4.4v7.2M4.4 8h7.2M5.5 5.5l5 5M10.5 5.5l-5 5',
  redfruit: 'M5.4 10a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zM10.8 9a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zM5.6 10c.6-3.2 2-5.4 4.4-7.4M10.6 9c-.2-2.6-.4-4.4-.6-6.4M10 2.6c1.2-.4 2.4-.2 3.4.6',
  stonefruit: 'M8 4.6c3 0 5 1.9 5 4.6s-2.2 4.6-5 4.6-5-1.9-5-4.6S5 4.6 8 4.6zM8 4.6c-.6 3 0 6 0 9.2M8 4.6c.2-1.2.8-2 1.8-2.4M9 3.4c1.6-.8 3-.6 4 .2-1.2 1-2.6 1.2-4-.2z',
  floral: 'M8 6.4a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2zM8 6.4c-1.6-2.6-.8-4 0-4s1.6 1.4 0 4zM9.6 8c2.6-1.6 4-.8 4 0s-1.4 1.6-4 0zM8 9.6c1.6 2.6.8 4 0 4s-1.6-1.4 0-4zM6.4 8c-2.6 1.6-4 .8-4 0s1.4-1.6 4 0z',
  oak: 'M4.6 2.6h6.8c1 1.9 1.4 3.7 1.4 5.4s-.4 3.5-1.4 5.4H4.6C3.6 11.5 3.2 9.7 3.2 8s.4-3.5 1.4-5.4zM3.4 5.6h9.2M3.4 10.4h9.2M8 2.6v10.8',
  spice: 'M8 2.4l1.3 3.9 3.9-1.3-2.5 3 2.5 3-3.9-1.3L8 13.6l-1.3-3.9-3.9 1.3 2.5-3-2.5-3 3.9 1.3zM8 7.2a.8.8 0 1 1 0 1.6.8.8 0 0 1 0-1.6z',
  earthy: 'M2.8 8.4a5.2 4.6 0 0 1 10.4 0zM6.4 8.4v4.4c0 .5.4.8.8.8h1.6c.4 0 .8-.3.8-.8V8.4M2 13.6h12',
  malt: 'M8 14V5.4M8 5.4c-1.4-.8-1.6-2-1-3 .9.5 1.4 1.5 1 3zM8 5.4c1.4-.8 1.6-2 1-3-.9.5-1.4 1.5-1 3zM8 8.4c-1.6.2-2.6-.4-3-1.6 1.4-.2 2.4.3 3 1.6zM8 8.4c1.6.2 2.6-.4 3-1.6-1.4-.2-2.4.3-3 1.6zM8 11.4c-1.6.2-2.6-.4-3-1.6 1.4-.2 2.4.3 3 1.6zM8 11.4c1.6.2 2.6-.4 3-1.6-1.4-.2-2.4.3-3 1.6z',
  roast: 'M8 2.8c3 0 4.8 2.4 4.8 5.2S11 13.2 8 13.2 3.2 10.8 3.2 8 5 2.8 8 2.8zM8.6 3c-2 1.6-.4 3.4-.8 5s-1.6 2.6-.6 5',
  hop: 'M8 2.2c1.8.8 2.8 2 2.8 3.4M8 2.2c-1.8.8-2.8 2-2.8 3.4M5.2 5.6c-.6 1.4 0 2.8 1.4 3.4M10.8 5.6c.6 1.4 0 2.8-1.4 3.4M6.6 9c-.6 1.6.2 3.2 1.4 4M9.4 9c.6 1.6-.2 3.2-1.4 4M5.2 5.6h5.6M6.6 9h2.8',
  sour: 'M3.2 9.2c0-3.4 2.4-5.6 5.2-5.6 2.4 0 4.4 1.8 4.4 4.4 0 3-2.6 5.2-5.4 5.2-2.4 0-4.2-1.6-4.2-4zM12.2 5.4l1.4-1.4M3.6 11.8l-1.2 1.2',
  fruit: 'M8 5c2.8-1 5 .6 5 3.6S10.8 14 8 13c-2.8 1-5-1.4-5-4.4S5.2 4 8 5zM8 5c0-1.2.4-2.2 1.4-2.8M8.6 3.4c1-.8 2.2-.8 3-.2-.8.8-2 1-3 .2z',
  info: 'M8 2.6a5.4 5.4 0 1 1 0 10.8A5.4 5.4 0 0 1 8 2.6zM8 7.4v3.6M8 5.2h.01'
};
/* the colours of a wine or a beer: deep and quiet, like the drinks themselves */
export const STYLE_COLOUR = {
  red: '#8C2A3A', white: '#D9C47F', rose: '#E3A69C', orange: '#D98B45', sparkling: '#E8DAA8',
  lager: '#E8BE52', wheat: '#EFD27F', pale: '#E2A43E', ipa: '#CF862C', amber: '#B05E27', stout: '#4A2C1E', sour: '#D46F7E'
};
const SCALE_KEYS = { sweet: 'sweetScale', body: 'bodyScale', acid: 'acidScale', bitter: 'bitterScale' };

function icon(name, size, fill) {
  const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 16 16'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('aria-hidden', 'true'); s.setAttribute('class', 'ti');
  if (fill && TASTE_ICON[name + 'Fill']) { const f = document.createElementNS(NS, 'path'); f.setAttribute('d', TASTE_ICON[name + 'Fill']); f.setAttribute('fill', fill); f.setAttribute('stroke', 'none'); s.appendChild(f); }
  const p = document.createElementNS(NS, 'path'); p.setAttribute('d', TASTE_ICON[name] || TASTE_ICON.info); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.3'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); s.appendChild(p);
  return s;
}
const el = (tag, cls, kids, attrs) => { const e = document.createElement(tag); if (cls) e.className = cls; (kids || []).forEach((k) => { if (k != null) e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k); }); if (attrs) Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k])); return e; };

/* → an element, or null when there is nothing the merchant said */
export function tasteTags(item, kind, t, mode) {
  const taste = tasteOf(item, kind); if (!taste) return null;
  const words = t.group('taste'), styles = t.group('tasteStyle'), notes = t.group(kind === 'wine' ? 'wineNote' : 'beerNote'), sugg = t('tasteSuggested');
  const size = mode === 'sheet' ? 16 : 14, ul = el('ul', 'taste taste-' + mode, null, { 'aria-label': t('tasteTitle') });
  let anySugg = false;
  const chip = (cls, ic, word, src, colour, extra) => {
    const s = src === 'words'; anySugg = anySugg || s;
    const li = el('li', 'tt ' + cls + (s ? ' sugg' : ''), [icon(ic, size, colour), el('span', mode === 'row' ? 'sr' : 'tw', [word + (s && mode === 'row' ? ' (' + sugg + ')' : '')]), extra || null], { title: s ? word + ' · ' + sugg : word });
    if (colour) li.style.setProperty('--tc', colour);
    ul.appendChild(li); return li;
  };
  if (taste.style) { const id = taste.style.id; chip('style s-' + id, kind === 'wine' ? (id === 'sparkling' ? 'flute' : 'wine') : 'beer', styles[id] || id, taste.style.src, STYLE_COLOUR[id]); }
  const scales = taste.scales.slice(0, mode === 'card' ? 1 : 3);
  scales.forEach((sc) => {
    const names = t.group(SCALE_KEYS[sc.id]) || [], word = names[sc.v - sc.of[0]] || '', n = sc.of[1] - sc.of[0] + 1;
    let pips = null;
    if (mode === 'sheet') { pips = el('span', 'pips', null, { 'aria-hidden': 'true' }); for (let k = 0; k < n; k++) pips.appendChild(el('i', k <= sc.v - sc.of[0] ? 'on' : '')); }
    chip('scale k-' + sc.id, sc.id, mode === 'sheet' ? (words[sc.id] || sc.id) + ': ' + word : word, sc.src, null, pips);
  });
  if (taste.abv && mode !== 'card') chip('abv', 'abv', taste.abv.text, 'field', null);
  taste.notes.slice(0, mode === 'card' ? 2 : 4).forEach((nt) => chip('note n-' + nt.id, nt.id, notes[nt.id] || nt.id, nt.src, null));
  if (anySugg && mode === 'sheet') ul.appendChild(el('li', 'tt-foot', [icon('info', 12), el('span', null, [sugg])]));
  return ul;
}
