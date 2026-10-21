/**
 * Charts of the v2 back office, drawn by hand like v1's (src/charts.jsx): one series per chart in the one series colour
 * and no legend box (the title names it), thin columns with a rounded data end on the baseline, a hairline solid grid,
 * labelled axes, one direct label (the peak), a hover and keyboard read-out, and a table twin. A chart with nothing to
 * show says so instead of drawing an empty frame; no number is ever made up.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { fmtInt, fmtPct } from './model.ts';

/**
 * The plot's width, measured whenever the plot is in the page: a callback ref, so a chart that starts empty (no plot)
 * measures when its first data arrives on a poll, and again after the table view gives the plot back.
 */
function useWidth(): [(el: HTMLElement | null) => void, number] {
  const [w, setW] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    ro.current?.disconnect();
    ro.current = null;
    if (!el) return;
    const measure = () => setW(Math.floor(el.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'function') { ro.current = new ResizeObserver(measure); ro.current.observe(el); }
  }, []);
  useEffect(() => () => ro.current?.disconnect(), []);
  return [ref, w];
}

/** The next round number at or above v, for the y axis (2, 4, 5, 10, 20, …). */
export function niceMax(v: number): number {
  if (v <= 4) return Math.max(2, v % 2 ? v + 1 : v);
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 4, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const columnPath = (x: number, y: number, w: number, h: number): string => {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

export type ColumnsProps = {
  readonly id: string;
  readonly title: string;
  readonly labels: readonly string[];
  /** The long form of each label (tooltip, table). */
  readonly longLabels: readonly string[];
  readonly values: readonly number[];
  readonly unit: { readonly one: string; readonly many: string };
  /** Under the title: the range and what one bucket is ("last hour, per minute"). */
  readonly per: string;
  /** The y axis's title ("opens per minute"). */
  readonly axis: string;
  readonly empty: string;
};

export function Columns({ id, title, labels, longLabels, values, unit, per, axis, empty }: ColumnsProps) {
  const [box, width] = useWidth();
  const [active, setActive] = useState(-1);
  const [asTable, setAsTable] = useState(false);
  const total = values.reduce((s, v) => s + v, 0);
  const max = values.reduce((m, v) => Math.max(m, v), 0);
  const word = (n: number) => (n === 1 ? unit.one : unit.many);
  const H = 156, padL = 34, padR = 8, padT = 24, padB = 34;
  const W = Math.max(width, 240);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const top = niceMax(max);
  const n = Math.max(1, values.length);
  const band = plotW / n;
  // a column per bucket while columns can be told apart; a dense series (a day of minutes) is a line over a light area
  const dense = band < 4;
  const barW = Math.max(1, Math.min(18, band - 2));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const cx = (i: number) => padL + band * i + band / 2;
  const ticks = top % 2 === 0 ? [0, top / 2, top] : [0, top];
  const peak = values.indexOf(max);
  const every = Math.max(1, Math.ceil(values.length / Math.max(2, Math.floor(plotW / 64))));
  const line = dense ? values.map((v, i) => `${i ? 'L' : 'M'}${cx(i).toFixed(1)},${y(v).toFixed(1)}`).join('') : '';
  const area = dense ? `${line}L${cx(n - 1).toFixed(1)},${y(0)}L${cx(0).toFixed(1)},${y(0)}Z` : '';
  const pointAt = (e: PointerEvent) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    setActive(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(n - 1, (a < 0 ? n - 1 : a) + (e.key === 'ArrowRight' ? 1 : -1))));
    } else if (e.key === 'Home') { e.preventDefault(); setActive(0); } else if (e.key === 'End') { e.preventDefault(); setActive(n - 1); } else if (e.key === 'Escape') setActive(-1);
  };
  const tipX = active >= 0 ? cx(active) : 0;
  return (
    <figure class="chart" data-chart={id}>
      <figcaption class="chart-head">
        <div>
          <h3>{title}</h3>
          <p class="chart-sub"><strong data-total>{fmtInt(total)}</strong> {word(total)} · {per}</p>
        </div>
        {total > 0 && <button type="button" class="btn btn-ghost btn-sm" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>{asTable ? 'Chart' : 'Table'}</button>}
      </figcaption>
      {total === 0 ? (
        <div class="chart-empty" data-empty><p>{empty}</p></div>
      ) : asTable ? (
        <div class="chart-table">
          <table>
            <thead><tr><th scope="col">Time</th><th scope="col" class="num">{unit.many}</th></tr></thead>
            <tbody>{values.map((v, i) => (v > 0 ? <tr key={i}><td>{longLabels[i]}</td><td class="num">{fmtInt(v)}</td></tr> : null))}</tbody>
          </table>
        </div>
      ) : (
        <div class="chart-plot" ref={box} tabIndex={0} role="group" onKeyDown={onKey} onBlur={() => setActive(-1)} onPointerLeave={() => setActive(-1)}
          aria-label={`${title}: ${fmtInt(total)} ${word(total)}, ${per}. Use the left and right arrow keys to read each column.`}>
          {width > 0 && (
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
              <text class="axis-title" x={padL} y={11} text-anchor="start">{axis}</text>
              {ticks.map((t) => (
                <g key={t}>
                  <line class={t === 0 ? 'axis' : 'grid'} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
                  <text class="tick" x={padL - 6} y={y(t) + 3.5} text-anchor="end">{fmtInt(t)}</text>
                </g>
              ))}
              {dense ? (
                <g>
                  <path class="area" d={area} />
                  <path class="line" d={line} />
                  {active >= 0 && <circle class="dot" cx={cx(active)} cy={y(values[active] ?? 0)} r={4} />}
                  {active < 0 && max > 0 && <text class="val" x={Math.min(W - padR - 10, Math.max(padL + 10, cx(peak)))} y={y(max) - 6} text-anchor="middle">{fmtInt(max)}</text>}
                  <rect class="hit" x={padL} y={padT} width={plotW} height={plotH + 18} onPointerMove={pointAt} onPointerDown={pointAt} />
                </g>
              ) : values.map((v, i) => {
                const x = padL + band * i + (band - barW) / 2;
                const h = v > 0 ? Math.max(2, (v / top) * plotH) : 0;
                return (
                  <g key={i}>
                    {h > 0 && <path class={'col' + (i === active ? ' is-active' : '')} d={columnPath(x, padT + plotH - h, barW, h)} />}
                    {i === peak && active < 0 && <text class="val" x={Math.min(W - padR - 10, Math.max(padL + 10, x + barW / 2))} y={padT + plotH - h - 5} text-anchor="middle">{fmtInt(v)}</text>}
                    <rect class="hit" x={padL + band * i} y={padT} width={band} height={plotH + 18} onPointerMove={() => setActive(i)} onPointerDown={() => setActive(i)} />
                  </g>
                );
              })}
              {labels.map((l, i) => ((labels.length - 1 - i) % every === 0 ? (
                <text key={i} class="tick" x={cx(i)} y={padT + plotH + 14} text-anchor={i === labels.length - 1 ? 'end' : 'middle'}
                  dx={i === labels.length - 1 ? band / 2 : 0}>{l}</text>
              ) : null))}
              <text class="axis-title" x={W - padR} y={H - 3} text-anchor="end">time, Israel</text>
            </svg>
          )}
          {active >= 0 && (
            <div class={'tip' + (tipX > W * 0.6 ? ' tip-left' : '')} style={{ left: `${tipX}px` }} role="status">
              <strong>{fmtInt(values[active] ?? 0)}</strong> {word(values[active] ?? 0)}<br /><span>{longLabels[active]}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

/** Horizontal bars for an ordered funnel: each step's count and its share of the first step. */
export function Funnel({ steps, empty }: { steps: ReadonlyArray<{ id: string; label: string; value: number }>; empty: string }) {
  const first = steps[0]?.value ?? 0;
  if (!first) return <div class="chart-empty" data-empty><p>{empty}</p></div>;
  return (
    <ol class="funnel" data-funnel>
      {steps.map((s, i) => (
        <li key={s.id} class="fn-row" data-step={s.id}>
          <div class="fn-label"><span class="fn-n">{i + 1}</span><span>{s.label}</span></div>
          <div class="fn-track">
            <div class="fn-bar" style={{ width: `${s.value ? Math.max(0.6, (s.value / first) * 100) : 0}%` }} />
            <span class="fn-val"><strong data-value>{fmtInt(s.value)}</strong> {i > 0 && <span class="muted">{fmtPct(s.value, first)} of {steps[0]?.label.toLowerCase()}</span>}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
