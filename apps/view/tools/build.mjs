/* Bundles src/ into the static files the host serves: app.js (text, navigation; small, loads first) and chunks/stage-*.js
   (three.js r128 + the table; loaded only after the menu text is on screen). Run: npm run build */
import { build } from 'esbuild';
import { rmSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
rmSync(join(root, 'chunks'), { recursive: true, force: true });
const common = { outdir: root, bundle: true, format: 'esm', splitting: true, minify: !process.argv.includes('--dev'),
  sourcemap: false, target: ['es2019'], chunkNames: 'chunks/[name]-[hash]', legalComments: 'inline', metafile: true, logLevel: 'info' };
/* Two builds, so the guest menu keeps three.js inside its stage chunk (one request before the table, as before the seat
   map existed). The seat map is its own build: its 3D room carries its own copy of three.js, loaded only when a guest
   taps "3D" in a demo. */
const res = await build({ ...common, entryPoints: { app: join(root, 'src/main.js') } });
const seat = await build({ ...common, entryPoints: { seat: join(root, 'src/seat/main.js') }, chunkNames: 'chunks/seat-[name]-[hash]' });   /* night:seating */
/* timers */ const host = await build({ ...common, entryPoints: { host: join(root, 'src/host/main.js') }, chunkNames: 'chunks/host-[name]-[hash]' });   /* the host board: table clocks (view/host/) */ /* /timers */
/* lima: Café Lima's place system (view/floor/): the board and the guest's phone share one build, so three.js and the 3D
   place sit in one chunk, loaded only when the stage goes 3D (?gl=off never loads it) */
const floor = await build({ ...common, entryPoints: { floor: join(root, 'src/floor/board.js'), 'floor-guest': join(root, 'src/floor/guest.js') }, chunkNames: 'chunks/floor-[name]-[hash]' });
/* schema 2: the guest menu on the clean schema (src/v2/, with @mana/contracts) is a build of its own, v2.js, which
   main.js loads by address only for such a menu: app.js shares no chunk with it, so a v1 menu fetches exactly what it did */
const v2 = await build({ ...common, entryPoints: { v2: join(root, 'src/v2/guest.js') }, chunkNames: 'chunks/v2-[name]-[hash]' });
for (const f of [...Object.keys(res.metafile.outputs), ...Object.keys(seat.metafile.outputs), /* timers */ ...Object.keys(host.metafile.outputs) /* /timers */, ...Object.keys(floor.metafile.outputs), ...Object.keys(v2.metafile.outputs)]) console.log(f.replace(root + '/', ''), statSync(f).size);
