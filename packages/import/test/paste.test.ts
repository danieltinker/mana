import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DRAFT_CAPS } from '@mana/contracts';
import { classifyPasteLine, parsePaste } from '../src/index.ts';
import { PASTE_EN, PASTE_MIXED } from './fixtures.ts';
import { answerFixes, exceptions, fastest, outline, reimportCreatesNothing, valid } from './helpers.ts';

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

test('QA-M1: no price is taken from inside a name; the name stays whole, with a check note when it is a dish', () => {
  const read = (text: string) => { const r = parsePaste(text); return { d: valid(r), r }; };
  // a number the name ends with, the price on the next line
  assert.deepEqual(outline(read('# Deals\nCombo 1\n45\nTea for 2\n48\nPizza No. 5\n59').d).slice(1), ['Combo 1 4500', 'Tea for 2 4800', 'Pizza No. 5 5900']);
  // the same on one line
  assert.deepEqual(outline(read('# Deals\nCombo 1 45\nTea for 2 48\nPizza No. 5 59').d).slice(1), ['Combo 1 4500', 'Tea for 2 4800', 'Pizza No. 5 5900']);
  // a description that ends in a number stays the description
  const desc = read('# Mains\nFamily platter 180\nServes 4\n\nLamb chops 120\nOur recipe since 1998').d;
  assert.deepEqual(desc.sections[0]!.dishes.map((x) => [x.name.en, x.price, x.desc.en]), [['Family platter', 18000, 'Serves 4'], ['Lamb chops', 12000, 'Our recipe since 1998']]);
  // two numbers that may be two prices: one dish, whole, no price, a note
  const two = read('# Wine\nHouse red 38 140\nRosé glass 36 bottle 130');
  assert.deepEqual(outline(two.d).slice(1), ['House red 38 140 -', 'Rosé glass 36 bottle 130 -']);
  assert.deepEqual(two.r.notes.filter((n) => n.code === 'price_ambiguous').map((n) => [n.severity, n.lines]), [['check', [2]], ['check', [3]]]);
  assert.deepEqual(exceptions(two.d, ['en']), ['price_missing@House red 38 140', 'price_missing@Rosé glass 36 bottle 130']);
  // a phone number is never a price (nor a range); hours after a priced dish are left out
  const phone = read('# Mains\nSoup\n03-5551234\nStew 60\n12-23');
  assert.deepEqual(outline(phone.d).slice(1), ['Soup -', 'Stew 6000']);
  assert.ok(phone.r.notes.some((n) => n.code === 'noise' && n.rule === 'phone'));
  for (const line of ['Combo 1', 'Tea for 2', 'Pizza No. 5', 'Serves 4', 'Our recipe since 1998', 'House red 38 140', 'Call 0541234567']) {
    assert.notEqual(classifyPasteLine(line)?.token.k, 'dish', line);
  }
  // a plain price after a name still splits, a single digit included when nothing says it is the name's
  assert.deepEqual(classifyPasteLine('Espresso 9')?.token, { k: 'dish', text: 'Espresso', price: { kind: 'one', agorot: 900 }, desc: '' });
  assert.deepEqual(classifyPasteLine('Kids meal 45')?.token, { k: 'dish', text: 'Kids meal', price: { kind: 'one', agorot: 4500 }, desc: '' });
});

test('QA-L4: a range or "from" on the name\'s line is read, with the price note', () => {
  const d = valid(parsePaste('# Pizza\nMargherita 42-58\nFunghi ₪46–62\nCalzone from 50'));
  assert.deepEqual(d.sections[0]!.dishes.map((x) => [x.name.en, x.price, x.priceNote.en]), [['Margherita', 4200, '42-58'], ['Funghi', 4600, '₪46–62'], ['Calzone', 5000, 'from 50']]);
});

test('QA-H1: in a paste a tag word is a tag only right under its dish; after a blank line it is a heading', () => {
  const cases: Array<[string, string[]]> = [
    ['# Mains\nSteak 120\nLamb chops 110\n\nVegan\nTofu bowl 50\nLentil stew 45', ['# Mains (food)', 'Steak 12000', 'Lamb chops 11000', '# Vegan (food)', 'Tofu bowl 5000', 'Lentil stew 4500']],
    ['# עיקריות\nשניצל 64\nפסטה 54\n\nללא גלוטן\nסלט קינואה 48', ['# עיקריות (food)', 'שניצל 6400', 'פסטה 5400', '# ללא גלוטן (food)', 'סלט קינואה 4800']],
    ['Mains:\nSteak 120\n\nVegan:\nTofu bowl 50', ['# Mains (food)', 'Steak 12000', '# Vegan (food)', 'Tofu bowl 5000']],
    ['MAINS\nSteak 120\n\nVEGAN\nTofu bowl 50', ['# MAINS (food)', 'Steak 12000', '# VEGAN (food)', 'Tofu bowl 5000']],
    ['Vegan\nTofu bowl 50', ['# Vegan (food)', 'Tofu bowl 5000']],
  ];
  for (const [text, expected] of cases) {
    const d = valid(parsePaste(text));
    assert.deepEqual(outline(d), expected, text);
    assert.ok(d.sections.every((s) => s.dishes.every((x) => x.tags.length === 0)), `${text}: no dish gains a tag`);
  }
  assert.deepEqual(valid(parsePaste('# Mains\nTofu bowl 50\nVegan\nSteak 120')).sections[0]!.dishes.map((x) => x.tags), [['vegan'], []], 'right under its dish, a tag');
});

test('QA-L3: a bare "Allergens:" never takes a line across a blank line', () => {
  const r = parsePaste('# Mains\nSoup 30\nAllergens:\n\nChef special\n60');
  const d = valid(r);
  assert.deepEqual(outline(d), ['# Mains (food)', 'Soup 3000', 'Chef special 6000']);
  assert.deepEqual(d.sections[0]!.dishes[0]!.allergens, { he: '', en: '' });
  assert.deepEqual(valid(parsePaste('# Mains\nSoup 30\nAllergens:\ngluten, milk')).sections[0]!.dishes[0]!.allergens, { he: '', en: 'gluten, milk' });
});

test('a menu copied from a spreadsheet: tabs split the columns', () => {
  const d = valid(parsePaste('# Mains\nSchnitzel\t64\tCrispy, with lemon\nBurger\t72'));
  assert.deepEqual(d.sections[0]!.dishes.map((x) => [x.name.en, x.price, x.desc.en]), [['Schnitzel', 6400, 'Crispy, with lemon'], ['Burger', 7200, '']]);
});

test('QA-L8 and QA-M9: the worst lines stay fast and valid (60,000 characters, long runs of one sign)', () => {
  const rep = (s: string, n: number) => s.repeat(Math.ceil(n / s.length)).slice(0, n);
  for (const line of [rep('₪ ', 60_000), `a${rep('.', 60_000)}x`, `a${rep('.·…_–—-', 60_000)}x`, `₪${rep('1', 60_000)}x`, `${rep('1', 60_000)}₪x`, rep('# ', 60_000), `# ${rep(' #', 60_000)}y`]) {
    const { ms, r } = fastest(() => parsePaste(line));
    valid(r);
    assert.ok(ms < 100, `${line.slice(0, 12)}…: ${ms.toFixed(0)} ms`);
    assert.ok(r.notes.some((n) => n.code === 'text_clipped' && n.rule === 'line'), 'the line was cut at LINE_MAX');
  }
});

/** Each dish as `he/en price {notes on it}`, and each section as `# he/en {notes on it}`. */
const placed = (r: ReturnType<typeof parsePaste>): string[] => {
  const name = (t: { he: string; en: string }) => [t.he, t.en].filter((x) => x !== '').join('/');
  const on = (key: string) => r.notes.filter((n) => n.key === key).map((n) => `${n.code}${n.rule ? `:${n.rule}` : ''}@${n.lines.join(',')}`);
  const tail = (key: string) => (on(key).length ? ` {${on(key).join(' ')}}` : '');
  return valid(r).sections.flatMap((s) => [`# ${name(s.name)}${tail(s.key)}`, ...s.dishes.map((x) => `${name(x.name)} ${x.price ?? '-'}${tail(x.key)}`)]);
};

test('QA-M2 (round 2): a common section name right under a dish in the other script is its name there, checked', () => {
  // the dishes around it are named in both languages, a line each: the name, checked (`other_language`)
  assert.deepEqual(placed(parsePaste('משקאות\nבירה 28\nBeer\nלימונדה 16\nLemonade\nיין 34\nWine')), [
    '# משקאות', 'בירה/Beer 2800 {layout_guessed:other_language@3}', 'לימונדה/Lemonade 1600', 'יין/Wine 3400 {layout_guessed:other_language@7}',
  ]);
  // English first, a Hebrew common name under it
  assert.deepEqual(placed(parsePaste('Drinks\nBeer 28\nבירה\nWine 34\nיין')), [
    '# Drinks', 'בירה/Beer 2800 {layout_guessed:other_language@3}', 'יין/Wine 3400 {layout_guessed:other_language@5}',
  ]);
  // nothing around it is named that way: a heading, checked
  assert.deepEqual(placed(parsePaste('עיקריות\nשניצל 64\nDesserts\nעוגת גבינה 30')), [
    '# עיקריות', 'שניצל 6400', '# Desserts {layout_guessed:other_language@3}', 'עוגת גבינה 3000',
  ]);
  // in the dish's own script, or after a blank line, a common name is a heading as before, with no note
  const plain = parsePaste('Mains\nSteak 120\nDesserts\nCheesecake 30\n\nקינוחים\nמלבי 26');
  assert.deepEqual(placed(plain), ['# Mains', 'Steak 12000', '# Desserts', 'Cheesecake 3000', '# קינוחים', 'מלבי 2600']);
});

test('QA-L4 (round 2): a bare number before the name stays in it, and the dish is checked', () => {
  const r = parsePaste('# Grill\n58 Kebab\n66 Shishlik\n₪44 Halloumi');
  assert.deepEqual(placed(r), ['# Grill', '58 Kebab - {price_ambiguous@2}', '66 Shishlik - {price_ambiguous@3}', 'Halloumi 4400']);
  // right under a heading it is a dish, not a heading
  assert.deepEqual(placed(parsePaste('Mains\n58 Kebab\nShishlik 66')), ['# Mains', '58 Kebab - {price_ambiguous@2}', 'Shishlik 6600']);
  assert.equal(classifyPasteLine('58 Kebab')?.rule, 'price_ambiguous');
  // a description that starts with a number stays a description
  const desc = valid(parsePaste('# Breakfast\nFull breakfast 62\n2 eggs, toast, salad'));
  assert.deepEqual(desc.sections[0]!.dishes.map((x) => [x.name.en, x.price, x.desc.en]), [['Full breakfast', 6200, '2 eggs, toast, salad']]);
});

test('QA-M1 (round 2): words with the letters of NIS or ILS in them are words, never prices', () => {
  // a name with its price on the next line
  assert.deepEqual(placed(parsePaste('# Starters\nSnails\n52\nLentils\n32')), ['# Starters', 'Snails 5200', 'Lentils 3200']);
  // a heading
  assert.deepEqual(placed(parsePaste('Wines\nHouse white 36\n\nSignature cocktails\nPaloma 44\n\nMocktails\nVirgin mule 24')),
    ['# Wines', 'House white 3600', '# Signature cocktails', 'Paloma 4400', '# Mocktails', 'Virgin mule 2400']);
  // a list with no prices
  assert.deepEqual(placed(parsePaste('Soups\nOnion soup\nBlack lentils\nPea soup')), ['# Soups', 'Onion soup -', 'Black lentils -', 'Pea soup -']);
  for (const line of ['Cocktails', 'Oxtails', 'Anis', 'Tennis', 'Nisan', 'Red lentils']) assert.equal(classifyPasteLine(line)?.rule, 'text', line);
  for (const line of ['Soup 30 NIS', 'Soup NIS 30', 'Soup 30 ש"ח']) assert.equal(classifyPasteLine(line)?.rule, 'dish_inline', line);
});
