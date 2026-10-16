// The v2 app's state: who is signed in, their places, the open place's whole menu (the draft), and saving.
// One place in memory at a time; switching place or account drops everything, and late answers are ignored.
// Every write goes through here so the rows on screen are what the database stored.
import { batch, signal } from '@preact/signals';
import type { Session } from '@supabase/supabase-js';
import type { AddonGroupRow, AddonOptionRow, DishAddonGroupRow, DishRelationRow, DishRow, SectionRow } from '@mana/contracts';
import { sb } from './client.ts';
import { toV2Error, V2Error } from './errors.ts';
import type { DishLimits, GroupForm } from './forms.ts';
import { groupFromForm } from './forms.ts';
import * as api from './menu.ts';
import type { MenuData, MenuTable, Membership } from './menu.ts';
import { nestingProblem } from './nesting.ts';
import { byPosition, nextPosition, reorder } from './rows.ts';

export const session = signal<Session | null | undefined>(undefined);      // undefined = still finding out
export const memberships = signal<Membership[] | null>(null);
export const venueId = signal<string | null>(null);
export const menu = signal<MenuData | null>(null);
export const loadState = signal<'idle' | 'loading' | 'error'>('idle');
export const loadError = signal('');
export const saveState = signal<'idle' | 'saving' | 'saved' | 'failed'>('idle');
export const saveProblem = signal('');
/** Bumps after every write the database accepted: the draft preview (data/draft.ts) follows it. */
export const edits = signal(0);

let generation = 0;                     // bumps when the place or the account changes: answers for the old one are dropped
const resetHooks: (() => void)[] = [];
/** Later lanes' stores register here to drop their state with the place's (README: extension points). */
export const onReset = (fn: () => void) => { resetHooks.push(fn); };

function dropEverything() {
  generation++;
  for (const p of pending.values()) if (p.timer) clearTimeout(p.timer);
  pending.clear(); failed.clear();
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

export async function openVenue(id: string) {
  await flushSaves().catch(() => {});
  const m = memberships.value?.find((x) => x.venue.id === id);
  if (!m) return;
  const gen = ++generation;
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

export const canEdit = () => menu.value?.role === 'owner' || menu.value?.role === 'manager';

// ---------------------------------------------------------------- the rows in memory
type Rows = { sections: SectionRow; dishes: DishRow; addon_groups: AddonGroupRow; addon_options: AddonOptionRow; dish_addon_groups: DishAddonGroupRow; dish_relations: DishRelationRow };
const KEY: { [T in MenuTable]: 'sections' | 'dishes' | 'groups' | 'options' | 'dishGroups' | 'relations' } = {
  sections: 'sections', dishes: 'dishes', addon_groups: 'groups', addon_options: 'options', dish_addon_groups: 'dishGroups', dish_relations: 'relations',
};
function put<T extends MenuTable>(table: T, rows: Rows[T][]) {
  const d = menu.value; if (!d || !rows.length) return;
  const k = KEY[table], by = new Map(rows.map((r) => [r.id, r] as const));
  const list = (d[k] as Rows[T][]).map((r) => by.get(r.id) ?? r);
  for (const r of rows) if (!list.some((x) => x.id === r.id)) list.push(r);
  menu.value = { ...d, [k]: list };
}
function drop(table: MenuTable, ids: readonly string[]) {
  const d = menu.value; if (!d) return;
  const k = KEY[table], gone = new Set(ids);
  menu.value = { ...d, [k]: (d[k] as { id: string }[]).filter((r) => !gone.has(r.id)) };
}

// ---------------------------------------------------------------- writes, and autosave: one row's fields, saved shortly after typing
type Pending = { table: MenuTable; id: string; patch: Record<string, unknown>; timer: ReturnType<typeof setTimeout> | null };
const pending = new Map<string, Pending>();
const failed = new Map<string, Pending>();
const chains = new Map<string, Promise<void>>();
let inflight = 0;
/** An autosave the database refused: the row is back as stored, the screens say why and show it again. */
export const refused = signal<{ code: string; at: number; table: MenuTable; id: string } | null>(null);

function settle() {
  saveState.value = failed.size ? 'failed' : inflight || pending.size || chains.size ? 'saving' : 'saved';
}

/** Run one write for the open place: the rows it returns go on screen, a refusal is thrown as a V2Error. */
async function write<T>(run: () => Promise<T>, apply: (out: T) => void): Promise<T> {
  const gen = generation;
  inflight++; settle();
  try {
    const out = await run();
    if (gen === generation) { apply(out); edits.value++; }
    return out;
  } catch (e) {
    const err = toV2Error(e);
    if (gen === generation && err.code === 'signed_out') signOut();
    throw err;
  } finally {
    inflight--;
    if (gen === generation) settle();
  }
}

/** Change a row on screen now and store it shortly after (or at once). What was typed survives a failed save. */
export function patchRow<T extends MenuTable>(table: T, id: string, patch: Partial<Rows[T]>, { now = false } = {}) {
  const d = menu.value; if (!d) return;
  const k = KEY[table];
  menu.value = { ...d, [k]: (d[k] as Rows[T][]).map((r) => (r.id === id ? { ...r, ...patch } : r)) };
  const key = table + ':' + id;
  const p = pending.get(key) || failed.get(key) || { table, id, patch: {}, timer: null };
  failed.delete(key);
  Object.assign(p.patch, patch);
  if (p.timer) clearTimeout(p.timer);
  pending.set(key, p);
  p.timer = setTimeout(() => { flush(key); }, now ? 0 : 600);
  settle();
}

function flush(key: string): Promise<void> {
  const p = pending.get(key);
  if (!p) return chains.get(key) || Promise.resolve();
  pending.delete(key);
  if (p.timer) clearTimeout(p.timer);
  const gen = generation;
  const run = async () => {
    try {
      const row = await api.updateRow<any>(p.table, p.id, p.patch);
      if (gen !== generation) return;
      if (!pending.has(key)) put(p.table, [row]);
      edits.value++;
    } catch (e) {
      if (gen !== generation) return;
      const err = toV2Error(e);
      saveProblem.value = err.code;
      if (err.code === 'network' || err.code === 'unknown' || err.code === 'signed_out') {
        const newer = pending.get(key);
        if (newer) newer.patch = { ...p.patch, ...newer.patch }; else failed.set(key, p);
        if (err.code === 'signed_out') signOut();
      } else {
        // the database said no: show what is really stored, and say why
        await reloadOne(p.table, p.id, gen);
        if (gen === generation) refused.value = { code: err.code, at: Date.now(), table: p.table, id: p.id };
      }
    }
  };
  const next = (chains.get(key) || Promise.resolve()).then(run).finally(() => { if (chains.get(key) === next) chains.delete(key); if (gen === generation) settle(); });
  chains.set(key, next);
  return next;
}

async function reloadOne(table: MenuTable, id: string, gen: number) {
  try {
    const rows = await api.rowsById<Rows[typeof table]>(table, [id]);
    if (gen !== generation) return;
    if (rows.length) put(table, rows); else drop(table, [id]);
  } catch { /* offline: the next load corrects it */ }
}

export async function flushSaves(): Promise<void> {
  await Promise.all([...pending.keys()].map((k) => flush(k)));
  await Promise.all([...chains.values()]);
}
export async function retrySaves() {
  for (const [key, p] of [...failed]) { failed.delete(key); pending.set(key, p); }
  await flushSaves();
}
export const hasUnsaved = () => pending.size > 0 || failed.size > 0 || chains.size > 0;

// ---------------------------------------------------------------- sections and dishes
const vid = () => menu.value!.venue.id;

export function addSection(cols: Partial<SectionRow>): Promise<SectionRow> {
  const position = nextPosition(menu.value!.sections);
  return write(async () => (await api.insertRows<SectionRow>('sections', [{ venue_id: vid(), position, ...cols }]))[0]!, (r) => put('sections', [r]));
}

export function addDish(sectionId: string, cols: Partial<DishRow>): Promise<DishRow> {
  const position = nextPosition(menu.value!.dishes.filter((x) => x.section_id === sectionId));
  return write(async () => (await api.insertRows<DishRow>('dishes', [{ venue_id: vid(), section_id: sectionId, position, ...cols }]))[0]!, (r) => put('dishes', [r]));
}

/** A dish into another section: it goes to the end there. */
export function moveDishTo(dishId: string, sectionId: string): Promise<DishRow> {
  const position = nextPosition(menu.value!.dishes.filter((x) => x.section_id === sectionId && x.id !== dishId));
  return write(() => api.updateRow<DishRow>('dishes', dishId, { section_id: sectionId, position }), (r) => put('dishes', [r]));
}

/** Delete rows; what the database removed with them (a section's dishes, a dish's groups) is reloaded. */
export async function removeRows(table: MenuTable, ids: string[]): Promise<void> {
  await flushSaves();
  await write(() => api.deleteRows(table, ids), () => drop(table, ids));
  if (table === 'sections' || table === 'dishes' || table === 'addon_groups') await reloadMenuQuietly();
}

async function reloadMenuQuietly() {
  const d = menu.value; if (!d) return;
  const gen = generation;
  try { const fresh = await api.loadMenu(d.venue.id, d.role); if (gen === generation) menu.value = fresh; } catch { /* the rows on screen stay */ }
}

/** Put the row at `from` among `siblings` (in order) at `to`: drag and drop, or the keyboard's up and down. */
export function moveRow(table: MenuTable, siblings: readonly { id: string; position: number }[], from: number, to: number): Promise<void> | null {
  const positions = reorder(siblings, from, to);
  if (!positions.size) return null;
  const d = menu.value!, k = KEY[table];
  menu.value = { ...d, [k]: (d[k] as { id: string; position: number }[]).map((r) => (positions.has(r.id) ? { ...r, position: positions.get(r.id)! } : r)) };
  return write(() => api.setPositions(table, positions), () => {}).catch(async (e) => { await reloadMenuQuietly(); throw e; });
}

// ---------------------------------------------------------------- add-on groups
/**
 * Save a group from its form. Refused before any write when the form is not valid or would make a second nesting
 * level (the database would refuse the same); the codes come back in a V2Error's detail.
 */
export async function saveGroupForm(groupId: string | null, form: GroupForm): Promise<AddonGroupRow> {
  const d = menu.value!;
  const mapped = groupFromForm(form, groupId);
  if (!mapped.ok) throw new V2Error('form_invalid', mapped.errors);
  const nested = nestingProblem(groupId, form.options.map((o) => o.opensGroupId), d.options);
  if (nested) throw new V2Error(nested);
  try {
    const out = await write(() => api.saveGroup(d.venue.id, groupId, mapped.value, d.options), ({ group, options }) => {
      const m = menu.value!;
      menu.value = { ...m, groups: [...m.groups.filter((g) => g.id !== group.id), group], options: [...m.options.filter((o) => o.group_id !== group.id), ...options] };
    });
    return out.group;
  } catch (e) {
    await reloadMenuQuietly();                                      // a refusal halfway: show what is stored
    throw e;
  }
}

/** Groups attached to a dish, in order. */
export const attachedTo = (dishId: string) => byPosition(menu.value!.dishGroups.filter((a) => a.dish_id === dishId));

export function attachGroup(dishId: string, groupId: string): Promise<DishAddonGroupRow> {
  const position = nextPosition(attachedTo(dishId));
  return write(async () => (await api.insertRows<DishAddonGroupRow>('dish_addon_groups', [{ venue_id: vid(), dish_id: dishId, group_id: groupId, position }]))[0]!,
    (r) => put('dish_addon_groups', [r]));
}

export function setDishLimits(dagId: string, limits: DishLimits): Promise<DishAddonGroupRow> {
  return write(() => api.updateRow<DishAddonGroupRow>('dish_addon_groups', dagId, limits), (r) => put('dish_addon_groups', [r]));
}

// ---------------------------------------------------------------- "goes well with"
export const relatedOf = (dishId: string) => byPosition(menu.value!.relations.filter((r) => r.dish_id === dishId));

export function addRelated(dishId: string, relatedId: string): Promise<DishRelationRow> {
  const position = nextPosition(relatedOf(dishId));
  return write(async () => (await api.insertRows<DishRelationRow>('dish_relations', [{ venue_id: vid(), dish_id: dishId, related_dish_id: relatedId, position }]))[0]!,
    (r) => put('dish_relations', [r]));
}
