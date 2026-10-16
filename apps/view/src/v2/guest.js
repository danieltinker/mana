/* The guest menu on the v2 clean schema (F07): loaded by main.js, as a chunk of its own, only when
   HALOM_MENUS_CONFIG.schema is 2. The table, the list, the card and their navigation are the v1 menu's own; this adds
   what a v2 menu has, through the hooks ui.js calls (`hooks`) and the store's state:

     the dish sheet    add-on groups (single and multiple, min/max, required or optional, defaults, a price per
                       option, a quantity per option up to its maximum, sold-out options greyed), the nested group of a
                       chosen opener inline (one level), the running price, what is still needed; "goes well with"
     one suggestion    matchSuggestion on the sheet, add and checkout triggers; accept adds it, dismiss keeps every
                       choice; never pre-selected or chained (the contracts), the exposure cap per visit (recordShown)
     "my table"        a basket of lines (choices, quantity, change, remove), the total with VAT included; a line that
                       can no longer be ordered is marked and explained. Ordering itself is phase 2 (basket.priced)
     the tag filter    vegan, vegetarian, spicy, gluten-free: says when it is on; what it hides is never suggested
     live              public_menu again on return to the page and every `liveEveryMs` (30 s): a dish taken off greys
                       at once; the clock moves day parts and "back at 14:30" in between
     events            the seven guest events through track_events (events.js): no cookie, nothing about the person

   Every price, limit, default, availability and suggestion is @mana/contracts' (through menu.js, choices.js,
   basket.js); nothing here depends on WebGL, so the list view gets exactly the same choices. */
import { TAGS, priceDish } from '@mana/contracts';
import { closedText, filtered, filteredOut, loadMenu, matchesTags, poll, refresh, rpc, setLive, toModel } from './menu.js';
import { chosenList, groupIn, issues, qtyOf, runningPrice, setOption, startOf, unitsOf } from './choices.js';
import { addLine, counts, lineOf, priced, readLines, removeLine, replaceSelection, setQuantity, storedLines } from './basket.js';
import { createEvents } from './events.js';
import { createVisit } from './visit.js';
import { word } from './i18n.js';
import { CSS } from './style.js';

export { loadMenu };

const $ = (id) => document.getElementById(id);
const FILTER_ICON = ['M2.5 4h11M4.8 8h6.4M7 12h2'];

/**
 * @param model  the menu as menu.js reads it (toModel)
 * @param o.env  { fetch, config, window }   o.mem: the page's storage wrapper   o.src: 'qr' | 'link'
 * @param o.kit  the v1 menu's own pieces, handed in by main.js (see menu.js): its sanitizers, ui.js's h, svg and
 *               TAG_ICON, store.js's tx, snapshot.js's formatMoney
 */
export function createGuest(model, { env, mem, src, kit }) {
  const { h, svg, TAG_ICON, tx, formatMoney } = kit;
  let full = model, store = null, ui = null, page = null;
  let items = indexItems(full);
  const basketKey = 'mana-basket:' + full.slug;
  let lines = (() => { try { return readLines(JSON.parse(mem.get(basketKey) || 'null')); } catch (e) { return []; } })();
  let session = null, sessions = 0, pendingEdit = null, sheetFromSuggestion = null, tried = false, flashUntil = 0, flashTimer = null;
  const visit = createVisit(full.v2.snap.upsellRules, full.v2.menu), viewed = new Set();
  let tags = [], panelOpen = false, barLang = null, availKey = '', builtKey = '', sugKeys = {}, polling = false;
  const els = {};
  const ev = createEvents({
    venueId: full.v2.snap.venueId, tz: full.v2.snap.venue.timeZone,
    send: (batch, { keepalive }) => rpc(env, 'track_events', { p_events: batch }, { keepalive }).then((r) => ({ ok: r.ok, status: r.status }))
  });

  const g = () => full.v2, ctx = () => full.v2.ctx;
  const lang = () => (store ? store.getState().lang : full.locale.default);
  const name = (t) => tx(t, lang());
  const money = (amount) => formatMoney(amount, 'ILS', lang());
  const dish = (id) => g().menu.dishes.get(id);
  const groupOf = (id) => g().menu.groups.get(id);
  const optionOf = (groupId, optionId) => { const gr = groupOf(groupId); return gr ? gr.options.find((o) => o.id === optionId) : undefined; };
  const optionName = (id) => { for (const gr of g().snap.addonGroups) { const o = gr.options.find((x) => x.id === id); if (o) return name(o.name); } return ''; };
  const shownNow = (id) => !!store && store.getModel().itemById.has(id);
  const hidden = () => filteredOut(full, tags);
  const say = (text) => { if (els.live) { els.live.textContent = ''; els.live.textContent = text; } };

  /* ---------- the basket, kept on this phone ---------- */
  function save() { mem.set(basketKey, JSON.stringify(storedLines(lines))); }
  function changed() { save(); sync(); }
  /* the store's per-dish counts follow the basket (never from inside another notification: a microtask later) */
  function sync() { if (store) queueMicrotask(() => store.dispatch({ type: 'traySync', tray: counts(lines) })); }

  /* ---------- suggestions: one at a time, never chained, capped per visit ---------- */
  function offer(trigger, dishId, selection, { fromSuggestion = false, where, lineKey = null } = {}) {
    const p = visit.offer(trigger, { dishId, selection, basket: lines.map((l) => ({ dishId: l.dishId, selection: l.selection })), unavailable: g().unavailable,
      filteredOut: hidden(), fromSuggestion, where, lineKey });
    if (!p) return null;
    ev.emit('suggestion_shown', { ruleId: p.ruleId, trigger, dishId });
    say(word(lang(), 'suggestion') + ': ' + name(p.line));
    return p;
  }
  function accept() {
    const p = visit.accept(); if (!p) return;
    ev.emit('suggestion_accepted', { ruleId: p.ruleId, trigger: p.trigger, dishId: p.dishId });
    const sg = p.suggest;
    if (sg.kind === 'dish') {
      const d = dish(sg.dishId), sel = startOf(d, ctx());
      if (priceDish(d, sel, ctx()).ok) addToBasket(d, sel, { fromSuggestion: true, where: p.where });
      else { sheetFromSuggestion = d.id; store.dispatch({ type: 'open', what: 'dish', id: d.id }, { via: 'suggestion' }); }      // its choices are the guest's to make
    } else if (p.trigger === 'sheet' && session && session.dishId === p.dishId) {
      session.selection = setOption(session.selection, ctx(), { groupId: sg.groupId, optionId: sg.optionId, qty: qtyOf(session.selection, sg.groupId, sg.optionId) + 1 });
      ev.emit('addon_chosen', { dishId: p.dishId, groupId: sg.groupId, optionId: sg.optionId, parentOptionId: null });
    } else {
      const l = lines.find((x) => x.key === p.lineKey), d = l && dish(l.dishId);
      if (d) {
        const sel = setOption(l.selection, ctx(), { groupId: sg.groupId, optionId: sg.optionId, qty: qtyOf(l.selection, sg.groupId, sg.optionId) + 1 });
        if (priceDish(d, Object.assign({}, sel, { quantity: l.quantity }), ctx()).ok) {
          lines = replaceSelection(lines, l.key, sel); changed();
          ev.emit('addon_chosen', { dishId: p.dishId, groupId: sg.groupId, optionId: sg.optionId, parentOptionId: null });
        }
      }
    }
    redrawAll();
  }
  function dismiss() {
    const p = visit.dismiss(); if (!p) return;
    ev.emit('suggestion_dismissed', { ruleId: p.ruleId, trigger: p.trigger, dishId: p.dishId });
    redrawAll();
  }
  /* the guest chose the suggested option themselves (or can no longer take it): it simply goes */
  function dropStale() {
    const p = visit.pending;
    if (!p || p.trigger !== 'sheet' || p.suggest.kind !== 'option' || !session) return;
    const sg = p.suggest, a = dish(session.dishId).addons.find((x) => x.groupId === sg.groupId), gs = groupIn(session.selection, sg.groupId);
    if (qtyOf(session.selection, sg.groupId, sg.optionId) > 0 || !a || unitsOf(gs) >= a.max || (groupOf(sg.groupId).selection === 'single' && unitsOf(gs) > 0)) visit.drop();
  }

  /* ---------- adding ---------- */
  function addToBasket(d, sel, { fromSuggestion, where }) {
    lines = addLine(lines, d.id, sel, 1, items.get(d.id).name);
    const line = lineOf(lines, d.id, sel);
    changed();
    ev.emit('basket_added', { dishId: d.id, qty: 1, fromSuggestion });
    say(word(lang(), 'added') + ': ' + name(d.name));
    offer('add', d.id, sel, { fromSuggestion, where, lineKey: line ? line.key : null });
  }
  /** "Add to my table", from the card or from the sheet. A dish with choices opens its sheet first. */
  function add(id) {
    const s = store.getState(), d = dish(id), it = items.get(id);
    if (!d || !it || !it.available) return;
    if (s.open === 'dish' && session && session.dishId === id) return addFromSheet();
    if (d.addons.length) return void store.dispatch({ type: 'open', what: 'dish', id }, { via: 'card' });
    addToBasket(d, { quantity: 1, groups: [] }, { fromSuggestion: false, where: 'float' });
    redrawAll();
  }
  function addFromSheet() {
    const d = dish(session.dishId), r = priceDish(d, session.selection, ctx());
    if (!r.ok) { tried = true; updateSheet(); focusMissing(); return; }      // what is missing is said beside the button, and the focus goes there
    if (session.editKey) {
      lines = replaceSelection(lines, session.editKey, session.selection); changed();
      session = null; store.dispatch({ type: 'open', what: 'tray' }, { via: 'button' });
      return;
    }
    addToBasket(d, session.selection, { fromSuggestion: session.fromSuggestion, where: 'sheet' });
    session.fromSuggestion = false; tried = false;
    flashUntil = Date.now() + 1600; clearTimeout(flashTimer); flashTimer = setTimeout(() => { flashUntil = 0; redrawSheet(); }, 1650);
    redrawAll();
  }
  function focusMissing() {
    const fs = els.groups.querySelector('.v2-group.need');
    const target = fs && fs.querySelector('input:not(:disabled), button:not(:disabled)');
    if (target) { target.focus({ preventScroll: true }); fs.scrollIntoView({ block: 'nearest' }); }
  }

  /* ---------- the sheet: one session per dish opened ---------- */
  function openSession(dishId, { quiet = false } = {}) {
    const d = dish(dishId);
    if (!d) { session = null; return; }
    const edit = pendingEdit && pendingEdit.dishId === dishId ? pendingEdit : null, fromSug = sheetFromSuggestion === dishId;
    pendingEdit = null; sheetFromSuggestion = null; tried = false; flashUntil = 0;
    session = { n: ++sessions, dishId, selection: edit ? edit.selection : startOf(d, ctx()), editKey: edit ? edit.key : null, fromSuggestion: fromSug };
    if (visit.pending && visit.pending.where !== 'tray') visit.drop();
    if (!quiet && !edit && items.get(dishId).available) offer('sheet', dishId, session.selection, { fromSuggestion: fromSug, where: 'sheet' });
  }
  function choose(groupId, optionId, parentOptionId, qty) {
    if (!session) return;
    const before = qtyOf(session.selection, groupId, optionId, parentOptionId);
    session.selection = setOption(session.selection, ctx(), { groupId, optionId, parentOptionId, qty });
    if (before === 0 && qty > 0) ev.emit('addon_chosen', { dishId: session.dishId, groupId, optionId, parentOptionId });
    dropStale();
    redrawSheet();
  }
  function clearGroup(groupId, parentOptionId) {
    const gs = groupIn(session.selection, groupId, parentOptionId);
    for (const o of gs ? [...gs.options] : []) session.selection = setOption(session.selection, ctx(), { groupId, optionId: o.optionId, parentOptionId, qty: 0 });
    redrawSheet();
  }

  function hintOf(limits) {
    const L = lang();
    if (limits.min >= 1) return (limits.min === limits.max ? (limits.min === 1 ? word(L, 'chooseOne') : word(L, 'chooseN', { n: limits.min })) : word(L, 'range', { min: limits.min, max: limits.max })) + ' · ' + word(L, 'required');
    return (limits.max === 1 ? '' : word(L, 'upTo', { n: limits.max }) + ' · ') + word(L, 'optional');
  }
  function groupEl(group, limits, parentOptionId) {
    const L = lang(), single = group.selection === 'single', radio = 'v2-' + session.n + '-' + group.id + '-' + (parentOptionId || 'top');
    const fs = h('fieldset', { class: 'v2-group', 'data-g': group.id, 'data-p': parentOptionId || '' }, [
      h('legend', null, [h('span', { class: 'g-name', text: name(group.name) }), h('span', { class: 'g-hint', text: hintOf(limits) })])
    ]);
    if (single && limits.min === 0) {
      const input = h('input', { type: 'radio', name: radio, 'data-none': '1' });
      input.addEventListener('change', () => { if (input.checked) clearGroup(group.id, parentOptionId); });
      fs.appendChild(h('label', { class: 'opt none' }, [input, h('span', { class: 'o-mark', 'aria-hidden': 'true' }), h('span', { class: 'o-name', text: word(L, 'none') }), h('span', { class: 'o-price' })]));
    }
    for (const o of group.options) {
      const off = g().unavailable.options.has(o.id), oname = name(o.name), price = o.price > 0 ? word(L, 'plus', { price: money(o.price) }) : '';
      const nameEl = h('span', { class: 'o-name' }, [oname, off ? h('small', { text: word(L, 'soldOut') }) : null]);
      if (!single && o.maxQty > 1) {
        const less = h('button', { type: 'button', 'aria-label': word(L, 'oneLess', { name: oname }), text: '−' }), more = h('button', { type: 'button', 'aria-label': word(L, 'oneMore', { name: oname }), text: '+' });
        const out = h('output', { 'aria-live': 'polite', 'aria-label': oname, text: '0' });
        less.addEventListener('click', () => choose(group.id, o.id, parentOptionId, qtyOf(session.selection, group.id, o.id, parentOptionId) - 1));
        more.addEventListener('click', () => choose(group.id, o.id, parentOptionId, qtyOf(session.selection, group.id, o.id, parentOptionId) + 1));
        fs.appendChild(h('div', { class: 'opt qty' + (off ? ' sold' : ''), 'data-o': o.id, role: 'group', 'aria-label': oname }, [h('span', { class: 'o-mark', 'aria-hidden': 'true' }), nameEl, h('span', { class: 'o-price', dir: 'ltr', text: price }), h('span', { class: 'stepper' }, [less, out, more])]));
      } else {
        const input = h('input', { type: single ? 'radio' : 'checkbox', name: single ? radio : null, value: o.id });
        input.addEventListener('change', () => choose(group.id, o.id, parentOptionId, input.checked ? 1 : 0));
        fs.appendChild(h('label', { class: 'opt' + (single ? '' : ' multi') + (off ? ' sold' : ''), 'data-o': o.id }, [input, h('span', { class: 'o-mark', 'aria-hidden': 'true' }), nameEl, h('span', { class: 'o-price', dir: 'ltr', text: price })]));
      }
      if (parentOptionId === null && o.opensGroupId !== null) {
        const nested = groupOf(o.opensGroupId);
        if (nested) fs.appendChild(h('div', { class: 'v2-nested', 'data-for': o.id, hidden: true }, [groupEl(nested, nested, o.id)]));
      }
    }
    return fs;
  }
  function relatedEl(d) {
    const L = lang(), list = els.rel;
    list.textContent = '';
    for (const id of d.related) {
      const it = items.get(id);
      if (!it || !it.available || !shownNow(id)) continue;
      const a = it.asset, pic = a && a.thumb && !a.stock ? h('img', { class: 'thumb', src: a.thumb, alt: '', loading: 'lazy', width: '40', height: '40' }) : h('span', { class: 'thumb', 'aria-hidden': 'true', text: name(it.name).trim()[0] || '·' });
      const b = h('button', { type: 'button', 'data-id': id }, [pic, h('span', { class: 'r-txt' }, [h('span', { class: 'r-name', text: name(it.name) }),
        h('span', { class: 'r-price' }, [it.price.from ? word(L, 'from') + ' ' : '', h('span', { dir: 'ltr', text: money(it.price.amount) })])])]);
      b.addEventListener('click', () => store.dispatch({ type: 'open', what: 'dish', id }, { via: 'related' }));
      list.appendChild(b);
    }
    els.relTitle.textContent = word(L, 'goesWell');
    els.related.hidden = !list.children.length;
  }

  /** The sheet for the dish in focus, built once per dish (and language, and change of what is available)… */
  function buildSheet() {
    const d = dish(session.dishId);
    builtKey = session.n + '|' + lang() + '|' + availKey;
    els.groups.textContent = '';
    for (const a of d.addons) { const gr = groupOf(a.groupId); if (gr) els.groups.appendChild(groupEl(gr, a, null)); }
    relatedEl(d);
    updateSheet();
  }
  /** …and brought up to date in place on every choice, so the focus stays where the guest is. */
  function updateSheet() {
    const L = lang(), d = dish(session.dishId), it = items.get(session.dishId), sel = session.selection, off = g().unavailable.options;
    const iss = issues(d, sel, ctx()), need = new Set(iss.missing.map((m) => m.groupId + '|' + (m.parentOptionId || '')));
    for (const fs of els.groups.querySelectorAll('.v2-group')) {
      const gid = fs.dataset.g, parent = fs.dataset.p || null, gr = groupOf(gid), limits = parent ? gr : d.addons.find((a) => a.groupId === gid);
      const units = unitsOf(groupIn(sel, gid, parent)), isFull = gr.selection === 'multiple' && units >= limits.max;
      fs.classList.toggle('need', tried && need.has(gid + '|' + (parent || '')));
      for (const row of fs.querySelectorAll(':scope > .opt')) {
        const input = row.querySelector('input');
        if (row.classList.contains('none')) { input.checked = units === 0; continue; }
        const oid = row.dataset.o, q = qtyOf(sel, gid, oid, parent), isOff = off.has(oid), o = gr.options.find((x) => x.id === oid);
        row.classList.toggle('on', q > 0); row.classList.toggle('full', isFull);
        if (input) { input.checked = q > 0; input.disabled = gr.selection === 'single' ? isOff : (isOff || isFull) && q === 0; }
        else {
          const [less, out, more] = row.querySelectorAll('.stepper > *');
          out.textContent = String(q); row.querySelector('.o-mark').textContent = q ? String(q) : ''; less.disabled = q === 0; more.disabled = isOff || q >= o.maxQty || isFull;
        }
      }
      for (const box of fs.querySelectorAll(':scope > .v2-nested')) box.hidden = qtyOf(sel, gid, box.dataset.for, null) === 0;
    }
    $('card').classList.toggle('v2-choices', d.addons.length > 0);
    if (!it.available) { els.need.hidden = true; return; }      // ui.js has said why ("Sold out", "Served from 07:00") and disabled adding
    const r = runningPrice(d, sel, ctx()), btn = $('addBtn2'), flash = Date.now() < flashUntil;
    btn.disabled = false; btn.classList.toggle('added', flash);
    btn.textContent = flash ? word(L, 'added') : r.ok ? word(L, session.editKey ? 'savePrice' : 'addPrice', { price: money(r.unit) }) : word(L, session.editKey ? 'save' : 'add');
    const offNames = iss.off.map(optionName);
    const needNames = iss.missing.map((m) => name(groupOf(m.groupId).name));
    els.need.classList.toggle('off', offNames.length > 0);
    els.need.textContent = offNames.length ? word(L, 'lineOptionOff', { name: offNames.join(', ') }) : needNames.length ? word(L, 'stillNeeded', { groups: needNames.join(', ') }) : '';
    els.need.hidden = !els.need.textContent;
    if (els.need.hidden) btn.removeAttribute('aria-describedby'); else btn.setAttribute('aria-describedby', 'v2Need');
  }
  function redrawSheet() {
    if (!session || !store || store.getState().open !== 'dish') return;
    if (builtKey !== session.n + '|' + lang() + '|' + availKey) buildSheet(); else updateSheet();
    renderSuggestions(store.getState());
    if (ui && !store.getState().simple) ui.refit();
  }

  /* ---------- the suggestion, where it belongs: in the sheet, over the card, or in "my table" ---------- */
  function sugEl(p) {
    const L = lang(), sg = p.suggest, what = [];
    if (sg.kind === 'dish') {
      const it = items.get(sg.dishId);
      what.push(h('b', { text: name(it.name) }), h('span', null, [it.price.from ? word(L, 'from') + ' ' : '', h('span', { dir: 'ltr', text: money(it.price.amount) })]));
    } else {
      const o = optionOf(sg.groupId, sg.optionId);
      what.push(h('b', { text: name(o.name) }), o.price > 0 ? h('span', { dir: 'ltr', text: word(L, 'plus', { price: money(o.price) }) }) : null);
    }
    const yes = h('button', { class: 'primary', type: 'button', text: word(L, 'accept') }), no = h('button', { class: 'ghost', type: 'button', text: word(L, 'dismiss') });
    yes.addEventListener('click', accept); no.addEventListener('click', dismiss);
    return h('aside', { class: 'v2-sug', role: 'group', 'aria-label': word(L, 'suggestion') }, [
      h('p', { class: 's-kicker', text: word(L, 'suggestion') }), h('p', { class: 's-line', text: name(p.line) }), h('p', { class: 's-what' }, what), h('div', { class: 's-acts' }, [yes, no])
    ]);
  }
  function slot(el, where, extraClass) {
    const p = visit.pending && visit.pending.where === where ? visit.pending : null, key = p ? p.ruleId + '|' + lang() + '|' + p.seen : '';
    if (sugKeys[where] === key) return;
    sugKeys[where] = key; el.textContent = '';
    el.hidden = !p;
    if (p) { const card = sugEl(p); if (extraClass) card.classList.add(extraClass); el.appendChild(card); }
  }
  function renderSuggestions(s) {
    const p = visit.pending;
    if (p && p.where === 'float' && (s.open || p.dishId !== s.itemId)) visit.drop();      // it was about the dish the guest has moved on from
    slot(els.sheetSug, 'sheet'); slot(els.float, 'float', 'v2-float'); slot(els.traySug, 'tray');
  }

  /* ---------- "my table" ---------- */
  function lineEl(x) {
    const L = lang(), l = x.line, it = items.get(l.dishId), d = dish(l.dishId);
    const label = it ? name(it.name) : (l.name ? name(l.name) : '');
    const choices = chosenList(l.selection).map((c) => { const o = optionOf(c.groupId, c.optionId); return o ? name(o.name) + (c.qty > 1 ? ' × ' + c.qty : '') : null; }).filter(Boolean).join(' · ');
    let why = null, later = false;
    if (!x.ok) {
      if (x.why === 'gone') why = word(L, 'lineGone');
      else if (x.why === 'off') { later = !!it && it.availKind === 'later'; why = later ? word(L, 'lineLater', { label: name(it.availLabel) }) : word(L, 'lineOff'); }
      else if (x.why === 'option') why = word(L, 'lineOptionOff', { name: optionName(x.optionId) });
      else why = word(L, 'lineChoose');
    }
    const step = (txt, label2, dq, act) => { const b = h('button', { type: 'button', text: txt, 'aria-label': label2 + ': ' + label, 'data-line': l.key, 'data-act': act }); b.addEventListener('click', () => { lines = setQuantity(lines, l.key, l.quantity + dq); changed(); ui.renderTray(); }); return b; };
    const acts = [h('span', { class: 'stepper' }, [step('−', ui.t('remove'), -1, 'less'), h('span', { text: String(l.quantity) }), step('+', ui.t('more'), 1, 'more')])];
    if (d && d.addons.length && x.why !== 'off' && x.why !== 'gone') { const b = h('button', { class: 'link', type: 'button', text: word(L, 'edit'), 'aria-label': word(L, 'edit') + ': ' + label, 'data-line': l.key, 'data-act': 'edit' }); b.addEventListener('click', () => edit(l.key)); acts.push(b); }
    const rm = h('button', { class: 'link', type: 'button', text: word(L, 'removeLine'), 'aria-label': word(L, 'removeLine') + ': ' + label, 'data-line': l.key, 'data-act': 'remove' });
    rm.addEventListener('click', () => { lines = removeLine(lines, l.key); changed(); ui.renderTray(); });
    acts.push(rm);
    return h('li', { class: 'v2-line' + (x.ok ? '' : ' off'), 'data-line': l.key }, [
      h('div', { class: 'l-main' }, [h('span', { class: 'l-name', text: label }), choices ? h('span', { class: 'l-choices', text: choices }) : null, why ? h('span', { class: 'l-why' + (later ? ' later' : ''), text: why }) : null]),
      h('span', { class: 'l-price' }, x.ok ? [h('span', { dir: 'ltr', text: money(x.total) })] : [h('small', { text: word(L, 'lineNotCounted') })]),
      h('div', { class: 'l-acts' }, acts)
    ]);
  }
  function tray(s) {
    const L = lang(), P = priced(lines, g().menu, ctx()), ul = $('trayList'), focus = document.activeElement, keep = focus && focus.dataset ? [focus.dataset.line, focus.dataset.act] : null;
    ul.textContent = '';
    for (const x of P.lines) ul.appendChild(lineEl(x));
    const any = lines.length > 0;
    $('trayEmpty').hidden = any; $('trayTotalRow').hidden = !any; $('trayNote').hidden = !any; $('trayClear').hidden = !any;
    $('trayTotal').textContent = money(P.total); $('trayTotal').dir = 'ltr';
    els.vat.hidden = !any; els.vat.textContent = word(L, 'vat');
    if (keep && keep[0]) { const again = ul.querySelector('[data-line="' + keep[0] + '"][data-act="' + keep[1] + '"]') || ul.querySelector('[data-act]') || $('trayClose'); if (again) again.focus({ preventScroll: true }); }
    renderSuggestions(s);
  }
  function edit(key) {
    const l = lines.find((x) => x.key === key);
    if (!l) return;
    if (!shownNow(l.dishId)) setTags([]);                    // the filter hides it: show everything again, to change it
    pendingEdit = l;
    store.dispatch({ type: 'open', what: 'dish', id: l.dishId }, { via: 'tray' });
  }

  /* ---------- the tag filter and the line under the bar ---------- */
  const tagWord = (t) => (ui ? ui.t.group('tags')[t] : t) || t;
  const present = () => TAGS.filter((t) => [...items.values()].some((it) => matchesTags(it.tags, [t])));
  const countWith = (list) => [...items.values()].filter((it) => matchesTags(it.tags, list)).length;
  function setTags(next) {
    tags = TAGS.filter((t) => next.includes(t));
    if (page) page.remodel();
    renderBar();
  }
  function renderBar() {
    const L = lang(), on = tags.length > 0, onText = word(L, 'filterOn', { tags: tags.map(tagWord).join(', ') });
    els.filterBtn.hidden = present().length === 0;
    els.filterBtn.classList.toggle('v2-on', on);
    els.filterBtn.setAttribute('aria-expanded', panelOpen ? 'true' : 'false');
    els.filterBtn.setAttribute('aria-label', word(L, 'filter') + (on ? ' · ' + onText : '')); els.filterBtn.title = word(L, 'filter');
    els.panel.hidden = !panelOpen;
    els.panelTitle.textContent = word(L, 'filterTitle');
    for (const t of TAGS) {
      const b = els.tagBtns[t], pressed = tags.includes(t), n = countWith(pressed ? tags : tags.concat(t));
      b.hidden = !present().includes(t);
      b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      b.disabled = !pressed && n === 0;
      b.querySelector('span').textContent = tagWord(t);
      b.querySelector('small').textContent = n === 1 ? word(L, 'filterCountOne') : word(L, 'filterCount', { n });
    }
    els.allBtn.hidden = !on; els.allBtn.textContent = word(L, 'filterClear');
    els.notes.textContent = '';
    if (on) {
      const x = h('button', { type: 'button', 'aria-label': word(L, 'filterClear') }, [svg(['M4 4l8 8M12 4l-8 8'], { size: 12 })]);
      x.addEventListener('click', () => setTags([]));
      els.notes.appendChild(h('p', { class: 'v2-pill on', role: 'status' }, [h('span', { text: onText }), x]));
    }
    const closed = closedText(full, L);
    if (closed) els.notes.appendChild(h('p', { class: 'v2-pill closed', text: closed }));
    $('app').style.setProperty('--v2-notes', els.notes.offsetHeight + 'px');      // the list, under the bar, starts below this line too
  }
  function mount() {
    document.head.appendChild(h('style', { id: 'v2Style', text: CSS }));
    /* an option focused low in the sheet must scroll the sheet, never the page under it (overflow:clip where supported, this elsewhere) */
    $('app').addEventListener('scroll', () => { if ($('app').scrollTop) $('app').scrollTop = 0; });
    const more = $('cardMore'), actions = more.querySelector('.actions');
    els.groups = h('div', { class: 'v2-groups', id: 'v2Groups' });
    els.relTitle = h('h2'); els.rel = h('div', { class: 'v2-rel' });
    els.related = h('section', { class: 'v2-related', id: 'v2Related', hidden: true }, [els.relTitle, els.rel]);
    els.sheetSug = h('div', { class: 'v2-slot', id: 'v2SheetSug', hidden: true });
    els.need = h('p', { class: 'v2-need', id: 'v2Need', role: 'status', hidden: true });
    for (const el of [els.groups, els.related]) more.insertBefore(el, actions);
    actions.prepend(els.sheetSug, els.need);                  // above the add button, in the part of the sheet that stays on screen: what is suggested is seen
    els.float = h('div', { id: 'v2Float', hidden: true }); $('card').after(els.float);
    els.traySug = h('div', { id: 'v2TraySug', hidden: true }); $('traySheet').insertBefore(els.traySug, $('trayTotalRow'));
    els.vat = h('p', { class: 'v2-vat', id: 'v2Vat', hidden: true }); $('trayTotalRow').after(els.vat);
    els.live = h('div', { class: 'sr', 'aria-live': 'polite', 'aria-atomic': 'true' }); $('app').appendChild(els.live);
    /* the filter: a tool in the bar, its choices under it, and the line that says it is on */
    els.filterBtn = h('button', { class: 'tool', id: 'v2FilterBtn', type: 'button', 'aria-controls': 'v2Filter' }, [svg(FILTER_ICON, { size: 18 })]);
    els.filterBtn.addEventListener('click', () => { panelOpen = !panelOpen; renderBar(); if (panelOpen) { const first = els.panel.querySelector('.v2-tag:not([hidden]):not(:disabled)'); if (first) first.focus({ preventScroll: true }); } });
    $('langBtn').before(els.filterBtn);
    els.panelTitle = h('h2', { id: 'v2FilterTitle' }); els.tagBtns = {};
    const row = h('div', { class: 'v2-tags' });
    for (const t of TAGS) {
      const b = h('button', { class: 'v2-tag t-' + t, type: 'button', 'aria-pressed': 'false' }, [svg(TAG_ICON[t], { size: 15 }), h('span'), h('small')]);
      b.addEventListener('click', () => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : tags.concat(t)));
      els.tagBtns[t] = b; row.appendChild(b);
    }
    els.allBtn = h('button', { class: 'link', type: 'button', hidden: true }); els.allBtn.addEventListener('click', () => setTags([]));
    els.panel = h('div', { class: 'v2-panel', id: 'v2Filter', role: 'group', 'aria-labelledby': 'v2FilterTitle', hidden: true }, [els.panelTitle, row, els.allBtn]);
    els.notes = h('div', { class: 'v2-notes' });
    $('top').querySelector('.bar').after(els.panel, els.notes);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panelOpen) { e.preventDefault(); panelOpen = false; renderBar(); els.filterBtn.focus(); } }, true);
    document.addEventListener('pointerdown', (e) => { if (panelOpen && !els.panel.contains(e.target) && !els.filterBtn.contains(e.target)) { panelOpen = false; renderBar(); } });
  }

  /* ---------- live: the overlay again, and the clock ---------- */
  function applyAvailability(key) {
    if (key === availKey) return;
    availKey = key;
    if (page) page.redraw();
    renderBar();
  }
  async function tick() {
    if (polling) return;
    polling = true;
    try {
      const r = await poll(full, env);
      if (r.state === 'live') applyAvailability(setLive(full, r.live));
      else if (r.state === 'revision') reload(toModel(r.raw.snapshot, r.raw.live, kit));
      else applyAvailability(refresh(full));
    } catch (e) {
      applyAvailability(refresh(full));                        // offline: the clock still moves (day parts, "back at 14:30")
    } finally { polling = false; }
  }
  function reload(m) {                                         // the owner published again: the new menu, the same basket
    full = m; items = indexItems(full); session = null; visit.use(full.v2.snap.upsellRules, full.v2.menu); builtKey = ''; availKey = refresh(full);
    if (page) page.reload(full);
  }
  function startLive() {
    const every = Number(env.config && env.config.liveEveryMs) > 0 ? Number(env.config.liveEveryMs) : 30000, doc = document;
    setInterval(() => { if (doc.visibilityState !== 'hidden') tick(); }, every);
    doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') tick(); else ev.flush({ keepalive: true }); });
    window.addEventListener('pagehide', () => ev.flush({ keepalive: true }));
    window.addEventListener('online', () => tick());
  }

  function redrawAll() {
    if (!store) return;
    const s = store.getState();
    redrawSheet();
    renderSuggestions(s);
    if (s.open === 'tray' && ui) ui.renderTray();
  }

  /* ---------- the state ---------- */
  function onState(s, prev, a) {
    if (a.type === 'load') {                                   // a new model (the filter, or a new revision)
      if (session && (s.open !== 'dish' || s.itemId !== session.dishId)) session = null;
      if (s.open === 'dish' && !session) openSession(s.itemId, { quiet: true });
      sync();
      return;
    }
    if (a.type === 'trayClear') { lines = []; save(); }
    const lifted = s.open === 'dish';
    if (lifted && (prev.open !== 'dish' || prev.itemId !== s.itemId || !session)) openSession(s.itemId);
    const p = visit.pending;
    if (!lifted && prev.open === 'dish') { session = null; if (p && p.where === 'sheet') visit.drop(); }
    if (s.open === 'tray' && prev.open !== 'tray') { if (p && p.where !== 'tray') visit.drop(); if (lines.length) offer('checkout', null, null, { where: 'tray' }); }
    else if (s.open !== 'tray' && prev.open === 'tray' && p && p.where === 'tray') visit.drop();
  }

  /** What ui.js calls (env.v2). */
  const hooks = {
    word: (key) => word(lang(), key),
    card(s, item) {
      if (!els.groups) return;
      if (s.open === 'dish' && session && session.dishId === item.id) {
        if (builtKey !== session.n + '|' + lang() + '|' + availKey) buildSheet(); else updateSheet();
      } else { $('card').classList.remove('v2-choices'); els.need.hidden = true; }
      renderSuggestions(s);
      if (barLang !== lang()) { barLang = lang(); renderBar(); }
    },
    tray
  };

  return {
    hooks,
    shown: (m) => filtered(m, tags),
    counts: () => counts(lines),
    attach(st) { store = st; store.subscribe(onState); },
    bind(u, p) {
      ui = u; page = p; availKey = refresh(full);
      mount(); renderBar();
      const s = store.getState();
      ev.emit('menu_opened', { src, lang: s.lang, revision: full.revision });
      if (s.open === 'dish') openSession(s.itemId);
      sync();
      startLive();
    },
    add,
    track(id, kind) { if (kind !== 'open' || viewed.has(id)) return false; viewed.add(id); ev.emit('dish_viewed', { dishId: id }); return true; },
    flush: () => ev.drained(),
    refresh: () => tick(),
    debug: () => ({ lines: lines.map((l) => ({ key: l.key, dishId: l.dishId, quantity: l.quantity, selection: l.selection })),
      pending: visit.pending && { ruleId: visit.pending.ruleId, trigger: visit.pending.trigger, where: visit.pending.where, suggest: visit.pending.suggest },
      session: session && { dishId: session.dishId, selection: session.selection, editKey: session.editKey }, tags: [...tags], ...visit.memory(), queued: ev.pending(),
      total: priced(lines, g().menu, ctx()).total, closed: g().closed })
  };
}

function indexItems(model) {
  const m = new Map();
  for (const c of model.categories) for (const it of c.items) m.set(it.id, it);
  return m;
}
