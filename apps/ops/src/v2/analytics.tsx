/**
 * Analytics (`ops_analytics`): minute or day series across every venue or one (opens, dish views, adds, suggestions
 * shown, accepted, dismissed), the onboarding funnel of the venues created in the range, and the imports and their
 * exceptions. Real traffic by default; demo traffic only when asked. ADR-007: this page polls (its queries are heavy),
 * whatever the environment's Realtime, and each poll moves the range on to now.
 */
import { useState } from 'preact/hooks';
import { DEMO_SCOPES, isUuid, type DemoScope, type OpsAnalytics, type OpsVenues } from '@mana/contracts';
import { useLive } from './hooks.ts';
import {
  ANALYTICS_NAMES, ANALYTICS_RANGES, DEMO_LABEL, EVENT_LABEL, EXCEPTION_LABEL, IMPORT_SOURCE_LABEL, analyticsQuery, bucketLabel, fmtInt, fmtPct, names,
  type AnalyticsRangeId,
} from './model.ts';
import { Columns, Funnel } from './charts.tsx';
import { Freshness } from './freshness.tsx';
import { LoadError, Notice, useCtx } from './ui.tsx';

/** The most venues the picker lists (the contract's largest page); past it, the page says so. */
export const PICKER_MAX = 500;

export function Analytics({ venue }: { venue: string | null }) {
  const { api } = useCtx();
  const [range, setRange] = useState<AnalyticsRangeId>('24h');
  const [demo, setDemo] = useState<DemoScope>('exclude');
  const venueId = venue && isUuid(venue) ? venue.toLowerCase() : null;
  const list = useLive<OpsVenues>(() => api.venues({ sort: 'name', limit: PICKER_MAX, demo: 'include' }), [], { poll: false });
  // the answer keeps the range it was asked for, so the labels always describe the numbers on screen
  const live = useLive<{ range: AnalyticsRangeId; a: OpsAnalytics }>(async () => {
    const r = await api.analytics(analyticsQuery(range, Date.now(), { venueId, demo }));
    return r.ok ? { ok: true, data: { range, a: r.data } } : r;
  }, [range, demo, venueId]);
  const venues = list.data?.venues ?? [];
  const pick = (id: string) => { location.hash = id ? `#/analytics?venue=${encodeURIComponent(id)}` : '#/analytics'; };
  const a = live.data?.a ?? null;
  // every label describes the answer on screen (its venue, traffic and range), never the question still loading
  const chosen = a?.venueId ? venues.find((v) => v.id === a.venueId) ?? null : null;
  const r = ANALYTICS_RANGES.find((x) => x.id === live.data?.range) ?? ANALYTICS_RANGES[0];
  const per = r.resolution === 'minute' ? 'per minute' : 'per day';

  return (
    <div class="stack" data-page="analytics">
      <div class="page-head">
        <h1 class="page-title">Analytics {a && <span class="muted count" data-analytics-of>· {chosen ? names(chosen.name, chosen.slug).main : a.venueId ? 'one venue' : 'all venues'}</span>}</h1>
        <Freshness live={live} rolledUpAt={a?.rolledUpAt ?? null} />
      </div>
      <div class="filters" role="group" aria-label="What to show">
        <label class="field field-inline"><span class="sr">Venue</span>
          <select value={venueId ?? ''} onChange={(e) => pick(e.currentTarget.value)} data-filter="venue" aria-label="Venue">
            <option value="">All venues</option>
            {venueId && !venues.some((v) => v.id === venueId) && <option value={venueId}>The venue opened from its page</option>}
            {venues.map((v) => <option key={v.id} value={v.id}>{names(v.name, v.slug).main}{v.isDemo ? ' (demo)' : ''}</option>)}
          </select>
        </label>
        <div class="chips" role="group" aria-label="Range">
          {ANALYTICS_RANGES.map((x) => (
            <button key={x.id} type="button" class={'chip' + (range === x.id ? ' is-on' : '')} aria-pressed={range === x.id} onClick={() => setRange(x.id)} data-range={x.id}>{x.label}</button>
          ))}
        </div>
        <label class="field field-inline"><span class="sr">Traffic</span>
          <select value={demo} onChange={(e) => setDemo(e.currentTarget.value as DemoScope)} data-filter="demo" aria-label="Traffic">
            {DEMO_SCOPES.map((d) => <option key={d} value={d}>{DEMO_LABEL[d]}</option>)}
          </select>
        </label>
      </div>
      {list.data && list.data.total > list.data.venues.length && (
        <p class="muted small" data-picker-capped>The venue list holds the first {fmtInt(list.data.venues.length)} of {fmtInt(list.data.total)} venues by name; open any other one’s
          analytics from its own page (Clients, then the venue, then “Analytics”).</p>
      )}
      {a && chosen?.isDemo && a.demo === 'exclude' && (
        <Notice tone="info">{names(chosen.name, chosen.slug).main} is a demo venue: its guests are demo traffic. Choose “{DEMO_LABEL.include}” or “{DEMO_LABEL.only}” to see them.</Notice>
      )}
      {!a && live.fail && <LoadError fail={live.fail} retry={() => void live.refresh()} what="the analytics" />}
      {a && live.fail && <Notice tone="bad">Refresh failed: {live.fail.message} Showing the last answer.</Notice>}
      {!a && !live.fail && <p class="boot" role="status">Loading the analytics…</p>}
      {a && (
        <div class="stack" data-analytics-answer={`${a.venueId ?? 'all'}|${a.demo}`}>
          <section class="tiles tiles-7" aria-label="Totals in this range" data-analytics-totals>
            {ANALYTICS_NAMES.map((n) => (
              <div key={n} class="tile" data-kpi={n}><span class="tile-label">{EVENT_LABEL[n].title}</span><span class="tile-value">{fmtInt(a.totals[n] ?? 0)}</span></div>
            ))}
            <div class="tile" data-kpi="acceptance"><span class="tile-label">Suggestions accepted</span>
              <span class="tile-value">{fmtPct(a.totals.suggestion_accepted ?? 0, a.totals.suggestion_shown ?? 0)}</span><span class="tile-note">of those shown</span></div>
          </section>
          <section class="charts" aria-label={`Guest events ${per}`}>
            {ANALYTICS_NAMES.map((n) => (
              <div key={n} class="panel">
                <Columns id={n} title={EVENT_LABEL[n].title} values={a.series[n] ?? a.buckets.map(() => 0)} per={`${r.label.toLowerCase()}, ${per}`}
                  labels={a.buckets.map((b) => bucketLabel(b, a.resolution))} longLabels={a.buckets.map((b) => bucketLabel(b, a.resolution, true))}
                  unit={{ one: EVENT_LABEL[n].one, many: EVENT_LABEL[n].many }} axis={`${EVENT_LABEL[n].many} ${per}`} empty="No traffic yet in this range." />
              </div>
            ))}
          </section>
          <div class="two">
            <section class="panel" aria-labelledby="funnel-h">
              <div class="panel-head"><h2 id="funnel-h">Onboarding funnel</h2><p class="muted small">Of the venues created in this range: how many imported a menu, published, and were approved.</p></div>
              <Funnel empty="No venue was created in this range." steps={[
                { id: 'created', label: 'Signed up', value: a.funnel.created }, { id: 'imported', label: 'Imported a menu', value: a.funnel.imported },
                { id: 'published', label: 'Published', value: a.funnel.published }, { id: 'approved', label: 'Approved', value: a.funnel.approved },
              ]} />
            </section>
            <section class="panel" aria-labelledby="imports-h" data-imports>
              <div class="panel-head"><h2 id="imports-h">Imports</h2>
                <p class="muted small">The imports started in this range{a.imports.total ? `: ${fmtPct(a.imports.withFix, a.imports.total)} had something to fix, ${fmtPct(a.imports.failed, a.imports.total)} failed` : ''}.</p></div>
              {a.imports.total === 0 ? <div class="chart-empty" data-empty><p>No import in this range.</p></div> : (
                <div class="pad stack-s">
                  <dl class="strip strip-s">
                    <div><dt>Started</dt><dd>{fmtInt(a.imports.total)}</dd></div><div><dt>Read</dt><dd>{fmtInt(a.imports.parsed)}</dd></div>
                    <div><dt>Applied</dt><dd>{fmtInt(a.imports.applied)}</dd></div><div><dt>Discarded</dt><dd>{fmtInt(a.imports.discarded)}</dd></div>
                    <div><dt>Failed</dt><dd>{fmtInt(a.imports.failed)}</dd></div><div><dt>Exceptions</dt><dd>{fmtInt(a.imports.exceptions)}</dd></div>
                  </dl>
                  <table class="grid small-grid">
                    <thead><tr><th scope="col">Source</th><th scope="col" class="num">Started</th><th scope="col" class="num">Applied</th><th scope="col" class="num">Failed</th><th scope="col" class="num">To fix</th></tr></thead>
                    <tbody>{a.imports.bySource.map((s) => (
                      <tr key={s.source}><td>{IMPORT_SOURCE_LABEL[s.source]}</td><td class="num">{fmtInt(s.total)}</td><td class="num">{fmtInt(s.applied)}</td><td class="num">{fmtInt(s.failed)}</td><td class="num">{fmtInt(s.withFix)}</td></tr>
                    ))}</tbody>
                  </table>
                  {a.imports.byCode.length > 0 && <p class="small">{a.imports.byCode.map((c) => <span key={c.code} class="tag">{EXCEPTION_LABEL[c.code] ?? c.code} × {fmtInt(c.n)}</span>)}</p>}
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
