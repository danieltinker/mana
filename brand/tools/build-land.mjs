/* Bundles the product page's scripts (brand/src/land/) into brand/site/land/: main.js (small: language, reveals, the demo
   dialog, the form; loads first) and chunks that load only when they are needed: the shape-shifting dish (three.js + the
   dish meshes' decoder) after the page has painted, the floating floor when its section comes near.
   brand/site/land/ is build output (ignored by git); tools/build-site.sh runs this before it copies brand/site.
   esbuild and three.js come from view/node_modules (the guest menu's own copies, r128), so nothing new is installed.
     node brand/tools/build-land.mjs          build (minified)
     node brand/tools/build-land.mjs --dev    readable output                                                          */
import { createRequire } from 'node:module';
import { rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BRAND = join(dirname(fileURLToPath(import.meta.url)), '..');
const VIEW_NM = join(BRAND, '..', 'view', 'node_modules');
const { build } = createRequire(join(VIEW_NM, 'x.js'))('esbuild');
const out = join(BRAND, 'site', 'land');
rmSync(out, { recursive: true, force: true });
const res = await build({
  entryPoints: { main: join(BRAND, 'src', 'land', 'main.js') }, outdir: out, bundle: true, format: 'esm', splitting: true,
  minify: !process.argv.includes('--dev'), sourcemap: false, target: ['es2019'], chunkNames: 'chunks/[name]-[hash]',
  legalComments: 'inline', metafile: true, logLevel: 'warning', nodePaths: [VIEW_NM]
});
for (const f of Object.keys(res.metafile.outputs)) console.log('  ' + f.replace(BRAND + '/', ''), statSync(f).size);
