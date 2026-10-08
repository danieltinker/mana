// Pure logic: stages, numbers, links, CSV, RPC arguments. Runs in Node, no browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../src/model.js';
import { scenario, HOSTILE } from './fixtures.mjs';
import { createStub } from './stub.mjs';

const NOW = Date.parse('2026-10-06T09:00:00Z');
const DAY = 86400000;
const iso = (d) => new Date(NOW - d * DAY).toISOString();
const base = (o = {}) => ({ id: 'b1', slug: 'juno', name_he: 'ג׳ונו', name_en: 'Juno', kind: 'restaurant', created_at: iso(1), categories: 0, items: 0, items_with_picture: 0,
  assets: {}, live: false, plan: 'trial', plan_status: 'pending', plan_state: 'pending', views_total: 0, views_7d: 0, last_activity_at: iso(1), ...o });
const stage = (o) => M.deriveBusiness(base(o), NOW);

test('stage ladder', () => {
  assert.equal(stage({}).stage, 'created');
  assert.equal(stage({ categories: 1 }).stage, 'menu');
  assert.equal(stage({ items: 3 }).stage, 'menu');
  assert.equal(stage({ items: 3, assets: { ready_for_review: 2, approved: 1 } }).stage, 'review');
  assert.equal(stage({ items: 3, assets: { processing: 1 } }).stage, 'review');
  assert.equal(stage({ items: 3, assets: { approved: 2 } }).stage, 'approved');
  assert.equal(stage({ items: 3, assets: { failed: 2 } }).stage, 'menu');
  const live = stage({ items: 3, first_published_at: iso(2), last_published_at: iso(1), live: true, plan_status: 'trialing', plan_state: 'trialing', trial_ends_at: iso(-20) });
  assert.equal(live.stage, 'live'); assert.equal(live.liveNow, true);
});

test('published but offline: expired, suspended, unpublished', () => {
  const pub = { items: 3, first_published_at: iso(40), last_published_at: iso(9), items_with_picture: 2 };
  const exp = stage({ ...pub, live: true, plan_status: 'trialing', plan_state: 'expired', trial_ends_at: iso(2) });
  assert.equal(exp.stage, 'published'); assert.equal(exp.liveNow, false); assert.equal(exp.offlineWhy, 'plan expired');
  assert.ok(exp.attention.some((a) => a.id === 'expired'));
  assert.equal(stage({ ...pub, live: true, plan_status: 'suspended', plan_state: 'suspended' }).offlineWhy, 'plan suspended');
  const un = stage({ ...pub, live: false, plan_status: 'trialing', plan_state: 'trialing', trial_ends_at: iso(-5) });
  assert.equal(un.offlineWhy, 'unpublished by owner'); assert.equal(un.stalled, false, 'a published business is never "stalled"');
});

test('stalled = 3+ days without activity before the first publish; last_asset_at counts as activity', () => {
  assert.equal(stage({ created_at: iso(10), last_activity_at: iso(2.9) }).stalled, false);
  const s = stage({ created_at: iso(10), last_activity_at: iso(3.1), items: 2 });
  assert.equal(s.stalled, true); assert.equal(s.stage, 'stalled'); assert.equal(s.base, 'menu'); assert.equal(s.idleDays, 3);
  assert.equal(stage({ created_at: iso(10), last_activity_at: iso(8), last_asset_at: iso(1) }).stalled, false);
});

test('attention hints', () => {
  const ids = (o) => stage(o).attention.map((a) => a.id);
  assert.deepEqual(ids({ items: 2, assets: { failed: 2 } }), ['failed']);
  assert.ok(ids({ items: 2, first_published_at: iso(3), live: true, plan_status: 'trialing', plan_state: 'trialing', trial_ends_at: iso(-3), views_7d: 4, views_total: 4 }).includes('trial'));
  assert.ok(ids({ items: 2, first_published_at: iso(3), live: true, plan_status: 'trialing', plan_state: 'trialing', trial_ends_at: iso(-20), views_7d: 4, views_total: 4 }).includes('nopics'));
  assert.ok(ids({ items: 2, items_with_picture: 2, first_published_at: iso(5), live: true, plan_status: 'active', plan_state: 'active' }).includes('noviews'));
  assert.deepEqual(ids({ items: 2, items_with_picture: 2, first_published_at: iso(5), live: true, plan_status: 'active', plan_state: 'active', views_7d: 1, views_total: 1 }), []);
});

test('days left are calendar days in Israel; end of day in Israel is right in summer and winter', () => {
  assert.equal(M.endOfDayIsrael('2026-10-20'), '2026-10-20T20:59:59.000Z');     // UTC+3 (summer time)
  assert.equal(M.endOfDayIsrael('2026-11-05'), '2026-11-05T21:59:59.000Z');     // UTC+2
  assert.equal(M.endOfDayIsrael('2026-02-30'), null);
  assert.equal(M.daysUntil(Date.parse('2026-10-06T20:00:00Z'), NOW), 0);
  assert.equal(M.daysUntil(Date.parse('2026-10-06T21:30:00Z'), NOW), 1, '00:30 Israel time is already tomorrow');
  assert.equal(M.dayKey(Date.parse('2026-10-06T21:30:00Z')), '2026-10-07');
});

test('overview numbers on the three fixture sets', () => {
  const stub = createStub();
  for (const [name, want] of [['empty', { businesses: 0, live: 0, newLeads: 0 }], ['one', { businesses: 1, withItems: 1, live: 0, newLeads: 1, accountsWithoutBusiness: 2 }]]) {
    stub.reset(name);
    const raw = JSON.parse(JSON.stringify(stub.state.data));
    const d = M.derive({ generatedAt: new Date().toISOString(), ...raw, businesses: raw.businesses.map((b) => ({ ...b, plan_state: b.plan_status, views_total: 0, views_7d: 0 })), viewsByDay: [], signupsByDay: [] });
    for (const [k, v] of Object.entries(want)) assert.equal(d.kpi[k], v, `${name}.${k}`);
    assert.equal(d.signups.length, 30); assert.equal(d.views.length, 30);
    assert.equal(d.funnel[0].value, d.kpi.accountsWithoutBusiness + d.kpi.businesses);
  }
});

test('series: 30 days ending today in Israel, gaps are zero, junk rows ignored', () => {
  const d = M.derive({ generatedAt: '2026-10-06T09:00:00Z', businesses: [], leads: 'nope',
    viewsByDay: [{ day: '2026-10-06', views: 5 }, { day: '2026-10-01', views: '7' }, { day: 'bad', views: 9 }, null, { day: '2026-08-01', views: 99 }],
    signupsByDay: [{ day: '2026-09-07', businesses: 2 }] });
  assert.equal(d.views.at(-1).day, '2026-10-06'); assert.equal(d.views[0].day, '2026-09-07');
  assert.equal(d.views.reduce((s, x) => s + x.value, 0), 12);
  assert.equal(d.kpi.views7, 12); assert.equal(d.signups[0].value, 2); assert.deepEqual(d.leads, []);
});

test('funnel: every step equals its tile; an optional step may be lower than the next', () => {
  const pub = { items: 3, first_published_at: iso(4), last_published_at: iso(4), live: true, plan_status: 'trialing', plan_state: 'trialing', trial_ends_at: iso(-20), views_total: 2, views_7d: 2 };
  const d = M.derive({ generatedAt: new Date(NOW).toISOString(), accountsWithoutBusiness: 3, businesses: [base({ id: 'a', ...pub }), base({ id: 'b', ...pub }), base({ id: 'c' })], leads: [] });
  assert.deepEqual(d.funnel.map((s) => s.value), [6, 3, 2, 0, 2, 2]);
  assert.equal(d.funnel[1].drop, 3); assert.equal(d.funnel[4].drop, -2);
});

test('links are built from validated parts only', () => {
  assert.equal(M.emailLink('noa@juno.test'), 'mailto:noa@juno.test');
  assert.equal(M.emailLink(HOSTILE.svgMail), null);
  assert.equal(M.emailLink('a@b.co?subject=x&bcc=evil@x.co'), null);
  assert.equal(M.emailLink('javascript:alert(1)'), null);
  assert.deepEqual(M.phoneLinks('054-202-2269'), { tel: 'tel:+972542022269', wa: 'https://wa.me/972542022269', digits: '972542022269' });
  assert.equal(M.phoneLinks('+972 52-555-0199').wa, 'https://wa.me/972525550199');
  assert.equal(M.phoneLinks('+1 (415) 555-0100').tel, 'tel:+14155550100');
  assert.equal(M.phoneLinks('03-682-0387').wa, 'https://wa.me/97236820387');
  assert.equal(M.phoneLinks('00972542022269').tel, 'tel:+972542022269');
  assert.deepEqual(M.phoneLinks('1234567'), { tel: 'tel:1234567', wa: null, digits: '1234567' });
  assert.equal(M.phoneLinks('call the office after 10'), null);
  assert.equal(M.phoneLinks('javascript:alert(1)'), null);
  assert.equal(M.contactLinks('user‮@moc.elpmaxe.test').mail, 'mailto:user@moc.elpmaxe.test');
  assert.equal(M.contactLinks('<script>').kind, 'text');
  assert.deepEqual(M.menuLinks('juno', { shortBase: 'https://halom.io/m/' }), { short: 'https://halom.io/m/juno', viewer: '../view/?m=juno', shortLabel: 'halom.io/m/juno' });
  assert.equal(M.menuLinks('juno', { shortBase: 'javascript:alert(1)//' }).short, 'https://halom.io/m/juno');
  assert.equal(M.menuLinks('juno', { viewPath: 'https://evil.example/' }).viewer, '../view/?m=juno');
  assert.equal(M.menuLinks('../../x', {}), null);
  assert.equal(M.menuLinks('a"onclick=1', {}), null);
});

test('hidden direction and control characters are removed and reported', () => {
  assert.equal(M.clean('a‮b⁦c\u0000d‏e'), 'abcd‏e');
  const l = M.deriveLead({ id: 'x', dream: 'ok ‮evil', contact: 'a@b.co', status: 'weird' });
  assert.equal(l.dream, 'ok evil'); assert.equal(l.hidden, true); assert.equal(l.status, 'new');
  assert.equal(M.deriveLead({ dream: 'שלום', contact: 'a@b.co' }).hidden, false);
});

test('leads: new first, then the ladder, newest first inside a status', () => {
  const ls = [{ status: 'spam', created: 9 }, { status: 'qualified', created: 5 }, { status: 'new', created: 1 }, { status: 'new', created: 7 }, { status: 'lost', created: 8 }];
  assert.deepEqual(M.sortLeads(ls).map((l) => `${l.status}${l.created}`), ['new7', 'new1', 'qualified5', 'lost8', 'spam9']);
});

test('CSV: BOM, CRLF, quotes, and formula cells are neutralised', () => {
  assert.equal(M.csvCell('=HYPERLINK("http://x","y")'), '"\'=HYPERLINK(""http://x"",""y"")"');
  for (const s of ['+1', '-1', '@x', '\tx', '  =x', '\r=x']) assert.ok(M.csvCell(s).startsWith('"\''), JSON.stringify(s));
  assert.equal(M.csvCell('a,b\n"c"'), '"a,b\n""c"""');
  assert.equal(M.csvCell(42), '42'); assert.equal(M.csvCell(null), '""'); assert.equal(M.csvCell('נועה'), '"נועה"');
  assert.equal(M.csvCell('x‮y'), '"xy"');
  const csv = M.toCsv(['a', 'b'], [['1', '=2']]);
  assert.equal(csv, '﻿"a","b"\r\n"1","\'=2"\r\n');
  const d = M.derive({ generatedAt: new Date().toISOString(), ...scenario('many'), viewsByDay: [], signupsByDay: [] });
  const lc = M.leadsCsv(d.leads);
  assert.ok(!/(^|,)"[=+\-@]/m.test(lc), 'no cell starts with a formula character');
  assert.ok(lc.includes('"\'=HYPERLINK(""http://evil.example/steal"",""Click for the brief"")"'));
  assert.ok(lc.includes('"\'+SUM(1+1)*cmd|\' /C calc\'!A0"') && lc.includes('"\'@SUM(A1:A9)"') && lc.includes('"\'-1234567@evil.example"'));
  const bc = M.businessesCsv(d.businesses, {});
  assert.ok(!/(^|,)"[=+\-@]/m.test(bc)); assert.ok(bc.includes('"\'+972-54-000-0000"'));
  assert.equal(bc.split('\r\n').length, 25 + 2);
});

test('plan change → exact RPC arguments', () => {
  const b = M.deriveBusiness(base({ plan: 'pilot', plan_status: 'active', plan_state: 'active' }), NOW);
  assert.deepEqual(M.planRequest(b, 'extend', '2099-11-05', false, ' two more weeks ').args,
    { p_business: 'b1', p_note: 'two more weeks', p_until: '2099-11-05T21:59:59.000Z', p_plan: 'trial', p_status: 'trialing' });
  assert.deepEqual(M.planRequest(b, 'paid', '', true, '').args, { p_business: 'b1', p_note: null, p_until: null, p_plan: 'paid', p_status: 'active' });
  assert.deepEqual(M.planRequest(b, 'suspend', '2099-01-01', false, 'x').args, { p_business: 'b1', p_note: 'x', p_until: null, p_plan: 'pilot', p_status: 'suspended' });
  assert.ok(M.planRequest(b, 'pilot', '', false, '').error);
  assert.ok(M.planRequest(b, 'pilot', '2020-01-01', false, '').past);
  assert.ok(M.planRequest(b, 'pilot', '2099-01-01', false, 'x'.repeat(501)).error);
  assert.ok(M.planRequest(b, 'nope', '2099-01-01').error);
});

test('lead edit → only changed fields are sent; a date cannot be cleared', () => {
  const l = M.deriveLead({ id: 'L1', dream: 'd', contact: 'a@b.co', status: 'new', owner: 'Daniel', next_action: 'call', next_action_on: '2026-10-08', notes: 'n' });
  const p = M.leadPatch(l, { status: 'qualified', owner: 'Daniel', notes: '' });
  assert.deepEqual(p.args, { p_id: 'L1', p_status: 'qualified', p_owner: null, p_next_action: null, p_next_action_on: null, p_notes: '' });
  assert.equal(p.changed, 2);
  assert.equal(M.leadPatch(l, {}).changed, 0);
  assert.ok(M.leadPatch(l, { nextOn: '' }).errors.length);
  assert.ok(M.leadPatch(l, { owner: 'x'.repeat(81) }).errors.length);
  assert.ok(M.leadPatch(l, { status: 'won' }).errors.length);
  assert.equal(M.leadPatch(l, { nextOn: '2026-10-09' }).args.p_next_action_on, '2026-10-09');
});

test('sorting and filtering businesses', () => {
  const d = M.derive({ generatedAt: new Date().toISOString(), ...scenario('many'), viewsByDay: [], signupsByDay: [] });
  const by = (k, dir) => M.sortBusinesses(d.businesses, k, dir);
  const items = by('items', 'desc').map((b) => b.items);
  assert.deepEqual(items, [...items].sort((a, b) => b - a));
  assert.equal(by('name', 'asc')[0].nameEn, '<img src=x onerror=window.__xss=1>');
  assert.equal(M.filterBusinesses(d.businesses, 'all', 'JUNO').length, 2);
  assert.equal(M.filterBusinesses(d.businesses, 'all', 'אבו').length, 1);
  assert.equal(M.filterBusinesses(d.businesses, 'nope', '').length, 25);
});
