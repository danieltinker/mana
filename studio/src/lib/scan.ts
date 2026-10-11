// The menu scanner's working table: pages are read one after another, their sections and dishes land here as they
// arrive, the owner corrects them, and only "Add" writes anything to the menu.
import { signal } from '@preact/signals';
import { AppError, toAppError } from './api.ts';
import { D, bulkAdd, onReset, type NewSection } from './store.ts';
import { scanPage, logAi, type ScanEvent } from './ai.ts';
import { loadStock, stockLabels, stockForNew, stock, illus } from './stock.ts';
import { formatMinor, parsePrice } from './money.ts';
import { norm } from './sums.ts';

export type Row = { key: number; he: string; en: string; dhe: string; den: string; price: string; note_he: string; note_en: string; tags: string[]; stock: string | null; hinted: boolean; removed: boolean };
export type Sec = { key: number; he: string; en: string; kind: string; rows: Row[] };
export type Scan = {
  status: 'reading' | 'review' | 'error' | 'adding';
  pages: number; page: number;                    // how many pictures were chosen, which one is being read (1-based)
  sections: Sec[]; lang: '' | 'he' | 'en' | 'other';
  truncated: boolean; cut: boolean;               // the page was too long / the connection dropped: what arrived is kept
  error: string;                                   // a code from ai.ts SCAN_CODES when a page could not be read
  errorPage: number; skipDup: boolean; addError: string;
};
export const scan = signal<Scan | null>(null);
let ctl: AbortController | null = null, keys = 0, files: Blob[] = [];
onReset(() => { ctl?.abort(); scan.value = null; files = []; });

const set = (p: Partial<Scan>) => { if (scan.value) scan.value = { ...scan.value, ...p }; };
export { norm };
const sameName = (a: { he: string; en: string }, b: { he: string; en: string }) => (!!norm(a.he) && norm(a.he) === norm(b.he)) || (!!norm(a.en) && norm(a.en) === norm(b.en));
export const countRows = (s: Scan) => s.sections.reduce((n, c) => n + c.rows.filter((r) => !r.removed).length, 0);

/** The category already on the menu that a scanned section belongs to (same name in either language), if any. */
export function existingCategory(sec: { he: string; en: string }) {
  const d = D.value; if (!d) return null;
  return d.categories.find((c) => sameName({ he: c.name_he, en: c.name_en }, sec)) || null;
}
/** Is this row already on the menu, in the section it would join, under the same name and price? Or twice in this scan? */
export function isDuplicate(s: Scan, sec: Sec, row: Row): boolean {
  const d = D.value; if (!d) return false;
  const price = parsePrice(row.price), p = price === 'invalid' ? null : price;
  const cat = existingCategory(sec);
  if (cat && d.items.some((i) => i.category_id === cat.id && sameName({ he: i.name_he, en: i.name_en }, row) && (i.price_minor ?? null) === p)) return true;
  for (const r of sec.rows) { if (r === row) break; if (!r.removed && sameName(r, row) && r.price === row.price) return true; }
  return false;
}
export const duplicates = (s: Scan) => s.sections.reduce((n, c) => n + c.rows.filter((r) => !r.removed && isDuplicate(s, c, r)).length, 0);
/** What "Add" will write: rows that were not removed, without the repeats when those are skipped. */
export const toAdd = (s: Scan) => s.sections.reduce((n, c) => n + c.rows.filter((r) => !r.removed && !(s.skipDup && isDuplicate(s, c, r))).length, 0);

export function startScan(chosen: Blob[]) {
  ctl?.abort();
  files = chosen.slice(0, 8);
  scan.value = { status: 'reading', pages: files.length, page: 1, sections: [], lang: '', truncated: false, cut: false, error: '', errorPage: 0, skipDup: true, addError: '' };
  void run(0);
}
/** Read the pages from `from` on, one after another. A page that fails stops the run; what earlier pages gave is kept. */
async function run(from: number) {
  const d = D.value; if (!d) return;
  ctl = new AbortController();
  const mine = ctl;
  await loadStock().catch(() => {});
  const langs = (d.biz.langs || ['he', 'en']).filter((l: string) => l === 'he' || l === 'en');
  for (let p = from; p < files.length; p++) {
    if (mine.signal.aborted || !scan.value) return;
    set({ status: 'reading', page: p + 1, error: '' });
    let cur: Sec | null = null;
    const onEvent = (e: ScanEvent) => {
      const s = scan.value; if (!s || mine.signal.aborted) return;
      if (e.t === 'lang') { if (!s.lang) set({ lang: e.v }); return; }
      if (e.t === 'cat') {
        const found = s.sections.find((c) => sameName(c, e));                 // a second page continuing a section of the first
        if (found) { cur = found; return; }
        cur = { key: ++keys, he: e.he, en: e.en, kind: e.kind, rows: [] };
        set({ sections: [...s.sections, cur] });
        return;
      }
      if (e.t === 'item') {
        if (!cur) { cur = { key: ++keys, he: 'תפריט', en: 'Menu', kind: 'food', rows: [] }; scan.value = { ...s, sections: [...s.sections, cur] }; }
        const hint = e.stock && stock.value.status === 'ready' ? e.stock : null;
        const row: Row = { key: ++keys, he: e.he, en: e.en, dhe: e.dhe || '', den: e.den || '', price: formatMinor(e.price_minor), note_he: e.note_he || '', note_en: e.note_en || '', tags: e.tags || [],
          stock: stockForNew({ name_he: e.he, name_en: e.en }, { name_he: cur.he, name_en: cur.en }, hint), hinted: !!hint, removed: false };
        const target = cur;
        scan.value = { ...scan.value!, sections: scan.value!.sections.map((c) => (c.key === target.key ? (cur = { ...c, rows: [...c.rows, row] }) : c)) };
      }
    };
    try {
      const end = await scanPage(files[p], { businessId: d.biz.id, langs, stock: illus.value ? stockLabels() : [], signal: mine.signal, onEvent });
      if (mine.signal.aborted) return;
      if (end.truncated) set({ truncated: true, cut: scan.value!.cut || end.cut });
    } catch (e) {
      if (mine.signal.aborted) return;
      const err = e instanceof AppError ? e : toAppError(e);
      if (err.code === 'aborted') return;
      // the screen shows one sentence; the console keeps what really happened (which page, which file, the real error)
      const f = files[p] as File;
      logAi(`page ${p + 1} of ${files.length} was not read`, { code: err.code, message: err.message, file: f?.name || '', type: f?.type || '', bytes: f?.size || 0, error: e instanceof AppError ? undefined : `${(e as any)?.name || ''}: ${(e as any)?.message || e}`, stack: e instanceof AppError ? undefined : String((e as any)?.stack || '').slice(0, 600) });
      set({ status: countRows(scan.value!) ? 'review' : 'error', error: err.code === 'unknown' ? 'failed' : err.code, errorPage: p + 1 });
      return;
    }
  }
  if (scan.value && !mine.signal.aborted) set({ status: countRows(scan.value) ? 'review' : 'error', error: countRows(scan.value) ? '' : 'empty' });
}
/** "Try again": read the page that failed (and the ones after it) once more. */
export function retryScan() { const s = scan.value; if (!s || !files.length) return; void run(Math.max(0, (s.errorPage || 1) - 1)); }
export function cancelScan() { ctl?.abort(); scan.value = null; files = []; }

// ---------------------------------------------------------------- corrections before adding
const mapRow = (secKey: number, rowKey: number, fn: (r: Row, c: Sec) => Row) => { const s = scan.value; if (!s) return; scan.value = { ...s, sections: s.sections.map((c) => (c.key === secKey ? { ...c, rows: c.rows.map((r) => (r.key === rowKey ? fn(r, c) : r)) } : c)) }; };
export function editRow(secKey: number, rowKey: number, patch: Partial<Row>) {
  mapRow(secKey, rowKey, (r, c) => {
    const next = { ...r, ...patch };
    // a corrected name may deserve another illustration, unless the scan itself chose this one
    if (('he' in patch || 'en' in patch) && !r.hinted) next.stock = stockForNew({ name_he: next.he, name_en: next.en }, { name_he: c.he, name_en: c.en });
    return next;
  });
}
export function editSection(secKey: number, patch: Partial<Sec>) { const s = scan.value; if (!s) return; scan.value = { ...s, sections: s.sections.map((c) => (c.key === secKey ? { ...c, ...patch } : c)) }; }
export const setSkipDup = (v: boolean) => set({ skipDup: v });

/** Write the reviewed rows to the menu. Returns how many dishes were added. */
export async function addScanned(): Promise<number> {
  const s = scan.value; const d = D.value; if (!s || !d) return 0;
  const langs: string[] = d.biz.langs || ['he', 'en'];
  const keep = (he: string, en: string) => ({ he: langs.includes('he') ? he.trim() : '', en: langs.includes('en') ? en.trim() : '' });
  const sections: NewSection[] = [];
  for (const c of s.sections) {
    const items = c.rows.filter((r) => !r.removed && !(s.skipDup && isDuplicate(s, c, r)) && (r.he.trim() || r.en.trim())).map((r) => {
      const n = keep(r.he, r.en), ds = keep(r.dhe, r.den), nt = keep(r.note_he, r.note_en), price = parsePrice(r.price);
      const name = n.he || n.en ? n : { he: r.he.trim(), en: r.en.trim() };                 // never lose a dish because its only name is in the other language
      return { name_he: name.he, name_en: name.en, desc_he: ds.he, desc_en: ds.en, price_minor: price === 'invalid' ? null : price, price_note_he: nt.he, price_note_en: nt.en,
        tags: r.tags.filter((t) => ['vegan', 'vegetarian', 'spicy', 'gf'].includes(t)), stock_id: illus.value ? r.stock : null };
    });
    if (!items.length) continue;
    const cat = existingCategory(c);
    const cn = keep(c.he, c.en), cname = cn.he || cn.en ? cn : { he: c.he.trim(), en: c.en.trim() };
    sections.push({ name_he: cname.he, name_en: cname.en, kind: c.kind, existingId: cat?.id, items });
  }
  set({ status: 'adding', addError: '' });
  const before = d.items.length;
  try {
    const n = await bulkAdd(sections);
    scan.value = null; files = [];
    return n;
  } catch (e) {
    const done = (D.value ? D.value.items.length : before) - before;
    set({ status: 'review', addError: toAppError(e).code + (done > 0 ? ':' + done : '') });
    throw e;
  }
}
