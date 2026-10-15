# supabase/: Mana's clean schema

The schema of the Supabase project **`mana`** (the build and demo database, D35), designed from what `db/0001`–`0007`
taught rather than replayed from them. halom.io/mana keeps running on `halom-studio` with the old schema until a planned
cutover; nothing here touches it.

| Path | What |
|---|---|
| `migrations/` | Seven migrations, applied in name order (below) |
| `seed/synthetic.sql` | "Café Demo", a **synthetic** demo venue (invented names and prices). Its ids match `packages/contracts/test/fixtures.ts` |
| `tests/` | Database tests on a throwaway local PostgreSQL 16: every RLS rule, every RPC, the contracts parity, the phase-1 scenario |
| `tests/harness/` | The cluster runner, the **local-only** auth stub, the shared test world |

No real venue's data belongs here: the mock client's menu and anything from Wolt live only in the private demo seeds outside git.

## Run the tests

```bash
cd supabase
npm install            # pg (the only dependency)
npm test               # node --test --test-concurrency=1 tests/*.test.mjs
npm run migrate:local  # applies the stub, the migrations and the seed once, prints what exists
```

The runner starts PostgreSQL 16 from `/usr/lib/postgresql/16/bin` (`PGBIN` to change it) in a temporary folder on a free
port, installs `tests/harness/auth-stub.sql` (the `anon`, `authenticated` and `service_role` roles, `auth.users`,
`auth.uid()` reading the same `request.jwt.claims` setting PostgREST sets, the storage tables and the realtime
publication), applies every migration, seeds Café Demo, and removes the cluster afterwards. When run as root,
PostgreSQL runs as the OS user `STACK_OS_USER` (default `claude`), as `studio/test/stack/start.mjs` does. Each call in a
test runs the way PostgREST runs it: one transaction, `set role`, the JWT claims set. The contracts' TypeScript is
imported directly (Node 22.6+ strips types). Nothing calls a remote database.

## Applying the migrations to `mana`

**The orchestrator applies them, after review, through the Supabase MCP** (`apply_migration`, one file at a time, in
name order, with the file name as the migration name). No build seat touches a remote database. Then, once:

```sql
-- the public storage address for this environment (ends with "/")
update public.app_config set value = to_jsonb('https://<project-ref>.supabase.co/storage/v1/object/public/menu-public/'::text)
where key = 'public_base';
-- the synthetic demo venue (optional): run seed/synthetic.sql
```

Then run the Supabase advisors (security and performance) and check `cron.job` holds the two jobs.

| Migration | What |
|---|---|
| `…120000_foundation` | `app` schema, settings, venues, members, staff and invites, entitlements, the role helpers |
| `…120100_menu` | schedules, sections, dishes, assets, add-on groups and options (one nesting level), dish groups, "goes well with", upsell rules, hours, closures, venue-local time, availability overrides, revisions |
| `…120200_operations` | onboarding progress, menu imports, support cases, the append-only activity log and its audit triggers, leads |
| `…120300_events` | the events contract as data, partitioned `events`, dedupe, the rollup queue, minute and day rollups, partitions, the rollup job |
| `…120400_publish_and_rpc` | the snapshot v2 builder and validator, `app.publish`, every phase-1 RPC |
| `…120500_access` | **every grant and RLS policy**, storage buckets and policies, realtime |
| `…120600_jobs` | pg_cron: rollups every minute, partitions daily (skipped where pg_cron is absent) |

A later migration adds its own grants and policies at its end, in the same style, and the tests' "nothing else is
executable" and "RLS on everywhere" checks keep it honest.

## The RLS model

Every table has RLS on. `anon` has no table privilege at all. Policies call helpers in the `app` schema (not exposed by
the API), each `SECURITY DEFINER` with `search_path = ''`:

| Who | Reads | Writes |
|---|---|---|
| guest (`anon`) | nothing; `public_menu(slug)` returns the published snapshot plus the live overlay | `track_events` (guest events only), `submit_lead` |
| owner | everything of their venues | menu, hours, availability, settings, team, imports, cases, publish; the support switch (owner only) |
| manager | like the owner | like the owner, except the team and the support switch |
| counter | the menu of their venue | availability overrides only (take off, restore); never a price |
| Halom support / admin | every venue, every record | **only** through `act_for_owner(venue, reason, action, payload)` |
| service role (edge functions) | bypasses RLS | the scanner writes parsed imports; append-only and same-venue triggers still hold |

Structural guarantees beside the policies: composite foreign keys `(venue_id, id)` so no row points into another venue;
the slug is permanent; `activity_log` and `menu_revisions` refuse UPDATE, DELETE and TRUNCATE (even for the database
owner); availability overrides can only be restored, never edited or deleted; venues with history cannot be deleted
(records `RESTRICT`), they are archived.

**Act for owner (D25).** Staff never write directly. `act_for_owner` checks the caller is staff, needs a reason
(3–500 characters), honours the owner's `support_can_act` switch, allows six actions (`availability.set`,
`availability.restore`, `dish.update` with a column allow-list, `menu.publish`, `onboarding.set`, `support_case.update`),
marks the transaction so every audit row the action causes reads `via = act_for_owner` with the reason, and writes its
own `support.act_for_owner` row, all in one transaction (a failed action leaves nothing). The marker counts only for
staff: an owner who sets it is still logged as the owner. The owner sees every row in `activity_log` and in
`my_dashboard().activity`.

**The activity log.** Statement-level audit triggers on every content table write one row per venue per statement
(`n` rows affected; a one-row change carries its short scalar fields, old and new), so a 200-dish import is one entry.
Free text people typed (bodies, notes, raw imports, lead contacts) never enters the log.

## Events and rollups

`track_events(batch)` takes 1–50 guest events (`packages/contracts/src/events.ts`): unknown or personal fields are
refused per event, ids must belong to the venue, the venue must be published, the same id is stored once (also across
batches), and a per-source hourly cap and a per-venue daily cap stop scripted inflation (the source is a salted hash
that changes daily and is never stored with an event). Server events (`menu_published`, `onboarding_step_done`,
`import_parsed`) are emitted by the database itself. Raw events sit in `public.events`, partitioned by month in schema
`app`, readable by nobody through the API. `app.build_rollups()` drains a queue into `rollups_minute` (UTC minute, kept
35 days) and `rollups_day` (the venue's local date), so a late event is counted exactly once. Demo venues' events are
flagged and left out of real totals. The dashboards read `my_dashboard` and `ops_overview` and subscribe to the rollup
tables through Realtime (RLS applies).

**Retention is not scheduled:** `app.drop_event_partitions_before(date)` exists; the period (`app_config.event_retention_months`,
13 by default) is a decision for Daniel and the lawyer.

## RPCs

| RPC | Who | Does |
|---|---|---|
| `public_menu(p_slug)` | anyone | `{state:'ok', snapshot, live}` · `{state:'unavailable', venue:{name}}` · `{state:'not_found'}` |
| `track_events(p_events)` | anyone | `{ok, accepted, duplicates, capped, rejected:[{index, code}]}` |
| `submit_lead(…)` | anyone | Mana's own "talk to us" form; `{ok, ref}`; same token, same ref |
| `slug_available(p_slug)`, `create_venue(p_slug, p_name_he, p_name_en, p_kind, p_default_lang)` | signed in | the venue, its owner, a pending trial, nine onboarding steps |
| `preview_menu(p_venue)` | owner, manager, staff | `{snapshot, issues}`: what a publish would produce, and what would stop it |
| `publish_menu(p_venue, p_note)` | owner, manager | builds snapshot v2, validates it with the contracts' codes, stores revision n+1, returns `{ok, revision, slug, path:'/m/<slug>'}` |
| `my_dashboard(p_venue, p_range)` | owner, manager, staff | from the rollups: totals, opens by source and language, days, last hour, top dishes, rule numbers, off now, onboarding, activity |
| `redeem_staff_invite(p_code)` | signed in | an invite code (stored as a SHA-256 hash, expires in 7 days) makes the caller staff |
| `ops_overview()` | staff | every venue: onboarding stage and blockers, last publish, opens today / 7 days / last hour, suggestions, open cases, warnings, plan |
| `act_for_owner(p_venue, p_reason, p_action, p_payload)` | staff | the only staff write path (above) |

**Later (not in phase 1):** team invitations (invite, accept) and member management RPCs; `restore_revision` and
`unpublish_menu`; `apply_import` (one call from parsed draft to rows, idempotent on the input hash); staff plan
switching (`ops_set_entitlement`) and leads views; export of a venue's data; availability "restore everything today"
as one RPC (today the client app updates the rows); the edge function for the scanner's Wolt modes.

## How ordering, payment and fiscal tables will attach (phases 2–3)

Not designed here; this is where they plug in:

- **Mode gate.** `venues.mode = 'standalone'` turns ordering on; `view_only` venues have no order rows at all.
- **Orders** reference `menu_revisions (venue_id, id)`: the server prices every line with `priceDish` from the
  revision the guest saw plus the live overlay (`menuAvailability`), never from client numbers. `order_lines` freeze
  name, unit price, chosen options (the `DishSelection` tree) and the revision, each with an idempotency key.
- **Append-only logs** like `activity_log`: `order_events`, `payment_events` (unique provider event id), fiscal
  documents; `ON DELETE RESTRICT` from venues and revisions; retention set by the accountant.
- **State machines** with an explicit `unknown`, guarded by triggers as `payments/` does today; reconciliation jobs
  beside `app.build_rollups` in `…_jobs`.
- **Events.** The reserved names (`checkout_started`, `payment_confirmed`, `print_queued`, …) become server events
  emitted by those tables' triggers; no client sends them. Still no personal field: the order page's token never
  enters an event.
- **Roles.** The counter role gains order actions through RPCs (mark ready, collected), still no prices or refunds;
  `act_for_owner` gains order actions with the same reason rule.
