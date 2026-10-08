// (g) Hebrew/RTL and English at 360, 390 and 1440 px: no sideways scrolling, nothing to tap under 44 px, direction and
// language set on the document, numbers and links isolated for bidi. Every screen of version 2 and every sheet is opened.
// Also: keyboard reach, the place in a long menu, drag to reorder, the phone's camera chooser, the review decisions.
// The stand-in generator is used (this file is about the screens, not about the picture).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setup, teardown, newPage, app, account, seedBusiness, signInUi, layoutProblems, shot, PHOTOS, sql, stack, stackConfig, menuPhoto, guests, dbIs, unique, PASSWORD } from './helpers.mjs';

let owner, biz, asset, wine, pathOwner, pathBiz, emptyOwner;
const jpeg = () => new Blob([fs.readFileSync(PHOTOS.plate2)], { type: 'image/jpeg' });
const png = () => new Blob([fs.readFileSync(PHOTOS.plate2.replace('.jpg', '.gt.png'))], { type: 'image/png' });
const LONG = ['המבורגר הבית עם צ׳יפס ורוטב שום', 'House burger with fries and garlic sauce'];
const ITEMS = [[...LONG, 7200], ['סלט קיסר', 'Caesar salad', 4800], ['פסטה ארוכה מאוד עם שם שממשיך ונמשך כדי לבדוק גלישה', 'A very long pasta name that keeps going to check wrapping', null], ['שקשוקה', 'Shakshuka', 5400]];

before(async () => {
  await setup({ gen: 'fake' });
  // a published place with numbers, a picture waiting for review, illustrations, a wine section, a sold-out dish, an empty section
  owner = await account();
  biz = await seedBusiness(owner.client, { nameHe: 'ביסטרו השדרה', nameEn: 'Boulevard Bistro', items: ITEMS });
  await owner.client.from('items').update({ stock_id: 'salad' }).eq('id', biz.items[1].id);
  await owner.client.from('items').update({ stock_id: 'pasta' }).eq('id', biz.items[2].id);
  const c2 = await owner.client.from('categories').insert({ business_id: biz.id, name_he: 'יינות', name_en: 'Wine', kind: 'wine', position: 1 }).select().single();
  wine = (await owner.client.from('items').insert({ business_id: biz.id, category_id: c2.data.id, name_he: 'מרלו', name_en: 'Merlot', price_minor: 14000, available: false }).select().single()).data;
  await owner.client.from('categories').insert({ business_id: biz.id, name_he: 'קינוחים', name_en: 'Desserts', kind: 'dessert', position: 2 });
  const a = await owner.client.from('assets').insert({ business_id: biz.id, item_id: biz.items[0].id, status: 'uploaded', kind: 'relief' }).select().single();
  asset = a.data.id; const base = `${biz.id}/${asset}/`;
  for (const [f, blob] of [['original.jpg', jpeg()], ['color.jpg', jpeg()], ['thumb.jpg', jpeg()], ['aux.png', png()]]) await owner.client.storage.from('menu-private').upload(base + f, blob);
  await owner.client.from('assets').update({ status: 'processing', original_path: base + 'original.jpg' }).eq('id', asset);
  await owner.client.from('assets').update({ status: 'ready_for_review', relief_class: 'medium', color_path: base + 'color.jpg', aux_path: base + 'aux.png', thumb_path: base + 'thumb.jpg', meta: { e: 48, h: 0.2, warn: 'the dish is cut off at the image border' } }).eq('id', asset);
  assert.equal((await owner.client.rpc('publish_menu', { p_business: biz.id })).data.ok, true);
  await guests(biz.slug, [{ lang: 'he', src: 'qr' }, { lang: 'en', src: 'qr' }, { lang: 'he', src: 'link' }], [[biz.items[0].id, 'open', 7], [biz.items[1].id, 'open', 4], [biz.items[3].id, 'open', 2], [biz.items[0].id, 'add', 2]]);
  sql(`insert into public.menu_views_daily (business_id, day, views, views_en, views_qr) select '${biz.id}', (now() at time zone 'Asia/Jerusalem')::date - g, 1200 + g * 37, 300, 800 from generate_series(1, 20) g`);
  // a place that has not published yet (the path), and an account whose menu is still empty
  pathOwner = await account();
  pathBiz = await seedBusiness(pathOwner.client, { nameHe: 'קפה הדרך', nameEn: 'Path Cafe', items: ITEMS });
  await pathOwner.client.from('items').update({ stock_id: 'shakshuka' }).eq('id', pathBiz.items[3].id);
  emptyOwner = await account();
  const made = await emptyOwner.client.rpc('create_business', { p_slug: unique('empty'), p_name_he: 'מקום ריק', p_name_en: '', p_kind: 'bar', p_contact_name: '', p_contact_phone: '' });
  assert.equal(made.data.ok, true);
});
after(async () => { await teardown(); });

const closeSheet = async (page) => { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]')); };

for (const lang of ['he', 'en']) {
  for (const width of [360, 390, 1440]) {
    test(`${lang} · ${width}px: every screen and every sheet fits, with touch targets of 44 px or more`, async () => {
      const wide = width === 1440;
      const page = await newPage({ width, height: wide ? 900 : 800, lang });
      const found = [];                                                      // every problem of every screen, reported together at the end
      const look = async (p, label, wait) => { await p.waitForTimeout(wait); for (const x of await layoutProblems(p)) found.push(`${label}: ${x}`); if (width === 390 || wide) await shot(p, `g-${label.replace(/[^a-z0-9]+/gi, '-')}-${lang}-${width}`, { fullPage: false }); };
      const fits = (label, wait = 250) => look(page, label, wait);
      const open = async (selector, sheet, label, ready) => {
        await page.locator(selector).first().click();
        await page.locator(`[data-sheet=${sheet}]`).waitFor();
        if (ready) await page.locator(ready).first().waitFor({ timeout: 20000 });
        await fits(label);
      };

      // ---- start
      await page.goto(app());
      await page.locator('.start-form').waitFor();
      assert.deepEqual(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir]), lang === 'he' ? ['he', 'rtl'] : ['en', 'ltr']);
      await fits('start');
      await signInUi(page, owner.email);

      // ---- home: the dashboard and what opens from it
      await page.locator('[data-stats=ready]').waitFor({ timeout: 20000 });
      await fits('home', 500);
      await open('[data-act=soldout]', 'soldout', 'sheet sold out'); await closeSheet(page);
      await open('[data-act=qr]', 'qr', 'sheet qr', '[data-sheet=qr] .tcard-qr'); await closeSheet(page);
      await open('.acctbtn', 'account', 'sheet account'); await closeSheet(page);

      // ---- menu: the list, reorder mode, the sheets
      await page.goto(app('menu'));
      await page.locator('section.sec').first().waitFor();
      await fits('menu', 500);
      await page.locator('[data-tool=reorder]').click();
      await page.locator('.grip').first().waitFor();
      await fits('menu reorder');
      await page.locator('[data-tool=reorder]').click();
      await open('[data-tool=section]', 'section', 'sheet section'); await closeSheet(page);
      await open('[data-tool=import]', 'import', 'sheet import');
      await page.locator('[data-sheet=import] [data-way=paste]').click();
      await page.locator('[data-sheet=paste] textarea').fill('# Starters\nHummus | 32 | with chickpeas\nA line with a very long name that goes on and on and on | 12.5 | and a long description too, to see how it wraps on a narrow phone\nBad | x');
      await fits('sheet paste');
      await page.locator('[data-sheet=paste] .sheet-foot .btn-primary').click();
      await page.locator('[data-paste-summary]').waitFor();
      await fits('sheet paste review'); await closeSheet(page);

      // ---- one dish: the short sheet, "More", the wine fields, the illustration picker
      await open(`li.row[data-item="${biz.items[0].id}"] a.row-main`, 'dish', 'sheet dish', '[data-sheet=dish] [data-field=price]');
      await page.locator('[data-action=more]').click();
      await fits('sheet dish more');
      await page.locator('[data-sheet=dish] [data-action=picture]').click();          // the picture row opens the same sheet as a tile of the grid
      await page.locator('[data-sheet=picture]').waitFor();
      await fits('sheet picture from dish');
      await page.locator('[data-sheet=picture] [data-action=choose-illustration]').click();
      await page.locator('[data-sheet=illustrations] .pickgrid img').first().waitFor({ timeout: 20000 });
      await fits('sheet illustrations', 500);
      await page.keyboard.press('Escape');                                  // the picker closes back to the picture, and that one back to the dish
      await page.locator('[data-sheet=picture]').waitFor();
      await page.keyboard.press('Escape');
      await page.locator('[data-sheet=dish] [data-action=more][aria-expanded=true]').waitFor();
      await closeSheet(page);
      await open(`li.row[data-item="${wine.id}"] a.row-main`, 'dish', 'sheet dish wine', '[data-sheet=dish] [data-field=price]');
      await page.locator('[data-action=more]').click();
      await page.locator('[data-detail="wine.producer"]').waitFor();
      await fits('sheet dish wine more');
      await closeSheet(page);

      // ---- pictures: the grid, one dish's picture, the review screen
      await page.goto(app('pictures'));
      await page.locator('.tiles2').first().waitFor();
      await page.locator('.tiles2 [data-pic=stock] img').first().waitFor({ timeout: 20000 });
      await fits('pictures', 500);
      await open(`.tile2[data-item="${biz.items[1].id}"] button`, 'picture', 'sheet picture');
      await page.locator('[data-sheet=picture] .tip').first().click();
      await fits('sheet picture tip'); await closeSheet(page);
      await page.goto(app('pictures/' + asset));
      await page.locator('[data-shot=result][data-ready=true]').waitFor({ timeout: 20000 });
      await fits('review', 500);

      // ---- style, publish, the preview
      await page.goto(app('style'));
      await page.locator('.strip img').first().waitFor();
      await fits('style', 500);
      await page.goto(app('publish'));
      await page.locator(wide ? '.dock [data-preview=shown]' : '.pubgrid [data-preview=shown]').waitFor({ timeout: 30000 });
      await fits('publish', 600);
      await page.goto(app('menu'));
      await page.locator('section.sec').first().waitFor();
      if (wide) { await page.locator('.dock [data-preview=shown]').waitFor({ timeout: 30000 }); assert.equal(await page.locator('.fab').count(), 0, 'no floating button beside a docked preview'); }
      else { await open('[data-action=preview]', 'preview', 'sheet preview', '[data-sheet=preview] [data-preview=shown]'); await closeSheet(page); }

      // ---- the scanner: while it reads, and the review
      await stackConfig({ ai: 'reset' }); await stackConfig({ ai: { delayMs: 160 } });
      await page.locator('[data-scan-input=pick]').setInputFiles(await menuPhoto());
      await page.waitForFunction(() => Number(document.querySelector('[data-scan]')?.getAttribute('data-scan-count')) >= 2, null, { timeout: 60000 });
      await fits('scan reading', 0);
      await page.locator('[data-scan=review]').waitFor({ timeout: 60000 });
      await fits('scan review', 400);
      await page.locator('.scan-top .iconbtn').first().click();
      await page.locator('section.sec').first().waitFor();
      await stackConfig({ ai: 'reset' });
      assert.deepEqual(page.problems, [], 'no console errors');
      await page.context().close();

      // ---- before the first publish: the three parts of the path, and the style screen reached from the last one
      const p2 = await newPage({ width, height: wide ? 900 : 800, lang });
      const fits2 = (label, wait = 300) => look(p2, label, wait);
      await signInUi(p2, pathOwner.email);
      await p2.locator('[data-next=pictures]').waitFor({ timeout: 20000 });
      assert.equal(await p2.locator('.shell').getAttribute('data-mode'), 'path');
      await fits2('path menu', 500);
      await p2.locator('[data-next=pictures]').click();
      await p2.locator('[data-illus]').waitFor();
      await p2.locator('.tiles2 [data-pic=stock] img').first().waitFor({ timeout: 20000 });
      await fits2('path pictures', 500);
      await p2.locator('[data-next=publish]').click();
      await p2.locator(wide ? '.dock [data-preview=shown]' : '.pubgrid [data-preview=shown]').waitFor({ timeout: 30000 });
      await fits2('path publish', 600);
      await p2.locator('[data-link=style]').click();
      await p2.locator('.strip img').first().waitFor();
      await fits2('path style', 400);
      assert.deepEqual(p2.problems, [], 'no console errors on the path');
      await p2.context().close();

      // ---- an empty menu, and the first step of a new account
      const p3 = await newPage({ width, height: wide ? 900 : 800, lang });
      const fits3 = (label, wait = 300) => look(p3, label, wait);
      await signInUi(p3, emptyOwner.email);
      await p3.locator('[data-ways]').waitFor({ timeout: 20000 });
      await fits3('menu empty');
      await p3.locator('.acctbtn').click();
      await p3.locator('[data-menu=add-business]').click();
      await p3.locator('[data-field=place]').fill(lang === 'he' ? 'קפה הפינה של סבתא רחל ברחוב הראשי' : 'Grandma Rachel\'s Corner Cafe on Main Street');
      await p3.locator('[data-avail=free]').waitFor({ timeout: 15000 });
      await fits3('place');
      await p3.locator('.addr-edit').click();
      await p3.locator('[data-field=slug]').waitFor();
      await fits3('place address');
      assert.deepEqual(p3.problems, []);
      await p3.context().close();
      assert.deepEqual(found, [], `layout at ${width}px in ${lang}`);
    });
  }
}

test('the start screen with all three providers fits at 360 px in both languages, and the language choice is remembered', async () => {
  for (const lang of ['he', 'en']) {
    const page = await newPage({ width: 360, height: 760, lang });
    await page.route('**/config.js', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace('"providers": []', '"providers": ["google", "apple", "facebook"]') }); });
    await page.goto(app());
    await page.locator('[data-provider=facebook]').waitFor();
    assert.deepEqual(await layoutProblems(page), [], 'start with providers in ' + lang);
    // a wrong e-mail shows its sentence without pushing anything off the screen
    await page.locator('input[name=email]').fill('not-an-address'); await page.locator('form button[type=submit]').click();
    await page.locator('.note-error').waitFor();
    assert.deepEqual(await layoutProblems(page), [], 'start with an error in ' + lang);
    await page.context().close();
  }
  const page = await newPage({ width: 390, height: 800, lang: 'he' });
  await page.goto(app());
  await page.locator('.start-form').waitFor();
  await page.locator('.start-links button.linkbtn').first().click();
  assert.equal(await page.evaluate(() => document.documentElement.dir), 'ltr');
  await page.reload();
  await page.locator('.start-form').waitFor();
  assert.deepEqual(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir, document.querySelector('h1').textContent]), ['en', 'ltr', 'A menu where guests see the dishes']);
  await page.context().close();
});

test('bidi and accessibility basics: isolated numbers and links, labelled fields, one h1, live regions, only local hosts', async () => {
  const page = await newPage({ width: 390, height: 800, lang: 'he' });
  await signInUi(page, owner.email);
  await page.locator('[data-stats=ready]').waitFor({ timeout: 20000 });
  const basics = () => page.evaluate(() => {
    const out = [];
    if (document.querySelectorAll('h1').length !== 1) out.push('h1 count ' + document.querySelectorAll('h1').length);
    for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=file]), select, textarea')) {
      if (el.closest('.hp, .sr')) continue;
      const labelled = el.getAttribute('aria-label') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label');
      if (!labelled) out.push('no label: ' + el.outerHTML.slice(0, 90));
    }
    for (const el of document.querySelectorAll('button, a[href]')) {
      if (el.closest('[aria-hidden=true]')) continue;
      if (!(el.getAttribute('aria-label') || el.textContent.trim())) out.push('no name: ' + el.outerHTML.slice(0, 90));
    }
    for (const a of document.querySelectorAll('a[target=_blank]')) { if (!/noopener/.test(a.rel)) out.push('no rel=noopener: ' + a.href); if (!/^https:\/\//.test(a.href) && !/^http:\/\/127\.0\.0\.1/.test(a.href)) out.push('not https: ' + a.href); }
    for (const img of document.querySelectorAll('img')) if (!img.hasAttribute('alt')) out.push('img without alt');
    // a price, a link or an address inside Hebrew text must sit in its own direction-isolated box
    for (const el of document.querySelectorAll('.price, .biglink, .home-url, .addr-url, .slugbox, [data-short-link], .top-n, bdi[data-n], .delta bdi')) { const cs = getComputedStyle(el); if (cs.direction !== 'ltr') out.push('not ltr: ' + el.className + ' ' + el.textContent.slice(0, 20)); }
    for (const d of document.querySelectorAll('dialog[open]')) if (!d.getAttribute('aria-label')) out.push('dialog without a name');
    return out;
  });
  const screens = [['', '[data-stats=ready]'], ['menu', 'section.sec'], ['menu/i/' + biz.items[0].id, '[data-sheet=dish]'], ['menu/i/' + wine.id, '[data-sheet=dish]'], ['pictures', '.tiles2'], ['pictures/' + asset, '[data-shot=result]'], ['style', '.strip'], ['publish', '[data-action=publish]']];
  for (const [hash, ready] of screens) {
    await page.goto(app(hash)); await page.locator(ready).first().waitFor({ timeout: 20000 }); await page.waitForTimeout(400);
    if (hash.startsWith('menu/i/')) await page.locator('[data-action=more]').click();
    assert.deepEqual(await basics(), [], 'on ' + (hash || 'home'));
    // the dish sheet says in one line where its picture stands
    if (hash === 'menu/i/' + biz.items[0].id) assert.deepEqual([await page.locator('.dish-slot').getAttribute('data-status'), await page.locator('.dish-slot-line').innerText()], ['review', 'תבליט מוכן, מחכה לאישור']);
    if (hash === 'menu/i/' + wine.id) assert.deepEqual([await page.locator('.dish-slot').getAttribute('data-status'), await page.locator('.dish-slot-line').innerText(), await page.locator('[data-sheet=dish] .actlist').count()], ['none', 'הוספת תמונה', 0]);
  }
  // the sheets that open from buttons
  await page.goto(app('')); await page.locator('[data-stats=ready]').waitFor();
  for (const [button, sheet] of [['[data-act=soldout]', 'soldout'], ['[data-act=qr]', 'qr'], ['.acctbtn', 'account']]) {
    await page.locator(button).click(); await page.locator(`[data-sheet=${sheet}]`).waitFor(); await page.waitForTimeout(200);
    assert.deepEqual(await basics(), [], 'sheet ' + sheet);
    await closeSheet(page);
  }
  await page.goto(app('pictures')); await page.locator('.tiles2').first().waitFor();
  await page.locator(`.tile2[data-item="${biz.items[1].id}"] button`).click(); await page.locator('[data-sheet=picture]').waitFor();
  assert.deepEqual(await basics(), [], 'sheet picture');
  await page.locator('[data-sheet=picture] [data-action=choose-illustration]').click(); await page.locator('[data-sheet=illustrations] .pickgrid img').first().waitFor();
  assert.deepEqual(await basics(), [], 'sheet illustrations');
  assert.ok(await page.locator('[data-sheet=illustrations] .pic-badge').count() >= 8, 'every illustration in the picker carries its badge');
  await closeSheet(page); await page.waitForTimeout(150); if (await page.locator('dialog[open]').count()) await closeSheet(page);
  // every placeholder thumbnail says what it is, in the list and in the grid
  for (const hash of ['menu', 'pictures']) {
    await page.goto(app(hash)); await page.locator(hash === 'menu' ? 'section.sec' : '.tiles2').first().waitFor(); await page.locator('[data-pic=stock] img').first().waitFor();
    const marks = await page.locator('[data-pic=stock]').evaluateAll((els) => els.map((e) => e.querySelector('.pic-badge')?.textContent || ''));
    assert.deepEqual(marks, ['להמחשה', 'להמחשה'], 'badges on ' + hash);
  }
  // the scanner's screens
  await stackConfig({ ai: 'reset' });
  await page.goto(app('menu')); await page.locator('section.sec').first().waitFor();
  await page.locator('[data-scan-input=pick]').setInputFiles(await menuPhoto());
  await page.locator('[data-scan=review]').waitFor({ timeout: 60000 });
  assert.deepEqual(await basics(), [], 'scan review');
  await page.locator('.scan-top .iconbtn').first().click();
  await page.locator('section.sec').first().waitFor();

  assert.ok(await page.locator('[aria-live]').count() >= 2, 'save state and toasts are announced');
  assert.deepEqual([...page.hosts].sort(), [new URL(stack.API_URL).host, new URL(stack.WEB_URL).host].sort(), 'nothing is loaded from anywhere but the app\'s own host and the backend');
  assert.deepEqual(page.problems, []);
  await page.context().close();

  // the start and the place step
  const p2 = await newPage({ width: 390, height: 800, lang: 'he' });
  await p2.goto(app()); await p2.locator('.start-form').waitFor();
  const start = await p2.evaluate(() => ({ h1: document.querySelectorAll('h1').length, unlabelled: [...document.querySelectorAll('input:not([type=hidden])')].filter((el) => !el.closest('.hp') && !(el.id && document.querySelector(`label[for="${el.id}"]`))).length, tabs: document.querySelectorAll('[role=tab]').length }));
  assert.deepEqual(start, { h1: 1, unlabelled: 0, tabs: 0 }, 'one heading, labelled fields, and no sign-in / sign-up tabs');
  assert.deepEqual([...p2.hosts].sort(), [new URL(stack.WEB_URL).host], 'the start screen loads nothing from another host');
  await p2.context().close();
});

test('keyboard: skip link, reorder without a pointer, a dish opens and closes without losing the place, typed text is escaped', async () => {
  const page = await newPage({ width: 390, height: 560, lang: 'he' });
  await signInUi(page, owner.email);
  await page.locator('[data-stats=ready]').waitFor({ timeout: 20000 });
  await page.goto(app('menu')); await page.reload(); await page.locator('section.sec').first().waitFor();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.className), 'skip');
  // reorder with the keyboard: the mode is a button, the arrows are buttons, the move is announced
  await page.locator('[data-tool=reorder]').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-tool=reorder]').getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: 'להוריד את ' + LONG[0] }).focus(); await page.keyboard.press('Space');
  await dbIs(`select name_he from public.items where business_id = '${biz.id}' and category_id = '${biz.category.id}' order by position limit 1`, 'סלט קיסר');
  assert.match(await page.locator('p.sr[aria-live]').first().innerText(), /עבר למקום 2/);
  await page.locator('[data-tool=reorder]').click();

  // a dish far down the page: Enter opens its sheet, Esc closes it, and the page and the focus are where they were
  const last = page.getByRole('link', { name: 'עריכת מרלו' });
  await last.focus();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const y0 = await page.evaluate(() => window.scrollY);
  assert.ok(y0 > 100, 'the menu is longer than the screen (scrolled to ' + y0 + ')');
  await page.keyboard.press('Enter');
  await page.locator('[data-sheet=dish] [data-field=price]').waitFor();
  assert.equal(await page.evaluate(() => !!document.activeElement?.closest('dialog[open]')), true, 'focus moved into the sheet');
  assert.equal(await page.evaluate(() => window.scrollY), y0, 'the page behind did not jump');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.scrollY), y0, 'closing the sheet keeps the place');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'עריכת מרלו', 'and the keyboard is back on the row');

  // user text is escaped everywhere it is shown
  await page.getByRole('link', { name: 'עריכת סלט קיסר' }).focus(); await page.keyboard.press('Enter');
  await page.locator('[data-field=name_he]').fill('<img src=x onerror="window.__xss=1"><b>סלט</b>');
  await dbIs(`select count(*) from public.items where id = '${biz.items[1].id}' and name_he like '<img%'`, '1');
  await page.keyboard.press('Escape');
  for (const [hash, ready] of [['menu', 'section.sec'], ['pictures', '.tiles2'], ['', '[data-stats]'], ['publish', '[data-action=publish]'], ['style', '.strip']]) { await page.goto(app(hash)); await page.locator(ready).first().waitFor(); await page.waitForTimeout(300); }
  await page.goto(app('')); await page.locator('[data-act=soldout]').click(); await page.locator('[data-sheet=soldout]').waitFor();
  assert.match(await page.locator('[data-sheet=soldout]').innerText(), /<img src=x onerror=/, 'shown as text in the sold-out list');
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.__xss), undefined);
  await page.goto(app('menu'));
  assert.match(await page.locator('section.sec').first().innerText(), /<img src=x onerror=/, 'shown as text');
  await owner.client.from('items').update({ name_he: 'סלט קיסר' }).eq('id', biz.items[1].id);
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('the floating preview button never covers the last control of a page', async () => {
  const covered = (page) => page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const fab = document.querySelector('.fab').getBoundingClientRect(), hit = [];
    for (const el of document.querySelectorAll('main a[href], main button, main input:not(.sr), main select, main textarea, main label.btn, main summary')) {
      const b = el.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (b.bottom > fab.top + 1 && b.top < fab.bottom - 1 && b.right > fab.left + 1 && b.left < fab.right - 1) hit.push(el.tagName.toLowerCase() + ': ' + (el.getAttribute('aria-label') || el.textContent || el.getAttribute('data-field') || '').trim().slice(0, 30));
    }
    return hit;
  });
  for (const [who, mode, ready] of [[owner, 'tabs', '[data-stats]'], [pathOwner, 'path', '[data-next=pictures]']]) {
    const page = await newPage({ width: 390, height: 700, lang: 'he' });
    await signInUi(page, who.email);
    await page.locator(ready).first().waitFor({ timeout: 20000 });
    for (const [hash, shown] of [['menu', 'section.sec'], ['pictures', '.tiles2'], ['style', '.strip']]) {
      await page.goto(app(hash)); await page.locator(shown).first().waitFor(); await page.locator('.fab').waitFor();
      if (hash === 'style') await page.locator('details.more summary').click();
      await page.waitForTimeout(250);
      assert.deepEqual(await covered(page), [], `the end of ${hash} (${mode})`);
    }
    await page.context().close();
  }
});

test('drag to reorder: the handle moves a dish with the pointer, the buttons stay, and the new order is saved', async () => {
  const page = await newPage({ width: 390, height: 844, lang: 'he' });
  await signInUi(page, pathOwner.email);
  await page.locator('[data-next=pictures]').waitFor({ timeout: 20000 });
  const order = () => sql(`select string_agg(name_he, '|' order by position) from public.items where business_id = '${pathBiz.id}'`);
  assert.equal(order(), ITEMS.map((i) => i[0]).join('|'));
  assert.equal(await page.locator('.grip').count(), 0, 'no handles until the owner asks to reorder');
  await page.locator('[data-tool=reorder]').click();
  const row = page.locator(`li.row[data-item="${pathBiz.items[0].id}"]`);
  const grip = await row.locator('.grip').boundingBox(), h = (await row.boundingBox()).height;
  assert.ok(grip.width >= 44 && grip.height >= 44, 'the handle is large enough for a finger');
  assert.equal(await row.getByRole('button').count(), 2, 'the up and down buttons are still there');
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + (h * 2.1 * k) / 8);
  assert.equal(await row.evaluate((el) => el.classList.contains('is-dragging')), true);
  await shot(page, 'g-drag-he-390', { fullPage: false });
  await page.mouse.up();
  const want = [ITEMS[1][0], ITEMS[2][0], ITEMS[0][0], ITEMS[3][0]].join('|');
  await dbIs(`select string_agg(name_he, '|' order by position) from public.items where business_id = '${pathBiz.id}'`, want);
  assert.deepEqual(await page.locator('li.row .row-name').allInnerTexts(), want.split('|'), 'the list shows the new order');
  assert.match(await page.locator('p.sr[aria-live]').first().innerText(), /עבר למקום 3/);
  // a tap on the handle without moving changes nothing
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(400);
  assert.equal(order(), want);
  // put it back for the tests that follow
  await page.getByRole('button', { name: 'להעלות את ' + LONG[0] }).click();
  await page.getByRole('button', { name: 'להעלות את ' + LONG[0] }).click();
  await dbIs(`select string_agg(name_he, '|' order by position) from public.items where business_id = '${pathBiz.id}'`, ITEMS.map((i) => i[0]).join('|'));
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('on a phone (touch): a dish\'s picture offers the camera or the gallery with the four photo tips; the scanner offers the same', async () => {
  const { browser } = await import('./helpers.mjs');
  const context = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true, locale: 'he-IL' });
  const page = await newPage({ context, lang: 'he' });
  await signInUi(page, owner.email);
  await page.locator('[data-stats=ready]').waitFor({ timeout: 20000 });
  await page.goto(app('pictures'));
  const tile = page.locator(`.tile2[data-item="${biz.items[3].id}"]`);
  await tile.locator('button').tap();
  const sheet = page.locator('[data-sheet=picture]');
  await sheet.waitFor();
  assert.deepEqual(await sheet.locator('.actlist .btn-txt').allInnerTexts(), ['צילום', 'בחירה מהגלריה', 'בחירת איור'], 'three clear choices');
  assert.deepEqual(await sheet.locator('.tip').allInnerTexts(), ['מנה אחת', 'כולה בפנים', 'באלכסון', 'רקע חלק'], 'the tips are four icons with one or two words');
  assert.equal(await sheet.locator('.tip-text').isVisible(), false, 'no sentences until one is asked for');
  await sheet.locator('.tip').nth(2).tap();
  assert.equal(await sheet.locator('.tip-text').innerText(), 'מצלמים מלמעלה באלכסון, בערך 45 מעלות.');
  assert.deepEqual(await layoutProblems(page), [], 'picture sheet on a phone');
  assert.equal(await page.locator('input[data-photo-input=camera]').getAttribute('capture'), 'environment');
  assert.equal(await page.locator('input[data-photo-input=pick]').getAttribute('accept'), 'image/*');
  await shot(page, 'g-photo-chooser-touch-he-390', { fullPage: false });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), sheet.getByRole('button', { name: 'בחירת תמונה ל' + 'שקשוקה' }).tap()]);
  await fc.setFiles(PHOTOS.plate2);
  await page.locator(`.tile2[data-item="${biz.items[3].id}"]:is([data-status=working], [data-status=review])`).waitFor({ timeout: 20000 });
  await page.locator(`.tile2[data-item="${biz.items[3].id}"][data-status=review]`).waitFor({ timeout: 60000 });
  await page.keyboard.press('Escape');

  // the scanner: one sheet with the camera, the gallery, and the line about several pages
  await page.goto(app('menu')); await page.locator('section.sec').first().waitFor();
  await page.locator('[data-tool=import]').tap();
  await page.locator('[data-sheet=import] [data-way=scan]').tap();
  const choose = page.locator('[data-sheet=scan-choose]');
  await choose.waitFor();
  assert.deepEqual(await choose.locator('.btn-txt').allInnerTexts(), ['צילום התפריט', 'בחירת תמונות']);
  assert.match(await choose.innerText(), /כמה עמודים\? בוחרים את כולם/);
  assert.deepEqual(await layoutProblems(page), [], 'scan chooser on a phone');
  assert.equal(await page.locator('input[data-scan-input=camera]').getAttribute('capture'), 'environment');
  assert.equal(await page.locator('input[data-scan-input=pick]').getAttribute('multiple') !== null, true, 'several pages can be chosen at once');
  assert.deepEqual(page.problems, []);
  await context.close();
});

test('review decisions: approve, remove an approved picture from its dish, "not good", and another photo from the review screen', async () => {
  const page = await newPage({ width: 390, height: 800, lang: 'he' });
  await signInUi(page, owner.email);
  await page.locator('[data-stats=ready]').waitFor({ timeout: 20000 });
  const itemId = biz.items[0].id;
  const tile = page.locator(`.tile2[data-item="${itemId}"]`);
  const tileIs = (state) => page.locator(`.tile2[data-item="${itemId}"][data-status=${state}]`);
  await page.goto(app('pictures/' + asset));
  await page.getByText('נראה שחלק מהמנה נחתך בקצה התמונה').waitFor();                 // the pipeline's warning, as a "better photo" hint
  await page.locator('[data-action=approve]').click();
  await tileIs('approved').waitFor({ timeout: 20000 });
  await dbIs(`select asset_id from public.items where id = '${itemId}'`, asset);
  assert.equal(sql(`select count(*) from storage.objects where bucket_id = 'menu-public' and name like '${biz.id}/${asset}/%'`), '3', 'approving copied the three public files');
  // an approved picture in use cannot simply be un-approved (asset_in_use): the app lets the dish go first
  assert.equal((await owner.client.from('assets').update({ status: 'rejected' }).eq('id', asset)).error?.message, 'asset_in_use');
  await tile.locator('button').click();
  await page.locator('[data-sheet=picture] [data-action=view-picture]').click();
  await page.getByText('התמונה הזאת מאושרת ומשויכת למנה.').waitFor();
  await page.locator('[data-action=remove]').click();
  await tileIs('none').waitFor({ timeout: 20000 });
  await dbIs(`select coalesce(i.asset_id::text, 'none') || '|' || a.status from public.items i, public.assets a where i.id = '${itemId}' and a.id = '${asset}'`, 'none|rejected');
  // a new photo, then another one from the review screen, then "not good"
  await tile.locator('button').click();
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-sheet=picture]').getByRole('button', { name: 'הוספת תמונה ל' + LONG[0] }).click()]);
  await fc.setFiles(PHOTOS.plate2);
  await tileIs('review').waitFor({ timeout: 60000 });
  const second = sql(`select id from public.assets where item_id = '${itemId}' and status = 'ready_for_review'`);
  await page.locator('[data-sheet=picture]').getByRole('button', { name: 'בדיקה ואישור' }).click();
  await page.locator('[data-shot=result][data-ready=true]').waitFor({ timeout: 20000 });
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'לנסות תמונה אחרת' }).click()]);
  await fc2.setFiles(PHOTOS.plate);
  await tile.waitFor({ timeout: 20000 });
  await page.waitForFunction(([id, old]) => { const el = document.querySelector(`.tile2[data-item="${id}"]`); return el && el.getAttribute('data-status') === 'review' && el.getAttribute('data-asset') !== old; }, [itemId, second], { timeout: 60000 });
  const third = sql(`select id from public.assets where item_id = '${itemId}' order by created_at desc limit 1`);
  assert.notEqual(third, second);
  await tile.locator('button').click();
  await page.locator('[data-sheet=picture]').getByRole('button', { name: 'בדיקה ואישור' }).click();
  await page.locator('[data-action=reject]').click();
  await dbIs(`select status from public.assets where id = '${third}'`, 'rejected');
  // "not good" on the newest try brings back the earlier one that is still waiting; it can be turned down as well
  await page.locator(`.tile2[data-item="${itemId}"][data-status=review][data-asset="${second}"]`).waitFor({ timeout: 20000 });
  await tile.locator('button').click();
  await page.locator('[data-sheet=picture] [data-action=remove-picture]').click();
  await tileIs('none').waitFor({ timeout: 20000 });
  await dbIs(`select status from public.assets where id = '${second}'`, 'rejected');
  assert.equal(sql(`select count(*) from storage.objects where bucket_id = 'menu-public' and name like '${biz.id}/${third}/%'`), '0', 'a rejected picture never reached the public bucket');
  assert.deepEqual(page.problems, []);
  await page.context().close();
});
