# Mana — what a guest sees (`projects/menus/view/`)

What opens from the QR code: one full-screen table that runs away from the guest and reaches every edge of the screen,
set in one straight row under a lamp. They glide along it from dish to dish, from one course to the next, and on to the bar.
A static folder: no build step on the host, no CDN at run time. Version 3 (branch `mana-v3`).

```
index.html  app.css  app.js            the page; app.js is the built entry (text, navigation, glide): about 23 kB gzipped
chunks/stage-*.js                      three.js r128 + the table (about 153 kB gzipped), loaded after the menu text is on screen
fonts/  themes/                        self-hosted Frank Ruhl Libre + IBM Plex Sans Hebrew (OFL), the table textures
demo/olea/   demo/kiosk/   demo/solo/  the showcase restaurant · a café made of placeholders · a menu of one dish
../stock/                              the placeholder library (stock.json + match.js), copied next to this folder by the host
src/
  physics.js    the glide as numbers: momentum, which dish, the spring, the rubber band (pure, unit-tested)
  glide.js      drag / wheel / "go to dish 4" → one number p, where the camera is along the table, in dishes (pure)
  clock.js      ONE clock for everything that moves (table, card, sheets); hand-turned when testing and filming
  store.js      navigation state: one reducer, serialisable, no DOM        history.js   state ↔ hash and the Back button
  snapshot.js   where the menu comes from, validation, money, placeholders, the two counting calls
  ui.js         everything a guest reads (real DOM)                         gestures.js  which finger movement means what
  main.js       boot order: text → table → pictures; wiring; the filming API
  scenes/walk.js  the table as geometry: how it is set (where dishes stand), the camera, sizes on screen (pure)
  scenes/rooms.js which room a category is in (pure)            gl/rooms.js  what each room is made of: counter, backdrop, props
  gl/           the stage (three.js) and the shaders          drinks/   drawn wine and beer, the pour, taste.js (what a guest wants to know)
  tags.js       the taste tags of a wine or a beer (icons)    trayset.js   "my table" setting itself (a small canvas)
test/  tools/  films/                  tests, local server with a backend stub, build, film tool and its scripts
src/v2/  → v2.js                       the menu on the clean schema (config schema 2): choices, basket, suggestions, filter, events (below)
```

## Getting a menu
`/m/<slug>[?t=1]` or `?m=<slug>` (reads `../config.js`) · `?demo=olea|kiosk|solo` · `?preview=1` (announces
`{type:'halom-menu-preview-ready'}` to its opener/parent, then shows what arrives by `postMessage`, live).
`config.js` may also carry `sitePath` (where "← Mana" in a demo leads; default `../`), `stockPath` (default `../stock/`)
and `walk` (below).
A demo says so under the name, and its ordering button names no host: it reads "Order online" / "להזמנה אונליין" and a tap
explains what the button does in a merchant's own menu instead of leaving the page. A real menu shows "Order on <host>" with
the business's own link.

## Moving around
State = `{ lang, categoryId, itemId, open: null | 'dish' | 'list' | 'tray', tray, … }`. There is always a dish in focus; the hash
mirrors it as `#c=<category>&i=<item>` plus `&o=1` (dish lifted), `&o=list` or `&o=tray`. Gliding replaces the history entry,
opening something adds one: Back closes what is open, and the next Back leaves the menu.

| What the guest does | Result | Also |
|---|---|---|
| swipe up (down: back) | the table follows the finger exactly; let go and it carries on, then settles on the next dish | trackpad (followed exactly), mouse wheel (a notch is one dish, in one glide), ↓ ↑, Space, PageDown / PageUp (three dishes), Home, End |
| flick | one dish; a hard flick passes several | |
| swipe on past the last dish | the walk goes on along the same table into the next section, which is already laid there: its name is lettered on the wood before its first dish | keep pressing ↓ |
| swipe sideways | the next (or previous) section, by the same walk along the table. The bar is another room, reached by the same kind of move: the camera travels on across a stretch of dark, the table's light goes down behind it and the bar's comes up ahead | category chips, ← → (mirrored in Hebrew) |
| tap the dish in focus, or its card | the dish rises, the card grows into a sheet as tall as what it has to say (at most 56% of a phone) | Enter |
| drag a lifted dish | it turns, keeps its speed, comes back (a drawn bottle turns all the way and stays) | ← → |
| swipe down, tap outside, ✕ | back on the table | Esc, Back |
| ☰ | the whole menu as a list: all categories, thumbnails, prices; a row flies to its dish | Tab |

**Which way the table runs.** By default it is a feed (`walk` = `feed`): a swipe up brings the next dish, which waits at the
near end of the table, half behind the card. `?walk=pull` or `config.walk = 'pull'` turns it round: the next dish stands further
up the table and is pulled down towards you. Keys and the wheel mean "next" in both, and the first-visit hint shows the
direction in use.

The numbers of the glide are in `src/physics.js` (momentum 0.2 s, one critically damped spring whose stiffness is chosen per
release so the table never speeds up after the finger has left it, rubber band past the ends). Reduced motion: no sway, no
overshoot, nothing rises; a change of section or of room is a plain cross-fade from the picture as it was (`ui.cut`).

## How the table is set
`placesOf` in `src/scenes/walk.js` puts the dishes of a section down; the stage (`src/gl/stage.js`) lights and moves them.

- **One straight row.** Every dish stands on the middle line of the table and the camera travels along that line, so
  nothing sways from side to side on the way. What reads as a hand is small and has no pattern: at most a finger's width
  off the line (`wander`), a few degrees askew. (There used to be a stagger, left then right: it read as a zigzag.)
- **Rim to rim.** The room between two neighbours follows their size: two plates take `S`, a name card or a print stands
  closer. A finger moves the table by distance, not by "dishes" (`alongAt` / `dishAt`), so the point that was grabbed stays
  under it; the pace through a small thing is eased, so the table does not jolt there.
- **Courses.** Near the end of a section the next one is already on the table, a wider gap further along, its name
  lettered in the gap (`layGuests`, `guests`). These are the very plates the guest arrives at: walking on lays nothing
  again. There are never more dishes on the table than in the middle of a section (seven).
- **The lamp.** Its pool falls on the dish in focus and lets the rest of the table go (`TABLE_FS`); neighbours wait in
  half light, in their own colours. While the guest is moving along the table the lamp opens (`open`); it closes on the
  dish they stop at. A dish at the lamp is still exactly its photo.
- **Shadows.** A contact shadow all round the rim and a wide soft one away from the lamp, both read from the small
  versions of the dish's own matte (its mip chain: five lookups, no blur pass).
- **Presence.** The dish the table settles on comes up a little (`RISE`), straightens, and its shadow opens; it goes back
  down as the table moves on, and nothing comes up while the table is still flying (`CALM`). The camera stands back a
  touch in flight and comes in as it lands (`BREATH`); never under a finger. While dishes fly past, the card says their
  names dimmed and does not fade for each one.
- **The drinks rooms** (and the bar of before) keep their own setting: every drink has the same room, a little to one side then
  the other so the one behind is not hidden (at the taps a straight row, seen from the side), and their own light.
- **From the table to the bar and back** (`across` in `sync`, `S.edge`, `stepRooms`): the other room lies further along
  the same walk, beyond a stretch of dark. Both are in the picture for a moment, each on its own side of a line across
  the walk and each with its own light; the camera, the lamp and the eye (45° to 31°) make one move. Turning round half
  way is the same move back across the same line. The same code runs for a chip, a swipe, a key, a link and Back.

## The rooms of the place
The menu is a walk through a restaurant, not one long table. Each kind of category has its own room, with its own eye, light,
pace, counter, props and backdrop (`scenes/rooms.js` chooses, `scenes/walk.js` holds each room's camera as a preset of the same
name, `gl/rooms.js` draws it):

| Room | For | The eye | What is there |
|---|---|---|---|
| `table` | food | 45°, straight down the table | the long table under one lamp, as before |
| `vitrine` | desserts (and sandwiches, by choice) | 36°, a guest's eye a little above the case; the dish drawn smaller, so the case shows | a glass case with brass edges and a strip of light inside, pale marble; each dish on a riser of one of three heights, read from the dish itself (a tall dessert low, a flat tart raised); the eye rises and settles with them |
| `cellar` | wine | 29° | dark oak counter between a wall of glass-door wine fridges (lit racks, the ends of bottles, a little mist) and oak barrels, boutique shelves behind, a barrel vault far behind; lifted, the bottle comes off the rack towards the guest, turns once, and pours |
| `taps` | beer | 22°, three-quarter on (from the side) | a straight row of brass taps on a glossy counter, a brass drip tray and rail, warm bulbs hanging over it, a tiled beer bar far behind; lifted, the tap pours with a head |
| `cocktail` | drinks | 43°, from above and to one side (the old bar's 31° was "too flat for drinks"; the cold drinks were photographed at 45°, which this eye now matches) | a dark honed bar, a backlit back-bar, a cocktail bar far behind |

- **Which room.** A category's room follows its `kind` (food → table, dessert → vitrine, wine → cellar, beer → taps, drinks →
  cocktail). The snapshot's optional `category.room` lets an owner choose another (CONTRACT.md, r2); an unknown value is
  ignored. `scene: 'table'` still keeps a category on the table, `scene: 'bar'` puts it in the drinks room of its kind,
  `'holo'` is the projector. `?rooms=off` shows the two rooms of before (the table and one bar), for comparison; the older
  browser tests of the walk run that way.
- **From one room to the next** is the walk between the table and the bar of before, for every pair of rooms: the next room lies
  further along the same walk beyond a stretch of dark, both are in the picture for a moment, each on its own side of a line
  across the walk with its own light; the eye changes height and swings round (`yaw`) in the same move. Two neighbouring
  sections in the same room still lie on the same table, their names lettered between them.
- **The backdrop.** One photograph of a place like it (`themes/rooms/*.jpg`, 1024 px, blurred; made with AI and listed in
  `brand/site/img/AI-MEDIA.md`) stands behind everything, above the counter's far end (`wall`, from 7.4 to 9.2 behind the focus),
  and drifts a little as the guest walks; the counter reflects it. The card says once, quietly, in those rooms: "Backdrop: made
  with AI" / "רקע: נוצר בבינה מלאכותית". Past the counter's far end the room ends: a dish there is not drawn.
- **Only the rooms near the guest exist.** A room (its counter, a few shapes, its one picture, 50–75 kB) is built when the guest is
  in it or a neighbouring section is in it, so the walk there does not arrive in the dark. The first dish of Olea needs nothing
  more than before.
- **What stays honest.** A relief at rest is still exactly its photo (the props and the glass of the case never stand between the
  eye and the dish in focus); placeholders and drawn drinks keep their labels.

## Sold out
A sold-out item moves to the end of its section, in the merchant's order, greyed (it loses its colour) and labelled "Sold out",
so a section never opens on it. `business.soldOut: 'hide'` (snapshot, optional; default `'bottom'`) leaves sold-out items out of
the menu altogether (a section with nothing left goes too). The list follows the same order (`servedOrder` in `store.js`).

## Taste tags (wine and beer)
Small tags with icons for what a guest wants to know: a wine's style in its own colour (red, white, rosé, orange, sparkling),
sweetness (dry → sweet), body (light → full), acidity; a beer's style (lager, wheat, pale ale, IPA, amber, stout, sour),
bitterness, strength as the merchant wrote it ("4.8%"); and notes (wine: mineral, citrus, red fruit, stone fruit, floral, oak,
spice, earthy · beer: citrus, malt, roast, hops, tart, fruity, spice). On the card: the style and a few; in the open sheet: all of
them, the scales as pips; in the list: the icons (their words for a screen reader).
`drinks/taste.js` reads them from the merchant only: the fields (`details.wine.color`, `.notes`, the optional `.taste`;
`details.beer.style`, `.abv`, `.taste`) are facts; words found in the merchant's own description (Hebrew and English, whole words,
"חצי יבש" is not "יבש") are **suggested**: drawn with a dotted edge and "read from the description" / "לפי התיאור בתפריט". No word,
no tag. The icons are one SVG set in `tags.js` (16 px grid, one line weight).

## My table sets itself
Opening "my table" plays a small scene at the top of the sheet: a linen cloth floats down onto the wood and settles, then a plate
for each chosen dish arrives in turn with a little weight and a bounce (its own small picture), a glass for each drink, the
cutlery beside (`trayset.js`; about two seconds, on the page's clock, so it films frame by frame). Reduced motion shows the table
set at once. The canvas has a text equivalent (the dishes' names); the list under it is the real content.

## Honest looks
A relief or a photo is shown in its true colour, solid on the table with its shadow. A placeholder from the stock library
(`asset: {state:'stock', id}`) is an illustration: it keeps about 70% of its own colour, leans lightly towards the menu's
accent, carries fine scan lines and floats a little over a ring of light. Its label from the manifest ("Illustration" /
"להמחשה בלבד") stands in the card, the sheet and the list, at rest and when lifted. An unknown stock id
gives no picture. A dish without a picture gets a small folded name card. Drawn wine and beer carry "Illustration · ask to see
the bottle". Sold out loses its colour and says so.

## Without the table
No WebGL, a lost GPU that does not come back, a slow phone at the end of the quality ladder, or `?view=list`: the list is the
menu. Every name, price, description and state is in the DOM at all times, which is also what a screen reader reads.

## Speed
Only the dishes near the camera exist (three before, three ahead, counting the first or last of a neighbouring course near
a section's end); their pictures are loaded as the guest moves, and those no dish uses any more are freed, except the ten
seen last. A dish's matte carries a mip chain for its shadow (a third more memory for that one small picture). The bar's
counter is fetched when a neighbouring section is at the bar, so the walk there does not arrive in the dark. The pixel ratio is capped and a quality ladder steps down on a slow phone (bloom off → pixel
ratio 1 → 0.7 → the list). Nothing is laid out during a drag; the card's words change once per dish. The closed list waits far
below the screen, so its small pictures are fetched when it is first opened, not while the table loads.
`node test/load.mjs` prints what a phone downloads: for Olea the first dish needs about 738 kB (script 199, of which about 18 are the rooms, the taste tags and my table; the table's wood 233,
fonts 137, its own pictures 152, menu data 8), and the pictures of its three neighbours another 436 kB.

## Counting
`open_menu {p_slug, p_lang, p_src}` instead of `public_menu` (`p_src` is `qr` with `?t=1`, else `link`; on an older backend
that answers 404 the viewer falls back to `public_menu`). `track_item {p_slug, p_item, p_kind}` with `open` when a dish is
lifted and `add` when it is put on "my table": once per dish and kind per page load, fire and forget. Never in a demo or a preview.

## Schema 2: the menu on the clean schema (`src/v2/`, F07)
When `HALOM_MENUS_CONFIG.schema === 2` (the local stack and the demo database `mana`; production is 1 until the
cutover, ADR-005), a real menu (`/m/<slug>`, `?m=`) loads `v2.js`, a build of its own: `app.js` shares no chunk with it,
so a v1 menu fetches exactly what it did. Demos and the preview stay v1. Everything the table, the list and the card do
is the v1 menu's own; v2 adds, through a few hooks in `ui.js` and `main.js` (each a no-op without `env.v2`):

| Piece | What |
|---|---|
| `menu.js` | `public_menu(slug)` → the snapshot v2 (checked with the contracts' `validateSnapshotV2`) and the live overlay → the model the menu already draws, with `snapshot.v2` beside it. Availability (`menuAvailability`, Asia/Jerusalem): each item's `available` and why not ("Sold out · back at 14:30", "Served from 07:00"); "closed now · opens at 07:00"; "from ₪…" (`fromPrice`). The tag filter (a vegan dish also counts as vegetarian). |
| `choices.js` | The dish sheet's `DishSelection`: the owner's defaults (`defaultSelection`), a single choice replaces, an opener opens its group (with its defaults) inline, quantities up to `max_qty`; the running price is `priceDish` with the minimums set aside, then exactly `priceDish`; what is still needed comes from `priceDish`'s own errors. |
| `basket.js` | "My table" as lines (dish, choices, quantity): the same choices add up; change, remove; every amount `priceDish`'s, VAT included; a line that can no longer be ordered is marked, explained and left out of the total (Hopa test 2). Kept on this phone (`mana-basket:<slug>`). `priced()` is the seam phase 2's checkout freezes into an order. |
| `visit.js` | One suggestion at a time: `matchSuggestion` with this visit's `shown` (`recordShown`, the cap) and `dismissed`. Triggers: the sheet opening, an add, "my table" opening (checkout). Accept adds it (an option to the sheet, a dish with its defaults, or its sheet when it has choices to make); dismiss changes nothing chosen. |
| `events.js` | The seven guest events to `track_events`: the contract's props only, an offset in every time, batches of at most 50 (sent 1.5 s after the first, at once when the page is hidden), retried with the same ids. No cookie, no visitor id. |
| `guest.js`, `style.js`, `i18n.js` | The DOM: groups as fieldsets of radios, checkboxes and steppers, sold-out options greyed, "goes well with", the suggestion above the add button (or over the card, or in "my table"), the basket's lines, the filter (a tool in the bar, a line under it while it is on). Its own words (Hebrew needs a native read) and styles, injected so `app.css` stays as it is. |

**Live.** `public_menu` is asked again every `config.liveEveryMs` (30 s by default), when the page comes back into view
and when the phone is online again; a dish taken off greys where it stands (the walk is not reordered under the guest)
and a new revision is loaded in place. Between answers the clock moves day parts and "back at 14:30".

**What is counted:** `menu_opened` once a page load (`src`, `lang`, `revision`); `dish_viewed` once a dish a page load,
when its sheet opens; `addon_chosen` when the guest chooses an option (not the owner's defaults); `basket_added`
(`fromSuggestion`); `suggestion_shown` / `_accepted` / `_dismissed`. Never in a demo or a preview.

`__mana.v2()` (the basket, the sheet, the suggestion), `__mana.flush()` (send what is queued) and `__mana.refresh()` (ask
`public_menu` now) are for tests. The browser tests run on the simulator's stack: `e2e/guest-menu.test.mjs`.

## Filming and testing
`?capture=1` (and `?test=1`) stop the page's own clock: nothing moves until it is told to.

```
await __mana.settle()                  the table is up and the dish in focus is sharp
await __mana.frame(dtMs)               turn the one clock by dtMs, draw, resolve when the frame is on screen with its pictures
__mana.pointer('down'|'move'|'up', x, y)   a scripted finger, through the same code as a real one
__mana.goTo(itemId) · lift(true|false) · setLang('he'|'en') · wheel(dy) · key('ArrowDown')
__mana.state() · info() · glide() · tick(n, dtSeconds, draw)       for tests
```

`tools/film.mjs` plays a JSON script frame by frame, saves PNGs and makes an MP4 (H.264, yuv420p, faststart) and / or a
contact sheet of consecutive frames:

```
node tools/film.mjs films/hero.json                 → .shots/v2/hero.mp4          (390x844, 30 fps)
node tools/film.mjs films/sheets.json               → .shots/v2/<name>.jpg        (frames every 50 ms)
node tools/film.mjs films/guest-glide.json           → .shots/v2/guest-glide.mp4   (780x1688, the selling film's clip)
node tools/film.mjs films/rooms.json                 → .shots/v2/rooms-*.mp4       (into the vitrine, the cellar's pour, the taps, the cocktail bar; my table as a sheet)
node tools/film.mjs films/sheets.json --only hebrew [--out dir] [--keep] [--frames-only]
node tools/proof.mjs                                → .shots/v2/fix/<shape>.jpg   stills at four screen shapes, and a count of black pixels
STOCK=fixture node tools/film.mjs …                 the eight test placeholders instead of ../../stock (the real library, the default)
```

A script: `{ name, url, width, height, fps, seconds, finger, steps: [{ at, drag: [[x,y],[x,y]], ms, ease } | { at, tap: [x,y] } |
{ at, goTo } | { at, lift } | { at, lang } | { at, key } | { at, wheel } | { at, click: selector }], sheet: { from, every, count, cols, width } }`.
The same script gives the same frames every time. The scripted finger leaves the glass one frame after its last move, as a
real one does. A film waits for every picture before it draws a frame; a phone on a slow line shows the table first and each
dish sharpens when its picture arrives. Next to the pictures, `film-log.json` holds for every frame where the table was
(in dishes), how far the dish was lifted and how bright the lamp was: motion as numbers.
Headless Chromium draws WebGL in software: a phone-size frame takes one to three seconds, so a ten-second film takes about
ten minutes.

## Develop
```
npm install                 # three@0.128, esbuild, fonts (dev only)
npm run build               # src/ → app.js, seat.js + chunks/ (not in git: `npm run serve` and `npm run test:browser` build first; CI builds in tools/build-site.sh)
npm run serve               # http://localhost:8787/projects/menus/view/?demo=olea  and  /m/olea (stub: olea, kiosk, paused, flaky, slow, broken)
npm test                    # rooms, sold out, taste, my table; physics, glide, store (fuzz), snapshot + counting against the stub, geometry (how the table is set), drinks
npm run test:browser        # headless Chromium, one at a time: glide, categories, courses, the set table, table ↔ bar, lift, list, placeholders, /m/, preview, languages, reduced motion, no WebGL, the bar; the rooms (rooms.browser.test.mjs)
node test/load.mjs          # bytes a phone downloads before the first dish is sharp
python3 tools/build-kiosk.py   # rebuilds demo/kiosk and demo/solo
```
Query switches: `lang=he|en` · `walk=feed|pull` · `rooms=off` (the table and the one bar of before) · `bloom=0` · `view=list` · `motion=reduce|full` · `pr=<pixel ratio>` · `adapt=off` ·
`gl=off` (as a phone without WebGL) · `hint=1|0` · `finger=1` (show the scripted finger) · `test=1` · `capture=1` · demos only:
`surface=<table id>|holo`, `template=<look id>` (../../templates/templates.v1.json; the gallery is `looks/`) · `embed=hero` (with `demo=solo`:
the dish alone, for the product page's hero; `src/hero.js`; it talks to its page by `postMessage` `{type:'mana-hero'}`) ·
the seat map is `seat/?demo=olea` (`src/seat/`, contracts in `../../seating/`).

## Why three.js r128
The relief, table and bloom shaders were tuned on r128, which does no colour management: a dish at rest is its photo, pixel for
pixel. r128 also still runs on WebGL 1 phones. A move to a current release is its own piece of work with a visual comparison on
real devices; nothing here needs a newer feature. It is bundled from npm as ES modules.
