/* Demo data for the Halom 3D Menu engine.
   Ten Tel Aviv-Yafo restaurants. Dishes and prices were read from publicly posted menus on 2026-10-03
   (the restaurant's own site or PDF where one exists, otherwise its Wolt page) and may be out of date.
   No logos are used: the engine draws a placeholder mark from the name until an owner uploads the real one. */
(function () {
  var D = function (c, en, he, p, den, dhe, t, k) { var o = { c: c, n: { en: en, he: he }, d: { en: den || '', he: dhe || '' }, p: p, t: t || [] }; if (k) o.k = k; return o; };
  var VG = ['vegan'], VT = ['vegetarian'], SP = ['spicy'];

  window.HALOM_MENUS = [
    {
      id: 'cafe-shneor', name: { en: 'Cafe Shneor', he: 'קפה שניאור' }, area: { en: 'Pinsker St', he: 'רחוב פינסקר' }, cuisine: { en: 'Neighborhood cafe', he: 'קפה שכונתי' },
      src: 'https://www.shneor-cafe.com/',
      theme: { holo: '#ff8a5c', mood: 'noon', fits: 'oak', tableColor: '#e2dac8', accent: '#d9532f', ceramic: '#fbf8f0' },
      courses: [{ id: 'breakfast', en: 'Morning', he: 'בוקר' }, { id: 'mains', en: 'Mains', he: 'עיקריות' }, { id: 'sweets', en: 'Sweets', he: 'מתוקים' }, { id: 'drinks', en: 'Cold drinks', he: 'משקאות קרים' }],
      dishes: [
        D('breakfast', 'Shakshuka', 'שקשוקה', 62, 'Served with chopped salad, tahini and challah', 'מוגשת עם סלט קצוץ, טחינה וחלה', VT),
        D('breakfast', 'Egg Florentine Open Sandwich', 'כריך פתוח אג פלורנטין', 66, 'Brioche, aioli, sauteed spinach, two poached eggs and Hollandaise', 'לחם בריוש, איולי, עלי תרד מוקפצים, שתי ביצים עלומות ורוטב הולנדייז', VT),
        D('breakfast', 'Jamie’s French Toast', 'הפרנץ׳ טוסט של ג׳יימי', 58, 'Sweet challah with fruit salad, sour cream and maple', 'חלה מתוקה עם סלט פירות, שמנת חמוצה ומייפל', VT),
        D('breakfast', 'Good Morning Zalman', 'בוקר טוב זלמן', 68, 'Eggs your way, tuna salad, green tahini, feta with za’atar, chopped salad, grain bread and 2 drinks', 'ביצים לבחירה, סלט טונה, טחינה ירוקה, פטה עם זעתר, סלט קצוץ, לחם דגנים ו-2 משקאות', [], 'breakfast'),
        D('mains', 'Yellow Vegetable Curry', 'ירקות בקארי צהוב', 60, 'Red onion, cabbage, cauliflower and sweet potato in coconut cream and curry', 'בצל סגול, כרוב, כרובית ובטטה ברוטב קרם קוקוס וקארי', VG, 'stew'),
        D('mains', 'Salmon Pappardelle', 'פסטה פפרדלה סלמון', 66, 'Fresh pappardelle, lemon zest, a little chili, capers, cream and parmesan', 'פפרדלה טרייה, גרידת לימון, מעט צ׳ילי, צלפים, שמנת ופרמזן'),
        D('mains', 'Chicken Meatballs', 'קציצות עוף', 70, 'In a Mediterranean tomato sauce with peppers, artichoke and herbs', 'ברוטב ים תיכוני של עגבניות, פלפלים, ארטישוק ועשבים'),
        D('sweets', 'Basque Cheesecake', 'עוגת גבינה באסקית', 46, 'Tonka', 'טונקה', VT),
        D('sweets', 'Homemade Carrot Cake', 'עוגת גזר', 40, 'With vanilla cream', 'עם קרם וניל', VT),
        D('drinks', 'Fresh Orange Juice', 'מיץ תפוזים', 16, '', '', VG)
      ]
    },
    {
      id: 'koko-neko', name: { en: 'Koko Neko', he: 'קוקו נקו' }, area: { en: 'Florentin', he: 'פלורנטין' }, cuisine: { en: 'Ramen bar', he: 'ראמן בר' },
      src: 'https://wolt.com/he/isr/tel-aviv/restaurant/koko-neko',
      theme: { holo: '#ff9ec4', mood: 'night', fits: 'slate', tableColor: '#b98c5a', accent: '#f29bb0', ceramic: '#2b2f3a' },
      courses: [{ id: 'ramen', en: 'Ramen', he: 'ראמן' }, { id: 'gyoza', en: 'Gyoza', he: 'גיוזות' }, { id: 'cold', en: 'Cold dishes', he: 'מנות קרות' }, { id: 'dessert', en: 'Pancakes', he: 'פנקייקים' }, { id: 'drinks', en: 'Drinks', he: 'שתייה' }],
      dishes: [
        D('ramen', 'Shoyu Ramen', 'שויו ראמן', 68, 'Tofu chashu, bamboo shoots, corn, egg, scallion, nori and aromatic oil', 'צ׳אשו טופו, במבו שוט, תירס, ביצה, בצל ירוק, אצה ושמן ארומטי', VT),
        D('ramen', 'Sapporo Miso Ramen', 'סאפורו מיסו ראמן', 72, 'Miso broth, tofu chashu, corn, bean sprouts, egg, shimeji mushrooms, scallion and butter', 'ציר על בסיס מיסו, צ׳אשו טופו, תירס, נבטים, ביצה, פטריות שימאג׳י, בצל ירוק וחמאה', VT),
        D('ramen', 'Tori Paitan Ramen', 'טורי פאייטן ראמן', 72, 'Chicken-thigh chashu, bok choy, cabbage, bean sprouts, egg and nori', 'צ׳אשו פרגית, בק צ׳וי, כרוב, נבטים, ביצה ואצה'),
        D('gyoza', 'Pork Gyoza', 'גיוזה חזיר', 34, '3 pieces, in soy and sesame sauce', '3 יחידות, ברוטב סויה ושומשום'),
        D('gyoza', 'Vegetable Gyoza', 'גיוזה ירקות', 34, '3 pieces, in soy and sesame sauce', '3 יחידות, ברוטב סויה ושומשום', VT),
        D('cold', 'Chuka Salad', 'סלט צ׳וקה', 26, 'Noodles, daikon, cucumber and toasted sesame', 'אטריות, דייקון, מלפפון ושומשום קלוי'),
        D('cold', 'Soba Salad', 'סלט סובה', 69, 'Tofu chashu, broccoli, bean sprouts, green beans, cucumbers, coriander, walnuts and edamame', 'צ׳אשו טופו, ברוקולי, נבטים, שעועית ירוקה, מלפפונים, כוסברה, אגוזי מלך ואדממה'),
        D('dessert', 'Caramel Banana Pancake', 'פנקייק קרמל בננות', 56, 'Banana caramel, whipped cream and pecans', 'קרמל בננות, קצפת ופקאן', VT),
        D('drinks', 'Bancha', 'באנצ׳ה', 15, 'Cold tea infusion with yuzu and peach', 'חליטת תה קר עם יוזו ואפרסק', [], 'drink'),
        D('drinks', 'Kirin Beer', 'בירה קירין', 24, 'Japanese beer, 0.33 l', 'בירה יפנית, 0.33 ליטר')
      ]
    },
    {
      id: 'abu-hassan', name: { en: 'Abu Hassan', he: 'אבו חסן' }, area: { en: 'Jaffa', he: 'יפו' }, cuisine: { en: 'Hummus', he: 'חומוס' },
      src: 'https://wolt.com/he/isr/tel-aviv/restaurant/abu-hassan',
      theme: { holo: '#3fe6d2', mood: 'noon', fits: 'tiles', tableColor: '#edd27a', accent: '#1d6b66', ceramic: '#f6f2e8' },
      courses: [{ id: 'plates', en: 'Hummus plates', he: 'חומוס' }, { id: 'pita', en: 'In pita', he: 'בפיתה' }, { id: 'sides', en: 'Next to the hummus', he: 'ליד החומוס' }],
      dishes: [
        D('plates', 'Hummus', 'חומוס בצלחת', 32, 'Served with 2 pitas, raw onion and lemon-garlic sauce', 'מוגש עם 2 פיתות, בצל חי ורוטב לימון-שום', VG),
        D('plates', 'Masabacha', 'מסבחה בצלחת', 32, 'Served with 2 pitas, raw onion and lemon-garlic sauce', 'מוגש עם 2 פיתות, בצל חי ורוטב לימון-שום', VG),
        D('plates', 'Meshulash', 'משולש בצלחת', 32, 'Hummus, masabacha and ful. Served with 2 pitas, raw onion and lemon-garlic sauce', 'חומוס, מסבחה ופול. מוגש עם 2 פיתות, בצל חי ורוטב לימון-שום', VG, 'dip'),
        D('plates', 'Labaneh', 'לאבנה בצלחת', 32, 'Served with 2 pitas, raw onion and lemon-garlic sauce', 'מוגש עם 2 פיתות, בצל חי ורוטב לימון-שום', VT),
        D('pita', 'Falafel in Pita', 'פלאפל בפיתה', 22, 'Falafel, a spread of your choice and fries', 'פלאפל, ממרח לבחירה וצ׳יפס', VT),
        D('pita', 'Pita with a Spread', 'פיתה', 15, 'Pita with a spread of your choice', 'פיתה עם ממרח לבחירה', VT, 'bread'),
        D('sides', 'Falafel, Small', 'פלאפל קטן', 6, '4 falafel balls', '4 כדורי פלאפל', VG),
        D('sides', 'Fries, Small', 'צ׳יפס קטן', 14, '', '', VG),
        D('sides', 'Hard-Boiled Egg', 'ביצה קשה', 4, '', '', VT, 'egg')
      ]
    },
    {
      id: 'pizza-lila', name: { en: 'Pizza Lila', he: 'פיצה לילה' }, area: { en: 'Levinsky Market', he: 'שוק לוינסקי' }, cuisine: { en: 'Pizzeria', he: 'פיצרייה' },
      src: 'https://wolt.com/he/isr/tel-aviv/restaurant/lila-pizza',
      theme: { holo: '#ffd24a', mood: 'night', fits: 'gingham', tableColor: '#20252e', accent: '#f0c23a', ceramic: '#ece7db' },
      courses: [{ id: 'pizza', en: 'Pizza', he: 'פיצה' }, { id: 'sides', en: 'Next to the pizza', he: 'ליד הפיצה' }, { id: 'dessert', en: 'Dessert', he: 'לקינוח' }, { id: 'drinks', en: 'Beer', he: 'בירות' }],
      dishes: [
        D('pizza', 'Margherita', 'מרגריטה', 74, 'Tomato sauce, basil and fresh mozzarella', 'רוטב עגבניות, בזיליקום ומוצרלה פרסקה', VT, 'pizza'),
        D('pizza', 'Zucchini & Ricotta', 'קישואים וריקוטה', 78, 'Fresh mozzarella, ricotta, lemon', 'מוצרלה פרסקה, ריקוטה, לימון', VT, 'pizza'),
        D('pizza', 'Onion Jam & Goat Cheese', 'ריבת בצל וגבינת עיזים', 88, 'Tomato sauce, fresh mozzarella and arugula', 'רוטב עגבניות, מוצרלה פרסקה וארוגולה', VT, 'pizza'),
        D('pizza', 'Pepperoni', 'פפרוני', 92, 'Tomato sauce, hot pepper, fresh mozzarella and parmesan', 'רוטב עגבניות, פלפל חריף, מוצרלה פרסקה ופרמז׳ן', SP, 'pizza'),
        D('pizza', 'Bacon Maple', 'בייקון מייפל', 94, 'Thassos olives, hot pepper, maple, fresh mozzarella and parmesan', 'זיתי טאסוס, פלפל חריף, מייפל, מוצרלה פרסקה ופרמז׳ן', SP, 'pizza'),
        D('sides', 'Caesar Salad', 'סלט קיסר', 58, 'Lettuce hearts, croutons and parmesan in Caesar dressing (contains anchovy)', 'לבבות חסה, קרוטונים ופרמז׳ן ברוטב קיסר (מכיל אנשובי)'),
        D('sides', 'Leaf Salad', 'סלט עלים', 68, 'Leaves, grapes, hazelnuts, grated cheese', 'עלים, ענבים, אגוזי לוז, גבינה מגורדת', VT),
        D('sides', 'Lasagna', 'לזניה', 84, 'Beef ragu, tomato sauce, bechamel and parmesan', 'ראגו בקר, רוטב עגבניות, בשמל ופרמז׳ן'),
        D('dessert', 'Crumb Cheesecake', 'עוגת גבינה פירורים', 45, '', '', VT),
        D('drinks', 'Peroni', 'פרוני', 28, 'Italian lager, 330 ml bottle', 'בירה איטלקית, בקבוק 330 מ״ל', [], 'beer')
      ]
    },
    {
      id: 'yaffa-knafeh', name: { en: 'Yaffa Knafeh', he: 'יאפא כנאפה' }, area: { en: 'Jaffa flea market', he: 'שוק הפשפשים' }, cuisine: { en: 'Knafeh and sweets', he: 'כנאפה ומתוקים' },
      src: 'https://yaffaknafeh.com/',
      theme: { holo: '#ffa13d', mood: 'golden', fits: 'walnut', tableColor: '#efe4cc', accent: '#c9631f', ceramic: '#fbf6ea' },
      courses: [{ id: 'specials', en: 'The specials', he: 'המיוחדים' }, { id: 'baklava', en: 'Baklava', he: 'בקלאווה' }, { id: 'sweets', en: 'Sweets and ice cream', he: 'מתוקים וגלידות' }, { id: 'drinks', en: 'Hot drinks', he: 'משקאות חמים' }],
      dishes: [
        D('specials', 'Personal Knafeh', 'כנאפה אישית', 20, '', '', VT),
        D('specials', 'Knafeh with Ice Cream', 'כנאפה עם גלידה', 25, '', '', VT, 'knafeh'),
        D('specials', 'Vegan Personal Knafeh', 'כנאפה אישית טבעונית', 20, '', '', VG),
        D('specials', 'Baklava Triangle with Ice Cream', 'משולש בקלאווה עם גלידה', 25, '', '', VT, 'baklava'),
        D('baklava', 'Aleppo Pistachio Balluriyeh', 'בלורייה פיסטוק חלבי', 15, '3 pieces', '3 יחידות', VT, 'baklava'),
        D('baklava', 'Mixed Baklava Plate', 'צלחת מיקס מעורב', 25, '9 pieces', '9 יחידות', VT),
        D('sweets', 'Malabi', 'מלבי', 12, '', '', VT),
        D('sweets', 'Personal Trilece', 'טרליטשה אישית', 25, 'Turkish dessert: milk-soaked cake topped with caramel', 'קינוח טורקי: עוגה ספוגה בחלב מצופה בקרמל', VT, 'cake'),
        D('sweets', 'Ice Cream Cup', 'גביע אישי', 10, 'Goat’s milk ice cream', 'גלידת חלב עיזים', VT),
        D('drinks', 'Small Pot of Cardamom Coffee', 'קנקן קפה עם הל קטן', 10, '', '')
      ]
    },
    {
      id: 'busi', name: { en: 'Busi', he: 'בוסי' }, area: { en: 'Hatikva', he: 'שכונת התקווה' }, cuisine: { en: 'Grill, since 1957', he: 'גריל, מאז 1957' },
      src: 'https://wolt.com/he/isr/tel-aviv/restaurant/busi-batikva',
      theme: { holo: '#ff7445', mood: 'night', fits: 'kraft', tableColor: '#8e9499', accent: '#e2562d', ceramic: '#f3efe6' },
      courses: [{ id: 'starters', en: 'Starters', he: 'ראשונות' }, { id: 'pita', en: 'In pita', he: 'פיתה' }, { id: 'plate', en: 'On a plate', he: 'בצלחת' }, { id: 'dessert', en: 'Dessert', he: 'קינוח' }],
      dishes: [
        D('starters', 'Hummus with Tahini', 'חומוס טחינה', 35, 'Comes with 2 pitas', 'מגיע עם 2 פיתות', VG),
        D('starters', 'Bean Soup', 'מרק שעועית', 40, 'Served with a choice of bread', 'מוגש עם לחם לבחירה'),
        D('starters', 'Rice with Beans', 'אורז עם שעועית', 40, '', ''),
        D('pita', 'Kebab in Pita', 'קבב בפיתה', 55, 'Choose your salads and spreads; house pickles on the side', 'בחרו סלטים וממרחים, מוגש עם חמוצי הבית בצד'),
        D('pita', 'Pargit in Pita', 'פרגית בפיתה', 55, 'Boneless chicken thigh. Choose your salads and spreads; house pickles on the side', 'בחרו סלטים וממרחים, מוגש עם חמוצי הבית בצד'),
        D('pita', 'Hearts in Pita', 'לבבות בפיתה', 55, 'Choose your salads and spreads; house pickles on the side', 'בחרו סלטים וממרחים, מוגש עם חמוצי הבית בצד'),
        D('plate', 'Shawarma Plate', 'שווארמה בצלחת', 90, 'Choose your salads and sides; served with house pickles', 'בחרו סלטים ותוספות, מוגש לצד חמוצי הבית', [], 'meatpile'),
        D('plate', 'Mulard Plate', 'מולארד בצלחת', 80, 'Duck breast skewers. Choose your salads and sides; served with house pickles', 'בחרו סלטים ותוספות, מוגש לצד חמוצי הבית', [], 'skewers'),
        D('plate', 'Foie Gras Plate', 'כבד אווז בצלחת', 165, 'Goose liver skewers. Choose your salads and sides; served with house pickles', 'בחרו סלטים ותוספות, מוגש לצד חמוצי הבית', [], 'skewers'),
        D('dessert', 'Lemon Pistachio Tart', 'טארט לימון פיסטוק', 36, '', '', VT)
      ]
    },
    {
      id: 'hadayagim', name: { en: 'Hadayagim', he: 'הדייגים' }, area: { en: 'Jaffa Port', he: 'נמל יפו' }, cuisine: { en: 'Fish and seafood', he: 'דגים ופירות ים' },
      src: 'https://www.hadayagim.co.il/',
      theme: { holo: '#52b9ff', mood: 'noon', fits: 'gingham-blue', tableColor: '#f6f3ec', accent: '#1f5d8c', ceramic: '#fbfaf6' },
      courses: [{ id: 'starters', en: 'Starters', he: 'מנות פתיחה' }, { id: 'fish', en: 'Fish', he: 'דגים' }, { id: 'seafood', en: 'Seafood', he: 'פירות ים' }, { id: 'drinks', en: 'Drinks', he: 'שתייה' }],
      dishes: [
        D('starters', 'House Hummus', 'חומוס הבית', 28, '', '', VG),
        D('starters', 'Fish Soup', 'מרק דגים', 49, '', ''),
        D('starters', 'Arabic Salad', 'סלט ערבי', 42, 'Chopped vegetable salad. Two sizes: 42 / 56', 'סלט ירקות קצוץ. שני גדלים: 42 / 56', VT),
        D('fish', 'Sea Bream', 'דניס', 139, 'Mains come with the house salads, hummus and pita', 'המנות העיקריות מוגשות עם סלטי הבית, חומוס ופיתות'),
        D('fish', 'Sea Bass', 'לברק', 139, 'Mains come with the house salads, hummus and pita', 'המנות העיקריות מוגשות עם סלטי הבית, חומוס ופיתות'),
        D('fish', 'Fish and Chips', 'פיש אנד צ׳יפס', 119, '', ''),
        D('seafood', 'Shrimp or Calamari in Garlic, Butter and Wine', 'שרימפס / קלמרי בשום, חמאה ויין', 149, '', '', [], 'seafood'),
        D('seafood', 'Seafood Symphony', 'סימפוניה פירות ים', 179, 'A selection of mixed seafood', 'מבחר פירות ים'),
        D('drinks', 'Pitcher of Lemonade', 'קנקן לימונדה', 32, '', ''),
        D('drinks', 'Weihenstephan Draught', 'ווינשטפן חבית', 36, 'On tap. Two sizes: 36 / 42', 'מהחבית. שני גדלים: 36 / 42', [], 'beer')
      ]
    },
    {
      id: 'juno', name: { en: 'Juno', he: 'ג׳ונו' }, area: { en: 'Kikar Milano', he: 'כיכר מילאנו' }, cuisine: { en: 'Wine bar and cafe', he: 'בר יין וקפה' },
      src: 'https://wolt.com/he/isr/tel-aviv/restaurant/juno',
      theme: { holo: '#ff6d95', mood: 'golden', fits: 'marble-black', tableColor: '#efeae0', accent: '#7a1f2e', ceramic: '#fbf8f0' },
      courses: [{ id: 'starters', en: 'Starters', he: 'ראשונות' }, { id: 'mains', en: 'Pizza, pasta and more', he: 'פיצה, פסטה ועוד' }, { id: 'sweets', en: 'Sweets', he: 'מתוקים' }, { id: 'wine', en: 'White wines', he: 'יינות לבנים' }],
      dishes: [
        D('starters', 'Filo Pockets', 'כיסוני פילו', 44, 'With Camembert and garlic jam', 'עם קממבר וריבת שום', VT, 'pastry'),
        D('starters', 'Artichoke & Pecorino', 'ארטישוק וגבינת פיקורינו', 48, 'With Kalamata olives, red onion, parsley and yogurt sauce', 'עם זיתי קלמטה, בצל סגול, פטרוזיליה ורוטב יוגורט', VT),
        D('starters', 'Large Cheese Plate', 'צלחת גבינות גדולה', 98, 'Truffle Manchego, Gouda, Camembert and goat buche (200 g), with garlic jam and seeded bread', 'מנצ׳גו כמהין, גאודה, קממבר ובושה עיזים (200 גרם), עם ריבת שום ולחם גרעינים', VT, 'cheese'),
        D('mains', 'Pizza Bianca', 'פיצה ביאנקה', 72, 'Creme fraiche, spinach, mushrooms and parmesan. 30 cm', 'קרם פרש, תרד, פטריות ופרמז׳ן. קוטר 30 ס״מ', VT),
        D('mains', 'Bresaola Pizza', 'פיצה ברזאולה', 76, 'Artichoke puree, bresaola, mozzarella, spinach', 'מחית ארטישוק, נקניק ברזאולה, מוצרלה, תרד'),
        D('mains', 'Ricotta & Spinach Tortellini', 'טורטליני ריקוטה ותרד', 74, 'In butter sauce with tomato seeds, basil and parmesan', 'ברוטב חמאה, זרעי עגבניות, בזיליקום ופרמזן', VT),
        D('mains', 'Chestnut Gnocchi', 'ניוקי ערמונים', 74, 'Cream, truffle puree, mushrooms and chestnuts', 'שמנת, מחית כמהין, פטריות וערמונים', VT),
        D('mains', 'Asia', 'אסיה', 72, 'Stir-fried rice with yellow curry, coconut milk, green beans, peppers, mushrooms and coriander. With chicken or tofu', 'אורז מוקפץ עם קארי צהוב, חלב קוקוס, שעועית ירוקה, פלפלים, פטריות וכוסברה. עם עוף או טופו', SP, 'rice'),
        D('sweets', 'Chocolate Finger', 'אצבע שוקולד', 18, 'Chocolate ganache finger on a crunch base', 'אצבע גנאש שוקולד על בסיס קראנץ׳', VT, 'cake'),
        D('wine', 'Parini Pinot Grigio', 'פאריני, פינו גריג׳יו', 69, 'Italy, 750 ml bottle. Fresh and light, with apple and pear aromas', 'איטליה, בקבוק 750 מ״ל. רענן וקליל, עם ניחוחות תפוח ואגס', [], 'wine')
      ]
    },
    {
      id: 'thai-sinai', name: { en: 'Thai at Har Sinai', he: 'התאילנדית בסמטת סיני' }, area: { en: 'Har Sinai alley', he: 'סמטת הר סיני' }, cuisine: { en: 'Thai', he: 'תאילנדי' },
      src: 'https://www.thaisinai.com/',
      theme: { holo: '#4fe6a4', mood: 'golden', fits: 'bamboo', tableColor: '#7a4f30', accent: '#1f7a62', ceramic: '#f1ead8' },
      courses: [{ id: 'starters', en: 'Starters and grill', he: 'פתיחה וגריל' }, { id: 'soups', en: 'Soups', he: 'מרקים' }, { id: 'mains', en: 'Curry, wok and fish', he: 'קארי, ווק ודגים' }, { id: 'drinks', en: 'Drinks', he: 'שתייה' }],
      dishes: [
        D('starters', 'Som Tam Papaya Salad', 'סום טאם, סלט פאפאיה', 49, 'Green papaya, long beans and tomato pounded with fish sauce, lime, Thai chili, coconut sugar and peanuts', 'פפאיה בוסר, שעועית ועגבנייה כתושות עם רוטב דגים, ליים, צ׳ילי תאילנדי, סוכר קוקוס ובוטנים', SP),
        D('starters', 'Satay Gai', 'סאטה גאי', 65, 'Chicken breast skewers in a peanut and coconut milk marinade', 'שיפודי חזה עוף במרינדה של בוטנים וחלב קוקוס'),
        D('starters', 'Morning Glory', 'מורנינג גלורי', 48, 'Wok-fried water spinach leaves with garlic and fermented beans in oyster and soy sauce', 'עלי פאק בונג בווק עם שום ושעועית מותססת ברוטב צדפות וסויה', [], 'salad'),
        D('soups', 'Khao Soi', 'קאו סוי', 77, 'Northern Thai yellow curry soup with pickled mustard greens, shallot, egg noodles and chicken thigh', 'מרק קארי צהוב מצפון תאילנד עם חרדל כבוש, שאלוט, אטריות ביצים ופרגית', [], 'ramen'),
        D('soups', 'Kuay Tiew', 'קוטיאו', 75, 'Chicken-stock soup with look chin meatballs, glass noodles, peanuts, coriander and crispy garlic', 'מרק על ציר עוף עם קציצות לוקצ׳ין, אטריות שעועית, בוטנים, כוסברה וקריספי שום', [], 'ramen'),
        D('mains', 'Gaeng Massaman', 'גאנג מאסאמן', 94, 'Southern Thai curry: chicken thigh and potato in coconut milk with tamarind, peanuts and Thai basil', 'קארי מדרום תאילנד: פרגית ותפוח אדמה בחלב קוקוס, תמרינדי, בוטנים ובזיליקום תאילנדי', [], 'stew'),
        D('mains', 'Pad Kra Pao', 'פאד קרא פאו', 87, 'Minced beef or chicken thigh with holy basil in oyster sauce, topped with a fried egg', 'שייטל או פרגית קצוצים עם עלי קרא פאו ברוטב צדפות, עם ביצת עין', [], 'rice'),
        D('mains', 'Pla Manao', 'פלה מנאו', 136, 'Whole steamed sea bream in nam jim sauce with fresh coriander', 'דניס שלם מאודה ברוטב נאם ג׳ים עם כוסברה טרייה', [], 'fish'),
        D('drinks', 'Lemongrass Mojito', 'למון גראס מוחיטו', 23, 'No alcohol. Lemongrass, mint, lime and soda', 'ללא אלכוהול. למון גראס, נענע, ליים וסודה'),
        D('drinks', 'Singha Beer', 'סינגה בקבוק', 28, 'Thai beer, 330 ml bottle', 'בירה תאילנדית, בקבוק 330 מ״ל', [], 'beer')
      ]
    },
    {
      id: 'hamburger-26', name: { en: '26 Hamburger Gourmet', he: 'המבורגר גורמה 26' }, area: { en: 'Gan HaHashmal', he: 'גן החשמל' }, cuisine: { en: 'Burgers', he: 'המבורגרים' },
      src: 'https://wolt.com/he/isr/tel-aviv/restaurant/26-hamburger-gourmet',
      theme: { holo: '#ffcf6a', mood: 'night', fits: 'steel', tableColor: '#4a3122', accent: '#c9a24a', ceramic: '#ece6d8' },
      courses: [{ id: 'starters', en: 'Starters', he: 'ראשונות' }, { id: 'burgers', en: 'Burgers', he: 'בורגרים' }, { id: 'desserts', en: 'Desserts', he: 'קינוחים' }, { id: 'drinks', en: 'Alcohol', he: 'אלכוהול' }],
      dishes: [
        D('starters', 'Salade Cesar', 'סלט קיסר', 51, 'Lettuce hearts, brioche croutons and parmesan in house Caesar dressing', 'לבבות חסה, קרוטוני בריוש ופרמז׳ן ברוטב קיסר ביתי'),
        D('starters', 'Cheddar & Truffle', 'צ׳דר וכמהין', 28, '3 cheddar and truffle cheese balls with fig syrup', '3 כדורי גבינת צ׳דר וכמהין לצד סירופ תאנים', VT, 'falafel'),
        D('burgers', 'Classic', 'קלאסי', 81, '200 g beef, crispy bacon, Emmental, house barbecue sauce and onion confit', 'בשר בקר 200 גרם, בייקון קריספי, גבינת אמנטל, רוטב ברביקיו ביתי ובצל קונפי', [], 'burger'),
        D('burgers', 'La Truffe', 'לה טרוף', 81, 'Beef, truffle aioli, smoked goose breast, parmesan tuile and crispy sweet potato', 'בשר בקר, איולי כמהין, חזה אווז מעושן, טוויל פרמז׳ן וגפרורי בטטה קריספי', [], 'burger'),
        D('burgers', 'L’Agneau', 'טלה', 79, 'Lamb, 18-month English cheddar, mushrooms in white wine, tartar sauce and rocket', 'בשר טלה, צ׳דר אנגלי מיושן 18 חודשים, פטריות ביין לבן, רוטב טרטר ועלי רוקט', [], 'burger'),
        D('burgers', 'Raclette', 'רקלט', 68, 'Beef, Swiss raclette, chives, house barbecue sauce and rocket', 'בשר בקר, גבינת רקלט שוויצרי, עירית, רוטב ברביקיו ביתי ורוקט', [], 'burger'),
        D('burgers', 'Foie Gras', 'כבד אווז', 114, 'Beef with pieces of foie gras, house fig jam, Atlantic sea salt and rocket', 'בשר בקר עם נתחי כבד אווז, ריבת תאנים ביתית, מלח ים אטלנטי ורוקט', [], 'burger'),
        D('burgers', 'SmashBurger Mana Vegan', 'סמאש בורגר מאנה טבעוני', 79, 'Vegan brioche bun, double cheddar, eggplant bacon and tartar sauce', 'לחמניית בריוש טבעונית, צ׳דר כפול, בייקון חציל ורוטב טרטר', VG),
        D('desserts', 'Creme Brulee', 'קרם ברולה', 40, 'Contains no gluten', 'אינו מכיל גלוטן', ['vegetarian', 'gf']),
        D('drinks', 'Negroni', 'נגרוני', 55, 'Gin, Campari and red Martini, with a piece of orange', 'ג׳ין, קמפרי ומרטיני אדום, עם חתיכת תפוז')
      ]
    }
  ];
})();
