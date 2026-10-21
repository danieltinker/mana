import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, PRICE_TEXT_MAX } from '@mana/contracts';
import { amount, readOptionPrice, readPrice, splitPrice } from '../src/index.ts';
import { hasMoney } from '../src/price.ts';

const RLM = String.fromCodePoint(0x200f);

test('amount: numbers as menus write them, in agorot, never a float', () => {
  assert.equal(amount('62'), 6200);
  assert.equal(amount('62.5'), 6250);
  assert.equal(amount('62,50'), 6250, 'a decimal comma');
  assert.equal(amount('1,250'), 125000, 'thousands');
  assert.equal(amount('1,250.50'), 125050);
  assert.equal(amount('0'), 0);
  assert.equal(amount('00042'), 4200);
  assert.equal(amount('12.500'), null, 'ambiguous: refused');
  assert.equal(amount('12345678'), null, 'more than 7 digits');
  assert.equal(amount(String(LIMITS.price / 100 + 1)), null, 'past LIMITS.price');
  assert.equal(amount('4O'), null);
});

test('readPrice: every shape a Wolt page shows (a currency is required there)', () => {
  const one = (s: string) => readPrice(s, false);
  for (const s of ['₪42.00', '42.00 ₪', '42 ₪', '₪ 42', '42₪', '42 ש"ח', '42 ש״ח', 'ILS 42', '42 NIS', `${RLM}42.00 ₪`.replace(RLM, '')]) {
    assert.deepEqual(one(s), { kind: 'one', agorot: 4200 }, s);
  }
  assert.deepEqual(one('from ₪42.00'), { kind: 'several', agorot: 4200, note: 'from ₪42.00' });
  assert.deepEqual(one('החל מ-42 ₪'), { kind: 'several', agorot: 4200, note: 'החל מ-42 ₪' });
  assert.deepEqual(one('₪42.00–₪58.00'), { kind: 'several', agorot: 4200, note: '₪42.00–₪58.00' }, 'a range: the first price');
  assert.deepEqual(one('42-58 ₪'), { kind: 'several', agorot: 4200, note: '42-58 ₪' });
  assert.deepEqual(one('₪36.00 ₪42.00'), { kind: 'discount', agorot: 4200 }, 'a discount beside the regular price: the regular one');
  assert.deepEqual(one('₪36.00₪42.00'), { kind: 'discount', agorot: 4200 });
  assert.deepEqual(one('₪ 4O'), { kind: 'unreadable', text: '₪ 4O' });
  assert.deepEqual(one('₪--'), { kind: 'unreadable', text: '₪--' });
  for (const s of ['42', '9.2', '12-14', '38 / 140', 'Delivery ₪9.90', 'Schnitzel', '']) assert.equal(one(s), null, s);
});

test('readPrice: a pasted menu or a printed page may leave the currency out', () => {
  assert.deepEqual(readPrice('42', true), { kind: 'one', agorot: 4200 });
  assert.deepEqual(readPrice('62,50', true), { kind: 'one', agorot: 6250 });
  assert.deepEqual(readPrice('38 / 140', true), { kind: 'several', agorot: 3800, note: '38 / 140' });
  assert.deepEqual(readPrice('12-14', true), { kind: 'several', agorot: 1200, note: '12-14' });
  assert.equal(readPrice('Coke 330ml', true), null);
});

test('readPrice: an unreadable price keeps at most PRICE_TEXT_MAX characters of what was shown', () => {
  const r = readPrice(`₪ ${'O'.repeat(10)}`, false);
  assert.equal(r?.kind, 'unreadable');
  assert.ok(r?.kind === 'unreadable' && r.text.length <= PRICE_TEXT_MAX);
});

test('readOptionPrice: "+₪5.00" and its shapes; "Free" is 0; an unreadable one keeps its text', () => {
  for (const s of ['+₪5.00', '+ ₪5', '+5.00 ₪', '₪5.00+', '+5', '+5 ש"ח']) assert.equal(readOptionPrice(s)?.agorot, 500, s);
  assert.deepEqual(readOptionPrice('Free'), { agorot: 0, text: 'Free' });
  assert.deepEqual(readOptionPrice('חינם'), { agorot: 0, text: 'חינם' });
  assert.deepEqual(readOptionPrice('+₪ 5O'), { agorot: null, text: '+₪ 5O' });
  for (const s of ['₪5.00', '+ extra', 'Fries']) assert.equal(readOptionPrice(s), null, s);
});

test('splitPrice: a name and its price on one line', () => {
  const at = (s: string, bare: boolean) => { const r = splitPrice(s, bare); return r && { text: r.text, price: r.price, option: r.option }; };
  assert.deepEqual(at('Schnitzel 64', true), { text: 'Schnitzel', price: { kind: 'one', agorot: 6400 }, option: false });
  assert.equal(at('Schnitzel 64', false), null, 'a Wolt page always shows the currency');
  assert.deepEqual(at('Schnitzel₪64.00', false)?.text, 'Schnitzel', 'copied text that runs the name and price together');
  assert.deepEqual(at('Schnitzel …… 64', true)?.text, 'Schnitzel');
  assert.deepEqual(at('Schnitzel - 64', true)?.text, 'Schnitzel');
  assert.deepEqual(at('Wine 38 / 140', true)?.price, { kind: 'several', agorot: 3800, note: '38 / 140' });
  assert.deepEqual(at('₪64 Schnitzel', true)?.text, 'Schnitzel', 'a right-to-left copy');
  assert.deepEqual(at('Fries +₪5.00', false), { text: 'Fries', price: { kind: 'one', agorot: 500 }, option: true });
  assert.deepEqual(at('Kids burger ₪ 4O', true), { text: 'Kids burger', price: { kind: 'unreadable', text: '₪ 4O' }, option: false });
  assert.deepEqual(at('שניצל 64.00 ₪', false)?.price, { kind: 'one', agorot: 6400 });
  for (const s of ['Coke 330ml', 'Pizza 4 cheeses', '12 14']) assert.equal(at(s, true), null, s);
  // QA-L4: a range or "from" on the name's line
  assert.deepEqual(at('Funghi ₪46–62', true), { text: 'Funghi', price: { kind: 'several', agorot: 4600, note: '₪46–62' }, option: false });
  assert.deepEqual(at('Margherita 42-58', true)?.price, { kind: 'several', agorot: 4200, note: '42-58' });
  assert.deepEqual(at('Calzone from 50', true)?.price, { kind: 'several', agorot: 5000, note: 'from 50' });
  // the reader is told when no currency was shown, and what the price token was
  assert.deepEqual([splitPrice('Combo 1 45', true)?.bare, splitPrice('Combo 1 45', true)?.token], [true, '45']);
  assert.equal(splitPrice('Burger ₪72', true)?.bare, false);
});

test('QA-M1: numbers without a currency are prices only when they look like menu prices', () => {
  for (const s of ['03-5551234', '2026-10-16', '0541234567', '12345', '58-42']) assert.equal(readPrice(s, true), null, s);
  assert.deepEqual(readPrice('12-14', true), { kind: 'several', agorot: 1200, note: '12-14' });
  assert.equal(readPrice('03-5551234 ₪', true)?.kind, 'several', 'with a shekel sign, the source said it is a price');
});

test('QA-M9 / security L4: every price rule reads a bounded text, in time linear in the line', () => {
  const rep = (s: string, n: number) => s.repeat(Math.ceil(n / s.length)).slice(0, n);
  const t0 = process.cpuUsage();
  for (const s of [rep('₪ ', 60_000), `a${rep('.', 60_000)}x`, `a${rep('.', 60_000)}1x`, `${rep('1', 60_000)}x`, `₪${rep('1', 60_000)}x`, `${rep('1', 60_000)}₪x`,
    `a${rep('.·…_–—-', 60_000)}x`, rep('+₪', 60_000), `${rep(' 1', 60_000)}x`, rep('1/', 60_000)]) {
    assert.equal(readPrice(s, true), null);
    assert.equal(readOptionPrice(s), null);
    splitPrice(s, true);
    hasMoney(s);
  }
  const c = process.cpuUsage(t0);
  assert.ok((c.user + c.system) / 1000 < 300, `${(c.user + c.system) / 1000} ms for ten 60,000-character lines`);
  assert.equal(hasMoney('Delivery ₪9.90'), true);
  assert.equal(hasMoney('Delivery Box 2'), false);
});
