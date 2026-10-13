/* The seat map in a headless Chromium: area → table → request → the owner approves (and declines with a reason), by mouse
   and by keyboard only; the Book button in the Olea menu opens it. Run: node --test test/seat.browser.test.mjs
   Needs the build (npm run build): the page loads ../seat.js. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, listen, open, shot, VIEW } from './browser.mjs';

let srv, browser;
before(async () => { srv = await listen(0); browser = await launch(); });
after(async () => { await browser.close(); srv.server.close(); });
const seat = (q = '') => srv.origin + VIEW + 'seat/?demo=olea&test=1' + q;
const S = (page) => page.evaluate(() => window.__seat.state());
const requests = (page) => page.evaluate(() => window.__seat.store.list(window.__seat.layout));
const text = (page, sel) => page.$eval(sel, (el) => el.textContent.trim());
const has = (page, sel, token) => page.$eval(sel, (el, tk) => el.classList.contains(tk), token);
const active = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.id ? '#' + a.id : a.tagName + (a.dataset.zone ? '[data-zone=' + a.dataset.zone + ']' : '')) : ''; });
/* keyboard only: press Tab until the focus lands on the control (never more than max presses) */
async function tabTo(page, want, max = 24) { for (let i = 0; i < max; i++) { if ((await active(page)) === want) return; await page.keyboard.press('Tab'); } throw new Error('Tab never reached ' + want + ' (at ' + (await active(page)) + ')'); }

test('a guest picks an area, then a table, sends a request; the plan follows; the owner approves it and the guest sees it', async () => {
  const { page, errors, ctx } = await open(browser, seat());
  await page.waitForSelector('#next');
  assert.equal(await page.$eval('html', (e) => e.lang + '/' + e.dir), 'he/rtl');
  assert.equal(await page.$$eval('#plan .table', (els) => els.length), 12); assert.equal(await page.$$eval('#plan .zone', (els) => els.length), 4);
  assert.equal(await page.$eval('#plan', (e) => getComputedStyle(e).opacity), '1', 'with ?test=1 the plan is simply there');
  /* step 1: three guests */
  await page.click('#partyPlus'); assert.equal(await text(page, '.party-n'), '3');
  assert.ok(await has(page, '#plan .table[data-id="w1"]', 'dim'), 'a table for two is dimmed for three'); assert.ok(!await has(page, '#plan .table[data-id="w3"]', 'dim'));
  assert.ok(await has(page, '#plan .zone[data-id="bar"]', 'dim'), 'the bar has no table to book');
  await page.click('#next'); assert.equal((await S(page)).G.step, 2);
  /* step 2: an area; the one with nothing for three is disabled */
  assert.equal(await page.$eval('[data-zone="bar"]', (b) => b.disabled), true); assert.equal(await page.$eval('#next', (b) => b.disabled), true);
  await page.click('[data-zone="window"]'); assert.ok(await has(page, '#plan .zone[data-id="window"]', 'on')); assert.equal(await page.$eval('[data-zone="window"]', (b) => b.getAttribute('aria-checked')), 'true');
  await page.click('#next'); assert.equal((await S(page)).G.step, 3);
  /* step 3: a table in it (only the ones that fit), by a tap on the plan */
  assert.deepEqual(await page.$$eval('#tableList [role="option"]', (els) => els.map((e) => e.dataset.table)), ['', 'w3', 'w4']);
  await page.click('#plan .table[data-id="w4"]'); assert.equal((await S(page)).G.table, 'w4'); assert.ok(await has(page, '#plan .table[data-id="w4"]', 'on')); assert.equal(await page.$eval('#opt-w4', (e) => e.getAttribute('aria-selected')), 'true');
  await page.click('#opt-w3'); assert.equal((await S(page)).G.table, 'w3'); assert.ok(!await has(page, '#plan .table[data-id="w4"]', 'on'));
  await page.click('#next'); assert.equal((await S(page)).G.step, 4);
  /* step 4: fictional details, said so; a note; send */
  assert.equal(await text(page, '.demo-fill'), 'פרטים בדויים, לדוגמה'); assert.equal(await page.$eval('#name', (e) => e.value), 'דנה לוי');
  await page.fill('#note', 'ליד החלון אם אפשר'); await page.click('#send');
  await page.waitForSelector('#sentTitle'); assert.equal(await text(page, '#sentTitle'), 'הבקשה נשלחה'); assert.equal(await active(page), '#sentTitle', 'the focus moves to what happened');
  let list = await requests(page); assert.equal(list.length, 1); assert.deepEqual([list[0].status, list[0].zone, list[0].table, list[0].party, list[0].note], ['pending', 'window', 'w3', 3, 'ליד החלון אם אפשר']);
  assert.ok(await has(page, '#plan .table[data-id="w3"]', 'on'), 'the plan keeps showing the asked-for table');
  await shot(page, 'seat-sent');
  /* the owner, in the same browser: the request waits, the plan shows it; approve */
  await page.click('#ownerLink'); await page.waitForSelector('#approve');
  assert.equal(await text(page, '.req b'), 'דנה לוי'); assert.ok(await has(page, '#plan .table[data-id="w3"]', 'on'));
  await page.click('#approve'); list = await requests(page); assert.equal(list[0].status, 'approved'); assert.equal(list[0].table, 'w3');
  assert.equal(await page.$eval('.req .badge', (e) => e.textContent), 'אושרה'); assert.equal(await page.$('#approve'), null, 'approved: nothing more to approve');
  await shot(page, 'seat-owner');
  /* back to the guest: confirmed, with the table */
  await page.click('#guestLink'); await page.waitForSelector('#sentTitle'); assert.equal(await text(page, '#sentTitle'), 'השולחן שלכם מאושר'); assert.match(await text(page, '.sent'), /שולחן 3 · ליד החלון/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('keyboard only, in English: the whole flow; the owner moves the party to another table, then declines a second request with a reason', async () => {
  const { page, errors, ctx } = await open(browser, seat('&lang=en'));
  await page.waitForSelector('#next'); assert.equal(await page.$eval('html', (e) => e.lang + '/' + e.dir), 'en/ltr');
  await tabTo(page, '#partyPlus'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter'); assert.equal(await text(page, '.party-n'), '4');
  await tabTo(page, '#next'); await page.keyboard.press('Enter'); assert.equal((await S(page)).G.step, 2);
  await tabTo(page, 'BUTTON[data-zone=hall]'); await page.keyboard.press('Space'); assert.equal((await S(page)).G.zone, 'hall');
  await tabTo(page, '#next'); await page.keyboard.press('Enter'); assert.equal((await S(page)).G.step, 3);
  await tabTo(page, '#tableList'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); assert.equal((await S(page)).G.table, 'h2');
  assert.equal(await page.$eval('#tableList', (e) => e.getAttribute('aria-activedescendant')), 'opt-h2'); assert.equal(await active(page), '#tableList', 'the list keeps the focus while the choice moves');
  await page.keyboard.press('Enter'); assert.equal((await S(page)).G.step, 4);
  assert.equal(await page.$eval('#name', (e) => e.value), 'Dana Levi');
  await tabTo(page, '#send'); await page.keyboard.press('Enter'); await page.waitForSelector('#sentTitle');
  let list = await requests(page); assert.deepEqual([list[0].zone, list[0].table, list[0].party, list[0].name], ['hall', 'h2', 4, 'Dana Levi']); assert.equal(await text(page, '#sentTitle'), 'Request sent');
  /* the owner swaps: h2 → h1, which also fits four; the guest sees table 1 */
  await tabTo(page, '#ownerLink'); await page.keyboard.press('Enter'); await page.waitForSelector('#swap');
  await tabTo(page, '#swap'); await page.keyboard.press('Enter'); await page.waitForSelector('#swapSel');
  assert.deepEqual(await page.$$eval('#swapSel option', (os) => os.map((o) => o.value)), ['w3', 'w4', 'h1', 'h2'], 'only tables that seat four');
  await page.selectOption('#swapSel', 'h1'); assert.ok(await has(page, '#plan .table[data-id="h1"]', 'on'), 'the plan previews the move');
  await tabTo(page, '#swapOk'); await page.keyboard.press('Enter'); list = await requests(page); assert.deepEqual([list[0].status, list[0].table], ['approved', 'h1']);
  await page.click('#guestLink'); await page.waitForSelector('#sentTitle'); assert.match(await text(page, '.sent'), /Table 1 · The hall/);
  /* a second request, declined with a reason the guest reads */
  await page.click('#again'); await page.waitForSelector('#next'); assert.equal(await page.$('#sentTitle'), null);
  await page.evaluate(() => window.__seat.set({ step: 4, zone: 'corner', table: null, party: 2 })); await page.click('#send'); await page.waitForSelector('#sentTitle');
  list = await requests(page); assert.equal(list.length, 2); assert.equal(await text(page, '#sentTitle'), 'Request sent');
  await page.click('#ownerLink'); await page.waitForSelector('#decline'); assert.equal(await text(page, '.eyebrow'), 'Pending · 1');
  await page.click('#decline'); await page.waitForSelector('#reason'); assert.equal(await active(page), '#reason');
  await page.click('#declineOk'); assert.equal(await page.$eval('#reason', (e) => e.getAttribute('aria-invalid')), 'true', 'no reason, no decline'); assert.equal((await requests(page)).filter((r) => r.status === 'pending').length, 1);
  await page.fill('#reason', 'Full at that hour; 21:30 is free'); await page.click('#declineOk');
  list = await requests(page); const d = list.find((r) => r.status === 'declined'); assert.ok(d); assert.equal(d.reason, 'Full at that hour; 21:30 is free'); assert.equal(await page.$('#decline'), null);
  await page.click('#guestLink'); await page.waitForSelector('#sentTitle'); assert.equal(await text(page, '#sentTitle'), 'The restaurant could not confirm'); assert.match(await text(page, '.sent .reason'), /Full at that hour/);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the Book button in the Olea menu opens the seat map (never a host in a demo); a layout nobody has is said plainly', async () => {
  const { page, errors, ctx } = await open(browser, srv.origin + VIEW + '?demo=olea&test=1&gl=skip&lang=he#c=starters&i=labaneh&o=1');
  await page.evaluate(() => window.__mana.ready);
  const links = await page.$$eval('a.book', (as) => as.map((a) => ({ hidden: a.hidden, href: a.getAttribute('href'), text: a.textContent, target: a.target })));
  assert.equal(links.length, 2); links.forEach((l) => { assert.equal(l.hidden, false); assert.equal(l.text, 'להזמנת שולחן'); assert.equal(l.target, ''); assert.ok(/\/seat\/\?demo=olea&lang=he$/.test(l.href), l.href); });
  await page.evaluate(() => window.__mana.setLang('en')); assert.equal(await page.$eval('#cardMore a.book', (a) => a.textContent + ' ' + a.getAttribute('href')), 'Book a table ' + srv.origin + VIEW + 'seat/?demo=olea&lang=en');
  await shot(page, 'seat-book-button');
  await page.click('#cardMore a.book'); await page.waitForSelector('#plan .table'); assert.ok(page.url().includes('/seat/?demo=olea'));
  assert.equal(await page.$$eval('#plan .table', (els) => els.length), 12);
  await page.goto(seat('&lang=he').replace('demo=olea', 'demo=kiosk')); await page.waitForSelector('#sheet h2'); assert.equal(await text(page, '#sheet h2'), 'אין כאן מפת ישיבה.'); assert.equal(await page.$eval('#planWrap', (e) => e.hidden), true);
  assert.deepEqual(errors, []); await ctx.close();
});

test('reduced motion and a phone: the plan is still, one glass sheet, 44 px targets, nothing overflows', async () => {
  const { page, errors, ctx } = await open(browser, seat('&motion=reduce').replace('&test=1', ''), { width: 390, height: 844, touch: true, reducedMotion: 'reduce' });
  await page.waitForSelector('#next');
  assert.equal(await page.$eval('#plan', (e) => getComputedStyle(e).opacity), '1'); assert.equal(await page.$eval('#plan .wall', (e) => getComputedStyle(e).transitionDuration), '0s');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  assert.equal(await page.$$eval('[style*="backdrop-filter"], .sheet', (els) => els.filter((e) => getComputedStyle(e).backdropFilter && getComputedStyle(e).backdropFilter !== 'none').length), 0, 'on a phone the sheet is tint only');
  const small = await page.$$eval('button, a.link, [role="option"]', (els) => els.filter((e) => !e.hidden && e.offsetParent).map((e) => e.getBoundingClientRect()).filter((r) => r.height < 44 || r.width < 44).length); assert.equal(small, 0);
  await page.setViewportSize({ width: 1440, height: 900 }); await page.waitForTimeout(100);
  assert.notEqual(await page.$eval('.sheet', (e) => getComputedStyle(e).backdropFilter), 'none', 'on a desktop the one glass element blurs');
  assert.deepEqual(errors, []); await ctx.close();
});
