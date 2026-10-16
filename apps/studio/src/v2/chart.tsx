// A column chart drawn by hand in SVG, in the app's language: one series, one baseline, a clean axis top, columns at
// most 24 px wide with a 2 px gap and a rounded top, the highest and the latest value written on the chart and every
// value one tap (or hover) away. A day a cap cut short is drawn lighter and labelled "at least". The numbers are the
// database's (data/dashboard.ts); the table under the chart lists them all.
import { useState } from 'preact/hooks';
import { axisTop, labelledBars, type Bar } from './data/dashboard.ts';
import { t } from './i18n.ts';

const W = 320, H = 148, TOP = 20, BOTTOM = 22, LEFT = 0;
const PLOT = H - TOP - BOTTOM;

/** The top-rounded column: 4 px radius at the data end, square at the baseline. */
function column(x: number, w: number, h: number): string {
  const y = TOP + PLOT - h, r = Math.min(4, w / 2, h);
  return `M${x} ${TOP + PLOT}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${TOP + PLOT}Z`;
}

export function Columns({ bars, title, tick, long, fmt, id }: {
  bars: readonly Bar[];
  title: string;
  /** The label under a bar, or null for none (the screen picks a few). */
  tick: (b: Bar, i: number) => string | null;
  /** The bar in words, for its tooltip and the readout: "Thursday 16 October: 12". */
  long: (b: Bar) => string;
  fmt: (n: number) => string;
  id: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const top = axisTop(Math.max(0, ...bars.map((b) => b.value)));
  const slot = (W - LEFT) / Math.max(1, bars.length);
  const bw = Math.max(1, Math.min(24, slot - 2));
  const labelled = labelledBars(bars);
  const peak = bars.reduce((m, b, i) => (b.value > (bars[m]?.value ?? -1) ? i : m), 0);
  const summary = bars.length && bars[peak]!.value > 0 ? t('chart.summary', { title, top: long(bars[peak]!) }) : title;
  return (
    <figure class="chart-fig" data-chart={id}>
      <p class="chart-readout fine" aria-live="polite">{picked !== null && bars[picked] ? long(bars[picked]!) : '\u00a0'}</p>
      <svg class="chart cols" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} direction="ltr">
        <line class="grid" x1={0} x2={W} y1={TOP} y2={TOP} />
        <text class="tick tick-y" x={W} y={TOP - 6} text-anchor="end">{fmt(top)}</text>
        {bars.map((b, i) => {
          const x = LEFT + i * slot + (slot - bw) / 2;
          const h = b.value > 0 ? Math.max(2, (b.value / top) * PLOT) : 0;
          const label = labelled.has(i) ? (b.capped ? t('chart.atLeast', { n: fmt(b.value) }) : fmt(b.value)) : null;
          const tk = tick(b, i);
          return (
            <g key={b.at} data-bar={b.at} data-v={b.value} data-capped={b.capped ? 'true' : undefined}>
              {h > 0 && <path d={column(x, bw, h)} class={'col' + (b.capped ? ' col-capped' : '') + (picked === i ? ' col-picked' : '')} />}
              {label && <text class="col-label" x={x + bw / 2} y={TOP + PLOT - h - 5} text-anchor="middle">{label}</text>}
              {tk && <text class="tick" x={x + bw / 2} y={H - 6} text-anchor="middle">{tk}</text>}
              <rect class="col-hit" x={LEFT + i * slot} y={0} width={slot} height={TOP + PLOT} onClick={() => setPicked(picked === i ? null : i)}><title>{long(b)}</title></rect>
            </g>
          );
        })}
        <line class="baseline" x1={0} x2={W} y1={TOP + PLOT} y2={TOP + PLOT} />
      </svg>
    </figure>
  );
}
