# Mana studio: tests

Three layers. Everything runs on this machine; nothing touches the hosted Supabase project, and the test browser cannot
reach any host but 127.0.0.1.

```
npm run test:unit            # prices, menu address, pasted lists, dashboard sums, "what changed", name comparison,
                             # what a chosen file really is, and the menus-ai function itself against canned API answers;
                             # v2-data: the v2 app's data layer (rows <-> forms, the nesting guard, the guest's prices)   ~3 s
node test/check-i18n.mjs     # every t('key') in the sources exists in both languages (lib/i18n.ts and v2/i18n.ts)
npm run build && npm run test:e2e    # browser tests against the local stack below               ~25 min on 2 cores
node test/shots.mjs          # the screenshot tour into .shots/v2/                               ~3 min
node test/words.mjs          # visible words per screen, old app (branch master) next to this one ~4 min
python3 tools/contact-sheets.py      # .shots/v2/before.jpg and after.jpg from the two runs above
nice -n 5 node test/film.mjs         # four clips of the owner app for the selling film, frame by frame (780 × 1688, 30 fps);
                                     # runs the real picture generator once; FILM_ONLY=scan,menu skips the heavy parts; FILM_OUT=<folder> copies the MP4s
```

Run one browser job at a time. A suite takes longer than most shells wait, so start it in the background and read its log:
`nohup node --test --test-concurrency=1 test/e2e/g-layout.test.mjs > test/.out/g-layout.log 2>&1 &`.

## The local stack (one command)

The stack serves the guest menu from `../view/`: build it first (`cd ../view && npm run build`); its output is not in git.

```
npm run stack                # = node test/stack/start.mjs   (Ctrl-C stops everything; --keep keeps the database; --fake-gen uses the stand-in generator)
```

| What | Where |
|---|---|
| the app, as it sits on GitHub Pages | `http://127.0.0.1:57380/halom-projects/projects/menus/studio/` |
| the diner viewer, the generator, the stand-in generator, the illustrations | `…/menus/view/`, `…/menus/gen/`, `…/menus/gen-fake/`, `…/menus/stock/` |
| a local `config.js` pointing at the stack | `…/menus/config.js` (generated, not a file) |
| one Supabase-style base URL | `http://127.0.0.1:57321` → `/rest/v1`, `/auth/v1`, `/storage/v1`, `/functions/v1/menus-signup`, `/functions/v1/menus-ai` |
| PostgreSQL | `postgres://postgres@127.0.0.1:57329/postgres` |

Ports start at 57300 (`STACK_PORT_BASE` moves them): database +29, auth +31, PostgREST +32, gateway +21, web +80. A port that is
taken makes the start fail at once, with the reason.

Folders can be swapped without touching the code: `STACK_STUDIO` (another build of the app), `STACK_VIEW`, `STACK_STOCK`,
`STACK_GEN`. The suites were last run with frozen copies of the viewer and the illustrations (`.scratch/view-m2`,
`.scratch/stock-snap`), because other people were editing those folders at the time.

What runs behind it (`test/stack/`):

- **PostgreSQL 16** (`/usr/lib/postgresql/16/bin`, started as the OS user `claude` because Postgres refuses to run as root; override with
  `STACK_OS_USER`). A fresh data directory on every start, in `test/.stack/pgdata` (git-ignored).
- **`bootstrap.sql`**: what a Supabase project has before any migration (roles, the `auth`, `storage` and `extensions` schemas,
  `storage.buckets` / `storage.objects`, default privileges).
- **GoTrue 2.180.0** (Supabase Auth, the real binary). Public sign-up is disabled, as on the pilot: accounts are made only through
  the sign-up function.
- **`after-auth.sql`**: `auth.uid()`, `auth.role()`, `auth.jwt()` as Supabase defines them.
- **every `../../db/00*.sql`, in order, unchanged** (today `0001_core.sql` and `0002_mana_v2.sql`). One row is then edited:
  `app_config.public_base` points at the local storage URL.
- **PostgREST 12.2.3** (the real binary) with the same JWT secret, so RLS, triggers and RPCs answer exactly as written.
- **`gateway.mjs`**: the router, plus three things written for these tests:
  - a **storage shim** with the endpoints supabase-js calls here. Rows go to `storage.objects` through the caller's role and JWT
    claims, so the storage policies decide every read and write.
  - a local **`menus-signup`** with the contract of BACKEND.md (honeypot, minimum form time, rate limit, the same result codes).
  - a stand-in **`menus-ai`** (`ai-standin.mjs`) with the contract of BACKEND.md v2: `status`, `scan_menu` as an NDJSON stream,
    `describe_dish`. It checks requests in the order the real function does and takes the daily allowance through the real
    `ai_take`. What it "reads" is scripted. Switches, set with `POST /__test/config {"ai": {…}}` (`{"ai": "reset"}` puts them back):
    `configured`, `delayMs`, `script` (`he`, `he2`, `en`), `scripts` (a queue, one per page), `truncated`, `truncateAfter`,
    `error`, `errorAfter` (cuts the stream), `describeError`, `forceLimit`, `custom` (a whole script) and `gate` / `released`
    (line n waits until `released` ≥ n: used by `test/film.mjs` to film the scan frame by frame). `GET /__test/ai` lists the calls it received
    (sizes, languages, how many illustration labels were sent); no picture is kept.
- **`fake-gen/`**: a stand-in for the 72 MB picture generator with the same exports, phases and errors (a flat photo has "no
  dish", an undecodable file is `bad_image`, a missing model file is `model_download`). Every suite but the journey uses it.

The binaries are not in git. Get them once (about 60 MB):

```
mkdir -p test/.stack/bin/gotrue && cd test/.stack/bin
curl -sSL https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz | tar -xJ
curl -sSL https://github.com/supabase/auth/releases/download/v2.180.0/auth-v2.180.0-x86.tar.gz | tar -xz -C gotrue
```

`node test/stack/smoke.mjs` is a short check that the stack answers like a Supabase project, version 2 calls included.

`STACK_EXTRA_SQL=1` (or a comma list of file names) loads every `../../db/proposed/*.sql` after `db/00*.sql`, and the generated
`config.js` then says `features.bookUrl: true`. `npm run test:proposed` starts such a stack and proves the proposed migrations
the way the app and the guest menu use them (PostgREST with the owner's JWT, the counts with the public key); no browser.
`node test/timing.mjs` (against a running stack) times sign-up → three typed dishes → published, and with `TIMING_PHOTO=1` one
dish photo → relief; the numbers are "headless, this machine", an upper bound.

## The browser tests (`test/e2e/`, Playwright with the system Chromium)

Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (override with `CHROME`), started with SwiftShader so the diner
viewer's WebGL runs. Each file starts its own stack. Screenshots and logs land in `test/.out/` (git-ignored).
These suites are the v1 app on the old schema; the v2 app (`src/v2/`, the clean schema) is driven by `e2e/studio-v2.test.mjs`,
`e2e/studio-v2-edges.test.mjs` and `e2e/studio-v2-operate.test.mjs` on the simulator's stack.

| File | What it proves |
|---|---|
| `a-journey.test.mjs` | One owner, 390 px, Hebrew: "Continue" with an e-mail makes the account → the place in one field → the menu scanned from a photo (stand-in), reviewed, added → dish sheet, paste, type → illustrations on → **one real photo through the real generator**, reviewed and approved → publish → the viewer and the QR (PNG and SVG decoded) → guests arrive (`open_menu`, `track_item` through PostgREST) → the dashboard shows their numbers → sold out, update, restore, offline. `JOURNEY_GEN=fake` swaps the generator for quick runs |
| `b-isolation.test.mjs` | A second account cannot read or change the first one's rows, files, versions, plan or numbers (`my_stats`, the count tables, `approve_asset`, `ai_take`, the scanner with another owner's business), by direct calls and through the app; account switch in one browser; two businesses on one account |
| `c-failures.test.mjs` | Picture failures (`no_dish`, `bad_image`, failed upload, cancel, `limit_attempts`, resume after a reload), saves that fail or are refused (said above an open sheet), limits, empty menu, ended trial, a browser without the studio, a failed studio download, start-screen errors, provider buttons per config and the PKCE redirect, every scanner error code, a HEIC photo this browser cannot open, HTTP errors and no connection on the scanner's address, a cut stream, several pages, duplicates, an English menu, "suggest from the photo" filling only empty fields |
| `d-style.test.mjs` | The Style tab keeps what the old "Look" screen did: logo upload, colour (a dark one is brightened and said so), table, languages, names, details, ordering link (https only), phone; the draft has them at once and guests after "Update"; taking the menu offline keeps the three tabs |
| `g-layout.test.mjs` | Hebrew and English at 360 / 390 / 1440 px over every screen and every sheet: no sideways scroll, touch targets ≥ 44 px. Labels, one `h1`, bidi isolation, only local hosts, illustration badges, keyboard reorder, a dish opens and closes without losing the place, the floating preview button never covers the last control, drag to reorder, the phone's camera chooser, review decisions |

Fault injection is done in the browser (`page.route` aborting or failing requests) and through the stand-in's switches, never by
changing the app. The preview inside the app is the real viewer; tests that are not about the picture start it with `gl=off`
(`localStorage['mana-studio-preview-q']`, a test switch) because software WebGL is slow.

## What these tests do NOT cover

The hosted Supabase project (its gateway, the real Storage service, the real `menus-signup` and `menus-ai` functions and the model
behind the scanner), a real return from Google, Apple or Facebook (the tests stop at the redirect to the provider), real phones,
Safari, and the generator's speed and memory on a phone.
