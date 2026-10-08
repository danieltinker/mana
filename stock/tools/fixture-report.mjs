#!/usr/bin/env node
/* Runs the matcher over tools/fixture.json and prints the hit rate and every row it gets wrong.
   node tools/fixture-report.mjs [--catalog]   (--catalog: use the words in tools/catalog.json instead of stock.json) */
import fs from 'node:fs';
import { explainStock } from '../match.js';
const here = (p) => new URL(p, import.meta.url);
let manifest = JSON.parse(fs.readFileSync(here('../stock.json'), 'utf8'));
if (process.argv.includes('--catalog')) {
  const c = JSON.parse(fs.readFileSync(here('./catalog.json'), 'utf8'));
  manifest = { items: c.entries.map((e) => ({ id: e.id, group: e.group, name: { he: e.he, en: e.en }, keys: e.keys, cat: !!e.cat, not: e.not })) };
}
export function run(manifest) {
  const { rows } = JSON.parse(fs.readFileSync(here('./fixture.json'), 'utf8'));
  const out = { rows: rows.length, right: 0, wrong: [], missed: [], spurious: [] };
  for (const [he, en, che, cen, want] of rows) {
    const x = explainStock(manifest, { name_he: he, name_en: en, category_he: che, category_en: cen }), got = x ? x.id : null;
    if (got === want) { out.right++; continue; }
    const row = { name: [he, en].filter(Boolean).join(' / '), category: [che, cen].filter(Boolean).join(' / '), want, got, via: x ? x.via + ':' + x.key : '' };
    (want === null ? out.spurious : got === null ? out.missed : out.wrong).push(row);
  }
  return out;
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const r = run(manifest), pct = (n) => (100 * n / r.rows).toFixed(1) + '%';
  console.log(`${r.rows} names · ${r.right} as expected (${pct(r.right)}) · wrong picture ${r.wrong.length + r.spurious.length} · picture missed ${r.missed.length}`);
  const show = (title, list) => { if (list.length) { console.log('\n' + title); for (const x of list) console.log(`  ${x.name}  [${x.category}]  expected ${x.want}, got ${x.got}${x.via ? ' (' + x.via + ')' : ''}`); } };
  show('A different picture than expected:', r.wrong); show('A picture where none was expected:', r.spurious); show('No picture where one was expected:', r.missed);
}
