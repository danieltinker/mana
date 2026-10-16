/* The guest menu's reader of the v2 clean schema (ADR-001, schema 2): `public_menu(slug)` answers the published snapshot
   v2 and the live overlay; this turns them into the model the rest of the menu already draws (categories and items, the
   shape ../snapshot.js makes from v1, so the table, the list, the card and "my table" work unchanged), and keeps what only
   v2 has beside it as `snapshot.v2`: the add-on groups, "goes well with", the upsell rules, schedules and hours.

   Every rule comes from @mana/contracts (validation, availability, "from" prices): nothing is re-implemented here.
   The snapshot is validated by the same validator the database publishes with; nothing from the network reaches the DOM
   without passing here. Pure apart from the injected fetch; unit-tested (test/v2.test.mjs).

   `kit` is the v1 menu's own sanitizers (../snapshot.js: text, asset, assetUrl, details, httpsUrl; ROOM_IDS), handed in
   by main.js rather than imported: a module this chunk imported from app.js would be split into a chunk of its own, and
   every v1 menu would wait for one more request. */
import {
  allDishes, fromPrice, indexMenu, isHHMM, isLocalDate, isUuid, isWeekday, localParts, menuAvailability, nextOpening, pricingContext, unavailableOf,
  validateSnapshotV2, venueHoursOf, TARGET_KINDS,
} from '@mana/contracts';
import { word } from './i18n.js';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const instantOrNull = (v) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

/** The live overlay, as far as it is well formed: anything malformed is left out (it can only make less unavailable). */
export function readLive(raw) {
  const l = isObj(raw) ? raw : {}, h = isObj(l.hours) ? l.hours : {};
  const weekly = (Array.isArray(h.weekly) ? h.weekly : []).filter((w) => isObj(w) && Array.isArray(w.days) && w.days.every(isWeekday) && isHHMM(w.from) && isHHMM(w.to))
    .map((w) => ({ days: [...w.days], from: w.from, to: w.to }));
  const closures = (Array.isArray(h.closures) ? h.closures : []).filter((c) => isObj(c) && isLocalDate(c.from) && isLocalDate(c.to)).map((c) => ({ from: c.from, to: c.to }));
  const off = (Array.isArray(l.off) ? l.off : []).filter((o) => isObj(o) && TARGET_KINDS.includes(o.kind) && isUuid(o.id))
    .map((o) => ({ kind: o.kind, id: o.id, from: instantOrNull(o.from) ?? new Date(0).toISOString(), until: instantOrNull(o.until) }));
  return { at: instantOrNull(l.at) ?? new Date().toISOString(), open: typeof l.open === 'boolean' ? l.open : null, nextOpening: instantOrNull(l.nextOpening), hours: { weekly, closures }, off };
}

/* A v2 dish as the item the rest of the menu draws. `available`, the "from" price and the label of why it cannot be
   chosen are filled in by refresh(), from the live overlay and the clock. */
function itemOf(d, base, { text, details, asset }) {
  return {
    id: d.id, name: text(d.name), desc: text(d.desc),
    price: { amount: d.price ? d.price.amount : null, currency: 'ILS', note: text(d.price ? d.price.note : null), from: false },
    available: true, availLabel: null, availKind: null,
    tags: [...d.tags], allergens: text(d.allergens), details: details(d.details), asset: asset(d.asset, base)
  };
}

/** A validated snapshot v2 and its live overlay → the menu's model (v1 shape) with `v2` beside it. Throws when invalid. */
export function toModel(rawSnapshot, rawLive, kit, now = Date.now()) {
  const checked = validateSnapshotV2(rawSnapshot);
  if (!checked.ok) throw new Error('not a valid v2 menu: ' + checked.errors.slice(0, 3).map((e) => e.code + '@' + e.path).join(', '));
  const snap = checked.value, base = snap.assetBase, v = snap.venue, th = snap.theme, { text, assetUrl, httpsUrl } = kit;
  const model = {
    v: 2, slug: snap.slug, revision: snap.revision, publishedAt: snap.publishedAt,
    business: { name: text(v.name), area: text(v.area), cuisine: text(v.cuisine), kind: v.kind, logo: v.logo ? assetUrl(v.logo, base) : null,
      orderUrl: httpsUrl(v.orderUrl), bookUrl: httpsUrl(v.bookUrl), phone: v.phone, soldOut: v.soldOut === 'hide' ? 'hide' : 'bottom' },
    locale: { default: snap.locale.default, langs: [...snap.locale.langs], currency: 'ILS' },
    theme: { accent: th.accent, surface: th.surface || 'oak', tableImg: th.surface === 'custom' && th.tableImg ? assetUrl(th.tableImg, base) : null, template: th.template },
    categories: snap.sections.map((s) => ({ id: s.id, name: text(s.name), kind: s.kind, scene: s.scene, room: kit.rooms.includes(s.room) ? s.room : null, items: s.dishes.map((d) => itemOf(d, base, kit)) })),
    v2: { snap, live: readLive(rawLive), menu: indexMenu(snap) }
  };
  refresh(model, now);
  return model;
}

const pad = (n) => String(n).padStart(2, '0');
/** When something comes back, in words: a time today, or a day and a time. */
function whenOf(at, now, tz, lang) {
  const p = localParts(at, tz), time = pad(Math.floor(p.minutes / 60)) + ':' + pad(p.minutes % 60);
  if (p.date === localParts(now, tz).date) return { today: true, time, day: '' };
  return { today: false, time, day: new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', timeZone: tz }).format(at) };
}
function labelOf(a, now, tz) {
  const out = {};
  for (const lang of ['he', 'en']) {
    const w = a.back ? whenOf(a.back, now, tz, lang) : null;
    out[lang] = a.reason === 'schedule'
      ? (w ? word(lang, w.today ? 'laterToday' : 'laterDay', w) : word(lang, 'laterNone'))
      : a.reason === 'off' && w ? word(lang, w.today ? 'offToday' : 'offDay', w) : word(lang, 'offNow');
  }
  return out;
}

/**
 * Availability and prices now (menuAvailability, fromPrice): each item's `available`, its "from" price and the label of
 * why it cannot be chosen. A view-only menu stays readable when the venue is closed (unavailableOf's default).
 * Returns a key that changes exactly when something a guest sees changed, so a caller redraws only then.
 */
export function refresh(model, now = Date.now()) {
  const g = model.v2, tz = g.snap.venue.timeZone;
  g.av = menuAvailability(g.snap, g.live, now);
  g.unavailable = unavailableOf(g.av);
  g.ctx = pricingContext(g.snap, g.unavailable);
  const keys = [];
  for (const c of model.categories) for (const it of c.items) {
    const dish = g.menu.dishes.get(it.id), a = g.av.dishes.get(it.id), off = g.unavailable.dishes.has(it.id);
    it.available = !off;
    it.availKind = off ? (a.reason === 'schedule' ? 'later' : 'off') : null;
    it.availLabel = off ? labelOf(a, now, tz) : null;
    const fp = fromPrice(dish, g.ctx);
    if (dish.price) { it.price.amount = fp ? fp.amount : dish.price.amount; it.price.from = !!(fp && fp.from); }
    keys.push(it.id + (off ? ':' + it.availLabel.en : '') + (it.price.from ? ':from' : '') + ':' + it.price.amount);
  }
  for (const id of g.unavailable.options) keys.push('o:' + id);
  g.closed = !g.av.open;
  g.opens = g.closed ? nextOpening(venueHoursOf(g.snap, g.live), now) : null;
  keys.push(g.closed ? 'closed:' + (g.opens ? g.opens.getTime() : '') : 'open');
  return keys.join('|');
}

/** The new live overlay from a later public_menu answer for the same revision. */
export function setLive(model, rawLive, now = Date.now()) {
  model.v2.live = readLive(rawLive);
  return refresh(model, now);
}

/* ---------- the tag filter ---------- */
/** Does a dish carry every chosen tag? A vegan dish is also vegetarian (by definition, not by guess). */
export function matchesTags(tags, chosen) {
  return chosen.every((t) => tags.includes(t) || (t === 'vegetarian' && tags.includes('vegan')));
}
/** Dishes the filter hides (what matchSuggestion calls `filteredOut`). */
export function filteredOut(model, chosen) {
  const out = new Set();
  if (!chosen.length) return out;
  for (const { dish } of allDishes(model.v2.snap)) if (!matchesTags(dish.tags, chosen)) out.add(dish.id);
  return out;
}
/** The model as the filter shows it: only matching dishes, sections without any left out. The items are the same objects. */
export function filtered(model, chosen) {
  if (!chosen.length) return model;
  const hide = filteredOut(model, chosen);
  return Object.assign({}, model, { categories: model.categories.map((c) => Object.assign({}, c, { items: c.items.filter((it) => !hide.has(it.id)) })).filter((c) => c.items.length) });
}

/* ---------- where it comes from ---------- */
/** POST /rest/v1/rpc/<fn> with the publishable key, as every guest call is made. */
export function rpc(env, fn, body, extra) {
  const url = String(env.config.supabaseUrl).replace(/\/+$/, '') + '/rest/v1/rpc/' + fn;
  return env.fetch(url, Object.assign({ method: 'POST', headers: { apikey: env.config.supabaseKey, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) }, extra || {}));
}

/** → { state:'ok', snapshot } | { state:'unavailable', business } | { state:'not_found' } | { state:'error', message } (the v1 answers). */
export async function loadMenu(slug, env, kit, now = Date.now()) {
  try {
    if (!env.config || !env.config.supabaseUrl || !env.config.supabaseKey) return { state: 'error', message: 'config.js is missing' };
    const r = await rpc(env, 'public_menu', { p_slug: slug });
    if (!r.ok) return { state: 'error', message: 'HTTP ' + r.status };
    const j = await r.json();
    if (j && j.state === 'ok') return { state: 'ok', snapshot: toModel(j.snapshot, j.live, kit, now) };
    if (j && j.state === 'unavailable') return { state: 'unavailable', business: { name: kit.text(j.venue && j.venue.name) } };
    if (j && j.state === 'not_found') return { state: 'not_found' };
    return { state: 'error', message: 'unexpected answer' };
  } catch (e) {
    return { state: 'error', message: e && e.message ? e.message : 'failed' };
  }
}

/** The answer of a later public_menu call: the live overlay alone, or a whole new revision when the owner published one. */
export async function poll(model, env) {
  const r = await rpc(env, 'public_menu', { p_slug: model.slug });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (!j || j.state !== 'ok') return { state: j && j.state ? j.state : 'error' };
  if (!isObj(j.snapshot) || j.snapshot.revision !== model.revision) return { state: 'revision', raw: j };
  return { state: 'live', live: j.live };
}

/** The name a ui shows for a closed venue: "Closed now · opens at 07:00". */
export function closedText(model, lang, now = Date.now()) {
  const g = model.v2;
  if (!g.closed) return '';
  if (!g.opens) return word(lang, 'closedNow');
  const w = whenOf(g.opens, now, g.snap.venue.timeZone, lang);
  return word(lang, w.today ? 'opensToday' : 'opensDay', w);
}
