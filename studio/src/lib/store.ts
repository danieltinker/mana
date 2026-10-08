// App state: who is signed in, which business is open, and that business's rows. One business in memory at a time;
// everything is dropped when the account or the business changes, so nothing from another business can be shown.
import { signal, computed, batch } from '@preact/signals';
import { sb, q, toAppError, AppError } from './api.ts';

export type Biz = any; export type Cat = any; export type Item = any; export type Asset = any;
export type Data = { biz: Biz; menu: any; ent: any; categories: Cat[]; items: Item[]; assets: Asset[]; revisions: any[] };

export const session = signal<any | null | undefined>(undefined);      // undefined = still finding out
export const businesses = signal<Biz[] | null>(null);
export const bizId = signal<string | null>(null);
export const D = signal<Data | null>(null);
export const loadState = signal<'idle' | 'loading' | 'error'>('idle');
export const loadError = signal<string>('');
export const toasts = signal<{ id: number; text: string; kind: 'ok' | 'error' }[]>([]);
/** Bumps whenever something a guest would see changed without going through autosave (a dish added or removed, a picture approved). */
export const draftVersion = signal(0);
export const bumpDraft = () => { draftVersion.value++; };

let generation = 0;            // bumps whenever the open business or the account changes: late answers are dropped
export const currentGeneration = () => generation;

let toastSeq = 0;
export function toast(text: string, kind: 'ok' | 'error' = 'ok') {
  const id = ++toastSeq;
  toasts.value = [...toasts.value.slice(-2), { id, text, kind }];
  setTimeout(() => { toasts.value = toasts.value.filter((x) => x.id !== id); }, kind === 'error' ? 7000 : 3500);
}

const resetHooks: (() => void)[] = [];
export const onReset = (fn: () => void) => { resetHooks.push(fn); };
function dropEverything() {
  generation++;
  for (const p of pending.values()) clearTimeout(p.timer);
  pending.clear(); failed.clear();
  batch(() => { D.value = null; businesses.value = null; bizId.value = null; loadState.value = 'idle'; saveState.value = 'idle'; });
  for (const fn of resetHooks) { try { fn(); } catch { /* a hook must not block sign-out */ } }
}

export async function initAuth() {
  const { data } = await sb.auth.getSession();
  session.value = data.session || null;
  sb.auth.onAuthStateChange((event, s) => {
    const before = session.value && session.value.user ? session.value.user.id : null, after = s && s.user ? s.user.id : null;
    if (before !== after) dropEverything();
    session.value = s || null;
    if (after && before !== after) setTimeout(() => { loadBusinesses().catch(() => {}); }, 0);
  });
  if (session.value) loadBusinesses().catch(() => {});
}

export async function signOut() {
  try { await flushAll(); } catch { /* signing out anyway */ }
  dropEverything();
  try { await sb.auth.signOut({ scope: 'local' }); } catch { /* the local session is gone either way */ }
  session.value = null;
  if (location.hash && location.hash !== '#/') location.hash = '#/';            // the next person to sign in starts at Home, not on the last screen
}

const bizKey = () => 'mana-studio-biz:' + (session.value && session.value.user ? session.value.user.id : '');
export async function loadBusinesses(preferId?: string) {
  const gen = generation;
  loadState.value = 'loading';
  try {
    const rows = await q<Biz[]>(sb.from('businesses').select('*').order('created_at'));
    if (gen !== generation) return;
    businesses.value = rows;
    let want = preferId || null;
    if (!want) { try { want = localStorage.getItem(bizKey()); } catch { /* storage is optional */ } }
    const pick = rows.find((b) => b.id === want) || rows[0] || null;
    if (pick) await openBusiness(pick.id); else { bizId.value = null; D.value = null; loadState.value = 'idle'; }
  } catch (e) {
    if (gen !== generation) return;
    const err = toAppError(e);
    if (err.code === 'signed_out') { await signOut(); return; }
    loadError.value = err.code; loadState.value = 'error';
  }
}

export async function openBusiness(id: string) {
  await flushAll().catch(() => {});
  const gen = ++generation;
  for (const fn of resetHooks) { try { fn(); } catch { /* keep going */ } }
  batch(() => { D.value = null; bizId.value = id; loadState.value = 'loading'; saveState.value = 'idle'; });
  try { localStorage.setItem(bizKey(), id); } catch { /* storage is optional */ }
  try {
    const [biz, menu, ent, categories, items, assets, revisions] = await Promise.all([
      q(sb.from('businesses').select('*').eq('id', id).single()),
      q(sb.from('menus').select('*').eq('business_id', id).single()),
      q(sb.from('entitlements').select('*').eq('business_id', id).single()),
      q(sb.from('categories').select('*').eq('business_id', id).order('position').order('created_at')),
      q(sb.from('items').select('*').eq('business_id', id).order('position').order('created_at')),
      q(sb.from('assets').select('*').eq('business_id', id).order('created_at', { ascending: false }).limit(1000)),
      q(sb.from('menu_revisions').select('id, number, created_at, note').eq('business_id', id).order('number', { ascending: false }).limit(30)),
    ]);
    if (gen !== generation) return;
    batch(() => { D.value = { biz, menu, ent, categories, items, assets, revisions } as Data; loadState.value = 'idle'; });
  } catch (e) {
    if (gen !== generation) return;
    const err = toAppError(e);
    if (err.code === 'signed_out') { await signOut(); return; }
    loadError.value = err.code; loadState.value = 'error';
  }
}

// ---------------------------------------------------------------- local edits + autosave
type Table = 'items' | 'categories' | 'businesses' | 'menus';
type Pending = { table: Table; id: string; patch: any; timer: any };
const pending = new Map<string, Pending>();
const failed = new Map<string, Pending>();
const chains = new Map<string, Promise<void>>();
let inflight = 0;
export const saveState = signal<'idle' | 'dirty' | 'saving' | 'saved' | 'failed'>('idle');
export const saveProblem = signal<string>('');
export const unsavedCount = computed(() => (saveState.value === 'failed' ? failed.size : 0));

function refreshSaveState() {
  if (failed.size) saveState.value = 'failed';
  else if (inflight) saveState.value = 'saving';
  else if (pending.size) saveState.value = 'dirty';
  else if (saveState.value !== 'idle') saveState.value = 'saved';
}

/** Put a patch into the rows in memory (no network). */
export function applyLocal(table: Table | 'assets' | 'ent', id: string, patch: any) {
  const d = D.value; if (!d) return;
  if (table === 'businesses') D.value = { ...d, biz: { ...d.biz, ...patch } };
  else if (table === 'menus') D.value = { ...d, menu: { ...d.menu, ...patch } };
  else if (table === 'ent') D.value = { ...d, ent: { ...d.ent, ...patch } };
  else D.value = { ...d, [table]: (d as any)[table].map((r: any) => (r.id === id ? { ...r, ...patch } : r)) };
  if (table === 'businesses' && businesses.value) businesses.value = businesses.value.map((b) => (b.id === id ? { ...b, ...patch } : b));
}

/** Change a row now on screen and save it shortly after (or at once). Typed text is never thrown away by a failed save. */
export function edit(table: Table, id: string, patch: any, opts: { now?: boolean } = {}) {
  applyLocal(table, id, patch);
  const key = table + ':' + id;
  const p = pending.get(key) || failed.get(key) || { table, id, patch: {}, timer: null };
  failed.delete(key);
  Object.assign(p.patch, patch);
  clearTimeout(p.timer);
  pending.set(key, p);
  p.timer = setTimeout(() => flush(key), opts.now ? 0 : 700);
  refreshSaveState();
}

function flush(key: string): Promise<void> {
  const p = pending.get(key);
  if (!p) return chains.get(key) || Promise.resolve();
  pending.delete(key); clearTimeout(p.timer);
  const gen = generation;
  inflight++; refreshSaveState();
  const run = async () => {
    try {
      await q(sb.from(p.table).update(p.patch).eq('id', p.id).select('id').single());
    } catch (e) {
      if (gen !== generation) return;
      const err = toAppError(e);
      if (err.code === 'network' || err.code === 'unknown' || err.code === 'signed_out') {
        const newer = pending.get(key);                                   // typed again meanwhile: that one carries on
        if (newer) newer.patch = { ...p.patch, ...newer.patch };
        else failed.set(key, { ...p, patch: { ...p.patch, ...(failed.get(key)?.patch || {}) } });
        saveProblem.value = err.code;
      } else {
        // the database said no: show what is really stored, and say why
        saveProblem.value = err.code;
        try {
          const row = await q(sb.from(p.table).select('*').eq('id', p.id).single());
          if (gen === generation && !pending.has(key)) applyLocal(p.table, p.id, row);
        } catch { /* the row may be gone */ }
        refused.value = { code: err.code, at: Date.now() };
      }
    } finally {
      inflight--;
      if (gen === generation) refreshSaveState();
    }
  };
  const next = (chains.get(key) || Promise.resolve()).then(run);
  chains.set(key, next);
  next.finally(() => { if (chains.get(key) === next) chains.delete(key); });
  return next;
}
export const refused = signal<{ code: string; at: number } | null>(null);

export async function flushAll(): Promise<void> {
  await Promise.all([...pending.keys()].map((k) => flush(k)));
  await Promise.all([...chains.values()]);
}
export async function retryFailed(): Promise<void> {
  for (const [key, p] of [...failed.entries()]) { failed.delete(key); pending.set(key, p); }
  refreshSaveState();
  await flushAll();
}
export const hasUnsaved = () => pending.size > 0 || failed.size > 0 || inflight > 0;

// ---------------------------------------------------------------- menu rows
const nextPos = (rows: any[]) => rows.reduce((m, r) => Math.max(m, r.position), -1) + 1;

export async function createCategory(v: { name_he?: string; name_en?: string; kind?: string }): Promise<Cat> {
  const d = D.value!; const gen = generation;
  const row = await q<Cat>(sb.from('categories').insert({ business_id: d.biz.id, name_he: v.name_he || '', name_en: v.name_en || '', kind: v.kind || 'food', position: nextPos(d.categories) }).select().single());
  if (gen === generation && D.value) D.value = { ...D.value, categories: [...D.value.categories, row] };
  return row;
}
export async function deleteCategory(id: string) {
  const gen = generation;
  await q(sb.from('categories').delete().eq('id', id).select('id').single());
  if (gen === generation && D.value) { D.value = { ...D.value, categories: D.value.categories.filter((c) => c.id !== id), items: D.value.items.filter((i) => i.category_id !== id) }; bumpDraft(); }
}
export async function createItem(categoryId: string, v: any): Promise<Item> {
  const d = D.value!; const gen = generation;
  const row = await q<Item>(sb.from('items').insert({ business_id: d.biz.id, category_id: categoryId, position: nextPos(d.items.filter((i) => i.category_id === categoryId)), ...v }).select().single());
  if (gen === generation && D.value) { D.value = { ...D.value, items: [...D.value.items, row] }; bumpDraft(); }
  return row;
}
export async function deleteItem(id: string) {
  const gen = generation;
  await q(sb.from('items').delete().eq('id', id).select('id').single());
  if (gen === generation && D.value) { D.value = { ...D.value, items: D.value.items.filter((i) => i.id !== id), assets: D.value.assets.filter((a) => a.item_id !== id) }; bumpDraft(); }
}

/** Move a row one place up or down among its siblings; the new order is on screen at once and saved through autosave. */
export function move(table: 'categories' | 'items', id: string, dir: -1 | 1) {
  const d = D.value!; const all: any[] = (d as any)[table];
  const me = all.find((r) => r.id === id); if (!me) return false;
  const sibs = sortRows(table === 'items' ? all.filter((r) => r.category_id === me.category_id) : all);
  const i = sibs.findIndex((r) => r.id === id), j = i + dir;
  if (j < 0 || j >= sibs.length) return false;
  [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
  sibs.forEach((r, idx) => { if (r.position !== idx) edit(table, r.id, { position: idx }, { now: true }); });
  return true;
}
export const sortRows = <T extends { position: number; created_at: string }>(rows: T[]) => [...rows].sort((a, b) => a.position - b.position || (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));

/** Put a row at a given place among its siblings (drag and drop); the order is on screen at once and saved through autosave. */
export function moveTo(table: 'categories' | 'items', id: string, index: number) {
  const d = D.value!; const all: any[] = (d as any)[table];
  const me = all.find((r) => r.id === id); if (!me) return false;
  const sibs = sortRows(table === 'items' ? all.filter((r) => r.category_id === me.category_id) : all);
  const from = sibs.findIndex((r) => r.id === id), to = Math.max(0, Math.min(sibs.length - 1, index));
  if (from === to) return false;
  sibs.splice(to, 0, sibs.splice(from, 1)[0]);
  sibs.forEach((r, idx) => { if (r.position !== idx) edit(table, r.id, { position: idx }, { now: true }); });
  return true;
}

export type NewItem = { name_he?: string; name_en?: string; desc_he?: string; desc_en?: string; price_minor: number | null; price_note_he?: string; price_note_en?: string; tags?: string[]; stock_id?: string | null };
export type NewSection = { name_he?: string; name_en?: string; kind: string; existingId?: string; items: NewItem[] };
/** Many dishes at once (a pasted list, a scanned page): one insert per section. Returns how many dishes were added; throws on the first refusal. */
export async function bulkAdd(sections: NewSection[]): Promise<number> {
  const d = D.value!; const gen = generation; const bid = d.biz.id;
  let pos = nextPos(d.categories), added = 0;
  for (const c of sections) {
    if (!c.items.length) continue;
    let cat = c.existingId ? (D.value || d).categories.find((x) => x.id === c.existingId) : null;
    if (!cat) {
      cat = await q<Cat>(sb.from('categories').insert({ business_id: bid, name_he: (c.name_he || '').slice(0, 60), name_en: (c.name_en || '').slice(0, 60), kind: c.kind, position: pos++ }).select().single());
      if (gen === generation && D.value) D.value = { ...D.value, categories: [...D.value.categories, cat] };
    }
    const start = nextPos((D.value || d).items.filter((i) => i.category_id === cat.id));
    const rows = await q<Item[]>(sb.from('items').insert(c.items.map((it, k) => ({
      business_id: bid, category_id: cat.id, position: start + k, name_he: (it.name_he || '').slice(0, 90), name_en: (it.name_en || '').slice(0, 90),
      desc_he: (it.desc_he || '').slice(0, 600), desc_en: (it.desc_en || '').slice(0, 600), price_minor: it.price_minor,
      price_note_he: (it.price_note_he || '').slice(0, 80), price_note_en: (it.price_note_en || '').slice(0, 80), tags: it.tags || [], stock_id: it.stock_id || null,
    }))).select());
    added += rows.length;
    if (gen === generation && D.value) { D.value = { ...D.value, items: [...D.value.items, ...rows] }; bumpDraft(); }
  }
  return added;
}

/** Set (or clear) the placeholder picture of many dishes: one request per picture, not one per dish. */
export async function setStockMany(changes: Record<string, string | null>): Promise<void> {
  const d = D.value; if (!d) return;
  const gen = generation;
  const groups = new Map<string, string[]>();
  for (const [id, stock] of Object.entries(changes)) {
    const row = d.items.find((i) => i.id === id);
    if (!row || (row.stock_id || null) === stock) continue;
    const k = stock === null ? '' : stock;
    groups.set(k, [...(groups.get(k) || []), id]);
  }
  if (!groups.size) return;
  const all = new Map<string, string | null>();
  for (const [k, ids] of groups) for (const id of ids) all.set(id, k === '' ? null : k);
  D.value = { ...d, items: d.items.map((i) => (all.has(i.id) ? { ...i, stock_id: all.get(i.id) } : i)) };
  try {
    for (const [k, ids] of groups) await q(sb.from('items').update({ stock_id: k === '' ? null : k }).in('id', ids).select('id'));
  } catch (e) {
    if (gen === generation && D.value) {                                // show what is really stored
      try { const rows = await q<any[]>(sb.from('items').select('id, stock_id').eq('business_id', d.biz.id)); const m = new Map(rows.map((r) => [r.id, r.stock_id])); D.value = { ...D.value, items: D.value.items.map((i) => (m.has(i.id) ? { ...i, stock_id: m.get(i.id) } : i)) }; } catch { /* offline */ }
    }
    throw toAppError(e);
  } finally { if (gen === generation) bumpDraft(); }
}

// ---------------------------------------------------------------- plan, in plain terms (BACKEND.md: effective state)
export type Plan = { state: 'pending' | 'trialing' | 'active' | 'expired' | 'suspended'; until: Date | null; daysLeft: number | null; plan: string };
export function planOf(ent: any, now = Date.now()): Plan {
  const until = ent.status === 'trialing' ? ent.trial_ends_at : ent.status === 'active' ? ent.current_period_end : null;
  const date = until ? new Date(until) : null;
  let state = ent.status as Plan['state'];
  if ((ent.status === 'trialing' || ent.status === 'active') && date && date.getTime() < now) state = 'expired';
  return { state, until: date, daysLeft: date && state !== 'expired' ? Math.max(0, Math.ceil((date.getTime() - now) / 864e5)) : null, plan: ent.plan };
}

export const textOf = (row: any, field: string, lang: string) => (row ? row[field + '_' + lang] || row[field + '_' + (lang === 'he' ? 'en' : 'he')] || '' : '');

/** Has this menu ever been published? Until then the app is the guided path Menu → Pictures → Publish; after it, three tabs. */
export const everPublished = () => !!(D.value && D.value.menu.first_published_at);

// Small things remembered on this device only (never the business's data): where the owner was on the path, the illustrations switch.
export function remember(key: string, value?: string | null): string | null {
  const k = 'mana-studio-' + key;
  try {
    if (value === undefined) return localStorage.getItem(k);
    if (value === null) localStorage.removeItem(k); else localStorage.setItem(k, value);
    return value;
  } catch { return null; }
}
export { AppError };
