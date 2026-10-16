// Quick look at every v2 screen on the stub (synthetic data), desk and phone: `node test/v2/shots.mjs` after a build.
// The pictures land in test/shots/ (ignored by git) as v2-look-<screen>-<size>.png; page errors are printed.
import { createStub, ACCOUNTS } from './stub.mjs';
import { launch, shot, DESKTOP, PHONE } from '../helpers.mjs';
import { VENUE } from './fake.ts';

const stub = createStub();
const base = `http://127.0.0.1:${await stub.listen(0)}`;
const browser = await launch();
for (const [tag, viewport] of [['desk', DESKTOP], ['phone', PHONE]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 700 ? 2 : 1, isMobile: viewport.width < 700, locale: 'en-GB', timezoneId: 'Asia/Jerusalem' });
  const page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  await page.goto(`${base}/mana/ops/`);
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  await shot(page, `v2-look-signin-${tag}`);
  await page.getByLabel('E-mail').fill(ACCOUNTS.admin.email);
  await page.getByLabel('Password').fill(ACCOUNTS.admin.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('[data-totals]').waitFor();
  await page.waitForTimeout(300);
  await shot(page, `v2-look-clients-${tag}`);
  await page.goto(`${base}/mana/ops/#/venues/${VENUE.demo}`);
  await page.locator('[data-panel=timeline]').waitFor();
  await page.waitForTimeout(300);
  await shot(page, `v2-look-venue-${tag}`);
  await page.goto(`${base}/mana/ops/#/analytics`);
  await page.locator('[data-analytics-totals]').waitFor();
  await page.locator('[data-filter=demo]').selectOption('include');
  await page.waitForTimeout(600);
  await shot(page, `v2-look-analytics-${tag}`);
  await page.goto(`${base}/mana/ops/#/leads`);
  await page.locator('[data-lead-filters]').waitFor();
  await shot(page, `v2-look-leads-${tag}`);
  if (problems.length) console.log(tag, problems);
  await ctx.close();
}
await browser.close();
await stub.close();
console.log('screenshots in test/shots/v2-look-*.png');
