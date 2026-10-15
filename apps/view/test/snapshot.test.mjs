import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sourceOf, normalise, loadSnapshot, formatMoney, waitForPreview, usesStock, loadStock, resolveStock, createTracker } from '../src/snapshot.js';
import { buildModel, presentation } from '../src/store.js';
import { listen } from '../tools/serve.mjs';

const raw = () => JSON.parse(readFileSync(new URL('../demo/olea/menu.json', import.meta.url), 'utf8'));

test('where the menu comes from', () => {
  assert.deepEqual(sourceOf({ pathname: '/projects/menus/view/', search: '?demo=olea' }), { kind: 'demo', name: 'olea' });
  assert.deepEqual(sourceOf({ pathname: '/projects/menus/view/index.html', search: '?demo=../../x' }), { kind: 'demo', name: 'x' });          // a demo name cannot climb out of demo/
  assert.deepEqual(sourceOf({ pathname: '/m/juno', search: '' }), { kind: 'slug', slug: 'juno' });
  assert.deepEqual(sourceOf({ pathname: '/m/caf%C3%A9/', search: '' }), { kind: 'slug', slug: 'café' });
  assert.deepEqual(sourceOf({ pathname: '/projects/menus/view/', search: '?m=juno' }), { kind: 'slug', slug: 'juno' });
  assert.deepEqual(sourceOf({ pathname: '/projects/menus/view/', search: '?preview=1&m=juno' }), { kind: 'preview' });
  assert.deepEqual(sourceOf({ pathname: '/projects/menus/view/', search: '' }), { kind: 'none' });
});

test('the demo is a v1 snapshot in the contract shape', () => {
  const r = raw(), s = normalise(r, 'https://host.test/projects/menus/view/demo/olea/menu.json');
  assert.equal(s.v, 1); assert.equal(s.slug, 'olea'); assert.equal(s.locale.default, 'he'); assert.equal(s.theme.surface, 'oak');
  assert.equal(s.categories.length, 7); assert.deepEqual(s.categories.map((c) => c.kind), ['food', 'food', 'food', 'dessert', 'wine', 'beer', 'drinks']);
  const items = s.categories.flatMap((c) => c.items), by = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(new Set(items.map((i) => i.id)).size, items.length);
  assert.equal(by.hummus.asset.color, 'https://host.test/projects/menus/view/demo/olea/img/hummus.jpg');                      // asset URLs are relative to the demo folder
  assert.equal(by.hummus.asset.state, 'relief'); assert.equal(by.lasagne.asset.state, 'photo'); assert.equal(by.bread.asset, null);
  assert.equal(by['fish-soup'].available, false); assert.equal(by.brulee.available, false);
  assert.equal(by['orange-juice'].asset.kind, 'stand'); assert.equal(by['orange-juice'].asset.o.length, 2);
  assert.ok(items.filter((i) => i.asset && i.asset.kind === 'stand').length >= 4);
  s.categories.filter((c) => c.kind === 'wine' || c.kind === 'beer').forEach((c) => c.items.forEach((i) => { assert.equal(i.asset, null); assert.ok(i.details[c.kind]); }));
  items.forEach((i) => { assert.ok(Number.isInteger(i.price.amount) && i.price.amount % 100 === 0); assert.ok(i.name.he && i.name.en); });
  r.categories.forEach((c) => c.items.forEach((i) => { assert.deepEqual(Object.keys(i).sort(), ['allergens', 'asset', 'available', 'desc', 'details', 'id', 'name', 'price', 'tags']); if (i.asset) assert.deepEqual(Object.keys(i.asset).sort(), ['aux', 'color', 'e', 'h', 'kind', 'o', 's', 'state', 'thumb']); }));
  assert.equal(s.business.orderUrl, 'https://example.com/olea');
});

test('nothing unsafe or malformed gets through', () => {
  assert.throws(() => normalise({ v: 2, categories: [] })); assert.throws(() => normalise(null)); assert.throws(() => normalise({ v: 1 }));
  const s = normalise({ v: 1, business: { name: 'Plain', orderUrl: 'javascript:alert(1)', logo: 'javascript:alert(1)' }, theme: { accent: 'red;}', surface: 'custom', tableImg: 'ftp://x/y.jpg' }, locale: { default: 'fr', langs: ['fr'] },
    categories: [{ id: 'a', name: { en: 'A' }, kind: 'weird', scene: 'moon', items: [
      { id: 'x', name: { en: 'X' }, price: { amount: 12.5 }, tags: ['vegan', '<script>'], asset: { state: 'relief', color: 'c.jpg' } },
      { id: 'x', name: 'dup', price: { amount: 500, currency: 'usd' }, available: 'no', asset: { state: 'relief', color: 'c.jpg', aux: 'a.png', e: 400, h: .2 } },
      { name: { he: 'בלי מזהה' }, asset: { state: 'video', color: 'c.jpg' } }, null, 'junk'] }, null, { id: 'a', items: [] }] }, 'https://h.test/base/');
  assert.equal(s.business.orderUrl, null); assert.equal(s.business.logo, null); assert.equal(s.theme.accent, '#ff8a5c'); assert.equal(s.theme.tableImg, null);
  assert.deepEqual(s.business.name, { he: 'Plain', en: 'Plain' }); assert.deepEqual(s.locale.langs, ['he', 'en']);
  const it = s.categories[0].items; assert.equal(s.categories[0].kind, 'food'); assert.equal(s.categories[0].scene, 'auto'); assert.equal(it.length, 3);
  assert.equal(it[0].price.amount, null); assert.deepEqual(it[0].tags, ['vegan']); assert.equal(it[0].asset.state, 'photo');     // a relief without its height map is shown as the photo, not guessed
  assert.equal(it[1].id, 'x_'); assert.equal(it[1].available, true); assert.equal(it[1].asset.state, 'photo'); assert.equal(it[1].price.currency, 'ILS');
  assert.equal(it[2].asset, null); assert.ok(it[2].id); assert.equal(s.categories[1].id, 'a_');
});

test('money: minor units in, text out', () => {
  assert.equal(formatMoney(6200, 'ILS', 'en'), '₪62'); assert.equal(formatMoney(6250, 'ILS', 'en'), '₪62.50'); assert.equal(formatMoney(null, 'ILS', 'en'), '');
  assert.match(formatMoney(6200, 'ILS', 'he'), /^62\s₪$|^₪\s?62$/); assert.equal(formatMoney(0, 'ILS', 'en'), '₪0'); assert.match(formatMoney(1999, 'USD', 'en'), /19\.99/);
});

test('the open_menu call (language and where the address came from) and its three answers (stub server)', async () => {
  const s = await listen(0), cfg = { supabaseUrl: s.origin + '/stub/', supabaseKey: s.key }, env = (c, more) => Object.assign({ fetch, config: c, base: s.origin + '/projects/menus/view/' }, more || {});
  try {
    const ok = await loadSnapshot({ kind: 'slug', slug: 'olea' }, env(cfg, { lang: 'en', src: 'qr' }));
    assert.equal(ok.state, 'ok'); assert.equal(ok.snapshot.slug, 'olea'); assert.ok(ok.snapshot.categories[0].items[0].asset.color.startsWith(s.origin));
    const call = s.server.requests.find((r) => r.path === '/stub/rest/v1/rpc/open_menu'); assert.equal(call.method, 'POST'); assert.equal(call.apikey, s.key);
    assert.deepEqual(s.server.calls, [{ fn: 'open_menu', args: { p_slug: 'olea', p_lang: 'en', p_src: 'qr' } }], 'one call, with exactly the three arguments of CONTRACT v2.4');
    await loadSnapshot({ kind: 'slug', slug: 'olea' }, env(cfg)); assert.deepEqual(s.server.calls[1].args, { p_slug: 'olea', p_lang: 'he', p_src: 'link' }, 'nothing known about the guest: Hebrew, from a link');
    assert.ok(!s.server.requests.some((r) => r.path.endsWith('/public_menu')), 'public_menu is not called when open_menu answers');
    const un = await loadSnapshot({ kind: 'slug', slug: 'paused' }, env(cfg)); assert.equal(un.state, 'unavailable'); assert.equal(un.business.name.he, 'אוליאה');
    assert.deepEqual(await loadSnapshot({ kind: 'slug', slug: 'no-such-place' }, env(cfg)), { state: 'not_found' });
    assert.equal((await loadSnapshot({ kind: 'slug', slug: 'broken' }, env(cfg))).state, 'error');                               // HTTP 500 → retry control
    assert.equal((await loadSnapshot({ kind: 'slug', slug: 'flaky' }, env(cfg))).state, 'error'); assert.equal((await loadSnapshot({ kind: 'slug', slug: 'flaky' }, env(cfg))).state, 'ok');   // and the retry works
    assert.equal((await loadSnapshot({ kind: 'slug', slug: 'olea' }, env({ supabaseUrl: s.origin + '/stub', supabaseKey: 'wrong' }))).state, 'error');
    assert.equal((await loadSnapshot({ kind: 'slug', slug: 'olea' }, env(undefined))).state, 'error');                            // config.js missing
    assert.equal((await loadSnapshot({ kind: 'slug', slug: 'olea' }, env({ supabaseUrl: 'http://127.0.0.1:9', supabaseKey: 'k' }))).state, 'error');   // network failure
    const demo = await loadSnapshot({ kind: 'demo', name: 'olea' }, env(undefined)); assert.equal(demo.state, 'ok'); assert.ok(demo.snapshot.categories[0].items[0].asset.thumb.includes('/demo/olea/img/'));
    assert.deepEqual(await loadSnapshot({ kind: 'demo', name: 'nope' }, env(undefined)), { state: 'not_found' });
    assert.deepEqual(await loadSnapshot({ kind: 'none' }, env(cfg)), { state: 'not_found' });
    const n = s.server.calls.length; await loadSnapshot({ kind: 'demo', name: 'olea' }, env(cfg)); assert.equal(s.server.calls.length, n, 'a demo is never counted');
  } finally { s.server.close(); }
  const old = await listen(0, { oldBackend: true });                              // a backend from before open_menu existed
  try {
    const r = await loadSnapshot({ kind: 'slug', slug: 'olea' }, { fetch, config: { supabaseUrl: old.origin + '/stub', supabaseKey: old.key }, base: old.origin + '/projects/menus/view/' });
    assert.equal(r.state, 'ok'); assert.deepEqual(old.server.calls.map((c) => c.fn), ['public_menu']); assert.deepEqual(old.server.calls[0].args, { p_slug: 'olea' });
  } finally { old.server.close(); }
});

test('placeholders: {state:"stock", id} survives the loader and is resolved from the library; an unknown id is no picture', async () => {
  const kiosk = JSON.parse(readFileSync(new URL('../demo/kiosk/menu.json', import.meta.url), 'utf8')), base = 'https://host.test/projects/menus/view/demo/kiosk/menu.json';
  const snap = normalise(kiosk, base), items = () => snap.categories.flatMap((c) => c.items), by = () => Object.fromEntries(items().map((i) => [i.id, i]));
  assert.equal(items().length, 12); assert.equal(snap.business.kind, 'cafe'); assert.ok(usesStock(snap)); assert.equal(usesStock(normalise(raw(), base)), false);
  assert.deepEqual(by()['k-pizza'].asset, { state: 'stock', id: 'pizza' }); assert.equal(by()['k-toast'].asset, null);
  assert.equal(normalise({ v: 1, categories: [{ id: 'a', items: [{ id: 'x', asset: { state: 'stock', id: '../../etc' } }, { id: 'y', asset: { state: 'stock' } }] }] }, base).categories[0].items.every((i) => i.asset === null), true, 'an id that is not an id is no picture');
  assert.equal(presentation(by()['k-pizza'], 'food').type, 'text', 'before the library answers: a name card, not a broken picture');
  const s = await listen(0);
  try {
    const stock = await loadStock({ fetch, config: { stockPath: '../stock/' }, base: s.origin + '/projects/menus/view/' });
    assert.ok(stock && stock.manifest.items.length >= 8); assert.equal(stock.base, s.origin + '/projects/menus/stock/');
    const label = resolveStock(snap, stock); assert.deepEqual(label, { he: 'להמחשה בלבד', en: 'Illustration' }); assert.deepEqual(snap.stockLabel, label);
    const pizza = by()['k-pizza'].asset; assert.equal(pizza.state, 'relief'); assert.equal(pizza.stock, 'pizza'); assert.equal(pizza.color, s.origin + '/projects/menus/stock/img/pizza.jpg'); assert.equal(pizza.aux, s.origin + '/projects/menus/stock/img/pizza.png'); assert.ok(pizza.e > 40 && pizza.h > 0);
    assert.equal(by()['k-orange'].asset.kind, 'stand'); assert.equal(by()['k-orange'].asset.o.length, 2);
    assert.equal(by()['k-cappuccino'].asset, null, 'the test library has eight entries: an id it does not know is no picture'); assert.equal(by()['k-toast'].asset, null);
    assert.deepEqual(presentation(by()['k-pizza'], 'food'), { type: 'relief', pourable: false, illustration: true, holo: true, turns: true });
    const withStock = items().filter((i) => i.asset && i.asset.stock).map((i) => i.asset.stock).sort();
    assert.deepEqual(withStock, ['burger', 'cheesecake', 'hummus', 'orange-juice', 'pasta', 'pizza', 'salad', 'shakshuka'], 'the eight fixed starter ids');
    assert.equal(buildModel(snap).cats.length, 4);
    assert.equal(await loadStock({ fetch, config: { stockPath: '../nowhere/' }, base: s.origin + '/projects/menus/view/' }), null);
    const lost = normalise(kiosk, base); resolveStock(lost, null); assert.ok(lost.categories.every((c) => c.items.every((i) => i.asset === null)), 'no library at all: every placeholder is "no picture"');
  } finally { s.server.close(); }
});

test('counting: open and add, at most once per dish and kind, never for a demo or a preview, and nothing waits for it', async () => {
  const s = await listen(0), cfg = { supabaseUrl: s.origin + '/stub', supabaseKey: s.key }; const sent = [];
  const spy = (url, init) => { sent.push({ url, init }); return fetch(url, init); };
  try {
    const track = createTracker({ kind: 'slug', slug: 'olea' }, { fetch: spy, config: cfg });
    assert.equal(track('hummus', 'open'), true); assert.equal(track('hummus', 'open'), false, 'the same dish again: not sent'); assert.equal(track('hummus', 'add'), true); assert.equal(track('kebab', 'open'), true);
    assert.equal(track('kebab', 'look'), false); assert.equal(track(null, 'open'), false);
    assert.equal(sent.length, 3); assert.ok(sent.every((c) => c.init.keepalive === true && c.init.method === 'POST' && c.init.headers.apikey === s.key && c.url === s.origin + '/stub/rest/v1/rpc/track_item'));
    assert.deepEqual(sent.map((c) => JSON.parse(c.init.body)), [{ p_slug: 'olea', p_item: 'hummus', p_kind: 'open' }, { p_slug: 'olea', p_item: 'hummus', p_kind: 'add' }, { p_slug: 'olea', p_item: 'kebab', p_kind: 'open' }]);
    await new Promise((r) => setTimeout(r, 150)); assert.deepEqual(s.server.calls.map((c) => c.fn + ':' + c.args.p_item + ':' + c.args.p_kind), ['track_item:hummus:open', 'track_item:hummus:add', 'track_item:kebab:open']);
    for (const src of [{ kind: 'demo', name: 'olea' }, { kind: 'preview' }, { kind: 'none' }]) assert.equal(createTracker(src, { fetch: spy, config: cfg })('hummus', 'open'), false);
    assert.equal(createTracker({ kind: 'slug', slug: 'olea' }, { fetch: spy, config: undefined })('hummus', 'open'), false); assert.equal(sent.length, 3);
    const dead = createTracker({ kind: 'slug', slug: 'olea' }, { fetch: () => Promise.reject(new Error('offline')), config: cfg }); assert.equal(dead('hummus', 'open'), true, 'a failed call is swallowed');
    const thrown = createTracker({ kind: 'slug', slug: 'olea' }, { fetch: () => { throw new Error('no fetch'); }, config: cfg }); assert.equal(thrown('hummus', 'open'), true);
  } finally { s.server.close(); }
});

test('preview: waits for the studio, same origin only, announces itself', async () => {
  const listeners = [], posted = [], win = { location: { origin: 'https://halom.io' }, addEventListener: (n, f) => listeners.push(f), opener: { postMessage: (m, o) => posted.push([m, o]) } }; win.parent = win;
  const updates = [], p = waitForPreview({ window: win, base: 'https://halom.io/projects/menus/view/', onUpdate: (r) => updates.push(r) });
  assert.deepEqual(posted, [[{ type: 'halom-menu-preview-ready' }, 'https://halom.io']]);
  listeners[0]({ origin: 'https://evil.test', data: { type: 'halom-menu-preview', snapshot: raw() } });                               // ignored
  listeners[0]({ origin: 'https://halom.io', data: { type: 'something-else' } });
  listeners[0]({ origin: 'https://halom.io', data: { type: 'halom-menu-preview', snapshot: Object.assign(raw(), { slug: 'draft' }) } });
  const first = await p; assert.equal(first.state, 'ok'); assert.equal(first.snapshot.slug, 'draft');
  listeners[0]({ origin: 'https://halom.io', data: { type: 'halom-menu-preview', snapshot: Object.assign(raw(), { slug: 'draft2' }) } });
  assert.equal(updates.length, 1); assert.equal(updates[0].snapshot.slug, 'draft2');
});
