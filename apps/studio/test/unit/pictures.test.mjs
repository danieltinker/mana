// What a chosen file really is, told from its first bytes (src/lib/images.ts → sniff). Phones hand over photos with no type,
// with "application/octet-stream" or under the wrong name, and an iPhone HEIC photo needs its own sentence where the browser
// cannot open it. The decoding itself needs a browser: see test/e2e/c-failures.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.window ??= {};                       // lib/api.ts reads its settings from window when it is loaded
const { sniff } = await import('../../src/lib/images.ts');

const bytes = (...parts) => new Blob(parts.map((p) => (typeof p === 'string' ? new TextEncoder().encode(p) : new Uint8Array(p))));
const box = (major, ...compat) => bytes([0, 0, 0, 16 + 4 * compat.length], 'ftyp' + major, [0, 0, 0, 0], compat.join(''), new Array(64).fill(7));

test('a file is told by its first bytes, whatever it is called', async () => {
  assert.equal(await sniff(bytes([0xff, 0xd8, 0xff, 0xe0, 0, 16], 'JFIF')), 'jpeg');
  assert.equal(await sniff(bytes([0xff, 0xd8, 0xff, 0xe1, 0x2a, 0x10], 'Exif')), 'jpeg');
  assert.equal(await sniff(bytes([0x89], 'PNG\r\n', [0x1a, 0x0a])), 'png');
  assert.equal(await sniff(bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 ')), 'webp');
  assert.equal(await sniff(bytes('GIF89a')), 'gif');
  assert.equal(await sniff(bytes('BM', new Array(30).fill(0))), 'bmp');
  assert.equal(await sniff(bytes('II*', [0], new Array(8).fill(0))), 'tiff');
  // the iPhone's photo formats and AVIF share one container: the brands decide
  assert.equal(await sniff(box('heic', 'mif1', 'MiHB', 'heic')), 'heic');
  assert.equal(await sniff(box('heix', 'mif1', 'heix')), 'heic');
  assert.equal(await sniff(box('mif1', 'mif1', 'heic', 'hevc')), 'heic');
  assert.equal(await sniff(box('msf1', 'hevc')), 'heic');
  assert.equal(await sniff(box('avif', 'mif1', 'miaf')), 'avif');
  assert.equal(await sniff(box('mif1', 'avif', 'miaf')), 'avif');
  // not pictures: a video, a PDF, text, nothing
  assert.equal(await sniff(box('mp42', 'isom', 'mp42')), '');
  assert.equal(await sniff(box('qt  ')), '');
  assert.equal(await sniff(bytes('%PDF-1.7')), '');
  assert.equal(await sniff(bytes('this is not a picture')), '');
  assert.equal(await sniff(bytes()), '');
  assert.equal(await sniff(bytes([0xff, 0xd8])), '');
});
