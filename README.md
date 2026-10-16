# Mana (מנה) by Halom

Mana is a QR menu that shows each dish as a relief made from one photo. The relief lies on a table, on the diner's
phone, and needs no app. Restaurant owners build the menu themselves in the owner app.

This repository is the whole app: the code, the media, the settings and the build that halom.io serves. It was split
out of the studio repository (`danieltinker/halom`, folder `work/mana`) on 12 Oct 2026, with that folder's history.
The media and settings came from the published copy in `danieltinker/halom-projects` (`projects/menus/`).

| Live | Address |
|---|---|
| Product page | https://halom.io/mana/ |
| Owner app | https://halom.io/mana/studio/ |
| A restaurant's menu (what QR codes open) | `https://halom.io/m/<name>` |
| Demo menu | https://halom.io/mana/view/?demo=olea |
| Back office (Halom staff only) | https://halom.io/mana/ops/ |
| Backend | Supabase project `halom-studio` (ref `zemdhczqlhkabfwxccqq`). See `CONTRACT.md`, `API.md`, `BACKEND.md` |

## How it is served

Every push to `main` runs `.github/workflows/pages.yml`. It builds the site with `tools/build-site.sh` and publishes
it to GitHub Pages at `https://danieltinker.github.io/mana/`. In the repository settings, Pages → Source is
"GitHub Actions" and the custom domain is empty.

halom.io keeps the visitor on its own address and proxies two routes to GitHub Pages. Both live in
`public/vercel.json` of the studio site:

```
/mana/(.*)   → https://danieltinker.github.io/mana/$1
/m/:slug     → https://danieltinker.github.io/mana/view/index.html   (and /m/:slug/)
```

Under `/m/<name>` the guest menu sets its own `<base href="/mana/view/">`, so its files load through the first route.

## What is where

One npm workspace: the apps are in `apps/`, shared packages go in `packages/`. The addresses did not change when the
apps moved into `apps/` (15 Oct 2026): the build still serves them at `/mana/view/`, `/mana/studio/` and `/mana/ops/`.

| Folder | What | Served at |
|---|---|---|
| `apps/view/` | The guest menu: the table, the glide, the bar (three.js, built with esbuild into `app.js` and `chunks/`) | `/mana/view/`, `/m/<name>` |
| `apps/studio/` | The owner app (Vite, Preact, TypeScript); built into `apps/studio/dist/` | `/mana/studio/` |
| `apps/ops/` | The back office (Preact, esbuild); built into `apps/ops/dist/` | `/mana/ops/` |
| `packages/` | Shared packages: `packages/contracts` (`@mana/contracts`: the domain types, the menu snapshot v2, the events contract, their validators, pricing, availability and upsell) | `cd packages/contracts && npm test` |
| `supabase/` | The clean schema for the Supabase project `mana`: migrations, the synthetic seed, database tests on a throwaway PostgreSQL 16 | `cd supabase && npm test` |
| `brand/site/` | The product page, the photo guide, privacy and terms, with their pictures, films and fonts | `/mana/`, `/mana/guide/`, `/mana/privacy/`, `/mana/terms/` |
| `config.js` | The published settings (production) | `/mana/config.js` |
| `config/` | The demo's settings (`demo.js`); on a machine, the generated local ones (`local.js`, git-ignored) | `/mana/config.js` of a demo or local build |
| `brand/` | The mark, print, social frames, and the film and poster tools (`brand/tools/`, including The Lift) | build-time only |
| `gen/` | The relief generator that runs in the owner's browser (two Apache-2.0 models), with its models and runtime | `/mana/gen/` |
| `stock/` | The placeholder picture library, its pictures and its tools | `/mana/stock/` |
| `seating/` | The seat map's contracts (`layout.v1`, `booking_request.v1`), validators, the demo room and the Blender bake; the page itself is `apps/view/seat/` | `/mana/view/seat/` |
| `templates/` | The template contract, the six live looks (`templates.v1.json`), all 99 concepts as data (`matrix.json`); the gallery is `apps/view/looks/` | `/mana/view/looks/` |
| `design/` | `tokens.css`: the custom properties the product page, the owner app and the back office share | build-time |
| `payments/` | The payments port, the ledger, a local mock and the Grow / PayPlus adapters (not wired to anything yet) | — |
| `site-kit/` | A one-page restaurant site made from a menu snapshot (v1) | — |
| `db/` | SQL migrations for the Supabase project; `db/proposed/` holds changes Daniel has not applied | — |
| `functions/` | Supabase edge functions: `menus-ai` (the menu scanner) and `menus-signup` (an owner's sign-up) | — |
| `base/`, `base-artifact/` | The first hologram-menu engine, kept for reference | — |
| `tools/` | The site build (`build-site.sh`), its budgets and checks, `test-all.mjs` (every suite in turn), the environments (`env.mjs`, `demo.mjs`, `dev-local.mjs`, `serve-site.mjs`) and their guard (`check-config.mjs`) | — |
| `docs/` | The environments, and the separation checklist | — |

### To move later

The restructure moved only the three apps. These stay where they are for now; each needs its own small change first.

| Folder | Why it has not moved yet |
|---|---|
| `seating/` | Plain modules the guest menu imports by relative path (`apps/view/src/{seat,host,floor,room}`), and its tests run inside the guest menu's `npm test`; it becomes a package (`packages/seating`) once those imports go through the workspace |
| `templates/` | The looks contract, bundled into the guest menu by relative import; a package once the contracts package sets the pattern |
| `design/` | One CSS file the owner app, the back office and the product page `@import` by relative path; it belongs in `packages/ui` with the shared components |
| `payments/` | Its own package with no dependencies and no app using it yet; it moves with the ordering work (phase 2–3), when it is wired |
| `site-kit/` | A small tool with its own tests; it moves when it gets a home (an app, or a package) |
| `gen/`, `stock/` | Served as they are at `/mana/gen/` and `/mana/stock/` (models, runtime, pictures): no build, nothing to type |
| `brand/` | The product page and its tools; it has its own lock and `npm ci`, and moves with the product page's own restructure |
| `db/`, `functions/` | Replaced by `supabase/` (migrations, functions, seed, tests) in the architect's pass, not moved here |
| `base/`, `base-artifact/` | Reference only; to be archived, not moved |

## Develop and test

Every app runs on its own, against local stand-ins. None of this touches the live backend.

```bash
npm ci                      # once, at the root: installs the three apps, each into its own node_modules
npm run test:fast           # types, units, contracts, the schema's database tests, the mark: no browser (about 1 min).
                            # The database tests need PostgreSQL 16 binaries: /usr/lib/postgresql/16/bin, or PGBIN=<dir>
                            # (on a Mac: brew install postgresql@16, then PGBIN=$(brew --prefix postgresql@16)/bin)
npm test                    # every suite, one at a time, browser ones included (about 40 min); logs in test-results/
npm run check               # type checks, every workspace that has a `check` script
npm run build               # = bash tools/build-site.sh
npm run demo                # the site with the demo settings (the database `mana`), served at 127.0.0.1:4180/mana/
npm run dev:local           # Linux x64: the simulator's stack with Café Demo, the site built against it and served
                            # (the environments, and what never to do in each: docs/environments.md)

cd apps/view   && npm test && npm run test:browser   # npm run serve → http://localhost:8787/m/olea
cd apps/studio && npm run check && npm run test:unit # npm run stack starts a local backend; then npm run test:e2e
cd apps/ops    && npm test
```

**Packages.** There is one lock, `package-lock.json` at the root. It installs each app's packages inside that app
(`apps/<app>/node_modules`), at exactly the versions the app's own lock pinned before the move (it was made from those
three locks, which it replaces), so nothing is shared between the apps yet and no version changed. Add or change a
package for one app from the root: `npm install -w apps/<app> <pkg>`. npm may then place a new package in the root
`node_modules` (shared), so check `git diff package-lock.json` before committing. `brand/` is outside the workspace and
keeps its own lock: `cd brand && npm ci`.

The generator's tests are described in `gen/tests/README.txt`. The browser tests use headless Chromium with software
WebGL. They are no substitute for a real phone.

## Publish

**A push to `main` is a release.** It changes halom.io/mana and every restaurant's menu, in about two minutes, with
no halom.io deploy. To see the result first:

```bash
bash tools/build-site.sh       # builds the whole site into _site/, exactly as the workflow does
npm run serve                  # serves _site/ as halom.io does: 127.0.0.1:4180/mana/, /m/<name>
```

A production build talks to halom-studio, so `npm run serve` withholds its `config.js` and offers only the in-build
demo (`/mana/view/?demo=olea`); `npm run serve -- --live` serves it whole (`docs/environments.md`).

`config.js` at the root holds production's Supabase address, the publishable key, the short-link base and the feature
switches. It is shipped as it is. The demo's settings are `config/demo.js`; `MANA_ENV` picks them
(`docs/environments.md`). What Mana depends on outside this repository is `docs/separation-checklist.md`.

The `pages` branch is the copy that was served on 12–13 Oct, before the workflow existed. Nothing updates it any more.
It stays as a fallback: Pages → Source "Deploy from a branch" → `pages`.

## Not in this repository

- **Business documents**: the name study, brand kit, campaign kit, sales playbooks and product overview. They are
  in the Halom Project on claude.ai, under `ventures/mana/`.
- **Lead lists and client data.** This repository is public.
- **Secrets.** Function secrets live in Supabase; `.env` files never go into git.
- **Raw film masters and the generation lab** (about 3.3 GB). They are on the founder's Mac. Everything halom.io
  serves is here.

## Rights

The repository is public so that GitHub Pages can serve it. It is not open source: © 2026 Halom, all rights
reserved. Third-party parts keep their own licences. See `gen/THIRD_PARTY_NOTICES.txt`,
`apps/studio/public/THIRD_PARTY_NOTICES.txt`, `stock/NOTICE.md` and the OFL texts beside the fonts.
