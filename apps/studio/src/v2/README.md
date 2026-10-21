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
| `data/live.ts` | What is off at the open place, kept current (ADR-007): Realtime on `availability_overrides` when `runtime.realtime`, with the slow safety poll beside it (`LIVE_REFRESH.safetyMs`), else polling (`LIVE_REFRESH.pollMs`); visible pages only, `pollDelay`'s backoff; a channel removed with an earlier place changes nothing (`channelMode`, `liveDelay` in `data/availability.ts`, unit-tested); a `clock` that moves at the next "until"; `takeOff`, `bringBack`, `restoreToday` |
| `data/rule-numbers.ts` | The slot for each rule's numbers (shown, accepted, dismissed) on the rules list, with the period they count (`ruleNumbersRange`, which the list says); filled by `data/dashboard-live.ts` from `my_dashboard`'s `rules` and `range` |
| `data/refresher.ts` | How a live screen stays current (ADR-007), as one pure timer: a Realtime message is a signal (one fetch per `LIVE_REFRESH.debounceMs`), beside a subscription a safety poll every `LIVE_REFRESH.safetyMs`, without one (or when it fails) a poll every `pollMs`, always with `pollDelay`'s backoff and only while the page is visible; the timers are passed in, so the tests drive it with a fake clock |
| `data/records.ts` | The records' RPCs, stateless, each input checked with the contracts' validator: `my_dashboard` (v2), `venue_activity`, `export_menu`, `open_case`, and the open help requests (the `support_cases` table under its RLS; no RPC lists them for the owner) |
| `data/dashboard.ts` | The dashboard as the phone shows it (pure): "no visits yet", the chart's bars (every day of the range; the last hour's sixty minutes, the ones the reply leaves out at zero), a clean axis top, which bars carry their number, shares, and where each nudge leads (`nudgeHref`) |
| `data/dashboard-live.ts` | `my_dashboard` for the open place and the chosen range, live while Home or the rules list is open (a channel per venue on the three Realtime tables, each subscription on its own topic, or polling), after the owner's own writes, on return to the foreground; fills `setRuleNumbers` |
| `data/approval.ts` | Backlog B4: while a first publish waits for Halom, the place learns of the approval by itself (its `venues` row read every `LIVE_REFRESH.pollMs.owner` while visible; `venues` is not in the phase-1 Realtime publication), so the publish screen and Home flip to live without "check again" |
| `data/activity.ts` | The activity log in plain words (pure): who (you, an owner, a manager, the counter, Halom, automatically), what (from the action, the name the RPC sent or, where it sends none, the loaded menu's name for the row, and the numbers the log kept), when on the venue's clock, Halom's reason; one line per approval; no verb agrees with the actor, so Hebrew needs no person or gender |
| `data/special.ts` | A special in one sheet (Hopa H53, pure): the dish's names and price, its section, the days and hours → a schedule of kind special named after the dish and the dish linked to it, each mistake at its field |
| `data/export.ts` | `export_menu`'s reply as the JSON file it is, and as a readable CSV (pure): a row per dish and per add-on choice (a nested group's choices under their opener), both languages, prices in shekels, every text quoted (RFC 4180; a comma, semicolon or tab inside never splits a cell), formulas kept as text, a byte order mark for Excel, the file named by the place's own day |
| `data/flow.ts` | The setup flow (F03), pure: the steps in journey order, where a place opens and comes back to on any device (`openStep`: the first step neither done nor skipped; an import waiting for its check first), what holds a step back (`blockersOf`, machine words), how each step ends (`stepEnd`, `endWrite`: never an automatic step done by hand; a menu built by hand skips its review; photos and style only "later") |
| `data/onboarding.ts` | The flow's state: the place's progress (`onboarding_progress` under its RLS, `set_onboarding_step`), its imports (the client columns, never the raw text; only the open place's: `loadImport` reads by id and place, and `importPlace` says which of the account's places another one belongs to), the scanner's availability (`features.scan` and the function's `status`), the pictures prepared (always drawn again and encoded anew, so no EXIF leaves the phone) and uploaded to the import's private folder, the scan call, the reader's notes kept for the session, the owner's answers bound to the signed-in account (another account's, or all once signed out, removed), and where "back to setup" leads (`returnTo`); `onReset` drops it with the place |
| `data/step-writes.ts` | The place's step writes, pure (QA2-M2): one step's `set_onboarding_step` calls go out one after another, a visit's `doing` asked after the step finished is not sent, and a refusal carrying the stored progress becomes the answer (`keptProgress`); a visit never writes the database's own steps (`flow.ts` `visitWrite`, QA2-M1) |
| `data/answers.ts` | The owner's answers to an import's questions as the device keeps them, pure: per account and import (`mana-import-answers:<user>:<import>`), the choices and the keys left out (ADR-006 `skip`), read back only through `validateDecisions`; `forgetAnswersBut` |
| `data/imports.ts` | The import's calls, stateless (`importsApi(rpc)`: `create_import`, `save_import_draft`, `apply_import`, `discard_import`, each input checked with the contracts' validator first), the text readers on the phone (`readText`: @mana/import's paste and Wolt-text readers; D33, nothing fetched), the pictures' paths and input hash, the place's menu as the plan reads it (`existingMenu`) |
| `data/review.ts` | The import preview, pure: every exception (the draft's own, then the plan's) with what it is about, its answers, the owner's or the default; the plan while questions are open (`preview`: open ones take their first answer, said so); what still stops applying (`gate`: a fix unanswered, the prices not confirmed, the plan's own refusals); a price typed in place (`withDishPrice`, `withOptionPrice`); what the owner leaves out (`leaveOut`, ADR-006 `skip`; `fitAnswers` drops keys the draft no longer has); the prices that differ from the venue's (`priceDiffs`); the plan in words (`planLines`, with each left-out line's reason; `changesNothing`); `review` runs the preview and the gate on one plan whenever it can (a large menu takes a while to plan) |
| `data/demo-mark.ts` | Backlog B5, pure: outside production every QR code and print carries a "demo" mark (`withDemoBand`: a band under the code, which still scans) |
| `chart.tsx` | A column chart by hand in SVG: one series, a clean axis top, the highest and the latest value written on it, each value a tap or hover away; the table under it lists them all |
| `words.ts` | A rule in one plain line ("After Coffee, suggest Croissant, 7–11"), days, times, dates and "until" moments in the venue's time zone; ranges are isolated left to right inside Hebrew |
| `screens/` | home (nudges, quick actions, what is off now, at a glance, recent changes, the export), special (the one-sheet special: schedule, dish and publish through the store, client ids, the approval said before the tap), activity (the log, filters, pages), help ("get help", the open requests, the owner's standing switch for Halom acting; the shell's help button), start, new place, menu (with each row's availability one tap away, the red marker, "bring back everything taken off today"), dish (details, add-ons with the guest preview, goes well with), add-on library and group editor, availability sheet (`off.tsx`), hours (week, closed dates, what guests see of something unavailable, day parts and specials), suggestion rules (list and editor with its live preview), the setup flow (`onboarding.tsx`: the steps, their progress, help on each step's topic, "back to setup" in the shell; `import-source.tsx`: bringing the menu four ways; `import-review.tsx`: the import preview), publish with the QR code and the table card once published (`qr.tsx`, marked "demo" outside production) |

**Shared with v1 and kept at the cutover** (not schema-specific): `lib/api.ts` (the client, `cfg`, `sibling`),
`lib/i18n.ts` (language, dates, the base dictionary), `lib/money.ts`, `lib/slug.ts`, `lib/email.ts`, `lib/links.ts`,
`lib/images.ts` (what a picture really is, opening and shrinking it: the import's pictures),
`ui.tsx`, `brand.tsx`, `product.ts`, `mark-shapes.ts`, `app.css`. From `lib/store.ts` v2 uses only `toast()` (the
`Toasts` in `ui.tsx` read it) and `planOf()`; at the cutover they move into `ui.tsx` and `v2/format.ts`.

## Rules the data layer keeps

- **Every write goes through `data/store.ts`**, which puts the rows the database returned on screen (names come back
  stripped, positions as stored) and bumps `edits`, which the draft preview follows.
- **A form sends only what its owner changed.** `patchRow(table, id, patch)` (autosave, 600 ms) and `saveNow(table, id,
  patch)` (the section sheet's Save: at once, with the row's failed patch if it has one; answers 'saved' or 'conflict',
  throws a failure or a refusal) take the columns of one edit (`dishEdit` for a dish, the section sheet's own diff),
  never a whole row.
- **One queue for the rows' writes** (`data/saves.ts`, unit-tested with a fake API in `test/unit/v2-saves.test.mjs`):
  - one write in flight per row; what is typed meanwhile waits as one patch (the latest value of each column) and goes
    when that write is answered, over the version it left; moves, dish limits and group saves wait in the same lane;
  - a failure (no connection, a lost answer, or no answer within 15 s, `ANSWER_MS`) takes in everything typed after it
    for that row; nothing more is sent for that row until the owner retries (the "not saved" line, on the page and inside
    an open sheet) or the connection comes back (`online`); the retry sends all of it as one patch, so a later value
    always wins. Any other write (a move, a group save, a new row) also gives up after 15 s, and so do the re-reads after
    a refusal (the role, the row, the menu), so nothing (a flush, signing out, switching place, a deletion) waits
    forever; signing out says it is waiting meanwhile;
  - a write that stored a column takes it out of the failed patch.
- **An answer that comes late never takes the screen back.** A row the database returned is put on screen only when it
  is not older (`updated_at`, at full precision: `stampOrder`) than the one there, and the queue's baseline (what this
  screen last read) never moves back either. A whole menu read again (`reloadMenuQuietly`) is merged by
  `rowsAfterRead`: a read sent before one already shown is dropped, a row deleted here after the read was sent does not
  come back, a row added here after it stays, and a row without a version (a dish's link to a group with its own
  limits, "goes well with", their order) that this screen stored after the read was sent stays as stored here.
  Known gap: a row edited here after a read was sent and deleted elsewhere before it ran stays until the next read.
- **Every change of a row is guarded** (`api.updateIf`): it is written only while the row still has the `updated_at` this
  screen read (a move: the position it started from; a dish's limits: the limits it read). Zero rows back is read again:
  - changed elsewhere (`stale`): nothing of it is written, and nothing typed after it is sent; `conflicts` holds the
    owner's latest values beside the stored row and `conflict.tsx` asks (no close button): keep mine (sent over the
    stored version; asked again if it moved once more) or take the stored one; only the owner's values that differ from
    what is stored are listed. Two cases are not "changed elsewhere": the row already holds what was typed, and the row
    moved only because of this screen's own writes whose answers were lost (every column that moved holds a value this
    screen sent, any of them): then what is still to send goes, unasked;
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
  changed in this form put over it, field by field and choice by choice: `mergeGroupForms`, prices compared as agorot,
  the owner's pre-selection whole when they changed it; or take it); `option_in_rules` (the editor names the rules and
  asks before sending again with `confirmRules`); or a refusal that changed nothing. The same input sent twice is
  answered "saved", so a retry after a lost answer is safe; and a group stored exactly as one of this screen's saves whose
  answer was lost is not "saved elsewhere": the form goes over it.
- **New rows carry ids made here** (`newId`; `insertOnceInfo`): quick-add of a dish, a new section, a new group and its
  choices keep their id until stored, so trying again after a lost answer never stores a second row; when the owner
  retyped it meanwhile, what they typed last goes over the stored one, through the row's queue like any edit. A link (a
  group on a dish, "goes well with") tried again finds the one already stored by its pair.
- **A refusal is a code, said in plain words**: `toV2Error` maps it (the schema's `not_allowed` and row-level security's
  refusal are one code, `forbidden`), `errText` (v2 `i18n.ts`) says it (`refused`, and `resync` makes a form read its
  row again).
- **Ways out ask first**: signing out or switching place with a change that did not save, and leaving a group form or a
  section sheet with changes (its back link or close, Escape, the bottom bar, the brand, the account sheet, and the
  browser's Back, Forward or a typed address: `leave.ts`, which puts the address back on `popstate` before the router
  hears of it).
- **The session ending by itself** (a 401 during a save) signs out and says so on the start screen, naming the rows
  whose latest changes may not be saved (`sessionEnded`): those in the save queue, and the forms holding changes not
  sent yet (a group form, a section sheet: `formHolds`).
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
(`{ key, icon, label, order, dot?, shown? }`) puts it in the bottom bar in `order` (home 10, menu 20, add-ons 30, hours 40,
rules 50, activity 80, publish 90), for every account unless `shown()` says otherwise (activity: not for a counter); past five
tabs the fifth becomes "More" with the rest in a sheet, so no lane has to fight for room. `landing(venue?)` is where a place
opens and where an address that leads nowhere goes: Home once the place has published, else the setup flow
(`onboarding`, which opens at the step its owner left off; an account that does not edit is taken on to the menu). It is
used after `create_venue` (`landing(null)`), after
switching place (`landing(<the place being opened>)`), and by the shell for an unknown address; a reload keeps the
address it was on. A screen without `nav` is reachable by address only.

The "today" column says what exists on this branch; the "to do" column is the lane's own work.

| Lane | Screens (to do) | Data (to do) | Today |
|---|---|---|---|
| **F03 onboarding and import** (built) | `onboarding` (no nav; `onboarding/<step>`, `onboarding/menu/<source>`, `onboarding/review/<import>`, `onboarding/done`); `landing()` returns it until the first publish; `help/<topic>` opens help on a topic | `onboarding_progress`, `menu_imports` in `data/onboarding.ts` (with `onReset`); the import applied by the database in one transaction (`apply_import`, ADR-006), never table by table; an imported group's guessed limits confirmed through `saveGroupForm(…, { confirmLimits })` | the flow reuses the app's screens (menu, group editor, hours, help, publish, the dish's guest preview) and the shell offers the way back (`BackToSetup`, through the leave guard); Home's nudges open `onboarding/<step>` and `onboarding/review` |
| **F05 availability, schedules, hours** (built) | `hours` (nav, order 40; `hours/parts`, `hours/parts/<id>`); the availability sheet at `menu/a/<section\|dish\|option\|group>/<id>` (an add-on choice or group opened from a dish's sheet: `.../<id>/<dish id>`, so the focus returns to the dish's button) | `schedules`, `venue_hours`, `venue_closures` in `MenuTable`; overrides in `data/live.ts` | a counter operates (`canOperate()`) and sees the rest read-only; `runtime.realtime` is false locally (polling instead) |
| **F06 upsell rules** (built) | `rules` (nav, order 50; `rules/<id>`, `rules/new`) | `upsell_rules` in `MenuTable` | publishing lists the builder's `rule_left_out` warnings and `lintSnapshotV2`'s, in words (`issue.*` in `i18n.ts`); the group editor asks before deleting a choice a rule suggests, and the rule leaves the list with it |
| **F08 dashboard, activity, export; F03's "get help"** (built) | `home` (nav, order 10; `landing()` returns it once the place has published), `activity` (nav, order 80; not for a counter: `NavItem.shown`), `help` (no nav; the shell's help button) | `my_dashboard` in `data/dashboard-live.ts`, `venue_activity`, `export_menu`, `open_case` in `data/records.ts` | `nudgeHref` opens `onboarding/<step>` as soon as that screen exists, and the screens that exist until then; the dashboard's `nudges` already carry `import_waiting` for the import preview |

**Words.** New keys go in `i18n.ts` (a key lives in one dictionary; `node test/check-i18n.mjs` checks both). New Hebrew
needs a native read before it reaches anyone.

**Tests.** Pure modules under `data/` import nothing from the browser, so `test/unit/v2-*.test.mjs` runs them in Node as
they are. Browser tests live in `e2e/` (`startE2E()` serves the built `_site` with a local config: schema 2 on the
simulator's stack): `e2e/studio-v2.test.mjs` is the whole scenario (the pattern), `e2e/studio-v2-edges.test.mjs` the
edges (production boot, price parity with `public_menu`, two tabs, lost answers, offline, a counter, sign-up, RTL,
keyboard, names, text never HTML), `e2e/studio-v2-saving.test.mjs` saving on a slow, failing or forgetful network
(two edits in flight, answers lost, late or never, retries, roles that change, the session ending, the ways out),
`e2e/studio-v2-operate.test.mjs` the operating screens (suggestion rules, hours and day parts, the availability quick
actions, and a counter: operates, edits nothing), `e2e/studio-v2-dashboard.test.mjs` Home, the activity log, getting
help, the export and approval, and `e2e/studio-v2-onboarding.test.mjs` the setup flow (the whole path in Hebrew and
English, timed; resuming on another device; re-importing without duplicates; leaving things out; an apply read again;
help; another place's import; the scanner through `e2e/scan-stub.mjs`, the real handler with a recorded reply and
nothing paid; a counter).

## Not here yet

Pictures and reliefs on v2 dishes (the dish has no picture slot yet, so the "no photo" nudge opens the dish, and the
flow's photo step can only be left for later), the place's style and contact settings (the flow's style step says what
the place has: its languages), team members, the "pause ordering now" switch (with ordering, phase 2), a note on an
availability override (the RPC takes one; the sheet does not ask yet), the owner's answers in an import preview kept
anywhere but on this device until applying (no column holds them; a price typed in place is stored with the draft),
illustrations proposed by the scanner (the app sends it no list of stock pictures yet), the real guest page as the
flow's phone test (backlog B11: `?preview=1` takes v1 only), and everything listed above for the next lanes.
