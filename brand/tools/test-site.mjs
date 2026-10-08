/* Browser checks for the product page (version 2), the photo guide and the privacy and terms pages, against tools/serve.mjs
   (both path prefixes, a real viewer, a stubbed leads function).
   Which viewer the demo checks load: MANA_VIEW=<folder>, default ../view (see tools/serve.mjs).
   Numbers land in review/v2/metrics.json, full-page screenshots in .shots-raw/.      Run: node tools/test-site.mjs [filter] */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
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
const only = process.argv[2] || '';
const BEFORE = { height390: 7876, words390: 556 };                    // the page as it was on 6 Oct (briefs/current-screens/land-m-sheet.jpg)
const srv = await listen(0, { delay: 400 });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const VPS = [[390, 844, true], [360, 640, true], [1440, 900, false]];
let passed = 0; const fails = [], metrics = { before: BEFORE, after: {} };
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
        await o.page.evaluate(async () => { for (const el of document.querySelectorAll('.reveal')) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); const t0 = performance.now(); while (document.documentElement.classList.contains('anim') && !el.classList.contains('in') && performance.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 50)); el.classList.add('in'); } window.scrollTo({ top: 0, behavior: 'instant' }); });
        await o.page.waitForTimeout(2500);      // the reveals have finished
        await o.page.screenshot({ path: join(RAW, `page-${pg ? pg.replace('/', '-') : ''}${w}-${lang}.png`), fullPage: true }); if (!pg) await o.page.screenshot({ path: join(RAW, `fold-${w}-${lang}.png`) });
      }
      await o.ctx.close();
    });
  }
}

await check('phone: under 200 visible words and about a third of the old height, in both languages', async () => {
  for (const lang of ['he', 'en']) for (const scan of [false, true]) {
    const s2 = scan ? await listen(0, { scan: true }) : srv;
    const o = await open('/mana/?lang=' + lang + '&demo=off&motion=off', { origin: s2.origin });
    const r = await o.page.evaluate((f) => ({ words: (0, eval)('(' + f + ')')(), height: document.documentElement.scrollHeight, sections: [...document.querySelectorAll('header.top,main>section,footer')].map((s) => [s.id || s.className.split(' ')[0], Math.round(s.getBoundingClientRect().height)]) }), visibleWords.toString());
    metrics.after[`390-${lang}${scan ? '-scan' : ''}`] = { words: r.words.length, height: r.height, sections: r.sections };
    assert.ok(r.words.length < 200, `${lang}${scan ? ' (scanner on)' : ''}: ${r.words.length} words`);
    assert.ok(r.height <= Math.round(BEFORE.height390 * 0.36), `${lang}: ${r.height} px is more than 36% of ${BEFORE.height390}`);
    await o.ctx.close(); if (scan) s2.server.close();
  }
});

await check('words: nothing sold as "AI", the relief is never a "3D model", no invented e-mail address', async () => {
  for (const pg of PAGES) for (const lang of ['he', 'en']) {
    const o = await open('/mana/' + pg + '?lang=' + lang + '&demo=off&motion=off');
    await o.page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const text = await o.page.evaluate(() => document.body.innerText);
    if (!pg) assert.ok(!/\bAI\b|בינה מלאכותית/.test(text), 'the product page says AI (' + lang + ')');
    assert.ok(!/3D model|מודל תלת|digital twin|תאום דיגיטלי/i.test(text), 'calls the relief a 3D model: ' + pg + ' ' + lang);
    assert.ok(!/[\w.+-]+@[\w-]+\.[\w.]+/.test(text), 'an e-mail address appears on ' + pg);
    await o.ctx.close();
  }
});

await check('links: Start free and Sign in → studio, Try the demo → viewer in the same tab, footer → guide, privacy, terms (both prefixes)', async () => {
  for (const prefix of ['/mana/', '/projects/menus/']) {
    const o = await open(prefix + '?demo=off');
    const r = await o.page.evaluate(() => ({ cta: [...document.querySelectorAll('.hero .cta a')].map((a) => [a.href, a.target]), signin: document.querySelector('.top-tools a').href,
      foot: [...document.querySelectorAll('.foot-links a')].map((a) => a.href), credit: document.querySelector('.foot-fine a').href, line: document.querySelector('.foot-fine bdi').textContent, wa: document.querySelector('.talk-wa a').href }));
    assert.ok(r.cta[0][0].endsWith(prefix + 'studio/'), r.cta[0][0]); assert.ok(r.signin.endsWith(prefix + 'studio/'));
    assert.ok(r.cta[1][0].includes(prefix + 'view/?demo=olea'), r.cta[1][0]); assert.equal(r.cta[1][1], '', 'the demo link opens a new tab, so Back cannot return');
    assert.deepEqual(r.foot.map((u) => u.slice(u.indexOf(prefix) + prefix.length)), ['guide/', 'privacy/', 'terms/']);
    assert.equal(r.credit, 'https://halom.io/'); assert.equal(r.line, 'Dreams, realized · חלומות מתגשמים'); assert.equal(r.wa, 'https://wa.me/972542022269');
    for (const u of [r.cta[0][0], r.cta[1][0], ...r.foot]) { const x = await o.page.request.get(u); assert.equal(x.status(), 200, u); }
    await o.ctx.close();
    for (const pg of ['guide/', 'privacy/', 'terms/']) {              // and back: every inner page leads home
      const i = await open(prefix + pg); const home = await i.page.evaluate(() => [document.querySelector('.back a').href, document.querySelector('.brand').href]);
      assert.ok(home.every((u) => u.endsWith(prefix)), pg + ' → ' + home); await i.ctx.close();
    }
  }
});

await check('language toggle switches text, direction, title, links and remembers', async () => {
  const o = await open('/mana/?demo=off');
  await o.page.click('[data-lang-toggle]');
  const r = await o.page.evaluate(() => ({ l: document.documentElement.lang, d: document.documentElement.dir, t: document.title, h: document.querySelector('.hero .cta a:nth-child(2)').getAttribute('href'), alt: document.querySelector('#hero-phone img').alt }));
  assert.equal(r.l, 'en'); assert.equal(r.d, 'ltr'); assert.match(r.t, /^Mana/); assert.match(r.h, /lang=en/); assert.match(r.alt, /shakshuka/);
  await o.page.reload(); assert.equal(await o.page.evaluate(() => document.documentElement.lang), 'en');
  await o.ctx.close();
});

await check('flow: three steps in reading order; the scanner is named only when config.features.scan is true', async () => {
  for (const [scan, lang] of [[false, 'he'], [false, 'en'], [true, 'he'], [true, 'en']]) {
    const s2 = await listen(0, { scan });
    const o = await open('/mana/?demo=off&motion=off&lang=' + lang, { origin: s2.origin });
    const r = await o.page.evaluate(() => ({ steps: [...document.querySelectorAll('.flow-step')].map((s) => ({ x: Math.round(s.getBoundingClientRect().left), text: s.querySelector('p').innerText.trim(), drawn: s.querySelectorAll('.flow-disc svg').length && [...s.querySelectorAll('.flow-disc svg')].filter((v) => v.checkVisibility()).length })),
      all: document.body.innerText, flag: document.documentElement.getAttribute('data-scan') }));
    assert.equal(r.steps.length, 3); assert.ok(r.steps.every((s) => s.drawn === 1), 'each step shows exactly one drawing');
    const xs = r.steps.map((s) => s.x); assert.ok(lang === 'he' ? xs[0] > xs[1] && xs[1] > xs[2] : xs[0] < xs[1] && xs[1] < xs[2], lang + ' order: ' + xs);
    const words = r.steps.map((s) => s.text.split(/\s+/).length); assert.ok(words.every((n) => n >= 2 && n <= 5), 'step labels are 2 to 5 words: ' + words);
    const scanWord = /סורקים|scan your/i.test(r.all);
    assert.equal(r.flag, scan ? '1' : null); assert.equal(scanWord, scan, 'scanner named: ' + scanWord + ' with features.scan ' + scan);
    assert.match(r.steps[0].text, scan ? /סורקים את התפריט המודפס|Scan your printed menu/ : /מדביקים או מקלידים תפריט|Paste or type your menu/);
    await o.ctx.close(); s2.server.close();
  }
});

/* how many pixels of a region are the line's colour (rose #9A5238): the drawn line must really be there, in every gap */
const roseIn = async (page, clip) => { const { data, info } = await sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer({ resolveWithObject: true }); let n = 0;
  for (let i = 0; i < data.length; i += info.channels) if (Math.abs(data[i] - 154) < 40 && Math.abs(data[i + 1] - 82) < 40 && Math.abs(data[i + 2] - 56) < 40) n++; return n; };
await check('flow and numbers: the line draws itself once in view and ends complete; with reduced motion everything is simply there', async () => {
  for (const [w, h, touch, lang] of [[390, 500, true, 'he'], [390, 500, true, 'en'], [1440, 500, false, 'he'], [1440, 500, false, 'en']]) {
    const o = await open('/mana/?demo=off&lang=' + lang, { w, h, touch });
    let r = await o.page.evaluate(() => ({ anim: document.documentElement.classList.contains('anim'), flowIn: document.querySelector('.flow').classList.contains('in'), dashIn: document.querySelector('.dash').classList.contains('in'),
      clip: getComputedStyle(document.querySelector('.flow-line')).clipPath }));
    assert.equal(r.anim, true); assert.equal(r.dashIn, false, 'the numbers revealed before they were on screen'); if (!r.flowIn) assert.match(r.clip, /100%/, 'the line is drawn before the flow is on screen');
    await o.page.locator('.flow-rail').scrollIntoViewIfNeeded(); await o.page.waitForFunction(() => document.querySelector('.flow').classList.contains('in')); await o.page.waitForTimeout(2400);
    r = await o.page.evaluate(() => { const d = [...document.querySelectorAll('.flow-disc')].map((e) => e.getBoundingClientRect()).sort((a, b) => a.left - b.left); const y = Math.round(d[0].top + d[0].height / 2) - 14;
      return { clip: getComputedStyle(document.querySelector('.flow-line')).clipPath, op: [...document.querySelectorAll('.flow-step')].map((s) => getComputedStyle(s).opacity),
        gaps: [0, 1].map((i) => ({ x: Math.round(d[i].right) + 1, y, width: Math.round(d[i + 1].left - d[i].right) - 2, height: 28 })) }; });
    assert.ok(!/100%/.test(r.clip), 'the line stayed hidden: ' + r.clip); assert.deepEqual(r.op, ['1', '1', '1']);
    for (const g of r.gaps) { const n = await roseIn(o.page, g); assert.ok(n >= Math.max(12, g.width * 0.8), `${w} ${lang}: the line is missing between two steps (${n} px of line in a gap ${g.width} px wide)`); }
    await o.page.locator('.dash').scrollIntoViewIfNeeded(); await o.page.waitForFunction(() => document.querySelector('.dash').classList.contains('in')); await o.page.waitForTimeout(2000);
    const sp = await o.page.evaluate(() => { const b = document.querySelector('.spark').getBoundingClientRect(); return [0, 1, 2, 3].map((i) => ({ x: Math.round(b.left + b.width * i / 4), y: Math.round(b.top) - 2, width: Math.round(b.width / 4), height: Math.round(b.height) + 4 })); });
    for (const q of sp) { const n = await roseIn(o.page, q); assert.ok(n >= q.width * 0.8, `${w} ${lang}: the sparkline has a hole (${n} px of line in a quarter ${q.width} px wide)`); }
    const bars = await o.page.evaluate(() => [...document.querySelectorAll('.bars i,.hours i')].every((i) => getComputedStyle(i).transform === 'none' || getComputedStyle(i).transform === 'matrix(1, 0, 0, 1, 0, 0)')); assert.equal(bars, true, 'a bar did not finish growing');
    await o.ctx.close();
  }
  const o = await open('/mana/?demo=off', { reduced: true, h: 500 });
  const r = await o.page.evaluate(() => ({ anim: document.documentElement.classList.contains('anim'), clip: getComputedStyle(document.querySelector('.flow-line')).clipPath, op: getComputedStyle(document.querySelector('.flow-step')).opacity,
    bars: getComputedStyle(document.querySelector('.bars i')).transform, running: document.getAnimations().length }));
  assert.equal(r.anim, false); assert.equal(r.clip, 'none'); assert.equal(r.op, '1'); assert.equal(r.bars, 'none'); assert.equal(r.running, 0, 'something still moves with reduced motion');
  await o.ctx.close();
});

await check('numbers: the sample dashboard shows the owner app’s six numbers, adds up, and says it is an example', async () => {
  for (const lang of ['he', 'en']) {
    const o = await open('/mana/?demo=off&motion=off&lang=' + lang);
    const r = await o.page.evaluate(() => ({ label: document.querySelector('.dash-sample').innerText.trim(), tiles: [...document.querySelectorAll('.dash .tile h3')].map((h) => h.innerText.trim()), big: document.querySelector('.dash-big').innerText.replace(/\s+/g, ' ').trim(),
      dishes: document.querySelectorAll('.bars li').length, hours: document.querySelectorAll('.hours i').length, lines: [...document.querySelectorAll('.learn li')].map((l) => l.innerText.trim()), widths: [...document.querySelectorAll('.bars i')].map((i) => Math.round(i.getBoundingClientRect().width)) }));
    assert.match(r.label, lang === 'he' ? /דוגמה/ : /Example/); assert.equal(r.tiles.length, 6); assert.match(r.big, /^212 ?\+18%$/); assert.equal(r.dishes, 5); assert.equal(r.hours, 24);
    assert.equal(r.lines.length, 4); assert.ok(r.lines.every((l) => l.split(/\s+/).length < 8), 'a selling line has eight words or more: ' + JSON.stringify(r.lines));
    assert.ok(r.widths.every((x, i) => i === 0 || x <= r.widths[i - 1]) && r.widths[0] > 30, 'bars are not in falling order: ' + r.widths);
    await o.ctx.close();
  }
});

const builtWith = (m) => renderIndex(Object.assign(mediaFound(), m));
const mediaFiles = (names) => Object.fromEntries(names.map((n) => ['img/' + n, join(SCRATCH, n)]));
await check('hero without a video file: the still, no <video> in the phone, nothing requested', async () => {
  const s2 = await listen(0, { pages: { 'index.html': builtWith({ heroMp4: false, heroWebm: false, heroEnMp4: false, heroEnWebm: false }) } });
  const o = await open('/mana/?demo=off', { origin: s2.origin }); await o.page.waitForTimeout(700);
  const r = await o.page.evaluate(() => ({ video: document.querySelectorAll('#hero-phone video').length, state: document.getElementById('hero-phone').getAttribute('data-video'), poster: (() => { const i = document.querySelector('#hero-phone img'); return i.complete && i.naturalWidth > 0 && i.checkVisibility(); })() }));
  assert.equal(r.video, 0); assert.equal(r.state, 'none'); assert.equal(r.poster, true);
  assert.ok(!o.reqs.some((u) => /\.(mp4|webm)/.test(u)), 'a video was requested'); assert.deepEqual(o.errors, []);
  await o.ctx.close(); s2.server.close();
});
await check('hero with a video file: the still paints first, the video is fetched after load and plays muted in a loop', async () => {
  const s2 = await listen(0, { pages: { 'index.html': builtWith({ heroMp4: true, heroWebm: true, heroEnMp4: false, heroEnWebm: false }) }, media: mediaFiles(['hero.webm', 'hero.mp4']) });
  /* what the video element was doing at the moment the page finished loading: recorded by a listener added before the page's own */
  const o = await open('/mana/?demo=off', { origin: s2.origin, init: () => { window.addEventListener('load', () => { const v = document.querySelector('#hero-phone video'); window.__atLoad = { net: v.networkState, sources: v.querySelectorAll('source').length, src: v.currentSrc, poster: document.querySelector('#hero-phone img').complete }; }); } });
  const html = await (await o.page.request.get(s2.origin + '/mana/')).text();
  assert.ok(!/<source|<video[^>]* src=|<video[^>]* autoplay/.test(html), 'the HTML itself starts the video download'); assert.match(html, /<video class="hero-video" muted loop playsinline preload="metadata" tabindex="-1"/); assert.ok(!/<video[^>]* poster=/.test(html), 'the video has a poster of its own: the still would be fetched twice');
  assert.deepEqual(await o.page.evaluate(() => window.__atLoad), { net: 0, sources: 0, src: '', poster: true }, 'the video was already loading when the page finished loading');
  await o.page.waitForFunction(() => document.getElementById('hero-phone').getAttribute('data-video') === 'on', null, { timeout: 15000 });
  const r = await o.page.evaluate(() => { const v = document.querySelector('#hero-phone video'); return { muted: v.muted, loop: v.loop, inline: v.playsInline, auto: v.autoplay, paused: v.paused, t: v.currentTime, src: v.currentSrc, w: v.videoWidth, btn: document.querySelector('[data-hero-play]').hidden, order: [...v.querySelectorAll('source')].map((x) => x.type) }; });
  assert.equal(r.muted, true); assert.equal(r.loop, true); assert.equal(r.inline, true); assert.equal(r.auto, true); assert.equal(r.paused, false); assert.deepEqual(r.order, ['video/webm', 'video/mp4']); assert.match(r.src, /img\/hero\.webm$/); assert.equal(r.w, 390); assert.equal(r.btn, true);
  await o.page.waitForTimeout(700); assert.ok(await o.page.evaluate(() => document.querySelector('#hero-phone video').currentTime) > 0.2, 'the video does not advance');
  await o.page.locator('#hero-phone').screenshot({ path: join(RAW, 'hero-video-390.png') });
  await o.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await o.page.waitForFunction(() => document.querySelector('#hero-phone video').paused, null, { timeout: 4000 });      // off screen: it rests
  await o.page.evaluate(() => window.scrollTo(0, 0)); await o.page.waitForFunction(() => !document.querySelector('#hero-phone video').paused, null, { timeout: 4000 });      // back in view: it goes on
  assert.equal(await o.page.isVisible('[data-hero-play]'), false); assert.deepEqual(o.errors, []);
  await o.ctx.close();
  /* a visitor who scrolls away before the video has started must not come back to a play button */
  const q = await open('/mana/?demo=off', { origin: s2.origin, wait: 'domcontentloaded' });
  await q.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await q.page.waitForLoadState('load'); await q.page.waitForTimeout(1500);
  assert.equal(await q.page.evaluate(() => document.querySelector('#hero-phone video').paused), true, 'it plays off screen');
  await q.page.evaluate(() => window.scrollTo(0, 0)); await q.page.waitForFunction(() => document.getElementById('hero-phone').getAttribute('data-video') === 'on' && !document.querySelector('#hero-phone video').paused, null, { timeout: 15000 });
  assert.equal(await q.page.isVisible('[data-hero-play]'), false, 'the play button shows although autoplay was never refused');
  await q.ctx.close(); s2.server.close();
});
await check('hero on Save-Data or reduced motion: no video bytes, the still with a play button; a tap plays it', async () => {
  const s2 = await listen(0, { pages: { 'index.html': builtWith({ heroMp4: true, heroWebm: true, heroEnMp4: false, heroEnWebm: false }) }, media: mediaFiles(['hero.webm', 'hero.mp4']) });
  for (const mode of ['save', 'reduced']) {
    const o = await open('/mana/?demo=off' + (mode === 'save' ? '&save=1' : ''), { origin: s2.origin, reduced: mode === 'reduced' }); await o.page.waitForTimeout(900);
    assert.ok(!o.reqs.some((u) => /\.(mp4|webm)/.test(u)), mode + ': a video was requested'); assert.equal(await o.page.isVisible('[data-hero-play]'), true);
    await o.page.locator('#hero-phone').screenshot({ path: join(RAW, 'hero-play-button-' + mode + '.png') });
    await o.page.click('[data-hero-play]'); await o.page.waitForFunction(() => document.getElementById('hero-phone').getAttribute('data-video') === 'on', null, { timeout: 15000 });
    assert.equal(await o.page.isVisible('[data-hero-play]'), false); await o.ctx.close();
  }
  s2.server.close();
});
await check('hero per language: the English page plays hero-en when that file exists, the Hebrew page the plain one, and neither asks for the other', async () => {
  const clip = join(SCRATCH, 'hero.webm');
  const s2 = await listen(0, { pages: { 'index.html': builtWith({ heroMp4: false, heroWebm: true, heroEnMp4: false, heroEnWebm: true }) }, media: { 'img/hero.webm': clip, 'img/hero-en.webm': clip } });
  for (const [lang, want, other] of [['he', /img\/hero\.webm$/, /hero-en\./], ['en', /img\/hero-en\.webm$/, /hero\.webm/]]) {
    const o = await open('/mana/?demo=off&lang=' + lang, { origin: s2.origin });
    await o.page.waitForFunction(() => document.getElementById('hero-phone').getAttribute('data-video') === 'on', null, { timeout: 15000 });
    assert.match(await o.page.evaluate(() => document.querySelector('#hero-phone video').currentSrc), want, lang);
    assert.ok(!o.reqs.some((u) => other.test(u)), lang + ': the other language\'s video was requested'); assert.deepEqual(o.errors, []);
    await o.ctx.close();
  }
  s2.server.close();
});

await check('demo on a phone: nothing from the viewer until asked; "Play with it" opens it full screen in the same tab, Back returns', async () => {
  const o = await open('/mana/');
  await o.page.locator('#phone').scrollIntoViewIfNeeded(); await o.page.waitForTimeout(600);
  assert.equal(await o.page.getAttribute('#phone', 'data-state'), 'still'); assert.ok(!o.reqs.some((u) => u.includes('/view/')), 'the viewer was fetched before anyone asked');
  assert.equal(await o.page.locator('#phone iframe').count(), 0);
  await Promise.all([o.page.waitForURL(/\/mana\/view\/\?demo=olea&lang=he/), o.page.click('[data-demo-start]')]);
  assert.equal(o.ctx.pages().length, 1, 'a second tab opened');
  await o.page.goBack(); await o.page.waitForURL(/\/mana\/$/); assert.equal(await o.page.locator('h1').count(), 1);
  await o.ctx.close();
});
await check('demo on a wide screen: starts by itself in view, the real viewer fits the frame; its "← Mana" link puts the still back instead of nesting the page', async () => {
  const o = await open('/mana/?vtest=1&lang=en', { w: 1440, h: 900, touch: false });
  assert.ok(!o.reqs.some((u) => u.includes('/view/')), 'the viewer was fetched before the frame came into view');
  await o.page.locator('#phone').scrollIntoViewIfNeeded();
  await o.page.waitForFunction(() => document.querySelector('#phone').getAttribute('data-state') === 'live', null, { timeout: 30000 });
  const fr = o.page.frames().find((f) => f.url().includes('/view/')); assert.ok(fr, 'no viewer frame'); assert.match(fr.url(), /view\/\?demo=olea&lang=en/);
  await fr.waitForFunction(() => document.body && document.body.innerText.trim().length > 0, null, { timeout: 30000 });
  const g = await o.page.evaluate(() => { const f = document.querySelector('#phone iframe').getBoundingClientRect(), s = document.querySelector('#phone .phone-screen').getBoundingClientRect(); return [Math.round(f.width), Math.round(s.width), Math.round(f.height), Math.round(s.height)]; });
  assert.ok(Math.abs(g[0] - g[1]) <= 2 && Math.abs(g[2] - g[3]) <= 3, 'frame does not fit the screen: ' + g);
  if (await fr.evaluate(() => !!(window.__menu && window.__menu.tick)).catch(() => false)) { await fr.evaluate(() => window.__menu.ready); await fr.evaluate(() => window.__menu.tableReady).catch(() => {}); await fr.waitForFunction(() => window.__menu.pending() === 0, null, { timeout: 90000 }).catch(() => {}); await fr.evaluate(() => window.__menu.tick(70, 1 / 30)).catch(() => {}); }
  else await o.page.waitForTimeout(4000);
  await o.page.locator('#demo').screenshot({ path: join(RAW, 'demo-live-1440-en.png') });
  await o.page.evaluate(() => window.scrollTo(0, 600)); await fr.goto(srv.origin + '/mana/').catch(() => {});      // what the demo's "← Mana" link does inside the frame
  await o.page.waitForFunction(() => document.querySelector('#phone').getAttribute('data-state') === 'still' && !document.querySelector('#phone iframe'), null, { timeout: 8000 });
  await o.page.waitForFunction(() => window.scrollY === 0, null, { timeout: 4000 });
  assert.deepEqual(o.errors.filter((e) => !/requestfailed|ERR_ABORTED/.test(e)), []);
  await o.ctx.close();
});

await check('film: no file → no button and no request; with the files → a lightbox with the wide cut, the tall cut on a phone, closing stops it', async () => {
  let o = await open('/mana/?demo=off'); assert.equal(await o.page.locator('[data-film]').count() + await o.page.locator('#film').count(), mediaFound().film169 || mediaFound().film916 ? 2 : 0); await o.ctx.close();
  const s2 = await listen(0, { pages: { 'index.html': builtWith({ film169: true, film916: true, film169en: false, film916en: false }) }, media: mediaFiles(['film-16x9.mp4', 'film-9x16.mp4']) });
  for (const [w, h, touch, want] of [[1440, 900, false, 'film-16x9.mp4'], [390, 844, true, 'film-9x16.mp4']]) {
    o = await open('/mana/?demo=off&lang=en', { origin: s2.origin, w, h, touch });
    assert.ok(!o.reqs.some((u) => /film-/.test(u)), 'the film was requested before anyone asked');
    assert.equal((await o.page.innerText('[data-film]')).trim(), 'Watch the film');
    await o.page.click('[data-film]'); await o.page.waitForFunction(() => document.getElementById('film').open);
    assert.ok((await o.page.evaluate(() => document.querySelector('#film video').getAttribute('src'))).endsWith(want), 'wrong cut at ' + w);
    await o.page.screenshot({ path: join(RAW, `film-open-${w}.png`) });
    await o.page.click('[data-film-close]'); const r = await o.page.evaluate(() => ({ open: document.getElementById('film').open, src: document.querySelector('#film video').getAttribute('src') }));
    assert.equal(r.open, false); assert.equal(r.src, null);
    await o.page.click('[data-film]'); await o.page.keyboard.press('Escape'); await o.page.waitForFunction(() => !document.getElementById('film').open && !document.querySelector('#film video').getAttribute('src'));
    await o.ctx.close();
  }
  s2.server.close();
});
await check('film per language: the English page opens the -en cuts when they exist, the Hebrew page the plain ones', async () => {
  const wide = join(SCRATCH, 'film-16x9.mp4'), tall = join(SCRATCH, 'film-9x16.mp4');
  const s2 = await listen(0, { pages: { 'index.html': builtWith({ film169: true, film916: true, film169en: true, film916en: true }) }, media: { 'img/film-16x9.mp4': wide, 'img/film-9x16.mp4': tall, 'img/film-16x9-en.mp4': wide, 'img/film-9x16-en.mp4': tall } });
  for (const [lang, w, h, touch, want] of [['he', 1440, 900, false, 'film-16x9.mp4'], ['he', 390, 844, true, 'film-9x16.mp4'], ['en', 1440, 900, false, 'film-16x9-en.mp4'], ['en', 390, 844, true, 'film-9x16-en.mp4']]) {
    const o = await open('/mana/?demo=off&lang=' + lang, { origin: s2.origin, w, h, touch });
    await o.page.click('[data-film]'); await o.page.waitForFunction(() => document.getElementById('film').open);
    assert.ok((await o.page.evaluate(() => document.querySelector('#film video').getAttribute('src'))).endsWith('/' + want), lang + ' at ' + w + ': wrong cut');
    await o.ctx.close();
  }
  s2.server.close();
});

await check('built page matches the media files in site/img (run tools/build-site.mjs after adding or removing a video)', async () => {
  const html = readFileSync(join(ROOT, 'site', 'index.html'), 'utf8'), m = mediaFound();
  assert.equal(/<video class="hero-video"/.test(html), m.heroMp4 || m.heroWebm, 'hero video'); assert.equal(/data-film /.test(html) || /data-film>/.test(html), m.film169 || m.film916, 'film button');
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
await check('first paint needs no viewer and no video: HTML, CSS, config, one script, fonts and two pictures before load; the video is asked for only after load, and with every video byte held back for ever the first screen is whole', async () => {
  /* 1. the page as it is built today: what it asks the server for until load */
  const before = srv.server.requests.length; let o = await open('/mana/?demo=off');
  const reqs = srv.server.requests.slice(before).map((r) => r.path), video = /\.(mp4|webm)(\?|$)/;
  assert.ok(!reqs.some((p) => p.includes('/view/')), 'the viewer was requested on load'); assert.ok(reqs.filter((p) => !video.test(p)).length <= 14, 'too many requests on load: ' + reqs.length + ' ' + reqs.join(' '));
  assert.ok(!/<source|<video[^>]* src=|<video[^>]* autoplay/.test(readFileSync(join(ROOT, 'site', 'index.html'), 'utf8')), 'the HTML itself starts a video download');
  metrics.after.requestsOnLoad390 = reqs.filter((p) => !video.test(p)).length;
  await o.ctx.close();
  /* 2. the same page with a hero video this browser can play (the real files are H.264, which the test browser lacks) on a network that never
        delivers one byte of video: the page must be whole without it. Times are the page's own clock, in milliseconds. */
  const s2 = await listen(0, { pages: { 'index.html': builtWith({ heroMp4: true, heroWebm: true, heroEnMp4: false, heroEnWebm: false }) }, media: mediaFiles(['hero.webm', 'hero.mp4']) });
  o = await open('/mana/?demo=off', { origin: s2.origin, hold: video, init: () => {
    window.__t = { asked: null, atLoad: null, lcp: null };
    new MutationObserver((list) => { if (window.__t.asked == null && list.some((m) => [...m.addedNodes].some((n) => n.nodeName === 'SOURCE'))) window.__t.asked = performance.now(); }).observe(document, { childList: true, subtree: true });
    try { new PerformanceObserver((l) => { const e = l.getEntries().pop(); window.__t.lcp = { at: e.startTime, what: e.element ? e.element.tagName.toLowerCase() + (e.element.className ? '.' + e.element.className : '') : '' }; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) { /* not in this browser */ }
    window.addEventListener('load', () => { const v = document.querySelector('#hero-phone video'), i = document.querySelector('#hero-phone img'); window.__t.atLoad = { at: performance.now(), net: v.networkState, sources: v.querySelectorAll('source').length, poster: i.complete && i.naturalWidth > 0 }; });
  } });
  await o.page.waitForFunction(() => window.__t.asked != null, null, { timeout: 10000 });                        // after load the page asks for the video ...
  for (const t0 = Date.now(); !o.held.length && Date.now() - t0 < 5000;) await o.page.waitForTimeout(50);
  assert.ok(o.held.length >= 1, 'the video was never asked for, so holding it back proved nothing');
  await o.page.waitForTimeout(1500);                                                                              // ... and it never comes
  const r = await o.page.evaluate(() => {
    const fcp = performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint'), i = document.querySelector('#hero-phone img');
    const inFirstScreen = (e) => { const b = e.getBoundingClientRect(); return e.checkVisibility() && b.width > 0 && b.top >= 0 && b.bottom <= innerHeight; };
    return { t: window.__t, fcp: fcp ? fcp.startTime : null, h1: inFirstScreen(document.querySelector('h1')), cta: [...document.querySelectorAll('.hero .cta a')].every(inFirstScreen), poster: i.complete && i.naturalWidth > 0 && i.checkVisibility() && i.getBoundingClientRect().top < innerHeight,
      state: document.getElementById('hero-phone').getAttribute('data-video'), videoOpacity: +getComputedStyle(document.querySelector('#hero-phone video')).opacity, playHidden: document.querySelector('[data-hero-play]').hidden, ready: document.readyState };
  });
  assert.deepEqual({ net: r.t.atLoad.net, sources: r.t.atLoad.sources, poster: r.t.atLoad.poster }, { net: 0, sources: 0, poster: true }, 'at load the video was already wanted, or the still was not there yet');
  assert.ok(r.t.asked >= r.t.atLoad.at, 'the video was asked for before load: ' + r.t.asked + ' / ' + r.t.atLoad.at);
  assert.ok(r.fcp != null && r.t.lcp, 'the browser reported no paint at all');      // when the paints came is printed and recorded, not asserted: on this machine load, first paint and the request fall within a few milliseconds of each other
  assert.equal(r.h1, true, 'headline'); assert.equal(r.cta, true, 'buttons'); assert.equal(r.poster, true, 'still'); assert.equal(r.ready, 'complete');
  assert.notEqual(r.state, 'on'); assert.equal(r.videoOpacity, 0); assert.equal(r.playHidden, true, 'a play button appeared although nothing failed');
  await o.page.screenshot({ path: join(RAW, 'first-screen-video-held-390.png') }); assert.deepEqual(o.errors, []);
  metrics.after.firstScreenWithVideoHeld390 = { firstPaintMs: Math.round(r.fcp), largestPaintMs: Math.round(r.t.lcp.at), largestPaint: r.t.lcp.what, loadMs: Math.round(r.t.atLoad.at), videoAskedMs: Math.round(r.t.asked), videoBytesDelivered: 0 };
  console.log('      first paint ' + Math.round(r.fcp) + ' ms, largest paint ' + Math.round(r.t.lcp.at) + ' ms (' + r.t.lcp.what + '), load ' + Math.round(r.t.atLoad.at) + ' ms, video asked for at ' + Math.round(r.t.asked) + ' ms and never delivered');
  await o.ctx.close(); s2.server.close();
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
