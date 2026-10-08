# Halom Menus — backend contract (Supabase project `halom-studio`, ref `zemdhczqlhkabfwxccqq`)

Written by the lead, 6 Oct 2026. The DB lane implements exactly this; the studio, admin and site lanes consume it.
Anything that has to differ goes into `db/CHANGES.md` and is flagged in the lane's report.

- URL `https://zemdhczqlhkabfwxccqq.supabase.co` · publishable key `sb_publishable_2VJC5Vn-AlpkXKpQPOVnfA_5nirGaKS`
  (legacy anon JWT also enabled). Clients use `@supabase/supabase-js` v2 (bundled, not from a CDN).
- All tables are in `public`, RLS on everywhere. "member" = a row in `memberships` for `auth.uid()`.
- Names are bilingual columns `*_he` / `*_en` (text, default ''). At least one of the two must be non-empty where noted.
- Money: `price_minor` integer in minor units (agorot), currency on the business (default `ILS`).

## Auth
Email + password. Email confirmation mail cannot be delivered yet (no SMTP), so sign-up goes through an Edge Function
that creates an already-confirmed user, then the client signs in normally:
- `POST /functions/v1/menus-signup` (no JWT needed; send `apikey` header) body `{ "email", "password", "hp": "" }`
  → `200 {"ok":true}` | `200 {"ok":false,"code":"exists"|"invalid"|"weak_password"|"rate_limited"|"reserved"}`.
  Password ≥ 8 chars. `hp` is a honeypot and must be empty.
- then `supabase.auth.signInWithPassword({ email, password })`; `supabase.auth.updateUser({ password })` to change it.
- Password reset by email does NOT work yet: the UI says "write to us on WhatsApp +972 54-202-2269 and we will reset it".

## Tables a member can read and write (RLS: member of `business_id`)
| Table | Columns (besides `id uuid`, `created_at`, `updated_at`) |
|---|---|
| `businesses` | `slug` (unique, `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`), `name_he`, `name_en` (one required), `area_he/en`, `cuisine_he/en`, `kind` ('restaurant','cafe','bar','bakery','food_truck','other'), `logo_path`, `accent` (`#rrggbb`), `default_lang` ('he','en'), `langs` text[], `currency`, `order_url` (https only, nullable), `phone`, `contact_name`, `contact_phone`, `created_by`. Members: select + update (not `slug`, not `created_by`). Insert only through `create_business`. No delete from the client. |
| `memberships` | `business_id`, `user_id`, `role` ('owner','editor'). Select own rows only. |
| `menus` | one row per business, created with it: `business_id` (unique), `surface` (a table id from the viewer's TABLES, or 'holo', or 'custom'), `table_img_path`, `published_revision_id`, `first_published_at`, `last_published_at`. Members: select + update of `surface`, `table_img_path`. |
| `categories` | `business_id`, `menu_id`, `position` int, `name_he`, `name_en` (one required), `kind` ('food','dessert','drinks','wine','beer'), `scene` ('auto','table','bar','holo'). Members: all. Max 24 per menu. |
| `items` | `business_id`, `category_id` (cascade), `position` int, `name_he`, `name_en` (one required), `desc_he`, `desc_en`, `price_minor` int null, `price_note`, `available` bool, `tags` text[] ⊂ {vegan,vegetarian,spicy,gf}, `allergens_he`, `allergens_en`, `details` jsonb (`{wine:{…}}` / `{beer:{…}}` as in the snapshot contract, ≤ 8 kB), `asset_id` uuid null → must be an `approved` asset of the same business. Members: all. Max 200 per menu. |
| `assets` | `business_id`, `item_id` null, `status` ('uploaded','queued','processing','ready_for_review','approved','rejected','failed'), `state` ('relief','photo'), `kind` null \| ('flat','low','medium','tall','stand'), `original_path`, `color_path`, `aux_path`, `thumb_path`, `meta` jsonb (`{e,h,o?,s?,warn?}`), `provenance` jsonb, `error` text, `attempts` int, `reviewed_at`, `reviewed_by`. Members: all. `approved` requires `color_path` (and `aux_path` + `kind` + `meta.e/h` when `state='relief'`). `attempts` > 3 is refused. Max 80 new assets per business per 24 h. |
| `menu_revisions` | `business_id`, `menu_id`, `number`, `snapshot` jsonb, `note`, `created_by`. Members: select only. |
| `entitlements` | `business_id` (pk), `plan` ('trial','pilot','paid'), `status` ('none','trialing','active','expired','paused'), `trial_started_at`, `trial_ends_at`, `period_end`, `note`. Members: select only. Created with the business as `status='none'`; the 30-day trial starts at the first publish. |
| `events` | `business_id`, `user_id`, `kind`, `meta` jsonb, `at`. Members: select; insert of kinds 'asset_generated','asset_failed','onboarding_step' only. |

A job is an `assets` row: the original upload is stored first (`uploaded`), so a closed tab loses nothing; the studio
resumes every `uploaded`/`queued`/`processing` row older than 2 minutes the next time it opens.

## Storage
| Bucket | Public | Path | Limits | Who writes |
|---|---|---|---|---|
| `menu-originals` | no | `{business_id}/{asset_id}/original.{ext}` | 15 MB, image/* | members (read, write, delete) |
| `menu-assets` | yes (read by URL; no listing) | `{business_id}/{asset_id}/color.jpg` · `aux.png` · `thumb.jpg`; `{business_id}/brand/logo-{n}.png`; `{business_id}/brand/table-{n}.jpg` | 3 MB, jpeg/png/webp | members (write, delete) |
Public URL = `{supabaseUrl}/storage/v1/object/public/menu-assets/{path}`. Paths stored in the DB are bucket-relative.
Asset ids are random UUIDs; nothing unapproved is ever referenced by a published snapshot.

## RPCs (`supabase.rpc(name, args)`)
| Function | Who | Does |
|---|---|---|
| `slug_available(p_slug text) → boolean` | signed-in | false for taken, malformed or reserved slugs |
| `create_business(p_slug, p_name_he, p_name_en, p_kind, p_default_lang) → businesses` | signed-in | creates the business, the owner membership, its menu and its entitlement. Max 3 businesses per user. Errors: `slug_taken`, `slug_invalid`, `limit_reached`, `name_required` |
| `publish_menu(p_business_id uuid, p_note text default null) → jsonb` | member | validates (≥ 1 category with ≥ 1 item; every referenced asset approved and its files present in storage; entitlement not expired/paused), starts the trial on the first publish, builds the snapshot (shape in CONTRACT.md) from the current rows, stores revision n+1, points the menu at it. Returns `{ "revision": n, "slug": "...", "short_url": "https://halom.io/m/<slug>", "trial_ends_at": ... }`. Errors (exception message = code): `not_member`, `empty_menu`, `asset_not_ready:<item id>`, `asset_file_missing:<asset id>`, `subscription_inactive` |
| `restore_revision(p_business_id uuid, p_number int) → jsonb` | member | points the menu back at an earlier revision (rollback); same return shape |
| `unpublish_menu(p_business_id uuid) → void` | member | the short link answers "not available" until the next publish |
| `public_menu(p_slug text) → jsonb` | anyone | `{"state":"ok","snapshot":{…}}` (with live `available` flags overlaid from `items`), `{"state":"unavailable","business":{"name":{…}}}`, or `{"state":"not_found"}`; counts one view per call per day bucket |
| `submit_lead(p_token uuid, p_dream text, p_contact text, p_name text, p_package text, p_source text, p_locale text, p_page text, p_hp text, p_elapsed_ms int) → jsonb` | anyone | studio enquiries (the dream portal on halom.io, and the "talk to us" form on the product page with `p_source='menus-landing'`). `{"ok":true,"ref":"HL-2026-0007"}` or `{"ok":false,"code":"invalid"|"rate_limited"|"spam"}`; the same `p_token` returns the same ref |
| `admin_overview() → jsonb` | Halom admins | `{ totals:{users, businesses, published, items, assets_approved, views_7d, views_30d, leads_new}, funnel:[{step, count}], businesses:[{id, slug, name_he, name_en, kind, owner_email, created_at, last_activity_at, categories, items, assets:{approved, ready_for_review, failed, pending}, published, revision, first_published_at, last_published_at, views_7d, views_30d, views_total, entitlement:{plan,status,trial_ends_at,period_end}, contact_name, contact_phone, phone}], signups_by_day:[{day,count}], views_by_day:[{day,count}] }` |
| `admin_set_entitlement(p_business_id uuid, p_plan text, p_status text, p_period_end timestamptz, p_note text) → entitlements` | Halom admins | manual pilot/paid switches until billing exists |
| `admin_leads(p_limit int default 200) → jsonb` · `admin_update_lead(p_id uuid, p_status text, p_owner text, p_next_action text, p_notes text) → jsonb` | Halom admins | the studio's lead list. Lead statuses: 'new','qualified','scoped','agreed','production','review','deployed','support','lost','spam' |
| `is_halom_admin() → boolean` | signed-in | lets the UI show or hide the back office |

Errors from RPCs arrive as PostgREST errors whose `message` is the code listed above.

## What is deliberately not here yet
Billing (entitlements are switched by hand), email (confirmation, reset, notifications), team invitations, CSV import,
more than one menu per business, in-product ordering or payment.
