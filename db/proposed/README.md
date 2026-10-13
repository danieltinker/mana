# Proposed SQL (never applied from a session)

Daniel applies these to the hosted project by hand, in order, after reading them. Until then the owner app sends
`book_url` only when `config.features.bookUrl` is on, and nothing calls `track_menu` / `track_site`.

| File | What | Must be applied before |
|---|---|---|
| `0003_templates.sql` | `businesses.book_url`, `menus.template`, `build_snapshot` carries `business.bookUrl` and `theme.template` | the branch's owner app reaches `main` with `features.bookUrl: true` |
| `0004_events.sql` | `menu_events_daily` (book, seat), `site_events_daily` (view, start), `track_menu`, `track_site`, daily caps | the guest menu's Book button and the product page start counting |
| `0006_table_clock.sql` | the table clock (`seating/timers.mjs`): `table_clock_settings` (default frame, ending warning, grace, extension), `table_clock_overrides` (per table), `seatings` (party, seated_at, minutes, extended, ended_at, ended_how; one open per table), `end_overdue_seatings`; RLS: the venue's owner only, nothing for guests | the host board (`view/host/`) leaves the demo and keeps its floor in Supabase |

Test: `STACK_EXTRA_SQL=1` makes `studio/test/stack/start.mjs` load every file here after `db/00*.sql`;
`cd studio && npm run test:proposed` runs the smoke test (sign up → PATCH both fields → publish → `open_menu` carries both;
`track_menu` counts and caps).
