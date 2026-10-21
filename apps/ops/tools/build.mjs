// Builds src/ → dist/ (a static folder: index.html, app.js, app.css, fonts/, and the v2 bundle v2.js, v2.css).
// No CDN, no runtime build step. app.js is the entry (src/entry.js) with the v1 back office in it; it fetches v2.js only
// when the config says schema 2 (ADR-007), so v2 is a bundle of its own and production never loads it.
import { build } from 'esbuild';
import { cp, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'fonts'), { recursive: true });

import { JS as js } from './esbuild-options.mjs';
await build({ ...js, entryPoints: [path.join(root, 'src/entry.js')], outfile: path.join(dist, 'app.js') });
await build({ ...js, entryPoints: [path.join(root, 'src/v2/main.tsx')], outfile: path.join(dist, 'v2.js') });
const css = { bundle: true, minify: true, external: ['*.woff2'], logLevel: 'warning' };
await build({ ...css, entryPoints: [path.join(root, 'src/styles.css')], outfile: path.join(dist, 'app.css') });
await build({ ...css, entryPoints: [path.join(root, 'src/v2/styles.css')], outfile: path.join(dist, 'v2.css') });
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
