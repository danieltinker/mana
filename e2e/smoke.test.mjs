// Phase 0 smoke: a browser on the local web server reaches the local stack through the gateway (CORS, the apikey
// header) and gets the seeded synthetic venue's published menu from public_menu, as the guest menu will.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { OUT, startE2E } from './helpers.mjs';

let e;
before(async () => { e = await startE2E({ seed: 'bistro-sim' }); }, { timeout: 180000 });
after(async () => { await e?.stop(); });

test('the gateway serves public_menu for the seeded venue to a browser fetch', async () => {
  const page = await e.page();
  const got = await page.evaluate(async ({ api, key, slug }) => {
    const r = await fetch(api + '/rest/v1/rpc/public_menu', { method: 'POST', headers: { apikey: key, 'content-type': 'application/json' }, body: JSON.stringify({ p_slug: slug }) });
    const j = await r.json();
    return { status: r.status, state: j.state, slug: j.snapshot?.slug, sections: j.snapshot?.sections.map((s) => s.name.en), off: j.live?.off, origin: location.origin };
  }, { api: e.stack.apiUrl, key: e.stack.anonKey, slug: e.venue.slug });
  assert.deepEqual(got.status, 200);
  assert.deepEqual([got.state, got.slug], ['ok', 'bistro-sim']);
  assert.deepEqual(got.sections, ['Mains', 'Drinks', 'Pastries']);
  assert.deepEqual(got.off, []);
  assert.notEqual(got.origin, e.stack.apiUrl, 'a cross-origin call: the gateway answered CORS');
  // the published config the apps will read points at the local stack
  const config = await page.evaluate(async (u) => (await fetch(u)).text(), e.webUrl + 'config.js');
  assert.match(config, new RegExp(e.stack.apiUrl.replace(/[.:/]/g, '\\$&')));
  assert.deepEqual(page.problems, []);
  await page.screenshot({ path: path.join(OUT, 'smoke.png') });
});
