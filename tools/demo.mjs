#!/usr/bin/env node
/* npm run demo: the site built with the demo settings (config/demo.js: the Supabase project `mana`, schema 2) and served
   on this machine as halom.io serves it (tools/serve-site.mjs). It needs Node 22.18+ and nothing else (no PostgreSQL,
   no Docker, no Linux binaries), so it runs on a Mac. docs/environments.md has the rest.

     npm run demo                                   build (MANA_ENV=demo bash tools/build-site.sh), then serve on port 4180
     npm run demo -- --no-build                     serve the _site/ already built with the demo settings
     npm run demo -- --port 4181 --host 0.0.0.0     another port; open to the Wi-Fi, so a phone can follow a demo QR code
                                                    (sign in only at 127.0.0.1 or on a personal hotspot, never as staff)
     npm run demo -- --scenario <name>              prepare a scenario (D38) once the site is up, then serve

   A scenario is a module exporting `async run({ config, origin, root, outDir, log })`, which may return
   { links: [[label, path]] } to print (paths on the demo server, for example '/m/<slug>'). It is looked for as
   tools/demo-scenarios/<name>.mjs (in the repository: synthetic data only), then as private/demo-scenarios/<name>.mjs
   (git-ignored: a client's walkthrough, which never enters the repository, and whose name and path are never printed,
   not even when it fails). It writes only under private/ (outDir is private/demo-output/<name>/) or _site/: a scenario
   that adds or changes a file git sees, tracked or not, fails. An unknown name stops before anything is built. */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { configProblems, readConfig, ROOT } from './env.mjs';
import { DEFAULT_PORT, originOf, parseArgs, printLinks, serveSite, siteLinks } from './serve-site.mjs';

export const SCENARIO_DIRS = { repository: path.join(ROOT, 'tools/demo-scenarios'), private: path.join(ROOT, 'private/demo-scenarios') };
const namesIn = (d) => (fs.existsSync(d) ? fs.readdirSync(d).sort() : []).map((f) => /^([a-z0-9][a-z0-9-]*)\.mjs$/.exec(f)?.[1]).filter(Boolean);

/** The repository's scenarios, by name (the private ones are never listed). */
export const scenarios = (dirs = SCENARIO_DIRS) => namesIn(dirs.repository);

/** Scenario `name` as { file, label, private } (the repository's first, then a private one, whose label does not name
    it), or an Error that lists only the repository's. */
export function findScenario(name, dirs = SCENARIO_DIRS, root = ROOT) {
  if (namesIn(dirs.repository).includes(name)) return { file: path.join(dirs.repository, name + '.mjs'), label: `the scenario "${name}"`, private: false };
  if (namesIn(dirs.private).includes(name)) return { file: path.join(dirs.private, name + '.mjs'), label: 'the private scenario', private: true };
  const mine = scenarios(dirs), rel = (d) => path.relative(root, d) + '/';
  return Object.assign(new Error(`no demo scenario called "${name}": ${mine.length ? `there are ${mine.join(', ')} in ${rel(dirs.repository)}` : `there is none in ${rel(dirs.repository)} yet`}, or a private one goes in ${rel(dirs.private)}`), { exitCode: 2 });
}

/** What git sees in the checkout (git status: tracked files changed, untracked ones not ignored), each with a digest of
    its content, or null outside a git checkout. */
function gitSees(root) {
  const r = spawnSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return null;
  const out = new Map(), parts = r.stdout.split('\0');
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i]; if (!e) continue;
    if (/^[RC]/.test(e)) i++;                                     // a rename or copy: its old path follows
    let digest = 'gone'; try { digest = crypto.createHash('sha1').update(fs.readFileSync(path.join(root, e.slice(3)))).digest('hex'); } catch { /* deleted */ }
    out.set(e.slice(3), e.slice(0, 2) + ' ' + digest);
  }
  return out;
}

/** Runs a scenario ({ file, label, private } from findScenario); it writes under `outDir` (private/demo-output/<name>/)
    or _site/, and nowhere git sees: a file it adds or changes there, tracked or not, fails it. A private scenario's
    failure names neither the scenario nor its files (MANA_DEMO_DEBUG=1 shows the error as it is). Returns its links. */
export async function runScenario({ file, label, private: secret = false }, { config, origin, root = ROOT, log = (...m) => console.log('  ', ...m) }) {
  const outDir = path.join(root, 'private/demo-output', path.basename(file, '.mjs'));
  const before = gitSees(root);
  if (!before) log('(not a git checkout: the check for files changed outside private/ and _site/ is skipped)');
  let r;
  try {
    const mod = await import(pathToFileURL(file).href);
    if (typeof mod.run !== 'function') throw new Error(`${label} exports no run()`);
    fs.mkdirSync(outDir, { recursive: true });
    r = (await mod.run({ config, origin, root, outDir, log })) || {};
  } catch (e) {
    if (!secret || process.env.MANA_DEMO_DEBUG === '1') throw e;
    throw new Error(`the private scenario failed (${e.name}); MANA_DEMO_DEBUG=1 shows the error, which may name it`);
  }
  const after = before && gitSees(root);
  const changed = after ? [...new Set([...before.keys(), ...after.keys()])].filter((f) => before.get(f) !== after.get(f)).sort() : [];
  if (changed.length) {
    throw new Error(`${label} changed ${changed.length} file${changed.length === 1 ? '' : 's'} git sees (a scenario writes only under private/ or _site/)` +
      (secret ? '; git status lists them' : ': ' + changed.join(', ')));
  }
  return r.links || [];
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
  /* the build is checked before anything is served: it must be the demo's */
  const built = path.join(site, 'config.js'), port = a.port ? Number(a.port) : DEFAULT_PORT, host = a.host || '127.0.0.1';
  if (!fs.existsSync(built)) throw new Error('no _site/config.js: run npm run demo without --no-build');
  const config = readConfig(built, { origin: originOf(host, port) });
  const problems = configProblems('demo', config, { origin: originOf(host, port) });
  if (problems.length) throw new Error(`_site/ is not a demo build (${problems[0]}): run npm run demo without --no-build`);
  const s = await serveSite({ site, port, host });
  try {
    const links = siteLinks(s.origin);
    if (scenario) {
      console.log(`· ${scenario.label}`);
      for (const [label, p] of await runScenario(scenario, { config, origin: s.origin })) links.push([label, s.origin + p]);
    }
    console.log(`\nMana demo: ${config.supabaseUrl} (the database \`mana\`, schema ${config.schema}); Ctrl-C stops it`);
    printLinks([...links, ...s.lan.map((o) => ['on the Wi-Fi', `${o}/mana/`])]);
    if (s.lan.length) console.log('! on the Wi-Fi: sign in only at 127.0.0.1 or on a personal hotspot, never with a staff account (docs/environments.md)');
  } catch (e) { await s.close(); throw e; }
  const bye = async () => { await s.close(); process.exit(0); };
  process.on('SIGINT', bye); process.on('SIGTERM', bye);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error('✗ ' + e.message); process.exit(e.exitCode ?? 1); });
}
