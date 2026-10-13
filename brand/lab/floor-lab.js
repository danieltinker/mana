/* The floor's lab: mounts brand/src/land/floor3d.js in lab/floor.html, the way the page will (see the shared contract),
   plus debug query parameters for screenshots. Built by brand/lab/build-floor.mjs into brand/.scratch/lab/. */
import { mountFloor } from '../src/land/floor3d.js';

const q = new URLSearchParams(location.search), lang = q.get('lang') === 'en' ? 'en' : 'he';
document.documentElement.lang = lang; document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
const t0 = performance.now();
window.__floorState = 'loading';
mountFloor(document.getElementById('stage'), {
  lang, reduced: q.has('reduced') || matchMedia('(prefers-reduced-motion: reduce)').matches, lowPower: q.has('low'),
  onReady() { window.__floorReadyMs = Math.round(performance.now() - t0); window.__floorState = 'ready'; },
  onFail(e) { window.__floorState = 'failed: ' + (e && e.message || e); },
  debug: { t: q.get('t'), freeze: q.has('freeze'), yaw: q.get('yaw') }
}).then((api) => { window.__floor = api; if (!api && window.__floorState === 'loading') window.__floorState = 'null'; });
window.__setLang = (l) => { document.documentElement.lang = l; document.documentElement.dir = l === 'he' ? 'rtl' : 'ltr'; if (window.__floor) window.__floor.setLang(l); };
