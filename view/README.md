# Mana — what a guest sees (`projects/menus/view/`)

What opens from the QR code: one full-screen table that runs away from the guest and reaches every edge of the screen.
They glide along it from dish to dish, and from one section of the menu to the next.
A static folder: no build step on the host, no CDN at run time. Version 2 (branch `v2`).

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
  scenes/walk.js  the table as geometry: where dishes stand, the camera, sizes on screen (pure)
  gl/           the stage (three.js) and the shaders          drinks/   drawn wine and beer, the pour
test/  tools/  films/                  tests, local server with a backend stub, build, film tool and its scripts
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
| swipe on past the last dish | the walk goes on along the same table into the next section; its name is lettered on the wood before its first dish | keep pressing ↓ |
| swipe sideways | the next (or previous) section, by the same walk along the table. Only between the table and the bar is it another room: there the lamp goes down and comes up | category chips, ← → (mirrored in Hebrew) |
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
overshoot, cross-fades instead of travel.

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
Only the dishes near the camera exist (three before, three ahead); their pictures are loaded as the guest moves, and those
no dish uses any more are freed, except the ten seen last. The pixel ratio is capped and a quality ladder steps down on a slow phone (bloom off → pixel
ratio 1 → 0.7 → the list). Nothing is laid out during a drag; the card's words change once per dish. The closed list waits far
below the screen, so its small pictures are fetched when it is first opened, not while the table loads.
`node test/load.mjs` prints what a phone downloads: for Olea the first dish needs about 720 kB (script 181, the table's wood 233,
fonts 137, its own pictures 152, menu data 8), and the pictures of its three neighbours another 436 kB.

## Counting
`open_menu {p_slug, p_lang, p_src}` instead of `public_menu` (`p_src` is `qr` with `?t=1`, else `link`; on an older backend
that answers 404 the viewer falls back to `public_menu`). `track_item {p_slug, p_item, p_kind}` with `open` when a dish is
lifted and `add` when it is put on "my table": once per dish and kind per page load, fire and forget. Never in a demo or a preview.

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
node tools/film.mjs films/sheets.json --only hebrew [--out dir] [--keep] [--frames-only]
node tools/proof.mjs                                → .shots/v2/fix/<shape>.jpg   stills at four screen shapes, and a count of black pixels
STOCK=fixture node tools/film.mjs …                 the eight test placeholders instead of ../stock (the real library, the default)
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
npm run build               # src/ → app.js + chunks/
npm run serve               # http://localhost:8787/projects/menus/view/?demo=olea  and  /m/olea (stub: olea, kiosk, paused, flaky, slow, broken)
npm test                    # physics, glide, store (fuzz), snapshot + counting against the stub, geometry, drinks
npm run test:browser        # headless Chromium, one at a time: glide, categories, lift, list, placeholders, /m/, preview, languages, reduced motion, no WebGL, the bar
node test/load.mjs          # bytes a phone downloads before the first dish is sharp
python3 tools/build-kiosk.py   # rebuilds demo/kiosk and demo/solo
```
Query switches: `lang=he|en` · `walk=feed|pull` · `bloom=0` · `view=list` · `motion=reduce|full` · `pr=<pixel ratio>` · `adapt=off` ·
`gl=off` (as a phone without WebGL) · `hint=1|0` · `finger=1` (show the scripted finger) · `test=1` · `capture=1` · demos only:
`surface=<table id>|holo`.

## Why three.js r128
The relief, table and bloom shaders were tuned on r128, which does no colour management: a dish at rest is its photo, pixel for
pixel. r128 also still runs on WebGL 1 phones. A move to a current release is its own piece of work with a visual comparison on
real devices; nothing here needs a newer feature. It is bundled from npm as ES modules.
