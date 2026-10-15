#!/usr/bin/env node
// The simulator from a terminal. Everything runs on this machine against the local stack; nothing reaches a remote
// database. Ports: SIM_PORT_BASE (default 57500).
//
//   sim stack [--keep]                          the local stack; keeps running (Ctrl-C stops it)
//   sim up [seed.json …] [--guests N --minutes M --seed S --realtime]
//                                               a stack, the seeds loaded (default: sim/seeds/cafe-demo.json), random guests;
//                                               keeps running so the numbers can be looked at
//   sim seed <seed.json> [--slug s]             loads a seed into the running stack (private/… for real venues' seeds)
//   sim run --slug s [--guests N --minutes M --seed S --realtime]
//                                               random guests on a running stack's venue; prints what they did and the numbers
//   sim scenario phase0 [--slug s]              the scripted phase-0 chain on a running stack; prints every side's view
import path from 'node:path';
import { attachStack, startStack } from '../stack/start.mjs';
import { HalomBot } from './halom.mjs';
import { runRandom } from './random.mjs';
import { phase0Chain } from './scenarios.mjs';
import { loadSeed, readSeed, SEEDS } from './seed.mjs';

function parse(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const k = a.slice(2);
    if (['keep', 'realtime'].includes(k)) out[k] = true;
    else out[k] = argv[++i];
  }
  return out;
}

const num = (v, d) => (v === undefined ? d : Number(v));
const say = (...a) => console.log(...a);

async function numbers(stack, venueId) {
  await stack.buildRollups();
  const staff = await HalomBot.firstAdmin(stack, stack, { email: `admin.cli-${Date.now()}@example.invalid` });
  const dash = await staff.dashboard(venueId, '7d');
  const card = await staff.venueCard(venueId);
  return { dashboard: dash.totals, rules: dash.rules.map((r) => ({ label: r.label, shown: r.shown, accepted: r.accepted, dismissed: r.dismissed })), opens: card.opens };
}

async function venueOf(stack, slug) {
  const rows = await stack.sql('select id from public.venues where slug = $1', [slug]);
  if (!rows.length) throw new Error(`no venue "${slug}" on this stack; load one with: sim seed <file>`);
  return rows[0].id;
}

async function random(stack, a) {
  const slug = a.slug ?? 'cafe-demo';
  const t0 = Date.now();
  const r = await runRandom(stack, { slug, guests: num(a.guests, 20), minutes: num(a.minutes, 30), seed: a.seed ?? 1, realtime: !!a.realtime });
  say(`${num(a.guests, 20)} guests on ${slug} in ${((Date.now() - t0) / 1000).toFixed(1)} s:`, r.results);
  say('they did', r.ledger.totals());
  if (r.violations.length) say('SUGGESTION RULE BROKEN', r.violations);
  say('the numbers', JSON.stringify(await numbers(stack, await venueOf(stack, slug)), null, 2));
}

const a = parse(process.argv.slice(2));
const cmd = a._[0];
const hold = (stack) => {
  const bye = async () => { await stack.stop(); process.exit(0); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
  say('running; Ctrl-C stops the stack');
};

try {
  if (cmd === 'stack' || cmd === 'up') {
    const t0 = Date.now();
    const stack = await startStack({ quiet: false, keep: !!a.keep });
    say(`stack up in ${((Date.now() - t0) / 1000).toFixed(1)} s\n  api       ${stack.apiUrl}  (/rest/v1, /auth/v1; apikey header required)\n  postgres  ${stack.dbUrl}\n  notes     ${stack.notes.join('; ') || '-'}`);
    if (cmd === 'up') {
      const files = a._.slice(1).length ? a._.slice(1) : [path.join(SEEDS, 'cafe-demo.json')];
      for (const f of files) {
        const { seed } = readSeed(f);
        const r = await loadSeed(stack, seed);
        say(`seeded ${r.slug}: revision ${r.published?.revision}, review ${r.approved ? 'approved by Halom' : r.published?.review}`);
        if (num(a.guests, 20) > 0) await random(stack, { ...a, slug: r.slug });
      }
    }
    hold(stack);
  } else if (cmd === 'seed') {
    if (!a._[1]) throw new Error('usage: sim seed <seed.json> [--slug s]');
    const stack = await attachStack();
    try {
      const { seed, private: priv } = readSeed(a._[1]);
      const r = await loadSeed(stack, seed, { slug: a.slug ?? seed.venue.slug });
      say(`seeded ${r.slug}${priv ? ' (private seed)' : ''}: revision ${r.published?.revision}, review ${r.approved ? 'approved by Halom' : r.published?.review}`);
      say('sections', Object.keys(r.ids.sections).length, 'dishes', Object.keys(r.ids.dishes).length, 'groups', Object.keys(r.ids.groups).length, 'rules', Object.keys(r.ids.rules).length);
    } finally { await stack.stop(); }
  } else if (cmd === 'run') {
    const stack = await attachStack();
    try { await random(stack, a); } finally { await stack.stop(); }
  } else if (cmd === 'scenario' && a._[1] === 'phase0') {
    const stack = await attachStack();
    try {
      const c = await phase0Chain(stack, { slug: a.slug ?? `bistro-chain-${Date.now().toString(36)}` });
      say('guests', JSON.stringify(c.guests.log));
      say('owner dashboard (7d)', c.views.dashboard.totals);
      say('Halom card', { review: c.views.card.review, opens: c.views.card.opens, suggestions7d: c.views.card.suggestions7d, stage: c.views.card.onboarding.stage });
      say('owner sees', c.views.activity.filter((x) => x.via === 'act_for_owner').map((x) => `${x.action} by ${x.actor_kind}: "${x.reason}"`));
    } finally { await stack.stop(); }
  } else {
    say(`usage:
  sim stack [--keep]
  sim up [seed.json …] [--guests N --minutes M --seed S --realtime]
  sim seed <seed.json> [--slug s]
  sim run --slug s [--guests N --minutes M --seed S --realtime]
  sim scenario phase0 [--slug s]
(ports: SIM_PORT_BASE, default 57500; see sim/README.md)`);
    process.exit(cmd ? 2 : 0);
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
