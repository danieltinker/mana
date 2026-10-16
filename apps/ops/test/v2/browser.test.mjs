// The v2 command center in Chromium against the stub (test/v2/stub.mjs: the typed fake over HTTP, synthetic venues),
// at a desk (1440×900) and on a phone (390×844). What the screens do with the contract's answers: the gate, the
// clients list, a venue (onboarding, timeline, approve, act for owner, cases, admins), analytics, leads, failures.
// The same flows against the real schema run on the simulator's stack in e2e/ops.test.mjs.
import test, { before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStub, ACCOUNTS } from './stub.mjs';
import { createStub as createV1Stub } from '../stub.mjs';
import { launch, open, signIn, shot, closeAll, until, DESKTOP, PHONE } from '../helpers.mjs';
import { ID } from '@mana/contracts/fixtures';
import { VENUE } from './fake.ts';

let stub, base, browser;
before(async () => { stub = createStub(); base = `http://127.0.0.1:${await stub.listen(Number(process.env.OPS_V2_TEST_PORT) || 0)}`; browser = await launch(); });
after(async () => { await browser.close(); await stub.close(); });
beforeEach(() => stub.reset());
afterEach(() => closeAll());

const calls = (fn) => stub.world.calls.filter((c) => c.fn === fn);
const control = (body) => fetch(base + '/__stub/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
const clean = (problems) => assert.deepEqual(problems.filter((p) => !/the server responded with a status of (400|403|404)/.test(p)), [], 'no page errors');
const noSideScroll = async (page) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the page does not scroll sideways');
const noHtmlFromData = async (page) => {
  assert.equal(await page.locator('img[src="x"]').count(), 0, 'text from data is never HTML');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
};
async function staff(who = ACCOUNTS.admin, opts = {}) {
  const s = await open(browser, base, { prefix: '/mana', ...opts });
  await signIn(s.page, who);
  await s.page.locator('[data-page=clients] [data-totals]').waitFor();
  return s;
}
async function toVenue(page, slug) {
  await page.locator(`[data-venue=${slug}] [data-open]`).first().click();
  await page.locator(`[data-page=venue][data-venue=${slug}] [data-panel=timeline]`).waitFor();
}
/** Fills the reason, reviews, checks the sentence, runs. */
async function write(scope, reason, what) {
  await scope.locator('[data-reason]').fill(reason);
  await scope.locator('[data-review]').click();
  if (what) assert.match(await scope.locator('[data-what]').innerText(), what);
  await scope.locator('[data-go]').click();
  await scope.locator('[data-write-result]').waitFor();
}

// ------------------------------------------------------------------ the entry point and the gate

test('production config (no schema field): the v1 back office, and the v2 bundle is never fetched', async () => {
  const v1 = createV1Stub();
  const port = await v1.listen(0);
  const ctx = await browser.newContext({ viewport: DESKTOP });
  const page = await ctx.newPage();
  const fetched = [];
  page.on('request', (r) => fetched.push(new URL(r.url()).pathname));
  await page.goto(`http://127.0.0.1:${port}/mana/ops/`);
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  assert.match(await page.locator('.gate-card').innerText(), /use the same account as in the owner app/i, 'v1’s sign-in');
  assert.deepEqual(fetched.filter((p) => /v2\.(js|css)$/.test(p)), []);
  await ctx.close();
  await v1.close();
});

for (const [tag, viewport] of [['desk', DESKTOP], ['phone', PHONE]]) {
  test(`gate (${tag}): an account that is not staff gets a plain screen, and no staff data is asked for`, async () => {
    const { page, problems } = await open(browser, base, { prefix: '/mana', viewport });
    await page.getByRole('heading', { name: 'Sign in' }).waitFor();
    assert.equal(await page.locator('link[href$="v2.css"]').count(), 1, 'schema 2: the v2 bundle runs');
    await signIn(page, ACCOUNTS.owner);
    await page.locator('[data-not-staff]').waitFor();
    assert.equal(await page.locator('[data-not-staff]').innerText(), 'Not Halom staff');
    assert.equal(calls('ops_venues').length, 0, 'no staff RPC is even called');
    assert.equal(await page.locator('nav, [data-page]').count(), 0);
    await shot(page, `v2-gate-not-staff-${tag}`);
    await page.getByRole('button', { name: 'Sign out' }).click();
    await page.getByRole('heading', { name: 'Sign in' }).waitFor();
    clean(problems);
  });
}

test('gate: a staff row whose password-only session the database refuses (MFA required) is told why', async () => {
  await control({ requireAal2: true });
  const { page } = await open(browser, base, { prefix: '/mana' });
  await signIn(page, ACCOUNTS.support);
  await page.locator('[data-refused=aal1]').waitFor();
  assert.equal(await page.locator('[data-not-staff]').innerText(), 'Not accepted as staff');
  assert.match(await page.locator('[data-refused]').innerText(), /password only \(aal1\).*second step \(MFA\)/s);
  assert.equal(await page.locator('[data-page]').count(), 0, 'nothing of the back office is shown');
  await shot(page, 'v2-gate-aal1-desk');
});

test('gate: staff access removed mid-session drops to the refused screen with the data gone', async () => {
  const { page } = await staff(ACCOUNTS.support);
  await control({ revokeStaff: ACCOUNTS.support.id });
  await page.locator('[data-refresh]').click();
  await page.locator('[data-refused]').waitFor();
  assert.equal(await page.locator('[data-page]').count(), 0);
});

// ------------------------------------------------------------------ clients

test('clients (desk): every venue with its warnings as chips, demo labelled; search and filters run in the database', async () => {
  const { page, problems } = await staff();
  const rows = page.locator('[data-table=clients] tbody tr');
  assert.equal(await rows.count(), 3);
  assert.equal(await page.locator('[data-venue=cafe-demo] [data-demo]').count(), 1);
  assert.equal(await page.locator('[data-venue=bistro-sim] [data-demo]').count(), 0);
  assert.deepEqual(await page.locator('[data-venue=pita-lab] [data-warning]').evaluateAll((els) => els.map((e) => e.dataset.warning)),
    ['stuck_step_2d', 'not_published_2d', 'import_failed', 'case_open', 'case_waiting'], 'in the contract’s order');
  assert.match(await page.locator('[data-venue=pita-lab] [data-warning=import_failed]').innerText(), /Import failed/);
  assert.equal(await page.locator('[data-kpi=venues] .tile-value').innerText(), '2', 'real venues only');
  await shot(page, 'v2-clients-desk');
  await page.locator('[data-search]').fill('bistro');
  await until(() => rows.count(), 1, 'search');
  assert.deepEqual(calls('ops_venues').at(-1).args.p_filters, { q: 'bistro', demo: 'include', sort: 'created', limit: 100 });
  await page.locator('[data-clear]').click();
  await page.locator('[data-filter=warning]').selectOption('import_failed');
  await until(() => rows.count(), 1, 'warning filter');
  assert.equal(calls('ops_venues').at(-1).args.p_filters.warning, 'import_failed');
  await page.locator('[data-filter=warning]').selectOption('');
  await page.locator('[data-filter=demo]').selectOption('exclude');
  await until(() => page.locator('[data-venue=cafe-demo]').count(), 0, 'demo excluded');
  await noSideScroll(page);
  await noHtmlFromData(page);
  clean(problems);
});

test('clients (phone): cards, chips and the same filters, no sideways scroll', async () => {
  const { page, problems } = await staff(ACCOUNTS.admin, { viewport: PHONE });
  await page.locator('[data-cards=clients] [data-venue=cafe-demo]').waitFor();
  assert.equal(await page.locator('[data-cards=clients] > li').count(), 3);
  assert.equal(await page.locator('[data-cards=clients] [data-venue=cafe-demo] [data-demo]').count(), 1);
  await noSideScroll(page);
  await shot(page, 'v2-clients-phone');
  clean(problems);
});

// ------------------------------------------------------------------ a venue

for (const [tag, viewport] of [['desk', DESKTOP], ['phone', PHONE]]) {
  test(`venue (${tag}): follow Café Demo's onboarding, approve its first publish, restore a dish for the owner; the timeline shows both`, async () => {
    const { page, problems } = await staff(ACCOUNTS.support, { viewport });
    await toVenue(page, 'cafe-demo');
    assert.match(await page.locator('[data-onboarding-summary]').innerText(), /4 of 9 steps done · next: Photos/);
    assert.equal(await page.locator('[data-step=photos]').getAttribute('data-state'), 'blocked');
    assert.match(await page.locator('[data-guests-unavailable]').innerText(), /menu not available.*waits for Halom’s approval/);
    await shot(page, `v2-venue-before-${tag}`);

    // the timeline's strands
    await page.locator('[data-strand=import]').click();
    assert.deepEqual([...new Set(await page.locator('[data-panel=timeline] [data-entry]').evaluateAll((els) => els.map((e) => e.dataset.kind)))], ['import']);
    await page.locator('[data-strand=all]').click();

    // the menu to approve: the newest stored revision, compared with the one before; each read is in the timeline
    const rev = page.locator('[data-panel=revision] [data-revision="2"]');
    await rev.waitFor();
    assert.deepEqual(calls('ops_revision').map((c) => c.args), [{ p_venue: VENUE.demo, p_revision: null }, { p_venue: VENUE.demo, p_revision: 1 }]);
    const diff = await page.locator('[data-panel=revision] [data-diff]').innerText();
    assert.match(diff, /Since revision 1/);
    assert.match(diff, /1 dish added: Lemonade/);
    assert.match(diff, /1 price changed: Burger ₪66 → ₪68/);
    assert.equal(await rev.locator(`[data-id="${ID.lemonade}"] [data-badge=new]`).count(), 1);
    await page.locator('[data-panel=timeline] [data-action="menu.read"]').first().waitFor();
    assert.match(await page.locator('[data-panel=timeline] [data-action="menu.read"]').first().innerText(), /Halom read a stored menu/);
    await shot(page, `v2-revision-${tag}`, { fullPage: false });

    // approve: a reason first, then what it will do, then the call
    const approve = page.locator('[data-write=approve]');
    await approve.locator('[data-review]').click();
    assert.match(await approve.locator('[data-write-error]').innerText(), /reason of 3 to 500 characters/);
    assert.equal(calls('ops_approve_venue').length, 0);
    await approve.locator('[data-reason]').fill('Menu checked with the owner by phone');
    await approve.locator('[data-review]').click();
    assert.match(await approve.locator('[data-what]').innerText(), /Approve Café Demo’s first publish \(revision 2\)/);
    await approve.locator('[data-go]').click();
    await page.locator('[data-badge=review-approved]').waitFor();
    assert.deepEqual(calls('ops_approve_venue')[0].args, { p_venue: VENUE.demo, p_reason: 'Menu checked with the owner by phone' });
    const approved = page.locator('[data-panel=timeline] [data-action="venue.approve"]').first();
    assert.match(await approved.innerText(), /Halom \(you\)|Halom/);
    assert.match(await approved.locator('[data-reason-shown]').innerText(), /Menu checked with the owner by phone/);

    // guests see the menu now; the espresso is off; restore it for the owner from there
    const espresso = page.locator(`[data-menu-row=dish][data-id="${ID.espresso}"]`);
    await espresso.waitFor();
    assert.equal(await espresso.getAttribute('data-off'), 'yes');
    await espresso.locator('[data-restore]').click();
    const act = page.locator('[data-write=act]');
    await until(() => act.locator('[data-act-action]').inputValue(), 'availability.restore', 'the form opens on that action');
    await until(() => act.locator('[data-act-target]').inputValue(), `dish:${ID.espresso}`, 'and that dish');
    await act.locator('[data-reason]').fill('Owner asked by phone: the machine works again');
    await act.locator('[data-review]').click();
    assert.match(await act.locator('[data-what]').innerText(), /Bring “Espresso” \(dish\) back on Café Demo’s menu now/);
    await shot(page, `v2-act-review-${tag}`, { fullPage: false });
    await act.locator('[data-go]').click();
    await act.locator('[data-write-result]').waitFor();
    assert.deepEqual(calls('act_for_owner')[0].args, { p_venue: VENUE.demo, p_reason: 'Owner asked by phone: the machine works again',
      p_action: 'availability.restore', p_payload: { targetKind: 'dish', targetId: ID.espresso } });
    await until(() => espresso.getAttribute('data-off'), 'no', 'back on the menu');
    const acted = page.locator('[data-panel=timeline] [data-action="support.act_for_owner"]').first();
    assert.match(await acted.innerText(), /Halom acted for the owner/);
    assert.match(await acted.locator('[data-badge=halom]').innerText(), /acting for the owner/);
    assert.match(await acted.locator('[data-reason-shown]').innerText(), /the machine works again/);
    assert.match(await page.locator('[data-panel=timeline] [data-action="availability_overrides.update"]').first().innerText(), /Brought back/);
    assert.equal(calls('ops_revision').length, 2, 'stored revisions are read when asked, not by the refreshes (each read is logged)');
    await shot(page, `v2-venue-after-${tag}`);
    await noSideScroll(page);
    await noHtmlFromData(page);
    clean(problems);
  });
}

test('act for owner: closed when the owner’s switch is off, and refused plainly when it went off after the page loaded', async () => {
  const { page } = await staff(ACCOUNTS.support);
  await toVenue(page, 'pita-lab');
  assert.match(await page.locator('[data-write=act][data-blocked]').innerText(), /turned off Halom acting for them/);
  assert.equal(await page.locator('[data-write=act] [data-review]').count(), 0);
  await page.locator('[data-tab=clients]').click();
  await toVenue(page, 'cafe-demo');
  // the page has loaded everything it loads on its own (the menu to approve, then the refresh that shows that read)
  await page.locator('[data-panel=timeline] [data-action="menu.read"]').first().waitFor();
  await control({ supportCanAct: { venueId: VENUE.demo, value: false } });
  const act = page.locator('[data-write=act]');
  await act.locator('[data-act-action]').selectOption('menu.publish');
  await act.locator('[data-reason]').fill('Publishing the fixed prices for the owner');
  await act.locator('[data-review]').click();
  await act.locator('[data-go]').click();
  assert.match(await act.locator('[data-write-error]').innerText(), /Not done: The owner has turned off Halom acting for them .* Nothing was changed\./);
  assert.equal(await page.locator('[data-panel=timeline] [data-action="support.act_for_owner"]').count(), 0);
});

test('cases: change a case with a reason; its words are shown as text', async () => {
  const { page } = await staff(ACCOUNTS.support);
  await toVenue(page, 'cafe-demo');
  const c = page.locator('[data-panel=cases] [data-case]').first();
  assert.match(await c.locator('[data-case-body]').innerText(), /<img src=x/);
  await c.locator('summary').click();
  await c.locator('[data-case-status]').selectOption('waiting_owner');
  await write(c, 'Asked the owner for the drinks photos', /Set the case to waiting for the owner/);
  await until(() => c.getAttribute('data-status'), 'waiting_owner', 'status');
  assert.deepEqual(calls('ops_update_case')[0].args.p_status, 'waiting_owner');
  await noHtmlFromData(page);
});

test('admins only: support reads the plan and the demo label; an admin changes the demo label', async () => {
  const s = await staff(ACCOUNTS.support);
  await toVenue(s.page, 'cafe-demo');
  await s.page.locator('[data-admin-only]').waitFor();
  assert.equal(await s.page.locator('[data-write=demo], [data-write=plan]').count(), 0);
  await s.ctx.close();
  const { page } = await staff(ACCOUNTS.admin);
  await toVenue(page, 'cafe-demo');
  await write(page.locator('[data-write=demo]'), 'Café Demo stays a demo, testing the switch', /Mark Café Demo as a real venue/);
  await until(() => page.locator('[data-demo-now]').innerText(), 'a real venue', 'label');
  assert.deepEqual(calls('ops_set_demo')[0].args, { p_venue: VENUE.demo, p_demo: false, p_reason: 'Café Demo stays a demo, testing the switch' });
});

// ------------------------------------------------------------------ analytics

test('analytics: real traffic by default, demo when asked; new guest events appear on the next poll; honest empty states', async () => {
  const { page, problems } = await staff(ACCOUNTS.support, { init: { __OPS_POLL_MS: 1500 } });
  await page.locator('[data-tab=analytics]').click();
  await page.locator('[data-range="1h"]').click();
  const opens = page.locator('[data-kpi=menu_opened] .tile-value');
  await until(async () => calls('ops_analytics').at(-1)?.args.p_query.resolution, 'minute', 'the hour asks for minutes');
  await page.locator('[data-chart=menu_opened]', { hasText: 'last hour, per minute' }).waitFor();
  const real = Number((await opens.innerText()).replace(/,/g, ''));
  await page.locator('[data-filter=venue]').selectOption(VENUE.demo);
  await page.getByText('is a demo venue: its guests are demo traffic').waitFor();
  await until(() => opens.innerText(), '0', 'a demo venue, demo excluded');
  await page.locator('[data-filter=demo]').selectOption('include');
  await until(async () => Number(await opens.innerText()) > 0, true, 'demo included');
  assert.equal(calls('ops_analytics').at(-1).args.p_query.demo, 'include');
  await page.locator('[data-filter=venue]').selectOption('');
  await page.locator('[data-filter=demo]').selectOption('exclude');
  await until(async () => Number((await opens.innerText()).replace(/,/g, '')), real, 'back to real traffic');
  await control({ traffic: { venueId: VENUE.bistro, counts: { menu_opened: 7 } } });
  await until(async () => Number((await opens.innerText()).replace(/,/g, '')), real + 7, 'the next poll shows the new opens', 8000);
  assert.match(await page.locator('[data-chart=menu_opened]').innerText(), /opens per minute/, 'the axis is labelled');
  await shot(page, 'v2-analytics-desk');
  await control({ reset: { traffic: false } });
  await page.locator('[data-refresh]').click();
  await until(() => page.locator('[data-chart] [data-empty]').count(), 6, 'every chart says it has nothing');
  assert.match(await page.locator('[data-chart=menu_opened] [data-empty]').innerText(), /No traffic yet in this range/);
  await noSideScroll(page);
  clean(problems);
});

test('analytics (phone): one column, no sideways scroll', async () => {
  const { page } = await staff(ACCOUNTS.support, { viewport: PHONE });
  await page.locator('[data-tab=analytics]').click();
  await page.locator('[data-analytics-totals]').waitFor();
  await noSideScroll(page);
  await shot(page, 'v2-analytics-phone');
});

// ------------------------------------------------------------------ leads, failures

test('leads: loaded once (each read is logged), an edit says what it will save first', async () => {
  const { page, problems } = await staff(ACCOUNTS.support);
  await page.locator('[data-tab=leads]').click();
  const lead = page.locator('[data-lead="MN-2026-0001"]');
  await lead.waitFor();
  const reads = calls('ops_leads').length;
  await page.waitForTimeout(500);
  assert.equal(calls('ops_leads').length, reads, 'no polling of personal data');
  await lead.locator('[data-edit]').click();
  await lead.locator('[data-lead-status]').selectOption('contacted');
  await lead.locator('[data-lead-owner]').fill('Halom team');
  await lead.locator('[data-review]').click();
  assert.match(await lead.locator('[data-what]').innerText(), /status New → Contacted, owner “Halom team”/);
  await lead.locator('[data-go]').click();
  await lead.locator('[data-write-result]').waitFor();
  assert.deepEqual(calls('ops_update_lead')[0].args, { p_id: stub.world.leads[0].id, p_status: 'contacted', p_owner: 'Halom team', p_notes: null });
  await noHtmlFromData(page);
  await shot(page, 'v2-leads-desk');
  clean(problems);
});

test('an older database without ops_venues: the page says so instead of breaking', async () => {
  await control({ faults: { ops_venues: { mode: 'missing' } } });
  const { page } = await open(browser, base, { prefix: '/mana' });
  await signIn(page, ACCOUNTS.support);
  await page.locator('[data-load-error=missing]').waitFor();
  assert.match(await page.locator('[data-load-error]').innerText(), /does not have this part of the back office yet/);
});
