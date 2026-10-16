// The SQL twins of the contracts agree with them on the same inputs: every phase-1 input's validator (generated and
// fixture inputs), isUntilSpec, the closed lists the database keeps, and app.resolve_until (starts off the whole minute,
// the DST edges of Asia/Jerusalem).
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { A, world } from './harness/world.mjs';
import { ABSENT, ANY, compareValidator, inputs } from './harness/parity.mjs';
import {
  EVENT_NAMES, isUntilSpec, NUDGE_CODES, ONBOARDING_AUTO_STEPS, ONBOARDING_STEPS, OPS_WARNINGS, resolveUntil, validateActivityQuery,
  validateCreateImport, validateDashboardQuery, validateExportQuery, validateOpenCase, validateOpsAnalyticsQuery, validateOpsVenueQuery,
  validateOpsVenuesQuery, validateRestoreToday, validateSetAvailability, validateSetDemo, validateSetStep, validateUpdateCase,
} from '../../packages/contracts/src/index.ts';

let w;
before(async () => { w = await world(); });
after(async () => { await w?.stop(); });

const cp = (...c) => String.fromCodePoint(...c);
const V = '00000000-0000-4000-8000-0000000000c1';
const D = '00000000-0000-4000-8000-00000000d001';
const OTHER = '00000000-0000-4000-8000-0000000000c2';
const ids = [...ANY, V, V.toUpperCase(), 'not-a-uuid', `${V}x`];
const reasons = [...ANY, 'ab', 'abc', ' ab ', `${cp(0x200b)}abc`, 'x'.repeat(500), 'x'.repeat(501), ` ${'x'.repeat(500)} `, cp(0x1f600).repeat(300)];

describe('the inputs\' validators', () => {
  test('set_onboarding_step', async () => {
    const n = await compareValidator(w.admin, 'app.validate_set_step', validateSetStep, inputs(
      { venueId: V, step: 'photos', state: 'done', blockers: ['dish_without_price'] },
      { venueId: ids, step: [...ANY, ...ONBOARDING_STEPS, 'party'], state: [...ANY, 'todo', 'doing', 'done', 'skipped', 'blocked', 'DONE'],
        blockers: [ABSENT, null, [], ['ok_word'], ['Free text!'], [1], ['a'], Array(20).fill('a_b'), Array(21).fill('a_b'), 'x', {}] }));
    assert.ok(n > 150);
  });

  test('set_availability, and isUntilSpec against app.v_until and app.until_spec_ok', async () => {
    const untils = [ABSENT, null, {}, [], 'x', { kind: 'duration', minutes: 0 }, { kind: 'duration', minutes: 1 }, { kind: 'duration', minutes: 43200 },
      { kind: 'duration', minutes: 43201 }, { kind: 'duration', minutes: 1.5 }, { kind: 'duration', minutes: '5' }, { kind: 'time', at: '23:59' },
      { kind: 'time', at: '24:00' }, { kind: 'time', at: '9:00' }, { kind: 'date', date: '2026-10-20' }, { kind: 'date', date: '2026-02-30' },
      { kind: 'date', date: '1999-12-31' }, { kind: 'date', date: '2000-01-01' }, { kind: 'date', date: '2100-12-31' }, { kind: 'date', date: '2101-01-01' },
      { kind: 'date', date: '2026-1-1' }, { kind: 'next_opening' }, { kind: 'indefinite' }, { kind: 'forever' }, { kind: 5 }];
    await compareValidator(w.admin, 'app.validate_set_availability', validateSetAvailability, inputs(
      { venueId: V, target: { kind: 'dish', id: D }, until: { kind: 'duration', minutes: 120 }, note: 'grill down' },
      { venueId: ids, target: [...ANY, { kind: 'table', id: D }, { kind: 'dish' }], 'target.kind': [...ANY, 'section', 'dish', 'option', 'table'],
        'target.id': [...ANY, D, 'nope'], until: untils, note: [...ANY, 'x'.repeat(200), 'x'.repeat(201), cp(0x1f600).repeat(150)] }));
    const specs = untils.filter((u) => u !== ABSENT);
    const { rows } = await w.admin.query(`select jsonb_agg(jsonb_build_array(app.v_until(x), app.until_spec_ok(x)) order by i) as r
      from jsonb_array_elements($1::jsonb) with ordinality t(x, i)`, [JSON.stringify(specs)]);
    specs.forEach((s, i) => assert.deepEqual(rows[0].r[i], [isUntilSpec(s), isUntilSpec(s)], JSON.stringify(s)));
  });

  test('restore_today, export_menu, ops_venue: one venue id', async () => {
    const list = inputs({ venueId: V }, { venueId: ids });
    for (const fn of [validateRestoreToday, validateExportQuery, validateOpsVenueQuery]) await compareValidator(w.admin, 'app.validate_venue_input', fn, list);
  });

  test('open_case and ops_update_case', async () => {
    await compareValidator(w.admin, 'app.validate_open_case', validateOpenCase, inputs(
      { venueId: V, topic: 'import', subject: 'The prices look off', body: 'Second section', allowAct: true },
      { venueId: ids, topic: [...ANY, 'billing', 'other'],
        subject: [...ANY, `${cp(0x200b)} `, 'x'.repeat(160), 'x'.repeat(161), ` ${'x'.repeat(160)} `, cp(0x1f600).repeat(100)],
        body: [...ANY, 'x'.repeat(4000), 'x'.repeat(4001)], allowAct: ANY }));
    await compareValidator(w.admin, 'app.validate_update_case', validateUpdateCase, inputs(
      { caseId: D, status: 'resolved', topic: 'menu', reason: 'Prices fixed with the owner' },
      { caseId: ids, status: [...ANY, 'closed', 'open', 'waiting_owner'], topic: [...ANY, 'billing', 'photos'], reason: reasons }));
  });

  test('venue_activity, my_dashboard, ops_set_demo', async () => {
    await compareValidator(w.admin, 'app.validate_activity_query', validateActivityQuery, inputs(
      { venueId: V, before: 120, limit: 50, actor: 'staff', via: 'act_for_owner' },
      { venueId: ids, before: [...ANY, 120, 0, 2 ** 53 - 1], limit: [...ANY, 100, 101, 50], actor: [...ANY, 'guest', 'owner'], via: [...ANY, 'api', 'rpc'] }));
    await compareValidator(w.admin, 'app.validate_dashboard_query', validateDashboardQuery, inputs(
      { venueId: V, range: '7d' }, { venueId: ids, range: [...ANY, 'today', '30d', '90d'] }));
    await compareValidator(w.admin, 'app.validate_set_demo', validateSetDemo, inputs(
      { venueId: V, demo: true, reason: 'Synthetic venue for the walkthrough' }, { venueId: ids, demo: ANY, reason: reasons }));
  });

  test('ops_venues', async () => {
    await compareValidator(w.admin, 'app.validate_ops_venues_query', validateOpsVenuesQuery, inputs(
      { q: 'demo', stage: 'complete', warning: 'stuck_step_2d', review: 'pending', planState: 'trialing', plan: 'pilot', demo: 'only', sort: 'opens_today', limit: 50, offset: 100 },
      { q: [...ANY, '  ', '\t\n', cp(0x200b), cp(0x85), cp(0xa0, 0x3000, 0xfeff), 'x'.repeat(80), 'x'.repeat(81), cp(0x1f600).repeat(50)],
        stage: [...ANY, 'photos', 'done', 'complete'], warning: [...ANY, ...OPS_WARNINGS, 'late'], review: [...ANY, 'approved', 'not_requested'],
        planState: [...ANY, 'suspended', 'paused'], plan: [...ANY, 'paid', 'free'], demo: [...ANY, 'exclude', 'all'], sort: [...ANY, 'name', 'size'],
        limit: [...ANY, 500, 501], offset: [...ANY, 0, 100] }));
  });

  test('ops_analytics: minute and day series', async () => {
    const instants = [...ANY, '2026-10-16T08:00:00Z', '2026-10-16T08:00:30Z', '2026-10-16T08:00:00', '2026-10-16T08:00Z', '2026-10-16T08:00:00.000Z',
      '2026-10-16T08:00:00.0004Z', '2026-10-16T08:00:00.5Z', '2026-10-16T10:00:00+02:00', '2026-10-15T08:00:00Z', '2026-10-17T08:00:00Z',
      '2026-10-17T08:01:00Z', '2026-13-01T00:00:00Z', '2026-10-16', '2026-10-16 08:00:00Z'];
    await compareValidator(w.admin, 'app.validate_ops_analytics_query', validateOpsAnalyticsQuery, inputs(
      { resolution: 'minute', from: '2026-10-16T08:00:00Z', to: '2026-10-16T09:00:00+00:00', venueId: V, demo: 'include', names: ['menu_opened', 'import_parsed'] },
      { venueId: ids, demo: [...ANY, 'exclude', 'all'], names: [...ANY, ['payment_confirmed'], ['menu_opened', 'menu_opened'], ['dish_viewed'], [...EVENT_NAMES]],
        resolution: [...ANY, 'minute', 'day', 'hour'], from: instants, to: instants }));
    const dates = [...ANY, '2026-01-01', '2026-10-16', '2026-10-17', '2025-01-01', '2025-09-12', '2025-09-11', '0050-01-01', '2026-02-30', '2024-02-29',
      '2026-1-1', '2026-10-16T08:00:00Z'];
    await compareValidator(w.admin, 'app.validate_ops_analytics_query', validateOpsAnalyticsQuery, inputs(
      { resolution: 'day', from: '2026-01-01', to: '2026-10-16' }, { from: dates, to: dates, resolution: [...ANY, 'day', 'minute'] }, { seed: 11 }));
  });

  test('create_import: text for text sources, private paths and a hash for images, rights only for Wolt screenshots', async () => {
    const pools = {
      venueId: ids, source: [...ANY, 'scan', 'paste', 'wolt_text', 'wolt_screenshots', 'wolt_page'],
      text: [...ANY, ' \n ', `${cp(0x200b)}`, 'Soup 32', 'x'.repeat(60000), 'x'.repeat(60001)],
      paths: [...ANY, [`${V}/a.jpg`], [`${OTHER}/a.jpg`], ['../x'], [`${V}/../x.jpg`], [`${V.toUpperCase()}/a.jpg`], ['/abs.jpg'], [5],
        Array(20).fill(`${V}/a.jpg`), Array(21).fill(`${V}/a.jpg`), [`${V}/${'x'.repeat(200)}`]],
      inputSha256: [...ANY, 'ABC', 'a'.repeat(64), 'A'.repeat(64), 'a'.repeat(63)], rightsConfirmed: ANY,
    };
    await compareValidator(w.admin, 'app.validate_create_import', validateCreateImport, inputs(
      { venueId: V, source: 'wolt_text', text: 'Mains\nSchnitzel 64', paths: null, inputSha256: null, rightsConfirmed: false }, pools, { random: 100 }));
    await compareValidator(w.admin, 'app.validate_create_import', validateCreateImport, inputs(
      { venueId: V, source: 'wolt_screenshots', text: null, paths: [`${V}/imports/1.png`], inputSha256: 'a'.repeat(64), rightsConfirmed: true }, pools,
      { random: 100, seed: 3 }));
  });
});

describe('the closed lists the database keeps', () => {
  test('ONBOARDING_STEPS, ONBOARDING_AUTO_STEPS, OPS_WARNINGS, NUDGE_CODES, EVENT_NAMES', async () => {
    const { rows } = await w.admin.query(`select app.onboarding_steps() s, app.onboarding_auto_steps() a, app.ops_warnings() w, app.nudge_codes() n,
      app.event_names() e, pg_get_functiondef('app.guard_onboarding()'::regprocedure) g`);
    assert.deepEqual(rows[0].s, [...ONBOARDING_STEPS]);
    assert.deepEqual(rows[0].a, [...ONBOARDING_AUTO_STEPS]);
    assert.deepEqual(rows[0].w, [...OPS_WARNINGS]);
    assert.deepEqual(rows[0].n, [...NUDGE_CODES]);
    assert.deepEqual(rows[0].e, [...EVENT_NAMES]);
    assert.ok(rows[0].g.includes(`in (${ONBOARDING_AUTO_STEPS.map((s) => `'${s}'`).join(', ')})`), 'the guard writes the same list out');
  });
});

describe('app.resolve_until agrees with resolveUntil', () => {
  test('starts off the whole minute, and the DST edges (spring forward 27 Mar, fall back 25 Oct 2026)', async () => {
    const { rows: hrs } = await w.admin.query(`select weekday, to_char(opens, 'HH24:MI') as f, to_char(closes, 'HH24:MI') as t from public.venue_hours where venue_id = $1`, [A]);
    const hours = { timeZone: 'Asia/Jerusalem', weekly: hrs.map((h) => ({ days: [h.weekday], from: h.f, to: h.t })), closures: [] };
    const specs = [
      { kind: 'duration', minutes: 1 }, { kind: 'duration', minutes: 30 }, { kind: 'duration', minutes: 61 }, { kind: 'duration', minutes: 120 },
      { kind: 'duration', minutes: 1440 }, { kind: 'time', at: '02:30' }, { kind: 'time', at: '01:30' }, { kind: 'time', at: '00:00' },
      { kind: 'time', at: '14:30' }, { kind: 'next_opening' }, { kind: 'date', date: '2026-03-27' }, { kind: 'date', date: '2026-10-25' },
      { kind: 'indefinite' },
    ];
    const moments = [
      '2026-10-16T09:12:37.250Z', '2026-10-16T09:12:00.000Z', '2026-10-16T09:12:59.999Z', '2026-10-16T09:12:00.001Z',
      '2026-03-26T23:30:30.250Z', '2026-03-26T23:59:59.999Z', '2026-03-27T00:00:00.001Z', '2026-03-27T00:29:15.500Z',
      '2026-10-24T21:59:30.000Z', '2026-10-24T22:30:45.500Z', '2026-10-24T22:59:59.500Z', '2026-10-24T23:00:00.500Z', '2026-10-24T23:30:30.000Z',
    ].map(Date.parse);
    let n = 0;
    for (const at of moments) {
      for (const spec of specs) {
        const sql = (await w.admin.query(`select app.resolve_until($1, $2::jsonb, $3::timestamptz) as u`, [A, JSON.stringify(spec), new Date(at).toISOString()])).rows[0].u;
        const ts = resolveUntil(spec, at, hours);
        assert.equal(sql ? sql.toISOString() : null, ts ? ts.toISOString() : null, `${JSON.stringify(spec)} at ${new Date(at).toISOString()}`);
        if (spec.kind === 'duration') assert.equal(sql.getTime() % 60000, 0, 'a whole minute');
        n++;
      }
    }
    assert.equal(n, moments.length * specs.length);
  });
});
