import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_NAMES, EVENT_PROPS, GUEST_EVENTS, MAX_BATCH, newEventId, rollupKeys, SERVER_EVENTS, validateBatch, validateEvent, type GuestEvent,
} from '../src/events.ts';
import { ID } from './fixtures.ts';

const NOW = Date.parse('2026-10-15T09:00:00Z');
const ev = (o: Record<string, unknown> = {}) => ({
  id: newEventId(), name: 'dish_viewed', venueId: ID.venue, at: '2026-10-15T08:59:30Z', props: { dishId: ID.burger }, ...o,
});
const codes = (raw: unknown, names?: readonly any[]) => {
  const r = validateEvent(raw, { now: NOW, ...(names ? { names } : {}) });
  return r.ok ? [] : r.errors.map((e) => e.code).sort();
};

test('a valid guest event of each kind', () => {
  const props: Record<string, Record<string, unknown>> = {
    menu_opened: { src: 'qr', lang: 'he', revision: 3 },
    dish_viewed: { dishId: ID.burger },
    addon_chosen: { dishId: ID.burger, groupId: ID.sauce, optionId: ID.aioli, parentOptionId: ID.fries },
    basket_added: { dishId: ID.burger, qty: 2, fromSuggestion: false },
    suggestion_shown: { ruleId: ID.ruleCheese, trigger: 'sheet', dishId: ID.burger },
    suggestion_accepted: { ruleId: ID.ruleLemonade, trigger: 'checkout', dishId: null },
    suggestion_dismissed: { ruleId: ID.ruleCroissant, trigger: 'add', dishId: ID.espresso },
  };
  for (const name of GUEST_EVENTS) assert.deepEqual(codes(ev({ name, props: props[name] })), [], name);
});

test('personal fields are impossible: refused at the top level and inside props', () => {
  assert.deepEqual(codes(ev({ phone: '0500000000' })), ['personal_field']);
  assert.deepEqual(codes(ev({ props: { dishId: ID.burger, note: 'no onions' } })), ['personal_field']);
  assert.deepEqual(codes(ev({ props: { dishId: ID.burger, Email: 'a@b.c' } })), ['personal_field'], 'any case');
  assert.deepEqual(codes(ev({ props: { dishId: ID.burger, cardNumber: '4111' } })), ['personal_field']);
  assert.deepEqual(codes(ev({ visitorId: 'abc' })), ['personal_field']);
  assert.deepEqual(codes(ev({ extra: 1 })), ['field_not_allowed']);
  // in the type too: `npm run check` fails if any of these lines compiles
  const bad: unknown[] = [
    // @ts-expect-error a phone has no place in an event's props
    { id: newEventId(), name: 'dish_viewed', venueId: ID.venue, at: '2026-10-15T09:00:00Z', props: { dishId: ID.burger, phone: '050' } } satisfies GuestEvent,
    // @ts-expect-error nor at the top level
    { id: newEventId(), name: 'dish_viewed', venueId: ID.venue, at: '2026-10-15T09:00:00Z', props: { dishId: ID.burger }, email: 'a@b.c' } satisfies GuestEvent,
    // @ts-expect-error nor a note on an add
    { id: newEventId(), name: 'basket_added', venueId: ID.venue, at: '2026-10-15T09:00:00Z', props: { dishId: ID.burger, qty: 1, fromSuggestion: false, note: 'x' } } satisfies GuestEvent,
  ];
  for (const b of bad) assert.deepEqual(codes(b).slice(0, 1), ['personal_field']);
  const good: GuestEvent = { id: newEventId(), name: 'dish_viewed', venueId: ID.venue, at: '2026-10-15T09:00:00Z', props: { dishId: ID.burger } };
  assert.deepEqual(codes(good), []);
});

test('no free text anywhere: every prop is an id, a closed word, a number or a boolean', () => {
  for (const spec of Object.values(EVENT_PROPS)) for (const kind of Object.values(spec)) assert.ok(['uuid', 'uuid?', 'lang', 'src', 'count', 'qty', 'bool', 'trigger', 'step', 'import_source'].includes(kind));
  assert.deepEqual(codes(ev({ props: { dishId: 'Moshe Cohen' } })), ['prop_invalid']);
  assert.deepEqual(codes(ev({ name: 'menu_opened', props: { src: 'qr', lang: 'he', revision: 'Moshe' } })), ['prop_invalid']);
});

test('ids, names, props, times', () => {
  assert.deepEqual(codes(ev({ id: 'not-a-uuid' })), ['id_invalid']);
  assert.deepEqual(codes(ev({ venueId: 7 })), ['id_invalid']);
  assert.deepEqual(codes(ev({ name: 'page_scrolled' })), ['name_unknown']);
  assert.deepEqual(codes(ev({ props: {} })), ['prop_missing']);
  assert.deepEqual(codes(ev({ props: null })), ['type']);
  assert.deepEqual(codes(ev({ name: 'basket_added', props: { dishId: ID.burger, qty: 0, fromSuggestion: false } })), ['prop_invalid']);
  assert.deepEqual(codes(ev({ at: 'yesterday' })), ['time_invalid']);
  assert.deepEqual(codes(ev({ at: '2026-10-12T00:00:00Z' })), ['time_out_of_range'], 'older than 48 h');
  assert.deepEqual(codes(ev({ at: '2026-10-15T09:10:00Z' })), ['time_out_of_range'], 'more than 5 min ahead');
});

test('guests cannot send server events; the server may', () => {
  const pub = ev({ name: 'menu_published', props: { revision: 4 } });
  assert.deepEqual(codes(pub), ['name_not_allowed']);
  assert.deepEqual(codes(pub, EVENT_NAMES), []);
  assert.deepEqual(codes(ev({ name: 'payment_confirmed', props: {} }), EVENT_NAMES), ['name_unknown'], 'phase 2–3 names are reserved, not accepted');
  assert.equal(SERVER_EVENTS.some((n) => (GUEST_EVENTS as readonly string[]).includes(n)), false);
});

test('a batch: bad events rejected alone, duplicates counted once, size capped', () => {
  const a = ev();
  const r = validateBatch([a, a, ev({ phone: '1' }), ev({ name: 'basket_added', props: { dishId: ID.burger, qty: 1, fromSuggestion: true } })], { now: NOW });
  assert.ok(r.ok);
  assert.equal(r.value.accepted.length, 2);
  assert.equal(r.value.duplicates, 1);
  assert.deepEqual(r.value.rejected.map((x) => [x.index, x.errors[0]!.code]), [[2, 'personal_field']]);
  assert.equal(validateBatch([], { now: NOW }).ok, false);
  assert.equal(validateBatch(Array.from({ length: MAX_BATCH + 1 }, () => ev()), { now: NOW }).ok, false);
  assert.equal(validateBatch({ 0: ev() }, { now: NOW }).ok, false);
});

test('rollup keys: a total and one key per dashboard dimension', () => {
  assert.deepEqual(rollupKeys('menu_opened', { src: 'qr', lang: 'en', revision: 2 }), ['', 'src:qr', 'lang:en']);
  assert.deepEqual(rollupKeys('dish_viewed', { dishId: ID.burger }), ['', `dish:${ID.burger}`]);
  assert.deepEqual(rollupKeys('basket_added', { dishId: ID.burger, qty: 1, fromSuggestion: true }), ['', `dish:${ID.burger}`, 'from:suggestion']);
  assert.deepEqual(rollupKeys('suggestion_accepted', { ruleId: ID.ruleCheese, trigger: 'sheet', dishId: ID.burger }), ['', `rule:${ID.ruleCheese}`, 'trigger:sheet']);
  assert.deepEqual(rollupKeys('menu_published', { revision: 1 }), ['']);
});

test('prototype keys are not contract properties (constructor, __proto__, toString)', () => {
  for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
    const e = JSON.parse(JSON.stringify(ev()));
    e.props = JSON.parse(`{"dishId": "${ID.burger}", "${k}": 1}`);
    assert.deepEqual(codes(e), ['field_not_allowed'], k);
  }
  // a prop the contract needs is not "present" because an object inherits something of that name
  const e = JSON.parse(JSON.stringify(ev({ name: 'menu_opened', props: { src: 'qr', lang: 'he' } })));
  assert.deepEqual(codes(e), ['prop_missing']);
});

test('an event time must carry its offset', () => {
  assert.deepEqual(codes(ev({ at: '2026-10-15T08:59:30' })), ['time_invalid'], 'no offset: whose 08:59?');
  assert.deepEqual(codes(ev({ at: '2026-10-15T11:59:30+03:00' })), []);
  assert.deepEqual(codes(ev({ at: '2026-10-15T08:59:30.123Z' })), []);
  assert.deepEqual(codes(ev({ at: '2026-10-15 08:59:30Z' })), ['time_invalid']);
  assert.deepEqual(codes(ev({ at: '2026-10-15T08:59:30+0300' })), ['time_invalid']);
});

test('rollup keys are lower case whatever case an id arrives in', () => {
  assert.deepEqual(rollupKeys('dish_viewed', { dishId: ID.burger.toUpperCase() }), ['', `dish:${ID.burger}`]);
});
