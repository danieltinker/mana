// The v2 back office (apps/ops, schema 2) in Chromium on the simulator's stack: the real schema, GoTrue and PostgREST,
// synthetic venues loaded through the bots. At a desk (1440×900) and on a phone (390×844):
//   a non-staff user is refused; a staff user finds Café Demo, follows its onboarding, approves its first publish, acts
//   for the owner to restore a dish (with a reason, then sees it in the timeline), and sees simulated guest traffic
//   appear after stack.buildRollups(); leads are read and updated.
// Needs `npm run build` in apps/ops first (dist/). The flows that need ADR-008's back-office functions (ops_venues,
// ops_venue, ops_analytics) skip, saying so, until the schema has them (the backend lane's migration).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HalomBot, OwnerBot, asAnon, loadSeed, readSeed, runRandom, SEEDS } from '@mana/sim';
import { OUT, startE2E } from './helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'apps/ops/dist');
const DESK = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const STAFF = { email: 'staff.ops-e2e@example.invalid', password: 'sim-staff-pass-1' };
const OWNER_PASSWORD = 'sim-owner-pass-1';
/** The back office's functions of ADR-008, by name; the flows below need some of them. */
const ADR8 = ['ops_venues', 'ops_venue', 'ops_analytics', 'ops_update_case', 'ops_set_demo'];

let e, site, staff, has;
/** Café Demo, twice: one for the desk run, one for the phone run (an approval happens once per venue). */
const venues = {};

before(async () => {
  if (!fs.existsSync(path.join(DIST, 'v2.js'))) throw new Error('apps/ops/dist/v2.js is missing: run `npm run build` in apps/ops first');
  site = fs.mkdtempSync(path.join(os.tmpdir(), 'mana-ops-e2e-'));
  fs.writeFileSync(path.join(site, 'index.html'), '<!doctype html><meta charset="utf-8"><title>e2e</title>');
  e = await startE2E({ seed: null, site });
  // the built back office, its Content-Security-Policy opened to the local stack (a local build does the same: the
  // platform lane's tools/site-env.mjs)
  fs.cpSync(DIST, path.join(site, 'ops'), { recursive: true });
  const index = path.join(site, 'ops/index.html');
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace(/connect-src 'self'/, `connect-src 'self' ${e.stack.apiUrl}`));

  staff = await HalomBot.firstAdmin(e.stack, e.stack, STAFF);
  const seed = readSeed(path.join(SEEDS, 'cafe-demo.json')).seed;
  for (const [tag, slug] of [['desk', 'cafe-demo'], ['phone', 'cafe-demo-phone']]) {
    // built by its owner bot and published: the first publish waits for Halom's approval
    const v = await loadSeed(e.stack, { ...seed, publish: false }, { slug });
    const pub = await v.owner.publish('first publish');
    assert.equal(pub.review, 'pending');
    venues[tag] = v;
  }
  const rows = await e.stack.sql(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1)`, [ADR8]);
  has = new Set(rows.map((r) => r.proname));
}, { timeout: 240_000 });
after(async () => { await e?.stop(); if (site) fs.rmSync(site, { recursive: true, force: true }); });

const missing = (...fns) => fns.filter((f) => !has.has(f));
const skipUnless = (t, ...fns) => { const m = missing(...fns); if (m.length) { t.skip(`waits for ${m.join(', ')} (ADR-008, the backend lane's migration)`); return true; } return false; };

async function page(viewport) {
  const phone = viewport.width < 700;
  const ctx = await e.browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone, locale: 'en-GB', timezoneId: 'Asia/Jerusalem' });
  // a short poll, so "appears without a reload" is seconds, not the production 30 s
  await ctx.addInitScript(() => { window.__OPS_POLL_MS = 1500; });
  const p = await ctx.newPage();
  p.problems = [];
  p.on('pageerror', (err) => p.problems.push('pageerror: ' + err.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/status of (400|401|403|404)/.test(m.text())) p.problems.push('console: ' + m.text()); });
  await p.goto(e.webUrl + 'ops/');
  return p;
}
async function signIn(p, who) {
  await p.getByLabel('E-mail').fill(who.email);
  await p.getByLabel('Password').fill(who.password);
  await p.getByRole('button', { name: 'Sign in' }).click();
}
const shot = (p, name) => p.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true, animations: 'disabled' });
async function until(read, want, msg, ms = 10_000) {
  const end = Date.now() + ms;
  for (;;) {
    const got = await read();
    if (JSON.stringify(got) === JSON.stringify(want)) return;
    if (Date.now() > end) throw new Error(`${msg}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}
const noSideScroll = async (p) => assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll');

// ------------------------------------------------------------------ what exists on the schema today

for (const [tag, viewport] of [['desk', DESK], ['phone', PHONE]]) {
  test(`${tag}: a user who is not staff (Café Demo's owner) is refused, and sees nothing of the back office`, async () => {
    const p = await page(viewport);
    await signIn(p, { email: `owner.${venues[tag].slug}@example.invalid`, password: OWNER_PASSWORD });
    await p.locator('[data-not-staff]').waitFor();
    assert.equal(await p.locator('[data-not-staff]').innerText(), 'Not Halom staff');
    assert.equal(await p.locator('nav, [data-page]').count(), 0);
    await noSideScroll(p);
    await shot(p, `ops-not-staff-${tag}`);
    assert.deepEqual(p.problems, []);
    await p.context().close();
  });
}

test('desk: leads from the product page are read (the read is logged) and updated', async () => {
  const anon = asAnon(e.stack, { ip: '10.9.9.9' });
  const sent = await anon.rpc('submit_lead', { p_token: crypto.randomUUID(), p_message: 'A small café, invented for the test', p_contact: 'lead@example.invalid',
    p_name: 'Test Lead', p_elapsed_ms: 8000 });
  assert.equal(sent.ok, true);
  const p = await page(DESK);
  await signIn(p, STAFF);
  await p.locator('[data-page=clients]').waitFor();
  await p.locator('[data-tab=leads]').click();
  const lead = p.locator(`[data-lead="${sent.ref}"]`);
  await lead.waitFor();
  assert.match(await lead.locator('[data-dream]').innerText(), /invented for the test/);
  await lead.locator('[data-edit]').click();
  await lead.locator('[data-lead-status]').selectOption('contacted');
  await lead.locator('[data-review]').click();
  assert.match(await lead.locator('[data-what]').innerText(), /status New → Contacted/);
  await lead.locator('[data-go]').click();
  await lead.locator('[data-write-result]').waitFor();
  const [row] = await e.stack.sql('select status from public.leads where ref = $1', [sent.ref]);
  assert.equal(row.status, 'contacted');
  const reads = await e.stack.sql(`select count(*)::int as n from public.activity_log where action = 'leads.read' and venue_id is null`);
  assert.ok(reads[0].n >= 1, 'each read of the leads is in the log');
  assert.deepEqual(p.problems, []);
  await p.context().close();
});

test('desk: with staff_require_aal2 on, a staff password-only session is refused by the database, and the page says why', async () => {
  await e.stack.setConfig('staff_require_aal2', true);
  try {
    const p = await page(DESK);
    await p.goto(e.webUrl + 'ops/#/leads');
    await signIn(p, STAFF);
    await p.locator('[data-refused=aal1]').waitFor();
    assert.match(await p.locator('[data-refused]').innerText(), /password only \(aal1\).*second step \(MFA\)/s);
    assert.equal(await p.locator('[data-page]').count(), 0);
    await shot(p, 'ops-refused-aal1-desk');
    await p.context().close();
  } finally {
    await e.stack.setConfig('staff_require_aal2', false);
  }
});

test('the v2 data layer on the real schema: staff role, approve, act for owner, the guest menu, plans for admins only', async () => {
  const { createClient } = createRequire(path.join(ROOT, 'apps/ops/package.json'))('@supabase/supabase-js');   // the back office's own copy
  const { opsApi } = await import('../apps/ops/src/v2/api.ts');
  const { supabaseBackend } = await import('../apps/ops/src/v2/session.ts');
  const as = async (who) => {
    const client = createClient(e.stack.apiUrl, e.stack.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword(who);
    assert.equal(error, null);
    return { api: opsApi(supabaseBackend(client)), id: data.user.id };
  };
  const seed = readSeed(path.join(SEEDS, 'cafe-demo.json')).seed;
  const v = await loadSeed(e.stack, { ...seed, publish: false }, { slug: 'cafe-demo-api' });
  await v.owner.publish('first publish');
  const admin = await as(STAFF);
  const owner = await as({ email: 'owner.cafe-demo-api@example.invalid', password: OWNER_PASSWORD });
  assert.deepEqual(await admin.api.staffRole(admin.id), { ok: true, data: 'admin' });
  assert.deepEqual(await owner.api.staffRole(owner.id), { ok: true, data: null }, 'an owner has no staff row');

  // the guest menu waits for approval; approve; the guest menu answers
  const before = await admin.api.publicMenu('cafe-demo-api');
  assert.ok(before.ok && before.data.state === 'unavailable');
  const short = await admin.api.approve({ venueId: v.venueId, reason: 'no' });
  assert.ok(!short.ok && short.kind === 'invalid', 'refused before the call');
  const ok = await admin.api.approve({ venueId: v.venueId, reason: 'Synthetic menu checked, api' });
  assert.ok(ok.ok && typeof ok.data.trialEndsAt === 'string');
  const again = await admin.api.approve({ venueId: v.venueId, reason: 'Synthetic menu checked, api' });
  assert.ok(!again.ok && again.kind === 'refused' && again.code === 'already_approved');

  // act for owner: the payload names are act_for_owner's
  const espresso = v.ids.dishes.espresso;
  await v.owner.soldOut('dish', espresso, { kind: 'duration', minutes: 120 });
  const menu = await admin.api.publicMenu('cafe-demo-api');
  assert.ok(menu.ok && menu.data.state === 'ok' && menu.data.live.off.some((o) => o.id === espresso));
  const restored = await admin.api.actForOwner({ venueId: v.venueId, reason: 'Owner asked, api', action: 'availability.restore', payload: { targetKind: 'dish', targetId: espresso } });
  assert.ok(restored.ok && restored.data.result.restored === 1, JSON.stringify(restored));
  const set = await admin.api.actForOwner({ venueId: v.venueId, reason: 'Owner asked, api', action: 'availability.set',
    payload: { targetKind: 'dish', targetId: v.ids.dishes.lemonade, until: { kind: 'duration', minutes: 60 } } });
  assert.ok(set.ok && typeof set.data.result.untilAt === 'string', JSON.stringify(set));
  const price = await admin.api.actForOwner({ venueId: v.venueId, reason: 'Owner asked, api', action: 'dish.update', payload: { dishId: espresso, patch: { price: 1300 } } });
  assert.ok(price.ok, JSON.stringify(price));
  const step = await admin.api.actForOwner({ venueId: v.venueId, reason: 'Owner asked, api', action: 'onboarding.set', payload: { step: 'photos', state: 'skipped' } });
  assert.ok(step.ok, JSON.stringify(step));
  const log = await v.owner.activity();
  assert.equal(log.filter((r) => r.action === 'support.act_for_owner' && r.reason === 'Owner asked, api').length, 4, 'each is in the owner’s log with the reason');

  // the owner's switch: refused plainly, nothing written
  await v.owner.updateVenue({ support_can_act: false });
  const declined = await admin.api.actForOwner({ venueId: v.venueId, reason: 'Owner asked, api', action: 'menu.publish', payload: {} });
  assert.ok(!declined.ok && declined.kind === 'refused' && declined.code === 'owner_declined');

  // plans: admins only (a support member is refused as not_admin)
  const plan = await admin.api.setPlan({ venueId: v.venueId, state: 'active', until: null, plan: 'pilot', reason: 'Pilot agreed, api' });
  assert.deepEqual(plan, { ok: true, data: { ok: true, state: 'active' } });
  const notStaff = await owner.api.setPlan({ venueId: v.venueId, state: 'active', until: null, plan: 'pilot', reason: 'Pilot agreed, api' });
  assert.ok(!notStaff.ok && notStaff.kind === 'not_admin');
  const ownerApprove = await owner.api.approve({ venueId: v.venueId, reason: 'Trying as the owner' });
  assert.ok(!ownerApprove.ok && ownerApprove.kind === 'not_staff');
});

// ------------------------------------------------------------------ the support flow (needs ADR-008's functions)

for (const [tag, viewport] of [['desk', DESK], ['phone', PHONE]]) {
  test(`${tag}: staff find Café Demo, follow its onboarding, approve its first publish, restore a dish for the owner; guest traffic appears`, async (t) => {
    if (skipUnless(t, 'ops_venues', 'ops_venue', 'ops_analytics')) return;
    const v = venues[tag];
    const p = await page(viewport);
    await signIn(p, STAFF);
    await p.locator('[data-page=clients]').waitFor();

    // find it
    await p.locator('[data-search]').fill(v.slug);
    const row = p.locator(`[data-venue="${v.slug}"]`).first();
    await row.waitFor();
    assert.match(await row.innerText(), /Café Demo/);
    assert.equal(await row.locator('[data-demo]').count(), 1, 'a demo venue, labelled');
    assert.equal(await row.locator('[data-warning=awaiting_review]').count(), 1);
    await shot(p, `ops-clients-${tag}`);
    await row.locator('[data-open]').click();
    await p.locator(`[data-page=venue][data-venue="${v.slug}"] [data-panel=timeline]`).waitFor();

    // follow its onboarding: what the owner bot did is what the page shows
    const [steps] = await e.stack.sql(`select count(*) filter (where state in ('done', 'skipped'))::int as done from public.onboarding_progress where venue_id = $1`, [v.venueId]);
    assert.match(await p.locator('[data-onboarding-summary]').innerText(), new RegExp(`^${steps.done} of 9 steps done`));
    assert.equal(await p.locator('[data-step=menu]').getAttribute('data-state'), 'done');
    assert.match(await p.locator('[data-guests-unavailable]').innerText(), /waits for Halom’s approval/);

    // approve the first publish, with a reason
    const approve = p.locator('[data-write=approve]');
    await approve.locator('[data-reason]').fill('Synthetic menu checked, e2e');
    await approve.locator('[data-review]').click();
    await approve.locator('[data-go]').click();
    await p.locator('[data-badge=review-approved]').waitFor();
    const [ven] = await e.stack.sql('select approved_at from public.venues where id = $1', [v.venueId]);
    assert.ok(ven.approved_at, 'approved in the database');
    assert.match(await p.locator('[data-action="venue.approve"] [data-reason-shown]').first().innerText(), /Synthetic menu checked, e2e/);

    // the owner sells out the espresso; Halom restores it for the owner from what guests see
    const espresso = v.ids.dishes.espresso;
    await v.owner.soldOut('dish', espresso, { kind: 'duration', minutes: 120 });
    const dish = p.locator(`[data-menu-row=dish][data-id="${espresso}"]`);
    await until(() => dish.getAttribute('data-off'), 'yes', 'the sold-out shows on the next refresh');
    await dish.locator('[data-restore]').click();
    const act = p.locator('[data-write=act]');
    await act.locator('[data-reason]').fill('The owner asked by phone, e2e');
    await act.locator('[data-review]').click();
    assert.match(await act.locator('[data-what]').innerText(), /Bring “Espresso” \(dish\) back/);
    await act.locator('[data-go]').click();
    await act.locator('[data-write-result]').waitFor();
    await until(() => dish.getAttribute('data-off'), 'no', 'back on the menu');
    const acted = p.locator('[data-action="support.act_for_owner"]').first();
    await acted.waitFor();
    assert.match(await acted.locator('[data-reason-shown]').innerText(), /The owner asked by phone, e2e/);
    // the owner's log says the same (D25: visible to the owner)
    const ownerLog = await v.owner.activity();
    assert.ok(ownerLog.some((r) => r.action === 'support.act_for_owner' && r.reason === 'The owner asked by phone, e2e'));
    await shot(p, `ops-venue-${tag}`);

    // simulated guests, then the rollup job: the numbers appear without a reload
    const { ledger } = await runRandom(e.stack, { slug: v.slug, guests: 12, minutes: 20, seed: tag === 'desk' ? 11 : 12 });
    const opens = ledger.n('menu_opened');
    assert.ok(opens > 0);
    await e.stack.buildRollups();
    // the guests came in the last 20 minutes: the venue's last hour counts them all (today could straddle midnight)
    await until(async () => Number(await p.locator('[data-strip] [data-opens-hour]').innerText()), opens, 'opens in the last hour on the venue page', 15_000);
    await p.locator('[data-venue-analytics]').click();
    await p.locator('[data-range="1h"]').click();
    await p.locator('[data-filter=demo]').selectOption('include');
    await until(async () => Number(await p.locator('[data-kpi=menu_opened] .tile-value').innerText()), opens, 'the analytics, demo included', 15_000);
    await noSideScroll(p);
    await shot(p, `ops-analytics-${tag}`);
    assert.deepEqual(p.problems, []);
    await p.context().close();
  });
}
