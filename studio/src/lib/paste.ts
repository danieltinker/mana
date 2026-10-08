// "Paste a list": one item per line `name | price | description`; a line starting with # opens a category.
import { parsePrice } from './money.ts';

export type PastedItem = { line: number; name: string; price: number | null; description: string; problem: '' | 'no_name' | 'bad_price' | 'long_name' };
export type PastedCategory = { line: number; name: string; kind: 'food' | 'dessert' | 'drinks' | 'wine' | 'beer'; items: PastedItem[]; implicit: boolean };

const KIND_WORDS: [PastedCategory['kind'], RegExp][] = [
  ['wine', /wine|יין|יינות/i],
  ['beer', /beer|בירה|בירות/i],
  ['dessert', /dessert|sweet|cake|קינוח|מתוק|עוג/i],
  ['drinks', /drink|beverage|cocktail|coffee|juice|soft|bar\b|שתי|משק|קוקטייל|קפה|מיצ|אלכוהול/i],
];
export function guessKind(name: string): PastedCategory['kind'] {
  for (const [k, re] of KIND_WORDS) if (re.test(name)) return k;
  return 'food';
}

export function parsePasted(text: string, defaultCategory: string): PastedCategory[] {
  const out: PastedCategory[] = [];
  let cur: PastedCategory | null = null;
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/[‎‏‪-‮⁦-⁩]/g, '').trim();
    if (!line) return;
    if (line.startsWith('#')) {
      const name = line.replace(/^#+\s*/, '').trim().slice(0, 60);
      if (!name) return;
      cur = { line: i + 1, name, kind: guessKind(name), items: [], implicit: false };
      out.push(cur);
      return;
    }
    if (!cur) { cur = { line: i + 1, name: defaultCategory, kind: 'food', items: [], implicit: true }; out.push(cur); }
    const parts = line.split('|').map((p) => p.trim());
    const name = parts[0] || '';
    const priceRaw = parts[1] || '';
    const parsed = parsePrice(priceRaw);
    const item: PastedItem = { line: i + 1, name: name.slice(0, 90), price: parsed === 'invalid' ? null : parsed, description: parts.slice(2).join(' | ').slice(0, 600), problem: '' };
    if (!name) item.problem = 'no_name';
    else if (parsed === 'invalid') item.problem = 'bad_price';
    else if (name.length > 90) item.problem = 'long_name';
    cur.items.push(item);
  });
  return out;
}
