// The owner app v2 at its edges, on a 390 × 844 phone against the simulator's stack, with invented data only (the QA
// review's attacks, kept as tests): production never loads it; the preview prices exactly as guests are priced; prices
// typed as people type them; two tabs on the same dish and group; a dropped network and publishing meanwhile; answers
// lost on the way back; a group save refused halfway; suggestion rules on a deleted choice; a counter and a manager
// whose role changes; sign-up; right-to-left, keyboard, names for screen readers and owner text that is never HTML.
// Needs the built site (bash tools/build-site.sh). Screenshots: e2e/.out/studio-v2-edges/.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { asAnon, createUser, HalomBot, OwnerBot } from '@mana/sim';
import { defaultSelection, fromPrice, priceDish, pricingContext } from '@mana/contracts';
import { OUT, PHONE, startE2E } from './helpers.mjs';
import { guestModel, pricingOf } from '../apps/studio/src/v2/data/guest.ts';

const SHOTS = path.join(OUT, 'studio-v2-edges');
const PASSWORD = 'sim-owner-pass-1';
const EMAIL = 'edge-owner@sim.local';
const SLUG = 'edge-burger-sim';
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
  assert.equal((await owner.createVenue({ slug: SLUG, name: { he: 'בורגר קצה', en: 'Edge Burger' }, kind: 'restaurant' })).ok, true);
  venueId = owner.venueId;
  const n = (he, en) => ({ he, en });
  ids = await owner.buildMenu({
    sections: [{ key: 'mains', name: n('עיקריות', 'Mains'), dishes: [
      { key: 'burger', name: n('המבורגר', 'Burger'), price: 6200, groups: ['size', 'side', 'extras'] },
      { key: 'kids', name: n('המבורגר ילדים', 'Kids burger'), price: 4400, groups: [{ group: 'side', max: 1 }, { group: 'extras', min: 1, max: 2 }] },
      { key: 'noprice', name: n('מנה בלי מחיר', 'No price'), groups: ['size'] },
      { key: 'dip', name: n('מטבל', 'Dip'), price: 1200, groups: ['sauce'] },
      { key: 'plain', name: n('פשוט', 'Plain'), price: 900 },
      { key: 'paidreq', name: n('בגדלים', 'Sized'), price: 3000, groups: ['size2'] },
    ] }],
    groups: [
      { key: 'sauce', name: n('רוטב', 'Sauce'), selection: 'single', min: 1, max: 1, options: [{ key: 'ketchup', name: n('קטשופ', 'Ketchup'), default: true }, { key: 'aioli', name: n('איולי', 'Aioli'), price: 300 }] },
      { key: 'side', name: n('תוספת', 'Side'), selection: 'multiple', min: 1, max: 2, options: [{ key: 'fries', name: n('צ׳יפס', 'Fries'), opens: 'sauce' }, { key: 'salad', name: n('סלט', 'Salad'), price: 400 }, { key: 'rice', name: n('אורז', 'Rice') }] },
      { key: 'extras', name: n('תוספות', 'Extras'), selection: 'multiple', min: 0, max: 3, options: [{ key: 'cheese', name: n('גבינה', 'Cheese'), price: 400, maxQty: 2, default: true }, { key: 'bacon', name: n('בייקון', 'Bacon'), price: 600, maxQty: 3 }, { key: 'egg', name: n('ביצה', 'Egg') }] },
      { key: 'size', name: n('גודל', 'Size'), selection: 'single', min: 1, max: 1, options: [{ key: 'small', name: n('קטן', 'Small'), default: true }, { key: 'large', name: n('גדול', 'Large'), price: 800 }] },
      { key: 'size2', name: n('גודל בתשלום', 'Paid size'), selection: 'single', min: 1, max: 1, options: [{ key: 'm', name: n('בינוני', 'Medium'), price: 500 }, { key: 'l', name: n('גדול', 'Large'), price: 900 }] },
      { key: 'dressing', name: n('רוטב לסלט', 'Dressing'), selection: 'single', min: 0, max: 1, options: [{ key: 'vin', name: n('ויניגרט', 'Vinaigrette') }] },
      { key: 'spare', name: n('רזרבה', 'Spare'), selection: 'single', min: 0, max: 1, options: [{ key: 'sp1', name: n('אחת', 'One') }] },
    ],
    rules: [{ key: 'bacon', label: 'בייקון ליד המבורגר', trigger: 'sheet', suggest: { option: 'bacon' }, line: n('אולי גם בייקון?', 'Bacon with that?') }],
  });
  const published = await owner.publish('edges');
  assert.equal(published.ok, true);
  const halom = await HalomBot.firstAdmin(e.stack, e.stack, { email: 'edge-halom@sim.local' });
  // Halom approves the revision it reviewed (ops_approve_venue's expected revision)
  assert.equal((await halom.approve(venueId, 'e2e: the edge cases venue', published.revision)).ok, true);
}, { timeout: 240000 });
after(async () => { await e?.stop(); });

const rowsOf = async () => {
  const sel = (t) => owner.api.select(t, { select: '*', venue_id: `eq.${venueId}` });
  const [dishes, groups, options, dishGroups, relations] = await Promise.all([sel('dishes'), sel('addon_groups'), sel('addon_options'), sel('dish_addon_groups'), sel('dish_relations')]);
  return { dishes, groups, options, dishGroups, relations };
};
const dishRow = async (key) => (await owner.api.select('dishes', { select: '*', id: `eq.${ids.dishes[key]}` }))[0];
const groupRow = async (key) => (await owner.api.select('addon_groups', { select: '*', id: `eq.${ids.groups[key]}` }))[0];
const optionsOf = async (groupId) => (await owner.api.select('addon_options', { select: '*', group_id: `eq.${groupId}`, order: 'position' }));
const named = async (table, he) => owner.api.select(table, { select: '*', venue_id: `eq.${venueId}`, name_he: `eq.${he}` });

/** A signed-in phone page on the studio; a second one in the same context is a second tab of the same browser. */
async function signedIn(email = EMAIL, ctx = null) {
  const page = ctx ? await ctx.newPage() : await e.page(e.webUrl + 'studio/');
  if (ctx) { page.problems = []; await page.goto(e.webUrl + 'studio/'); }
  await page.locator('[data-screen="start"], .shell').first().waitFor({ timeout: 20000 });
  if (await page.locator('[data-screen="start"]').count()) {
    await page.getByLabel('אימייל').fill(email);
    await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'המשך' }).click();
  }
  await page.locator('.shell').waitFor({ timeout: 20000 });
  return page;
}
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
async function switchLanguage(page) {
  await page.goto(e.webUrl + 'studio/#/menu');
  await page.locator('[data-action="account"]').click();
  await page.locator('[data-menu="language"]').click();
  await page.keyboard.press('Escape');
}
/** Lose the answer to the next request that matches: it reaches the database, the browser never hears back. */
async function loseNextAnswer(page, method, pathEnd) {
  let armed = true;
  const match = (u) => u.pathname.endsWith(pathEnd);
  await page.route(match, async (r) => {
    if (armed && r.request().method() === method) { armed = false; await r.fetch(); return r.abort('internetdisconnected'); }
    return r.continue();
  });
  return () => page.unroute(match);
}

// ------------------------------------------------------------------ production: schema absent or 1 never loads v2
test('production config: schema absent, 1, "2" (a string) or another env runs v1 and never fetches the v2 app', { timeout: 120000 }, async () => {
  const base = { supabaseUrl: e.stack.apiUrl, supabaseKey: e.stack.anonKey, shortBase: 'http://127.0.0.1/m/', shortLive: false, viewPath: '../view/', genPath: '../gen/', stockPath: '../stock/', sitePath: '../', auth: { providers: [] }, features: { scan: false } };
  const cases = [['absent', base, false], ['schema 1', { ...base, schema: 1 }, false], ['schema "2"', { ...base, schema: '2' }, false], ['env demo, no schema', { ...base, env: 'demo' }, false],
    ['schema 2 in production (no env)', { ...base, schema: 2 }, false], ['schema 2, env local', { ...base, env: 'local', schema: 2, realtime: false }, true],
    ['schema 2, env demo', { ...base, env: 'demo', schema: 2 }, true]];
  for (const [name, cfg, v2] of cases) {
    const ctx = await e.browser.newContext({ viewport: PHONE, locale: 'he-IL' });
    const page = await ctx.newPage();
    const urls = [], errors = [];
    page.on('request', (r) => urls.push(r.url()));
    page.on('pageerror', (x) => errors.push(x.message));
    await page.route('**/mana/config.js', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.HALOM_MENUS_CONFIG = ' + JSON.stringify(cfg) + ';' }));
    await page.goto(e.webUrl + 'studio/');
    await page.locator('main').first().waitFor({ timeout: 20000 });
    await page.waitForLoadState('networkidle');
    const chunk = urls.filter((u) => /\/studio\/assets\/main-[^/]+\.(js|css)$/.test(u));
    assert.equal(chunk.length > 0, v2, name + ': the v2 chunk was ' + (v2 ? 'not ' : '') + 'fetched');
    assert.equal(await page.locator('[data-screen="start"]').count() > 0, v2, name + ': the v2 start screen');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.app ?? null), v2 ? 'v2' : null, name);
    assert.deepEqual(errors, [], name);
    await ctx.close();
  }
});

// ------------------------------------------------------------------ the preview's prices vs what public_menu gives guests
function* units(options, maxUnits, nestedOf) {
  // every multiset of options, each 0 … its most + 1, at most one unit over the maximum (to see above_max refused alike)
  const cap = maxUnits + 1;
  function* rec(i, used, acc) {
    if (i === options.length) { yield acc; return; }
    const o = options[i];
    for (let q = 0; q <= Math.min(o.maxQty + 1, cap - used); q++) {
      if (q === 0) { yield* rec(i + 1, used, acc); continue; }
      const one = { optionId: o.id, ...(q > 1 ? { qty: q } : {}) };
      if (o.opensGroupId && nestedOf) for (const nested of nestedOf(o.opensGroupId)) yield* rec(i + 1, used + q, [...acc, { ...one, ...(nested ? { nested: [nested] } : {}) }]);
      else yield* rec(i + 1, used + q, [...acc, one]);
    }
  }
  yield* rec(0, 0, []);
}
function* selections(dish, groups) {
  const nestedOf = (gid) => {
    const g = groups.get(gid), out = [null];
    for (const opts of units(g.options, g.max, null)) if (opts.length) out.push({ groupId: gid, options: opts });
    return out;
  };
  function* rec(i, acc) {
    if (i === dish.addons.length) { yield { quantity: 1, groups: acc }; return; }
    const a = dish.addons[i], g = groups.get(a.groupId);
    for (const opts of units(g.options, a.max, nestedOf)) yield* rec(i + 1, opts.length ? [...acc, { groupId: g.id, options: opts }] : acc);
  }
  yield* rec(0, []);
}

test('the preview prices every selection exactly as guests are priced from public_menu', { timeout: 120000 }, async () => {
  const pub = await asAnon(e.stack).rpc('public_menu', { p_slug: SLUG });
  assert.equal(pub.state, 'ok');
  const snap = pub.snapshot, server = pricingContext(snap), rows = await rowsOf();
  let n = 0;
  for (const sec of snap.sections) for (const dish of sec.dishes) {
    const m = guestModel(rows, dish.id), preview = pricingOf(m);
    assert.deepEqual(m.dish.addons, dish.addons, 'limits of ' + dish.name.en);
    assert.deepEqual(m.dish.price, dish.price, 'price of ' + dish.name.en);
    for (const [gid, g] of m.groups) assert.deepEqual(g, server.groups.get(gid), 'group ' + g.name.en);
    assert.deepEqual(fromPrice(m.dish, preview), fromPrice(dish, server), 'from price of ' + dish.name.en);
    assert.deepEqual(defaultSelection(m.dish, preview), defaultSelection(dish, server), 'defaults of ' + dish.name.en);
    for (const sel of selections(dish, server.groups)) { assert.deepEqual(priceDish(m.dish, sel, preview), priceDish(dish, sel, server), dish.name.en + ' ' + JSON.stringify(sel)); n++; }
  }
  assert.ok(n > 500, 'selections compared: ' + n);
});

// ------------------------------------------------------------------ prices as people type them
test('prices typed as people type them, in Hebrew and in English, on a dish and on a choice; the preview with a quantity', { timeout: 180000 }, async () => {
  const page = await signedIn();
  // the burger with rice and two cheeses (cheese is pre-selected): the total is priceDish's on what guests get
  const sheet0 = await openDish(page, 'burger', 'addons');
  const gp = sheet0.locator('[data-guest-preview]');
  await gp.getByRole('checkbox', { name: 'אורז', exact: true }).check();
  await gp.getByRole('button', { name: 'יותר: כמות של גבינה' }).click();
  const snap = (await asAnon(e.stack).rpc('public_menu', { p_slug: SLUG })).snapshot;
  const burger = snap.sections[0].dishes.find((d) => d.id === ids.dishes.burger);
  const want = priceDish(burger, { quantity: 1, groups: [
    { groupId: ids.groups.size, options: [{ optionId: ids.options.small }] },
    { groupId: ids.groups.side, options: [{ optionId: ids.options.rice }] },
    { groupId: ids.groups.extras, options: [{ optionId: ids.options.cheese, qty: 2 }] },
  ] }, pricingContext(snap));
  assert.equal(want.ok, true);
  assert.equal(await gp.locator('.gp-total').getAttribute('data-total'), String(want.total));
  await shot(page, '01-preview-quantity');

  const tries = [['12.5', 1250], ['12,50', 1250], ['₪12', 1200], ['12 ₪', 1200], ['-3', 'refused'], ['12.500', 'refused'], ['1,250', 125000]];
  for (const L of ['he', 'en']) {
    if (L === 'en') await switchLanguage(page);
    const sheet = await openDish(page, 'plain');
    const price = sheet.locator('[data-field="dish-price"]');
    for (const [typed, stored] of tries) {
      const before = (await dishRow('plain')).price;
      await price.fill(typed);
      await sleep(1300);
      const now = (await dishRow('plain')).price;
      if (stored === 'refused') {
        assert.equal(now, before, `[${L}] "${typed}" is not stored`);
        assert.ok((await sheet.locator('.ferr').count()) > 0, `[${L}] "${typed}": the field says why`);
      } else assert.equal(now, stored, `[${L}] "${typed}"`);
    }
    await price.fill('9');
    await until(async () => (await dishRow('plain')).price === 900, 'the price back to 9');
    await shot(page, '02-price-' + L);
  }
  // a choice's price in the group editor (English now), saved with the group
  const ed = await openGroup(page, 'spare');
  const opt = ed.locator('[data-field="option-price-0"]');
  for (const [typed, stored] of [['2,5', 250], ['-3', 'refused'], ['₪4', 400]]) {
    const before = (await optionsOf(ids.groups.spare))[0].price;
    await opt.fill(typed);
    await ed.locator('[data-action="save-group"]').click();
    if (stored === 'refused') {
      await ed.locator('.ferr').first().waitFor();
      assert.equal((await optionsOf(ids.groups.spare))[0].price, before, `choice "${typed}" is not stored`);
    } else await until(async () => (await optionsOf(ids.groups.spare))[0].price === stored, `choice "${typed}" stored as ${stored}`);
  }
  await switchLanguage(page);
  await page.context().close();
});

// ------------------------------------------------------------------ two tabs
test('two tabs on one dish and one group: a saved edit is never undone silently; the owner keeps theirs or takes the stored one', { timeout: 180000 }, async () => {
  const a = await signedIn();
  const b = await signedIn(EMAIL, a.context());
  const sa = await openDish(a, 'plain'), sb = await openDish(b, 'plain');
  // A writes a description; B, opened before, changes the price: B is told, with what is stored now
  await sa.locator('[data-field="dish-desc-he"]').fill('תיאור מהלשונית הראשונה');
  await until(async () => (await dishRow('plain')).desc_he === 'תיאור מהלשונית הראשונה', 'A\'s description saved');
  await sb.locator('[data-field="dish-price"]').fill('10');
  const cb = b.locator('dialog[data-conflict]');
  await cb.waitFor();
  assert.equal((await dishRow('plain')).price, 900, 'nothing written before the owner decides');
  assert.equal(await cb.locator('tr[data-col="price"] [data-stored]').innerText(), '₪9');
  assert.equal(await cb.locator('tr[data-col="price"] [data-mine]').innerText(), '₪10');
  assert.match(await cb.locator('[data-there]').innerText(), /תיאור/);
  assert.equal(await b.locator('[data-save="conflict"]').count(), 1);
  await shot(b, '03-two-tabs-conflict');
  await cb.locator('[data-action="keep-mine"]').click();
  await until(async () => (await dishRow('plain')).price === 1000, 'B\'s price stored');
  assert.equal((await dishRow('plain')).desc_he, 'תיאור מהלשונית הראשונה', 'A\'s description stays');
  assert.equal(await sb.locator('[data-field="dish-desc-he"]').inputValue(), 'תיאור מהלשונית הראשונה', 'B now shows A\'s description');
  // A changes the same price: A is told, and takes the stored one
  await sa.locator('[data-field="dish-price"]').fill('12');
  const ca = a.locator('dialog[data-conflict]');
  await ca.waitFor();
  assert.equal(await ca.locator('tr[data-col="price"] [data-stored]').innerText(), '₪10');
  await ca.locator('[data-action="take-stored"]').click();
  await until(async () => (await sa.locator('[data-field="dish-price"]').inputValue()) === '10', 'A shows the stored price');
  assert.equal((await dishRow('plain')).price, 1000);
  await a.locator('[data-save="saved"]').waitFor();

  // the same on a group: A makes Extras required and saves; B (opened before) saves a label
  const ea = await openGroup(a, 'extras'), eb = await openGroup(b, 'extras');
  await ea.getByRole('switch', { name: 'חובה לבחור' }).click();
  await ea.locator('[data-action="save-group"]').click();
  await until(async () => (await groupRow('extras')).min_units === 1, 'A: required');
  await eb.locator('[data-field="group-label"]').fill('תווית מלשונית ב');
  await eb.locator('[data-action="save-group"]').click();
  await eb.locator('[data-stale]').waitFor();
  assert.equal((await groupRow('extras')).label, '', 'B wrote nothing over A');
  assert.match(await eb.locator('[data-stale]').innerText(), /בוחרים 1 עד 3 · חובה/, 'B sees the group as stored now');
  await shot(b, '04-two-tabs-group');
  await eb.locator('[data-action="take-stored"]').click();
  assert.equal(await eb.getByRole('switch', { name: 'חובה לבחור' }).getAttribute('aria-checked'), 'true');
  await eb.locator('[data-field="group-label"]').fill('תווית מלשונית ב');
  await eb.locator('[data-action="save-group"]').click();
  await until(async () => (await groupRow('extras')).label === 'תווית מלשונית ב', 'B\'s label');
  assert.equal((await groupRow('extras')).min_units, 1, 'A\'s minimum stays');
  // and A, behind again, keeps its own form over B's on purpose
  await ea.locator('[data-field="group-label"]').fill('תווית מלשונית א');
  await ea.locator('[data-action="save-group"]').click();
  await ea.locator('[data-stale]').waitFor();
  await ea.locator('[data-action="keep-mine"]').click();
  await until(async () => (await groupRow('extras')).label === 'תווית מלשונית א', 'A\'s label, kept on purpose');

  await owner.api.update('addon_groups', { id: `eq.${ids.groups.extras}` }, { min_units: 0, label: '' });
  await owner.api.update('dishes', { id: `eq.${ids.dishes.plain}` }, { desc_he: '', price: 900 });
  await a.context().close();
});

// ------------------------------------------------------------------ a dropped network, and publishing meanwhile
test('a network drop keeps what was typed, publishing waits and says why, and a retry saves it', { timeout: 120000 }, async () => {
  await owner.updateDish(ids.dishes.dip, { price: 1300 });                // something unpublished, so publishing is possible
  const page = await signedIn();
  const sheet = await openDish(page, 'plain');
  const drop = (u) => u.pathname.endsWith('/rest/v1/dishes');
  await page.route(drop, (r) => (r.request().method() === 'PATCH' ? r.abort('internetdisconnected') : r.continue()));
  await sheet.locator('[data-field="dish-price"]').fill('13');
  await page.locator('[data-save="failed"]').waitFor();
  assert.equal(await sheet.locator('[data-field="dish-price"]').inputValue(), '13');
  assert.equal((await dishRow('plain')).price, 900);
  await shot(page, '05-save-failed');
  await page.goto(e.webUrl + 'studio/#/publish');
  const pub = page.locator('[data-screen="publish"]');
  await pub.locator('[data-blocked="failed"]').waitFor();
  assert.equal(await pub.locator('[data-action="publish"]').isDisabled(), true);
  await shot(page, '06-publish-waits');
  await page.unroute(drop);
  await page.locator('.savebar button').click();
  await until(async () => (await dishRow('plain')).price === 1300, 'the retry saved');
  await pub.locator('[data-action="publish"]:not([disabled])').waitFor();
  assert.equal(await pub.locator('[data-blocked]').count(), 0);
  await owner.api.update('dishes', { id: `eq.${ids.dishes.plain}` }, { price: 900 });
  await owner.updateDish(ids.dishes.dip, { price: 1200 });
  await page.context().close();
});

// ------------------------------------------------------------------ lost answers, and a group save refused halfway
test('lost answers never add a second dish, section, group or choice; a refused or interrupted group save changes nothing', { timeout: 240000 }, async () => {
  const page = await signedIn();
  // a dish by quick add: the answer is lost, the owner adds again
  await page.goto(e.webUrl + 'studio/#/menu');
  let restore = await loseNextAnswer(page, 'POST', '/rest/v1/dishes');
  await page.getByRole('button', { name: 'מנה חדשה בעיקריות' }).click();
  const quick = page.locator(`form[data-quick="${ids.sections.mains}"]`);
  await quick.getByLabel('שם המנה').fill('כריך קצה');
  await quick.getByLabel('מחיר').fill('20');
  await quick.getByRole('button', { name: 'הוספה' }).click();
  await quick.locator('.ferr').waitFor();
  await quick.getByRole('button', { name: 'הוספה' }).click();
  await page.locator('[data-dish]', { hasText: 'כריך קצה' }).first().waitFor();
  assert.equal((await named('dishes', 'כריך קצה')).length, 1, 'one dish');
  await restore();
  // a section: the same
  restore = await loseNextAnswer(page, 'POST', '/rest/v1/sections');
  await page.locator('[data-tool="section"]').click();
  const ss = page.locator('dialog[data-sheet="section"]');
  await ss.locator('[data-field="section-name-he"]').fill('קינוחים קצה');
  await ss.locator('[data-action="save-section"]').click();
  await ss.locator('.note-error').waitFor();
  await ss.locator('[data-action="save-section"]').click();
  await page.getByRole('heading', { name: 'קינוחים קצה', level: 2 }).waitFor();
  assert.equal((await named('sections', 'קינוחים קצה')).length, 1, 'one section');
  await restore();

  // a new group: its answer is lost, the owner saves again
  const ed = page.locator('[data-screen="group-editor"]');
  await page.goto(e.webUrl + 'studio/#/addons/new');
  await ed.waitFor();
  await ed.locator('[data-field="group-name-he"]').fill('תוספות קצה');
  await ed.locator('[data-field="option-name-0-he"]').fill('בצל');
  restore = await loseNextAnswer(page, 'POST', '/rest/v1/rpc/save_addon_group');
  await ed.locator('[data-action="save-group"]').click();
  await ed.locator('[data-error]').waitFor();
  await ed.locator('[data-action="save-group"]').click();
  await page.locator('[data-screen="group-editor"]:not([data-group="new"])').waitFor();
  const made = await named('addon_groups', 'תוספות קצה');
  assert.equal(made.length, 1, 'one group');
  assert.equal((await optionsOf(made[0].id)).length, 1, 'with one choice');
  await restore();
  // an existing group, a new choice: its answer is lost, the owner saves again
  await openGroup(page, 'extras');
  await ed.locator('[data-action="add-option"]').click();
  const k = await ed.locator('ol.opts > li').count();
  await ed.locator(`[data-field="option-name-${k - 1}-he"]`).fill('בצל מטוגן');
  restore = await loseNextAnswer(page, 'POST', '/rest/v1/rpc/save_addon_group');
  await ed.locator('[data-action="save-group"]').click();
  await ed.locator('[data-error]').waitFor();
  await ed.locator('[data-action="save-group"]').click();
  await until(async () => !(await ed.locator('[data-error]').count()) && (await page.locator('[data-save="saved"]').count()), 'saved again');
  assert.equal((await optionsOf(ids.groups.extras)).filter((o) => o.name_he === 'בצל מטוגן').length, 1, 'one choice');
  await restore();
  await shot(page, '07-lost-answers');

  // "Paid size": Medium deleted, XL added opening Dressing; meanwhile Dressing becomes an opener elsewhere. Refused, and
  // nothing of it is stored (not the deletion, not the new choice)
  const before = (await optionsOf(ids.groups.size2)).map((o) => [o.name_he, o.price]);
  await openGroup(page, 'size2');
  await ed.locator('ol.opts > li').first().getByRole('button', { name: /למחוק/ }).click();
  await ed.locator('[data-action="add-option"]').click();
  await ed.locator('[data-field="option-name-1-he"]').fill('ענק');
  await ed.locator('[data-field="option-price-1"]').fill('12');
  await ed.locator('[data-field="option-opens-1"]').selectOption({ label: 'רוטב לסלט' });
  const [opener] = await owner.insert('addon_options', [{ group_id: ids.groups.dressing, name_he: 'פותח', name_en: 'Opener', opens_group_id: ids.groups.spare }]);
  await ed.locator('[data-action="save-group"]').click();
  await ed.locator('[data-error]').waitFor();
  assert.match(await ed.locator('[data-error]').innerText(), /רק רמה אחת/);
  assert.deepEqual((await optionsOf(ids.groups.size2)).map((o) => [o.name_he, o.price]), before, 'the group is as it was');
  await shot(page, '08-refused-halfway');
  // a new group whose choice opens that group: refused, nothing stored; saved again (the opener dropped): one group
  await page.goto(e.webUrl + 'studio/#/addons/new');
  await ed.waitFor();
  await owner.api.remove('addon_options', { id: `eq.${opener.id}` });
  await page.reload(); await ed.waitFor();
  await ed.locator('[data-field="group-name-he"]').fill('קומבו קצה');
  await ed.locator('[data-field="option-name-0-he"]').fill('עם סלט');
  await ed.locator('[data-field="option-opens-0"]').selectOption({ label: 'רוטב לסלט' });
  const [opener2] = await owner.insert('addon_options', [{ group_id: ids.groups.dressing, name_he: 'פותח', name_en: 'Opener', opens_group_id: ids.groups.spare }]);
  await ed.locator('[data-action="save-group"]').click();
  await ed.locator('[data-error]').waitFor();
  assert.equal((await named('addon_groups', 'קומבו קצה')).length, 0, 'nothing stored');
  await ed.locator('[data-action="save-group"]').click();
  await page.locator('[data-screen="group-editor"]:not([data-group="new"])').waitFor();
  assert.equal((await named('addon_groups', 'קומבו קצה')).length, 1, 'one group');
  await owner.api.remove('addon_options', { id: `eq.${opener2.id}` });

  // offline in the middle of a group save: nothing of it is stored; back online, all of it is
  await openGroup(page, 'side');
  await ed.locator('[data-field="option-name-0-he"]').fill('צ׳יפס ביתי');
  await ed.locator('[data-field="option-name-1-he"]').fill('סלט ירוק');
  await ed.locator('ol.opts > li').nth(2).getByRole('button', { name: /למחוק/ }).click();
  await ed.locator('[data-action="add-option"]').click();
  await ed.locator('[data-field="option-name-2-he"]').fill('שעועית');
  const off = (u) => u.pathname.includes('/rest/v1/');
  await page.route(off, (r) => r.abort('internetdisconnected'));
  await ed.locator('[data-action="save-group"]').click();
  await ed.locator('[data-error]').waitFor();
  assert.deepEqual((await optionsOf(ids.groups.side)).map((o) => o.name_he), ['צ׳יפס', 'סלט', 'אורז']);
  await page.unroute(off);
  await ed.locator('[data-action="save-group"]').click();
  await until(async () => JSON.stringify((await optionsOf(ids.groups.side)).map((o) => o.name_he)) === JSON.stringify(['צ׳יפס ביתי', 'סלט ירוק', 'שעועית']), 'all of the save');
  await page.context().close();
});

// ------------------------------------------------------------------ deleting a choice a suggestion rule uses
test('deleting a choice that a suggestion rule offers asks first, naming the rule, then deletes both', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const ed = await openGroup(page, 'extras');
  await ed.locator(`li[data-option="${ids.options.bacon}"]`).getByRole('button', { name: /למחוק/ }).click();
  await ed.locator('[data-action="save-group"]').click();
  const ask = page.getByRole('dialog', { name: 'כללי הצעה משתמשים באפשרויות האלה' });
  await ask.waitFor();
  assert.match(await ask.innerText(), /בייקון ליד המבורגר/);
  assert.equal((await optionsOf(ids.groups.extras)).some((o) => o.id === ids.options.bacon), true, 'nothing deleted before the owner says so');
  await shot(page, '09-rule-on-choice');
  await ask.getByRole('button', { name: 'למחוק ולשמור' }).click();
  await until(async () => !(await optionsOf(ids.groups.extras)).some((o) => o.id === ids.options.bacon), 'the choice deleted');
  assert.equal((await owner.api.select('upsell_rules', { select: 'id', id: `eq.${ids.rules.bacon}` })).length, 0, 'and the rule with it');
  await page.context().close();
});

test('a group change that would break a dish\'s own limits is refused before it is sent, naming the dish', { timeout: 120000 }, async () => {
  const page = await signedIn();
  const sent = [];
  page.on('request', (r) => { if (r.url().includes('/rpc/save_addon_group')) sent.push(r.url()); });
  const ed = await openGroup(page, 'side');                 // the kids' burger takes at most one side
  await ed.getByRole('button', { name: 'יותר: לפחות' }).click();
  await ed.locator('[data-action="save-group"]').click();
  await ed.locator('[data-error]').waitFor();
  assert.match(await ed.locator('[data-error]').innerText(), /המבורגר ילדים/);
  assert.equal(sent.length, 0, 'nothing sent');
  assert.equal((await groupRow('side')).min_units, 1);
  await shot(page, '09b-dish-limits');
  await page.context().close();
});

// ------------------------------------------------------------------ a counter, and a manager whose role changes
test('a counter sees every screen read-only and cannot reach an edit screen by address; a manager made counter mid-edit is told "not allowed"', { timeout: 180000 }, async () => {
  const other = await OwnerBot.signUp(e.stack, { email: 'edge-other@sim.local', password: PASSWORD });
  await other.createVenue({ slug: 'edge-cafe-two', name: { he: 'קפה שני', en: 'Cafe Two' }, kind: 'cafe' });
  const oids = await other.buildMenu({
    sections: [{ key: 's', name: { he: 'קפה', en: 'Coffee' }, dishes: [{ key: 'esp', name: { he: 'אספרסו', en: 'Espresso' }, price: 900, groups: ['milk'] }] }],
    groups: [{ key: 'milk', name: { he: 'חלב', en: 'Milk' }, selection: 'multiple', min: 0, max: 2, options: [{ key: 'oat', name: { he: 'שיבולת', en: 'Oat' }, price: 200, maxQty: 2 }] }],
  });
  await e.stack.addMember(other.venueId, owner.userId, 'counter');
  const page = await signedIn();
  await page.locator('[data-action="switch-venue"]').click();
  await page.locator('dialog[data-sheet="account"] [data-venue="edge-cafe-two"]').click();
  await page.getByRole('heading', { name: 'קפה', level: 2 }).waitFor();
  assert.match(await page.locator('main').innerText(), /לא לערוך/);
  assert.equal(await page.locator('[data-tool]').count(), 0, 'no arrange, no new section');
  await shot(page, '10-counter-menu');
  // the dish: every field, price, switch and choice disabled
  await page.goto(e.webUrl + 'studio/#/menu/d/' + oids.dishes.esp + '/details');
  const sheet = page.locator('dialog[data-sheet="dish"]');
  await sheet.waitFor();
  const live = (root) => root.locator('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [role="switch"]:not([disabled])').count();
  assert.equal(await live(sheet.locator('[data-dish-details]')), 0, 'the dish details are read-only');
  assert.equal(await sheet.locator('[data-action="delete-dish"]').count(), 0);
  await page.goto(e.webUrl + 'studio/#/menu/d/' + oids.dishes.esp + '/addons');
  await sheet.locator('[data-dish-addons]').waitFor();
  assert.equal(await sheet.locator('[data-action="attach"], [data-limits], [data-dish-addons] .tools').count(), 0, 'nothing to attach, tighten or remove');
  await shot(page, '11-counter-dish');
  // the group editor: names, how guests choose, the steppers, the prices, the switches: all disabled; no save
  await page.goto(e.webUrl + 'studio/#/addons/' + oids.groups.milk);
  const ed = page.locator('[data-screen="group-editor"]');
  await ed.waitFor();
  assert.equal(await ed.locator('.group-form').locator('input:not([disabled]), select:not([disabled]), button:not([disabled])').count(), 0, 'the group is read-only');
  assert.equal(await ed.locator('[data-action="save-group"], [data-action="delete-group"], [data-action="add-option"]').count(), 0);
  await shot(page, '12-counter-group');
  // edit screens by address lead back
  const sec = (await other.api.select('sections', { select: 'id', venue_id: `eq.${other.venueId}` }))[0].id;
  await page.goto(e.webUrl + 'studio/#/menu/s/' + sec);
  await until(async () => (await page.evaluate(() => location.hash)) === '#/menu', 'the section sheet by address leads back to the menu');
  assert.equal(await page.locator('dialog[data-sheet="section"]').count(), 0);
  await page.goto(e.webUrl + 'studio/#/addons/new');
  await until(async () => (await page.evaluate(() => location.hash)) === '#/addons', 'a new group by address leads back to the library');
  await page.goto(e.webUrl + 'studio/#/publish');
  await page.locator('[data-screen="publish"]').waitFor();
  assert.equal(await page.locator('[data-action="publish"], [data-restore], [data-action="unpublish"]').count(), 0);
  // back in the owner's own place: editable again
  await page.locator('[data-action="switch-venue"]').click();
  await page.locator(`dialog[data-sheet="account"] [data-venue="${SLUG}"]`).click();
  await page.locator('[data-screen="home"]').waitFor();                        // a place that has published opens on Home
  await page.goto(e.webUrl + 'studio/#/menu');
  await page.getByRole('heading', { name: 'עיקריות', level: 2 }).waitFor();
  assert.equal(await page.locator('[data-tool="arrange"]').count(), 1);
  await page.context().close();

  // a manager edits; their role becomes counter while the dish is open; the next change is refused as "not allowed",
  // the field shows what is stored, and the screen turns read-only
  const mgr = await createUser(e.stack, { email: 'edge-manager@sim.local', password: PASSWORD });
  await e.stack.addMember(venueId, mgr.id, 'manager');
  const m = await signedIn('edge-manager@sim.local');
  await m.locator('[data-screen="home"]').waitFor();                           // the place has published: Home
  const ms = await openDish(m, 'plain');
  await ms.locator('[data-field="dish-desc-he"]').fill('מהמנהל');
  await until(async () => (await dishRow('plain')).desc_he === 'מהמנהל', 'the manager\'s edit saved');
  await e.stack.sql(`update public.venue_members set role = 'counter' where venue_id = $1 and user_id = $2`, [venueId, mgr.id]);
  await ms.locator('[data-field="dish-desc-he"]').fill('מהמנהל, עוד');
  await m.getByText('אין לחשבון הזה הרשאה לפעולה הזאת.').first().waitFor();
  await until(async () => (await ms.locator('[data-field="dish-desc-he"]').inputValue()) === 'מהמנהל', 'the field shows what is stored');
  await ms.locator('[data-dish-details][disabled]').waitFor();
  assert.equal((await dishRow('plain')).desc_he, 'מהמנהל');
  assert.equal(await m.getByText('זה כבר לא קיים').count(), 0, 'not "no longer exists"');
  await shot(m, '13-manager-made-counter');
  await e.stack.sql(`delete from public.venue_members where venue_id = $1 and user_id = $2`, [venueId, mgr.id]);
  await owner.api.update('dishes', { id: `eq.${ids.dishes.plain}` }, { desc_he: '' });
  await m.context().close();
});

// ------------------------------------------------------------------ sign-up
test('sign-up: when it is off here the start says so; a new address waits for its confirmation; an existing one is told', { timeout: 120000 }, async () => {
  const page = await e.page(e.webUrl + 'studio/');
  await page.locator('[data-screen="start"]').waitFor();
  await page.locator('[data-signup="closed"]').waitFor();
  assert.match(await page.locator('[data-signup]').innerText(), /חשבונות חדשים עוד לא נפתחים כאן/);
  await page.getByLabel('אימייל').fill('brand-new@sim.local');
  await page.getByLabel('סיסמה', { exact: true }).fill('a-good-password-1');
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.locator('[data-screen="start"] .note-error', { hasText: 'חשבונות חדשים עוד לא נפתחים כאן' }).waitFor();
  await shot(page, '14-signup-closed');
  const user = (identities) => ({ id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: '', email: 'brand-new@sim.local', phone: '', confirmation_sent_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), is_anonymous: false });
  const cases = [
    ['a new address', user([{ identity_id: 'x', id: 'x', user_id: '11111111-1111-4111-8111-111111111111', identity_data: {}, provider: 'email' }]), async () => {
      await page.locator('[data-screen="confirm-email"]').waitFor();
      assert.match(await page.locator('main').innerText(), /brand-new@sim\.local/);
    }],
    ['an existing address', user([]), async () => { await page.getByText('הסיסמה לא מתאימה לחשבון הזה.').waitFor(); }],
  ];
  for (const [name, body, check] of cases) {
    await page.route((u) => u.pathname.endsWith('/auth/v1/signup'), (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }));
    await page.goto(e.webUrl + 'studio/');
    await page.locator('[data-screen="start"]').waitFor();
    await page.getByLabel('אימייל').fill('brand-new@sim.local');
    await page.getByLabel('סיסמה', { exact: true }).fill('a-good-password-1');
    await page.getByRole('button', { name: 'המשך' }).click();
    await check();
    await shot(page, '15-signup-' + name.split(' ').at(-1));
    await page.unrouteAll();
  }
  await page.context().close();
});

// ------------------------------------------------------------------ rendering
test('rendering: prices left to right in Hebrew, + on the right, keyboard moves keep the focus, every control named, owner text never HTML, toasts over nothing', { timeout: 180000 }, async () => {
  const page = await signedIn();
  await page.goto(e.webUrl + 'studio/#/menu');
  await page.getByRole('heading', { name: 'עיקריות', level: 2 }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl');
  const priced = await page.locator('[data-price]').count();
  assert.equal(await page.locator('[data-price] bdi[dir="ltr"].price').count(), priced - 1, 'every amount isolated left to right (one dish has no price)');
  await shot(page, '16-rtl-menu');

  // keyboard only: the burger moves down to the last place; the focus never falls off the list
  await page.locator('[data-tool="arrange"]').click();
  const down = page.getByRole('button', { name: 'להוריד את המבורגר', exact: true });
  await down.focus();
  const rows = await page.locator(`section[data-section="${ids.sections.mains}"] li[data-row]`).count();
  const trail = [];
  for (let i = 1; i < rows; i++) {
    await page.keyboard.press('Enter');
    await sleep(500);
    trail.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName));
  }
  assert.ok(trail.every((x) => /המבורגר$/.test(x ?? '')), 'focus stayed on the burger\'s buttons: ' + JSON.stringify(trail));
  assert.equal(trail.at(-1), 'להעלות את המבורגר', 'at the last place, the focus moved to "up"');
  await page.locator('[data-save="saved"]').waitFor();
  const order = (await owner.api.select('dishes', { select: 'id,position', section_id: `eq.${ids.sections.mains}`, order: 'position' })).map((d) => d.id);
  assert.equal(order.at(-1), ids.dishes.burger);
  // and back up to the first place
  for (let i = 1; i < rows; i++) { await page.keyboard.press('Enter'); await sleep(500); }
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'להוריד את המבורגר', 'at the first place, the focus moved to "down"');
  await page.locator('[data-tool="arrange"]').click();

  // the steppers read − then + left to right in Hebrew too (as the guest app's)
  const ed = await openGroup(page, 'extras');
  const st = ed.locator('[data-stepper="group-max"]');
  const [minus, plus] = await Promise.all([st.getByRole('button', { name: /^פחות/ }).boundingBox(), st.getByRole('button', { name: /^יותר/ }).boundingBox()]);
  assert.ok(minus.x < plus.x, '+ is on the right');
  // a toast covers nothing: not the sticky bar (with its error line), not the screen's content
  await ed.locator('[data-field="group-label"]').fill('תווית');
  await ed.locator('[data-action="save-group"]').click();
  const toast = page.locator('.toast').first();
  await toast.waitFor();
  const [tb, sticky, top] = await Promise.all([toast.boundingBox(), page.locator('.sticky').boundingBox(), page.locator('header.top').boundingBox()]);
  assert.ok(tb.y + tb.height <= sticky.y, 'the toast is above the sticky bar');
  assert.ok(tb.y + tb.height <= top.y + top.height + 2, 'the toast stays over the top bar');
  await shot(page, '17-toast');
  await owner.api.update('addon_groups', { id: `eq.${ids.groups.extras}` }, { label: '' });

  // names: every control in the dish sheet, the guest preview, the group editor and publishing has an accessible name
  const cdp = await page.context().newCDPSession(page);
  const unnamed = async () => {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const roles = new Set(['button', 'textbox', 'combobox', 'checkbox', 'switch', 'radio', 'tab', 'link', 'spinbutton', 'menuitem', 'searchbox']);
    return nodes.filter((nd) => !nd.ignored && roles.has(nd.role?.value) && !(nd.name?.value || '').trim()).map((nd) => nd.role.value);
  };
  await openDish(page, 'burger', 'addons'); await sleep(600); assert.deepEqual(await unnamed(), [], 'dish add-ons and the preview');
  await openDish(page, 'burger', 'details'); await sleep(600); assert.deepEqual(await unnamed(), [], 'dish details');
  await openGroup(page, 'extras'); assert.deepEqual(await unnamed(), [], 'group editor');
  await page.goto(e.webUrl + 'studio/#/publish'); await page.locator('[data-screen="publish"]').waitFor(); await sleep(1200); assert.deepEqual(await unnamed(), [], 'publish');

  // owner text is text, everywhere
  const evil = '<img src=x onerror="window.__edge=1">';
  await owner.api.update('dishes', { id: `eq.${ids.dishes.plain}` }, { name_he: 'פשוט ' + evil, desc_he: evil, allergens_he: evil, price_note_he: evil });
  await owner.api.update('addon_groups', { id: `eq.${ids.groups.spare}` }, { name_he: 'רזרבה ' + evil, label: evil });
  await owner.api.update('addon_options', { id: `eq.${ids.options.sp1}` }, { name_he: 'אחת ' + evil });
  await owner.api.update('sections', { id: `eq.${ids.sections.mains}` }, { name_he: 'עיקריות ' + evil });
  await owner.insert('dish_addon_groups', [{ dish_id: ids.dishes.plain, group_id: ids.groups.spare, position: 0 }]);
  await page.reload(); await page.locator('.shell').waitFor();
  for (const where of ['#/menu', '#/menu/d/' + ids.dishes.plain + '/details', '#/menu/d/' + ids.dishes.plain + '/addons', '#/addons', '#/addons/' + ids.groups.spare, '#/publish']) {
    await page.goto(e.webUrl + 'studio/' + where); await sleep(1200);
    assert.equal(await page.locator('img[src="x"]').count(), 0, where);
    assert.equal(await page.evaluate(() => window.__edge), undefined, where);
  }
  await shot(page, '18-text-not-html');
  await page.context().close();
});
