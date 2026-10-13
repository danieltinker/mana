/* Builds Olea's site and reads the HTML: every dish in both languages, prices in ₪, sold out, allergens, the demo and AI
   labels, Hebrew first with the English toggle, JSON-LD from the snapshot only, and not one load from outside. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, render, price, LABEL } from '../build.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../..');
const MENU = join(ROOT, 'view/demo/olea/menu.json'), OUT = join(HERE, '../out/.test-olea');
const menu = JSON.parse(readFileSync(MENU, 'utf8'));

test('prices are whole shekels, or two decimals, always with ₪', () => {
  assert.equal(price(3800), '₪38'); assert.equal(price(3850), '₪38.50'); assert.equal(price(5), '₪0.05'); assert.equal(price(16800), '₪168');
});

test('Olea builds: one HTML file and the pictures it shows', () => {
  rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });
  const r = build(MENU, OUT, { menuUrl: 'https://halom.io/m/olea' });
  assert.ok(existsSync(r.out)); assert.ok(r.pictures >= 30); assert.ok(r.bytes < 120 * 1024, 'the page stays small: ' + r.bytes);
  assert.ok(existsSync(join(OUT, 'img/labaneh.jpg'))); assert.ok(existsSync(join(OUT, 'img/labaneh_t.jpg')));
});

const html = () => readFileSync(join(OUT, 'index.html'), 'utf8');

test('every dish and section is on the page, in Hebrew and in English', () => {
  const h = html();
  for (const c of menu.categories) { assert.ok(h.includes(c.name.he), c.name.he); assert.ok(h.includes(c.name.en), c.name.en);
    for (const it of c.items) { assert.ok(h.includes(it.name.he), it.name.he); assert.ok(h.includes(it.name.en), it.name.en); assert.ok(h.includes(price(it.price.amount)), it.id + ' price'); } }
  assert.equal((h.match(/<article class="dish/g) || []).length, menu.categories.reduce((n, c) => n + c.items.length, 0));
});

test('sold out, allergens, notes, the AI label on generated dishes', () => {
  const h = html();
  const sold = menu.categories.flatMap((c) => c.items).filter((it) => it.available === false);
  assert.ok(sold.length >= 1);
  for (const it of sold) assert.match(h, new RegExp('id="d-' + it.id + '"[^]*?<span class="badge"><span class="he" lang="he">אזל</span><span class="en" lang="en">Sold out</span>'));
  assert.equal((h.match(/class="dish sold"/g) || []).length, sold.length);
  assert.ok(h.includes('אלרגנים: חלב')); assert.ok(h.includes('Allergens: Milk'));
  assert.ok(h.includes('<small><span class="he" lang="he">כוס</span><span class="en" lang="en">glass</span></small>'));
  assert.ok(h.includes(LABEL.aiHe) && h.includes(LABEL.aiEn));
  assert.ok(h.includes(LABEL.demoHe) && h.includes(LABEL.demoEn));
  assert.ok(h.includes('Nahal Shakedim · Lavan · 2024'));
});

test('Hebrew first, RTL, with the English toggle and no outside load', () => {
  const h = html();
  assert.match(h, /^<!doctype html>\s*<html lang="he" dir="rtl">/);
  assert.ok(h.includes('id="lang"')); assert.ok(h.includes('html[lang=he] .en,html[lang=en] .he{display:none}'));
  const loads = [...h.matchAll(/(?:src|href)="([^"]+)"|url\(([^)]+)\)|@import\s+[^;]+/g)].map((m) => m[1] || m[2] || m[0]);
  for (const u of loads) assert.ok(!/^(https?:)?\/\//.test(u) || /^https:\/\/(halom\.io\/|example\.com\/olea$)/.test(u), 'outside URL: ' + u);
  assert.equal((h.match(/<link /g) || []).length, 1); assert.ok(h.includes('<link rel="icon" href="data:,">'));   // the only <link> is the empty icon
  assert.equal((h.match(/<script/g) || []).length, 2);                                                            // JSON-LD and the language pill
  assert.ok(!/<iframe|<video|fonts\.googleapis|cdn\./.test(h));
  assert.ok(h.includes('<meta name="robots" content="noindex">'));                                                   // a preview until the owner says so
  assert.ok(h.includes('href="https://halom.io/m/olea"'));
  assert.ok(h.includes('href="https://example.com/olea"'));                                                         // the order link from the snapshot
  assert.ok(h.includes('href="https://halom.io/mana/view/seat/?demo=olea"'), 'the demo\'s Book button opens the seat map demo');
  { const noBook = render({ ...menu, slug: 'y', business: { ...menu.business, bookUrl: null } }, { demo: false, base: dirname(MENU) }).html; assert.ok(!noBook.includes('להזמין שולחן'), 'no Book button without business.bookUrl'); }
});

test('JSON-LD: Restaurant + Menu from the snapshot only', () => {
  const h = html(), m = h.match(/<script type="application\/ld\+json">([^]*?)<\/script>/);
  const ld = JSON.parse(m[1]);
  assert.equal(ld['@type'], 'Restaurant'); assert.equal(ld.name, 'אוליאה'); assert.equal(ld.alternateName, 'Olea');
  assert.equal(ld.servesCuisine, 'ביסטרו שכונתי'); assert.equal(ld.address.streetAddress, 'סמטת הזית 4');
  assert.equal(ld.telephone, undefined); assert.equal(ld.openingHours, undefined); assert.equal(ld.acceptsReservations, undefined);   // not in the snapshot: not invented
  assert.equal(ld.hasMenu.hasMenuSection.length, menu.categories.length);
  const labaneh = ld.hasMenu.hasMenuSection[0].hasMenuItem[0];
  assert.equal(labaneh.name, 'לאבנה וזיתים'); assert.equal(labaneh.offers.price, '38.00'); assert.equal(labaneh.offers.priceCurrency, 'ILS');
  assert.ok(ld.hasMenu.hasMenuSection[0].hasMenuItem.some((i) => i.offers.availability === 'https://schema.org/SoldOut'));
});

test('a snapshot with bookUrl, phone and hours gets the Book button and the info fields; one without stays silent', () => {
  const withAll = { ...menu, slug: 'x', business: { ...menu.business, bookUrl: 'https://ontopo.example/olea', phone: '03-1234567', hours: { he: 'א׳–ה׳ 12:00–23:00', en: 'Sun–Thu 12:00–23:00' } } };
  const { html: h } = render(withAll, { base: dirname(MENU) });
  assert.ok(h.includes('href="https://ontopo.example/olea"')); assert.ok(h.includes('Book a table')); assert.ok(h.includes('tel:031234567')); assert.ok(h.includes('Sun–Thu 12:00–23:00'));
  assert.ok(!h.includes(LABEL.aiEn), 'no AI label on a real restaurant');
  const bad = { ...withAll, business: { ...withAll.business, bookUrl: 'javascript:alert(1)' } };
  assert.ok(!render(bad, { base: dirname(MENU) }).html.includes('javascript:'));
  const { html: h2 } = render({ ...menu, slug: 'y', business: { ...menu.business, phone: null, area: null } }, { base: dirname(MENU) });
  assert.ok(!h2.includes('<h2><span class="he" lang="he">איפה')); assert.ok(!h2.includes('tel:'));
  assert.throws(() => render({ v: 2 }), /v1 menu snapshot/);
});
