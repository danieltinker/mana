import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalize, matchStock, explainStock, searchStock, stockLabels, stockAsset } from '../match.js';
import { run } from './fixture-report.mjs';

const here = (p) => new URL(p, import.meta.url);
const manifest = JSON.parse(fs.readFileSync(here('../stock.json'), 'utf8'));
const withCat = { ...manifest, items: manifest.items.map((e) => (['pizza', 'burger', 'salad', 'pasta'].includes(e.id) ? { ...e, cat: true } : e)) };
const noCat = { ...manifest, items: manifest.items.map((e) => ({ ...e, cat: false })) };
const m = (name_he, name_en = '', category_he = '', category_en = '') => matchStock(withCat, { name_he, name_en, category_he, category_en });
const ids = new Set(manifest.items.map((e) => e.id));

test('normalize: niqqud, quotes, final letters, punctuation', () => {
  assert.equal(normalize('פִּיצָה  מרגריטה!'), 'פיצה מרגריטה');
  assert.equal(normalize('צ׳יזבורגר “כפול”'), 'ציזבורגר כפול');
  assert.equal(normalize('סלטים'), 'סלטימ');
  assert.equal(normalize('Crème brûlée — 42₪'), 'crème brûlée 42');
});

test('names: exact, plural, construct, prefix, both languages', () => {
  assert.equal(m('פיצה מרגריטה'), 'pizza');
  assert.equal(m('פיצות'), 'pizza');
  assert.equal(m('הפיצה של סבתא'), 'pizza');
  assert.equal(m('', 'Classic Burger'), 'burger');
  assert.equal(m('המבורגר טלה'), 'burger');
  assert.equal(m('צ׳יזבורגר'), 'burger');
  assert.equal(m('', 'Cheeseburgers'), 'burger');
  assert.equal(m('סלט קצוץ'), 'salad');
  assert.equal(m('חומוס גרגרים'), 'hummus');
  assert.equal(m('שקשוקה חריפה', 'Spicy shakshuka'), 'shakshuka');
  assert.equal(m('עוגת גבינה באסקית'), 'cheesecake');
  assert.equal(m('מיץ תפוזים סחוט'), 'orange-juice');
  assert.equal(m('פפרדלה סלמון'), 'pasta');
});

test('the more specific and the earlier key wins', () => {
  assert.equal(m('', 'Burger with side salad'), 'burger');
  assert.equal(m('', 'Salad with pasta'), 'salad');
  assert.equal(explainStock(withCat, { name_en: 'Orange juice' }).key, 'orange juice');
});

test('nothing fitting means no picture', () => {
  assert.equal(m('שולחן שף'), null);                     // (the starter's example here, "בוקר טוב זלמן", is a breakfast plate, and the library now has one)
  assert.equal(m('', 'Chef special'), null);
  assert.equal(m(''), null);
  assert.equal(m('חומוסיה'), null, 'a longer different word is not the key');
  assert.equal(m('', 'pizzeria'), null);
});

test('category fallback only for entries marked cat', () => {
  assert.equal(m('ביאנקה', 'Bianca', 'פיצות', 'Pizzas'), 'pizza');
  assert.equal(explainStock(withCat, { name_he: 'ביאנקה', category_he: 'פיצות' }).via, 'category');
  assert.equal(m('קלאסי', '', 'המבורגרים'), 'burger');
  assert.equal(matchStock(noCat, { name_he: 'ביאנקה', category_he: 'פיצות' }), null, 'without the cat mark the category is ignored');
  assert.equal(m('חומוס', '', 'פיצות'), 'hummus', 'a name match beats the category');
});

test('search for the picker', () => {
  assert.deepEqual(searchStock(manifest, '').map((x) => x.id), manifest.items.map((e) => e.id));
  assert.equal(searchStock(manifest, 'piz')[0].id, 'pizza');
  assert.equal(searchStock(manifest, 'פיצ')[0].id, 'pizza');
  assert.equal(searchStock(manifest, 'מיץ')[0].id, 'orange-juice');
  assert.deepEqual(searchStock(manifest, 'zzzz'), []);
  assert.equal(searchStock(manifest, 'קפה', 3).length, 3, 'the limit is kept');
  assert.ok(searchStock(manifest, 'קפה').slice(0, 4).some((x) => x.id === 'cappuccino'), 'a ^key is still a word to search by');
  assert.equal(searchStock(manifest, 'wine')[0].id.endsWith('-wine'), true);
});

test('labels for the AI helpers and assets for the viewer', () => {
  const l = stockLabels(manifest);
  assert.equal(l.length, manifest.items.length);
  assert.deepEqual(l.find((x) => x.id === 'pizza'), { id: 'pizza', label: 'Pizza / פיצה' });
  const a = stockAsset(manifest, 'orange-juice', 'https://x.test/projects/menus/stock/');
  assert.equal(a.state, 'relief'); assert.equal(a.kind, 'stand'); assert.equal(a.color, 'https://x.test/projects/menus/stock/img/orange-juice.jpg'); assert.ok(Array.isArray(a.o));
  assert.equal(stockAsset(manifest, 'nope', 'https://x.test/'), null);
});

/* ---------------------------------------------------------------- v2: the grown library ---------------------------------------------------------------- */
const mm = (name_he, name_en = '', category_he = '', category_en = '') => matchStock(manifest, { name_he, name_en, category_he, category_en });

test('the manifest: the contract\'s shape, the starter ids, every file where it says', () => {
  assert.equal(manifest.v, 1);
  assert.deepEqual(manifest.label, { he: 'להמחשה בלבד', en: 'Illustration' });
  const GROUPS = ['hot-drinks', 'cold-drinks', 'cocktails', 'wine', 'beer', 'breakfast', 'bakery', 'starters', 'salads', 'soups', 'pizza', 'pasta', 'burgers', 'sandwiches', 'meat', 'chicken', 'fish', 'asian', 'sides', 'desserts'];
  for (const id of ['pizza', 'hummus', 'burger', 'salad', 'pasta', 'shakshuka', 'cheesecake', 'orange-juice']) assert.ok(ids.has(id), 'starter id ' + id);
  assert.equal(ids.size, manifest.items.length, 'ids are unique');
  let last = 0;
  const png = (f) => { const b = fs.readFileSync(here('../' + f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
  const jpg = (f) => { const b = fs.readFileSync(here('../' + f)); let i = 2; while (i < b.length) { const mk = b[i + 1], len = b.readUInt16BE(i + 2); if (mk >= 0xc0 && mk <= 0xc2) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; i += 2 + len; } return [0, 0]; };
  for (const e of manifest.items) {
    assert.match(e.id, /^[a-z0-9][a-z0-9-]{0,39}$/);
    const g = GROUPS.indexOf(e.group); assert.ok(g >= last, e.id + ': groups in picker order'); last = g;
    assert.ok(e.name.he && e.name.en, e.id + ': a name in both languages');
    assert.ok(e.keys.some((k) => /[א-ת]/.test(k)) && e.keys.some((k) => /[a-z]/.test(k)), e.id + ': match words in both languages');
    assert.equal(e.color, `img/${e.id}.jpg`); assert.equal(e.aux, `img/${e.id}.png`); assert.equal(e.thumb, `img/${e.id}_t.jpg`);
    assert.deepEqual(jpg(e.color), [768, 768], e.id + ' colour'); assert.deepEqual(png(e.aux), [512, 512], e.id + ' aux'); assert.deepEqual(jpg(e.thumb), [256, 256], e.id + ' thumb');
    assert.ok(['flat', 'low', 'medium', 'tall', 'stand'].includes(e.kind), e.id + ' kind');
    assert.ok(e.e >= 35 && e.e <= 55 && e.h > 0.02 && e.h < 2.2, e.id + ' numbers');
    if (e.kind === 'stand') { assert.ok(Array.isArray(e.o) && e.o.length === 2 && e.s > 0.2 && e.s <= 1, e.id + ' stands: o and s'); } else { assert.equal(e.o, null); assert.equal(e.s, null); }
    assert.ok(e.src === 'base' || e.src === 'drawn', e.id + ' src');
  }
  assert.ok(manifest.items.length >= 50 && manifest.items.length <= 80);
});

test('what comes with the dish does not choose the picture', () => {
  assert.equal(mm('פילה בקר ביין אדום'), 'steak');
  assert.equal(mm('מולים ביין לבן'), null);
  assert.equal(mm('אגסים ביין אדום'), null);
  assert.equal(mm('קפה ועוגה'), 'cappuccino');
  assert.equal(mm('המבורגר + צ׳יפס + שתייה'), 'burger');
  assert.equal(mm('שניצל (מוגש עם צ׳יפס)'), 'schnitzel');
  assert.equal(mm('', 'Hummus with falafel'), 'hummus');
  assert.equal(mm('ירקות בקארי צהוב'), 'curry', '"in curry" still is a curry when nothing else names the dish');
  assert.equal(mm('בירה מהחבית'), 'beer');
});

test('Hebrew names the dish first, English names it last', () => {
  assert.equal(mm('סלט פסטה'), 'salad');
  assert.equal(mm('', 'Pasta salad'), 'salad');
  assert.equal(mm('עוגת קפה'), 'cake');
  assert.equal(mm('', 'Coffee cake'), 'cake');
  assert.equal(mm('', 'Steak sandwich'), 'sandwich');
  assert.equal(mm('', 'Egg salad sandwich'), 'sandwich');
  assert.equal(mm('חומוס שווארמה', 'Hummus Shawarma'), 'hummus', 'the Hebrew name decides');
  assert.equal(mm('', 'Glass of white wine'), 'white-wine');
  assert.equal(mm('', 'Soup of the day'), 'soup');
});

test('a ^key counts only when it leads the name', () => {
  assert.equal(mm('קפה'), 'cappuccino');
  assert.equal(mm('ליקר קפה'), null);
  assert.equal(mm('', 'Irish coffee'), null);
  assert.equal(mm('לבנה עם זעתר'), 'labaneh');
  assert.equal(mm('גבינה לבנה'), null);
  assert.equal(mm('כוס יין אדום'), 'red-wine');
  assert.equal(mm('טוסט'), 'toast');
  assert.equal(mm('אבוקדו טוסט'), null);
  assert.equal(mm('פרנץ׳ טוסט'), 'french-toast');
});

test('a dish the library has no picture of gets none, and "not" rules an entry out', () => {
  assert.equal(mm('ריזוטו פירות ים', 'Seafood risotto'), null);
  assert.equal(mm('קרפצ׳יו דג', 'Fish carpaccio'), null);
  assert.equal(mm('', 'Spring rolls'), null);
  assert.equal(mm('לחם שום', 'Garlic bread', 'פיצות', 'Pizza'), null, 'not even from its category');
  assert.equal(mm('סטייק כרובית', 'Cauliflower steak'), null);
  assert.equal(mm('', 'California roll'), 'sushi', 'a key that names the dish itself still counts');
  assert.equal(mm('טופו בקארי אדום'), 'curry');
  assert.equal(mm('סטייק אנטריקוט'), 'steak');
});

test('a category that lists several things gives no picture by itself', () => {
  assert.equal(mm('אסיה', 'Asia', 'פיצה, פסטה ועוד', 'Pizza, pasta and more'), null);
  assert.equal(mm('מאפה', '', 'קפה ומאפה', 'Coffee & pastry'), null);
  assert.equal(mm('מרגריטה', '', 'קוקטיילים'), 'cocktail');
  assert.equal(mm('מרגריטה', '', 'פיצות'), 'pizza');
  assert.equal(mm('גמלא', '', 'יינות אדומים'), 'red-wine');
  assert.equal(mm('שנין בלאן', '', 'יינות לבנים'), 'white-wine');
  assert.equal(mm('פלאפל קטן', '', 'ליד החומוס', 'Next to the hummus'), 'falafel');
  assert.equal(mm('ביצה קשה', '', 'ליד החומוס', 'Next to the hummus'), null, '"next to the hummus" is not hummus');
});

test('the fixture: 287 menu names, each gets the expected picture or none', () => {
  const r = run(manifest);
  assert.ok(r.rows >= 150);
  const bad = [...r.wrong, ...r.spurious, ...r.missed].map((x) => `${x.name} [${x.category}] expected ${x.want}, got ${x.got}`);
  assert.deepEqual(bad, [], 'see node tools/fixture-report.mjs');
});
