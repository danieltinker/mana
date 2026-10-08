import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SHOTS = path.join(HERE, 'shots');
export const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
export const DESKTOP = { width: 1440, height: 900 };
export const PHONE = { width: 390, height: 844 };
export const STAFF = { email: 'staff@halom.test', password: 'correct-horse' };
export const OWNER = { email: 'owner@cafe.test', password: 'owner-pass-1' };

const OPEN = new Set();
// close whatever a test left open, so a failed test cannot keep polling the stub during the next one
export async function closeAll() { for (const c of OPEN) { OPEN.delete(c); await c.close().catch(() => {}); } }
// poll until read() deep-equals want (hash navigation and re-rendering are asynchronous)
export async function until(read, want, msg, ms = 4000) {
  const end = Date.now() + ms; let got;
  for (;;) {
    got = await read();
    if (JSON.stringify(got) === JSON.stringify(want)) return;
    if (Date.now() > end) throw new Error(`${msg || 'until'}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`);
    await new Promise((r) => setTimeout(r, 40));
  }
}
export async function launch() {
  await mkdir(SHOTS, { recursive: true });
  return chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
}
// A fresh context per test: empty localStorage, console errors and page errors collected.
export async function open(browser, base, { viewport = DESKTOP, prefix = '/projects/menus', init = {}, hash = '' } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 700 ? 2 : 1, isMobile: viewport.width < 700, hasTouch: viewport.width < 700, acceptDownloads: true, locale: 'en-GB', timezoneId: 'Asia/Jerusalem' });
  OPEN.add(ctx);
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  page.on('dialog', (d) => { problems.push('dialog: ' + d.message()); d.dismiss(); });
  await page.addInitScript((v) => { Object.assign(window, v); }, init);
  await page.goto(`${base}${prefix}/ops/${hash}`);
  return { ctx, page, problems, url: `${base}${prefix}/ops/` };
}
export async function signIn(page, who = STAFF) {
  await page.getByLabel('E-mail').fill(who.email);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}
export const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: opts.fullPage !== false, animations: 'disabled' });
export async function control(base, body) {
  const r = await fetch(base + '/__stub/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}
