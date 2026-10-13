/* The demo dialog ("the demo should be in the demo button"): the real guest menu in a frame, its looks, the seat map, the film.
   The frame is made when the dialog opens and removed when it closes; Esc and the close button close it; focus stays inside
   while it is open (a modal <dialog>) and returns to the button that opened it. #demo in the address opens it too. Without
   script (or without <dialog>) every button that opens it is a plain link to the demo. */
export function initDialog({ $, $$, mq, lang, root }) {
  const doc = document, dlg = $('#demo');
  if (!dlg || typeof dlg.showModal !== 'function') return;
  const screen = $('#dlg-screen', dlg), stage = $('.dlg-stage', dlg), looksBar = $('.dlg-looks', dlg), filmBox = $('.dlg-film', dlg), video = filmBox && $('video', filmBox);
  const TITLE = { menu: { he: 'תפריט ההדגמה של אוליאה', en: 'The Olea demo menu' }, seat: { he: 'מפת ישיבה', en: 'Seat map' }, tables: { he: 'שעון לשולחן', en: 'Table clocks' } };
  let tab = 'menu', look = 'album-side', frame = null, opener = null;
  const wide = () => mq('(min-width: 900px) and (min-height: 600px)');

  function src() {
    if (tab === 'seat') return './view/seat/?demo=olea&lang=' + lang();
    if (tab === 'tables') return './view/host/?demo=olea&speed=60&lang=' + lang();      // the manager's board, its clock one minute a second
    return './view/?demo=olea&lang=' + lang() + (tab === 'looks' ? '&template=' + look : '');
  }
  /* on a wide screen the menu stands in a phone: the frame is a phone's size (390 × 844), scaled to the phone drawn here */
  function fit() {
    if (!wide()) { screen.style.width = screen.style.height = ''; screen.style.removeProperty('--s'); return; }
    const H = Math.max(320, Math.min(stage.clientHeight - 16, 780)), sh = H - 20, sw = Math.round(sh * 390 / 844);
    screen.style.width = sw + 'px'; screen.style.height = sh + 'px'; screen.style.setProperty('--s', (sw / 390).toFixed(4));
  }
  function dropFrame() { if (frame && frame.parentNode) frame.parentNode.removeChild(frame); frame = null; }
  function stopFilm() { if (!video) return; try { video.pause(); } catch (e) { /* not started */ } if (video.getAttribute('src')) { video.removeAttribute('src'); video.load(); } }
  function playFilm() {
    if (!video) return;
    const tall = mq('(max-width: 720px) and (orientation: portrait)'), key = 'data-film-' + (tall ? 'tall' : 'wide');
    const u = (lang() === 'en' && dlg.getAttribute(key + '-en')) || dlg.getAttribute(key);
    if (u && video.getAttribute('src') !== u) video.setAttribute('src', u);
    const p = video.play(); if (p && p.catch) p.catch(() => { /* the controls are there */ });
  }
  function load() {
    dlg.setAttribute('data-tab', tab);
    looksBar.hidden = tab !== 'looks'; if (filmBox) filmBox.hidden = tab !== 'film';
    if (tab === 'film') { dropFrame(); playFilm(); return; }
    stopFilm();
    if (!frame) {
      frame = doc.createElement('iframe');
      frame.setAttribute('allow', 'fullscreen; accelerometer; gyroscope');
      screen.appendChild(frame);
    }
    frame.setAttribute('title', (TITLE[tab] || TITLE.menu)[lang()]);
    const u = src(); if (frame.getAttribute('src') !== u) frame.setAttribute('src', u);
    fit();
  }
  function setTab(id) {
    tab = ['menu', 'looks', 'seat', 'tables', 'film'].indexOf(id) >= 0 && (id !== 'film' || filmBox) ? id : 'menu';
    $$('.dlg-tab', dlg).forEach((b) => b.setAttribute('aria-pressed', b.getAttribute('data-tab') === tab ? 'true' : 'false'));
  }
  function open(id) {
    if (dlg.open) { setTab(id); load(); return; }
    opener = doc.activeElement; setTab(id); dlg.showModal(); root.classList.add('dlg-open'); doc.dispatchEvent(new CustomEvent('mana:dialog', { detail: true })); load();
    const b = $('.dlg-tab[aria-pressed="true"]', dlg); if (b) b.focus();
  }
  function close() { dropFrame(); stopFilm(); if (dlg.open) dlg.close(); }
  dlg.addEventListener('close', () => {
    dropFrame(); stopFilm(); root.classList.remove('dlg-open'); doc.dispatchEvent(new CustomEvent('mana:dialog', { detail: false }));
    if (location.hash === '#demo') try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    if (opener && opener.focus && doc.contains(opener)) opener.focus(); opener = null;
  });
  dlg.addEventListener('cancel', () => { dropFrame(); stopFilm(); });                   // Esc: the frame goes at once (the close event follows a moment later)
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });           // a click outside the sheet
  $$('[data-dlg-close]', dlg).forEach((b) => b.addEventListener('click', close));
  $$('.dlg-tab', dlg).forEach((b) => b.addEventListener('click', () => { setTab(b.getAttribute('data-tab')); load(); }));
  $$('.dlg-look', dlg).forEach((b) => b.addEventListener('click', () => {
    look = b.getAttribute('data-look'); $$('.dlg-look', dlg).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); load();
  }));
  $$('[data-demo-open]').forEach((a) => a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;                    // a new tab: the plain link
    e.preventDefault(); open(a.getAttribute('data-demo-open') || 'menu');
  }));
  /* the framed demo's "← Mana" link loads this page inside the frame; that page tells us, and the dialog closes */
  window.addEventListener('message', (ev) => {
    if (ev.origin !== location.origin || !ev.data || ev.data.type !== 'mana-site-home' || !frame || ev.source !== frame.contentWindow) return;
    close();
  });
  window.addEventListener('resize', () => { if (dlg.open && frame) fit(); });
  doc.addEventListener('mana:lang', () => { if (dlg.open) load(); });
  const fromHash = () => { if (location.hash === '#demo') open('menu'); };
  window.addEventListener('hashchange', fromHash); fromHash();
}
