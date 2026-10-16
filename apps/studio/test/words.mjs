// How many words does an owner have to read? Counts the visible words on each screen of the main path at 390 × 844 in
// Hebrew, in the old app (branch master, checked out to .scratch/master) and in this one, against the same local stack
// and the same menu.
//   git worktree add -f .scratch/master master      (once)
//   node test/words.mjs                              → prints the table, writes test/.out/words.json and .shots/v2/words.txt
//
// What counts as a word: a run of characters with at least one letter in it, in text an owner can see. Not counted: text
// for screen readers only, closed "more" blocks, unselected options, the diner's menu inside the preview frame, and the
// owner's own words (the names, descriptions and address typed for the test). "All" keeps the owner's words in.
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { setup, teardown, newPage, app, unique, PASSWORD, PHOTOS, HERE, sql } from './e2e/helpers.mjs';

const MASTER = path.resolve(HERE, '../../.scratch/master/dist');
if (!fs.existsSync(path.join(MASTER, 'index.html'))) { console.error('The old app is not there. Run: git worktree add -f .scratch/master master'); process.exit(1); }
const SHOTS = process.env.WORDS_SHOTS ? path.resolve(process.env.WORDS_SHOTS) : '';
const MENU = [
  { he: 'ראשונות', en: 'Starters', kind: 'food', items: [['חומוס הבית', 'House hummus', 3200, 'גרגרים חמים, שמן זית וטחינה'], ['סלט קצוץ', 'Chopped salad', 3800, ''], ['מרק היום', 'Soup of the day', null, ''], ['לחם הבית', 'House bread', 1800, '']] },
  { he: 'עיקריות', en: 'Mains', kind: 'food', items: [['שקשוקה', 'Shakshuka', 5400, 'שתי ביצים ברוטב עגבניות חריף'], ['שניצל', 'Schnitzel', 6800, ''], ['פסטה ברוטב עגבניות', 'Pasta in tomato sauce', 5900, ''], ['המבורגר', 'Burger', 7200, '']] },
];
const PLACE = ['זית ירוק', 'Green Olive'];

/** Runs in the page: the words in sight right now. With a sheet or a dialog open, only what is inside it. */
function countWords(own) {
  const root = [...document.querySelectorAll('dialog[open]')].pop() || document.body;
  const seen = (el) => {
    if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      if (e.matches('.sr, .hp, [hidden], script, style, noscript, template, iframe')) return false;
      const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      if (cs.overflow !== 'visible' && (r.width <= 1 || r.height <= 1)) return false;                 // clipped away (the usual "screen reader only" trick)
      if (root === document.body && e.tagName === 'DIALOG' && !e.open) return false;
    }
    return true;
  };
  const parts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.nodeValue.trim(), el = n.parentElement;
    if (!text || !el || !seen(el)) continue;
    const option = el.closest('option');
    if (option && !option.selected) continue;
    parts.push(text);
  }
  for (const el of root.querySelectorAll('input[placeholder], textarea[placeholder]')) if (!el.value && el.type !== 'hidden' && seen(el)) parts.push(el.placeholder);
  const tokens = (s) => s.split(/\s+/).filter((w) => /\p{L}/u.test(w));
  const all = parts.join(' \n ');
  let ui = all;
  for (const s of [...own].sort((a, b) => b.length - a.length)) if (s) ui = ui.split(s).join(' ');
  return { all: tokens(all).length, ui: tokens(ui).length, text: ui.replace(/\s+/g, ' ').trim() };
}

async function run(variant) {
  if (variant === 'v1') process.env.STACK_STUDIO = MASTER; else delete process.env.STACK_STUDIO;
  const { stack } = await setup({ gen: 'fake' });
  const rows = [];
  try {
    const email = unique('words') + '@example.com', slug = unique('zayit');
    const own = [...PLACE, email, slug, 'halom.io/m/' + slug, 'https://halom.io/m/' + slug, 'דנה לוי', '050-123 4567', ...MENU.flatMap((c) => [c.he, c.en, ...c.items.flatMap((i) => [i[0], i[1], i[3]])])];
    const page = await newPage({ width: 390, height: 844, lang: 'he' });
    const count = async (name, wait = 500) => {
      await page.waitForTimeout(wait);
      const r = await page.evaluate(countWords, own);
      rows.push({ screen: name, all: r.all, ui: r.ui, text: r.text });
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${variant}-${String(rows.length).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '-')}.png`), fullPage: !(await page.locator('dialog[open]').count()) }); }
      console.log(variant, name.padEnd(28), String(r.ui).padStart(4), String(r.all).padStart(4));
    };
    const client = createClient(stack.API_URL, stack.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    // ---- getting in
    await page.goto(app());
    await page.locator('input[name=email]').waitFor();
    await count('start');
    if (variant === 'v1') {
      await page.getByRole('tab', { name: 'חשבון חדש' }).click();
      await count('start: new account');
    }
    await page.locator('input[name=email]').fill(email); await page.locator('input[name=password]').fill(PASSWORD);
    await page.waitForTimeout(2600);                                           // the sign-up function refuses forms filled faster than a person can
    await page.locator('form button[type=submit]').click();

    // ---- the place
    if (variant === 'v1') {
      await page.getByRole('heading', { name: 'איך קוראים לעסק?' }).waitFor({ timeout: 20000 });
      await count('set-up 1: name');
      await page.getByLabel('שם בעברית').fill(PLACE[0]); await page.getByLabel('שם באנגלית').fill(PLACE[1]);
      await page.locator('form button[type=submit]').click();
      await page.getByRole('heading', { name: 'הכתובת של התפריט' }).waitFor();
      await page.getByLabel('כתובת התפריט').fill(slug);
      await page.getByText('הכתובת פנויה').waitFor();
      await count('set-up 2: address');
      await page.locator('form button[type=submit]').click();
      await page.getByLabel('שם', { exact: true }).waitFor();
      await count('set-up 3: contact');
      await page.getByLabel('שם', { exact: true }).fill('דנה לוי'); await page.getByLabel('טלפון').fill('050-123 4567');
      await page.locator('form button[type=submit]').click();
      await page.getByRole('heading', { name: 'בודקים ויוצרים' }).waitFor();
      await count('set-up 4: check');
      await page.locator('form button[type=submit]').click();
      await page.locator('.steplist').waitFor({ timeout: 20000 });
      await count('home before publishing');
      await page.goto(app('menu'));
      await page.locator('.empty').first().waitFor();
      await count('menu, empty');
    } else {
      await page.locator('[data-field=place]').waitFor({ timeout: 20000 });
      await page.locator('[data-field=place]').fill(PLACE[0]);
      await page.locator('[data-avail=free]').waitFor();
      await count('set-up');                                                    // as an owner meets it: the address is suggested, nothing to open
      await page.locator('.addr-edit').click(); await page.locator('[data-field=slug]').fill(slug);
      await page.locator('[data-avail=free]').waitFor();
      await page.locator('form button[type=submit]').click();
      await page.locator('[data-ways]').waitFor({ timeout: 20000 });
      await count('menu, empty');
    }

    // ---- the same menu for both, written through the API; one picture waiting for review
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD }); if (error) throw error;
    const bizId = sql(`select id from public.businesses where slug = '${slug}'`);
    const ids = [];
    for (const [ci, c] of MENU.entries()) {
      const cat = await client.from('categories').insert({ business_id: bizId, name_he: c.he, name_en: c.en, kind: c.kind, position: ci }).select().single(); if (cat.error) throw cat.error;
      for (const [i, [he, en, price, desc]] of c.items.entries()) { const r = await client.from('items').insert({ business_id: bizId, category_id: cat.data.id, position: i, name_he: he, name_en: en, price_minor: price, desc_he: desc }).select().single(); if (r.error) throw r.error; ids.push(r.data.id); }
    }
    const a = await client.from('assets').insert({ business_id: bizId, item_id: ids[4], status: 'uploaded', kind: 'relief' }).select().single(); if (a.error) throw a.error;
    const base = `${bizId}/${a.data.id}/`, jpeg = () => new Blob([fs.readFileSync(PHOTOS.plate2)], { type: 'image/jpeg' }), png = () => new Blob([fs.readFileSync(PHOTOS.plate2.replace('.jpg', '.gt.png'))], { type: 'image/png' });
    for (const [f, blob] of [['original.jpg', jpeg()], ['color.jpg', jpeg()], ['thumb.jpg', jpeg()], ['aux.png', png()]]) await client.storage.from('menu-private').upload(base + f, blob);
    await client.from('assets').update({ status: 'processing', original_path: base + 'original.jpg' }).eq('id', a.data.id);
    await client.from('assets').update({ status: 'ready_for_review', relief_class: 'medium', color_path: base + 'color.jpg', aux_path: base + 'aux.png', thumb_path: base + 'thumb.jpg', meta: { e: 48, h: 0.2 } }).eq('id', a.data.id);
    await page.reload();

    const v1 = variant === 'v1';
    await page.goto(app('menu')); await page.locator(v1 ? 'section.cat' : 'section.sec').first().waitFor({ timeout: 20000 });
    await count('menu');
    await page.goto(app(v1 ? 'menu/item/' + ids[0] : 'menu/i/' + ids[0])); await page.locator('[data-field=price]').waitFor();
    await count('one dish');
    if (!v1) { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]')); }
    await page.goto(app('pictures')); await page.locator(v1 ? '.picrow' : '.tiles2').first().waitFor();
    await count('pictures', 1200);
    if (!v1) {
      await page.locator(`.tile2[data-item="${ids[1]}"] button`).click(); await page.locator('[data-sheet=picture]').waitFor();
      await count('pictures: one dish');
      await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]'));
    }
    await page.goto(app('pictures/' + a.data.id)); await page.locator('[data-shot=result][data-ready=true]').waitFor({ timeout: 20000 });
    await count('review a picture');
    await page.goto(app(v1 ? 'look' : 'style')); await page.locator(v1 ? '.tiles' : '.strip').first().waitFor();
    await count('look');
    if (v1) { await page.goto(app('preview')); await page.locator('[data-preview=shown]').waitFor({ timeout: 30000 }); }
    else { await page.goto(app('menu')); await page.locator('[data-action=preview]').click(); await page.locator('[data-sheet=preview] [data-preview=shown]').waitFor({ timeout: 30000 }); }
    await count('preview');
    if (!v1) { await page.keyboard.press('Escape'); await page.waitForFunction(() => !document.querySelector('dialog[open]')); }
    await page.goto(app('publish')); await page.locator('[data-action=publish]').waitFor();
    await count('publish', 1500);
    await page.locator('[data-action=publish]').click();
    await page.locator('[data-published-rev]').waitFor({ timeout: 20000 });
    await count('published');
    await page.goto(app('')); await page.locator(v1 ? '.page-head' : '[data-stats=empty]').first().waitFor({ timeout: 20000 });
    await count('home after publishing', 900);
    await page.locator('.acctbtn').click(); await page.locator('dialog[open]').waitFor();
    await count('account menu');
    await page.context().close();
  } finally { await teardown(); }
  return rows;
}

const before = await run('v1');
const after = await run('v2');

// ---- the table: each step of the path, old next to new. Steps the new app no longer has count as 0 there.
const get = (rows, name) => rows.find((r) => r.screen === name);
const sum = (rows, names) => names.reduce((n, k) => n + (get(rows, k)?.ui || 0), 0);
const LINES = [
  ['Start', ['start', 'start: new account'], ['start']],
  ['The place', ['set-up 1: name', 'set-up 2: address', 'set-up 3: contact', 'set-up 4: check'], ['set-up']],
  ['First screen after that', ['home before publishing'], ['menu, empty']],
  ['Menu, empty', ['menu, empty'], ['menu, empty']],
  ['Menu with 8 dishes', ['menu'], ['menu']],
  ['One dish', ['one dish'], ['one dish']],
  ['Pictures', ['pictures'], ['pictures']],
  ['Review a picture', ['review a picture'], ['review a picture']],
  ['Look', ['look'], ['look']],
  ['Preview', ['preview'], ['preview']],
  ['Publish', ['publish'], ['publish']],
  ['Published', ['published'], ['published']],
  ['Home after publishing', ['home after publishing'], ['home after publishing']],
  ['Account menu', ['account menu'], ['account menu']],
];
const PATH = ['Start', 'The place', 'First screen after that', 'Menu with 8 dishes', 'Pictures', 'Publish', 'Published', 'Home after publishing'];
const table = LINES.map(([name, b, a]) => ({ name, before: sum(before, b), after: sum(after, a), screensBefore: b.length, screensAfter: a.length }));
const pct = (b, a) => (b ? Math.round((a / b) * 100) + '%' : '');
const pad = (s, n) => String(s).padEnd(n), num = (s) => String(s).padStart(6);
let out = 'Visible interface words per screen, 390 × 844, Hebrew. Old = branch master, new = this branch.\n'
  + 'The owner\'s own words (names, descriptions, address) and the guest menu inside the preview are not counted.\n\n'
  + pad('Step', 26) + num('old') + num('new') + '   new/old   screens old→new\n' + '-'.repeat(66) + '\n';
for (const r of table) out += pad(r.name, 26) + num(r.before) + num(r.after) + '   ' + pad(pct(r.before, r.after), 8) + '  ' + r.screensBefore + '→' + r.screensAfter + '\n';
const tb = table.filter((r) => PATH.includes(r.name)).reduce((n, r) => n + r.before, 0), ta = table.filter((r) => PATH.includes(r.name)).reduce((n, r) => n + r.after, 0);
const allB = table.filter((r) => r.name !== 'Menu, empty').reduce((n, r) => n + r.before, 0), allA = table.filter((r) => r.name !== 'Menu, empty').reduce((n, r) => n + r.after, 0);
out += '-'.repeat(66) + '\n' + pad('Main path (first run)', 26) + num(tb) + num(ta) + '   ' + pct(tb, ta) + '\n' + pad('Every step above', 26) + num(allB) + num(allA) + '   ' + pct(allB, allA) + '\n';
out += '\nMain path = ' + PATH.join(' → ') + '.\n"Every step above" leaves out "Menu, empty" (it is the same screen as "First screen after that" in the new app).\n';
if (get(after, 'pictures: one dish')) out += 'New only: the sheet for one dish\'s picture has ' + get(after, 'pictures: one dish').ui + ' words.\n';
console.log('\n' + out);
fs.writeFileSync(path.resolve(HERE, '../.out/words.json'), JSON.stringify({ before, after, table }, null, 1));
const shots = path.resolve(HERE, '../../.shots/v2'); fs.mkdirSync(shots, { recursive: true });
fs.writeFileSync(path.join(shots, 'words.txt'), out);
