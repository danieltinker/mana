#!/usr/bin/env node
/* Looks at placeholders in the real diner viewer: opens a demo menu served on this machine and saves screenshots.
   node tools/viewer_check.mjs <base url of the viewer folder> <out dir> [surface] [category[:item[:left|right]] ...]   (left/right: look closer and turn the dish)
   e.g. node tools/viewer_check.mjs http://127.0.0.1:8791/projects/menus/view/ .scratch/shots oak hot-drinks:cappuccino
   Without items it shoots every category's overview. Needs tools/demo_menu.py to have written demo/stock. */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const [base, out, surface = 'oak', ...items] = process.argv.slice(2);
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright/index.mjs').href);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-networking', '--disable-component-update', '--no-first-run'] });
const page = await browser.newPage({ viewport: { width: 900, height: 620 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('request', (r) => { if (!r.url().startsWith(base.split('/').slice(0, 3).join('/')) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push('outside request: ' + r.url()); });
const settle = async (n = 90) => { for (let i = 0; i < n; i += 10) { await page.evaluate(() => window.__menu && window.__menu.tick(10, 1 / 30)); await page.waitForTimeout(60); } };
const menu = JSON.parse(await (await fetch(base + 'demo/stock/menu.json')).text());
const targets = items.length ? items.map((s) => s.split(':')) : menu.categories.map((c) => [c.id]);
for (const [cat, item, turn] of targets) {
  await page.goto(`${base}?demo=stock&test=1&pr=1&lang=en&adapt=off&surface=${surface}#c=${cat}${item ? '&i=' + item : ''}`);
  await page.waitForFunction(() => window.__menu && window.__menu.state && window.__menu.state(), null, { timeout: 120000, polling: 250 });
  await page.waitForTimeout(1500); await settle(120); await page.waitForTimeout(400); await settle(60);
  if (turn) {                                              // "look closer", then drag: the dish turns and shows its depth
    await page.evaluate(() => window.__menu.dispatch({ type: 'setInspect', on: true })); await settle(40);
    const box = await page.locator('#gl').boundingBox(), y = box.y + box.height * .55, x = box.x + box.width * .5, dx = turn === 'left' ? -1 : 1;
    await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= 10; i++) { await page.mouse.move(x + dx * i * 26, y); await settle(10); } await page.mouse.up(); await settle(40);
  }
  const file = `${out}/${surface}-${cat}${item ? '-' + item : ''}${turn ? '-' + turn : ''}.png`;
  await page.screenshot({ path: file, timeout: 240000 });
  console.log(file, JSON.stringify(await page.evaluate(() => { const s = window.__menu.state(), i = window.__menu.info(); return { mode: s.mode, cat: s.categoryId, item: s.itemId, inspect: s.inspect, scene: i && i.scene, yaw: i && i.actors.filter((a) => a.yaw).map((a) => +a.yaw.toFixed(2)) }; })));
  await page.goto('about:blank');
}
if (errors.length) console.log('errors:', [...new Set(errors)].slice(0, 8));
await browser.close();
