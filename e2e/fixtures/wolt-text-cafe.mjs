// SYNTHETIC: an invented café ("Morning Sim Café"), its dishes and prices made up for the onboarding tests, written in
// the shape @mana/import's Wolt-text reader assumes a copied Wolt page has (packages/import/src/wolt-text.ts). No real
// venue's menu and no text copied from a real Wolt page belongs in this repository.
//
// What it carries on purpose: a "side of choice" group (required, choose 1) whose "Fries" opens a nested sauce, an
// "Extras" group that states no limits, a price the reader cannot read ("₪ 2O", a misprint the owner fixes by typing
// the price), prices in shekels, allergens in the source's words, and the page's "Most ordered" section repeating a dish.

/** The venue's page, copied top to bottom. */
export const PAGE = `Morning Sim Café
Café · Breakfast · ₪₪
9.1
Delivery ₪12.00
20–30 min
Open until 16:00
Most ordered
Breakfast
Coffee
Cakes
Most ordered
Espresso
₪12.00
Breakfast
Schnitzel plate
Crispy chicken, side of choice
₪62.00
Shakshuka
Two eggs in tomato sauce
₪48.00
Coffee
Espresso
₪12.00
Cappuccino
Double shot, steamed milk
₪16.00
Cakes
Seasonal cake
Ask us about today's cake
₪ 2O
Cheesecake
₪26.00
Wolt
Privacy statement
Terms`;

/** The schnitzel plate's sheet, copied after opening it: its side of choice, a sauce for the fries, and extras. */
export const SHEET = `Schnitzel plate
₪62.00
Crispy chicken, side of choice
Allergens: gluten, egg
Side of choice
Required
Choose 1
Fries
Salad
Rice
+₪4.00
Fries › Choose a sauce
Optional
Aioli
+₪3.00
Ketchup
Extras
Fried egg
+₪5.00
Avocado
+₪6.00
1
Add to order ₪62.00`;

/** What the owner pastes: the page, then the sheet. */
export const WOLT_TEXT = PAGE + '\n' + SHEET;
