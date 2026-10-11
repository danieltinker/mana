// The edge function `menus-ai` (../../../functions/menus-ai/index.ts), run here as it is written, with the two things it
// talks to replaced: the allowance call (always "yes") and the model's API (a canned answer per test). Nothing leaves this
// machine. The point: a refusal from the API must reach the owner as what it is, and only a refusal ABOUT the picture may
// say "this is not a picture" (11 Oct 2026: a key without a workspace made every scan say that).
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = process.env.MENUS_AI_SRC || fileURLToPath(new URL('../../../functions/menus-ai/index.ts', import.meta.url));
const API = 'https://api.anthropic.com/v1/messages';
const BIZ = '24beb582-1be7-4828-88d6-d228e3cd3086';
const env = { ANTHROPIC_API_KEY: 'sk-test', SUPABASE_URL: 'http://supabase.test' };
const calls = [];
let handler, upstream, tmp;
const realFetch = globalThis.fetch, realError = console.error, realLog = console.log;
const logged = [];

before(async () => {
  // the file imports Deno's type declarations from jsr: and calls Deno.serve; everything else is plain web-standard code
  tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'menus-ai-')), 'index.ts');
  fs.writeFileSync(tmp, fs.readFileSync(SRC, 'utf8').replace(/^import "jsr:[^\n]*\n/m, ''));
  globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/rest/v1/rpc/ai_take')) return new Response(JSON.stringify({ ok: true, used: 1, limit: 12 }), { headers: { 'content-type': 'application/json' } });
    if (String(url) === API) return upstream(init);
    throw new Error('unexpected request to ' + url);
  };
  console.error = (...a) => logged.push(a.map(String).join(' '));
  console.log = (...a) => logged.push(a.map(String).join(' '));
  await import(pathToFileURL(tmp).href);
  assert.equal(typeof handler, 'function', 'the function registered its handler');
});
after(() => { globalThis.fetch = realFetch; console.error = realError; console.log = realLog; delete globalThis.Deno; fs.rmSync(path.dirname(tmp), { recursive: true, force: true }); });

const picture = { media_type: 'image/jpeg', data: '/9j/' + 'A'.repeat(4000) };
const post = (body) => handler(new Request('http://fn.test/menus-ai', { method: 'POST', headers: { authorization: 'Bearer owner-token', apikey: 'publishable', 'content-type': 'application/json' }, body: JSON.stringify(body) }));
async function scan(image = picture) {
  calls.length = 0; logged.length = 0;
  const r = await post({ action: 'scan_menu', business_id: BIZ, image, langs: ['he', 'en'] });
  const lines = (await r.text()).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return { status: r.status, type: r.headers.get('content-type'), lines, last: lines[lines.length - 1] };
}
const refuse = (status, type, message) => () => new Response(JSON.stringify({ type: 'error', error: { type, message }, request_id: 'req_test' }), { status, headers: { 'content-type': 'application/json' } });
const sse = (events) => () => new Response(events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
const text = (t) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text: t } });

// the exact answer in the function's log of 11 Oct 2026, 07:04:38 and 07:04:49 UTC
const WORKSPACE_400 = 'This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use. Add the header, or use an API key that is scoped to a workspace.';

test('a key without a workspace is our fault, not the picture\'s', async () => {
  upstream = refuse(400, 'invalid_request_error', WORKSPACE_400);
  const r = await scan();
  assert.equal(r.type, 'application/x-ndjson; charset=utf-8');
  assert.deepEqual(r.lines, [{ t: 'start' }, { t: 'error', code: 'bad_key', upstream: 400, kind: 'invalid_request_error' }]);
  assert.ok(logged.some((l) => l.includes('anthropic scan 400') && l.includes('bad_key') && l.includes('not scoped to a workspace')), 'the log keeps the status, the code and the API\'s own words');
  assert.ok(logged.some((l) => l.includes('"error":"bad_key"')), 'the summary line names the code too');
});

test('every refusal of the API gets the code that fits it', async () => {
  // The first message is quoted from Anthropic's authentication page. The others are representative wordings, not quotations:
  // the function looks for words (workspace, credit, image, exceeds…), never for a whole sentence.
  const cases = [
    [400, 'invalid_request_error', 'anthropic-workspace-id is required when authenticating with an identity-linked API key; send the id of the workspace this request acts in.', 'bad_key'],
    [400, 'invalid_request_error', 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.', 'bad_key'],
    [400, 'invalid_request_error', 'You have reached your specified API usage limits. You will regain access on 2026-11-01 at 00:00 UTC.', 'bad_key'],
    [401, 'authentication_error', 'invalid x-api-key', 'bad_key'],
    [402, 'billing_error', 'There is an issue with your billing or payment information.', 'bad_key'],
    [403, 'permission_error', 'Your API key does not have permission to use the specified resource.', 'bad_key'],
    [400, 'invalid_request_error', 'Could not process image', 'bad_image'],
    [400, 'invalid_request_error', 'messages.0.content.0.image.source.base64.data: Image does not match the provided media type image/jpeg', 'bad_image'],
    [400, 'invalid_request_error', 'messages.0.content.0.image.source.base64: invalid base64 data', 'bad_image'],
    [400, 'invalid_request_error', 'messages.0.content.0.image.source.base64: image exceeds 10 MB maximum: 11534336 bytes > 10485760 bytes', 'too_big'],
    [400, 'invalid_request_error', 'messages.0.content.0.image.source.base64.data: At most 8000 pixels are allowed per image dimension', 'too_big'],
    [413, 'request_too_large', 'Request exceeds the maximum allowed number of bytes.', 'too_big'],
    [400, 'invalid_request_error', 'max_tokens: 16000 > 8192, which is the maximum allowed number of output tokens for this model', 'upstream'],
    [400, 'invalid_request_error', 'prompt is too long: 250000 tokens > 200000 maximum', 'upstream'],
    [404, 'not_found_error', 'model: claude-sonnet-0-0', 'upstream'],
    [429, 'rate_limit_error', 'This request would exceed your organization\'s rate limit', 'busy'],
    [529, 'overloaded_error', 'Overloaded', 'busy'],
    [500, 'api_error', 'Internal server error', 'upstream'],
  ];
  for (const [status, type, message, code] of cases) {
    upstream = refuse(status, type, message);
    const r = await scan();
    assert.deepEqual(r.last, { t: 'error', code, upstream: status, kind: type }, `${status} ${message}`);
  }
  // a gateway page instead of JSON
  upstream = () => new Response('<html>502 Bad Gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } });
  assert.deepEqual((await scan()).last, { t: 'error', code: 'upstream', upstream: 502, kind: '' });
  // the connection to the API fails
  upstream = () => { throw new TypeError('error sending request'); };
  assert.deepEqual((await scan()).last, { t: 'error', code: 'upstream' });
});

test('the workspace is named only when the secret ANTHROPIC_WORKSPACE_ID is set', async () => {
  upstream = sse([text('{"lang":"he"}\n{"c":{"he":"ראשונות","en":"Starters"},"k":"food"}\n{"n":{"he":"חומוס","en":"Hummus"},"d":{"he":"","en":""},"p":32}\n'), { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 40 } }]);
  let r = await scan();
  let sent = calls.find((c) => c.url === API).init.headers;
  assert.equal(sent['x-api-key'], 'sk-test'); assert.equal(sent['anthropic-version'], '2023-06-01');
  assert.equal('anthropic-workspace-id' in sent, false);
  assert.deepEqual(r.lines.map((l) => l.t), ['start', 'lang', 'cat', 'item', 'done']);
  assert.deepEqual(r.lines[3], { t: 'item', he: 'חומוס', en: 'Hummus', dhe: '', den: '', price_minor: 3200, note_he: '', note_en: '', tags: [], stock: null });
  env.ANTHROPIC_WORKSPACE_ID = ' wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ ';
  try {
    r = await scan();
    sent = calls.find((c) => c.url === API).init.headers;
    assert.equal(sent['anthropic-workspace-id'], 'wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ');
    assert.equal(r.last.t, 'done');
    const body = JSON.parse(calls.find((c) => c.url === API).init.body);
    assert.deepEqual(body.messages[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: picture.data } });
  } finally { delete env.ANTHROPIC_WORKSPACE_ID; }
});

test('a request the function itself refuses never reaches the API or the allowance, and leaves a line in the log', async () => {
  upstream = () => { throw new Error('must not be called'); };
  for (const [image, code] of [[{ media_type: 'image/heic', data: picture.data }, 'bad_image'], [{ media_type: 'image/jpeg', data: 'short' }, 'bad_image'], [{ media_type: 'image/jpeg', data: 'A'.repeat(3_600_001) }, 'too_big'],
    [{ media_type: 'image/jpeg', data: 'data:image/jpeg;base64,' + 'A'.repeat(500) }, 'bad_image'], [null, 'bad_image']]) {
    const r = await scan(image);
    assert.deepEqual(r.lines, [{ t: 'error', code }]);
    assert.equal(calls.length, 0, 'nothing was asked of anyone');
    assert.ok(logged.some((l) => l.includes(`"refused":"${code}"`)), 'logged: ' + code);
  }
});

test('"suggest from the photo" words a refusal the same way', async () => {
  upstream = refuse(400, 'invalid_request_error', WORKSPACE_400);
  const r = await post({ action: 'describe_dish', business_id: BIZ, image: picture, langs: ['he'] });
  assert.deepEqual(await r.json(), { ok: false, code: 'bad_key', upstream: 400, kind: 'invalid_request_error' });
});
