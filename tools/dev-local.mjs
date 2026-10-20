#!/usr/bin/env node
/* npm run dev:local (Linux x64): the simulator's stack (sim/stack) with Café Demo seeded, the site built against it
   (MANA_ENV=local) and served, in one command. config/local.js is written from the stack's address and its local keys;
   git ignores it and it is never committed. Nothing here reaches a remote database. docs/environments.md has the rest.

     npm run dev:local                        stack (ports from SIM_PORT_BASE, default 57500) + Café Demo + build + serve
     npm run dev:local -- --guests 30         also 30 seeded-random guests (sim/src/random.mjs), so the numbers move
     npm run dev:local -- --no-build          serve the _site/ already built with MANA_ENV=local

   The site is served on the stack's web port (SIM_PORT_BASE + 80), the address the stack's GoTrue knows as the site.
   Ctrl-C stops the server and the stack. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { HalomBot, loadSeed, readSeed, runRandom, SEEDS } from '@mana/sim';
import { startStack } from '@mana/sim/stack';
import { CONFIG_FILES, configProblems, localConfigText, readConfig, ROOT } from './env.mjs';
import { parseArgs, printLinks, serveSite, siteLinks } from './serve-site.mjs';

/* the accounts the seed is loaded with (local only); their passwords are the simulator's local defaults, in
   sim/src/owner.mjs (OwnerBot.signUp) and sim/src/halom.mjs (HalomBot.firstAdmin) */
const SLUG = 'cafe-demo', OWNER = `owner.${SLUG}@example.invalid`, ADMIN = 'admin.local@example.invalid';

async function main(argv) {
  const a = parseArgs(argv, ['no-build']);
  if (a._.length) throw new Error(`unexpected "${a._[0]}"; usage: npm run dev:local -- [--guests N] [--no-build]`);
  if (!(process.platform === 'linux' && process.arch === 'x64')) {
    throw new Error('dev:local needs Linux x64: the stack runs the GoTrue release, a Linux binary (sim/README.md). On a Mac: npm run demo');
  }
  const guests = a.guests === undefined ? 0 : Number(a.guests);
  if (!Number.isInteger(guests) || guests < 0) throw new Error('--guests takes a whole number');

  const t0 = Date.now();
  const stack = await startStack({ quiet: false });
  let web = null;
  const stop = async () => { if (web) await web.close(); await stack.stop(); };
  try {
    console.log(`· stack up in ${((Date.now() - t0) / 1000).toFixed(1)} s: ${stack.apiUrl}${stack.notes.length ? ' (' + stack.notes.join('; ') + ')' : ''}`);
    const halom = await HalomBot.firstAdmin(stack, stack, { email: ADMIN });
    const r = await loadSeed(stack, readSeed(path.join(SEEDS, `${SLUG}.json`)).seed, { ownerEmail: OWNER, halom });
    console.log(`· seeded ${r.slug}: revision ${r.published?.revision}, ${r.approved ? 'approved by Halom' : 'review ' + r.published?.review}`);
    if (guests) {
      const g = await runRandom(stack, { slug: SLUG, guests, minutes: 30, seed: 1 });
      await stack.buildRollups();
      console.log(`· ${guests} random guests:`, g.results);
    }

    const file = path.join(ROOT, CONFIG_FILES.local);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, localConfigText({ apiUrl: stack.apiUrl, anonKey: stack.anonKey }));
    console.log(`· wrote ${CONFIG_FILES.local} (git-ignored)`);
    if (!a['no-build']) {
      const b = spawnSync('bash', [path.join(ROOT, 'tools/build-site.sh')], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, MANA_ENV: 'local' } });
      if (b.status !== 0) throw new Error('the local build failed (above)');
    }
    /* the build must be for this very stack: its address and its key (a --no-build after another stack is refused) */
    const origin = `http://127.0.0.1:${stack.ports.web}`, built = path.join(ROOT, '_site/config.js');
    const problems = fs.existsSync(built) ? configProblems('local', readConfig(built, { origin }), { origin, stack }) : ['there is no _site/config.js'];
    if (problems.length) throw new Error(`_site/ is not a build for this stack (${problems[0]}${problems.length > 1 ? `; ${problems.length - 1} more` : ''}): run npm run dev:local without --no-build`);
    web = await serveSite({ site: path.join(ROOT, '_site'), port: stack.ports.web, host: '127.0.0.1', settings: { expected: 'local', stack } });

    console.log(`\nMana on this machine: the simulator's stack, schema 2; Ctrl-C stops it`);
    printLinks([...siteLinks(web.origin, { slug: SLUG }), ['api', `${stack.apiUrl}  (/rest/v1, /auth/v1)`], ['postgres', stack.dbUrl]]);
    console.log('\nLocal accounts (this machine only; passwords: the simulator\'s defaults in sim/src/owner.mjs and sim/src/halom.mjs)');
    printLinks([['owner of Café Demo', OWNER], ['Halom admin', ADMIN]]);
  } catch (e) {
    await stop();
    throw e;
  }
  const bye = async () => { await stop(); process.exit(0); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}

main(process.argv.slice(2)).catch((e) => { console.error('✗ ' + e.message); process.exit(1); });
