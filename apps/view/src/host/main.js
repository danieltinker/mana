/* The host board: the manager's screen for the room tonight. Every table with its clock, on the floor or as a list (the
   closest to its end first); seat a party, extend, end; the owner's settings; and an alert that stays until it is seen
   when a table's time is up. Entry of view/host.js (built by view/tools/build.mjs next to app.js and seat.js).
   Address: host/?demo=olea[&lang=en][&view=list][&speed=60][&motion=reduce][&test=1]. The rules are seating/timers.mjs;
   this file only draws them and asks them. A demo: the room is a bundled fixture, the floor lives in this browser's
   localStorage, nothing calls any host. ?speed=60 runs the clock a minute a second, so a pitch shows a time-up in a minute. */
import { validateLayout, tableById, zoneById, tableNo } from '../../../../seating/validate.mjs';
import { MIN, LIMITS, settings, createState, minutesFor, configure, seat, extend, free, tick, status, byUrgency } from '../../../../seating/timers.mjs';
import { DEMOS as ROOMS } from '../seat/demos.js';
import { drawFloor, ringColour, ringPath } from './floor.js';
import { createAlerts } from './alerts.js';
import { createStore } from './store.js';
import { makeT } from './i18n.js';

/* the demo's own evening: the bar and the long table keep their own frames; four tables are already seated, one is ending */
const DEMO = { olea: { overrides: { b1: 45, h5: 150 }, seed: [['h1', 4, 22], ['w3', 3, 86], ['c2', 2, 51], ['h5', 7, 34]] } };

const Q = new URLSearchParams(location.search), $ = (id) => document.getElementById(id);
const TEST = Q.get('test') === '1';
const speed = Math.max(1, Math.min(600, Math.round(Number(Q.get('speed')) || 1)));
const reduce = Q.get('motion') === 'reduce' || (Q.get('motion') !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const mem = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* optional */ } } };
let lang = Q.get('lang') === 'en' ? 'en' : Q.get('lang') === 'he' ? 'he' : (mem.get('halom-menu-lang') === 'en' ? 'en' : 'he');
let view = Q.get('view') === 'list' ? 'list' : Q.get('view') === 'floor' ? 'floor' : (mem.get('mana-host-view') === 'list' ? 'list' : 'floor');
const t = makeT(() => lang);

function h(tag, attrs, kids) {
  const e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach((k) => { const v = attrs[k]; if (v == null || v === false) return; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
  (kids || []).forEach((c) => { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
const NS = 'http://www.w3.org/2000/svg';
const s$ = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k])); if (parent) parent.appendChild(e); return e; };
const pad2 = (n) => (n < 10 ? '0' : '') + n;
const hm = (ms) => { const d = new Date(ms); return pad2(d.getHours()) + ':' + pad2(d.getMinutes()); };

/* ---------- which room ---------- */
const demo = (Q.get('demo') || '').replace(/[^a-z0-9_-]/gi, '');
const checked = demo && ROOMS[demo] ? validateLayout(ROOMS[demo]) : { ok: false };
const L = checked.ok ? checked.layout : null;
const D = L ? DEMO[demo] || { overrides: {}, seed: [] } : null;
const ids = L ? L.tables.map((x) => x.id) : [];
const zoneName = (zid) => { const z = zoneById(L, zid); return z ? (z.name[lang] || z.name.en) : zid; };
const isBar = (id) => tableById(L, id).shape === 'bar';
const tName = (id) => { const tb = tableById(L, id); return tb.name || (isBar(id) ? t('barName') : t('tableN', { n: tableNo(L, id) })); };
const tFull = (id) => (isBar(id) ? tName(id) : tName(id) + ' · ' + zoneName(tableById(L, id).zone));
const shortNo = (id) => (isBar(id) ? (lang === 'he' ? 'בר' : 'Bar') : String(tableNo(L, id)));

/* ---------- the clock and the floor's state ---------- */
const storage = (() => { try { return window.localStorage; } catch (e) { return null; } })();
const store = L ? createStore(L.venue, speed, storage) : null;
const kept = store ? store.load(ids) : null;
let clock = speed === 1 ? (kept && kept.clock ? Object.assign({ speed: 1 }, kept.clock) : null) : Object.assign({ speed }, (kept && kept.clock) || { real: Date.now(), virt: Date.now() });
const now = () => (clock ? clock.virt + (Date.now() - clock.real) * clock.speed : Date.now());
function seed(n) {
  let s = createState(L.tables, settings({}, D.overrides));
  D.seed.forEach(([id, party, ago]) => { s = seat(s, id, { party, now: n - ago * MIN }); });
  return tick(s, n).state;
}
let S = L ? (kept ? kept.state : seed(now())) : null;
const seen = new Set(kept ? kept.seen : []);
const save = () => { if (store) store.save(S, [...seen], clock ? { real: Date.now(), virt: now() } : null); };
/* one key per table, per seating, per end: an extension sets a new end, which can alert once more */
const alertKey = (id) => { const x = S.tables[id]; return x && x.phase === 'seated' ? id + ':' + x.n + ':' + (x.minutes + x.extended) : id; };
const alerts = createAlerts({ reduce });

/* ---------- what each table shows ---------- */
function minsText(s) {
  if (s.phase === 'seated' || s.phase === 'ending') return Math.max(0, Math.ceil(s.leftMs / MIN)) + '′';
  if (s.phase === 'over') return '+' + Math.max(1, Math.ceil(s.overMs / MIN)) + '′';
  if (s.phase === 'reserved') return hm(s.at);
  return '';
}
function ariaText(id, s) {
  const m = Math.max(0, Math.ceil((s.leftMs || 0) / MIN));
  const what = s.phase === 'free' ? t('freeAria') : s.phase === 'over' ? t('overAria', { n: Math.max(1, Math.ceil(s.overMs / MIN)) }) : s.phase === 'reserved' ? t('reserved') + ' · ' + hm(s.at) : (m === 1 ? t('leftAriaOne', { time: hm(s.endsAt) }) : t('leftAria', { n: m, time: hm(s.endsAt) }));
  return tFull(id) + ' · ' + what + (s.party ? ' · ' + t.count('guests', s.party) : '');
}
const sideText = (s) => (s.phase === 'over' ? t('endedAt', { time: hm(s.endsAt) }) : s.phase === 'seated' || s.phase === 'ending' ? t('until', { time: hm(s.endsAt) }) : s.phase === 'reserved' ? t('reserved') : t('free'));
function rowsAt(n) {
  const endingMs = S.settings.ending * MIN;
  return ids.map((id) => { const s = status(S, id, n); return { id, s, no: shortNo(id), tagOff: isBar(id), mins: minsText(s), aria: ariaText(id, s), colour: ringColour(s, endingMs) }; });
}

/* ---------- the top: title, clock, view switch, alerts, settings, language ---------- */
function shell() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  $('title').textContent = t('title'); $('venue').textContent = t('venue');
  $('vFloor').textContent = t('floor'); $('vList').textContent = t('list'); $('viewSeg').setAttribute('aria-label', t('views'));
  $('vFloor').setAttribute('aria-pressed', String(view === 'floor')); $('vList').setAttribute('aria-pressed', String(view === 'list'));
  $('gearBtn').setAttribute('aria-label', t('settings')); $('gearBtn').title = t('settings');
  $('alertsLbl').textContent = alerts.armed ? t('alertsOn') : t('alertsOff'); $('alertsBtn').setAttribute('aria-pressed', String(alerts.armed)); $('alertsBtn').title = t('alertsHint');
  $('langBtn').textContent = t('lang'); $('langBtn').setAttribute('aria-label', t('langLabel')); $('langBtn').lang = lang === 'he' ? 'en' : 'he';
  $('demoLine').textContent = t('demoLine') + (speed !== 1 ? ' · ' + t('speedLine', { n: speed }) : '');
  $('credit').textContent = t('credit');
  $('floorView').hidden = view !== 'floor'; $('listView').hidden = view !== 'list';
  $('floor').setAttribute('aria-label', t('floorLabel', { n: ids.length }));
}

/* ---------- the floor ---------- */
let floor = null;
const wantTall = () => innerWidth < 760 && innerHeight > innerWidth * 1.15;
function ensureFloor() {
  if (view !== 'floor') return;
  if (!floor || floor.tall !== wantTall()) { floor = drawFloor($('floor'), L, { tall: wantTall(), onTable: (id, el) => openTable(id, el) }); floor.resize(); }
}

/* ---------- the list: glass cards, the closest to their end first ---------- */
const cards = new Map(); let order = '';
function dial(cls) {
  const svg = s$('svg', { class: 'dial ' + (cls || ''), viewBox: '-32 -32 64 64', 'aria-hidden': 'true' }), d = ringPath('round', 26, 26);
  s$('circle', { class: 'face', r: 21 }, svg); s$('path', { class: 'track', d, pathLength: 1 }, svg); const glow = s$('path', { class: 'glow', d, pathLength: 1 }, svg); const run = s$('path', { class: 'run', d, pathLength: 1 }, svg);
  const no = s$('text', { class: 'no', 'text-anchor': 'middle', 'dominant-baseline': 'central', y: 1 }, svg);
  return { svg, glow, run, no, set(r) { run.style.strokeDashoffset = glow.style.strokeDashoffset = String(r.s.phase === 'free' || r.s.phase === 'reserved' || r.s.phase === 'over' ? 0 : -r.s.progress); run.style.stroke = r.colour; glow.style.stroke = r.colour; no.textContent = r.no; } };
}
function card(id) {
  const ring = dial(), big = h('span', { class: 'big' }), side = h('span', { class: 'side' }), name = h('b', { class: 'nm' }), zone = h('span', { class: 'zn' }), meta = h('p', { class: 'meta' });
  const a1 = h('button', { class: 'pill', type: 'button' }), a2 = h('button', { class: 'pill quiet', type: 'button' });
  const el = h('article', { class: 'card glass', 'data-id': id }, [
    h('button', { class: 'hitcard', type: 'button', 'aria-label': '' }),
    h('div', { class: 'head' }, [ring.svg, h('div', { class: 'time' }, [big, side])]),
    h('div', { class: 'who' }, [name, zone]), meta, h('div', { class: 'acts' }, [a1, a2])]);
  el.querySelector('.hitcard').addEventListener('click', (e) => openTable(id, e.currentTarget));
  a1.addEventListener('click', (e) => { const p = status(S, id, now()).phase; if (p === 'free') openTable(id, e.currentTarget); else act('extend', id); });
  a2.addEventListener('click', () => act('free', id));
  const o = { el, ring, big, side, name, zone, meta, a1, a2, hit: el.querySelector('.hitcard') };
  cards.set(id, o); return o;
}
function paintList(rows, n) {
  const box = $('listView'), sorted = byUrgency(S, n), key = sorted.join(',');
  rows.forEach((r) => {
    const o = cards.get(r.id) || card(r.id), s = r.s, busy = s.phase !== 'free' && s.phase !== 'reserved';
    o.el.setAttribute('data-phase', s.phase); o.ring.set(r);
    o.big.textContent = busy ? r.mins : s.phase === 'reserved' ? r.mins : t('free'); o.big.classList.toggle('word', !busy && s.phase !== 'reserved');
    o.side.textContent = busy ? sideText(s) : s.phase === 'reserved' ? t('reserved') : t('minutes', { n: minutesFor(S, r.id) });
    o.name.textContent = tName(r.id); o.zone.textContent = isBar(r.id) ? '' : zoneName(tableById(L, r.id).zone);
    o.meta.textContent = busy ? [t.count('guests', s.party), t('seatedAt', { time: hm(s.seatedAt) }), s.extended ? t('extendedBy', { n: s.extended }) : null].filter(Boolean).join(' · ') : t.count('upTo', tableById(L, r.id).seats);
    o.hit.setAttribute('aria-label', r.aria);
    o.a1.textContent = busy ? t('extend', { n: S.settings.extendBy }) : t('seat'); o.a1.classList.toggle('lead', true);
    o.a2.hidden = !busy; o.a2.textContent = s.phase === 'over' ? t('freeIt') : t('endNow');
  });
  if (key !== order) { order = key; sorted.forEach((id) => box.appendChild(cards.get(id).el)); }
}

/* ---------- the summary, the quiet strip, the toasts, the tab's title ---------- */
let toastKeys = '', stripKey = '';
function paintTop(rows, n) {
  $('clock').textContent = hm(n); $('clock').dateTime = new Date(n).toISOString();
  const c = { free: 0, seated: 0, ending: 0, over: 0, reserved: 0 }; rows.forEach((r) => { c[r.s.phase]++; });
  const sum = $('sum'); sum.textContent = '';
  [['free', 'nFree'], ['seated', 'nSeated'], ['ending', 'nEnding'], ['over', 'nOver']].forEach(([p, k]) => {
    if ((p === 'ending' || p === 'over') && !c[p]) return;
    sum.appendChild(h('span', { class: 'chip', 'data-phase': p }, [h('i', { 'aria-hidden': 'true' }), h('b', { text: String(c[p] + (p === 'seated' ? c.ending + c.over : 0)) }), ' ' + t(k)]));
  });
  /* the strip: every table whose time is up, seen or not */
  const up = rows.filter((r) => r.s.phase === 'over'), strip = $('strip');
  strip.hidden = !up.length;
  const sk = up.map((r) => r.id).join(',') + '@' + lang;
  if (sk !== stripKey) {                                            // rebuilt only when its tables change, so a focused chip keeps the focus
    stripKey = sk; strip.textContent = ''; strip.appendChild(h('span', { class: 'lead', text: t('upStrip') }));
    up.forEach((r) => strip.appendChild(h('button', { class: 'upchip', type: 'button', 'data-id': r.id, onclick: (e) => openTable(r.id, e.currentTarget) }, [tFull(r.id) + ' ', h('span', { class: 'n' })])));
  }
  up.forEach((r) => { const n = strip.querySelector('.upchip[data-id="' + r.id + '"] .n'); if (n) n.textContent = r.mins; });
  /* the toasts: a table whose time is up and nobody has said "seen" */
  const hot = up.filter((r) => !seen.has(alertKey(r.id))), keys = hot.map((r) => alertKey(r.id)).join('|') + '@' + lang;
  if (keys !== toastKeys) {
    toastKeys = keys; const box = $('toasts'); box.textContent = '';
    hot.slice(0, 3).forEach((r) => {
      const s = r.s;
      box.appendChild(h('div', { class: 'toast glass', role: 'alert', 'data-id': r.id }, [
        h('span', { class: 'beat', 'aria-hidden': 'true' }),
        h('div', { class: 'tx' }, [h('b', { text: t('timeUp', { table: tFull(r.id) }) }), h('small', { text: t('timeUpBody', { party: t.count('guests', s.party), time: hm(s.endsAt) }) })]),
        h('div', { class: 'acts' }, [
          h('button', { class: 'pill lead', type: 'button', 'data-act': 'extend', text: t('extend', { n: S.settings.extendBy }), onclick: () => act('extend', r.id) }),
          h('button', { class: 'pill', type: 'button', 'data-act': 'free', text: t('freeIt'), onclick: () => act('free', r.id) }),
          h('button', { class: 'pill quiet', type: 'button', 'data-act': 'seen', text: t('seen'), onclick: () => { seen.add(alertKey(r.id)); save(); paint(); } })])]));
    });
  }
  alerts.title(t('title') + ' · ' + t('venue'), hot.length > 0);
}

/* ---------- painting ---------- */
let sheetUpdate = null;
function paint(snap) {
  if (!L) return;
  const n = now(), rows = rowsAt(n);
  paintTop(rows, n);
  if (view === 'floor') { ensureFloor(); floor.update(rows, Object.fromEntries(L.zones.map((z) => [z.id, z.name[lang] || z.name.en])), snap, lang === 'he'); }
  else paintList(rows, n);
  document.documentElement.classList.toggle('snap', !!snap);
  if (snap) requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.remove('snap')));
  if (sheetUpdate) sheetUpdate(n);
}

/* ---------- what the manager does ---------- */
function act(what, id, extra) {
  const n = now();
  try {
    if (what === 'extend') S = extend(S, id, { now: n });
    else if (what === 'free') S = free(S, id, { now: n });
    else if (what === 'seat') S = seat(S, id, Object.assign({ now: n }, extra));
  } catch (e) { flash(e.message); return false; }
  save(); paint(true); return true;
}
function flash(msg) { const f = $('flash'); f.textContent = msg; f.hidden = false; clearTimeout(flash.tm); flash.tm = setTimeout(() => { f.hidden = true; }, 4000); }

/* ---------- the sheets: seat a party, a seated table, the settings ---------- */
let opener = null;
function openSheet(build, from) {
  opener = from || document.activeElement; const sh = $('sheet');
  sh.textContent = ''; sheetUpdate = build(sh) || null;
  sh.hidden = false; $('scrim').hidden = false; document.documentElement.classList.add('sheet-open');
  ['page', 'toasts'].forEach((id) => { const el = $(id); if (el) el.inert = true; });      // the sheet is modal: focus stays in it
  requestAnimationFrame(() => { sh.classList.add('in'); $('scrim').classList.add('in'); const ttl = $('sheetTitle'); if (ttl) ttl.focus(); });
}
function closeSheet() {
  const sh = $('sheet'); if (sh.hidden) return;
  sh.classList.remove('in'); $('scrim').classList.remove('in'); sheetUpdate = null; document.documentElement.classList.remove('sheet-open');
  sh.hidden = true; $('scrim').hidden = true;
  ['page', 'toasts'].forEach((id) => { const el = $(id); if (el) el.inert = false; });
  const back = opener && opener.isConnected ? opener : null; opener = null; if (back) try { back.focus(); } catch (e) { /* gone */ }
}
const stepper = (label, value, dec, inc, opts = {}) => h('div', { class: 'stepper-row' }, [
  h('div', { class: 'lbl' }, [h('span', { text: label }), opts.hint ? h('small', { text: opts.hint }) : null]),
  h('div', { class: 'stepper', dir: 'ltr' }, [
    h('button', { class: 'round', type: 'button', id: opts.id ? opts.id + 'Dec' : null, 'aria-label': opts.decLabel || t('less') + ' · ' + label, disabled: opts.decOff, text: '−', onclick: dec }),
    h('output', { class: 'val' + (opts.muted ? ' muted' : ''), id: opts.id ? opts.id + 'Val' : null, dir: 'auto', 'aria-live': 'polite', text: value }),
    h('button', { class: 'round', type: 'button', id: opts.id ? opts.id + 'Inc' : null, 'aria-label': opts.incLabel || t('moreMin') + ' · ' + label, disabled: opts.incOff, text: '+', onclick: inc })])]);
const head = (title, sub) => h('header', { class: 'sh-head' }, [h('div', {}, [h('h2', { id: 'sheetTitle', tabindex: '-1', text: title }), sub ? h('p', { class: 'sub', text: sub }) : null]),
  h('button', { class: 'x', type: 'button', 'aria-label': t('close'), onclick: closeSheet, html: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' })]);

function openTable(id, from) {
  const s = status(S, id, now());
  if (s.phase === 'free' || s.phase === 'reserved') openSheet((sh) => seatSheet(sh, id), from); else openSheet((sh) => tableSheet(sh, id), from);
}
function seatSheet(sh, id) {
  const tb = tableById(L, id), base = minutesFor(S, id), [lo, hi] = LIMITS.minutes;
  const st = { party: Math.min(tb.seats, Math.max(2, tb.minParty)), minutes: base };
  let focusId = null;
  const render = () => {
    sh.textContent = '';
    const ends = now() + st.minutes * MIN;
    sh.append(head(t('seatTitle') + ' · ' + tName(id), isBar(id) ? t.count('upTo', tb.seats) : zoneName(tb.zone) + ' · ' + t.count('upTo', tb.seats)),
      stepper(t('party'), String(st.party), () => { st.party = Math.max(1, st.party - 1); focusId = 'partyDec'; render(); }, () => { st.party = Math.min(tb.seats, st.party + 1); focusId = 'partyInc'; render(); }, { id: 'party', decOff: st.party <= 1, incOff: st.party >= tb.seats, decLabel: t('fewer'), incLabel: t('more') }),
      stepper(t('frame'), t('minutes', { n: st.minutes }), () => { st.minutes = Math.max(lo, st.minutes - 15); focusId = 'frameDec'; render(); }, () => { st.minutes = Math.min(hi, st.minutes + 15); focusId = 'frameInc'; render(); }, { id: 'frame', decOff: st.minutes - 15 < lo, incOff: st.minutes + 15 > hi, decLabel: t('shorter'), incLabel: t('longer'), hint: st.minutes === base ? t('frameDefault') : null }),
      h('p', { class: 'ends', id: 'seatEnds' }, [h('span', { class: 'big', text: st.minutes + '′' }), h('span', { class: 'side', text: t('until', { time: hm(ends) }) })]),
      h('div', { class: 'sh-acts' }, [h('button', { class: 'pill lead wide', type: 'button', id: 'seatGo', text: t('seat'), onclick: () => { if (act('seat', id, { party: st.party, minutes: st.minutes })) closeSheet(); } }),
        h('button', { class: 'pill quiet', type: 'button', text: t('cancel'), onclick: closeSheet })]));
    if (focusId) { const f = $(focusId); if (f && !f.disabled) f.focus(); else { const ttl = $('sheetTitle'); if (ttl) ttl.focus(); } focusId = null; }
  };
  render();
  return (n) => { const e = sh.querySelector('#seatEnds .side'); if (e) e.textContent = t('until', { time: hm(n + st.minutes * MIN) }); };
}
function tableSheet(sh, id) {
  const ring = dial('lg'), big = h('span', { class: 'big' }), side = h('span', { class: 'side' }), meta = h('p', { class: 'meta' });
  const ext = h('button', { class: 'pill lead wide', type: 'button', id: 'extendGo', onclick: () => act('extend', id) });
  const end = h('button', { class: 'pill', type: 'button', id: 'endGo', onclick: () => { if (act('free', id)) closeSheet(); } });
  sh.append(head(tName(id), isBar(id) ? null : zoneName(tableById(L, id).zone)), h('div', { class: 'sh-dial' }, [ring.svg, h('div', { class: 'time' }, [big, side])]), meta, h('div', { class: 'sh-acts' }, [ext, end]));
  const upd = (n) => {
    const s = status(S, id, n);
    if (s.phase === 'free' || s.phase === 'reserved') { closeSheet(); return; }
    sh.setAttribute('data-phase', s.phase);
    ring.set({ s, colour: ringColour(s, S.settings.ending * MIN), no: shortNo(id) });
    big.textContent = minsText(s); side.textContent = sideText(s);
    meta.textContent = [t.count('guests', s.party), t('seatedAt', { time: hm(s.seatedAt) }), s.extended ? t('extendedBy', { n: s.extended }) : null].filter(Boolean).join(' · ');
    ext.textContent = t('extend', { n: S.settings.extendBy }); end.textContent = s.phase === 'over' ? t('freeTable') : t('endNow');
  };
  upd(now()); return upd;
}
function settingsSheet(sh) {
  let focusId = null;
  const set = (patch, fid) => { try { S = configure(S, patch); } catch (e) { flash(e.message); return; } save(); focusId = fid; render(); paint(); };
  const render = () => {
    sh.textContent = ''; const c = S.settings, [mlo, mhi] = LIMITS.minutes, [elo, ehi] = LIMITS.ending, [glo, ghi] = LIMITS.grace;
    const rows = h('div', { class: 'tables-set' });
    ids.forEach((id) => {
      const o = c.overrides[id], v = o == null ? c.minutes : o;
      rows.appendChild(h('div', { class: 'trow' + (o == null ? '' : ' own') }, [
        h('span', { class: 'tn' }, [h('b', { text: tName(id) }), isBar(id) ? null : h('small', { text: zoneName(tableById(L, id).zone) })]),
        h('div', { class: 'stepper sm', dir: 'ltr' }, [
          h('button', { class: 'round', type: 'button', id: 'ov-' + id + 'Dec', 'aria-label': t('less') + ' · ' + tFull(id), disabled: v - 5 < mlo, text: '−', onclick: () => set({ overrides: { [id]: v - 5 } }, 'ov-' + id + 'Dec') }),
          h('output', { class: 'val' + (o == null ? ' muted' : ''), dir: 'auto', text: t('minutes', { n: v }) }),
          h('button', { class: 'round', type: 'button', id: 'ov-' + id + 'Inc', 'aria-label': t('moreMin') + ' · ' + tFull(id), disabled: v + 5 > mhi, text: '+', onclick: () => set({ overrides: { [id]: v + 5 } }, 'ov-' + id + 'Inc') })]),
        h('button', { class: 'reset', type: 'button', id: 'ov-' + id + 'Reset', hidden: o == null, 'aria-label': t('reset') + ' · ' + tFull(id), title: t('reset'), text: '↺', onclick: () => set({ overrides: { [id]: null } }, 'ov-' + id + 'Inc') })]));
    });
    sh.append(head(t('setTitle'), t('venue')),
      stepper(t('setFrame'), t('minutes', { n: c.minutes }), () => set({ minutes: c.minutes - 5 }, 'setMinDec'), () => set({ minutes: c.minutes + 5 }, 'setMinInc'), { id: 'setMin', hint: t('setFrameHint'), decOff: c.minutes - 5 < mlo, incOff: c.minutes + 5 > mhi }),
      stepper(t('setEnding'), t('minutes', { n: c.ending }), () => set({ ending: c.ending - 1 }, 'setEndDec'), () => set({ ending: c.ending + 1 }, 'setEndInc'), { id: 'setEnd', hint: t('setEndingHint'), decOff: c.ending <= elo, incOff: c.ending >= ehi }),
      stepper(t('setGrace'), t('minutes', { n: c.grace }), () => set({ grace: c.grace - 1 }, 'setGrDec'), () => set({ grace: c.grace + 1 }, 'setGrInc'), { id: 'setGr', hint: t('setGraceHint'), decOff: c.grace <= glo, incOff: c.grace >= ghi }),
      h('div', { class: 'lbl sec' }, [h('span', { text: t('setTables') }), h('small', { text: t('setTablesHint') })]), rows,
      h('div', { class: 'sh-acts' }, [h('button', { class: 'pill lead wide', type: 'button', text: t('done'), onclick: closeSheet }),
        h('button', { class: 'pill quiet', type: 'button', id: 'resetDemo', text: t('resetDemo'), onclick: () => { S = seed(now()); seen.clear(); save(); closeSheet(); paint(true); } })]));
    if (focusId) { const f = $(focusId); if (f && !f.disabled) f.focus(); else { const ttl = $('sheetTitle'); if (ttl) ttl.focus(); } focusId = null; }
  };
  render();
  return null;
}

/* ---------- the second hand ---------- */
function onEvent(e, n) {
  if (e.type !== 'over') return;
  const s = status(S, e.tableId, n); if (s.phase !== 'over' || seen.has(alertKey(e.tableId))) return;
  alerts.chime(); alerts.buzz(); alerts.notify(t('notifTitle', { table: tFull(e.tableId) }), t('notifBody'), 'mana-host-' + e.tableId);
}
/* a sped-up demo only: when fewer than three tables are seated, the next free table takes a party that sat down a little while
   ago, so a pitch never ends on an empty floor (Daniel's review: at ×60 the four demo tables had all freed after two minutes) */
function keepAlive(n) {
  const busy = L.tables.filter((t) => S.tables[t.id] && S.tables[t.id].phase === 'seated').length;
  if (busy >= 3) return;
  const open = L.tables.filter((t) => t.bookable !== false && S.tables[t.id] && S.tables[t.id].phase === 'free');
  if (!open.length) return;
  const t = open[Math.floor(n / MIN) % open.length];
  try { S = seat(S, t.id, { party: Math.max(t.minParty || 1, Math.min(t.seats, 2)), now: n - (Math.floor(n / MIN) % 25) * MIN }); save(); } catch (e) { /* the rules said no: the next tick tries again */ }
}
function step() {
  if (!L) return;
  const n = now(), r = tick(S, n);
  if (r.state !== S) { S = r.state; save(); }
  r.events.forEach((e) => onEvent(e, n));
  if (speed > 1) keepAlive(n);      /* timers: a sped-up demo (a pitch) keeps its evening going */
  paint();
}
let timer = 0;
function schedule() { clearTimeout(timer); const lag = clock ? 1000 : 1000 - (Date.now() % 1000) + 8; timer = setTimeout(() => { step(); schedule(); }, lag); }

/* ---------- boot ---------- */
document.documentElement.classList.toggle('reduce', reduce); document.documentElement.classList.toggle('test', TEST);
if (!L) {
  shell(); $('main').textContent = ''; $('main').appendChild(h('div', { class: 'none glass' }, [h('h2', { text: lang === 'he' ? 'אין כאן מפה.' : 'There is no floor here.' }), h('p', { text: lang === 'he' ? 'הקישור צריך להוביל למסעדה עם מפה (?demo=olea).' : 'The link needs to lead to a restaurant with a floor plan (?demo=olea).' })]));
} else {
  if (!kept) save();
  shell(); step(); schedule();
  $('vFloor').addEventListener('click', () => { view = 'floor'; mem.set('mana-host-view', view); shell(); paint(); });
  $('vList').addEventListener('click', () => { view = 'list'; mem.set('mana-host-view', view); shell(); paint(); });
  $('gearBtn').addEventListener('click', (e) => openSheet(settingsSheet, e.currentTarget));
  $('alertsBtn').addEventListener('click', async () => { await alerts.arm(); shell(); });
  $('scrim').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  addEventListener('resize', () => { if (floor && view === 'floor') { if (floor.tall !== wantTall()) { floor = null; paint(); } else floor.resize(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { step(); schedule(); } });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (floor) floor.resize(); });
}
$('langBtn').addEventListener('click', () => { lang = lang === 'he' ? 'en' : 'he'; mem.set('halom-menu-lang', lang); const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u); closeSheet(); shell(); toastKeys = ''; paint(); });
requestAnimationFrame(() => document.documentElement.classList.add('in'));
window.__host = {
  state: () => S, now, rows: () => rowsAt(now()).map((r) => ({ id: r.id, phase: r.s.phase, mins: r.mins, progress: r.s.progress })), seen: () => [...seen], view: () => view, armed: () => alerts.armed,
  advance(ms) { const n = now(); clock = { real: Date.now(), virt: n + ms, speed: clock ? clock.speed : 1 }; step(); },
  /* a pitch or a screenshot: the same demo evening, starting at a given time (ms) */
  at(ms) { clock = { real: Date.now(), virt: ms, speed: clock ? clock.speed : 1 }; S = seed(ms); seen.clear(); save(); closeSheet(); paint(true); },
  step, paint, store
};
