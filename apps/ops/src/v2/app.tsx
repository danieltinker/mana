/**
 * The v2 back office's frame: the gate (sign in → your own staff row → the app; anyone else gets a plain "not staff"
 * screen), the shell (sections, account), and the hash routes, which work under any path prefix.
 *
 * Who counts as staff is the database's answer, not this page's: a person with a staff row whose session the database
 * refuses (42501 from a staff RPC; today, when `staff_require_aal2` is on and the session is password-only, aal1) is
 * shown the same screen with the reason.
 */
import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import { configFlags, type StaffRole } from '@mana/contracts';
import { opsApi, type Fail } from './api.ts';
import { PRODUCT } from './model.ts';
import { connect, currentUser, onSignedOut, signIn, signOut, type Connection, type User } from './session.ts';
import { Brand, CtxContext, Icon, Mark, Notice, T, useCtx, type Ctx } from './ui.tsx';
import { Clients } from './clients.tsx';
import { Venue } from './venue.tsx';
import { Analytics } from './analytics.tsx';
import { Leads } from './leads.tsx';

type SignedIn = User & { readonly aal: string | null };
type Phase =
  | { readonly at: 'boot' }
  | { readonly at: 'config'; readonly message: string }
  | { readonly at: 'signin'; readonly notice?: string }
  | { readonly at: 'checking'; readonly user: SignedIn }
  | { readonly at: 'gate-error'; readonly user: SignedIn; readonly message: string }
  | { readonly at: 'not-staff'; readonly user: SignedIn; readonly refused: Fail | null }
  | { readonly at: 'app'; readonly user: SignedIn; readonly role: StaffRole };

export function App({ config }: { config: unknown }) {
  const conn = useMemo(() => connect(config), [config]);
  const [phase, setPhase] = useState<Phase>(conn.ok ? { at: 'boot' } : { at: 'config', message: conn.message });
  const api = useMemo(() => (conn.ok ? opsApi(conn.value.backend) : null), [conn]);

  const check = useCallback(async (user: SignedIn) => {
    if (!api) return;
    setPhase({ at: 'checking', user });
    const r = await api.staffRole(user.id);
    if (!r.ok) {
      if (r.kind === 'signed_out') { setPhase({ at: 'signin', notice: r.message }); return; }
      setPhase({ at: 'gate-error', user, message: r.message });
      return;
    }
    setPhase(r.data ? { at: 'app', user, role: r.data } : { at: 'not-staff', user, refused: null });
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
      return <NotStaff user={phase.user} refused={phase.refused} api={api} onRetry={() => void check(phase.user)} onLeave={() => void leave()} />;
    case 'app': {
      const ctx: Ctx = {
        conn: conn.value, api, user: phase.user, role: phase.role, realtime: configFlags(conn.value.config).realtime,
        notStaff: (f) => setPhase({ at: 'not-staff', user: phase.user, refused: f }),
        signedOut: () => void leave('Your session ended. Sign in again.'),
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

function NotStaff({ user, refused, api, onRetry, onLeave }: {
  user: SignedIn; refused: Fail | null; api: ReturnType<typeof opsApi>; onRetry: () => void; onLeave: () => void;
}) {
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
  const passwordOnly = user.aal !== 'aal2';
  return (
    <Center>
      <Brand />
      <h1 data-not-staff>{refused ? 'Not accepted as staff' : 'Not Halom staff'}</h1>
      <p>Signed in as <T>{user.email}</T>.</p>
      {refused ? (
        <div data-refused={passwordOnly ? 'aal1' : 'other'}>
          <Notice tone="warn">
            This account has a staff row, but the database did not accept this session as staff.{' '}
            {passwordOnly
              ? `It was signed in with a password only (${user.aal ?? 'no assurance level'}), and staff access needs a second step (MFA). This back office does not offer that step yet.`
              : 'Your staff access may have been removed, or the session may be out of date.'}
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

export type Route =
  | { readonly view: 'clients' }
  | { readonly view: 'venue'; readonly id: string }
  | { readonly view: 'analytics'; readonly venue: string | null }
  | { readonly view: 'leads' };

export function parseRoute(hash: string): Route {
  const [path = '', qs = ''] = hash.replace(/^#\/?/, '').split('?');
  const seg = path.split('/').filter(Boolean);
  const q = new URLSearchParams(qs);
  if (seg[0] === 'venues' && seg[1]) return { view: 'venue', id: decodeURIComponent(seg[1]) };
  if (seg[0] === 'analytics') return { view: 'analytics', venue: q.get('venue') };
  if (seg[0] === 'leads') return { view: 'leads' };
  return { view: 'clients' };
}
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

