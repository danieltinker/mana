# Where the placeholder pictures come from

Mana shows these pictures for a dish that has no photo of its own. They are illustrations and are always labelled
"להמחשה בלבד · Illustration". None of them is a restaurant's real dish.

No third-party asset is in this folder: no stock photo, no downloaded model or texture, no font inside a picture.
No picture shows a brand name, a logo or readable text.

## 41 pictures from Halom's own reliefs (`"src": "base"`)

Copied unchanged from `../base/img/`: the dish previews Halom generated for its ten demo menus (Higgsfield
`gpt_image_2_5`, see the project doc `ops/hologram-menu-pipeline.md`, section 4) and turned into reliefs with Halom's
own pipeline (two Apache-2.0 models). The dish lists were read on 2026-10-03 and the relief files are dated 2026-10-05,
so the pictures were generated between those days; the exact day of each is not recorded here.
The demo dishes carried restaurant and brand names in their titles (a beer, a wine); the pictures themselves were
checked at full size on 2026-10-07 and show plain glasses and unlabelled bottles.

| id | relief in `base/img` | generated as |
|---|---|---|
| `turkish-coffee` | `yaffa-knafeh-9` | Small Pot of Cardamom Coffee |
| `orange-juice` | `cafe-shneor-9` | Fresh Orange Juice |
| `lemonade` | `hadayagim-8` | Pitcher of Lemonade |
| `iced-tea` | `koko-neko-8` | Bancha |
| `cocktail` | `hamburger-26-9` | Negroni |
| `white-wine` | `juno-9` | Parini Pinot Grigio |
| `beer` | `hadayagim-9` | Weihenstephan Draught |
| `israeli-breakfast` | `cafe-shneor-3` | Good Morning Zalman |
| `shakshuka` | `cafe-shneor-0` | Shakshuka |
| `french-toast` | `cafe-shneor-2` | Jamie’s French Toast |
| `hummus` | `abu-hassan-0` | Hummus |
| `labaneh` | `abu-hassan-3` | Labaneh |
| `falafel` | `abu-hassan-6` | Falafel, Small |
| `salad` | `hadayagim-2` | Arabic Salad |
| `caesar-salad` | `hamburger-26-0` | Salade Cesar |
| `soup` | `busi-1` | Bean Soup |
| `pizza` | `pizza-lila-0` | Margherita |
| `pasta` | `cafe-shneor-5` | Salmon Pappardelle |
| `ravioli` | `juno-5` | Ricotta & Spinach Tortellini |
| `gnocchi` | `juno-6` | Chestnut Gnocchi |
| `burger` | `hamburger-26-6` | Foie Gras |
| `falafel-pita` | `abu-hassan-4` | Falafel in Pita |
| `kebab` | `busi-3` | Kebab in Pita |
| `skewers` | `busi-8` | Foie Gras Plate |
| `shawarma` | `busi-6` | Shawarma Plate |
| `chicken-skewers` | `thai-sinai-1` | Satay Gai |
| `fish` | `hadayagim-3` | Sea Bream |
| `fish-and-chips` | `hadayagim-5` | Fish and Chips |
| `shrimp` | `hadayagim-6` | Shrimp or Calamari in Garlic, Butter and Wine |
| `ramen` | `koko-neko-0` | Shoyu Ramen |
| `gyoza` | `koko-neko-3` | Pork Gyoza |
| `fried-rice` | `juno-7` | Asia |
| `curry` | `cafe-shneor-4` | Yellow Vegetable Curry |
| `fries` | `abu-hassan-7` | Fries, Small |
| `cheesecake` | `cafe-shneor-7` | Basque Cheesecake |
| `cake` | `cafe-shneor-8` | Homemade Carrot Cake |
| `pancakes` | `koko-neko-7` | Caramel Banana Pancake |
| `ice-cream` | `yaffa-knafeh-8` | Ice Cream Cup |
| `creme-brulee` | `hamburger-26-8` | Creme Brulee |
| `knafeh` | `yaffa-knafeh-0` | Personal Knafeh |
| `malabi` | `yaffa-knafeh-6` | Malabi |

## 26 pictures drawn in code (`"src": "drawn"`)

Each is a small 3D model written by hand as a distance function in `tools/drawn/objects/<id>.glsl`, lit and rendered by
`tools/drawn/lib.glsl` in headless Chromium (software WebGL) on 2026-10-07, on this machine, with no network. No image,
3D or other generation service was used and nothing was paid for. The height picture is exact: it is measured from the
model, not estimated.

`cappuccino`, `espresso`, `tea`, `iced-coffee`, `soft-drink`, `water`, `milkshake`, `smoothie`, `red-wine`, `yogurt-granola`, `croissant`, `bagel`, `muffin`, `cookie`, `sandwich`, `toast`, `hot-dog`, `taco`, `steak`, `schnitzel`, `sushi`, `nigiri`, `noodles`, `brownie`, `waffle`, `fruit-salad`.

## Words

The match words in `stock.json` include names of well-known beers and soft drinks (so that an item called
"גולדסטאר" finds the beer picture). They are words to search by. They are never shown to a guest.

## Built with

Python 3 with Pillow, numpy and OpenCV; Node with Playwright and Chromium. All are build tools; none is shipped.
Rebuild everything: `python3 tools/build_from_base.py && node tools/drawn/render.mjs && python3 tools/drawn/build_drawn.py
&& python3 tools/sheets.py && python3 tools/notice.py`, then `node --test tools/match.test.mjs`.
