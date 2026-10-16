// The owner app v2's operating side (apps/studio/src/v2: suggestions, hours, day parts, availability) on a 390 × 844
// phone against the simulator's stack, invented data only. An owner builds "after a coffee, a croissant, 7–11" and sees
// the live preview say yes at 08:00 and no at 13:00, builds "at checkout, when the basket has no drink, a lemonade",
// orders the two, sets breakfast as a day part on a section, sets the week's hours with a split Friday and a holiday
// closure, publishes, and public_menu carries the rules, the schedule and the hours exactly. When the stack has
// set_availability (the backend lane's phase-1 migration), the owner takes a dish off for two hours from the menu in two
// taps, public_menu's live overlay shows it greyed, and everything taken off today comes back with one button.
// Needs the built site (bash tools/build-site.sh). Screenshots: e2e/.out/studio-v2-operate/.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { addDays, isOpenAt, localParts, menuAvailability } from '@mana/contracts';
import { asAnon, HalomBot, OwnerBot } from '@mana/sim';
import { OUT, startE2E } from './helpers.mjs';

const SHOTS = path.join(OUT, 'studio-v2-operate');
const PASSWORD = 'sim-owner-pass-1';
const SLUG = 'morning-sim';
const TZ = 'Asia/Jerusalem';
let e, owner, ids, page, rpcReady = false;

/** The words the screens show, less the left-to-right isolates around ranges. */
const plain = (s) => s.replace(/[\u2066-\u2069]/g, '').trim();
const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
const problems = () => page.problems.filter((p) => !/Failed to load resource: the server responded with a status of (400|404)/.test(p));
const go = async (hash) => { await page.goto(e.webUrl + 'studio/#/' + hash); };
const rows = (table, extra = {}) => owner.api.select(table, { select: '*', venue_id: `eq.${owner.venueId}`, ...extra });
/** What the database holds once the app's save has landed (a write follows the tap by a moment). */
async function stored(read, want, what) {
  for (let i = 0; i < 50; i++) { const got = await read(); if (JSON.stringify(got) === JSON.stringify(want)) return; await new Promise((r) => setTimeout(r, 100)); }
  assert.deepEqual(await read(), want, what);
}

before(async () => {
  e = await startE2E({ seed: null });
  if (!e.hasSite) throw new Error('the site is not built: run bash tools/build-site.sh first');
  fs.mkdirSync(SHOTS, { recursive: true });
  owner = await OwnerBot.signUp(e.stack, { email: 'owner-operate@sim.local', password: PASSWORD });
  const made = await owner.createVenue({ slug: SLUG, name: { he: 'בוקר סים', en: 'Morning Sim' }, kind: 'cafe' });
  assert.equal(made.ok, true, JSON.stringify(made));
  // an invented menu, through the owner's own interfaces (the menu editor is the previous lane's, tested there)
  ids = await owner.buildMenu({
    sections: [
      { key: 'drinks', name: { he: 'שתייה', en: 'Drinks' }, kind: 'drinks', dishes: [
        { key: 'coffee', name: { he: 'קפה', en: 'Coffee' }, price: 1200 },
        { key: 'tea', name: { he: 'תה', en: 'Tea' }, price: 1000 },
        { key: 'lemonade', name: { he: 'לימונדה', en: 'Lemonade' }, price: 1400 },
      ] },
      { key: 'pastries', name: { he: 'מאפים', en: 'Pastries' }, kind: 'dessert', dishes: [
        { key: 'croissant', name: { he: 'קרואסון', en: 'Croissant' }, price: 1400 },
        { key: 'muffin', name: { he: 'מאפין', en: 'Muffin' }, price: 1200 },
      ] },
      { key: 'plates', name: { he: 'ארוחות בוקר', en: 'Breakfast plates' }, kind: 'food', dishes: [{ key: 'eggs', name: { he: 'ביצים ולחם', en: 'Eggs and bread' }, price: 4800 }] },
    ],
  });
  // is the backend lane's set_availability on this stack? (PostgREST answers 404 for a function it does not have)
  try { await owner.api.rpc('set_availability', { p_venue: owner.venueId, p_target_kind: 'dish', p_target_id: ids.dishes.tea, p_until: null, p_note: null }); rpcReady = true; }
  catch (err) { rpcReady = err.status !== 404; }
  page = await e.page(e.webUrl + 'studio/');
  await page.getByLabel('אימייל').fill('owner-operate@sim.local');
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.getByRole('heading', { name: 'שתייה', level: 2 }).waitFor();
}, { timeout: 240000 });
after(async () => { await e?.stop(); });

/** Pick dishes or sections in the editor's sheet. */
async function pick(scope, names) {
  await page.locator(`[data-targets="${scope}"] [data-action="pick-${scope}"]`).click();
  const sheet = page.locator('dialog[data-sheet="pick"]');
  for (const n of names) await sheet.getByRole('checkbox', { name: n, exact: true }).check();
  await sheet.locator('[data-action="pick-done"]').click();
  await sheet.waitFor({ state: 'detached' });
}

test('suggestions: "after a coffee, a croissant, 7–11" says yes at 08:00 and no at 13:00; "the basket lacks a drink"; their order', { timeout: 300000 }, async () => {
  await go('rules');
  await page.getByRole('heading', { name: 'עוד אין הצעות' }).waitFor();
  await shot('01-rules-empty');

  // ---- the morning rule
  await page.locator('[data-action="new-rule"]').click();
  const ed = page.locator('[data-screen="rule-editor"]');
  await ed.waitFor();
  assert.equal(await ed.getByRole('button', { name: 'אחרי הוספה', exact: true }).getAttribute('aria-pressed'), 'true', 'after adding is the default');
  await pick('scope', ['קפה']);
  await ed.getByRole('switch', { name: 'רק בין שעות מסוימות' }).click();
  await ed.locator('[data-field="rule-from"]').fill('07:00');
  await ed.locator('[data-field="rule-to"]').fill('11:00');
  await ed.locator('[data-field="rule-suggest-dish"]').selectOption({ label: 'קרואסון' });
  await ed.locator('[data-field="rule-line-he"]').fill('קרואסון חם ליד הקפה?');
  await ed.getByRole('button', { name: 'English', exact: true }).click();
  await ed.locator('[data-field="rule-line-en"]').fill('A warm croissant with your coffee?');
  await ed.getByRole('button', { name: 'עברית', exact: true }).click();
  assert.equal(plain(await ed.locator('[data-summary-now]').innerText()), 'אחרי קפה, להציע קרואסון, 7–11');

  // the live preview: the guest adds a coffee on a Thursday
  const pv = ed.locator('[data-rule-preview]');
  assert.equal(await pv.locator('[data-field="sample-dish"]').inputValue(), ids.dishes.coffee, 'the sample starts with the dish the rule applies to');
  await pv.locator('[data-field="sample-day"]').selectOption('4');
  await pv.locator('[data-field="sample-time"]').fill('08:00');
  await pv.locator('[data-verdict="yes"]').waitFor();
  assert.match(await pv.locator('[data-verdict]').innerText(), /תוצג הצעה: קרואסון/);
  assert.match(await pv.locator('[data-verdict]').innerText(), /קרואסון חם ליד הקפה\?/);
  await pv.scrollIntoViewIfNeeded();
  await shot('02-rule-preview-yes-0800');
  await pv.locator('[data-field="sample-time"]').fill('13:00');
  await pv.locator('[data-verdict="no"][data-why="when"]').waitFor();
  assert.match(plain(await pv.locator('[data-verdict]').innerText()), /לא בזמן הזה: ההצעה פועלת 7–11/);
  await shot('03-rule-preview-no-1300');
  // never in a chain, never what the basket already has
  await pv.locator('[data-field="sample-time"]').fill('08:00');
  await pv.locator('[data-field="sample-chained"]').check();
  await pv.locator('[data-verdict="no"][data-why="chained"]').waitFor();
  await pv.locator('[data-field="sample-chained"]').uncheck();
  await pv.locator('[data-field="sample-add"]').selectOption({ label: 'קרואסון' });
  await pv.locator('[data-verdict="no"][data-why="in_basket"]').waitFor();
  await pv.locator(`[data-basket-remove="${ids.dishes.croissant}"]`).click();
  await pv.locator('[data-verdict="yes"]').waitFor();
  await ed.locator('[data-action="save-rule"]').click();
  await page.locator('[data-screen="rule-editor"]:not([data-rule="new"])').waitFor();
  const morningId = await page.locator('[data-screen="rule-editor"]').getAttribute('data-rule');

  // ---- "at checkout, when the basket has no drink, a lemonade"
  await go('rules/new');
  await ed.waitFor();
  await ed.getByRole('button', { name: 'סיום הזמנה', exact: true }).click();
  await ed.getByRole('button', { name: 'כל מנה', exact: true }).click();
  await ed.getByRole('switch', { name: 'אין משהו מסוים' }).click();
  await pick('lacks', ['כל שתייה']);
  await ed.locator('[data-field="rule-suggest-dish"]').selectOption({ label: 'לימונדה' });
  assert.equal(plain(await ed.locator('[data-summary-now]').innerText()), 'בסיום ההזמנה, אם אין בהזמנה שתייה, להציע לימונדה');
  await pv.locator('[data-field="sample-add"]').selectOption({ label: 'קרואסון' });
  await pv.locator('[data-verdict="yes"]').waitFor();
  assert.match(await pv.locator('[data-verdict]').innerText(), /תוצג הצעה: לימונדה/);
  await pv.scrollIntoViewIfNeeded();
  await shot('04-lacks-drink-yes');
  await pv.locator('[data-field="sample-add"]').selectOption({ label: 'קפה' });
  await pv.locator('[data-verdict="no"][data-why="lacks"]').waitFor();
  assert.match(await pv.locator('[data-verdict]').innerText(), /בהזמנה כבר יש קפה\./);
  await shot('05-lacks-drink-no');
  await ed.locator('[data-action="save-rule"]').click();
  await page.locator('[data-screen="rule-editor"]:not([data-rule="new"])').waitFor();
  const lacksId = await page.locator('[data-screen="rule-editor"]').getAttribute('data-rule');

  // ---- the list: one plain line each, in the order they compete; move the second up by keyboard; off and on again
  await go('rules');
  await page.locator('[data-summary]').nth(1).waitFor();
  const summaries = async () => (await page.locator('[data-summary]').allInnerTexts()).map(plain);
  assert.deepEqual(await summaries(), ['אחרי קפה, להציע קרואסון, 7–11', 'בסיום ההזמנה, אם אין בהזמנה שתייה, להציע לימונדה']);
  await shot('06-rules-list');
  await page.locator('[data-tool="arrange-rules"]').click();
  const up = page.getByRole('button', { name: 'להעלות את בסיום ההזמנה, אם אין בהזמנה שתייה, להציע לימונדה' });
  await up.focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-save="saved"]').waitFor();
  await page.locator('[data-tool="arrange-rules"]').click();
  assert.deepEqual(await summaries(), ['בסיום ההזמנה, אם אין בהזמנה שתייה, להציע לימונדה', 'אחרי קפה, להציע קרואסון, 7–11']);
  await stored(async () => (await rows('upsell_rules', { order: 'priority.desc' })).map((r) => r.id), [lacksId, morningId], 'the priorities follow the new order');
  const morningSwitch = page.locator(`li[data-row="${morningId}"]`).getByRole('switch', { name: /^פעילה: אחרי קפה, להציע קרואסון/ });
  const active = async () => (await rows('upsell_rules', { id: `eq.${morningId}` }))[0].active;
  await morningSwitch.click();
  await page.locator(`[data-rule="${morningId}"] [data-rule-off]`).waitFor();
  await stored(active, false, 'switched off');
  await morningSwitch.click();
  await page.locator(`[data-rule="${morningId}"] [data-rule-off]`).waitFor({ state: 'detached' });
  await stored(active, true, 'switched on again');

  // the same lines in English, left to right
  const switchLanguage = async () => {
    await page.locator('[data-action="account"]').click();
    await page.locator('[data-menu="language"]').click();
    await page.keyboard.press('Escape');
  };
  await switchLanguage();
  await go('rules');
  assert.equal(await page.evaluate(() => document.documentElement.dir), 'ltr');
  await page.getByRole('heading', { name: 'Suggestions', level: 1 }).waitFor();
  assert.deepEqual(await summaries(), ['At checkout, if the basket has no Drinks, suggest Lemonade', 'After Coffee, suggest Croissant, 7–11']);
  await shot('06b-rules-list-english');
  await switchLanguage();
  await page.getByRole('heading', { name: 'הצעות לאורחים', level: 1 }).waitFor();
  assert.deepEqual(problems(), []);
});

test('a day part on a section, the week with a split Friday, a holiday closure, then public_menu carries them exactly', { timeout: 300000 }, async () => {
  // ---- breakfast, a day part
  await go('hours/parts');
  await page.getByRole('heading', { name: 'עוד אין חלקי יום או ספיישלים' }).waitFor();
  await page.locator('[data-action="new-daypart"]').click();
  const sch = page.locator('dialog[data-sheet="schedule"]');
  await sch.locator('[data-field="schedule-name-he"]').fill('בוקר');
  await sch.getByRole('button', { name: 'English', exact: true }).click();
  await sch.locator('[data-field="schedule-name-en"]').fill('Breakfast');
  assert.deepEqual([await sch.locator('[data-field="w0-from"]').inputValue(), await sch.locator('[data-field="w0-to"]').inputValue()], ['07:00', '12:00']);
  assert.equal(await sch.locator('[data-days="w0"] [data-day="all"]').getAttribute('aria-pressed'), 'true', 'a day part runs every day');
  await shot('07-daypart');
  await sch.locator('[data-action="save-schedule"]').click();
  await page.locator('[data-schedule]').waitFor();
  assert.match(plain(await page.locator('[data-schedule]').innerText()), /בוקר[\s\S]*כל יום 07:00–12:00[\s\S]*עוד לא בשימוש/);
  const [breakfast] = await rows('schedules');

  // on the breakfast plates' section
  await go('menu/s/' + ids.sections.plates);
  const sec = page.locator('dialog[data-sheet="section"]');
  await sec.locator('[data-field="section-daypart"]').selectOption({ label: 'בוקר' });
  await sec.locator('[data-action="save-section"]').click();
  await page.locator('.sec-part').waitFor();
  assert.equal(await page.locator('.sec-part').innerText(), 'מוצגת רק בזמן: בוקר');
  await stored(async () => (await rows('sections', { id: `eq.${ids.sections.plates}` }))[0].schedule_id, breakfast.id, 'the section follows breakfast');
  await shot('08-section-daypart');

  // ---- the week: Sun–Thu 07:00–15:00, a split Friday, Saturday closed
  await go('hours');
  await page.locator('[data-open-now="always"]').waitFor();
  async function addHours(days, from, to) {
    await page.locator('[data-action="add-hours"]').click();
    const add = page.locator('[data-hours-add]');
    for (const d of days) await add.locator(`[data-day="${d}"]`).click();
    await add.locator('[data-field="add-from"]').fill(from);
    await add.locator('[data-field="add-to"]').fill(to);
    await add.locator('[data-action="save-new-hours"]').click();
  }
  await addHours([0, 1, 2, 3, 4], '07:00', '15:00');
  await page.locator('li.weekday[data-day="4"] [data-hours]').waitFor();
  await addHours([5], '07:00', '11:00');
  await page.locator('li.weekday[data-day="5"] [data-hours]').waitFor();
  await addHours([5], '17:00', '22:00');
  await page.locator('li.weekday[data-day="5"] [data-hours]').nth(1).waitFor();
  // an overlap is refused before any write, in plain words
  await addHours([5], '10:00', '12:00');
  await page.getByText('השעות האלה חופפות לשעות שכבר קבעתם באותו יום.').waitFor();
  await page.locator('[data-hours-add]').getByRole('button', { name: 'ביטול' }).click();
  const weekText = async (d) => plain(await page.locator(`li.weekday[data-day="${d}"]`).innerText()).replace(/\s+/g, ' ');
  assert.equal(await weekText(5), 'שישי 07:00–11:00 17:00–22:00');
  assert.equal(await weekText(6), 'שבת סגור');

  // a holiday, ten days from now (the venue's date)
  const today = localParts(Date.now(), TZ).date, holiday = addDays(today, 10);
  await page.locator('[data-action="add-closure"]').click();
  await page.locator('[data-field="closure-from"]').fill(holiday);
  await page.locator('[data-field="closure-note"]').fill('חג');
  await page.locator('[data-action="save-closure"]').click();
  await page.locator('[data-closure]').waitFor();
  assert.match(await page.locator('[data-closure]').innerText(), /חג/);

  // "open now" as the guest's phone reads it, from the same rows
  const hours = await rows('venue_hours', { order: 'weekday,opens' });
  const venueHours = { timeZone: TZ, weekly: hours.map((h) => ({ days: [h.weekday], from: h.opens.slice(0, 5), to: h.closes.slice(0, 5) })), closures: [{ from: holiday, to: holiday }] };
  await page.locator(`[data-open-now="${isOpenAt(venueHours, Date.now()) ? 'open' : 'closed'}"]`).waitFor();
  await shot('09-hours');
  await page.locator('[data-closures]').scrollIntoViewIfNeeded();
  await shot('10-closures');

  // what guests see of something unavailable: hidden, then greyed again (the default)
  await page.locator('[data-soldout] button', { hasText: 'מוסתר' }).click();
  await page.locator('[data-soldout="hide"]').waitFor();
  const display = async () => (await owner.api.select('venues', { select: 'sold_out_display', id: `eq.${owner.venueId}` }))[0].sold_out_display;
  await stored(display, 'hide', 'hidden');
  await page.locator('[data-soldout] button', { hasText: 'באפור, בסוף' }).click();
  await page.locator('[data-soldout="bottom"]').waitFor();
  await stored(display, 'bottom', 'greyed again');

  // ---- publish; Halom approves; public_menu
  await go('publish');
  const pub = page.locator('[data-screen="publish"]');
  await pub.locator('[data-action="publish"]:not([disabled])').waitFor();
  assert.equal(await pub.locator('[data-issues]').count(), 0);
  assert.equal(await pub.locator('[data-warnings]').count(), 0, 'both rules publish as written');
  await pub.locator('[data-action="publish"]').click();
  await page.locator('[data-standing-card="pending"]').waitFor();
  const halom = await HalomBot.firstAdmin(e.stack, e.stack, { email: 'halom-operate@sim.local' });
  assert.equal((await halom.approve(owner.venueId, 'e2e: the v2 operating scenario')).ok, true);
  await pub.locator('[data-action="check-approval"]').click();
  await page.locator('[data-standing-card="live"]').waitFor();

  const got = await asAnon(e.stack).rpc('public_menu', { p_slug: SLUG });
  assert.equal(got.state, 'ok');
  const s = got.snapshot;
  const rules = await rows('upsell_rules', { order: 'priority.desc' });
  const p = Object.fromEntries(rules.map((r) => [r.suggest_dish_id === ids.dishes.croissant ? 'morning' : 'lacks', r.priority]));
  assert.deepEqual(s.upsellRules, [
    { id: rules[0].id, trigger: 'checkout', scope: { kind: 'all' }, when: null, basketHas: null, basketLacks: { dishes: [], sections: [ids.sections.drinks] },
      suggest: { kind: 'dish', dishId: ids.dishes.lemonade }, line: { he: '', en: '' }, priority: p.lacks, cap: 1, active: true },
    { id: rules[1].id, trigger: 'add', scope: { kind: 'dish', ids: [ids.dishes.coffee] }, when: { days: [], from: '07:00', to: '11:00' }, basketHas: null, basketLacks: null,
      suggest: { kind: 'dish', dishId: ids.dishes.croissant }, line: { he: 'קרואסון חם ליד הקפה?', en: 'A warm croissant with your coffee?' }, priority: p.morning, cap: 1, active: true },
  ]);
  assert.deepEqual(s.schedules, [{ id: breakfast.id, kind: 'day_part', name: { he: 'בוקר', en: 'Breakfast' }, windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '12:00' }], validFrom: null, validTo: null }]);
  assert.deepEqual(s.sections.map((x) => [x.name.en, x.scheduleId]), [['Drinks', null], ['Pastries', null], ['Breakfast plates', breakfast.id]]);
  assert.equal(s.venue.soldOut, 'bottom');
  // the hours are live (no publish needed): exactly the week that was set
  const week = [0, 1, 2, 3, 4].map((d) => ({ days: [d], from: '07:00', to: '15:00' }));
  assert.deepEqual(got.live.hours.weekly, [...week, { days: [5], from: '07:00', to: '11:00' }, { days: [5], from: '17:00', to: '22:00' }]);
  assert.deepEqual(got.live.hours.closures, [{ from: holiday, to: holiday }]);
  assert.equal(got.live.open, isOpenAt(venueHours, Date.parse(got.live.at)));
  // the owner's draft preview and what guests get are the same menu
  const draft = await owner.preview();
  assert.deepEqual({ ...s, revision: 0, publishedAt: '' }, { ...draft.snapshot, revision: 0, publishedAt: '' });
  assert.deepEqual(problems(), []);
});

test('availability from the phone: a dish off for two hours in two taps, greyed for guests, and everything taken off today back', { timeout: 300000 }, async (t) => {
  if (!rpcReady) { t.skip('set_availability is not on this stack yet (the backend lane\'s phase-1 migration)'); return; }
  await go('menu');
  const croissant = ids.dishes.croissant;
  // tap 1: the row's availability; tap 2: "for 2 hours"
  await page.locator(`[data-off-open="${croissant}"]`).click();
  const sheet = page.locator('dialog[data-sheet="off"]');
  await sheet.waitFor();
  assert.match(await sheet.locator('[data-until="h2"]').innerText(), /לשעתיים[\s\S]*חוזר: /);
  await shot('11-off-sheet');
  const before = Date.now();
  await sheet.locator('[data-until="h2"]').click();
  await sheet.waitFor({ state: 'detached' });
  await page.locator(`[data-off="${croissant}"]`).waitFor();
  assert.match(await page.locator(`[data-off="${croissant}"]`).innerText(), /^לא זמין עד \d\d:\d\d$/);
  await page.locator('[data-off-now="1"]').waitFor();
  await shot('12-off-marker');

  // guests: greyed at the end of its section (never orderable), until two hours from now, to the minute
  const m = await asAnon(e.stack).rpc('public_menu', { p_slug: SLUG });
  const off = m.live.off.find((o) => o.id === croissant);
  assert.ok(off && off.until, JSON.stringify(m.live.off));
  const until = Date.parse(off.until);
  assert.equal(until % 60_000, 0, 'whole minutes');
  assert.ok(until >= before + 2 * 3600_000 && until <= Date.now() + 2 * 3600_000 + 60_000, off.until);
  const av = menuAvailability(m.snapshot, m.live, Date.parse(m.live.at));
  assert.deepEqual([m.snapshot.venue.soldOut, av.dishes.get(croissant).available, av.dishes.get(croissant).reason], ['bottom', false, 'off']);

  // the whole pastries section until the next opening: the dish inside reads "with its section"
  await page.locator(`[data-off-open="${ids.sections.pastries}"]`).click();
  await sheet.locator('[data-until="next_opening"]').click();
  await sheet.waitFor({ state: 'detached' });
  await page.locator(`[data-off="${ids.sections.pastries}"]`).waitFor();
  assert.equal(await page.locator(`[data-off="${ids.dishes.muffin}"]`).innerText(), 'לא זמין, כי הקטגוריה לא זמינה');

  // everything taken off today comes back
  await page.locator('[data-action="restore-today"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'להחזיר הכול' }).click();
  await page.locator('[data-off-now]').waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-off]').count(), 0);
  const m2 = await asAnon(e.stack).rpc('public_menu', { p_slug: SLUG });
  assert.deepEqual(m2.live.off, []);
  await shot('13-all-back');
  assert.deepEqual(problems(), []);
});
