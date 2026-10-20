/* Navigation model for the diner viewer. Pure: no DOM, no three.js, no timers.
   Everything the guest can be looking at is in one serialisable state object; the stage and the DOM only read it.

   There is one level: a dish is always in focus (state.itemId), on the table of its category. Around it:
     open: null     gliding along the table
     open: 'dish'   the dish in focus is lifted and its sheet is open
     open: 'list'   the whole menu as a list, over the scene
     open: 'tray'   "my table"
   The whole menu is one walk: past the last dish of a category comes the first dish of the next. */

import { drinkSpec } from './drinks/spec.js';
import { roomFor } from './scenes/rooms.js';

const RTL = { he: true, ar: true };
export const isRtl = (lang) => !!RTL[lang];
/* a finger travelling right (sx = +1) pulls the previous table in when reading left-to-right, the next one when right-to-left */
export const swipeToStep = (sx, lang) => (sx === 0 ? 0 : (isRtl(lang) ? 1 : -1) * Math.sign(sx));
/* ArrowRight means "the table to the right": next in LTR, previous in RTL */
export const arrowToStep = (key, lang) => (key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0) * (isRtl(lang) ? -1 : 1);

/* How an item is shown, decided from its data alone:
     relief | stand   the merchant's own approved picture, in true colour
     the same with holo: true   a placeholder from the stock library: a projection, labelled as an illustration
     drink            a wine or beer with no picture, drawn as a bottle and glass: also an illustration
     photo            a print lying on the table        text   a folded name card */
export function presentation(item, kind) {
  const a = item.asset, d = drinkSpec(item, kind);
  if (a && a.state === 'relief') return { type: a.o ? 'stand' : 'relief', pourable: !!(d && d.pourable), illustration: !!a.stock, holo: !!a.stock, turns: true };
  if (d) return { type: 'drink', pourable: d.pourable, illustration: true, holo: false, turns: d.turns, vessel: d.vessel };
  return { type: a && a.state === 'photo' ? 'photo' : 'text', pourable: false, illustration: false, holo: false, turns: false };
}

/* ---- model: the snapshot, indexed ---- */
/* the room a category is shown in (scenes/rooms.js); opts.rooms === false gives the two rooms of before (table and bar) */
export const sceneFor = (cat, theme, opts) => roomFor(cat, theme, opts);
/* Sold out goes to the end of its section, in the merchant's order, and is never the first thing a guest sees there; with
   business.soldOut = 'hide' it is not shown at all (an empty section then has nothing to show). */
export function servedOrder(items, mode) {
  const ok = items.filter((it) => it.available !== false);
  return mode === 'hide' ? ok : ok.concat(items.filter((it) => it.available === false));
}
export function buildModel(snapshot, opts = {}) {
  const cats = [], catById = new Map(), itemById = new Map(), order = [], soldOut = snapshot.business && snapshot.business.soldOut === 'hide' ? 'hide' : 'bottom';
  (snapshot.categories || []).forEach((c) => {
    if (!c || !c.items || !c.items.length || catById.has(c.id)) return;      // an empty category has nothing to show
    const items = servedOrder(c.items.filter((it, k, all) => it && it.id != null && !itemById.has(it.id) && all.findIndex((x) => x && x.id === it.id) === k), soldOut);
    if (!items.length) return;
    const cat = { id: c.id, raw: c, items, ids: items.map((it) => it.id), scene: sceneFor(c, snapshot.theme, opts), index: cats.length, first: order.length };
    items.forEach((it, i) => { itemById.set(it.id, { item: it, cat, i, g: order.length }); order.push(it.id); });
    cats.push(cat); catById.set(c.id, cat);
  });
  const langs = (snapshot.locale && snapshot.locale.langs && snapshot.locale.langs.length ? snapshot.locale.langs : ['he', 'en']).filter((l) => l === 'he' || l === 'en');
  return { snapshot, cats, catById, itemById, order, langs: langs.length ? langs : ['he'], slug: snapshot.slug || '', revision: snapshot.revision || 0 };
}

/* ---- state ---- */
const OPEN = { dish: 1, list: 1, tray: 1 };
export function initialState(model, opts = {}) {
  const lang = model.langs.includes(opts.lang) ? opts.lang : (model.langs.includes(model.snapshot.locale && model.snapshot.locale.default) ? model.snapshot.locale.default : model.langs[0]);
  const first = model.cats[0] || null;
  let s = {
    slug: model.slug, revision: model.revision, lang,
    categoryId: first ? first.id : null, itemId: first ? first.ids[0] : null,
    open: null,
    pourSeq: 0,                              // counts "Pour again"; the pour itself is presentation and lives in the stage
    simple: !!opts.simple,                   // no table: the list is the menu
    tray: {},                                // "My table": itemId → quantity
    nav: { kind: 'init', dir: 0, seq: 0 }    // what the last change was, so views know which way to move
  };
  if (opts.tray) Object.keys(opts.tray).forEach((id) => { const e = model.itemById.get(id), q = opts.tray[id] | 0; if (e && e.item.available !== false && q > 0) s.tray[id] = Math.min(q, 99); });
  if (opts.route) s = reduce(s, { type: 'route', route: opts.route }, model);
  s.nav = { kind: 'init', dir: 0, seq: 0 };
  return s;
}
const bump = (s, kind, dir, patch, axis) => Object.assign({}, s, patch, { nav: { kind, dir: dir || 0, seq: s.nav.seq + 1, axis: axis || 'z' } });

/* put a dish in focus. keep: true leaves an open dish sheet open on the new dish; otherwise whatever was open closes */
function toItem(s, model, id, opts = {}) {
  const e = model.itemById.get(id); if (!e) return s;
  const cur = model.itemById.get(s.itemId), open = opts.open !== undefined ? opts.open : (s.open === 'dish' && opts.keep ? 'dish' : null);
  if (s.itemId === id && s.categoryId === e.cat.id) return open === s.open ? s : bump(s, open ? 'open' : 'close', 0, { open });
  const sameCat = !!cur && cur.cat.id === e.cat.id;
  const dir = opts.dir != null ? opts.dir : cur ? Math.sign(sameCat ? e.i - cur.i : e.cat.index - cur.cat.index) : 0;
  return bump(s, sameCat ? 'glide' : 'category', dir, { categoryId: e.cat.id, itemId: id, open }, sameCat ? 'z' : 'x');
}

export function reduce(s, a, model) {
  const cur = model.itemById.get(s.itemId), cat = cur ? cur.cat : null;
  switch (a.type) {
    case 'focus': return toItem(s, model, a.id, { keep: !!a.keep });
    case 'step': {                                       // the walk: next / previous dish, on into the neighbouring category at the ends
      if (!cur || !a.dir) return s;
      const g = cur.g + Math.sign(a.dir) * Math.max(1, a.by | 0 || 1), last = model.order.length - 1, to = Math.min(last, Math.max(0, g));
      if (to === cur.g) return bump(s, 'edge', Math.sign(a.dir), null, 'z');
      return toItem(s, model, model.order[to], { keep: true });
    }
    case 'home': case 'end': {                           // first / last dish of this table; pressed again there: of the whole menu
      if (!cur) return s; const endOf = a.type === 'end';
      let id = endOf ? cat.ids[cat.ids.length - 1] : cat.ids[0];
      if (id === s.itemId) id = endOf ? model.order[model.order.length - 1] : model.order[0];
      return id === s.itemId ? bump(s, 'edge', endOf ? 1 : -1, null, 'z') : toItem(s, model, id, { keep: true });
    }
    case 'stepCategory': {                               // the neighbouring table; you arrive at its first dish
      if (!cat || !a.dir) return s;
      const next = model.cats[cat.index + Math.sign(a.dir)];
      return next ? toItem(s, model, next.ids[0], { dir: Math.sign(a.dir) }) : bump(s, 'edge', Math.sign(a.dir), null, 'x');
    }
    case 'setCategory': { const c = model.catById.get(a.id); return c ? toItem(s, model, c.ids[0], {}) : s; }
    case 'swipe': { const dir = swipeToStep(a.sx, s.lang); return dir && !s.open ? reduce(s, { type: 'stepCategory', dir }, model) : s; }
    case 'arrow': { const dir = arrowToStep(a.key, s.lang); return dir && !s.open ? reduce(s, { type: 'stepCategory', dir }, model) : s; }
    case 'open': {
      const what = OPEN[a.what] ? a.what : null; if (!what || (what === s.open && (what !== 'dish' || a.id == null || a.id === s.itemId))) return s;
      if (what === 'list' && s.simple) return s;        // without the table the list is already the page
      if (what === 'dish') return a.id != null && a.id !== s.itemId ? toItem(s, model, a.id, { open: 'dish' }) : (cur ? bump(s, 'open', 0, { open: 'dish' }) : s);
      return bump(s, 'open', 0, { open: what });
    }
    case 'close': case 'escape': return s.open ? bump(s, 'close', 0, { open: null }) : s;
    case 'pourAgain': {                                  // only where there is something to pour: a lifted drink, on the bar
      return cur && s.open === 'dish' && !s.simple && presentation(cur.item, cat.raw.kind).pourable ? bump(s, 'pour', 0, { pourSeq: s.pourSeq + 1 }) : s;
    }
    case 'setSimple': return !!a.on === s.simple ? s : bump(s, 'simple', 0, { simple: !!a.on, open: s.open === 'list' ? null : s.open });
    case 'setLang': return a.lang === s.lang || !model.langs.includes(a.lang) ? s : bump(s, 'lang', 0, { lang: a.lang });
    case 'route': {                                      // a deep link or the Back button: #c=<category>&i=<item>&o=<what is open>
      const r = a.route || {}, o = r.o === '1' || r.o === 'dish' ? 'dish' : r.o === 'list' && !s.simple ? 'list' : r.o === 'tray' ? 'tray' : null;
      let id = r.i != null && model.itemById.has(r.i) ? r.i : r.c != null && model.catById.has(r.c) ? (cat && cat.id === r.c ? s.itemId : model.catById.get(r.c).ids[0]) : null;
      if (id == null) id = r.c == null && r.i == null && s.itemId != null ? s.itemId : (model.order[0] != null ? model.order[0] : null);
      return id == null ? s : toItem(s, model, id, { open: o });
    }
    case 'trayAdd': case 'traySet': {
      const e = model.itemById.get(a.id); if (!e) return s;
      const was = s.tray[a.id] || 0, q = Math.max(0, Math.min(99, a.type === 'trayAdd' ? was + (a.n == null ? 1 : a.n | 0) : a.qty | 0));
      if (q > was && e.item.available === false) return s;                    // sold out is never addable
      if (q === was) return s;
      const tray = Object.assign({}, s.tray); if (q) tray[a.id] = q; else delete tray[a.id];
      return Object.assign({}, s, { tray });
    }
    case 'trayClear': return Object.keys(s.tray).length ? Object.assign({}, s, { tray: {} }) : s;
    case 'traySync': {                                   // schema 2: the basket (v2/basket.js) owns the lines; the tray mirrors its counts per dish
      const tray = {}; Object.keys(a.tray || {}).forEach((id) => { const q = a.tray[id] | 0; if (q > 0) tray[id] = Math.min(q, 99); });      // every line counts, also one the filter hides or a dish gone from the menu
      const same = Object.keys(tray).length === Object.keys(s.tray).length && Object.keys(tray).every((id) => s.tray[id] === tray[id]);
      return same ? s : Object.assign({}, s, { tray });
    }
    default: return s;
  }
}

/* ---- what the views show, derived from state only ---- */
export const tx = (o, lang) => (o == null ? '' : typeof o === 'string' ? o : (o[lang] || o.he || o.en || ''));
export function select(s, model) {
  const e = s.itemId != null ? model.itemById.get(s.itemId) : null, cat = e ? e.cat : model.catById.get(s.categoryId) || null;
  const i = e ? e.i : -1, n = cat ? cat.items.length : 0;
  return {
    cat, item: e ? e.item : null, index: i, count: n, kind: cat ? cat.raw.kind : 'food', present: e ? presentation(e.item, cat.raw.kind) : null,
    categoryName: cat ? tx(cat.raw.name, s.lang) : '', itemName: e ? tx(e.item.name, s.lang) : '',
    prevCat: cat ? model.cats[cat.index - 1] || null : null, nextCat: cat ? model.cats[cat.index + 1] || null : null,
    first: e ? e.g === 0 : true, last: e ? e.g === model.order.length - 1 : true, scene: cat ? cat.scene : 'table'
  };
}
export function checkState(s, model) {              // invariants; returns a list of problems (empty = valid)
  const bad = [];
  if (!model.cats.length) return bad;
  const cat = model.catById.get(s.categoryId), e = model.itemById.get(s.itemId);
  if (!cat) bad.push('category missing');
  if (!e) bad.push('no dish in focus'); else if (!cat || e.cat.id !== cat.id) bad.push('the dish is not on this table');
  if (s.open != null && !OPEN[s.open]) bad.push('unknown thing open');
  if (s.open === 'list' && s.simple) bad.push('the list is open over the list');
  if (!Number.isInteger(s.pourSeq) || s.pourSeq < 0) bad.push('pour counter');
  Object.keys(s.tray).forEach((id) => { if (!model.itemById.has(id) || !(s.tray[id] > 0)) bad.push('tray entry invalid'); });
  return bad;
}

/* ---- URL hash: #c=<categoryId>&i=<itemId>[&o=1|list|tray] ---- */
export function routeOf(s) { const r = { c: s.categoryId, i: s.itemId }; if (s.open) r.o = s.open === 'dish' ? '1' : s.open; return r; }
export function formatHash(route) {
  if (!route || route.c == null) return '';
  const p = new URLSearchParams(); p.set('c', route.c); if (route.i != null) p.set('i', route.i); if (route.o) p.set('o', route.o);
  return '#' + p.toString();
}
export function parseHash(hash) {
  const p = new URLSearchParams(String(hash || '').replace(/^#/, '')), r = {};
  if (p.has('c')) r.c = p.get('c'); if (p.has('i')) r.i = p.get('i'); if (p.has('o')) r.o = p.get('o');
  return r;
}

/* ---- store ---- */
export function createStore(model, state) {
  let s = state, m = model; const subs = new Set();
  return {
    getState: () => s, getModel: () => m,
    dispatch(a, meta) { const prev = s; s = reduce(s, a, m); if (s !== prev) subs.forEach((f) => f(s, prev, a, meta || null)); return s; },
    replace(model2, state2) { const prev = s; m = model2; s = state2; subs.forEach((f) => f(s, prev, { type: 'load' }, null)); },
    subscribe(f) { subs.add(f); return () => subs.delete(f); }
  };
}
