// save_addon_group: an add-on group and its options saved as one (the owner app's QA, 16 Oct). One transaction under
// the venue's nesting lock; client ids, so a retry after a lost answer is safe; stale saves and rule removals asked
// back; a trigger's refusal rolls back everything.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { as, rpc } from './harness/cluster.mjs';
import { A, U, world } from './harness/world.mjs';

let w;
before(async () => { w = await world(); });
after(async () => { await w?.stop(); });

const save = (who, group, options, extra = {}) => rpc(w.url, who, 'save_addon_group', { p_venue: A, p_group: group, p_options: options, ...extra });
const state = async (gid) => (await w.admin.query(`select app.addon_group_json($1) as j`, [gid])).rows[0].j;
const logCount = async () => (await w.admin.query(`select count(*)::int as n from public.activity_log where venue_id = $1`, [A])).rows[0].n;
const logsSince = async (since) => (await w.admin.query(`select action, via, actor_kind, n from public.activity_log where venue_id = $1 and id > $2 order by id`, [A, since])).rows;
const maxLog = async () => (await w.admin.query(`select coalesce(max(id), 0) as id from public.activity_log`)).rows[0].id;
const sauces = () => {
  const g = { id: randomUUID(), label: 'Sauces, burgers', name_he: 'רטבים', name_en: 'Sauces', selection: 'multiple', min_units: 0, max_units: 2 };
  const o = [
    { id: randomUUID(), name_he: 'איולי', name_en: 'Aioli', price: 300 },
    { id: randomUUID(), name_en: 'Ketchup', price: 0, is_default: true },
    { id: randomUUID(), name_en: 'Chipotle', price: 400 },
  ];
  return { g, o };
};

describe('save_addon_group', () => {
  test('owners and managers of the venue; not a counter, another venue, Halom or a guest', async () => {
    const { g, o } = sauces();
    const out = {};
    for (const [name, who] of Object.entries({ anon: 'anon', stranger: U.stranger, ownerA: U.ownerA, managerA: U.managerA, counterA: U.counterA, ownerB: U.ownerB, support: U.support, admin: U.admin })) {
      const r = await save(who, g, o);
      out[name] = r?.error ? r.error.code : r.ok ? 'ok' : r.code;
    }
    assert.deepEqual(out, { anon: '42501', stranger: '42501', ownerA: 'ok', managerA: 'ok', counterA: '42501', ownerB: '42501', support: '42501', admin: '42501' });
  });

  test('a new group and its options in one call; logged once per statement, via rpc; the reply is the stored rows', async () => {
    const { g, o } = sauces();
    const since = await maxLog();
    const r = await save(U.ownerA, { ...g, name_en: '  Sauces ' }, o);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r, { ok: true, ...(await state(g.id)) });
    assert.deepEqual([r.group.id, r.group.venue_id, r.group.name_en, r.group.selection, r.group.max_units, r.group.limits_confirmed], [g.id, A, 'Sauces', 'multiple', 2, true]);
    assert.deepEqual(r.options.map((x) => [x.id, x.position, x.name_en, x.price, x.max_qty, x.is_default, x.opens_group_id]), [
      [o[0].id, 0, 'Aioli', 300, 1, false, null], [o[1].id, 1, 'Ketchup', 0, 1, true, null], [o[2].id, 2, 'Chipotle', 400, 1, false, null]]);
    assert.deepEqual(await logsSince(since), [
      { action: 'addon_groups.insert', via: 'rpc', actor_kind: 'owner', n: 1 },
      { action: 'addon_options.insert', via: 'rpc', actor_kind: 'owner', n: 3 },
    ]);
  });

  test('the same input twice (a lost answer retried, with or without the version) is ok and changes nothing', async () => {
    const { g, o } = sauces();
    const first = await save(U.ownerA, g, o);
    const since = await maxLog();
    const again = await save(U.ownerA, { ...g, name_he: ' רטבים' }, o);
    assert.deepEqual(again, first, 'a new group whose insert answer was lost');
    const withOld = await save(U.ownerA, g, o, { p_expected_updated_at: '2020-01-01T00:00:00Z' });
    assert.deepEqual(withOld, first, 'an update whose answer was lost');
    assert.deepEqual(await logsSince(since), []);
    assert.equal((await w.admin.query(`select count(*)::int as n from public.addon_options where group_id = $1`, [g.id])).rows[0].n, 3);
  });

  test('an update: the group, a removed option, a changed one, a new one; the version moves with any option', async () => {
    const { g, o } = sauces();
    const v1 = await save(U.ownerA, g, o);
    const added = { id: randomUUID(), name_en: 'Mustard', price: 200 };
    const since = await maxLog();
    const v2 = await save(U.ownerA, { ...g, name_en: 'Dips' }, [{ ...o[2], price: 450 }, o[1], added], { p_expected_updated_at: v1.group.updated_at });
    assert.equal(v2.ok, true, JSON.stringify(v2));
    assert.deepEqual(v2.options.map((x) => [x.name_en, x.position, x.price]), [['Chipotle', 0, 450], ['Ketchup', 1, 0], ['Mustard', 2, 200]]);
    assert.notEqual(v2.group.updated_at, v1.group.updated_at);
    assert.deepEqual((await logsSince(since)).map((l) => [l.action, l.n, l.via]).sort(), [
      ['addon_groups.update', 1, 'rpc'], ['addon_options.delete', 1, 'rpc'], ['addon_options.insert', 1, 'rpc'], ['addon_options.update', 1, 'rpc']], 'Ketchup kept its place: not touched');
    const v3 = await save(U.ownerA, { ...g, name_en: 'Dips' }, [{ ...o[2], price: 500 }, o[1], added], { p_expected_updated_at: v2.group.updated_at });
    assert.notEqual(v3.group.updated_at, v2.group.updated_at, 'an option alone moves the group\'s version');
    const stale = await save(U.ownerA, { ...g, name_en: 'Dips' }, [o[1]], { p_expected_updated_at: v2.group.updated_at });
    assert.equal(stale.code, 'stale');
  });

  test('stale: someone saved since; the answer carries what is stored and nothing is written', async () => {
    const { g, o } = sauces();
    const v1 = await save(U.ownerA, g, o);
    const v2 = await save(U.managerA, { ...g, name_en: 'Sauces (manager)' }, o, { p_expected_updated_at: v1.group.updated_at });
    assert.equal(v2.ok, true);
    const since = await maxLog();
    const r = await save(U.ownerA, { ...g, name_en: 'Sauces (owner)' }, o.slice(0, 1), { p_expected_updated_at: v1.group.updated_at });
    assert.deepEqual(r, { ok: false, code: 'stale', current: await state(g.id) });
    assert.equal(r.current.group.name_en, 'Sauces (manager)');
    assert.equal(r.current.options.length, 3);
    assert.deepEqual(await logsSince(since), []);
    const blind = await save(U.ownerA, { ...g, name_en: 'Sauces (owner)' }, o);
    assert.equal(blind.code, 'stale', 'no version and a different input: the client thought it new');
  });

  test('options an upsell rule suggests: asked first (the rule ids), removed with their rules once confirmed', async () => {
    const { g, o } = sauces();
    await save(U.ownerA, g, o);
    const rule = await as(w.url, U.ownerA, async (c) => (await c.query(`insert into public.upsell_rules (venue_id, trigger, suggest_kind, suggest_option_id, line_en)
      values ($1, 'sheet', 'option', $2, 'Add chipotle?') returning id`, [A, o[2].id])).rows[0].id);
    const before = await state(g.id);
    const since = await maxLog();
    const r = await save(U.ownerA, g, o.slice(0, 2), { p_expected_updated_at: before.group.updated_at });
    assert.deepEqual(r, { ok: false, code: 'option_in_rules', rules: [rule] });
    assert.deepEqual(await state(g.id), before);
    assert.deepEqual(await logsSince(since), []);
    const ok = await save(U.ownerA, g, o.slice(0, 2), { p_expected_updated_at: before.group.updated_at, p_confirm_rule_removal: true });
    assert.equal(ok.ok, true);
    assert.equal((await w.admin.query(`select count(*)::int as n from public.upsell_rules where id = $1`, [rule])).rows[0].n, 0);
    assert.deepEqual((await logsSince(since)).map((l) => l.action).sort(), ['addon_options.delete', 'upsell_rules.delete']);
  });

  test('a nesting refusal rolls back everything (the group, its deletions); so does a size limit', async () => {
    const q = { id: randomUUID(), name_en: 'Cheese choice', selection: 'single', max_units: 1 };
    const qOpts = [{ id: randomUUID(), name_en: 'Cheddar' }, { id: randomUUID(), name_en: 'Swiss' }];
    const r = { id: randomUUID(), name_en: 'Extra' };
    const rOpts = [{ id: randomUUID(), name_en: 'Egg' }];
    const p = { id: randomUUID(), name_en: 'Add cheese', selection: 'single', max_units: 1 };
    for (const [grp, opts] of [[q, qOpts], [r, rOpts], [p, [{ id: randomUUID(), name_en: 'Yes', opens_group_id: q.id }]]]) assert.equal((await save(U.ownerA, grp, opts)).ok, true);
    const before = await state(q.id);
    const since = await maxLog();
    const deep = await save(U.ownerA, { ...q, name_en: 'Cheese, renamed' }, [{ ...qOpts[0], opens_group_id: r.id }], { p_expected_updated_at: before.group.updated_at });
    assert.deepEqual(deep, { ok: false, code: 'nesting_too_deep' });
    assert.deepEqual(await state(q.id), before, 'the rename and the deleted Swiss are back');
    assert.deepEqual(await logsSince(since), []);
    const limits = (await w.admin.query(`select value from public.app_config where key = 'limits'`)).rows[0].value;
    await w.admin.query(`update public.app_config set value = $1 where key = 'limits'`, [JSON.stringify({ ...limits, options_per_group: 2 })]);
    try {
      const big = await save(U.ownerA, { ...q, name_en: 'Cheese, renamed' }, [...qOpts, { id: randomUUID(), name_en: 'Feta' }], { p_expected_updated_at: before.group.updated_at });
      assert.deepEqual(big, { ok: false, code: 'limit_options_per_group' });
      assert.deepEqual(await state(q.id), before);
    } finally {
      await w.admin.query(`update public.app_config set value = $1 where key = 'limits'`, [JSON.stringify(limits)]);
    }
  });

  test('limits an import guessed: kept unconfirmed on a save that leaves them, confirmed when changed or confirmed', async () => {
    const { g, o } = sauces();
    await save(U.ownerA, { ...g, limits_confirmed: false }, o);
    let s = await state(g.id);
    assert.equal(s.group.limits_confirmed, false);
    s = await save(U.ownerA, { ...g, label: 'Renamed label' }, o, { p_expected_updated_at: s.group.updated_at });
    assert.equal(s.group.limits_confirmed, false, 'the limits were not touched');
    s = await save(U.ownerA, { ...g, label: 'Renamed label', max_units: 3 }, o, { p_expected_updated_at: s.group.updated_at });
    assert.equal(s.group.limits_confirmed, true, 'changed limits are the owner\'s');
    const { g: g2, o: o2 } = sauces();
    await save(U.ownerA, { ...g2, limits_confirmed: false }, o2);
    const t = await save(U.ownerA, { ...g2, limits_confirmed: true }, o2, { p_expected_updated_at: (await state(g2.id)).group.updated_at });
    assert.equal(t.group.limits_confirmed, true, 'confirmed as they are');
  });

  test('a group publishing would refuse is refused here: no options, a minimum its options cannot reach', async () => {
    const { g, o } = sauces();
    assert.deepEqual(await save(U.ownerA, g, []), { ok: false, code: 'options_empty', path: 'options' });
    assert.deepEqual(await save(U.ownerA, { ...g, min_units: 2, max_units: 2 }, [o[0]]), { ok: false, code: 'min_unreachable', path: 'group.min_units' });
    assert.equal((await save(U.ownerA, { ...g, min_units: 2, max_units: 2 }, [{ ...o[0], max_qty: 2 }])).ok, true, 'one option, two units');
  });

  test('the dishes that offer the group: new limits a dish link could not keep are refused, first link by id', async () => {
    const { g, o } = sauces();
    const v1 = await save(U.ownerA, { ...g, min_units: 0, max_units: 3 }, o);
    const dish = '00000000-0000-4000-8000-00000000d002';
    const other = '00000000-0000-4000-8000-00000000d003';
    const [l1, l2] = await as(w.url, U.ownerA, async (c) => {
      const a = (await c.query(`insert into public.dish_addon_groups (venue_id, dish_id, group_id, position, min_units, max_units) values ($1, $2, $3, 9, 1, 3) returning id`,
        [A, dish, g.id])).rows[0].id;
      const b = (await c.query(`insert into public.dish_addon_groups (venue_id, dish_id, group_id, position, min_units, max_units) values ($1, $2, $3, 9, 2, null) returning id`,
        [A, other, g.id])).rows[0].id;
      return [a, b].sort();
    });
    const links = (await w.admin.query(`select id, min_units, max_units from public.dish_addon_groups where group_id = $1 order by id`, [g.id])).rows;
    assert.deepEqual(links.map((l) => l.id), [l1, l2]);
    const at = (id) => `dishGroups.${id}`;
    const since = await maxLog();
    // max 3 → 2: the link that says max 3 is now looser than its group
    const tighter = await save(U.ownerA, { ...g, min_units: 0, max_units: 2 }, o, { p_expected_updated_at: v1.group.updated_at });
    const looser = links.find((l) => l.max_units === 3);
    assert.deepEqual(tighter, { ok: false, code: 'limits_loosened', path: at(looser.id) });
    // min 0 → 2: the link whose own min is 1 is now looser
    const raised = await save(U.ownerA, { ...g, min_units: 2, max_units: 3 }, o, { p_expected_updated_at: v1.group.updated_at });
    assert.deepEqual(raised, { ok: false, code: 'limits_loosened', path: at(links.find((l) => l.min_units === 1).id) });
    // one option left: a link's own min of 2 is above the capacity
    const fewer = await save(U.ownerA, { ...g, min_units: 0, max_units: 3 }, [o[0]], { p_expected_updated_at: v1.group.updated_at });
    assert.deepEqual(fewer, { ok: false, code: 'limits_invalid', path: at(links.find((l) => l.min_units === 2).id) });
    // both links refused: the first by id answers
    const both = await save(U.ownerA, { ...g, min_units: 3, max_units: 3 }, o, { p_expected_updated_at: v1.group.updated_at });
    assert.deepEqual(both, { ok: false, code: 'limits_loosened', path: at(l1) });
    assert.deepEqual(await logsSince(since), [], 'nothing written');
    assert.equal((await save(U.ownerA, { ...g, min_units: 0, max_units: 3, label: 'kept' }, o, { p_expected_updated_at: v1.group.updated_at })).ok, true);
  });

  test('every code, with the path of what to fix; a refused save writes nothing', async () => {
    const { g, o } = sauces();
    assert.equal((await save(U.ownerA, g, o)).ok, true);
    const code = async (grp, opts, who = U.ownerA) => { const r = await save(who, grp, opts); return r.ok ? 'ok' : [r.code, r.path ?? null]; };
    const before = await state(g.id);
    const n0 = await logCount();
    assert.deepEqual(await code({ ...g, name_he: ' ', name_en: '' }, o), ['name_missing', 'group']);
    assert.deepEqual(await code({ ...g, name_en: 'x'.repeat(61) }, o), ['text_too_long', 'group.name_en']);
    assert.deepEqual(await code({ ...g, selection: 'single' }, o), ['single_max', 'group.max_units']);
    assert.deepEqual(await code({ ...g, min_units: 3 }, o), ['units_invalid', 'group.max_units']);
    assert.deepEqual(await code({ ...g, max_units: 31 }, o), ['units_invalid', 'group.max_units']);
    assert.deepEqual(await code({ ...g, selection: 'any' }, o), ['enum_invalid', 'group.selection']);
    assert.deepEqual(await code({ ...g, venue_id: A }, o), ['field_not_allowed', 'group.venue_id']);
    assert.deepEqual(await code({ ...g, id: 'g1' }, o), ['id_invalid', 'group.id']);
    assert.deepEqual(await code(g, [o[0], o[0]]), ['id_duplicate', 'options[1].id']);
    assert.deepEqual(await code(g, [{ ...o[0], name_he: '', name_en: '' }]), ['name_missing', 'options[0]']);
    assert.deepEqual(await code(g, [{ ...o[0], price: 2.5 }]), ['price_invalid', 'options[0].price']);
    assert.deepEqual(await code(g, [{ ...o[0], max_qty: 11 }]), ['qty_invalid', 'options[0].max_qty']);
    assert.deepEqual(await code(g, [{ ...o[0], max_qty: 2, opens_group_id: randomUUID() }]), ['qty_invalid', 'options[0].max_qty']);
    assert.deepEqual(await code(g, [{ ...o[0], opens_group_id: g.id }]), ['nesting_invalid', 'options[0].opens_group_id']);
    assert.deepEqual(await code(g, o.map((x) => ({ ...x, is_default: true }))), ['defaults_invalid', 'options'], 'three defaults, two at most');
    assert.deepEqual(await code(g, [{ ...o[0], colour: 'red' }]), ['field_not_allowed', 'options[0].colour']);
    assert.deepEqual(await code(g, { 0: o[0] }), ['type', 'options']);
    assert.deepEqual(await code(g, [{ ...o[0], opens_group_id: randomUUID() }]), ['group_unknown', 'options[0].opens_group_id']);
    assert.deepEqual(await code(g, [{ ...o[0], opens_group_id: w.b.group }]), ['group_unknown', 'options[0].opens_group_id'], 'another venue\'s group');
    assert.deepEqual(await code({ ...g, id: w.b.group }, o), ['not_allowed', 'group.id'], 'a group id of another venue');
    assert.deepEqual(await code(sauces().g, [{ ...o[0], id: w.b.option }]), ['not_allowed', 'options[0].id'], 'an option of another venue');
    assert.deepEqual(await code(sauces().g, [o[1]]), ['not_allowed', 'options[0].id'], 'an option of another group');
    assert.equal(await logCount(), n0);
    assert.deepEqual(await state(g.id), before);
    const O = '55555555-5555-4555-8555-5555555555a1';
    await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'archived-grp@example.invalid', now())`, [O]);
    const v = (await rpc(w.url, O, 'create_venue', { p_slug: 'archived-grp', p_name_en: 'Archived' })).id;
    await w.admin.query(`update public.venues set archived_at = now() where id = $1`, [v]);
    assert.deepEqual(await rpc(w.url, O, 'save_addon_group', { p_venue: v, p_group: sauces().g, p_options: [] }), { ok: false, code: 'venue_unknown' });
  });
});
