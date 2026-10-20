// The owner app v2's save queue (src/v2/data/saves.ts) against a fake API: slow, failing, lost and stale answers, and
// what the owner types meanwhile. Invented data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaves } from '../../src/v2/data/saves.ts';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = 'dishes', ID = '00000000-0000-4000-8000-000000000001';

/** A database of one table, a screen over it, and the queue between them. `next(...)` says how the next writes behave. */
function setup() {
  const db = new Map();
  let version = 0;
  const stamp = () => `2026-10-16T10:00:00.${String(++version).padStart(6, '0')}+00:00`;
  db.set(ID, { id: ID, price: 900, desc_he: '', name_he: 'פשוט', position: 0, updated_at: stamp() });
  const plan = [], calls = [], log = { refused: [], stored: 0, wrote: 0, resync: 0, signedOut: 0 };
  let inFlight = 0, maxInFlight = 0;
  const api = {
    async updateIf(table, id, expected, patch) {
      const b = plan.shift() ?? {};
      calls.push({ expected: { ...expected }, patch: { ...patch } });
      inFlight++; maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        if (b.delay) await sleep(b.delay);
        if (b.fail) throw new Error('Failed to fetch');
        if (b.refuse) throw Object.assign(new Error('value refused'), { code: b.refuse });
        const row = db.get(id);
        if (!row || b.gone) return { ok: false, why: 'gone' };
        if (b.forbid) return { ok: false, why: 'forbidden' };
        if (!Object.entries(expected).every(([k, v]) => row[k] === v)) return { ok: false, why: 'stale', row: { ...row } };
        const next = { ...row, ...patch, updated_at: stamp() };
        db.set(id, next);
        if (b.lose) throw new Error('Failed to fetch');                  // stored, but the answer never comes back
        return { ok: true, row: { ...next } };
      } finally { inFlight--; }
    },
  };
  const screen = new Map([[ID, { ...db.get(ID) }]]);
  const host = {
    row: (t, id) => screen.get(id),
    stored: (t, row) => { saves.read(t, row); screen.set(row.id, { ...row, ...(saves.typed(t + ':' + row.id) ?? {}) }); log.stored++; },
    wrote: () => { log.wrote++; },
    refused: async (t, id, why) => { log.refused.push(why); const r = db.get(id); if (r) host.stored(t, { ...r }); },
    resync: () => { log.resync++; },
    changed: () => {},
    codeOf: (e) => (e?.code ? e.code : /fetch/i.test(e?.message ?? '') ? 'network' : 'unknown'),
    signedOut: () => { log.signedOut++; },
  };
  const saves = createSaves(api, host, { debounceMs: 20 });
  /** The owner types: on screen at once, saved shortly after (as patchRow does). */
  const type = (cols, now = false) => { saves.patch(T, ID, cols, now); screen.set(ID, { ...screen.get(ID), ...cols }); };
  /** Another device changes the row. */
  const elsewhere = (cols) => db.set(ID, { ...db.get(ID), ...cols, updated_at: stamp() });
  return { db, screen, calls, log, saves, type, elsewhere, next: (...b) => plan.push(...b), maxInFlight: () => maxInFlight, key: T + ':' + ID };
}

test('one write in flight per row; what is typed meanwhile goes next, as one patch with the latest values', async () => {
  const s = setup();
  s.next({ delay: 150 });
  s.type({ price: 1000 });
  await sleep(50);                                       // the first write is on its way (slow)
  s.type({ price: 1100 });
  await sleep(30);
  s.type({ desc_he: 'פריך' });
  assert.equal(s.saves.status(), 'saving');
  await sleep(200);
  await s.saves.flush();
  assert.equal(s.maxInFlight(), 1);
  assert.deepEqual(s.calls.map((c) => c.patch), [{ price: 1000 }, { price: 1100, desc_he: 'פריך' }]);
  assert.notEqual(s.calls[1].expected.updated_at, s.calls[0].expected.updated_at, 'the second goes over the version the first left');
  assert.deepEqual([s.db.get(ID).price, s.db.get(ID).desc_he], [1100, 'פריך']);
  assert.equal(s.saves.status(), 'saved');
  assert.equal(s.saves.hasUnsaved(), false);
});

test('a stale answer takes in what was typed meanwhile: nothing more is sent until the owner decides, who sees the latest values', async () => {
  const s = setup();
  s.elsewhere({ price: 1500 });                          // another device, after this screen read the row
  s.next({ delay: 150 });
  s.type({ price: 1000 });
  await sleep(50);
  s.type({ price: 1100 });                                // typed while the first write is on its way
  await sleep(250);
  await s.saves.flush();
  assert.equal(s.calls.length, 1, 'the second edit was not sent');
  assert.equal(s.db.get(ID).price, 1500, 'nothing written without a decision');
  assert.equal(s.saves.status(), 'conflict');
  const [c] = s.saves.conflicts();
  assert.deepEqual([c.mine.price, c.stored.price, c.before.price], [1100, 1500, 900]);
  s.type({ price: 1200 });                                // still typing while asked
  await sleep(60);
  assert.equal(s.calls.length, 1);
  assert.equal(s.saves.conflicts()[0].mine.price, 1200, 'the question shows the latest value');
  assert.equal(s.screen.get(ID).price, 1200, 'the screen shows the owner\'s value over the stored row');
  s.saves.resolve(s.key, 'stored');
  await s.saves.flush();
  assert.equal(s.calls.length, 1, 'taking the stored one sends nothing');
  assert.equal(s.screen.get(ID).price, 1500, 'and shows what is stored');
  assert.equal(s.saves.status(), 'saved');
});

test('"keep mine" sends the latest values over the version stored now', async () => {
  const s = setup();
  s.elsewhere({ price: 1500, desc_he: 'משם' });
  s.next({ delay: 100 });
  s.type({ price: 1000 });
  await sleep(40);
  s.type({ price: 1100 });
  await sleep(200);
  await s.saves.flush();
  s.saves.resolve(s.key, 'mine');
  await s.saves.flush();
  assert.deepEqual(s.calls.map((c) => c.patch), [{ price: 1000 }, { price: 1100 }]);
  assert.deepEqual([s.db.get(ID).price, s.db.get(ID).desc_he], [1100, 'משם'], 'only what this screen changed, over theirs');
  assert.equal(s.saves.status(), 'saved');
});

test('a third change while the owner decides: "keep mine" is stale again, and the owner is asked again', async () => {
  const s = setup();
  s.elsewhere({ price: 1500 });
  s.type({ price: 1000 }, true);
  await sleep(30); await s.saves.flush();
  assert.equal(s.saves.status(), 'conflict');
  s.elsewhere({ price: 1700 });
  s.saves.resolve(s.key, 'mine');
  await s.saves.flush();
  assert.equal(s.db.get(ID).price, 1700, 'not written over a change the owner never saw');
  assert.equal(s.saves.conflicts()[0].stored.price, 1700);
});

test('two edits of different columns both fail: one failed patch; typing after it waits; the retry sends all of it once, saved only then', async () => {
  const s = setup();
  s.next({ delay: 100, fail: true });
  s.type({ price: 1300 });
  await sleep(40);
  s.type({ desc_he: 'בזמן ניתוק' });                      // typed while the first write is on its way
  await sleep(200);
  await s.saves.flush();
  assert.equal(s.calls.length, 1, 'nothing more was sent after the failure');
  assert.equal(s.saves.status(), 'failed');
  assert.deepEqual(s.saves.failedOf(s.key), { price: 1300, desc_he: 'בזמן ניתוק' });
  s.type({ desc_he: 'בזמן ניתוק, עוד' });                  // still offline: it joins the failed patch
  await sleep(60);
  assert.equal(s.calls.length, 1);
  assert.equal(s.saves.status(), 'failed');
  await s.saves.retry();
  assert.deepEqual(s.calls.map((c) => c.patch), [{ price: 1300 }, { price: 1300, desc_he: 'בזמן ניתוק, עוד' }]);
  assert.deepEqual([s.db.get(ID).price, s.db.get(ID).desc_he], [1300, 'בזמן ניתוק, עוד']);
  assert.equal(s.saves.status(), 'saved');
});

test('the first edit fails while the second (same column) is typed: the retry writes the latest value, never the older one', async () => {
  const s = setup();
  s.next({ delay: 100, fail: true });
  s.type({ price: 1300 });
  await sleep(40);
  s.type({ price: 1400 });
  await sleep(200);
  await s.saves.flush();
  assert.deepEqual(s.saves.failedOf(s.key), { price: 1400 });
  await s.saves.retry();
  assert.deepEqual(s.calls.map((c) => c.patch), [{ price: 1300 }, { price: 1400 }]);
  assert.equal(s.db.get(ID).price, 1400);
});

test('a lost answer is the owner\'s own write: the retry is not "changed elsewhere", and what is still to send goes over it', async () => {
  const s = setup();
  s.next({ lose: true });
  s.type({ price: 1300 }, true);
  await sleep(30); await s.saves.flush();
  assert.equal(s.saves.status(), 'failed');
  assert.equal(s.db.get(ID).price, 1300, 'the write reached the database');
  s.type({ desc_he: 'אחרי תשובה שאבדה' });
  await s.saves.retry();
  assert.deepEqual(s.saves.conflicts(), [], 'no question about the owner\'s own save');
  assert.deepEqual(s.calls.map((c) => c.patch), [{ price: 1300 }, { price: 1300, desc_he: 'אחרי תשובה שאבדה' }, { desc_he: 'אחרי תשובה שאבדה' }]);
  assert.deepEqual([s.db.get(ID).price, s.db.get(ID).desc_he], [1300, 'אחרי תשובה שאבדה']);
  assert.equal(s.saves.status(), 'saved');
});

test('a lost answer, then a change elsewhere to another column and more typing here: the owner is asked', async () => {
  const s = setup();
  s.next({ lose: true });
  s.type({ price: 1300 }, true);
  await sleep(30); await s.saves.flush();
  s.elsewhere({ name_he: 'שם משם' });
  s.type({ desc_he: 'מכאן' });
  await s.saves.retry();
  assert.equal(s.saves.status(), 'conflict');
  assert.deepEqual([s.db.get(ID).name_he, s.db.get(ID).desc_he], ['שם משם', '']);
  assert.deepEqual(s.saves.conflicts()[0].mine, { price: 1300, desc_he: 'מכאן' });
});

test('a lost answer, then a change elsewhere to another column, nothing more typed: the owner\'s value is stored, nothing to ask', async () => {
  const s = setup();
  s.next({ lose: true });
  s.type({ price: 1300 }, true);
  await sleep(30); await s.saves.flush();
  s.elsewhere({ name_he: 'שם משם' });
  await s.saves.retry();
  assert.equal(s.saves.status(), 'saved');
  assert.deepEqual([s.db.get(ID).price, s.db.get(ID).name_he], [1300, 'שם משם']);
});

test('a write that stored a column takes it out of the failed patch', async () => {
  const s = setup();
  s.next({ fail: true });
  s.type({ price: 1300, position: 4 }, true);
  await sleep(30); await s.saves.flush();
  assert.deepEqual(s.saves.failedOf(s.key), { price: 1300, position: 4 });
  s.saves.settled(T, ID, ['position']);                   // a move stored the position meanwhile
  assert.deepEqual(s.saves.failedOf(s.key), { price: 1300 });
  await s.saves.retry();
  assert.deepEqual(s.calls.at(-1).patch, { price: 1300 });
});

test('row-level security says no: the host re-reads and says why; what was typed meanwhile is not sent', async () => {
  const s = setup();
  s.next({ delay: 80, forbid: true });
  s.type({ price: 1300 });
  await sleep(40);
  s.type({ price: 1400 });
  await sleep(150); await s.saves.flush();
  assert.deepEqual(s.log.refused, ['forbidden']);
  assert.equal(s.calls.length, 1);
  assert.equal(s.screen.get(ID).price, 900, 'the screen shows what is stored');
  assert.equal(s.saves.hasUnsaved(), false);
});

test('a row this account cannot read any more is handed to the host as "gone" (the host decides what it means)', async () => {
  const s = setup();
  s.next({ gone: true });
  s.type({ price: 1300 }, true);
  await sleep(30); await s.saves.flush();
  assert.deepEqual(s.log.refused, ['gone']);
});

test('a value the database refuses: the row as stored comes back, and later typing still goes', async () => {
  const s = setup();
  s.next({ refuse: 'invalid' });
  s.type({ price: 1300 }, true);
  await sleep(30); await s.saves.flush();
  assert.deepEqual(s.log.refused, ['invalid']);
  s.type({ price: 1350 }, true);
  await sleep(30); await s.saves.flush();
  assert.equal(s.db.get(ID).price, 1350);
});

test('the same value typed elsewhere: stored already, no question', async () => {
  const s = setup();
  s.elsewhere({ price: 1300 });
  s.type({ price: 1300 }, true);
  await sleep(30); await s.saves.flush();
  assert.deepEqual(s.saves.conflicts(), []);
  assert.equal(s.saves.status(), 'saved');
});

test('drain waits for one row; clear drops the answers on their way', async () => {
  const s = setup();
  s.next({ delay: 80 });
  s.type({ price: 1300 }, true);
  await s.saves.drain(T, ID);
  assert.equal(s.db.get(ID).price, 1300);
  s.next({ delay: 80 });
  s.type({ price: 1400 }, true);
  await sleep(30);
  const stored = s.log.stored;
  s.saves.clear();
  await sleep(120);
  assert.equal(s.log.stored, stored, 'an answer for the place before is dropped');
  assert.equal(s.saves.hasUnsaved(), false);
});
