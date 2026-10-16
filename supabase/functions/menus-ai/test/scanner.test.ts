/**
 * The v2 scanner with every outside call mocked (no network, no model, no cost): the Supabase project (PostgREST and
 * Storage) and the Messages API are routes of a fake `fetch`. The model's answers are synthetic JSON Lines.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftCounts, draftExceptions, validateDraft, type ClaimScanReply, type ImportDraft } from '@mana/contracts';
import { MAX_TOKENS, requestBody, sniffMedia, toBase64, upstreamError } from '../anthropic.ts';
import type { Deps, Env } from '../deps.ts';
import { cleanStock, handle } from '../handler.ts';
import { isServiceCaller } from '../purge.ts';
import { plan, WOLT_BATCH } from '../read.ts';

const URL_ = 'https://project.test';
const API = 'https://api.anthropic.com/v1/messages';
const VENUE = '00000000-0000-4000-8000-0000000000c1';
const IMPORT = '00000000-0000-4000-8000-0000000000d1';
const SERVICE = 'test-service';
const ENV: Env = { url: URL_, anonKey: 'test-anon', serviceKey: SERVICE, anthropicKey: 'test-model', workspaceId: '', model: 'test-model-id' };

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(7)]);
const HEIC = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode('ftypheic'), ...new Array(32).fill(0)]);

type Call = { method: string; url: string; path: string; headers: Record<string, string>; body: any };
type Route = (c: Call, signal?: AbortSignal | null) => Response | Promise<Response>;

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const modelAnswer = (text: string, stop = 'end_turn') => jsonResponse({ content: [{ type: 'text', text }], stop_reason: stop, usage: { input_tokens: 1000, output_tokens: 200 } });

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
    const call = { method, url, path, headers, body };
    calls.push(call);
    const key = Object.keys(routes).find((k) => { const [m, p] = k.split(' ', 2); return m === method && path.startsWith(p!); });
    if (!key) throw new Error(`no route for ${method} ${url}`);
    return routes[key]!(call, init.signal);
  };
  return { fetch: f as typeof fetch, calls };
}

function deps(fetch: typeof globalThis.fetch, env: Partial<Env> = {}, now: () => number = () => 1_760_000_000_000): Deps & { logs: Record<string, unknown>[] } {
  const logs: Record<string, unknown>[] = [];
  return { env: { ...ENV, ...env }, fetch, now, log: (e) => void logs.push(e), logs };
}

const claimReply = (source: ClaimScanReply['source'], n: number, langs: ClaimScanReply['langs'] = ['he', 'en']): ClaimScanReply => ({
  ok: true, importId: IMPORT, venueId: VENUE, source, paths: Array.from({ length: n }, (_, i) => `${VENUE}/imports/${IMPORT}/${i + 1}.jpg`), rightsConfirmed: false, langs,
});

/** The Supabase side as the backend lane's RPCs answer (ADR-008), with the scanner's own draft checked and stored. */
function project(source: ClaimScanReply['source'], images: number, o: { image?: Uint8Array<ArrayBuffer>; save?: (draft: ImportDraft) => Response; claim?: () => Response } = {}) {
  const saved: ImportDraft[] = [];
  const routes: Record<string, Route> = {
    'GET /rest/v1/menu_imports': () => jsonResponse([{ source }]),
    'POST /rest/v1/rpc/claim_import_scan': () => (o.claim ? o.claim() : jsonResponse(claimReply(source, images))),
    'GET /storage/v1/object/menu-private/': () => new Response(o.image ?? JPEG, { status: 200 }),
    'POST /rest/v1/rpc/save_import_draft': (c) => {
      const draft = c.body.p_draft as ImportDraft;
      saved.push(draft);
      if (o.save) return o.save(draft);
      return jsonResponse({ ok: true, exceptions: draftExceptions(draft), counts: draftCounts(draft) });
    },
    'PATCH /rest/v1/menu_imports': () => new Response(null, { status: 204 }),
  };
  return { routes, saved };
}

const read = (action: string, d: Deps, body: Record<string, unknown> = {}, headers: Record<string, string> = { Authorization: 'Bearer owner-token', apikey: 'test-anon' }) =>
  handle(new Request('https://fn.test/menus-ai', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ action, import_id: IMPORT, ...body }) }), d)
    .then(async (r) => ({ status: r.status, body: await r.json() as any }));

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
  for (const n of [2, 6, 13, 20]) {
    const p = plan('wolt_screenshots', n);
    assert.deepEqual([...new Set(p.flat())], Array.from({ length: n }, (_, i) => i), `every screenshot is read (${n})`);
    assert.ok(p.every((b) => b.length <= WOLT_BATCH));
  }
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

test('status, and not_configured: with no model key nothing is claimed or fetched', async () => {
  const f = fakeFetch({});
  assert.deepEqual((await read('status', deps(f.fetch))).body, { ok: true, configured: true });
  assert.deepEqual((await read('status', deps(f.fetch, { anthropicKey: '' }))).body, { ok: true, configured: false });
  assert.deepEqual((await read('wolt_screenshots', deps(f.fetch, { anthropicKey: '' }))).body, { ok: false, code: 'not_configured' });
  assert.equal(f.calls.length, 0);
});

test('a mode that is not the import\'s source is refused before the claim', async () => {
  const p = project('scan', 1);
  const f = fakeFetch(p.routes);
  assert.deepEqual((await read('wolt_screenshots', deps(f.fetch))).body, { ok: false, code: 'source_mismatch' });
  assert.deepEqual(f.calls.map((c) => `${c.method} ${c.path}`), ['GET /rest/v1/menu_imports']);
});

test('the claim gates every paid call: refused, nothing is downloaded or read', async () => {
  for (const [reply, code] of [[jsonResponse({ ok: false, code: 'rate_limited' }), 'rate_limited'], [jsonResponse({ code: '42501', message: 'not_allowed' }, 403), 'not_allowed'],
    [jsonResponse({ ok: false, code: 'import_busy' }), 'import_busy']] as const) {
    const p = project('wolt_screenshots', 3, { claim: () => reply.clone() });
    const f = fakeFetch(p.routes);
    assert.deepEqual((await read('wolt_screenshots', deps(f.fetch))).body, { ok: false, code });
    assert.ok(!f.calls.some((c) => c.url === API || c.path.startsWith('/storage/')), code);
  }
});

// ---------------------------------------------------------------- reading

test('Wolt screenshots: claimed with the owner\'s token, read in overlapping runs, merged, saved as the service role', async () => {
  const p = project('wolt_screenshots', 7);
  const answers = [SHOT_1, SHOT_2];
  const f = fakeFetch({ ...p.routes, [`POST ${API}`]: () => modelAnswer(answers.shift()!) });
  const r = await read('wolt_screenshots', deps(f.fetch), { stock: [{ id: 'schnitzel', label: 'schnitzel' }] });
  assert.equal(r.body.ok, true, JSON.stringify(r.body));
  // order: nothing paid before the claim
  const order = f.calls.map((c) => (c.url === API ? 'model' : `${c.method} ${c.path.replace(/\/menu-private\/.*/, '/…')}`));
  assert.deepEqual(order.slice(0, 2), ['GET /rest/v1/menu_imports', 'POST /rest/v1/rpc/claim_import_scan']);
  assert.ok(order.indexOf('model') > order.indexOf('POST /rest/v1/rpc/claim_import_scan'));
  const claim = f.calls.find((c) => c.path === '/rest/v1/rpc/claim_import_scan')!;
  assert.equal(claim.headers.authorization, 'Bearer owner-token', 'the claim runs as the owner');
  assert.deepEqual(claim.body, { p_import: IMPORT });
  const save = f.calls.find((c) => c.path === '/rest/v1/rpc/save_import_draft')!;
  assert.equal(save.headers.authorization, `Bearer ${SERVICE}`, 'the draft is saved by the service role');
  const models = f.calls.filter((c) => c.url === API);
  assert.deepEqual(models.map((c) => c.body.messages[0].content.filter((x: any) => x.type === 'image').length), [5, 3]);
  assert.equal(models[0]!.headers['x-api-key'], 'test-model');
  // the saved draft
  const draft = p.saved[0]!;
  assert.ok(validateDraft(draft).ok);
  assert.equal(draft.source, 'wolt_screenshots');
  assert.deepEqual(draft.sections.map((s) => [s.name.en, s.dishes.map((x) => x.name.en)]), [['Mains', ['Schnitzel', 'Burger', 'Falafel']], ['Drinks', ['Lemonade']]]);
  assert.equal(draft.sections[0]!.dishes[0]!.illustration, 'schnitzel');
  assert.deepEqual(r.body.counts, { sections: 2, dishes: 4, groups: 1, options: 2, photos: 0 });
  assert.deepEqual(r.body.usage, { in: 2000, out: 400 });
  assert.equal(r.body.calls, 2);
  assert.ok(!f.calls.some((c) => c.method === 'PATCH'), 'nothing marked failed');
});

test('a printed menu: one call per page; a page that continues a section joins it', async () => {
  const p = project('scan', 2);
  const answers = ['{"lang":"he"}\n{"c":{"he":"עיקריות","en":"Mains"}}\n{"n":{"he":"מרק","en":"Soup"},"p":"30","tr":["en"]}', '{"lang":"he"}\n{"n":{"he":"תבשיל","en":"Stew"},"p":"60","tr":["en"]}'];
  const f = fakeFetch({ ...p.routes, [`POST ${API}`]: () => modelAnswer(answers.shift()!) });
  const r = await read('scan_menu', deps(f.fetch));
  assert.equal(r.body.ok, true);
  assert.deepEqual(p.saved[0]!.sections.map((s) => [s.name.he, s.dishes.map((x) => x.name.he)]), [['עיקריות', ['מרק', 'תבשיל']]]);
  assert.equal(f.calls.filter((c) => c.url === API).length, 2);
});

test('an answer cut at its length limit is kept, and its page is noted', async () => {
  const p = project('scan', 1);
  const f = fakeFetch({ ...p.routes, [`POST ${API}`]: () => modelAnswer(`${SHOT_1}\n{"n":{"he":"מנה","en":"Di`, 'max_tokens') });
  const r = await read('scan_menu', deps(f.fetch));
  assert.equal(r.body.ok, true);
  assert.ok(r.body.notes.some((n: any) => n.code === 'page_truncated'));
  assert.equal(r.body.dropped, 1);
});

test('failures after the claim mark the import failed with a closed code, and nothing is saved', async () => {
  const cases: Array<[string, Partial<Parameters<typeof project>[2]>, Route | null, string, number | undefined]> = [
    ['an image the API cannot read (HEIC)', { image: HEIC }, null, 'image_unreadable', undefined],
    ['the API refuses the image', {}, () => jsonResponse({ error: { type: 'invalid_request_error', message: 'Could not process image' } }, 400), 'image_unreadable', 400],
    ['the API is overloaded', {}, () => jsonResponse({ error: { type: 'overloaded_error' } }, 529), 'model_failed', 529],
    ['no menu on any page', {}, () => modelAnswer('{"lang":"other"}\n{"error":"not_a_menu"}'), 'image_unreadable', undefined],
  ];
  for (const [label, o, model, code, upstream] of cases) {
    const p = project('scan', 1, o);
    const f = fakeFetch({ ...p.routes, ...(model ? { [`POST ${API}`]: model } : {}) });
    const r = await read('scan_menu', deps(f.fetch));
    assert.deepEqual(r.body, upstream === undefined ? { ok: false, code } : { ok: false, code, upstream }, label);
    const patch = f.calls.find((c) => c.method === 'PATCH')!;
    assert.deepEqual([patch.url.endsWith(`id=eq.${IMPORT}&status=eq.parsing`), patch.body], [true, { status: 'failed', error_code: code }], label);
    assert.equal(p.saved.length, 0, label);
    if (!model) assert.ok(!f.calls.some((c) => c.url === API), `${label}: no paid call`);
  }
  // a missing file
  const p = project('scan', 1);
  const f = fakeFetch({ ...p.routes, 'GET /storage/v1/object/menu-private/': () => new Response('not found', { status: 404 }) });
  assert.deepEqual((await read('scan_menu', deps(f.fetch))).body, { ok: false, code: 'image_unreadable' });
});

test('past the deadline the read stops and the import is marked timeout', async () => {
  const p = project('scan', 1);
  let t = 0;
  const now = () => (t++ === 0 ? 0 : 10_000_000);
  const hang: Route = (_c, signal) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
  const f = fakeFetch({ ...p.routes, [`POST ${API}`]: hang });
  assert.deepEqual((await read('scan_menu', deps(f.fetch, {}, now))).body, { ok: false, code: 'timeout' });
  assert.deepEqual(f.calls.find((c) => c.method === 'PATCH')!.body, { status: 'failed', error_code: 'timeout' });
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

test('purge: only the service role; images deleted through Storage, then the import records it', async () => {
  const rows = [{ id: '00000000-0000-4000-8000-0000000000e1', raw_paths: [`${VENUE}/imports/a/1.jpg`, `${VENUE}/imports/a/2.jpg`] }, { id: '00000000-0000-4000-8000-0000000000e2', raw_paths: [`${VENUE}/imports/b/1.jpg`] }];
  let deletes = 0;
  const f = fakeFetch({
    'GET /rest/v1/app_config': () => jsonResponse([{ value: 30 }]),
    'GET /rest/v1/menu_imports': () => jsonResponse(rows),
    'DELETE /storage/v1/object/menu-private': () => new Response('[]', { status: deletes++ === 0 ? 200 : 500 }),
    'PATCH /rest/v1/menu_imports': () => new Response(null, { status: 204 }),
  });
  const now = () => Date.parse('2026-10-16T12:00:00Z');
  const asOwner = await read('purge', deps(f.fetch, {}, now), {});
  assert.deepEqual([asOwner.status, asOwner.body], [403, { ok: false, code: 'not_allowed' }]);
  assert.equal(f.calls.length, 0);
  const r = await read('purge', deps(f.fetch, {}, now), { import_id: undefined }, { Authorization: `Bearer ${SERVICE}` });
  assert.deepEqual(r.body, { ok: true, purged: 1, failed: [rows[1]!.id] });
  const list = f.calls.find((c) => c.method === 'GET' && c.path === '/rest/v1/menu_imports')!;
  assert.match(list.url, /status=in\.\(applied,discarded,failed\)/);
  assert.match(list.url, /raw_purged_at=is\.null/);
  assert.ok(list.url.includes(`updated_at=lt.${encodeURIComponent('2026-09-16T12:00:00.000Z')}`), 'retention: 30 days');
  assert.deepEqual(f.calls.find((c) => c.method === 'DELETE')!.body, { prefixes: rows[0]!.raw_paths });
  assert.deepEqual(f.calls.filter((c) => c.method === 'PATCH').map((c) => c.body), [{ raw_paths: [], raw_purged_at: '2026-10-16T12:00:00.000Z' }]);
  assert.deepEqual((await read('purge', deps(f.fetch, {}, now), { import_id: 'nope' }, { Authorization: `Bearer ${SERVICE}` })).body, { ok: false, code: 'bad_request' });
});
