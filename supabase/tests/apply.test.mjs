// apply_import (ADR-008): the draft the owner looked at and their answers, applied in one transaction through the SQL
// twin of planApply. Never a delete, never a publish; the same draft again creates nothing (Hopa test 1); a trigger
// that refuses a row undoes the whole import. Stores the draft's own exceptions with their answers; the plan's own are
// counted in the import.apply row.
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import pg from 'pg';
import { q, rpc } from './harness/cluster.mjs';
import { A, U, world } from './harness/world.mjs';
import { appliedIds, mergePrevious, planApply } from '../../packages/contracts/src/index.ts';
import { bistroDraft, copy, dish, draftOf, group, link, opt, section } from '../../packages/contracts/test/import-fixtures.ts';

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
    const imp = (await w.admin.query(`select status, applied_at, updated_at, exceptions from public.menu_imports where id = $1`, [id])).rows[0];
    assert.equal(imp.status, 'applied');
    assert.ok(imp.applied_at);
    assert.equal(imp.updated_at.getTime(), imp.applied_at.getTime(), 'closing moves updated_at (the purge counts its days from it)');
    assert.deepEqual(imp.exceptions, r.plan.exceptions.slice(0, r.plan.fromDraft), 'the draft\'s own exceptions, with the answers used');
    assert.ok(imp.exceptions.every((e) => typeof e.choice === 'string'));
    const log = (await w.admin.query(`select actor_kind, via, target_table, target_ids, detail from public.activity_log where venue_id = $1 and action = 'import.apply'`, [V])).rows;
    assert.deepEqual(log.map((x) => [x.actor_kind, x.via, x.target_table, x.target_ids]), [['owner', 'rpc', 'menu_imports', [id]]]);
    assert.deepEqual(log[0].detail, { source: 'wolt_text', summary: r.plan.summary, planExceptions: {} });
    const via = (await w.admin.query(`select distinct via from public.activity_log where venue_id = $1 and action in ('sections.insert', 'dishes.insert', 'addon_groups.insert')`, [V])).rows;
    assert.deepEqual(via, [{ via: 'rpc' }], 'the menu rows are audited as the import wrote them');
    const steps = (await w.admin.query(`select step, state from public.onboarding_progress where venue_id = $1 and step in ('menu', 'review') order by step`, [V])).rows;
    assert.deepEqual(steps, [{ step: 'menu', state: 'done' }, { step: 'review', state: 'done' }]);
    const v = (await w.admin.query(`select published_revision_id, first_published_at from public.venues where id = $1`, [V])).rows[0];
    assert.deepEqual(v, { published_revision_id: null, first_published_at: null }, 'never a publish');
    const g = (await w.admin.query(`select name_en, min_units, max_units, limits_confirmed from public.addon_groups where venue_id = $1 order by name_en`, [V])).rows;
    assert.deepEqual(g.map((x) => [x.name_en, x.limits_confirmed]), [['Extras', false], ['Sauce', true], ['Side of choice', true]],
      'the limits the source stated are confirmed; guessed ones wait for the owner');
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

  test('applied_ids: the row each section and dish landed on, stored with the import; the next plan reads it as previous and holds those rows (QA-M2)', async () => {
    // a venue of its own (rows renamed below)
    const OP = '55555555-5555-4555-8555-5555555555a8';
    await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'apply-previous@example.invalid', now())`, [OP]);
    const VP = (await rpc(w.url, OP, 'create_venue', { p_slug: 'apply-previous', p_name_he: 'קודם', p_name_en: 'Apply Previous' })).id;
    const draft = bistroDraft();
    assert.equal((await existingOf(VP)).previous, undefined, 'no import applied yet');
    const first = await parsed(draft, OP, () => VP);
    const r1 = await apply(OP, first, draft, DEC);
    assert.equal(r1.ok, true, JSON.stringify(r1).slice(0, 300));
    const stored1 = (await w.admin.query(`select applied_ids from public.menu_imports where id = $1`, [first])).rows[0].applied_ids;
    // appliedIds(plan, createdId): the ids apply_import made, read back from the rows by name
    const rows = (await w.admin.query(`select 'section' as kind, id, name_en from public.sections where venue_id = $1
                                       union all select 'dish', id, name_en from public.dishes where venue_id = $1`, [VP])).rows;
    const nameOf = new Map(draft.sections.flatMap((s) => [[`section:${s.key}`, s.name.en], ...s.dishes.map((d) => [`dish:${d.key}`, d.name.en])]));
    assert.deepEqual(stored1, appliedIds(r1.plan, (kind, key) => rows.find((x) => x.kind === kind && x.name_en === nameOf.get(`${kind}:${key}`))?.id));
    assert.deepEqual((await existingOf(VP)).previous, stored1, 'existing_menu reads the latest applied import\'s');
    const seen = await q(w.url, OP, `select applied_ids from public.menu_imports where id = $1`, [first]);
    assert.deepEqual(seen[0].applied_ids, stored1, 'a client reads it');
    // the same draft again: every row held, nothing written, the same rows stored
    const menu = await existingOf(VP);
    const second = await parsed(draft, OP, () => VP);
    const r2 = await apply(OP, second, draft, DEC);
    assert.deepEqual(r2.plan, JSON.parse(JSON.stringify(planApply(draft, menu, DEC).value)), 'planned with previous, as the contracts plan');
    assert.deepEqual(r2.plan.steps.filter((x) => x.op === 'create' || x.op === 'update'), []);
    assert.deepEqual((await w.admin.query(`select applied_ids from public.menu_imports where id = $1`, [second])).rows[0].applied_ids, stored1);
    // the owner renames a dish: its name no longer matches, so its row is no longer held; still the contracts' plan
    const key = draft.sections[0].dishes[0].key;
    await w.admin.query(`update public.dishes set name_he = 'אחר', name_en = 'Something else' where id = $1`, [stored1.dishes[key]]);
    const renamed = await existingOf(VP);
    const want = planApply(draft, renamed, DEC);
    const third = await parsed(draft, OP, () => VP);
    const r3 = await apply(OP, third, draft, DEC);
    assert.equal(r3.ok, want.ok, JSON.stringify(r3).slice(0, 300));
    if (want.ok) {
      assert.deepEqual(r3.plan, JSON.parse(JSON.stringify(want.value)));
      assert.notEqual(r3.plan.steps.find((s) => s.kind === 'dish' && s.key === key).id, stored1.dishes[key], 'the renamed row is not held');
    }
  });

  test('previous is every applied import\'s rows: A, its re-read R, an unrelated B, then R again writes no row (R9 QA-M3)', async () => {
    const OP = '55555555-5555-4555-8555-5555555555a9';
    await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'apply-union@example.invalid', now())`, [OP]);
    const VP = (await rpc(w.url, OP, 'create_venue', { p_slug: 'apply-union', p_name_he: 'איחוד', p_name_en: 'Apply Union' })).id;
    const yes = (choices) => ({ v: 1, pricesConfirmed: true, choices });
    // the contracts' round-9 case (db fuzz seed 307537388, shrunk): a Salad in each of two merged sections, kept apart
    const a = draftOf([section('s0', 'ראשונות', 'Starters', [dish('s0d0', 'סלט', 'Salad', 4200)]), section('s1', 'ראשונות', 'Starters', [dish('s1d1', 'סלט', 'Salad', 4200)])]);
    const first = yes({ 'section_duplicate@s1': 'merge', 'dish_duplicate@s1d1': 'keep_both' });
    const r = copy(a);
    for (const s of r.sections) s.name = { he: `${s.name.he} חדש`, en: `${s.name.en} new` };
    const again = yes({ ...first.choices, 'dish_elsewhere@s1d1': 'new_dish' });
    const b = draftOf([section('w0', 'יינות', 'Wines', [dish('w0d0', 'מרלו', 'Merlot', 5200)], { kind: 'drinks' })]);
    const step = async (draft, decisions, label) => {
      const menu = await existingOf(VP);
      const want = planApply(draft, menu, decisions);
      assert.equal(want.ok, true, `${label}: ${JSON.stringify(want).slice(0, 300)}`);
      const res = await apply(OP, await parsed(draft, OP, () => VP), draft, decisions);
      assert.equal(res.ok, true, `${label}: ${JSON.stringify(res).slice(0, 300)}`);
      assert.deepEqual(res.plan, JSON.parse(JSON.stringify(want.value)), `${label}: the contracts' plan`);
      return res.plan;
    };
    await step(a, first, 'A');
    await step(r, again, 'R');
    const before = await counts(VP);
    await step(b, yes({}), 'B');
    const prev = (await existingOf(VP)).previous;
    assert.deepEqual(Object.keys(prev.dishes).sort(), ['s0d0', 's1d1', 'w0d0'], 'R\'s rows are still there after B');
    const p = await step(r, again, 'R again');
    assert.deepEqual(p.steps.filter((x) => x.op === 'create' || x.op === 'update'), [], 'R again writes no row');
    const after = await counts(VP);
    assert.deepEqual({ ...after, sections: after.sections - 1, dishes: after.dishes - 1 }, before, 'only B\'s section and dish were added');
  });

  test('app.existing_menu\'s previous is mergePrevious over the venue\'s imports: applied ones only, the latest per key, ties to the greater id', async () => {
    const OP = '55555555-5555-4555-8555-5555555555aa';
    await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'apply-merge@example.invalid', now())`, [OP]);
    const VP = (await rpc(w.url, OP, 'create_venue', { p_slug: 'apply-merge', p_name_he: 'מיזוג', p_name_en: 'Apply Merge' })).id;
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    // instants a microsecond apart, the same instant written with another offset, and ties
    const AT = [null, '2026-10-20 10:00:00+00', '2026-10-20 10:00:00.000001+00', '2026-10-20 13:00:00.000001+03', '2026-10-20 10:00:01+00'];
    const ids = (keys) => Object.fromEntries(keys.filter(() => rnd() < 0.6).map((k) => [k, randomUUID()]));
    let n = 0, some = 0, none = 0;
    for (let round = 0; round < 40; round++) {
      await w.admin.query(`delete from public.menu_imports where venue_id = $1`, [VP]);
      const count = Math.floor(rnd() * 6);
      for (let i = 0; i < count; i++) {
        const at = pick(AT);
        const applied = rnd() < 0.8 ? { sections: ids(['s0', 's1', 's2']), dishes: ids(['d0', 'd1', 'd2', 'd3']) } : null;
        // (an id whose upper-case form would sort the other way: the tie goes to the greater lowercase id)
        const id = rnd() < 0.5 ? randomUUID() : `0000000${i}-0000-4000-8000-00000000000${pick(['a', 'b', 'c'])}`;
        await w.admin.query(`insert into public.menu_imports (id, venue_id, source, status, raw_text, input_sha256, applied_at, applied_ids)
          values ($1, $2, 'paste', $3, 'x', $4, $5, $6)`, [id, VP, at ? 'applied' : 'discarded', `${'b'.repeat(56)}${String(++n).padStart(8, '0')}`, at, applied]).catch((e) => {
          if (e.code !== '23505') throw e;   // a repeated fixed id: that row is left out
        });
      }
      // applied_at as the database writes a timestamptz (to the microsecond)
      const rows = (await w.admin.query(`select id, to_jsonb(applied_at) #>> '{}' as at, applied_ids from public.menu_imports where venue_id = $1`, [VP])).rows;
      const imports = rows.map((r) => ({ id: r.id, appliedAt: r.at, appliedIds: r.applied_ids }));
      const db = (await w.admin.query(`select app.existing_menu($1)->'previous' as p`, [VP])).rows[0].p;
      assert.deepEqual(db, mergePrevious(imports) ?? null, `round ${round}: ${JSON.stringify(rows).slice(0, 400)}`);
      if (db === null) none++; else some++;
    }
    assert.ok(some > 10 && none > 3, `both kinds of venue: ${some} with previous, ${none} without`);
    await w.admin.query(`delete from public.menu_imports where venue_id = $1`, [VP]);
  });

  test('a second apply of the venue while one runs answers import_busy at once (the import lock is tried, not waited for)', async () => {
    const draft = bistroDraft();
    const id = await parsed(draft);
    const hold = new pg.Client({ connectionString: w.url });
    await hold.connect();
    try {
      await hold.query('begin');
      await hold.query(`select pg_advisory_xact_lock(hashtext('mana:import:' || $1::text))`, [V]);
      const t0 = Date.now();
      assert.deepEqual(await apply(O, id, draft, DEC), { ok: false, code: 'import_busy' });
      assert.ok(Date.now() - t0 < 5000, 'at once');
      await hold.query('rollback');
      assert.equal((await apply(O, id, draft, DEC)).ok, true, 'and applies once the other is done');
    } finally {
      await hold.end();
    }
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
    assert.deepEqual(log.detail.planExceptions, { price_differs: 1 }, 'the plan\'s own questions, counted per code');
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

  test('refused applies are bounded: past import_caps.refused_applies_per_venue_hour a venue gets rate_limited before the plan (security round 4)', async () => {
    const OR = '55555555-5555-4555-8555-5555555555b1';
    await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'apply-owner-refused@example.invalid', now())`, [OR]);
    const VR = (await rpc(w.url, OR, 'create_venue', { p_slug: 'apply-refused', p_name_he: 'סירוב', p_name_en: 'Apply Refused' })).id;
    const caps = (await w.admin.query(`select value from public.app_config where key = 'import_caps'`)).rows[0].value;
    assert.equal(caps.refused_applies_per_venue_hour, 10, 'the starting value');
    const refusals = async () => (await w.admin.query(`select hour, n from app.import_refusals where venue_id = $1 order by hour`, [VR])).rows;
    const noPrice = copy(bistroDraft());
    noPrice.sections[0].dishes.push(dish('d-special', 'מנה מיוחדת', 'Special', null));
    const good = bistroDraft();
    const bad = await parsed(noPrice, OR, () => VR);
    const ok = await parsed(good, OR, () => VR);
    await w.admin.query(`update public.app_config set value = $1::jsonb where key = 'import_caps'`, [JSON.stringify({ ...caps, refused_applies_per_venue_hour: 3 })]);
    try {
      // the checks before the plan count nothing
      assert.equal((await apply(OR, bad, null, DEC)).code, 'draft_changed');
      assert.equal((await apply(OR, bad, noPrice, { ...DEC, v: 2 })).code, 'invalid_decisions');
      assert.deepEqual(await refusals(), []);
      for (let k = 0; k < 3; k++) assert.equal((await apply(OR, bad, noPrice, DEC)).code, 'plan_invalid', `refusal ${k + 1}`);
      assert.deepEqual((await refusals()).map((r) => r.n), [3]);
      assert.deepEqual(await apply(OR, bad, noPrice, DEC), { ok: false, code: 'rate_limited' });
      assert.deepEqual(await apply(OR, ok, good, DEC), { ok: false, code: 'rate_limited' }, 'the venue\'s, whichever import');
      assert.deepEqual((await refusals()).map((r) => r.n), [3], 'a rate_limited answer counts nothing');
      assert.equal((await w.admin.query(`select status from public.menu_imports where id = $1`, [ok])).rows[0].status, 'parsed');
      // another venue is not held back
      assert.equal((await apply(U.managerA, await parsed(draftOfA(), U.managerA, () => A), draftOfA(), DEC)).ok, true);
      // the next hour: the count starts again, and the old hour's row goes with the next refusal
      await w.admin.query(`update app.import_refusals set hour = hour - interval '1 hour' where venue_id = $1`, [VR]);
      assert.equal((await apply(OR, bad, noPrice, DEC)).code, 'plan_invalid');
      assert.deepEqual((await refusals()).map((r) => r.n), [1]);
      assert.equal((await apply(OR, ok, good, DEC)).ok, true, 'an apply that passes counts nothing');
      assert.deepEqual((await refusals()).map((r) => r.n), [1]);
      // apply_failed counts too
      const limits = (await w.admin.query(`select value from public.app_config where key = 'limits'`)).rows[0].value;
      const more = copy(good);
      more.sections[0].dishes.push(dish('d-extra', 'עוד', 'Extra', 1200));
      const failing = await parsed(more, OR, () => VR);
      await w.admin.query(`update public.app_config set value = $1::jsonb where key = 'limits'`, [JSON.stringify({ ...limits, dishes: (await counts(VR)).dishes })]);
      try {
        assert.equal((await apply(OR, failing, more, DEC)).code, 'apply_failed');
      } finally {
        await w.admin.query(`update public.app_config set value = $1::jsonb where key = 'limits'`, [JSON.stringify(limits)]);
      }
      assert.deepEqual((await refusals()).map((r) => r.n), [2]);
      assert.equal((await q(w.url, OR, `select * from app.import_refusals`)).error?.code, '42501', 'not the clients\' to read');
    } finally {
      await w.admin.query(`update public.app_config set value = $1::jsonb where key = 'import_caps'`, [JSON.stringify(caps)]);
    }
  });

  test('new_group: a venue option moved to open the group the plan creates, a dish link moved to it; opener_qty refuses a venue option taken twice', async () => {
    const O2 = '55555555-5555-4555-8555-5555555555a2';
    await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'apply-owner-2@example.invalid', now())`, [O2]);
    const V2 = (await rpc(w.url, O2, 'create_venue', { p_slug: 'apply-moves', p_name_he: 'מסעדה', p_name_en: 'Apply Moves' })).id;
    const at = () => V2;
    const first = bistroDraft();
    assert.equal((await apply(O2, await parsed(first, O2, at), first, DEC)).ok, true);
    const q = async (sql) => (await w.admin.query(sql, [V2])).rows;
    const optionNamed = async (en) => (await q(`select o.id, o.max_qty, o.opens_group_id from public.addon_options o where o.venue_id = $1 and o.name_en = '${en}'`))[0];
    const sauceBefore = (await q(`select id from public.addon_groups where venue_id = $1 and name_en = 'Sauce'`)).map((r) => r.id);
    assert.equal(sauceBefore.length, 1);
    // the source now says Salad opens the sauces, and Extras has bacon: both answered new_group
    const again = copy(bistroDraft());
    again.groups[0].options[1].opens = 'g-sauce';
    again.groups[2].options.push({ ...again.groups[2].options[1], key: 'o-bacon', name: { he: 'בייקון', en: 'Bacon' } });
    const dec = { ...DEC, choices: { 'opens_changed@o-salad>g-sauce': 'new_group', 'group_changed@d-burger>g-extras': 'new_group' } };
    const want = planApply(again, await existingOf(V2), dec);
    assert.equal(want.ok, true, JSON.stringify(want.errors));
    const moved = want.value.steps.filter((s) => s.op === 'update' && Object.keys(s.refs).length > 0).map((s) => [s.kind, s.key, s.refs]);
    assert.deepEqual(moved, [['option', 'o-salad', { opens_group_id: 'g-sauce' }], ['dish_group', 'd-burger>g-extras', { group_id: 'g-extras' }]]);
    const link = (await q(`select l.id from public.dish_addon_groups l join public.dishes d on d.id = l.dish_id join public.addon_groups g on g.id = l.group_id
      where l.venue_id = $1 and d.name_en = 'Burger' and g.name_en = 'Extras'`))[0].id;
    const r = await apply(O2, await parsed(again, O2, at), again, dec);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.plan, JSON.parse(JSON.stringify(want.value)));
    const sauces = (await q(`select id from public.addon_groups where venue_id = $1 and name_en = 'Sauce'`)).map((x) => x.id);
    const created = sauces.find((id) => !sauceBefore.includes(id));
    assert.ok(created, 'a new Sauce group');
    assert.equal((await optionNamed('Salad')).opens_group_id, created, 'the venue\'s Salad opens the group the plan created');
    assert.equal((await optionNamed('Fries')).opens_group_id, sauceBefore[0], 'Fries still opens the venue\'s own');
    const movedLink = (await q(`select l.id, l.group_id, g.name_en from public.dish_addon_groups l join public.addon_groups g on g.id = l.group_id where l.venue_id = $1`))
      .find((x) => x.id === link);
    assert.equal(movedLink.name_en, 'Extras');
    assert.ok(!(await q(`select id from public.addon_groups where venue_id = $1 and name_en = 'Extras' order by created_at limit 1`)).some((x) => x.id === movedLink.group_id),
      'the burger\'s link is the same row, now on the Extras group the plan created');
    // a venue option guests may take twice never opens a group: plan_invalid, opener_qty at the question's key, nothing written
    const third = copy(bistroDraft());
    third.groups[2].options[0].opens = 'g-sauce';
    third.groups[2].options[0].maxQty = 1;
    assert.equal((await optionNamed('Cheese')).max_qty, 2);
    const before = await counts(V2);
    const no = await apply(O2, await parsed(third, O2, at), third, { ...DEC, choices: { 'opens_changed@o-cheese>g-sauce': 'new_group' } });
    assert.deepEqual([no.code, no.errors], ['plan_invalid', [{ code: 'opener_qty', path: 'o-cheese>g-sauce', message: 'opens_changed' }]]);
    assert.deepEqual(await counts(V2), before);
  });

  test('QA r6-hopa: an owner\'s skip holds on re-import; the same draft with the same answers, applied twice, changes nothing the second time', async () => {
    const O3 = '55555555-5555-4555-8555-5555555555a3';
    await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'apply-owner-3@example.invalid', now())`, [O3]);
    const V3 = (await rpc(w.url, O3, 'create_venue', { p_slug: 'apply-hopa', p_name_he: 'מסעדה', p_name_en: 'Apply Hopa' })).id;
    // two groups named Extras; the owner leaves Rice out of the second, which can then no longer reach its stated
    // minimum of 2, and answers limits_unreachable: skip
    const d = draftOf([section('s', 'עיקריות', 'Mains', [
      dish('d-burger', 'המבורגר', 'Burger', 6200, { groups: [link('g-a')] }),
      dish('d-steak', 'סטייק', 'Steak', 9800, { groups: [link('g-b')] }),
    ])], [
      group('g-a', 'תוספות', 'Extras', { selection: 'multiple', min: 0, max: 2, options: [opt('a1', 'צ׳יפס', 'Fries', 0), opt('a2', 'סלט', 'Salad', 0)] }),
      group('g-b', 'תוספות', 'Extras', { selection: 'multiple', min: 2, max: 2, options: [opt('b1', 'אורז', 'Rice', 0), opt('b2', 'סלט', 'Salad', 0)] }),
    ]);
    const answers = { v: 1, pricesConfirmed: true, choices: { 'limits_unreachable@g-b': 'skip' }, skip: ['b1'] };
    const linksOf = async (name) => (await w.admin.query(`select g.name_en, (select string_agg(o.name_en, '/' order by o.position) from public.addon_options o where o.group_id = g.id) as opts
      from public.dish_addon_groups l join public.dishes x on x.id = l.dish_id join public.addon_groups g on g.id = l.group_id where l.venue_id = $1 and x.name_en = $2`, [V3, name])).rows;
    for (const round of [1, 2]) {
      const want = planApply(d, await existingOf(V3), answers);
      assert.equal(want.ok, true, JSON.stringify(want.errors));
      const before = await counts(V3);
      const r = await apply(O3, await parsed(d, O3, () => V3), d, answers);
      assert.equal(r.ok, true, JSON.stringify(r));
      assert.deepEqual(r.plan, JSON.parse(JSON.stringify(want.value)), `round ${round}: the database plans what the contracts plan`);
      assert.ok(r.plan.exceptions.some((e) => e.code === 'limits_unreachable' && e.key === 'g-b' && e.choice === 'skip'), `round ${round}: the skip is asked and kept`);
      if (round === 2) {
        assert.deepEqual(r.plan.steps.filter((x) => x.op === 'create' || x.op === 'update').map((x) => `${x.kind}:${x.key}`), [], 'nothing created or changed');
        assert.deepEqual(await counts(V3), before);
      }
      assert.deepEqual(await linksOf('Steak'), [], `round ${round}: the steak's Extras stays out`);
      assert.deepEqual(await linksOf('Burger'), [{ name_en: 'Extras', opts: 'Fries/Salad' }]);
    }
  });

  test('the summary counts the skipped steps by reason, every reason present', async () => {
    const draft = bistroDraft();
    const plan = planApply(draft, await existingOf(), { ...DEC, skip: ['d-lemonade'] });
    const id = await parsed(draft);
    const r = await apply(O, id, draft, { ...DEC, skip: ['d-lemonade'] });
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.plan.summary, JSON.parse(JSON.stringify(plan.value.summary)));
    for (const k of ['section', 'group', 'option', 'dish', 'dish_group', 'photo']) {
      assert.deepEqual(Object.keys(r.plan.summary[k].skipped).sort(), ['choice', 'empty', 'merged', 'parent_skipped', 'unused'], k);
      assert.equal(Object.values(r.plan.summary[k].skipped).reduce((a, b) => a + b, 0), r.plan.summary[k].skip, k);
    }
    assert.equal(r.plan.summary.dish.skipped.choice, 1);
    const log = (await w.admin.query(`select detail from public.activity_log where venue_id = $1 and action = 'import.apply' order by id desc limit 1`, [V])).rows[0];
    assert.deepEqual(log.detail.summary, r.plan.summary, 'the import.apply row carries it');
  });

  test('photos through the whole import: Wolt screenshots claimed, read and applied; one photo per dish, never a second; rights confirmed in the preview or not (QA-L10)', async () => {
    const OP = '55555555-5555-4555-8555-5555555555a7';
    await w.admin.query(`insert into auth.users (id, email, email_confirmed_at) values ($1, 'apply-photos@example.invalid', now())`, [OP]);
    const VP = (await rpc(w.url, OP, 'create_venue', { p_slug: 'apply-photos', p_name_he: 'תמונות', p_name_en: 'Apply Photos' })).id;
    /** One import: screenshots, the owner's claim, the scanner's draft (its dishes' photos in the import's folder), the owner's answers. */
    const once = async (rights, dishes, answers) => {
      const iid = randomUUID();
      const dir = `${VP}/imports/${iid}`;
      const mk = await rpc(w.url, OP, 'create_import', { p_venue: VP, p_source: 'wolt_screenshots', p_paths: `{${dir}/1.png}`,
        p_input_sha256: createHash('sha256').update(iid).digest('hex'), p_rights_confirmed: rights, p_import_id: iid });
      assert.equal(mk.ok, true, JSON.stringify(mk));
      const cl = await rpc(w.url, OP, 'claim_import_scan', { p_import: iid, p_mode: 'wolt_screenshots' });
      assert.equal(cl.ok, true, JSON.stringify(cl));
      const draft = draftOf([section('s-new', 'מיוחדים', 'Specials', dishes.map(([key, he, en, price, r]) => dish(key, he, en, price, { photo: { path: `${dir}/${key}.jpg`, rights: r } })))],
        [], { source: 'wolt_screenshots' });
      const sv = await rpc(w.url, 'service', 'save_import_draft', { p_import: iid, p_draft: draft });
      assert.equal(sv.ok, true, JSON.stringify(sv));
      const decisions = { v: 1, pricesConfirmed: true, choices: Object.fromEntries(Object.entries(answers).map(([k, c]) => [`photo_rights_unknown@${k}`, c])) };
      const want = planApply(draft, await existingOf(VP), decisions);
      const r = await apply(OP, iid, draft, decisions);
      assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
      assert.deepEqual(r.plan, JSON.parse(JSON.stringify(want.value)), 'the database planned what the contracts plan');
      return { iid, dir, photos: r.plan.steps.filter((s) => s.kind === 'photo').map((s) => [s.key, s.op, s.reason]) };
    };
    const assets = async () => (await w.admin.query(`select d.name_en, a.kind, a.status, a.original_path, a.provenance from public.assets a
      join public.dishes d on d.id = a.dish_id where a.venue_id = $1 order by d.name_en, a.created_at`, [VP])).rows;
    // the owner confirmed the rights at upload: each dish's photo enters the picture pipeline, waiting for review
    const first = await once(true, [['d-pie', 'פאי', 'Pie', 3400, 'confirmed'], ['d-shak', 'שקשוקה', 'Shakshuka', 4800, 'confirmed']], {});
    assert.deepEqual(first.photos, [['d-pie', 'create', null], ['d-shak', 'create', null]]);
    assert.deepEqual(await assets(), [
      { name_en: 'Pie', kind: 'photo', status: 'uploaded', original_path: `${first.dir}/d-pie.jpg`,
        provenance: { from: 'import', source: 'wolt_screenshots', rights: 'confirmed_at_upload', importId: first.iid } },
      { name_en: 'Shakshuka', kind: 'photo', status: 'uploaded', original_path: `${first.dir}/d-shak.jpg`,
        provenance: { from: 'import', source: 'wolt_screenshots', rights: 'confirmed_at_upload', importId: first.iid } },
    ]);
    // the same dishes from new screenshots: each keeps the photo it has (an import never adds a second)
    const again = await once(true, [['d-pie', 'פאי', 'Pie', 3400, 'confirmed'], ['d-shak', 'שקשוקה', 'Shakshuka', 4800, 'confirmed']], {});
    assert.ok(again.photos.every(([, op]) => op !== 'create'), JSON.stringify(again.photos));
    assert.equal((await assets()).length, 2);
    // rights not confirmed at upload: confirmed in the preview for one dish, left unanswered for the other
    const third = await once(false, [['d-tart', 'טארט', 'Tart', 3900, 'unknown'], ['d-cake', 'עוגה', 'Cake', 3600, 'unknown']], { 'd-tart': 'confirm_rights' });
    assert.deepEqual(third.photos, [['d-tart', 'create', null], ['d-cake', 'skip', 'choice']]);
    const tart = (await assets()).filter((a) => a.name_en === 'Tart');
    assert.deepEqual(tart.map((a) => [a.original_path, a.provenance.rights]), [[`${third.dir}/d-tart.jpg`, 'confirmed_at_apply']]);
    assert.equal((await assets()).filter((a) => a.name_en === 'Cake').length, 0);
  });
});

/** A small draft for venue A (a demo venue with its own menu). */
function draftOfA() {
  const d = copy(bistroDraft());
  d.sections = [d.sections[1]];
  d.groups = [];
  return d;
}
