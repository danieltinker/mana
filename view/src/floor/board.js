/* Café Lima's board: the command-and-control screen at the counter. The 3D place in the middle (or its 2D plan), and
   around it glass panels the owner turns on, orders and makes dense or roomy: Tables (each table's state and clock),
   Orders (the counter's queue: New → Preparing → Ready → Picked up; Ready tells the guest's phone), Peak-time bids
   (the highest bid per table and slot, the countdown, accept early, decline, release), Alerts. Seat a party with a time
   frame (the table's own, the zone's, the peak's), extend, end; the table sets itself when it is seated; "Edit the floor"
   moves, adds and removes tables. Entry of view/floor.js. Address: floor/?demo=lima[&lang=en][&speed=30][&gl=off|on]
   [&motion=reduce][&test=1]. The rules are seating/*.mjs; this file draws them and asks them. A demo: nothing leaves
   this browser; the phone (floor/guest.html) talks to it through localStorage and a BroadcastChannel (live.js). */
import { validateLayout, tableById, zoneById, tableNo, fits } from '../../../seating/validate.mjs';
import { MIN, LIMITS, configure, seat, extend, free, tick, status, validateState } from '../../../seating/timers.mjs';
import { peakAt, windowsOn, openSlots, frameFor, validatePeaks, validateFrames } from '../../../seating/peaks.mjs';
import { tickBids, holdAt, auctionFor, leaderOf, accept, decline, release, configureBids, validateBids } from '../../../seating/bids.mjs';
import { addOrder, advance, back, byPhase } from '../../../seating/orders.mjs';
import * as E from '../../../seating/edit.mjs';
import { createAlerts } from '../host/alerts.js';
import { createPlan } from '../room/plan2d.js';
import { STATE_COLOURS } from '../room/colours.js';
import { STR, makeT, ITEMS, itemName } from './i18n.js';
import { createLive, DEMOS, loadLayout, demoClock, clockNow, loadRules, loadParts, seedMorning, EXAMPLE } from './live.js';

const Q = new URLSearchParams(location.search), $ = (id) => document.getElementById(id);
const TEST = Q.get('test') === '1', GL = Q.get('gl');
const speed = Math.max(1, Math.min(600, Math.round(Number(Q.get('speed')) || 1)));
const reduce = Q.get('motion') === 'reduce' || (Q.get('motion') !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const storage = (() => { try { return window.localStorage; } catch (e) { return null; } })();
const mem = { get(k) { try { return storage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { storage.setItem(k, v); } catch (e) { /* optional */ } } };
let lang = Q.get('lang') === 'en' ? 'en' : Q.get('lang') === 'he' ? 'he' : (mem.get('halom-menu-lang') === 'en' ? 'en' : 'he');
const t = makeT(STR, () => lang);
const venue = (Q.get('demo') || 'lima').replace(/[^a-z0-9-]/g, '');
const pad2 = (n) => (n < 10 ? '0' : '') + n, hm = (ms) => { const d = new Date(ms); return '\u2066' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + '\u2069'; };      /* times and ranges stay left to right inside Hebrew */
const left = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 3600 ? Math.floor(s / 3600) + ':' + pad2(Math.floor(s / 60) % 60) + ':' + pad2(s % 60) : Math.floor(s / 60) + ':' + pad2(s % 60); };
function h(tag, attrs, kids) {
  const e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach((k) => { const v = attrs[k]; if (v == null || v === false) return; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
  (kids || []).forEach((c) => { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}

/* ---------- the café ---------- */
const live = createLive(venue, { storage });
const got = DEMOS[venue] ? loadLayout(live, venue) : null;
let L = got ? got.layout : null, edited = got ? got.edited : false;
const clock = L ? demoClock(live, Q.get('speed') ? speed : null) : null;
let clk = clock;
const now = () => clockNow(clk);
let R = L ? loadRules(live, L) : null;
let S = null, O = null, B = null;
function loadAll(fresh) {
  const p = loadParts(live, L);
  if (fresh || !p.timers || !p.orders || !p.bids) { const seedS = seedMorning(L, now()); S = fresh || !p.timers ? seedS.timers : p.timers; O = fresh || !p.orders ? seedS.orders : p.orders; B = fresh || !p.bids ? seedS.bids : p.bids; live.put('timers', S); live.put('orders', O); live.put('bids', B); }
  else { S = p.timers; O = p.orders; B = p.bids; }
}
if (L) loadAll(false);
const zoneName = (zid) => { const z = zoneById(L, zid); return z ? (z.name[lang] || z.name.en) : zid; };
const tName = (id) => t('tableN', { n: tableNo(L, id) });
const tFull = (id) => { const tb = tableById(L, id); return tb ? tName(id) + ' · ' + zoneName(tb.zone) : id; };
const saveS = () => live.put('timers', S), saveO = () => live.put('orders', O), saveB = () => live.put('bids', B);
const alerts = createAlerts({ reduce });
const log = []; const note = (text, kind = 'info') => { log.unshift({ at: now(), text, kind }); log.length = Math.min(log.length, 30); };
const seen = new Set();

/* ---------- a table's picture: the timers' phase, or violet when a bid holds a free table ---------- */
function rowOf(id, n) {
  const s = status(S, id, n), hold = holdAt(B, id, n);
  let phase = s.phase, text = '', sub = '';
  if (hold && (phase === 'free' || phase === 'reserved')) { phase = 'held'; text = hm(hold.start); sub = t('heldFor', { from: hm(hold.start), to: hm(hold.end) }); }
  else if (phase === 'seated' || phase === 'ending') { text = t('left', { n: Math.max(0, Math.ceil(s.leftMs / MIN)) }); sub = t.count('guests', s.party) + ' · ' + t('until', { time: hm(s.endsAt) }); }
  else if (phase === 'over') { text = t('overBy', { n: Math.max(1, Math.ceil(s.overMs / MIN)) }); sub = t.count('guests', s.party) + ' · ' + t('over'); }
  else if (phase === 'reserved') { text = hm(s.at); sub = t('reserved') + ' ' + t('at', { time: hm(s.at) }) + ' · ' + t.count('guests', s.party); }
  else sub = t.count('upTo', tableById(L, id).seats);
  return { id, phase, text, sub, s, hold, aria: tFull(id) + ' · ' + t(phase) + (text ? ' · ' + text : '') };
}
const rows = (n) => L.tables.map((tb) => rowOf(tb.id, n));

/* ---------- the stage: the 3D place, or the plan ---------- */
let stage = null, stageKind = null, selected = null, editing = false, topView = false, fbWhy = '';
async function mountStage(kind) {
  if (stage) { stage.dispose(); stage = null; }
  const host = $('stage'); host.textContent = '';
  const common = { lang, onTable: (id) => onStageTable(id), onMove: (id, x, z) => editOp((l) => E.moveTable(l, id, x, z), id), onKey: (e, id) => editKey(e, id) };
  if (kind === '3d') {
    try {
      const { createPlace } = await import('../room/place.js');
      stage = createPlace(host, L, Object.assign({}, common, { reduced: reduce, test: TEST, lowPower: Q.get('quality') === 'low', forceGL: GL === 'on', slowMs: 4000, label: t('placeLabel', { n: L.tables.length }), onSlow: (why) => { fbWhy = why; mountStage('2d'); } }));
    } catch (e) { stage = null; fbWhy = String(e && e.message || e); }
    if (!stage) { if (!fbWhy) fbWhy = 'no WebGL'; return mountStage('2d'); }
  } else stage = createPlan(host, L, Object.assign({}, common, { label: t('planLabel', { n: L.tables.length }) }));
  stageKind = kind; stage.edit(editing); stage.select(selected);
  [...setTables].forEach((id) => stage.setTable(id, true, { instant: true }));
  views(); paintStage(); window.__floor.stageKind = kind;
}
const want3d = () => GL !== 'off' && !topView && !fbWhy;
function views() {
  const box = $('views'); box.textContent = '';
  if (stageKind === '3d') ['terrace', 'inside', 'above'].forEach((v) => box.appendChild(h('button', { class: 'pill', type: 'button', 'data-view': v, text: t(v), onclick: () => { stage.view(v); } })));
  if (GL !== 'off' && !fbWhy) box.appendChild(h('button', { class: 'pill', type: 'button', id: 'kindBtn', 'aria-pressed': String(stageKind === '2d'), text: stageKind === '3d' ? t('view2d') : t('view3d'), onclick: () => { topView = stageKind === '3d'; mountStage(topView ? '2d' : '3d'); } }));
  $('fbNote').hidden = !fbWhy; $('fbNote').textContent = fbWhy ? t('fallback', { why: fbWhy }) : '';
}
const warnIds = () => new Set(editing ? E.warnings(L).map((w) => w.id) : []);
function paintStage() {
  if (!stage) return; const n = now(), w = warnIds();
  stage.setRows(rows(n).map((r) => ({ id: r.id, phase: r.phase, text: editing ? String(tableNo(L, r.id)) : r.text, warn: w.has(r.id), aria: r.aria })));
}
const setTables = new Set();
function setTable(id, on = true) { if (on) setTables.add(id); else setTables.delete(id); return stage ? stage.setTable(id, on) : Promise.resolve(); }
function onStageTable(id) {
  if (editing) { selected = id; if (stage) stage.select(id); renderEdit(); return; }
  if (!id) return; selectTable(id, true);
}
function selectTable(id, open) {
  selected = id; if (stage) { stage.select(id); stage.flyTo(id); }
  renderPanels(); if (open) openTable(id);
}

/* ---------- the panels: which, in what order, how dense (remembered) ---------- */
const PANELS = ['tables', 'orders', 'bids', 'alerts'];
let UI = (() => { const u = live.get('ui'); const order = u && Array.isArray(u.order) ? u.order.filter((p) => PANELS.includes(p)) : []; PANELS.forEach((p) => { if (!order.includes(p)) order.push(p); }); return { order, on: Object.assign({ tables: true, orders: true, bids: true, alerts: true }, u && u.on), density: u && u.density === 'compact' ? 'compact' : 'roomy' }; })();
const saveUI = () => live.put('ui', UI, true);
function keep(fn) { const a = document.activeElement, key = a && a.getAttribute && a.getAttribute('data-k'); fn(); if (key) { const b = document.querySelector('[data-k="' + CSS.escape(key) + '"]'); if (b && b !== a) b.focus({ preventScroll: true }); } }
function renderPanels() {
  if (!L) return;
  keep(() => {
    const cols = [$('colA'), $('colB')];
    document.documentElement.classList.toggle('compact', UI.density === 'compact');
    const on = UI.order.filter((p) => UI.on[p]), want = [[], []];
    on.forEach((p, i) => want[i % 2].push(panel(p)));
    /* a panel is replaced only when what it shows changed, so a tap never lands on a button that is being swapped */
    cols.forEach((col, c) => {
      const have = [...col.children];
      if (have.length !== want[c].length || have.some((el, i) => el.dataset.panel !== want[c][i].dataset.panel)) { col.textContent = ''; want[c].forEach((el) => col.appendChild(el)); return; }
      have.forEach((el, i) => { if (el.innerHTML !== want[c][i].innerHTML) col.replaceChild(want[c][i], el); });
    });
  });
}
function panel(p) {
  const n = now(), body = p === 'tables' ? tablesPanel(n) : p === 'orders' ? ordersPanel(n) : p === 'bids' ? bidsPanel(n) : alertsPanel(n);
  return h('section', { class: 'panel glass', 'data-panel': p, 'aria-labelledby': 'h-' + p }, [h('h2', { id: 'h-' + p }, [t({ tables: 'pTables', orders: 'pOrders', bids: 'pBids', alerts: 'pAlerts' }[p]), body.count != null ? h('span', { class: 'n', text: String(body.count) }) : null]), body.el]);
}
function tablesPanel(n) {
  const rank = { over: 0, ending: 1, held: 2, seated: 3, reserved: 4, free: 5 }, list = rows(n).sort((a, b) => rank[a.phase] - rank[b.phase] || (a.s.leftMs || 0) - (b.s.leftMs || 0));
  const box = h('div', { class: 'scroll' });
  list.forEach((r) => {
    const busy = r.phase === 'seated' || r.phase === 'ending' || r.phase === 'over';
    box.appendChild(h('div', { class: 'row' + (selected === r.id ? ' sel' : ''), 'data-id': r.id, 'data-phase': r.phase, style: '--c:' + STATE_COLOURS[r.phase] }, [
      h('button', { class: 'hit', type: 'button', 'data-k': 'tsel-' + r.id, 'aria-label': r.aria, onclick: () => selectTable(r.id, true) }),
      h('i', { class: 'dot', 'aria-hidden': 'true' }),
      h('span', { class: 'tx' }, [h('b', { text: tFull(r.id) }), h('small', { text: (r.text ? r.text + ' · ' : '') + r.sub })]),
      busy ? h('button', { class: 'pill go', type: 'button', 'data-k': 'tx-' + r.id, 'data-act': 'extend', text: t('extend', { n: S.settings.extendBy }), onclick: () => act('extend', r.id) })
        : h('button', { class: 'pill go lead', type: 'button', 'data-k': 'ts-' + r.id, 'data-act': 'seat', text: t('seat'), onclick: () => { selectTable(r.id, false); openSeat(r.id); } })]));
  });
  return { el: box, count: list.filter((r) => r.phase !== 'free').length + '/' + list.length };
}
function ordersPanel(n) {
  const box = h('div', { class: 'scroll' });
  box.appendChild(h('div', { class: 'otools' }, [h('button', { class: 'pill lead', type: 'button', id: 'newOrder', 'data-k': 'newOrder', text: t('newOrder'), onclick: () => openNewOrder() }),
    h('button', { class: 'pill', type: 'button', id: 'autoBtn', 'data-k': 'auto', 'aria-pressed': String(auto), text: t('autoplay'), onclick: () => { auto = !auto; renderPanels(); } })]));
  const lanes = [['ready', 'oReady'], ['new', 'oNew'], ['preparing', 'oPrep']];
  let count = 0;
  lanes.forEach(([ph, key]) => {
    const list = byPhase(O, ph); count += list.length; if (!list.length) return;
    const lane = h('div', { class: 'olane' }, [h('h3', { text: t(key) })]);
    list.forEach((o) => {
      const acts = ph === 'new' ? [h('button', { class: 'pill', type: 'button', 'data-k': 'op-' + o.id, text: t('toPrep'), onclick: () => orderAct(o.id, 'preparing') }), h('button', { class: 'pill big', type: 'button', 'data-k': 'or-' + o.id, 'data-act': 'ready', 'data-no': o.no, text: t('ready'), onclick: () => orderAct(o.id, 'ready') })]
        : ph === 'preparing' ? [h('button', { class: 'pill big', type: 'button', 'data-k': 'or-' + o.id, 'data-act': 'ready', 'data-no': o.no, text: t('ready'), onclick: () => orderAct(o.id, 'ready') })]
          : [h('button', { class: 'pill', type: 'button', 'data-k': 'ou-' + o.id, text: t('undo'), onclick: () => orderAct(o.id, 'back') }), h('button', { class: 'pill lead', type: 'button', 'data-k': 'ok-' + o.id, 'data-act': 'picked', text: t('picked'), onclick: () => orderAct(o.id, 'picked') })];
      lane.appendChild(h('div', { class: 'order', 'data-phase': ph, 'data-no': o.no }, [h('span', { class: 'no', text: '#' + o.no }),
        h('span', { class: 'it' }, [h('b', { text: o.items.map((i) => itemName(i, lang)).join(' · ') }), o.table ? tFull(o.table) : t('noTable')]), h('span', { class: 'acts' }, acts)]));
    });
    box.appendChild(lane);
  });
  if (!count) box.appendChild(h('p', { class: 'note', text: t('noOrders') }));
  box.appendChild(h('p', { class: 'note', text: t('itemsDemo') }));
  return { el: box, count };
}
function bidsPanel(n) {
  const box = h('div', { class: 'scroll' }), p = peakAt(R.peaks, n), today = windowsOn(R.peaks, n), next = today.find((w) => w.from > n);
  box.appendChild(h('p', { class: 'peak' }, [h('i', { 'aria-hidden': 'true' }), p ? t('peakNow', { from: hm(p.from), to: hm(p.to) }) : next ? t('peakNext', { from: hm(next.from), to: hm(next.to) }) : t('peakNone'), ' ', h('span', { class: 'chipx', text: t('peakExample') })]));
  const slots = openSlots(R.peaks, n);
  B.rules.tables.forEach((id) => slots.forEach((sl) => {
    const a = auctionFor(B, id, sl), lead = leaderOf(a), bidders = new Set(a.bids.map((b) => b.guest)).size;
    box.appendChild(h('div', { class: 'bid', 'data-key': a.key, 'data-phase': a.phase }, [
      h('div', { class: 'top' }, [h('b', { text: tFull(id) }), h('span', { class: 'amt', text: lead ? '₪' + lead.amount : '' })]),
      h('small', { text: t('slot', { from: hm(sl.start), to: hm(sl.end) }) + ' · ' + (lead ? t('highest', { n: lead.amount }) + ' · ' + t.count('bidders', bidders) : t('noBids')) + ' · ' + t('closesIn', { t: left(sl.closesAt - n) }) }),
      lead ? h('div', { class: 'acts' }, [h('button', { class: 'pill lead', type: 'button', 'data-k': 'ba-' + a.key, 'data-act': 'accept', text: t('acceptNow'), onclick: () => bidAct('accept', a.key) }), h('button', { class: 'pill quiet', type: 'button', 'data-k': 'bd-' + a.key, 'data-act': 'decline', text: t('declineIt'), onclick: () => bidAct('decline', a.key) })]) : null]));
  }));
  Object.values(B.auctions).filter((a) => a.phase !== 'open' && a.end > n - 3 * 60 * MIN).sort((a, b) => a.start - b.start).forEach((a) => {
    const w = a.bids.find((b) => b.id === a.winner);
    box.appendChild(h('div', { class: 'bid', 'data-key': a.key, 'data-phase': a.phase }, [
      h('div', { class: 'top' }, [h('b', { text: tFull(a.table) }), h('span', { class: 'amt', text: w ? '₪' + w.amount : '' })]),
      h('small', { text: t('slot', { from: hm(a.start), to: hm(a.end) }) + ' · ' + (a.phase === 'won' || a.phase === 'done' ? t('wonBy', { n: w ? w.amount : 0 }) + (B.rules.credit ? ' · ' + t('credited') : '') : t(a.phase === 'unsold' ? 'unsold' : a.phase === 'declined' ? 'declined' : 'released')) }),
      a.phase === 'won' ? h('div', { class: 'acts' }, [h('button', { class: 'pill', type: 'button', 'data-k': 'br-' + a.key, 'data-act': 'release', text: t('releaseIt'), onclick: () => bidAct('release', a.key) })]) : null]));
  });
  box.appendChild(h('p', { class: 'note', text: t('bidsSample') }));
  return { el: box, count: slots.length * B.rules.tables.length || null };
}
function alertsPanel() {
  const box = h('div', { class: 'scroll', 'aria-live': 'polite' });
  if (!log.length) box.appendChild(h('p', { class: 'note', text: t('noAlerts') }));
  log.slice(0, 12).forEach((a) => box.appendChild(h('p', { class: 'alert' }, [h('time', { text: hm(a.at) }), h('span', { text: a.text })])));
  return { el: box, count: log.length || null };
}

/* ---------- what the counter does ---------- */
function act(what, id, extra) {
  const n = now();
  try {
    if (what === 'extend') S = extend(S, id, { now: n });
    else if (what === 'free') { S = free(S, id, { now: n }); setTable(id, false); }
    else if (what === 'seat') { S = seat(S, id, Object.assign({ now: n }, extra)); setTable(id, true); }
  } catch (e) { flash(e.message); return false; }
  saveS(); paint(); return true;
}
function orderAct(id, to) {
  const n = now();
  try { const r = to === 'back' ? back(O, id) : advance(O, id, to, { now: n }); O = r.state; if (to === 'ready') note(t('aReady', { no: r.order.no }), 'ready'); }
  catch (e) { flash(e.message); return; }
  saveO(); paint();
}
function bidAct(what, key) {
  const n = now(), r = what === 'accept' ? accept(B, key, { now: n }) : what === 'decline' ? decline(B, key, { reason: t('declineReason'), now: n }) : release(B, key, { now: n });
  if (!r.ok) { flash(r.error); return; }
  B = r.state; saveB();
  if (what === 'accept') { const a = B.auctions[key], w = a.bids.find((b) => b.id === a.winner); note(t('aWon', { table: tFull(a.table), n: w.amount }), 'bid'); setTable(a.table, true); }
  paint();
}
function flash(msg) { const f = $('flash'); f.textContent = msg; f.hidden = false; clearTimeout(flash.tm); flash.tm = setTimeout(() => { f.hidden = true; }, 4000); }

/* ---------- sheets ---------- */
let opener = null, sheetUpdate = null;
function openSheet(build, from) {
  opener = from || document.activeElement; const sh = $('sheet');
  sh.textContent = ''; sheetUpdate = build(sh) || null;
  sh.hidden = false; $('scrim').hidden = false;
  ['page', 'toasts'].forEach((id) => { $(id).inert = true; });
  requestAnimationFrame(() => { sh.classList.add('in'); $('scrim').classList.add('in'); const ttl = $('sheetTitle'); if (ttl) ttl.focus(); });
}
function closeSheet() {
  const sh = $('sheet'); if (sh.hidden) return;
  sh.classList.remove('in'); $('scrim').classList.remove('in'); sheetUpdate = null; sh.hidden = true; $('scrim').hidden = true;
  ['page', 'toasts'].forEach((id) => { $(id).inert = false; });
  const b = opener && opener.isConnected ? opener : null; opener = null; if (b) try { b.focus(); } catch (e) { /* gone */ }
}
const head = (title, sub) => h('header', { class: 'sh-head' }, [h('div', {}, [h('h2', { id: 'sheetTitle', tabindex: '-1', text: title }), sub ? h('p', { class: 'sub', text: sub }) : null]),
  h('button', { class: 'x', type: 'button', 'aria-label': t('close'), onclick: closeSheet, html: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' })]);
const stepper = (label, value, dec, inc, o = {}) => h('div', { class: 'stepper-row' }, [h('div', { class: 'lbl' }, [h('span', { text: label }), o.hint ? h('small', { text: o.hint }) : null]),
  h('div', { class: 'stepper', dir: 'ltr' }, [h('button', { class: 'round', type: 'button', id: o.id ? o.id + 'Dec' : null, 'aria-label': o.decLabel || label + ' −', disabled: o.decOff, text: '−', onclick: dec }),
    h('output', { class: 'val', id: o.id ? o.id + 'Val' : null, dir: 'auto', 'aria-live': 'polite', text: value }),
    h('button', { class: 'round', type: 'button', id: o.id ? o.id + 'Inc' : null, 'aria-label': o.incLabel || label + ' +', disabled: o.incOff, text: '+', onclick: inc })])]);
function refocus(id) { if (!id) return; const f = $(id); if (f && !f.disabled) f.focus(); else { const ttl = $('sheetTitle'); if (ttl) ttl.focus(); } }

function openTable(id) {
  const r = rowOf(id, now());
  if (r.phase === 'seated' || r.phase === 'ending' || r.phase === 'over') openSheet((sh) => tableSheet(sh, id)); else openSeat(id);
}
function openSeat(id) { openSheet((sh) => seatSheet(sh, id)); }
function seatSheet(sh, id) {
  const tb = tableById(L, id), n0 = now(), fr = frameFor({ timers: S, frames: R.frames, peaks: R.peaks, layout: L }, id, n0), hold = holdAt(B, id, n0);
  const winner = hold ? hold.bids.find((b) => b.id === hold.winner) : null;
  const st = { party: winner ? winner.party : Math.min(tb.seats, Math.max(2, tb.minParty)), minutes: winner ? Math.round((hold.end - Math.max(n0, hold.start)) / MIN / 5) * 5 || fr.minutes : fr.minutes };
  st.minutes = Math.max(LIMITS.minutes[0], Math.min(LIMITS.minutes[1], st.minutes));
  let fid = null;
  const render = () => {
    sh.textContent = '';
    sh.append(head(t('seat') + ' · ' + tFull(id), t.count('upTo', tb.seats)),
      hold ? h('p', { class: 'note', text: t('heldNote', { from: hm(hold.start), to: hm(hold.end) }) }) : null,
      stepper(t('party'), String(st.party), () => { st.party = Math.max(1, st.party - 1); fid = 'partyDec'; render(); }, () => { st.party = Math.min(tb.seats, st.party + 1); fid = 'partyInc'; render(); }, { id: 'party', decOff: st.party <= 1, incOff: st.party >= tb.seats, decLabel: t('fewer'), incLabel: t('more') }),
      stepper(t('frame'), t('minutes', { n: st.minutes }), () => { st.minutes = Math.max(LIMITS.minutes[0], st.minutes - 5); fid = 'frameDec'; render(); }, () => { st.minutes = Math.min(LIMITS.minutes[1], st.minutes + 5); fid = 'frameInc'; render(); },
        { id: 'frame', hint: st.minutes === fr.minutes ? t('why_' + fr.why.replace('-', '_'), { zone: zoneName(tb.zone) }) : null, decOff: st.minutes <= LIMITS.minutes[0], incOff: st.minutes >= LIMITS.minutes[1], decLabel: t('shorter'), incLabel: t('longer') }),
      h('p', { class: 'ends', id: 'seatEnds' }, [h('span', { class: 'big', text: st.minutes + '′' }), h('span', { class: 'side', text: t('until', { time: hm(now() + st.minutes * MIN) }) })]),
      h('div', { class: 'sh-acts' }, [h('button', { class: 'pill lead wide', type: 'button', id: 'seatGo', text: hold ? t('seatWinner') : t('seat'), onclick: () => { if (act('seat', id, { party: st.party, minutes: st.minutes })) closeSheet(); } }),
        h('button', { class: 'pill quiet', type: 'button', text: t('cancel'), onclick: closeSheet })]));
    refocus(fid); fid = null;
  };
  render();
  return (n) => { const e = sh.querySelector('#seatEnds .side'); if (e) e.textContent = t('until', { time: hm(n + st.minutes * MIN) }); };
}
function tableSheet(sh, id) {
  const big = h('span', { class: 'big' }), side = h('span', { class: 'side' }), meta = h('p', { class: 'meta' });
  sh.append(head(tFull(id), null), h('p', { class: 'ends' }, [big, side]), meta,
    h('div', { class: 'sh-acts' }, [h('button', { class: 'pill lead wide', type: 'button', id: 'extendGo', onclick: () => act('extend', id), text: t('extend', { n: S.settings.extendBy }) }),
      h('button', { class: 'pill', type: 'button', id: 'endGo', text: t('endNow'), onclick: () => { if (act('free', id)) closeSheet(); } })]),
    h('div', { class: 'sh-acts' }, [h('button', { class: 'pill quiet wide', type: 'button', id: 'setGo', text: t('setIt'), onclick: () => { setTable(id, true).then(() => flash(t('flash_set'))); } })]));
  const upd = (n) => { const r = rowOf(id, n); if (!(r.phase === 'seated' || r.phase === 'ending' || r.phase === 'over')) { closeSheet(); return; } sh.setAttribute('data-phase', r.phase); big.textContent = r.text; side.textContent = r.sub; meta.textContent = t(r.phase); };
  upd(now()); return upd;
}
function openNewOrder() {
  const st = { items: new Set(['cappuccino']), table: null };
  openSheet((sh) => {
    const render = () => {
      sh.textContent = '';
      const items = h('div', { class: 'items', role: 'group', 'aria-label': t('newOrder') }, ITEMS.map(([id]) => h('button', { class: 'pill', type: 'button', 'data-item': id, 'aria-pressed': String(st.items.has(id)), text: itemName(id, lang), onclick: () => { if (st.items.has(id)) st.items.delete(id); else st.items.add(id); render(); const b = sh.querySelector('[data-item="' + id + '"]'); if (b) b.focus(); } })));
      const sel = h('select', { id: 'orderTable', 'aria-label': t('orderFor') }, [h('option', { value: '', text: t('noTable') })].concat(L.tables.map((tb) => h('option', { value: tb.id, text: tFull(tb.id), selected: st.table === tb.id }))));
      sel.addEventListener('change', () => { st.table = sel.value || null; });
      sh.append(head(t('newOrder'), t('itemsDemo')), items, h('label', { class: 'field' }, [t('orderFor'), sel]),
        h('div', { class: 'sh-acts' }, [h('button', { class: 'pill lead wide', type: 'button', id: 'orderGo', disabled: !st.items.size, text: t('addOrder'), onclick: () => { try { O = addOrder(O, { items: [...st.items], table: st.table, now: now() }).state; saveO(); closeSheet(); paint(); } catch (e) { flash(e.message); } } }),
          h('button', { class: 'pill quiet', type: 'button', text: t('cancel'), onclick: closeSheet })]));
    };
    render();
  });
}
function openCustomize() {
  openSheet((sh) => {
    const render = (fid) => {
      sh.textContent = '';
      const list = h('div', { class: 'tables-set' });
      UI.order.forEach((p, i) => list.appendChild(h('div', { class: 'prow' }, [h('b', { text: t({ tables: 'pTables', orders: 'pOrders', bids: 'pBids', alerts: 'pAlerts' }[p]) }), h('span', { class: 'ctl' }, [
        h('button', { class: 'pill', type: 'button', id: 'show-' + p, 'aria-pressed': String(!!UI.on[p]), text: t('show'), onclick: () => { UI.on[p] = !UI.on[p]; saveUI(); renderPanels(); render('show-' + p); } }),
        h('button', { class: 'round', type: 'button', id: 'up-' + p, 'aria-label': t('up') + ' · ' + p, disabled: i === 0, text: '↑', onclick: () => { UI.order.splice(i - 1, 0, UI.order.splice(i, 1)[0]); saveUI(); renderPanels(); render('up-' + p); } }),
        h('button', { class: 'round', type: 'button', id: 'down-' + p, 'aria-label': t('down') + ' · ' + p, disabled: i === UI.order.length - 1, text: '↓', onclick: () => { UI.order.splice(i + 1, 0, UI.order.splice(i, 1)[0]); saveUI(); renderPanels(); render('down-' + p); } })])])));
      sh.append(head(t('custTitle'), t('custHint')), list,
        h('div', { class: 'prow' }, [h('b', { text: t('density') }), h('span', { class: 'ctl' }, ['roomy', 'compact'].map((d) => h('button', { class: 'pill', type: 'button', id: 'den-' + d, 'aria-pressed': String(UI.density === d), text: t(d), onclick: () => { UI.density = d; saveUI(); renderPanels(); render('den-' + d); } })))]),
        h('div', { class: 'sh-acts' }, [h('button', { class: 'pill lead wide', type: 'button', text: t('done'), onclick: closeSheet })]));
      refocus(fid);
    };
    render();
  });
}
function openSettings() {
  openSheet((sh) => {
    const saveRules = () => live.put('rules', { peaks: R.peaks, frames: R.frames });
    const render = (fid) => {
      sh.textContent = '';
      const c = S.settings, frames = R.frames, w0 = R.peaks.windows[0] || { days: [0, 1, 2, 3, 4, 5, 6], from: '10:00', to: '13:00' };
      const zoneRow = (z, map, key, idp) => { const v = map[z.id]; const shown = v == null ? c.minutes : v;
        return h('div', { class: 'trow' + (v == null ? '' : ' own') }, [h('span', { class: 'tn' }, [h('b', { text: z.name[lang] || z.name.en }), v == null ? h('small', { text: t('sSame') }) : null]),
          h('div', { class: 'stepper sm', dir: 'ltr' }, [h('button', { class: 'round', type: 'button', id: idp + z.id + 'Dec', 'aria-label': t('shorter') + ' · ' + (z.name[lang] || z.name.en), text: '−', disabled: shown - 5 < LIMITS.minutes[0], onclick: () => setFrame(key, z.id, shown - 5, idp + z.id + 'Dec') }),
            h('output', { class: 'val' + (v == null ? ' muted' : ''), text: t('minutes', { n: shown }) }),
            h('button', { class: 'round', type: 'button', id: idp + z.id + 'Inc', 'aria-label': t('longer') + ' · ' + (z.name[lang] || z.name.en), text: '+', disabled: shown + 5 > LIMITS.minutes[1], onclick: () => setFrame(key, z.id, shown + 5, idp + z.id + 'Inc') })])]); };
      const setFrame = (key, zid, m, f) => { const next = JSON.parse(JSON.stringify(R.frames)); if (key === 'zones') next.zones[zid] = m; else next.peak.zones[zid] = m; const v = validateFrames(next, L); if (v.ok) { R.frames = v.frames; saveRules(); render(f); paint(); } };
      const setWin = (patch, f) => { const v = validatePeaks(Object.assign({}, R.peaks, { windows: [Object.assign({}, w0, patch)] })); if (v.ok) { R.peaks = v.peaks; saveRules(); render(f); paint(); } else flash(v.errors[0]); };
      const fromI = h('input', { type: 'time', id: 'pkFrom', value: w0.from, step: 900, 'aria-label': t('sPeaks') + ' · ' + t('sFrom') }), toI = h('input', { type: 'time', id: 'pkTo', value: w0.to, step: 900, 'aria-label': t('sPeaks') + ' · ' + t('sTo') });
      fromI.addEventListener('change', () => setWin({ from: fromI.value }, 'pkFrom')); toI.addEventListener('change', () => setWin({ to: toI.value }, 'pkTo'));
      const bidRule = (patch, f) => { const r = configureBids(B, patch, L); if (r.ok) { B = r.state; saveB(); render(f); paint(); } else flash(r.error); };
      sh.append(head(t('setTitle'), t('venue') + ' · ' + t('peakExample')),
        h('h3', { class: 'sec-h', text: t('sFrames') }),
        stepper(t('sDefault'), t('minutes', { n: c.minutes }), () => { S = configure(S, { minutes: c.minutes - 5 }); saveS(); render('setMinDec'); }, () => { S = configure(S, { minutes: c.minutes + 5 }); saveS(); render('setMinInc'); }, { id: 'setMin', decOff: c.minutes - 5 < LIMITS.minutes[0], incOff: c.minutes + 5 > LIMITS.minutes[1] }),
        h('div', { class: 'lbl sec' }, [h('span', { text: t('sZone') })]), h('div', { class: 'tables-set' }, L.zones.map((z) => zoneRow(z, frames.zones, 'zones', 'fz-'))),
        h('div', { class: 'lbl sec' }, [h('span', { text: t('sPeakZone') })]), h('div', { class: 'tables-set' }, L.zones.map((z) => zoneRow(z, frames.peak.zones, 'peak', 'fp-'))),
        h('h3', { class: 'sec-h', text: t('sPeaks') }), h('div', { class: 'field' }, [t('sFrom'), fromI, t('sTo'), toI]),
        h('div', { class: 'toggles', role: 'group', 'aria-label': t('sDays') }, t.list('days').map((d, i) => h('button', { class: 'pill', type: 'button', id: 'day-' + i, 'aria-pressed': String(w0.days.includes(i)), text: d, onclick: () => { const days = w0.days.includes(i) ? w0.days.filter((x) => x !== i) : w0.days.concat([i]); if (days.length) setWin({ days }, 'day-' + i); } }))),
        h('h3', { class: 'sec-h', text: t('sBids') }), h('div', { class: 'lbl' }, [h('span', { text: t('sBidTables') })]),
        h('div', { class: 'toggles' }, L.tables.filter((tb) => tb.bookable).map((tb) => h('button', { class: 'pill', type: 'button', id: 'bt-' + tb.id, 'aria-pressed': String(B.rules.tables.includes(tb.id)), text: tFull(tb.id), onclick: () => bidRule({ tables: B.rules.tables.includes(tb.id) ? B.rules.tables.filter((x) => x !== tb.id) : B.rules.tables.concat([tb.id]) }, 'bt-' + tb.id) }))),
        stepper(t('sMin'), '₪' + B.rules.min, () => bidRule({ min: Math.max(1, B.rules.min - 5) }, 'bminDec'), () => bidRule({ min: B.rules.min + 5 }, 'bminInc'), { id: 'bmin', decOff: B.rules.min <= 5 }),
        stepper(t('sStep'), '₪' + B.rules.step, () => bidRule({ step: Math.max(1, B.rules.step - 1) }, 'bstepDec'), () => bidRule({ step: B.rules.step + 1 }, 'bstepInc'), { id: 'bstep', decOff: B.rules.step <= 1 }),
        h('div', { class: 'toggles' }, [h('button', { class: 'pill', type: 'button', id: 'bCredit', 'aria-pressed': String(B.rules.credit), text: t('sCredit'), onclick: () => bidRule({ credit: !B.rules.credit }, 'bCredit') })]),
        h('p', { class: 'note', text: t('bidsSample') }),
        h('div', { class: 'sh-acts' }, [h('button', { class: 'pill lead wide', type: 'button', text: t('done'), onclick: closeSheet }),
          h('button', { class: 'pill quiet', type: 'button', id: 'resetDemo', text: t('resetDemo'), onclick: () => { live.drop('clock'); clk = demoClock(live, speed); R = { peaks: validatePeaks(EXAMPLE.peaks).peaks, frames: validateFrames(EXAMPLE.frames, L).frames }; live.drop('rules'); loadAll(true); setTables.clear(); log.length = 0; seen.clear(); closeSheet(); mountStage(want3d() ? '3d' : '2d'); paint(); } })]));
      refocus(fid);
    };
    render();
  });
}

/* ---------- edit mode ---------- */
let H = null;
function editOp(fn, select) {
  if (!editing) return;
  let next; try { next = fn(H.present); } catch (e) { flash(e.message); return; }
  if (next && next.layout) { select = next.id; next = next.layout; }
  H = E.commit(H, next); applyLayout(next); if (select !== undefined) selected = select; if (stage) stage.select(selected); renderEdit();
}
function applyLayout(next) {
  L = next; const ids = L.tables.map((x) => x.id);
  const v = validateState(S, ids); if (v.ok) S = v.state;
  const b = validateBids(JSON.parse(JSON.stringify(B)), L); if (b.ok) B = b.state;
  [...setTables].forEach((id) => { if (!ids.includes(id)) setTables.delete(id); });
  if (stage) stage.setLayout(L); paintStage(); renderPanels();
}
function editKey(e, id) {
  if (!editing || !id) return false;
  const k = e.key, step = e.shiftKey ? .5 : .05, tb = tableById(L, id); if (!tb) return false;
  /* arrows move the table as you see it: the plan has the street at the bottom (z grows upwards) */
  if (k === 'ArrowLeft') editOp((l) => E.moveTable(l, id, tb.x - step, tb.z), id);
  else if (k === 'ArrowRight') editOp((l) => E.moveTable(l, id, tb.x + step, tb.z), id);
  else if (k === 'ArrowUp') editOp((l) => E.moveTable(l, id, tb.x, tb.z + step), id);
  else if (k === 'ArrowDown') editOp((l) => E.moveTable(l, id, tb.x, tb.z - step), id);
  else if (k === 'r' || k === 'R') editOp((l) => E.rotateTable(l, id, e.shiftKey ? -15 : 15), id);
  else if (k === 'Delete' || k === 'Backspace') editOp((l) => E.removeTable(l, id), null);
  else return false;
  return true;
}
function renderEdit() {
  const bar = $('editbar'); bar.hidden = !editing; if (!editing) return;
  keep(() => {
    bar.textContent = '';
    const tb = selected ? tableById(L, selected) : null, ws = E.warnings(L), mine = ws.filter((w, i) => ws.findIndex((x) => x.id === w.id && x.type === w.type) === i);
    const btn = (id, text, fn, o = {}) => h('button', { class: 'pill' + (o.lead ? ' lead' : ''), type: 'button', id, 'data-k': id, disabled: o.off, 'aria-pressed': o.pressed == null ? null : String(o.pressed), text, onclick: fn });
    bar.append(
      h('div', { class: 'line' }, [h('b', { text: t('editTitle') }), ...['round2', 'round3', 'square2', 'long4', 'lounge'].map((k) => btn('add-' + k, '+ ' + t('k' + k[0].toUpperCase() + k.slice(1)), () => editOp((l) => E.addTable(l, k, tb ? { x: tb.x + 1.2, z: tb.z } : {})))),
        btn('undoBtn', t('undo'), () => { H = E.undo(H); applyLayout(H.present); renderEdit(); }, { off: !H.past.length }), btn('redoBtn', t('redo'), () => { H = E.redo(H); applyLayout(H.present); renderEdit(); }, { off: !H.future.length })]),
      tb ? h('div', { class: 'line', 'data-sel': tb.id }, [h('b', { text: tFull(tb.id) }),
        btn('rotBtn', t('rotate'), () => editOp((l) => E.rotateTable(l, tb.id, 15), tb.id)), btn('dupBtn', t('dup'), () => editOp((l) => E.duplicateTable(l, tb.id))), btn('delBtn', t('del'), () => editOp((l) => E.removeTable(l, tb.id), null)),
        stepper(t('seats'), String(tb.seats), () => editOp((l) => E.setSeats(l, tb.id, { seats: tb.seats - 1 }), tb.id), () => editOp((l) => E.setSeats(l, tb.id, { seats: tb.seats + 1, maxParty: tb.maxParty === tb.seats ? tb.seats + 1 : tb.maxParty }), tb.id), { id: 'eSeats', decOff: tb.seats <= 1, incOff: tb.seats >= 40 }),
        stepper(t('minParty'), String(tb.minParty), () => editOp((l) => E.setSeats(l, tb.id, { minParty: tb.minParty - 1 }), tb.id), () => editOp((l) => E.setSeats(l, tb.id, { minParty: tb.minParty + 1 }), tb.id), { id: 'eMin', decOff: tb.minParty <= 1, incOff: tb.minParty >= tb.maxParty }),
        stepper(t('maxParty'), String(tb.maxParty), () => editOp((l) => E.setSeats(l, tb.id, { maxParty: tb.maxParty - 1 }), tb.id), () => editOp((l) => E.setSeats(l, tb.id, { maxParty: tb.maxParty + 1 }), tb.id), { id: 'eMax', decOff: tb.maxParty <= tb.minParty, incOff: tb.maxParty >= tb.seats }),
        (() => { const s = h('select', { id: 'eZone', 'aria-label': t('zone') }, L.zones.map((z) => h('option', { value: z.id, text: z.name[lang] || z.name.en, selected: z.id === tb.zone }))); s.addEventListener('change', () => editOp((l) => E.setZone(l, tb.id, s.value), tb.id)); return s; })()])
        : h('p', { class: 'note', text: t('pick') }),
      h('p', { class: 'warns' + (mine.length ? '' : ' ok'), id: 'warns', 'aria-live': 'polite', text: mine.length ? mine.map((w) => w.type === 'overlap' ? t('wOverlap', { a: tFull(w.id), b: tFull(w.with) }) : t('wOutside', { a: tFull(w.id) })).join(' · ') : t('wOk') }),
      h('div', { class: 'line' }, [btn('saveBtn', t('save') + (H.past.length ? ' · ' + t('unsaved') : ''), saveFloor, { lead: true }), btn('resetBtn', t('resetLima'), () => editOp(() => validateLayout(DEMOS[venue]).layout)),
        btn('exportBtn', t('export'), exportFloor), btn('topBtn', t('top'), () => { topView = !topView; mountStage(want3d() ? '3d' : '2d'); renderEdit(); }, { pressed: stageKind === '2d' }), btn('doneBtn', t('done'), () => toggleEdit(false))]));
  });
}
function saveFloor() {
  const v = validateLayout(H.present); if (!v.ok) { flash(t('notSaved', { why: v.errors[0] })); return; }
  live.put('layout', v.layout); edited = true; H = E.createHistory(v.layout); flash(t('saved')); renderEdit();
  saveS(); saveB();
}
function exportFloor() {
  const blob = new Blob([JSON.stringify(H.present, null, 2) + '\n'], { type: 'application/json' }), a = h('a', { href: URL.createObjectURL(blob), download: venue + '.layout.json' });
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function toggleEdit(on) {
  editing = on; $('editBtn').setAttribute('aria-pressed', String(on)); document.documentElement.classList.toggle('editing', on);
  if (on) { H = E.createHistory(L); selected = null; } else { selected = null; }
  if (stage) { stage.edit(on); stage.select(selected); }
  renderEdit(); paintStage();
}

/* ---------- the clock ---------- */
let auto = speed > 1, autoAt = 0;
function autoplay(n) {
  if (!auto) return;
  if (!autoAt) autoAt = n;
  if (n - autoAt < 2 * MIN) return; autoAt = n;
  const w = O.orders.filter((o) => o.phase !== 'picked');
  try {
    if (w.length < 5) { const pick = ITEMS[Math.floor(n / MIN) % ITEMS.length][0], tbl = L.tables[Math.floor(n / MIN / 3) % L.tables.length].id; O = addOrder(O, { items: [pick], table: Math.floor(n / MIN) % 2 ? tbl : null, now: n }).state; }
    const old = w.sort((a, b) => a.at.new - b.at.new)[0];
    if (old) { const to = old.phase === 'new' ? 'preparing' : old.phase === 'preparing' ? 'ready' : 'picked'; O = advance(O, old.id, to, { now: n }).state; if (to === 'ready') note(t('aReady', { no: old.no }), 'ready'); }
    saveO();
  } catch (e) { /* the next minute tries again */ }
}
function step() {
  if (!L) return;
  const n = now(), r = tick(S, n); if (r.state !== S) { S = r.state; saveS(); }
  r.events.forEach((e) => { if (e.type === 'over') { note(t('aTimeUp', { table: tFull(e.tableId) }), 'over'); alerts.chime(); alerts.buzz(); alerts.notify(t('aTimeUp', { table: tFull(e.tableId) }), t('timeUpBody', { party: '' }), 'mana-floor-' + e.tableId); } if (e.type === 'freed') setTable(e.tableId, false); });
  const b = tickBids(B, n); if (b.state !== B) { B = b.state; saveB(); }
  b.events.forEach((e) => { if (e.type === 'won') { const a = B.auctions[e.key], w = a.bids.find((x) => x.id === a.winner); note(t('aWon', { table: tFull(a.table), n: w.amount }), 'bid'); setTable(a.table, true); } });
  autoplay(n);
  paint();
}
let timer = 0;
function schedule() { clearTimeout(timer); timer = setTimeout(() => { step(); schedule(); }, TEST ? 1000 : 1000); }

/* ---------- painting ---------- */
let toastKey = '';
function paint() {
  if (!L) return;
  const n = now();
  $('clock').textContent = hm(n); $('clock').dateTime = new Date(n).toISOString();
  paintStage(); renderPanels(); if (editing) { /* the bar is rebuilt by edits only */ }
  const up = rows(n).filter((r) => r.phase === 'over' && !seen.has(r.id + ':' + S.tables[r.id].n + ':' + (S.tables[r.id].minutes + S.tables[r.id].extended)));
  const key = up.map((r) => r.id).join(',') + lang;
  if (key !== toastKey) {
    toastKey = key; const box = $('toasts'); box.textContent = '';
    up.slice(0, 2).forEach((r) => box.appendChild(h('div', { class: 'toast glass', role: 'alert', 'data-id': r.id }, [h('span', { class: 'beat', 'aria-hidden': 'true' }),
      h('div', { class: 'tx' }, [h('b', { text: t('aTimeUp', { table: tFull(r.id) }) }), h('small', { text: t('timeUpBody', { party: t.count('guests', r.s.party) }) })]),
      h('div', { class: 'acts' }, [h('button', { class: 'pill lead', type: 'button', 'data-act': 'extend', text: t('extend', { n: S.settings.extendBy }), onclick: () => act('extend', r.id) }),
        h('button', { class: 'pill', type: 'button', 'data-act': 'free', text: t('freeIt'), onclick: () => act('free', r.id) }),
        h('button', { class: 'pill quiet', type: 'button', 'data-act': 'seen', text: t('seen'), onclick: () => { const x = S.tables[r.id]; seen.add(r.id + ':' + x.n + ':' + (x.minutes + x.extended)); toastKey = ''; paint(); } })])])));
  }
  alerts.title(t('venue') + ' · ' + t('boardTitle'), up.length > 0);
  if (sheetUpdate) sheetUpdate(n);
}
function shell() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  $('title').textContent = t('venue') + ' · ' + t('boardTitle'); $('draft').textContent = t('draft');
  $('clockLbl').textContent = t('demoClock') + (clk && clk.speed !== 1 ? ' · ' + t('speed', { n: clk.speed }) : '');
  $('editBtn').textContent = t('edit'); $('custBtn').textContent = t('customize'); $('phoneBtn').textContent = t('phone');
  $('gearBtn').setAttribute('aria-label', t('settings')); $('gearBtn').title = t('settings');
  $('alertsLbl').textContent = alerts.armed ? t('alertsOn') : t('alertsOff'); $('alertsBtn').setAttribute('aria-pressed', String(alerts.armed));
  $('langBtn').textContent = t('lang'); $('langBtn').setAttribute('aria-label', t('langLabel')); $('langBtn').lang = lang === 'he' ? 'en' : 'he';
  $('demoLine').textContent = t('demo'); $('credit').textContent = t('credit');
  $('views').setAttribute('aria-label', t('views'));
}
/* the guest's phone, in a phone frame (loaded on the first tap) */
function togglePhone() {
  const ph = $('phone'), on = ph.hidden; ph.hidden = !on; $('phoneBtn').setAttribute('aria-pressed', String(on));
  if (on && !ph.querySelector('iframe')) {
    const q = new URLSearchParams({ demo: venue, table: 't3', embed: '1', lang }); if (GL) q.set('gl', GL); if (TEST) q.set('test', '1'); if (reduce) q.set('motion', 'reduce');
    $('phoneIn').appendChild(h('iframe', { src: 'guest.html?' + q, title: t('phone'), allow: 'autoplay' }));
  }
}

/* ---------- boot ---------- */
window.__floor = { stageKind: null };
document.documentElement.classList.toggle('reduce', reduce); document.documentElement.classList.toggle('test', TEST);
if (!L) {
  shell(); $('grid').textContent = ''; $('grid').appendChild(h('div', { class: 'none glass' }, [h('h2', { text: lang === 'he' ? 'אין כאן בית קפה.' : 'There is no café here.' }), h('p', { text: '?demo=lima' })]));
} else {
  shell(); renderPanels(); mountStage(want3d() ? '3d' : '2d'); step(); schedule();
  live.on((m) => {
    if (m.part === 'bids') { const v = live.get('bids') && validateBids(live.get('bids'), L); if (v && v.ok) { const before = B; B = v.state; Object.values(B.auctions).forEach((a) => { const o = before.auctions[a.key]; if (a.bids.length > (o ? o.bids.length : 0)) { const last = a.bids[a.bids.length - 1]; note(t('aBid', { table: tFull(a.table), n: last.amount }), 'bid'); if (a.bids.length > 1) note(t('aOutbid', { table: tFull(a.table) }), 'bid'); } }); paint(); } }
    if (m.part === 'set' && m.table) setTable(m.table, true);
  });
  $('editBtn').addEventListener('click', () => toggleEdit(!editing));
  $('custBtn').addEventListener('click', (e) => openCustomize(e.currentTarget));
  $('gearBtn').addEventListener('click', () => openSettings());
  $('phoneBtn').addEventListener('click', togglePhone);
  $('alertsBtn').addEventListener('click', async () => { await alerts.arm(); shell(); });
  $('scrim').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSheet(); return; }
    if (!editing || !$('sheet').hidden || /INPUT|SELECT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); H = e.shiftKey ? E.redo(H) : E.undo(H); applyLayout(H.present); renderEdit(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); H = E.redo(H); applyLayout(H.present); renderEdit(); return; }
    if (selected && e.target && !(e.target.closest && e.target.closest('.pp-t, .pl-canvas')) && editKey(e, selected)) e.preventDefault();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { step(); schedule(); } });
}
$('langBtn').addEventListener('click', () => { lang = lang === 'he' ? 'en' : 'he'; mem.set('halom-menu-lang', lang); const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u); closeSheet(); shell(); toastKey = ''; if (stage) mountStage(stageKind); paint(); renderEdit(); });
requestAnimationFrame(() => document.documentElement.classList.add('in'));
Object.assign(window.__floor, {
  layout: () => L, state: () => ({ S, O, B, R }), now, rows: () => rows(now()).map((r) => ({ id: r.id, phase: r.phase, text: r.text })), stage: () => stage, history: () => H, edited: () => edited, log: () => log.slice(),
  advance(ms) { const n = now(); clk = { real: Date.now(), virt: n + ms, speed: clk.speed }; live.put('clock', clk); step(); },
  step, paint, select: (id) => selectTable(id, false), editOp: (fn) => editOp(fn), E
});
