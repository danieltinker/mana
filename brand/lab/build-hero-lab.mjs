/* Builds the hero lab (brand/lab/hero-lab.js + src/land/hero-morph.js) into brand/.scratch/lab/ (ignored), with the same
   esbuild settings as tools/build-land.mjs.   node brand/lab/build-hero-lab.mjs [--dev] */
import { createRequire } from 'node:module';
import { rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BRAND = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIEW_NM = join(BRAND, '..', 'apps', 'view', 'node_modules');
const { build } = createRequire(join(VIEW_NM, 'x.js'))('esbuild');
const out = join(BRAND, '.scratch', 'lab');
rmSync(out, { recursive: true, force: true });
const res = await build({
  entryPoints: { 'hero-lab': join(BRAND, 'lab', 'hero-lab.js') }, outdir: out, bundle: true, format: 'esm', splitting: true,
  minify: !process.argv.includes('--dev'), sourcemap: false, target: ['es2019'], chunkNames: 'chunks/[name]-[hash]',
  legalComments: 'inline', metafile: true, logLevel: 'warning', nodePaths: [VIEW_NM], supported: { 'top-level-await': true }
});
for (const f of Object.keys(res.metafile.outputs)) console.log('  ' + f.replace(BRAND + '/', ''), statSync(f).size);
