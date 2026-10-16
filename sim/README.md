# sim/: the simulator

Mana's three sides, simulated end to end (feature map F02): **guests** on their phones, the venue's **owner** (and
manager, counter), and **Halom**'s back office. Bots drive the clean schema (`supabase/migrations`) on a local
Supabase-compatible stack, and the tests in `sim/test` assert the end state on every side: the guest's menu, the
owner's dashboard and log, Halom's overview.

Everything runs on this machine. Nothing here touches the Supabase projects `mana` or `halom-studio`.

## Run it

```bash
npm ci                          # at the repository root (sim/ and e2e/ are workspaces)
cd sim && npm test              # the scenarios: 37 tests, one fresh stack per file, about 35 s
node tools/test-all.mjs sim e2e # the same through the runner, plus the browser smoke test (e2e/)

npm run stack -w sim            # = node sim/src/cli.mjs stack: a stack that keeps running (Ctrl-C stops it)
node sim/src/cli.mjs up         # a stack + Café Demo seeded + 20 random guests; keeps running
node sim/src/cli.mjs seed sim/seeds/bistro-sim.json      # into the running stack
node sim/src/cli.mjs run --slug cafe-demo --guests 200 --minutes 60 --seed 3
node sim/src/cli.mjs run --slug cafe-demo --guests 30 --minutes 10 --realtime   # wall-clock pace, to watch numbers move
node sim/src/cli.mjs scenario phase0                      # the scripted chain; prints what each side sees
```

Needs Node 22.18+ and PostgreSQL 16 (`/usr/lib/postgresql/16/bin`, or `PGBIN=<dir>`), as `supabase/` does. When run as
root, PostgreSQL runs as `STACK_OS_USER` (default `claude`).

## The stack (`sim/stack/`)

`startStack()` in `stack/start.mjs` builds, in a fresh temp folder (removed by `stop()`):

| Step | What |
|---|---|
| PostgreSQL 16 | `initdb`, a port of its own, `fsync` off, `timezone = UTC`, 40 connections |
| `bootstrap.sql` | What a Supabase project has before any migration: `anon`, `authenticated`, `service_role`, `authenticator`, `supabase_auth_admin`; the `auth`, `storage` and `extensions` schemas; `storage.buckets` and `storage.objects`; Supabase's default privileges; the `supabase_realtime` publication |
| GoTrue 2.180.0 | The real Supabase Auth binary; it migrates the `auth` schema itself |
| `after-auth.sql` | `auth.uid()`, `auth.role()`, `auth.jwt()` as Supabase defines them |
| `supabase/migrations/*.sql` | Every file, in name order, unchanged; then `app_config.public_base` is set to a local address |
| PostgREST 12.2.3 | The real binary, the same JWT secret, schema `public` |
| `gateway.mjs` | One base URL: `/rest/v1` → PostgREST, `/auth/v1` → GoTrue (adapted from the studio's gateway) |

**Ports.** `SIM_PORT_BASE` (default 57500): gateway +21, PostgreSQL +29, GoTrue +31, PostgREST +32, web (e2e) +80. The
tests use `ports: 'auto'` (free ports), so they never collide with a running `sim stack` or the studio's stack (57300).
`attachStack()` joins a running stack from another process; the local keys are the same on every start.

**Binaries.** Looked for in `$SIM_STACK_BIN`, `sim/.stack/bin`, then `apps/studio/test/.stack/bin`; when missing, fetched
once from the GitHub releases with curl into `sim/.stack/bin` (git-ignored), checked against pinned SHA-256s
(`stack/binaries.mjs`). `SIM_NO_DOWNLOAD=1` turns the download off.

**Where it differs from a Supabase project** (each local difference is also listed in `stack.notes`):

| Hosted | Here |
|---|---|
| pg_cron runs `app.build_rollups()` every minute | Nothing is scheduled: the simulator calls `stack.buildRollups()` when it wants the dashboards current |
| Storage serves `menu-public` | The tables and policies exist; no storage service runs. `public_base` points at a local address nothing answers (no scenario loads a picture yet) |
| Realtime streams the rollups | The publication exists; no Realtime server |
| Sign-up by e-mail, confirmed by mail | No mail service: public sign-up is off; accounts are made through GoTrue's admin API with a confirmed e-mail (the owner and staff bots' "sign up") |
| Cloudflare sets `cf-connecting-ip` | The gateway sets it from the connection, and drops a caller's own `cf-connecting-ip` / `x-real-ip`; a guest bot's `x-sim-client-ip` gives it an address of its own (local only), so per-source caps behave as with real phones |
| `event_caps` as the schema sets them | When the schema has no `event_caps_demo` yet (this branch, before the architect's change), `event_caps` is raised locally so a demo can send many events; with `event_caps_demo` nothing is changed |
| PostgreSQL 15 or 17 | PostgreSQL 16 |
| Edge functions (`menus-ai`, sign-up) | None yet |

GoTrue's release is a Linux binary, so the stack runs on Linux (the cloud machines); on a Mac it needs Docker or a
GoTrue built from source. That is why `tools/test-all.mjs` counts `sim` as fast only on Linux x64.

## The rule: public interfaces only

The bots talk HTTP to the gateway, with the anon key or the user's own JWT, exactly as the apps do (`src/client.mjs`).
Superuser SQL (`stack.sql` and the helpers beside it) is used only for what a person with the database does by hand,
each named:

| Setup | Why |
|---|---|
| `stack.addStaff(user, 'admin')` | `supabase/README.md`: the first admin is added once by SQL. Every other staff member joins with `create_staff_invite` → `redeem_staff_invite` |
| `stack.addMember(venue, user, 'manager' \| 'counter')` | No RPC hands those roles out yet (team invites are phase 2) |
| `stack.setDemo(venue)` | `venues.is_demo` is Halom's; no RPC sets it yet |
| `stack.buildRollups()` | The cron job |
| `stack.setConfig(key, value)` | A test that changes a switch (and puts it back) |

Tests also read stored rows directly as an oracle (for example, that no guest address is in any events table); what
they assert about behaviour went through the public interfaces.

## The bots (`sim/src/`)

| Bot | What it does |
|---|---|
| `OwnerBot` | `signUp` (admin API, confirmed e-mail) and sign-in; `createVenue`; `buildMenu(seed)` through the REST tables under RLS: schedules (day parts), sections, dishes, add-on groups with options and **one nested level**, dish groups, "goes well with", upsell rules, hours, closures; `setOnboarding`; `preview`, `publish`, `restoreRevision`; `soldOut(kind, id, until)` and `restore`; `updateDish`; `dashboard(range)`; `activity()`; `revision(n)`; `askForHelp` |
| `HalomBot` | `firstAdmin` (the SQL line above), `invite` and `join` (invite → redeem); `overview`, `venueCard`, `approve(venue, reason)`, `actForOwner(venue, reason, action, payload)`, `leads`, `updateLead`, `dashboard`, `staffActivity` |
| `GuestBot` | `open(slug)` (`public_menu`; `menu_opened`), `refresh()` (the live overlay again), `view(dish, {selection})` (the sheet, at most one suggestion), `choose(group, option, {parentOptionId})`, `price()` (`priceDish`), `add()` (refused when it cannot be priced; then the "add" suggestion), `accept()`, `dismiss()`, `checkout()`, `basketIssues()`, `flush()` (`track_events`, 50 a batch), `resend(events)` |

The guest bot uses `@mana/contracts` for everything a phone computes: `menuAvailability`, `priceDish`,
`defaultSelection`, `matchSuggestion`. Its events carry a random dedupe id, a time with the venue's offset
(`2026-10-15T23:04:05.123+03:00`), and the contract's props only; there is no field for a person. At every suggestion it
checks Hopa test 10 itself (never in the basket, sold out, filtered out, already chosen) and keeps any breach in
`violations`. Its `Ledger` counts what the database accepted with the contracts' `rollupKeys`, so a scenario knows
exactly what `my_dashboard`, `ops_overview` and the rollup tables must show.

## Scenarios and tests

| File | What it proves |
|---|---|
| `test/chain.test.mjs` | The phase-0 chain (`phase0Chain` in `src/scenarios.mjs`): the owner builds and publishes; the first publish waits for Halom (`publish_requires_approval`) and guests see "unavailable"; support approves; three scripted guests choose (a nested sauce included), accept and dismiss; after `app.build_rollups()` the owner's `my_dashboard` (totals, opens by source and language, per rule, top dishes) and the day rollups key by key equal what the guests did, and staff's `ops_overview` card shows the same; demo traffic stays out of real totals; `public_menu` is the published revision and the menu the seed describes; the owner's two-hour sold-out is seen at once and Halom restores it with `act_for_owner`, which the owner sees with the reason; a product-page lead reaches `ops_leads`, the read logged without the contact |
| `test/hopa.test.mjs` | Hopa **test 2** (a dish, an add-on, the whole nested sauce group and a section going off while a basket is open; `priceDish` refuses; the basket names the line; fixable; restore), **test 10** (never in the basket, sold out, filtered out, an add-on already chosen or off; dismissing keeps every choice and the price; never pre-selected; never chained; a random crowd with sold-out items and filters), **test 11** (another venue's owner reads nothing and changes nothing; the counter takes things off and back but cannot change a price, publish or see records; support reads across venues and writes only through `act_for_owner` with a reason, shown to the owner; the owner's support switch; staff RPCs stay with staff), **test 12** (personal fields refused at the top and in props; stored events hold the contract only; no guest address in any table; no cookie; no account, lead or membership from guests) |
| `test/events.test.mjs` | Resending the same events (same ids, other batch orders, duplicates inside a batch) changes no rollup and no dashboard; a second rollup run finds nothing; random mode agrees key by key; the same seed replays the same guests |
| `test/seeds.test.mjs` | In-repo seeds are synthetic, well formed and never name the mock client; a non-synthetic seed loads only from `private/`; Café Demo loads through the bots and the guest gets exactly its menu |
| `test/stack.test.mjs` | Every migration applied, `app.audit_grants()` empty, RLS everywhere; the apikey rule; per-source caps follow the gateway's address and a forged `cf-connecting-ip` changes nothing; `attachStack` |

Hopa tests 4, 5 and 9 (payments, printing) and the refund half of 11 come with phases 2–3.

## Random mode

`runRandom(stack, { slug, guests: N, minutes: M, seed, realtime })` (or `sim run`): each guest gets an address, a
language (30 % English), a way in (35 % link), sometimes a tag filter, and a script driven by its own seeded generator:
open the menu, view one to four dishes, make valid choices (`randomSelection`), add some, accept or dismiss what is
suggested, sometimes reach checkout. **Compressed** (default): the events are spread over the last M minutes (at most
47 hours; never in the future) and sent at once. **Realtime**: guests arrive over the next M minutes and act at wall-clock
pace. The same seed against the same menu at the same moment does the same things; event ids stay random, so a replay is
new traffic. The probabilities are `RANDOM_DEFAULTS` in `src/random.mjs`.

## Seeds

A seed is a venue described as JSON (the shape is at the top of `src/seed.mjs`), loaded through the owner bot, flagged
as a demo, published, and approved by a Halom bot.

| Seed | What |
|---|---|
| `seeds/cafe-demo.json` | **Café Demo**, the same invented menu as `supabase/seed/synthetic.sql`: breakfast as a day part, a Friday special, a morning-only rule, real opening hours, so what guests can order depends on the clock |
| `seeds/bistro-sim.json` | **Bistro Sim**, invented for the scripted scenarios: open around the clock, a day part that covers the day, no rule with hours, so a script gives the same result at any time |

**Only synthetic seeds live in the repository**, each with `"synthetic": true` (the loader refuses anything else outside
`private/`, and `seeds.test.mjs` checks every file). Seeds of real venues, the mock client's included, live in
`private/` at the repository root, which git ignores: `node sim/src/cli.mjs seed private/<name>.json`. Never commit
one, paste one into a PR, or load one into a page anyone else can open.

## e2e/ (browser tests)

`e2e/helpers.mjs` → `startE2E({ seed })`: the sim stack, a synthetic venue, a static server for `_site/` (when
`bash tools/build-site.sh` has built it) at `/mana/` with a generated `config.js` pointing at the local stack, and the
system Chromium (`CHROME`, default `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) with playwright-core, found as
the apps' browser tests find it (the apps' installs, then `/opt/npm-tools`). The browser reaches 127.0.0.1 only.
`e2e/smoke.test.mjs` fetches `public_menu` for the seeded venue from a page, through the gateway. The apps' own browser
tests move here in phase 1, when they speak the new schema. `cd e2e && npm test`; screenshots in `e2e/.out/`.

## Not yet

A storage shim (pictures), Realtime, the scanner function and imports, team invites, ordering, the counter screen,
payments and printing: each comes with its phase, with its bots and scenarios here.
