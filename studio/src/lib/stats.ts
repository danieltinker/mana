// The owner's numbers (my_stats, BACKEND.md v2) and the small sums the dashboard draws from them. No chart library.
import { signal } from '@preact/signals';
import { sb, q, toAppError } from './api.ts';
import { D, onReset, currentGeneration } from './store.ts';

export type Stats = {
  today: string; days: { day: string; views: number; en: number; qr: number }[]; hours: number[];
  items: { id: string; name_he: string; name_en: string; opens: number; adds: number }[];
  totals: { views30: number; views7: number; viewsPrev7: number; viewsAll: number; en30: number; qr30: number; opens30: number; adds30: number };
  menu: { live: boolean; firstPublishedAt: string | null; lastPublishedAt: string | null };
  plan: { plan: string; state: string; trialEndsAt: string | null; periodEnd: string | null };
  counts: { categories: number; items: number; withPicture: number; withPlaceholder: number; soldOut: number };
};
export const stats = signal<{ biz: string | null; data: Stats | null; error: string; loading: boolean }>({ biz: null, data: null, error: '', loading: false });
onReset(() => { stats.value = { biz: null, data: null, error: '', loading: false }; });

export async function loadStats(): Promise<void> {
  const d = D.value; if (!d) return;
  const gen = currentGeneration(), id = d.biz.id;
  stats.value = { ...(stats.value.biz === id ? stats.value : { biz: id, data: null, error: '' }), biz: id, loading: true };
  try {
    const data = await q<Stats>(sb.rpc('my_stats', { p_business: id }));
    if (gen === currentGeneration()) stats.value = { biz: id, data, error: '', loading: false };
  } catch (e) { if (gen === currentGeneration()) stats.value = { ...stats.value, error: toAppError(e).code, loading: false }; }
}

export { weekChange, share, sparkPaths, barHeights, peakHours } from './sums.ts';
