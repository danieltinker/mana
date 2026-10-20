/* The words of the v2 guest menu (schema 2): choices, the basket, suggestions, the filter, opening hours. The v1 words
   stay in ../i18n.js; these load only with a v2 menu. Hebrew needs a native read before it goes out (CLAUDE.md). */
export const STR2 = {
  en: {
    from: 'from',
    chooseOne: 'Choose 1', chooseN: 'Choose {n}', upTo: 'Up to {n}', range: 'Choose {min} to {max}', required: 'Required', optional: 'Optional',
    none: 'None', soldOut: 'Sold out', plus: '+{price}', oneMore: 'One more: {name}', oneLess: 'One less: {name}',
    stillNeeded: 'Still to choose: {groups}', add: 'Add to my table', addPrice: 'Add to my table · {price}', save: 'Save changes', savePrice: 'Save changes · {price}', added: 'Added to my table',
    goesWell: 'Goes well with', suggestion: 'A suggestion', accept: 'Add', dismiss: 'No thanks', acceptName: 'Add {name}', dismissName: 'No thanks: {name}',
    addonAdded: 'Added {option} to one {dish}.', fromPrefix: 'from ',
    openerOff: '{group}: none left', openerNeed: "{name} can't be ordered now ({group}: none left). Choose another.",
    vat: 'Prices include VAT.', edit: 'Change', removeLine: 'Remove',
    lineOff: 'Sold out now. You can remove it.', lineOptionOff: '{name} is sold out now. Change your choice.', lineLater: '{label}. You can keep it for later.',
    lineGone: 'No longer on the menu. You can remove it.', lineChoose: 'A choice is missing. Change your choice.', lineNotCounted: 'Not in the total',
    offNow: 'Sold out', offToday: 'Sold out · back at {time}', offDay: 'Sold out · back on {day}',
    laterToday: 'Served from {time}', laterDay: 'Served from {day}, {time}', laterNone: 'Not served now',
    closedNow: 'Closed now', opensToday: 'Closed now · opens at {time}', opensDay: 'Closed now · opens {day} at {time}',
    filter: 'Filter the menu', filterTitle: 'Show only', filterOn: 'Showing only: {tags}', filterClear: 'Show everything', filterCount: '{n} dishes', filterCountOne: '1 dish'
  },
  he: {
    from: 'החל מ־',
    chooseOne: 'לבחור 1', chooseN: 'לבחור {n}', upTo: 'עד {n}', range: 'לבחור {min} עד {max}', required: 'חובה', optional: 'לא חובה',
    none: 'בלי', soldOut: 'אזל', plus: '+{price}', oneMore: 'עוד אחד: {name}', oneLess: 'אחד פחות: {name}',
    stillNeeded: 'עוד צריך לבחור: {groups}', add: 'להוסיף לשולחן שלי', addPrice: 'להוסיף לשולחן שלי · {price}', save: 'לשמור את השינויים', savePrice: 'לשמור את השינויים · {price}', added: 'נוסף לשולחן שלי',
    goesWell: 'הולך טוב עם', suggestion: 'הצעה', accept: 'להוסיף', dismiss: 'לא תודה', acceptName: 'להוסיף {name}', dismissName: 'לא תודה: {name}',
    addonAdded: 'הוספנו {option} למנה אחת של {dish}.', fromPrefix: 'החל מ־',
    openerOff: 'אין {group} כרגע', openerNeed: 'אי אפשר להזמין {name} כרגע: אין {group}. אפשר לבחור משהו אחר.',
    vat: 'המחירים כוללים מע״מ.', edit: 'לשנות', removeLine: 'להסיר',
    lineOff: 'אזל כרגע. אפשר להסיר.', lineOptionOff: '{name} אזל כרגע. אפשר לשנות את הבחירה.', lineLater: '{label}. אפשר להשאיר לאחר כך.',
    lineGone: 'כבר לא בתפריט. אפשר להסיר.', lineChoose: 'חסרה בחירה. אפשר לשנות את הבחירה.', lineNotCounted: 'לא נכלל בסה״כ',
    offNow: 'אזל', offToday: 'אזל · חוזר ב־{time}', offDay: 'אזל · חוזר ב{day}',
    laterToday: 'מוגש החל מ־{time}', laterDay: 'מוגש החל מ{day}, {time}', laterNone: 'לא מוגש כרגע',
    closedNow: 'סגור כרגע', opensToday: 'סגור כרגע · נפתח ב־{time}', opensDay: 'סגור כרגע · נפתח ב{day} ב־{time}',
    filter: 'סינון התפריט', filterTitle: 'להציג רק', filterOn: 'מוצג רק: {tags}', filterClear: 'להציג הכול', filterCount: '{n} מנות', filterCountOne: 'מנה אחת'
  }
};

/* `fromPrefix` is "from" as it stands before a price: a space after it in English, none after the maqaf in Hebrew
   ("החל מ־68 ₪", the maqaf joins the number). */
/** A word in a language (English when the language has none), with {vars} filled in. */
export function word(lang, key, vars) {
  let s = (STR2[lang] && STR2[lang][key]) ?? STR2.en[key] ?? key;
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}
