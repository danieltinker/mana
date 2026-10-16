// The guest menu on the clean schema (config schema 2, apps/view/src/v2/) on a 390×844 phone, against the simulator's
// local stack: choices with a nested sauce and the running price, "from" prices, one suggestion accepted and one
// dismissed, the vegan filter (and what it does to suggestions), an owner taking a dish off mid-visit, the basket and
// its total, day parts and "closed now" on the venue's clock, the table and the list offering the same choices, and the
// events: what the browser sent is exactly what the owner's dashboard shows after the rollup job.
//
// Synthetic venues only (sim/seeds): Bistro Sim (open around the clock) and Café Demo (day parts, real hours).
// Screenshots (demo data) go to e2e/.out/guest-menu/.
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
let e, bistro, cafe;
const pages = [];

before(async () => {
  execFileSync(process.execPath, ['tools/build.mjs'], { cwd: path.join(ROOT, 'apps/view'), stdio: 'ignore' });      // app.js and v2.js
  fs.mkdirSync(SHOTS, { recursive: true });
  e = await startE2E({ seed: 'bistro-sim', gl: true, mounts: { view: path.join(ROOT, 'apps/view'), stock: path.join(ROOT, 'stock') }, config: { liveEveryMs: 800 } });
  bistro = e.venue;
  cafe = await loadSeed(e.stack, readSeed(path.join(SEEDS, 'cafe-demo.json')).seed);
}, { timeout: 240000 });
after(async () => { await e?.stop(); });

/** A phone on the guest menu, with every track_events call it makes (and the answers) kept for the end. */
async function phone(query, { clock = null } = {}) {
  const page = await e.page();
  if (clock !== null) await page.clock.install({ time: clock });
  page.events = []; page.answers = [];
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/rpc/track_events')) page.events.push(...JSON.parse(r.postData()).p_events); });
  page.on('response', async (r) => { if (r.request().method() === 'POST' && r.url().endsWith('/rpc/track_events')) page.answers.push(await r.json().catch(() => null)); });
  await page.goto(e.webUrl + 'view/?' + query);
  await page.waitForFunction(() => window.__mana && window.__mana.state() && window.__mana.v2());
  pages.push(page);
  return page;
}
const names = (list) => list.map((x) => x.name).reduce((m, n) => ((m[n] = (m[n] || 0) + 1), m), {});
const text = (page, sel) => page.locator(sel).innerText();
const D = () => bistro.ids.dishes, O = () => bistro.ids.options, G = () => bistro.ids.groups, R = () => bistro.ids.rules;
const opt = (page, optionId, opener = null) => page.locator((opener ? `.v2-nested[data-for="${opener}"] ` : '#v2Groups > .v2-group > ') + `[data-o="${optionId}"]`);
const sheetSug = (page) => page.locator('#v2SheetSug .v2-sug');
const openDish = async (page, id) => { await page.click(`.row[data-id="${id}"]`); await page.locator('#addBtn2').waitFor(); };
const closeSheet = (page) => page.keyboard.press('Escape');

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

  await page.evaluate(() => window.__mana.flush());
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
  await page.evaluate(() => window.__mana.flush());
  assert.deepEqual(page.problems, []);
});

test('an owner takes a dish off mid-visit: the phone greys it at once, and the basket line that holds it is marked and left out of the total', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-sim&lang=en&gl=off&test=1');
  await openDish(page, D().lemonade);
  await page.click('#addBtn2');
  await closeSheet(page);
  await openDish(page, D().cookie);
  await page.click('#addBtn2');
  await closeSheet(page);
  await bistro.owner.soldOut('dish', D().lemonade, { kind: 'duration', minutes: 120 }, 'ice machine');
  const row = `.row[data-id="${D().lemonade}"]`;
  await page.locator(row + ' .badge.sold').waitFor({ timeout: 10000 });                     // the next live refresh (800 ms here, 30 s by default)
  assert.match(await text(page, row + ' .badge.sold'), /^Sold out · back (at \d\d:\d\d|on \w+)$/);
  assert.equal(await page.evaluate((id) => window.__mana.model().itemById.get(id).item.available, D().lemonade), false);
  await page.click(row);
  assert.equal(await page.isDisabled('#addBtn2'), true, 'never addable');
  assert.match(await text(page, '#addBtn2'), /^Sold out/);
  await closeSheet(page);
  await page.click('#trayBtn');
  await page.locator('#traySheet.open').waitFor();
  const lemonade = page.locator('#trayList li.v2-line', { hasText: 'Lemonade' });
  assert.equal(await lemonade.locator('.l-why').innerText(), 'Sold out now. You can remove it.');
  assert.equal(await lemonade.locator('.l-price').innerText(), 'Not in the total');
  assert.equal(await text(page, '#trayTotal'), '₪9', 'the cookie only');
  await shot(page, '07-sold-out-mid-visit-basket');
  await lemonade.locator('[data-act="remove"]').click();
  assert.equal(await page.locator('#trayList li.v2-line').count(), 1);
  await page.keyboard.press('Escape');

  await bistro.owner.restore('dish', D().lemonade);
  await page.locator(row + ' .badge.sold').waitFor({ state: 'detached', timeout: 10000 });
  assert.equal(await page.evaluate((id) => window.__mana.model().itemById.get(id).item.available, D().lemonade), true);
  await page.evaluate(() => window.__mana.flush());
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
  await shot(table, '08-table-card-from-price');
  await table.evaluate(() => window.__mana.lift(true)); await frames();
  assert.deepEqual(await optionsOf(table), fromList, 'the same groups and options, nested included');
  await opt(table, O()['sweet-potato']).click(); await opt(table, O().harissa, O()['sweet-potato']).click(); await frames(4);
  assert.equal(await text(table, '#addBtn2'), 'Add to my table · ₪79');
  assert.equal(await table.evaluate(() => document.getElementById('app').scrollTop), 0, 'the sheet scrolls, never the page');
  await shot(table, '09-table-sheet-nested');
  await table.evaluate(() => window.__mana.lift(false)); await frames();
  await table.evaluate((id) => window.__mana.goTo(id), D().toast); await frames(30);
  await bistro.owner.soldOut('dish', D().toast, { kind: 'duration', minutes: 60 });
  await table.waitForFunction((id) => window.__mana.model().itemById.get(id).item.available === false, D().toast, { timeout: 10000 });
  await frames(20);
  assert.equal(await table.locator('#dSold').isVisible(), true);
  assert.match(await text(table, '#dSold'), /^Sold out/);
  assert.equal(await table.evaluate(() => window.__mana.info().actors.find((a) => a.id === window.__mana.state().itemId).sat < 0.3), true, 'the stage has taken its colour');
  await shot(table, '10-table-sold-out-greyed');
  await bistro.owner.restore('dish', D().toast);
  await table.evaluate((id) => window.__mana.goTo(id), D().cookie); await frames(30);
  await table.click('#addBtn');                                                             // no choices: added from the card itself
  await table.locator('#v2Float .v2-sug').waitFor();
  assert.match(await text(table, '#v2Float'), /A cold lemonade\?[\s\S]*Lemonade[\s\S]*₪14/, 'the "add" suggestion, over the card');
  assert.equal(await text(table, '#trayCount'), '1');
  await shot(table, '11-table-added-suggestion');
  await table.click('#v2Float .ghost');
  assert.equal(await table.locator('#v2Float').isVisible(), false);

  const he = await phone('m=bistro-sim&lang=he&gl=off&test=1');
  await openDish(he, D().burger);
  assert.equal(await he.evaluate(() => document.documentElement.dir), 'rtl');
  assert.match((await text(he, '#dPriceRow')).replace(/\s+/g, ''), /^החלמ־(68₪|₪68)$/);
  assert.deepEqual(await he.$$eval('#v2Groups > .v2-group > legend', (ls) => ls.map((l) => l.innerText.replace(/\s+/g, ' '))), ['תוספת לבחירה לבחור 1 · חובה', 'תוספות עד 3 · לא חובה']);
  assert.match(await text(he, '#addBtn2'), /^להוסיף לשולחן שלי · /);
  await shot(he, '12-hebrew-sheet');
  for (const p of [list, table, he]) { await p.evaluate(() => window.__mana.flush()); assert.deepEqual(p.problems, []); }
});

test('keyboard and screen reader: every choice is a named control, reachable and operable by keys; text has contrast', { timeout: 120000 }, async () => {
  const page = await phone('m=bistro-sim&lang=en&gl=off&test=1');
  await openDish(page, D().burger);
  const unnamed = await page.$$eval('#v2Groups input, #v2Groups button, #v2SheetSug button, #v2Related button, #addBtn2', (els) => els.filter((el) => {
    const label = el.closest('label'), name = el.getAttribute('aria-label') || (label && label.innerText.trim()) || el.innerText.trim();
    return !name;
  }).map((el) => el.outerHTML.slice(0, 80)));
  assert.deepEqual(unnamed, []);
  assert.deepEqual(await page.$$eval('#v2Groups fieldset > legend', (ls) => ls.length > 0 && ls.every((l) => l.parentElement.tagName === 'FIELDSET')), true, 'each group is a fieldset with its legend');
  await opt(page, O().fries).locator('input').focus();
  await page.keyboard.press('ArrowDown');                                                    // radios move with the arrows
  assert.equal(await opt(page, O().salad).locator('input').isChecked(), true);
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪68');
  await opt(page, O().egg).locator('input').focus();
  await page.keyboard.press('Space');
  assert.equal(await opt(page, O().egg).locator('input').isChecked(), true);
  assert.equal(await text(page, '#addBtn2'), 'Add to my table · ₪73');
  const contrast = await page.evaluate(() => {
    const rgb = (c) => c.match(/[\d.]+/g).slice(0, 3).map(Number), lum = (c) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }, bg = 'rgb(17, 13, 10)';
    return ['.g-name', '.g-hint', '.o-name', '.o-price', '#addBtn2', '.s-line', '.s-kicker', '.r-price'].map((q) => { const el = document.querySelector(q); return [q, el ? +ratio(getComputedStyle(el).color, q === '#addBtn2' ? getComputedStyle(el).backgroundColor : bg).toFixed(2) : null]; });
  });
  for (const [q, r] of contrast) assert.ok(r === null || r >= 4.5, q + ' contrast ' + r);
  await page.evaluate(() => window.__mana.flush());
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
  await shot(page, '13-cafe-demo-closed-day-parts');
  await page.clock.fastForward('36:00');                                                    // 07:06
  await page.evaluate(() => window.__mana.refresh());
  await badge(C.shakshuka).waitFor({ state: 'detached' });
  assert.equal(await page.locator('.v2-pill.closed').count(), 0);
  await openDish(page, C.shakshuka);
  assert.equal(await page.isDisabled('#addBtn2'), false);
  assert.deepEqual(page.problems, []);
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
  await page.evaluate(() => window.__mana.flush());
  const batches = page.events.length;
  assert.ok(new Set(page.events.map((x) => x.id)).size < batches, 'some ids were sent twice');
  page.problems = page.problems.filter((p) => !/Failed to load resource|ERR_CONNECTION_RESET|track_events/.test(p));

  // every Bistro Sim event any phone in this file sent, once per id, as the database must have counted them
  for (const p of pages) await p.evaluate(() => window.__mana.flush()).catch(() => {});
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
