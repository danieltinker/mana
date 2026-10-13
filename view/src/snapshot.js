/* Where the menu comes from (CONTRACT.md, "How the viewer gets a snapshot") and making it safe to render.
   Pure apart from the injected fetch / window, so it is unit-tested against a stub server. */

export function sourceOf(loc) {
  const q = new URLSearchParams(loc.search || '');
  if (q.get('preview') === '1') return { kind: 'preview' };
  if (q.get('demo')) return { kind: 'demo', name: q.get('demo').replace(/[^a-z0-9_-]/gi, '') };
  const m = /^\/m\/([^/?#]+)/.exec(loc.pathname || '');
  const slug = q.get('m') || (m ? decodeURIComponent(m[1]) : '');
  return slug ? { kind: 'slug', slug } : { kind: 'none' };
}

const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
/* a text field: the contract's {he,en}; a plain string is accepted too and shown in both languages */
function text(v) { if (isObj(v)) return { he: str(v.he), en: str(v.en) }; const s = str(v); return { he: s, en: s }; }
function assetUrl(v, base) {
  if (typeof v !== 'string' || !v) return null;
  if (/^(blob:|data:image\/)/i.test(v)) return v;
  try { const u = new URL(v, base); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null; } catch (e) { return null; }
}
function httpsUrl(v) { try { const u = new URL(str(v)); return u.protocol === 'https:' ? u.href : null; } catch (e) { return null; } }
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const TAGS = ['vegan', 'vegetarian', 'spicy', 'gf'];
const KINDS = ['food', 'dessert', 'drinks', 'wine', 'beer'], SCENES = ['auto', 'table', 'bar', 'holo'], RELIEF = ['flat', 'low', 'medium', 'tall', 'stand'];

function asset(a, base) {
  if (!isObj(a)) return null;
  const color = assetUrl(a.color, base), thumb = assetUrl(a.thumb, base) || color;
  if (a.state === 'relief') {
    const aux = assetUrl(a.aux, base), e = num(a.e, NaN), h = num(a.h, NaN);
    if (color && aux && e > 5 && e <= 90 && h >= 0) {
      const stand = a.kind === 'stand' && Array.isArray(a.o) && a.o.length === 2;
      return { state: 'relief', color, aux, thumb, kind: RELIEF.includes(a.kind) ? a.kind : 'medium', e, h, o: stand ? [num(a.o[0], 0), num(a.o[1], 0)] : null, s: stand ? num(a.s, 0.62) : null, glass: a.glass === true ? true : a.glass === false ? false : null };      // glass: optional, see REPORT-M2 (a glass we may stand beside a photographed bottle)
    }
    return color ? { state: 'photo', color, thumb } : null;      // a relief with a missing part is shown as the photo it was made from, never guessed
  }
  if (a.state === 'photo') return color ? { state: 'photo', color, thumb } : null;
  if (a.state === 'stock') { const id = str(a.id); return STOCK_ID.test(id) ? { state: 'stock', id } : null; }      // a placeholder from the stock library; resolved by resolveStock()
  return null;
}
const STOCK_ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

/* ---------- the stock library: placeholder pictures for dishes that have none of their own (CONTRACT v2.3) ---------- */
/* what match.js calls stockAsset; kept here too so a menu still opens if that file cannot be fetched */
function stockAssetLocal(manifest, id, base) {
  const e = (manifest && Array.isArray(manifest.items) ? manifest.items : []).find((x) => x && x.id === id); if (!e) return null;
  const abs = (p) => (p ? new URL(p, base).href : null);
  if (e.draw) return { state: 'drawn', stock: e.id };
  return { state: 'relief', stock: e.id, color: abs(e.color), aux: abs(e.aux), thumb: abs(e.thumb), kind: e.kind, e: e.e, h: e.h, o: e.o == null ? null : e.o, s: e.s == null ? null : e.s };
}
export const usesStock = (snapshot) => snapshot.categories.some((c) => c.items.some((it) => it.asset && it.asset.state === 'stock'));
/* → { manifest, stockAsset, base } or null. Both files live next to the viewer: config.stockPath, '../stock/' by default. */
export async function loadStock(env) {
  const base = new URL((env.config && env.config.stockPath) || '../stock/', env.base).href;
  try {
    const r = await env.fetch(base + 'stock.json', { cache: 'no-cache' }); if (!r.ok) return null;
    const manifest = await r.json(); if (!isObj(manifest) || !Array.isArray(manifest.items)) return null;
    let fn = stockAssetLocal;
    if (env.importModule) { try { const m = await env.importModule(base + 'match.js'); if (m && typeof m.stockAsset === 'function') fn = m.stockAsset; } catch (e) { /* the copy above does the same */ } }
    return { manifest, stockAsset: fn, base };
  } catch (e) { return null; }
}
/* Put the library's pictures where the menu asks for them. An id the library does not know is "no picture"; so is anything
   that is not a complete relief. Each resolved asset keeps `stock: <id>`: that is what makes the viewer draw it as a projection
   and label it. Returns the label to show ({he,en}). */
export function resolveStock(snapshot, stock) {
  const label = stock && isObj(stock.manifest.label) ? text(stock.manifest.label) : { he: 'להמחשה בלבד', en: 'Illustration' };
  snapshot.categories.forEach((c) => c.items.forEach((it) => {
    if (!it.asset || it.asset.state !== 'stock') return;
    let got = null; try { got = stock ? stock.stockAsset(stock.manifest, it.asset.id, stock.base) : null; } catch (e) { got = null; }
    const clean = got && got.state === 'relief' ? asset(Object.assign({}, got, { state: 'relief' }), stock.base) : null;
    it.asset = clean && clean.state === 'relief' ? Object.assign(clean, { stock: it.asset.id }) : null;
  }));
  snapshot.stockLabel = label;
  return label;
}
function details(d) {
  if (!isObj(d)) return {};
  const out = {};
  if (isObj(d.wine)) { const w = d.wine, n = isObj(w.notes) ? w.notes : {}; out.wine = { producer: text(w.producer), name: text(w.name), vintage: text(w.vintage), region: text(w.region), grape: text(w.grape), serving: text(w.serving), color: str(w.color), bottle: str(w.bottle),
    notes: { sweetness: text(n.sweetness), acidity: text(n.acidity), body: text(n.body), fruit: text(n.fruit), minerality: text(n.minerality), pairings: text(n.pairings) } }; }
  if (isObj(d.beer)) { const b = d.beer; out.beer = { brewery: text(b.brewery), style: text(b.style), abv: text(b.abv), serving: str(b.serving), color: str(b.color) }; }
  return out;
}

/* Returns a clean snapshot or throws. Nothing from the network reaches the DOM or the GPU without passing here. */
export function normalise(raw, baseUrl) {
  if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.categories)) throw new Error('not a v1 menu snapshot');
  const b = isObj(raw.business) ? raw.business : {}, loc = isObj(raw.locale) ? raw.locale : {}, th = isObj(raw.theme) ? raw.theme : {};
  const langs = (Array.isArray(loc.langs) ? loc.langs : []).filter((l) => l === 'he' || l === 'en');
  const currency = /^[A-Z]{3}$/.test(str(loc.currency)) ? loc.currency : 'ILS';
  const seenC = new Set(), seenI = new Set();
  const categories = raw.categories.filter(isObj).map((c, ci) => {
    let id = str(c.id) || 'c' + ci; while (seenC.has(id)) id += '_'; seenC.add(id);
    return {
      id, name: text(c.name), kind: KINDS.includes(c.kind) ? c.kind : 'food', scene: SCENES.includes(c.scene) ? c.scene : 'auto',
      items: (Array.isArray(c.items) ? c.items : []).filter(isObj).map((it, ii) => {
        let iid = str(it.id) || id + '-' + ii; while (seenI.has(iid)) iid += '_'; seenI.add(iid);
        const p = isObj(it.price) ? it.price : {}, amount = Number.isInteger(p.amount) && p.amount >= 0 ? p.amount : null;
        return {
          id: iid, name: text(it.name), desc: text(it.desc),
          price: { amount, currency: /^[A-Z]{3}$/.test(str(p.currency)) ? p.currency : currency, note: text(p.note) },
          available: it.available !== false, tags: (Array.isArray(it.tags) ? it.tags : []).filter((t) => TAGS.includes(t)),
          allergens: text(it.allergens), details: details(it.details), asset: asset(it.asset, baseUrl)
        };
      })
    };
  });
  return {
    v: 1, slug: str(raw.slug), revision: num(raw.revision, 0), publishedAt: str(raw.publishedAt),
    business: { name: text(b.name), area: text(b.area), cuisine: text(b.cuisine), kind: str(b.kind), logo: assetUrl(b.logo, baseUrl), orderUrl: httpsUrl(b.orderUrl), phone: b.phone ? str(b.phone) : null },
    locale: { default: langs.includes(loc.default) ? loc.default : (langs[0] || 'he'), langs: langs.length ? langs : ['he', 'en'], currency },
    theme: { accent: /^#[0-9a-f]{6}$/i.test(str(th.accent)) ? th.accent : '#ff8a5c', surface: str(th.surface) || 'oak', tableImg: th.surface === 'custom' ? assetUrl(th.tableImg, baseUrl) : null,
      /* night:templates */ template: typeof th.template === 'string' && /^[a-z0-9-]{1,40}$/.test(th.template) ? th.template : null /* /night:templates */ },      // a look's id (templates/templates.v1.json); unknown → today's theme; the snapshot stays v:1
    categories
  };
}

/* → { state:'ok', snapshot } | { state:'unavailable', business } | { state:'not_found' } | { state:'error', message }  (error = offer a retry) */
export async function loadSnapshot(source, env) {
  const { fetch, config, base } = env;
  try {
    if (source.kind === 'demo') {
      const url = new URL('demo/' + source.name + '/menu.json', base).href, r = await fetch(url, { cache: 'no-cache' });
      if (r.status === 404) return { state: 'not_found' };
      if (!r.ok) return { state: 'error', message: 'HTTP ' + r.status };
      return { state: 'ok', snapshot: normalise(await r.json(), url) };
    }
    if (source.kind === 'slug') {
      if (!config || !config.supabaseUrl || !config.supabaseKey) return { state: 'error', message: 'config.js is missing' };
      /* open_menu = public_menu that also counts the visit (CONTRACT v2.4): one call per page load, with the language the menu
         opens in and whether the address came from the printed code (?t=1). A backend without it answers 404: ask the old way. */
      const rpc = String(config.supabaseUrl).replace(/\/+$/, '') + '/rest/v1/rpc/', headers = { apikey: config.supabaseKey, 'Content-Type': 'application/json', Accept: 'application/json' };
      let r = await fetch(rpc + 'open_menu', { method: 'POST', headers, body: JSON.stringify({ p_slug: source.slug, p_lang: env.lang === 'en' ? 'en' : 'he', p_src: env.src === 'qr' ? 'qr' : 'link' }) });
      if (r.status === 404) r = await fetch(rpc + 'public_menu', { method: 'POST', headers, body: JSON.stringify({ p_slug: source.slug }) });
      if (!r.ok) return { state: 'error', message: 'HTTP ' + r.status };
      const j = await r.json();
      if (j && j.state === 'ok' && j.snapshot) return { state: 'ok', snapshot: normalise(j.snapshot, base) };
      if (j && j.state === 'unavailable') return { state: 'unavailable', business: { name: text(j.business && j.business.name) } };
      if (j && j.state === 'not_found') return { state: 'not_found' };
      return { state: 'error', message: 'unexpected answer' };
    }
    if (source.kind === 'preview') return await waitForPreview(env);
    return { state: 'not_found' };
  } catch (e) {
    return { state: 'error', message: e && e.message ? e.message : 'failed' };
  }
}

/* ?preview=1 : the studio (opener or parent, same origin) posts { type:'halom-menu-preview', snapshot }.
   We announce { type:'halom-menu-preview-ready' } so the studio knows when to send; later messages replace the menu live (onUpdate). */
export function waitForPreview(env) {
  const win = env.window, origin = win.location.origin;
  return new Promise((resolve) => {
    let first = true;
    win.addEventListener('message', (e) => {
      if (e.origin !== origin || !e.data || e.data.type !== 'halom-menu-preview') return;
      let res; try { res = { state: 'ok', snapshot: normalise(e.data.snapshot, env.base) }; } catch (err) { res = { state: 'error', message: err.message }; }
      if (first) { first = false; resolve(res); } else if (env.onUpdate) env.onUpdate(res);
    });
    const ready = { type: 'halom-menu-preview-ready' };
    [win.opener, win.parent !== win ? win.parent : null].forEach((t) => { try { if (t) t.postMessage(ready, origin); } catch (e) { /* no studio there */ } });
  });
}

/* ---------- counting (CONTRACT v2.4): which dishes guests open and put on "my table". No cookie, no id, nothing about the person.
   At most once per dish and kind per page load; fire and forget: never awaited, never retried. Only for a real menu (a slug). ---------- */
export function createTracker(source, env) {
  const sent = new Set(), on = source.kind === 'slug' && env.config && env.config.supabaseUrl && env.config.supabaseKey;
  return function track(itemId, kind) {
    if (!on || (kind !== 'open' && kind !== 'add') || itemId == null) return false;
    const key = kind + ':' + itemId; if (sent.has(key)) return false; sent.add(key);
    try {
      const p = env.fetch(String(env.config.supabaseUrl).replace(/\/+$/, '') + '/rest/v1/rpc/track_item', { method: 'POST', keepalive: true,
        headers: { apikey: env.config.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_slug: source.slug, p_item: String(itemId), p_kind: kind }) });
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* counting never gets in the guest's way */ }
    return true;
  };
}

/* ---------- money: minor units in, a string out; never arithmetic on the decimal value ---------- */
export function formatMoney(amount, currency, lang) {
  if (amount == null) return '';
  const whole = amount % 100 === 0;
  try { return new Intl.NumberFormat(lang === 'he' ? 'he-IL' : 'en-IL', { style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(amount / 100).replace(/[‎‏]/g, ''); }
  catch (e) { return (whole ? String(amount / 100) : (amount / 100).toFixed(2)) + ' ' + currency; }
}
