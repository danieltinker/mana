/**
 * SYNTHETIC inputs for the readers' tests, invented from scratch: "Test Kitchen" / "מטבח ניסוי" is not a real venue,
 * and its dishes and prices are made up. No real venue's menu, and no text copied from a real Wolt page, belongs in
 * this repository.
 *
 * The Wolt texts are written in the shape this package ASSUMES a copied Wolt page has (`src/wolt-text.ts` lists each
 * assumption for the tuning pass on a real paste, which stays in `private/`).
 */

/** The venue page in English, copied top to bottom: header, the section list, "Most ordered", sections, footer. */
export const WOLT_EN_PAGE = `Test Kitchen
Israeli · Grill · ₪₪
9.2
Delivery ₪9.90
Min. order ₪50.00
25–35 min
Open until 23:00
Group order
Schedule order
Most ordered
Mains
Drinks
Desserts
Most ordered
Schnitzel
Crispy chicken breast, lemon and parsley…
₪64.00
Popular
Burger
₪72.00
Mains
Schnitzel
Crispy chicken breast, lemon and parsley…
₪64.00
Popular
Burger
Beef patty, tomato, pickles
₪72.00
Vegan
Shakshuka
Two eggs in a spicy tomato sauce
from ₪48.00
Fish of the day
₪ 9O
Sold out
Drinks
Lemonade
Fresh lemons and mint
₪18.00
Craft beer
₪28.00 ₪32.00
Desserts
Malabi
Rose water, peanuts
₪26.00
Gluten free
Wolt
Privacy statement
Terms
© Wolt 2026`;

/** The schnitzel's dish sheet in English: a required side, a sauce nested under fries, optional extras. */
export const WOLT_EN_SHEET = `Schnitzel
₪64.00
Crispy chicken breast, lemon and parsley, served with a side of choice
Allergens: gluten, egg
Choose a side
Required
Choose 1
Fries
Salad
Rice
+₪4.00
Fries › Choose a sauce
Optional
Aioli
Ketchup
Chili mayo
+₪2.00
Extras
Choose up to 2
Fried egg
+₪5.00
Avocado
+₪6.00
1
Add to order ₪64.00`;

/** The same venue in Hebrew, with right-to-left marks as browsers copy them. */
export const WOLT_HE_PAGE = `מטבח ניסוי
ישראלי · גריל
9.4
משלוח \u200F9.90 ₪
מינימום הזמנה \u200F50.00 ₪
20–30 דק׳
פתוח עד 23:00
הזמנה קבוצתית
פופולרי
עיקריות
שתייה
פופולרי
שניצל
חזה עוף פריך, לימון ופטרוזיליה…
\u200F64.00 ₪
עיקריות
שניצל
חזה עוף פריך, לימון ופטרוזיליה…
\u200F64.00 ₪
המבורגר
קציצת בקר, עגבנייה וחמוצים
\u200F72.00 ₪
חריף
פלאפל (טבעוני)
\u200F38.00 ₪
אזל מהמלאי
שתייה
לימונדה
\u200F18.00 ₪
קולה / Cola
\u200F12.00 ₪
כל הזכויות שמורות`;

/** The burger's dish sheet in Hebrew: a required side, a sauce for the fries ("רוטב לצ׳יפס"), extras up to 3. */
export const WOLT_HE_SHEET = `המבורגר
\u200F72.00 ₪
קציצת בקר, עגבנייה וחמוצים
בחרו תוספת
חובה
בחרו 1
צ׳יפס
סלט
רוטב לצ׳יפס
רשות
איולי
קטשופ
\u200F+2.00 ₪
תוספות
בחרו עד 3
ביצת עין
\u200F+5.00 ₪
גבינה
\u200F+3.00 ₪
הוספה להזמנה \u200F72.00 ₪`;

/** A typed menu in both languages, with every shape `parsePaste` reads. */
export const PASTE_MIXED = `# ראשונות / Starters
חומוס / Hummus ....... 32
עם טחינה ופיתה
סלט ירקות 28
Vegetable salad

עיקריות
שניצל 64
Schnitzel
חזה עוף בפירורי לחם, לימון
Breaded chicken breast, lemon
דג היום | 92 | לפי השוק
Pasta (vegan) 54

Drinks:
Lemonade 18
Wine 38 / 140
Water`;

/** A plain English list: headings, "dish …… price", descriptions on the next line, a price on its own line. */
export const PASTE_EN = `STARTERS
Soup of the day ...... 32
Ask your waiter
Bread basket - 18

MAINS
Schnitzel
64
Crispy, with lemon
Burger 72
Allergens: gluten
Kids burger ₪ 4O

Desserts
Malabi 26
Gluten free`;

/** The v1 scanner's events for two pages; the mains continue on page 2. */
export const SCAN_EVENTS = [
  { t: 'start' }, { t: 'lang', v: 'he' },
  { t: 'cat', he: 'עיקריות', en: 'Mains', kind: 'food' },
  { t: 'item', he: 'שניצל', en: 'Schnitzel', dhe: 'עם לימון', den: 'With lemon', price_minor: 6400, note_he: '', note_en: '', tags: [], stock: 'schnitzel' },
  { t: 'item', he: 'המבורגר', en: 'Burger', dhe: '', den: '', price_minor: 7200, note_he: '', note_en: '', tags: ['spicy', 'halal'], stock: null },
  { t: 'done', cats: 1, items: 2, lang: 'he', truncated: false },
  { t: 'start' }, { t: 'lang', v: 'he' },
  { t: 'cat', he: 'עיקריות', en: 'Main courses', kind: 'food' },
  { t: 'item', he: 'פלאפל', en: 'Falafel', dhe: '', den: '', price_minor: 3800, note_he: '', note_en: '', tags: ['vegan'], stock: null },
  { t: 'cat', he: 'יינות', en: 'Wines', kind: 'wine' },
  { t: 'item', he: 'יין הבית', en: 'House wine', dhe: '', den: '', price_minor: 3800, note_he: 'כוס 38 / בקבוק 140', note_en: 'Glass 38 / Bottle 140', tags: [], stock: null },
  { t: 'item', he: 'מנה מיוחדת', en: 'Special', dhe: '', den: '', price_minor: null, note_he: '', note_en: '', tags: [], stock: null },
  { t: 'done', cats: 2, items: 3, lang: 'he', truncated: true },
] as const;

/** A synthetic model answer for one printed page (`scan_menu`), as the v2 prompt asks for it. */
export const REPLY_MENU = `{"lang":"he"}
{"c":{"he":"עיקריות","en":"Mains"},"k":"food","tr":["en"]}
{"n":{"he":"שניצל","en":"Schnitzel"},"d":{"he":"עם לימון","en":"With lemon"},"p":"64","tr":["en"]}
{"n":{"he":"המבורגר","en":"Burger"},"d":{"he":"","en":""},"p":"72","t":["spicy","halal"],"a":{"he":"גלוטן","en":""},"tr":["en"]}
{"g":{"he":"תוספות","en":"Extras"},"r":"עד 2","tr":["en"]}
{"o":{"he":"גבינה","en":"Cheese"},"p":"+5","tr":["en"]}
{"o":{"he":"ביצה","en":"Egg"},"p":"+4","tr":["en"]}
{"c":{"he":"יינות","en":"Wines"},"k":"wine","tr":["en"]}
{"n":{"he":"יין הבית","en":"House wine"},"p":"38 / 140","q":{"he":"כוס 38 / בקבוק 140","en":"Glass 38 / Bottle 140"},"tr":["en"]}
{"n":{"he":"מנה מיוחדת","en":"Special"},"p":"מחיר יומי","tr":["en"]}`;

/** A synthetic model answer for screenshots of the venue's own Wolt page (`wolt_screenshots`), with nested choices. */
export const REPLY_WOLT = `{"lang":"en"}
{"c":{"he":"עיקריות","en":"Mains"},"k":"food","tr":["he"]}
{"n":{"he":"שניצל","en":"Schnitzel"},"d":{"he":"חזה עוף פריך","en":"Crispy chicken breast"},"p":"₪64.00","x":true,"tr":["he"]}
{"g":{"he":"בחרו תוספת","en":"Choose a side"},"r":"Required · Choose 1","m":"single","tr":["he"]}
{"o":{"he":"צ׳יפס","en":"Fries"},"tr":["he"]}
{"o":{"he":"סלט","en":"Salad"},"tr":["he"]}
{"g":{"he":"בחרו רוטב","en":"Choose a sauce"},"r":"Optional","m":"single","u":"Fries","tr":["he"]}
{"o":{"he":"איולי","en":"Aioli"},"tr":["he"]}
{"o":{"he":"קטשופ","en":"Ketchup"},"p":"+₪2.00","f":true,"tr":["he"]}
{"g":{"he":"תוספות","en":"Extras"},"m":"multiple","tr":["he"]}
{"o":{"he":"ביצה","en":"Egg"},"p":"+₪5.00","tr":["he"]}
{"n":{"he":"המבורגר","en":"Burger"},"p":"₪72.00","tr":["he"]}
{"g":{"he":"בחרו תוספת","en":"Choose a side"},"r":"Required · Choose 1","m":"single","tr":["he"]}
{"o":{"he":"צ׳יפס","en":"Fries"},"tr":["he"]}
{"o":{"he":"סלט","en":"Salad"},"tr":["he"]}
{"g":{"he":"בחרו רוטב","en":"Choose a sauce"},"r":"Optional","m":"single","u":"Fries","tr":["he"]}
{"o":{"he":"איולי","en":"Aioli"},"tr":["he"]}
{"o":{"he":"קטשופ","en":"Ketchup"},"p":"+₪2.00","f":true,"tr":["he"]}
{"n":{"he":"לימונדה","en":"Lemonade"},"p":"₪18.00","tr":["he"]}
{"n":{"he":"מנה בלי שם קריא","en":""},"p":"₪4`;
