/* The seat map: a guest picks an area, maybe a table, and sends a request; the owner approves it, moves it or declines it
   with a reason. Entry of view/seat.js (built by view/tools/build.mjs next to app.js).
   Address: seat/?demo=olea[&lang=en][&owner=1][&test=1][&motion=reduce]. Tonight the layout is a bundled fixture per demo;
   a real venue's layout arrives with its snapshot later (seating/README.md). Nothing here calls any host. */
import { validateLayout, tablesFor, zonesFor, tableById, zoneById, tableNo, newRequest } from '../../../../seating/validate.mjs';
import { drawPlan } from './plan.js';
import { createSessionStore } from './store.js';
import { makeT, PRODUCT } from './i18n.js';
import { DEMOS } from './demos.js';

const Q = new URLSearchParams(location.search), $ = (id) => document.getElementById(id);
const TEST = Q.get('test') === '1';
const reduce = Q.get('motion') === 'reduce' || (Q.get('motion') !== 'full' && matchMedia('(prefers-reduced-motion: reduce)').matches);
const OWNER = Q.get('owner') === '1';
const mem = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* optional */ } } };
let lang = Q.get('lang') === 'en' ? 'en' : Q.get('lang') === 'he' ? 'he' : (mem.get('halom-menu-lang') === 'en' ? 'en' : 'he');
const t = makeT(() => lang);

function h(tag, attrs, kids) {
  const e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach((k) => { const v = attrs[k]; if (v == null || v === false) return; if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'for') e.htmlFor = v; else if (/^(dir|hidden|type|href|value|min|max|step|role|tabindex|inputmode|autocomplete|maxlength|placeholder|lang|disabled|selected|id|name)$/.test(k) || k.startsWith('aria-') || k.startsWith('data-')) e.setAttribute(k, v === true ? '' : v); else e[k] = v; });
  (kids || []).forEach((c) => { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return e;
}
const pad2 = (n) => (n < 10 ? '0' : '') + n;
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); };
const niceDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); try { return new Date(y, m - 1, d).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return iso; } };

/* ---------- which room ---------- */
const demo = (Q.get('demo') || '').replace(/[^a-z0-9_-]/gi, '');
const rawLayout = demo && DEMOS[demo] ? DEMOS[demo] : null;
const checked = rawLayout ? validateLayout(rawLayout) : { ok: false, errors: ['no layout'] };
const L = checked.ok ? checked.layout : null;
const store = L ? createSessionStore(L.venue, (() => { try { return window.sessionStorage; } catch (e) { return null; } })()) : null;
const zoneName = (id) => { const z = zoneById(L, id); return z ? (z.name[lang] || z.name.en) : id; };
const tableName = (id) => { const tb = tableById(L, id); if (!tb) return id; return (tb.name || t('tableN', { n: tableNo(L, id) })) + ' · ' + zoneName(tb.zone); };
const seatsLine = (tb) => (tb.minParty === tb.maxParty ? (tb.maxParty === 1 ? t('seatsOne') : t('seatsUpTo', { b: tb.maxParty })) : tb.minParty === 1 ? t('seatsUpTo', { b: tb.maxParty }) : t('seats', { a: tb.minParty, b: tb.maxParty }));
const summary = (r) => (r.party === 1 ? t('summaryOne', { date: niceDate(r.date), time: r.time }) : t('summary', { party: r.party, date: niceDate(r.date), time: r.time }));

/* ---------- the guest's state ---------- */
const G = { step: 1, date: today(), time: '20:00', party: 2, zone: null, table: null, name: '', phone: '', note: '', errors: [], sent: null };
let plan = null, focusAfter = null;

function shell() {
  document.documentElement.lang = lang; document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
  const name = L ? (demo === 'olea' ? (lang === 'he' ? 'אוליאה' : 'Olea') : L.venue) : '';
  document.title = (OWNER ? t('ownerTitle') : t('title')) + (name ? ' · ' + name : '');
  $('title').textContent = OWNER ? t('ownerTitle') : t('title');
  $('bizName').textContent = name;
  $('home').href = new URL('../?demo=' + encodeURIComponent(demo) + '&lang=' + lang, document.baseURI).href; $('home').setAttribute('aria-label', t('backToMenu')); $('homeLbl').textContent = t('backToMenu');
  $('home').hidden = OWNER;
  $('langBtn').textContent = t('lang'); $('langBtn').setAttribute('aria-label', t('langLabel')); $('langBtn').lang = lang === 'he' ? 'en' : 'he';
  $('demoLine').textContent = t('demoLine');
  $('credit').textContent = t('credit', { name: PRODUCT.name[lang] }); $('credit').href = PRODUCT.url;
  if (L) $('plan').setAttribute('aria-label', t('planLabel', { zones: L.zones.length, tables: L.tables.length }));
}

/* ---------- the guest flow: four steps in the sheet, the plan above ---------- */
const STEPS = () => (L.tableChoice ? 4 : 3);
function guestPlanState() {
  const fitT = new Set(tablesFor(L, G.party).map((x) => x.id)), fitZ = new Set(zonesFor(L, G.party).map((z) => z.id));
  if (G.sent) { const r = store.byId(L, G.sent); return { lang, zone: r ? r.zone : null, table: r ? r.table : null, fitTables: null, fitZones: null, muted: !r }; }
  if (G.step === 1) return { lang, zone: null, table: null, fitTables: fitT, fitZones: fitZ, muted: false };
  return { lang, zone: G.zone, table: G.table, fitTables: fitT, fitZones: fitZ, muted: false };
}
function go(step) { G.step = step; G.errors = []; render(); }
function renderGuest() {
  const sheet = $('sheet'); sheet.textContent = '';
  const mine = G.sent || store.mine(); const r = mine ? store.byId(L, mine) : null;
  if (r) { G.sent = r.id; sheet.appendChild(sentView(r)); return; }
  G.sent = null;
  const n = STEPS(), head = h('p', { class: 'eyebrow', text: t('step', { i: G.step, n }) });
  const nav = (back, fwd) => h('div', { class: 'nav' }, [back ? h('button', { class: 'ghost', type: 'button', text: t('back') }, null) : null, fwd]);
  if (G.step === 1) {
    const party = h('span', { class: 'party-n', text: String(G.party), 'aria-live': 'polite' });
    const minus = h('button', { class: 'round', type: 'button', 'aria-label': t('fewer'), disabled: G.party <= 1, text: '−' }), plus = h('button', { class: 'round', type: 'button', 'aria-label': t('more'), disabled: G.party >= 12, text: '+' });
    minus.addEventListener('click', () => { G.party = Math.max(1, G.party - 1); focusAfter = 'partyMinus'; render(); }); plus.addEventListener('click', () => { G.party = Math.min(12, G.party + 1); focusAfter = 'partyPlus'; render(); });
    minus.id = 'partyMinus'; plus.id = 'partyPlus';
    const date = h('input', { id: 'date', type: 'date', value: G.date, min: today(), dir: 'ltr' }), time = h('input', { id: 'time', type: 'time', value: G.time, step: 900, dir: 'ltr' });
    date.addEventListener('change', () => { if (date.value) G.date = date.value; }); time.addEventListener('change', () => { if (time.value) G.time = time.value; });
    const next = h('button', { class: 'primary', type: 'button', id: 'next', text: t('next') }); next.addEventListener('click', () => { if (!date.value || !time.value) return; G.date = date.value; G.time = time.value; if (G.zone && !zonesFor(L, G.party).some((z) => z.id === G.zone)) { G.zone = null; G.table = null; } if (G.table && !tablesFor(L, G.party).some((x) => x.id === G.table)) G.table = null; go(2); });
    sheet.append(head, h('h2', { text: t('when') }),
      h('div', { class: 'fields' }, [h('label', { class: 'field' }, [h('span', { text: t('date') }), date]), h('label', { class: 'field' }, [h('span', { text: t('time') }), time])]),
      h('div', { class: 'party', role: 'group', 'aria-label': t('party') }, [h('span', { class: 'field-lbl', text: t('party') }), h('span', { class: 'stepper' }, [minus, party, plus])]),
      nav(false, next));
  } else if (G.step === 2) {
    const fitZ = zonesFor(L, G.party), list = h('div', { class: 'choices', role: 'radiogroup', 'aria-label': t('areas') });
    L.zones.forEach((z) => {
      const ok = fitZ.some((x) => x.id === z.id), k = tablesFor(L, G.party, z.id).length, on = G.zone === z.id;
      const b = h('button', { class: 'choice' + (on ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false', disabled: !ok, 'data-zone': z.id }, [h('b', { text: z.name[lang] || z.name.en }), h('small', { text: ok ? t.count('fitCount', k) : t('noFit', { n: G.party }) })]);
      b.addEventListener('click', () => { G.zone = z.id; if (G.table && tableById(L, G.table).zone !== z.id) G.table = null; focusAfter = 'zone:' + z.id; render(); });
      list.appendChild(b);
    });
    const next = h('button', { class: 'primary', type: 'button', id: 'next', text: t('next'), disabled: !G.zone }); next.addEventListener('click', () => go(L.tableChoice ? 3 : 4));
    const nv = nav(true, next); nv.firstChild.addEventListener('click', () => go(1));
    sheet.append(head, h('h2', { text: t('where') }), list, nv);
  } else if (G.step === 3) {
    const fitT = tablesFor(L, G.party, G.zone), list = h('div', { class: 'choices tables', role: 'listbox', 'aria-label': t('tables'), tabindex: '0', id: 'tableList' });
    const opts = [null].concat(fitT.map((x) => x.id));
    opts.forEach((id) => {
      const on = G.table === id, tb = id ? tableById(L, id) : null;
      const o = h('div', { class: 'choice' + (on ? ' on' : ''), role: 'option', 'aria-selected': on ? 'true' : 'false', 'data-table': id || '', id: 'opt-' + (id || 'any') }, [h('b', { text: id ? (tb.name || t('tableN', { n: tableNo(L, id) })) : t('anyTable') }), id ? h('small', { text: seatsLine(tb) }) : h('small', { text: t('whichHint') })]);
      o.addEventListener('click', () => { G.table = id; render(); });
      list.appendChild(o);
    });
    list.setAttribute('aria-activedescendant', 'opt-' + (G.table || 'any'));
    list.addEventListener('keydown', (e) => {
      const i = opts.indexOf(G.table); let j = i;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = Math.min(opts.length - 1, i + 1); else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = Math.max(0, i - 1); else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = opts.length - 1; else if (e.key === 'Enter') { e.preventDefault(); go(4); return; } else return;
      e.preventDefault(); if (j !== i) { G.table = opts[j]; focusAfter = 'tableList'; render(); }
    });
    const next = h('button', { class: 'primary', type: 'button', id: 'next', text: t('next') }); next.addEventListener('click', () => go(4));
    const nv = nav(true, next); nv.firstChild.addEventListener('click', () => go(2));
    sheet.append(head, h('h2', { text: t('which') }), h('p', { class: 'hint', text: zoneName(G.zone) }), list, nv);
  } else {
    if (!G.name && !G.phone) { G.name = lang === 'he' ? 'דנה לוי' : 'Dana Levi'; G.phone = '050-000-0000'; }      // a demo: fictional, said so
    const name = h('input', { id: 'name', type: 'text', value: G.name, autocomplete: 'off', maxlength: '80' }), phone = h('input', { id: 'phone', type: 'tel', value: G.phone, autocomplete: 'off', inputmode: 'tel', dir: 'ltr', maxlength: '20' }), note = h('textarea', { id: 'note', maxlength: '300', rows: 2 });
    note.value = G.note;
    name.addEventListener('input', () => { G.name = name.value; }); phone.addEventListener('input', () => { G.phone = phone.value; }); note.addEventListener('input', () => { G.note = note.value; });
    const err = h('p', { class: 'error', role: 'alert', hidden: !G.errors.length, text: G.errors.join(' · ') });
    const send = h('button', { class: 'primary', type: 'button', id: 'send', text: t('send') });
    send.addEventListener('click', () => {
      const res = newRequest({ zone: G.zone, table: G.table, date: G.date, time: G.time, party: G.party, name: G.name, phone: G.phone, note: G.note }, L);
      if (!res.ok) { G.errors = res.errors.map((e) => (e.startsWith('name') ? t('name') : e.startsWith('phone') ? t('phone') : e)); render(); return; }
      store.add(res.request, L); store.setMine(res.request.id); G.sent = res.request.id; focusAfter = 'sentTitle'; render();
    });
    const nv = nav(true, send); nv.firstChild.addEventListener('click', () => go(L.tableChoice ? 3 : 2));
    const line = h('p', { class: 'hint', text: [G.party === 1 ? t('summaryOne', { date: niceDate(G.date), time: G.time }) : t('summary', { party: G.party, date: niceDate(G.date), time: G.time }), G.table ? tableName(G.table) : zoneName(G.zone)].join(' · ') });
    sheet.append(head, h('h2', { text: t('details') }), line, h('p', { class: 'demo-fill', text: t('demoFill') }),
      h('div', { class: 'fields' }, [h('label', { class: 'field' }, [h('span', { text: t('name') }), name]), h('label', { class: 'field' }, [h('span', { text: t('phone') }), phone])]),
      h('label', { class: 'field' }, [h('span', { text: t('note') + ' · ' + t('noteHint') }), note]), err, nv);
  }
}
function sentView(r) {
  const box = h('div', { class: 'sent', 'data-status': r.status });
  const title = r.status === 'approved' ? t('approvedTitle') : r.status === 'declined' ? t('declinedTitle') : t('sentTitle');
  box.append(h('p', { class: 'eyebrow', text: r.status === 'pending' ? t('pendingTitle') : r.status === 'approved' ? t('statusApproved') : t('statusDeclined') }), h('h2', { id: 'sentTitle', tabindex: '-1', text: title }));
  if (r.status === 'pending') box.appendChild(h('p', { class: 'body', text: t('sentBody') }));
  box.appendChild(h('p', { class: 'body strong', text: summary(r) }));
  box.appendChild(h('p', { class: 'body', text: r.table ? t('yourTable', { table: tableName(r.table) }) : t('yourArea', { zone: zoneName(r.zone) }) }));
  if (r.status === 'declined') box.appendChild(h('p', { class: 'body reason', text: t('reasonLine', { reason: r.reason }) }));
  const again = h('button', { class: 'ghost', type: 'button', id: 'again', text: t('again') }); again.addEventListener('click', () => { store.setMine(''); G.sent = null; G.step = 1; G.zone = null; G.table = null; render(); });
  const owner = h('a', { class: 'link', id: 'ownerLink', href: location.pathname + '?demo=' + encodeURIComponent(demo) + '&owner=1&lang=' + lang, text: t('ownerLink') });
  box.appendChild(h('div', { class: 'nav' }, [again, owner]));
  return box;
}

/* ---------- the owner: the requests, each with approve / swap / decline ---------- */
const O = { selected: null, swapping: null, declining: null, swapTo: null, reason: '' };
function ownerPlanState() {
  const r = O.selected ? store.byId(L, O.selected) : null;
  if (r && O.swapping === r.id) return { lang, zone: O.swapTo ? tableById(L, O.swapTo).zone : r.zone, table: O.swapTo || r.table, fitTables: new Set(tablesFor(L, r.party).map((x) => x.id)), fitZones: new Set(zonesFor(L, r.party).map((z) => z.id)), muted: false };
  return { lang, zone: r ? r.zone : null, table: r ? r.table : null, fitTables: null, fitZones: null, muted: !r };
}
function renderOwner() {
  const sheet = $('sheet'); sheet.textContent = '';
  const all = store.list(L), pending = all.filter((r) => r.status === 'pending').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))), done = all.filter((r) => r.status !== 'pending').sort((a, b) => String(b.decidedAt).localeCompare(String(a.decidedAt)));
  if (O.selected && !all.some((r) => r.id === O.selected)) O.selected = null;
  if (!O.selected && pending.length) O.selected = pending[0].id;
  const guest = h('a', { class: 'link', id: 'guestLink', href: location.pathname + '?demo=' + encodeURIComponent(demo) + '&lang=' + lang, text: t('guestLink') });
  if (!all.length) { sheet.append(h('h2', { text: t('ownerTitle') }), h('p', { class: 'body', text: t('empty') }), h('p', { class: 'hint', text: t('emptyHint') }), h('div', { class: 'nav' }, [guest])); return; }
  const card = (r) => {
    const sel = O.selected === r.id, c = h('article', { class: 'req' + (sel ? ' sel' : ''), 'data-id': r.id, 'data-status': r.status, tabindex: '0', 'aria-current': sel ? 'true' : 'false' });
    c.addEventListener('click', (e) => { if (e.target.closest('button, select, input, a')) return; O.selected = r.id; O.swapping = null; O.declining = null; render(); });
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === c) { O.selected = r.id; focusAfter = 'req:' + r.id; render(); } });
    c.append(h('p', { class: 'req-head' }, [h('b', { text: r.name }), h('span', { class: 'badge s-' + r.status, text: t('status' + r.status[0].toUpperCase() + r.status.slice(1)) })]),
      h('p', { class: 'req-line', text: summary(r) }), h('p', { class: 'req-line', text: (r.table ? t('table') + ': ' + tableName(r.table) : t('area') + ': ' + zoneName(r.zone) + ' · ' + t('anyTableShort')) }),
      ...[r.note ? h('p', { class: 'req-note', text: '“' + r.note + '”' }) : null, r.status === 'declined' ? h('p', { class: 'req-line reason', text: t('reasonLine', { reason: r.reason }) }) : null].filter(Boolean));
    if (sel && r.status !== 'declined') {
      const acts = h('div', { class: 'acts' });
      if (O.swapping === r.id) {
        const fit = tablesFor(L, r.party), sel2 = h('select', { id: 'swapSel', 'aria-label': t('chooseTable') });
        fit.forEach((x) => { const o = h('option', { value: x.id, text: tableName(x.id) }); if ((O.swapTo || r.table) === x.id) o.selected = true; sel2.appendChild(o); });
        if (!O.swapTo) O.swapTo = sel2.value || null;
        sel2.addEventListener('change', () => { O.swapTo = sel2.value; render(); });
        const ok = h('button', { class: 'primary', type: 'button', id: 'swapOk', text: r.status === 'pending' ? t('approve') : t('swap') });
        ok.addEventListener('click', () => { const res = store.act(r.id, r.status === 'pending' ? { type: 'approve', table: O.swapTo } : { type: 'swap', table: O.swapTo }, L); if (res.ok) { O.swapping = null; O.swapTo = null; } render(); });
        const cancel = h('button', { class: 'ghost', type: 'button', text: t('cancel') }); cancel.addEventListener('click', () => { O.swapping = null; O.swapTo = null; render(); });
        acts.append(h('label', { class: 'field' }, [h('span', { text: t('chooseTable') }), sel2]), h('div', { class: 'nav' }, [cancel, ok]));
      } else if (O.declining === r.id) {
        const inp = h('input', { id: 'reason', type: 'text', maxlength: '200', value: O.reason }); inp.addEventListener('input', () => { O.reason = inp.value; });
        const ok = h('button', { class: 'primary danger', type: 'button', id: 'declineOk', text: t('confirmDecline') });
        ok.addEventListener('click', () => { const res = store.act(r.id, { type: 'decline', reason: O.reason }, L); if (res.ok) { O.declining = null; O.reason = ''; render(); } else { inp.setAttribute('aria-invalid', 'true'); inp.focus(); } });
        const cancel = h('button', { class: 'ghost', type: 'button', text: t('cancel') }); cancel.addEventListener('click', () => { O.declining = null; render(); });
        acts.append(h('label', { class: 'field' }, [h('span', { text: t('reason') }), inp]), h('div', { class: 'nav' }, [cancel, ok]));
        focusAfter = focusAfter || 'reason';
      } else {
        if (r.status === 'pending') { const ap = h('button', { class: 'primary', type: 'button', id: 'approve', text: t('approve') }); ap.addEventListener('click', () => { store.act(r.id, { type: 'approve' }, L); render(); }); acts.appendChild(ap); }
        const sw = h('button', { class: 'ghost', type: 'button', id: 'swap', text: t('swap') }); sw.addEventListener('click', () => { O.swapping = r.id; O.swapTo = r.table; focusAfter = 'swapSel'; render(); }); acts.appendChild(sw);
        if (r.status === 'pending') { const de = h('button', { class: 'ghost', type: 'button', id: 'decline', text: t('decline') }); de.addEventListener('click', () => { O.declining = r.id; focusAfter = 'reason'; render(); }); acts.appendChild(de); }
      }
      c.appendChild(acts);
    }
    return c;
  };
  sheet.append(h('h2', { class: 'sr', text: t('ownerTitle') }), h('p', { class: 'eyebrow', text: t('pending') + ' · ' + pending.length }));
  if (!pending.length) sheet.append(h('p', { class: 'hint', text: t('empty') }));
  pending.forEach((r) => sheet.appendChild(card(r)));
  if (done.length) { sheet.append(h('p', { class: 'eyebrow', text: t('decided') + ' · ' + done.length })); done.forEach((r) => sheet.appendChild(card(r))); }
  sheet.append(h('div', { class: 'nav' }, [guest]));
}

/* ---------- 2D / 3D: the same room standing up (three.js, loaded on the first tap; 2D is the truth and the fallback) ---------- */
let room = null, roomWanted = false, roomLoading = false, roomFailed = Q.get('gl') === 'off';
function planState() { return OWNER ? ownerPlanState() : guestPlanState(); }
function setView(three) {
  roomWanted = three && !roomFailed; $('view2d').setAttribute('aria-pressed', roomWanted ? 'false' : 'true'); $('view3d').setAttribute('aria-pressed', roomWanted ? 'true' : 'false');
  $('planBox').classList.toggle('is3d', roomWanted); $('room').hidden = !roomWanted; $('room').classList.toggle('in', roomWanted && !!room);
  if (roomWanted && !room && !roomLoading) {
    roomLoading = true;
    import('./room3d.js').then((m) => {
      roomLoading = false; if (!roomWanted) return;
      room = m.createRoom($('room'), L, { reduce: reduce || TEST, onTable: (id) => plan && planTaps.onTable(id), onSlow: Q.get('adapt') === 'off' ? null : () => { roomFailed = true; setView(false); $('viewSeg').hidden = true; } });      // ?adapt=off: tests and films in software GL keep the room
      if (!room) { roomFailed = true; $('viewSeg').hidden = true; setView(false); return; }
      room.update(planState()); requestAnimationFrame(() => $('room').classList.add('in'));
    }).catch(() => { roomLoading = false; roomFailed = true; $('viewSeg').hidden = true; setView(false); });
  }
  if (room) { if (roomWanted) { room.size(); room.update(planState()); } }
}
let planTaps = { onTable() {} };

function render() {
  shell();
  if (!L) { $('sheet').textContent = ''; $('sheet').append(h('h2', { text: t('noLayout') }), h('p', { class: 'body', text: t('noLayoutBody') })); $('planWrap').hidden = true; return; }
  if (OWNER) renderOwner(); else renderGuest();
  plan.update(planState()); if (room && roomWanted) room.update(planState());
  $('page').dataset.mode = OWNER ? 'owner' : 'guest'; $('page').dataset.step = G.sent ? 'sent' : String(G.step);
  if (focusAfter) {
    const want = focusAfter; focusAfter = null;
    const el = want.startsWith('zone:') ? document.querySelector('[data-zone="' + want.slice(5) + '"]') : want.startsWith('req:') ? document.querySelector('.req[data-id="' + want.slice(4) + '"]') : $(want);
    if (el) { try { el.focus({ preventScroll: false }); } catch (e) { el.focus(); } }
  }
}

/* ---------- boot ---------- */
document.documentElement.classList.toggle('reduce', reduce); document.documentElement.classList.toggle('test', TEST);
if (L) {
  planTaps = {
    onZone(id) { if (OWNER) return; if (G.sent) return; if (G.step === 1) G.step = 2; if (G.step === 2 || G.step === 3) { G.zone = id; if (G.table && tableById(L, G.table).zone !== id) G.table = null; if (G.step === 3) G.step = 2; render(); } },
    onTable(id) {
      if (G.sent) return;
      if (OWNER) { if (O.swapping) { O.swapTo = id; render(); } return; }
      const tb = tableById(L, id); if (!tablesFor(L, G.party).some((x) => x.id === id)) return;
      G.zone = tb.zone; G.table = L.tableChoice ? id : null; if (G.step === 1) G.step = 2; if (G.step === 2 && L.tableChoice) G.step = 3; render();
    }
  };
  plan = drawPlan($('plan'), L, planTaps);
  $('viewSeg').hidden = roomFailed; $('view2d').addEventListener('click', () => setView(false)); $('view3d').addEventListener('click', () => setView(true));
  if (Q.get('view') === '3d') setView(true);
}
$('langBtn').addEventListener('click', () => { lang = lang === 'he' ? 'en' : 'he'; mem.set('halom-menu-lang', lang); const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u); render(); });
render();
requestAnimationFrame(() => requestAnimationFrame(() => { $('plan').classList.add('in'); }));      // the plan arrives once (600 ms); with reduced motion it is simply there
window.__seat = { state: () => ({ G: Object.assign({}, G), O: Object.assign({}, O), lang, view: roomWanted ? '3d' : '2d', room: room ? room.info() : null }), store, layout: L, render, set(patch) { Object.assign(G, patch); render(); }, setView };
