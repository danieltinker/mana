# Seating — a guest asks for an area or a table, the owner approves

What this folder holds: the two contracts (`layout.v1`, `booking_request.v1`), their validator and the request state
machine (`validate.mjs`, pure ESM, no dependencies), the demo room (`fixtures/olea.layout.json`) and the Blender bake
(`blender/`). The pages that use them are in the guest menu: `view/seat/` (the page), `view/src/seat/` (its code),
built into `view/seat.js` by `view/tools/build.mjs` next to `app.js`. Tests: `view/test/seat.test.mjs` (contracts, state
machine, who fits where, the store) and `view/test/seat.browser.test.mjs` (the flows, keyboard only too, the Book button).

```
seat/?demo=olea            the guest's seat map (Hebrew; &lang=en)          seat/?demo=olea&owner=1   the owner's requests
```

Today the seat map is a **preview**: Olea is invented, its room is invented, the requests stay in the browser. The
pilot is the menu. In the pitch it is said so ("this is what comes next").

## layout.v1 — a room

One JSON per venue. Metres; `x` runs along the room's width, `z` along its depth, `(0,0)` is the top-left corner of
the plan. `validateLayout(raw) → { ok, layout | errors }` returns a normalised copy or every reason it was refused.

| Field | Type | Meaning |
|---|---|---|
| `v` | `1` | contract version |
| `venue` | slug `^[a-z0-9][a-z0-9-]{0,63}$` | the menu's slug |
| `note` | string ≤ 300, optional | e.g. "an invented room" |
| `room` | `{ w, d }` metres, 1–200 | width and depth |
| `walls[]` | `{ from: [x, z], to: [x, z], kind: "wall" \| "window" \| "door", gap?: [start, end] }` | a door's `gap` is where along the wall it opens (metres from `from`); the plan draws the leaf's swing there |
| `zones[]` | `{ id, name: { he, en }, rect: [x1, z1, x2, z2] }` | the areas a guest picks first; ids `^[a-z0-9][a-z0-9_-]{0,39}$`, unique; rects inside the room |
| `tables[]` | `{ id, zone, x, z, rot, shape: "round" \| "square" \| "long" \| "bar", seats 1–40, minParty, maxParty, bookable, name? }` | `x, z` is the centre; `minParty ≤ maxParty ≤ seats`; `bookable: false` draws a table nobody books (the bar counter); `name` (≤ 40) is what the table is called, else "Table n" by its position in its zone |
| `tableChoice` | boolean, default `true` | the owner's switch: `false` lets guests pick an area only (step 3 disappears) |

Who fits: `fits(table, party)` = bookable and `minParty ≤ party ≤ maxParty`. `tablesFor(layout, party, zone?)`,
`zonesFor(layout, party)` (zones with at least one fitting table) are what the page dims by.

## booking_request.v1 — a request

`validateRequest(raw, layout?) → { ok, request | errors }`. With a layout, the zone and the table are checked against
it (the table must be in the zone and fit the party).

| Field | Type |
|---|---|
| `v` | `1` |
| `id` | `^[A-Za-z0-9_-]{4,64}$` |
| `venue` | the layout's `venue` |
| `zone` | a zone id |
| `table` | a table id in that zone, or `null` ("any table in this area") |
| `date`, `time` | `YYYY-MM-DD`, `HH:MM` (24 h) |
| `party` | integer 1–40 |
| `name` | 1–80 characters · **personal data** |
| `phone` | `^\+?[0-9][0-9 \-]{4,19}$` · **personal data** |
| `note` | ≤ 300, optional |
| `status` | `pending` \| `approved` \| `declined` |
| `reason` | ≤ 200; required when declined, forbidden otherwise; the guest reads it |
| `createdAt`, `decidedAt` | ISO dates, optional |

### The state machine (`transition(request, action, layout, { now }) → { ok, request | error }`)

```
pending ──approve({ table? })──▶ approved ──swap({ table })──▶ approved
pending ──decline({ reason })──▶ declined
```

- `approve` may carry another fitting table: the owner moves the party (the zone follows the table). `table: null`
  confirms the area only.
- `decline` needs a non-empty reason; it is the line the guest sees.
- `swap` changes an approved request's table (Tabit's host flow: a pre-assigned table the host can move on the floor map).
- `approved` and `declined` never go back to `pending`; a second approve or decline is refused. Every refused move
  returns `{ ok: false, error }` and leaves the request as it was.

`newRequest(fields, layout, { id?, now? })` builds a pending request from what the guest typed.

## The guest flow (`view/seat/?demo=<slug>`)

1. **When** — date, time, how many. The party decides which tables fit; from here on the plan dims the rest.
2. **Area** — the zones light up; one with nothing for this party is disabled and says so ("No table for 3 here").
   Tapping a zone on the plan is the same as choosing it in the list.
3. **Table** (if the venue allows it) — the fitting tables in that area, or "any table in this area". A tap on the plan
   picks a table too; the list (`role="listbox"`, arrow keys, Enter) is the keyboard and screen-reader path.
4. **Details** — name, phone, a note. In the demo the name and phone are prefilled, fictional and labelled so.
   "Send request" writes a pending request to the session store. The guest sees "Request sent · the restaurant
   confirms", and on return (same tab) the current state: pending, approved (with the table), declined (with the reason).

The plan is one SVG drawn from the layout (walls, door swing, window, zones as soft areas, tables by shape with their
seats, numbered). Yolk marks only the chosen thing. It arrives once (600 ms); a change takes 240 ms; reduced motion
shows it still. The sheet under it is the page's one glass element (tint only on phones; blur on a desktop). Every
step works by keyboard alone; targets are 44 px; `lang` and `dir` follow the language.

## The owner flow (`&owner=1`)

Pending requests first, then decided ones. A request shows its guest, party, date and time, the area or table, and the
note. For a pending request: **Approve** (as asked), **Swap table** (a list of the tables that fit the party; the plan
previews the move; then approve with it), **Decline** (a reason the guest will read, required). An approved request
can still be moved to another fitting table. The plan shows the selected request's area and table.

Both pages read the same session store, so in one browser the round trip is: send → the owner's screen → approve →
back → "Your table is confirmed".

## Data rules

- A name and a phone are personal data. **In the demo they are fictional, labelled, and live only in `sessionStorage`**
  of that tab (`mana-seat:<venue>`); nothing is sent anywhere and the tab's close erases them. No seed data, no real
  names anywhere in this repository.
- In production a request is a row behind RLS: the guest's anonymous insert through a function, owner-only reads,
  no listing across venues, and a retention period Daniel sets (then the row is deleted or the name and phone are
  blanked). Counting (`track_menu(slug, 'seat')`, proposed `db/proposed/0004_events.sql`) counts taps, never people.
- `business.bookUrl` (an https URL or absent; anything else is dropped by the snapshot) is the venue's own booking
  page: the guest menu's "Book a table" opens it in a new tab. A demo's button opens this seat map instead.
  Never counted in a demo.

## How a real venue's layout is made (later)

1. The owner sends three or four photos of the room from the door and the corners, and the number of seats per table.
2. Halom traces the plan: walls, the door, the window, zones, tables by shape, in metres (a phone LiDAR scan — Polycam
   or Scaniverse — gives the room's measures when the photos are not enough; R3 §1). The result is a `layout.v1` file,
   checked by `validateLayout`, and the plan above is drawn from it with no further work.
3. The page's "2D / 3D" toggle (`view/src/seat/room3d.js`, loaded on the first tap) draws the same layout standing up
   with three.js r128, the guest menu's own copy (esbuild puts three.js in one shared chunk; no second copy). 2D stays
   the default and the fallback: no WebGL, or a slow first frame (over 400 ms) or ten slow ones (over 70 ms on average)
   and the page is back on the plan with the toggle gone. `?view=3d` opens in 3D, `?adapt=off` keeps it in software GL.
4. `blender/bake.py` builds the same layout in Blender (bpy 5): floor, walls with the door's opening and leaf, the
   window, each zone's patch, tables by shape with their chairs, simple warm materials, one lamp, exported as a GLB
   (`python bake.py fixtures/olea.layout.json out.glb`). Olea's room: 150 objects, 292 kB, about 2 s on a laptop-class
   CPU. The GLB is a hand-off to the photo-textured and splat rooms (R3 §2.2); the page does not load it yet, and a GLB
   over 3 MB is never committed.
5. Later still: a splat or photo-textured mesh for believability, with the plan's tables as colliders (R3 §2.2).

## The table clock (`timers.mjs`) and the host board (`view/host/`)

How long a party keeps its table, when the manager hears about it, and when the table frees itself. Pure functions,
no DOM, no clock of their own (`now` is passed in), immutable JSON state `{ v: 1, … }`; tests in `timers.test.mjs`
(run by `cd view && npm test`).

- The venue's default frame: 15–360 minutes in steps of 5, 90 unless the owner changes it; any table may have its own
  (in the demo the bar 45, the long table 150). A setting changes the next seating, never a running one.
- free → seated → `ending` (5 minutes or less left, a setting) → `over` (time is up) → free. Time is up: the table
  counts as free for availability at once (`availableAt`), the manager is alerted once, and the board shows it over
  until he extends or frees it, or the grace period (10 minutes, a setting, at least 1) passes and it frees itself.
- `extend` (+15 by default, any number of times) moves a running seating's end; after time is up it runs from now
  (to the whole minute). An extension sets a new end, which can alert once more.
- `tick(state, now) → { state, events }`: `ending`, `over`, `freed`, each once per seating end; after a gap (the board
  was closed) only what is still true is reported. `status`, `availableAt`, `byUrgency` read the state;
  `validateState` checks what comes back from storage. Bad input throws a `TimerError` with a plain reason.

```
host/?demo=olea            the manager's board (Hebrew; &lang=en, &view=list, &speed=60 for a pitch: a minute a second)
```

The board is a demo: Olea's room from `fixtures/olea.layout.json`, the floor in `localStorage` (`mana-host:v1:olea`),
four tables seated on first load (one ending soon), nothing sent anywhere. A party is a number; no names. When it goes
live: `db/proposed/0006_table_clock.sql` (not applied).

## Hebrew for the read

Every Hebrew line on these pages is new tonight and is listed in the night report for Rami's 10:00 read.
