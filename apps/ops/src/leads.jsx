import { useMemo, useState } from 'preact/hooks';
import * as api from './api.js';
import { LEAD_STATUSES, contactLinks, dayKey, fmtDateTime, fmtDay, fmtInt, ago, leadPatch, leadsCsv, sortLeads } from './model.js';
import { Ext, Icon, Notice, T, download, useNarrow } from './ui.jsx';

const STATUS_LABEL = { new: 'New', qualified: 'Qualified', scoped: 'Scoped', agreed: 'Agreed', production: 'Production', review: 'Review', deployed: 'Deployed', support: 'Support', lost: 'Lost', spam: 'Spam' };
const OPEN = ['new', 'qualified', 'scoped', 'agreed', 'production', 'review'];

function LeadContact({ l }) {
  const c = contactLinks(l.contact);
  return (
    <span class="contact">
      {l.name && <T class="lead-name">{l.name}</T>}
      {c.kind === 'email' && <a href={c.mail} class="break"><T>{l.contact}</T></a>}
      {c.kind === 'phone' && (
        <span class="contact-line">
          <a href={c.tel} aria-label={`Call ${c.digits}`}><T>{l.contact}</T></a>
          {c.wa && <Ext href={c.wa} label={`WhatsApp ${c.digits}`} class="chip-link">WhatsApp</Ext>}
        </span>
      )}
      {c.kind === 'text' && <T class="break">{l.contact}</T>}
    </span>
  );
}

function Dream({ l }) {
  const long = l.dream.length > 150 || l.dream.split('\n').length > 3;
  const [open, setOpen] = useState(false);
  return (
    <div class="dream">
      <p class={'dream-text' + (long && !open ? ' is-clamped' : '')} dir="auto" data-dream>{l.dream}</p>
      {long && <button type="button" class="link small" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-dream-toggle>{open ? 'Show less' : `Show all (${fmtInt(l.dream.length)} characters)`}</button>}
      {l.hidden && <p class="muted small"><Icon name="warn" size={12} /> Hidden control characters were removed from this enquiry.</p>}
    </div>
  );
}

export function Leads({ d, route, reload }) {
  const narrow = useNarrow(900);
  const want = route.q.get('s');
  const filter = want === 'open' || want === 'all' || LEAD_STATUSES.includes(want) ? want : 'all';
  // per lead: { editing, draft, saving, msg: { ok, text } }. Lives here so a refresh never throws away typing.
  const [edits, setEdits] = useState({});
  const patch = (id, p) => setEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), ...p } }));
  const setField = (id, key, value) => setEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), msg: null, draft: { ...((e[id] || {}).draft || {}), [key]: value } } }));

  const counts = useMemo(() => {
    const c = { all: d.leads.length, open: 0 };
    for (const s of LEAD_STATUSES) c[s] = 0;
    for (const l of d.leads) { c[l.status]++; if (OPEN.includes(l.status)) c.open++; }
    return c;
  }, [d]);
  const list = useMemo(() => sortLeads(d.leads.filter((l) => (filter === 'all' ? true : filter === 'open' ? OPEN.includes(l.status) : l.status === filter))), [d, filter]);
  const setFilter = (id) => { location.hash = id === 'all' ? '#/leads' : `#/leads?s=${id}`; };

  const save = async (lead, draftOverride) => {
    const st = edits[lead.id] || {};
    const draft = draftOverride || st.draft || {};
    const { args, changed, errors } = leadPatch(lead, draft);
    if (errors.length) { patch(lead.id, { msg: { ok: false, text: errors.join(' ') } }); return; }
    if (!changed) { patch(lead.id, { editing: false, draft: {}, msg: null }); return; }
    patch(lead.id, { saving: true, msg: null, draft });
    const r = await api.updateLead(args);
    if (!r.ok) { patch(lead.id, { saving: false, msg: { ok: false, text: `Not saved: ${r.message}` } }); return; }
    const fresh = await reload();
    patch(lead.id, { saving: false, editing: false, draft: {}, msg: { ok: true, text: fresh ? 'Saved' : 'Saved, but the list could not be refreshed' } });
  };
  const quickStatus = (lead, status) => {
    const st = edits[lead.id] || {};
    if (st.editing) setField(lead.id, 'status', status);       // part of the open edit: saved with Save
    else save(lead, { status });
  };

  const rowProps = (l) => {
    const st = edits[l.id] || {};
    const draft = st.draft || {};
    const val = (k) => (draft[k] !== undefined ? draft[k] : l[k]);
    return { l, st, val, now: d.now,
      onEdit: () => patch(l.id, { editing: true, msg: null }),
      onCancel: () => patch(l.id, { editing: false, draft: {}, msg: null }),
      onField: (k, v) => setField(l.id, k, v), onSave: () => save(l), onStatus: (s) => quickStatus(l, s),
      onRetry: () => save(l) };
  };
  const tabs = [{ id: 'all', label: 'All' }, { id: 'open', label: 'Open' }, ...LEAD_STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s] }))];

  return (
    <div class="stack">
      <div class="row-between wrap">
        <h1 class="page-title">Leads <span class="muted count" data-count>{fmtInt(list.length)}{list.length !== d.leads.length ? ` of ${fmtInt(d.leads.length)}` : ''}</span></h1>
        <button type="button" class="btn btn-sm" disabled={!list.length} data-export="leads" onClick={() => download(`halom-leads-${dayKey(d.now)}.csv`, leadsCsv(list))}>
          <Icon name="download" /><span>Export CSV ({fmtInt(list.length)})</span>
        </button>
      </div>
      {d.leads.length === 0 ? (
        <div class="panel pad empty" data-empty>
          <h2>No enquiry yet</h2>
          <p class="muted">Enquiries sent from halom.io and from the Mana page land here, newest first.</p>
        </div>
      ) : (
        <>
          <div class="chips" role="group" aria-label="Filter leads by status" data-lead-filters>
            {tabs.filter((t) => t.id === 'all' || t.id === 'open' || counts[t.id] > 0 || t.id === filter).map((t) => (
              <button key={t.id} type="button" class={'chip' + (filter === t.id ? ' is-on' : '')} aria-pressed={filter === t.id} onClick={() => setFilter(t.id)} data-status-filter={t.id}>
                {t.label} <span class="chip-n">{counts[t.id]}</span>
              </button>
            ))}
          </div>
          {d.leads.length >= 300 && <Notice tone="info">Showing the newest 300 enquiries (the server sends no more than that).</Notice>}
          {list.length === 0 ? <div class="panel pad empty"><p>No enquiry with this status.</p></div> : narrow ? (
            <ul class="cards" data-cards="leads">{list.map((l) => <LeadCard key={l.id} {...rowProps(l)} />)}</ul>
          ) : (
            <div class="table-wrap" tabIndex={0} role="region" aria-label="Leads table">
              <table class="grid leads" data-table="leads">
                <thead><tr>
                  <th scope="col">Ref · when</th><th scope="col">Source</th><th scope="col" class="c-dream">The dream</th><th scope="col">Contact</th>
                  <th scope="col">Status</th><th scope="col">Owner</th><th scope="col">Next action</th><th scope="col">Notes</th><th scope="col"><span class="sr">Edit</span></th>
                </tr></thead>
                <tbody>{list.map((l) => <LeadRow key={l.id} {...rowProps(l)} />)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusSelect({ l, st, val, onStatus }) {
  return (
    <span class={`status status-${val('status')}`}>
      <select value={val('status')} disabled={st.saving} onChange={(e) => onStatus(e.currentTarget.value)} aria-label={`Status of ${l.ref}`} data-status>
        {LEAD_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
    </span>
  );
}
function Feedback({ st, onRetry }) {
  if (st.saving) return <span class="fb muted" role="status" data-feedback="saving">Saving…</span>;
  if (!st.msg) return null;
  return st.msg.ok
    ? <span class="fb fb-ok" role="status" data-feedback="ok"><Icon name="check" size={13} />{st.msg.text}</span>
    : <span class="fb fb-bad" role="alert" data-feedback="error"><Icon name="warn" size={13} />{st.msg.text} {!st.editing && <button type="button" class="link" onClick={onRetry} data-retry>Retry</button>}</span>;
}
function Fields({ l, val, onField, st }) {
  return (
    <div class="lead-form">
      <label class="field"><span>Owner</span><input type="text" maxlength={80} dir="auto" value={val('owner')} disabled={st.saving} onInput={(e) => onField('owner', e.currentTarget.value)} data-f="owner" /></label>
      <label class="field"><span>Next action</span><input type="text" maxlength={300} dir="auto" value={val('nextAction')} disabled={st.saving} onInput={(e) => onField('nextAction', e.currentTarget.value)} data-f="nextAction" /></label>
      <label class="field"><span>On</span><input type="date" value={val('nextOn')} disabled={st.saving} onInput={(e) => onField('nextOn', e.currentTarget.value)} data-f="nextOn" /></label>
      <label class="field field-wide"><span>Notes</span><textarea rows={3} maxlength={4000} dir="auto" value={val('notes')} disabled={st.saving} onInput={(e) => onField('notes', e.currentTarget.value)} data-f="notes" /></label>
    </div>
  );
}
function Meta({ l, now }) {
  return (
    <>
      <span class="mono lead-ref" data-ref>{l.ref}</span>
      <span class="sub" title={fmtDateTime(l.created)}><br />{fmtDateTime(l.created)}<br />{ago(l.created, now)}</span>
    </>
  );
}
function Source({ l }) {
  return (
    <>
      <T>{l.source || '—'}</T>{l.pkg && <span class="tag">{l.pkg}</span>}{l.locale && <span class="sub"> · {l.locale}</span>}
      {l.page && <span class="sub page-line" title="The page the form was sent from (shown as text, never as a link)"><br /><T>{l.page.length > 60 ? l.page.slice(0, 60) + '…' : l.page}</T></span>}
    </>
  );
}

function LeadRow(p) {
  const { l, st, val, now } = p;
  return (
    <>
      <tr data-lead={l.ref} class={st.editing ? 'is-editing' : ''}>
        <td class="c-ref"><Meta l={l} now={now} /></td>
        <td class="c-src"><Source l={l} /></td>
        <td class="c-dream"><Dream l={l} /></td>
        <td class="c-owner"><LeadContact l={l} /></td>
        <td><StatusSelect {...p} />{!st.editing && <div><Feedback st={st} onRetry={p.onRetry} /></div>}</td>
        <td><T>{l.owner || ''}</T>{!l.owner && <span class="zero">—</span>}</td>
        <td>{l.nextAction ? <T>{l.nextAction}</T> : <span class="zero">—</span>}{l.nextOn && <span class="sub"><br />{fmtDay(l.nextOn)}</span>}</td>
        <td class="c-notes">{l.notes ? <T class="pre clamp3">{l.notes}</T> : <span class="zero">—</span>}</td>
        <td class="c-act">{!st.editing && <button type="button" class="btn btn-sm" onClick={p.onEdit} data-edit>Edit</button>}</td>
      </tr>
      {st.editing && (
        <tr class="edit-row" data-lead-edit={l.ref}>
          <td colSpan={9}>
            <Fields {...p} />
            <div class="row">
              <button type="button" class="btn btn-primary btn-sm" onClick={p.onSave} disabled={st.saving} data-save>{st.saving ? 'Saving…' : 'Save'}</button>
              <button type="button" class="btn btn-sm" onClick={p.onCancel} disabled={st.saving} data-cancel>Cancel</button>
              <Feedback st={st} onRetry={p.onRetry} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LeadCard(p) {
  const { l, st, now } = p;
  return (
    <li class="card" data-lead={l.ref}>
      <div class="card-top">
        <div><span class="mono lead-ref" data-ref>{l.ref}</span> <span class="muted small">· {fmtDateTime(l.created)} · {ago(l.created, now)}</span></div>
        <StatusSelect {...p} />
      </div>
      <div class="card-meta"><Source l={l} /></div>
      <Dream l={l} />
      <LeadContact l={l} />
      {st.editing ? (
        <>
          <Fields {...p} />
          <div class="row">
            <button type="button" class="btn btn-primary btn-sm" onClick={p.onSave} disabled={st.saving} data-save>{st.saving ? 'Saving…' : 'Save'}</button>
            <button type="button" class="btn btn-sm" onClick={p.onCancel} disabled={st.saving} data-cancel>Cancel</button>
          </div>
          <Feedback st={st} onRetry={p.onRetry} />
        </>
      ) : (
        <>
          <dl class="card-stats lead-stats">
            <div><dt>Owner</dt><dd>{l.owner ? <T>{l.owner}</T> : <span class="zero">—</span>}</dd></div>
            <div><dt>Next action</dt><dd>{l.nextAction ? <T>{l.nextAction}</T> : <span class="zero">—</span>}{l.nextOn ? ` · ${fmtDay(l.nextOn)}` : ''}</dd></div>
            {l.notes && <div class="wide"><dt>Notes</dt><dd><T class="pre clamp3">{l.notes}</T></dd></div>}
          </dl>
          <div class="card-foot"><Feedback st={st} onRetry={p.onRetry} /><button type="button" class="btn btn-sm" onClick={p.onEdit} data-edit>Edit</button></div>
        </>
      )}
    </li>
  );
}
