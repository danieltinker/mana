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
| `data/store.ts` | The state: session, places, the open place's whole menu (the draft), saving (autosave of the changed columns, guarded; conflicts; writes that put the stored rows on screen) |
| `data/saves.ts` | The rows' save queue (pure, unit-tested): one write in flight per row, typing merged, failures and conflicts held for the owner |
| `saving.tsx`, `leave.ts` | The "not saved" line with its retry (on the page and in a sheet); the guard that asks before leaving a screen with changes |
| `data/forms.ts` | Rows ↔ forms, ₪ ↔ agorot, and the validators' rules before any write (same codes) |
| `data/nesting.ts` | The one nesting level as the editor applies it: what an option may open, never a second level |
| `data/guest.ts` | A dish as the guest gets it (as `app.build_snapshot_full` builds it) and the guest's choices, priced with `priceDish` |
| `data/draft.ts`, `data/changes.ts` | `preview_menu` beside the published revision: what stops a publish, what warns (with `lintSnapshotV2`), what would change; where the menu stands (never, pending approval, live, offline) |
| `data/rules.ts` | Suggestion rules (F06): rows ↔ the rule form and its checks, the rule as the snapshot builder publishes it (`ruleV2`), priority by order (`reprioritize`), and the live preview (`previewRule`): `matchSuggestion` on the draft menu with a sample basket, day, hour and the guest's tags (`passesTagFilter`), and the first reason when nothing would be suggested (the contracts' `whyNoSuggestion`, on which `matchSuggestion` is built) |
| `data/hours.ts` | Opening hours (several windows a day, no overlap, across midnight too), closed dates and schedules (day parts, specials): rows ↔ forms with the schema's checks; `venueHoursOf` builds the hours exactly as `public_menu`'s live overlay does |
| `data/availability.ts` | The quick actions (F05): the "until" choices and their `resolveUntil` moments, what is off now (`offState`, with the contracts' `isAvailable`), "taken off today", and `availabilityApi(rpc)`: `set_availability` and `restore_today` with the contracts' validators first (pure: the tests pass a fake RPC) |
| `data/live.ts` | What is off at the open place, kept current (ADR-007): Realtime on `availability_overrides` when `runtime.realtime`, else polling (`LIVE_REFRESH`, `pollDelay`, visible pages only); a `clock` that moves at the next "until"; `takeOff`, `bringBack`, `restoreToday` |
| `data/rule-numbers.ts` | The slot for each rule's numbers (shown, accepted, dismissed) on the rules list; empty until the dashboard lane calls `setRuleNumbers` |
| `words.ts` | A rule in one plain line ("After Coffee, suggest Croissant, 7–11"), days, times, dates and "until" moments in the venue's time zone; ranges are isolated left to right inside Hebrew |
| `screens/` | start, new place, menu (with each row's availability one tap away, the red marker, "bring back everything taken off today"), dish (details, add-ons with the guest preview, goes well with), add-on library and group editor, availability sheet (`off.tsx`), hours (week, closed dates, what guests see of something unavailable, day parts and specials), suggestion rules (list and editor with its live preview), publish |

**Shared with v1 and kept at the cutover** (not schema-specific): `lib/api.ts` (the client, `cfg`, `sibling`),
`lib/i18n.ts` (language, dates, the base dictionary), `lib/money.ts`, `lib/slug.ts`, `lib/email.ts`, `lib/links.ts`,
`ui.tsx`, `brand.tsx`, `product.ts`, `mark-shapes.ts`, `app.css`. From `lib/store.ts` v2 uses only `toast()` (the
`Toasts` in `ui.tsx` read it) and `planOf()`; at the cutover they move into `ui.tsx` and `v2/format.ts`.

## Rules the data layer keeps

- **Every write goes through `data/store.ts`**, which puts the rows the database returned on screen (names come back
  stripped, positions as stored) and bumps `edits`, which the draft preview follows.
- **A form sends only what its owner changed.** `patchRow(table, id, patch)` (autosave, 600 ms) and `saveNow(table, id,
  patch)` (at once; answers 'saved' or 'conflict') take the columns of one edit (`dishEdit` for a dish, the section
  sheet's own diff), never a whole row.
- **One queue for the rows' writes** (`data/saves.ts`, unit-tested with a fake API in `test/unit/v2-saves.test.mjs`):
  - one write in flight per row; what is typed meanwhile waits as one patch (the latest value of each column) and goes
    when that write is answered, over the version it left; moves, dish limits and group saves wait in the same lane;
  - a failure (no connection, or an answer that never came) takes in everything typed after it for that row; nothing
    more is sent for that row until the owner retries (the "not saved" line, on the page and inside an open sheet) or
    the connection comes back (`online`); the retry sends all of it as one patch, so a later value always wins;
  - a write that stored a column takes it out of the failed patch.
- **Every change of a row is guarded** (`api.updateIf`): it is written only while the row still has the `updated_at` this
  screen read (a move: the position it started from; a dish's limits: the limits it read). Zero rows back is read again:
  - changed elsewhere (`stale`): nothing of it is written, and nothing typed after it is sent; `conflicts` holds the
    owner's latest values beside the stored row and `conflict.tsx` asks (no close button): keep mine (sent over the
    stored version; asked again if it moved once more) or take the stored one. Two cases are not "changed elsewhere":
    the row already holds what was typed, and the row moved only because of this screen's own write whose answer was
    lost (every column that moved holds what this screen sent): then what is still to send goes, unasked;
  - still there, unchanged: row-level security said no, so it is "not allowed" (`forbidden`);
  - not readable any more: the membership is read again; "not allowed" when the account may no longer edit here (the
    place stays on screen, read-only), "no longer exists" only when someone who may edit deleted the row (the menu is
    read again). A row is never just dropped from the screen.
  Every permission refusal, on every write path (autosave, moves, limits, new rows, deletions, group saves), reads the
  role again: a manager made counter turns read-only on the spot.
- **An add-on group is saved as one** (`save_addon_group`, `saveGroupForm`): the group and every option in one
  transaction, with the client's own ids, sent with the group's `updated_at` as the form read it. Before it is sent, the
  form is checked with the contracts' `validateAddonGroup` / `validateAddonGroupInput` (the database's twin: the same
  codes, shown at the form's fields by `groupFieldError`) and the loaded menu with `addonGroupMenuIssues` (a second
  nesting level; a dish whose own limits the change would break, named: `dish_limits`). Answers: saved; `stale` with the
  stored group (the editor shows it, and "save my changes over it" sends the stored group with only what the owner
  changed in this form put over it, field by field and choice by choice: `mergeGroupForms`; or take it);
  `option_in_rules` (the editor names the rules and asks before sending again with `confirmRules`); or a refusal that
  changed nothing. The same input sent twice is answered "saved", so a retry after a lost answer is safe.
- **New rows carry ids made here** (`newId`; `insertOnceInfo`): quick-add of a dish, a new section, a new group and its
  choices keep their id until stored, so trying again after a lost answer never stores a second row; when the owner
  retyped it meanwhile, what they typed last goes over the stored one. A link (a group on a dish, "goes well with") tried
  again finds the one already stored by its pair.
- **A refusal is a code, said in plain words**: `toV2Error` maps it (the schema's `not_allowed` and row-level security's
  refusal are one code, `forbidden`), `errText` (v2 `i18n.ts`) says it (`refused`, and `resync` makes a form read its
  row again).
- **Ways out ask first**: signing out or switching place with a change that did not save, and leaving a group form with
  changes (its back link, the bottom bar, the brand, the account sheet: `leave.ts`).
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
- **Rules and schedules save like dishes**: the editor sends only what changed since it opened (`saveNow`, the save
  queue's `patchRow` saved at once and awaited), guarded by `updated_at`, and a conflict opens `conflict.tsx`; when the
  menu was read again while the editor was open and a column the owner changed moved elsewhere too, the editor shows the
  stored rule and says so instead of saving. Reordering rules goes one move at a time (`setPriorities`): a move waits for
  this tab's earlier moves, then checks the whole order as stored against what this tab expects, so this tab's own quick
  moves are never refused and another tab's reorder comes back with a notice; each rule is written only while it still
  has the priority this tab gave it. **Opening hours** carry `updated_at` (phase-1 schema): they are read again when the
  hours screen opens or comes back into view (`refreshHours`) and before hours are added (the overlap check runs on what
  is stored now; the database's `venue_hours_overlap` trigger raises `hours_overlap` for what slips through); an open
  window editor keeps the version it read, says when the window changed meanwhile, and its save is guarded on that
  `updated_at` (`saveHours`): never written over a change made elsewhere. **Closed dates** have no `updated_at`: only
  added or deleted.
- **A lost answer is not "changed elsewhere"**: a guarded write that finds its own values already stored (its earlier
  answer was lost) counts as saved. New rows keep their ids across tries; a try after a lost answer with other values
  than the stored ones is not stored over them silently (`insertAllOnce` answers `stored_earlier` with the stored rows):
  a new rule stores the change on the stored rule (guarded), new hours say what was stored.
- **One place at a time**: switching place or account drops everything (what failed to save included, after the owner
  confirms it); late answers for the old one are ignored. A store of a later lane registers `onReset(fn)` to drop its own
  state with it.
- **Availability is written by the RPCs only**: `set_availability` and `restore_today` (ADR-008), never table inserts
  (those stay granted for the simulator). A whole add-on group is each of its choices, one call each. Overrides are
  read, never patched on screen: every action fetches them again. The availability sheet reads the clock every second
  while it is open, so the "back at" shown before the tap is the minute stored. "Taken off today" is the venue's
  calendar day, as `restore_today` has it: at 00:30, what was taken off at 23:50 is yesterday's (a question for Rami
  whether a service day should run past midnight; the contracts and the database would change together).
- **Everything about time is the contracts'**: `resolveUntil`, `isOpenAt`, `nextOpening`, `isAvailable`,
  `matchSuggestion`, in the venue's `time_zone`; the screens only say the moments in words (`words.ts`).

## How the next lanes plug in

**Routes and navigation.** Add an entry to `SCREENS` in `routes.tsx`: `{ path, render(rest), nav? }`. A `nav`
(`{ key, icon, label, order, dot? }`) puts it in the bottom bar in `order` (menu 20, add-ons 30, publish 90); past five
tabs the fifth becomes "More" with the rest in a sheet, so no lane has to fight for room. `landing()` is where a place
opens and where an address that leads nowhere goes: today it returns `'menu'` and nothing else (the lanes below change
it). It is used after `create_venue`, after switching place, and by the shell for an unknown address; a reload keeps the
address it was on. A screen without `nav` is reachable by address only.

The "today" column says what exists on this branch; the "to do" column is the lane's own work.

| Lane | Screens (to do) | Data (to do) | Today |
|---|---|---|---|
| **F03 onboarding and import** | `onboarding/<step>` (no nav); the import preview with its exceptions; make `landing()` return `onboarding` while steps are open | `onboarding_progress`, `menu_imports` in a new `data/onboarding.ts` (with `onReset`); imported dishes through `addDish(section, cols, id)`, imported option groups through `saveGroupForm(id, form, null)` (so the form rules, the nesting guard and the one-transaction save apply) | the empty menu's `Empty` in `screens/menu.tsx` is where "bring your menu" goes; `venue-new.tsx` goes to `landing()` after `create_venue` |
| **F05 availability, schedules, hours** (built) | `hours` (nav, order 40; `hours/parts`, `hours/parts/<id>`); the availability sheet at `menu/a/<section\|dish\|option\|group>/<id>` | `schedules`, `venue_hours`, `venue_closures` in `MenuTable`; overrides in `data/live.ts` | a counter operates (`canOperate()`) and sees the rest read-only; `runtime.realtime` is false locally (polling instead) |
| **F06 upsell rules** (built) | `rules` (nav, order 50; `rules/<id>`, `rules/new`) | `upsell_rules` in `MenuTable` | publishing lists the builder's `rule_left_out` warnings and `lintSnapshotV2`'s, in words (`issue.*` in `i18n.ts`); the group editor asks before deleting a choice a rule suggests, and the rule leaves the list with it |
| **F08 dashboard, activity, export** | `home` (nav, order 10; make `landing()` return it), `activity`, export | `my_dashboard`, `activity_log` in `data/dashboard.ts`; the export reads `draft.value.snapshot` | the publish dot (`hasChanges`) and `standingOf()` say where the menu stands; **quick actions**: link to `#/menu/a/<kind>/<id>` (the availability sheet) or call `takeOff` / `bringBack` / `restoreToday` (`data/live.ts`), and read `offNow()` and `clock` for "off now"; "add a special" (H53, the dashboard's short phone flow) links to `#/hours/parts/new-special`; **per-rule numbers**: `setRuleNumbers(dashboard.rules)` (`data/rule-numbers.ts`) and the rules list shows them |

**Words.** New keys go in `i18n.ts` (a key lives in one dictionary; `node test/check-i18n.mjs` checks both). New Hebrew
needs a native read before it reaches anyone.

**Tests.** Pure modules under `data/` import nothing from the browser, so `test/unit/v2-*.test.mjs` runs them in Node as
they are. Browser tests live in `e2e/` (`startE2E()` serves the built `_site` with a local config: schema 2 on the
simulator's stack): `e2e/studio-v2.test.mjs` is the whole scenario (the pattern), `e2e/studio-v2-edges.test.mjs` the
edges (production boot, price parity with `public_menu`, two tabs, lost answers, offline, a counter, sign-up, RTL,
keyboard, names, text never HTML), `e2e/studio-v2-saving.test.mjs` saving on a slow, failing or forgetful network
(two edits in flight, retries, roles that change, the ways out), `e2e/studio-v2-operate.test.mjs` the operating screens
(suggestion rules, hours and day parts, the availability quick actions, and a counter: operates, edits nothing).

## Not here yet

Pictures and reliefs on v2 dishes (the dish has no picture slot yet), the place's style and contact settings, team
members, the "pause ordering now" switch (with ordering, phase 2), a note on an availability override (the RPC takes
one; the sheet does not ask yet), and everything listed above for the next lanes.
