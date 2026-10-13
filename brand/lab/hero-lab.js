/* Lab entry for brand/lab/hero.html (never published): mounts the hero dish the way the page will, plus the lab-only
   freeze query (?dish=i, ?shift=i&t=…). Exposes window.__hero for the headless runs. */
const q = new URLSearchParams(location.search);
const ids = ['pizza', 'burger', 'ramen', 'croissant', 'shakshuka', 'gelato'];
const names = { pizza: 'Pizza', burger: 'Burger', ramen: 'Ramen', croissant: 'Croissant', shakshuka: 'Shakshuka', gelato: 'Gelato' };
const st = (window.__hero = { t0: performance.now(), ready: false, frame: false, dishes: [], error: null });
if (q.get('label') === '0') document.querySelector('.label').style.display = 'none';

let debug = null;
if (q.has('shift')) { const i = +q.get('shift'); const to = q.has('to') ? +q.get('to') : (i + 1) % ids.length; debug = { from: i, to, t: +(q.get('t') || 0.5) }; }
else if (q.has('dish')) debug = { dish: +q.get('dish') };
if (debug) { if (q.has('angle')) debug.angle = +q.get('angle'); debug.onFrame = (info) => { st.frame = info; }; }

const { mountHero } = await import('../src/land/hero-morph.js');
const h = await mountHero(document.getElementById('hero'), {
  base: '../site/img/dishes/', ids, reduced: q.get('reduced') === '1', lowPower: q.get('low') === '1', debug,
  onReady: () => { st.ready = true; st.readyMs = performance.now() - st.t0; },
  onDish: (i) => { st.dishes.push(ids[i]); document.getElementById('name').textContent = names[ids[i]]; },
  onFail: (e) => { st.error = String(e && e.message || e); }
});
st.handle = h;
if (!h) st.error = 'no webgl';
