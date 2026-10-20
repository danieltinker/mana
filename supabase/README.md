# supabase/: Mana's clean schema

The schema of the Supabase project **`mana`** (the build and demo database, D35), designed from what `db/0001`–`0007`
taught rather than replayed from them. halom.io/mana keeps running on `halom-studio` with the old schema until a planned
cutover; nothing here touches it.

| Path | What |
|---|---|
| `migrations/` | Nine migrations, applied in name order (below) |
| `seed/synthetic.sql` | "Café Demo", a **synthetic** demo venue (invented names and prices). Its ids match `packages/contracts/test/fixtures.ts` |
| `tests/` | Database tests on a throwaway local PostgreSQL 16: every RLS rule, every RPC by role and error code, the contracts parity (`twins.test.mjs`: each SQL twin against its contract on the same inputs), the review items, the scenarios |
| `tests/harness/` | The cluster runner, the **local-only** auth stub, the shared test world |

No real venue's data belongs here: the mock client's menu and anything from Wolt live only in the private demo seeds
outside git.

## Run the tests

```bash
npm ci                 # at the repository root (supabase/ is a workspace; pg is its only dependency)
cd supabase
npm test               # node --test --test-concurrency=1 tests/*.test.mjs
npm run migrate:local  # applies the stub, the migrations and the seed once, prints what exists
```

The runner starts PostgreSQL 16 from `/usr/lib/postgresql/16/bin` (`PGBIN` to change it) in a temporary folder on a free
port, installs `tests/harness/auth-stub.sql` (the `anon`, `authenticated` and `service_role` roles, `auth.users` with
`email_confirmed_at`, `auth.uid()` and `auth.jwt()` reading the same `request.jwt.claims` setting PostgREST sets, the
storage tables and the realtime publication), applies every migration, seeds Café Demo, and removes the cluster
afterwards. When run as root, PostgreSQL runs as the OS user `STACK_OS_USER` (default `claude`), as
`apps/studio/test/stack/start.mjs` does. Each call in a test runs the way PostgREST runs it: one transaction, `set role`,
the JWT claims set (with `aal`). The contracts' TypeScript is imported directly (Node 22.18+ strips types). Nothing calls
a remote database.

## Applying the migrations to `mana`

**The orchestrator applies them, after review, through the Supabase MCP** (`apply_migration`, one file at a time, in
name order, with the file name as the migration name). No build seat touches a remote database.

| Migration | State on `mana` | What |
|---|---|---|
| `20261015120000_foundation` | **applied; never edited again** | `app` schema, settings, venues, members, staff and invites, entitlements, the role helpers |
| `20261015120050_foundation_review` | **applied; never edited again** | every change to the foundation's objects after the 15 Oct reviews: one "blank", the request source and its daily salt, new settings, invites bound to an e-mail, MFA for staff, approval columns, picture paths |
| `20261015120100_menu` | **applied; never edited again** | schedules, sections, dishes, assets, add-on groups and options (one nesting level), dish groups, "goes well with", upsell rules, hours, closures, venue-local time, availability overrides, revisions |
| `20261015120200_operations` | **applied; never edited again** | onboarding progress, menu imports, support cases, the append-only activity log and its audit triggers, leads |
| `20261015120300_events` | **applied; never edited again** | the events contract as data, partitioned `events`, dedupe, the rollup queue, minute and day rollups, partitions, capped days, the rollup job |
| `20261015120400_publish_and_rpc` | **applied; never edited again** | the snapshot v2 builder, validator and lint, `app.publish`, the phase-0 RPCs |
| `20261015120500_access` | **applied; never edited again** | **every grant and RLS policy**, storage buckets and policies, realtime, `app.audit_grants()` |
| `20261015120600_jobs` | **applied; never edited again** | pg_cron: rollups every minute, partitions daily, the daily maintenance (retention, salts, lead hashes) |
| `20261016120000_phase1` | new | phase 1 (ADR-008): the import end to end (create, claim with image caps, save the reader's draft and notes, plan, apply, discard, purge; each image in its import's own folder), the importer's SQL twins (`app.import_key`, `app.validate_import_draft`, `app.import_exceptions`, `app.plan_import`), `addon_groups.limits_confirmed`, `venue_hours.updated_at` and no overlapping hours, the onboarding steps the database marks itself, the support, availability, export, activity, dashboard v2 and back-office RPCs, `save_addon_group`, the staff writes after review (reasons, versions, the approved revision), the SQL twins of the contracts' validators, an index on every foreign key, every grant again and the new intended list (below) |

Every change to an applied migration's objects lives in a later file, as `create or replace` and `alter` statements.

After each apply:

```sql
select * from app.audit_grants();             -- no rows: the grants are exactly the intended access model
select * from app.unindexed_foreign_keys();   -- no rows: every foreign key has an index that starts with its columns
```

### `20261016120000_phase1` on `mana`

Apply it like the others (the Supabase MCP's `apply_migration`, name `20261016120000_phase1`), after review. Nothing in
it deletes a row. **First run the three checks below on `mana`**: two of the new table checks are validated against
every existing row, and the migration stops if a row fails them.

```sql
-- 1. every image of an import lies in that import's own folder (menu_imports_paths_ck): no rows
select id, venue_id, raw_paths from public.menu_imports
where exists (select 1 from unnest(raw_paths) p
              where p !~ ('^' || venue_id::text || '/imports/' || id::text || '/[A-Za-z0-9._-]{1,100}$') or p ~ '/[.]{1,2}$');
-- 2. every stored draft within the new measure (menu_imports_parsed_ck, 1 500 000 bytes of its text form): no rows
select id from public.menu_imports where parsed is not null and octet_length(parsed::text) > 1500000;
-- 3. opening windows that already overlap (not refused by the migration, but their next edit is): ideally no rows
select a.id, b.id from public.venue_hours a join public.venue_hours b on a.venue_id = b.venue_id and a.id < b.id
cross join lateral app.hours_span(a.weekday, a.opens, a.closes) x cross join lateral app.hours_span(b.weekday, b.opens, b.closes) y
cross join unnest(array[-10080, 0, 10080]) k(shift)
where x.s < y.e + k.shift and y.s + k.shift < x.e;   -- (run 3 after the migration: it uses app.hours_span)
```

A row that fails check 1 is an import whose screenshots sit elsewhere: purge its raw input first (`raw_paths = '{}'`,
`raw_purged_at = now()`), which keeps the row and its draft. The statements Supabase's tooling may flag as destructive
are marked `-- DESTRUCTIVE-LOOKING:` in the file, each with what it does:

- `menu_imports`: its two unnamed source checks are dropped and added back as three named checks that also accept a
  purged row (`raw_purged_at`). Every existing row passes them.
- `menu_imports`: the size check on `parsed` (`pg_column_size` below 400 000) is dropped and added back on the
  contracts' measure (`octet_length(parsed::text)`, at most 1 500 000), and the paths check (at most 20) at 24 (Wolt
  screenshots; a scan at most 8, by `create_import`). Check 2 above.
- `drop function public.ops_approve_venue(uuid, text)`: replaced by the three-argument version (the revision reviewed),
  granted again in the same file.
- `support_cases`: the column INSERT of `authenticated` is revoked and the policy `cases_open` dropped; cases are made
  only through `open_case` (its daily cap, its client id), as imports through their RPCs. No rows change.
- `menu_imports`: the client policies `imports_add` and `imports_change` are dropped; clients now write imports only
  through the RPCs. The table's privileges are revoked from `authenticated` and given back as a column list without
  `raw_text`, and revoked from `service_role` and given back as an UPDATE on four columns.
- `revoke execute on all functions … from public, anon, authenticated`, in `public` and `app`, followed by the grants
  by name. Every function an API role uses is granted again in the same file, and `app.audit_grants()` checks the list.
- The daily job's new purge empties `raw_text` of finished imports (applied, discarded, failed), and of imports left
  uploaded or parsed, older than `import_raw_retention_days`. This happens when the job runs, not when the migration is
  applied, and the row, its hash and its draft stay. Screenshots are the scanner's to delete: `list_purgeable_imports`
  names them (service role only), and the guard lets the purge through only for an import that may be purged.
- `save_addon_group` deletes the options of a group that the owner's save leaves out, when it is called.

After it:

```sql
select * from app.audit_grants();                 -- no rows
select * from app.unindexed_foreign_keys();       -- no rows
select key, value from public.app_config
where key in ('import_caps', 'case_caps', 'import_raw_retention_days') order by key;   -- three rows (starting values below)
select count(*) from public.addon_groups where not limits_confirmed;                    -- 0: existing groups are the owners'
select has_column_privilege('authenticated', 'public.menu_imports', 'raw_text', 'select');   -- false
select proname, pg_get_function_identity_arguments(oid) from pg_proc where pronamespace = 'public'::regnamespace and proname in
  ('create_import', 'claim_import_scan', 'save_import_draft', 'apply_import', 'discard_import', 'list_purgeable_imports',
   'set_onboarding_step', 'open_case', 'ops_update_case', 'set_availability', 'restore_today', 'export_menu', 'venue_activity',
   'ops_venues', 'ops_venue', 'ops_analytics', 'ops_set_demo', 'ops_revision', 'save_addon_group', 'ops_approve_venue')
order by 1;                                                                               -- twenty rows, one per name
```

Then, with the publishable key, as a signed-in owner of the demo venue: `my_dashboard` answers `"v": 2`. As a staff
member, `ops_venues` lists the demo venue with `isDemo: true`. The scanner's edge function needs only its four
`menu_imports` columns: `status` to `failed`, `error_code`, `raw_paths`, `raw_purged_at` (the purge). It claims with
the owner's token (`claim_import_scan`), saves what it read with `save_import_draft` (service role, a claimed import
only), and lists what to purge with `list_purgeable_imports`. Anything else it tries is refused (42501).

**The staff reads are logged only when they commit.** `ops_revision` (`menu.read`), `ops_leads` (`leads.read`) and
`export_menu` (`menu.export`) write their log row in the read's own transaction. Check that the hosted API does not let
a caller roll that transaction back: call `ops_revision` as a staff member with the header `Prefer: tx=rollback` and
see that the `menu.read` row is there afterwards (PostgREST honours that header only when its `db-tx-end` setting allows
an override; it must not, on `mana` and on any later project).

**Halom staff are never made members of client venues.** A staff member who is also a member is logged under the
member's role (the owner reads "manager", not "Halom"), so nothing marks the action as staff's.

Once, after the last one:

1. Set the public storage address and, optionally, seed the demo venue:

   ```sql
   -- the public storage address for this environment (ends with "/")
   update public.app_config set value = to_jsonb('https://<project-ref>.supabase.co/storage/v1/object/public/menu-public/'::text)
   where key = 'public_base';
   -- the synthetic demo venue (optional): run seed/synthetic.sql
   ```

2. **Auth → Sign In / Providers → Email → "Confirm email" ON**, with a working mail sender (custom SMTP). With it
   off, Supabase marks every address confirmed at sign-up, so `require_confirmed_email` proves nothing; without mail,
   nobody can confirm, so nobody can create a venue.
3. Run the Supabase advisors (security and performance) and check that `cron.job` holds the three jobs.
4. **The header check.** The caps trust the address the platform puts in `cf-connecting-ip` / `x-real-ip` / the last
   `X-Forwarded-For` entry. Prove a caller cannot choose it: send two `track_events` calls from the same machine to the
   demo venue (published and approved by the seed), one plain and one with forged headers, then look at the counters.

   ```bash
   # $URL = the project URL, $KEY = its publishable key; each call needs a fresh event id
   ev() { printf '[{"id":"%s","name":"menu_opened","venueId":"00000000-0000-4000-8000-0000000000c1","at":"%s","props":{"src":"link","lang":"he","revision":1}}]' \
     "$(uuidgen | tr A-Z a-z)" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"; }
   curl -s "$URL/rest/v1/rpc/track_events" -H "apikey: $KEY" -H 'Content-Type: application/json' -d "{\"p_events\": $(ev)}"
   curl -s "$URL/rest/v1/rpc/track_events" -H "apikey: $KEY" -H 'Content-Type: application/json' \
     -H 'cf-connecting-ip: 203.0.113.1' -H 'x-real-ip: 203.0.113.2' -H 'x-forwarded-for: 203.0.113.3, 203.0.113.4' -d "{\"p_events\": $(ev)}"
   ```

   ```sql
   select key, n from app.event_counters
   where key like 'demo-source:%' and window_start = date_trunc('hour', now());
   ```

   **One key with `n = 2`** (and nothing else new) means both calls landed on the real client's source: the forged
   headers were ignored. Two keys mean the platform passes caller-written headers through; do not open the product
   until `app.request_source()` is changed to the header the platform does control.

   **Result on `mana`, 16 Oct 2026: passed.** Supabase's edge (Cloudflare) refuses a request that carries its own
   `cf-connecting-ip` header outright ("error code: 1000"), so that header cannot be forged at all; a call forging
   only `x-real-ip` and the leftmost `X-Forwarded-For` landed on the same source as the plain call (one key, `n = 2`).
   To repeat the check, forge only those two headers: a forged `cf-connecting-ip` never reaches the database.

A later migration that changes access adds its grants and policies at its end, in the same style, and updates the
intended list inside `app.audit_grants()` in the same change; the tests fail otherwise.

## Settings (`public.app_config`)

**Three founder decisions the reviews introduced** are switches, set to the cautious side until Daniel and Rami decide:

| Decision | Switch | Default | Note |
|---|---|---|---|
| Halom checks a venue before guests see it | `publish_requires_approval` | **`true`** | The first publish waits for `ops_approve_venue`, which makes it visible and starts the trial. `false`: the first publish goes live at once |
| Only confirmed e-mail addresses create venues | `require_confirmed_email` | **`true`** | Needs Auth → "Confirm email" ON and a working mail sender (see the checklist above) |
| How long raw guest events are kept | `events_retention_months` | **`13`** | The daily job drops older event partitions; the rollups are kept as they are |

All settings:

| Key | Default | What |
|---|---|---|
| `public_base` | `null` | The public storage address (set per environment); publishing is refused until it is set |
| `publish_requires_approval` | **`true`** (until Daniel decides) | A venue's first publish waits for Halom: `ops_approve_venue` makes it visible and starts the trial |
| `require_confirmed_email` | `true` | `create_venue` needs a confirmed auth e-mail (and Auth's "Confirm email" ON) |
| `staff_require_aal2` | `false` | Staff count as staff only in an MFA (`aal2`) session. **Turn it on as soon as the back office has its MFA screen** |
| `event_caps` | `{"per_source_hour": 300, "per_venue_source_day": 1500, "per_venue_day": 50000}` | Guest-event caps; past `per_venue_day` the day is flagged as capped |
| `event_caps_demo` | `{"per_source_hour": 100000, "per_venue_source_day": 1000000, "per_venue_day": 1000000}` | The same caps for demo venues (`venues.is_demo`), on counters of their own: the simulator runs every bot from one source |
| `lead_caps` | `{"per_source_hour": 5, "per_source_day": 20, "hard_day": 2000}` | Past `per_source_hour` a lead is kept as `spam`; past `per_source_day` one source's leads are answered ok and not stored; past `hard_day` non-spam leads from everyone in 24 hours the form answers `rate_limited` |
| `events_retention_months` | `13` | Event partitions older than this many months are dropped by the daily job |
| `import_caps` | `{"per_venue_day": 20, "scan_images_per_venue_day": 60, "scan_images_per_user_day": 120, "scan_images_per_day": 1000}` | Imports a venue may create per local day (the same input again is not a new one); the images the scanner may read, charged when a claim succeeds, before any paid call: per venue (its local day), per person and for all venues (UTC day). Starting values; `rate_limited` names the cap. Daniel's to change |
| `case_caps` | `{"per_venue_day": 10}` | Support cases a venue may open per local day |
| `import_raw_retention_days` | `30` | The raw input of imports finished (applied, discarded, failed), or left uploaded or parsed, longer ago than this is purged: the text by the daily job, the screenshots by the scanner (`list_purgeable_imports`) |
| `staff_invite_max_failures` | `5` | Failed invite redemptions per person per day before `locked` |
| `trial_days`, `vat_basis_points`, `limits`, `reserved_slugs` | 30, 1800, … | As in the foundation |

## The RLS model

Every table has RLS on. `anon` has no table privilege at all. Policies call helpers in the `app` schema (not exposed by
the API), each `SECURITY DEFINER` with `search_path = ''`:

| Who | Reads | Writes |
|---|---|---|
| guest (`anon`) | nothing; `public_menu(slug)` returns the published snapshot plus the live overlay | `track_events` (guest events only), `submit_lead` |
| owner | everything of their venues, except an import's raw text (nobody reads it back) | menu, hours, availability, settings, publish, restore, unpublish; imports and new support cases only through their RPCs; the support switch (owner only) |
| manager | like the owner | like the owner, except the team and the support switch |
| counter | the menu of their venue | availability overrides only (take off, restore); never a price |
| Halom support | every venue's menu and records | a venue's menu **only** through `act_for_owner`; approvals through `ops_approve_venue` (with a reason); leads only through `ops_leads` |
| Halom admin | like support | like support, plus staff invites (`create_staff_invite`) and plans (`ops_set_plan`, with a reason) |
| service role (edge functions) | everything (it bypasses RLS) | **only** what the scanner and the picture pipeline produce: insert and update on `assets`; on `menu_imports` an UPDATE of `status`, `error_code`, `raw_paths` and `raw_purged_at`, which the guard narrows to failing a read it claimed and purging the input once, of an import that may be purged (the scanner claims with `claim_import_scan` and saves what it read with `save_import_draft`). Never a venue, member, staff row, invite or plan, never the records (activity log, revisions, events, rollups), never TRUNCATE / TRIGGER / REFERENCES; anything else goes through an RPC |

Structural guarantees beside the policies: composite foreign keys `(venue_id, id)` so no row points into another venue;
opening windows never overlap, per venue and including a window past midnight into the next day's first
(`hours_overlap`, under the venue's lock);
the slug is permanent; pictures (including the logo and the table photo) live in the venue's own storage folder;
availability overrides can only be restored, never edited or deleted; venues with history cannot be deleted (records
`RESTRICT`), they are archived; a venue always keeps an owner (the venue's row is locked, so two owners cannot remove
each other at once); a venue's approval (`approved_at`, `approved_by`) is audited like any other column.

**Plans and trials.** A venue has one trial: it starts with the first approved publish (or `ops_approve_venue`) and only
while no trial ever started, so a venue set back to `pending` does not get a fresh one by publishing again. **To take a
venue offline, an admin sets it to `suspended`** (`ops_set_plan`, with a reason); guests then see "unavailable" and
publishing is refused (`plan_suspended`). `pending` is only the state before the first approval.

**A rule that lost its condition stays off.** When the last dish or section a rule's "basket has" names is deleted, the
rule is switched off with `inactive_reason = 'basket_has_emptied'` (logged as `upsell_rules.deactivated`). Switching it
on again with the list still empty is refused (`rule_condition_emptied`), since "when the basket has X" would become
"always"; giving it a new target clears the reason and it may go on. The reason cannot be cleared by hand while the list
is empty: a rule meant to have no condition is made as a new rule.

**Append-only, and its limit.** `activity_log` and `menu_revisions` refuse UPDATE, DELETE and TRUNCATE through
triggers, for every API role and for ordinary SQL. The database owner and a superuser can still bypass that (disable the
trigger, `session_replication_role = replica`, drop the table): the log is tamper-evident for the product, not against
the people who run the database. A later step can add a hash chain over the log, or a periodic export to storage the
database cannot write.

**Act for owner (D25).** Staff never write a venue's menu directly. `act_for_owner(venue, reason, action, payload)` checks
the caller is staff, needs a reason (3–500 characters once its blank edges are stripped, so zero-width spaces, tabs or
NBSPs are not a reason; kept stripped), honours the owner's `support_can_act` switch, allows five actions
(`availability.set`, `availability.restore`, `dish.update` with a column allow-list, `onboarding.set`,
`support_case.update`; **no `menu.publish` in phase 1**: it would publish the owner's draft unreviewed, so staff help
through the approval), marks the transaction so every audit row the action causes reads `via = act_for_owner` with the
reason, and writes its own `support.act_for_owner` row (the payload's keys and ids and the result's ids and numbers,
never the words staff typed), all in one transaction; a failed action leaves nothing. `dish.update` and
`onboarding.set` carry the `updated_at` staff read (`expectedUpdatedAt`), compared to the microsecond: when the owner
changed the row since, the answer is `stale` with the row as it is, and nothing is written. Every read a version comes
from gives it in full (a table row, `ops_venue` and `my_dashboard`'s onboarding steps). The marker counts only for staff:
an owner who sets it is still logged as the owner.

**Reasons are shown to the owner** (in `activity_log` and `my_dashboard().activity`), for `act_for_owner`,
`ops_approve_venue` and `ops_set_plan`. A reason must say why, never who: no names, phones or anything personal.

**The activity log.** Statement-level audit triggers on every content table write one row per venue per statement
(`n` rows affected). A one-row change carries the values of numbers, booleans, ids, codes, times and paths (an
allow-list); names, descriptions, notes and anything else people typed are recorded only as "this column changed".
Lead contacts never leave the leads table.

**Personal data reads are logged.** Staff read leads only through `ops_leads` (each call writes a `leads.read` row with
the count and the filter, never the contents) and update them through `ops_update_lead`. Every future read of personal
data follows the same pattern. Reads of a venue's own data that its owner should know about are logged on the venue's
timeline: `export_menu` (`menu.export`, with the counts) and `ops_revision` (`menu.read`, the revision's number). **Phase-1 work, not built yet:** staff reads of private storage objects (the owner's
original photos, import screenshots) still go through the storage policy; they move to a logged RPC that hands out
short-lived signed URLs.

**Staff accounts.** An admin creates an invite with `create_staff_invite(email, role)`: the code (48 hex characters) is
returned once, only its hash is stored. It redeems only for a signed-in user whose confirmed auth e-mail is the invite's
address; codes under 32 characters are refused before any lookup; five failures in a day lock the person out until the
next day. The first admin is added once by SQL, by whoever applies the migrations
(`insert into public.staff (user_id, role) values ('<auth user id>', 'admin')`).

## Events and rollups

`track_events(batch)` takes 1–50 guest events (`packages/contracts/src/events.ts`): unknown or personal fields are
refused per event (own keys only: `constructor` or `__proto__` are not properties), times must carry an offset, ids must
belong to the venue, the venue must be published and approved, and the same id is stored once (also across batches).
Three caps stop scripted inflation: per source per hour, per (venue, source) per day, per venue per local day; the day a
venue passes its cap is recorded and shown (`my_dashboard().capped`, `ops_overview().venues[].cappedToday`). Demo venues
use `event_caps_demo` on counters of their own (`demo-source:…`), so the simulator's bots never cap a real venue's
guests who share an address with them.

Realtime publishes exactly `rollups_minute`, `rollups_day` and `availability_overrides` (a test pins the list): never
`venues` or anything personal. A dashboard resolves an id it reads from a rollup key (`dish:<id>`) only inside the
venue, since another venue may hold a row with the same id.

The **source** is a SHA-256 of the caller's address with a random salt that changes every UTC day (kept two days, then
deleted). The address is `cf-connecting-ip`, then `x-real-ip`, then the **last** `X-Forwarded-For` entry; never the
leftmost, which a caller writes. The source is never stored with an event; a lead's source hash is forgotten after
seven days.

Server events (`menu_published`, `onboarding_step_done` once per venue and step, `import_parsed`) are emitted by the
database itself. Raw events sit in `public.events`, partitioned by month in schema `app`, readable by nobody through the
API. `app.build_rollups()` drains a queue into `rollups_minute` (UTC minute, kept 35 days) and `rollups_day` (the venue's
local date), so a late event is counted exactly once. Both rollup tables have an opaque uuid primary key, so a Realtime
DELETE payload (which carries only the key) names no venue, dish or rule. Demo venues' events are flagged and left out
of real totals. The daily job drops event partitions older than `events_retention_months`.

## RPCs

| RPC | Who | Does |
|---|---|---|
| `public_menu(p_slug)` | anyone | `{state:'ok', snapshot, live}` · `{state:'unavailable', venue:{name}}` (unpublished, waiting for review, plan not live) · `{state:'not_found'}` |
| `track_events(p_events)` | anyone | `{ok, accepted, duplicates, capped, rejected:[{index, code}], duplicateIndexes, cappedIndexes}` (the last two name events by their index in the batch, so a sender knows exactly what was stored) |
| `submit_lead(…)` | anyone | Mana's own "talk to us" form; `{ok, ref}` for a well-formed lead (suspected spam is kept, marked `spam`); same token, same ref; `{ok}` without a ref, and nothing stored, for one source past `per_source_day`; `{ok:false, code:'rate_limited'}` only past the 24-hour ceiling of non-spam leads |
| `slug_available(p_slug)`, `create_venue(p_slug, p_name_he, p_name_en, p_kind, p_default_lang)` | signed in, confirmed e-mail | the venue, its owner, a pending trial, nine onboarding steps; at most five venues per owner |
| `preview_menu(p_venue)` | owner, manager, staff | `{snapshot, issues, warnings}`: what a publish would produce, what would stop it, what would only warn |
| `publish_menu(p_venue, p_note)` | owner, manager | builds snapshot v2, validates it with the contracts' codes, stores revision n+1, returns `{ok, revision, slug, path:'/m/<slug>', review, warnings}` |
| `restore_revision(p_venue, p_revision)`, `unpublish_menu(p_venue)` | owner, manager | put an earlier revision back; take the menu off the air (live today on `halom-studio`, kept through the cutover) |
| `my_dashboard(p_venue, p_range)` | owner, manager, staff | v2 (`"v": 2`, every phase-0 field kept): from the rollups, totals, opens by source and language, days (with `capped`), the last hour by minute (opens, views, adds; only minutes with something), top dishes, rule numbers (with trigger and why a rule is off); off now with names, who and whether it was today; onboarding steps (`auto`) and progress; nudges in `NUDGE_CODES` order; activity as entries (`you`, the row's name now); today's glance |
| `set_onboarding_step(p_venue, p_step, p_state, p_blockers)` | owner, manager | `{ok, progress}`; the automatic steps (venue, menu, review, publish) are never marked done by hand (`step_automatic`), a done step stays done (`step_done`); blockers are machine words, kept when none are sent |
| `open_case(p_venue, p_topic, p_subject, p_body, p_allow_act, p_id)` | owner, manager | the only way to make a case: `{ok, caseId, supportCanAct}`; `p_allow_act` switches Halom's access in the same call (owner only); `case_caps` per local day; `p_id` the client's own id: the same id again answers the stored case (a retry), another venue's is `id_taken` |
| `ops_update_case(p_case, p_status, p_topic, p_reason)` | staff | `{ok, case}`; the reason (required) is shown to the owner |
| `set_availability(p_venue, p_target_kind, p_target_id, p_until, p_note)` | owner, manager, counter | the phone's quick action: the newest answer counts (what was off is restored first, in the same call); `p_until` null brings the target back; a duration ends on a whole minute; `{ok, overrideId, untilAt, restored}` |
| `restore_today(p_venue)` | owner, manager, counter | everything taken off on the venue's local today, back: `{ok, restored, targets}` |
| `export_menu(p_venue)` | owner, manager, staff | the menu as JSON (`MenuExport`): every menu table as stored, pictures by their public files only; logged (`menu.export`) |
| `venue_activity(p_venue, p_before, p_limit, p_actor, p_via)` | owner, manager, staff | the log page by page, newest first: `{entries, next}`; staff are never named, an actor's id never leaves; `targetName` is the target's name as it reads now (a section, dish, add-on group or option, upsell rule, schedule; for an availability entry, taken off or brought back, the name of what it took off; for Halom's `support.act_for_owner`, the dish or the target its action names), null when the row is gone |
| `create_import(p_venue, p_source, p_text, p_paths, p_input_sha256, p_rights_confirmed, p_import_id)` | owner, manager | a text is stored stripped and hashed by the database; images name the import's id (made by the client before uploading) and send their private paths, each exactly `<venue>/imports/<id>/<name>` (a name of letters, digits, `.`, `-`, `_`; the table's check says the same), at most 8 for a scan and 24 for Wolt screenshots, and their hash; the same input as a live import is that import (`reused`); an id already used otherwise is `id_taken`; `import_caps.per_venue_day` |
| `claim_import_scan(p_import, p_mode)` | owner, manager (the scanner, with the owner's token) | before any paid call, `p_mode` the import's source (`scan`, `wolt_screenshots`; another is `not_scannable`, free): the import moves to `parsing` (a claim older than 10 minutes may be taken again; a purged one never), and the scanner gets `{importId, venueId, source, paths, images, rightsConfirmed, langs}`; the images are charged on three caps (`rate_limited` with `cap`); anyone else, and an import that does not exist, `import_unknown` |
| `save_import_draft(p_import, p_draft, p_notes)` | owner, manager (uploaded, failed, parsed); the service role (an import it claimed) | the draft checked by `app.validate_import_draft` (`invalid_draft` with the contracts' codes, `too_large` past 1 500 000 bytes), its source, its photos in the import's own folder, confirmed photos only on a confirmed import, the reader's notes (`app.validate_reader_notes`); stores `parsed`, `notes` and `exceptions` (in the venue's languages); `{ok, exceptions, counts}` |
| `apply_import(p_import, p_draft, p_decisions)` | owner, manager | the stored draft (`draft_changed` otherwise) and the owner's answers through `app.plan_import`, the twin of `planApply` (`plan_invalid` with its errors), run in one transaction: never a delete, never a publish; a trigger's refusal undoes everything (`apply_failed`); stores the draft's answered exceptions, marks onboarding's menu and review done, one `import.apply` row (summary, `planExceptions` per code); `{ok, plan}` |
| `discard_import(p_import)` | owner, manager | uploaded, failed or parsed → discarded (twice is fine); frees the input's hash |
| `list_purgeable_imports(p_limit)` | service role | the image imports whose screenshots may be deleted now, with their venue and paths (the scanner's purge mode) |
| `save_addon_group(p_venue, p_group, p_options, p_expected_updated_at, p_confirm_rule_removal)` | owner, manager | a group and its options as one, under the venue's nesting lock: the client's ids (insert or update), the options left out deleted; the same input twice changes nothing; `stale` (with the stored group) over a newer save; never a group publishing would refuse (`options_empty`, `min_unreachable`) or limits a dish offering it could no longer keep (`limits_loosened`, `limits_invalid`, path `dishGroups.<link id>`); `option_in_rules` (with the rule ids) until the owner confirms; a trigger's refusal rolls back everything; `{ok, group, options}` as stored |
| `redeem_staff_invite(p_code)` | signed in, confirmed e-mail | an invite bound to the caller's e-mail makes them staff |
| `create_staff_invite(p_email, p_role)` | Halom admin | `{ok, code, expiresAt}`, the code shown once |
| `ops_overview()` | staff | phase 0's back office, on the same row builder as `ops_venues` (kept for older callers) |
| `ops_venues(p_filters)` | staff | the clients list (`OpsVenuesQuery`: search, stage, warning, review, plan, demo scope, sort, paging): `{totals, total, venues}`; totals count real venues only |
| `ops_venue(p_venue)` | staff | one venue: its row, members, onboarding, imports (never their input), cases (open first), the timeline |
| `ops_revision(p_venue, p_revision)` | staff | the stored menu Halom approves (before approval `public_menu` answers "unavailable"): the newest revision unless a number is asked, whether it is live, the review state, the snapshot; logged (`menu.read`) |
| `ops_analytics(p_query)` | staff | counts per minute (35 days back, a day at most) or per day, across venues or for one, real traffic unless the query says otherwise; the funnel of the venues created in the range; the imports created in it |
| `ops_set_demo(p_venue, p_demo, p_reason)` | Halom admin | labels a venue demo or real, with the reason the owner sees; stored events and rollups keep the label they were counted with |
| `ops_approve_venue(p_venue, p_reason, p_expected_revision)` | staff | approves the first publish, starts the trial, logged with the reason; the only way a venue is approved. `p_expected_revision` is the published revision's number staff reviewed (the one guests will see): another is `revision_changed` with that number, under the venue's lock |
| `ops_set_plan(p_venue, p_state, p_until, p_reason, p_plan)` | Halom admin | sets the plan state by hand until billing exists (live today as `ops_set_entitlement`), logged with the reason; `suspended` takes a venue offline; **never approves**: `trialing` or `active` on a venue waiting for approval is `approval_first` |
| `ops_leads(p_status, p_source, p_since, p_limit)`, `ops_update_lead(p_id, p_status, p_owner, p_notes)` | staff | the leads, every read logged; spam out of the default view |
| `act_for_owner(p_venue, p_reason, p_action, p_payload)` | staff | the only staff write path into a venue's menu (above) |

Every RPC above answers a refusal its caller can act on as `{ok:false, code}` (the codes are the contracts'), and a
caller who may not call it at all with 42501; the read RPCs answer a bad input with 22023 and the code as the message.

**Later:** team invitations (invite, accept) and member management; the logged signed-URL RPC for staff reads of
private files; the scanner's Wolt modes in the edge function.

## How ordering, payment and fiscal tables will attach (phases 2–3)

Not designed here; this is where they plug in:

- **Mode gate.** `venues.mode = 'standalone'` turns ordering on; `view_only` venues have no order rows at all.
- **Orders** reference `menu_revisions (venue_id, id)`: the server prices every line with `priceDish` from the
  revision the guest saw plus the live overlay (`menuAvailability`), never from client numbers. `order_lines` freeze
  name, unit price, chosen options (the `DishSelection` tree) and the revision, each with an idempotency key.
- **VAT on the fiscal document is computed on totals, not per line** (the same rule `priceDish` follows: VAT is
  extracted from a line's total, half up), so a receipt never disagrees with the price shown by a rounding agora.
- **Append-only logs** like `activity_log`: `order_events`, `payment_events` (unique provider event id), fiscal
  documents; `ON DELETE RESTRICT` from venues and revisions; retention set by the accountant.
- **State machines** with an explicit `unknown`, guarded by triggers as `payments/` does today; reconciliation jobs
  beside `app.build_rollups` in `…_jobs`.
- **Events.** The reserved names (`checkout_started`, `payment_confirmed`, `print_queued`, …) become server events
  emitted by those tables' triggers; no client sends them. Still no personal field: the order page's token never
  enters an event.
- **Roles.** The counter role gains order actions through RPCs (mark ready, collected), still no prices or refunds;
  `act_for_owner` gains order actions with the same reason rule; `app.audit_grants()`'s list grows in the same change.
