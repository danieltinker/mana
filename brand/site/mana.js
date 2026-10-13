/* Mana product page, version 3: language switch, the hero (the dish on the table, live), the drawn flow, the live demo, the film and the "talk to us" form.
   No dependencies. Everything on the page reads and links without this file; it only adds the behaviours above.
   Nothing here downloads the viewer or a video before the page has painted, and never on Save-Data. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement, qs = new URLSearchParams(location.search);
  var $ = function (s, el) { return (el || doc).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || doc).querySelectorAll(s)); };
  var store = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
  var mq = function (q) { return !!(window.matchMedia && matchMedia(q).matches); };
  var saveData = !!(navigator.connection && navigator.connection.saveData) || qs.get('save') === '1';
  var reduced = mq('(prefers-reduced-motion: reduce)') || qs.get('motion') === 'reduce';
  var framed = false; try { framed = window.top !== window.self; } catch (e) { framed = true; }

  /* The demo menu has a "← Mana" link. When the demo runs inside this page's phone frame, that link loads this page
     INSIDE the frame: tell the page around us to put the still back and go to its top instead of nesting. */
  if (framed) { try { if (window.parent.location.origin === location.origin) window.parent.postMessage({ type: 'mana-site-home' }, location.origin); } catch (e) { /* another site framed us: nothing to do */ } }

  /* ---------------------------------------------------------------- language (Hebrew first) */
  function lang() { return root.lang === 'en' ? 'en' : 'he'; }
  function setLang(l, remember) {
    l = l === 'en' ? 'en' : 'he';
    root.lang = l; root.dir = l === 'he' ? 'rtl' : 'ltr';
    if (remember) store.set('mana-lang', l);
    var t = root.getAttribute('data-title-' + l); if (t) doc.title = t;
    var d = $('meta[name="description"]'), dd = root.getAttribute('data-desc-' + l); if (d && dd) d.setAttribute('content', dd);
    $$('[data-href-' + l + ']').forEach(function (a) { a.setAttribute('href', a.getAttribute('data-href-' + l)); });
    $$('[data-label-' + l + ']').forEach(function (i) { i.setAttribute('aria-label', i.getAttribute('data-label-' + l)); });
    doc.dispatchEvent(new CustomEvent('mana:lang', { detail: l }));
  }
  setLang(qs.get('lang') || store.get('mana-lang') || root.lang, false);
  $$('[data-lang-toggle]').forEach(function (b) { b.addEventListener('click', function () { setLang(lang() === 'he' ? 'en' : 'he', true); }); });

  /* ---------------------------------------------------------------- reveals: the flow's line draws itself, the sample numbers grow
     Without this (no script, reduced motion, no IntersectionObserver) everything is simply drawn. */
  var reveals = $$('.reveal');
  if (reveals.length && !reduced && 'IntersectionObserver' in window && qs.get('motion') !== 'off') {
    root.classList.add('anim');
    var rio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } }); }, { threshold: 0.3 });
    reveals.forEach(function (el) { rio.observe(el); });
    /* a second trigger, so that a section can never stay undrawn if the observer is late: the same test, made on scroll */
    var waiting = reveals.slice(), tick = false;
    var seen = function () {
      tick = false; var vh = window.innerHeight || root.clientHeight;
      waiting = waiting.filter(function (el) {
        if (el.classList.contains('in')) return false;
        var r = el.getBoundingClientRect(), vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        if (vis >= Math.min(r.height, vh) * 0.3) { el.classList.add('in'); rio.unobserve(el); return false; }
        return true;
      });
      if (!waiting.length) { window.removeEventListener('scroll', onMove); window.removeEventListener('resize', onMove); }
    };
    var onMove = function () { if (!tick) { tick = true; requestAnimationFrame(seen); } };
    window.addEventListener('scroll', onMove, { passive: true }); window.addEventListener('resize', onMove);
  }

  /* ---------------------------------------------------------------- the hero: the dish alone on the table
     The dish's flat photo is in the HTML and paints first, placed where the guest view will stand the dish (the same framing
     as view/src/scenes/walk.js frameOf, for a frame that is not "wide"). After the page has painted, and never on Save-Data,
     the guest view opens in hero mode in an iframe over it: the live relief rises in the same place. Off screen the page tells
     the frame to stop its clock; Enter inside the frame opens the full demo. */
  var heroStage = $('#hero-stage'), poster = heroStage && $('.hero-poster', heroStage);
  function placePoster() {
    if (!heroStage || !poster) return;
    var W = heroStage.clientWidth, H = heroStage.clientHeight; if (!W || !H) return;
    var top = H < 520 ? 88 : 100, cardH = Math.max(148, Math.min(190, Math.round(H * .2))), freeH = H - top - cardH;
    var hero = Math.min(W * .84, freeH * .74), side = hero / .94, cy = top + freeH * .47;          // PLATE = SIZE × .94: the photo's square is a little wider than the plate
    poster.style.width = poster.style.height = Math.round(side) + 'px'; poster.style.left = Math.round(W / 2) + 'px'; poster.style.top = Math.round(cy) + 'px';
  }
  placePoster();
  if (heroStage && !framed) (function () {
    var frame = null, visible = true, state = 'still', timer = 0;
    function src() { return heroStage.getAttribute('data-src-' + lang()); }
    function tell(run) { if (frame && frame.contentWindow) { try { frame.contentWindow.postMessage({ type: 'mana-hero', run: run }, location.origin); } catch (e) { /* gone */ } } }
    function setState(st) { state = st; heroStage.setAttribute('data-hero', st); if (st === 'rest') { var h = $('.hero-hint', heroStage); if (h) h.hidden = false; } }
    function start() {
      if (frame) return;
      frame = doc.createElement('iframe');
      frame.setAttribute('title', heroStage.getAttribute('data-title-' + lang()));
      frame.setAttribute('loading', 'eager'); frame.setAttribute('allow', 'accelerometer; gyroscope'); frame.className = 'hero-frame';
      frame.addEventListener('load', function () { clearTimeout(timer); setState('loaded'); timer = setTimeout(function () { if (state === 'loaded') stop(); }, 30000); });      // nothing drawn in 30 s: the still stays
      timer = setTimeout(function () { if (state === 'loading') stop(); }, 25000);
      setState('loading'); frame.src = src(); heroStage.appendChild(frame);
    }
    function stop() { clearTimeout(timer); if (frame && frame.parentNode) frame.parentNode.removeChild(frame); frame = null; setState('still'); }
    window.addEventListener('message', function (ev) {
      if (ev.origin !== location.origin || !ev.data || ev.data.type !== 'mana-hero' || !frame || ev.source !== frame.contentWindow) return;
      if (ev.data.open === 'demo') { var a = $('[data-demo-link]', heroStage); if (a) location.href = a.getAttribute('href'); return; }
      if (ev.data.state) { clearTimeout(timer); setState(ev.data.state); if (!visible) tell(false); }
    });
    doc.addEventListener('mana:lang', function () { if (frame) { frame.src = src(); frame.setAttribute('title', heroStage.getAttribute('data-title-' + lang())); setState('loading'); } });
    window.addEventListener('resize', placePoster);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { visible = e[0].isIntersecting; tell(visible); }, { threshold: 0.1 }).observe(heroStage);
    if (saveData || qs.get('hero') === 'off') return;
    var go = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(function () { if (visible) start(); else { var once = function () { if (visible) { start(); } else setTimeout(once, 500); }; once(); } }); };
    if (doc.readyState === 'complete') go(); else window.addEventListener('load', go);
  })();

  /* ---------------------------------------------------------------- the English display face (Fraunces, declared in mana.css): fetched at idle on the English page,
     and the moment the language switch is hovered or focused, so it never swaps inside the switch itself. The Hebrew page never asks for it. */
  var fraunces = false;
  function loadFraunces() { if (fraunces || !doc.fonts || !doc.fonts.load) return; fraunces = true; try { doc.fonts.load('400 1em Fraunces').catch(function () { /* the fallback serif stays */ }); } catch (e) { /* ignore */ } }
  if (lang() === 'en') (window.requestIdleCallback || function (f) { setTimeout(f, 300); })(loadFraunces);
  $$('[data-lang-toggle]').forEach(function (b) { b.addEventListener('mouseenter', loadFraunces); b.addEventListener('focus', loadFraunces); b.addEventListener('touchstart', loadFraunces, { passive: true }); });

  /* ---------------------------------------------------------------- glass: blur only while the page keeps up. Ten frames are sampled on the first scroll; under 30 a second the pill goes solid. */
  if (!mq('(prefers-reduced-transparency: reduce)')) (function () {
    var done = false;
    function sample() {
      if (done) return; done = true; window.removeEventListener('scroll', sample);
      var n = 0, t0 = 0; var tick = function (now) { if (!t0) t0 = now; if (++n < 11) { requestAnimationFrame(tick); return; } if ((now - t0) / 10 > 1000 / 30) root.classList.add('solid'); };
      requestAnimationFrame(tick);
    }
    window.addEventListener('scroll', sample, { passive: true });
  })();

  /* ---------------------------------------------------------------- the live demo
     Wide screen: the real viewer runs inside the phone frame. It is fetched only when the frame scrolls into view (with a
     mouse) or when "Play with it" is pressed. Phone: the button is a plain link, the demo opens full screen, and the demo's
     own "← Mana" link (or Back) returns here. */
  var stage = $('#phone');
  if (stage && !framed) (function () {
    var screen = $('.phone-screen', stage), frame = null, timer = 0;
    var wide = function () { return mq('(min-width: 900px)'); };
    function fit() { if (frame) frame.style.transform = 'scale(' + (screen.clientWidth / 390) + ')'; }
    function src() {
      var u = './view/?demo=olea&lang=' + lang();
      if (qs.get('vtest') === '1') u += '&test=1&pr=0.5';          // software-GL test runs
      return u;
    }
    function stop() { clearTimeout(timer); if (frame && frame.parentNode) frame.parentNode.removeChild(frame); frame = null; stage.setAttribute('data-state', 'still'); }
    function start() {
      if (frame) return;
      stage.setAttribute('data-state', 'loading');
      frame = doc.createElement('iframe');
      frame.setAttribute('title', lang() === 'he' ? 'תפריט ההדגמה של אוליאה' : 'The Olea demo menu');
      frame.setAttribute('allow', 'fullscreen; accelerometer; gyroscope');
      frame.addEventListener('load', function () { clearTimeout(timer); if (frame) stage.setAttribute('data-state', 'live'); });
      timer = setTimeout(function () { if (stage.getAttribute('data-state') === 'loading') stop(); }, 25000);
      frame.src = src(); screen.appendChild(frame); fit();
    }
    $$('[data-demo-start]').forEach(function (b) { b.addEventListener('click', function (ev) { if (!wide()) return; ev.preventDefault(); start(); }); });
    window.addEventListener('resize', function () { if (frame && !wide()) stop(); else fit(); });
    doc.addEventListener('mana:lang', function () { if (frame) frame.src = src(); });
    window.addEventListener('message', function (ev) {
      if (ev.origin !== location.origin || !ev.data || ev.data.type !== 'mana-site-home' || !frame || ev.source !== frame.contentWindow) return;
      stop(); window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
    var auto = qs.get('demo') !== 'off' && wide() && mq('(hover: hover)') && !saveData;
    if (qs.get('demo') === 'auto') auto = true;
    if (auto && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (e) { if (e[0].isIntersecting) { io.disconnect(); if (wide()) start(); } }, { rootMargin: '120px' });
      io.observe(stage);
    }
  })();

  /* ---------------------------------------------------------------- the film, in a lightbox (the button exists only when the file does) */
  var film = $('#film'), filmBtn = $('[data-film]');
  if (film && filmBtn && typeof film.showModal === 'function') (function () {
    var v = $('video', film);
    function pick() {
      var tall = mq('(max-width: 720px) and (orientation: portrait)'), en = lang() === 'en';
      var key = 'data-film-' + (tall ? 'tall' : 'wide');
      return (en && filmBtn.getAttribute(key + '-en')) || filmBtn.getAttribute(key) || filmBtn.getAttribute('href');
    }
    function close() { try { v.pause(); } catch (e) { /* not started */ } v.removeAttribute('src'); v.load(); if (film.open) film.close(); }
    filmBtn.addEventListener('click', function (ev) {
      ev.preventDefault(); v.setAttribute('src', pick()); film.showModal();
      var p = v.play(); if (p && p.catch) p.catch(function () { /* the controls are there */ });
    });
    $$('[data-film-close]', film).forEach(function (b) { b.addEventListener('click', close); });
    film.addEventListener('click', function (ev) { if (ev.target === film) close(); });      // a click on the dark around the picture
    film.addEventListener('close', function () { try { v.pause(); } catch (e) { /* ignore */ } v.removeAttribute('src'); v.load(); });
  })();

  /* ---------------------------------------------------------------- talk to us → the leads function
     WhatsApp is the first button; the short form is behind one tap on a phone and open on a wide screen. */
  var more = $('#talk-more');
  if (more && mq('(min-width: 900px)')) more.open = true;
  var form = $('#talk');
  if (form) (function () {
    var opened = Date.now(), busy = false;
    var KEY = 'mana-lead-token';
    var T = {
      he: { sending: 'שולחים…', rate: 'נשלחו מכאן הרבה פניות בזמן קצר. נסו שוב בעוד שעה, או כתבו לנו בוואטסאפ.', fail: 'הפנייה לא נשלחה. מה שכתבתם נשאר כאן: אפשר לנסות שוב, או לשלוח אותו בוואטסאפ.',
        offline: 'אין חיבור לרשת כרגע. מה שכתבתם נשאר כאן.', invalid: 'משהו בפרטים לא עבר. בדקו את הטלפון או האימייל ונסו שוב.', waText: 'היי, כותבים מהעמוד של מנה.' },
      en: { sending: 'Sending…', rate: 'Too many messages came from here in a short time. Try again in an hour, or write to us on WhatsApp.', fail: 'Your message was not sent. What you wrote is still here: try again, or send it on WhatsApp.',
        offline: 'You are offline right now. What you wrote is still here.', invalid: 'Something in the details did not pass. Check the phone or e-mail and try again.', waText: 'Hi, writing from the Mana page.' }
    };
    function uuid() {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      var b = new Uint8Array(16); (window.crypto || window.msCrypto).getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
      var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
      return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
    }
    /* one token per message, kept across retries and reloads so a second click can never make a second lead */
    function token() { var t = null; try { t = sessionStorage.getItem(KEY); } catch (e) { /* ignore */ } if (!t) { t = uuid(); try { sessionStorage.setItem(KEY, t); } catch (e) { /* ignore */ } } return t; }
    function clearToken() { try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ } }
    var f = { place: $('#f-place'), contact: $('#f-contact'), msg: $('#f-msg'), hp: $('#f-site'), news: $('#f-news') };
    var btn = $('#f-send'), bad = $('#talk-bad'), badText = $('#talk-bad-text'), ok = $('#talk-ok'), ref = $('#talk-ref'), wa = $('#talk-wa');
    function contactOk(v) { v = v.trim(); return v.length >= 5 && v.length <= 200 && (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || /^\d{7,15}$/.test(v.replace(/\D/g, ''))); }
    function mark(el, isBad) { var w = el.closest('.field'); if (isBad) w.setAttribute('data-bad', ''); else w.removeAttribute('data-bad'); el.setAttribute('aria-invalid', isBad ? 'true' : 'false'); }
    function dream() {
      var s = (lang() === 'he' ? 'מסעדה: ' : 'Restaurant: ') + f.place.value.trim();
      if (f.msg.value.trim()) s += '\n' + f.msg.value.trim();
      s += '\n' + (f.news.checked ? '[updates: yes]' : '[updates: no]');     // marketing consent travels with the message until the table has a column for it
      return s.slice(0, 4000);
    }
    function waLink() { return 'https://wa.me/972542022269?text=' + encodeURIComponent(T[lang()].waText + '\n' + dream().replace(/\n\[updates:.*$/, '')); }
    function showBad(key) { badText.textContent = T[lang()][key]; wa.href = waLink(); bad.hidden = false; bad.focus(); }
    function setBusy(b) { busy = b; btn.disabled = b; form.setAttribute('aria-busy', b ? 'true' : 'false'); $$('.lbl', btn).forEach(function (s) { s.hidden = b; }); $('.busy', btn).hidden = !b; $('.busy', btn).textContent = T[lang()].sending; }
    form.addEventListener('submit', function (ev) {
      ev.preventDefault(); if (busy || form.hasAttribute('data-off')) return;                 // a preview build: the form is off and sends nothing
      bad.hidden = true;
      var p = f.place.value.trim().length < 2, c = !contactOk(f.contact.value);
      mark(f.place, p); mark(f.contact, c);
      if (p || c) { (p ? f.place : f.contact).focus(); return; }
      var cfg = window.HALOM_MENUS_CONFIG;
      if (!cfg || !cfg.supabaseUrl || !cfg.supabaseKey) { showBad('fail'); return; }
      if (navigator.onLine === false) { showBad('offline'); return; }
      setBusy(true);
      var body = { p_token: token(), p_dream: dream(), p_contact: f.contact.value.trim(), p_name: null, p_package: 'menus', p_source: 'menus-landing',
        p_locale: lang(), p_page: (location.pathname + location.search).slice(0, 500), p_hp: f.hp.value || '', p_elapsed_ms: Date.now() - opened };
      var ctl = 'AbortController' in window ? new AbortController() : null, to = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);
      fetch(cfg.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/submit_lead', { method: 'POST', headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
        .then(function (j) {
          clearTimeout(to); setBusy(false);
          if (j && j.ok) { clearToken(); ref.textContent = j.ref || ''; $$('.has-ref', ok).forEach(function (e) { e.hidden = !j.ref; }); form.hidden = true; ok.hidden = false; ok.focus(); return; }
          var code = j && j.code;
          if (code === 'rate_limited') showBad('rate'); else if (code === 'invalid') { mark(f.contact, true); showBad('invalid'); } else showBad('fail');
        })
        .catch(function () { clearTimeout(to); setBusy(false); showBad(navigator.onLine === false ? 'offline' : 'fail'); });
    });
    [f.place, f.contact].forEach(function (el) { el.addEventListener('input', function () { mark(el, false); }); });
    var again = $('#talk-again'); if (again) again.addEventListener('click', function () { form.reset(); opened = Date.now(); ok.hidden = true; form.hidden = false; f.place.focus(); });
  })();
})();
