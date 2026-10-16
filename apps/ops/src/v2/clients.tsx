/**
 * Clients: every venue (`ops_venues`), with its onboarding stage and blockers, approval, last publish, opens, suggestion
 * acceptance, photos, plan and trial, the owner's last sign-in, and its warnings as chips. Filters and sorts are the
 * contract's and run in the database. Live: Realtime on the minute rollups' menu opens (ADR-007), else polling.
 * A desk screen (a dense table) that turns into cards on a phone.
 */
import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  ENTITLEMENT_STATUSES, ONBOARDING_STEPS, OPS_SORTS, OPS_WARNINGS, REVIEW_STATES, type DemoScope, type EntitlementStatus, type OnboardingStep,
  type OpsSort, type OpsVenueRow, type OpsVenues, type OpsVenuesQuery, type OpsWarning, type ReviewState,
} from '@mana/contracts';
import { useLive } from './hooks.ts';
import {
  PLAN_LABEL, PLAN_STATE_LABEL, REVIEW_LABEL, STEP_LABEL, WARNING_LABEL, ago, fmtDate, fmtInt, fmtPct, stageLabel, warningChips,
} from './model.ts';
import { realtime } from './session.ts';
import { Badge, DemoLabel, Icon, LoadError, Name, Notice, WarningChip, useCtx, useNarrow } from './ui.tsx';
import { Freshness } from './freshness.tsx';

const SORT_LABEL: Readonly<Record<OpsSort, string>> = { created: 'Newest first', activity: 'Latest activity', opens_today: 'Most opens today', name: 'Name A–Z' };
const DEMO_SCOPE: ReadonlyArray<{ id: DemoScope; label: string }> = [
  { id: 'include', label: 'Real and demo (labelled)' }, { id: 'exclude', label: 'Real venues only' }, { id: 'only', label: 'Demo venues only' },
];
const PAGE = 100;

type Filters = { q: string; stage: OnboardingStep | 'complete' | ''; warning: OpsWarning | ''; review: ReviewState | ''; planState: EntitlementStatus | ''; demo: DemoScope; sort: OpsSort };
const EMPTY: Filters = { q: '', stage: '', warning: '', review: '', planState: '', demo: 'include', sort: 'created' };

/** The filters as the contract's query (empty ones left out). */
export function queryOf(f: Filters, offset: number): OpsVenuesQuery {
  const q = f.q.trim();
  return {
    ...(q ? { q: q.slice(0, 80) } : {}), ...(f.stage ? { stage: f.stage } : {}), ...(f.warning ? { warning: f.warning } : {}),
    ...(f.review ? { review: f.review } : {}), ...(f.planState ? { planState: f.planState } : {}),
    demo: f.demo, sort: f.sort, limit: PAGE, ...(offset ? { offset } : {}),
  };
}

export function Clients() {
  const { api, conn } = useCtx();
  const narrow = useNarrow(1100);
  const [f, setF] = useState<Filters>(EMPTY);
  const [typed, setTyped] = useState('');
  const [offset, setOffset] = useState(0);
  // search as you type, once the typing pauses
  useEffect(() => { const t = setTimeout(() => { setF((x) => ({ ...x, q: typed })); setOffset(0); }, 250); return () => clearTimeout(t); }, [typed]);
  const query = useMemo(() => queryOf(f, offset), [f, offset]);
  const subscribe = useMemo(() => realtime(conn.client, 'clients', [{ table: 'rollups_minute', filter: 'name=eq.menu_opened' }]), [conn]);
  const live = useLive<OpsVenues>(() => api.venues(query), [JSON.stringify(query)], { subscribe });
  const set = (patch: Partial<Filters>) => { setF((x) => ({ ...x, ...patch })); setOffset(0); };
  const filtered = JSON.stringify({ ...f, q: typed }) !== JSON.stringify(EMPTY);
  const d = live.data;

  return (
    <div class="stack" data-page="clients">
      <div class="page-head">
        <h1 class="page-title">Clients {d && <span class="muted count" data-count>{fmtInt(d.total)}{d.total !== d.totals.venues + d.totals.demoVenues ? ` of ${fmtInt(d.totals.venues + d.totals.demoVenues)}` : ''}</span>}</h1>
        <Freshness live={live} rolledUpAt={d?.rolledUpAt ?? null} />
      </div>
      {d && <Totals d={d} />}
      <div class="filters" role="group" aria-label="Find and filter venues">
        <label class="field field-inline search"><span class="sr">Search</span>
          <input type="search" placeholder="Search a name (either language) or a slug" maxLength={80} value={typed} onInput={(e) => setTyped(e.currentTarget.value)} data-search />
        </label>
        <Select label="Onboarding stage" value={f.stage} onChange={(v) => set({ stage: v as Filters['stage'] })} data="stage"
          options={[['', 'Any stage'], ...ONBOARDING_STEPS.map((s): [string, string] => [s, `At: ${STEP_LABEL[s]}`]), ['complete', 'Onboarding complete']]} />
        <Select label="Warning" value={f.warning} onChange={(v) => set({ warning: v as Filters['warning'] })} data="warning"
          options={[['', 'Any warnings'], ...OPS_WARNINGS.map((w): [string, string] => [w, WARNING_LABEL(w)])]} />
        <Select label="Approval" value={f.review} onChange={(v) => set({ review: v as Filters['review'] })} data="review"
          options={[['', 'Any approval'], ...REVIEW_STATES.map((r): [string, string] => [r, REVIEW_LABEL[r]])]} />
        <Select label="Plan" value={f.planState} onChange={(v) => set({ planState: v as Filters['planState'] })} data="plan"
          options={[['', 'Any plan state'], ...ENTITLEMENT_STATUSES.map((s): [string, string] => [s, `Plan ${PLAN_STATE_LABEL[s]}`])]} />
        <Select label="Demo venues" value={f.demo} onChange={(v) => set({ demo: v as DemoScope })} data="demo" options={DEMO_SCOPE.map((x): [string, string] => [x.id, x.label])} />
        <Select label="Sort" value={f.sort} onChange={(v) => set({ sort: v as OpsSort })} data="sort" options={OPS_SORTS.map((s): [string, string] => [s, SORT_LABEL[s]])} />
        {filtered && <button type="button" class="link" onClick={() => { setTyped(''); set(EMPTY); }} data-clear>Clear</button>}
      </div>
      {!d && live.fail && <LoadError fail={live.fail} retry={() => void live.refresh()} what="the clients" />}
      {d && live.fail && <Notice tone="bad">Refresh failed: {live.fail.message} Showing the last answer.</Notice>}
      {!d && !live.fail && <p class="boot" role="status">Loading the clients…</p>}
      {d && (
        <div class={live.busy ? 'is-stale' : ''}>
          {d.venues.length === 0 ? (
            <div class="panel pad empty" data-empty>
              <p>{filtered ? 'No venue matches these filters.' : 'No venue yet. When an owner creates one in the owner app it appears here.'}</p>
            </div>
          ) : narrow ? (
            <ul class="cards" data-cards="clients">{d.venues.map((v) => <Card key={v.id} v={v} now={Date.now()} />)}</ul>
          ) : (
            <Table venues={d.venues} now={Date.now()} />
          )}
          {d.total > PAGE && (
            <div class="row pager">
              <button type="button" class="btn btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</button>
              <span class="muted small">{fmtInt(offset + 1)}–{fmtInt(Math.min(offset + PAGE, d.total))} of {fmtInt(d.total)}</span>
              <button type="button" class="btn btn-sm" disabled={offset + PAGE >= d.total} onClick={() => setOffset(offset + PAGE)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options, data }: { label: string; value: string; onChange: (v: string) => void; options: ReadonlyArray<[string, string]>; data: string }) {
  return (
    <label class="field field-inline"><span class="sr">{label}</span>
      <select value={value} onChange={(e) => onChange(e.currentTarget.value)} data-filter={data} aria-label={label}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function Totals({ d }: { d: OpsVenues }) {
  const t = d.totals;
  const tiles: ReadonlyArray<[string, string, number, string]> = [
    ['venues', 'Venues', t.venues, 'real venues'], ['live', 'Live', t.live, 'published and approved'],
    ['awaitingReview', 'Waiting for approval', t.awaitingReview, 'first publish'], ['opensToday', 'Menu opens today', t.opensToday, 'real guests'],
    ['openCases', 'Open cases', t.openCases, 'support'], ['actsForOwner7d', 'Acted for owners', t.actsForOwner7d, 'last 7 days'],
    ['demoVenues', 'Demo venues', t.demoVenues, 'labelled, not counted'],
  ];
  return (
    <section class="tiles tiles-7" aria-label="The whole fleet, real venues only" data-totals>
      {tiles.map(([id, label, n, note]) => (
        <div key={id} class="tile" data-kpi={id}><span class="tile-label">{label}</span><span class="tile-value">{fmtInt(n)}</span><span class="tile-note">{note}</span></div>
      ))}
    </section>
  );
}

const href = (v: OpsVenueRow) => `#/venues/${encodeURIComponent(v.id)}`;

function Stage({ v, now }: { v: OpsVenueRow; now: number }) {
  const o = v.onboarding;
  return (
    <span class="stage" data-stage={o.stage}>
      <span class="stage-line">
        <span class="pips" aria-hidden="true">{Array.from({ length: o.total }, (_, i) => <i key={i} class={i < o.done ? 'on' : ''} />)}</span>
        <span>{stageLabel(o.stage)}</span>
      </span>
      <span class="sub">{o.done}/{o.total} steps{o.since && o.stage !== 'complete' ? ` · since ${ago(o.since, now, '—')}` : ''}</span>
      {o.blocked.map((b) => <span key={b.step} class="sub blocked"><Icon name="warn" size={11} /> {STEP_LABEL[b.step]} blocked{b.blockers.length ? `: ${b.blockers.join(', ').replace(/_/g, ' ')}` : ''}</span>)}
    </span>
  );
}

function Review({ v }: { v: OpsVenueRow }) {
  const tone = v.review === 'approved' ? 'good' : v.review === 'pending' ? 'warn' : 'plain';
  return <Badge tone={tone} icon={v.review === 'approved' ? 'check' : v.review === 'pending' ? 'clock' : 'dot'} data={`review-${v.review}`}>{REVIEW_LABEL[v.review]}</Badge>;
}

function Plan({ v, now }: { v: OpsVenueRow; now: number }) {
  const tone = v.plan.state === 'expired' || v.plan.state === 'suspended' ? 'bad' : v.plan.state === 'pending' ? 'plain' : 'good';
  const ends = v.plan.state === 'trialing' && v.plan.trialEndsAt ? Math.ceil((Date.parse(v.plan.trialEndsAt) - now) / 86_400_000) : null;
  return (
    <span class="plan-cell">
      <Badge tone={tone}>{PLAN_LABEL[v.plan.plan]} · {PLAN_STATE_LABEL[v.plan.state]}</Badge>
      {ends !== null && <span class="sub">trial until {fmtDate(v.plan.trialEndsAt)}{ends <= 7 ? ` · ${ends <= 0 ? 'ends today' : `${ends} days left`}` : ''}</span>}
    </span>
  );
}

function Chips({ v }: { v: OpsVenueRow }) {
  const chips = warningChips(v.warnings, v);
  return chips.length ? <span class="wchips">{chips.map((c) => <WarningChip key={c.code} chip={c} />)}</span> : <span class="zero">none</span>;
}

function Table({ venues, now }: { venues: readonly OpsVenueRow[]; now: number }) {
  return (
    <div class="table-wrap" tabIndex={0} role="region" aria-label="Clients table">
      <table class="grid clients" data-table="clients">
        <thead><tr>
          <th scope="col">Venue</th><th scope="col">Onboarding</th><th scope="col">Approval · menu</th><th scope="col" class="num">Opens today</th>
          <th scope="col" class="num">Suggestions 7d</th><th scope="col" class="num">Photos</th><th scope="col">Plan</th><th scope="col">Owner sign-in</th><th scope="col">Warnings</th>
        </tr></thead>
        <tbody>
          {venues.map((v) => (
            <tr key={v.id} data-venue={v.slug}>
              <th scope="row" class="c-name">
                <a class="row-open" href={href(v)} data-open><Name text={v.name} fallback={v.slug} /></a>
                <span class="name-meta"><span class="mono">{v.slug}</span>{v.isDemo && <DemoLabel />}</span>
              </th>
              <td class="c-stage"><Stage v={v} now={now} /></td>
              <td class="c-review"><Review v={v} />
                <span class="sub">{v.menu.live ? `live · revision ${v.menu.revision ?? '—'}` : v.menu.firstPublishedAt ? 'offline' : 'never published'}{v.menu.lastPublishedAt ? ` · ${ago(v.menu.lastPublishedAt, now)}` : ''}</span>
              </td>
              <td class="num"><strong data-opens-today>{fmtInt(v.opens.today)}</strong>
                <span class="sub">{fmtInt(v.opens.lastHour)} last hour · {fmtInt(v.opens.last7d)} in 7d</span>{v.cappedToday && <span class="sub flag-bad">capped today</span>}
              </td>
              <td class="num">{fmtPct(v.suggestions7d.accepted, v.suggestions7d.shown)}<span class="sub">{fmtInt(v.suggestions7d.accepted)} of {fmtInt(v.suggestions7d.shown)} shown</span></td>
              <td class="num">{fmtInt(v.photos.withPhoto)}/{fmtInt(v.photos.dishes)}{v.photos.awaitingReview > 0 && <span class="sub">{fmtInt(v.photos.awaitingReview)} to approve</span>}</td>
              <td class="c-plan"><Plan v={v} now={now} /></td>
              <td class="c-date">{ago(v.lastOwnerSignInAt, now)}</td>
              <td class="c-warn"><Chips v={v} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ v, now }: { v: OpsVenueRow; now: number }) {
  return (
    <li class="card" data-venue={v.slug}>
      <div class="card-top">
        <a class="card-title" href={href(v)} data-open><Name text={v.name} fallback={v.slug} /></a>
        {v.isDemo && <DemoLabel />}
      </div>
      <Chips v={v} />
      <dl class="card-stats">
        <div><dt>Onboarding</dt><dd><Stage v={v} now={now} /></dd></div>
        <div><dt>Approval</dt><dd><Review v={v} /></dd></div>
        <div><dt>Opens today</dt><dd><strong data-opens-today>{fmtInt(v.opens.today)}</strong> <span class="muted">· {fmtInt(v.opens.last7d)} in 7d</span></dd></div>
        <div><dt>Suggestions 7d</dt><dd>{fmtPct(v.suggestions7d.accepted, v.suggestions7d.shown)} <span class="muted">of {fmtInt(v.suggestions7d.shown)}</span></dd></div>
        <div><dt>Photos</dt><dd>{fmtInt(v.photos.withPhoto)}/{fmtInt(v.photos.dishes)}</dd></div>
        <div><dt>Owner sign-in</dt><dd>{ago(v.lastOwnerSignInAt, now)}</dd></div>
      </dl>
      <div class="card-plan"><Plan v={v} now={now} /></div>
    </li>
  );
}
