# The Lift: a Mana food film made in code

Concept 1 of `ventures/mana/food-films-2026-10-12.md` (route a: no credits). One picture of a dish, the colour photo and
its relief map from Mana's generator, becomes a 10-second vertical film:

| Seconds | What happens |
|---|---|
| 0–2 | The dish lies flat on oak, like a print. A low light from behind crosses the boards. |
| 2–5 | The camera pushes in and comes down to the photo's own angle; the dish rises into its relief and its shadow grows. |
| 5–8 | It turns toward the light and back (17° at most) while the light passes over it; a highlight slides on what is wet. |
| 8–10 | It is set down. "See the dish before you order." and the mark with "Menu by Mana". |

Nothing is added to the food: the colour is the photo's own. Code moves the camera, the light and the plate, never the
food, and never tilts past 20°.

```
node brand/tools/lift/render.mjs --view <folder of the guest view with its media> [--dish shakshuka] [--lang en|he|both]
     [--label demo|real] [--scale 0.5] [--stills 0,3,6.5,9.5] [--out <folder>]
```

`--view` is a copy of the published viewer folder (`halom-projects: projects/menus/view`): the pictures, fonts and table
textures are not in this repository. three.js comes from `work/mana/view/node_modules`. A full-size frame (1080 × 1920)
takes about 3.4 s in headless Chromium with software WebGL, so a film is about 17 minutes per language.

The label on the frame follows the film's own captions table: `demo` ("Demo dish · made with AI") for Olea, whose pictures
are generated; `real` ("One real photo. Depth and light are computed.") only for a real venue's own photo, with its
written yes. Silent: the sound (a knuckle on wood, a low tone, a plate set down) is to be recorded, not synthesised.
