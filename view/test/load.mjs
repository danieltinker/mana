/* What a guest's phone has to download before the first dish is sharp. Prints numbers; it asserts nothing. Run: node test/load.mjs [--files]
   Every file fetched up to the mark "menu-table-drawn" (the table is up and the dish in focus is drawn from its own picture) is
   counted twice: as stored, and as a static host sends it (text gzipped at level 9; pictures and fonts as they are).
   The files are then split into what the FIRST dish needs (page, style, script, fonts, menu data, the table's wood, its own
   pictures) and what was fetched for its neighbours on the table in the meantime.
   WebGL here is software (SwiftShader): the first frame takes seconds, so by then the neighbours have loaded too. On a phone
   the first dish is drawn as soon as its own files are there. The TIMES below say little about a phone; the bytes are the same. */
import { gzipSync } from 'node:zlib';
import { launch, listen, VIEW } from './browser.mjs';

const srv = await listen(0), browser = await launch(), files = process.argv.includes('--files');
const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' kB', sum = (a) => a.reduce((n, g) => n + g.sent, 0);
const kind = (f) => (/\.(js|mjs)$/.test(f) ? 'script' : /\.css$/.test(f) ? 'style' : /\.woff2$/.test(f) ? 'fonts' : /\/themes\//.test(f) ? 'table' : /\.(jpg|jpeg|png|webp|avif)$/.test(f) ? 'pictures' : 'page and menu data');
async function run(label, url, until) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }), page = await ctx.newPage(), got = [];
  page.on('response', async (res) => {
    try { const body = await res.body(), u = new URL(res.url()), t = res.request().timing(), text = /json|javascript|css|html|svg/.test(res.headers()['content-type'] || '');
      got.push({ file: u.pathname.replace('/projects/menus/', ''), raw: body.length, sent: text ? gzipSync(body, { level: 9 }).length : body.length, end: t.startTime + Math.max(0, t.responseEnd) }); } catch (e) { /* a request the page dropped */ }
  });
  await page.goto(url, { waitUntil: 'commit' });
  await page.waitForFunction((m) => window.__mana && window.__mana.marks().some((x) => x.name === m), until, { timeout: 120000 });
  const m = await page.evaluate(() => ({ origin: performance.timeOrigin, marks: Object.fromEntries(window.__mana.marks().map((x) => [x.name, x.t])), first: window.__mana.state().itemId, model: window.__mana.model().itemById.get(window.__mana.state().itemId).item.asset }));
  await page.waitForTimeout(1500);                                   // let what was started finish, so that it is counted as "after"
  const at = m.origin + m.marks[until], before = got.filter((g) => g.end <= at), after = got.filter((g) => g.end > at);
  const own = new Set(Object.values(m.model || {}).filter((v) => typeof v === 'string').map((v) => { try { return new URL(v, url).pathname.replace('/projects/menus/', ''); } catch (e) { return v; } }));
  const first = before.filter((g) => kind(g.file) !== 'pictures' || own.has(g.file)), others = before.filter((g) => !first.includes(g));
  const group = (a) => { const o = {}; a.forEach((g) => { const k = kind(g.file); o[k] = (o[k] || 0) + g.sent; }); return Object.entries(o).map(([k, v]) => k + ' ' + kb(v).trim()).join(' · '); };
  console.log('\n' + label + '   (first dish: ' + m.first + ')');
  console.log('  the first dish needs        :', kb(sum(first)), 'in', String(first.length).padStart(2), 'files  →', group(first));
  if (until === 'menu-table-drawn') console.log('  its neighbours, meanwhile   :', kb(sum(others)), 'in', String(others.length).padStart(2), 'files  (pictures of the dishes around it; on a phone these arrive after the first dish is sharp)');
  console.log('  all fetched up to the mark  :', kb(sum(before)), 'sent,', kb(before.reduce((n, g) => n + g.raw, 0)).trim(), 'as stored;', kb(sum(after)).trim(), 'after it');
  console.log('  marks (ms, software GL)     :', JSON.stringify(m.marks));
  if (files) before.sort((a, b) => b.sent - a.sent).forEach((g) => console.log('   ', kb(g.sent), own.has(g.file) || kind(g.file) !== 'pictures' ? ' ' : '·', g.file));
  await ctx.close();
}
await run('/m/olea (stub backend), phone 390x844', srv.origin + '/m/olea', 'menu-table-drawn');
await run('?demo=kiosk (placeholders), phone 390x844', srv.origin + VIEW + '?demo=kiosk', 'menu-table-drawn');
await run('/m/olea?view=list (no table: until the text is up)', srv.origin + '/m/olea?view=list', 'menu-text');
await browser.close(); srv.server.close();
