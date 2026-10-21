// The save queue: one lane per row, so the writes to a row go one at a time, each over the version of the row the one
// before left. Pure (no browser, no network): data/store.ts gives it the API and the screen's rows, and
// test/unit/v2-saves.test.mjs drives it with a fake API (slow, failing, lost and stale answers).
//
// The rules it keeps:
// - at most one write in flight per row; what is typed meanwhile waits as one patch (the latest value of each column)
//   and goes when the write before it is answered;
// - an answer "changed elsewhere" (stale) or a failure takes in everything typed after it for that row, and nothing more
//   is sent for that row until the owner decides (keep theirs, or take the stored one) or retries; the decision shows
//   the owner's latest values;
// - a new failure joins the earlier failed patch; a later write that stored a column takes it out of the failed patch;
// - no answer within `answerMs` is a failure like a lost answer (the owner can retry; signing out is not held forever);
// - the owner's own write whose answer was lost is not "changed elsewhere": when every column that moved since this
//   screen read the row holds a value this screen sent (any of them: answers can be lost twice in a row), the row moved
//   because of this screen, and what is still to send goes over it without a question;
// - a read of the row (`read`) never moves what this screen last read back to an older version;
// - a write the database refuses (row-level security, a row this account can no longer read, a value it does not take)
//   is handed to the host, which re-reads and says why; after a permission refusal nothing more is sent for that row.
import { stampOrder } from './rows.ts';

export type Rec = Record<string, unknown>;
export type Row = { readonly id: string; readonly updated_at?: string } & Rec;
export type Answer =
  | { readonly ok: true; readonly row: Row }
  | { readonly ok: false; readonly why: 'stale'; readonly row: Row }
  | { readonly ok: false; readonly why: 'forbidden' | 'gone' };
export type SaveApi = { updateIf(table: string, id: string, expected: Rec, patch: Rec): Promise<Answer> };
export type SaveHost = {
  /** The row as this screen has it (stored, with what is typed over it); its `updated_at` is the version last stored. */
  row(table: string, id: string): Row | undefined;
  /** A row as the database returned it: on screen, with what is still typed over it (`typed`). */
  stored(table: string, row: Row): void;
  /** A change was stored (the draft preview follows). */
  wrote(): void;
  /** The database would not take a change ('forbidden', 'gone', or a refusal's code): re-read, say why. Awaited, up to `answerMs`. */
  refused(table: string, id: string, why: string): Promise<void>;
  /** A form over this row shows it again. */
  resync(table: string, id: string): void;
  /** Something about saving changed (the badge, the conflicts). */
  changed(): void;
  /** A failure in the app's codes ('network', 'signed_out', 'invalid' …). */
  codeOf(e: unknown): string;
  signedOut(): void;
};

/**
 * A change the database did not take because the row changed somewhere else since this screen read it. Nothing of it
 * was written; the screen shows the owner's values over the stored row until the owner decides.
 */
export type Conflict = {
  readonly key: string; readonly table: string; readonly id: string;
  /** The owner's changes, latest values: column → value. */
  readonly mine: Readonly<Rec>;
  /** The row as stored now. */
  readonly stored: Row;
  /** The row as this screen had read it before (null when unknown): what differs from `stored` changed elsewhere. */
  readonly before: Row | null;
  readonly at: number;
};

export type SaveStatus = 'saved' | 'saving' | 'failed' | 'conflict';

/** Failures after which what was sent may or may not be stored: kept for a retry. */
export const TRANSIENT: ReadonlySet<string> = new Set(['network', 'timeout', 'unknown', 'signed_out', 'aborted', 'rate_limited']);
const META: ReadonlySet<string> = new Set(['id', 'venue_id', 'created_at', 'updated_at']);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const empty = (r: Rec | null | undefined) => !r || Object.keys(r).length === 0;
const without = <T>(r: Record<string, T>, cols: Iterable<string>): Record<string, T> => { const out = { ...r }; for (const c of cols) delete out[c]; return out; };

/** How long a write waits for its answer before it counts as failed (the owner can retry; the write may still land). */
export const ANSWER_MS = 15000;
/** No answer in time: what `within` rejects with (`name` 'TimeoutError', the app's code 'timeout'). */
export const timedOut = () => Object.assign(new Error('no answer in time'), { name: 'TimeoutError' });
/** `p`, or a rejection with `timedOut()` after `ms` (`p` itself goes on; its late answer is ignored by the caller). */
export function within<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(timedOut()), ms); });
  return Promise.race([p, late]).finally(() => clearTimeout(timer));
}

type State = {
  readonly key: string; readonly table: string; readonly id: string;
  /** Typed, not sent yet. */
  unsent: Rec;
  /** On its way. */
  inflight: Rec | null;
  /** Did not reach the database, or its answer was lost: kept until a retry. */
  failed: Rec | null;
  conflict: Conflict | null;
  /** Sent, answer lost: every value of each column the database may hold because of this screen. */
  uncertain: Record<string, unknown[]>;
  /** The row as last read from the database. */
  before: Row | null;
  timer: ReturnType<typeof setTimeout> | null;
  /** A send waits in the lane. */
  queued: boolean;
};

export function createSaves(api: SaveApi, host: SaveHost, { debounceMs = 600, answerMs = ANSWER_MS } = {}) {
  const rows = new Map<string, State>();
  const lanes = new Map<string, Promise<void>>();
  let problem = '';
  let epoch = 0;                         // `clear` bumps it: answers for the place or account before are dropped

  const keyOf = (table: string, id: string) => table + ':' + id;
  const stopTimer = (s: State) => { if (s.timer) { clearTimeout(s.timer); s.timer = null; } };
  function stateOf(table: string, id: string): State {
    const key = keyOf(table, id);
    let s = rows.get(key);
    if (!s) {
      s = { key, table, id, unsent: {}, inflight: null, failed: null, conflict: null, uncertain: {}, before: host.row(table, id) ?? null, timer: null, queued: false };
      rows.set(key, s);
    }
    return s;
  }

  /** One write after another on one row (the autosave's sends: each bounds its own wait). */
  function queue<T>(key: string, run: () => Promise<T>): Promise<T> {
    const prev = lanes.get(key) ?? Promise.resolve();
    const next = prev.then(run);
    const tail = next.then(() => {}, () => {});
    lanes.set(key, tail);
    host.changed();
    tail.then(() => { if (lanes.get(key) === tail) lanes.delete(key); host.changed(); });
    return next;
  }
  /**
   * Any other write of a row (a move, a group save, a dish's limits), in the same line as the autosave. With no answer
   * within `answerMs` it rejects with `timedOut()` and the row's next write may go: a write that never answers blocks
   * nothing (not a flush, not signing out).
   */
  const lane = <T>(key: string, run: () => Promise<T>): Promise<T> => queue(key, () => within(run(), answerMs));

  /** Columns typed into a row: saved shortly after (or at once), only over the version of the row this screen has. */
  function patch(table: string, id: string, cols: Rec, immediate = false) {
    if (empty(cols) || !host.row(table, id)) return;
    const s = stateOf(table, id);
    if (s.conflict) s.conflict = { ...s.conflict, mine: { ...s.conflict.mine, ...cols } };     // the decision shows the latest
    else if (s.failed) s.failed = { ...s.failed, ...cols };                                    // waits for the retry
    else {
      Object.assign(s.unsent, cols);
      stopTimer(s);
      s.timer = setTimeout(() => { s.timer = null; pump(s); }, immediate ? 0 : debounceMs);
    }
    host.changed();
  }

  function pump(s: State): void {
    if (s.queued || s.failed || s.conflict || empty(s.unsent)) return;
    stopTimer(s);
    s.queued = true;
    const ep = epoch;
    const again = () => { if (ep === epoch && !s.timer) pump(s); };
    queue(s.key, () => send(s, ep)).then(again, again);
  }

  async function send(s: State, ep: number): Promise<void> {
    s.queued = false;
    if (ep !== epoch || s.failed || s.conflict || empty(s.unsent)) return;
    const stamp = host.row(s.table, s.id)?.updated_at;
    if (!stamp) { s.unsent = {}; return; }
    const sent = s.unsent;
    s.unsent = {}; s.inflight = sent;
    host.changed();
    let r: Answer;
    try {
      r = await within(api.updateIf(s.table, s.id, { updated_at: stamp }, sent), answerMs);
    } catch (e) {
      if (ep !== epoch) return;
      s.inflight = null;
      const code = host.codeOf(e);
      if (TRANSIENT.has(code)) {
        problem = code;
        s.failed = { ...(s.failed ?? {}), ...sent, ...s.unsent };
        s.unsent = {}; stopTimer(s);
        for (const [k, v] of Object.entries(sent)) s.uncertain[k] = [...(s.uncertain[k] ?? []), v];
        host.changed();
        if (code === 'signed_out') host.signedOut();
      } else {
        await refusedBy(s, code);                              // a value the database does not take; later typing still goes
        host.changed();
      }
      return;
    }
    if (ep !== epoch) return;
    s.inflight = null;
    if (r.ok) {
      const cols = Object.keys(sent);
      s.uncertain = {};                       // the row is now the version this write left: nothing earlier is in doubt
      if (s.failed) { s.failed = without(s.failed, cols); if (empty(s.failed)) s.failed = null; }
      host.stored(s.table, r.row);
      host.wrote();
    } else if (r.why === 'stale') stale(s, sent, r.row);
    else {
      // the account may not change it (or can no longer read it): nothing more goes for this row
      stopTimer(s); s.unsent = {}; s.failed = null; s.uncertain = {};
      await refusedBy(s, r.why);
    }
    host.changed();
  }

  /** The host re-reads and says why: waited for, but never longer than `answerMs` (the row's lane must not hang). */
  const refusedBy = (s: State, why: string) => within(host.refused(s.table, s.id, why), answerMs).catch(() => {});

  function stale(s: State, sent: Rec, stored: Row) {
    const mine = { ...sent, ...s.unsent };
    s.unsent = {}; stopTimer(s);
    const before = s.before;
    const moved = before ? Object.keys(stored).filter((k) => !META.has(k) && !same(before[k], stored[k])) : null;
    const own = moved !== null && moved.every((k) => (s.uncertain[k] ?? []).some((v) => same(v, stored[k])));
    s.uncertain = {};
    const rest = Object.fromEntries(Object.entries(mine).filter(([k, v]) => !same(stored[k], v)));
    if (own || empty(rest)) {
      // the row moved because of this screen (an answer lost on the way back), or it already holds what was typed
      host.stored(s.table, stored);
      if (empty(rest)) host.wrote(); else { s.unsent = rest; pump(s); }
      host.resync(s.table, s.id);
      return;
    }
    s.conflict = { key: s.key, table: s.table, id: s.id, mine, stored, before, at: Date.now() };
    host.stored(s.table, stored);                              // the stored version, the owner's values over it
    host.resync(s.table, s.id);
  }

  /** Send everything typed now, and wait until every row's lane is quiet (failed and undecided rows stay as they are). */
  async function flush(): Promise<void> {
    for (let round = 0; round < 50; round++) {
      for (const s of rows.values()) if (s.timer) pump(s);
      const waiting = [...lanes.values()];
      if (!waiting.length) return;
      await Promise.all(waiting);
    }
  }
  /** The same for one row. */
  async function drain(table: string, id: string): Promise<void> {
    const key = keyOf(table, id);
    for (let round = 0; round < 50; round++) {
      const s = rows.get(key);
      if (s?.timer) pump(s);
      const w = lanes.get(key);
      if (!w) return;
      await w;
    }
  }

  /** The owner's retry (or the connection back): every failed patch goes again, with what was typed since. */
  function retry(): Promise<void> {
    for (const s of rows.values()) if (s.failed) { s.unsent = { ...s.failed, ...s.unsent }; s.failed = null; pump(s); }
    host.changed();
    return flush();
  }

  /** The owner's decision on a conflict: keep theirs (sent over the version stored now) or take the stored one. */
  function resolve(key: string, keep: 'mine' | 'stored') {
    const s = rows.get(key);
    const c = s?.conflict;
    if (!s || !c) return;
    s.conflict = null;
    if (keep === 'mine') { s.unsent = { ...c.mine, ...s.unsent }; pump(s); }
    else { s.unsent = {}; host.stored(c.table, c.stored); }
    host.resync(c.table, c.id);
    host.changed();
  }

  /**
   * The owner's "save" on one row: its failed patch (if any), what is typed, and `cols`, sent now; resolves when the row's
   * lane is quiet. A row waiting for the owner's decision sends nothing (`cols` joins the decision).
   */
  async function now(table: string, id: string, cols: Rec): Promise<void> {
    if (!host.row(table, id)) return;
    const s = stateOf(table, id);
    if (s.failed && !s.conflict) { s.unsent = { ...s.failed, ...s.unsent }; s.failed = null; }
    if (!empty(cols)) patch(table, id, cols, true);
    pump(s);
    await drain(table, id);
  }

  /**
   * A row the database returned by another way (a read, a move): what this screen last read of it. A read answered late,
   * older than what this screen already had, changes nothing.
   */
  function read(table: string, row: Row) {
    const s = rows.get(keyOf(table, row.id));
    if (s && !(s.before && stampOrder(s.before.updated_at, row.updated_at) > 0)) s.before = row;
  }
  /** Another write stored these columns of the row (a move's position): they are no longer failed or uncertain. */
  function settled(table: string, id: string, cols: readonly string[]) {
    const s = rows.get(keyOf(table, id));
    if (!s) return;
    s.uncertain = without(s.uncertain, cols);
    if (s.failed) { s.failed = without(s.failed, cols); if (empty(s.failed)) s.failed = null; }
    host.changed();
  }

  /** What this screen typed into a row and the database does not have yet, shown over the stored row. */
  function typed(key: string): Rec | null {
    const s = rows.get(key);
    if (!s) return null;
    const out = { ...(s.failed ?? {}), ...(s.inflight ?? {}), ...s.unsent, ...(s.conflict?.mine ?? {}) };
    return empty(out) ? null : out;
  }

  function status(): SaveStatus {
    let failed = false, conflict = false, saving = lanes.size > 0;
    for (const s of rows.values()) {
      if (s.failed) failed = true;
      if (s.conflict) conflict = true;
      if (s.timer || s.queued || s.inflight || !empty(s.unsent)) saving = true;
    }
    return failed ? 'failed' : conflict ? 'conflict' : saving ? 'saving' : 'saved';
  }

  return {
    patch, now, flush, drain, retry, resolve, read, settled, typed, status, lane, keyOf,
    /** Changes waiting for the owner's decision, oldest first. */
    conflicts: (): Conflict[] => [...rows.values()].flatMap((s) => (s.conflict ? [s.conflict] : [])).sort((a, b) => a.at - b.at),
    conflictOf: (key: string) => rows.get(key)?.conflict ?? null,
    failedOf: (key: string) => rows.get(key)?.failed ?? null,
    /** Rows with something typed and not stored. */
    typedKeys: (): string[] => [...rows.keys()].filter((k) => typed(k) !== null),
    hasUnsaved: () => lanes.size > 0 || [...rows.values()].some((s) => s.timer || s.queued || s.inflight || s.failed || s.conflict || !empty(s.unsent)),
    problem: () => problem,
    /** Forget everything (another place, another account); answers on their way are dropped. */
    clear() {
      epoch++;
      for (const s of rows.values()) stopTimer(s);
      rows.clear(); lanes.clear(); problem = '';
      host.changed();
    },
  };
}
export type Saves = ReturnType<typeof createSaves>;
