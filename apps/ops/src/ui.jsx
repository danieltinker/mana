// Small shared pieces. User-supplied text always goes through <T> (a <bdi dir="auto">): Hebrew and English read
// correctly side by side, and nothing a stranger typed can reorder the text around it. No innerHTML anywhere.
import { useEffect, useState } from 'preact/hooks';
import { stageLabel, STAGE_RANK, planText } from './model.js';

export function T({ children, class: cls }) {
  return <bdi dir="auto" class={cls}>{children}</bdi>;
}

export function useNarrow(px = 700) {
  const q = `(max-width: ${px - 1}px)`;
  const [narrow, setNarrow] = useState(() => (typeof matchMedia === 'function' ? matchMedia(q).matches : false));
  useEffect(() => {
    if (typeof matchMedia !== 'function') return undefined;
    const m = matchMedia(q); const on = () => setNarrow(m.matches);
    on(); m.addEventListener('change', on); return () => m.removeEventListener('change', on);
  }, [q]);
  return narrow;
}

// External link we built ourselves (https / mailto / tel only). Never pass a URL that came from data.
export function Ext({ href, children, label, class: cls }) {
  const web = /^https?:\/\//.test(href) || href.startsWith('../');
  return <a class={cls} href={href} aria-label={label} {...(web ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{children}</a>;
}

const ICONS = {
  refresh: 'M4 4v5h5M16 16v-5h-5M5.1 9a6 6 0 0 1 10.4-2.2L16 7.5M14.9 11a6 6 0 0 1-10.4 2.2L4 12.5',
  close: 'M5 5l10 10M15 5L5 15',
  out: 'M8 5h7v7M15 5l-9 9',
  download: 'M10 3v10m0 0l-4-4m4 4l4-4M4 16h12',
  warn: 'M10 3l8 14H2L10 3zm0 5v4m0 2.5v.5',
  check: 'M4 10.5l4 4 8-9',
  cross: 'M5.5 5.5l9 9M14.5 5.5l-9 9',
  clock: 'M10 5.5V10l3 2M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  pause: 'M7 5v10M13 5v10',
  dot: 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  chev: 'M7 4l6 6-6 6',
  sort: 'M6 8l4-4 4 4M6 12l4 4 4-4',
  info: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM10 9.5V14M10 6.5v.2',
};
export function Icon({ name, size = 16 }) {
  return (
    <svg class="icon" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d={ICONS[name] || ICONS.dot} />
    </svg>
  );
}

// Stage = a word plus five pips (how far along), tone as a third cue. Never colour alone.
export function StageBadge({ b }) {
  const rank = STAGE_RANK[b.base];
  const tone = b.stalled ? 'warn' : b.base === 'live' ? 'good' : b.base === 'published' ? 'bad' : 'plain';
  return (
    <span class="stage" data-stage={b.stage}>
      <span class={`badge badge-${tone}`}>
        {b.stalled ? <Icon name="pause" size={13} /> : (
          <span class="pips" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <i key={i} class={i <= rank ? 'on' : ''} />)}</span>
        )}
        <span>{b.stalled ? 'Stalled' : stageLabel(b.base)}</span>
      </span>
      {b.stalled && <span class="sub">at {stageLabel(b.base).toLowerCase()} · {b.idleDays} days idle</span>}
      {!b.stalled && b.offlineWhy && <span class="sub">{b.offlineWhy}</span>}
    </span>
  );
}

export function PlanBadge({ b }) {
  const t = planText(b);
  const tone = b.planState === 'expired' || b.planState === 'suspended' ? 'bad' : b.trialSoon ? 'warn' : b.planState === 'pending' ? 'plain' : 'good';
  const icon = tone === 'bad' ? 'cross' : tone === 'warn' ? 'clock' : tone === 'good' ? 'check' : 'dot';
  return <span class={`badge badge-${tone}`} data-plan-state={b.planState}><Icon name={icon} size={13} /><span>{t.plan} · {t.state}</span></span>;
}

export function Notice({ tone = 'info', children, role }) {
  return <div class={`notice notice-${tone}`} role={role || (tone === 'bad' ? 'alert' : 'status')}><Icon name={tone === 'good' ? 'check' : tone === 'info' ? 'info' : 'warn'} /><div>{children}</div></div>;
}

export function download(name, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
