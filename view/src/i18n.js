/* Every word the guest reads that does not come from the menu itself. Few, plain, specific; no technology words.
   Most controls are icons: their words live here as labels for screen readers and as tooltips. */
/* the product's name, in one place */
export const PRODUCT = { name: { en: 'Mana', he: 'מנה' }, url: 'https://halom.io/mana/' };

export const STR = {
  en: {
    skip: 'Skip to the menu list', categories: 'Menu sections', lang: 'עב', langLabel: 'מעבר לעברית',
    tray: 'My table', add: 'Add to my table', added: 'On my table', soldOut: 'Sold out', remove: 'Remove one', more: 'Add one',
    list: 'The whole menu', details: 'Details', close: 'Close', next: 'Next', prev: 'Previous', ofCount: '{i} of {n}', nextCat: 'Next: {cat}', prevCat: 'Before: {cat}',
    hintPull: 'Pull the table towards you to see the next dish', hintUp: 'Swipe up for the next dish', pour: 'Pour again', notes: 'Tasting notes',
    illus: 'Illustration', illusDish: 'This picture is an illustration, not the dish itself.', illusBottle: 'Illustration · ask to see the bottle', illusCan: 'Illustration · ask to see the can',
    items: ['{n} item', '{n} items'], allergens: 'Allergens',
    listNotice: 'The table could not be shown on this device, so the menu is a list.', tryTable: 'Try the table again',
    total: 'Total', trayEmpty: 'Nothing here yet.', trayNote: 'Show this list to your waiter.', clear: 'Clear the list', orderOn: 'Order on {host}', orderOnline: 'Order online', orderDemo: 'In your menu this button opens your own ordering page.',
    loading: 'Loading the menu…', unavailableTitle: 'This menu is not available right now', unavailableBody: 'Please ask the staff at {name} for the menu.', unavailableBodyAnon: 'Please ask the staff for the menu.',
    notFoundTitle: 'We could not find this menu', notFoundBody: 'Check the link, or scan the code on the table again.', errorTitle: 'The menu did not load', errorBody: 'Check your connection and try again.', retry: 'Try again',
    previewTitle: 'Waiting for the preview', previewBody: 'Keep the editor open; the menu appears here.', emptyTitle: 'This menu has nothing on it yet', emptyBody: 'Please ask the staff for the menu.',
    tags: { vegan: 'Vegan', vegetarian: 'Vegetarian', spicy: 'Spicy', gf: 'Gluten free' },
    wine: { producer: 'Producer', name: 'Wine', vintage: 'Vintage', region: 'Region', grape: 'Grape', serving: 'Served', color: 'Colour', sweetness: 'Sweetness', acidity: 'Acidity', body: 'Body', fruit: 'Fruit', minerality: 'Minerality', pairings: 'Goes with' },
    wineColor: { red: 'Red', white: 'White', rose: 'Rosé', sparkling: 'Sparkling', orange: 'Orange' },
    beer: { brewery: 'Brewery', style: 'Style', abv: 'Alcohol', serving: 'Served', color: 'Colour' },
    beerServing: { bottle: 'Bottle', can: 'Can', tap: 'On tap' }, beerColor: { pale: 'Pale', amber: 'Amber', dark: 'Dark' },
    stageLabel: 'The dishes on a table. Every dish is also in the menu list.', credit: 'Menu by {name}', demo: 'Demo menu · invented restaurant', demoShort: 'Demo', backTo: 'Back to {name}',
    /* night:templates */ demoAi: 'Demo dishes · made with AI' /* /night:templates */
  },
  he: {
    skip: 'דילוג לרשימת התפריט', categories: 'חלקי התפריט', lang: 'EN', langLabel: 'Switch to English',
    tray: 'השולחן שלי', add: 'להוסיף לשולחן שלי', added: 'על השולחן שלי', soldOut: 'אזל', remove: 'להוריד אחד', more: 'להוסיף אחד',
    list: 'כל התפריט', details: 'פרטים', close: 'סגירה', next: 'הבא', prev: 'הקודם', ofCount: '{i} מתוך {n}', nextCat: 'הלאה: {cat}', prevCat: 'לפני כן: {cat}',
    hintPull: 'מושכים את השולחן אליכם כדי לראות את המנה הבאה', hintUp: 'מחליקים למעלה למנה הבאה', pour: 'למזוג שוב', notes: 'הערות טעימה',
    illus: 'להמחשה בלבד', illusDish: 'התמונה להמחשה בלבד, זו לא המנה עצמה.', illusBottle: 'איור להמחשה · אפשר לבקש לראות את הבקבוק', illusCan: 'איור להמחשה · אפשר לבקש לראות את הפחית',
    items: ['פריט אחד', '{n} פריטים'], allergens: 'אלרגנים',
    listNotice: 'אי אפשר להציג את השולחן במכשיר הזה, אז התפריט מוצג כרשימה.', tryTable: 'לנסות שוב את השולחן',
    total: 'סה״כ', trayEmpty: 'עוד אין כאן כלום.', trayNote: 'מראים את הרשימה למלצר.', clear: 'לנקות את הרשימה', orderOn: 'להזמנה ב-{host}', orderOnline: 'להזמנה אונליין', orderDemo: 'בתפריט שלכם הכפתור הזה פותח את עמוד ההזמנות שלכם.',
    loading: 'התפריט נטען…', unavailableTitle: 'התפריט לא זמין כרגע', unavailableBody: 'אפשר לבקש את התפריט מהצוות של {name}.', unavailableBodyAnon: 'אפשר לבקש את התפריט מהצוות.',
    notFoundTitle: 'לא מצאנו את התפריט הזה', notFoundBody: 'כדאי לבדוק את הקישור או לסרוק שוב את הקוד שעל השולחן.', errorTitle: 'התפריט לא נטען', errorBody: 'בדקו את החיבור ונסו שוב.', retry: 'לנסות שוב',
    previewTitle: 'מחכים לתצוגה המקדימה', previewBody: 'משאירים את העורך פתוח, והתפריט יופיע כאן.', emptyTitle: 'עוד אין כלום בתפריט הזה', emptyBody: 'אפשר לבקש את התפריט מהצוות.',
    tags: { vegan: 'טבעוני', vegetarian: 'צמחוני', spicy: 'חריף', gf: 'ללא גלוטן' },
    wine: { producer: 'יקב', name: 'יין', vintage: 'בציר', region: 'אזור', grape: 'זן', serving: 'הגשה', color: 'צבע', sweetness: 'מתיקות', acidity: 'חומציות', body: 'גוף', fruit: 'פרי', minerality: 'מינרליות', pairings: 'מתאים עם' },
    wineColor: { red: 'אדום', white: 'לבן', rose: 'רוזה', sparkling: 'מבעבע', orange: 'כתום' },
    beer: { brewery: 'מבשלה', style: 'סגנון', abv: 'אלכוהול', serving: 'הגשה', color: 'צבע' },
    beerServing: { bottle: 'בקבוק', can: 'פחית', tap: 'מהחבית' }, beerColor: { pale: 'בהירה', amber: 'ענברית', dark: 'כהה' },
    stageLabel: 'המנות על שולחן. כל המנות מופיעות גם ברשימת התפריט.', credit: 'תפריט של {name}', demo: 'תפריט הדגמה · מסעדה מומצאת', demoShort: 'הדגמה', backTo: 'חזרה אל {name}',
    /* night:templates */ demoAi: 'מנות לדוגמה · נוצרו בבינה מלאכותית' /* /night:templates */
  }
};
export function makeT(getLang) {
  const t = (key, vars) => {
    let s = STR[getLang()][key]; if (s == null) s = STR.en[key]; if (s == null) return key;
    if (vars) Object.keys(vars).forEach((k) => { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  };
  t.group = (key) => STR[getLang()][key] || STR.en[key] || {};
  t.count = (key, n) => { const f = STR[getLang()][key] || STR.en[key]; return (n === 1 ? f[0] : f[1]).replace('{n}', n); };
  return t;
}
