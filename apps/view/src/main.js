/* Entry point. Order of work: get the snapshot → put the whole menu in the page as text → the table (three.js and the
   pictures near the first dish, loaded as a separate chunk while the menu is on its way). If the table cannot run, the list
   is the menu.

   Who owns what:   store.js    which dish is in focus and what is open            (the truth)
                    glide.js    where the camera is along the table                (a finger, a wheel, or a request from the state)
                    gl/stage.js the picture                                        (draws those two, nothing else)
                    ui.js       every word                                         (real DOM, always)
   One clock (clock.js) turns all of it; with ?capture=1 or ?test=1 it is turned by hand (see __mana below). */
import { buildModel, initialState, createStore, select, parseHash, routeOf, isRtl, swipeToStep, tx } from './store.js';
import { bindHistory } from './history.js';
import { sourceOf, loadSnapshot, formatMoney, usesStock, loadStock, resolveStock, createTracker, text, asset, assetUrl, details, httpsUrl } from './snapshot.js';
import { createUI, showStatus, h, svg, TAG_ICON } from './ui.js';
import { ROOM_IDS } from './scenes/rooms.js';
import { bindGestures } from './gestures.js';
import { createGlide } from './glide.js';
import { createTicker, createTweens } from './clock.js';
import { presetById, frameOf, PRESETS } from './scenes/walk.js';
import { SIZE } from './scenes/common.js';
import { EDGE_PULL } from './physics.js';
/* night:templates */ import { applyLook, applyLookDom } from './looks.js'; /* /night:templates */

const Q = new URLSearchParams(location.search), $ = (id) => document.getElementById(id);
const CAPTURE = Q.get('capture') === '1';                              // filming: one hand-turned clock, frames wait for their pictures
const TEST = Q.get('test') === '1' || CAPTURE;                         // no loop of its own: frames are advanced by __mana.tick / __mana.frame
let reduce = Q.get('motion') === 'reduce' || (Q.get('motion') !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);      /* night:templates: let, a look with motion "none" sets it before the stage exists */
const mark = (name) => { try { performance.mark(name); } catch (e) { /* optional */ } };
const mem = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage is optional */ } } };
const source = sourceOf(location), live = source.kind === 'slug';
let store = null, ui = null, stage = null, stageLoading = false, glFailed = false, autoSimple = false, rev = 0, skipDraw = false, firstHero = true, hintShown = false, current = null, track = () => false;
/* schema 2 (config.schema === 2, the clean schema): the guest's choices, the basket, suggestions, the filter and the
   events, from src/v2/ (its own chunk, never loaded by a v1 menu). null on every v1 path. */
let v2 = null;
/* the v2 module's name (v2-<hash>.js) carries a hash of its content (tools/build.mjs writes it here), so this app.js never pairs with another one */
const V2_FILE = typeof __MANA_V2__ === 'string' ? __MANA_V2__ : 'v2.js';      // eslint-disable-line no-undef
let readyResolve, tableResolve;
const ready = new Promise((r) => { readyResolve = r; }), tableReady = new Promise((r) => { tableResolve = r; });
const ticker = createTicker({ manual: TEST, onFrameTime: (raw) => { if (stage && Q.get('adapt') !== 'off') stage.perf(raw); } });
const cfg = () => window.HALOM_MENUS_CONFIG || {};
/* which way the walk runs: 'feed' (the default) = a swipe up brings the next dish, which waits at the near end;
   'pull' = the next dish is further up the table and is pulled towards the guest. One switch: ?walk= or config.walk. */
const walkOf = () => ((Q.get('walk') || cfg().walk) === 'pull' ? 1 : -1);
let WALK = walkOf();
const ROOMS_ON = Q.get('rooms') !== 'off';      // ?rooms=off: the two rooms of before (the table and one bar), for comparison
const NO_GL = Q.get('gl') === 'off', SKIP_GL = Q.get('gl') === 'skip';      // off: as on a phone without WebGL (the list is the menu) · skip: tests of the DOM alone, the table simply is not drawn
const stageMod = NO_GL || SKIP_GL || Q.get('view') === 'list' ? null : import('./gl/stage.js').catch(() => null);      // on its way while the menu loads

const glide = createGlide({
  now: () => ticker.now(), wake: () => ticker.wake(), walk: () => WALK,
  pxPerDish: () => { const f = stage && stage.metrics(); return f ? f.pxPerDish : 300; },
  depth: (y) => depthAt(stage && stage.metrics(), y), along: (p) => (stage ? stage.along(p) : p), dish: (u) => (stage ? stage.dish(u) : u),
  onFocus(i) { const s = store.getState(), cat = store.getModel().catById.get(s.categoryId); if (cat && cat.ids[i] != null) store.dispatch({ type: 'focus', id: cat.ids[i] }, { via: 'glide' }); },
  onEdge(dir) { const before = store.getState().categoryId; store.dispatch({ type: 'step', dir }, { via: 'glide' }); return store.getState().categoryId !== before; },
  onRest(i, own) { if (own && !reduce && !TEST && navigator.vibrate) { try { navigator.vibrate(8); } catch (e) { /* optional */ } } }      // a light tick when the table settles on a dish
});
const tweens = createTweens(ticker);
/* flying: the table is on its way past dishes it will not stop at (a hard flick, a row of the list, End) · landing: the dish nearest the focus line is the one it stops at */
const flying = () => glide.state.mode === 'settle' && Math.abs(glide.state.target - glide.state.p) > 1.2, landing = () => !(glide.state.mode === 'settle' && Math.abs(glide.state.target - glide.state.p) > .5);
/* The point of the table under a finger at screen height y: how many dishes nearer than the focus line it lies (see walk.js for
   the camera). Solving the projection for it, instead of dividing pixels by a constant, keeps that very point under the finger. */
function depthAt(f, y) {
  if (!f) return y / 300;
  const e = f.E * Math.PI / 180, k = f.ppu * f.D, t = Math.max(y - f.cy, -.8 * k * Math.tan(e));
  return t * f.D / (Math.sin(e) * k + t * Math.cos(e)) / f.S / Math.cos(f.yaw || 0);      // a room seen from one side: the walk crosses the screen at a slant
}

function loadConfig() {                                                // ../config.js holds the Supabase settings; a demo does not need it
  if (window.HALOM_MENUS_CONFIG) return Promise.resolve();
  return new Promise((res) => { const s = document.createElement('script'); s.src = new URL('../config.js', document.baseURI).href; s.onload = s.onerror = () => res(); document.head.appendChild(s); });
}
function applyTheme(theme) {
  const root = document.documentElement, hex = theme.accent.replace('#', ''), n = parseInt(hex, 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, lum = (r * .299 + g * .587 + b * .114) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn || 1, hue = (mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  root.style.setProperty('--accent', theme.accent); root.style.setProperty('--on-accent', lum > .5 ? '#16130a' : '#fbf7ef'); root.style.setProperty('--accent-soft', 'rgba(' + r + ',' + g + ',' + b + ',.16)');
  root.style.setProperty('--holo-turn', Math.round(hue - 38) + 'deg');
  $('app').dataset.surface = theme.surface === 'holo' ? 'holo' : 'table';
}
const envOf = () => ({ fetch: window.fetch.bind(window), config: window.HALOM_MENUS_CONFIG, base: document.baseURI, window, importModule: (u) => import(/* not bundled */ u) });
let stockP = null; const stockOnce = () => stockP || (stockP = loadStock(envOf()));

async function boot() {
  const lang0 = Q.get('lang') || mem.get('halom-menu-lang') || ((navigator.language || '').toLowerCase().startsWith('he') ? 'he' : null);
  showStatus(source.kind === 'preview' ? 'preview' : 'loading', { lang: lang0 || 'he' });
  if (live) await loadConfig();
  WALK = walkOf();
  /* the language the menu will open in, as far as it can be known before the menu is here: what this guest chose earlier
     or what the link asks for; otherwise Hebrew, the default of nearly every menu */
  const env = Object.assign(envOf(), { lang: lang0 === 'en' ? 'en' : 'he', src: Q.get('t') === '1' ? 'qr' : 'link', onUpdate: (res) => { if (res.state === 'ok') start(res.snapshot); } });
  let res = null;
  /* A config that says schema 2: the v2 module decides with the contracts' configFlags (production stays 1 until the cutover);
     public_menu is asked at once, while the module is on its way, so a slow line pays one round trip, not two. */
  if (live && cfg().schema === 2) {
    const c = cfg(), kit = { text, asset, assetUrl, details, httpsUrl, rooms: ROOM_IDS, h, svg, TAG_ICON, tx, formatMoney };      // the v1 pieces it uses, handed in (src/v2/menu.js says why)
    const early = c.supabaseUrl && c.supabaseKey ? fetch(String(c.supabaseUrl).replace(/\/+$/, '') + '/rest/v1/rpc/public_menu', { method: 'POST',
      headers: { apikey: c.supabaseKey, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ p_slug: source.slug }) }).catch(() => null) : null;
    const mod = await env.importModule(new URL(V2_FILE, document.baseURI).href).catch(() => null);
    if (!mod) res = { state: 'error', message: 'the menu did not load' };
    else if (mod.isV2(c)) {
      res = await mod.loadMenu(source.slug, env, kit, early);
      if (res.state === 'ok') { v2 = mod.createGuest(res.snapshot, { env, mem, src: env.src, kit }); track = (id, kind) => v2.track(id, kind); }
    }
  }
  if (!res) {
    track = createTracker(source, env);
    res = await loadSnapshot(source, env);
  }
  if (res.state === 'ok') return start(res.snapshot);
  if (res.state === 'unavailable') { const l = lang0 || 'he'; return showStatus('unavailable', { lang: l, name: tx(res.business.name, l) }); }
  if (res.state === 'not_found') return showStatus('not_found', { lang: lang0 || 'he' });
  showStatus('error', { lang: lang0 || 'he', retry: () => boot() });
}

async function start(snapshot) {
  current = snapshot;
  if (usesStock(snapshot)) {                                           // placeholder pictures: wait a moment for the library, never long
    const st = await Promise.race([stockOnce(), new Promise((r) => setTimeout(() => r(undefined), 1600))]);
    if (current !== snapshot) return;
    if (st !== undefined) resolveStock(snapshot, st);
    else stockOnce().then((late) => { if (current === snapshot) { resolveStock(snapshot, late); open(snapshot); } });
  }
  open(snapshot);
}
function open(snapshot) {
  if (source.kind === 'demo' && Q.get('surface')) snapshot.theme.surface = Q.get('surface');      // demo only: try the same menu on another table (?surface=marble, ?surface=holo)
  /* night:templates */
  if (source.kind === 'demo' && Q.get('template')) snapshot.theme.template = Q.get('template');      // demo only: the same menu in a look (?template=album-side); a real menu's look comes with its snapshot
  const look = applyLook(snapshot.theme, PRESETS);                      // the look's surface, accent and lamp (an owner's own table photo still wins); null = today's theme
  if (look && look.motion === 'none' && !stage) reduce = true;
  /* /night:templates */
  const model = buildModel(v2 ? v2.shown(snapshot) : snapshot, { rooms: ROOMS_ON });      // schema 2: as the guest's tag filter shows it
  if (!model.cats.length) return showStatus('empty', { lang: snapshot.locale.default });
  applyTheme(snapshot.theme);
  /* night:templates */ applyLookDom(document.documentElement, $('app'), look); /* /night:templates */
  let tray = null; try { tray = v2 ? v2.counts() : JSON.parse(mem.get('halom-menu-tray:' + model.slug) || 'null'); } catch (e) { tray = null; }
  if (store) {                                                         // the same page, new content (a live preview, or the placeholder library arriving late)
    const cur = store.getState(); rev++;
    if (stage) { stage.setTheme(snapshot.theme); stage.reset(); }
    ui.rebuild(); store.replace(model, initialState(model, { lang: cur.lang, simple: cur.simple, tray: v2 ? tray : cur.tray, route: routeOf(cur) }));
    return;
  }
  const wantList = Q.get('view') === 'list';
  store = createStore(model, initialState(model, { lang: Q.get('lang') || mem.get('halom-menu-lang'), simple: wantList, tray, route: parseHash(location.hash) }));
  if (v2) v2.attach(store);                                            // the first to hear of a change: the sheet and the basket follow the state before the page draws it
  ui = createUI(store, { v2: v2 && v2.hooks,
    reduce, tweens, demo: source.kind === 'demo', sitePath: new URL(cfg().sitePath || '../', document.baseURI).href, path: location.pathname + location.search,
    instant: () => TEST && !CAPTURE, capture: CAPTURE, walk: () => WALK, onSheet: () => ticker.wake(), flying, landing,
    setLang(l) { mem.set('halom-menu-lang', l); store.dispatch({ type: 'setLang', lang: l }); },
    onPick(id) { const s = store.getState(); if (s.simple) store.dispatch({ type: 'open', what: 'dish', id }, { via: 'list' }); else store.dispatch({ type: 'focus', id }, { via: 'list' }); },
    onCategory(id) { store.dispatch({ type: 'setCategory', id }, { via: 'chip' }); },
    onLift(on) { store.dispatch(on ? { type: 'open', what: 'dish' } : { type: 'close' }, { via: 'card' }); },
    onAdd(id) { if (v2) return v2.add(id); const q = store.getState().tray[id] || 0; store.dispatch({ type: 'trayAdd', id }); if ((store.getState().tray[id] || 0) > q) track(id, 'add'); },
    retryTable() { autoSimple = false; ui.setNotice(null); if (stage && stage.resetPerf) stage.resetPerf(); store.dispatch({ type: 'setSimple', on: false }); }
  });
  store.subscribe((s, prev, a, meta) => {
    const load = a.type === 'load';
    ui.render(s, load ? null : prev, load ? { fromLoad: true } : meta);
    if (!v2 && (a.type === 'trayAdd' || a.type === 'traySet' || a.type === 'trayClear' || load)) mem.set('halom-menu-tray:' + store.getModel().slug, JSON.stringify(s.tray));      // schema 2 keeps its basket itself
    follow(s, prev, meta, load);
  });
  bindHistory(store, { history: window.history, location: window.location, on: (n, f) => window.addEventListener(n, f), setTimeout: (f, ms) => setTimeout(f, ms), clearTimeout: (t) => clearTimeout(t) });
  const s0 = store.getState(), v0 = select(s0, model);
  glide.enter(v0.count, v0.index);
  if (v2) v2.bind(ui, { redraw() { ui.render(store.getState(), null, null); if (stage) stage.repaintCards(); ticker.wake(); }, remodel: () => open(current), reload: (snap) => start(snap) });
  ui.render(s0, null, null);
  if (s0.open === 'dish') track(s0.itemId, 'open');
  showStatus(null); mark('menu-text'); readyResolve();
  bindInput();
  if (!s0.simple) startStage();
}

/* ---------- the state changed: the glide and the table follow ---------- */
function follow(s, prev, meta, load) {
  const v = select(s, store.getModel());
  if (load || prev.categoryId !== s.categoryId || prev.simple !== s.simple) glide.enter(v.count, v.index);
  else if (prev.itemId !== s.itemId && !(meta && meta.via === 'glide')) glide.goTo(v.index, reduce);
  if (s.open === 'dish' && (load || prev.open !== 'dish' || prev.itemId !== s.itemId)) track(s.itemId, 'open');      // counted once per dish per page load
  if (s.simple) { if (stage && !prev.simple) stage.sleep(); }
  else if (!stage) startStage();
  else { if (prev.simple) stage.size(true); syncStage(); }
  ticker.wake();
}
function viewOf(s) {
  const m = store.getModel(), v = select(s, m);
  const beside = (c) => (c ? { id: c.id, name: tx(c.raw.name, s.lang), kind: c.raw.kind, scene: c.scene, items: c.items } : null);      // the courses before and after: the table shows where they begin
  return { catId: v.cat.id, catName: v.categoryName, catIndex: v.cat.index, nCats: m.cats.length, scene: v.scene, kind: v.kind, items: v.cat.items, index: v.index, itemId: s.itemId,
    lifted: s.open === 'dish', rtl: isRtl(s.lang), lang: s.lang, pourSeq: s.pourSeq, nav: s.nav, rev, prev: beside(v.prevCat), next: beside(v.nextCat) };
}
function syncStage() { if (stage && store && !store.getState().simple) stage.sync(viewOf(store.getState())); }
function toList(noticeKey, retry) {
  autoSimple = true; if (ui) ui.setNotice({ key: noticeKey, retry: !!retry });
  if (store && !store.getState().simple) store.dispatch({ type: 'setSimple', on: true });
  if (ui) ui.renderNotice();
}
/* where the dish in focus will stand on screen, before the table exists: its small picture waits there */
function standin(on) {
  if (!ui || !store) return; const s = store.getState(), v = select(s, store.getModel());
  if (!on || s.simple || !v.item) return ui.standin(null, null, null, false);
  const el = $('scene'), f = (stage && stage.metrics()) || frameOf(presetById(v.scene), el.clientWidth || innerWidth, el.clientHeight || innerHeight, isRtl(s.lang));
  const stand = v.present.type === 'stand', side = SIZE * f.ppu * (stand ? .62 : 1);
  ui.standin(v.item, v.kind, [Math.round(f.cx - side / 2), Math.round(f.cy - side * (stand ? .86 : .5)), Math.round(side), Math.round(side)], true);
}
async function startStage() {
  if (stage || stageLoading || glFailed) return; if (SKIP_GL) { glFailed = true; tableResolve(false); return; }
  stageLoading = true; standin(true);
  const mod = stageMod ? await stageMod : null;
  stageLoading = false;
  if (!store || store.getState().simple) return;
  const money = (p, l) => (p && p.amount != null ? formatMoney(p.amount, p.currency, l) : '');
  stage = mod && !NO_GL ? mod.createStage({
    canvas: $('gl'), glide, theme: store.getModel().snapshot.theme, intro: !TEST, themes: new URL('themes/', document.baseURI).href, reduce, walk: WALK, /* night:page */ sway: HERO_SWAY, /* /night:page */
    bloom: Q.get('bloom') !== '0', auto: !TEST && Q.get('adapt') !== 'off', pixelRatio: Q.get('pr') ? Number(Q.get('pr')) : 0, wake: () => ticker.wake(),
    cardInfo(item) { const l = store.getState().lang; return { title: tx(item.name, l), price: money(item.price, l), rtl: isRtl(l) }; },
    onFrame: (f) => ui.layout(f), onLift: (L) => ui.setLift(L), sheet: () => ui.sheet(), onCut: (picture) => ui.cut(picture),
    onHero(ok) { if (ok && firstHero) { firstHero = false; standin(false); mark('menu-table-drawn'); maybeHint(); } },
    onBusy: (on) => { $('busy').hidden = !on; },
    onTier: (tier) => { if (tier >= 4) toList('listNotice', true); },
    onLost: (lost) => { if (lost) toList('listNotice', false); else if (autoSimple) { autoSimple = false; ui.setNotice(null); if (stage) stage.hush(); store.dispatch({ type: 'setSimple', on: false }); } }
  }) : null;
  if (!stage) { glFailed = true; standin(false); toList('listNotice', false); tableResolve(false); return; }
  $('app').classList.add('live'); stage.size(true); syncStage(); ticker.wake();
  const fit = () => { if (stage && !store.getState().simple) { stage.size(); ticker.wake(); } };
  if (window.ResizeObserver) new ResizeObserver(fit).observe($('scene')); else window.addEventListener('resize', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (stage) { stage.repaintCards(); ticker.wake(); } });
  const t0 = performance.now(), wait = () => { if (!stage) return; if (stage.pending() === 0 || performance.now() - t0 > 20000) { mark('menu-table'); tableResolve(true); } else setTimeout(wait, 60); }; setTimeout(wait, 60);
}

/* one frame: the finger (or the spring it left) → which dish → the picture */
ticker.add((dt) => {
  let more = glide.step(dt);
  if (!store) return more;
  const s = store.getState();
  if (stage && !s.simple && !stage.isLost()) { const m = stage.step(dt); if (!skipDraw) stage.draw(); if (m === true) more = true; else if (m && !more) more = 'slow'; }
  edgeHint(s); if (ui) ui.cardLands();
  return more;
});
function edgeHint(s) {
  const G = glide.state, over = G.p > G.max ? G.p - G.max : G.p < 0 ? -G.p : 0;
  if (!ui) return; if (over < .02 || G.mode === 'rest') return ui.edge(0);
  const dir = G.p > G.max ? 1 : -1, v = select(s, store.getModel()), c = dir > 0 ? v.nextCat : v.prevCat;
  if (!c) return ui.edge(0);
  ui.edge(over / EDGE_PULL, dir * WALK > 0, tx(c.raw.name, s.lang), over >= EDGE_PULL);
}
/* the first-visit hint: a hand that shows the glide, once per device, gone at the first drag */
function maybeHint() {
  if (hintShown || !ui || !store) return; const m = store.getModel();
  const want = CAPTURE ? Q.get('hint') === '1' : Q.get('hint') === '1' || (Q.get('hint') !== '0' && !TEST && mem.get('mana-hint') !== '1');
  if (!want || m.order.length < 2 || store.getState().open) return;
  hintShown = true; ui.hint(true, WALK);
}
function endHint() { if (hintShown && ui) { ui.hint(false, WALK); if (!CAPTURE) mem.set('mana-hint', '1'); } hintShown = false; }

/* ---------- fingers, wheel, keys, the tilt of the phone ---------- */
let gest = null, tiltOn = false;
function tilt() {
  if (tiltOn || reduce) return; tiltOn = true; let b0 = null;
  window.addEventListener('deviceorientation', (e) => { if (e.gamma == null || e.beta == null || !stage) return; if (b0 == null) b0 = e.beta; b0 += (e.beta - b0) * .02; stage.setTilt(e.gamma / 26, (e.beta - b0) / 30); });
}
function askTilt() {                                                   // iOS wants to be asked, from a touch: we ask once on this phone, and never again
  const D = window.DeviceOrientationEvent; if (!D || reduce || TEST) return;
  if (typeof D.requestPermission !== 'function') return tilt();
  const was = mem.get('mana-tilt'); if (was && was !== 'granted') return;
  mem.set('mana-tilt', was || 'asked');
  D.requestPermission().then((r) => { mem.set('mana-tilt', r); if (r === 'granted') tilt(); }).catch(() => {});
}
function bindInput() {
  gest = bindGestures($('scene'), {
    now: () => ticker.now(), lifted: () => store.getState().open === 'dish',
    onDown() { if (stage) stage.touch(); ticker.wake(); },
    onGlide(phase, y) { if (phase === 'start') { endHint(); glide.dragStart(y); } else if (phase === 'move') glide.dragMove(y); else glide.dragEnd(phase === 'cancel'); if (stage) stage.touch(); },
    onSide(phase, dx, sx) {
      if (!stage) { if (phase === 'end' && sx) store.dispatch({ type: 'swipe', sx }, { via: 'swipe' }); return; }
      if (phase !== 'end') { const s = store.getState(), v = select(s, store.getModel()), dir = swipeToStep(Math.sign(dx), s.lang); stage.dragX((dir > 0 ? v.nextCat : v.prevCat) ? dx : dx * .28, true); return; }      // nothing that way: the table resists
      if (sx) store.dispatch({ type: 'swipe', sx }, { via: 'swipe' });
      stage.dragX(0, false);
    },
    onTurn(dx, active, vx) { if (stage) stage.turn(dx, active, vx); },
    onPull(dy, end, cancelled) { if (end && !cancelled && dy > 44) store.dispatch({ type: 'close' }, { via: 'swipe' }); },
    onTap(x, y, lifted) {
      askTilt(); if (!stage) return; const id = stage.hit(x, y), s = store.getState();
      if (lifted) { if (id !== s.itemId) store.dispatch({ type: 'close' }, { via: 'outside' }); return; }
      if (id == null) return;
      endHint();
      if (id === s.itemId) store.dispatch({ type: 'open', what: 'dish' }, { via: 'tap' }); else store.dispatch({ type: 'focus', id }, { via: 'tap' });
    },
    onWheel(dy) { endHint(); glide.wheel(dy); if (stage) stage.touch(); },
    onPointer(nx, ny, x, y) { if (!stage) return; stage.setPointer(x < 0 ? 0 : nx, x < 0 ? 0 : ny); $('scene').style.cursor = x >= 0 && stage.hit(x, y) != null ? 'pointer' : ''; }
  });
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const s = store.getState(), k = e.key, on = e.target && e.target.tagName;
    if (k === 'Escape') { if (s.open) { e.preventDefault(); store.dispatch({ type: 'escape' }, { via: 'key' }); } return; }
    if (ui.isModal() || /^(INPUT|TEXTAREA|SELECT)$/.test(on || '') || s.simple) return;
    const typing = on === 'BUTTON' || on === 'A';
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp' || (k === ' ' && !typing)) { e.preventDefault(); endHint(); store.dispatch({ type: 'step', dir: k === 'ArrowUp' || k === 'PageUp' ? -1 : 1, by: k.startsWith('Page') ? 3 : 1 }, { via: 'key' }); }      // the space bar is "next", as on any page
    else if (k === 'Home' || k === 'End') { e.preventDefault(); store.dispatch({ type: k === 'Home' ? 'home' : 'end' }, { via: 'key' }); }
    else if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); if (s.open === 'dish') { if (stage) stage.turnBy(k === 'ArrowRight' ? .16 : -.16); } else store.dispatch({ type: 'arrow', key: k }, { via: 'key' }); }
    else if (k === 'Enter' && !typing) { e.preventDefault(); store.dispatch(s.open === 'dish' ? { type: 'close' } : { type: 'open', what: 'dish' }, { via: 'key' }); }
  });
}

/* ---------- for tests and for filming ----------
   __mana.frame(ms)            turn the clock by ms and resolve when that frame is drawn with its pictures (?capture=1 or ?test=1)
   __mana.pointer(type, x, y)  'down' | 'move' | 'up': a finger, through the same code as a real one
   __mana.goTo(id) · lift(on) · setLang(l) · wheel(dy) · key(name)             what a guest can do, by name */
const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
const api = {
  ready, tableReady, state: () => (store ? store.getState() : null), dispatch: (a, meta) => store.dispatch(a, meta), model: () => store.getModel(),
  tick(n, dt, draw) { for (let i = 0, c = n || 1; i < c; i++) { skipDraw = draw === false || i < c - 1; ticker.advance(dt == null ? 1 / 60 : dt); } skipDraw = false; },
  async frame(ms) {
    ticker.advance((ms == null ? 1000 / 30 : ms) / 1000);
    if (stage && stage.pending() > 0) { await stage.loaded(); ticker.advance(0); }
    await raf(); return true;
  },
  /* the table is up and the dish in focus is sharp: turn the clock until then (filming and tests start from here) */
  async settle(maxMs = 20000) {
    await ready; await tableReady; const t0 = performance.now();
    for (;;) { if (stage) await stage.loaded(); api.tick(4, 1 / 30, false); /* turned without drawing: a large screen in software takes seconds a frame */ const i = stage ? stage.info() : null; if (!stage || (i.heroReady && !i.moving && i.fade > .99) || performance.now() - t0 > maxMs) break; if (i && i.moving === 'slow' && i.heroReady && i.fade > .99) break; }
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    if (CAPTURE) await Promise.all([...document.images].filter((im) => im.getAttribute('src') && !im.complete).map((im) => new Promise((r) => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); })));
    if (CAPTURE && stage) stage.rewind();                               // a film starts from the same instant every time
    api.tick(1, 0);                                                      // and the settled scene is drawn once
    await raf(); return true;
  },
  pointer(type, x, y) { if (gest) gest.pointer(type, x, y); if (Q.get('finger') === '1' && ui) ui.finger(type === 'up' || type === 'cancel' ? null : x, y, true); },
  goTo: (id) => store.dispatch({ type: 'focus', id }, { via: 'script' }), lift: (on) => store.dispatch(on === false ? { type: 'close' } : { type: 'open', what: 'dish' }, { via: 'script' }),
  setLang: (l) => { mem.set('halom-menu-lang', l); return store.dispatch({ type: 'setLang', lang: l }); }, wheel: (dy) => glide.wheel(dy), turn: (dx, active, v) => stage && stage.turn(dx, active, v),
  key: (k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })),
  info: () => (stage ? stage.info() : null), pending: () => (stage ? stage.pending() : -1), glide: () => Object.assign({}, glide.state, { samples: undefined }),
  frameTime: (ms) => { if (stage) stage.feedFrameTime(ms / 1000); }, hit: (x, y) => (stage ? stage.hit(x, y) : null), walk: () => WALK, now: () => ticker.now(),
  marks: () => performance.getEntriesByType('mark').filter((m) => m.name.indexOf('menu-') === 0).map((m) => ({ name: m.name, t: Math.round(m.startTime) })),
  /* schema 2 only: what the basket, the sheet and the suggestions hold; send the queued events now; ask public_menu again now */
  v2: () => (v2 ? v2.debug() : null), flush: () => (v2 ? v2.flush() : Promise.resolve()), refresh: () => (v2 ? v2.refresh() : Promise.resolve())
};
window.__mana = window.__menu = api;
if (CAPTURE) $('app').classList.add('capture');
/* night:page */
/* hero mode (the product page's first screen): the dish alone, no chrome, scripted once; see hero.js. A separate chunk: a guest's menu never loads it.
   HERO_SWAY: the stage's rest sway, halved in hero mode (yaw ≤ 2°); declared here, read by startStage above (hoisted const: startStage runs after the snapshot). */
const HERO = source.kind === 'demo' && Q.get('embed') === 'hero';     // hero mode is for Halom's own demos only: a real menu never loses its chrome or counts an open
const HERO_SWAY = HERO ? .5 : 1;
if (HERO) { $('app').classList.add('hero'); import('./hero.js').then((m) => m.start({ api, ticker, reduce, debug: Q.get('debug') === '1' })).catch(() => {}); }
/* /night:page */
boot();
