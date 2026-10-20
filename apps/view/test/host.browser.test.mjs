/* The host board in a headless Chromium: it loads, a table is seated from its sheet, a sped-up table runs out of time,
   the alert appears and stays, Extend clears it, a reload keeps the floor; in English on a phone with reduced motion the
   list puts the closest first, the rings have words, targets are 44 px and "Seen" keeps the table in the strip.
   Run: node --test test/host.browser.test.mjs   (needs the build: the page loads ../host.js) */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, listen, open, shot, VIEW } from './browser.mjs';

let srv, browser;
before(async () => { srv = await listen(7320); browser = await launch(); });
after(async () => { await browser.close(); srv.server.close(); });
const host = (q = '') => srv.origin + VIEW + 'host/?demo=olea&test=1' + q;
const rows = (page) => page.evaluate(() => Object.fromEntries(window.__host.rows().map((r) => [r.id, r.phase])));
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.trim());
const EVENING = new Date(2026, 9, 16, 20, 0);

test('loads alive, seats a table, a sped-up table runs out: the alert stays until Extend; a reload keeps the floor', async () => {
  /* at ×30 every second the test spends looking and clicking is half a minute of the evening, and a busy machine spends many:
     so the page's clock is the test's, standing still while it looks and running only when it is turned */
  const { page, errors, ctx } = await open(browser, host('&speed=30&lang=he'), { width: 1280, height: 800, clock: EVENING });
  await page.waitForSelector('.tb');
  assert.equal(await page.$eval('html', (e) => e.lang + '/' + e.dir), 'he/rtl');
  assert.equal(await page.$$eval('#floor .tb', (els) => els.length), 12);
  let r = await rows(page);
  assert.deepEqual([r.h1, r.w3, r.c2, r.h5, r.h2], ['seated', 'ending', 'seated', 'seated', 'free'], 'four tables are already seated, one is ending');
  assert.match(await page.$eval('.tb[data-id="h1"]', (e) => e.getAttribute('aria-label')), /^שולחן 1 · האולם · נשארו \d+ דקות, עד \d\d:\d\d · 4 סועדים$/, 'the ring in words');
  /* seat the free round table in the hall: the default frame is preselected */
  await page.click('.tb[data-id="h2"]'); await page.waitForSelector('#seatGo');
  assert.equal(await text(page, '#frameVal'), '90 דק׳'); assert.equal(await text(page, '#partyVal'), '2');
  await page.click('#partyInc'); await page.click('#frameInc'); assert.equal(await text(page, '#frameVal'), '105 דק׳');
  await page.click('#seatGo'); await page.waitForSelector('#sheet', { state: 'hidden' });
  let S = await page.evaluate(() => window.__host.state().tables.h2); assert.deepEqual([S.phase, S.party, S.minutes], ['seated', 3, 105]);
  /* w3 had four minutes; at ×30 its time is up after eight seconds of the page's clock, not before */
  await page.clock.runFor(7000); assert.equal((await rows(page)).w3, 'ending', 'seven seconds at ×30: three and a half minutes, still running');
  await page.clock.runFor(2000); await page.waitForSelector('.toast[role="alert"][data-id="w3"]');
  assert.match(await text(page, '.toast[data-id="w3"] b'), /^הזמן נגמר · שולחן 3 · ליד החלון$/);
  assert.equal((await rows(page)).w3, 'over'); assert.equal(await page.$eval('.tb[data-id="w3"]', (e) => e.dataset.phase), 'over');
  assert.ok((await page.title()).startsWith('● '), 'the tab says so');
  assert.equal(await page.$eval('#strip', (e) => e.hidden), false); assert.match(await text(page, '#strip'), /שולחן 3 · ליד החלון/);
  assert.equal(await page.evaluate(() => window.__host.state().tables.w3.alerted), true, 'alerted once');
  await shot(page, 'host-alert');
  /* Extend clears it */
  await page.click('.toast[data-id="w3"] [data-act="extend"]');
  assert.equal(await page.$('.toast[data-id="w3"]'), null); assert.notEqual((await rows(page)).w3, 'over');
  assert.ok(!(await page.title()).startsWith('● ')); assert.equal(await page.$eval('#strip', (e) => e.hidden), true);
  S = await page.evaluate(() => window.__host.state().tables.w3); assert.ok(S.extended >= 15, 'extended ' + S.extended);
  /* a reload keeps the floor (localStorage, versioned) */
  await page.reload(); await page.waitForSelector('.tb');
  assert.equal((await page.evaluate(() => window.__host.state().tables.h2)).party, 3);
  assert.ok(await page.evaluate(() => Object.keys(localStorage).includes('mana-host:v1:olea:x30')));
  assert.deepEqual(errors, []); await ctx.close();
});

test('English, a phone, the list, reduced motion: closest first, still rings, 44 px, words for every ring, Seen', async () => {
  const { page, errors, ctx } = await open(browser, host('&lang=en&view=list&motion=reduce'), { width: 390, height: 844, touch: true, reducedMotion: 'reduce' });
  await page.waitForSelector('.card');
  assert.equal(await page.$eval('html', (e) => e.lang + '/' + e.dir), 'en/ltr');
  const order = await page.$$eval('#listView .card', (els) => els.map((e) => e.dataset.id));
  assert.deepEqual(order.slice(0, 4), ['w3', 'c2', 'h1', 'h5'], 'the closest to its end first');
  assert.equal(await page.$eval('.card[data-id="w3"] .run', (e) => getComputedStyle(e).transitionDuration), '0s', 'reduced motion: the ring steps, it does not sweep');
  assert.match(await page.$eval('.card[data-id="w3"] .hitcard', (e) => e.getAttribute('aria-label')), /^Table 3 · By the window · (One minute|\d minutes) left, until \d\d:\d\d · 3 guests$/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'nothing overflows');
  const small = await page.$$eval('button', (els) => els.filter((e) => e.offsetParent && !e.classList.contains('hitcard')).map((e) => e.getBoundingClientRect()).filter((b) => b.height < 44 || b.width < 44).length);
  assert.equal(small, 0, 'every button is at least 44 px');
  /* the owner's settings: the default frame moves in steps of 5; a running seating keeps its own */
  await page.click('#gearBtn'); await page.waitForSelector('#setMinInc'); assert.equal(await text(page, '#setMinVal'), '90 min');
  await page.click('#setMinInc'); assert.equal(await text(page, '#setMinVal'), '95 min'); assert.equal(await page.evaluate(() => window.__host.state().settings.minutes), 95);
  assert.equal(await page.evaluate(() => window.__host.state().tables.h1.minutes), 90, 'a running seating keeps its frame');
  await page.keyboard.press('Escape'); await page.waitForSelector('#sheet', { state: 'hidden' });
  /* time is up; "Seen" puts the toast away but the strip keeps the table until the manager acts */
  await page.evaluate(() => window.__host.advance(5 * 60000)); await page.waitForSelector('.toast[data-id="w3"]');
  assert.equal(await page.$eval('.toast', (e) => e.getAttribute('role')), 'alert');
  assert.match(await text(page, '.toast b'), /^Time is up · Table 3 · By the window$/);
  assert.match(await page.$eval('.card[data-id="w3"] .hitcard', (e) => e.getAttribute('aria-label')), /Time was up 1 minutes ago|Time was up \d+ minutes ago/);
  await shot(page, 'host-phone-alert');
  await page.click('.toast [data-act="seen"]'); assert.equal(await page.$('.toast'), null);
  assert.equal(await page.$eval('#strip', (e) => e.hidden), false); assert.equal((await rows(page)).w3, 'over');
  assert.ok(!(await page.title()).startsWith('● '));
  /* the board frees it by itself after the grace period (10 minutes) */
  await page.evaluate(() => window.__host.advance(11 * 60000)); assert.equal((await rows(page)).w3, 'free'); assert.equal(await page.$eval('#strip', (e) => e.hidden), true);
  assert.deepEqual(errors, []); await ctx.close();
});
