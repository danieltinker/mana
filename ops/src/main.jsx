import { render } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import * as api from './api.js';
import { PRODUCT, derive, fmtClock, fmtInt, ago } from './model.js';
import { Icon, Notice, T } from './ui.jsx';
import { DayColumns, Funnel } from './charts.jsx';
import { Businesses } from './businesses.jsx';
import { Leads } from './leads.jsx';

const STUDIO = '../studio/';

// ---------------------------------------------------------------- gate: sign in → staff check → (staff code) → app
function App() {
  // boot | config | signin | checking | code | app | gate-error
  const [phase, setPhase] = useState('boot');
  const [user, setUser] = useState(null);
  const [gateError, setGateError] = useState(null);
  const [notice, setNotice] = useState(null);

  const check = useCallback(async (u) => {
    setUser(u); setPhase('checking'); setGateError(null);
    const r = await api.isStaff();
    if (r.ok) { setPhase(r.data ? 'app' : 'code'); return; }
    if (r.kind === 'signed_out') { await api.signOut(); setUser(null); setNotice('Your session ended. Sign in again.'); setPhase('signin'); return; }
    setGateError(r.message); setPhase('gate-error');
  }, []);

  useEffect(() => {
    const c = api.init();
    if (!c.ok) { setGateError(c.message); setPhase('config'); return undefined; }
    let alive = true;
    api.currentUser().then((u) => { if (!alive) return; if (u) check(u); else setPhase('signin'); });
    const off = api.onSignedOut(() => { setUser(null); setPhase('signin'); });
    return () => { alive = false; off(); };
  }, [check]);

  const leave = useCallback(async (msg) => { await api.signOut(); setUser(null); setNotice(msg || null); setPhase('signin'); }, []);

  if (phase === 'boot' || phase === 'checking') return <Center><p class="boot" role="status">{phase === 'boot' ? 'Loading the back office…' : 'Checking your access…'}</p></Center>;
  if (phase === 'config') return <Center><Brand /><Notice tone="bad">{gateError}</Notice></Center>;
  if (phase === 'signin') return <SignIn notice={notice} onDone={(u) => { setNotice(null); check(u); }} />;
  if (phase === 'gate-error') {
    return (
      <Center>
        <Brand />
        <Notice tone="bad">Could not check your access. {gateError}</Notice>
        <div class="row">
          <button type="button" class="btn btn-primary" onClick={() => check(user)}>Try again</button>
          <button type="button" class="btn" onClick={() => leave()}>Sign out</button>
        </div>
      </Center>
    );
  }
  if (phase === 'code') return <StaffCode user={user} notice={notice} onStaff={() => { setNotice(null); check(user); }} onLeave={leave} />;
  return <Shell user={user} onLeave={leave} onNotStaff={() => { setNotice('This account does not have staff access.'); setPhase('code'); }} />;
}

function Center({ children }) { return <main class="gate"><div class="gate-card">{children}</div></main>; }
function Brand() {
  return (
    <div class="brand brand-lg">
      <span class="brand-mark" aria-hidden="true" />
      <div><strong>{PRODUCT.name} <span lang="he" dir="rtl">{PRODUCT.nameHe}</span></strong><span>Back office · {PRODUCT.by}</span></div>
    </div>
  );
}

function SignIn({ onDone, notice }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) { setError('Enter your e-mail and password.'); return; }
    setBusy(true); setError(null);
    const r = await api.signIn(email.trim(), password);
    setBusy(false);
    if (r.ok) onDone(r.data); else setError(r.message);
  };
  return (
    <Center>
      <Brand />
      <h1>Sign in</h1>
      <p class="muted">Halom staff only. Use the same account as in the owner app.</p>
      {notice && !error && <Notice tone="info">{notice}</Notice>}
      <form onSubmit={submit} novalidate>
        <label class="field"><span>E-mail</span>
          <input type="email" name="email" autocomplete="username" inputmode="email" autocapitalize="none" spellcheck={false} required value={email} onInput={(e) => setEmail(e.currentTarget.value)} />
        </label>
        <label class="field"><span>Password</span>
          <input type="password" name="password" autocomplete="current-password" required value={password} onInput={(e) => setPassword(e.currentTarget.value)} />
        </label>
        {error && <Notice tone="bad">{error}</Notice>}
        <button type="submit" class="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p class="muted small">No account yet? Create one in the <a href={STUDIO}>owner app</a>, then come back here with your staff code.</p>
    </Center>
  );
}

function StaffCode({ user, onStaff, onLeave, notice }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [tries, setTries] = useState(0);
  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const c = code.trim();
    if (!c) { setError('Enter the staff code you received.'); return; }
    setBusy(true); setError(null);
    const r = await api.redeemInvite(c);
    setBusy(false);
    if (r.ok) { onStaff(); return; }
    if (r.kind === 'signed_out') { onLeave('Your session ended. Sign in again.'); return; }
    setTries((n) => n + 1);
    setError(r.message);
  };
  return (
    <Center>
      <Brand />
      <h1>Staff code</h1>
      <p class="muted">Signed in as <T>{user && user.email}</T>. This account is not Halom staff yet. Enter the one-time code you received.</p>
      {notice && !error && <Notice tone="info">{notice}</Notice>}
      <form onSubmit={submit} novalidate>
        <label class="field"><span>Staff code</span>
          <input type="text" name="code" autocomplete="one-time-code" autocapitalize="none" spellcheck={false} maxlength={200} value={code} onInput={(e) => setCode(e.currentTarget.value)} />
        </label>
        {error && <Notice tone="bad">{error}{tries >= 3 ? ' If the code keeps failing, ask for a new one.' : ''}</Notice>}
        <button type="submit" class="btn btn-primary btn-block" disabled={busy}>{busy ? 'Checking…' : 'Unlock the back office'}</button>
      </form>
      <p class="muted small"><button type="button" class="link" onClick={() => onLeave()}>Sign out</button> to use another account.</p>
    </Center>
  );
}

// ---------------------------------------------------------------- routing (hash, so it works under any path prefix)
function parseHash() {
  const h = (location.hash || '').replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const seg = path.split('/').filter(Boolean);
  let id = null;
  try { id = seg[1] ? decodeURIComponent(seg[1]) : null; } catch { id = null; }
  return { view: ['overview', 'businesses', 'leads'].includes(seg[0]) ? seg[0] : 'overview', id, q: new URLSearchParams(qs || '') };
}
function useRoute() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => { const on = () => setRoute(parseHash()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return route;
}

// ---------------------------------------------------------------- the signed-in shell: data, refresh, navigation
function Shell({ user, onLeave, onNotStaff }) {
  const route = useRoute();
  const [raw, setRaw] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(null);
  const [, tick] = useState(0);
  const flight = useRef(null);
  const lastTry = useRef(0);

  const load = useCallback(() => {
    if (flight.current) return flight.current;
    setBusy(true); lastTry.current = Date.now();
    flight.current = (async () => {
      const r = await api.overview();
      flight.current = null; setBusy(false);
      if (r.ok) { setRaw(r.data); setLoadedAt(Date.now()); setError(null); return true; }
      if (r.kind === 'not_staff') { setRaw(null); onNotStaff(); return false; }
      if (r.kind === 'signed_out') { setRaw(null); onLeave('Your session ended. Sign in again.'); return false; }
      setError(r.message); return false;
    })();
    return flight.current;
  }, [onLeave, onNotStaff]);

  useEffect(() => {
    load();
    const every = window.__OPS_REFRESH_MS || 60000;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, every);
    const clock = setInterval(() => tick((n) => n + 1), 15000);
    const onVis = () => { if (document.visibilityState === 'visible' && Date.now() - lastTry.current >= every) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(timer); clearInterval(clock); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  // after a change: never reuse a request that started before the change
  const reload = useCallback(async () => { if (flight.current) await flight.current; return load(); }, [load]);

  useEffect(() => { window.scrollTo(0, 0); }, [route.view]);

  const d = useMemo(() => (raw ? derive(raw) : null), [raw]);
  const cfg = api.config();
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'businesses', label: 'Businesses', count: d ? d.kpi.businesses : null },
    { id: 'leads', label: 'Leads', count: d ? d.kpi.newLeads : null, countLabel: 'new' },
  ];

  return (
    <div class="shell">
      <a class="skip" href="#main">Skip to content</a>
      <header class="top">
        <div class="top-in">
          <a class="brand" href="#/overview" aria-label={`${PRODUCT.name} back office, overview`}>
            <span class="brand-mark" aria-hidden="true" />
            <div><strong>{PRODUCT.name} <span lang="he" dir="rtl">{PRODUCT.nameHe}</span></strong><span>Back office</span></div>
          </a>
          <nav class="tabs" aria-label="Sections">
            {tabs.map((t) => (
              <a key={t.id} href={`#/${t.id}`} class={'tab' + (route.view === t.id ? ' is-on' : '')} aria-current={route.view === t.id ? 'page' : undefined} data-tab={t.id}>
                {t.label}
                {t.count != null && (t.id !== 'leads' || t.count > 0) && <span class={'pill' + (t.id === 'leads' ? ' pill-hot' : '')}>{fmtInt(t.count)}{t.countLabel ? ' ' + t.countLabel : ''}</span>}
              </a>
            ))}
          </nav>
          <div class="top-right">
            <div class="updated" aria-live="polite" data-updated>
              {loadedAt ? <><span class="muted updated-word">Updated</span> <strong data-updated-at>{fmtClock(loadedAt)}</strong> <span class="muted updated-ago">· {ago(loadedAt, Date.now())}</span></> : <span class="muted">Not loaded yet</span>}
            </div>
            <button type="button" class="btn btn-sm" onClick={() => load()} disabled={busy} data-refresh aria-label={busy ? 'Refreshing' : 'Refresh now'}>
              <span class={busy ? 'spin' : ''}><Icon name="refresh" /></span><span class="btn-text">{busy ? 'Refreshing…' : 'Refresh'}</span>
            </button>
            <details class="acct">
              <summary aria-label="Account"><span class="acct-dot" aria-hidden="true">{(user.email || '?').slice(0, 1).toUpperCase()}</span></summary>
              <div class="acct-menu">
                <p class="muted small">Signed in as</p>
                <p class="acct-mail"><T>{user.email}</T></p>
                <button type="button" class="btn btn-sm btn-block" onClick={() => onLeave()} data-signout>Sign out</button>
              </div>
            </details>
          </div>
        </div>
      </header>

      <main id="main" class={'main' + (busy && d ? ' is-stale' : '')} tabIndex={-1}>
        {error && d && (
          <Notice tone="bad">
            Refresh failed: {error}{/[.!?]$/.test(error) ? '' : '.'} Showing the data from {fmtClock(loadedAt)}.{' '}
            <button type="button" class="link" onClick={() => load()}>Try again</button>
          </Notice>
        )}
        {!d && error && (
          <div class="panel pad">
            <Notice tone="bad">Could not load the data. {error}</Notice>
            <button type="button" class="btn btn-primary" onClick={() => load()} disabled={busy}>{busy ? 'Trying…' : 'Try again'}</button>
          </div>
        )}
        {!d && !error && <p class="boot" role="status">Loading the data…</p>}
        {d && route.view === 'overview' && <Overview d={d} />}
        {d && route.view === 'businesses' && <Businesses d={d} cfg={cfg} route={route} reload={reload} />}
        {d && route.view === 'leads' && <Leads d={d} route={route} reload={reload} />}
      </main>
      <footer class="foot muted small">
        {PRODUCT.name} back office · internal · times are Israel time · refreshes every minute while this tab is visible
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------- overview
function Tile({ id, label, value, href, tone, note }) {
  const body = (
    <>
      <span class="tile-label">{label}</span>
      <span class="tile-value" data-value>{fmtInt(value)}</span>
      {note && <span class={'tile-note' + (tone && value > 0 ? ' tile-note-' + tone : '')}>{tone && value > 0 && <Icon name={tone === 'bad' ? 'cross' : 'warn'} size={13} />}{note}</span>}
    </>
  );
  return href ? <a class="tile" href={href} data-kpi={id}>{body}</a> : <div class="tile" data-kpi={id}>{body}</div>;
}

function Overview({ d }) {
  const k = d.kpi;
  const firstDay = k.businesses === 0 && k.accountsWithoutBusiness === 0 && d.leads.length === 0;
  const hot = d.businesses.filter((b) => b.attention.some((a) => a.level !== 'info')).slice(0, 6);
  return (
    <div class="stack">
      <h1 class="page-title">Overview</h1>
      {firstDay && <Notice tone="info">Nothing here yet: no owner has signed up and no enquiry has come in. This page fills in by itself.</Notice>}
      <section aria-label="Key numbers" class="tiles" data-tiles>
        <Tile id="accountsWithoutBusiness" label="Accounts without a business" value={k.accountsWithoutBusiness} note="signed up, did not create one" />
        <Tile id="businesses" label="Businesses started" value={k.businesses} href="#/businesses" note="all time" />
        <Tile id="withItems" label="With at least 1 item" value={k.withItems} href="#/businesses?f=with-items" note="menu entered" />
        <Tile id="withApproved" label="With an approved picture" value={k.withApproved} href="#/businesses?f=with-approved" note="at least 1" />
        <Tile id="published" label="Published at least once" value={k.published} href="#/businesses?f=published-once" note="all time" />
        <Tile id="live" label="Live now" value={k.live} href="#/businesses?f=live" note="diners can open the menu" />
        <Tile id="trialSoon" label="Trials ending within 7 days" value={k.trialSoon} href="#/businesses?f=trial-soon" tone="warn" note={k.trialSoon ? 'talk to them now' : 'none'} />
        <Tile id="planOff" label="Plans expired or suspended" value={k.planOff} href="#/businesses?f=plan-off" tone="bad" note={k.planOff ? 'menus not available' : 'none'} />
        <Tile id="views7" label="Diner views, last 7 days" value={k.views7} href="#/businesses?f=with-views" note="menu opens" />
        <Tile id="newLeads" label="New leads" value={k.newLeads} href="#/leads?s=new" tone="warn" note={k.newLeads ? 'waiting for a first answer' : 'none waiting'} />
      </section>

      <section class="panel" aria-labelledby="funnel-h">
        <div class="panel-head">
          <h2 id="funnel-h">From sign-up to diners</h2>
          <p class="muted small">All time. Each step is counted on its own, so it matches the tile above. Sign-ups = accounts without a business + businesses.</p>
        </div>
        <Funnel steps={d.funnel} />
      </section>

      <div class="two">
        <section class="panel">
          <DayColumns id="signups" title="Businesses created" unit="business" units="businesses" series={d.signups}
            emptyText="No business was created in the last 30 days." />
        </section>
        <section class="panel">
          <DayColumns id="views" title="Diner views" unit="view" units="views" series={d.views}
            emptyText="No diner has opened a menu in the last 30 days." />
        </section>
      </div>

      {hot.length > 0 && (
        <section class="panel" aria-labelledby="att-h">
          <div class="panel-head row-between">
            <h2 id="att-h">Needs attention</h2>
            <a class="link" href="#/businesses?f=attention">All {fmtInt(k.attention)} <Icon name="chev" size={12} /></a>
          </div>
          <ul class="att-list">
            {hot.map((b) => (
              <li key={b.id}>
                <a href={`#/businesses/${encodeURIComponent(b.id)}`}><T>{b.name}</T></a>
                <span class="muted">{b.attention.filter((a) => a.level !== 'info').map((a) => a.text).join(' · ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

const mount = document.getElementById('app');
mount.replaceChildren();
render(<App />, mount);
