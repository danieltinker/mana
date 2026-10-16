# menus-ai (v2): the menu scanner for the clean schema

The v2 port of the scanner (ADR-006), for the Supabase project `mana` and the local stack. Production
(halom.io/mana, project `halom-studio`) keeps running the v1 copy in `functions/menus-ai`, which this folder does not
touch.

## What it does

```
owner app ──upload──► menu-private/<venue>/imports/<import id>/…   (the owner's own photos or Wolt screenshots;
                                                                   the app chooses the import id)
          ──create_import(p_import_id, …)──► menu_imports (uploaded)
          ──POST menus-ai {action, import_id}──►
               1. configured? (no ANTHROPIC_API_KEY: not_configured, nothing claimed)
               2. the import's source matches the mode (else source_mismatch, nothing claimed)
               3. claim_import_scan with the owner's own token: membership, the daily cap, uploaded|failed → parsing
               4. the images, read with the service role (JPEG, PNG, WebP or GIF; at most 5 MB of base64 each)
               5. the model: one call per printed page; screenshots in runs of 5, each run starting with the
                  previous run's last screenshot
               6. @mana/import: each answer → a reading (readScanReply) → one draft (scanDraft) → validateSaveDraft
               7. save_import_draft as the service role → parsed, exceptions computed by the database
          ◄── { ok, importId, counts, exceptions, notes, dropped, calls, usage }   or   { ok: false, code }
```

Any failure after the claim marks the import `failed` with a code of `SCAN_ERROR_CODES` (`image_unreadable`,
`model_failed`, `draft_invalid`, `timeout`) and saves nothing; the owner can read it again (`failed → parsing`). The
function writes nothing else. It never fetches a Wolt address (D33): it reads only images the owner uploaded.

| Action | Who | Answer |
|---|---|---|
| `status` | anyone | `{ ok, configured }` |
| `scan_menu`, `wolt_screenshots` + `import_id`, optional `stock` | the owner or a manager, with their own token | the draft's counts, exceptions and the reader's notes, or a code |
| `purge` + optional `import_id` | the service role only (a schedule) | `{ ok, purged, failed }`: images of imports applied, discarded or failed more than `import_raw_retention_days` ago, deleted through the Storage API; `raw_paths` emptied, `raw_purged_at` set |

Codes besides the scan errors: `bad_request`, `not_allowed`, `not_configured`, `source_mismatch`, and the claim's
own (`import_unknown`, `not_scannable`, `import_busy`, `import_closed`, `rate_limited`), passed through.

## Files

| File | What |
|---|---|
| `index.ts` | The Deno entry: reads the environment, nothing else |
| `handler.ts` | Routing, CORS, the request's checks |
| `read.ts` | The read flow above; `plan` (which images go in which call) |
| `anthropic.ts` | The one paid call (Messages API, not streamed), v1's reading of API refusals, image sniffing, base64 |
| `rest.ts` | The project's PostgREST and Storage calls |
| `purge.ts` | The `purge` mode |
| `deps.ts` | What the runtime gives the modules (so Node tests can mock it) |
| `deno.json` | Maps `@mana/contracts` and `@mana/import` to the packages' sources |

The prompt and the answer → draft mapping are in `packages/import/src/scan.ts`, shared and tested there.

## Tests

`cd supabase && npm run test:functions` (Node, with every outside call mocked: the project and the Messages API are
routes of a fake `fetch`; no network, no paid call) and `npm run check:functions` (types, all modules but
`index.ts`). The same test file also passed under Deno 2.5.6 (`deno test`), and `deno check` passed on the whole
module graph with this folder's import map, on 16 Oct 2026; `jsr.io` was not reachable from that machine, so the
`jsr:@supabase/functions-js` type import of `index.ts` was the one line not checked.

## Deploying it to `mana` (Daniel's gate)

Nothing here is deployed by an agent. What it needs, in order:

1. **The backend lane's migration on `mana`** (ADR-008, `supabase/migrations/20261016120000_phase1.sql`):
   `create_import`, `claim_import_scan`, `save_import_draft`, `menu_imports.raw_purged_at`, and the service role's
   column grants (`status`, `error_code`, `raw_paths`, `raw_purged_at`). Until then the claim answers an error and
   nothing is read.
2. **Daniel's yes on paid calls**, then the secret: `supabase secrets set ANTHROPIC_API_KEY=… --project-ref <mana>`
   (and `ANTHROPIC_WORKSPACE_ID=wrkspc_…` if the key is not tied to one workspace, as v1 learned on 11 Oct 2026).
   Optional: `MANA_SCAN_MODEL` (default `claude-sonnet-5-5`, as v1). `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` are the platform's own. Without the key the function answers `not_configured`, and the
   owner app offers paste and Wolt text, which cost nothing.
3. **Deploy**, from the repository root: `supabase functions deploy menus-ai --project-ref <mana> --use-api`. The
   modules import `packages/import` and `packages/contracts` from outside `supabase/`; Supabase's CLI supports that
   with `--use-api` from version 2.13.3 ([changelog](https://supabase.com/changelog/33613-deploy-edge-functions-from-cli-without-needing-docker-import-files-outside-of-supabase-directory)).
   Check once on `mana` that the bundle resolves `deno.json`'s imports. As for v1, the gate is the claim (with the
   caller's own token), not the platform's `verify_jwt` flag.
4. **The purge schedule** (optional, later): a daily `POST {action: "purge"}` with the service role key (for
   example pg_cron with pg_net, the key in Vault). Until it runs, the images stay in `menu-private`, which only
   members who edit and Halom staff can read.
5. **One check on `mana` with demo data** (an invented menu photographed or screenshotted, never a real venue's):
   one scan per mode, then the import preview.

Deploy only to `mana`. Never to `halom-studio`, where `menus-ai` is the v1 function production uses.

## What one scan costs, in tokens

Measured from the prompt sizes on 16 Oct 2026; the API's own count is in each answer (`usage`) and in the
function's log line (`in`, `out`, `calls`).

- **Instructions** (the system line and the prompt, the same on every call): 3,600–4,000 characters, mostly English
  with JSON examples and a few Hebrew words, about 1,000–1,300 tokens. A stock list of 60 pictures adds about
  1,700 characters (about 500 tokens).
- **Images**: Anthropic counts `⌈width / 28⌉ × ⌈height / 28⌉` visual tokens per image, and the default model, a
  Claude 4.7-or-later model, reads up to 2576 px on the long edge and 4,784 visual tokens per image (larger images
  are scaled down) ([vision guide](https://platform.claude.com/docs/en/build-with-claude/vision)). A phone screenshot
  of 1170 × 2532 px is 3,822 tokens; a menu photo the owner app shrinks to 2400 px on its long side is scaled down to
  the 4,784 cap.
- **The answer**: one JSON line per section, dish, group and option. The synthetic answers in the tests average 106
  characters per bilingual dish line and 64 characters per line of a Wolt answer, roughly 30–45 and 20–25 tokens. Each
  call's answer is capped at 16,000 tokens (`MAX_TOKENS`); a longer one is cut, kept, and noted (`page_truncated`).

So one printed page is about 6,000 input tokens plus about 35 output tokens per dish. Twenty Wolt screenshots are
five calls reading 24 images (the runs overlap by one): about 92,000 visual tokens and 6,000 tokens of instructions,
plus the answer. Prices per token are on Anthropic's pricing page; this README gives no amount in shekels or
dollars. The number of reads per venue and day is `app_config.import_caps.scans_per_venue_day` (10 by default,
ADR-008).

## Known limits (phase 1)

- **No dish photos yet.** ADR-006 lets the scanner crop dish photos out of screenshots when the owner confirmed their
  rights. That needs an image step this function does not have; every dish it reads has `photo: null`, so it never
  stores a photo, with rights or without.
- **All or nothing.** A page that fails fails the whole import (nothing half-read is saved); an answer that is only
  cut short is kept and noted.
- **One answer, not a stream.** The owner app waits for the whole read (at most 138 s, `SCAN_DEADLINE_MS`; the
  platform stops a worker at 150 s, as v1 measured); the read goes on if the phone leaves (`EdgeRuntime.waitUntil`).
- **HEIC and AVIF** are accepted by the bucket but not read by the API: the owner app converts photos to JPEG before
  uploading (v1 shrinks them already).
