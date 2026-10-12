# Mana (מנה) by Halom

Mana is a QR menu that shows each dish as a relief made from one photo. The relief lies on a table, on the diner's
phone, and needs no app. Restaurant owners build the menu themselves in the owner app.

This repository holds all of Mana's code, and the branch halom.io serves. It was split out of the studio repository
(`danieltinker/halom`, folder `work/mana`) on 12 Oct 2026, with that folder's history. The published site came from
`danieltinker/halom-projects` (`projects/menus/`).

| Live | Address |
|---|---|
| Product page | https://halom.io/mana/ |
| Owner app | https://halom.io/mana/studio/ |
| A restaurant's menu (what QR codes open) | `https://halom.io/m/<name>` |
| Demo menu | https://halom.io/mana/view/?demo=olea |
| Back office (Halom staff only) | https://halom.io/mana/ops/ |
| Backend | Supabase project `halom-studio` (ref `zemdhczqlhkabfwxccqq`). See `CONTRACT.md`, `API.md`, `BACKEND.md` |

## Branches

- **`main`**: the source.
- **`pages`**: exactly what halom.io serves under `/mana/` and `/m/`. It carries the media too: fonts, table
  textures, films, the generator's models and the placeholder pictures.

GitHub Pages publishes `pages` at `https://danieltinker.github.io/mana/`. halom.io keeps the visitor on its own
address and proxies two routes to it. Both live in `public/vercel.json` of the studio site:

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
| `brand/site/` | The product page, the photo guide, privacy and terms | `/mana/`, `/mana/guide/`, `/mana/privacy/`, `/mana/terms/` |
| `brand/` | The mark, print, social frames, and the film and poster tools (`brand/tools/`, including The Lift) | build-time only |
| `gen/` | The relief generator that runs in the owner's browser (two Apache-2.0 models). Models and vendor files are on `pages` only | `/mana/gen/` |
| `stock/` | The placeholder picture library and its tools. The pictures are on `pages` only | `/mana/stock/` |
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

```bash
bash tools/publish.sh                  # view, studio, ops and site
bash tools/publish.sh view studio      # only some parts
```

- It builds the parts you name and copies them into a worktree of `pages` (`.pages/`).
- It never touches the media there.
- It shows what changed and pushes `pages` only when you answer `y`.
- GitHub Pages updates in a minute or two. halom.io then serves the new version with no halom.io deploy.

The settings file `config.js` (the Supabase address, the publishable key, the short-link base, the feature switches)
lives only on `pages`. Change it there, by hand, in its own commit.

## Not in this repository

- **Business documents**: the name study, brand kit, campaign kit, sales playbooks and product overview. They are
  in the Halom Project on claude.ai, under `ventures/mana/`.
- **Lead lists and client data.** This repository is public.
- **Secrets.** Function secrets live in Supabase; `.env` files never go into git.
- **The deployed `menus-signup` function's source.** Only `menus-ai` is here so far.
- **The raw media and the generation lab** (about 730 MB plus 3.3 GB). They are on the founder's Mac.

## Rights

The repository is public so that GitHub Pages can serve it. It is not open source: © 2026 Halom, all rights
reserved. Third-party parts keep their own licences. See `gen/THIRD_PARTY_NOTICES.txt`,
`studio/public/THIRD_PARTY_NOTICES.txt`, `stock/NOTICE.md` and the OFL texts beside the fonts.
