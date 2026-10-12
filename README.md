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

| Folder | What | Served at |
|---|---|---|
| `view/` | The guest menu: the table, the glide, the bar (three.js, built with esbuild into `app.js` and `chunks/`) | `/mana/view/`, `/m/<name>` |
| `studio/` | The owner app (Vite, Preact, TypeScript); built into `studio/dist/` | `/mana/studio/` |
| `ops/` | The back office (Preact, esbuild); built into `ops/dist/` | `/mana/ops/` |
| `brand/site/` | The product page, the photo guide, privacy and terms, with their pictures, films and fonts | `/mana/`, `/mana/guide/`, `/mana/privacy/`, `/mana/terms/` |
| `config.js` | The published settings | `/mana/config.js` |
| `brand/` | The mark, print, social frames, and the film and poster tools (`brand/tools/`, including The Lift) | build-time only |
| `gen/` | The relief generator that runs in the owner's browser (two Apache-2.0 models), with its models and runtime | `/mana/gen/` |
| `stock/` | The placeholder picture library, its pictures and its tools | `/mana/stock/` |
| `db/` | SQL migrations for the Supabase project | — |
| `functions/` | Supabase edge functions: `menus-ai` (the menu scanner) | — |
| `base/`, `base-artifact/` | The first hologram-menu engine, kept for reference | — |

## Develop and test

Every folder runs on its own, against local stand-ins. None of this touches the live backend.

```bash
cd view   && npm ci && npm test && npm run test:browser   # npm run serve → http://localhost:8787/m/olea
cd studio && npm ci && npm run check && npm run test:unit  # npm run stack starts a local backend; then npm run test:e2e
cd ops    && npm ci && npm test
```

The generator's tests are described in `gen/tests/README.txt`. The browser tests use headless Chromium with software
WebGL. They are no substitute for a real phone.

## Publish

**A push to `main` is a release.** It changes halom.io/mana and every restaurant's menu, in about two minutes, with
no halom.io deploy. To see the result first:

```bash
bash tools/build-site.sh       # builds the whole site into _site/, exactly as the workflow does
npx serve _site                # then open /view/?demo=olea, /studio/, /ops/ (paths without the /mana prefix)
```

`config.js` at the root holds the Supabase address, the publishable key, the short-link base and the feature
switches. It is shipped as it is.

The `pages` branch is the copy that was served on 12–13 Oct, before the workflow existed. Nothing updates it any more.
It stays as a fallback: Pages → Source "Deploy from a branch" → `pages`.

## Not in this repository

- **Business documents**: the name study, brand kit, campaign kit, sales playbooks and product overview. They are
  in the Halom Project on claude.ai, under `ventures/mana/`.
- **Lead lists and client data.** This repository is public.
- **Secrets.** Function secrets live in Supabase; `.env` files never go into git.
- **The source of the deployed `menus-signup` and `menus-landing` functions.** Only `menus-ai` is here so far.
- **Raw film masters and the generation lab** (about 3.3 GB). They are on the founder's Mac. Everything halom.io
  serves is here.

## Rights

The repository is public so that GitHub Pages can serve it. It is not open source: © 2026 Halom, all rights
reserved. Third-party parts keep their own licences. See `gen/THIRD_PARTY_NOTICES.txt`,
`studio/public/THIRD_PARTY_NOTICES.txt`, `stock/NOTICE.md` and the OFL texts beside the fonts.
