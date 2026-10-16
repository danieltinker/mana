import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_CAPS } from '@mana/contracts';
import { classifyPasteLine, parsePaste } from '../src/index.ts';
import { PASTE_EN, PASTE_MIXED } from './fixtures.ts';
import { answerFixes, exceptions, outline, reimportCreatesNothing, valid } from './helpers.ts';

test('classifyPasteLine: each line rule', () => {
  const cases: Array<[string, string]> = [
    ['# Mains', 'heading_hash'], ['## עיקריות', 'heading_hash'], ['Mains:', 'heading_colon'], ['=====', 'heading_underline'], ['---', 'heading_underline'],
    ['Schnitzel | 64 | Crispy', 'pipe'], ['Schnitzel 64', 'dish_inline'], ['Schnitzel …… 64', 'dish_inline'], ['₪64 Schnitzel', 'dish_inline'],
    ['64', 'price'], ['₪64.00', 'price'], ['Vegan', 'tags'], ['Sold out', 'label_sold_out'], ['New', 'label_new'], ['Allergens: gluten', 'allergens'],
    ['Crispy, with lemon', 'text'], ['Schnitzel', 'text'],
  ];
  for (const [line, rule] of cases) assert.equal(classifyPasteLine(line)?.rule, rule, line);
  assert.equal(classifyPasteLine(''), null);
  assert.deepEqual(classifyPasteLine('Fish | market price | daily')?.token, { k: 'dish', text: 'Fish', price: { kind: 'unreadable', text: 'market price' }, desc: 'daily' });
});

test('a menu in both languages: headings, prices, descriptions, the second language under a dish, the v1 format', () => {
  const r = parsePaste(PASTE_MIXED);
  const d = valid(r);
  assert.equal(d.source, 'paste');
  assert.deepEqual(outline(d), [
    '# ראשונות / Starters (food)',
    'חומוס / Hummus 3200',
    'סלט ירקות / Vegetable salad 2800',
    '# עיקריות (food)',
    'שניצל / Schnitzel 6400',
    'דג היום 9200',
    'Pasta 5400 tags:vegan',
    '# Drinks (drinks)',
    'Lemonade 1800',
    'Wine 3800',
    'Water -',
  ]);
  const mains = d.sections[1]!.dishes;
  assert.deepEqual(mains[0]!.desc, { he: 'חזה עוף בפירורי לחם, לימון', en: 'Breaded chicken breast, lemon' });
  assert.deepEqual(mains[1]!.desc, { he: 'לפי השוק', en: '' }, 'the v1 format: name | price | description');
  assert.deepEqual(d.sections[0]!.dishes[0]!.desc, { he: 'עם טחינה ופיתה', en: '' });
  assert.deepEqual(d.sections[2]!.dishes[1]!.priceNote, { he: '', en: '38 / 140' });
  // one check for the names the venue's other language lacks (7 nodes), and the dish with no price
  assert.deepEqual(exceptions(d), ['name_missing_lang@_draft×7', 'price_missing@Water']);
  assert.deepEqual(r.notes.map((n) => n.code), ['price_range']);
});

test('a plain English list: capitals, a price on its own line, allergens, an unreadable price, a tag line', () => {
  const r = parsePaste(PASTE_EN);
  const d = valid(r);
  assert.deepEqual(outline(d), [
    '# STARTERS (food)', 'Soup of the day 3200', 'Bread basket 1800',
    '# MAINS (food)', 'Schnitzel 6400', 'Burger 7200', 'Kids burger ?₪ 4O',
    '# Desserts (dessert)', 'Malabi 2600 tags:gf',
  ]);
  assert.deepEqual(d.sections[0]!.dishes[0]!.desc, { he: '', en: 'Ask your waiter' }, 'a short line right under a dish, before the next one');
  assert.deepEqual(d.sections[1]!.dishes[0]!.desc, { he: '', en: 'Crispy, with lemon' });
  assert.deepEqual(d.sections[1]!.dishes[1]!.allergens, { he: '', en: 'gluten' });
  assert.deepEqual(exceptions(d, ['en']), ['allergens_check@Burger', 'price_unreadable@Kids burger']);
});

test('the v1 owner app\'s paste format reads as it did', () => {
  const d = valid(parsePaste('# Salads\nGreek | 42 | tomato, feta\nCaesar | 46\n# Drinks\nLemonade | 18'));
  assert.deepEqual(outline(d), ['# Salads (food)', 'Greek 4200', 'Caesar 4600', '# Drinks (drinks)', 'Lemonade 1800']);
  assert.deepEqual(d.sections[0]!.dishes[0]!.desc, { he: '', en: 'tomato, feta' });
});

test('headings: underlined, a colon, a common name, or a short line before a dish', () => {
  const d = valid(parsePaste('Salads\n======\nGreek 42\n\nSoups:\nLentil 30\n\nקינוחים\nמלבי 26\n\nChef specials\nRisotto 70'));
  assert.deepEqual(d.sections.map((s) => s.name.en || s.name.he), ['Salads', 'Soups', 'קינוחים', 'Chef specials']);
  assert.deepEqual(d.sections.map((s) => s.kind), ['food', 'food', 'dessert', 'food']);
});

test('a line with no price where a dish belongs is a dish with no price, for the owner to answer', () => {
  const d = valid(parsePaste('# Drinks\nTap water\nSoda\nLemonade 18'));
  assert.deepEqual(outline(d), ['# Drinks (drinks)', 'Tap water -', 'Soda -', 'Lemonade 1800']);
  assert.deepEqual(exceptions(d, ['en']), ['price_missing@Tap water', 'price_missing@Soda']);
});

test('re-reading gives the same keys, and Hopa test 1 holds', () => {
  assert.deepEqual(parsePaste(PASTE_MIXED).draft, parsePaste(PASTE_MIXED).draft);
  assert.deepEqual(parsePaste(`${PASTE_MIXED}\n\n${PASTE_MIXED}`).draft, parsePaste(PASTE_MIXED).draft, 'the same list pasted twice');
  reimportCreatesNothing(() => parsePaste(PASTE_MIXED), answerFixes(parsePaste(PASTE_MIXED).draft));
  reimportCreatesNothing(() => parsePaste(PASTE_EN), answerFixes(parsePaste(PASTE_EN).draft));
});

test('empty and huge pastes', () => {
  const empty = parsePaste(' \n\n');
  assert.deepEqual(valid(empty), { v: 1, source: 'paste', sections: [], groups: [], dropped: 0 });
  assert.deepEqual(empty.notes.map((n) => n.code), ['empty_input']);
  const many = Array.from({ length: DRAFT_CAPS.sections + 5 }, (_, i) => `# Section ${i}\nDish ${i} 10`).join('\n');
  const r = parsePaste(many);
  assert.equal(valid(r).sections.length, DRAFT_CAPS.sections);
  assert.ok(r.notes.some((n) => n.code === 'caps_reached' && n.rule === 'sections' && n.count === 5));
  const long = parsePaste(`Soup ${'x'.repeat(200)} 30`);
  assert.equal(valid(long).sections[0]!.dishes[0]!.name.en.length <= 90, true, 'a name is cut to the draft\'s limit');
  assert.ok(long.notes.some((n) => n.code === 'text_clipped'));
});
