/* Every word on Café Lima's board and on the guest's phone that does not come from the layout. Hebrew first; every Hebrew
   line is new and goes to a native read (Rami) before it reaches a café. {x} is filled in; ′ is minutes; ₪ amounts in the
   demo are samples and say so. */
export const STR = {
  he: {
    venue: 'קפה לימה', draft: 'טיוטה ראשונה שצוירה מתמונות', boardTitle: 'לוח הבקרה', lang: 'EN', langLabel: 'Switch to English',
    demo: 'הדגמה · מספרים להמחשה · הכול נשמר רק בדפדפן הזה', demoClock: 'שעון הדגמה', speed: 'מואץ ×{n}',
    terrace: 'המרפסת', inside: 'בפנים', above: 'מלמעלה', view3d: 'תלת־ממד', view2d: 'תוכנית', views: 'מבט',
    placeLabel: 'מודל תלת־ממדי של קפה לימה: {n} שולחנות. אפשר לסובב בגרירה, להתקרב בגלגלת, ולבחור שולחן מהרשימה.', planLabel: 'תוכנית קפה לימה מלמעלה: {n} שולחנות, הרחוב למטה. כל שולחן הוא כפתור.',
    fallback: 'מוצגת התוכנית הדו־ממדית ({why}).',
    edit: 'לערוך את הרצפה', customize: 'התאמה', phone: 'הטלפון של האורח', settings: 'הגדרות', alertsOff: 'להפעיל התראות', alertsOn: 'ההתראות פועלות',
    pTables: 'שולחנות', pOrders: 'הזמנות', pBids: 'הצעות לשעות העומס', pAlerts: 'התראות',
    free: 'פנוי', seated: 'יושבים', ending: 'עומד להסתיים', over: 'הזמן נגמר', reserved: 'שמור', held: 'שמור למציע',
    tableN: 'שולחן {n}', left: 'עוד {n}′', overBy: '\u2066+{n}′\u2069', at: 'ב־{time}', until: 'עד {time}', heldFor: 'שמור \u2066{from}–{to}\u2069',
    guests: ['סועד אחד', '{n} סועדים'], upTo: ['סועד אחד', 'עד {n} סועדים'],
    seat: 'להושיב', extend: '\u2066+{n}′\u2069', endNow: 'לסיים', freeIt: 'לפנות', setIt: 'לערוך את השולחן', close: 'סגירה', cancel: 'ביטול', done: 'סיום',
    party: 'סועדים', fewer: 'סועד אחד פחות', more: 'עוד סועד', frame: 'זמן ישיבה', shorter: '5 דקות פחות', longer: '5 דקות יותר', minutes: '{n} דק׳',
    why_table: 'הזמן של השולחן הזה', why_peak_zone: 'זמן שעת העומס ב{zone}', why_peak: 'זמן שעת העומס', why_zone: 'הזמן של {zone}', why_default: 'זמן הישיבה הרגיל',
    heldNote: 'השולחן שמור לזוכה בהצעה, \u2066{from}–{to}\u2069.', seatWinner: 'להושיב את הזוכה',
    newOrder: 'הזמנה חדשה', autoplay: 'הדגמה אוטומטית', oNew: 'חדשה', oPrep: 'בהכנה', oReady: 'מוכנה', oPicked: 'נאספה',
    toPrep: 'להכנה', ready: 'מוכנה!', picked: 'נאספה', undo: 'ביטול', noOrders: 'אין הזמנות בתור.', orderFor: 'לשולחן', noTable: 'בלי שולחן', addOrder: 'להוסיף',
    itemsDemo: 'פריטים לדוגמה · בלי מחירים',
    peakNow: 'שעת עומס עכשיו · \u2066{from}–{to}\u2069', peakNext: 'שעת העומס הבאה · \u2066{from}–{to}\u2069', peakNone: 'אין שעות עומס מוגדרות.', peakExample: 'דוגמה',
    bidsSample: 'סכומים לדוגמה · שום דבר לא מחויב', slot: '\u2066{from}–{to}\u2069', closesIn: 'נסגר בעוד {t}', closed: 'נסגר', noBids: 'עוד אין הצעות',
    highest: 'הגבוהה ₪{n}', bidders: ['מציע אחד', '{n} מציעים'], acceptNow: 'לאשר עכשיו', declineIt: 'לסרב', releaseIt: 'לשחרר', declineReason: 'השולחן לא זמין בשעה הזו',
    wonBy: 'זכה ב־₪{n}', unsold: 'לא נמכר', declined: 'סורב', released: 'שוחרר', credited: 'הסכום יקוזז מההזמנה',
    noAlerts: 'שקט. אין התראות.', aTimeUp: 'הזמן נגמר · {table}', aReady: 'הזמנה #{no} מוכנה · נשלחה הודעה לטלפון של האורח', aBid: 'הצעה חדשה · {table} · ₪{n}', aWon: '{table} נשמר לזוכה · ₪{n}', aOutbid: 'הצעה עקפה הצעה · {table}',
    seen: 'ראיתי', timeUpBody: '{party} · להאריך או לפנות',
    custTitle: 'התאמת הלוח', custHint: 'אילו לוחות יופיעו, באיזה סדר, ובאיזו צפיפות. נשמר בדפדפן.', up: 'למעלה', down: 'למטה', show: 'להציג', density: 'צפיפות', roomy: 'מרווח', compact: 'צפוף',
    setTitle: 'הגדרות', sFrames: 'זמני ישיבה', sDefault: 'הזמן הרגיל', sZone: 'לפי אזור', sPeakZone: 'בשעת עומס, לפי אזור', sSame: 'כמו הרגיל',
    sPeaks: 'שעות העומס', sFrom: 'מ־', sTo: 'עד', sDays: 'ימים', days: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'],
    sBids: 'הצעות על שולחנות', sBidTables: 'שולחנות שאפשר להציע עליהם', sMin: 'הצעה מינימלית (לדוגמה)', sStep: 'קפיצה (לדוגמה)', sCredit: 'הסכום הזוכה יקוזז מההזמנה', resetDemo: 'לאפס את ההדגמה',
    editTitle: 'עריכת הרצפה', add: 'להוסיף', kRound2: 'עגול ל־2', kRound3: 'עגול ל־3', kSquare2: 'מרובע ל־2', kLong4: 'ארוך ל־4', kLounge: 'פינת ספות',
    dup: 'לשכפל', del: 'למחוק', rotate: 'לסובב 15°', seats: 'מקומות', minParty: 'הכי מעט', maxParty: 'הכי הרבה', zone: 'אזור', redo: 'שוב',
    save: 'לשמור', saved: 'נשמר', resetLima: 'לחזור לטיוטה של לימה', export: 'לייצא JSON', top: 'מבט מלמעלה', pick: 'בוחרים שולחן: נוגעים בו, גוררים אותו, או חצים להזזה ו־R לסיבוב.',
    wOverlap: '{a} נוגע ב{b}', wOutside: '{a} מחוץ לבית הקפה', wOk: 'אין בעיות ברצפה.', notSaved: 'לא נשמר: {why}', unsaved: 'יש שינויים שלא נשמרו',
    flash_set: 'השולחן נערך', credit: 'מנה · ניהול המקום'
  },
  en: {
    venue: 'Café Lima', draft: 'a first draft drawn from photos', boardTitle: 'The board', lang: 'עב', langLabel: 'מעבר לעברית',
    demo: 'Demo · sample numbers · everything stays in this browser', demoClock: 'Demo clock', speed: 'sped up ×{n}',
    terrace: 'The terrace', inside: 'Inside', above: 'From above', view3d: '3D', view2d: 'Plan', views: 'View',
    placeLabel: 'A 3D model of Café Lima: {n} tables. Drag to turn, scroll to zoom, and pick a table from the list.', planLabel: 'Café Lima’s plan from above: {n} tables, the street at the bottom. Each table is a button.',
    fallback: 'Showing the 2D plan ({why}).',
    edit: 'Edit the floor', customize: 'Customize', phone: 'Guest’s phone', settings: 'Settings', alertsOff: 'Turn on alerts', alertsOn: 'Alerts on',
    pTables: 'Tables', pOrders: 'Orders', pBids: 'Peak-time bids', pAlerts: 'Alerts',
    free: 'Free', seated: 'Seated', ending: 'Ending soon', over: 'Time is up', reserved: 'Reserved', held: 'Held by a bid',
    tableN: 'Table {n}', left: '{n}′ left', overBy: '\u2066+{n}′\u2069', at: 'at {time}', until: 'until {time}', heldFor: 'held {from}–{to}',
    guests: ['One guest', '{n} guests'], upTo: ['One guest', 'Up to {n} guests'],
    seat: 'Seat', extend: '\u2066+{n}′\u2069', endNow: 'End', freeIt: 'Free', setIt: 'Set the table', close: 'Close', cancel: 'Cancel', done: 'Done',
    party: 'Guests', fewer: 'One guest fewer', more: 'One guest more', frame: 'Time frame', shorter: '5 minutes less', longer: '5 minutes more', minutes: '{n} min',
    why_table: 'this table’s own frame', why_peak_zone: 'the peak frame for {zone}', why_peak: 'the peak frame', why_zone: 'the frame for {zone}', why_default: 'the default frame',
    heldNote: 'This table is held for a bid winner, {from}–{to}.', seatWinner: 'Seat the winner',
    newOrder: 'New order', autoplay: 'Auto-play', oNew: 'New', oPrep: 'Preparing', oReady: 'Ready', oPicked: 'Picked up',
    toPrep: 'Preparing', ready: 'Ready!', picked: 'Picked up', undo: 'Undo', noOrders: 'No orders in the queue.', orderFor: 'For table', noTable: 'No table', addOrder: 'Add',
    itemsDemo: 'Sample items · no prices',
    peakNow: 'Peak now · {from}–{to}', peakNext: 'Next peak · {from}–{to}', peakNone: 'No peak windows set.', peakExample: 'Example',
    bidsSample: 'Sample amounts · nothing is charged', slot: '\u2066{from}–{to}\u2069', closesIn: 'closes in {t}', closed: 'closed', noBids: 'No bids yet',
    highest: 'highest ₪{n}', bidders: ['one bidder', '{n} bidders'], acceptNow: 'Accept now', declineIt: 'Decline', releaseIt: 'Release', declineReason: 'This table is not available at this time',
    wonBy: 'won at ₪{n}', unsold: 'no bids', declined: 'declined', released: 'released', credited: 'credited to the order',
    noAlerts: 'All quiet. No alerts.', aTimeUp: 'Time is up · {table}', aReady: 'Order #{no} is ready · the guest’s phone is told', aBid: 'New bid · {table} · ₪{n}', aWon: '{table} is held for the winner · ₪{n}', aOutbid: 'A bid was outbid · {table}',
    seen: 'Seen', timeUpBody: '{party} · extend or free it',
    custTitle: 'Customize the board', custHint: 'Which panels show, in which order, and how dense. Kept in this browser.', up: 'Up', down: 'Down', show: 'Show', density: 'Density', roomy: 'Roomy', compact: 'Compact',
    setTitle: 'Settings', sFrames: 'Time frames', sDefault: 'Default', sZone: 'By zone', sPeakZone: 'At peak, by zone', sSame: 'as the default',
    sPeaks: 'Peak windows', sFrom: 'from', sTo: 'to', sDays: 'Days', days: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    sBids: 'Bidding on tables', sBidTables: 'Tables guests can bid for', sMin: 'Minimum bid (sample)', sStep: 'Step (sample)', sCredit: 'Credit the winning amount to the order', resetDemo: 'Reset the demo',
    editTitle: 'Editing the floor', add: 'Add', kRound2: 'Round for 2', kRound3: 'Round for 3', kSquare2: 'Square for 2', kLong4: 'Long for 4', kLounge: 'A lounge',
    dup: 'Duplicate', del: 'Delete', rotate: 'Rotate 15°', seats: 'Seats', minParty: 'Fewest', maxParty: 'Most', zone: 'Zone', redo: 'Redo',
    save: 'Save', saved: 'Saved', resetLima: 'Reset to Lima’s draft', export: 'Export JSON', top: 'Top view', pick: 'Pick a table: tap it, drag it, or use the arrows to move and R to rotate.',
    wOverlap: '{a} touches {b}', wOutside: '{a} is outside the café', wOk: 'The floor has no problems.', notSaved: 'Not saved: {why}', unsaved: 'Unsaved changes',
    flash_set: 'The table is set', credit: 'Mana · the place system'
  }
};
/* the guest's phone */
export const GSTR = {
  he: {
    youAt: 'אתם בשולחן {n} · {zone}', hello: 'ברוכים הבאים ללימה', demo: 'הדגמה · השולחן, ההזמנה וההצעות להמחשה',
    sound: 'נגיעה אחת כדי שהטלפון יוכל לצפצף', soundOn: 'הצפצוף פועל', orderTitle: 'מחכים להזמנה?', orderHint: 'מקלידים את המספר מהקבלה',
    follow: 'לעקוב', numLabel: 'מספר ההזמנה', attached: 'הדלפק צירף את ההזמנה לשולחן', yourOrder: 'ההזמנה שלכם #{no}',
    gNew: 'התקבלה', gPrep: 'בהכנה', gReady: 'מוכנה! אפשר לגשת לדלפק', gPicked: 'נאספה. בתיאבון!', notFound: 'אין הזמנה עם המספר הזה (עדיין).',
    readyTitle: 'ההזמנה שלכם מוכנה', readyBody: 'אוספים בדלפק', gotIt: 'הבנתי', notifTitle: 'ההזמנה מוכנה · #{no}', notifBody: 'אוספים בדלפק',
    bidTitle: 'המקומות הטובים בשעת העומס', bidHint: 'מציעים על שולחן לשעה מסוימת. ההצעה הגבוהה זוכה כשההצעות נסגרות.', bidSample: 'סכומים לדוגמה · שום דבר לא מחויב',
    bidFor: 'הצעה', bidBtn: 'להציע ₪{n}', forParty: 'בשביל {n}', leading: 'אתם מובילים', outbid: 'עקפו את ההצעה שלכם', won: '{table} שלכם, \u2066{from}–{to}\u2069', lost: 'ההצעה לא זכתה',
    declinedG: 'בית הקפה לא פתח את השולחן הזה', creditG: 'הסכום יקוזז מההזמנה שלכם', none: 'אין הצעות פתוחות עכשיו.', current: 'הגבוהה ₪{n}', start: 'מתחיל ב־₪{n}', closesIn: 'נסגר בעוד {t}',
    lang: 'EN', langLabel: 'Switch to English', noTable: 'השולחן הזה לא נמצא בבית הקפה.', back: 'לשולחן שלי'
  },
  en: {
    youAt: 'You are at Table {n} · {zone}', hello: 'Welcome to Lima', demo: 'Demo · the table, the order and the bids are samples',
    sound: 'Tap once so your phone can beep', soundOn: 'Beep is on', orderTitle: 'Waiting for an order?', orderHint: 'Enter the number from your receipt',
    follow: 'Follow', numLabel: 'Order number', attached: 'The counter attached your order to this table', yourOrder: 'Your order #{no}',
    gNew: 'Received', gPrep: 'Being prepared', gReady: 'Ready! Come to the counter', gPicked: 'Picked up. Enjoy!', notFound: 'No order with that number (yet).',
    readyTitle: 'Your order is ready', readyBody: 'Pick it up at the counter', gotIt: 'Got it', notifTitle: 'Your order is ready · #{no}', notifBody: 'Pick it up at the counter',
    bidTitle: 'The best seats at peak', bidHint: 'Bid for a table at a time. The highest bid wins when bidding closes.', bidSample: 'Sample amounts · nothing is charged',
    bidFor: 'Bid', bidBtn: 'Bid ₪{n}', forParty: 'for {n}', leading: 'You’re leading', outbid: 'You’ve been outbid', won: '{table} is yours, {from}–{to}', lost: 'Your bid did not win',
    declinedG: 'The café did not open this table', creditG: 'The amount is credited to your order', none: 'No bidding open right now.', current: 'highest ₪{n}', start: 'starts at ₪{n}', closesIn: 'closes in {t}',
    lang: 'עב', langLabel: 'מעבר לעברית', noTable: 'This table is not in the café.', back: 'My table'
  }
};
export function makeT(table, getLang) {
  const t = (key, vars) => { let s = table[getLang()][key]; if (s == null) s = table.en[key]; if (s == null) return key; if (vars) Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(vars[k]); }); return s; };
  t.count = (key, n) => { const f = table[getLang()][key] || table.en[key]; return (n === 1 ? f[0] : f[1]).replace('{n}', n); };
  t.list = (key) => table[getLang()][key] || table.en[key];
  return t;
}
/* the café's small list for the demo's orders: plain names, no prices */
export const ITEMS = [
  ['espresso', 'אספרסו', 'Espresso'], ['cappuccino', 'הפוך', 'Cappuccino'], ['iced-coffee', 'קפה קר', 'Iced coffee'], ['tea', 'תה', 'Tea'], ['lemonade', 'לימונדה', 'Lemonade'],
  ['croissant', 'קרואסון', 'Croissant'], ['sandwich', 'כריך', 'Sandwich'], ['pastry', 'מאפה', 'Pastry'], ['cookie', 'עוגייה', 'Cookie']
];
export const itemName = (id, lang) => { const it = ITEMS.find((x) => x[0] === id); return it ? (lang === 'he' ? it[1] : it[2]) : id; };
