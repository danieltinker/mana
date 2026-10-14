/* Every word on the seat map that does not come from the layout. Hebrew first; every Hebrew line goes to a native read. */
export const PRODUCT = { name: { en: 'Mana', he: 'מנה' }, url: 'https://halom.io/mana/' };

export const STR = {
  he: {
    title: 'הזמנת שולחן', backToMenu: 'חזרה לתפריט', lang: 'EN', langLabel: 'Switch to English',
    demoLine: 'הדגמה · מסעדה מומצאת · הפרטים בדויים ונשמרים רק בדפדפן הזה',
    planLabel: 'תוכנית המסעדה: {zones} אזורים, {tables} שולחנות. הבחירה נעשית ברשימה שמתחת.',
    step: 'שלב {i} מתוך {n}',
    when: 'מתי?', date: 'תאריך', time: 'שעה', party: 'סועדים', fewer: 'פחות סועד אחד', more: 'עוד סועד אחד',
    where: 'איפה תרצו לשבת?', areas: 'אזורים', noFit: 'אין כאן שולחן ל־{n}', fitCount: ['שולחן אחד מתאים', '{n} שולחנות מתאימים'],
    which: 'שולחן מסוים?', whichHint: 'אפשר גם להשאיר את הבחירה למסעדה.', anyTable: 'כל שולחן באזור', tables: 'שולחנות', tableN: 'שולחן {n}', seats: '{a}–{b} סועדים', seatsOne: 'סועד אחד', seatsUpTo: 'עד {b} סועדים',
    details: 'הפרטים שלכם', name: 'שם', phone: 'טלפון', note: 'הערה למסעדה', noteHint: 'לא חובה', demoFill: 'פרטים בדויים, לדוגמה',
    next: 'הלאה', back: 'חזרה', send: 'לשלוח בקשה',
    sentTitle: 'הבקשה נשלחה', sentBody: 'המסעדה מאשרת את הבקשה ומעדכנת אתכם.', pendingTitle: 'ממתינה לאישור המסעדה', approvedTitle: 'השולחן שלכם מאושר', declinedTitle: 'המסעדה לא יכלה לאשר',
    yourTable: 'השולחן שלכם: {table}', yourArea: 'האזור שלכם: {zone}', reasonLine: 'הסיבה: {reason}', again: 'בקשה חדשה', ownerLink: 'למסך של בעל המסעדה',
    summary: '{party} סועדים · {date} · {time}', summaryOne: 'סועד אחד · {date} · {time}',
    ownerTitle: 'בקשות לשולחן', pending: 'ממתינות', decided: 'טופלו', empty: 'עוד אין בקשות.', emptyHint: 'שולחים אחת מהמפה של האורחים.', guestLink: 'למסך האורח',
    approve: 'לאשר', swap: 'להחליף שולחן', decline: 'לדחות', reason: 'סיבה (האורח יראה אותה)', confirmDecline: 'לדחות עם הסיבה הזו', cancel: 'ביטול', keepTable: 'להשאיר', chooseTable: 'לאיזה שולחן?',
    statusPending: 'ממתינה', statusApproved: 'אושרה', statusDeclined: 'נדחתה', area: 'אזור', table: 'שולחן', anyTableShort: 'כל שולחן', inZone: 'ב{zone}',
    noLayout: 'אין כאן מפת ישיבה.', noLayoutBody: 'הקישור צריך להוביל למסעדה עם מפה.', credit: 'מפת ישיבה של {name}', bar: 'הבר · בלי הזמנה מראש'
  },
  en: {
    title: 'Book a table', backToMenu: 'Back to the menu', lang: 'עב', langLabel: 'מעבר לעברית',
    demoLine: 'Demo · invented restaurant · the details are fictional and stay in this browser',
    planLabel: 'Floor plan: {zones} areas, {tables} tables. Choose from the list below the plan.',
    step: 'Step {i} of {n}',
    when: 'When?', date: 'Date', time: 'Time', party: 'Guests', fewer: 'One guest fewer', more: 'One guest more',
    where: 'Where would you like to sit?', areas: 'Areas', noFit: 'No table for {n} here', fitCount: ['One table fits', '{n} tables fit'],
    which: 'A particular table?', whichHint: 'You can also leave the choice to the restaurant.', anyTable: 'Any table in this area', tables: 'Tables', tableN: 'Table {n}', seats: '{a}–{b} guests', seatsOne: 'One guest', seatsUpTo: 'Up to {b} guests',
    details: 'Your details', name: 'Name', phone: 'Phone', note: 'A note for the restaurant', noteHint: 'Optional', demoFill: 'Fictional demo details',
    next: 'Next', back: 'Back', send: 'Send request',
    sentTitle: 'Request sent', sentBody: 'The restaurant confirms the request and lets you know.', pendingTitle: 'Waiting for the restaurant', approvedTitle: 'Your table is confirmed', declinedTitle: 'The restaurant could not confirm',
    yourTable: 'Your table: {table}', yourArea: 'Your area: {zone}', reasonLine: 'Reason: {reason}', again: 'New request', ownerLink: 'The owner’s screen',
    summary: '{party} guests · {date} · {time}', summaryOne: 'One guest · {date} · {time}',
    ownerTitle: 'Table requests', pending: 'Pending', decided: 'Decided', empty: 'No requests yet.', emptyHint: 'Send one from the guests’ seat map.', guestLink: 'The guest’s screen',
    approve: 'Approve', swap: 'Swap table', decline: 'Decline', reason: 'Reason (the guest will see it)', confirmDecline: 'Decline with this reason', cancel: 'Cancel', keepTable: 'Keep', chooseTable: 'Which table?',
    statusPending: 'Pending', statusApproved: 'Approved', statusDeclined: 'Declined', area: 'Area', table: 'Table', anyTableShort: 'Any table', inZone: 'in {zone}',
    noLayout: 'There is no seat map here.', noLayoutBody: 'The link needs to lead to a restaurant with a map.', credit: 'Seat map by mana', bar: 'The bar · no booking'
  }
};
export function makeT(getLang) {
  const t = (key, vars) => {
    let s = STR[getLang()][key]; if (s == null) s = STR.en[key]; if (s == null) return key;
    if (vars) Object.keys(vars).forEach((k) => { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  };
  t.count = (key, n) => { const f = STR[getLang()][key] || STR.en[key]; return (n === 1 ? f[0] : f[1]).replace('{n}', n); };
  return t;
}
