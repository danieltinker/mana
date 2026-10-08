/* The share picture, rendered from the page itself: the hero at 1200 × 630, Hebrew (og.png) and English (og-en.png).
   A share card has no buttons to press: the mark, the sentence, the line under it and the phone.   Run: node tools/og.mjs */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { listen } from './serve.mjs';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');
const IMG = join(dirname(fileURLToPath(import.meta.url)), '..', 'site', 'img');
const srv = await listen(0);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
for (const [lang, file] of [['he', 'og.png'], ['en', 'og-en.png']]) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(srv.origin + '/mana/?demo=off&motion=off&video=off&lang=' + lang, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: `.top-tools,.cta,.demo-tag,.phone-play,main>section:not(.hero),.foot,.skip{display:none!important}
    html,body{overflow:hidden}.wrap{max-width:none;padding-inline:76px}.top{padding-block:44px 0}.brand svg{width:64px}.brand b{font-size:44px}
    .hero{padding:0}.hero-grid{grid-template-columns:minmax(0,1fr) 318px!important;gap:60px;align-items:start}
    .hero h1{font-size:${lang === 'he' ? 92 : 88}px!important;line-height:1.1!important;margin-top:64px}.hero .lead{font-size:31px;line-height:1.35;margin-top:28px;max-width:17em;text-wrap:balance}
    .hero-pic{width:318px;margin:-74px 0 0}.phone{--bez:11px}` });
  await page.waitForFunction(() => [...document.images].every((i) => i.complete)); await page.waitForTimeout(200);
  await page.screenshot({ path: join(IMG, file) }); await page.close(); console.log(file);
}
await browser.close(); srv.server.close();
