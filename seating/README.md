# Seating — a guest asks for an area or a table, the owner approves

What this folder holds: the two contracts (`layout.v1`, `booking_request.v1`), their validator and the request state
machine (`validate.mjs`, pure ESM, no dependencies), the demo room (`fixtures/olea.layout.json`) and the Blender bake
(`blender/`). The pages that use them are in the guest menu: `view/seat/` (the page), `apps/view/src/seat/` (its code),
built into `apps/view/seat.js` by `apps/view/tools/build.mjs` next to `app.js`. Tests: `apps/view/test/seat.test.mjs` (contracts, state
machine, who fits where, the store) and `apps/view/test/seat.browser.test.mjs` (the flows, keyboard only too, the Book button).

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
| `zones[].outdoor` | boolean, optional | the zone is outside (a terrace line); kept only when the file has it |
| `tables[].look` | `{ top: "marble" \| "wood" \| "iron" \| "glass", seat: "chairs" \| "bench" \| "stools" \| "velvet" \| "sofa", w, d? }`, optional | how the table looks in the 3D place and its top's size in metres (0.3–4; round: `w` is the diameter); kept only when the file has it |
| `fixtures[]` | `{ kind, rect?: [x1, z1, x2, z2], at?: [x, z], name?: { he, en } }`, optional (always `[]` in the normalised copy) | the room's fixed things, a rect or a point, up to 2 m past the room (a tree on the pavement). Kinds: `walkway` (kept clear), `closed` (not the venue), `kitchen`, `hatch` (a street-side window), `counter`, `vitrine`, `espresso`, `fridge`, `shelf`, `bench`, `banquette`, `post`, `planter`, `tree`, `awning`, `lamp`. An unknown kind is refused with a reason. None is booked. |

The three optional fields arrived with Café Lima (round two); Olea's layout and every page that reads layouts work as
before. Lima's convention, used by its 3D place and plan: `x` runs along the façade from the left as seen from the street,
`z` from the kerb inwards; the plan draws the street at the bottom.

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
3. The page's "2D / 3D" toggle (`apps/view/src/seat/room3d.js`, loaded on the first tap) draws the same layout standing up
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
(run by `cd apps/view && npm test`).

- The venue's default frame: 15–360 minutes in steps of 5, 90 unless the owner changes it; any table may have its own
  (in the demo the bar 45, the long table 150). A time frame changes the next seating, never a running one; the warning threshold and the grace period apply at once, to running seatings too.
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

## Café Lima: the place system's proof of concept (`view/floor/`)

```
floor/?demo=lima                       the counter's board (Hebrew; &lang=en, &speed=30 for a pitch, &gl=off for the 2D plan)
floor/guest.html?demo=lima&table=t3    the guest's phone, opened from the QR on table 3 (also inside the board: "Guest's phone")
```

Café Lima is the demo venue. Its floor, `fixtures/lima.layout.json`, is **a first draft drawn from six photos**: every measure
is an estimate (about ±0.5 m), no people and no photos are in it. Outside, two messy lines (by the street, along the
wall) under three awnings; inside, the banquette row with four marble tables, one table by the door, the sofa corner; the
counter with its vitrine behind a glass partition on the left as you come in. 16 tables, 44 seats. What changed from
Claude's first sketch: the counter faces the room from behind the partition (the sketch had it against the façade, with
no room for the barista); a table moved from the street line in front of the street window (the photos show that space
empty) to the left line, with saddle stools; the entrance is wider (about 2.1 m) and the glazing beside it is drawn; the
arched doorway at the back sits left of the banquette; the table by the door is closer to it; the glass-top table stands
across the line (its long side faces the street).

**The 3D place** (`apps/view/src/room/`: `build.js` builds it, `place.js` runs it, `plan2d.js` is the plan) is built from the
layout with three.js r128 (the guest menu's copy, one chunk loaded only when the stage goes 3D). Walls with their openings,
glazing, shutters, two arched doorways, the awnings, posts, the ficus and the potted fig, terrace tiles, pavers, the
red-and-white kerb, terrazzo inside; furniture by `look`; table states as a ring and glow on the floor with the minutes
floating above; violet when a bid holds a table. The camera orbits, pans and zooms (mouse, touch, keys: arrows,
shift+arrows, +/−, 1/2/3 for the presets), flies to a table, drifts gently when untouched; walls between the camera and
what it looks at fade. "The table sets itself": a cloth floats down, then plates, cutlery, glasses and a candle drop in
with a small bounce, and the table glows once (about two seconds; reduced motion: set at once). No WebGL, a lost context
or a first frame over 4 s and the stage is the 2D plan.

**Time frames** use `timers.mjs` as it is: the board asks `peaks.mjs frameFor()` and passes the minutes to `seat()`. First
match wins: the table's own frame → at peak, the zone's peak frame → at peak, the venue's peak frame → the zone's frame →
the default. The example: the sofa corner 120, and at peak the tables along the wall 60 (laptop tables), the rest 75.

**Peak windows** (`peaks.mjs`): days (0 = Sunday) and hours in the venue's time zone. The example is every day 10:00–13:00
and says "Example" wherever it shows; the demo clock starts at 09:35.

**Orders** (`orders.mjs`): the counter adds an order (a number 1–99, optionally a table); New → Preparing → Ready → Picked
up; Ready is one big tap and may come straight from New; Undo steps back once. The guest's phone follows the receipt's
number, or the order the counter attached to its table. Items are plain names from a small sample list; there are no
prices anywhere (we have none to show).

### Bidding on tables at peak (`bids.mjs`)

It should feel like reserving the best seat, not paying for a chair.

1. The owner chooses which tables can be bid for (the example: the sofa corner and the long wooden table), a minimum bid
   and a step (the example: ₪10 and ₪5, sample values), and whether the winning amount is credited to the guest's order
   (default yes).
2. Bidding is per table and per slot of a peak window (slots are back to back from the window's start, 90 minutes in the
   example). It opens 120 minutes before the slot and closes 10 minutes before it (the owner's settings).
3. A bid is a whole amount ≥ the minimum; when someone leads, ≥ the leader's amount + the step. The party must fit the
   table. The leader cannot outbid himself. A guest leads at most one table per slot.
4. When bidding closes the highest bid wins: the table is held for that slot (violet on the board and the phone) from the
   slot's start (or from the owner's early accept, if that came later) to the slot's end, so back-to-back slots never
   hold one table twice; the other bids are released, the board seats the winner when they arrive. The owner may accept the leading bid early,
   decline an auction with a reason the guests read (every bid is released), or release a held table.
5. When the owner changes the peak hours, an open auction whose slot no longer exists is declined, and so are the open
   auctions of a table taken off the list: the guests read "this time is no longer open". Peak windows of one day may
   not overlap. A bid is checked against the stored auction's own close too.
6. Nothing is charged: in the demo the amounts are samples and every screen says so. In production a won bid becomes a
   credit or a charge only through `db/proposed/0005_payments.sql`'s rules (not decided here).

```
open ──bid──▶ open (the new bid leads; the previous leader is outbid)
open ──close at closesAt──▶ won (highest) | unsold (no bids)        open ──accept (owner)──▶ won
open ──decline (owner, a reason)──▶ declined                        won ──release (owner)──▶ released     won ──slot ends──▶ done
```

### How the board and the phone talk, and what production needs

In the demo they share this browser's `localStorage` (one versioned key per part: `mana-floor:v1:lima:timers`, `:orders`,
`:bids`, `:rules`, `:clock`, `:layout`, `:ui`) and a `BroadcastChannel('mana-floor:lima')` that says which part changed:
two tabs, or the phone frame inside the board. Every part passes its validator on the way in. Nothing leaves the browser.

A real deployment needs: a realtime channel (Supabase Realtime on the venue's orders and auctions); the tables behind RLS
(`db/proposed/0007_floor.sql`, a proposal, never applied: the owner reads and writes his venue; a guest is an anonymous
session that bids and follows its own order through security-definer functions and never sees who else bid); a clock on
the server (`close_due_auctions()` every minute); and, for a **locked phone, Web Push**: a service worker, a push
subscription per guest and a sender function. Until then the beep works while the page is open (and the notification when
the guest allowed it). That piece is Daniel's.

### Edit mode

"Edit the floor" on the board: drag a table on the 3D floor or on the top view (snaps to 5 cm), arrow keys move it (shift:
50 cm), R rotates 15° (shift+R back); add from a small palette (round for 2, round for 3, square for 2, long for 4, a
lounge), duplicate, delete, change seats and party sizes and the zone, undo / redo (also Ctrl+Z / Ctrl+Shift+Z). Warnings
say when two tables (with their chairs) are in each other's way or a table stands outside the café (on the pavement, in
the kitchen, behind the counter, or in no zone). Save passes `validateLayout` and keeps the floor in `localStorage`
(`mana-floor:v1:lima:layout`); Reset goes back to Lima's draft; Export downloads the layout as JSON. The rules are
`edit.mjs` (pure, tested).

### From photos to a 3D place: the onboarding (later; not built)

Daniel: "if this good we put this feature inside the onboarding process where we will ask the user to take pictures and
explain the spaces inside his restaurant."

- **The photos the owner takes** (the owner app walks him through them, one screen per photo, with an example): from the
  door looking in; from each corner of each room; each outdoor line from both ends; the counter (from the guest's side);
  the façade from across the street. Phone held level, at chest height, in daylight, no people where possible.
- **The questions** (one per screen, with the photo above it): the areas and their names (as guests say them), inside or
  outside, how many seats each table has and the smallest party it takes, which tables can be bid for at peak, the peak
  hours, the default time frame and any shorter one at peak.
- **What Halom does with them today**: this draft, by hand. Claude traces the plan from the photos into `layout.v1`
  (walls, openings, zones, tables with their looks, fixtures), checks it with `validateLayout`, and the owner corrects it
  in edit mode. The measures are estimates.
- **A better pipeline later**: a phone LiDAR scan (Polycam or Scaniverse on an iPhone Pro) gives the room's true measures
  and a textured mesh; photogrammetry from a short video does the same without LiDAR; Gaussian splats give a
  photo-real place to look at. Either way the tables stay `layout.v1` (the scan is the backdrop, the layout is what is
  booked, timed and bid for), placed on the scan in edit mode, so everything here keeps working.

## Hebrew for the read

Every Hebrew line on these pages is new tonight and is listed in the night report for Rami's 10:00 read.
