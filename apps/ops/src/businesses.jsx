import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as api from './api.js';
import {
  BUSINESS_FILTERS, PLAN_ACTIONS, addDays, ago, businessesCsv, dayKey, emailLink, filterBusinesses, fmtDate, fmtDateShort, fmtDateTime, fmtInt,
  menuLinks, phoneLinks, planEndText, planRequest, planText, sortBusinesses, stageLabel,
} from './model.js';
import { Ext, Icon, Notice, PlanBadge, StageBadge, T, download, useNarrow } from './ui.jsx';

const KIND = { restaurant: 'Restaurant', cafe: 'Café', bar: 'Bar', bakery: 'Bakery', food_truck: 'Food truck', hotel: 'Hotel', other: 'Other' };

function setHash(view, id, q) {
  const qs = q && [...q.keys()].length ? '?' + q.toString() : '';
  location.hash = `#/${view}${id ? '/' + encodeURIComponent(id) : ''}${qs}`;
}

function Names({ b }) {
  const both = b.nameHe && b.nameEn;
  return (
    <span class="names">
      <T class="name-main">{b.nameHe || b.nameEn || b.slug}</T>
      {both && <T class="name-alt">{b.nameEn}</T>}
    </span>
  );
}
function MenuLinks({ b, cfg, long }) {
  const l = menuLinks(b.slug, cfg);
  if (!l) return <span class="muted mono">{b.slug}</span>;
  return (
    <span class="menu-links">
      <Ext href={l.short} class="mono" label={`Public menu link ${l.shortLabel}`}>{long ? l.shortLabel : '/m/' + b.slug}<Icon name="out" size={11} /></Ext>
      <Ext href={l.viewer} label={`Open the viewer directly for ${b.slug}`}>viewer<Icon name="out" size={11} /></Ext>
    </span>
  );
}
function Contact({ b }) {
  const mail = emailLink(b.ownerEmail);
  const p = phoneLinks(b.contactPhone || b.phone);
  return (
    <span class="contact">
      {b.ownerEmail && (mail ? <a href={mail} class="break"><T>{b.ownerEmail}</T></a> : <T class="break">{b.ownerEmail}</T>)}
      {(b.contactName || b.contactPhone || b.phone) && (
        <span class="contact-line">
          {b.contactName && <T>{b.contactName}</T>}
          {p ? (
            <>
              <a href={p.tel} aria-label={`Call ${p.digits}`}><T>{b.contactPhone || b.phone}</T></a>
              {p.wa && <Ext href={p.wa} label={`WhatsApp ${p.digits}`} class="chip-link">WhatsApp</Ext>}
            </>
          ) : (b.contactPhone || b.phone) ? <T>{b.contactPhone || b.phone}</T> : null}
        </span>
      )}
    </span>
  );
}
function Pics({ b }) {
  return (
    <>
      <td class="num" data-col="pics-ok">{b.pics.approved || <span class="zero">0</span>}</td>
      <td class="num" data-col="pics-wait">{b.pics.waiting || <span class="zero">0</span>}</td>
      <td class="num" data-col="pics-fail">{b.pics.failed ? <span class="flag-bad"><Icon name="warn" size={12} />{b.pics.failed}</span> : <span class="zero">0</span>}</td>
    </>
  );
}

const COLS = [
  { id: 'name', label: 'Business', first: 'asc' },
  { id: 'stage', label: 'Stage', first: 'desc', title: 'How far the owner got' },
  { id: 'items', label: 'Items', first: 'desc', num: true, title: 'Items · of them with a picture' },
  { id: 'pictures', label: 'OK', first: 'desc', num: true, group: 'Pictures', title: 'Approved pictures' },
  { id: null, label: 'Wait', num: true, group: 'Pictures', title: 'Uploaded, generating or waiting for the owner\'s review' },
  { id: null, label: 'Fail', num: true, group: 'Pictures', title: 'Failed to generate' },
  { id: 'revisions', label: 'Rev.', first: 'desc', num: true, title: 'Published revisions' },
  { id: 'published', label: 'Published', first: 'desc', title: 'First publish · last publish' },
  { id: 'plan', label: 'Plan', first: 'asc', title: 'Sorted by days left' },
  { id: 'views', label: 'Views 7d', first: 'desc', num: true, title: 'Diner views: last 7 days / all time' },
  { id: 'activity', label: 'Activity', first: 'desc', title: 'Last change to the menu, pictures or publish · last sign-in of any member', also: { id: 'signin', label: 'Sign-in', first: 'desc' } },
  { id: 'created', label: 'Created', first: 'desc' },
  { id: 'owner', label: 'Owner', first: 'asc' },
];
const SORT_OPTIONS = [...COLS.filter((c) => c.id).map((c) => ({ id: c.id, label: c.id === 'pictures' ? 'Approved pictures' : c.label, first: c.first })),
  { id: 'signin', label: 'Last sign-in', first: 'desc' }, { id: 'kind', label: 'Kind', first: 'asc' }];

export function Businesses({ d, cfg, route, reload }) {
  const narrow = useNarrow(1100);          // the table needs a laptop; tablets and phones get cards
  const [sort, setSort] = useState({ key: 'created', dir: 'desc' });
  const filterId = BUSINESS_FILTERS.some((f) => f.id === route.q.get('f')) ? route.q.get('f') : 'all';
  const [query, setQuery] = useState('');
  const list = useMemo(() => sortBusinesses(filterBusinesses(d.businesses, filterId, query), sort.key, sort.dir), [d, filterId, query, sort]);
  const open = route.id ? d.businesses.find((b) => b.id === route.id) : null;
  const setFilter = (id) => { const q = new URLSearchParams(); if (id !== 'all') q.set('f', id); setHash('businesses', null, q); };
  const openRow = (b) => setHash('businesses', b.id, route.q);
  const close = () => setHash('businesses', null, route.q);
  const clickSort = (c) => setSort((s) => (s.key === c.id ? { key: c.id, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.id, dir: c.first }));
  const counts = useMemo(() => Object.fromEntries(BUSINESS_FILTERS.map((f) => [f.id, d.businesses.filter(f.test).length])), [d]);
  const current = BUSINESS_FILTERS.find((f) => f.id === filterId);

  return (
    <div class="stack">
      <div class="row-between wrap">
        <h1 class="page-title">Businesses <span class="muted count" data-count>{fmtInt(list.length)}{list.length !== d.businesses.length ? ` of ${fmtInt(d.businesses.length)}` : ''}</span></h1>
        <button type="button" class="btn btn-sm" disabled={!list.length} data-export="businesses"
          onClick={() => download(`mana-businesses-${dayKey(d.now)}.csv`, businessesCsv(list, cfg))}>
          <Icon name="download" /><span>Export CSV ({fmtInt(list.length)})</span>
        </button>
      </div>

      {d.businesses.length === 0 ? (
        <div class="panel pad empty" data-empty>
          <h2>No business yet</h2>
          <p class="muted">When an owner creates a business in the owner app it appears here within a minute, with how far they got.</p>
          {d.kpi.accountsWithoutBusiness > 0 && <p>{fmtInt(d.kpi.accountsWithoutBusiness)} account{d.kpi.accountsWithoutBusiness === 1 ? ' has' : 's have'} signed up without creating a business.</p>}
        </div>
      ) : (
        <>
          <div class="filters" role="group" aria-label="Filter businesses">
            <label class="field field-inline search">
              <span class="sr">Search</span>
              <input type="search" placeholder="Search name, slug, e-mail, phone" value={query} onInput={(e) => setQuery(e.currentTarget.value)} data-search />
            </label>
            <label class="field field-inline">
              <span class="sr">Show</span>
              <select value={filterId} onChange={(e) => setFilter(e.currentTarget.value)} data-filter>
                {BUSINESS_FILTERS.filter((f) => !f.hidden || f.id === filterId).map((f) => <option key={f.id} value={f.id}>{f.label} ({counts[f.id]})</option>)}
              </select>
            </label>
            {narrow && (
              <label class="field field-inline">
                <span class="sr">Sort by</span>
                <select value={sort.key} onChange={(e) => { const c = SORT_OPTIONS.find((x) => x.id === e.currentTarget.value); setSort({ key: c.id, dir: c.first }); }} data-sort-select>
                  {SORT_OPTIONS.map((c) => <option key={c.id} value={c.id}>Sort: {c.label}</option>)}
                </select>
              </label>
            )}
            {(filterId !== 'all' || query) && <button type="button" class="link" onClick={() => { setQuery(''); setFilter('all'); }}>Clear</button>}
          </div>

          {list.length === 0 ? (
            <div class="panel pad empty" data-empty-filter><p>No business matches {query ? <>“<T>{query}</T>”</> : null}{query && filterId !== 'all' ? ' in ' : ''}{filterId !== 'all' ? <>“{current.label}”</> : null}.</p></div>
          ) : narrow ? (
            <ul class="cards" data-cards="businesses">
              {list.map((b) => (
                <li key={b.id} class="card" data-slug={b.slug}>
                  <div class="card-top">
                    <button type="button" class="card-title" onClick={() => openRow(b)}><Names b={b} /></button>
                    <StageBadge b={b} />
                  </div>
                  <div class="card-meta"><MenuLinks b={b} cfg={cfg} /> <span class="muted">· {KIND[b.kind]} · created {fmtDate(b.created)}</span></div>
                  <dl class="card-stats">
                    <div><dt>Items</dt><dd>{fmtInt(b.items)} <span class="muted">· {fmtInt(b.itemsWithPicture)} pic</span></dd></div>
                    <div><dt>Pictures</dt><dd>{b.pics.approved} ok · {b.pics.waiting} wait{b.pics.failed ? <> · <span class="flag-bad">{b.pics.failed} failed</span></> : ''}</dd></div>
                    <div><dt>Views 7d</dt><dd>{fmtInt(b.views7)} <span class="muted">/ {fmtInt(b.viewsTotal)}</span></dd></div>
                    <div><dt>Active</dt><dd>{ago(b.activity, d.now)}</dd></div>
                  </dl>
                  <div class="card-plan"><PlanBadge b={b} /> <span class="muted small">{planEndText(b, d.now)}</span></div>
                  {b.attention.filter((a) => a.level !== 'info').length > 0 && (
                    <p class="card-att"><Icon name="warn" size={13} />{b.attention.filter((a) => a.level !== 'info').map((a) => a.text).join(' · ')}</p>
                  )}
                  <div class="card-foot"><Contact b={b} /><button type="button" class="btn btn-sm" onClick={() => openRow(b)}>Details</button></div>
                </li>
              ))}
            </ul>
          ) : (
            <div class="table-wrap" tabIndex={0} role="region" aria-label="Businesses table">
              <table class="grid" data-table="businesses">
                <thead>
                  <tr>
                    {COLS.map((c, i) => {
                      const on = c.id && (sort.key === c.id || (c.also && sort.key === c.also.id));
                      const btn = (x) => (
                        <button type="button" class={'th-btn' + (sort.key === x.id ? ' is-on' : '')} onClick={() => clickSort(x)} data-sort={x.id}>
                          {x.label}<span class="arrow" aria-hidden="true">{sort.key === x.id ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                        </button>
                      );
                      return (
                        <th key={i} scope="col" class={(c.num ? 'num ' : '') + (c.group ? 'grp ' : '')} title={c.title}
                          aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                          {c.group && <span class="grp-label">{c.label === 'OK' ? c.group : '\u00a0'}</span>}
                          {c.id ? <>{btn(c)}{c.also && <><span class="th-sep"> · </span>{btn(c.also)}</>}</> : <span class="th-plain">{c.label}</span>}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {list.map((b) => {
                    const hot = b.attention.filter((a) => a.level !== 'info');
                    return (
                      <tr key={b.id} data-slug={b.slug} class={open && open.id === b.id ? 'is-open' : ''}>
                        <th scope="row" class="c-name">
                          <button type="button" class="row-open" onClick={() => openRow(b)} data-open><Names b={b} /></button>
                          <span class="name-meta"><span class="muted">{KIND[b.kind]}</span><MenuLinks b={b} cfg={cfg} /></span>
                        </th>
                        <td class="c-stage">
                          <span class="stage-row">
                            <StageBadge b={b} />
                            {hot.length > 0 && <span class="att-mark" title={hot.map((a) => a.text).join('\n')}><Icon name="warn" size={12} />{hot.length}<span class="sr"> need attention: {hot.map((a) => a.text).join('; ')}</span></span>}
                          </span>
                        </td>
                        <td class="num nowrap">{fmtInt(b.items)}<span class="sub"> · {fmtInt(b.itemsWithPicture)} pic</span></td>
                        <Pics b={b} />
                        <td class="num">{b.revisions || <span class="zero">0</span>}</td>
                        <td class="c-date" title={b.firstPub ? `First ${fmtDateTime(b.firstPub)} · last ${fmtDateTime(b.lastPub)}` : undefined}>
                          {b.firstPub ? <>{fmtDateShort(b.firstPub)}{b.lastPub && b.lastPub - b.firstPub > 60000 ? <span class="sub"><br />last {fmtDateShort(b.lastPub)}</span> : null}</> : <span class="zero">never</span>}
                        </td>
                        <td class="c-plan"><PlanBadge b={b} /><span class="sub"><br />{planEndText(b, d.now, true)}</span></td>
                        <td class="num nowrap">{fmtInt(b.views7)}<span class="sub"> / {fmtInt(b.viewsTotal)}</span></td>
                        <td class="c-date" title={`Activity ${fmtDateTime(b.activity)} · sign-in ${fmtDateTime(b.lastSignIn)}`}>{ago(b.activity, d.now)}<span class="sub"><br />sign-in {ago(b.lastSignIn, d.now)}</span></td>
                        <td class="c-date" title={fmtDateTime(b.created)}>{fmtDateShort(b.created)}</td>
                        <td class="c-owner"><Contact b={b} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {route.id && (open
        ? <Drawer key={open.id} b={open} d={d} cfg={cfg} onClose={close} reload={reload} />
        : <Drawer missing onClose={close} />)}
    </div>
  );
}

// ---------------------------------------------------------------- detail drawer
// Tab past the last control lands on a hidden sentinel, which sends focus round to the other end.
function edge(el, which) {
  if (!el) return;
  const f = [...el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')];
  const t = which === 'first' ? f[0] : f[f.length - 1];
  if (t) t.focus(); else el.focus();
}
function Drawer({ b, d, cfg, onClose, reload, missing }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const el = ref.current;
    if (el) el.focus();
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    // keep keyboard focus inside the open drawer
    const onFocus = (e) => { if (el && e.target instanceof Node && !el.contains(e.target)) el.focus(); };
    document.addEventListener('focusin', onFocus);
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('focusin', onFocus); document.body.classList.remove('no-scroll'); if (prev && prev.focus && document.contains(prev)) prev.focus(); };
  }, []);

  if (missing) {
    return (
      <div class="drawer-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <aside class="drawer" role="dialog" aria-modal="true" aria-label="Business" ref={ref} tabIndex={-1}>
          <div class="drawer-head"><h2>Not found</h2><button type="button" class="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
          <div class="drawer-body"><p>This business is not in the list any more.</p></div>
        </aside>
      </div>
    );
  }
  const l = menuLinks(b.slug, cfg);
  const row = (k, v) => <div class="fact"><dt>{k}</dt><dd>{v}</dd></div>;
  return (
    <div class="drawer-back" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-h" ref={ref} tabIndex={-1} data-drawer={b.slug}>
        <span tabIndex={0} class="sr" onFocus={() => edge(ref.current, 'last')} />
        <div class="drawer-head">
          <div>
            <h2 id="drawer-h"><Names b={b} /></h2>
            <p class="muted small">{KIND[b.kind]}{(b.areaHe || b.areaEn) ? <> · <T>{b.areaHe || b.areaEn}</T></> : null} · created {fmtDate(b.created)}</p>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close details" data-close><Icon name="close" /></button>
        </div>
        <div class="drawer-body">
          <div class="row wrap"><StageBadge b={b} /><PlanBadge b={b} /></div>

          <section aria-labelledby="att-d">
            <h3 id="att-d">Needs attention</h3>
            {b.attention.length === 0 ? <p class="muted">Nothing to chase right now.</p> : (
              <ul class="hints" data-hints>
                {b.attention.map((a) => <li key={a.id} class={'hint hint-' + a.level} data-hint={a.id}><Icon name={a.level === 'info' ? 'dot' : 'warn'} size={14} /><span>{a.text}</span></li>)}
              </ul>
            )}
          </section>

          <section aria-labelledby="links-d">
            <h3 id="links-d">Menu and people</h3>
            <dl class="facts">
              {row('Public link', l ? <Ext href={l.short} class="mono break">{l.shortLabel}<Icon name="out" size={11} /></Ext> : <span class="mono">{b.slug}</span>)}
              {row('Viewer', l ? <Ext href={l.viewer} class="mono break">{l.viewer}<Icon name="out" size={11} /></Ext> : '—')}
              {row('Owner', <Contact b={b} />)}
              {row('Last sign-in', b.lastSignIn ? `${fmtDateTime(b.lastSignIn)} (${ago(b.lastSignIn, d.now)})` : 'never')}
              {row('Last activity', b.activity ? `${fmtDateTime(b.activity)} (${ago(b.activity, d.now)})` : '—')}
            </dl>
          </section>

          <section aria-labelledby="menu-d">
            <h3 id="menu-d">Menu</h3>
            <dl class="facts">
              {row('Stage', b.stalled ? `Stalled at "${stageLabel(b.base)}" (${b.idleDays} days without activity)` : stageLabel(b.base))}
              {row('Categories', fmtInt(b.categories))}
              {row('Items', `${fmtInt(b.items)}, ${fmtInt(b.itemsWithPicture)} with a picture`)}
              {row('Pictures', `${b.pics.approved} approved · ${b.pics.review} waiting for review · ${b.pics.working} uploading or generating · ${b.pics.failed} failed · ${b.pics.rejected} rejected`)}
              {row('Revisions', fmtInt(b.revisions))}
              {row('First published', b.firstPub ? fmtDateTime(b.firstPub) : 'never')}
              {row('Last published', b.lastPub ? fmtDateTime(b.lastPub) : 'never')}
              {row('Diner views', `${fmtInt(b.views7)} in the last 7 days · ${fmtInt(b.viewsTotal)} all time`)}
            </dl>
          </section>

          <PlanSection b={b} d={d} reload={reload} />
          <p class="muted small mono">id {b.id}</p>
        </div>
        <span tabIndex={0} class="sr" onFocus={() => edge(ref.current, 'first')} />
      </aside>
    </div>
  );
}

function PlanSection({ b, d, reload }) {
  const [action, setAction] = useState('');
  const [day, setDay] = useState('');
  const [noEnd, setNoEnd] = useState(false);
  const [note, setNote] = useState('');
  const [step, setStep] = useState('edit');            // edit | confirm | saving
  const [result, setResult] = useState(null);          // { ok, text }
  const [error, setError] = useState(null);
  const a = PLAN_ACTIONS.find((x) => x.id === action);
  const t = planText(b);
  const today = dayKey(d.now);

  const pick = (id) => {
    setAction(id); setError(null); setResult(null); setNoEnd(false);
    const base = b.endsAt && b.endsAt > d.now ? dayKey(b.endsAt) : today;
    setDay(id === 'suspend' ? '' : addDays(id === 'extend' ? base : today, id === 'extend' ? 14 : 30));
  };
  const req = a ? planRequest(b, action, day, noEnd, note) : null;
  const review = (e) => { e.preventDefault(); if (!req) { setError('Choose what to change.'); return; } if (req.error) { setError(req.error); return; } setError(null); setStep('confirm'); };
  const apply = async () => {
    setStep('saving');
    const r = await api.setEntitlement(req.args);
    if (!r.ok) { setStep('confirm'); setError(`Not applied: ${r.message}`); return; }
    const fresh = await reload();
    setStep('edit'); setAction(''); setNote('');
    setResult({ ok: true, text: fresh ? 'Applied. The plan above is what the server reports now.' : 'Applied, but the list could not be refreshed. Press Refresh to see the new state.' });
  };

  return (
    <section aria-labelledby="plan-d" class="plan" data-plan>
      <h3 id="plan-d">Plan</h3>
      <dl class="facts">
        <div class="fact"><dt>Now</dt><dd data-plan-now><strong>{t.plan} · {t.state}</strong> <span class="muted">{planEndText(b, d.now)}</span></dd></div>
        {b.trialStarted && <div class="fact"><dt>Trial</dt><dd>{fmtDate(b.trialStarted)} to {fmtDate(b.trialEnds)}</dd></div>}
        {b.planStatus !== b.planState && <div class="fact"><dt>Stored as</dt><dd>{b.planStatus} (the end date has passed, so it counts as {b.planState})</dd></div>}
        <div class="fact"><dt>Note</dt><dd>{b.planNote ? <T class="pre">{b.planNote}</T> : <span class="muted">none</span>}</dd></div>
      </dl>
      {result && <Notice tone="good"><span data-plan-result>{result.text}</span></Notice>}

      {step === 'edit' ? (
        <form class="plan-form" onSubmit={review} novalidate>
          <fieldset>
            <legend>Change the plan</legend>
            <div class="choices">
              {PLAN_ACTIONS.map((x) => (
                <label key={x.id} class={'choice' + (action === x.id ? ' is-on' : '')}>
                  <input type="radio" name="plan-action" value={x.id} checked={action === x.id} onChange={() => pick(x.id)} /><span>{x.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {a && a.needsDate && (
            <div class="row wrap">
              <label class="field"><span>{action === 'extend' ? 'Trial runs until (end of day)' : 'Active until (end of day)'}</span>
                <input type="date" value={day} min={today} disabled={noEnd} onInput={(e) => setDay(e.currentTarget.value)} data-plan-date />
              </label>
              {a.openEnded && <label class="check"><input type="checkbox" checked={noEnd} onChange={(e) => setNoEnd(e.currentTarget.checked)} /><span>No end date</span></label>}
            </div>
          )}
          {a && (
            <label class="field"><span>Note (optional, replaces the current note; visible to staff only)</span>
              <textarea rows={2} maxlength={500} dir="auto" value={note} onInput={(e) => setNote(e.currentTarget.value)} data-plan-note />
            </label>
          )}
          {error && <Notice tone="bad">{error}</Notice>}
          {a && <button type="submit" class="btn btn-primary" data-plan-review>Review change</button>}
        </form>
      ) : (
        <div class="confirm" role="group" aria-label="Confirm the plan change" data-plan-confirm>
          <p class="confirm-title">Apply this change to <T>{b.name}</T>?</p>
          <dl class="facts">
            <div class="fact"><dt>From</dt><dd>{t.plan} · {t.state} <span class="muted">{planEndText(b, d.now)}</span></dd></div>
            <div class="fact"><dt>To</dt><dd><strong data-plan-summary>{req.summary}</strong></dd></div>
            {req.args.p_note && <div class="fact"><dt>Note</dt><dd><T class="pre">{req.args.p_note}</T></dd></div>}
          </dl>
          {req.past && <Notice tone="bad">That date is already in the past: the plan will count as expired at once.</Notice>}
          {action === 'extend' && b.plan !== 'trial' && <Notice tone="info">This business is on the {t.plan} plan now. Extending the trial moves it back to the trial plan.</Notice>}
          {error && <Notice tone="bad"><span data-plan-error>{error}</span></Notice>}
          <div class="row">
            <button type="button" class="btn btn-primary" onClick={apply} disabled={step === 'saving'} data-plan-apply>{step === 'saving' ? 'Applying…' : 'Apply'}</button>
            <button type="button" class="btn" onClick={() => { setStep('edit'); setError(null); }} disabled={step === 'saving'}>Back</button>
          </div>
        </div>
      )}
    </section>
  );
}
