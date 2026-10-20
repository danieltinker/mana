// SYNTHETIC: "Pina Sim Café" (קפה פינה סים), a café invented for the client walkthrough (e2e/walkthrough/), its dishes
// and prices made up. No real venue's menu and no text copied from a real Wolt page belongs in this repository; a
// client's own walkthrough reads its input from private/ (git-ignored), never from here.
//
// The text is written in the shape @mana/import's Wolt-text reader assumes a page copied from Wolt has
// (packages/import/src/wolt-text.ts): the venue's header, its own list of sections, "פופולרי" repeating a dish, the
// sections, then two dish sheets copied after opening them. Hebrew first, with English names where the page shows both
// ("שניצל / Schnitzel"); prices in shekels with the right-to-left mark a browser copies.
//
// What it carries on purpose, for the walkthrough's steps:
// - a "side of choice" group (required, choose 1) whose fries open a nested sauce that states no limits (the owner
//   confirms them), on the schnitzel; extras on the burger (two dishes with add-ons);
// - a price the reader cannot read ("₪ 3O", a misprint the owner fixes by typing the price) and a dish repeated under
//   "פופולרי" (left out by default);
// - a breakfast section (the owner gives it breakfast hours), drinks and pastries (the suggestions).

const RLM = '‏';
const nis = (n) => `${RLM}${n.toFixed(2)} ₪`;

/** The venue's page, copied top to bottom. */
export const PAGE = `קפה פינה סים
בית קפה · ארוחות בוקר · ₪₪
9.0
משלוח ${nis(12)}
20–30 דק׳
פתוח עד 22:00
פופולרי
ארוחות בוקר
עיקריות
שתייה
מאפים
פופולרי
שניצל / Schnitzel
חזה עוף בפירורי לחם, תוספת לבחירה
${nis(64)}
ארוחות בוקר
שקשוקה / Shakshuka
שתי ביצים ברוטב עגבניות, לחם הבית
${nis(48)}
ארוחת בוקר ישראלית / Israeli breakfast
ביצים לבחירה, סלט קצוץ, גבינות ולחם
${nis(62)}
עיקריות
שניצל / Schnitzel
חזה עוף בפירורי לחם, תוספת לבחירה
${nis(64)}
המבורגר / Burger
קציצת בקר, עגבנייה וחמוצים
${nis(72)}
מרק היום / Soup of the day
שאלו אותנו מה המרק היום
₪ 3O
שתייה
לימונדה / Lemonade
לימונים ונענע
${nis(18)}
אספרסו / Espresso
${nis(12)}
קפוצ׳ינו / Cappuccino
${nis(16)}
מאפים
קרואסון / Croissant
${nis(14)}
עוגת גבינה / Cheesecake
${nis(26)}
וולט
מדיניות פרטיות
תנאי שימוש`;

/** The schnitzel's sheet: the side of choice, and a sauce for the fries that states no limits. */
export const SCHNITZEL_SHEET = `שניצל / Schnitzel
${nis(64)}
חזה עוף בפירורי לחם, תוספת לבחירה
אלרגנים: גלוטן, ביצה
תוספת לבחירה
חובה
בחרו 1
צ׳יפס
סלט
אורז
${RLM}+4.00 ₪
רוטב לצ׳יפס
רשות
איולי
קטשופ
צ׳ילי מיונז
${RLM}+2.00 ₪
הוספה להזמנה ${nis(64)}`;

/** The burger's sheet: extras, up to two. */
export const BURGER_SHEET = `המבורגר / Burger
${nis(72)}
קציצת בקר, עגבנייה וחמוצים
תוספות
בחרו עד 2
גבינה
${RLM}+4.00 ₪
ביצת עין
${RLM}+5.00 ₪
הוספה להזמנה ${nis(72)}`;

/** What the owner pastes: the page, then the two sheets. */
export const WOLT_TEXT = [PAGE, SCHNITZEL_SHEET, BURGER_SHEET].join('\n');

/**
 * SYNTHETIC: what the scanner's model would answer for two screenshots of the café's dessert page (JSON Lines, the
 * scanner's format, packages/import/src/scan.ts), for the local stub only (e2e/scan-stub.mjs: nothing is paid). It adds a
 * section the text did not have.
 */
export const SCREENSHOTS_REPLY = [
  '{"lang":"he"}',
  '{"c":{"he":"קינוחים","en":"Desserts"},"k":"dessert"}',
  '{"n":{"he":"מלבי","en":"Malabi"},"d":{"he":"מי ורדים ובוטנים","en":"Rose water and peanuts"},"p":"₪24.00"}',
  '{"n":{"he":"עוגת שוקולד","en":"Chocolate cake"},"p":"₪28.00"}',
].join('\n');

/**
 * The walkthrough's input (e2e/walkthrough/scenario.mjs `WalkthroughInput`): the paste, and what the owner, a guest and
 * Halom do with this menu. Names are the Hebrew ones the import stores.
 */
export const PINA_SIM = {
  invented: true,
  about: 'Pina Sim Café: invented for the walkthrough (e2e/fixtures/walkthrough-cafe.mjs)',
  venue: { name: 'קפה פינה סים', slugBase: 'pina-sim', kind: 'cafe' },
  wolt: { text: WOLT_TEXT, screenshots: { reply: SCREENSHOTS_REPLY, count: 2 } },
  fixes: { prices: { 'מרק היום': '34' } },
  addons: {
    side: 'תוספת לבחירה', opener: 'צ׳יפס', sauce: 'רוטב לצ׳יפס', sauceRequired: true,
    attach: [{ dish: 'המבורגר', group: 'תוספת לבחירה' }],
  },
  rules: [
    { after: 'שניצל', suggest: 'לימונדה', line: { he: 'לימונדה קרה ליד השניצל?', en: 'A cold lemonade with the schnitzel?' } },
    { after: 'אספרסו', suggest: 'קרואסון', line: { he: 'קרואסון חם ליד הקפה?', en: 'A warm croissant with your coffee?' } },
  ],
  breakfast: { section: 'ארוחות בוקר', name: { he: 'בוקר', en: 'Breakfast' } },
  guest: { dish: 'שניצל', choose: ['צ׳יפס', 'איולי'], accepts: 'לימונדה', then: 'אספרסו', dismisses: 'קרואסון' },
  offForTwoHours: 'עוגת גבינה',
  load: { guests: 8 },
};
