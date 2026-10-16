// The owner app v2's dashboard lane, through its public functions: the dashboard's bars, axis and labels from
// my_dashboard's reply (no number invented: a minute the reply does not name is zero), where each nudge leads, the CSV
// export (Hebrew and English side by side, commas, quotes and line breaks, agorot as shekels, formulas kept as text),
// the activity log in plain words (you, a teammate, Halom with its reason, the system; every action the log may hold
// has words in both languages), and the live timer (polling only while visible, pollDelay's backoff, a burst of
// Realtime messages as one fetch, a channel that subscribes stopping the polling). Invented data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_ACTIONS, LIVE_REFRESH, NUDGE_CODES, zonedTime } from '@mana/contracts';
import { lang } from '../../src/lib/i18n.ts';
import { activityWords, dayTitle, whoOf } from '../../src/v2/data/activity.ts';
import { axisTop, dayBars, hasVisits, labelledBars, minuteBars, nudgeHref, share } from '../../src/v2/data/dashboard.ts';
import { csvCell, exportFileName, menuCsv, menuJson, shekelCell } from '../../src/v2/data/export.ts';
import { refresher } from '../../src/v2/data/refresher.ts';
import { ruleLine } from '../../src/v2/format.ts';

const TZ = 'Asia/Jerusalem';
const inLang = (l, fn) => { const before = lang.value; lang.value = l; try { return fn(); } finally { lang.value = before; } };
/** The words without the invisible marks that keep amounts and ranges left to right. */
const plain = (s) => s.replace(/[\u2060\u2066-\u2069]/g, '');
let n = 0;
const uid = () => '00000000-0000-4000-8000-2' + String(++n).padStart(11, '0');
const ZERO = { menuOpens: 0, dishViews: 0, addonsChosen: 0, basketAdds: 0, suggestionsShown: 0, suggestionsAccepted: 0, suggestionsDismissed: 0 };

// ---------------------------------------------------------------- the dashboard's numbers on the phone
test('nothing counted is "no visits yet"; one count of anything is a visit', () => {
  assert.equal(hasVisits(ZERO), false);
  for (const k of Object.keys(ZERO)) assert.equal(hasVisits({ ...ZERO, [k]: 1 }), true, k);
});

test('the day bars are the reply\'s days, zeros and capped days included, oldest first', () => {
  const days = [
    { day: '2026-10-14', opens: 0, views: 0, adds: 0, capped: false },
    { day: '2026-10-15', opens: 12, views: 30, adds: 4, capped: true },
    { day: '2026-10-16', opens: 5, views: 9, adds: 1, capped: false },
  ];
  assert.deepEqual(dayBars({ days }), [
    { at: '2026-10-14', value: 0, capped: false }, { at: '2026-10-15', value: 12, capped: true }, { at: '2026-10-16', value: 5, capped: false },
  ]);
});

test('the last hour is sixty minutes ending at the reply\'s minute; a minute the reply does not name is zero', () => {
  const d = {
    generatedAt: '2026-10-16T09:30:20.123Z',
    lastHour: [
      { minute: '2026-10-16T09:30:00Z', opens: 3, views: 5, adds: 1 },
      { minute: '2026-10-16T08:45:00Z', opens: 1, views: 0, adds: 0 },
      { minute: '2026-10-16T08:31:00Z', opens: 2, views: 2, adds: 0 },
      { minute: '2026-10-16T08:30:00Z', opens: 7, views: 0, adds: 0 },           // 61 minutes before: outside the hour
    ],
  };
  const bars = minuteBars(d);
  assert.equal(bars.length, 60);
  assert.equal(bars[0].at, '2026-10-16T08:31:00.000Z');
  assert.equal(bars[59].at, '2026-10-16T09:30:00.000Z');
  assert.deepEqual(bars.filter((b) => b.value > 0).map((b) => [b.at.slice(11, 16), b.value]), [['08:31', 2], ['08:45', 1], ['09:30', 3]]);
  assert.equal(bars.reduce((s, b) => s + b.value, 0), 6);
});

test('the axis top is a clean number at or above the highest value; only the highest and the latest bar carry a number', () => {
  assert.deepEqual([0, 1, 2, 3, 7, 10, 12, 50, 51, 120, 999].map(axisTop), [1, 1, 2, 5, 10, 10, 20, 50, 100, 200, 1000]);
  const bars = (vs) => vs.map((value, i) => ({ at: String(i), value, capped: false }));
  assert.deepEqual([...labelledBars(bars([1, 9, 3, 2]))].sort(), [1, 3], 'the peak and the latest');
  assert.deepEqual([...labelledBars(bars([4, 9, 9, 0]))], [2], 'the latest of equal peaks; a zero carries no number');
  assert.deepEqual([...labelledBars(bars([0, 0, 0]))], [], 'nothing to say');
  assert.deepEqual([share(1, 4), share(2, 3), share(0, 5), share(0, 0)], [25, 67, 0, null], 'never a percent of nothing');
});

// ---------------------------------------------------------------- where a nudge leads
test('each nudge opens the screen that fixes it, at its first target; the onboarding screens win once they exist', () => {
  const none = () => false, onboarding = (p) => p === 'onboarding';
  const nd = (code, targets, count = targets.length || 1) => ({ code, count, targets });
  const dish = uid(), group = uid();
  assert.equal(nudgeHref(nd('approval_pending', [{ kind: 'venue', id: uid() }]), none), 'publish');
  assert.equal(nudgeHref(nd('dish_no_price', [{ kind: 'dish', id: dish }, { kind: 'dish', id: uid() }]), none), 'menu/d/' + dish);
  assert.equal(nudgeHref(nd('dish_no_photo', [{ kind: 'dish', id: dish }]), none), 'menu/d/' + dish);
  assert.equal(nudgeHref(nd('group_without_limits', [{ kind: 'group', id: group }]), none), 'addons/' + group);
  assert.equal(nudgeHref(nd('case_waiting_owner', [{ kind: 'case', id: uid() }]), none), 'help');
  const step = (s, has) => nudgeHref(nd('onboarding_step', [{ kind: 'step', id: s }], 3), has);
  assert.deepEqual(['menu', 'addons', 'hours', 'publish', 'photos', 'review', 'style', 'test'].map((s) => step(s, none)),
    ['menu', 'addons', 'hours', 'publish', null, null, null, null], 'until the onboarding lane: the screens that exist, nothing for the rest');
  assert.equal(step('photos', onboarding), 'onboarding/photos');
  assert.equal(nudgeHref(nd('import_waiting', [{ kind: 'import', id: uid() }]), none), null, 'no import review screen yet');
  assert.equal(nudgeHref(nd('import_waiting', [{ kind: 'import', id: uid() }]), onboarding), 'onboarding/review');
  for (const code of NUDGE_CODES) assert.notEqual(nudgeHref(nd(code, []), none), undefined, code);
});

// ---------------------------------------------------------------- the CSV export
const V = uid();
function exported() {
  const t0 = '2026-10-16T08:00:00Z';
  const sec = (o) => ({ id: uid(), venue_id: V, position: 0, name_he: '', name_en: '', kind: 'food', scene: 'auto', room: null, schedule_id: null, hidden: false, created_at: t0, updated_at: t0, ...o });
  const dish = (s, o) => ({ id: uid(), venue_id: V, section_id: s.id, position: 0, name_he: '', name_en: '', desc_he: '', desc_en: '', price: null, price_note_he: '', price_note_en: '', tags: [],
    allergens_he: '', allergens_en: '', details: {}, asset_id: null, stock_id: null, schedule_id: null, hidden: false, created_at: t0, updated_at: t0, ...o });
  const group = (o) => ({ id: uid(), venue_id: V, label: '', name_he: '', name_en: '', selection: 'single', min_units: 0, max_units: 1, limits_confirmed: true, created_at: t0, updated_at: t0, ...o });
  const option = (g, o) => ({ id: uid(), venue_id: V, group_id: g.id, position: 0, name_he: '', name_en: '', price: 0, max_qty: 1, is_default: false, opens_group_id: null, created_at: t0, updated_at: t0, ...o });
  const mains = sec({ name_he: 'עיקריות', name_en: 'Mains' });
  const secret = sec({ position: 1, name_he: 'מוסתרת', name_en: 'Off menu, "staff"', hidden: true });
  const side = group({ name_he: 'תוספת לבחירה', name_en: 'Side of choice', min_units: 1, max_units: 1 });
  const sauce = group({ name_he: 'רוטב', name_en: 'Sauce', min_units: 1, max_units: 1 });
  const fries = option(side, { name_he: 'צ׳יפס', name_en: 'Fries', opens_group_id: sauce.id });
  const sweet = option(side, { position: 1, name_he: 'בטטה', name_en: 'Sweet potato', price: 800, opens_group_id: sauce.id });
  const aioli = option(sauce, { name_he: 'איולי', name_en: 'Aioli' });
  const ketchup = option(sauce, { position: 1, name_he: 'קטשופ', name_en: 'Ketchup', price: 150 });
  const schnitzel = dish(mains, { name_he: 'שניצל', name_en: 'Schnitzel', price: 6800 });
  const fish = dish(mains, { position: 1, name_he: 'דג, צ׳יפס ו"מלח"', name_en: 'Fish, chips & "salt"', price: 6250 });
  const formula = dish(mains, { position: 2, name_he: '=1+1', name_en: '-50% on Mondays\nonly', price: null });
  const cake = dish(secret, { name_he: 'עוגה', name_en: 'Cake', price: 2400 });
  const link = { id: uid(), venue_id: V, dish_id: schnitzel.id, group_id: side.id, position: 0, min_units: null, max_units: null, created_at: t0 };
  return {
    v: 1, kind: 'mana.menu_export', exportedAt: '2026-10-16T09:12:00.000Z',
    venue: { id: V, slug: 'bistro-sim', name: { he: 'ביסטרו סים', en: 'Bistro Sim' }, kind: 'restaurant', mode: 'view_only', timeZone: TZ, defaultLang: 'he', langs: ['he', 'en'], soldOutDisplay: 'bottom' },
    publishedRevision: 1, assetBase: null,
    tables: { schedules: [], sections: [mains, secret], dishes: [schnitzel, fish, formula, cake], addon_groups: [side, sauce], addon_options: [fries, sweet, aioli, ketchup],
      dish_addon_groups: [link], dish_relations: [], upsell_rules: [], venue_hours: [], venue_closures: [], assets: [] },
  };
}

/** RFC 4180, as a spreadsheet reads it. */
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else cell += c;
  }
  return rows;
}

test('a CSV cell: quoted for commas, quotes and line breaks; a formula stays text; agorot as shekels', () => {
  assert.equal(csvCell('Fries'), 'Fries');
  assert.equal(csvCell('Fish, chips'), '"Fish, chips"');
  assert.equal(csvCell('the "best"'), '"the ""best"""');
  assert.equal(csvCell('two\nlines'), '"two\nlines"');
  assert.equal(csvCell('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvCell('+972'), "'+972");
  assert.equal(csvCell('@here'), "'@here");
  assert.equal(csvCell('-5'), "'-5");
  assert.equal(csvCell('-5', { text: false }), '-5', 'a number this app wrote is not touched');
  assert.deepEqual([shekelCell(6250), shekelCell(6800), shekelCell(0), shekelCell(150), shekelCell(null)], ['62.50', '68.00', '0.00', '1.50', '']);
});

test('the menu as CSV: one row a dish, its add-on choices under it (the nested sauce under its opener), both languages, in menu order', () => {
  const x = exported();
  for (const L of ['he', 'en']) inLang(L, () => {
    const text = menuCsv(x);
    assert.ok(text.startsWith('\uFEFF'), 'the byte order mark, for Excel');
    const outsideQuotes = text.split('"').filter((_, i) => i % 2 === 0).join('');
    assert.ok(text.endsWith('\r\n') && !/[^\r]\n/.test(outsideQuotes), 'every line ends with CRLF (a line break inside a quoted cell is the cell\'s)');
    const rows = parseCsv(text.slice(1));
    const head = rows[0];
    assert.equal(head.length, 12);
    if (L === 'he') {
      assert.deepEqual(head.slice(0, 5), ['קטגוריה (עברית)', 'קטגוריה (אנגלית)', 'מנה (עברית)', 'מנה (אנגלית)', 'מחיר (₪)']);
    } else {
      assert.deepEqual(head, ['Section (Hebrew)', 'Section (English)', 'Dish (Hebrew)', 'Dish (English)', 'Price (₪)', 'Add-on group (Hebrew)', 'Add-on group (English)',
        'How many', 'Choice (Hebrew)', 'Choice (English)', 'Choice price (₪)', 'Hidden']);
    }
    const body = rows.slice(1);
    const rule = ruleLine(1, 1);
    const yes = L === 'he' ? 'כן' : 'yes';
    assert.deepEqual(body.map((r) => [r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11]]), [
      ['שניצל', 'Schnitzel', '68.00', '', '', '', '', '', '', ''],
      ['שניצל', 'Schnitzel', '', 'תוספת לבחירה', 'Side of choice', rule, 'צ׳יפס', 'Fries', '0.00', ''],
      ['שניצל', 'Schnitzel', '', 'צ׳יפס › רוטב', 'Fries › Sauce', rule, 'איולי', 'Aioli', '0.00', ''],
      ['שניצל', 'Schnitzel', '', 'צ׳יפס › רוטב', 'Fries › Sauce', rule, 'קטשופ', 'Ketchup', '1.50', ''],
      ['שניצל', 'Schnitzel', '', 'תוספת לבחירה', 'Side of choice', rule, 'בטטה', 'Sweet potato', '8.00', ''],
      ['שניצל', 'Schnitzel', '', 'בטטה › רוטב', 'Sweet potato › Sauce', rule, 'איולי', 'Aioli', '0.00', ''],
      ['שניצל', 'Schnitzel', '', 'בטטה › רוטב', 'Sweet potato › Sauce', rule, 'קטשופ', 'Ketchup', '1.50', ''],
      ['דג, צ׳יפס ו"מלח"', 'Fish, chips & "salt"', '62.50', '', '', '', '', '', '', ''],
      ["'=1+1", "'-50% on Mondays\nonly", '', '', '', '', '', '', '', ''],
      ['עוגה', 'Cake', '24.00', '', '', '', '', '', '', yes],
    ]);
    assert.deepEqual(body.map((r) => r[1]), [...Array(9).fill('Mains'), 'Off menu, "staff"'], 'the section on every row, so a spreadsheet can filter');
  });
});

test('the JSON file is the reply itself; the files are named by the place and the day of the export', () => {
  const x = exported();
  assert.deepEqual(JSON.parse(menuJson(x)), x);
  assert.equal(exportFileName(x, 'json'), 'bistro-sim-menu-2026-10-16.json');
  assert.equal(exportFileName(x, 'csv'), 'bistro-sim-menu-2026-10-16.csv');
});

// ---------------------------------------------------------------- the activity log in words
const entry = (o) => ({ id: ++n, at: '2026-10-16T09:12:00.000Z', actorKind: 'owner', you: true, via: 'direct', action: 'dishes.update', targetTable: 'dishes', targetIds: [uid()], n: 1,
  targetName: null, reason: null, detail: {}, ...o });
const words = (e, L) => inLang(L, () => { const w = activityWords(e, TZ); return { ...w, what: plain(w.what), details: plain(w.details) }; });

test('who: you, someone on your team, Halom (never a staff member\'s name), or the system', () => {
  assert.equal(whoOf({ actorKind: 'owner', you: true }), 'you');
  assert.equal(whoOf({ actorKind: 'owner', you: false }), 'team');
  assert.equal(whoOf({ actorKind: 'manager', you: false }), 'team');
  assert.equal(whoOf({ actorKind: 'counter', you: false }), 'team');
  assert.equal(whoOf({ actorKind: 'staff', you: false }), 'halom');
  assert.equal(whoOf({ actorKind: 'staff', you: true }), 'halom', 'staff is Halom whoever reads it');
  assert.equal(whoOf({ actorKind: 'system', you: false }), 'system');
  assert.deepEqual(['you', 'team', 'halom', 'system'].map((w) => words(entry({ actorKind: { you: 'owner', team: 'manager', halom: 'staff', system: 'system' }[w], you: w === 'you' }), 'en').whoText),
    ['You', 'Someone on your team', 'Halom', 'Automatically']);
  assert.deepEqual(['you', 'team', 'halom', 'system'].map((w) => words(entry({ actorKind: { you: 'owner', team: 'manager', halom: 'staff', system: 'system' }[w], you: w === 'you' }), 'he').whoText),
    ['אתם', 'מישהו מהצוות', 'חלום', 'אוטומטית']);
});

test('what: a price change from its numbers, the name the RPC sent, bulk writes counted, the venue\'s clock', () => {
  const price = entry({ targetName: { he: 'קפה', en: 'Coffee' }, detail: { columns: ['price'], changes: { price: [1200, 1400] } } });
  assert.deepEqual([words(price, 'en').what, words(price, 'en').details], ['Dish changed: Coffee', 'price: from ₪12 to ₪14']);
  assert.deepEqual([words(price, 'he').what, words(price, 'he').details], ['עדכון מנה: קפה', 'מחיר: מ־₪12 ל־₪14']);
  assert.equal(words(price, 'en').time, '12:12', 'Jerusalem, summer time');
  assert.equal(words(price, 'en').day, '2026-10-16');
  const priced = entry({ targetName: { he: 'תה', en: '' }, detail: { columns: ['name_en', 'name_he', 'price', 'hidden'], changes: { price: [null, 900], hidden: [false, true] } } });
  assert.deepEqual([words(priced, 'en').what, words(priced, 'en').details], ['Dish changed: תה', 'price: from no price to ₪9 · hidden from guests · changed: name'], 'a name missing in one language reads in the other');
  const bulk = entry({ action: 'dishes.insert', n: 12, targetIds: Array.from({ length: 12 }, uid), detail: {} });
  assert.equal(words(bulk, 'en').what, '12 dishes added');
  assert.equal(words(bulk, 'he').what, 'הוספת 12 מנות');
  const gone = entry({ action: 'sections.delete', targetName: null, detail: {} });
  assert.deepEqual([words(gone, 'en').what, words(gone, 'he').what], ['Section deleted', 'מחיקת קטגוריה'], 'a deleted row has no name to read: none is invented');
});

test('Halom\'s actions read "Halom", with the reason; reads of the menu and exports included (D25)', () => {
  const off = entry({ actorKind: 'staff', you: false, via: 'act_for_owner', action: 'availability_overrides.insert', targetTable: 'availability_overrides', reason: 'The owner phoned: out of fish',
    detail: { target_kind: 'dish', target_id: uid(), until_kind: 'duration', until_at: '2026-10-16T12:30:00.000Z', created_by_kind: 'staff' } });
  const w = words(off, 'en');
  assert.deepEqual([w.who, w.whoText, w.what, w.details, w.reason], ['halom', 'Halom', 'Taken off: a dish', 'until 15:30', 'The owner phoned: out of fish']);
  assert.deepEqual([words(off, 'he').what, words(off, 'he').details], ['הורדה מהתפריט: מנה', 'עד 15:30']);
  const tomorrow = entry({ ...off, id: ++n, detail: { ...off.detail, until_at: '2026-10-17T04:00:00.000Z' } });
  assert.equal(words(tomorrow, 'en').details, 'until 17 October, 07:00', 'an end on another day says its date');
  const afo = entry({ actorKind: 'staff', you: false, via: 'act_for_owner', action: 'support.act_for_owner', targetTable: null, reason: 'Asked on the phone', detail: { action: 'availability.set', until: 'duration' } });
  assert.deepEqual([words(afo, 'en').what, words(afo, 'en').reason], ['Acted for you: availability', 'Asked on the phone']);
  const read = entry({ actorKind: 'staff', you: false, via: 'rpc', action: 'menu.read', targetTable: 'menu_revisions', detail: { revision: 3 } });
  assert.deepEqual([words(read, 'en').what, words(read, 'he').what, words(read, 'en').who], ['Menu read, version 3', 'קריאה בתפריט, גרסה 3', 'halom']);
  const exp = entry({ actorKind: 'staff', you: false, via: 'rpc', action: 'menu.export', targetTable: 'venues', detail: { counts: { dishes: 4 } } });
  assert.deepEqual([words(exp, 'en').what, words(exp, 'en').whoText], ['Menu exported', 'Halom']);
  const status = entry({ actorKind: 'staff', you: false, via: 'rpc', action: 'support_cases.update', targetTable: 'support_cases', reason: 'Asked which price is right', detail: { columns: ['status'], changes: { status: ['open', 'waiting_owner'] } } });
  assert.deepEqual([words(status, 'en').what, words(status, 'he').what], ['Help request: waiting for you', 'פנייה לעזרה: מחכה לכם']);
  const back = entry({ action: 'availability_overrides.update', targetTable: 'availability_overrides', via: 'rpc', n: 3, detail: { columns: ['restored_at', 'restored_by'] } });
  assert.deepEqual([words(back, 'en').what, words(back, 'he').what], ['Brought back: 3 items', 'החזרה לתפריט: 3 פריטים']);
  const off2 = entry({ action: 'venues.update', targetTable: 'venues', detail: { columns: ['support_can_act'], changes: { support_can_act: [true, false] } } });
  assert.equal(words(off2, 'en').what, 'Halom may not make changes for you');
  const demo = entry({ actorKind: 'staff', you: false, via: 'rpc', action: 'venue.set_demo', reason: 'Synthetic demo venue', detail: { demo: true } });
  assert.deepEqual([words(demo, 'en').what, words(demo, 'en').reason], ['Marked as a demo place', 'Synthetic demo venue']);
});

test('every action the log may hold has its own words in both languages (no key, no placeholder, no fallback)', () => {
  const leftover = /\{|\b(acto|actn|actv|acta|actk|actc|actd|afo|step|stepstate|case|importstate|who)\./;
  for (const action of ACTIVITY_ACTIONS) {
    for (const count of [1, 4]) for (const L of ['he', 'en']) {
      const w = words(entry({ action, n: count, targetTable: action.split('.')[0], detail: {} }), L);
      assert.ok(w.what && !leftover.test(w.what) && !leftover.test(w.details), `${action} ×${count} (${L}): ${w.what} | ${w.details}`);
      assert.notEqual(w.what, L === 'he' ? 'שינוי' : 'Change', `${action} has words of its own`);
    }
  }
});

test('days in the log: today, yesterday, then the date', () => {
  const now = zonedTime('2026-10-16', '12:00', TZ);
  inLang('en', () => {
    assert.equal(dayTitle('2026-10-16', now, TZ), 'Today');
    assert.equal(dayTitle('2026-10-15', now, TZ), 'Yesterday');
    assert.equal(dayTitle('2026-10-13', now, TZ), 'Tuesday 13 October');
  });
  inLang('he', () => assert.equal(dayTitle('2026-10-15', now, TZ), 'אתמול'));
});

// ---------------------------------------------------------------- the live timer
function fakeClock() {
  let now = 0;
  const due = [];
  const timers = {
    set: (fn, ms) => { const h = { at: now + ms, fn }; due.push(h); return h; },
    clear: (h) => { const i = due.indexOf(h); if (i >= 0) due.splice(i, 1); },
  };
  const flush = () => new Promise((r) => setImmediate(r));
  return {
    timers,
    get now() { return now; },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        due.sort((a, b) => a.at - b.at);
        const next = due[0];
        if (!next || next.at > end) break;
        due.shift();
        now = next.at;
        next.fn();
        for (let i = 0; i < 5; i++) await flush();
      }
      now = end;
      for (let i = 0; i < 5; i++) await flush();
    },
    pending: () => due.length,
  };
}

function rig({ fail = () => false } = {}) {
  const clock = fakeClock();
  const calls = [];
  let visible = true;
  const r = refresher({
    fetch: async () => { calls.push(clock.now); if (fail(calls.length)) throw new Error('offline'); },
    pollMs: LIVE_REFRESH.pollMs.owner, visible: () => visible, timers: clock.timers, random: () => 0.5,
  });
  return { r, clock, calls, hide: () => { visible = false; }, show: () => { visible = true; } };
}

test('polling: at once, then every 15 s, never while the page is hidden', async () => {
  const { r, clock, calls, hide, show } = rig();
  r.start({ poll: true });
  await clock.advance(0);
  assert.deepEqual(calls, [0]);
  await clock.advance(15_000);
  assert.deepEqual(calls, [0, 15_000]);
  hide();
  await clock.advance(45_000);
  assert.deepEqual(calls, [0, 15_000], 'hidden: no fetch');
  show();
  await clock.advance(15_000);
  assert.deepEqual(calls, [0, 15_000, 75_000], 'visible again: the next tick fetches');
  r.stop();
  await clock.advance(120_000);
  assert.equal(calls.length, 3, 'stopped');
  assert.equal(clock.pending(), 0);
});

test('a failure doubles the wait (pollDelay), at most 120 s; a success brings it back to 15 s', async () => {
  let failing = true;
  const { r, clock, calls } = rig({ fail: () => failing });
  r.start({ poll: true });
  await clock.advance(0);                                         // fails (1)
  await clock.advance(30_000);                                    // 15 s × 2
  assert.deepEqual(calls, [0, 30_000]);
  await clock.advance(60_000);                                    // × 4
  await clock.advance(120_000);                                   // × 8 = 120 s
  await clock.advance(120_000);                                   // capped
  assert.deepEqual(calls, [0, 30_000, 90_000, 210_000, 330_000]);
  assert.equal(r.failures, 5);
  failing = false;
  await clock.advance(120_000);
  await clock.advance(15_000);
  assert.deepEqual(calls.slice(-2), [450_000, 465_000], 'after a success: 15 s again');
  r.stop();
});

test('Realtime: a burst of messages is one fetch after 1.5 s; SUBSCRIBED stops polling, a failed channel starts it', async () => {
  const { r, clock, calls } = rig();
  r.start({ poll: false });
  await clock.advance(0);
  assert.deepEqual(calls, [0], 'the first numbers at once');
  await clock.advance(60_000);
  assert.deepEqual(calls, [0], 'no polling while the channel is expected');
  r.signal(); await clock.advance(500); r.signal(); await clock.advance(500); r.signal();
  await clock.advance(499);
  assert.deepEqual(calls, [0]);
  await clock.advance(1);
  assert.deepEqual(calls, [0, 61_500], 'one fetch, LIVE_REFRESH.debounceMs after the first message');
  r.status('CHANNEL_ERROR');
  await clock.advance(15_000);
  assert.deepEqual(calls, [0, 61_500, 76_500], 'the channel failed: polling');
  assert.equal(r.polling, true);
  r.status('SUBSCRIBED');
  await clock.advance(0);
  assert.deepEqual(calls, [0, 61_500, 76_500, 76_500], 'subscribed again: one catch-up fetch');
  await clock.advance(60_000);
  assert.equal(calls.length, 4, 'and no more polling');
  assert.equal(r.polling, false);
  r.stop();
  r.signal();
  await clock.advance(5_000);
  assert.equal(calls.length, 4, 'a message after stop is ignored');
});

test('asking again while a fetch is running folds into one more fetch', async () => {
  const clock = fakeClock();
  const calls = [];
  let release = null;
  const r = refresher({ fetch: () => { calls.push(clock.now); return new Promise((ok) => { release = ok; }); }, pollMs: 15_000, visible: () => true, timers: clock.timers });
  r.start({ poll: false });
  const a = r.now(), b = r.now(), c = r.now();
  assert.equal(calls.length, 1);
  release(); await a; await b; await c;
  await clock.advance(0);
  assert.equal(calls.length, 2, 'one more, not three');
  release();
  await clock.advance(0);
  assert.equal(calls.length, 2);
  r.stop();
});
