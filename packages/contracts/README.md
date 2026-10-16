# @mana/contracts

The types, validators and pure functions that every Mana app (guest menu, client app, back office), the simulator and
the database agree on. No runtime dependencies. Node 22.18+ runs the `.ts` files as they are (type stripping), and
bundlers (esbuild, Vite) import them directly, so there is no build step.

| File | What |
|---|---|
| `src/common.ts` | Shared checks, among them the one definition of a **blank** character (`BLANK_CLASS`, `isBlank`, `stripBlank`): Unicode spaces, controls like tab and newline, NBSP, BOM, soft hyphen, zero-width and direction marks, variation selectors, tags, and the fillers that draw nothing. Stripping keeps the variation selectors and tags that finish an emoji at the end of a name. The database's `app.strip_blank` uses the same class and rule (compared code point by code point, and on sample strings, in `supabase/tests`). |
| `src/enums.ts` | Every closed list of words (venue kinds and modes, roles, triggers, onboarding steps, import sources…) and the size limits. The database's check constraints use the same lists (compared in `supabase/tests`). |
| `src/domain.ts` | One row type per table of the clean schema, column for column, plus `TABLE_COLUMNS` (compared with the database). |
| `src/snapshot.ts` | The published menu **snapshot v2**: everything the guest menu needs. Readers ignore fields they do not know. |
| `src/validate-snapshot.ts` | `validateSnapshotV2(raw) → {ok, value} \| {ok:false, errors}` (what stops a publish) and `lintSnapshotV2(snapshot) → issues` (warnings only: a rule that suggests its own trigger, an add-on suggestion no dish in scope offers). The database's `app.validate_snapshot` and `app.lint_snapshot` use the same codes. |
| `src/live.ts` | The live overlay `public_menu` sends beside the snapshot: what is off now, the hours, open or closed. |
| `src/time.ts` | Wall-clock time in Asia/Jerusalem: hours past midnight, closed days, day parts, "until opening tomorrow", DST. |
| `src/availability.ts` | `isAvailable(target, overrides, schedule, hours, now)` and `menuAvailability(snapshot, live, now)`. |
| `src/pricing.ts` | `priceDish(dish, selection, ctx)` (integer agorot, VAT included and extracted), `fromPrice(dish, ctx)` ("from ₪…"), `defaultSelection`. |
| `src/upsell.ts` | `matchSuggestion(rules, context)`: at most one suggestion, never in the basket, sold out or filtered out; priority, caps, dismissals. |
| `src/events.ts` | The first-party events contract: names, props, `validateEvent`, `validateBatch`, `rollupKeys`. No personal field can be typed or sent. |
| `test/fixtures.ts` | "Café Demo", a synthetic menu (invented) whose ids match `supabase/seed/synthetic.sql`. |

```bash
cd packages/contracts
npm test          # node --test test/*.test.ts
npm run check     # tsc (strict), after npm install
```

Changing a contract: open the PR with the architect seat as reviewer. A change that a reader of the current snapshot
would misread is a new snapshot version, never an edit of `v: 2`.
