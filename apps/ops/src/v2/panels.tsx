/**
 * The venue page's side panels: what guests see now (read only, from `public_menu`), the support cases (`ops_update_case`),
 * and the admin-only demo label (`ops_set_demo`) and plan (`ops_set_plan`). Every owner or guest text is a text node.
 */
import { useState } from 'preact/hooks';
import {
  CASE_STATUSES, CASE_TOPICS, ENTITLEMENT_STATUSES, PLANS, isLocalDate, zonedTime, type CaseStatus, type CaseTopic, type EntitlementStatus,
  type OpsVenueDetail, type Plan, type PublicMenuResponse, type SupportCase,
} from '@mana/contracts';
import type { Result } from './api.ts';
import {
  CASE_STATUS_LABEL, CASE_TOPIC_LABEL, PLAN_LABEL, PLAN_STATE_LABEL, TARGET_LABEL, ago, fmtDate, fmtDateTime, fmtMoney, fmtTime, menuView, names,
  type MenuRow, TZ,
} from './model.ts';
import type { Preset } from './act.tsx';
import { Badge, Icon, Notice, T, useCtx } from './ui.tsx';
import { Write } from './write.tsx';

// ---------------------------------------------------------------- what guests see

export function GuestsSee({ detail, menu, onRestore }: { detail: OpsVenueDetail; menu: Result<PublicMenuResponse>; onRestore: (p: Preset) => void }) {
  const v = detail.venue;
  const canAct = v.supportCanAct;
  let body;
  if (!menu.ok) body = <Notice tone="bad">Could not load what guests see. {menu.message}</Notice>;
  else if (menu.data.state === 'not_found') body = <Notice tone="warn">No menu answers for this venue’s link.</Notice>;
  else if (menu.data.state === 'unavailable') {
    const why = v.review === 'pending' ? 'the first publish waits for Halom’s approval'
      : !v.menu.firstPublishedAt ? 'nothing is published yet'
        : v.plan.state === 'suspended' || v.plan.state === 'expired' ? `the plan is ${PLAN_STATE_LABEL[v.plan.state]}` : 'the menu is offline';
    body = <Notice tone="warn"><span data-guests-unavailable>Guests see “menu not available”: {why}.</span></Notice>;
  } else {
    const { snapshot, live } = menu.data;
    const view = menuView(snapshot, live);
    const row = (r: MenuRow, sub = false) => (
      <li key={r.id} class={'mrow' + (r.off ? ' is-off' : '') + (sub ? ' is-sub' : '')} data-menu-row={r.kind} data-id={r.id} data-off={r.off ? 'yes' : 'no'}>
        <T class="mrow-name">{names(r.name).main}</T>
        {r.price !== null && r.kind !== 'section' && <span class="mrow-price">{r.price === 0 && r.kind === 'option' ? 'free' : fmtMoney(r.price)}</span>}
        {r.off && (
          <span class="mrow-off">
            <Badge tone="warn" icon="clock">{r.off.until ? `Off until ${fmtTime(r.off.until)}` : 'Off until brought back'}</Badge>
            {canAct && <button type="button" class="link small" onClick={() => onRestore({ action: 'availability.restore', kind: r.kind, id: r.id })} data-restore={r.id}>Restore…</button>}
          </span>
        )}
      </li>
    );
    body = (
      <>
        <p class="muted small">Revision {snapshot.revision}, published {fmtDateTime(snapshot.publishedAt)} ·{' '}
          {live.open === null ? 'no opening hours set' : live.open ? 'open now' : `closed now${live.nextOpening ? `, opens ${fmtDateTime(live.nextOpening)}` : ''}`}
          {view.offCount > 0 ? ` · ${view.offCount} off now` : ''}</p>
        <ul class="menu-view" data-menu-view>
          {view.sections.map((sec) => (
            <li key={sec.id} class="msec">
              <ul>{row(sec)}{sec.dishes.map((d) => row(d, true))}</ul>
            </li>
          ))}
        </ul>
        {view.options.length > 0 && (
          <><p class="small"><strong>{TARGET_LABEL.option}s off now</strong></p><ul class="menu-view">{view.options.map((o) => row(o))}</ul></>
        )}
      </>
    );
  }
  return (
    <section class="panel p-guests" aria-labelledby="guests-h" data-panel="guests">
      <div class="panel-head"><h2 id="guests-h">What the owner and guests see</h2>
        <p class="muted small">The published menu as a guest’s phone gets it now, read only.</p></div>
      <div class="panel-body">{body}</div>
    </section>
  );
}

// ---------------------------------------------------------------- support cases

export function Cases({ detail, onDone }: { detail: OpsVenueDetail; onDone: () => Promise<boolean> }) {
  const open = detail.cases.filter((c) => c.status !== 'resolved').length;
  return (
    <section class="panel p-cases" aria-labelledby="cases-h" data-panel="cases">
      <div class="panel-head"><h2 id="cases-h">Support cases</h2>
        <p class="muted small">{detail.cases.length === 0 ? 'None.' : `${open} open · the owner’s words, as they wrote them.`}</p></div>
      {detail.cases.length > 0 && <ul class="cases">{detail.cases.map((c) => <Case key={c.id} c={c} onDone={onDone} />)}</ul>}
    </section>
  );
}

function Case({ c, onDone }: { c: SupportCase; onDone: () => Promise<boolean> }) {
  const { api } = useCtx();
  const [status, setStatus] = useState<CaseStatus>(c.status === 'resolved' ? 'open' : c.status === 'waiting_halom' || c.status === 'open' ? 'waiting_owner' : 'resolved');
  const [topic, setTopic] = useState<CaseTopic>(c.topic);
  const [long, setLong] = useState(false);
  const tone = c.status === 'resolved' ? 'good' : c.status === 'waiting_halom' ? 'bad' : c.status === 'open' ? 'warn' : 'plain';
  return (
    <li class="case" data-case={c.id} data-status={c.status}>
      <div class="row-between wrap"><T class="case-subject">{c.subject}</T><Badge tone={tone}>{CASE_STATUS_LABEL[c.status]}</Badge></div>
      <p class="muted small">{CASE_TOPIC_LABEL[c.topic]} · opened by the {c.openedBy === 'staff' ? 'Halom team' : c.openedBy ?? 'a removed account'} {ago(c.openedAt, Date.now())}
        {c.resolvedAt ? ` · resolved ${fmtDate(c.resolvedAt)}` : ''}</p>
      {c.body && (
        <>
          <p class={'case-body pre' + (long ? '' : ' clamp3')} dir="auto" data-case-body>{c.body}</p>
          {c.body.length > 200 && <button type="button" class="link small" aria-expanded={long} onClick={() => setLong((x) => !x)}>{long ? 'Show less' : 'Show all'}</button>}
        </>
      )}
      <details class="case-edit">
        <summary>Change this case</summary>
        <Write id={`case-${c.id.slice(-4)}`} submit="Update the case"
          plan={() => (status === c.status && topic === c.topic ? { ok: false, why: 'Nothing would change: pick another status or topic.' }
            : { ok: true, what: [status !== c.status ? `Set the case to ${CASE_STATUS_LABEL[status].toLowerCase()}` : null,
              topic !== c.topic ? `file it under ${CASE_TOPIC_LABEL[topic].toLowerCase()}` : null].filter(Boolean).join(', and ') + '.' })}
          run={(reason) => api.updateCase({ caseId: c.id, ...(status !== c.status ? { status } : {}), ...(topic !== c.topic ? { topic } : {}), reason })}
          done={(d) => `Updated: the case is ${CASE_STATUS_LABEL[d.case.status].toLowerCase()}.`}
          onDone={onDone}>
          <div class="two-fields">
            <label class="field"><span>Status</span>
              <select value={status} onChange={(e) => setStatus(e.currentTarget.value as CaseStatus)} data-case-status>
                {CASE_STATUSES.map((s) => <option key={s} value={s}>{CASE_STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            <label class="field"><span>Topic</span>
              <select value={topic} onChange={(e) => setTopic(e.currentTarget.value as CaseTopic)} data-case-topic>
                {CASE_TOPICS.map((s) => <option key={s} value={s}>{CASE_TOPIC_LABEL[s]}</option>)}
              </select>
            </label>
          </div>
        </Write>
      </details>
    </li>
  );
}

// ---------------------------------------------------------------- admin: demo label, plan

/** The last second of an Israel date, as an instant: what "until 5 Nov" means for a plan. */
export const endOfDay = (date: string): string | null => (isLocalDate(date) ? new Date(zonedTime(date, '23:59', TZ) + 59_000).toISOString() : null);

export function Admin({ detail, onDone }: { detail: OpsVenueDetail; onDone: () => Promise<boolean> }) {
  const { api, role } = useCtx();
  const v = detail.venue;
  const [state, setState] = useState<EntitlementStatus>(v.plan.state === 'pending' ? 'trialing' : v.plan.state);
  const [plan, setPlan] = useState<Plan>(v.plan.plan);
  const [until, setUntil] = useState('');
  const name = names(v.name, v.slug).main;
  if (role !== 'admin') {
    return (
      <section class="panel p-admin" aria-labelledby="admin-h" data-panel="admin">
        <div class="panel-head"><h2 id="admin-h">Plan and demo label</h2></div>
        <div class="panel-body">
          <p>{PLAN_LABEL[v.plan.plan]} · {PLAN_STATE_LABEL[v.plan.state]}{v.plan.trialEndsAt ? `, trial until ${fmtDate(v.plan.trialEndsAt)}` : ''} · {v.isDemo ? 'a demo venue' : 'a real venue'}</p>
          <p class="muted small" data-admin-only><Icon name="lock" size={13} /> Only Halom admins change the plan and the demo label.</p>
        </div>
      </section>
    );
  }
  return (
    <section class="panel p-admin" aria-labelledby="admin-h" data-panel="admin">
      <div class="panel-head"><h2 id="admin-h">Plan and demo label <span class="muted small">(admins)</span></h2></div>
      <div class="panel-body stack-s">
        <h3 class="sub-h">Demo label</h3>
        <p class="small">Now: <strong data-demo-now>{v.isDemo ? 'a demo venue' : 'a real venue'}</strong></p>
        <Write id="demo" submit={v.isDemo ? 'Mark as real' : 'Mark as demo'}
          plan={() => ({ ok: true, what: v.isDemo ? `Mark ${name} as a real venue: its next guests count in real totals.` : `Mark ${name} as a demo venue: its next guests count as demo traffic, left out of real totals.`,
            note: 'Events already counted keep the label they were counted with.' })}
          run={(reason) => api.setDemo({ venueId: v.id, demo: !v.isDemo, reason })}
          done={(d) => (d.demo ? 'Marked as a demo venue.' : 'Marked as a real venue.')} onDone={onDone} />
        <h3 class="sub-h">Plan</h3>
        <p class="small">Now: <strong>{PLAN_LABEL[v.plan.plan]} · {PLAN_STATE_LABEL[v.plan.state]}</strong>{v.plan.trialEndsAt ? ` · trial until ${fmtDate(v.plan.trialEndsAt)}` : ''}</p>
        <Write id="plan" submit="Set the plan"
          plan={() => {
            const end = until ? endOfDay(until) : null;
            if (until && !end) return { ok: false, why: 'Choose a valid date.' };
            if (end && Date.parse(end) <= Date.now() && (state === 'trialing' || state === 'active')) return { ok: false, why: 'That date is already in the past.' };
            return { ok: true, what: `Set ${name}’s plan to ${PLAN_LABEL[plan]}, ${PLAN_STATE_LABEL[state]}${end ? `, until ${fmtDate(end)}` : ''}.`,
              ...(state === 'suspended' ? { note: 'Suspended: guests see “menu not available” and the owner cannot publish.' } : {}) };
          }}
          run={(reason) => api.setPlan({ venueId: v.id, state, plan, until: until ? endOfDay(until) : null, reason })}
          done={(d) => `The plan is ${PLAN_STATE_LABEL[d.state]} now.`} onDone={onDone}>
          <div class="two-fields">
            <label class="field"><span>Plan</span>
              <select value={plan} onChange={(e) => setPlan(e.currentTarget.value as Plan)} data-plan-plan>{PLANS.map((p) => <option key={p} value={p}>{PLAN_LABEL[p]}</option>)}</select>
            </label>
            <label class="field"><span>State</span>
              <select value={state} onChange={(e) => setState(e.currentTarget.value as EntitlementStatus)} data-plan-state>
                {ENTITLEMENT_STATUSES.map((s) => <option key={s} value={s}>{PLAN_STATE_LABEL[s]}</option>)}
              </select>
            </label>
            <label class="field"><span>Until (end of that day, Israel; optional)</span>
              <input type="date" value={until} onInput={(e) => setUntil(e.currentTarget.value)} data-plan-until />
            </label>
          </div>
        </Write>
      </div>
    </section>
  );
}
