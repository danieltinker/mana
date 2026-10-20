/**
 * The v2 scanner with every outside call mocked (no network, no model, no cost): the Supabase project (PostgREST and
 * Storage) and the Messages API are routes of a fake `fetch`. The model's answers are synthetic JSON Lines.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftCounts, draftExceptions, IMPORT_IMAGES_MAX, validateDraft, type ClaimScanReply, type ImportDraft } from '@mana/contracts';
import { MAX_TOKENS, requestBody, sniffMedia, toBase64, upstreamError } from '../anthropic.ts';
import type { Deps, Env } from '../deps.ts';
import { SCAN_MODES, scanPrompt, scanSystem } from '@mana/import';
import { cleanStock, handle, MAX_BODY, STOCK_LIST_MAX } from '../handler.ts';
import { isServiceCaller, PURGE_BATCH, PURGE_PAGES } from '../purge.ts';
import { CONCURRENCY, MAX_IMAGE_BYTES, pathsOk, plan, WOLT_BATCH } from '../read.ts';

const URL_ = 'https://project.test';
const API = 'https://api.anthropic.com/v1/messages';
const VENUE = '00000000-0000-4000-8000-0000000000c1';
const OTHER_VENUE = '00000000-0000-4000-8000-0000000000c2';
const IMPORT = '00000000-0000-4000-8000-0000000000d1';
const SERVICE = 'test-service';
const ENV: Env = { url: URL_, anonKey: 'test-anon', serviceKey: SERVICE, anthropicKey: 'test-model', workspaceId: '', model: 'test-model-id' };
const STORAGE = 'GET /storage/v1/object/authenticated/menu-private/';

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(7)]);
const HEIC = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode('ftypheic'), ...new Array(32).fill(0)]);

type Call = { method: string; url: string; path: string; headers: Record<string, string>; body: any; signal: AbortSignal | null };
type Route = (c: Call) => Response | Promise<Response>;

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const modelAnswer = (text: string, stop = 'end_turn') => jsonResponse({ content: [{ type: 'text', text }], stop_reason: stop, usage: { input_tokens: 1000, output_tokens: 200 } });
/** A route that answers only when the request is cancelled (an abort is the only way out). */
const hang: Route = (c) => new Promise((_, reject) => {
  if (c.signal?.aborted) reject(new DOMException('aborted', 'AbortError'));
  c.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
});

/** A fake `fetch`: routes by "METHOD path" (the first that matches the start of the path), every call recorded. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: Call[] = [];
  const f = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = String(input);
    const method = init.method ?? 'GET';
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    let body: unknown = init.body ?? null;
    if (typeof body === 'string') try { body = JSON.parse(body); } catch { /* not JSON */ }
    const path = url.startsWith(URL_) ? url.slice(URL_.length).split('?')[0]! : url;
    const call = { method, url, path, headers, body, signal: init.signal ?? null };
    calls.push(call);
    if (init.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const key = Object.keys(routes).find((k) => { const [m, p] = k.split(' ', 2); return m === method && path.startsWith(p!); });
    if (!key) throw new Error(`no route for ${method} ${url}`);
    return routes[key]!(call);
  };
  return { fetch: f as typeof fetch, calls };
}

function deps(fetch: typeof globalThis.fetch, env: Partial<Env> = {}, now: () => number = () => 1_760_000_000_000): Deps & { logs: Record<string, unknown>[] } {
  const logs: Record<string, unknown>[] = [];
  return { env: { ...ENV, ...env }, fetch, now, log: (e) => void logs.push(e), logs };
}

type Claimed = Extract<ClaimScanReply, { ok: true }>;
const claimReply = (source: Claimed['source'], n: number, o: Partial<Claimed> = {}): Claimed => ({
  ok: true, importId: IMPORT, venueId: VENUE, source, paths: Array.from({ length: n }, (_, i) => `${VENUE}/imports/${IMPORT}/${i + 1}.jpg`), rightsConfirmed: false,
  langs: ['he', 'en'], ...o,
});

/** The Supabase side as the backend lane's RPCs answer (ADR-008), with the scanner's own draft checked and stored. */
function project(source: Claimed['source'], images: number, o: { image?: () => Response; save?: (draft: ImportDraft) => Response; claim?: () => Response; patch?: () => Response } = {}) {
  const saved: Array<{ draft: ImportDraft; notes: unknown }> = [];
  const routes: Record<string, Route> = {
    'POST /rest/v1/rpc/claim_import_scan': () => (o.claim ? o.claim() : jsonResponse(claimReply(source, images))),
    [STORAGE]: () => (o.image ? o.image() : new Response(JPEG, { status: 200, headers: { 'content-length': String(JPEG.length) } })),
    'POST /rest/v1/rpc/save_import_draft': (c) => {
      const draft = c.body.p_draft as ImportDraft;
      saved.push({ draft, notes: c.body.p_notes });
      if (o.save) return o.save(draft);
      return jsonResponse({ ok: true, exceptions: draftExceptions(draft), counts: draftCounts(draft) });
    },
    'PATCH /rest/v1/menu_imports': () => (o.patch ? o.patch() : new Response(null, { status: 204 })),
  };
  return { routes, saved };
}

const OWNER = { Authorization: 'Bearer owner-token', apikey: 'test-anon' };
const read = (action: string, d: Deps, body: Record<string, unknown> = {}, headers: Record<string, string> = OWNER) =>
  handle(new Request('https://fn.test/menus-ai', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action, import_id: IMPORT, ...body }) }), d)
    .then(async (r) => ({ status: r.status, headers: r.headers, body: await r.json() as any }));
const patches = (calls: Call[]) => calls.filter((c) => c.method === 'PATCH').map((c) => c.body);
const models = (calls: Call[]) => calls.filter((c) => c.url === API);

const SHOT_1 = [
  '{"lang":"en"}', '{"c":{"he":"עיקריות","en":"Mains"},"k":"food","tr":["he"]}',
  '{"n":{"he":"שניצל","en":"Schnitzel"},"p":"₪64.00","s":"schnitzel","tr":["he"]}',
  '{"g":{"he":"בחרו תוספת","en":"Choose a side"},"r":"Required · Choose 1","tr":["he"]}', '{"o":{"he":"צ׳יפס","en":"Fries"},"tr":["he"]}', '{"o":{"he":"סלט","en":"Salad"},"tr":["he"]}',
  '{"n":{"he":"המבורגר","en":"Burger"},"p":"₪72.00","tr":["he"]}',
].join('\n');
// the second run of screenshots starts with the first run's last one: the burger again, then more of the mains
const SHOT_2 = [
  '{"lang":"en"}', '{"n":{"he":"המבורגר","en":"Burger"},"p":"₪72.00","tr":["he"]}', '{"n":{"he":"פלאפל","en":"Falafel"},"p":"₪38.00","t":["vegan"],"tr":["he"]}',
  '{"c":{"he":"שתייה","en":"Drinks"},"k":"drinks","tr":["he"]}', '{"n":{"he":"לימונדה","en":"Lemonade"},"p":"₪18.00","tr":["he"]}',
].join('\n');

// ---------------------------------------------------------------- the pure parts

test('plan: one call per printed page; screenshots in overlapping runs', () => {
  assert.deepEqual(plan('scan_menu', 3), [[0], [1], [2]]);
  assert.deepEqual(plan('wolt_screenshots', 0), []);
  assert.deepEqual(plan('wolt_screenshots', 1), [[0]]);
  assert.deepEqual(plan('wolt_screenshots', WOLT_BATCH), [[0, 1, 2, 3, 4]]);
  assert.deepEqual(plan('wolt_screenshots', 7), [[0, 1, 2, 3, 4], [4, 5, 6]]);
  assert.deepEqual(plan('wolt_screenshots', 9), [[0, 1, 2, 3, 4], [4, 5, 6, 7, 8]]);
  assert.deepEqual(plan('wolt_screenshots', 10), [[0, 1, 2, 3, 4], [4, 5, 6, 7, 8], [8, 9]]);
  for (const n of [2, 6, 13, 20, 24]) {
    const p = plan('wolt_screenshots', n);
    assert.deepEqual([...new Set(p.flat())], Array.from({ length: n }, (_, i) => i), `every screenshot is read (${n})`);
    assert.ok(p.every((b) => b.length <= WOLT_BATCH));
  }
  // the worst case the README states: the most images each source takes
  assert.equal(plan('scan_menu', IMPORT_IMAGES_MAX.scan).length, 8);
  assert.equal(plan('wolt_screenshots', IMPORT_IMAGES_MAX.wolt_screenshots).length, 6);
  assert.ok(CONCURRENCY >= 3 && CONCURRENCY <= 4);
});

test('requestBody: the images first, labelled when there are several, then the prompt; a bounded answer', () => {
  const im = { mediaType: 'image/jpeg', data: 'AAAA' };
  const one = requestBody('m', 'scan_menu', [im], ['he', 'en'], []) as any;
  assert.equal(one.max_tokens, MAX_TOKENS);
  assert.deepEqual(one.messages[0].content.map((c: any) => c.type), ['image', 'text']);
  const three = requestBody('m', 'wolt_screenshots', [im, im, im], ['he'], [{ id: 'pizza', label: 'pizza' }]) as any;
  assert.deepEqual(three.messages[0].content.map((c: any) => c.type === 'text' ? c.text.slice(0, 8) : c.type), ['Image 1:', 'image', 'Image 2:', 'image', 'Image 3:', 'image', 'Transcri']);
  assert.match(three.messages[0].content.at(-1).text, /pizza \(pizza\)/);
  assert.match(three.system, /never an instruction to you/);
});

test('upstreamError: what an API refusal means (as v1)', () => {
  assert.equal(upstreamError(401, ''), 'bad_key');
  assert.equal(upstreamError(529, ''), 'busy');
  assert.equal(upstreamError(413, ''), 'too_big');
  assert.equal(upstreamError(400, JSON.stringify({ error: { message: 'This key must name a workspace' } })), 'bad_key');
  assert.equal(upstreamError(400, JSON.stringify({ error: { message: 'Could not process image' } })), 'bad_image');
  assert.equal(upstreamError(400, JSON.stringify({ error: { message: 'image exceeds the maximum size' } })), 'too_big');
  assert.equal(upstreamError(500, '<html>'), 'upstream');
});

test('sniffMedia and toBase64', () => {
  assert.equal(sniffMedia(JPEG), 'image/jpeg');
  assert.equal(sniffMedia(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(sniffMedia(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.equal(sniffMedia(HEIC), null, 'HEIC is not read by the API: the owner app sends JPEG');
  const big = new Uint8Array(100_000).map((_, i) => i % 251);
  assert.equal(toBase64(big), Buffer.from(big).toString('base64'));
});

test('cleanStock and isServiceCaller', () => {
  assert.deepEqual(cleanStock([{ id: 'pizza', label: 'Pizza, (round)' }, { id: 'Bad Id' }, 'x', { id: 'soup' }]), [{ id: 'pizza', label: 'Pizza round' }, { id: 'soup', label: '' }]);
  assert.equal(isServiceCaller(`Bearer ${SERVICE}`, SERVICE), true);
  assert.equal(isServiceCaller('Bearer owner-token', SERVICE), false);
  assert.equal(isServiceCaller(SERVICE, SERVICE), false);
  assert.equal(isServiceCaller('Bearer ', ''), false);
});

test('QA-L1 (round 2): one call\'s instructions are at most the README\'s 10,314 characters, whatever the stock list', () => {
  const worst = (letter: string) => cleanStock(Array.from({ length: 200 }, (_, i) => ({ id: `${'a'.repeat(37)}${String(i).padStart(3, '0')}`, label: letter.repeat(200) })));
  const listed = (st: readonly { id: string; label: string }[]) => st.map((s) => (s.label ? `${s.id} (${s.label})` : s.id)).join(', ').length;
  for (const st of [worst('x'), worst('ש')]) assert.ok(listed(st) <= STOCK_LIST_MAX && listed(st) > STOCK_LIST_MAX - 105, `${listed(st)}`);
  // an ordinary list (160 pictures, short labels) is kept whole
  assert.equal(cleanStock(Array.from({ length: 160 }, (_, i) => ({ id: `dish-${i}`, label: 'grilled chicken' }))).length, 160);
  let most = 0;
  for (const mode of SCAN_MODES) for (const langs of [['he'], ['en'], ['he', 'en']] as const) for (let n = 1; n <= WOLT_BATCH; n++) {
    for (const st of [[], worst('x'), worst('ש')]) most = Math.max(most, scanSystem().length + scanPrompt(mode, langs, st, n).length);
  }
  assert.ok(most <= 10_314, `${most} characters: update the README's worst case`);
});

test('security M1 / QA M7: pathsOk accepts exactly the files of this venue\'s folder for this import', () => {
  const ok = `${VENUE}/imports/${IMPORT}/1.jpg`;
  assert.equal(pathsOk([ok, `${VENUE}/imports/${IMPORT}/page-2_a.b.png`], VENUE, IMPORT), true);
  assert.equal(pathsOk([ok], VENUE.toUpperCase(), IMPORT), true, 'the venue id from the claim, in any case');
  for (const bad of [
    `${OTHER_VENUE}/imports/${IMPORT}/1.jpg`, `${VENUE}/imports/00000000-0000-4000-8000-0000000000d9/1.jpg`, `${VENUE}/imports/${IMPORT}/../../${OTHER_VENUE}/x.jpg`,
    `${VENUE}/imports/${IMPORT}/..`, `${VENUE}/imports/${IMPORT}/.`, `${VENUE}/imports/${IMPORT}/a/b.jpg`, `${VENUE}/imports/${IMPORT}/`, `${VENUE}/imports/${IMPORT}/a%2Fb.jpg`,
    `${VENUE}/imports/${IMPORT}/${'a'.repeat(101)}`, `${VENUE}/originals/1.jpg`, `/${VENUE}/imports/${IMPORT}/1.jpg`, `${VENUE}/imports/${IMPORT}/a b.jpg`,
  ]) assert.equal(pathsOk([ok, bad], VENUE, IMPORT), false, bad);
  assert.equal(pathsOk('x', VENUE, IMPORT), false);
  assert.equal(pathsOk([ok], 'not-a-uuid', IMPORT), false);
  assert.equal(pathsOk([1], VENUE, IMPORT), false);
});

// ---------------------------------------------------------------- requests that never reach a paid call

test('requests: CORS, method, a broken body, an unknown action, a bad id, no token', async () => {
  const d = deps(fakeFetch({}).fetch);
  assert.equal((await handle(new Request('https://fn.test', { method: 'OPTIONS' }), d)).status, 200);
  assert.equal((await handle(new Request('https://fn.test', { method: 'GET' }), d)).status, 405);
  assert.equal((await handle(new Request('https://fn.test', { method: 'POST', body: '{' }), d)).status, 400);
  assert.deepEqual((await read('describe_dish', d)).body, { ok: false, code: 'bad_request' });
  assert.deepEqual((await read('scan_menu', d, { import_id: 'nope' })).body, { ok: false, code: 'bad_request' });
  assert.deepEqual((await read('scan_menu', d, {}, {})).body, { ok: false, code: 'not_allowed' });
  assert.equal((await handle(new Request('https://fn.test', { method: 'POST', body: JSON.stringify({ action: 'status', pad: 'x'.repeat(70_000) }) }), d)).status, 413);
});

test('security L3 / N3: a request body is read up to MAX_BODY, whatever its declared length says', async () => {
  const d = deps(fakeFetch({}).fetch);
  // no Content-Length (a stream): cut while it streams
  let sent = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(c) { if (sent > 10 * MAX_BODY) return c.close(); sent += 16_384; c.enqueue(new Uint8Array(16_384).fill(0x20)); },
  });
  const r = await handle(new Request('https://fn.test', { method: 'POST', body: stream, duplex: 'half' } as RequestInit), d);
  assert.equal(r.status, 413);
  assert.ok(sent < 2 * MAX_BODY, `read ${sent} bytes, not the whole stream`);
  // a declared length past the cap: refused before reading
  const declared = await handle(new Request('https://fn.test', { method: 'POST', headers: { 'content-length': String(MAX_BODY + 1) }, body: '{"action":"status"}' }), d);
  assert.equal(declared.status, 413);
});

test('QA L1: an error nobody expected still answers 500 with the CORS headers', async () => {
  const f = fakeFetch({ 'GET /rest/v1/app_config': () => { throw new TypeError('network down'); } });
  const d = deps(f.fetch);
  const r = await read('purge', d, {}, { Authorization: `Bearer ${SERVICE}` });
  assert.equal(r.status, 500);
  assert.deepEqual(r.body, { ok: false, code: 'failed' });
  assert.equal(r.headers.get('access-control-allow-origin'), '*');
  assert.ok(d.logs.some((l) => l.code === 'failed' && l.thrown === 'TypeError'));
});

test('status, and not_configured: with no model key nothing is claimed or fetched', async () => {
  const f = fakeFetch({});
  assert.deepEqual((await read('status', deps(f.fetch))).body, { ok: true, configured: true });
  assert.deepEqual((await read('status', deps(f.fetch, { anthropicKey: '' }))).body, { ok: true, configured: false });
  assert.deepEqual((await read('wolt_screenshots', deps(f.fetch, { anthropicKey: '' }))).body, { ok: false, code: 'not_configured' });
  assert.equal(f.calls.length, 0);
});

test('security L1: no service-role look-up before the claim; the mode goes to the claim, which refuses a wrong one', async () => {
  const p = project('scan', 1, { claim: () => jsonResponse({ ok: false, code: 'not_scannable' }) });
  const f = fakeFetch(p.routes);
  assert.deepEqual((await read('wolt_screenshots', deps(f.fetch))).body, { ok: false, code: 'not_scannable' });
  assert.deepEqual(f.calls.map((c) => `${c.method} ${c.path}`), ['POST /rest/v1/rpc/claim_import_scan'], 'the claim is the first call, and the only one');
  assert.deepEqual(f.calls[0]!.body, { p_import: IMPORT, p_mode: 'wolt_screenshots' });
  assert.equal(f.calls[0]!.headers.authorization, 'Bearer owner-token');
  // a claim that answers another source than the one asked (an RPC that ignored p_mode): nothing is read, the import is marked
  const q = project('scan', 1);
  const g = fakeFetch(q.routes);
  assert.deepEqual((await read('wolt_screenshots', deps(g.fetch))).body, { ok: false, code: 'source_mismatch' });
  assert.ok(!g.calls.some((c) => c.path.startsWith('/storage/') || c.url === API));
  assert.deepEqual(patches(g.calls), [{ status: 'failed', error_code: 'image_unreadable' }]);
});

test('the claim gates every paid call: refused, nothing is downloaded or read', async () => {
  // every refusal claim_import_scan answers (backend stage 2), and a caller without a session
  const refusals: Array<[Response, Record<string, unknown>]> = [
    [jsonResponse({ ok: false, code: 'rate_limited', cap: 'scan_images_per_venue_day' }), { code: 'rate_limited', cap: 'scan_images_per_venue_day' }],
    [jsonResponse({ ok: false, code: 'rate_limited', cap: 'Not A Cap!' }), { code: 'rate_limited' }],
    [jsonResponse({ code: '42501', message: 'not_allowed' }, 403), { code: 'not_allowed' }],
    ...(['import_unknown', 'not_scannable', 'import_closed', 'import_busy'] as const).map((code): [Response, Record<string, unknown>] => [jsonResponse({ ok: false, code }), { code }]),
  ];
  for (const [reply, expected] of refusals) {
    const code = String(expected.code);
    const p = project('wolt_screenshots', 3, { claim: () => reply.clone() });
    const f = fakeFetch(p.routes);
    assert.deepEqual((await read('wolt_screenshots', deps(f.fetch))).body, { ok: false, ...expected });
    assert.ok(!f.calls.some((c) => c.url === API || c.path.startsWith('/storage/')), code);
    assert.deepEqual(patches(f.calls), [], `${code}: a refused claim marks nothing`);
  }
});

test('security M1 / QA M7: a claim with any path outside the import\'s folder is refused before any download', async () => {
  const bad: Array<[string, Partial<Claimed>]> = [
    ['another venue', { paths: [`${VENUE}/imports/${IMPORT}/1.jpg`, `${OTHER_VENUE}/imports/${IMPORT}/2.jpg`] }],
    ['another import', { paths: [`${VENUE}/imports/00000000-0000-4000-8000-0000000000d9/1.jpg`] }],
    ['a way out', { paths: [`${VENUE}/imports/${IMPORT}/../../../${OTHER_VENUE}/logo.png`] }],
    ['a dot name', { paths: [`${VENUE}/imports/${IMPORT}/..`] }],
    ['the claim names another import', { importId: '00000000-0000-4000-8000-0000000000d9' }],
  ];
  for (const [label, o] of bad) {
    const p = project('scan', 1, { claim: () => jsonResponse(claimReply('scan', 1, o)) });
    const f = fakeFetch(p.routes);
    const r = await read('scan_menu', deps(f.fetch));
    assert.deepEqual(r.body, { ok: false, code: 'paths_invalid' }, label);
    assert.ok(!f.calls.some((c) => c.path.startsWith('/storage/') || c.url === API), `${label}: nothing downloaded or read`);
    assert.deepEqual(patches(f.calls), [{ status: 'failed', error_code: 'image_unreadable' }], label);
  }
});

test('QA L1: a claim with no paths, or with too many for its source, marks the import failed with a real code', async () => {
  for (const [label, source, o, code] of [
    ['no paths', 'scan', { paths: undefined as unknown as string[] }, 'paths_invalid'],
    ['no images', 'scan', { paths: [] }, 'image_unreadable'],
    ['9 printed pages', 'scan', { paths: Array.from({ length: IMPORT_IMAGES_MAX.scan + 1 }, (_, i) => `${VENUE}/imports/${IMPORT}/${i}.jpg`) }, 'too_many_images'],
    ['25 screenshots', 'wolt_screenshots', { paths: Array.from({ length: IMPORT_IMAGES_MAX.wolt_screenshots + 1 }, (_, i) => `${VENUE}/imports/${IMPORT}/${i}.jpg`) }, 'too_many_images'],
  ] as const) {
    const mode = source === 'scan' ? 'scan_menu' : 'wolt_screenshots';
    const p = project(source, 1, { claim: () => jsonResponse(claimReply(source, 1, o as Partial<Claimed>)) });
    const f = fakeFetch(p.routes);
    assert.deepEqual((await read(mode, deps(f.fetch))).body, { ok: false, code }, label);
    assert.deepEqual(patches(f.calls), [{ status: 'failed', error_code: 'image_unreadable' }], label);
    assert.ok(!f.calls.some((c) => c.path.startsWith('/storage/') || c.url === API), label);
  }
});

// ---------------------------------------------------------------- reading

test('Wolt screenshots: claimed and downloaded with the owner\'s token, read in overlapping runs, merged, saved as the service role with the notes', async () => {
  const p = project('wolt_screenshots', 7);
  const answers = [SHOT_1, SHOT_2];
  const f = fakeFetch({ ...p.routes, [`POST ${API}`]: () => modelAnswer(answers.shift()!) });
  const r = await read('wolt_screenshots', deps(f.fetch), { stock: [{ id: 'schnitzel', label: 'schnitzel' }] });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  const order = f.calls.map((c) => (c.url === API ? 'model' : `${c.method} ${c.path.replace(/\/menu-private\/.*/, '/…')}`));
  assert.equal(order[0], 'POST /rest/v1/rpc/claim_import_scan', 'nothing before the claim');
  assert.ok(order.indexOf('model') > order.lastIndexOf('GET /storage/v1/object/authenticated/…'));
  const claim = f.calls.find((c) => c.path === '/rest/v1/rpc/claim_import_scan')!;
  assert.equal(claim.headers.authorization, 'Bearer owner-token', 'the claim runs as the owner');
  assert.deepEqual(claim.body, { p_import: IMPORT, p_mode: 'wolt_screenshots' });
  const downloads = f.calls.filter((c) => c.path.startsWith('/storage/'));
  assert.equal(downloads.length, 7);
  assert.ok(downloads.every((c) => c.headers.authorization === 'Bearer owner-token' && c.headers.apikey === 'test-anon'), 'Storage\'s row-level security decides, as the owner');
  const save = f.calls.find((c) => c.path === '/rest/v1/rpc/save_import_draft')!;
  assert.equal(save.headers.authorization, `Bearer ${SERVICE}`, 'the draft is saved by the service role');
  assert.deepEqual(models(f.calls).map((c) => c.body.messages[0].content.filter((x: any) => x.type === 'image').length), [5, 3]);
  assert.equal(models(f.calls)[0]!.headers['x-api-key'], 'test-model');
  // the saved draft, and its notes beside it
  const { draft, notes } = p.saved[0]!;
  assert.ok(validateDraft(draft).ok);
  assert.equal(draft.source, 'wolt_screenshots');
  assert.deepEqual(draft.sections.map((s) => [s.name.en, s.dishes.map((x) => x.name.en)]), [['Mains', ['Schnitzel', 'Burger', 'Falafel']], ['Drinks', ['Lemonade']]]);
  assert.equal(draft.sections[0]!.dishes[0]!.illustration, 'schnitzel');
  assert.ok(Array.isArray(notes));
  assert.deepEqual(r.body.counts, { sections: 2, dishes: 4, groups: 1, options: 2, photos: 0, dropped: 0 });
  assert.deepEqual(r.body.usage, { in: 2000, out: 400 });
  assert.equal(r.body.calls, 2);
  assert.deepEqual(patches(f.calls), [], 'nothing marked failed');
});

test('a printed menu: one call per page; a page that continues a section joins it', async () => {
  const p = project('scan', 2);
  const answers = ['{"lang":"he"}\n{"c":{"he":"עיקריות","en":"Mains"}}\n{"n":{"he":"מרק","en":"Soup"},"p":"30","tr":["en"]}', '{"lang":"he"}\n{"n":{"he":"תבשיל","en":"Stew"},"p":"60","tr":["en"]}'];
  const f = fakeFetch({ ...p.routes, [`POST ${API}`]: () => modelAnswer(answers.shift()!) });
  const r = await read('scan_menu', deps(f.fetch));
  assert.equal(r.body.ok, true);
  assert.deepEqual(p.saved[0]!.draft.sections.map((s) => [s.name.he, s.dishes.map((x) => x.name.he)]), [['עיקריות', ['מרק', 'תבשיל']]]);
  assert.equal(models(f.calls).length, 2);
});

test('an answer cut at its length limit is kept, and its page is noted (and stored with the draft)', async () => {
  const p = project('scan', 1);
  const f = fakeFetch({ ...p.routes, [`POST ${API}`]: () => modelAnswer(`${SHOT_1}\n{"n":{"he":"מנה","en":"Di`, 'max_tokens') });
  const r = await read('scan_menu', deps(f.fetch));
  assert.equal(r.body.ok, true);
  assert.ok(r.body.notes.some((n: any) => n.code === 'page_truncated'));
  assert.ok((p.saved[0]!.notes as any[]).some((n) => n.code === 'page_truncated' && n.severity === 'check' && n.lines[0] === 1));
  assert.equal(r.body.dropped, 1);
});

test('failures after the claim mark the import failed with a closed code, and nothing is saved', async () => {
  const cases: Array<[string, { image?: () => Response }, Route | null, string, number | undefined]> = [
    ['an image the API cannot read (HEIC)', { image: () => new Response(HEIC) }, null, 'image_unreadable', undefined],
    ['a missing file', { image: () => new Response('not found', { status: 404 }) }, null, 'image_unreadable', undefined],
    ['the API refuses the image', {}, () => jsonResponse({ error: { type: 'invalid_request_error', message: 'Could not process image' } }, 400), 'image_unreadable', 400],
    ['the API is overloaded', {}, () => jsonResponse({ error: { type: 'overloaded_error' } }, 529), 'model_failed', 529],
    ['no menu on any page', {}, () => modelAnswer('{"lang":"other"}\n{"error":"not_a_menu"}'), 'image_unreadable', undefined],
  ];
  for (const [label, o, model, code, upstream] of cases) {
    const p = project('scan', 1, o);
    const f = fakeFetch({ ...p.routes, ...(model ? { [`POST ${API}`]: model } : {}) });
    const d = deps(f.fetch);
    const r = await read('scan_menu', d);
    assert.deepEqual(r.body, upstream === undefined ? { ok: false, code } : { ok: false, code, upstream }, label);
    const patch = f.calls.find((c) => c.method === 'PATCH')!;
    assert.deepEqual([patch.url.endsWith(`id=eq.${IMPORT}&status=eq.parsing`), patch.body], [true, { status: 'failed', error_code: code }], label);
    assert.equal(p.saved.length, 0, label);
    assert.equal(d.logs.at(-1)!.marked, true, `${label}: the mark is logged`);
    if (!model) assert.equal(models(f.calls).length, 0, `${label}: no paid call`);
  }
});

test('QA L1: a mark that does not go through is logged, never hidden', async () => {
  const p = project('scan', 1, { image: () => new Response(HEIC), patch: () => new Response('down', { status: 503 }) });
  const f = fakeFetch(p.routes);
  const d = deps(f.fetch);
  assert.deepEqual((await read('scan_menu', d)).body, { ok: false, code: 'image_unreadable' });
  assert.equal(d.logs.at(-1)!.marked, false);
});

test('security L3: an image is refused by its size before it is read whole (declared, or while it streams)', async () => {
  // a declared length past the cap: the body is not read
  let pulled = 0;
  const big = () => new Response(new ReadableStream<Uint8Array>({ pull(c) { pulled += 1; c.enqueue(new Uint8Array(65_536)); } }), { headers: { 'content-length': String(MAX_IMAGE_BYTES + 1) } });
  const p = project('scan', 1, { image: big });
  const f = fakeFetch(p.routes);
  assert.deepEqual((await read('scan_menu', deps(f.fetch))).body, { ok: false, code: 'image_unreadable' });
  assert.ok(pulled <= 2, `pulled ${pulled} chunks`);
  assert.equal(models(f.calls).length, 0);
  // no declared length: cut once the stream passes the cap
  let sent = 0;
  const endless = () => new Response(new ReadableStream<Uint8Array>({
    pull(c) { if (sent === 0) { sent += 4; c.enqueue(JPEG.slice(0, 4)); return; } sent += 262_144; c.enqueue(new Uint8Array(262_144)); },
  }));
  const q = project('scan', 1, { image: endless });
  const g = fakeFetch(q.routes);
  assert.deepEqual((await read('scan_menu', deps(g.fetch))).body, { ok: false, code: 'image_unreadable' });
  assert.ok(sent <= MAX_IMAGE_BYTES + 2 * 262_144, `read ${sent} bytes`);
  assert.deepEqual(patches(g.calls), [{ status: 'failed', error_code: 'image_unreadable' }]);
});

test('security L2 / QA M8: the first refusal stops the read: no call starts after it, and the ones in flight are cancelled', async () => {
  const p = project('scan', 6);
  let n = 0;
  const signals: AbortSignal[] = [];
  const f = fakeFetch({
    ...p.routes,
    [`POST ${API}`]: (c) => {
      signals.push(c.signal!);
      // the first answers 529 once the others are in flight; the others would never answer
      if (n++ === 0) return new Promise((resolve) => setTimeout(() => resolve(jsonResponse({ error: { type: 'overloaded_error' } }, 529)), 5));
      return hang(c);
    },
  });
  const r = await read('scan_menu', deps(f.fetch));
  assert.deepEqual(r.body, { ok: false, code: 'model_failed', upstream: 529 });
  assert.equal(models(f.calls).length, CONCURRENCY, 'the calls in flight, none after');
  assert.ok(signals.every((s) => s.aborted), 'every call of this read is cancelled by its answer');
  assert.deepEqual(patches(f.calls), [{ status: 'failed', error_code: 'model_failed' }]);
});

test('QA M8: past the deadline the read stops, the import is marked timeout (never left parsing), and nothing runs on', async () => {
  for (const stage of ['model', 'download'] as const) {
    const p = project('scan', 2, stage === 'download' ? { image: () => { throw new Error('unused'); } } : {});
    let t = 0;
    const now = () => (t++ === 0 ? 0 : 10_000_000);
    const signals: AbortSignal[] = [];
    const routes: Record<string, Route> = { ...p.routes, [`POST ${API}`]: (c: Call) => { signals.push(c.signal!); return hang(c); } };
    if (stage === 'download') routes[STORAGE] = (c: Call) => { signals.push(c.signal!); return hang(c); };
    const f = fakeFetch(routes);
    const d = deps(f.fetch, {}, now);
    assert.deepEqual((await read('scan_menu', d)).body, { ok: false, code: 'timeout' }, stage);
    assert.deepEqual(patches(f.calls), [{ status: 'failed', error_code: 'timeout' }], stage);
    assert.ok(signals.length > 0 && signals.every((s) => s.aborted), stage);
    const after = f.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(f.calls.length, after, `${stage}: no call after the answer`);
  }
});

test('save_import_draft refuses: a closed import is left as it is; anything else marks draft_invalid', async () => {
  for (const [reply, code, marked] of [[{ ok: false, code: 'import_closed' }, 'import_closed', false], [{ ok: false, code: 'invalid_draft', errors: [] }, 'draft_invalid', true]] as const) {
    const p = project('scan', 1, { save: () => jsonResponse(reply) });
    const f = fakeFetch({ ...p.routes, [`POST ${API}`]: () => modelAnswer(SHOT_1) });
    assert.deepEqual((await read('scan_menu', deps(f.fetch))).body, { ok: false, code });
    assert.equal(f.calls.some((c) => c.method === 'PATCH'), marked, code);
  }
});

test('the log carries counts and codes, never a menu\'s text or a key', async () => {
  const p = project('scan', 1);
  const f = fakeFetch({ ...p.routes, [`POST ${API}`]: () => modelAnswer(SHOT_1) });
  const d = deps(f.fetch);
  await read('scan_menu', d);
  const line = JSON.stringify(d.logs);
  assert.ok(!/Schnitzel|שניצל|test-model"|test-service|owner-token/.test(line), line);
  assert.deepEqual(Object.keys(d.logs[0]!).sort(), ['action', 'calls', 'code', 'fn', 'images', 'import', 'in', 'model', 'ms', 'ok', 'out']);
});

// ---------------------------------------------------------------- purge

const NOW = Date.parse('2026-10-16T12:00:00Z');
const DAY = 86_400_000;
/** A row as `list_purgeable_imports` names it, and when it finished (days before NOW) for the look-up. */
const ROW = (n: number, o: { paths?: string[]; status?: string; days?: number } = {}) => {
  const importId = `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  return { importId, venueId: VENUE, status: o.status ?? 'applied', paths: o.paths ?? [`${VENUE}/imports/${importId}/1.jpg`, `${VENUE}/imports/${importId}/2.jpg`], days: o.days ?? 40 };
};
type Row = ReturnType<typeof ROW>;
const listed = (rows: readonly Row[]) => rows.map(({ days: _, ...r }) => r);
/** The finish times of the ids a look-up asks for, as PostgREST answers (`applied_at` null for an import never applied). */
const finished = (rows: readonly Row[]): Route => (c) => {
  const ids = /id=in\.\(([^)]*)\)/.exec(c.url)?.[1]?.split(',') ?? [];
  return jsonResponse(rows.filter((r) => ids.includes(r.importId)).map((r) => ({
    id: r.importId, updated_at: new Date(NOW - r.days * DAY).toISOString().replace('Z', '+00:00'), applied_at: r.status === 'applied' ? new Date(NOW - r.days * DAY).toISOString() : null,
  })));
};
const SVC = { Authorization: `Bearer ${SERVICE}` };
/** A purge of every import the list names (the `read` helper names one by default). */
const ALL = { import_id: undefined };

test('purge: only the service role; list_purgeable_imports names the imports; Storage deletes, then the import records it', async () => {
  const rows = [ROW(1), ROW(2), ROW(3), ROW(4, { status: 'uploaded', days: 31 })];
  let deletes = 0;
  const f = fakeFetch({
    'GET /rest/v1/app_config': () => jsonResponse([{ value: 30 }]),
    'POST /rest/v1/rpc/list_purgeable_imports': () => jsonResponse(listed(rows)),
    'GET /rest/v1/menu_imports': finished(rows),
    'DELETE /storage/v1/object/menu-private': () => new Response('[]', { status: deletes++ === 1 ? 500 : 200 }),
    // the third import was claimed meanwhile: the conditional update finds nothing
    'PATCH /rest/v1/menu_imports': (c) => jsonResponse(c.url.includes(rows[2]!.importId) ? [] : [{ id: 'x' }]),
  });
  const asOwner = await read('purge', deps(f.fetch, {}, () => NOW), {});
  assert.deepEqual([asOwner.status, asOwner.body], [403, { ok: false, code: 'not_allowed' }]);
  assert.equal(f.calls.length, 0);
  const r = await read('purge', deps(f.fetch, {}, () => NOW), { import_id: undefined }, SVC);
  assert.deepEqual(r.body, { ok: true, purged: 2, failed: [rows[1]!.importId, rows[2]!.importId], kept: 0, more: false });
  const list = f.calls.find((c) => c.path === '/rest/v1/rpc/list_purgeable_imports')!;
  assert.deepEqual([list.method, list.body, list.headers.authorization], ['POST', { p_limit: PURGE_BATCH }, `Bearer ${SERVICE}`]);
  assert.deepEqual(f.calls.filter((c) => c.method === 'DELETE').map((c) => c.body), rows.map((x) => ({ prefixes: x.paths })));
  const marks = f.calls.filter((c) => c.method === 'PATCH');
  assert.equal(marks.length, 3);
  assert.ok(marks.every((c) => c.body.raw_purged_at === '2026-10-16T12:00:00.000Z' && c.body.raw_paths.length === 0));
  assert.ok(marks.every((c) => /raw_purged_at=is\.null/.test(c.url) && /status=in\.\(applied,discarded,failed,uploaded,parsed\)/.test(c.url)), 'the mark is conditional, never on a read');
  assert.deepEqual((await read('purge', deps(f.fetch, {}, () => NOW), { import_id: 'nope' }, SVC)).body, { ok: false, code: 'bad_request' });
  // one import, by its id: only that one
  const one = await read('purge', deps(f.fetch, {}, () => NOW), { import_id: rows[3]!.importId.toUpperCase() }, SVC);
  assert.deepEqual(one.body, { ok: true, purged: 1, failed: [], kept: 0, more: false });
});

test('purge: the retention holds whatever the list says; a list or a look-up that fails purges nothing', async () => {
  // finished 10 days ago (the list names it at once): kept; finished 31 days ago: purged; the look-up does not know it: kept
  const rows = [ROW(1, { days: 10 }), ROW(2, { status: 'discarded', days: 31 }), ROW(3, { status: 'failed', days: 29 })];
  const unknown = ROW(4);
  const f = fakeFetch({
    'GET /rest/v1/app_config': () => jsonResponse([{ value: 30 }]),
    'POST /rest/v1/rpc/list_purgeable_imports': () => jsonResponse(listed([...rows, unknown])),
    'GET /rest/v1/menu_imports': finished(rows),
    'DELETE /storage/v1/object/menu-private': () => new Response('[]'),
    'PATCH /rest/v1/menu_imports': () => jsonResponse([{ id: 'x' }]),
  });
  const d = deps(f.fetch, {}, () => NOW);
  assert.deepEqual((await read('purge', d, ALL, SVC)).body, { ok: true, purged: 1, failed: [], kept: 3, more: false });
  assert.deepEqual(f.calls.filter((c) => c.method === 'DELETE').map((c) => c.body), [{ prefixes: rows[1]!.paths }]);
  assert.ok(d.logs.some((l) => l.action === 'purge' && l.kept === 3 && l.retentionDays === 30));
  // a retention of 7 days: all three go
  const g = fakeFetch({
    'GET /rest/v1/app_config': () => jsonResponse([{ value: 7 }]),
    'POST /rest/v1/rpc/list_purgeable_imports': () => jsonResponse(listed(rows)),
    'GET /rest/v1/menu_imports': finished(rows),
    'DELETE /storage/v1/object/menu-private': () => new Response('[]'),
    'PATCH /rest/v1/menu_imports': () => jsonResponse([{ id: 'x' }]),
  });
  assert.deepEqual((await read('purge', deps(g.fetch, {}, () => NOW), ALL, SVC)).body, { ok: true, purged: 3, failed: [], kept: 0, more: false });
  const brokens: Array<Record<string, Route>> = [{ 'POST /rest/v1/rpc/list_purgeable_imports': () => jsonResponse({ code: '42501', message: 'not_allowed' }, 403) },
    { 'POST /rest/v1/rpc/list_purgeable_imports': () => jsonResponse(listed(rows)), 'GET /rest/v1/menu_imports': () => new Response('no', { status: 500 }) }];
  for (const broken of brokens) {
    const h = fakeFetch({ 'GET /rest/v1/app_config': () => jsonResponse([]), ...broken });
    assert.deepEqual((await read('purge', deps(h.fetch, {}, () => NOW), ALL, SVC)).body, { ok: false, code: 'failed' });
    assert.ok(!h.calls.some((c) => c.method === 'DELETE' || c.method === 'PATCH'));
  }
});

test('security M1 (purge): only files of the import\'s own folder are deleted; any other path leaves the row alone', async () => {
  const good = ROW(1);
  const evil = ROW(2, { paths: [`${VENUE}/imports/${ROW(2).importId}/1.jpg`, `${OTHER_VENUE}/imports/x/1.jpg`] });
  const traversal = ROW(3, { paths: [`${VENUE}/imports/${ROW(3).importId}/../../../menu-public/${OTHER_VENUE}/logo.png`] });
  const all = [good, evil, traversal];
  const f = fakeFetch({
    'GET /rest/v1/app_config': () => jsonResponse([]),
    'POST /rest/v1/rpc/list_purgeable_imports': () => jsonResponse(listed(all)),
    'GET /rest/v1/menu_imports': finished(all),
    'DELETE /storage/v1/object/menu-private': () => new Response('[]'),
    'PATCH /rest/v1/menu_imports': () => jsonResponse([{ id: 'x' }]),
  });
  const r = await read('purge', deps(f.fetch, {}, () => NOW), ALL, SVC);
  assert.deepEqual(r.body, { ok: true, purged: 1, failed: [evil.importId, traversal.importId], kept: 0, more: false });
  assert.deepEqual(f.calls.filter((c) => c.method === 'DELETE').map((c) => c.body), [{ prefixes: good.paths }]);
});

test('security L6: rows that keep failing never hold back the rows after them; one call ends, and says when there is more', async () => {
  // the list as the database gives it: oldest first, at most p_limit, a purged import gone from it
  const all = Array.from({ length: 2 * PURGE_BATCH + 7 }, (_, i) => ROW(i + 1));
  const gone = new Set<string>();
  const failing = new Set(all.slice(0, 3).map((r) => r.importId));
  const routes = (fail: (id: string) => boolean): Record<string, Route> => ({
    'GET /rest/v1/app_config': () => jsonResponse([]),
    'POST /rest/v1/rpc/list_purgeable_imports': (c) => jsonResponse(listed(all.filter((r) => !gone.has(r.importId)).slice(0, c.body.p_limit))),
    'GET /rest/v1/menu_imports': finished(all),
    'DELETE /storage/v1/object/menu-private': (c) => new Response('[]', { status: fail(c.body.prefixes[0].split('/')[2]) ? 500 : 200 }),
    'PATCH /rest/v1/menu_imports': (c) => { gone.add(/id=eq\.([0-9a-f-]+)/.exec(c.url)![1]!); return jsonResponse([{ id: 'x' }]); },
  });
  const f = fakeFetch(routes((id) => failing.has(id)));
  const r = await read('purge', deps(f.fetch, {}, () => NOW), ALL, SVC);
  assert.deepEqual(r.body, { ok: true, purged: all.length - 3, failed: [...failing], kept: 0, more: false });
  assert.equal(f.calls.filter((c) => c.path === '/rest/v1/rpc/list_purgeable_imports').length, 3, 'read again while a full page purged something');
  assert.equal(f.calls.filter((c) => c.method === 'DELETE').length, all.length, 'a failing row is tried once per call');
  assert.ok(f.calls.filter((c) => c.method === 'GET' && c.path === '/rest/v1/menu_imports').every((c) => /id=in\.\(([^)]*)\)/.exec(c.url)![1]!.split(',').length <= 100), 'the look-up asks for 100 ids at most');
  // more than PURGE_PAGES full pages: the call ends and says more
  gone.clear();
  const many = Array.from({ length: PURGE_PAGES * PURGE_BATCH + 1 }, (_, i) => ROW(i + 1));
  all.splice(0, all.length, ...many);
  const g = fakeFetch(routes(() => false));
  const m = await read('purge', deps(g.fetch, {}, () => NOW), ALL, SVC);
  assert.deepEqual([m.body.purged, m.body.more], [PURGE_PAGES * PURGE_BATCH, true]);
  // a whole page that keeps failing: the call ends (what is behind it waits for the list to move: an open item)
  gone.clear();
  const h = fakeFetch(routes(() => true));
  const stuck = await read('purge', deps(h.fetch, {}, () => NOW), ALL, SVC);
  assert.deepEqual([stuck.body.purged, stuck.body.failed.length, stuck.body.more], [0, PURGE_BATCH, false]);
  assert.equal(h.calls.filter((c) => c.path === '/rest/v1/rpc/list_purgeable_imports').length, 1);
});
