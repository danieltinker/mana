/**
 * Leads: Mana's own enquiries from the product page (`ops_leads`, `ops_update_lead`), in the v1 screen's design. Leads
 * are personal data: the database logs every read, so this page loads them when it opens and when asked, never on a
 * timer. Every enquiry's words are shown as text.
 */
import { useMemo, useState } from 'preact/hooks';
import { LEAD_STATUSES, type LeadStatus, type OpsLead, type OpsLeads } from '@mana/contracts';
import { useLive } from './hooks.ts';
import { ago, fmtDateTime, fmtInt } from './model.ts';
import { Freshness } from './freshness.tsx';
import { LoadError, T, useCtx, useNarrow } from './ui.tsx';
import { Write } from './write.tsx';

const STATUS_LABEL: Readonly<Record<LeadStatus, string>> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', onboarding: 'Onboarding', won: 'Won', lost: 'Lost', spam: 'Spam',
};
type Show = 'open' | LeadStatus | 'all';
const OPEN: readonly LeadStatus[] = ['new', 'contacted', 'qualified', 'onboarding'];

/** mailto: and tel: links built from the contact itself, only when it is plainly an e-mail or a phone number. */
export function contactHref(contact: string): string | null {
  const s = contact.trim();
  if (/^[^\s@<>"]+@[^\s@<>"]+\.[A-Za-z]{2,}$/.test(s) && s.length <= 200) return `mailto:${encodeURIComponent(s).replace(/%40/g, '@')}`;
  const digits = s.replace(/[\s().-]/g, '');
  if (/^\+?\d{7,15}$/.test(digits)) return `tel:${digits}`;
  return null;
}

export function Leads() {
  const { api } = useCtx();
  const narrow = useNarrow(900);
  const [show, setShow] = useState<Show>('open');
  const live = useLive<OpsLeads>(() => api.leads({ status: 'all' }), [], { poll: false });
  const all = live.data?.leads ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length, open: 0 };
    for (const s of LEAD_STATUSES) c[s] = 0;
    for (const l of all) { c[l.status] = (c[l.status] ?? 0) + 1; if (OPEN.includes(l.status)) c.open = (c.open ?? 0) + 1; }
    return c;
  }, [all]);
  const list = all.filter((l) => (show === 'all' ? true : show === 'open' ? OPEN.includes(l.status) : l.status === show));
  const tabs: ReadonlyArray<{ id: Show; label: string }> = [{ id: 'open', label: 'Open' }, ...LEAD_STATUSES.map((s) => ({ id: s, label: STATUS_LABEL[s] })), { id: 'all', label: 'All' }];

  return (
    <div class="stack" data-page="leads">
      <div class="page-head">
        <h1 class="page-title">Leads {live.data && <span class="muted count" data-count>{fmtInt(list.length)}</span>}</h1>
        <Freshness live={live} polls={false} />
      </div>
      <p class="muted small">Enquiries from Mana’s product page, newest first. They are personal data: each time this list loads, the database logs that Halom read it.</p>
      {!live.data && live.fail && <LoadError fail={live.fail} retry={() => void live.refresh()} what="the leads" />}
      {!live.data && !live.fail && <p class="boot" role="status">Loading the leads…</p>}
      {live.data && (all.length === 0 ? (
        <div class="panel pad empty" data-empty><h2>No enquiry yet</h2><p class="muted">Enquiries sent from the Mana page land here.</p></div>
      ) : (
        <>
          <div class="chips" role="group" aria-label="Filter leads by status" data-lead-filters>
            {tabs.filter((t) => t.id === 'open' || t.id === 'all' || (counts[t.id] ?? 0) > 0 || t.id === show).map((t) => (
              <button key={t.id} type="button" class={'chip' + (show === t.id ? ' is-on' : '')} aria-pressed={show === t.id} onClick={() => setShow(t.id)} data-status-filter={t.id}>
                {t.label} <span class="chip-n">{counts[t.id] ?? 0}</span>
              </button>
            ))}
          </div>
          {list.length === 0 ? <div class="panel pad empty"><p>No enquiry with this status.</p></div> : narrow ? (
            <ul class="cards" data-cards="leads">{list.map((l) => <Lead key={l.id} l={l} card onDone={live.refresh} />)}</ul>
          ) : (
            <div class="table-wrap" tabIndex={0} role="region" aria-label="Leads table">
              <table class="grid leads" data-table="leads">
                <thead><tr><th scope="col">Ref · when</th><th scope="col" class="c-dream">The enquiry</th><th scope="col">Contact</th><th scope="col">Status · owner · notes</th></tr></thead>
                <tbody>{list.map((l) => <Lead key={l.id} l={l} onDone={live.refresh} />)}</tbody>
              </table>
            </div>
          )}
        </>
      ))}
    </div>
  );
}

function Lead({ l, card = false, onDone }: { l: OpsLead; card?: boolean; onDone: () => Promise<boolean> }) {
  const { api } = useCtx();
  const [status, setStatus] = useState<LeadStatus>(l.status);
  const [owner, setOwner] = useState(l.owner ?? '');
  const [notes, setNotes] = useState(l.notes ?? '');
  const [open, setOpen] = useState(false);
  const href = contactHref(l.contact);
  const changes = (): string[] => [
    status !== l.status ? `status ${STATUS_LABEL[l.status]} → ${STATUS_LABEL[status]}` : null,
    owner.trim() !== (l.owner ?? '') ? (owner.trim() ? `owner “${owner.trim()}”` : 'clear the owner') : null,
    notes.trim() !== (l.notes ?? '') ? (notes.trim() ? 'new notes' : 'clear the notes') : null,
  ].filter((x): x is string => x !== null);
  const meta = <><span class="mono lead-ref" data-ref>{l.ref}</span> <span class="sub">{fmtDateTime(l.created_at)} · {ago(l.created_at, Date.now())}{l.locale ? ` · ${l.locale}` : ''}</span></>;
  const words = (
    <div class="dream">
      <p class="dream-text clamp3" dir="auto" data-dream>{l.message}</p>
      {(l.venue_name || l.source !== 'mana-landing') && <p class="sub">{l.venue_name && <T>{l.venue_name}</T>}{l.source !== 'mana-landing' && <> · <T>{l.source}</T></>}</p>}
    </div>
  );
  const contact = (
    <span class="contact">
      {l.name && <T class="lead-name">{l.name}</T>}
      {href ? <a href={href} class="break"><T>{l.contact}</T></a> : <T class="break">{l.contact}</T>}
    </span>
  );
  const edit = (
    <div class="lead-edit">
      <p class="small"><span class={`status status-${l.status}`}>{STATUS_LABEL[l.status]}</span>{l.owner && <> · <T>{l.owner}</T></>}</p>
      {l.notes && <p class="small pre clamp3"><T>{l.notes}</T></p>}
      <details class="case-edit" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
        <summary data-edit>Edit</summary>
        <Write id={`lead-${l.ref}`} submit="Save" reason={false}
          plan={() => { const c = changes(); return c.length ? { ok: true, what: `Save for ${l.ref}: ${c.join(', ')}.` } : { ok: false, why: 'Nothing would change.' }; }}
          run={() => api.updateLead({ id: l.id, ...(status !== l.status ? { status } : {}), ...(owner.trim() !== (l.owner ?? '') ? { owner: owner.trim() } : {}),
            ...(notes.trim() !== (l.notes ?? '') ? { notes: notes.trim() } : {}) })}
          done={() => 'Saved.'} onDone={onDone}>
          <label class="field"><span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.currentTarget.value as LeadStatus)} data-lead-status>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label class="field"><span>Owner</span><input type="text" maxLength={80} dir="auto" value={owner} onInput={(e) => setOwner(e.currentTarget.value)} data-lead-owner /></label>
          <label class="field"><span>Notes</span><textarea rows={3} maxLength={4000} dir="auto" value={notes} onInput={(e) => setNotes(e.currentTarget.value)} data-lead-notes /></label>
        </Write>
      </details>
    </div>
  );
  if (card) return <li class="card" data-lead={l.ref}><div class="card-top"><div>{meta}</div></div>{words}{contact}{edit}</li>;
  return (
    <tr data-lead={l.ref}>
      <td class="c-ref">{meta}</td><td class="c-dream">{words}</td><td class="c-owner">{contact}</td><td class="c-notes">{edit}</td>
    </tr>
  );
}

