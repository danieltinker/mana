// Two chart forms, drawn by hand (no chart library): a 30-day column chart and the funnel bars.
// Rules followed (dataviz skill): one series = one colour and no legend box, thin marks with a rounded data end,
// hairline solid grid, sparse direct labels, a hover + keyboard read-out, and a table twin for every chart.
import { useEffect, useRef, useState } from 'preact/hooks';
import { fmtDay, fmtInt } from './model.js';

function useWidth(ref) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const measure = () => setW(Math.floor(el.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }
    const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
  }, []);
  return w;
}

function niceMax(v) {
  if (v <= 4) return Math.max(2, v % 2 ? v + 1 : v);
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 4, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

// A column with a 4px rounded top and a square foot on the baseline.
function columnPath(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function DayColumns({ id, title, series, unit, units, emptyText }) {
  const box = useRef(null);
  const width = useWidth(box);
  const [active, setActive] = useState(-1);
  const [asTable, setAsTable] = useState(false);
  const total = series.reduce((s, d) => s + d.value, 0);
  const max = series.reduce((m, d) => Math.max(m, d.value), 0);
  const word = (n) => (n === 1 ? unit : units);

  const H = 168, padL = 30, padR = 8, padT = 16, padB = 22;
  const W = Math.max(width, 240);
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const top = niceMax(max);
  const band = plotW / series.length;
  const barW = Math.max(2, Math.min(24, band - 2));
  const y = (v) => padT + plotH - (v / top) * plotH;
  const ticks = top % 2 === 0 ? [0, top / 2, top] : [0, top];
  const peak = series.findIndex((d) => d.value === max);
  const labelEvery = W < 460 ? 10 : 7;

  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(series.length - 1, (a < 0 ? series.length - 1 : a) + (e.key === 'ArrowRight' ? 1 : -1))));
    } else if (e.key === 'Home') { e.preventDefault(); setActive(0); } else if (e.key === 'End') { e.preventDefault(); setActive(series.length - 1); }
    else if (e.key === 'Escape') setActive(-1);
  };
  const a = active >= 0 ? series[active] : null;
  const tipX = a ? padL + band * active + band / 2 : 0;

  return (
    <figure class="chart" data-chart={id}>
      <figcaption class="chart-head">
        <div>
          <h3>{title}</h3>
          <p class="chart-sub">Last 30 days, per day (Israel time) · <strong data-total>{fmtInt(total)}</strong> {word(total)} in total</p>
        </div>
        {total > 0 && (
          <button type="button" class="btn btn-ghost btn-sm" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
            {asTable ? 'Show chart' : 'Show as table'}
          </button>
        )}
      </figcaption>
      {total === 0 ? (
        <div class="chart-empty" data-empty><p>{emptyText}</p></div>
      ) : asTable ? (
        <div class="chart-table">
          <table>
            <thead><tr><th scope="col">Day</th><th scope="col" class="num">{units}</th></tr></thead>
            <tbody>{series.map((d) => <tr key={d.day}><td>{fmtDay(d.day)}</td><td class="num">{fmtInt(d.value)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div class="chart-plot" ref={box} tabIndex={0} role="group" aria-label={`${title}: ${fmtInt(total)} ${word(total)} in the last 30 days. Use the left and right arrow keys to read each day.`}
          onKeyDown={onKey} onBlur={() => setActive(-1)} onPointerLeave={() => setActive(-1)}>
          {width > 0 && (
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
              {ticks.map((t) => (
                <g key={t}>
                  <line class={t === 0 ? 'axis' : 'grid'} x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
                  <text class="tick" x={padL - 6} y={y(t) + 3.5} text-anchor="end">{fmtInt(t)}</text>
                </g>
              ))}
              {series.map((d, i) => {
                const x = padL + band * i + (band - barW) / 2;
                const h = d.value > 0 ? Math.max(2, (d.value / top) * plotH) : 0;
                return (
                  <g key={d.day}>
                    {h > 0 && <path class={'col' + (i === active ? ' is-active' : '')} d={columnPath(x, padT + plotH - h, barW, h)} />}
                    {i === peak && d.value > 0 && active < 0 && (
                      <text class="val" x={Math.min(W - padR - 10, Math.max(padL + 10, x + barW / 2))} y={padT + plotH - h - 5} text-anchor="middle">{fmtInt(d.value)}</text>
                    )}
                    <rect class="hit" x={padL + band * i} y={padT} width={band} height={plotH + padB} onPointerMove={() => setActive(i)} onPointerDown={() => setActive(i)} />
                  </g>
                );
              })}
              {series.map((d, i) => ((series.length - 1 - i) % labelEvery === 0 ? (
                <text key={d.day} class="tick" x={padL + band * i + band / 2} y={H - 6}
                  text-anchor={i === series.length - 1 ? 'end' : 'middle'} dx={i === series.length - 1 ? band / 2 : 0}>
                  {i === series.length - 1 ? 'today' : fmtDay(d.day, true)}
                </text>
              ) : null))}
            </svg>
          )}
          {a && (
            <div class={'tip' + (tipX > W * 0.6 ? ' tip-left' : '')} style={{ left: tipX + 'px' }} role="status">
              <strong>{fmtInt(a.value)}</strong> {word(a.value)}<br /><span>{fmtDay(a.day)}</span>
            </div>
          )}
        </div>
      )}
    </figure>
  );
}

export function Funnel({ steps }) {
  const top = steps[0].value;
  if (!top) {
    return <div class="chart-empty" data-empty><p>Nobody has signed up yet. The funnel fills in as soon as the first owner creates an account.</p></div>;
  }
  return (
    <ol class="funnel" data-funnel>
      {steps.map((s, i) => {
        const pct = Math.round(s.share * 100);
        let change = null;
        if (i > 0) {
          if (s.drop > 0) change = <span class="fn-drop" data-drop>&minus;{fmtInt(s.drop)} <span class="muted">({Math.round(s.dropPct * 100)}% dropped here)</span></span>;
          else if (s.drop === 0) change = <span class="muted" data-drop>no drop</span>;
          else change = <span class="muted" data-drop>+{fmtInt(-s.drop)} more than the step above (that step is optional)</span>;
        }
        return (
          <li key={s.id} class="fn-row" data-step={s.id}>
            <div class="fn-label">
              <span class="fn-n">{i + 1}</span>
              <span>{s.label}</span>
            </div>
            <div class="fn-track">
              <div class="fn-bar" style={{ width: (s.value ? Math.max(0.6, s.share * 100) : 0) + '%' }} />
              <span class="fn-val"><strong data-value>{fmtInt(s.value)}</strong> <span class="muted">{i === 0 ? '' : `${pct}% of sign-ups`}</span></span>
            </div>
            <div class="fn-change">{change}</div>
          </li>
        );
      })}
    </ol>
  );
}
