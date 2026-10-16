// Builds src/ → dist/ (a static folder: index.html, app.js, app.css, fonts/). No CDN, no runtime build step.
import { build } from 'esbuild';
import { cp, mkdir, rm, readdir, stat, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'fonts'), { recursive: true });

await build({
  entryPoints: [path.join(root, 'src/main.jsx')],
  outfile: path.join(dist, 'app.js'),
  bundle: true, format: 'esm', target: ['es2020'], minify: true, legalComments: 'none',
  jsx: 'automatic', jsxImportSource: 'preact',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
});
await build({
  entryPoints: [path.join(root, 'src/styles.css')],
  outfile: path.join(dist, 'app.css'),
  bundle: true, minify: true, external: ['*.woff2'], logLevel: 'warning',
});
const fontDir = path.join(root, 'node_modules/@fontsource/ibm-plex-sans-hebrew');
for (const sub of ['hebrew', 'latin']) for (const w of [400, 500, 600]) {
  const f = `ibm-plex-sans-hebrew-${sub}-${w}-normal.woff2`;
  await cp(path.join(fontDir, 'files', f), path.join(dist, 'fonts', f));
}
await cp(path.join(fontDir, 'LICENSE'), path.join(dist, 'fonts', 'OFL-ibm-plex-sans-hebrew.txt'));
await cp(path.join(root, 'src/index.html'), path.join(dist, 'index.html'));

let total = 0; const lines = [];
async function walk(dir) {
  for (const n of (await readdir(dir)).sort()) {
    const p = path.join(dir, n); const s = await stat(p);
    if (s.isDirectory()) await walk(p); else { total += s.size; lines.push(`${String(s.size).padStart(8)}  ${path.relative(dist, p)}`); }
  }
}
await walk(dist);
console.log(lines.join('\n') + `\n${String(total).padStart(8)}  total`);
