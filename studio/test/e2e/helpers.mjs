// Shared by the end-to-end tests: one local stack, one Chromium, small helpers that act the way an owner would.
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startStack } from '../stack/start.mjs';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OUT = path.resolve(HERE, '../.out');
export const MENUS = path.resolve(HERE, '../../..');
export const PHOTOS = {
  plate: path.join(MENUS, 'gen-lab/photos/real-shakshouka.webp'),
  plate2: path.join(MENUS, 'gen-lab/photos/syn-hamburger-26-2.jpg'),
  drink: path.join(MENUS, 'gen-lab/photos/syn-koko-neko-9.jpg'),
  blank: path.join(MENUS, 'gen/tests/fixtures/blank.jpg'),
  cutoff: path.join(MENUS, 'gen/tests/fixtures/cutoff.jpg'),
};
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
// the last rule keeps the browser on this machine: any host but 127.0.0.1 simply does not resolve (no update checks, no stray requests)
const GL = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
  '--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1'];

let stack, browser;
/** One stack and one browser per test file. gen: 'fake' = the light stand-in generator (everything but the journey uses it). */
export async function setup(opts = {}) {
  stack = await startStack(opts);
  browser = await chromium.launch({ executablePath: CHROME, args: GL });
  return { stack, browser };
}
/** Switches of the stack's stand-ins (see test/stack/ai-standin.mjs); `{ ai: 'reset' }` puts the scanner back to its defaults. */
// One more try for the calls to the test gateway: Node keeps its connection open between calls, and a call that lands just as
// the gateway closes an idle connection fails with "fetch failed" (seen on a busy machine). Both calls are safe to repeat.
const again = (fn) => fn().catch((e) => { console.error('test gateway call repeated after:', e?.cause?.code || e?.cause?.message || e?.message); return fn(); });
export const stackConfig = (patch) => again(() => fetch(stack.API_URL + '/__test/config', { method: 'POST', body: JSON.stringify(patch) }).then((r) => r.json()));
export const aiCalls = () => again(() => fetch(stack.API_URL + '/__test/ai').then((r) => r.json()));
export async function teardown() {
  try { await browser?.close(); } catch { /* already closed */ }
  await stack?.stop();
}
export const app = (hash = '') => stack.WEB_URL + 'studio/' + (hash ? '#/' + hash : '');
export const viewer = (q) => stack.WEB_URL + 'view/' + q;

/** A phone-sized (or other) page with the app language preset; console errors and failed requests are collected. */
export async function newPage({ width = 390, height = 844, lang = 'he', touch = false, context, previewQ = 'gl=off' } = {}) {
  const ctx = context || await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, locale: lang === 'he' ? 'he-IL' : 'en-GB', timezoneId: 'Asia/Jerusalem' });
  // previewQ: extra switches for the viewer inside the live preview. Software WebGL is slow, so tests that are not about the picture turn it off.
  await ctx.addInitScript(([l, q]) => { try { if (!localStorage.getItem('mana-studio-lang')) localStorage.setItem('mana-studio-lang', l); if (q) localStorage.setItem('mana-studio-preview-q', q); } catch { /* opaque origin */ } }, [lang, previewQ]);
  const page = await ctx.newPage();
  page.problems = []; page.hosts = new Set();
  page.on('request', (r) => { try { const u = new URL(r.url()); if (u.protocol.startsWith('http')) page.hosts.add(u.host); } catch { /* data: and blob: */ } });
  page.on('pageerror', (e) => page.problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_/.test(m.text())) page.problems.push('console: ' + m.text()); });
  return page;
}

let n = 0;
export const unique = (p = 'u') => `${p}${Date.now().toString(36)}${(n++).toString(36)}`;
export const PASSWORD = 'correct-horse-9';

/** A signed-in supabase-js client for a NEW account, created through the same sign-up function the app calls. */
export async function account(email = unique('owner') + '@example.com') {
  const r = await fetch(stack.API_URL + '/functions/v1/menus-signup', { method: 'POST', headers: { apikey: stack.ANON_KEY, 'content-type': 'application/json', 'x-test-client': email },
    body: JSON.stringify({ email, password: PASSWORD, hp: '', elapsed_ms: 4000 }) }).then((x) => x.json());
  if (!r.ok) throw new Error('signup failed: ' + JSON.stringify(r));
  const client = createClient(stack.API_URL, stack.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return { email, client };
}
export const anon = () => createClient(stack.API_URL, stack.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

/** A business with a small menu, made through the API (for tests that are not about typing the menu). */
export async function seedBusiness(client, { slug = unique('biz'), nameHe = 'מסעדת בדיקה', nameEn = 'Test Kitchen', items = [['חומוס', 'Hummus', 3200], ['שקשוקה', 'Shakshuka', 5400]] } = {}) {
  const b = await client.rpc('create_business', { p_slug: slug, p_name_he: nameHe, p_name_en: nameEn, p_kind: 'restaurant', p_contact_name: 'Dana', p_contact_phone: '050-1234567' });
  if (b.error || !b.data.ok) throw new Error('create_business: ' + JSON.stringify(b.error || b.data));
  const id = b.data.id;
  const cat = await client.from('categories').insert({ business_id: id, name_he: 'עיקריות', name_en: 'Mains', kind: 'food', position: 0 }).select().single();
  if (cat.error) throw cat.error;
  const rows = [];
  for (const [i, [he, en, price]] of items.entries()) {
    const r = await client.from('items').insert({ business_id: id, category_id: cat.data.id, position: i, name_he: he, name_en: en, price_minor: price }).select().single();
    if (r.error) throw r.error;
    rows.push(r.data);
  }
  return { id, slug, category: cat.data, items: rows };
}

export async function signInUi(page, email, password = PASSWORD) {
  await page.goto(app());
  await page.locator('input[name=email]').fill(email);
  await page.locator('input[name=password]').fill(password);
  await page.locator('form button[type=submit]').click();
}
/** Full-page pictures are taken with the sticky header and the tab bar laid flat, so they do not cut through the middle of the page. */
export const shot = async (page, name, opts = {}) => {
  const p = path.join(OUT, name + '.png'), full = opts.fullPage !== false;
  const style = full ? await page.addStyleTag({ content: '@media (max-width:1023px){.top,.scan-top{position:static!important}.nav,.sticky{position:static!important}.fab{display:none!important}.shell,.page,.scan{padding-bottom:0!important}}.toasts{display:none!important}' }) : null;
  await page.screenshot({ path: p, ...opts, fullPage: full });
  if (style) await style.evaluate((el) => el.remove());
  return p;
};
export const sql = (q) => stack.sql(q).trim();
export { stack, browser };

/** No sideways scrolling, and nothing a finger must hit is smaller than 44 px. Returns a list of problems. */
export async function layoutProblems(page, min = 44) {
  return page.evaluate((min) => {
    const out = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth + 1) out.push(`page scrolls sideways: ${de.scrollWidth} > ${de.clientWidth}`);
    const seen = new Set();
    for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=radio], [role=switch], [role=tab], summary, label.btn, label.tagchip, label.dot2')) {
      if (el.closest('.sr, .hp, [aria-hidden=true], dialog:not([open]), [hidden]')) continue;
      if (document.querySelector('dialog[open]') && !el.closest('dialog[open]')) continue;                 // behind an open sheet: not reachable
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.classList.contains('sr')) continue;
      let box = el;
      if ((el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'color' || el.type === 'file')) ) box = el.closest('label') || el;
      if (seen.has(box)) continue; seen.add(box);
      const r = box.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const inline = cs.display === 'inline' && el.tagName === 'A';            // a link inside a sentence is text, not a control
      if (inline) continue;
      if (r.height < min - 0.5 || r.width < min - 0.5) out.push(`small target ${Math.round(r.width)}x${Math.round(r.height)}: <${el.tagName.toLowerCase()} class="${el.className}"> ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}`);
      // inside a strip that scrolls sideways on purpose (the tables), what matters is that the strip itself is on screen
      let frame = box;
      for (let e = box.parentElement; e && e !== document.body; e = e.parentElement) { const o = getComputedStyle(e).overflowX; if ((o === 'auto' || o === 'scroll') && e.scrollWidth > e.clientWidth + 1) { frame = e; break; } }
      const fr = frame.getBoundingClientRect();
      if (fr.right > de.clientWidth + 1 || fr.left < -1) out.push(`off screen: <${el.tagName.toLowerCase()} class="${el.className}"> ${(el.textContent || '').trim().slice(0, 30)}`);
    }
    return out;
  }, min);
}

/** A "photographed menu page": a tall, large picture (3000 × 4000) made here, so nothing binary sits in the repository. */
export async function menuPhoto(name = 'menu-page', tone = 236) {
  const file = path.join(OUT, name + '.png');
  if (fs.existsSync(file)) return file;
  const { PNG } = await import('pngjs');
  const W = 3000, H = 4000, png = new PNG({ width: W, height: H, colorType: 2 });
  for (let y = 0; y < H; y++) {
    const band = y % 180, text = y > 400 && y < H - 300 && band > 60 && band < 84, head = y > 400 && band > 20 && band < 44 && Math.floor(y / 180) % 6 === 2;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, inX = x > 380 && x < (head ? 1500 : 2620 - ((Math.floor(y / 180) * 337) % 900));
      const v = (text || head) && inX ? (head ? 40 : 90) : tone - ((x * 7 + y * 3) % 5);
      png.data[i] = v; png.data[i + 1] = v - (v > 200 ? 6 : 0); png.data[i + 2] = v - (v > 200 ? 14 : 0); png.data[i + 3] = 255;
    }
  }
  fs.writeFileSync(file, PNG.sync.write(png, { deflateLevel: 6 }));
  return file;
}
/** Guests arrive: the same calls the diner viewer makes (CONTRACT.md v2.4), straight to PostgREST with only the public key. */
export async function guests(slug, visits, items = []) {
  const call = (fn, body) => fetch(stack.API_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: stack.ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  for (const v of visits) { const r = await call('open_menu', { p_slug: slug, p_lang: v.lang, p_src: v.src }); if (!r.ok) throw new Error('open_menu ' + r.status); }
  for (const [item, kind, n = 1] of items) for (let k = 0; k < n; k++) { const r = await call('track_item', { p_slug: slug, p_item: item, p_kind: kind }); if (!r.ok) throw new Error('track_item ' + r.status); }
}
/** Wait until a query answers what is expected (autosave is asynchronous: the badge may still show an earlier "saved"). */
export async function dbIs(query, want, ms = 10000) {
  const t0 = Date.now(); let got;
  for (;;) { got = sql(query); if (got === String(want)) return got; if (Date.now() - t0 > ms) throw new Error(`database: expected ${want}, got ${got} for ${query}`); await new Promise((r) => setTimeout(r, 120)); }
}
/** The snapshot guests are being served, read without counting a visit (public_menu and open_menu count one). */
export const liveSnapshot = (businessId) => JSON.parse(sql(`select r.snapshot from public.menu_revisions r join public.menus m on m.published_revision_id = r.id where m.business_id = '${businessId}'`) || 'null');
