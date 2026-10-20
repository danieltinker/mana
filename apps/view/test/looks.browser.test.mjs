/* One browser test per look (headless Chromium, software WebGL): the table is up in the look's surface, no page errors, the
   look's CSS detail is on the app root, and every word on the dish card reads at 4.5:1, measured from computed styles over the
   card's own tint composited on the page's black (the darkest the card can be). Then the lifted sheet, the same way.
   Run alone:  node --test --test-concurrency=1 test/looks.browser.test.mjs */
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { launch, listen, open, tableUp, VIEW } from './browser.mjs';

const LOOKS = JSON.parse(readFileSync(new URL('../../../templates/templates.v1.json', import.meta.url), 'utf8')).looks;
let srv, browser;
before(async () => { srv = await listen(0); browser = await launch(['--disable-ipc-flooding-protection']); });
after(async () => { await browser.close(); srv.server.close(); });
const demo = (q = '') => srv.origin + VIEW + '?demo=olea&test=1&pr=0.3&hint=0' + q;

/* text colour against what it is read on: the nearest ancestors' backgrounds composited, from the element up to the app, over the page's own black */
const CONTRAST = (sels) => {
  const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const page = parse(getComputedStyle(document.body).backgroundColor) || { r: 11, g: 9, b: 7, a: 1 };
  return sels.map((sel) => {
    const el = document.querySelector(sel); if (!el || el.closest('[hidden]') || !el.textContent.trim()) return { sel, skipped: true };
    const layers = []; for (let n = el; n && n !== document.body; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) layers.push(c); }
    let bg = page; for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
    const fg = parse(getComputedStyle(el).color), lf = lum(fg), lb = lum(bg);
    return { sel, text: el.textContent.trim().slice(0, 30), ratio: +((Math.max(lf, lb) + .05) / (Math.min(lf, lb) + .05)).toFixed(2), fg: getComputedStyle(el).color, bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round) + ')' };
  });
};
const REST = ['#dName', '#dPrice', '#dDesc', '#dIdx', '#dTrack', '#dIllus', '#dSold'], LIFTED = ['#dName', '#dPrice', '#dDescFull', '#dIdx', '#dAllergensTxt', '#dAllergensLbl', '#addBtn2', '#orderLink2', '#dTagsFull .tag span', '#dIllusLine', '#closeBtn'];
async function legible(page, sels, where) {
  const rows = await page.evaluate(CONTRAST, sels);
  const low = rows.filter((r) => !r.skipped && r.ratio < 4.5);
  assert.deepEqual(low, [], where + ': ' + JSON.stringify(low));
  return rows.filter((r) => !r.skipped);
}

for (const look of LOOKS) {
  test('look ' + look.id + ' (' + look.name.en + '): the table is up on ' + look.surface + ', the detail is there, every word on the card reads', async () => {
    const n0 = srv.server.requests.length, { page, errors, ctx } = await open(browser, demo('&template=' + look.id + '&lang=he'));
    await page.evaluate(() => window.__mana.ready);
    const dom = await page.evaluate(() => { const a = document.getElementById('app'); return { look: a.dataset.look, card: a.dataset.card, cls: a.className, theme: window.__mana.model().snapshot.theme, accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() }; });
    assert.equal(dom.look, look.id); assert.equal(dom.card, look.card); assert.ok(dom.cls.split(' ').includes('look-' + look.detail), 'the CSS detail class'); assert.equal(dom.theme.surface, look.surface); assert.equal(dom.theme.accent, look.accent); assert.equal(dom.accent, look.accent);
    await tableUp(page);
    const info = await page.evaluate(() => window.__mana.info());
    assert.equal(info.scene, 'table'); assert.ok(info.heroReady, 'the first dish is sharp'); assert.ok(!info.lost);
    const fetched = srv.server.requests.slice(n0).map((r) => r.path);
    assert.ok(fetched.some((p) => p.endsWith('/themes/' + look.surface + '.jpg')), 'the look\'s table texture was fetched');
    if (look.surface !== 'oak') assert.ok(!fetched.some((p) => p.endsWith('/themes/oak.jpg')), 'not today\'s oak');
    /* at rest */
    const rest = await legible(page, REST, look.id + ' at rest');
    assert.ok(rest.some((r) => r.sel === '#dName') && rest.some((r) => r.sel === '#dPrice'), 'name and price measured');
    const track = await page.evaluate(() => { const t = document.getElementById('dTrack'); return t && !t.hidden ? { text: t.textContent, dir: t.getAttribute('dir'), tag: t.tagName } : null; });
    if (look.detail === 'tracks') assert.deepEqual(track, { text: 'A1', dir: 'ltr', tag: 'BDI' }); else assert.equal(track, null);
    if (look.detail === 'door-crack') { const bt = await page.$eval('#card', (el) => getComputedStyle(el).borderTopWidth + ' ' + getComputedStyle(el).borderTopColor); assert.equal(bt, '2px rgb(201, 151, 92)', 'the door crack is a 2 px amber line'); }
    if (look.detail === 'tile-stripe') { const h = await page.$eval('#card', (el) => getComputedStyle(el, '::before').height); assert.equal(h, '3px'); }
    if (look.detail === 'ticket') { const bg = await page.$eval('#dName', (el) => getComputedStyle(el).backgroundColor); assert.equal(bg, 'rgb(245, 241, 232)', 'the name sits on paper'); }
    /* lifted: the sheet, in English too */
    await page.evaluate(() => window.__mana.setLang('en')); await page.evaluate(() => window.__mana.lift(true)); await page.evaluate(() => window.__mana.tick(40, 1 / 30, true));
    assert.equal((await page.evaluate(() => window.__mana.state())).open, 'dish');
    await legible(page, LIFTED, look.id + ' lifted');
    if (look.detail === 'tracks') assert.equal(await page.$eval('#dTrack', (t) => t.textContent + '|' + getComputedStyle(t).direction), 'A1|ltr');
    /* the AI label on the demo line */
    assert.equal(await page.$eval('#demoLine', (el) => el.textContent), 'Demo menu · invented restaurant\nDemo dishes · made with AI');
    assert.deepEqual(errors, []); await ctx.close();
  });
}

test('?template= is for demos only: a real menu takes its look from the snapshot, never from the address', async () => {
  const { page, errors, ctx } = await open(browser, srv.origin + '/m/olea?test=1&pr=0.3&gl=skip&template=back-door');
  await page.evaluate(() => window.__mana.ready);
  const a = await page.evaluate(() => ({ look: document.getElementById('app').dataset.look || null, surface: window.__mana.model().snapshot.theme.surface, template: window.__mana.model().snapshot.theme.template, demoLine: document.getElementById('demoLine').hidden }));
  assert.deepEqual(a, { look: null, surface: 'oak', template: null, demoLine: true });
  assert.deepEqual(errors, []); await ctx.close();
});

test('an unknown look in a demo is today\'s menu, and the card still reads', async () => {
  const { page, errors, ctx } = await open(browser, demo('&template=souk&gl=skip'));
  await page.evaluate(() => window.__mana.ready);
  assert.equal(await page.evaluate(() => document.getElementById('app').dataset.look || null), null);
  assert.equal(await page.evaluate(() => window.__mana.model().snapshot.theme.surface), 'oak');
  await legible(page, REST, 'today');
  assert.deepEqual(errors, []); await ctx.close();
});
