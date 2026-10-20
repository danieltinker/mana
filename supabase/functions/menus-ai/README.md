# menus-ai (v2): the menu scanner for the clean schema

The v2 port of the scanner (ADR-006), for the Supabase project `mana` and the local stack. Production
(halom.io/mana, project `halom-studio`) keeps running the v1 copy in `functions/menus-ai`, which this folder does not
touch.

## What it does

```
owner app ──upload──► menu-private/<venue>/imports/<import id>/<file>   (the owner's own photos or Wolt screenshots;
                                                                       the app chooses the import id)
          ──create_import(p_import_id, …)──► menu_imports (uploaded)
          ──POST menus-ai {action, import_id}──►
               1. configured? (no ANTHROPIC_API_KEY: not_configured, nothing claimed)
               2. claim_import_scan(p_import, p_mode) with the owner's own token: membership, the image caps, the
                  import's source against the mode, uploaded|failed → parsing. Nothing is read before it.
               3. the claim's paths checked, all of them, before any download: each exactly
                  <claimed venue>/imports/<this import>/<name> (name: letters, digits, ".", "_", "-"; not "." or "..");
                  the claim's import is the one asked; 1 to IMPORT_IMAGES_MAX images (scan 8, wolt_screenshots 24)
               4. the images, read with the owner's own token (Storage's row-level security decides), at most
                  MAX_IMAGE_BYTES (3.75 MB) each, refused by their declared size or while they stream, JPEG, PNG,
                  WebP or GIF
               5. the model: one call per printed page; screenshots in runs of 5, each run starting with the
                  previous run's last screenshot; at most 4 calls at once; the first refusal cancels the rest
               6. @mana/import: each answer → a reading (readScanReply) → one draft (scanDraft) → validateSaveDraft
               7. save_import_draft(p_import, p_draft, p_notes) as the service role → parsed, the reader's notes
                  stored beside the draft, exceptions computed by the database
          ◄── { ok, importId, counts, exceptions, notes, dropped, calls, usage }   or   { ok: false, code }
```

Any failure after the claim marks the import `failed` with a code of `SCAN_ERROR_CODES` (`image_unreadable`,
`model_failed`, `draft_invalid`, `timeout`) and saves nothing; the owner can read it again (`failed → parsing`). The
mark is conditional (only while the import is still `parsing`) and its result is in the log line (`marked`). At the
deadline (138 s, `SCAN_DEADLINE_MS`; the platform stops a worker at 150 s) every call in flight is cancelled and the
import is marked `timeout`: it is never left `parsing`. Nothing of a read runs after its answer. The function writes
nothing else. It never fetches a Wolt address (D33): it reads only images the owner uploaded.

| Action | Who | Answer |
|---|---|---|
| `status` | anyone | `{ ok, configured }` |
| `scan_menu`, `wolt_screenshots` + `import_id`, optional `stock` | the owner or a manager, with their own token | the draft's counts, exceptions and the reader's notes, or a code |
| `purge` + optional `import_id` | the service role only (a schedule) | `{ ok, purged, failed, kept, more }`: see below |

Codes besides the scan errors: `bad_request`, `not_allowed`, `not_configured`, `too_big` (a request body past 64,000
bytes, however its length is declared), `failed` (a 500, with the CORS headers like every answer); after a claim:
`paths_invalid`, `source_mismatch`, `too_many_images` (each marks the import `image_unreadable`); and the claim's own
(`import_unknown`, `not_scannable`, `import_busy`, `import_closed`, `rate_limited` with the `cap` reached), passed
through.

**Purge.** The imports to purge are the ones `list_purgeable_imports` names (the database's rule, oldest first, at
most 500 a page). Each one's images are deleted through the Storage API, only files of the import's own folder
(`<venue_id>/imports/<id>/…`; a row with any other path is left as it is and reported in `failed`); then the import
records it (`raw_paths` emptied, `raw_purged_at` set) only on a row not purged and not being read (the table's guard
refuses anything else). The retention holds whatever the list says: an import goes only once it finished
(`applied_at`, else `updated_at`, read from `menu_imports`) more than `import_raw_retention_days` ago (30 by default),
the daily job's measure for pasted text; one the list names sooner is counted in `kept` and left for a later run. The
list has no cursor: one call reads it again while a full page purged something (what was purged leaves it), at most 4
times, and answers `more` when a next call would find more. A row that keeps failing is tried once per call and never
holds back the rows after it on its page; a whole page of such rows holds back what is behind it until they leave
the list (an open item for the backend: a cursor).

## Files

| File | What |
|---|---|
| `index.ts` | The Deno entry: reads the environment, nothing else |
| `handler.ts` | Routing, CORS, the request's checks (a capped body reader) |
| `read.ts` | The read flow above; `plan` (which images go in which call), `pathsOk`, `pool` |
| `anthropic.ts` | The one paid call (Messages API, not streamed), v1's reading of API refusals, image sniffing, base64 |
| `rest.ts` | The project's PostgREST and Storage calls (capped downloads) |
| `purge.ts` | The `purge` mode |
| `deps.ts` | What the runtime gives the modules (so Node tests can mock it) |
| `deno.json` | Maps `@mana/contracts` and `@mana/import` to the packages' sources |
| `types/deno-entry.d.ts`, `tsconfig.entry.json` | The few Deno names `index.ts` uses, so Node's TypeScript checks the entry too |

The prompt and the answer → draft mapping are in `packages/import/src/scan.ts`, shared and tested there.

## Tests

`cd supabase && npm run test:functions` (Node, with every outside call mocked: the project and the Messages API are
routes of a fake `fetch`; no network, no paid call) and `npm run check:functions` (types: every module and test, then
`index.ts` against `types/deno-entry.d.ts`; no Deno needed). On 16 Oct 2026 the same test file also passed under Deno
2.5.6 (`deno test`) and `deno check` passed on the whole module graph with this folder's import map; `jsr.io` was not
reachable from that machine, so the pinned `jsr:@supabase/functions-js@2.117.2/edge-runtime.d.ts` type import (the
JSR release of the npm version of that number, 25 Sep 2026) was the one line Deno did not check.

## Deploying it to `mana` (Daniel's gate)

Nothing here is deployed by an agent. What it needs, in order:

1. **The backend lane's migration on `mana`** (ADR-008): `create_import`, `claim_import_scan(p_import, p_mode)`,
   `save_import_draft(p_import, p_draft, p_notes)`, `list_purgeable_imports(p_limit)`, `menu_imports.raw_purged_at`
   and `notes`, the `menu-private` read policy for members (`can_see_records`), and the service role's column grants
   (`status`, `error_code`, `raw_paths`, `raw_purged_at`). Until then the claim answers an error and nothing is read.
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
   example pg_cron with pg_net, the key in Vault), called again while `more` is true. Until it runs, the images stay
   in `menu-private`, which only members who edit and Halom staff can read.
5. **One check on `mana` with demo data** (an invented menu photographed or screenshotted, never a real venue's):
   one scan per mode, then the import preview.

Deploy only to `mana`. Never to `halom-studio`, where `menus-ai` is the v1 function production uses.

## What one scan costs, in tokens

Measured from the prompt sizes on 16 Oct 2026; the API's own count is in each answer (`usage`) and in the
function's log line (`in`, `out`, `calls`). Token counts from characters are estimates (about 3.5 to 4 characters per
token for this mostly English text); the image counts follow Anthropic's published rule.

- **Instructions** (the system line and the prompt, the same on every call): 3,847–4,195 characters, mostly English
  with JSON examples and a few Hebrew words, about 1,000–1,300 tokens. The stock list adds at most 6,000 characters
  (`STOCK_LIST_MAX`: at most 160 pictures, labels cut to 60 characters, the entries past 6,000 characters left out),
  so one call's instructions are at most 10,314 characters (a test computes it from the code). That is about 3,000
  tokens at this text's 3.5–4 characters per token; Hebrew labels take more tokens per character, so the table
  below keeps about 5,500 per call as a margin.
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
plus the answer.

**The worst case one read can cost** (the caps in code: `IMPORT_IMAGES_MAX`, `plan`, `MAX_TOKENS`,
`STOCK_LIST_MAX`; every image at the 4,784-token cap; every answer at its 16,000-token cap):

| Source | Calls | Input tokens per call | Input tokens | Output tokens |
|---|---|---|---|---|
| `scan` (8 printed pages) | 8 | 4,784 + about 5,500 | about 82,000 | 128,000 |
| `wolt_screenshots` (24 screenshots) | 6 (runs of 5 sharing one) | 5 × 4,784 + about 5,500 | about 177,000 | 96,000 |

A read that fails part way stops at the first refusal (the calls in flight are cancelled, no other starts), so it
costs less. Every read needs a claim, and every claim that succeeds (a claim again after a failed read too) charges
its images against three caps in `app_config.import_caps`: the venue's local day (`scan_images_per_venue_day`, 60 by
default), the person's day (`scan_images_per_user_day`, 120) and all venues' day (`scan_images_per_day`, 1,000); a
claim past one answers `rate_limited` with the `cap` reached. So a venue's day reads at most 60 images: at most the
`scan` line above seven and a half times. Prices per token are on Anthropic's pricing page; this README gives no
amount in shekels or dollars.

## Known limits (phase 1)

- **No dish photos yet.** ADR-006 lets the scanner crop dish photos out of screenshots when the owner confirmed their
  rights. That needs an image step this function does not have; every dish it reads has `photo: null`, so it never
  stores a photo, with rights or without.
- **All or nothing.** A page that fails fails the whole import (nothing half-read is saved); an answer that is only
  cut short is kept and noted.
- **One answer, not a stream.** The owner app waits for the whole read (at most 138 s); the read goes on if the phone
  leaves (`EdgeRuntime.waitUntil`).
- **HEIC and AVIF** are accepted by the bucket but not read by the API: the owner app converts photos to JPEG before
  uploading (v1 shrinks them already).
