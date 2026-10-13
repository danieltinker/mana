// How long the owner's first menu takes, headless, on this machine: sign up → name the place → type three dishes → publish →
// the QR and the link are on screen. Then, with TIMING_PHOTO=1 and a stack whose generator is the real one, one dish photo →
// a relief in the owner app's generator. Numbers are an upper bound for a laptop: the browser runs in software here.
// Usage: STACK_PORT_BASE=9100 node test/stack/start.mjs [--fake-gen] &  then  node test/timing.mjs
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = Number(process.env.STACK_PORT_BASE) || 57300;
const WEB = `http://127.0.0.1:${BASE + 80}/halom-projects/projects/menus/`;
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const GL = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1'];
const TYPE = { delay: Number(process.env.TIMING_KEY_MS) || 60 };          // a person typing, roughly
const PHOTO = path.resolve(HERE, '../../gen-lab/photos/real-shakshouka.webp');
const fmt = (ms) => `${Math.floor(ms / 60000)} min ${((ms % 60000) / 1000).toFixed(1)} s`;

const browser = await chromium.launch({ executablePath: CHROME, args: GL });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
await ctx.addInitScript(() => { try { localStorage.setItem('mana-studio-lang', 'he'); } catch { /* opaque */ } });
const page = await ctx.newPage();
const marks = []; const t0 = Date.now(); let last = t0;
const mark = (what) => { const now = Date.now(); marks.push([what, now - last, now - t0]); last = now; };
const tag = Date.now().toString(36);
const email = `owner-${tag}@example.ai`, slug = `timing-${tag}`;

await page.goto(WEB + 'studio/');
await page.locator('input[name=email]').waitFor();
mark('start screen on');
await page.locator('input[name=email]').pressSequentially(email, TYPE);
await page.locator('input[name=password]').pressSequentially('correct-horse-9', TYPE);
await page.locator('form button[type=submit]').click();
await page.getByRole('heading', { name: 'איך קוראים למקום שלכם?' }).waitFor({ timeout: 30000 });
mark('account made, signed in (includes the 2.5 s spam wait)');
await page.locator('.setup-form input[type=text]:visible').pressSequentially('זית ירוק', TYPE);
await page.locator('.addr[data-avail=free]').waitFor({ timeout: 15000 });
await page.locator('form button[type=submit]').click();
await page.locator('[data-ways]').waitFor({ timeout: 20000 });
mark('the place named, menu screen on');
await page.locator('[data-way=type]').click();
await page.locator('dialog[data-sheet=section] input[data-field]').first().pressSequentially('עיקריות', TYPE);
await page.locator('dialog[data-sheet=section] button[type=submit]').click();
await page.locator('dialog[data-sheet=section]').waitFor({ state: 'detached', timeout: 15000 }).catch(async () => { await page.screenshot({ path: '/tmp/claude-0/-home-claude/50a11094-6d22-53f6-9165-887183f0d774/scratchpad/night/studio/timing-stuck.png' }); });
const sec = page.locator('section.sec').first();
await sec.waitFor();
for (const [name, price] of [['חומוס הבית', '32'], ['שקשוקה', '54'], ['סלט ירוק', '38']]) {
  const nameF = sec.getByPlaceholder('שם המנה'), priceF = sec.getByPlaceholder('מחיר');
  await nameF.pressSequentially(name, TYPE); await priceF.pressSequentially(price, TYPE); await priceF.press('Enter');
  await sec.locator('.row', { hasText: name }).waitFor({ timeout: 15000 });
}
mark('three dishes typed and saved');
await page.locator('[data-next=pictures]').click();
await page.locator('[data-next=publish]').waitFor();
await page.locator('[data-next=publish]').click();
await page.locator('[data-action=publish]').waitFor();
await page.locator('[data-action=publish]').click();
await page.locator('[data-published-rev="1"]').waitFor({ timeout: 30000 });
await page.locator('img[data-qr]').waitFor();
await page.locator('[data-short-link]').waitFor();
mark('published: QR and link on screen');
const total = Date.now() - t0;
console.log('\nheadless, this machine (software GL, shared 2 cores), typing at ' + TYPE.delay + ' ms a key:');
for (const [what, d, at] of marks) console.log(`  ${fmt(d).padStart(14)}  →  ${what}   (at ${fmt(at)})`);
console.log(`  sign-up → three typed dishes → published, QR + link shown: ${fmt(total)}`);

if (process.env.TIMING_PHOTO) {
  // one dish photo → a relief: Pictures → the first dish's tile → choose a photo → the generator runs in the browser → "to approve"
  const t1 = Date.now();
  await page.locator('[data-tab=menu], .pathbar [data-step=pictures] a').first().click().catch(() => {});
  await page.goto(WEB + 'studio/#/pictures');
  await page.locator('.tile2').first().waitFor({ timeout: 20000 });
  await page.locator('.tile2').first().locator('button').click();
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: /בחירת תמונה/ }).first().click()]);
  await fc.setFiles(PHOTO);
  const tile = page.locator('.tile2').first();
  await tile.locator(':scope[data-status=working]').waitFor({ timeout: 30000 }).catch(() => {});
  const tUp = Date.now();
  await page.locator('.tile2[data-status=review]').first().waitFor({ timeout: Number(process.env.TIMING_PHOTO_MS) || 900000 });
  const t2 = Date.now();
  const gen = await page.evaluate(() => (window.HALOM_MENUS_CONFIG || {}).genPath);
  console.log(`\n  one dish photo → relief ready for approval (${gen && gen.includes('fake') ? 'the FAKE stand-in generator' : 'the real in-browser generator'}, first use includes the model download from the local server): ${fmt(t2 - t1)}  (generator part ≈ ${fmt(t2 - tUp)})`);
}
await browser.close();
