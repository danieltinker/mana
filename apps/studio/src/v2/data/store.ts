// The v2 app's state: who is signed in, their places, the open place's whole menu (the draft), and saving.
// One place in memory at a time; switching place or account drops everything, and late answers are ignored.
// Every write goes through here so the rows on screen are what the database stored.
//
// Saving (README, "Rules the data layer keeps"):
// - A form sends only the columns its owner changed, and every change of a row is guarded: the row must still be as
//   this screen last read it (`updated_at`, or the position a move started from). When it is not, nothing is written
//   and the owner decides (`conflicts`): keep theirs or take what is stored.
// - The rows' writes go through one queue (data/saves.ts): one write in flight per row; what is typed meanwhile waits
//   as one patch; after a failure or a "changed elsewhere" nothing more goes for that row until a retry or a decision.
//   No write waits for its answer longer than `ANSWER_MS`.
// - An answer that comes late never takes a row on screen back to an older version (`put`, `afterRead`).
// - New rows carry ids made here (`newId`), so a try sent again after a lost answer never stores a second row.
// - An account that may not edit (a counter) never writes: the store refuses before the network does; a refusal by
//   the database on any write path reads the role again.
import { batch, signal } from '@preact/signals';
import type { Session } from '@supabase/supabase-js';
import { addonGroupMenuIssues, validateAddonGroupInput } from '@mana/contracts';
import type { AddonGroupRow, AddonOptionRow, DishAddonGroupRow, DishRelationRow, DishRow, MemberRole, SaveAddonGroupInput, SaveAddonGroupReply, SectionRow } from '@mana/contracts';
import { sb } from './client.ts';
import { toV2Error, V2Error } from './errors.ts';
import type { DishLimits, GroupForm, GroupWrite } from './forms.ts';
import { groupFieldError, groupFromForm, groupToForm } from './forms.ts';
import * as api from './menu.ts';
import type { GroupRows, MenuData, MenuTable, Membership } from './menu.ts';
import { byPosition, newId, nextPosition, reorder, rowsAfterRead, stampOrder, type ReadClock } from './rows.ts';
import { ANSWER_MS, createSaves, TRANSIENT, within, type Conflict as QueueConflict, type Row } from './saves.ts';

export const session = signal<Session | null | undefined>(undefined);      // undefined = still finding out
export const memberships = signal<Membership[] | null>(null);
export const venueId = signal<string | null>(null);
export const menu = signal<MenuData | null>(null);
export const loadState = signal<'idle' | 'loading' | 'error'>('idle');
export const loadError = signal('');
/** 'conflict': a change waits for the owner's decision (`conflicts`); 'failed': a change did not reach the database. */
export const saveState = signal<'idle' | 'saving' | 'saved' | 'failed' | 'conflict'>('idle');
export const saveProblem = signal('');
/** Bumps after every write the database accepted: the draft preview (data/draft.ts) follows it. */
export const edits = signal(0);

let generation = 0;                     // bumps when the place or the account changes: answers for the old one are dropped
const resetHooks: (() => void)[] = [];
/** Later lanes' stores register here to drop their state with the place's (README: extension points). */
export const onReset = (fn: () => void) => { resetHooks.push(fn); };

function dropEverything() {
  generation++;
  clearSaves();
  batch(() => { memberships.value = null; venueId.value = null; menu.value = null; loadState.value = 'idle'; saveState.value = 'idle'; });
  for (const fn of resetHooks) { try { fn(); } catch { /* a hook must not block sign-out */ } }
}

// ---------------------------------------------------------------- account
/**
 * The session ended without the owner signing out (it expired, or was ended elsewhere): the start screen says so, and
 * names the rows whose latest changes did not save (they cannot be sent any more).
 */
export const sessionEnded = signal<{ readonly unsaved: readonly { readonly he: string; readonly en: string }[] } | null>(null);
let signingOut = false;

export async function initAuth() {
  const { data } = await sb.auth.getSession();
  session.value = data.session || null;
  sb.auth.onAuthStateChange((_event, s) => {
    const before = session.value?.user?.id ?? null, after = s?.user?.id ?? null;
    if (before && !after && !signingOut && !sessionEnded.value) sessionEnded.value = { unsaved: unsavedNames() };
    if (after) sessionEnded.value = null;
    if (before !== after) dropEverything();
    session.value = s || null;
    if (after && before !== after) setTimeout(() => { loadMemberships().catch(() => {}); }, 0);
  });
  if (session.value) loadMemberships().catch(() => {});
}

/** Sign out. What is waiting to save is sent first; the screens ask before when something did not save (`hasUnsaved`). */
export async function signOut() {
  signingOut = true;
  try {
    try { await flushSaves(); } catch { /* signing out anyway */ }
    dropEverything();
    try { await sb.auth.signOut({ scope: 'local' }); } catch { /* the local session is gone either way */ }
    session.value = null;
    if (location.hash && location.hash !== '#/') location.hash = '#/';
  } finally { signingOut = false; }
}

/** The database said the session is over (401): what did not save is named on the start screen, then the app signs out. */
function endSession() {
  if (signingOut) return;
  if (!sessionEnded.value) sessionEnded.value = { unsaved: unsavedNames() };
  signOut();
}
type Names = { readonly he: string; readonly en: string };
/** Forms that hold changes not sent yet (a group form, a section sheet), by key: their names are said when the session ends. */
const heldForms = new Map<string, Names>();
/** A form says it holds changes not sent yet (`name`), or no longer does (null). */
export function formHolds(key: string, name: Names | null) {
  if (name) heldForms.set(key, name); else heldForms.delete(key);
}
/** The rows with a change not stored (typed, failed, waiting for a decision, or held in a form), by name. */
function unsavedNames(): Names[] {
  const out: Names[] = [];
  const add = (n: Names) => { if ((n.he || n.en) && !out.some((x) => x.he === n.he && x.en === n.en)) out.push(n); };
  for (const key of saves.typedKeys()) {
    const [table, id] = key.split(':') as [MenuTable, string];
    const r = rowIn(table, id) as { name_he?: string; name_en?: string } | undefined;
    if (r) add({ he: r.name_he ?? '', en: r.name_en ?? '' });
  }
  for (const n of heldForms.values()) add(n);
  return out;
}

const lastKey = () => 'mana-studio-v2-venue:' + (session.value?.user?.id ?? '');
export async function loadMemberships(prefer?: string) {
  const gen = generation;
  loadState.value = 'loading';
  try {
    const list = await api.myVenues(session.value!.user.id);
    if (gen !== generation) return;
    memberships.value = list;
    let want = prefer || null;
    if (!want) { try { want = localStorage.getItem(lastKey()); } catch { /* storage is optional */ } }
    const pick = list.find((m) => m.venue.id === want) || list[0];
    if (pick) await openVenue(pick.venue.id); else loadState.value = 'idle';
  } catch (e) { if (gen === generation) failLoad(e); }
}

/**
 * Open a place. What is waiting to save is sent first; whatever still did not save (a failed save, a change waiting for a
 * decision) belongs to the old place and is dropped with it (the screens ask before: `hasUnsaved`).
 */
export async function openVenue(id: string) {
  await flushSaves().catch(() => {});
  const m = memberships.value?.find((x) => x.venue.id === id);
  if (!m) return;
  const gen = ++generation;
  clearSaves();
  for (const fn of resetHooks) { try { fn(); } catch { /* keep going */ } }
  batch(() => { menu.value = null; venueId.value = id; loadState.value = 'loading'; saveState.value = 'idle'; });
  try { localStorage.setItem(lastKey(), id); } catch { /* storage is optional */ }
  try {
    const data = await api.loadMenu(id, m.role);
    if (gen !== generation) return;
    batch(() => { menu.value = data; loadState.value = 'idle'; });
  } catch (e) { if (gen === generation) failLoad(e); }
}

function failLoad(e: unknown) {
  const err = toV2Error(e);
  if (err.code === 'signed_out') { endSession(); return; }
  batch(() => { loadError.value = err.code; loadState.value = 'error'; });
}

/** The venue row, its plan and its versions again (after a publish, a restore, or Halom's approval). */
export async function refreshVenue() {
  const d = menu.value; if (!d) return;
  const gen = generation;
  const records = canEdit();
  const [venue, revisions, entitlement] = await Promise.all([
    api.venueRow(d.venue.id),
    records ? api.revisionsOf(d.venue.id) : Promise.resolve([]),
    records ? api.entitlementOf(d.venue.id) : Promise.resolve(null),
  ]);
  if (gen !== generation || !menu.value) return;
  menu.value = { ...menu.value, venue, revisions, entitlement };
  if (memberships.value) memberships.value = memberships.value.map((x) => (x.venue.id === venue.id ? { ...x, venue } : x));
}

/**
 * The account's role here, read again after the database refused a write (the role may have changed meanwhile). An
 * account no longer a member of the place keeps seeing what is on screen, read-only. Answers the role, or null
 * (undefined when it could not be read within `ANSWER_MS`; so does every re-read here: none holds a save or sign-out).
 */
async function refreshRole(): Promise<MemberRole | null | undefined> {
  const gen = generation, uid = session.value?.user?.id;
  if (!uid) return undefined;
  try {
    const list = await within(api.myVenues(uid), ANSWER_MS);
    if (gen !== generation) return undefined;
    const m = list.find((x) => x.venue.id === venueId.value);
    const role: MemberRole = m?.role ?? 'counter';                    // gone from the place: nothing is editable any more
    // a place the account was removed from stays on screen, read-only, until the owner moves on (or reloads)
    memberships.value = m || !menu.value ? list : [...list, { venue: menu.value.venue, role }];
    if (menu.value && role !== menu.value.role) menu.value = { ...menu.value, role };
    return m ? m.role : null;
  } catch { return undefined; /* the next load reads it */ }
}

/** Owners and managers edit the menu; a counter sees it read-only (and only marks things sold out, in a later lane). */
export const canEdit = () => menu.value?.role === 'owner' || menu.value?.role === 'manager';
/** A store's write of the menu starts with this: an account that may not edit is refused before the network is asked. */
export const mayWrite = () => { if (!canEdit()) throw new V2Error('forbidden'); };
const editorRole = (r: MemberRole | null | undefined) => r === 'owner' || r === 'manager';

// ---------------------------------------------------------------- the rows in memory
type Rows = { sections: SectionRow; dishes: DishRow; addon_groups: AddonGroupRow; addon_options: AddonOptionRow; dish_addon_groups: DishAddonGroupRow; dish_relations: DishRelationRow };
type AnyRow = { id: string } & Record<string, unknown>;
const KEY: { [T in MenuTable]: 'sections' | 'dishes' | 'groups' | 'options' | 'dishGroups' | 'relations' } = {
  sections: 'sections', dishes: 'dishes', addon_groups: 'groups', addon_options: 'options', dish_addon_groups: 'dishGroups', dish_relations: 'relations',
};
const keyOf = (table: MenuTable, id: string) => table + ':' + id;
const rowIn = (table: MenuTable, id: string): AnyRow | undefined => (menu.value?.[KEY[table]] as AnyRow[] | undefined)?.find((r) => r.id === id);

// What this screen put on screen and when, so an answer that comes late (a slow link) never takes a row back to an older
// state of the database (rows.ts `rowsAfterRead`): `clock` counts each row put on screen or deleted here.
let clock = 0;
const storedAt = new Map<string, number>(), droppedAt = new Map<string, number>();
let menuReads = 0, menuReadShown = 0;                   // whole-menu reads sent, and the latest one on screen
const clockOf = (table: MenuTable, since: number): ReadClock => ({
  since, storedAt: (id) => storedAt.get(keyOf(table, id)) ?? 0, droppedAt: (id) => droppedAt.get(keyOf(table, id)) ?? 0,
});
const withTyped = (table: MenuTable, r: AnyRow): AnyRow => { const typed = saves.typed(keyOf(table, r.id)); return typed ? { ...r, ...typed } : r; };

/**
 * Rows the database returned, on screen (with what is still being typed over them). A row older than the one on screen
 * (an answer that came late) is not put back. `sentAt` is the clock when the write that returned them was sent: a row
 * this screen stored after that is newer than the answer, version or not (a write whose answer came after its wait).
 */
function put<T extends MenuTable>(table: T, rows: Rows[T][], sentAt?: number) {
  const d = menu.value; if (!d || !rows.length) return;
  const k = KEY[table], on = d[k] as AnyRow[];
  const by = new Map<string, AnyRow>();
  for (const r of rows as unknown as AnyRow[]) {
    const mine = on.find((x) => x.id === r.id);
    if (sentAt !== undefined && (storedAt.get(keyOf(table, r.id)) ?? 0) > sentAt) continue;
    if (mine && stampOrder(mine.updated_at as string | undefined, r.updated_at as string | undefined) > 0) continue;
    saves.read(table, r as Row);
    storedAt.set(keyOf(table, r.id), ++clock);
    by.set(r.id, withTyped(table, r));
  }
  if (!by.size) return;
  const list = on.map((r) => by.get(r.id) ?? r);
  for (const r of by.values()) if (!list.some((x) => x.id === r.id)) list.push(r);
  menu.value = { ...d, [k]: list };
}
function drop(table: MenuTable, ids: readonly string[]) {
  const d = menu.value; if (!d) return;
  const k = KEY[table], gone = new Set(ids);
  for (const id of ids) droppedAt.set(keyOf(table, id), ++clock);
  menu.value = { ...d, [k]: (d[k] as { id: string }[]).filter((r) => !gone.has(r.id)) };
}
/**
 * A whole menu read again (sent when `clock` was `since`), on screen: each table as `rowsAfterRead` decides, with what is
 * still being typed over it.
 */
function afterRead(fresh: MenuData, since: number): MenuData {
  const d = menu.value!, out = { ...fresh };
  for (const table of Object.keys(KEY) as MenuTable[]) {
    const k = KEY[table];
    const { rows, taken } = rowsAfterRead(d[k] as AnyRow[], fresh[k] as AnyRow[], clockOf(table, since));
    const took = new Set(taken.map((r) => r.id));
    for (const r of taken) saves.read(table, r as Row);
    (out as Record<string, unknown>)[k] = rows.map((r) => (took.has(r.id) ? withTyped(table, r) : r));
  }
  return out;
}

// ---------------------------------------------------------------- saving
/**
 * The tables a screen may edit field by field (`patchRow`, `saveNow`): every menu table that carries `updated_at`, which
 * guards each write. A later lane's table joins by being added to `MenuTable` (and `KEY`).
 */
export type AutoTable = Exclude<MenuTable, 'dish_addon_groups' | 'dish_relations'>;

/**
 * A change the database did not take because the row changed somewhere else since this screen read it (data/saves.ts).
 * Nothing of it was written; the screen shows the owner's latest values over the stored row until the owner keeps them
 * (sent again over the stored version) or takes the stored ones.
 */
export type Conflict = QueueConflict & { readonly table: AutoTable };
export const conflicts = signal<readonly Conflict[]>([]);
/** A change the database refused: the row is back as stored, the screens say why and show it again. */
export const refused = signal<{ code: string; at: number; table: MenuTable; id: string } | null>(null);
/**
 * A row the screens with a form over it should read again from memory (after a refusal, a conflict, the owner's choice,
 * or the menu read again: then `id` is `ANY_ROW`).
 */
export const resync = signal<{ table: MenuTable; id: string; at: number } | null>(null);
export const ANY_ROW = '*';
const resyncRow = (table: MenuTable, id: string) => { resync.value = { table, id, at: Date.now() }; };
let inflight = 0;                                       // writes outside the rows' queue (new rows, deletions)

const saves = createSaves({ updateIf: (table, id, expected, patch) => api.updateIf<Row>(table as MenuTable, id, expected as api.Expected, patch) }, {
  row: (table, id) => rowIn(table as MenuTable, id) as Row | undefined,
  stored: (table, row) => put(table as MenuTable, [row as never]),
  wrote: () => { edits.value++; },
  refused: (table, id, why) => onRefused(table as MenuTable, id, why),
  resync: (table, id) => resyncRow(table as MenuTable, id),
  changed: () => settle(),
  codeOf: (e) => toV2Error(e).code,
  signedOut: () => endSession(),
});

function settle() {
  conflicts.value = saves.conflicts() as Conflict[];
  const s = saves.status();
  if (s === 'failed') saveProblem.value = saves.problem();
  saveState.value = s === 'failed' ? 'failed' : s === 'conflict' ? 'conflict' : inflight || s === 'saving' ? 'saving' : 'saved';
}

function clearSaves() {
  saves.clear();
  conflicts.value = [];
  storedAt.clear(); droppedAt.clear(); lostGroupSaves.clear(); heldForms.clear();
}

/**
 * The database did not take a change of a row: say why, and show what is true. A permission refusal (or a row this
 * account can no longer read) reads the membership again: the screen turns read-only and says "not allowed", and the
 * row stays on screen. Only a row really deleted by someone who still may edit here is "no longer exists" (the menu is
 * read again). Any other refusal (a value the database does not take) shows the row as stored.
 */
async function onRefused(table: MenuTable, id: string, why: string): Promise<void> {
  const gen = generation;
  let code = why;
  if (why === 'forbidden' || why === 'gone') {
    const role = await refreshRole();
    if (gen !== generation) return;
    if (why === 'gone' && editorRole(role)) { code = 'not_found'; await reloadMenuQuietly(); }
    else { code = 'forbidden'; await reloadOne(table, id, gen); }
  } else await reloadOne(table, id, gen);
  if (gen !== generation) return;
  refused.value = { code, at: Date.now(), table, id };
  resyncRow(table, id);
}

/** The writes to one row, one after another (a failed one does not stop the next): the same lanes as the autosave. */
function onRow<T>(key: string, run: () => Promise<T>): Promise<T> {
  return saves.lane(key, run);
}

/**
 * Run one write for the open place: the rows it returns go on screen, a refusal is thrown as a V2Error. No answer within
 * `ANSWER_MS` is thrown as `timeout` (the write may still land; tried again, the same ids name the same rows).
 */
async function write<T>(run: () => Promise<T>, apply: (out: T) => void): Promise<T> {
  const gen = generation;
  mayWrite();
  inflight++; settle();
  try {
    const out = await within(run(), ANSWER_MS);
    if (gen === generation) { apply(out); edits.value++; }
    return out;
  } catch (e) {
    const err = toV2Error(e);
    if (gen === generation && err.code === 'signed_out') endSession();
    if (gen === generation && err.code === 'forbidden') await refreshRole();
    throw err;
  } finally {
    inflight--;
    if (gen === generation) settle();
  }
}

/**
 * Change a row on screen now and store it shortly after (or at once): only the columns given, and only over the version
 * of the row this screen has (data/saves.ts). What was typed survives a failed save.
 */
export function patchRow<T extends AutoTable>(table: T, id: string, patch: Partial<Rows[T]>, { now = false } = {}) {
  const before = rowIn(table, id);
  if (!before || !canEdit() || !Object.keys(patch).length) return;
  saves.patch(table, id, patch as Record<string, unknown>, now);
  onScreen(table, id, patch);
}

/**
 * A form's changes to one row, saved now and guarded like every change (`patchRow`). When an earlier change of the row
 * failed, it goes with this one (one patch, the latest value of each column). Answers 'saved', or 'conflict' when the row
 * changed elsewhere meanwhile (nothing was written; the conflict dialog asks the owner, and this change joins the
 * question). A failure (it stays for a retry) or a refusal is thrown, in the app's codes.
 */
export async function saveNow<T extends AutoTable>(table: T, id: string, patch: Partial<Rows[T]>): Promise<'saved' | 'conflict'> {
  mayWrite();
  if (!rowIn(table, id)) throw new V2Error('not_found');
  const since = Date.now(), key = keyOf(table, id);
  if (Object.keys(patch).length) onScreen(table, id, patch);
  await saves.now(table, id, patch as Record<string, unknown>);
  if (saves.conflictOf(key)) return 'conflict';
  if (saves.failedOf(key)) throw new V2Error(saves.problem() || 'network');
  const r = refused.value;
  if (r && r.table === table && r.id === id && r.at >= since) throw new V2Error(r.code);
  return 'saved';
}
/** Typed columns shown on a row at once (the queue stores them). */
function onScreen(table: AutoTable, id: string, patch: object) {
  const d = menu.value!, k = KEY[table];
  menu.value = { ...d, [k]: (d[k] as AnyRow[]).map((r) => (r.id === id ? { ...r, ...patch } : r)) };
}

/** The owner's decision on a conflict: keep theirs (stored over the version that is there now) or take the stored one. */
export function resolveConflict(key: string, keep: 'mine' | 'stored') {
  saves.resolve(key, keep);
}

/** One row read again (never dropped from the screen: a row this account cannot read any more stays as it was). */
async function reloadOne(table: MenuTable, id: string, gen: number) {
  try {
    const rows = await within(api.rowsById<Rows[typeof table]>(table, [id]), ANSWER_MS);
    if (gen !== generation) return;
    if (rows.length) put(table, rows);
  } catch { /* offline: the next load corrects it */ }
}

/** Send everything typed now and wait for the answers (a failed save or an open decision stays as it is). */
export const flushSaves = (): Promise<void> => saves.flush();
/** The owner's retry (also when the connection comes back): every failed change goes again, with what was typed since. */
export const retrySaves = (): Promise<void> => saves.retry();
/** Something typed is not stored yet: waiting, on its way, failed, or waiting for the owner's decision. */
export const hasUnsaved = () => inflight > 0 || saves.hasUnsaved();

// ---------------------------------------------------------------- sections and dishes
const vid = () => menu.value!.venue.id;
const sameValue = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * A new row with the screen's own id. When an earlier try of it was stored (its answer was lost) and the owner changed
 * what they typed since, what they typed now goes over it through the row's queue, like any edit (guarded; a refusal
 * reads the role again; changed elsewhere asks): the screen never shows one thing while another is stored.
 */
async function insertTyped<T extends { id: string; updated_at: string }>(table: 'sections' | 'dishes', row: { id: string; [c: string]: unknown }, typed: Record<string, unknown>): Promise<T> {
  const { row: got, existed } = await api.insertOnceInfo<T>(table, row);
  if (!existed) return got;
  const differs = Object.fromEntries(Object.entries(typed).filter(([k, v]) => !sameValue((got as Record<string, unknown>)[k], typeof v === 'string' ? v.trim() : v)));
  if (!Object.keys(differs).length) return got;
  put(table, [got as never]);
  await saves.now(table, got.id, differs);
  return got;                                       // on screen: the version the queue left, or this one with what is typed
}

/** A new section at the end. `id` is made by the screen and kept across its retries (a lost answer never adds two). */
export function addSection(cols: Partial<SectionRow>, id: string = newId()): Promise<SectionRow> {
  const position = nextPosition(menu.value!.sections.filter((x) => x.id !== id));
  return write(() => insertTyped<SectionRow>('sections', { id, venue_id: vid(), position, ...cols }, cols), (r) => put('sections', [r]));
}

/** A new dish at the end of its section, with the screen's own id (as `addSection`). */
export function addDish(sectionId: string, cols: Partial<DishRow>, id: string = newId()): Promise<DishRow> {
  const position = nextPosition(menu.value!.dishes.filter((x) => x.section_id === sectionId && x.id !== id));
  return write(() => insertTyped<DishRow>('dishes', { id, venue_id: vid(), section_id: sectionId, position, ...cols }, cols), (r) => put('dishes', [r]));
}

/** A dish into another section: it goes to the end there (saved at once, guarded like any other change of the dish). */
export function moveDishTo(dishId: string, sectionId: string): Promise<void> {
  const position = nextPosition(menu.value!.dishes.filter((x) => x.section_id === sectionId && x.id !== dishId));
  patchRow('dishes', dishId, { section_id: sectionId, position }, { now: true });
  return saves.drain('dishes', dishId);
}

/** Delete rows; what the database removed with them (a section's dishes, a dish's groups) is reloaded. */
export async function removeRows(table: MenuTable, ids: string[]): Promise<void> {
  await flushSaves();
  await write(() => api.deleteRows(table, ids), () => drop(table, ids));
  if (table === 'sections' || table === 'dishes' || table === 'addon_groups') await reloadMenuQuietly();
}

/**
 * The whole menu read again, quietly. The answer may come late: a read sent before one already on screen is dropped, and
 * no row goes back to an older version than the one on screen (`afterRead`).
 */
async function reloadMenuQuietly() {
  const d = menu.value; if (!d) return;
  const gen = generation, ticket = ++menuReads, since = clock;
  try {
    const fresh = await within(api.loadMenu(d.venue.id, d.role), ANSWER_MS);
    if (gen !== generation || ticket < menuReadShown || !menu.value) return;
    menuReadShown = ticket;
    menu.value = afterRead({ ...fresh, role: menu.value.role }, since);
    resyncRow('dishes', ANY_ROW);                                     // an open dish form shows the dish as it is now
  } catch { /* the rows on screen stay */ }
}

/**
 * Put the row at `from` among `siblings` (in order) at `to`: drag and drop, or the keyboard's up and down. Each row that
 * moves is written only while it is still where this screen saw it; when the order changed elsewhere meanwhile, the
 * order as stored comes back and the promise says `stale` (or `forbidden`, after the role is read again).
 */
export function moveRow(table: MenuTable, siblings: readonly { id: string; position: number }[], from: number, to: number): Promise<void> | null {
  if (!canEdit()) return null;
  const positions = reorder(siblings, from, to);
  if (!positions.size) return null;
  const was = new Map(siblings.map((s) => [s.id, s.position] as const));
  const d = menu.value!, k = KEY[table], gen = generation;
  menu.value = { ...d, [k]: (d[k] as { id: string; position: number }[]).map((r) => (positions.has(r.id) ? { ...r, position: positions.get(r.id)! } : r)) };
  const moves = [...positions].map(([id, position]) => onRow(keyOf(table, id), async () => {
    const sentAt = clock;
    const r = await api.updateIf<AnyRow>(table, id, { position: was.get(id)! }, { position });
    // (an answer after the lane's wait still lands here: `sentAt` keeps it off a row stored since)
    if (r.ok && gen === generation) { put(table, [r.row as never], sentAt); saves.settled(table, id, ['position']); }
    return r;
  }));
  return Promise.all(moves).then(async (results) => {
    if (gen !== generation) return;
    edits.value++;
    const bad = results.find((r) => !r.ok);
    if (bad && !bad.ok) {
      let code = bad.why === 'stale' ? 'stale' : 'forbidden';
      if (bad.why !== 'stale') { const role = await refreshRole(); if (bad.why === 'gone' && editorRole(role)) code = 'not_found'; }
      await reloadMenuQuietly();
      throw new V2Error(code);
    }
  }, async (e) => {
    const err = toV2Error(e);
    if (err.code === 'forbidden') await refreshRole();
    await reloadMenuQuietly();
    throw err;
  });
}

// ---------------------------------------------------------------- add-on groups
export type GroupSave =
  | { readonly ok: true; readonly group: AddonGroupRow }
  /** Saved somewhere else since the form was read: `current` is the group as stored; nothing was written. */
  | { readonly ok: false; readonly code: 'stale'; readonly current: GroupRows }
  /** Deleting these options deletes the suggestion rules named here: ask, then save again with `confirmRules`. */
  | { readonly ok: false; readonly code: 'option_in_rules'; readonly rules: { id: string; name: string }[] };

/**
 * Save a group and its options as one (save_addon_group). `id` is the group's (made by the screen for a new one, and
 * kept across retries); `expected` the group's `updated_at` when the form was read (null for a new group). Refused
 * before any write, as the database would refuse it: the form's rules (`form_invalid`, the field errors in the detail;
 * the contracts' `validateAddonGroupInput`), and against the loaded menu (`addonGroupMenuIssues`) a second nesting level
 * (`nesting_too_deep`) or a dish whose own limits the change breaks (`dish_limits`). Any other refusal changed nothing,
 * and is thrown (a permission refusal reads the role again).
 */
export async function saveGroupForm(id: string, form: GroupForm, expected: string | null, { confirmRules = false } = {}): Promise<GroupSave> {
  mayWrite();
  const d = menu.value!;
  // the form's rules (the contracts' validateAddonGroup, at the form's fields), then the input as the RPC checks it
  const mapped = groupFromForm(form, id);
  if (!mapped.ok) throw new V2Error('form_invalid', mapped.errors);
  const input: SaveAddonGroupInput = { venueId: d.venue.id, group: { id, ...mapped.value.group }, options: mapped.value.options, expectedUpdatedAt: expected, confirmRuleRemoval: confirmRules };
  const valid = validateAddonGroupInput({ venueId: input.venueId, group: input.group, options: input.options });
  if (!valid.ok) throw new V2Error('form_invalid', valid.errors.map((e) => groupFieldError(e, form)));
  // what the RPC would refuse against the stored rows, on the copy this screen has: nesting, and the dishes' own limits
  const found = addonGroupMenuIssues(input.group, input.options, d)[0];
  if (found) throw groupRefusal(found.code, found.path);
  const gen = generation;
  let answer: SaveAddonGroupReply;
  try {
    answer = await onRow(keyOf('addon_groups', id), () => write(() => api.saveAddonGroup(input), () => {}));
  } catch (e) {
    const err = toV2Error(e);
    // the answer was lost (or never came): the group may be stored as sent; a later "saved elsewhere" checks it
    if (gen === generation && TRANSIENT.has(err.code)) lostGroupSaves.set(id, [...(lostGroupSaves.get(id) ?? []), mapped.value]);
    throw err;
  }
  if (gen !== generation) throw new V2Error('aborted');
  if (answer.ok) { lostGroupSaves.delete(id); putGroup(answer); return { ok: true, group: answer.group }; }
  if (answer.code === 'stale') {
    putGroup(answer.current);
    // stored as one of this screen's saves whose answer was lost: not "saved elsewhere"; the form goes over it
    if (ownGroupSave(id, answer.current)) { lostGroupSaves.delete(id); return saveGroupForm(id, form, answer.current.group.updated_at, { confirmRules }); }
    return { ok: false, code: 'stale', current: answer.current };
  }
  if (answer.code === 'option_in_rules') {
    const ids = answer.rules;
    const rows = ids.length ? await api.rulesNamed(ids).catch(() => []) : [];
    const name = (r: (typeof rows)[number]) => r.label || (d.venue.default_lang === 'en' ? r.line_en || r.line_he : r.line_he || r.line_en);
    return { ok: false, code: 'option_in_rules', rules: ids.map((rid) => { const r = rows.find((x) => x.id === rid); return { id: rid, name: r ? name(r) : '' }; }) };
  }
  // refused: nothing changed; the library as stored now (another device may have changed it) is what the editor shows
  const err = groupRefusal(answer.code, answer.path ?? '', answer);
  if (err.code === 'forbidden') await refreshRole();
  await reloadMenuQuietly();
  throw err;
}

/**
 * A group save refused, in the app's codes: a dish whose own limits for this group the change would break is
 * `dish_limits` with the dish's name (`detail.dish`); a form problem is `form_invalid` at its field; the rest as they are.
 */
function groupRefusal(code: string, path: string, answer: unknown = null): V2Error {
  const link = /^dishGroups\.(.+)$/.exec(path);
  if (link) {
    const m = menu.value, dag = m?.dishGroups.find((x) => x.id === link[1]), dish = dag ? m!.dishes.find((x) => x.id === dag.dish_id) : null;
    return new V2Error('dish_limits', { code, dish: dish ? dish.name_he || dish.name_en : '', dishId: dish?.id ?? null });
  }
  if (code === 'not_allowed' && !path.startsWith('options[')) return new V2Error('forbidden', answer);
  if (/^(group|options)/.test(path) && !['nesting_too_deep', 'group_unknown', 'not_allowed'].includes(code)) return new V2Error('form_invalid', [groupFieldError({ code, path })]);
  return new V2Error(code, answer);
}

/** Group saves this screen sent whose answers were lost (per group): what the database may hold because of this screen. */
const lostGroupSaves = new Map<string, GroupWrite[]>();
/** The group as stored is exactly one of this screen's saves whose answer was lost (read as the form reads it). */
function ownGroupSave(id: string, current: GroupRows): boolean {
  const sent = lostGroupSaves.get(id);
  if (!sent?.length) return false;
  const stored = groupFromForm(groupToForm(current.group, current.options), id);
  return stored.ok && sent.some((w) => JSON.stringify(w) === JSON.stringify(stored.value));
}

/** A group and its options as stored, on screen (unless the screen has a later version): options it left out go. */
function putGroup({ group, options }: GroupRows) {
  const m = menu.value; if (!m) return;
  const on = m.groups.find((g) => g.id === group.id);
  if (on && stampOrder(on.updated_at, group.updated_at) > 0) return;
  const kept = new Set(options.map((o) => o.id));
  drop('addon_options', m.options.filter((o) => o.group_id === group.id && !kept.has(o.id)).map((o) => o.id));
  put('addon_groups', [group]);
  put('addon_options', [...options]);
}

/** Groups attached to a dish, in order. */
export const attachedTo = (dishId: string) => byPosition(menu.value!.dishGroups.filter((a) => a.dish_id === dishId));

/** A group onto a dish. Tried again after a lost answer, the link already stored (dish, group) is the one shown. */
export function attachGroup(dishId: string, groupId: string): Promise<DishAddonGroupRow> {
  const position = nextPosition(attachedTo(dishId));
  return write(async () => (await api.insertOnceInfo<DishAddonGroupRow>('dish_addon_groups',
    { id: newId(), venue_id: vid(), dish_id: dishId, group_id: groupId, position }, ['dish_id', 'group_id'])).row,
  (r) => put('dish_addon_groups', [r]));
}

/**
 * A dish's own limits for a group: stored only while they are still what this screen read (else `stale`, and the stored
 * ones come back). Sent again after a lost answer, limits already stored as asked are saved.
 */
export function setDishLimits(dagId: string, limits: DishLimits): Promise<DishAddonGroupRow> {
  const was = rowIn('dish_addon_groups', dagId) as DishAddonGroupRow | undefined;
  if (!was) return Promise.reject(new V2Error('not_found'));
  return onRow(keyOf('dish_addon_groups', dagId), () => write(async () => {
    const sentAt = clock;
    const r = await api.updateIf<DishAddonGroupRow>('dish_addon_groups', dagId, { min_units: was.min_units, max_units: was.max_units }, limits);
    if (r.ok) return r.row;
    if (r.why === 'stale' && r.row.min_units === limits.min_units && r.row.max_units === limits.max_units) return r.row;
    if (r.why === 'stale') { put('dish_addon_groups', [r.row], sentAt); throw new V2Error('stale'); }
    // not readable any more: removed elsewhere (the menu is read again), or this account may no longer edit here
    if (r.why === 'gone' && editorRole(await refreshRole())) { await reloadMenuQuietly(); throw new V2Error('not_found'); }
    throw new V2Error('forbidden');
  }, (r) => put('dish_addon_groups', [r])));
}

// ---------------------------------------------------------------- "goes well with"
export const relatedOf = (dishId: string) => byPosition(menu.value!.relations.filter((r) => r.dish_id === dishId));

/** A dish that goes well with another. Tried again after a lost answer, the pair already stored is the one shown. */
export function addRelated(dishId: string, relatedId: string): Promise<DishRelationRow> {
  const position = nextPosition(relatedOf(dishId));
  return write(async () => (await api.insertOnceInfo<DishRelationRow>('dish_relations',
    { id: newId(), venue_id: vid(), dish_id: dishId, related_dish_id: relatedId, position }, ['dish_id', 'related_dish_id'])).row,
  (r) => put('dish_relations', [r]));
}
