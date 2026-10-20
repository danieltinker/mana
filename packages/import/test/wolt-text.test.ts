import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DRAFT_CAPS, draftExceptions, IMPORT_TEXT_MAX } from '@mana/contracts';
import { classifyWoltLine, parseWoltText } from '../src/index.ts';
import { WOLT_EN_PAGE, WOLT_EN_SHEET, WOLT_HE_PAGE, WOLT_HE_SHEET } from './fixtures.ts';
import { answerFixes, exceptions, fastest, outline, reimportCreatesNothing, valid } from './helpers.ts';

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
    '# Most ordered (food)',
    'Schnitzel 6400',
    'Burger 7200',
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
  const schnitzel = d.sections[1]!.dishes[0]!;
  assert.equal(schnitzel.desc.en, 'Crispy chicken breast, lemon and parsley, served with a side of choice', "the sheet's full description, not the list's cut one");
  assert.deepEqual(schnitzel.allergens, { he: '', en: 'gluten, egg' }, 'copied as written');
  assert.deepEqual(d.sections[1]!.dishes[2]!.priceNote, { he: '', en: 'from ₪48.00' });
  assert.deepEqual(d.sections[1]!.dishes[2]!.tags, [], '"spicy" in a description is not a label');
  // what a person would expect to check or fix: "Most ordered" repeats two dishes (the copies in Mains are kept)
  assert.deepEqual(exceptions(d, ['en']), [
    'dish_repeated@Schnitzel', 'dish_repeated@Burger', 'allergens_check@Schnitzel', 'price_unreadable@Fish of the day', 'limits_guessed@Choose a sauce',
  ]);
  assert.deepEqual(draftExceptions(d).filter((e) => e.code === 'dish_repeated').map((e) => e.key), d.sections[0]!.dishes.map((x) => x.key));
  assert.deepEqual(notes(r), [
    'noise:buttonx2', 'noise:delivery', 'noise:feex2', 'noise:footerx4', 'noise:headerx2', 'noise:hours', 'noise:labelx2', 'noise:navx4', 'noise:quantity',
    'noise:rating', 'sold_out', 'price_range', 'price_discount',
  ]);
  assert.equal(r.notes.find((n) => n.code === 'sold_out')!.severity, 'check');
  assert.equal(r.notes.find((n) => n.code === 'sold_out')!.key, d.sections[1]!.dishes[3]!.key, 'the sold-out mark is on the fish');
  assert.equal(r.draft.dropped, 0);
});

test('a Hebrew page with a dish sheet: right-to-left marks, a sauce for the fries, a bilingual name', () => {
  const r = parseWoltText(`${WOLT_HE_PAGE}\n${WOLT_HE_SHEET}`);
  const d = valid(r);
  assert.deepEqual(outline(d), [
    '# פופולרי (food)',
    'שניצל 6400',
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
  assert.deepEqual(exceptions(d, ['he']), ['dish_repeated@שניצל', 'limits_guessed@רוטב לצ׳יפס'], 'the "פופולרי" section is kept; its repeat is asked about');
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

test('QA-M4: the "Popular" section is kept; its repeats are dish_repeated, a dish found only there stays with a check note', () => {
  const r = parseWoltText('Most ordered\nMains\nMost ordered\nSoup\n₪30.00\nTart\n₪25.00\nMains\nSoup\n₪30.00\nStew\n₪60.00\nPie\n₪40.00');
  const d = valid(r);
  assert.deepEqual(outline(d), ['# Most ordered (food)', 'Soup 3000', 'Tart 2500', '# Mains (food)', 'Soup 3000', 'Stew 6000', 'Pie 4000']);
  assert.deepEqual(exceptions(d, ['en']), ['dish_repeated@Soup']);
  assert.equal(draftExceptions(d).find((e) => e.code === 'dish_repeated')!.key, d.sections[0]!.dishes[0]!.key, 'the copy in "Most ordered" is the repeat');
  assert.deepEqual(r.notes.filter((n) => n.code.startsWith('popular')).map((n) => [n.code, n.severity, n.count, n.lines]), [['popular_only', 'check', 1, [6]]]);
  // listed last, the same
  const last = valid(parseWoltText('Mains\nSoup\n₪30.00\nPopular items\nSoup\n₪30.00\nTart\n₪25.00'));
  assert.deepEqual(outline(last), ['# Mains (food)', 'Soup 3000', '# Popular items (food)', 'Soup 3000', 'Tart 2500']);
});

test('QA-M4: a dish sheet copied under "Popular" keeps its groups, on the dish in its own section', () => {
  const r = parseWoltText('Most ordered\nMains\nMost ordered\nBurger\n₪72.00\nChoose a side\nRequired\nChoose 1\nFries\nSalad\nAdd to order\nMains\nBurger\n₪72.00');
  const d = valid(r);
  assert.deepEqual(outline(d), ['# Most ordered (food)', 'Burger 7200', '# Mains (food)', 'Burger 7200 groups:Choose a side', '[Choose a side] single 1-1: Fries, Salad']);
  assert.deepEqual(exceptions(d, ['en']), ['dish_repeated@Burger']);
  assert.equal(draftExceptions(d).find((e) => e.code === 'dish_repeated')!.key, d.sections[0]!.dishes[0]!.key, 'the copy with the groups is the one kept');
  // a sheet found only under "Popular" stays there with its groups
  const only = valid(parseWoltText('Most ordered\nMains\nMost ordered\nBurger\n₪72.00\nChoose a side\nRequired\nChoose 1\nFries\nSalad\nAdd to order\nMains\nSoup\n₪30.00'));
  assert.deepEqual(outline(only).slice(0, 2), ['# Most ordered (food)', 'Burger 7200 groups:Choose a side']);
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
  const r = parseWoltText('Mains\nVegan bowl\n₪50.00\nSpicy noodles\n₪48.00\nTofu\nVegan · Gluten free\n₪40.00\nSteak\n₪120.00\nKosher');
  const d = valid(r);
  assert.deepEqual(d.sections[0]!.dishes.map((x) => x.tags), [[], [], ['vegan', 'gf'], []]);
  assert.ok(r.notes.some((n) => n.code === 'label_dropped' && n.key === d.sections[0]!.dishes[3]!.key));
  // after the price, at the end of the copy (or with only the footer after it), a tag is still the dish's
  assert.deepEqual(valid(parseWoltText('Mains\nTofu\n₪40.00\nVegan')).sections[0]!.dishes[0]!.tags, ['vegan']);
  assert.deepEqual(valid(parseWoltText('Mains\nTofu\n₪40.00\nVegan\nPrivacy statement\nBurger\n₪72.00')).sections[0]!.dishes[0]!.tags, ['vegan']);
});

/** Each dish as `name price [tags] (desc) {notes on it}`, and each section as `# name {notes on it}`. */
const placed = (r: ReturnType<typeof parseWoltText>): string[] => {
  const on = (key: string) => r.notes.filter((n) => n.key === key).map((n) => `${n.code}${n.rule ? `:${n.rule}` : ''}@${n.lines.join(',')}`);
  const tail = (key: string) => (on(key).length ? ` {${on(key).join(' ')}}` : '');
  return valid(r).sections.flatMap((s) => [
    `# ${s.name.he || s.name.en}${tail(s.key)}`,
    ...s.dishes.map((x) => `${x.name.he || x.name.en} ${x.price}${x.tags.length ? ` [${x.tags.join(',')}]` : ''}${x.desc.he || x.desc.en ? ` (${x.desc.he || x.desc.en})` : ''}${tail(x.key)}`),
  ]);
};

test('QA-H1 (round 2): a tag word between a price and the next dish is never a guessed tag or heading without a check', () => {
  const cases: Array<[string, string, string[]]> = [
    // nothing tells a label of the dish before from one of the dish after, or from a heading: neither, checked
    ['no section list', 'Grill\nPork belly\nSlow roasted, apple\n₪96.00\nVegetarian\nHalloumi steak\nGrilled, oregano\n₪58.00\nCorn ribs\n₪34.00',
      ['# Grill', 'Pork belly 9600 (Slow roasted, apple) {layout_guessed:tag_or_heading@5}', 'Halloumi steak 5800 (Grilled, oregano)', 'Corn ribs 3400']],
    ["the page's own list, without the word", 'Imaginary Diner\nGrill\nBowls\nGrill\nPork belly\nSlow roasted, apple\n₪96.00\nVegetarian\nHalloumi steak\nGrilled, oregano\n₪58.00\nBowls\nRice bowl\nEdamame, pickles\n₪52.00',
      ['# Grill', 'Pork belly 9600 (Slow roasted, apple) {layout_guessed:tag_or_heading@8}', 'Halloumi steak 5800 (Grilled, oregano)', '# Bowls', 'Rice bowl 5200 (Edamame, pickles)']],
    ['two tag lines', 'Grill\nPork belly\n₪96.00\nVegetarian\nGluten free\nHalloumi steak\n₪58.00',
      ['# Grill', 'Pork belly 9600 {layout_guessed:tag_or_heading@4,5}', 'Halloumi steak 5800']],
    // a common heading in the same lines wins: the tag word can only be the dish before's
    ['a common heading after it', 'Grill\nPork belly\nSlow roasted, apple\n₪96.00\nVegetarian\nDesserts\nBaked apple\nCinnamon, cream\n₪36.00',
      ['# Grill', 'Pork belly 9600 [vegetarian] (Slow roasted, apple) {layout_guessed:tag_or_heading@5}', '# Desserts', 'Baked apple 3600 (Cinnamon, cream)']],
    ['the same in Hebrew', 'מהגריל\nחזה עוף\nצלוי, לימון\n‏88.00 ₪\nטבעוני\nקינוחים\nתפוח אפוי\nקינמון, שמנת\n‏36.00 ₪',
      ['# מהגריל', 'חזה עוף 8800 [vegan] (צלוי, לימון) {layout_guessed:tag_or_heading@5}', '# קינוחים', 'תפוח אפוי 3600 (קינמון, שמנת)']],
    ["with the page's own list", 'Imaginary Diner\nGrill\nDesserts\nGrill\nPork belly\n₪96.00\nVegetarian\nDesserts\nBaked apple\n₪36.00',
      ['# Grill', 'Pork belly 9600 [vegetarian] {layout_guessed:tag_or_heading@7}', '# Desserts', 'Baked apple 3600']],
    // a heading only where the evidence says so: the page's list names it, or nothing stands before it
    ["one of the page's own sections", 'Imaginary Diner\nGrill\nVegetarian\nGrill\nPork belly\n₪96.00\nVegetarian\nHalloumi steak\n₪58.00',
      ['# Grill', 'Pork belly 9600', '# Vegetarian', 'Halloumi steak 5800']],
    ['first line of the copy', 'Vegetarian\nHalloumi steak\n₪58.00\nCorn ribs\n₪34.00', ['# Vegetarian', 'Halloumi steak 5800', 'Corn ribs 3400']],
    // a dish's own: among its lines, or after its price with no dish after it
    ['among its lines', 'Grill\nHalloumi steak\nVegetarian\n₪58.00\nCorn ribs\n₪34.00', ['# Grill', 'Halloumi steak 5800 [vegetarian]', 'Corn ribs 3400']],
    ['after the last price', 'Grill\nPork belly\n₪96.00\nHalloumi steak\n₪58.00\nVegetarian', ['# Grill', 'Pork belly 9600', 'Halloumi steak 5800 [vegetarian]']],
  ];
  for (const [label, text, expected] of cases) {
    const r = parseWoltText(text);
    assert.deepEqual(placed(r), expected, label);
    assert.equal(r.draft.dropped, 0, label);
    for (const n of r.notes.filter((x) => x.code === 'layout_guessed')) assert.equal(n.severity, 'check', label);
  }
});

test('allergens: a bare "Allergens" heading takes the next line as written', () => {
  const d = valid(parseWoltText('Soup\n₪30.00\nCreamy tomato soup\nAllergens\nGluten, milk\nAdd to order'));
  assert.deepEqual(d.sections[0]!.dishes[0]!.desc, { he: '', en: 'Creamy tomato soup' });
  assert.deepEqual(d.sections[0]!.dishes[0]!.allergens, { he: '', en: 'Gluten, milk' });
});

test('QA-L3: a bare "Allergens" with no list does not shift the lines after it', () => {
  const r = parseWoltText('Burger\n₪72.00\nBeef patty\nAllergens\nChoose a side\nRequired\nChoose 1\nFries\nSalad\nAdd to order');
  const d = valid(r);
  assert.deepEqual(outline(d), ['# תפריט / Menu (food)', 'Burger 7200 groups:Choose a side', '[Choose a side] single 1-1: Fries, Salad']);
  assert.deepEqual(d.sections[0]!.dishes[0]!.desc, { he: '', en: 'Beef patty' });
  assert.deepEqual(d.sections[0]!.dishes[0]!.allergens, { he: '', en: '' });
  assert.ok(r.notes.some((n) => n.code === 'noise' && n.rule === 'allergens'));
  // the line under it is a group's own heading with its rule under it: no list either
  const g = valid(parseWoltText('Burger\n₪72.00\nAllergens\nToppings\nOptional\nLettuce\nAdd to order'));
  assert.deepEqual(outline(g).slice(1), ['Burger 7200 groups:Toppings', '[Toppings] multiple ?-?: Lettuce']);
});

test('option groups: limits only when stated; options with no price are free; a rule over two lines', () => {
  const sheet = 'Pasta\n₪54.00\nChoose a sauce\nRequired\nChoose 1\nTomato\nCream\n+₪4.00\nToppings\nOptional\nParmesan\nBasil\n+₪2.00\nAdd to order';
  const d = valid(parseWoltText(sheet));
  assert.deepEqual(outline(d).slice(2), ['[Choose a sauce] single 1-1: Tomato, Cream +400', '[Toppings] multiple ?-?: Parmesan, Basil +200']);
  assert.deepEqual(exceptions(d, ['en']), ['limits_guessed@Toppings'], '"Optional" alone states no limits: the owner confirms them');
});

test('ASSUMPTION (tuning): a group heading is known by the rule line under it, or by its words', () => {
  // the first group of a sheet, with no rule line: its first line is taken as its heading
  const first = valid(parseWoltText('Pasta\n₪54.00\nToppings\nParmesan\nBasil\n+₪2.00\nAdd to order'));
  assert.deepEqual(outline(first).slice(2), ['[Toppings] multiple ?-?: Parmesan, Basil +200']);
  // QA-M5: a later heading with no rule line starts a new group when its words say so, never a ₪0 option
  const later = valid(parseWoltText('Pasta\n₪54.00\nChoose a sauce\nRequired\nTomato\n+₪4.00\nToppings\nBasil\n+₪2.00\nAdd to order'));
  assert.deepEqual(outline(later).slice(2), ['[Choose a sauce] single ?-?: Tomato +400', '[Toppings] multiple ?-?: Basil +200']);
  const two = valid(parseWoltText('Burger\n₪72.00\nChoose a side\nFries\nSalad\n+₪4.00\nChoose a sauce\nAioli\nKetchup\n+₪2.00\nAdd a drink?\nCola\n+₪8.00\nAdd to order'));
  assert.deepEqual(outline(two).slice(2), ['[Choose a side] multiple ?-?: Fries, Salad +400', '[Choose a sauce] multiple ?-?: Aioli, Ketchup +200', '[Add a drink?] multiple ?-?: Cola +800']);
  const he = valid(parseWoltText('המבורגר\n72.00 ₪\nבחרו תוספת\nצ׳יפס\nסלט\nבחרו רוטב\nאיולי\n+2.00 ₪\nהוספה להזמנה'));
  assert.deepEqual(outline(he).slice(2), ['[בחרו תוספת] multiple ?-?: צ׳יפס, סלט', '[בחרו רוטב] multiple ?-?: איולי +200']);
  // a heading's words with a price right under it are an option's name; on a listed dish's line they are a dish
  const opt = valid(parseWoltText('Burger\n₪72.00\nChoose a side\nRequired\nChoose 1\nChoose your own sauce\n+₪3.00\nAdd to order'));
  assert.deepEqual(outline(opt).slice(2), ['[Choose a side] single 1-1: Choose your own sauce +300']);
  const dish = valid(parseWoltText("Mains\nSoup\nClear broth\n₪30.00\nPick of the day\nChef's choice\n₪60.00"));
  assert.deepEqual(outline(dish), ['# Mains (food)', 'Soup 3000', 'Pick of the day 6000']);
});

test('QA-M5: "Required" or "Optional" alone states no limits: limits_guessed, never confirmed', () => {
  const d = valid(parseWoltText('Burger\n₪72.00\nToppings\nRequired\nLettuce\nTomato\nOnion\nAdd to order'));
  assert.deepEqual(outline(d).slice(2), ['[Toppings] single ?-?: Lettuce, Tomato, Onion']);
  assert.deepEqual(exceptions(d, ['en']), ['limits_guessed@Toppings']);
  const counted = valid(parseWoltText('Burger\n₪72.00\nToppings\nRequired\nChoose 1\nLettuce\nTomato\nAdd to order'));
  assert.deepEqual(exceptions(counted, ['en']), [], 'a count states the limits');
});

test('a nested choice only when the text shows it', () => {
  const plain = valid(parseWoltText('Burger\n₪72.00\nChoose a side\nRequired\nFries\nSalad\nChoose a sauce\nRequired\nAioli\nKetchup\nAdd to order'));
  assert.ok(plain.groups.every((g) => g.options.every((o) => o.opens === null)), 'a group after a group is not nested by itself');
  const nested = valid(parseWoltText('Burger\n₪72.00\nChoose a side\nRequired\nFries\nSalad\nSauce for fries\nRequired\nAioli\nAdd to order'));
  assert.deepEqual(outline(nested).slice(2), ['[Choose a side] single ?-?: Fries >Sauce for fries, Salad', '[Sauce for fries] single ?-?: Aioli']);
  assert.deepEqual(nested.sections[0]!.dishes[0]!.groups.map((g) => g.group), [nested.groups[0]!.key], 'the nested group hangs on its option, not on the dish');
  const r = parseWoltText('Burger\n₪72.00\nChoose a side\nRequired\nFries\nOnion rings › Choose a dip\nOptional\nMayo\nAdd to order');
  assert.ok(r.notes.some((n) => n.code === 'nesting_unmatched'), 'an option the dish does not show: a plain group, noted');
  assert.ok(valid(r).groups.every((g) => g.options.every((o) => o.opens === null)));
});

test('choices with no dish before them are left out and counted', () => {
  const r = parseWoltText('Choose a side\nRequired\nFries\nSalad\n+₪4.00\nMains\nSoup\n₪30.00');
  assert.deepEqual(outline(valid(r)), ['# Mains (food)', 'Soup 3000']);
  assert.ok(r.notes.some((n) => n.code === 'group_orphan'));
  assert.equal(r.draft.dropped, 5, 'the heading, its rule line, two options and a price');
});

test('a dish whose only price is on the sheet button takes it, with a check note', () => {
  const r = parseWoltText('Lemonade\nFresh lemons and mint\nAdd to order ₪18.00');
  assert.deepEqual(outline(valid(r)), ['# תפריט / Menu (food)', 'Lemonade 1800']);
  assert.ok(r.notes.some((n) => n.code === 'price_from_button' && n.severity === 'check'));
});

test('empty input: a valid empty draft and a note', () => {
  for (const s of ['', '\n \n\t', `${String.fromCodePoint(0x200f)}\n`]) {
    const r = parseWoltText(s);
    assert.deepEqual(valid(r), { v: 1, source: 'wolt_text', sections: [], groups: [], dropped: 0 });
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

test('QA-M3: noise rules match whole known lines only: a dish or a heading with noise words in it is kept', () => {
  const cases: Array<[string, string, string[]]> = [
    ['a name and its price on one line', 'Mains\nSoup\n₪30.00\nDelivery Burger₪52.00\nPickup Combo\n₪60.00\nWolt Special Wrap\n₪44.00',
      ['# Mains (food)', 'Soup 3000', 'Delivery Burger 5200', 'Pickup Combo 6000', 'Wolt Special Wrap 4400']],
    ['noise words with a price under them', 'Mains\nSoup\n₪30.00\nDelivery Box 2\n₪52.00\nShare\n₪60.00',
      ['# Mains (food)', 'Soup 3000', 'Delivery Box 2 5200', 'Share 6000']],
    ['a heading with hours in it', 'Mains\nSoup\n₪30.00\nBusiness lunch 12:00–16:00\nLunch schnitzel\n₪55.00\nLunch pasta\n₪49.00',
      ['# Mains (food)', 'Soup 3000', '# Business lunch 12:00–16:00 (food)', 'Lunch schnitzel 5500', 'Lunch pasta 4900']],
    ['the same in Hebrew', 'עיקריות\nמרק\n30.00 ₪\nעסקיות 12:00-17:00\nשניצל עסקית\n55.00 ₪',
      ['# עיקריות (food)', 'מרק 3000', '# עסקיות 12:00-17:00 (food)', 'שניצל עסקית 5500']],
    ['a "Special offer" section', 'Mains\nSoup\n₪30.00\nSpecial offer\nTwo pizzas\n₪80.00',
      ['# Mains (food)', 'Soup 3000', '# Special offer (food)', 'Two pizzas 8000']],
  ];
  for (const [label, text, expected] of cases) {
    const r = parseWoltText(text);
    assert.deepEqual(outline(valid(r)), expected, label);
    assert.equal(r.draft.dropped, 0, label);
    assert.ok(!r.notes.some((n) => n.code === 'noise'), `${label}: nothing read as noise`);
  }
  // the real ones still are: a fee is its words and its price, hours a line of their own
  for (const line of ['Delivery ₪9.90', 'Delivery fee: ₪9.90', '₪9.90 delivery', 'Delivery: free', 'Open until 23:00', 'Opens tomorrow at 10:00', 'א׳-ה׳ 10:00-22:00', '12:00-23:00']) {
    assert.match(rule(line), /^noise_/u, line);
  }
  assert.equal(rule('Special offer'), 'text');
});

test('QA-M2: a short description never becomes the name; a heading over a long name stays a heading', () => {
  const cases: Array<[string, string, string[]]> = [
    ['no section list', 'Mains\nSoup\n₪30.00\nMalabi\nHomemade\n₪26.00\nTart\nSeasonal\n₪25.00',
      ['# Mains (food)', 'Soup 3000', 'Malabi 2600 desc:Homemade', 'Tart 2500 desc:Seasonal']],
    ["the page's own sections", 'Imaginary Bistro\nMains\nDesserts\nMains\nSoup\n₪30.00\nDesserts\nMalabi\nHomemade\n₪26.00\nTart\nSeasonal fruit\n₪25.00',
      ['# Mains (food)', 'Soup 3000', '# Desserts (dessert)', 'Malabi 2600 desc:Homemade', 'Tart 2500 desc:Seasonal fruit']],
    ['Hebrew', 'ביסטרו דמיוני\nעיקריות\nקינוחים\nעיקריות\nמרק\n30.00 ₪\nקינוחים\nמלבי\nביתי\n26.00 ₪',
      ['# עיקריות (food)', 'מרק 3000', '# קינוחים (dessert)', 'מלבי 2600 desc:ביתי']],
    ['a heading, then a long name with no description', 'Mains\nSoup\n₪30.00\nDesserts\nChocolate cake with vanilla ice cream\n₪40.00\nMalabi\n₪26.00',
      ['# Mains (food)', 'Soup 3000', '# Desserts (dessert)', 'Chocolate cake with vanilla ice cream 4000', 'Malabi 2600']],
    ['the same in Hebrew', 'עיקריות\nמרק\n30.00 ₪\nקינוחים\nעוגת שוקולד עם גלידת וניל\n40.00 ₪',
      ['# עיקריות (food)', 'מרק 3000', '# קינוחים (dessert)', 'עוגת שוקולד עם גלידת וניל 4000']],
    ['a description with a price in it', 'Mains\nSoup\n₪30.00\nSchnitzel\nFamily size ₪120\n₪64.00',
      ['# Mains (food)', 'Soup 3000', 'Schnitzel 6400 desc:Family size ₪120']],
  ];
  for (const [label, text, expected] of cases) {
    const d = valid(parseWoltText(text));
    const withDesc = d.sections.flatMap((s) => [`# ${s.name.he || s.name.en} (${s.kind})`, ...s.dishes.map((x) => `${x.name.he || x.name.en} ${x.price}${x.desc.he || x.desc.en ? ` desc:${x.desc.he || x.desc.en}` : ''}`)]);
    assert.deepEqual(withDesc, expected, label);
  }
});

test('QA-M9 / security L4: a 60,000-character line, and thousands of groups of one name, stay fast and valid', () => {
  const rep = (s: string, n: number) => s.repeat(Math.ceil(n / s.length)).slice(0, n);
  for (const line of [rep('₪ ', 60_000), `a${rep('.', 60_000)}x`, `a${rep('.·…_–—-', 60_000)}x`, `₪${rep('1', 60_000)}x`, `delivery ${rep('1', 60_000)}x`,
    `a${rep('!', 60_000)}x`, `Falafel${rep(' (vegan)', 60_000)}`, `a${rep(' (for x', 60_000)}`, `${rep('Choose ', 60_000)}`, `Burger\n₪72.00\n${rep('Side › ', 60_000)}\nRequired\nFries`]) {
    const { ms, r } = fastest(() => parseWoltText(line));
    valid(r);
    assert.ok(ms < 100, `${line.slice(0, 12)}…: ${ms.toFixed(0)} ms`);
  }
  const groups = `Burger\n₪72.00\n${Array.from({ length: 3000 }, (_, i) => `Side\nRequired\nO${i.toString(36)}\n+₪1.00`).join('\n')}`;
  const { ms, r } = fastest(() => parseWoltText(groups));
  assert.equal(valid(r).groups.length, 1, 'one group of that name on the dish');
  assert.ok(ms < 1000, `${ms.toFixed(0)} ms`);
});

test('D33: the readers never fetch anything and name no Wolt address', () => {
  const dir = new URL('../src/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|wolt\.com/u.test(src), f);
  }
});

test('QA-M2 (round 2): a common section name with a line marked as a description under it is the dish', () => {
  const cases: Array<[string, string, string[]]> = [
    ['Coffee', 'Bakery\nCroissant\nButter, sea salt\n₪16.00\nCoffee\nDouble espresso, oat milk\n₪14.00\nTea\nMint, sage\n₪12.00',
      ['# Bakery', 'Croissant 1600 (Butter, sea salt)', 'Coffee 1400 (Double espresso, oat milk)', 'Tea 1200 (Mint, sage)']],
    ['Pasta', 'Mains\nRoast chicken\nHalf a chicken, potatoes\n₪78.00\nPasta\nFresh tagliatelle, sage butter\n₪56.00\nGnocchi\nPotato, brown butter\n₪54.00',
      ['# Mains', 'Roast chicken 7800 (Half a chicken, potatoes)', 'Pasta 5600 (Fresh tagliatelle, sage butter)', 'Gnocchi 5400 (Potato, brown butter)']],
    ['Breakfast, a description by its first word', 'Mornings\nGranola\nYoghurt, honey\n₪32.00\nBreakfast\nwith two eggs any style\n₪58.00',
      ['# Mornings', 'Granola 3200 (Yoghurt, honey)', 'Breakfast 5800 (with two eggs any style)']],
    ['Hebrew', 'מאפים\nקרואסון\nחמאה, מלח ים\n‏16.00 ₪\nקפה\nאספרסו כפול, חלב שיבולת\n‏14.00 ₪',
      ['# מאפים', 'קרואסון 1600 (חמאה, מלח ים)', 'קפה 1400 (אספרסו כפול, חלב שיבולת)']],
    ['the first lines of the copy', 'Pasta\nFresh tagliatelle, sage butter\n₪56.00\nGnocchi\nPotato, brown butter\n₪54.00',
      ['# תפריט', 'Pasta 5600 (Fresh tagliatelle, sage butter)', 'Gnocchi 5400 (Potato, brown butter)']],
    // a long name under a common heading, with nothing marking it as a description: the heading, checked
    ['a heading over a long name', 'Mains\nRoast chicken\n₪78.00\nDesserts\nPear and almond tart with cream\n₪38.00',
      ['# Mains', 'Roast chicken 7800', '# Desserts {layout_guessed:common_name@4}', 'Pear and almond tart with cream 3800 {layout_guessed:common_name@5}']],
    // three lines: the common name with a description under it is still the dish; a heading above it opens
    ['a heading, then the common name and its description', 'Mains\nRoast chicken\n₪78.00\nHot drinks\nCoffee\nDouble espresso, oat milk\n₪14.00',
      ['# Mains', 'Roast chicken 7800', '# Hot drinks', 'Coffee 1400 (Double espresso, oat milk)']],
  ];
  for (const [label, text, expected] of cases) {
    const r = parseWoltText(text);
    assert.deepEqual(placed(r), expected, label);
    assert.equal(r.draft.dropped, 0, label);
  }
});

test('QA-M3 (round 2): every reading rule desc_habit guesses is checked, on the dish and the section it decided', () => {
  const cases: Array<[string, string, string[]]> = [
    // the next dish has a description: these two lines are a name and its description, the dish checked
    ['a name and its description', 'Mains\nRoast chicken\nHalf a chicken, potatoes\n₪78.00\nOn the coals\nSkewers\n₪64.00\nLamb chops\nRosemary, garlic, salt\n₪112.00',
      ['# Mains', 'Roast chicken 7800 (Half a chicken, potatoes)', 'On the coals 6400 (Skewers) {layout_guessed:desc_habit@5}', 'Lamb chops 11200 (Rosemary, garlic, salt)']],
    ['the same in Hebrew', 'עיקריות\nעוף צלוי\nחצי עוף, תפוחי אדמה\n‏78.00 ₪\nמהגריל\nשיפודים\n‏64.00 ₪\nצלעות טלה\nרוזמרין, שום, מלח\n‏112.00 ₪',
      ['# עיקריות', 'עוף צלוי 7800 (חצי עוף, תפוחי אדמה)', 'מהגריל 6400 (שיפודים) {layout_guessed:desc_habit@5}', 'צלעות טלה 11200 (רוזמרין, שום, מלח)']],
    // no dish around has a description: a heading and a name, the section and the dish checked
    ['a heading and a name', 'Mains\nSoup\n₪30.00\nStew\n₪60.00\nFrom the oven\nFocaccia\n₪22.00\nFlatbread\n₪18.00',
      ['# Mains', 'Soup 3000', 'Stew 6000', '# From the oven {layout_guessed:desc_habit@6}', 'Focaccia 2200 {layout_guessed:desc_habit@7}', 'Flatbread 1800']],
  ];
  for (const [label, text, expected] of cases) {
    const r = parseWoltText(text);
    assert.deepEqual(placed(r), expected, label);
    assert.ok(r.notes.filter((n) => n.code === 'layout_guessed').every((n) => n.severity === 'check' && n.key !== null), label);
  }
});

test('QA-M1 (round 2): words with the letters of NIS or ILS in them are words, never prices', () => {
  const cases: Array<[string, string, string[]]> = [
    ['a section', 'Bar\nHouse lemonade\nMint, lemon\n₪22.00\nSignature cocktails\nNegroni twist\nGin, bitter, vermouth\n₪48.00\nMocktails\nVirgin mojito\nMint, lime, soda\n₪26.00',
      ['# Bar', 'House lemonade 2200 (Mint, lemon)', '# Signature cocktails', 'Negroni twist 4800 (Gin, bitter, vermouth)', '# Mocktails', 'Virgin mojito 2600 (Mint, lime, soda)']],
    ['dishes', 'Starters\nSnails\nGarlic butter, parsley\n₪56.00\nQuails\nCharcoal grilled, figs\n₪72.00\nOxtails\nBraised, polenta\n₪88.00',
      ['# Starters', 'Snails 5600 (Garlic butter, parsley)', 'Quails 7200 (Charcoal grilled, figs)', 'Oxtails 8800 (Braised, polenta)']],
  ];
  for (const [label, text, expected] of cases) {
    const r = parseWoltText(text);
    assert.deepEqual(placed(r), expected, label);
    assert.equal(r.draft.dropped, 0, label);
  }
  // an option named "Lentils" in a dish sheet is an option; the sheet goes on to its end
  const sheet = valid(parseWoltText('Bowls\nRice bowl\nEdamame, pickles\n₪52.00\nChoose a base\nRequired\nChoose 1\nRice\nLentils\nGreens\n+₪3.00\nAdd to order'));
  assert.deepEqual(outline(sheet).slice(1), ['Rice bowl 5200 groups:Choose a base', '[Choose a base] single 1-1: Rice, Lentils, Greens +300']);
  for (const line of ['Cocktails', 'Lentils', 'Snails', 'Anis', 'Tennis', 'Nisan', 'COCKTAILS']) assert.equal(rule(line), 'text', line);
  for (const line of ['NIS 42', '42 NIS', 'ILS 9.90']) assert.equal(rule(line), 'price', line);
});
