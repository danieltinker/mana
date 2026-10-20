// The owner app v2's operating side (apps/studio/src/v2: suggestions, hours, day parts, availability) on a 390 × 844
// phone against the simulator's stack, invented data only. An owner builds "after a coffee, a croissant, 7–11" and sees
// the live preview say yes at 08:00 and no at 13:00, builds "at checkout, when the basket has no drink, a lemonade",
// orders the two, sets breakfast as a day part on a section, sets the week's hours with a split Friday and a holiday
// closure, publishes, and public_menu carries the rules, the schedule and the hours exactly. Then the owner takes a dish
// off for two hours from the menu in two taps (set_availability), public_menu's live overlay shows it greyed, and
// everything taken off today comes back with one button (restore_today). Last, a counter: takes a dish off and brings
// it back, and sees the suggestions, the hours, the closed dates and the day parts read-only, with nothing sent. And a
// rule and an opening window changed on another device meanwhile: never written over without the owner's say.
// Needs the built site (bash tools/build-site.sh). Screenshots: e2e/.out/studio-v2-operate/.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { addDays, isOpenAt, localParts, menuAvailability } from '@mana/contracts';
import { asAnon, createUser, HalomBot, OwnerBot } from '@mana/sim';
import { OUT, startE2E } from './helpers.mjs';
import { lang } from '../apps/studio/src/lib/i18n.ts';
import { momentText } from '../apps/studio/src/v2/words.ts';

const SHOTS = path.join(OUT, 'studio-v2-operate');
const PASSWORD = 'sim-owner-pass-1';
const SLUG = 'morning-sim';
const TZ = 'Asia/Jerusalem';
let e, owner, ids, page;

/** The words the screens show, less the invisible marks that keep ranges whole and left to right. */
const plain = (s) => s.replace(/[\u2060\u2066-\u2069]/g, '').trim();
const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
const problems = () => page.problems.filter((p) => !/Failed to load resource: the server responded with a status of (400|404)/.test(p));
const go = async (hash) => { await page.goto(e.webUrl + 'studio/#/' + hash); };
const rows = (table, extra = {}) => owner.api.select(table, { select: '*', venue_id: `eq.${owner.venueId}`, ...extra });
/** What the database holds once the app's save has landed (a write follows the tap by a moment). */
/** What a screen reader gets for an element: its accessible name and description, as Chromium computes them. */
async function ax(p, selector) {
  const cdp = await p.context().newCDPSession(p);
  try {
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    const n = nodes.find((x) => !x.ignored) ?? nodes[0];
    return { name: plain(n?.name?.value ?? ''), description: plain(n?.description?.value ?? '') };
  } finally { await cdp.detach(); }
}
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

test('availability from the phone: a dish off for two hours in two taps, greyed for guests, and everything taken off today back', { timeout: 300000 }, async () => {
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
  // the focus is back on the button that opened the sheet
  await stored(() => page.evaluate(() => document.activeElement?.getAttribute('data-off-open')), croissant, 'the focus returns to the row\'s button');
  // a screen reader hears it too: the row link's description and the button's name carry the red marker
  const link = await ax(page, `a[data-dish="${croissant}"]`);
  assert.equal(link.name, 'עריכת קרואסון');
  assert.match(link.description, /₪14[\s\S]*לא זמין עד \d\d:\d\d$/, link.description);
  assert.match((await ax(page, `[data-off-open="${croissant}"]`)).name, /^זמינות: קרואסון\. לא זמין עד \d\d:\d\d$/);
  assert.equal((await ax(page, `[data-off-open="${ids.dishes.muffin}"]`)).name, 'זמינות: מאפין', 'what is available says nothing more');
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
  assert.match((await ax(page, `[data-off-open="${ids.sections.pastries}"]`)).name, /^זמינות: מאפים\. לא זמין עד /);
  assert.match((await ax(page, `a[data-dish="${ids.dishes.muffin}"]`)).description, /^₪12\s+לא זמין, כי הקטגוריה לא זמינה$/);

  // the croissant is off by itself and with its section: the sheet says so before, and bringing it back says it stays off
  await page.locator(`[data-off-open="${croissant}"]`).click();
  await sheet.locator('[data-off-also-section]').waitFor();
  await sheet.locator('[data-action="bring-back"]').click();
  await sheet.waitFor({ state: 'detached' });
  await page.getByText('קרואסון: הוחזר, אבל עדיין לא זמין כי הקטגוריה שלו לא זמינה').waitFor();
  await stored(() => page.locator(`[data-off="${croissant}"]`).innerText(), 'לא זמין, כי הקטגוריה לא זמינה', 'still off, with its section');

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

test('a counter takes a dish off and brings it back, and sees suggestions, hours, closed dates and day parts read-only', { timeout: 300000 }, async () => {
  const counter = await createUser(e.stack, { email: 'counter-operate@sim.local', password: PASSWORD });
  await e.stack.addMember(owner.venueId, counter.id, 'counter');
  const c = await e.page(e.webUrl + 'studio/');
  // every write the counter's browser sends to a table (the RPCs are the counter's own: set_availability, restore_today)
  const writes = [];
  c.on('request', (r) => { const u = new URL(r.url()); if (u.pathname.startsWith('/rest/v1/') && !u.pathname.startsWith('/rest/v1/rpc/') && r.method() !== 'GET' && r.method() !== 'HEAD') writes.push(r.method() + ' ' + u.pathname); });
  await c.getByLabel('אימייל').fill('counter-operate@sim.local');
  await c.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await c.getByRole('button', { name: 'המשך' }).click();
  // the place has published: Home, where a counter has only the availability actions (no numbers, nudges or export)
  await c.locator('[data-screen="home"]').waitFor();
  assert.deepEqual(await c.locator('[data-quick] [data-act]').evaluateAll((els) => els.map((x) => x.dataset.act)), ['off2h', 'restore-today']);
  assert.equal(await c.locator('[data-glance], [data-nudges], [data-export], [data-recent]').count(), 0);
  await c.goto(e.webUrl + 'studio/#/activity');
  await c.getByText('החשבון הזה לא יכול לראות את יומן הפעילות.').waitFor();
  await c.goto(e.webUrl + 'studio/#/help');
  await c.locator('[data-screen="help"]').waitFor();
  assert.equal(await c.locator('[data-help-form]').count(), 0, 'a counter opens no case');
  await c.goto(e.webUrl + 'studio/#/menu');
  await c.getByRole('heading', { name: 'שתייה', level: 2 }).waitFor();
  const at = async (hash) => { await c.goto(e.webUrl + 'studio/#/' + hash); };
  const hash = () => c.evaluate(() => location.hash);
  const live = (root) => root.locator('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])').count();
  const RO = 'החשבון הזה יכול לראות את ההגדרות האלה, אבל לא לשנות אותן.';

  // ---- the menu: nothing to edit, but every row's availability one tap away
  assert.match(await c.locator('main').innerText(), /להוריד דברים מהתפריט לזמן מה ולהחזיר אותם/);
  assert.equal(await c.locator('[data-tool]').count(), 0, 'no arrange, no new section');
  const tea = ids.dishes.tea;
  await c.locator(`[data-off-open="${tea}"]`).click();
  const sheet = c.locator('dialog[data-sheet="off"]');
  await sheet.locator('[data-until="h1"]').click();
  await sheet.waitFor({ state: 'detached' });
  await c.locator(`[data-off="${tea}"]`).waitFor();
  assert.match(await c.locator(`[data-off="${tea}"]`).innerText(), /^לא זמין עד \d\d:\d\d$/);
  const [o] = await rows('availability_overrides', { target_id: `eq.${tea}`, restored_at: 'is.null' });
  assert.equal(o.created_by, counter.id, 'taken off by the counter, through set_availability');
  await c.screenshot({ path: path.join(SHOTS, '14-counter-menu.png') });
  await c.locator(`[data-off-open="${tea}"]`).click();
  await sheet.locator('[data-action="bring-back"]').click();
  await sheet.waitFor({ state: 'detached' });
  await c.locator(`[data-off="${tea}"]`).waitFor({ state: 'detached' });
  await stored(async () => (await rows('availability_overrides', { target_id: `eq.${tea}`, restored_at: 'is.null' })).length, 0, 'brought back');

  // ---- suggestions: the list without new, arrange or switches; a rule read-only (no preview: the draft is for editors)
  await at('rules');
  await c.locator('[data-summary]').nth(1).waitFor();
  assert.equal(await c.getByText(RO).count(), 1);
  assert.equal(await c.locator('[data-action="new-rule"], [data-tool="arrange-rules"], [data-screen="rules"] [role="switch"]').count(), 0);
  const morning = (await rows('upsell_rules')).find((r) => r.suggest_dish_id === ids.dishes.croissant);
  await at('rules/' + morning.id);
  const ed = c.locator('[data-screen="rule-editor"]');
  await ed.waitFor();
  assert.equal(await live(ed.locator('.rule-form')), 0, 'every field, switch, chip and choice disabled');
  assert.equal(await ed.locator('[data-action="save-rule"], [data-action="delete-rule"], [data-action^="pick-"]').count(), 0);
  assert.equal(plain(await ed.locator('[data-summary-now]').innerText()), 'אחרי קפה, להציע קרואסון, 7–11');
  assert.equal(await ed.locator('[data-rule-preview]').count(), 0);
  await c.screenshot({ path: path.join(SHOTS, '15-counter-rule.png') });
  await at('rules/new');
  await stored(hash, '#/rules', 'a new rule by address leads back to the list');
  assert.equal(await c.locator('[data-screen="rule-editor"]').count(), 0);

  // ---- hours and closed dates: shown, nothing to add, change or remove
  await at('hours');
  await c.locator('li.weekday[data-day="5"] [data-hours]').nth(1).waitFor();
  assert.equal(await c.getByText(RO).count(), 1);
  assert.equal(await c.locator('[data-action="add-hours"], [data-action="add-closure"], button[data-hours], [data-closures] button, [data-soldout] button').count(), 0);
  assert.match(await c.locator('[data-closure]').innerText(), /חג/);
  await c.screenshot({ path: path.join(SHOTS, '16-counter-hours.png') });

  // ---- day parts: the list without new; breakfast read-only; a new one by address leads back
  await at('hours/parts');
  await c.locator('[data-schedule]').waitFor();
  assert.equal(await c.locator('[data-action="new-daypart"], [data-action="new-special"]').count(), 0);
  await c.locator('[data-schedule] a').click();
  const sch = c.locator('dialog[data-sheet="schedule"]');
  await sch.waitFor();
  assert.equal(await live(sch.locator('.schedule-form')), 0, 'the day part is read-only');
  assert.equal(await sch.locator('[data-action="save-schedule"], [data-action="delete-schedule"], [data-action="add-window"]').count(), 0);
  await c.screenshot({ path: path.join(SHOTS, '17-counter-daypart.png') });
  await at('hours/parts/new');
  await stored(hash, '#/hours/parts', 'a new day part by address leads back to the list');
  assert.equal(await c.locator('dialog[data-sheet="schedule"]').count(), 0);

  assert.deepEqual(writes, [], 'the counter wrote no table: only the availability RPCs');
  assert.deepEqual(c.problems.filter((p) => !/Failed to load resource: the server responded with a status of (400|404)/.test(p)), []);
  await c.context().close();
});

test('changed somewhere else: a rule asks before it is saved over (both changes kept); an opening window changed meanwhile is not overwritten', { timeout: 300000 }, async () => {
  const morning = (await rows('upsell_rules')).find((r) => r.suggest_dish_id === ids.dishes.croissant);
  const rule = async () => { const [r] = await rows('upsell_rules', { id: `eq.${morning.id}` }); return [r.line_he, r.label]; };
  await go('rules/' + morning.id);
  const ed = page.locator('[data-screen="rule-editor"]');
  await ed.waitFor();
  await ed.locator('[data-field="rule-line-he"]').fill('קרואסון טרי ליד הקפה?');
  // meanwhile another device gives the rule a label
  await owner.api.update('upsell_rules', { id: `eq.${morning.id}` }, { label: 'בוקר' });
  await ed.locator('[data-action="save-rule"]').click();
  const dlg = page.locator(`dialog[data-conflict="upsell_rules:${morning.id}"]`);
  await dlg.waitFor();
  assert.deepEqual(await dlg.locator('tr[data-col]').evaluateAll((trs) => trs.map((tr) => tr.getAttribute('data-col'))), ['line_he'], 'only what the owner changed');
  assert.equal(await dlg.locator('tr[data-col="line_he"] [data-mine]').innerText(), 'קרואסון טרי ליד הקפה?');
  assert.match(await dlg.locator('[data-there]').innerText(), /תווית פנימית/);
  assert.deepEqual(await rule(), ['קרואסון חם ליד הקפה?', 'בוקר'], 'nothing written yet');
  await shot('18-rule-conflict');
  await dlg.locator('[data-action="keep-mine"]').click();
  await stored(rule, ['קרואסון טרי ליד הקפה?', 'בוקר'], 'the owner\'s line, and the label from the other device');
  await ed.locator('[data-action="save-rule"][disabled]').waitFor();
  assert.equal(await ed.locator('[data-field="rule-label"]').inputValue(), 'בוקר', 'the editor shows the rule as stored');

  // an opening window: its new times are written only while it still has the times this screen read
  await go('hours');
  const [w] = await rows('venue_hours', { weekday: 'eq.5', order: 'opens' });
  const closes = async () => (await rows('venue_hours', { id: `eq.${w.id}` }))[0].closes.slice(0, 5);
  await page.locator(`button[data-hours="${w.id}"]`).click();
  const edit = page.locator(`[data-hours-edit="${w.id}"]`);
  await edit.locator('[data-field="edit-to"]').fill('11:30');
  await owner.api.update('venue_hours', { id: `eq.${w.id}` }, { closes: '12:00' });
  await edit.locator('[data-action="save-hours"]').click();
  await edit.getByText('זה השתנה במסך או במכשיר אחר, ולכן מוצג עכשיו כפי שהוא שמור. נסו שוב.').waitFor();
  assert.equal(await edit.locator('[data-field="edit-to"]').inputValue(), '12:00', 'the times as stored now');
  assert.equal(await closes(), '12:00', 'not overwritten');
  await shot('19-hours-stale');
  await edit.locator('[data-field="edit-to"]').fill('11:30');
  await edit.locator('[data-action="save-hours"]').click();
  await edit.waitFor({ state: 'detached' });
  await stored(closes, '11:30', 'saved over the times as stored now');
  assert.deepEqual(problems(), []);
});

test('every "until" from the phone: the moment shown before the tap is the moment stored', { timeout: 300000 }, async () => {
  lang.value = 'he';
  const tea = ids.dishes.tea;
  const sheet = page.locator('dialog[data-sheet="off"]');
  const hm = (minutes) => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
  // the tea's newest override that counts
  const newest = async () => (await rows('availability_overrides', { target_id: `eq.${tea}`, restored_at: 'is.null', order: 'starts_at.desc' }))[0];
  await go('menu');
  for (const choice of ['h1', 'h2', 'next_opening', 'time', 'date', 'indefinite']) {
    await page.locator(`[data-off-open="${tea}"]`).click();
    await sheet.waitFor();
    const btn = sheet.locator(`[data-until="${choice}"]`);
    let tap = btn;
    if (choice === 'time' || choice === 'date') {
      await btn.click();
      const now = localParts(Date.now(), TZ);
      await sheet.locator(`[data-field="off-${choice}"]`).fill(choice === 'time' ? hm((now.minutes + 150) % 1440) : addDays(now.date, 3));
      tap = sheet.locator(`[data-action="off-${choice}"]`);
    }
    // "for an hour" moves with the minute: tap well inside one (the sheet reads its clock every second)
    if (choice === 'h1' || choice === 'h2') while (new Date().getUTCSeconds() < 3 || new Date().getUTCSeconds() > 50) await new Promise((r) => setTimeout(r, 500));
    await page.waitForTimeout(1100);
    const shownAt = await btn.getAttribute('data-back');
    const shownText = plain(await btn.locator('.fine').innerText());
    await tap.click();
    await sheet.waitFor({ state: 'detached' });
    await page.locator(`[data-off="${tea}"]`).waitFor();
    const o = await newest();
    assert.equal(o.until_kind, { h1: 'duration', h2: 'duration', next_opening: 'next_opening', time: 'time', date: 'date', indefinite: 'indefinite' }[choice]);
    assert.equal(shownAt, o.until_at ? new Date(o.until_at).toISOString() : '', `${choice}: the moment shown is the moment stored`);
    assert.equal(shownText, o.until_at ? 'חוזר: ' + plain(momentText(new Date(o.until_at), Date.now(), TZ)) : 'לא חוזר מעצמו', choice);
    if (choice === 'h2') await shot('20-until-h2');
    await owner.setAvailability('dish', tea, null);
    await page.locator(`[data-off="${tea}"]`).waitFor({ state: 'detached', timeout: 20000 }).catch(() => go('menu'));
  }
  assert.deepEqual(problems(), []);
});

test('two tabs: hours added on one are checked on the other before adding; rules reordered on one come back on the other with a notice', { timeout: 300000 }, async () => {
  const b = await page.context().newPage();
  await b.goto(e.webUrl + 'studio/#/hours');
  await b.locator('li.weekday[data-day="1"] [data-hours]').waitFor();
  // tab A: Saturday evening
  await go('hours');
  await page.locator('[data-action="add-hours"]').click();
  let add = page.locator('[data-hours-add]');
  await add.locator('[data-day="6"]').click();
  await add.locator('[data-field="add-from"]').fill('18:00');
  await add.locator('[data-field="add-to"]').fill('21:00');
  await add.locator('[data-action="save-new-hours"]').click();
  await page.locator('li.weekday[data-day="6"] [data-hours]').waitFor();
  // tab B has not seen it: an overlapping window is checked against the hours as stored now
  await b.locator('[data-action="add-hours"]').click();
  add = b.locator('[data-hours-add]');
  await add.locator('[data-day="6"]').click();
  await add.locator('[data-field="add-from"]').fill('20:00');
  await add.locator('[data-field="add-to"]').fill('23:00');
  await add.locator('[data-action="save-new-hours"]').click();
  await add.getByText('השעות האלה חופפות לשעות שכבר קבעתם באותו יום.').waitFor();
  await b.locator('li.weekday[data-day="6"] [data-hours]').waitFor();
  assert.deepEqual((await rows('venue_hours', { weekday: 'eq.6' })).map((h) => [h.opens, h.closes]), [['18:00:00', '21:00:00']], 'one Saturday window');
  await b.screenshot({ path: path.join(SHOTS, '21-two-tabs-hours.png') });
  // a Friday night window that meets Saturday's evening is said as running into the next day
  await add.locator('[data-day="6"]').click();
  await add.locator('[data-day="5"]').click();
  await add.locator('[data-field="add-from"]').fill('23:00');
  await add.locator('[data-field="add-to"]').fill('19:00');
  await add.locator('[data-action="save-new-hours"]').click();
  await add.getByText('השעות האלה נמשכות אחרי חצות ונפגשות עם השעות של היום שאחרי.').waitFor();
  await owner.api.remove('venue_hours', { venue_id: `eq.${owner.venueId}`, weekday: 'eq.6' });

  // rules: both tabs arranging; A moves the first down, then B (which has not seen it) does the same
  for (const p of [page, b]) { await p.goto(e.webUrl + 'studio/#/rules'); await p.locator('[data-summary]').nth(1).waitFor(); await p.locator('[data-tool="arrange-rules"]').click(); }
  const order = async () => (await rows('upsell_rules', { order: 'priority.desc,id.asc' })).map((r) => r.id);
  const before = await order();
  await page.locator('[data-move="down"]').first().click();
  await stored(order, [before[1], before[0]], 'tab A\'s order stored');
  await b.locator('[data-move="down"]').first().click();
  await b.getByText('זה השתנה במסך או במכשיר אחר, ולכן מוצג עכשיו כפי שהוא שמור. נסו שוב.').first().waitFor();
  assert.deepEqual(await order(), [before[1], before[0]], 'tab B wrote nothing');
  const shownIds = () => b.locator('a[data-rule]').evaluateAll((xs) => xs.map((x) => x.getAttribute('data-rule')));
  await stored(shownIds, [before[1], before[0]], 'tab B shows the order as stored');
  await b.screenshot({ path: path.join(SHOTS, '23-two-tabs-rules.png') });
  await b.close();
  await page.locator('[data-tool="arrange-rules"]').click();
  assert.deepEqual(problems(), []);
});

test('lost answers: hours tried again with other times say what was stored; a new rule tried again with another line stores the line', { timeout: 300000 }, async () => {
  // hours: the insert lands, its answer never comes back; the owner changes the times and tries again
  await go('hours');
  let drop = true;
  const loseOnce = async (r) => { if (drop && r.request().method() === 'POST') { drop = false; await r.fetch(); return r.abort('connectionreset'); } return r.continue(); };
  const hoursRoute = (u) => u.pathname.endsWith('/rest/v1/venue_hours');
  await page.route(hoursRoute, loseOnce);
  await page.locator('[data-action="add-hours"]').click();
  const add = page.locator('[data-hours-add]');
  await add.locator('[data-day="6"]').click();
  await add.locator('[data-field="add-from"]').fill('18:00');
  await add.locator('[data-field="add-to"]').fill('20:00');
  await add.locator('[data-action="save-new-hours"]').click();
  await add.locator('.ferr').waitFor();
  await add.locator('[data-field="add-from"]').fill('19:00');
  await add.locator('[data-field="add-to"]').fill('21:00');
  await add.locator('[data-action="save-new-hours"]').click();
  await add.getByText('הניסיון הקודם כבר נשמר (התשובה עליו לא הגיעה), עם מה שהיה בו אז. כך הוא מוצג עכשיו.').waitFor();
  assert.equal(plain(await page.locator('li.weekday[data-day="6"] [data-hours]').innerText()), '18:00–20:00', 'the week shows what was stored');
  assert.deepEqual((await rows('venue_hours', { weekday: 'eq.6' })).map((h) => [h.opens, h.closes]), [['18:00:00', '20:00:00']], 'stored once, as first sent');
  await shot('22-lost-answer-hours');
  await page.unroute(hoursRoute);
  await owner.api.remove('venue_hours', { venue_id: `eq.${owner.venueId}`, weekday: 'eq.6' });

  // a new rule: the same, then the owner changes the line and creates again: one rule, with the new line
  await go('rules/new');
  const ed = page.locator('[data-screen="rule-editor"]');
  await ed.waitFor();
  await ed.getByRole('button', { name: 'פתיחת מנה', exact: true }).click();
  await pick('scope', ['תה']);
  await ed.locator('[data-field="rule-suggest-dish"]').selectOption({ label: 'מאפין' });
  await ed.locator('[data-field="rule-line-he"]').fill('שורה ראשונה');
  drop = true;
  const rulesRoute = (u) => u.pathname.endsWith('/rest/v1/upsell_rules');
  await page.route(rulesRoute, loseOnce);
  await ed.locator('[data-action="save-rule"]').click();
  await ed.locator('[data-error]').waitFor();
  await ed.locator('[data-field="rule-line-he"]').fill('שורה שנייה');
  await ed.locator('[data-action="save-rule"]').click();
  await page.locator('[data-screen="rule-editor"]:not([data-rule="new"])').waitFor();
  await stored(async () => (await rows('upsell_rules', { suggest_dish_id: `eq.${ids.dishes.muffin}` })).map((r) => r.line_he), ['שורה שנייה'], 'one rule, with the line as the owner left it');
  await stored(() => page.locator('[data-field="rule-line-he"]').inputValue(), 'שורה שנייה', 'the editor shows it');
  await page.unroute(rulesRoute);
  await owner.api.remove('upsell_rules', { suggest_dish_id: `eq.${ids.dishes.muffin}` });
  // the retry's insert meets the stored row (409, the duplicate the app reads as "stored earlier")
  assert.deepEqual(problems().filter((x) => !/ERR_CONNECTION_RESET|net::|Failed to fetch|status of 409/.test(x)), []);
  page.problems.length = 0;                                     // the lost answers were this test's own
});

test('open now on last night\'s hours, on a closed date: the card never says "open now" beside "closed today"', { timeout: 120000 }, async (t) => {
  const now = localParts(Date.now(), TZ);
  if (now.minutes > 21 * 60) { t.skip('needs two hours before midnight on the venue\'s clock'); return; }
  // yesterday's window runs past midnight until two hours from now; today is a closed date
  await owner.api.remove('venue_hours', { venue_id: `eq.${owner.venueId}` });
  const until = String(Math.floor(now.minutes / 60) + 2).padStart(2, '0') + ':00';
  await owner.insert('venue_hours', [{ weekday: (now.weekday + 6) % 7, opens: '23:00', closes: until }]);
  await owner.insert('venue_closures', [{ from_date: now.date, to_date: now.date, note_he: 'חג', note_en: 'Holiday' }]);
  await go('hours');
  const card = page.locator('[data-open-now]');
  await page.locator('[data-open-now="open"]').waitFor();
  assert.equal(plain(await card.locator('[data-closed-today]').innerText()), 'פתוח לפי השעות של אמש, ואחר כך סגור לשאר היום: חג');
  assert.doesNotMatch(await card.innerText(), /היום סגור/);
  const live = (await asAnon(e.stack).rpc('public_menu', { p_slug: SLUG })).live;
  assert.equal(live.open, true, 'as the guest\'s phone has it');
  await shot('24-open-on-last-nights-hours');

  // closed for the next three weeks: "until the next opening" has none within two weeks, and asks for a date instead
  await owner.insert('venue_closures', [{ from_date: addDays(now.date, 1), to_date: addDays(now.date, 21), note_he: 'שיפוץ', note_en: 'Works' }]);
  await go('menu');
  await go('hours');                                               // the hours screen reads them again when it opens
  await page.locator('[data-closure]', { hasText: 'שיפוץ' }).waitFor();
  await go('menu/a/dish/' + ids.dishes.tea);
  const sheet = page.locator('dialog[data-sheet="off"]');
  await sheet.locator('[data-until="next_opening"][data-no-opening]').click();
  assert.equal(plain(await sheet.locator('[data-until="next_opening"] .fine').innerText()), 'אין פתיחה בשבועיים הקרובים: בחרו תאריך');
  await sheet.locator('[data-field="off-date"]').waitFor();
  await shot('25-no-opening-within-two-weeks');
  await sheet.locator('.sheet-close, [data-action="close"]').first().click().catch(() => page.keyboard.press('Escape'));
  assert.deepEqual(problems(), []);
});
