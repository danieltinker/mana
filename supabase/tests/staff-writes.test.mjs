// Staff writes after the back office's review: a reason is a reason only when something visible is left once its blank
// edges are stripped (act_for_owner, ops_approve_venue, ops_set_plan check app.v_reason, the twin of isReason, and keep
// the reason stripped); ops_approve_venue names the revision the reviewer looked at; ops_set_plan never approves;
// act_for_owner('dish.update') is refused as stale when the owner saved the dish since staff read it.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { as, rpc } from './harness/cluster.mjs';
import { A, ID, U, world } from './harness/world.mjs';
import { isReason } from '../../packages/contracts/src/rpc.ts';

let w;
before(async () => { w = await world(); });
after(async () => { await w?.stop(); });

const cp = (...c) => String.fromCodePoint(...c);
const ZW = cp(0x200b);
/** Reasons with nothing visible in them, or only two visible characters. */
const BLANK = {
  'three zero-width spaces': ZW.repeat(3),
  'tabs': '\t\t\t\t',
  'NBSPs': cp(0xa0).repeat(4),
  'line feeds': '\n\n\n',
  'BOMs': cp(0xfeff).repeat(3),
  'U+3164': cp(0x3164).repeat(3),
  'tag characters': cp(0xe0041, 0xe0042, 0xe0043),
  'U+200F': cp(0x200f).repeat(3),
  'U+2800': cp(0x2800).repeat(3),
  'two letters in blanks': `${ZW}\tab${cp(0xa0)}\n`,
};
const logCount = async () => (await w.admin.query('select count(*)::int as n from public.activity_log')).rows[0].n;

async function newOwner(id, slug) {
  await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, $2, now())`, [id, `${slug}@example.invalid`]);
  const v = (await rpc(w.url, id, 'create_venue', { p_slug: slug, p_name_en: slug })).id;
  await as(w.url, id, async (c) => {
    const s = (await c.query(`insert into public.sections (venue_id, name_en) values ($1, 'Food') returning id`, [v])).rows[0].id;
    await c.query(`insert into public.dishes (venue_id, section_id, name_en, price) values ($1, $2, 'Soup', 3000)`, [v, s]);
  });
  return v;
}

describe('a staff reason is checked as isReason checks it, and stored stripped', () => {
  test('app.v_reason is isReason', async () => {
    const list = [...Object.values(BLANK), '', 'ab', 'abc', ' abc ', `abc${ZW.repeat(498)}`, 'a'.repeat(500), 'a'.repeat(501),
      `${ZW}${'a'.repeat(500)}${cp(0xa0)}`, `${'a'.repeat(499)}${cp(0x2615, 0xfe0f)}`, `${cp(0x1f354).repeat(500)}`, `${cp(0x1f354).repeat(501)}`,
      'שלום', `a${ZW}b`, `${cp(0x5d0)}${cp(0x200f)}${cp(0x5d1)}`];
    const { rows } = await w.admin.query(`select coalesce(jsonb_agg(app.v_reason(x) order by i), '[]') as r from jsonb_array_elements($1::jsonb) with ordinality t(x, i)`,
      [JSON.stringify(list)]);
    list.forEach((s, i) => assert.equal(rows[0].r[i], isReason(s), JSON.stringify(s)));
    for (const v of [null, 5, {}, []]) {
      assert.equal((await w.admin.query(`select app.v_reason($1::jsonb) as r`, [JSON.stringify(v)])).rows[0].r, isReason(v), JSON.stringify(v));
    }
  });

  test('act_for_owner: blank and invisible reasons write nothing; 500 characters after stripping is the most', async () => {
    const afo = (reason) => rpc(w.url, U.support, 'act_for_owner', { p_venue: A, p_reason: reason, p_action: 'availability.restore',
      p_payload: { targetKind: 'dish', targetId: ID.burger } });
    const before = await logCount();
    for (const [what, reason] of Object.entries(BLANK)) assert.deepEqual(await afo(reason), { ok: false, code: 'reason_required' }, what);
    assert.deepEqual(await afo('a'.repeat(501)), { ok: false, code: 'reason_required' });
    assert.equal(await logCount(), before, 'nothing written');
    assert.equal((await afo(`${ZW}\t${'a'.repeat(500)}${cp(0xa0)}\n`)).ok, true);
    assert.equal((await afo(`abc${ZW.repeat(498)}`)).ok, true, 'three visible characters and zero-width ones: a reason (isReason says so too)');
    const { rows } = await w.admin.query(`select reason from public.activity_log where venue_id = $1 and action = 'support.act_for_owner' order by id desc limit 2`, [A]);
    assert.deepEqual(rows.map((r) => r.reason), ['abc', 'a'.repeat(500)], 'kept stripped');
  });

  test('ops_approve_venue and ops_set_plan: the same rule', async () => {
    const O = '11111111-1111-4111-8111-1111111111c7';
    const v = await newOwner(O, 'blank-reasons');
    const pub = await rpc(w.url, O, 'publish_menu', { p_venue: v });
    assert.equal(pub.review, 'pending');
    const before = await logCount();
    for (const [what, reason] of Object.entries(BLANK)) {
      assert.deepEqual(await rpc(w.url, U.support, 'ops_approve_venue', { p_venue: v, p_reason: reason, p_expected_revision: pub.revision }),
        { ok: false, code: 'reason_required' }, `approve: ${what}`);
      assert.deepEqual(await rpc(w.url, U.admin, 'ops_set_plan', { p_venue: w.B, p_state: 'suspended', p_reason: reason }),
        { ok: false, code: 'reason_required' }, `plan: ${what}`);
    }
    assert.deepEqual(await rpc(w.url, U.admin, 'ops_set_plan', { p_venue: w.B, p_state: 'suspended', p_reason: 'b'.repeat(501) }), { ok: false, code: 'reason_required' });
    assert.equal(await logCount(), before, 'nothing written');
    assert.equal((await w.admin.query('select approved_at from public.venues where id = $1', [v])).rows[0].approved_at, null);
    assert.notEqual((await w.admin.query('select status from public.entitlements where venue_id = $1', [w.B])).rows[0].status, 'suspended');
    const last = (await w.admin.query('select max(id) as id from public.activity_log')).rows[0].id;

    const ok = await rpc(w.url, U.support, 'ops_approve_venue', { p_venue: v, p_reason: `${cp(0xfeff)}Menu checked${ZW}`, p_expected_revision: pub.revision });
    assert.equal(ok.ok, true, JSON.stringify(ok));
    const plan = await rpc(w.url, U.admin, 'ops_set_plan', { p_venue: w.B, p_state: 'suspended', p_reason: `\t${'b'.repeat(500)}\t` });
    assert.deepEqual(plan, { ok: true, state: 'suspended' });
    const { rows } = await w.admin.query(`select action, reason from public.activity_log where action in ('venue.approve', 'plan.set') and id > $1 order by id`, [last]);
    assert.deepEqual(rows, [{ action: 'venue.approve', reason: 'Menu checked' }, { action: 'plan.set', reason: 'b'.repeat(500) }]);
    assert.deepEqual(await rpc(w.url, U.admin, 'ops_set_plan', { p_venue: w.B, p_state: 'active', p_reason: 'Back online' }), { ok: true, state: 'active' });
  });
});

describe('ops_approve_venue names the revision the reviewer looked at', () => {
  test('revision_invalid, revision_changed with the newest number, then the approval of the newest', async () => {
    const O = '11111111-1111-4111-8111-1111111111c8';
    const v = await newOwner(O, 'two-revisions');
    assert.equal((await rpc(w.url, O, 'publish_menu', { p_venue: v })).revision, 1);
    const approve = (rev) => rpc(w.url, U.support, 'ops_approve_venue', { p_venue: v, p_reason: 'Menu checked', p_expected_revision: rev });
    assert.deepEqual(await approve(null), { ok: false, code: 'revision_invalid' });
    assert.deepEqual(await approve(0), { ok: false, code: 'revision_invalid' });
    // the owner publishes again while the reviewer looks at revision 1
    const again = await rpc(w.url, O, 'publish_menu', { p_venue: v, p_note: 'fixed a price' });
    assert.deepEqual([again.revision, again.review], [2, 'pending']);
    const before = await logCount();
    assert.deepEqual(await approve(1), { ok: false, code: 'revision_changed', revision: 2 });
    assert.deepEqual(await approve(3), { ok: false, code: 'revision_changed', revision: 2 });
    assert.equal(await logCount(), before, 'a refused approval writes nothing');
    assert.equal((await approve(2)).ok, true);
    const { rows } = await w.admin.query(`select detail from public.activity_log where venue_id = $1 and action = 'venue.approve'`, [v]);
    assert.equal(rows[0].detail.revision, 2);
    assert.deepEqual(await approve(2), { ok: false, code: 'already_approved' });
    assert.deepEqual(await rpc(w.url, U.support, 'ops_approve_venue', { p_venue: '00000000-0000-4000-8000-00000000ffff', p_reason: 'Menu checked', p_expected_revision: 1 }),
      { ok: false, code: 'venue_unknown' });
    const unpublished = await newOwner('11111111-1111-4111-8111-1111111111c9', 'never-published');
    assert.deepEqual(await rpc(w.url, U.support, 'ops_approve_venue', { p_venue: unpublished, p_reason: 'Menu checked', p_expected_revision: 1 }),
      { ok: false, code: 'not_published' });
    // published, then taken down by its owner before the review: nothing published is not_published, never a revision
    const O2 = '11111111-1111-4111-8111-1111111111cb';
    const down = await newOwner(O2, 'taken-down');
    assert.equal((await rpc(w.url, O2, 'publish_menu', { p_venue: down })).revision, 1);
    assert.equal((await rpc(w.url, O2, 'unpublish_menu', { p_venue: down })).ok, true);
    assert.deepEqual(await rpc(w.url, U.support, 'ops_approve_venue', { p_venue: down, p_reason: 'Menu checked', p_expected_revision: 1 }),
      { ok: false, code: 'not_published' });
    assert.equal((await rpc(w.url, O, 'ops_approve_venue', { p_venue: v, p_reason: 'approving myself', p_expected_revision: 2 })).error?.code, '42501');
  });
});

describe('ops_set_plan never approves', () => {
  test('a venue waiting for approval: trialing and active answer approval_first; the other states go through', async () => {
    const O = '11111111-1111-4111-8111-1111111111ca';
    const v = await newOwner(O, 'waits-for-review');
    const pub = await rpc(w.url, O, 'publish_menu', { p_venue: v });
    const set = (state) => rpc(w.url, U.admin, 'ops_set_plan', { p_venue: v, p_state: state, p_reason: 'Plan set by hand' });
    const before = await logCount();
    assert.deepEqual(await set('trialing'), { ok: false, code: 'approval_first' });
    assert.deepEqual(await set('active'), { ok: false, code: 'approval_first' });
    assert.equal(await logCount(), before);
    const venue = async () => (await w.admin.query('select approved_at from public.venues where id = $1', [v])).rows[0];
    assert.deepEqual(await venue(), { approved_at: null }, 'never approved by a plan');
    assert.deepEqual(await set('suspended'), { ok: true, state: 'suspended' });
    assert.deepEqual(await set('pending'), { ok: true, state: 'pending' });
    assert.deepEqual(await venue(), { approved_at: null });
    assert.equal((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'waits-for-review' })).state, 'unavailable');
    assert.equal((await rpc(w.url, U.support, 'ops_approve_venue', { p_venue: v, p_reason: 'Menu checked', p_expected_revision: pub.revision })).ok, true);
    assert.deepEqual(await set('active'), { ok: true, state: 'active' }, 'once approved');
    assert.deepEqual(await rpc(w.url, U.admin, 'ops_set_plan', { p_venue: '00000000-0000-4000-8000-00000000ffff', p_state: 'active', p_reason: 'Plan set by hand' }),
      { ok: false, code: 'venue_unknown' });
  });
});

describe('act_for_owner dish.update: the dish as staff read it', () => {
  test('the owner saved since: stale with the dish as it is, nothing written; the current updated_at goes through', async () => {
    const read = async () => (await w.admin.query(`select price, desc_en, updated_at, to_jsonb(updated_at) #>> '{}' as at from public.dishes where id = $1`, [ID.burger])).rows[0];
    const seen = await read();
    await as(w.url, U.ownerA, (c) => c.query(`update public.dishes set price = 6900 where id = $1`, [ID.burger]));
    const before = await logCount();
    const afo = (at, patch = { price: 7000 }) => rpc(w.url, U.support, 'act_for_owner', { p_venue: A, p_reason: 'Owner asked by phone',
      p_action: 'dish.update', p_payload: { dishId: ID.burger, patch, expectedUpdatedAt: at } });
    const stale = await afo(seen.at);
    assert.equal(stale.ok, false);
    assert.equal(stale.code, 'stale');
    const now = await read();
    assert.deepEqual([stale.current.id, stale.current.price, new Date(stale.current.updated_at).toISOString()], [ID.burger, 6900, now.updated_at.toISOString()]);
    assert.equal(now.price, 6900, 'nothing written');
    assert.equal(await logCount(), before, 'no activity row');
    assert.deepEqual(await afo('yesterday'), { ok: false, code: 'payload_invalid' });
    assert.equal(stale.action, 'dish.update');
    assert.equal(stale.current.updated_at, now.at, 'the version to the microsecond, as staff send it back');
    const sameSecond = now.at.replace(/\.\d+(?=Z$|[+-]\d\d:\d\d$)/, '');
    assert.equal((await afo(sameSecond)).code, 'stale', 'the same second is not the same version');
    assert.deepEqual(await afo(stale.current.updated_at, { name_he: '', name_en: ' ' }), { ok: false, code: 'payload_invalid' }, 'never a dish with no name');
    const ok = await afo(stale.current.updated_at);
    assert.equal(ok.ok, true, JSON.stringify(ok));
    assert.equal((await read()).price, 7000);
  });
});

describe('a version read is a version sent back', () => {
  test('the dish as staff read it (a table read, as PostgREST gives it: to the microsecond) is accepted as it was read', async () => {
    const [row] = await as(w.url, U.support, async (c) => (await c.query(`select to_jsonb(d) as d from public.dishes d where id = $1`, [ID.schnitzel])).rows.map((r) => r.d));
    assert.match(row.updated_at, /\.\d{1,6}\+00:00$/, 'microseconds');
    const r = await rpc(w.url, U.support, 'act_for_owner', { p_venue: A, p_reason: 'Owner asked by phone', p_action: 'dish.update',
      p_payload: { dishId: ID.schnitzel, patch: { price_note_en: 'Lunch only' }, expectedUpdatedAt: row.updated_at } });
    assert.equal(r.ok, true, JSON.stringify(r));
  });

  test('a step as ops_venue and my_dashboard give it is accepted as it was read', async () => {
    const step = async () => (await rpc(w.url, U.support, 'ops_venue', { p_venue: A })).onboarding.steps.find((s) => s.step === 'hours');
    const dash = (await rpc(w.url, U.ownerA, 'my_dashboard', { p_venue: A, p_range: 'today' }));
    const seen = await step();
    const fromDash = (dash.onboarding.steps ?? dash.onboarding).find((s) => s.step === 'hours');
    assert.equal(fromDash.updatedAt, seen.updatedAt, 'the owner and staff read the same version');
    const r = await rpc(w.url, U.support, 'act_for_owner', { p_venue: A, p_reason: 'Owner asked by phone', p_action: 'onboarding.set',
      p_payload: { step: 'hours', state: 'doing', expectedUpdatedAt: seen.updatedAt } });
    assert.equal(r.ok, true, JSON.stringify(r));
    const again = await rpc(w.url, U.support, 'act_for_owner', { p_venue: A, p_reason: 'Owner asked by phone', p_action: 'onboarding.set',
      p_payload: { step: 'hours', state: 'done', expectedUpdatedAt: seen.updatedAt } });
    assert.equal(again.code, 'stale', 'the version moved with the change');
  });
});

describe('ops_revision leaves nothing set behind', () => {
  test('venue_unknown and revision_unknown clear mana.via', async () => {
    const via = await as(w.url, U.support, async (c) => {
      const out = [];
      for (const [venue, rev] of [['00000000-0000-4000-8000-00000000ffff', null], [A, 999]]) {
        const r = (await c.query(`select public.ops_revision($1, $2) as v`, [venue, rev])).rows[0].v;
        out.push([r.code, (await c.query(`select coalesce(current_setting('mana.via', true), '') as v`)).rows[0].v]);
      }
      return out;
    });
    assert.deepEqual(via, [['venue_unknown', ''], ['revision_unknown', '']]);
  });
});

