/* Browser tests (headless Chromium, software WebGL). Slow by nature: run with  node --test --test-concurrency=1 test/browser.test.mjs
   What is checked here is behaviour: text, the glide, input, fallbacks, the ways a menu arrives, what is counted.
   Looks and motion are judged from frame sheets (tools/film.mjs, films/*.json). The clock is turned by hand (?test=1) except
   where a real finger is used. */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, listen, open, tableUp, settle, swipe, drag, VIEW } from './browser.mjs';

let srv, browser;
before(async () => { srv = await listen(0); browser = await launch(['--disable-ipc-flooding-protection']); });
after(async () => { await browser.close(); srv.server.close(); });
/* these tests are about the table and the one bar of before (the walk, courses, crossing between two rooms): ?rooms=off keeps them on
   those two rooms. The rooms of the place (vitrine, cellar, taps, cocktail bar) have their own tests: rooms.browser.test.mjs */
const demo = (q = '', hash = '', name = 'olea') => srv.origin + VIEW + '?demo=' + name + '&rooms=off' + q + hash;
const st = (page) => page.evaluate(() => window.__mana.state());
const info = (page) => page.evaluate(() => window.__mana.info());
const d = (page, a, meta) => page.evaluate(([x, m]) => window.__mana.dispatch(x, m), [a, meta || null]);
const tick = (page, n, dt = 1 / 30, draw = false) => page.evaluate(([a, b, c]) => window.__mana.tick(a, b, c), [n, dt, draw]);
const text = (page, sel) => page.evaluate((q) => { const el = document.querySelector(q); return el && !el.closest('[hidden]') ? el.textContent.trim() : null; }, sel);
const actor = async (page, id) => (await info(page)).actors.find((a) => a.id === id);
const T = '&test=1&pr=0.3', PULL = '&walk=pull';      // PULL: the other direction (the next dish further up the table), which the detailed glide tests were written in

test('the whole menu is real text with the table off; sold out is shown, never addable; no checkout', async () => {
  const { page, errors, ctx } = await open(browser, demo('&gl=off&test=1&lang=en'));
  await page.evaluate(() => window.__mana.ready); await page.waitForFunction(() => window.__mana.state().simple === true);
  const all = await page.evaluate(() => [...document.querySelectorAll('#list .l-cat')].map((sec) => ({ id: sec.dataset.id, h: sec.querySelector('h3').textContent,
    rows: [...sec.querySelectorAll('.row')].map((r) => ({ id: r.dataset.id, name: r.querySelector('.row-name').textContent, desc: (r.querySelector('.row-desc') || {}).textContent || '', price: r.querySelector('.row-price').textContent, sold: !!r.querySelector('.badge.sold'), thumb: !!r.querySelector('img.thumb'), href: r.getAttribute('href'), tab: r.getAttribute('tabindex') })) })));
  assert.deepEqual(all.map((c) => c.h), ['To start', 'Mains', 'From the oven', 'Sweet', 'Wine', 'Beer', 'Cold drinks']);
  assert.equal(all.reduce((n, c) => n + c.rows.length, 0), 43); assert.ok(all.every((c) => c.rows.every((r) => r.name && r.tab === null)), 'every row is named and reachable');
  const soup = all[0].rows.find((r) => r.id === 'fish-soup'); assert.ok(soup.sold); assert.match(soup.price, /54/); assert.match(soup.desc, /Tomato broth/); assert.match(soup.href, /#c=starters&i=fish-soup$/);
  assert.equal(all[0].rows.find((r) => r.id === 'bread').thumb, false); assert.ok(all[2].rows.find((r) => r.id === 'lasagne').thumb);
  assert.equal(await page.isVisible('#scene'), false); assert.equal(await page.isVisible('#notice'), true); assert.equal(await page.isVisible('#listBtn'), false); assert.equal(await page.isVisible('#card'), false);
  await page.click('.row[data-id="fish-soup"]');
  assert.equal((await st(page)).open, 'dish'); assert.equal(await text(page, '#dName'), 'Fish soup'); assert.equal(await page.isVisible('#dSold'), true); assert.equal(await page.isDisabled('#addBtn2'), true); assert.equal(await text(page, '#addBtn2'), 'Sold out');
  assert.equal(await page.isVisible('#dPhoto'), true, 'without the table the sheet shows the small picture');
  await page.keyboard.press('Escape'); assert.equal((await st(page)).open, null);
  await d(page, { type: 'open', what: 'dish', id: 'wine-orange' });
  const facts = await page.$$eval('#dFacts dt, #dFacts dd', (els) => els.map((e) => e.textContent)); assert.ok(facts.includes('Tzlil HaEven') && facts.includes('French Colombard') && facts.includes('Orange') && facts.includes('Negev Highlands'));
  assert.equal(await text(page, '#dIllus'), 'Illustration', 'a drawn bottle is labelled an illustration, also in the list view');
  await d(page, { type: 'open', what: 'dish', id: 'beer-stout' }); assert.ok((await page.$$eval('#dFacts dd', (els) => els.map((e) => e.textContent))).includes('Can'));
  await page.waitForTimeout(350); await page.click('#addBtn2'); await page.click('#addBtn2'); await d(page, { type: 'open', what: 'dish', id: 'hummus' }); await page.click('#addBtn2'); await page.keyboard.press('Escape');
  await page.click('#trayBtn'); await page.waitForTimeout(350);
  assert.equal(await text(page, '#trayTotal'), '₪96'); assert.equal(await text(page, '#trayCount'), '3');
  const sheet = await page.evaluate(() => ({ order: document.getElementById('orderLink').textContent, href: document.getElementById('orderLink').href, target: document.getElementById('orderLink').target, buttons: [...document.querySelectorAll('#traySheet button, #traySheet a')].map((b) => b.textContent.trim()) }));
  assert.equal(sheet.order, 'Order online'); assert.equal(sheet.href, '', 'a demo names no host and its ordering button leads nowhere (the two cases have tests of their own below)');
  assert.ok(!/checkout|pay|order now|לתשלום/i.test(sheet.buttons.filter((b) => b !== sheet.order).join(' ')), 'no ordering inside the viewer');
  await page.keyboard.press('Escape'); await page.waitForTimeout(350); assert.equal(await page.isVisible('#traySheet'), false);
  await page.reload(); await page.evaluate(() => window.__mana.ready); assert.equal(await text(page, '#trayCount'), '3');       // the shortlist is kept on this phone only
  assert.deepEqual(errors, []); await ctx.close();
});

test('fuzz in the real DOM: 5,000 random actions and Back presses; card, chip, list, sheets and URL always match the state', async () => {
  const { page, errors, ctx } = await open(browser, demo('&gl=skip&test=1'));
  await page.evaluate(() => window.__mana.ready);
  const res = await page.evaluate(async () => {
    const M = window.__mana, m = M.model(), items = [...m.itemById.keys()], cats = m.cats.map((c) => c.id), bad = [], $ = (id) => document.getElementById(id);
    let seed = 99; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }, pick = (a) => a[Math.floor(rnd() * a.length)];
    const tx = (o, l) => o[l] || o.he || o.en;
    const acts = [() => ({ type: 'step', dir: pick([-1, 1]) }), () => ({ type: 'step', dir: pick([-1, 1]) }), () => ({ type: 'swipe', sx: pick([-1, 1]) }), () => ({ type: 'arrow', key: pick(['ArrowLeft', 'ArrowRight']) }), () => ({ type: 'focus', id: pick(items) }), () => ({ type: 'focus', id: pick(items) }),
      () => ({ type: 'open', what: pick(['dish', 'list', 'tray']) }), () => ({ type: 'open', what: 'dish', id: pick(items) }), () => ({ type: 'close' }), () => ({ type: 'escape' }), () => ({ type: 'stepCategory', dir: pick([-1, 1]) }), () => ({ type: 'setCategory', id: pick(cats) }),
      () => ({ type: 'home' }), () => ({ type: 'end' }), () => ({ type: 'setLang', lang: pick(['he', 'en']) }), () => ({ type: 'trayAdd', id: pick(items) }), () => ({ type: 'focus', id: 'missing' })];
    const hashOf = (s) => '#c=' + encodeURIComponent(s.categoryId) + '&i=' + encodeURIComponent(s.itemId) + (s.open ? '&o=' + (s.open === 'dish' ? '1' : s.open) : '');
    const check = (n, urlToo) => {
      const s = M.state(), e = m.itemById.get(s.itemId), cat = m.catById.get(s.categoryId), fail = (w) => { if (bad.length < 10) bad.push(n + ': ' + w); };
      if (!e || e.cat.id !== cat.id) return fail('no dish in focus');
      const chip = document.querySelector('.chip[aria-current="true"]'); if (!chip || chip.dataset.id !== s.categoryId || chip.textContent !== tx(cat.raw.name, s.lang)) fail('chip');
      if (document.documentElement.dir !== (s.lang === 'he' ? 'rtl' : 'ltr')) fail('dir');
      if ($('dName').textContent !== tx(e.item.name, s.lang)) fail('card ' + $('dName').textContent + ' ≠ ' + s.itemId);
      if ($('dIdx').textContent !== (e.i + 1) + ' / ' + cat.items.length) fail('index');
      if ($('dSold').hidden !== (e.item.available !== false)) fail('sold badge');
      if ($('live').textContent.indexOf(tx(e.item.name, s.lang)) < 0 && s.nav.kind !== 'edge') fail('announcement');
      const cur = document.querySelector('#list .row[aria-current="true"]'); if (!cur || cur.dataset.id !== s.itemId) fail('list row');
      if ($('app').classList.contains('lifted') !== (s.open === 'dish')) fail('lifted class'); if ($('list').classList.contains('open') !== (s.open === 'list')) fail('list sheet'); if ($('traySheet').hidden !== (s.open !== 'tray')) fail('tray sheet');
      if ($('closeBtn').hidden !== (s.open !== 'dish') || $('cardMore').inert !== (s.open !== 'dish')) fail('sheet controls');
      if (document.querySelectorAll('#list .row').length !== 43) fail('the list lost rows');
      if (urlToo && location.hash !== hashOf(s)) fail('url ' + location.hash + ' ≠ ' + hashOf(s));
    };
    const pause = () => new Promise((r) => setTimeout(r, 0)); let backs = 0, maxLen = history.length; const len0 = history.length;
    const landed = async () => { for (let i = 0; i < 200 && location.hash !== hashOf(M.state()); i++) await pause(); };              // a real Back lands a few tasks later; wait for it, then insist
    for (let n = 0; n < 5000; n++) {
      if (rnd() < .08) await landed();                                                       // (our own Back may still be in flight: let it land before pressing Back ourselves)
      if (rnd() < .08 && location.hash === hashOf(M.state()) && M.state().open && history.state && history.state.under != null) { const before = location.hash; history.back(); backs++; for (let i = 0; i < 50 && location.hash === before; i++) await pause(); await landed(); check(n, true); continue; }      // Back only while something is open: otherwise it would leave the menu
      M.dispatch(pick(acts)()); check(n, false);
      if (n % 40 === 0) { await landed(); check(n, true); maxLen = Math.max(maxLen, history.length); }
    }
    await landed(); check('end', true);
    return { bad, backs, grew: maxLen - len0 };
  });
  assert.deepEqual(res.bad, []); assert.ok(res.backs > 30, 'Back presses: ' + res.backs); assert.ok(res.grew <= 1, 'history grew by ' + res.grew + ' entries'); assert.deepEqual(errors, []); await ctx.close();
});

test('the glide: the table follows a scripted finger exactly, the card changes as the next dish crosses the line, a flick lands on a dish', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + PULL + '&lang=en'));
  await tableUp(page);
  const f = (await info(page)).frame, px = f.pxPerDish, x = f.cx; let i = await info(page);
  assert.equal(i.scene, 'table'); assert.equal(i.p, 0); assert.equal(await text(page, '#dName'), 'Labaneh & olives'); assert.equal(await text(page, '#dIdx'), '1 / 9');
  const hero0 = i.hot.find((h) => h.id === 'labaneh'); assert.ok(Math.abs(hero0.cx - f.cx) < 40 && Math.abs(hero0.cy - f.cy) < 40, 'the dish in focus is where the frame says');
  assert.ok(hero0.rx * 2 / f.W > .8 && hero0.rx * 2 / f.W < .9, 'and about 84% of the width: ' + (hero0.rx * 2 / f.W).toFixed(2));
  const next0 = i.hot.find((h) => h.id === 'hummus'); assert.ok(next0 && next0.cy < hero0.cy - 150 && next0.rx < hero0.rx, 'the next dish is further up the table, smaller');
  /* hold the finger down and pull the table towards you */
  const y0 = hero0.cy, pull = Math.round(px * .4);                                           // the finger lands on the middle of the dish
  await drag(page, [x, y0], [x, y0 + pull], { steps: 10, release: false }); await tick(page, 1, 0, true); i = await info(page);
  assert.ok(i.p > .3 && i.p < .42, 'the camera has moved ' + i.p + ' of a dish'); assert.equal(i.mode, 'drag'); assert.equal((await st(page)).itemId, 'labaneh'); assert.equal(await text(page, '#dName'), 'Labaneh & olives');
  const hero1 = i.hot.find((h) => h.id === 'labaneh'); assert.ok(Math.abs((hero1.cy - hero0.cy) - pull) <= 2, 'the dish under the finger moved exactly with it: ' + (hero1.cy - hero0.cy) + ' px for ' + pull);
  const next1 = i.hot.find((h) => h.id === 'hummus'); assert.ok(next1.cy - next0.cy < pull * .9 && next1.cy > next0.cy, 'the far dish moved less than the near one (' + (next1.cy - next0.cy) + ' px)');
  await page.evaluate(([px_, y]) => { window.__mana.pointer('move', px_, y); window.__mana.tick(1, .016, false); }, [x, y0 + px * .62]);
  assert.equal((await st(page)).itemId, 'hummus', 'past half way: the next dish is in focus'); assert.equal(await text(page, '#dName'), 'Warm hummus'); assert.equal(await text(page, '#dPrice'), '₪36'); assert.equal(await text(page, '#dIdx'), '2 / 9');
  assert.match(await text(page, '#live'), /Warm hummus, ₪36, 2 of 9/); assert.equal(new URL(page.url()).hash, '#c=starters&i=hummus');
  await page.evaluate(([px_, y]) => { window.__mana.tick(12, .016, false); window.__mana.pointer('up', px_, y); }, [x, y0 + px * .62]);      // the finger rests, then lifts: no momentum
  await settle(page, 60); i = await info(page); assert.equal(i.p, 1); assert.equal(i.mode, 'rest');
  /* a flick: short and quick. One dish. */
  await drag(page, [x, 300], [x, 300 + 70], { steps: 4, ms: 16 }); assert.equal((await st(page)).itemId, 'hummus'); await settle(page, 60);
  assert.equal((await info(page)).p, 2); assert.equal((await st(page)).itemId, 'chopped-salad'); assert.equal(await text(page, '#dName'), 'Chopped salad');
  /* a hard flick passes several */
  await drag(page, [x, 260], [x, 260 + 280], { steps: 5, ms: 14 }); await settle(page, 90); i = await info(page);
  assert.ok(i.p >= 5 && Number.isInteger(i.p), 'a hard flick went from dish 2 to dish ' + i.p); assert.equal((await st(page)).itemId, (await page.evaluate(() => window.__mana.model().cats[0].ids))[i.p]);
  /* back again: push the table away */
  await drag(page, [x, 500], [x, 500 - 70], { steps: 4, ms: 16 }); await settle(page, 60); assert.equal((await info(page)).p, i.p - 1);
  /* only the dishes near the camera exist, and what was left behind has been let go */
  i = await info(page); assert.ok(i.actors.length <= 8 && i.actors.filter((a) => !a.guest).every((a) => Math.abs(a.i - i.p) <= 4.4), 'actors: ' + i.actors.map((a) => a.i)); assert.ok(i.textures <= 2 * (8 + 10), 'pictures on the GPU: ' + i.textures);
  /* a tap on the dish further up glides to it; a tap on the dish in focus lifts it */
  await d(page, { type: 'focus', id: 'labaneh' }); await settle(page, 80); i = await info(page); const up = i.hot.find((h) => h.id === 'hummus');
  await page.evaluate(([px_, y]) => { window.__mana.pointer('down', px_, y); window.__mana.pointer('up', px_, y); }, [up.cx, up.cy + up.ry * .5]);
  assert.equal((await st(page)).itemId, 'hummus'); assert.equal((await st(page)).open, null); await settle(page, 60);
  await page.evaluate(([px_, y]) => { window.__mana.pointer('down', px_, y); window.__mana.pointer('up', px_, y); }, [f.cx, f.cy]);
  assert.equal((await st(page)).open, 'dish'); assert.equal(srv.server.calls.length, 0, 'a demo is never counted');
  assert.deepEqual(errors, []); await ctx.close();
});

test('categories: a sideways swipe or a chip walks on along the SAME table, past the section\'s name; nothing goes dark, on the way to the bar either', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + PULL + '&lang=en'));
  await tableUp(page);
  const f = (await info(page)).frame, x = f.cx, lane0 = (await info(page)).lane.x;
  await drag(page, [300, 400], [300 - 120, 406], { steps: 6, ms: 16 });                    // finger left: on to the next section
  let s = await st(page); assert.equal(s.categoryId, 'mains'); assert.equal(s.itemId, 'pappardelle'); assert.equal(await text(page, '#dName'), 'Salmon pappardelle'); assert.equal(await text(page, '.chip[aria-current="true"]'), 'Mains');
  let i = await info(page); assert.ok(Math.abs(i.lane.x - lane0) < .01, 'the next section is on the same table'); assert.ok(Math.abs(i.walkOn) > 2, 'the walk goes on along it: ' + i.walkOn); assert.deepEqual(i.titles.map((t) => t.text), ['Mains'], 'the name of the section is lettered on the table, before its first dish'); assert.ok(i.actors.some((a) => a.id === 'labaneh' && a.leaving && a.left), 'the dish we leave stays on the table behind us');
  await tick(page, 5, .03); i = await info(page); assert.equal(i.lampK, 1, 'the lamp stays up: nothing goes dark on the way'); assert.ok(Math.abs(i.walkOn) > .2 && Math.abs(i.walkOn) < 4.5, 'on the way: ' + i.walkOn);
  await settle(page, 120); i = await info(page); assert.equal(i.lampK, 1); assert.equal(i.walkOn, 0, 'arrived'); assert.ok(i.actors.filter((a) => a.leaving).every((a) => a.left), 'what stood in the way has gone; what lies behind is still on the table');
  await settle(page, 60); i = await info(page); assert.ok(i.heroReady && i.actors.find((a) => a.id === 'pappardelle').vis > .9);
  await drag(page, [100, 400], [100 + 120, 404], { steps: 6, ms: 16 }); s = await st(page); assert.equal(s.categoryId, 'starters'); assert.equal(s.itemId, 'labaneh', 'you arrive at the first dish');
  await settle(page, 40); assert.ok(Math.abs((await info(page)).lane.x - lane0) < .01, 'and the camera is back over the first table');
  await drag(page, [100, 400], [100 + 120, 404], { steps: 6, ms: 16 }); s = await st(page); assert.equal(s.categoryId, 'starters'); assert.equal(s.nav.kind, 'edge', 'nothing before the first category: it only resists');
  await drag(page, [300, 400], [300 - 30, 402], { steps: 6, ms: 30 }); await tick(page, 10, .03); assert.equal((await st(page)).categoryId, 'starters', 'a short slow drag is not a swipe');
  /* an interrupted change: two swipes, the second before the first has finished */
  await drag(page, [300, 400], [180, 404], { steps: 5, ms: 16 }); await tick(page, 3, .03); await drag(page, [300, 400], [180, 404], { steps: 5, ms: 16 });
  assert.equal((await st(page)).categoryId, 'oven'); await settle(page, 80); i = await info(page); assert.ok(i.actors.filter((a) => a.leaving).every((a) => a.left) && i.actors.find((a) => a.id === 'margherita').vis > .9 && i.lampK === 1 && i.walkOn === 0);
  /* chips */
  await page.click('.chip[data-id="starters"]'); assert.equal((await st(page)).itemId, 'labaneh'); await settle(page, 80);
  /* the walk: at the last dish, a flick onwards is the next category; before the first dish of that, a flick back is the last dish again */
  await d(page, { type: 'focus', id: 'fish-soup' }); await settle(page, 80); assert.equal((await info(page)).p, 8);
  await drag(page, [x, 300], [x, 300 + 170], { steps: 12, release: false }); await tick(page, 1, 0, true);
  i = await info(page); assert.ok(i.p > 8.22 && i.p < 8.85, 'past the last dish the table stretches: ' + i.p); assert.equal(await text(page, '#edgeTxt'), 'Mains', 'and says where the walk goes on');
  await page.evaluate(([px_, y]) => { window.__mana.tick(8, .016, false); window.__mana.pointer('up', px_, y); }, [x, 470]);
  s = await st(page); assert.equal(s.categoryId, 'mains'); assert.equal(s.itemId, 'pappardelle'); assert.equal((await info(page)).p, 0); assert.equal(await page.isVisible('#edge'), true);
  await settle(page, 60); await tick(page, 1, .03, true); assert.equal(await page.isVisible('#edge'), false);
  await drag(page, [x, 500], [x, 500 - 70], { steps: 4, ms: 16 });                           // push the table away at its first dish
  s = await st(page); assert.equal(s.categoryId, 'starters'); assert.equal(s.itemId, 'fish-soup', 'backwards you arrive at the last dish'); assert.equal((await info(page)).p, 8);
  /* from the food table to the bar: another room, reached in the same kind of move (its own test is below) */
  await settle(page, 60); await page.click('.chip[data-id="wine"]'); await tick(page, 4, .03); i = await info(page); assert.equal(i.lampK, 1, 'the lamp stays up on the way to the bar too'); assert.ok(i.edge && i.edge.to === 'bar' && Math.abs(i.walkOn) > 1, 'the camera travels there: ' + i.walkOn); assert.deepEqual(i.titles, []); await settle(page, 160); i = await info(page); assert.equal(i.scene, 'bar'); assert.equal(i.lampK, 1); assert.ok(i.fade > .95); assert.deepEqual(i.actors.map((a) => a.type), ['drink', 'drink', 'drink', 'drink']); assert.equal(i.edge, null);
  await d(page, { type: 'end' }); await d(page, { type: 'end' }); await settle(page, 120); s = await st(page); assert.equal(s.itemId, 'mojito');
  await drag(page, [x, 300], [x, 300 + 70], { steps: 4, ms: 16 }); await settle(page, 60); assert.equal((await st(page)).itemId, 'mojito', 'the end of the menu: it bounces and stays'); assert.equal((await info(page)).p, 3);
  assert.deepEqual(errors, []); await ctx.close();
});

test('lift, turn, close: tap the dish, the card grows into the sheet, a drag turns it within its limit and it comes back; four ways to close', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + '&lang=en', '#c=starters&i=artichoke'));
  await tableUp(page);
  const f = (await info(page)).frame; let i = await info(page);
  const cardY = () => page.evaluate(() => Math.round(document.getElementById('card').getBoundingClientRect().top));
  assert.equal(await cardY(), f.H - f.cardH, 'the card shows its head at the bottom'); assert.equal(await page.getAttribute('#openBtn', 'aria-expanded'), 'false'); assert.equal(await page.evaluate(() => document.getElementById('cardMore').inert), true);
  await page.evaluate(([x, y]) => { window.__mana.pointer('down', x, y); window.__mana.pointer('up', x, y); }, [f.cx, f.cy]);
  assert.equal((await st(page)).open, 'dish'); assert.equal(new URL(page.url()).hash, '#c=starters&i=artichoke&o=1');
  await tick(page, 4, .03); i = await info(page); assert.ok(i.lift > .3 && i.lift < 1, 'it rises, it does not jump: ' + i.lift);
  await settle(page, 60); await tick(page, 1, 0, true); i = await info(page);
  /* the sheet is as tall as what it has to say (never taller than the full sheet), and the dish takes the middle of what is left */
  const sheet = f.H - await cardY(), said = await page.evaluate(() => Math.round(document.querySelector('#cardMore .actions').getBoundingClientRect().bottom));
  assert.ok(i.lift > .99 && i.actors.find((a) => a.id === 'artichoke').lift > .99); assert.ok(sheet > f.cardH + 40 && sheet <= f.sheetH, 'the card has grown into the sheet: ' + sheet + ' of ' + f.sheetH); assert.ok(said <= f.H && said > f.H - 60, 'all of it on screen, no empty half: ' + said);
  assert.ok(Math.abs(i.cam.cy - (60 + (f.H - sheet - 60) * .5)) < 1.5 && i.cam.zoom > 1.03, 'the dish in the middle of the free part: ' + i.cam.cy);
  const hot = i.hot.find((h) => h.id === 'artichoke'); assert.ok(hot.cy + hot.ry < f.H - sheet + 30 && hot.cy - hot.ry > 30, 'the lifted dish is clear of the sheet: ' + (hot.cy - hot.ry).toFixed(0) + '…' + (hot.cy + hot.ry).toFixed(0) + ' above ' + (f.H - sheet));
  assert.equal(await page.getAttribute('#openBtn', 'aria-expanded'), 'true'); assert.equal(await page.isVisible('#closeBtn'), true); assert.equal(await page.evaluate(() => document.getElementById('cardMore').inert), false);
  assert.equal(await text(page, '#dDescFull'), 'Kalamata olives, red onion, parsley, yogurt'); assert.deepEqual(await page.$$eval('#dTagsFull .tag', (els) => els.map((e) => e.textContent)), ['Vegetarian', 'Gluten free'], 'tags as icons with their words');
  assert.equal(await text(page, '#dAllergens'), 'Allergens: Milk'); assert.equal(await text(page, '#addBtn2'), 'Add to my table'); assert.equal(await text(page, '#orderLink2'), 'Order online');
  /* turn */
  await drag(page, [150, hot.cy], [150 + 40, hot.cy + 3], { steps: 5, ms: 30, release: false }); await tick(page, 1, 0); assert.ok(Math.abs((await actor(page, 'artichoke')).yaw - 40 * .0085) < .03, 'the dish turns with the finger');
  await page.evaluate(([x, y]) => { for (let k = 1; k <= 6; k++) { window.__mana.pointer('move', x + k * 30, y); window.__mana.tick(1, .03, false); } }, [190, hot.cy]);
  assert.equal((await actor(page, 'artichoke')).yaw, .45, 'a plate turns about 25° and no further'); assert.equal((await st(page)).categoryId, 'starters', 'a sideways drag on a lifted dish turns it, it does not change table');
  await page.evaluate(([x, y]) => { window.__mana.tick(10, .03, false); window.__mana.pointer('up', x, y); }, [370, hot.cy]); await tick(page, 6, .03); const back = (await actor(page, 'artichoke')).yaw; assert.ok(back < .44 && back > 0, 'let go, it starts back: ' + back);
  await settle(page, 90); assert.equal((await actor(page, 'artichoke')).yaw, 0, 'and comes to rest straight');
  await page.keyboard.press('ArrowRight'); await tick(page, 4, .03); assert.ok((await actor(page, 'artichoke')).yaw > .02, 'arrow keys turn it too'); await settle(page, 90);
  /* close: swipe down */
  await drag(page, [f.cx, 120], [f.cx, 120 + 90], { steps: 5, ms: 20 }); assert.equal((await st(page)).open, null); await tick(page, 3, .03); assert.ok((await info(page)).lift < .9); await settle(page, 60); assert.equal(await cardY(), f.H - f.cardH); assert.equal((await info(page)).lift, 0);
  assert.equal((await st(page)).itemId, 'artichoke'); assert.equal(new URL(page.url()).hash, '#c=starters&i=artichoke');
  /* close: a tap beside the dish */
  await page.click('#openBtn'); assert.equal((await st(page)).open, 'dish'); await settle(page, 60); await tick(page, 1, 0, true);
  await page.evaluate(([x, y]) => { window.__mana.pointer('down', x, y); window.__mana.pointer('up', x, y); }, [20, 70]); assert.equal((await st(page)).open, null);
  /* close: the button, Esc, Back */
  await d(page, { type: 'open', what: 'dish' }); await page.click('#closeBtn'); assert.equal((await st(page)).open, null);
  await d(page, { type: 'open', what: 'dish' }); await page.keyboard.press('Escape'); assert.equal((await st(page)).open, null);
  await d(page, { type: 'open', what: 'dish' }); await page.goBack(); await page.waitForFunction(() => window.__mana.state().open === null); assert.equal((await st(page)).itemId, 'artichoke');
  /* the card itself can be pulled up, and Enter lifts for a keyboard */
  await page.keyboard.press('Enter'); assert.equal((await st(page)).open, 'dish'); await page.keyboard.press('ArrowDown'); assert.equal((await st(page)).itemId, 'filo'); assert.equal((await st(page)).open, 'dish', 'arrow down walks on with the sheet open');
  assert.equal(await text(page, '#dName'), 'Filo parcels'); await settle(page, 80); assert.ok((await actor(page, 'filo')).lift > .99 && (await actor(page, 'artichoke')).lift < .01, 'the next dish is the lifted one now');
  await page.keyboard.press('Escape'); assert.equal(srv.server.calls.length, 0);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the list sheet: the whole menu over the scene; a row flies to its dish and closes it; it is in the page even when closed', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + '&lang=en'));
  await tableUp(page);
  const closed = await page.evaluate(() => { const l = document.getElementById('list'), cs = getComputedStyle(l), r = l.getBoundingClientRect(); return { display: cs.display, vis: cs.visibility, hiddenAttr: l.hidden, aria: l.getAttribute('aria-hidden'), inert: l.inert, top: r.top, h: innerHeight, rows: l.querySelectorAll('.row').length, tab: [...l.querySelectorAll('.row')].every((a) => a.getAttribute('tabindex') === '-1'),
    text: [...l.querySelectorAll('.row')].slice(0, 2).map((a) => a.innerText.replace(/\s+/g, ' ').trim()) }; });
  assert.equal(closed.rows, 43); assert.ok(closed.display !== 'none' && closed.vis === 'visible' && !closed.hiddenAttr && closed.aria === null && !closed.inert, 'closed, the list is still there for a screen reader');
  assert.ok(closed.top >= closed.h, 'but below the screen'); assert.ok(closed.tab, 'and out of the Tab order'); assert.match(closed.text[0], /Labaneh & olives.*Strained yogurt.*₪38/);
  await page.click('#listBtn'); let s = await st(page); assert.equal(s.open, 'list'); assert.equal(new URL(page.url()).hash, '#c=starters&i=labaneh&o=list');
  const openS = await page.evaluate(() => { const l = document.getElementById('list'), r = l.getBoundingClientRect(); return { top: r.top, role: l.getAttribute('role'), tab: [...l.querySelectorAll('.row')].every((a) => !a.hasAttribute('tabindex')), cur: l.querySelector('.row[aria-current="true"]').dataset.id, focus: document.activeElement.id, topInert: document.getElementById('top').inert, credit: document.getElementById('credit').textContent, demo: document.getElementById('demoLine').textContent }; });
  assert.ok(openS.top < 20); assert.equal(openS.role, 'dialog'); assert.ok(openS.tab); assert.equal(openS.cur, 'labaneh'); assert.equal(openS.focus, 'listClose'); assert.equal(openS.topInert, true);
  assert.equal(openS.credit, 'Menu by mana'); assert.equal(openS.demo, 'Demo menu · invented restaurant\nDemo dishes · made with AI');      /* night:templates: the demo line now carries the AI label */
  await page.click('.row[data-id="kebab"]'); s = await st(page); assert.equal(s.open, null); assert.equal(s.itemId, 'kebab'); assert.equal(s.categoryId, 'mains'); assert.equal(await text(page, '#dName'), 'Lamb kebab');
  await settle(page, 90); let i = await info(page); assert.equal(i.p, 6); assert.ok(i.actors.find((a) => a.id === 'kebab').vis > .9); assert.equal(await page.evaluate(() => document.getElementById('list').classList.contains('open')), false);
  await page.click('#listBtn'); await page.keyboard.press('Escape'); assert.equal((await st(page)).open, null);
  await page.click('#listBtn'); await page.click('#listClose'); assert.equal((await st(page)).open, null);
  await page.click('#listBtn'); await page.goBack(); await page.waitForFunction(() => window.__mana.state().open === null); assert.equal((await st(page)).itemId, 'kebab');
  /* "my table" */
  await page.click('#addBtn'); await page.click('#addBtn'); assert.equal(await text(page, '#trayCount'), '2'); assert.equal(await text(page, '#addCount'), '2'); assert.match(await page.getAttribute('#addBtn', 'aria-label'), /Add to my table · 2/);
  await page.click('#trayBtn'); assert.equal((await st(page)).open, 'tray'); assert.equal(await text(page, '#trayTotal'), '₪176'); assert.equal(await text(page, '.row[data-id="kebab"] .badge.mine'), 'On my table · 2');
  await page.click('#backdrop', { position: { x: 20, y: 20 } }); assert.equal((await st(page)).open, null);
  assert.deepEqual(errors, []); await ctx.close();
});

test('every kind of item has an honest look: a placeholder is a labelled projection, a photo a print, no picture a name card, sold out loses its colour', async () => {
  let o = await open(browser, demo(T + '&lang=en', '', 'kiosk')), page = o.page;
  await tableUp(page);
  let i = await info(page); const a0 = i.actors.find((a) => a.id === 'k-shakshuka');
  assert.deepEqual([a0.type, a0.holo, a0.ready], ['relief', true, true], 'a placeholder is drawn as a projection'); assert.ok(i.bloom, 'and it glows');
  assert.equal(await text(page, '#dIllus'), 'Illustration', 'the label is next to the name in the card'); assert.equal(await text(page, '.row[data-id="k-shakshuka"] .illus-tag'), 'Illustration', 'and on its row in the list');
  assert.ok(await page.evaluate(() => document.querySelector('.row[data-id="k-shakshuka"] img.thumb').classList.contains('holo')), 'its small picture is tinted too, never true colour');
  assert.match(await text(page, '#live'), /Shakshuka, ₪48, Illustration, 1 of 4/);
  await d(page, { type: 'open', what: 'dish' }); assert.equal(await text(page, '#dIllusLine'), 'Illustration · This picture is an illustration, not the dish itself.'); await d(page, { type: 'close' });
  await d(page, { type: 'focus', id: 'k-toast' }); await settle(page, 80); i = await info(page);
  assert.deepEqual([i.actors.find((a) => a.id === 'k-toast').type, i.actors.find((a) => a.id === 'k-toast').holo], ['text', false], 'no picture at all: a folded name card'); assert.equal(await text(page, '#dIllus'), null, 'which is not called an illustration'); assert.ok(i.memory.labels > 0);
  assert.equal(await page.evaluate(() => !!document.querySelector('.row[data-id="k-toast"] .illus-tag')), false);
  await d(page, { type: 'focus', id: 'k-pizza' }); await settle(page, 100); i = await info(page); const pz = i.actors.find((a) => a.id === 'k-pizza');
  assert.ok(pz.holo && pz.sat < .2, 'sold out: the dish loses its colour (' + pz.sat + ')'); assert.equal(await text(page, '#dSold'), 'Sold out'); assert.equal(await page.isDisabled('#addBtn'), true);
  await d(page, { type: 'setCategory', id: 'drinks' }); await settle(page, 120); i = await info(page);
  assert.equal(i.scene, 'bar'); assert.deepEqual(i.actors.map((a) => [a.id, a.type, a.holo]), [['k-orange', 'stand', true], ['k-lemonade', 'text', false], ['k-cappuccino', 'text', false]], 'an id the library does not know is no picture');
  await d(page, { type: 'setLang', lang: 'he' }); assert.equal(await text(page, '#dIllus'), 'להמחשה בלבד'); assert.equal(await text(page, '.row[data-id="k-orange"] .illus-tag'), 'להמחשה בלבד');
  assert.equal(await page.isVisible('#orderLink2'), false, 'no ordering link where the business has none');
  assert.deepEqual(o.errors, []); await o.ctx.close();
  o = await open(browser, demo(T + '&lang=en', '#c=oven&i=lasagne')); page = o.page; await tableUp(page);
  i = await info(page); assert.equal(i.actors.find((a) => a.id === 'lasagne').type, 'photo'); assert.equal(i.actors.find((a) => a.id === 'lasagne').holo, false); assert.equal(await text(page, '#dIllus'), null);
  await d(page, { type: 'focus', id: 'fish-soup' }); await settle(page, 100); i = await info(page); const soup = i.actors.find((a) => a.id === 'fish-soup');
  assert.ok(soup.type === 'relief' && !soup.holo && soup.sat < .2); assert.equal(await text(page, '#dSold'), 'Sold out'); assert.equal(i.actors.find((a) => a.id === 'bread').type, 'text');
  await d(page, { type: 'trayAdd', id: 'fish-soup' }); assert.deepEqual((await st(page)).tray, {});
  await d(page, { type: 'focus', id: 'wine-red' }); await settle(page, 120); assert.equal(await text(page, '#dIllus'), 'Illustration', 'a drawn bottle carries the same label'); assert.equal((await actor(page, 'wine-red')).holo, false);
  assert.deepEqual(o.errors, []); await o.ctx.close();
});

test('/m/<slug> and ?m=: open_menu and track_item with the right bodies, once per dish; the three answers; retry; deep links', async () => {
  const calls = () => srv.server.calls.slice(), mark = srv.server.calls.length;
  let o = await open(browser, srv.origin + '/m/olea?t=1' + T + '&lang=en#c=mains&i=kebab'), page = o.page;
  await tableUp(page);
  assert.equal(await page.evaluate(() => document.baseURI), srv.origin + '/mana/view/'); assert.equal(await text(page, '#dName'), 'Lamb kebab');     // under /m/ the base is halom.io's /mana/view/ assert.equal(await text(page, '#bizName'), 'Olea'); assert.equal(await page.title(), 'Olea');
  assert.deepEqual(calls().slice(mark), [{ fn: 'open_menu', args: { p_slug: 'olea', p_lang: 'en', p_src: 'qr' } }], 'one open_menu, from the printed code, in English');
  assert.equal(await page.isVisible('#home'), false); assert.equal(await text(page, '#demoNote'), null); assert.equal(await page.evaluate(() => document.getElementById('demoLine').textContent + document.getElementById('demoNote').textContent + document.getElementById('homeLbl').textContent), '', 'nothing says "demo" on a real menu');
  assert.equal(await page.getAttribute('.row[data-id="pappardelle"]', 'href'), '/m/olea?t=1' + T + '&lang=en#c=mains&i=pappardelle');
  const sent = async () => { await page.waitForTimeout(120); return calls().slice(mark + 1).map((c) => c.fn + ' ' + JSON.stringify(c.args)); };
  await d(page, { type: 'open', what: 'dish' }); assert.deepEqual(await sent(), ['track_item {"p_slug":"olea","p_item":"kebab","p_kind":"open"}']);
  await d(page, { type: 'close' }); await d(page, { type: 'open', what: 'dish' }); await d(page, { type: 'close' }); assert.equal((await sent()).length, 1, 'the same dish lifted again is not counted again');
  await page.click('#addBtn'); await page.click('#addBtn'); assert.deepEqual((await sent()).slice(1), ['track_item {"p_slug":"olea","p_item":"kebab","p_kind":"add"}'], 'added twice, counted once');
  await d(page, { type: 'step', dir: 1 }); await d(page, { type: 'open', what: 'dish' }); await d(page, { type: 'step', dir: -1 }); await d(page, { type: 'step', dir: -1 });
  assert.deepEqual((await sent()).slice(2), ['track_item {"p_slug":"olea","p_item":"burger","p_kind":"open"}', 'track_item {"p_slug":"olea","p_item":"shrimp","p_kind":"open"}'], 'walking on with the sheet open opens each new dish once');
  await page.evaluate(() => window.__mana.setLang('he')); assert.equal(new URL(page.url()).pathname, '/m/olea');
  assert.deepEqual(o.errors, []);
  /* the same phone comes back by a shared link: it remembers Hebrew, and the address has no t=1 */
  const p2 = await o.ctx.newPage(), m2 = srv.server.calls.length; await p2.goto(srv.origin + '/m/olea?gl=off'); await p2.evaluate(() => window.__mana.ready);
  assert.deepEqual(calls().slice(m2), [{ fn: 'open_menu', args: { p_slug: 'olea', p_lang: 'he', p_src: 'link' } }]); assert.equal(await p2.evaluate(() => window.__mana.state().lang), 'he'); await o.ctx.close();
  /* a link that opens straight on a lifted dish counts it */
  const m3 = srv.server.calls.length; o = await open(browser, srv.origin + '/m/olea?gl=off#c=sweet&i=malabi&o=1'); await o.page.evaluate(() => window.__mana.ready); await o.page.waitForTimeout(150);
  assert.deepEqual(calls().slice(m3).map((c) => c.fn + ':' + (c.args.p_item || c.args.p_src)), ['open_menu:link', 'track_item:malabi']); await o.ctx.close();
  /* placeholders under the short link: the library is found next to the viewer */
  o = await open(browser, srv.origin + '/m/kiosk?gl=off&lang=en'); await o.page.evaluate(() => window.__mana.ready);
  assert.ok(srv.server.requests.some((r) => r.path === '/mana/stock/stock.json')); assert.equal(await text(o.page, '.row[data-id="k-pizza"] .illus-tag'), 'Illustration'); assert.match(await o.page.getAttribute('.row[data-id="k-pizza"] img.thumb', 'src'), /\/mana\/stock\/img\/pizza_t\.jpg$/); await o.ctx.close();
  o = await open(browser, srv.origin + VIEW + '?m=olea&lang=en&gl=off'); await o.page.evaluate(() => window.__mana.ready); assert.equal(await text(o.page, '#list h3'), 'To start'); await o.ctx.close();
  o = await open(browser, srv.origin + '/m/paused'); page = o.page; await page.waitForSelector('#status[data-kind="unavailable"]');
  assert.match(await page.textContent('#statusTitle'), /התפריט לא זמין כרגע/); assert.match(await page.textContent('#statusBody'), /אוליאה/); assert.equal(await page.isVisible('#statusBtn'), false); await o.ctx.close();
  o = await open(browser, srv.origin + '/m/nowhere'); page = o.page; await page.waitForSelector('#status[data-kind="not_found"]'); assert.equal(await page.isVisible('#statusBtn'), false); await o.ctx.close();
  o = await open(browser, srv.origin + '/m/flaky?gl=off'); page = o.page; await page.waitForSelector('#status[data-kind="error"]'); assert.equal(await page.isVisible('#statusBtn'), true);
  await page.click('#statusBtn'); await page.evaluate(() => window.__mana.ready); await page.waitForFunction(() => document.getElementById('status').hidden); assert.equal(await text(page, '#bizName'), 'אוליאה'); await o.ctx.close();
  o = await open(browser, srv.origin + VIEW + '?gl=off'); page = o.page; await page.waitForSelector('#status[data-kind="not_found"]'); await o.ctx.close();        // no slug at all
});

test('demo and preview are never counted; the demo says so and leads back to the product page; the preview handshake is unchanged', async () => {
  const before0 = srv.server.calls.length;
  let o = await open(browser, demo(T + '&lang=en')), page = o.page;
  await page.evaluate(() => window.__mana.ready);
  /* before the table has its pictures: the small picture of the first dish stands where the dish will be */
  const stand = await page.evaluate(() => { const el = document.getElementById('standin'), r = el.getBoundingClientRect(); return { hidden: el.hidden, src: el.getAttribute('src'), cx: r.left + r.width / 2, cy: r.top + r.height / 2, w: r.width, name: document.getElementById('bizName').textContent, card: document.getElementById('dName').textContent }; });
  assert.equal(stand.hidden, false); assert.match(stand.src, /demo\/olea\/img\/labaneh_t\.jpg$/); assert.equal(stand.name, 'Olea'); assert.equal(stand.card, 'Labaneh & olives', 'the name and the first dish are there before the table');
  await tableUp(page); const f = (await info(page)).frame; assert.ok(Math.abs(stand.cx - f.cx) < 2 && Math.abs(stand.cy - f.cy) < 2 && Math.abs(stand.w - 2.3 * f.ppu) < 2, 'exactly where the dish is drawn');
  assert.equal(await page.evaluate(() => document.getElementById('standin').hidden), true, 'and it leaves when the dish is sharp');
  assert.equal(await text(page, '#demoNote'), 'Demo'); assert.equal(await page.getAttribute('#demoNote', 'title'), 'Demo menu · invented restaurant'); assert.equal(await text(page, '#homeLbl'), 'Mana');
  assert.equal(await page.evaluate(() => document.getElementById('home').href), srv.origin + '/projects/menus/'); assert.equal(await page.getAttribute('#home', 'aria-label'), 'Back to Mana');
  const credit = await page.evaluate(() => { const a = document.getElementById('credit'); return [a.textContent, a.href, a.target, a.rel]; }); assert.deepEqual(credit, ['Menu by mana', 'https://halom.io/mana/', '_blank', 'noopener']);
  await d(page, { type: 'open', what: 'dish' }); await page.click('#addBtn2'); await d(page, { type: 'close' }); await d(page, { type: 'setLang', lang: 'he' });
  assert.equal(await text(page, '#demoNote'), 'הדגמה'); assert.equal(await text(page, '#homeLbl'), 'מנה'); assert.equal(await page.evaluate(() => document.getElementById('credit').textContent), 'תפריט של מנה');
  /* walk a few dishes, then: the link leads to the product page, and the browser's Back from the menu leaves it in ONE press */
  for (let k = 0; k < 5; k++) await d(page, { type: 'step', dir: 1 }); await d(page, { type: 'stepCategory', dir: 1 });
  await page.click('#home'); await page.waitForSelector('#landing'); assert.equal(new URL(page.url()).pathname, '/projects/menus/');
  await page.goBack(); await page.waitForFunction(() => window.__mana && window.__mana.state()); await page.evaluate(() => window.__mana.ready); assert.equal((await st(page)).itemId, 'pappardelle', 'Back from the product page returns to the dish you left');
  await o.ctx.close();
  const p0 = await browser.newContext({ viewport: { width: 390, height: 700 } }), pg = await p0.newPage(); await pg.goto(srv.origin + '/projects/menus/'); await pg.goto(demo('&gl=off&lang=en')); await pg.evaluate(() => window.__mana.ready);
  await pg.evaluate(() => { for (let k = 0; k < 9; k++) window.__mana.dispatch({ type: 'step', dir: 1 }); window.__mana.dispatch({ type: 'setCategory', id: 'beer' }); }); await pg.goBack(); await pg.waitForSelector('#landing'); await p0.close();
  /* preview */
  const ctx = await browser.newContext({ viewport: { width: 900, height: 700 } }); page = await ctx.newPage();
  await page.goto(srv.origin + VIEW + 'fonts/OFL-frank-ruhl-libre.txt');                          // any same-origin page stands in for the studio
  const snap = await (await fetch(srv.origin + VIEW + 'demo/olea/menu.json')).json();
  snap.categories.forEach((c) => c.items.forEach((it) => { if (it.asset) ['color', 'aux', 'thumb'].forEach((k) => { if (it.asset[k]) it.asset[k] = srv.origin + VIEW + 'demo/olea/' + it.asset[k]; }); }));
  await page.evaluate(([url, snapshot]) => new Promise((res) => {
    window.snapshot = snapshot; window.got = [];
    window.addEventListener('message', (e) => { window.got.push(JSON.stringify(e.data)); if (e.data && e.data.type === 'halom-menu-preview-ready') { e.source.postMessage({ type: 'halom-menu-preview', snapshot: window.snapshot }, location.origin); res(); } });
    const fr = document.createElement('iframe'); fr.id = 'pv'; fr.src = url; fr.style.cssText = 'width:420px;height:640px'; document.body.appendChild(fr);
  }), [srv.origin + VIEW + '?preview=1' + T + '&lang=en', snap]);
  assert.deepEqual(await page.evaluate(() => window.got), ['{"type":"halom-menu-preview-ready"}'], 'the viewer announces itself with exactly this message, once');
  const frame = page.frame({ url: /preview=1/ }); await frame.waitForFunction(() => window.__mana && window.__mana.state()); await frame.evaluate(() => window.__mana.settle());
  assert.equal(await frame.textContent('#bizName'), 'Olea'); assert.equal(await frame.locator('#list .l-cat:first-child .row').count(), 9); assert.equal(await frame.isVisible('#home'), false); assert.equal((await frame.evaluate(() => window.__mana.info())).actors.filter((a) => a.ready).length, 4);
  await frame.evaluate(() => { window.__mana.dispatch({ type: 'focus', id: 'hummus' }); window.__mana.dispatch({ type: 'open', what: 'dish' }); document.getElementById('addBtn2').click(); });
  await page.evaluate(() => { const s = window.snapshot; s.revision = 2; s.business.name.en = 'Olea Draft'; s.theme.surface = 'marble'; s.categories[0].items[1].name.en = 'Hummus, edited'; s.categories[0].items[1].available = false; s.categories[0].items.splice(0, 1); document.getElementById('pv').contentWindow.postMessage({ type: 'halom-menu-preview', snapshot: s }, location.origin); });
  await frame.waitForFunction(() => document.getElementById('bizName').textContent === 'Olea Draft');
  assert.equal(await frame.textContent('#dName'), 'Hummus, edited', 'the dish in focus survives a live update'); assert.equal((await frame.evaluate(() => window.__mana.state())).itemId, 'hummus'); assert.equal((await frame.evaluate(() => window.__mana.state())).open, 'dish');
  assert.equal(await frame.isVisible('#dSold'), true, 'sold out arrives live'); assert.equal(await frame.locator('#list .l-cat:first-child .row').count(), 8);
  await frame.evaluate(() => window.__mana.dispatch({ type: 'close' })); await frame.evaluate(() => window.__mana.settle());
  const i2 = await frame.evaluate(() => window.__mana.info()), own = i2.actors.filter((a) => !a.guest); assert.deepEqual(own.map((a) => a.id), ['caesar', 'croquettes', 'bread', 'hummus', 'fish-soup'], 'sold out now, the hummus has gone to the end of its section, and the guest is still on it'); assert.ok(own.every((a) => a.ready && a.vis > .9 && !a.leaving)); assert.equal(i2.p, 6); assert.ok(own[3].sat < .2);
  await ctx.close();
  assert.equal(srv.server.calls.length, before0, 'no open_menu and no track_item from a demo or a preview, whatever the guest did');
});

test('Hebrew and English: direction, mirrored layout, the next section along the same table with its name in that language', async () => {
  const lie = {};
  for (const lang of ['he', 'en']) {
    const { page, errors, ctx } = await open(browser, demo(T + (lang === 'en' ? '&lang=en' : '')));
    await tableUp(page); const rtl = lang === 'he';
    assert.equal((await st(page)).lang, lang); assert.equal(await page.evaluate(() => document.documentElement.dir), rtl ? 'rtl' : 'ltr'); assert.equal(await page.evaluate(() => document.documentElement.lang), lang);
    assert.equal(await text(page, '#dName'), rtl ? 'לאבנה וזיתים' : 'Labaneh & olives'); assert.match(await text(page, '#dPrice'), rtl ? /^38\s?₪$|^₪\s?38$/ : /^₪38$/); assert.equal(await text(page, '.chip[aria-current="true"]'), rtl ? 'ראשונות' : 'To start');
    const geo = await page.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); return { w: innerWidth, name: r('bizName'), tray: r('trayBtn'), chip: document.querySelector('.chip').getBoundingClientRect(), price: r('dPrice'), title: r('dName'), add: r('addBtn') }; });
    if (rtl) assert.ok(geo.name.right > geo.w - 130 && geo.tray.left < 40 && geo.chip.right > geo.w - 30 && geo.price.left < geo.title.left && geo.add.left < 40, 'mirrored');
    else assert.ok(geo.name.left < 130 && geo.tray.right > geo.w - 40 && geo.chip.left < 30 && geo.price.left > geo.title.left && geo.add.right > geo.w - 40);
    const lane0 = (await info(page)).lane.x; lie[lang] = (await info(page)).actors.map((a) => +(a.x - lane0).toFixed(2)); assert.ok(lie[lang].every((x) => Math.abs(x) <= .05), lang + ': one straight row down the middle of the table: ' + lie[lang]);
    await drag(page, [195, 400], [195 + (rtl ? 120 : -120), 404], { steps: 6, ms: 16 });       // Hebrew: finger right = next
    assert.equal((await st(page)).categoryId, 'mains', lang + ': the swipe towards the start of the line brings the next category'); const lane1 = (await info(page)).lane.x;
    assert.ok(Math.abs(lane1 - lane0) < .01, lang + ': the next section is further along the same table'); assert.deepEqual((await info(page)).titles.map((t) => t.text), [rtl ? 'עיקריות' : 'Mains'], lang + ': its name is lettered on the table');
    await page.keyboard.press(rtl ? 'ArrowRight' : 'ArrowLeft'); assert.equal((await st(page)).categoryId, 'starters'); await page.keyboard.press(rtl ? 'ArrowLeft' : 'ArrowRight'); assert.equal((await st(page)).categoryId, 'mains');
    await page.keyboard.press('ArrowDown'); assert.equal((await st(page)).itemId, 'tortellini', 'down is always the next dish');
    assert.deepEqual(errors, []); await ctx.close();
  }
  assert.deepEqual(lie.he, lie.en.map((x) => (x === 0 ? 0 : -x)), 'what little a hand missed the line by is mirrored too');
});

test('keys: arrows, Page Up/Down, Home/End glide; Enter lifts; Tab reaches every control with a visible focus', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + '&lang=en'));
  await tableUp(page);
  await page.keyboard.press('ArrowDown'); assert.equal((await st(page)).itemId, 'hummus'); let i = await info(page); assert.equal(i.mode, 'settle'); assert.ok(i.p < .2, 'the state changes at once, the table travels there');
  await tick(page, 5, .03); i = await info(page); assert.ok(i.p > .2 && i.p < 1); await settle(page, 60); assert.equal((await info(page)).p, 1);
  await page.keyboard.press('PageDown'); assert.equal((await st(page)).itemId, 'filo'); await page.keyboard.press('PageUp'); assert.equal((await st(page)).itemId, 'hummus'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowUp'); assert.equal((await st(page)).itemId, 'labaneh'); assert.equal((await st(page)).nav.kind, 'edge');
  await page.keyboard.press('End'); assert.equal((await st(page)).itemId, 'fish-soup'); await page.keyboard.press('ArrowDown'); assert.equal((await st(page)).itemId, 'pappardelle', 'the walk goes on into the next category'); await page.keyboard.press('ArrowUp'); assert.equal((await st(page)).itemId, 'fish-soup'); await settle(page, 60);
  /* a mouse wheel: a notch is one dish in one glide; past the last dish it walks on; a trackpad's stream is followed exactly */
  await page.evaluate(() => window.__mana.wheel(120)); assert.equal((await st(page)).itemId, 'pappardelle', 'a wheel notch past the last dish also walks on'); await settle(page, 60); await tick(page, 14, .03);
  await page.evaluate(() => window.__mana.wheel(100)); i = await info(page); assert.equal(i.mode, 'settle'); assert.equal(i.p, 0, 'the table does not jump'); await tick(page, 4, .03); i = await info(page); assert.ok(i.p > .15 && i.p < .9, 'it glides: ' + i.p); await settle(page, 60); assert.equal((await st(page)).itemId, 'tortellini');
  await page.evaluate(() => { for (let k = 0; k < 8; k++) { window.__mana.wheel(15); window.__mana.tick(1, .016, false); } }); i = await info(page); assert.equal(i.mode, 'wheel'); assert.ok(Math.abs(i.p - (1 + 120 / i.frame.pxPerDish)) < .01, 'a trackpad moves the table by exactly what the fingers scrolled: ' + i.p); await tick(page, 6, .03); await settle(page, 60); assert.equal((await st(page)).itemId, 'gnocchi');
  await page.evaluate(() => { window.__mana.dispatch({ type: 'focus', id: 'labaneh' }); document.activeElement && document.activeElement.blur(); });
  const order = []; for (let k = 0; k < 14; k++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const a = document.activeElement; return a.id || a.dataset.id || a.className; })); }
  assert.deepEqual(order, ['skip', 'home', 'langBtn', 'listBtn', 'trayBtn', 'starters', 'mains', 'oven', 'sweet', 'wine', 'beer', 'cold', 'addBtn', 'openBtn'], 'top bar, categories, then the card; the closed list is skipped');
  assert.ok(await page.evaluate(() => { const a = document.activeElement, s = getComputedStyle(a); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; }), 'visible focus');
  await page.keyboard.press('Enter'); assert.equal((await st(page)).open, 'dish'); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'closeBtn'); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'addBtn2');
  await page.keyboard.press('Escape'); assert.equal((await st(page)).open, null); assert.equal(await page.evaluate(() => document.activeElement.id), 'openBtn', 'focus returns to the card');
  await page.focus('#skip'); await page.keyboard.press('Enter'); assert.equal((await st(page)).open, 'list'); assert.equal(await page.evaluate(() => document.activeElement.dataset.id), 'labaneh', '"skip to the menu list" lands on the row of the dish in focus');
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); assert.equal((await st(page)).itemId, 'hummus'); assert.equal((await st(page)).open, null);
  assert.deepEqual(errors, []); await ctx.close();
});

test('a set table: the row is straight and the camera does not sway on the way; the dish the table settles on comes up, and goes down as it moves on', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + '&lang=en', '#c=starters&i=chopped-salad'));
  await tableUp(page); await tick(page, 30, .03);
  let i = await info(page); const f = i.frame, x0 = i.cam.line, hero = () => actor(page, 'chopped-salad');
  assert.ok(i.actors.every((a) => Math.abs(a.x - i.lane.x) <= .05), 'every dish on the line'); assert.ok((await hero()).near > .98, 'at rest the dish in focus has come up: ' + (await hero()).near); assert.ok(i.actors.filter((a) => a.id !== 'chopped-salad').every((a) => a.near === 0));
  const zs = i.actors.map((a) => a.z); for (let k = 1; k < zs.length; k++) assert.ok(Math.abs(zs[k] - zs[k - 1] - f.S) < .1, 'plates stand a plate and a rim apart: ' + (zs[k] - zs[k - 1]).toFixed(2));
  assert.ok((await hero()).light > .99 && i.actors.filter((a) => Math.abs(a.i - 2) === 1).every((a) => a.light > .35 && a.light < .7), 'the lamp is on the dish in focus; its neighbours wait in half light: ' + i.actors.map((a) => a.light));
  /* a slow drag: it sets down as it leaves the line, the next one comes up as it arrives; the camera keeps to the middle of the table */
  const xs = [], lifts = []; await page.evaluate(([x, y]) => window.__mana.pointer('down', x, y), [f.cx, 520]);
  for (let k = 1; k <= 14; k++) { await page.evaluate(([x, y]) => { window.__mana.pointer('move', x, y); window.__mana.tick(1, .03, false); }, [f.cx, 520 - k * 20]); i = await info(page); xs.push(i.cam.line); lifts.push([i.p, (await hero()).near, (await actor(page, 'artichoke')).near]); }
  assert.ok(Math.max(...xs.map((x) => Math.abs(x - x0))) < 1e-6 && Math.abs(x0 - i.lane.x) < 1e-6, 'the line the camera follows is the middle of the table, all the way: ' + xs.map((x) => (x - x0).toFixed(3)));
  const half = lifts.find((l) => l[0] > 2.45 && l[0] < 2.75); assert.ok(half && half[1] < .45 && half[2] < .35 && lifts.every((l, k) => !k || l[1] <= lifts[k - 1][1] + 1e-9), 'half way between two dishes the one we leave is nearly down, the next is not up yet: ' + JSON.stringify(half));
  await page.evaluate(([x, y]) => { window.__mana.tick(10, .03, false); window.__mana.pointer('up', x, y); }, [f.cx, 240]); await settle(page, 80); await tick(page, 30, .03);
  i = await info(page); assert.equal(i.p, 3); assert.ok((await actor(page, 'artichoke')).near > .98 && (await hero()).near === 0, 'the next dish is up now, the last one is back on the table');
  /* a hard flick: nothing comes up while the table flies; the dish it lands on does */
  await drag(page, [f.cx, 560], [f.cx, 560 - 300], { steps: 5, ms: 14 }); await tick(page, 3, .03); i = await info(page); assert.equal(i.mode, 'settle'); assert.ok(i.actors.every((a) => a.near < .3), 'in flight: ' + i.actors.map((a) => a.near));
  await settle(page, 90); await tick(page, 30, .03); i = await info(page); const landed = i.actors.find((a) => a.i === i.p); assert.ok(i.p >= 6 && landed.near > .98 && i.actors.filter((a) => a !== landed).every((a) => a.near === 0));
  assert.ok(i.cam.zoom > .999, 'and the camera has come back in: ' + i.cam.zoom);
  assert.deepEqual(errors, []); await ctx.close();
});

test('one long table laid in courses: near the end of a section the next one is already there, its name lettered in the gap; walking on, nothing is laid again', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + '&lang=en', '#c=starters&i=caesar'));
  await tableUp(page); let i = await info(page); const f = i.frame, x = f.cx, own = (j) => j.actors.filter((a) => !a.guest && !a.leaving), beside = (j) => j.actors.filter((a) => a.guest && !a.leaving);
  assert.deepEqual(beside(i).map((a) => a.id), [], 'in the middle of a section only its own dishes'); assert.deepEqual(i.titles, []); assert.equal(i.actors.length, 7);
  await d(page, { type: 'focus', id: 'bread' }); await settle(page, 80); i = await info(page);
  assert.deepEqual(beside(i).map((a) => [a.id, a.cat]), [['pappardelle', 'mains'], ['tortellini', 'mains']], 'two places from the end: the first two mains are on the table'); assert.equal(i.actors.filter((a) => !a.leaving).length, 7, 'never more dishes than in the middle of a section'); assert.deepEqual(i.titles.map((t) => t.text), ['Mains']);
  const bread = i.actors.find((a) => a.id === 'fish-soup'), first = i.actors.find((a) => a.id === 'pappardelle'), gap = first.z - bread.z, title = i.titles[0].z;
  assert.ok(gap > f.S * 1.3 && gap < f.S * 1.8, 'a course begins a wider gap further on: ' + gap); assert.ok(title > bread.z + .5 && title < first.z - .5, 'and its name is lettered in that gap');
  const far = i.actors.find((a) => a.id === 'tortellini'); assert.ok(Math.abs(far.z - first.z - f.S) < .1, 'set like any other row');
  /* walk on with the finger: the same plates, the same places; the camera only goes on */
  await d(page, { type: 'focus', id: 'fish-soup' }); await settle(page, 80); const z0 = (await info(page)).cam.pos[2];
  await drag(page, [x, 520], [x, 520 - 70], { steps: 4, ms: 16 }); let s = await st(page); assert.equal(s.categoryId, 'mains'); assert.equal(s.itemId, 'pappardelle'); i = await info(page);
  const now = i.actors.find((a) => a.id === 'pappardelle'); assert.ok(!now.guest && !now.leaving && Math.abs(now.z - first.z) < 1e-6 && now.vis > .99, 'the first main is the plate that was standing there: it did not blink'); assert.ok(Math.abs(i.cam.pos[2] - z0) < 1.2, 'the camera did not jump: ' + (i.cam.pos[2] - z0)); assert.ok(Math.abs(i.walkOn) > 2.5 && Math.abs(i.walkOn) < 4.6);
  await settle(page, 120); i = await info(page); assert.equal(i.walkOn, 0); assert.equal(i.p, 0);
  assert.deepEqual(beside(i).map((a) => a.id).sort(), ['bread', 'croquettes', 'fish-soup'], 'what was left behind is the course before now: the same three plates'); assert.ok(Math.abs(i.actors.find((a) => a.id === 'fish-soup').z - bread.z) < 1e-6); assert.deepEqual(i.titles.map((t) => t.text), ['Mains']);
  /* and back: the last starter again, where it stood */
  await drag(page, [x, 300], [x, 300 + 70], { steps: 4, ms: 16 }); s = await st(page); assert.equal(s.itemId, 'fish-soup'); await settle(page, 120); i = await info(page); assert.ok(Math.abs(i.actors.find((a) => a.id === 'fish-soup').z - bread.z) < 1e-6 && i.walkOn === 0 && i.p === 8);
  /* a tap on a dish of the next course walks on to it */
  const hot = i.hot.find((h) => h.id === 'pappardelle'); assert.ok(hot, 'the first main can be seen and tapped from the last starter');
  /* the bar is another room: nothing of it stands on the food table, and the drinks do go on along their own counter */
  await d(page, { type: 'focus', id: 'chocolate' }); await settle(page, 160); i = await info(page); assert.deepEqual(beside(i).map((a) => a.cat), [], 'after the last dessert the table is bare: the bar is elsewhere');
  await d(page, { type: 'focus', id: 'wine-sparkling' }); await page.waitForFunction(() => window.__mana.pending() === 0, null, { timeout: 30000 }); await settle(page, 200); i = await info(page);
  assert.deepEqual(beside(i).map((a) => a.cat), ['beer', 'beer', 'beer'], 'the beers stand further along the same counter'); assert.deepEqual(i.titles.map((t) => t.text), ['Beer']); assert.equal(own(i).length, 4);
  assert.deepEqual(errors, []); await ctx.close();
});

test('a hard flick past several dishes: their names go by dimmed, the card does not flash for each; the one it lands on fades in', async () => {
  const o = await open(browser, demo('&capture=1&pr=0.3&lang=en', '#c=starters&i=labaneh')), page = o.page; await page.evaluate(() => window.__mana.settle());
  const out = await page.evaluate(async () => { const M = window.__mana, el = document.getElementById('cardSwap'), tr = [], snap = () => { const g = M.glide(); tr.push([+g.p.toFixed(2), g.mode, g.target, el.style.opacity || '1', document.getElementById('dName').textContent]); };
    await M.frame(0); M.pointer('down', 195, 640); for (let k = 1; k <= 3; k++) { M.pointer('move', 195, 640 - k * k * 44); await M.frame(33.33); } await M.frame(16); M.pointer('up', 195, 244);
    for (let k = 0; k < 36; k++) { await M.frame(33.33); snap(); } return tr; });
  const end = out[out.length - 1], flight = out.filter((l) => l[1] === 'settle' && Math.abs(l[2] - l[0]) > .5 && l[4] !== 'Labaneh & olives');      // from the first dish gone by until the one it lands on is nearest
  assert.ok(end[2] >= 3, 'a hard flick: ' + end[2] + ' dishes'); assert.ok(flight.length >= 3, 'frames in flight: ' + flight.length);
  assert.ok(flight.slice(2).every((l) => +l[3] <= .35) && flight.every((l) => +l[3] < .9), 'in flight the card stays dim, also just before the last dish: ' + flight.map((l) => l[3])); assert.ok(new Set(flight.map((l) => l[4])).size >= 2, 'and still says which dish is passing');
  assert.equal(end[1], 'rest'); assert.equal(end[3], '1'); assert.equal(end[4], (await page.evaluate(() => window.__mana.model().cats[0].items.map((it) => it.name.en)))[end[2]], 'the card shows the dish it landed on');
  assert.deepEqual(o.errors, []); await o.ctx.close();
});

test('from the table to the bar and back: one move across the dark between two rooms; it can be turned round half way; Back and Hebrew go the same way', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + '&lang=en', '#c=sweet&i=chocolate'));
  await tableUp(page); let i = await info(page); assert.equal(i.scene, 'table'); assert.deepEqual(i.rooms, { table: 1, bar: 0 }); assert.equal(i.edge, null); assert.equal(i.bloom && i.drinks.drinks, 0);
  const loaded = () => page.waitForFunction(() => window.__mana.pending() === 0, null, { timeout: 30000 }), camZ = async () => (await info(page)).cam.pos[2];
  await page.click('.chip[data-id="wine"]'); i = await info(page); const far = i.walkOn, line = i.edge;
  assert.equal(i.scene, 'bar'); assert.ok(line && line.to === 'bar', 'a line across the walk: the table on this side of it, the bar beyond'); assert.ok(Math.abs(far) > 4 && Math.abs(far) < 9, 'the first drink stands ' + far + ' along'); assert.equal(i.lampK, 1);
  assert.ok(i.actors.some((a) => a.id === 'chocolate' && a.leaving && a.left), 'the dessert stays on the table behind us'); assert.equal(i.actors.filter((a) => a.type === 'drink').length, 4, 'the drinks already stand on the counter ahead');
  /* on the way: both rooms are in the picture, the table going down and the bar coming up; the eye comes down; the camera only goes forward */
  await loaded(); const way = []; let z = await camZ();
  for (let k = 0; k < 8; k++) { await tick(page, 2, .03, true); i = await info(page); way.push([i.walkOn, i.rooms.table, i.rooms.bar, i.cam.E]); const z1 = i.cam.pos[2]; assert.ok((z1 - z) * Math.sign(-far) >= -1e-6, 'never backwards: ' + z + ' → ' + z1); z = z1; }
  assert.ok(way.some((w) => w[1] > .15 && w[2] > .15), 'for a moment both are lit: ' + JSON.stringify(way)); assert.ok(way.every((w, k) => !k || (Math.abs(w[0]) < Math.abs(way[k - 1][0]) && w[1] <= way[k - 1][1] && w[2] >= way[k - 1][2] && w[3] <= way[k - 1][3] + 1e-9)), 'one move, nothing goes back and forth');
  assert.ok(way[2][3] < 45 && way[2][3] > 31.5, 'the eye is on its way down: ' + way[2][3]); assert.ok((await info(page)).bloom, 'the bar glows');
  await settle(page, 160); i = await info(page); assert.deepEqual(i.rooms, { table: 0, bar: 1 }); assert.equal(i.edge, null, 'the line has gone: the counter runs on to the back-bar'); assert.equal(i.walkOn, 0); assert.ok(Math.abs(i.cam.E - 31) < .05); assert.deepEqual(i.actors.map((a) => a.type), ['drink', 'drink', 'drink', 'drink'], 'nothing of the table is left');
  /* back, and turned round half way */
  await page.click('.chip[data-id="sweet"]'); i = await info(page); assert.equal(i.scene, 'table'); assert.ok(i.edge && i.edge.to === 'table'); assert.ok(Math.sign(i.walkOn) === -Math.sign(far), 'the other way: ' + i.walkOn); const back = i.edge.at;
  await loaded(); await tick(page, 3, .03, true); i = await info(page); assert.ok(i.rooms.table > .1 && i.rooms.bar > .1 && Math.abs(i.walkOn) > .5 && i.edge.away === 0, 'on the way, not yet over the line: ' + JSON.stringify(i.rooms) + ' ' + i.walkOn);
  await page.click('.chip[data-id="wine"]'); i = await info(page); assert.equal(i.scene, 'bar'); assert.ok(i.edge.to === 'bar' && Math.abs(i.edge.at - back) < 1e-6, 'turned round: the same line, crossed the other way (' + back + ' → ' + i.edge.at + ')'); assert.ok(Math.abs(i.walkOn) < Math.abs(far), 'and not as far to go: ' + i.walkOn);
  /* turned round once more, this time after the line was crossed and had begun to draw away: it turns round where it is */
  await settle(page, 160); await page.click('.chip[data-id="sweet"]'); await loaded(); let over = null; for (let k = 0; k < 30 && !(over && over.away > 0); k++) { await tick(page, 1, .03, true); over = (await info(page)).edge; }
  assert.ok(over && over.away > 0 && over.to === 'table', 'over the line: it draws away behind us'); await page.click('.chip[data-id="wine"]'); i = await info(page); assert.ok(i.edge.to === 'bar' && i.edge.away === 0 && Math.abs(i.edge.z - over.z) < .01, 'the line does not jump: ' + over.z + ' → ' + i.edge.z);
  await tick(page, 2, .03, true); await page.click('.chip[data-id="sweet"]'); await tick(page, 2, .03, true); await page.click('.chip[data-id="beer"]'); await tick(page, 2, .03, true); await page.click('.chip[data-id="mains"]');      // and again, faster than anyone would
  await loaded(); await settle(page, 200); await loaded(); await settle(page, 60); i = await info(page); assert.equal(i.scene, 'table'); assert.deepEqual(i.rooms, { table: 1, bar: 0 }); assert.equal(i.edge, null); assert.equal(i.drinks.drinks, 0); assert.ok(i.heroReady && i.actors.every((a) => !a.leaving || a.left)); assert.equal((await st(page)).itemId, 'pappardelle');
  /* the Back button: an address further back in the history is another dish; if that dish is in the other room, the same move */
  await page.evaluate(() => { location.hash = '#c=beer&i=beer-ipa'; }); await page.waitForFunction(() => window.__mana.state().itemId === 'beer-ipa'); i = await info(page); assert.ok(i.edge && i.edge.to === 'bar'); await loaded(); await settle(page, 160);
  await page.goBack(); await page.waitForFunction(() => window.__mana.state().itemId === 'pappardelle'); i = await info(page); assert.equal(i.scene, 'table'); assert.ok(i.edge && i.edge.to === 'table' && Math.abs(i.walkOn) > 3, 'Back walks back to the table'); await loaded(); await settle(page, 200); assert.deepEqual((await info(page)).rooms, { table: 1, bar: 0 });
  assert.deepEqual(errors, []); await ctx.close();
  /* Hebrew: the finger goes the other way, the walk is the same walk */
  const he = await open(browser, demo(T, '#c=sweet&i=chocolate')); await tableUp(he.page); assert.equal((await st(he.page)).lang, 'he');
  await drag(he.page, [110, 400], [110 + 130, 404], { steps: 6, ms: 16 }); assert.equal((await st(he.page)).categoryId, 'wine'); i = await info(he.page); assert.ok(i.edge && i.edge.to === 'bar' && Math.sign(i.walkOn) === Math.sign(far) && Math.abs(i.walkOn - far) < .5, 'the same road in Hebrew: ' + i.walkOn + ' / ' + far);
  await he.page.waitForFunction(() => window.__mana.pending() === 0, null, { timeout: 30000 }); await settle(he.page, 160); assert.deepEqual((await info(he.page)).rooms, { table: 0, bar: 1 });
  await drag(he.page, [260, 400], [260 - 130, 404], { steps: 6, ms: 16 }); assert.equal((await st(he.page)).categoryId, 'sweet'); assert.equal((await info(he.page)).edge.to, 'table'); assert.deepEqual(he.errors, []); await he.ctx.close();
});

test('reduced motion: no sway, no travel, no overshoot; things cross-fade in place', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + PULL + '&lang=en'), { reducedMotion: 'reduce' });
  await tableUp(page); let i = await info(page); const cam0 = i.cam.pos;
  await tick(page, 30, .1, true); i = await info(page); assert.equal(i.moving, false, 'at rest nothing moves'); assert.ok(Math.hypot(i.cam.pos[0] - cam0[0], i.cam.pos[1] - cam0[1], i.cam.pos[2] - cam0[2]) < 1e-9, 'the camera does not sway');
  await page.keyboard.press('ArrowDown'); i = await info(page); assert.equal(i.p, 1, 'the next dish: at once, no glide'); assert.equal(i.mode, 'rest');
  await page.click('.chip[data-id="sweet"]'); await tick(page, 1, .016); i = await info(page); assert.equal(i.lampK, 1, 'no lamp going down and up'); assert.ok(Math.abs(i.cam.pos[0] - i.lane.x) < .5, 'the camera is already over the new table');
  assert.ok(i.actors.some((a) => a.leaving && a.vis > .2) || i.actors.every((a) => !a.leaving), 'the old dishes fade where they stand');
  await settle(page, 60); await d(page, { type: 'open', what: 'dish' }); await tick(page, 1, .016, true); i = await info(page); assert.equal(i.lift, 1, 'lifted at once'); assert.equal(await page.isVisible('#pourBtn'), false);
  await page.evaluate(() => { window.__mana.turn(40, true); window.__mana.turn(0, false, 900); window.__mana.tick(3, .03, false); }); assert.equal((await actor(page, 'cheesecake')).yaw, .34, 'it turns with the finger and stays put: no inertia, no spring');
  await d(page, { type: 'close' }); await tick(page, 2, .016); assert.equal((await info(page)).lift, 0);
  const f = i.frame; await drag(page, [f.cx, 300], [f.cx, 300 + 70], { steps: 4, ms: 16 }); await settle(page, 60); assert.equal((await info(page)).p, 1, 'a finger still glides: the table follows the hand');
  assert.equal(await page.isVisible('#hint'), false); assert.deepEqual(errors, []); await ctx.close();
  /* to the bar: no travel either. The picture as it was fades over the bar, already in place (the fade runs on the page's one clock) */
  const o = await open(browser, demo('&capture=1&pr=0.3&lang=en', '#c=sweet&i=chocolate'), { reducedMotion: 'reduce' }); await o.page.evaluate(() => window.__mana.settle());
  const cut = () => o.page.evaluate(() => { const el = document.getElementById('cut'); return { hidden: el.hidden, opacity: el.hidden ? null : +el.style.opacity, w: el.width }; });
  assert.equal((await cut()).hidden, true); await o.page.click('.chip[data-id="wine"]');
  let c = await cut(); i = await info(o.page); assert.deepEqual([c.hidden, c.opacity], [false, 1], 'the last picture of the table lies over the scene'); assert.ok(c.w > 50); assert.equal(i.scene, 'bar'); assert.equal(i.edge, null); assert.equal(i.walkOn, 0, 'nothing travels');
  await o.page.evaluate(() => window.__mana.frame(120)); c = await cut(); assert.ok(c.opacity > .2 && c.opacity < .8, 'and fades: ' + c.opacity); i = await info(o.page); assert.deepEqual(i.rooms, { table: 0, bar: 1 }, 'the bar under it is simply there');
  await o.page.evaluate(async () => { await window.__mana.frame(120); await window.__mana.frame(120); }); assert.equal((await cut()).hidden, true); assert.deepEqual(o.errors, []); await o.ctx.close();
});

test('no WebGL, a lost context and a phone that cannot keep up all end in the list; the last two recover', async () => {
  let o = await open(browser, demo('&gl=off&lang=en')), page = o.page; await page.evaluate(() => window.__mana.ready);
  assert.equal((await st(page)).simple, true); assert.equal(await text(page, '#noticeTxt'), 'The table could not be shown on this device, so the menu is a list.'); assert.equal(await page.isVisible('#noticeBtn'), false, 'nothing to retry without WebGL'); assert.equal(await page.isVisible('.row[data-id="labaneh"]'), true); await o.ctx.close();
  o = await open(browser, demo('&test=1&pr=0.3&lang=en'), { width: 390, height: 600 }); page = o.page; await tableUp(page);
  await page.evaluate(() => { const c = document.getElementById('gl'); window.__ext = (c.getContext('webgl2') || c.getContext('webgl')).getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
  await page.waitForFunction(() => window.__mana.state().simple === true); assert.equal(await page.isVisible('#notice'), true); assert.equal(await page.isVisible('.row[data-id="hummus"]'), true); assert.equal(await page.isVisible('#scene'), false);
  await page.click('.row[data-id="hummus"]'); assert.equal((await st(page)).open, 'dish'); assert.equal(await text(page, '#dName'), 'Warm hummus'); await page.keyboard.press('Escape');
  await page.evaluate(() => window.__ext.restoreContext());
  await page.waitForFunction(() => window.__mana.state().simple === false, null, { timeout: 15000 }); assert.equal(await page.isVisible('#notice'), false);
  await tableUp(page); let i = await info(page); assert.equal(i.lost, false); assert.ok(i.actors.filter((a) => a.ready).length >= 4, 'the table is back'); assert.equal((await st(page)).itemId, 'hummus', 'at the dish the guest had chosen in the list');
  for (let k = 0; k < 400 && !(await st(page)).simple; k++) await page.evaluate(() => { for (let n = 0; n < 10; n++) window.__mana.frameTime(180); });     // 180 ms frames
  assert.equal((await st(page)).simple, true, 'terrible frame time → list'); assert.equal(await page.isVisible('#noticeBtn'), true); assert.equal((await info(page)).textures, 0, 'the list lets go of the GPU pictures');
  await page.click('#noticeBtn'); assert.equal((await st(page)).simple, false); await tableUp(page); i = await info(page); assert.equal(i.tier, 0); assert.ok(i.heroReady);
  assert.deepEqual(o.errors.filter((e) => !/context|CONTEXT_LOST|WebGL/i.test(e)), []); await o.ctx.close();
});

test('one clock: the same script gives the same frames; alive at rest, asleep after a while and when hidden', async () => {
  const runOnce = async () => { const o = await open(browser, demo('&capture=1&pr=0.3&lang=en')); await o.page.evaluate(() => window.__mana.settle());
    const out = await o.page.evaluate(async () => { const M = window.__mana, tr = []; const snap = () => { const i = M.info(); return [i.p, i.lift, i.lampK, i.cam.pos.map((v) => +v.toFixed(5)).join(','), M.state().itemId, document.getElementById('cardSwap').style.opacity || '1', document.getElementById('card').style.transform].join('|'); };
      await M.frame(0); M.pointer('down', 195, 320); for (let k = 1; k <= 6; k++) { M.pointer('move', 195, 320 + k * 30); await M.frame(33.33); tr.push(snap()); } M.pointer('up', 195, 500);
      for (let k = 0; k < 14; k++) { await M.frame(33.33); tr.push(snap()); } M.lift(true); for (let k = 0; k < 8; k++) { await M.frame(33.33); tr.push(snap()); } M.goTo('pappardelle'); for (let k = 0; k < 8; k++) { await M.frame(33.33); tr.push(snap()); }
      return { tr, pending: M.pending(), capture: document.getElementById('app').classList.contains('capture'), hint: document.getElementById('hint').hidden }; });
    await o.ctx.close(); return out; };
  const a = await runOnce(), b = await runOnce();
  assert.deepEqual(a.tr, b.tr, 'two runs of the same script are identical, frame for frame'); assert.equal(a.pending, 0, 'a frame resolves only when its pictures are in'); assert.ok(a.capture && a.hint, 'filming mode: no hint unless asked');
  assert.ok(a.tr.some((l) => l.split('|')[5] !== '1'), 'the card\'s cross-fade runs on the same clock'); assert.ok(new Set(a.tr.map((l) => l.split('|')[6])).size > 5, 'and so does the sheet');
  /* at rest the dish sways a few degrees; after 45 s without a touch it comes to rest and nothing is drawn */
  let o = await open(browser, demo(T + '&lang=en')), page = o.page; await tableUp(page);
  const xs = []; for (let k = 0; k < 13; k++) { await tick(page, 1, 1); const i = await info(page); xs.push(i.cam.pos[0]); assert.equal(i.moving, 'slow'); }
  const span = (Math.max(...xs) - Math.min(...xs)) / (9.6 * Math.cos(Math.PI / 4)) * 180 / Math.PI; assert.ok(span > 3 && span < 9, 'the camera sways ' + span.toFixed(1) + '° around the dish, slowly');
  await tick(page, 60, 1); let i = await info(page); assert.equal(i.moving, false, 'after a while it rests'); const f0 = i.frames; await tick(page, 1, 0, true);
  await page.evaluate(() => { window.__mana.pointer('down', 195, 300); window.__mana.pointer('move', 195, 320); window.__mana.pointer('up', 195, 320); }); await tick(page, 30, .1); assert.equal((await info(page)).moving, 'slow', 'a touch wakes it'); assert.ok(f0 > 0);
  await o.ctx.close();
  o = await open(browser, demo('&adapt=off&pr=0.25&lang=en&hint=0'), { width: 320, height: 480 }); page = o.page; await page.evaluate(() => window.__mana.tableReady);
  await page.waitForFunction(() => { const s = window.__mana.info(); return s && s.heroReady && s.frames > 3; }, null, { timeout: 120000 });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(700); const f1 = (await info(page)).frames; await page.waitForTimeout(700); assert.equal((await info(page)).frames, f1, 'hidden tab: nothing is drawn');
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForFunction((n) => window.__mana.info().frames > n, f1, { timeout: 60000 }); await o.ctx.close();
});

test('a real finger (touch through the browser): swipe up for the next dish, sideways for the next section, tap to lift, and the page never scrolls', async () => {
  const { page, errors, ctx } = await open(browser, demo('&adapt=off&pr=0.25&lang=en'), { width: 320, height: 560, touch: true });
  await page.evaluate(() => window.__mana.tableReady); await page.waitForFunction(() => { const s = window.__mana.info(); return s && s.heroReady; }, null, { timeout: 120000 });
  await page.waitForFunction(() => !document.getElementById('hint').hidden, null, { timeout: 20000 }); assert.equal(await page.getAttribute('#hint', 'data-dir'), 'up', 'first visit: the hand shows the swipe up');
  const rest = (id) => page.waitForFunction((want) => { const M = window.__mana; return M.state().itemId === want && M.info().mode === 'rest'; }, id, { timeout: 60000 });
  await swipe(page, [160, 330], [160, 200], { steps: 6, hold: 12 }); await rest('hummus');
  await page.waitForFunction(() => document.getElementById('hint').hidden, null, { timeout: 10000 }); assert.equal(await page.evaluate(() => localStorage.getItem('mana-hint')), '1', 'the hint has gone with the first drag, for good');
  await swipe(page, [160, 200], [160, 330], { steps: 6, hold: 12 }); await rest('labaneh');
  await swipe(page, [260, 280], [70, 286], { steps: 6, hold: 12 }); await rest('pappardelle'); assert.equal((await st(page)).categoryId, 'mains');
  await swipe(page, [70, 280], [260, 286], { steps: 6, hold: 12 }); await rest('labaneh');
  const scroll = await page.evaluate(() => [scrollY, document.scrollingElement.scrollTop, document.body.scrollHeight - innerHeight, getComputedStyle(document.getElementById('gl')).touchAction, getComputedStyle(document.body).overscrollBehaviorY]);
  assert.deepEqual(scroll, [0, 0, 0, 'none', 'none'], 'the page itself never moves: no pull-to-refresh, no swipe-back');
  await page.waitForFunction(() => { const i = window.__mana.info(); return i.mode === 'rest' && i.moving !== true && i.lampK === 1; }, null, { timeout: 90000 });      // the camera has arrived over the table (software GL takes its time)
  const f = (await info(page)).frame; await page.touchscreen.tap(f.cx, f.cy); await page.waitForFunction(() => window.__mana.state().open === 'dish', null, { timeout: 20000 });
  await page.waitForFunction(() => window.__mana.info().lift > .98, null, { timeout: 60000 });
  await swipe(page, [100, 150], [220, 154], { steps: 6, hold: 12 }); assert.equal((await st(page)).categoryId, 'starters'); assert.equal((await st(page)).open, 'dish', 'a sideways finger on a lifted dish turns it');
  await swipe(page, [160, 100], [160, 220], { steps: 6, hold: 12 }); await page.waitForFunction(() => window.__mana.state().open === null, null, { timeout: 20000 });
  await page.tap('#listBtn'); await page.waitForFunction(() => window.__mana.state().open === 'list'); await page.waitForTimeout(500); await page.tap('.row[data-id="filo"]'); await rest('filo');
  await page.reload(); await page.evaluate(() => window.__mana.tableReady); await page.waitForFunction(() => { const s = window.__mana.info(); return s && s.heroReady; }, null, { timeout: 120000 }); await page.waitForTimeout(600); assert.equal(await page.evaluate(() => document.getElementById('hint').hidden), true, 'once per device');
  assert.deepEqual(errors, []); await ctx.close();
});

test('a menu of one dish still answers the hand; five screens, both languages: nothing overflows and every target is finger-sized', async () => {
  let o = await open(browser, demo(T + PULL + '&lang=en&hint=1', '', 'solo')), page = o.page; await tableUp(page);
  let i = await info(page); assert.equal(i.actors.length, 1); assert.equal(await text(page, '#dIdx'), '1 / 1'); assert.equal(await page.evaluate(() => document.getElementById('hint').hidden), true, 'nothing to glide to: no glide hint');
  const f = i.frame; await drag(page, [f.cx, 300], [f.cx, 300 + 140], { steps: 8, release: false }); await tick(page, 1, 0, true); i = await info(page);
  assert.ok(i.p > .15 && i.p < .85, 'the single dish moves under the finger: ' + i.p); await page.evaluate(([x, y]) => { window.__mana.tick(8, .016, false); window.__mana.pointer('up', x, y); }, [f.cx, 440]); await settle(page, 60); assert.equal((await info(page)).p, 0, 'and springs back');
  await drag(page, [300, 400], [150, 404], { steps: 6, ms: 16 }); await settle(page, 40); assert.equal((await st(page)).nav.kind, 'edge');
  await page.evaluate(([x, y]) => { window.__mana.pointer('down', x, y); window.__mana.pointer('up', x, y); }, [f.cx, f.cy]); assert.equal((await st(page)).open, 'dish'); await settle(page, 60); assert.ok((await info(page)).lift > .99);
  assert.deepEqual(o.errors, []); await o.ctx.close();
  for (const [w, h] of [[360, 640], [390, 844], [844, 390], [768, 1024], [1280, 800]]) for (const lang of ['he', 'en']) {
    o = await open(browser, demo('&test=1&pr=0.2&lang=' + lang), { width: w, height: h }); page = o.page; await tableUp(page);
    for (const step of ['rest', 'lifted', 'list']) {
      if (step === 'lifted') { await d(page, { type: 'focus', id: 'caesar' }); await d(page, { type: 'open', what: 'dish' }); await settle(page, 60); await tick(page, 1, 0, true); }
      if (step === 'list') { await d(page, { type: 'close' }); await d(page, { type: 'open', what: 'list' }); }
      const r = await page.evaluate(() => {
        const vis = (el) => { const b = el.getBoundingClientRect(), s = getComputedStyle(el); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && !el.closest('[hidden]') && !el.closest('[inert]') && b.top < innerHeight && b.bottom > 0; };
        const small = [...document.querySelectorAll('button, a.row, a.primary, a.ghost, a.home, .chip')].filter(vis).filter((el) => el.id !== 'openBtn').map((el) => { const b = el.getBoundingClientRect(); return { id: el.id || el.className, w: Math.round(b.width), h: Math.round(b.height) }; }).filter((b) => b.w < 44 || b.h < 44);
        const card = document.getElementById('card').getBoundingClientRect(), gl = document.getElementById('gl').getBoundingClientRect(), chips = document.getElementById('chips').getBoundingClientRect(), s = window.__mana.info();
        const cut = [...document.querySelectorAll('#card h1, #card p, #card button, #card a, .bar > *, #list .row')].filter(vis).filter((el) => { const b = el.getBoundingClientRect(); return b.left < -1 || b.right > innerWidth + 1; }).map((el) => el.id || el.className);
        const hero = s.hot.find((x) => x.id === window.__mana.state().itemId);
        return { over: document.documentElement.scrollWidth - innerWidth, tall: document.documentElement.scrollHeight - innerHeight, small, cut, card: [Math.round(card.left), Math.round(card.top), Math.round(card.right), Math.round(card.bottom)], gl: [gl.width, gl.height], chipsTop: chips.top, hero, wide: s.frame.wide, f: s.frame };
      });
      const where = `${w}x${h} ${lang} ${step}`;
      assert.ok(r.over <= 0 && r.tall <= 0, where + ': the page overflows'); assert.deepEqual(r.small, [], where + ': small targets'); assert.deepEqual(r.cut, [], where + ': clipped');
      assert.deepEqual(r.gl, [w, h], where + ': the scene fills the screen'); assert.ok(r.chipsTop >= 40 && r.chipsTop < 80, where + ': chips under the bar');
      if (step !== 'list') { assert.ok(r.hero && r.hero.cx - r.hero.rx > -2 && r.hero.cx + r.hero.rx < w + 2 && r.hero.cy - r.hero.ry > 20, where + ': the dish in focus is on screen ' + JSON.stringify(r.hero));
        if (r.wide) assert.ok(lang === 'he' ? r.hero.cx + r.hero.rx < r.card[0] + 30 || r.card[0] > w / 2 : r.hero.cx - r.hero.rx > r.card[2] - 30, where + ': the card stands beside the dish'); else assert.ok(r.hero.cy + r.hero.ry < r.card[1] + 30, where + ': the dish sits above the card (' + Math.round(r.hero.cy + r.hero.ry) + ' vs ' + r.card[1] + ')'); }
      if (step === 'rest') assert.equal(r.wide, w >= 700 && w / h >= 1.15);
    }
    assert.deepEqual(o.errors, [], `${w}x${h} ${lang}`); await o.ctx.close();
  }
});

test('the stage shows what the state says, also after interrupted and rapid changes', async () => {
  const { page, errors, ctx } = await open(browser, demo('&test=1&pr=0.2&lang=en'), { width: 360, height: 520 });
  await tableUp(page);
  const res = await page.evaluate(async () => {
    const M = window.__mana, m = M.model(), items = [...m.itemById.keys()], cats = m.cats.map((c) => c.id), bad = [];
    let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }, pick = (a) => a[Math.floor(rnd() * a.length)];
    for (let n = 0; n < 220; n++) {
      const r = rnd(); M.dispatch(r < .3 ? { type: 'step', dir: pick([-1, 1]) } : r < .45 ? { type: 'focus', id: pick(items) } : r < .55 ? { type: 'open', what: 'dish' } : r < .65 ? { type: 'close' } : r < .8 ? { type: 'setCategory', id: pick(cats) } : r < .9 ? { type: 'swipe', sx: pick([-1, 1]) } : { type: 'setLang', lang: pick(['he', 'en']) });
      if (r > .93) { M.pointer('down', 180, 200); M.pointer('move', 180, 200 + 160 * rnd()); if (rnd() < .5) M.pointer('up', 180, 300); }
      if (rnd() < .5) M.tick(1 + Math.floor(rnd() * 3), 1 / 30, rnd() < .15);                              // sometimes mid-flight, sometimes not drawn at all
      const s = M.state(), e = m.itemById.get(s.itemId), i = M.info(), live = i.actors.filter((a) => !a.leaving && !a.guest), beside = i.actors.filter((a) => !a.leaving && a.guest), nb = [m.cats[e.cat.index - 1], m.cats[e.cat.index + 1]].filter((c) => c && c.scene === e.cat.scene).map((c) => c.id);
      if (!live.some((a) => a.id === s.itemId) && bad.length < 5) bad.push(n + ': the dish in focus is not on the table');
      if (live.some((a) => !e.cat.ids.includes(a.id)) && bad.length < 5) bad.push(n + ': a dish of another category stands on this table');
      if ((beside.length > 6 || beside.some((a) => !nb.includes(a.cat))) && bad.length < 5) bad.push(n + ': beside this section only its neighbours on the same table may be laid: ' + beside.map((a) => a.cat + '/' + a.id));
      if (live.length > 11 && bad.length < 5) bad.push(n + ': ' + live.length + ' dishes mounted');      // near the camera, plus the dish it is travelling to and its two neighbours
      if (i.scene !== e.cat.scene && bad.length < 5) bad.push(n + ': scene ' + i.scene + ' for ' + e.cat.id);
    }
    M.pointer('up', 180, 300); M.dispatch({ type: 'close' });
    for (let k = 0; k < 40; k++) { await new Promise((r) => setTimeout(r, 100)); M.tick(6, 1 / 30, false); if (M.pending() === 0 && M.info().moving !== true) break; }
    M.tick(1, 0, true); const s = M.state(), i = M.info(), e = m.itemById.get(s.itemId);
    return { bad, left: i.actors.filter((a) => a.left).length, actors: i.actors.filter((a) => !a.left && !a.guest).map((a) => a.id + (a.leaving ? '!' : '')), all: i.actors.filter((a) => !a.leaving).length, index: e.i, p: i.p, mode: i.mode, textures: i.textures, drinks: i.drinks.drinks, wantDrinks: i.actors.filter((a) => a.type === 'drink' || a.tris).length, lift: i.lift, lampK: i.lampK, hero: i.heroReady, n: e.cat.ids.length };
  });
  assert.deepEqual(res.bad, []); assert.ok(res.actors.every((a) => !a.endsWith('!')), 'nothing stale is left on the table: ' + res.actors); assert.equal(res.p, res.index); assert.equal(res.mode, 'rest'); assert.equal(res.lift, 0); assert.equal(res.lampK, 1); assert.ok(res.hero);
  assert.equal(res.actors.length, Math.min(res.n - 1, res.index + 3) - Math.max(0, res.index - 3) + 1, 'exactly the dishes near the camera'); assert.ok(res.all <= 7, 'with the neighbouring courses, never more than seven in all: ' + res.all); assert.ok(res.left <= 7, 'at most the last section\'s few dishes are still on the table behind us: ' + res.left); assert.ok(res.textures <= 2 * (7 + res.left) + 10, 'pictures on the GPU: ' + res.textures); assert.equal(res.drinks, res.wantDrinks);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the default direction is the feed: a swipe up is the next dish, also on the first one; keys, wheel and hint agree; ?walk=pull turns it round', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + '&lang=en&hint=1'));
  await tableUp(page); const f = (await info(page)).frame, x = f.cx;
  assert.equal(await page.evaluate(() => window.__mana.walk()), -1); assert.equal(await page.getAttribute('#hint', 'data-dir'), 'up', 'the hint hand points the way the finger goes'); assert.equal(await page.getAttribute('#hint', 'title'), 'Swipe up for the next dish');
  let i = await info(page); assert.ok(i.actors.find((a) => a.id === 'hummus').z > i.actors.find((a) => a.id === 'labaneh').z, 'the next dish waits at the near end of the table');
  await drag(page, [x, 500], [x, 500 - 70], { steps: 4, ms: 16 }); assert.equal((await info(page)).mode, 'settle'); await settle(page, 60); assert.equal((await st(page)).itemId, 'hummus', 'the first dish answers a swipe up with the second'); assert.equal((await info(page)).p, 1);
  await drag(page, [x, 300], [x, 300 + 70], { steps: 4, ms: 16 }); await settle(page, 60); assert.equal((await st(page)).itemId, 'labaneh', 'a swipe down is the previous dish');
  await drag(page, [x, 300], [x, 300 + 70], { steps: 4, ms: 16 }); await settle(page, 60); assert.equal((await st(page)).itemId, 'labaneh', 'before the first dish of the menu there is nothing: the table gives and comes back'); assert.equal((await info(page)).p, 0);
  await page.keyboard.press(' '); assert.equal((await st(page)).itemId, 'hummus', 'the space bar is next'); await page.keyboard.press('PageDown'); assert.equal((await st(page)).itemId, 'filo'); await page.keyboard.press('ArrowUp'); assert.equal((await st(page)).itemId, 'artichoke'); await settle(page, 80);
  await page.evaluate(() => window.__mana.wheel(100)); await settle(page, 80); assert.equal((await st(page)).itemId, 'filo', 'a wheel notch down is next');
  /* past the last dish of a section, by a swipe up: on along the same table */
  await d(page, { type: 'focus', id: 'fish-soup' }); await settle(page, 80); await drag(page, [x, 500], [x, 500 - 70], { steps: 4, ms: 16 }); const s = await st(page); assert.equal(s.categoryId, 'mains'); assert.equal(s.itemId, 'pappardelle');
  i = await info(page); assert.equal(i.lampK, 1); assert.deepEqual(i.titles.map((t) => t.text), ['Mains']); await settle(page, 120); assert.equal((await info(page)).walkOn, 0);
  assert.deepEqual(errors, []); await ctx.close();
  const o = await open(browser, demo(T + PULL + '&lang=en&hint=1')); await tableUp(o.page);
  assert.equal(await o.page.getAttribute('#hint', 'data-dir'), 'down'); assert.equal(await o.page.getAttribute('#hint', 'title'), 'Pull the table towards you to see the next dish');
  await drag(o.page, [x, 300], [x, 300 + 70], { steps: 4, ms: 16 }); await settle(o.page, 60); assert.equal((await st(o.page)).itemId, 'hummus', 'walk=pull: the table is pulled towards you'); assert.deepEqual(o.errors, []); await o.ctx.close();
});

test('the ordering button in a demo: "Order online", no host, and a tap explains instead of leaving', async () => {
  const { page, errors, ctx } = await open(browser, demo(T + '&lang=en', '#c=starters&i=hummus&o=1'));
  await tableUp(page); assert.equal((await st(page)).open, 'dish');
  const link = () => page.evaluate(() => { const a = document.getElementById('orderLink2'), n = document.getElementById('orderNote2'); return { text: a.textContent, href: a.getAttribute('href'), role: a.getAttribute('role'), tab: a.tabIndex, hidden: a.hidden, note: n.hidden ? null : n.textContent }; });
  let l = await link(); assert.deepEqual(l, { text: 'Order online', href: null, role: 'button', tab: 0, hidden: false, note: null });
  assert.ok(!(await page.evaluate(() => document.getElementById('app').textContent)).includes('example.com'), 'no host is named anywhere on the page');
  const url = page.url(); await page.click('#orderLink2'); await page.waitForTimeout(150);
  assert.equal(page.url(), url, 'the page stays'); assert.equal(ctx.pages().length, 1, 'and nothing else opens'); assert.equal((await st(page)).open, 'dish');
  l = await link(); assert.equal(l.note, 'In your menu this button opens your own ordering page.');
  await settle(page, 40); const r = await page.evaluate(() => { const n = document.getElementById('orderNote2').getBoundingClientRect(); return { top: Math.round(n.top), bottom: Math.round(n.bottom), h: innerHeight }; }); assert.ok(r.top > 0 && r.bottom <= r.h, 'the sheet has grown to hold the notice: ' + JSON.stringify(r));
  await page.keyboard.press('ArrowDown'); l = await link(); assert.equal(l.note, null, 'another dish: the notice has gone');
  await d(page, { type: 'setLang', lang: 'he' }); l = await link(); assert.equal(l.text, 'להזמנה אונליין'); await page.focus('#orderLink2'); await page.keyboard.press('Enter');
  l = await link(); assert.equal(l.note, 'בתפריט שלכם הכפתור הזה פותח את עמוד ההזמנות שלכם.'); assert.equal((await st(page)).open, 'dish', 'Enter on the button is the button, not "put the dish back"'); assert.equal(page.url().split('#')[0], url.split('#')[0]);
  /* "my table" carries the same button */
  await d(page, { type: 'close' }); await d(page, { type: 'trayAdd', id: 'hummus' }); await d(page, { type: 'open', what: 'tray' }); await page.waitForTimeout(60);
  const tray = await page.evaluate(() => { const a = document.getElementById('orderLink'); a.click(); const n = document.getElementById('orderNote'); return { text: a.textContent, href: a.getAttribute('href'), note: n.hidden ? null : n.textContent }; });
  assert.deepEqual(tray, { text: 'להזמנה אונליין', href: null, note: 'בתפריט שלכם הכפתור הזה פותח את עמוד ההזמנות שלכם.' }); assert.equal(ctx.pages().length, 1);
  assert.deepEqual(errors, []); await ctx.close();
});

test('the ordering button in a real menu: "Order on <host>" and the business\'s own link, exactly as before', async () => {
  for (const lang of ['en', 'he']) {
    const { page, errors, ctx } = await open(browser, srv.origin + '/m/olea?test=1&pr=0.3&lang=' + lang + '#c=starters&i=hummus&o=1');
    await tableUp(page); assert.equal((await st(page)).open, 'dish');
    const l = await page.evaluate(() => { const q = (id) => { const a = document.getElementById(id); return { text: a.textContent, href: a.getAttribute('href'), target: a.target, rel: a.rel, role: a.getAttribute('role'), hidden: a.hidden }; }; return { sheet: q('orderLink2'), tray: q('orderLink'), notes: [document.getElementById('orderNote').hidden, document.getElementById('orderNote2').hidden], demoTag: document.getElementById('demoNote').hidden }; });
    const want = { text: lang === 'he' ? 'להזמנה ב-example.com' : 'Order on example.com', href: 'https://example.com/olea', target: '_blank', rel: 'noopener noreferrer', role: null, hidden: false };
    assert.deepEqual(l.sheet, want, lang); assert.deepEqual(l.tray, want, lang); assert.deepEqual(l.notes, [true, true], 'no notice in a real menu'); assert.equal(l.demoTag, true, 'and this is not a demo');
    assert.deepEqual(errors, [], lang); await ctx.close();
  }
});
