/* Browser tests for round two (headless Chromium, software WebGL): the rooms of the place, sold out at the bottom, the taste tags,
   "my table" setting itself. Run: node --test --test-concurrency=1 test/rooms.browser.test.mjs */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, listen, open, tableUp, settle, VIEW } from './browser.mjs';

let srv, browser;
before(async () => { srv = await listen(0); browser = await launch(['--disable-ipc-flooding-protection']); });
after(async () => { await browser.close(); srv.server.close(); });
const demo = (q = '', hash = '') => srv.origin + VIEW + '?demo=olea&hint=0' + q + hash;
const T = '&test=1&pr=0.3';
const st = (page) => page.evaluate(() => window.__mana.state());
const info = (page) => page.evaluate(() => window.__mana.info());
const d = (page, a) => page.evaluate((x) => window.__mana.dispatch(x), a);
const tick = (page, n, dt = 1 / 30) => page.evaluate(([a, b]) => window.__mana.tick(a, b, false), [n, dt]);
const text = (page, sel) => page.evaluate((q) => { const el = document.querySelector(q); return el && !el.closest('[hidden]') ? el.textContent.trim() : null; }, sel);
const loaded = (page) => page.waitForFunction(() => window.__mana.pending() === 0, null, { timeout: 30000 });

test('every room renders as its own place; the walk goes into a room and out again; Back walks back', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + '&lang=en', '#c=oven&i=bianca'));
  await tableUp(page); let i = await info(page); assert.equal(i.scene, 'table'); assert.equal(await text(page, '#dRoomAi'), null, 'the table has no backdrop to label');
  assert.ok(i.rooms.vitrine != null, 'the next section is the vitrine: its room is built before the guest gets there');
  /* into the vitrine, by the same walk: a line across it, the table on this side, the vitrine beyond */
  await page.click('.chip[data-id="sweet"]'); await tick(page, 4, .03); i = await info(page);
  assert.equal(i.scene, 'vitrine'); assert.ok(i.edge && i.edge.to === 'vitrine' && Math.abs(i.walkOn) > 3, 'the camera travels there: ' + JSON.stringify(i.edge) + ' ' + i.walkOn);
  await tick(page, 6, .03); i = await info(page); assert.ok(i.rooms.table > .05 && i.rooms.vitrine > .05, 'on the way both rooms are in the picture: ' + JSON.stringify(i.rooms));
  await loaded(page); await settle(page, 200); i = await info(page);
  assert.deepEqual([i.rooms.table, i.rooms.vitrine, i.edge], [0, 1, null]); assert.ok(i.heroReady); assert.equal((await st(page)).itemId, 'cheesecake');
  assert.equal(await text(page, '#dRoomAi'), 'Backdrop: made with AI');
  assert.ok(Math.abs(i.cam.E - 36) < .5, 'the vitrine\'s own eye: ' + i.cam.E);
  /* lift in the vitrine and put back */
  await d(page, { type: 'open', what: 'dish' }); await settle(page, 90); i = await info(page); assert.ok(i.lift > .95, 'lifted: ' + i.lift);
  await page.goBack(); await page.waitForFunction(() => window.__mana.state().open === null); await settle(page, 90); assert.ok((await info(page)).lift < .05);
  /* on to the cellar, the taps, the cocktail bar: each its own room, eye and light */
  const seen = [];
  for (const [cat, room, E] of [['wine', 'cellar', 29], ['beer', 'taps', 22], ['cold', 'cocktail', 43]]) {
    await page.click('.chip[data-id="' + cat + '"]'); await loaded(page); await settle(page, 220); i = await info(page);
    assert.equal(i.scene, room); assert.equal(i.rooms[room], 1); assert.ok(i.heroReady, room + ': the drink in focus is there'); assert.ok(Math.abs(i.cam.E - E) < .6, room + ': eye at ' + i.cam.E);
    assert.equal(await text(page, '#dRoomAi'), 'Backdrop: made with AI'); seen.push(Object.keys(i.rooms).filter((k) => i.rooms[k] > 0));
  }
  assert.deepEqual(seen, [['cellar'], ['taps'], ['cocktail']], 'one room lit at a time once the walk is over');
  /* a link into another room, and Back walks back through the same rooms (a chip replaces the history entry; a link adds one) */
  await page.evaluate(() => { location.hash = '#c=beer&i=beer-ipa'; }); await page.waitForFunction(() => window.__mana.state().itemId === 'beer-ipa'); i = await info(page); assert.ok(i.edge && i.edge.to === 'taps');
  await loaded(page); await settle(page, 200); assert.equal((await info(page)).rooms.taps, 1);
  await page.goBack(); await page.waitForFunction(() => window.__mana.state().categoryId === 'cold'); i = await info(page); assert.equal(i.scene, 'cocktail'); assert.ok(i.edge && i.edge.to === 'cocktail', 'Back walks back');
  await loaded(page); await settle(page, 200); assert.equal((await info(page)).rooms.cocktail, 1);
  /* a room built once stays ready (a few shapes and one picture), but only the room the guest is in is drawn */
  i = await info(page); assert.ok(Object.keys(i.rooms).every((k) => k === 'cocktail' || i.rooms[k] === 0));
  assert.deepEqual(errors, []); await ctx.close();
});

test('the cellar: the bottle in focus comes off the rack, turns, and pours; the taps pour with a head; the other drinks leave the counter to it', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + '&lang=en', '#c=wine&i=wine-red'));
  await tableUp(page); let i = await info(page); assert.equal(i.scene, 'cellar');
  const at = (await info(page)).actors.find((a) => a.id === 'wine-red'), z0 = at.z;
  await d(page, { type: 'open', what: 'dish' }); await tick(page, 20); i = await info(page);
  let a = i.actors.find((x) => x.id === 'wine-red'); assert.equal(a.pouring, true); assert.equal(i.pours, 1); assert.equal(a.z, z0, 'its place on the rack does not change; it is carried off it');
  assert.ok(i.cam.E < 20, 'the eye comes down to the counter: ' + i.cam.E);
  await tick(page, 40); a = (await info(page)).actors.find((x) => x.id === 'wine-red'); assert.ok(a.pose.level > 0, 'the glass fills: ' + JSON.stringify(a.pose));
  await tick(page, 300); a = (await info(page)).actors.find((x) => x.id === 'wine-red'); assert.equal(a.pouring, false); assert.deepEqual([a.pose.tilt, a.pose.level], [0, 1]);
  /* the taps */
  await d(page, { type: 'close' }); await d(page, { type: 'focus', id: 'beer-lager' }); await loaded(page); await settle(page, 220); i = await info(page); assert.equal(i.scene, 'taps');
  await d(page, { type: 'open', what: 'dish' }); await tick(page, 70); a = (await info(page)).actors.find((x) => x.id === 'beer-lager');
  assert.equal(a.pouring, true); assert.ok(a.pose.foam > .3, 'a head forms: ' + a.pose.foam);
  assert.ok((await info(page)).actors.filter((x) => x.id !== 'beer-lager').every((x) => x.vis < .2), 'the other beers make room');
  assert.deepEqual(errors, []); await ctx.close();
});

test('sold out waits at the end of its section, greyed and labelled; the list has the same order, with the taste tags, also without WebGL', async () => {
  let o = await open(browser, demo(T + '&lang=en', '#c=sweet')), page = o.page; await tableUp(page);
  let s = await st(page), m = await page.evaluate(() => window.__mana.model().catById.get('sweet').ids);
  assert.equal(s.itemId, 'cheesecake'); assert.equal(m[m.length - 1], 'brulee', 'the sold-out crème brûlée is last');
  await page.keyboard.press('End'); s = await st(page); assert.equal(s.itemId, 'brulee'); await settle(page, 120);
  assert.equal(await text(page, '#dSold'), 'Sold out'); const a = (await info(page)).actors.find((x) => x.id === 'brulee'); assert.ok(a.sat < .2, 'greyed: ' + a.sat);
  await o.ctx.close();
  o = await open(browser, demo('&gl=off&lang=en')); page = o.page; await page.evaluate(() => window.__mana.ready);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.l-cat')].map((c) => ({ id: c.dataset.id, rows: [...c.querySelectorAll('.row')].map((r) => r.dataset.id) })));
  const starters = rows.find((c) => c.id === 'starters').rows, sweet = rows.find((c) => c.id === 'sweet').rows;
  assert.equal(starters[starters.length - 1], 'fish-soup'); assert.equal(sweet[sweet.length - 1], 'brulee');
  const tags = await page.evaluate(() => [...document.querySelectorAll('.row[data-id="wine-white"] .tt')].map((t) => t.className + ':' + t.textContent));
  assert.ok(tags.length >= 4 && tags[0].includes('style s-white') && tags[0].includes('White'), 'the list row says it is a white wine: ' + tags.join(' | '));
  const sugg = await page.evaluate(() => [...document.querySelectorAll('.row[data-id="wine-rose"] .tt.sugg')].map((t) => t.textContent));
  assert.ok(sugg.length && sugg.every((x) => /read from the description/.test(x)), 'a tag read from the words says so: ' + sugg);
  assert.deepEqual(o.errors, []); await o.ctx.close();
  /* hide: business.soldOut = 'hide' (a preview from the studio carries it) */
  o = await open(browser, srv.origin + VIEW + '?preview=1&gl=off&lang=en'); page = o.page;
  await page.evaluate(async () => { const r = await fetch('demo/olea/menu.json'); const snap = await r.json(); snap.business.soldOut = 'hide'; snap.categories.forEach((c) => c.items.forEach((it) => { if (it.asset) for (const k of ['color', 'aux', 'thumb']) if (it.asset[k]) it.asset[k] = new URL('demo/olea/' + it.asset[k], location.href).href; })); window.postMessage({ type: 'halom-menu-preview', snapshot: snap }, location.origin); });
  await page.waitForFunction(() => window.__mana.state && window.__mana.state());
  assert.equal(await page.evaluate(() => document.querySelectorAll('.row[data-id="fish-soup"], .row[data-id="brulee"]').length), 0, 'hidden');
  await o.ctx.close();
});

test('taste tags: the card, the open sheet and the list; scales as pips; Hebrew', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + '&lang=en', '#c=wine&i=wine-white'));
  await tableUp(page);
  const card = await page.evaluate(() => [...document.querySelectorAll('#dTaste .tt')].map((t) => t.textContent));
  assert.deepEqual(card, ['White', 'Dry', 'Mineral', 'Citrus'], 'the card: style, the sweetness, two notes');
  await d(page, { type: 'open', what: 'dish' }); await settle(page, 60);
  const sheet = await page.evaluate(() => ({ chips: [...document.querySelectorAll('#dTasteFull .tt')].map((t) => t.textContent), pips: [...document.querySelectorAll('#dTasteFull .pips')].map((p) => p.querySelectorAll('i.on').length + '/' + p.children.length), icons: document.querySelectorAll('#dTasteFull svg.ti').length }));
  assert.deepEqual(sheet.chips.slice(0, 4), ['White', 'Sweetness: Dry', 'Body: Light', 'Acidity: Crisp']); assert.deepEqual(sheet.pips, ['1/4', '1/3', '3/3']); assert.ok(sheet.icons >= 6);
  await d(page, { type: 'focus', id: 'beer-stout', keep: true }); await settle(page, 60);
  const beer = await page.evaluate(() => ({ chips: [...document.querySelectorAll('#dTasteFull .tt')].map((t) => t.textContent), foot: (document.querySelector('#dTasteFull .tt-foot') || {}).textContent }));
  assert.deepEqual(beer.chips, ['Stout', '4.5%', 'Roast']); assert.equal(beer.foot, 'read from the description');
  await page.evaluate(() => window.__mana.setLang('he')); await settle(page, 30);
  const he = await page.evaluate(() => ({ chips: [...document.querySelectorAll('#dTasteFull .tt')].map((t) => t.textContent), ai: document.getElementById('dRoomAi').textContent, dir: document.documentElement.dir }));
  assert.deepEqual(he.chips, ['סטאוט', '4.5%', 'קלוי']); assert.equal(he.ai, 'רקע: נוצר בבינה מלאכותית'); assert.equal(he.dir, 'rtl');
  assert.deepEqual(errors, []); await ctx.close();
});

test('my table sets itself: a cloth, then a plate for each dish in turn; reduced motion shows it set at once', async () => {
  const shots = async (page) => page.evaluate(() => { const c = document.getElementById('traySet'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let k = 0; k < x.length; k += 97) h = (h * 31 + x[k]) % 1000003; return { hidden: c.hidden, w: c.width, h: c.height, sum: h, label: c.getAttribute('aria-label') }; });
  const o = await open(browser, demo('&capture=1&pr=0.3&lang=en')), page = o.page; await page.evaluate(() => window.__mana.settle());
  await page.evaluate(() => { const M = window.__mana; M.dispatch({ type: 'trayAdd', id: 'hummus' }); M.dispatch({ type: 'trayAdd', id: 'kebab' }); M.dispatch({ type: 'trayAdd', id: 'wine-red' }); M.dispatch({ type: 'open', what: 'tray' }); });
  const frames = []; for (let k = 0; k < 8; k++) { await page.evaluate(() => window.__mana.frame(250)); frames.push(await shots(page)); }
  assert.equal(frames[0].hidden, false); assert.ok(frames[0].w > 100 && Math.abs(frames[0].w / frames[0].h - 2.2) < .05);
  assert.ok(/Hummus|hummus/i.test(frames[0].label) && /Lamb kebab/.test(frames[0].label) && /House red/.test(frames[0].label), 'its words: ' + frames[0].label);
  assert.ok(new Set(frames.slice(0, 5).map((f) => f.sum)).size >= 4, 'the table is being set: the picture changes');
  assert.equal(frames[6].sum, frames[7].sum, 'and then it is still');
  assert.deepEqual(o.errors, []); await o.ctx.close();
  const r = await open(browser, demo('&capture=1&pr=0.3&lang=he'), { reducedMotion: 'reduce' }), pg = r.page; await pg.evaluate(() => window.__mana.settle());
  await pg.evaluate(() => { const M = window.__mana; M.dispatch({ type: 'trayAdd', id: 'hummus' }); M.dispatch({ type: 'trayAdd', id: 'kebab' }); M.dispatch({ type: 'open', what: 'tray' }); });
  const a = await shots(pg); await pg.evaluate(() => window.__mana.frame(1500)); const b = await shots(pg);
  assert.equal(a.sum, b.sum, 'reduced motion: set at once, nothing moves'); assert.ok(/השולחן שלכם/.test(a.label));
  assert.deepEqual(r.errors, []); await r.ctx.close();
});

test('reduced motion in the rooms: no travel between rooms, a cross-fade; and the room is still there', async () => {
  const { page, errors, ctx } = await open(browser, demo('&capture=1&pr=0.3&lang=en', '#c=oven&i=bianca'), { reducedMotion: 'reduce' }); await page.evaluate(() => window.__mana.settle());
  await page.click('.chip[data-id="sweet"]'); let i = await info(page); assert.equal(i.scene, 'vitrine'); assert.equal(i.edge, null); assert.equal(i.walkOn, 0, 'nothing travels');
  await page.evaluate(() => window.__mana.frame(400)); await loaded(page); await page.evaluate(() => window.__mana.frame(100)); i = await info(page); assert.equal(i.rooms.vitrine, 1);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the backdrop\'s AI label is never cut short: a 320 px phone, an illustrated drink that is sold out, both languages', async () => {
  const { page, errors, ctx } = await open(browser, srv.origin + VIEW + '?preview=1&test=1&pr=0.3&hint=0&lang=en', { width: 320, height: 640 });
  await page.evaluate(async () => { const r = await fetch('demo/olea/menu.json'), snap = await r.json(); snap.categories.forEach((c) => c.items.forEach((it) => { if (it.id === 'wine-orange') it.available = false; if (it.asset) for (const k of ['color', 'aux', 'thumb']) if (it.asset[k]) it.asset[k] = new URL('demo/olea/' + it.asset[k], location.href).href; })); window.postMessage({ type: 'halom-menu-preview', snapshot: snap }, location.origin); });
  await page.waitForFunction(() => window.__mana && window.__mana.state && window.__mana.state());
  await page.evaluate(() => window.__mana.dispatch({ type: 'focus', id: 'wine-orange' })); await loaded(page); await tableUp(page); await settle(page, 200);
  for (const lang of ['en', 'he']) {
    await page.evaluate((l) => window.__mana.setLang(l), lang); await settle(page, 30);
    const r = await page.evaluate(() => { const el = document.getElementById('dRoomAi'), card = document.getElementById('card').getBoundingClientRect(), b = el.getBoundingClientRect(), cs = getComputedStyle(el), vis = (id) => !document.getElementById(id).closest('[hidden]');
      return { text: el.textContent, shown: vis('dRoomAi'), illus: vis('dIllus'), sold: vis('dSold'), clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1, ellipsis: cs.textOverflow, inside: b.left >= card.left - 1 && b.right <= card.right + 1, w: b.width }; });
    assert.ok(r.shown && r.illus && r.sold, lang + ': an illustrated, sold-out drink in the cellar: ' + JSON.stringify(r));
    assert.equal(r.text, lang === 'en' ? 'Backdrop: made with AI' : 'רקע: נוצר בבינה מלאכותית');
    assert.ok(!r.clipped && r.ellipsis !== 'ellipsis' && r.inside, lang + ': the whole label shows: ' + JSON.stringify(r));
  }
  assert.deepEqual(errors, []); await ctx.close();
});

test('my table is set the same way in Hebrew and English: fork on the left, knife on the right', async () => {
  const sum = (page) => page.evaluate(() => { const c = document.getElementById('traySet'), x = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let k = 0; k < x.length; k += 53) h = (h * 31 + x[k]) % 1000003; return h; });
  const sums = [];
  for (const lang of ['en', 'he']) {
    const o = await open(browser, demo('&capture=1&pr=0.3&lang=' + lang), { reducedMotion: 'reduce' }); await o.page.evaluate(() => window.__mana.settle());
    await o.page.evaluate(() => { const M = window.__mana; M.dispatch({ type: 'trayAdd', id: 'kebab' }); M.dispatch({ type: 'trayAdd', id: 'hummus' }); M.dispatch({ type: 'open', what: 'tray' }); });      // dishes with their own pictures: nothing on the cloth is in words
    let a = -1, b = -2; for (let k = 0; k < 40 && a !== b; k++) { await o.page.waitForTimeout(100); await o.page.evaluate(() => window.__mana.frame(16)); a = b; b = await sum(o.page); }      // until the pictures have arrived and it is still
    sums.push(b); assert.deepEqual(o.errors, []); await o.ctx.close();
  }
  assert.equal(sums[0], sums[1], 'the same picture in both languages: nothing is mirrored');
});
