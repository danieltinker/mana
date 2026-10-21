// The fix round after the QA's fourth review: the menu to approve read in full (QA-M4), the night the clocks go back
// (L6), prices as typed (L10), a stale refusal never blaming the owner and Halom's own change recognised (QA-M1, L4),
// the production entry carrying config.ts alone (L1), and the img-src a demo or local build opens (QA-M4, pictures).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ID, cafeDemo } from '@mana/contracts/fixtures';
import { type ActForOwnerInput, type SnapshotV2 } from '@mana/contracts';
import { STORAGE_PATH, assetUrl, bucketLabel, countWord, daysWords, limitWords, pictureOf, readMenu, secondOccurrence, storageOf, wordsText } from '../../src/v2/model.ts';
import { alreadySo, parsePrice, staleNow } from '../../src/v2/act-model.ts';
import type { Fail } from '../../src/v2/api.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('the menu to approve, read in full (QA-M4): both languages, notes, tags, allergens, add-ons with limits and nesting, rules in words', () => {
  const s = cafeDemo() as unknown as { sections: { dishes: Record<string, unknown>[] }[]; assetBase: string };
  const burger = s.sections[1]!.dishes[0]!;
  Object.assign(burger, { desc: { he: 'בקר', en: 'Beef' }, allergens: { he: 'גלוטן', en: 'gluten' }, details: { grape: 'Merlot', year: 2021, nested: { a: 1 } },
    asset: { state: 'photo', color: 'c/b.png', thumb: 'c/b_t.png' } });
  (burger.price as { note: { he: string; en: string } }).note = { he: 'עם תוספת', en: 'with a side' };
  const m = readMenu(s as unknown as SnapshotV2, 'https://example.invalid/storage/v1/object/public/menu-public/');
  assert.deepEqual(m.sections.map((x) => x.name.en), ['Breakfast', 'Mains', 'Drinks', 'Pastries']);
  assert.equal(wordsText(m.sections[0]!.when!), 'Breakfast (every day 07:00–12:00)', 'a section shown only in some hours says so');
  assert.deepEqual(m.sections[0]!.when, [{ name: 'Breakfast' }, ' (every day 07:00–12:00)'], 'the schedule\'s name is its own piece (SEC-N13)');
  const b = m.sections[1]!.dishes[0]!;
  assert.deepEqual([b.name, b.desc, b.priceNote, b.allergens, b.price], [{ he: 'המבורגר', en: 'Burger' }, { he: 'בקר', en: 'Beef' }, { he: 'עם תוספת', en: 'with a side' },
    { he: 'גלוטן', en: 'gluten' }, 6800]);
  assert.deepEqual(b.details, [['grape', 'Merlot'], ['year', '2021']], 'plain values only');
  assert.deepEqual(b.picture, { kind: 'photo', label: 'a photo', src: 'https://example.invalid/storage/v1/object/public/menu-public/c/b_t.png' });
  assert.deepEqual(b.related.map((r) => r.en), ['Lemonade', 'Schnitzel']);
  // add-ons: the dish's own limits, every option with its price, the one nesting level
  const [side, extras] = b.addons;
  assert.deepEqual([side!.name.en, side!.min, side!.max, side!.selection], ['Side', 1, 1, 'single']);
  const fries = side!.options[0]!;
  assert.deepEqual([fries.name.en, fries.price, fries.default, fries.opens?.name.en, fries.opens?.options.map((o) => [o.name.en, o.price])],
    ['Fries', 0, true, 'Sauce', [['Aioli', 0], ['Ketchup', 0], ['Chipotle', 200]]]);
  assert.ok(fries.opens!.options.every((o) => o.opens === null), 'an opened group opens nothing (one level)');
  assert.deepEqual([extras!.min, extras!.max, extras!.options[0]!.maxQty], [0, 3, 2]);
  assert.equal(limitWords(1, 1), 'choose 1');
  assert.equal(limitWords(0, 3), 'up to 3');
  assert.equal(limitWords(1, 3), '1 to 3');
  // tags and the library illustration
  const croissant = m.sections[3]!.dishes[0]!;
  assert.deepEqual(croissant.tags, ['vegetarian']);
  assert.deepEqual(croissant.picture, { kind: 'stock', label: 'an illustration from Mana’s library, labelled as one for guests', src: '../stock/img/croissant_t.jpg' });
  assert.equal(wordsText(m.sections[3]!.dishes[1]!.when!), 'Friday (Fri 07:00–15:00)');
  // the rules, in words; every owner name its own piece (each in its own <bdi> on screen: SEC-N13)
  assert.deepEqual(m.rules.map((r) => wordsText(r.words)), [
    'When a guest adds “Espresso”, every day 07:00–11:00, unless their table has anything from Pastries: suggest “Croissant”. Priority 50, at most once a visit.',
    'When a guest opens the sheet of “Burger”, any time: suggest the add-on “Cheese” (Extras). Priority 40, at most 2 times a visit.',
    'When a guest opens “my table” with a dish from “Mains”, any time, unless their table has anything from Drinks: suggest “Lemonade”. Priority 30, at most once a visit.',
  ]);
  assert.deepEqual(m.rules[0]!.line, { he: 'קרואסון חם ליד הקפה?', en: 'A warm croissant with your coffee?' });
  assert.deepEqual(m.rules[1]!.words.filter((w) => typeof w !== 'string'), [{ name: 'Burger' }, { name: 'Cheese' }, { name: 'Extras' }]);
  // the block at the top (QA-L3)
  assert.deepEqual([m.venue.name.en, m.venue.cuisine.en, m.venue.logo, m.venue.orderUrl, m.venue.phone, m.venue.table.look, m.venue.soldOut],
    ['Café Demo', 'Café', null, null, null, 'the “oak” table', 'bottom']);
});

test('the block guests see at the top (QA-L3): logo, links, phone and the owner\'s table photo, pictures from the own storage only (SEC-N14)', () => {
  const base = 'https://p.supabase.co/storage/v1/object/public/menu-public/';
  const s = cafeDemo() as unknown as { assetBase: string; venue: Record<string, unknown>; theme: Record<string, unknown> };
  s.assetBase = base;
  Object.assign(s.venue, { logo: 'v/logo.png', orderUrl: 'https://order.example.invalid/x', bookUrl: 'https://book.example.invalid/x', phone: '+972-3-000-0000' });
  Object.assign(s.theme, { surface: 'custom', tableImg: 'v/table.jpg' });
  const v = readMenu(s as unknown as SnapshotV2, base).venue;
  assert.deepEqual(v.logo, { kind: 'logo', label: 'the logo', src: `${base}v/logo.png` });
  assert.deepEqual(v.table, { look: 'the owner’s own table photo', photo: { kind: 'table', label: 'the owner’s table photo', src: `${base}v/table.jpg` } });
  assert.deepEqual([v.orderUrl, v.bookUrl, v.phone], ['https://order.example.invalid/x', 'https://book.example.invalid/x', '+972-3-000-0000']);
  // another project's storage, or another bucket of this one: never loaded
  for (const other of ['https://other.supabase.co/storage/v1/object/public/menu-public/', 'https://p.supabase.co/storage/v1/object/public/elsewhere/']) {
    s.assetBase = other;
    const w = readMenu(s as unknown as SnapshotV2, base);
    assert.equal(w.venue.logo?.src, null, other);
    assert.equal(w.venue.table.photo?.src, null, other);
  }
  assert.equal(storageOf('https://p.supabase.co'), base);
  assert.equal(storageOf('http://127.0.0.1:54321/'), 'http://127.0.0.1:54321/storage/v1/object/public/menu-public/');
  assert.equal(storageOf('javascript:alert(1)'), null);
  assert.equal(storageOf(undefined), null);
});

test('pictures: only the revision\'s own storage, plain relative paths; a relief is "a relief from one photo"', () => {
  const base = 'https://p.supabase.co/storage/v1/object/public/menu-public/';
  assert.equal(assetUrl(base, 'v/a_t.png', base), `${base}v/a_t.png`);
  for (const bad of ['../x.png', '/x.png', 'https://evil.example/x.png', 'a/../../x.png', 'a b.png', 'javascript:alert(1)', '', 'a//b.png']) assert.equal(assetUrl(base, bad, base), null, bad);
  assert.equal(assetUrl('javascript:alert(1)/', 'x.png', base), null);
  assert.equal(assetUrl('https://p.example/no-slash', 'x.png', base), null);
  assert.equal(assetUrl(null, 'x.png', base), null);
  // SEC-N14: a snapshot's assetBase that is not this environment's own storage is refused, whatever it looks like
  assert.equal(assetUrl('https://evil.example/storage/v1/object/public/menu-public/', 'x.png', base), null);
  assert.equal(assetUrl(base, 'x.png', null), null, 'no configured storage: nothing is loaded');
  assert.deepEqual(pictureOf({ state: 'relief', color: 'c.png', aux: 'a.png', thumb: 't.png', kind: 'flat', e: 1, h: 1, o: null, s: null }, base, base),
    { kind: 'relief', label: 'a relief from one photo', src: `${base}t.png` });
  assert.equal(pictureOf({ state: 'stock', id: '../../x' }, base, base)?.src, null);
  assert.equal(pictureOf(null, base, base), null);
  assert.equal(daysWords([0, 1, 2, 3, 4]), 'Sun–Thu');
  assert.equal(daysWords([5, 6]), 'Fri, Sat');
  assert.equal(daysWords([]), 'every day');
  assert.equal(countWord(5), 'five');
  assert.equal(countWord(12), '12');
});

test('the night the clocks go back (L6): the second 01:xx is marked in the long labels and the table', () => {
  // 25 Oct 2026: 02:00 IDT → 01:00 IST. 22:30Z on the 24th is 01:30 IDT; 23:30Z is 01:30 IST, the second one
  assert.equal(bucketLabel('2026-10-24T22:30:00.000Z', 'minute'), '01:30');
  assert.equal(bucketLabel('2026-10-24T23:30:00.000Z', 'minute'), '01:30', 'the axis keeps the wall clock');
  assert.equal(bucketLabel('2026-10-24T22:30:00.000Z', 'minute', true), '25 Oct, 01:30');
  assert.equal(bucketLabel('2026-10-24T23:30:00.000Z', 'minute', true), '25 Oct, 01:30 (2nd, after the clocks went back)');
  const long: string[] = [];
  for (let t = Date.parse('2026-10-24T21:58:00Z'); t <= Date.parse('2026-10-25T00:02:00Z'); t += 60_000) long.push(bucketLabel(new Date(t).toISOString(), 'minute', true));
  assert.equal(new Set(long).size, long.length, 'no long label twice');
  assert.equal(secondOccurrence(Date.parse('2026-10-25T09:00:00Z')), false);
  assert.equal(secondOccurrence(Date.parse('2026-03-27T00:30:00Z')), false, 'the spring change repeats nothing');
});

test('prices as typed (L10): digits and one decimal separator only', () => {
  assert.equal(parsePrice('54'), 5400);
  assert.equal(parsePrice(' 54.5 '), 5450);
  assert.equal(parsePrice('54,50'), 5450);
  assert.equal(parsePrice(''), null);
  for (const bad of ['1e3', '0x10', '-2', '5.', '.5', '5.555', '1,000.00', '١٢', 'Infinity', 'NaN', '5 4']) assert.equal(parsePrice(bad), undefined, bad);
});

test('a stale refusal never says who changed it; Halom\'s own change is recognised by its value (QA-M1, L4)', () => {
  const stale = (current: Record<string, unknown>, action = 'dish.update'): Fail => ({ ok: false, kind: 'refused', code: 'stale', message: 'm', reply: { ok: false, code: 'stale', action, current } });
  const input = { venueId: ID.venue, reason: 'Owner asked by phone', action: 'dish.update', payload: { dishId: ID.burger, patch: { price: 7700 }, expectedUpdatedAt: '2026-10-16T09:00:00.123456+00:00' } } as ActForOwnerInput;
  assert.equal(staleNow(stale({ price: 7400, hidden: false })), 'Now the price in the owner’s menu is ₪74 and it is shown to guests.');
  assert.doesNotMatch(staleNow(stale({ price: 7400, hidden: false }))!, /owner changed|the owner has/i);
  assert.equal(alreadySo(stale({ price: 7400, hidden: false }), input), null, 'another value: a real refusal');
  assert.match(alreadySo(stale({ price: 7700, hidden: false }), input)!, /^Already so: the price in the owner’s menu is ₪77 and it is shown to guests\. The change is in place/);
  const step = { venueId: ID.venue, reason: 'Owner asked', action: 'onboarding.set', payload: { step: 'photos', state: 'skipped', expectedUpdatedAt: null } } as ActForOwnerInput;
  assert.match(alreadySo(stale({ step: 'photos', state: 'skipped', blockers: [], updatedAt: 'x' }, 'onboarding.set'), step)!, /^Already so: the step is skipped/);
  assert.equal(alreadySo({ ok: false, kind: 'refused', code: 'owner_declined', message: 'm' }, input), null);
});

test('the production entry (app.js) holds config.ts and no other contract module (L1)', async () => {
  const { build } = await import('esbuild');
  const { JS } = await import(path.join(ROOT, 'tools/esbuild-options.mjs')) as { JS: Record<string, unknown> };
  const bundle = async (entry: string) => (await build({ ...JS, entryPoints: [path.join(ROOT, entry)], write: false, logLevel: 'silent' })).outputFiles[0]!.text;
  const app = await bundle('src/entry.js');
  const v1 = await bundle('src/main.jsx');
  assert.match(app, /schema_env_mismatch/, 'the flags are there');
  // every string the other contract modules set up at load (that v1 does not have of its own) stays out of app.js
  const CONTRACTS = path.join(ROOT, '../../packages/contracts/src');
  let told = 0;
  for (const mod of ['common.ts', 'enums.ts', 'events.ts', 'staff.ts', 'ops.ts', 'rpc.ts']) {
    // as string literals in the bundle (quoted), not as parts of longer ones ('time_invalid' in 'realtime_invalid')
    const has = (code: string, x: string) => ['"', "'", '`'].some((q) => code.includes(`${q}${x}${q}`));
    const literals = [...readFileSync(path.join(CONTRACTS, mod), 'utf8').matchAll(/'([a-z][a-z0-9_.]{5,})'/g)].map((m) => m[1]!).filter((x) => !has(v1, x));
    told += literals.length;
    assert.deepEqual(literals.filter((x) => has(app, x)), [], `app.js carries ${mod}`);
  }
  assert.ok(told > 50, `enough strings to tell (${told})`);
});

test('img-src for a demo or local build: the environment\'s own menu bucket added, nothing else; production\'s page untouched', async () => {
  const csp = await import(path.join(ROOT, 'tools/csp.mjs')) as { withStorageImages: (h: string, o: string) => string; STORAGE_PATH: string };
  const { withStorageImages } = csp;
  assert.equal(csp.STORAGE_PATH, STORAGE_PATH, 'the build tool and the page name the same bucket');
  const prod = readFileSync(path.join(ROOT, 'src/index.html'), 'utf8');
  assert.match(prod, /img-src 'self' data:;/, 'production: its own origin and data: only');
  const demo = withStorageImages(prod, 'https://project.supabase.co');
  const bucket = 'https://project.supabase.co/storage/v1/object/public/menu-public/';
  assert.ok(demo.includes(`img-src 'self' data: ${bucket};`), 'the bucket, not the whole host (SEC-N14)');
  assert.equal(demo.replace(` ${bucket};`, ';'), prod, 'only img-src changed');
  assert.equal(withStorageImages(demo, 'https://project.supabase.co/storage/v1/'), demo, 'once; a path given is ignored');
  assert.ok(withStorageImages(prod, 'http://127.0.0.1:54321').includes("img-src 'self' data: http://127.0.0.1:54321/storage/v1/object/public/menu-public/;"));
  assert.throws(() => withStorageImages(prod, 'javascript:alert(1)'));
  assert.throws(() => withStorageImages('<p>no policy</p>', 'https://p.example'));
});
