// The owner app v2's setup flow (F03; apps/studio/src/v2/screens/onboarding.tsx) on a 390 × 844 phone against the
// simulator's stack, invented data only (the café of fixtures/wolt-text-cafe.mjs). In Hebrew and in English, a new owner
// signs up, names a place, imports its menu from the text of its own Wolt page, fixes what the preview lists (a price
// typed in place), confirms the imported groups' limits in the group editor, sets breakfast hours, tries the menu in the
// phone frame, and publishes; after Halom approves, public_menu is exactly what was imported (the side of choice with
// its nested sauce, the typed price). The main path is timed. Then: leaving mid-flow and coming back on another device
// (the same step, the typed price there); the same menu imported again adds nothing (Hopa test 1); "get help" opens a
// case the back office's RPC reads, and sent again after a lost answer (the request's own id) opens no second one; the
// scanner's path with a stub (the real handler, a recorded reply, no paid call; every picture drawn again, so no EXIF
// leaves the phone), and plainly "not available here" without one; a counter can run none of the flow's writes. The
// security round: an import of another place is never checked or applied while this one is open; the answers kept on
// the device are the account's own and gone at sign-out; a name with a direction control in it is isolated. The QA
// round: leaving out a section, a dish and a dish's 9th group (too many, its one answer a button); giving up asks
// first; an apply whose import changed on another device, or whose answer is lost, is read again; imports that cannot
// be read are said, with a retry; a HEIC is refused when chosen; sentences keep the screen's direction.
// Needs the built site (bash tools/build-site.sh). Screenshots: e2e/.out/studio-v2-onboarding/.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseWoltText } from '@mana/import';
import { asAnon, asUser, createUser, HalomBot, OwnerBot, signIn } from '@mana/sim';
import { WOLT_TEXT, WOLT_TEXT_REORDERED } from './fixtures/wolt-text-cafe.mjs';
import { dish, draftOf, group, link, opt, section } from '../packages/contracts/test/import-fixtures.ts';
import { OUT, startE2E } from './helpers.mjs';
import { CAFE_SCREENSHOTS, scanStub, TINY_PNG } from './scan-stub.mjs';

const SHOTS = path.join(OUT, 'studio-v2-onboarding');
const PASSWORD = 'sim-owner-pass-1';
let e, halom;

before(async () => {
  e = await startE2E({ seed: null });
  if (!e.hasSite) throw new Error('the site is not built: run bash tools/build-site.sh first');
  fs.mkdirSync(SHOTS, { recursive: true });
  halom = await HalomBot.firstAdmin(e.stack, e.stack, { email: 'halom-onboarding@sim.local' });
}, { timeout: 240000 });
after(async () => { await e?.stop(); });

const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true });
/** What went wrong in the page, less the refusals the app reads on purpose (a 400 or 404 is the browser's own line). */
const problems = (page) => page.problems.filter((p) => !/Failed to load resource: the server responded with a status of (400|404|409)/.test(p));
const step = (page, s) => page.locator(`[data-screen="onboarding"][data-step="${s}"]`).waitFor({ timeout: 20000 });
const rowsOf = (owner, table, venueId, extra = {}) => owner.api.select(table, { select: '*', venue_id: `eq.${venueId}`, ...extra });

async function signInPage(email, { lang = 'he', ctx = null } = {}) {
  const page = ctx ? await ctx.newPage() : await e.page(e.webUrl + 'studio/');
  if (ctx) { page.problems = []; await page.goto(e.webUrl + 'studio/'); }
  await page.locator('[data-screen="start"]').waitFor();
  // the start screen's language switch names the other language (lang="en" while the page is Hebrew)
  if (lang === 'en' && (await page.evaluate(() => document.documentElement.lang)) !== 'en') await page.locator('[data-screen="start"] button[lang="en"]').click();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form.start-form button[type="submit"]').click();
  return page;
}

/** The place's dishes, sections and groups as stored, by English name (the café's text is English). */
async function stored(owner, venueId) {
  const [sections, dishes, groups, options] = await Promise.all(['sections', 'dishes', 'addon_groups', 'addon_options'].map((t) => rowsOf(owner, t, venueId)));
  return { sections, dishes, groups, options, names: dishes.map((d) => d.name_en).sort() };
}

const CAFE_DISHES = ['Cappuccino', 'Cheesecake', 'Espresso', 'Schnitzel plate', 'Seasonal cake', 'Shakshuka'];

/** A JPEG with an EXIF segment carrying `marker` right after its start, the way a camera writes where a photo was taken. */
function withExif(jpeg, marker) {
  const tiff = Buffer.concat([Buffer.from('MM\0\x2a\0\0\0\x08', 'latin1'), Buffer.alloc(6), Buffer.from(marker, 'latin1')]);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const len = body.length + 2;
  return Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1, len >> 8, len & 0xff]), body, jpeg.subarray(2)]);
}

/** Import the café's Wolt text from the menu step: paste, read; the preview opens. Returns the import's id. */
async function importWoltText(page, text = WOLT_TEXT) {
  await page.locator('[data-source="wolt_text"]').click();
  await page.locator('[data-text-import="wolt_text"] [data-d33]').waitFor();
  await page.locator('[data-field="import-text"]').fill(text);
  await page.locator('[data-action="read-text"]').click();
  await page.locator('[data-review]').waitFor({ timeout: 20000 });
  return page.locator('[data-review]').getAttribute('data-review');
}

/** The preview: one thing to fix (the cake's unreadable price), typed in place; the prices confirmed; applied. */
async function fixAndApply(page, { price = '28' } = {}) {
  const fix = page.locator('[data-exception^="price_unreadable@"]');
  await fix.waitFor();
  assert.equal(await fix.getAttribute('data-open'), 'yes');
  assert.equal(await page.locator('[data-action="apply-import"]').isDisabled(), true, 'applying waits for the fix and the prices');
  await fix.locator('input[data-field^="fix-price-"]').fill(price);
  await fix.locator('[data-action="set-price"]').click();
  await fix.waitFor({ state: 'detached' });
  await page.locator('[data-prices-confirm] button[role="switch"]').click();
  const apply = page.locator('[data-action="apply-import"]:not([disabled])');
  await apply.waitFor();
  await apply.click();
}

// ------------------------------------------------------------------ the whole path, in Hebrew and in English
for (const lang of ['he', 'en']) {
  test(`${lang}: a new owner signs up, imports from Wolt text, fixes, confirms limits, sets breakfast hours, tries it, publishes`, { timeout: 600000 }, async () => {
    const email = `onboard-${lang}@sim.local`;
    const name = lang === 'he' ? 'קפה בוקר סים' : 'Morning Sim Cafe';
    const owner = await OwnerBot.signUp(e.stack, { email, password: PASSWORD });      // sign-up (local: no mail service)
    const t0 = Date.now();
    const page = await signInPage(email, { lang });
    assert.equal(await page.evaluate(() => document.documentElement.dir), lang === 'he' ? 'rtl' : 'ltr');

    // ---- 1. the place: its name, its kind, its permanent address
    await page.locator('#place-name').fill(name);
    await page.locator('[data-avail="free"]').waitFor();
    await page.locator('[data-kind="cafe"]').click();
    await page.locator('.setup-form button[type="submit"]').click();
    await step(page, 'menu');
    const venueId = await page.locator('.shell').getAttribute('data-venue');
    owner.forVenue(venueId);
    assert.equal(await page.locator('[data-progress]').getAttribute('data-progress'), '1/9', 'the place is the database\'s own step, done');
    assert.equal(await page.locator('[data-source]').count(), 4, 'four ways in');
    assert.ok(await page.locator('[data-never-wolt]').isVisible());
    await shot(page, `${lang}-01-bring-the-menu`);
    // the step the owner is on is saved (doing) before anything else
    await assert.doesNotReject(async () => {
      for (let i = 0; i < 50; i++) { const [r] = await rowsOf(owner, 'onboarding_progress', venueId, { step: 'eq.menu' }); if (r?.state === 'doing') return; await new Promise((ok) => setTimeout(ok, 100)); }
      throw new Error('menu step not marked doing');
    });

    // ---- 2. bring the menu: the text of the owner's own Wolt page
    const importId = await importWoltText(page);
    assert.equal(await page.locator('[data-counts]').getAttribute('data-counts'), '4/7/3/7', 'sections, dishes, groups, choices as read');
    await page.locator('[data-notes] [data-note="noise"]').first().waitFor();
    assert.equal((await rowsOf(owner, 'dishes', venueId)).length, 0, 'nothing saved to the menu before applying');
    const [imp] = await owner.api.select('menu_imports', { select: 'status,source', id: `eq.${importId}` });
    assert.deepEqual(imp, { status: 'parsed', source: 'wolt_text' });
    // the checks are listed with their defaults; the repeated espresso is left out by default
    assert.equal(await page.locator('[data-check] [data-code="limits_guessed"]').count(), 2);
    assert.equal(await page.locator('[data-check] [data-code="dish_repeated"]').getAttribute('data-choice'), 'skip');
    assert.equal(await page.locator('[data-check] [data-code="allergens_check"]').count(), 1, 'allergens only in the source\'s own words');
    await page.locator('[data-plan-line="create:dish"][data-n="6"]').waitFor();
    await shot(page, `${lang}-02-review`);
    // a sentence that begins with a Latin name keeps the screen's direction; the name inside it is isolated
    const repeated = page.locator('[data-check] [data-code="dish_repeated"] .exc-text');
    assert.equal(await repeated.getAttribute('dir'), null);
    assert.equal(await repeated.evaluate((el) => getComputedStyle(el).direction), lang === 'he' ? 'rtl' : 'ltr');
    assert.match(await repeated.textContent(), /\u2068Espresso\u2069/);

    // ---- 3. fix in place, confirm the prices, apply
    await fixAndApply(page);
    await step(page, 'addons');
    let s = await stored(owner, venueId);
    assert.deepEqual(s.names, CAFE_DISHES, 'every dish once, "Most ordered" left out');
    assert.equal(s.dishes.find((d) => d.name_en === 'Seasonal cake').price, 2800, 'the typed price');
    assert.equal(s.dishes.find((d) => d.name_en === 'Schnitzel plate').allergens_en, 'gluten, egg');
    assert.deepEqual(s.groups.map((g) => [g.name_en, g.limits_confirmed]).sort(), [['Choose a sauce', false], ['Extras', false], ['Side of choice', true]]);
    const fries = s.options.find((o) => o.name_en === 'Fries'), sauce = s.groups.find((g) => g.name_en === 'Choose a sauce');
    assert.equal(fries.opens_group_id, sauce.id, 'the nested sauce under the fries');
    const steps = Object.fromEntries((await rowsOf(owner, 'onboarding_progress', venueId)).map((r) => [r.step, r.state]));
    assert.deepEqual([steps.menu, steps.review], ['done', 'done'], 'the database marked both itself');

    // ---- 4. add-ons: each imported group's limits confirmed in the group editor
    await shot(page, `${lang}-03-addons`);
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-ob-group][data-confirmed="no"] a').first().click();
      await page.locator('[data-screen="group-editor"] [data-limits-unconfirmed]').waitFor();
      if (i === 0) await shot(page, `${lang}-04-confirm-limits`);
      await page.locator('[data-action="confirm-limits"]').click();
      await page.locator('[data-screen="group-editor"] [data-limits-unconfirmed]').waitFor({ state: 'detached' });
      await page.locator('[data-back-to-setup="addons"]').click();
      await step(page, 'addons');
    }
    assert.equal((await rowsOf(owner, 'addon_groups', venueId, { limits_confirmed: 'eq.false' })).length, 0);
    await page.locator('[data-action="flow-done"]').click();

    // ---- 5. photos: no picture slot yet; each dish shows "no photo yet"
    await step(page, 'photos');
    assert.equal(await page.locator('[data-no-photo]').getAttribute('data-no-photo'), '6');
    await page.locator('[data-action="flow-later"]').click();

    // ---- 6. hours: breakfast, every day 07:00–12:00, on the hours screen itself
    await step(page, 'hours');
    await page.locator('[data-action="set-hours"]').click();
    await page.locator('[data-action="add-hours"]').click();
    const add = page.locator('[data-hours-add]');
    await add.locator('[data-day="all"]').click();
    await add.locator('[data-field="add-from"]').fill('07:00');
    await add.locator('[data-field="add-to"]').fill('12:00');
    await add.locator('[data-action="save-new-hours"]').click();
    await page.locator('li.weekday[data-day="6"] [data-hours]').waitFor();
    await page.locator('[data-back-to-setup="hours"]').click();
    await step(page, 'hours');
    await page.locator('[data-ob-week] li.weekday[data-day="0"]', { hasText: '07:00' }).waitFor();
    await shot(page, `${lang}-05-hours`);
    await page.locator('[data-action="flow-done"]').click();
    assert.equal((await rowsOf(owner, 'venue_hours', venueId)).length, 7);

    // ---- 7. style: what this app has (the languages); the default look
    await step(page, 'style');
    await page.locator('[data-action="flow-later"]').click();

    // ---- 8. try it on a phone: the dish's sheet, the side of choice, the nested sauce, the price
    await step(page, 'test');
    const plate = s.dishes.find((d) => d.name_en === 'Schnitzel plate');
    await page.locator(`[data-phone-dish="${plate.id}"]`).click();
    const gp = page.locator('[data-phone-frame] [data-guest-preview]');
    await gp.waitFor();
    await gp.locator(`[data-preview-option="${fries.id}"] input`).check();
    const aioli = s.options.find((o) => o.name_en === 'Aioli');
    await gp.locator(`[data-preview-option="${aioli.id}"] input`).check();
    assert.equal(await gp.locator('.gp-total').getAttribute('data-total'), '6500', '₪62 + aioli ₪3');
    await shot(page, `${lang}-06-phone`);
    await page.locator('[data-action="phone-back"]').click();
    await page.locator('[data-action="flow-done"]').click();

    // ---- 9. publish: the publish screen itself, then the QR code and the table card, marked "demo" here (B5)
    await step(page, 'publish');
    await page.locator('[data-publish] [data-action="publish"]:not([disabled])').click();
    await page.locator('[data-standing-card="pending"]').waitFor();
    const seconds = Math.round((Date.now() - t0) / 1000);
    await page.locator('[data-qr-card] [data-demo="card"]').waitFor();
    const qr = decodeURIComponent((await page.locator('[data-qr-card] img[data-qr]').getAttribute('src')).split(',')[1]);
    assert.ok(qr.includes('data-demo="mark"') && qr.includes('DEMO'), 'the code itself carries the mark');
    await shot(page, `${lang}-07-published`);
    await page.locator('[data-action="flow-next"]').click();
    await page.locator('[data-screen="onboarding"][data-step="done"]').waitFor();
    const prog = Object.fromEntries((await rowsOf(owner, 'onboarding_progress', venueId)).map((r) => [r.step, r.state]));
    assert.deepEqual(prog, { venue: 'done', menu: 'done', review: 'done', addons: 'done', photos: 'skipped', hours: 'done', style: 'skipped', test: 'done', publish: 'done' });
    await shot(page, `${lang}-08-all-set`);
    console.log(`# ${lang}: the main path (sign-in to published) took ${seconds} s`);

    // ---- Halom approves; guests get exactly what was imported
    const [rev] = await owner.api.select('menu_revisions', { select: 'number', venue_id: `eq.${venueId}`, order: 'number.desc', limit: 1 });
    assert.equal((await halom.approve(venueId, 'e2e: onboarding approved', rev.number)).ok, true);
    const slug = (await owner.api.select('venues', { select: 'slug', id: `eq.${venueId}` }))[0].slug;
    const pub = await asAnon(e.stack).rpc('public_menu', { p_slug: slug });
    assert.equal(pub.state, 'ok');
    const dishes = pub.snapshot.sections.flatMap((x) => x.dishes);
    assert.deepEqual(dishes.map((d) => d.name.en).sort(), CAFE_DISHES);
    assert.equal(dishes.find((d) => d.name.en === 'Seasonal cake').price.amount, 2800);
    const side = pub.snapshot.addonGroups.find((g) => g.name.en === 'Side of choice');
    assert.equal(side.options.find((o) => o.name.en === 'Fries').opensGroupId, sauce.id);
    assert.deepEqual(pub.live.hours.weekly.length, 7);
    assert.deepEqual(problems(page), []);
    await page.context().close();
  });
}

// ------------------------------------------------------------------ leave mid-flow, come back on another device
test('leaving mid-flow and coming back on another device: the same step, the typed price there, then on to the next', { timeout: 300000 }, async () => {
  const email = 'onboard-resume@sim.local';
  const owner = await OwnerBot.signUp(e.stack, { email, password: PASSWORD });
  const made = await owner.createVenue({ slug: 'resume-sim', name: { he: '', en: 'Resume Sim' }, kind: 'cafe' });
  assert.equal(made.ok, true);
  // device A: imports, types the cake's price, and leaves before applying
  const a = await signInPage(email);
  await step(a, 'menu');
  const importId = await importWoltText(a);
  const fix = a.locator('[data-exception^="price_unreadable@"]');
  await fix.locator('input[data-field^="fix-price-"]').fill('31');
  await fix.locator('[data-action="set-price"]').click();
  await fix.waitFor({ state: 'detached' });
  // stored again (save_import_draft) before A goes
  for (let i = 0; i < 50; i++) {
    const [row] = await owner.api.select('menu_imports', { select: 'parsed', id: `eq.${importId}` });
    if (row.parsed.sections.some((x) => x.dishes.some((d) => d.name.en === 'Seasonal cake' && d.price === 3100))) break;
    if (i === 49) throw new Error('the typed price was not stored');
    await new Promise((ok) => setTimeout(ok, 100));
  }
  await a.context().close();

  // device B (another browser): opens on the import's check, with A's price
  const b = await signInPage(email);
  await b.locator(`[data-review="${importId}"]`).waitFor({ timeout: 20000 });
  assert.equal(await b.locator('[data-exception^="price_unreadable@"]').count(), 0, 'fixed on A');
  assert.ok((await b.locator('[data-draft-dish]', { hasText: 'Seasonal cake' }).innerText()).includes('31'));
  await shot(b, 'resume-01-other-device');
  await b.locator('[data-prices-confirm] button[role="switch"]').click();
  await b.locator('[data-action="apply-import"]:not([disabled])').click();
  await step(b, 'addons');
  await b.context().close();

  // device C: the add-ons step, where B left off
  const c = await signInPage(email);
  await step(c, 'addons');
  assert.equal(await c.locator('[data-ob-group][data-confirmed="no"]').count(), 2);
  assert.deepEqual(problems(c), []);
  await c.context().close();
});

// ------------------------------------------------------------------ re-import: no duplicates (Hopa test 1)
test('importing the same menu again adds nothing: the same text is the same import, and the same menu reordered changes nothing', { timeout: 300000 }, async () => {
  const email = 'onboard-again@sim.local';
  const owner = await OwnerBot.signUp(e.stack, { email, password: PASSWORD });
  const made = await owner.createVenue({ slug: 'again-sim', name: { he: '', en: 'Again Sim' }, kind: 'cafe' });
  owner.forVenue(made.id);
  const page = await signInPage(email);
  await step(page, 'menu');
  await importWoltText(page);
  await fixAndApply(page);
  await step(page, 'addons');
  const before = await stored(owner, made.id);
  assert.deepEqual(before.names, CAFE_DISHES);

  // the same text again: create_import finds the import already applied; nothing is read or stored
  await page.goto(e.webUrl + 'studio/#/onboarding/menu/wolt_text');
  await page.locator('[data-field="import-text"]').fill(WOLT_TEXT);
  await page.locator('[data-action="read-text"]').click();
  await page.locator('[data-action="see-import"]').waitFor();
  await shot(page, 'again-01-same-text');
  assert.equal((await owner.api.select('menu_imports', { select: 'id', venue_id: `eq.${made.id}` })).length, 1, 'no second import');

  // the same menu copied another day, in another order (another input): read, matched, nothing to add
  await page.goto(e.webUrl + 'studio/#/onboarding/menu/wolt_text');
  await page.locator('[data-field="import-text"]').fill(WOLT_TEXT_REORDERED);
  await page.locator('[data-action="read-text"]').click();
  await page.locator('[data-review]').waitFor();
  // the cake's price is still unreadable in this copy: "no price for now" keeps the venue's
  await page.locator('[data-exception^="price_unreadable@"] [data-choose="no_price"]').click();
  await page.locator('[data-plan-nothing]').waitFor();
  await shot(page, 'again-02-nothing-to-add');
  await page.locator('[data-prices-confirm] button[role="switch"]').click();
  await page.locator('[data-action="apply-import"]:not([disabled])').click();
  await page.locator('[data-screen="onboarding"]:not([data-step="review"])').waitFor();
  const after = await stored(owner, made.id);
  assert.deepEqual(after.names, CAFE_DISHES, 'no dish twice');
  assert.equal(after.sections.length, before.sections.length);
  assert.equal(after.groups.length, before.groups.length);
  assert.equal(after.options.length, before.options.length);
  assert.equal(after.dishes.find((d) => d.name_en === 'Seasonal cake').price, 2800, 'the venue\'s price kept');
  assert.deepEqual(problems(page), []);
  await page.context().close();
});

// ------------------------------------------------------------------ get help: a case the back office reads
test('"get help" from a step opens a case on the step\'s topic, and the back office\'s RPC reads it', { timeout: 180000 }, async () => {
  const email = 'onboard-help@sim.local';
  const owner = await OwnerBot.signUp(e.stack, { email, password: PASSWORD });
  const made = await owner.createVenue({ slug: 'help-sim', name: { he: '', en: 'Help Sim' }, kind: 'cafe' });
  const page = await signInPage(email);
  await step(page, 'menu');
  await page.locator('[data-flow-help="import"]').click();
  await page.locator('[data-help-form]').waitFor();
  assert.equal(await page.locator('[data-topic="import"]').getAttribute('aria-checked'), 'true', 'the step\'s topic');
  await page.locator('[data-field="help-subject"]').fill('The Wolt text left out a section');
  await page.locator('[data-action="send-help"]').click();
  const sent = page.locator('[data-case-sent]');
  await sent.waitFor();
  const caseId = await sent.getAttribute('data-case-sent');
  await shot(page, 'help-01-sent');
  // the way back to the step is one tap
  await page.locator('[data-back-to-setup="menu"]').click();
  await step(page, 'menu');
  // the back office reads it (ops_venue, as staff)
  const card = await halom.venue(made.id);
  const c = card.cases.find((x) => x.id === caseId);
  assert.ok(c, JSON.stringify(card.cases));
  assert.deepEqual([c.topic, c.status, c.subject], ['import', 'open', 'The Wolt text left out a section']);
  const list = await halom.venues({ q: 'help-sim' });
  assert.ok(list.venues.find((v) => v.id === made.id).warnings.includes('case_open'));

  // a lost answer, and the look-up after it lost too: the owner sends again, with the request's own id, and the
  // database answers with the case it already opened (reused), not a second one
  await page.locator('[data-flow-help="import"]').click();
  await page.locator('[data-help-form]').waitFor();
  await page.locator(`[data-cases] [data-case="${caseId}"]`).waitFor();     // the screen's own read of the list is done
  const subject = 'The prices of the drinks look off';
  await page.locator('[data-field="help-subject"]').fill(subject);
  const ids = [], replies = [];
  const toCase = (u) => u.pathname.endsWith('/rest/v1/rpc/open_case');
  const toList = (u) => u.pathname.endsWith('/rest/v1/support_cases');
  let lose = true;
  await page.route(toCase, async (r) => {
    ids.push(JSON.parse(r.request().postData()).p_id);
    const res = await r.fetch();
    replies.push(await res.json());
    if (lose) { lose = false; return r.abort('internetdisconnected'); }
    return r.fulfill({ response: res });
  });
  await page.route(toList, (r) => r.abort('internetdisconnected'));          // every read of the list, until the error shows
  await page.locator('[data-action="send-help"]').click();
  await page.locator('[data-help-form] .note-error').waitFor();
  await page.unroute(toList);
  assert.equal(await page.locator('[data-case-sent]').count(), 0, 'not found: the screen offers to send again');
  await page.locator('[data-action="send-help"]').click();
  await sent.waitFor();
  await page.unroute(toCase);
  assert.equal(ids.length, 2);
  assert.ok(ids[0] && ids[0] === ids[1], 'the same id both times');
  assert.deepEqual(replies.map((x) => [x.ok, x.caseId, x.reused]), [[true, ids[0], false], [true, ids[0], true]]);
  const stored = await owner.api.select('support_cases', { select: 'id', venue_id: `eq.${made.id}`, subject: `eq.${subject}` });
  assert.deepEqual(stored.map((x) => x.id), [ids[0]], 'one case');
  assert.equal(await sent.getAttribute('data-case-sent'), ids[0]);

  // the same lost answer, but the owner changes the words before sending again: a new request with a new id, so the
  // new words are stored (the database would answer `reused` for the old id, and the new words would be lost)
  await page.locator('[data-back-to-setup="menu"]').click();
  await step(page, 'menu');
  await page.locator('[data-flow-help="import"]').click();
  await page.locator('[data-help-form]').waitFor();
  await page.locator(`[data-cases] [data-case="${caseId}"]`).waitFor();
  ids.length = 0; replies.length = 0; lose = true;
  await page.route(toCase, async (r) => {
    ids.push(JSON.parse(r.request().postData()).p_id);
    const res = await r.fetch();
    replies.push(await res.json());
    if (lose) { lose = false; return r.abort('internetdisconnected'); }
    return r.fulfill({ response: res });
  });
  await page.locator('[data-field="help-subject"]').fill('The dessert prices are wrong');
  await page.route(toList, (r) => r.abort('internetdisconnected'));
  await page.locator('[data-action="send-help"]').click();
  await page.locator('[data-help-form] .note-error').waitFor();
  await page.unroute(toList);
  await page.locator('[data-field="help-subject"]').fill('The dessert prices are wrong, all three');
  await page.locator('[data-action="send-help"]').click();
  await sent.waitFor();
  await page.unroute(toCase);
  assert.equal(ids.length, 2);
  assert.ok(ids[0] && ids[1] && ids[0] !== ids[1], 'changed words: a new id');
  assert.deepEqual(replies.map((x) => x.reused), [false, false]);
  const now = await owner.api.select('support_cases', { select: 'id,subject', venue_id: `eq.${made.id}`, subject: 'like.The dessert*', order: 'created_at' });
  assert.deepEqual(now.map((x) => [x.id, x.subject]), [[ids[0], 'The dessert prices are wrong'], [ids[1], 'The dessert prices are wrong, all three']],
    'the first (its answer lost) and the corrected one, each with its own words');
  assert.deepEqual(problems(page).filter((p) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(p)), []);
  await page.context().close();
});

// ------------------------------------------------------------------ the security round: one place's import, one person's answers
/** An import of `venue` read by the phone's own reader and stored, waiting for its check (as the app would leave it). */
async function parsedImport(owner, venue, text) {
  owner.forVenue(venue);
  const made = await owner.createImport({ source: 'wolt_text', text });
  assert.equal(made.ok, true, JSON.stringify(made));
  const { draft } = parseWoltText(text);
  const saved = await owner.api.rpc('save_import_draft', { p_import: made.importId, p_draft: draft, p_notes: [] });
  assert.equal(saved.ok, true, JSON.stringify(saved).slice(0, 300));
  return { id: made.importId, draft };
}
const answerKeys = (page) => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mana-import-answers:')).sort());

test('an import of another place is never checked or applied here: said plainly, with the way to its place; answers are the account\'s own, gone at sign-out', { timeout: 600000 }, async () => {
  const email = 'onboard-two-places@sim.local';
  const owner = await OwnerBot.signUp(e.stack, { email, password: PASSWORD });
  const A = (await owner.createVenue({ slug: 'two-places-a', name: { he: '', en: 'Two Places A' }, kind: 'cafe' })).id;
  const B = (await owner.createVenue({ slug: 'two-places-b', name: { he: '', en: 'Two Places B' }, kind: 'cafe' })).id;
  // B has the café's menu already (imported through the database's own path); A has the same menu read, and no dish
  const b1 = await parsedImport(owner, B, WOLT_TEXT);
  const fixes = (await owner.api.select('menu_imports', { select: 'exceptions', id: `eq.${b1.id}` }))[0].exceptions.filter((x) => x.severity === 'fix');
  const choices = Object.fromEntries(fixes.map((x) => [`${x.code}@${x.key}`, x.code === 'price_unreadable' || x.code === 'price_missing' ? 'no_price' : 'skip']));
  assert.equal((await owner.api.rpc('apply_import', { p_import: b1.id, p_draft: b1.draft, p_decisions: { v: 1, pricesConfirmed: true, choices, skip: [] } })).ok, true);
  const a1 = await parsedImport(owner, A, WOLT_TEXT_REORDERED);
  const dishesOf = async (v) => (await owner.api.select('dishes', { select: 'name_en', venue_id: `eq.${v}` })).map((x) => x.name_en).sort();
  const bBefore = await dishesOf(B);
  assert.deepEqual(await dishesOf(A), []);

  // B open (the account's last place), A's import by its address (Back after switching place, or a link)
  const page = await signInPage(email, { lang: 'en' });
  await page.locator('.shell').waitFor();
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), ['mana-studio-v2-venue:' + owner.userId, B]);
  await page.goto(e.webUrl + 'studio/#/onboarding/review/' + a1.id);
  await page.reload();
  await page.locator(`.shell[data-venue="${B}"]`).waitFor();
  const elsewhere = page.locator(`[data-import-elsewhere="${A}"]`);
  await elsewhere.waitFor();
  assert.equal(await page.locator('[data-review]').count(), 0, 'no preview planned against B\'s menu');
  assert.equal(await page.locator('[data-action="apply-import"]').count(), 0, 'nothing to apply here');
  assert.match(await elsewhere.innerText(), /another place[\s\S]*Two Places A/);
  await shot(page, 'sec-01-another-place');
  assert.deepEqual(await dishesOf(A), []);
  assert.deepEqual(await dishesOf(B), bBefore);

  // the way to its place: A opens, and A's import is checked against A's own menu (every dish is new there)
  await elsewhere.locator('[data-action="open-import-place"]').click();
  await page.locator(`.shell[data-venue="${A}"]`).waitFor();
  await page.locator(`[data-review="${a1.id}"]`).waitFor();
  await page.locator('[data-plan-line="create:dish"]').first().waitFor();
  assert.ok(Number(await page.locator('[data-plan-line="create:dish"]').getAttribute('data-n')) > 0);
  assert.equal(await page.locator('[data-plan-nothing]').count(), 0);

  // an answer is kept for this account and this import only
  await page.locator('[data-exception^="price_unreadable@"] [data-choose="no_price"]').click();
  await page.waitForFunction((k) => !!localStorage.getItem(k), `mana-import-answers:${owner.userId}:${a1.id}`);
  assert.deepEqual(await answerKeys(page), [`mana-import-answers:${owner.userId}:${a1.id}`]);
  // signing out leaves none on the device
  await page.locator('[data-action="account"]').click();
  await page.locator('[data-menu="sign-out"]').click();
  await page.locator('[data-screen="start"]').waitFor();
  assert.deepEqual(await answerKeys(page), [], 'gone at sign-out');
  // answers left by another account, or by an older version of the app, are gone once this account signs in
  await page.evaluate((keys) => { for (const k of keys) localStorage.setItem(k, JSON.stringify({ choices: {}, skip: ['s0'] })); },
    [`mana-import-answers:00000000-0000-4000-8000-00000000beef:${a1.id}`, `mana-import-answers:${a1.id}`]);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form.start-form button[type="submit"]').click();
  await page.locator('.shell').waitFor();
  await page.waitForFunction(() => !Object.keys(localStorage).some((k) => k.startsWith('mana-import-answers:')));
  // back on A's import: the answer given before signing out is asked again, and applying writes to A, never to B
  await page.goto(e.webUrl + 'studio/#/onboarding/review/' + a1.id);
  const cake = page.locator('[data-exception^="price_unreadable@"]');
  if (!(await page.locator(`.shell[data-venue="${A}"]`).count())) await page.locator(`[data-import-elsewhere="${A}"] [data-action="open-import-place"]`).click();
  await cake.waitFor();
  assert.equal(await cake.getAttribute('data-open'), 'yes', 'not answered: the answer did not outlive the sign-out');
  await cake.locator('[data-choose="no_price"]').click();
  await page.locator('[data-prices-confirm] button[role="switch"]').click();
  await page.locator('[data-action="apply-import"]:not([disabled])').click();
  await page.locator('[data-screen="onboarding"]:not([data-step="review"])').waitFor();
  assert.ok((await dishesOf(A)).length > 0, 'A has its menu');
  assert.deepEqual(await dishesOf(B), bBefore, 'B is as it was');
  assert.deepEqual(await answerKeys(page), [], 'applied: the answers are dropped');
  assert.deepEqual(problems(page), []);
  await page.context().close();
});

test('a name read with a direction control in it never turns the sentence round: each name is isolated', { timeout: 300000 }, async () => {
  const email = 'onboard-bidi@sim.local';
  const owner = await OwnerBot.signUp(e.stack, { email, password: PASSWORD });
  const made = await owner.createVenue({ slug: 'bidi-sim', name: { he: '', en: 'Bidi Sim' }, kind: 'cafe' });
  const imp = await parsedImport(owner, made.id, WOLT_TEXT.replace('Seasonal cake', 'Seasonal‮ cake'));
  const page = await signInPage(email, { lang: 'en' });
  await page.goto(e.webUrl + 'studio/#/onboarding/review/' + imp.id);
  const what = page.locator('[data-exception^="price_unreadable@"] .exc-what .exc-text');
  await what.waitFor();
  const text = await what.textContent();
  assert.match(text, /^We could not read the price of "⁨[^⁩]*⁩"\.$/, JSON.stringify(text));
  assert.deepEqual(problems(page), []);
  await page.context().close();
});

// ------------------------------------------------------------------ the QA round: leaving things out, a lost or stale apply, the imports unread
/** An import whose stored draft is `draft` (made with the contracts' own builders), waiting for its check. */
async function draftImport(owner, venue, draft) {
  owner.forVenue(venue);
  const made = await owner.createImport({ source: 'wolt_text', text: 'invented ' + draft.sections.map((x) => x.key).join(' ') + ' ' + Date.now() });
  assert.equal(made.ok, true, JSON.stringify(made));
  const saved = await owner.api.rpc('save_import_draft', { p_import: made.importId, p_draft: draft, p_notes: [] });
  assert.equal(saved.ok, true, JSON.stringify(saved).slice(0, 300));
  return made.importId;
}

test('the owner leaves things out: a dish\'s 9th add-on group (too many) with its one answer, a section and a dish by choice; giving up asks first', { timeout: 300000 }, async () => {
  const email = 'onboard-leave@sim.local';
  const owner = await OwnerBot.signUp(e.stack, { email, password: PASSWORD });
  const made = await owner.createVenue({ slug: 'leave-sim', name: { he: '', en: 'Leave Sim' }, kind: 'cafe' });
  const groups = Array.from({ length: 9 }, (_, i) => group('g' + i, 'קבוצה ' + i, 'Group ' + i, { options: [opt(`o${i}a`, `א${i}`, `A${i}`, 0), opt(`o${i}b`, `ב${i}`, `B${i}`, 0)] }));
  const imp = await draftImport(owner, made.id, draftOf([
    section('s1', 'עיקריות', 'Mains', [dish('d1', 'המבורגר', 'Burger', 6000, { groups: groups.map((g) => link(g.key)) }), dish('d2', 'סלט', 'Salad', 4200)]),
    section('s2', 'קינוחים', 'Desserts', [dish('d3', 'עוגה', 'Cake', 3200), dish('d4', 'גלידה', 'Ice cream', 2400)]),
  ], groups));
  const page = await signInPage(email, { lang: 'en' });
  await page.locator(`[data-review="${imp}"]`).waitFor({ timeout: 20000 });
  // too many: one answer, still a button; with nothing on the menu yet, said without "with what you already have"
  const many = page.locator('[data-exception="too_many@d1>g8"]');
  assert.equal(await many.getAttribute('data-open'), 'yes');
  await page.locator('[data-prices-confirm] button[role="switch"]').click();
  assert.equal(await page.locator('[data-action="apply-import"]').isDisabled(), true);
  assert.match(await page.locator('[data-apply-blocked] [data-blocked="too_many"]').innerText(), /^This is more than one menu holds/);
  await shot(page, 'qa-01-too-many');
  await many.locator('[data-choose="skip"]').click();
  await page.locator('[data-exception="too_many@d1>g8"][data-open="no"]').waitFor();
  // the desserts and the salad left out; the salad put back, then left out again
  await page.locator('[data-leave="s2"]').click();
  await page.locator('[data-draft-section="s2"][data-out="yes"]').waitFor();
  await page.locator('[data-leave="d2"]').click();
  await page.locator('[data-draft-dish="d2"][data-out="yes"]').waitFor();
  await page.locator('[data-leave="d2"]').click();
  await page.locator('[data-draft-dish="d2"][data-out="no"]').waitFor();
  await page.locator('[data-leave="d2"]').click();
  await page.locator('[data-draft-dish="d2"][data-out="yes"]').waitFor();
  assert.equal(await page.locator('[data-leave="d2"]').getAttribute('aria-pressed'), 'true');
  assert.match(await page.locator('[data-plan-line="skip:section"][data-reason="choice"]').innerText(), /Left out: 1 section · as you chose/);
  assert.match(await page.locator('[data-plan-line="skip:dish"][data-reason="choice"]').innerText(), /Left out: 1 dish · as you chose/);
  assert.match(await page.locator('[data-plan-line="skip:dish"][data-reason="parent_skipped"]').innerText(), /Left out: 2 dishes · with what they belong to/);
  const kept = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), `mana-import-answers:${owner.userId}:${imp}`);
  assert.deepEqual(kept.skip, ['d2', 's2'], 'kept for this account and this import');
  await shot(page, 'qa-02-left-out');
  // giving up asks first: kept on "Cancel"
  await page.locator('[data-action="discard-import"]').click();
  const ask = page.locator('dialog[open]');
  await ask.waitFor();
  assert.match(await ask.innerText(), /Give up this import\?/);
  await ask.getByRole('button', { name: 'Cancel' }).click();
  await ask.waitFor({ state: 'detached' });
  assert.equal((await owner.api.select('menu_imports', { select: 'status', id: `eq.${imp}` }))[0].status, 'parsed');
  // applied: the burger with eight groups, no salad, no desserts
  await page.locator('[data-action="apply-import"]:not([disabled])').click();
  await step(page, 'addons');
  const s = await stored(owner, made.id);
  assert.deepEqual([s.names, s.sections.length], [['Burger'], 1]);
  assert.equal((await rowsOf(owner, 'dish_addon_groups', made.id)).length, 8);
  // one dish in one section: said in the singular
  await page.goto(e.webUrl + 'studio/#/onboarding/menu');
  assert.match(await page.locator('[data-menu-has]').innerText(), /Your menu has 1 dish in 1 section/);
  assert.deepEqual(problems(page), []);
  await page.context().close();
});

test('applying when the import changed on another device, or when the answer is lost: read again, then shown as stored, or on as applied', { timeout: 300000 }, async () => {
  const email = 'onboard-lost@sim.local';
  const owner = await OwnerBot.signUp(e.stack, { email, password: PASSWORD });
  const made = await owner.createVenue({ slug: 'lost-sim', name: { he: '', en: 'Lost Sim' }, kind: 'cafe' });
  owner.forVenue(made.id);
  const page = await signInPage(email, { lang: 'en' });
  await step(page, 'menu');
  const id = await importWoltText(page);
  // another device types the cake's price and stores the draft while this one is still checking it
  const [row] = await owner.api.select('menu_imports', { select: 'parsed', id: `eq.${id}` });
  const other = JSON.parse(JSON.stringify(row.parsed));
  for (const sec of other.sections) for (const d of sec.dishes) if (d.name.en === 'Seasonal cake') { d.price = 3100; d.priceText = null; }
  assert.equal((await owner.api.rpc('save_import_draft', { p_import: id, p_draft: other, p_notes: [] })).ok, true);
  await page.locator('[data-exception^="price_unreadable@"] [data-choose="no_price"]').click();
  await page.locator('[data-prices-confirm] button[role="switch"]').click();
  await page.locator('[data-action="apply-import"]:not([disabled])').click();
  await page.locator('[data-reread]').waitFor();
  assert.equal(await page.locator('[data-exception^="price_unreadable@"]').count(), 0, 'the other device\'s price is there');
  assert.ok((await page.locator('[data-draft-dish]', { hasText: 'Seasonal cake' }).innerText()).includes('31'));
  assert.equal((await rowsOf(owner, 'dishes', made.id)).length, 0, 'nothing applied from the draft that was out of date');
  await shot(page, 'qa-03-changed-elsewhere');
  // the answer to "add to my menu" is lost after the database applied it: read again, and on as applied
  let lose = true;
  const toApply = (u) => u.pathname.endsWith('/rest/v1/rpc/apply_import');
  await page.route(toApply, async (r) => { const res = await r.fetch(); if (lose) { lose = false; return r.abort('internetdisconnected'); } return r.fulfill({ response: res }); });
  await page.locator('[data-prices-confirm] button[role="switch"]').click();
  await page.locator('[data-action="apply-import"]:not([disabled])').click();
  await step(page, 'addons');
  await page.unroute(toApply);
  assert.equal(lose, false, 'the answer was lost');
  assert.equal((await rowsOf(owner, 'dishes', made.id)).length, 6);
  assert.equal((await owner.api.select('menu_imports', { select: 'status', id: `eq.${id}` }))[0].status, 'applied');
  assert.equal(await page.locator('[data-ob-group]').count(), 3, 'the app reads the applied menu: its groups are on the add-ons step');
  assert.equal(await page.locator('[data-ob-group][data-confirmed="no"]').count(), 2);
  assert.deepEqual(problems(page).filter((p) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(p)), []);
  await page.context().close();
});

test('when the imports cannot be read, the review step says so and tries again', { timeout: 300000 }, async () => {
  const email = 'onboard-unread@sim.local';
  const owner = await OwnerBot.signUp(e.stack, { email, password: PASSWORD });
  await owner.createVenue({ slug: 'unread-sim', name: { he: '', en: 'Unread Sim' }, kind: 'cafe' });
  const page = await signInPage(email, { lang: 'en' });
  await step(page, 'menu');
  const toImports = (u) => u.pathname.endsWith('/rest/v1/menu_imports');
  await page.route(toImports, (r) => r.abort('internetdisconnected'));
  await page.goto(e.webUrl + 'studio/#/onboarding/review');
  await page.reload();
  const err = page.locator('[data-screen="onboarding"][data-step="review"] .note-error');
  await err.waitFor();
  await shot(page, 'qa-04-imports-unread');
  await page.unroute(toImports);
  await err.getByRole('button').click();
  await page.locator('[data-review-none]').waitFor();
  await page.context().close();
});

// ------------------------------------------------------------------ the scanner's path
test('without a scanner here: the picture ways say so plainly and offer the text ways', { timeout: 180000 }, async () => {
  const email = 'onboard-noscan@sim.local';
  const owner = await OwnerBot.signUp(e.stack, { email, password: PASSWORD });
  await owner.createVenue({ slug: 'noscan-sim', name: { he: '', en: 'No Scan Sim' }, kind: 'cafe' });
  const page = await signInPage(email);
  await step(page, 'menu');
  await page.locator('[data-source="wolt_screenshots"][data-available="no"]').waitFor();
  await page.locator('[data-source="scan"]').click();
  await page.locator('[data-scanner="off"]').waitFor();
  await page.locator('[data-action="use-wolt-text"]').click();
  await page.locator('[data-text-import="wolt_text"]').waitFor();
  await shot(page, 'scan-00-not-here');
  assert.deepEqual(problems(page), []);
  await page.context().close();
});

test('Wolt screenshots through the scanner (a stub: the real handler, a recorded reply, nothing paid): read, reviewed, applied', { timeout: 300000 }, async () => {
  const email = 'onboard-scan@sim.local';
  const owner = await OwnerBot.signUp(e.stack, { email, password: PASSWORD });
  const made = await owner.createVenue({ slug: 'scan-sim', name: { he: '', en: 'Scan Sim' }, kind: 'cafe' });
  const stub = scanStub(e.stack, { reply: CAFE_SCREENSHOTS });
  const ctx = await e.browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  const page = await ctx.newPage();
  page.problems = [];
  page.on('pageerror', (x) => page.problems.push('pageerror: ' + x.message));
  page.on('console', (m) => { if (m.type() === 'error') page.problems.push('console: ' + m.text()); });
  await stub.attach(page);
  await page.goto(e.webUrl + 'studio/');
  await page.locator('[data-screen="start"]').waitFor();
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('form.start-form button[type="submit"]').click();
  await step(page, 'menu');
  await page.locator('[data-source="wolt_screenshots"][data-available="yes"]').click();
  await page.locator('[data-image-import="wolt_screenshots"] [data-no-wolt-photos]').waitFor();
  // a HEIC is refused when it is chosen, never shown as a broken picture to fail only on "Read"
  const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.from([0, 0, 0, 0]), Buffer.from('mif1heic'), Buffer.alloc(200)]);
  await page.locator('[data-field="import-files"]').setInputFiles([{ name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: heic }]);
  await page.locator('[data-image-import="wolt_screenshots"] .note-error').waitFor();
  assert.match(await page.locator('[data-image-import="wolt_screenshots"] .note-error').innerText(), /HEIC/);
  assert.deepEqual([await page.locator('[data-chosen]').getAttribute('data-chosen'), await page.locator('[data-image-import] .thumbs img').count()], ['0', 0]);
  // a screenshot, and a photo straight from a camera: a JPEG with EXIF saying where it was taken (an invented place)
  const plain = Buffer.from(await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    const x = c.getContext('2d'); x.fillStyle = '#b4232a'; x.fillRect(0, 0, 16, 16);
    const b = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return [...new Uint8Array(await b.arrayBuffer())];
  }));
  const WHERE = 'GPS 31.0000 N 34.0000 E invented';
  const camera = withExif(plain, WHERE);
  assert.ok(camera.includes('Exif') && camera.includes(WHERE));
  await page.locator('[data-field="import-files"]').setInputFiles([
    { name: 'shot-1.png', mimeType: 'image/png', buffer: TINY_PNG },
    { name: 'photo-2.jpg', mimeType: 'image/jpeg', buffer: camera },
  ]);
  await page.locator('[data-chosen="2"]').waitFor();
  await shot(page, 'scan-01-chosen');
  await page.locator('[data-action="read-pictures"]').click();
  await page.locator('[data-review]').waitFor({ timeout: 60000 });
  assert.deepEqual([stub.seen.uploads, stub.seen.scans, stub.seen.model], [2, 1, 1], 'two pictures, one read, one (recorded) model call');
  const importId = await page.locator('[data-review]').getAttribute('data-review');
  const [imp] = await owner.api.select('menu_imports', { select: 'status,source,raw_paths', id: `eq.${importId}` });
  assert.equal(imp.status, 'parsed');
  assert.deepEqual(imp.raw_paths, [`${made.id}/imports/${importId}/01.png`, `${made.id}/imports/${importId}/02.jpg`]);
  // every picture was drawn again before it left the phone: what the camera wrote beside the photo never arrives
  for (const p of imp.raw_paths) {
    const up = Buffer.from(stub.files.get(p).bytes);
    assert.ok(!up.includes('Exif') && !up.includes(WHERE), p + ': no EXIF, no place');
  }
  assert.equal(stub.files.get(imp.raw_paths[1]).type, 'image/jpeg');
  await shot(page, 'scan-02-review');
  await page.locator('[data-prices-confirm] button[role="switch"]').click();
  await page.locator('[data-action="apply-import"]:not([disabled])').click();
  await page.locator('[data-screen="onboarding"]:not([data-step="review"])').waitFor();
  const s = await stored(owner, made.id);
  assert.deepEqual(s.names, ['Espresso', 'Schnitzel plate']);
  assert.equal(s.options.find((o) => o.name_en === 'Fries').opens_group_id, s.groups.find((g) => g.name_en === 'Choose a sauce').id);
  // no dish photo comes from the screenshots in phase 1
  assert.equal((await rowsOf(owner, 'assets', made.id)).length, 0);
  assert.deepEqual(problems(page), []);
  await ctx.close();
});

// ------------------------------------------------------------------ a counter runs none of the flow's writes
test('a counter: the flow is not theirs (taken to the menu), and the database refuses each of its writes', { timeout: 180000 }, async () => {
  const owner = await OwnerBot.signUp(e.stack, { email: 'onboard-owner-c@sim.local', password: PASSWORD });
  const made = await owner.createVenue({ slug: 'counter-flow-sim', name: { he: '', en: 'Counter Flow Sim' }, kind: 'cafe' });
  const user = await createUser(e.stack, { email: 'onboard-counter@sim.local', password: PASSWORD });
  await e.stack.addMember(made.id, user.id, 'counter');
  const page = await signInPage('onboard-counter@sim.local');
  await page.locator('[data-screen="menu"]').waitFor({ timeout: 20000 });
  for (const where of ['onboarding', 'onboarding/menu/wolt_text', 'onboarding/review']) {
    await page.goto(e.webUrl + 'studio/#/' + where);
    await page.locator('[data-screen="menu"]').waitFor();
    assert.equal(await page.locator('[data-screen="onboarding"], [data-action="read-text"], [data-action="apply-import"]').count(), 0, where);
  }
  // the database's answer to each write, as that counter
  const api = asUser(e.stack, await signIn(e.stack, { email: 'onboard-counter@sim.local', password: PASSWORD }));
  const refused = async (fn, args) => { try { await api.rpc(fn, args); return 'written'; } catch (x) { return x.status === 403 || x.body?.code === '42501' ? 'refused' : 'other:' + x.status; } };
  assert.equal(await refused('set_onboarding_step', { p_venue: made.id, p_step: 'hours', p_state: 'done' }), 'refused');
  assert.equal(await refused('create_import', { p_venue: made.id, p_source: 'wolt_text', p_text: WOLT_TEXT }), 'refused');
  assert.equal(await refused('open_case', { p_venue: made.id, p_topic: 'onboarding', p_subject: 'from a counter', p_body: '' }), 'refused');
  assert.equal((await owner.api.select('menu_imports', { select: 'id', venue_id: `eq.${made.id}` })).length, 0);
  assert.deepEqual(problems(page), []);
  await page.context().close();
});
