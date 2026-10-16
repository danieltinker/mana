import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromScanEvents, readScanReply, scanDraft, scanPrompt, scanSystem } from '../src/index.ts';
import { REPLY_MENU, REPLY_WOLT, SCAN_EVENTS } from './fixtures.ts';
import { answerFixes, exceptions, outline, reimportCreatesNothing, valid } from './helpers.ts';

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
