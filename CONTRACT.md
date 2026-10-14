# Halom Menus — shared contract (v1, 5 Oct 2026)

Integration owner: the lead session. Lanes build to this file. If a lane needs a change here, it says so in its
report; it does not silently diverge.

## What the product is
A restaurant owner signs in, enters the menu (categories, dishes, drinks, prices, photos), turns suitable photos into
**relief holograms** (2.5D: a cut-out plus a height map made from ONE photo — never call it a "3D model" or a
"digital twin"), approves them, picks a scene, and publishes. Diners open a stable link or QR on their phone:
no app, no account. Everything not approved stays private.

Generation runs **in the owner's browser** (no server, no paid provider): same two Apache-2.0 models and the same
post-processing as Halom's Python pipeline (`base/pipeline.py`).

## Where things live (static hosting: GitHub Pages, built from this repo's `main` by `tools/build-site.sh`; until 12 Oct 2026 `danieltinker/halom-projects`, folder `projects/menus/`)

Older sections below still name the old repository's paths (`projects/menus/…`). In this repository the sources are
the folders in the table; `tools/build-site.sh` puts the built files at the root of `_site/`, and halom.io serves them at `/mana/…`.

| Path in this repository | Built into `_site/` as | What | Lane |
|---|---|---|---|
| `brand/site/` | `index.html`, `guide/`, `privacy/`, `terms/` | owner-facing product page | studio |
| `studio/` | `studio/` | owner dashboard (SPA) | studio |
| `view/` | `view/` | diner viewer | viewer |
| `gen/` | `gen/` | in-browser generator: module, runtime, models | gen |
| `config.js` | `config.js` | Supabase URL + publishable key + URL bases | lead |

Public URLs (since 13 Oct 2026): `https://halom.io/mana/...` (the product page, `studio/`, `ops/`, `view/`, `gen/`,
`stock/`), proxied from `https://danieltinker.github.io/mana/...`; the diner short link `https://halom.io/m/<slug>` → `view/index.html`.
Every page must therefore work under BOTH prefixes and when served for the path `/m/<slug>`. Use relative URLs for
your own assets; the viewer's `index.html` sets `<base href>` itself when the path starts with `/m/`.
No build step may be needed on the host: each lane hands back a ready static folder (a bundler is fine on our side).
No third-party CDNs at run time for the viewer (self-host three.js and fonts); the studio may load nothing from a CDN
either. Offline-first is not required.

`config.js` (loaded by studio and viewer as a classic script):
```js
window.HALOM_MENUS_CONFIG = {
  supabaseUrl: 'https://zemdhczqlhkabfwxccqq.supabase.co',
  supabaseKey: 'sb_publishable_2VJC5Vn-AlpkXKpQPOVnfA_5nirGaKS',
  shortBase: 'https://halom.io/m/',                 // what QR codes encode
  viewPath: '../view/',                             // studio → viewer, relative
  genPath: '../gen/'                                // studio → generator, relative
};
```

## Published menu snapshot (what the viewer renders) — `snapshot.v = 1`
The database builds it at publish time; the viewer never reads draft tables.
```jsonc
{
  "v": 1,
  "slug": "juno",
  "revision": 7,
  "publishedAt": "2026-10-05T12:00:00Z",
  "business": {
    "name": { "he": "…", "en": "…" },          // at least one language present
    "area": { "he": "", "en": "" },             // optional strings, may be ""
    "cuisine": { "he": "", "en": "" },
    "logo": "https://…/logo.png" ,              // or null
    "orderUrl": null,                            // https link to the merchant's own existing ordering page, or null
    "phone": null
  },
  "locale": { "default": "he", "langs": ["he", "en"], "currency": "ILS" },
  "theme": { "accent": "#ff8a5c", "surface": "oak", "tableImg": null },   // surface: 'holo' or a table id (see TABLES in engine.js) or 'custom' + tableImg
  "categories": [
    {
      "id": "uuid", "name": { "he": "…", "en": "…" },
      "kind": "food",                            // food | dessert | drinks | wine | beer
      "scene": "auto",                           // auto | table | bar | holo  (auto: food/dessert → table, drinks/wine/beer → bar)
      "items": [
        {
          "id": "uuid",
          "name": { "he": "…", "en": "…" },
          "desc": { "he": "", "en": "" },
          "price": { "amount": 6200, "currency": "ILS", "note": "" },   // amount in minor units (agorot); null = no price shown
          "available": true,
          "tags": ["vegan", "vegetarian", "spicy", "gf"],
          "allergens": { "he": "", "en": "" },   // owner-entered free text; never generated
          "details": {                            // optional, only what the owner entered
            "wine": { "producer": "", "name": "", "vintage": "", "region": "", "grape": "", "serving": "", "color": "red|white|rose|sparkling|orange",
                      "notes": { "sweetness": "", "acidity": "", "body": "", "fruit": "", "minerality": "", "pairings": "" } },
            "beer": { "brewery": "", "style": "", "abv": "", "serving": "bottle|can|tap", "color": "pale|amber|dark" }
          },
          "asset": {                              // null when the item has no approved picture
            "state": "relief",                    // relief | photo
            "color": "https://…/color.jpg",       // 768 px square JPEG (relief) or the photo (photo)
            "aux": "https://…/aux.png",           // 512 px PNG, R = height, G = matte (relief only)
            "thumb": "https://…/thumb.jpg",       // 256 px
            "kind": "medium",                     // flat | low | medium | tall | stand   (relief only)
            "e": 48.5, "h": 0.2014, "o": null, "s": null    // camera elevation (deg), max height; o,s only for 'stand'
          }
        }
      ]
    }
  ]
}
```
Rules for the viewer: text is the source of truth (names, prices, availability live in the DOM, readable without
WebGL). `available: false` is shown as sold out, not hidden. An item with `asset: null` or `state: 'photo'` gets an
honest presentation (photo card or text card) and is never dressed up as a relief. Money: format `amount/100` with
the currency for the UI language; never do float maths on prices beyond display.

How the viewer gets a snapshot:
- `?demo=<name>` → `fetch('demo/<name>/menu.json')` (static, same shape; asset URLs relative to that folder);
- `/m/<slug>` or `?m=<slug>` → `POST {supabaseUrl}/rest/v1/rpc/public_menu` with header `apikey: {supabaseKey}` and
  JSON body `{"p_slug":"<slug>"}`. Response: `{"state":"ok","snapshot":{…}}` | `{"state":"unavailable","business":{"name":{…}}}`
  (trial ended / paused: show a calm "this menu is not available right now" page with the business name) |
  `{"state":"not_found"}`. Network failure → retry control. Preview from the studio:
- `?preview=1` → the viewer waits for `window.postMessage({type:'halom-menu-preview', snapshot})` from its opener/parent
  (same origin) and renders that snapshot (asset URLs may be `blob:` or signed URLs).

## Generator module (owner's browser) — `projects/menus/gen/gen.js` (ES module)
```js
import { createGenerator } from '../gen/gen.js';
const gen = await createGenerator({ onProgress: ({ phase, loaded, total, message }) => {} });   // loads runtime + models once (cached)
const job = await gen.analyse(fileOrBlob, { name: 'Shakshuka' });       // slow part (matte + depth); returns a handle
const out = await gen.build(job, { relief: 'auto', angle: 'auto' });    // fast; call again when the owner changes the depth class
// out = { color: Blob(image/jpeg 768²), aux: Blob(image/png 512²), thumb: Blob(image/jpeg 256²), debug: Blob|null,
//         kind: 'flat'|'low'|'medium'|'tall'|'stand', meta: { e, h, o?, s?, warn? },
//         provenance: { pipeline: 'halom-relief/1', matteModel, depthModel, runtime, ms, sourceSha256, width, height } }
gen.release(job); gen.dispose();
```
Errors are thrown as `Error` with `.code`: `no_dish` (nothing found in the photo), `bad_image`, `unsupported`
(browser cannot run it), `model_download` (network), `aborted`. `gen.supported()` is a cheap capability check.

## Words we use
Owner-facing: "relief hologram" / "3D relief", "photo", "approve", "publish". Never "digital twin", never "exact",
never promise every photo works. Diner-facing: no technology words at all.
Hebrew is first-class (RTL), English second. Follow Halom's voice: plain, specific, no hype, no filler.

---
# Amendments (6 Oct 2026, after the first build round) — these override the text above where they differ

## Name
The product is **Mana** (Hebrew **מנה**, "a dish"), by Halom. Keep the name in ONE constant/config per app so it can change.
Public addresses after the next halom.io release: `halom.io/mana/` (product page), `halom.io/mana/studio/` (owner app),
`halom.io/mana/ops/` (Halom back office), `halom.io/m/<slug>` (a restaurant's menu; this is what QR codes encode).
In the Pages repo everything stays under `projects/menus/` (`index.html`, `studio/`, `ops/`, `view/`, `gen/`, `config.js`),
so use relative links between them (`../studio/`, `../view/`, `../gen/`, `../config.js`).

## Backend
`BACKEND.md` (next to this file) + `db/0001_core.sql` describe the live Supabase project: sign-up, tables, RPCs, storage,
the picture flow. The `public_menu` call needs only the `apikey` header.

## Generator (as built — see /home/claude/work/reports/generator.md)
- `import { createGenerator, supported, capabilities, downloadSize, clearCache } from '../gen/gen.js'`. `supported()` is a
  synchronous module export. The module must be same-origin with the importing page (module worker).
- `createGenerator({ onProgress, signal, quality: 'default'|'best', lowMemory: 'auto' })`;
  `gen.analyse(blob, { name, signal, onProgress })`; `gen.build(job, { relief, angle, name, debug, signal, onProgress })`;
  `gen.release(job)`; `gen.dispose()`; `gen.info`; `gen.stats()`.
- First use downloads about 72 MB once (default preset; cached in the browser afterwards). `downloadSize('default')`
  gives the bytes. About 10 s per photo on a laptop-class machine; phones were never measured. `build` takes 1–2 s,
  so show a short busy state when the owner changes the depth class.
- Progress phases: `download` (with `loaded`/`total` bytes), `runtime`, `models`, `ready`, then per photo `decode`,
  `matte`, `depth`, and `build`. `message` is English only: localise by `phase`.
- Error `.code`: `no_dish` (thrown by `build`), `bad_image`, `unsupported`, `model_download`, `aborted`, `memory`
  (device ran out of memory: suggest a computer), `released`, `internal`.
- `out.meta.warn` (English sentence from the pipeline: dish cut off / too small) must be shown to the owner as a
  "better photo" hint. `out.debug` only with `debug: true`.
- The default preset's cut-out model is the small U2-Net: thin parts (pan handles, glass stems) can go missing. Say
  "works best on a plain background, whole dish in frame" in the photo tips.

## Viewer (as built — see /home/claude/work/reports/viewer-m1.md)
- Preview handshake: the viewer opened with `?preview=1` posts `{type:'halom-menu-preview-ready'}` to its
  opener/parent when it is listening; send `{type:'halom-menu-preview', snapshot}` AFTER that. Later messages update
  the open preview in place.
- Free texts inside `price.note` and `details.wine|beer` may be plain strings or `{he,en}`; the database sends
  `price.note` as `{he,en}`.
- Deep links: `#c=<categoryId>&i=<itemId>`.
- Item ids must be unique across the menu (they are database uuids).

---
# Amendments v2 (7 Oct 2026, after the founder's first real use) — these override everything above where they differ

Why v2: the founder used the live product and said: the diner view "failed to deliver the table experience in 3D, I just
see a generic list … the swiping lacks an innovative smooth experience"; the owner app is "too easy to get lost in",
"heavy on text"; sign-up must offer Google / Apple / Facebook; a photographed menu must be scanned automatically; an item
without a photo must show a known placeholder object instead of text, stated to be a placeholder; the home page must turn
into something useful after publishing; the product page needs a video, a live demo and an "analytics" feel.

## v2.1 Where things live (unchanged paths, one new folder)
`projects/menus/` in the Pages repo: `index.html` (+`mana.css`, `mana.js`, `img/`, `guide/`, new `privacy/`, `terms/`),
`studio/`, `ops/`, `view/`, `gen/`, **`stock/`** (new), `config.js`.
Sources: `/home/claude/work/menus/{brand/site, studio, ops, view, gen, stock}`. Each lane hands back a static folder.

`config.js` v2 (classic script, loaded by studio, viewer and the product page; every new key is optional for readers):
```js
window.HALOM_MENUS_CONFIG = {
  supabaseUrl: 'https://zemdhczqlhkabfwxccqq.supabase.co',
  supabaseKey: 'sb_publishable_2VJC5Vn-AlpkXKpQPOVnfA_5nirGaKS',
  shortBase: 'https://halom.io/m/',   // QR codes encode shortBase + slug + '?t=1'; links people share are shortBase + slug
  shortLive: true,
  viewPath: '../view/', genPath: '../gen/', stockPath: '../stock/', sitePath: '../',   // relative to studio/ (and to view/)
  auth: { providers: [] },            // any of 'google', 'apple', 'facebook': a button is shown only for the ones listed
  features: { scan: false }           // the product page talks about the menu scanner only when true
};
```

## v2.2 Snapshot additions (still `v: 1`; readers must ignore what they do not know)
- `business.kind`: `restaurant|cafe|bar|bakery|food_truck|hotel|other`.
- `item.asset` may be `{ "state": "stock", "id": "<stock id>" }`: the item has no approved picture of its own and the
  owner accepted a placeholder from the stock library. Order of precedence in the database: own approved picture, else
  stock, else `null`.

## v2.3 The stock library (placeholder pictures) — `projects/menus/stock/`
`stock.json`:
```jsonc
{ "v": 1,
  "label": { "he": "להמחשה בלבד", "en": "Illustration" },     // the words shown next to every placeholder
  "items": [
    { "id": "pizza",                       // ^[a-z0-9][a-z0-9-]{0,39}$ ; stored in the database, so it NEVER changes or disappears
      "group": "pizza",                    // picker section (see groups below)
      "name": { "he": "פיצה", "en": "Pizza" },
      "keys": ["pizza", "margherita", "פיצה", "מרגריטה"],     // words/phrases that mean this picture (any case, niqqud ignored)
      "cat": true,                         // optional: the keys may also be matched against the CATEGORY name
      "color": "img/pizza.jpg", "aux": "img/pizza.png", "thumb": "img/pizza_t.jpg",   // same three files as a relief asset
      "kind": "flat", "e": 53.0, "h": 0.0643, "o": null, "s": null,                   // same numbers as a relief asset
      "src": "base",                       // base = Halom's own generated relief · drawn = rendered from a model made in code
      "hidden": true                       // optional: retired from the picker, still drawn for items that use it
    } ] }
```
Groups, in picker order: `hot-drinks, cold-drinks, cocktails, wine, beer, breakfast, bakery, starters, salads, soups,
pizza, pasta, burgers, sandwiches, meat, chicken, fish, asian, sides, desserts`.
`match.js` (ES module next to it, no dependencies; already written and tested, `node --test tools/match.test.mjs`):
`normalize(s)`, `matchStock(manifest, {name_he,name_en,category_he,category_en}) → id|null` (cautious: a key must be in the
item NAME, or in the category name for `cat` entries), `explainStock(...)`, `searchStock(manifest, query, limit)` for the
picker, `stockLabels(manifest) → [{id,label}]` for the AI helpers, `stockAsset(manifest, id, baseUrl)` → a relief asset
object with absolute addresses, or `null` for an unknown id.
Load both at run time from `config.stockPath` (studio: `../stock/…`; viewer: `../stock/…` relative to the viewer folder,
which also holds under `/m/<slug>` because the viewer sets `<base href>`).

Rules:
- A placeholder is an illustration and must look like one. **Diner view:** drawn as an illustration and never as a
  photo relief: about 70% of its own colour and 30% toward the menu's accent, fine scan lines, slightly translucent,
  floating over a ring of light (as built in the fix round of 7 Oct; the first build was almost monochrome and was
  rejected), with the manifest's `label` visible next to the dish's
  name whenever that dish is in focus or open, and on its row in the list. **Owner app:** the thumbnail carries an
  "illustration" badge everywhere, and the screen where placeholders are accepted says once, plainly: guests see these
  marked as illustrations until you add your own photo.
- An unknown id (old menu, newer manifest) is treated as `asset: null`.
- Nobody generates allergens, tags, prices or descriptions from a placeholder.

## v2.4 Diner analytics (no cookies, no ids, nothing about the person)
- The viewer now calls `open_menu` instead of `public_menu` (which stays for old copies):
  `POST {supabaseUrl}/rest/v1/rpc/open_menu` · header `apikey` · body `{"p_slug":"…","p_lang":"he|en","p_src":"qr|link"}`
  → same answers as `public_menu`. `p_lang` = the language the menu opens in for this diner; `p_src` = `qr` when the
  address carries `t=1`, else `link`. One call per page load. Not called in `?demo=` or `?preview=1`.
- `POST …/rpc/track_item` · body `{"p_slug":"…","p_item":"<item uuid>","p_kind":"open|add"}` → nothing. `open` = the diner
  opened that dish (lift / details), at most once per dish per page load; `add` = put on "my table", at most once per
  dish per page load. Fire-and-forget (`keepalive: true`), never awaited, never retried, never in demo or preview.

## v2.5 Owner app ⇄ backend (see BACKEND.md "v2" for exact shapes)
`items.stock_id` (text|null) · `approve_asset(p_asset)` · `my_stats(p_business)` · edge function `menus-ai`
(`status`, `scan_menu` as a stream of JSON lines, `describe_dish`) · OAuth sign-in through supabase-js
(`signInWithOAuth`, PKCE flow so the answer comes back in the query string and does not fight the hash router).

## v2.6 Viewer addresses and switches (all of M1 still holds)
`/m/<slug>[?t=1]` · `?m=<slug>` · `?demo=<name>` · `?preview=1` (handshake unchanged) · `#c=<cat>&i=<item>` ·
new: `?capture=1` (deterministic clock for filming, see the viewer README) · in demo mode the viewer shows a small
"← Mana" link to `config.sitePath` (the product page).

## v2.7 Words
Owner-facing: "illustration" (he: "להמחשה") for placeholders; "scan your menu"; never "AI" as a selling word in the
diner view. Hebrew first, English second. Fewer words everywhere: a screen states its one job in a short title, the
rest is icons, pictures and the controls themselves. No paragraph of instructions where a 3-word label will do.


## Amendments v2, fix round (7 Oct 2026, evening)
- **Walk direction.** The guest view's default is `feed`: a swipe up, wheel down, ArrowDown, PageDown or Space brings
  the NEXT dish. `?walk=pull` or `config.walk = 'pull'` gives the opposite. The hint follows the direction in use.
- **One table.** The table fills the frame at every shape; a category change is a longer glide on the same table with
  the section's name lettered on the wood. The lamp dips only between table and bar.
- **Demo menus (`?demo=`).** The ordering button reads "להזמנה אונליין" / "Order online" and explains itself instead of
  leaving the page. Real menus keep "Order on <host>" and the business's own link.
- **Short links.** Under `/m/<slug>` the viewer writes `<base href="/mana/view/">` itself (until 12 Oct 2026:
  `/projects/menus/view/`), so the live routes `/m/:slug -> view/index.html` and `/mana/(.*)` are both required.
- **Published settings** (`projects/menus/config.js`): `auth.providers: []` and `features.scan: false` until the founder
  registers a sign-in provider and adds the scanner's key; then the lead flips them, after one real test each.

---
# Amendments r2 (13 Oct 2026, round two of the remaster) — optional snapshot fields; still `v: 1`, readers ignore what they do not know
Nothing in the backend changes: every field below is optional and the viewer infers what is missing. The viewer validates them
in `view/src/snapshot.js`; an invalid value is treated as absent.

- `category.room`: `table | vitrine | cellar | taps | cocktail`. The room of the place the category is shown in (see
  `view/README.md`, "The rooms of the place"). Absent or unknown → from `kind`: food → `table`, dessert → `vitrine`, wine →
  `cellar`, beer → `taps`, drinks → `cocktail`. `scene` keeps its meaning (`table` keeps the table, `bar` → the drinks room of
  the kind, `holo` → the projector) and `theme.surface = 'holo'` still makes every category a projection.
- `business.soldOut`: `bottom` (default) | `hide`. `bottom`: an item with `available: false` is shown at the end of its section,
  greyed and labelled sold out (this changes the rule above, "shown as sold out, not hidden": it is still shown, last). `hide`: it
  is not shown at all; a section with nothing left is not shown.
- `item.details.wine.taste`: `{ sweet?: 0..3 (dry, off-dry, medium sweet, sweet), body?: 1..3 (light, medium, full),
  acid?: 1..3 (soft, fresh, crisp), notes?: [mineral | citrus | redfruit | stonefruit | floral | oak | spice | earthy] }`
  (integers; unknown notes dropped; at most six).
- `item.details.beer.taste`: `{ style?: lager | wheat | pale | ipa | amber | stout | sour, bitter?: 1..3 (mild, balanced, bitter),
  notes?: [citrus | malt | roast | hop | sour | fruit | spice] }`.
  Without `taste`, the viewer reads the existing fields (`wine.color`, `wine.notes.*`, `beer.style`, `beer.abv`) and, marked as
  suggested, the merchant's own description words (`view/src/drinks/taste.js`). Nothing is ever shown that the merchant did not
  enter or write.
