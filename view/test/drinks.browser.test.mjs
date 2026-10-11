/* Browser tests for the bar and the drinks (headless Chromium, software WebGL). Run: node --test --test-concurrency=1 test/drinks.browser.test.mjs
   In version 2 a drink stands full on the counter while the guest glides along the bar; LIFTING it (a tap, Enter, the card) brings
   the eye down to the counter and plays the pour once. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, listen, open, tableUp, settle, drag, VIEW } from './browser.mjs';

let srv, browser;
before(async () => { srv = await listen(0); browser = await launch(['--disable-ipc-flooding-protection']); });
after(async () => { await browser.close(); srv.server.close(); });
const demo = (q = '', hash = '') => srv.origin + VIEW + '?demo=olea' + q + hash;
const st = (page) => page.evaluate(() => window.__mana.state());
const info = (page) => page.evaluate(() => window.__mana.info());
const actor = async (page, id) => (await info(page)).actors.find((a) => a.id === id);
const tick = (page, n, dt = 1 / 30) => page.evaluate(([a, b]) => window.__mana.tick(a, b, false), [n, dt]);
const d = (page, a) => page.evaluate((x) => window.__mana.dispatch(x), a);
const text = (page, sel) => page.evaluate((q) => { const el = document.querySelector(q); return el && !el.closest('[hidden]') ? el.textContent.trim() : null; }, sel);

test('the pour plays once when a drink is lifted, again only when asked, and anything else ends it cleanly', async () => {
  const { page, errors, ctx } = await open(browser, demo('&test=1&pr=0.3&lang=en', '#c=wine'), { width: 390, height: 700 });
  await tableUp(page);
  let i = await info(page); assert.equal(i.scene, 'bar'); assert.equal(i.pours, 0); assert.deepEqual(i.actors.map((a) => a.type), ['drink', 'drink', 'drink', 'drink']);
  assert.ok(i.actors.every((a) => a.pose.level === 1 && a.pose.tilt === 0 && !a.pouring), 'along the bar the glasses stand full and still');
  await d(page, { type: 'focus', id: 'wine-red' }); await settle(page, 80); assert.equal((await info(page)).pours, 0, 'gliding to a drink does not pour it');
  await d(page, { type: 'open', what: 'dish' });
  let a = await actor(page, 'wine-red'); assert.equal(a.pouring, true); assert.equal((await info(page)).pours, 1);
  await tick(page, 45); a = await actor(page, 'wine-red'); assert.ok(a.pose.t > .9 && a.pose.tilt > .9 && a.pose.level > 0 && a.pose.level < .6, 'mid-pour: ' + JSON.stringify(a.pose));
  i = await info(page); assert.ok(i.cam.E < 20, 'the eye has come down towards the counter: ' + i.cam.E + '°'); assert.ok(i.actors.filter((x) => x.id !== 'wine-red').every((x) => x.vis < .2), 'the other drinks have left the counter to it');
  /* the next drink, with the sheet open: it is poured, the first returns to rest without a jump */
  await page.keyboard.press('ArrowDown');
  let s = await st(page); assert.equal(s.itemId, 'wine-orange'); assert.equal(s.open, 'dish');
  a = await actor(page, 'wine-red'); assert.equal(a.pouring, false); assert.equal((await actor(page, 'wine-orange')).pouring, true); assert.equal((await info(page)).pours, 2);
  await tick(page, 2); a = await actor(page, 'wine-red'); assert.ok(a.pose.tilt > .3 && a.pose.tilt < 1, 'it eases back, it does not snap: ' + a.pose.tilt);
  await tick(page, 40); a = await actor(page, 'wine-red'); assert.equal(a.pose.tilt, 0); assert.equal(a.pose.level, 1);
  await tick(page, 300); a = await actor(page, 'wine-orange'); assert.equal(a.pouring, false); assert.deepEqual([a.pose.tilt, a.pose.level, a.pose.fade], [0, 1, 1]);
  i = await info(page); assert.equal(i.pours, 2, 'it does not start again by itself'); assert.notEqual(i.moving, true, 'and then only the slow sway is left');
  /* "Pour again" */
  assert.equal(await page.isVisible('#pourBtn'), true); await page.click('#pourBtn'); assert.equal((await st(page)).pourSeq, 1); assert.equal((await info(page)).pours, 3); assert.equal((await actor(page, 'wine-orange')).pouring, true);
  await tick(page, 30);
  await page.setViewportSize({ width: 420, height: 700 }); await page.waitForTimeout(150); await tick(page, 2);
  assert.equal((await info(page)).pours, 3, 'a resize is not a reason to pour again'); assert.equal((await actor(page, 'wine-orange')).pouring, true, 'nor to stop');
  /* turning the bottle ends the pour; a drawn bottle turns all the way round, so the back label can be read, and stays where it is left */
  await page.evaluate(() => { for (let k = 0; k < 80; k++) window.__mana.turn(10, true); window.__mana.turn(0, false, 0); }); assert.equal((await actor(page, 'wine-orange')).pouring, false);
  await tick(page, 60); a = await actor(page, 'wine-orange'); assert.ok(a.yaw > 6.2, 'a drawn bottle turns all the way round: ' + a.yaw); assert.equal(a.pose.tilt, 0);
  await page.keyboard.press('Escape'); await tick(page, 40); assert.ok(Math.abs((await actor(page, 'wine-orange')).yaw) < .05, 'put back, it faces the guest again (the short way)');
  /* leaving in the middle of a pour: by a swipe down */
  await d(page, { type: 'open', what: 'dish' }); await tick(page, 30); assert.equal((await actor(page, 'wine-orange')).pouring, true);
  await drag(page, [200, 120], [200, 220], { steps: 5, ms: 20 });
  s = await st(page); assert.equal(s.open, null); assert.equal(s.itemId, 'wine-orange'); i = await info(page); assert.ok(i.actors.every((x) => !x.pouring));
  await tick(page, 80); i = await info(page); assert.ok(i.actors.every((x) => x.pose.tilt === 0 && x.pose.level === 1 && x.vis > .9), 'back on the bar every glass is full and every drink is there'); assert.ok(i.cam.E > 30);
  /* the other language mirrors the bar: the drinks are set down again, at rest and full, and nothing pours by itself */
  await d(page, { type: 'open', what: 'dish' }); await tick(page, 30); const before = (await info(page)).pours; assert.equal((await actor(page, 'wine-orange')).pouring, true);
  await d(page, { type: 'setLang', lang: 'he' }); await tick(page, 60); s = await st(page); assert.equal(s.open, 'dish'); assert.equal(s.itemId, 'wine-orange');
  i = await info(page); a = i.actors.find((x) => x.id === 'wine-orange' && !x.leaving); assert.equal(i.pours, before, 'a language change is not a reason to pour'); assert.equal(a.pouring, false); assert.deepEqual([a.pose.tilt, a.pose.level, a.pose.fade], [0, 1, 1]);
  assert.deepEqual(errors, []); await ctx.close();
});

test('a lifted drink is in view above its sheet at every size; a link straight to an open drink pours too; a tap has nothing to turn', async () => {
  for (const [w, h, lang] of [[390, 844, 'en'], [390, 844, 'he'], [360, 640, 'he'], [844, 390, 'en'], [1280, 800, 'en']]) {
    const { page, errors, ctx } = await open(browser, demo('&test=1&pr=0.2&lang=' + lang, '#c=wine&i=wine-white&o=1'), { width: w, height: h });
    await tableUp(page); assert.equal((await st(page)).open, 'dish'); assert.equal((await info(page)).pours, 1, 'a deep link to an open drink pours too (once: it has played by the time the table has settled)');
    await d(page, { type: 'pourAgain' }); assert.equal((await actor(page, 'wine-white')).pouring, true);
    for (const phase of ['pour', 'rest']) {
      await page.evaluate((n) => window.__mana.tick(n, 1 / 30, true), phase === 'pour' ? 40 : 320);
      const r = await page.evaluate(() => { const i = window.__mana.info(), c = document.getElementById('card').getBoundingClientRect(), hot = i.hot.find((x) => x.id === 'wine-white'); return { hot, card: [c.left, c.top, c.right, c.bottom], wide: i.frame.wide, over: document.documentElement.scrollWidth - innerWidth, line: document.getElementById('dIllusLine').textContent, pour: !document.getElementById('pourBtn').hidden }; });
      const where = `${w}x${h} ${lang} ${phase}`;
      assert.ok(r.hot && r.hot.cx - r.hot.rx > -6 && r.hot.cx + r.hot.rx < w + 6 && r.hot.cy - r.hot.ry > 0, where + ': bottle and glass are on screen ' + JSON.stringify(r.hot));
      if (!r.wide) assert.ok(r.hot.cy + r.hot.ry < r.card[1] + 24, where + ': above the sheet (' + Math.round(r.hot.cy + r.hot.ry) + ' vs ' + Math.round(r.card[1]) + ')'); else assert.ok(lang === 'he' ? r.hot.cx + r.hot.rx < r.card[0] + 20 : r.hot.cx - r.hot.rx > r.card[2] - 20, where + ': beside the sheet');
      assert.ok(r.over <= 0); assert.equal(r.line, lang === 'he' ? 'איור להמחשה · אפשר לבקש לראות את הבקבוק' : 'Illustration · ask to see the bottle'); assert.equal(r.pour, true);
    }
    assert.deepEqual(errors, [], `${w}x${h} ${lang}`); await ctx.close();
  }
});

test('reduced motion: no pour, a full glass, the same words; and the words are only the merchant\'s', async () => {
  const { page, errors, ctx } = await open(browser, demo('&test=1&pr=0.3&lang=en', '#c=wine&i=wine-red&o=1'), { width: 900, height: 700, reducedMotion: 'reduce' });
  await tableUp(page);
  let i = await info(page), a = i.actors.find((x) => x.id === 'wine-red'); assert.equal(i.pours, 0); assert.equal(a.pouring, false); assert.deepEqual([a.pose.tilt, a.pose.level, a.pose.fade], [0, 1, 1]); assert.equal(i.moving, false);
  assert.equal(await page.isVisible('#pourBtn'), false, 'nothing to replay'); assert.equal(await text(page, '#dIllusLine'), 'Illustration · ask to see the bottle'); assert.equal(await text(page, '#dIllus'), 'Illustration');
  const dl = (sel) => page.$$eval(sel + ' dt, ' + sel + ' dd', (els) => els.map((e) => e.textContent));
  assert.deepEqual(await dl('#dFacts'), ['Producer', 'Nahal Shakedim', 'Wine', 'Adom', 'Vintage', '2022', 'Region', 'Upper Galilee', 'Grape', 'Syrah, Carignan', 'Colour', 'Red', 'Served', 'By the glass, 150 ml']);
  assert.equal(await text(page, '#dNotesTitle'), 'Tasting notes'); assert.deepEqual(await dl('#dNotesList'), ['Sweetness', 'Dry', 'Acidity', 'Medium', 'Body', 'Medium', 'Fruit', 'Plum, black pepper', 'Goes with', 'Kebab, burger, lasagne']);      // minerality was not entered: no row
  await d(page, { type: 'open', what: 'dish', id: 'wine-rose' }); assert.equal(await page.isVisible('#dNotes'), false, 'no notes entered: no notes shown'); assert.equal((await dl('#dFacts')).length, 14);
  await d(page, { type: 'open', what: 'dish', id: 'wine-orange' }); assert.deepEqual(await dl('#dNotesList'), ['Fruit', 'Dried apricot, tea', 'Goes with', 'Artichoke, pizza bianca']);
  await d(page, { type: 'open', what: 'dish', id: 'beer-stout' }); await tick(page, 3);
  assert.deepEqual(await dl('#dFacts'), ['Brewery', 'Tzuk Brewing', 'Style', 'Dry stout', 'Alcohol', '4.5%', 'Served', 'Can', 'Colour', 'Dark']); assert.equal(await page.isVisible('#dNotes'), false);
  assert.equal(await text(page, '#dIllusLine'), 'Illustration · ask to see the can'); a = await actor(page, 'beer-stout'); assert.equal(a.pose.foam, 1, 'a settled head, no animation');
  await d(page, { type: 'open', what: 'dish', id: 'beer-lager' }); assert.equal(await text(page, '#dIllusLine'), 'Illustration'); await page.evaluate(() => { window.__mana.turn(60, true); window.__mana.turn(0, false, 0); window.__mana.tick(3, .03, false); }); assert.equal((await actor(page, 'beer-lager')).yaw, 0, 'a tap has no label to turn to');
  await d(page, { type: 'open', what: 'dish', id: 'lemonade' }); assert.equal(await text(page, '#dIllusLine'), null, 'a photograph is not called an illustration'); assert.equal(await text(page, '#dIllus'), null); assert.equal(await page.isVisible('#pourBtn'), false);
  await d(page, { type: 'open', what: 'dish', id: 'kebab' }); assert.equal(await text(page, '#dIllusLine'), null); assert.equal(await page.isVisible('#dFacts'), false);
  assert.equal((await info(page)).pours, 0); assert.deepEqual(errors, []); await ctx.close();
});

test('leaving the bar frees what the drinks used; losing the GPU in the middle of a pour ends in a full, still glass', async () => {
  const { page, errors, ctx } = await open(browser, demo('&test=1&pr=0.3&lang=en'), { width: 390, height: 600 });
  await tableUp(page); const base = await info(page);
  assert.deepEqual(base.drinks, { drinks: 0, geometries: 0 });
  await d(page, { type: 'setCategory', id: 'wine' }); await settle(page, 80); let i = await info(page);
  assert.equal(i.drinks.drinks, 4, 'only the drinks near the camera exist'); assert.ok(i.drinks.geometries >= 10 && i.memory.labels > 1); assert.ok(i.actors.every((a) => a.tris <= 12000), 'triangles per drink (bottle + glass + their reflections)');
  await d(page, { type: 'setCategory', id: 'beer' }); await settle(page, 80); i = await info(page); assert.equal(i.actors.filter((a) => !a.leaving).length, 4, 'the beers near the camera'); assert.ok(i.actors.filter((a) => a.leaving).every((a) => a.left) && i.drinks.drinks <= 8, 'the same counter: the wines we walked past still stand behind us, no more than the few that were near (' + i.drinks.drinks + ' drinks)');
  await d(page, { type: 'setCategory', id: 'oven' }); await settle(page, 80); await d(page, { type: 'setCategory', id: 'sweet' }); await settle(page, 100);      // (by way of the oven: the course before it has no name card, whose lettering would be counted as a label)
  i = await info(page); assert.deepEqual(i.drinks, { drinks: 0, geometries: 0 }, 'no bottle, glass, label or shared shape left'); assert.equal(i.memory.labels, 0); assert.equal(i.scene, 'table');
  assert.ok(i.gl.geometries <= base.gl.geometries + 6, 'geometries back to the food scene (' + base.gl.geometries + ' → ' + i.gl.geometries + ')'); assert.ok(i.textures <= 24);
  /* context loss during a pour */
  await d(page, { type: 'open', what: 'dish', id: 'beer-wheat' }); await settle(page, 40); assert.equal((await actor(page, 'beer-wheat')).pouring, true); const pours = (await info(page)).pours;
  await page.evaluate(() => { const c = document.getElementById('gl'); window.__ext = (c.getContext('webgl2') || c.getContext('webgl')).getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
  await page.waitForFunction(() => window.__mana.state().simple === true); assert.equal(await text(page, '#dName'), 'Wheat beer'); assert.equal(await page.isVisible('#pourBtn'), false);
  await page.evaluate(() => window.__ext.restoreContext()); await page.waitForFunction(() => window.__mana.state().simple === false, null, { timeout: 15000 }); await tableUp(page); await settle(page, 60);
  i = await info(page); const a = i.actors.find((x) => x.id === 'beer-wheat'); assert.equal(i.lost, false); assert.equal(a.pouring, false); assert.deepEqual([a.pose.tilt, a.pose.level, a.pose.foam], [0, 1, 1]); assert.equal(i.pours, pours, 'coming back is not a reason to pour again');
  assert.equal(await page.isVisible('#pourBtn'), true); await page.click('#pourBtn'); assert.equal((await actor(page, 'beer-wheat')).pouring, true, 'and "Pour again" still works');
  assert.deepEqual(errors.filter((e) => !/context|CONTEXT_LOST|WebGL/i.test(e)), []); await ctx.close();
});

test('a merchant\'s own bottle photo stays as it is; a glass may stand beside it and is filled from above', async () => {
  const own = await listen(0, { mutate(snap) {
    const cold = snap.categories.find((c) => c.id === 'cold'), wine = snap.categories.find((c) => c.id === 'wine'), beer = snap.categories.find((c) => c.id === 'beer');
    wine.items[2].asset = Object.assign({}, cold.items[0].asset, { glass: true });      // "House red" with a photo, and the owner's wish for a glass beside it
    wine.items[0].asset = Object.assign({}, cold.items[1].asset);                        // "House white" with a photo and nothing else
    beer.items[2].asset = Object.assign({}, cold.items[2].asset);                        // a bottled beer with a photo: a glass by default
  } });
  try {
    const { page, errors, ctx } = await open(browser, own.origin + '/m/olea?test=1&pr=0.3&lang=en#c=wine', { width: 390, height: 700 });
    await tableUp(page); let i = await info(page);
    assert.deepEqual(i.actors.map((a) => a.type), ['stand', 'drink', 'stand', 'drink']); assert.equal(i.drinks.drinks, 3, 'the plain photo has nothing added to it');
    await d(page, { type: 'open', what: 'dish', id: 'wine-red' }); await settle(page, 4); let a = await actor(page, 'wine-red'); assert.equal(a.pouring, true);
    await tick(page, 50); a = await actor(page, 'wine-red'); assert.ok(a.pose.level > 0 && a.pose.level < 1);
    assert.equal(await text(page, '#dIllus'), null, 'the bottle is a photograph: no "illustration" label'); assert.equal(await text(page, '#dIllusLine'), null); assert.equal(await page.isVisible('#pourBtn'), true);
    await page.evaluate(() => { for (let k = 0; k < 30; k++) window.__mana.turn(10, true); }); a = await actor(page, 'wine-red'); assert.ok(a.yaw > .5 && a.yaw <= .96, 'a photographed bottle turns only as far as its photo allows: ' + a.yaw);
    await page.evaluate(() => window.__mana.turn(0, false, 0)); await d(page, { type: 'open', what: 'dish', id: 'wine-white' }); assert.equal((await actor(page, 'wine-white')).pouring, false); assert.equal(await page.isVisible('#pourBtn'), false);
    await d(page, { type: 'open', what: 'dish', id: 'beer-wheat' }); await settle(page, 6);
    a = await actor(page, 'beer-wheat'); assert.equal(a.type, 'stand'); assert.equal(a.pouring, true);
    assert.deepEqual(errors, []); await ctx.close();
  } finally { own.server.close(); }
});
