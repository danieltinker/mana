// The guest menu on the clean schema (config schema 2, apps/view/src/v2/) on a 390×844 phone, against the simulator's
// local stack: choices with a nested sauce and the running price, "from" prices, one suggestion accepted and one
// dismissed, the vegan filter (and what it does to suggestions), an owner taking a dish off mid-visit, the basket and
// its total, day parts and "closed now" on the venue's clock, the table and the list offering the same choices, and the
// events: what the browser sent is exactly what the owner's dashboard shows after the rollup job.
//
// Synthetic venues only: Bistro Sim (open around the clock) and Café Demo (day parts, real hours) from sim/seeds, and
// Bistro Check (e2e/seeds/guest-check.json: paid defaults, an add-on suggested after an add, a sauce group that can run
// out entirely). Screenshots (demo data) go to e2e/.out/guest-menu/.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ledger, loadSeed, readSeed, SEEDS } from '@mana/sim';
import { OUT, startE2E } from './helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(OUT, 'guest-menu');
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
let e, bistro, cafe, check;
const pages = [];

before(async () => {
  execFileSync(process.execPath, ['tools/build.mjs'], { cwd: path.join(ROOT, 'apps/view'), stdio: 'ignore' });      // app.js and v2-<hash>.js
  fs.mkdirSync(SHOTS, { recursive: true });
  e = await startE2E({ seed: 'bistro-sim', gl: true, mounts: { view: path.join(ROOT, 'apps/view'), stock: path.join(ROOT, 'stock') }, config: { liveEveryMs: 800 } });
  bistro = e.venue;
  cafe = await loadSeed(e.stack, readSeed(path.join(SEEDS, 'cafe-demo.json')).seed);
  check = await loadSeed(e.stack, readSeed(path.join(ROOT, 'e2e/seeds/guest-check.json')).seed);
}, { timeout: 240000 });
after(async () => { await e?.stop(); });

/** A phone on the guest menu, with every track_events call it makes (and the answers) kept for the end. */
async function phone(query, { clock = null } = {}) {
  const page = await e.page();
  if (clock !== null) await page.clock.install({ time: clock });
  page.events = []; page.answers = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/rpc/track_events')) page.events.push(...JSON.parse(r.postData()).p_events); });
  page.on('response', async (r) => { if (r.request().method() === 'POST' && r.url().endsWith('/rpc/track_events')) { const j = await r.json().catch(() => null); page.answers.push(j); if (r.status() !== 200) page.failures = (page.failures || []).concat({ status: r.status(), body: j }); } });
  page.on('requestfailed', (r) => { if (r.url().endsWith('/rpc/track_events')) page.failures = (page.failures || []).concat({ failed: r.failure() && r.failure().errorText }); });
  await page.goto(e.webUrl + 'view/?' + query);
  await page.waitForFunction(() => window.__mana && window.__mana.state() && window.__mana.v2());
  pages.push(page);
  return page;
}
const names = (list) => list.map((x) => x.name).reduce((m, n) => ((m[n] = (m[n] || 0) + 1), m), {});
const text = (page, sel) => page.locator(sel).innerText();
const D = () => bistro.ids.dishes, O = () => bistro.ids.options, G = () => bistro.ids.groups, R = () => bistro.ids.rules;
const K = () => check.ids.dishes, KO = () => check.ids.options;
const v2 = (page) => page.evaluate(() => window.__mana.v2());
const trayLines = (page) => page.$$eval('#trayList li.v2-line', (ls) => ls.map((l) => [l.querySelector('.l-name').innerText, (l.querySelector('.l-choices') || {}).innerText || '', l.querySelector('.l-price').innerText]));
const openTray = async (page) => { await page.click('#trayBtn'); await page.locator('#traySheet.open').waitFor(); };
const activeId = (page) => page.evaluate(() => document.activeElement && document.activeElement.id);
/** Safari and iOS before 16.4 (and 15.4): a lookbehind is refused, Object.hasOwn and crypto.randomUUID do not exist. */
const OLD_SAFARI = `(() => {
  const R = RegExp;
  const W = function (p, f) { const s = p instanceof R ? p.source : String(p); if (/\\(\\?<[=!]/.test(s)) throw new SyntaxError('Invalid regular expression: invalid group specifier name'); return new.target ? new R(p, f) : R(p, f); };
  W.prototype = R.prototype; Object.setPrototypeOf(W, R); globalThis.RegExp = W;
  delete Object.hasOwn;
  try { Object.defineProperty(Object.getPrototypeOf(globalThis.crypto), 'randomUUID', { value: undefined, configurable: true }); } catch (e) {}
})();`;
/** A script that holds a lookbehind as a literal does not even parse there. */
const LOOKBEHIND = /\/[^/\n]*\(\?<[=!][^/\n]*\/[dgimsuyv]*/;
const opt = (page, optionId, opener = null) => page.locator((opener ? `.v2-nested[data-for="${opener}"] ` : '#v2Groups > .v2-group > ') + `[data-o="${optionId}"]`);
const sheetSug = (page) => page.locator('#v2SheetSug .v2-sug');
const openDish = async (page, id) => { await page.click(`.row[data-id="${id}"]`); await page.locator('#addBtn2').waitFor(); };
const closeSheet = (page) => page.keyboard.press('Escape');
/** Every event the phone has queued, sent (a test fails here, with what is left, rather than hanging). */
const flushed = (page) => page.evaluate(() => Promise.race([window.__mana.flush().then(() => null),
  new Promise((r) => setTimeout(() => r(window.__mana.v2().events), 45000))])).then((left) => assert.equal(left, null, 'events still queued after 45 s: ' + JSON.stringify({ left, failures: (page.failures || []).slice(-3) })));

test('the sheet: a size, a nested sauce, "from" prices, one suggestion accepted and one dismissed, the basket and its total', { timeout: 180000 }, async () => {
  const page = await phone('m=bistro-sim&lang=en&gl=off&test=1&t=1');
  // "from ₪…" where a required choice can cost more; a plain price where it cannot
  assert.equal(await text(page, `.row[data-id="${D().burger}"] .row-price`), 'from\n₪68');
  assert.equal(await text(page, `.row[data-id="${D().espresso}"] .row-price`), 'from\n₪12');
  assert.equal(await text(page, `.row[data-id="${D().lemonade}"] .row-price`), '₪14');
  await shot(page, '01-list-from-prices');

  await openDish(page, D().burger);
  assert.equal((await text(page, '#dPriceRow')).replace(/\s+/g, ''), 'from₪68');
  assert.deepEqual(await page.$$eval('#v2Groups > .v2-group > legend', (ls) => ls.map((l) => l.innerText.replace(/\s+/g, ' '))), ['Side of choice Choose 1 · Required', 'Extras Up to 3 · Optional']);
  assert.equal(await opt(page, O().fries).locator('input').isChecked(), true, "the owner's default side");
  assert.equal(await opt(page, O().aioli, O().fries).locator('input').isChecked(), true, 'and the default sauce of the group fries open');
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪68');
  assert.match(await text(page, '#v2SheetSug'), /Add cheese\?[\s\S]*Cheese[\s\S]*\+₪4/, 'one suggestion, never pre-selected');
  assert.equal(await page.locator(`[data-o="${O().cheese}"] output`).innerText(), '0');
  await shot(page, '02-sheet-defaults-and-suggestion');

  await opt(page, O()['sweet-potato']).click();
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪76');
  assert.equal(await page.locator(`.v2-nested[data-for="${O().fries}"]`).isVisible(), false, 'the sauce under fries went with them');
  await opt(page, O().harissa, O()['sweet-potato']).click();
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪79');
  await shot(page, '03-nested-sauce-price');

  await sheetSug(page).locator('.primary').click();                                          // accept: one cheese
  assert.equal(await page.locator(`[data-o="${O().cheese}"] output`).innerText(), '1');
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪83');
  assert.equal(await page.locator('#v2SheetSug').isVisible(), false, 'nothing follows an accepted suggestion');
  await page.locator(`[data-o="${O().cheese}"] .stepper button`).last().click();          // double cheese
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪87');
  assert.equal(await page.locator(`[data-o="${O().cheese}"] .stepper button`).last().isDisabled(), true, 'no more than the option allows');

  await page.click('#addBtn2');
  assert.equal(await text(page, '#addBtn2'), 'Added to my table');
  assert.match(await text(page, '#v2SheetSug'), /A cold lemonade\?/, 'the "add" suggestion');
  await shot(page, '04-added-then-suggestion');
  await sheetSug(page).locator('.ghost').click();                                           // dismiss: every choice and the price stay
  assert.equal(await page.locator('#v2SheetSug').isVisible(), false);
  assert.deepEqual(await page.evaluate(() => window.__mana.v2().lines.map((l) => l.quantity)), [1]);
  await page.waitForFunction(() => /87/.test(document.getElementById('addBtn2').textContent));
  assert.equal(await opt(page, O().harissa, O()['sweet-potato']).locator('input').isChecked(), true);
  await closeSheet(page);

  await openDish(page, D().espresso);                                                        // a size
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪12');
  await opt(page, O().large).click();
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪16');
  await page.click('#addBtn2');
  assert.match(await text(page, '#v2SheetSug'), /A croissant with your coffee\?[\s\S]*Croissant[\s\S]*₪14/);
  await sheetSug(page).locator('.primary').click();                                          // accepted: the croissant, and nothing after it
  assert.equal(await page.locator('#v2SheetSug').isVisible(), false);
  await closeSheet(page);

  await page.click('#trayBtn');
  await page.locator('#traySheet.open').waitFor();
  const lines = async () => page.$$eval('#trayList li.v2-line', (ls) => ls.map((l) => [l.querySelector('.l-name').innerText, (l.querySelector('.l-choices') || {}).innerText || '', l.querySelector('.l-price').innerText]));
  assert.deepEqual(await lines(), [['Burger', 'Sweet potato · Harissa · Cheese × 2', '₪87'], ['Espresso', 'Large', '₪16'], ['Croissant', '', '₪14']]);
  assert.equal(await text(page, '#trayTotal'), '₪117');
  assert.equal(await text(page, '#v2Vat'), 'Prices include VAT.');
  assert.equal(await page.locator('#v2TraySug').isVisible(), false, 'a drink is already on the table: "something to drink?" stays quiet');
  assert.equal(await text(page, '#trayCount'), '3');
  await shot(page, '05-my-table-total');
  await page.click('#trayList li.v2-line:nth-child(2) [data-act="more"]');
  assert.equal(await text(page, '#trayTotal'), '₪133');
  await page.click('#trayList li.v2-line:nth-child(2) [data-act="less"]');
  assert.equal(await text(page, '#trayTotal'), '₪117');

  await page.click('#trayList li.v2-line:nth-child(1) [data-act="edit"]');                  // change a line's choices
  await page.locator('#addBtn2:has-text("Save changes")').waitFor();
  assert.equal(await opt(page, O().harissa, O()['sweet-potato']).locator('input').isChecked(), true);
  await opt(page, O().ketchup, O()['sweet-potato']).click();
  assert.equal(await text(page, '#addBtn2'), 'Save changes · ₪84');
  await page.click('#addBtn2');
  await page.locator('#traySheet.open').waitFor();
  assert.deepEqual((await lines())[0], ['Burger', 'Sweet potato · Ketchup · Cheese × 2', '₪84']);
  assert.equal(await text(page, '#trayTotal'), '₪114');

  await flushed(page);
  assert.deepEqual(names(page.events), { menu_opened: 1, dish_viewed: 2, suggestion_shown: 3, addon_chosen: 5, suggestion_accepted: 2, basket_added: 3, suggestion_dismissed: 1 });
  assert.deepEqual(page.events.find((x) => x.name === 'menu_opened').props, { src: 'qr', lang: 'en', revision: 1 });
  assert.deepEqual(page.events.filter((x) => x.name === 'basket_added').map((x) => [x.props.dishId, x.props.fromSuggestion]), [[D().burger, false], [D().espresso, false], [D().croissant, true]]);
  assert.deepEqual(page.events.filter((x) => x.name === 'addon_chosen').map((x) => [x.props.optionId, x.props.parentOptionId]),
    [[O()['sweet-potato'], null], [O().harissa, O()['sweet-potato']], [O().cheese, null], [O().large, null], [O().ketchup, O()['sweet-potato']]]);
  for (const ev of page.events) { assert.match(ev.at, /[+-]\d\d:\d\d$/); assert.deepEqual(Object.keys(ev), ['id', 'name', 'venueId', 'at', 'props']); }
  assert.equal(await page.evaluate(() => document.cookie), '', 'no cookie');
  assert.deepEqual(page.problems, []);

  await page.reload();                                                                       // "my table" is kept on this phone
  await page.waitForFunction(() => window.__mana && window.__mana.v2());
  assert.equal(await text(page, '#trayCount'), '3');
});

test('the vegan filter says it is on, shows only vegan dishes, and what it hides is never suggested', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-sim&lang=en&gl=off&test=1');
  await page.click('#v2FilterBtn');
  await page.locator('#v2Filter').waitFor();
  assert.deepEqual(await page.$$eval('#v2Filter .v2-tag:not([hidden])', (bs) => bs.map((b) => b.innerText.replace(/\s+/g, ' '))), ['Vegan 3 dishes', 'Vegetarian 5 dishes'], 'the tags this menu has, with what each would show');
  await page.click('#v2Filter .v2-tag.t-vegan');
  assert.equal(await page.getAttribute('#v2Filter .v2-tag.t-vegan', 'aria-pressed'), 'true');
  assert.equal(await text(page, '.v2-pill.on'), 'Showing only: Vegan');
  assert.match(await page.getAttribute('#v2FilterBtn', 'aria-label'), /Showing only: Vegan/);
  assert.deepEqual(await page.$$eval('#list .l-cat', (cs) => cs.map((c) => [c.querySelector('h3').textContent, [...c.querySelectorAll('.row-name')].map((r) => r.textContent)])), [['Drinks', ['Espresso', 'Lemonade']], ['Pastries', ['Cookie']]]);
  await shot(page, '06-filter-vegan');
  await page.keyboard.press('Escape');                                                      // the panel closes; the filter stays on
  assert.equal(await page.locator('#v2Filter').isVisible(), false);
  assert.equal(await page.locator('.v2-pill.on').isVisible(), true);

  await openDish(page, D().espresso);
  await page.click('#addBtn2');
  const p = await page.evaluate(() => window.__mana.v2().pending);
  assert.deepEqual([p.ruleId, p.suggest.dishId], [R()['any-lemonade'], D().lemonade], 'the croissant (vegetarian, not vegan) is filtered out: the next rule speaks');
  await closeSheet(page);
  await page.click('.v2-pill.on button');                                                   // clear: everything is back
  assert.equal(await page.locator('#list .row').count(), 6);
  assert.equal(await page.locator('.v2-pill.on').count(), 0);
  await flushed(page);
  assert.deepEqual(page.problems, []);
});

test('an owner takes a dish and a sauce off mid-visit: the phone greys them at once; the basket lines that hold them are marked, explained and left out of the total', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-sim&lang=en&gl=off&test=1');
  for (const id of [D().lemonade, D().cookie]) { await openDish(page, id); await page.click('#addBtn2'); await closeSheet(page); }
  await openDish(page, D().burger);
  await opt(page, O()['sweet-potato']).click(); await opt(page, O().harissa, O()['sweet-potato']).click();
  await page.click('#addBtn2');
  await closeSheet(page);
  await bistro.owner.soldOut('dish', D().lemonade, { kind: 'duration', minutes: 120 }, 'ice machine');
  await bistro.owner.soldOut('option', O().harissa, { kind: 'indefinite' });
  const row = `.row[data-id="${D().lemonade}"]`;
  await page.locator(row + ' .badge.sold').waitFor({ timeout: 10000 });                     // the next live refresh (800 ms here, 30 s by default)
  assert.match(await text(page, row + ' .badge.sold'), /^Sold out · back (at \d\d:\d\d|on \w+)$/);
  assert.equal(await page.evaluate((id) => window.__mana.model().itemById.get(id).item.available, D().lemonade), false);
  await page.evaluate(() => window.__mana.refresh());                                       // both changes are in (a poll may have landed between the two)
  assert.deepEqual(await page.evaluate(() => window.__mana.v2().offOptions), [O().harissa]);
  await page.click(row);
  assert.equal(await page.isDisabled('#addBtn2'), true, 'never addable');
  assert.match(await text(page, '#addBtn2'), /^Sold out/);
  await closeSheet(page);

  await openDish(page, D().burger);                                                         // the sauce: greyed, never selectable
  await opt(page, O()['sweet-potato']).click();
  const harissa = opt(page, O().harissa, O()['sweet-potato']);
  assert.equal(await harissa.locator('input').isDisabled(), true);
  assert.match(await harissa.innerText(), /Harissa\s*Sold out/);
  assert.equal(await harissa.evaluate((el) => el.classList.contains('sold')), true);
  await shot(page, '07-sauce-sold-out-in-the-sheet');
  await closeSheet(page);

  await page.click('#trayBtn');
  await page.locator('#traySheet.open').waitFor();
  const line = (name) => page.locator('#trayList li.v2-line', { hasText: name });
  assert.equal(await line('Lemonade').locator('.l-why').innerText(), 'Sold out now. You can remove it.');
  assert.equal(await line('Lemonade').locator('.l-price').innerText(), 'Not in the total');
  assert.equal(await line('Lemonade').locator('[data-act="more"]').isDisabled(), true, 'a line that cannot be ordered is not added to');
  assert.equal(await line('Lemonade').locator('[data-act="less"]').isDisabled(), false);
  assert.equal(await line('Burger').locator('.l-why').innerText(), 'Harissa is sold out now. Change your choice.');
  assert.equal(await line('Burger').locator('[data-act="edit"]').count(), 1, 'fixable from the line');
  assert.equal(await text(page, '#trayTotal'), '₪9', 'the cookie only');
  await shot(page, '08-sold-out-mid-visit-basket');
  await line('Lemonade').locator('[data-act="remove"]').click();
  assert.equal(await page.locator('#trayList li.v2-line').count(), 2);
  await page.keyboard.press('Escape');

  await bistro.owner.restore('dish', D().lemonade);
  await bistro.owner.restore('option', O().harissa);
  await page.locator(row + ' .badge.sold').waitFor({ state: 'detached', timeout: 10000 });
  await page.evaluate(() => window.__mana.refresh());
  assert.equal(await page.evaluate((id) => window.__mana.model().itemById.get(id).item.available, D().lemonade), true);
  assert.equal(await page.evaluate(() => window.__mana.v2().total), 7900 + 900, 'the burger counts again');
  await page.click('#trayBtn');
  await page.locator('#traySheet.open').waitFor();
  await page.click('#trayClear');
  assert.equal(await page.locator('#trayList li').count(), 0);
  assert.equal(await page.isVisible('#trayCount'), false);
  assert.deepEqual(await page.evaluate(() => window.__mana.v2().lines), []);
  await page.keyboard.press('Escape');
  await flushed(page);
  assert.deepEqual(page.problems, []);
});

test('the table (WebGL) and the list offer the same choices; the table greys a dish taken off; Hebrew reads right to left', { timeout: 240000 }, async () => {
  const optionsOf = (page) => page.$$eval('#v2Groups .v2-group', (gs) => gs.map((g) => [g.dataset.g, g.dataset.p, [...g.querySelectorAll(':scope > .opt')].map((o) => o.dataset.o || 'none')]));
  const list = await phone('m=bistro-sim&lang=en&gl=off&test=1');
  await openDish(list, D().burger);
  const fromList = await optionsOf(list);

  const table = await phone('m=bistro-sim&lang=en&test=1&hint=0&pr=1');
  await table.evaluate(() => window.__mana.settle());
  assert.equal(await table.evaluate(() => window.__mana.state().simple), false, 'the table is drawn');
  const frames = (n = 12) => table.evaluate(async (k) => { for (let i = 0; i < k; i++) await window.__mana.frame(50); }, n);
  await shot(table, '09-table-card-from-price');
  await table.evaluate(() => window.__mana.lift(true)); await frames();
  assert.deepEqual(await optionsOf(table), fromList, 'the same groups and options, nested included');
  await opt(table, O()['sweet-potato']).click(); await opt(table, O().harissa, O()['sweet-potato']).click(); await frames(4);
  assert.equal(await text(table, '#addBtn2'), 'Add to my table · ₪79');
  assert.equal(await table.evaluate(() => document.getElementById('app').scrollTop), 0, 'the sheet scrolls, never the page');
  await shot(table, '10-table-sheet-nested');
  await table.evaluate(() => window.__mana.lift(false)); await frames();
  await table.evaluate((id) => window.__mana.goTo(id), D().toast); await frames(30);
  await bistro.owner.soldOut('dish', D().toast, { kind: 'duration', minutes: 60 });
  await table.waitForFunction((id) => window.__mana.model().itemById.get(id).item.available === false, D().toast, { timeout: 10000 });
  await frames(20);
  assert.equal(await table.locator('#dSold').isVisible(), true);
  assert.match(await text(table, '#dSold'), /^Sold out/);
  assert.equal(await table.evaluate(() => window.__mana.info().actors.find((a) => a.id === window.__mana.state().itemId).sat < 0.3), true, 'the stage has taken its colour');
  await shot(table, '11-table-sold-out-greyed');
  await bistro.owner.restore('dish', D().toast);
  await table.evaluate((id) => window.__mana.goTo(id), D().cookie); await frames(30);
  await table.click('#addBtn');                                                             // no choices: added from the card itself
  await table.locator('#v2Float .v2-sug').waitFor();
  assert.match(await text(table, '#v2Float'), /A cold lemonade\?[\s\S]*Lemonade[\s\S]*₪14/, 'the "add" suggestion, over the card');
  assert.equal(await text(table, '#trayCount'), '1');
  await shot(table, '12-table-added-suggestion');
  await table.click('#v2Float .ghost');
  assert.equal(await table.locator('#v2Float').isVisible(), false);

  const he = await phone('m=bistro-sim&lang=he&gl=off&test=1');
  await openDish(he, D().burger);
  assert.equal(await he.evaluate(() => document.documentElement.dir), 'rtl');
  assert.match((await text(he, '#dPriceRow')).replace(/\s+/g, ''), /^החלמ־(68₪|₪68)$/);
  assert.deepEqual(await he.$$eval('#v2Groups > .v2-group > legend', (ls) => ls.map((l) => l.innerText.replace(/\s+/g, ' '))), ['תוספת לבחירה לבחור 1 · חובה', 'תוספות עד 3 · לא חובה']);
  assert.match(await text(he, '#addBtn2'), /^להוסיף לשולחן שלי · /);
  await shot(he, '13-hebrew-sheet');
  for (const p of [list, table, he]) { await flushed(p); assert.deepEqual(p.problems, []); }
});

test('keyboard only, in the list: Tab to a dish, Enter opens it with the focus inside, Tab stays in it, choices by keys, Escape back to the row; every control named; contrast', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-sim&lang=en&gl=off&test=1');
  const at = () => page.evaluate(() => {
    const a = document.activeElement, l = a && a.closest('label');
    return { id: a.id || null, row: a.closest('.row') ? a.closest('.row').dataset.id : null, o: a.closest('[data-o]') ? a.closest('[data-o]').dataset.o : null, inCard: !!a.closest('#card'),
      name: (a.getAttribute('aria-label') || (l && l.innerText) || a.innerText || '').replace(/\s+/g, ' ').trim() };
  });
  const tabTo = async (want, what, back = false) => { for (let i = 0; i < 40; i++) { if (want(await at())) return; await page.keyboard.press(back ? 'Shift+Tab' : 'Tab'); } assert.fail('not reachable by Tab: ' + what); };

  await tabTo((a) => a.row === D().burger, 'the burger in the list');
  await page.keyboard.press('Enter');
  await page.locator('#addBtn2').waitFor();
  assert.deepEqual(await at(), { id: 'dName', row: null, o: null, inCard: true, name: 'Burger' }, 'the focus moves into the sheet, on the dish\'s name');
  assert.deepEqual(await page.evaluate(() => [document.getElementById('list').inert, document.getElementById('top').inert, document.getElementById('card').getAttribute('aria-modal')]), [true, true, 'true'], 'the list and the bar wait behind it');
  const round = [];
  for (let i = 0; i < 24; i++) { await page.keyboard.press('Tab'); const a = await at(); assert.equal(a.inCard, true, 'Tab stays in the sheet: ' + JSON.stringify(a)); round.push(a.name); }
  for (const n of ['Add Cheese', 'No thanks: Cheese', 'Add to my table · ₪68']) assert.ok(round.includes(n), n + ' is reached by Tab: ' + JSON.stringify(round));
  for (let i = 0; i < 24; i++) { await page.keyboard.press('Shift+Tab'); assert.equal((await at()).inCard, true, 'Shift+Tab stays in the sheet too'); }

  const unnamed = await page.$$eval('#v2Groups input, #v2Groups button, #v2SheetSug button, #v2Related button, #addBtn2', (els) => els.filter((el) => {
    const label = el.closest('label'), name = el.getAttribute('aria-label') || (label && label.innerText.trim()) || el.innerText.trim();
    return !name;
  }).map((el) => el.outerHTML.slice(0, 80)));
  assert.deepEqual(unnamed, []);
  assert.deepEqual(await page.$$eval('#v2Groups fieldset > legend', (ls) => ls.length > 0 && ls.every((l) => l.parentElement.tagName === 'FIELDSET')), true, 'each group is a fieldset with its legend');

  await tabTo((a) => a.o === O().fries, 'the side');
  await page.keyboard.press('ArrowDown');                                                    // radios move with the arrows
  assert.equal(await opt(page, O().salad).locator('input').isChecked(), true);
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪68');
  await tabTo((a) => a.o === O().egg, 'the egg');
  await page.keyboard.press('Space');
  assert.equal(await opt(page, O().egg).locator('input').isChecked(), true);
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪73');
  const contrast = await page.evaluate(() => {
    const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number), lum = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }, bg = 'rgb(17, 13, 10)';
    return ['.g-name', '.g-hint', '.o-name', '.o-price', '#addBtn2', '.s-line', '.s-kicker', '.r-price'].map((q) => { const el = document.querySelector(q); return [q, el ? +ratio(getComputedStyle(el).color, q === '#addBtn2' ? getComputedStyle(el).backgroundColor : bg).toFixed(2) : null]; });
  });
  for (const [q, r] of contrast) assert.ok(r === null || r >= 4.5, q + ' contrast ' + r);
  await tabTo((a) => a.name === 'No thanks: Cheese', 'the suggestion\'s "No thanks"');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#v2SheetSug').isVisible(), false);
  assert.equal((await at()).id, 'addBtn2', 'the button that had the focus is gone: the focus is on the add button, not lost');
  await tabTo((a) => a.id === 'addBtn2', 'the add button');
  await page.keyboard.press('Enter');
  assert.equal(await text(page, '#addBtn2'), 'Added to my table');
  assert.deepEqual(await page.evaluate(() => window.__mana.v2().lines.map((l) => l.quantity)), [1]);

  await page.keyboard.press('Escape');                                                       // back to the row it came from
  await page.waitForFunction(() => window.__mana.state().open === null);
  assert.equal((await at()).row, D().burger, 'the focus is back on the burger\'s row');
  assert.deepEqual(await page.evaluate(() => [document.getElementById('list').inert, document.getElementById('top').inert]), [false, false]);
  await tabTo((a) => a.id === 'trayBtn', '"my table"', true);
  await page.keyboard.press('Enter');
  await page.locator('#traySheet.open').waitFor();
  await tabTo((a) => a.name === 'Add one: Burger', 'one more burger');
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => window.__mana.v2().lines.map((l) => l.quantity)), [2]);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__mana.state().open === null);
  assert.equal((await at()).id, 'trayBtn', 'and back on "my table"');
  await flushed(page);
  assert.deepEqual(page.problems, []);
});

test('Café Demo on its own clock: before opening the menu says "closed now", breakfast waits for 07:00 and comes on time', { timeout: 120000 }, async () => {
  // the most recent Wednesday 06:30 in Jerusalem before now (a past time: the phone's events stay within the accepted range)
  const now = Date.now(), fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  let t = now - (now % 60000);
  for (;;) { const p = Object.fromEntries(fmt.formatToParts(t).map((x) => [x.type, x.value])); if (p.weekday === 'Wed' && p.hour === '06' && p.minute === '30' && t < now) break; t -= 60000; }
  const page = await phone('m=cafe-demo&lang=en&gl=off&test=1', { clock: t });
  const C = cafe.ids.dishes, badge = (id) => page.locator(`.row[data-id="${id}"] .badge.sold`);
  assert.equal(await text(page, '.v2-pill.closed'), 'Closed now · opens at 07:00');
  assert.equal(await badge(C.shakshuka).innerText(), 'Served from 07:00');
  assert.equal(await badge(C['friday-cake']).innerText(), 'Served from Friday, 07:00');
  assert.equal(await badge(C.burger).count(), 0, 'a menu stays readable while the venue is closed');
  await shot(page, '14-cafe-demo-closed-day-parts');
  await page.clock.fastForward('36:00');                                                    // 07:06
  await page.evaluate(() => window.__mana.refresh());
  await badge(C.shakshuka).waitFor({ state: 'detached' });
  assert.equal(await page.locator('.v2-pill.closed').count(), 0);
  await openDish(page, C.shakshuka);
  assert.equal(await page.isDisabled('#addBtn2'), false);
  await closeSheet(page);
  await openDish(page, C.espresso);                                                         // an optional single choice: "None" until the guest picks one
  const O2 = cafe.ids.options, milk = page.locator(`#v2Groups > .v2-group[data-g="${cafe.ids.groups.milk}"]`);
  assert.equal((await milk.locator('legend').innerText()).replace(/\s+/g, ' '), 'Milk Optional');
  assert.equal(await milk.locator('.opt.none input').isChecked(), true);
  await milk.locator(`[data-o="${O2.oat}"]`).click();
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪14');
  await milk.locator('.opt.none').click();
  assert.equal(await milk.locator(`[data-o="${O2.oat}"] input`).isChecked(), false);
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪12');
  assert.deepEqual(page.problems, []);
});

test('an add-on suggested right after an add goes on one burger, never on the whole line; the sheet shows that burger', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-check&lang=en&gl=off&test=1');
  await openDish(page, K().burger);
  for (let i = 1; i <= 3; i++) {
    await page.click('#addBtn2');
    assert.match(await text(page, '#v2SheetSug'), /An egg on it\?[\s\S]*Egg[\s\S]*\+₪5/, 'after add ' + i);
  }
  const egg = (l) => (l.selection.groups.find((g) => g.options.some((o) => o.optionId === KO().egg)) ? 1 : 0);
  assert.deepEqual((await v2(page)).lines.map((l) => [l.quantity, egg(l)]), [[3, 0]], 'three of the same burger: one line');
  await shot(page, '15-add-rule-three-burgers');
  await sheetSug(page).locator('.primary').focus();
  await page.keyboard.press('Enter');                                                       // "Add Egg" by keys
  assert.equal(await activeId(page), 'addBtn2', 'the focus goes to the add button, not to the page');
  const d = await v2(page);
  assert.deepEqual(d.lines.map((l) => [l.quantity, egg(l)]), [[2, 0], [1, 1]], 'one burger has the egg, two do not');
  assert.equal(d.total, 3 * 6800 + 500, 'one egg is charged, not three');
  assert.equal(await opt(page, KO().egg).locator('input').isChecked(), true, 'the sheet shows the burger that got the egg');
  await page.waitForFunction(() => /73/.test(document.getElementById('addBtn2').textContent));
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪73');
  await closeSheet(page);
  await openTray(page);
  assert.deepEqual(await trayLines(page), [['Burger', 'Fries · Aioli', '₪136'], ['Burger', 'Fries · Aioli · Egg', '₪73']]);
  assert.equal(await text(page, '#trayTotal'), '₪209');
  assert.equal(await text(page, '#trayCount'), '3');
  await shot(page, '16-add-rule-one-burger-changed');
  await page.click('#trayList li.v2-line:nth-child(2) [data-act="edit"]');                  // "Change" on the line split off
  await page.locator('#addBtn2:has-text("Save changes")').waitFor();
  assert.equal(await opt(page, KO().egg).locator('input').isChecked(), true, 'the Change sheet holds that line\'s choices');
  await page.locator(`[data-o="${KO().cheese}"] .stepper button`).last().click();
  assert.equal(await text(page, '#addBtn2'), 'Save changes · ₪77');
  await page.click('#addBtn2');
  await page.locator('#traySheet.open').waitFor();
  assert.deepEqual(await trayLines(page), [['Burger', 'Fries · Aioli', '₪136'], ['Burger', 'Fries · Aioli · Egg · Cheese', '₪77']], 'only that line changed');
  assert.equal(await text(page, '#trayTotal'), '₪213');
  await page.keyboard.press('Escape');
  await flushed(page);
  assert.deepEqual(page.events.filter((x) => x.name === 'addon_chosen').map((x) => x.props.optionId), [KO().egg, KO().cheese]);
  assert.deepEqual(names(page.events.filter((x) => x.name.startsWith('suggestion_') || x.name === 'basket_added')), { suggestion_shown: 5, basket_added: 3, suggestion_accepted: 1 });
  const C = check.ids.rules;
  assert.deepEqual(page.events.filter((x) => x.name === 'suggestion_shown').map((x) => x.props.ruleId), [C['burger-cheese'], C['burger-egg'], C['burger-egg'], C['burger-egg'], C['main-basket']], 'the egg three times (its cap), then "my table" opening');
  assert.deepEqual(page.problems, []);
});

test('owner\'s defaults that cost money are always seen: a suggested dish with choices opens its sheet, nothing goes on the table unseen', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-check&lang=en&gl=off&test=1');
  assert.equal(await text(page, `.row[data-id="${K().basket}"] .row-price`), 'from\n₪22', 'the cheapest dip it can be ordered with');
  assert.equal(await text(page, `.row[data-id="${K().cocoa}"] .row-price`), '₪15', 'an optional topping never makes it "from"');
  await openDish(page, K().cookie);
  await page.click('#addBtn2');
  assert.match(await text(page, '#v2SheetSug'), /A hot chocolate with it\?[\s\S]*Hot chocolate[\s\S]*₪15/);
  await sheetSug(page).locator('.primary').click();                                        // the cocoa's sheet, the owner's cream ticked where the guest sees it
  await page.waitForFunction((id) => { const s = window.__mana.v2().session; return s && s.dishId === id; }, K().cocoa);
  assert.equal(await text(page, '#dName'), 'Hot chocolate');
  assert.equal(await opt(page, KO().cream).locator('input').isChecked(), true);
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪18');
  assert.equal((await v2(page)).lines.length, 1, 'nothing was added unseen');
  await shot(page, '17-suggested-dish-opens-its-sheet');
  await page.click('#addBtn2');
  assert.equal(await page.locator('#v2SheetSug').isVisible(), false, 'nothing follows an accepted suggestion');
  await closeSheet(page);

  await openDish(page, K().toast); await page.click('#addBtn2'); await closeSheet(page);
  await openTray(page);
  assert.match(await text(page, '#v2TraySug'), /A fries basket on the side\?[\s\S]*Fries basket[\s\S]*from ₪22/);
  await page.locator('#v2TraySug .primary').click();
  await page.waitForFunction((id) => { const s = window.__mana.v2().session; return s && s.dishId === id; }, K().basket);
  assert.equal(await opt(page, KO().garlic).locator('input').isChecked(), true);
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪23', 'the garlic dip (+₪3) is on the button before anything is added');
  assert.equal((await v2(page)).lines.length, 3);
  await page.click('#addBtn2');
  await closeSheet(page);
  await flushed(page);
  assert.deepEqual(page.events.filter((x) => x.name === 'basket_added').map((x) => [x.props.dishId, x.props.fromSuggestion]), [[K().cookie, false], [K().cocoa, true], [K().toast, false], [K().basket, true]]);
  assert.equal((await v2(page)).total, 900 + 1800 + 4200 + 2300);
  assert.deepEqual(page.problems, []);
});

test('a suggestion that goes sold out while it is on screen leaves at once', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-check&lang=en&gl=off&test=1');
  await openDish(page, K().burger);
  assert.match(await text(page, '#v2SheetSug'), /Add cheese\?/);
  await check.owner.soldOut('option', KO().cheese, { kind: 'indefinite' });
  try {
    await page.evaluate(() => window.__mana.refresh());
    assert.equal(await page.locator('#v2SheetSug').isVisible(), false);
    assert.equal((await v2(page)).pending, null);
    assert.match(await opt(page, KO().cheese).innerText(), /Cheese\s*Sold out/);
    assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪68', 'the guest\'s choices are as they were');
    await shot(page, '18-suggestion-sold-out-while-shown');
  } finally { await check.owner.restore('option', KO().cheese); }
  await closeSheet(page);
  await flushed(page);
  assert.deepEqual(names(page.events.filter((x) => x.name.startsWith('suggestion_'))), { suggestion_shown: 1 }, 'shown, then neither accepted nor dismissed');
  assert.deepEqual(page.problems, []);
});

test('every sauce sold out: fries and sweet potato say why and cannot be chosen, a new sheet starts on no side, the line\'s Change sheet says why', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-check&lang=en&gl=off&test=1');
  await openDish(page, K().burger); await page.click('#addBtn2'); await closeSheet(page);
  const sauces = [KO().aioli, KO().ketchup, KO().harissa];
  for (const o of sauces) await check.owner.soldOut('option', o, { kind: 'indefinite' });
  try {
    await page.evaluate(() => window.__mana.refresh());
    assert.deepEqual((await v2(page)).deadOpeners.sort(), [KO().fries, KO().sweet].sort());
    assert.equal(await text(page, `.row[data-id="${K().burger}"] .row-price`), '₪68', 'only the free salad is left to choose: a plain price');
    await openTray(page);
    const line = page.locator('#trayList li.v2-line', { hasText: 'Burger' });
    assert.equal(await line.locator('.l-why').innerText(), 'Aioli is sold out now. Change your choice.');
    assert.equal(await line.locator('[data-act="more"]').isDisabled(), true);
    await line.locator('[data-act="edit"]').click();
    await page.locator('#addBtn2:has-text("Save changes")').waitFor();
    for (const [o, n] of [[KO().fries, 'Fries'], [KO().sweet, 'Sweet potato']]) {
      assert.match(await opt(page, o).innerText(), new RegExp(n + '\\s*Sauce: none left'));
      assert.equal(await opt(page, o).locator('input').isDisabled(), true, n + ' cannot be chosen');
    }
    assert.equal(await text(page, '#v2Need'), "Fries can't be ordered now (Sauce: none left). Choose another.");
    await shot(page, '19-every-sauce-off-change-sheet');
    await opt(page, KO().salad).click();
    assert.equal(await page.locator('#v2Need').isVisible(), false);
    await page.click('#addBtn2');
    await page.locator('#traySheet.open').waitFor();
    assert.deepEqual(await trayLines(page), [['Burger', 'Salad', '₪68']]);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__mana.state().open === null);

    await openDish(page, K().burger);                                                       // a new sheet: no dead end pre-selected
    assert.deepEqual((await v2(page)).session.selection.groups.find((g) => g.groupId === check.ids.groups.side).options, []);
    await page.click('#addBtn2');
    assert.equal(await text(page, '#v2Need'), 'Still to choose: Side of choice');
    assert.equal((await v2(page)).lines.length, 1);
    await closeSheet(page);

    await check.owner.restore('option', KO().ketchup);                                       // one sauce back, mid-visit
    await page.evaluate(() => window.__mana.refresh());
    assert.deepEqual((await v2(page)).deadOpeners, [], 'fries and sweet potato can be chosen again');
    assert.equal(await text(page, `.row[data-id="${K().burger}"] .row-price`), 'from\n₪68', 'a paid side is possible again: "from"');
    await openDish(page, K().burger);
    assert.equal(await opt(page, KO().fries).locator('input').isChecked(), true, 'the owner\'s default side again');
    assert.equal(await opt(page, KO().fries).locator('input').isDisabled(), false);
    assert.doesNotMatch(await opt(page, KO().fries).innerText(), /none left/);
    assert.equal(await opt(page, KO().aioli, KO().fries).locator('input').isChecked(), false, 'its default sauce is still off: nothing pre-selected');
    await opt(page, KO().ketchup, KO().fries).click();
    assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪68');
    await page.click('#addBtn2');
    assert.equal((await v2(page)).lines.length, 2);
    await closeSheet(page);
  } finally { for (const o of sauces) await check.owner.restore('option', o).catch(() => {}); }
  await flushed(page);
  assert.deepEqual(page.problems, []);
});

test('with the filter on, "my table" still counts and shows every line; two tabs of one menu share one basket', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-check&lang=en&gl=off&test=1');
  await openDish(page, K().burger); await page.click('#addBtn2'); await closeSheet(page);
  await openDish(page, K().lemonade); await page.click('#addBtn2'); await closeSheet(page);
  await page.click('#v2FilterBtn'); await page.click('#v2Filter .v2-tag.t-vegan'); await page.keyboard.press('Escape');
  assert.equal(await page.locator(`.row[data-id="${K().burger}"]`).count(), 0, 'the burger is filtered out of the list');
  assert.equal(await text(page, '#trayCount'), '2', 'and still counted');
  await openTray(page);
  assert.deepEqual((await trayLines(page)).map((l) => l[0]), ['Burger', 'Lemonade']);
  assert.match(await page.getAttribute('#traySet', 'aria-label'), /Burger.*Lemonade/, 'the set table has both');
  await page.keyboard.press('Escape');
  await page.click('.v2-pill.on button');

  const other = await page.context().newPage();                                             // the same menu in a second tab
  await other.goto(e.webUrl + 'view/?m=bistro-check&lang=en&gl=off&test=1');
  await other.waitForFunction(() => window.__mana && window.__mana.v2());
  assert.equal(await text(other, '#trayCount'), '2');
  await openDish(other, K().cookie); await other.click('#addBtn2'); await closeSheet(other);
  await page.waitForFunction(() => window.__mana.v2().lines.length === 3, null, { timeout: 5000 });
  assert.equal(await text(page, '#trayCount'), '3', 'the first tab follows at once');
  await openDish(page, K().lemonade); await page.click('#addBtn2'); await closeSheet(page);
  await other.waitForFunction(() => window.__mana.v2().lines.find((l) => l.quantity === 2), null, { timeout: 5000 });
  await other.evaluate(() => window.__mana.flush());
  await other.close();
  await flushed(page);
  assert.deepEqual(page.problems, []);
});

test('the events keep going after the page was hidden with nothing to send and shown again', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-check&lang=en&gl=off&test=1');
  await flushed(page);
  const before = page.events.length;
  await page.evaluate(() => {                                                                // the guest switches to another app for a moment
    const as = (v) => Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    as('hidden'); document.dispatchEvent(new Event('visibilitychange'));
    as('visible'); document.dispatchEvent(new Event('visibilitychange'));
  });
  await openDish(page, K().lemonade); await page.click('#addBtn2'); await closeSheet(page);
  // nothing flushed by hand: the queue's own timer sends them
  await page.waitForFunction(() => { const q = window.__mana.v2().events; return q.queued === 0 && !q.sending && !q.waiting; }, null, { timeout: 20000 });
  assert.deepEqual(names(page.events.slice(before)), { dish_viewed: 1, basket_added: 1 });
  assert.deepEqual(page.problems, []);
});

test('at 200% zoom (195 CSS px wide) nothing overlaps or is cut, in English and Hebrew; public_menu is asked while the v2 module loads', { timeout: 120000 }, async () => {
  for (const lang of ['en', 'he']) {
    const page = await e.page(undefined, { viewport: { width: 195, height: 422 } });
    const asked = [];
    page.on('request', (r) => { const u = r.url(); if (/\/rpc\/public_menu$/.test(u)) asked.push('public_menu'); else if (/\/v2-[A-Z0-9]+\.js$/.test(u)) asked.push('v2'); });
    await page.goto(e.webUrl + `view/?m=bistro-check&lang=${lang}&gl=off&test=1`);
    await page.waitForFunction(() => window.__mana && window.__mana.v2());
    assert.deepEqual(asked.slice(0, 2), ['public_menu', 'v2'], 'the menu is asked for first, not after the module has come');
    await openDish(page, K().burger);
    const cut = (root) => page.evaluate((r) => [...document.querySelectorAll(r + ' *')].filter((el) => { const b = el.getBoundingClientRect(); return b.width && el.getClientRects().length && !el.closest('[hidden]') && !el.closest('.v2-rel') && (b.left < -0.5 || b.right > innerWidth + 0.5); })
      .map((el) => el.tagName + '.' + String(el.className).split(' ')[0]), root);
    const sheet = await page.evaluate(() => {
      const q = (s) => document.querySelector(s), box = (el) => el.getBoundingClientRect();
      const ov = (x, y) => { const p = box(q(x)), o = box(q(y)); return Math.max(0, Math.min(p.right, o.right) - Math.max(p.left, o.left)) * Math.max(0, Math.min(p.bottom, o.bottom) - Math.max(p.top, o.top)); };
      return { sugTextUnderButtons: ov('#v2SheetSug .s-text', '#v2SheetSug .s-acts'), priceUnderClose: ov('#dPriceRow', '#closeBtn'), actions: getComputedStyle(q('#cardMore .actions')).position, docW: document.documentElement.scrollWidth };
    });
    assert.deepEqual(sheet, { sugTextUnderButtons: 0, priceUnderClose: 0, actions: 'static', docW: 195 }, lang + ': the sheet');
    assert.deepEqual(await cut('#card'), [], lang + ': nothing in the sheet is cut at an edge');
    if (lang === 'he') assert.equal(await page.$eval('#dFrom', (el) => getComputedStyle(el).marginInlineEnd), '0px', 'the maqaf joins the price');
    await shot(page, `20-zoom-200-${lang}-sheet`);
    await page.click('#addBtn2'); await closeSheet(page);
    await openTray(page);
    assert.deepEqual(await cut('#traySheet'), [], lang + ': nothing in "my table" is cut at an edge');
    await shot(page, `21-zoom-200-${lang}-my-table`);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__mana.flush());
    assert.deepEqual(page.problems, []);
    await page.context().close();
  }
});

test('two tabs adding at the same moment end on the same basket, the one stored', { timeout: 120000 }, async () => {
  const a = await phone('m=bistro-check&lang=en&gl=off&test=1');
  const b = await a.context().newPage();
  await b.goto(e.webUrl + 'view/?m=bistro-check&lang=en&gl=off&test=1');
  await b.waitForFunction(() => window.__mana && window.__mana.v2());
  const seen = (page) => page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('mana-basket:bistro-check') || '{"lines":[]}').lines.map((l) => ['l' + l.n, l.dishId, l.quantity]);
    return { mine: window.__mana.v2().lines.map((l) => [l.key, l.dishId, l.quantity]), stored, count: document.getElementById('trayCount').textContent };
  });
  await openDish(a, K().lemonade); await openDish(b, K().cookie);
  for (let round = 1; round <= 6; round++) {
    await Promise.all([a.click('#addBtn2'), b.click('#addBtn2')]);                          // both write at once
    await a.waitForTimeout(250);
    const [x, y] = [await seen(a), await seen(b)];
    assert.deepEqual(x.mine, x.stored, `round ${round}: the first tab shows what is stored`);
    assert.deepEqual(y.mine, y.stored, `round ${round}: the second tab too`);
    assert.deepEqual(x.mine, y.mine, `round ${round}: the two tabs agree`);
  }
  // one after the other, with no pause: each write starts from what is stored, so no dish is lost even when the other
  // tab's event has not come yet (a tab in the background hears late)
  const total = async (page) => (await seen(page)).stored.reduce((n, l) => n + l[2], 0);
  const start = await total(a);
  for (let i = 0; i < 4; i++) { await a.click('#addBtn2'); await b.click('#addBtn2'); }
  await a.waitForTimeout(300);
  assert.equal(await total(a), start + 8, 'eight adds, eight more dishes');
  assert.deepEqual((await seen(a)).mine, (await seen(b)).mine);
  await closeSheet(a); await closeSheet(b);
  await b.evaluate(() => window.__mana.flush());
  await b.close();
  await flushed(a);
  assert.deepEqual(a.problems, []);
});

test('offline, the events wait; online again, they are sent, each once', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-check&lang=en&gl=off&test=1');
  await flushed(page);
  const stored = [];
  page.on('response', (r) => { if (r.url().endsWith('/rpc/track_events') && r.status() === 200) stored.push(...JSON.parse(r.request().postData()).p_events.map((x) => x.id)); });
  await page.context().setOffline(true);
  await openDish(page, K().lemonade); await page.click('#addBtn2'); await closeSheet(page);
  await page.waitForFunction(() => window.__mana.v2().events.failures >= 1, null, { timeout: 20000 });
  const waiting = await page.evaluate(() => window.__mana.v2().events);
  assert.equal(waiting.queued, 2, 'the dish viewed and the add, kept: ' + JSON.stringify(waiting));
  await page.context().setOffline(false);
  await page.waitForFunction(() => { const q = window.__mana.v2().events; return q.queued === 0 && !q.sending; }, null, { timeout: 30000 });
  const late = page.events.filter((x) => x.name === 'dish_viewed' || x.name === 'basket_added');
  const ids = [...new Set(late.map((x) => x.id))];
  assert.equal(ids.length, 2);
  assert.deepEqual(ids.map((id) => stored.filter((x) => x === id).length), [1, 1], 'each stored once, with the id it was first given');
  page.problems = page.problems.filter((p) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|track_events|public_menu/.test(p));
  assert.deepEqual(page.problems, []);
});

test('a line holds at most 50: an add or a change that would go past it is refused and said, never a dish silently dropped', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-check&lang=en&gl=off&test=1');
  const G2 = check.ids.groups;
  const plain = { quantity: 1, groups: [{ groupId: G2.side, options: [{ optionId: KO().fries, nested: [{ groupId: G2.sauce, options: [{ optionId: KO().aioli }] }] }] }, { groupId: G2.extras, options: [] }] };
  const egg = JSON.parse(JSON.stringify(plain)); egg.groups[1].options = [{ optionId: KO().egg }];
  const basket = { v: 1, lines: [
    { n: 1, dishId: K().lemonade, name: { he: 'לימונדה', en: 'Lemonade' }, selection: { quantity: 1, groups: [] }, quantity: 50 },
    { n: 2, dishId: K().burger, name: { he: 'המבורגר', en: 'Burger' }, selection: plain, quantity: 50 },
    { n: 3, dishId: K().burger, name: { he: 'המבורגר', en: 'Burger' }, selection: egg, quantity: 2 },
  ] };
  await page.evaluate((b) => localStorage.setItem('mana-basket:bistro-check', JSON.stringify(b)), basket);
  await page.reload(); await page.waitForFunction(() => window.__mana && window.__mana.v2());
  const quantities = async () => (await v2(page)).lines.map((l) => l.quantity);
  assert.deepEqual(await quantities(), [50, 50, 2]);
  assert.equal(await text(page, '#trayCount'), '102');

  await openDish(page, K().lemonade);
  await page.click('#addBtn2');
  assert.equal(await text(page, '#v2Need'), 'My table already has 50 of this Lemonade with these choices, the most one line holds.');
  assert.deepEqual(await quantities(), [50, 50, 2], 'nothing added, nothing dropped');
  await shot(page, '22-line-full');
  await closeSheet(page);

  await openTray(page);
  assert.equal(await page.locator('#trayList li.v2-line:nth-child(1) [data-act="more"]').isDisabled(), true, '"+" on a full line');
  await page.click('#trayList li.v2-line:nth-child(3) [data-act="edit"]');                  // the egg line changed to plain would join the full line
  await page.locator('#addBtn2:has-text("Save changes")').waitFor();
  await opt(page, KO().egg).click();
  await page.click('#addBtn2');
  assert.match(await text(page, '#v2Need'), /already has 50 of this Burger/);
  assert.deepEqual(await quantities(), [50, 50, 2], '52 burgers stay 52');
  await closeSheet(page);
  await flushed(page);
  assert.deepEqual(names(page.events.filter((x) => x.name === 'basket_added')), {}, 'no add was counted');
  assert.deepEqual(page.problems, []);
});

test('after a deploy, an app.js that names a v2 module no longer there: the page loads again once, then the menu; still failing, it says so', { timeout: 120000 }, async () => {
  for (const failures of [1, Infinity]) {
    const page = await e.page();
    let left = failures, loads = 0;
    await page.route(/\/v2-[A-Z0-9]+\.js$/, (route) => (left-- > 0 ? route.fulfill({ status: 404, body: 'gone' }) : route.continue()));
    page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame() && /\/view\//.test(r.url())) loads += 1; });      // documents loaded (not the address tidied, nor the hash)
    await page.goto(e.webUrl + 'view/?m=bistro-check&lang=en&gl=off&test=1');
    if (failures === 1) {
      await page.waitForFunction(() => window.__mana && window.__mana.v2 && window.__mana.v2(), null, { timeout: 30000 });
      assert.equal(loads, 2, 'one reload');
      assert.equal(new URL(page.url()).searchParams.has('_r'), false, 'the address is tidied again');
      assert.ok((await page.locator('#list .row').count()) > 0);
    } else {
      await page.locator('#statusTitle', { hasText: 'The menu did not load' }).waitFor({ timeout: 30000 });
      await page.waitForTimeout(1500);
      assert.equal(loads, 2, 'one reload, then the message (never a loop)');
    }
    await page.context().close();
  }
});

test('offline just as the v2 module loads: the menu\'s own "did not load" with Try again, never the browser\'s no-internet page; back online, Try again opens the menu', { timeout: 120000 }, async () => {
  const page = await e.page(), ctx = page.context(), modules = [];
  let loads = 0;
  page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) loads += 1; });
  await page.route(/\/v2-[A-Z0-9]+\.js(\?|$)/, async (route) => {                          // the line drops while the module is on its way
    modules.push(route.request().url());
    await ctx.setOffline(true);
    return route.abort('internetdisconnected');
  });
  loads = 0;
  await page.goto(e.webUrl + 'view/?m=bistro-check&lang=en&gl=off&test=1');
  await page.locator('#statusTitle', { hasText: 'The menu did not load' }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  assert.equal(loads, 1, 'no reload into the browser\'s error page');
  assert.match(page.url(), /\/view\/\?m=bistro-check&lang=en&gl=off&test=1$/, 'still the menu\'s page');
  assert.equal(await page.locator('#statusBtn').innerText(), 'Try again');
  await shot(page, '24-offline-module-load');
  await page.unroute(/\/v2-[A-Z0-9]+\.js(\?|$)/);
  await ctx.setOffline(false);
  await page.click('#statusBtn');
  await page.waitForFunction(() => window.__mana && window.__mana.v2 && window.__mana.v2(), null, { timeout: 30000 });
  assert.ok((await page.locator('#list .row').count()) > 0, 'the menu, in the same page');
  assert.equal(loads, 1);
  assert.equal(modules.length, 1);
  page.problems = page.problems.filter((p) => !/Failed to load resource|ERR_INTERNET_DISCONNECTED|dynamically imported module|public_menu/.test(p));
  assert.deepEqual(page.problems, []);
  await ctx.close();
});

test('production (schema 1) never comes near the v2 module or its reload', { timeout: 120000 }, async () => {
  for (const flags of [{ env: 'production', schema: 1 }, { env: 'production' }, {}]) {
    const page = await e.page(), ctx = page.context(), asked = [];
    let loads = 0;
    page.on('request', (r) => { if (/\/v2-[A-Z0-9]+\.js/.test(r.url())) asked.push(r.url()); if (r.isNavigationRequest() && r.frame() === page.mainFrame()) loads += 1; });
    await ctx.route(/\/config\.js$/, async (route) => {                                      // production's flags (or none) on this stack's config
      const body = await (await route.fetch()).text(), cfg = JSON.parse(body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1));
      delete cfg.env; delete cfg.schema; delete cfg.realtime;
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.HALOM_MENUS_CONFIG = ' + JSON.stringify(Object.assign(cfg, flags)) + ';\n' });
    });
    loads = 0;
    await page.goto(e.webUrl + 'view/?m=bistro-check&lang=en&gl=off&test=1');
    // the v1 reader on this (v2) stack: a menu or the menu's own message, whichever it gets to
    await page.waitForFunction(() => (window.__mana && window.__mana.state && window.__mana.state()) || !['loading', undefined].includes(document.getElementById('status').dataset.kind), null, { timeout: 30000 });
    await page.waitForTimeout(2500);
    assert.deepEqual(asked, [], JSON.stringify(flags) + ': the v2 module is never asked for');
    assert.equal(loads, 1, JSON.stringify(flags) + ': never reloaded');
    assert.equal(await page.evaluate(() => (window.HALOM_MENUS_CONFIG || {}).schema === 2), false);
    assert.equal(await page.evaluate(() => !!(window.__mana && window.__mana.v2 && window.__mana.v2())), false, 'the v1 path');
    await ctx.close();
  }
});

test('Safari and iOS before 16.4 (no lookbehind, no Object.hasOwn, no randomUUID): the v2 menu boots, adds and sends its events', { timeout: 120000 }, async () => {
  const page = await e.page();
  const ctx = page.context(), parsedBad = [];
  await ctx.addInitScript(OLD_SAFARI);
  await ctx.route(/\.js(\?|$)/, async (route) => {                                           // a script holding a lookbehind literal would not parse there
    const r = await route.fetch(), body = await r.text();
    if (LOOKBEHIND.test(body)) { parsedBad.push(route.request().url()); return route.fulfill({ status: 200, contentType: 'application/javascript', body: 'throw new SyntaxError("lookbehind")' }); }
    return route.fulfill({ response: r, body });
  });
  page.events = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/rpc/track_events')) page.events.push(...JSON.parse(r.postData()).p_events); });
  await page.goto(e.webUrl + 'view/?m=bistro-check&lang=he&gl=off&test=1');
  await page.waitForFunction(() => window.__mana && window.__mana.v2 && window.__mana.v2(), null, { timeout: 30000 });
  assert.deepEqual(await page.evaluate(() => [typeof Object.hasOwn, !!(crypto && crypto.randomUUID), (() => { try { new RegExp('(?<=a)b'); return 'lookbehind'; } catch (err) { return 'refused'; } })()]), ['undefined', false, 'refused'], 'the old browser is what it says');
  assert.deepEqual(parsedBad, [], 'no script holds a lookbehind literal');
  assert.ok((await page.locator('#list .row').count()) > 0);
  await openDish(page, K().burger);
  await page.click('#addBtn2');
  await sheetSug(page).locator('.primary').click();
  assert.equal((await v2(page)).total, 6800 + 500);
  await closeSheet(page);
  await page.evaluate(() => Promise.race([window.__mana.flush(), new Promise((r) => setTimeout(r, 20000))]));
  assert.equal((await v2(page)).events.queued, 0);
  assert.ok(page.events.length >= 4 && page.events.every((x) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x.id)), 'every event has a v4 id made without randomUUID');
  await shot(page, '23-old-safari-v2');
  assert.deepEqual(page.problems, []);
  await ctx.close();
});

test('events reach the rollups: after the job, the owner\'s dashboard shows exactly what the browsers sent, once each, also after a retried batch', { timeout: 120000 }, async () => {
  // a batch the server stored but whose answer the phone never got: the phone sends the same ids again
  const page = await phone('m=bistro-sim&lang=en&gl=off&test=1');
  let lost = 0;
  await page.route('**/rest/v1/rpc/track_events', async (route) => {
    if (lost++ === 0) { await route.fetch(); return route.abort('connectionreset'); }
    return route.continue();
  });
  await openDish(page, D().cookie);
  await page.click('#addBtn2');
  await flushed(page);
  const batches = page.events.length;
  assert.ok(new Set(page.events.map((x) => x.id)).size < batches, 'some ids were sent twice');
  page.problems = page.problems.filter((p) => !/Failed to load resource|ERR_CONNECTION_RESET|track_events/.test(p));

  // every Bistro Sim event any phone in this file sent, once per id, as the database must have counted them
  for (const p of pages) await flushed(p);
  const sent = new Map();
  for (const p of pages) for (const ev of p.events) if (ev.venueId === bistro.venueId) sent.set(ev.id, ev);
  // (Café Demo's phone ran on a clock days in the past: the database refuses those times, as it should; not counted here)
  for (const p of pages.filter((x) => x.events.every((ev) => ev.venueId === bistro.venueId))) for (const a of p.answers) if (a) { assert.equal(a.ok, true); assert.deepEqual([a.rejected, a.capped], [[], 0]); }
  const ledger = new Ledger();
  for (const ev of sent.values()) ledger.add(ev);
  await e.stack.buildRollups();
  const dash = await bistro.owner.dashboard('today');
  assert.deepEqual(dash.totals, ledger.totals());
  assert.deepEqual(dash.opensBy, ledger.opensBy());
  for (const r of dash.rules) assert.deepEqual({ shown: r.shown, accepted: r.accepted, dismissed: r.dismissed }, ledger.rule(r.ruleId), 'rule ' + r.label);
  for (const d of dash.topDishes) assert.deepEqual({ views: d.views, adds: d.adds }, ledger.dish(d.dishId), 'dish ' + d.name.en);
  assert.ok(dash.totals.suggestionsAccepted >= 2 && dash.totals.suggestionsDismissed >= 1 && dash.totals.basketAdds >= 5, JSON.stringify(dash.totals));
  assert.deepEqual(page.problems, []);
});
