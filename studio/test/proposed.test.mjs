// The proposed migrations (db/proposed/0003, 0004) loaded after db/00*.sql into the stack's own Postgres, and used the way the
// app and the guest menu will use them: through PostgREST with the owner's JWT, and the counts with only the public key.
// No browser. Run: npm run test:proposed   (STACK_PORT_BASE moves the ports)
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { startStack } from './stack/start.mjs';

let stack;
const PASSWORD = 'correct-horse-9';
const unique = (p) => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const sql = (q) => stack.sql(q).trim();
const rpcAnon = (fn, body) => fetch(stack.API_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: stack.ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });

before(async () => { stack = await startStack({ gen: 'fake', extraSql: true }); });
after(async () => { await stack?.stop(); });

async function owner() {
  const email = unique('owner') + '@example.ai';                                   // fictional; ".ai" on purpose (t299)
  const r = await fetch(stack.API_URL + '/functions/v1/menus-signup', { method: 'POST', headers: { apikey: stack.ANON_KEY, 'content-type': 'application/json', 'x-test-client': email },
    body: JSON.stringify({ email, password: PASSWORD, hp: '', elapsed_ms: 4000 }) }).then((x) => x.json());
  assert.deepEqual(r, { ok: true }, 'sign-up with a .ai address');
  const client = createClient(stack.API_URL, stack.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  assert.equal(error, null);
  return client;
}

test('0003: both files loaded; the stack says so in the app config', async () => {
  assert.equal(sql(`select count(*) from information_schema.columns where table_schema = 'public' and (table_name, column_name) in (('businesses', 'book_url'), ('menus', 'template'))`), '2');
  assert.equal(sql(`select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('menu_events_daily', 'site_events_daily')`), '2');
  const cfg = await fetch(stack.WEB_URL + 'config.js').then((r) => r.text());
  assert.match(cfg, /"bookUrl": true/, 'the app may send book_url against this stack');
});

test('0003: an owner sets book_url and template through PostgREST; publish; open_menu carries both', async () => {
  const c = await owner();
  const slug = unique('book');
  const b = await c.rpc('create_business', { p_slug: slug, p_name_he: 'בית קפה', p_name_en: 'Cafe', p_kind: 'cafe', p_contact_name: '', p_contact_phone: '' });
  assert.equal(b.data.ok, true, JSON.stringify(b.error || b.data));
  const id = b.data.id;
  // the same validation as order_url: https only, no spaces, up to 300 characters
  for (const bad of ['http://ontopo.example/x', 'https://ontopo.example/with space', 'https://' + 'o'.repeat(300)]) {
    const r = await c.from('businesses').update({ book_url: bad }).eq('id', id).select('book_url').single();
    assert.ok(r.error, 'refused: ' + bad); assert.equal(r.error.code, '23514', bad);
  }
  const ok = await c.from('businesses').update({ book_url: 'https://ontopo.example/cafe' }).eq('id', id).select('book_url').single();
  assert.equal(ok.error, null, JSON.stringify(ok.error)); assert.equal(ok.data.book_url, 'https://ontopo.example/cafe');
  const badT = await c.from('menus').update({ template: 'Album Side' }).eq('business_id', id).select('template').single();
  assert.equal(badT.error?.code, '23514', 'a template id matches ^[a-z0-9-]{1,40}$');
  const okT = await c.from('menus').update({ template: 'album-side' }).eq('business_id', id).select('template').single();
  assert.equal(okT.error, null, JSON.stringify(okT.error)); assert.equal(okT.data.template, 'album-side');
  // the preview and the published snapshot carry both (still v: 1)
  const cat = await c.from('categories').insert({ business_id: id, name_he: 'עיקריות', name_en: 'Mains', kind: 'food', position: 0 }).select().single();
  assert.equal(cat.error, null);
  const it = await c.from('items').insert({ business_id: id, category_id: cat.data.id, position: 0, name_he: 'חומוס', name_en: 'Hummus', price_minor: 3200 }).select().single();
  assert.equal(it.error, null);
  const prev = await c.rpc('preview_snapshot', { p_business: id });
  assert.equal(prev.data.business.bookUrl, 'https://ontopo.example/cafe'); assert.equal(prev.data.theme.template, 'album-side'); assert.equal(prev.data.v, 1);
  const pub = await c.rpc('publish_menu', { p_business: id, p_note: null });
  assert.equal(pub.data.ok, true, JSON.stringify(pub.error || pub.data));
  const open = await rpcAnon('open_menu', { p_slug: slug, p_lang: 'he', p_src: 'qr' }).then((r) => r.json());
  assert.equal(open.state, 'ok');
  assert.equal(open.snapshot.business.bookUrl, 'https://ontopo.example/cafe', 'the guest menu gets the booking link');
  assert.equal(open.snapshot.theme.template, 'album-side', 'and the look');
  assert.equal(open.snapshot.business.orderUrl, null, 'order_url untouched');
  // cleared: null again, and the next publish carries null
  const clr = await c.from('businesses').update({ book_url: null }).eq('id', id).select('book_url').single();
  assert.equal(clr.data.book_url, null);
  await c.rpc('publish_menu', { p_business: id, p_note: null });
  const open2 = await rpcAnon('open_menu', { p_slug: slug, p_lang: 'he', p_src: 'link' }).then((r) => r.json());
  assert.equal(open2.snapshot.business.bookUrl, null);
  assert.equal(open2.snapshot.revision, 2);
  stack.slug = slug; stack.bizId = id; stack.client = c;
});

test('0004: track_menu counts book and seat per menu per day, ignores the rest, and caps; track_site counts the page', async () => {
  const { slug, bizId, client } = stack;
  const day = sql(`select (now() at time zone 'Asia/Jerusalem')::date`);
  for (let i = 0; i < 3; i++) assert.ok((await rpcAnon('track_menu', { p_slug: slug, p_kind: 'book' })).ok);
  assert.ok((await rpcAnon('track_menu', { p_slug: slug, p_kind: 'seat' })).ok);
  for (const [s, k] of [[slug, 'open'], [slug, ''], [slug, null], ['no-such-menu', 'book'], [null, 'book']]) assert.ok((await rpcAnon('track_menu', { p_slug: s, p_kind: k })).ok, 'never an error');
  assert.equal(sql(`select kind || '=' || n from public.menu_events_daily where business_id = '${bizId}' and day = '${day}' order by kind`).split('\n').join(','), 'book=3,seat=1');
  // the owner reads their own counts; another owner reads nothing
  const mine = await client.from('menu_events_daily').select('kind, n').eq('business_id', bizId).order('kind');
  assert.deepEqual(mine.data, [{ kind: 'book', n: 3 }, { kind: 'seat', n: 1 }]);
  const other = await owner();
  const theirs = await other.from('menu_events_daily').select('kind, n').eq('business_id', bizId);
  assert.deepEqual(theirs.data, [], 'row level security');
  const write = await other.from('menu_events_daily').insert({ business_id: bizId, day, kind: 'book', n: 100 });
  assert.ok(write.error, 'nobody writes the counts through the API');
  // the cap, set low for the test: the day's count stops growing
  sql(`update public.app_config set value = '{"menu": 5, "site": 4}' where key = 'event_caps'`);
  for (let i = 0; i < 10; i++) await rpcAnon('track_menu', { p_slug: slug, p_kind: 'book' });
  assert.equal(sql(`select n from public.menu_events_daily where business_id = '${bizId}' and day = '${day}' and kind = 'book'`), '5', 'capped at 5 a day');
  // an unpublished menu is not counted
  await client.rpc('unpublish_menu', { p_business: bizId });
  await rpcAnon('track_menu', { p_slug: slug, p_kind: 'seat' });
  assert.equal(sql(`select n from public.menu_events_daily where business_id = '${bizId}' and day = '${day}' and kind = 'seat'`), '1');
  // the product page
  for (let i = 0; i < 6; i++) await rpcAnon('track_site', { p_kind: 'view' });
  await rpcAnon('track_site', { p_kind: 'start' });
  await rpcAnon('track_site', { p_kind: 'nope' });
  assert.equal(sql(`select kind || '=' || n from public.site_events_daily where day = '${day}' order by kind`).split('\n').join(','), 'start=1,view=4', 'view capped at 4');
  const anonRead = await fetch(stack.API_URL + '/rest/v1/site_events_daily?select=*', { headers: { apikey: stack.ANON_KEY } });
  assert.notEqual(anonRead.status, 200, 'the site counts are not readable through the API');
});
