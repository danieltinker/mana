// Scripted (deterministic) scenarios. Each one drives the three sides through their public interfaces and returns
// what each side ended up seeing; the tests in sim/test assert those end states, the CLI prints them.
import path from 'node:path';
import { asAnon } from './client.mjs';
import { GuestBot } from './guest.mjs';
import { HalomBot } from './halom.mjs';
import { Ledger } from './ledger.mjs';
import { OwnerBot } from './owner.mjs';
import { readSeed, SEEDS } from './seed.mjs';

export const bistro = () => readSeed(path.join(SEEDS, 'bistro-sim.json')).seed;

/** Halom's team: the first admin (the README's SQL line, run by `setup`), who invites a support person. */
export async function halomTeam(stack, tag = 'team') {
  const admin = await HalomBot.firstAdmin(stack, stack, { email: `admin.${tag}@example.invalid` });
  const inv = await admin.invite(`support.${tag}@example.invalid`, 'support');
  if (!inv.ok) throw new Error('create_staff_invite: ' + JSON.stringify(inv));
  const support = await HalomBot.join(stack, { email: `support.${tag}@example.invalid`, code: inv.code });
  return { admin, support };
}

/** An owner with a venue built from a seed (not yet published); the venue is flagged as a demo (setup). */
export async function ownerWithMenu(stack, seed, { slug, email = `owner.${slug}@example.invalid` }) {
  const owner = await OwnerBot.signUp(stack, { email });
  const made = await owner.createVenue({ slug, name: seed.venue.name, kind: seed.venue.kind, defaultLang: seed.venue.defaultLang });
  if (!made.ok) throw new Error('create_venue: ' + JSON.stringify(made));
  await stack.setDemo(owner.venueId, seed.venue.demo !== false);
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

/**
 * The phase-0 chain: the owner builds and publishes; Halom's support approves the first publish; guests browse,
 * choose, accept and dismiss suggestions; a visitor of the product page leaves a lead; the owner takes a dish off for
 * two hours; Halom acts for the owner once to restore it; the rollup job runs. Returns every side's view.
 */
export async function phase0Chain(stack, { slug = 'bistro-chain', seed = bistro() } = {}) {
  const team = await halomTeam(stack, slug);
  const { owner, ids } = await ownerWithMenu(stack, seed, { slug });
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
