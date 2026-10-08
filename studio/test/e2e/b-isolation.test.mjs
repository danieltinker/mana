// (b) Owner isolation. A second account must not read or change the first one's business, categories, items, assets,
// storage objects, revisions, entitlement or numbers: tried directly with supabase-js using the second user's session
// (the real RLS, triggers and storage policies of db/0001 and db/0002 answer), through the menus-ai stand-in, and through the app.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setup, teardown, newPage, app, account, anon, seedBusiness, signInUi, sql, PHOTOS, PASSWORD, stack, guests } from './helpers.mjs';

let A, B, a, b, assetA, pathA;
const jpeg = () => new Blob([fs.readFileSync(PHOTOS.plate2)], { type: 'image/jpeg' });
const png = () => new Blob([fs.readFileSync(PHOTOS.plate2.replace('.jpg', '.gt.png'))], { type: 'image/png' });

before(async () => {
  await setup({ gen: 'fake' });
  A = await account(); B = await account();
  a = await seedBusiness(A.client, { nameHe: 'הסוד של אלף', nameEn: 'Alef Secret', items: [['מנת הבית הסודית', 'Secret house dish', 8800]] });
  b = await seedBusiness(B.client, { nameHe: 'בית בית', nameEn: 'Bet House', items: [['סלט', 'Salad', 3000]] });
  // A: one approved picture (through the real flow) and a published menu
  const ins = await A.client.from('assets').insert({ business_id: a.id, item_id: a.items[0].id, status: 'uploaded', kind: 'relief' }).select().single();
  assert.equal(ins.error, null); assetA = ins.data.id; pathA = `${a.id}/${assetA}/`;
  for (const [f, blob] of [['original.jpg', jpeg()], ['color.jpg', jpeg()], ['thumb.jpg', jpeg()], ['aux.png', png()]]) assert.equal((await A.client.storage.from('menu-private').upload(pathA + f, blob)).error, null, f);
  assert.equal((await A.client.from('assets').update({ status: 'processing', original_path: pathA + 'original.jpg' }).eq('id', assetA)).error, null);
  assert.equal((await A.client.from('assets').update({ status: 'ready_for_review', relief_class: 'medium', color_path: pathA + 'color.jpg', aux_path: pathA + 'aux.png', thumb_path: pathA + 'thumb.jpg', meta: { e: 48, h: 0.2 } }).eq('id', assetA)).error, null);
  // approving before the files are copied is refused by the database
  assert.equal((await A.client.from('assets').update({ status: 'approved' }).eq('id', assetA)).error?.message, 'asset_files_missing');
  for (const f of ['color.jpg', 'thumb.jpg', 'aux.png']) assert.equal((await A.client.storage.from('menu-private').copy(pathA + f, pathA + f, { destinationBucket: 'menu-public' })).error, null);
  assert.equal((await A.client.from('assets').update({ status: 'approved' }).eq('id', assetA)).error, null);
  assert.equal((await A.client.from('items').update({ asset_id: assetA }).eq('id', a.items[0].id)).error, null);
  assert.equal((await A.client.rpc('publish_menu', { p_business: a.id })).data.ok, true);
  await guests(a.slug, [{ lang: 'he', src: 'qr' }, { lang: 'en', src: 'link' }], [[a.items[0].id, 'open', 2], [a.items[0].id, 'add', 1]]);      // the first business has numbers of its own
});
after(async () => { await teardown(); });

test('reading: the second account sees nothing of the first one', async () => {
  const biz = await B.client.from('businesses').select('id, slug');
  assert.deepEqual(biz.data.map((r) => r.id), [b.id]);
  for (const [table, col] of [['businesses', 'id'], ['memberships', 'business_id'], ['menus', 'business_id'], ['categories', 'business_id'], ['items', 'business_id'], ['assets', 'business_id'], ['entitlements', 'business_id'], ['menu_revisions', 'business_id'], ['menu_views_daily', 'business_id'], ['menu_views_hourly', 'business_id'], ['item_events_daily', 'business_id']]) {
    const r = await B.client.from(table).select('*').eq(col, a.id);
    assert.equal(r.error, null, table); assert.deepEqual(r.data, [], table + ' of another business is invisible');
  }
  assert.equal((await B.client.from('items').select('*').eq('id', a.items[0].id)).data.length, 0);
  assert.ok((await A.client.from('menu_revisions').select('number').eq('business_id', a.id)).data.length === 1, 'the owner does see its own');
  const prev = await B.client.rpc('preview_snapshot', { p_business: a.id });
  assert.equal(prev.error?.message, 'not_member');
  for (const t of ['app_config', 'staff', 'leads', 'signup_attempts', 'ai_usage_daily']) assert.ok((await B.client.from(t).select('*')).error, t + ' is closed');
  assert.ok((await B.client.rpc('ops_overview')).error, 'staff overview refused');
  assert.ok((await B.client.rpc('ops_business_stats')).error, 'staff numbers refused');
  // v2: the numbers of a business are its members' only
  const mine = await A.client.rpc('my_stats', { p_business: a.id });
  assert.deepEqual([mine.data.totals.views30, mine.data.totals.en30, mine.data.totals.qr30, mine.data.totals.opens30, mine.data.totals.adds30, mine.data.items[0].id], [2, 1, 1, 2, 1, a.items[0].id]);
  assert.equal((await A.client.from('menu_views_hourly').select('views').eq('business_id', a.id)).data.reduce((n, r) => n + r.views, 0), 2, 'the owner does see its own');
  assert.equal((await B.client.rpc('my_stats', { p_business: a.id })).error?.message, 'not_member');
  assert.ok((await anon().rpc('my_stats', { p_business: a.id })).error, 'anonymous cannot ask for numbers');
  assert.equal((await B.client.rpc('my_entitlement_state', { p_business: a.id })).data, null);
  assert.equal((await B.client.rpc('my_stats', { p_business: b.id })).data.totals.viewsAll, 0, 'and its own numbers hold nothing of the other');
});

test('writing: updates, deletes and inserts aimed at the other business change nothing', async () => {
  const before = sql(`select md5(string_agg(t::text, '|')) from (select * from public.businesses where id = '${a.id}' union all select * from public.businesses where false) t`)
    + sql(`select md5(coalesce(string_agg(i::text, '|'), '')) from public.items i where business_id = '${a.id}'`) + sql(`select md5(coalesce(string_agg(c::text, '|'), '')) from public.categories c where business_id = '${a.id}'`)
    + sql(`select md5(coalesce(string_agg(x::text, '|'), '')) from public.assets x where business_id = '${a.id}'`) + sql(`select md5(e::text) from public.entitlements e where business_id = '${a.id}'`) + sql(`select md5(m::text) from public.menus m where business_id = '${a.id}'`);
  const zero = async (p, what) => { const r = await p; assert.ok(r.error || (r.data || []).length === 0, what + ' must not touch a row: ' + JSON.stringify(r.data)); };
  await zero(B.client.from('businesses').update({ name_he: 'נפרץ' }).eq('id', a.id).select(), 'business update');
  await zero(B.client.from('menus').update({ surface: 'holo' }).eq('business_id', a.id).select(), 'menu update');
  await zero(B.client.from('categories').update({ name_he: 'נפרץ' }).eq('business_id', a.id).select(), 'category update');
  await zero(B.client.from('categories').delete().eq('business_id', a.id).select(), 'category delete');
  await zero(B.client.from('items').update({ price_minor: 1, available: false }).eq('business_id', a.id).select(), 'item update');
  await zero(B.client.from('items').update({ stock_id: 'pizza' }).eq('id', a.items[0].id).select(), 'placeholder update');
  await zero(B.client.from('items').delete().eq('id', a.items[0].id).select(), 'item delete');
  await zero(B.client.from('assets').update({ status: 'rejected' }).eq('id', assetA).select(), 'asset update');
  await zero(B.client.from('assets').delete().eq('id', assetA).select(), 'asset delete');
  await zero(B.client.from('entitlements').update({ status: 'active', plan: 'paid' }).eq('business_id', a.id).select(), 'entitlement update');
  await zero(B.client.from('menu_revisions').delete().eq('business_id', a.id).select(), 'revision delete');
  // inserts into the other business
  assert.ok((await B.client.from('categories').insert({ business_id: a.id, name_he: 'זר' })).error, 'category insert refused');
  assert.ok((await B.client.from('items').insert({ business_id: a.id, category_id: a.category.id, name_he: 'זר' })).error, 'item insert refused');
  assert.ok((await B.client.from('assets').insert({ business_id: a.id, item_id: a.items[0].id, status: 'uploaded' })).error, 'asset insert refused');
  assert.ok((await B.client.from('memberships').insert({ business_id: a.id, user_id: (await B.client.auth.getUser()).data.user.id })).error, 'cannot add oneself as a member');
  assert.ok((await B.client.from('menu_revisions').insert({ business_id: b.id, number: 99, snapshot: {} })).error, 'revisions are written only by publish_menu');
  // own rows pointing across the border
  assert.equal((await B.client.from('items').insert({ business_id: b.id, category_id: a.category.id, name_he: 'זר' })).error?.message, 'category_of_other_business');
  assert.equal((await B.client.from('items').update({ asset_id: assetA }).eq('id', b.items[0].id)).error?.message, 'asset_not_approved');
  assert.equal((await B.client.from('assets').insert({ business_id: b.id, item_id: a.items[0].id, status: 'uploaded' })).error?.message, 'item_of_other_business');
  const own = await B.client.from('assets').insert({ business_id: b.id, item_id: b.items[0].id, status: 'uploaded' }).select().single();
  assert.equal(own.error, null);
  assert.equal((await B.client.from('assets').update({ original_path: pathA + 'original.jpg' }).eq('id', own.data.id)).error?.message, 'path_of_other_business');
  assert.equal((await B.client.from('assets').update({ business_id: a.id }).eq('id', own.data.id)).error !== null, true, 'a row cannot move to another business');
  // owners themselves: the address is permanent and the plan is not theirs to set
  assert.ok((await A.client.from('businesses').update({ slug: 'renamed-slug' }).eq('id', a.id)).error, 'slug is fixed');
  assert.ok((await A.client.from('entitlements').update({ status: 'active' }).eq('business_id', a.id)).error, 'an owner cannot change the plan');
  // RPCs
  assert.deepEqual((await B.client.rpc('publish_menu', { p_business: a.id })).data, { ok: false, code: 'not_member' });
  assert.deepEqual((await B.client.rpc('restore_revision', { p_business: a.id, p_number: 1 })).data, { ok: false, code: 'not_member' });
  assert.deepEqual((await B.client.rpc('unpublish_menu', { p_business: a.id })).data, { ok: false, code: 'not_member' });
  assert.ok((await B.client.rpc('ops_set_entitlement', { p_business: b.id, p_plan: 'paid', p_status: 'active' })).error, 'staff function refused');
  // v2: approving someone else's picture, and spending someone else's AI allowance
  assert.deepEqual((await B.client.rpc('approve_asset', { p_asset: assetA })).data, { ok: false, code: 'not_member' });
  assert.deepEqual((await B.client.rpc('ai_take', { p_business: a.id, p_kind: 'scan_menu' })).data, { ok: false, code: 'not_member' });
  assert.equal(sql(`select count(*) from public.ai_usage_daily where business_id = '${a.id}'`), '0');
  const token = (await B.client.auth.getSession()).data.session.access_token;
  const ai = (body, t) => fetch(stack.API_URL + '/functions/v1/menus-ai', { method: 'POST', headers: { apikey: stack.ANON_KEY, authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const img = { media_type: 'image/jpeg', data: Buffer.alloc(600, 7).toString('base64') };
  assert.equal((await (await ai({ action: 'scan_menu', business_id: a.id, image: img }, token)).text()).trim(), '{"t":"error","code":"not_member"}', 'a scan for the other business is refused');
  assert.deepEqual(await (await ai({ action: 'describe_dish', business_id: a.id, image: img }, token)).json(), { ok: false, code: 'not_member' });
  assert.equal((await (await ai({ action: 'scan_menu', business_id: b.id, image: img }, stack.ANON_KEY)).text()).trim(), '{"t":"error","code":"not_member"}', 'the public key alone is not a session');
  // counting a visit is open to anyone (that is its purpose), but only for a real dish of that menu
  await guests(a.slug, [], [[b.items[0].id, 'open', 3]]);
  assert.equal(sql(`select count(*) from public.item_events_daily where item_id = '${b.items[0].id}'`), '0', 'a dish of another menu is not counted under this one');
  const after = sql(`select md5(string_agg(t::text, '|')) from (select * from public.businesses where id = '${a.id}' union all select * from public.businesses where false) t`)
    + sql(`select md5(coalesce(string_agg(i::text, '|'), '')) from public.items i where business_id = '${a.id}'`) + sql(`select md5(coalesce(string_agg(c::text, '|'), '')) from public.categories c where business_id = '${a.id}'`)
    + sql(`select md5(coalesce(string_agg(x::text, '|'), '')) from public.assets x where business_id = '${a.id}'`) + sql(`select md5(e::text) from public.entitlements e where business_id = '${a.id}'`) + sql(`select md5(m::text) from public.menus m where business_id = '${a.id}'`);
  assert.equal(after, before, 'every row of the first business is byte-for-byte what it was');
  assert.equal((await anon().rpc('public_menu', { p_slug: a.slug })).data.state, 'ok', 'still published');
});

test('files: private objects of another business cannot be read, listed, signed, copied, overwritten or removed', async () => {
  const priv = B.client.storage.from('menu-private'), pub = B.client.storage.from('menu-public');
  assert.ok((await priv.download(pathA + 'original.jpg')).error, 'download refused');
  assert.ok((await priv.createSignedUrl(pathA + 'original.jpg', 60)).error, 'signed URL refused');
  const many = await priv.createSignedUrls([pathA + 'original.jpg', pathA + 'color.jpg'], 60);
  assert.ok(many.error || many.data.every((x) => !x.signedUrl), 'signed URLs refused');
  assert.deepEqual((await priv.list(a.id + '/' + assetA)).data || [], [], 'listing shows nothing');
  assert.deepEqual((await priv.list(a.id)).data || [], []);
  assert.ok((await priv.upload(pathA + 'evil.jpg', jpeg())).error, 'upload into the other folder refused');
  assert.ok((await priv.upload(pathA + 'original.jpg', jpeg(), { upsert: true })).error, 'overwrite refused');
  assert.ok((await pub.upload(pathA + 'color.jpg', jpeg(), { upsert: true })).error, 'overwrite of a public file refused');
  assert.ok((await pub.upload(`${a.id}/brand/logo-x.png`, png())).error, 'logo of the other business refused');
  assert.deepEqual((await priv.remove([pathA + 'original.jpg'])).data || [], [], 'remove deletes nothing');
  assert.deepEqual((await pub.remove([pathA + 'color.jpg'])).data || [], []);
  assert.ok((await priv.copy(pathA + 'original.jpg', `${b.id}/stolen/original.jpg`)).error, 'copy out refused');
  const mine = `${b.id}/x/original.jpg`;
  assert.equal((await priv.upload(mine, jpeg())).error, null);
  assert.ok((await priv.copy(mine, pathA + 'planted.jpg', { destinationBucket: 'menu-public' })).error, 'copy in refused');
  assert.equal(sql(`select count(*) from storage.objects where name like '${a.id}/%'`), '7', 'the first business still has exactly its 4 private + 3 public files');
  // anonymous: the private bucket is closed, the approved public copies are open (that is their purpose)
  assert.notEqual((await fetch(`${stack.API_URL}/storage/v1/object/public/menu-private/${pathA}original.jpg`)).status, 200);
  assert.notEqual((await fetch(`${stack.API_URL}/storage/v1/object/menu-private/${pathA}original.jpg`, { headers: { apikey: stack.ANON_KEY } })).status, 200);
  assert.equal((await fetch(`${stack.API_URL}/storage/v1/object/public/menu-public/${pathA}color.jpg`)).status, 200);
  assert.ok((await anon().from('businesses').select('*')).error, 'anonymous cannot read tables');
  assert.ok((await anon().rpc('create_business', { p_slug: 'anon-try', p_name_he: 'x' })).error, 'anonymous cannot create a business');
});

test('in the app: the second owner finds only its own business, and deep links to the other one lead nowhere', async () => {
  const page = await newPage({ width: 390, height: 844 });
  await signInUi(page, B.email);
  await page.getByRole('link', { name: 'עריכת סלט' }).waitFor({ timeout: 20000 });            // an unpublished business opens on the first step of the path: its menu
  await page.goto(app('menu/i/' + a.items[0].id));
  await page.getByText('המנה הזאת לא נמצאה').waitFor();
  await page.keyboard.press('Escape');
  await page.goto(app('menu/item/' + a.items[0].id));                                        // the old address of the same thing
  await page.getByText('המנה הזאת לא נמצאה').waitFor();
  await page.keyboard.press('Escape');
  await page.goto(app('pictures/' + assetA));
  await page.getByText('התמונה הזאת לא נמצאה').waitFor();
  await page.goto(app('menu'));
  await page.getByRole('link', { name: 'עריכת סלט' }).waitFor();
  const text = await page.locator('body').innerText();
  assert.ok(!/הסוד של אלף|מנת הבית הסודית|Alef Secret/.test(text));
  assert.deepEqual(page.problems, []);
  await page.context().close();
});

test('same browser, another account: nothing of the previous owner stays on screen or in storage', async () => {
  const page = await newPage({ width: 390, height: 844 });
  await signInUi(page, A.email);
  await page.getByRole('heading', { name: 'הסוד של אלף', level: 1 }).waitFor({ timeout: 15000 });
  await page.goto(app('menu'));
  await page.getByRole('link', { name: 'עריכת מנת הבית הסודית' }).waitFor();
  assert.equal(await page.locator('[data-n=views30]').count(), 0);
  await page.goto(app(''));
  await page.locator('[data-stats=ready]').waitFor({ timeout: 15000 });
  // (an earlier test opened this menu as a guest, and that counts: the number on screen is whatever the database holds now)
  const views30 = (await A.client.rpc('my_stats', { p_business: a.id })).data.totals.views30;
  assert.ok(views30 >= 2);
  assert.equal(await page.locator('[data-n=views30]').innerText(), String(views30), 'the first owner sees its own numbers');
  await page.getByRole('button', { name: 'חשבון' }).click();
  await page.locator('[data-menu=sign-out]').click();
  await page.locator('input[name=email]').waitFor();
  assert.ok(!/הסוד של אלף|מנת הבית הסודית/.test(await page.locator('body').innerText()), 'signed out: nothing left on screen');
  await page.locator('input[name=email]').fill(B.email); await page.locator('input[name=password]').fill(PASSWORD);
  await page.locator('form button[type=submit]').click();
  await page.getByRole('link', { name: 'עריכת סלט' }).waitFor({ timeout: 20000 });
  for (const hash of ['', 'menu', 'pictures', 'publish', 'style']) {
    await page.goto(app(hash)); await page.waitForTimeout(400);
    assert.ok(!/הסוד של אלף|מנת הבית הסודית|Alef Secret/.test(await page.locator('body').innerText()), 'nothing of the first business on ' + (hash || 'home'));
  }
  const stored = await page.evaluate(() => JSON.stringify(Object.entries(localStorage)));
  assert.ok(!stored.includes('הסוד של אלף') && !stored.includes(a.slug), 'no business data is kept in browser storage');

  await page.context().close();
});

test('one account, two businesses: the switcher changes everything on screen', async () => {
  const second = await seedBusiness(A.client, { nameHe: 'הסניף השני', nameEn: 'Second Branch', items: [['פיצה', 'Pizza', 6000]] });
  const page = await newPage({ width: 390, height: 844 });
  await signInUi(page, A.email);
  await page.locator('h1').first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'חשבון' }).click();
  await page.locator('.bizrow', { hasText: 'הסניף השני' }).click();
  await page.getByRole('link', { name: 'עריכת פיצה' }).waitFor({ timeout: 15000 });        // the second place is not published yet: it opens on its menu
  assert.equal(await page.locator('.shell').getAttribute('data-mode'), 'path', 'each business has its own path');
  assert.match(await page.locator('.bizline').innerText(), /הסניף השני/, 'with two places, the open one is named');
  assert.ok(!/מנת הבית הסודית/.test(await page.locator('body').innerText()));
  await page.reload();
  await page.getByRole('link', { name: 'עריכת פיצה' }).waitFor({ timeout: 15000 });        // the choice is remembered
  await page.getByRole('button', { name: 'חשבון' }).click();
  await page.locator('.bizrow', { hasText: 'הסוד של אלף' }).click();
  await page.locator('[data-stats]').waitFor({ timeout: 15000 });
  assert.equal(await page.locator('.shell').getAttribute('data-mode'), 'tabs');
  assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), 'הסוד של אלף');
  assert.ok(second.id);
  await page.context().close();
});
