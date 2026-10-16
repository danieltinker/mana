/* Hero mode (view/?demo=solo&embed=hero): the product page's first screen. Headless Chromium with software WebGL, the real
   clock (the sequence is timed by the page's own rAF).  Run: node --test test/hero.browser.test.mjs */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, listen, open, VIEW } from './browser.mjs';

let srv, browser;
before(async () => { srv = await listen(0); browser = await launch(['--disable-ipc-flooding-protection']); });
after(async () => { await browser.close(); srv.server.close(); });
const hero = (q = '') => srv.origin + VIEW + '?demo=solo&embed=hero&pr=0.5' + q;
const phase = (page) => page.evaluate(() => window.__manaHero && window.__manaHero.phase());
const styles = (page) => page.evaluate(() => ({ gl: +getComputedStyle(document.getElementById('gl')).opacity, poster: +getComputedStyle(document.querySelector('.hero-poster')).opacity, lamp: +getComputedStyle(document.querySelector('.hero-lamp')).opacity,
  ring: +getComputedStyle(document.querySelector('.hero-ring path')).opacity, top: document.getElementById('top').checkVisibility(), card: document.getElementById('card').checkVisibility(), list: document.getElementById('list').checkVisibility(), status: document.getElementById('status').checkVisibility(),
  label: document.getElementById('scene').getAttribute('aria-label'), animations: document.getAnimations().length, open: window.__mana.state().open, tier: window.__mana.info().tier }));

test('hero mode: no chrome, the poster first, then the lamp, the rise and the ring, once; the dish turns by key; the page can pause it', async () => {
  const { page, errors, ctx } = await open(browser, hero('&lang=he'), { width: 390, height: 600 });
  await page.waitForFunction(() => window.__manaHero && window.__manaHero.posterReady(), null, { timeout: 30000 });
  let s = await styles(page); assert.equal(await phase(page), 'poster'); assert.equal(s.gl, 0); assert.equal(s.poster, 1);
  assert.deepEqual([s.top, s.card, s.list, s.status], [false, false, false, false], 'chrome is showing'); assert.equal(s.label, 'חומוס חם');
  const r = await page.evaluate(() => window.__manaHero.rect()); assert.ok(r && r.w > 200 && Math.abs(r.cx - 195) < 2, 'the poster stands where the dish will: ' + JSON.stringify(r));
  await page.waitForFunction(() => window.__manaHero.phase() === 'rise', null, { timeout: 60000 });
  const early = await styles(page); assert.ok(early.lamp > 0 || early.gl < 1, 'the lamp does not come up over time: ' + JSON.stringify(early));
  await page.waitForFunction(() => window.__manaHero.phase() === 'rest', null, { timeout: 30000 });
  await page.waitForTimeout(300); s = await styles(page);
  assert.equal(s.gl, 1); assert.equal(s.poster, 0); assert.equal(s.lamp, 0); assert.ok(s.ring > .3 && s.ring < .6, 'the ring stays, faint: ' + s.ring); assert.equal(s.open, 'dish', 'the dish is up'); assert.equal(s.tier, 0);
  const marks = await page.evaluate(() => window.__mana.marks()), fp = await page.evaluate(() => performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint').startTime);
  const rise = marks.find((m) => m.name === 'menu-hero-rise'), rest = marks.find((m) => m.name === 'menu-hero-rest');
  assert.ok(rise && rest && rest.t - rise.t >= 2000 && rest.t - rise.t < 8000, 'the sequence (lamp 1.6 s, lift, ring .6 s) takes a few seconds: ' + JSON.stringify(marks));
  console.log('      headless, this machine: first paint ' + Math.round(fp) + ' ms → rise ' + rise.t + ' ms → rest ' + rest.t + ' ms');
  const ring = await page.evaluate(() => { const p = document.querySelector('.hero-ring path'), b = p.getBBox(), h = window.__mana.info().hot[0]; return { w: b.width, h: b.height, dx: Math.abs(b.x + b.width / 2 - h.cx), rx: h.rx }; });
  assert.ok(ring.dx < 3 && Math.abs(ring.w / 2 - ring.rx * 1.08) < 3 && ring.h < ring.w, 'the ring is the plate\'s rim: ' + JSON.stringify(ring));
  /* keys: the arrows turn it, Enter and Escape do not put it back */
  const yaw0 = await page.evaluate(() => window.__mana.info().actors[0].yaw);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(400); const yaw1 = await page.evaluate(() => window.__mana.info().actors[0].yaw);
  assert.ok(Math.abs(yaw1 - yaw0) > .02, 'ArrowRight turns the dish: ' + yaw0 + ' → ' + yaw1);
  await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); await page.waitForTimeout(200); assert.equal((await styles(page)).open, 'dish', 'Enter or Escape put the dish back');
  /* the page scrolled away: run:false stops the clock; run:true starts it again */
  await page.evaluate(() => window.postMessage({ type: 'mana-hero', run: false }, '*')); await page.waitForTimeout(100);
  const f0 = await page.evaluate(() => window.__mana.info().frames); assert.equal(await page.evaluate(() => window.__manaHero.paused()), true);
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(500); assert.equal(await page.evaluate(() => window.__mana.info().frames), f0, 'frames were drawn while paused');
  await page.evaluate(() => window.postMessage({ type: 'mana-hero', run: true }, '*')); await page.waitForTimeout(600);
  assert.ok((await page.evaluate(() => window.__mana.info().frames)) > f0, 'it did not start again'); assert.equal(await page.evaluate(() => window.__manaHero.paused()), false);
  assert.deepEqual(errors, []); await ctx.close();
});

test('hero mode falls back to the poster: a phone that cannot keep up (tier 4) shows the still, never the list', async () => {
  const { page, errors, ctx } = await open(browser, hero('&lang=en'), { width: 390, height: 600 });
  await page.waitForFunction(() => window.__manaHero && window.__manaHero.phase() === 'rest', null, { timeout: 90000 });
  assert.equal((await styles(page)).label, 'Warm hummus');
  for (let k = 0; k < 400 && (await phase(page)) !== 'poster'; k++) await page.evaluate(() => { for (let n = 0; n < 10; n++) window.__mana.frameTime(180); });
  await page.waitForTimeout(200); const s = await styles(page);
  assert.equal(await phase(page), 'poster'); assert.ok(s.tier >= 4, 'tier ' + s.tier); assert.equal(s.poster, 1); assert.equal(s.gl, 0); assert.equal(s.ring, 0); assert.equal(s.list, false, 'the list showed in the hero');
  assert.deepEqual(errors, []); await ctx.close();
});

test('hero mode with reduced motion: the still with the lamp up, nothing moves', async () => {
  const { page, errors, ctx } = await open(browser, hero('&lang=he'), { width: 390, height: 600, reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.__manaHero && window.__manaHero.phase() === 'rest', null, { timeout: 90000 });
  await page.waitForTimeout(400); const s = await styles(page);
  assert.equal(s.gl, 1); assert.equal(s.poster, 0); assert.equal(s.lamp, 0); assert.ok(s.ring > .3, 'the ring is there'); assert.equal(s.open, 'dish'); assert.equal(s.animations, 0, 'something animates under reduced motion');
  const marks = await page.evaluate(() => window.__mana.marks()), rise = marks.find((m) => m.name === 'menu-hero-rise'), rest = marks.find((m) => m.name === 'menu-hero-rest');
  assert.ok(rise && rest && rest.t - rise.t < 600, 'no sequence under reduced motion: ' + JSON.stringify(marks));
  assert.deepEqual(errors, []); await ctx.close();
});
