// Small shared pieces: buttons, fields, dialogs, notes. Everything a finger touches is at least 44 px tall.
import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { t, errText } from './lib/i18n.ts';
import { toasts } from './lib/store.ts';

// ---- hash routing (works under any path prefix, no server rules needed)
const parse = () => { const h = location.hash.replace(/^#\/?/, ''); return h.split('?')[0].split('/').filter(Boolean).map(decodeURIComponent); };
export const route = signal<string[]>(parse());
// A dish's sheet has an address of its own (#/menu/i/<id>) but it opens over the menu: the page behind must keep its place.
const screenOf = (r: string[]) => (r[0] === 'pictures' && r[1] ? 'review' : r[0] || '');
function setRoute() { const before = screenOf(route.value); route.value = parse(); if (screenOf(route.value) !== before) window.scrollTo(0, 0); }
window.addEventListener('hashchange', setRoute);
export function go(path: string, replace = false) {
  const target = '#/' + path.replace(/^\/+/, '');
  if (replace) { history.replaceState(null, '', target); setRoute(); } else location.hash = target;
}

// ---- icons (stroke, inherit colour)
const PATHS: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M10 20v-6h4v6',
  menu: 'M6 4h12a1 1 0 0 1 1 1v15l-3-2-2 2-2-2-2 2-2-2-3 2V5a1 1 0 0 1 1-1zM9 9h6M9 13h6',
  camera: 'M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 16.5a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
  look: 'M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.8-1.7 0-1.6 1-2.3 2.4-2.3H18a3 3 0 0 0 3-3c0-6-4.5-11-9-11zM7.5 12.5h.01M9.5 8h.01M14.5 7.5h.01M17 11h.01',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  send: 'M4 12 20 4l-5 16-3.5-6.5L4 12zM11.5 13.5 20 4',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v5M14 11v5',
  chev: 'M9 5l7 7-7 7',
  copy: 'M9 9h10v11H9zM5 15V4h10',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  print: 'M7 8V4h10v4M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z',
  alert: 'M12 4 2.5 20h19L12 4zM12 10v5M12 17.5h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5 4 4 3-3L20 17M9 9.5h.01',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c1-4 4-5.5 7.5-5.5s6.5 1.5 7.5 5.5',
  refresh: 'M20 12a8 8 0 1 1-2.5-5.8M20 4v5h-5',
  chat: 'M4 5h16v11H9l-5 4V5z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.500 5.6 12 3z',
  cube: 'M12 3 4 7.5v9L12 21l8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 9h8M8 12h8M8 15h5',
  paste: 'M9 3.5h6v3H9zM9 5H6.5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H15M9 11.5h6M9 15.5h4',
  keys: 'M3 7h18v10H3zM7 10.5h.01M10.3 10.5h.01M13.7 10.5h.01M17 10.5h.01M8 14h8',
  restaurant: 'M6 3v6a2.5 2.5 0 0 0 5 0V3M8.5 3v18M17 21V3c-2 1.5-3 4-3 7.5V14h3',
  cafe: 'M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M11.5 3v3',
  bar: 'M5 4h14l-7 8-7-8zM12 12v8M8 20h8M15 4l2.5-2',
  bakery: 'M4 11a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4c0 1.3-.8 2-2 2v5H6v-5c-1.2 0-2-.7-2-2zM9 7.5v3M12 7v3.5M15 7.5v3',
  food_truck: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  other: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12h.01M12 12h.01M16 12h.01',
  hotel: 'M4 20V5h10v15M14 10h6v10M8 9h2M8 13h2M8 17h2M17 14h.01M17 17h.01',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM20 14v.01M14 20v.01',
  phone: 'M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM11 18h2',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  rows: 'M4 5h16v5H4zM4 14h16v5H4z',
  sparkle: 'M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8L11 3zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  share: 'M12 15V4M8 8l4-4 4 4M5 13v6h14v-6',
  open: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  trend: 'M4 17l5-5 4 3 7-8M15 7h5v5',
  star: 'M12 4l2.4 5 5.6.8-4 3.9.9 5.5L12 16.5 7.1 19.2 8 13.7 4 9.8 9.6 9 12 4z',
  bookmark: 'M6 4h12v16l-6-4-6 4V4z',
  power: 'M12 4v8M7.5 7a7 7 0 1 0 9 0',
  history: 'M4 12a8 8 0 1 0 2.5-5.8M4 5v4h4M12 8v4l3 2',
  ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM6 6l12 12',
  chevdown: 'M6 9l6 6 6-6',
  store: 'M4 9l1.5-5h13L20 9M5 9v11h14V9M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9M10 20v-5h4v5',
  vegan: 'M5 19c0-8 5-13 14-14 0 9-5 14-13 14M5 19c2-5 5-8 9-10',
  vegetarian: 'M12 20V10M12 10c0-3 2-5 6-5 0 4-2 6-6 5zM12 13c0-2.5-1.7-4-5-4 0 3.5 1.7 5 5 4z',
  spicy: 'M12 3c1 3 4 4.5 4 9a4 4 0 0 1-8 0c0-2 1-3 1.5-4.5C10.5 9 11 6 12 3z',
  gf: 'M12 20V8M12 8c-2-1-2.5-3-2-5 2 .5 3 2 2 5zM12 12c-2.5 0-4-1.500-4-4M12 12c2.500 0 4-1.500 4-4M5 5l14 14',
  plate: 'M12 19.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM12 15.500a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7z',
  frame: 'M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  angle: 'M4 19h16M4 19 16 7M10 19a6 6 0 0 0-1.800-4.200',
  backdrop: 'M4 5h16v14H4zM4 14.500h16M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  wand: 'M5 19 16 8M14 6l4 4M18 3v3M16.500 4.500h3M8 4v2M7 5h2M19 13v2M18 14h2',
  swap: 'M7 7h11l-3-3M17 17H6l3 3',
  filter: 'M4 6h16l-6 7v5l-4 2v-7L4 6z',
  dish: 'M4 15a8 8 0 0 1 16 0M3 15h18M12 5v2M6 18h12',
  translate: 'M4 6h8M8 4v2M5.500 6c.500 3 2.500 5.500 5.500 7M11 6c-.800 3.500-3 6-6 7.500M13 20l3.500-8 3.500 8M14.300 17h4.400',
  logout: 'M10 4H5v16h5M14 8l4 4-4 4M18 12H9',
  food: 'M6 3v6a2.5 2.5 0 0 0 5 0V3M8.5 3v18M17 21V3c-2 1.5-3 4-3 7.5V14h3',
  dessert: 'M7 11a5 5 0 0 1 10 0M5.5 11h13l-2 9h-9l-2-9zM12 6V4',
  drinks: 'M7 4h10l-1.5 16h-7L7 4zM7.5 9h9',
  wine: 'M8 3h8c.5 4-1 8-4 8s-4.5-4-4-8zM12 11v9M8.5 20h7',
  beer: 'M6 6h9v14H6zM15 9h2.5a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H15M9 9.5v7M12 9.5v7',
  reorder: 'M8 5v14M5 8l3-3 3 3M16 19V5M13 16l3 3 3-3',
  dots: 'M12 6h.01M12 12h.01M12 18h.01',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.500 2.300c-.700.400-1 1-1 1.700M12 17h.01',
};
export function Icon({ name, size = 20, flip = false, back = false }: { name: string; size?: number; flip?: boolean; back?: boolean }) {
  return <svg class={'ico' + (flip ? ' flip' : '') + (back ? ' back' : '')} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false"><path d={PATHS[name] || ''} fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>;
}

type BtnProps = { [k: string]: any; children?: ComponentChildren; class?: string; kind?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'; busy?: boolean; icon?: string; small?: boolean; block?: boolean; type?: 'button' | 'submit'; disabled?: boolean };
export function Btn({ kind = 'secondary', busy, icon, small, block, children, class: cls, disabled, type = 'button', ...rest }: BtnProps) {
  return (
    <button type={type} class={`btn btn-${kind}${small ? ' btn-sm' : ''}${block ? ' btn-block' : ''}${busy ? ' is-busy' : ''} ${cls || ''}`} disabled={disabled || busy} aria-busy={busy ? 'true' : undefined} {...rest}>
      {busy ? <span class="spin" aria-hidden="true" /> : icon ? <Icon name={icon} size={18} /> : null}
      {children != null && <span class="btn-txt">{children}</span>}
    </button>
  );
}
export function IconBtn({ icon, label, flip, ...rest }: { icon: string; label: string; flip?: boolean; [k: string]: any }) {
  return <button type="button" class="iconbtn" aria-label={label} title={label} {...rest}><Icon name={icon} flip={flip} /></button>;
}

let fieldSeq = 0;
export function Field({ label, hint, error, optional, children, class: cls }: { label: string; hint?: string; error?: string; optional?: boolean; children: (p: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: 'true' }) => ComponentChildren; class?: string }) {
  const [id] = useState(() => 'f' + ++fieldSeq);
  const desc = [hint ? id + '-h' : '', error ? id + '-e' : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div class={'field ' + (cls || '') + (error ? ' has-error' : '')}>
      <label for={id}>{label}{optional && <span class="opt"> · {t('app.optional')}</span>}</label>
      {children({ id, 'aria-describedby': desc, 'aria-invalid': error ? 'true' : undefined })}
      {hint && <p class="hint" id={id + '-h'}>{hint}</p>}
      {error && <p class="ferr" id={id + '-e'} role="alert">{error}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled, labelOff }: { checked: boolean; onChange: (v: boolean) => void; label: string; labelOff?: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked ? 'true' : 'false'} aria-label={label} class="switch" disabled={disabled} onClick={() => onChange(!checked)}>
      <span class="switch-track" aria-hidden="true"><span class="switch-knob" /></span>
      {labelOff !== undefined && <span class="switch-lbl">{checked ? label : labelOff}</span>}
    </button>
  );
}

export function Note({ kind = 'info', title, children, action }: { kind?: 'info' | 'warn' | 'error' | 'ok'; title?: string; children?: ComponentChildren; action?: ComponentChildren }) {
  return (
    <div class={'note note-' + kind} role={kind === 'error' ? 'alert' : undefined}>
      <Icon name={kind === 'ok' ? 'check' : kind === 'info' ? 'info' : 'alert'} />
      <div class="note-body">{title && <p class="note-title">{title}</p>}{children && <div class="note-text">{children}</div>}{action && <div class="note-actions">{action}</div>}</div>
    </div>
  );
}
export function ErrorNote({ code, scope, onRetry }: { code: string; scope?: string; onRetry?: () => void }) {
  if (!code) return null;
  return <Note kind="error" action={onRetry && <Btn small onClick={onRetry} icon="refresh">{t('app.retry')}</Btn>}>{errText(code, scope)}</Note>;
}
export function Empty({ title, body, children, icon = 'list' }: { title: string; body?: string; children?: ComponentChildren; icon?: string }) {
  return <div class="empty"><span class="empty-ico"><Icon name={icon} size={26} /></span><h2>{title}</h2>{body && <p>{body}</p>}{children && <div class="empty-actions">{children}</div>}</div>;
}
export const Loading = ({ label }: { label?: string }) => <div class="loading" role="status"><span class="spin" aria-hidden="true" /><span>{label || t('app.loading')}</span></div>;

export function Dialog({ open, onClose, title, children, actions, wide }: { open: boolean; onClose: () => void; title: string; children: ComponentChildren; actions?: ComponentChildren; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  if (!open) return null;
  return (
    <dialog ref={ref} class={'dialog' + (wide ? ' dialog-wide' : '')} aria-label={title} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div class="dialog-in">
        <header class="dialog-head"><h2>{title}</h2><IconBtn icon="x" label={t('app.close')} onClick={onClose} /></header>
        <div class="dialog-body">{children}</div>
        {actions && <footer class="dialog-foot">{actions}</footer>}
      </div>
    </dialog>
  );
}
export function Confirm({ open, title, body, confirmLabel, danger, busy, onConfirm, onClose }: { open: boolean; title: string; body: string; confirmLabel: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={title} actions={<><Btn kind="ghost" onClick={onClose}>{t('app.cancel')}</Btn><Btn kind={danger ? 'danger' : 'primary'} busy={busy} onClick={onConfirm}>{confirmLabel}</Btn></>}>
      <p>{body}</p>
    </Dialog>
  );
}

export function Toasts() {
  const ref = useRef<HTMLDivElement>(null);
  const list = toasts.value;
  // sheets are modal dialogs (the browser's top layer): a toast must sit above them, so the container is a popover that is
  // put back on top whenever a toast arrives
  useEffect(() => {
    const el = ref.current as any; if (!el || typeof el.showPopover !== 'function') return;
    try { if (el.matches(':popover-open')) el.hidePopover(); if (list.length) el.showPopover(); } catch { /* not connected */ }
  }, [list.length ? list[list.length - 1].id : 0]);
  return <div ref={ref} class="toasts" popover="manual" aria-live="polite" aria-atomic="false">{list.map((x) => <div key={x.id} class={'toast toast-' + x.kind} role={x.kind === 'error' ? 'alert' : 'status'}>{x.text}</div>)}</div>;
}

/** "Not saved": said where the owner is looking (the page, or the sheet that is open over it), with a way to try again. */
export function SaveFailed({ problem, onRetry }: { problem: string; onRetry: () => void }) {
  return (
    <div class="savebar" role="alert">
      <Icon name="alert" /><span>{t('save.failedLong')} {errText(problem)}</span>
      <Btn small kind="primary" onClick={onRetry}>{t('app.retry')}</Btn>
    </div>
  );
}

/** Latin text, numbers, links and phone numbers inside Hebrew: isolated so the order of characters stays right. */
export const Ltr = ({ children, class: cls, ...rest }: { children: ComponentChildren; class?: string; [k: string]: any }) => <bdi dir="ltr" class={cls} {...rest}>{children}</bdi>;

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* older browsers or no permission */ }
  try { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; }
  catch { return false; }
}
export function CopyBtn({ text, label, small = true }: { text: string; label?: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  return <Btn small={small} icon={done ? 'check' : 'copy'} onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 2000); } }}><span aria-live="polite">{done ? t('app.copied') : label || t('app.copy')}</span></Btn>;
}
/** The same, as a round icon button (where a row has no room for words). */
export function CopyIcon({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" class="iconbtn" aria-label={done ? t('app.copied') : t('app.copy')} title={t('app.copy')} data-copy onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 2000); } }}><Icon name={done ? 'check' : 'copy'} /><span class="sr" aria-live="polite">{done ? t('app.copied') : ''}</span></button>;
}
export function PageHead({ title, lead, children }: { title: string; lead?: string; children?: ComponentChildren }) {
  return <header class="page-head"><div><h1 tabIndex={-1}>{title}</h1>{lead && <p class="lead">{lead}</p>}</div>{children && <div class="page-actions">{children}</div>}</header>;
}

/** A sheet that rises from the bottom on a phone. On a wide screen it is a centred panel, or (side) a panel beside the editor.
    `full` fills the screen (the live preview). Esc, the close button and a tap outside all close it. */
export function Sheet({ open, onClose, title, children, foot, side, full, tall, head, name }: { open: boolean; onClose: () => void; title: string; children: ComponentChildren; foot?: ComponentChildren; side?: boolean; full?: boolean; tall?: boolean; head?: ComponentChildren; name?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  if (!open) return null;
  return (
    <dialog ref={ref} class={'sheet' + (side ? ' sheet-side' : '') + (full ? ' sheet-full' : '') + (tall ? ' sheet-tall' : '')} aria-label={title} data-sheet={name} onCancel={(e) => { e.preventDefault(); onClose(); }} onClick={(e) => { if (e.target === ref.current) onClose(); }}>
      <div class="sheet-in">
        <header class="sheet-head"><h2>{title}</h2>{head}<IconBtn icon="x" label={t('app.close')} onClick={onClose} /></header>
        <div class="sheet-body">{children}</div>
        {foot && <footer class="sheet-foot">{foot}</footer>}
      </div>
    </dialog>
  );
}

/** Two or three choices in one row (he | en, list | grid). */
export function Seg<T extends string>({ value, options, onChange, label, small, disabled }: { value: T; options: { value: T; label: string; icon?: string }[]; onChange: (v: T) => void; label: string; small?: boolean; disabled?: boolean }) {
  return (
    <div class={'seg' + (small ? ' seg-sm' : '')} role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value ? 'true' : 'false'} aria-label={o.icon ? o.label : undefined} title={o.icon ? o.label : undefined} disabled={disabled} onClick={() => onChange(o.value)}>{o.icon ? <Icon name={o.icon} size={18} /> : o.label}</button>)}
    </div>
  );
}

/** The one primary action of a screen, kept at the bottom of the window. */
export function Sticky({ children, note }: { children: ComponentChildren; note?: ComponentChildren }) {
  return <div class="sticky"><div class="sticky-in">{note && <p class="sticky-note">{note}</p>}{children}</div></div>;
}
