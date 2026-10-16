// The owner app v2's operating side, through its public functions: suggestion rules (the plain-language line in Hebrew
// and English, the form's checks, the rule as guests get it, priority by order, the live preview's verdict and its
// reason), availability (the "until" choices around midnight, a closed day and the clock changes; what is off now; the
// set_availability / restore_today calls against a fake), opening hours with several windows a day, closures and day
// parts. Invented data only: the contracts' synthetic Café Demo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSelection, indexMenu, isAvailable, isOpenAt, isUntilSpec, matchSuggestion, nextOpening, resolveUntil, zonedTime } from '@mana/contracts';
import { DISHES, ID, cafeDemo, liveOf } from '@mana/contracts/fixtures';
import { lang } from '../../src/lib/i18n.ts';
import { UNTIL_CHOICES, availabilityApi, backAt, liveOverlayOf, offEntries, offState, offToday, targetsOf, untilSpecOf } from '../../src/v2/data/availability.ts';
import { V2Error } from '../../src/v2/data/errors.ts';
import { closureFromForm, hoursFromForm, newScheduleForm, scheduleFromForm, scheduleToForm, venueHoursOf } from '../../src/v2/data/hours.ts';
import { newRuleForm, nextPriority, previewRule, ranked, reprioritize, ruleFromForm, ruleToForm, ruleV2, sampleAt, shownOf } from '../../src/v2/data/rules.ts';
import { daysText, momentText, orList, ruleSummary } from '../../src/v2/words.ts';

const TZ = 'Asia/Jerusalem';
const V = ID.venue;
const plain = (s) => s.replace(/[⁦-⁩]/g, '');
const inLang = (l, fn) => { const before = lang.value; lang.value = l; try { return fn(); } finally { lang.value = before; } };
const at = (date, time) => zonedTime(date, time, TZ);
let n = 0;
const uid = () => '00000000-0000-4000-8000-1' + String(++n).padStart(11, '0');

// ---------------------------------------------------------------- the menu as stored rows (names only: what the words need)
const NAMES = {
  dish: { [ID.espresso]: ['אספרסו', 'Espresso'], [ID.croissant]: ['קרואסון', 'Croissant'], [ID.lemonade]: ['לימונדה', 'Lemonade'], [ID.burger]: ['המבורגר', 'Burger'], [ID.shakshuka]: ['שקשוקה', 'Shakshuka'] },
  section: { [ID.drinks]: ['שתייה', 'Drinks'], [ID.mains]: ['עיקריות', 'Mains'], [ID.pastries]: ['מאפים', 'Pastries'] },
  option: { [ID.cheese]: ['גבינה', 'Cheese'] },
};
const nameOf = (kind, id) => { const x = NAMES[kind][id]; return x ? x[lang.value === 'he' ? 0 : 1] : ''; };
const row = (o) => ({
  id: uid(), venue_id: V, label: '', trigger: 'add', scope_kind: 'all', scope_ids: [], days: [], from_time: null, to_time: null, basket_has_dishes: [],
  basket_has_sections: [], basket_lacks_dishes: [], basket_lacks_sections: [], suggest_kind: 'dish', suggest_dish_id: null, suggest_option_id: null,
  line_he: '', line_en: '', priority: 50, cap: 1, active: true, inactive_reason: null, created_at: '2026-10-16T08:00:00Z', updated_at: '2026-10-16T08:00:00Z', ...o,
});
const morning = row({ scope_kind: 'dish', scope_ids: [ID.espresso], from_time: '07:00:00', to_time: '11:00:00', suggest_dish_id: ID.croissant, line_en: 'A warm croissant?' });
const noDrink = row({ trigger: 'checkout', basket_lacks_sections: [ID.drinks], suggest_dish_id: ID.lemonade });

// ---------------------------------------------------------------- rules in words
test('a rule reads as one plain line, in Hebrew and in English', () => {
  const both = (r) => [inLang('he', () => plain(ruleSummary(r, nameOf))), inLang('en', () => plain(ruleSummary(r, nameOf)))];
  assert.deepEqual(both(morning), ['אחרי אספרסו, להציע קרואסון, 7–11', 'After Espresso, suggest Croissant, 7–11']);
  assert.deepEqual(both(noDrink), ['בסיום ההזמנה, אם אין בהזמנה שתייה, להציע לימונדה', 'At checkout, if the basket has no Drinks, suggest Lemonade']);
  assert.deepEqual(both(row({ trigger: 'sheet', scope_kind: 'dish', scope_ids: [ID.burger], suggest_kind: 'option', suggest_option_id: ID.cheese, days: [5, 6, 0], from_time: '18:30:00', to_time: '23:00:00' })),
    ['כשפותחים את המבורגר, להציע את התוספת גבינה, ו׳–א׳ 18:30–23', 'When Burger is opened, suggest the add-on Cheese, Fri–Sun 18:30–23']);
  assert.deepEqual(both(row({ trigger: 'checkout', scope_kind: 'section', scope_ids: [ID.mains], basket_has_dishes: [ID.espresso, ID.burger], basket_has_sections: [ID.pastries], suggest_dish_id: ID.lemonade, days: [1, 3] })),
    ['בסיום הזמנה עם עיקריות, אם יש בהזמנה מאפים, אספרסו או המבורגר, להציע לימונדה, ב׳, ד׳', 'At checkout with Mains, if the basket has Pastries, Espresso or Burger, suggest Lemonade, Mon, Wed']);
  assert.deepEqual(both(row({ trigger: 'sheet', suggest_dish_id: ID.lemonade, days: [0, 1, 2, 3, 4, 5, 6] })), ['כשפותחים מנה כלשהי, להציע לימונדה', 'When any dish is opened, suggest Lemonade']);
  // something deleted since reads as such, never as nothing (a condition must not read as "always")
  assert.deepEqual(both(row({ scope_kind: 'dish', scope_ids: [uid()], suggest_dish_id: uid() })), ['אחרי משהו שנמחק, להציע משהו שנמחק', 'After something deleted, suggest something deleted']);
  // a range keeps its order inside Hebrew: the line carries left-to-right isolates around it
  assert.match(inLang('he', () => ruleSummary(morning, nameOf)), /⁦7–11⁩/);
});

test('days, lists and moments in words', () => {
  inLang('en', () => {
    assert.equal(daysText([0, 1, 2, 3, 4]), 'Sun–Thu');
    assert.equal(daysText([5, 6, 0]), 'Fri–Sun');
    assert.equal(daysText([1, 3]), 'Mon, Wed');
    assert.equal(daysText([0, 1, 3, 4, 5]), 'Sun, Mon, Wed–Fri');
    assert.equal(daysText([]), 'Every day');
    assert.equal(daysText([0, 1, 2, 3, 4, 5, 6]), 'Every day');
    assert.equal(orList(['A', 'B', 'C']), 'A, B or C');
    const now = at('2026-10-15', '12:00');                                           // a Thursday
    assert.equal(momentText(at('2026-10-15', '14:30'), now, TZ), '14:30');
    assert.equal(momentText(at('2026-10-15', '14:30'), now, TZ, true), 'today at 14:30');
    assert.equal(momentText(at('2026-10-16', '07:00'), now, TZ), 'tomorrow at 07:00');
    assert.equal(momentText(at('2026-10-16', '00:00'), now, TZ), 'tomorrow');
    assert.equal(momentText(at('2026-10-18', '07:00'), now, TZ), 'Sunday at 07:00');
    assert.equal(momentText(at('2026-10-30', '00:00'), now, TZ), '30 October');
  });
  inLang('he', () => {
    assert.equal(daysText([0, 1, 2, 3, 4]), 'א׳–ה׳');
    assert.equal(orList(['א', 'ב']), 'א או ב');
    const now = at('2026-10-15', '12:00');
    assert.equal(momentText(at('2026-10-16', '07:00'), now, TZ), 'מחר ב־07:00');
    assert.equal(momentText(at('2026-10-18', '00:00'), now, TZ), 'יום ראשון');
  });
});

// ---------------------------------------------------------------- the rule form
test('a rule: the form round-trips, and every check runs before a write', () => {
  const f = ruleToForm(morning);
  assert.deepEqual([f.trigger, f.scopeKind, f.scopeIds, f.timed, f.from, f.to, f.has, f.lacks, f.suggestDishId], ['add', 'dish', [ID.espresso], true, '07:00', '11:00', null, null, ID.croissant]);
  const w = ruleFromForm(f);
  assert.equal(w.ok, true);
  assert.deepEqual([w.value.scope_ids, w.value.from_time, w.value.to_time, w.value.days, w.value.suggest_option_id], [[ID.espresso], '07:00', '11:00', [], null]);
  const codes = (patch) => { const m = ruleFromForm({ ...newRuleForm(), suggestDishId: ID.croissant, scopeIds: [ID.espresso], ...patch }); return m.ok ? [] : m.errors.map((e) => e.code); };
  assert.deepEqual(codes({}), []);
  assert.deepEqual(codes({ scopeIds: [] }), ['rule_scope_empty']);
  assert.deepEqual(codes({ timed: true, from: '7', to: '11:00' }), ['time_invalid']);
  assert.deepEqual(codes({ timed: true, from: '09:00', to: '09:00' }), ['time_same']);
  assert.deepEqual(codes({ has: { dishes: [], sections: [] } }), ['rule_condition_empty']);
  assert.deepEqual(codes({ suggestDishId: null }), ['suggestion_missing']);
  assert.deepEqual(codes({ trigger: 'checkout', suggestKind: 'option', suggestOptionId: ID.cheese }), ['rule_option_needs_dish']);
  assert.deepEqual(codes({ priority: 101 }), ['priority_invalid']);
  assert.deepEqual(codes({ priority: Number.NaN }), ['priority_invalid']);
  assert.deepEqual(codes({ cap: 6 }), ['cap_invalid']);
  assert.deepEqual(codes({ lineEn: 'x'.repeat(121) }), ['too_long']);
  // every day chosen is stored as "every day"; ids are kept once
  const all = ruleFromForm({ ...ruleToForm(morning), days: [6, 0, 1, 2, 3, 4, 5], scopeIds: [ID.espresso, ID.espresso] });
  assert.deepEqual([all.value.days, all.value.scope_ids], [[], [ID.espresso]]);
  // "after a dish of a section" stores the section; an add-on suggestion stores the option only
  const opt = ruleFromForm({ ...newRuleForm(), trigger: 'sheet', scopeKind: 'section', scopeIds: [ID.mains], suggestKind: 'option', suggestOptionId: ID.cheese, suggestDishId: ID.croissant });
  assert.deepEqual([opt.value.scope_kind, opt.value.suggest_kind, opt.value.suggest_dish_id, opt.value.suggest_option_id], ['section', 'option', null, ID.cheese]);
  // a rule the database switched off (its "basket has" emptied) keeps an empty condition to fill
  assert.deepEqual(ruleToForm(row({ active: false, inactive_reason: 'basket_has_emptied' })).has, { dishes: [], sections: [] });
  assert.equal(nextPriority([]), 50);
  assert.equal(nextPriority([{ priority: 40 }, { priority: 70 }]), 35);
  assert.equal(nextPriority([{ priority: 2 }]), 0);
});

test('the rule as guests get it: ids guests do not see are dropped, as the snapshot builder does', () => {
  const s = cafeDemo();
  const shown = shownOf(s);
  const og = new Map([[ID.cheese, ID.extras], [ID.oat, ID.milk]]);
  const gone = uid();
  const w = ruleFromForm(ruleToForm(row({ scope_kind: 'dish', scope_ids: [ID.espresso, gone], basket_lacks_dishes: [gone], basket_has_sections: [ID.pastries, gone], suggest_dish_id: ID.croissant, days: [3, 1] }))).value;
  const r = ruleV2('r1', w, shown, og);
  assert.equal(r.ok, true);
  assert.deepEqual(r.rule.scope, { kind: 'dish', ids: [ID.espresso] });
  assert.deepEqual(r.rule.basketHas, { dishes: [], sections: [ID.pastries] });
  assert.equal(r.rule.basketLacks, null, 'an emptied "lacks" is no condition');
  assert.deepEqual(r.rule.when, { days: [1, 3], from: null, to: null });
  assert.equal(ruleV2('r', { ...w, days: [], from_time: null, to_time: null }, shown, og).rule.when, null);
  assert.deepEqual(ruleV2('r', { ...w, scope_ids: [gone] }, shown, og), { ok: false, reason: 'scope_empty' });
  assert.deepEqual(ruleV2('r', { ...w, suggest_dish_id: gone }, shown, og), { ok: false, reason: 'suggestion_hidden' });
  assert.deepEqual(ruleV2('r', { ...w, basket_has_sections: [gone] }, shown, og), { ok: false, reason: 'basket_has_empty' });
  const o = ruleV2('r', { ...w, suggest_kind: 'option', suggest_dish_id: null, suggest_option_id: ID.cheese }, shown, og);
  assert.deepEqual(o.rule.suggest, { kind: 'option', groupId: ID.extras, optionId: ID.cheese });
});

test('priority by order: one write when there is room, everything numbered again when not; the list ranks as dragged', () => {
  const rules = (ps) => ps.map((p, i) => ({ id: 'r' + i, priority: p }));
  const apply = (rs, m) => ranked(rs.map((r) => ({ ...r, priority: m.get(r.id) ?? r.priority }))).map((r) => r.id);
  const moved = (ids, from, to) => { const x = [...ids]; const [m] = x.splice(from, 1); x.splice(to, 0, m); return x; };
  for (const ps of [[90, 60, 30, 10], [50, 50, 50], [100, 99, 98], [3, 2, 1, 0], [100, 50, 0], [70]]) {
    const rs = ranked(rules(ps));
    for (let from = 0; from < rs.length; from++) for (let to = 0; to < rs.length; to++) {
      const m = reprioritize(rs, from, to);
      if (from === to) { assert.equal(m.size, 0); continue; }
      assert.deepEqual(apply(rs, m), moved(rs.map((r) => r.id), from, to), `priorities ${ps} move ${from}→${to}`);
      for (const p of m.values()) assert.ok(Number.isInteger(p) && p >= 0 && p <= 100);
    }
  }
  assert.equal(reprioritize(ranked(rules([90, 60, 30, 10])), 3, 1).size, 1, 'room between 90 and 60: only the moved rule is written');
  assert.equal(reprioritize(ranked(rules([50, 50, 50])), 2, 0).size, 1, 'room above the top');
  assert.deepEqual([...reprioritize(ranked(rules([100, 99, 98])), 2, 1)], [['r2', 50], ['r1', 0]], 'no room: all numbered again from 100 down (the top one already is)');
});

// ---------------------------------------------------------------- the live preview
const NOW = at('2026-10-15', '09:00');                                              // Thursday morning
const sample = (o = {}) => ({ dishId: ID.espresso, basket: [], weekday: 4, time: '08:00', filter: null, fromSuggestion: false, ...o });
const optionGroup = new Map([[ID.cheese, ID.extras], [ID.egg, ID.extras], [ID.single, ID.size], [ID.double, ID.size], [ID.regularMilk, ID.milk]]);
function preview(r, o = {}, { snapshot = { ...cafeDemo(), upsellRules: [] }, off = [] } = {}) {
  const write = ruleFromForm(ruleToForm(r)).value;
  return previewRule({ snapshot, live: liveOf(off), id: r.id, write, optionGroup, sample: sample(o), now: NOW });
}

test('the preview runs matchSuggestion: the morning rule says yes at 08:00 and no at 13:00, and why', () => {
  const r = row({ ...morning, id: uid() });
  const yes = preview(r);
  assert.equal(yes.mine?.suggest.dishId, ID.croissant);
  assert.equal(yes.shown?.ruleId, r.id);
  assert.equal(yes.why, null);
  assert.equal(new Date(yes.at).toISOString(), new Date(at('2026-10-15', '08:00')).toISOString(), 'this week\'s Thursday, 08:00 on the venue\'s clock');
  const no = preview(r, { time: '13:00' });
  assert.equal(no.mine, null);
  assert.deepEqual(no.why, { code: 'when' });
  assert.deepEqual(preview(r, { weekday: 6, time: '10:59' }).mine?.suggest.dishId, ID.croissant, 'any day: no days chosen');
  assert.deepEqual(preview(r, { dishId: ID.lemonade }).why, { code: 'scope' });
  assert.deepEqual(preview(r, { fromSuggestion: true }).why, { code: 'chained' }, 'never in a chain');
  assert.deepEqual(preview(r, { basket: [ID.croissant] }).why, { code: 'in_basket' }, 'never what the basket has');
  assert.deepEqual(preview(r, { filter: 'vegan' }).why, { code: 'filtered' }, 'never what the guest\'s filter hides (the croissant is vegetarian)');
  const off = preview(r, {}, { off: [{ kind: 'dish', id: ID.croissant, from: '2026-10-15T00:00:00Z', until: '2026-10-15T12:00:00Z' }] });
  assert.equal(off.why.code, 'unavailable');
  assert.equal(off.why.reason, 'off');
  assert.equal(off.why.back.toISOString(), '2026-10-15T12:00:00.000Z');
  // the breakfast dish, suggested at one: not served then (its day part)
  const brk = preview(row({ id: uid(), scope_kind: 'dish', scope_ids: [ID.espresso], suggest_dish_id: ID.shakshuka }), { time: '13:00' });
  assert.deepEqual([brk.why.code, brk.why.reason], ['unavailable', 'schedule']);
  // switched off: what it would do once on, and the guest sees nothing from it
  const r2 = preview(row({ ...r, active: false }));
  assert.deepEqual([r2.off, r2.mine?.suggest.dishId, r2.shown], [true, ID.croissant, null]);
});

test('the preview: "the basket lacks a drink" at checkout', () => {
  const r = row({ ...noDrink, id: uid() });
  assert.equal(preview(r, { basket: [ID.croissant] }).mine?.suggest.dishId, ID.lemonade);
  assert.deepEqual(preview(r, { basket: [ID.croissant, ID.espresso] }).why, { code: 'lacks', found: [ID.espresso] });
  assert.deepEqual(preview(r, { basket: [] }).why, { code: 'basket_empty' });
  assert.deepEqual(preview(r, { basket: [ID.croissant, ID.lemonade] }).why, { code: 'lacks', found: [ID.lemonade] });
});

test('the preview: an add-on suggestion is never pre-selected, never replaces the guest\'s choice, only on its dish', () => {
  const opt = (optionId, o = {}) => row({ id: uid(), trigger: 'sheet', scope_kind: 'all', suggest_kind: 'option', suggest_dish_id: null, suggest_option_id: optionId, ...o });
  assert.deepEqual(preview(opt(ID.cheese), { dishId: ID.burger }).mine?.suggest, { kind: 'option', groupId: ID.extras, optionId: ID.cheese });
  assert.deepEqual(preview(opt(ID.cheese), { dishId: ID.espresso }).why, { code: 'option_not_on_dish' });
  assert.deepEqual(preview(opt(ID.single), { dishId: ID.espresso }).why, { code: 'option_chosen' }, 'the owner\'s default is already chosen');
  assert.deepEqual(preview(opt(ID.double), { dishId: ID.espresso }).why, { code: 'option_would_replace' });
  assert.equal(preview(opt(ID.regularMilk), { dishId: ID.espresso }).mine?.suggest.optionId, ID.regularMilk, 'an optional group with nothing chosen');
  const offCheese = preview(opt(ID.cheese), { dishId: ID.burger }, { off: [{ kind: 'option', id: ID.cheese, from: '2026-10-15T00:00:00Z', until: null }] });
  assert.deepEqual(offCheese.why, { code: 'option_unavailable', back: null });
});

test('the preview: rules compete (the higher priority is what the guest sees), and a rule publishing leaves out says so', () => {
  const s = cafeDemo();                                                               // its own croissant rule at priority 50
  const lower = row({ id: uid(), scope_kind: 'dish', scope_ids: [ID.espresso], suggest_dish_id: ID.lemonade, priority: 20 });
  const p = preview(lower, {}, { snapshot: s });
  assert.equal(p.mine?.suggest.dishId, ID.lemonade);
  assert.equal(p.shown?.ruleId, ID.ruleCroissant, 'the stored croissant rule comes first');
  const higher = preview({ ...lower, priority: 90 }, {}, { snapshot: s });
  assert.equal(higher.shown?.ruleId, lower.id);
  // the draft replaces its stored version: editing the croissant rule's hours changes what the guest sees
  const edited = preview(row({ ...lower, id: ID.ruleCroissant, priority: 50, from_time: '12:00:00', to_time: '13:00:00', suggest_dish_id: ID.croissant }), {}, { snapshot: s });
  assert.deepEqual([edited.mine, edited.shown], [null, null]);
  const hidden = preview(row({ id: uid(), suggest_dish_id: uid() }));
  assert.deepEqual([hidden.why, hidden.mine], [{ code: 'left_out', reason: 'suggestion_hidden' }, null]);
});

test('the reason always agrees with matchSuggestion: over every day, hour, basket, filter and trigger', () => {
  const s = { ...cafeDemo(), upsellRules: [] };
  const rules = [
    morning, noDrink,
    row({ trigger: 'sheet', scope_kind: 'section', scope_ids: [ID.mains], suggest_kind: 'option', suggest_dish_id: null, suggest_option_id: ID.cheese, days: [0, 1, 2], from_time: '18:00:00', to_time: '02:00:00' }),
    row({ trigger: 'add', basket_has_sections: [ID.pastries], suggest_dish_id: ID.lemonade }),
    row({ trigger: 'checkout', scope_kind: 'dish', scope_ids: [ID.burger], suggest_dish_id: ID.shakshuka, days: [5] }),
    row({ trigger: 'sheet', scope_kind: 'dish', scope_ids: [ID.espresso], suggest_dish_id: ID.espresso }),
  ];
  const moments = [[4, '08:00'], [4, '13:00'], [5, '23:30'], [0, '08:00']];
  const baskets = [[], [ID.croissant], [ID.espresso, ID.burger], [ID.lemonade, ID.croissant]];
  const dishes = [ID.espresso, ID.burger, ID.croissant];
  const off = [{ kind: 'dish', id: ID.lemonade, from: '2026-10-15T00:00:00Z', until: null }];
  const guests = [[null, []], ['vegan', []], [null, off]];
  let checked = 0;
  for (const r of rules) for (const [weekday, time] of moments) for (const basket of baskets) for (const dishId of dishes) for (const [filter, offs] of guests) {
    const p = preview(row({ ...r, id: r.id }), { weekday, time, basket, dishId, filter }, { snapshot: s, off: offs });
    assert.equal(p.mine === null, p.why !== null);
    if (p.why) assert.notEqual(p.why.code, 'other', JSON.stringify({ r: r.id, weekday, time, basket, dishId, filter }));
    checked++;
  }
  assert.equal(checked, 864);
});

test('this week\'s sample day: today when it is that day, else the coming one', () => {
  assert.equal(new Date(sampleAt(NOW, 4, '08:00', TZ)).toISOString(), new Date(at('2026-10-15', '08:00')).toISOString());
  assert.equal(new Date(sampleAt(NOW, 0, '08:00', TZ)).toISOString(), new Date(at('2026-10-18', '08:00')).toISOString());
  assert.equal(new Date(sampleAt(NOW, 3, '20:00', TZ)).toISOString(), new Date(at('2026-10-21', '20:00')).toISOString());
});

// ---------------------------------------------------------------- "until": midnight, a closed day, the clock changes
const HOURS = { timeZone: TZ, weekly: [{ days: [0, 1, 2, 3, 4], from: '07:00', to: '23:00' }, { days: [5], from: '07:00', to: '15:00' }, { days: [6], from: '19:00', to: '01:00' }], closures: [] };

test('every choice is a well-formed UntilSpec the database accepts', () => {
  assert.deepEqual([...UNTIL_CHOICES], ['h1', 'h2', 'next_opening', 'time', 'date', 'indefinite']);
  for (const c of UNTIL_CHOICES) assert.ok(isUntilSpec(untilSpecOf(c, c === 'time' ? '17:00' : '2026-10-20')), c);
  assert.equal(isUntilSpec(untilSpecOf('time', '')), false, 'an empty time is refused before any call');
});

test('until when, around midnight, across a closed day, and when the clocks change', () => {
  const iso = (d) => d?.toISOString() ?? null;
  // Thursday 23:30: an hour runs past midnight; the next opening is Friday 07:00
  const thu = at('2026-10-15', '23:30');
  assert.equal(iso(backAt(untilSpecOf('h1'), thu, HOURS)), iso(new Date(at('2026-10-16', '00:30'))));
  assert.equal(inLang('en', () => momentText(backAt(untilSpecOf('h1'), thu, HOURS), thu, TZ)), 'tomorrow at 00:30');
  assert.equal(iso(backAt(untilSpecOf('next_opening'), thu, HOURS)), iso(new Date(at('2026-10-16', '07:00'))));
  // Friday is a holiday: the next opening skips it, to Saturday evening
  const closed = { ...HOURS, closures: [{ from: '2026-10-16', to: '2026-10-16' }] };
  assert.equal(iso(backAt(untilSpecOf('next_opening'), thu, closed)), iso(new Date(at('2026-10-17', '19:00'))));
  assert.equal(inLang('en', () => momentText(backAt(untilSpecOf('next_opening'), thu, closed), thu, TZ)), 'Saturday at 19:00');
  // inside Saturday's late window (00:30 Sunday), the next opening is Sunday 07:00
  assert.equal(iso(backAt(untilSpecOf('next_opening'), at('2026-10-18', '00:30'), HOURS)), iso(new Date(at('2026-10-18', '07:00'))));
  // no hours: the start of tomorrow
  assert.equal(iso(backAt(untilSpecOf('next_opening'), thu, { timeZone: TZ, weekly: [], closures: [] })), iso(new Date(at('2026-10-16', '00:00'))));
  // a time that has passed today is tomorrow's; a date is back at its midnight
  assert.equal(iso(backAt(untilSpecOf('time', '17:00'), at('2026-10-15', '18:00'), HOURS)), iso(new Date(at('2026-10-16', '17:00'))));
  assert.equal(iso(backAt(untilSpecOf('date', '2026-10-20'), thu, HOURS)), iso(new Date(at('2026-10-20', '00:00'))));
  assert.equal(backAt(untilSpecOf('indefinite'), thu, HOURS), null);
  // durations are whole minutes, rounded up (the moment the phone shows is the moment the database restores)
  assert.equal(iso(backAt(untilSpecOf('h2'), Date.parse('2026-10-15T10:00:30Z'), HOURS)), '2026-10-15T12:01:00.000Z');
  // autumn: Sunday 25 Oct 2026, 02:00 summer time goes back to 01:00. Two hours from 00:30 are two real hours: 01:30 standard time
  const fall = at('2026-10-25', '00:30');
  assert.equal(iso(backAt(untilSpecOf('h2'), fall, HOURS)), new Date(fall + 2 * 3600_000).toISOString());
  assert.equal(inLang('en', () => momentText(backAt(untilSpecOf('h2'), fall, HOURS), fall, TZ)), '01:30');
  // spring: Friday 27 Mar 2026, 02:00 standard time jumps to 03:00. "Until 02:30" (a time that does not exist) is 03:30
  const spring = at('2026-03-27', '01:00');
  assert.equal(inLang('en', () => momentText(backAt(untilSpecOf('time', '02:30'), spring, HOURS), spring, TZ)), '03:30');
  assert.equal(inLang('en', () => momentText(backAt(untilSpecOf('h1'), spring, HOURS), spring, TZ)), '03:00');
  // the app shows what the contracts resolve, nothing of its own
  for (const c of ['h1', 'h2', 'next_opening', 'indefinite']) assert.equal(iso(backAt(untilSpecOf(c), thu, closed)), iso(resolveUntil(untilSpecOf(c), thu, closed)));
});

// ---------------------------------------------------------------- what is off now; the calls
test('what is off now: its own override, or its section\'s; restored and over do not count', () => {
  const now = at('2026-10-16', '10:00');
  const o = (k, id, from, until, restored = null) => ({ id: uid(), target_kind: k, target_id: id, starts_at: new Date(from).toISOString(), until_at: until === null ? null : new Date(until).toISOString(), restored_at: restored });
  const rows = [
    o('dish', ID.croissant, now - 3600_000, now + 3600_000),
    o('section', ID.drinks, now - 600_000, null),
    o('dish', ID.burger, now - 7200_000, now - 60_000),                       // over
    o('dish', ID.schnitzel, now - 7200_000, null, new Date(now - 60_000).toISOString()),   // restored
  ];
  const entries = offEntries(rows, now);
  assert.deepEqual(entries.map((e) => e.id), [ID.croissant, ID.drinks]);
  assert.deepEqual(offState({ kind: 'dish', id: ID.croissant, sectionId: ID.pastries }, entries, now), { off: true, back: new Date(now + 3600_000), withSection: false });
  assert.deepEqual(offState({ kind: 'dish', id: ID.lemonade, sectionId: ID.drinks }, entries, now), { off: true, back: null, withSection: true });
  assert.deepEqual(offState({ kind: 'dish', id: ID.burger, sectionId: ID.mains }, entries, now), { off: false });
  assert.deepEqual(offState({ kind: 'dish', id: ID.croissant, sectionId: ID.pastries }, entries, now + 3600_000), { off: false }, 'back by itself at its minute');
  // the live overlay the guest's phone would get, from the same rows
  const live = liveOverlayOf(venueHoursOf(TZ, [], []), rows, now);
  assert.deepEqual([live.open, live.off.length], [null, 2]);
  assert.equal(isAvailable({ kind: 'dish', id: ID.lemonade, sectionId: ID.drinks }, live.off, null, null, now).available, false);
});

test('"taken off today" is the venue\'s local today: an override from 02:30 local (yesterday in UTC) counts, one from last night does not', () => {
  const now = at('2026-10-16', '10:00');
  const o = (from) => ({ target_kind: 'dish', target_id: ID.croissant, starts_at: new Date(from).toISOString(), until_at: null, restored_at: null });
  const early = o(at('2026-10-16', '02:30'));                                   // 23:30 UTC on the 15th
  const lastNight = o(at('2026-10-15', '23:50'));
  const later = o(at('2026-10-16', '11:00'));                                   // has not started
  assert.equal(new Date(early.starts_at).getUTCDate(), 15);
  assert.deepEqual(offToday([early, lastNight, later], now, TZ), [early]);
});

test('the calls: inputs checked with the contracts\' validators first, refusals in the app\'s codes, a group is each of its choices', async () => {
  const calls = [];
  const fake = (answer) => async (fn, args) => { calls.push([fn, args]); return typeof answer === 'function' ? answer(fn, args) : answer; };
  const api = availabilityApi(fake({ ok: true, overrideId: uid(), untilAt: '2026-10-16T12:00:00Z', restored: 0 }));
  const target = { kind: 'dish', id: ID.croissant };
  const r = await api.set({ venueId: V, target, until: untilSpecOf('h2') });
  assert.equal(r.untilAt, '2026-10-16T12:00:00Z');
  assert.deepEqual(calls.at(-1), ['set_availability', { p_venue: V, p_target_kind: 'dish', p_target_id: ID.croissant, p_until: { kind: 'duration', minutes: 120 }, p_note: null }]);
  await api.set({ venueId: V, target, until: null });
  assert.equal(calls.at(-1)[1].p_until, null, 'null brings it back now');
  // a bad input never leaves the phone
  const before = calls.length;
  await assert.rejects(api.set({ venueId: V, target, until: untilSpecOf('time', '25:00') }), (e) => e instanceof V2Error && e.code === 'until_invalid');
  await assert.rejects(api.set({ venueId: 'nope', target, until: null }), (e) => e.code === 'id_invalid');
  assert.equal(calls.length, before);
  // the database's refusal, in the app's codes
  const refusing = availabilityApi(fake({ ok: false, code: 'until_in_past' }));
  await assert.rejects(refusing.set({ venueId: V, target, until: untilSpecOf('date', '2026-01-01') }), (e) => e.code === 'until_in_past');
  // a whole group: every choice is called, and a refusal is said after all of them ran
  const options = [{ id: ID.cheese, group_id: ID.extras }, { id: ID.egg, group_id: ID.extras }, { id: ID.avocado, group_id: ID.extras }, { id: ID.oat, group_id: ID.milk }];
  assert.deepEqual(targetsOf({ kind: 'group', id: ID.extras }, options).map((x) => x.id), [ID.cheese, ID.egg, ID.avocado]);
  assert.deepEqual(targetsOf({ kind: 'option', id: ID.oat }, options), [{ kind: 'option', id: ID.oat }]);
  const seen = [];
  const partly = availabilityApi(async (fn, args) => { seen.push(args.p_target_id); return args.p_target_id === ID.egg ? { ok: false, code: 'target_unknown' } : { ok: true, overrideId: uid(), untilAt: null, restored: 0 }; });
  await assert.rejects(partly.setAll(V, targetsOf({ kind: 'group', id: ID.extras }, options), untilSpecOf('indefinite')), (e) => e.code === 'target_unknown');
  assert.deepEqual(seen.sort(), [ID.cheese, ID.egg, ID.avocado].sort());
  await assert.rejects(partly.setAll(V, [], null), (e) => e.code === 'target_unknown');
  // restore_today
  const back = await availabilityApi(fake({ ok: true, restored: 2, targets: [] })).restoreToday(V);
  assert.deepEqual([back.restored, calls.at(-1)], [2, ['restore_today', { p_venue: V }]]);
});

test('against a fake database that keeps overrides as set_availability does: off for two hours, then everything taken off today comes back', async () => {
  // the fake follows ADR-008: the newest answer counts (what is off for the target is restored first), until resolved now
  const store = [];
  let clockNow = at('2026-10-16', '10:00:00');
  const db = async (fn, a) => {
    if (fn === 'set_availability') {
      let restored = 0;
      for (const o of store) if (o.target_id === a.p_target_id && o.restored_at === null && (o.until_at === null || Date.parse(o.until_at) > clockNow)) { o.restored_at = new Date(clockNow).toISOString(); restored++; }
      if (a.p_until === null) return { ok: true, overrideId: null, untilAt: null, restored };
      const until = resolveUntil(a.p_until, clockNow, HOURS);
      const o = { id: uid(), target_kind: a.p_target_kind, target_id: a.p_target_id, starts_at: new Date(clockNow).toISOString(), until_at: until?.toISOString() ?? null, restored_at: null };
      store.push(o);
      return { ok: true, overrideId: o.id, untilAt: o.until_at, restored };
    }
    if (fn === 'restore_today') {
      const today = offToday(store, clockNow, TZ);
      for (const o of today) o.restored_at = new Date(clockNow).toISOString();
      return { ok: true, restored: today.length, targets: today.map((o) => ({ kind: o.target_kind, id: o.target_id })) };
    }
    throw new Error('unknown ' + fn);
  };
  const api = availabilityApi(db);
  // last night's "until we reopen" stays through restore_today
  store.push({ id: uid(), target_kind: 'dish', target_id: ID.burger, starts_at: new Date(at('2026-10-15', '22:00')).toISOString(), until_at: null, restored_at: null });
  const r = await api.set({ venueId: V, target: { kind: 'dish', id: ID.croissant }, until: untilSpecOf('h2') });
  assert.equal(r.untilAt, new Date(at('2026-10-16', '12:00')).toISOString());
  const state = () => offState({ kind: 'dish', id: ID.croissant, sectionId: ID.pastries }, offEntries(store, clockNow), clockNow);
  assert.equal(state().off, true);
  // taking it off again for an hour: the newest answer counts, nothing stacks
  const again = await api.set({ venueId: V, target: { kind: 'dish', id: ID.croissant }, until: untilSpecOf('h1') });
  assert.deepEqual([again.restored, state().back.toISOString()], [1, new Date(at('2026-10-16', '11:00')).toISOString()]);
  clockNow = at('2026-10-16', '10:30');
  const back = await api.restoreToday(V);
  assert.equal(back.restored, 1);
  assert.deepEqual(state(), { off: false });
  assert.equal(offState({ kind: 'dish', id: ID.burger, sectionId: ID.mains }, offEntries(store, clockNow), clockNow).off, true, 'taken off yesterday: stays');
});

// ---------------------------------------------------------------- opening hours, closures, day parts
test('opening hours: several windows a day; no overlap, across midnight and Saturday into Sunday too', () => {
  const stored = [
    { id: 'a', venue_id: V, weekday: 5, opens: '07:00:00', closes: '11:00:00', created_at: '' },
    { id: 'b', venue_id: V, weekday: 6, opens: '22:00:00', closes: '02:00:00', created_at: '' },
  ];
  const codes = (days, from, to, except) => { const m = hoursFromForm(days, from, to, stored, except); return m.ok ? m.value : m.errors.map((e) => e.code); };
  assert.deepEqual(codes([5], '17:00', '22:00'), [{ weekday: 5, opens: '17:00', closes: '22:00' }], 'Friday evening beside Friday morning: a split day');
  assert.deepEqual(codes([5], '10:00', '12:00'), ['hours_overlap']);
  assert.deepEqual(codes([5], '11:00', '12:00'), [{ weekday: 5, opens: '11:00', closes: '12:00' }], 'touching is not overlapping');
  assert.deepEqual(codes([0], '01:00', '09:00'), ['hours_overlap'], 'Saturday 22:00–02:00 runs into Sunday');
  assert.deepEqual(codes([0], '02:00', '09:00'), [{ weekday: 0, opens: '02:00', closes: '09:00' }]);
  assert.deepEqual(codes([4], '20:00', '08:00'), ['hours_overlap'], 'Thursday overnight runs into Friday morning');
  assert.deepEqual(codes([5], '08:00', '10:30', 'a'), [{ weekday: 5, opens: '08:00', closes: '10:30' }], 'a window changed is not checked against itself');
  assert.deepEqual(codes([1, 2], '09:00', '10:00').map((x) => x.weekday), [1, 2], 'several days in one go');
  assert.deepEqual(codes([3, 4], '20:00', '06:00').map((x) => x.weekday), [3, 4], 'two nights in a row, each past midnight');
  assert.deepEqual(codes([], '09:00', '10:00'), ['days_empty']);
  assert.deepEqual(codes([1], '9:00', '10:00'), ['time_invalid']);
  // what the guest's phone reads: open in each window, closed between them, next opening the evening one
  const rows = [...stored, { id: 'c', venue_id: V, weekday: 5, opens: '17:00:00', closes: '22:00:00', created_at: '' }];
  const hours = venueHoursOf(TZ, rows, [{ id: 'x', venue_id: V, from_date: '2026-10-23', to_date: '2026-10-23', note_he: '', note_en: '', created_at: '' }]);
  assert.deepEqual(hours.weekly, [{ days: [5], from: '07:00', to: '11:00' }, { days: [5], from: '17:00', to: '22:00' }, { days: [6], from: '22:00', to: '02:00' }]);
  assert.equal(isOpenAt(hours, at('2026-10-16', '10:00')), true);
  assert.equal(isOpenAt(hours, at('2026-10-16', '14:00')), false);
  assert.equal(nextOpening(hours, at('2026-10-16', '14:00')).toISOString(), new Date(at('2026-10-16', '17:00')).toISOString());
  assert.equal(isOpenAt(hours, at('2026-10-18', '01:30')), true, 'Saturday night, past midnight');
  assert.equal(isOpenAt(hours, at('2026-10-23', '10:00')), false, 'the closed Friday');
  assert.equal(nextOpening(hours, at('2026-10-22', '12:00')).toISOString(), new Date(at('2026-10-24', '22:00')).toISOString(), 'skips the closed Friday');
});

test('closed dates and day parts: the forms keep the schema\'s rules', () => {
  assert.deepEqual(closureFromForm({ from: '2026-12-24', to: '', noteHe: ' חג ', noteEn: '' }), { ok: true, value: { from_date: '2026-12-24', to_date: '2026-12-24', note_he: 'חג', note_en: '' } });
  const c = (f) => { const m = closureFromForm({ from: '2026-12-24', to: '2026-12-26', noteHe: '', noteEn: '', ...f }); return m.ok ? 'ok' : m.errors.map((e) => e.code); };
  assert.equal(c({}), 'ok');
  assert.deepEqual(c({ to: '2026-12-20' }), ['date_order']);
  assert.deepEqual(c({ from: '2026-02-30' }), ['date_invalid']);
  assert.deepEqual(c({ to: '2027-12-26' }), ['range_too_long']);
  assert.deepEqual(c({ noteEn: 'x'.repeat(81) }), ['too_long']);

  const breakfast = { ...newScheduleForm('day_part'), nameHe: 'בוקר', nameEn: 'Breakfast' };
  const w = scheduleFromForm(breakfast);
  assert.deepEqual(w.value, { kind: 'day_part', name_he: 'בוקר', name_en: 'Breakfast', windows: [{ days: [0, 1, 2, 3, 4, 5, 6], from: '07:00', to: '12:00' }], valid_from: null, valid_to: null });
  assert.deepEqual(scheduleFromForm(newScheduleForm('special')).errors.map((e) => e.code), ['name_missing']);
  assert.deepEqual(scheduleFromForm({ ...breakfast, windows: [] }).errors.map((e) => e.code), ['windows_empty']);
  assert.deepEqual(scheduleFromForm({ ...breakfast, windows: [{ key: 'k', days: [], from: '07:00', to: '1200' }] }).errors.map((e) => [e.field, e.code]), [['windows.0.days', 'days_empty'], ['windows.0.time', 'time_invalid']]);
  assert.deepEqual(scheduleFromForm({ ...breakfast, validFrom: '2026-12-01', validTo: '2026-11-01' }).errors.map((e) => e.code), ['date_order']);
  assert.deepEqual(scheduleFromForm({ ...breakfast, windows: Array.from({ length: 15 }, () => breakfast.windows[0]) }).errors.map((e) => e.code), ['too_many']);
  const back = scheduleToForm({ id: 's', venue_id: V, created_at: '', updated_at: '', ...w.value, windows: [{ days: [3, 1], from: '12:00', to: '16:00' }], valid_from: '2026-11-01', valid_to: null });
  assert.deepEqual([back.windows[0].days, back.validFrom, back.validTo], [[1, 3], '2026-11-01', '']);
});

test('the contracts decide: a stored rule written back as rows and previewed answers as matchSuggestion does on the snapshot', () => {
  const s = cafeDemo();
  const stored = row({ id: ID.ruleCroissant, scope_kind: 'dish', scope_ids: [ID.espresso], from_time: '07:00', to_time: '11:00', basket_lacks_sections: [ID.pastries], suggest_dish_id: ID.croissant, line_he: s.upsellRules[0].line.he, line_en: s.upsellRules[0].line.en });
  const write = ruleFromForm(ruleToForm(stored)).value;
  assert.deepEqual(ruleV2(stored.id, write, shownOf(s), optionGroup).rule, s.upsellRules[0], 'the same rule the snapshot carries');
  for (const time of ['06:59', '07:00', '10:59', '11:00']) for (const basket of [[], [ID.croissant], [ID.lemonade]]) {
    const p = previewRule({ snapshot: s, live: liveOf(), id: stored.id, write, optionGroup, sample: sample({ time, basket }), now: NOW });
    const menu = indexMenu(s);
    const want = matchSuggestion(s.upsellRules, {
      trigger: 'add', menu, dishId: ID.espresso, selection: defaultSelection(DISHES.espresso, { groups: menu.groups }), basket: [...basket, ID.espresso].map((dishId) => ({ dishId })),
      now: at('2026-10-15', time), unavailable: { dishes: new Set(), options: new Set() }, filteredOut: new Set(),
    });
    assert.deepEqual(p.shown, want, `${time} ${basket}`);
  }
});
