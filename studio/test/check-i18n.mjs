// Every t('key') used in the sources must exist in the dictionary, in both languages.
import fs from 'node:fs'; import path from 'node:path';
const root = new URL('../src/', import.meta.url).pathname;
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && files.push(p); } })(root);
const dict = fs.readFileSync(path.join(root, 'lib/i18n.ts'), 'utf8');
const keys = new Set([...dict.matchAll(/^\s*'([a-zA-Z0-9_.]+)':\s*\[/gm)].map((m) => m[1]));
let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt[n]?\('([a-zA-Z0-9_.]+)'\s*[,)]/g)) if (!keys.has(m[1])) { console.log('missing', m[1], 'in', path.relative(root, f)); bad++; }
  for (const m of src.matchAll(/\bt\('([a-zA-Z0-9_.]+\.)'\s*\+/g)) if (![...keys].some((k) => k.startsWith(m[1]))) { console.log('no keys with prefix', m[1], 'in', path.relative(root, f)); bad++; }
}
for (const m of dict.matchAll(/^\s*'([a-zA-Z0-9_.]+)':\s*\[\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\s*\]/gm)) if (!m[2].trim() || !m[3].trim()) { console.log('empty text', m[1]); bad++; }
console.log(keys.size, 'keys;', bad, 'problems'); process.exit(bad ? 1 : 0);
