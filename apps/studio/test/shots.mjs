// The screenshots the lead reviews: the main path and the key screens at 390 × 844 in Hebrew, the same key screens in
// English, and 1440 × 900 with the docked preview. Runs against the local stack with the scanner stand-in.
//   node test/shots.mjs                (stand-in generator, quick)
//   SHOTS_GEN=real node test/shots.mjs (one real photo through the real generator)
import fs from 'node:fs';
import path from 'node:path';
import { setup, teardown, newPage, app, unique, PASSWORD, PHOTOS, sql, stackConfig, menuPhoto, guests, HERE } from './e2e/helpers.mjs';

const OUT = process.env.SHOTS_OUT ? path.resolve(process.env.SHOTS_OUT) : path.resolve(HERE, '../../.shots/v2');
fs.mkdirSync(OUT, { recursive: true });
const REAL = process.env.SHOTS_GEN === 'real';
const only = process.env.SHOTS_ONLY || '';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const shot = async (page, name, opts = {}) => {
  await page.waitForTimeout(opts.wait ?? 350);
  // a full-page picture is taken with the bars laid flat, so they do not cut through the page; toasts are left out of every picture
  const style = await page.addStyleTag({ content: '.toasts{display:none!important}' + (opts.full ? '@media (max-width:1023px){.top,.scan-top,.nav,.sticky{position:static!important}.fab{display:none!important}.shell,.page,.scan{padding-bottom:0!important}}' : '') });
  await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: !!opts.full });
  await style.evaluate((el) => el.remove());
  log('shot', name);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { stack } = await setup({ gen: REAL ? 'real' : 'fake' });
try {
  const email = unique('shots') + '@example.com';
  const slug = unique('zayit');
  const page = await newPage({ width: 390, height: 844, lang: 'he', previewQ: '' });
  page.on('pageerror', (e) => log('PAGE ERROR', e.message));

  // ---- start
  await page.goto(app());
  await page.locator('.start-form').waitFor();
  await shot(page, '01-start-he');
  {
    const p2 = await newPage({ width: 390, height: 844, lang: 'he' });
    await p2.route('**/config.js', async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: (await res.text()).replace('"providers": []', '"providers": ["google", "apple", "facebook"]') }); });
    await p2.goto(app()); await p2.locator('[data-provider=google]').waitFor();
    await p2.screenshot({ path: path.join(OUT, '01b-start-providers-he.png') }); log('shot 01b');
    await p2.context().close();
  }
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill(PASSWORD);
  await page.locator('form button[type=submit]').click();

  // ---- the place
  await page.locator('[data-field=place]').waitFor({ timeout: 20000 });
  await page.locator('[data-field=place]').fill('זית ירוק');
  await page.locator('[data-avail=free]').waitFor();
  await page.locator('[data-kind=cafe]').click();
  await shot(page, '02-name-he');
  await page.locator('.addr-edit').click();
  await page.locator('[data-field=slug]').fill(slug);
  await page.locator('[data-avail=free]').waitFor();
  await page.locator('form button[type=submit]').click();

  // ---- menu: empty, scan, review
  await page.locator('[data-ways]').waitFor({ timeout: 20000 });
  await shot(page, '03-menu-empty-he');
  const bizId = sql(`select id from public.businesses where slug = '${slug}'`);
  await stackConfig({ ai: { delayMs: 420 } });
  await page.locator('[data-scan-input=pick]').setInputFiles(await menuPhoto());
  await page.waitForFunction(() => Number(document.querySelector('[data-scan]')?.getAttribute('data-scan-count')) >= 6, null, { timeout: 60000 });
  await shot(page, '04-scan-reading-he', { wait: 0 });
  await page.locator('[data-scan=review]').waitFor({ timeout: 60000 });
  await shot(page, '05-scan-review-he');
  await shot(page, '05-scan-review-he-full', { full: true });
  await page.locator('[data-action=scan-add]').click();
  await page.locator('.rows').first().waitFor({ timeout: 20000 });
  await shot(page, '06-menu-he', { wait: 900 });
  await shot(page, '06-menu-he-full', { full: true });

  // ---- pictures
  await page.locator('[data-next=pictures]').click();
  await page.locator('.tiles2').first().waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.tiles2 [data-pic=stock] img').length >= 4 && [...document.querySelectorAll('.tiles2 [data-pic=stock] img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 20000 });
  await shot(page, '07-pictures-he');
  await shot(page, '07-pictures-he-full', { full: true });
  // one photo of the owner's own (the real generator when SHOTS_GEN=real)
  const shak = sql(`select id from public.items where business_id = '${bizId}' and name_he = 'שקשוקה'`);
  await page.locator(`.tile2[data-item="${shak}"] button`).click();
  await page.locator('[data-sheet=picture]').waitFor();
  await shot(page, '07b-picture-sheet-he');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-sheet=picture]').getByRole('button', { name: /הוספת תמונה|תמונה אחרת/ }).click()]);
  await fc.setFiles(PHOTOS.plate);
  await page.locator('[data-sheet=picture] [data-status=working]').waitFor({ timeout: 20000 });
  await page.keyboard.press('Escape');
  await shot(page, '07c-pictures-working-he', { wait: 600 });
  await page.locator(`.tile2[data-item="${shak}"][data-status=review]`).waitFor({ timeout: 240000 });
  await page.locator(`.tile2[data-item="${shak}"] button`).click();
  await page.locator('[data-sheet=picture]').getByRole('button', { name: 'בדיקה ואישור' }).click();
  await page.locator('[data-shot=result][data-ready=true]').waitFor({ timeout: 30000 });
  await shot(page, '07d-review-he');
  await page.locator('[data-action=approve]').click();
  await page.locator(`.tile2[data-item="${shak}"][data-status=approved]`).waitFor({ timeout: 30000 });
  // the picker
  const fish = sql(`select id from public.items where business_id = '${bizId}' and name_he = 'שניצל'`);
  await page.locator(`.tile2[data-item="${fish}"] button`).click();
  await page.locator('[data-action=choose-illustration]').click();
  await page.locator('[data-sheet=illustrations] .pickgrid img').first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-sheet=illustrations] img')].slice(0, 9).every((i) => i.complete && i.naturalWidth > 0));
  await shot(page, '09-picker-he');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  if (await page.locator('dialog[open]').count()) await page.keyboard.press('Escape');

  // ---- the dish sheet
  await page.goto(app('menu'));
  await page.locator(`[data-item="${shak}"] a.row-main`).click();
  await page.locator('[data-sheet=dish]').waitFor();
  await shot(page, '08-dish-sheet-he', { wait: 600 });
  await page.locator('[data-action=more]').click();
  await shot(page, '08b-dish-sheet-more-he', { wait: 300 });
  await page.keyboard.press('Escape');

  // ---- publish
  await page.goto(app('publish'));
  await page.locator('[data-preview=shown]').waitFor({ timeout: 40000 });
  await shot(page, '10-publish-he', { wait: 6000 });
  await shot(page, '10-publish-he-full', { full: true });
  await page.locator('[data-action=publish]').click();
  await page.locator('[data-published-rev]').waitFor({ timeout: 20000 });
  await shot(page, '11-published-he', { wait: 700 });
  await shot(page, '11-published-he-full', { full: true });
  await page.locator('[data-action=table-card]').click();
  await page.locator('[data-table-card]').waitFor();
  await shot(page, '11b-qr-sheet-he', { wait: 500 });
  await page.keyboard.press('Escape');
  await page.locator('[data-action=to-home]').click();

  // ---- dashboard: before any guest, then with numbers
  await page.locator('[data-stats=empty]').waitFor({ timeout: 20000 });
  await shot(page, '13-dashboard-empty-he', { wait: 600 });
  await shot(page, '13-dashboard-empty-he-full', { full: true });
  // a month of guests: today's through the same calls the viewer makes, earlier days written straight into the count tables
  const items = sql(`select id from public.items where business_id = '${bizId}' order by position, created_at`).split('\n');
  const visits = []; for (let i = 0; i < 46; i++) visits.push({ lang: i % 4 === 0 ? 'en' : 'he', src: i % 3 === 0 ? 'link' : 'qr' });
  await guests(slug, visits, [[items[3], 'open', 31], [items[4], 'open', 24], [items[0], 'open', 17], [items[5], 'open', 12], [items[9], 'open', 8], [items[1], 'open', 5], [items[3], 'add', 9], [items[4], 'add', 6], [items[0], 'add', 4]]);
  sql(`insert into public.menu_views_daily (business_id, day, views, views_en, views_qr)
       select '${bizId}', (now() at time zone 'Asia/Jerusalem')::date - g, (18 + 14 * sin(g / 1.9) + (30 - g) * 1.1 + (g % 7 = 5)::int * 22)::int, (5 + (g % 4))::int, (12 + (30 - g) * 0.7)::int from generate_series(1, 29) g`);
  sql(`insert into public.menu_views_hourly (business_id, day, hour, views)
       select '${bizId}', (now() at time zone 'Asia/Jerusalem')::date - 1, h, (case when h between 12 and 14 then 30 + h when h between 19 and 22 then 52 - abs(h - 20) * 9 when h between 8 and 23 then 6 + (h % 5) else 0 end) from generate_series(0, 23) h
       on conflict (business_id, day, hour) do update set views = excluded.views`);
  await page.reload();
  await page.locator('[data-stats=ready]').waitFor({ timeout: 20000 });
  await shot(page, '12-dashboard-he', { wait: 700 });
  await shot(page, '12-dashboard-he-full', { full: true });

  // ---- style, account
  await page.goto(app('style'));
  await page.locator('.strip img').first().waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll('.strip img')].every((i) => i.complete && i.naturalWidth > 0));
  await shot(page, '14-style-he');
  await shot(page, '14-style-he-full', { full: true });
  await page.locator('.acctbtn').click();
  await page.locator('[data-sheet=account]').waitFor();
  await shot(page, '15-account-he');
  await page.keyboard.press('Escape');
  await page.goto(app('menu'));
  await page.locator('.rows').first().waitFor();
  await shot(page, '16-menu-live-he', { wait: 800 });
  await page.goto(app('pictures'));
  await page.locator('.tiles2').first().waitFor();
  await shot(page, '16b-pictures-live-he', { wait: 800 });
  await page.locator('[data-action=preview]').click();
  await page.locator('[data-sheet=preview] [data-preview=shown]').waitFor({ timeout: 40000 });
  await shot(page, '17-preview-sheet-he', { wait: 6000 });
  await page.keyboard.press('Escape');

  // ---- the same key screens in English
  const en = await newPage({ width: 390, height: 844, lang: 'en', previewQ: '' });
  await en.goto(app());
  await en.locator('.start-form').waitFor();
  await en.screenshot({ path: path.join(OUT, '20-start-en.png') }); log('shot 20');
  await en.locator('input[name=email]').fill(email); await en.locator('input[name=password]').fill(PASSWORD);
  await en.locator('form button[type=submit]').click();
  await en.locator('[data-stats=ready]').waitFor({ timeout: 20000 });
  await shot(en, '21-dashboard-en', { wait: 700 });
  await en.goto(app('menu')); await en.locator('.rows').first().waitFor();
  await shot(en, '22-menu-en', { wait: 800 });
  await en.locator(`[data-item="${shak}"] a.row-main`).click(); await en.locator('[data-sheet=dish]').waitFor();
  await shot(en, '23-dish-sheet-en', { wait: 600 });
  await en.keyboard.press('Escape');
  await en.goto(app('pictures')); await en.locator('.tiles2').first().waitFor();
  await shot(en, '24-pictures-en', { wait: 900 });
  await en.goto(app('style')); await en.locator('.strip img').first().waitFor();
  await shot(en, '25-style-en', { wait: 600 });
  await en.goto(app('publish')); await en.locator('[data-preview=shown]').waitFor({ timeout: 40000 });
  await shot(en, '26-publish-en', { wait: 6000 });
  await en.context().close();
  // a new English account: the place and the empty menu
  const en2 = await newPage({ width: 390, height: 844, lang: 'en' });
  await en2.goto(app());
  await en2.locator('input[name=email]').fill(unique('shots-en') + '@example.com'); await en2.locator('input[name=password]').fill(PASSWORD);
  await en2.locator('form button[type=submit]').click();
  await en2.locator('[data-field=place]').waitFor({ timeout: 20000 });
  await en2.locator('[data-field=place]').fill('Green Olive Kitchen');
  await en2.locator('[data-avail=free]').waitFor();
  await shot(en2, '27-name-en');
  await en2.locator('form button[type=submit]').click();
  await en2.locator('[data-ways]').waitFor({ timeout: 20000 });
  await shot(en2, '28-menu-empty-en');
  await stackConfig({ ai: { delayMs: 60, script: 'en' } });
  await en2.locator('[data-scan-input=pick]').setInputFiles(await menuPhoto());
  await en2.locator('[data-scan=review]').waitFor({ timeout: 60000 });
  await shot(en2, '29-scan-review-en');
  await en2.context().close();
  await stackConfig({ ai: 'reset' });

  // ---- 1440 × 900, the preview docked beside the editor
  const wide = await newPage({ width: 1440, height: 900, lang: 'he', previewQ: '' });
  await wide.goto(app());
  await wide.locator('input[name=email]').fill(email); await wide.locator('input[name=password]').fill(PASSWORD);
  await wide.locator('form button[type=submit]').click();
  await wide.locator('[data-stats=ready]').waitFor({ timeout: 20000 });
  await shot(wide, '30-dashboard-he-1440', { wait: 800 });
  await wide.goto(app('menu'));
  await wide.locator('.dock [data-preview=shown]').waitFor({ timeout: 40000 });
  await shot(wide, '31-menu-docked-he-1440', { wait: 7000 });
  await wide.locator(`[data-item="${shak}"] a.row-main`).click(); await wide.locator('[data-sheet=dish]').waitFor();
  await shot(wide, '32-dish-panel-he-1440', { wait: 1500 });
  await wide.keyboard.press('Escape');
  await wide.goto(app('pictures')); await wide.locator('.tiles2').first().waitFor();
  await shot(wide, '33-pictures-docked-he-1440', { wait: 2500 });
  await wide.goto(app('publish')); await wide.locator('.dock [data-preview=shown]').waitFor({ timeout: 40000 });
  await shot(wide, '34-publish-he-1440', { wait: 4000 });
  await wide.context().close();
  await sleep(100);
  log('done →', OUT);
} finally { await teardown(); }
