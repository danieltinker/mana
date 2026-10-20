// The client walkthrough: phase 1's acceptance test (command plan §4, D38), every step on all three sides, through the
// real apps in Chromium as a person would use them (the owner app and the guest menu on a 390 × 844 phone, the back office
// at a desk). Only the extra guests are bots (`guest-load`, over the public API, for load).
//
//   1. the owner signs up, names the venue, imports the menu from the text of its Wolt page (and, where a scanner runs,
//      from screenshots)                                          owner-signup, owner-venue, owner-import-text, …-screenshots
//   2. fixes the listed exceptions, sets the "side of choice" groups and a nested sauce, adds two suggestion rules, sets
//      breakfast hours, publishes                                 owner-fix, owner-addons, owner-rules, owner-breakfast, owner-publish
//   3. Halom approves the first publish (and labels the venue a demo, so real totals leave it out)        staff-approve
//   4. a guest on a phone chooses add-ons, accepts one suggestion and dismisses another; more guests (bots)
//                                                                  guest-choose, guest-dismiss, guest-load
//   5. the owner takes a dish off for two hours from the phone      owner-off
//   6. Halom sees the onboarding, the live numbers and the activity, and acts for the owner once to restore the dish
//      (with a reason)                                              staff-observe, staff-act
//   7. the owner sees that act in the activity log                  owner-log
//
// The same run works against the simulator's stack (env local: tests, CI, an agent) and against the demo database
// `mana` (env demo: `npm run demo -- --scenario …` on Daniel's Mac). Production is refused before anything starts. What
// the run needs that the environment does not give (accounts) is checked first, before anything is written.
//
// Each run makes a venue of its own (`<slugBase>-<run id>`), labelled demo, so a second run never meets the first.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { asAnon, asUser, HalomBot, OwnerBot, runRandom, signIn } from '@mana/sim';
import { DESK, launchBrowser, newPage, PHONE } from './browser.mjs';
import { writePage } from './page.mjs';
import { Walkthrough } from './record.mjs';

/**
 * What a walkthrough runs on: the menu as an owner would paste it, and what the owner, a guest and Halom do with it.
 * Names are the Hebrew names the import stores.
 * @typedef {{
 *   invented: boolean, about?: string,
 *   venue: { name: string, slugBase: string, kind?: string },
 *   wolt: { text: string, screenshots?: { reply: string, count?: number } | null },
 *   fixes?: { prices?: Record<string, string> },
 *   addons: { side: string, opener: string, sauce: string, sauceRequired?: boolean, attach?: { dish: string, group: string }[] },
 *   rules: { after: string, suggest: string, line?: { he?: string, en?: string } }[],
 *   breakfast: { section: string, name: { he: string, en?: string } },
 *   guest: { dish: string, choose: string[], accepts: string, then: string, dismisses: string },
 *   offForTwoHours: string,
 *   load?: { guests?: number },
 * }} WalkthroughInput
 */

/** Each step's budget on the local stack (ms). On demo the database is across the sea: twice that, and the rollups come
 * from pg_cron once a minute, so Halom's live numbers get three minutes. */
export const BUDGETS = {
  'owner-signup': 20_000, 'owner-venue': 20_000, 'owner-import-text': 25_000, 'owner-fix': 30_000, 'owner-import-screenshots': 45_000,
  'owner-addons': 90_000, 'owner-rules': 90_000, 'owner-breakfast': 60_000, 'owner-publish': 60_000, 'staff-approve': 60_000,
  'guest-choose': 45_000, 'guest-dismiss': 45_000, 'guest-load': 60_000, 'owner-off': 30_000, 'staff-observe': 60_000,
  'staff-act': 45_000, 'owner-log': 30_000,
};
const DEMO_BUDGETS = { 'staff-observe': 180_000 };
export const budgetOf = (id, env) => (env === 'demo' ? DEMO_BUDGETS[id] ?? 2 * BUDGETS[id] : BUDGETS[id]);

/** A run's own id: the Israel date and time, and three random letters (a slug part: lowercase, digits, hyphens). */
export function newRunId(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).map((x) => [x.type, x.value]));
  return `${p.month}${p.day}-${p.hour}${p.minute}-${crypto.randomBytes(3).readUIntBE(0, 3).toString(36).padStart(3, '0').slice(-3)}`;
}

/** A template's `{run}` filled with the run's id (a fresh address per run: `halom.studio+demo-{run}@gmail.com`). */
export const fillRun = (template, runId) => String(template).replaceAll('{run}', runId);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plain = (s) => String(s ?? '').replace(/[\u200e\u200f\u2060\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
const nis = (agorot) => '₪' + (agorot % 100 ? (agorot / 100).toFixed(2) : String(agorot / 100));
function must(cond, what) { if (!cond) throw new Error(what); }

/** Waits until `read()` gives `want` (as JSON), or throws with what it last read. */
async function until(read, want, what, ms = 15_000, every = 250) {
  const end = Date.now() + ms;
  let got;
  for (;;) {
    got = await read();
    if (JSON.stringify(got) === JSON.stringify(want)) return got;
    if (Date.now() > end) throw new Error(`${what}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    await sleep(every);
  }
}

/** Which of several screens shows first (a selector each), within `ms`. */
async function firstOf(page, choices, ms = 30_000) {
  const end = Date.now() + ms;
  for (;;) {
    for (const [name, sel] of Object.entries(choices)) if (await page.locator(sel).first().isVisible().catch(() => false)) return name;
    if (Date.now() > end) throw new Error(`none of ${Object.keys(choices).join(', ')} appeared within ${ms / 1000} s`);
    await sleep(200);
  }
}

/** The guest menu's dishes and choices by Hebrew name, from what the phone itself reads (public_menu). */
function menuIndex(snapshot) {
  const dishes = snapshot.sections.flatMap((s) => s.dishes);
  const groups = new Map(snapshot.addonGroups.map((g) => [g.id, g]));
  return {
    dish(name) { const d = dishes.find((x) => x.name.he === name); must(d, `the guest menu has no dish "${name}"`); return d; },
    /** A choice on a dish: its option, and the option that opens its group when it is nested. */
    choice(dish, name) {
      for (const link of dish.addons) {
        const g = groups.get(link.groupId);
        for (const o of g?.options ?? []) {
          if (o.name.he === name) return { option: o, opener: null };
          const nested = o.opensGroupId ? groups.get(o.opensGroupId) : null;
          const n = nested?.options.find((x) => x.name.he === name);
          if (n) return { option: n, opener: o };
        }
      }
      throw new Error(`"${dish.name.he}" offers no choice "${name}"`);
    },
  };
}

/**
 * Checks what the run needs before anything is written: the environment (never production), the accounts, the
 * database's schema and sign-up, the site. Throws one error that names every missing piece and the step that needs it.
 */
async function preflight({ env, config, site, accounts, stack, input }) {
  // the caller's own list says where each missing account goes (e2e/walkthrough/accounts.mjs); these are the fallbacks
  const problems = [...(accounts.problems ?? [])];
  if (env === 'local' && !stack?.serviceKey) problems.push('env local needs the simulator\'s stack (run it through npm run dev:local or the e2e harness)');
  if (env === 'demo' && !problems.length && !accounts.owner?.email) problems.push('step 1 (the owner signs up) needs a fresh demo e-mail address');
  if (env === 'demo' && !problems.length && !(accounts.staff?.email && accounts.staff?.password)) problems.push('steps 10, 15 and 16 (Halom approves, observes, acts for the owner) need a Halom admin account');
  if (!input?.wolt?.text?.trim()) problems.push('step 3 (import from Wolt text) needs the menu\'s text');
  if (problems.length) throw Object.assign(new Error('the walkthrough cannot start:\n  - ' + problems.join('\n  - ')), { exitCode: 2 });

  for (const p of ['studio/', 'ops/', 'view/']) {
    const r = await fetch(site + p).catch((e) => ({ ok: false, status: e.message }));
    if (!r.ok) throw new Error(`the site does not serve ${p} (${r.status}): is it built and served?`);
  }
  const auth = await fetch(config.supabaseUrl.replace(/\/$/, '') + '/auth/v1/settings', { headers: { apikey: config.supabaseKey } }).then((r) => r.json()).catch(() => null);
  if (!auth) throw new Error('the database\'s sign-in service did not answer');
  if (auth.disable_signup) throw new Error('step 1 (the owner signs up) needs sign-up open on the database (Auth: "Allow new users to sign up")');
  return { confirmByMail: auth.mailer_autoconfirm === false };
}

/**
 * Runs the walkthrough and writes its page. Never throws for a step that fails (the page records it); throws only
 * when it cannot start.
 * @param {{
 *   input: WalkthroughInput, config: Record<string, any>, origin: string, outDir: string, log?: (line: string) => void,
 *   stack?: any, accounts?: { owner?: { email: string }, staff?: { email: string, password: string }, problems?: string[] },
 *   title: string, runId?: string, confirmWaitMs?: number,
 * }} o
 *   config    the site's settings as the pages read them (env local or demo, schema 2)
 *   origin    where the site is served (its pages are under /mana/, the guest menu under /m/)
 *   stack     local only: the simulator's stack (its sign-up open; the first admin; the rollup job; the scanner stub)
 *   accounts  demo only: the owner's fresh address and Halom's admin (local makes both)
 */
export async function runWalkthrough({ input, config, origin, outDir, log = () => {}, stack = null, accounts = {}, title, runId = newRunId(), confirmWaitMs = 15 * 60_000 }) {
  const env = config.env;
  if (env !== 'local' && env !== 'demo') throw Object.assign(new Error(`the walkthrough runs on local or demo, never on ${env ?? 'production'}`), { exitCode: 2 });
  if (config.schema !== 2) throw Object.assign(new Error('the walkthrough needs the clean schema (schema 2)'), { exitCode: 2 });
  const site = origin.replace(/\/$/, '') + '/mana/';
  const target = { apiUrl: config.supabaseUrl, anonKey: config.supabaseKey };
  const anon = asAnon(target);
  const slug = `${input.venue.slugBase}-${runId}`.slice(0, 40).replace(/-+$/, '');
  must(/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug), `the venue's address "${slug}" is not a slug: slugBase takes lowercase letters, digits and hyphens`);

  // ---- the accounts: local makes its own; demo reads them from private files (never printed)
  const ownerPassword = 'Wk-' + crypto.randomBytes(12).toString('base64url');
  let ownerEmail = accounts.owner?.email ?? null, staffLogin = accounts.staff ?? null;
  if (env === 'local' && stack) {
    ownerEmail = `owner.${runId}@walkthrough.example`;
    const staffEmail = `staff.${runId}@walkthrough.example`;
    await HalomBot.firstAdmin(stack, stack, { email: staffEmail });              // the first admin, as supabase/README.md makes it
    staffLogin = { email: staffEmail, password: 'sim-staff-pass-1' };
  }
  const { confirmByMail } = await preflight({ env, config, site, accounts: { ...accounts, owner: ownerEmail ? { email: ownerEmail } : null, staff: staffLogin }, stack, input });
  // Halom's account, checked before anything is written: it signs in and is an admin (the demo label is an admin's)
  const staffSession = await signIn(target, staffLogin).catch(() => null);
  must(staffSession, 'Halom\'s account did not sign in (steps 10, 15–16)');
  const staffApi = asUser(target, staffSession);
  const [staffRow] = await staffApi.select('staff', { select: 'role', user_id: `eq.${staffSession.userId}` }).catch(() => []);
  must(staffRow?.role === 'admin', 'Halom\'s account is not a Halom admin (the demo label and the approval are an admin\'s)');
  await staffApi.rpc('ops_venues', { p_filters: {} }).catch((e) => { throw new Error(`the database lacks the back office's phase-1 functions (ops_venues: ${e.message})`); });

  fs.mkdirSync(outDir, { recursive: true });
  if (env === 'demo') {
    // the demo owner's account, for Daniel to sign in as the owner afterwards (private/, git-ignored; never printed)
    fs.writeFileSync(path.join(outDir, 'owner-account.txt'), `${ownerEmail}\n${ownerPassword}\n`, { mode: 0o600 });
  }

  const w = new Walkthrough({ outDir, log });
  const browser = await launchBrowser({ apiUrl: config.supabaseUrl });
  const state = { venueId: null, ownerBot: null, guestEvents: [], expectedOpens: 0, offDish: null };
  const reason = 'The owner phoned: the dish is back on (walkthrough)';
  let file = null;
  try {
    // ---------------------------------------------------------------- the owner's phone
    const owner = await newPage(browser, PHONE);
    const shots = input.wolt.screenshots;
    let stub = null;
    if (env === 'local' && stack && shots?.reply) {
      // the scanner here: the real menus-ai handler in this process with a recorded model reply (nothing paid)
      const { scanStub } = await import('../scan-stub.mjs');
      stub = scanStub(stack, { reply: shots.reply });
      await stub.attach(owner);
    }
    const go = (hash) => owner.goto(site + 'studio/#/' + hash);
    const onStep = (s, ms = 30_000) => owner.locator(`[data-screen="onboarding"][data-step="${s}"]`).waitFor({ timeout: ms });
    const rows = (table, extra = {}) => state.ownerBot.api.select(table, { select: '*', venue_id: `eq.${state.venueId}`, ...extra });

    await w.step({ id: 'owner-signup', name: 'The owner signs up', side: 'owner', budgetMs: budgetOf('owner-signup', env), page: owner }, async (s) => {
      await owner.goto(site + 'studio/');
      await owner.locator('[data-screen="start"]').waitFor();
      const fill = async () => {
        await owner.locator('input[type="email"]').fill(ownerEmail);
        await owner.locator('input[name="password"]').fill(ownerPassword);
        await owner.locator('form.start-form button[type="submit"]').click();
      };
      await fill();
      const where = await firstOf(owner, { in: '[data-screen="venue-new"]', confirm: '[data-screen="confirm-email"]', error: '[data-screen="start"] .note-error' });
      if (where === 'error') throw new Error('the start screen said: ' + plain(await owner.locator('[data-screen="start"] .note-error').innerText()));
      if (where === 'in') return `Opened an account with a fresh demo address and a new password; ${confirmByMail ? 'the address was confirmed' : 'the database confirms addresses at once here'}, so the app goes straight to "your place".`;
      await s.shot();
      log('  … waiting for the owner\'s address to be confirmed: open the link in the demo mailbox (up to ' + Math.round(confirmWaitMs / 60_000) + ' min)');
      const t0 = Date.now();
      for (;;) {
        if (await signIn(target, { email: ownerEmail, password: ownerPassword }).then(() => true, () => false)) break;
        if (Date.now() - t0 > confirmWaitMs) throw new Error(`the owner's address was not confirmed within ${Math.round(confirmWaitMs / 60_000)} min`);
        await sleep(5000);
      }
      s.waited(Date.now() - t0);
      await owner.goto(site + 'studio/');
      await owner.locator('[data-screen="start"]').waitFor();
      await fill();
      await owner.locator('[data-screen="venue-new"]').waitFor();
      return `Opened an account with a fresh demo address; confirmed it from the mailbox after ${Math.round((Date.now() - t0) / 1000)} s, then signed in.`;
    });

    await w.step({ id: 'owner-venue', name: 'The owner names the venue', side: 'owner', budgetMs: budgetOf('owner-venue', env), page: owner }, async () => {
      await owner.locator('#place-name').fill(input.venue.name);
      await owner.locator('.addr-edit').click();
      await owner.locator('#place-slug').fill(slug);
      await owner.locator('[data-avail="free"]').waitFor();
      await owner.locator(`[data-kind="${input.venue.kind ?? 'cafe'}"]`).click();
      await owner.locator('.setup-form button[type="submit"]').click();
      await onStep('menu');
      state.venueId = await owner.locator('.shell').getAttribute('data-venue');
      must(state.venueId, 'the app shows no venue');
      state.ownerBot = (await OwnerBot.signInAs(target, { email: ownerEmail, password: ownerPassword })).forVenue(state.venueId, slug);
      const progress = await owner.locator('[data-progress]').getAttribute('data-progress');
      return `Named the place "${input.venue.name}", a ${input.venue.kind ?? 'cafe'}, at the permanent address /m/${slug}; the setup flow opens on "bring your menu" (${progress} steps done).`;
    });

    /** Answers every open "fix" of an import's review (a price typed where the input names it, else the first answer). */
    async function fixAll() {
      const fixed = [];
      for (let i = 0; i < 50; i++) {
        const open = owner.locator('[data-fix] [data-exception][data-open="yes"]').first();
        if (!(await open.count())) break;
        const id = await open.getAttribute('data-exception');
        const what = plain(await open.locator('.exc-what').innerText());
        const price = Object.entries(input.fixes?.prices ?? {}).find(([name]) => what.includes(name));
        const field = open.locator('input[data-field^="fix-price-"]');
        if (price && (await field.count())) {
          await field.fill(price[1]);
          await open.locator('[data-action="set-price"]').click();
          fixed.push(`typed ${price[0]}'s price, ₪${price[1]}`);
        } else {
          const first = open.locator('[data-choose]').first();
          must(await first.count(), `nothing to answer "${what}" with`);
          fixed.push(`answered "${what}" with "${plain(await first.innerText())}"`);
          await first.click();
        }
        await owner.locator(`[data-exception="${id}"][data-open="yes"]`).waitFor({ state: 'detached' });
      }
      return fixed;
    }
    async function applyImport() {
      const sw = owner.locator('[data-prices-confirm] button[role="switch"]');
      if ((await sw.count()) && (await sw.getAttribute('aria-checked')) !== 'true') await sw.click();
      await owner.locator('[data-action="apply-import"]:not([disabled])').click();
      await owner.locator('[data-screen="onboarding"]:not([data-step="review"])').waitFor({ timeout: 30_000 });
    }

    await w.step({ id: 'owner-import-text', name: 'The owner imports the menu from the text of its Wolt page', side: 'owner', budgetMs: budgetOf('owner-import-text', env), page: owner }, async (s) => {
      await owner.locator('[data-source="wolt_text"]').click();
      await owner.locator('[data-text-import="wolt_text"]').waitFor();
      await owner.locator('[data-field="import-text"]').fill(input.wolt.text);
      await owner.locator('[data-action="read-text"]').click();
      await owner.locator('[data-review]').waitFor({ timeout: 30_000 });
      const [sections, dishes, groups, options] = (await owner.locator('[data-counts]').getAttribute('data-counts')).split('/').map(Number);
      const nFix = await owner.locator('[data-fix] [data-exception]').count(), nCheck = await owner.locator('[data-check] [data-exception]').count();
      must((await rows('dishes')).length === 0, 'dishes reached the menu before the owner applied the import');
      if (nFix) await owner.locator('[data-fix]').scrollIntoViewIfNeeded();
      await s.shot();
      return `Pasted the text copied from the café's own Wolt page (${input.wolt.text.split('\n').length} lines); read on the phone, no model and no cost: ${sections} sections, ${dishes} dishes, ${groups} add-on groups, ${options} choices. ${nFix} to fix and ${nCheck} to check are listed; nothing is on the menu yet.`;
    });

    await w.step({ id: 'owner-fix', name: 'The owner fixes the listed exceptions and applies the import', side: 'owner', budgetMs: budgetOf('owner-fix', env), page: owner }, async (s) => {
      const fixed = await fixAll();
      const checks = await owner.locator('[data-check] [data-exception]').evaluateAll((els) => els.map((e) => `${e.dataset.code}: ${e.dataset.choice}`));
      await owner.locator('[data-apply]').scrollIntoViewIfNeeded();
      await s.shot();
      await applyImport();
      const dishes = await rows('dishes');
      must(dishes.length > 0, 'the menu has no dish after applying');
      return `Fixed ${fixed.length}: ${fixed.join('; ') || 'nothing was open'}. Left ${checks.length} checks at their defaults (${checks.join(', ')}); confirmed the prices; applied: ${dishes.length} dishes on the menu, nothing published.`;
    });

    await w.step({ id: 'owner-import-screenshots', name: 'The owner imports screenshots of the Wolt page', side: 'owner', budgetMs: budgetOf('owner-import-screenshots', env), page: owner }, async (s) => {
      await go('onboarding/menu');
      const card = owner.locator('[data-source="wolt_screenshots"]');
      await card.waitFor();
      if ((await card.getAttribute('data-available')) !== 'yes' || !stub) {
        await card.scrollIntoViewIfNeeded();
        s.skip(env === 'demo' ? 'Not available here yet: the scanner is not deployed on “mana” (Daniel’s gate, B29). The menu came from the Wolt text.' : 'This run\'s input has no screenshots.');
        return 'The screenshots card says the scanner is not available here, and offers the text ways.';
      }
      const before = (await rows('dishes')).length;
      await card.click();
      await owner.locator('[data-image-import="wolt_screenshots"]').waitFor();
      // stand-in pictures: the recorded reply is what the scanner "reads" from them (e2e/scan-stub.mjs)
      const { TINY_PNG } = await import('../scan-stub.mjs');
      const n = shots.count ?? 2;
      await owner.locator('[data-field="import-files"]').setInputFiles(Array.from({ length: n }, (_, i) => ({ name: `wolt-${i + 1}.png`, mimeType: 'image/png', buffer: TINY_PNG })));
      await owner.locator(`[data-chosen="${n}"]`).waitFor();
      await owner.locator('[data-action="read-pictures"]').click();
      await owner.locator('[data-review]').waitFor({ timeout: 60_000 });
      const [, dishes] = (await owner.locator('[data-counts]').getAttribute('data-counts')).split('/').map(Number);
      await s.shot();
      const fixed = await fixAll();
      await applyImport();
      const after = (await rows('dishes')).length;
      return `Chose ${n} screenshots of the page; the scanner read them (here a local stand-in: the real handler with a recorded reply, nothing paid): ${dishes} dishes read${fixed.length ? `, ${fixed.length} fixed` : ''}; applied: ${after - before} added to the menu.`;
    });

    await w.step({ id: 'owner-addons', name: 'The owner sets the “side of choice” groups and a nested sauce', side: 'owner', budgetMs: budgetOf('owner-addons', env), page: owner }, async (s) => {
      const a = input.addons, done = [];
      await go('onboarding/addons');
      await onStep('addons');
      const groupRow = (name) => owner.locator('[data-ob-group]').filter({ has: owner.locator('.row-name', { hasText: name }) }).first();
      const editor = owner.locator('[data-screen="group-editor"]');
      const backToFlow = async () => { await owner.locator('[data-back-to-setup="addons"]').click(); await onStep('addons'); };
      // the sauce: one required choice (its limits were a guess)
      must(await groupRow(a.sauce).count(), `no add-on group "${a.sauce}" after the import`);
      const sauceId = await groupRow(a.sauce).getAttribute('data-ob-group');
      await groupRow(a.sauce).locator('a').click();
      await editor.waitFor();
      if (a.sauceRequired) {
        const single = editor.getByRole('button', { name: 'בחירה אחת', exact: true });
        if ((await single.getAttribute('aria-pressed')) !== 'true') await single.click();
        const req = editor.getByRole('switch', { name: 'חובה לבחור' });
        if ((await req.getAttribute('aria-checked')) !== 'true') await req.click();
      }
      const save = editor.locator('[data-action="save-group"]');
      if (await save.isEnabled()) { await save.click(); await editor.locator('[data-action="save-group"][disabled]').waitFor(); done.push(`made "${a.sauce}" ${plain(await editor.locator('[data-rule]').innerText())}`); }
      if (await editor.locator('[data-action="confirm-limits"]').count()) await editor.locator('[data-action="confirm-limits"]').click();
      await editor.locator('[data-limits-unconfirmed]').waitFor({ state: 'detached' });
      await backToFlow();
      // the side of choice: the opener opens the sauce (set here unless the import already did)
      must(await groupRow(a.side).count(), `no add-on group "${a.side}" after the import`);
      await groupRow(a.side).locator('a').click();
      await editor.waitFor();
      const names = await editor.locator('[data-field^="option-name-"][data-field$="-he"]').evaluateAll((els) => els.map((e) => e.value));
      const i = names.indexOf(a.opener);
      must(i >= 0, `"${a.side}" has no choice "${a.opener}"`);
      const opens = editor.locator(`[data-field="option-opens-${i}"]`);
      if ((await opens.inputValue()) !== sauceId) {
        await opens.selectOption(sauceId);
        await editor.locator('[data-action="save-group"]').click();
        await editor.locator('[data-action="save-group"][disabled]').waitFor();
        done.push(`made "${a.opener}" open "${a.sauce}"`);
      } else done.push(`"${a.opener}" opens "${a.sauce}" as imported`);
      if (await editor.locator('[data-action="confirm-limits"]').count()) await editor.locator('[data-action="confirm-limits"]').click();
      await editor.locator('[data-limits-unconfirmed]').waitFor({ state: 'detached' });
      await backToFlow();
      // every other group's limits, as imported
      for (let k = 0; k < 20 && (await owner.locator('[data-ob-group][data-confirmed="no"]').count()); k++) {
        const row = owner.locator('[data-ob-group][data-confirmed="no"]').first();
        const name = plain(await row.locator('.row-name').innerText());
        await row.locator('a').click();
        await editor.locator('[data-action="confirm-limits"]').click();
        await editor.locator('[data-limits-unconfirmed]').waitFor({ state: 'detached' });
        done.push(`confirmed "${name}" as imported`);
        await backToFlow();
      }
      // the side of choice on more dishes
      for (const x of a.attach ?? []) {
        await go('menu');
        await owner.getByRole('link', { name: `עריכת ${x.dish}`, exact: true }).click();
        const sheet = owner.locator('dialog[data-sheet="dish"]');
        await sheet.waitFor();
        await sheet.getByRole('tab', { name: 'תוספות' }).click();
        const attached = sheet.locator('[data-dish-addons] .attached');
        const n0 = await attached.count();
        await sheet.locator('[data-action="attach"]').click();
        await sheet.getByRole('button', { name: `לחבר את ${x.group}`, exact: true }).click();
        await until(() => attached.count(), n0 + 1, `"${x.group}" attached to "${x.dish}"`);
        done.push(`attached "${x.group}" to "${x.dish}"`);
      }
      await go('addons');
      await owner.locator('[data-screen="addons"] [data-group]').first().waitFor();
      await s.shot();
      await go('onboarding/addons');
      await onStep('addons');
      await owner.locator('[data-action="flow-done"]').click();
      await owner.locator('[data-screen="onboarding"]:not([data-step="addons"])').waitFor();
      must((await rows('addon_groups', { limits_confirmed: 'eq.false' })).length === 0, 'a group\'s limits are still unconfirmed');
      return done.join('; ') + '.';
    });

    await w.step({ id: 'owner-rules', name: 'The owner adds two suggestion rules', side: 'owner', budgetMs: budgetOf('owner-rules', env), page: owner }, async (s) => {
      const ed = owner.locator('[data-screen="rule-editor"]');
      for (const r of input.rules) {
        await go('rules/new');
        await ed.waitFor();
        await ed.locator('[data-targets="scope"] [data-action="pick-scope"]').click();
        const pick = owner.locator('dialog[data-sheet="pick"]');
        await pick.getByRole('checkbox', { name: r.after, exact: true }).check();
        await pick.locator('[data-action="pick-done"]').click();
        await pick.waitFor({ state: 'detached' });
        await ed.locator('[data-field="rule-suggest-dish"]').selectOption({ label: r.suggest });
        if (r.line?.he) await ed.locator('[data-field="rule-line-he"]').fill(r.line.he);
        if (r.line?.en) {
          await ed.getByRole('button', { name: 'English', exact: true }).click();
          await ed.locator('[data-field="rule-line-en"]').fill(r.line.en);
          await ed.getByRole('button', { name: 'עברית', exact: true }).click();
        }
        await ed.locator('[data-action="save-rule"]').click();
        await owner.locator('[data-screen="rule-editor"]:not([data-rule="new"])').waitFor();
      }
      await go('rules');
      await owner.locator('[data-summary]').nth(input.rules.length - 1).waitFor();
      const lines = (await owner.locator('[data-summary]').allInnerTexts()).map(plain);
      must(lines.length === input.rules.length, `the rules list shows ${lines.length} rules`);
      return `Two suggestions, each after a dish is added: ${lines.map((l) => `“${l}”`).join(' and ')}.`;
    });

    await w.step({ id: 'owner-breakfast', name: 'The owner sets breakfast hours', side: 'owner', budgetMs: budgetOf('owner-breakfast', env), page: owner }, async (s) => {
      const b = input.breakfast;
      await go('hours/parts');
      await owner.locator('[data-action="new-daypart"]').click();
      const sch = owner.locator('dialog[data-sheet="schedule"]');
      await sch.locator('[data-field="schedule-name-he"]').fill(b.name.he);
      if (b.name.en) {
        await sch.getByRole('button', { name: 'English', exact: true }).click();
        await sch.locator('[data-field="schedule-name-en"]').fill(b.name.en);
      }
      const from = await sch.locator('[data-field="w0-from"]').inputValue(), to = await sch.locator('[data-field="w0-to"]').inputValue();
      await sch.locator('[data-action="save-schedule"]').click();
      await owner.locator('[data-schedule]', { hasText: b.name.he }).waitFor();
      const [section] = await rows('sections', { name_he: `eq.${b.section}` });
      must(section, `no section "${b.section}"`);
      await go('menu/s/' + section.id);
      const sec = owner.locator('dialog[data-sheet="section"]');
      await sec.locator('[data-field="section-daypart"]').selectOption({ label: b.name.he });
      await sec.locator('[data-action="save-section"]').click();
      await owner.locator(`section[data-section="${section.id}"] .sec-part`).waitFor();
      const shown = plain(await owner.locator(`section[data-section="${section.id}"] .sec-part`).innerText());
      await owner.locator(`section[data-section="${section.id}"]`).scrollIntoViewIfNeeded();
      return `Breakfast, a day part every day ${from}–${to}, on the section "${b.section}": "${shown}". The place itself stays open all day.`;
    });

    await w.step({ id: 'owner-publish', name: 'The owner finishes the setup and publishes', side: 'owner', budgetMs: budgetOf('owner-publish', env), page: owner }, async (s) => {
      await go('onboarding');
      const later = [];
      for (let k = 0; k < 12; k++) {
        await owner.locator('[data-screen="onboarding"]').waitFor();
        const step = await owner.locator('[data-screen="onboarding"]').getAttribute('data-step');
        if (step === 'publish') break;
        if (step === 'hours' || step === 'addons') await owner.locator('[data-action="flow-done"]').click();
        else if (step === 'photos' || step === 'style' || step === 'test') { await owner.locator('[data-action="flow-later"]').click(); later.push(step); }
        else throw new Error(`the setup stopped at "${step}"`);
        await owner.locator(`[data-screen="onboarding"]:not([data-step="${step}"])`).waitFor();
      }
      await onStep('publish');
      await owner.locator('[data-publish] [data-action="publish"]:not([disabled])').click();
      await owner.locator('[data-standing-card="pending"]').waitFor({ timeout: 30_000 });
      await owner.locator('[data-qr-card] [data-demo="card"]').waitFor();
      const qr = decodeURIComponent((await owner.locator('[data-qr-card] img[data-qr]').getAttribute('src')).split(',')[1] ?? '');
      must(qr.includes('data-demo="mark"'), 'the QR code carries no demo mark');
      const pub = await anon.rpc('public_menu', { p_slug: slug });
      must(pub.state === 'unavailable', `guests see "${pub.state}" before Halom approves`);
      await owner.locator('[data-standing-card]').scrollIntoViewIfNeeded();
      return `Left ${later.join(', ') || 'nothing'} for later, kept the place open all day, and published version 1: it waits for Halom's approval, so guests see "not available yet"; the QR code and the table card carry the demo mark.`;
    });

    // ---------------------------------------------------------------- Halom's desk
    const staff = await newPage(browser, DESK, { init: () => { window.__OPS_POLL_MS = 2000; window.__OPS_SAFETY_MS = 4000; } });
    const venuePage = staff.locator(`[data-page=venue][data-venue="${slug}"]`);
    async function staffWrite(id, text) {
      const box = staff.locator(`[data-write=${id}]`);
      await box.locator('[data-reason]').fill(text);
      await box.locator('[data-review]').click();
      const what = plain(await box.locator('[data-what]').innerText());
      await box.locator('[data-go]').click();
      await box.locator('[data-write-result]').waitFor({ timeout: 20_000 }).catch(async (e) => {
        const said = await box.locator('[data-write-error]').innerText().catch(() => '');
        throw new Error(`${id}: ${said ? `the page says “${plain(said)}”` : e.message.split('\n')[0]}`);
      });
      return what;
    }

    await w.step({ id: 'staff-approve', name: 'Halom approves the first publish', side: 'staff', budgetMs: budgetOf('staff-approve', env), page: staff }, async (s) => {
      await staff.goto(site + 'ops/');
      await staff.getByLabel('E-mail').fill(staffLogin.email);
      await staff.getByLabel('Password').fill(staffLogin.password);
      await staff.getByRole('button', { name: 'Sign in' }).click();
      await staff.locator('[data-page=clients]').waitFor({ timeout: 30_000 });
      await staff.locator('[data-search]').fill(slug);
      const row = staff.locator(`[data-venue="${slug}"]`).first();
      await row.waitFor({ timeout: 30_000 });
      const waiting = await row.locator('[data-warning=awaiting_review]').count();
      await row.locator('[data-open]').click();
      await venuePage.locator('[data-panel=timeline]').waitFor();
      let labelled = 'already a demo venue';
      if (plain(await staff.locator('[data-demo-now]').innerText()) !== 'a demo venue') {
        await staffWrite('demo', 'A demo venue: the client walkthrough');
        await until(async () => plain(await staff.locator('[data-demo-now]').innerText()), 'a demo venue', 'the demo label');
        labelled = 'labelled it a demo venue (its guests stay out of real totals)';
      }
      await staff.locator('[data-panel=revision] [data-revision="1"]').waitFor();
      const what = await staffWrite('approve', 'Menu read through, version 1 (client walkthrough)');
      await staff.locator('[data-badge=review-approved]').waitFor({ timeout: 20_000 });
      const pub = await anon.rpc('public_menu', { p_slug: slug });
      must(pub.state === 'ok', `guests still see "${pub.state}" after the approval`);
      await staff.locator('[data-panel=approved]').scrollIntoViewIfNeeded().catch(() => {});
      return `Found the venue in the clients list${waiting ? ' (waiting for review)' : ''}; ${labelled}; read version 1 and approved it with a reason: "${what}". Guests can open the menu now.`;
    });

    // ---------------------------------------------------------------- a guest's phone
    const guest = await newPage(browser, PHONE);
    guest.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/rpc/track_events')) { try { state.guestEvents.push(...JSON.parse(r.postData()).p_events); } catch { /* not JSON */ } } });
    let idx = null;
    const g = input.guest;
    const sheetSug = guest.locator('#v2SheetSug .v2-sug');
    const lines = () => guest.evaluate(() => window.__mana.v2().lines.length);
    const optionLocator = (c) => guest.locator((c.opener ? `.v2-nested[data-for="${c.opener.id}"] ` : '#v2Groups > .v2-group > ') + `[data-o="${c.option.id}"]`);

    await w.step({ id: 'guest-choose', name: 'A guest chooses add-ons and accepts a suggestion', side: 'guest', budgetMs: budgetOf('guest-choose', env), page: guest }, async (s) => {
      await guest.goto(`${origin.replace(/\/$/, '')}/m/${slug}?t=1&gl=off`);
      await guest.waitForFunction(() => window.__mana && window.__mana.state() && window.__mana.v2(), null, { timeout: 30_000 });
      const pub = await anon.rpc('public_menu', { p_slug: slug });
      idx = menuIndex(pub.snapshot);
      const dish = idx.dish(g.dish);
      await guest.locator(`.row[data-id="${dish.id}"]`).click();
      await guest.locator('#addBtn2').waitFor();
      for (const name of g.choose) await optionLocator(idx.choice(dish, name)).click();
      const priced = plain(await guest.locator('#addBtn2').innerText());
      await guest.locator('#addBtn2').click();
      await sheetSug.waitFor({ timeout: 15_000 });
      const offered = plain(await sheetSug.innerText());
      must(offered.includes(g.accepts), `the suggestion offered was not "${g.accepts}": ${offered}`);
      await s.shot();
      await sheetSug.locator('.primary').click();
      await until(lines, 2, 'the accepted suggestion on the table');
      return `Opened the menu from the table's QR code (the list view). ${g.dish} with ${g.choose.join(' and ')} (${priced.split('·').pop().trim()}), added; one suggestion: “${offered}”. Accepted: it is on the table now.`;
    });

    await w.step({ id: 'guest-dismiss', name: 'The guest dismisses another suggestion', side: 'guest', budgetMs: budgetOf('guest-dismiss', env), page: guest }, async (s) => {
      await guest.keyboard.press('Escape');
      const dish = idx.dish(g.then);
      await guest.locator(`.row[data-id="${dish.id}"]`).click();
      await guest.locator('#addBtn2').waitFor();
      await guest.locator('#addBtn2').click();
      await sheetSug.waitFor({ timeout: 15_000 });
      const offered = plain(await sheetSug.innerText());
      must(offered.includes(g.dismisses), `the suggestion offered was not "${g.dismisses}": ${offered}`);
      await sheetSug.locator('.ghost').click();
      await guest.locator('#v2SheetSug').waitFor({ state: 'hidden' });
      must((await lines()) === 3, 'dismissing added or removed something');
      await guest.keyboard.press('Escape');
      await guest.locator('#trayBtn').click();
      await guest.locator('#traySheet.open').waitFor();
      const total = plain(await guest.locator('#trayTotal').innerText());
      await guest.evaluate(() => window.__mana.flush());
      const names = state.guestEvents.reduce((m, e) => ((m[e.name] = (m[e.name] ?? 0) + 1), m), {});
      state.expectedOpens += names.menu_opened ?? 0;
      return `${g.then}, added; its suggestion “${offered}” dismissed: nothing added, every choice kept. My table: 3 lines, ${total}, VAT included. The phone sent ${state.guestEvents.length} events (${Object.entries(names).map(([k, v]) => `${k} ${v}`).join(', ')}), no personal data.`;
    });

    await w.step({ id: 'guest-load', name: 'More guests visit (bots, for load)', side: 'guest', budgetMs: budgetOf('guest-load', env), page: guest }, async () => {
      const n = input.load?.guests ?? 8;
      const crowd = await runRandom(target, { slug, guests: n, minutes: 20, seed: Number.parseInt(crypto.randomBytes(2).toString('hex'), 16) });
      must(crowd.violations.length === 0, `a suggestion broke Hopa test 10: ${JSON.stringify(crowd.violations[0])}`);
      must(crowd.results.rejected === 0 && crowd.results.uncertain === 0, `events refused: ${JSON.stringify(crowd.results)}`);
      const L = crowd.ledger;
      state.expectedOpens += L.n('menu_opened');
      if (stack) await stack.buildRollups();                                          // on demo, pg_cron does it once a minute
      return `${n} more guests, bots over the public API: ${L.n('menu_opened')} menu opens, ${L.n('dish_viewed')} dish views, ${L.n('suggestion_shown')} suggestions shown (${L.n('suggestion_accepted')} accepted); none suggested what a guest had, what was off or what a filter hid.`;
    });

    // ---------------------------------------------------------------- the owner, mid-service
    await w.step({ id: 'owner-off', name: 'The owner takes a dish off for two hours from the phone', side: 'owner', budgetMs: budgetOf('owner-off', env), page: owner }, async () => {
      const [dish] = await rows('dishes', { name_he: `eq.${input.offForTwoHours}` });
      must(dish, `no dish "${input.offForTwoHours}"`);
      state.offDish = dish;
      await go('home');
      await owner.locator('[data-screen="home"]').waitFor();
      const t0 = Date.now();
      await owner.locator('[data-act="off2h"]').click();
      await owner.locator(`dialog[data-sheet="off2h"] [data-off2h="${dish.id}"]`).click();
      const row = owner.locator(`[data-off-row="${dish.id}"]`);
      await row.waitFor();
      const back = /\d\d:\d\d/.exec(plain(await row.innerText()))?.[0] ?? '';
      const live = (await anon.rpc('public_menu', { p_slug: slug })).live;
      const off = live.off.find((o) => o.id === dish.id);
      must(off?.until, 'guests do not see the dish off');
      const until = Date.parse(off.until);
      must(until >= t0 + 2 * 3600_000 - 1000 && until <= Date.now() + 2 * 3600_000 + 60_000, `back at ${off.until}, not in two hours`);
      await row.scrollIntoViewIfNeeded();
      return `From Home, two taps: “${dish.name_he}” off for two hours, back at ${back}. Guests see it greyed at once (the live overlay), never orderable.`;
    });

    // ---------------------------------------------------------------- Halom watches, and acts once for the owner
    await w.step({ id: 'staff-observe', name: 'Halom sees the onboarding, the live numbers and the activity', side: 'staff', budgetMs: budgetOf('staff-observe', env), page: staff }, async () => {
      await staff.reload();
      await venuePage.locator('[data-panel=timeline]').waitFor({ timeout: 30_000 });
      const ms = env === 'demo' ? 170_000 : 45_000;
      await until(async () => Number(plain(await staff.locator('[data-strip] [data-opens-hour]').innerText()).replace(/\D/g, '')), state.expectedOpens, 'menu opens in the last hour on the venue page', ms, 1000);
      const summary = plain(await staff.locator('[data-onboarding-summary]').innerText());
      for (const action of ['import.apply', 'menu.publish', 'venue.approve', 'availability_overrides.insert']) {
        await staff.locator(`[data-panel=timeline] [data-action="${action}"]`).first().waitFor({ timeout: ms });
      }
      await until(() => staff.locator(`[data-menu-row=dish][data-id="${state.offDish.id}"]`).getAttribute('data-off'), 'yes', 'the dish off on the venue page', ms);
      await staff.evaluate(() => window.scrollTo(0, 0));
      return `The venue's page: onboarding “${summary}”; live, ${state.expectedOpens} menu opens in the last hour (the phone and the bots, demo traffic); the timeline lists the import, the publish, the approval and the owner's two-hour sold-out, and the menu marks “${state.offDish.name_he}” off.`;
    });

    await w.step({ id: 'staff-act', name: 'Halom acts for the owner to restore the dish, with a reason', side: 'staff', budgetMs: budgetOf('staff-act', env), page: staff }, async () => {
      const dish = staff.locator(`[data-menu-row=dish][data-id="${state.offDish.id}"]`);
      await dish.scrollIntoViewIfNeeded();
      await dish.locator('[data-restore]').click();
      const what = await staffWrite('act', reason);
      await until(() => dish.getAttribute('data-off'), 'no', 'the dish back on the venue page');
      const acted = staff.locator('[data-panel=timeline] [data-action="support.act_for_owner"]').first();
      await acted.waitFor({ timeout: 20_000 });
      must(plain(await acted.locator('[data-reason-shown]').innerText()).includes(reason), 'the timeline does not show the reason');
      const live = (await anon.rpc('public_menu', { p_slug: slug })).live;
      must(!live.off.some((o) => o.id === state.offDish.id), 'guests still see the dish off');
      await acted.scrollIntoViewIfNeeded();
      return `“${what}” with the reason “${reason}”: the dish is back for guests at once, and the timeline records Halom's act.`;
    });

    await w.step({ id: 'owner-log', name: 'The owner sees Halom’s act in the activity log', side: 'owner', budgetMs: budgetOf('owner-log', env), page: owner }, async () => {
      await go('activity');
      await owner.locator('[data-screen="activity"][data-state="ready"]').waitFor({ timeout: 20_000 });
      const entry = owner.locator('[data-activity][data-action="support.act_for_owner"][data-who="halom"]').first();
      await entry.waitFor();
      const said = plain(await entry.locator('[data-reason]').innerText());
      must(said.includes(reason), `the log shows "${said}"`);
      must(!/@/.test(await owner.locator('.actlog').innerText()), 'the log names a staff member');
      const what = plain(await entry.locator('.actrow-what').innerText().catch(() => ''));
      await entry.scrollIntoViewIfNeeded();
      return `The activity log shows it as Halom's, never a staff member's name: “${what}”, ${said}.`;
    });
  } finally {
    file = writePage(w, { file: path.join(outDir, 'walkthrough.html'), title, env, invented: !!input.invented, about: input.about ?? '' });
    await browser.close().catch(() => {});
  }
  const summary = w.summary();
  log(`  the walkthrough: ${summary.passed} of ${summary.total} steps passed${summary.skipped ? `, ${summary.skipped} not available here` : ''}${summary.failed ? `, ${summary.failed} failed` : ''} in ${(summary.ms / 1000).toFixed(0)} s`);
  return { ok: summary.failed === 0 && summary.notRun === 0, summary, steps: w.steps, file, slug, venueId: state.venueId, runId };
}
