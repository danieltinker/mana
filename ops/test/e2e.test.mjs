// Browser tests against the local stub (test/stub.mjs). Chromium, 1440×900 and 390×844.
import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStub } from './stub.mjs';
import { launch, open, signIn, shot, control, closeAll, until, DESKTOP, PHONE, STAFF, OWNER } from './helpers.mjs';
import { derive } from '../src/model.js';
import { HOSTILE } from './fixtures.mjs';

let stub, base, browser;
before(async () => { stub = createStub(); base = `http://127.0.0.1:${await stub.listen(0)}`; browser = await launch(); });
after(async () => { await browser.close(); await stub.close(); });
beforeEach(() => stub.reset('many'));
afterEach(() => closeAll());

const calls = (name) => stub.state.calls.filter((c) => c.name === name);
const expected = () => derive(stub.overview());
const clean = (problems) => assert.deepEqual(problems, [], 'no console errors, page errors or dialogs');
const noSideScroll = async (page) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the page does not scroll sideways');
async function staffIn(opts = {}) {
  const s = await open(browser, base, opts);
  await signIn(s.page);
  await s.page.locator('[data-tiles]').waitFor();
  return s;
}
const go = async (page, tab) => { await page.locator(`[data-tab=${tab}]`).click(); await page.locator('h1.page-title').filter({ hasText: new RegExp(tab, 'i') }).waitFor(); };

// ------------------------------------------------------------------ gatekeeping
test('gate: sign-in comes first, nothing is fetched before it, wrong password is explained', async () => {
  const { page, problems, ctx } = await open(browser, base);
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  assert.equal(await page.locator('meta[name=robots]').getAttribute('content'), 'noindex, nofollow, noarchive');
  assert.equal(await page.getByRole('link', { name: 'owner app' }).getAttribute('href'), '../studio/');
  assert.equal(stub.state.calls.length, 0);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByText('Enter your e-mail and password.').waitFor();
  await signIn(page, { email: STAFF.email, password: 'wrong' });
  await page.getByText('Wrong e-mail or password.').waitFor();
  assert.equal(calls('ops_overview').length, 0);
  assert.equal(await page.locator('[data-tiles]').count(), 0);
  // the only console error allowed here is the browser's own log line for the 400 response
  assert.deepEqual(problems.filter((p) => !/400 \(Bad Request\)/.test(p)), []);
  await ctx.close();
});

test('gate: a signed-in account that is not staff sees only the staff-code field; wrong code, then the right one', async () => {
  const { page, problems, ctx } = await open(browser, base);
  await signIn(page, OWNER);
  await page.getByRole('heading', { name: 'Staff code' }).waitFor();
  assert.equal(calls('ops_overview').length, 0, 'ops_overview is not even asked for');
  assert.equal(await page.locator('[data-tiles], [data-table], nav').count(), 0);
  await page.getByRole('button', { name: 'Unlock the back office' }).click();
  await page.getByText('Enter the staff code you received.').waitFor();
  await page.getByLabel('Staff code').fill('NOT-THE-CODE');
  await page.getByRole('button', { name: 'Unlock the back office' }).click();
  await page.getByText('That code is not valid, or it was already used.').waitFor();
  assert.equal(calls('ops_overview').length, 0);
  assert.equal(await page.locator('[data-tiles]').count(), 0);
  await shot(page, 'gate-staff-code-wrong-desktop');
  await page.getByLabel('Staff code').fill('  HALOM-STAFF-1 ');
  await page.getByRole('button', { name: 'Unlock the back office' }).click();
  await page.locator('[data-tiles]').waitFor();
  assert.equal(calls('redeem_staff_invite').at(-1).args.p_code, 'HALOM-STAFF-1');
  clean(problems);
  await ctx.close();
});

test('gate: a used code does not work for the next account', async () => {
  stub.state.invites.length = 0;                     // someone redeemed it already
  const { page, ctx } = await open(browser, base);
  await signIn(page, OWNER);
  await page.getByLabel('Staff code').fill('HALOM-STAFF-1');
  await page.getByRole('button', { name: 'Unlock the back office' }).click();
  await page.getByText('That code is not valid, or it was already used.').waitFor();
  assert.equal(await page.locator('[data-tiles]').count(), 0);
  await ctx.close();
});

test('gate: staff access removed mid-session → the 403 from ops_overview drops back to the code screen, data gone', async () => {
  const { page, ctx } = await staffIn();
  await control(base, { revokeStaff: STAFF.email });
  await page.locator('[data-refresh]').click();
  await page.getByRole('heading', { name: 'Staff code' }).waitFor();
  await page.getByText('This account does not have staff access.').first().waitFor();
  assert.equal(await page.locator('[data-tiles], [data-kpi]').count(), 0);
  assert.ok(!(await page.locator('body').innerText()).includes('Juno'));
  await ctx.close();
});

test('gate: the staff check itself fails (server error, then timeout) → retry screen, no data', async () => {
  await control(base, { faults: { is_staff: { mode: 'error', times: 1 } } });
  const { page, ctx } = await open(browser, base, { init: { __OPS_TIMEOUT_MS: 700 } });
  await signIn(page);
  await page.getByText('Could not check your access.').waitFor();
  assert.equal(calls('ops_overview').length, 0);
  await control(base, { faults: { is_staff: { mode: 'timeout', times: 1 } } });
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByText('The server did not answer in time.').waitFor();
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.locator('[data-tiles]').waitFor();
  await ctx.close();
});

test('gate: sign-in that never answers times out with a message; an expired session returns to sign-in', async () => {
  await control(base, { faults: { signin: 'timeout' } });
  const { page, ctx } = await open(browser, base, { init: { __OPS_TIMEOUT_MS: 700 } });
  await signIn(page);
  await page.getByText('The server did not answer in time.').waitFor();
  await control(base, { faults: {} });
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('[data-tiles]').waitFor();
  await control(base, { faults: { ops_overview: { mode: 'jwt', times: 1 } } });
  await page.locator('[data-refresh]').click();
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  await page.getByText('Your session ended. Sign in again.').waitFor();
  assert.equal(await page.locator('[data-tiles]').count(), 0);
  await ctx.close();
});

test('gate: the session survives a reload; sign out removes it', async () => {
  const { page, ctx } = await staffIn();
  await page.reload();
  await page.locator('[data-tiles]').waitFor();
  await page.locator('.acct summary').click();
  await page.locator('[data-signout]').click();
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  assert.equal(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('auth-token')).length), 0);
  await ctx.close();
});

test('gate: works under the halom.io/mana/ops/ prefix too (relative URLs only)', async () => {
  const { page, problems, ctx } = await open(browser, base, { prefix: '/mana' });
  await signIn(page);
  await page.locator('[data-tiles]').waitFor();
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).fontFamily.includes('IBM Plex Sans Hebrew')), true);
  assert.ok(await page.evaluate(() => document.fonts.ready.then(() => [...document.fonts].some((f) => f.status === 'loaded'))), 'a bundled font loaded');
  clean(problems);
  await ctx.close();
});

// ------------------------------------------------------------------ overview
for (const [tag, viewport] of [['desktop', DESKTOP], ['phone', PHONE]]) {
  test(`overview (${tag}): tiles, funnel and charts match the data`, async () => {
    const { page, problems, ctx } = await staffIn({ viewport });
    const d = expected();
    const tile = async (id) => Number((await page.locator(`[data-kpi=${id}] [data-value]`).innerText()).replace(/,/g, ''));
    for (const id of ['accountsWithoutBusiness', 'businesses', 'withItems', 'withApproved', 'published', 'live', 'trialSoon', 'planOff', 'views7', 'newLeads']) {
      assert.equal(await tile(id), d.kpi[id], id);
    }
    assert.deepEqual([d.kpi.businesses, d.kpi.live, d.kpi.trialSoon, d.kpi.planOff, d.kpi.newLeads, d.kpi.accountsWithoutBusiness], [25, 8, 3, 3, 6, 9]);
    const steps = await page.locator('[data-funnel] [data-step]').evaluateAll((els) => els.map((e) => [e.dataset.step, Number(e.querySelector('[data-value]').textContent.replace(/,/g, ''))]));
    assert.deepEqual(steps, d.funnel.map((s) => [s.id, s.value]));
    assert.match(await page.locator('[data-step=business] [data-drop]').innerText(), /−9 \(26% dropped here\)/);
    for (const [id, series] of [['signups', d.signups], ['views', d.views]]) {
      const total = series.reduce((s, x) => s + x.value, 0);
      assert.equal(Number((await page.locator(`[data-chart=${id}] [data-total]`).innerText()).replace(/,/g, '')), total);
      assert.equal(await page.locator(`[data-chart=${id}] path.col`).count(), series.filter((x) => x.value > 0).length);
    }
    // read-out: pointer and keyboard give the same value; the table twin holds every day
    const plot = page.locator('[data-chart=views] .chart-plot');
    await plot.focus(); await page.keyboard.press('ArrowLeft');
    assert.match(await page.locator('[data-chart=views] .tip').innerText(), new RegExp(`${d.views.at(-2).value.toLocaleString('en-US')} views?`));
    await page.keyboard.press('End');
    assert.match(await page.locator('[data-chart=views] .tip').innerText(), new RegExp(`^${d.views.at(-1).value.toLocaleString('en-US')} `));
    await shot(page, `overview-many-${tag}`);
    await page.locator('[data-chart=views]').getByRole('button', { name: 'Show as table' }).click();
    assert.equal(await page.locator('[data-chart=views] tbody tr').count(), 30);
    await noSideScroll(page);
    clean(problems);
    await ctx.close();
  });

  test(`overview (${tag}): first day, nothing yet → zeros and honest empty states`, async () => {
    stub.reset('empty');
    const { page, problems, ctx } = await staffIn({ viewport });
    assert.deepEqual(await page.locator('[data-kpi] [data-value]').allInnerTexts(), Array(10).fill('0'));
    await page.getByText('Nothing here yet: no owner has signed up').waitFor();
    assert.equal(await page.locator('[data-empty]').count(), 3);
    assert.equal(await page.locator('path.col, .fn-bar').count(), 0, 'no fake marks');
    await page.getByText('No business was created in the last 30 days.').waitFor();
    await page.getByText('No diner has opened a menu in the last 30 days.').waitFor();
    await shot(page, `overview-empty-${tag}`);
    await go(page, 'businesses'); await page.getByRole('heading', { name: 'No business yet' }).waitFor();
    assert.equal(await page.locator('[data-export=businesses]').isDisabled(), true);
    await go(page, 'leads'); await page.getByRole('heading', { name: 'No enquiry yet' }).waitFor();
    await noSideScroll(page);
    clean(problems);
    await ctx.close();
  });
}

test('overview: one business, one lead', async () => {
  stub.reset('one');
  const { page, problems, ctx } = await staffIn();
  assert.equal(await page.locator('[data-kpi=businesses] [data-value]').innerText(), '1');
  assert.equal(await page.locator('[data-chart=signups] path.col').count(), 1);
  assert.equal(await page.locator('[data-chart=views] [data-empty]').count(), 1);
  assert.deepEqual(await page.locator('[data-funnel] [data-value]').allInnerTexts(), ['3', '1', '1', '0', '0', '0']);
  await shot(page, 'overview-one-desktop');
  await go(page, 'businesses');
  assert.equal(await page.locator('[data-table=businesses] tbody tr').count(), 1);
  await shot(page, 'businesses-one-desktop');
  clean(problems);
  await ctx.close();
});

test('overview: a tile opens the matching filtered list', async () => {
  const { page, ctx } = await staffIn();
  await page.locator('[data-kpi=live]').click();
  await page.locator('[data-table=businesses]').waitFor();
  await until(() => page.locator('[data-table=businesses] tbody tr').count(), 8);
  assert.equal(await page.locator('[data-filter]').inputValue(), 'live');
  await page.goBack(); await page.locator('[data-kpi=newLeads]').click();
  await page.locator('[data-table=leads]').waitFor();
  await until(() => page.locator('[data-table=leads] tbody tr[data-lead]').count(), 6);
  await ctx.close();
});

// ------------------------------------------------------------------ businesses
test('businesses (desktop): every column, sorting, filtering, search, safe links', async () => {
  const { page, problems, ctx } = await staffIn();
  await go(page, 'businesses');
  const rows = page.locator('[data-table=businesses] tbody tr');
  const slugs = () => rows.evaluateAll((els) => els.map((e) => e.dataset.slug));
  assert.equal(await rows.count(), 25);
  assert.equal((await slugs())[0], 'new-today', 'newest first by default');
  // all 13 column groups fit in 1440 px without a sideways scroll inside the table
  assert.ok(await page.locator('.table-wrap').evaluate((e) => e.scrollWidth <= e.clientWidth + 1), 'the table fits the laptop width');
  assert.equal(await page.locator('[data-table=businesses] thead th').count(), 13);
  await shot(page, 'businesses-many-desktop');

  await page.locator('[data-sort=items]').click();
  assert.deepEqual((await slugs()).slice(0, 3), ['olea', 'juno', 'beer-bazaar']);
  assert.equal(await page.locator('th[aria-sort=descending]').count(), 1);
  await page.locator('[data-sort=items]').click();
  assert.equal(await page.locator('th[aria-sort=ascending]').count(), 1);
  assert.equal(await rows.first().locator('td.num').first().innerText(), '0 · 0 pic');
  await page.locator('[data-sort=views]').click();
  assert.equal((await slugs())[0], 'abu-hassan');
  await page.locator('[data-sort=plan]').click();
  assert.equal((await slugs())[0], 'last-day', 'fewest days left first');
  await page.locator('[data-sort=name]').click();
  const names = await slugs(); assert.equal(names.length, 25);
  await page.locator('[data-sort=signin]').click();
  assert.equal((await slugs())[0], 'beer-bazaar');

  const want = { live: 8, stalled: 4, 'trial-soon': 3, 'plan-off': 3, review: 3, attention: 12 };
  for (const [f, n] of Object.entries(want)) {
    await page.locator('[data-filter]').selectOption(f);
    await until(() => rows.count(), n, `filter ${f}`);
  }
  await page.locator('[data-filter]').selectOption('stalled');
  await until(() => page.locator('[data-table=businesses] [data-stage]').evaluateAll((els) => els.map((e) => e.dataset.stage)), Array(4).fill('stalled'));
  assert.match(await rows.first().locator('[data-stage]').innerText(), /Stalled\s+at .+ · \d+ days idle/);
  await page.locator('[data-filter]').selectOption('all');
  await until(() => rows.count(), 25);
  await page.locator('[data-search]').fill('אבו');
  await until(slugs, ['abu-hassan']);
  await page.locator('[data-search]').fill('NOA@juno');
  await until(async () => (await slugs()).sort(), ['juno', 'juno-beach']);
  await page.locator('[data-search]').fill('zzz-nothing');
  await page.locator('[data-empty-filter]').waitFor();
  await page.locator('[data-search]').fill('');
  await until(() => rows.count(), 25);

  const juno = page.locator('tr[data-slug=juno]');
  assert.deepEqual(await juno.locator('a').evaluateAll((els) => els.map((a) => a.getAttribute('href'))), [
    'https://halom.io/m/juno', '../view/?m=juno', 'mailto:noa@juno.test', 'tel:+972542022269', 'https://wa.me/972542022269']);
  assert.equal(await juno.locator('a[target=_blank]').first().getAttribute('rel'), 'noopener noreferrer');
  assert.match(await juno.innerText(), /Trial · running/);
  assert.match(await juno.innerText(), /10 days left/);
  assert.match(await page.locator('tr[data-slug=port-said]').innerText(), /Published, offline\s+plan expired/);
  assert.match(await page.locator('tr[data-slug=the-longest-restaurant-name-in-tel-av]').innerText(), /call the office after 10/);
  assert.equal(await page.locator('tr[data-slug=the-longest-restaurant-name-in-tel-av] a[href^="tel:"]').count(), 0, 'free text in the phone field is not a link');
  clean(problems);
  await ctx.close();
});

test('businesses (phone): cards instead of a table, drawer fills the screen', async () => {
  const { page, problems, ctx } = await staffIn({ viewport: PHONE });
  await go(page, 'businesses');
  assert.equal(await page.locator('[data-table=businesses]').count(), 0);
  assert.equal(await page.locator('[data-cards=businesses] > li').count(), 25);
  await noSideScroll(page);
  await shot(page, 'businesses-many-phone', { fullPage: false });
  await page.locator('[data-sort-select]').selectOption('views');
  await until(() => page.locator('[data-cards=businesses] > li').first().getAttribute('data-slug'), 'abu-hassan');
  await page.locator('[data-filter]').selectOption('attention');
  await until(() => page.locator('[data-cards=businesses] > li').count(), 12);
  await shot(page, 'businesses-attention-phone', { fullPage: false });
  await page.locator('li[data-slug=cafe-levinsky]').getByRole('button', { name: 'Details' }).click();
  const drawer = page.locator('[data-drawer=cafe-levinsky]');
  await drawer.waitFor();
  assert.equal((await drawer.boundingBox()).width, 390);
  await shot(page, 'drawer-phone', { fullPage: false });
  await noSideScroll(page);
  clean(problems);
  await ctx.close();
});

test('drawer: everything about one business, hints, keyboard: Escape closes and focus returns', async () => {
  const { page, problems, ctx } = await staffIn();
  await go(page, 'businesses');
  await page.locator('tr[data-slug=cafe-levinsky] [data-open]').focus();
  await page.keyboard.press('Enter');
  const drawer = page.locator('[data-drawer=cafe-levinsky]');
  await drawer.waitFor();
  assert.equal(await drawer.getAttribute('aria-modal'), 'true');
  assert.ok(await drawer.evaluate((e) => e.contains(document.activeElement)), 'focus moved into the drawer');
  assert.deepEqual(await drawer.locator('[data-hint]').evaluateAll((els) => els.map((e) => e.dataset.hint)), ['failed', 'trial']);
  const text = await drawer.innerText();
  for (const s of ['קפה לוינסקי', 'Cafe Levinsky', 'halom.io/m/cafe-levinsky', '../view/?m=cafe-levinsky', '12 approved', '1 failed', '22, 12 with a picture', 'Trial · running', '3 days left', 'Revisions']) assert.ok(text.includes(s), s);
  await shot(page, 'drawer-desktop', { fullPage: false });
  // focus stays inside while tabbing
  for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
  assert.ok(await drawer.evaluate((e) => e.contains(document.activeElement)), 'Tab does not leave the open drawer');
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.closest('tr') && document.activeElement.closest('tr').dataset.slug), 'cafe-levinsky');
  // hints on other rows
  for (const [slug, hint] of [['hummus-eliyahu', 'nopics'], ['port-said', 'expired'], ['shuk-bites', 'suspended'], ['ghost-kitchen', 'stalled'], ['saluf', 'failed'], ['the-norman', 'noviews']]) {
    await page.locator(`tr[data-slug=${slug}] [data-open]`).click();
    await page.locator(`[data-drawer=${slug}] [data-hint=${hint}]`).waitFor();
    await page.locator('[data-close]').click();
    await page.locator('[data-drawer]').waitFor({ state: 'detached' });
  }
  // a visible focus ring on keyboard focus
  await page.keyboard.press('Tab');
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none');
  clean(problems);
  await ctx.close();
});

test('plan change: choose → review → confirm → applied, with the exact call; a failure keeps the confirmation open', async () => {
  const { page, problems, ctx } = await staffIn();
  await go(page, 'businesses');
  await page.locator('tr[data-slug=cafe-levinsky] [data-open]').click();
  const plan = page.locator('[data-plan]');
  assert.match(await plan.locator('[data-plan-now]').innerText(), /Trial · running/);
  await plan.getByText('Pilot, active until').click();
  await plan.locator('[data-plan-date]').fill('2027-01-31');
  await plan.locator('[data-plan-note]').fill('פיילוט עד סוף ינואר');
  assert.equal(calls('ops_set_entitlement').length, 0);
  await plan.locator('[data-plan-review]').click();
  assert.equal(await plan.locator('[data-plan-summary]').innerText(), 'Pilot plan, active until 31 Jan 2027');
  assert.equal(calls('ops_set_entitlement').length, 0, 'nothing is sent before the confirmation');
  await shot(page, 'plan-confirm-desktop', { fullPage: false });

  await control(base, { faults: { ops_set_entitlement: { mode: 'error', times: 1 } } });
  await plan.locator('[data-plan-apply]').click();
  assert.match(await plan.locator('[data-plan-error]').innerText(), /Not applied: The server refused: stub: simulated database error/);
  assert.match(await plan.locator('[data-plan-now]').innerText(), /Trial · running/, 'still the old plan');

  await plan.locator('[data-plan-apply]').click();
  await plan.locator('[data-plan-result]').waitFor();
  const call = calls('ops_set_entitlement').at(-1).args;
  const id = stub.state.data.businesses.find((b) => b.slug === 'cafe-levinsky').id;
  assert.deepEqual(call, { p_business: id, p_plan: 'pilot', p_status: 'active', p_until: '2027-01-31T21:59:59.000Z', p_note: 'פיילוט עד סוף ינואר' });
  assert.match(await plan.locator('[data-plan-now]').innerText(), /Pilot · active until 31 Jan 2027/);
  assert.ok((await plan.innerText()).includes('פיילוט עד סוף ינואר'));
  assert.match(await page.locator('tr[data-slug=cafe-levinsky]').innerText(), /Pilot · active/);
  await shot(page, 'plan-applied-desktop', { fullPage: false });

  // suspend → the row goes offline; then extend the trial brings it back
  await plan.getByText('Suspend', { exact: true }).click();
  await plan.locator('[data-plan-review]').click();
  assert.match(await plan.locator('[data-plan-summary]').innerText(), /Suspend the plan/);
  await plan.locator('[data-plan-apply]').click();
  await plan.locator('[data-plan-result]').waitFor();
  assert.deepEqual({ ...calls('ops_set_entitlement').at(-1).args }, { p_business: id, p_plan: 'pilot', p_status: 'suspended', p_until: null, p_note: null });
  assert.match(await page.locator('tr[data-slug=cafe-levinsky]').innerText(), /Published, offline\s+plan suspended/);
  await plan.getByText('Extend the trial').click();
  await plan.locator('[data-plan-date]').fill('2027-02-10');
  await plan.locator('[data-plan-review]').click();
  await page.getByText('Extending the trial moves it back to the trial plan.').waitFor();
  await plan.locator('[data-plan-apply]').click();
  await plan.locator('[data-plan-result]').waitFor();
  assert.match(await plan.locator('[data-plan-now]').innerText(), /Trial · running until 10 Feb 2027/);
  // a missing date is caught before the confirmation
  await plan.getByText('Paid, active until').click();
  await plan.locator('[data-plan-date]').fill('');
  await plan.locator('[data-plan-review]').click();
  await plan.getByText('Choose a date.').waitFor();
  assert.equal(await plan.locator('[data-plan-confirm]').count(), 0);
  clean(problems.filter((p) => !/500 \(Internal Server Error\)/.test(p)));
  await ctx.close();
});

// ------------------------------------------------------------------ leads
test('leads (desktop): new first, status filters, long dream expands', async () => {
  const { page, problems, ctx } = await staffIn();
  await go(page, 'leads');
  const rows = page.locator('[data-table=leads] tbody tr[data-lead]');
  assert.equal(await rows.count(), 15);
  const statuses = await rows.locator('[data-status]').evaluateAll((els) => els.map((e) => e.value));
  assert.deepEqual(statuses.slice(0, 6), Array(6).fill('new'));
  assert.deepEqual(statuses.slice(6), ['qualified', 'scoped', 'agreed', 'production', 'review', 'deployed', 'support', 'lost', 'spam']);
  assert.deepEqual(await page.locator('[data-table=leads] [data-status]').first().locator('option').evaluateAll((els) => els.map((e) => e.value)),
    ['new', 'qualified', 'scoped', 'agreed', 'production', 'review', 'deployed', 'support', 'lost', 'spam']);
  await shot(page, 'leads-many-desktop');
  await page.locator('[data-status-filter=new]').click();
  await until(() => rows.count(), 6);
  await page.locator('[data-status-filter=open]').click();
  await until(() => rows.count(), 11);
  await page.locator('[data-status-filter=spam]').click();
  await until(() => rows.evaluateAll((els) => els.map((e) => e.dataset.lead)), ['HL-2026-0002']);
  await page.locator('[data-status-filter=all]').click();
  await until(() => rows.count(), 15);
  const long = page.locator('tr[data-lead=HL-2026-0010]');
  const h0 = (await long.locator('[data-dream]').boundingBox()).height;
  await long.locator('[data-dream-toggle]').click();
  assert.ok((await long.locator('[data-dream]').boundingBox()).height > h0 * 3, 'the whole dream is shown');
  assert.equal((await long.locator('[data-dream]').innerText()).length, 2520);
  assert.deepEqual(await page.locator('tr[data-lead=HL-2026-0014] a').evaluateAll((els) => els.map((a) => a.getAttribute('href'))), ['tel:+972542022269', 'https://wa.me/972542022269']);
  assert.deepEqual(await page.locator('tr[data-lead=HL-2026-0015] a').evaluateAll((els) => els.map((a) => a.getAttribute('href'))), ['mailto:michal@barflorentin.test']);
  clean(problems);
  await ctx.close();
});

test('lead edit: inline save sends only what changed; a failure is shown and the typing is kept', async () => {
  const { page, problems, ctx } = await staffIn();
  await go(page, 'leads');
  const row = page.locator('tr[data-lead=HL-2026-0010]');
  const lead = () => stub.state.data.leads.find((l) => l.ref === 'HL-2026-0010');
  await row.locator('[data-edit]').click();
  const form = page.locator('tr[data-lead-edit=HL-2026-0010]');
  await form.locator('[data-f=owner]').fill('Maya');
  await form.locator('[data-f=nextAction]').fill('לשלוח הצעת מחיר');
  await form.locator('[data-f=nextOn]').fill('2026-10-12');
  await form.locator('[data-f=notes]').fill('Line one\nשורה שתיים');
  await shot(page, 'lead-edit-desktop', { fullPage: false });

  await control(base, { faults: { ops_update_lead: { mode: 'error', times: 1 } } });
  await form.locator('[data-save]').click();
  assert.match(await form.locator('[data-feedback=error]').innerText(), /Not saved: The server refused: stub: simulated database error/);
  assert.equal(await form.locator('[data-f=owner]').inputValue(), 'Maya', 'the draft is still there');
  assert.equal(lead().owner, 'Daniel', 'nothing changed on the server');
  await shot(page, 'lead-edit-failed-desktop', { fullPage: false });

  await form.locator('[data-save]').click();
  await row.locator('[data-feedback=ok]').waitFor();
  assert.deepEqual(calls('ops_update_lead').at(-1).args, { p_id: lead().id, p_status: null, p_owner: 'Maya', p_next_action: 'לשלוח הצעת מחיר', p_next_action_on: '2026-10-12', p_notes: 'Line one\nשורה שתיים' });
  assert.equal(await page.locator('tr[data-lead-edit=HL-2026-0010]').count(), 0, 'the editor closed');
  const t = await row.innerText();
  for (const s of ['Maya', 'לשלוח הצעת מחיר', '12 Oct 2026', 'Line one']) assert.ok(t.includes(s), s);

  // a date cannot be removed through ops_update_lead: said plainly, nothing sent
  const n = calls('ops_update_lead').length;
  await row.locator('[data-edit]').click();
  await form.locator('[data-f=nextOn]').fill('');
  await form.locator('[data-save]').click();
  assert.match(await form.locator('[data-feedback=error]').innerText(), /A date cannot be removed yet/);
  assert.equal(calls('ops_update_lead').length, n);
  await form.locator('[data-cancel]').click();
  assert.equal(await page.locator('tr[data-lead-edit=HL-2026-0010]').count(), 0);

  // the lead that vanished meanwhile
  await control(base, { faults: { ops_update_lead: { mode: 'okfalse', code: 'no_lead', times: 1 } } });
  await row.locator('[data-status]').selectOption('scoped');
  assert.match(await row.locator('[data-feedback=error]').innerText(), /This enquiry no longer exists/);
  clean(problems.filter((p) => !/500 \(Internal Server Error\)/.test(p)));
  await ctx.close();
});

test('lead status: changing the select saves at once; failure offers Retry; the "new" count follows', async () => {
  const { page, ctx } = await staffIn();
  await go(page, 'leads');
  assert.match(await page.locator('[data-tab=leads]').innerText(), /6 new/);
  const row = page.locator('tr[data-lead=HL-2026-0014]');
  await row.locator('[data-status]').selectOption('qualified');
  await row.locator('[data-feedback=ok]').waitFor();
  assert.deepEqual(calls('ops_update_lead').at(-1).args, { p_id: stub.state.data.leads.find((l) => l.ref === 'HL-2026-0014').id, p_status: 'qualified', p_owner: null, p_next_action: null, p_next_action_on: null, p_notes: null });
  assert.match(await page.locator('[data-tab=leads]').innerText(), /5 new/);
  assert.equal(await page.locator('[data-status-filter=new] .chip-n').innerText(), '5');

  await control(base, { faults: { ops_update_lead: { mode: 'timeout', times: 1 } } });
  await page.evaluate(() => { window.__OPS_TIMEOUT_MS = 600; });
  const row2 = page.locator('tr[data-lead=HL-2026-0015]');
  await row2.locator('[data-status]').selectOption('lost');
  assert.match(await row2.locator('[data-feedback=error]').innerText(), /Not saved: The server did not answer in time/);
  assert.equal(stub.state.data.leads.find((l) => l.ref === 'HL-2026-0015').status, 'new');
  await row2.locator('[data-retry]').click();
  await row2.locator('[data-feedback=ok]').waitFor();
  assert.equal(stub.state.data.leads.find((l) => l.ref === 'HL-2026-0015').status, 'lost');
  await ctx.close();
});

test('leads (phone): cards, edit on the card, typing survives an automatic refresh', async () => {
  const { page, problems, ctx } = await staffIn({ viewport: PHONE, init: { __OPS_REFRESH_MS: 700 } });
  await go(page, 'leads');
  assert.equal(await page.locator('[data-table=leads]').count(), 0);
  assert.equal(await page.locator('[data-cards=leads] > li').count(), 15);
  await noSideScroll(page);
  await shot(page, 'leads-many-phone', { fullPage: false });
  const card = page.locator('li[data-lead=HL-2026-0015]');
  await card.locator('[data-edit]').click();
  await card.locator('[data-f=notes]').fill('typing while the page refreshes');
  const before = calls('ops_overview').length;
  await page.waitForTimeout(1700);
  assert.ok(calls('ops_overview').length >= before + 2, 'it refreshed by itself');
  assert.equal(await card.locator('[data-f=notes]').inputValue(), 'typing while the page refreshes');
  await shot(page, 'lead-edit-phone', { fullPage: false });
  await card.locator('[data-save]').click();
  await card.locator('[data-feedback=ok]').waitFor();
  assert.equal(stub.state.data.leads.find((l) => l.ref === 'HL-2026-0015').notes, 'typing while the page refreshes');
  await noSideScroll(page);
  clean(problems);
  await ctx.close();
});

// ------------------------------------------------------------------ hostile input
test('hostile strings stay text: no script runs, no markup is created, only links we built exist', async () => {
  const { page, problems, ctx } = await staffIn();
  const visit = async () => {
    await go(page, 'businesses');
    await page.locator('tr[data-slug=xss-bistro] [data-open], li[data-slug=xss-bistro] .card-title').first().click();
    await page.locator('[data-drawer=xss-bistro]').waitFor();
    assert.ok((await page.locator('[data-drawer=xss-bistro]').innerText()).includes('<img src=x onerror=window.__xss=1>'));
    await page.keyboard.press('Escape');
    await go(page, 'leads');
  };
  await visit();
  const body = await page.locator('#app').innerText();
  for (const s of [HOSTILE.img, HOSTILE.script, HOSTILE.formula, HOSTILE.svgMail, '<b onmouseover=window.__xss=1>Bob</b>', 'javascript:window.__xss=1']) assert.ok(body.includes(s), `shown as text: ${s}`);
  const probe = await page.evaluate(() => ({
    xss: window.__xss,
    injected: document.querySelectorAll('#app img, #app script, #app iframe, #app object, #app embed, #app b, #app [onerror], #app [onload], #app [onmouseover], #app svg[onload]').length,
    hrefs: [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
    bidi: /[‪-‮⁦-⁩]/.test(document.body.textContent),
    userTextIsolated: [...document.querySelectorAll('[data-dream]')].every((e) => e.getAttribute('dir') === 'auto'),
  }));
  assert.equal(probe.xss, undefined);
  assert.equal(probe.injected, 0);
  assert.equal(probe.bidi, false, 'direction-override characters never reach the page');
  assert.equal(probe.userTextIsolated, true);
  const allowed = /^(#main$|#\/|\.\.\/studio\/$|\.\.\/view\/\?m=[a-z0-9-]+$|https:\/\/halom\.io\/m\/[a-z0-9-]+$|mailto:[^?&#\s<>"']+$|tel:\+?\d+$|https:\/\/wa\.me\/\d+$)/;
  assert.deepEqual(probe.hrefs.filter((h) => !allowed.test(h)), [], 'every link is one we constructed');
  const hostileRow = page.locator('tr[data-lead=HL-2026-0013]');
  assert.equal(await hostileRow.locator('a').count(), 0, 'the fake e-mail is not turned into a link');
  await page.getByText('Hidden control characters were removed from this enquiry.').waitFor();
  await page.locator('tr[data-lead=HL-2026-0013]').hover();
  await page.locator('tr[data-lead=HL-2026-0013] [data-edit]').click();
  await shot(page, 'leads-hostile-desktop', { fullPage: false });
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  clean(problems);
  await ctx.close();
});

// ------------------------------------------------------------------ CSV
test('CSV export: BOM, quoting, every row, formula cells neutralised, filter respected', async () => {
  const { page, ctx } = await staffIn();
  const grab = async (which) => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator(`[data-export=${which}]`).click()]);
    return { name: dl.suggestedFilename(), bytes: await readFile(await dl.path()) };
  };
  const parse = (text) => {                       // small RFC 4180 reader
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; } else cell += c;
    }
    return rows;
  };
  await go(page, 'businesses');
  const b = await grab('businesses');
  assert.match(b.name, /^mana-businesses-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.deepEqual([...b.bytes.subarray(0, 3)], [0xEF, 0xBB, 0xBF], 'UTF-8 BOM for Excel');
  const bt = b.bytes.toString('utf8').slice(1);
  const br = parse(bt);
  assert.equal(br.length, 26); assert.ok(br.every((r) => r.length === br[0].length));
  assert.deepEqual(br[0].slice(0, 6), ['name_he', 'name_en', 'slug', 'menu_link', 'kind', 'stage']);
  const col = (n) => br[0].indexOf(n);
  const juno = br.find((r) => r[col('slug')] === 'juno');
  assert.equal(juno[col('name_he')], "ג'ונו"); assert.equal(juno[col('menu_link')], 'https://halom.io/m/juno');
  assert.equal(juno[col('stage')], 'Live'); assert.equal(juno[col('items')], '38'); assert.equal(juno[col('plan_state')], 'trialing');
  const xss = br.find((r) => r[col('slug')] === 'xss-bistro');
  assert.equal(xss[col('contact_name')], '\'=HYPERLINK("http://evil.example","owner")');
  assert.equal(xss[col('contact_phone')], "'+972-54-000-0000");
  assert.equal(xss[col('name_en')], '<img src=x onerror=window.__xss=1>');
  assert.ok(br.slice(1).flat().every((c) => !/^\s*[=+\-@\t\r]/.test(c)), 'no business cell can start a formula');
  await page.locator('[data-filter]').selectOption('live');
  await until(() => page.locator('[data-table=businesses] tbody tr').count(), 8);
  assert.equal(parse((await grab('businesses')).bytes.toString('utf8').slice(1)).length, 9, 'the export follows the filter');

  await go(page, 'leads');
  const l = await grab('leads');
  assert.match(l.name, /^halom-leads-/);
  const lr = parse(l.bytes.toString('utf8').slice(1));
  assert.equal(lr.length, 16);
  const lc = (n) => lr[0].indexOf(n);
  const evil = lr.find((r) => r[lc('ref')] === 'HL-2026-0012');
  assert.equal(evil[lc('dream')], '\'=HYPERLINK("http://evil.example/steal","Click for the brief")');
  assert.equal(evil[lc('name')], "'+SUM(1+1)*cmd|' /C calc'!A0"); assert.equal(evil[lc('source')], "'@SUM(A1:A9)"); assert.equal(evil[lc('contact')], "'-1234567@evil.example");
  assert.ok(lr.slice(1).flat().every((c) => !/^\s*[=+\-@\t\r]/.test(c)), 'no lead cell can start a formula');
  assert.ok(!/[‪-‮⁦-⁩]/.test(l.bytes.toString('utf8')), 'no direction overrides in the file');
  const long = lr.find((r) => r[lc('ref')] === 'HL-2026-0010');
  assert.equal(long[lc('dream')].length, 2520); assert.equal(long[lc('notes')].split('\n').length, 2, 'line breaks survive inside a cell');
  await ctx.close();
});

// ------------------------------------------------------------------ refresh
test('refresh: manual, automatic every interval while visible, paused while hidden, failures keep the last data', async () => {
  const { page, ctx } = await staffIn({ init: { __OPS_REFRESH_MS: 800, __OPS_TIMEOUT_MS: 600 } });
  const count = () => page.locator('[data-kpi=businesses] [data-value]').innerText();
  assert.equal(await count(), '25');
  assert.match(await page.locator('[data-updated-at]').innerText(), /^\d{2}:\d{2}:\d{2}$/);
  // automatic
  await control(base, { addBusiness: true });
  await page.waitForFunction(() => document.querySelector('[data-kpi=businesses] [data-value]').textContent === '26', null, { timeout: 4000 });
  // hidden tab: no requests
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  const n = calls('ops_overview').length;
  await page.waitForTimeout(2000);
  assert.equal(calls('ops_overview').length, n, 'no polling while the tab is hidden');
  await control(base, { addBusiness: true });
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction(() => document.querySelector('[data-kpi=businesses] [data-value]').textContent === '27', null, { timeout: 1500 });
  // failure: banner, old numbers stay
  await control(base, { faults: { ops_overview: { mode: 'error', times: 50 } } });
  await page.getByText('Refresh failed: The server refused: stub: simulated database error').waitFor();
  assert.equal(await count(), '27');
  await shot(page, 'refresh-failed-desktop', { fullPage: false });
  await control(base, { faults: {} });
  await page.getByText('Refresh failed').waitFor({ state: 'detached', timeout: 5000 });
  // timeout
  await control(base, { faults: { ops_overview: { mode: 'timeout', times: 50 } } });
  await page.getByText('Refresh failed: The server did not answer in time.').waitFor({ timeout: 5000 });
  assert.equal(await count(), '27');
  // manual
  await control(base, { faults: {}, addBusiness: true });
  await page.locator('[data-refresh]').click();
  await page.waitForFunction(() => document.querySelector('[data-kpi=businesses] [data-value]').textContent === '28', null, { timeout: 3000 });
  await ctx.close();
});

test('first load fails → a retry screen instead of a blank page; garbage from the server is not rendered', async () => {
  await control(base, { faults: { ops_overview: { mode: 'error', times: 1 } } });
  const { page, ctx } = await open(browser, base);
  await signIn(page);
  await page.getByText('Could not load the data.').waitFor();
  await control(base, { faults: { ops_overview: { mode: 'garbage', times: 1 } } });
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.getByText('The server sent an empty answer.').waitFor();
  await page.getByRole('button', { name: 'Try again' }).click();
  await page.locator('[data-tiles]').waitFor();
  await ctx.close();
});

test('deep link to a business that does not exist', async () => {
  const { page, ctx } = await staffIn();
  await page.evaluate(() => { location.hash = '#/businesses/nope'; });
  await page.getByText('This business is not in the list any more.').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('[data-table=businesses]').waitFor();
  await page.getByText('This business is not in the list any more.').waitFor({ state: 'detached' });
  await ctx.close();
});

test('config.js missing or broken → a plain message, no crash', async () => {
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  await page.route('**/config.js', (r) => r.fulfill({ status: 404, body: 'not found' }));
  await page.goto(`${base}/projects/menus/ops/`);
  await page.getByText('config.js did not load').waitFor();
  assert.equal(await page.getByLabel('Password').count(), 0);
  await page.unroute('**/config.js');
  await page.route('**/config.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.HALOM_MENUS_CONFIG = { supabaseUrl: "javascript:alert(1)", supabaseKey: "x" };' }));
  await page.reload();
  await page.getByText('config.js has no usable supabaseUrl.').waitFor();
  await ctx.close();
});
