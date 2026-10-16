// (d) The Style tab keeps everything the old "Look" screen did: logo, colour, table, languages, the place's names and
// details, the ordering link and the phone. Each reaches the draft at once and guests after "Update". Then the menu is
// taken offline: Home says so, and the first-run path does not come back.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, newPage, app, account, seedBusiness, signInUi, layoutProblems, shot, PHOTOS, sql, dbIs, liveSnapshot } from './helpers.mjs';

let owner, biz, page;
const one = (q) => sql(q);
const bizRow = (cols) => one(`select ${cols} from public.businesses where id = '${biz.id}'`);

before(async () => {
  await setup({ gen: 'fake' });
  owner = await account();
  biz = await seedBusiness(owner.client, { nameHe: 'ביסטרו השדרה', nameEn: 'Boulevard Bistro' });
  assert.equal((await owner.client.rpc('publish_menu', { p_business: biz.id })).data.ok, true);
  page = await newPage({ width: 390, height: 844, lang: 'he' });
  await signInUi(page, owner.email);
  await page.locator('[data-stats]').waitFor({ timeout: 20000 });
});
after(async () => { await teardown(); });

test('logo, colour and table: chosen on the Style tab, saved at once', async () => {
  await page.locator('[data-tab=style]').click();
  await page.locator('.strip img').first().waitFor();
  assert.equal(await page.locator('h1').innerText(), 'סגנון');
  // every table thumbnail is a real picture that loaded (the old screen showed blank tiles)
  await page.waitForFunction(() => [...document.querySelectorAll('.strip img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 });
  assert.equal(await page.locator('.strip [data-surface]').count(), 19);
  assert.equal(await page.locator('.strip img').count(), 18, 'every table but the hologram stage has a picture');

  // logo: resized in the browser to a PNG, stored in the public bucket under the business
  await page.locator('[data-logo-input]').setInputFiles(PHOTOS.plate2);
  await page.locator('img[data-logo]').waitFor({ timeout: 20000 });
  const logo = await dbIs(`select logo_path ~ '^${biz.id}/brand/logo-[0-9a-f-]+\\.png$' from public.businesses where id = '${biz.id}'`, 't');
  assert.ok(logo);
  assert.equal(one(`select count(*) from storage.objects o join public.businesses b on o.name = b.logo_path where b.id = '${biz.id}' and o.bucket_id = 'menu-public'`), '1');
  await page.waitForFunction(() => { const i = document.querySelector('img[data-logo]'); return i && i.complete && i.naturalWidth > 0; }, null, { timeout: 20000 });
  assert.equal(await page.getByRole('button', { name: 'החלפה' }).count() + await page.locator('label.btn', { hasText: 'החלפה' }).count() > 0, true, 'the button now offers to replace it');

  // colour: a preset, then a dark colour of the owner's own, which is made brighter and said so
  await page.locator('[data-accent="#7fd6a4"]').click();
  await dbIs(`select accent from public.businesses where id = '${biz.id}'`, '#7fd6a4');
  assert.equal(await page.locator('[data-accent="#7fd6a4"]').getAttribute('aria-checked'), 'true');
  await page.locator('.dot2-custom input[type=color]').evaluate((el) => { el.value = '#101060'; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.getByText('הבהרנו את הצבע כדי שיהיה קריא על רקע כהה.').waitFor();
  const accent = bizRow('accent');
  assert.match(accent, /^#[0-9a-f]{6}$/); assert.notEqual(accent, '#101060'); assert.notEqual(accent, '#7fd6a4');

  // table
  await page.locator('[data-surface=marble]').click();
  await dbIs(`select surface from public.menus where business_id = '${biz.id}'`, 'marble');
  assert.equal(await page.locator('#surf-h .blk-val').innerText(), 'שיש לבן');
  assert.equal(await page.locator('[data-surface=marble]').getAttribute('aria-checked'), 'true');
});

test('languages, names, details, ordering link and phone', async () => {
  // English off: one language left, and that one cannot be switched off
  await page.locator('label.tagchip', { hasText: 'אנגלית' }).click();
  await dbIs(`select array_to_string(langs, ',') || '|' || default_lang from public.businesses where id = '${biz.id}'`, 'he|he');
  assert.equal(await page.locator('[data-lang-toggle=he]').isDisabled(), true, 'the last language stays');
  assert.equal(await page.locator('[data-field=default_lang]').count(), 0);
  await page.locator('label.tagchip', { hasText: 'אנגלית' }).click();
  await dbIs(`select array_to_string(langs, ',') from public.businesses where id = '${biz.id}'`, 'he,en');
  await page.locator('[data-field=default_lang]').selectOption('en');
  await dbIs(`select default_lang from public.businesses where id = '${biz.id}'`, 'en');
  await page.locator('[data-field=default_lang]').selectOption('he');
  await dbIs(`select default_lang from public.businesses where id = '${biz.id}'`, 'he');

  // names: either may be empty, never both
  await page.locator('[data-field=name_en]').fill('Boulevard Bistro & Bar');
  await dbIs(`select name_en from public.businesses where id = '${biz.id}'`, 'Boulevard Bistro & Bar');
  await page.locator('[data-field=name_en]').fill('');
  await dbIs(`select name_en from public.businesses where id = '${biz.id}'`, '');
  await page.locator('[data-field=name_he]').fill('');
  await page.getByText('צריך שם בשפה אחת לפחות.').waitFor();
  await page.waitForTimeout(1200);
  assert.equal(bizRow('name_he'), 'ביסטרו השדרה', 'the last name is not wiped');
  await page.locator('[data-field=name_he]').fill('ביסטרו השדרה');
  await page.locator('[data-field=name_en]').fill('Boulevard Bistro');
  await dbIs(`select name_en from public.businesses where id = '${biz.id}'`, 'Boulevard Bistro');
  assert.match(await page.locator('.fixed-line').innerText(), new RegExp('halom\\.io/m/' + biz.slug), 'the address is shown as fixed');
  assert.equal(await page.locator('[data-field=slug]').count(), 0, 'and cannot be edited');

  // the rarely used details are folded away
  assert.equal(await page.locator('[data-field=area_he]').isVisible(), false);
  await page.locator('details.more summary').click();
  await page.locator('.page-style [data-kind=bar]').click();
  await page.locator('[data-field=area_he]').fill('שדרות רוטשילד, תל אביב');
  await page.locator('[data-field=cuisine_en]').fill('Bistro');
  await dbIs(`select kind || '|' || area_he || '|' || cuisine_en from public.businesses where id = '${biz.id}'`, 'bar|שדרות רוטשילד, תל אביב|Bistro');

  // ordering link: https only; phone
  await page.locator('[data-field=order_url]').fill('http://order.example.com/bistro');
  await page.getByText('הקישור צריך להתחיל ב־https:// ולא לכלול רווחים.').waitFor();
  await page.waitForTimeout(1000);
  assert.equal(bizRow(`coalesce(order_url, 'none')`), 'none', 'a link that is not https is not saved');
  await page.locator('[data-field=order_url]').fill('https://order.example.com/bistro');
  await page.locator('[data-field=phone]').fill('03-555 1234');
  await dbIs(`select order_url || '|' || phone from public.businesses where id = '${biz.id}'`, 'https://order.example.com/bistro|03-555 1234');
  assert.deepEqual(await layoutProblems(page), [], 'the whole Style screen, with the details open and an error shown before');
  await shot(page, 'd-style-full-he-390');
  assert.deepEqual(page.problems, []);
});

test('the draft has the new look at once; guests get it with "Update"', async () => {
  const draft = (await owner.client.rpc('preview_snapshot', { p_business: biz.id })).data;
  assert.equal(draft.theme.surface, 'marble'); assert.equal(draft.theme.accent, bizRow('accent'));
  assert.equal(draft.business.orderUrl, 'https://order.example.com/bistro'); assert.equal(draft.business.phone, '03-555 1234');
  assert.match(String(draft.business.logo), /\/brand\/logo-[0-9a-f-]+\.png$/);
  assert.deepEqual([draft.locale.default, draft.locale.langs.join(',')], ['he', 'he,en']);
  const before = liveSnapshot(biz.id);
  assert.deepEqual([before.theme.surface, before.business.orderUrl, before.business.logo], ['oak', null, null], 'what guests see has not changed yet');

  await page.locator('[data-pub-state=changes]').waitFor({ timeout: 15000 });
  assert.equal((await page.locator('.pubbtn').innerText()).trim(), 'עדכון');
  await page.locator('.pubbtn').click();
  await page.locator('[data-diff=some]').waitFor({ timeout: 15000 });
  assert.deepEqual(await page.locator('[data-diff=some] .chip').allInnerTexts(), ['הסגנון או פרטי המקום'], 'only the look changed, and it says so');
  await page.locator('.pubgrid [data-preview=shown]').waitFor({ timeout: 30000 });
  await page.locator('[data-action=publish]').click();
  await page.locator('[data-published-rev="2"]').waitFor({ timeout: 20000 });
  assert.equal(await page.locator('h1').innerText(), 'התפריט עודכן');
  assert.equal(await page.locator('[data-field=contact_phone]').count(), 0, 'the contact phone is asked once, after the first publish only');
  const live = liveSnapshot(biz.id);
  assert.deepEqual([live.revision, live.theme.surface, live.theme.accent, live.business.orderUrl, live.business.phone, live.business.name.en], [2, 'marble', bizRow('accent'), 'https://order.example.com/bistro', '03-555 1234', 'Boulevard Bistro']);
  assert.match(String(live.business.logo), /\/brand\/logo-[0-9a-f-]+\.png$/);
  await page.locator('[data-action=to-home]').click();
  await page.locator('[data-pub-state=live]').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('[data-action=update]').count(), 0, 'nothing left to update');
});

test('take the menu offline: Home says so and offers to publish; the first-run path does not come back', async () => {
  await page.locator('.pubbtn').click();
  await page.locator('.revs-block summary').click();
  assert.deepEqual(await page.locator('[data-rev]').evaluateAll((els) => els.map((e) => e.getAttribute('data-rev'))), ['2', '1']);
  await page.locator('[data-action=unpublish]').click();
  await page.locator('dialog[open]').getByText('שום דבר לא נמחק').waitFor();
  await page.locator('dialog[open] .btn-danger').click();
  await dbIs(`select coalesce(published_revision_id::text, 'none') from public.menus where business_id = '${biz.id}'`, 'none');
  await page.locator('[data-pub-state=off]').waitFor({ timeout: 15000 });
  await page.locator('[data-tab=home]').click();
  await page.locator('[data-live-state=off]').waitFor();
  assert.equal(await page.locator('[data-live-state=off]').innerText(), 'לא מפורסם');
  assert.equal((await page.locator('[data-action=update]').innerText()).trim(), 'פרסום');
  assert.equal(await page.locator('.shell').getAttribute('data-mode'), 'tabs', 'three tabs, as after any first publish');
  assert.equal(await page.locator('.pathbar').count(), 0, 'the Menu → Pictures → Publish header is gone for good');
  await page.reload();
  await page.locator('[data-live-state=off]').waitFor({ timeout: 20000 });
  assert.equal(await page.locator('.pathbar').count(), 0);
  // and back on the air with one tap from Home
  await page.locator('[data-action=update]').click();
  await page.locator('[data-action=publish]').click();
  await page.locator('[data-published-rev="3"]').waitFor({ timeout: 20000 });
  assert.equal(liveSnapshot(biz.id).revision, 3);
  assert.deepEqual(page.problems, []);
});
