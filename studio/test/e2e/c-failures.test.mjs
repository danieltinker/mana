// (c) Failure paths and (d) resume after a reload. Each one must end in plain words and a way forward, never a dead end.
// The generator here is the light stand-in (test/stack/fake-gen): these tests are about the app around it. The scanner
// and the "suggest from the photo" helper talk to the stand-in of menus-ai, switched into each of its failure modes.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { setup, teardown, newPage, app, viewer, account, anon, seedBusiness, signInUi, sql, shot, PHOTOS, OUT, stack, stackConfig, aiCalls, menuPhoto, dbIs, unique, PASSWORD } from './helpers.mjs';

let owner, biz, page;
const item = (i) => biz.items[i].id;
const tile = (i) => page.locator(`.tile2[data-item="${item(i)}"]`);
const sheet = () => page.locator('[data-sheet=picture]');
const openPic = async (i, p = page) => { await p.locator(`.tile2[data-item="${item(i)}"] button`).click(); await p.locator('[data-sheet=picture]').waitFor(); };
const closeSheet = async (p = page) => { if (await p.locator('dialog[open]').count()) { await p.keyboard.press('Escape'); await p.locator('dialog[open]').waitFor({ state: 'detached' }); } };
/** Open the dish's picture sheet and choose a file for it. The sheet stays open and says what is happening. */
const pick = async (i, file, p = page) => {
  await openPic(i, p);
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('[data-sheet=picture]').getByRole('button', { name: /^(הוספת תמונה|תמונה אחרת) ל/ }).click()]);
  await fc.setFiles(file);
};
const asset = (i, cols = 'status, error_code, attempts, kind') => sql(`select row_to_json(t) from (select ${cols} from public.assets where item_id = '${item(i)}' order by created_at desc limit 1) t`);
// Signed in AND settled on the first screen: the shell first draws with an empty route and then moves to the owner's place in
// the path (or Home). A test that navigates in between loses to that move (seen once the machine was idle and the test was fast).
const signedIn = async (p) => { await p.locator('.shell').waitFor({ timeout: 20000 }); await p.locator('main h1').first().waitFor({ timeout: 20000 }); };
const allowMany = () => sql(`update public.app_config set value = '{"scan_menu": 500, "describe_dish": 500}' where key = 'ai_limits'`);

before(async () => {
  await setup({ gen: 'fake' });
  allowMany();
  owner = await account();
  biz = await seedBusiness(owner.client, { nameHe: 'מטבח הכשלים', nameEn: 'Failure Kitchen', items: [['צלחת ריקה', 'Empty plate', 1000], ['קובץ שבור', 'Broken file', 2000], ['המבורגר', 'Classic Burger', 6800], ['שקשוקה', 'Shakshuka', 5400], ['בירה', 'Kirin Beer', 2800], ['סלט', 'Salad', 3000]] });
  page = await newPage({ width: 390, height: 844 });
  await signInUi(page, owner.email);
  await signedIn(page);
});
after(async () => { await teardown(); });

test('a photo with no dish in it: "we could not find a dish", the original is kept, Try again is offered', async () => {
  await page.goto(app('pictures'));
  await pick(0, PHOTOS.blank);
  await tile(0).and(page.locator('[data-status=failed]')).waitFor({ timeout: 60000 });
  assert.match(await sheet().locator('.row-err').innerText(), /לא מצאנו מנה בתמונה/);
  assert.deepEqual(JSON.parse(asset(0)), { status: 'failed', error_code: 'no_dish', attempts: 1, kind: 'relief' });
  assert.equal(sql(`select count(*) from storage.objects where bucket_id = 'menu-private' and name like '${biz.id}/%/original.%'`), '1', 'the original stays');
  assert.ok(await sheet().getByRole('button', { name: 'לנסות שוב' }).isVisible());
  assert.ok(await sheet().getByRole('button', { name: 'להשתמש בתמונה כמו שהיא' }).isVisible());
  await shot(page, '22-picture-failed-he-390', { fullPage: false });
  await closeSheet();
  assert.match(await tile(0).innerText(), /לא הצליח/, 'the tile says so too');
});

test('a file that is not a picture: refused in plain words; a corrupt JPEG fails as bad_image with no pointless retry', async () => {
  const txt = path.join(OUT, 'notes.txt'); fs.writeFileSync(txt, 'this is not a picture');
  const before = sql(`select count(*) from public.assets where business_id = '${biz.id}'`);
  await pick(1, txt);
  await sheet().getByText('לא הצלחנו לקרוא את הקובץ הזה כתמונה').waitFor();
  assert.equal(sql(`select count(*) from public.assets where business_id = '${biz.id}'`), before, 'no row is created for a file we cannot read');
  await closeSheet();
  const broken = path.join(OUT, 'broken.jpg'); fs.writeFileSync(broken, Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4000, 7)]));
  await pick(1, broken);
  await tile(1).and(page.locator('[data-status=failed]')).waitFor({ timeout: 60000 });
  assert.match(await sheet().locator('.row-err').innerText(), /לא הצלחנו לקרוא את הקובץ הזה כתמונה/);
  assert.equal(JSON.parse(asset(1)).error_code, 'bad_image');
  assert.equal(await sheet().getByRole('button', { name: 'לנסות שוב' }).count(), 0);
  await closeSheet();
});

test('the upload fails (connection drops): said plainly; Try again uploads the same photo and finishes', async () => {
  await page.route('**/storage/v1/object/menu-private/**', (r) => (r.request().method() === 'POST' ? r.abort('connectionfailed') : r.continue()));
  await pick(2, PHOTOS.plate2);
  await tile(2).and(page.locator('[data-status=failed]')).waitFor({ timeout: 30000 });
  assert.match(await sheet().locator('.row-err').innerText(), /החיבור נפל באמצע|ההעלאה לא הצליחה/);
  assert.equal(JSON.parse(asset(2, 'status, original_path')).original_path, null);
  await page.unroute('**/storage/v1/object/menu-private/**');
  await sheet().getByRole('button', { name: 'לנסות שוב' }).click();
  await tile(2).and(page.locator('[data-status=review]')).waitFor({ timeout: 60000 });
  const a = JSON.parse(asset(2, 'status, attempts, original_path, relief_class'));
  assert.equal(a.status, 'ready_for_review'); assert.equal(a.attempts, 1, 'the failed upload never reached "processing", so it cost no attempt'); assert.ok(a.original_path);
  await closeSheet();
});

test('cancel while a photo is being worked on: it stops, says so, and can be tried again', async () => {
  await page.evaluate(() => { window.__fakeGenSlow = 8; });
  await pick(3, PHOTOS.plate);
  await tile(3).and(page.locator('[data-status=working]')).waitFor();
  await page.waitForFunction(() => /מפרידים|קוראים|מודדים/.test(document.querySelector('[data-sheet=picture]')?.textContent || ''), null, { timeout: 30000 });
  await sheet().getByRole('button', { name: 'ביטול' }).click();
  await tile(3).and(page.locator('[data-status=failed]')).waitFor({ timeout: 30000 });
  assert.match(await sheet().locator('.row-err').innerText(), /בוטל/);
  assert.equal(JSON.parse(asset(3)).error_code, 'aborted');
  await page.evaluate(() => { window.__fakeGenSlow = 1; });
});

test('five tries per picture: the sixth is refused by the database, explained, and the photo itself is offered instead', async () => {
  const id = sql(`select id from public.assets where item_id = '${item(3)}'`);
  sql(`alter table public.assets disable trigger assets_guard; update public.assets set attempts = 5 where id = '${id}'; alter table public.assets enable trigger assets_guard`);
  await sheet().getByRole('button', { name: 'לנסות שוב' }).click();                 // the page still believes there are tries left
  await sheet().getByText('ניסינו את התמונה הזאת חמש פעמים').waitFor({ timeout: 30000 });
  assert.deepEqual(JSON.parse(asset(3, 'status, attempts')), { status: 'failed', attempts: 5 });
  assert.equal(await sheet().getByRole('button', { name: 'לנסות שוב' }).count(), 0, 'no more "Try again"');
  await page.reload();
  await page.locator('.tiles2').first().waitFor({ timeout: 20000 });
  await openPic(3);
  await sheet().getByText('ניסינו את התמונה הזאת חמש פעמים').waitFor({ timeout: 15000 });   // also after a reload, from the row itself
  await sheet().getByRole('button', { name: 'להשתמש בתמונה כמו שהיא' }).click();
  await page.locator('[data-result=photo]').waitFor({ timeout: 30000 });
  assert.match(await page.locator('main').innerText(), /תמונה רגילה/);
  assert.equal(await page.getByRole('button', { name: 'לנסות שוב תבליט' }).count(), 0, 'the relief is not offered again after the limit');
  await page.locator('[data-action=approve]').click();
  await page.getByText('אושר. התמונה תופיע לאורחים בפרסום הבא.').waitFor({ timeout: 20000 });
  assert.deepEqual(JSON.parse(asset(3, 'status, kind, aux_path')), { status: 'approved', kind: 'photo', aux_path: null });
  const snap = (await owner.client.rpc('preview_snapshot', { p_business: biz.id })).data;
  const it = snap.categories[0].items.find((x) => x.id === item(3));
  assert.deepEqual(Object.keys(it.asset).sort(), ['color', 'state', 'thumb']); assert.equal(it.asset.state, 'photo');
  await tile(3).and(page.locator('[data-status=approved]')).waitFor();
  await openPic(3);
  await sheet().getByText('תמונה רגילה מאושרת').waitFor();
  await closeSheet();
});

test('(d) reload in the middle of the queue: the app offers to continue, and both photos finish without a second attempt being counted', async () => {
  await page.goto(app('pictures'));
  await page.locator('.tiles2').first().waitFor();
  await page.evaluate(() => { window.__fakeGenSlow = 8; });
  await pick(4, PHOTOS.drink); await closeSheet();
  await pick(5, PHOTOS.plate); await closeSheet();
  await page.waitForFunction((id) => /מפרידים|מודדים/.test(document.querySelector(`.tile2[data-item="${id}"]`)?.textContent || ''), item(4), { timeout: 60000 });
  await dbIs(`select status from public.assets where item_id = '${item(4)}'`, 'processing');
  assert.equal(JSON.parse(asset(5)).status, 'uploaded');
  await dbIs(`select (original_path is not null) from public.assets where item_id = '${item(5)}'`, 't');     // the waiting photo is already safe in storage
  assert.match(await page.locator('.queue-note').innerText(), /בתור עכשיו: 2/);
  await page.reload();
  await page.getByText('2 תמונות נשארו באמצע').waitFor({ timeout: 20000 });
  await shot(page, '23-resume-offer-he-390', { fullPage: false });
  await page.getByRole('button', { name: 'להמשיך' }).click();
  await tile(4).and(page.locator('[data-status=review]')).waitFor({ timeout: 60000 });
  await tile(5).and(page.locator('[data-status=review]')).waitFor({ timeout: 60000 });
  assert.deepEqual(JSON.parse(asset(4, 'status, attempts, relief_class')), { status: 'ready_for_review', attempts: 1, relief_class: 'stand' });
  assert.equal(JSON.parse(asset(5, 'attempts')).attempts, 1);
  assert.equal(await page.getByText('נשארו באמצע').count(), 0);
  // after a reload the analysed photo is gone from memory: changing the depth class analyses the stored original again
  await page.reload();
  await page.locator('.tiles2').first().waitFor({ timeout: 20000 });
  await openPic(5);
  await sheet().getByRole('button', { name: 'בדיקה ואישור' }).click();
  await page.locator('canvas[data-shot=result][data-ready=true]').waitFor({ timeout: 30000 });
  const cur = JSON.parse(asset(5, 'relief_class')).relief_class, other = cur === 'flat' ? 'tall' : 'flat';
  await page.locator(`[data-depth=${other}]`).click();
  await page.locator(`[data-depth=${other}][aria-checked=true]`).waitFor({ timeout: 60000 });
  assert.deepEqual(JSON.parse(asset(5, 'relief_class, attempts, status')), { relief_class: other, attempts: 1, status: 'ready_for_review' });
});

test('the connection drops while typing in the dish sheet: "not saved" is shown there, the text stays, Try again saves it', async () => {
  await page.goto(app('menu/i/' + item(5)));
  const dish = page.locator('[data-sheet=dish]');
  await dish.locator('[data-field=desc_he]').waitFor();
  await page.route('**/rest/v1/items?*', (r) => (r.request().method() === 'PATCH' ? r.abort('internetdisconnected') : r.continue()));
  await dish.locator('[data-field=desc_he]').fill('חסה, עגבניות, מלפפון ושמן זית');
  await page.locator('[data-save=failed]').waitFor({ timeout: 15000 });
  await dish.getByText('השינויים האחרונים לא נשמרו. מה שהקלדתם עדיין כאן.').waitFor();
  assert.equal(await dish.locator('[data-field=desc_he]').inputValue(), 'חסה, עגבניות, מלפפון ושמן זית');
  assert.equal(sql(`select desc_he from public.items where id = '${item(5)}'`), '');
  await shot(page, '24-save-failed-he-390', { fullPage: false });
  await dish.locator('[data-field=desc_he]').fill('חסה, עגבניות, מלפפון ושמן זית טוב');      // keep typing while offline
  await page.locator('[data-save=failed]').waitFor();
  await page.unroute('**/rest/v1/items?*');
  await dish.locator('.savebar').getByRole('button', { name: 'לנסות שוב' }).click();
  await dbIs(`select desc_he from public.items where id = '${item(5)}'`, 'חסה, עגבניות, מלפפון ושמן זית טוב');
  await page.locator('[data-save=saved]').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.savebar').count(), 0);
  await closeSheet();
});

test('the database refuses a save: the screen goes back to what is really stored and says why (above the open sheet)', async () => {
  // two tabs: the dish is deleted elsewhere, then edited here
  await page.goto(app('menu/i/' + item(1)));
  const dish = page.locator('[data-sheet=dish]');
  await dish.locator('[data-field=name_he]').waitFor();
  const other = await owner.client.from('items').delete().eq('id', item(1)).select('id');
  assert.equal(other.data.length, 1);
  await dish.locator('[data-field=name_he]').fill('שם חדש');
  await page.locator('.toast-error').waitFor({ timeout: 15000 });
  assert.match(await page.locator('.toast-error').innerText(), /כבר לא קיים/);
  // drawn above the sheet, not under it: the pixels at the toast's edge are the toast's own red
  const box = await page.locator('.toast-error').boundingBox();
  const px = PNG.sync.read(await page.screenshot({ clip: { x: Math.round(box.x + 6), y: Math.round(box.y + box.height / 2), width: 4, height: 4 } })).data;
  assert.ok(px[0] > 140 && px[1] < 90 && px[2] < 80, 'the message is drawn above the sheet: rgb ' + [px[0], px[1], px[2]]);
  assert.equal(await page.locator('[data-save=failed]').count(), 0, 'nothing is left pretending to be pending');
  await closeSheet();
  // a quick-add into a section that was deleted elsewhere
  await page.goto(app('menu'));
  const cat2 = await owner.client.from('categories').insert({ business_id: biz.id, name_he: 'זמנית', position: 5 }).select().single();
  await page.reload();
  const sec = page.locator('section.sec', { hasText: 'זמנית' });
  await sec.waitFor({ timeout: 15000 });
  await owner.client.from('categories').delete().eq('id', cat2.data.id);
  await sec.getByPlaceholder('שם המנה').fill('יתום'); await sec.getByPlaceholder('שם המנה').press('Enter');
  await sec.locator('.ferr').waitFor({ timeout: 15000 });
  assert.equal(sql(`select count(*) from public.items where name_he = 'יתום'`), '0');
});

test('database limits come back as human sentences (24 sections)', async () => {
  const rows = Array.from({ length: 24 - Number(sql(`select count(*) from public.categories where business_id = '${biz.id}'`)) }, (_, i) => ({ business_id: biz.id, name_he: 'קטגוריה ' + i, position: 10 + i }));
  assert.equal((await owner.client.from('categories').insert(rows)).error, null);
  await page.goto(app('menu'));
  await page.locator('[data-tool=section]').click();
  await page.locator('[data-sheet=section] [data-field=cat_he]').fill('אחת יותר מדי');
  await page.locator('[data-sheet=section]').getByRole('button', { name: 'הוספה' }).click();
  await page.locator('dialog[open]').getByText('הגעתם ל־24 קטגוריות, וזה המקסימום').waitFor({ timeout: 15000 });
  assert.equal(sql(`select count(*) from public.categories where business_id = '${biz.id}'`), '24');
  await page.keyboard.press('Escape');
  await owner.client.from('categories').delete().eq('business_id', biz.id).like('name_he', 'קטגוריה %');
});

test('an emptied menu cannot be published: said plainly, the database agrees, and the path goes back to the start', async () => {
  const o2 = await account(); const empty = await seedBusiness(o2.client, { nameHe: 'ריק', nameEn: '', items: [['יחיד', 'Only', 1000]] });
  const p2 = await newPage({ width: 390, height: 844 });
  await signInUi(p2, o2.email); await signedIn(p2);
  await p2.goto(app('publish'));
  await p2.locator('[data-action=publish]').waitFor();
  await o2.client.from('items').delete().eq('business_id', empty.id);              // emptied in another tab
  await p2.locator('[data-action=publish]').click();
  await p2.getByText('אי אפשר לפרסם תפריט ריק. הוסיפו מנה אחת לפחות.').waitFor({ timeout: 15000 });
  assert.equal((await anon().rpc('public_menu', { p_slug: empty.slug })).data.state, 'not_found');
  await p2.reload();
  await p2.locator('[data-ways]').waitFor({ timeout: 15000 });                       // nothing to publish: back at "your menu", with the three ways to fill it
  await p2.waitForURL(/#\/menu$/);
  assert.equal(await p2.locator('[data-step=publish] a').count(), 0, 'the later steps are not offered while the menu is empty');
  await p2.goto(app('pictures')); await p2.waitForURL(/#\/menu$/); await p2.locator('[data-ways]').waitFor();
  await shot(p2, '25-empty-states-he-390', { fullPage: false });
  await p2.context().close();
});

test('the trial ends: publishing is refused in plain words, nothing is deleted, the diner sees "not available"', async () => {
  const o3 = await account(); const b3 = await seedBusiness(o3.client, { nameHe: 'ניסיון שנגמר', nameEn: 'Trial Over' });
  assert.equal((await o3.client.rpc('publish_menu', { p_business: b3.id })).data.ok, true);
  assert.equal((await o3.client.from('items').update({ price_minor: 3300 }).eq('id', b3.items[0].id)).error, null);        // something waits to be published
  const p3 = await newPage({ width: 390, height: 844 });
  await signInUi(p3, o3.email); await signedIn(p3);
  await p3.getByRole('heading', { name: 'ניסיון שנגמר', level: 1 }).waitFor({ timeout: 15000 });
  await p3.getByText('ניסיון: נשארו 30 ימים').waitFor();
  await p3.locator('[data-pub-state=changes]').waitFor({ timeout: 15000 });
  await p3.goto(app('publish'));
  await p3.locator('[data-diff=some]').waitFor({ timeout: 15000 });
  sql(`update public.entitlements set trial_ends_at = now() - interval '1 hour' where business_id = '${b3.id}'`);     // the trial runs out while the page is open
  await p3.locator('[data-action=publish]').click();
  await p3.getByText('תקופת הניסיון הסתיימה, ולכן אי אפשר לפרסם כרגע. שום דבר לא נמחק.').waitFor({ timeout: 15000 });
  await p3.getByText('הקישור וקוד ה־QR נשארים בתוקף').waitFor();                     // the page learned the new state and explains it
  assert.ok(await p3.locator('[data-action=publish]').isDisabled());
  assert.match(await p3.locator('[data-live-line]').innerText(), /לא זמין לאורחים/, 'the page no longer claims the menu is live');
  await shot(p3, '26-trial-ended-he-390');
  assert.equal(sql(`select count(*) from public.menu_revisions where business_id = '${b3.id}'`), '1', 'no new revision');
  const pm = (await anon().rpc('public_menu', { p_slug: b3.slug })).data;
  assert.deepEqual(pm, { state: 'unavailable', business: { name: { he: 'ניסיון שנגמר', en: 'Trial Over' } } });
  assert.deepEqual((await o3.client.rpc('restore_revision', { p_business: b3.id, p_number: 1 })).data, { ok: false, code: 'plan_inactive' });
  const diner = await newPage({ width: 390, height: 844 });
  await diner.goto(viewer('?m=' + b3.slug));
  await diner.getByText(/לא זמין כרגע/).first().waitFor({ timeout: 20000 });
  assert.match(await diner.locator('body').innerText(), /ניסיון שנגמר/);
  await diner.context().close();
  await p3.goto(app(''));
  await p3.getByText('תקופת הניסיון הסתיימה.').waitFor();
  assert.match(await p3.locator('main').innerText(), /שום דבר לא נמחק/);
  await p3.locator('[data-live-state=blocked]').waitFor();
  assert.equal(sql(`select count(*) from public.items where business_id = '${b3.id}'`), '2');
  sql(`update public.entitlements set status = 'suspended' where business_id = '${b3.id}'`);      // suspended by Halom staff
  await p3.reload();
  await p3.getByText('התפריט הושהה.').waitFor({ timeout: 15000 });
  await p3.context().close();
});

test('a browser that cannot run the studio: explained in one line, with the photo as it is', async () => {
  const p4 = await newPage({ width: 390, height: 844, context: await page.context().browser().newContext({ viewport: { width: 390, height: 844 } }) });
  await p4.context().addInitScript(() => { try { localStorage.setItem('mana-studio-lang', 'he'); } catch { /* */ } Object.defineProperty(WebAssembly, 'validate', { value: () => false }); });
  await signInUi(p4, owner.email); await signedIn(p4);
  await p4.goto(app('pictures'));
  await p4.locator('[data-studio=unsupported]').waitFor({ timeout: 15000 });
  assert.match(await p4.locator('[data-studio=unsupported]').innerText(), /הדפדפן הזה לא יכול להריץ את הסטודיו\. אפשר להמשיך במחשב/);
  await pick(0, PHOTOS.plate2, p4);
  const sh = p4.locator('[data-sheet=picture]');
  await sh.locator('.row-err', { hasText: 'הדפדפן הזה לא יכול להריץ את הסטודיו' }).waitFor({ timeout: 30000 });
  assert.equal(await sh.getByRole('button', { name: 'לנסות שוב' }).count(), 0);
  await sh.getByRole('button', { name: 'להשתמש בתמונה כמו שהיא' }).click();
  await p4.locator('[data-result=photo]').waitFor({ timeout: 30000 });
  await p4.locator('[data-action=approve]').click();
  await p4.getByText('אושר. התמונה תופיע לאורחים בפרסום הבא.').waitFor({ timeout: 20000 });
  assert.equal(JSON.parse(asset(0, 'status, kind')).kind, 'photo');
  await p4.context().close();
});

test('the studio download fails: said plainly, nothing is lost, and it works once the files are reachable again', async () => {
  const p5 = await newPage({ width: 390, height: 844 });
  await signInUi(p5, owner.email); await signedIn(p5);
  await p5.route('**/models/**', (r) => r.fulfill({ status: 404, body: 'gone' }));
  await p5.goto(app('pictures'));
  await p5.locator('.tiles2').first().waitFor();
  await pick(2, PHOTOS.plate2, p5);
  const sh = p5.locator('[data-sheet=picture]');
  await sh.locator('.row-err', { hasText: 'ההורדה של הסטודיו נקטעה' }).waitFor({ timeout: 60000 });
  await closeSheet(p5);
  await p5.locator('[data-studio=failed]').getByText('ההורדה של הסטודיו נקטעה. מה שכבר ירד נשמר.').waitFor();
  await p5.unroute('**/models/**');
  await openPic(2, p5);
  await sh.getByRole('button', { name: 'לנסות שוב' }).click();
  await p5.locator(`.tile2[data-item="${item(2)}"][data-status=review]`).waitFor({ timeout: 60000 });
  await p5.context().close();
});

test('start: a wrong password for an existing account says so; a dropped connection says so; nothing says "check your inbox"', async () => {
  const p6 = await newPage({ width: 390, height: 844 });
  await p6.goto(app());
  await p6.locator('input[name=email]').fill(owner.email); await p6.locator('input[name=password]').fill('wrong-password-1');
  await p6.locator('form button[type=submit]').click();
  await p6.getByText('הסיסמה לא מתאימה לחשבון הזה.').waitFor({ timeout: 20000 });
  const wa = await p6.locator('.note').getByRole('link', { name: 'כתבו לנו בוואטסאפ' }).getAttribute('href');
  assert.equal(wa, 'https://wa.me/972542022269');
  assert.equal(sql(`select count(*) from auth.users where email = '${owner.email}'`), '1', 'no second account was made');
  assert.ok(!/inbox|תיבת|מייל אישור/i.test(await p6.locator('body').innerText()));
  // and the right password signs in, on the same screen
  await p6.locator('input[name=password]').fill(PASSWORD);
  await p6.locator('form button[type=submit]').click();
  await signedIn(p6);
  await p6.context().close();
  const p7 = await newPage({ width: 390, height: 844 });
  await p7.goto(app());
  await p7.route('**/functions/v1/menus-signup', (r) => r.abort('internetdisconnected'));
  await p7.locator('input[name=email]').fill('new-' + Date.now() + '@example.com'); await p7.locator('input[name=password]').fill(PASSWORD);
  await p7.locator('form button[type=submit]').click();
  await p7.getByText('אין חיבור לרשת כרגע.').waitFor({ timeout: 20000 });
  await p7.context().close();
});

test('provider buttons follow the config; a click goes to the provider with a PKCE challenge and comes back to the app\'s own address', async () => {
  const withProviders = async (p, list) => p.route('**/config.js', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace('"providers": []', '"providers": ' + JSON.stringify(list)) }); });
  const p8 = await newPage({ width: 390, height: 844 });
  await withProviders(p8, ['facebook', 'google', 'something-else']);
  await p8.goto(app());
  await p8.locator('.start-form').waitFor();
  assert.deepEqual(await p8.locator('[data-provider]').evaluateAll((els) => els.map((e) => e.getAttribute('data-provider') + ':' + e.textContent.trim())), ['google:המשך עם Google', 'facebook:המשך עם Facebook'], 'only the listed ones, in a fixed order; Apple is not listed');
  assert.equal(await p8.locator('.or').count(), 1, 'the divider comes with the buttons');
  await shot(p8, '28-start-providers-he-390', { fullPage: false });
  let seen = null;
  await p8.route('**/auth/v1/authorize**', (r) => { seen = new URL(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: '<title>provider</title>the provider would ask the owner here' }); });
  await p8.locator('[data-provider=google]').click();
  await p8.waitForURL('**/auth/v1/authorize**', { timeout: 15000 });
  assert.equal(seen.origin + seen.pathname, stack.API_URL + '/auth/v1/authorize');
  assert.equal(seen.searchParams.get('provider'), 'google');
  assert.ok((seen.searchParams.get('code_challenge') || '').length >= 43, 'a PKCE challenge is sent: ' + seen.searchParams.get('code_challenge'));
  assert.match(seen.searchParams.get('code_challenge_method') || '', /^s256$/i);
  assert.equal(seen.searchParams.get('redirect_to'), stack.WEB_URL + 'studio/', 'back to the app itself, without hash or query');
  // the way back: ?code=… is taken out of the address bar; a code that cannot be traded says so calmly
  await p8.goto(stack.WEB_URL + 'studio/?code=not-a-real-code');
  await p8.getByText('הכניסה לא הושלמה. נסו שוב.').waitFor({ timeout: 20000 });
  assert.equal(new URL(p8.url()).search, '', 'the query is cleaned');
  await p8.goto(stack.WEB_URL + 'studio/?error=access_denied&error_description=The+user+said+no#/menu');
  await p8.getByText('הכניסה לא הושלמה. נסו שוב.').waitFor({ timeout: 20000 });
  assert.equal(new URL(p8.url()).search, '');
  await p8.context().close();
  // all three
  const p9 = await newPage({ width: 390, height: 844, lang: 'en' });
  await withProviders(p9, ['google', 'apple', 'facebook']);
  await p9.goto(app());
  await p9.locator('.start-form').waitFor();
  assert.deepEqual(await p9.locator('[data-provider]').evaluateAll((els) => els.map((e) => e.textContent.trim())), ['Continue with Google', 'Continue with Apple', 'Continue with Facebook']);
  let apple = null;
  await p9.route('**/auth/v1/authorize**', (r) => { apple = new URL(r.request().url()); r.fulfill({ status: 200, contentType: 'text/html', body: 'ok' }); });
  await p9.locator('[data-provider=apple]').click();
  await p9.waitForURL('**/auth/v1/authorize**', { timeout: 15000 });
  assert.equal(apple.searchParams.get('provider'), 'apple'); assert.ok(apple.searchParams.get('code_challenge'));
  await p9.context().close();
});

// ---------------------------------------------------------------- the menu scanner
const freshOwner = async (name = 'סריקות') => {
  const o = await account();
  const b = await o.client.rpc('create_business', { p_slug: unique('scan'), p_name_he: name, p_name_en: '', p_kind: 'cafe', p_contact_name: '', p_contact_phone: '' });
  const p = await newPage({ width: 390, height: 844 });
  await signInUi(p, o.email); await signedIn(p);
  await p.locator('[data-ways]').waitFor({ timeout: 20000 });
  return { o, id: b.data.id, p };
};
const scan = async (p, files) => {
  await p.locator('[data-ways] [data-way=scan], [data-tool=import]').first().waitFor({ timeout: 20000 });           // the menu screen is back
  const trigger = (await p.locator('[data-ways] [data-way=scan]').count()) ? p.locator('[data-ways] [data-way=scan]') : null;
  if (!trigger) { await p.locator('[data-tool=import]').click(); }
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), (trigger || p.locator('[data-sheet=import] [data-way=scan]')).click()]);
  await fc.setFiles(files);
};

test('the scanner is not switched on: a calm sheet, paste or type instead; no picture leaves the browser', async () => {
  await stackConfig({ ai: 'reset' }); await stackConfig({ ai: { configured: false } });
  const { p } = await freshOwner();
  let chooser = false; p.on('filechooser', () => { chooser = true; });
  await p.locator('[data-way=scan]').click();
  await p.locator('[data-scan-off]').waitFor({ timeout: 15000 });
  assert.equal(await p.locator('[data-scan-off]').innerText(), 'הסורק עוד לא הופעל. בינתיים אפשר להדביק רשימה או להקליד.');
  assert.equal(chooser, false, 'no file is asked for');
  await shot(p, '29-scan-off-he-390', { fullPage: false });
  await p.locator('[data-sheet=scan-off]').getByRole('button', { name: 'הדבקת רשימה' }).click();
  await p.locator('[data-sheet=paste]').waitFor();
  assert.deepEqual((await aiCalls()).map((c) => c.action), ['status'], 'status was asked once, and nothing else was sent');
  await p.context().close();
  await stackConfig({ ai: 'reset' });
});

test('every way a scan can fail gets one short sentence and one action', async () => {
  await stackConfig({ ai: 'reset' });
  const { p, id } = await freshOwner();
  const photo = await menuPhoto();
  const want = {
    not_a_menu: ['זה לא נראה כמו תפריט. צלמו את דף התפריט עצמו.', 'scan-again'], unreadable: ['לא הצלחנו לקרוא את הצילום. נסו צילום חד וישר, באור טוב.', 'scan-again'],
    empty: ['לא מצאנו מנות בצילום הזה.', 'scan-again'], busy: ['הסורק עמוס כרגע. נסו שוב בעוד דקה.', 'scan-again'], timeout: ['זה לקח יותר מדי זמן. נסו עמוד אחד בכל פעם.', 'scan-again'],
    too_big: ['התמונה גדולה מדי. צלמו עמוד אחד בכל תמונה.', 'scan-again'], bad_image: ['הקובץ הזה אינו תמונה שאפשר לקרוא.', 'scan-again'],
    bad_key: ['הסורק לא ענה. בינתיים אפשר להדביק את הרשימה.', 'scan-paste'], upstream: ['הסורק לא ענה. בינתיים אפשר להדביק את הרשימה.', 'scan-paste'],
    failed: ['הסורק לא ענה. בינתיים אפשר להדביק את הרשימה.', 'scan-paste'], bad_request: ['הסורק לא ענה. בינתיים אפשר להדביק את הרשימה.', 'scan-paste'],
    limit_ai: ['מספיק סריקות להיום.', 'scan-paste'], not_configured: ['הסורק עוד לא הופעל. בינתיים אפשר להדביק רשימה או להקליד.', 'scan-paste'],
  };
  for (const [code, [sentence, action]] of Object.entries(want)) {
    await stackConfig({ ai: { error: code } });
    await scan(p, photo);
    await p.locator(`[data-scan-error=${code}]`).waitFor({ timeout: 20000 });
    assert.equal(await p.locator('[data-scan-error] .strong').innerText(), sentence, code);
    assert.equal(await p.locator('[data-scan-error] [data-action]').count(), 1, 'one action for ' + code);
    assert.equal(await p.locator('[data-scan-error] [data-action]').getAttribute('data-action'), action, code);
    if (code === 'unreadable') await shot(p, '30-scan-error-he-390', { fullPage: false });
    await p.getByRole('button', { name: 'סגירה' }).click();
    await p.locator('[data-ways]').waitFor();
  }
  await stackConfig({ ai: 'reset' });
  // a file that is not a picture never leaves the browser
  const before = (await aiCalls()).length;
  const txt = path.join(OUT, 'notes.txt'); fs.writeFileSync(txt, 'this is not a picture');
  await scan(p, txt);
  await p.locator('[data-scan-error=bad_image]').waitFor({ timeout: 20000 });
  assert.equal((await aiCalls()).length, before, 'nothing was sent');
  await p.getByRole('button', { name: 'סגירה' }).click();
  // the real daily allowance, counted by the database: the second scan of the day is refused when the limit is one
  sql(`update public.app_config set value = '{"scan_menu": 1, "describe_dish": 500}' where key = 'ai_limits'`);
  sql(`delete from public.ai_usage_daily`);
  await scan(p, photo);
  await p.locator('[data-scan=review]').waitFor({ timeout: 30000 });
  await p.getByRole('button', { name: 'סגירה' }).click();
  await scan(p, photo);
  await p.locator('[data-scan-error=limit_ai]').waitFor({ timeout: 20000 });
  assert.equal(await p.locator('[data-scan-error] .strong').innerText(), 'מספיק סריקות להיום.');
  allowMany();
  assert.equal(sql(`select count(*) from public.items where business_id = '${id}'`), '0', 'scans that were closed added nothing');
  await p.context().close();
});

test('a long page and a dropped connection: what arrived is kept, and the owner is told to scan the rest', async () => {
  await stackConfig({ ai: 'reset' });
  const { p, id } = await freshOwner();
  await stackConfig({ ai: { truncated: true, truncateAfter: 5 } });
  await scan(p, await menuPhoto());
  await p.locator('[data-scan=review]').waitFor({ timeout: 30000 });
  assert.equal(await p.locator('[data-scan-note=truncated]').innerText(), 'העמוד ארוך: קראנו את 5 המנות הראשונות. צלמו את ההמשך וסרקו שוב.');
  assert.equal(await p.locator('[data-action=scan-add]').innerText(), 'הוספת 5 מנות');
  await shot(p, '31-scan-truncated-he-390', { fullPage: false });
  await p.getByRole('button', { name: 'סגירה' }).click();
  await stackConfig({ ai: 'reset' }); await stackConfig({ ai: { error: 'upstream', errorAfter: 4 } });
  await scan(p, await menuPhoto());
  await p.locator('[data-scan=review]').waitFor({ timeout: 30000 });
  assert.equal(await p.locator('[data-scan-note=truncated]').innerText(), 'החיבור נקטע: קראנו 4 מנות. סרקו שוב את ההמשך.');
  assert.equal(await p.locator('[data-scan-row]').count(), 4);
  await p.locator('[data-action=scan-add]').click();
  await p.locator('section.sec').first().waitFor({ timeout: 20000 });
  await dbIs(`select count(*) from public.items where business_id = '${id}'`, '4');
  await stackConfig({ ai: 'reset' });
  await p.context().close();
});

test('several pages and repeats: sections with the same name are joined, exact repeats are skipped unless the owner wants them', async () => {
  await stackConfig({ ai: 'reset' });
  const { p, id } = await freshOwner();
  await stackConfig({ ai: { scripts: ['he', 'he2'], delayMs: 25 } });
  await scan(p, [await menuPhoto(), await menuPhoto('menu-page-2', 228)]);
  await p.waitForFunction(() => /עמוד 2 מתוך 2/.test(document.querySelector('.scan-live')?.textContent || ''), null, { timeout: 30000 });
  await p.locator('[data-scan=review]').waitFor({ timeout: 30000 });
  assert.deepEqual(await p.locator('.ssec-name').evaluateAll((els) => els.map((e) => e.value)), ['ראשונות', 'עיקריות', 'שתייה', 'קינוחים'], 'page two continued "Mains" and opened "Desserts"');
  assert.equal(await p.locator('[data-scan-row]').count(), 16);
  assert.equal(await p.locator('[data-scan-row][data-dup=true]').count(), 1, 'the shakshuka that is on both pages');
  assert.equal(await p.locator('[data-scan-note=dups]').innerText(), 'לדלג על מנה אחת שכבר בתפריט');
  assert.ok(await p.locator('[data-scan-note=dups] input').isChecked(), 'skipped by default');
  assert.equal(await p.locator('[data-action=scan-add]').innerText(), 'הוספת 15 מנות');
  await p.locator('[data-action=scan-add]').click();
  await p.locator('section.sec').first().waitFor({ timeout: 20000 });
  await dbIs(`select count(*) from public.items where business_id = '${id}'`, '15');
  assert.equal(sql(`select string_agg(c.name_he || '=' || (select count(*) from public.items i where i.category_id = c.id), ',' order by c.position) from public.categories c where c.business_id = '${id}'`), 'ראשונות=3,עיקריות=7,שתייה=3,קינוחים=2');
  // the same second page again, into the menu that now exists: its section names match, three of its four dishes are repeats
  await stackConfig({ ai: { scripts: ['he2'] } });
  await scan(p, await menuPhoto());
  await p.locator('[data-scan=review]').waitFor({ timeout: 30000 });
  assert.equal(await p.locator('[data-scan-row][data-dup=true]').count(), 4);
  assert.equal(await p.locator('[data-scan-note=dups]').innerText(), 'לדלג על 4 מנות שכבר בתפריט');
  assert.ok(await p.locator('[data-action=scan-add]').isDisabled(), 'nothing new to add');
  await p.locator('[data-scan-row]').nth(1).locator('[data-scan-field=price]').fill('52');          // another price: no longer the same dish
  assert.equal(await p.locator('[data-action=scan-add]').innerText(), 'הוספת מנה אחת');
  await p.locator('[data-scan-note=dups] input').uncheck();
  assert.equal(await p.locator('[data-action=scan-add]').innerText(), 'הוספת 4 מנות');
  await p.locator('[data-scan-note=dups] input').check();
  await p.locator('[data-action=scan-add]').click();
  await p.locator('section.sec').first().waitFor({ timeout: 20000 });
  await dbIs(`select count(*) from public.items where business_id = '${id}'`, '16');
  assert.equal(sql(`select count(*) from public.categories where business_id = '${id}'`), '4', 'no second "Mains"');
  assert.equal(sql(`select string_agg(price_minor::text, ',' order by price_minor) from public.items where business_id = '${id}' and name_he = 'סלט קיסר'`), '4800,5200');
  await stackConfig({ ai: 'reset' });
  await p.context().close();
});

test('a menu printed in English: the Hebrew is the translated side, and a one-language place gets one language only', async () => {
  await stackConfig({ ai: 'reset' });
  const { o, p, id } = await freshOwner('Olive');
  await stackConfig({ ai: { script: 'en', delayMs: 20 } });
  await scan(p, await menuPhoto());
  await p.locator('[data-scan=review]').waitFor({ timeout: 30000 });
  assert.equal(await p.locator('[data-scan-note=translated]').innerText(), 'העברית תורגמה אוטומטית: כדאי לבדוק.');
  assert.equal(await p.locator('[data-scan-row] [data-scan-field=name]').first().inputValue(), 'Margherita', 'the printed language is shown first');
  await p.getByRole('button', { name: 'סגירה' }).click();
  assert.equal((await o.client.from('businesses').update({ langs: ['he'], default_lang: 'he' }).eq('id', id)).error, null);
  await p.reload(); await p.locator('[data-ways]').waitFor({ timeout: 20000 });
  await scan(p, await menuPhoto());
  await p.locator('[data-scan=review]').waitFor({ timeout: 30000 });
  assert.deepEqual((await aiCalls()).at(-1).langs, ['he'], 'only the language of the menu is asked for');
  assert.equal(await p.locator('[data-scan-note=translated]').count(), 0);
  assert.equal(await p.locator('.scan-top .seg').count(), 0, 'no language switch for a one-language menu');
  await p.locator('[data-action=scan-add]').click();
  await p.locator('section.sec').first().waitFor({ timeout: 20000 });
  await dbIs(`select count(*) from public.items where business_id = '${id}'`, '3');
  assert.equal(sql(`select string_agg(name_he || '/' || name_en, ',' order by position) from public.items where business_id = '${id}' and category_id = (select id from public.categories where business_id = '${id}' and name_he = 'פיצות')`), 'מרגריטה/,ביאנקה/');
  await stackConfig({ ai: 'reset' });
  await p.context().close();
});

test('"suggest from the photo" fills only EMPTY name and description fields, marks them, and never touches tags or allergens', async () => {
  await stackConfig({ ai: 'reset' });
  const o = await account(); const b = await seedBusiness(o.client, { nameHe: 'הצעות', nameEn: 'Suggestions', items: [['שקשוקה', '', 5400], ['בלי תמונה', 'No photo', 1000]] });
  assert.equal((await o.client.from('items').update({ desc_he: 'התיאור שאני כתבתי', tags: ['spicy'], allergens_he: 'ביצים' }).eq('id', b.items[0].id)).error, null);
  const p = await newPage({ width: 390, height: 844 });
  await signInUi(p, o.email); await signedIn(p);
  await p.goto(app('pictures')); await p.locator('.tiles2').first().waitFor();
  await p.locator(`.tile2[data-item="${b.items[0].id}"] button`).click();
  const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.locator('[data-sheet=picture]').getByRole('button', { name: /^(הוספת תמונה|תמונה אחרת) ל/ }).click()]);
  await fc.setFiles(PHOTOS.plate);
  await p.locator(`.tile2[data-item="${b.items[0].id}"][data-status=review]`).waitFor({ timeout: 60000 });
  await p.keyboard.press('Escape');
  await p.goto(app('menu/i/' + b.items[1].id));
  await p.locator('[data-sheet=dish] [data-field=name_he]').waitFor();
  assert.equal(await p.locator('[data-action=suggest]').count(), 0, 'no photo of its own: nothing to suggest from');
  await p.goto(app('menu/i/' + b.items[0].id));
  const dish = p.locator('[data-sheet=dish]');
  await dish.locator('[data-action=suggest]').click();
  await dish.locator('[data-suggested-other]').waitFor({ timeout: 20000 });
  const call = (await aiCalls()).filter((c) => c.action === 'describe_dish').at(-1);
  assert.equal(call.name, 'שקשוקה', 'the name the owner already has is passed on'); assert.ok(call.b64 < 1_200_000); assert.ok(Math.max(call.size.width, call.size.height) <= 1024, JSON.stringify(call.size));
  assert.equal(await dish.locator('[data-field=name_he]').inputValue(), 'שקשוקה'); assert.equal(await dish.locator('[data-field=desc_he]').inputValue(), 'התיאור שאני כתבתי', 'typed text is never replaced');
  assert.equal(await dish.locator('[data-suggested]').count(), 0, 'nothing was filled in the Hebrew fields');
  await dbIs(`select name_he || '|' || name_en || '|' || desc_he || '|' || desc_en || '|' || array_to_string(tags, '+') || '|' || allergens_he || '|' || allergens_en from public.items where id = '${b.items[0].id}'`,
    'שקשוקה|Green shakshuka|התיאור שאני כתבתי|Eggs on spinach and herbs, with a slice of bread|spicy|ביצים|');
  await dish.getByRole('button', { name: 'English' }).click();
  assert.deepEqual(await dish.locator('[data-suggested]').evaluateAll((els) => els.map((e) => e.getAttribute('data-suggested'))), ['name_en', 'desc_en'], 'the filled fields are marked as suggestions');
  await shot(p, '32-suggestion-en-fields-he-390', { fullPage: false });
  await dish.locator('[data-field=desc_en]').fill('Eggs on spinach, with bread');                 // the owner touched it: it is theirs now
  await p.waitForFunction(() => !document.querySelector('[data-suggested=desc_en]'));
  await dish.locator('[data-suggested=name_en] .sugg-x').click();                                // "not this one"
  await dbIs(`select name_en || '|' || desc_en from public.items where id = '${b.items[0].id}'`, '|Eggs on spinach, with bread');
  // asked again: only the name is empty now
  await dish.locator('[data-action=suggest]').click();
  await dbIs(`select name_en || '|' || desc_en from public.items where id = '${b.items[0].id}'`, 'Green shakshuka|Eggs on spinach, with bread');
  // a photo that shows no food
  await stackConfig({ ai: { describeError: 'not_food' } });
  await dish.locator('[data-suggested=name_en] .sugg-x').click();
  await dish.locator('[data-action=suggest]').click();
  await dish.getByText('לא זיהינו אוכל או שתייה בתמונה.').waitFor({ timeout: 15000 });
  await stackConfig({ ai: 'reset' });
  await p.context().close();
});
