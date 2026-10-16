// apply_import (ADR-008): the draft the owner looked at and their answers, applied in one transaction through the SQL
// twin of planApply. Never a delete, never a publish; the same draft again creates nothing (Hopa test 1); a trigger
// that refuses a row undoes the whole import. Stores the draft's own exceptions with their answers; the plan's own are
// counted in the import.apply row.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { rpc } from './harness/cluster.mjs';
import { A, U, world } from './harness/world.mjs';
import { planApply } from '../../packages/contracts/src/index.ts';
import { bistroDraft, copy, dish } from '../../packages/contracts/test/import-fixtures.ts';

let w;
let V;
const O = '55555555-5555-4555-8555-5555555555a1';
before(async () => {
  w = await world();
  await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'apply-owner@example.invalid', now())`, [O]);
  V = (await rpc(w.url, O, 'create_venue', { p_slug: 'apply-venue', p_name_he: 'מסעדה', p_name_en: 'Apply Venue' })).id;
});
after(async () => { await w?.stop(); });

let n = 0;
/** A text import of the venue, saved as the draft (the text differs each time, so it is never the same input). */
async function parsed(draft, who = O, venue = () => V) {
  const imp = await rpc(w.url, who, 'create_import', { p_venue: venue(), p_source: 'wolt_text', p_text: `Menu copy ${++n}` });
  assert.equal(imp.ok, true, JSON.stringify(imp));
  const saved = await rpc(w.url, who, 'save_import_draft', { p_import: imp.importId, p_draft: draft });
  assert.equal(saved.ok, true, JSON.stringify(saved));
  return imp.importId;
}
const apply = (who, id, draft, decisions) => rpc(w.url, who, 'apply_import', { p_import: id, p_draft: draft, p_decisions: decisions });
const DEC = { v: 1, pricesConfirmed: true, choices: {} };
const counts = async (venue = V) => (await w.admin.query(`select
    (select count(*)::int from public.sections where venue_id = $1) as sections, (select count(*)::int from public.dishes where venue_id = $1) as dishes,
    (select count(*)::int from public.addon_groups where venue_id = $1) as groups, (select count(*)::int from public.addon_options where venue_id = $1) as options,
    (select count(*)::int from public.dish_addon_groups where venue_id = $1) as links, (select count(*)::int from public.assets where venue_id = $1) as assets`, [venue])).rows[0];
const existingOf = async (venue = V) => (await w.admin.query(`select app.existing_menu($1) as m`, [venue])).rows[0].m;

describe('apply_import', () => {
  test('the base draft on an empty venue: the plan planApply makes, applied; stored answers; one import.apply row; onboarding; no publish', async () => {
    const draft = bistroDraft();
    const id = await parsed(draft);
    const before = await existingOf();
    const want = planApply(draft, before, DEC);
    assert.equal(want.ok, true);
    const r = await apply(O, id, draft, DEC);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.plan, JSON.parse(JSON.stringify(want.value)), 'the database planned what the contracts plan');
    assert.deepEqual(await counts(), { sections: 2, dishes: 3, groups: 3, options: 6, links: 3, assets: 0 });
    const imp = (await w.admin.query(`select status, applied_at, exceptions from public.menu_imports where id = $1`, [id])).rows[0];
    assert.equal(imp.status, 'applied');
    assert.ok(imp.applied_at);
    assert.deepEqual(imp.exceptions, r.plan.exceptions.slice(0, r.plan.fromDraft), 'the draft\'s own exceptions, with the answers used');
    assert.ok(imp.exceptions.every((e) => typeof e.choice === 'string'));
    const log = (await w.admin.query(`select actor_kind, via, target_table, target_ids, detail from public.activity_log where venue_id = $1 and action = 'import.apply'`, [V])).rows;
    assert.deepEqual(log.map((x) => [x.actor_kind, x.via, x.target_table, x.target_ids]), [['owner', 'rpc', 'menu_imports', [id]]]);
    assert.deepEqual(log[0].detail, { source: 'wolt_text', summary: r.plan.summary, asked: {} });
    const via = (await w.admin.query(`select distinct via from public.activity_log where venue_id = $1 and action in ('sections.insert', 'dishes.insert', 'addon_groups.insert')`, [V])).rows;
    assert.deepEqual(via, [{ via: 'rpc' }], 'the menu rows are audited as the import wrote them');
    const steps = (await w.admin.query(`select step, state from public.onboarding_progress where venue_id = $1 and step in ('menu', 'review') order by step`, [V])).rows;
    assert.deepEqual(steps, [{ step: 'menu', state: 'done' }, { step: 'review', state: 'done' }]);
    const v = (await w.admin.query(`select published_revision_id, first_published_at from public.venues where id = $1`, [V])).rows[0];
    assert.deepEqual(v, { published_revision_id: null, first_published_at: null }, 'never a publish');
    const g = (await w.admin.query(`select name_en, min_units, max_units, limits_confirmed from public.addon_groups where venue_id = $1 order by name_en`, [V])).rows;
    assert.deepEqual(g.map((x) => [x.name_en, x.limits_confirmed]), [['Extras', false], ['Sauce', false], ['Side of choice', false]], 'guessed limits wait for the owner');
    assert.deepEqual(await apply(O, id, draft, DEC), { ok: false, code: 'import_closed' });
  });

  test('Hopa test 1: the same draft again creates nothing and changes no row', async () => {
    const draft = bistroDraft();
    const before = await counts();
    const menu = await existingOf();
    const id = await parsed(draft);
    const r = await apply(O, id, draft, DEC);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.plan.steps.filter((x) => x.op === 'create' || x.op === 'update'), []);
    assert.deepEqual(await counts(), before);
    assert.deepEqual(await existingOf(), menu, 'every row as it was');
  });

  test('a price that differs: one question per section; the owner\'s answer and a per-dish override', async () => {
    const draft = copy(bistroDraft());
    draft.sections[0].dishes[0].price = 6600;   // schnitzel
    draft.sections[0].dishes[1].price = 7400;   // burger
    const decisions = { ...DEC, choices: { 'price_differs@s-mains': 'take_new', 'price_differs@d-burger': 'keep_mine' } };
    const want = planApply(draft, await existingOf(), decisions);
    assert.equal(want.ok, true);
    const id = await parsed(draft);
    const r = await apply(O, id, draft, decisions);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.plan, JSON.parse(JSON.stringify(want.value)));
    const asked = r.plan.exceptions.slice(r.plan.fromDraft);
    assert.deepEqual(asked.map((e) => [e.code, e.key, e.count, e.choice]), [['price_differs', 's-mains', 2, 'take_new']]);
    const prices = (await w.admin.query(`select name_en, price from public.dishes where venue_id = $1 and name_en in ('Schnitzel', 'Burger') order by name_en`, [V])).rows;
    assert.deepEqual(prices, [{ name_en: 'Burger', price: 7200 }, { name_en: 'Schnitzel', price: 6600 }]);
    const log = (await w.admin.query(`select detail from public.activity_log where venue_id = $1 and action = 'import.apply' order by id desc limit 1`, [V])).rows[0];
    assert.deepEqual(log.detail.asked, { price_differs: 1 }, 'the plan\'s own questions, counted per code');
    const stored = (await w.admin.query(`select exceptions from public.menu_imports where id = $1`, [id])).rows[0].exceptions;
    assert.ok(!stored.some((e) => e.code === 'price_differs'), 'only the draft\'s own are stored on the import');
  });

  test('every code; owners and managers only', async () => {
    const draft = bistroDraft();
    const id = await parsed(draft);
    for (const who of [U.stranger, U.ownerA, U.counterA, U.support, U.admin]) assert.deepEqual(await apply(who, id, draft, DEC), { ok: false, code: 'import_unknown' });
    assert.equal((await apply('anon', id, draft, DEC)).error?.code, '42501');
    assert.deepEqual(await apply(O, '00000000-0000-4000-8000-00000000ffff', draft, DEC), { ok: false, code: 'import_unknown' });
    const other = copy(draft);
    other.sections[0].dishes[0].price = 1;
    assert.deepEqual(await apply(O, id, other, DEC), { ok: false, code: 'draft_changed' });
    assert.deepEqual(await apply(O, id, null, DEC), { ok: false, code: 'draft_changed' });
    const bad = await apply(O, id, draft, { ...DEC, v: 2 });
    assert.deepEqual([bad.code, bad.errors], ['invalid_decisions', [{ code: 'version', path: 'v' }]]);
    const unconfirmed = await apply(O, id, draft, { ...DEC, pricesConfirmed: false });
    assert.deepEqual([unconfirmed.code, unconfirmed.errors], ['plan_invalid', [{ code: 'prices_unconfirmed', path: 'pricesConfirmed' }]]);
    const noPrice = copy(draft);
    noPrice.sections[0].dishes.push(dish('d-special', 'מנה מיוחדת', 'Special', null));
    const np = await parsed(noPrice);
    const unresolved = await apply(O, np, noPrice, DEC);
    assert.deepEqual([unresolved.code, unresolved.errors], ['plan_invalid', [{ code: 'exception_unresolved', path: 'd-special', message: 'price_missing' }]]);
    assert.equal((await apply(O, np, noPrice, { ...DEC, choices: { 'price_missing@d-special': 'no_price' } })).ok, true, 'answered');
    const up = await rpc(w.url, O, 'create_import', { p_venue: V, p_source: 'paste', p_text: 'Not read yet' });
    assert.deepEqual(await apply(O, up.importId, draft, DEC), { ok: false, code: 'not_parsed' });
    await rpc(w.url, O, 'discard_import', { p_import: id });
    assert.deepEqual(await apply(O, id, draft, DEC), { ok: false, code: 'import_closed' });
    // a manager of venue A applies A's import
    const a = await parsed(draftOfA(), U.managerA, () => A);
    assert.equal((await apply(U.managerA, a, draftOfA(), DEC)).ok, true);
  });

  test('a trigger that refuses a row undoes the whole import: apply_failed with its code, nothing written', async () => {
    const draft = copy(bistroDraft());
    draft.sections.push({ ...draft.sections[0], key: 's-specials', name: { he: 'מיוחדים', en: 'Specials' },
      dishes: [dish('d-a', 'א', 'Alpha', 1000), dish('d-b', 'ב', 'Beta', 1100)] });
    const id = await parsed(draft);
    const before = await counts();
    const logBefore = (await w.admin.query(`select count(*)::int as n from public.activity_log where venue_id = $1`, [V])).rows[0].n;
    const limits = (await w.admin.query(`select value from public.app_config where key = 'limits'`)).rows[0].value;
    await w.admin.query(`update public.app_config set value = $1::jsonb where key = 'limits'`, [JSON.stringify({ ...limits, dishes: before.dishes + 1 })]);
    try {
      const r = await apply(O, id, draft, DEC);
      assert.deepEqual(r, { ok: false, code: 'apply_failed', errors: [{ code: 'limit_dishes', path: 'dishes' }] });
    } finally {
      await w.admin.query(`update public.app_config set value = $1::jsonb where key = 'limits'`, [JSON.stringify(limits)]);
    }
    assert.deepEqual(await counts(), before, 'the new section and the first dish are gone too');
    assert.equal((await w.admin.query(`select status from public.menu_imports where id = $1`, [id])).rows[0].status, 'parsed', 'still waiting');
    assert.equal((await w.admin.query(`select count(*)::int as n from public.activity_log where venue_id = $1`, [V])).rows[0].n, logBefore, 'no activity');
    const ok = await apply(O, id, draft, DEC);
    assert.equal(ok.ok, true, 'applies once the limit allows it');
    assert.deepEqual(await counts(), { ...before, sections: before.sections + 1, dishes: before.dishes + 2 });
  });
});

/** A small draft for venue A (a demo venue with its own menu). */
function draftOfA() {
  const d = copy(bistroDraft());
  d.sections = [d.sections[1]];
  d.groups = [];
  return d;
}
