// The QA's fifth look (QA-M5 and the Lows after it): a lost write is recognised by its own log entry, never by a value
// alone; a plan's review says what happens to its end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ActivityEntry, ActivityPage, ActForOwnerInput } from '@mana/contracts';
import { ID } from '@mana/contracts/fixtures';
import { actWant, logMark, ownEntry, sameInstant } from '../../src/v2/landed.ts';
import { planEnd } from '../../src/v2/model.ts';
import { codeOf, isCode, keyGroups, mfaWords, qrSrc } from '../../src/v2/mfa.ts';
import { opsApi } from '../../src/v2/api.ts';
import { USERS, VENUE, fakeBackend, world } from './fake.ts';

const NOW = Date.parse('2026-10-20T10:00:00Z');
const e = (id: number, o: Partial<ActivityEntry>): ActivityEntry => ({
  id, at: '2026-10-20T10:00:00Z', actorKind: 'staff', you: true, via: 'act_for_owner', action: 'support.act_for_owner', targetTable: null, targetIds: [],
  n: 1, targetName: null, reason: 'Owner asked by phone', detail: {}, ...o,
});
const page = (entries: ActivityEntry[], next: number | null = null): ActivityPage => ({ entries, next });
const at = { reason: 'Owner asked by phone', mark: 10 };

test('ownEntry (QA-M5): yes only for this reader\'s entry above the mark, with the reason and what it set; no only when the read reaches the mark', () => {
  const want = { action: 'plan.set', match: (x: ActivityEntry) => x.detail.state === 'trialing' };
  const mine = e(12, { action: 'plan.set', via: 'rpc', detail: { state: 'trialing' } });
  assert.equal(ownEntry(page([mine, e(9, {})]), at, want), 'yes');
  assert.equal(ownEntry(page([{ ...mine, you: false }, e(9, {})]), at, want), 'no', 'another staff member\'s');
  assert.equal(ownEntry(page([{ ...mine, reason: 'Something else' }, e(9, {})]), at, want), 'no', 'another reason');
  assert.equal(ownEntry(page([{ ...mine, detail: { state: 'active' } }, e(9, {})]), at, want), 'no', 'another state');
  assert.equal(ownEntry(page([{ ...mine, id: 10 }]), at, want), 'no', 'not above the mark: an earlier write');
  assert.equal(ownEntry(page([e(15, {}), e(14, {})], 14), at, want), 'unknown', 'the read stops above the mark');
  assert.equal(ownEntry(page([]), at, want), 'no', 'nothing at all, and nothing older');
  assert.equal(ownEntry(null, at, want), 'unknown', 'the read failed');
  assert.equal(logMark([e(3, {}), e(41, {}), e(7, {})]), 41);
  assert.equal(logMark([]), 0);
});

test('actWant (QA-M5): a take-off is its target and its "until", a dish its columns, a step its state; a value already so is not the write', () => {
  const off: ActForOwnerInput = { venueId: VENUE.demo, reason: '', action: 'availability.set',
    payload: { targetKind: 'dish', targetId: ID.espresso, until: { kind: 'indefinite' } } };
  const w = actWant(off);
  const logged = e(20, { targetIds: [ID.espresso, '00000000-0000-4000-8000-000000003100'], detail: { action: 'availability.set', until: 'indefinite' } });
  assert.equal(ownEntry(page([logged, e(9, {})]), at, w), 'yes');
  assert.equal(ownEntry(page([{ ...logged, detail: { action: 'availability.set', until: 'duration' } }, e(9, {})]), at, w), 'no', 'another "until"');
  assert.equal(ownEntry(page([{ ...logged, targetIds: [ID.burger] }, e(9, {})]), at, w), 'no', 'another target');
  // the espresso was already off before: nothing in the log above the mark says this page took it off
  assert.equal(ownEntry(page([e(9, {})]), at, w), 'no');
  const dish = actWant({ venueId: VENUE.demo, reason: '', action: 'dish.update', payload: { dishId: ID.burger, patch: { price: 7700 }, expectedUpdatedAt: '2026-10-20T09:00:00Z' } });
  assert.equal(dish.match!(e(1, { targetIds: [ID.burger], detail: { action: 'dish.update', patchKeys: ['price'] } })), true);
  assert.equal(dish.match!(e(1, { targetIds: [ID.burger], detail: { action: 'dish.update', patchKeys: ['hidden'] } })), false);
  const step = actWant({ venueId: VENUE.demo, reason: '', action: 'onboarding.set', payload: { step: 'photos', state: 'skipped', expectedUpdatedAt: null } });
  assert.equal(step.match!(e(1, { detail: { action: 'onboarding.set', result: { step: 'photos', state: 'skipped' } } })), true);
  assert.equal(step.match!(e(1, { detail: { action: 'onboarding.set', result: { step: 'photos', state: 'doing' } } })), false);
  assert.equal(sameInstant('2026-12-31T21:59:59.000Z', '2026-12-31T21:59:59Z'), true, 'the log keeps whole seconds');
  assert.equal(sameInstant(null, undefined), true);
  assert.equal(sameInstant('2026-12-31T21:59:59Z', null), false);
});

test('the fake logs as the database does: the reader\'s own entries are `you`, with the reason and what was set', async () => {
  const w = world({ now: () => NOW });
  const support = opsApi(fakeBackend(w, USERS.support));
  const admin = opsApi(fakeBackend(w, USERS.admin));
  const v = w.venues[0]!;
  v.row.review = 'approved';
  const mark = logMark(v.activity);
  const r = await support.actForOwner({ venueId: VENUE.demo, reason: 'Owner asked by phone', action: 'availability.set',
    payload: { targetKind: 'dish', targetId: ID.espresso, until: { kind: 'indefinite' } } });
  assert.ok(r.ok);
  const mine = await support.activity({ venueId: VENUE.demo, actor: 'staff', limit: 100 });
  const theirs = await admin.activity({ venueId: VENUE.demo, actor: 'staff', limit: 100 });
  assert.ok(mine.ok && theirs.ok);
  if (!mine.ok || !theirs.ok) return;
  const want = actWant({ venueId: VENUE.demo, reason: '', action: 'availability.set', payload: { targetKind: 'dish', targetId: ID.espresso, until: { kind: 'indefinite' } } });
  assert.equal(ownEntry(mine.data, { reason: 'Owner asked by phone', mark }, want), 'yes');
  assert.equal(ownEntry(theirs.data, { reason: 'Owner asked by phone', mark }, want), 'no', 'another staff member reads it as not theirs');
  assert.equal(v.off.filter((o) => o.id === ID.espresso).length, 1, 'the newest answer counts: one override for the espresso');
});

test('the second step (B118): a code is six digits as typed or pasted; the QR is an image address, never markup; failures in plain words', () => {
  assert.equal(codeOf('123 456'), '123456');
  assert.equal(isCode(codeOf('123-456')), true);
  for (const bad of ['12345', '1234567', 'abcdef', '12 34 5', '']) assert.equal(isCode(codeOf(bad)), false, bad);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><path fill="#000" d="M0 0h1v1H0z"/></svg>';
  const src = qrSrc(`data:image/svg+xml;utf-8,${svg}`);
  assert.equal(src, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, 'percent-encoded: a # cannot end the address');
  assert.ok(!src!.includes('<') && !src!.includes('#'));
  assert.equal(qrSrc(svg), src, 'the raw SVG too');
  const gotrue = `<?xml version="1.0"?>\n<!-- Generated by SVGo -->\n${svg}`;
  assert.equal(qrSrc(`data:image/svg+xml;utf-8,${gotrue}`), `data:image/svg+xml;charset=utf-8,${encodeURIComponent(gotrue)}`, 'as GoTrue writes it');
  for (const bad of ['data:text/html,<script>alert(1)</script>', 'javascript:alert(1)', 'https://example.invalid/qr.svg', '<div>x</div>', 42, null, `data:image/svg+xml,<svg>${'x'.repeat(1_000_000)}</svg>`]) {
    assert.equal(qrSrc(bad), null, String(bad).slice(0, 40));
  }
  const f = (why: 'wrong' | 'rate' | 'gone' | 'timeout' | 'other') => ({ ok: false as const, why, message: 'boom' });
  assert.match(mfaWords(f('wrong'), 'code'), /^That code was not accepted\. Codes change every 30 seconds/);
  assert.match(mfaWords(f('wrong'), 'setup'), /only this key works, so if the app has an older entry for this account, delete it/, 'R4-L2');
  assert.equal(mfaWords(f('rate'), 'code'), 'Too many tries. Wait a minute, then enter the newest code.');
  // R4-L3: before any code was asked, no word of a code
  assert.equal(mfaWords(f('timeout'), 'load'), 'The server did not answer in time. Try again.');
  assert.equal(mfaWords(f('rate'), 'load'), 'Too many tries. Wait a minute, then try again.');
  assert.match(mfaWords(f('timeout'), 'setup'), /Try again with the newest code\.$/);
  // R4-L1: a set-up replaced on another tab or device
  assert.match(mfaWords(f('gone'), 'setup'), /^This set-up was replaced: it was started again on another tab or device\./);
  assert.match(mfaWords(f('gone'), 'code'), /was removed\. Set it up again\.$/);
  assert.match(mfaWords(f('other'), 'code'), /: boom$/);
  // R4-L4: the key in groups of four, nothing lost
  assert.deepEqual(keyGroups('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'), ['ABCD', 'EFGH', 'IJKL', 'MNOP', 'QRST', 'UVWX', 'YZ23', '4567']);
  assert.equal(keyGroups('ABCDEF').join(''), 'ABCDEF');
});

test('the plan\'s review says what happens to its end (QA-L2)', () => {
  const now = Date.parse('2026-10-20T10:00:00Z');
  assert.equal(planEnd('trialing', null, now), ': the trial end moves to 19 Nov 2026 (30 days from now, the trial’s length)');
  assert.equal(planEnd('trialing', '2026-12-31T21:59:59.000Z', now), ': the trial end moves to 31 Dec 2026');
  assert.equal(planEnd('active', null, now), ', with no end date (an end set before is cleared)');
  assert.equal(planEnd('active', '2027-01-31T21:59:59.000Z', now), ', until 31 Jan 2027');
  assert.equal(planEnd('suspended', null, now), '');
});
