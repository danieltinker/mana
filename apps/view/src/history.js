/* Mirrors the navigation state into the URL hash and browser history, and the Back button into the state.
   env is injected so the same code runs against a fake history in node tests.

   What Back does for a guest: it closes what is open (a lifted dish, the list, "my table"); with nothing open it leaves
   the menu, in one press, to wherever they came from. So gliding from dish to dish and from table to table only REPLACES the
   address (#c=…&i=… always names the dish in focus, and can be shared); only opening something adds a history entry. */
import { formatHash, parseHash, routeOf } from './store.js';

export function planFromUrl(urlRoute, next, under) {
  const a = formatHash(urlRoute), b = formatHash(routeOf(next));
  if (a === b) return 'none';
  const was = !!urlRoute.o, now = !!next.open;
  if (!was && now) return 'push';                                               // opening something: Back will close it
  if (was && !now) return under != null ? 'back' : 'replace';                   // closing it: go back to the entry it was opened from, if there is one
  return 'replace';                                                             // gliding, or one open thing replaced by another
}

export function bindHistory(store, env) {
  const { history, location } = env;
  const url = (hash) => location.pathname + location.search + hash;              // never a bare '#…': <base href> would hijack it
  let pendingBack = false, timer = null;
  const stateOf = () => (history.state && history.state.halomMenu ? history.state : { halomMenu: 1, under: null });

  function reconcile() {
    const s = store.getState(), cur = parseHash(location.hash), plan = planFromUrl(cur, s, stateOf().under), hash = formatHash(routeOf(s));
    if (plan === 'none') return;
    if (plan === 'push') history.pushState({ halomMenu: 1, under: formatHash(cur) }, '', url(hash));
    else if (plan === 'replace') history.replaceState({ halomMenu: 1, under: stateOf().under }, '', url(hash));
    else {
      pendingBack = true; history.back();
      if (env.setTimeout) timer = env.setTimeout(() => { if (pendingBack) { pendingBack = false; reconcile(); } }, 400);   // a Back that never arrives must not freeze the URL
    }
  }
  const unsub = store.subscribe((s, prev, a, meta) => { if (meta && meta.fromHistory) return; if (!pendingBack) reconcile(); });
  const onPop = () => {
    if (timer != null && env.clearTimeout) { env.clearTimeout(timer); timer = null; }
    if (pendingBack) { pendingBack = false; reconcile(); return; }              // our own Back landed; catch up with anything that happened meanwhile
    const r = parseHash(location.hash);
    if (store.getState().open && !r.o) store.dispatch({ type: 'close' }, { fromHistory: true });      // Back closes what is open and leaves the guest at the dish they are looking at
    else store.dispatch({ type: 'route', route: r }, { fromHistory: true });
    const s = store.getState(), hash = formatHash(routeOf(s));
    if (formatHash(parseHash(location.hash)) !== hash) history.replaceState({ halomMenu: 1, under: stateOf().under }, '', url(hash));   // a link to something that no longer exists
  };
  env.on('popstate', onPop);
  history.replaceState({ halomMenu: 1, under: stateOf().under }, '', url(formatHash(routeOf(store.getState()))));
  return { reconcile, dispose() { unsub(); if (env.off) env.off('popstate', onPop); } };
}
