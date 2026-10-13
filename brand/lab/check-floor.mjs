/* Behaviour checks for brand/src/land/floor3d.js in its lab (headless Chromium, software WebGL), through the browser lock:
     flock /tmp/mana-browser.lock node brand/lab/check-floor.mjs <origin>
   The contract: mountFloor → { pause, resume, setLang, destroy } or null (onFail) without WebGL; pause means no frames;
   reduced draws a still; a horizontal drag turns the room, a vertical touch move does not; setLang switches the toast;
   destroy leaves host empty; nothing is requested from another host. */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const origin = process.argv[2] || 'http://127.0.0.1:7501';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
let ok = 0, bad = 0; const open_ = [];
async function check(name, fn) { try { await fn(); ok++; console.log('ok  ', name); } catch (e) { bad++; console.log('FAIL', name, '\n     ', String(e.message).split('\n').slice(0, 6).join(' | ')); } finally { while (open_.length) await open_.pop().close().catch(() => {}); } }
async function open(q, { w = 1440, h = 900, touch = false, reduced = false, init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  open_.push(ctx); const page = await ctx.newPage(), errors = [], hosts = new Set(); if (init) await page.addInitScript(init);
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text()); });
  page.on('request', (r) => { try { hosts.add(new URL(r.url()).host); } catch (e) { /* data: */ } });
  await page.goto(origin + '/lab/floor.html?' + q, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__floorState !== 'loading' && (window.__floor !== undefined || /failed|null/.test(window.__floorState)), null, { timeout: 60000 });
  return { ctx, page, errors, hosts };
}
const info = (p) => p.evaluate(() => window.__floor.info());

await check('mounts, draws, nothing from another host, no errors; pause stops frames, resume restarts', async () => {
  const o = await open('lang=he');
  await o.page.waitForFunction(() => window.__floorState === 'ready', null, { timeout: 60000 }); await o.page.waitForTimeout(1500);
  const a = await info(o.page); assert.ok(a.frames > 2, 'frames ' + a.frames);
  const api = await o.page.evaluate(() => Object.keys(window.__floor).sort().join(',')); assert.equal(api, 'destroy,info,pause,resume,setLang');
  await o.page.evaluate(() => window.__floor.pause()); const b = await info(o.page); await o.page.waitForTimeout(1200); const c = await info(o.page);
  assert.equal(c.frames, b.frames, 'frames while paused'); assert.equal(c.simTime, b.simTime, 'the clock ran while paused');
  await o.page.evaluate(() => window.__floor.resume()); await o.page.waitForTimeout(1200); const d = await info(o.page); assert.ok(d.frames > c.frames, 'no frames after resume');
  assert.deepEqual([...o.hosts], [new URL(origin).host]); assert.deepEqual(o.errors, []);
  const css = await o.page.evaluate(() => getComputedStyle(document.querySelector('#stage canvas')).touchAction); assert.equal(css, 'pan-y');
  await o.ctx.close();
});
await check('a horizontal drag turns it; after the drag the orbit comes back', async () => {
  const o = await open('lang=en'); await o.page.waitForFunction(() => window.__floorState === 'ready', null, { timeout: 60000 });
  const box = await o.page.locator('#stage').boundingBox(); const y0 = (await info(o.page)).yaw;
  await o.page.mouse.move(box.x + 200, box.y + 240); await o.page.mouse.down();
  for (let i = 1; i <= 10; i++) { await o.page.mouse.move(box.x + 200 + i * 20, box.y + 240); await o.page.waitForTimeout(20); }
  await o.page.mouse.up(); const y1 = (await info(o.page)).yaw; assert.ok(y1 - y0 > 1, `yaw ${y0} → ${y1}`);
  await o.page.waitForTimeout(6000); const y2 = (await info(o.page)).yaw; await o.page.waitForTimeout(2000); const y3 = (await info(o.page)).yaw;
  assert.ok(y3 - y2 > .02, `orbit did not resume: ${y2} → ${y3}`); await o.ctx.close();
});
await check('a vertical touch move does not turn it (the page scrolls)', async () => {
  const o = await open('lang=he&freeze', { w: 390, h: 844, touch: true }); await o.page.waitForTimeout(500);
  const y0 = (await info(o.page)).yaw;
  await o.page.evaluate(() => { const c = document.querySelector('#stage canvas'), r = c.getBoundingClientRect(), x = r.left + 150, y = r.top + 100;
    const ev = (type, dx, dy) => c.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x + dx, clientY: y + dy, bubbles: true }));
    ev('pointerdown', 0, 0); for (let i = 1; i <= 8; i++) ev('pointermove', i * 2, i * 14); ev('pointerup', 16, 112); });
  const y1 = (await info(o.page)).yaw; assert.equal(y1, y0, `yaw moved ${y0} → ${y1}`);
  await o.page.evaluate(() => { const c = document.querySelector('#stage canvas'), r = c.getBoundingClientRect(), x = r.left + 100, y = r.top + 100;
    const ev = (type, dx, dy) => c.dispatchEvent(new PointerEvent(type, { pointerId: 8, pointerType: 'touch', isPrimary: true, clientX: x + dx, clientY: y + dy, bubbles: true }));
    ev('pointerdown', 0, 0); for (let i = 1; i <= 8; i++) ev('pointermove', i * 14, i * 2); ev('pointerup', 112, 16); });
  const y2 = (await info(o.page)).yaw; assert.ok(Math.abs(y2 - y0) > .5, `a horizontal touch drag did not turn it ${y0} → ${y2}`);
  await o.ctx.close();
});
await check('time up: the toast in Hebrew, then English after setLang; labels are minutes', async () => {
  const o = await open('lang=he&t=9&freeze'); await o.page.waitForTimeout(800);
  const he = await o.page.evaluate(() => document.querySelector('.mf-toast.mf-on span').textContent); assert.equal(he, 'הזמן נגמר · שולחן 4');
  await o.page.evaluate(() => window.__setLang('en')); const en = await o.page.evaluate(() => document.querySelector('.mf-toast span').textContent); assert.equal(en, 'Time is up · Table 4');
  const labs = await o.page.evaluate(() => [...document.querySelectorAll('.mf-lab.mf-on')].map((e) => e.textContent)); assert.ok(labs.length >= 4 && labs.every((t) => /^\d+′$/.test(t)), JSON.stringify(labs));
  await o.ctx.close();
});
await check('one toast at a time, and it goes after about 2.5 s (demo clock); the table frees', async () => {
  const o = await open('lang=he&t=8.2'); await o.page.waitForTimeout(300);
  const seen = await o.page.evaluate(async () => { const out = []; const t0 = performance.now(); while (performance.now() - t0 < 40000) { const i = window.__floor.info(); out.push([i.simTime, document.querySelectorAll('.mf-toast.mf-on').length]); if (i.simTime > 11.2) break; await new Promise((r) => setTimeout(r, 80)); } return out; });
  const during = seen.filter(([t]) => t < 10.3).map((x) => x[1]), after = seen.filter(([t]) => t > 10.8).map((x) => x[1]);
  assert.ok(during.length && during.every((n) => n === 1), 'during ' + JSON.stringify(seen)); assert.ok(after.length && after.every((n) => n === 0), 'after ' + JSON.stringify(seen));
});
await check('reduced motion: one still, no toast, no frames after it', async () => {
  const o = await open('lang=he', { reduced: true }); await o.page.waitForTimeout(1500);
  const a = await info(o.page); await o.page.waitForTimeout(1000); const b = await info(o.page);
  assert.ok(a.frames >= 1 && b.frames === a.frames, `frames ${a.frames} → ${b.frames}`);
  assert.equal(await o.page.evaluate(() => document.querySelectorAll('.mf-toast.mf-on').length), 0);
  await o.page.setViewportSize({ width: 800, height: 900 }); await o.page.waitForTimeout(600); const c = await info(o.page); assert.ok(c.frames > b.frames, 'no redraw on resize');
  await o.ctx.close();
});
await check('destroy leaves the stage empty', async () => {
  const o = await open('lang=he'); await o.page.waitForTimeout(800);
  const n = await o.page.evaluate(() => { window.__floor.destroy(); return document.getElementById('stage').children.length + document.querySelectorAll('style').length; });
  assert.equal(n, 1, 'left over: ' + n); assert.deepEqual(o.errors, []); await o.ctx.close();
});
await check('no WebGL: null and onFail', async () => {
  const o = await open('lang=he', { init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return /webgl/.test(k) ? null : g.call(this, k, ...a); }; } });
  const st = await o.page.evaluate(() => window.__floorState); assert.ok(/^failed/.test(st), st);
  assert.equal(await o.page.evaluate(() => document.getElementById('stage').children.length), 0); await o.ctx.close();
});
await browser.close();
console.log(`${ok} ok, ${bad} failed`); process.exit(bad ? 1 : 0);
