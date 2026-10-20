/**
 * The first-party events contract (F10, H84–H85, D22): what happened, on which venue, when. Nothing about the person.
 *
 * Privacy by construction:
 * - every property is an id (uuid), a word from a closed list, a small integer or a boolean: there is no free-text
 *   field anywhere, so a name, phone, e-mail, note or card number has nowhere to go;
 * - the type makes personal keys impossible (`never`), and the runtime validator (here and in `track_events`)
 *   rejects any key it does not know, naming personal ones `personal_field`;
 * - no visitor id, session id, IP or user agent is part of an event. The dedupe `id` is random per event.
 *
 * Who sends what:
 * - guests send `GUEST_EVENTS` through `track_events(batch)` (published menus only, capped per source);
 * - the database emits `SERVER_EVENTS` itself (publish, onboarding, import), never a client;
 * - `LATER_EVENTS` are reserved names for phases 2–3 (ordering, payment, printing); nobody may send them yet.
 */
import { hasOwn, Issues, isInt, isObject, isString, isUuid, newUuid, oneOf, type Issue, type Validation } from './common.ts';
import { IMPORT_SOURCES, ONBOARDING_STEPS, TRIGGERS, type ImportSource, type OnboardingStep, type Trigger } from './enums.ts';

export const GUEST_EVENTS = [
  'menu_opened', 'dish_viewed', 'addon_chosen', 'basket_added', 'suggestion_shown', 'suggestion_accepted', 'suggestion_dismissed',
] as const;
export const SERVER_EVENTS = ['onboarding_step_done', 'import_parsed', 'menu_published'] as const;
export const LATER_EVENTS = [
  'checkout_started', 'payment_confirmed', 'payment_failed', 'print_queued', 'print_exception', 'order_ready', 'order_collected', 'refund_issued',
] as const;
export const EVENT_NAMES = [...GUEST_EVENTS, ...SERVER_EVENTS] as const;

export type GuestEventName = (typeof GUEST_EVENTS)[number];
export type ServerEventName = (typeof SERVER_EVENTS)[number];
export type EventName = GuestEventName | ServerEventName;
export type EventSource = 'guest' | 'server';

/** Keys that must never appear in an event, at any level. */
export const PERSONAL_KEYS = [
  'name', 'firstName', 'lastName', 'fullName', 'phone', 'mobile', 'tel', 'email', 'mail', 'note', 'notes', 'comment', 'message',
  'address', 'card', 'cardNumber', 'pan', 'cvv', 'cvc', 'expiry', 'iban', 'payment', 'paymentId', 'token', 'ip', 'userAgent',
  'userId', 'user', 'visitorId', 'sessionId', 'deviceId', 'cookie', 'location', 'lat', 'lng',
] as const;
type PersonalKey = (typeof PERSONAL_KEYS)[number];
/** Spread into every props type: a value of any of these keys cannot be typed. */
type NoPersonal = { readonly [K in PersonalKey]?: never };

/** Property kinds, the same words the database's `app.event_spec` uses. `?` = may be null. */
export type PropKind = 'uuid' | 'uuid?' | 'lang' | 'src' | 'count' | 'qty' | 'bool' | 'trigger' | 'step' | 'import_source';

/** Every event's properties, as data: the validator here and the SQL one are both driven by it (and compared). */
export const EVENT_PROPS = {
  menu_opened: { src: 'src', lang: 'lang', revision: 'count' },
  dish_viewed: { dishId: 'uuid' },
  addon_chosen: { dishId: 'uuid', groupId: 'uuid', optionId: 'uuid', parentOptionId: 'uuid?' },
  basket_added: { dishId: 'uuid', qty: 'qty', fromSuggestion: 'bool' },
  suggestion_shown: { ruleId: 'uuid', trigger: 'trigger', dishId: 'uuid?' },
  suggestion_accepted: { ruleId: 'uuid', trigger: 'trigger', dishId: 'uuid?' },
  suggestion_dismissed: { ruleId: 'uuid', trigger: 'trigger', dishId: 'uuid?' },
  onboarding_step_done: { step: 'step' },
  import_parsed: { importId: 'uuid', source: 'import_source', sections: 'count', dishes: 'count', exceptions: 'count' },
  menu_published: { revision: 'count' },
} as const satisfies Record<EventName, Record<string, PropKind>>;

export type EventProps = {
  menu_opened: { readonly src: 'qr' | 'link'; readonly lang: 'he' | 'en'; readonly revision: number } & NoPersonal;
  dish_viewed: { readonly dishId: string } & NoPersonal;
  addon_chosen: { readonly dishId: string; readonly groupId: string; readonly optionId: string; readonly parentOptionId: string | null } & NoPersonal;
  basket_added: { readonly dishId: string; readonly qty: number; readonly fromSuggestion: boolean } & NoPersonal;
  suggestion_shown: { readonly ruleId: string; readonly trigger: Trigger; readonly dishId: string | null } & NoPersonal;
  suggestion_accepted: { readonly ruleId: string; readonly trigger: Trigger; readonly dishId: string | null } & NoPersonal;
  suggestion_dismissed: { readonly ruleId: string; readonly trigger: Trigger; readonly dishId: string | null } & NoPersonal;
  onboarding_step_done: { readonly step: OnboardingStep } & NoPersonal;
  import_parsed: {
    readonly importId: string; readonly source: ImportSource; readonly sections: number; readonly dishes: number; readonly exceptions: number;
  } & NoPersonal;
  menu_published: { readonly revision: number } & NoPersonal;
};

/** What a client sends. Top-level personal keys are impossible too. */
export type TrackedEvent<N extends EventName = EventName> = N extends EventName
  ? { readonly id: string; readonly name: N; readonly venueId: string; readonly at: string; readonly props: EventProps[N] } & Omit<NoPersonal, 'name'>
  : never;
export type GuestEvent = TrackedEvent<GuestEventName>;

/** What the database stores (the `events` table). */
export type StoredEvent = TrackedEvent & { readonly source: EventSource; readonly demo: boolean; readonly receivedAt: string };

export const MAX_BATCH = 50;
/** An event's time may be this far in the past (an offline phone sending later) or the future (clock skew). */
export const MAX_AGE_MS = 48 * 3600_000;
export const MAX_SKEW_MS = 5 * 60_000;
export const MAX_QTY = 50;
export const MAX_COUNT = 1_000_000;

const PERSONAL = new Set<string>(PERSONAL_KEYS.map((k) => k.toLowerCase()));
const TOP = new Set(['id', 'name', 'venueId', 'at', 'props']);
/** An instant with an explicit offset: `Z` or `±HH:MM`. A time without one would be read in the reader's own zone. */
export const EVENT_TIME_RE = /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d{1,6})?)?(Z|[+-]\d\d:\d\d)$/;

function propOk(kind: PropKind, v: unknown): boolean {
  switch (kind) {
    case 'uuid': return isUuid(v);
    case 'uuid?': return v === null || isUuid(v);
    case 'lang': return v === 'he' || v === 'en';
    case 'src': return v === 'qr' || v === 'link';
    case 'count': return isInt(v) && v >= 0 && v <= MAX_COUNT;
    case 'qty': return isInt(v) && v >= 1 && v <= MAX_QTY;
    case 'bool': return typeof v === 'boolean';
    case 'trigger': return oneOf(TRIGGERS, v);
    case 'step': return oneOf(ONBOARDING_STEPS, v);
    case 'import_source': return oneOf(IMPORT_SOURCES, v);
  }
}

export type EventCheck = { readonly names?: readonly EventName[]; readonly now?: number };

/** One event. `names` limits what this sender may send (guests: GUEST_EVENTS, the default). */
export function validateEvent(raw: unknown, opts: EventCheck = {}): Validation<TrackedEvent> {
  const x = new Issues();
  const names: readonly string[] = opts.names ?? GUEST_EVENTS;
  if (!isObject(raw)) return { ok: false, errors: [{ code: 'type', path: '' }] };
  for (const k of Object.keys(raw)) {
    if (TOP.has(k)) continue;
    x.add(PERSONAL.has(k.toLowerCase()) ? 'personal_field' : 'field_not_allowed', k);
  }
  if (!isUuid(raw.id)) x.add('id_invalid', 'id');
  if (!isUuid(raw.venueId)) x.add('id_invalid', 'venueId');
  if (!isString(raw.name) || !(EVENT_NAMES as readonly string[]).includes(raw.name)) {
    x.add('name_unknown', 'name');
    return { ok: false, errors: x.list };
  }
  if (!names.includes(raw.name)) x.add('name_not_allowed', 'name');
  const now = opts.now ?? Date.now();
  const at = isString(raw.at) && EVENT_TIME_RE.test(raw.at) ? Date.parse(raw.at) : NaN;
  if (Number.isNaN(at)) x.add('time_invalid', 'at');
  else if (at < now - MAX_AGE_MS || at > now + MAX_SKEW_MS) x.add('time_out_of_range', 'at');

  const spec = EVENT_PROPS[raw.name as EventName] as Record<string, PropKind>;
  const props = raw.props;
  if (!isObject(props)) x.add('type', 'props');
  else {
    // own keys only: "constructor", "__proto__" or "toString" are not properties of the contract
    for (const k of Object.keys(props))
      if (!hasOwn(spec, k)) x.add(PERSONAL.has(k.toLowerCase()) ? 'personal_field' : 'field_not_allowed', `props.${k}`);
    for (const [k, kind] of Object.entries(spec)) {
      if (!hasOwn(props, k)) x.add('prop_missing', `props.${k}`);
      else if (!propOk(kind, props[k])) x.add('prop_invalid', `props.${k}`);
    }
  }
  return x.ok ? { ok: true, value: raw as unknown as TrackedEvent } : { ok: false, errors: x.list };
}

export type BatchResult = {
  readonly accepted: readonly TrackedEvent[];
  readonly rejected: ReadonlyArray<{ readonly index: number; readonly errors: readonly Issue[] }>;
  readonly duplicates: number;
};

/**
 * A batch as `track_events` reads it: 1 to MAX_BATCH events; a bad event is rejected alone; the same dedupe id twice
 * counts once (the database also remembers ids it has stored, so a retried batch adds nothing).
 */
export function validateBatch(raw: unknown, opts: EventCheck = {}): Validation<BatchResult> {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_BATCH) return { ok: false, errors: [{ code: 'batch_invalid', path: '' }] };
  const accepted: TrackedEvent[] = [];
  const rejected: Array<{ index: number; errors: readonly Issue[] }> = [];
  const seen = new Set<string>();
  let duplicates = 0;
  raw.forEach((e, index) => {
    const r = validateEvent(e, opts);
    if (r.ok === false) return void rejected.push({ index, errors: r.errors });
    if (seen.has(r.value.id)) return void (duplicates += 1);
    seen.add(r.value.id);
    accepted.push(r.value);
  });
  return { ok: true, value: { accepted, rejected, duplicates } };
}

/**
 * The rollup keys an event adds one to: '' (the total for its name) and one key per dimension the dashboards group
 * by. The database's `app.event_keys(name, props)` returns the same list (compared in supabase/tests).
 */
export function rollupKeys(name: EventName, props: Readonly<Record<string, unknown>>): string[] {
  const keys = [''];
  const add = (prefix: string, v: unknown): void => {
    if (typeof v === 'string' && v !== '') keys.push(`${prefix}:${v.toLowerCase()}`);
  };
  switch (name) {
    case 'menu_opened': add('src', props.src); add('lang', props.lang); break;
    case 'dish_viewed': add('dish', props.dishId); break;
    case 'addon_chosen': add('dish', props.dishId); add('option', props.optionId); break;
    case 'basket_added': add('dish', props.dishId); if (props.fromSuggestion === true) keys.push('from:suggestion'); break;
    case 'suggestion_shown':
    case 'suggestion_accepted':
    case 'suggestion_dismissed': add('rule', props.ruleId); add('trigger', props.trigger); break;
    case 'onboarding_step_done': add('step', props.step); break;
    case 'import_parsed': add('source', props.source); break;
    case 'menu_published': break;
  }
  return keys;
}

/**
 * What `track_events(batch)` answers. Every event of the batch is in exactly one of: accepted (stored now), a
 * duplicate (its id was stored before, or earlier in this batch), capped (dropped by a cap), or rejected (with the
 * first problem's code). The three lists name events by their index in the batch, so a phone (or the simulator's
 * ledger) knows exactly which ones counted; the counts stay for phase-0 readers. The two index lists arrive with the
 * phase-1 migration (`20261016120000_phase1.sql`); the phase-0 reply has only the counts.
 */
export type TrackEventsReply =
  | {
      readonly ok: true;
      readonly accepted: number;
      readonly duplicates: number;
      readonly capped: number;
      readonly rejected: ReadonlyArray<{ readonly index: number; readonly code: string }>;
      readonly duplicateIndexes: readonly number[];
      readonly cappedIndexes: readonly number[];
    }
  | { readonly ok: false; readonly code: 'batch_invalid' };

/** A fresh dedupe id (random, never derived from the person or the device). */
export const newEventId = (): string => newUuid();
