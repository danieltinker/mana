// The client walkthrough (D38, phase 1's acceptance test) on the simulator's stack, with the invented café
// (tools/demo-scenarios/client-walkthrough.mjs): every step on all three sides passes through the real apps, each within
// its budget (e2e/walkthrough/scenario.mjs BUDGETS), and the page records them. Then the same scenario again on the
// same stack: a fresh venue, nothing collides. The pages: e2e/.out/walkthrough/walkthrough.html and
// e2e/.out/walkthrough/second/walkthrough.html (git-ignored). Needs the built site (bash tools/build-site.sh).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asAnon } from '@mana/sim';
import { localConfigText, readConfigText } from '../tools/env.mjs';
import { walkthrough } from '../tools/demo-scenarios/client-walkthrough.mjs';
import { demoAccounts } from './walkthrough/accounts.mjs';
import { BUDGETS, runWalkthrough } from './walkthrough/scenario.mjs';
import { PINA_SIM } from './fixtures/walkthrough-cafe.mjs';
import { OUT, startE2E } from './helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(OUT, 'walkthrough');
const STEPS = ['owner-signup', 'owner-venue', 'owner-import-text', 'owner-fix', 'owner-import-screenshots', 'owner-addons', 'owner-rules', 'owner-breakfast',
  'owner-publish', 'staff-approve', 'guest-choose', 'guest-dismiss', 'guest-load', 'owner-off', 'staff-observe', 'staff-act', 'owner-log'];
let e, config, origin;

before(async () => {
  e = await startE2E({ seed: null, signup: 'open' });
  if (!e.hasSite) throw new Error('the site is not built: run bash tools/build-site.sh first');
  origin = new URL(e.webUrl).origin;
  config = readConfigText(localConfigText({ apiUrl: e.stack.apiUrl, anonKey: e.stack.anonKey }), { origin });
}, { timeout: 180_000 });
after(async () => { await e?.stop(); });

/** One run, its steps checked: all passed, each within its budget, each with its screenshot and caption. */
async function runOnce(t, outDir) {
  const lines = [];
  const r = await walkthrough({ config, origin, root: ROOT, outDir, stack: e.stack, log: (l) => lines.push(l) });
  for (const s of r.steps) {
    t.diagnostic(`${String(s.n).padStart(2)} ${s.side.padEnd(5)} ${s.id.padEnd(25)} ${(s.ms / 1000).toFixed(1).padStart(5)} s / ${(s.budgetMs / 1000).toFixed(0)} s  ${s.verdict}${s.reason ? ': ' + s.reason : ''}`);
    if (s.detail) t.diagnostic(s.detail.replace(/\x1b\[\d+m/g, '').split('\n').slice(0, 8).join(' | '));
  }
  t.diagnostic(`total ${(r.summary.ms / 1000).toFixed(1)} s; page ${path.relative(ROOT, r.file)}`);
  assert.deepEqual(r.steps.map((s) => s.id), STEPS, 'every step of the script, in order');
  assert.deepEqual(r.steps.filter((s) => s.verdict !== 'pass').map((s) => `${s.id}: ${s.verdict} ${s.reason}`), [], 'every step passed');
  for (const s of r.steps) {
    assert.ok(s.ms <= BUDGETS[s.id], `${s.id} took ${s.ms} ms, budget ${BUDGETS[s.id]} ms`);
    assert.ok(s.caption.length > 20, `${s.id} has a caption`);
    assert.ok(s.shot && fs.existsSync(path.join(outDir, s.shot)), `${s.id} has a screenshot`);
  }
  assert.deepEqual([...new Set(r.steps.map((s) => s.side))].sort(), ['guest', 'owner', 'staff'], 'all three sides');
  // the page: self-contained (every screenshot inside it), the header's summary
  const html = fs.readFileSync(r.file, 'utf8');
  assert.match(html, new RegExp(`${STEPS.length} of ${STEPS.length} steps passed`));
  assert.match(html, /Local: the simulator’s stack/);
  assert.match(html, /Invented for this walkthrough/);
  assert.equal((html.match(/src="data:image\/jpeg;base64,/g) ?? []).length, STEPS.length * 2, 'each screenshot inline (and in its larger view)');
  assert.doesNotMatch(html, /src="(?!data:)/, 'nothing loaded from outside the file');
  assert.equal(lines.length, STEPS.length + 1, 'one terminal line per step, and the summary');
  return r;
}

test('the client walkthrough passes end to end on all three sides, each step within its budget', { timeout: 900_000 }, async (t) => {
  const r = await runOnce(t, DIR);
  // the end state, as guests get it: published, approved, the dish back, a demo venue
  const m = await asAnon(e.stack).rpc('public_menu', { p_slug: r.slug });
  assert.equal(m.state, 'ok');
  assert.deepEqual(m.live.off, [], 'the dish Halom restored is back');
  const [v] = await e.stack.sql('select is_demo, approved_at from public.venues where id = $1', [r.venueId]);
  assert.deepEqual([v.is_demo, !!v.approved_at], [true, true], 'labelled demo, approved');
});

test('a second run on the same stack makes a fresh venue and passes too', { timeout: 900_000 }, async (t) => {
  const first = (await e.stack.sql('select slug from public.venues order by created_at')).map((x) => x.slug);
  const r = await runOnce(t, path.join(DIR, 'second'));
  assert.ok(!first.includes(r.slug), 'a venue of its own');
  const venues = await e.stack.sql('select slug, is_demo from public.venues order by created_at');
  assert.equal(venues.length, first.length + 1);
  assert.ok(venues.every((x) => x.is_demo), 'every venue the walkthrough made is a demo venue');
});

test('demo without its accounts stops before anything is written, naming the step that needs each; production is refused', { timeout: 60_000 }, async () => {
  const before = (await e.stack.sql('select count(*)::int as n from public.venues'))[0].n;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'walkthrough-no-env-'));          // no private/demo.env there
  const outDir = path.join(root, 'out');
  const demo = { ...config, env: 'demo' };
  const accounts = demoAccounts({ root, env: 'demo', runId: 'x' });
  await assert.rejects(runWalkthrough({ input: PINA_SIM, config: demo, origin, outDir, accounts, title: 't' }), (err) => {
    assert.match(err.message, /step 1 \(the owner signs up\) needs a fresh demo address: set MANA_DEMO_OWNER_EMAIL in private\/demo\.env/);
    assert.match(err.message, /steps 10, 15 and 16 .* need a Halom admin's sign-in: set MANA_DEMO_STAFF_EMAIL and MANA_DEMO_STAFF_PASSWORD/);
    return true;
  });
  // an owner address without {run} would sign up the same account twice
  fs.mkdirSync(path.join(root, 'private'));
  fs.writeFileSync(path.join(root, 'private/demo.env'), 'MANA_DEMO_OWNER_EMAIL=owner@example.com\n');
  assert.match(demoAccounts({ root, env: 'demo', runId: 'x' }).problems.join(' '), /needs \{run\}/);
  assert.equal(fs.existsSync(outDir), false, 'no page, no folder');
  assert.equal((await e.stack.sql('select count(*)::int as n from public.venues'))[0].n, before, 'no venue');
  await assert.rejects(runWalkthrough({ input: PINA_SIM, config: { ...config, env: 'production' }, origin, outDir, title: 't' }), /never on production/);
  fs.rmSync(root, { recursive: true, force: true });
});
