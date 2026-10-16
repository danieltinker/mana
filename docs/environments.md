# Environments

Mana runs in three environments. Each has one settings file, which the build copies to `_site/config.js`; every app
reads it as `window.HALOM_MENUS_CONFIG`. Nothing else in the build changes between them, except that a demo or local
build points the product page's Content-Security-Policy at its own database (below).

| | production | demo | local |
|---|---|---|---|
| What | halom.io/mana and every restaurant's menu | Demos and a client's private walkthrough (D38), on a machine | Development and tests, on a machine |
| Database | Supabase `halom-studio` (`zemdhczqlhkabfwxccqq`) | Supabase `mana` (`hhmjcudeiiycwqqklksc`) | The simulator's stack (`sim/stack`) |
| Schema | v1 (`db/`) until the cutover (ADR-005) | v2 (`supabase/migrations`) | v2 |
| Settings file | `config.js` (root) | `config/demo.js` | `config/local.js`, written at run time, git-ignored |
| `env`, `schema`, `realtime` | absent (= `production`, `1`, `true`) | `'demo'`, `2`, `true` | `'local'`, `2`, `false` (no Realtime server locally) |
| Short links (`shortBase`) | `https://halom.io/m/` | the serving machine's own `/m/` | the serving machine's own `/m/` |
| Built by | `pages.yml` on every merge to `main` (`MANA_ENV=production`) | `npm run demo` (`MANA_ENV=demo`) | `npm run dev:local` (`MANA_ENV=local`) |
| Served by | GitHub Pages, through halom.io's proxy | `tools/serve-site.mjs` on the machine | `tools/serve-site.mjs` on the machine |
| Runs on | GitHub Actions | A Mac or Linux: Node 22.18+ only | Linux x64 (the stack's GoTrue is a Linux binary) |

The three fields every app reads to choose a code path (RULES, phase 1):

- `env`: `'production' | 'demo' | 'local'`; absent means `'production'`.
- `schema`: `1 | 2`; absent means `1`. v2 code lives under `apps/<app>/src/v2/` or behind `schema === 2`.
- `realtime`: `boolean`; absent means `true`. Local is `false`.

## Production

`config.js` at the root is production's settings, and it stays exactly as it is: halom-studio, the v1 schema, and the
short links that printed QR codes carry. `.github/workflows/pages.yml` builds with `MANA_ENV: production` and publishes
`_site/`, and every deploy waits for Daniel's approval on the `github-pages` environment.

```bash
npm run build      # = bash tools/build-site.sh (MANA_ENV defaults to production): exactly what the workflow builds
npm run serve      # serves _site/ as halom.io does, at http://127.0.0.1:4180/mana/ (tools/serve-site.mjs)
```

A production build served on a machine **talks to halom-studio**: a menu opened at `/m/<name>` reads the live
database and records guest events in it. Agents look at a production build only through the in-build demo
(`/mana/view/?demo=olea`, no database) and do everything else on demo or local.

The cutover (ADR-005) changes production's database in one reviewed pull request that changes, together, `config.js`,
`PRODUCTION` in `tools/env.mjs` and the address written out in `tools/check-config.mjs`; the guard fails if only one of
them changes.

## Demo

`config/demo.js` points at the Supabase project `mana`, schema 2, with Realtime on. Its key is `mana`'s publishable key,
which is public by design (row-level security does the guarding) and listed in `.gitleaksignore`.

```bash
npm run demo                                  # build with MANA_ENV=demo, then serve at http://127.0.0.1:4180/mana/
npm run demo -- --no-build                    # serve the demo build already in _site/
npm run demo -- --port 4181                   # another port
npm run demo -- --host 0.0.0.0                # open to the Wi-Fi: it prints the addresses a phone can open
npm run demo -- --scenario <name>             # prepare a demo scenario, then serve (D38; see below)
```

It prints the product page, the guest menu (`/m/<name>`, and the in-build Olea demo), the owner app and the back
office. It needs Node 22.18+ and nothing else: no PostgreSQL, no Docker, no Linux binary.

**Short links.** `shortBase` is `location.origin + '/m/'`: a demo QR code, a shared link and "Open the menu" all go to
the server that is serving the demo (`tools/serve-site.mjs` routes `/m/<name>` to the guest menu, as halom.io does), so
`shortLive` is on and the demo exercises the same path as production. A demo QR code can never open production's short
links, which would show halom-studio's menu of the same name, or none. A phone follows a demo QR code only when the
owner app was opened at an address the phone can reach: start with `--host 0.0.0.0`, open the owner app at the Wi-Fi
address it prints, and the codes carry that address.

**What it shows today.** The apps' v1 code does not speak schema 2; their v2 paths arrive with the phase-1 lanes. Until
then the demo build shows the product page and the in-build Olea demo (made with AI, and labelled so), and each app's v2
screens as they land.

**Scenarios (D38).** `--scenario <name>` runs a module that prepares what the demo shows, once the server is up. It is
looked for as `tools/demo-scenarios/<name>.mjs` (synthetic data only) and then `private/demo-scenarios/<name>.mjs`
(git-ignored: a client's walkthrough never enters the repository). The module exports
`async run({ config, origin, root, log })` and may return `{ links: [[label, '/m/<slug>'], …] }`, which are printed
with the others. An unknown name stops before anything is built, with exit code 2 and the names there are.

**Writing to `mana`.** Agents may apply migrations and seed demo data there until it serves real restaurants
(`CLAUDE.md`); in phase 1 the orchestrator does it and the lanes test only against the local stack. From the day a real
restaurant uses `mana`, changes are proposed SQL that Daniel applies.

**Dashboard settings on `mana`** (Daniel's; not in the repository): Auth's Site URL and redirect URLs must name
`http://127.0.0.1:4180` (and any Wi-Fi address used) for links in sign-up and password mails to come back to a demo;
"Confirm email" needs a mail sender (`supabase/README.md`).

## Local

`npm run dev:local` (Linux x64): the simulator's stack with Café Demo seeded, the site built against it and served, in
one command.

```bash
npm run dev:local                     # stack (SIM_PORT_BASE, default 57500) + Café Demo + build + serve
npm run dev:local -- --guests 30      # also 30 seeded-random guests, so the numbers move
npm run dev:local -- --no-build       # serve the local build already in _site/
```

It writes `config/local.js` from the stack's address and its anon key (a JWT signed with the simulator's local-only
secret, never a project's key), builds with `MANA_ENV=local` and serves on the stack's web port (`SIM_PORT_BASE + 80`,
the address the stack's GoTrue knows as the site). It prints the addresses and the local accounts' e-mails: the owner of
Café Demo and a Halom admin. Their passwords are the simulator's local defaults (`sim/src/owner.mjs`,
`sim/src/halom.mjs`), for this machine only. Ctrl-C stops the server and the stack.

`config/local.js` is git-ignored and never committed. The browser tests (`e2e/helpers.mjs`) generate the same fields
for their own stack.

## How the build picks the settings

`MANA_ENV=production|demo|local bash tools/build-site.sh` (default `production`):

1. copies `config.js`, `config/demo.js` or `config/local.js` to `_site/config.js`;
2. `tools/site-env.mjs` checks that `_site/config.js` is that environment's (production: halom-studio, schema 1,
   halom.io's short links; demo: `mana`, schema 2; local: this machine, schema 2, no Realtime);
3. for demo and local only, the pages whose Content-Security-Policy names halom-studio (the product page, the photo
   guide, privacy, terms) name the environment's Supabase origin instead, and the build fails if anything in `_site/`
   still names halom-studio. A demo build cannot talk to production.

A production build is byte for byte what it was before the environments existed.

## The guard

`node tools/test-all.mjs config` (in `--fast`): production still points at halom-studio and `https://halom.io/m/`
with schema 1; demo points at `mana` with schema 2 and its own short links; both keys are publishable keys, not JWTs,
on line 4 (the line `.gitleaksignore` names, which also covers `_site/config.js`), and every `.gitleaksignore` entry
points at a publishable key; `config/local.js` is git-ignored and untracked; no file in the repository holds an
`sb_secret_…` key or a `service_role` key; `pages.yml` builds production and only production.
`node tools/test-all.mjs tools` tests the local server, the build's settings step and the scenario seam.

## Never

- Never write to the Supabase project `halom-studio`, by any path: no migration, no seed, no browser session against a
  production build beyond the in-build demo.
- Never call the live `menus-ai` with real scans.
- Never commit a secret key (`sb_secret_…`, `service_role`), a `.env` file or `config/local.js`. The publishable keys
  in `config.js`, `config/demo.js` and `CONTRACT.md` are the only keys in the repository.
- Never publish a demo or local build: `pages.yml` sets `MANA_ENV: production`, and the guard fails otherwise.
- Never put a real venue's menu, the mock client's included, in the repository: private seeds and scenarios live in `private/`.
- Test credentials are for localhost only; never repeat their values in a report or a pull request.
