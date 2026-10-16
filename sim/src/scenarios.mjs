// Scripted (deterministic) scenarios. Each one drives the three sides through their public interfaces and returns
// what each side ended up seeing; the tests in sim/test assert those end states, the CLI prints them.
import path from 'node:path';
import { GUEST_EVENTS } from '@mana/contracts';
import { asAnon } from './client.mjs';
import { GuestBot } from './guest.mjs';
import { HalomBot } from './halom.mjs';
import { Ledger } from './ledger.mjs';
import { OwnerBot } from './owner.mjs';
import { runRandom } from './random.mjs';
import { DEMO_REASON, readSeed, SEEDS } from './seed.mjs';

export const bistro = () => readSeed(path.join(SEEDS, 'bistro-sim.json')).seed;

/** Halom's team: the first admin (the README's SQL line, run by `setup`), who invites a support person. */
export async function halomTeam(stack, tag = 'team') {
  const admin = await HalomBot.firstAdmin(stack, stack, { email: `admin.${tag}@example.invalid` });
  const inv = await admin.invite(`support.${tag}@example.invalid`, 'support');
  if (!inv.ok) throw new Error('create_staff_invite: ' + JSON.stringify(inv));
  const support = await HalomBot.join(stack, { email: `support.${tag}@example.invalid`, code: inv.code });
  return { admin, support };
}

/**
 * An owner with a venue built from a seed (not yet published). Unless the seed says "demo": false, Halom's admin
 * (`halom`, else a first admin made here) labels the venue a demo with ops_set_demo.
 */
export async function ownerWithMenu(stack, seed, { slug, email = `owner.${slug}@example.invalid`, halom = null }) {
  const owner = await OwnerBot.signUp(stack, { email });
  const made = await owner.createVenue({ slug, name: seed.venue.name, kind: seed.venue.kind, defaultLang: seed.venue.defaultLang });
  if (!made.ok) throw new Error('create_venue: ' + JSON.stringify(made));
  if (seed.venue.demo !== false) {
    const admin = halom ?? (await HalomBot.firstAdmin(stack, stack, { email: `admin.${slug}@example.invalid` }));
    const r = await admin.setDemo(owner.venueId, true, DEMO_REASON);
    if (!r.ok) throw new Error('ops_set_demo: ' + JSON.stringify(r));
  }
  const ids = await owner.buildMenu(seed);
  await owner.setOnboarding(seed.onboarding ?? ['menu', 'review', 'addons', 'hours']);
  return { owner, ids };
}

/**
 * The three scripted guests of the phase-0 chain, on Bistro Sim's menu (ids from buildMenu):
 *   A (he, QR): the burger's sheet suggests cheese; picks sweet potato with harissa; accepts the cheese; adds; the "add"
 *     lemonade is dismissed; at checkout the drink rule suggests the lemonade again (another rule) and A accepts.
 *   B (en, link): a large espresso; the croissant is suggested and accepted (nothing follows it: never chained); then a
 *     toast with the defaults; the lemonade suggested after it is ignored.
 *   C (he, link, vegan filter): a cookie; the lemonade suggested after it is dismissed.
 */
export async function scriptedGuests(stack, slug, ids) {
  const D = ids.dishes, G = ids.groups, O = ids.options;
  const log = [];

  const a = new GuestBot(stack, { ip: '10.0.1.1', lang: 'he', src: 'qr' });
  await a.open(slug);
  const cheese = a.view(D.burger);
  log.push(['A', 'sheet', cheese?.ruleId]);
  a.choose(G.side, O['sweet-potato']);
  a.choose(G.sauce, O.harissa, { parentOptionId: O['sweet-potato'] });
  a.accept();
  const aAdd = a.add();
  log.push(['A', 'add', aAdd.ok, aAdd.price?.total, aAdd.suggestion?.ruleId]);
  a.dismiss();
  const aCheckout = a.checkout();
  log.push(['A', 'checkout', aCheckout?.ruleId]);
  const aAccept = a.accept();
  log.push(['A', 'accept lemonade', aAccept.ok, aAccept.suggestion ?? null]);
  await a.flush();

  const b = new GuestBot(stack, { ip: '10.0.1.2', lang: 'en', src: 'link' });
  await b.open(slug);
  b.view(D.espresso);
  b.choose(G.size, O.large);
  const bAdd = b.add();
  log.push(['B', 'add espresso', bAdd.price?.total, bAdd.suggestion?.ruleId]);
  const bAccept = b.accept();
  log.push(['B', 'accept croissant', bAccept.ok, bAccept.suggestion ?? null]);
  b.view(D.toast);
  const bToast = b.add();
  log.push(['B', 'add toast', bToast.price?.total, bToast.suggestion?.ruleId]);
  await b.flush();

  const c = new GuestBot(stack, { ip: '10.0.1.3', lang: 'he', src: 'link', filter: 'vegan' });
  await c.open(slug);
  c.view(D.cookie);
  const cAdd = c.add();
  log.push(['C', 'add cookie', cAdd.price?.total, cAdd.suggestion?.ruleId]);
  c.dismiss();
  await c.flush();

  const ledger = new Ledger().merge(a.ledger).merge(b.ledger).merge(c.ledger);
  return { guests: [a, b, c], ledger, log };
}

/** A venue built from a seed, published, and approved by Halom's support when the first publish waits for review. */
export async function liveFromSeed(stack, seed, slug, team) {
  const { owner, ids } = await ownerWithMenu(stack, seed, { slug, halom: team.admin });
  const published = await owner.publish('simulator');
  if (!published.ok) throw new Error('publish_menu: ' + JSON.stringify(published));
  if (published.review === 'pending') {
    const ok = await team.support.approve(owner.venueId, 'Synthetic venue checked by the simulator');
    if (!ok.ok) throw new Error('ops_approve_venue: ' + JSON.stringify(ok));
  }
  return { owner, ids, slug, venueId: owner.venueId };
}

/**
 * Phase 1 around the dashboards and the back office (ADR-008), on two copies of Bistro Sim: a real venue and a demo
 * one (labelled by Halom's admin with ops_set_demo). Guests use both; the owner of the real one asks for help, Halom
 * answers the case, the owner takes a dish off for two hours from the phone and brings back everything off today,
 * and exports the menu. Returns every side's view; sim/test/phase1.test.mjs asserts them.
 */
export async function phase1Chain(stack, { slug = 'bistro-p1', seed = bistro(), guests = 15, minutes = 10 } = {}) {
  const team = await halomTeam(stack, slug);
  const real = await liveFromSeed(stack, { ...seed, venue: { ...seed.venue, demo: false } }, `${slug}-real`, team);
  const demo = await liveFromSeed(stack, seed, `${slug}-demo`, team);

  // guests: the scripted three on each venue, then a seeded crowd on the real one
  const scripted = { real: await scriptedGuests(stack, real.slug, real.ids), demo: await scriptedGuests(stack, demo.slug, demo.ids) };
  const crowd = await runRandom(stack, { slug: real.slug, guests, minutes, seed: 11 });
  const ledgers = { real: new Ledger().merge(scripted.real.ledger).merge(crowd.ledger), demo: scripted.demo.ledger };
  await stack.buildRollups();

  const minute = Math.floor(Date.now() / 60000) * 60000;
  const lastHour = { resolution: 'minute', from: new Date(minute - 59 * 60000).toISOString(), to: new Date(minute + 60000).toISOString(), names: [...GUEST_EVENTS] };
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const analytics = {
    real: await team.support.analytics(lastHour),
    demo: await team.support.analytics({ ...lastHour, demo: 'only' }),
    all: await team.support.analytics({ ...lastHour, demo: 'include' }),
    venue: await team.support.analytics({ ...lastHour, venueId: real.venueId }),
    day: await team.support.analytics({ resolution: 'day', from: today, to: today, names: [...GUEST_EVENTS] }),
  };
  const dashboard = await real.owner.dashboard('7d');

  // the owner asks for help; Halom answers and waits for the owner
  const asked = await real.owner.askForHelp('menu', 'Is the lemonade price right?', 'Synthetic question from the simulator');
  const help = { asked, list: await team.support.venues({ warning: 'case_open' }), detail: await team.support.venue(real.venueId) };
  help.updated = await team.support.updateCase(asked.caseId, { status: 'waiting_owner', reason: 'Asked the owner which price is right' });
  help.listAfter = await team.support.venues({ warning: 'case_open' });
  help.dashboard = await real.owner.dashboard('today');
  help.activity = await real.owner.activityPage({ limit: 20 });

  // the phone: the toast off for two hours, seen at once; then everything off today back
  const watcher = new GuestBot(stack, { ip: '10.0.2.9' });
  await watcher.open(real.slug, { track: false });
  const phone = { off: await real.owner.setAvailability('dish', real.ids.dishes.toast, { kind: 'duration', minutes: 120 }) };
  await watcher.refresh();
  phone.whileOff = { live: watcher.live, toast: watcher.availability(real.ids.dishes.toast), offNow: (await real.owner.dashboard('today')).offNow };
  phone.restored = await real.owner.restoreToday();
  await watcher.refresh();
  phone.after = { live: watcher.live, toast: watcher.availability(real.ids.dishes.toast) };

  return {
    team, real, demo, scripted, crowd, ledgers, analytics, dashboard, help, phone,
    exported: await real.owner.exportMenu(),
    demoActivity: await demo.owner.activityPage({ limit: 100 }),
    totals: (await team.support.venues({})).totals,
  };
}

/**
 * The phase-0 chain: the owner builds and publishes; Halom's support approves the first publish; guests browse,
 * choose, accept and dismiss suggestions; a visitor of the product page leaves a lead; the owner takes a dish off for
 * two hours; Halom acts for the owner once to restore it; the rollup job runs. Returns every side's view.
 */
export async function phase0Chain(stack, { slug = 'bistro-chain', seed = bistro() } = {}) {
  const team = await halomTeam(stack, slug);
  const { owner, ids } = await ownerWithMenu(stack, seed, { slug, halom: team.admin });
  const published = await owner.publish('opening day');
  const before = { menu: await asAnon(stack).rpc('public_menu', { p_slug: slug }), card: await team.support.venueCard(owner.venueId) };
  const approved = await team.support.approve(owner.venueId, 'First menu checked: prices and add-ons look right');

  const guests = await scriptedGuests(stack, slug, ids);

  const lead = await asAnon(stack, { ip: '10.0.9.9' }).rpc('submit_lead', {
    p_token: '7a1b2c3d-0000-4000-8000-00000000c0de', p_message: 'Interested in a menu for a synthetic test café', p_contact: 'lead.sim@example.invalid',
    p_name: null, p_venue_name: 'Synthetic Test Café', p_locale: 'en', p_source: 'mana-landing', p_hp: '', p_elapsed_ms: 8000,
  });

  const off = await owner.soldOut('dish', ids.dishes.toast, { kind: 'duration', minutes: 120 }, 'out of bread');
  const watcher = new GuestBot(stack, { ip: '10.0.1.4' });
  await watcher.open(slug, { track: false });
  const whileOff = { live: watcher.live, toast: watcher.availability(ids.dishes.toast), price: watcher.price(ids.dishes.toast, { quantity: 1, groups: [] }) };

  const rollups = await stack.buildRollups();
  const act = await team.support.actForOwner(owner.venueId, 'Owner called: the bread arrived', 'availability.restore', { targetKind: 'dish', targetId: ids.dishes.toast });
  await watcher.refresh();
  const afterRestore = { live: watcher.live, toast: watcher.availability(ids.dishes.toast) };
  const leads = await team.support.leads();

  return {
    slug, ids, owner, team, published, approved, before, guests, lead, off, whileOff, rollups, act, afterRestore, leads,
    views: {
      guest: await asAnon(stack).rpc('public_menu', { p_slug: slug }),
      revision: await owner.revision(published.revision),
      dashboard: await owner.dashboard('7d'),
      today: await owner.dashboard('today'),
      activity: await owner.activity(),
      card: await team.support.venueCard(owner.venueId),
      staffDashboard: await team.support.dashboard(owner.venueId, '7d'),
      staffActivity: await team.admin.staffActivity(),
    },
  };
}
