// A change the database did not take because the row was changed somewhere else (another tab, another phone) after this
// screen read it. Nothing was written: the owner sees what is stored now beside their own values, and decides. There is
// no third way out (no close button, Esc does nothing): a change is never kept or dropped without the owner saying so.
import { useEffect, useRef } from 'preact/hooks';
import { Btn } from '../ui.tsx';
import { named } from './data/rows.ts';
import { conflicts, menu, resolveConflict, type Conflict } from './data/store.ts';
import type { ScheduleRow, TimeWindow, UpsellRuleRow, Weekday } from '@mana/contracts';
import { shekels } from './format.ts';
import { lang, t } from './i18n.ts';
import { dateText, daysText, ruleSummary, shortTime, timeRange, type NameOf } from './words.ts';

/** The columns as the forms name them. */
const LABELS: Partial<Record<Conflict['table'], Record<string, string>>> = {
  sections: { name: 'menu.cat.name', kind: 'menu.cat.kind', room: 'room.label', schedule_id: 'dish.daypart', hidden: 'ed.hide', position: 'conflict.position' },
  dishes: {
    name: 'item.name', desc: 'item.desc', price: 'item.price', price_note: 'item.priceNote', tags: 'item.tags', allergens: 'item.allergens',
    section_id: 'item.category', schedule_id: 'dish.daypart', hidden: 'ed.hide', position: 'conflict.position',
  },
  upsell_rules: {
    label: 'lib.label', trigger: 'rules.when', scope_kind: 'rules.scope', scope_ids: 'rules.scope', days: 'hours.days', from_time: 'rules.times', to_time: 'rules.times',
    basket_has_dishes: 'rules.has', basket_has_sections: 'rules.has', basket_lacks_dishes: 'rules.lacks', basket_lacks_sections: 'rules.lacks',
    suggest_kind: 'rules.suggest', suggest_dish_id: 'rules.suggest', suggest_option_id: 'rules.suggest', line: 'rules.line', priority: 'rules.priority', cap: 'rules.cap',
    active: 'rules.active',
  },
  schedules: { name: 'parts.name', kind: 'parts.kind', windows: 'parts.when', valid_from: 'parts.validFrom', valid_to: 'parts.validTo' },
};
function label(c: Conflict, col: string): string {
  const L = (col.endsWith('_he') ? ' · ' + t('app.he') : col.endsWith('_en') ? ' · ' + t('app.en') : '');
  const key = LABELS[c.table]?.[col.replace(/_(he|en)$/, '')];
  return (key ? t(key) : col) + L;
}

const namesNow = (): NameOf => (kind, id) => {
  const d = menu.value, L = lang.value;
  return named(kind === 'dish' ? d?.dishes.find((x) => x.id === id) : kind === 'section' ? d?.sections.find((x) => x.id === id) : d?.options.find((x) => x.id === id), L);
};

/** What the dialog calls the row: a dish's or a section's name, a rule's label or its line in words. */
function rowName(c: Conflict): string {
  if (c.table === 'upsell_rules') { const r = c.stored as unknown as UpsellRuleRow; return r.label || ruleSummary(r, namesNow()); }
  return named(c.stored as unknown as { name_he: string; name_en: string }, lang.value) || t('menu2.unnamed');
}

/** A stored value in words: prices in shekels, sections, dishes and day parts by name, days and times, yes or no. */
function shown(c: Conflict, col: string, v: unknown): string {
  const d = menu.value, L = lang.value;
  if (c.table === 'upsell_rules' || c.table === 'schedules') { const w = ruleOrPart(c.table, col, v); if (w !== null) return w; }
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

/** A rule's or a day part's column in words (null: said as any other value). */
function ruleOrPart(table: 'upsell_rules' | 'schedules', col: string, v: unknown): string | null {
  const name = namesNow();
  const list = (kind: 'dish' | 'section') => ((v as string[]) ?? []).map((id) => name(kind, id) || t('rs.gone')).join(', ') || t('conflict.empty');
  if (table === 'schedules') {
    switch (col) {
      case 'kind': return t('parts.kind.' + v);
      case 'windows': return ((v as TimeWindow[]) ?? []).map((w) => daysText(w.days as Weekday[]) + ' ' + timeRange(w.from.slice(0, 5), w.to.slice(0, 5))).join('; ') || t('conflict.empty');
      case 'valid_from': case 'valid_to': return v ? dateText(v as string, false) : t('conflict.empty');
      default: return null;
    }
  }
  switch (col) {
    case 'trigger': return t('rules.trigger.' + v);
    case 'scope_kind': return t('rules.scope.' + v);
    case 'scope_ids': return list(menu.value?.dishes.some((x) => ((v as string[]) ?? []).includes(x.id)) ? 'dish' : 'section');
    case 'days': return daysText((v as Weekday[]) ?? []);
    case 'from_time': case 'to_time': return v ? shortTime((v as string).slice(0, 5)) : t('conflict.empty');
    case 'basket_has_dishes': case 'basket_lacks_dishes': return list('dish');
    case 'basket_has_sections': case 'basket_lacks_sections': return list('section');
    case 'suggest_kind': return t('rules.suggest.' + v);
    case 'suggest_dish_id': return v ? name('dish', v as string) || t('rs.gone') : t('conflict.empty');
    case 'suggest_option_id': return v ? name('option', v as string) || t('rs.gone') : t('conflict.empty');
    case 'active': return t(v ? 'rules.on' : 'rules.off');
    default: return null;
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const SKIP = new Set(['id', 'venue_id', 'created_at', 'updated_at', 'inactive_reason']);

export function ConflictDialog() {
  const c = conflicts.value[0];
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = ref.current; if (el && c && !el.open) el.showModal(); }, [c?.key, c?.at]);
  if (!c) return null;
  const name = rowName(c);
  const mine = Object.keys(c.mine).filter((k) => !SKIP.has(k));
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
                  <td data-stored><bdi dir={k === 'price' ? 'ltr' : 'auto'}>{shown(c, k, c.stored[k])}</bdi></td>
                  <td data-mine><bdi dir={k === 'price' ? 'ltr' : 'auto'}>{shown(c, k, c.mine[k])}</bdi></td>
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
