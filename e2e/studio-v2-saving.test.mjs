// The owner app v2's saving on a slow, failing or forgetful network, on a 390 × 844 phone against the simulator's stack
// (the QA review's second and third rounds, kept as tests): two edits in flight, answers that come back stale, lost, late
// or never, retries from inside an open sheet and when the connection returns, two tabs on a section and on a group, links
// and quick adds tried again, a manager whose role changes or who is removed, a counter on every address, the session
// ending mid-save, and the ways out of a screen with changes (signing out, the bottom bar, the browser's Back, Escape).
// Invented data only. Needs the built site (bash tools/build-site.sh).
// Screenshots: e2e/.out/studio-v2-saving/.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createUser, HalomBot, OwnerBot } from '@mana/sim';
import { OUT, startE2E } from './helpers.mjs';

const SHOTS = path.join(OUT, 'studio-v2-saving');
const PASSWORD = 'sim-owner-pass-1';
const EMAIL = 'save-owner@sim.local';
const SLUG = 'save-burger-sim';
let e, owner, venueId, ids;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, what, ms = 15000) {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out: ' + what); await sleep(150); }
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });

before(async () => {
  e = await startE2E({ seed: null });
  if (!e.hasSite) throw new Error('the site is not built: run bash tools/build-site.sh first');
  fs.mkdirSync(SHOTS, { recursive: true });
  owner = await OwnerBot.signUp(e.stack, { email: EMAIL, password: PASSWORD });
  assert.equal((await owner.createVenue({ slug: SLUG, name: { he: 'בורגר שמירה', en: 'Saving Burger' }, kind: 'restaurant' })).ok, true);
  venueId = owner.venueId;
  const n = (he, en) => ({ he, en });
  ids = await owner.buildMenu({
    sections: [{ key: 'mains', name: n('עיקריות', 'Mains'), dishes: [
      { key: 'burger', name: n('המבורגר', 'Burger'), price: 6200, groups: ['extras'] },
      { key: 'plain', name: n('פשוט', 'Plain'), price: 900 },
      { key: 'plain2', name: n('פשוט שני', 'Plain two'), price: 800 },
      { key: 'plain3', name: n('פשוט שלישי', 'Plain three'), price: 700 },
    ] }, { key: 'drinks', name: n('שתייה', 'Drinks'), dishes: [{ key: 'cola', name: n('קולה', 'Cola'), price: 1000 }] }],
    groups: [
      { key: 'extras', name: n('תוספות', 'Extras'), selection: 'multiple', min: 0, max: 3, options: [{ key: 'cheese', name: n('גבינה', 'Cheese'), price: 400, maxQty: 2 }, { key: 'bacon', name: n('בייקון', 'Bacon'), price: 600, maxQty: 3 }] },
      { key: 'spare', name: n('רזרבה', 'Spare'), selection: 'single', min: 0, max: 1, options: [{ key: 'sp1', name: n('אחת', 'One') }] },
    ],
  });
  assert.equal((await owner.publish('saving')).ok, true);
  const halom = await HalomBot.firstAdmin(e.stack, e.stack, { email: 'save-halom@sim.local' });
  assert.equal((await halom.approve(venueId, 'e2e: the saving venue')).ok, true);
}, { timeout: 240000 });
after(async () => { await e?.stop(); });

async function signedIn(email = EMAIL, ctx = null) {
  const page = ctx ? await ctx.newPage() : await e.page(e.webUrl + 'studio/');
  if (ctx) await page.goto(e.webUrl + 'studio/');
  await page.locator('[data-screen="start"], .shell').first().waitFor({ timeout: 20000 });
  if (await page.locator('[data-screen="start"]').count()) {
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'המשך' }).click();
  }
  await page.locator('.shell').waitFor({ timeout: 20000 });
  return page;
}
const dishRow = async (key) => (await owner.api.select('dishes', { select: '*', id: `eq.${ids.dishes[key]}` }))[0];
const groupRow = async (key) => (await owner.api.select('addon_groups', { select: '*', id: `eq.${ids.groups[key]}` }))[0];
const optionsOf = async (gid) => owner.api.select('addon_options', { select: '*', group_id: `eq.${gid}`, order: 'position' });
async function openDish(page, key, tab = 'details') {
  await page.goto(e.webUrl + 'studio/#/menu/d/' + ids.dishes[key] + '/' + tab);
  const sheet = page.locator('dialog[data-sheet="dish"]');
  await sheet.waitFor();
  return sheet;
}
async function openGroup(page, key) {
  await page.goto(e.webUrl + 'studio/#/addons/' + (ids.groups[key] ?? key));
  const ed = page.locator('[data-screen="group-editor"]');
  await ed.waitFor();
  return ed;
}
const reset = (key, cols) => owner.api.update('dishes', { id: `eq.${ids.dishes[key]}` }, cols);
const priceOf = (sheet) => sheet.locator('[data-field="dish-price"]');
/** The dish table's PATCHes: each one counted, the first `slow` held back `ms`, the first `fail` dropped after that. */
async function slowDishes(page, { ms = 2000, fail = 0, slow = 1, lose = 0 } = {}) {
  const bodies = [];
  let n = 0;
  const match = (u) => u.pathname.endsWith('/rest/v1/dishes');
  await page.route(match, async (r) => {
    if (r.request().method() !== 'PATCH') return r.continue();
    const i = n++;
    bodies.push(JSON.parse(r.request().postData() || '{}'));
    if (i < slow) await sleep(ms);
    if (i < lose) { await r.fetch(); return r.abort('internetdisconnected'); }
    if (i < fail) return r.abort('internetdisconnected');
    return r.continue();
  });
  return { bodies, stop: () => page.unroute(match) };
}

// ------------------------------------------------------------------ two edits in flight
test('slow network: an edit typed behind one that comes back stale is never written without the owner, who is asked about the latest', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const sheet = await openDish(page, 'plain');
  await reset('plain', { price: 1500 });                                   // another device, after this screen read it
  const net = await slowDishes(page, { ms: 2500 });
  await priceOf(sheet).fill('10');
  await sleep(1000);                                                       // the first save is on its way (slow)
  await priceOf(sheet).fill('11');
  const dlg = page.locator('dialog[data-conflict]');
  await dlg.waitFor({ timeout: 10000 });
  await sleep(1200);
  assert.equal((await dishRow('plain')).price, 1500, 'nothing written while the owner is asked');
  assert.deepEqual(net.bodies, [{ price: 1000 }], 'the second edit was never sent');
  assert.equal(await dlg.locator('tr[data-col="price"] [data-mine]').innerText(), '₪11', 'the question is about the latest value');
  assert.equal(await dlg.locator('tr[data-col="price"] [data-stored]').innerText(), '₪15');
  await shot(page, '01-asked-about-the-latest');
  await dlg.locator('[data-action="take-stored"]').click();
  await until(async () => (await priceOf(sheet).inputValue()) === '15', 'the screen shows the stored price');
  await sleep(800);
  assert.equal((await dishRow('plain')).price, 1500);
  assert.equal(await page.locator('[data-save="saved"]').count(), 1);
  // again, and this time "keep mine": the latest value is stored
  await net.stop();
  const net2 = await slowDishes(page, { ms: 2500 });
  await reset('plain', { price: 1600 });
  await priceOf(sheet).fill('12');
  await sleep(1000);
  await priceOf(sheet).fill('13');
  await dlg.waitFor({ timeout: 10000 });
  await dlg.locator('[data-action="keep-mine"]').click();
  await until(async () => (await dishRow('plain')).price === 1300, 'the latest typed price stored');
  assert.deepEqual(net2.bodies, [{ price: 1200 }, { price: 1300 }]);
  await net2.stop();
  await reset('plain', { price: 900 });
  await page.context().close();
});

test('slow failing network: two edits both fail; the retry inside the open sheet saves both, and the badge says saved only then', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const sheet = await openDish(page, 'plain2');
  const net = await slowDishes(page, { ms: 2000, fail: 1 });
  await priceOf(sheet).fill('13');
  await sleep(900);
  await sheet.locator('[data-field="dish-desc-he"]').fill('בזמן ניתוק');
  await sheet.locator('[data-save-failed]').waitFor({ timeout: 10000 });
  await sleep(1500);
  assert.deepEqual(net.bodies, [{ price: 1300 }], 'nothing more sent after the failure');
  assert.equal(await page.locator('[data-save="failed"]').count(), 1);
  await shot(page, '02-failed-inside-the-sheet');
  await sheet.locator('[data-save-failed] [data-action="retry-saves"]').click();     // reachable while the sheet is open
  await until(async () => { const r = await dishRow('plain2'); return r.price === 1300 && r.desc_he === 'בזמן ניתוק'; }, 'both saved by the retry');
  assert.deepEqual(net.bodies.at(-1), { price: 1300, desc_he: 'בזמן ניתוק' });
  await page.locator('[data-save="saved"]').waitFor();
  await net.stop();
  await reset('plain2', { price: 800, desc_he: '' });
  await page.context().close();
});

test('the first edit fails and the second (same field) was typed meanwhile: the retry stores the latest, never the older one', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const sheet = await openDish(page, 'plain3');
  const net = await slowDishes(page, { ms: 2000, fail: 1 });
  await priceOf(sheet).fill('13');
  await sleep(900);
  await priceOf(sheet).fill('14');
  await page.locator('[data-save="failed"]').waitFor({ timeout: 10000 });
  await sleep(1000);
  assert.equal((await dishRow('plain3')).price, 700);
  await sheet.locator('[data-action="retry-saves"]').click();
  await until(async () => (await dishRow('plain3')).price === 1400, 'the latest typed price');
  await sleep(800);
  assert.equal((await dishRow('plain3')).price, 1400);
  assert.equal(await priceOf(sheet).inputValue(), '14');
  await net.stop();
  await reset('plain3', { price: 700 });
  await page.context().close();
});

test('the connection comes back: what failed is sent again by itself', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const sheet = await openDish(page, 'plain3');
  const net = await slowDishes(page, { ms: 0, slow: 0, fail: 1 });
  await priceOf(sheet).fill('15');
  await page.locator('[data-save="failed"]').waitFor({ timeout: 10000 });
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await until(async () => (await dishRow('plain3')).price === 1500, 'saved when the connection came back');
  await page.locator('[data-save="saved"]').waitFor();
  await net.stop();
  await reset('plain3', { price: 700 });
  await page.context().close();
});

test('a lost answer on a dish edit, then another field: no "changed somewhere else" about the owner\'s own save', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const sheet = await openDish(page, 'plain');
  const net = await slowDishes(page, { ms: 0, slow: 0, lose: 1 });
  await priceOf(sheet).fill('13');
  await page.locator('[data-save="failed"]').waitFor();
  assert.equal((await dishRow('plain')).price, 1300, 'the write reached the database');
  await sheet.locator('[data-field="dish-desc-he"]').fill('אחרי תשובה שאבדה');
  await sheet.locator('[data-action="retry-saves"]').click();
  await until(async () => (await dishRow('plain')).desc_he === 'אחרי תשובה שאבדה', 'the description saved');
  await sleep(800);
  assert.equal(await page.locator('dialog[data-conflict]').count(), 0, 'the owner is not told another device changed the dish');
  await page.locator('[data-save="saved"]').waitFor();
  await net.stop();
  await reset('plain', { price: 900, desc_he: '' });
  await page.context().close();
});

// ------------------------------------------------------------------ two tabs on a section and on a group
test('two tabs on one section: "keep mine" writes only what this tab changed', { timeout: 120000 }, async () => {
  const a = await signedIn();
  const b = await signedIn(EMAIL, a.context());
  const sec = ids.sections.drinks;
  await a.goto(e.webUrl + 'studio/#/menu/s/' + sec); await b.goto(e.webUrl + 'studio/#/menu/s/' + sec);
  const sa = a.locator('dialog[data-sheet="section"]'), sb = b.locator('dialog[data-sheet="section"]');
  await sa.waitFor(); await sb.waitFor();
  await sa.locator('[data-field="section-name-he"]').fill('שתייה קרה');
  await sa.locator('[data-action="save-section"]').click();
  await until(async () => (await owner.api.select('sections', { select: 'name_he', id: `eq.${sec}` }))[0].name_he === 'שתייה קרה', 'A renamed');
  await sb.getByRole('switch').first().click();
  await sb.locator('[data-action="save-section"]').click();
  const dlg = b.locator('dialog[data-conflict]');
  await dlg.waitFor();
  assert.match(await dlg.locator('[data-there]').innerText(), /שם הקטגוריה/);
  await dlg.locator('[data-action="keep-mine"]').click();
  await until(async () => (await owner.api.select('sections', { select: 'hidden', id: `eq.${sec}` }))[0].hidden === true, 'B\'s switch stored');
  const row = (await owner.api.select('sections', { select: '*', id: `eq.${sec}` }))[0];
  assert.equal(row.name_he, 'שתייה קרה', 'A\'s name stays');
  await owner.api.update('sections', { id: `eq.${sec}` }, { name_he: 'שתייה', hidden: false });
  await a.context().close();
});

test('a group saved elsewhere: "save my changes over it" stores only what this form changed, never what it did not show', { timeout: 120000 }, async () => {
  const a = await signedIn();
  const b = await signedIn(EMAIL, a.context());
  const ea = await openGroup(a, 'extras'), eb = await openGroup(b, 'extras');
  // B: a label, bacon at most 1 per dish, the English name
  await eb.locator('[data-field="group-label"]').fill('תווית מ־ב');
  const bacon = eb.locator(`li[data-option="${ids.options.bacon}"]`);
  for (let i = 0; i < 2; i++) await bacon.getByRole('button', { name: /^פחות/ }).click();
  await eb.getByRole('button', { name: 'English' }).click();
  await eb.locator('[data-field="group-name-en"]').fill('Extras B');
  await eb.locator('[data-action="save-group"]').click();
  await until(async () => (await groupRow('extras')).label === 'תווית מ־ב', 'B saved');
  // A: renames the group in Hebrew and makes cheese dearer; stale; saves its changes over B's
  await ea.locator('[data-field="group-name-he"]').fill('תוספות א');
  await ea.locator(`li[data-option="${ids.options.cheese}"] input[inputmode="decimal"]`).fill('5');
  await ea.locator('[data-action="save-group"]').click();
  await ea.locator('[data-stale]').waitFor();
  assert.match(await ea.locator('[data-mine-only]').innerText(), /רק מה ששיניתם כאן/);
  await shot(a, '03-group-stale');
  await ea.locator('[data-action="keep-mine"]').click();
  await until(async () => (await groupRow('extras')).name_he === 'תוספות א', 'A\'s name stored');
  const g = await groupRow('extras'), opts = await optionsOf(ids.groups.extras);
  assert.deepEqual([g.label, g.name_en], ['תווית מ־ב', 'Extras B'], 'B\'s label and English name stay');
  assert.equal(opts.find((o) => o.id === ids.options.bacon).max_qty, 1, 'B\'s most-per-dish stays');
  assert.equal(opts.find((o) => o.id === ids.options.cheese).price, 500, 'A\'s price goes over');
  await owner.api.update('addon_groups', { id: `eq.${ids.groups.extras}` }, { name_he: 'תוספות', name_en: 'Extras', label: '' });
  await owner.api.update('addon_options', { id: `eq.${ids.options.bacon}` }, { max_qty: 3 });
  await owner.api.update('addon_options', { id: `eq.${ids.options.cheese}` }, { price: 400 });
  await a.context().close();
});

// ------------------------------------------------------------------ links and quick adds tried again
test('lost answers on a link and a quick add: the screen shows what is stored, and what was retyped is what is stored', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const sheet = await openDish(page, 'plain', 'addons');
  let armed = true;
  const links = (u) => u.pathname.endsWith('/rest/v1/dish_addon_groups');
  await page.route(links, async (r) => {
    if (armed && r.request().method() === 'POST') { armed = false; await r.fetch(); return r.abort('internetdisconnected'); }
    return r.continue();
  });
  await sheet.locator('[data-action="attach"]').click();
  await sheet.locator(`[data-attach="${ids.groups.spare}"]`).click();
  await sleep(1200);
  await sheet.locator(`[data-attach="${ids.groups.spare}"]`).click();      // the owner attaches again
  await sheet.locator('.attached').first().waitFor();
  const stored = await owner.api.select('dish_addon_groups', { select: 'id', dish_id: `eq.${ids.dishes.plain}` });
  assert.deepEqual([await sheet.locator('.attached').count(), stored.length], [1, 1]);
  await page.unroute(links);
  await owner.api.remove('dish_addon_groups', { dish_id: `eq.${ids.dishes.plain}` });

  await page.goto(e.webUrl + 'studio/#/menu');
  armed = true;
  const dishes = (u) => u.pathname.endsWith('/rest/v1/dishes');
  await page.route(dishes, async (r) => {
    if (armed && r.request().method() === 'POST') { armed = false; await r.fetch(); return r.abort('internetdisconnected'); }
    return r.continue();
  });
  await page.getByRole('button', { name: 'מנה חדשה בשתייה' }).click();
  const quick = page.locator(`form[data-quick="${ids.sections.drinks}"]`);
  await quick.getByLabel('שם המנה').fill('סודה');
  await quick.getByLabel('מחיר').fill('8');
  await quick.getByRole('button', { name: 'הוספה' }).click();
  await quick.locator('.ferr').waitFor();
  await quick.getByLabel('שם המנה').fill('סודה גדולה');                     // corrected before adding again
  await quick.getByLabel('מחיר').fill('12');
  await quick.getByRole('button', { name: 'הוספה' }).click();
  await page.locator('[data-dish]', { hasText: 'סודה גדולה' }).waitFor();
  const inDrinks = await owner.api.select('dishes', { select: 'name_he,price', section_id: `eq.${ids.sections.drinks}`, name_he: 'like.סודה*' });
  assert.deepEqual(inDrinks, [{ name_he: 'סודה גדולה', price: 1200 }]);
  await page.unroute(dishes);
  await owner.api.remove('dishes', { section_id: `eq.${ids.sections.drinks}`, name_he: 'like.סודה*' });
  await page.context().close();
});

test('a dish\'s own limits: a lost answer, then saved again, is saved', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const sheet = await openDish(page, 'burger', 'addons');
  await sheet.getByRole('button', { name: /הגבולות של/ }).first().click();
  const lim = sheet.locator('[data-limits]');
  await lim.locator('[data-field="dish-max"]').selectOption('2');
  let armed = true;
  const links = (u) => u.pathname.endsWith('/rest/v1/dish_addon_groups');
  await page.route(links, async (r) => {
    if (armed && r.request().method() === 'PATCH') { armed = false; await r.fetch(); return r.abort('internetdisconnected'); }
    return r.continue();
  });
  await lim.locator('[data-action="save-limits"]').click();
  await lim.locator('.note-error').waitFor();
  await lim.locator('[data-action="save-limits"]').click();
  await sheet.locator('[data-tighter]').waitFor();
  assert.equal((await owner.api.select('dish_addon_groups', { select: 'max_units', dish_id: `eq.${ids.dishes.burger}` }))[0].max_units, 2);
  await page.unroute(links);
  await owner.api.update('dish_addon_groups', { dish_id: `eq.${ids.dishes.burger}` }, { max_units: null });
  await page.context().close();
});

// ------------------------------------------------------------------ roles that change
test('a manager made counter: a group save, a move and a quick add each say "not allowed" and turn the screen read-only', { timeout: 180000 }, async () => {
  const mgr = await createUser(e.stack, { email: 'save-manager@sim.local', password: PASSWORD });
  await e.stack.addMember(venueId, mgr.id, 'manager');
  const demote = () => e.stack.sql(`update public.venue_members set role = 'counter' where venue_id = $1 and user_id = $2`, [venueId, mgr.id]);
  const promote = () => e.stack.sql(`update public.venue_members set role = 'manager' where venue_id = $1 and user_id = $2`, [venueId, mgr.id]);
  const m = await signedIn('save-manager@sim.local');
  // the group editor
  const ed = await openGroup(m, 'spare');
  await demote();
  await ed.locator('[data-field="group-label"]').fill('מנהל');
  await ed.locator('[data-action="save-group"]').click();
  await ed.locator('fieldset[data-readonly]').waitFor();
  assert.equal(await ed.locator('[data-action="save-group"]').count(), 0);
  assert.equal((await groupRow('spare')).label, '');
  // a move
  await promote(); await m.reload(); await m.locator('.shell').waitFor();
  await m.goto(e.webUrl + 'studio/#/menu');
  await m.locator('[data-tool="arrange"]').click();
  await demote();
  await m.getByRole('button', { name: 'להוריד את פשוט', exact: true }).click();
  await m.getByText('אין לחשבון הזה הרשאה לפעולה הזאת.').first().waitFor();
  await until(async () => (await m.locator('[data-tool="arrange"]').count()) === 0, 'the menu turned read-only');
  // a quick add
  await promote(); await m.reload(); await m.locator('.shell').waitFor();
  await m.goto(e.webUrl + 'studio/#/menu');
  await m.getByRole('button', { name: 'מנה חדשה בשתייה' }).click();
  await demote();
  const quick = m.locator(`form[data-quick="${ids.sections.drinks}"]`);
  await quick.getByLabel('שם המנה').fill('מים');
  await quick.getByRole('button', { name: 'הוספה' }).click();
  await until(async () => (await m.locator('[data-tool="arrange"]').count()) === 0, 'read-only after the refused add');
  await shot(m, '04-made-counter');
  await e.stack.sql(`delete from public.venue_members where venue_id = $1 and user_id = $2`, [venueId, mgr.id]);
  await m.context().close();
});

test('a manager removed from the place mid-edit: told "not allowed", the dish stays on screen', { timeout: 120000 }, async () => {
  const mgr = await createUser(e.stack, { email: 'save-gone@sim.local', password: PASSWORD });
  await e.stack.addMember(venueId, mgr.id, 'manager');
  const m = await signedIn('save-gone@sim.local');
  const sheet = await openDish(m, 'cola');
  await e.stack.sql(`delete from public.venue_members where venue_id = $1 and user_id = $2`, [venueId, mgr.id]);
  await priceOf(sheet).fill('11');
  await m.getByText('אין לחשבון הזה הרשאה לפעולה הזאת.').first().waitFor();
  assert.equal(await m.getByText('זה כבר לא קיים').count(), 0);
  await m.keyboard.press('Escape');
  await m.locator(`[data-dish="${ids.dishes.cola}"]`).waitFor();
  assert.equal((await dishRow('cola')).price, 1000);
  await m.context().close();
});

test('a counter: eleven addresses, nothing editable, not one write', { timeout: 180000 }, async () => {
  const c = await createUser(e.stack, { email: 'save-counter@sim.local', password: PASSWORD });
  await e.stack.addMember(venueId, c.id, 'counter');
  const page = await signedIn('save-counter@sim.local');
  const writes = [];
  page.on('request', (r) => { if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(r.method()) && /\/rest\/v1\/(?!rpc\/(preview_menu|public_menu))/.test(r.url())) writes.push(r.method() + ' ' + new URL(r.url()).pathname); });
  const where = ['#/menu', '#/menu/d/' + ids.dishes.burger + '/details', '#/menu/d/' + ids.dishes.burger + '/addons', '#/menu/d/' + ids.dishes.burger + '/related',
    '#/menu/s/' + ids.sections.mains, '#/menu/s/new', '#/addons', '#/addons/' + ids.groups.extras, '#/addons/new', '#/publish', '#/new'];
  for (const w of where) {
    await page.goto(e.webUrl + 'studio/' + w);
    await sleep(1000);
    if (w === '#/new') continue;                       // a place of one's own: anyone may make one (nothing typed here)
    // what could change the place (the guest preview's choices are a try-out, not an edit)
    const live = await page.locator(':is(input, textarea, select):not([disabled])').evaluateAll((els) => els.filter((x) => !x.closest('[data-guest-preview]')).length);
    const edits = await page.locator('[data-action="save-group"], [data-action="save-section"], [data-action="delete-dish"], [data-action="attach"], [data-action="publish"], [data-tool]').count();
    assert.deepEqual([w, live, edits], [w, 0, 0]);
  }
  assert.deepEqual(writes, []);
  await e.stack.sql(`delete from public.venue_members where venue_id = $1 and user_id = $2`, [venueId, c.id]);
  await page.context().close();
});

// ------------------------------------------------------------------ the ways out
test('signing out with a change that did not save asks first; leaving a changed group form by the bottom bar asks first', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const sheet = await openDish(page, 'plain');
  const net = await slowDishes(page, { ms: 0, slow: 0, fail: 99 });
  await priceOf(sheet).fill('13');
  await page.locator('[data-save="failed"]').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('[data-action="account"]').click();
  await page.locator('[data-menu="sign-out"]').click();
  const ask = page.getByRole('dialog', { name: 'יש שינויים שלא נשמרו' });
  await ask.waitFor();
  assert.match(await ask.innerText(), /אם תצאו עכשיו מהחשבון/);
  await ask.getByRole('button', { name: 'ביטול' }).click();
  assert.equal(await page.locator('.shell').count(), 1, 'still signed in');
  await net.stop();
  await page.locator('[data-action="retry-saves"]').click();
  await until(async () => (await dishRow('plain')).price === 1300, 'saved after all');
  // a group form with changes, and the bottom bar
  const ed = await openGroup(page, 'spare');
  await ed.locator('[data-field="group-label"]').fill('לא נשמר');
  await page.locator('nav a[data-tab="menu"]').click();
  const leave = page.getByRole('dialog', { name: 'לצאת בלי לשמור?' });
  await leave.waitFor();
  assert.equal(await page.evaluate(() => location.hash), '#/addons/' + ids.groups.spare);
  await leave.getByRole('button', { name: 'לצאת בלי לשמור' }).click();
  await until(async () => (await page.evaluate(() => location.hash)) === '#/menu', 'left after the owner said so');
  assert.equal((await groupRow('spare')).label, '');
  await reset('plain', { price: 900 });
  await page.context().close();
});

// ------------------------------------------------------------------ round 3: answers that come late, or never
const sectionRow = async (key) => (await owner.api.select('sections', { select: '*', id: `eq.${ids.sections[key]}` }))[0];

test('a whole-menu read answered late (after a stale move) never puts back what the owner renamed meanwhile, nor asks about it', { timeout: 150000 }, async () => {
  const page = await signedIn();
  await page.goto(e.webUrl + 'studio/#/menu');
  await page.locator('[data-screen="menu"]').waitFor();
  // the next whole-menu read of the dishes reaches the database at once, its answer reaches the phone 9 s later
  let armed = false, heldAt = 0, releasedAt = 0;
  const dishes = (u) => u.pathname.endsWith('/rest/v1/dishes');
  await page.route(dishes, async (r) => {
    if (!armed || r.request().method() !== 'GET' || !/venue_id=eq/.test(r.request().url())) return r.continue();
    armed = false; heldAt = Date.now();
    const answer = await r.fetch();
    await sleep(9000);
    releasedAt = Date.now();
    return r.fulfill({ response: answer });
  });
  // another device moves the drinks section: this screen's move is stale, so the menu is read again
  await owner.api.update('sections', { id: `eq.${ids.sections.drinks}` }, { position: 7 });
  armed = true;
  await page.locator('[data-tool="arrange"]').click();
  await page.locator(`section[data-section="${ids.sections.mains}"] .sec-head [data-move="down"]`).click();
  await until(async () => heldAt > 0, 'the menu read again');
  await page.locator('[data-tool="arrange"]').click();
  // meanwhile the owner renames the cola, and it is stored
  const sheet = await openDish(page, 'cola');
  const name = sheet.locator('[data-field="dish-name-he"]');
  await name.fill('קולה זירו');
  await until(async () => (await dishRow('cola')).name_he === 'קולה זירו', 'the new name stored', 8000);
  assert.equal(releasedAt, 0, 'stored while the read was still on its way');
  await until(async () => releasedAt > 0, 'the late answer', 15000);
  await sleep(1500);
  assert.equal(await name.inputValue(), 'קולה זירו', 'the form keeps what the owner saved');
  await shot(page, '05-late-read');
  // the next edit, another field: no "changed somewhere else" about the owner's own save
  await priceOf(sheet).fill('11');
  await until(async () => (await dishRow('cola')).price === 1100, 'the price stored');
  await sleep(800);
  assert.equal(await page.locator('dialog[data-conflict]').count(), 0);
  await page.unroute(dishes);
  await reset('cola', { name_he: 'קולה', price: 1000 });
  await owner.api.update('sections', { id: `eq.${ids.sections.drinks}` }, { position: 1 });
  await page.context().close();
});

test('a write that never answers: after a while it is "not saved" with a retry; signing out says it is waiting, then asks', { timeout: 150000 }, async () => {
  const page = await signedIn();
  const sheet = await openDish(page, 'plain2');
  const dishes = (u) => u.pathname.endsWith('/rest/v1/dishes');
  let hold = true;
  await page.route(dishes, async (r) => {
    if (hold && r.request().method() === 'PATCH') return new Promise(() => {});      // no answer, ever
    return r.continue();
  });
  await priceOf(sheet).fill('14');
  await page.locator('[data-save="saving"]').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('[data-action="account"]').click();
  const out = page.locator('[data-menu="sign-out"]');
  await out.click();
  await until(async () => /שומרים את השינויים האחרונים/.test(await out.innerText()), 'the sign-out says it is waiting', 3000);
  await shot(page, '06-signing-out-waits');
  const ask = page.getByRole('dialog', { name: 'יש שינויים שלא נשמרו' });
  await ask.waitFor({ timeout: 25000 });                                             // the write counts as failed after 15 s
  await ask.getByRole('button', { name: 'ביטול' }).click();
  assert.equal(await page.locator('.shell').count(), 1, 'still signed in');
  assert.equal(await page.locator('[data-save]').getAttribute('data-save'), 'failed');
  hold = false;
  await page.locator('[data-action="retry-saves"]').click();
  await until(async () => (await dishRow('plain2')).price === 1400, 'stored by the retry');
  await page.locator('[data-save="saved"]').waitFor();
  await page.unroute(dishes);
  await reset('plain2', { price: 800 });
  await page.context().close();
});

test('the session ends (401) during an autosave: the start screen says so and names the dish whose change may not be saved', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const sheet = await openDish(page, 'plain2');
  let n = 0;
  await page.route((u) => u.pathname.endsWith('/rest/v1/dishes'), async (r) => {
    if (r.request().method() !== 'PATCH' || n++ > 0) return r.continue();
    return r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST301', details: null, hint: null, message: 'JWT expired' }) });
  });
  await priceOf(sheet).fill('17');
  const note = page.locator('[data-screen="start"] [data-session-ended]');
  await note.waitFor({ timeout: 15000 });
  assert.match(await note.innerText(), /החיבור לחשבון הסתיים/);
  assert.match(await page.locator('[data-session-unsaved]').innerText(), /"פשוט שני"/);
  await shot(page, '07-session-ended');
  assert.equal((await dishRow('plain2')).price, 800);
  await page.context().close();
});

test('the browser\'s Back on a changed group form asks, and staying keeps the form; a section sheet asks on Escape and on Back', { timeout: 120000 }, async () => {
  const page = await signedIn();
  await page.goto(e.webUrl + 'studio/#/addons');
  await page.locator('[data-screen="addons"]').waitFor();
  const ed = await openGroup(page, 'spare');
  const here = '#/addons/' + ids.groups.spare;
  await ed.locator('[data-field="group-label"]').fill('לא נשמר בכלל');
  const leave = page.getByRole('dialog', { name: 'לצאת בלי לשמור?' });
  await page.goBack();
  await leave.waitFor();
  assert.equal(await page.evaluate(() => location.hash), here, 'the address is the form\'s again');
  await leave.getByRole('button', { name: 'ביטול' }).click();
  assert.equal(await ed.locator('[data-field="group-label"]').inputValue(), 'לא נשמר בכלל', 'staying keeps what was typed');
  await page.goBack();                                                               // Back once more asks again
  await leave.waitFor();
  await leave.getByRole('button', { name: 'לצאת בלי לשמור' }).click();
  await page.locator('[data-screen="addons"]').waitFor();
  assert.equal(await page.evaluate(() => location.hash), '#/addons');
  assert.equal((await groupRow('spare')).label, '');
  // a section sheet with a changed name: Escape asks, Back asks
  await page.goto(e.webUrl + 'studio/#/menu');
  await page.locator('[data-screen="menu"]').waitFor();
  await page.goto(e.webUrl + 'studio/#/menu/s/' + ids.sections.drinks);
  const ss = page.locator('dialog[data-sheet="section"]');
  await ss.waitFor();
  await ss.locator('[data-field="section-name-he"]').fill('שתייה חמה');
  await page.keyboard.press('Escape');
  await leave.waitFor();
  await leave.getByRole('button', { name: 'ביטול' }).click();
  assert.equal(await ss.locator('[data-field="section-name-he"]').inputValue(), 'שתייה חמה');
  await page.goBack();
  await leave.waitFor();
  assert.equal(await page.evaluate(() => location.hash), '#/menu/s/' + ids.sections.drinks);
  await leave.getByRole('button', { name: 'לצאת בלי לשמור' }).click();
  await until(async () => (await ss.count()) === 0, 'the sheet closed after the owner said so');
  assert.equal((await sectionRow('drinks')).name_he, 'שתייה');
  await page.context().close();
});

test('the owner\'s own group save whose answer was lost: the next save is not "saved on another screen"', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const ed = await openGroup(page, 'extras');
  let lose = 1;
  const rpc = (u) => u.pathname.endsWith('/rest/v1/rpc/save_addon_group');
  await page.route(rpc, async (r) => {
    if (lose-- > 0) { await r.fetch(); return r.abort('internetdisconnected'); }
    return r.continue();
  });
  await ed.locator('[data-field="group-label"]').fill('תווית ראשונה');
  await ed.locator('[data-action="save-group"]').click();
  await ed.locator('[data-error]').waitFor();
  assert.equal((await groupRow('extras')).label, 'תווית ראשונה', 'the first save reached the database');
  await ed.locator('[data-field="group-name-he"]').fill('תוספות שלי');
  await ed.locator('[data-action="save-group"]').click();
  await until(async () => (await groupRow('extras')).name_he === 'תוספות שלי', 'the second save stored');
  await sleep(800);
  assert.equal(await ed.locator('[data-stale]').count(), 0, 'no "saved on another screen" about the owner\'s own save');
  assert.equal((await groupRow('extras')).label, 'תווית ראשונה');
  await page.unroute(rpc);
  await owner.api.update('addon_groups', { id: `eq.${ids.groups.extras}` }, { name_he: 'תוספות', label: '' });
  await page.context().close();
});

test('"changed somewhere else" lists only the owner\'s values that differ from what is stored (not their own lost save)', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const sheet = await openDish(page, 'plain3');
  const net = await slowDishes(page, { ms: 0, slow: 0, lose: 1 });
  await priceOf(sheet).fill('13');
  await page.locator('[data-save="failed"]').waitFor();
  assert.equal((await dishRow('plain3')).price, 1300, 'the lost save reached the database');
  await owner.api.update('dishes', { id: `eq.${ids.dishes.plain3}` }, { name_he: 'פשוט שלישי משם' });
  await sheet.locator('[data-field="dish-desc-he"]').fill('מכאן');
  await sheet.locator('[data-action="retry-saves"]').click();
  const dlg = page.locator('dialog[data-conflict]');
  await dlg.waitFor();
  assert.deepEqual(await dlg.locator('tr[data-col]').evaluateAll((rows) => rows.map((r) => r.dataset.col)), ['desc_he'], 'the price, stored already, is not a question');
  assert.match(await dlg.locator('[data-there]').innerText(), /שם/);
  await shot(page, '08-conflict-only-differs');
  await dlg.locator('[data-action="keep-mine"]').click();
  await until(async () => (await dishRow('plain3')).desc_he === 'מכאן', 'kept');
  const r = await dishRow('plain3');
  assert.deepEqual([r.name_he, r.price], ['פשוט שלישי משם', 1300]);
  await net.stop();
  await reset('plain3', { name_he: 'פשוט שלישי', price: 700, desc_he: '' });
  await page.context().close();
});

test('a section saved after a failed save: the failed change and the new one go together (saveNow); the "not saved" line is one line at 390 px', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const bodies = [];
  let fail = 1;
  const sections = (u) => u.pathname.endsWith('/rest/v1/sections');
  await page.route(sections, async (r) => {
    if (r.request().method() !== 'PATCH') return r.continue();
    bodies.push(JSON.parse(r.request().postData() || '{}'));
    if (fail-- > 0) return r.abort('internetdisconnected');
    return r.continue();
  });
  await page.goto(e.webUrl + 'studio/#/menu/s/' + ids.sections.drinks);
  const ss = page.locator('dialog[data-sheet="section"]');
  await ss.waitFor();
  await ss.locator('[data-field="section-name-he"]').fill('שתייה חמה');
  await ss.locator('[data-action="save-section"]').click();
  const line = ss.locator('[data-save-failed]');
  await line.waitFor();
  assert.equal(await ss.count(), 1, 'the sheet stays open');
  const [text, lh] = await line.evaluate((bar) => { const s = bar.querySelector(':scope > span'); return [s.getBoundingClientRect().height, parseFloat(getComputedStyle(s).lineHeight)]; });
  assert.ok(text <= lh * 1.5, `one line (${text} px for a ${lh} px line)`);
  await shot(page, '09-not-saved-line');
  await ss.getByRole('switch').first().click();
  await ss.locator('[data-action="save-section"]').click();
  await until(async () => (await ss.count()) === 0, 'saved, the sheet closed');
  assert.deepEqual(bodies.at(-1), { name_he: 'שתייה חמה', hidden: true }, 'one write with both');
  const row = await sectionRow('drinks');
  assert.deepEqual([row.name_he, row.hidden], ['שתייה חמה', true]);
  await page.unroute(sections);
  await owner.api.update('sections', { id: `eq.${ids.sections.drinks}` }, { name_he: 'שתייה', hidden: false });
  await page.context().close();
});

// ------------------------------------------------------------------ round 4
test('a dish\'s own limits saved while a whole-menu read is late: the late read keeps them, and the next change is no question', { timeout: 150000 }, async () => {
  const page = await signedIn();
  await page.goto(e.webUrl + 'studio/#/menu');
  await page.locator('[data-screen="menu"]').waitFor();
  // the next whole-menu read of the dishes' group links (rows without a version) answers 10 s late
  let armed = false, heldAt = 0, releasedAt = 0;
  const links = (u) => u.pathname.endsWith('/rest/v1/dish_addon_groups');
  await page.route(links, async (r) => {
    if (!armed || r.request().method() !== 'GET' || !/venue_id=eq/.test(r.request().url())) return r.continue();
    armed = false; heldAt = Date.now();
    const answer = await r.fetch();
    await sleep(10000);
    releasedAt = Date.now();
    return r.fulfill({ response: answer });
  });
  await owner.api.update('sections', { id: `eq.${ids.sections.drinks}` }, { position: 7 });      // the move is stale
  armed = true;
  await page.locator('[data-tool="arrange"]').click();
  await page.locator(`section[data-section="${ids.sections.mains}"] .sec-head [data-move="down"]`).click();
  await until(async () => heldAt > 0, 'the menu read again');
  await page.locator('[data-tool="arrange"]').click();
  const sheet = await openDish(page, 'burger', 'addons');
  const limits = () => sheet.getByRole('button', { name: /הגבולות של/ }).first().click();
  const lim = sheet.locator('[data-limits]');
  const storedMax = async () => (await owner.api.select('dish_addon_groups', { select: 'max_units', dish_id: `eq.${ids.dishes.burger}` }))[0].max_units;
  await limits();
  await lim.locator('[data-field="dish-max"]').selectOption('2');
  await lim.locator('[data-action="save-limits"]').click();
  await sheet.locator('[data-tighter]').waitFor();
  const rule = await sheet.locator('[data-rule]').first().innerText();
  assert.equal(releasedAt, 0, 'saved while the read was still on its way');
  await until(async () => releasedAt > 0, 'the late answer', 20000);
  await sleep(1500);
  assert.equal(await sheet.locator('[data-rule]').first().innerText(), rule, 'the limits the owner saved stay on screen');
  assert.equal(await sheet.locator('[data-tighter]').count(), 1, 'and the "own limits" mark with them');
  await shot(page, '10-limits-after-late-read');
  await limits();
  await lim.locator('[data-field="dish-max"]').selectOption('1');
  await lim.locator('[data-action="save-limits"]').click();
  await until(async () => (await storedMax()) === 1, 'the next limits stored');
  assert.equal(await sheet.locator('.note-error').count(), 0, 'no "changed somewhere else"');
  await page.unroute(links);
  await owner.api.update('dish_addon_groups', { dish_id: `eq.${ids.dishes.burger}` }, { max_units: null });
  await owner.api.update('sections', { id: `eq.${ids.sections.drinks}` }, { position: 1 });
  await page.context().close();
});

test('the session ends (401) during a group save: the start screen names the group', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const ed = await openGroup(page, 'extras');
  await page.route((u) => u.pathname.endsWith('/rest/v1/rpc/save_addon_group'), (r) =>
    r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST301', details: null, hint: null, message: 'JWT expired' }) }));
  await ed.locator('[data-field="group-label"]').fill('תווית שלא תישמר');
  await ed.locator('[data-action="save-group"]').click();
  await page.locator('[data-screen="start"] [data-session-ended]').waitFor({ timeout: 15000 });
  assert.match(await page.locator('[data-session-unsaved]').innerText(), /"תוספות"/);
  assert.equal(await page.locator('dialog[open]').count(), 0, 'no question left over the start screen');
  assert.equal((await groupRow('extras')).label, '');
  await page.context().close();
});
