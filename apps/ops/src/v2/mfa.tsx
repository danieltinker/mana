/**
 * The second sign-in step (B118, ADR-003): when the database wants staff sessions at aal2 (`staff_require_aal2`) and
 * this one is password-only, the gate shows this screen instead of a dead end.
 *
 * - A verified TOTP factor: one code field; a challenge and the code (Supabase Auth's challengeAndVerify), then the
 *   gate runs again on the new (aal2) session.
 * - None: this back office's unverified leftovers are removed, a TOTP factor is enrolled, and its QR code (an <img> of a
 *   data: URL, never markup) and its secret as text are shown with one line on what to do; then the same code field.
 *
 * The secret lives only in this screen's state while it is open: never logged, stored, put in a URL, or kept after.
 * The field is cleared after every try. "Sign out" is always there.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { codeOf, isCode, mfaWords, qrSrc } from './mfa.ts';
import { mfaEnroll, mfaFactors, mfaVerify, type Connection, type Enrollment, type User } from './session.ts';
import { Notice, T } from './ui.tsx';

type Step =
  | { readonly at: 'loading' }
  | { readonly at: 'failed'; readonly message: string }
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

  const start = async () => {
    setStep({ at: 'loading' }); setError(null);
    const f = await mfaFactors(conn.client);
    if (!alive.current) return;
    if (!f.ok) { if (f.why === 'signed_out') onLeave(); else setStep({ at: 'failed', message: mfaWords(f) }); return; }
    if (f.data.verified) { setStep({ at: 'verify', factorId: f.data.verified }); return; }
    const e = await mfaEnroll(conn.client, f.data.leftovers, qrSrc);
    if (!alive.current) return;
    if (!e.ok) { if (e.why === 'signed_out') onLeave(); else setStep({ at: 'failed', message: mfaWords(e) }); return; }
    setStep({ at: 'enroll', e: e.data });
  };
  useEffect(() => { alive.current = true; void start(); return () => { alive.current = false; }; }, []);
  useEffect(() => { if (step.at === 'verify' || step.at === 'enroll') field.current?.focus(); }, [step.at]);

  const submit = async (ev: Event) => {
    ev.preventDefault();
    if (busy || (step.at !== 'verify' && step.at !== 'enroll')) return;
    const typed = codeOf(code);
    setCode('');                                   // cleared after every try
    if (!isCode(typed)) { setError('Enter the 6 digits from your authenticator app.'); field.current?.focus(); return; }
    setBusy(true); setError(null);
    const r = await mfaVerify(conn.client, step.at === 'verify' ? step.factorId : step.e.factorId, typed);
    if (!alive.current) return;
    setBusy(false);
    if (!r.ok) {
      if (r.why === 'signed_out') { onLeave(); return; }
      setError(mfaWords(r)); field.current?.focus(); return;
    }
    setStep({ at: 'loading' });                    // the secret leaves the page with the enrollment
    onDone(r.data);
  };

  const ready = step.at === 'verify' || step.at === 'enroll';
  return (
    <div class="stack-s" data-second-step={step.at}>
      <h1>Second step</h1>
      <p>Signed in as <T>{email}</T>.</p>
      {step.at === 'loading' && <p class="boot" role="status">Checking your second step…</p>}
      {step.at === 'failed' && (
        <>
          <Notice tone="bad"><span data-mfa-error>{step.message}</span></Notice>
          <button type="button" class="btn btn-primary btn-block" onClick={() => void start()}>Try again</button>
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
          <p class="mono mfa-secret" data-mfa-secret>{step.e.secret}</p>
          <p class="muted small">The key is shown only here, while you set up the app.</p>
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
