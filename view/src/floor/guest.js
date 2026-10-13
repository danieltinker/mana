/* The guest's phone at Café Lima, opened from the QR on the table (the table is in the address):
   floor/guest.html?demo=lima&table=t3[&lang=en][&gl=off][&motion=reduce][&embed=1]. The 3D place starts above the whole
   café and glides down to the guest's table, which then sets itself. "Waiting for an order?": the receipt's number (or
   the order the counter attached to this table); when the barista taps Ready on the board, the phone chimes (WebAudio,
   no file; sound only after one tap, browsers block it before), vibrates where it can, shows a full-screen glass card and,
   if the guest allowed it, a system notification. At peak, the guest can bid for the tables the owner opened for it
   (sample amounts, nothing is charged). Entry of view/floor-guest.js. It talks to the board through live.js; a locked
   phone needs Web Push in production (seating/README.md). */
import { tableById, zoneById, tableNo } from '../../../seating/validate.mjs';
import { openSlots } from '../../../seating/peaks.mjs';
import { placeBid, auctionFor, leaderOf, minNext, standing, tickBids, validateBids } from '../../../seating/bids.mjs';
import { byNumber, forTable, validateOrders } from '../../../seating/orders.mjs';
import { createAlerts } from '../host/alerts.js';
import { createPlan } from '../room/plan2d.js';
import { GSTR, makeT, itemName } from './i18n.js';
import { createLive, DEMOS, loadLayout, demoClock, clockNow, loadRules } from './live.js';

const Q = new URLSearchParams(location.search), $ = (id) => document.getElementById(id);
const TEST = Q.get('test') === '1', GL = Q.get('gl'), EMBED = Q.get('embed') === '1', FILM = Q.get('film') === '1', LOW = Q.get('quality') === 'low';
const reduce = Q.get('motion') === 'reduce' || (Q.get('motion') !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const storage = (() => { try { return window.localStorage; } catch (e) { return null; } })();
const sess = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();
const sget = (k) => { try { return sess.getItem(k); } catch (e) { return null; } }, sset = (k, v) => { try { sess.setItem(k, v); } catch (e) { /* fine */ } };
let lang = Q.get('lang') === 'en' ? 'en' : 'he';
const t = makeT(GSTR, () => lang);
const venue = (Q.get('demo') || 'lima').replace(/[^a-z0-9-]/g, ''), tableId = (Q.get('table') || '').replace(/[^a-z0-9_-]/g, '');
const pad2 = (n) => (n < 10 ? '0' : '') + n, hm = (ms) => { const d = new Date(ms); return '\u2066' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + '\u2069'; };      /* times and ranges stay left to right inside Hebrew */
const left = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + pad2(s % 60); };
function h(tag, attrs, kids) {
  const e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach((k) => { const v = attrs[k]; if (v == null || v === false) return; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
  (kids || []).forEach((c) => { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}

const live = createLive(venue, { storage });
const got = DEMOS[venue] ? loadLayout(live, venue) : null;
let L = got ? got.layout : null;
let clk = L ? demoClock(live, null) : null;
const now = () => clockNow(clk);
let R = L ? loadRules(live, L) : null, O = null, B = null;
const me = (() => { const k = 'mana-floor:me:' + venue + ':' + tableId; let id = sget(k); if (!id) { id = 'guest-' + tableId + '-' + Math.random().toString(36).slice(2, 8); sset(k, id); } return id; })();
let watching = Number(sget('mana-floor:watch:' + venue + ':' + tableId)) || null;
const shownReady = new Set((sget('mana-floor:ready:' + venue + ':' + tableId) || '').split(',').filter(Boolean));
let party = 2, stage = null, flown = false, wonShown = new Set();
const alerts = createAlerts({ reduce });
const zoneName = (zid) => { const z = zoneById(L, zid); return z ? (z.name[lang] || z.name.en) : zid; };
const tFull = (id) => { const tb = tableById(L, id); return tb ? (lang === 'he' ? 'שולחן ' : 'Table ') + tableNo(L, id) + ' · ' + zoneName(tb.zone) : id; };
/* everything from storage is checked; anything unreadable leaves the phone with an empty queue and no bids, never broken */
function read() {
  try { const ov = live.get('orders') && validateOrders(live.get('orders')); O = ov && ov.ok ? ov.state : { v: 1, seq: 0, orders: [] }; } catch (e) { O = { v: 1, seq: 0, orders: [] }; }
  try { const bv = live.get('bids') && validateBids(live.get('bids'), L); B = bv && bv.ok ? bv.state : null; } catch (e) { B = null; }
  try { const c = live.get('clock'); if (c && Number.isFinite(c.virt) && Number.isFinite(c.real) && c.speed >= 1) clk = c; } catch (e) { /* keep the clock */ }
  try { R = loadRules(live, L); } catch (e) { /* keep the rules */ }
}
const errText = (r) => { const s = t('err_' + (r && r.code), { n: r && r.n != null ? r.n : '' }); return s === 'err_' + (r && r.code) ? t('err_refused') : s; };
/* a quiet voice for what changed: the order's state, the guest's standing in a bid (never the seconds) */
let lastSaid = '';
function say(text) { if (!text || text === lastSaid) return; lastSaid = text; const el = $('gStatus'); if (el) { el.textContent = ''; setTimeout(() => { el.textContent = text; }, 30); } }

/* ---------- the order ---------- */
function myOrder() {
  if (watching) return byNumber(O, watching);
  const att = forTable(O, tableId); return att.length ? att[att.length - 1] : null;
}
/* the order card is built once (its number field keeps what the guest is typing, and the focus); updates change only the
   title, the status and the words */
let orderUI = null;
function buildOrder() {
  const box = $('orderCard'); box.textContent = '';
  const title = h('h2', {}), hint = h('p', {}), state = h('div', { class: 'gstate', id: 'orderState', hidden: true }, [h('span', { class: 'no' }), h('span', {}, [h('b', {}), h('br'), h('small', {})])]);
  const inp = h('input', { id: 'orderNo', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '2', placeholder: '23', value: watching || '' });
  const go = () => { const n = Math.round(Number(inp.value)); if (n >= 1 && n <= 99) { watching = n; sset('mana-floor:watch:' + venue + ':' + tableId, String(n)); arm(); renderOrder(); checkReady(); if (!byNumber(O, n)) flash(t('notFound')); } };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const follow = h('button', { class: 'pill lead', type: 'button', id: 'followBtn', onclick: go });
  const sound = h('button', { class: 'pill soundchip', type: 'button', id: 'soundBtn', onclick: () => { arm(); setTimeout(renderOrder, 60); } });      /* the permission prompt may stay open: the button answers at once */
  box.append(title, hint, state, h('div', { class: 'gnum' }, [inp, follow]), sound);
  orderUI = { title, hint, state, inp, follow, sound };
}
function renderOrder() {
  if (!orderUI) buildOrder();
  const u = orderUI, o = myOrder(), attached = o && !watching, word = o ? t({ new: 'gNew', preparing: 'gPrep', ready: 'gReady', picked: 'gPicked' }[o.phase]) : '';
  u.title.textContent = o ? t('yourOrder', { no: o.no }) : t('orderTitle');
  u.hint.textContent = o ? (attached ? t('attached') : '') : t('orderHint'); u.hint.hidden = !u.hint.textContent;
  u.state.hidden = !o;
  if (o) { u.state.setAttribute('data-phase', o.phase); u.state.querySelector('.no').textContent = '#' + o.no; u.state.querySelector('b').textContent = word; u.state.querySelector('small').textContent = o.items.map((i) => itemName(i, lang)).join(' · '); say(t('sOrder', { no: o.no, state: word })); }
  u.inp.setAttribute('aria-label', t('numLabel')); u.follow.textContent = t('follow');
  u.sound.setAttribute('aria-pressed', String(alerts.armed)); u.sound.textContent = alerts.armed ? t('soundOn') : t('sound');
}
async function arm() { if (!alerts.armed) await alerts.arm(); }
function checkReady() {
  const o = myOrder(); if (!o || o.phase !== 'ready') return;
  const key = o.id + ':' + o.at.ready; if (shownReady.has(key)) return;
  shownReady.add(key); sset('mana-floor:ready:' + venue + ':' + tableId, [...shownReady].join(','));
  /* the beep: three soft chimes; a buzz; a notice if allowed; the full-screen card */
  alerts.chime(); setTimeout(() => alerts.chime(.8), 700); setTimeout(() => alerts.chime(.6), 1400);
  try { if (!reduce && navigator.vibrate) navigator.vibrate([180, 90, 180, 90, 260]); } catch (e) { /* no motor */ }
  alerts.notify(t('notifTitle', { no: o.no }), t('notifBody'), 'mana-ready-' + o.id);
  const card = h('div', { class: 'ready', id: 'readyCard', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'readyT', 'aria-describedby': 'readyB' }, [
    h('div', { class: 'rcard glass' }, [h('div', { class: 'ring', 'aria-hidden': 'true', html: '' }), h('h2', { id: 'readyT', text: t('readyTitle') }), h('p', { class: 'big', text: '#' + o.no }), h('p', { id: 'readyB', text: t('readyBody', { no: o.no }) }),
      h('button', { class: 'pill lead wide', type: 'button', id: 'gotIt', text: t('gotIt'), onclick: () => { card.remove(); $('followBtn') && $('followBtn').focus(); } })])]);
  card.querySelector('.ring').innerHTML = '<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 16.5v-5a5.5 5.5 0 0 1 11 0v5l1.6 1.8H4.9z"/><path d="M10.2 20.6a2 2 0 0 0 3.6 0"/></svg>';
  const old = $('readyCard'); if (old) old.remove(); document.body.appendChild(card); $('gotIt').focus(); say(t('readyTitle') + ' · #' + o.no);
  document.title = '● ' + t('readyTitle');
}

/* ---------- bidding at peak ---------- */
function renderBids() {
  /* built aside, then merged: a card is replaced only when it changed; the countdown alone is updated in place, so a
     tap never lands on a button that is being swapped */
  const real = $('bidCard'), box = document.createElement('div'); if (!B) { real.hidden = true; return; }
  const n = now(), view = tickBids(B, n).state, slots = openSlots(R.peaks, n), mine = Object.values(view.auctions).filter((a) => a.bids.some((b) => b.guest === me));
  box.hidden = !(slots.length && view.rules.tables.length) && !mine.length;
  box.append(h('h2', { text: t('bidTitle') }), h('p', { text: t('bidHint') }));
  const list = [];
  view.rules.tables.forEach((id) => slots.forEach((sl) => list.push(auctionFor(view, id, sl))));
  mine.filter((a) => a.phase !== 'open').forEach((a) => { if (!list.some((x) => x.key === a.key)) list.unshift(a); });
  if (!list.length) box.append(h('p', { text: t('none') }));
  list.forEach((a) => {
    const lead = leaderOf(a), st = standing(a, me), win = a.phase === 'won' || a.phase === 'done' ? a.bids.find((b) => b.id === a.winner) : null, next = minNext(view, a);
    const tb = tableById(L, a.table); if (!tb) return;
    const stText = st === 'leading' ? t('leading') : st === 'outbid' ? t('outbid') : st === 'won' ? t('won', { table: zoneName(tb.zone), from: hm(a.start), to: hm(a.end) }) : st === 'lost' ? t('lost') : st === 'declined' ? (a.reasonCode === 'no-longer-open' ? t('noLongerOpen') : t('declinedG')) : '';
    if (st === 'leading') say(t('sLeading', { table: tFull(a.table) })); else if (st === 'outbid') say(t('sOutbid', { table: tFull(a.table) })); else if (st === 'won') say(t('sWon', { table: zoneName(tb.zone) }));
    /* would the bid be refused? then say why instead of offering the button */
    const dry = a.phase === 'open' && st !== 'leading' ? placeBid(view, { table: a.table, start: a.start, guest: me, party, amount: next }, { layout: L, peaks: R.peaks, now: n }) : null;
    const blocked = dry && !dry.ok ? (dry.code === 'one-table' ? t('leadingElsewhere') : dry.code === 'party' ? t('tooBig', { n: party }) : errText(dry)) : '';
    const card = h('div', { class: 'gbid', 'data-key': a.key, 'data-st': st, 'data-table': a.table }, [
      h('div', { class: 'top' }, [h('b', { text: tFull(a.table) }), h('span', { class: 'amt', text: lead ? '₪' + lead.amount : win ? '₪' + win.amount : '' })]),
      h('small', {}, ['\u2066' + hm(a.start) + '–' + hm(a.end) + '\u2069 · ' + (a.phase === 'open' ? (lead ? t('current', { n: lead.amount }) : t('start', { n: view.rules.min })) + ' · ' : ''), a.phase === 'open' ? h('span', { class: 'cd', text: t('closesIn', { t: left(a.closesAt - n) }) }) : null]),
      stText ? h('p', { class: 'st', text: stText + (st === 'won' && view.rules.credit ? ' · ' + t('creditG') : '') }) : null,
      a.phase === 'open' && st !== 'leading' && !blocked ? h('div', { class: 'acts' }, [h('button', { class: 'pill lead', type: 'button', 'data-act': 'bid', 'data-amount': next, text: t('bidBtn', { n: next }), onclick: () => bid(a, next) }), h('small', { text: t('forParty', { n: party }) })]) : null,
      blocked ? h('p', { class: 'note', 'data-blocked': dry.code, text: blocked }) : null]);
    box.append(card);
    if (st === 'won' && !wonShown.has(a.key)) { wonShown.add(a.key); if (stage) { stage.flyTo(a.table).then(() => stage.setTable(a.table, true)); } }
  });
  box.append(h('p', { class: 'note', text: t('bidSample') }));
  real.hidden = box.hidden;
  const sig = (el) => { const c = el.cloneNode(true); c.querySelectorAll('.cd').forEach((x) => { x.textContent = ''; }); return c.outerHTML; };
  const want = [...box.children], have = [...real.children];
  if (want.length !== have.length) { real.textContent = ''; want.forEach((el) => real.appendChild(el)); return; }
  want.forEach((el, i) => { if (sig(el) !== sig(have[i])) real.replaceChild(el, have[i]); else { const a = have[i].querySelector('.cd'), b = el.querySelector('.cd'); if (a && b && a.textContent !== b.textContent) a.textContent = b.textContent; } });
}
function bid(a, amount) {
  const raw = live.get('bids'), v = raw && validateBids(raw, L); if (!v || !v.ok) return;
  const r = placeBid(v.state, { table: a.table, start: a.start, guest: me, party, amount }, { layout: L, peaks: R.peaks, now: now() });
  if (!r.ok) { flash(errText(r)); return; }
  live.put('bids', r.state); B = r.state; renderBids();
}
function flash(msg) { const f = $('flash'); f.textContent = msg; f.hidden = false; clearTimeout(flash.tm); flash.tm = setTimeout(() => { f.hidden = true; }, 3500); }

/* ---------- the place: from above the café down to my table ---------- */
async function mountStage() {
  const host = $('gstage'); let s = null;
  if (GL !== 'off') {
    try { const { createPlace } = await import('../room/place.js'); s = createPlace(host, L, { reduced: reduce, test: TEST, lowPower: LOW, start: 'above', forceGL: GL === 'on', slowMs: 4000, label: here(), onTable: () => {}, onSlow: () => { if (stage) stage.dispose(); stage = createPlan(host, L, { lang }); paintStage(); window.__guest.stageKind = '2d'; } }); } catch (e) { s = null; }
  }
  stage = s || createPlan(host, L, { lang }); window.__guest.stageKind = s ? '3d' : '2d';
  paintStage();
  if (FILM) { window.__guest.landed = true; return; }                  /* a film drives the camera itself (stage.film) */
  if (!flown) { flown = true; await new Promise((r) => setTimeout(r, reduce || TEST ? 0 : 500)); await stage.flyTo(tableId, { ms: reduce ? 0 : 2600 }); await stage.setTable(tableId, true, { instant: reduce }); window.__guest.landed = true; }
}
function paintStage() {
  if (!stage) return;
  const n = now(), view = B ? tickBids(B, n).state : null, open = view ? new Set(view.rules.tables) : new Set();
  if (gone) return;
  stage.setRows(L.tables.map((tb) => ({ id: tb.id, phase: tb.id === tableId ? 'seated' : open.has(tb.id) && openSlots(R.peaks, n).length ? 'held' : 'free', text: tb.id === tableId ? t('back') : open.has(tb.id) && openSlots(R.peaks, n).length ? '₪' : '' })));
  stage.select(tableId);
}

const here = () => { const tb = tableById(L, tableId); return tb ? t('youAt', { n: tableNo(L, tableId), zone: zoneName(tb.zone) }) : t('noTable'); };
function shell() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  $('hello').textContent = t('hello'); $('youAt').textContent = here();
  $('gdemo').textContent = t('demo'); $('glang').textContent = t('lang'); $('glang').setAttribute('aria-label', t('langLabel'));
  document.title = t('hello') + ' · ' + here();
}
/* the owner removed this table (and saved): the phone says so plainly instead of breaking */
let gone = false;
function tableGone() {
  if (gone) return; gone = true;
  if (stage) { try { stage.dispose(); } catch (e) { /* gone already */ } stage = null; }
  $('gstage').querySelectorAll('canvas, svg.pl-plan, .pl-layer').forEach((x) => x.remove());
  $('orderCard').hidden = true; $('bidCard').hidden = true; $('youAt').textContent = t('noTable'); say(t('noTable'));
  window.__guest.gone = true;
}
function paint() { read(); if (!tableById(L, tableId)) { tableGone(); return; } renderOrder(); renderBids(); paintStage(); checkReady(); }

window.__guest = { stageKind: null, landed: false, me, stage: () => stage, now, party: (n) => { party = n; } };
document.documentElement.classList.toggle('reduce', reduce); document.documentElement.classList.toggle('embed', EMBED); document.documentElement.classList.toggle('test', TEST);
if (!L || !tableById(L, tableId)) { document.body.textContent = ''; document.body.appendChild(h('p', { class: 'none glass', style: 'margin:24px', text: (GSTR[lang] || GSTR.en).noTable })); }
else {
  read(); shell(); renderOrder(); renderBids(); mountStage(); checkReady();
  live.on((m) => { if (gone || !['orders', 'bids', 'clock', 'rules', 'layout'].includes(m.part)) return; if (m.part === 'layout') { let g = null; try { g = loadLayout(live, venue); } catch (e) { g = null; } if (g) { L = g.layout; if (!tableById(L, tableId)) { tableGone(); return; } if (stage) stage.setLayout(L); } } paint(); });
  setInterval(() => { if (!gone) renderBids(); }, 1000);
  $('glang').addEventListener('click', () => { lang = lang === 'he' ? 'en' : 'he'; const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u); shell(); if (gone) { $('youAt').textContent = t('noTable'); return; } renderOrder(); renderBids(); paintStage(); if (stage && stage.setLang) stage.setLang(lang, here()); });
}
requestAnimationFrame(() => document.documentElement.classList.add('in'));
