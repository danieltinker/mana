# Halom menus — backend (Supabase project `halom-studio`, live since 6 Oct 2026)

URL `https://zemdhczqlhkabfwxccqq.supabase.co` · publishable key `sb_publishable_2VJC5Vn-AlpkXKpQPOVnfA_5nirGaKS`
(public by design; it is in `config.js` at the root of this repository). The full schema is `db/0001_core.sql` (applied). Read it: it is
the truth. This page is the short version for front-end work.

## Sign-up and sign-in (pilot rules)
- New account: `POST {url}/functions/v1/menus-signup` with headers `apikey: {key}`, `Content-Type: application/json`
  and body `{ "email", "password" (8–72 chars), "hp": "" (honeypot, must be empty), "elapsed_ms": <ms the form was open> }`
  → `{ "ok": true }` or `{ "ok": false, "code": "invalid_email"|"email_rejected"|"weak_password"|"exists"|"rate_limited"|"spam"|"failed" }`.
  `email_rejected` (13 Oct 2026): Auth itself refused the address (`email_address_invalid`: its domain failed Auth's own
  e-mail validation); `invalid_email` also covers Auth's "Unable to validate email address: invalid format". The function
  strips invisible marks, a full-width `@` and a trailing full stop before checking, as the app does (`studio/src/lib/email.ts`).
  The account is usable at once (no confirmation e-mail: the project has no mail service yet; say nothing about
  "check your inbox"). Then sign in with supabase-js `auth.signInWithPassword({ email, password })`.
- Password reset by e-mail does NOT work yet. Show "Forgot it? Message us on WhatsApp" (https://wa.me/972542022269).
- Sessions: supabase-js default (localStorage, auto refresh).

## Tables an owner touches (RLS: only rows of businesses the user is a member of)
| Table | Owner may | Notes |
|---|---|---|
| `businesses` | select; update the profile columns | create only through `create_business`; slug is fixed after creation |
| `memberships` | select own rows | |
| `menus` | select; update `surface`, `table_img_path` | one row per business |
| `categories` | select/insert/update/delete | `position` int for order; `kind` food·dessert·drinks·wine·beer; `scene` auto·table·bar·holo; at least one of name_he/name_en |
| `items` | select/insert/update/delete | `price_minor` int (agorot) or null; `tags` ⊆ {vegan,vegetarian,spicy,gf}; `details` jsonb `{wine:{…}}` / `{beer:{…}}` (shape in CONTRACT.md, free texts may be `{he,en}`); `asset_id` may only point at an APPROVED asset of the same business; `available` is live for diners at once (no publish needed) |
| `assets` | select/insert/update/delete | one row per picture attempt; see the flow below |
| `entitlements` | select | `plan` trial·pilot·paid, `status` pending·trialing·active·expired·suspended, `trial_ends_at`, `current_period_end`. Effective state: trialing past `trial_ends_at` or active past `current_period_end` = expired |
| `menu_revisions` | select | `number`, `snapshot`, `created_at`, `note` |
| `menu_views_daily` | select | `day`, `views` (diner opens per day) |
Limits (errors raised by the database, message = code): `limit_categories` (24), `limit_items` (240),
`limit_assets_per_day` (120), `limit_assets_total` (900), `limit_attempts` (5 tries per picture).
Other database error codes you can get: `category_of_other_business`, `asset_not_approved`, `asset_incomplete`,
`asset_files_missing`, `asset_in_use`, `asset_bad_start`, `path_of_other_business`, `business_fixed`.

## Functions (PostgREST RPC, signed-in unless noted)
- `slug_available(p_slug)` → boolean. Slug rule: `^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$`, some words reserved.
- `create_business(p_slug, p_name_he, p_name_en, p_kind, p_contact_name, p_contact_phone)` →
  `{ok:true,id,slug}` | `{ok:false,code:'slug_taken'|'name_missing'|'limit_businesses'|'signed_out'}`. Creates the
  business, the membership (owner), its menu row and a `pending` entitlement.
- `preview_snapshot(p_business)` → the snapshot (CONTRACT.md shape) built from the current rows, revision 0. Only
  approved pictures appear in it.
- `publish_menu(p_business, p_note)` → `{ok:true, revision, slug, url}` | `{ok:false, code:'empty_menu'|'plan_expired'|'plan_suspended'|'not_member'}`.
  The 30-day trial starts at the FIRST publish. `url` is the short link `https://halom.io/m/<slug>` (what the QR encodes).
- `restore_revision(p_business, p_number)`, `unpublish_menu(p_business)` → `{ok}`.
- anonymous: `public_menu(p_slug)` (the diner viewer) and `submit_lead(...)` (enquiries; use `p_package:'menus'`,
  `p_source:'menus-landing'` for the product page's "talk to us" form; see the SQL for the parameters).
- staff only: `is_staff()` → boolean, `redeem_staff_invite(p_code)` → `{ok}`, `ops_overview()` → one JSON with
  `businesses[]`, `viewsByDay[]`, `signupsByDay[]`, `accountsWithoutBusiness`, `leads[]` (read the SQL for every field),
  `ops_set_entitlement(p_business, p_plan, p_status, p_until, p_note)`, `ops_update_lead(p_id, p_status, p_owner, p_next_action, p_next_action_on, p_notes)`.

## Files (Supabase Storage)
Two buckets, the SAME relative path in both: `<business_id>/<asset_id>/original.<ext> | color.jpg | aux.png | thumb.jpg`,
and `<business_id>/brand/logo-<random>.png`, `<business_id>/brand/table-<random>.jpg`.
- `menu-private` (private, ≤ 15 MB, images): the owner's upload and the generated draft files. Members read with
  signed URLs or `download()`.
- `menu-public` (public read, ≤ 3 MB, jpeg/png/webp): only what the owner approved, plus logo and own-table photo.
  Public URL = `{url}/storage/v1/object/public/menu-public/<path>` (CORS open, fine for WebGL).
Members may write only under their own `<business_id>/`.

## The picture flow (this is the "generation job")
1. Owner picks a photo for an item → insert `assets` row `{business_id, item_id, status:'uploaded', kind:'relief'}` →
   upload the original to `menu-private/<business>/<asset>/original.<ext>` → update `original_path`.
2. Set `status:'processing'` (the database counts the attempt; the 6th raises `limit_attempts`) → run the generator
   (`gen.analyse` + `gen.build`, CONTRACT.md) in the browser → upload `color.jpg`, `aux.png`, `thumb.jpg` to
   `menu-private` under the same folder → update the row: `status:'ready_for_review'`, `relief_class`, the three
   paths, `meta` `{e,h,o?,s?,warn?}`, `provenance`. On failure: `status:'failed'`, `error_code` = the generator's
   `.code`; the original stays, the published menu is untouched, "Try again" goes back to step 2.
   A tab closed mid-way leaves rows in `uploaded`/`processing`: on the next visit offer to resume them (the original
   is in storage).
3. Review: the owner compares the photo with the result, may change the depth class (`gen.build` again, ~1–2 s) or
   retry, or choose "use the photo as it is" (`kind:'photo'`: make a ≤1280 px JPEG `color.jpg` and a 256 px
   `thumb.jpg` in the browser, no aux).
4. Approve: copy `color.jpg`, `thumb.jpg` (and `aux.png`) from `menu-private` to `menu-public` at the same paths →
   update `status:'approved'` (the database refuses with `asset_files_missing` if the copies are not there, and with
   `asset_incomplete` if fields are missing) → set `items.asset_id` to it. An approved asset that an item uses cannot
   be un-approved (`asset_in_use`): point the item elsewhere (or null) first.
5. Nothing reaches diners until `publish_menu`. Sold-out (`items.available`) is the one live field.

---
# v2 (7 Oct 2026) — `db/0002_mana_v2.sql` is applied on the hosted project; `functions/menus-ai/index.ts` is deployed

## New for the owner app
- `items.stock_id text null` (`^[a-z0-9][a-z0-9-]{0,39}$`): a placeholder picture from the stock library. Plain column:
  update it like any other item field. `preview_snapshot` / `publish_menu` put `{state:'stock',id}` in the snapshot when
  the item has no approved picture of its own.
- `approve_asset(p_asset uuid)` → `{ok:true}` | `{ok:false, code}`: marks the picture approved AND points its item at it,
  in one call. Still copy the files to `menu-public` first (codes you can get back: `not_member`, `asset_files_missing`,
  `asset_incomplete`).
- `my_stats(p_business uuid)` → one JSON for the dashboard:
  `{ today:'YYYY-MM-DD', days:[30 × {day, views, en, qr}], hours:[24 numbers, Israel time, last 30 days],
     items:[≤12 × {id, name_he, name_en, opens, adds}] (last 30 days, most opened first),
     totals:{views30, views7, viewsPrev7, viewsAll, en30, qr30, opens30, adds30},
     menu:{live, firstPublishedAt, lastPublishedAt}, plan:{plan, state, trialEndsAt, periodEnd},
     counts:{categories, items, withPicture, withPlaceholder, soldOut} }`
  Raises `not_member` for someone else's business. `en` = opened in English, `qr` = opened from the printed code.
- `my_entitlement_state(p_business)` → text.
- New read-only tables for members: `menu_views_hourly (business_id, day, hour, views)`,
  `item_events_daily (business_id, item_id, day, opens, adds)`; `menu_views_daily` gained `views_en`, `views_qr`.

## Sign-in with Google / Apple / Facebook
supabase-js: `createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } })`, then
`auth.signInWithOAuth({ provider, options: { redirectTo: <the studio's own address without hash or query> } })`.
The answer returns as `?code=…` on the studio address; supabase-js exchanges it; then remove the query with
`history.replaceState`. An OAuth account has no business yet: it lands in the same "name your place" step as a new
e-mail account. Show a button only for providers listed in `config.auth.providers` (the founder switches each one on in
the Supabase dashboard first; until then the list is empty and no button shows). `menus-signup` stays for e-mail.

## Edge function `menus-ai` — `POST {supabaseUrl}/functions/v1/menus-ai`
Headers: `apikey: {supabaseKey}`, `Authorization: Bearer <the signed-in user's access token>`, `Content-Type: application/json`.
(Use `fetch`, not `functions.invoke`, for `scan_menu`: the answer is a stream.) Allowance per business per day: 12 scans,
80 dish suggestions (`app_config.ai_limits`).
- `{ "action": "status" }` → `{ ok:true, configured:boolean }`. `configured:false` until the founder adds the secret
  `ANTHROPIC_API_KEY`: then hide "suggest from photo" and show the scanner tile with a calm "not switched on yet" sheet.
- `{ "action":"scan_menu", "business_id", "image":{ "media_type":"image/jpeg|image/png|image/webp", "data":"<base64>" },
     "langs":["he","en"], "stock":[{id,label}] }` — ONE picture per call (a page of the menu). Shrink it in the browser first:
  longest side ≤ 2400 px, JPEG quality ≈ 0.82, and the base64 text must stay under 3.6 million characters.
  Answer: `application/x-ndjson`, one JSON object per line, arriving while the page is being read:
  `{"t":"start"}` · `{"t":"lang","v":"he|en|other"}` (the language the menu is printed in; the other language was translated
  by the model, so mark it "check the translation") · `{"t":"cat","he","en","kind":"food|dessert|drinks|wine|beer"}` ·
  `{"t":"item","he","en","dhe","den","price_minor":<int|null>,"note_he","note_en","tags":[…],"stock":<id|null>}` (belongs
  to the last `cat`) · last line `{"t":"done","cats","items","lang","truncated":bool,"usage":{in,out}}` or
  `{"t":"error","code"}`.
  Error codes: `not_configured`, `not_member`, `limit_ai`, `bad_image`, `too_big`, `not_a_menu`, `unreadable`, `empty`,
  `busy` (try again in a minute), `bad_key`, `timeout`, `upstream`, `failed`, `bad_request`. `truncated:true` = the page was
  too long for one go: keep what arrived and tell the owner to photograph the rest separately. A long page can take
  up to about two minutes; items arrive all along, so show them as they come. Nothing is saved by the function: the app
  shows the result for review and only then inserts categories and items (use bulk inserts).
- `{ "action":"describe_dish", "business_id", "image":{…≤ 1.2 million base64 characters; shrink to ≤ 1024 px}, "name":"optional",
     "langs":[…], "stock":[{id,label}] }` → `{ ok:true, suggestion:{ name:{he,en}, desc:{he,en}, kind, stock:<id|null> } }`
  | `{ ok:false, code }` (`not_food`, `empty`, plus the codes above). It describes only what is visible; the owner edits
  before saving. Never generate allergens or tags from it.
The function cannot be called in the local test stack unless the stack gets a small stand-in (`functions/menus-ai/index.ts`
is the reference; the event shapes above are the contract).

## New for the diner viewer
`open_menu(p_slug, p_lang, p_src)` and `track_item(p_slug, p_item, p_kind)`: see CONTRACT.md v2.4. Both need only `apikey`.

## Staff
`ops_business_stats()` → `{ "<business id>": { withPlaceholder, opens30, adds30, aiScans30 } }` (staff only).

## Known gaps to keep in mind
- `track_item` and `open_menu` are open to anyone with the public key: counts can be inflated by a script. Fine for a pilot.
- E-mail sign-up still confirms the address without checking it (no mail service yet). With OAuth switched on, an
  e-mail account made by someone else with the owner's address could be joined to the owner's Google sign-in: fix by
  adding a mail service and real confirmation before any wide launch.

---
# Proposed (13 Oct 2026) — `db/proposed/0003_templates.sql`, `db/proposed/0004_events.sql`: NOT applied yet

- 0003: `businesses.book_url` (https only, ≤ 300, members may update), `menus.template` (`^[a-z0-9-]{1,40}$`), and the snapshot
  carries `business.bookUrl` and `theme.template` (still `v: 1`). The owner app sends `book_url` only when
  `config.features.bookUrl` is true: Daniel applies 0003 first, then flips the flag.
- 0004: `menu_events_daily(business_id, day, kind in book|seat|view|start, n)` read by members; `site_events_daily(day, kind in
  view|start, n)` read by nobody through the API; `track_menu(p_slug, p_kind)` (book, seat; published menus only) and
  `track_site(p_kind)`, both anon-callable, both capped per day (`app_config.event_caps`), never called from a demo or a preview.
- Tested in the studio stack: `STACK_EXTRA_SQL=1`, `cd studio && npm run test:proposed`.
