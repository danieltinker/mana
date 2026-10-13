/* Every word on the host board that does not come from the layout. Hebrew first; every Hebrew line goes to a native read
   before it reaches a restaurant. {x} is filled in; ′ is minutes. */
export const STR = {
  he: {
    title: 'ניהול שולחנות', venue: 'אוליאה', lang: 'EN', langLabel: 'Switch to English',
    floor: 'מפה', list: 'רשימה', views: 'תצוגה',
    settings: 'הגדרות', alertsOff: 'להפעיל התראות', alertsOn: 'ההתראות פועלות', alertsHint: 'צליל, רטט והודעה כשנגמר זמן לשולחן',
    free: 'פנוי', reserved: 'שמור',
    nFree: 'פנויים', nSeated: 'יושבים', nEnding: 'מסתיימים', nOver: 'הזמן נגמר',
    tableN: 'שולחן {n}', barName: 'הבר', until: 'עד {time}', endedAt: 'נגמר ב־{time}',
    guests: ['סועד אחד', '{n} סועדים'], upTo: ['סועד אחד', 'עד {n} סועדים'], seatedAt: 'הושבו ב־{time}', extendedBy: 'הוארך ב־{n} דק׳',
    leftAria: 'נשארו {n} דקות, עד {time}', leftAriaOne: 'נשארה דקה אחת, עד {time}', overAria: 'הזמן נגמר לפני {n} דקות', freeAria: 'פנוי',
    seatTitle: 'להושיב', party: 'סועדים', fewer: 'סועד אחד פחות', more: 'עוד סועד', frame: 'זמן ישיבה', shorter: '15 דקות פחות', longer: '15 דקות יותר',
    frameDefault: 'ברירת המחדל לשולחן הזה', seat: 'להושיב', cancel: 'ביטול', close: 'סגירה',
    extend: 'להאריך ב־{n} דק׳', endNow: 'לסיים עכשיו', freeIt: 'לפנות', freeTable: 'לפנות את השולחן',
    timeUp: 'הזמן נגמר · {table}', timeUpBody: '{party} · הזמן נגמר ב־{time}', seen: 'ראיתי', upStrip: 'הזמן נגמר:',
    setTitle: 'הגדרות השעון', setFrame: 'זמן ישיבה רגיל', setFrameHint: 'כל שולחן מקבל אותו, אלא אם נקבע לו זמן משלו',
    setEnding: 'התראת "עומד להסתיים"', setEndingHint: 'כמה דקות לפני הסוף הטבעת מחליפה צבע',
    setGrace: 'זמן חסד', setGraceHint: 'אחרי שהזמן נגמר, כמה דקות עד שהשולחן מתפנה מעצמו',
    setTables: 'זמן לכל שולחן', setTablesHint: 'שולחן בלי זמן משלו מקבל את הרגיל', reset: 'לחזור לרגיל',
    minutes: '{n} דק׳', less: 'פחות', moreMin: 'יותר', done: 'סיום', resetDemo: 'לאפס את ההדגמה',
    demoLine: 'הדגמה · מסעדה מומצאת · הנתונים בדויים ונשמרים רק בדפדפן הזה', speedLine: 'שעון מואץ ×{n}',
    notifTitle: 'הזמן נגמר · {table}', notifBody: 'להאריך או לפנות את השולחן', floorLabel: 'מפת המסעדה: {n} שולחנות. כל שולחן הוא כפתור.',
    credit: 'ניהול שולחנות של מנה'
  },
  en: {
    title: 'Tables', venue: 'Olea', lang: 'עב', langLabel: 'מעבר לעברית',
    floor: 'Floor', list: 'List', views: 'View',
    settings: 'Settings', alertsOff: 'Turn on alerts', alertsOn: 'Alerts on', alertsHint: 'A chime, a buzz and a notice when a table’s time is up',
    free: 'Free', reserved: 'Reserved',
    nFree: 'free', nSeated: 'seated', nEnding: 'ending', nOver: 'time up',
    tableN: 'Table {n}', barName: 'The bar', until: 'until {time}', endedAt: 'ended {time}',
    guests: ['One guest', '{n} guests'], upTo: ['One guest', 'Up to {n} guests'], seatedAt: 'Seated {time}', extendedBy: 'Extended {n}′',
    leftAria: '{n} minutes left, until {time}', leftAriaOne: 'One minute left, until {time}', overAria: 'Time was up {n} minutes ago', freeAria: 'Free',
    seatTitle: 'Seat', party: 'Guests', fewer: 'One guest fewer', more: 'One guest more', frame: 'Time frame', shorter: '15 minutes less', longer: '15 minutes more',
    frameDefault: 'This table’s default', seat: 'Seat', cancel: 'Cancel', close: 'Close',
    extend: 'Extend +{n}′', endNow: 'End now', freeIt: 'Free', freeTable: 'Free the table',
    timeUp: 'Time is up · {table}', timeUpBody: '{party} · time was up at {time}', seen: 'Seen', upStrip: 'Time is up:',
    setTitle: 'Clock settings', setFrame: 'Default time frame', setFrameHint: 'Every table gets it unless it has its own',
    setEnding: '“Ending soon” warning', setEndingHint: 'How many minutes before the end the ring changes colour',
    setGrace: 'Grace period', setGraceHint: 'After time is up, minutes until the table frees itself',
    setTables: 'Per table', setTablesHint: 'A table without its own time gets the default', reset: 'Back to the default',
    minutes: '{n} min', less: 'less', moreMin: 'more', done: 'Done', resetDemo: 'Reset the demo',
    demoLine: 'Demo · invented restaurant · the data is fictional and stays in this browser', speedLine: 'Clock sped up ×{n}',
    notifTitle: 'Time is up · {table}', notifBody: 'Extend or free the table', floorLabel: 'Floor plan: {n} tables. Each table is a button.',
    credit: 'Table management by Mana'
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
