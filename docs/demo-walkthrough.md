# The client walkthrough (D38)

Phase 1's acceptance test, as one run: a client's whole first day on Mana, on all three sides, through the real apps in
a browser, written to one private page. The command plan's script (§4) step by step:

| # | Side | Step |
|---|---|---|
| 1–2 | Owner | Signs up with a fresh address, names the venue (its address is fresh too) |
| 3–5 | Owner | Imports the menu from the text of its Wolt page; fixes the listed exceptions and applies; imports screenshots of the page where a scanner runs |
| 6–8 | Owner | Sets the "side of choice" groups and a nested sauce; adds two suggestion rules; sets breakfast hours (a day part) |
| 9 | Owner | Tries the menu in the setup's phone frame and publishes (the QR code and table card carry the demo mark) |
| 10 | Halom | Finds the venue, labels it a demo venue, reads version 1 and approves it, with a reason |
| 11–13 | Guest | On a phone: chooses add-ons with a nested sauce, accepts one suggestion and dismisses another; then more guests (bots, for load) |
| 14 | Owner | Takes a dish off for two hours from Home, in two taps |
| 15–16 | Halom | Sees the onboarding, the live numbers and the timeline; acts for the owner once to bring the dish back, with a reason |
| 17 | Owner | Sees Halom's act, with the reason, in the activity log |

The owner and the guest use a 390 × 844 phone, Halom a 1440 × 900 desk, all in Chromium. Every step goes through the
apps as a person would, except step 13's extra guests (bots over the public API, `sim/src/random.mjs`). Each step has a
time budget (`BUDGETS` in `e2e/walkthrough/scenario.mjs`; on demo twice that, and three minutes for step 15, which waits
for the minute rollups). The first step that fails stops the run; the page shows how far it got.

## The page

`walkthrough.html` is one self-contained file (its styles and every screenshot inside it): every step with its side,
screenshot, caption, start, time against its budget, and verdict; a header with the environment (local or demo), the
date, whether the menu was invented, and steps passed of total with the total time. Beside it: `walkthrough.json` (the
same record, with a failure's details) and `shots/`. **It is never published.**

## The command

On Daniel's Mac, against the demo database `mana`:

```bash
npm ci                                          # once
npm run demo -- --scenario client-walkthrough   # the invented café (in the repository)
npm run demo -- --scenario <private name>       # a client's own (private/demo-scenarios/, git-ignored)
```

It builds the demo site, serves it at `http://127.0.0.1:4180/mana/`, runs the walkthrough against it, prints one line
per step, writes the page to `private/demo-output/<scenario>/walkthrough.html`, and keeps serving (Ctrl-C stops it). It
needs Node 22.18+ and Google Chrome (or `CHROME` set to a Chromium). `MANA_WALKTHROUGH_HEADED=1` shows the browser.

On Linux, against the simulator's stack (a scanner stand-in runs there, so step 5 runs too):

```bash
npm run dev:local -- --scenario client-walkthrough --exit
cd e2e && node --test walkthrough.test.mjs     # the e2e test: twice on one stack; pages in e2e/.out/walkthrough/
```

## What it needs on `mana`

- **The schema:** every migration in `supabase/migrations`, the phase-1 one (`20261016120000_phase1.sql`) included, with
  `public_base` set (`supabase/README.md`, "Once, after the last one"). The run checks the back office's functions first.
- **Auth:** sign-up open. "Confirm email" may be on or off: when it is on, the run waits (up to 15 minutes) at step 1
  for the confirmation link in the owner's mailbox, and leaves that time out of the step's budget. The redirect
  allow-list holds `http://127.0.0.1:4180/**`, where the confirmation link and the owner app land.
- **`private/demo.env`** (git-ignored; never printed):
  ```
  MANA_DEMO_STAFF_EMAIL=…        # a Halom admin (the demo label is an admin's)
  MANA_DEMO_STAFF_PASSWORD=…
  MANA_DEMO_STAFF_TOTP_SECRET=…  # optional: the base32 secret of that admin's TOTP factor (as an authenticator app gets it)
  MANA_DEMO_OWNER_EMAIL=halom.studio+demo-{run}@gmail.com   # for client-walkthrough; {run} makes it fresh per run
  MANA_DEMO_CLIENT_DISPLAY_NAME=…  # optional: a private scenario's venue name on the database
  ```
  A private scenario takes the owner's address from its own settings file. Its venue is named neutrally by default (a
  published demo menu on `mana` is a public page, D40); the client's own name is used only when
  `MANA_DEMO_CLIENT_DISPLAY_NAME` is set. If an account is missing, the run stops
  before anything is written and says which step needs which account.
- **Staff 2FA** (`staff_require_aal2` on): the admin needs a verified TOTP factor, and `MANA_DEMO_STAFF_TOTP_SECRET` its
  secret. The run signs in with the password, then completes the second step with a code it computes (RFC 6238:
  HMAC-SHA1, 30 seconds, 6 digits; `e2e/walkthrough/totp.mjs`, `node:crypto` only) through Supabase Auth's challenge
  and verify for that factor. The back office has no second-step screen yet, so the run puts the completed (aal2)
  session into the back office's own storage and reloads it; once the screen exists, the run types the code there.
  Without the secret nothing changes: a database that asks for the second step stops the run before anything is
  written, saying so. Neither the secret nor a code is ever printed or written to the page.
- **The scanner** is not deployed on `mana` (Daniel's gate, B29): step 5 shows "not available here yet" and the menu
  comes from the Wolt text.

## What it writes

On `mana`: one venue per run, `<slugBase>-<run id>` (so a second run never meets the first), labelled demo by Halom in
step 10 (`ops_set_demo`), so its traffic stays out of real totals; its menu, imports, rules, a day part, events and
rollups; one owner account per run, whose address and password are saved for Daniel in
`private/demo-output/<scenario>/owner-account.txt`. Nothing is deleted: the runs' venues stay on `mana`, each a demo
venue.

On the machine: `private/demo-output/<scenario>/` (the page, its JSON, `shots/`), all git-ignored. A scenario that
changes a file git sees fails (`tools/demo.mjs`).

## Synthetic and private

The repository holds only the invented café: `e2e/fixtures/walkthrough-cafe.mjs` (its Wolt text, the screenshots'
recorded reply, and what the owner, a guest and Halom do with it) and `tools/demo-scenarios/client-walkthrough.mjs`.
A client's walkthrough is three things under `private/`, which git ignores: its input (the menu as the owner pastes
it, and a settings file with the venue's name and the owner's address), its scenario file, and its output. None of it
is ever committed, pasted into a pull request, or published.
