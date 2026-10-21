/**
 * The second sign-in step (B118, ADR-003): when the database wants staff sessions at aal2 (`staff_require_aal2`) and
 * this one is password-only, the gate shows this screen instead of a dead end.
 *
 * - A verified TOTP factor: one code field; a challenge and the code (Supabase Auth's challengeAndVerify), then the
 *   gate runs again on the new (aal2) session.
 * - None: this back office's unverified leftovers are removed, a TOTP factor is enrolled, and its QR code (an <img> of a
 *   data: URL, never markup) and its key as text (in groups of four) are shown with what to do; then the same field.
 *   Only the newest key works: a reload or a second tab starts a new set-up, and the screen says so.
 *
 * The key lives only in this screen's state while it is open: never logged, stored, put in a URL, or kept after. It
 * leaves the page on `pagehide`, so the back-forward cache never keeps it (N16), and a page brought back from that
 * cache starts over. The field is cleared after every try. "Sign out" is always there.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { codeOf, isCode, keyGroups, mfaWords, qrSrc } from './mfa.ts';
import { mfaEnroll, mfaFactors, mfaVerify, type Connection, type Enrollment, type MfaFail, type User } from './session.ts';
import { Notice, T } from './ui.tsx';

type Step =
  | { readonly at: 'loading' }
  | { readonly at: 'failed'; readonly message: string; readonly retry: string }
  | { readonly at: 'verify'; readonly factorId: string }
  | { readonly at: 'enroll'; readonly e: Enrollment };

export function SecondStep({ conn, email, onDone, onLeave }: {
  conn: Connection; email: string; onDone: (u: User & { aal: string | null }) => void; onLeave: () => void;
}) {
  const [step, setStep] = useState<Step>({ at: 'loading' });
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  const field = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);

  const failed = (f: MfaFail, at: 'load' | 'setup' | 'code') => {
    if (f.why === 'signed_out') { onLeave(); return; }
    setStep({ at: 'failed', message: mfaWords(f, at), retry: f.why === 'gone' ? (at === 'code' ? 'Set it up again' : 'Start again here') : 'Try again' });
  };
  const start = async () => {
    setStep({ at: 'loading' }); setError(null); setCode('');
    const f = await mfaFactors(conn.client);
    if (!alive.current) return;
    if (!f.ok) { failed(f, 'load'); return; }
    if (f.data.verified) { setStep({ at: 'verify', factorId: f.data.verified }); return; }
    const e = await mfaEnroll(conn.client, f.data.leftovers, qrSrc);
    if (!alive.current) return;
    if (!e.ok) { failed(e, 'load'); return; }
    setStep({ at: 'enroll', e: e.data });
  };
  useEffect(() => {
    alive.current = true;
    void start();
    // the back-forward cache (N16): the key leaves the page before it is kept, and a page brought back starts over
    const hide = () => {
      box.current?.querySelectorAll('[data-mfa-secret]').forEach((el) => { el.textContent = ''; });
      box.current?.querySelectorAll('img[data-mfa-qr]').forEach((el) => el.removeAttribute('src'));
      setStep({ at: 'loading' }); setCode(''); setError(null);
    };
    const show = (ev: PageTransitionEvent) => { if (ev.persisted) void start(); };
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    return () => { alive.current = false; window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show); };
  }, []);
  useEffect(() => { if (step.at === 'verify' || step.at === 'enroll') field.current?.focus(); }, [step.at]);

  const submit = async (ev: Event) => {
    ev.preventDefault();
    if (busy || (step.at !== 'verify' && step.at !== 'enroll')) return;
    const at = step.at === 'enroll' ? 'setup' : 'code';
    const typed = codeOf(code);
    setCode('');                                   // cleared after every try
    if (!isCode(typed)) { setError('Enter the 6 digits from your authenticator app.'); field.current?.focus(); return; }
    setBusy(true); setError(null);
    const r = await mfaVerify(conn.client, step.at === 'verify' ? step.factorId : step.e.factorId, typed);
    if (!alive.current) return;
    setBusy(false);
    if (!r.ok) {
      // a set-up replaced on another tab or device (R4-L1), or an authenticator removed: say so, offer to start again
      if (r.why === 'gone' || r.why === 'signed_out') { failed(r, at); return; }
      setError(mfaWords(r, at)); field.current?.focus(); return;
    }
    setStep({ at: 'loading' });                    // the key leaves the page with the set-up
    onDone(r.data);
  };

  const ready = step.at === 'verify' || step.at === 'enroll';
  return (
    <div class="stack-s" ref={box} data-second-step={step.at}>
      <h1>Second step</h1>
      <p>Signed in as <T>{email}</T>.</p>
      {step.at === 'loading' && <p class="boot" role="status">Checking your second step…</p>}
      {step.at === 'failed' && (
        <>
          <Notice tone="bad"><span data-mfa-error>{step.message}</span></Notice>
          <button type="button" class="btn btn-primary btn-block" onClick={() => void start()} data-mfa-restart>{step.retry}</button>
        </>
      )}
      {step.at === 'verify' && (
        <p data-mfa-verify>Halom staff sign in with a password and a code from their authenticator app. Enter the 6-digit code it shows now.</p>
      )}
      {step.at === 'enroll' && (
        <div class="stack-s" data-mfa-enroll>
          <p>Halom staff sign in with a password and a code from an authenticator app. Set it up once: add this account to an
            authenticator app (scan the code, or type the key), then enter the 6-digit code the app shows.</p>
          {step.e.qr && <img class="mfa-qr" src={step.e.qr} alt="QR code that adds this account to an authenticator app" width={220} height={220} data-mfa-qr />}
          <p class="small">The key, to type into the app:</p>
          <p class="mono mfa-secret" data-mfa-secret>{keyGroups(step.e.secret).map((g, i) => <span key={i}>{g}</span>)}</p>
          <p class="muted small" data-mfa-newest>Only this key works, and it is shown only here. A reload or another tab starts a new
            one: if the app already has an older entry for this account, delete it.</p>
        </div>
      )}
      {ready && (
        <form onSubmit={submit} noValidate>
          <label class="field"><span>Code from your authenticator app</span>
            <input ref={field} type="text" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" autoCapitalize="none"
              spellcheck={false} value={code} onInput={(e) => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))} data-mfa-code />
          </label>
          {error && <Notice tone="bad"><span data-mfa-error>{error}</span></Notice>}
          <button type="submit" class="btn btn-primary btn-block" disabled={busy} data-mfa-go>{busy ? 'Checking…' : 'Continue'}</button>
        </form>
      )}
      <button type="button" class="btn btn-block" onClick={onLeave}>Sign out</button>
    </div>
  );
}
