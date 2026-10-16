// The phase-1 RPC inputs and read shapes: availability, onboarding, support, activity, dashboards, the back office,
// export, the config flags, and the time fix (an override's end in whole minutes).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTIVITY_ACTIONS, activityChanges, AUDITED_TABLES, auditOpsOf, configFlags, isActivityAction, isAutoStep, isUntilSpec, LIVE_REFRESH,
  NUDGE_CODES, onboardingProgress, OPS_WARNINGS, pollDelay, resolveUntil, timelineKind, validateActivityQuery, validateDashboardQuery,
  validateExportQuery, validateOpenCase, validateOpsAnalyticsQuery, validateOpsVenueQuery, validateOpsVenuesQuery, validateRestoreToday,
  validateOpsRevisionQuery, validateSetAvailability, validateSetDemo, validateSetStep, validateUpdateCase, venueFilter, zonedTime, type Validation,
} from '../src/index.ts';

const V = '00000000-0000-4000-8000-0000000000c1';
const D = '00000000-0000-4000-8000-00000000d001';
const errs = (r: Validation<unknown>) => (r.ok ? [] : r.errors.map((e) => e.code).sort());

test('resolveUntil: a duration ends on a whole minute, never early', () => {
  const H = { timeZone: 'Asia/Jerusalem', weekly: [], closures: [] };
  const now = Date.parse('2026-10-16T09:12:37.250Z');
  assert.equal(resolveUntil({ kind: 'duration', minutes: 120 }, now, H)!.toISOString(), '2026-10-16T11:13:00.000Z');
  const whole = Date.parse('2026-10-16T09:12:00.000Z');
  assert.equal(resolveUntil({ kind: 'duration', minutes: 30 }, whole, H)!.toISOString(), '2026-10-16T09:42:00.000Z', 'already whole: unchanged');
  assert.equal(resolveUntil({ kind: 'time', at: '14:30' }, now, H)!.toISOString(), new Date(zonedTime('2026-10-16', '14:30', 'Asia/Jerusalem')).toISOString());
});

test('isUntilSpec accepts what app.until_spec_ok accepts', () => {
  for (const ok of [{ kind: 'duration', minutes: 1 }, { kind: 'duration', minutes: 43200 }, { kind: 'time', at: '23:59' }, { kind: 'date', date: '2026-10-20' },
    { kind: 'next_opening' }, { kind: 'indefinite' }]) assert.equal(isUntilSpec(ok), true, JSON.stringify(ok));
  for (const bad of [null, [], {}, { kind: 'duration', minutes: 0 }, { kind: 'duration', minutes: 43201 }, { kind: 'duration', minutes: 1.5 },
    { kind: 'time', at: '24:00' }, { kind: 'date', date: '2026-02-30' }, { kind: 'forever' }]) assert.equal(isUntilSpec(bad), false, JSON.stringify(bad));
});

test('set_availability and restore_today inputs', () => {
  assert.deepEqual(errs(validateSetAvailability({ venueId: V, target: { kind: 'dish', id: D }, until: { kind: 'duration', minutes: 120 }, note: 'grill down' })), []);
  assert.deepEqual(errs(validateSetAvailability({ venueId: V, target: { kind: 'option', id: D }, until: null })), [], 'null = back now');
  assert.deepEqual(errs(validateSetAvailability({ venueId: 'x', target: { kind: 'table', id: 'y' }, until: { kind: 'forever' }, note: 'x'.repeat(201), extra: 1 })),
    ['enum_invalid', 'field_not_allowed', 'id_invalid', 'id_invalid', 'text_too_long', 'until_invalid']);
  assert.deepEqual(errs(validateSetAvailability({ venueId: V, target: { kind: 'dish', id: D }, until: null, note: `a${String.fromCharCode(0)}` })), ['text_invalid']);
  assert.deepEqual(errs(validateRestoreToday({ venueId: V })), []);
  assert.deepEqual(errs(validateRestoreToday({})), ['id_invalid']);
});

test('onboarding: progress in journey order; automatic steps are the database\'s to mark done', () => {
  const p = onboardingProgress([{ step: 'venue', state: 'done' }, { step: 'menu', state: 'done' }, { step: 'review', state: 'skipped' }, { step: 'hours', state: 'done' }]);
  assert.deepEqual([p.done, p.total, p.next, p.complete], [4, 9, 'addons', false]);
  assert.deepEqual(p.steps.map((s) => [s.step, s.state, s.auto]).slice(0, 4), [['venue', 'done', true], ['menu', 'done', true], ['review', 'skipped', true], ['addons', 'todo', false]]);
  const all = onboardingProgress(['venue', 'menu', 'review', 'addons', 'photos', 'hours', 'style', 'test', 'publish'].map((step) => ({ step: step as any, state: 'done' as const })));
  assert.deepEqual([all.next, all.complete], [null, true]);
  assert.equal(isAutoStep('publish'), true);
  assert.equal(isAutoStep('photos'), false);
  assert.deepEqual(errs(validateSetStep({ venueId: V, step: 'photos', state: 'done' })), []);
  assert.deepEqual(errs(validateSetStep({ venueId: V, step: 'review', state: 'skipped', blockers: [] })), []);
  assert.deepEqual(errs(validateSetStep({ venueId: V, step: 'publish', state: 'done' })), ['step_automatic']);
  assert.deepEqual(errs(validateSetStep({ venueId: V, step: 'menu', state: 'skipped' })), ['step_automatic'], 'of the automatic steps only review is skipped');
  assert.deepEqual(errs(validateSetStep({ venueId: V, step: 'menu', state: 'doing' })), []);
  assert.deepEqual(errs(validateSetStep({ venueId: V, step: 'photos', state: 'blocked', blockers: ['dish_without_price', 'Free text!'] })), ['blocker_invalid']);
  assert.deepEqual(errs(validateSetStep({ venueId: V, step: 'party', state: 'done' })), ['enum_invalid']);
});

test('support: get help, and staff updates with a reason', () => {
  assert.deepEqual(errs(validateOpenCase({ venueId: V, topic: 'import', subject: 'The Wolt prices look off', body: 'Second section', allowAct: true })), []);
  assert.deepEqual(errs(validateOpenCase({ venueId: V, topic: 'import', subject: ` ${String.fromCodePoint(0x200b)}` })), ['text_missing']);
  assert.deepEqual(errs(validateOpenCase({ venueId: V, topic: 'billing', subject: 'x'.repeat(161), allowAct: 'yes' })), ['enum_invalid', 'text_too_long', 'type']);
  assert.deepEqual(errs(validateUpdateCase({ caseId: D, status: 'resolved', reason: 'Prices fixed with the owner' })), []);
  assert.deepEqual(errs(validateUpdateCase({ caseId: D, reason: 'ok' })), ['nothing_to_change', 'reason_required']);
  assert.deepEqual(errs(validateUpdateCase({ caseId: D, status: 'open' })), ['reason_required'], 'the reason may be left out of the call, never of the update');
  assert.deepEqual(errs(validateOpenCase({ venueId: V, topic: 'menu', subject: 'Help', body: null })), [], 'a null body is no body');
});

test('activity: every action the database logs today is on the closed list; tables and named actions', () => {
  assert.equal(new Set(ACTIVITY_ACTIONS).size, ACTIVITY_ACTIONS.length);
  assert.ok(isActivityAction('dishes.update') && isActivityAction('import.apply') && isActivityAction('leads.update') && isActivityAction('menu.read'));
  assert.ok(!isActivityAction('venues.insert') && !isActivityAction('leads.read.all') && !isActivityAction(7));
  assert.deepEqual(auditOpsOf('venues'), ['update']);
  // the migrations, read as text: app.log(..., '<action>' and the audited tables' triggers
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations');
  if (!fs.existsSync(dir)) return;
  const sql = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n');
  const named = [...sql.matchAll(/app\.log\([^,]+,\s*'([a-z_.]+)'/g)].map((m) => m[1]!);
  assert.ok(named.length >= 10);
  for (const a of named) assert.ok(isActivityAction(a), a);
  const audited = sql.match(/foreach t in array array\[([^\]]+)\] loop\s+vcol/)?.[1]?.match(/'([a-z_]+)'/g)?.map((x) => x.slice(1, -1)) ?? [];
  assert.deepEqual([...audited, 'leads'].sort(), [...AUDITED_TABLES].sort());
});

test('activity: query and the update detail', () => {
  assert.deepEqual(errs(validateActivityQuery({ venueId: V, before: 120, limit: 50, actor: 'staff', via: 'act_for_owner' })), []);
  assert.deepEqual(errs(validateActivityQuery({ venueId: V, before: 0, limit: 101, actor: 'guest', via: 'api' })), ['enum_invalid', 'enum_invalid', 'id_invalid', 'limit_invalid']);
  assert.deepEqual(activityChanges({ detail: { columns: ['price', 'name_en'], changes: { price: [6400, 6800], bad: [1] } } }),
    { columns: ['price', 'name_en'], changes: { price: [6400, 6800] } });
  assert.deepEqual(activityChanges({ detail: { revision: 3 } }), { columns: [], changes: {} });
  assert.equal(timelineKind('onboarding_progress.update'), 'onboarding');
  assert.equal(timelineKind('import.apply'), 'import');
  assert.equal(timelineKind('menu.publish'), 'publish');
  assert.equal(timelineKind('venue.approve'), 'publish');
  assert.equal(timelineKind('support_cases.insert'), 'case');
  assert.equal(timelineKind('support.act_for_owner'), 'halom');
  assert.equal(timelineKind('availability_overrides.update'), 'availability');
  assert.equal(timelineKind('dish_addon_groups.insert'), 'menu');
  assert.equal(timelineKind('menu.export'), 'menu');
  assert.equal(timelineKind('menu.read'), 'publish');
  assert.equal(timelineKind('venue_hours.update'), 'settings');
});

test('dashboards: the query, the nudges, staying live', () => {
  assert.deepEqual(errs(validateDashboardQuery({ venueId: V, range: '7d' })), []);
  assert.deepEqual(errs(validateDashboardQuery({ venueId: V, range: '90d' })), ['range_invalid']);
  assert.equal(new Set(NUDGE_CODES).size, NUDGE_CODES.length);
  assert.deepEqual(LIVE_REFRESH.realtimeTables, ['rollups_minute', 'rollups_day', 'availability_overrides']);
  assert.equal(venueFilter(V), `venue_id=eq.${V}`);
  assert.equal(pollDelay(15_000, 0, () => 0.5), 15_000);
  assert.equal(pollDelay(15_000, 2, () => 0.5), 60_000);
  assert.equal(pollDelay(15_000, 10, () => 0.5), LIVE_REFRESH.maxBackoffMs);
  assert.equal(pollDelay(15_000, 0, () => 0), 13_500);
  assert.equal(pollDelay(15_000, 0, () => 1), 16_500);
  assert.equal(pollDelay(15_000, 3, () => 1), LIVE_REFRESH.maxBackoffMs, 'never above 120 s, jitter included');
  // round 3: a slow safety poll beside a Realtime subscription (what the subscribed tables do not carry)
  assert.equal(LIVE_REFRESH.safetyMs, 60_000);
  assert.equal(pollDelay(LIVE_REFRESH.safetyMs, 0, () => 0.5), 60_000);
  assert.equal(pollDelay(LIVE_REFRESH.safetyMs, 1, () => 0.5), LIVE_REFRESH.maxBackoffMs);
});

test('the back office: clients list, venue, analytics, demo', () => {
  assert.deepEqual(errs(validateOpsVenuesQuery({})), []);
  assert.deepEqual(errs(validateOpsVenuesQuery({ q: 'demo', stage: 'complete', warning: 'stuck_step_2d', review: 'pending', planState: 'trialing', plan: 'pilot', demo: 'only', sort: 'opens_today', limit: 50, offset: 100 })), []);
  for (const q of [String.fromCodePoint(0x200b), String.fromCodePoint(0xa0), ' \t ']) assert.deepEqual(errs(validateOpsVenuesQuery({ q })), ['text_missing'], JSON.stringify(q));
  assert.deepEqual(errs(validateOpsVenuesQuery({ q: ` ${'x'.repeat(80)} ` })), [], 'measured after stripping');
  assert.deepEqual(errs(validateOpsVenuesQuery({ q: '  ', stage: 'done', warning: 'late', demo: 'all', sort: 'size', limit: 501, offset: -1, page: 2 })),
    ['enum_invalid', 'enum_invalid', 'enum_invalid', 'enum_invalid', 'field_not_allowed', 'limit_invalid', 'limit_invalid', 'text_missing']);
  assert.equal(new Set(OPS_WARNINGS).size, OPS_WARNINGS.length);
  assert.deepEqual(errs(validateOpsVenueQuery({ venueId: V })), []);

  const minute = { resolution: 'minute', from: '2026-10-16T08:00:00Z', to: '2026-10-16T09:00:00+00:00' };
  assert.deepEqual(errs(validateOpsAnalyticsQuery(minute)), []);
  assert.deepEqual(errs(validateOpsAnalyticsQuery({ ...minute, venueId: V, demo: 'include', names: ['menu_opened', 'import_parsed'] })), []);
  assert.deepEqual(errs(validateOpsAnalyticsQuery({ ...minute, from: '2026-10-16T08:00:30Z' })), ['time_invalid'], 'whole minutes');
  assert.deepEqual(errs(validateOpsAnalyticsQuery({ ...minute, from: '2026-10-16T08:00:00' })), ['time_invalid'], 'an offset is required');
  assert.deepEqual(errs(validateOpsAnalyticsQuery({ ...minute, to: '2026-10-17T08:01:00Z' })), ['range_too_long']);
  assert.deepEqual(errs(validateOpsAnalyticsQuery({ ...minute, to: minute.from })), ['range_invalid']);
  assert.deepEqual(errs(validateOpsAnalyticsQuery({ ...minute, names: ['payment_confirmed'] })), ['enum_invalid'], 'reserved names are not counted yet');
  assert.deepEqual(errs(validateOpsAnalyticsQuery({ resolution: 'day', from: '2026-01-01', to: '2026-10-16' })), []);
  assert.deepEqual(errs(validateOpsAnalyticsQuery({ resolution: 'day', from: '2025-01-01', to: '2026-10-16' })), ['range_too_long']);
  assert.deepEqual(errs(validateOpsAnalyticsQuery({ resolution: 'day', from: '2026-10-17', to: '2026-10-16' })), ['range_invalid']);
  assert.deepEqual(errs(validateOpsAnalyticsQuery({ resolution: 'hour', from: 'x', to: 'y' })), ['enum_invalid']);

  assert.deepEqual(errs(validateSetDemo({ venueId: V, demo: true, reason: 'Synthetic venue for the walkthrough' })), []);
  assert.deepEqual(errs(validateSetDemo({ venueId: V, demo: 'yes', reason: ' ab ' })), ['reason_required', 'type']);
  assert.deepEqual(errs(validateExportQuery({ venueId: V })), []);
  assert.deepEqual(errs(validateOpsRevisionQuery({ venueId: V })), []);
  assert.deepEqual(errs(validateOpsRevisionQuery({ venueId: V, revision: null })), []);
  assert.deepEqual(errs(validateOpsRevisionQuery({ venueId: V, revision: 3 })), []);
  assert.deepEqual(errs(validateOpsRevisionQuery({ venueId: 'x', revision: 0, n: 1 })), ['field_not_allowed', 'id_invalid', 'revision_invalid']);
});

test('config flags: absent means production, v1, realtime; a broken value is reported and replaced', () => {
  assert.deepEqual(configFlags(undefined), { env: 'production', schema: 1, realtime: true, issues: [] });
  assert.deepEqual(configFlags({ supabaseUrl: 'x' }), { env: 'production', schema: 1, realtime: true, issues: [] });
  assert.deepEqual(configFlags({ env: 'local', schema: 2, realtime: false }), { env: 'local', schema: 2, realtime: false, issues: [] });
  assert.deepEqual(configFlags({ env: 'demo', schema: 2 }), { env: 'demo', schema: 2, realtime: true, issues: [] });
  assert.deepEqual(configFlags({ schema: 2 }), { env: 'production', schema: 1, realtime: true, issues: [{ code: 'schema_env_mismatch', path: 'schema' }] },
    'production stays on v1 until the cutover');
  assert.deepEqual(configFlags({ env: 'staging', schema: '2', realtime: 0 }), {
    env: 'production', schema: 1, realtime: true,
    issues: [{ code: 'env_invalid', path: 'env' }, { code: 'schema_invalid', path: 'schema' }, { code: 'realtime_invalid', path: 'realtime' }],
  });
});
