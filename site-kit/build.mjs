#!/usr/bin/env node
/* The site kit, v1: a menu-first one-page restaurant site from a published menu snapshot (view/demo/olea/menu.json is the
   shape). One static HTML file and the pictures it shows; nothing loaded from anywhere else; Hebrew first with an
   English toggle; Mana's tokens inlined; JSON-LD Restaurant + Menu from the snapshot only (no invented facts).

       node site-kit/build.mjs <menu.json> <outdir> [--menu <guest menu URL>] [--demo] [--index]

   --menu   where "Open the menu" goes (default https://halom.io/m/<slug>)
   --demo   mark the site as a demo (Olea is one by its slug): a demo line and the AI label on its generated dishes
   --index  let search engines index the page (off by default: a generated site is a preview until its owner says so) */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEMO_SLUGS = ['olea'];
export const LABEL = { aiHe: 'מנות לדוגמה · נוצרו בבינה מלאכותית', aiEn: 'Demo dishes · made with AI', demoHe: 'אתר הדגמה', demoEn: 'Demo site' };
const TAGS = { vegan: { he: 'טבעוני', en: 'Vegan' }, vegetarian: { he: 'צמחוני', en: 'Vegetarian' }, gf: { he: 'ללא גלוטן', en: 'Gluten-free' }, spicy: { he: 'חריף', en: 'Spicy' } };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const t = (v, lang) => (v && typeof v === 'object') ? (v[lang] ?? v.he ?? v.en ?? '') : (v ?? '');
const spans = (v, cls = '') => '<span class="he' + (cls ? ' ' + cls : '') + '" lang="he">' + esc(t(v, 'he')) + '</span><span class="en' + (cls ? ' ' + cls : '') + '" lang="en">' + esc(t(v, 'en')) + '</span>';
const both = (v) => { const he = t(v, 'he'), en = t(v, 'en'); return he === en ? esc(he) : spans(v); };
/** ₪ and agorot → "38" or "38.50", tabular, always left to right. */
export const price = (agorot) => { const s = Math.floor(agorot / 100), a = agorot % 100; return '₪' + s + (a ? '.' + String(a).padStart(2, '0') : ''); };
const https = (u) => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null;

/** Builds the page. Returns {html, files: [[from, to], …]} so the test can check without writing. */
export function render(menu, { menuUrl, demo, index = false, base = '.' } = {}) {
  if (!menu || menu.v !== 1 || !menu.business || !Array.isArray(menu.categories)) throw new Error('not a v1 menu snapshot');
  const b = menu.business, slug = String(menu.slug || 'menu'), isDemo = demo ?? DEMO_SLUGS.includes(slug);
  const nameHe = t(b.name, 'he'), nameEn = t(b.name, 'en'), files = [], pic = (rel) => { if (!rel) return null; const to = 'img/' + basename(rel); files.push([join(base, rel), to]); return to; };
  const items = menu.categories.flatMap((c) => (c.items || []).map((it) => ({ ...it, category: c })));
  const first = items.find((it) => it.asset && it.asset.color) || items[0];
  const heroImg = first && first.asset && first.asset.color ? pic(first.asset.color) : null;
  const url = https(menuUrl) || 'https://halom.io/m/' + encodeURIComponent(slug);
  const bookUrl = https(b.bookUrl), orderUrl = https(b.orderUrl), phone = typeof b.phone === 'string' && b.phone.trim() ? b.phone.trim() : null;
  const address = b.address || b.area, hours = b.hours && (typeof b.hours === 'string' || typeof b.hours === 'object') ? b.hours : null;

  const nav = menu.categories.map((c) => '<a href="#' + esc(c.id) + '">' + both(c.name) + '</a>').join('');
  const menuHtml = menu.categories.map((c) => '<section aria-labelledby="h-' + esc(c.id) + '"><h2 id="h-' + esc(c.id) + '"><a id="' + esc(c.id) + '"></a>' + both(c.name) +
    (isDemo && (c.items || []).some((it) => it.asset && it.asset.state === 'relief') ? '<small class="ai">' + spans({ he: LABEL.aiHe, en: LABEL.aiEn }) + '</small>' : '') + '</h2>' +
    (c.items || []).map((it) => dish(it, pic)).join('') + '</section>').join('\n');

  const info = [];
  if (address) info.push('<div><h2>' + spans({ he: 'איפה', en: 'Where' }) + '</h2><p>' + both(address) + '</p></div>');
  if (hours) info.push('<div><h2>' + spans({ he: 'מתי', en: 'When' }) + '</h2><p>' + (typeof hours === 'string' ? esc(hours) : both(hours)) + '</p></div>');
  if (phone) info.push('<div><h2>' + spans({ he: 'טלפון', en: 'Phone' }) + '</h2><p><a href="tel:' + esc(phone.replace(/[^\d+]/g, '')) + '"><bdi dir="ltr">' + esc(phone) + '</bdi></a></p></div>');

  const ld = jsonld(menu, { address, phone, url });
  const title = nameHe + (nameEn && nameEn !== nameHe ? ' · ' + nameEn : '') + ' · ' + t({ he: 'תפריט', en: 'Menu' }, 'he');
  const html = readFileSync(join(HERE, 'template.html'), 'utf8')
    .replaceAll('{{TITLE}}', esc(title))
    .replaceAll('{{DESCRIPTION}}', esc([t(b.cuisine, 'he'), t(address, 'he')].filter(Boolean).join(' · ') || nameHe))
    .replaceAll('{{TABLE}}', '#0b0907')
    .replaceAll('{{ACCENT}}', /^#[0-9a-f]{6}$/i.test(menu.theme && menu.theme.accent || '') ? menu.theme.accent : '#f5b120')
    .replaceAll('{{ROBOTS}}', index ? '' : '<meta name="robots" content="noindex">')
    .replaceAll('{{JSONLD}}', '<script type="application/ld+json">' + JSON.stringify(ld).replace(/</g, '\\u003c') + '</script>')
    .replaceAll('{{NAME_SPANS}}', both(b.name))
    .replaceAll('{{CUISINE_SPANS}}', b.cuisine ? both(b.cuisine) : '')
    .replaceAll('{{NAV}}', nav)
    .replaceAll('{{MENU_URL}}', esc(url))
    .replaceAll('{{BOOK_BTN}}', bookUrl ? '<a class="btn btn-glass" href="' + esc(bookUrl) + '">' + spans({ he: 'להזמין שולחן', en: 'Book a table' }) + '</a>' : '')
    .replaceAll('{{ORDER_BTN}}', orderUrl ? '<a class="btn btn-glass" href="' + esc(orderUrl) + '">' + spans({ he: 'להזמין משלוח', en: 'Order' }) + '</a>' : '')
    .replaceAll('{{DEMO_TAG}}', isDemo ? '<p class="demo-tag">' + spans({ he: LABEL.demoHe + ' · ' + LABEL.aiHe, en: LABEL.demoEn + ' · ' + LABEL.aiEn }) + '</p>' : '')
    .replaceAll('{{HERO_IMG}}', heroImg ? '<img src="' + esc(heroImg) + '" width="1024" height="1024" alt="' + esc(first ? t(first.name, 'he') : '') + '" fetchpriority="high">' : '')
    .replaceAll('{{HERO_CAPTION}}', first ? both(first.name) + ' · <bdi dir="ltr">' + price(first.price.amount) + '</bdi>' + (isDemo && first.asset ? ' · ' + spans({ he: LABEL.aiHe, en: LABEL.aiEn }) : '') : '')
    .replaceAll('{{MENU}}', menuHtml)
    .replaceAll('{{INFO}}', info.length ? '<div class="info"><div class="wrap">' + info.join('') + '</div></div>' : '<div class="info"><div class="wrap"></div></div>')
    .replaceAll('{{DEMO_FOOT}}', isDemo ? ' · ' + spans({ he: LABEL.demoHe, en: LABEL.demoEn }) : '');
  return { html, files };
}

function dish(it, pic) {
  const sold = it.available === false, thumb = it.asset && it.asset.thumb ? pic(it.asset.thumb) : null, note = it.price && it.price.note;
  const meta = [];
  const al = it.allergens && (t(it.allergens, 'he') || t(it.allergens, 'en')); if (al) meta.push('<span class="allergens">' + spans({ he: 'אלרגנים: ' + t(it.allergens, 'he'), en: 'Allergens: ' + t(it.allergens, 'en') }) + '</span>');
  for (const tag of it.tags || []) if (TAGS[tag]) meta.push('<span class="tag">' + spans(TAGS[tag]) + '</span>');
  const d = it.details || {}, extra = d.wine ? [d.wine.producer, d.wine.name, d.wine.vintage, t(d.wine.region, 'he') || null].filter(Boolean) : d.beer ? [d.beer.brewery, d.beer.style, d.beer.abv].filter(Boolean) : [];
  return '<article class="dish' + (sold ? ' sold' : '') + '" id="d-' + esc(it.id) + '">' +
    (thumb ? '<img class="thumb" src="' + esc(thumb) + '" width="64" height="64" alt="" loading="lazy" decoding="async">' : '<i class="no-thumb" aria-hidden="true"></i>') +
    '<div><h3>' + both(it.name) + (sold ? '<span class="badge">' + spans({ he: 'אזל', en: 'Sold out' }) + '</span>' : '') + '</h3>' +
    (it.desc && (t(it.desc, 'he') || t(it.desc, 'en')) ? '<p>' + both(it.desc) + '</p>' : '') +
    (extra.length ? '<p>' + esc(extra.join(' · ')) + '</p>' : '') +
    (meta.length ? '<div class="meta">' + meta.join('') + '</div>' : '') + '</div>' +
    '<div class="price"><bdi dir="ltr">' + price(it.price.amount) + '</bdi>' + (note && (t(note, 'he') || t(note, 'en')) ? '<small>' + both(note) + '</small>' : '') + '</div></article>';
}

/** schema.org Restaurant + Menu, only from what the snapshot says. Hebrew names, English as alternateName. */
export function jsonld(menu, { address, phone, url }) {
  const b = menu.business, alt = (v) => { const en = t(v, 'en'); return en && en !== t(v, 'he') ? { alternateName: en } : {}; };
  const r = { '@context': 'https://schema.org', '@type': 'Restaurant', name: t(b.name, 'he'), ...alt(b.name), inLanguage: ['he', 'en'] };
  if (b.cuisine) r.servesCuisine = t(b.cuisine, 'he');
  if (address) r.address = typeof address === 'string' ? address : { '@type': 'PostalAddress', streetAddress: t(address, 'he') };
  if (phone) r.telephone = phone;
  if (https(b.bookUrl)) r.acceptsReservations = b.bookUrl;
  r.hasMenu = { '@type': 'Menu', name: t({ he: 'תפריט', en: 'Menu' }, 'he'), url, inLanguage: 'he',
    hasMenuSection: menu.categories.map((c) => ({ '@type': 'MenuSection', name: t(c.name, 'he'), ...alt(c.name),
      hasMenuItem: (c.items || []).map((it) => { const m = { '@type': 'MenuItem', name: t(it.name, 'he'), ...alt(it.name) };
        if (it.desc && t(it.desc, 'he')) m.description = t(it.desc, 'he');
        if (it.price && Number.isInteger(it.price.amount)) m.offers = { '@type': 'Offer', price: (it.price.amount / 100).toFixed(2), priceCurrency: 'ILS', availability: it.available === false ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock' };
        return m; }) })) };
  return r;
}

export function build(menuPath, outDir, opts = {}) {
  const menu = JSON.parse(readFileSync(menuPath, 'utf8')), base = dirname(resolve(menuPath));
  const { html, files } = render(menu, { ...opts, base });
  mkdirSync(join(outDir, 'img'), { recursive: true });
  const copied = new Set();
  for (const [from, to] of files) { if (copied.has(to)) continue; copied.add(to); if (existsSync(from)) copyFileSync(from, join(outDir, to)); else console.warn('· missing picture ' + from); }
  writeFileSync(join(outDir, 'index.html'), html);
  return { out: join(outDir, 'index.html'), bytes: Buffer.byteLength(html), pictures: copied.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i < 0 ? null : args.splice(i, 2)[1]; }, flag = (k) => { const i = args.indexOf(k); return i < 0 ? false : (args.splice(i, 1), true); };
  const menuUrl = opt('--menu'), demo = flag('--demo') || undefined, index = flag('--index');
  if (args.length < 2) { console.error('usage: node site-kit/build.mjs <menu.json> <outdir> [--menu <url>] [--demo] [--index]'); process.exit(2); }
  const r = build(resolve(args[0]), resolve(args[1]), { menuUrl, demo, index });
  console.log('✓ ' + r.out + ' (' + (r.bytes / 1024).toFixed(1) + ' kB, ' + r.pictures + ' pictures)');
}
