/* Café Lima's place system in a headless Chromium: the board and the guest's phone in one browser (two tabs that talk
   through localStorage and a BroadcastChannel). Seat a table (it sets itself), make an order ready and see the phone's
   ready card, place a bid and win it when bidding closes (the table turns violet), edit the floor (move, add, delete,
   undo, save, reload, reset), the 2D plan with ?gl=off, the 3D place with reduced motion, Hebrew and English.
   Run: node --test test/floor.browser.test.mjs   (needs the build: the pages load ../floor.js and ../floor-guest.js) */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, listen, shot, VIEW } from './browser.mjs';

let srv, browser;
before(async () => { srv = await listen(7410); browser = await launch(); });
after(async () => { await browser.close(); srv.server.close(); });
const url = (page, q) => srv.origin + VIEW + 'floor/' + page + '?demo=lima&test=1' + (q || '');
async function tab(ctx, u, size) {
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  if (size) await page.setViewportSize(size);
  await page.goto(u, { waitUntil: 'domcontentloaded' }); return { page, errors };
}
const phase = (page, id) => page.evaluate((i) => window.__floor.rows().find((r) => r.id === i).phase, id);
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test('board and phone (2D, Hebrew): seat a table, the order-ready beep reaches the phone, a bid is placed and won', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page: board, errors } = await tab(ctx, url('', '&gl=off'));
  await board.waitForSelector('.pp-t'); await board.waitForSelector('.panel[data-panel="orders"] .order');
  assert.equal(await board.$eval('html', (e) => e.lang + '/' + e.dir), 'he/rtl');
  assert.equal(await board.$$eval('.pp-t', (els) => els.length), 16, 'every table of the draft');
  assert.match(await board.textContent('#title'), /קפה לימה/); assert.match(await board.textContent('#draft'), /טיוטה ראשונה שצוירה מתמונות/);
  assert.match(await board.textContent('#demoLine'), /הדגמה · מספרים להמחשה/);
  assert.equal(await noOverflow(board), 0, 'nothing overflows');
  /* seat the round marble table by the street with stools (t7): the default frame; it sets itself */
  await board.click('.panel[data-panel="tables"] .row[data-id="t7"] [data-act="seat"]'); await board.waitForSelector('#seatGo');
  assert.equal((await board.textContent('#frameVal')).trim(), '90 דק׳');
  await board.click('#frameDec'); assert.equal((await board.textContent('#frameVal')).trim(), '85 דק׳');
  await board.click('#seatGo'); await board.waitForSelector('#sheet', { state: 'hidden' });
  const s7 = await board.evaluate(() => window.__floor.state().S.tables.t7); assert.deepEqual([s7.phase, s7.party, s7.minutes], ['seated', 2, 85]);
  assert.equal(await board.$eval('.pp-t[data-id="t7"] .pp-set', (e) => e.classList.contains('on')), true, 'the table set itself');
  /* the phone at table 3, along the wall: the counter attached order #23 to it */
  const { page: phone, errors: perr } = await tab(ctx, url('guest.html', '&table=t3&gl=off'), { width: 390, height: 844 });
  await phone.waitForSelector('#orderState');
  assert.match(await phone.textContent('#youAt'), /^אתם בשולחן 3 · לאורך הקיר$/);
  assert.match(await phone.textContent('#orderCard h2'), /#23/);
  assert.equal(await noOverflow(phone), 0, 'the phone does not scroll sideways');
  await phone.click('#soundBtn');                                                  // one tap: sound may play from now on
  await phone.waitForSelector('#soundBtn[aria-pressed="true"]', { timeout: 4000 });
  await board.click('.order[data-no="23"] [data-act="ready"]');
  await phone.waitForSelector('#readyCard', { timeout: 8000 });
  assert.match(await phone.textContent('#readyCard'), /ההזמנה שלכם מוכנה/); assert.match(await phone.textContent('#readyCard .big'), /#23/);
  await shot(phone, 'floor-phone-ready-he');
  await phone.click('#gotIt'); assert.equal(await phone.$('#readyCard'), null);
  assert.match((await board.evaluate(() => window.__floor.log().map((a) => a.text).join('|'))), /הזמנה #23 מוכנה/);
  /* a bid for the sofa corner at 10:00 (a sample bid of ₪15 leads): the phone offers ₪20, leads, and wins at 09:50 */
  await phone.waitForSelector('.gbid[data-table="l1"] [data-act="bid"]');
  assert.match(await phone.textContent('#bidCard'), /סכומים לדוגמה · שום דבר לא מחויב/);
  const btn = await phone.$('.gbid[data-table="l1"] [data-act="bid"]'); assert.equal(await btn.getAttribute('data-amount'), '20');
  await btn.click(); await phone.waitForSelector('.gbid[data-table="l1"][data-st="leading"]');
  await board.waitForFunction(() => Object.values(window.__floor.state().B.auctions).some((a) => a.table === 'l1' && a.bids.some((b) => b.amount === 20 && b.status === 'leading')));
  await shot(phone, 'floor-phone-bid-he');
  await board.evaluate(() => window.__floor.advance(16 * 60000));                  // 09:35 → 09:51: bidding for 10:00 closed at 09:50
  assert.equal(await phase(board, 'l1'), 'held', 'the sofa corner is held for the winner (violet)');
  await phone.waitForSelector('.gbid[data-table="l1"][data-st="won"]', { timeout: 8000 });
  assert.match(await phone.textContent('.gbid[data-table="l1"] .st'), /פינת הספות שלכם, .*10:00.*11:30.*· הסכום יקוזז מההזמנה שלכם/);
  assert.match(await board.textContent('.panel[data-panel="bids"]'), /זכה ב־₪20/);
  await shot(board, 'floor-board-he-2d');
  assert.deepEqual(errors, []); assert.deepEqual(perr, []); await ctx.close();
});

test('edit the floor (2D, English): move by keys and by drag, add, delete, undo, warnings, save, reload, reset', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const { page, errors } = await tab(ctx, url('', '&gl=off&lang=en'));
  await page.waitForSelector('.pp-t');
  assert.equal(await page.$eval('html', (e) => e.lang + '/' + e.dir), 'en/ltr');
  await page.click('#editBtn'); await page.waitForSelector('#editbar:not([hidden])');
  const x = (id) => page.evaluate((i) => window.__floor.layout().tables.find((t) => t.id === i), id);
  /* pick table 5 along the wall and move it with the arrows (5 cm a press), rotate with R */
  await page.click('.pp-t[data-id="t5"]'); await page.waitForSelector('[data-sel="t5"]');
  await page.focus('.pp-t[data-id="t5"]'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight');
  assert.equal((await x('t5')).x, 9.8);
  await page.keyboard.press('r'); assert.equal((await x('t5')).rot, 15);
  /* a mouse drag on the plan moves it too (snapped to 5 cm) */
  const b = await page.$eval('.pp-t[data-id="t5"]', (e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await page.mouse.move(b[0], b[1]); await page.mouse.down(); await page.mouse.move(b[0] - 30, b[1], { steps: 4 }); await page.mouse.up();
  const t5 = await x('t5'); assert.ok(t5.x < 9.8 && Math.abs(t5.x * 20 - Math.round(t5.x * 20)) < 1e-6, 'dragged left and snapped: ' + t5.x);
  /* add a round table for 2 next to it, then delete it, then undo the delete */
  await page.click('#add-round2'); let ids = await page.evaluate(() => window.__floor.layout().tables.map((t) => t.id)); assert.ok(ids.includes('n1')); assert.equal(ids.length, 17);
  assert.equal(await page.$$eval('.pp-t', (els) => els.length), 17);
  await page.click('#delBtn'); assert.equal((await page.evaluate(() => window.__floor.layout().tables.length)), 16);
  await page.click('#undoBtn'); assert.equal((await page.evaluate(() => window.__floor.layout().tables.length)), 17, 'undo brings it back');
  await page.click('#redoBtn'); await page.click('#undoBtn');
  /* a warning: push table 2 onto table 3 */
  await page.evaluate(() => window.__floor.editOp((l) => window.__floor.E.moveTable(l, 't2', 4.2, 3.35)));
  assert.match(await page.textContent('#warns'), /Table 2 · Along the wall touches Table 3 · Along the wall/);
  await page.evaluate(() => window.__floor.editOp((l) => window.__floor.E.moveTable(l, 't2', 3.0, 3.35)));
  assert.equal((await page.textContent('#warns')).trim(), 'The floor has no problems.');
  await shot(page, 'floor-edit-en-2d');
  await page.click('#saveBtn');
  await page.reload(); await page.waitForSelector('.pp-t');
  ids = await page.evaluate(() => window.__floor.layout().tables.map((t) => t.id)); assert.ok(ids.includes('n1'), 'a reload keeps the saved floor');
  assert.equal((await x('t5')).x, t5.x); assert.equal(await page.evaluate(() => window.__floor.edited()), true);
  assert.ok(await page.evaluate(() => Object.keys(localStorage).includes('mana-floor:v1:lima:layout')));
  await page.click('#editBtn'); await page.click('#resetBtn'); await page.click('#saveBtn');
  assert.equal(await page.evaluate(() => window.__floor.layout().tables.length), 16, 'back to Lima’s draft');
  /* every button is at least 44 px; nothing overflows */
  const small = await page.$$eval('button', (els) => els.filter((e) => e.offsetParent && !e.classList.contains('hit')).map((e) => e.getBoundingClientRect()).filter((r) => r.height < 43.5 || r.width < 43.5).length);
  assert.equal(small, 0, 'targets ≥ 44 px'); assert.equal(await noOverflow(page), 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the 3D place: board and phone with reduced motion, the table set at once, the panels customised and remembered', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const { page, errors } = await tab(ctx, url('', '&gl=on&lang=en'));
  await page.waitForFunction(() => window.__floor.stageKind === '3d' && window.__floor.stage().info().frames > 0, null, { timeout: 90000 });
  assert.equal(await page.$eval('.pl-canvas', (e) => e.getAttribute('role')), 'img');
  assert.match(await page.$eval('.pl-canvas', (e) => e.getAttribute('aria-label')), /A 3D model of Café Lima: 16 tables/);
  /* seat the sofa corner: with reduced motion the setting is there at once */
  await page.click('.panel[data-panel="tables"] .row[data-id="l1"] [data-act="seat"]'); await page.waitForSelector('#seatGo');
  assert.match(await page.textContent('.stepper-row small'), /the frame for The sofa corner/, 'the zone’s own frame (example: 120)');
  await page.click('#seatGo'); await page.waitForSelector('#sheet', { state: 'hidden' });
  assert.deepEqual(await page.evaluate(() => window.__floor.stage().info().set), ['l1']);
  assert.equal(await page.evaluate(() => window.__floor.stage().info().setting), false, 'reduced motion: nothing still arriving');
  await page.evaluate(() => window.__floor.stage().view('above', { ms: 0 })); await page.waitForTimeout(1500);
  await shot(page, 'floor-board-en-3d');
  /* customise: hide Alerts, compact; a reload remembers */
  await page.click('#custBtn'); await page.click('#show-alerts'); await page.click('#den-compact'); await page.keyboard.press('Escape');
  assert.equal(await page.$('.panel[data-panel="alerts"]'), null);
  await page.reload(); await page.waitForSelector('.panel[data-panel="tables"]');
  assert.equal(await page.$('.panel[data-panel="alerts"]'), null, 'remembered'); assert.equal(await page.$eval('html', (e) => e.classList.contains('compact')), true);
  /* the phone: from above down to table 3, its table set at once */
  const { page: phone, errors: perr } = await tab(ctx, url('guest.html', '&table=t3&gl=on&motion=reduce'), { width: 390, height: 844 });
  await phone.waitForFunction(() => window.__guest.landed === true, null, { timeout: 90000 });
  assert.equal(await phone.evaluate(() => window.__guest.stageKind), '3d');
  assert.deepEqual(await phone.evaluate(() => window.__guest.stage().info().set), ['t3']);
  assert.equal(await phone.evaluate(() => window.__guest.stage().info().preset), 'table');
  await phone.waitForTimeout(1500); await shot(phone, 'floor-phone-he-3d');
  assert.equal(await noOverflow(phone), 0);
  assert.deepEqual(errors, []); assert.deepEqual(perr, []); await ctx.close();
});
