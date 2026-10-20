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
// - New rows carry ids made here (`newId`), so a try sent again after a lost answer never stores a second row.
// - An account that may not edit (a counter) never writes: the store refuses before the network does; a refusal by
//   the database on any write path reads the role again.
import { batch, signal } from '@preact/signals';
import type { Session } from '@supabase/supabase-js';
import { addonGroupMenuIssues, validateAddonGroupInput } from '@mana/contracts';
import type {
  AddonGroupRow, AddonOptionRow, DishAddonGroupRow, DishRelationRow, DishRow, MemberRole, SaveAddonGroupInput, ScheduleRow, SectionRow, UpsellRuleRow,
  VenueClosureRow, VenueHoursRow, VenueRow,
} from '@mana/contracts';
import { sb } from './client.ts';
import { toV2Error, V2Error } from './errors.ts';
import type { DishLimits, GroupForm } from './forms.ts';
import { groupFieldError, groupFromForm } from './forms.ts';
import { hhmm } from './hours.ts';
import * as api from './menu.ts';
import type { GroupRows, MenuData, MenuTable, Membership } from './menu.ts';
import { byPosition, newId, nextPosition, reorder } from './rows.ts';
import { createSaves, type Conflict as QueueConflict, type Row } from './saves.ts';

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
export async function initAuth() {
  const { data } = await sb.auth.getSession();
  session.value = data.session || null;
  sb.auth.onAuthStateChange((_event, s) => {
    const before = session.value?.user?.id ?? null, after = s?.user?.id ?? null;
    if (before !== after) dropEverything();
    session.value = s || null;
    if (after && before !== after) setTimeout(() => { loadMemberships().catch(() => {}); }, 0);
  });
  if (session.value) loadMemberships().catch(() => {});
}

/** Sign out. What is waiting to save is sent first; the screens ask before when something did not save (`hasUnsaved`). */
export async function signOut() {
  try { await flushSaves(); } catch { /* signing out anyway */ }
  dropEverything();
  try { await sb.auth.signOut({ scope: 'local' }); } catch { /* the local session is gone either way */ }
  session.value = null;
  if (location.hash && location.hash !== '#/') location.hash = '#/';
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
  if (err.code === 'signed_out') { signOut(); return; }
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
 * account no longer a member of the place keeps seeing what is on screen, read-only. Answers the role, or null.
 */
async function refreshRole(): Promise<MemberRole | null | undefined> {
  const gen = generation, uid = session.value?.user?.id;
  if (!uid) return undefined;
  try {
    const list = await api.myVenues(uid);
    if (gen !== generation) return undefined;
    const m = list.find((x) => x.venue.id === venueId.value);
    const role: MemberRole = m?.role ?? 'counter';                    // gone from the place: nothing is editable any more
    // a place the account was removed from stays on screen, read-only, until the owner moves on (or reloads)
    memberships.value = m || !menu.value ? list : [...list, { venue: menu.value.venue, role }];
    if (menu.value && role !== menu.value.role) menu.value = { ...menu.value, role };
    return m ? m.role : null;
  } catch { return undefined; /* the next load reads it */ }
}

/** Owners and managers edit the menu; a counter sees it read-only and takes things off and back (`canOperate`). */
export const canEdit = () => menu.value?.role === 'owner' || menu.value?.role === 'manager';
/** A store's write of the menu starts with this: an account that may not edit is refused before the network is asked. */
export const mayWrite = () => { if (!canEdit()) throw new V2Error('forbidden'); };
/** Take things off and bring them back (the phone's quick actions, data/live.ts): a counter too. */
export const canOperate = () => canEdit() || menu.value?.role === 'counter';
const editorRole = (r: MemberRole | null | undefined) => r === 'owner' || r === 'manager';

// ---------------------------------------------------------------- the rows in memory
export type Rows = {
  sections: SectionRow; dishes: DishRow; addon_groups: AddonGroupRow; addon_options: AddonOptionRow; dish_addon_groups: DishAddonGroupRow; dish_relations: DishRelationRow;
  schedules: ScheduleRow; upsell_rules: UpsellRuleRow; venue_hours: VenueHoursRow; venue_closures: VenueClosureRow;
};
type AnyRow = { id: string } & Record<string, unknown>;
const KEY: { [T in MenuTable]: 'sections' | 'dishes' | 'groups' | 'options' | 'dishGroups' | 'relations' | 'schedules' | 'rules' | 'hours' | 'closures' } = {
  sections: 'sections', dishes: 'dishes', addon_groups: 'groups', addon_options: 'options', dish_addon_groups: 'dishGroups', dish_relations: 'relations',
  schedules: 'schedules', upsell_rules: 'rules', venue_hours: 'hours', venue_closures: 'closures',
};
const keyOf = (table: MenuTable, id: string) => table + ':' + id;
const rowIn = (table: MenuTable, id: string): AnyRow | undefined => (menu.value?.[KEY[table]] as AnyRow[] | undefined)?.find((r) => r.id === id);

/** Rows the database returned, on screen (with what is still being typed over them). */
function put<T extends MenuTable>(table: T, rows: Rows[T][]) {
  const d = menu.value; if (!d || !rows.length) return;
  const k = KEY[table];
  const by = new Map(rows.map((r) => {
    saves.read(table, r as unknown as Row);
    const typed = saves.typed(keyOf(table, r.id));
    return [r.id, (typed ? { ...r, ...typed } : r) as Rows[T]] as const;
  }));
  const list = (d[k] as Rows[T][]).map((r) => by.get(r.id) ?? r);
  for (const r of by.values()) if (!list.some((x) => x.id === r.id)) list.push(r);
  menu.value = { ...d, [k]: list };
}
function drop(table: MenuTable, ids: readonly string[]) {
  const d = menu.value; if (!d) return;
  const k = KEY[table], gone = new Set(ids);
  menu.value = { ...d, [k]: (d[k] as { id: string }[]).filter((r) => !gone.has(r.id)) };
}
/** A whole menu read again, with what is still being typed over it. */
function withTyped(data: MenuData): MenuData {
  for (const t of Object.keys(KEY) as MenuTable[]) for (const r of data[KEY[t]] as AnyRow[]) saves.read(t, r as Row);   // what this screen last read
  const out = { ...data };
  for (const key of saves.typedKeys()) {
    const [table, id] = key.split(':') as [MenuTable, string];
    const typed = saves.typed(key); if (!typed) continue;
    const k = KEY[table];
    (out as Record<string, unknown>)[k] = (out[k] as AnyRow[]).map((r) => (r.id === id ? { ...r, ...typed } : r));
  }
  return out;
}

// ---------------------------------------------------------------- saving
/**
 * The tables a screen may edit field by field (`patchRow`, `saveNow`): every menu table that carries `updated_at`, which
 * guards each write. A later lane's table joins by being added to `MenuTable` (and `KEY`). An opening window has its own
 * save (`saveHours`, guarded on the `updated_at` its editor read); a closed date is only added or deleted.
 */
export type AutoTable = Exclude<MenuTable, 'dish_addon_groups' | 'dish_relations' | 'venue_hours' | 'venue_closures'>;

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
  signedOut: () => { signOut(); },
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

/** Run one write for the open place: the rows it returns go on screen, a refusal is thrown as a V2Error. */
async function write<T>(run: () => Promise<T>, apply: (out: T) => void): Promise<T> {
  const gen = generation;
  mayWrite();
  inflight++; settle();
  try {
    const out = await run();
    if (gen === generation) { apply(out); edits.value++; }
    return out;
  } catch (e) {
    const err = toV2Error(e);
    if (gen === generation && err.code === 'signed_out') signOut();
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
  const d = menu.value!, k = KEY[table];
  menu.value = { ...d, [k]: (d[k] as AnyRow[]).map((r) => (r.id === id ? { ...r, ...patch } : r)) };
}

/**
 * A form's changes to one row, saved now and guarded like every change (`patchRow`). Answers 'saved', or 'conflict' when
 * the row changed elsewhere meanwhile (nothing was written; the conflict dialog asks the owner). A failure or a refusal
 * is thrown, in the app's codes.
 */
export async function saveNow<T extends AutoTable>(table: T, id: string, patch: Partial<Rows[T]>): Promise<'saved' | 'conflict'> {
  mayWrite();
  if (!rowIn(table, id)) throw new V2Error('not_found');
  const since = Date.now(), key = keyOf(table, id);
  if (Object.keys(patch).length) patchRow(table, id, patch, { now: true });
  await saves.drain(table, id);
  if (saves.conflictOf(key)) return 'conflict';
  if (saves.failedOf(key)) throw new V2Error(saves.problem() || 'network');
  const r = refused.value;
  if (r && r.table === table && r.id === id && r.at >= since) throw new V2Error(r.code);
  return 'saved';
}

/** The owner's decision on a conflict: keep theirs (stored over the version that is there now) or take the stored one. */
export function resolveConflict(key: string, keep: 'mine' | 'stored') {
  saves.resolve(key, keep);
}

/** One row read again (never dropped from the screen: a row this account cannot read any more stays as it was). */
async function reloadOne(table: MenuTable, id: string, gen: number) {
  try {
    const rows = await api.rowsById<Rows[typeof table]>(table, [id]);
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
 * what they typed since, what they typed now goes over it (guarded): the screen never shows one thing while another is
 * stored.
 */
async function insertTyped<T extends { id: string; updated_at: string }>(table: 'sections' | 'dishes', row: { id: string; [c: string]: unknown }, typed: Record<string, unknown>): Promise<T> {
  const { row: got, existed } = await api.insertOnceInfo<T>(table, row);
  if (!existed) return got;
  const differs = Object.fromEntries(Object.entries(typed).filter(([k, v]) => !sameValue((got as Record<string, unknown>)[k], typeof v === 'string' ? v.trim() : v)));
  if (!Object.keys(differs).length) return got;
  const r = await api.updateIf<T>(table, got.id, { updated_at: got.updated_at }, differs);
  return r.ok || r.why === 'stale' ? r.row : got;
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

/**
 * Delete rows; what the database changed with them is reloaded (a section's dishes, a dish's groups, the rules that
 * named them, the sections and dishes a schedule was on).
 */
export async function removeRows(table: MenuTable, ids: string[]): Promise<void> {
  await flushSaves();
  await write(() => api.deleteRows(table, ids), () => drop(table, ids));
  if (table === 'sections' || table === 'dishes' || table === 'addon_groups' || table === 'schedules') await reloadMenuQuietly();
}

/**
 * New rows of one table for the open place, in one statement (several opening windows at once: all of them or none),
 * each with an id made here unless the screen gave one: a try sent again after a lost answer finds them stored. When it
 * finds them stored with other values than this try's, nothing is written: `stored_earlier`, and the stored rows are on
 * screen (the screen says so, or stores the change over them).
 */
export async function addRows<T extends MenuTable>(table: T, rows: Partial<Rows[T]>[]): Promise<Rows[T][]> {
  const venue_id = vid(), gen = generation;
  const list = rows.map((r) => ({ id: newId(), venue_id, ...r }) as { id: string; [column: string]: unknown });
  try {
    return await write(() => api.insertAllOnce<Rows[T]>(table, list), (out) => put(table, out));
  } catch (e) {
    const err = toV2Error(e);
    if (err.code === 'stored_earlier' && gen === generation && Array.isArray(err.detail)) { put(table, err.detail as Rows[T][]); edits.value++; }
    throw err;
  }
}

/**
 * The opening hours and closed dates as stored now (another device may have changed them): read when the hours screen
 * opens, comes back into view, and before hours are added. An open window editor keeps the version it read, so its
 * save is never written over a change made meanwhile (`saveHours`).
 */
export async function refreshHours(): Promise<void> {
  const d = menu.value; if (!d) return;
  const gen = generation;
  const [hours, closures] = await Promise.all([api.venueRows<VenueHoursRow>('venue_hours', d.venue.id), api.venueRows<VenueClosureRow>('venue_closures', d.venue.id)]);
  if (gen !== generation || !menu.value) return;
  menu.value = { ...menu.value, hours, closures };
}

/**
 * An opening window's new times, stored only while the window is still the version its editor read (`expected`, its
 * `updated_at` then): a change made on another device meanwhile is never written over. Then nothing is written, the
 * window as stored is on screen, and `stale` is thrown. Times already stored as asked (this screen's own earlier try,
 * whose answer was lost) are saved.
 */
export function saveHours(id: string, times: Pick<VenueHoursRow, 'opens' | 'closes'>, expected: string): Promise<VenueHoursRow> {
  if (!rowIn('venue_hours', id)) return Promise.reject(new V2Error('not_found'));
  return onRow(keyOf('venue_hours', id), () => write(async () => {
    const r = await api.updateIf<VenueHoursRow>('venue_hours', id, { updated_at: expected }, times);
    if (r.ok) return r.row;
    if (r.why === 'stale' && hhmm(r.row.opens) === hhmm(times.opens) && hhmm(r.row.closes) === hhmm(times.closes)) return r.row;
    if (r.why === 'stale') put('venue_hours', [r.row]); else if (r.why === 'gone') drop('venue_hours', [id]);
    throw new V2Error(r.why === 'stale' ? 'stale' : r.why === 'gone' ? 'not_found' : 'forbidden', r.why === 'stale' ? r.row : null);
  }, (r) => put('venue_hours', [r])));
}

/** The place's own settings (what guests see of something unavailable). */
export function saveVenue(patch: Partial<Pick<VenueRow, 'sold_out_display'>>): Promise<VenueRow> {
  return write(() => api.updateVenue(vid(), patch), (venue) => {
    menu.value = { ...menu.value!, venue };
    if (memberships.value) memberships.value = memberships.value.map((x) => (x.venue.id === venue.id ? { ...x, venue } : x));
  });
}

// The rules' order, one move after another: a move waits for this tab's earlier moves to be answered, then checks the
// whole order as stored against what this tab expects (its earlier moves included). Another tab's reorder means nothing
// is written, the order as stored comes back and the move says `stale`; this tab's moves queued after a refused one are
// dropped (the order on screen is the stored one by then).
let orderChain: Promise<unknown> = Promise.resolve();
let orderEpoch = 0;

/**
 * Rules in a new order: the priorities rules.ts `reprioritize` chose, on screen at once, then stored in turn (above),
 * each only while the rule still has the priority this tab gave it last (as `moveRow` guards positions).
 */
export function setPriorities(priorities: ReadonlyMap<string, number>): Promise<void> | null {
  if (!canEdit() || !priorities.size) return null;
  const d = menu.value!, gen = generation, ep = orderEpoch;
  // the priorities as this tab will have stored them once its earlier moves are answered
  const was = new Map(d.rules.map((r) => [r.id, r.priority] as const));
  menu.value = { ...d, rules: d.rules.map((r) => (priorities.has(r.id) ? { ...r, priority: priorities.get(r.id)! } : r)) };
  const refuse = async (code: string) => { orderEpoch++; await reloadMenuQuietly(); throw new V2Error(code); };
  const run = async (): Promise<void> => {
    if (gen !== generation || ep !== orderEpoch) return;
    const stored = await api.venueRows<{ id: string; priority: number }>('upsell_rules', d.venue.id, 'id,priority');
    if (gen !== generation) return;
    if (stored.length !== was.size || !stored.every((r) => was.get(r.id) === r.priority)) return refuse('stale');
    const results = await Promise.all([...priorities].map(([id, priority]) => onRow(keyOf('upsell_rules', id), async () => {
      const r = await api.updateIf<UpsellRuleRow>('upsell_rules', id, { priority: was.get(id)! }, { priority });
      // already at the new priority: this tab's own earlier try, whose answer was lost
      if (!r.ok && r.why === 'stale' && r.row.priority === priority) return { ok: true as const, row: r.row };
      if (r.ok && gen === generation) put('upsell_rules', [r.row]);
      return r;
    })));
    if (gen !== generation) return;
    edits.value++;
    const bad = results.find((r) => !r.ok);
    if (bad && !bad.ok) {
      if (bad.why !== 'stale') await refreshRole();
      return refuse(bad.why === 'stale' ? 'stale' : bad.why === 'gone' ? 'not_found' : 'forbidden');
    }
  };
  const p = orderChain.then(run, run).catch(async (e) => {
    const err = toV2Error(e);
    if (err.code !== 'stale' && err.code !== 'not_found' && err.code !== 'forbidden' && ep === orderEpoch) { orderEpoch++; await reloadMenuQuietly(); }
    throw err;
  });
  orderChain = p.catch(() => {});
  inflight++; settle();
  p.finally(() => { inflight--; if (gen === generation) settle(); }).catch(() => {});
  return p;
}

async function reloadMenuQuietly() {
  const d = menu.value; if (!d) return;
  const gen = generation;
  try {
    const fresh = await api.loadMenu(d.venue.id, d.role);
    if (gen !== generation) return;
    menu.value = withTyped(fresh);
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
    const r = await api.updateIf<AnyRow>(table, id, { position: was.get(id)! }, { position });
    if (r.ok && gen === generation) { put(table, [r.row as never]); saves.settled(table, id, ['position']); }
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
  const answer = await onRow(keyOf('addon_groups', id), () => write(() => api.saveAddonGroup(input), () => {}));
  if (gen !== generation) throw new V2Error('aborted');
  if (answer.ok) { putGroup(answer); return { ok: true, group: answer.group }; }
  if (answer.code === 'stale') { putGroup(answer.current); return { ok: false, code: 'stale', current: answer.current }; }
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

function putGroup({ group, options }: GroupRows) {
  const m = menu.value; if (!m) return;
  // a suggestion rule whose choice is gone went with it (the owner confirmed it, or another device saved the group)
  const gone = new Set(m.options.filter((o) => o.group_id === group.id && !options.some((x) => x.id === o.id)).map((o) => o.id));
  menu.value = {
    ...m, groups: [...m.groups.filter((g) => g.id !== group.id), group], options: [...m.options.filter((o) => o.group_id !== group.id), ...options],
    rules: m.rules.filter((r) => !(r.suggest_option_id && gone.has(r.suggest_option_id))),
  };
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
    const r = await api.updateIf<DishAddonGroupRow>('dish_addon_groups', dagId, { min_units: was.min_units, max_units: was.max_units }, limits);
    if (r.ok) return r.row;
    if (r.why === 'stale' && r.row.min_units === limits.min_units && r.row.max_units === limits.max_units) return r.row;
    if (r.why === 'stale') put('dish_addon_groups', [r.row]);
    throw new V2Error(r.why === 'stale' ? 'stale' : 'forbidden');
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
