// A change the database did not take because the row was changed somewhere else (another tab, another phone) after this
// screen read it. Nothing was written: the owner sees what is stored now beside their own values, and decides. There is
// no third way out (no close button, Esc does nothing): a change is never kept or dropped without the owner saying so.
import { useEffect, useRef } from 'preact/hooks';
import { Btn } from '../ui.tsx';
import { named } from './data/rows.ts';
import { conflicts, menu, resolveConflict, type Conflict } from './data/store.ts';
import { shekels } from './format.ts';
import { lang, t } from './i18n.ts';

/** The columns as the forms name them. */
function label(c: Conflict, col: string): string {
  const L = (col.endsWith('_he') ? ' · ' + t('app.he') : col.endsWith('_en') ? ' · ' + t('app.en') : '');
  const base = col.replace(/_(he|en)$/, '');
  const key = c.table === 'sections'
    ? ({ name: 'menu.cat.name', kind: 'menu.cat.kind', room: 'room.label', hidden: 'ed.hide', position: 'conflict.position' } as Record<string, string>)[base]
    : ({ name: 'item.name', desc: 'item.desc', price: 'item.price', price_note: 'item.priceNote', tags: 'item.tags', allergens: 'item.allergens',
        section_id: 'item.category', schedule_id: 'dish.daypart', hidden: 'ed.hide', position: 'conflict.position' } as Record<string, string>)[base];
  return (key ? t(key) : col) + L;
}

/** A stored value in words: prices in shekels, sections and day parts by name, yes or no. */
function shown(col: string, v: unknown): string {
  const d = menu.value, L = lang.value;
  if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return col === 'schedule_id' ? t('dish.daypart.always') : col === 'room' ? t('room.auto') : t('conflict.empty');
  switch (col) {
    case 'price': return shekels(v as number);
    case 'hidden': return t(v ? 'menu2.hidden' : 'conflict.shown');
    case 'tags': return (v as string[]).map((x) => t('tag.' + x)).join(', ');
    case 'section_id': return named(d?.sections.find((s) => s.id === v), L) || t('menu2.unnamed');
    case 'schedule_id': return named(d?.schedules.find((s) => s.id === v), L) || t('menu2.unnamed');
    case 'kind': return t('kindc.' + v);
    case 'room': return t('room.' + v);
    case 'position': return String((v as number) + 1);
    default: return String(v);
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const SKIP = new Set(['id', 'venue_id', 'created_at', 'updated_at']);

export function ConflictDialog() {
  const c = conflicts.value[0];
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current; if (el && c && !el.open) el.showModal(); }, [c?.key, c?.at]);
  if (!c) return null;
  const L = lang.value;
  const name = named(c.stored as unknown as { name_he: string; name_en: string }, L) || t('menu2.unnamed');
  // only the owner's values that differ from what is stored are a question (one already stored, their own save whose
  // answer was lost, is not listed; nor is it "changed there")
  const mine = Object.keys(c.mine).filter((k) => !SKIP.has(k) && !same(c.mine[k], c.stored[k]));
  const there = c.before ? Object.keys(c.stored).filter((k) => !SKIP.has(k) && !(k in c.mine) && !same(c.before![k], c.stored[k])) : [];
  const decide = (keep: 'mine' | 'stored') => { ref.current?.close(); resolveConflict(c.key, keep); };
  return (
    <dialog ref={ref} class="dialog conflict" aria-labelledby="conflict-h" data-conflict={c.table + ':' + c.id} onCancel={(e) => e.preventDefault()}>
      <div class="dialog-in">
        <header class="dialog-head"><h2 id="conflict-h">{t('conflict.title')}</h2></header>
        <div class="dialog-body">
          <p>{t(c.table === 'sections' ? 'conflict.bodySection' : c.table === 'dishes' ? 'conflict.bodyDish' : 'conflict.body', { name })}</p>
          <table class="conflict-table">
            <thead><tr><th scope="col">{t('conflict.field')}</th><th scope="col">{t('conflict.stored')}</th><th scope="col">{t('conflict.mine')}</th></tr></thead>
            <tbody>
              {mine.map((k) => (
                <tr key={k} data-col={k}>
                  <th scope="row">{label(c, k)}</th>
                  <td data-stored><bdi dir={k === 'price' ? 'ltr' : 'auto'}>{shown(k, c.stored[k])}</bdi></td>
                  <td data-mine><bdi dir={k === 'price' ? 'ltr' : 'auto'}>{shown(k, c.mine[k])}</bdi></td>
                </tr>
              ))}
            </tbody>
          </table>
          {there.length > 0 && <p class="fine" data-there>{t('conflict.alsoThere', { fields: there.map((k) => label(c, k)).join(', ') })}</p>}
          <p class="fine">{t('conflict.hint')}</p>
        </div>
        <footer class="dialog-foot">
          <Btn onClick={() => decide('stored')} data-action="take-stored">{t('conflict.takeStored')}</Btn>
          <Btn kind="primary" onClick={() => decide('mine')} data-action="keep-mine">{t('conflict.keepMine')}</Btn>
        </footer>
      </div>
    </dialog>
  );
}
