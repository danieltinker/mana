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
const TEST = Q.get('test') === '1', GL = Q.get('gl'), EMBED = Q.get('embed') === '1';
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
function read() {
  const ov = live.get('orders') && validateOrders(live.get('orders')); O = ov && ov.ok ? ov.state : { v: 1, seq: 0, orders: [] };
  const bv = live.get('bids') && validateBids(live.get('bids'), L); B = bv && bv.ok ? bv.state : null;
  const c = live.get('clock'); if (c && Number.isFinite(c.virt)) clk = c;
  R = loadRules(live, L);
}

/* ---------- the order ---------- */
function myOrder() {
  if (watching) return byNumber(O, watching);
  const att = forTable(O, tableId); return att.length ? att[att.length - 1] : null;
}
function renderOrder() {
  const box = $('orderCard'); box.textContent = '';
  const o = myOrder(), attached = o && !watching;
  box.append(h('h2', { text: o ? t('yourOrder', { no: o.no }) : t('orderTitle') }));
  if (o) {
    box.append(attached ? h('p', { text: t('attached') }) : null,
      h('div', { class: 'gstate', 'data-phase': o.phase, id: 'orderState' }, [h('span', { class: 'no', text: '#' + o.no }), h('span', {}, [h('b', { text: t({ new: 'gNew', preparing: 'gPrep', ready: 'gReady', picked: 'gPicked' }[o.phase]) }), h('br'), h('small', { text: o.items.map((i) => itemName(i, lang)).join(' · ') })])]));
  } else box.append(h('p', { text: t('orderHint') }));
  const inp = h('input', { id: 'orderNo', inputmode: 'numeric', pattern: '[0-9]*', maxlength: '2', 'aria-label': t('numLabel'), placeholder: '23', value: watching || '' });
  const go = () => { const n = Math.round(Number(inp.value)); if (n >= 1 && n <= 99) { watching = n; sset('mana-floor:watch:' + venue + ':' + tableId, String(n)); arm(); renderOrder(); checkReady(); if (!byNumber(O, n)) flash(t('notFound')); } };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  box.append(h('div', { class: 'gnum' }, [inp, h('button', { class: 'pill lead', type: 'button', id: 'followBtn', text: t('follow'), onclick: go })]),
    h('button', { class: 'pill soundchip', type: 'button', id: 'soundBtn', 'aria-pressed': String(alerts.armed), text: alerts.armed ? t('soundOn') : t('sound'), onclick: () => { arm(); setTimeout(() => { renderOrder(); const b = $('soundBtn'); if (b) b.focus(); }, 60); } }));      /* the permission prompt may stay open: the button answers at once */
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
  const old = $('readyCard'); if (old) old.remove(); document.body.appendChild(card); $('gotIt').focus();
  document.title = '● ' + t('readyTitle');
}

/* ---------- bidding at peak ---------- */
function renderBids() {
  const box = $('bidCard'); box.textContent = ''; if (!B) { box.hidden = true; return; }
  const n = now(), view = tickBids(B, n).state, slots = openSlots(R.peaks, n), mine = Object.values(view.auctions).filter((a) => a.bids.some((b) => b.guest === me));
  box.hidden = !(slots.length && view.rules.tables.length) && !mine.length;
  box.append(h('h2', { text: t('bidTitle') }), h('p', { text: t('bidHint') }));
  const list = [];
  view.rules.tables.forEach((id) => slots.forEach((sl) => list.push(auctionFor(view, id, sl))));
  mine.filter((a) => a.phase !== 'open').forEach((a) => { if (!list.some((x) => x.key === a.key)) list.unshift(a); });
  if (!list.length) box.append(h('p', { text: t('none') }));
  list.forEach((a) => {
    const lead = leaderOf(a), st = standing(a, me), win = a.phase === 'won' || a.phase === 'done' ? a.bids.find((b) => b.id === a.winner) : null, next = minNext(view, a);
    const tb = tableById(L, a.table), stText = st === 'leading' ? t('leading') : st === 'outbid' ? t('outbid') : st === 'won' ? t('won', { table: zoneName(tb.zone), from: hm(a.start), to: hm(a.end) }) : st === 'lost' ? t('lost') : st === 'declined' ? t('declinedG') : '';
    const card = h('div', { class: 'gbid', 'data-key': a.key, 'data-st': st, 'data-table': a.table }, [
      h('div', { class: 'top' }, [h('b', { text: tFull(a.table) }), h('span', { class: 'amt', text: lead ? '₪' + lead.amount : win ? '₪' + win.amount : '' })]),
      h('small', { text: '\u2066' + hm(a.start) + '–' + hm(a.end) + '\u2069 · ' + (a.phase === 'open' ? (lead ? t('current', { n: lead.amount }) : t('start', { n: view.rules.min })) + ' · ' + t('closesIn', { t: left(a.closesAt - n) }) : '') }),
      stText ? h('p', { class: 'st', role: 'status', text: stText + (st === 'won' && view.rules.credit ? ' · ' + t('creditG') : '') }) : null,
      a.phase === 'open' && st !== 'leading' ? h('div', { class: 'acts' }, [h('button', { class: 'pill lead', type: 'button', 'data-act': 'bid', 'data-amount': next, text: t('bidBtn', { n: next }), onclick: () => bid(a, next) }), h('small', { text: t('forParty', { n: party }) })]) : null]);
    box.append(card);
    if (st === 'won' && !wonShown.has(a.key)) { wonShown.add(a.key); if (stage) { stage.flyTo(a.table).then(() => stage.setTable(a.table, true)); } }
  });
  box.append(h('p', { class: 'note', text: t('bidSample') }));
}
function bid(a, amount) {
  const raw = live.get('bids'), v = raw && validateBids(raw, L); if (!v || !v.ok) return;
  const r = placeBid(v.state, { table: a.table, start: a.start, guest: me, party, amount }, { layout: L, peaks: R.peaks, now: now() });
  if (!r.ok) { flash(r.error); return; }
  live.put('bids', r.state); B = r.state; renderBids();
}
function flash(msg) { const f = $('flash'); f.textContent = msg; f.hidden = false; clearTimeout(flash.tm); flash.tm = setTimeout(() => { f.hidden = true; }, 3500); }

/* ---------- the place: from above the café down to my table ---------- */
async function mountStage() {
  const host = $('gstage'); let s = null;
  if (GL !== 'off') {
    try { const { createPlace } = await import('../room/place.js'); s = createPlace(host, L, { reduced: reduce, test: TEST, start: 'above', forceGL: GL === 'on', slowMs: 4000, label: t('youAt', { n: tableNo(L, tableId), zone: zoneName(tableById(L, tableId).zone) }), onTable: () => {}, onSlow: () => { if (stage) stage.dispose(); stage = createPlan(host, L, { lang }); paintStage(); window.__guest.stageKind = '2d'; } }); } catch (e) { s = null; }
  }
  stage = s || createPlan(host, L, { lang }); window.__guest.stageKind = s ? '3d' : '2d';
  paintStage();
  if (!flown) { flown = true; await new Promise((r) => setTimeout(r, reduce || TEST ? 0 : 500)); await stage.flyTo(tableId, { ms: reduce ? 0 : 2600 }); await stage.setTable(tableId, true, { instant: reduce }); window.__guest.landed = true; }
}
function paintStage() {
  if (!stage) return;
  const n = now(), view = B ? tickBids(B, n).state : null, open = view ? new Set(view.rules.tables) : new Set();
  stage.setRows(L.tables.map((tb) => ({ id: tb.id, phase: tb.id === tableId ? 'seated' : open.has(tb.id) && openSlots(R.peaks, n).length ? 'held' : 'free', text: tb.id === tableId ? t('back') : open.has(tb.id) && openSlots(R.peaks, n).length ? '₪' : '' })));
  stage.select(tableId);
}

function shell() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  const tb = tableById(L, tableId);
  $('hello').textContent = t('hello'); $('youAt').textContent = t('youAt', { n: tableNo(L, tableId), zone: zoneName(tb.zone) });
  $('gdemo').textContent = t('demo'); $('glang').textContent = t('lang'); $('glang').setAttribute('aria-label', t('langLabel'));
  document.title = t('hello') + ' · ' + t('youAt', { n: tableNo(L, tableId), zone: zoneName(tb.zone) });
}
function paint() { read(); renderOrder(); renderBids(); paintStage(); checkReady(); }

window.__guest = { stageKind: null, landed: false, me, stage: () => stage, now, party: (n) => { party = n; } };
document.documentElement.classList.toggle('reduce', reduce); document.documentElement.classList.toggle('embed', EMBED); document.documentElement.classList.toggle('test', TEST);
if (!L || !tableById(L, tableId)) { document.body.textContent = ''; document.body.appendChild(h('p', { class: 'none glass', style: 'margin:24px', text: (GSTR[lang] || GSTR.en).noTable })); }
else {
  read(); shell(); renderOrder(); renderBids(); mountStage(); checkReady();
  live.on((m) => { if (['orders', 'bids', 'clock', 'rules', 'layout'].includes(m.part)) { if (m.part === 'layout') { const g = loadLayout(live, venue); if (g) { L = g.layout; if (stage) stage.setLayout(L); } } paint(); } });
  setInterval(() => { renderBids(); }, 1000);
  $('glang').addEventListener('click', () => { lang = lang === 'he' ? 'en' : 'he'; const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u); shell(); renderOrder(); renderBids(); paintStage(); });
}
requestAnimationFrame(() => document.documentElement.classList.add('in'));
