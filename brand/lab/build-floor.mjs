/* Builds the floor's lab (brand/lab/floor-lab.js → brand/.scratch/lab/, ignored by git) with the settings of
   brand/tools/build-land.mjs: esbuild and three.js r128 from view/node_modules, ESM, splitting, minified, es2019.
     node brand/lab/build-floor.mjs [--dev]                                                                          */
import { createRequire } from 'node:module';
import { rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BRAND = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIEW_NM = join(BRAND, '..', 'view', 'node_modules');
const { build } = createRequire(join(VIEW_NM, 'x.js'))('esbuild');
const out = join(BRAND, '.scratch', 'lab');
rmSync(out, { recursive: true, force: true });
const res = await build({
  entryPoints: { 'floor-lab': join(BRAND, 'lab', 'floor-lab.js') }, outdir: out, bundle: true, format: 'esm', splitting: true,
  minify: !process.argv.includes('--dev'), sourcemap: false, target: ['es2019'], chunkNames: 'chunks/[name]-[hash]',
  legalComments: 'inline', metafile: true, logLevel: 'warning', nodePaths: [VIEW_NM]
});
for (const f of Object.keys(res.metafile.outputs)) console.log('  ' + f.replace(BRAND + '/', ''), statSync(f).size);
