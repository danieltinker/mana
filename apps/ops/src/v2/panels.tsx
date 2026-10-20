/**
 * The venue page's side panels: what guests see now (read only, from `public_menu`), what the owner sees (their
 * dashboard, `my_dashboard`, and their menu as it is in the owner app, `export_menu` on request), the support cases
 * (`ops_update_case`), and the admin-only demo label (`ops_set_demo`) and plan (`ops_set_plan`). Every owner or guest
 * text is a text node.
 */
import { useEffect, useState } from 'preact/hooks';
import {
  CASE_STATUSES, CASE_TOPICS, ENTITLEMENT_STATUSES, PLANS, isLocalDate, isObject, zonedTime, type CaseStatus, type CaseTopic, type ClientDashboard,
  type EntitlementStatus, type MenuExport, type OpsVenueDetail, type Plan, type PublicMenuResponse, type SupportCase,
} from '@mana/contracts';
import { codeText, type Fail, type Result } from './api.ts';
import {
  CASE_STATUS_LABEL, CASE_TOPIC_LABEL, NUDGE_LABEL, PLAN_LABEL, PLAN_STATE_LABEL, TARGET_LABEL, ago, fmtClock, fmtDate, fmtDateTime, fmtInt, fmtMoney,
  fmtTime, menuView, names, type MenuRow, TZ,
} from './model.ts';
import type { Preset } from './act-model.ts';
import { Badge, Clamp, Icon, Notice, T, useCtx } from './ui.tsx';
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
      <div class="panel-head"><h2 id="guests-h">What guests see</h2>
        <p class="muted small">The published menu as a guest’s phone gets it now, read only.</p></div>
      <div class="panel-body">{body}</div>
    </section>
  );
}

// ---------------------------------------------------------------- what the owner sees

/**
 * The owner's own dashboard, as they see it: what it asks them to do (nudges), what is off now, today's numbers. Read
 * with the venue. Their menu as it is in the owner app (which may differ from what guests see until they publish) is
 * read on request only: each export is logged on their activity log, which they read.
 */
export function OwnerSees({ detail, dash, onRead }: { detail: OpsVenueDetail; dash: Result<ClientDashboard>; onRead: () => unknown }) {
  const { api, notStaff, signedOut } = useCtx();
  const v = detail.venue;
  const [exp, setExp] = useState<MenuExport | null>(null);
  const [fail, setFail] = useState<Fail | null>(null);
  const [busy, setBusy] = useState(false);
  const read = async () => {
    if (busy) return;
    setBusy(true); setFail(null);
    const r = await api.exportMenu(v.id);
    setBusy(false);
    if (!r.ok) { if (r.kind === 'not_staff') notStaff(r); else if (r.kind === 'signed_out') signedOut(); setFail(r); return; }
    setExp(r.data);
    onRead();
  };
  let board;
  if (!dash.ok) board = <Notice tone="warn">Could not load the owner’s dashboard. {dash.message}</Notice>;
  else {
    const d = dash.data;
    const t = d.today.totals;
    board = (
      <>
        <dl class="strip strip-s" data-owner-today>
          <div><dt>Menu opens today</dt><dd>{fmtInt(t.menuOpens)}</dd></div>
          <div><dt>Dish views</dt><dd>{fmtInt(t.dishViews)}</dd></div>
          <div><dt>Added to “my table”</dt><dd>{fmtInt(t.basketAdds)}</dd></div>
        </dl>
        {d.demo && <p class="muted small">A demo venue: the owner’s numbers are demo traffic, labelled as such on their dashboard.</p>}
        <div>
          <h3 class="sub-h">What the dashboard asks of them</h3>
          {d.nudges.length === 0 ? <p class="small muted" data-nudges="none">Nothing: no nudge.</p> : (
            <ul class="nudges small" data-nudges={d.nudges.length}>
              {d.nudges.map((n) => <li key={n.code} data-nudge={n.code}>{NUDGE_LABEL[n.code]?.(n.count) ?? n.code.replace(/_/g, ' ')}</li>)}
            </ul>
          )}
        </div>
        <div>
          <h3 class="sub-h">Off now</h3>
          {d.offNow.length === 0 ? <p class="small muted" data-owner-off="none">Nothing is off.</p> : (
            <ul class="nudges small" data-owner-off={d.offNow.length}>
              {d.offNow.map((o) => (
                <li key={o.overrideId}><T>{names(o.name).main || TARGET_LABEL[o.kind]}</T> ({TARGET_LABEL[o.kind].toLowerCase()}) · {o.until ? `until ${fmtTime(o.until)}` : 'until brought back'}</li>
              ))}
            </ul>
          )}
        </div>
      </>
    );
  }
  return (
    <section class="panel p-owner" aria-labelledby="owner-h" data-panel="owner">
      <div class="panel-head"><h2 id="owner-h">What the owner sees</h2>
        <p class="muted small">Their dashboard in the owner app, read only.</p></div>
      <div class="panel-body">
        {board}
        <div class="stack-s">
          <h3 class="sub-h">Their menu as it is in the owner app</h3>
          <p class="muted small" data-logged-reads>It may differ from what guests see until the owner publishes. Reading it is an export, which the owner sees in their
            activity log (“Menu exported”), as they see every read of a stored revision on this page (“Halom read a stored menu”). Not every back-office read is
            logged: the dish a change for them starts from is read without an entry.</p>
          <div class="row"><button type="button" class="btn btn-sm" onClick={() => void read()} disabled={busy} data-export>{busy ? 'Reading…' : exp ? 'Read it again' : 'Read the owner’s menu now'}</button></div>
          {fail && <Notice tone="bad">Could not read the owner’s menu. {fail.message}</Notice>}
          {exp && <OwnerMenu exp={exp} />}
        </div>
      </div>
    </section>
  );
}

function OwnerMenu({ exp }: { exp: MenuExport }) {
  const t = exp.tables;
  return (
    <div class="stack-s" data-owner-menu>
      <p class="muted small">Read at {fmtClock(Date.parse(exp.exportedAt))} · {fmtInt(t.dishes.length)} dishes in {fmtInt(t.sections.length)} sections
        {exp.publishedRevision !== null ? ` · revision ${exp.publishedRevision} is published` : ' · nothing published'}</p>
      <ul class="menu-view">
        {t.sections.map((s) => (
          <li key={s.id} class="msec">
            <ul>
              <li class={'mrow' + (s.hidden ? ' is-off' : '')} data-menu-row="section"><T class="mrow-name">{names({ he: s.name_he, en: s.name_en }).main}</T>{s.hidden && <Badge tone="plain">hidden</Badge>}</li>
              {t.dishes.filter((d) => d.section_id === s.id).map((d) => (
                <li key={d.id} class={'mrow is-sub' + (d.hidden ? ' is-off' : '')} data-owner-dish={d.id}>
                  <T class="mrow-name">{names({ he: d.name_he, en: d.name_en }).main}</T>
                  {d.hidden && <Badge tone="plain">hidden</Badge>}
                  <span class="mrow-price">{d.price === null ? 'no price' : fmtMoney(d.price)}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------- support cases

export function Cases({ detail, onDone }: { detail: OpsVenueDetail; onDone: () => Promise<boolean> }) {
  const open = detail.cases.filter((c) => c.status !== 'resolved').length;
  return (
    <section class="panel p-cases" aria-labelledby="cases-h" data-panel="cases">
      <div class="panel-head"><h2 id="cases-h">Support cases</h2>
        <p class="muted small">{detail.cases.length === 0 ? 'None.' : `${open} open · the owner’s words, as they wrote them.`}</p></div>
      {detail.cases.length > 0 && <ul class="cases">{detail.cases.map((c) => <Case key={c.id} c={c} venueId={detail.venue.id} onDone={onDone} />)}</ul>}
    </section>
  );
}

/**
 * One case: its words (all of them reachable: "Show all" whenever the text is clipped), and a change with a reason. The
 * change carries the case's `updatedAt` as this page read it: if the case changed since (another staff member, the
 * owner), the database refuses (`stale`) and the form says what it is now; when it already is what was asked, that is
 * shown as done. The form starts again from the case whenever the case changes.
 */
function Case({ c, venueId, onDone }: { c: SupportCase; venueId: string; onDone: () => Promise<boolean> }) {
  const { api } = useCtx();
  const next = (s: CaseStatus): CaseStatus => (s === 'resolved' ? 'open' : s === 'waiting_halom' || s === 'open' ? 'waiting_owner' : 'resolved');
  const [status, setStatus] = useState<CaseStatus>(next(c.status));
  const [topic, setTopic] = useState<CaseTopic>(c.topic);
  // the case changed (a write here, another staff member, the owner): the form starts again from it as it is
  useEffect(() => { setStatus(next(c.status)); setTopic(c.topic); }, [c.updatedAt, c.status, c.topic]);
  const tone = c.status === 'resolved' ? 'good' : c.status === 'waiting_halom' ? 'bad' : c.status === 'open' ? 'warn' : 'plain';
  const now = async (): Promise<SupportCase | null | Fail> => {
    const d = await api.venue(venueId);
    return d.ok ? d.data.cases.find((x) => x.id === c.id) ?? null : d;
  };
  return (
    <li class="case" data-case={c.id} data-status={c.status}>
      <div class="row-between wrap"><T class="case-subject">{c.subject}</T><Badge tone={tone}>{CASE_STATUS_LABEL[c.status]}</Badge></div>
      <p class="muted small">{CASE_TOPIC_LABEL[c.topic]} · opened by the {c.openedBy === 'staff' ? 'Halom team' : c.openedBy ?? 'a removed account'} {ago(c.openedAt, Date.now())}
        {c.resolvedAt ? ` · resolved ${fmtDate(c.resolvedAt)}` : ''}</p>
      {c.body && <Clamp text={c.body} class="case-body pre" data="case-body" />}
      <details class="case-edit">
        <summary>Change this case</summary>
        <Write id={`case-${c.id}`} submit="Update the case"
          changed={{ key: `${c.status}|${c.topic}|${c.updatedAt}`, note: `This case changed while you were reviewing: it is ${CASE_STATUS_LABEL[c.status].toLowerCase()} now. Nothing was sent: review again.` }}
          plan={() => (status === c.status && topic === c.topic ? { ok: false, why: 'Nothing would change: pick another status or topic.' } : {
            ok: true, what: [status !== c.status ? `Set the case from ${CASE_STATUS_LABEL[c.status].toLowerCase()} to ${CASE_STATUS_LABEL[status].toLowerCase()}` : null,
              topic !== c.topic ? `file it under ${CASE_TOPIC_LABEL[topic].toLowerCase()}` : null].filter(Boolean).join(', and ') + '.',
            input: { caseId: c.id, ...(status !== c.status ? { status } : {}), ...(topic !== c.topic ? { topic } : {}), expectedUpdatedAt: c.updatedAt },
          })}
          run={(input, reason) => api.updateCase({ ...input, reason })}
          onFail={(f) => { if (f.kind === 'refused') void onDone(); return caseNow(f); }}
          already={(f, input) => {
            const cur = f.code === 'stale' && f.reply && isObject(f.reply.current) ? f.reply.current : null;
            return cur && (input.status === undefined || cur.status === input.status) && (input.topic === undefined || cur.topic === input.topic)
              ? `Already so: the case is ${CASE_STATUS_LABEL[cur.status as CaseStatus]?.toLowerCase() ?? 'as asked'} (another Halom staff member, or a send whose answer was lost); nothing more was sent.` : null;
          }}
          done={(d) => `Updated: the case is ${CASE_STATUS_LABEL[d.case.status].toLowerCase()}.`}
          landed={async (input) => {
            const cur = await now();
            if (!cur || 'ok' in cur) return 'unknown';
            return (input.status === undefined || cur.status === input.status) && (input.topic === undefined || cur.topic === input.topic) ? 'yes' : 'no';
          }}
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

/** A `stale` refusal of a case carries the case as it is now: that, in words (never who changed it). */
function caseNow(f: Fail): string | null {
  const cur = f.code === 'stale' && f.reply && isObject(f.reply.current) ? f.reply.current : null;
  if (!cur) return null;
  const st = typeof cur.status === 'string' && cur.status in CASE_STATUS_LABEL ? CASE_STATUS_LABEL[cur.status as CaseStatus].toLowerCase() : null;
  const tp = typeof cur.topic === 'string' && cur.topic in CASE_TOPIC_LABEL ? CASE_TOPIC_LABEL[cur.topic as CaseTopic].toLowerCase() : null;
  return st ? `It is ${st} now${tp ? `, under ${tp}` : ''}.` : null;
}

// ---------------------------------------------------------------- admin: demo label, plan

/** The last second of an Israel date, as an instant: what "until 5 Nov" means for a plan. */
export const endOfDay = (date: string): string | null => (isLocalDate(date) ? new Date(zonedTime(date, '23:59', TZ) + 59_000).toISOString() : null);

export function Admin({ detail, onDone }: { detail: OpsVenueDetail; onDone: () => Promise<boolean> }) {
  const { api, role } = useCtx();
  const v = detail.venue;
  // a venue waiting for approval starts from its own state: its trial starts with the approval, not here
  const initial = (): EntitlementStatus => (v.plan.state === 'pending' && v.review !== 'pending' ? 'trialing' : v.plan.state);
  const [state, setState] = useState<EntitlementStatus>(initial);
  const [plan, setPlan] = useState<Plan>(v.plan.plan);
  const [until, setUntil] = useState('');
  // the plan's version: when it changes (an approval, another admin, this form), the form starts again from it
  const planKey = `${v.plan.state}|${v.plan.plan}|${v.plan.trialEndsAt}|${v.review}`;
  useEffect(() => { setState(initial()); setPlan(v.plan.plan); setUntil(''); }, [planKey]);
  const name = names(v.name, v.slug).main;
  const fresh = async () => { const d = await api.venue(v.id); return d.ok ? d.data.venue : null; };
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
          changed={{ key: v.isDemo, note: 'The demo label changed while you were reviewing. Nothing was sent: review again.' }}
          plan={() => ({ ok: true, what: v.isDemo ? `Mark ${name} as a real venue: its next guests count in real totals.` : `Mark ${name} as a demo venue: its next guests count as demo traffic, left out of real totals.`,
            note: 'Events already counted keep the label they were counted with.', input: { venueId: v.id, demo: !v.isDemo } })}
          run={(input, reason) => api.setDemo({ ...input, reason })}
          landed={async (input) => { const f = await fresh(); return !f ? 'unknown' : f.isDemo === input.demo ? 'yes' : 'no'; }}
          done={(d) => (d.demo ? 'Marked as a demo venue.' : 'Marked as a real venue.')} onDone={onDone} />
        <h3 class="sub-h">Plan</h3>
        <p class="small">Now: <strong>{PLAN_LABEL[v.plan.plan]} · {PLAN_STATE_LABEL[v.plan.state]}</strong>{v.plan.trialEndsAt ? ` · trial until ${fmtDate(v.plan.trialEndsAt)}` : ''}</p>
        {v.review === 'pending' && (
          <Notice tone="warn"><span data-approval-first>This venue’s first publish waits for approval. A plan does not approve it: approve it above, after
            reading its menu (the trial starts then). Until then the plan can only be suspended, expired or left as it is.</span></Notice>
        )}
        <Write id="plan" submit="Set the plan"
          changed={{ key: planKey, note: `The plan changed while you were reviewing: it is ${PLAN_LABEL[v.plan.plan]}, ${PLAN_STATE_LABEL[v.plan.state]} now. Nothing was sent: review again.` }}
          plan={async () => {
            const end = until ? endOfDay(until) : null;
            if (until && !end) return { ok: false, why: 'Choose a valid date.' };
            if (v.review === 'pending' && (state === 'trialing' || state === 'active')) return { ok: false, why: codeText('approval_first') };
            if (end && Date.parse(end) <= Date.now() && (state === 'trialing' || state === 'active')) return { ok: false, why: 'That date is already in the past.' };
            // the plan as it is now, not as this page loaded it
            const f = await fresh();
            if (!f) return { ok: false, why: 'Could not read the plan again before changing it. Try again.' };
            if (`${f.plan.state}|${f.plan.plan}|${f.plan.trialEndsAt}|${f.review}` !== planKey) {
              void onDone();
              return { ok: false, why: `The plan changed since this page loaded: it is ${PLAN_LABEL[f.plan.plan]}, ${PLAN_STATE_LABEL[f.plan.state]} now. Nothing was sent: review again.` };
            }
            return { ok: true, what: `Set ${name}’s plan from ${PLAN_LABEL[v.plan.plan]}, ${PLAN_STATE_LABEL[v.plan.state]} to ${PLAN_LABEL[plan]}, ${PLAN_STATE_LABEL[state]}${end ? `, until ${fmtDate(end)}` : ''}.`,
              ...(state === 'suspended' ? { note: 'Suspended: guests see “menu not available” and the owner cannot publish.' } : {}),
              input: { venueId: v.id, state, plan, until: end } };
          }}
          run={(input, reason) => api.setPlan({ ...input, reason })}
          landed={async (input) => { const f = await fresh(); return !f ? 'unknown' : f.plan.state === input.state && (input.plan == null || f.plan.plan === input.plan) ? 'yes' : 'no'; }}
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
