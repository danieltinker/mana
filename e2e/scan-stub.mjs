// The scanner for browser tests, on the local stack, which runs neither Storage nor edge functions: the real `menus-ai`
// handler (supabase/functions/menus-ai/handler.ts) runs here in Node, against the stack's own PostgREST (the claim with
// the owner's token, the draft saved with the service role, a failure marked), with two stand-ins:
// - the pictures the owner app uploads to `menu-private` are held in memory (the browser's uploads are intercepted), and
//   the handler reads them back from there;
// - the paid model call never leaves this process: it answers a recorded reply (synthetic JSON Lines, as the model
//   answers), so nothing is paid and nothing reaches the network.
// No test calls the live scanner (CLAUDE.md, ADR-006).
//
//   const stub = scanStub(e.stack, { reply: CAFE_SCREENSHOTS });
//   await stub.attach(page);                 // before the page loads: config with features.scan, storage, the function
import { handle } from '../supabase/functions/menus-ai/handler.ts';

const MODEL_URL = 'https://api.anthropic.com/';
const STORAGE_GET = /^\/storage\/v1\/object\/(?:authenticated\/)?menu-private\/(.+)$/;
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-upsert, cache-control',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
};

/**
 * @param {{ apiUrl: string, anonKey: string, serviceKey: string }} stack
 * @param {{ reply: string, configured?: boolean }} o  `configured` false: the function answers `not_configured`.
 */
export function scanStub(stack, { reply, configured = true }) {
  /** @type {Map<string, { bytes: Uint8Array, type: string }>} */
  const files = new Map();
  const seen = { model: 0, scans: 0, uploads: 0 };
  const deps = {
    env: { url: stack.apiUrl, anonKey: stack.anonKey, serviceKey: stack.serviceKey, anthropicKey: configured ? 'stub-not-a-key' : '', workspaceId: '', model: 'stub-model' },
    fetch: async (input, init = {}) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.startsWith(MODEL_URL)) {
        seen.model++;
        return Response.json({ content: [{ type: 'text', text: reply }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } });
      }
      const u = new URL(url);
      const m = STORAGE_GET.exec(u.pathname);
      if (m && (init.method ?? 'GET') === 'GET') {
        const f = files.get(decodeURIComponent(m[1]));
        return f ? new Response(f.bytes, { status: 200, headers: { 'content-type': f.type, 'content-length': String(f.bytes.length) } })
          : Response.json({ statusCode: '404', error: 'not_found' }, { status: 400 });
      }
      return fetch(input, init);                          // the stack's own PostgREST
    },
    now: () => Date.now(),
    log: () => {},
  };

  /** The page sees a scanner: the config offers it, uploads land in memory, the function is the real handler. */
  async function attach(page) {
    await page.route('**/config.js', async (route) => {
      const res = await route.fetch();
      // the config is JavaScript (tools/env.mjs localConfigText: `scan: false`), or JSON in older harnesses (`"scan": false`)
      const body = (await res.text()).replace(/("?scan"?\s*:\s*)false/, '$1true');
      await route.fulfill({ status: 200, contentType: 'text/javascript', body });
    });
    await page.route('**/storage/v1/object/menu-private/**', async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: '' });
      const path = decodeURIComponent(new URL(req.url()).pathname.replace(/^.*\/storage\/v1\/object\/menu-private\//, ''));
      // storage-js sends a Blob as multipart form data, its file under the empty name
      const type = req.headers()['content-type'] || 'application/octet-stream';
      const raw = req.postDataBuffer() ?? Buffer.alloc(0);
      let bytes = new Uint8Array(raw), fileType = type;
      if (type.startsWith('multipart/form-data')) {
        const form = await new Request('http://stub.invalid/', { method: 'POST', headers: { 'content-type': type }, body: raw }).formData();
        const file = [...form.values()].find((v) => typeof v === 'object');
        if (file) { bytes = new Uint8Array(await file.arrayBuffer()); fileType = file.type; }
      }
      if (files.has(path)) return route.fulfill({ status: 400, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }) });
      files.set(path, { bytes, type: fileType });
      seen.uploads++;
      await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ Key: 'menu-private/' + path, Id: path }) });
    });
    await page.route('**/functions/v1/menus-ai', async (route) => {
      const req = route.request();
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS, body: 'ok' });
      const body = req.postData() ?? '';
      if (/"scan_menu"|"wolt_screenshots"/.test(body)) seen.scans++;
      const res = await handle(new Request('http://stub.invalid/functions/v1/menus-ai', { method: 'POST', headers: req.headers(), body }), deps);
      await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
    });
  }
  return { attach, files, seen };
}

/**
 * SYNTHETIC: what the model would answer for two screenshots of the invented café's own page (the same café as
 * fixtures/wolt-text-cafe.mjs), as JSON Lines in the scanner's format (packages/import/src/scan.ts). Written by hand.
 */
export const CAFE_SCREENSHOTS = [
  '{"lang":"en"}',
  '{"c":{"he":"","en":"Breakfast"},"k":"food"}',
  '{"n":{"he":"","en":"Schnitzel plate"},"d":{"he":"","en":"Crispy chicken, side of choice"},"p":"₪62.00"}',
  '{"g":{"he":"","en":"Side of choice"},"r":"Required · Choose 1","m":"single"}',
  '{"o":{"he":"","en":"Fries"}}',
  '{"o":{"he":"","en":"Salad"}}',
  '{"g":{"he":"","en":"Choose a sauce"},"r":"Optional","m":"multiple","u":"Fries"}',
  '{"o":{"he":"","en":"Aioli"},"p":"+₪3.00"}',
  '{"o":{"he":"","en":"Ketchup"}}',
  '{"c":{"he":"","en":"Coffee"},"k":"drinks"}',
  '{"n":{"he":"","en":"Espresso"},"d":{"he":"","en":""},"p":"₪12.00"}',
].join('\n');

/** A 1 × 1 PNG: a picture the owner app can open, send and the handler accepts (the model's reply is recorded). */
export const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==', 'base64');
