# The owner app on the clean schema (v2)

`src/main.tsx` boots this app when `window.HALOM_MENUS_CONFIG.schema === 2` (the demo database `mana`, the local
simulator stack); it is loaded as a chunk of its own, so production (`schema` absent or 1, the `halom-studio` project)
downloads none of it and runs the v1 app exactly as before. The cutover (ADR-005) deletes v1's schema-specific files and
makes this the app.

## What is here

| Path | What |
|---|---|
| `main.tsx`, `app.tsx` | Boot; who is signed in decides the first screen (start, a new place, the shell); the shell: top bar (the place, saving, the account), the screen, the bottom bar (a rail on a wide screen) |
| `routes.tsx` | Every screen in the shell by address (`#/<path>/…`) and the phone navigation built from them |
| `i18n.ts` | v2's words (Hebrew, English); `t()` falls back to v1's dictionary, `errText(code)` says a code in plain words |
| `ui.tsx`, `format.ts`, `v2.css` | v2's own small pieces (reorder by drag and keyboard, stepper, price, tabs, language switch) and styles |
| `data/client.ts` | The supabase-js client and sign-in shared with v1 (`lib/api.ts`), `q()` and `rpc()` (an RPC's `{ok:false, code}` is thrown), the config's `env`, `schema`, `realtime` |
| `data/errors.ts` | Every failure as one code (`V2Error`): the schema's raised words (`nesting_too_deep`, `limits_loosened`, `limit_*` …), PostgREST and Auth codes |
| `data/menu.ts` | The tables and RPCs, stateless, typed with `@mana/contracts`' row types; direct table access under RLS (as `sim/src/owner.mjs`) |
| `data/store.ts` | The state: session, places, the open place's whole menu (the draft), saving (autosave per row, writes that put the stored rows on screen) |
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
- **A refusal is a code, said in plain words**: `toV2Error` maps it, `errText` (v2 `i18n.ts`) says it. A refused
  autosave shows the stored row again (`refused`); a network failure keeps what was typed and offers to retry.
- **Prices are agorot**, typed in shekels (`agorotOf`, `shekelsOf`), never floats.
- **The UI never offers what the schema refuses**: tighter dish limits only (`limitChoices`), one nesting level only
  (`openTargets`), and the form's rules before a write (`groupFromForm`). When another device changed the library in the
  meantime, the database's refusal is shown and the library reloads.
- **One place at a time**: switching place or account drops everything; late answers for the old one are ignored.
  A store of a later lane registers `onReset(fn)` to drop its own state with it.

## How the next lanes plug in

**Routes and navigation.** Add an entry to `SCREENS` in `routes.tsx`: `{ path, render(rest), nav? }`. A `nav`
(`{ key, icon, label, order, dot? }`) puts it in the bottom bar in `order` (menu 20, add-ons 30, publish 90); past five
tabs the fifth becomes "More" with the rest in a sheet, so no lane has to fight for room. `landing()` is where a place
opens (today the menu). A screen without `nav` is reachable by address only.

| Lane | Screens | Data | Hooks already here |
|---|---|---|---|
| **F03 onboarding and import** | `onboarding/<step>` (no nav); the import preview with its exceptions | `onboarding_progress`, `menu_imports` in a new `data/onboarding.ts` (with `onReset`); imported dishes through `addDish`, imported option groups through `saveGroupForm` (so the form rules and the nesting guard apply) | `landing()` returns `onboarding` while steps are open; the empty menu's `Empty` in `screens/menu.tsx` is where "bring your menu" goes; `venue-new.tsx` already goes to `landing()`'s screen after `create_venue` |
| **F05 availability, schedules, hours** | `hours`, `schedules` (nav, order 40); sold-out quick actions | `venue_hours`, `venue_closures`, `schedules`, `availability_overrides` added to `MenuTable` and `KEY` in `data/store.ts` (schedules are already loaded) | the dish's day-part select reads `menu.schedules`; a counter (`role === 'counter'`) already sees the menu read-only; `runtime.realtime` is false locally (poll instead) |
| **F06 upsell rules** | `rules` (nav, order 50) | `upsell_rules` into `MenuTable` | publishing already lists the builder's `rule_left_out` warnings and `lintSnapshotV2`'s, in words (`issue.*` in `i18n.ts`) |
| **F08 dashboard, activity, export** | `home` (nav, order 10; `landing()` returns it), `activity`, export | `my_dashboard`, `activity_log` in `data/dashboard.ts`; the export reads `draft.value.snapshot` | the publish dot (`hasChanges`) and `standingOf()` say where the menu stands |

**Words.** New keys go in `i18n.ts` (a key lives in one dictionary; `node test/check-i18n.mjs` checks both). New Hebrew
needs a native read before it reaches anyone.

**Tests.** Pure modules under `data/` import nothing from the browser, so `test/unit/v2-*.test.mjs` runs them in Node as
they are. Browser tests live in `e2e/` (`startE2E()` serves the built `_site` with a local config: schema 2 on the
simulator's stack); `e2e/studio-v2.test.mjs` is the pattern.

## Not here yet

Pictures and reliefs on v2 dishes (the dish has no picture slot yet), the place's style and contact settings, team
members, and everything listed above for the next lanes.
