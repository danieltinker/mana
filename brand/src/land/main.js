/* The product page's behaviours (remaster): the language, the reveals, the live loops (only on screen), the hero's
   shape-shifting dish and the floating floor (both loaded on demand, through the contract in shared.md), the sample numbers,
   the host film, the demo dialog and the "talk to us" form. Everything on the page reads, links and shows a good still without
   this file. Nothing heavy is fetched before the page has painted, and never on Save-Data. */
import { initDialog } from './dialog.js';
import { initForm } from './form.js';
import { mountLevitate } from './levitate.js';
import { initMoods } from './moods.js';

const doc = document, root = doc.documentElement, qs = new URLSearchParams(location.search);
const $ = (s, el) => (el || doc).querySelector(s);
const $$ = (s, el) => Array.prototype.slice.call((el || doc).querySelectorAll(s));
const mq = (q) => !!(window.matchMedia && matchMedia(q).matches);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } } };
const idle = (f, t = 300) => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, t));
const saveData = !!(navigator.connection && navigator.connection.saveData) || qs.get('save') === '1';
const reduced = mq('(prefers-reduced-motion: reduce)') || qs.get('motion') === 'reduce';
const lowPower = mq('(max-width: 820px), (pointer: coarse)');
const hasIO = 'IntersectionObserver' in window;
const motion = !reduced && hasIO && qs.get('motion') !== 'off';
/* inside this page's own demo dialog (same origin): the demo's "← Mana" link loaded this page in the frame. Anywhere else (a preview
   host, a site that frames us) the page runs normally. */
let framed = false; try { framed = !!(window.frameElement && window.frameElement.closest && window.frameElement.closest('#demo')); } catch (e) { framed = false; }

/* The demo menu has a "← Mana" link. When the demo runs inside this page's dialog, that link loads this page INSIDE the frame:
   tell the page around us to close the dialog, and do nothing else here. */
if (framed) { try { window.parent.postMessage({ type: 'mana-site-home' }, location.origin); } catch (e) { /* gone */ } }
else main();

function main() {
  /* ---------------------------------------------------------------- language (Hebrew first) */
  const lang = () => (root.lang === 'en' ? 'en' : 'he');
  function setLang(l, remember) {
    l = l === 'en' ? 'en' : 'he';
    root.lang = l; root.dir = l === 'he' ? 'rtl' : 'ltr';
    if (remember) store.set('mana-lang', l);
    const t = root.getAttribute('data-title-' + l); if (t) doc.title = t;
    const d = $('meta[name="description"]'), dd = root.getAttribute('data-desc-' + l); if (d && dd) d.setAttribute('content', dd);
    $$('[data-href-' + l + ']').forEach((a) => a.setAttribute('href', a.getAttribute('data-href-' + l)));
    $$('[data-label-' + l + ']').forEach((i) => i.setAttribute('aria-label', i.getAttribute('data-label-' + l)));
    doc.dispatchEvent(new CustomEvent('mana:lang', { detail: l }));
  }
  setLang(qs.get('lang') || store.get('mana-lang') || root.lang, false);
  $$('[data-lang-toggle]').forEach((b) => b.addEventListener('click', () => setLang(lang() === 'he' ? 'en' : 'he', true)));

  if (motion) root.classList.add('anim');
  if (mq('(pointer: coarse)')) root.classList.add('coarse');

  /* ---------------------------------------------------------------- the header grows a little more glass once the page moves */
  let scrolled = null;
  const onScroll = () => { const s = (window.pageYOffset || 0) > 24; if (s !== scrolled) { scrolled = s; root.classList.toggle('scrolled', s); } };
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------------------------------------------------------- reveals (once) and live loops (only while on screen) */
  const onReveal = new Map();
  const reveal = (el) => { if (el.classList.contains('in')) return; el.classList.add('in'); const f = onReveal.get(el); if (f) f(); };
  if (motion) {
    const reveals = $$('[data-reveal]');
    /* in view, or already passed (a fast scroll can skip a section between two frames): drawn */
    const rio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting || e.boundingClientRect.bottom < 0) { reveal(e.target); rio.unobserve(e.target); } }), { threshold: 0.15 });
    reveals.forEach((el) => rio.observe(el));
    /* a second trigger, so a section never stays undrawn when the observer is late: the same test, made on scroll */
    let waiting = reveals.slice(), tick = false;
    const seen = () => {
      tick = false; const vh = window.innerHeight || root.clientHeight;
      waiting = waiting.filter((el) => { if (el.classList.contains('in')) return false; const r = el.getBoundingClientRect(), vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        if (vis >= Math.min(r.height, vh) * 0.15 || r.bottom < 0) { reveal(el); rio.unobserve(el); return false; } return true; });
      if (!waiting.length) { window.removeEventListener('scroll', move); window.removeEventListener('resize', move); }
    };
    const move = () => { if (!tick) { tick = true; requestAnimationFrame(seen); } };
    window.addEventListener('scroll', move, { passive: true }); window.addEventListener('resize', move);
    const lio = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('live', e.isIntersecting)), { rootMargin: '80px 0px' });
    $$('[data-live]').forEach((el) => lio.observe(el));
  }

  /* ---------------------------------------------------------------- one story: the light follows the reader. The chapter nearest the
     middle of the screen is lit (its little scene plays); on a wide screen an orb runs along the thread above them with the scroll */
  const story = $('#how'), chapters = story ? $$('.chapter', story) : [];
  if (story && motion && chapters.length) {
    let pend = false;
    const upd = () => {
      pend = false; const r = story.getBoundingClientRect(), vh = window.innerHeight || root.clientHeight; if (r.bottom < -100 || r.top > vh + 100) return;
      const sp = Math.max(0, Math.min(1, .5 + (vh / 2 - (r.top + r.height / 2)) / (vh * .6))); story.style.setProperty('--sp', sp.toFixed(3));
      const row = Math.abs(chapters[0].getBoundingClientRect().top - chapters[chapters.length - 1].getBoundingClientRect().top) < 8;      // side by side: the orb decides
      let best = Math.round(sp * (chapters.length - 1));
      if (!row) { let bd = 1e9; chapters.forEach((c, i) => { const b = c.getBoundingClientRect(), d = Math.abs(b.top + b.height / 2 - vh * .5); if (d < bd) { bd = d; best = i; } }); }
      if (story.getAttribute('data-lit') !== String(best)) { story.setAttribute('data-lit', String(best)); chapters.forEach((c, i) => c.classList.toggle('lit', i === best)); }
    };
    const ask = () => { if (!pend) { pend = true; requestAnimationFrame(upd); } };
    window.addEventListener('scroll', ask, { passive: true }); window.addEventListener('resize', ask); upd();
  }

  /* ---------------------------------------------------------------- the hero: the stills first; the shape-shifting dish after paint */
  const stage = $('#hero-stage'), heroHost = $('#hero-gl'), heroSec = $('#hero');
  let hero = null, heroVisible = true;
  const setDish = (i) => { if (stage) stage.setAttribute('data-dish', String(i)); };
  function startHero() {
    if (!stage || !heroHost || hero) return;
    let ready = false;
    const fail = () => { if (hero && hero.destroy) try { hero.destroy(); } catch (e) { /* gone */ } hero = null; heroHost.textContent = ''; stage.setAttribute('data-hero', 'still'); };
    import('./hero-morph.js').then((m) => m.mountHero(heroHost, {
      base: './img/dishes/', ids: ['pizza', 'burger', 'ramen', 'croissant', 'shakshuka', 'gelato'], reduced, lowPower,
      onDish: (i) => setDish(i),
      onReady: () => { ready = true; stage.setAttribute('data-hero', 'live'); if (hero && !heroVisible) hero.pause(); },
      onFail: () => fail()
    })).then((h) => {
      if (!h) return;                                                                                   // no WebGL: the stills stay
      hero = h; if (!heroVisible || doc.hidden) h.pause();
      setTimeout(() => { if (!ready) fail(); }, 20000);                                                 // nothing drawn: the stills stay
    }).catch(() => fail());
  }
  if (stage && hasIO) new IntersectionObserver((es) => { heroVisible = es[0].isIntersecting; if (hero) heroVisible && !doc.hidden && !root.classList.contains('dlg-open') ? hero.resume() : hero.pause(); }, { threshold: 0 }).observe(stage);
  if (stage && !saveData && !reduced && qs.get('hero') !== 'off') {
    const go = () => idle(startHero);
    if (doc.readyState === 'complete') go(); else window.addEventListener('load', go, { once: true });
  }

  /* the ingredients levitate (levitate.js): only while the hero is on screen, the tab is visible and the demo dialog is closed */
  let lev = null, levVisible = true;
  if (motion && heroSec && qs.get('lev') !== 'off') {
    lev = mountLevitate(heroSec, { lowPower });
    if (lev) { lev.resume(); new IntersectionObserver((es) => { levVisible = es[0].isIntersecting; settle(); }, { threshold: 0 }).observe(heroSec); }
  }

  /* the specular sheen on glass cards follows the pointer (a mouse only) */
  if (motion && mq('(hover: hover) and (pointer: fine)')) {
    let card = null, ev = null, pending = false;
    const apply = () => { pending = false; if (!card || !ev) return; const r = card.getBoundingClientRect(); card.style.setProperty('--mx', Math.round(ev.clientX - r.left) + 'px'); card.style.setProperty('--my', Math.round(ev.clientY - r.top) + 'px'); };
    doc.addEventListener('pointermove', (e) => { const c = e.target.closest && e.target.closest('.sheen'); if (!c) return; card = c; ev = e; if (!pending) { pending = true; requestAnimationFrame(apply); } }, { passive: true });
  }

  /* ---------------------------------------------------------------- the floor: the still plan first; the floating room when the section comes near */
  const floor = $('#floor'), floorHost = $('#floor-gl');
  let floor3d = null, floorVisible = false, floorAsked = false;
  function startFloor() {
    if (floorAsked || !floorHost) return; floorAsked = true;
    const fail = () => { if (floor3d && floor3d.destroy) try { floor3d.destroy(); } catch (e) { /* gone */ } floor3d = null; floorHost.textContent = ''; floor.setAttribute('data-floor', 'still'); };
    import('./floor3d.js').then((m) => m.mountFloor(floorHost, { lang: lang(), reduced, lowPower, onReady: () => { floor.setAttribute('data-floor', 'live'); if (floor3d && !floorVisible) floor3d.pause(); }, onFail: () => fail() }))
      .then((h) => { if (!h) return; floor3d = h; if (!floorVisible || doc.hidden) h.pause(); }).catch(() => fail());
  }
  if (floor && hasIO) {
    new IntersectionObserver((es) => { floorVisible = es[0].isIntersecting; if (floor3d) floorVisible && !doc.hidden && !root.classList.contains('dlg-open') ? floor3d.resume() : floor3d.pause(); }, { threshold: 0 }).observe(floor);
    if (!saveData && qs.get('floor') !== 'off') new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { io.disconnect(); idle(startFloor, 50); } }, { rootMargin: '600px 0px' }).observe(floor);
  }
  doc.addEventListener('mana:lang', (e) => { if (floor3d && floor3d.setLang) floor3d.setLang(e.detail); });
  const covered = () => doc.hidden || root.classList.contains('dlg-open');      // the tab is hidden, or the demo dialog covers the page
  function settle() {
    if (lev) covered() || !levVisible ? lev.pause() : lev.resume();
    if (hero) covered() || !heroVisible ? hero.pause() : hero.resume();
    if (floor3d) covered() || !floorVisible ? floor3d.pause() : floor3d.resume();
    if (insScene) covered() || !insVisible ? insScene.pause() : insScene.resume();
    doc.dispatchEvent(new CustomEvent('mana:settle', { detail: covered() }));
  }
  doc.addEventListener('visibilitychange', settle);
  doc.addEventListener('mana:dialog', settle);

  /* ---------------------------------------------------------------- what you learn: the living scene, loaded when it comes near */
  const ins = $('#ins'), insHost = $('#ins-gl');
  let insScene = null, insVisible = false, insAsked = false;
  function startIns() {
    if (insAsked || !insHost) return; insAsked = true;
    let data = null; try { data = JSON.parse($('#ins-data').textContent); } catch (e) { return; }
    const fail = () => { if (insScene && insScene.destroy) try { insScene.destroy(); } catch (e) { /* gone */ } insScene = null; insHost.textContent = ''; ins.setAttribute('data-ins', 'still'); };
    import('./insights3d.js').then((m) => m.mountInsights(insHost, { data, layer: $('.ins-layer', ins), lang: lang(), reduced, lowPower, speed: +qs.get('ins-speed') || 1,
      onReady: () => { ins.setAttribute('data-ins', 'live'); if (insScene && !insVisible) insScene.pause(); },
      onOrder: (o) => ins.setAttribute('data-order', o), onDay: (d) => { const el = $('.ins-day', ins); if (el) el.textContent = d; }, onFail: () => fail() }))
      .then((h) => { if (!h) return; insScene = h; if (insVisible && !covered()) h.resume(); }).catch(() => fail());
  }
  if (ins && hasIO) {
    new IntersectionObserver((es) => { insVisible = es[0].isIntersecting; settle(); }, { threshold: 0 }).observe(ins);
    if (!saveData && qs.get('ins') !== 'off') new IntersectionObserver((es, io) => { if (es[0].isIntersecting) { io.disconnect(); idle(startIns, 50); } }, { rootMargin: '500px 0px' }).observe(ins);
  }
  doc.addEventListener('mana:lang', (e) => { if (insScene && insScene.setLang) insScene.setLang(e.detail); });

  /* ---------------------------------------------------------------- the host's mini-ad: one mood, a burst of light, the next */
  initMoods({ $, $$, doc, hasIO, saveData, reduced, covered });

  /* ---------------------------------------------------------------- glass: blur only while the page keeps up (ten frames sampled on the first scroll; under 30 a second the glass goes solid) */
  if (!mq('(prefers-reduced-transparency: reduce)')) {
    let done = false;
    const sample = () => { if (done) return; done = true; window.removeEventListener('scroll', sample);
      let n = 0, t0 = 0; const tick = (now) => { if (!t0) t0 = now; if (++n < 11) { requestAnimationFrame(tick); return; } if ((now - t0) / 10 > 1000 / 30) root.classList.add('solid'); }; requestAnimationFrame(tick); };
    window.addEventListener('scroll', sample, { passive: true });
  }

  initDialog({ $, $$, mq, lang, root });
  initForm({ $, $$, mq, lang });
}
