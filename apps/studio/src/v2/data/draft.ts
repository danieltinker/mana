// The draft as guests would get it if the owner published now (preview_menu), beside what they get today (the published
// revision): what would stop a publish, what would only warn, and what would change. One copy for the whole app; it
// follows every write the database accepted.
import { computed, effect, signal } from '@preact/signals';
import { lintSnapshotV2, validateSnapshotV2, type Issue, type PublishWarning, type SnapshotV2 } from '@mana/contracts';
import { anyChange, menuChanges, type MenuChanges } from './changes.ts';
import { toV2Error } from './errors.ts';
import * as api from './menu.ts';
import { canEdit, edits, menu, onReset, saveState } from './store.ts';

export type Notice = { readonly code: string; readonly path: string; readonly id?: string; readonly reason?: string; readonly label?: string };
export type Draft = {
  readonly snapshot: SnapshotV2 | null;
  /** What stops a publish: the database's validator and the contracts' (they use the same codes and paths). */
  readonly issues: readonly Notice[];
  /** What publishes but needs the owner's eye: the database's warnings and lintSnapshotV2's. */
  readonly warnings: readonly Notice[];
  /** Against the published revision; null when nothing is published. */
  readonly changes: MenuChanges | null;
  readonly loading: boolean;
  readonly error: string;
};
const EMPTY: Draft = { snapshot: null, issues: [], warnings: [], changes: null, loading: false, error: '' };
export const draft = signal<Draft>(EMPTY);
export const hasChanges = computed(() => (draft.value.changes ? anyChange(draft.value.changes) : false));

let published: { id: string | null; snapshot: SnapshotV2 | null } = { id: null, snapshot: null };
let timer: ReturnType<typeof setTimeout> | null = null, seq = 0;
onReset(() => { draft.value = EMPTY; published = { id: null, snapshot: null }; if (timer) clearTimeout(timer); });

const union = (a: readonly (Issue | PublishWarning)[], b: readonly (Issue | PublishWarning)[]): Notice[] => {
  const seen = new Set<string>(), out: Notice[] = [];
  for (const x of [...a, ...b]) { const k = x.code + '|' + x.path + '|' + ((x as PublishWarning).id ?? ''); if (!seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
};

/** Ask again (now, or after `delay` ms when several edits arrive together). */
export function refreshDraft(delay = 0): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    const d = menu.value;
    if (!d || !canEdit()) return;
    const mine = ++seq, venue = d.venue.id, want = d.venue.published_revision_id;
    draft.value = { ...draft.value, loading: true };
    try {
      const [p, pub] = await Promise.all([
        api.previewMenu(venue),
        want && published.id !== want ? api.revisionSnapshot(want) : Promise.resolve(want ? published.snapshot : null),
      ]);
      if (mine !== seq || menu.value?.venue.id !== venue) return;
      published = { id: want, snapshot: pub };
      const local = validateSnapshotV2(p.snapshot);
      draft.value = {
        snapshot: p.snapshot,
        issues: union(p.issues, local.ok ? [] : local.errors),
        warnings: union(p.warnings, local.ok ? lintSnapshotV2(local.value) : []),
        changes: pub ? menuChanges(pub, p.snapshot) : null,
        loading: false, error: '',
      };
    } catch (e) {
      if (mine === seq) draft.value = { ...draft.value, loading: false, error: toV2Error(e).code };
    }
  }, delay);
}

// follow the owner's work: a place was opened, a write went through, a version went live
let lastKey = '';
effect(() => {
  const d = menu.value, n = edits.value, s = saveState.value;
  if (!d) { lastKey = ''; return; }
  if (s === 'saving') return;                                     // while typing: wait for the save
  const key = d.venue.id + '|' + (d.venue.published_revision_id ?? '') + '|' + n;
  if (key === lastKey) return;
  const first = !lastKey.startsWith(d.venue.id + '|');
  lastKey = key;
  refreshDraft(first ? 0 : 900);
});
