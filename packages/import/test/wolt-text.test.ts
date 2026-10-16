import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DRAFT_CAPS, IMPORT_TEXT_MAX } from '@mana/contracts';
import { classifyWoltLine, parseWoltText } from '../src/index.ts';
import { WOLT_EN_PAGE, WOLT_EN_SHEET, WOLT_HE_PAGE, WOLT_HE_SHEET } from './fixtures.ts';
import { answerFixes, exceptions, outline, reimportCreatesNothing, valid } from './helpers.ts';

const rule = (line: string) => classifyWoltLine(line).rule;
const notes = (r: ReturnType<typeof parseWoltText>) => r.notes.map((n) => `${n.code}${n.rule ? `:${n.rule}` : ''}${n.count > 1 ? `x${n.count}` : ''}`);

// ---------------------------------------------------------------- 1. lines

test('classifyWoltLine: each line rule, in English and Hebrew', () => {
  const cases: Array<[string, string]> = [
    ['', 'blank'],
    ['Add to order', 'sheet_end'], ['Add 1 to order ₪64.00', 'sheet_end'], ['הוספה להזמנה 72.00 ₪', 'sheet_end'],
    ['Group order', 'noise_button'], ['Schedule order', 'noise_button'], ['הזמנה קבוצתית', 'noise_button'], ['Close', 'noise_button'],
    ['Privacy statement', 'noise_footer'], ['© Wolt 2026', 'noise_footer'], ['Wolt', 'noise_footer'], ['כל הזכויות שמורות', 'noise_footer'],
    ['Delivery ₪9.90', 'noise_fee'], ['Min. order ₪50.00', 'noise_fee'], ['Free delivery', 'noise_fee'], ['משלוח 9.90 ₪', 'noise_fee'], ['מינימום הזמנה 50.00 ₪', 'noise_fee'],
    ['25–35 min', 'noise_delivery'], ['20-30 דק׳', 'noise_delivery'], ['1.2 km', 'noise_delivery'],
    ['Open until 23:00', 'noise_hours'], ['פתוח עד 22:00', 'noise_hours'], ['Sun–Thu 10:00–22:00', 'noise_hours'], ['Closed', 'noise_hours'],
    ['9.2', 'noise_rating'], ['4.7 (200+)', 'noise_rating'], ['👍 92%', 'noise_rating'], ['₪₪', 'noise_rating'], ['Excellent', 'noise_rating'],
    ['1', 'noise_quantity'],
    ['Popular', 'label_popular'], ['פופולרי', 'label_popular'], ['New', 'label_new'], ['חדש', 'label_new'], ['-20%', 'label_discount'],
    ['Sold out', 'label_sold_out'], ['אזל מהמלאי', 'label_sold_out'], ['Kosher', 'label_other'],
    ['Vegan', 'tags'], ['טבעוני', 'tags'], ['Gluten free', 'tags'],
    ['Allergens: gluten, egg', 'allergens'], ['אלרגנים: גלוטן', 'allergens'],
    ['Required', 'group_rule'], ['Choose up to 2', 'group_rule'], ['בחרו עד 3', 'group_rule'], ['חובה', 'group_rule'],
    ['+₪4.00', 'option_price'], ['+2.00 ₪', 'option_price'], ['Free', 'option_price'],
    ['₪64.00', 'price'], ['64.00 ₪', 'price'], ['from ₪48.00', 'price'], ['₪28.00 ₪32.00', 'price'], ['₪ 9O', 'price'],
    ['Schnitzel₪64.00', 'text_price'], ['Fries +₪5.00', 'text_price'],
    ['Schnitzel', 'text'], ['Crispy chicken breast, lemon and parsley…', 'text'], ['Fries › Choose a sauce', 'text'], ['42', 'noise_quantity'],
  ];
  for (const [line, expected] of cases) assert.equal(rule(line), expected, line);
  assert.deepEqual(classifyWoltLine('Fries +₪5.00').tokens, [{ k: 'text', text: 'Fries' }, { k: 'option_price', agorot: 500, text: '+₪5.00' }]);
});

// ---------------------------------------------------------------- 2. the page

test('an English page with a dish sheet: sections, dishes, prices, labels, a nested choice', () => {
  const r = parseWoltText(`${WOLT_EN_PAGE}\n${WOLT_EN_SHEET}`);
  const d = valid(r);
  assert.equal(d.source, 'wolt_text');
  assert.deepEqual(outline(d), [
    '# Mains (food)',
    'Schnitzel 6400 groups:Choose a side,Extras',
    'Burger 7200 tags:vegan',
    'Shakshuka 4800',
    'Fish of the day ?₪ 9O',
    '# Drinks (drinks)',
    'Lemonade 1800',
    'Craft beer 3200',
    '# Desserts (dessert)',
    'Malabi 2600 tags:gf',
    '[Choose a side] single 1-1: Fries >Choose a sauce, Salad, Rice +400',
    '[Choose a sauce] multiple ?-?: Aioli, Ketchup, Chili mayo +200',
    '[Extras] multiple ?-2: Fried egg +500, Avocado +600',
  ]);
  const schnitzel = d.sections[0]!.dishes[0]!;
  assert.equal(schnitzel.desc.en, 'Crispy chicken breast, lemon and parsley, served with a side of choice', "the sheet's full description, not the list's cut one");
  assert.deepEqual(schnitzel.allergens, { he: '', en: 'gluten, egg' }, 'copied as written');
  assert.deepEqual(d.sections[0]!.dishes[2]!.priceNote, { he: '', en: 'from ₪48.00' });
  assert.deepEqual(d.sections[0]!.dishes[2]!.tags, [], '"spicy" in a description is not a label');
  // what a person would expect to check or fix
  assert.deepEqual(exceptions(d, ['en']), ['allergens_check@Schnitzel', 'price_unreadable@Fish of the day', 'limits_guessed@Choose a sauce']);
  assert.deepEqual(notes(r), [
    'noise:buttonx2', 'noise:delivery', 'noise:feex2', 'noise:footerx4', 'noise:headerx2', 'noise:hours', 'noise:labelx2', 'noise:navx4', 'noise:quantity',
    'noise:rating', 'popular_droppedx2', 'sold_out', 'price_range', 'price_discount',
  ]);
  assert.equal(r.notes.find((n) => n.code === 'sold_out')!.severity, 'check');
  assert.equal(r.notes.find((n) => n.code === 'sold_out')!.key, d.sections[0]!.dishes[3]!.key, 'the sold-out mark is on the fish');
  assert.equal(r.dropped, 0);
});

test('a Hebrew page with a dish sheet: right-to-left marks, a sauce for the fries, a bilingual name', () => {
  const r = parseWoltText(`${WOLT_HE_PAGE}\n${WOLT_HE_SHEET}`);
  const d = valid(r);
  assert.deepEqual(outline(d), [
    '# עיקריות (food)',
    'שניצל 6400',
    'המבורגר 7200 tags:spicy groups:בחרו תוספת,תוספות',
    'פלאפל 3800 tags:vegan',
    '# שתייה (drinks)',
    'לימונדה 1800',
    'קולה / Cola 1200',
    '[בחרו תוספת] single 1-1: צ׳יפס >רוטב לצ׳יפס, סלט',
    '[רוטב לצ׳יפס] multiple ?-?: איולי, קטשופ +200',
    '[תוספות] multiple ?-3: ביצת עין +500, גבינה +300',
  ]);
  assert.deepEqual(exceptions(d, ['he']), ['limits_guessed@רוטב לצ׳יפס']);
  assert.ok(notes(r).includes('popular_dropped'), 'the "פופולרי" section is left out');
  assert.ok(notes(r).includes('sold_out'));
});

test('the sheet may come before the page: the same draft', () => {
  assert.deepEqual(parseWoltText(`${WOLT_EN_SHEET}\n${WOLT_EN_PAGE}`).draft, parseWoltText(`${WOLT_EN_PAGE}\n${WOLT_EN_SHEET}`).draft);
});

test('re-reading the same text gives the same draft and keys; pasting it twice changes nothing', () => {
  const text = `${WOLT_EN_PAGE}\n${WOLT_EN_SHEET}`;
  const a = parseWoltText(text).draft;
  assert.deepEqual(parseWoltText(text).draft, a);
  assert.deepEqual(parseWoltText(`${text}\n${text}`).draft, a);
  assert.deepEqual(parseWoltText(`${WOLT_HE_PAGE}\n${WOLT_HE_SHEET}\n${WOLT_HE_PAGE}`).draft, parseWoltText(`${WOLT_HE_PAGE}\n${WOLT_HE_SHEET}`).draft);
});

test('Hopa test 1: importing the same Wolt text twice creates nothing the second time', () => {
  const read = () => parseWoltText(`${WOLT_EN_PAGE}\n${WOLT_EN_SHEET}`);
  reimportCreatesNothing(read, answerFixes(read().draft));
  const he = () => parseWoltText(`${WOLT_HE_PAGE}\n${WOLT_HE_SHEET}`);
  reimportCreatesNothing(he, answerFixes(he().draft));
});

test('noise anywhere between the lines changes nothing', () => {
  const noise = ['9.4', 'Delivery ₪9.90', '25–35 min', 'Open until 23:00', 'Group order', '👍 95% (120)', 'Privacy statement', ''];
  const clean = parseWoltText(WOLT_EN_PAGE).draft;
  const lines = WOLT_EN_PAGE.split('\n');
  const noisy = lines.flatMap((l, i) => (i > 14 && i % 3 === 0 ? [noise[i % noise.length]!, l] : [l])).join('\n');
  assert.deepEqual(parseWoltText(noisy).draft, clean);
});

test('a partial copy (no venue header, no list of sections) still finds sections by their look', () => {
  const r = parseWoltText(`Mains\nSchnitzel\nCrispy chicken breast, lemon and parsley\n₪64.00\nBurger\n₪72.00\nDrinks\nLemonade\n₪18.00`);
  assert.deepEqual(outline(valid(r)), ['# Mains (food)', 'Schnitzel 6400', 'Burger 7200', '# Drinks (drinks)', 'Lemonade 1800']);
});

test('dishes before any heading go to one section named in both languages', () => {
  const d = valid(parseWoltText('Schnitzel\n₪64.00\nBurger\n₪72.00'));
  assert.deepEqual(d.sections.map((s) => s.name), [{ he: 'תפריט', en: 'Menu' }]);
  assert.equal(d.sections[0]!.dishes.length, 2);
});

test('the "Popular" section is left out; a dish found only there is kept out and flagged', () => {
  const r = parseWoltText('Most ordered\nMains\nMost ordered\nSoup\n₪30.00\nTart\n₪25.00\nMains\nSoup\n₪30.00');
  assert.deepEqual(outline(valid(r)), ['# Mains (food)', 'Soup 3000']);
  assert.deepEqual(r.notes.filter((n) => n.code.startsWith('popular')).map((n) => [n.code, n.severity, n.count]), [['popular_dropped', 'info', 1], ['popular_only', 'check', 1]]);
});

test('a "Popular" mark on a dish is not a heading', () => {
  const d = valid(parseWoltText('Mains\nMains\nDrinks\nMains\nSoup\nPopular\n₪30.00\nPopular\nTart\n₪25.00\nDrinks\nCola\n₪10.00'));
  assert.deepEqual(outline(d), ['# Mains (food)', 'Soup 3000', 'Tart 2500', '# Drinks (drinks)', 'Cola 1000']);
});

test('sold out is a check note on the dish, never an availability', () => {
  const r = parseWoltText('Mains\nSoup\n₪30.00\nSold out');
  const d = valid(r);
  assert.deepEqual(Object.keys(d.sections[0]!.dishes[0]!).sort(),
    ['allergens', 'desc', 'groups', 'illustration', 'key', 'name', 'photo', 'price', 'priceNote', 'priceText', 'tags', 'translated'], 'exactly the contract fields');
  assert.deepEqual(r.notes.map((n) => [n.code, n.severity, n.key]), [['sold_out', 'check', d.sections[0]!.dishes[0]!.key]]);
});

test('tags only from explicit labels; other labels are noted and left out', () => {
  const r = parseWoltText('Mains\nVegan bowl\n₪50.00\nSpicy noodles\n₪48.00\nTofu\n₪40.00\nVegan · Gluten free\nSteak\n₪120.00\nKosher');
  const d = valid(r);
  assert.deepEqual(d.sections[0]!.dishes.map((x) => x.tags), [[], [], ['vegan', 'gf'], []]);
  assert.ok(r.notes.some((n) => n.code === 'label_dropped' && n.key === d.sections[0]!.dishes[3]!.key));
});

test('allergens: a bare "Allergens" heading takes the next line as written', () => {
  const d = valid(parseWoltText('Soup\n₪30.00\nCreamy tomato soup\nAllergens\nGluten, milk\nAdd to order'));
  assert.deepEqual(d.sections[0]!.dishes[0]!.desc, { he: '', en: 'Creamy tomato soup' });
  assert.deepEqual(d.sections[0]!.dishes[0]!.allergens, { he: '', en: 'Gluten, milk' });
});

test('option groups: limits only when stated; options with no price are free; a rule over two lines', () => {
  const sheet = 'Pasta\n₪54.00\nChoose a sauce\nRequired\nChoose 1\nTomato\nCream\n+₪4.00\nToppings\nOptional\nParmesan\nBasil\n+₪2.00\nAdd to order';
  const d = valid(parseWoltText(sheet));
  assert.deepEqual(outline(d).slice(2), ['[Choose a sauce] single 1-1: Tomato, Cream +400', '[Toppings] multiple ?-?: Parmesan, Basil +200']);
  assert.deepEqual(exceptions(d, ['en']), ['limits_guessed@Toppings'], '"Optional" alone states no limits: the owner confirms them');
});

test('ASSUMPTION (tuning): a group heading is known by the rule line under it', () => {
  // the first group of a sheet, with no rule line: its first line is taken as its heading
  const first = valid(parseWoltText('Pasta\n₪54.00\nToppings\nParmesan\nBasil\n+₪2.00\nAdd to order'));
  assert.deepEqual(outline(first).slice(2), ['[Toppings] multiple ?-?: Parmesan, Basil +200']);
  // a later heading with no rule line cannot be told from a free option: its lines join the group before
  const later = valid(parseWoltText('Pasta\n₪54.00\nChoose a sauce\nRequired\nTomato\n+₪4.00\nToppings\nBasil\n+₪2.00\nAdd to order'));
  assert.deepEqual(outline(later).slice(2), ['[Choose a sauce] single 1-?: Tomato +400, Toppings, Basil +200']);
});

test('a nested choice only when the text shows it', () => {
  const plain = valid(parseWoltText('Burger\n₪72.00\nChoose a side\nRequired\nFries\nSalad\nChoose a sauce\nRequired\nAioli\nKetchup\nAdd to order'));
  assert.ok(plain.groups.every((g) => g.options.every((o) => o.opens === null)), 'a group after a group is not nested by itself');
  const nested = valid(parseWoltText('Burger\n₪72.00\nChoose a side\nRequired\nFries\nSalad\nSauce for fries\nRequired\nAioli\nAdd to order'));
  assert.deepEqual(outline(nested).slice(2), ['[Choose a side] single 1-?: Fries >Sauce for fries, Salad', '[Sauce for fries] single 1-?: Aioli']);
  assert.deepEqual(nested.sections[0]!.dishes[0]!.groups.map((g) => g.group), [nested.groups[0]!.key], 'the nested group hangs on its option, not on the dish');
  const r = parseWoltText('Burger\n₪72.00\nChoose a side\nRequired\nFries\nOnion rings › Choose a dip\nOptional\nMayo\nAdd to order');
  assert.ok(r.notes.some((n) => n.code === 'nesting_unmatched'), 'an option the dish does not show: a plain group, noted');
  assert.ok(valid(r).groups.every((g) => g.options.every((o) => o.opens === null)));
});

test('choices with no dish before them are left out and counted', () => {
  const r = parseWoltText('Choose a side\nRequired\nFries\nSalad\n+₪4.00\nMains\nSoup\n₪30.00');
  assert.deepEqual(outline(valid(r)), ['# Mains (food)', 'Soup 3000']);
  assert.ok(r.notes.some((n) => n.code === 'group_orphan'));
  assert.equal(r.dropped, 4);
});

test('a dish whose only price is on the sheet button takes it, with a check note', () => {
  const r = parseWoltText('Lemonade\nFresh lemons and mint\nAdd to order ₪18.00');
  assert.deepEqual(outline(valid(r)), ['# תפריט / Menu (food)', 'Lemonade 1800']);
  assert.ok(r.notes.some((n) => n.code === 'price_from_button' && n.severity === 'check'));
});

test('empty input: a valid empty draft and a note', () => {
  for (const s of ['', '\n \n\t', `${String.fromCodePoint(0x200f)}\n`]) {
    const r = parseWoltText(s);
    assert.deepEqual(valid(r), { v: 1, source: 'wolt_text', sections: [], groups: [] });
    assert.deepEqual(r.notes.map((n) => n.code), ['empty_input']);
  }
});

test('huge input: read up to IMPORT_TEXT_MAX, kept within DRAFT_CAPS, still valid', () => {
  const block = Array.from({ length: 900 }, (_, i) => `Dish number ${i}\n₪${10 + (i % 50)}.00`).join('\n');
  const r = parseWoltText(`Mains\n${block}`);
  const d = valid(r);
  assert.equal(d.sections[0]!.dishes.length, DRAFT_CAPS.dishes);
  assert.ok(r.notes.some((n) => n.code === 'caps_reached' && n.rule === 'dishes' && n.count === 100));
  assert.ok(exceptions(d).some((e) => e.startsWith('too_many@')), 'past LIMITS: the owner chooses');
  const long = parseWoltText(`Mains\n${'Soup\n₪30.00\n'.repeat(Math.ceil(IMPORT_TEXT_MAX / 12) + 100)}`);
  assert.ok(long.notes.some((n) => n.code === 'input_truncated' && n.severity === 'check'));
  valid(long);
});

test('D33: the readers never fetch anything and name no Wolt address', () => {
  const dir = new URL('../src/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|wolt\.com/u.test(src), f);
  }
});
