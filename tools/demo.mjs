#!/usr/bin/env node
/* npm run demo: the site built with the demo settings (config/demo.js: the Supabase project `mana`, schema 2) and served
   on this machine as halom.io serves it (tools/serve-site.mjs). It needs Node 22.18+ and nothing else (no PostgreSQL,
   no Docker, no Linux binaries), so it runs on a Mac. docs/environments.md has the rest.

     npm run demo                                   build (MANA_ENV=demo bash tools/build-site.sh), then serve on port 4180
     npm run demo -- --no-build                     serve the _site/ already built with the demo settings
     npm run demo -- --port 4181 --host 0.0.0.0     another port; open to the Wi-Fi, so a phone can follow a demo QR code
     npm run demo -- --scenario <name>              prepare a scenario (D38) once the site is up, then serve

   A scenario is a module exporting `async run({ config, origin, root, log })`, which may return { links: [[label, path]] }
   to print (paths on the demo server, for example '/m/<slug>'). It is looked for as tools/demo-scenarios/<name>.mjs (in
   the repository: synthetic data only) and as private/demo-scenarios/<name>.mjs (git-ignored: a client's walkthrough,
   which never enters the repository). An unknown name stops before anything is built. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { configProblems, readConfig, ROOT } from './env.mjs';
import { DEFAULT_PORT, parseArgs, printLinks, serveSite, siteLinks } from './serve-site.mjs';

export const SCENARIO_DIRS = [path.join(ROOT, 'tools/demo-scenarios'), path.join(ROOT, 'private/demo-scenarios')];

/** The scenarios there are, by name, from `dirs` (a name in the first folder wins). */
export function scenarios(dirs = SCENARIO_DIRS) {
  const out = new Map();
  for (const d of dirs) for (const f of fs.existsSync(d) ? fs.readdirSync(d).sort() : []) {
    const m = /^([a-z0-9][a-z0-9-]*)\.mjs$/.exec(f);
    if (m && !out.has(m[1])) out.set(m[1], path.join(d, f));
  }
  return out;
}

/** The file of scenario `name`, or an Error that says which names there are. */
export function findScenario(name, dirs = SCENARIO_DIRS) {
  const all = scenarios(dirs);
  if (all.has(name)) return all.get(name);
  const where = dirs.map((d) => path.relative(ROOT, d) + '/').join(' or ');
  return Object.assign(new Error(`no demo scenario called "${name}" in ${where}; ${all.size ? 'there are: ' + [...all.keys()].join(', ') : 'there are none yet'}`), { exitCode: 2 });
}

async function main(argv) {
  const a = parseArgs(argv, ['no-build']);
  if (a._.length) throw new Error(`unexpected "${a._[0]}"; usage: npm run demo -- [--no-build] [--port N] [--host H] [--scenario name]`);
  const scenario = a.scenario ? findScenario(a.scenario) : null;
  if (scenario instanceof Error) throw scenario;
  const site = path.join(ROOT, '_site');
  if (!a['no-build']) {
    const b = spawnSync('bash', [path.join(ROOT, 'tools/build-site.sh')], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, MANA_ENV: 'demo' } });
    if (b.status !== 0) throw new Error('the demo build failed (above)');
  }
  const built = path.join(site, 'config.js');
  if (!fs.existsSync(built)) throw new Error('no _site/config.js: run npm run demo without --no-build');
  const s = await serveSite({ site, port: a.port ? Number(a.port) : DEFAULT_PORT, host: a.host || '127.0.0.1' });
  const config = readConfig(built, { origin: s.origin });
  const problems = configProblems('demo', config, { origin: s.origin });
  if (problems.length) { await s.close(); throw new Error(`_site/ is not a demo build (${problems[0]}): run npm run demo without --no-build`); }
  const links = siteLinks(s.origin);
  if (scenario) {
    console.log(`· scenario ${a.scenario}`);
    const mod = await import(pathToFileURL(scenario).href);
    if (typeof mod.run !== 'function') { await s.close(); throw new Error(`${path.relative(ROOT, scenario)} exports no run()`); }
    const r = (await mod.run({ config, origin: s.origin, root: ROOT, log: (...m) => console.log('  ', ...m) })) || {};
    for (const [label, p] of r.links || []) links.push([label, s.origin + p]);
  }
  console.log(`\nMana demo: ${config.supabaseUrl} (the database \`mana\`, schema ${config.schema}); Ctrl-C stops it`);
  printLinks([...links, ...s.lan.map((o) => ['on the Wi-Fi', `${o}/mana/`])]);
  const bye = async () => { await s.close(); process.exit(0); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error('✗ ' + e.message); process.exit(e.exitCode ?? 1); });
}
