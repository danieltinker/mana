# The owner app on the clean schema (v2)

`src/main.tsx` boots this app when the contracts' `configFlags(window.HALOM_MENUS_CONFIG)` says schema 2 (`env` demo:
the database `mana`; `env` local: the simulator's stack); it is loaded as a chunk of its own, so production (`schema`
absent or 1, or `env` production whatever the schema says; the `halom-studio` project) downloads none of it and runs the
v1 app as before. The cutover (ADR-005) deletes v1's schema-specific files and
makes this the app.

## What is here

| Path | What |
|---|---|
| `main.tsx`, `app.tsx` | Boot; who is signed in decides the first screen (start, a new place, the shell); the shell: top bar (the place, saving, the account), the screen, the bottom bar (a rail on a wide screen) |
| `conflict.tsx` | "Changed somewhere else": a change the database did not take because another tab or device saved the row first, the stored values beside the owner's, and the owner's choice |
| `routes.tsx` | Every screen in the shell by address (`#/<path>/…`) and the phone navigation built from them |
| `i18n.ts` | v2's words (Hebrew, English); `t()` falls back to v1's dictionary, `errText(code)` says a code in plain words |
| `ui.tsx`, `format.ts`, `v2.css` | v2's own small pieces (reorder by drag and keyboard, stepper, price, tabs, language switch) and styles |
| `data/client.ts` | The supabase-js client and sign-in shared with v1 (`lib/api.ts`), `q()` and `rpc()` (an RPC's `{ok:false, code}` is thrown), the config's `env`, `schema`, `realtime` (`runtime`, read with the contracts' `configFlags`, as `src/main.tsx` reads `schema`) |
| `data/errors.ts` | Every failure as one code (`V2Error`): the schema's raised words (`nesting_too_deep`, `limits_loosened`, `limit_*` …), PostgREST and Auth codes |
| `data/menu.ts` | The tables and RPCs, stateless, typed with `@mana/contracts`' row types; direct table access under RLS (as `sim/src/owner.mjs`): guarded updates (`updateIf`), inserts with the client's id (`insertOnce`), `save_addon_group` |
| `data/store.ts` | The state: session, places, the open place's whole menu (the draft), saving (autosave of the changed columns, guarded, one queue per row; conflicts; writes that put the stored rows on screen) |
| `data/forms.ts` | Rows ↔ forms, ₪ ↔ agorot, and the validators' rules before any write (same codes) |
| `data/nesting.ts` | The one nesting level as the editor applies it: what an option may open, never a second level |
| `data/guest.ts` | A dish as the guest gets it (as `app.build_snapshot_full` builds it) and the guest's choices, priced with `priceDish` |
| `data/draft.ts`, `data/changes.ts` | `preview_menu` beside the published revision: what stops a publish, what warns (with `lintSnapshotV2`), what would change; where the menu stands (never, pending approval, live, offline) |
| `data/rules.ts` | Suggestion rules (F06): rows ↔ the rule form and its checks, the rule as the snapshot builder publishes it (`ruleV2`), priority by order (`reprioritize`), and the live preview (`previewRule`): `matchSuggestion` on the draft menu with a sample basket, and the first reason when nothing would be suggested (`whyNot`, found by asking `matchSuggestion` one condition at a time) |
| `data/hours.ts` | Opening hours (several windows a day, no overlap, across midnight too), closed dates and schedules (day parts, specials): rows ↔ forms with the schema's checks; `venueHoursOf` builds the hours exactly as `public_menu`'s live overlay does |
| `data/availability.ts` | The quick actions (F05): the "until" choices and their `resolveUntil` moments, what is off now (`offState`, with the contracts' `isAvailable`), "taken off today", and `availabilityApi(rpc)`: `set_availability` and `restore_today` with the contracts' validators first (pure: the tests pass a fake RPC) |
| `data/live.ts` | What is off at the open place, kept current (ADR-007): Realtime on `availability_overrides` when `runtime.realtime`, else polling (`LIVE_REFRESH`, `pollDelay`, visible pages only); a `clock` that moves at the next "until"; `takeOff`, `bringBack`, `restoreToday` |
| `data/rule-numbers.ts` | The slot for each rule's numbers (shown, accepted, dismissed) on the rules list; filled by `data/dashboard-live.ts` from `my_dashboard`'s `rules` |
| `data/refresher.ts` | How a live screen stays current (ADR-007), as one pure timer: a Realtime message is a signal (one fetch per `LIVE_REFRESH.debounceMs`), beside a subscription a safety poll every `LIVE_REFRESH.safetyMs`, without one (or when it fails) a poll every `pollMs`, always with `pollDelay`'s backoff and only while the page is visible; the timers are passed in, so the tests drive it with a fake clock |
| `data/records.ts` | The records' RPCs, stateless, each input checked with the contracts' validator: `my_dashboard` (v2), `venue_activity`, `export_menu`, `open_case`, and the open help requests (the `support_cases` table under its RLS; no RPC lists them for the owner) |
| `data/dashboard.ts` | The dashboard as the phone shows it (pure): "no visits yet", the chart's bars (every day of the range; the last hour's sixty minutes, the ones the reply leaves out at zero), a clean axis top, which bars carry their number, shares, and where each nudge leads (`nudgeHref`) |
| `data/dashboard-live.ts` | `my_dashboard` for the open place and the chosen range, live while Home or the rules list is open (a channel per venue on the three Realtime tables, or polling), after the owner's own writes, on return to the foreground; fills `setRuleNumbers` |
| `data/approval.ts` | Backlog B4: while a first publish waits for Halom, the place learns of the approval by itself (a channel on its `venues` row, or polling), so the publish screen and Home flip to live without "check again" |
| `data/activity.ts` | The activity log in plain words (pure): who (you, someone on your team, Halom, automatically), what (from the action, the name the RPC sent and the numbers the log kept), when on the venue's clock, Halom's reason; no verb agrees with the actor, so Hebrew needs no person or gender |
| `data/special.ts` | A special in one sheet (Hopa H53, pure): the dish's names and price, its section, the days and hours → a schedule of kind special named after the dish and the dish linked to it, each mistake at its field |
| `data/export.ts` | `export_menu`'s reply as the JSON file it is, and as a readable CSV (pure): a row per dish and per add-on choice (a nested group's choices under their opener), both languages, prices in shekels, RFC 4180 quoting, formulas kept as text, a byte order mark for Excel |
| `chart.tsx` | A column chart by hand in SVG: one series, a clean axis top, the highest and the latest value written on it, each value a tap or hover away; the table under it lists them all |
| `words.ts` | A rule in one plain line ("After Coffee, suggest Croissant, 7–11"), days, times, dates and "until" moments in the venue's time zone; ranges are isolated left to right inside Hebrew |
| `screens/` | home (nudges, quick actions, what is off now, at a glance, recent changes, the export), special (the one-sheet special: schedule, dish and publish through the store, client ids, the approval said before the tap), activity (the log, filters, pages), help ("get help", the open requests; the shell's help button), start, new place, menu (with each row's availability one tap away, the red marker, "bring back everything taken off today"), dish (details, add-ons with the guest preview, goes well with), add-on library and group editor, availability sheet (`off.tsx`), hours (week, closed dates, what guests see of something unavailable, day parts and specials), suggestion rules (list and editor with its live preview), publish |

**Shared with v1 and kept at the cutover** (not schema-specific): `lib/api.ts` (the client, `cfg`, `sibling`),
`lib/i18n.ts` (language, dates, the base dictionary), `lib/money.ts`, `lib/slug.ts`, `lib/email.ts`, `lib/links.ts`,
`ui.tsx`, `brand.tsx`, `product.ts`, `mark-shapes.ts`, `app.css`. From `lib/store.ts` v2 uses only `toast()` (the
`Toasts` in `ui.tsx` read it) and `planOf()`; at the cutover they move into `ui.tsx` and `v2/format.ts`.

## Rules the data layer keeps

- **Every write goes through `data/store.ts`**, which puts the rows the database returned on screen (names come back
  stripped, positions as stored) and bumps `edits`, which the draft preview follows.
- **A form sends only what its owner changed.** `patchRow(table, id, patch)` (autosave, 600 ms) takes the columns of one
  edit (`dishEdit` for a dish, the section sheet's own diff), never a whole row.
- **Every change of a row is guarded** (`api.updateIf`): it is written only while the row still has the `updated_at` this
  screen read (a move: the position it started from; a dish's limits: the limits it read). Zero rows back is read again:
  - changed elsewhere (`stale`): nothing is written; `conflicts` holds the owner's values beside the stored row and
    `conflict.tsx` asks (no close button): keep mine (sent again over the stored version) or take the stored one. A
    stored row that already holds the owner's values (their own answer was lost) needs no question;
  - not there any more: dropped, "no longer exists";
  - still there, unchanged: row-level security said no, so it is "not allowed" (`forbidden`), the field shows what is
    stored, and the role is read again (a manager made counter turns read-only on the spot).
- **The writes to one row run one after another** (`onRow`), each with the version the one before left.
- **An add-on group is saved as one** (`save_addon_group`, `saveGroupForm`): the group and every option in one
  transaction, with the client's own ids, sent with the group's `updated_at` as the form read it. Before it is sent, the
  form is checked with the contracts' `validateAddonGroup` / `validateAddonGroupInput` (the database's twin: the same
  codes, shown at the form's fields by `groupFieldError`) and the loaded menu with `addonGroupMenuIssues` (a second
  nesting level; a dish whose own limits the change would break, named: `dish_limits`). Answers: saved; `stale` with the
  stored group (the editor shows it: save mine over it, or take it); `option_in_rules` (the editor names the rules and
  asks before sending again with `confirmRules`); or a refusal that changed nothing. The same input sent twice is
  answered "saved", so a retry after a lost answer is safe.
- **New rows carry ids made here** (`newId`; `insertOnce`): quick-add of a dish, a new section, a new group and its
  choices keep their id until stored, so trying again after a lost answer never stores a second row.
- **A refusal is a code, said in plain words**: `toV2Error` maps it, `errText` (v2 `i18n.ts`) says it (`refused`, and
  `resync` makes a form read its row again). A network failure keeps what was typed and offers to retry.
- **Publishing waits for saving**: while a change is on its way, failed, or waiting for a decision, the publish button
  is off and the screen says which.
- **Prices are agorot**, typed in shekels (`agorotOf`, `shekelsOf`), never floats.
- **The UI never offers what the schema refuses**: tighter dish limits only (`limitChoices`), one nesting level only
  (`openTargets`), and the form's rules before a write (`groupFromForm`). When another device changed the library in the
  meantime, the database's refusal is shown and the library reloads.
- **Who may edit**: owners and managers (`canEdit()`). Any other member (a counter) sees every screen read-only. A new
  screen does the same in three steps (all in `ui.tsx`, as `screens/dish.tsx`, `screens/addons.tsx`, `screens/rules.tsx`
  and `screens/hours.tsx` do):
  1. wrap the editing area in `<ReadOnly when={!editable}>` (one fieldset: everything inside is disabled at once);
  2. put `disabled={!editable}` on each control too (`MoneyInput`, `Stepper`, `Seg`, `Switch` and the inputs take it), and
     do not render the buttons that only edit (save, delete, add, arrange);
  3. `useEditOnly(onEditAddress, editable, back)` for an address that only edits (`#/menu/s/…`, `#/addons/new`,
     `#/rules/new`, `#/hours/parts/new`).
  A store's writes start with `mayWrite()` (or go through `patchRow`, `write`), so the network is never asked; a write
  row-level security refuses anyway (a role changed meanwhile) is "not allowed", and the role is read again.
  Sold-out actions are a counter's own (F05): `canOperate()` (owner, manager, counter) shows them, and `data/live.ts`
  calls the RPCs directly, not through `write`.
- **Rules and schedules save like dishes**: the editor sends only what changed since it opened (`saveNow`, which is
  `patchRow` saved at once and awaited), guarded by `updated_at`, and a conflict opens `conflict.tsx`. Reordering rules
  is guarded by the priority each had (`setPriorities`, as `moveRow` guards positions). **Opening hours and closed dates
  have no `updated_at`**: a window's new times are written only while it still has the times the screen read
  (`saveHours`, `stale` otherwise, and the stored times come back); a closed date is only added or deleted.
- **One place at a time**: switching place or account drops everything (what failed to save included, after the owner
  confirms it); late answers for the old one are ignored. A store of a later lane registers `onReset(fn)` to drop its own
  state with it.
- **Availability is written by the RPCs only**: `set_availability` and `restore_today` (ADR-008), never table inserts
  (those stay granted for the simulator). A whole add-on group is each of its choices, one call each. Overrides are
  read, never patched on screen: every action fetches them again.
- **Everything about time is the contracts'**: `resolveUntil`, `isOpenAt`, `nextOpening`, `isAvailable`,
  `matchSuggestion`, in the venue's `time_zone`; the screens only say the moments in words (`words.ts`).

## How the next lanes plug in

**Routes and navigation.** Add an entry to `SCREENS` in `routes.tsx`: `{ path, render(rest), nav? }`. A `nav`
(`{ key, icon, label, order, dot? }`) puts it in the bottom bar in `order` (home 10, menu 20, add-ons 30, hours 40, rules 50,
activity 80, publish 90); past five
tabs the fifth becomes "More" with the rest in a sheet, so no lane has to fight for room. `landing(venue?)` is where a place
opens and where an address that leads nowhere goes: Home once the place has published, else the menu (the onboarding
lane makes it return `onboarding` while steps are open). It is used after `create_venue` (`landing(null)`), after
switching place (`landing(<the place being opened>)`), and by the shell for an unknown address; a reload keeps the
address it was on. A screen without `nav` is reachable by address only.

The "today" column says what exists on this branch; the "to do" column is the lane's own work.

| Lane | Screens (to do) | Data (to do) | Today |
|---|---|---|---|
| **F03 onboarding and import** | `onboarding/<step>` (no nav); the import preview with its exceptions; make `landing()` return `onboarding` while steps are open | `onboarding_progress`, `menu_imports` in a new `data/onboarding.ts` (with `onReset`); imported dishes through `addDish(section, cols, id)`, imported option groups through `saveGroupForm(id, form, null)` (so the form rules, the nesting guard and the one-transaction save apply) | the empty menu's `Empty` in `screens/menu.tsx` is where "bring your menu" goes; `venue-new.tsx` goes to `landing()` after `create_venue` |
| **F05 availability, schedules, hours** (built) | `hours` (nav, order 40; `hours/parts`, `hours/parts/<id>`); the availability sheet at `menu/a/<section\|dish\|option\|group>/<id>` | `schedules`, `venue_hours`, `venue_closures` in `MenuTable`; overrides in `data/live.ts` | a counter operates (`canOperate()`) and sees the rest read-only; `runtime.realtime` is false locally (polling instead) |
| **F06 upsell rules** (built) | `rules` (nav, order 50; `rules/<id>`, `rules/new`) | `upsell_rules` in `MenuTable` | publishing lists the builder's `rule_left_out` warnings and `lintSnapshotV2`'s, in words (`issue.*` in `i18n.ts`); the group editor asks before deleting a choice a rule suggests, and the rule leaves the list with it |
| **F08 dashboard, activity, export; F03's "get help"** (built) | `home` (nav, order 10; `landing()` returns it once the place has published), `activity` (nav, order 80), `help` (no nav; the shell's help button) | `my_dashboard` in `data/dashboard-live.ts`, `venue_activity`, `export_menu`, `open_case` in `data/records.ts` | `nudgeHref` opens `onboarding/<step>` as soon as that screen exists, and the screens that exist until then; the dashboard's `nudges` already carry `import_waiting` for the import preview |

**Words.** New keys go in `i18n.ts` (a key lives in one dictionary; `node test/check-i18n.mjs` checks both). New Hebrew
needs a native read before it reaches anyone.

**Tests.** Pure modules under `data/` import nothing from the browser, so `test/unit/v2-*.test.mjs` runs them in Node as
they are. Browser tests live in `e2e/` (`startE2E()` serves the built `_site` with a local config: schema 2 on the
simulator's stack): `e2e/studio-v2.test.mjs` is the whole scenario (the pattern), `e2e/studio-v2-edges.test.mjs` the
edges (production boot, price parity with `public_menu`, two tabs, lost answers, offline, a counter, sign-up, RTL,
keyboard, names, text never HTML), `e2e/studio-v2-operate.test.mjs` the operating screens (suggestion rules, hours and day
parts, the availability quick actions, and a counter: operates, edits nothing).

## Not here yet

Pictures and reliefs on v2 dishes (the dish has no picture slot yet, so the "no photo" nudge opens the dish), the
place's style and contact settings, team members, the "pause ordering now" switch (with ordering, phase 2), a note on
an availability override (the RPC takes one; the sheet does not ask yet), confirming an imported group's limits
without changing them (the "limits not confirmed" nudge opens the group editor, which has no such control yet), and
everything listed above for the next lanes.
