// Fixtures shaped like the rows behind ops_overview() in db/0001_core.sql. The stub (stub.mjs) computes the
// derived fields (plan_state, views_7d, viewsByDay, signupsByDay) the same way the SQL does.
const DAY = 86400000, H = 3600000;
let seq = 0;
const uuid = () => { seq++; const h = seq.toString(16).padStart(12, '0'); return `00000000-0000-4000-8000-${h}`; };
const ilDay = (ms) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

export const USERS = () => ({
  'staff@halom.test': { id: 'aaaaaaaa-0000-4000-8000-000000000001', password: 'correct-horse', staff: true },
  'owner@cafe.test': { id: 'aaaaaaaa-0000-4000-8000-000000000002', password: 'owner-pass-1', staff: false },
});
export const INVITES = () => ['HALOM-STAFF-1'];

function biz(now, o) {
  const iso = (d) => (d == null ? null : new Date(now - d * DAY).toISOString());
  const b = {
    id: uuid(), slug: o.slug, name_he: o.he ?? '', name_en: o.en ?? '', kind: o.kind ?? 'restaurant', area_he: o.areaHe ?? '', area_en: o.areaEn ?? '',
    created_at: iso(o.created), contact_name: o.contact ?? null, contact_phone: o.phone ?? null, phone: null,
    owner_email: o.email ?? `${o.slug}@owners.test`, last_sign_in_at: iso(o.signin ?? o.active ?? o.created),
    categories: o.cats ?? 0, items: o.items ?? 0, items_with_picture: o.withPic ?? 0,
    assets: o.assets ?? {}, last_asset_at: o.assetAt == null ? null : iso(o.assetAt),
    first_published_at: o.firstPub == null ? null : iso(o.firstPub), last_published_at: o.firstPub == null ? null : iso(o.lastPub ?? o.firstPub),
    live: o.live ?? false, revisions: o.revs ?? null,
    plan: o.plan ?? 'trial', plan_status: o.status ?? 'pending',
    trial_started_at: o.trialStart == null ? null : iso(o.trialStart), trial_ends_at: o.trialEnd == null ? null : iso(-o.trialEnd),
    current_period_end: o.periodEnd == null ? null : iso(-o.periodEnd), plan_note: o.note ?? null,
    last_activity_at: iso(o.active ?? o.created),
    _views: {},
  };
  // views: [perDayRecent, daysBack] → a plausible daily series ending today
  if (o.views) {
    const [per, back] = o.views;
    for (let i = 0; i < back; i++) { const n = Math.max(0, Math.round(per * (0.6 + ((i * 7 + o.slug.length) % 9) / 10))); if (n) b._views[ilDay(now - i * DAY)] = n; }
  }
  if (o.oldViews) b._views[ilDay(now - 20 * DAY)] = o.oldViews;
  return b;
}

function lead(now, n, o) {
  return {
    id: uuid(), ref: `HL-2026-${String(n).padStart(4, '0')}`, created_at: new Date(now - o.ago * H).toISOString(),
    source: o.source ?? 'dream-portal', package: o.pkg ?? null, dream: o.dream, contact: o.contact, name: o.name ?? null,
    locale: o.locale ?? null, page: o.page ?? null, status: o.status ?? 'new', owner: o.owner ?? null,
    next_action: o.next ?? null, next_action_on: o.on ?? null, notes: o.notes ?? null,
  };
}

const LONG_HE = 'אנחנו מסעדה משפחתית ביפו, שלושה דורות באותו מטבח. רוצים שהאורחים יראו את המנות לפני שהן מגיעות לשולחן, בלי אפליקציה ובלי להסביר. '
  + 'יש לנו בערך ארבעים מנות, חצי מהן משתנות לפי העונה. ';
const LONG_EN = 'We run a small natural-wine bar and want guests to browse the bottles on the table like objects, not as a PDF. ';

export const HOSTILE = {
  img: '<img src=x onerror="window.__xss=(window.__xss||0)+1">',
  script: '<script>window.__xss=(window.__xss||0)+1</script>',
  svgMail: '"><svg/onload=window.__xss=1>@evil.example',
  formula: '=HYPERLINK("http://evil.example/steal","Click for the brief")',
  plus: '+SUM(1+1)*cmd|\' /C calc\'!A0',
  at: '@SUM(A1:A9)',
  minus: '-2+3+cmd|\' /C calc\'!A0',
  rlo: '‮gpj.exe‬',
  jsUrl: 'javascript:window.__xss=1',
};

export function scenario(name, now = Date.now()) {
  seq = name === 'many' ? 1000 : name === 'one' ? 500 : 0;
  if (name === 'empty') return { businesses: [], leads: [], accountsWithoutBusiness: 0 };
  if (name === 'one') {
    return {
      accountsWithoutBusiness: 2,
      businesses: [biz(now, { slug: 'hakosem', he: 'הקוסם', en: 'HaKosem', kind: 'restaurant', created: 0.2, cats: 3, items: 7, active: 0.05, contact: 'אריאל רוזנטל', phone: '054-555-0142' })],
      leads: [lead(now, 1, { ago: 3, dream: 'מסעדה בתל אביב, רוצים תפריט תלת־ממדי לפני החגים.', contact: 'ariel@hakosem.test', name: 'אריאל', pkg: 'menus', source: 'menus-landing', locale: 'he' })],
    };
  }
  const ok = (n) => ({ approved: n });
  const B = [
    // live
    { slug: 'juno', he: "ג'ונו", en: 'Juno', kind: 'restaurant', areaHe: 'תל אביב', created: 24, active: 0.1, cats: 6, items: 38, withPic: 31, assets: { approved: 31, rejected: 2 }, assetAt: 1,
      firstPub: 20, lastPub: 0.4, live: true, revs: 7, status: 'trialing', trialStart: 20, trialEnd: 10, views: [46, 20], contact: 'נועה לוי', phone: '054-202-2269', email: 'noa@juno.test' },
    { slug: 'abu-hassan', he: 'אבו חסן', kind: 'restaurant', areaHe: 'יפו', created: 28, active: 2, cats: 2, items: 9, withPic: 9, assets: ok(9), assetAt: 19,
      firstPub: 19, lastPub: 2, live: true, revs: 3, plan: 'pilot', status: 'active', trialStart: 19, trialEnd: 11, periodEnd: 60, note: 'Pilot agreed by phone, invoice from January', views: [120, 19], contact: 'מוחמד', phone: '03-682-0387' },
    { slug: 'olea', he: 'אוליאה', en: 'Olea', kind: 'restaurant', created: 29, active: 0.5, cats: 7, items: 43, withPic: 41, assets: ok(41), assetAt: 3,
      firstPub: 26, lastPub: 0.5, live: true, revs: 12, plan: 'paid', status: 'active', trialStart: 26, trialEnd: 4, periodEnd: null, views: [80, 26], contact: 'Dana Katz', phone: '+972 52-555-0199' },
    { slug: 'cafe-levinsky', he: 'קפה לוינסקי', en: 'Cafe Levinsky', kind: 'cafe', created: 30, active: 1, cats: 4, items: 22, withPic: 12, assets: { approved: 12, failed: 1 }, assetAt: 5,
      firstPub: 27, lastPub: 1, live: true, revs: 4, status: 'trialing', trialStart: 27, trialEnd: 3, views: [18, 27], contact: 'יעל', phone: '0525550111' },
    { slug: 'port-said', en: 'Port Said', kind: 'bar', created: 40, active: 6, cats: 3, items: 18, withPic: 10, assets: ok(10), assetAt: 30,
      firstPub: 32, lastPub: 6, live: true, revs: 2, status: 'trialing', trialStart: 32, trialEnd: -2, oldViews: 31, contact: 'Eyal', phone: '050-555-0133' },                       // trial ran out 2 days ago
    { slug: 'shuk-bites', he: 'שוק בייטס', en: 'Shuk Bites', kind: 'food_truck', created: 21, active: 8, cats: 2, items: 11, withPic: 6, assets: ok(6), assetAt: 15,
      firstPub: 14, lastPub: 8, live: true, revs: 2, status: 'suspended', trialStart: 14, trialEnd: 16, note: 'Suspended at the owner\'s request while they renovate', oldViews: 12 },
    { slug: 'gelateria-mia', he: 'ג׳לטריה מיה', en: 'Gelateria Mia', kind: 'cafe', created: 16, active: 4, cats: 2, items: 14, withPic: 14, assets: ok(14), assetAt: 12,
      firstPub: 11, lastPub: 9, live: false, revs: 3, status: 'trialing', trialStart: 11, trialEnd: 19, oldViews: 4 },                                                          // unpublished by the owner
    { slug: 'hummus-eliyahu', he: 'חומוס אליהו', kind: 'restaurant', created: 9, active: 1, cats: 1, items: 6, withPic: 0, firstPub: 6, lastPub: 1, live: true, revs: 2,
      status: 'trialing', trialStart: 6, trialEnd: 24, views: [9, 6], contact: 'אליהו', phone: '04-555-0177' },                                                                 // published without pictures
    { slug: 'the-norman', en: 'The Norman Rooftop', kind: 'hotel', areaEn: 'Tel Aviv', created: 18, active: 9, cats: 5, items: 27, withPic: 20, assets: ok(20), assetAt: 12,
      firstPub: 10, lastPub: 10, live: true, revs: 1, plan: 'pilot', status: 'active', trialStart: 10, trialEnd: 20, periodEnd: 5, oldViews: 0, contact: 'Front desk', phone: '+972-3-555-0100' }, // live, nobody opened it
    { slug: 'bakery-lehamim', he: 'לחמים', en: 'Lehamim Bakery', kind: 'bakery', created: 45, active: 20, cats: 3, items: 20, withPic: 15, assets: ok(15), assetAt: 40,
      firstPub: 38, lastPub: 20, live: true, revs: 5, plan: 'paid', status: 'active', trialStart: 38, trialEnd: -8, periodEnd: -1, oldViews: 55 },                              // paid period ended yesterday
    { slug: 'last-day', he: 'היום האחרון', en: 'Last Day Diner', kind: 'other', created: 33, active: 0.3, cats: 2, items: 8, withPic: 5, assets: ok(5), assetAt: 30,
      firstPub: 29.9, lastPub: 3, live: true, revs: 2, status: 'trialing', trialStart: 29.9, trialEnd: 0.1, views: [5, 14] },                                                   // trial ends today
    // not published yet
    { slug: 'ouzeria', he: 'אוזריה', en: 'Ouzeria', kind: 'restaurant', created: 5, active: 0.3, cats: 4, items: 19, withPic: 16, assets: ok(16), assetAt: 0.3 },                // pictures approved
    { slug: 'miznon', he: 'מזנון', en: 'Miznon', kind: 'restaurant', created: 4, active: 0.2, cats: 3, items: 15, withPic: 5, assets: { approved: 5, ready_for_review: 4, failed: 1 }, assetAt: 0.2,
      contact: 'אייל שני', phone: '054 555 0188' },                                                                                                                              // in review
    { slug: 'beer-bazaar', en: 'Beer Bazaar', kind: 'bar', created: 2, active: 0.01, cats: 2, items: 30, withPic: 0, assets: { uploaded: 3, processing: 1 }, assetAt: 0.01 },   // generating right now
    { slug: 'saluf', he: 'סאלוף ובניו', en: 'Saluf & Sons', kind: 'restaurant', created: 3, active: 1, cats: 2, items: 12, withPic: 0, assets: { failed: 3 }, assetAt: 1 },       // only failures
    { slug: 'dalida', he: 'דלידה', en: 'Dalida', kind: 'restaurant', created: 1, active: 0.4, cats: 5, items: 12 },                                                              // menu started
    { slug: 'cafe-xoho', en: 'Cafe Xoho', kind: 'cafe', created: 6, active: 5.5, cats: 2, items: 0 },                                                                            // stalled, categories only
    { slug: 'new-today', he: 'חדש היום', kind: 'restaurant', created: 0.1 },                                                                                                      // created an hour ago
    { slug: 'ghost-kitchen', en: 'Ghost Kitchen TLV', kind: 'other', created: 12, signin: 12 },                                                                                   // stalled at created
    { slug: 'taizu', he: 'טאיזו', en: 'Taizu', kind: 'restaurant', created: 8, active: 4.2, cats: 4, items: 21, withPic: 2, assets: { approved: 2, ready_for_review: 6 }, assetAt: 4.2 }, // stalled in review
    { slug: 'santa-katarina', he: 'סנטה קתרינה', en: 'Santa Katarina', kind: 'restaurant', created: 14, active: 9, cats: 3, items: 16, withPic: 16, assets: ok(16), assetAt: 9 },     // stalled with approved pictures
    // awkward data
    { slug: 'the-longest-restaurant-name-in-tel-av', he: 'המסעדה עם השם הכי ארוך בתל אביב־יפו והסביבה כולל רמת גן גבעתיים וחולון בע״מ', en: 'The Restaurant With The Longest Possible Name In Greater Tel Aviv Jaffa Area Ltd',
      kind: 'restaurant', created: 7, active: 2, cats: 1, items: 3, contact: 'Maximilian Alexander von Hohenzollern-Sigmaringen the Third, Operations', phone: 'call the office after 10' },
    { slug: 'xss-bistro', he: 'ביסטרו <b>מודגש</b>', en: '<img src=x onerror=window.__xss=1>', kind: 'bakery', created: 2.5, active: 2.4, cats: 1, items: 2,
      contact: '=HYPERLINK("http://evil.example","owner")', phone: '+972-54-000-0000', email: 'weird"quote@owners.test' },
    { slug: 'juno-beach', he: "ג'ונו חוף", en: 'Juno Beach', kind: 'bar', created: 2, active: 1.5, cats: 1, items: 4, email: 'noa@juno.test', contact: 'נועה לוי', phone: '054-202-2269' }, // second business, same owner
    { slug: 'truck-21', en: 'Truck 21', kind: 'food_truck', created: 26, active: 15, cats: 1, items: 5, withPic: 1, assets: ok(1), assetAt: 20, firstPub: 20, lastPub: 15, live: true, revs: 1,
      status: 'trialing', trialStart: 20, trialEnd: 6, oldViews: 3, phone: '+1 (415) 555-0100' },
  ];
  const L = [
    { ago: 0.4, dream: 'יש לנו בר יין קטן בפלורנטין. רוצים שהתפריט ייראה כמו השולחן שלנו: עץ כהה, כוסות, בקבוקים. כמה זה עולה ומתי אפשר להתחיל?', contact: 'michal@barflorentin.test', name: 'מיכל אברהם', pkg: 'menus', source: 'menus-landing', locale: 'he', page: 'https://halom.io/mana/' },
    { ago: 2, dream: 'We are opening a second branch in March and want the same 3D menu in both. Do you do multi-location?', contact: '054-202-2269', name: 'Tom Sela', pkg: 'menus', source: 'menus-landing', locale: 'en' },
    { ago: 5, dream: HOSTILE.img + ' ' + HOSTILE.script + ' Looking for a menu', contact: HOSTILE.svgMail, name: '<b onmouseover=window.__xss=1>Bob</b>', pkg: 'dream', page: HOSTILE.jsUrl },
    { ago: 7, dream: HOSTILE.formula, contact: '-1234567@evil.example', name: HOSTILE.plus, source: HOSTILE.at, notes: null },
    { ago: 9, dream: 'Normal start ‮then everything after this is reversed‬ and ⁦isolated⁩ text. קובץ: ' + HOSTILE.rlo, contact: 'user‮@moc.elpmaxe.test', name: HOSTILE.rlo, pkg: 'spark', locale: 'en' },
    { ago: 26, dream: (LONG_HE.repeat(14)).slice(0, 3800), contact: 'yossi@yaffo-kitchen.test', name: 'יוסי בן דוד', pkg: 'menus', source: 'menus-landing', locale: 'he',
      status: 'qualified', owner: 'Daniel', next: 'Call to see the menu and count the dishes', on: '2026-10-08', notes: 'Spoke on WhatsApp. They have ~40 dishes, half seasonal.\nWants it live before the holidays.' },
    { ago: 50, dream: LONG_EN.repeat(5), contact: '+1 (415) 555-0100', name: 'Avery Stone', pkg: 'lucid', status: 'scoped', owner: 'Daniel', next: 'Send scope + price', on: '2026-10-07' },
    { ago: 75, dream: 'מלון בוטיק בנווה צדק, 3 מסעדות. רוצים הצעה לכולן.', contact: 'gm@neve-hotel.test', name: 'רונית', pkg: 'showroom', status: 'agreed', owner: 'Daniel', notes: 'Deposit received.' },
    { ago: 120, dream: 'Brand film for a ceramics studio.', contact: 'hello@clay.test', name: 'Ines', pkg: 'dream', status: 'production', owner: 'Maya' },
    { ago: 170, dream: 'Landing page + menu for a food truck.', contact: '0525550111', pkg: 'founders', status: 'review', owner: 'Maya', next: 'Client review call', on: '2026-10-06' },
    { ago: 300, dream: 'Site for an architecture office.', contact: 'office@fh.test', name: 'Fleisher', pkg: 'lucid', status: 'deployed', owner: 'Daniel' },
    { ago: 400, dream: 'Monthly updates to our menu.', contact: 'owner@olea.test', name: 'Dana', pkg: 'menus', status: 'support', owner: 'Daniel' },
    { ago: 500, dream: 'Need a logo by tomorrow for 50 shekels.', contact: 'cheap@nowhere.test', status: 'lost', notes: 'Not a fit.' },
    { ago: 520, dream: 'BUY FOLLOWERS CHEAP visit example dot com', contact: '1234567', status: 'spam' },
    { ago: 1, dream: 'בלי שם ובלי חבילה, רק רעיון: תפריט לדוכן בשוק.', contact: '03-555-0123' },
  ];
  return {
    accountsWithoutBusiness: 9,
    businesses: B.map((o) => biz(now, o)),
    leads: L.map((o, i) => lead(now, L.length - i, o)),
  };
}
