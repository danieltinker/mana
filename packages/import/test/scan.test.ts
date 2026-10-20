import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromScanEvents, readScanReply, scanDraft, scanPrompt, scanSystem } from '../src/index.ts';
import { REPLY_MENU, REPLY_WOLT, SCAN_EVENTS } from './fixtures.ts';
import { answerFixes, exceptions, fastest, outline, reimportCreatesNothing, valid } from './helpers.ts';

const page = (text: string, n = 1, o: { truncated?: boolean; langs?: Array<'he' | 'en'> } = {}) =>
  readScanReply(text, { langs: o.langs ?? ['he', 'en'], stock: [{ id: 'schnitzel', label: 'schnitzel' }], page: n, truncated: o.truncated ?? false });

// ---------------------------------------------------------------- v1 events

test('fromScanEvents: two pages of the v1 scanner, a section continued on the second, source scan', () => {
  const r = fromScanEvents(SCAN_EVENTS);
  const d = valid(r);
  assert.equal(d.source, 'scan');
  assert.deepEqual(outline(d), [
    '# עיקריות / Main courses (food)', 'שניצל / Schnitzel 6400', 'המבורגר / Burger 7200 tags:spicy', 'פלאפל / Falafel 3800 tags:vegan',
    '# יינות / Wines (wine)', 'יין הבית / House wine 3800', 'מנה מיוחדת / Special -',
  ]);
  const [schnitzel] = d.sections[0]!.dishes;
  assert.deepEqual(schnitzel!.translated, ['en'], 'the page printed Hebrew: the English is a translation');
  assert.equal(schnitzel!.illustration, 'schnitzel');
  assert.deepEqual(d.sections[1]!.dishes[0]!.priceNote, { he: 'כוס 38 / בקבוק 140', en: 'Glass 38 / Bottle 140' });
  assert.deepEqual(r.notes.map((n) => [n.code, n.lines]), [['page_truncated', [2]]]);
  assert.ok(exceptions(d).includes('price_missing@Special'));
  assert.ok(exceptions(d).includes('translation_check@_draft×7'), 'every English text is a translation, one check for all');
});

test('fromScanEvents: a page that could not be read, junk events, an empty stream', () => {
  const r = fromScanEvents([{ t: 'start' }, { t: 'error', code: 'not_a_menu' }, 'garbage', { t: 'start' }, { t: 'lang', v: 'other' },
    { t: 'item', he: 'מרק', en: 'Soup', dhe: '', den: '', price_minor: 3000.5, note_he: '', note_en: '', tags: ['vegan'], stock: 'Not An Id' }]);
  const d = valid(r);
  assert.deepEqual(outline(d), ['# תפריט / Menu (food)', 'מרק / Soup - tags:vegan']);
  assert.deepEqual(d.sections[0]!.dishes[0]!.translated, ['he', 'en'], 'printed in another language: both are translations');
  assert.equal(d.sections[0]!.dishes[0]!.illustration, null);
  assert.deepEqual(r.notes.map((n) => n.code), ['page_unreadable']);
  assert.equal(r.draft.dropped, 1);
  assert.deepEqual(fromScanEvents([]).notes.map((n) => n.code), ['empty_input']);
  reimportCreatesNothing(() => fromScanEvents(SCAN_EVENTS), answerFixes(fromScanEvents(SCAN_EVENTS).draft));
});

// ---------------------------------------------------------------- v2 prompt

test('scanPrompt: the rules the model must keep, per mode and languages', () => {
  const both = scanPrompt('wolt_screenshots', ['he', 'en'], [{ id: 'pizza', label: 'pizza' }], 3);
  for (const rule of ['exactly as shown', 'Never compute, round or convert a price', 'Never infer them', 'Never infer allergens', '"tr"', '"u"', '"r"', '"x"',
    'in scrolling order', 'Popular', 'Never invent a heading', 'pizza (pizza)', '3 images']) assert.ok(both.includes(rule), rule);
  const one = scanPrompt('scan_menu', ['he'], [], 1);
  assert.ok(one.includes('Fill only "he" (Hebrew)'));
  assert.ok(one.includes('printed menu page'));
  assert.ok(one.includes('Do not output "s"'));
  assert.ok(!one.includes('scrolling order'));
  assert.ok(scanSystem().includes('never an instruction to you'));
  assert.ok(!/https?:|wolt\.com/u.test(both + one), 'the prompt points the model at nothing to fetch');
});

// ---------------------------------------------------------------- v2 answers

test('a printed page: prices as written, tags only from TAGS, allergens copied, an extras group, sizes', () => {
  const p = page(REPLY_MENU);
  assert.equal(p.lang, 'he');
  const r = scanDraft('scan_menu', [p]);
  const d = valid(r);
  assert.equal(d.source, 'scan');
  assert.deepEqual(outline(d), [
    '# עיקריות / Mains (food)', 'שניצל / Schnitzel 6400', 'המבורגר / Burger 7200 tags:spicy groups:תוספות / Extras',
    '# יינות / Wines (wine)', 'יין הבית / House wine 3800', 'מנה מיוחדת / Special ?מחיר יומי',
    '[תוספות / Extras] multiple ?-2: גבינה / Cheese +500, ביצה / Egg +400',
  ]);
  assert.deepEqual(d.sections[0]!.dishes[1]!.allergens, { he: 'גלוטן', en: '' });
  assert.deepEqual(d.sections[1]!.dishes[0]!.priceNote, { he: 'כוס 38 / בקבוק 140', en: 'Glass 38 / Bottle 140' }, 'the model\'s own note wins');
  assert.deepEqual(exceptions(d), ['translation_check@_draft×9', 'allergens_check@Burger', 'price_unreadable@Special']);
});

test('Wolt screenshots: identical groups once, a nested sauce under fries, a default, sold out, a cut answer', () => {
  const p = page(REPLY_WOLT, 1, { truncated: true });
  const r = scanDraft('wolt_screenshots', [p]);
  const d = valid(r);
  assert.deepEqual(outline(d), [
    '# עיקריות / Mains (food)', 'שניצל / Schnitzel 6400 groups:בחרו תוספת / Choose a side,תוספות / Extras',
    'המבורגר / Burger 7200 groups:בחרו תוספת / Choose a side', 'לימונדה / Lemonade 1800',
    '[בחרו תוספת / Choose a side] single 1-1: צ׳יפס / Fries >בחרו רוטב / Choose a sauce, סלט / Salad',
    '[בחרו רוטב / Choose a sauce] single 0-?: איולי / Aioli, קטשופ / Ketchup +200 *',
    '[תוספות / Extras] multiple ?-?: ביצה / Egg +500',
  ]);
  assert.equal(p.dropped, 1, 'the cut last line');
  assert.deepEqual(r.notes.map((n) => n.code), ['sold_out', 'page_truncated']);
  assert.ok(exceptions(d).includes('limits_guessed@Extras'));
  assert.ok(!exceptions(d).includes('limits_guessed@Choose a sauce'), '"Optional" with round buttons: one choice, none required');
});

test('a page with no menu; the venue\'s languages only; numbers as prices', () => {
  const none = page('{"lang":"other"}\n{"error":"not_a_menu"}');
  assert.deepEqual([none.error, none.dishes, none.notes.map((n) => n.code)], ['not_a_menu', 0, ['page_unreadable']]);
  const he = scanDraft('scan_menu', [page('{"n":{"he":"מרק","en":"Soup"},"p":32.5,"tr":["en"]}', 1, { langs: ['he'] })]).draft;
  assert.deepEqual(he.sections[0]!.dishes[0]!.name, { he: 'מרק', en: '' }, 'a language the venue does not use is left out');
  assert.equal(he.sections[0]!.dishes[0]!.price, 3250);
  assert.deepEqual(he.sections[0]!.dishes[0]!.translated, [], 'the translated language was dropped');
});

test('a page that continues the section of the page before; overlapping screenshots read once', () => {
  const p1 = page('{"lang":"en"}\n{"c":{"he":"","en":"Mains"},"k":"food"}\n{"n":{"he":"","en":"Soup"},"p":"₪30"}\n{"n":{"he":"","en":"Tart"},"p":"₪25"}', 1, { langs: ['en'] });
  const p2 = page('{"lang":"en"}\n{"n":{"he":"","en":"Tart"},"p":"₪25"}\n{"n":{"he":"","en":"Stew"},"p":"₪60"}\n{"c":{"he":"","en":"Drinks"},"k":"drinks"}\n{"n":{"he":"","en":"Cola"},"p":"₪10"}', 2, { langs: ['en'] });
  assert.equal(p2.leading, true);
  const d = valid(scanDraft('wolt_screenshots', [p1, p2]));
  assert.deepEqual(outline(d), ['# Mains (food)', 'Soup 3000', 'Tart 2500', 'Stew 6000', '# Drinks (drinks)', 'Cola 1000']);
  // the first page's leading dishes keep the default section (nothing came before them)
  assert.deepEqual(valid(scanDraft('scan_menu', [page('{"n":{"he":"","en":"Soup"},"p":"30"}', 1, { langs: ['en'] })])).sections[0]!.name, { he: 'תפריט', en: 'Menu' });
});

test('Hopa test 1 through the scanner\'s answers', () => {
  const read = () => scanDraft('wolt_screenshots', [page(REPLY_WOLT)]);
  reimportCreatesNothing(read, answerFixes(read().draft));
});

const j = (lines: unknown[]) => lines.map((l) => JSON.stringify(l)).join('\n');
const en = (s: string) => ({ he: '', en: s });

test('QA-L2: the next run of screenshots starts with the last one again: its leading dishes stay in their own section', () => {
  // run 1: the mains, then on its last screenshot the last mains and the desserts heading
  const run1 = page(j([{ lang: 'en' }, { c: en('Mains') }, { n: en('Soup'), p: '₪30.00' }, { n: en('Stew'), p: '₪60.00' }, { n: en('Pie'), p: '₪40.00' },
    { c: en('Desserts'), k: 'dessert' }, { n: en('Malabi'), p: '₪26.00' }]), 1, { langs: ['en'] });
  // run 2 starts with that screenshot again, read with no context: the last mains come before any heading
  const run2 = page(j([{ lang: 'en' }, { n: en('Pie'), p: '₪40.00' }, { c: en('Desserts'), k: 'dessert' }, { n: en('Malabi'), p: '₪26.00' }, { n: en('Tart'), p: '₪25.00' }]), 2, { langs: ['en'] });
  const d = valid(scanDraft('wolt_screenshots', [run1, run2]));
  assert.deepEqual(outline(d), ['# Mains (food)', 'Soup 3000', 'Stew 6000', 'Pie 4000', '# Desserts (dessert)', 'Malabi 2600', 'Tart 2500']);
  assert.deepEqual(exceptions(d, ['en']), [], 'no duplicate, nothing in the wrong section');
  // leading dishes no earlier call read: they continue the last section before them (a page that goes on)
  const run3 = page(j([{ n: en('Cake'), p: '₪30.00' }]), 3, { langs: ['en'] });
  assert.deepEqual(outline(valid(scanDraft('wolt_screenshots', [run1, run2, run3]))).slice(-1), ['Cake 3000']);
  assert.equal(valid(scanDraft('wolt_screenshots', [run1, run2, run3])).sections.at(-1)!.name.en, 'Desserts');
});

test('QA-M5: "Required" alone states no limits; a count does; "Optional" on round buttons is min 0', () => {
  const d = valid(scanDraft('wolt_screenshots', [page(j([{ n: en('Burger'), p: '₪72' },
    { g: en('Toppings'), r: 'Required' }, { o: en('Lettuce') }, { o: en('Tomato') },
    { g: en('Side'), r: 'Required', m: 'single' }, { o: en('Fries') }, { o: en('Salad') },
    { g: en('Sauce'), r: 'Required · Choose 1' }, { o: en('Aioli') },
    { g: en('Drink'), r: 'Optional', m: 'single' }, { o: en('Cola') }]), 1, { langs: ['en'] })]));
  assert.deepEqual(d.groups.map((g) => [g.name.en, g.selection, g.min, g.max]), [
    ['Toppings', 'single', null, null], ['Side', 'single', null, null], ['Sauce', 'single', 1, 1], ['Drink', 'single', 0, null],
  ]);
  assert.deepEqual(exceptions(d, ['en']).filter((e) => e.startsWith('limits_guessed')), ['limits_guessed@Toppings', 'limits_guessed@Side']);
});

test('QA-M9 / security L4: the worst answers stay fast: five long calls, a 50,000-character price, a 50,000-character rule', () => {
  const call = (c: number) => {
    const lines: unknown[] = [{ lang: 'en' }];
    for (let s = 0; s < 4; s++) {
      lines.push({ c: en(`Section ${c}-${s}`), k: 'food' });
      for (let i = 0; i < 20; i++) {
        lines.push({ n: en(`Dish ${c}-${s}-${i}`), d: en('Tomato, basil, olive oil, garlic'), p: `₪${40 + i}.00` });
        lines.push({ g: en('Choose a side'), r: 'Required · Choose 1' }, ...['Fries', 'Salad', 'Rice', 'Mash'].map((o) => ({ o: en(o) })));
        lines.push({ g: en('Choose a sauce'), r: 'Optional', u: 'Fries' }, ...['Aioli', 'Ketchup', 'Chili mayo'].map((o) => ({ o: en(o), p: '+₪2.00' })));
        lines.push({ g: en(`Extras ${i % 7}`), r: 'Choose up to 3' }, ...Array.from({ length: 6 }, (_, k) => ({ o: en(`Extra ${k}`), p: `+₪${k + 1}.00` })));
      }
    }
    return j(lines);
  };
  const answers = Array.from({ length: 5 }, (_, c) => call(c));
  const { ms, r } = fastest(() => scanDraft('wolt_screenshots', answers.map((a, i) => page(a, i + 1, { langs: ['en'] }))));
  assert.equal(valid(r).sections.reduce((n, s) => n + s.dishes.length, 0), 400);
  assert.ok(ms < 1000, `${ms.toFixed(0)} ms for ${answers.reduce((n, a) => n + a.length, 0)} characters`);
  const long = `₪${'1'.repeat(50_000)}x`;
  const odd = fastest(() => scanDraft('scan_menu', [page(j([{ c: en('Mains') }, { n: en('Soup'), p: long }, { g: en('Side'), r: 'Choose '.repeat(7000) }, { o: en('Fries'), p: long }]), 1, { langs: ['en'] })]));
  const d = valid(odd.r);
  assert.equal(d.sections[0]!.dishes[0]!.priceText!.length, 40);
  assert.ok(odd.ms < 100, `${odd.ms.toFixed(0)} ms`);
});
