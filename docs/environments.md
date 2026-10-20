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
| Product address (`siteBase`) | not yet: the cutover adds `https://halom.io/mana/` | the serving machine's own `/mana/` | the serving machine's own `/mana/` |
| Support (`support.whatsapp`) | not yet: the cutover adds it | Halom's number, as the site publishes it | the same (copied from `config/demo.js`) |
| Built by | `pages.yml` on every merge to `main` (`MANA_ENV=production`) | `npm run demo` (`MANA_ENV=demo`) | `npm run dev:local` (`MANA_ENV=local`) |
| Served by | GitHub Pages, through halom.io's proxy | `tools/serve-site.mjs` on the machine | `tools/serve-site.mjs` on the machine |
| Runs on | GitHub Actions | A Mac or Linux: Node 22.18+ only | Linux x64 (the stack's GoTrue is a Linux binary) |

The three fields every app reads to choose a code path (RULES, phase 1):

- `env`: `'production' | 'demo' | 'local'`; absent means `'production'`.
- `schema`: `1 | 2`; absent means `1`. v2 code lives under `apps/<app>/src/v2/` or behind `schema === 2`.
- `realtime`: `boolean`; absent means `true`. Local is `false`.

And F01's addresses, so that nothing in the code names halom.io:

- `siteBase`: the product's own address (the product page, the "made with Mana" link, link previews, the product
  page's QR code).
- `support.whatsapp`: the support link, `https://wa.me/<number>`.

Demo and local carry both now. Production's `config.js` stays byte for byte as it is, so it has neither until the
cutover adds them (`siteBase: 'https://halom.io/mana/'` and the same number). **v2 code reads both from the config and
never falls back to a halom.io address outside production**: on demo or local a missing field is an error the app
shows, never production's address. Only v1 code, which is frozen, keeps its halom.io fallbacks.

## Production

`config.js` at the root is production's settings, and it stays exactly as it is: halom-studio, the v1 schema, and the
short links that printed QR codes carry. `.github/workflows/pages.yml` builds with `MANA_ENV: production` and publishes
`_site/`, and every deploy waits for Daniel's approval on the `github-pages` environment.

```bash
npm run build              # = bash tools/build-site.sh (MANA_ENV defaults to production): exactly what the workflow builds
npm run serve              # serves _site/ as halom.io does, at http://127.0.0.1:4180/mana/ (tools/serve-site.mjs)
npm run serve -- --live    # a production build whole, settings included (Daniel only; never an agent)
```

`npm run serve` says which environment the build in `_site/` is for. A production build's settings point at
halom-studio, the live database: a menu opened at `/m/<name>` would read it and record guest events in it. So for a
production build `npm run serve` withholds `/mana/config.js` (no page can reach the database) and offers only the
in-build demo (`/mana/view/?demo=olea`), unless `--live` is given. Agents never pass `--live`; they work on demo or
local.

**The settings are judged on every request, not once at start** (`npm run serve`, `npm run demo`, `npm run
dev:local`): `_site/` can be rebuilt while a server runs (`npm run build` in a second terminal). Before each answer for
`config.js`, for any file that is it under another name (a hard link, the same inode) or a copy (the same content), and
for any file that assigns the settings (`HALOM_MENUS_CONFIG =`, a page that inlines them included), the server reads the
file as it is now and judges what it holds, not its label: settings that point at halom-studio are production's, and
withheld unless `--live`; settings that fail the checks of the environment checked at start (its label, address, key,
schema, short links; for `dev:local` the running stack) are refused (409), with one line in the terminal. The file is
opened once, and what was judged is exactly what is sent; if it cannot be judged, the answer is 409. Restart the server
after a rebuild.

The cutover (ADR-005) changes production's database in one reviewed pull request that changes, together, `config.js`,
`PRODUCTION` in `tools/env.mjs` and the address written out in `tools/check-config.mjs`; the guard fails if only one of
them changes. The same pull request adds `env: 'production'`, `schema: 2`, `siteBase` and `support.whatsapp` to
`config.js`.

## Demo

`config/demo.js` points at the Supabase project `mana`, schema 2, with Realtime on. Its key is `mana`'s publishable key,
which is public by design (row-level security does the guarding); `.gitleaks.toml` allows publishable keys by their
value, and nothing else.

```bash
npm run demo                                  # build with MANA_ENV=demo, then serve at http://127.0.0.1:4180/mana/
npm run demo -- --no-build                    # serve the demo build already in _site/
npm run demo -- --port 4181                   # another port
npm run demo -- --host 0.0.0.0                # open to the Wi-Fi: it prints the addresses a phone can open (see "Wi-Fi demos")
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
`async run({ config, origin, root, outDir, log })` and may return `{ links: [[label, '/m/<slug>'], …] }`, which are
printed with the others.

- A private scenario's name and path are never listed or printed: an unknown name lists only `tools/demo-scenarios/`'s,
  says "or a private one", and stops before anything is built, with exit code 2; a private one is announced as "the
  private scenario", and when it fails the demo says only that it failed and, at most, a built-in error type (an error
  class of its own is "an error", a thrown value "a thrown value"). While it is loaded, what it leaves running (a
  timer that throws, a promise nobody awaits) ends the demo with the same generic line instead of Node's stack.
  `MANA_DEMO_DEBUG=1` shows the error as it is, which may name it.
- **A scenario writes only under `private/` or `_site/`.** `outDir` is `private/demo-output/<name>/`. If the run adds
  or changes a file git sees (`git status`: a tracked file changed, or a new one not ignored), the demo fails; it names
  the files for a scenario of the repository, and only counts them for a private one.

**Writing to `mana`.** Agents may apply migrations and seed demo data there until it serves real restaurants
(`CLAUDE.md`); in phase 1 the orchestrator does it and the lanes test only against the local stack. From the day a real
restaurant uses `mana`, changes are proposed SQL that Daniel applies.

**Wi-Fi demos.** The demo server speaks plain HTTP, so on a shared network anyone on it can read what passes, a
session included.

- Sign in only at `http://127.0.0.1:4180` (this machine) or on a personal hotspot. Never sign in with a staff account
  at a Wi-Fi address; a phone that follows a QR code needs no account.
- `mana`'s Auth redirect allow-list (Daniel's dashboard setting, not in the repository; **confirm in the dashboard
  (Daniel)**) should hold only loopback: `http://127.0.0.1:4180/**`. If a Wi-Fi address is ever added for one demo,
  remove it right after. Audit the list before the cutover.
- "Confirm email" needs a mail sender (`supabase/README.md`).

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

**What it shows today.** The site's pages reach the local stack (`public_menu` for `cafe-demo` answers from each of
them), but the apps still run their v1 code. The guest menu at `/m/cafe-demo` asks for a v1 function the v2 schema does
not have (`open_menu`, a 404) and shows its "the menu didn't load" screen until the guest-menu v2 lane lands; the owner
app and the back office likewise wait for their v2 lanes.

## How the build picks the settings

`MANA_ENV=production|demo|local bash tools/build-site.sh` (default `production`; `--settings` only says which settings
a build would carry). A misspelled `MANA_ENV`, a missing settings file, or anything but production under GitHub Actions
stops the build before `_site/` is touched. Then the build:

1. copies `config.js`, `config/demo.js` or `config/local.js` to `_site/config.js`;
2. `tools/site-env.mjs` checks that `_site/config.js` is that environment's (production: halom-studio, schema 1,
   halom.io's short links; demo: `mana`, schema 2; local: this machine, schema 2, no Realtime);
3. for demo and local only, the pages whose Content-Security-Policy names halom-studio (the product page, the photo
   guide, privacy, terms) name the environment's Supabase origin instead; the back office's `connect-src`, which in
   production allows any Supabase project (`https://*.supabase.co`), allows exactly the environment's origin over
   https and wss (local: http and ws), for Realtime, and the wildcard is gone. The back office's `img-src` (`'self'
   data:`) also allows that project's menu picture bucket, and only it (`<origin>/storage/v1/object/public/menu-public/`),
   so its "menu to approve" shows the revision's pictures (`apps/ops/tools/csp.mjs`). No other directive changes, and the build fails if anything in
   `_site/` still names halom-studio. A demo build cannot talk to production. Production's pages, the back office's
   included, stay as they are until the cutover narrows them the same way.

A production build is byte for byte what it was before the environments existed.

## The guard

Three fast suites (`node tools/test-all.mjs --fast` runs them with the rest):

- `names`: no tracked or new file (its text and its path), no commit of the branch (`origin/main..HEAD`, messages and
  patches) and not the name of the branch being pushed holds a forbidden name (the mock client's, in Latin and Hebrew
  spellings).
  - **The names are never in the repository**, not as text and not as hashes (a short name's hash reverses). They are
    read from a file outside git: `MANA_FORBIDDEN_NAMES_FILE` if it is set, else `private/forbidden-names.txt`
    (git-ignored); one name per line, `#` comments. Without the default file the runner's line says "no list: nothing
    checked" and the suite passes: it is a local guard, and every machine that pushes has the list (Daniel's Mac in
    `private/`, the cloud machine through `MANA_FORBIDDEN_NAMES_FILE`). A `MANA_FORBIDDEN_NAMES_FILE` that points at
    nothing, or at an empty list, fails. Run it before every push. A finding names the file (a listed word in its path
    masked) and line, never the name.
  - Text is read as a person reads it: HTML tags dropped; JSON and JavaScript escapes (`\uXXXX`, `\n`, `\t`, `\"`…),
    HTML entities and `%XX` decoded; zero-width, soft-hyphen and bidi characters dropped; accents and points dropped;
    camel case split; Hebrew final letters folded. A name matches as its words in a row (across a line break, a hyphen,
    an underscore, a tag), its last word also in the plural, or written as one word, also inside a longer word.
  - It is a safety net against accidents, not an adversary: deliberate evasions (look-alike letters from another
    script, spaced-out letters, double encoding) are out of its scope.
  - The branch: the current branch and its upstream; with a detached HEAD, set `MANA_PUSH_BRANCH=<branch>`.
- `config`: production still points at halom-studio and `https://halom.io/m/` with schema 1; demo points at `mana`
  with schema 2, its own short links and F01's addresses; both keys are publishable keys of the exact shape, not JWTs;
  `.gitleaks.toml` keeps gitleaks' default rules, flags `sb_secret_` anywhere and allows only a publishable key's exact
  shape, whole, and `.gitleaksignore` lets nothing else through; `config/local.js` is git-ignored and untracked; no
  file in the repository holds an `sb_secret_…` key or a `service_role` key; `pages.yml` builds production only,
  checks it, and pins its actions.
- `tools`: the local server (routes, ranges, headers, the reviewers' probes, the guarded production serve, the
  settings judged on every request by what they hold, also after a rebuild under a running server, through a hard
  link, a copy or a page that inlines them, a demo label on halom-studio's address, and `config.js` replaced in a tight
  loop under a stream of requests), the build's settings step and its environment choice, the strict CSP rewrite, the
  JWT rule, the scenario seam (a private scenario's failures, late ones included), the e2e server's short links, and
  that the tools a Mac runs load no package.

The simulator's suite (`sim`) also checks its seeds against the names list (`tools/names.mjs`, the same reader and
matcher): skipped with a note without a list, failed when `MANA_FORBIDDEN_NAMES_FILE` points at nothing.

### Old phones

`old-phones` (a browser suite: `npm test` runs it, `--fast` does not; `node tools/test-all.mjs old-phones` alone) builds
production (`bash tools/build-site.sh`), then opens each app's production entry, the owner app (`/mana/studio/`), the
guest menu (`/mana/view/?demo=olea`, the in-build demo) and the back office (`/mana/ops/`), in Chromium made into an
iPhone on iOS 15 before any script runs: `RegExp` refuses a lookbehind (Safari before 16.4), `Object.hasOwn` and
`crypto.randomUUID` are gone (Safari before 15.4). Each must boot with no page error: the owner app and the back
office render into `#app`; the guest menu must be up on its table (`#app.live`) with no console error, because it
imports the table's chunk apart and catches a failure there (it would fall back to its list, and no page error would
say why). Every built script and page under `_site/` (`.js`, `.mjs`, `.html`), the ones these three pages never load
included (the seat map, the host board, the floor, `gen/`), is also read for a lookbehind: a literal one is a parse
error on those phones, which the patched `RegExp` cannot see. A finding gives the file, line and column; one inside a
string is reported too, and a person judges it. An entry chunk that imports code built for newer engines, a lookbehind
made at load among them, is a blank page on an iPhone that was not updated; this suite fails on it. The settings are production's with the database address pointed at a closed port on
127.0.0.1; every request to another host is aborted. `node tools/check-old-phones.mjs <a copy of _site/>` checks
another build.

Before a push, besides the suites: `gitleaks detect --source . --log-opts="<base>..HEAD" --redact --no-banner` (the
branch's commits; it reads `.gitleaks.toml`).

## Never

- Never write to the Supabase project `halom-studio`, by any path: no migration, no seed, no browser session against a
  production build beyond the in-build demo (the old-phones suite opens production's entries with the database address
  on a closed local port, and aborts every other host).
- Never call the live `menus-ai` with real scans.
- Never commit a secret key (`sb_secret_…`, `service_role`), a `.env` file or `config/local.js`. The publishable keys
  in `config.js`, `config/demo.js`, `CONTRACT.md`, `API.md` (line 6) and `BACKEND.md` (line 3) are the only keys in
  the repository.
- Never publish a demo or local build: `pages.yml` sets `MANA_ENV: production`, the build refuses anything else under
  GitHub Actions, `pages.yml` checks `_site/` with `node tools/site-env.mjs _site production` before it uploads, and the
  guard fails if any of that changes. The workflow's actions are pinned to commits (the tag in a comment).
- Never put a real venue's menu, the mock client's included, in the repository: private seeds and scenarios live in `private/`.
- Test credentials are for localhost only; never repeat their values in a report or a pull request.
