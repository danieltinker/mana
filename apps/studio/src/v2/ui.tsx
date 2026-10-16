// The v2 app's own small pieces, on top of the shared ones in ../ui.tsx (buttons, fields, sheets, notes, icons):
// a list that reorders by drag and by keyboard, a number stepper, a price field, the language switch for bilingual
// fields, tabs, and the error line in v2's words.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { FromPrice } from '@mana/contracts';
import { Btn, Icon, IconBtn, Note, Seg, go } from '../ui.tsx';
import { shekels } from './format.ts';
import { errText, lang, t } from './i18n.ts';

// icons the v1 set does not have (same stroke and size rules as ../ui.tsx)
const MORE: Record<string, string> = {
  minus: 'M5 12h14',
  layers: 'M12 4 3 8.5l9 4.5 9-4.5L12 4zM3 12.5l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5',
  nest: 'M7 4v9a3 3 0 0 0 3 3h9M16 13l3 3-3 3',
};
export function Icon2({ name, size = 20 }: { name: string; size?: number }) {
  if (!(name in MORE)) return <Icon name={name} size={size} />;
  return <svg class="ico" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false"><path d={MORE[name]} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>;
}
function GlyphBtn({ icon, label, ...rest }: { icon: string; label: string; [k: string]: any }) {
  return <button type="button" class="iconbtn" aria-label={label} title={label} {...rest}><Icon2 name={icon} /></button>;
}

/** "₪62", "from ₪62" or "No price": the amount stays left to right inside a Hebrew sentence. */
export function Price({ p }: { p: FromPrice | null }) {
  if (!p) return <span>{t('menu.item.noPrice')}</span>;
  const amount = <bdi dir="ltr" class="price">{shekels(p.amount)}</bdi>;
  if (!p.from) return amount;
  const [before, after = ''] = t('gp.from').split('{price}');
  return <span>{before}{amount}{after}</span>;
}

export function ErrorLine({ code, scope, onRetry }: { code: string; scope?: string; onRetry?: () => void }) {
  if (!code) return null;
  return <Note kind="error" action={onRetry && <Btn small onClick={onRetry} icon="refresh">{t('app.retry')}</Btn>}>{errText(code, scope)}</Note>;
}

/** The language a bilingual form is showing: the owner's own language first when the place uses it. */
export function useEntryLang(langs: readonly ('he' | 'en')[]): ['he' | 'en', (l: 'he' | 'en') => void] {
  return useState<'he' | 'en'>(() => (langs.includes(lang.value) ? lang.value : langs[0] ?? 'he'));
}
export function LangSeg({ value, onChange, langs }: { value: 'he' | 'en'; onChange: (l: 'he' | 'en') => void; langs: readonly ('he' | 'en')[] }) {
  if (langs.length < 2) return null;
  return <Seg small value={value} label={t('item.lang')} onChange={onChange} options={langs.map((l) => ({ value: l, label: t('app.' + l + '.short') }))} />;
}

/**
 * A whole number between min and max, with − and + (a stepper a thumb can use, and a screen reader can name). Left to
 * right in both languages, − then the number then +, as the guest app's steppers are (apps/view).
 */
export function Stepper({ value, min, max, onChange, label, id, disabled }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string; id?: string; disabled?: boolean }) {
  return (
    <div class="stepper" dir="ltr" role="group" aria-label={label} data-stepper={id}>
      <GlyphBtn icon="minus" label={t('ed.less', { name: label })} disabled={disabled || value <= min} onClick={() => onChange(value - 1)} />
      <output class="stepper-n" aria-live="polite">{value}</output>
      <GlyphBtn icon="plus" label={t('ed.more', { name: label })} disabled={disabled || value >= max} onClick={() => onChange(value + 1)} />
    </div>
  );
}

/** A price in shekels: digits, the ₪ after them, left to right in both languages. */
export function MoneyInput({ value, onInput, label, invalid, id, describedBy, placeholder, field, disabled }: { value: string; onInput: (v: string) => void; label?: string; invalid?: boolean; id?: string; describedBy?: string; placeholder?: string; field?: string; disabled?: boolean }) {
  return (
    <span class="money">
      <input id={id} type="text" inputMode="decimal" dir="ltr" maxLength={12} value={value} aria-label={label} aria-invalid={invalid ? 'true' : undefined} aria-describedby={describedBy}
        placeholder={placeholder} disabled={disabled} data-field={field} onInput={(e) => onInput((e.target as HTMLInputElement).value)} />
      <span class="cur" aria-hidden="true">₪</span>
    </span>
  );
}

/** Tabs (a dish's details, its add-ons, what goes well with it): arrow keys move between them. */
export function Tabs<K extends string>({ value, tabs, onChange, label }: { value: K; tabs: { key: K; label: string; badge?: number }[]; onChange: (k: K) => void; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const key = (e: KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const rtl = document.documentElement.dir === 'rtl';
    const next = tabs[(i + (rtl ? -dir : dir) + tabs.length) % tabs.length]!;
    onChange(next.key); refs.current[next.key]?.focus();
  };
  // the row scrolls sideways when the words do not fit; the wrapper (not a scroller) keeps its full height in a sheet
  return (
    <div class="tabs-wrap">
      <div class="tabs" role="tablist" aria-label={label}>
        {tabs.map((tb, i) => (
          <button key={tb.key} ref={(el) => { refs.current[tb.key] = el; }} type="button" role="tab" id={'tab-' + tb.key} aria-selected={value === tb.key ? 'true' : 'false'} aria-controls={value === tb.key ? 'panel-' + tb.key : undefined}
            tabIndex={value === tb.key ? 0 : -1} onClick={() => onChange(tb.key)} onKeyDown={(e) => key(e as any, i)} data-tab={tb.key}>
            {tb.label}{tb.badge ? <b class="tabs-n">{tb.badge}</b> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
export const TabPanel = ({ id, children }: { id: string; children: ComponentChildren }) => <div role="tabpanel" id={'panel-' + id} aria-labelledby={'tab-' + id} class="tabpanel">{children}</div>;

/**
 * A screen an account that may not edit (a counter) sees read-only, in three parts (README, "Who may edit"):
 * 1. `<ReadOnly when={!editable}>` around the editing area: one fieldset, so every field, switch, stepper, price and
 *    choice inside is disabled at once, whatever the component, with no look of its own;
 * 2. `disabled={!editable}` on each control as well (the state is then in the markup of each one, for any check), and
 *    the buttons that only edit (save, delete, add, arrange) not rendered at all;
 * 3. `useEditOnly(onEditAddress, editable, back)` on an address that only edits, so it leads back instead.
 * The store refuses the writes anyway (`mayWrite`).
 */
export function ReadOnly({ when, children, class: cls, ...rest }: { when: boolean; children: ComponentChildren; class?: string; [k: string]: any }) {
  return <fieldset class={'ro' + (cls ? ' ' + cls : '')} disabled={when} data-readonly={when ? '' : undefined} {...rest}>{children}</fieldset>;
}

/** An address that only edits (a section's sheet, a new group): an account that may not edit is taken to `back`. */
export function useEditOnly(onEditAddress: boolean, editable: boolean, back: string) {
  useEffect(() => { if (onEditAddress && !editable) go(back, true); }, [onEditAddress, editable, back]);
}

/**
 * After a move made with the up or down button: the focus stays on the moved row's button, or goes to the other one when
 * the row reached the first or last place (a disabled button cannot hold it).
 */
export function refocusMove(row: string, dir: 'up' | 'down') {
  const run = () => {
    const li = document.querySelector(row);
    const want = li?.querySelector(`[data-move="${dir}"]`) as HTMLButtonElement | null;
    const other = li?.querySelector(`[data-move="${dir === 'up' ? 'down' : 'up'}"]`) as HTMLButtonElement | null;
    const to = want && !want.disabled ? want : other && !other.disabled ? other : null;
    if (to && document.activeElement !== to) to.focus();
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
}

type Drag = { id: string; from: number; to: number; y0: number; h: number };

/**
 * An ordered list the owner can rearrange: in arrange mode each row has a grip to drag (pointer) and buttons to move it
 * up or down (keyboard and screen readers, announced). `onMove(from, to)` gets indexes in `items`.
 */
export function ReorderList<T extends { id: string }>({ items, arranging, nameOf, onMove, render, class: cls, label }: {
  items: readonly T[]; arranging: boolean; nameOf: (x: T) => string; onMove: (from: number, to: number) => void; render: (x: T, i: number) => ComponentChildren; class?: string; label?: string;
}) {
  const drag = useRef<Drag | null>(null);
  const [state, setState] = useState<{ id: string; dy: number; to: number; from: number } | null>(null);
  const [said, setSaid] = useState('');
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    onMove(from, to);
    setSaid(t('menu.moved', { name: nameOf(items[from]!), n: to + 1 }));
  };
  const down = (e: PointerEvent, x: T, i: number) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const li = (e.currentTarget as HTMLElement).closest('li') as HTMLElement;
    drag.current = { id: x.id, from: i, to: i, y0: e.clientY, h: li.getBoundingClientRect().height };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setState({ id: x.id, dy: 0, to: i, from: i });
    e.preventDefault();
  };
  const moveP = (e: PointerEvent) => {
    const g = drag.current; if (!g) return;
    const dy = e.clientY - g.y0;
    g.to = Math.max(0, Math.min(items.length - 1, g.from + Math.round(dy / g.h)));
    setState({ id: g.id, dy, to: g.to, from: g.from });
  };
  const up = () => {
    const g = drag.current; drag.current = null; setState(null);
    if (g && g.to !== g.from) move(g.from, g.to);
  };
  return (
    <>
      <ul class={'rows' + (arranging ? ' is-reorder' : '') + (cls ? ' ' + cls : '')} aria-label={label}>
        {items.map((x, i) => {
          let shift = 0;
          if (state && state.id !== x.id) { if (state.from < i && i <= state.to) shift = -1; else if (state.to <= i && i < state.from) shift = 1; }
          const style = state ? (state.id === x.id ? { transform: `translateY(${state.dy}px)`, zIndex: 3 } : shift ? { transform: `translateY(${shift * (drag.current?.h || 64)}px)` } : undefined) : undefined;
          const name = nameOf(x);
          return (
            <li key={x.id} class={'row' + (state?.id === x.id ? ' is-dragging' : '')} style={style as any} data-row={x.id}>
              {arranging && <span class="grip" aria-hidden="true" onPointerDown={(e) => down(e as any, x, i)} onPointerMove={(e) => moveP(e as any)} onPointerUp={up} onPointerCancel={up}><Icon name="grip" size={20} /></span>}
              {render(x, i)}
              {arranging && <div class="tools">
                <IconBtn icon="up" label={t('menu.up', { name })} disabled={i === 0} data-move="up" onClick={() => { move(i, i - 1); refocusMove(`li[data-row="${x.id}"]`, 'up'); }} />
                <IconBtn icon="down" label={t('menu.down', { name })} disabled={i === items.length - 1} data-move="down" onClick={() => { move(i, i + 1); refocusMove(`li[data-row="${x.id}"]`, 'down'); }} />
              </div>}
            </li>
          );
        })}
      </ul>
      <p class="sr" aria-live="polite">{said}</p>
    </>
  );
}
