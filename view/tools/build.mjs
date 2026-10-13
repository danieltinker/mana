/* Bundles src/ into the static files the host serves: app.js (text, navigation; small, loads first) and chunks/stage-*.js
   (three.js r128 + the table; loaded only after the menu text is on screen). Run: npm run build */
import { build } from 'esbuild';
import { rmSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
rmSync(join(root, 'chunks'), { recursive: true, force: true });
const res = await build({
  entryPoints: { app: join(root, 'src/main.js'), /* night:seating */ seat: join(root, 'src/seat/main.js') /* /night:seating */ }, outdir: root, bundle: true, format: 'esm', splitting: true, minify: !process.argv.includes('--dev'),
  sourcemap: false, target: ['es2019'], chunkNames: 'chunks/[name]-[hash]', legalComments: 'inline', metafile: true, logLevel: 'info'
});
for (const f of Object.keys(res.metafile.outputs)) console.log(f.replace(root + '/', ''), statSync(f).size);
