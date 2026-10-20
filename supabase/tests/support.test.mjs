// Halom support and the activity log: act_for_owner is the only way staff write into a venue; it needs a reason, respects
// the owner's switch, writes the activity row in the same transaction, and the owner sees it. Plus the other phase-1 RPCs.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { as, q, rpc } from './harness/cluster.mjs';
import { A, count, ID, U, world } from './harness/world.mjs';

let w;
before(async () => { w = await world(); });
after(async () => { await w?.stop(); });

const afo = (who, action, payload, reason = 'Owner asked on WhatsApp to bring it back', venue = A) =>
  rpc(w.url, who, 'act_for_owner', { p_venue: venue, p_reason: reason, p_action: action, p_payload: payload });
const ownerLog = (venue = A) => q(w.url, U.ownerA, `select action, actor_kind, via, reason, detail from public.activity_log where venue_id = $1 order by id`, [venue]);

describe('act_for_owner', () => {
  test('the owner takes a dish off; Halom restores it for the owner; the owner sees both in the log', async () => {
    await as(w.url, U.ownerA, (c) => c.query(`insert into public.availability_overrides (venue_id, target_kind, target_id, until_kind, until_spec)
      values ($1, 'dish', $2, 'duration', '{"kind":"duration","minutes":120}')`, [A, ID.schnitzel]));
    assert.equal((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'cafe-demo' })).live.off.length, 1);

    const r = await afo(U.support, 'availability.restore', { targetKind: 'dish', targetId: ID.schnitzel });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.result, { restored: 1 });
    assert.deepEqual((await rpc(w.url, 'anon', 'public_menu', { p_slug: 'cafe-demo' })).live.off, []);

    const log = await ownerLog();
    const mine = log.filter((x) => x.via === 'act_for_owner');
    assert.deepEqual(mine.map((x) => [x.action, x.actor_kind, x.reason]), [
      ['availability_overrides.update', 'staff', 'Owner asked on WhatsApp to bring it back'],
      ['support.act_for_owner', 'staff', 'Owner asked on WhatsApp to bring it back'],
    ]);
    assert.equal(mine[1].detail.action, 'availability.restore');
    const owners = log.filter((x) => x.action === 'availability_overrides.insert');
    assert.deepEqual(owners.map((x) => [x.actor_kind, x.via]), [['owner', 'direct']]);
    // the owner's dashboard shows it too
    const d = await rpc(w.url, U.ownerA, 'my_dashboard', { p_venue: A, p_range: 'today' });
    assert.ok(d.activity.some((a) => a.via === 'act_for_owner' && a.reason === 'Owner asked on WhatsApp to bring it back'));
  });

  test('no reason, no action; unknown actions and bad payloads write nothing', async () => {
    const before = (await w.admin.query('select count(*)::int as n from public.activity_log')).rows[0].n;
    assert.deepEqual(await afo(U.support, 'availability.restore', { targetKind: 'dish', targetId: ID.burger }, ''), { ok: false, code: 'reason_required' });
    assert.deepEqual(await afo(U.support, 'availability.restore', { targetKind: 'dish', targetId: ID.burger }, '  '), { ok: false, code: 'reason_required' });
    assert.deepEqual(await afo(U.support, 'venue.delete', {}), { ok: false, code: 'action_unknown' });
    assert.deepEqual(await afo(U.support, 'dish.update', { dishId: ID.burger, patch: { slug: 'x' } }), { ok: false, code: 'payload_invalid' });
    assert.deepEqual(await afo(U.support, 'dish.update', { dishId: ID.burger, patch: { price: -5 } }), { ok: false, code: 'payload_invalid' });
    assert.deepEqual(await afo(U.support, 'dish.update', { dishId: ID.burger, patch: { price: 1 } }), { ok: false, code: 'payload_invalid' }, 'no expectedUpdatedAt');
    assert.deepEqual(await afo(U.support, 'dish.update', { dishId: w.b.dish, patch: { price: 1 }, expectedUpdatedAt: new Date().toISOString() }),
      { ok: false, code: 'target_unknown' }, 'B\'s dish through A');
    assert.deepEqual(await afo(U.support, 'availability.set', { targetKind: 'dish', targetId: ID.burger, until: { kind: 'forever' } }), { ok: false, code: 'payload_invalid' });
    const after = (await w.admin.query('select count(*)::int as n from public.activity_log')).rows[0].n;
    assert.equal(after, before, 'a refused act leaves no trace and no change');
    const { rows } = await w.admin.query('select price from public.dishes where id = $1', [ID.burger]);
    assert.equal(rows[0].price, 6800);
  });

  test('staff fix a price for the owner: one dish row changed, the change and the reason in the log', async () => {
    const at = (await w.admin.query(`select to_jsonb(updated_at) #>> '{}' as at from public.dishes where id = $1`, [ID.lemonade])).rows[0].at;
    const r = await afo(U.admin, 'dish.update', { dishId: ID.lemonade, patch: { price: 1700, desc_en: 'Fresh' }, expectedUpdatedAt: at }, 'Typo in the imported price');
    assert.equal(r.ok, true);
    const log = (await ownerLog()).filter((x) => x.action === 'dishes.update' && x.via === 'act_for_owner').at(-1);
    assert.deepEqual(log.detail.changes, { price: [1600, 1700] }, 'numbers with their values; words only as "changed"');
    assert.deepEqual(log.detail.columns, ['desc_en', 'price']);
    assert.equal(log.reason, 'Typo in the imported price');
    const act = (await ownerLog()).filter((x) => x.action === 'support.act_for_owner').at(-1);
    assert.deepEqual(act.detail, { action: 'dish.update', keys: ['dishId', 'expectedUpdatedAt', 'patch'], patchKeys: ['desc_en', 'price'],
      result: { dishId: ID.lemonade, fields: ['desc_en', 'price'] } });
    assert.ok(!JSON.stringify(act.detail).includes('Fresh'), 'the words staff typed are not in the log');
  });

  test('menu.publish is not an act_for_owner action in phase 1: staff help with publishing by approving', async () => {
    const before = (await w.admin.query('select count(*)::int as n from public.menu_revisions where venue_id = $1', [A])).rows[0].n;
    assert.deepEqual(await afo(U.support, 'menu.publish', { note: 'after the price fix' }, 'Owner asked us to publish the fix'), { ok: false, code: 'action_unknown' });
    assert.equal((await w.admin.query('select count(*)::int as n from public.menu_revisions where venue_id = $1', [A])).rows[0].n, before);
  });

  test('availability.set until opening tomorrow, done for the owner', async () => {
    const r = await afo(U.support, 'availability.set', { targetKind: 'option', targetId: ID.chipotle, until: { kind: 'next_opening' } }, 'Supplier did not deliver');
    assert.equal(r.ok, true);
    const { rows } = await w.admin.query(`select created_by_kind, until_at = app.next_opening($1, starts_at) as ok from public.availability_overrides where id = $2`, [A, r.result.overrideId]);
    assert.deepEqual(rows[0], { created_by_kind: 'staff', ok: true });
  });

  test('the owner can switch Halom\'s access off; then act_for_owner is refused', async () => {
    await as(w.url, U.ownerA, (c) => c.query(`update public.venues set support_can_act = false where id = $1`, [A]));
    assert.deepEqual(await afo(U.support, 'availability.restore', { targetKind: 'option', targetId: ID.chipotle }), { ok: false, code: 'owner_declined' });
    await as(w.url, U.ownerA, (c) => c.query(`update public.venues set support_can_act = true where id = $1`, [A]));
    const log = (await ownerLog()).filter((x) => x.action === 'venues.update');
    assert.ok(log.some((x) => x.detail.changes?.support_can_act?.[1] === false), 'the switch itself is in the log');
  });

  test('a failing action inside act_for_owner rolls back everything it did', async () => {
    const before = (await w.admin.query('select count(*)::int as n from public.activity_log')).rows[0].n;
    const r = await afo(U.support, 'support_case.update', { caseId: '00000000-0000-4000-8000-00000000ffff', status: 'resolved' });
    assert.deepEqual(r, { ok: false, code: 'target_unknown' });
    assert.equal((await w.admin.query('select count(*)::int as n from public.activity_log')).rows[0].n, before);
  });

  test('an owner who sets the act_for_owner marker by hand is still logged as the owner, directly', async () => {
    await as(w.url, U.ownerA, async (c) => {
      await c.query(`select set_config('mana.via', 'act_for_owner', true), set_config('mana.reason', 'Pretending to be Halom', true)`);
      await c.query(`update public.dishes set desc_en = 'Forged' where id = $1`, [ID.espresso]);
    });
    const last = (await ownerLog()).at(-1);
    assert.deepEqual([last.action, last.actor_kind, last.via, last.reason], ['dishes.update', 'owner', 'direct', null]);
  });

  test('outside act_for_owner, nothing is ever logged as act_for_owner (the marker is transaction-local)', async () => {
    await as(w.url, U.support, async (c) => {
      await c.query(`select public.act_for_owner($1, 'Testing the marker', 'availability.restore', $2::jsonb)`, [A, JSON.stringify({ targetKind: 'dish', targetId: ID.burger })]);
      assert.equal((await c.query(`select coalesce(current_setting('mana.via', true), '') as v`)).rows[0].v, '');
    });
    await as(w.url, U.ownerA, (c) => c.query(`update public.dishes set desc_he = 'טרי' where id = $1`, [ID.lemonade]));
    const last = (await ownerLog()).at(-1);
    assert.deepEqual([last.action, last.actor_kind, last.via, last.reason], ['dishes.update', 'owner', 'direct', null]);
  });
});

describe('support cases and onboarding', () => {
  test('the owner asks for help; Halom sees the case in ops_overview and resolves it for the owner', async () => {
    const id = await as(w.url, U.ownerA, async (c) => (await c.query(`insert into public.support_cases (venue_id, topic, subject, body)
      values ($1, 'import', 'The import missed my drinks', 'Two drinks are missing') returning id, status, opened_by`, [A])).rows[0]);
    assert.equal(id.status, 'open');
    assert.equal(id.opened_by, U.ownerA);
    const o = await rpc(w.url, U.support, 'ops_overview');
    assert.equal(o.venues.find((v) => v.id === A).openCases, 1);
    assert.ok(o.venues.find((v) => v.id === A).warnings.includes('case_open'));
    assert.equal(o.totals.openCases, 0, 'Café Demo is a demo venue: its case is on its row, not in the real totals');
    const r = await afo(U.support, 'support_case.update', { caseId: id.id, status: 'resolved' }, 'Added the two drinks by hand');
    assert.equal(r.ok, true);
    const { rows } = await w.admin.query('select status, resolved_at is not null as done from public.support_cases where id = $1', [id.id]);
    assert.deepEqual(rows[0], { status: 'resolved', done: true });
    // the owner cannot rewrite what was asked
    assert.equal((await q(w.url, U.ownerA, `update public.support_cases set body = 'changed' where id = $1`, [id.id])).error?.code, '42501');
  });

  test('onboarding: progress per step, the stage in ops_overview, blockers are machine words', async () => {
    const o = await rpc(w.url, U.support, 'ops_overview');
    const b = o.venues.find((v) => v.id === w.B);
    assert.equal(b.onboarding.stage, 'review', 'venue (create_venue), menu (the first dish) and publish are the database\'s, done');
    assert.equal(b.onboarding.done, 3);
    assert.equal(b.menu.live, true);
    const r = await q(w.url, U.ownerB, `update public.onboarding_progress set state = 'blocked', blockers = '{"price missing!"}' where venue_id = $1 and step = 'addons'`, [w.B]);
    assert.match(r.error?.message ?? '', /blocker_invalid/);
    await as(w.url, U.ownerB, (c) => c.query(`update public.onboarding_progress set state = 'blocked', blockers = '{dish_without_price}' where venue_id = $1 and step = 'addons'`, [w.B]));
    const o2 = await rpc(w.url, U.support, 'ops_overview');
    assert.deepEqual(o2.venues.find((v) => v.id === w.B).onboarding.blocked, [{ step: 'addons', blockers: ['dish_without_price'] }]);
    assert.equal(o2.venues.find((v) => v.id === A).isDemo, true);
    // the database's own steps: never done by hand, never undone once it marked them
    assert.match((await q(w.url, U.ownerB, `update public.onboarding_progress set state = 'done' where venue_id = $1 and step = 'review'`, [w.B])).error?.message ?? '', /step_automatic/);
    assert.match((await q(w.url, U.ownerB, `update public.onboarding_progress set state = 'todo' where venue_id = $1 and step = 'menu'`, [w.B])).error?.message ?? '', /step_done/);
    assert.equal(await count(w.url, U.ownerB, `update public.onboarding_progress set state = 'done' where venue_id = $1 and step = 'menu'`, [w.B]), 1, 'done → done is not a change');
    await as(w.url, U.ownerB, (c) => c.query(`update public.onboarding_progress set state = 'todo', blockers = '{}' where venue_id = $1 and step = 'addons'`, [w.B]));
  });
});

describe('create_venue and slugs', () => {
  test('slug rules: format, reserved words, taken; at most five venues per owner', async () => {
    assert.equal(await rpc(w.url, U.stranger, 'slug_available', { p_slug: 'new-place' }), true);
    assert.equal(await rpc(w.url, U.stranger, 'slug_available', { p_slug: 'cafe-demo' }), false);
    assert.equal(await rpc(w.url, U.stranger, 'slug_available', { p_slug: 'admin' }), false);
    assert.equal(await rpc(w.url, U.stranger, 'slug_available', { p_slug: 'No Spaces' }), false);
    assert.deepEqual(await rpc(w.url, U.stranger, 'create_venue', { p_slug: 'cafe-demo', p_name_en: 'Copy' }), { ok: false, code: 'slug_taken' });
    assert.deepEqual(await rpc(w.url, U.stranger, 'create_venue', { p_slug: 'menu', p_name_en: 'Copy' }), { ok: false, code: 'slug_invalid' });
    assert.deepEqual(await rpc(w.url, U.stranger, 'create_venue', { p_slug: 'nameless' }), { ok: false, code: 'name_missing' });
    assert.equal((await rpc(w.url, 'anon', 'create_venue', { p_slug: 'anon-place', p_name_en: 'x' })).error?.code, '42501');
    for (let i = 0; i < 5; i++) assert.equal((await rpc(w.url, U.stranger, 'create_venue', { p_slug: `s-place-${i}`, p_name_en: `Place ${i}` })).ok, true);
    assert.deepEqual(await rpc(w.url, U.stranger, 'create_venue', { p_slug: 's-place-6', p_name_en: 'One too many' }), { ok: false, code: 'limit_venues' });
  });

  test('a new venue has its owner, a pending plan, nine onboarding steps and one creation entry in its log', async () => {
    const made = await rpc(w.url, U.ownerB, 'create_venue', { p_slug: 'fresh-start', p_name_he: 'התחלה', p_kind: 'bar' });
    const v = made.id;
    const r = await as(w.url, U.ownerB, async (c) => ({
      role: (await c.query('select role from public.venue_members where venue_id = $1', [v])).rows,
      plan: (await c.query('select plan, status from public.entitlements where venue_id = $1', [v])).rows,
      steps: (await c.query(`select step, state from public.onboarding_progress where venue_id = $1 order by step`, [v])).rows.length,
      log: (await c.query('select action, via from public.activity_log where venue_id = $1 order by id', [v])).rows,
    }));
    assert.deepEqual(r.role, [{ role: 'owner' }]);
    assert.deepEqual(r.plan, [{ plan: 'trial', status: 'pending' }]);
    assert.equal(r.steps, 9);
    assert.deepEqual(r.log.at(-1), { action: 'venue.create', via: 'rpc' });
  });

  test('my_dashboard: members who may see records only; the range is checked', async () => {
    assert.equal((await rpc(w.url, U.counterA, 'my_dashboard', { p_venue: A })).error?.code, '42501');
    assert.equal((await rpc(w.url, U.ownerB, 'my_dashboard', { p_venue: A })).error?.code, '42501');
    assert.equal((await rpc(w.url, U.ownerA, 'my_dashboard', { p_venue: A, p_range: 'forever' })).error?.code, '22023');
    const d = await rpc(w.url, U.ownerA, 'my_dashboard', { p_venue: A, p_range: '30d' });
    assert.equal(d.days.length, 30);
    assert.equal(d.demo, true);
    assert.equal(d.menu.live, true);
    assert.equal((await rpc(w.url, U.support, 'my_dashboard', { p_venue: A, p_range: '7d' })).days.length, 7, 'staff see what the owner sees');
  });

  test('staff invites: made by an admin, bound to an e-mail, redeemed once', async () => {
    assert.equal((await rpc(w.url, U.support, 'create_staff_invite', { p_email: 'stranger@example.invalid', p_role: 'support' })).error?.code, '42501', 'admins only');
    const inv = await rpc(w.url, U.admin, 'create_staff_invite', { p_email: ' Stranger@Example.invalid ', p_role: 'support' });
    assert.equal(inv.ok, true);
    assert.match(inv.code, /^[0-9a-f]{48}$/);
    const stored = await w.admin.query(`select code_hash, email from public.staff_invites where email = 'stranger@example.invalid'`);
    assert.equal(stored.rows.length, 1);
    assert.notEqual(stored.rows[0].code_hash, inv.code, 'only the hash is stored');
    assert.ok(!JSON.stringify((await w.admin.query(`select detail from public.activity_log where action = 'staff_invite.create'`)).rows).includes(inv.code));
    assert.deepEqual(await rpc(w.url, U.ownerB, 'redeem_staff_invite', { p_code: inv.code }), { ok: false, code: 'invalid' }, 'another e-mail');
    assert.deepEqual(await rpc(w.url, U.stranger, 'redeem_staff_invite', { p_code: inv.code }), { ok: true, role: 'support' });
    assert.equal(Array.isArray((await rpc(w.url, U.stranger, 'ops_overview')).venues), true);
    assert.deepEqual(await rpc(w.url, U.stranger, 'redeem_staff_invite', { p_code: inv.code }), { ok: true }, 'already staff');
  });
});
