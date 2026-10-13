/* Browser checks for the product page (version 3: the table), the photo guide and the privacy and terms pages, against tools/serve.mjs
   (both path prefixes, a real viewer, a stubbed leads function).
   Which viewer the demo checks load: MANA_VIEW=<folder>, default ../view (see tools/serve.mjs).
   Numbers land in review/v2/metrics.json, full-page screenshots in .shots-raw/.      Run: node tools/test-site.mjs [filter] */
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
  if (!/[?&]hero=/.test(path)) { const i = path.indexOf('#'), u = i < 0 ? path : path.slice(0, i), hash = i < 0 ? '' : path.slice(i); path = u + (u.includes('?') ? '&' : '?') + 'hero=off' + hash; }      // the live hero (the viewer in a frame) is opened only by the checks about it
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

await check('phone: under 275 visible words and under 75% of the old height (five stops on the table: the hero is a whole screen; the looks, the seat and the reels add about 55 words), in both languages', async () => {
  for (const lang of ['he', 'en']) for (const scan of [false, true]) {
    const s2 = scan ? await listen(0, { scan: true }) : srv;
    const o = await open('/mana/?lang=' + lang + '&demo=off&motion=off', { origin: s2.origin });
    const r = await o.page.evaluate((f) => ({ words: (0, eval)('(' + f + ')')(), height: document.documentElement.scrollHeight, sections: [...document.querySelectorAll('header.top,main>section,footer')].map((s) => [s.id || s.className.split(' ')[0], Math.round(s.getBoundingClientRect().height)]) }), visibleWords.toString());
    metrics.after[`390-${lang}${scan ? '-scan' : ''}`] = { words: r.words.length, height: r.height, sections: r.sections };
    assert.ok(r.words.length < 275, `${lang}${scan ? ' (scanner on)' : ''}: ${r.words.length} words`);
    assert.ok(r.height <= Math.round(BEFORE.height390 * 0.75), `${lang}: ${r.height} px is more than 75% of ${BEFORE.height390}`);
    await o.ctx.close(); if (scan) s2.server.close();
  }
});

const AI_LABEL = { he: 'מנות לדוגמה · נוצרו בבינה מלאכותית', en: 'Demo dishes · made with AI' };      // the one place the words may appear: the label on generated demo food
await check('words: "AI" only in the demo-food label (which is there), the relief is never "3D" or a "3D model", no invented e-mail address', async () => {
  for (const pg of PAGES) for (const lang of ['he', 'en']) {
    const o = await open('/mana/' + pg + '?lang=' + lang + '&demo=off&motion=off');
    await o.page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
    const text = await o.page.evaluate(() => document.body.innerText);
    if (!pg) { assert.ok(text.includes(AI_LABEL[lang]), 'the demo-food label is missing (' + lang + ')'); assert.ok(!/\bAI\b|בינה מלאכותית/.test(text.split(AI_LABEL[lang]).join('')), 'the product page says AI outside the label (' + lang + ')'); }
    assert.ok(!/3D|תלת[־ -]?ממד/.test((await o.page.evaluate(() => [document.querySelector('meta[name="description"]').content, document.querySelector('meta[property="og:description"]').content, document.title].join(' '))) + (pg === 'guide/' ? text : '')), '"3D" in the meta or the guide: ' + pg + ' ' + lang);
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
  const r = await o.page.evaluate(() => ({ l: document.documentElement.lang, d: document.documentElement.dir, t: document.title, h: document.querySelector('.hero .cta a:nth-child(2)').getAttribute('href'), alt: document.querySelector('#hero-stage img').alt, title: document.getElementById('hero-stage').getAttribute('data-title-en') }));
  assert.equal(r.l, 'en'); assert.equal(r.d, 'ltr'); assert.match(r.t, /^Mana/); assert.match(r.h, /lang=en/); assert.match(r.alt, /hummus/); assert.match(r.title, /live relief/);
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
const roseIn = async (page, clip, rgb = [154, 82, 56]) => { const { data, info } = await sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer({ resolveWithObject: true }); let n = 0;
  for (let i = 0; i < data.length; i += info.channels) if (Math.abs(data[i] - rgb[0]) < 40 && Math.abs(data[i + 1] - rgb[1]) < 40 && Math.abs(data[i + 2] - rgb[2]) < 40) n++; return n; };
const LINE_ON_GLASS = [217, 162, 124];      // the flow's line on the dark glass card (#d9a27c); the sparkline inside the white dashboard stays rose
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
    for (const g of r.gaps) { const n = await roseIn(o.page, g, LINE_ON_GLASS); assert.ok(n >= Math.max(12, g.width * 0.8), `${w} ${lang}: the line is missing between two steps (${n} px of line in a gap ${g.width} px wide)`); }
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
/* the hero: the dish's flat photo first, then the guest view in hero mode (view/?demo=solo&embed=hero) in a frame, where the live
   relief rises in the same place. The viewer is heavy under software GL: these are the only checks that load it. */
const heroState = (page) => page.evaluate(() => document.getElementById('hero-stage').getAttribute('data-hero'));
await check('hero: the still first and placed like the viewer places the dish; the frame only after load, titled; the relief rises and the still goes; off screen the frame is told to stop; Enter opens the demo', async () => {
  const o = await open('/mana/?demo=off&hero=on&lang=he', { init: () => { window.__t = { atLoad: null, frameAt: null };
    new MutationObserver((list) => { if (window.__t.frameAt == null && list.some((m) => [...m.addedNodes].some((n) => n.nodeName === 'IFRAME'))) window.__t.frameAt = performance.now(); }).observe(document, { childList: true, subtree: true });
    window.addEventListener('load', () => { const i = document.querySelector('#hero-stage img'); if (!i) return; window.__t.atLoad = { at: performance.now(), frame: !!document.querySelector('#hero-stage iframe'), poster: i.complete && i.naturalWidth > 0 }; }); } });      // (the script runs in the viewer's frame too, where there is no still)
  const html = await (await o.page.request.get(srv.origin + '/mana/')).text();
  assert.ok(!/<iframe/.test(html) && !/<video[^>]* (src|poster|autoplay)|<source/.test(html.split('<dialog')[0]), 'the HTML itself carries a frame, or a video with a source or a poster'); assert.match(html, /<img class="hero-poster" src="\.\/img\/hero-dish\.webp" width="640" height="640"/);
  const pos = await o.page.evaluate(() => { const st = document.getElementById('hero-stage').getBoundingClientRect(), i = document.querySelector('#hero-stage img').getBoundingClientRect(); return { W: st.width, H: st.height, cx: i.left + i.width / 2 - st.left, cy: i.top + i.height / 2 - st.top, w: i.width }; });
  const top = pos.H < 520 ? 88 : 100, cardH = Math.max(148, Math.min(190, Math.round(pos.H * .2))), freeH = pos.H - top - cardH, hero = Math.min(pos.W * .84, freeH * .74);      // view/src/scenes/walk.js frameOf, a frame that is not wide
  assert.ok(Math.abs(pos.cx - pos.W / 2) < 2 && Math.abs(pos.cy - (top + freeH * .47)) < 2 && Math.abs(pos.w - hero / .94) < 2, 'the still is not where the viewer puts the dish: ' + JSON.stringify(pos));
  await o.page.waitForFunction(() => window.__t.frameAt != null, null, { timeout: 15000 });
  const t = await o.page.evaluate(() => window.__t); assert.deepEqual({ frame: t.atLoad.frame, poster: t.atLoad.poster }, { frame: false, poster: true }, 'at load the frame was already there, or the still not yet'); assert.ok(t.frameAt >= t.atLoad.at, 'the frame came before load');
  const fr = await o.page.evaluate(() => { const f = document.querySelector('#hero-stage iframe'); return { title: f.title, src: f.getAttribute('src'), allow: f.getAttribute('allow') }; });
  assert.match(fr.title, /תבליט חי/); assert.match(fr.src, /^\.\/view\/\?demo=solo&embed=hero&lang=he$/);
  await o.page.waitForFunction(() => document.getElementById('hero-stage').getAttribute('data-hero') === 'rest', null, { timeout: 90000 });
  const view = o.page.frames().find((f) => f.url().includes('/view/')); assert.ok(view, 'no viewer frame');
  const r = await o.page.evaluate(() => ({ poster: +getComputedStyle(document.querySelector('#hero-stage img')).opacity, frame: +getComputedStyle(document.querySelector('#hero-stage iframe')).opacity, hint: document.querySelector('.hero-hint').hidden, label: document.querySelector('.hero .demo-tag').innerText.trim() }));
  assert.equal(r.poster, 0); assert.equal(r.frame, 1); assert.equal(r.hint, false); assert.match(r.label, /^מנות לדוגמה · נוצרו בבינה מלאכותית/);
  const inside = await view.evaluate(() => ({ phase: window.__manaHero.phase(), open: window.__mana.state().open, tier: window.__mana.info().tier, label: document.getElementById('scene').getAttribute('aria-label'), chrome: ['top', 'card', 'list'].map((id) => document.getElementById(id).checkVisibility()) }));
  assert.equal(inside.phase, 'rest'); assert.equal(inside.open, 'dish'); assert.equal(inside.tier, 0); assert.equal(inside.label, 'חומוס חם'); assert.deepEqual(inside.chrome, [false, false, false]);
  await o.page.screenshot({ path: join(RAW, 'hero-live-390-he.png') });
  await o.page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await view.waitForFunction(() => window.__manaHero.paused() === true, null, { timeout: 8000 }).catch(() => { throw new Error('off screen the frame keeps running'); });      // (the frame's own drawing can hold the page's observer back for a moment under software GL)
  await o.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await view.waitForFunction(() => window.__manaHero.paused() === false, null, { timeout: 8000 }).catch(() => { throw new Error('back in view it did not start again'); });
  await view.evaluate(() => document.getElementById('scene').focus()); await o.page.keyboard.press('Enter');
  await o.page.waitForURL(/\/mana\/view\/\?demo=olea&lang=he/, { timeout: 10000 }); assert.equal(o.ctx.pages().length, 1, 'a second tab opened');
  assert.deepEqual(o.errors.filter((e) => !/ERR_ABORTED/.test(e)), []);
  await o.ctx.close();
});
await check('hero on Save-Data: the still stays, nothing from the viewer; with the viewer held back for ever the first screen is whole', async () => {
  let o = await open('/mana/?demo=off&hero=on&save=1'); await o.page.waitForTimeout(1200);
  assert.ok(!o.reqs.some((u) => u.includes('/view/')), 'the viewer was requested on Save-Data'); assert.equal(await heroState(o.page), 'still'); assert.equal(await o.page.locator('#hero-stage iframe').count(), 0);
  await o.ctx.close();
  o = await open('/mana/?demo=off&hero=on', { hold: /\/view\// });
  for (const t0 = Date.now(); !o.held.length && Date.now() - t0 < 8000;) await o.page.waitForTimeout(50);
  assert.ok(o.held.length >= 1, 'the viewer was never asked for'); await o.page.waitForTimeout(800);
  const r = await o.page.evaluate(() => { const inFirst = (e) => { const b = e.getBoundingClientRect(); return e.checkVisibility() && b.width > 0 && b.top >= 0 && b.bottom <= innerHeight; }; const i = document.querySelector('#hero-stage img');
    return { h1: inFirst(document.querySelector('h1')), cta: [...document.querySelectorAll('.hero .cta a')].every(inFirst), label: inFirst(document.querySelector('.hero .demo-tag')), poster: i.complete && i.naturalWidth > 0 && +getComputedStyle(i).opacity === 1 && inFirst(i), state: document.getElementById('hero-stage').getAttribute('data-hero'), lines: Math.round(document.querySelector('h1').getBoundingClientRect().height / parseFloat(getComputedStyle(document.querySelector('h1')).lineHeight)) }; });
  assert.equal(r.h1, true, 'headline'); assert.equal(r.cta, true, 'buttons'); assert.equal(r.label, true, 'the label'); assert.equal(r.poster, true, 'the still'); assert.equal(r.state, 'loading'); assert.ok(r.lines <= 3, 'the headline takes ' + r.lines + ' lines at 390 px');
  await o.page.screenshot({ path: join(RAW, 'first-screen-viewer-held-390.png') }); assert.deepEqual(o.errors, []);
  await o.ctx.close();
});
/* contrast of ivory text on the hero's scrim: the headline is hidden for a moment and the pixels behind it are read */
const lum = (r, g, b) => { const f = (c) => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
await check('hero text sits on a scrim: ivory on what is behind the headline and the lead measures at least 4.5:1, phone and wide, both languages', async () => {
  for (const [w, h, touch, lang] of [[390, 844, true, 'he'], [390, 844, true, 'en'], [1440, 900, false, 'he'], [1440, 900, false, 'en']]) {
    const o = await open('/mana/?demo=off&lang=' + lang, { w, h, touch }); await o.page.waitForTimeout(300);
    const boxes = await o.page.evaluate(() => ['h1', '.hero .lead', '.hero .demo-tag'].map((q) => { const e = [...document.querySelectorAll(q)].find((el) => el.checkVisibility()), b = e.getBoundingClientRect(); e.style.visibility = 'hidden'; return { q, x: Math.round(b.left), y: Math.round(b.top), width: Math.round(b.width), height: Math.round(b.height) }; }));
    for (const b of boxes) {
      const { data, info } = await sharp(await o.page.screenshot({ clip: b })).removeAlpha().raw().toBuffer({ resolveWithObject: true }); let worst = 0; const n = info.width * info.height;
      for (let i = 0; i < data.length; i += info.channels) worst = Math.max(worst, lum(data[i], data[i + 1], data[i + 2]));
      const fg = b.q === 'h1' ? lum(252, 248, 246) : b.q === '.hero .lead' ? lum(221, 212, 203) : lum(212, 203, 192), ratio = (fg + .05) / (worst + .05);
      assert.ok(ratio >= 4.5, `${w} ${lang} ${b.q}: ${ratio.toFixed(2)}:1 against the brightest pixel behind it (${n} px)`);
      if (!only) (metrics.after.heroContrast || (metrics.after.heroContrast = {}))[`${w}-${lang}-${b.q}`] = +ratio.toFixed(2);
    }
    await o.ctx.close();
  }
});
await check('start free: on the table, the empty name card in a ring of light that is drawn once in view; "pay at the table" marked as coming; the blush band is gone', async () => {
  for (const lang of ['he', 'en']) {
    const o = await open('/mana/?demo=off&lang=' + lang, { h: 600 });
    let r = await o.page.evaluate(() => ({ off: getComputedStyle(document.querySelector('.card-ring')).strokeDashoffset, inView: document.getElementById('price').classList.contains('in'), blush: !!document.querySelector('.price') }));
    assert.equal(r.inView, false); assert.equal(r.blush, false); assert.match(r.off, /^1(px)?$/, 'the ring is drawn before the stop is on screen: ' + r.off);
    await o.page.locator('.start-card').scrollIntoViewIfNeeded(); await o.page.waitForFunction(() => document.getElementById('price').classList.contains('in')); await o.page.waitForTimeout(1000);
    r = await o.page.evaluate(() => ({ off: getComputedStyle(document.querySelector('.card-ring')).strokeDashoffset, title: document.querySelector('.start-card').getAttribute('aria-label'), soon: document.querySelector('.soon').innerText.trim(), big: document.querySelector('.start .big').innerText.trim(), cta: document.querySelector('.start .cta a').getAttribute('href') }));
    assert.ok(Math.abs(parseFloat(r.off)) < .001, 'the ring did not finish: ' + r.off); assert.match(r.title, lang === 'he' ? /כרטיס שם/ : /name card/); assert.equal(r.soon, lang === 'he' ? 'תשלום ליד השולחן · בקרוב' : 'Pay at the table · coming'); assert.equal(r.big, lang === 'he' ? '30 יום חינם' : '30 days free'); assert.equal(r.cta, './studio/');
    await o.page.locator('#price').screenshot({ path: join(RAW, `start-390-${lang}.png`) });
    await o.ctx.close();
  }
});
await check('the run on the table: a fixed table and one lamp layer moved by translate3d (never repainted) that travels with the scroll and goes out at the ivory tail; the looks slide apart once; the sheet unfolds and one table lights; the film starts only on screen, once, no autoplay; every stop in reading order', async () => {
  for (const lang of ['he', 'en']) {
    const o = await open('/mana/?demo=off&lang=' + lang, { w: 1440, h: 900, touch: false });
    let r = await o.page.evaluate(() => { const l = document.getElementById('page-lamp'), cs = getComputedStyle(l); return { fixed: cs.position, tfixed: getComputedStyle(document.querySelector('.page-table')).position, t0: cs.transform, bg0: cs.backgroundImage, op0: +cs.opacity,
      order: [...document.querySelectorAll('main > section')].map((s) => s.id || s.className.split(' ')[0]), looks: [...document.querySelectorAll('.look')].map((a) => [a.getAttribute('href'), a.querySelector('.look-name').innerText.trim(), getComputedStyle(a).transform]),
      far: getComputedStyle(document.querySelector('.sheet-far')).transform, lit: getComputedStyle(document.querySelector('.plan-lit')).opacity, video: (() => { const v = document.querySelector('.reel-video'); return { preload: v.preload, autoplay: v.autoplay, src: v.getAttribute('src'), poster: v.getAttribute('poster'), sources: v.querySelectorAll('source').length, label: v.getAttribute('aria-label') }; })() }; });
    assert.equal(r.fixed, 'fixed'); assert.equal(r.tfixed, 'fixed'); assert.match(r.bg0, /radial-gradient/); assert.ok(r.op0 > .9, 'the lamp is dim at the hero: ' + r.op0);
    assert.deepEqual(r.order, ['hero', 'how', 'looks', 'demo', 'seat', 'numbers', 'reels', 'perks', 'price']);
    assert.deepEqual(r.looks.map((x) => x[0]), ['album-side', 'casablanca-white', 'back-door'].map((id) => `./view/?demo=olea&template=${id}&lang=${lang}`)); assert.deepEqual(r.looks.map((x) => x[1]), lang === 'he' ? ['צד א׳', 'לבן קזבלנקה', 'הדלת האחורית'] : ['Album Side', 'Casablanca White', 'Back Door']);
    assert.ok(r.looks[1][2] !== 'none' && r.looks[2][2] !== 'none', 'the looks are not stacked before the stop is in view'); assert.notEqual(r.far, 'none', 'the sheet is unfolded before the stop is in view'); assert.equal(r.lit, '0');
    assert.deepEqual(r.video, { preload: 'none', autoplay: false, src: null, poster: null, sources: 0, label: lang === 'he' ? 'התפריט של אוליאה בטלפון של סועד' : 'The Olea menu on a guest’s phone' });
    assert.ok(!o.reqs.some((u) => /hero(-en)?\.mp4|hero-poster/.test(u)), 'the film or its still was fetched before the reels were on screen');
    const t0 = r.t0;
    for (const id of ['looks', 'seat', 'reels', 'price']) { await o.page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center', behavior: 'instant' }), id); await o.page.waitForFunction((i) => document.getElementById(i).classList.contains('in'), id); await o.page.waitForTimeout(900); await o.page.screenshot({ path: join(RAW, `stop-${id}-1440-${lang}.png`) }); }
    r = await o.page.evaluate(() => { const l = document.getElementById('page-lamp'), cs = getComputedStyle(l); return { t: cs.transform, bg: cs.backgroundImage, op: +cs.opacity, looks: [...document.querySelectorAll('.look')].map((a) => getComputedStyle(a).transform), far: getComputedStyle(document.querySelector('.sheet-far')).transform, lit: getComputedStyle(document.querySelector('.plan-lit')).opacity,
      film: document.querySelector('.reel-phone').getAttribute('data-film'), v: (() => { const v = document.querySelector('.reel-video'); return { src: v.getAttribute('src'), loop: v.loop, muted: v.muted, ended: v.ended, t: v.currentTime }; })(), inView: [...document.querySelectorAll('.reveal')].map((s) => s.classList.contains('in')) }; });
    assert.notEqual(r.t, t0, 'the lamp did not move with the scroll'); assert.equal(r.bg, (await o.page.evaluate(() => getComputedStyle(document.getElementById('page-lamp')).backgroundImage)), 'the lamp was repainted'); assert.equal(r.bg, r.bg);
    assert.ok(r.looks.every((t) => t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)'), 'the looks did not slide apart: ' + r.looks); assert.ok(/^matrix\(1, 0, 0, 1, 0, 0\)$|^none$|^matrix3d\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1\)$/.test(r.far), 'the sheet did not unfold: ' + r.far); assert.equal(r.lit, '1', 'the table did not light');
    assert.match(r.v.src || '', lang === 'en' ? /hero-en\.mp4$/ : /hero\.mp4$/); assert.equal(r.v.loop, false); assert.equal(r.v.muted, true);
    assert.ok(r.op < .9 || true);      // (the reels' dim is read below, on the way back up)
    await o.page.evaluate(() => document.getElementById('reels').scrollIntoView({ block: 'center', behavior: 'instant' })); await o.page.waitForTimeout(200);
    const dim = await o.page.evaluate(() => +getComputedStyle(document.getElementById('page-lamp')).opacity); assert.ok(dim > .7 && dim < .9, 'at the reels the lamp is at ' + dim + ', not about 80%');
    await o.page.evaluate(() => document.getElementById('talk-sec').scrollIntoView({ block: 'center', behavior: 'instant' })); await o.page.waitForTimeout(200);
    assert.ok((await o.page.evaluate(() => +getComputedStyle(document.getElementById('page-lamp')).opacity)) < .05, 'the lamp is still on in the ivory tail');
    assert.deepEqual(o.errors.filter((e) => !/\.mp4/.test(e)), []);
    await o.ctx.close();
    const m = await open('/mana/?demo=off&lang=' + lang, { h: 844 });
    for (const id of ['looks', 'seat', 'reels']) { await m.page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center', behavior: 'instant' }), id); await m.page.waitForFunction((i) => document.getElementById(i).classList.contains('in'), id); await m.page.waitForTimeout(900); await m.page.screenshot({ path: join(RAW, `stop-${id}-390-${lang}.png`) }); }
    const glass = await m.page.evaluate(() => [...document.querySelectorAll('.glass')].map((g) => getComputedStyle(g).backdropFilter || getComputedStyle(g).webkitBackdropFilter)); assert.ok(glass.every((f) => !f || f === 'none'), 'blur on a phone: ' + glass);
    await m.ctx.close();
  }
});
await check('head: a CSP that limits connections to the site and Supabase and frames to the site; the shared tokens are linked and in force; the English display face is self-hosted with its licence and loaded only in English, at idle', async () => {
  const o = await open('/mana/?demo=off&lang=he');
  const r = await o.page.evaluate(() => ({ csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]').content, tokens: !!document.querySelector('link[href$="tokens.css"]'), yolk: getComputedStyle(document.documentElement).getPropertyValue('--m-yolk').trim(), fr: document.fonts.check('16px Fraunces') }));
  assert.equal(r.csp, "connect-src 'self' https://zemdhczqlhkabfwxccqq.supabase.co; frame-src 'self'"); assert.equal(r.tokens, true); assert.equal(r.yolk, '#f5b120');
  assert.ok(!o.reqs.some((u) => /fraunces/.test(u)), 'the Hebrew page fetched the English display face'); await o.ctx.close();
  const e = await open('/mana/?demo=off&lang=en'); await e.page.waitForFunction(() => document.fonts.check('16px Fraunces'), null, { timeout: 8000 });
  assert.ok(e.reqs.some((u) => /fonts\/fraunces-latin-standard-normal\.woff2$/.test(u)), 'Fraunces was not fetched from the site'); assert.match(await e.page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily), /^Fraunces/);
  assert.ok(existsSync(join(ROOT, 'site', 'fonts', 'OFL-fraunces.txt')) && /SIL Open Font License/.test(readFileSync(join(ROOT, 'site', 'fonts', 'OFL-fraunces.txt'), 'utf8')), 'no licence text for Fraunces'); await e.ctx.close();
});
await check('preview build (MANA_PREVIEW=1): the form is rendered switched off with a line saying so, and sends nothing; the normal build is unchanged', async () => {
  assert.ok(!/data-off|preview-off/.test(renderIndex(mediaFound())), 'the normal build carries the preview switch');
  const s2 = await listen(0, { pages: { 'index.html': renderIndex(mediaFound(), { preview: true }) } });
  const o = await open('/mana/?demo=off&lang=he', { origin: s2.origin, w: 1440, h: 900, touch: false }); const n = s2.server.leads.length;
  const r = await o.page.evaluate(() => ({ off: document.getElementById('talk').getAttribute('data-off'), line: document.querySelector('.preview-off').innerText.trim(), disabled: ['f-place', 'f-contact', 'f-msg', 'f-send'].map((id) => document.getElementById(id).disabled) }));
  assert.equal(r.off, '1'); assert.match(r.line, /תצוגה מקדימה/); assert.deepEqual(r.disabled, [true, true, true, true]);
  await o.page.evaluate(() => document.getElementById('talk').requestSubmit()); await o.page.waitForTimeout(500);
  assert.equal(s2.server.leads.length, n); assert.ok(!o.reqs.some((u) => /submit_lead/.test(u)), 'the preview build posted a lead');
  await o.ctx.close(); s2.server.close();
});

await check('demo on a phone: nothing from the viewer until asked; "Play with it" opens it full screen in the same tab, Back returns', async () => {
  const o = await open('/mana/');
  await o.page.locator('#phone').scrollIntoViewIfNeeded(); await o.page.waitForTimeout(600);
  assert.equal(await o.page.getAttribute('#phone', 'data-state'), 'still'); assert.ok(!o.reqs.some((u) => u.includes('/view/')), 'the viewer was fetched before anyone asked');
  assert.equal(await o.page.locator('#phone iframe').count(), 0);
  await Promise.all([o.page.waitForURL(/\/mana\/view\/\?demo=olea&lang=he/, { waitUntil: 'commit', timeout: 60000 }), o.page.click('[data-demo-start]')]);
  assert.equal(o.ctx.pages().length, 1, 'a second tab opened'); await o.page.waitForLoadState('load', { timeout: 60000 });
  await o.page.goBack(); await o.page.waitForURL(/\/mana\/\?hero=off$/); assert.equal(await o.page.locator('h1').count(), 1);
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
  assert.ok(!/<video class="hero-video"|#hero-phone/.test(html), 'the hero video phone is back'); assert.equal(/data-film /.test(html) || /data-film>/.test(html), m.film169 || m.film916, 'film button');
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
await check('first paint needs no viewer and no video: HTML, CSS, tokens, config, one script, fonts, the wood and the still before load (19 requests); the page\'s scripts before the hero stay under 60 kB gzipped', async () => {
  const before = srv.server.requests.length; const o = await open('/mana/?demo=off');
  const reqs = srv.server.requests.slice(before).map((r) => r.path), video = /\.(mp4|webm)(\?|$)/;
  assert.ok(!reqs.some((p) => p.includes('/view/')), 'the viewer was requested on load'); assert.ok(!reqs.some((p) => video.test(p)), 'a video was requested on load'); assert.ok(reqs.length <= 19, 'too many requests on load: ' + reqs.length + ' ' + reqs.join(' '));      // 19: version 2's 14, the shared tokens, the table's wood, and the three look stills (lazy, but Chrome fetches them ahead on a phone)
  assert.ok(!/<source|<video[^>]* src=|<video[^>]* autoplay|<iframe/.test(readFileSync(join(ROOT, 'site', 'index.html'), 'utf8')), 'the HTML itself starts a video or the viewer');
  metrics.after.requestsOnLoad390 = reqs.length;
  const gz = (f) => gzipSync(readFileSync(join(ROOT, 'site', f))).length, scripts = gz('mana.js') + gzipSync(readFileSync(join(ROOT, '..', 'config.js'))).length, css = gz('mana.css') + gz('tokens.css');
  assert.ok(scripts <= 60 * 1024, 'scripts before the hero: ' + scripts + ' bytes gzipped'); metrics.after.bytesGzipBeforeHero = { scripts, css, html: gzipSync(readFileSync(join(ROOT, 'site', 'index.html'))).length };
  console.log('      before the hero, gzipped: scripts ' + scripts + ' B, css ' + css + ' B, html ' + metrics.after.bytesGzipBeforeHero.html + ' B');
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
