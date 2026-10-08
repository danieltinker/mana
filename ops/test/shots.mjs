// Quick look: screenshots of every screen, both sizes. `node test/shots.mjs [scenario]`
import { createStub } from './stub.mjs';
import { launch, open, signIn, shot, DESKTOP, PHONE } from './helpers.mjs';
const name = process.argv[2] || 'many';
const stub = createStub(); const port = await stub.listen(0); const base = `http://127.0.0.1:${port}`;
stub.reset(name);
const browser = await launch();
for (const [tag, viewport] of [['desktop', DESKTOP], ['phone', PHONE]]) {
  const { page, problems, ctx } = await open(browser, base, { viewport });
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  await shot(page, `look-${name}-signin-${tag}`);
  await signIn(page);
  await page.locator('[data-tiles]').waitFor();
  await page.waitForTimeout(300);
  await shot(page, `look-${name}-overview-${tag}`);
  await page.locator('[data-tab=businesses]').click(); await page.waitForTimeout(200);
  await shot(page, `look-${name}-businesses-${tag}`, { fullPage: tag === 'desktop' });
  if (name === 'many') {
    await page.locator('[data-slug=cafe-levinsky] button').first().click(); await page.locator('[data-drawer]').waitFor();
    await page.locator('[data-plan] input[value=pilot]').check(); await page.waitForTimeout(150);
    await shot(page, `look-${name}-drawer-${tag}`, { fullPage: false });
    await page.locator('[data-plan-review]').scrollIntoViewIfNeeded(); await shot(page, `look-${name}-drawer2-${tag}`, { fullPage: false });
    await page.keyboard.press('Escape');
  }
  await page.locator('[data-tab=leads]').click(); await page.waitForTimeout(200);
  await shot(page, `look-${name}-leads-${tag}`, { fullPage: tag === 'desktop' });
  if (name === 'many') { await page.locator('[data-lead=HL-2026-0010] [data-edit]').click(); await page.waitForTimeout(150); await page.locator('[data-lead=HL-2026-0010]').first().scrollIntoViewIfNeeded(); await shot(page, `look-${name}-lead-edit-${tag}`, { fullPage: false }); }
  if (problems.length) console.log(tag, problems);
  await ctx.close();
}
await browser.close(); await stub.close();
