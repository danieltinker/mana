/**
 * The v2 back office's frame: the gate (sign in → your own staff row → the app; anyone else gets a plain "not staff"
 * screen), the shell (sections, account), and the hash routes, which work under any path prefix.
 *
 * Who counts as staff is the database's answer, not this page's: a person with a staff row whose session the database
 * refuses (42501 from a staff RPC) is shown why. When the refusal is the second step (`staff_require_aal2` on, and this
 * session password-only, aal1), the gate shows the second step instead (mfa.tsx, B118), then runs again on the aal2
 * session. A removed staff row always reads "Staff access removed" (SEC-N4), before and after the second step.
 */
import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { configFlags, type StaffRole } from '@mana/contracts';
import { opsApi } from './api.ts';
import { PRODUCT, parseRoute, type Route } from './model.ts';
import { connect, currentUser, onSignedOut, signIn, signOut, type Connection, type User } from './session.ts';
import { Brand, CtxContext, Icon, Mark, Notice, T, useCtx, type Ctx } from './ui.tsx';
import { Clients } from './clients.tsx';
import { Venue } from './venue.tsx';
import { Analytics } from './analytics.tsx';
import { Leads } from './leads.tsx';
import { SecondStep } from './mfa.tsx';

type SignedIn = User & { readonly aal: string | null };
type Phase =
  | { readonly at: 'boot' }
  | { readonly at: 'config'; readonly message: string }
  | { readonly at: 'signin'; readonly notice?: string }
  | { readonly at: 'checking'; readonly user: SignedIn }
  | { readonly at: 'gate-error'; readonly user: SignedIn; readonly message: string }
  /** `why`: none (never staff), removed (the staff row is gone), other. */
  | { readonly at: 'not-staff'; readonly user: SignedIn; readonly why: Refused }
  /** A staff row, but the database wants a second step (aal2) for this password-only session. */
  | { readonly at: 'second-step'; readonly user: SignedIn }
  | { readonly at: 'app'; readonly user: SignedIn; readonly role: StaffRole };

export function App({ config }: { config: unknown }) {
  const conn = useMemo(() => connect(config), [config]);
  const [phase, setPhase] = useState<Phase>(conn.ok ? { at: 'boot' } : { at: 'config', message: conn.message });
  const api = useMemo(() => (conn.ok ? opsApi(conn.value.backend) : null), [conn]);

  /** `wasStaff`: this person had a staff row earlier in this session (the second step), so none now means removed. */
  const check = useCallback(async (user: SignedIn, wasStaff = false) => {
    if (!api) return;
    setPhase({ at: 'checking', user });
    const r = await api.staffRole(user.id);
    if (!r.ok) {
      if (r.kind === 'signed_out') { setPhase({ at: 'signin', notice: r.message }); return; }
      setPhase({ at: 'gate-error', user, message: r.message });
      return;
    }
    if (!r.data) { setPhase({ at: 'not-staff', user, why: wasStaff ? 'removed' : 'none' }); return; }
    // a password-only session: one staff call first, so a database that wants the second step says so before any of
    // the back office is drawn (R4-L5); any other answer opens the app, whose pages say what went wrong
    if (user.aal !== 'aal2') {
      const probe = await api.venues({ limit: 1 });
      if (!probe.ok && probe.kind === 'not_staff') { setPhase({ at: 'second-step', user }); return; }
    }
    setPhase({ at: 'app', user, role: r.data });
  }, [api]);

  /** The database refused a staff call (42501): why, from the caller's own staff row, which RLS always lets them read. */
  const refusedWhy = useCallback(async (user: SignedIn): Promise<Refused> => {
    if (!api) return 'other';
    const r = await api.staffRole(user.id);
    if (!r.ok) return 'other';
    if (r.data === null) return 'removed';
    return user.aal !== 'aal2' ? 'aal1' : 'other';
  }, [api]);

  useEffect(() => {
    if (!conn.ok) return undefined;
    let alive = true;
    void currentUser(conn.value.client).then((u) => { if (alive) { if (u) void check(u); else setPhase({ at: 'signin' }); } });
    const off = onSignedOut(conn.value.client, () => setPhase({ at: 'signin' }));
    return () => { alive = false; off(); };
  }, [conn, check]);

  if (!conn.ok || !api) return <Center><Brand /><Notice tone="bad">{conn.ok ? 'Not configured.' : conn.message}</Notice></Center>;
  const client = conn.value.client;
  const leave = async (notice?: string) => { await signOut(client); setPhase({ at: 'signin', ...(notice ? { notice } : {}) }); };

  switch (phase.at) {
    case 'boot': case 'checking':
      return <Center><p class="boot" role="status">{phase.at === 'boot' ? 'Loading the back office…' : 'Checking your access…'}</p></Center>;
    case 'config':
      return <Center><Brand /><Notice tone="bad">{phase.message}</Notice></Center>;
    case 'signin':
      return <SignIn conn={conn.value} notice={phase.notice} onDone={(u) => void check(u)} />;
    case 'gate-error':
      return (
        <Center>
          <Brand />
          <Notice tone="bad">Could not check your access. {phase.message}</Notice>
          <div class="row">
            <button type="button" class="btn btn-primary" onClick={() => void check(phase.user)}>Try again</button>
            <button type="button" class="btn" onClick={() => void leave()}>Sign out</button>
          </div>
        </Center>
      );
    case 'not-staff':
      return <NotStaff user={phase.user} why={phase.why} api={api} onRetry={() => void check(phase.user)} onLeave={() => void leave()} />;
    case 'second-step':
      return (
        <Center>
          <Brand />
          <SecondStep conn={conn.value} email={phase.user.email} onDone={(u) => void check(u, true)} onLeave={() => void leave()} />
        </Center>
      );
    case 'app': {
      const user = phase.user;
      const ctx: Ctx = {
        conn: conn.value, api, user, role: phase.role, realtime: configFlags(conn.value.config).realtime,
        notStaff: () => { void refusedWhy(user).then((why) => setPhase(why === 'aal1' ? { at: 'second-step', user } : { at: 'not-staff', user, why })); },
        signedOut: () => void leave('Your session ended. Sign in again.'),
        recheck: async () => {
          const r = await api.staffRole(user.id);
          if (r.ok && r.data === null) { setPhase({ at: 'not-staff', user, why: 'removed' }); return false; }
          if (!r.ok && r.kind === 'signed_out') { void leave('Your session ended. Sign in again.'); return false; }
          return true;
        },
      };
      return <CtxContext.Provider value={ctx}><Shell onLeave={() => void leave()} /></CtxContext.Provider>;
    }
  }
}

function Center({ children }: { children: ComponentChildren }) {
  return <main class="gate"><div class="gate-card">{children}</div></main>;
}

function SignIn({ conn, onDone, notice }: { conn: Connection; onDone: (u: SignedIn) => void; notice?: string | undefined }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) { setError('Enter your e-mail and password.'); return; }
    setBusy(true); setError(null);
    const r = await signIn(conn.client, email.trim(), password);
    setBusy(false);
    if (r.ok) onDone(r.data); else setError(r.message);
  };
  return (
    <Center>
      <Brand />
      <h1>Sign in</h1>
      <p class="muted">Halom staff only.</p>
      {notice && !error && <Notice tone="info">{notice}</Notice>}
      <form onSubmit={submit} noValidate>
        <label class="field"><span>E-mail</span>
          <input type="email" name="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellcheck={false} required value={email}
            onInput={(e) => setEmail(e.currentTarget.value)} />
        </label>
        <label class="field"><span>Password</span>
          <input type="password" name="password" autoComplete="current-password" required value={password} onInput={(e) => setPassword(e.currentTarget.value)} />
        </label>
        {error && <Notice tone="bad">{error}</Notice>}
        <button type="submit" class="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </Center>
  );
}

/** Why the database refused: never staff, the staff row removed, the second step wanted (aal1), or something else. */
type Refused = 'none' | 'removed' | 'aal1' | 'other';

function NotStaff({ user, why, api, onRetry, onLeave }: {
  user: SignedIn; why: Refused; api: ReturnType<typeof opsApi>; onRetry: () => void; onLeave: () => void;
}) {
  const refused = why !== 'none';
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const redeem = async (e: Event) => {
    e.preventDefault();
    if (!code.trim()) { setMsg('Enter the code from your invite.'); return; }
    setBusy(true); setMsg(null);
    const r = await api.redeemInvite(code);
    setBusy(false);
    if (r.ok) onRetry(); else setMsg(r.message);
  };
  return (
    <Center>
      <Brand />
      <h1 data-not-staff>{why === 'removed' ? 'Staff access removed' : refused ? 'Not accepted as staff' : 'Not Halom staff'}</h1>
      <p>Signed in as <T>{user.email}</T>.</p>
      {refused ? (
        <div class="stack-s" data-refused={why}>
          <Notice tone="warn">
            {why === 'removed'
              ? 'This account is no longer on Halom’s staff: its staff access was removed, so nothing of the back office is shown. If that is a mistake, ask a Halom admin.'
              : 'This account is on Halom’s staff, but the database did not accept this session as staff. The session may be out of date: sign out and in again.'}
          </Notice>
          <div class="row"><button type="button" class="btn btn-primary" onClick={onRetry}>Try again</button><button type="button" class="btn" onClick={onLeave}>Sign out</button></div>
        </div>
      ) : (
        <>
          <p class="muted">The back office is for Halom’s staff. This account is not one of them, so nothing here is shown to it.</p>
          <button type="button" class="btn btn-primary btn-block" onClick={onLeave}>Sign out</button>
          <details class="invite">
            <summary>I have a staff invite code</summary>
            <form onSubmit={redeem} noValidate>
              <label class="field"><span>Invite code</span>
                <input type="text" autoComplete="one-time-code" autoCapitalize="none" spellcheck={false} maxLength={200} value={code} onInput={(e) => setCode(e.currentTarget.value)} />
              </label>
              {msg && <Notice tone="bad">{msg}</Notice>}
              <button type="submit" class="btn btn-sm" disabled={busy}>{busy ? 'Checking…' : 'Join Halom’s staff'}</button>
            </form>
          </details>
        </>
      )}
    </Center>
  );
}

// ---------------------------------------------------------------- routes

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

function Shell({ onLeave }: { onLeave: () => void }) {
  const route = useRoute();
  const { user, role } = useCtx();
  useEffect(() => { window.scrollTo(0, 0); }, [route.view, route.view === 'venue' ? route.id : '']);
  const tabs = [
    { id: 'clients', label: 'Clients', on: route.view === 'clients' || route.view === 'venue' },
    { id: 'analytics', label: 'Analytics', on: route.view === 'analytics' },
    { id: 'leads', label: 'Leads', on: route.view === 'leads' },
  ];
  return (
    <div class="shell v2">
      <a class="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to content</a>
      <header class="top">
        <div class="top-in">
          <a class="brand" href="#/clients" aria-label={`${PRODUCT.name} command center, clients`}>
            <Mark />
            <div><strong>{PRODUCT.name}</strong><span>command center</span></div>
          </a>
          <nav class="tabs" aria-label="Sections">
            {tabs.map((t) => (
              <a key={t.id} href={`#/${t.id}`} class={'tab' + (t.on ? ' is-on' : '')} aria-current={t.on ? 'page' : undefined} data-tab={t.id}>{t.label}</a>
            ))}
          </nav>
          <div class="top-right">
            <details class="acct">
              <summary aria-label="Account"><span class="acct-dot" aria-hidden="true">{(user.email || '?').slice(0, 1).toUpperCase()}</span></summary>
              <div class="acct-menu">
                <p class="muted small">Signed in as</p>
                <p class="acct-mail"><T>{user.email}</T></p>
                <p class="small" data-role={role}><Icon name="lock" size={13} /> Halom {role}</p>
                <button type="button" class="btn btn-sm btn-block" onClick={onLeave} data-signout>Sign out</button>
              </div>
            </details>
          </div>
        </div>
      </header>
      <main id="main" class="main" tabIndex={-1}>
        {route.view === 'clients' && <Clients />}
        {route.view === 'venue' && <Venue key={route.id} id={route.id} />}
        {route.view === 'analytics' && <Analytics venue={route.venue} />}
        {route.view === 'leads' && <Leads />}
      </main>
      <footer class="foot muted small">{PRODUCT.name} command center · internal · times are Israel time · demo venues are labelled and left out of real totals</footer>
    </div>
  );
}

