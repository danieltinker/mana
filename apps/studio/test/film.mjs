// Four short clips of the owner app for the selling film (../brand/tools/film/SCRIPT.md), filmed frame by frame from
// the real app on the local stack: no screen recorder and no real time. The page's timers run on Playwright's clock, CSS
// animations are frozen and moved 1/30 s per frame, and every frame is a 780 × 1688 PNG (390 × 844 at 2×). ffmpeg makes
// H.264 MP4s at 30 fps. The business is Olea, the invented demo restaurant; the scanner is the scripted stand-in, fed
// with Olea's menu and released line by line; the picture generator is the real one (one photo).
//   nice -n 5 node test/film.mjs            → .scratch/film/*.mp4, a frame sheet, and copies in FILM_OUT (if set)
//   FILM_ONLY=scan,menu,relief,dashboard     films only those (earlier steps still run, unfilmed)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setup, teardown, newPage, app, account, signInUi, sql, stackConfig, aiCalls, HERE, MENUS, browser, stack } from './e2e/helpers.mjs';

const WORK = path.resolve(HERE, '../../.scratch/film');
const OUT = process.env.FILM_OUT ? path.resolve(process.env.FILM_OUT) : '';
const ONLY = (process.env.FILM_ONLY || 'scan,menu,relief,dashboard').split(',');
const HOWTO = path.join(MENUS, 'brand/site/img/howto-photo.jpg');
const FPS = 30, W = 390, H = 844;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const ease = (x) => x * x * (3 - 2 * x);
fs.mkdirSync(WORK, { recursive: true });

// ---- Olea's menu as the scanner "reads" it: the demo menu of the guest view, plus the baked pasta of the how-to photo
const demo = JSON.parse(fs.readFileSync(path.join(MENUS, 'apps/view/demo/olea/menu.json'), 'utf8'));
const lines = [];
for (const c of demo.categories) {
  lines.push({ t: 'cat', he: c.name.he, en: c.name.en, kind: c.kind });
  const items = c.items.map((i) => ({ he: i.name.he, en: i.name.en, price: i.price ? i.price.amount : null, dhe: i.desc?.he || '', den: i.desc?.en || '', note: i.price && typeof i.price.note === 'object' ? i.price.note : null, tags: i.tags || [] }));
  if (c.id === 'oven') items.splice(1, 0, { he: 'פסטה אפויה', en: 'Baked pasta', price: 6400, dhe: 'פנה ברוטב עגבניות ומוצרלה, מהטאבון', den: 'Penne in tomato sauce with mozzarella, from the oven', note: null, tags: ['vegetarian'] });
  for (const i of items) lines.push({ t: 'item', he: i.he, en: i.en, dhe: i.dhe, den: i.den, price_minor: i.price, note_he: i.note?.he || '', note_en: i.note?.en || '', tags: i.tags, stock: null });
}
const OLEA = { lang: 'he', lines };
const DISHES = lines.filter((l) => l.t === 'item').length;

// ---- the stage
process.env.STACK_VIEW ||= path.resolve(HERE, '../../.scratch/view-m2');          // the guest view is not in these clips
await setup({ gen: 'real' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
const page = await newPage({ context: ctx, lang: 'he' });
page.on('pageerror', (e) => log('PAGE ERROR', e.message));
await page.clock.install();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Animation.enable');

let filming = false, frameNo = 0;
async function begin() { await park(); await sleep(450);                 // let any hover fade finish in real time before time is frozen
  const now = await page.evaluate(() => Date.now()); await page.clock.pauseAt(now + 20); await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 }); filming = true; }
async function end() { if (!filming) return; await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 }); await page.clock.resume(); filming = false; }
function clip(name) {
  const dir = path.join(WORK, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const file = (n) => path.join(dir, 'f' + String(n).padStart(4, '0') + '.png');
  const c = { name, dir, n: 0,
    /** n frames of film: timers move 1/30 s, animations too, then the picture is taken */
    async frames(n = 1, each) {
      for (let i = 0; i < n; i++) {
        if (each) await each(i, n);
        const dt = Math.round((frameNo + 1) * 1000 / FPS) - Math.round(frameNo * 1000 / FPS); frameNo++;
        await page.clock.runFor(dt);
        await page.evaluate((ms) => { for (const a of document.getAnimations()) { try { a.currentTime = (Number(a.currentTime) || 0) + ms; } catch (e) { /* gone */ } } }, dt);
        await page.screenshot({ path: file(c.n++) });
      }
    },
    /** nothing moves: the last frame again (no timers, no animations) */
    hold(n) { for (let i = 0; i < n; i++) { fs.copyFileSync(file(c.n - 1), file(c.n)); c.n++; } },
    encode() {
      const out = path.join(WORK, name + '.mp4');
      const r = spawnSync('nice', ['-n', '5', 'ffmpeg', '-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.png'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', out]);
      if (r.status !== 0) throw new Error('ffmpeg: ' + r.stderr);
      log('encoded', name, c.n, 'frames', (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
      return out;
    } };
  return c;
}
const rect = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2, top: r.top + window.scrollY, bottom: r.bottom + window.scrollY }; }, sel);
const until = async (fn, ms = 30000, what = 'condition') => { const t0 = Date.now(); for (;;) { if (await fn()) return; if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what); await sleep(25); } };
const has = (sel) => page.evaluate((s) => !!document.querySelector(s), sel);
const park = () => page.mouse.move(1, 420);                             // a phone has no hover: the pointer rests in the page's gutter between presses
const press = async (c, sel, held = 2) => { const r = await rect(sel); if (!r) throw new Error('nothing to press: ' + sel); await page.mouse.move(r.cx, r.cy); await page.mouse.down(); await c.frames(held); await page.mouse.up(); await park(); };
const scrollTo = (y) => page.evaluate((v) => window.scrollTo({ top: v, behavior: 'instant' }), y);
const glide = (c, from, to, n) => c.frames(n, async (i) => { await scrollTo(Math.round(from + (to - from) * ease((i + 1) / n))); });
const imagesIn = (sel) => page.waitForFunction((s) => [...document.querySelectorAll(s + ' img')].every((i) => i.complete && i.naturalWidth > 0), sel, { timeout: 30000 });
const made = {};

try {
  // ---- Olea and its owner (an address at example.com); the menu page that is "photographed"
  const owner = await account('olea@example.com');
  let slug = 'olea';
  let b = await owner.client.rpc('create_business', { p_slug: slug, p_name_he: 'אוליאה', p_name_en: 'Olea', p_kind: 'restaurant', p_contact_name: '', p_contact_phone: '' });
  if (!b.data?.ok) { slug = 'olea-bistro'; b = await owner.client.rpc('create_business', { p_slug: slug, p_name_he: 'אוליאה', p_name_en: 'Olea', p_kind: 'restaurant', p_contact_name: '', p_contact_phone: '' }); }
  if (!b.data?.ok) throw new Error('create_business: ' + JSON.stringify(b.data || b.error));
  const bizId = b.data.id;
  await owner.client.from('businesses').update({ area_he: demo.business.area.he, area_en: demo.business.area.en, cuisine_he: demo.business.cuisine.he, cuisine_en: demo.business.cuisine.en }).eq('id', bizId);
  const pagePhoto = path.join(WORK, 'olea-menu-page.jpg');
  spawnSync('python3', ['-c', `
from PIL import Image, ImageDraw
im = Image.new('RGB', (1500, 2000), (244, 238, 228)); d = ImageDraw.Draw(im)
y = 150
for k in range(58):
    head = k % 8 == 0
    d.rectangle([900 if head else 520, y, 1340, y + (26 if head else 14)], fill=(40, 34, 30) if head else (120, 110, 104))
    if not head: d.rectangle([160, y, 250, y + 14], fill=(120, 110, 104))
    y += 44 if head else 30
im.save(r'${pagePhoto}', quality=88)`]);
  await stackConfig({ ai: 'reset' });
  await stackConfig({ ai: { custom: OLEA, gate: true, released: 0, delayMs: 0 } });

  await signInUi(page, 'olea@example.com');
  await page.locator('[data-ways]').waitFor({ timeout: 30000 });
  await until(() => page.evaluate(() => document.fonts.status === 'loaded'), 15000, 'fonts');
  await sleep(1200);

  // ================================================================ 1 · owner-scan (5 s)
  {
    const c = clip('owner-scan');
    await begin();
    await c.frames(1); c.hold(14);                                       // the empty menu: three ways in
    await press(c, '[data-way=scan]');                                   // "Scan a photo of the menu"
    await c.frames(16);                                                  // the sheet: photograph it, or choose photos
    const chooser = page.waitForEvent('filechooser');
    await press(c, '[data-scan-pick=camera]');                           // "Photograph the menu" (the camera itself cannot be filmed)
    const fc = await chooser;
    await stackConfig({ ai: { released: 2 } });                          // "start" and the printed language go out at once
    await fc.setFiles(pagePhoto);
    await until(() => has('[data-scan=reading]'), 20000, 'the reading screen');
    await c.frames(8);                                                   // "Reading your menu… 0"
    await until(async () => (await aiCalls()).some((x) => x.action === 'scan_menu'), 30000, 'the scan request');
    const L = lines.length, R0 = c.n;
    const due = (r) => (r < 32 ? Math.floor(r / 4) + 1 : Math.min(L, 8 + Math.ceil((r - 31) * (L - 8) / 52)));
    let released = 0, doneSent = false;
    while (c.n < 150) {
      const r = c.n - R0, want = due(r);
      if (want > released) {
        released = want; await stackConfig({ ai: { released: 2 + released } });
        const dishes = lines.slice(0, released).filter((l) => l.t === 'item').length;
        await until(() => page.evaluate((n) => Number(document.querySelector('[data-scan]')?.getAttribute('data-scan-count')) >= n, dishes), 15000, dishes + ' dishes on screen');
      } else if (released >= L && !doneSent && r >= 86) {
        doneSent = true; await stackConfig({ ai: { released: 2 + L + 1 } });
        await until(() => has('[data-scan=review]'), 15000, 'the review');
      }
      await c.frames(1);
    }
    await end();
    if (ONLY.includes('scan')) made.scan = c.encode();
    log('scan: the page read', await page.evaluate(() => document.querySelector('[data-scan]').getAttribute('data-scan-count')), 'of', DISHES, 'dishes');
  }
  await stackConfig({ ai: { gate: false } });

  // ================================================================ 2 · owner-menu (4 s)
  await page.locator('[data-action=scan-add]').click();
  await page.locator('li.row').first().waitFor({ timeout: 30000 });
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await imagesIn('li.row');
  await page.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 15000 });
  await sleep(400);
  {
    const c = clip('owner-menu');
    await begin();
    await c.frames(1); c.hold(17);
    await glide(c, 0, 430, 60);
    await c.frames(1); c.hold(120 - c.n);
    await end();
    if (ONLY.includes('menu')) made.menu = c.encode();
  }
  log('menu:', sql(`select count(*) || ' dishes, ' || count(stock_id) || ' with an illustration' from public.items where business_id = '${bizId}'`));

  // ================================================================ 3 · owner-relief (5 s): the phone photo, the real generator, the relief, Approve
  if (ONLY.includes('relief')) {
  await scrollTo(0);
  await page.locator('[data-next=pictures]').click();
  await page.locator('.tiles2').first().waitFor();
  const pasta = sql(`select id from public.items where business_id = '${bizId}' and name_he = 'פסטה אפויה'`);
  const tile = `.tile2[data-item="${pasta}"]`;
  await page.locator(tile).scrollIntoViewIfNeeded();
  await page.locator(tile + ' button').click();
  await page.locator('[data-sheet=picture]').waitFor();
  {
    const c = clip('owner-relief');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('[data-sheet=picture]').getByRole('button', { name: /בחירת תמונה ל/ }).click()]);
    await fc.setFiles(HOWTO);
    await page.locator('[data-sheet=picture] [data-status=working]').waitFor({ timeout: 30000 });
    // the waiting is cut: filming starts when the generator is at work on the photo (not during the one-time download)
    await page.waitForFunction(() => /מפרידים|מודדים|בונים/.test(document.querySelector('[data-sheet=picture] .picact-state')?.textContent || '') || !!document.querySelector('.tile2[data-status=review]'), null, { timeout: 600000, polling: 50 });
    await begin();
    await c.frames(35);                                                  // the phone photo and a moment of progress
    await end();
    log('relief: progress filmed; state now', await page.evaluate(() => document.querySelector('[data-sheet=picture] .picact-state')?.textContent));
    await page.locator(`${tile}[data-status=review]`).waitFor({ timeout: 600000 });
    await page.locator('[data-sheet=picture]').getByRole('button', { name: 'בדיקה ואישור' }).click();
    await page.locator('canvas[data-shot=result][data-ready=true]').waitFor({ timeout: 60000 });
    await imagesIn('.compare');
    await scrollTo(0); await sleep(500);
    const asset = sql(`select id || '|' || status || '|' || kind || '|' || coalesce(relief_class, '') || '|' || (provenance->>'pipeline') from public.assets where item_id = '${pasta}' order by created_at desc limit 1`);
    log('relief: the generator made', asset);
    await begin();
    await c.frames(1); c.hold(14);                                       // your photo
    const card = await rect('[data-result]'), y1 = Math.max(0, Math.round(card.top - 84));
    await glide(c, 0, y1, 26);
    await c.frames(1); c.hold(19);                                       // the relief that came out
    const btn = await rect('[data-action=approve]'), y2 = Math.round(btn.top - 520);
    await glide(c, y1, y2, 18);
    await c.frames(1);
    await press(c, '[data-action=approve]', 3);                          // Approve
    await until(() => page.evaluate(() => location.hash === '#/pictures' && !!document.querySelector('.tile2[data-status=approved]')), 60000, 'the approved picture');
    await c.frames(4); c.hold(150 - c.n);                              // back on the pictures, with the app's own "approved" line
    await end();
    // The cut that goes to the film, made from the frames above (waiting removed, holds lengthened; no frame is altered):
    // half a second still on the photo, the generator at work, your photo, down to the relief, the relief, down to the
    // decision, Approve in view, pressed, back on the pictures. The frames as filmed stay in owner-relief-raw.
    // It assumes what the run of 7 Oct showed: the generator is still at work in raw frames 0-16 (it finished in frame 17).
    {
      const raw = c.dir + '-raw'; fs.rmSync(raw, { recursive: true, force: true }); fs.renameSync(c.dir, raw); fs.mkdirSync(c.dir);
      const span = (a, b) => Array.from({ length: b - a + 1 }, (_, k) => a + k), times = (i, n) => Array(n).fill(i);
      const order = [...times(0, 15), ...span(1, 16), ...times(35, 12), ...span(50, 75), ...times(76, 14), ...span(96, 113), ...times(114, 9), 115, 116, 117, ...times(117, 3), 118, 119, 120, 121];
      while (order.length < 150) order.push(149);
      const f = (dir, n) => path.join(dir, 'f' + String(n).padStart(4, '0') + '.png');
      order.forEach((i, k) => fs.copyFileSync(f(raw, i), f(c.dir, k)));
      c.n = order.length;
    }
    if (ONLY.includes('relief')) made.relief = c.encode();
    log('relief:', sql(`select a.status || ', item uses it: ' || (i.asset_id = a.id) from public.assets a join public.items i on i.id = a.item_id where i.id = '${pasta}' order by a.created_at desc limit 1`));
  }
  }

  // ================================================================ 4 · owner-dashboard (5 s): publish, a month of guests, Home
  if (ONLY.includes('dashboard')) {
  const pub = await owner.client.rpc('publish_menu', { p_business: bizId, p_note: null });
  if (!pub.data?.ok) throw new Error('publish: ' + JSON.stringify(pub.data || pub.error));
  {
    // Guests arrive through the two calls the guest view makes (open_menu, track_item). Those calls only know "now", so each
    // day's batch is then moved to its day by SQL and its views are spread over the hours of a day.
    const call = (fn, body) => fetch(stack.API_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: stack.ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (r) => { if (!r.ok) throw new Error(fn + ' ' + r.status); await r.arrayBuffer(); });
    const pool = async (tasks, n = 10) => { let k = 0; await Promise.all(Array.from({ length: n }, async () => { while (k < tasks.length) await tasks[k++](); })); };
    const ids = Object.fromEntries(sql(`select name_he || '=' || id from public.items where business_id = '${bizId}'`).split('\n').map((l) => l.split('=')));
    const WEIGHT = { 'שקשוקה בטאבון': 16, 'המבורגר אוליאה': 13, 'מרגריטה': 12, 'חומוס חם': 10, 'עוגת גבינה באסקית': 8, 'פפרדלה סלמון': 7, 'סלט קצוץ': 6, 'לימונדה עם נענע': 6, 'קבב טלה': 5, 'כנאפה עם גלידה': 5, 'פסטה אפויה': 5, 'דניס שלם': 4, 'לאבנה וזיתים': 4, 'סלמי חריף': 3, 'מיץ תפוזים סחוט': 3, 'לבן הבית': 2, 'לאגר': 2 };
    const total = Object.values(WEIGHT).reduce((a, x) => a + x, 0);
    for (const name of Object.keys(WEIGHT)) if (!ids[name]) throw new Error('no such dish: ' + name);
    const BY_WEEKDAY = [38, 33, 36, 44, 63, 78, 71];                     // Sunday … Saturday: a neighbourhood bistro
    const HOURS = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 3, 7, 9, 7, 3, 2, 3, 5, 9, 11, 9, 5, 2];
    const now = new Date(Date.now() + 3 * 3600e3), weekday = now.getUTCDay(), hourNow = now.getUTCHours();       // Israel summer time
    let calls = 0, views = 0;
    for (let g = 29; g >= 0; g--) {
      const wd = ((weekday - g) % 7 + 7) % 7, growth = g >= 21 ? 0.8 : g >= 14 ? 0.86 : g >= 7 ? 0.9 : 1;
      let V = Math.round(BY_WEEKDAY[wd] * growth + ((g * 7) % 5) - 2);
      const hours = HOURS.map((w, h) => (g === 0 && h > hourNow ? 0 : w)), hs = hours.reduce((a, x) => a + x, 0);
      if (g === 0) V = Math.round(V * hs / 80);
      const tasks = [];
      for (let k = 0; k < V; k++) tasks.push(() => call('open_menu', { p_slug: slug, p_lang: (k * 13 + g * 7) % 100 < 19 ? 'en' : 'he', p_src: (k * 29 + g * 11) % 100 < 72 ? 'qr' : 'link' }));
      for (const [name, w] of Object.entries(WEIGHT)) {
        const opens = Math.round(V * 1.35 * w / total + ((g + w) % 3 === 0 ? 1 : 0)), adds = Math.round(opens * 0.11);
        for (let k = 0; k < opens; k++) tasks.push(() => call('track_item', { p_slug: slug, p_item: ids[name], p_kind: 'open' }));
        for (let k = 0; k < adds; k++) tasks.push(() => call('track_item', { p_slug: slug, p_item: ids[name], p_kind: 'add' }));
      }
      await pool(tasks, 10); calls += tasks.length; views += V;
      let left = V; const spread = hours.map((w) => Math.floor(V * w / hs)); left -= spread.reduce((a, x) => a + x, 0);
      const pref = [20, 13, 19, 12, 21, 14, 18, 11].filter((x) => hours[x] > 0);
      for (let k = 0; left > 0 && pref.length; k++) { spread[pref[k % pref.length]]++; left--; }
      const day = `((now() at time zone 'Asia/Jerusalem')::date - ${g})`, today = `(now() at time zone 'Asia/Jerusalem')::date`;
      sql(`${g > 0 ? `update public.menu_views_daily set day = ${day} where business_id = '${bizId}' and day = ${today};
        update public.item_events_daily set day = ${day} where business_id = '${bizId}' and day = ${today};` : ''}
        delete from public.menu_views_hourly where business_id = '${bizId}' and day = ${today};
        insert into public.menu_views_hourly (business_id, day, hour, views) values ${spread.map((n, h) => (n > 0 ? `('${bizId}', ${day}, ${h}, ${n})` : '')).filter(Boolean).join(', ')};`);
    }
    log('guests:', calls, 'calls,', views, 'views in 30 days;', sql(`select 'week ' || sum(views) filter (where day > (now() at time zone 'Asia/Jerusalem')::date - 7) || ', week before ' || sum(views) filter (where day <= (now() at time zone 'Asia/Jerusalem')::date - 7 and day > (now() at time zone 'Asia/Jerusalem')::date - 14) from public.menu_views_daily where business_id = '${bizId}'`));
  }
  {
    const held = [];
    await page.route('**/rest/v1/rpc/my_stats', (route) => { held.push(route); });           // the numbers wait until the film has shown the empty tiles
    await page.goto(app(''));
    await page.locator('[data-stats=loading]').waitFor({ timeout: 30000 });
    await until(() => held.length > 0, 15000, 'the numbers request');
    await sleep(900);
    const c = clip('owner-dashboard');
    await begin();
    await c.frames(1); c.hold(14);                                       // Home: the tiles as outlines
    for (const r of held.splice(0)) await r.continue();
    await page.unroute('**/rest/v1/rpc/my_stats');
    await until(() => has('[data-stats=ready]'), 20000, 'the numbers');
    await c.frames(2); c.hold(28);                                       // the numbers are in
    const small = await rect('[data-tile=hours]'), yEnd = Math.max(0, Math.round(small.bottom - (H - 62 - 22)));
    await glide(c, 0, yEnd, 60);
    await c.frames(1); c.hold(150 - c.n);
    await end();
    if (ONLY.includes('dashboard')) made.dashboard = c.encode();
    log('dashboard:', await page.evaluate(() => [...document.querySelectorAll('[data-n]')].map((e) => e.getAttribute('data-n') + '=' + e.textContent.trim()).join(' ')));
  }
  }
} finally {
  await end().catch(() => {});
  await ctx.close().catch(() => {});
  await teardown();
}

// ---- a frame sheet of every clip made: twelve frames each, left to right in time
const names = { scan: 'owner-scan', menu: 'owner-menu', relief: 'owner-relief', dashboard: 'owner-dashboard' };
const done = Object.keys(names).filter((k) => fs.existsSync(path.join(WORK, names[k] + '.mp4')) && fs.existsSync(path.join(WORK, names[k], 'f0000.png')));     // also clips of an earlier run
if (done.length) {
  const sheet = path.join(WORK, 'owner-clips-frames.jpg');
  const r = spawnSync('python3', ['-c', `
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont
work, names = sys.argv[1], sys.argv[2:]
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
tw, th, cols, pad, cap = 195, 422, 12, 8, 30
img = Image.new('RGB', (pad + cols * (tw + pad), pad + len(names) * (th + cap + pad)), (24, 24, 24)); d = ImageDraw.Draw(img)
for row, name in enumerate(names):
    files = sorted(glob.glob(os.path.join(work, name, 'f*.png'))); n = len(files)
    y = pad + row * (th + cap + pad)
    d.text((pad, y + 4), f'{name}.mp4   {n} frames   {n / 30:.1f} s', font=font, fill=(240, 240, 240))
    for k in range(cols):
        i = round(k * (n - 1) / (cols - 1))
        im = Image.open(files[i]).convert('RGB').resize((tw, th), Image.LANCZOS)
        img.paste(im, (pad + k * (tw + pad), y + cap))
        d.text((pad + k * (tw + pad) + 4, y + cap + 4), f'{i / 30:.2f}s', font=font, fill=(255, 220, 90))
img.save(sys.argv[1] + '/owner-clips-frames.jpg', quality=88)
`, WORK, ...done.map((k) => names[k])]);
  if (r.status !== 0) console.error(String(r.stderr)); else log('frame sheet', sheet);
  if (OUT) { fs.mkdirSync(OUT, { recursive: true }); for (const k of done) fs.copyFileSync(path.join(WORK, names[k] + '.mp4'), path.join(OUT, names[k] + '.mp4')); log('copied to', OUT); }
}
