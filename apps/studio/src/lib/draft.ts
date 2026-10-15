// What guests would see if the owner published now (the draft), next to what they see today (the published version).
// One copy for the whole app: the live preview, the "Update" button and the "what changed" line all read it.
import { signal, computed, effect } from '@preact/signals';
import { sb, q, toAppError } from './api.ts';
import { D, saveState, draftVersion, onReset, currentGeneration } from './store.ts';

export const draft = signal<{ snap: any | null; error: string; n: number }>({ snap: null, error: '', n: 0 });
export const published = signal<{ id: string | null; snap: any | null }>({ id: null, snap: null });
onReset(() => { draft.value = { snap: null, error: '', n: 0 }; published.value = { id: null, snap: null }; clearTimeout(timer); });

import { diffSnapshots, type Diff } from './sums.ts';
export { diffSnapshots, type Diff };
/** null while we do not know yet (still loading, or nothing is published). */
export const diff = computed<Diff | null>(() => (published.value.snap && draft.value.snap && D.value && published.value.id === D.value.menu.published_revision_id ? diffSnapshots(published.value.snap, draft.value.snap) : null));
export const hasChanges = computed(() => { const d = diff.value; return !!d && !!(d.added || d.removed || d.changed || d.look || d.order); });

let timer: any = null, seq = 0;
export function refreshDraft(delay = 250): void {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const d = D.value; if (!d) return;
    const mine = ++seq, gen = currentGeneration();
    try {
      const want = d.menu.published_revision_id || null;
      const [snap, pub] = await Promise.all([
        q<any>(sb.rpc('preview_snapshot', { p_business: d.biz.id })),
        want && published.value.id !== want ? q<any>(sb.from('menu_revisions').select('snapshot').eq('id', want).single()) : Promise.resolve(null),
      ]);
      if (mine !== seq || gen !== currentGeneration()) return;
      if (!want) published.value = { id: null, snap: null }; else if (pub) published.value = { id: want, snap: pub.snapshot };
      draft.value = { snap, error: '', n: draft.value.n + 1 };
    } catch (e) { if (mine === seq && gen === currentGeneration()) draft.value = { ...draft.value, error: toAppError(e).code }; }
  }, delay);
}

// follow the owner's work: a business was opened, an edit was saved, a dish was added or removed, a version went live
let lastKey = '', prevSave = 'idle', savedCount = 0;
effect(() => {
  const d = D.value, s = saveState.value, v = draftVersion.value;
  if (s === 'saved' && prevSave !== 'saved') savedCount++;
  prevSave = s;
  if (!d) { lastKey = ''; return; }
  if (s !== 'saved' && s !== 'idle') return;                      // while typing: wait for the save
  const key = d.biz.id + '|' + (d.menu.published_revision_id || '') + '|' + v + '|' + savedCount;
  if (key === lastKey) return;
  lastKey = key;
  refreshDraft();
});
