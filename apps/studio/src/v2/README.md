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
| `screens/` | start, new place, menu, dish (details, add-ons with the guest preview, goes well with), add-on library and group editor, publish |

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
  screen does the same in three steps (all in `ui.tsx`, as `screens/dish.tsx` and `screens/addons.tsx` do):
  1. wrap the editing area in `<ReadOnly when={!editable}>` (one fieldset: everything inside is disabled at once);
  2. put `disabled={!editable}` on each control too (`MoneyInput`, `Stepper`, `Seg`, `Switch` and the inputs take it), and
     do not render the buttons that only edit (save, delete, add, arrange);
  3. `useEditOnly(onEditAddress, editable, back)` for an address that only edits (`#/menu/s/…`, `#/addons/new`).
  A store's writes start with `mayWrite()` (or go through `patchRow`, `write`), so the network is never asked; a write
  row-level security refuses anyway (a role changed meanwhile) is "not allowed", and the role is read again.
  Sold-out actions are a counter's own (F05): those check the role themselves.
- **One place at a time**: switching place or account drops everything (what failed to save included, after the owner
  confirms it); late answers for the old one are ignored. A store of a later lane registers `onReset(fn)` to drop its own
  state with it.

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
| **F05 availability, schedules, hours** | `hours`, `schedules` (nav, order 40); sold-out quick actions | `venue_hours`, `venue_closures`, `schedules`, `availability_overrides` added to `MenuTable` and `KEY` in `data/store.ts` (a table with `updated_at` then gets the guarded `patchRow`); schedules are already loaded | the dish's day-part select reads `menu.schedules`; a counter (`role === 'counter'`) sees every screen read-only (`canEdit()`, `ReadOnly`): sold-out actions are the first thing a counter may do, so they check `role` themselves; `runtime.realtime` is false locally (poll instead) |
| **F06 upsell rules** | `rules` (nav, order 50) | `upsell_rules` into `MenuTable` (today the store reads rules only to name them when deleting a choice they use, `api.rulesNamed`) | publishing lists the builder's `rule_left_out` warnings and `lintSnapshotV2`'s, in words (`issue.*` in `i18n.ts`); the group editor asks before deleting a choice a rule suggests |
| **F08 dashboard, activity, export** | `home` (nav, order 10; make `landing()` return it), `activity`, export | `my_dashboard`, `activity_log` in `data/dashboard.ts`; the export reads `draft.value.snapshot` | the publish dot (`hasChanges`) and `standingOf()` say where the menu stands |

**Words.** New keys go in `i18n.ts` (a key lives in one dictionary; `node test/check-i18n.mjs` checks both). New Hebrew
needs a native read before it reaches anyone.

**Tests.** Pure modules under `data/` import nothing from the browser, so `test/unit/v2-*.test.mjs` runs them in Node as
they are. Browser tests live in `e2e/` (`startE2E()` serves the built `_site` with a local config: schema 2 on the
simulator's stack): `e2e/studio-v2.test.mjs` is the whole scenario (the pattern), `e2e/studio-v2-edges.test.mjs` the
edges (production boot, price parity with `public_menu`, two tabs, lost answers, offline, a counter, sign-up, RTL,
keyboard, names, text never HTML).

## Not here yet

Pictures and reliefs on v2 dishes (the dish has no picture slot yet), the place's style and contact settings, team
members, and everything listed above for the next lanes.
