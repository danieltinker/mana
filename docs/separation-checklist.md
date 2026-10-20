# The separation checklist (D34)

Mana is standalone-ready: this repository holds everything Mana needs, and for now it stays on halom.io's domain and
Vercel proxy. This is the list of what Mana depends on **outside** the repository, so the day it leaves halom.io is a
known list of steps, not a search. Read against `danieltinker/halom` `public/vercel.json` on 16 Oct 2026 (its last
change: `02f37fd`, 13 Oct). Keep it current: a change that adds an outside dependency adds a row here.

## Outside the repository

| # | Dependency | Where it lives | What Mana uses it for | On separation day |
|---|---|---|---|---|
| 1 | **halom.io's proxy routes** | `danieltinker/halom`, `public/vercel.json` → `rewrites` | `/mana/(.*)` → `https://danieltinker.github.io/mana/$1` (the product page, owner app, back office, guest menu, generator, stock); `/m/:slug` and `/m/:slug/` → `https://danieltinker.github.io/mana/view/index.html` (the short link every QR code carries) | The new host serves the same two routes (`tools/serve-site.mjs` is the reference). halom.io keeps `/m/:slug` forwarding for as long as printed QR codes exist |
| 2 | halom.io's redirects for Mana | the same file → `redirects` | `/mana` → `/mana/`; `/projects/menus` and `/projects/menus/:path*` → `/mana/…` (links from before 13 Oct); and the first rule, every path on `www.halom.io` → `https://halom.io/:path*` (permanent), which also carries `www.halom.io/m/<name>` and `www.halom.io/mana/` | Point them at the new address, or keep them; the new domain needs its own `www` rule |
| 3 | halom.io's response headers | the same file → `headers`, source `/(.*)` | Every Mana page on halom.io gets `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy: camera=(), microphone=(), geolocation=()`. So Mana pages there cannot use the live camera, microphone or location APIs; photo inputs (`<input capture>`) still work. `tools/serve-site.mjs` sends the same three | The new host sets its own; decide then whether the owner app needs the live camera |
| 4 | **The halom.io domain** | its registrar and DNS | The address of every page and every short link: `https://halom.io/m/<name>` is printed on table cards | A domain of Mana's own. Printed codes keep the old address: halom.io must keep forwarding `/m/*` (row 1) |
| 5 | **The Vercel project** behind halom.io | Vercel, deployed only by Daniel (`bash ~/Documents/halom/tools/deploy.sh`) | Runs rows 1–3 | Untouched by Mana's own deploys; the forwarding in row 4 stays there |
| 6 | GitHub Pages for `danieltinker/mana` | repository settings: Pages (Source "GitHub Actions", custom domain empty); the `github-pages` environment (Daniel approves every deploy); the `main` ruleset | Hosts the built site that halom.io proxies | Either a custom domain on Pages or another static host; the build (`tools/build-site.sh`) does not change |
| 7 | **The mail sender** | not set up yet (D27). Supabase Auth's custom SMTP, with a sender on halom.io; its SPF and DKIM records in halom.io's DNS | Sign-up confirmation ("Confirm email", which `require_confirmed_email` relies on, `supabase/README.md`), password mails, later notifications (F15) | A sender on Mana's own domain; Auth's SMTP settings in each Supabase project |
| 8 | **The WhatsApp support number** | Halom's number, in eleven places outside the tests (as a `wa.me` link or written out): `apps/studio/src/product.ts`, `brand/tools/build-site.mjs` (`WA`), `brand/src/land/form.js`, `brand/site/mana.js`, `brand/site/index.html`, `brand/site/privacy/`, `brand/site/terms/`, `brand/tools/leave-behind.mjs`, `brand/print/src/leave-behind.html`, `API.md`, `BACKEND.md`; and in the setting `support.whatsapp` (`config/demo.js`, the local config; production's at the cutover) | "Message us" in the owner app, the product page, privacy and terms; the printed leave-behind | v2 reads `support.whatsapp`; a number of Mana's own if it changes. Printed leave-behinds keep the old number |
| 8a | **Printed and baked-in addresses** | Table cards (`brand/tools/build-print.mjs`: each card's QR code is `https://halom.io/m/<slug>`); the leave-behind (`brand/tools/leave-behind.mjs`, `brand/print/src/leave-behind.html`: a QR code to `https://halom.io/mana/` and "halom.io/mana" in the text); the social frames (`brand/tools/build-social.mjs`, `brand/social/src/frames-en.html`, `frames-he.html`: "halom.io/mana"); the films' end cards (`brand/tools/film/film.html`: "halom.io/mana"; their QR code is checked to say `https://halom.io/mana/view/?demo=olea`, `brand/tools/film/stills.mjs`, `SCRIPT.md`) | Everything already printed, posted or rendered into a film carries halom.io | They cannot change: halom.io keeps forwarding `/m/*` and `/mana/*` for as long as they are out there. New prints, posts and films take the new address |
| 9 | Supabase `halom-studio` (`zemdhczqlhkabfwxccqq`) | Supabase, shared with Shevatim | Production's database, v1, until the cutover (ADR-005) | Mana leaves it at the cutover; nothing of Mana stays there |
| 10 | Supabase `mana` (`hhmjcudeiiycwqqklksc`) | Supabase dashboard | The build and demo database (D35), production's after the cutover. Settings that are not in the repository: Auth (Confirm email, SMTP, Site URL and redirect URLs, providers), edge function secrets, the advisors | Already Mana's own. Its Site URL and redirect URLs name the new domain |
| 11 | The scanner's model provider | Anthropic, Halom's account: `ANTHROPIC_API_KEY` and `ANTHROPIC_WORKSPACE_ID`, secrets of the `menus-ai` function (never in the repository) | Reading a photographed menu (`functions/menus-ai`) | An account of Mana's own, or kept; the privacy page names its terms |
| 12 | Sign-in providers (Google, Apple, Facebook) | none turned on (`auth.providers: []`) | Owner sign-in buttons, when turned on | Their consoles name redirect URLs on the domain of the day |
| 13 | Legal text | `brand/tools/build-site.mjs` writes privacy and terms; they state "pages served by GitHub Pages through halom.io on Vercel" and "hello@halom.io cannot receive mail yet" | What the law asks us to tell people | Rewritten for the new hosting; Rami decides the words, Hebrew needs a native read |
| 14 | Earlier copies | `danieltinker/halom-projects` (`projects/menus/`, served before 13 Oct); this repository's `pages` branch (the fallback, Pages → "Deploy from a branch") | Nothing live; a fallback | Archive |
| 15 | Daniel's Mac checkout | `~/Documents/mana`, kept in sync (D30) | Where Daniel runs `npm run demo` and reviews branches | Unchanged |
| 16 | Development only | GoTrue and PostgREST releases on GitHub (`sim/stack/binaries.mjs`, pinned SHA-256s); PostgreSQL 16; Chromium | The simulator's stack and the browser tests | Unchanged; never at run time |

The brand link "Mana by Halom" (`https://halom.io` in the product page, the guide and the site kit) is the relationship
between the two, not a dependency: it stays.

## Where the code names halom.io or halom-studio directly

Audited on this branch (`git grep` for `halom.io` and `zemdhczqlhkabfwxccqq`, tests and stubs left out). The v1
behaviour is unchanged; the right-hand column says what the v2 code should do instead. Two settings carry F01's
addresses: `siteBase` (the product's public address) and `support.whatsapp`. `config/demo.js` and the local config have
them now; production's `config.js` stays byte for byte as it is, and the cutover adds `siteBase:
'https://halom.io/mana/'` and the same number to it (`docs/environments.md`). v2 code reads both from the config and
never falls back to a halom.io address outside production.

| Where | What it names | Kind | v2 should |
|---|---|---|---|
| `config.js` lines 3, 5 | halom-studio's URL; `https://halom.io/m/` | Production's settings | Stay: this is the one place they belong |
| `apps/studio/src/lib/api.ts:14` | `shortBase: 'https://halom.io/m/'` as the default when the config has none | Fallback | No default: a config without `shortBase` is an error the app shows |
| `apps/studio/src/lib/links.ts:5` | `cfg.shortBase \|\| 'https://halom.io/m/'` | Fallback | `cfg.shortBase` only |
| `apps/studio/src/screens/setup.tsx:84, 93` | The literal text `halom.io/m/` before the slug the owner chooses | Copy | `shortText()` (the config's `shortBase` without its scheme), so a demo shows its own address |
| `apps/studio/src/product.ts:7–8` | `site: 'halom.io'`; the WhatsApp link | Product facts | `siteBase` and `support.whatsapp` from the config |
| `apps/studio/src/lib/slug.ts:1` | `halom.io/m/<slug>` in a comment | Comment | Say "the short link" |
| `apps/ops/src/model.js:73` | `https://halom.io/m/` when `shortBase` is missing or not http(s) | Fallback | The config's `shortBase`; a bad config is shown as an error, never replaced by production's links. (Demo and local set a valid `shortBase`, so today the fallback is never reached there) |
| `apps/ops/src/leads.jsx:97` | "Enquiries sent from halom.io and from the Mana page" | Copy | Words without the domain |
| `apps/view/src/i18n.js:4`, `apps/view/src/seat/i18n.js:2` | `PRODUCT.url = 'https://halom.io/mana/'` (the "made with Mana" link) | Product fact | `siteBase` |
| `apps/view/index.html:13` | Under `/m/<slug>` the menu sets `<base href="/mana/view/">` | A path, not a host | Stays while the routes keep `/mana/` and `/m/`; if separation changes the prefix, this and the check in `tools/build-site.sh` change together |
| `brand/site/index.html`, `guide/`, `privacy/`, `terms/` line 11–12 | `connect-src … https://zemdhczqlhkabfwxccqq.supabase.co` | CSP, written by `brand/tools/build-site.mjs` from `config.js` | Demo and local builds already retarget it (`tools/site-env.mjs`); the product page's build reads the environment's config when it is rebuilt |
| `apps/ops/src/index.html:11` | `connect-src 'self' https://*.supabase.co` (any Supabase project, halom-studio included; no `wss:` for Realtime) | CSP | Demo and local builds already narrow it to the environment's origin over https and wss (`tools/site-env.mjs`); the cutover does the same for production's |
| `brand/site/index.html:16–17`, `guide/index.html:16–17` (`brand/tools/build-site.mjs:25`, `LIVE`) | `og:url`, `og:image` on `https://halom.io/mana/` | Absolute by necessity (link previews) | `siteBase` |
| `brand/tools/land.mjs:46` | The product page's QR code: `https://halom.io/mana/view/?demo=olea` | Printed into the page | `siteBase` |
| `brand/tools/build-site.mjs:215–216, 270` | Hosting facts in privacy and terms | Legal copy | Row 13 above |
| `brand/tools/build-print.mjs:7, 22, 26` | Table cards: `--base https://halom.io/m/` by default, `https://halom.io/m/your-name` on a sample card | Print tool | `shortBase` as the default base |
| `brand/tools/leave-behind.mjs:5, 23, 25`, `brand/print/src/leave-behind.html:51, 53, 70, 72` | `PAGE = 'https://halom.io/mana/'` (its QR code), "halom.io/mana" and the number in the text | Print tool and its output | `siteBase` and `support.whatsapp` |
| `brand/tools/build-social.mjs:26`, `brand/social/src/frames-en.html:34`, `frames-he.html:34` | "halom.io/mana" in the call to action | Social frames | `siteBase` |
| `brand/tools/film/film.html:174`, `brand/tools/film/stills.mjs:4, 18`, `brand/tools/film/SCRIPT.md:22, 40` | "halom.io/mana" on the end card; the QR code the stills must decode to (`https://halom.io/mana/view/?demo=olea`) | Film tools | `siteBase`, for the next cut; rendered films keep theirs (row 8a) |
| `site-kit/build.mjs:8, 36, 38`, `site-kit/template.html:123`, `site-kit/README.md` | Default menu link `https://halom.io/m/<slug>`, the demo's seat link, "Menu by" | Defaults | `shortBase` and `siteBase` as inputs |
| `seating/layout.v1.schema.json:3`, `seating/booking_request.v1.schema.json:3` | `$id` under `https://halom.io/mana/seating/` | Schema identifiers (never fetched) | An identifier on Mana's own domain, or a URN; not urgent |
| `db/0001_core.sql:12–13` | halom-studio's storage address; `short_base` | v1 migration | Nothing: v2's `app_config.public_base` is set per environment (`supabase/README.md`) and v2 has no `short_base` |
| `tools/check-site.mjs` (`LINK_HOSTS`, `isSite` and its header) | `halom.io` on the link allow-list; `https://halom.io/mana/` counted as the site itself | Build check | Read the site's own address from `siteBase` |
| `tools/env.mjs` (`PRODUCTION`), `tools/check-config.mjs` | halom-studio's URL and `https://halom.io/m/` | The guard's pins | Stay: the cutover changes them on purpose, with `config.js` |

Tests, stubs and local servers (`apps/*/test`, `apps/view/tools/serve.mjs`, `brand/tools/serve.mjs`, `site-kit/test`)
use `halom.io` addresses as fixtures or copy halom.io's routes; they need no change.
