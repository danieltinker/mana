// The v2 app's words. Hebrew first, English second. Everything the v1 dictionary (../lib/i18n.ts) already says is
// reused from it (t() looks here first, then there); a key lives in one dictionary only (test/check-i18n.mjs).
// New Hebrew here needs a native read before it reaches anyone (CLAUDE.md).
import { LIMITS } from '@mana/contracts';
import { applyLang, fmtDate, fmtDateTime, has as hasV1, lang, setLang, t as tV1 } from '../lib/i18n.ts';

export { applyLang, fmtDate, fmtDateTime, lang, setLang };

const S: Record<string, [string, string]> = {
  // ---- shell
  'nav2.addons': ['תוספות', 'Add-ons'],
  'nav2.more': ['עוד', 'More'],
  'nav2.waiting': ['יש שינויים שלא פורסמו', 'unpublished changes'],
  'ed.less': ['פחות: {name}', 'Less: {name}'],
  'ed.more': ['יותר: {name}', 'More: {name}'],
  'ed.min': ['לפחות', 'At least'],
  'ed.max': ['לכל היותר', 'At most'],
  'ed.hide': ['להסתיר מהאורחים', 'Hide from guests'],

  // ---- start: confirming the e-mail address
  'start.newNote': ['אין חשבון? "המשך" פותח אחד ושולח קישור לאישור האימייל.', 'No account yet? Continue opens one and sends a link to confirm your email.'],
  'start.confirm.title': ['אשרו את כתובת האימייל', 'Confirm your email address'],
  'start.confirm.sent': ['שלחנו קישור לאישור אל', 'We sent a confirmation link to'],
  'start.confirm.needed': ['כדי להיכנס צריך קודם לאשר את הכתובת, בקישור שנשלח אל', 'To sign in, first confirm the address with the link sent to'],
  'start.confirm.then': ['פתחו את הקישור, ואז חזרו לכאן והיכנסו.', 'Open the link, then come back here and sign in.'],
  'start.confirm.back': ['חזרה לכניסה', 'Back to sign in'],
  'start.confirm.resend': ['לשלוח את הקישור שוב', 'Send the link again'],
  'auth.e.signup_closed': ['האימייל או הסיסמה לא נכונים. חשבונות חדשים עוד לא נפתחים כאן.', 'The email or the password is wrong. New accounts cannot be opened here yet.'],
  'start.closedNote': ['חשבונות חדשים עוד לא נפתחים כאן. כדי לקבל גישה, כתבו לנו.', 'New accounts are not opened here yet. To get access, message us.'],

  // ---- changed somewhere else (another tab or device saved the same row first)
  'conflict.title': ['השתנה במקום אחר', 'Changed somewhere else'],
  'conflict.bodyDish': ['המנה "{name}" נשמרה במסך או במכשיר אחר אחרי שפתחתם אותה. השינוי שלכם עוד לא נשמר. מה להשאיר?', 'The dish "{name}" was saved on another screen or device after you opened it. Your change is not saved yet. Which should stay?'],
  'conflict.bodySection': ['הקטגוריה "{name}" נשמרה במסך או במכשיר אחר אחרי שפתחתם אותה. השינוי שלכם עוד לא נשמר. מה להשאיר?', 'The section "{name}" was saved on another screen or device after you opened it. Your change is not saved yet. Which should stay?'],
  'conflict.body': ['"{name}" נשמר במסך או במכשיר אחר אחרי שפתחתם אותו. השינוי שלכם עוד לא נשמר. מה להשאיר?', '"{name}" was saved on another screen or device after you opened it. Your change is not saved yet. Which should stay?'],
  'conflict.field': ['שדה', 'Field'],
  'conflict.stored': ['שמור עכשיו', 'Stored now'],
  'conflict.mine': ['שלכם', 'Yours'],
  'conflict.alsoThere': ['שם השתנו גם: {fields}. זה נשאר כמו שנשמר שם.', 'Also changed there: {fields}. That stays as it was saved there.'],
  'conflict.hint': ['"להשאיר את שלי" שומר רק את מה ששיניתם כאן.', '"Keep mine" saves only what you changed here.'],
  'conflict.keepMine': ['להשאיר את שלי', 'Keep mine'],
  'conflict.takeStored': ['לקחת את השמור', 'Take the stored one'],
  'conflict.empty': ['ריק', 'Empty'],
  'conflict.shown': ['מוצג', 'Shown'],
  'conflict.position': ['מקום ברשימה', 'Place in the list'],

  // ---- a new place
  'venue.create': ['יצירת המקום', 'Create the place'],
  'venue.unconfirmed.title': ['קודם מאשרים את האימייל', 'First, confirm your email'],
  'venue.unconfirmed.body': ['אפשר ליצור מקום רק אחרי שכתובת האימייל אושרה. הקישור לאישור נשלח אל', 'A place can be created only once your email address is confirmed. The confirmation link went to'],
  'venue.unconfirmed.then': ['אחרי שתפתחו את הקישור, צאו והיכנסו שוב.', 'Once you have opened the link, sign out and sign in again.'],
  'venue.unsaved.title': ['יש שינויים שלא נשמרו', 'Some changes are not saved'],
  'venue.unsaved.body': ['השינויים האחרונים במקום הזה לא נשמרו. אם תעברו עכשיו למקום אחר, הם יאבדו.', 'The latest changes in this place did not save. If you switch now, they are lost.'],
  'venue.unsaved.go': ['לעבור בלי לשמור', 'Switch without saving'],
  'signout.unsaved.body': ['ייתכן שחלק מהשינויים האחרונים לא נשמרו. אם תצאו עכשיו מהחשבון, מה שלא נשמר יאבד.', 'Some of your latest changes may not be saved. If you sign out now, what did not save is lost.'],
  'signout.unsaved.go': ['לצאת בלי לשמור', 'Sign out without saving'],
  'signout.saving': ['שומרים את השינויים האחרונים…', 'Saving your latest changes…'],
  'session.ended': ['החיבור לחשבון הסתיים. היכנסו שוב כדי להמשיך.', 'Your session ended. Sign in again to continue.'],
  'session.unsaved': ['ייתכן שהשינויים האחרונים ב{names} לא נשמרו. אחרי הכניסה בדקו אותם והקלידו שוב מה שחסר.', 'Your latest changes to {names} may not be saved. After you sign in, check them and type again what is missing.'],
  'save2.failed': ['ייתכן שהשינויים לא נשמרו.', 'Your changes may not be saved.'],
  'e.timeout': ['לא קיבלנו תשובה בזמן, ולכן ייתכן שזה לא נשמר. נסו שוב.', 'No answer came in time, so this may not be saved. Try again.'],

  // ---- the menu
  'menu2.empty.title': ['התפריט עוד ריק', 'The menu is empty'],
  'menu2.empty.body': ['מתחילים בקטגוריה, למשל "עיקריות", ומוסיפים לה מנות.', 'Start with a section, such as "Mains", and add dishes to it.'],
  'menu2.empty.add': ['קטגוריה ראשונה', 'First section'],
  'menu2.groups': ['{n} קבוצות תוספות', '{n} add-on groups'],
  'menu2.groups1': ['קבוצת תוספות אחת', '1 add-on group'],
  'menu2.hidden': ['מוסתר', 'Hidden'],
  'menu2.readOnly': ['החשבון הזה יכול לראות את התפריט, אבל לא לערוך אותו.', 'This account can see the menu but not edit it.'],
  'menu2.unnamed': ['בלי שם', 'Untitled'],
  'room.label': ['הרקע בתפריט', 'Setting in the menu'],
  'room.hint': ['איפה האורחים רואים את המנות של הקטגוריה הזאת.', 'Where guests see the dishes of this section.'],
  'room.auto': ['לפי סוג הקטגוריה', 'By the kind of section'],
  'room.table': ['שולחן', 'Table'],
  'room.vitrine': ['ויטרינה', 'Pastry case'],
  'room.cellar': ['מרתף יין', 'Wine cellar'],
  'room.taps': ['ברזי בירה', 'Beer taps'],
  'room.cocktail': ['בר קוקטיילים', 'Cocktail bar'],

  // ---- one dish
  'dish.tabs': ['חלקי המנה', 'Parts of the dish'],
  'dish.tab.details': ['פרטים', 'Details'],
  'dish.tab.addons': ['תוספות', 'Add-ons'],
  'dish.tab.related': ['הולך טוב עם', 'Goes well with'],
  'dish.daypart': ['חלק מהיום', 'Day part'],
  'dish.daypart.always': ['כל שעות הפתיחה', 'All opening hours'],
  'dish.daypart.none': ['עוד לא הוגדרו חלקי יום (כמו "בוקר").', 'No day parts yet (such as "breakfast").'],
  'dish.addons.none': ['למנה הזאת עוד אין תוספות.', 'This dish has no add-ons yet.'],
  'dish.addons.attach': ['חיבור קבוצת תוספות', 'Attach an add-on group'],
  'dish.addons.attachShort': ['חיבור', 'Attach'],
  'dish.addons.attachOne': ['לחבר את {name}', 'Attach {name}'],
  'dish.addons.pick': ['מספריית התוספות', 'From the add-on library'],
  'dish.addons.allAttached': ['כל הקבוצות כבר מחוברות למנה הזאת.', 'Every group is already on this dish.'],
  'dish.addons.noLibrary': ['עוד אין קבוצות תוספות. יוצרים קבוצה פעם אחת ומחברים אותה לכמה מנות.', 'No add-on groups yet. Make a group once and attach it to many dishes.'],
  'dish.addons.remove': ['להסיר את {name} מהמנה', 'Remove {name} from this dish'],
  'dish.limits.edit': ['הגבולות של {name} במנה הזאת', 'Limits of {name} on this dish'],
  'dish.limits.here': ['מותאם למנה', 'Set for this dish'],
  'dish.limits.hint': ['בקבוצה עצמה: {rule}. במנה הזאת אפשר רק להדק.', 'The group itself: {rule}. On this dish it can only be tighter.'],
  'dish.related.hint': ['מנות שהאורח רואה ליד המנה הזאת, בסדר שתקבעו.', 'Dishes the guest sees beside this one, in the order you set.'],
  'dish.related.none': ['עוד לא נבחרו מנות.', 'No dishes chosen yet.'],
  'dish.related.add': ['להוסיף מנה', 'Add a dish'],
  'dish.related.choose': ['בחרו מנה', 'Choose a dish'],
  'dish.related.remove': ['להסיר את {name}', 'Remove {name}'],

  // ---- what the guest sees and pays
  'gp.title': ['כך האורח יראה וישלם', 'What the guest sees and pays'],
  'gp.sub': ['מהטיוטה, עוד לפני הפרסום. נסו את הבחירות.', 'From the draft, before publishing. Try the choices.'],
  'gp.from': ['החל מ־{price}', 'from {price}'],
  'gp.none': ['בלי', 'None'],
  'gp.qty': ['כמות של {name}', 'How many {name}'],
  'gp.total': ['סך הכול', 'Total'],
  'gp.vat': ['המחירים כוללים מע״מ.', 'Prices include VAT.'],
  'gp.reset': ['חזרה לבחירות המסומנות מראש', 'Back to the pre-selected choices'],
  'gp.e.below_min': ['צריך לבחור לפחות {n} ב{group}', 'Choose at least {n} in {group}'],
  'gp.e.above_max': ['אפשר לבחור לכל היותר {n} ב{group}', 'Choose at most {n} in {group}'],
  'gp.e.no_price': ['למנה עוד אין מחיר, ולכן אי אפשר להזמין אותה.', 'The dish has no price yet, so it cannot be ordered.'],
  'gp.e.unavailable': ['אי אפשר לבחור כרגע את מה שהמנה דורשת.', 'What this dish requires cannot be chosen right now.'],
  'gp.e.other': ['הבחירות האלה לא מסתדרות יחד. נסו בחירה אחרת.', 'These choices do not fit together. Try another choice.'],
  'rule.exactly': ['בוחרים {n}', 'Choose {n}'],
  'rule.upTo': ['עד {n}', 'Up to {n}'],
  'rule.between': ['בוחרים {min} עד {max}', 'Choose {min} to {max}'],
  'rule.required': ['חובה', 'required'],

  // ---- the add-on library
  'lib.title': ['קבוצות תוספות', 'Add-on groups'],
  'lib.lead': ['קבוצה נוצרת פעם אחת ומתחברת לכמה מנות: תוספת לבחירה, גודל, רטבים.', 'Make a group once and attach it to many dishes: a side of choice, a size, sauces.'],
  'lib.new': ['קבוצה חדשה', 'New group'],
  'lib.empty.title': ['עוד אין קבוצות תוספות', 'No add-on groups yet'],
  'lib.empty.body': ['למשל "תוספת לבחירה": צ׳יפס, סלט או אורז, וצ׳יפס פותח בחירה של רוטב.', 'For example "side of choice": fries, salad or rice, where fries opens a choice of sauce.'],
  'lib.choices': ['{n} אפשרויות', '{n} choices'],
  'lib.choices1': ['אפשרות אחת', '1 choice'],
  'lib.usedBy': ['ב־{n} מנות', 'On {n} dishes'],
  'lib.usedBy1': ['במנה אחת', 'On 1 dish'],
  'lib.unused': ['עוד לא מחוברת למנה', 'Not on any dish yet'],
  'lib.opens': ['פותחת את: {names}', 'Opens: {names}'],
  'lib.openedBy': ['נפתחת מתוך: {names}', 'Opens from: {names}'],
  'lib.notFound': ['הקבוצה הזאת לא נמצאה. אולי היא נמחקה.', 'This group was not found. It may have been deleted.'],
  'lib.nested.title': ['הקבוצה הזאת נפתחת מתוך בחירה', 'This group opens from a choice'],
  'lib.nested.body': ['היא נפתחת מתוך: {names}. לכן הבחירות שבה לא פותחות קבוצה נוספת: רמה אחת בלבד.', 'It opens from: {names}. So its own choices cannot open another group: one level only.'],
  'lib.name': ['השם שהאורחים רואים', 'Name guests see'],
  'lib.label': ['תווית פנימית', 'Your own label'],
  'lib.labelHint': ['רק בשבילכם, כדי להבדיל בין קבוצות. האורחים לא רואים אותה.', 'Only for you, to tell groups apart. Guests never see it.'],
  'lib.how': ['איך בוחרים', 'How guests choose'],
  'lib.single': ['בחירה אחת', 'Choose one'],
  'lib.multiple': ['כמה בחירות', 'Choose several'],
  'lib.required': ['חובה לבחור', 'Required'],
  'lib.options': ['האפשרויות', 'Choices'],
  'lib.optionN': ['אפשרות {n}', 'Choice {n}'],
  'lib.optionPrice': ['תוספת למחיר (₪)', 'Extra price (₪)'],
  'lib.optionPriceHint': ['ריק או 0 כשאין תוספת.', 'Empty or 0 when there is no extra.'],
  'lib.maxQty': ['כמה פעמים לכל היותר', 'Most per dish'],
  'lib.maxQtyOf': ['כמה פעמים לכל היותר: {name}', 'Most per dish: {name}'],
  'lib.default': ['מסומן מראש', 'Pre-selected'],
  'lib.defaultOf': ['{name} מסומן מראש', '{name} pre-selected'],
  'lib.opensField': ['פותחת קבוצה', 'Opens a group'],
  'lib.opensHint': ['כשהאורח בוחר באפשרות הזאת, נפתחת לו עוד בחירה (למשל רוטב לצ׳יפס). רמה אחת בלבד.', 'When the guest picks this choice, another choice opens (a sauce for the fries, say). One level only.'],
  'lib.opensNothing': ['לא פותחת', 'Nothing'],
  'lib.removeOption': ['למחוק את {name}', 'Delete {name}'],
  'lib.addOption': ['אפשרות נוספת', 'Another choice'],
  'lib.used': ['איפה היא מופיעה', 'Where it is used'],
  'lib.delete': ['מחיקת הקבוצה', 'Delete group'],
  'lib.deleteConfirm': ['למחוק את "{name}"? אי אפשר לבטל את זה.', 'Delete "{name}"? This cannot be undone.'],
  'lib.deleteUsed': ['למחוק את "{name}"? היא תוסר מ־{n} מנות. אי אפשר לבטל את זה.', 'Delete "{name}"? It will be removed from {n} dishes. This cannot be undone.'],
  'lib.deleteUsed1': ['למחוק את "{name}"? היא תוסר ממנה אחת. אי אפשר לבטל את זה.', 'Delete "{name}"? It will be removed from 1 dish. This cannot be undone.'],
  'lib.save': ['שמירת הקבוצה', 'Save group'],
  'lib.create': ['יצירת הקבוצה', 'Create group'],
  'lib.saved': ['הקבוצה נשמרה', 'Group saved'],
  'lib.leave.title': ['לצאת בלי לשמור?', 'Leave without saving?'],
  'lib.leave.body': ['השינויים בקבוצה הזאת עוד לא נשמרו, והם יאבדו.', 'The changes to this group are not saved yet and will be lost.'],
  'lib.leave.go': ['לצאת בלי לשמור', 'Leave without saving'],
  'sec.leave.body': ['השינויים בקטגוריה הזאת עוד לא נשמרו, והם יאבדו.', 'The changes to this section are not saved yet and will be lost.'],
  'lib.stale.title': ['הקבוצה נשמרה במקום אחר', 'This group was saved somewhere else'],
  'lib.stale.body': ['היא נשמרה במסך או במכשיר אחר אחרי שפתחתם אותה. כך היא שמורה עכשיו:', 'It was saved on another screen or device after you opened it. This is how it is stored now:'],
  'lib.stale.keep': ['לשמור עליה את השינויים שלי', 'Save my changes over it'],
  'lib.stale.mineOnly': ['רק מה ששיניתם כאן יישמר עליה. כל השאר יישאר כפי שנשמר שם.', 'Only what you changed here will be saved over it. Everything else stays as it was saved there.'],
  'lib.stale.take': ['לקחת את השמורה', 'Take the stored one'],
  'lib.e.dish_limits': ['למנה "{dish}" יש גבולות משלה לקבוצה הזאת, והשינוי הזה שובר אותם. שנו קודם את הגבולות במנה (בלשונית התוספות שלה).', 'The dish "{dish}" has its own limits for this group, and this change breaks them. Change the limits on the dish first (its Add-ons tab).'],
  'lib.rules.title': ['כללי הצעה משתמשים באפשרויות האלה', 'Suggestion rules use these choices'],
  'lib.rules.body': ['{n} כללי הצעה מציעים אפשרויות שמחקתם: {names}. אם תשמרו, הכללים יימחקו יחד איתן.', '{n} suggestion rules suggest choices you deleted: {names}. If you save, the rules are deleted with them.'],
  'lib.rules.body1': ['כלל הצעה אחד מציע אפשרות שמחקתם: {names}. אם תשמרו, הכלל יימחק יחד איתה.', 'One suggestion rule suggests a choice you deleted: {names}. If you save, the rule is deleted with it.'],
  'lib.rules.go': ['למחוק ולשמור', 'Delete and save'],
  'lib.rules.unnamed': ['כלל בלי שם', 'an unnamed rule'],

  // ---- publishing
  'pub2.standing.never': ['עוד לא פורסם', 'Not published yet'],
  'pub2.standing.pending': ['מחכה לאישור של חלום', 'Waiting for Halom\'s approval'],
  'pub2.standing.live': ['באוויר', 'Live'],
  'pub2.standing.offline': ['לא באוויר', 'Offline'],
  'pub2.never.body': ['כל מה שעורכים נשמר כטיוטה. האורחים רואים את התפריט רק אחרי פרסום.', 'Everything you edit is kept as a draft. Guests see the menu only after you publish.'],
  'pub2.pending.body': ['התפריט נשמר. בחלום בודקים כל מקום חדש לפני שהאורחים רואים אותו; עד אז הקישור אומר שהתפריט עוד לא זמין.', 'The menu is saved. Halom checks every new place before guests see it; until then the link says the menu is not available yet.'],
  'pub2.pending.meanwhile': ['אפשר להמשיך לערוך בינתיים ולפרסם שוב.', 'You can keep editing meanwhile and publish again.'],
  'pub2.pending.check': ['לבדוק שוב', 'Check again'],
  'pub2.issues': ['מה מונע פרסום', 'What stops publishing'],
  'pub2.issues.n': ['{n} דברים מונעים פרסום', '{n} things stop the publish'],
  'pub2.issues.n1': ['דבר אחד מונע פרסום', '1 thing stops the publish'],
  'pub2.warnings': ['כדאי לבדוק', 'Worth a look'],
  'pub2.warnings.n': ['{n} דברים כדאי לבדוק', '{n} things worth a look'],
  'pub2.warnings.n1': ['דבר אחד כדאי לבדוק', '1 thing worth a look'],
  'pub2.publishFirst': ['פרסום התפריט', 'Publish the menu'],
  'pub2.publishChanges': ['פרסום השינויים', 'Publish the changes'],
  'pub2.approvalNote': ['בפרסום הראשון חלום מאשרים את התפריט לפני שהאורחים רואים אותו.', 'On the first publish, Halom approves the menu before guests see it.'],
  'pub2.sentForApproval': ['התפריט נשלח לאישור של חלום.', 'The menu was sent for Halom\'s approval.'],
  'pub2.changes.first': ['זה יהיה הפרסום הראשון.', 'This will be the first publish.'],
  'pub2.changes.groups': ['{n} קבוצות תוספות השתנו', '{n} add-on groups changed'],
  'pub2.changes.groups1': ['קבוצת תוספות אחת השתנתה', '1 add-on group changed'],
  'pub2.restoreShort': ['להחזיר', 'Put back'],
  'pub2.revPending': ['מחכה לאישור', 'Waiting for approval'],
  'pub2.blocked.saving': ['השינויים האחרונים עוד נשמרים. אפשר לפרסם ברגע שהם נשמרים.', 'Your latest changes are still saving. You can publish as soon as they are saved.'],
  'pub2.blocked.failed': ['חלק מהשינויים לא נשמרו, ולכן הפרסום מחכה. נסו לשמור שוב (למעלה).', 'Some changes did not save, so publishing waits. Try saving again (at the top).'],
  'pub2.blocked.conflict': ['שינוי אחד מחכה להחלטה שלכם (הוא השתנה גם במקום אחר), ולכן הפרסום מחכה.', 'A change is waiting for your decision (it was changed somewhere else too), so publishing waits.'],
  'issue.rule_left_out.scope_empty': ['כלל ההצעה לא ייכלל: המנות או הקטגוריות שהוא חל עליהן מוסתרות או נמחקו.', 'The suggestion rule is left out: the dishes or sections it applies to are hidden or gone.'],
  'issue.rule_left_out.basket_has_empty': ['כלל ההצעה לא ייכלל: מה שהוא מחכה לו בהזמנה מוסתר או נמחק.', 'The suggestion rule is left out: what it waits for in the basket is hidden or gone.'],
  'issue.rule_left_out.suggestion_hidden': ['כלל ההצעה לא ייכלל: מה שהוא מציע מוסתר או נמחק.', 'The suggestion rule is left out: what it suggests is hidden or gone.'],
  'issue.rule_left_out.other': ['כלל ההצעה לא ייכלל.', 'The suggestion rule is left out.'],
  'issue.rule_suggests_its_trigger': ['הכלל מציע את אותה מנה שהוא חל עליה, ולכן לא יופיע אף פעם.', 'The rule suggests the same dish it applies to, so it will never show.'],
  'issue.rule_option_unreachable': ['הכלל מציע תוספת שאף מנה בתחום שלו לא מציעה.', 'The rule suggests an add-on that no dish in its scope offers.'],

  // ---- errors in plain words (codes from data/errors.ts, the database and both snapshot validators)
  'e.nesting_too_deep': ['רק רמה אחת: קבוצה שנפתחת מתוך בחירה לא יכולה לפתוח קבוצה נוספת. ייתכן שהתוספות שונו ממקום אחר, ולכן הן מוצגות עכשיו כפי שהן שמורות.', 'One level only: a group that opens from a choice cannot open another group. The add-ons may have changed somewhere else, so they are shown again as they are stored now.'],
  'e.opens_self': ['בחירה לא יכולה לפתוח את הקבוצה שהיא עצמה נמצאת בה.', 'A choice cannot open the group it is in.'],
  'e.limits_loosened': ['במנה אפשר רק להדק את הגבולות של הקבוצה, לא להרחיב אותם.', 'A dish can only tighten a group\'s limits, not widen them.'],
  'e.limits_invalid': ['ה"לפחות" לא יכול להיות גדול מה"לכל היותר".', '"At least" cannot be more than "at most".'],
  'e.single_max': ['בקבוצה של בחירה אחת האורח בוחר אחת לכל היותר.', 'In a choose-one group the guest picks one at most.'],
  'e.min_unreachable': ['האפשרויות בקבוצה לא מגיעות למספר הבחירות הנדרש. הוסיפו אפשרות או הקטינו את ה"לפחות".', 'The choices cannot add up to the number required. Add a choice or lower "at least".'],
  'e.defaults_exceed': ['מסומנות מראש יותר אפשרויות ממה שהקבוצה מרשה לבחור.', 'More choices are pre-selected than the group allows.'],
  'e.options_empty': ['בקבוצה צריכה להיות אפשרות אחת לפחות.', 'A group needs at least one choice.'],
  'e.option_qty_invalid': ['הכמות המרבית היא בין 1 ל־10.', 'The most per dish is between 1 and 10.'],
  'e.opener_qty': ['בחירה שפותחת קבוצה נבחרת פעם אחת בלבד.', 'A choice that opens a group can be chosen once only.'],
  'e.name_missing': ['חסר שם בשפה אחת לפחות.', 'A name in at least one language is needed.'],
  'e.too_long': ['הטקסט ארוך מדי.', 'The text is too long.'],
  'e.too_many': ['יש כאן יותר מדי פריטים.', 'There are too many items here.'],
  'e.ref_unknown': ['משהו כאן מפנה לפריט שכבר לא קיים.', 'Something here points to an item that no longer exists.'],
  'e.form_invalid': ['יש שדות לתקן. הם מסומנים למטה.', 'Some fields need fixing. They are marked below.'],
  'e.stale': ['זה השתנה במסך או במכשיר אחר, ולכן מוצג עכשיו כפי שהוא שמור. נסו שוב.', 'This changed on another screen or device, so it is shown as it is stored now. Try again.'],
  'e.invalid_menu': ['יש בתפריט משהו שמונע פרסום. הבעיות מופיעות למעלה.', 'Something in the menu stops the publish. The problems are listed above.'],
  'e.slug_invalid': ['אי אפשר להשתמש בכתובת הזאת. נסו כתובת אחרת.', 'This address cannot be used. Try another one.'],
  'e.limit_sections': ['הגעתם ל־{n} קטגוריות, וזה המקסימום.', 'You have {n} sections, the maximum.'],
  'e.limit_dishes': ['הגעתם ל־{n} מנות, וזה המקסימום בתפריט אחד. צריכים יותר? כתבו לנו.', 'You have {n} dishes, the maximum for one menu. Need more? Message us.'],
  'e.limit_addon_groups': ['הגעתם ל־{n} קבוצות תוספות, וזה המקסימום.', 'You have {n} add-on groups, the maximum.'],
  'e.limit_options_per_group': ['בקבוצה אחת יכולות להיות עד {n} אפשרויות.', 'One group can hold up to {n} choices.'],
  'e.limit_groups_per_dish': ['למנה אחת אפשר לחבר עד {n} קבוצות תוספות.', 'One dish can have up to {n} add-on groups.'],
  'e.limit_related': ['אפשר להציע עד {n} מנות שהולכות טוב עם מנה אחת.', 'One dish can suggest up to {n} dishes that go well with it.'],
};

/** Codes whose words the v1 dictionary already has. */
const ALIAS: Record<string, string> = {
  price_invalid: 'menu.item.badPrice', not_allowed: 'err.forbidden', venue_unknown: 'err.not_found', exists: 'auth.e.wrong_password',
  limit_venues: 'setup.e.limit_businesses', text_too_long: 'e.too_long', bad_login: 'auth.e.short',
  // save_addon_group's input codes (the SQL twin of the contracts' validateAddonGroupInput)
  units_invalid: 'e.limits_invalid', qty_invalid: 'e.option_qty_invalid', defaults_invalid: 'e.defaults_exceed', nesting_invalid: 'e.opens_self',
  group_unknown: 'e.ref_unknown',
};
/** The numbers the limit messages name (the schema's own, as in @mana/contracts). */
const LIMIT_N: Record<string, number> = {
  limit_sections: LIMITS.sections, limit_dishes: LIMITS.dishes, limit_addon_groups: LIMITS.addonGroups, limit_options_per_group: LIMITS.optionsPerGroup,
  limit_groups_per_dish: LIMITS.groupsPerDish, limit_related: LIMITS.related,
};

export function t(key: string, vars?: Record<string, string | number>): string {
  const pair = S[key];
  if (!pair) return tV1(key, vars);
  let s = pair[lang.value === 'he' ? 0 : 1];
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}
export const has = (key: string) => key in S || hasV1(key);
/** Counted sentences: the '<key>1' wording when n is exactly one. */
export const tn = (key: string, n: number, vars: Record<string, string | number> = {}) => t(n === 1 && has(key + '1') ? key + '1' : key, { n, ...vars });

/** An error code in plain words: the screen's own wording first (scope), then v2's, then v1's, then "something went wrong". */
export function errText(code: string, scope?: string): string {
  if (scope && has(scope + '.' + code)) return t(scope + '.' + code);
  if (code in ALIAS) return t(ALIAS[code]!, LIMIT_N[code] !== undefined ? { n: LIMIT_N[code]! } : undefined);
  if (has('e.' + code)) return t('e.' + code, { n: LIMIT_N[code] ?? '' });
  if (hasV1('err.' + code)) return tV1('err.' + code);
  return tV1('err.unknown');
}
