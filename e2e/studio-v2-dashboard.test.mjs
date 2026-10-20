// The owner app v2's dashboard lane (apps/studio/src/v2: Home, the activity log, get help, the export, approval pushed
// live) on a 390 × 844 phone against the simulator's stack, invented data only (Bistro Sim, a demo venue, so its
// dashboard counts its demo traffic as the contract says). Home says "no visits yet"; guest bots visit, the rollup job
// runs, and without a reload the numbers on Home and on the rules list equal the bots' ledger key by key. A dish goes
// off for two hours from Home in two taps and comes back with one; everything taken off today comes back in two. A dish
// without a price is a nudge that leads to its fix. A Halom bot acts for the owner with a reason, reads and exports the
// menu, and the activity log shows each as Halom, with the reason. "Get help" opens a case that the back office's
// ops_venues shows; Halom's answer is a nudge. The export downloads exactly export_menu's reply, and a CSV of the same
// dishes. A first publish waiting for Halom flips to live by itself when Halom approves.
// Needs the built site (bash tools/build-site.sh). Screenshots: e2e/.out/studio-v2-dashboard/.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { localParts } from '@mana/contracts';
import { asAnon, HalomBot, OwnerBot, runRandom } from '@mana/sim';
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

  // the rules list: each suggestion's shown, accepted and dismissed, from the same dashboard
  await go('rules');
  await page.locator('[data-rule-numbers]').first().waitFor();
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

test('from Home: a dish off for two hours in two taps, back in one; everything taken off today back in two; a special; today\'s hours', { timeout: 300000 }, async () => {
  await go('home');
  const croissant = ids.dishes.croissant, cookie = ids.dishes.cookie;
  const before = Date.now();
  await page.locator('[data-act="off2h"]').click();                              // tap 1
  const sheet = page.locator('dialog[data-sheet="off2h"]');
  await sheet.waitFor();
  await shot('05-off-2h-sheet');
  await sheet.locator(`[data-off2h="${croissant}"]`).click();                     // tap 2
  await sheet.waitFor({ state: 'detached' });
  const row = page.locator(`[data-off-row="${croissant}"]`);
  await row.waitFor();
  assert.match(await row.innerText(), /קרואסון[\s\S]*לא זמין עד \d\d:\d\d/);
  const off = (await live()).off.find((o) => o.id === croissant);
  assert.ok(off?.until, 'guests see it off');
  assert.ok(Date.parse(off.until) >= before + 2 * 3600_000 && Date.parse(off.until) <= Date.now() + 2 * 3600_000 + 60_000, off.until);
  await shot('06-home-off-now');
  await page.locator(`[data-bring-back="${croissant}"]`).click();                 // one tap back
  await row.waitFor({ state: 'detached' });
  assert.deepEqual((await live()).off, []);

  // two dishes off, then both back with "bring back today's" and its confirmation
  for (const id of [croissant, cookie]) {
    await page.locator('[data-act="off2h"]').click();
    await page.locator(`dialog[data-sheet="off2h"] [data-off2h="${id}"]`).click();
    await page.locator(`[data-off-row="${id}"]`).waitFor();
  }
  await page.locator('[data-act="restore-today"][data-n="2"]').click();
  await page.getByRole('dialog').getByRole('button', { name: 'להחזיר הכול' }).click();
  await page.locator('[data-off-list]').waitFor({ state: 'detached' });
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
  await page.locator('[data-act="hours"]').click();
  const hrs = page.locator('dialog[data-sheet="today-hours"]');
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
  assert.match(await entry('availability_overrides.insert').innerText(), /הורדה מהתפריט: מנה[\s\S]*עד \d\d:\d\d/);
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
  assert.deepEqual(idsShown.slice(0, all.entries.length), all.entries.map((x) => x.id), 'the RPC\'s own order');

  // the owner brings the cookies back from Home
  await go('home');
  await page.locator(`[data-bring-back="${ids.dishes.cookie}"]`).click();
  await off.waitFor({ state: 'detached' });
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

  // an answer lost on the way back (open_case takes no id of ours): the request is found among the open ones, once
  const subject = 'e2e: a request whose answer is lost';
  await help.locator('[data-topic="menu"]').click();
  await help.locator('[data-field="help-subject"]').fill(subject);
  let armed = true;
  const match = (u) => u.pathname.endsWith('/rest/v1/rpc/open_case');
  await page.route(match, async (r) => { if (armed) { armed = false; await r.fetch(); return r.abort('internetdisconnected'); } return r.continue(); });
  await help.locator('[data-action="send-help"]').click();
  const again = help.locator('[data-case-sent]');
  await again.waitFor();
  await page.unroute(match);
  const stored = await owner.api.select('support_cases', { select: 'id', venue_id: `eq.${owner.venueId}`, subject: `eq.${subject}` });
  assert.equal(stored.length, 1, 'one request, not two');
  assert.equal(await again.getAttribute('data-case-sent'), stored[0].id);
  assert.deepEqual(problems(), []);
});

test('export: a JSON file equal to export_menu\'s reply, and a CSV with the same dishes and prices', { timeout: 300000 }, async () => {
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
  assert.equal(j.name, `${slug}-menu-${j.reply.exportedAt.slice(0, 10)}.json`);
  assert.equal(j.reply.venue.slug, slug);

  const c = await take('export-csv');
  assert.equal(c.name, `${slug}-menu-${c.reply.exportedAt.slice(0, 10)}.csv`);
  assert.ok(c.file.startsWith('\uFEFF'));
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
  await page.locator('[data-screen="menu"]').waitFor();                            // never published: it opens on the menu
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

  assert.equal((await halom.approve(made.id, 'e2e: approval pushed to the open screen')).ok, true);
  await page.locator('[data-standing-card="live"]').waitFor({ timeout: 45000 });  // no tap on "check again"
  await shot('13-publish-live-by-itself');

  // and back to Bistro Sim
  await page.locator('[data-action="switch-venue"]').click();
  await page.locator(`[data-venue="${slug}"]`).click();
  await page.locator('[data-screen="home"]').waitFor();
  assert.deepEqual(problems(), []);
});
