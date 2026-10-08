/* Shared helpers for the browser tests: a headless Chromium with software WebGL, and the local server.
   SwiftShader renders slowly, so pages are usually opened with ?test=1 (no render loop) and the clock is turned by hand:
   __mana.tick(n, dt) or __mana.frame(ms). Real-finger tests use the running loop instead (the finger's speed needs a real clock). */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listen } from '../tools/serve.mjs';

const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
export const { chromium } = pw;
export const HERE = dirname(fileURLToPath(import.meta.url));
export const SHOTS = join(HERE, '..', '.shots');
mkdirSync(SHOTS, { recursive: true });
export const VIEW = '/projects/menus/view/';
/* software WebGL; and the browser may talk to this machine only (no proxy, no name but 127.0.0.1 resolves) */
export const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox',
  '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-pings'];

export async function launch(extra = []) {
  return chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true, args: GL.concat(extra) });
}
export { listen };
export async function open(browser, url, { width = 390, height = 844, touch = false, dpr = 1, reducedMotion, init } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch, reducedMotion: reducedMotion || 'no-preference' });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return { page, ctx, errors };
}
/* the table is up and the dish in focus is sharp (hand-turned clock) */
export async function tableUp(page) { await page.evaluate(() => window.__mana.settle()); }
/* turn the clock until nothing but the idle sway moves (or a frame budget runs out) */
export async function settle(page, frames = 60, dt = 1 / 30) {
  await page.evaluate(async ([n, d]) => { const M = window.__mana; for (let i = 0; i < n; i += 4) { if (M.pending() > 0) await new Promise((r) => setTimeout(r, 30)); M.tick(4, d); const s = M.info(); if (s && s.moving !== true && M.pending() === 0 && i > 8) break; } }, [frames, dt]);
}
export const shot = (page, name, opts) => page.screenshot(Object.assign({ path: join(SHOTS, name + '.png') }, opts || {}));

/* a finger on the glass, through the browser's real input pipeline (so touch-action takes part) */
export async function swipe(page, from, to, { steps = 8, hold = 16 } = {}) {
  const cdp = await page.context().newCDPSession(page), pt = (x, y) => [{ x: Math.round(x), y: Math.round(y), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from[0], from[1]) });
  for (let i = 1; i <= steps; i++) { await page.waitForTimeout(hold); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(from[0] + (to[0] - from[0]) * i / steps, from[1] + (to[1] - from[1]) * i / steps) }); }
  await page.waitForTimeout(hold); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
}
/* a scripted finger on the hand-turned clock: every move is one frame of `ms` */
export async function drag(page, from, to, { steps = 8, ms = 16, release = true } = {}) {
  await page.evaluate(async ([a, b, n, t, rel]) => { const M = window.__mana; M.pointer('down', a[0], a[1]); M.tick(1, t / 1000, false); for (let i = 1; i <= n; i++) { M.pointer('move', a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n); M.tick(1, t / 1000, false); } if (rel) M.pointer('up', b[0], b[1]); }, [from, to, steps, ms, release]);
}
