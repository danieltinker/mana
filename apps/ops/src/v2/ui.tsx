/**
 * Small shared pieces of the v2 back office. Text from owners, guests and imports always goes through <T> (a
 * <bdi dir="auto">, so Hebrew and English sit side by side and nothing a stranger typed can reorder the text around it)
 * or a plain text node: never HTML. The one exception is the mark, a constant from brand/tools/mark.mjs.
 */
import { createContext, type ComponentChildren } from 'preact';
import { useContext, useEffect, useState } from 'preact/hooks';
import type { Text } from '@mana/contracts';
import { MARK_SMALL } from '../mark-shapes.js';
import { names, PRODUCT, type Chip, type Tone } from './model.ts';
import type { Fail, OpsApi } from './api.ts';
import type { Connection, User } from './session.ts';
import type { StaffRole } from '@mana/contracts';

// ---------------------------------------------------------------- the signed-in context

export type Ctx = {
  readonly conn: Connection;
  readonly api: OpsApi;
  readonly user: User;
  readonly role: StaffRole;
  /** Realtime is on in this environment (ADR-007: demo yes, local no). */
  readonly realtime: boolean;
  /** A staff RPC answered 42501: the database does not count this session as staff. */
  readonly notStaff: (f: Fail) => void;
  readonly signedOut: () => void;
};
export const CtxContext = createContext<Ctx | null>(null);
export function useCtx(): Ctx {
  const c = useContext(CtxContext);
  if (!c) throw new Error('useCtx outside the signed-in shell');
  return c;
}

// ---------------------------------------------------------------- text

export function T({ children, class: cls }: { children: ComponentChildren; class?: string }) {
  return <bdi dir="auto" class={cls}>{children}</bdi>;
}

/** A bilingual name: the main language, and the other one beside it when both exist. */
export function Name({ text, fallback = '', alt = true }: { text: Text | null | undefined; fallback?: string; alt?: boolean }) {
  const n = names(text, fallback);
  return (
    <span class="names">
      <T class="name-main">{n.main}</T>
      {alt && n.alt && <T class="name-alt">{n.alt}</T>}
    </span>
  );
}

// ---------------------------------------------------------------- the mark

export function Mark() {
  return <svg class="brand-mark" viewBox={MARK_SMALL.viewBox} aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: MARK_SMALL.html }} />;
}
export function Brand({ sub = 'command center' }: { sub?: string }) {
  return (
    <div class="brand brand-lg">
      <Mark />
      <div><strong>{PRODUCT.name}</strong><span>{sub} · {PRODUCT.by}</span></div>
    </div>
  );
}

// ---------------------------------------------------------------- icons

const ICONS = {
  refresh: 'M4 4v5h5M16 16v-5h-5M5.1 9a6 6 0 0 1 10.4-2.2L16 7.5M14.9 11a6 6 0 0 1-10.4 2.2L4 12.5',
  close: 'M5 5l10 10M15 5L5 15',
  out: 'M8 5h7v7M15 5l-9 9',
  warn: 'M10 3l8 14H2L10 3zm0 5v4m0 2.5v.5',
  check: 'M4 10.5l4 4 8-9',
  cross: 'M5.5 5.5l9 9M14.5 5.5l-9 9',
  clock: 'M10 5.5V10l3 2M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  dot: 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  chev: 'M7 4l6 6-6 6',
  back: 'M13 4l-6 6 6 6',
  info: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 9.5V14M10 6.5v.2',
  halom: 'M10 3l2.2 4.5 4.8.7-3.5 3.4.8 4.9L10 14.2l-4.3 2.3.8-4.9L3 8.2l4.8-.7L10 3z',
  live: 'M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6.2 13.8a5.4 5.4 0 0 1 0-7.6M13.8 6.2a5.4 5.4 0 0 1 0 7.6',
  lock: 'M6 9V7a4 4 0 0 1 8 0v2M5 9h10v8H5z',
} as const;
export type IconName = keyof typeof ICONS;
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

// ---------------------------------------------------------------- notices, chips, badges

const TONE_ICON: Readonly<Record<Tone, IconName>> = { plain: 'dot', info: 'info', warn: 'warn', bad: 'warn', good: 'check' };

export function Notice({ tone = 'info', children, role }: { tone?: Exclude<Tone, 'plain'>; children: ComponentChildren; role?: 'status' | 'alert' }) {
  return (
    <div class={`notice notice-${tone === 'warn' ? 'warn' : tone}`} role={role ?? (tone === 'bad' ? 'alert' : 'status')}>
      <Icon name={TONE_ICON[tone]} /><div>{children}</div>
    </div>
  );
}

/** A warning as a chip: an icon and words (never colour alone), the hint as its title and for screen readers. */
export function WarningChip({ chip }: { chip: Chip }) {
  return (
    <span class={`wchip wchip-${chip.tone}`} title={chip.hint} data-warning={chip.code}>
      <Icon name={TONE_ICON[chip.tone]} size={12} /><span>{chip.label}</span><span class="sr">: {chip.hint}</span>
    </span>
  );
}

export function Badge({ tone = 'plain', icon, children, data }: { tone?: Tone; icon?: IconName; children: ComponentChildren; data?: string }) {
  return <span class={`badge badge-${tone}`} data-badge={data}>{icon && <Icon name={icon} size={13} />}<span>{children}</span></span>;
}

export function DemoLabel() {
  return <span class="demo-label" title="A demo venue: its traffic is demo traffic, kept out of real totals" data-demo>Demo</span>;
}

/** What a failed load says, with a retry. */
export function LoadError({ fail, retry, what }: { fail: Fail; retry: () => void; what: string }) {
  return (
    <div class="panel pad" data-load-error={fail.kind}>
      <Notice tone="bad">Could not load {what}. {fail.message}</Notice>
      {fail.kind !== 'missing' && <button type="button" class="btn btn-primary" onClick={retry}>Try again</button>}
    </div>
  );
}

// ---------------------------------------------------------------- layout helpers

export function useNarrow(px = 900): boolean {
  const q = `(max-width: ${px - 1}px)`;
  const [narrow, setNarrow] = useState(() => (typeof matchMedia === 'function' ? matchMedia(q).matches : false));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const m = matchMedia(q);
    const on = () => setNarrow(m.matches);
    on(); m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return narrow;
}

/** A link we built ourselves (never a URL that came from data): a new tab for the guest menu. */
export function Ext({ href, children, label, class: cls }: { href: string; children: ComponentChildren; label?: string; class?: string }) {
  return <a class={cls} href={href} aria-label={label} target="_blank" rel="noopener noreferrer">{children}</a>;
}
