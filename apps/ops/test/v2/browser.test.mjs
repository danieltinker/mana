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
  await s.page.locator('[data-page=clients] [data-count]').waitFor();
  return s;
}
const focused = (page) => page.evaluate(() => {
  const a = document.activeElement;
  return a ? (a.hasAttribute('data-reason') ? 'reason' : a.hasAttribute('data-write-done') ? 'result' : a.hasAttribute('data-confirm') ? 'review' : a.tagName) : null;
});
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

test('gate (SEC-N4): staff access removed mid-session says so (not "MFA needed"), with the data gone', async () => {
  const { page } = await staff(ACCOUNTS.support);
  await control({ revokeStaff: ACCOUNTS.support.id });
  await page.locator('[data-refresh]').click();
  await page.locator('[data-refused=removed]').waitFor();
  assert.equal(await page.locator('[data-not-staff]').innerText(), 'Staff access removed');
  assert.match(await page.locator('[data-refused]').innerText(), /no longer on Halom’s staff: its staff access was removed/);
  assert.doesNotMatch(await page.locator('[data-refused]').innerText(), /MFA/);
  assert.equal(await page.locator('[data-page]').count(), 0);
});

test('leads (SEC-N4): access is checked again when the page is looked at again, and before a lead is changed', async () => {
  const { page } = await staff(ACCOUNTS.support);
  await page.locator('[data-tab=leads]').click();
  await page.locator('[data-lead="MN-2026-0001"]').waitFor();
  await control({ revokeStaff: ACCOUNTS.support.id });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.locator('[data-refused=removed]').waitFor();
  assert.equal(await page.locator('[data-lead]').count(), 0, 'the personal data is gone from the screen');
  assert.equal(calls('ops_update_lead').length, 0);
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

test('clients (phone): cards, chips and the same filters, no sideways scroll; the first venue shows without scrolling (L8)', async () => {
  const { page, problems } = await staff(ACCOUNTS.admin, { viewport: PHONE });
  await page.locator('[data-cards=clients] [data-venue=cafe-demo]').waitFor();
  assert.equal(await page.locator('[data-cards=clients] > li').count(), 3);
  assert.equal(await page.locator('[data-cards=clients] [data-venue=cafe-demo] [data-demo]').count(), 1);
  const top = (await page.locator('[data-cards=clients] > li').first().boundingBox()).y;
  assert.ok(top < PHONE.height - 120, `the first card starts at ${Math.round(top)} px, in the first screen`);
  assert.match(await page.locator('[data-totals-line]').innerText(), /2 venues · 1 live · 1 waiting · \d+ opens today/, 'the totals in one line');
  assert.equal(await page.locator('[data-search]').isVisible(), true, 'the search stays out');
  assert.equal(await page.locator('[data-filter=warning]').isVisible(), false, 'the other filters fold away');
  await page.locator('[data-filters-fold] summary').click();
  await page.locator('[data-filter=warning]').selectOption('import_failed');
  await until(() => page.locator('[data-cards=clients] > li').count(), 1, 'the folded filters work');
  assert.match(await page.locator('[data-filters-fold] summary').innerText(), /\(1 on\)/);
  await noSideScroll(page);
  await shot(page, 'v2-clients-phone');
  clean(problems);
});

test('clients (L3, L7): the menu state in words; a poll never dims the page', async () => {
  const { page } = await staff();
  assert.equal(await page.locator('[data-venue=cafe-demo] [data-menu-state]').innerText(), 'waiting for approval · revision 2 · 5 h ago', 'published, not live');
  assert.match(await page.locator('[data-venue=bistro-sim] [data-menu-state]').innerText(), /^live · revision 4/);
  assert.equal(await page.locator('[data-venue=pita-lab] [data-menu-state]').innerText(), 'never published');
  await control({ delays: { ops_venues: 1500 } });
  await page.locator('[data-refresh]').click();
  await until(() => page.locator('[data-refresh]').isDisabled(), true, 'refreshing');
  assert.equal(await page.locator('.is-stale, .is-busy').count(), 0, 'nothing dims');
  assert.equal(await page.locator('[data-table=clients] tbody tr').count(), 3, 'the last answer stays on screen while it refreshes');
  await until(() => page.locator('[data-refresh]').isDisabled(), false, 'refreshed', 6000);
  assert.deepEqual(await page.evaluate(() => {
    const probe = (c) => { const s = document.createElement('span'); s.style.color = c; document.body.append(s); const v = getComputedStyle(s).color; s.remove(); return v; };
    const zero = getComputedStyle(document.querySelector('.v2 .zero')).color;
    return [zero === probe('var(--muted)'), zero === probe('var(--faint)')];
  }), [true, false], 'the "none" placeholder is muted text, not the faint one');
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
    assert.deepEqual(calls('ops_revision').map((c) => c.args), [{ p_venue: VENUE.demo, p_revision: 2 }, { p_venue: VENUE.demo, p_revision: 1 }],
      'the published revision (the one approved), then the one before');
    assert.match(await rev.locator('[data-badge=guests-see]').innerText(), /published: guests see this once you approve/);
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
    assert.match(await approve.locator('[data-what]').innerText(), /Approve Café Demo’s first publish \(revision 2, the published one\): guests see that revision at once/);
    await until(() => focused(page), 'review', 'the review gets the focus (after the render, as an effect)');
    await approve.locator('[data-go]').click();
    await page.locator('[data-badge=review-approved]').waitFor();
    assert.deepEqual(calls('ops_approve_venue')[0].args, { p_venue: VENUE.demo, p_reason: 'Menu checked with the owner by phone', p_expected_revision: 2 });
    assert.match(await page.locator('[data-panel=approved] [data-write-result]').innerText(), /Approved\. Guests can open the menu now; the trial runs until \d+ \w{3} \d{4}\./);
    await until(() => focused(page), 'result', 'the result gets the focus (L5)');
    assert.match(await page.locator('[data-badge=menu-live]').innerText(), /Menu live · revision 2/);
    await page.locator('[data-panel=guests] [data-menu-view]').waitFor();
    assert.match(await page.locator('[data-panel=guests]').innerText(), /Revision 2, published/, 'guests get the revision approved');
    const approved = page.locator('[data-panel=timeline] [data-action="venue.approve"]').first();
    assert.match(await approved.innerText(), /Halom \(you\)|Halom/);
    assert.match(await approved.locator('[data-reason-shown]').innerText(), /Menu checked with the owner by phone/);
    const audit = page.locator('[data-panel=timeline] [data-action="venues.update"]').first();
    assert.match(await audit.locator('[data-reason-shown][data-paired=yes]').innerText(), /Reason \(of the same action\): “Menu checked with the owner by phone”/,
      'the audit row of the same call shows the reason (L4)');

    // guests see the menu now; the espresso is off; restore it for the owner from there
    const espresso = page.locator(`[data-menu-row=dish][data-id="${ID.espresso}"]`);
    await espresso.waitFor();
    assert.equal(await espresso.getAttribute('data-off'), 'yes');
    await espresso.locator('[data-restore]').click();
    const act = page.locator('[data-write=act]');
    await until(() => act.locator('[data-act-action]').inputValue(), 'availability.restore', 'the form opens on that action');
    await until(() => act.locator('[data-act-target]').inputValue(), `dish:${ID.espresso}`, 'and that dish');
    await until(() => focused(page), 'reason', 'with the focus on the reason (L5)');
    await act.locator('[data-reason]').fill('Owner asked by phone: the machine works again');
    await act.locator('[data-review]').click();
    assert.match(await act.locator('[data-what]').innerText(), /Bring “Espresso” \(dish\) back on Café Demo’s menu now/);
    await shot(page, `v2-act-review-${tag}`, { fullPage: false });
    await act.locator('[data-go]').click();
    await act.locator('[data-write-result]').waitFor();
    await until(() => focused(page), 'result', 'the result gets the focus (L5)');
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
  assert.equal(await act.locator('[data-act-action] option[value="menu.publish"]').count(), 0, 'publishing is not offered: staff help through approval');
  await act.locator('[data-act-action]').selectOption('support_case.update');
  await act.locator('[data-reason]').fill('Answered the owner about the photos');
  await act.locator('[data-review]').click();
  await act.locator('[data-go]').click();
  assert.match(await act.locator('[data-write-error]').innerText(), /Not done: The owner has turned off Halom acting for them .* Nothing was changed\./);
  assert.equal(await page.locator('[data-panel=timeline] [data-action="support.act_for_owner"]').count(), 0);
});

test('act for owner (H1): Go sends what was reviewed; a "Restore…" click during the review drops it and sends nothing', async () => {
  await control({ approve: VENUE.demo });
  const { page, problems } = await staff(ACCOUNTS.support);
  await toVenue(page, 'cafe-demo');
  const act = page.locator('[data-write=act]');
  await act.locator('[data-act-action]').selectOption('availability.set');
  await act.locator('[data-act-target]').selectOption(`dish:${ID.burger}`);
  await act.locator('[data-reason]').fill('The grill is down for an hour');
  await act.locator('[data-review]').click();
  assert.match(await act.locator('[data-what]').innerText(), /Take “Burger” \(dish\) off Café Demo’s menu, for 2 hours/);
  // while that review is open, Restore… on another dish
  await page.locator(`[data-menu-row=dish][data-id="${ID.espresso}"] [data-restore]`).click();
  await act.locator('[data-write-dropped]').waitFor();
  assert.match(await act.locator('[data-write-dropped]').innerText(), /You chose “Restore…” on “Espresso” while reviewing another change\. Nothing was sent/);
  assert.equal(await act.locator('[data-confirm], [data-go]').count(), 0, 'no Go for a review that no longer matches the form');
  assert.equal(calls('act_for_owner').length, 0);
  assert.equal(await act.locator('[data-act-action]').inputValue(), 'availability.restore');
  assert.equal(await act.locator('[data-act-target]').inputValue(), `dish:${ID.espresso}`);
  await until(() => focused(page), 'reason', 'the reason field, to go on');
  assert.equal(await act.locator('[data-reason]').inputValue(), 'The grill is down for an hour', 'the reason typed is kept');
  await act.locator('[data-reason]').fill('Owner asked by phone: the machine works again');
  await act.locator('[data-review]').click();
  assert.match(await act.locator('[data-what]').innerText(), /Bring “Espresso” \(dish\) back/);
  await act.locator('[data-go]').click();
  await act.locator('[data-write-result]').waitFor();
  assert.deepEqual(calls('act_for_owner').map((c) => [c.args.p_action, c.args.p_payload]), [['availability.restore', { targetKind: 'dish', targetId: ID.espresso }]],
    'exactly the reviewed input, once');
  clean(problems);
});

test('approve (H2): only the revision reviewed; a newer publish is refused by the database, or drops the open review', async () => {
  const { page, problems } = await staff(ACCOUNTS.support);
  await toVenue(page, 'cafe-demo');
  await page.locator('[data-panel=revision] [data-revision="2"]').waitFor();
  await page.locator('[data-panel=timeline] [data-action="menu.read"]').first().waitFor();
  const approve = page.locator('[data-write=approve]');
  await approve.locator('[data-reason]').fill('Menu checked with the owner by phone');
  await approve.locator('[data-review]').click();
  assert.match(await approve.locator('[data-what]').innerText(), /\(revision 2, the published one\)/);
  await control({ publish: VENUE.demo });                        // the owner publishes revision 3 before Halom clicks Approve
  await approve.locator('[data-go]').click();
  await approve.locator('[data-write-error]').waitFor();
  assert.match(await approve.locator('[data-write-error]').innerText(),
    /Not done: The owner’s published revision changed since your review\. Nothing was approved: read it and review again\. The published one is revision 3 now\./);
  assert.deepEqual(calls('ops_approve_venue').map((c) => c.args.p_expected_revision), [2]);
  assert.equal(await approve.locator('[data-review]').count(), 1, 'back to the fields');
  await page.locator('[data-panel=revision] [data-revision="3"]').waitFor();   // the page refreshed and read the new menu
  assert.equal(await page.locator('[data-badge=review-pending]').count(), 1, 'still waiting');
  await approve.locator('[data-review]').click();
  assert.match(await approve.locator('[data-what]').innerText(), /\(revision 3, the published one\)/);
  await control({ publish: VENUE.demo });                        // and again, while this review is open
  await page.locator('[data-refresh]').click();
  await approve.locator('[data-write-dropped]').waitFor();
  assert.match(await approve.locator('[data-write-dropped]').innerText(), /The owner’s published menu is now revision 4: it changed while you were reviewing\. Nothing was approved/);
  assert.equal(calls('ops_approve_venue').length, 1, 'nothing sent');
  await page.locator('[data-panel=revision] [data-revision="4"]').waitFor();
  await approve.locator('[data-review]').click();
  assert.match(await approve.locator('[data-what]').innerText(), /\(revision 4, the published one\)/);
  await approve.locator('[data-go]').click();
  // the approval panel gives way to its result once the venue is approved
  await page.locator('[data-panel=approved] [data-write-result]').waitFor();
  assert.deepEqual(calls('ops_approve_venue').map((c) => c.args.p_expected_revision), [2, 4]);
  await page.locator('[data-badge=review-approved]').waitFor();
  clean(problems);
});

test('approve: after a restore, the menu to approve and the approval are the published revision, not the newest; the panel says which guests will see', async () => {
  await control({ publish: VENUE.demo });                         // revision 3 ...
  await control({ restore: { venueId: VENUE.demo, revision: 2 } }); // ... then the owner goes back to revision 2
  const { page, problems } = await staff(ACCOUNTS.support);
  await toVenue(page, 'cafe-demo');
  const panel = page.locator('[data-panel=revision]');
  await panel.locator('[data-revision="2"]').waitFor();
  assert.equal(calls('ops_revision')[0].args.p_revision, 2, 'the published one by default');
  assert.match(await panel.locator('.panel-head').innerText(), /Revision 2, the published one.*what guests will see once you approve, and the revision the approval names/s);
  assert.match(await panel.locator('[data-badge=guests-see]').innerText(), /published: guests see this once you approve/);
  // the newest stored revision is there to read, labelled as not what guests will see
  await panel.locator('[data-revision-pick]').selectOption('newest');
  await panel.locator('[data-revision="3"]').waitFor();
  assert.match(await panel.locator('[data-not-published]').innerText(), /Guests will see revision 2 once you approve, not this one/);
  assert.equal(await panel.locator('[data-badge=guests-see]').count(), 0);
  await panel.locator('[data-revision-compare]').selectOption('2');
  await until(() => panel.locator('[data-diff]').evaluate((el) => el.textContent.includes('(the published one)')), true, 'the comparison names the published revision');
  const approve = page.locator('[data-write=approve]');
  await approve.locator('[data-reason]').fill('Menu checked with the owner by phone');
  // SEC-N11: the approval names the revision on screen; revision 3 is not the published one, so it is refused
  await approve.locator('[data-review]').click();
  assert.match(await approve.locator('[data-write-error]').innerText(),
    /The menu on screen is revision 3, but the published one, which guests would see, is revision 2\. Read revision 2 below/);
  assert.equal(calls('ops_approve_venue').length, 0);
  const reads = calls('ops_revision').length;
  await panel.locator('[data-revision-pick]').selectOption('published');
  await panel.locator('[data-revision="2"]').waitFor();
  assert.equal(calls('ops_revision').length, reads, 'revision 2 was read already on this page: not read (and logged) again');
  await approve.locator('[data-review]').click();
  assert.match(await approve.locator('[data-what]').innerText(), /\(revision 2, the published one\): guests see that revision at once/);
  await approve.locator('[data-go]').click();
  await page.locator('[data-panel=approved] [data-write-result]').waitFor();
  assert.deepEqual(calls('ops_approve_venue').map((c) => c.args.p_expected_revision), [2]);
  clean(problems);
});

test('plan (M1): a venue waiting for approval says a plan does not approve it, and the form refuses a running plan', async () => {
  const { page } = await staff(ACCOUNTS.admin);
  await toVenue(page, 'cafe-demo');
  assert.match(await page.locator('[data-approval-first]').innerText(), /A plan does not approve it: approve it above/);
  const plan = page.locator('[data-write=plan]');
  await plan.locator('[data-plan-state]').selectOption('trialing');
  await plan.locator('[data-reason]').fill('Starting the pilot early');
  await plan.locator('[data-review]').click();
  assert.match(await plan.locator('[data-write-error]').innerText(), /A plan does not approve a venue: approve its first publish first/);
  assert.equal(calls('ops_set_plan').length, 0);
  await plan.locator('[data-plan-state]').selectOption('active');
  await plan.locator('[data-review]').click();
  assert.equal(await plan.locator('[data-go]').count(), 0);
  assert.equal(calls('ops_set_plan').length, 0);
});

test('act for owner (M4): a dish change starts from the owner\'s dish now; a change by the owner since is refused with what it is now', async () => {
  await control({ approve: VENUE.demo });
  const { page, problems } = await staff(ACCOUNTS.support);
  await toVenue(page, 'cafe-demo');
  const act = page.locator('[data-write=act]');
  await act.locator('[data-act-action]').selectOption('dish.update');
  await act.locator('[data-act-dish]').selectOption(ID.burger);
  await act.locator('[data-act-price]').fill('70');
  await act.locator('[data-reason]').fill('Owner asked by phone for the new price');
  await act.locator('[data-review]').click();
  assert.match(await act.locator('[data-what]').innerText(),
    /Change the price of “Burger” from ₪72 \(the owner’s price now; guests see ₪68 until the next publish\) to ₪70\./);
  assert.equal(calls('dishes').length, 1, 'read at the review');
  const seen = stub.world.venues[0].dishes.find((d) => d.id === ID.burger).updated_at;
  await control({ ownerEdit: { dishId: ID.burger, patch: { price: 7400 } } });   // the owner changes it meanwhile
  await act.locator('[data-go]').click();
  await act.locator('[data-write-error]').waitFor();
  assert.match(await act.locator('[data-write-error]').innerText(),
    /Not done: This changed since your review\. Nothing was changed: review it again\. Now the price in the owner’s menu is ₪74 and it is shown to guests\./);
  assert.deepEqual(calls('act_for_owner')[0].args.p_payload, { dishId: ID.burger, patch: { price: 7000 }, expectedUpdatedAt: seen });
  assert.equal(await act.locator('[data-review]').count(), 1, 'back to the fields');
  await act.locator('[data-review]').click();
  assert.match(await act.locator('[data-what]').innerText(), /from ₪74 \(the owner’s price now; guests see ₪68 until the next publish\) to ₪70/);
  await act.locator('[data-go]').click();
  await act.locator('[data-write-result]').waitFor();
  const now = calls('act_for_owner')[1].args.p_payload.expectedUpdatedAt;
  assert.notEqual(now, seen);
  assert.equal(stub.world.venues[0].dishes.find((d) => d.id === ID.burger).price, 7000);
  assert.match(await page.locator(`[data-menu-row=dish][data-id="${ID.burger}"]`).innerText(), /₪68/, 'guests still see the published price');
  clean(problems);
});

test('act for owner: an onboarding step carries the updatedAt the page read; a change by the owner since is refused', async () => {
  const { page, problems } = await staff(ACCOUNTS.support);
  await toVenue(page, 'cafe-demo');
  const act = page.locator('[data-write=act]');
  await act.locator('[data-act-action]').selectOption('onboarding.set');
  await act.locator('[data-act-step]').selectOption('photos');
  await act.locator('[data-act-state]').selectOption('skipped');
  await act.locator('[data-reason]').fill('The owner will add the photos later');
  await act.locator('[data-review]').click();
  assert.match(await act.locator('[data-what]').innerText(), /Mark the onboarding step “Photos” as skipped \(it is blocked now\)\./);
  const seen = stub.world.venues[0].steps.find((s) => s.step === 'photos').updatedAt;
  await control({ ownerStep: { venueId: VENUE.demo, step: 'photos', state: 'doing' } });
  await act.locator('[data-go]').click();
  await act.locator('[data-write-error]').waitFor();
  assert.match(await act.locator('[data-write-error]').innerText(), /Not done: This changed since your review\. Nothing was changed: review it again\. Now the step is doing\./);
  assert.deepEqual(calls('act_for_owner')[0].args.p_payload, { step: 'photos', state: 'skipped', expectedUpdatedAt: seen });
  await until(() => page.locator('[data-step=photos]').getAttribute('data-state'), 'doing', 'the page refreshed');
  await act.locator('[data-review]').click();
  assert.match(await act.locator('[data-what]').innerText(), /\(it is doing now\)/);
  await act.locator('[data-go]').click();
  await act.locator('[data-write-result]').waitFor();
  await until(() => page.locator('[data-step=photos]').getAttribute('data-state'), 'skipped', 'skipped for the owner');
  clean(problems);
});

test('what the owner sees (M5): their dashboard with the venue; their menu as it is now only on request, never on a poll', async () => {
  const { page, problems } = await staff(ACCOUNTS.support, { init: { __OPS_POLL_MS: 700 } });
  await toVenue(page, 'cafe-demo');
  assert.equal(await page.locator('#guests-h').innerText(), 'What guests see');
  const owner = page.locator('[data-panel=owner]');
  assert.match(await owner.locator('[data-nudge=approval_pending]').innerText(), /The first publish waits for Halom’s approval/);
  assert.match(await owner.locator('[data-nudge=onboarding_step]').innerText(), /5 onboarding steps left/);
  assert.match(await owner.locator('[data-owner-off]').innerText(), /Espresso \(dish\) · until \d\d:\d\d/);
  assert.match(await owner.locator('[data-export]').innerText(), /Read the owner’s menu now/);
  assert.match(await owner.locator('[data-logged-reads]').innerText(), /Reading it is an export, which the owner sees in their activity log \(“Menu exported”\)/);
  const polls = calls('ops_venue').length;
  await until(() => calls('ops_venue').length >= polls + 2, true, 'two polls');
  assert.equal(calls('export_menu').length, 0, 'not read by itself');
  assert.ok(calls('my_dashboard').length >= 3, 'the dashboard comes with each refresh (it is not logged)');
  await owner.locator('[data-export]').click();
  const burger = owner.locator(`[data-owner-dish="${ID.burger}"]`);
  await burger.waitFor();
  assert.match(await burger.innerText(), /Burger.*₪72/s, 'the owner’s price, not yet published');
  assert.equal(calls('export_menu').length, 1);
  const after = calls('ops_venue').length;
  await until(() => calls('ops_venue').length >= after + 2, true, 'two more polls');
  assert.equal(calls('export_menu').length, 1, 'once, when asked');
  assert.match(await page.locator('[data-panel=timeline] [data-action="menu.export"]').first().innerText(), /Menu exported/);
  await noHtmlFromData(page);
  clean(problems);
});

test('timeline (M3): past the newest 100 entries, older pages on request', async () => {
  await control({ padLog: { venueId: VENUE.bistro, n: 130 } });
  const { page, problems } = await staff(ACCOUNTS.support);
  await toVenue(page, 'bistro-sim');
  const entries = page.locator('[data-panel=timeline] [data-entry]');
  assert.equal(await entries.count(), 100);
  assert.equal(await page.locator('[data-panel=timeline] [data-action="venue.create"]').count(), 0);
  await page.locator('[data-show-older]').click();
  await page.locator('[data-log-start]').waitFor();
  assert.equal(await entries.count(), 133);
  assert.equal(await page.locator('[data-panel=timeline] [data-action="venue.create"]').count(), 1);
  const bistro = stub.world.venues.find((v) => v.row.id === VENUE.bistro);
  assert.deepEqual(calls('venue_activity').map((c) => c.args), [{ p_venue: VENUE.bistro, p_before: bistro.activity[99].id, p_limit: 100, p_actor: null, p_via: null }],
    'the page after the oldest of the newest 100');
  assert.equal(await page.locator('[data-show-older]').count(), 0);
  clean(problems);
});

test('routes (L1, N5): an address with a malformed or non-uuid id asks nothing and says there is no such venue', async () => {
  const { page, problems } = await staff(ACCOUNTS.support);
  const before = calls('ops_venue').length;
  for (const hash of ['#/venues/%E0%A4%A', '#/venues/not-a-uuid', `#/venues/${VENUE.demo},x`]) {
    await page.evaluate((h) => { location.hash = h; }, hash);
    await page.locator('[data-no-venue]').waitFor();
    assert.match(await page.locator('[data-no-venue]').innerText(), /There is no venue at this address/);
  }
  assert.equal(calls('ops_venue').length, before, 'no call with a made-up id');
  await page.evaluate((h) => { location.hash = h; }, `#/venues/${VENUE.demo.toUpperCase()}`);
  await page.locator('[data-page=venue][data-venue=cafe-demo]').waitFor();
  assert.equal(calls('ops_venue').at(-1).args.p_venue, VENUE.demo, 'a uuid in capitals is the same venue');
  clean(problems);
});

test('accessibility (L6, L10): no live region for polls; the reason counter is not in the label, and counts characters as the database does', async () => {
  const { page } = await staff(ACCOUNTS.support);
  await toVenue(page, 'cafe-demo');
  assert.equal(await page.locator('[data-fresh][aria-live], [aria-live] [data-fresh]').count(), 0);
  const reason = page.locator('[data-write=approve] [data-reason]');
  const { label, described } = await reason.evaluate((el) => ({
    label: [...el.labels].map((l) => l.textContent).join('|'),
    described: (el.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? ''),
  }));
  assert.match(label, /^Reason \(/);
  assert.doesNotMatch(label, /left/, 'the label is the field’s name only');
  assert.deepEqual(described, ['500 left'], 'described once, by the counter');
  await reason.fill('  👍👍👍  ');
  assert.equal(await page.locator('[data-write=approve] [data-left]').innerText(), '497 left', 'three characters, the blank ends stripped');
});

test('analytics (M2): another venue starts from nothing: the last venue\'s numbers never show under the new name', async () => {
  const { page, problems } = await staff(ACCOUNTS.support);
  await page.locator('[data-tab=analytics]').click();
  await until(() => page.locator('[data-analytics-of]').innerText(), '· all venues', 'all venues');
  await control({ delays: { ops_analytics: 1500 } });
  await page.locator('[data-filter=venue]').selectOption(VENUE.bistro);
  await until(() => page.locator('[data-analytics-totals]').count(), 0, 'the old numbers go at once');
  assert.equal(await page.locator('[data-analytics-of]').count(), 0, 'no name over numbers that are not its own');
  assert.match(await page.locator('[data-page=analytics] .boot').innerText(), /Loading the analytics/);
  await until(() => page.locator('[data-analytics-of]').innerText(), '· Bistro Sim', 'the answer, with its own name', 6000);
  assert.equal(await page.locator('[data-analytics-answer]').getAttribute('data-analytics-answer'), `${VENUE.bistro}|exclude`);
  clean(problems);
});

test('cases: change a case with a reason; its words are shown as text', async () => {
  const { page } = await staff(ACCOUNTS.support);
  await toVenue(page, 'cafe-demo');
  const c = page.locator('[data-panel=cases] [data-case]').first();
  assert.match(await c.locator('[data-case-body]').innerText(), /<img src=x/);
  await c.locator('summary').click();
  await c.locator('[data-case-status]').selectOption('waiting_owner');
  await write(c, 'Asked the owner for the drinks photos', /Set the case from open to waiting for the owner\./);
  await until(() => c.getAttribute('data-status'), 'waiting_owner', 'status');
  assert.deepEqual(calls('ops_update_case')[0].args.p_status, 'waiting_owner');
  assert.equal(calls('ops_update_case')[0].args.p_expected_updated_at, stub.world.venues[0].cases[0].openedAt, 'the case’s version as read (L4)');
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

// ------------------------------------------------------------------ the fourth QA round and the security review

/** Requests give up after 3 s, and a lost write is believed not to have happened 3 s after it was lost; no polls. A slow
 * write below is applied 4.5 s after it was sent: after the page gave up, before its second look (6 s). */
const LOST = { __OPS_TIMEOUT_MS: 3000, __OPS_RETRY_GAP_MS: 3000, __OPS_POLL_MS: 600000 };
const actLog = () => stub.world.venues[0].activity.filter((e) => e.action === 'support.act_for_owner');

test('a lost answer (QA-M1): the change was made; the page says the outcome is unknown, finds the change, and never sends it twice', async () => {
  await control({ approve: VENUE.demo });
  const { page, problems } = await staff(ACCOUNTS.support, { init: LOST });
  await toVenue(page, 'cafe-demo');
  const act = page.locator('[data-write=act]');
  await act.locator('[data-act-action]').selectOption('dish.update');
  await act.locator('[data-act-dish]').selectOption(ID.burger);
  await act.locator('[data-act-price]').fill('77');
  await act.locator('[data-reason]').fill('Owner asked by phone for the new price');
  await act.locator('[data-review]').click();
  await act.locator('[data-what]').waitFor();
  await control({ delays: { act_for_owner: 4500 } });          // the database applies it after the page has given up waiting
  await act.locator('[data-go]').click();
  await act.locator('[data-write-lost]').waitFor({ timeout: 10000 });
  assert.match(await act.locator('[data-write-lost]').innerText(), /The answer did not arrive: the change may or may not have been made/);
  assert.equal(await act.locator('[data-go]').count(), 0, 'no second send while the outcome is not known');
  await act.locator('[data-write-result]').waitFor({ timeout: 15000 });
  assert.equal(await act.locator('[data-write-result]').innerText(), 'Done. The answer did not arrive, but the change is there now: it was made once.');
  await control({ delays: {} });
  assert.equal(calls('act_for_owner').length, 1, 'sent once');
  assert.equal(stub.world.venues[0].dishes.find((d) => d.id === ID.burger).price, 7700);
  assert.equal(actLog().length, 1, 'one entry in the owner’s log');
  assert.doesNotMatch(await act.innerText(), /owner changed/i, 'Halom’s own change is never put on the owner');
  clean(problems);
});

test('a lost answer (QA-M1): the change was not made; after the wait the page says so, and only then offers the same review again', async () => {
  const { page, problems } = await staff(ACCOUNTS.support, { init: LOST });
  await toVenue(page, 'cafe-demo');
  const act = page.locator('[data-write=act]');
  await act.locator('[data-act-action]').selectOption('onboarding.set');
  await act.locator('[data-act-step]').selectOption('photos');
  await act.locator('[data-act-state]').selectOption('skipped');
  await act.locator('[data-reason]').fill('The owner will add the photos later');
  await act.locator('[data-review]').click();
  await act.locator('[data-what]').waitFor();
  await control({ faults: { act_for_owner: { mode: 'timeout', times: 1 } } });   // never answers, never applies
  await act.locator('[data-go]').click();
  await act.locator('[data-write-lost=waiting]').waitFor({ timeout: 10000 });
  assert.equal(await act.locator('[data-go]').count(), 0, 'not offered while the server may still be working on it');
  await act.locator('[data-write-error]').waitFor({ timeout: 15000 });
  assert.equal(await act.locator('[data-write-error]').innerText(), 'The answer did not arrive, and the change is not there: nothing was made. You can send it again.');
  assert.equal(actLog().length, 0);
  await act.locator('[data-go]').click();
  await act.locator('[data-write-result]').waitFor();
  assert.equal(calls('act_for_owner').length, 2);
  assert.equal(actLog().length, 1, 'made once');
  await until(() => page.locator('[data-step=photos]').getAttribute('data-state'), 'skipped', 'skipped for the owner');
  clean(problems);
});

test('a lost answer on approve (QA-M1), then a second staff member approving (L4): both end as approved, never as an error', async () => {
  const A = await staff(ACCOUNTS.support, { init: LOST });
  const B = await staff(ACCOUNTS.admin, { viewport: PHONE, init: { __OPS_POLL_MS: 600000 } });
  for (const s of [A, B]) {
    await toVenue(s.page, 'cafe-demo');
    await s.page.locator('[data-panel=revision] [data-revision="2"]').waitFor();
    const ap = s.page.locator('[data-write=approve]');
    await ap.locator('[data-reason]').fill('Menu checked with the owner by phone');
    await ap.locator('[data-review]').click();
    await ap.locator('[data-what]').waitFor();
  }
  await control({ delays: { ops_approve_venue: 4500 } });
  await A.page.locator('[data-write=approve] [data-go]').click();
  await A.page.locator('[data-write=approve] [data-write-lost]').waitFor({ timeout: 10000 });
  await A.page.locator('[data-panel=approved] [data-write-result]').waitFor({ timeout: 18000 });
  assert.equal(await A.page.locator('[data-panel=approved] [data-write-result]').innerText(),
    'Approved: guests can open the menu now. (The answer did not arrive, but the venue is approved.)');
  await control({ delays: {} });
  // B's page still shows the venue waiting, with B's review open
  await B.page.locator('[data-write=approve] [data-go]').click();
  await B.page.locator('[data-panel=approved] [data-write-result]').waitFor();
  assert.equal(await B.page.locator('[data-panel=approved] [data-write-result]').innerText(),
    'Already approved (by another Halom staff member, or by a send whose answer was lost): guests can open the menu.');
  assert.equal(await B.page.locator('[data-write-error]').count(), 0);
  assert.equal(calls('ops_approve_venue').length, 2);
  assert.equal(stub.world.venues[0].activity.filter((e) => e.action === 'venue.approve').length, 1, 'approved once');
  clean(A.problems);
  clean(B.problems);
});

test('two staff on one case (L4): the second is refused with the case as it is now, never as the owner\'s doing', async () => {
  const A = await staff(ACCOUNTS.support, { init: { __OPS_POLL_MS: 600000 } });
  const B = await staff(ACCOUNTS.admin, { init: { __OPS_POLL_MS: 600000 } });
  for (const s of [A, B]) { await toVenue(s.page, 'cafe-demo'); await s.page.locator('[data-case] summary').first().click(); }
  const ca = A.page.locator('[data-case]').first(), cb = B.page.locator('[data-case]').first();
  await ca.locator('[data-case-status]').selectOption('resolved');
  await write(ca, 'Sent the owner the photo guide', /Set the case from open to resolved/);
  await cb.locator('[data-case-status]').selectOption('waiting_owner');
  await cb.locator('[data-reason]').fill('Asked the owner for the drinks photos');
  await cb.locator('[data-review]').click();
  await cb.locator('[data-go]').click();
  await cb.locator('[data-write-error]').waitFor();
  assert.equal(await cb.locator('[data-write-error]').innerText(),
    'Not done: This changed since your review. Nothing was changed: review it again. It is resolved now, under photos.');
  assert.equal(stub.world.venues[0].cases[0].status, 'resolved', 'A’s change stands');
  const [a, b] = calls('ops_update_case');
  assert.equal(typeof a.args.p_expected_updated_at, 'string');
  assert.equal(b.args.p_expected_updated_at, a.args.p_expected_updated_at, 'each sent the version it read');
  await until(() => cb.getAttribute('data-status'), 'resolved', 'B’s page shows the case as it is');
  // B tries again, from the case as it is now: accepted
  await cb.locator('[data-case-status]').selectOption('waiting_owner');
  await cb.locator('[data-reason]').fill('Asked the owner for the drinks photos');
  await cb.locator('[data-review]').click();
  assert.match(await cb.locator('[data-what]').innerText(), /Set the case from resolved to waiting for the owner/);
  await cb.locator('[data-go]').click();
  await cb.locator('[data-write-result]').waitFor();
  assert.equal(stub.world.venues[0].cases[0].status, 'waiting_owner');
});

test('a chart that starts empty draws when its first traffic arrives on a poll (QA-M2)', async () => {
  await control({ reset: { traffic: false } });
  const { page, problems } = await staff(ACCOUNTS.support, { init: { __OPS_POLL_MS: 1000 } });
  await page.locator('[data-tab=analytics]').click();
  await page.locator('[data-range="1h"]').click();
  await page.locator('[data-chart=menu_opened] [data-empty]').waitFor();
  assert.equal(await page.locator('[data-chart=menu_opened] svg').count(), 0);
  await control({ traffic: { venueId: VENUE.bistro, counts: { menu_opened: 5 } } });
  await page.locator('[data-chart=menu_opened] svg').waitFor({ timeout: 8000 });
  assert.ok(await page.locator('[data-chart=menu_opened] svg path.col').count() > 0, 'the column is drawn');
  const { svg, plot } = await page.locator('[data-chart=menu_opened] .chart-plot').evaluate((el) =>
    ({ svg: Number(el.querySelector('svg').getAttribute('width')), plot: Math.floor(el.getBoundingClientRect().width) }));
  assert.equal(svg, Math.max(plot, 240), 'at the plot’s own width');
  clean(problems);
});

for (const [tag, viewport] of [['desk', DESKTOP], ['phone', PHONE]]) {
  test(`long words (QA-M3, ${tag}): a lead's whole message and a case's whole body are always reachable`, async () => {
    stub.world.leads[0].message = 'We run a small invented café with two rooms and a garden. We would like the menu with a picture of every dish, in Hebrew and English, '
      + 'and a code on each table. Our busiest hours are Friday mornings, so please call on a weekday afternoon. THE LAST SENTENCE IS HERE.';
    stub.world.leads[1].message = 'Short.';
    stub.world.venues[0].cases[0].body = 'One\nTwo\nThree\nFour: the important part';
    const { page, problems } = await staff(ACCOUNTS.support, { viewport });
    await toVenue(page, 'cafe-demo');
    const body = page.locator('[data-case-body]').first();
    await until(() => body.evaluate((e) => e.scrollHeight > e.clientHeight + 1), true, 'four short lines are more than three');
    await page.locator('[data-panel=cases] [data-show-all]').first().click();
    assert.equal(await body.evaluate((e) => e.scrollHeight <= e.clientHeight + 1), true, 'shown in full');
    assert.match(await body.innerText(), /Four: the important part/);
    assert.equal(await page.locator('[data-panel=cases] [data-show-all]').first().innerText(), 'Show less');
    await page.locator('[data-tab=leads]').click();
    const dream = page.locator('[data-lead="MN-2026-0001"] [data-dream]');
    await dream.waitFor();
    await until(() => dream.evaluate((e) => e.scrollHeight > e.clientHeight + 1), true, 'the long message is clipped');
    await page.locator('[data-lead="MN-2026-0001"] [data-show-all]').click();
    assert.equal(await dream.evaluate((e) => e.scrollHeight <= e.clientHeight + 1), true);
    assert.match(await dream.innerText(), /THE LAST SENTENCE IS HERE/);
    assert.equal(await page.locator('[data-lead="MN-2026-0002"] [data-show-all]').count(), 0, 'a message that fits has no expander');
    await shot(page, `v2-leads-long-${tag}`);
    clean(problems);
  });
}

test('the menu to approve, in full (QA-M4): both languages, notes, allergens, add-ons and their nesting, rules; pictures, or why not', async () => {
  const { page, problems } = await staff(ACCOUNTS.support);
  await toVenue(page, 'cafe-demo');
  const rev = page.locator('[data-panel=revision] [data-revision="2"]');
  await rev.waitFor();
  const burger = rev.locator(`.mr-dish[data-id="${ID.burger}"]`);
  const text = await burger.innerText();
  for (const want of [/Burger · המבורגר/, /Beef, brioche, pickles · בקר, בריוש, חמוצים/, /₪68 · with a side · עם תוספת/,
    /Allergens, in the owner’s words: gluten, sesame · גלוטן, שומשום/, /Goes well with: Lemonade, Schnitzel/,
    /Side · תוספת · one choice · choose 1 \(required\)/, /Fries · צ׳יפס · free · pre-selected/, /Choosing it opens:\s*Sauce · רוטב · one choice · choose 1 \(required\)/,
    /Chipotle · צ׳יפוטלה · \+₪2/, /Extras · תוספות · several choices · up to 3 \(optional\)/, /Cheese · גבינה · \+₪4 · up to 2 of it/]) assert.match(text, want);
  // the photo loads from the menu's own storage; the relief whose file is missing says so; the library's illustration shows
  await burger.scrollIntoViewIfNeeded();
  await until(() => burger.locator('[data-picture=photo] img').evaluate((i) => i.complete && i.naturalWidth > 0), true, 'the burger’s photo');
  const schnitzel = rev.locator(`.mr-dish[data-id="${ID.schnitzel}"]`);
  await schnitzel.scrollIntoViewIfNeeded();
  await until(() => schnitzel.locator('[data-picture]').getAttribute('data-picture'), 'unavailable', 'the relief whose file is missing');
  assert.match(await schnitzel.locator('[data-picture]').innerText(), /^A relief from one photo: cannot be shown here/);
  const croissant = rev.locator(`.mr-dish[data-id="${ID.croissant}"]`);
  await croissant.scrollIntoViewIfNeeded();
  await until(() => croissant.locator('[data-picture=stock] img').evaluate((i) => i.complete && i.naturalWidth > 0), true, 'the illustration');
  assert.match(await croissant.innerText(), /Tags: vegetarian/);
  assert.match(await rev.locator(`.mr-dish[data-id="${ID.fridayCake}"]`).innerText(), /Shown Friday \(Fri 07:00–15:00\)/);
  assert.match(await rev.locator(`[data-section="${ID.morning}"]`).innerText(), /Shown Breakfast \(every day 07:00–12:00\)/);
  const rules = await rev.locator('[data-rules]').innerText();
  assert.match(rules, /When a guest opens the sheet of “Burger”, any time: suggest the add-on “Cheese” \(Extras\)\. Priority 40, at most 2 times a visit\./);
  assert.match(rules, /The line guests read: “Add cheese\?” · “להוסיף גבינה\?”/);
  assert.match(rules, /When a guest opens “my table” with a dish from “Mains”, any time, unless their table has anything from Drinks: suggest “Lemonade”\./);
  await shot(page, 'v2-menu-to-approve-desk');
  await noHtmlFromData(page);
  clean(problems);
});

test('words (L2, L8, SEC-L1): five actions; a waiting venue\'s timeline names its dishes from the revision read; reads said truthfully', async () => {
  const { page } = await staff(ACCOUNTS.support);
  await toVenue(page, 'cafe-demo');
  const head = await page.locator('[data-panel=act] .panel-head').innerText();
  assert.match(head, /one of five actions/);
  assert.doesNotMatch(head, /only here/);
  await page.locator('[data-panel=revision] [data-revision="2"]').waitFor();
  await until(() => page.locator('[data-panel=timeline] [data-action="availability_overrides.insert"]').first().innerText().then((t) => /Taken off: Espresso/.test(t)), true,
    'named from the revision on screen, though guests cannot see the menu yet');
  assert.match(await page.locator('[data-logged-reads]').innerText(), /Not every back-office read is logged: the dish a change for them starts from is read without an entry\./);
  assert.doesNotMatch(await page.locator('[data-panel=owner]').innerText(), /sees each read/);
});

test('one column (L3): below 1000 px the order on screen is the order in the page, for the keyboard and screen readers', async () => {
  const { page } = await staff(ACCOUNTS.support, { viewport: PHONE });
  await toVenue(page, 'cafe-demo');
  await page.locator('[data-panel=revision] [data-revision="2"]').waitFor();
  const panels = await page.locator('[data-layout=one] > section[data-panel]').evaluateAll((els) => els.map((e) => [e.dataset.panel, e.getBoundingClientRect().top]));
  assert.deepEqual(panels.map(([p]) => p), ['approve', 'revision', 'guests', 'owner', 'act', 'onboarding', 'timeline', 'cases', 'imports', 'admin']);
  for (let i = 1; i < panels.length; i++) assert.ok(panels[i][1] > panels[i - 1][1], `${panels[i][0]} is below ${panels[i - 1][0]} on screen`);
  // the keyboard: each panel's first control comes after the one above it
  const firsts = await page.evaluate(() => {
    const all = [...document.querySelectorAll('a[href], button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), summary, [tabindex="0"]')];
    return [...document.querySelectorAll('[data-layout=one] > section[data-panel]')].map((p) => all.findIndex((el) => p.contains(el))).filter((i) => i >= 0);
  });
  assert.ok(firsts.length >= 6);
  assert.deepEqual(firsts, [...firsts].sort((a, b) => a - b));
});

test('after an approval (L5, L9): the dish list fills when the menu arrives, the plan form starts from the new plan; prices as typed (L10)', async () => {
  const { page, problems } = await staff(ACCOUNTS.admin);
  await toVenue(page, 'cafe-demo');
  assert.equal(await page.locator('[data-plan-state]').inputValue(), 'pending', 'a venue waiting for approval starts from its own state');
  const act = page.locator('[data-write=act]');
  await act.locator('[data-act-action]').selectOption('dish.update');   // before guests can see a menu: no dishes yet
  assert.equal(await act.locator('[data-act-dish]').count(), 0);
  await page.locator('[data-panel=revision] [data-revision="2"]').waitFor();
  const ap = page.locator('[data-write=approve]');
  await ap.locator('[data-reason]').fill('Menu checked with the owner by phone');
  await ap.locator('[data-review]').click();
  await ap.locator('[data-go]').click();
  await page.locator('[data-panel=approved] [data-write-result]').waitFor();
  await until(() => page.locator('[data-plan-state]').inputValue(), 'trialing', 'the plan form starts again from the plan the approval started');
  await until(() => act.locator('[data-act-dish]').inputValue(), ID.shakshuka, 'the menu arrived: its first dish is chosen, not a blank');
  for (const bad of ['1e3', '0x10', '-2', '5.', '1.234']) {
    await act.locator('[data-act-price]').fill(bad);
    await act.locator('[data-reason]').fill('Owner asked by phone for the new price');
    await act.locator('[data-review]').click();
    await act.locator('[data-review]:not([disabled])').waitFor();
    assert.equal(await act.locator('[data-write-error]').innerText(),
      'Write the price in shekels with digits and at most one decimal point (for example 54 or 54.50), or leave it empty for no price.', bad);
  }
  await act.locator('[data-act-price]').fill('54,5');
  await act.locator('[data-review]').click();
  assert.match(await act.locator('[data-what]').innerText(), /Change the price of “Shakshuka” from ₪54 to ₪54\.50\./);
  assert.equal(calls('act_for_owner').length, 0);
  clean(problems);
});

test('leads (L7): more than the page reads is said, and the counts are of those it read', async () => {
  const first = stub.world.leads[0];
  for (let i = 0; i < 305; i++) stub.world.leads.push({ ...first, id: `00000000-0000-4000-8000-${(0x9000 + i).toString(16).padStart(12, '0')}`, ref: `MN-2026-${1000 + i}` });
  const { page, problems } = await staff(ACCOUNTS.support);
  await page.locator('[data-tab=leads]').click();
  await page.locator('[data-leads-capped]').waitFor();
  assert.equal(await page.locator('[data-leads-capped]').innerText(),
    'Showing the newest 300 enquiries only: older ones are not on this page, and the counts below are of these 300.');
  assert.equal(calls('ops_leads').at(-1).args.p_limit, 300);
  assert.equal(await page.locator('[data-lead]').count(), 300);
  clean(problems);
});

test('an older database without ops_venues: the page says so instead of breaking', async () => {
  await control({ faults: { ops_venues: { mode: 'missing' } } });
  const { page } = await open(browser, base, { prefix: '/mana' });
  await signIn(page, ACCOUNTS.support);
  await page.locator('[data-load-error=missing]').waitFor();
  assert.match(await page.locator('[data-load-error]').innerText(), /does not have this part of the back office yet/);
});
