# Mana: the selling film (41 seconds, silent)

One timeline, two cuts: 16:9 (1920 × 1080) for the product page and desktop, 9:16 (1080 × 1920) for phones, Reels and
WhatsApp. Captions are burnt in, Hebrew or English. The timeline is `timeline.json`; the renderer is `compose.mjs`
(its header says how to run it). Every shot has its real clip since 7 Oct 2026 (the table below says where each came
from). A shot whose clip is missing is drawn from today's pictures and carries a yellow PLACEHOLDER tag.

## The story

A printed menu → photographed once → the dishes load → one photo becomes a relief → a guest glides along the table and
lifts a dish → the owner sees what guests opened → one code on the table → Mana.

| # | Seconds | What is on screen | Clip | Caption (HE) | Caption (EN) |
|---|---|---|---|---|---|
| 1 | 0–4 | A printed menu lying on a table. Slow push in. | `menu-paper` | התפריט שלכם, כמו שהוא. | Your menu, as it is. |
| 2 | 4–9 | The owner app on a phone: the menu is photographed and read; the count of dishes climbs. | `owner-scan` | מצלמים אותו פעם אחת. | Photograph it once. |
| 3 | 9–13 | The dishes are in the app, each with an illustration marked as one. | `owner-menu` | המנות נטענות לבד. | The dishes load themselves. |
| 4 | 13–18 | One dish: the owner's phone photo, then its relief beside it; Approve. | `owner-relief` | תמונה אחת הופכת לתבליט. | One photo becomes a relief. |
| 5 | 18–27 | The guest's view: the table glides, a dish is lifted and turned, and set down. The longest shot, the largest phone. | `guest-glide` | הסועדים רואים את המנה לפני שמזמינים. | Guests see the dish before they order. |
| 6 | 27–32 | The owner's home screen with numbers: views, top dishes, busy hours. | `owner-dashboard` | ואתם רואים מה הם פתחו. | And you see what they opened. |
| 7 | 32–36 | The table card with the QR code, standing on a table. The code opens the Olea demo. | `qr-table` | קוד אחד על השולחן. | One code on the table. |
| 8 | 36–41 | End card: the mark, מנה / Mana, "Mana by Halom", halom.io/mana, the offer, and at the foot "Dreams, realized · חלומות מתגשמים". | (drawn) | 30 יום חינם | Free for 30 days |

Captions: 36 words in Hebrew, 43 in English, counting the small line under the guest shot's caption ("תפריט הדגמה ·
תמונות להמחשה" / "Demo menu · sample pictures"). Shots cross-fade over 0.4 s. A caption arrives 0.3 s into its shot. In the
wide cut the phone stands on the side where the line of text ends (left in Hebrew, right in English); in the tall cut
the caption is above the phone. In the two full-picture shots the caption sits where the picture is quiet: `captionAt`
in the timeline says top or bottom, per cut.

Everything shown must be the product. Olea is an invented restaurant and its pictures are computer-made samples: the
guest shot carries the viewer's own small "demo" label, and because that label is too small to read in a film, the same
words the product page uses stand under the caption (`note` in the timeline). Nothing in the film says otherwise.

## Where the clips came from (7 Oct 2026)

| Clip | Made by | What it is |
|---|---|---|
| `guest-glide.mp4` | viewer lane, `tools/film.mjs` + `films/guest-glide.json` | the new guest view, Hebrew, 780 × 1688, 9 s. Recorded a second time at 19:36 UTC (marker `GUEST_READY2`): the ordering button in the lifted dish's sheet now reads "להזמנה אונליין". The page's Hebrew hero loop, its poster and the "Play with it" still are made from this file too (`to-site.mjs --hero`, then `build-site.mjs --poster-from-video --demo-still-from-clip`). |
| `owner-scan.mp4`, `owner-menu.mp4`, `owner-relief.mp4`, `owner-dashboard.mp4` | owner-app lane, `test/film.mjs` | the real app on the local test stack, Hebrew, 780 × 1688, 5 / 4 / 5 / 5 s |
| `menu-paper.jpg`, `qr-table.jpg` (3840 × 2160) and `menu-paper-9x16.jpg`, `qr-table-9x16.jpg` (2160 × 3840) | this lane, `node tools/film/stills.mjs` | designed pictures, not photographs: the Olea menu typeset as a printed page on a table, and the A6 table card from `print/cards/olea/` standing on a table. The script reads the QR code back from each picture and fails unless it says `https://halom.io/mana/view/?demo=olea`. A file named `<clip>-9x16.jpg` is used in the tall cut. |

The owner app and the guest view were recorded in Hebrew only, so the English cuts show Hebrew screens under English
captions. The two stills are illustrations; when real photographs exist, drop them in under the same names.

## The clips I need (put them in `tools/film/clips/` under these names)

Phone recordings: the screen only, no device frame, no status bar, **390 × 844 CSS pixels recorded at 2× (780 × 1688)**,
30 fps, H.264 MP4 (any format ffmpeg reads will do). A longer clip is cut at the end of its shot; a shorter one holds
its last frame. Leave half a second of stillness at the start and the end of each.

| File | Length | What happens in it |
|---|---|---|
| `guest-glide.mp4` | 9 s | The new guest view, `?demo=olea&capture=1`, Hebrew (`-en` not needed: one cut serves both). Second 0: the first dish in focus. 0.5–4: two glides up the table, one dish each, the second a little faster. 4.5: tap, the dish lifts. 5–7.5: it turns left, then right. 8: it is set down. 9: still. The viewer lane's 8–10 s hero loop can be used as it is; the same file is the product page's `img/hero.mp4`. |
| `owner-scan.mp4` | 5 s | Owner app, Menu → Scan: the photographed page on screen, "Reading your menu… N dishes" counting up as sections and dishes arrive. Use the local stand-in of the scanner, with the Olea menu page. |
| `owner-menu.mp4` | 4 s | The scan's review screen or the Menu tab: the dishes listed with prices, illustration thumbnails with their "Illustration" badge. A short scroll at most. |
| `owner-relief.mp4` | 5 s | One dish's picture: the phone photo, then the relief result beside or after it, then Approve pressed. A real phone photo (`site/img/howto-photo.jpg` is the one the page used). |
| `owner-dashboard.mp4` | 5 s | Home after publishing, with data: the tiles drawing in (views this week, top dishes, busy hours, tourists, from the QR, "my table"). Demo data is fine if it is plausible. |
| `menu-paper.jpg` (or `.mp4`, 4 s) | still | A printed menu on a table, seen from a seat, the page readable, 3840 × 2160; add `menu-paper-9x16.jpg` (2160 × 3840) framed for the tall cut. Today both are designed pictures from `stills.mjs`. |
| `qr-table.jpg` (or `.mp4`, 4 s) | still | The printed A6 table card (`print/cards/olea/`) standing on a table, QR sharp and opening a live page, 3840 × 2160; `qr-table-9x16.jpg` for the tall cut. Today both are designed pictures from `stills.mjs`. |

English cuts use the same clips; only the captions change. If you record the owner app in English too, name those
`owner-scan-en.mp4` and so on and tell me: the composer does not pick language-specific clips yet.

## What to check before a film goes on the page

1. `node tools/film/compose.mjs --scale 1 --lang both` prints "placeholders: none".
2. Watch both cuts once at full size; read every caption aloud at the speed it is shown.
3. The demo label is visible in the guest shot (the small line under its caption).
4. `node tools/film/to-site.mjs` (and `--lang en`) puts the cuts in `site/img/` as `film-16x9.mp4`, `film-9x16.mp4`
   (`-en` for English), each at most 8 MB; then `node tools/build-site.mjs`, `node tools/test-site.mjs film`, and
   `node tools/film/proof.mjs` for the frame sheets in `review/v2/film/` (it also reads the QR code back from the film).
