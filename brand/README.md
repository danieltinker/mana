# Mana by Halom: brand, product page, print and campaign

Everything for the launch of Mana (מנה), Halom's self-service relief menu. First built 6 Oct 2026; version 2 of
the product page, the privacy and terms pages, the sales playbook and the film composer: 7 Oct 2026 (branch `v2`).
**Version 3 of the product page, 13 Oct 2026 (branch `night/page`): the page opens on the guest view's own table.**
Nothing here has been deployed, pushed, published or sent.

## Version 3: the page is the table
The first screen is the table: one Hebrew line on a scrim, the demo dish alone under the lamp, the two buttons on the
wood. The dish is the real relief, live: `site/index.html` paints its flat photo first (`img/hero-dish.webp`, the Olea
hummus cut out by its matte, placed where the guest view will stand the dish), and `mana.js` adds the guest view in
**hero mode** (`view/?demo=solo&embed=hero&lang=he|en`, see `view/src/hero.js`) as an iframe after the page has painted,
never on Save-Data. The frame reports `{type:'mana-hero', state}` as the lamp comes up, the dish rises and the ring is
drawn; the page tells it `{run:false}` when it scrolls off screen; Enter inside it opens the full demo. A slow phone
(quality tier 4) or a lost context shows the still, never the list. The last stop before the questions, "start free",
is on the table too: the engine's empty name card in a ring of light. Everything between stays on ivory as it was.
The header is one glass pill (the only blur on a phone; it goes solid when ten frames on the first scroll fall under
30 a second, or under `prefers-reduced-transparency`). Type: Hebrew display Frank Ruhl Libre 400, English display
Fraunces (`fonts/fraunces-latin-standard-normal.woff2`, OFL, from `@fontsource-variable/fraunces`; loaded only on the
English page, at idle or when the language switch is hovered or focused). The shared custom properties in
`../design/tokens.css` are copied to `site/tokens.css` at build time and linked by every page. The page carries a
`<meta http-equiv="Content-Security-Policy">` limited to `connect-src 'self' <the Supabase origin from ../config.js>`
and `frame-src 'self'`. **A preview build**, `MANA_PREVIEW=1 node tools/build-site.mjs`, renders the lead form switched
off with a line saying so (a test build can never write to the live backend); the normal build is unchanged.
Stops 2–4 of the plan (the looks, the seat map's sheet, the film on a phone) are not built: on this version only the
hero and "start free" are on the table.

| Path | What |
|---|---|
| Name study, brand kit, campaign kit, sales playbooks | Not in this public repository. They are in the Halom Project on claude.ai: `ventures/mana/name.md`, `brand.md`, `campaign.md`, `sales-playbook.md`, `sales-playbook.he.md` |
| `assets/` | The mark, lockups, icons, avatar (SVG + PNG), `tokens.json`, `_sheet.png` |
| `site/` | The product page: `index.html`, `guide/`, `privacy/`, `terms/`, `mana.css`, `mana.js`, `tokens.css` (copied from `../design/`), `fonts/`, `img/` |
| `print/` | A6 table card, 60 mm sticker, A5 leave-behind (SVG, PDF, previews), `cards/olea/` |
| `social/` | 12-post calendar, three Reel scripts, eight ready frames |
| `tools/` | The builders, a local server and the browser checks (build-time only) |
| `tools/film/` | The film: `compose.mjs`, `film.html`, `timeline.json`, `SCRIPT.md`, `stills.mjs` + `stills.html`, `to-site.mjs`, `proof.mjs`, `clips/` (the real clips), `placeholders/`, `out/` (masters, not in git) |
| `review/v2/` | Contact sheets and numbers for version 2 |

## Publishing the page
`tools/build-site.sh` (at the top of the repository) copies the contents of `site/` to the top of the published site,
next to `studio/`, `view/`, `gen/`, `stock/` and `config.js`: `index.html`, `mana.css`, `mana.js`, `fonts/`, `img/`,
`guide/`, `privacy/`, `terms/`. A push to `main` publishes it. Every URL in the pages is relative, so they work at
`/mana/` and on `danieltinker.github.io/mana/`. The page reads `./config.js` in its head
(the form's address, and `features.scan`: the menu scanner is named in step 1 only when it is `true`) and expects
`./studio/` and `./view/` beside it. All four pages carry `<meta name="robots" content="noindex">`: remove that line in
`tools/build-site.mjs` at launch and rebuild. `og:url` and `og:image` point at `https://halom.io/mana/`.
`img/table-*.jpg` and `img/howto-table-*.jpg` are not used by the pages any more: they stay because the print and social
builders read them, and need not be copied to the host.
Stable addresses for the Google and Facebook sign-in forms: `…/mana/privacy/`, `…/mana/terms/`, and for Facebook's
data-deletion field `…/mana/privacy/#data-deletion`.

## The hero video and the film (drop the files in, then rebuild)
The page looks for these in `site/img/` **when it is built**, so a missing file is never requested:

| File | Used for |
|---|---|
| `hero.mp4` (+ `hero.webm`) | Since version 3 the page's hero is the live relief, not a video: these stay for the owner app's sign-in screen and a later stop of the page (the guest's view, 390 : 844, muted, 8–10 s). Optional English: `hero-en.mp4` / `.webm` |
| `film-16x9.mp4`, `film-9x16.mp4` | "Watch the film": the wide cut, and the tall cut on phones. Optional English: `film-16x9-en.mp4`, `film-9x16-en.mp4` |

After adding or removing any of them run `node tools/build-site.mjs` (it prints what it found; `tools/test-site.mjs`
fails if the page and the files disagree). `--poster-from-video` still takes `img/hero-poster.jpg` from the video's first
frame (`=1.5` for another second).

What is there since 7 Oct 2026 (nothing published; sizes and lengths in `review/v2/film/files.json`). The guest
recordings were made a second time that evening, after the demo's ordering button changed to "להזמנה אונליין" / "Order
online"; every file below comes from the second recordings:

| File | What it is |
|---|---|
| `hero.mp4` | The Hebrew guest view, 390 × 844, 9 s: the viewer lane's Hebrew recording (`tools/film/clips/guest-glide.mp4`) scaled down. The Hebrew page plays it. |
| `hero-en.mp4` | The viewer lane's 9.2 s hero loop (`../view/.shots/v2/hero.mp4`), copied byte for byte. It was recorded in English, so the English page plays it. |
| `hero-poster.jpg`, `hero-poster-480.jpg` | The first frame of `hero.mp4` (one still serves both languages: on the English page the Hebrew frame shows until the English loop fades in). |
| `demo-poster.jpg` | The still behind "Play with it": the guest recording at 1.7 s, the second dish in focus (`node tools/build-site.mjs --demo-still-from-clip`). `tools/posters.mjs` still draws the previous viewer; do not run it for the page stills any more. |
| `film-16x9.mp4`, `film-9x16.mp4`, `film-16x9-en.mp4`, `film-9x16-en.mp4` | The 41 s film, 1920 × 1080 and 1080 × 1920, Hebrew and English captions, each under 8 MB. Made by `tools/film/compose.mjs --scale 1 --lang both`, then `tools/film/to-site.mjs`. |

## Rebuilding
```
npm install                      # fonts, opentype.js, qrcode (dev only)
node tools/build-assets.mjs && node tools/render.mjs     # identity SVG + PNG
node tools/posters.mjs           # the hero and demo stills from the real viewer (software WebGL; about 20 s); `film` adds the film's stills
node tools/build-site.mjs        # site/index.html, guide/, privacy/, terms/
node tools/og.mjs                # site/img/og.png from the page itself
node tools/build-print.mjs       # print/*  (add --slug --he --en for a real restaurant's card)
node tools/build-social.mjs      # social/frames/*
node tools/test-site.mjs         # the browser checks; numbers into review/v2/metrics.json, screenshots into .shots-raw/
node tools/sheets.mjs            # review/v2/*: contact sheets, the states, before and after
node tools/film/stills.mjs       # the film's two designed stills (printed menu, table card) into tools/film/clips/; reads the QR code back
node tools/film/compose.mjs      # the film, both cuts, half size; `--scale 1 --lang both` is the real thing (see tools/film/SCRIPT.md)
node tools/film/to-site.mjs      # the full-size cuts → site/img/film-*.mp4, each at most 8 MB (`--lang en` for English); then build-site
node tools/film/to-site.mjs --hero --hero-en <the English loop>   # site/img/hero.mp4 from clips/guest-glide.mp4, hero-en.mp4 copied; each at most 2.5 MB
node tools/build-site.mjs --poster-from-video --demo-still-from-clip   # ... and the hero poster and the "Play with it" still from those recordings
node tools/film/proof.mjs        # review/v2/film/: one frame per shot from the films on the page, sizes, and the QR code read from the film
node tools/serve.mjs [--scan]    # http://127.0.0.1:8791/mana/  (real viewer, stubbed leads function; --scan turns the scanner flag on)
```
`MANA_VIEW=<folder>` chooses the viewer that the server, the checks and the sheets load (default `../view`; while that
folder is being rebuilt, build the site with `bash tools/build-site.sh` and use `_site/view`).
The checks for the hero video and the film make their own small test clips with ffmpeg (`tools/test-media.mjs`, into
`.scratch/media/`) and overlay them through the local server; they never touch `site/`. Chromium here plays WebM, not H.264.
Playwright and sharp come from `/opt/npm-tools`; Chromium from `/opt/pw-browsers`; ffmpeg from `/usr/bin`.

## Third-party material
- Fonts: Frank Ruhl Libre, IBM Plex Sans Hebrew, IBM Plex Sans, Fraunces, all SIL OFL 1.1 (licence texts in `site/fonts/`).
- Two phone photos (`site/img/howto-photo.jpg`, `guide-cutoff.jpg`) from based.cooking, public domain (Unlicense),
  commit `9d4a31a`, as recorded in the generator's test manifest.
- Table textures and the Olea demo pictures come from `../view` (Halom's own; the Olea pictures are computer-made
  samples and are labelled "Demo dishes · made with AI" wherever they appear). `site/img/hero-dish.webp` is the Olea
  hummus cut out by its matte; `site/img/table-oak.jpg` is `../view/themes/oak.jpg`, darkened. The film's placeholder thumbnails are the eight starter pictures
  of `../stock` (Halom's own).
