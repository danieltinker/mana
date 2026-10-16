// Placeholder pictures ("illustrations"): the shared library next to the app (config.stockPath: stock.json + match.js),
// loaded at run time, and the switch that decides whether dishes without a photo get one.
import { signal } from '@preact/signals';
import { cfg, sibling } from './api.ts';
import { D, setStockMany, remember, onReset } from './store.ts';

export type StockEntry = { id: string; group: string; name: { he: string; en: string }; thumb: string; hidden?: boolean };
type Lib = { status: 'idle' | 'loading' | 'ready' | 'failed'; manifest: any | null; mod: any | null; base: string };
export const stock = signal<Lib>({ status: 'idle', manifest: null, mod: null, base: '' });

// the picker's sections, in the order the contract gives
export const GROUPS = ['hot-drinks', 'cold-drinks', 'cocktails', 'wine', 'beer', 'breakfast', 'bakery', 'starters', 'salads', 'soups', 'pizza', 'pasta', 'burgers', 'sandwiches', 'meat', 'chicken', 'fish', 'asian', 'sides', 'desserts'];

let loading: Promise<void> | null = null;
export function loadStock(): Promise<void> {
  if (stock.value.status === 'ready') return Promise.resolve();
  if (loading) return loading;
  const base = sibling(cfg!.stockPath || '../stock/');
  stock.value = { ...stock.value, status: 'loading', base };
  loading = (async () => {
    try {
      const [manifest, mod] = await Promise.all([
        fetch(base + 'stock.json', { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error('stock ' + r.status); return r.json(); }),
        import(/* @vite-ignore */ base + 'match.js'),
      ]);
      if (!manifest || !Array.isArray(manifest.items) || typeof mod.matchStock !== 'function') throw new Error('stock shape');
      stock.value = { status: 'ready', manifest, mod, base };
    } catch { stock.value = { status: 'failed', manifest: null, mod: null, base }; }
    finally { loading = null; }
  })();
  return loading;
}

export const stockEntry = (id: string | null | undefined): StockEntry | null => (id && stock.value.manifest ? stock.value.manifest.items.find((e: any) => e && e.id === id) || null : null);
export const stockThumb = (id: string | null | undefined): string | null => { const e = stockEntry(id); return e && e.thumb ? new URL(e.thumb, stock.value.base).href : null; };
export const stockName = (id: string, lang: string) => { const e = stockEntry(id); return e ? e.name[lang as 'he' | 'en'] || e.name.en || e.name.he || id : id; };
/** Every entry an owner may choose (retired ones stay drawn for dishes that use them, but are not offered). */
export const stockVisible = (): StockEntry[] => (stock.value.manifest ? stock.value.manifest.items.filter((e: any) => e && e.id && !e.hidden) : []);
export function searchStock(query: string): StockEntry[] {
  const s = stock.value; if (!s.manifest) return [];
  if (!query.trim()) return stockVisible();
  return (s.mod.searchStock(s.manifest, query, 60) as { id: string }[]).map((r) => stockEntry(r.id)).filter(Boolean) as StockEntry[];
}
export const stockLabels = (): { id: string; label: string }[] => (stock.value.manifest ? stock.value.mod.stockLabels(stock.value.manifest) : []);

/** The picture that fits a dish by its words, or null when the matcher is not sure. */
export function matchFor(item: { name_he?: string; name_en?: string }, cat?: { name_he?: string; name_en?: string } | null): string | null {
  const s = stock.value; if (!s.manifest) return null;
  try { return s.mod.matchStock(s.manifest, { name_he: item.name_he || '', name_en: item.name_en || '', category_he: cat?.name_he || '', category_en: cat?.name_en || '' }) || null; }
  catch { return null; }
}

// ---------------------------------------------------------------- the switch "illustrations for dishes without a photo"
// Remembered on this device per business. Never decided yet = on (the default), unless the menu already carries
// placeholders, which means an earlier visit already filled them in.
export const illus = signal<boolean>(true);
const key = () => 'illus:' + (D.value ? D.value.biz.id : '');
onReset(() => { illus.value = true; });

/** Read the switch for the open business; the first time, fill in what the matcher is sure about. */
export async function initIllus(): Promise<void> {
  const d = D.value; if (!d) return;
  const saved = remember(key());
  if (saved === 'off') { illus.value = false; return; }
  illus.value = true;
  if (saved === 'on') return;
  await loadStock();
  if (stock.value.status !== 'ready' || !D.value || D.value.biz.id !== d.biz.id) return;
  remember(key(), 'on');
  if (!D.value.items.some((i) => i.stock_id)) await fillStock().catch(() => {});
}

/** Give every dish that has no placeholder yet the one the matcher is sure about. Returns how many got one. */
export async function fillStock(): Promise<number> {
  const d = D.value; if (!d || stock.value.status !== 'ready') return 0;
  const cats = new Map(d.categories.map((c) => [c.id, c]));
  const changes: Record<string, string | null> = {};
  for (const it of d.items) { if (it.stock_id) continue; const id = matchFor(it, cats.get(it.category_id)); if (id) changes[it.id] = id; }
  await setStockMany(changes);
  return Object.keys(changes).length;
}

export async function setIllus(on: boolean): Promise<void> {
  const d = D.value; if (!d) return;
  illus.value = on; remember(key(), on ? 'on' : 'off');
  if (on) { await loadStock(); await fillStock(); }
  else await setStockMany(Object.fromEntries(d.items.filter((i) => i.stock_id).map((i) => [i.id, null])));
}

/** For a dish that is being created: its placeholder, when the switch is on. `hint` is what a menu scan proposed. */
export function stockForNew(item: { name_he?: string; name_en?: string }, cat?: { name_he?: string; name_en?: string } | null, hint?: string | null): string | null {
  if (!illus.value || stock.value.status !== 'ready') return null;
  if (hint && stockEntry(hint)) return hint;
  return matchFor(item, cat);
}
