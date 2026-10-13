# Looks (`templates/`)

A **look** is what a restaurant's menu can wear tonight: the table surface its dishes lie on, the accent colour, how wide the
lamp's pool falls, whether the dish card is dark or light, and one CSS-only detail that says what kind of place this is.
A look changes nothing about the dishes themselves: every dish is still a relief from one photo, in its true colour.

They are called looks, not templates, until each has its own texture and type (week 2). Tonight's four are live; the other
95 concepts in `matrix.json` are data, waiting.

```
templates.v1.json   the live looks (the contract below); bundled into the guest menu by esbuild, never fetched at run time
validate.mjs        the contract as a check: `node templates/validate.mjs` (exit 1 with the errors listed); also exported for tests
matrix.json         all 99 concepts of the design research (9 categories × 33 subcategories × 3), as data, without their sources
sources.md          what each concept was inspired by; stays out of the built site
tools/stills.mjs    renders one still per live look into view/looks/img/<id>.webp for the gallery (headless, software WebGL)
```

## The contract (`templates.v1.json`, `{ v: 1, looks: [...] }`)

| field | type | meaning |
|---|---|---|
| `id` | `^[a-z0-9-]{1,40}$` | what `theme.template` in a menu snapshot and `?template=` in a demo name |
| `category`, `subcategory` | ids from `matrix.json` | where the concept sits (`cafe`, `bistro`, `fine`, `israeli`, `asian`, `italian`, `bar`, `bakery`, `street`) |
| `name` | `{ he, en }` | Hebrew written first, not translated; English equal |
| `surface` | one of the 18 tables in `view/src/scenes/common.js` (`TABLES`) | what the dishes lie on; its texture pair is already in `view/themes/` |
| `accent` | `#rrggbb` | the price, the chip underline, the add button; on a dark card it must read at 4.5:1 |
| `card` | `"dark"` \| `"light"` | the dish card's tint |
| `ink` | `#rrggbb`, light cards only | the card's text colour (4.5:1 on `rgba(252,248,246,.86)`) |
| `light` | `{ pool, open }` | overrides of `PRESETS.table` in `view/src/scenes/walk.js`: how wide the lamp's pool falls, and how much wider while the guest moves |
| `finish` | `{ spec?, shin?, refl? }`, optional | overrides of the table's gloss, so `marble` can be matte (whitewashed) instead of polished |
| `motion` | `"settle"` \| `"none"` | `settle`: the engine's own motion · `none`: as reduced motion |
| `detail` | one of `validate.mjs`'s `DETAILS` | the one CSS-only concept detail, a class `look-<detail>` on the app root (`view/app.css`) |
| `fonts` | `"house"` | the guest menu's own type; each look gets its own in week 2 |

**Precedence in the guest menu** (`view/src/looks.js`): the look gives the surface, the accent and the lamp; an owner's own table
photo (`theme.surface === 'custom'` with `tableImg`) still wins over the look's surface. An unknown `template` leaves the menu as
it is today. The snapshot stays `v: 1`; older readers ignore the field.

## The four live looks

| id | name | place | surface | the one detail |
|---|---|---|---|---|
| `album-side` | צד א׳ · Album Side | a listening café | `concrete`, one tight warm bulb | dishes numbered like tracks: A1, A2… in the card (LTR, inside `<bdi>`) |
| `casablanca-white` | לבן קזבלנקה · Casablanca White | Levantine light | `marble` with a matte finish, a wide daylight pool, a light card | a thin tile-stripe rule on the card |
| `counter-shout` | צעקה מהדלפק · Counter Shout | a pita counter | `steel`, bright and wide | the dish's name on a paper ticket |
| `back-door` | הדלת האחורית · Back Door | a hidden bar | `walnut`, a very low amber lamp in a narrow pool | a 2 px amber line at the card's top edge: the door crack |

Try one: `view/?demo=olea&template=<id>`. The gallery is `view/looks/`. Olea's dishes were made with AI and say so.

## Adding a look

1. Pick a concept in `matrix.json` (or write a new one there first).
2. Add an entry to `templates.v1.json` with the fields above. Choose the surface from the 18; the lamp numbers by eye at 390×844
   (`pool` 1–1.5 is one bulb, 2.4 is today's table, 5–7 is daylight).
3. If it needs a new detail, add its CSS to `view/app.css` under `/* looks */` as `.look-<detail> …`, and the name to `DETAILS` in
   `validate.mjs`. Keep it CSS-only: no texture, no font, no script.
4. `node templates/validate.mjs`, then `cd view && npm test && npm run test:browser` (the per-look browser test measures the
   card's text contrast), then render its still: `node templates/tools/stills.mjs <id>`.
5. Write the Hebrew name in Hebrew and put it on the list for the native read.

No `inspiredBy`, venue name, logo or trade dress goes into a look or into the built site.
