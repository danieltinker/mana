# @mana/contracts

The types, validators and pure functions that every Mana app (guest menu, client app, back office), the simulator and
the database agree on. No runtime dependencies. Node 22.18+ runs the `.ts` files as they are (type stripping), and
bundlers (esbuild, Vite) import them directly, so there is no build step.

| File | What |
|---|---|
| `src/common.ts` | Shared checks, among them the one definition of a **blank** character (`BLANK_CLASS`, `isBlank`, `stripBlank`): Unicode spaces, controls like tab and newline, NBSP, BOM, soft hyphen, zero-width and direction marks, variation selectors, tags, and the fillers that draw nothing. Stripping keeps the variation selectors and tags that finish an emoji at the end of a name. The database's `app.strip_blank` uses the same class and rule (compared code point by code point, and on sample strings, in `supabase/tests`). `textLength` counts code points, as `char_length` does: every length limit in the contracts is measured this way. `isStorableText` refuses NUL and lone surrogates. |
| `src/enums.ts` | Every closed list of words (venue kinds and modes, roles, triggers, onboarding steps, import sources…) and the size limits. The database's check constraints use the same lists (compared in `supabase/tests`). |
| `src/domain.ts` | One row type per table of the clean schema, column for column, plus `TABLE_COLUMNS` (compared with the database). |
| `src/snapshot.ts` | The published menu **snapshot v2**: everything the guest menu needs. Readers ignore fields they do not know. |
| `src/validate-snapshot.ts` | `validateSnapshotV2(raw) → {ok, value} \| {ok:false, errors}` (what stops a publish) and `lintSnapshotV2(snapshot) → issues` (warnings only: a rule that suggests its own trigger, an add-on suggestion no dish in scope offers). The database's `app.validate_snapshot` and `app.lint_snapshot` use the same codes. |
| `src/live.ts` | The live overlay `public_menu` sends beside the snapshot: what is off now, the hours, open or closed. |
| `src/time.ts` | Wall-clock time in Asia/Jerusalem: hours past midnight, closed days, day parts, "until opening tomorrow", DST; `resolveUntil` (a duration ends on a whole minute) and `isUntilSpec`. |
| `src/availability.ts` | `isAvailable(target, overrides, schedule, hours, now)` and `menuAvailability(snapshot, live, now)`; the inputs of `set_availability` and `restore_today`. |
| `src/pricing.ts` | `priceDish(dish, selection, ctx)` (integer agorot, VAT included and extracted), `fromPrice(dish, ctx)` ("from ₪…"), `defaultSelection`. |
| `src/upsell.ts` | `matchSuggestion(rules, context)`: at most one suggestion, never in the basket, sold out or filtered out; priority, caps, dismissals. |
| `src/events.ts` | The first-party events contract: names, props, `validateEvent`, `validateBatch`, `rollupKeys`, `TrackEventsReply`. No personal field can be typed or sent. |
| `src/rpc.ts` | What every phase-1 RPC answers (`{ok: true, …} \| {ok: false, code}`) and the checks their inputs share (a staff reason is 3–500 characters). |
| `src/config.ts` | `configFlags(window.HALOM_MENUS_CONFIG)`: `env`, `schema`, `realtime`, with the defaults for what is absent (ADR-007). |
| `src/import.ts` | The menu import (ADR-006): `ImportDraft` v1 (what every reader produces), `validateDraft`, `importKey` (when two names are "the same"), `draftExceptions` (what the owner fixes or checks), `ImportDecisions`, `planApply` (create, update or keep, never a delete; Hopa test 1), and the import RPCs' inputs. The database's `app.validate_import_draft`, `app.import_key`, `app.import_exceptions` and `app.plan_import` follow the same rules. |
| `src/onboarding.ts` | The steps the database marks done itself, `onboardingProgress`, the input of `set_onboarding_step`. |
| `src/activity.ts` | `ActivityEntry` (the log as the owner reads it), the closed list of actions, `venue_activity`'s query. |
| `src/dashboard.ts` | `ClientDashboard` (`my_dashboard` v2): today at a glance, what is off and until when, nudges, rules, progress; `LIVE_REFRESH` and `pollDelay` (Realtime or polling). |
| `src/support.ts` | `SupportCase`, `open_case` ("get help") and `ops_update_case` inputs. |
| `src/ops.ts` | The back office: `OpsVenueRow` and its warnings, `OpsVenueDetail`, `OpsAnalytics`, `OpsRevision` (a stored revision, read by staff and logged), their queries, `ops_set_demo`. |
| `src/export.ts` | `MenuExport`: the owner's menu as JSON (`export_menu`). |
| `src/staff.ts` | Halom staff's writes and personal-data reads: `act_for_owner` (one payload per action), `ops_approve_venue`, `ops_set_plan`, `ops_leads`, `ops_update_lead`, each with a validator. |
| `test/fixtures.ts` | "Café Demo", a synthetic menu (invented) whose ids match `supabase/seed/synthetic.sql`. |
| `test/import-fixtures.ts` | "Bistro Draft", a synthetic import draft (invented), and an in-memory executor of an import plan. |

```bash
cd packages/contracts
npm test          # node --test test/*.test.ts
npm run check     # tsc (strict), after npm install
```

Changing a contract: open the PR with the architect seat as reviewer. A change that a reader of the current snapshot
would misread is a new snapshot version, never an edit of `v: 2`.
