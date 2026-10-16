# Mana by Halom: brand, product page, print and campaign

Everything for the launch of Mana (מנה), Halom's self-service relief menu. First built 6 Oct 2026; version 2 of
the product page, the privacy and terms pages, the sales playbook and the film composer: 7 Oct 2026 (branch `v2`).
**Version 3 of the product page, 13 Oct 2026 (branch `night/page`): the page opens on the guest view's own table.**
Nothing here has been deployed, pushed, published or sent.

## Version 3: the page is the table
The page is the guest view's own table from the first word to "start free": one fixed layer of oak (`img/table-oak.jpg`,
`../apps/view/themes/oak.jpg` darkened to the table's black at the edges) and one lamp, a radial pool painted once into its
own fixed layer and moved with `translate3d` as the reader scrolls (`mana.js`; its anchors are the stops' objects, it dims
to 80% at the reels and goes out as the ivory tail comes up). The questions, the form and the footer sit on ivory.
Five stops, each with its words in the guest view's dark glass card (tint only on a phone, blur on wide screens) and its
object on the wood:
1. **The hero**: the Hebrew line on a scrim, the demo dish alone under the lamp. The dish is the real relief, live:
   `index.html` paints its flat photo first (`img/hero-dish.webp`, the Olea hummus cut out by its matte, placed where the
   guest view will stand the dish), and `mana.js` adds the guest view in **hero mode** (`view/?demo=solo&embed=hero&lang=he|en`,
   see `apps/view/src/hero.js`) as an iframe after the page has painted, never on Save-Data. The frame reports
   `{type:'mana-hero', state}` as the lamp comes up, the dish rises and the ring is drawn; the page tells it `{run:false}`
   when it scrolls off screen; Enter inside it opens the full demo; `?debug=1` on the page reaches the frame. A slow phone
   (quality tier 4) or a lost context shows the still, never the list.
2. **Your menu, your look**: three of the looks' stills (`img/looks/`, copied from `../apps/view/looks/img/`) as cards that
   slide apart once; each opens `view/?demo=olea&template=<id>`.
3. **Your seat**: a cream sheet in the table's perspective with the Olea room's plan (`../seating/fixtures/olea.layout.json`,
   drawn at build time); its far half unfolds once, one table lights; a link to `view/seat/?demo=olea`.
4. **Your site, your reels**: a phone standing on the table with its reflection, playing `img/hero.mp4` once when it is on
   screen (set from script: no source, no poster, no autoplay in the HTML; `preload="none"`).
5. **Start free**: the engine's empty name card in a ring of light.
Generated demo food carries the label "Demo dishes · made with AI" wherever it appears. Between the stops: three steps,
try it, the numbers and the benefits, in glass cards. The header is one glass pill (it goes solid when ten frames on the
first scroll fall under 30 a second, or under `prefers-reduced-transparency`). Type: Hebrew display Frank Ruhl Libre 400,
English display Fraunces (`fonts/fraunces-latin-standard-normal.woff2`, OFL, from `@fontsource-variable/fraunces`; loaded
only on the English page, at idle or when the language switch is hovered or focused). The shared custom properties in
`../design/tokens.css` are copied to `site/tokens.css` at build time and linked by every page. The page carries a
`<meta http-equiv="Content-Security-Policy">` limited to `connect-src 'self' <the Supabase origin from ../config.js>`
and `frame-src 'self'`. **A preview build**, `MANA_PREVIEW=1 node tools/build-site.mjs`, renders the lead form switched
off with a line saying so (a test build can never write to the live backend); the normal build is unchanged.
`node tools/measure-hero.mjs` times the hero (first paint → the rise) plain and with the CPU slowed four times.

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
| `hero-en.mp4` | The viewer lane's 9.2 s hero loop (`../apps/view/.shots/v2/hero.mp4`), copied byte for byte. It was recorded in English, so the English page plays it. |
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
`MANA_VIEW=<folder>` chooses the viewer that the server, the checks and the sheets load (default `../apps/view`; while that
folder is being rebuilt, build the site with `bash tools/build-site.sh` and use `_site/view`).
The checks for the hero video and the film make their own small test clips with ffmpeg (`tools/test-media.mjs`, into
`.scratch/media/`) and overlay them through the local server; they never touch `site/`. Chromium here plays WebM, not H.264.
Playwright and sharp come from `/opt/npm-tools`; Chromium from `/opt/pw-browsers`; ffmpeg from `/usr/bin`.

## Third-party material
- Fonts: Frank Ruhl Libre, IBM Plex Sans Hebrew, IBM Plex Sans, Fraunces, all SIL OFL 1.1 (licence texts in `site/fonts/`).
- Two phone photos (`site/img/howto-photo.jpg`, `guide-cutoff.jpg`) from based.cooking, public domain (Unlicense),
  commit `9d4a31a`, as recorded in the generator's test manifest.
- Table textures and the Olea demo pictures come from `../apps/view` (Halom's own; the Olea pictures are computer-made
  samples and are labelled "Demo dishes · made with AI" wherever they appear). `site/img/hero-dish.webp` is the Olea
  hummus cut out by its matte; `site/img/table-oak.jpg` is `../apps/view/themes/oak.jpg`, darkened. The film's placeholder thumbnails are the eight starter pictures
  of `../stock` (Halom's own).
