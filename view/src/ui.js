/* The DOM side: everything a guest reads. Names, prices, descriptions and availability are real text here, always, whether
   the table is drawn or not: the list (#list) holds the whole menu for a screen reader and for a phone without WebGL, and the
   card (#card) holds the dish in focus. Rendered from the navigation state; nothing here animates with CSS: the few motions
   (the card's cross-fade, the sheets, the hint) run on the page's one clock (clock.js). */
import { select, tx, formatHash, isRtl, presentation } from './store.js';
import { drinkSpec } from './drinks/spec.js';
import { formatMoney } from './snapshot.js';
import { makeT, PRODUCT } from './i18n.js';
import { tasteTags } from './tags.js';
import { paint as paintSet, durationOf } from './trayset.js';
const BACKDROP = { vitrine: 1, cellar: 1, taps: 1, cocktail: 1 };      // rooms with a backdrop made with AI (gl/rooms.js); the card says so
/* night:templates */ import { lookOf, trackOf } from './looks.js'; /* /night:templates */

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
function h(tag, attrs, kids) {
  const el = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach((k) => { const v = attrs[k]; if (v == null || v === false) return; if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v; else if (k === 'dir' || k === 'hidden' || k === 'type' || k === 'href' || k === 'src' || k === 'alt' || k === 'loading' || k === 'decoding' || k === 'width' || k === 'height' || k === 'title' || k === 'role' || k === 'tabindex' || k.startsWith('aria-') || k.startsWith('data-')) el.setAttribute(k, v === true ? '' : v); else el[k] = v; });
  (kids || []).forEach((c) => { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
  return el;
}
function svg(d, opts = {}) {
  const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', opts.box || '0 0 16 16'); s.setAttribute('width', opts.size || 14); s.setAttribute('height', opts.size || 14); s.setAttribute('aria-hidden', 'true');
  (Array.isArray(d) ? d : [d]).forEach((one) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', one.d || one); p.setAttribute('fill', one.fill || 'none'); if (!one.fill || one.stroke) { p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', one.w || 1.5); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); } s.appendChild(p); });
  return s;
}
/* what a dish is, said with a small picture; the word is its label (shown beside it in the open sheet) */
const TAG_ICON = {
  vegan: [{ d: 'M3 13c-.4-6 3.4-10 10-10 .4 6.4-3.6 10.4-10 10z', fill: 'currentColor' }, { d: 'M3 13l6-6', stroke: 1, w: 1.3 }],
  vegetarian: ['M3 13c-.4-6 3.4-10 10-10 .4 6.4-3.6 10.4-10 10zM3 13l6.2-6.2'],
  spicy: ['M8 1.6c.5 2.3 3.6 3.7 3.6 7.1A3.6 3.6 0 0 1 8 12.4a3.6 3.6 0 0 1-3.6-3.7c0-1.6.8-2.6 1.6-3.4.3 1 .8 1.6 1.5 1.7C7 5.2 7.2 3.2 8 1.6zM6.2 14.4h3.6'],
  gf: ['M8 14V6M8 6c0-1.6.6-2.9 1.6-4 .4 1.6 0 3-1.6 4zM8 9.5c-1.6 0-2.7-.7-3.4-2 1.6-.4 2.8.2 3.4 2zM8 9.5c1.6 0 2.7-.7 3.4-2-1.6-.4-2.8.2-3.4 2zM8 13c-1.6 0-2.7-.7-3.4-2 1.6-.4 2.8.2 3.4 2zM8 13c1.6 0 2.7-.7 3.4-2-1.6-.4-2.8.2-3.4 2zM2.5 2.5l11 11']
};
const ILLUS_ICON = ['M8 2.2l1.3 3.5 3.5 1.3-3.5 1.3L8 11.8 6.7 8.3 3.2 7l3.5-1.3zM12.6 11.2l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z'];

export function createUI(store, env) {
  const app = $('app'), reduce = !!env.reduce, tweens = env.tweens;
  const lang = () => store.getState().lang, t = makeT(lang), model = () => store.getModel();
  const money = (p) => (p && p.amount != null ? formatMoney(p.amount, p.currency, lang()) : '');
  const href = (route) => env.path + formatHash(route);
  const rows = new Map(), chips = new Map();
  let builtLang = null, builtRev = null, notice = null, frame = null, liftL = 0, fitTo = 0, fitNow = 0, cardKey = null, cardPhase = 'idle', lastFocus = null, listOpen = false, trayOpen = false, standKey = '', hintOn = false, hintT = 0, edgeKey = '';
  const illusLabel = () => { const l = model().snapshot.stockLabel; return (l && tx(l, lang())) || t('illus'); };
  /* night:templates */ const trackEl = () => $('dTrack') || (() => { const b = h('bdi', { class: 'track', id: 'dTrack', dir: 'ltr', hidden: true }); $('cardSwap').querySelector('.eyebrow').prepend(b); return b; })(); /* /night:templates */

  /* ---------- pieces ---------- */
  const rgb = (c) => 'rgb(' + c.map((v) => Math.round(v * 255)).join(',') + ')';
  function glassIcon(spec) {                                 // a drink with no photo: a small glass, filled with the colour the merchant chose (empty if none was given)
    const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 40 40'); s.setAttribute('aria-hidden', 'true');
    const add = (d, fill, stroke) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('fill', fill || 'none'); if (stroke) { p.setAttribute('stroke', stroke); p.setAttribute('stroke-width', '1.3'); p.setAttribute('stroke-linejoin', 'round'); p.setAttribute('stroke-linecap', 'round'); } s.appendChild(p); };
    const mix = spec.liquid ? rgb(spec.liquid.edge.map((v, i) => v * .55 + spec.liquid.deep[i] * .45)) : null, line = 'rgba(244,237,226,.62)';
    if (spec.beer) { if (mix) { add('M13.4 13.5h13.2l-1.3 17.6h-10.6z', mix); add('M13 9.8h14l-.4 3.9H13.4z', rgb(spec.liquid.foam)); } add('M12.6 8h14.8L25.7 32H14.3z', null, line); }
    else if (spec.glass === 'flute') { if (mix) add('M17.2 10h5.6c.3 5-.3 9.6-2.8 12.2-2.5-2.6-3.1-7.2-2.8-12.2z', mix); add('M17 6h6c.6 7 0 13.2-3 16.4C17 19.2 16.4 13 17 6zM20 22.4V33M15.6 33.4h8.8', null, line); }
    else { if (mix) add('M13.1 13.6h13.8c-.4 4.2-3 7-6.9 7s-6.5-2.8-6.9-7z', mix); add('M13.6 6.4h12.8c1.6 8.2-1.2 14.2-6.4 14.2S12 14.6 13.6 6.4zM20 20.6V33M15.4 33.4h9.2', null, line); }
    return h('span', { class: 'thumb drink', 'aria-hidden': 'true' }, [s]);
  }
  function thumb(item, kind) {
    const a = item.asset, pr = presentation(item, kind), spec = pr.type === 'drink' ? drinkSpec(item, kind) : null;
    if (spec) return glassIcon(spec);
    if (a && a.thumb) return h('img', { class: 'thumb' + (pr.holo ? ' holo' : ''), src: a.thumb, alt: '', loading: env.capture ? 'eager' : 'lazy', decoding: 'async', width: '64', height: '64' });      // (a film has every picture before its first frame)
    return h('span', { class: 'thumb none', 'aria-hidden': 'true', text: (tx(item.name, lang()).trim()[0] || '·') });
  }
  const illusTag = () => h('span', { class: 'illus-tag' }, [svg(ILLUS_ICON, { size: 12 }), h('span', { text: illusLabel() })]);
  function tagIcons(item, labelled) {
    const g = t.group('tags');
    return (item.tags || []).map((k) => h('li', { class: 'tag t-' + k, title: g[k] || k }, [svg(TAG_ICON[k] || TAG_ICON.vegetarian, { size: 14 }), h('span', { class: labelled ? '' : 'sr', text: g[k] || k })]));
  }

  /* ---------- the whole menu as a list (always in the page) ---------- */
  function buildList(s) {
    const body = $('listBody'); body.textContent = ''; rows.clear();
    model().cats.forEach((c) => {
      const ol = h('ol', { class: 'index' });
      c.items.forEach((item) => {
        const sold = item.available === false, note = tx(item.price.note, s.lang), pr = presentation(item, c.raw.kind), desc = tx(item.desc, s.lang);
        const a = h('a', { class: 'row' + (sold ? ' sold' : ''), href: href({ c: c.id, i: item.id }), 'data-id': item.id }, [
          thumb(item, c.raw.kind),
          h('span', { class: 'row-txt' }, [
            h('span', { class: 'row-name', text: tx(item.name, s.lang) }),
            desc ? h('span', { class: 'row-desc', text: desc }) : null,
            h('span', { class: 'row-meta' }, [pr.illustration ? illusTag() : null, sold ? h('span', { class: 'badge sold', text: t('soldOut') }) : null, h('span', { class: 'badge mine', hidden: true })].concat(tagIcons(item, false).map((li) => { const sp = h('span', { class: li.className, title: li.title }); while (li.firstChild) sp.appendChild(li.firstChild); return sp; }))),
            tasteTags(item, c.raw.kind, t, 'row')
          ]),
          h('span', { class: 'row-price' }, [h('span', { dir: 'ltr', text: money(item.price) }), note ? h('small', { text: note }) : null])
        ]);
        a.addEventListener('click', (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); env.onPick(item.id); });
        rows.set(item.id, a); ol.appendChild(h('li', null, [a]));
      });
      body.appendChild(h('section', { class: 'l-cat', 'data-id': c.id }, [h('h3', { text: tx(c.raw.name, s.lang) }), ol]));
    });
  }

  /* ---------- render ---------- */
  function shell(s) {
    const m = model(), b = m.snapshot.business, root = document.documentElement;
    root.lang = s.lang; root.dir = isRtl(s.lang) ? 'rtl' : 'ltr';
    const name = tx(b.name, s.lang); document.title = name || 'Menu';
    $('bizName').textContent = name; if (b.logo) { $('logo').src = b.logo; $('logo').hidden = false; } else $('logo').hidden = true;
    $('skip').textContent = t('skip'); $('chips').setAttribute('aria-label', t('categories')); $('gl').parentNode.setAttribute('aria-label', t('stageLabel'));
    $('langBtn').hidden = m.langs.length < 2; $('langBtn').textContent = t('lang'); $('langBtn').setAttribute('aria-label', t('langLabel')); $('langBtn').lang = s.lang === 'he' ? 'en' : 'he';
    $('listBtn').setAttribute('aria-label', t('list')); $('listBtn').title = t('list'); $('listTitle').textContent = name || t('list'); $('listClose').setAttribute('aria-label', t('close'));
    $('trayBtn').hidden = false; $('trayBtn').setAttribute('aria-label', t('tray')); $('trayBtn').title = t('tray'); $('trayTitle').textContent = t('tray'); $('trayClose').setAttribute('aria-label', t('close'));
    $('trayEmpty').textContent = t('trayEmpty'); $('trayTotalLbl').textContent = t('total'); $('trayNote').textContent = t('trayNote'); $('trayClear').textContent = t('clear');
    $('closeBtn').setAttribute('aria-label', t('close')); $('openBtn').setAttribute('aria-label', t('details')); $('pourLbl').textContent = t('pour'); $('dAllergensLbl').textContent = t('allergens') + ':'; $('dNotesTitle').textContent = t('notes');
    const pn = PRODUCT.name[s.lang] || PRODUCT.name.en;
    $('credit').textContent = t('credit', { name: pn }); $('credit').href = PRODUCT.url;
    /* only ever on a demo, never on a merchant's menu: the way back to the product page, and the word "demo" */
    $('home').hidden = !env.demo; $('demoNote').hidden = !env.demo; $('demoLine').hidden = !env.demo;
    if (env.demo) { $('home').href = env.sitePath; $('homeLbl').textContent = pn; $('home').setAttribute('aria-label', t('backTo', { name: pn })); $('demoNote').textContent = t('demoShort'); $('demoNote').title = t('demo'); $('demoLine').textContent = t('demo'); }
    else { $('homeLbl').textContent = ''; $('demoNote').textContent = ''; $('demoLine').textContent = ''; }
    /* night:templates */ if (env.demo) $('demoLine').textContent = t('demo') + '\n' + t('demoAi'); /* /night:templates */      // a demo's dishes were made with AI, and the line says so (two lines: .demo-line keeps the break)
    let host = ''; if (b.orderUrl) { try { host = new URL(b.orderUrl).hostname.replace(/^www\./, ''); } catch (e) { /* not a link */ } }
    ['orderLink', 'orderLink2'].forEach((id) => {
      const el = $(id); el.hidden = !host; if (!host) return;
      if (env.demo) { el.removeAttribute('href'); el.setAttribute('role', 'button'); el.tabIndex = 0; el.textContent = t('orderOnline'); }      // a demo's ordering page is nobody's: no host is named, and a tap explains instead of leaving (see orderSay)
      else { el.href = b.orderUrl; el.textContent = t('orderOn', { host }); }
    });
    $('orderNote').hidden = true; $('orderNote2').hidden = true;
    /* night:seating */ bookLinks(b); /* /night:seating */
    const nav = $('chips'); nav.textContent = ''; chips.clear();
    m.cats.forEach((c) => { const bt = h('button', { class: 'chip', type: 'button', 'data-id': c.id, text: tx(c.raw.name, s.lang) }); bt.addEventListener('click', () => env.onCategory(c.id)); nav.appendChild(bt); chips.set(c.id, bt); });
    buildList(s); builtLang = s.lang; builtRev = m;
    renderNotice();
  }
  function renderNotice() {
    $('notice').hidden = !notice; if (notice) { $('noticeTxt').textContent = t(notice.key); $('noticeBtn').hidden = !notice.retry; $('noticeBtn').textContent = t('tryTable'); }
  }
  function fillCard(s) {
    const v = select(s, model()), item = v.item; if (!item) return;
    $('orderNote2').hidden = true;
    const L = s.lang, sold = item.available === false, pr = v.present, d = item.details || {}, a = item.asset;
    $('card').classList.toggle('sold', sold);
    $('dName').textContent = v.itemName; $('dIdx').textContent = (v.index + 1) + ' / ' + v.count; $('dIdx').setAttribute('aria-label', t('ofCount', { i: v.index + 1, n: v.count }));
    /* night:templates */ { const lk = lookOf(model().snapshot.theme.template), on = !!lk && lk.detail === 'tracks', tr = trackEl(); tr.hidden = !on; tr.textContent = on ? trackOf(v.cat.index, v.index) : ''; } /* /night:templates */      // a listening café numbers its dishes like tracks: A1, A2 (left to right in both languages)
    $('dPrice').textContent = money(item.price); $('dNote').textContent = tx(item.price.note, L); $('dPriceRow').hidden = !$('dPrice').textContent && !$('dNote').textContent;
    $('dSold').hidden = !sold; $('dSold').textContent = t('soldOut');
    const il = $('dIllus'); il.hidden = !pr.illustration; il.textContent = ''; if (pr.illustration) { il.appendChild(svg(ILLUS_ICON, { size: 12 })); il.appendChild(h('span', { text: illusLabel() })); }
    const desc = tx(item.desc, L); $('dDesc').textContent = desc; $('dDesc').hidden = !desc; $('dDescFull').textContent = desc; $('dDescFull').hidden = !desc;
    const ul = $('dTags'); ul.textContent = ''; tagIcons(item, false).forEach((li) => ul.appendChild(li)); ul.hidden = !ul.children.length;
    const ul2 = $('dTagsFull'); ul2.textContent = ''; tagIcons(item, true).forEach((li) => ul2.appendChild(li)); ul2.hidden = !ul2.children.length;
    [['dTaste', 'card'], ['dTasteFull', 'sheet']].forEach(([id, mode]) => { const box = $(id), tg = tasteTags(item, v.kind, t, mode); box.textContent = ''; if (tg) box.appendChild(tg); box.hidden = !tg; });      // a wine's or a beer's taste, from the merchant's own fields and words
    const ra = $('dRoomAi'); ra.hidden = !(BACKDROP[v.scene] && !s.simple); ra.textContent = ra.hidden ? '' : t('roomAi');
    const line = $('dIllusLine'); line.hidden = !pr.illustration; if (pr.illustration) line.textContent = pr.type === 'drink' ? t(pr.vessel === 'can' ? 'illusCan' : pr.vessel === 'tap' || pr.vessel === 'none' ? 'illus' : 'illusBottle') : illusLabel() + ' · ' + t('illusDish');
    const al = tx(item.allergens, L); $('dAllergens').hidden = !al; $('dAllergensTxt').textContent = al;
    /* what the merchant entered about a wine or a beer: present fields only, in a fixed order; nothing is filled in for them */
    const dl = $('dFacts'), nl = $('dNotesList'); dl.textContent = ''; nl.textContent = '';
    const fact = (list, k, val) => { if (!val) return; list.appendChild(h('dt', { text: k })); list.appendChild(h('dd', { text: val })); };
    if (d.wine) { const w = d.wine, g = t.group('wine'), col = t.group('wineColor'); fact(dl, g.producer, tx(w.producer, L)); fact(dl, g.name, tx(w.name, L)); fact(dl, g.vintage, tx(w.vintage, L)); fact(dl, g.region, tx(w.region, L)); fact(dl, g.grape, tx(w.grape, L)); fact(dl, g.color, col[w.color] || ''); fact(dl, g.serving, tx(w.serving, L));
      ['sweetness', 'acidity', 'body', 'fruit', 'minerality', 'pairings'].forEach((k) => fact(nl, g[k], tx(w.notes[k], L))); }
    if (d.beer) { const b = d.beer, g = t.group('beer'); fact(dl, g.brewery, tx(b.brewery, L)); fact(dl, g.style, tx(b.style, L)); fact(dl, g.abv, tx(b.abv, L)); fact(dl, g.serving, t.group('beerServing')[b.serving] || ''); fact(dl, g.color, t.group('beerColor')[b.color] || ''); }
    dl.hidden = !dl.children.length; $('dNotes').hidden = !nl.children.length;
    const ph = $('dPhoto'), src = s.simple && a ? (a.state === 'photo' ? a.color : a.thumb) : null; ph.hidden = !src; ph.classList.toggle('holo', !!(pr.holo)); if (src && ph.getAttribute('src') !== src) ph.src = src; if (!src) ph.removeAttribute('src');
    cardKey = s.itemId + '|' + s.lang + '|' + s.simple;
    fillLive(s);
  }
  /* the parts of the card that change without the dish changing: "my table", pour, sold out arriving live */
  function fillLive(s) {
    const v = select(s, model()), item = v.item; if (!item) return;
    const sold = item.available === false, q = s.tray[item.id] || 0, lifted = s.open === 'dish';
    $('addBtn').disabled = sold; $('addBtn').setAttribute('aria-label', (sold ? t('soldOut') : t('add')) + (q ? ' · ' + q : '')); $('addBtn').title = sold ? t('soldOut') : t('add'); $('addCount').hidden = !q; $('addCount').textContent = q ? String(q) : '';
    $('addBtn2').disabled = sold; $('addBtn2').textContent = sold ? t('soldOut') : t('add') + (q ? ' · ' + q : '');
    $('pourBtn').hidden = !(lifted && !s.simple && v.present.pourable && !reduce);
    $('openBtn').setAttribute('aria-expanded', lifted ? 'true' : 'false'); $('closeBtn').hidden = !lifted; $('cardMore').inert = !lifted; $('openBtn').hidden = lifted;
  }
  /* the card's words change with a short cross-fade and a few pixels of slide, the way the table is moving */
  function setSwap(o, x, y) { const el = $('cardSwap'); el.style.opacity = o >= .999 ? '' : String(o); el.style.transform = (x || y) && !reduce ? 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)' : ''; }
  const HELD = .34;
  function swapCard(s, mx, my) {
    if (cardKey == null || env.instant()) { tweens.cancel('card'); cardPhase = 'idle'; fillCard(s); setSwap(1, 0, 0); return; }
    /* The table is flying past this dish on its way to another: a fade out and in for every dish passed is a flicker. The card
       goes down to a dim level once, the names go by on it, and it comes up again for the dish the table lands on. */
    if (cardPhase === 'held' ? env.landing && !env.landing() : env.flying && env.flying()) {
      if (cardPhase === 'held') { if (!tweens.active('card')) fillCard(s); return; }
      const top = parseFloat($('cardSwap').style.opacity || '1'); cardPhase = 'held';
      tweens.run('card', 70, (k) => setSwap(top + (HELD - top) * k, 0, 0), () => { fillCard(store.getState()); setSwap(HELD, 0, 0); });
      return;
    }
    if (cardPhase === 'out') return;                         // already on its way out: the newest dish is written when it has gone
    const from = cardPhase === 'held' ? HELD : cardPhase === 'in' ? Math.max(.2, parseFloat($('cardSwap').style.opacity || '1')) : 1; cardPhase = 'out';
    tweens.run('card', 64 * from, (k) => setSwap(from * (1 - k), mx * 6 * k, my * 5 * k), () => {
      fillCard(store.getState()); cardPhase = 'in'; if (store.getState().open === 'dish') fit(true);
      tweens.run('card', 96, (k) => setSwap(k, -mx * 6 * (1 - k), -my * 5 * (1 - k)), () => { cardPhase = 'idle'; setSwap(1, 0, 0); });
    }, true);
  }
  /* a card that was held dim while dishes went by comes up when the table is no longer passing any (it has arrived, or a finger caught it) */
  function cardLands() { if (cardPhase !== 'held' || (env.landing && !env.landing())) return; cardPhase = 'in'; fillCard(store.getState()); tweens.run('card', 110, (k) => setSwap(HELD + (1 - HELD) * k, 0, 0), () => { cardPhase = 'idle'; setSwap(1, 0, 0); }); }
  function render(s, prev, meta) {
    const m = model(), v = select(s, m); if (!v.cat) return;
    const full = !prev || prev.lang !== s.lang || builtLang !== s.lang || builtRev !== m;
    if (full) shell(s);
    app.dataset.mode = s.simple ? 'list' : 'table'; app.classList.toggle('simple', s.simple); app.classList.toggle('lifted', s.open === 'dish');
    $('listBtn').hidden = s.simple; $('scene').hidden = s.simple; $('chips').hidden = s.simple || m.cats.length < 2; $('card').hidden = s.simple && s.open !== 'dish';
    chips.forEach((b, id) => { const on = id === v.cat.id; b.setAttribute('aria-current', on ? 'true' : 'false'); if (on && (full || !prev || prev.categoryId !== s.categoryId)) scrollChip(b, !prev || full); });
    /* the card */
    const key = s.itemId + '|' + s.lang + '|' + s.simple;
    if (key !== cardKey || full) {
      const dir = s.nav.dir || 0, w = env.walk(), side = isRtl(s.lang) ? -1 : 1;
      if (full || !prev || prev.simple !== s.simple || (meta && meta.fromLoad)) { cardKey = null; swapCard(s, 0, 0); }
      else swapCard(s, s.nav.kind === 'category' ? -dir * side : 0, s.nav.kind === 'category' ? 0 : dir * w);
    } else fillLive(s);
    /* the list: where you are, what is on your table */
    rows.forEach((a, id) => {
      const q = s.tray[id] || 0, mine = a.querySelector('.badge.mine'); mine.hidden = !q; if (q) mine.textContent = t('added') + ' · ' + q;
      if (id === s.itemId) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      if (s.simple || s.open === 'list') a.removeAttribute('tabindex'); else a.setAttribute('tabindex', '-1');
    });
    [$('listClose'), $('credit'), $('noticeBtn')].forEach((el) => { if (s.simple || s.open === 'list') el.removeAttribute('tabindex'); else el.setAttribute('tabindex', '-1'); });      // closed, the list waits below the screen: read by a screen reader, skipped by Tab
    const n = Object.keys(s.tray).reduce((acc, id) => acc + s.tray[id], 0); $('trayCount').textContent = String(n); $('trayCount').hidden = !n; $('trayBtn').setAttribute('aria-label', t('tray') + (n ? ' · ' + n : ''));
    /* sheets */
    sheets(s, prev);
    if (prev && prev.open !== s.open) { $('orderNote').hidden = true; $('orderNote2').hidden = true; }
    if (trayOpen) renderTray();
    if (s.open === 'dish' && !s.simple) fit(!!prev && prev.open === 'dish');
    if (s.simple && (!prev || prev.open !== s.open || !prev.simple)) simpleLift(s.open === 'dish');
    else if (prev && prev.simple && !s.simple) { tweens.cancel('lift'); $('backdrop').style.opacity = ''; $('backdrop').hidden = !listOpen && !trayOpen; setLift(s.open === 'dish' ? liftL : 0); }      // the table is back: the card follows its spring again, and nothing lies over the scene
    if (!prev || prev.nav.seq !== s.nav.seq || full) announce(s, v, prev);
    if (prev && prev.open === 'dish' && s.open !== 'dish' && document.activeElement && $('cardMore').contains(document.activeElement)) focusQuiet($('openBtn'));
  }
  function focusQuiet(el) { if (el) try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  function scrollChip(b, instant) {
    const nav = $('chips'), r = b.getBoundingClientRect(), nr = nav.getBoundingClientRect(), from = nav.scrollLeft, to = from + (r.left + r.width / 2) - (nr.left + nr.width / 2);
    if (instant || reduce || env.instant()) { nav.scrollLeft = to; return; }
    tweens.run('chips', 260, (k) => { nav.scrollLeft = from + (to - from) * k; });
  }
  function announce(s, v, prev) {
    const it = v.item; if (!it) return;
    let msg = [v.itemName, money(it.price), it.available === false ? t('soldOut') : '', v.present.illustration ? illusLabel() : '', t('ofCount', { i: v.index + 1, n: v.count })].filter(Boolean).join(', ');
    if (!prev || prev.categoryId !== s.categoryId) msg = v.categoryName + '. ' + msg;
    if (s.nav.kind === 'edge') msg = s.nav.dir > 0 && v.nextCat && s.nav.axis === 'x' ? t('nextCat', { cat: tx(v.nextCat.raw.name, s.lang) }) : msg;
    $('live').textContent = msg;
  }

  /* ---------- the card and its sheet ---------- */
  function layout(f) { frame = f; const st = app.style; st.setProperty('--card-h', f.cardH + 'px'); st.setProperty('--sheet-h', f.sheetH + 'px'); st.setProperty('--card-w', (f.cardW || 0) + 'px'); app.classList.toggle('wide', !!f.wide); app.classList.toggle('standing', !!f.standing); fitTo = 0; fit(false); setLift(liftL); }
  /* A lifted dish gets a sheet as tall as what there is to say about it, and no taller than the sheet's full height:
     a salad with one line keeps most of the screen for the salad. fitTo = where it is going, fitNow = where it is drawn. */
  function fit(animate) {
    if (!frame) return;
    let want = frame.sheetH;
    if (app.classList.contains('lifted') && !app.classList.contains('simple')) { const last = $('cardMore').lastElementChild, pad = parseFloat(getComputedStyle($('cardMore')).paddingBottom) || 20; want = Math.max(frame.cardH, Math.min(frame.sheetH, Math.ceil(last.offsetTop + last.offsetHeight + pad))); }      // from the top of the card to under its last button
    if (want === fitTo) return;
    const from = fitNow || want; fitTo = want; if (env.onSheet) env.onSheet(want);
    if (!animate || reduce || env.instant() || Math.abs(from - want) < 2) { tweens.cancel('fit'); fitNow = want; setLift(liftL); return; }
    tweens.run('fit', 200, (k) => { fitNow = from + (want - from) * k; setLift(liftL); });
  }
  function setLift(L) {
    liftL = L; if (!frame) return;
    const el = $('card'), k = Math.max(0, L), y = (frame.sheetH - frame.cardH) - k * ((fitNow || frame.sheetH) - frame.cardH);
    el.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
    el.style.clipPath = frame.wide ? 'inset(0 0 ' + Math.max(0, y).toFixed(1) + 'px 0 round 22px)' : '';      // at the side it is a card of its own, whole at any height
    $('cardMore').style.opacity = app.classList.contains('lifted') || k < .01 ? '' : String(Math.max(0, Math.min(1, (k - .62) / .38)).toFixed(3));      // put back, the sheet's words leave before the card has come down: nothing is read twice
    const c = $('chips'), o = Math.max(0, 1 - k * 1.6); c.style.opacity = o >= .999 ? '' : String(o.toFixed(3)); c.style.pointerEvents = o < .5 ? 'none' : '';
  }
  function simpleLift(on) {                                  // without the table there is no spring to follow: the sheet simply comes up
    const f = frame || { sheetH: Math.round(window.innerHeight * .8), cardH: 0, cardW: 0, wide: false }; if (!frame) { app.style.setProperty('--sheet-h', f.sheetH + 'px'); app.style.setProperty('--card-h', '0px'); }
    const from = liftL, to = on ? 1 : 0, el = $('card');
    tweens.run('lift', env.instant() ? 0 : 240, (k) => { liftL = from + (to - from) * k; el.style.transform = 'translateY(' + ((1 - liftL) * f.sheetH).toFixed(1) + 'px)'; });
    $('backdrop').hidden = !on && !listOpen && !trayOpen; $('backdrop').style.opacity = on ? '1' : '';
  }

  /* ---------- the list and "my table" as sheets ---------- */
  function slide(el, key, open, done) {
    const ms = env.instant() ? 0 : 280;
    if (open) { el.classList.add('open'); if (reduce) el.style.transform = 'none'; }      // reduced motion: it fades in where it stands
    tweens.run(key, ms, (k) => { const y = (open ? 1 - k : k) * 100; if (reduce) el.style.opacity = String(open ? k : 1 - k); else el.style.transform = y <= .01 ? 'none' : 'translateY(' + y.toFixed(2) + '%)'; $('backdrop').style.opacity = String((open ? k : 1 - k).toFixed(3)); },
      () => { if (!open) { el.classList.remove('open'); el.style.transform = ''; el.style.opacity = ''; } else { el.style.transform = 'none'; el.style.opacity = ''; } if (done) done(); });
  }
  function sheets(s, prev) {
    const wantList = s.open === 'list', wantTray = s.open === 'tray';
    if (wantList !== listOpen) {
      listOpen = wantList;
      if (wantList) { lastFocus = document.activeElement; $('backdrop').hidden = false; $('list').setAttribute('role', 'dialog'); $('list').setAttribute('aria-modal', 'true'); slide($('list'), 'list', true); const cur = rows.get(s.itemId); if (cur) { const body = $('list'); body.scrollTop = Math.max(0, cur.offsetTop - body.clientHeight * .3); } focusQuiet($('listClose')); }
      else { $('list').removeAttribute('role'); $('list').removeAttribute('aria-modal'); slide($('list'), 'list', false, () => { if (!listOpen && !trayOpen && !(store.getState().simple && store.getState().open === 'dish')) $('backdrop').hidden = true; }); if (lastFocus && lastFocus.focus && document.contains(lastFocus)) focusQuiet(lastFocus); lastFocus = null; }
    }
    if (wantTray !== trayOpen) {
      trayOpen = wantTray;
      if (wantTray) { lastFocus = document.activeElement; renderTray(); $('backdrop').hidden = false; $('traySheet').hidden = false; slide($('traySheet'), 'tray', true); focusQuiet($('trayClose')); setTable(true); }
      else { slide($('traySheet'), 'tray', false, () => { if (!trayOpen) $('traySheet').hidden = true; if (!listOpen && !trayOpen && !(store.getState().simple && store.getState().open === 'dish')) $('backdrop').hidden = true; }); if (lastFocus && lastFocus.focus && document.contains(lastFocus)) focusQuiet(lastFocus); lastFocus = null; }
    }
    const modal = listOpen || trayOpen; $('top').inert = modal; $('card').inert = modal; void prev;
  }
  function renderTray() {
    const s = store.getState(), ul = $('trayList'); ul.textContent = ''; let n = 0, sum = 0, cur = null, mixed = false;
    Object.keys(s.tray).forEach((id) => {
      const e = model().itemById.get(id); if (!e) return; const q = s.tray[id], p = e.item.price, name = tx(e.item.name, s.lang); n += q;
      if (p.amount != null) { sum += q * p.amount; if (cur && cur !== p.currency) mixed = true; cur = p.currency; }
      const mk = (txt, label, dq) => { const b = h('button', { type: 'button', text: txt, 'aria-label': label + ': ' + name }); b.addEventListener('click', () => store.dispatch({ type: 'traySet', id, qty: q + dq })); return b; };
      ul.appendChild(h('li', null, [h('span', { class: 'l-name', text: name }), h('span', { class: 'stepper' }, [mk('−', t('remove'), -1), h('span', { text: String(q) }), mk('+', t('more'), 1)]), h('span', { class: 'l-price', dir: 'ltr', text: p.amount != null ? formatMoney(q * p.amount, p.currency, s.lang) : '' })]));
    });
    $('trayEmpty').hidden = n > 0; $('trayTotalRow').hidden = n === 0 || mixed || !cur; $('trayNote').hidden = n === 0; $('trayClear').hidden = n === 0;
    $('trayTotal').textContent = cur && !mixed ? formatMoney(sum, cur, s.lang) : ''; $('trayTotal').dir = 'ltr';
    if (trayOpen) setTable(false);
  }
  /* "my table" sets itself (trayset.js): played when the sheet opens; a change while it is open is shown set */
  const imgs = new Map(); let setKey = '', setAt = 0;
  const imgOf = (url) => { if (!url) return null; let im = imgs.get(url); if (!im) { im = new Image(); im.decoding = 'async'; im.onload = () => { if (trayOpen && !tweens.active('trayset')) setTable(false); }; im.src = url; imgs.set(url, im); } return im.complete && im.naturalWidth ? im : null; };
  function setTable(play) {
    const cv = $('traySet'), s = store.getState(), L = s.lang, ids = Object.keys(s.tray).filter((id) => model().itemById.get(id));
    cv.hidden = !ids.length; if (!ids.length) { tweens.cancel('trayset'); setKey = ''; return; }
    const entries = ids.slice(0, 8).map((id) => { const e = model().itemById.get(id), k = e.cat.raw.kind, sp = drinkSpec(e.item, k), a = e.item.asset; return { id, drink: k === 'wine' || k === 'beer' || k === 'drinks', url: a && a.thumb && !a.stock ? a.thumb : null, colour: sp && sp.liquid ? 'rgb(' + sp.liquid.edge.map((v, i) => Math.round((v * .6 + sp.liquid.deep[i] * .4) * 255)).join(',') + ')' : null, initial: (tx(e.item.name, L).trim()[0] || '·') }; });
    const names = ids.map((id) => tx(model().itemById.get(id).item.name, L)).join(', ');
    cv.setAttribute('aria-label', t('trayScene') + ': ' + names);
    const w = Math.max(200, Math.round((cv.clientWidth || 340) * Math.min(2, window.devicePixelRatio || 1))); if (cv.width !== w) { cv.width = w; cv.height = Math.round(w / 2.2); }
    const items = () => entries.map((e) => ({ drink: e.drink, img: imgOf(e.url), colour: e.colour, initial: e.initial })), rtl = isRtl(L), key = ids.join('|') + L, end = durationOf(entries.length);
    entries.forEach((e) => imgOf(e.url));
    if (!play || reduce || env.instant()) { if (play || key !== setKey || !tweens.active('trayset')) { tweens.cancel('trayset'); paintSet(cv, end, items(), rtl); } setKey = key; return; }
    setKey = key; setAt = 0;
    tweens.run('trayset', end * 1000, (k) => { setAt = k * end; paintSet(cv, setAt, items(), rtl); }, () => paintSet(cv, end, items(), rtl), true);
  }

  /* ---------- small things ---------- */
  /* while the first picture is on its way, the small one we already have stands exactly where the dish will be, and sharpens into it */
  function standin(item, kind, rect, on) {
    const el = $('standin'), a = item && item.asset, src = on && a && a.thumb && presentation(item, kind).type !== 'text' && !a.stock ? a.thumb : null, key = (src || '') + '|' + (rect ? rect.join() : '');
    if (!src) { if (!el.hidden && standKey) { standKey = ''; tweens.run('standin', env.instant() ? 0 : 320, (k) => { el.style.opacity = String(1 - k); el.style.filter = 'blur(' + (5 * (1 - k)).toFixed(1) + 'px)'; }, () => { el.hidden = true; el.removeAttribute('src'); }); } return; }
    if (key === standKey) return; standKey = key; tweens.cancel('standin');
    if (el.getAttribute('src') !== src) el.src = src;
    el.style.left = rect[0] + 'px'; el.style.top = rect[1] + 'px'; el.style.width = rect[2] + 'px'; el.style.height = rect[3] + 'px'; el.style.opacity = '1'; el.style.filter = 'blur(5px)'; el.hidden = false;
  }
  /* Reduced motion: the table does not travel to another section or to the bar. The picture as it stood (handed over by the
     stage, just drawn) lies over the scene for a moment and fades: a plain cross-fade to wherever the guest now is. */
  function cut(picture) {
    const el = $('cut'); if (!el || env.instant()) return;
    try { el.width = picture.width; el.height = picture.height; el.getContext('2d').drawImage(picture, 0, 0); } catch (e) { return; }
    el.hidden = false; el.style.opacity = '1';
    tweens.run('cut', 280, (k) => { el.style.opacity = String((1 - k).toFixed(3)); }, () => { el.hidden = true; el.width = el.height = 1; }, true);
  }
  /* the first-visit hint: a hand that shows the glide once. It is drawn by the clock, never by CSS. */
  function hint(on, dir) {
    const el = $('hint'); if (on === hintOn) return; hintOn = on;
    if (!on) { tweens.run('hint', env.instant() ? 0 : 180, (k) => { el.style.opacity = String(1 - k); }, () => { el.hidden = true; }); return; }
    el.hidden = false; el.dataset.dir = dir > 0 ? 'down' : 'up'; el.setAttribute('title', t(dir > 0 ? 'hintPull' : 'hintUp')); hintT = 0;
    const loop = () => { if (!hintOn) return; tweens.run('hint', 1700, (k) => { const m = k < .12 ? k / .12 : k > .8 ? (1 - k) / .2 : 1, tr = k < .15 ? 0 : k > .7 ? 1 : (k - .15) / .55, e = tr * tr * (3 - 2 * tr); el.style.opacity = String(Math.max(0, m) * .95); el.style.transform = 'translate(-50%,' + ((e - .5) * 86 * dir).toFixed(1) + 'px)'; }, () => { if (hintOn && ++hintT < 40) loop(); }, true); };
    loop();
  }
  /* pulled past the last dish of a category: the name of the one that follows, growing with the pull */
  function edge(amount, ahead, name, armed) {
    const el = $('edge'), key = amount > .02 ? name + '|' + ahead + '|' + armed + '|' + amount.toFixed(2) : '';
    if (key === edgeKey) return; edgeKey = key;
    if (!key) { el.hidden = true; return; }
    el.hidden = false; $('edgeTxt').textContent = name; el.dataset.at = ahead ? 'far' : 'near'; el.classList.toggle('armed', !!armed); el.style.opacity = String(Math.min(1, amount * 1.4).toFixed(2)); el.style.transform = 'translate(-50%,0) scale(' + (.9 + .1 * Math.min(1, amount)).toFixed(3) + ')';
  }
  function finger(x, y, down) { const el = $('finger'); if (x == null) { el.hidden = true; return; } el.hidden = false; el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)'; el.classList.toggle('down', !!down); }

  /* night:seating */
  /* "Book a table": the business's own booking page (business.bookUrl, an https link) in a new tab; a demo's button opens
     Mana's seat map for that demo instead (seat/?demo=<slug>). Never counted. The two links stand next to the ordering ones. */
  const bookEls = ['orderLink', 'orderLink2'].map((id) => { const a = h('a', { class: 'ghost order book', hidden: true }); $(id).insertAdjacentElement('afterend', a); return a; });
  function bookLinks(b) {
    const demoHref = env.demo ? new URL('seat/?demo=' + encodeURIComponent(model().slug) + '&lang=' + lang(), document.baseURI).href : null;
    const href = b.bookUrl ? (env.demo ? demoHref : b.bookUrl) : null;      // the button exists only when the business has a booking page
    bookEls.forEach((a) => {
      a.hidden = !href; if (!href) return;
      a.href = href; a.textContent = t('bookTable');
      if (env.demo) { a.removeAttribute('target'); a.removeAttribute('rel'); } else { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    });
  }
  /* /night:seating */

  /* ---------- wiring that belongs to the DOM ---------- */
  $('skip').addEventListener('click', (e) => { e.preventDefault(); if (!store.getState().simple) store.dispatch({ type: 'open', what: 'list' }, { via: 'key' }); focusQuiet(rows.get(store.getState().itemId) || $('list')); });
  $('langBtn').addEventListener('click', () => { const m = model(), i = m.langs.indexOf(lang()); env.setLang(m.langs[(i + 1) % m.langs.length]); });
  $('listBtn').addEventListener('click', () => store.dispatch({ type: 'open', what: 'list' }, { via: 'button' }));
  $('listClose').addEventListener('click', () => store.dispatch({ type: 'close' }, { via: 'button' }));
  $('trayBtn').addEventListener('click', () => store.dispatch({ type: 'open', what: 'tray' }, { via: 'button' }));
  $('trayClose').addEventListener('click', () => store.dispatch({ type: 'close' }, { via: 'button' }));
  $('backdrop').addEventListener('click', () => store.dispatch({ type: 'close' }, { via: 'outside' }));
  $('trayClear').addEventListener('click', () => store.dispatch({ type: 'trayClear' }));
  $('noticeBtn').addEventListener('click', () => env.retryTable());
  $('openBtn').addEventListener('click', () => env.onLift(true));
  $('closeBtn').addEventListener('click', () => env.onLift(false));
  $('pourBtn').addEventListener('click', () => store.dispatch({ type: 'pourAgain' }, { via: 'button' }));
  /* In a demo the ordering button does not leave the page: it says what it does in a merchant's own menu. */
  const orderSay = (id) => { const n = $(id === 'orderLink' ? 'orderNote' : 'orderNote2'); n.textContent = t('orderDemo'); n.hidden = false; if (id === 'orderLink2') fit(true); };
  ['orderLink', 'orderLink2'].forEach((id) => {
    $(id).addEventListener('click', (e) => { if (!env.demo) return; e.preventDefault(); orderSay(id); });
    $(id).addEventListener('keydown', (e) => { if (env.demo && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); orderSay(id); } });
  });
  const add = () => { const s = store.getState(); if (s.itemId != null) env.onAdd(s.itemId); };
  $('addBtn').addEventListener('click', add); $('addBtn2').addEventListener('click', add);
  /* the card can be pulled up into its sheet and pushed back down */
  (() => {
    const head = $('cardHead'); let p = null;
    head.addEventListener('pointerdown', (e) => { if (e.button) return; p = { id: e.pointerId, y: e.clientY, done: false }; });
    head.addEventListener('pointermove', (e) => { if (!p || e.pointerId !== p.id || p.done) return; const dy = e.clientY - p.y, open = store.getState().open === 'dish'; if (!open && dy < -26) { p.done = true; env.onLift(true); } else if (open && dy > 34) { p.done = true; env.onLift(false); } });
    const end = (e) => { if (p && e.pointerId === p.id) { const moved = p.done; p = null; if (moved) { const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); }; head.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => head.removeEventListener('click', stop, { capture: true }), 80); } } };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
  })();

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (frame) { fitTo = 0; fit(false); } });      // the words may wrap differently once their own letters have arrived

  return { render, layout, setLift, sheet: () => fitTo, standin, hint, edge, finger, cut, cardLands, renderNotice, t, rows,
    setNotice(n) { notice = n; renderNotice(); }, rebuild() { builtLang = null; cardKey = null; },
    isModal: () => listOpen || trayOpen };
}

/* ---------- status pages: loading, not available, not found, did not load ---------- */
export function showStatus(kind, data) {
  const st = $('status'); if (!kind) { st.classList.add('off'); st.setAttribute('aria-hidden', 'true'); st.hidden = true; return; }
  const L = data && data.lang ? data.lang : (document.documentElement.lang === 'en' ? 'en' : 'he'), tt = makeT(() => L);
  st.hidden = false; st.classList.remove('off'); st.removeAttribute('aria-hidden'); st.dataset.kind = kind;
  if (kind !== 'loading' && kind !== 'preview') { document.documentElement.lang = L; document.documentElement.dir = isRtl(L) ? 'rtl' : 'ltr'; }
  const name = data && data.name ? data.name : '';
  const map = { loading: [tt('loading'), ''], unavailable: [tt('unavailableTitle'), name ? tt('unavailableBody', { name }) : tt('unavailableBodyAnon')], not_found: [tt('notFoundTitle'), tt('notFoundBody')], error: [tt('errorTitle'), tt('errorBody')], preview: [tt('previewTitle'), tt('previewBody')], empty: [tt('emptyTitle'), tt('emptyBody')] };
  $('statusTitle').textContent = (map[kind] || map.error)[0]; $('statusBody').textContent = (map[kind] || map.error)[1]; $('statusBody').hidden = !$('statusBody').textContent;
  const btn = $('statusBtn'); btn.hidden = kind !== 'error' || !(data && data.retry); btn.textContent = tt('retry'); btn.onclick = data && data.retry ? data.retry : null;
  if (kind === 'unavailable' && name) document.title = name;
}
