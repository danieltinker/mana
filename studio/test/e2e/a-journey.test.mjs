// (a) The owner's whole journey in version 2, on a phone-sized screen, in Hebrew, against the local stack:
// continue with e-mail (a new account) → name the place → scan a photographed menu (the stand-in reads it) → review →
// add → the editor → illustrations → ONE real photo through the REAL in-browser generator → publish → guests arrive
// (the viewer's own calls) → the dashboard shows the numbers. Then sold-out live, an update, a restored version, offline.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { setup, teardown, newPage, app, viewer, shot, unique, PASSWORD, PHOTOS, anon, sql, OUT, stack, stackConfig, aiCalls, menuPhoto, guests, dbIs, liveSnapshot, tool } from './helpers.mjs';

let page;
const email = unique('journey') + '@example.com';
const slug = unique('olive');
const S = { bizId: '', items: {} };
const item = (name) => { const id = sql(`select id from public.items where business_id = '${S.bizId}' and name_he = '${name}'`); assert.ok(id, 'dish ' + name); return id; };
const saved = () => page.locator('[data-save=saved]').waitFor({ timeout: 15000 });

// JOURNEY_GEN=fake swaps in the stand-in generator while working on the test itself; the run that counts uses the real one
before(async () => { await setup({ gen: process.env.JOURNEY_GEN === 'fake' ? 'fake' : 'real' }); page = await newPage({ width: 390, height: 844, lang: 'he' }); });
after(async () => { await teardown(); });
const noProblems = () => assert.deepEqual(page.problems, [], 'console errors: ' + page.problems.join(' | '));
const publicMenu = async () => (await anon().rpc('public_menu', { p_slug: slug })).data;

test('1 · start: one screen, one "Continue" that makes the account and signs in (no tabs, no e-mail step)', async () => {
  await page.goto(app());
  await page.locator('.start-form').waitFor();
  assert.equal(await page.locator('[role=tab]').count(), 0, 'no sign in / new account tabs');
  assert.equal(await page.locator('[data-provider]').count(), 0, 'no provider is switched on in this config: no buttons');
  assert.equal(await page.locator('.or').count(), 0, 'and no divider');
  assert.equal(await page.locator('form button[type=submit]').count(), 1);
  assert.equal(await page.locator('form button[type=submit]').innerText(), 'המשך');
  assert.match(await page.locator('[data-link=demo]').getAttribute('href'), /\/view\/\?demo=olea$/);
  assert.equal(await page.locator('[data-link=site]').getAttribute('href'), stack.WEB_URL);
  assert.equal(await page.locator('[data-link=forgot]').getAttribute('href'), 'https://wa.me/972542022269');
  await page.locator('input[name=email]').fill('not-an-email');
  await page.locator('input[name=password]').fill('short');
  await page.locator('form button[type=submit]').click();
  await page.getByText('כתובת האימייל לא נראית תקינה').waitFor();
  await page.locator('input[name=email]').fill(email);
  await page.locator('form button[type=submit]').click();
  await page.getByText('לחשבון חדש צריך סיסמה של 8 תווים לפחות').waitFor({ timeout: 15000 });
  assert.equal(sql(`select count(*) from auth.users where email = '${email}'`), '0');
  await page.locator('input[name=password]').fill(PASSWORD);
  assert.ok(!/inbox|תיבת|מייל אישור/i.test(await page.locator('body').innerText()), 'no "check your inbox" copy');
  await shot(page, '01-start-he-390', { fullPage: false });
  await page.locator('form button[type=submit]').click();
  await page.getByRole('heading', { name: 'איך קוראים למקום שלכם?' }).waitFor({ timeout: 20000 });
  assert.equal(sql(`select count(*) from auth.users where email = '${email}'`), '1');
});

test('2 · the place: one field, kind chips, a suggested permanent address checked live; one tap makes the business', async () => {
  assert.equal(await page.locator('.setup-form input[type=text]:visible').count(), 1, 'one field');
  await page.locator('form button[type=submit]').click();
  await page.getByText('כתבו את שם המקום').waitFor();
  await page.locator('[data-field=place]').fill('זית ירוק');
  await page.locator('.addr[data-avail=free]').waitFor();
  assert.equal(await page.locator('[data-slug]').innerText(), 'zit-irok', 'suggested from the name');
  assert.match(await page.locator('.addr-line').innerText(), /halom\.io\/m\/zit-irok/);
  assert.match(await page.locator('.addr-line').innerText(), /קבועה/, 'the word "permanent"');
  assert.deepEqual(await page.locator('.kind').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind'))), ['restaurant', 'cafe', 'bar', 'bakery', 'food_truck', 'other']);
  await page.locator('[data-kind=cafe]').click();
  await page.locator('.addr-edit').click();
  await page.locator('[data-field=slug]').fill('menu');                         // a reserved word
  await page.getByText('הכתובת תפוסה או שמורה').waitFor();
  await page.locator('[data-field=slug]').fill('ab');
  await page.getByText('קצר מדי').waitFor();
  await page.locator('[data-field=slug]').fill(slug);
  await page.locator('.addr[data-avail=free]').waitFor();
  await page.getByText('הכתובת קבועה').waitFor();
  await shot(page, '02-place-he-390', { fullPage: false });
  await page.locator('form button[type=submit]').click();
  await page.locator('[data-ways]').waitFor({ timeout: 20000 });
  S.bizId = sql(`select id from public.businesses where slug = '${slug}'`);
  assert.ok(S.bizId);
  assert.equal(sql(`select name_he || '|' || name_en || '|' || kind || '|' || coalesce(contact_name, '-') || '|' || coalesce(contact_phone, '-') from public.businesses where id = '${S.bizId}'`), 'זית ירוק||cafe|-|-', 'Hebrew letters → name_he; no contact asked');
  assert.equal(sql(`select status from public.entitlements where business_id = '${S.bizId}'`), 'pending');
  // the path: three parts, the first one marked; no tabs yet
  assert.equal(await page.locator('.shell').getAttribute('data-mode'), 'path');
  assert.deepEqual(await page.locator('.pathbar li').evaluateAll((els) => els.map((e) => e.getAttribute('data-step') + ':' + e.getAttribute('data-step-state'))), ['menu:current', 'pictures:todo', 'publish:todo']);
  assert.equal(await page.locator('.nav').count(), 0);
  assert.deepEqual(await page.locator('[data-way]').evaluateAll((els) => els.map((e) => e.getAttribute('data-way'))), ['scan', 'paste', 'type']);
  assert.match(await page.locator('[data-way=scan]').innerText(), /הכי מהיר/);
  noProblems();
});

test('3 · scan a photographed menu: dishes appear while the page is read; rows are corrected in place; "Add" writes them', async () => {
  await stackConfig({ ai: { delayMs: 140 } });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-way=scan]').click()]);
  assert.equal(fc.isMultiple(), true, 'several pages may be chosen');
  await fc.setFiles(await menuPhoto());
  await page.locator('[data-scan=reading]').waitFor({ timeout: 20000 });
  const seen = new Set();
  for (let i = 0; i < 200 && (await page.locator('[data-scan=reading]').count()); i++) { seen.add(await page.locator('[data-scan]').getAttribute('data-scan-count')); await page.waitForTimeout(60); }
  assert.ok(seen.size >= 5, 'the count moved while the page was being read: ' + [...seen].join(','));
  await page.locator('[data-scan=review]').waitFor({ timeout: 30000 });
  assert.equal(await page.locator('[data-scan]').getAttribute('data-scan-count'), '12');
  assert.match(await page.locator('[data-scan-note=translated]').innerText(), /האנגלית תורגמה אוטומטית: כדאי לבדוק/);
  assert.equal(await page.locator('[data-action=scan-add]').innerText(), 'הוספת 12 מנות');
  assert.ok(await page.locator('[data-scan-row] [data-pic=stock]').count() >= 6, 'matched illustrations are shown in the review');
  assert.equal(await page.locator('[data-scan-row] [data-pic=stock] .pic-badge').first().innerText(), 'להמחשה');
  assert.equal(sql(`select count(*) from public.items where business_id = '${S.bizId}'`), '0', 'nothing is saved before "Add"');
  // what the function received: one shrunken JPEG, both languages, the illustration labels
  const calls = await aiCalls();
  const scanCall = calls.find((c) => c.action === 'scan_menu');
  assert.equal(scanCall.media_type, 'image/jpeg');
  assert.ok(scanCall.size && Math.max(scanCall.size.width, scanCall.size.height) === 2400, 'longest side 2400 px: ' + JSON.stringify(scanCall.size));
  assert.ok(scanCall.b64 < 3_600_000, 'base64 under 3.6 million characters: ' + scanCall.b64);
  assert.deepEqual(scanCall.langs, ['he', 'en']); assert.ok(scanCall.stock >= 8, 'stock labels sent: ' + scanCall.stock);
  assert.equal(calls.filter((c) => c.action === 'status').length, 1, 'status was asked once');
  await shot(page, '03-scan-review-he-390', { fullPage: false });
  // corrections in place
  const rows = page.locator('[data-scan-row]');
  await rows.nth(0).locator('[data-scan-field=name]').fill('חומוס הבית');
  await rows.nth(0).locator('[data-scan-field=price]').fill('34');
  await page.getByRole('button', { name: 'הסרת מרק היום' }).click();
  await page.locator('.ssec-name').nth(2).fill('משקאות');
  assert.equal(await page.locator('[data-action=scan-add]').innerText(), 'הוספת 11 מנות');
  await page.locator('[data-action=scan-add]').click();
  await page.locator('section.sec').first().waitFor({ timeout: 20000 });
  assert.match(page.url(), /#\/menu$/);
  assert.equal(sql(`select string_agg(name_he || ':' || name_en || ':' || kind, ',' order by position) from public.categories where business_id = '${S.bizId}'`), 'ראשונות:Starters:food,עיקריות:Mains:food,משקאות:Drinks:drinks');
  assert.equal(sql(`select count(*) from public.items where business_id = '${S.bizId}'`), '11');
  assert.equal(sql(`select name_en || '|' || desc_he || '|' || price_minor || '|' || array_to_string(tags, '+') || '|' || stock_id from public.items where id = '${item('חומוס הבית')}'`), 'Hummus with chickpeas|טחינה, שמן זית ופיתה חמה|3400|vegan|hummus');
  assert.equal(sql(`select stock_id from public.items where id = '${item('פיצה מרגריטה')}'`), 'pizza', 'no hint from the scan: the app\'s own matcher found it');
  assert.equal(sql(`select price_note_he || '|' || price_note_en from public.items where id = '${item('קפה הפוך')}'`), 'קטן 14 / גדול 17|Small 14 / Large 17');
  assert.equal(sql(`select string_agg(i.name_he, ',' order by i.position) from public.items i join public.categories c on c.id = i.category_id where c.name_he = 'ראשונות'`), 'חומוס הבית,סלט קצוץ');
  assert.equal(await page.locator('[data-step=menu]').getAttribute('data-step-state'), 'current');
  await stackConfig({ ai: 'reset' });
  noProblems();
});

test('4 · the editor: quick add with focus kept, paste with review, reorder, the dish sheet in two languages, wine details', async () => {
  const sec = page.locator('section.sec', { hasText: 'עיקריות' });
  await sec.locator('[data-add-in]').click();
  const name = sec.getByPlaceholder('שם המנה'), price = sec.getByPlaceholder('מחיר');
  await name.fill('סלט יווני'); await price.fill('46'); await price.press('Enter');
  await sec.locator('.row', { hasText: 'סלט יווני' }).waitFor();
  assert.ok(await name.evaluate((el) => el === document.activeElement), 'focus is back in the name field');
  await name.fill('משהו'); await price.fill('abc'); await price.press('Enter');
  await sec.getByText('המחיר לא ברור').waitFor();
  await name.fill(''); await price.fill('');
  assert.equal(sql(`select price_minor || '|' || stock_id from public.items where id = '${item('סלט יווני')}'`), '4600|salad', 'a typed dish gets its illustration too');

  // paste a list: review first, nothing saved until confirmed
  await tool(page, 'import');
  await page.locator('[data-sheet=import] [data-way=paste]').click();
  await page.getByLabel('הרשימה').fill('# יינות\nמרלו | 140 | גליל\nשרדונה | שלוש\n# משקאות\nבירה קירין | 28 | בקבוק 330 מ"ל');
  await page.getByRole('button', { name: 'בדיקה' }).click();
  await page.locator('[data-paste-summary]').waitFor();
  assert.match(await page.locator('[data-paste-summary]').innerText(), /2 מנות ב־2 קטגוריות/);
  await page.getByText('שורה 3: המחיר לא ברור').waitFor();
  assert.match(await page.locator('.paste-cat', { hasText: 'משקאות' }).innerText(), /לקטגוריה קיימת/);
  assert.equal(sql(`select count(*) from public.categories where business_id = '${S.bizId}'`), '3', 'review does not save');
  await page.getByRole('button', { name: 'הוספת 2 מנות' }).click();
  await page.locator('[data-sheet=paste]').waitFor({ state: 'detached', timeout: 20000 });
  await page.locator('section.sec', { hasText: 'יינות' }).waitFor();
  assert.equal(sql(`select string_agg(name_he || ':' || kind, ',' order by position) from public.categories where business_id = '${S.bizId}'`), 'ראשונות:food,עיקריות:food,משקאות:drinks,יינות:wine');
  assert.equal(sql(`select desc_he from public.items where id = '${item('בירה קירין')}'`), 'בקבוק 330 מ"ל');

  // reorder with the keyboard-operable buttons (shown in "reorder")
  await tool(page, 'reorder');
  await page.getByRole('button', { name: 'להעלות את סלט קצוץ' }).click();
  await saved();
  assert.equal(sql(`select string_agg(i.name_he, ',' order by i.position) from public.items i join public.categories c on c.id = i.category_id where c.name_he = 'ראשונות'`), 'סלט קצוץ,חומוס הבית');
  await page.getByRole('button', { name: 'להוריד את ראשונות' }).focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('section.sec h2')?.textContent === 'עיקריות');
  await saved();
  assert.equal(sql(`select string_agg(name_he, ',' order by position) from public.categories where business_id = '${S.bizId}'`), 'עיקריות,ראשונות,משקאות,יינות');
  await page.getByRole('button', { name: 'להעלות את ראשונות' }).click();
  await saved();
  await tool(page, 'reorder');
  await shot(page, '04-menu-he-390');

  // the dish sheet: one language at a time, the rest behind "More"
  await page.getByRole('link', { name: 'עריכת שקשוקה' }).click();
  const sheet = page.locator('[data-sheet=dish]');
  await sheet.waitFor();
  assert.equal(await sheet.locator('[data-field=name_he]').inputValue(), 'שקשוקה');
  assert.equal(await sheet.locator('[data-field=name_en]').count(), 0, 'one language at a time');
  await sheet.locator('[data-field=price]').fill('54.9');
  await sheet.locator('[data-field=desc_he]').fill('ביצים ברוטב עגבניות חריף, עם לחם הבית');
  await sheet.getByRole('button', { name: 'English' }).click();
  assert.equal(await sheet.locator('[data-field=name_en]').inputValue(), 'Shakshuka');
  await sheet.locator('[data-field=desc_en]').fill('Eggs in a spicy tomato sauce, with house bread');
  await sheet.getByRole('button', { name: 'עברית' }).click();
  assert.equal(await sheet.locator('.tagchip:visible').count(), 0, 'labels are behind "More"');
  await sheet.locator('[data-action=more]').click();
  await sheet.locator('[data-field=price_note_he]').fill('לזוג 98');
  await sheet.locator('label.tagchip', { hasText: 'ללא גלוטן' }).click();
  await sheet.locator('[data-field=allergens_he]').fill('מכיל ביצים וגלוטן');
  await dbIs(`select allergens_he from public.items where id = '${item('שקשוקה')}'`, 'מכיל ביצים וגלוטן');
  assert.equal(sql(`select desc_he || '|' || desc_en || '|' || price_minor || '|' || price_note_he || '|' || array_to_string(tags, '+') || '|' || allergens_he from public.items where id = '${item('שקשוקה')}'`),
    'ביצים ברוטב עגבניות חריף, עם לחם הבית|Eggs in a spicy tomato sauce, with house bread|5490|לזוג 98|vegetarian+spicy+gf|מכיל ביצים וגלוטן');
  await sheet.locator('[data-field=price]').fill('5x');
  await sheet.getByText('המחיר לא ברור').waitFor();
  await sheet.locator('[data-field=price]').fill('54.90');
  await shot(page, '05-dish-sheet-he-390', { fullPage: false });
  await sheet.locator('[data-action=done]').click();
  await page.getByRole('link', { name: 'עריכת מרלו' }).click();
  await sheet.locator('[data-action=more]').click();
  await sheet.locator('[data-detail="wine.producer"]').fill('יקב הגליל');
  await sheet.locator('[data-detail="wine.vintage"]').fill('2021');
  await sheet.locator('[data-detail="wine.color"]').selectOption('red');
  await sheet.getByText('הערות טעימה').click();
  await sheet.locator('[data-detail="wine.notes.body"]').fill('מלא');
  await dbIs(`select details->'wine'->'notes'->>'body' from public.items where id = '${item('מרלו')}'`, 'מלא');
  assert.deepEqual(JSON.parse(sql(`select details from public.items where id = '${item('מרלו')}'`)), { wine: { producer: 'יקב הגליל', vintage: '2021', color: 'red', notes: { body: 'מלא' } } });
  await page.keyboard.press('Escape');
  await sheet.waitFor({ state: 'detached' });
  noProblems();
});

test('5 · pictures: illustrations on by default with their badge, the switch, the picker; ONE real photo through the real generator', async () => {
  await page.locator('[data-next=pictures]').click();
  await page.locator('.tiles2').first().waitFor();
  assert.equal(await page.locator('[data-step=pictures]').getAttribute('data-step-state'), 'current');
  assert.equal(await page.locator('[data-step=menu]').getAttribute('data-step-state'), 'done');
  assert.equal(await page.locator('[data-illus]').getAttribute('data-illus'), 'on');
  assert.match(await page.locator('.illus').innerText(), /האורחים רואים אותם מסומנים "להמחשה" עד שתוסיפו תמונה משלכם\./);
  const starters = ['hummus', 'salad', 'shakshuka', 'burger', 'pizza', 'pasta', 'orange-juice'];
  const placed = () => sql(`select coalesce(string_agg(distinct stock_id, ',' order by stock_id), '') from public.items where business_id = '${S.bizId}' and stock_id is not null`).split(',').filter(Boolean);
  for (const id of starters) assert.ok(placed().includes(id), id + ' is in use: ' + placed());
  const everyStarter = `select count(distinct stock_id) from public.items where business_id = '${S.bizId}' and stock_id in ('${starters.join("','")}')`;
  const tiles = await page.locator('.tile2').count();
  assert.equal(tiles, Number(sql(`select count(*) from public.items where business_id = '${S.bizId}'`)));
  assert.equal(await page.locator('.tile2[data-status=stock] .pic-badge').count(), await page.locator('.tile2[data-status=stock]').count(), 'every illustration carries the badge');
  // off clears them, on fills them in again
  await page.getByRole('switch', { name: 'איורים למנות בלי תמונה' }).click();
  await page.locator('[data-illus=off]').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.tile2[data-status=stock]').length === 0);
  await dbIs(`select count(*) from public.items where business_id = '${S.bizId}' and stock_id is not null`, '0');
  await page.getByRole('switch', { name: 'איורים למנות בלי תמונה' }).click();
  await page.locator('[data-illus=on]').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.tile2[data-status=stock]').length >= 7);
  await dbIs(everyStarter, String(starters.length));
  await shot(page, '06-pictures-he-390');
  // the picker: another illustration, then none
  const sal = item('סלט יווני');
  await page.locator(`.tile2[data-item="${sal}"] button`).click();
  await page.locator('[data-action=choose-illustration]').click();
  const picker = page.locator('[data-sheet=illustrations]');
  await picker.locator('[data-stock=salad][aria-pressed=true]').waitFor();
  await picker.getByPlaceholder('חיפוש').fill('פיצ');
  await page.waitForFunction(() => document.querySelector('[data-sheet=illustrations] .pickgroup [data-stock]')?.getAttribute('data-stock') === 'pizza');
  await picker.locator('[data-stock=pizza]').click();
  await page.locator(`[data-item-actions="${sal}"][data-status=stock]`).waitFor();
  await dbIs(`select stock_id from public.items where id = '${sal}'`, 'pizza');
  await page.locator('[data-action=no-picture]').click();
  await page.locator(`[data-item-actions="${sal}"][data-status=none]`).waitFor();
  await dbIs(`select coalesce(stock_id, 'none') from public.items where id = '${sal}'`, 'none');
  await page.keyboard.press('Escape');

  // one photo of the owner's own, through the real generator, with real download progress in one line
  const shak = item('שקשוקה');
  await page.locator(`.tile2[data-item="${shak}"] button`).click();
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'הוספת תמונה לשקשוקה' }).click()]);
  await fc.setFiles(PHOTOS.plate);
  await page.locator('[data-studio=loading]').first().waitFor({ timeout: 30000 });
  const seen = new Set();
  for (let i = 0; i < 80 && (await page.locator('[data-studio=loading]').count()); i++) {
    const m = /(\d+) מתוך (\d+)MB/.exec(await page.locator('[data-studio=loading]').first().innerText().catch(() => ''));
    if (m) { seen.add(m[1]); assert.equal(m[2], '72'); }
    await page.waitForTimeout(120);
  }
  assert.ok(seen.size >= 2, 'download progress moved through several values: ' + [...seen].join(','));
  await page.keyboard.press('Escape');
  await page.locator(`.tile2[data-item="${shak}"][data-status=review]`).waitFor({ timeout: 600000 });       // the real generator in software on a busy 2-core machine
  const assetId = sql(`select id from public.assets where item_id = '${shak}'`);
  assert.match(sql(`select status || '|' || kind || '|' || relief_class || '|' || attempts || '|' || (provenance->>'pipeline') from public.assets where id = '${assetId}'`), /^ready_for_review\|relief\|(flat|low|medium|tall)\|1\|halom-relief\/1$/);
  assert.equal(sql(`select count(*) from storage.objects where bucket_id = 'menu-public' and name like '${S.bizId}/${assetId}/%'`), '0', 'nothing public before approval');
  await page.locator(`.tile2[data-item="${shak}"] button`).click();
  await page.locator('[data-sheet=picture]').getByRole('button', { name: 'בדיקה ואישור' }).click();
  await page.locator('canvas[data-shot=result][data-ready=true]').waitFor({ timeout: 30000 });
  const alpha = await page.locator('canvas[data-shot=result]').evaluate((c) => { const x = c.getContext('2d'); return [x.getImageData(2, 2, 1, 1).data[3], x.getImageData(256, 256, 1, 1).data[3]]; });
  assert.ok(alpha[0] < 20 && alpha[1] > 235, 'the result is shown as a real cut-out (clear corner, solid centre): ' + alpha);
  assert.ok(!/digital twin|תאום דיגיטלי|מדויק לחלוטין/.test(await page.locator('main').innerText()));
  await shot(page, '07-review-he-390');
  await page.locator('[data-action=approve]').click();
  await page.getByText('אושר. התמונה תופיע לאורחים בפרסום הבא.').waitFor({ timeout: 30000 });
  await page.locator(`.tile2[data-item="${shak}"][data-status=approved]`).waitFor({ timeout: 20000 });
  assert.equal(sql(`select a.status || '|' || (i.asset_id = a.id) || '|' || (a.reviewed_at is not null) from public.assets a join public.items i on i.id = a.item_id where a.id = '${assetId}'`), 'approved|true|true', 'approve_asset did both in one call');
  assert.equal(sql(`select string_agg(split_part(name, '/', 3), ',' order by name) from storage.objects where bucket_id = 'menu-public' and name like '${S.bizId}/${assetId}/%'`), 'aux.png,color.jpg,thumb.jpg');
  assert.equal(await page.locator(`.tile2[data-item="${shak}"] .pic-badge`).count(), 0, 'its own photo has no illustration badge');
  await page.locator(`.tile2[data-item="${shak}"]`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await shot(page, '07b-pictures-own-photo-he-390', { fullPage: false });
  noProblems();
});

test('6 · publish: the real viewer shows the draft, quick style picks, one button; then the QR, the link and the optional phone', async () => {
  await page.locator('[data-next=publish]').click();
  await page.locator('[data-preview=shown]').waitFor({ timeout: 40000 });
  assert.equal(await page.locator('[data-step=publish]').getAttribute('data-step-state'), 'current');
  const frame = page.frameLocator('.phone iframe');
  await frame.locator('body').filter({ hasText: 'זית ירוק' }).waitFor({ timeout: 40000 });
  await frame.locator('body').filter({ hasText: 'חומוס הבית' }).waitFor({ timeout: 20000 });      // the first section's dishes
  await page.locator('[data-accent="#7fd6a4"]').click();
  await page.locator('[data-surface=marble]').click();
  await page.locator('[data-surface=marble][aria-checked=true]').waitFor();
  await dbIs(`select b.accent || '|' || m.surface from public.businesses b join public.menus m on m.business_id = b.id where b.id = '${S.bizId}'`, '#7fd6a4|marble');
  assert.match(await page.locator('.sticky').innerText(), /30 ימי הניסיון מתחילים עכשיו/);
  assert.equal((await publicMenu()).state, 'not_found', 'a preview publishes nothing');
  await shot(page, '08-publish-he-390');
  await page.locator('[data-action=publish]').click();
  await page.locator('[data-published-rev="1"]').waitFor({ timeout: 20000 });
  await page.getByRole('heading', { name: 'התפריט באוויר' }).waitFor();
  assert.equal(await page.locator('[data-short-link]').innerText(), 'https://halom.io/m/' + slug, 'the link shown has no ?t=1');
  await page.locator('img[data-qr]').waitFor();
  assert.equal(await page.locator('.templink, [data-temp-link]').count(), 0, 'no "temporary address" notice');
  assert.equal(await page.locator('[data-action=open-menu]').getAttribute('href'), 'https://halom.io/m/' + slug);
  for (const a of await page.locator('a[target=_blank]').evaluateAll((els) => els.map((e) => [e.href, e.rel]))) { assert.match(a[1], /noopener/); assert.match(a[0], /^https?:\/\//); }
  assert.equal(await page.locator('[data-field=contact_phone]').count(), 0, 'the phone is one quiet line until the owner asks for the field');
  await page.locator('[data-action=add-phone]').click();
  await page.locator('[data-field=contact_phone]').fill('050-123 4567');
  await dbIs(`select coalesce(contact_phone, '') from public.businesses where id = '${S.bizId}'`, '050-123 4567');
  assert.match(sql(`select status || '|' || (trial_ends_at > now() + interval '29 days') from public.entitlements where business_id = '${S.bizId}'`), /^trialing\|true$/);
  await shot(page, '09-published-he-390');

  // what a guest gets: own picture as a relief, placeholders as {state:'stock'}, everything else as text
  const snap = liveSnapshot(S.bizId);                        // read without counting a visit: the dashboard must still be empty in the next test
  assert.deepEqual([snap.v, snap.slug, snap.revision, snap.theme.surface, snap.theme.accent, snap.business.kind], [1, slug, 1, 'marble', '#7fd6a4', 'cafe']);
  assert.deepEqual(snap.categories.map((c) => [c.name.he, c.kind, c.items.length]), [['ראשונות', 'food', 2], ['עיקריות', 'food', 7], ['משקאות', 'drinks', 4], ['יינות', 'wine', 1]]);
  const all = snap.categories.flatMap((c) => c.items);
  const shak = all.find((i) => i.name.he === 'שקשוקה');
  assert.deepEqual([shak.price.amount, shak.price.note.he, shak.tags, shak.asset.state, shak.name.en], [5490, 'לזוג 98', ['vegetarian', 'spicy', 'gf'], 'relief', 'Shakshuka']);
  for (const k of ['color', 'aux', 'thumb']) assert.equal((await fetch(shak.asset[k])).status, 200, k + ' is publicly readable');
  assert.deepEqual(all.find((i) => i.name.he === 'חומוס הבית').asset, { state: 'stock', id: 'hummus' });
  assert.equal(all.find((i) => i.name.he === 'סלט יווני').asset, null, 'the dish the owner set to "no picture"');
  assert.equal(all.find((i) => i.name.he === 'מרלו').details.wine.producer, 'יקב הגליל');
  noProblems();
});

test('6h · the QR code (PNG and SVG) carries ?t=1; the table card prints on one A6 or A5 sheet', async () => {
  await page.locator('[data-action=table-card]').click();
  await page.locator('[data-table-card]').waitFor();
  const want = 'https://halom.io/m/' + slug + '?t=1';
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-qr-png]').click()]);
  const pngPath = path.join(OUT, 'qr.png'); await dl.saveAs(pngPath);
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  assert.ok(png.width >= 1500, 'print quality: ' + png.width + ' px');
  assert.equal(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data, want);
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator('[data-qr-svg]').click()]);
  const svgPath = path.join(OUT, 'qr.svg'); await dl2.saveAs(svgPath);
  const svg = fs.readFileSync(svgPath, 'utf8');
  assert.match(svg, /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  const pixels = await page.evaluate(async (svgText) => {
    const img = new Image(); img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText); await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 600); x.drawImage(img, 0, 0, 600, 600);
    return Array.from(x.getImageData(0, 0, 600, 600).data);
  }, svg);
  assert.equal(jsQR(new Uint8ClampedArray(pixels), 600, 600)?.data, want);
  // the QR on the success screen itself is the same code
  const shown = await page.evaluate(async () => {
    const img = document.querySelector('img[data-qr]'); await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 600, 600); x.drawImage(img, 0, 0, 600, 600);
    return Array.from(x.getImageData(0, 0, 600, 600).data);
  });
  assert.equal(jsQR(new Uint8ClampedArray(shown), 600, 600)?.data, want);
  const card = await page.locator('[data-table-card]').innerText();
  assert.match(card, /זית ירוק/); assert.match(card, /סרקו לתפריט/); assert.match(card, /Scan for the menu/); assert.match(card, /Menu by Mana · halom\.io/);
  await shot(page, '10-qr-sheet-he-390', { fullPage: false });
  // the real button: the app leaves the print layout, a copy of the card fills one A6 sheet (105 × 148 mm), then everything goes back
  await page.evaluate(() => { window.print = () => { window.__printed = document.documentElement.dataset.print; }; });
  await page.locator('[data-print=A6]').click();
  assert.equal(await page.evaluate(() => window.__printed), 'A6');
  await page.emulateMedia({ media: 'print' });
  const vis = await page.evaluate(() => ({ app: getComputedStyle(document.getElementById('app')).display, card: getComputedStyle(document.querySelector('.print-root .tcard')).position, text: document.querySelector('.print-root').innerText }));
  assert.equal(vis.app, 'none'); assert.equal(vis.card, 'fixed'); assert.match(vis.text, /זית ירוק/); assert.match(vis.text, /Scan for the menu/);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  fs.writeFileSync(path.join(OUT, 'table-card-a6.pdf'), pdf);
  const text = pdf.toString('latin1');
  assert.equal((text.match(/\/Type\s*\/Page[^s]/g) || []).length, 1, 'exactly one page');
  const box = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(text);
  assert.ok(box && Math.abs(Number(box[1]) - 297.6) < 2 && Math.abs(Number(box[2]) - 419.5) < 2, 'A6 sheet: ' + (box && box.slice(1)));
  await page.emulateMedia({ media: null });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.deepEqual(await page.evaluate(() => [document.documentElement.dataset.print, document.querySelectorAll('.print-root').length]), [undefined, 0]);
  await page.locator('[data-print=A5]').click();
  const a5 = (await page.pdf({ preferCSSPageSize: true })).toString('latin1');
  const box5 = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(a5);
  assert.ok(box5 && Math.abs(Number(box5[1]) - 419.5) < 2 && Math.abs(Number(box5[2]) - 595.3) < 2 && (a5.match(/\/Type\s*\/Page[^s]/g) || []).length === 1, 'one A5 sheet: ' + (box5 && box5.slice(1)));
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.keyboard.press('Escape');
});

test('7 · after publishing, Home is a dashboard: quiet outlines before any guest, then the numbers of real visits', async () => {
  await page.locator('[data-action=to-home]').click();
  await page.locator('[data-stats=empty]').waitFor({ timeout: 20000 });
  assert.equal(await page.locator('.shell').getAttribute('data-mode'), 'tabs');
  assert.equal(await page.locator('.pathbar, .steplist').count(), 0, 'the path is gone, and there is no stepper on Home');
  assert.deepEqual(await page.locator('.nav [data-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab'))), ['home', 'menu', 'style']);
  assert.equal(await page.locator('[data-dash-empty]').innerText(), 'המספרים יופיעו אחרי הסריקות הראשונות.');
  assert.equal(await page.locator('[data-n=views7]').innerText(), '–');
  assert.equal(await page.locator('.dash.is-ghost [data-tile]').count(), 3, 'the same three tiles, as outlines');
  assert.equal(await page.locator('[data-pub-state]').getAttribute('data-pub-state'), 'live');
  assert.ok(await page.locator('[data-nudge]').count() <= 2, 'at most two nudges');
  assert.match(await page.locator('[data-nudge=photos]').innerText(), /ל־\d+ מנות אין תמונה/);
  assert.match(await page.locator('[data-plan=trialing]').innerText(), /ניסיון: נשארו 30 ימים/);
  await shot(page, '11-dashboard-empty-he-390');

  // guests arrive: exactly the calls the diner viewer makes
  const visits = [];
  for (let i = 0; i < 20; i++) visits.push({ lang: i < 5 ? 'en' : 'he', src: i < 12 ? 'qr' : 'link' });
  await guests(slug, visits, [[item('שקשוקה'), 'open', 9], [item('חומוס הבית'), 'open', 6], [item('פיצה מרגריטה'), 'open', 3], [item('שקשוקה'), 'add', 4], [item('חומוס הבית'), 'add', 1]]);
  await page.reload();
  await page.locator('[data-stats=ready]').waitFor({ timeout: 20000 });
  assert.equal(await page.locator('[data-n=views7]').innerText(), '20');
  assert.equal(await page.locator('[data-n=views30]').innerText(), '20');
  assert.equal(await page.locator('[data-n=change]').count(), 0, 'no week before to compare with');
  assert.equal(await page.locator('[data-n=english]').innerText(), '25%');
  assert.equal(await page.locator('[data-n=qr]').innerText(), '60%');
  assert.equal(await page.locator('[data-n=adds]').innerText(), '5');
  assert.deepEqual(await page.locator('[data-top]').evaluateAll((els) => els.map((e) => e.querySelector('.top-name').textContent + '=' + e.querySelector('.top-n').textContent)), ['שקשוקה=9', 'חומוס הבית=6', 'פיצה מרגריטה=3']);
  assert.match(await page.locator('[data-n=peak]').innerText(), /^\d\d:00–\d\d:00$/);
  const bars = await page.locator('[data-chart=hours] [data-hour]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-v'))));
  assert.equal(bars.length, 24); assert.equal(bars.reduce((a, b) => a + b, 0), 20, 'the hour bars carry the 20 visits');
  assert.ok((await page.locator('[data-chart=spark] .spark-line').getAttribute('d')).length > 60, 'a drawn 30-day line');
  assert.equal(await page.locator('.dash.is-ghost').count(), 0);
  await shot(page, '12-dashboard-he-390');

  // the viewer itself opens the published menu (this visit counts too)
  const diner = await newPage({ width: 390, height: 844, lang: 'he' });
  await diner.goto(viewer('?m=' + slug + '&test=1'));
  await diner.waitForFunction(() => document.body.innerText.includes('זית ירוק') && document.body.innerText.includes('חומוס הבית'), null, { timeout: 40000 });
  assert.match(await diner.locator('body').innerText(), /34/);
  await diner.context().close();
  noProblems();
});

test('8 · sold out today: one switch, live for guests without publishing again', async () => {
  await page.locator('[data-act=soldout]').click();
  const row = page.locator(`[data-soldout-item="${item('שקשוקה')}"]`);
  await row.getByRole('switch').click();
  await dbIs(`select available from public.items where id = '${item('שקשוקה')}'`, 'f');
  let pm = await publicMenu();
  assert.equal(pm.snapshot.revision, 1, 'no new revision');
  assert.equal(pm.snapshot.categories.flatMap((c) => c.items).find((i) => i.name.he === 'שקשוקה').available, false);
  assert.equal(sql(`select count(*) from public.menu_revisions where business_id = '${S.bizId}'`), '1');
  await row.getByRole('switch').click();
  await page.waitForFunction((id) => document.querySelector(`[data-soldout-item="${id}"] [role=switch]`)?.getAttribute('aria-checked') === 'false', item('שקשוקה'));
  await dbIs(`select available from public.items where id = '${item('שקשוקה')}'`, 't');
  pm = await publicMenu();
  assert.equal(pm.snapshot.categories.flatMap((c) => c.items).find((i) => i.name.he === 'שקשוקה').available, true);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-pub-state]').getAttribute('data-pub-state'), 'live', 'sold out is not a change that needs publishing');
});

test('9 · an edit turns the header button into "Update"; a later version can be put back; offline keeps the tabs', async () => {
  await page.locator('[data-tab=menu]').click();
  await page.getByRole('link', { name: 'עריכת שקשוקה' }).click();
  await page.locator('[data-sheet=dish] [data-field=price]').fill('58');
  await dbIs(`select price_minor from public.items where id = '${item('שקשוקה')}'`, '5800');
  await page.locator('[data-sheet=dish] [data-action=done]').click();
  await page.locator('[data-pub-state=changes]').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('[data-pub-state]').innerText(), 'עדכון');
  assert.equal((await publicMenu()).snapshot.categories.flatMap((c) => c.items).find((i) => i.name.he === 'שקשוקה').price.amount, 5490, 'edits are private until published');
  await page.locator('[data-pub-state]').click();
  await page.locator('[data-diff=some]').waitFor({ timeout: 15000 });
  assert.match(await page.locator('[data-diff]').innerText(), /מנה אחת עודכנה/);
  assert.equal(await page.locator('[data-action=publish]').innerText(), 'עדכון');
  await page.locator('[data-action=publish]').click();
  await page.locator('[data-published-rev="2"]').waitFor({ timeout: 20000 });
  await page.getByRole('heading', { name: 'התפריט עודכן' }).waitFor();
  assert.equal(await page.locator('[data-short-link]').innerText(), 'https://halom.io/m/' + slug, 'same link');
  assert.equal((await publicMenu()).snapshot.categories.flatMap((c) => c.items).find((i) => i.name.he === 'שקשוקה').price.amount, 5800);
  await page.locator('[data-action=to-home]').click();
  await page.locator('[data-pub-state=live]').waitFor({ timeout: 15000 });
  await page.locator('[data-pub-state]').click();
  await page.locator('[data-diff=none]').waitFor({ timeout: 15000 });
  assert.ok(await page.locator('[data-action=publish]').isDisabled(), 'nothing to update');
  await page.locator('.revs-block summary').click();
  await page.locator('[data-rev="1"]').getByRole('button', { name: 'להחזיר את הגרסה הזאת' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'להחזיר את הגרסה הזאת' }).click();
  await page.getByText('גרסה 1 באוויר עכשיו.').waitFor({ timeout: 15000 });
  let pm = await publicMenu();
  assert.deepEqual([pm.snapshot.revision, pm.snapshot.categories.flatMap((c) => c.items).find((i) => i.name.he === 'שקשוקה').price.amount], [1, 5490]);
  assert.equal(sql(`select price_minor from public.items where id = '${item('שקשוקה')}'`), '5800', 'the draft keeps the newer edit');
  await page.locator('[data-rev="1"] .badge-ok').waitFor();
  await page.locator('[data-pub-state=changes]').waitFor({ timeout: 15000 });
  await shot(page, '13-publish-versions-he-390');
  await page.locator('[data-action=unpublish]').click();
  await page.locator('dialog[open]').getByRole('button', { name: 'להוריד את התפריט מהאוויר' }).click();
  await page.getByText('התפריט ירד מהאוויר.').waitFor({ timeout: 15000 });
  assert.equal((await publicMenu()).state, 'not_found');
  await page.locator('[data-pub-state=off]').waitFor();
  await page.locator('[data-tab=home]').click();
  await page.locator('[data-live-state=off]').waitFor();
  assert.equal(await page.locator('.shell').getAttribute('data-mode'), 'tabs', 'the path does not come back');
  assert.equal(await page.locator('.pathbar').count(), 0);
  noProblems();
});
