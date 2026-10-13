/* Contact sheet of lab screenshots: centre crops in a grid, each with a caption.
     node brand/lab/sheet-hero.mjs <out.jpg> <cols> <cell px> <file[=caption]>...   (1440-wide shots are cropped to the stage) */
import { createRequire } from 'node:module';
import { basename } from 'node:path';
const require = createRequire('/opt/npm-tools/node_modules/');
const sharp = require('sharp');
const [out, colsArg, cellArg, ...files] = process.argv.slice(2);
const cols = +colsArg, cell = +cellArg, capH = 26, rows = Math.ceil(files.length / cols);
const tiles = [];
for (let k = 0; k < files.length; k++) {
  const [f, cap = basename(f, '.png')] = files[k].split('=');
  const img = sharp(f), m = await img.metadata();
  const s = Math.min(m.width, m.height, m.width > 1000 ? 780 : m.width);
  const left = Math.round((m.width - s) / 2), top = Math.round((m.height - s) / 2);
  const buf = await sharp(f).extract({ left, top, width: s, height: s }).resize(cell, cell).png().toBuffer();
  const x = (k % cols) * cell, y = Math.floor(k / cols) * (cell + capH);
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cell}" height="${capH}"><rect width="100%" height="100%" fill="#F7F4EE"/><text x="10" y="18" font-family="sans-serif" font-size="13" fill="#4A433C">${cap.replace(/&/g, '&amp;')}</text></svg>`);
  tiles.push({ input: buf, left: x, top: y }, { input: svg, left: x, top: y + cell });
}
await sharp({ create: { width: cols * cell, height: rows * (cell + capH), channels: 3, background: '#F7F4EE' } }).composite(tiles).jpeg({ quality: 86 }).toFile(out);
console.log(out);
