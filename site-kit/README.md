# Site kit, v1

A menu-first one-page restaurant site, generated from a published menu snapshot (the same `menu.json` the guest menu
reads). One static HTML file and the pictures it shows. Nothing is loaded from anywhere else: no fonts, no scripts, no
analytics, no iframes. Hebrew first (RTL), English on a toggle. Mana's design tokens are inlined. JSON-LD
`Restaurant` + `Menu` is written from the snapshot only: no hours, phone or address that the snapshot does not have.

```
node site-kit/build.mjs apps/view/demo/olea/menu.json site-kit/out/olea            # → site-kit/out/olea/index.html + img/
node site-kit/build.mjs <menu.json> <outdir> --menu https://halom.io/m/<slug>   # where "Open the menu" goes
                                             --demo                              # a demo: the demo line and the AI label
                                             --index                             # let search engines index it (off by default)
cd site-kit && npm test                                                        # builds Olea and reads the HTML (7 tests)
```

What the page has, from the snapshot:

- the restaurant's name (`business.name`, both languages) and cuisine; a hero with the first dish that has a photo
  (`asset.color`), its name and price, and **Open the menu** to the guest menu;
- **Book a table** when `business.bookUrl` is an https URL (left out otherwise); **Order** when `business.orderUrl` is;
- the menu as readable HTML: every section and dish, descriptions, allergens, tags (vegan, vegetarian, gluten-free,
  spicy), price notes (glass, bottle…), wine and beer details when present, **Sold out** when `available` is false;
  prices in ₪ with tabular numerals, always left to right;
- where / when / phone from `business.area` (or `address`), `business.hours`, `business.phone`, each left out when absent;
- a demo line and the AI label ("מנות לדוגמה · נוצרו בבינה מלאכותית" / "Demo dishes · made with AI") on a demo
  (`slug` olea, or `--demo`), on the hero and on every section that shows generated dishes;
- `<meta name="robots" content="noindex">` until the owner asks for `--index`: a generated site is a preview first.

`site-kit/out/` is git-ignored. Fonts are a system stack (Frank Ruhl Libre and IBM Plex Sans Hebrew when the device has
them); self-hosting the menu's fonts is a v2 question (it adds ~140 kB). The guest menu URL defaults to
`https://halom.io/m/<slug>`; pass `--menu` for a demo or a preview.

The words: a dish is a relief from one photo; the page never says "3D". Hebrew strings are listed for the native read.
