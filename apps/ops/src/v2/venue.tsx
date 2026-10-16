/**
 * One venue (`ops_venue`): everything support needs to follow it. Its onboarding, the timeline grouped by strand
 * (`timelineKind`), its imports and their exceptions, its cases, what guests see now (`public_menu`, read only), and
 * Halom's writes: approve the first publish, act for the owner, cases, and (admins) the demo label and the plan.
 * Live: the owner's channel for this venue (ADR-007), else polling; every write refetches at once.
 */
import { useMemo, useRef, useState } from 'preact/hooks';
import { SLUG_RE, venueFilter, type OpsVenueDetail, type PublicMenuResponse, type TimelineKind, TIMELINE_KINDS } from '@mana/contracts';
import type { Result } from './api.ts';
import { useLive, type LiveData } from './hooks.ts';
import {
  ACTOR_LABEL, PLAN_LABEL, PLAN_STATE_LABEL, REVIEW_LABEL, STATE_LABEL, STEP_LABEL, TIMELINE_LABEL, ago, describe, fmtDateTime, fmtDay, fmtInt,
  fmtPct, fmtTime, names, snapshotNames, timeline, timelineDays, warningChips, EXCEPTION_LABEL, IMPORT_SOURCE_LABEL, IMPORT_STATUS_LABEL,
  type NameOf, type TimelineItem,
} from './model.ts';
import { realtime } from './session.ts';
import { Badge, DemoLabel, Ext, Icon, LoadError, Name, Notice, T, WarningChip, useCtx } from './ui.tsx';
import { Freshness } from './freshness.tsx';
import { Write } from './write.tsx';
import { ActForOwner, type Preset } from './act.tsx';
import { Admin, Cases, GuestsSee } from './panels.tsx';
import { Revisions } from './revision.tsx';

export type VenueData = { readonly detail: OpsVenueDetail; readonly menu: Result<PublicMenuResponse> };

export function Venue({ id }: { id: string }) {
  const { api, conn } = useCtx();
  const subscribe = useMemo(() => realtime(conn.client, 'venue', [
    { table: 'rollups_minute', filter: venueFilter(id) }, { table: 'rollups_day', filter: venueFilter(id) }, { table: 'availability_overrides', filter: venueFilter(id) },
  ]), [conn, id]);
  const live = useLive<VenueData>(async () => {
    const d = await api.venue(id);
    if (!d.ok) return d;
    return { ok: true, data: { detail: d.data, menu: await api.publicMenu(d.data.venue.slug) } };
  }, [id], { subscribe });
  const [preset, setPreset] = useState<Preset | null>(null);
  const actRef = useRef<HTMLElement>(null);

  if (!live.data) {
    return (
      <div class="stack" data-page="venue">
        <a class="link back" href="#/clients"><Icon name="back" size={14} /> All clients</a>
        {live.fail ? <LoadError fail={live.fail} retry={() => void live.refresh()} what="this venue" /> : <p class="boot" role="status">Loading the venue…</p>}
      </div>
    );
  }
  const { detail, menu } = live.data;
  const v = detail.venue;
  const snapshot = menu.ok && menu.data.state === 'ok' ? menu.data.snapshot : null;
  const nameOf = snapshotNames(snapshot);
  const restore = (p: Preset) => {
    setPreset({ ...p, key: Date.now() });
    actRef.current?.scrollIntoView({ block: 'start' });
  };

  return (
    <div class={'stack venue' + (live.busy ? ' is-busy' : '')} data-page="venue" data-venue={v.slug}>
      <a class="link back" href="#/clients"><Icon name="back" size={14} /> All clients</a>
      <Head data={live.data} live={live} />
      {live.fail && <Notice tone="bad">Refresh failed: {live.fail.message} Showing the last answer.</Notice>}
      <div class="venue-grid">
        <div class="col col-main">
          {v.review === 'pending' && <Approve detail={detail} onDone={live.refresh} />}
          {v.review === 'pending' && <Revisions detail={detail} onRead={live.refresh} />}
          <Onboarding detail={detail} />
          <Timeline detail={detail} nameOf={nameOf} />
          <Imports detail={detail} />
        </div>
        <div class="col col-side">
          <GuestsSee detail={detail} menu={menu} onRestore={restore} />
          {v.review !== 'pending' && <Revisions detail={detail} onRead={live.refresh} />}
          <section class="panel p-act" aria-labelledby="act-h" ref={actRef} tabIndex={-1} data-panel="act">
            <div class="panel-head"><h2 id="act-h">Act for the owner</h2>
              <p class="muted small">Halom writes into a venue only here: one of six actions, with a reason the owner sees in their activity log.</p></div>
            <div class="panel-body"><ActForOwner detail={detail} snapshot={snapshot} menu={menu} preset={preset} onDone={live.refresh} /></div>
          </section>
          <Cases detail={detail} onDone={live.refresh} />
          <Admin detail={detail} onDone={live.refresh} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- the head

function Head({ data, live }: { data: VenueData; live: LiveData<VenueData> }) {
  const { conn } = useCtx();
  const { detail } = data;
  const v = detail.venue;
  const now = Date.now();
  const vp = typeof conn.config.viewPath === 'string' && /^(\.\.?\/)[A-Za-z0-9._\-/]*$/.test(conn.config.viewPath) ? conn.config.viewPath : '../view/';
  const guestMenu = SLUG_RE.test(v.slug) ? `${vp}?m=${v.slug}` : null;
  const chips = warningChips(v.warnings, v);
  const m = detail.members;
  return (
    <>
      <header class="venue-head">
        <div class="venue-title">
          <h1 class="page-title" data-venue-name><Name text={v.name} fallback={v.slug} /></h1>
          <p class="muted small venue-meta"><span class="mono">{v.slug}</span> · {v.kind.replace('_', ' ')} · {v.mode.replace('_', ' ')} · created {fmtDay(v.createdAt.slice(0, 10))}{v.isDemo && <> · <DemoLabel /></>}</p>
          <div class="row wrap badges">
            <Badge tone={v.review === 'approved' ? 'good' : v.review === 'pending' ? 'warn' : 'plain'} icon={v.review === 'approved' ? 'check' : 'clock'} data={`review-${v.review}`}>{REVIEW_LABEL[v.review]}</Badge>
            <Badge tone={v.plan.state === 'expired' || v.plan.state === 'suspended' ? 'bad' : 'plain'}>{PLAN_LABEL[v.plan.plan]} · {PLAN_STATE_LABEL[v.plan.state]}{v.plan.trialEndsAt ? ` until ${fmtDay(v.plan.trialEndsAt.slice(0, 10))}` : ''}</Badge>
            <Badge tone={v.supportCanAct ? 'plain' : 'warn'} icon="lock" data={v.supportCanAct ? 'can-act' : 'cannot-act'}>{v.supportCanAct ? 'Owner lets Halom act for them' : 'Owner has turned off Halom acting'}</Badge>
          </div>
        </div>
        <div class="venue-links">
          {guestMenu && <Ext href={guestMenu} class="btn btn-sm" label={`Open the guest menu for ${v.slug} in a new tab`}>Guest menu <Icon name="out" size={12} /></Ext>}
          <a class="btn btn-sm" href={`#/analytics?venue=${encodeURIComponent(v.id)}`} data-venue-analytics>Analytics</a>
          <Freshness live={live} />
        </div>
      </header>
      {chips.length > 0 && <div class="wchips" aria-label="Warnings">{chips.map((c) => <WarningChip key={c.code} chip={c} />)}</div>}
      <dl class="strip" data-strip>
        <div><dt>Opens today</dt><dd data-opens-today>{fmtInt(v.opens.today)}</dd></div>
        <div><dt>Last hour</dt><dd data-opens-hour>{fmtInt(v.opens.lastHour)}</dd></div>
        <div><dt>Last 7 days</dt><dd>{fmtInt(v.opens.last7d)}</dd></div>
        <div><dt>Suggestions accepted, 7d</dt><dd>{fmtPct(v.suggestions7d.accepted, v.suggestions7d.shown)} <span class="muted small">of {fmtInt(v.suggestions7d.shown)}</span></dd></div>
        <div><dt>Photos approved</dt><dd>{fmtInt(v.photos.withPhoto)}/{fmtInt(v.photos.dishes)}{v.photos.awaitingReview ? <span class="muted small"> · {v.photos.awaitingReview} to approve</span> : null}</dd></div>
        <div><dt>Team</dt><dd>{m.owners} owner{m.owners === 1 ? '' : 's'}{m.managers ? ` · ${m.managers} manager${m.managers === 1 ? '' : 's'}` : ''}{m.counters ? ` · ${m.counters} counter` : ''}</dd></div>
        <div><dt>Owner signed in</dt><dd>{ago(v.lastOwnerSignInAt, now)}</dd></div>
        <div><dt>Last publish</dt><dd>{v.menu.lastPublishedAt ? ago(v.menu.lastPublishedAt, now) : 'never'}</dd></div>
      </dl>
    </>
  );
}

// ---------------------------------------------------------------- approve the first publish

function Approve({ detail, onDone }: { detail: OpsVenueDetail; onDone: () => Promise<boolean> }) {
  const { api } = useCtx();
  const v = detail.venue;
  const name = names(v.name, v.slug).main;
  return (
    <section class="panel p-approve is-attention" aria-labelledby="approve-h" data-panel="approve">
      <div class="panel-head"><h2 id="approve-h">First publish waits for your approval</h2>
        <p class="muted small">Published {fmtDateTime(v.menu.firstPublishedAt)}. Until you approve, guests who open the menu see “menu not available”.
          Read the menu below first.</p></div>
      <div class="panel-body">
        <Write id="approve" submit="Approve"
          plan={() => ({ ok: true, what: `Approve ${name}’s first publish${v.menu.revision ? ` (revision ${v.menu.revision})` : ''}: guests can open the menu at once, and the trial starts.` })}
          run={(reason) => api.approve({ venueId: v.id, reason })}
          done={(d) => `Approved. Guests can open the menu now${d.trialEndsAt ? `; the trial runs until ${fmtDay(d.trialEndsAt.slice(0, 10))}` : ''}.`}
          onDone={onDone} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- onboarding

function Onboarding({ detail }: { detail: OpsVenueDetail }) {
  const o = detail.onboarding;
  const row = detail.venue.onboarding;
  const now = Date.now();
  return (
    <section class="panel p-onboarding" aria-labelledby="onb-h" data-panel="onboarding">
      <div class="panel-head">
        <h2 id="onb-h">Onboarding</h2>
        <p class="muted small" data-onboarding-summary>
          {o.complete ? 'Complete: every step is done or skipped.' : `${o.done} of ${o.total} steps done · next: ${o.next ? STEP_LABEL[o.next] : '—'}${row.since ? ` · since ${ago(row.since, now, '—')}` : ''}`}
        </p>
      </div>
      <ol class="steps">
        {o.steps.map((s, i) => (
          <li key={s.step} class={`step step-${s.state}` + (s.step === o.next ? ' is-next' : '')} data-step={s.step} data-state={s.state}>
            <span class="step-n" aria-hidden="true">{s.state === 'done' ? <Icon name="check" size={12} /> : i + 1}</span>
            <span class="step-name">{STEP_LABEL[s.step]}{s.auto && <span class="muted small" title="The database marks this step done by itself"> · automatic</span>}</span>
            <span class={`state state-${s.state}`}>{STATE_LABEL[s.state]}</span>
            <span class="muted small step-when">{s.updatedAt ? ago(s.updatedAt, now) : ''}</span>
            {s.blockers.length > 0 && <span class="step-blockers"><Icon name="warn" size={12} /> {s.blockers.map((b) => b.replace(/_/g, ' ')).join(', ')}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---------------------------------------------------------------- the timeline

function Timeline({ detail, nameOf }: { detail: OpsVenueDetail; nameOf: NameOf }) {
  const [kind, setKind] = useState<TimelineKind | 'all'>('all');
  const t = useMemo(() => timeline(detail.activity), [detail.activity]);
  const days = timelineDays(t.items, kind);
  return (
    <section class="panel p-timeline" aria-labelledby="tl-h" data-panel="timeline">
      <div class="panel-head">
        <h2 id="tl-h">Timeline</h2>
        <p class="muted small">Everything in the venue’s activity log, newest first: who did what. Halom’s actions are marked, with their reason.</p>
      </div>
      <div class="chips strands" role="group" aria-label="Show one strand of the timeline">
        <button type="button" class={'chip' + (kind === 'all' ? ' is-on' : '')} aria-pressed={kind === 'all'} onClick={() => setKind('all')} data-strand="all">
          All <span class="chip-n">{t.items.length}</span>
        </button>
        {TIMELINE_KINDS.filter((k) => t.counts[k] > 0 || k === kind).map((k) => (
          <button key={k} type="button" class={'chip' + (kind === k ? ' is-on' : '')} aria-pressed={kind === k} onClick={() => setKind(k)} data-strand={k}>
            {TIMELINE_LABEL[k]} <span class="chip-n">{t.counts[k]}</span>
          </button>
        ))}
      </div>
      {days.length === 0 ? <p class="pad muted">Nothing in this strand yet.</p> : (
        <div class="tl-days">
          {days.map((d) => (
            <div key={d.day} class="tl-day">
              <h3 class="tl-date">{d.day === '—' ? '—' : fmtDay(d.day, true)}</h3>
              <ol class="tl">{d.items.map((e) => <Entry key={e.id} e={e} nameOf={nameOf} />)}</ol>
            </div>
          ))}
        </div>
      )}
      {detail.activity.length >= 100 && <p class="muted small pad">The newest 100 entries.</p>}
    </section>
  );
}

function Entry({ e, nameOf }: { e: TimelineItem; nameOf: NameOf }) {
  const said = describe(e, nameOf);
  return (
    <li class={'tl-item' + (e.halom ? ' is-halom' : '')} data-entry={e.id} data-action={e.action} data-kind={e.kind}>
      <span class="tl-time">{fmtTime(e.at)}</span>
      <div class="tl-body">
        <p class="tl-title"><span class="tl-kind">{TIMELINE_LABEL[e.kind]}</span> <T>{said.title}</T></p>
        {said.detail && <p class="tl-detail"><T>{said.detail}</T></p>}
        <p class="tl-who">
          {e.halom
            ? <Badge tone="info" icon="halom" data="halom">Halom{e.you ? ' (you)' : ''}{e.via === 'act_for_owner' ? ', acting for the owner' : ''}</Badge>
            : <span>{ACTOR_LABEL[e.actorKind]}{e.you ? ' (you)' : ''}</span>}
          {e.via === 'system' && <span class="muted small"> · automatic</span>}
        </p>
        {e.reason && <p class="tl-reason" data-reason-shown>Reason: <T class="quote">“{e.reason}”</T></p>}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- imports

function Imports({ detail }: { detail: OpsVenueDetail }) {
  return (
    <section class="panel p-imports" aria-labelledby="imp-h" data-panel="imports">
      <div class="panel-head"><h2 id="imp-h">Imports</h2><p class="muted small">What came in and what the reader made of it; never the raw input.</p></div>
      {detail.imports.length === 0 ? <p class="pad muted">No import yet.</p> : (
        <ul class="imports">
          {detail.imports.map((i) => (
            <li key={i.id} class="import" data-import={i.status}>
              <div class="row-between wrap">
                <strong>{IMPORT_SOURCE_LABEL[i.source]}</strong>
                <Badge tone={i.status === 'failed' ? 'bad' : i.status === 'applied' ? 'good' : i.status === 'parsed' ? 'warn' : 'plain'}>{IMPORT_STATUS_LABEL[i.status]}</Badge>
              </div>
              <p class="muted small">{fmtDateTime(i.createdAt)}{i.appliedAt ? ` · applied ${fmtDateTime(i.appliedAt)}` : ''}{i.errorCode ? <> · error <span class="mono">{i.errorCode}</span></> : null}{i.rightsConfirmed ? ' · photo rights confirmed' : ''}</p>
              {i.counts && <p class="small">{i.counts.sections} sections · {i.counts.dishes} dishes · {i.counts.groups} add-on groups · {i.counts.options} add-ons · {i.counts.photos} photos</p>}
              {(i.exceptions.fix > 0 || i.exceptions.check > 0) && (
                <p class="small exc">
                  <span class={i.exceptions.fix ? 'flag-bad' : ''}>{i.exceptions.fix} to fix</span> · {i.exceptions.check} to check
                  {Object.entries(i.exceptions.byCode).map(([code, n]) => <span key={code} class="tag">{EXCEPTION_LABEL[code as keyof typeof EXCEPTION_LABEL] ?? code} × {n}</span>)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
