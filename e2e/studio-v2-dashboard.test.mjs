// The owner app v2's dashboard lane (apps/studio/src/v2: Home, the activity log, get help, the export, approval pushed
// live) on a 390 × 844 phone against the simulator's stack, invented data only (Bistro Sim, a demo venue, so its
// dashboard counts its demo traffic as the contract says). Home says "no visits yet"; guest bots visit, the rollup job
// runs, and without a reload the numbers on Home and on the rules list (with the period they count) equal the bots'
// ledger key by key. Timed, each under its budget: a dish goes off for two hours from Home in two taps and comes back
// with one; everything taken off today comes back in two; today closes in two; a special in one sheet (H53). Escape
// gives the focus back to what opened a sheet. A dish without a price is a nudge that leads to its fix. A Halom bot acts
// for the owner with a reason, reads and exports the menu, and the activity log shows each as Halom, with the reason
// and the dish's name. "Get help" opens a case that the back office's ops_venues shows; Halom's answer is a nudge. The
// owner's switch for Halom acting is its own: off in one tap, logged, and Halom is refused; a manager sees it disabled.
// The export downloads exactly export_menu's reply, and a CSV of the same dishes, every text quoted. A first publish
// waiting for Halom flips to live by itself when Halom approves (polling), and the log says "approved" once.
// Needs the built site (bash tools/build-site.sh). Screenshots: e2e/.out/studio-v2-dashboard/.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { localParts } from '@mana/contracts';
import { asAnon, createUser, HalomBot, OwnerBot, runRandom } from '@mana/sim';
import { OUT, startE2E } from './helpers.mjs';

const SHOTS = path.join(OUT, 'studio-v2-dashboard');
const PASSWORD = 'sim-owner-pass-1';
const TZ = 'Asia/Jerusalem';
let e, owner, ids, slug, page, halom;

const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true });
// a refused read (400, 404) is the browser's own console line; the lost answer is one the help test makes on purpose
const problems = () => page.problems.filter((p) => !/Failed to load resource: (the server responded with a status of (400|404)|net::ERR_INTERNET_DISCONNECTED)/.test(p));
const go = async (hash) => { await page.goto(e.webUrl + 'studio/#/' + hash); };
const live = async () => (await asAnon(e.stack).rpc('public_menu', { p_slug: slug })).live;
/** The numbers the glance card shows, by key (each carries its raw value). */
const shown = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-glance] [data-n]')].map((el) => [el.dataset.n, Number(el.dataset.v)])));
const ints = (s) => (s.match(/\d+/g) ?? []).map(Number);

/** RFC 4180, as a spreadsheet reads it. */
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  return rows;
}

before(async () => {
  e = await startE2E({ seed: 'bistro-sim' });
  if (!e.hasSite) throw new Error('the site is not built: run bash tools/build-site.sh first');
  fs.mkdirSync(SHOTS, { recursive: true });
  ({ owner, ids, slug } = e.venue);
  halom = await HalomBot.firstAdmin(e.stack, e.stack, { email: 'halom-dashboard@sim.local' });
  page = await e.page(e.webUrl + 'studio/');
  await page.getByLabel('אימייל').fill(`owner.${slug}@example.invalid`);
  await page.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'המשך' }).click();
  await page.locator('[data-screen="home"]').waitFor();
}, { timeout: 240000 });
after(async () => { await e?.stop(); });

test('at a glance: "no visits yet"; then guest bots visit and, without a reload, every number is the ledger\'s', { timeout: 300000 }, async () => {
  // the place has published and Halom approved it: it opens on Home
  assert.equal(await page.locator('[data-standing-line="live"]').count(), 1);
  const glance = page.locator('[data-glance]');
  await glance.locator('[data-dash-empty]').waitFor();
  assert.match(await glance.innerText(), /עוד אין ביקורים/);
  assert.equal(await glance.locator('[data-demo]').count(), 1, 'a demo place says so');
  await shot('01-home-no-visits');

  const crowd = await runRandom(e.stack, { slug, guests: 14, minutes: 20, seed: 7 });
  assert.deepEqual(crowd.violations, []);
  assert.equal(crowd.results.uncertain, 0);
  const L = crowd.ledger;
  assert.ok(L.n('menu_opened') >= 14);
  await e.stack.buildRollups();

  // live by polling (the local stack has no Realtime): the numbers arrive on their own
  await glance.locator('[data-n="menuOpens"]').waitFor({ timeout: 45000 });
  const opensBy = (s) => ({ qr: s.qr, link: s.link, he: s.he, en: s.en });
  const totals = (s) => ({ menuOpens: s.menuOpens, dishViews: s.dishViews, addonsChosen: s.addonsChosen, basketAdds: s.basketAdds,
    suggestionsShown: s.suggestionsShown, suggestionsAccepted: s.suggestionsAccepted, suggestionsDismissed: s.suggestionsDismissed });

  // today, when every event fell on the venue's today (a run that crosses midnight is checked on 7 days only)
  const today = localParts(Date.now(), TZ).date;
  const allToday = crowd.bots.every((b) => b.sent.every((ev) => localParts(Date.parse(ev.at), TZ).date === today));
  if (allToday) {
    const s = await shown();
    assert.deepEqual(totals(s), L.totals(), 'today: the totals');
    assert.deepEqual(opensBy(s), L.opensBy(), 'today: opens by QR or link, Hebrew or English');
    const bars = await page.locator('[data-chart="minutes"] [data-bar]').evaluateAll((els) => els.map((x) => Number(x.dataset.v)));
    assert.equal(bars.length, 60);
    assert.equal(bars.reduce((a, b) => a + b, 0), L.n('menu_opened'), 'the last hour, minute by minute, sums to the opens');
  }
  await shot('02-home-today');

  await glance.getByRole('button', { name: '7 ימים', exact: true }).click();
  await page.locator('[data-glance][data-range="7d"][data-state="ready"]').waitFor();
  const s = await shown();
  assert.deepEqual(totals(s), L.totals(), '7 days: the totals');
  assert.deepEqual(opensBy(s), L.opensBy(), '7 days: opens by');
  const days = await page.locator('[data-chart="days"] [data-bar]').evaluateAll((els) => els.map((x) => Number(x.dataset.v)));
  assert.equal(days.length, 7);
  assert.equal(days.reduce((a, b) => a + b, 0), L.n('menu_opened'), 'the days sum to the opens');
  // top dishes: by views, then adds, then id, ten at most, each with the ledger's numbers
  const want = [...new Set([...L.counts.get('dish_viewed')?.keys() ?? [], ...L.counts.get('basket_added')?.keys() ?? []].filter((k) => k.startsWith('dish:')).map((k) => k.slice(5)))]
    .map((id) => ({ id, ...L.dish(id) })).sort((a, b) => b.views - a.views || b.adds - a.adds || (a.id < b.id ? -1 : 1)).slice(0, 10);
  const top = await page.locator('[data-top]').evaluateAll((els) => els.map((x) => ({ id: x.dataset.top, views: Number(x.dataset.views), adds: Number(x.dataset.adds) })));
  assert.deepEqual(top, want);
  // every value is in the table under the chart
  await page.locator('[data-chart-table] summary').click();
  assert.equal(await page.locator('[data-chart-table] tbody tr').count(), 7);
  await page.locator('[data-glance]').scrollIntoViewIfNeeded();
  await shot('03-home-7-days');
  // in English too, the QR share stays with its label, in the label's type (L9)
  const swapLang = async () => {
    await page.locator('[data-action="account"]').click();
    await page.locator('[data-menu="language"]').click();
    if (await page.locator('dialog[data-sheet="account"]').count()) { await page.keyboard.press('Escape'); await page.locator('dialog[data-sheet="account"]').waitFor({ state: 'detached' }); }
  };
  await swapLang();
  await page.getByText('From the QR code').waitFor();
  const share = await page.locator('[data-share]').evaluate((el) => {
    const label = el.closest('.glance-lbl'), cs = (x) => getComputedStyle(x);
    return { inLabel: !!label, same: !!label && cs(el).fontSize === cs(label).fontSize && cs(el).fontWeight === cs(label).fontWeight, text: label?.textContent ?? '' };
  });
  assert.ok(share.inLabel && share.same, JSON.stringify(share));
  assert.match(share.text, /^From the QR code · \d+%$/);
  await shot('03b-home-7-days-en');
  await swapLang();
  await page.getByText('מקוד QR').first().waitFor();

  // the rules list: each suggestion's shown, accepted and dismissed, from the same dashboard
  await go('rules');
  await page.locator('[data-rule-numbers]').first().waitFor();
  // the period they count is said once, above the list: Home's 7 days (L3)
  assert.equal(await page.locator('[data-rule-period]').getAttribute('data-rule-period'), '7d');
  assert.equal(await page.locator('[data-rule-period]').innerText(), 'המספרים ליד כל הצעה: 7 הימים האחרונים.');
  for (const id of Object.values(ids.rules)) {
    const text = await page.locator(`[data-rule="${id}"] [data-rule-numbers]`).innerText();
    const [shownN, accepted, dismissed] = ints(text);
    assert.deepEqual({ shown: shownN, accepted, dismissed }, L.rule(id), 'rule ' + id);
  }
  await shot('04-rules-numbers');
  await go('home');
  await page.locator('[data-glance][data-state="ready"]').waitFor();
  assert.deepEqual(problems(), []);
});

/**
 * F08's quick actions, timed: the budget for each one's scripted taps on the phone, from the first tap on Home to the
 * screen saying it is done (the network and the database's answers included). The special (typing included) is H53's
 * own test below, with its own budget.
 */
const QUICK_BUDGET_MS = 5_000;
const quickTimes = {};
async function timed(name, run) {
  const t0 = performance.now();
  await run();
  const ms = Math.round(performance.now() - t0);
  quickTimes[name] = ms;
  assert.ok(ms < QUICK_BUDGET_MS, `${name}: ${ms} ms (budget ${QUICK_BUDGET_MS} ms)`);
}

test('from Home, timed: a dish off for two hours in two taps, back in one; everything taken off today back in two; today closed in two; a special', { timeout: 300000 }, async (t) => {
  await go('home');
  const croissant = ids.dishes.croissant, cookie = ids.dishes.cookie;
  const sheet = page.locator('dialog[data-sheet="off2h"]');
  // Escape closes a sheet and the focus goes back to the button that opened it (L6)
  await page.locator('[data-act="off2h"]').click();
  await sheet.waitFor();
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.activeElement?.getAttribute('data-act') === 'off2h');

  const before = Date.now();
  const row = page.locator(`[data-off-row="${croissant}"]`);
  await timed('off for 2 hours', async () => {
    await page.locator('[data-act="off2h"]').click();                            // tap 1
    await sheet.waitFor();
    await sheet.locator(`[data-off2h="${croissant}"]`).click();                   // tap 2
    await row.waitFor();
  });
  await sheet.waitFor({ state: 'detached' });
  assert.match(await row.innerText(), /קרואסון[\s\S]*לא זמין עד \d\d:\d\d/);
  const off = (await live()).off.find((o) => o.id === croissant);
  assert.ok(off?.until, 'guests see it off');
  assert.ok(Date.parse(off.until) >= before + 2 * 3600_000 && Date.parse(off.until) <= Date.now() + 2 * 3600_000 + 60_000, off.until);
  await shot('06-home-off-now');
  await timed('bring back', async () => {
    await page.locator(`[data-bring-back="${croissant}"]`).click();               // one tap back
    await row.waitFor({ state: 'detached' });
  });
  assert.deepEqual((await live()).off, []);
  await page.locator('[data-act="off2h"]').click();
  await sheet.waitFor();
  await shot('05-off-2h-sheet');
  await page.keyboard.press('Escape');

  // two dishes off, then both back with "bring back today's" and its confirmation
  for (const id of [croissant, cookie]) {
    await page.locator('[data-act="off2h"]').click();
    await page.locator(`dialog[data-sheet="off2h"] [data-off2h="${id}"]`).click();
    await page.locator(`[data-off-row="${id}"]`).waitFor();
  }
  await timed('bring back today\'s', async () => {
    await page.locator('[data-act="restore-today"][data-n="2"]').click();         // tap 1
    await page.getByRole('dialog').getByRole('button', { name: 'להחזיר הכול' }).click();   // tap 2
    await page.locator('[data-off-list]').waitFor({ state: 'detached' });
  });
  assert.deepEqual((await live()).off, []);

  // a special: one tap opens its sheet (the timed flow is its own test below)
  await page.locator('[data-act="special"]').click();
  const sp = page.locator('dialog[data-sheet="special"]');
  await sp.waitFor();
  assert.equal(await sp.locator('[data-days="special"] [aria-pressed="true"]').count(), 1, 'today\'s weekday, already chosen');
  await shot('05b-special-sheet');
  await sp.getByRole('button', { name: 'סגירה' }).click();

  // today's hours: closed today in two taps, guests see it at once; then open again
  await go('home');
  await page.locator('[data-glance]').waitFor();
  const hrs = page.locator('dialog[data-sheet="today-hours"]');
  await timed('close today', async () => {
    await page.locator('[data-act="hours"]').click();                             // tap 1
    await hrs.locator('[data-action="close-today"]').click();                     // tap 2
    await hrs.locator('[data-action="reopen-today"]').waitFor();
  });
  assert.equal((await live()).open, false, 'closed today');
  await hrs.locator('[data-action="reopen-today"]').click();
  await hrs.locator('[data-action="close-today"]').waitFor();
  assert.equal((await live()).open, true, 'open again');
  const times = Object.entries(quickTimes).map(([k, ms]) => `${k}: ${ms} ms`).join(', ');
  t.diagnostic(`F08 quick actions on a 390x844 phone (budget ${QUICK_BUDGET_MS / 1000} s each): ${times}`);
  fs.writeFileSync(path.join(SHOTS, 'quick-actions-timing.txt'), `budget ${QUICK_BUDGET_MS} ms each\n` + Object.entries(quickTimes).map(([k, ms]) => `${k}: ${ms} ms\n`).join(''));

  await hrs.locator('[data-today-hours] li.weekday').waitFor();
  // the first answer is lost on the way back; the same tap again stores one closed date, not two (its id is made here)
  let armed = true;
  const closures = (u) => u.pathname.endsWith('/rest/v1/venue_closures');
  await page.route(closures, async (r) => { if (armed && r.request().method() === 'POST') { armed = false; await r.fetch(); return r.abort('internetdisconnected'); } return r.continue(); });
  await hrs.locator('[data-action="close-today"]').click();
  await hrs.locator('.note-error').waitFor();
  await hrs.locator('[data-action="close-today"]').click();
  await hrs.locator('[data-action="reopen-today"]').waitFor();
  await page.unroute(closures);
  // the retry's insert meets the stored row (409) and reads it back: the one console line this step causes on purpose
  page.problems = page.problems.filter((p) => !/status of 409 \(Conflict\)/.test(p));
  const today = localParts(Date.now(), TZ).date;
  assert.equal((await owner.api.select('venue_closures', { select: 'id', venue_id: `eq.${owner.venueId}`, from_date: `eq.${today}` })).length, 1, 'one closed date');
  assert.equal((await live()).open, false, 'closed today');
  await shot('07-today-hours-closed');
  await hrs.locator('[data-action="reopen-today"]').click();
  await hrs.locator('[data-action="close-today"]').waitFor();
  assert.equal((await live()).open, true, 'open again');
  await hrs.getByRole('button', { name: 'סגירה' }).click();
  assert.deepEqual(problems(), []);
});

/** Hopa H53, timed: the budget for the scripted taps and typing of the whole flow on the phone, from Home's quick action
 * to "published" (the network and the database's answers included; nothing is skipped or prefilled by the test). */
const H53_BUDGET_MS = 60_000;

test('H53, timed: a Wednesday special in one sheet (name, price, section, day, hours), saved and published, within the budget', { timeout: 300000 }, async (t) => {
  await go('home');
  await page.locator('[data-glance]').waitFor();
  const t0 = performance.now();
  await page.locator('[data-act="special"]').click();
  const sp = page.locator('dialog[data-sheet="special"]');
  await sp.locator('[data-field="special-name-he"]').fill('ספיישל רביעי');
  await sp.locator('[data-field="special-name-en"]').fill('Wednesday special');
  await sp.locator('[data-field="special-price"]').fill('58');
  await sp.locator('[data-field="special-section"]').selectOption(ids.sections.mains);
  // Wednesday only: today's weekday comes chosen; tap it off unless it is Wednesday, then tap Wednesday on
  const days = sp.locator('[data-days="special"]');
  for (const d of await days.locator('[data-day][aria-pressed="true"]').evaluateAll((els) => els.map((x) => x.dataset.day))) if (d !== '3') await days.locator(`[data-day="${d}"]`).click();
  if (await days.locator('[data-day="3"]').getAttribute('aria-pressed') !== 'true') await days.locator('[data-day="3"]').click();
  await sp.locator('[data-field="special-from"]').fill('12:00');
  await sp.locator('[data-field="special-to"]').fill('15:00');
  await sp.locator('[data-action="special-publish"]').click();
  const doneCard = sp.locator('[data-special-done="approved"]');
  await doneCard.waitFor();
  const ms = Math.round(performance.now() - t0);
  t.diagnostic(`H53 special flow: ${(ms / 1000).toFixed(1)} s on a 390x844 phone (budget ${H53_BUDGET_MS / 1000} s)`);
  fs.writeFileSync(path.join(SHOTS, 'h53-timing.txt'), `H53 special flow: ${ms} ms (budget ${H53_BUDGET_MS} ms)\n`);
  assert.ok(ms < H53_BUDGET_MS, `${ms} ms`);
  assert.match(await doneCard.innerText(), /פורסם/);
  await shot('14-special-published');

  // stored: the dish, linked to a schedule of kind special; what guests get carries both
  const dishId = await doneCard.getAttribute('data-dish');
  const [dish] = await owner.api.select('dishes', { select: '*', id: `eq.${dishId}` });
  const [sched] = await owner.api.select('schedules', { select: '*', id: `eq.${dish.schedule_id}` });
  assert.deepEqual([dish.name_he, dish.name_en, dish.price, dish.section_id], ['ספיישל רביעי', 'Wednesday special', 5800, ids.sections.mains]);
  assert.deepEqual([sched.kind, sched.name_en, sched.windows], ['special', 'Wednesday special', [{ days: [3], from: '12:00', to: '15:00' }]]);
  const m = await asAnon(e.stack).rpc('public_menu', { p_slug: slug });
  const guest = m.snapshot.sections.flatMap((s) => s.dishes).find((x) => x.id === dishId);
  assert.ok(guest, 'published');
  assert.deepEqual([guest.scheduleId, guest.price.amount], [sched.id, 5800]);
  assert.deepEqual(m.snapshot.schedules.find((s) => s.id === sched.id), { id: sched.id, kind: 'special', name: { he: 'ספיישל רביעי', en: 'Wednesday special' },
    windows: [{ days: [3], from: '12:00', to: '15:00' }], validFrom: null, validTo: null });
  await sp.locator('[data-action="special-close"]').click();
  assert.deepEqual(problems(), []);
});

test('a dish without a price is a nudge; its tap opens the dish, a price fixes it, and the nudge is gone', { timeout: 300000 }, async () => {
  const [soup] = await owner.insert('dishes', [{ section_id: ids.sections.mains, position: 9, name_he: 'מרק היום', name_en: 'Soup of the day', price: null }]);
  await go('home');
  const nudge = page.locator('[data-nudge="dish_no_price"]');
  await nudge.waitFor({ timeout: 45000 });                                        // the next poll brings it
  assert.match(await nudge.innerText(), /למנה אחת אין מחיר/);
  assert.equal(await nudge.locator('a').getAttribute('data-href'), 'menu/d/' + soup.id);
  await shot('08-nudge-no-price');
  await nudge.locator('a').click();
  const dish = page.locator('dialog[data-sheet="dish"]');
  await dish.waitFor();
  assert.equal(await page.evaluate(() => location.hash), '#/menu/d/' + soup.id);
  await dish.locator('.money input').fill('32');
  await page.locator('[data-save="saved"]').waitFor();
  const stored = (await owner.api.select('dishes', { select: 'price', id: `eq.${soup.id}` }))[0].price;
  assert.equal(stored, 3200);
  await go('home');
  await page.locator('[data-glance][data-state="ready"]').waitFor();
  await nudge.waitFor({ state: 'detached', timeout: 45000 });
  assert.deepEqual(problems(), []);
});

test('Halom acts for the owner with a reason, reads and exports the menu: the log shows each as Halom, with the reason', { timeout: 300000 }, async () => {
  const reason = 'e2e: the owner phoned, the cookies ran out';
  const r = await halom.actForOwner(owner.venueId, reason, 'availability.set', { targetKind: 'dish', targetId: ids.dishes.cookie, until: { kind: 'duration', minutes: 60 } });
  assert.equal(r.ok, true, JSON.stringify(r));
  const read = await halom.revision(owner.venueId);                               // ops_revision: Halom reads the stored menu
  assert.ok(read.revision.number >= 1, JSON.stringify(read.revision));
  assert.equal((await halom.api.rpc('export_menu', { p_venue: owner.venueId })).kind, 'mana.menu_export');

  // Home: what is off now carries Halom's mark
  await go('home');
  const off = page.locator(`[data-off-row="${ids.dishes.cookie}"]`);
  await off.waitFor({ timeout: 30000 });
  assert.equal(await off.locator('.badge-halom').innerText(), 'חלום');

  await go('activity');
  const loaded = (query) => page.locator(`[data-screen="activity"][data-state="ready"][data-query="${query}"]`).waitFor();
  await loaded('|');
  const entry = (action) => page.locator(`[data-activity][data-action="${action}"]`).first();
  for (const action of ['menu.export', 'menu.read', 'support.act_for_owner', 'availability_overrides.insert']) {
    assert.equal(await entry(action).getAttribute('data-who'), 'halom', action);
    assert.equal(await entry(action).locator('[data-halom]').innerText(), 'חלום', action);
  }
  assert.equal(await entry('menu.export').locator('.actrow-what').innerText(), 'ייצוא התפריט');
  assert.equal(await entry('menu.read').locator('.actrow-what').innerText(), 'קריאה בתפריט, גרסה ' + read.revision.number);
  assert.equal(await entry('support.act_for_owner').locator('[data-reason]').innerText(), 'הסיבה: ' + reason);
  assert.equal(await entry('availability_overrides.insert').locator('[data-reason]').innerText(), 'הסיבה: ' + reason);
  // Halom's entries say which dish (QA-M3): the act names what it acted on, the override its target
  assert.equal(await entry('support.act_for_owner').locator('.actrow-what').innerText(), 'פעולה בשבילכם (זמינות): עוגייה');
  assert.match(await entry('availability_overrides.insert').innerText(), /הורדה מהתפריט: עוגייה[\s\S]*עד \d\d:\d\d/);
  // no staff member is ever named: the log's text holds no e-mail address
  assert.doesNotMatch(await page.locator('.actlog').innerText(), /@/);
  await shot('09-activity-halom');

  // filters: only Halom, then only "Halom, for you"
  await page.locator('[data-field="activity-actor"]').selectOption('staff');
  await loaded('staff|');
  const whos = await page.locator('[data-activity]').evaluateAll((els) => els.map((x) => x.dataset.who));
  assert.ok(whos.length >= 4 && whos.every((w) => w === 'halom'), JSON.stringify(whos));
  await page.locator('[data-field="activity-via"]').selectOption('act_for_owner');
  await loaded('staff|act_for_owner');
  const afo = await page.locator('[data-activity]').evaluateAll((els) => els.map((x) => x.dataset.action));
  assert.ok(afo.includes('support.act_for_owner') && afo.includes('availability_overrides.insert') && !afo.includes('menu.read'), JSON.stringify(afo));

  // every entry, a page at a time, newest first, none twice
  await page.locator('[data-field="activity-actor"]').selectOption('');
  await page.locator('[data-field="activity-via"]').selectOption('');
  await loaded('|');
  while (await page.locator('[data-action="activity-more"]').count()) {
    const n0 = await page.locator('[data-activity]').count();
    await page.locator('[data-action="activity-more"]').click();
    await page.waitForFunction((n) => document.querySelectorAll('[data-activity]').length > n, n0);
  }
  await page.locator('[data-activity-end]').waitFor();
  const idsShown = await page.locator('[data-activity]').evaluateAll((els) => els.map((x) => Number(x.dataset.activity)));
  const all = await owner.activityPage({ limit: 100 });
  assert.ok(idsShown.length > 30, 'more than one page: ' + idsShown.length);
  assert.deepEqual(idsShown, [...idsShown].sort((a, b) => b - a), 'newest first');
  assert.equal(new Set(idsShown).size, idsShown.length, 'none twice');
  // the RPC's own order, without the approval's second line (the update of only approved_at beside venue.approve: L2)
  const approvalStamp = (x) => x.action === 'venues.update' && (x.detail.columns ?? []).length > 0 && x.detail.columns.every((c) => c === 'approved_at' || c === 'approved_by');
  const readable = all.entries.filter((x) => !(approvalStamp(x) && all.entries.some((y) => y.action === 'venue.approve' && Math.abs(Date.parse(y.at) - Date.parse(x.at)) <= 120_000)));
  assert.equal(all.entries.length - readable.length, 1, 'the seed\'s one approval, said once');
  assert.deepEqual(idsShown.slice(0, readable.length), readable.map((x) => x.id), 'the RPC\'s own order');

  // the owner brings the cookies back from Home: Home's recent changes and the log name the dish, each line by "you"
  await go('home');
  await page.locator(`[data-bring-back="${ids.dishes.cookie}"]`).click();
  await off.waitFor({ state: 'detached' });
  const recent = page.locator('[data-recent] [data-activity][data-action="availability_overrides.update"]').first();
  await recent.waitFor({ timeout: 30000 });
  assert.equal(await recent.locator('.actrow-what').innerText(), 'החזרה לתפריט: עוגייה');
  assert.equal(await recent.getAttribute('data-who'), 'you');
  // every availability and schedule line the log holds names its target
  await go('activity');
  await loaded('|');
  const lines = await page.locator('[data-activity]').evaluateAll((els) => els
    .filter((x) => /^(availability_overrides|schedules)\./.test(x.dataset.action ?? ''))
    .map((x) => x.querySelector('.actrow-what')?.textContent ?? ''));
  assert.ok(lines.length >= 4, JSON.stringify(lines));
  for (const w of lines) assert.doesNotMatch(w, /: (מנה|קטגוריה|בחירה בתוספות|פריט)$|^(החזרה לתפריט|הוספת חלק יום או ספיישל|עדכון חלק יום או ספיישל)$/, w);
  assert.deepEqual(problems(), []);
});

test('get help: a case the back office sees (ops_venues); Halom\'s answer is a nudge that leads back to it', { timeout: 300000 }, async () => {
  await go('home');
  await page.locator('[data-action="help"]').click();                              // the shell's button
  const help = page.locator('[data-screen="help"]');
  await help.waitFor();
  await help.locator('[data-cases-none]').waitFor();
  await help.locator('[data-topic="photos"]').click();
  await help.locator('[data-field="help-subject"]').fill('e2e: how do I add a photo to a dish?');
  await help.locator('[data-field="help-body"]').fill('Synthetic question from the browser test');
  assert.equal(await help.getByRole('switch', { name: 'חלום יכולים לבצע שינויים בשבילכם' }).getAttribute('aria-checked'), 'true');
  await shot('10-help-form');
  await help.locator('[data-action="send-help"]').click();
  const sent = help.locator('[data-case-sent]');
  await sent.waitFor();
  const caseId = await sent.getAttribute('data-case-sent');
  assert.match(await sent.innerText(), /מה קורה עכשיו/);
  await help.locator(`[data-case="${caseId}"][data-status="open"]`).waitFor();
  await shot('11-help-sent');

  const list = await halom.venues({ warning: 'case_open' });
  const row = list.venues.find((v) => v.id === owner.venueId);
  assert.ok(row && row.openCases === 1 && row.warnings.includes('case_open'), JSON.stringify(row));
  const detail = await halom.venue(owner.venueId);
  const c = detail.cases.find((x) => x.id === caseId);
  assert.deepEqual([c.topic, c.status, c.openedBy, c.subject], ['photos', 'open', 'owner', 'e2e: how do I add a photo to a dish?']);

  const answered = await halom.updateCase(caseId, { status: 'waiting_owner', reason: 'e2e: answered by phone' });
  assert.equal(answered.ok, true);
  await go('home');
  const nudge = page.locator('[data-nudge="case_waiting_owner"]');
  await nudge.waitFor({ timeout: 45000 });
  await nudge.locator('a').click();
  await help.locator(`[data-case="${caseId}"][data-status="waiting_owner"]`).waitFor();
  assert.match(await help.locator(`[data-case="${caseId}"]`).innerText(), /מחכה לכם/);

  // lost answers (SEC-N6): each request carries its own id, made here; the database stores the first try (we lose
  // its answer on the way back) and answers a resend of the same id with that stored request
  const match = (u) => u.pathname.endsWith('/rest/v1/rpc/open_case');
  const sentIds = [];
  let lose = null;                                                                 // how the next answer is lost
  await page.route(match, async (r) => {
    sentIds.push(r.request().postDataJSON().p_id);
    const how = lose; lose = null;
    if (how === 'network') { await r.fetch(); return r.abort('internetdisconnected'); }
    if (how === 'server') { await r.fetch(); return r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"e2e: the answer is lost"}' }); }
    return r.continue();
  });
  const casesSaying = async (subject) => owner.api.select('support_cases', { select: 'id,subject', venue_id: `eq.${owner.venueId}`, subject: `eq.${subject}` });
  const ask = async (subject) => {
    if (await help.locator('[data-case-sent]').count()) await help.getByRole('button', { name: 'פנייה נוספת' }).click();
    await help.locator('[data-topic="menu"]').click();
    await help.locator('[data-field="help-subject"]').fill(subject);
  };
  const sentCard = help.locator('[data-case-sent]');

  // 1. the connection drops on the way back: the screen finds its own request by its id; one request
  await ask('e2e: a request whose answer is lost');
  lose = 'network';
  await help.locator('[data-action="send-help"]').click();
  await sentCard.waitFor();
  const [lost] = await casesSaying('e2e: a request whose answer is lost');
  assert.equal(await sentCard.getAttribute('data-case-sent'), lost.id);
  assert.equal(lost.id, sentIds.at(-1), 'the case is the id this phone made');

  // 2. the server's answer is lost (a 5xx) and the owner sends the same words again: the same id, the stored request
  await ask('e2e: the same words, sent again');
  lose = 'server';
  await help.locator('[data-action="send-help"]').click();
  await help.locator('[data-help-form] .note-error').waitFor();
  const reply = page.waitForResponse((r) => match(new URL(r.url())));
  await help.locator('[data-action="send-help"]').click();
  await sentCard.waitFor();
  assert.equal(sentIds.at(-1), sentIds.at(-2), 'the same id both times');
  assert.equal((await (await reply).json()).reused, true, 'the database answers the request stored the first time');
  assert.equal((await casesSaying('e2e: the same words, sent again')).length, 1, 'one request, not two');

  // 3. the answer is lost, then the owner changes the words: a new request with a new id, so Halom sees the new words
  await ask('e2e: the first words');
  lose = 'server';
  await help.locator('[data-action="send-help"]').click();
  await help.locator('[data-help-form] .note-error').waitFor();
  await help.locator('[data-field="help-subject"]').fill('e2e: the words the owner changed');
  await help.locator('[data-action="send-help"]').click();
  await sentCard.waitFor();
  assert.notEqual(sentIds.at(-1), sentIds.at(-2), 'changed words, a new id');
  const [changed] = await casesSaying('e2e: the words the owner changed');
  assert.ok(changed, 'the new words reached Halom');
  assert.equal(await sentCard.getAttribute('data-case-sent'), changed.id);
  assert.equal((await casesSaying('e2e: the first words')).length, 1, 'the first try was stored too (its answer was lost)');
  await page.unroute(match);
  // the 5xx answers this test makes on purpose are the browser's own console lines
  page.problems = page.problems.filter((p) => !/status of 500/.test(p));
  assert.deepEqual(problems(), []);
});

test('the owner\'s switch for Halom acting stands on its own: off in one tap whatever the day\'s requests, logged, and Halom is refused; a manager sees it disabled', { timeout: 300000 }, async () => {
  // the day's requests used up (open_case's cap): the switch does not go through a request
  for (let i = 0; i < 20; i++) {
    const r = await owner.askForHelp('other', 'e2e: a request that fills the day ' + i);
    if (!r.ok) { assert.equal(r.code, 'rate_limited'); break; }
  }
  const cases = async () => (await owner.api.select('support_cases', { select: 'id', venue_id: `eq.${owner.venueId}` })).length;
  const canAct = async () => (await owner.api.select('venues', { select: 'support_can_act', id: `eq.${owner.venueId}` }))[0].support_can_act;
  const casesBefore = await cases();
  await go('help');
  const help = page.locator('[data-screen="help"]');
  await help.locator('[data-allow="on"]').waitFor();
  await help.locator('[data-allow] [role="switch"]').click();                       // one tap, nothing else
  await help.locator('[data-allow="off"]').waitFor();
  assert.equal(await help.locator('[data-allow] [role="switch"]').getAttribute('aria-checked'), 'false');
  assert.equal(await canAct(), false, 'stored at once');
  assert.equal(await cases(), casesBefore, 'no request opened for it');
  await shot('15-help-switch-off');

  // the owner leaves the screen; it stays off, and Halom's act is refused
  await go('home');
  await page.locator('[data-glance]').waitFor();
  const refusedAct = await halom.actForOwner(owner.venueId, 'e2e: Halom tries after the switch went off', 'availability.set',
    { targetKind: 'dish', targetId: ids.dishes.cookie, until: { kind: 'duration', minutes: 60 } });
  assert.deepEqual([refusedAct.ok, refusedAct.code], [false, 'owner_declined']);
  assert.equal(await canAct(), false);
  // the change is in the log, by "you"
  await go('activity');
  const line = page.locator('[data-activity][data-action="venues.update"]').first();
  await line.waitFor();
  assert.equal(await line.locator('.actrow-what').innerText(), 'חלום לא יכולים לבצע שינויים בשבילכם');
  assert.equal(await line.getAttribute('data-who'), 'you');

  // a manager sees the switch, disabled ("only an owner"), and reads the owner's line as the owner's
  const mgr = await createUser(e.stack, { email: 'dash-manager@sim.local', password: PASSWORD });
  await e.stack.addMember(owner.venueId, mgr.id, 'manager');
  const m = await e.page(e.webUrl + 'studio/');
  await m.getByLabel('אימייל').fill('dash-manager@sim.local');
  await m.getByLabel('סיסמה', { exact: true }).fill(PASSWORD);
  await m.getByRole('button', { name: 'המשך' }).click();
  await m.locator('[data-screen="home"]').waitFor();
  await m.goto(e.webUrl + 'studio/#/help');
  const card = m.locator('[data-screen="help"] [data-allow="off"]');
  await card.waitFor();
  assert.equal(await card.locator('[role="switch"]').isDisabled(), true);
  assert.match(await card.innerText(), /רק בעלי המקום יכולים לשנות את זה\. עכשיו: לא מותר\./);
  await m.screenshot({ path: path.join(SHOTS, '16-help-switch-manager.png'), fullPage: true });
  await m.goto(e.webUrl + 'studio/#/activity');
  const theirs = m.locator('[data-activity][data-action="venues.update"]').first();
  await theirs.waitFor();
  assert.equal(await theirs.getAttribute('data-who'), 'owner');
  assert.match(await theirs.innerText(), /בעלי המקום/);
  await m.context().close();
  await e.stack.sql('delete from public.venue_members where venue_id = $1 and user_id = $2', [owner.venueId, mgr.id]);

  // on again, in one tap
  await go('help');
  await help.locator('[data-allow="off"] [role="switch"]').click();
  await help.locator('[data-allow="on"]').waitFor();
  assert.equal(await canAct(), true);
  assert.deepEqual(problems(), []);
});

test('export: a JSON file equal to export_menu\'s reply, and a CSV with the same dishes and prices, every text quoted', { timeout: 300000 }, async () => {
  // a name a spreadsheet in a semicolon locale would split into a formula (SEC-L3)
  const evil = 'x;=HYPERLINK(D5)';
  await owner.insert('dishes', [{ section_id: ids.sections.mains, position: 20, name_he: evil, name_en: evil, price: 1000 }]);
  await go('home');
  const card = page.locator('[data-export]');
  await card.scrollIntoViewIfNeeded();
  const take = async (action) => {
    const [response, download] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/rest/v1/rpc/export_menu')),
      page.waitForEvent('download'),
      card.locator(`[data-action="${action}"]`).click(),
    ]);
    return { reply: await response.json(), file: fs.readFileSync(await download.path(), 'utf8'), name: download.suggestedFilename() };
  };
  const j = await take('export-json');
  assert.deepEqual(JSON.parse(j.file), j.reply, 'the file is the reply');
  // named by the place's own day (L8)
  const day = (x) => localParts(Date.parse(x.exportedAt), x.venue.timeZone).date;
  assert.equal(j.name, `${slug}-menu-${day(j.reply)}.json`);
  assert.equal(j.reply.venue.slug, slug);

  const c = await take('export-csv');
  assert.equal(c.name, `${slug}-menu-${day(c.reply)}.csv`);
  assert.ok(c.file.startsWith('\uFEFF'));
  assert.ok(c.file.includes(`"${evil}","${evil}"`), 'the name quoted as one cell: a semicolon inside it splits nothing');
  assert.ok(!c.file.split('\r\n').some((line) => line.split('"').filter((_, i) => i % 2 === 0).join('').includes(';')), 'no semicolon outside quotes');
  const rows = parseCsv(c.file.slice(1));
  const dishRows = rows.slice(1).filter((r) => r[5] === '' && r[8] === '');
  const money = (a) => (a === null ? '' : (a / 100).toFixed(2));
  const want = c.reply.tables.sections.flatMap((s) => c.reply.tables.dishes.filter((d) => d.section_id === s.id).map((d) => [s.name_he, s.name_en, d.name_he, d.name_en, money(d.price)]));
  assert.deepEqual(dishRows.map((r) => r.slice(0, 5)), want, 'every dish, in menu order, with its price in shekels');
  const fries = rows.find((r) => r[3] === 'Burger' && r[9] === 'Fries');
  assert.ok(fries && fries[6] === 'Side of choice', 'the add-on choices under their dish');
  assert.ok(rows.some((r) => r[3] === 'Burger' && r[6] === 'Fries › Sauce' && r[9] === 'Harissa' && r[10] === '3.00'), 'the nested sauce under its opener');

  // each export is in the owner's log (the owner's own, "you")
  await go('activity');
  const mine = page.locator('[data-activity][data-action="menu.export"][data-who="you"]');
  await mine.first().waitFor();
  assert.ok(await mine.count() >= 2);
  assert.deepEqual(problems(), []);
});

test('a first publish waiting for Halom flips to live by itself when Halom approves (no "check again")', { timeout: 300000 }, async () => {
  const second = await OwnerBot.signInAs(e.stack, { email: `owner.${slug}@example.invalid`, password: PASSWORD });
  const made = await second.createVenue({ slug: 'dash-approval-sim', name: { he: 'אישור סים', en: 'Approval Sim' }, kind: 'cafe' });
  assert.equal(made.ok, true, JSON.stringify(made));
  await second.buildMenu({ sections: [{ key: 'm', name: { he: 'עיקריות', en: 'Mains' }, dishes: [{ key: 'd', name: { he: 'פסטה', en: 'Pasta' }, price: 5200 }] }] });

  await page.reload();
  await page.locator('[data-action="switch-venue"]').click();
  await page.locator('[data-venue="dash-approval-sim"]').click();
  await page.locator('[data-screen="onboarding"]').waitFor();                      // never published: it opens on the setup flow
  await go('publish');
  const pub = page.locator('[data-screen="publish"]');
  await pub.locator('[data-action="publish"]:not([disabled])').waitFor();
  await pub.locator('[data-action="publish"]').click();
  await page.locator('[data-standing-card="pending"]').waitFor();
  await shot('12-publish-pending');
  // a special now says plainly that guests see it once Halom approves
  await go('home');
  await page.locator('[data-act="special"]').click();
  await page.locator('dialog[data-sheet="special"] [data-approval-note="pending"]').waitFor();
  assert.match(await page.locator('[data-approval-note="pending"]').innerText(), /מחכה לאישור של חלום/);
  await page.locator('dialog[data-sheet="special"]').getByRole('button', { name: 'סגירה' }).click();
  await go('publish');
  await page.locator('[data-standing-card="pending"]').waitFor();

  // Halom approves the revision it reviewed: the one published
  const [published] = await second.api.select('menu_revisions', { select: 'number', venue_id: `eq.${made.id}`, order: 'number.desc', limit: 1 });
  assert.equal((await halom.approve(made.id, 'e2e: approval pushed to the open screen', published.number)).ok, true);
  await page.locator('[data-standing-card="live"]').waitFor({ timeout: 45000 });  // no tap on "check again"
  await shot('13-publish-live-by-itself');
  // the log keeps the approval twice (venue.approve, and the row's approved_at); the owner reads it once (L2)
  const audit = await second.forVenue(made.id).activityPage({ limit: 100 });
  assert.ok(audit.entries.some((x) => x.action === 'venues.update') && audit.entries.some((x) => x.action === 'venue.approve'), 'both in the log');
  await go('activity');
  await page.locator('[data-screen="activity"][data-state="ready"]').waitFor();
  const approvedLines = await page.locator('[data-activity] .actrow-what').evaluateAll((els) => els.filter((x) => x.textContent === 'אישור התפריט').length);
  assert.equal(approvedLines, 1);

  // and back to Bistro Sim
  await page.locator('[data-action="switch-venue"]').click();
  await page.locator(`[data-venue="${slug}"]`).click();
  await page.locator('[data-screen="home"]').waitFor();
  assert.deepEqual(problems(), []);
});
