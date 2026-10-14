/* The share picture, rendered from the page itself: the hero at 1200 × 630, Hebrew (og.png) and English (og-en.png).
   A share card has no buttons to press: the mark, the kicker, the sentence, the line under it and the dish.   Run: node tools/og.mjs */
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
  await page.goto(srv.origin + '/mana/?demo=off&motion=off&video=off&hero=off&lev=off&lang=' + lang, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready);
  /* round two's hero (14 Oct 2026): the words on one side, the stage on the other; no buttons, no floating ingredients */
  await page.addStyleTag({ content: `.top-tools,.top-nav,.cta,.lev,.aura,main>section:not(.hero),.foot,.skip,.hero-cap .dish-names{display:none!important}
    html,body{overflow:hidden}.wrap{max-width:none;padding-inline:72px}
    .top{position:static;justify-content:flex-start;padding:44px 72px 0}.top-pill{background:none!important;box-shadow:none!important;border:0!important;padding:0;width:auto;backdrop-filter:none;-webkit-backdrop-filter:none}
    .top-pill::before,.top-pill::after{display:none!important}.brand svg{width:58px}.brand b{font-size:40px}
    .hero{padding:0;min-height:calc(630px - 88px);align-items:center}.hero-in{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:56px;align-items:center;padding:0 72px 18px}
    .hero .eyebrow{font-size:24px}.hero h1{font-size:${lang === 'he' ? 84 : 76}px!important;line-height:1.08!important;margin-top:10px}
    .hero .lead{font-size:24px;line-height:1.4;margin-top:22px;max-width:22em;text-wrap:balance}
    .hero-stage{width:420px;margin:0}` });
  await page.waitForFunction(() => [...document.images].filter((i) => i.loading !== 'lazy' && i.getBoundingClientRect().width > 0).every((i) => i.complete), null, { timeout: 15000 }); await page.waitForTimeout(400);
  await page.screenshot({ path: join(IMG, file) }); await page.close(); console.log(file);
}
await browser.close(); srv.server.close();
