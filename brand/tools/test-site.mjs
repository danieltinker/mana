/* Browser checks for the product page (the remaster: white liquid glass, the demo dialog, the plans), the photo guide and the
   privacy and terms pages, against tools/serve.mjs (both path prefixes, a stubbed leads function; the demo dialog's checks stub
   the viewer, so they need no viewer build). The page's scripts must be built first: node tools/build-land.mjs.
   The hero and floor modules are stand-ins that return null until the integrator lands them, so these checks exercise the stills.
   Numbers land in review/v2/metrics.json, screenshots in .shots-raw/.      Run (through the lock): flock /tmp/mana-browser.lock node tools/test-site.mjs [filter] */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import { listen } from './serve.mjs';
import { renderIndex, mediaFound } from './build-site.mjs';
import { ensureTestMedia } from './test-media.mjs';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright'); const sharp = require('sharp');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'), RAW = join(ROOT, '.shots-raw'), REVIEW = join(ROOT, 'review', 'v2'), SCRATCH = ensureTestMedia();
mkdirSync(RAW, { recursive: true }); mkdirSync(REVIEW, { recursive: true });
if (!existsSync(join(ROOT, 'site', 'land', 'main.js'))) { console.error('site/land/main.js is missing: run node tools/build-land.mjs first'); process.exit(2); }
const only = process.argv[2] || '';
const srv = await listen(0, { delay: 400 });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const VPS = [[390, 844, true], [360, 640, true], [1440, 900, false]];
let passed = 0; const fails = [], metrics = { after: {} };
async function check(name, fn) { if (only && !name.includes(only)) return; try { await fn(); passed++; console.log('ok  ', name); } catch (e) { fails.push(name); console.log('FAIL', name, '\n     ', String(e.message).split("\n").slice(0, 12).join(" | ")); } }
async function open(path, { w = 390, h = 844, touch = true, origin = srv.origin, reduced = false, wait = 'load', init = null, hold = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(); const errors = [], hosts = new Set(), reqs = [], held = []; if (init) await page.addInitScript(init);
  if (hold) await page.route(hold, (route) => { held.push(route.request().url()); });      // hold: requests that are never answered (a video that never arrives)
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => { if (!/\.(mp4|webm)(\?|$)/.test(r.url())) errors.push('requestfailed: ' + r.url()); });      // a video the page stops on purpose is not a failure
  page.on('response', (r) => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
  page.on('request', (r) => { reqs.push(r.url()); try { hosts.add(new URL(r.url()).host); } catch (e) { /* data: */ } });
  for (const k of ['hero', 'floor']) if (!new RegExp('[?&]' + k + '=').test(path)) { const i = path.indexOf('#'), u = i < 0 ? path : path.slice(0, i), hash = i < 0 ? '' : path.slice(i); path = u + (u.includes('?') ? '&' : '?') + k + '=off' + hash; }      // the two 3D modules (software GL here: slow) run only in the checks about them      // the live hero (the viewer in a frame) is opened only by the checks about it
  await page.goto(origin + path, { waitUntil: wait }); await page.evaluate(() => document.fonts.ready);
  return { page, ctx, errors, hosts, reqs, held };
}
/* words a person can see: text in rendered elements, without closed <details> bodies, visually hidden headings and drawings */
const visibleWords = () => {
  const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const el = n.parentElement; if (!el || !n.nodeValue.trim()) continue;
    if (el.closest('script,style,noscript,template,svg,.vh,[hidden],dialog:not([open])')) continue;
    const d = el.closest('details:not([open])'); if (d && !el.closest('summary')) continue;
    if (!el.checkVisibility() || !el.getClientRects().length) continue;
    out.push(n.nodeValue);
  }
  return out.join(' ').split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t));
};
const PAGES = ['', 'guide/', 'privacy/', 'terms/'];

for (const prefix of ['/mana/', '/projects/menus/']) for (const [w, h, touch] of VPS) for (const lang of ['he', 'en']) {
  if (prefix === '/projects/menus/' && w !== 390) continue;       // the second prefix is checked once per language
  for (const pg of PAGES) {
    const id = `${prefix}${pg} ${w}x${h} ${lang}`;
    await check(id + ' renders, no overflow, no errors, nothing from another host', async () => {
      const o = await open(prefix + pg + '?lang=' + lang + '&demo=off', { w, h, touch });
      if (!pg) await o.page.evaluate(() => { const d = document.getElementById('talk-more'); if (d) d.open = true; });      // measure the form's tap targets too
      const r = await o.page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        h1: document.querySelector('h1').innerText.trim(), shown: [...document.querySelectorAll('.he,.en')].filter((e) => e.checkVisibility()).map((e) => e.className.split(' ')[0]),
        small: [...document.querySelectorAll('a.btn,button,summary,.foot a,.lang,.back a,.wa,.phone-play')].filter((e) => e.checkVisibility()).map((e) => { const b = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 24), Math.round(b.height), Math.round(b.width)]; }).filter((x) => x[1] < 44 || x[2] < 44),
        imgs: [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').map((i) => i.src),
        robots: (document.querySelector('meta[name="robots"]') || {}).content, og: (document.querySelector('meta[property="og:image"]') || {}).content }));
      assert.equal(r.lang, lang); assert.equal(r.dir, lang === 'he' ? 'rtl' : 'ltr');
      assert.ok(r.sw <= r.cw, `horizontal overflow ${r.sw} > ${r.cw}`);
      assert.ok(r.shown.length > 5 && r.shown.every((c) => c === lang), 'the other language is visible');
      assert.deepEqual(r.small, [], 'tap targets under 44 px: ' + JSON.stringify(r.small));
      assert.deepEqual(r.imgs, []); assert.ok(r.h1.length > 4);
      assert.equal(r.robots, 'noindex'); assert.equal(r.og, 'https://halom.io/mana/img/og.png');
      assert.deepEqual(o.errors, []);
      assert.deepEqual([...o.hosts], [new URL(srv.origin).host], 'a request left the site: ' + [...o.hosts]);
      if (prefix === '/mana/') {
        await o.page.evaluate(() => { const d = document.getElementById('talk-more'); if (d && !matchMedia('(min-width: 900px)').matches) d.open = false; });
        await o.page.evaluate(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += 500) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 50)); } window.scrollTo({ top: 0, behavior: 'instant' }); });
        await o.page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 5000 }).catch(() => {});
        await o.page.evaluate(async () => { for (const el of document.querySelectorAll('[data-reveal]')) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); const t0 = performance.now(); while (document.documentElement.classList.contains('anim') && !el.classList.contains('in') && performance.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 50)); el.classList.add('in'); } window.scrollTo({ top: 0, behavior: 'instant' }); });
        await o.page.waitForTimeout(2500);      // the reveals have finished
        await o.page.screenshot({ path: join(RAW, `page-${pg ? pg.replace('/', '-') : ''}${w}-${lang}.png`), fullPage: true }); if (!pg) await o.page.screenshot({ path: join(RAW, `fold-${w}-${lang}.png`) });
      }
      await o.ctx.close();
    });
  }
}

/* ------------------------------------------------------------------------------------------------ the product page (remaster) */
const AI_LABEL = { he: 'מנות לדוגמה · נוצרו בבינה מלאכותית', en: 'Demo dishes · made with AI' };      // the demo-food label
const AI_WORDS = /\bAI\b|בינה מלאכותית/;
const builtWith = (m) => renderIndex(Object.assign(mediaFound(), m));
const stubViewer = async (page) => page.route(/\/view\/((seat|host)\/)?(\?|index\.html|$)/, (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><title>viewer stub</title><body style="margin:0;background:#15110d;color:#fff;font:16px sans-serif"><p id="stub">viewer stub</p>' }));

await check('words: "AI" only inside .ai-tag elements and the demo-food label is there; the relief is never a "3D model"; no "3D" in the meta; no invented e-mail address', async () => {
  for (const pg of PAGES) for (const lang of ['he', 'en']) {
    const o = await open('/mana/' + pg + '?lang=' + lang + '&motion=off');
    await o.page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const text = await o.page.evaluate(() => document.body.innerText);
    if (!pg) {
      assert.ok(text.includes(AI_LABEL[lang]), 'the demo-food label is missing (' + lang + ')');
      const loose = await o.page.evaluate((src) => { const re = new RegExp(src), out = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n; (n = w.nextNode());) { const el = n.parentElement; if (!el || el.closest('script,style')) continue; if (re.test(n.nodeValue) && !el.closest('.ai-tag')) out.push(n.nodeValue.trim().slice(0, 60)); } return out; }, AI_WORDS.source);
      assert.deepEqual(loose, [], 'AI words outside an .ai-tag: ' + JSON.stringify(loose));
      const tags = await o.page.evaluate(() => [...document.querySelectorAll('.ai-tag')].filter((e) => e.checkVisibility()).map((e) => e.innerText.trim()));
      for (const want of lang === 'he' ? ['המחשה · נוצרה בבינה מלאכותית', 'דמות שנוצרה בבינה מלאכותית', AI_LABEL.he] : ['Illustration · made with AI', 'A person made with AI', AI_LABEL.en]) assert.ok(tags.includes(want), 'missing label: ' + want);
    }
    assert.ok(!/3D|תלת[־ -]?ממד/.test((await o.page.evaluate(() => [document.querySelector('meta[name="description"]').content, document.querySelector('meta[property="og:description"]').content, document.title].join(' '))) + (pg === 'guide/' ? text : '')), '"3D" in the meta or the guide: ' + pg + ' ' + lang);
    assert.ok(!/3D model|מודל תלת|digital twin|תאום דיגיטלי/i.test(text), 'calls the relief a 3D model: ' + pg + ' ' + lang);
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(text), 'an e-mail address appears on ' + pg);
    await o.ctx.close();
  }
});

await check('links: Start free and Sign in → studio; Try the demo and Demo are same-tab links to the demo (both prefixes); the seat button to the seat map; the plans to the talk section; footer → guide, privacy, terms', async () => {
  for (const prefix of ['/mana/', '/projects/menus/']) {
    const o = await open(prefix + '?lang=he');
    const r = await o.page.evaluate(() => ({ start: document.querySelector('.hero .cta .btn-ink').href, demo: document.querySelector('.hero .cta [data-demo-open]').href, top: document.querySelector('.top [data-demo-open]').href, signin: document.querySelector('.top-tools a.btn-ink').href,
      seat: document.querySelector('#place [data-demo-open="seat"]').href, offers: [...document.querySelectorAll('.plan .btn')].map((a) => a.getAttribute('href')), free: document.querySelector('.plan-free a').getAttribute('href'),
      targets: [...document.querySelectorAll('a[target]')].length, nav: [...document.querySelectorAll('.top-nav a')].map((a) => a.getAttribute('href')),
      foot: [...document.querySelectorAll('.foot-links a')].map((a) => a.href), credit: document.querySelector('.foot-fine a').href, line: document.querySelector('.foot-fine bdi').textContent, wa: document.querySelector('.talk-wa a').href }));
    assert.ok(r.start.endsWith(prefix + 'studio/'), r.start); assert.ok(r.signin.endsWith(prefix + 'studio/'), r.signin); assert.equal(r.free, './studio/');
    for (const u of [r.demo, r.top]) assert.ok(u.endsWith(prefix + 'view/?demo=olea&lang=he'), u);
    assert.ok(r.seat.endsWith(prefix + 'view/seat/?demo=olea&lang=he'), r.seat); assert.equal(r.targets, 0, 'a link opens a new tab');
    assert.deepEqual(r.offers, ['#talk-sec', '#talk-sec', '#talk-sec']); assert.deepEqual(r.nav, ['#how', '#plans', '#faq']);
    assert.deepEqual(r.foot.map((u) => u.slice(u.indexOf(prefix) + prefix.length)), ['guide/', 'privacy/', 'terms/']);
    assert.equal(r.credit, 'https://halom.io/'); assert.equal(r.line, 'Dreams, realized · חלומות מתגשמים'); assert.equal(r.wa, 'https://wa.me/972542022269');
    for (const u of [r.start, ...r.foot]) { const x = await o.page.request.get(u); assert.equal(x.status(), 200, u); }
    await o.ctx.close();
    for (const pg of ['guide/', 'privacy/', 'terms/']) {              // and back: every inner page leads home
      const i = await open(prefix + pg); const home = await i.page.evaluate(() => [document.querySelector('.back a').href, document.querySelector('.brand').href]);
      assert.ok(home.every((u) => u.endsWith(prefix)), pg + ' → ' + home); await i.ctx.close();
    }
  }
});

await check('language switch: text, direction, title, the demo links and the labels follow; the choice is remembered', async () => {
  const o = await open('/mana/');
  await o.page.click('.top [data-lang-toggle]');
  const r = await o.page.evaluate(() => ({ l: document.documentElement.lang, d: document.documentElement.dir, t: document.title, h: document.querySelector('.hero [data-demo-open]').getAttribute('href'), seat: document.querySelector('#place [data-demo-open]').getAttribute('href'),
    x: document.querySelector('.dlg-x').getAttribute('aria-label'), h1: document.querySelector('h1').innerText.trim(), shown: [...document.querySelectorAll('.he,.en')].filter((e) => e.checkVisibility()).every((e) => e.classList.contains('en')) }));
  assert.equal(r.l, 'en'); assert.equal(r.d, 'ltr'); assert.match(r.t, /^Mana · See the dish/); assert.match(r.h, /lang=en$/); assert.match(r.seat, /seat\/\?demo=olea&lang=en$/); assert.equal(r.x, 'Close'); assert.equal(r.h1, 'See the dish before you order.'); assert.equal(r.shown, true);
  await o.page.reload(); assert.equal(await o.page.evaluate(() => document.documentElement.lang), 'en');
  await o.ctx.close();
});

await check('hero: the words as written; the stills stand first; the shape-shifting dish is asked for only after load (never on Save-Data or with reduced motion), and while it returns nothing the stills stay; the dish names follow the stills', async () => {
  const o = await open('/mana/?lang=he&hero=on', { w: 1440, h: 900, touch: false, init: () => { window.__t = { loadAt: null }; window.addEventListener('load', () => { window.__t.loadAt = performance.now(); }); } });
  const r = await o.page.evaluate(() => ({ eyebrow: document.querySelector('.eyebrow').innerText.trim(), h1: document.querySelector('h1').innerText.trim(), lead: document.querySelector('.hero .lead').innerText.trim(),
    stills: [...document.querySelectorAll('.stills img')].map((i) => i.getAttribute('src')), first: (() => { const i = document.querySelector('.stills img'); return i.complete && i.naturalWidth > 0 && +getComputedStyle(i).opacity > 0; })(),
    names: [...document.querySelectorAll('.dn .he')].map((e) => e.textContent), floats: document.querySelectorAll('.floaters img').length, host: (() => { const h = document.getElementById('hero-gl'); return [getComputedStyle(h).position, h.children.length]; })() }));
  assert.equal(r.eyebrow, 'מָנָה · כוח החיים שבאוכל'); assert.equal(r.h1, 'רואים את המנה לפני שמזמינים.'); assert.equal(r.lead, 'תפריט QR שמראה את המנות שלכם על השולחן. בקרוב באותה חבילה: אתר, רילסים ומפת ישיבה.');
  assert.deepEqual(r.stills, ['pizza', 'burger', 'ramen', 'croissant', 'shakshuka', 'gelato'].map((d) => `./img/dishes/${d}.webp`)); assert.equal(r.first, true, 'the first still is not there');
  assert.deepEqual(r.names, ['מרגריטה', 'המבורגר', 'ראמן', 'קרואסון', 'שקשוקה', 'גלידה']); assert.equal(r.floats, 6); assert.deepEqual(r.host, ['relative', 0]);
  await o.page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => /\/land\/chunks\/hero-morph/.test(e.name)), null, { timeout: 25000 });
  const at = await o.page.evaluate(() => ({ chunk: performance.getEntriesByType('resource').find((e) => /hero-morph/.test(e.name)).startTime, load: window.__t.loadAt }));
  assert.ok(at.chunk >= at.load, 'the hero module was asked for before load');
  await o.page.waitForFunction(() => document.getElementById('hero-stage').getAttribute('data-hero') === 'live', null, { timeout: 45000 });      // the real dish draws (software GL: seconds)
  assert.equal(await o.page.evaluate(() => document.querySelectorAll('#hero-gl canvas').length), 1, 'the hero has no canvas');
  assert.ok(o.reqs.some((u) => /img\/dishes\/pizza\.glb$/.test(u)), 'the first dish mesh was not loaded'); await o.page.waitForTimeout(1500);
  await o.page.screenshot({ path: join(RAW, 'hero-1440-he.png') }); assert.deepEqual(o.errors, []); await o.ctx.close();
  for (const q of ['save=1', 'hero=on']) {
    const s = await open('/mana/?' + q, { reduced: q === 'hero=on' }); await s.page.waitForTimeout(1500);
    assert.ok(!s.reqs.some((u) => /hero-morph/.test(u)), 'the hero module was fetched with ' + (q === 'save=1' ? 'Save-Data' : 'reduced motion')); await s.ctx.close();
  }
});

await check('phone fold: the headline, both buttons and the dish are on the first screen at 390 × 844 and 360 × 640; the ingredients never cover the words', async () => {
  for (const [w, h] of [[390, 844], [360, 640]]) for (const lang of ['he', 'en']) {
    const o = await open('/mana/?lang=' + lang, { w, h });
    const r = await o.page.evaluate(() => { const vh = innerHeight, b = (e) => e.getBoundingClientRect(), inFirst = (e) => { const x = b(e); return x.top >= 0 && x.bottom <= vh; };
      const words = [document.querySelector('h1'), document.querySelector('.hero .lead:not([hidden])'), ...document.querySelectorAll('.hero .cta .btn')].filter((e) => e.checkVisibility()).map(b);
      const fl = [...document.querySelectorAll('.fl')].filter((e) => e.checkVisibility()).map(b), hit = fl.filter((f) => words.some((t) => f.left < t.right && f.right > t.left && f.top < t.bottom && f.bottom > t.top));
      const dish = b(document.querySelector('.stills img'));
      return { h1: inFirst(document.querySelector('h1')), cta: [...document.querySelectorAll('.hero .cta .btn')].every(inFirst), dish: dish.top + dish.height * .5 < vh, floats: fl.length, hit: hit.length }; });
    assert.equal(r.h1, true, `${w} ${lang}: headline`); assert.equal(r.cta, true, `${w} ${lang}: buttons`); assert.equal(r.dish, true, `${w} ${lang}: the dish is below the fold`);
    assert.ok(r.floats <= 3, `${w}: ${r.floats} ingredients on a phone`); assert.equal(r.hit, 0, `${w} ${lang}: an ingredient covers the words`);
    await o.page.screenshot({ path: join(RAW, `fold-${w}x${h}-${lang}.png`) }); await o.ctx.close();
  }
  const o = await open('/mana/?lang=he', { w: 1440, h: 900, touch: false });
  const hit = await o.page.evaluate(() => { const b = (e) => e.getBoundingClientRect(), words = [...document.querySelectorAll('.hero-words > *')].filter((e) => e.checkVisibility()).map(b);
    return [...document.querySelectorAll('.fl')].map(b).filter((f) => words.some((t) => f.left < t.right && f.right > t.left && f.top < t.bottom && f.bottom > t.top)).length; });
  assert.equal(hit, 0, '1440: an ingredient covers the words'); await o.ctx.close();
});

await check('three steps in reading order, as glass cards; the scanner is named only when config.features.scan is true', async () => {
  for (const [scan, lang] of [[false, 'he'], [false, 'en'], [true, 'he'], [true, 'en']]) {
    const s2 = await listen(0, { scan });
    const o = await open('/mana/?motion=off&lang=' + lang, { origin: s2.origin, w: 1440, h: 900, touch: false });
    const r = await o.page.evaluate(() => ({ steps: [...document.querySelectorAll('.step')].map((s) => ({ x: Math.round(s.getBoundingClientRect().left), text: s.querySelector('p').innerText.trim(), drawn: [...s.querySelectorAll('.step-art svg')].filter((v) => v.checkVisibility()).length, glass: s.classList.contains('glass') })),
      all: document.body.innerText, flag: document.documentElement.getAttribute('data-scan') }));
    assert.equal(r.steps.length, 3); assert.ok(r.steps.every((s) => s.drawn === 1 && s.glass), 'each step: one drawing on glass');
    const xs = r.steps.map((s) => s.x); assert.ok(lang === 'he' ? xs[0] > xs[1] && xs[1] > xs[2] : xs[0] < xs[1] && xs[1] < xs[2], lang + ' order: ' + xs);
    assert.equal(r.flag, scan ? '1' : null); assert.equal(/סורקים|scan your/i.test(r.all), scan, 'the scanner is named with features.scan ' + scan);
    assert.match(r.steps[0].text, scan ? /סורקים את התפריט המודפס|Scan your printed menu/ : /מדביקים או מקלידים תפריט|Paste or type your menu/);
    assert.match(r.steps[1].text, /מוסיפים תמונות או איורים|Add photos or illustrations/); assert.match(r.steps[2].text, /מדפיסים קוד QR|Print the QR/);
    await o.ctx.close(); s2.server.close();
  }
});

await check('simple for guests: six tiles with their words; copying the section gives clean words (no "אA", no "3030", no letters from the drawings); the loops run only while the section is on screen', async () => {
  for (const lang of ['he', 'en']) {
    const o = await open('/mana/?lang=' + lang, { w: 1440, h: 900, touch: false });
    const r = await o.page.evaluate(() => { const ul = document.querySelector('.bento'), rng = document.createRange(); rng.selectNodeContents(ul); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(rng);
      const copied = sel.toString().replace(/\s+/g, ' ').trim(); sel.removeAllRanges();
      const want = [...ul.querySelectorAll('.tile-b')].map((t) => [...t.querySelectorAll('h3,.b-sub,.chip')].filter((e) => e.checkVisibility()).map((e) => e.innerText.trim()).join(' ')).join(' ').replace(/\s+/g, ' ').trim();
      const textInViz = [...ul.querySelectorAll('.viz')].map((v) => v.textContent.trim()).join('');
      return { copied, want, textInViz, tiles: ul.querySelectorAll('.tile-b').length, titles: [...ul.querySelectorAll('h3')].map((h) => h.innerText.trim()), hidden: [...ul.querySelectorAll('.viz')].every((v) => v.getAttribute('aria-hidden') === 'true') }; });
    assert.equal(r.tiles, 6); assert.equal(r.textInViz, '', 'a drawing carries text nodes: ' + r.textInViz); assert.equal(r.hidden, true, 'a drawing is not aria-hidden');
    assert.equal(r.copied, r.want, 'the copied text is not just the tiles\' words'); assert.ok(!/אA|3030|\bEN\b|עב\b/.test(r.copied.replace(/עברית/g, '')), 'glitch letters in the copy: ' + r.copied);
    assert.deepEqual(r.titles, lang === 'he' ? ['בלי אפליקציה לסועדים', 'עברית ואנגלית', '״אזל״ בנגיעה אחת', 'קוד QR שלא משתנה', 'איורים עד שיש תמונות', 'המראה של המקום שלכם'] : ['No app for guests', 'Hebrew and English', 'Sold out in one tap', 'Your QR never changes', 'Illustrations until you have photos', 'Your place’s look']);
    const count = () => o.page.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('.bento')).length);
    assert.equal(await count(), 0, 'the tiles move while off screen');
    await o.page.evaluate(() => document.getElementById('simple').scrollIntoView({ block: 'center', behavior: 'instant' }));
    for (const t0 = Date.now(); (await count()) < 12 && Date.now() - t0 < 8000;) await o.page.waitForTimeout(200);      // a busy machine can be late to start them
    assert.ok(await count() >= 12, 'the tiles do not move on screen'); await o.page.locator('#simple').screenshot({ path: join(RAW, `simple-1440-${lang}.png`) });
    await o.ctx.close();
  }
});

await check('your place: the words as written, the "new · in demo" chip, the still plan on glass with the Olea room\'s twelve tables and the five table states; floor3d.js is asked for only when the section comes near; while it returns nothing the still stays', async () => {
  const o = await open('/mana/?lang=he&floor=on', { w: 1440, h: 900, touch: false });
  await o.page.waitForTimeout(1500); assert.ok(!o.reqs.some((u) => /floor3d/.test(u)), 'the floor module was fetched at the top of the page');
  const r = await o.page.evaluate(() => ({ chip: document.querySelector('#place .chip-new').innerText.trim(), p: [...document.querySelectorAll('#place .sec-p')].find((e) => e.checkVisibility()).innerText.trim(), lines: [...document.querySelectorAll('#place .marks li')].map((l) => l.innerText.trim()), tables: document.querySelectorAll('.fl-t').length,
    states: [...new Set([...document.querySelectorAll('.fl-t')].map((t) => t.classList[1]))].sort(), key: [...document.querySelectorAll('.floor-key li')].map((l) => l.innerText.trim()), host: getComputedStyle(document.getElementById('floor-gl')).position }));
  assert.equal(r.chip, 'בקרוב · אפשר לנסות בהדגמה'); assert.equal(r.p, 'מפת הישיבה של המסעדה, חיה. הסועדים בוחרים אזור או שולחן, אתם מאשרים, ולכל שולחן יש שעון.');
  assert.deepEqual(r.lines, ['זמן ישיבה לכל שולחן. אתם קובעים את ברירת המחדל.', 'כשהזמן נגמר, השולחן מתפנה והמנהל מקבל התראה.']); assert.equal(r.tables, 12);
  assert.deepEqual(r.states, ['ending', 'free', 'reserved', 'seated', 'up']); assert.equal(r.key.length, 5); assert.equal(r.host, 'relative');
  await o.page.evaluate(() => document.getElementById('place').scrollIntoView({ block: 'center', behavior: 'instant' }));
  for (const t0 = Date.now(); !o.reqs.some((u) => /floor3d/.test(u)) && Date.now() - t0 < 6000;) await o.page.waitForTimeout(100);
  assert.ok(o.reqs.some((u) => /\/land\/chunks\/floor3d-/.test(u)), 'the floor module was never asked for');
  await o.page.waitForFunction(() => document.getElementById('floor').getAttribute('data-floor') === 'live', null, { timeout: 45000 });      // the real floor draws (software GL: seconds)
  assert.equal(await o.page.evaluate(() => document.querySelectorAll('#floor-gl canvas').length), 1, 'the floor has no canvas'); await o.page.waitForTimeout(1500);
  await o.page.locator('#place').screenshot({ path: join(RAW, 'place-1440-he.png') }); assert.deepEqual(o.errors, []); await o.ctx.close();
});

await check('what you learn: the four lines; the sample label beside the numbers; the numbers count up once in view and end on the sample (212, +18%, the five dishes, 31%, 78%, 64); the busy hours are 24 three-faced bars (the owner app’s hours)', async () => {
  for (const lang of ['he', 'en']) {
    const o = await open('/mana/?lang=' + lang, { w: 1440, h: 900, touch: false });
    let r = await o.page.evaluate(() => ({ in: document.querySelector('.dash').classList.contains('in'), lines: [...document.querySelectorAll('.learn li')].map((l) => l.innerText.trim()) }));
    assert.equal(r.in, false, 'the numbers were drawn before they were on screen');
    assert.deepEqual(r.lines, lang === 'he' ? ['יודעים אילו מנות הסועדים פותחים.', 'רואים מתי הכי עמוס.', 'רואים כמה קוראים באנגלית.', 'בלי עוגיות, בלי לשמור דבר על הסועדים.'] : ['Know which dishes guests open.', 'See your busy hours.', 'See how many read in English.', 'No cookies, nothing stored about guests.']);
    await o.page.evaluate(() => document.querySelector('.dash').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await o.page.waitForFunction(() => document.querySelector('.dash').classList.contains('in'));
    const mid = await o.page.evaluate(() => new Promise((res) => setTimeout(() => res(+document.querySelector('.dash-big [data-count]').textContent), 600)));
    assert.ok(mid > 0 && mid < 212, 'the views did not count up: ' + mid); await o.page.waitForTimeout(2000);
    await o.page.waitForFunction(() => [...document.querySelectorAll('.hfield .b')].every((b) => getComputedStyle(b).transform === 'none'), null, { timeout: 10000 }).catch(() => {});
    r = await o.page.evaluate(() => { const d = document.querySelector('.dash'), lab = d.querySelector('.dash-sample'), big = d.querySelector('.dash-big'), lb = lab.getBoundingClientRect(), bb = big.getBoundingClientRect();
      return { label: lab.innerText.trim(), labVis: lab.checkVisibility(), gap: Math.round(bb.top - lb.bottom), big: big.innerText.replace(/\s+/g, ' ').trim(), dishes: [...d.querySelectorAll('.tops li')].map((l) => [l.querySelector('.tn').innerText.trim(), l.querySelector('b').innerText.trim()]),
        rings: [...d.querySelectorAll('.t-ring .dash-mid')].map((e) => e.innerText.trim()), adds: d.querySelector('.t-adds .dash-mid').innerText.trim(), bars: d.querySelectorAll('.hfield .b').length, faces: d.querySelectorAll('.hfield .b > b').length,
        peak: d.querySelectorAll('.hfield .b.pk').length, preserve: getComputedStyle(d.querySelector('.hfield')).transformStyle, grown: [...d.querySelectorAll('.hfield .b')].every((b) => getComputedStyle(b).transform === 'none'), tabular: getComputedStyle(big).fontVariantNumeric }; });
    assert.equal(r.label, lang === 'he' ? 'דוגמה · מספרים להמחשה' : 'Example · sample numbers'); assert.equal(r.labVis, true); assert.ok(r.gap >= 0 && r.gap < 160, 'the sample label is not beside the numbers: ' + r.gap);
    assert.match(r.big, /^212 ?\+18%$/); assert.deepEqual(r.dishes.map((x) => x[1]), ['96', '81', '64', '52', '41']);
    assert.deepEqual(r.dishes.map((x) => x[0]), lang === 'he' ? ['שקשוקה', 'מרגריטה', 'ראמן', 'המבורגר', 'קרואסון'] : ['Shakshuka', 'Margherita', 'Ramen', 'Burger', 'Croissant']);
    assert.deepEqual(r.rings, ['31%', '78%']); assert.equal(r.adds, '64'); assert.equal(r.bars, 24); assert.equal(r.faces, 72); assert.equal(r.peak, 1); assert.equal(r.preserve, 'preserve-3d'); assert.equal(r.grown, true, 'a bar did not finish rising'); assert.match(r.tabular, /tabular-nums/);
    await o.page.locator('.dash').screenshot({ path: join(RAW, `dash-1440-${lang}.png`) }); assert.deepEqual(o.errors, []); await o.ctx.close();
  }
});

await check('your site, your reels: the words, the "coming" chip, the host film only while on screen (no source in the HTML, never with reduced motion or Save-Data), its AI label; the invented site for Olea with a decorative "Book a table"', async () => {
  const o = await open('/mana/?lang=he', { w: 1440, h: 900, touch: false });
  let r = await o.page.evaluate(() => { const v = document.querySelector('.reel-video'); return { src: v.getAttribute('src'), preload: v.preload, autoplay: v.autoplay, poster: v.getAttribute('poster'), muted: v.muted, loop: v.loop, chip: document.querySelector('#reels .chip').innerText.trim(), p: [...document.querySelectorAll('#reels .sec-p')].find((e) => e.checkVisibility()).innerText.trim(), book: document.querySelector('.site-book').closest('a'), card: document.querySelector('.site-card').getAttribute('aria-hidden') }; });
  assert.deepEqual([r.src, r.preload, r.autoplay, r.poster, r.muted, r.loop], [null, 'none', false, null, true, true]); assert.equal(r.chip, 'בקרוב'); assert.equal(r.p, 'אתר למסעדה מתוך אותו תפריט, ורילסים כדי להתחיל לפרסם.'); assert.equal(r.book, null); assert.equal(r.card, 'true');
  assert.ok(!o.reqs.some((u) => /host-orbit\.mp4/.test(u)), 'the film was fetched before it was on screen');
  await o.page.evaluate(() => document.getElementById('reels').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await o.page.waitForFunction(() => document.querySelector('.reel-video').getAttribute('src'), null, { timeout: 8000 }).catch(() => {});      // a busy machine can be late
  r = await o.page.evaluate(() => ({ src: document.querySelector('.reel-video').getAttribute('src') })); assert.equal(r.src, './img/host/host-orbit.mp4');
  await o.page.locator('#reels').screenshot({ path: join(RAW, 'reels-1440-he.png') }); await o.ctx.close();
  for (const [q, reduced] of [['save=1', false], ['', true]]) {
    const s = await open('/mana/?' + q, { reduced }); await s.page.evaluate(() => document.getElementById('reels').scrollIntoView({ block: 'center', behavior: 'instant' })); await s.page.waitForTimeout(700);
    assert.equal(await s.page.evaluate(() => document.querySelector('.reel-video').getAttribute('src')), null, 'the film loads with ' + (reduced ? 'reduced motion' : 'Save-Data')); await s.ctx.close();
  }
});

await check('plans: three glass plans by number of dishes, each with "Get an offer" (no price yet); one shared list, included today and coming to every plan; the 30-day line; nothing says pilot', async () => {
  for (const lang of ['he', 'en']) {
    const o = await open('/mana/?lang=' + lang + '&motion=off', { w: 1440, h: 900, touch: false });
    const r = await o.page.evaluate(() => { const s = document.getElementById('plans'); return { h2: s.querySelector('h2').innerText.trim(), sub: [...s.querySelectorAll('.sec-p')].find((e) => e.checkVisibility()).innerText.trim(), plans: [...s.querySelectorAll('.plan')].map((p) => [p.querySelector('h3').innerText.trim(), p.querySelector('.btn').innerText.trim(), p.classList.contains('glass'), !!p.querySelector('.plan-price')]),
      groups: [...s.querySelectorAll('.plan-group')].map((g) => [g.querySelector('h3').innerText.trim(), [...g.querySelectorAll('li')].map((l) => l.innerText.trim())]), free: [...s.querySelectorAll('.plan-free p')].find((e) => e.checkVisibility()).innerText.trim(), text: s.innerText }; });
    const he = lang === 'he';
    assert.equal(r.h2, he ? 'חבילות' : 'Plans'); assert.equal(r.sub, he ? 'כל חבילה כוללת הכול. ההבדל הוא מספר המנות.' : 'Every plan includes everything. The difference is the number of dishes.');
    assert.deepEqual(r.plans, (he ? ['עד 50 מנות', 'עד 100 מנות', 'מנות ללא הגבלה'] : ['Up to 50 dishes', 'Up to 100 dishes', 'Unlimited dishes']).map((n) => [n, he ? 'לקבל הצעה' : 'Get an offer', true, false]));
    assert.deepEqual(r.groups, he ? [['כלול היום', ['תפריט QR עם תבליטים או איורים', 'עברית ואנגלית', '״אזל״ בנגיעה אחת', 'קוד QR להדפסה, שלא משתנה', 'נתוני צפייה, בלי עוגיות']], ['בקרוב לכל החבילות', ['מפת ישיבה ושעון לכל שולחן', 'אתר למסעדה', 'רילסים', 'מראות לבחירה', 'תשלום ליד השולחן']]]
      : [['Included today', ['A QR menu with reliefs or illustrations', 'Hebrew and English', 'Sold out in one tap', 'A printable QR that never changes', 'Views data, no cookies']], ['Coming to every plan', ['A seat map and a clock for every table', 'A restaurant website', 'Reels', 'Looks to choose from', 'Pay at the table']]]);
    assert.equal(r.free, he ? 'בכל חבילה: 30 הימים הראשונים חינם, בלי כרטיס אשראי.' : 'Every plan: the first 30 days free, no card.'); assert.ok(!/פיילוט|pilot/i.test(r.text), 'the plans say pilot');
    await o.page.locator('#plans').screenshot({ path: join(RAW, `plans-1440-${lang}.png`) }); await o.ctx.close();
  }
});

await check('questions: the five, with the two new answers (after 30 days you choose a plan; Halom sets up the first restaurants with you); nothing says pilot', async () => {
  for (const lang of ['he', 'en']) {
    const o = await open('/mana/?lang=' + lang); await o.page.evaluate(() => document.querySelectorAll('.faq details').forEach((d) => { d.open = true; }));
    const a = await o.page.evaluate(() => [...document.querySelectorAll('.faq details')].map((d) => d.querySelector('.a').innerText.trim()));
    assert.equal(a.length, 5);
    assert.equal(a[3], lang === 'he' ? 'בוחרים חבילה. אם לא ממשיכים, הקישור נשאר שלכם ומציג ״התפריט לא זמין כרגע״. שום דבר לא נמחק.' : 'You choose a plan. If you stop, the link stays yours and shows “This menu is not available right now”. Nothing is deleted.');
    assert.equal(a[4], lang === 'he' ? 'Halom, סטודיו קריאייטיב מתל אביב. את המסעדות הראשונות אנחנו מקימים יחד איתכם.' : 'Halom, a creative studio in Tel Aviv. We set up the first restaurants together with you.');
    assert.ok(!/פיילוט|pilot/i.test(await o.page.evaluate(() => document.querySelector('main').innerText)), 'the page says pilot'); await o.ctx.close();
  }
});

const dlgState = (page) => page.evaluate(() => { const d = document.getElementById('demo'), f = d.querySelector('iframe'); return { open: d.open, src: f ? f.getAttribute('src') : null, frames: d.querySelectorAll('iframe').length, tab: d.getAttribute('data-tab'), label: d.querySelector('.dlg-tag').checkVisibility() ? d.querySelector('.dlg-tag').innerText.trim() : '' }; });
await check('demo dialog: the Demo button opens it and its frame loads view/?demo=olea; the looks switch the same frame; the seat map; Esc and the close button close it, the frame goes and focus returns; the demo-food label stays visible; #demo opens it; the viewer\'s "← Mana" closes it', async () => {
  for (const [w, h, touch, lang] of [[1440, 900, false, 'he'], [390, 844, true, 'en']]) {
    const o = await open('/mana/?lang=' + lang, { w, h, touch }); await stubViewer(o.page);
    assert.equal((await dlgState(o.page)).frames, 0, 'a frame before the dialog opened'); assert.ok(!o.reqs.some((u) => u.includes('/view/')), 'the viewer was fetched before anyone asked');
    await o.page.click('.top [data-demo-open]');
    let r = await dlgState(o.page); assert.equal(r.open, true); assert.equal(r.src, './view/?demo=olea&lang=' + lang); assert.equal(r.label, AI_LABEL[lang]);
    await o.page.waitForFunction(() => { const f = document.querySelector('#demo iframe'); return f && f.contentDocument && f.contentDocument.getElementById('stub'); }, null, { timeout: 8000 });
    const fit = await o.page.evaluate(() => { const f = document.querySelector('#demo iframe').getBoundingClientRect(), s = document.getElementById('dlg-screen').getBoundingClientRect(), v = [innerWidth, innerHeight]; return { f: [Math.round(f.width), Math.round(f.height)], s: [Math.round(s.width), Math.round(s.height)], v }; });
    assert.ok(Math.abs(fit.f[0] - fit.s[0]) <= 2 && Math.abs(fit.f[1] - fit.s[1]) <= 3, 'the frame does not fill its screen: ' + JSON.stringify(fit));
    if (w < 900) assert.ok(fit.s[0] >= w - 2, 'on a phone the menu is not the whole width: ' + fit.s[0]);
    await o.page.screenshot({ path: join(RAW, `dialog-${w}-${lang}.png`) });
    await o.page.click('.dlg-tab[data-tab="looks"]'); r = await dlgState(o.page); assert.equal(r.src, './view/?demo=olea&lang=' + lang + '&template=album-side'); assert.equal(r.frames, 1);
    await o.page.click('.dlg-look[data-look="back-door"]'); assert.equal((await dlgState(o.page)).src, './view/?demo=olea&lang=' + lang + '&template=back-door');
    await o.page.screenshot({ path: join(RAW, `dialog-looks-${w}-${lang}.png`) });
    await o.page.click('.dlg-tab[data-tab="seat"]'); assert.equal((await dlgState(o.page)).src, './view/seat/?demo=olea&lang=' + lang);
    await o.page.click('.dlg-tab[data-tab="tables"]'); assert.equal((await dlgState(o.page)).src, './view/host/?demo=olea&speed=60&lang=' + lang);      // the table clocks: the manager's board, sped up
    await o.page.keyboard.press('Escape'); await o.page.waitForFunction(() => !document.getElementById('demo').open);
    await o.page.waitForTimeout(100); r = await dlgState(o.page); assert.equal(r.frames, 0, 'the frame stayed after closing');
    assert.ok(await o.page.evaluate(() => document.activeElement && document.activeElement.matches('.top [data-demo-open]')), 'focus did not return to the button');
    await o.page.click('#place [data-demo-open="seat"]'); r = await dlgState(o.page); assert.equal(r.src, './view/seat/?demo=olea&lang=' + lang); assert.equal(r.tab, 'seat');
    await o.page.click('.dlg-x'); assert.equal((await dlgState(o.page)).open, false);
    assert.deepEqual(o.errors, []); await o.ctx.close();
  }
  const o = await open('/mana/#demo'); await stubViewer(o.page); await o.page.reload();
  await o.page.waitForFunction(() => document.getElementById('demo').open, null, { timeout: 5000 }); assert.match((await dlgState(o.page)).src, /^\.\/view\/\?demo=olea&lang=he$/);
  await o.page.unroute(/\/view\//);
  await o.page.evaluate(() => { document.querySelector('#demo iframe').src = './?hero=off'; });       // what the demo's "← Mana" link does inside the frame
  await o.page.waitForFunction(() => !document.getElementById('demo').open && !document.querySelector('#demo iframe'), null, { timeout: 10000 });
  assert.ok(!(await o.page.evaluate(() => location.hash)), 'the address still says #demo'); await o.ctx.close();
});

await check('demo dialog, the film: no film files → no film tab; with them the tab plays the wide cut on a wide screen, the tall cut on a phone, the -en cuts in English; closing stops it', async () => {
  const tabs = async (html) => (html.match(/data-tab="film"/g) || []).length;
  assert.equal(await tabs(builtWith({ film169: false, film916: false, film169en: false, film916en: false })), 0);
  const wide = join(SCRATCH, 'film-16x9.mp4'), tall = join(SCRATCH, 'film-9x16.mp4');
  const s2 = await listen(0, { pages: { 'index.html': builtWith({ film169: true, film916: true, film169en: true, film916en: true }) }, media: { 'img/film-16x9.mp4': wide, 'img/film-9x16.mp4': tall, 'img/film-16x9-en.mp4': wide, 'img/film-9x16-en.mp4': tall } });
  for (const [lang, w, h, touch, want] of [['he', 1440, 900, false, 'film-16x9.mp4'], ['he', 390, 844, true, 'film-9x16.mp4'], ['en', 1440, 900, false, 'film-16x9-en.mp4'], ['en', 390, 844, true, 'film-9x16-en.mp4']]) {
    const o = await open('/mana/?lang=' + lang, { origin: s2.origin, w, h, touch }); await stubViewer(o.page);
    assert.ok(!o.reqs.some((u) => /film-/.test(u)), 'the film was requested before anyone asked');
    await o.page.click('.top [data-demo-open]'); await o.page.click('.dlg-tab[data-tab="film"]');
    const r = await o.page.evaluate(() => ({ src: document.querySelector('#demo video').getAttribute('src'), frames: document.querySelectorAll('#demo iframe').length }));
    assert.ok((r.src || '').endsWith('/' + want), `${lang} ${w}: ${r.src}`); assert.equal(r.frames, 0, 'the menu frame stayed under the film');
    if (w === 1440 && lang === 'he') await o.page.screenshot({ path: join(RAW, 'dialog-film-1440.png') });
    await o.page.keyboard.press('Escape'); await o.page.waitForFunction(() => !document.getElementById('demo').open && !document.querySelector('#demo video').getAttribute('src'));
    await o.ctx.close();
  }
  s2.server.close();
});

await check('reduced motion: nothing animates after load or after a scroll through the page, the stills show (the first dish and its name, the floor plan, the numbers as they are), no film', async () => {
  for (const [w, h, touch] of [[390, 844, true], [1440, 900, false]]) {
    const o = await open('/mana/?lang=he&hero=on', { w, h, touch, reduced: true }); await o.page.waitForTimeout(800);
    let n = await o.page.evaluate(() => document.getAnimations().length); assert.equal(n, 0, w + ': ' + n + ' animations after load');
    await o.page.evaluate(async () => { const H = document.documentElement.scrollHeight; for (let y = 0; y < H; y += 400) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 60)); } });
    await o.page.waitForTimeout(600);
    const r = await o.page.evaluate(() => ({ n: document.getAnimations().length, anim: document.documentElement.classList.contains('anim'), first: +getComputedStyle(document.querySelector('.stills img')).opacity, rest: [...document.querySelectorAll('.stills img')].slice(1).map((i) => +getComputedStyle(i).opacity),
      name: [...document.querySelectorAll('.dn')].filter((d) => +getComputedStyle(d).opacity > 0).map((d) => d.innerText.trim()), plan: document.querySelector('.floor-still').checkVisibility() && +getComputedStyle(document.querySelector('.floor-still')).opacity,
      big: document.querySelector('.dash-big [data-count]').textContent, ring: getComputedStyle(document.querySelector('.ring-v')).strokeDasharray, video: document.querySelector('.reel-video').getAttribute('src'), steps: getComputedStyle(document.querySelector('.step')).opacity }));
    assert.equal(r.n, 0, w + ': ' + r.n + ' animations after a scroll'); assert.equal(r.anim, false); assert.equal(r.first, 1); assert.ok(r.rest.every((x) => x === 0)); assert.deepEqual(r.name, ['מרגריטה']);
    assert.equal(r.plan, 1); assert.equal(r.big, '212'); assert.match(r.ring, /^31(px)?,? 100/); assert.equal(r.video, null); assert.equal(r.steps, '1');
    await o.page.screenshot({ path: join(RAW, `reduced-${w}.png`), fullPage: true }); assert.deepEqual(o.errors, []); await o.ctx.close();
  }
});

await check('head: a CSP that limits connections to the site and Supabase and frames to the site; the page\'s own stylesheet; the English display face is self-hosted and fetched only by the English page', async () => {
  const o = await open('/mana/?lang=he');
  const r = await o.page.evaluate(() => ({ csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content, css: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href')), script: [...document.querySelectorAll('script[src]')].map((s) => [s.getAttribute('src'), s.type]), theme: document.querySelector('meta[name="theme-color"]').content }));
  assert.equal(r.csp, "connect-src 'self' blob: https://zemdhczqlhkabfwxccqq.supabase.co; frame-src 'self'"); assert.deepEqual(r.css, ['./land.css']); assert.deepEqual(r.script, [['./config.js', ''], ['./land/main.js', 'module']]); assert.equal(r.theme, '#F7F4EE');      // blob: the dish meshes' textures are decoded from blob addresses the page makes itself
  await o.page.waitForTimeout(800); assert.ok(!o.reqs.some((u) => /fraunces/.test(u)), 'the Hebrew page fetched the English display face'); await o.ctx.close();
  const e = await open('/mana/?lang=en'); await e.page.waitForFunction(() => document.fonts.check('16px Fraunces'), null, { timeout: 8000 });
  assert.ok(e.reqs.some((u) => /fonts\/fraunces-latin-standard-normal\.woff2$/.test(u)), 'Fraunces was not fetched from the site'); assert.match(await e.page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily), /^Fraunces/);
  assert.ok(existsSync(join(ROOT, 'site', 'fonts', 'OFL-fraunces.txt')), 'no licence text for Fraunces'); await e.ctx.close();
});

await check('preview build (MANA_PREVIEW=1): the form is rendered switched off with a line saying so, and sends nothing; the normal build is unchanged', async () => {
  assert.ok(!/data-off|preview-off/.test(renderIndex(mediaFound())), 'the normal build carries the preview switch');
  const s2 = await listen(0, { pages: { 'index.html': renderIndex(mediaFound(), { preview: true }) } });
  const o = await open('/mana/?lang=he', { origin: s2.origin, w: 1440, h: 900, touch: false }); const n = s2.server.leads.length;
  const r = await o.page.evaluate(() => ({ off: document.getElementById('talk').getAttribute('data-off'), line: document.querySelector('.preview-off').innerText.trim(), disabled: ['f-place', 'f-contact', 'f-msg', 'f-send'].map((id) => document.getElementById(id).disabled) }));
  assert.equal(r.off, '1'); assert.match(r.line, /תצוגה מקדימה/); assert.deepEqual(r.disabled, [true, true, true, true]);
  await o.page.evaluate(() => document.getElementById('talk').requestSubmit()); await o.page.waitForTimeout(500);
  assert.equal(s2.server.leads.length, n); assert.ok(!o.reqs.some((u) => /submit_lead/.test(u)), 'the preview build posted a lead');
  await o.ctx.close(); s2.server.close();
});


await check('built page matches what tools/build-site.mjs writes today, and the film tab matches the media files in site/img', async () => {
  const html = readFileSync(join(ROOT, 'site', 'index.html'), 'utf8'), m = mediaFound();
  assert.equal(/data-tab="film"/.test(html), !!(m.film169 || m.film916), 'film tab');
  assert.equal(html, renderIndex(m), 'site/index.html is not what tools/build-site.mjs writes today');
});

await check('media files on the page: hero loops and film cuts within their limits, H.264 that phones play, no sound, index first; the hero poster is the first frame of the hero video', async () => {
  const dir = join(ROOT, 'site', 'img'), found = {};
  const want = { 'hero.mp4': [2.5e6, 390, 844], 'hero-en.mp4': [2.5e6, 390, 844], 'film-16x9.mp4': [8e6, 1920, 1080], 'film-9x16.mp4': [8e6, 1080, 1920], 'film-16x9-en.mp4': [8e6, 1920, 1080], 'film-9x16-en.mp4': [8e6, 1080, 1920] };
  for (const [f, [max, w, h]] of Object.entries(want)) {
    const p = join(dir, f); if (!existsSync(p)) continue;
    const j = JSON.parse(execFileSync('/usr/bin/ffprobe', ['-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt', '-of', 'json', p]).toString()), v = j.streams.find((s) => s.codec_type === 'video');
    assert.ok(+j.format.size <= max, `${f} is ${(j.format.size / 1e6).toFixed(2)} MB, over ${max / 1e6} MB`);
    assert.deepEqual([v.codec_name, v.pix_fmt, v.r_frame_rate, v.width, v.height], ['h264', 'yuv420p', '30/1', w, h], f);
    assert.equal(j.streams.filter((s) => s.codec_type === 'audio').length, 0, f + ' has a sound track');
    /* the index (moov) comes before the pictures (mdat), so the film can start before the whole file has arrived */
    const buf = readFileSync(p), order = []; for (let at = 0; at + 8 <= buf.length && order.length < 6;) { const size = buf.readUInt32BE(at), type = buf.toString('latin1', at + 4, at + 8); order.push(type); if (type === 'mdat' || size < 8) break; at += size; }
    assert.ok(order.includes('moov') && order.includes('mdat') && order.indexOf('moov') < order.indexOf('mdat'), f + ' does not have its index first: ' + order.join(' '));
    if (f.startsWith('film')) assert.ok(Math.abs(+j.format.duration - 41) < 0.2, f + ' is ' + j.format.duration + ' s, not 41');
    found[f] = { MB: +(j.format.size / 1e6).toFixed(2), seconds: +(+j.format.duration).toFixed(2), size: v.width + '×' + v.height };
  }
  if (existsSync(join(dir, 'hero.mp4'))) {      // the still the page paints first is the video's own first frame, so nothing jumps when the video takes over
    const raw = execFileSync('/usr/bin/ffmpeg', ['-v', 'error', '-i', join(dir, 'hero.mp4'), '-frames:v', '1', '-vf', 'scale=96:208', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 24 });
    for (const f of ['hero-poster.jpg', 'hero-poster-480.jpg']) {
      const post = await sharp(join(dir, f)).resize(96, 208, { fit: 'fill' }).removeAlpha().raw().toBuffer(); let d = 0; for (let i = 0; i < raw.length; i++) d += Math.abs(raw[i] - post[i]);
      assert.ok(d / raw.length < 6, f + ' is not the first frame of hero.mp4 (mean difference ' + (d / raw.length).toFixed(1) + ' of 255)');
    }
  }
  if (!only) metrics.after.media = found;
});

const openForm = async (page) => { await page.evaluate(() => { document.getElementById('talk-more').open = true; }); };
const fill = async (page, { place = 'בדיקה', contact = '0541234567', msg = 'שאלה על הפיילוט' } = {}) => { await openForm(page); await page.fill('#f-place', place); await page.fill('#f-contact', contact); await page.fill('#f-msg', msg); };
await check('talk: WhatsApp first; the form is one tap away on a phone and open on a wide screen', async () => {
  let o = await open('/mana/?demo=off');
  assert.equal(await o.page.evaluate(() => document.getElementById('talk-more').open), false); assert.equal(await o.page.isVisible('#f-place'), false);
  const order = await o.page.evaluate(() => document.querySelector('.talk-wa a').getBoundingClientRect().top < document.querySelector('#talk-more').getBoundingClientRect().top); assert.equal(order, true);
  await o.page.click('#talk-more > summary'); assert.equal(await o.page.isVisible('#f-place'), true); await o.ctx.close();
  o = await open('/mana/?demo=off', { w: 1440, h: 900, touch: false }); assert.equal(await o.page.isVisible('#f-place'), true); await o.ctx.close();
});
await check('form: empty → the two required fields are marked, nothing is sent', async () => {
  const o = await open('/mana/?demo=off'); const n = srv.server.leads.length; await openForm(o.page);
  await o.page.click('#f-send');
  assert.equal(await o.page.locator('.field[data-bad]').count(), 2); assert.equal(srv.server.leads.length, n);
  assert.equal(await o.page.evaluate(() => document.activeElement.id), 'f-place');
  await o.ctx.close();
});
await check('form: sending state, then success with the reference; body matches submit_lead', async () => {
  const o = await open('/mana/?demo=off&lang=he'); await o.page.waitForTimeout(1600); await fill(o.page); await o.page.check('#f-news');
  await o.page.click('#f-send');
  assert.equal(await o.page.isDisabled('#f-send'), true); assert.equal((await o.page.textContent('#f-send .busy')).trim(), 'שולחים…');
  await o.page.waitForSelector('#talk-ok:not([hidden])');
  const ref = await o.page.textContent('#talk-ref'); assert.match(ref, /^HL-\d+$/);
  const b = srv.server.leads.at(-1);
  assert.match(b.p_token, /^[0-9a-f-]{36}$/); assert.equal(b.p_package, 'menus'); assert.equal(b.p_source, 'menus-landing'); assert.equal(b.p_locale, 'he'); assert.equal(b.p_hp, '');
  assert.ok(b.p_elapsed_ms >= 1500); assert.match(b.p_dream, /^מסעדה: בדיקה\nשאלה על הפיילוט\n\[updates: yes\]$/); assert.equal(b.p_contact, '0541234567'); assert.equal(b.p_name, null); assert.match(b.p_page, /^\/mana\//);
  assert.deepEqual(Object.keys(b).filter((k) => k !== 'ref').sort(), ['p_contact', 'p_dream', 'p_elapsed_ms', 'p_hp', 'p_locale', 'p_name', 'p_package', 'p_page', 'p_source', 'p_token']);
  await o.page.locator('#talk-sec').screenshot({ path: join(RAW, 'form-ok-390-he.png') });
  await o.ctx.close();
});
await check('form: server failure keeps the text, offers WhatsApp with the message; retry reuses the same token', async () => {
  const o = await open('/mana/?demo=off&lang=en'); await o.page.waitForTimeout(1600); await fill(o.page, { place: 'Test bistro', contact: 'fail@x.io', msg: 'Two branches' });
  const tokens = []; o.page.on('request', (r) => { if (r.url().includes('submit_lead') && r.method() === 'POST') tokens.push(JSON.parse(r.postData()).p_token); });
  await o.page.click('#f-send'); await o.page.waitForSelector('#talk-bad:not([hidden])');
  assert.equal(await o.page.inputValue('#f-msg'), 'Two branches'); assert.equal(await o.page.isDisabled('#f-send'), false);
  const wa = await o.page.getAttribute('#talk-wa', 'href'); assert.match(wa, /^https:\/\/wa\.me\/972542022269\?text=/); assert.match(decodeURIComponent(wa), /Test bistro[\s\S]*Two branches/);
  await o.page.locator('#talk-sec').screenshot({ path: join(RAW, 'form-fail-390-en.png') });
  await o.page.click('#f-send'); await o.page.waitForTimeout(900); await o.page.fill('#f-contact', 'ok@x.io'); await o.page.click('#f-send'); await o.page.waitForSelector('#talk-ok:not([hidden])');
  assert.equal(tokens.length, 3); assert.equal(new Set(tokens).size, 1, 'token changed between retries');
  await o.ctx.close();
});
await check('form: rate limit gets its own words; no config.js → failure state with WhatsApp, not a silent dead button', async () => {
  let o = await open('/mana/?demo=off&lang=en'); await o.page.waitForTimeout(1600); await fill(o.page, { contact: 'limit@x.io' });
  await o.page.click('#f-send'); await o.page.waitForSelector('#talk-bad:not([hidden])'); assert.match(await o.page.textContent('#talk-bad-text'), /Too many/); await o.ctx.close();
  o = await open('/mana/?demo=off&lang=he'); await o.page.evaluate(() => { delete window.HALOM_MENUS_CONFIG; }); await fill(o.page);
  await o.page.click('#f-send'); await o.page.waitForSelector('#talk-bad:not([hidden])'); await o.ctx.close();
});
await check('keyboard: skip link first, visible focus, a question opens with Enter', async () => {
  const o = await open('/mana/?demo=off', { w: 1440, h: 900, touch: false });
  await o.page.keyboard.press('Tab'); assert.equal(await o.page.evaluate(() => document.activeElement.className), 'skip');
  await o.page.focus('.faq summary'); await o.page.keyboard.press('Enter'); assert.equal(await o.page.evaluate(() => document.querySelector('.faq details').open), true);
  const out = await o.page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle); assert.notEqual(out, 'none');
  assert.equal(await o.page.locator('.faq details').count(), 5);
  await o.ctx.close();
});
await check('first paint: no viewer, no video, no 3D module; the page\'s first script stays under 40 kB (minified) and the scripts before the hero under 60 kB gzipped', async () => {
  const before = srv.server.requests.length; const o = await open('/mana/');
  const reqs = srv.server.requests.slice(before).map((r) => r.path), video = /\.(mp4|webm)(\?|$)/;
  assert.ok(!reqs.some((p) => p.includes('/view/')), 'the viewer was requested on load'); assert.ok(!reqs.some((p) => video.test(p)), 'a video was requested on load');
  assert.ok(!reqs.some((p) => /\.glb$|floor3d/.test(p)), 'a 3D file was requested on load (hero=off)');
  assert.ok(!/<source|<video[^>]* src=|<video[^>]* autoplay|<iframe/.test(readFileSync(join(ROOT, 'site', 'index.html'), 'utf8')), 'the HTML itself starts a video or the viewer');
  metrics.after.requestsOnLoad390 = reqs.length;
  const raw = readFileSync(join(ROOT, 'site', 'land', 'main.js')).length; assert.ok(raw <= 40 * 1024, 'land/main.js is ' + raw + ' bytes');
  const gz = (f) => gzipSync(readFileSync(join(ROOT, 'site', f))).length, scripts = gz('land/main.js') + gzipSync(readFileSync(join(ROOT, '..', 'config.js'))).length, css = gz('land.css');
  assert.ok(scripts <= 60 * 1024, 'scripts before the hero: ' + scripts + ' bytes gzipped'); metrics.after.bytesGzipBeforeHero = { mainRaw: raw, scripts, css, html: gzipSync(readFileSync(join(ROOT, 'site', 'index.html'))).length };
  console.log('      first paint: ' + reqs.length + ' requests; main.js ' + raw + ' B; gzipped: scripts ' + scripts + ' B, css ' + css + ' B, html ' + metrics.after.bytesGzipBeforeHero.html + ' B');
  await o.ctx.close();
});

await check('privacy and terms: stable addresses, the required statements, a data-deletion anchor, the not-reviewed note in the source', async () => {
  for (const prefix of ['/mana/', '/projects/menus/']) for (const lang of ['he', 'en']) {
    let o = await open(prefix + 'privacy/?lang=' + lang + '#data-deletion'); let text = await o.page.evaluate(() => document.body.innerText);
    for (const re of [/Supabase/, lang === 'he' ? /פרנקפורט/ : /Frankfurt/, /Anthropic/, /GitHub Pages/, /Vercel/, lang === 'he' ? /אין עוגיות/ : /No cookies/, lang === 'he' ? /14 יום/ : /14 days/, lang === 'he' ? /גיבוב/ : /hash/, /Google, Apple .{1,4} Facebook/]) assert.match(text, re, 'privacy ' + lang);
    await o.page.waitForFunction(() => document.getElementById('data-deletion').getBoundingClientRect().top < 400, null, { timeout: 5000 }).catch(() => {});      // the page scrolls there smoothly
    const d = await o.page.evaluate(() => { const s = document.getElementById('data-deletion'); return { ok: !!s, alias: !!document.getElementById('delete'), wa: [...s.querySelectorAll('a[href]')].filter((a) => a.checkVisibility()).map((a) => a.href), top: Math.round(s.getBoundingClientRect().top) }; });
    assert.equal(d.ok, true); assert.equal(d.alias, true); assert.deepEqual(d.wa, ['https://wa.me/972542022269']); assert.ok(d.top < 400, 'the anchor did not scroll into view: ' + d.top);
    assert.match(await (await o.page.request.get(srv.origin + prefix + 'privacy/')).text(), /^<!doctype html>\n<!-- [^>]*NOT reviewed by a lawyer/);
    await o.ctx.close();
    o = await open(prefix + 'terms/?lang=' + lang); text = await o.page.evaluate(() => document.body.innerText);
    for (const re of lang === 'he' ? [/30 יום/, /אלרגנים/, /להמחשה בלבד/, /פיילוט/, /לא חוקי/, /ייקבע/, /זכות להשתמש/] : [/30 days/, /allergen/, /Illustration/, /pilot/, /unlawful/, /To be confirmed/, /right to use/]) assert.match(text, re, 'terms ' + lang);
    assert.match(await (await o.page.request.get(srv.origin + prefix + 'terms/')).text(), /^<!doctype html>\n<!-- [^>]*NOT reviewed by a lawyer/);
    assert.equal(await o.page.evaluate(() => document.querySelector('.legal a[href*="privacy/#data-deletion"]') !== null), true);
    await o.ctx.close();
  }
});

await browser.close(); srv.server.close();
if (!only) writeFileSync(join(REVIEW, 'metrics.json'), JSON.stringify(metrics, null, 1));
console.log(`\n${passed} passed, ${fails.length} failed`); if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
