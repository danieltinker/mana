// The start: the same one screen as v1 (a button per sign-in provider that is on, then e-mail and password with one
// "Continue" that signs in, or opens an account when there is none), on Supabase Auth itself. The clean schema needs a
// confirmed e-mail before a place can be made, so a new account waits for its confirmation link, and the screen says so.
import { useEffect, useRef, useState } from 'preact/hooks';
import { PRODUCT } from '../../product.ts';
import { ownAddress, sibling } from '../../lib/api.ts';
import { cleanEmail, emailProblem } from '../../lib/email.ts';
import { Brand, DishRise, LangToggle, ProviderMark } from '../../brand.tsx';
import { Btn, Field, Icon, Ltr, Note } from '../../ui.tsx';
import { cfg, sb } from '../data/client.ts';
import { toV2Error } from '../data/errors.ts';
import { named } from '../data/rows.ts';
import { sessionEnded } from '../data/store.ts';
import { errText, lang, t } from '../i18n.ts';

type Waiting = { email: string; sent: boolean };

export function StartScreen() {
  // the session ended by itself (not the owner's sign-out): said, with the rows whose latest changes may not be saved
  const ended = sessionEnded.value;
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [show, setShow] = useState(false);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [waiting, setWaiting] = useState<Waiting | null>(null);
  const emailRef = useRef<HTMLInputElement>(null), pwRef = useRef<HTMLInputElement>(null);
  const providers = cfg!.auth.providers;
  // whether "Continue" can open a new account here: the sign-in service says (sign-up may be off, as on the local stack)
  const [signupOpen, setSignupOpen] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    fetch(cfg!.supabaseUrl.replace(/\/$/, '') + '/auth/v1/settings', { headers: { apikey: cfg!.supabaseKey } })
      .then((r) => (r.ok ? r.json() : null)).then((s) => { if (live && s && typeof s.disable_signup === 'boolean') setSignupOpen(!s.disable_signup); })
      .catch(() => { /* unknown: the usual note stays */ });
    return () => { live = false; };
  }, []);

  async function withProvider(p: string) {
    if (busy) return;
    setBusy(p); setError('');
    try {
      const { error: err } = await sb.auth.signInWithOAuth({ provider: p as any, options: { redirectTo: ownAddress() } });
      if (err) { setError(errText(toV2Error(err).code, 'auth.e')); setBusy(''); }
    } catch (e) { setError(errText(toV2Error(e).code, 'auth.e')); setBusy(''); }
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    const mail = cleanEmail(email);
    if (mail !== email) setEmail(mail);
    const problem = emailProblem(mail);
    if (problem) { setError(t('auth.e.email.' + problem)); emailRef.current?.focus(); return; }
    if (!password) { setError(t('auth.e.no_password')); pwRef.current?.focus(); return; }
    setBusy('mail'); setError('');
    try {
      const first = await sb.auth.signInWithPassword({ email: mail, password });
      if (!first.error) return;                                             // signed in: the app moves on by itself
      const code = toV2Error(first.error).code;
      if (code === 'email_unconfirmed') { setWaiting({ email: mail, sent: false }); return; }
      if (code !== 'bad_login') { setError(errText(code, 'auth.e')); return; }
      // no such account, or the wrong password: opening an account tells which
      if (password.length < 8 || password.length > 72) { setError(t('auth.e.short')); return; }
      const made = await sb.auth.signUp({ email: mail, password, options: { emailRedirectTo: ownAddress() } });
      if (made.error) { setError(errText(toV2Error(made.error).code, 'auth.e')); return; }
      if (made.data.session) return;                                        // confirmation is off here: signed in already
      if (made.data.user && (made.data.user.identities ?? []).length === 0) { setError(t('auth.e.wrong_password')); pwRef.current?.focus(); return; }
      setWaiting({ email: mail, sent: true });
    } catch (e2) { setError(errText(toV2Error(e2).code, 'auth.e')); }
    finally { setBusy(''); }
  }

  async function resend() {
    if (!waiting || busy) return;
    setBusy('resend'); setError('');
    try {
      const { error: err } = await sb.auth.resend({ type: 'signup', email: waiting.email, options: { emailRedirectTo: ownAddress() } });
      if (err) setError(errText(toV2Error(err).code, 'auth.e')); else setWaiting({ ...waiting, sent: true });
    } catch (e) { setError(errText(toV2Error(e).code, 'auth.e')); }
    finally { setBusy(''); }
  }

  if (waiting) return (
    <div class="start">
      <header class="start-top"><Brand small /><LangToggle /></header>
      <main class="start-main" id="main" data-screen="confirm-email">
        <span class="empty-ico start-ico"><Icon name="info" size={26} /></span>
        <h1 class="center">{t('start.confirm.title')}</h1>
        <p class="center">{waiting.sent ? t('start.confirm.sent') : t('start.confirm.needed')} <Ltr class="strong">{waiting.email}</Ltr></p>
        <p class="center muted">{t('start.confirm.then')}</p>
        {error && <Note kind="error">{error}</Note>}
        <Btn kind="primary" block onClick={() => { setWaiting(null); setPassword(''); }}>{t('start.confirm.back')}</Btn>
        <Btn kind="ghost" busy={busy === 'resend'} onClick={resend}>{t('start.confirm.resend')}</Btn>
      </main>
    </div>
  );

  return (
    <div class="start">
      <main class="start-main" id="main" data-screen="start">
        <p class="start-brand"><Brand big /></p>
        <h1 class="start-line">{t('auth.title')}</h1>
        {ended && <Note kind="error"><span data-session-ended>{t('session.ended')}</span>
          {ended.unsaved.length > 0 && <> <span data-session-unsaved>{t('session.unsaved', { names: ended.unsaved.map((n) => '"' + named({ name_he: n.he, name_en: n.en }, lang.value) + '"').join(', ') })}</span></>}</Note>}
        <DishRise />
        {providers.length > 0 && <>
          <div class="providers">
            {providers.map((p) => (
              <button key={p} type="button" class={'btn btn-secondary btn-block provider' + (busy === p ? ' is-busy' : '')} data-provider={p} disabled={!!busy} onClick={() => withProvider(p)}>
                {busy === p ? <span class="spin" aria-hidden="true" /> : <ProviderMark name={p} />}<span class="btn-txt">{t('auth.with.' + p)}</span>
              </button>
            ))}
          </div>
          <p class="or" aria-hidden="true"><span>{t('auth.or')}</span></p>
        </>}
        <form class="start-form" onSubmit={submit} noValidate>
          <Field label={t('auth.email')}>{(p) => <input {...p} ref={emailRef} type="email" name="email" dir="ltr" autocomplete="email" inputMode="email" autocapitalize="none" spellcheck={false} required value={email} onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />}</Field>
          <Field label={t('auth.password')}>{(p) => (
            <div class="pw">
              <input {...(p as any)} ref={pwRef} type={(show ? 'text' : 'password') as any} name="password" dir="ltr" autocomplete="current-password" required maxLength={72} value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />
              <button type="button" class="pw-toggle" aria-pressed={show ? 'true' : 'false'} onClick={() => setShow(!show)}>{show ? t('auth.hide') : t('auth.show')}</button>
            </div>
          )}</Field>
          {error && <Note kind="error">{error}</Note>}
          <Btn type="submit" kind="primary" block busy={busy === 'mail'} disabled={!!busy && busy !== 'mail'}>{t('auth.continue')}</Btn>
          <p class="fine center" data-signup={signupOpen === false ? 'closed' : 'open'}>{t(signupOpen === false ? 'start.closedNote' : 'start.newNote')}</p>
        </form>
        <nav class="start-links" aria-label={t('auth.links')}>
          <LangToggle plain />
          <a class="linkbtn" href={sibling(cfg!.sitePath || '../')} data-link="site"><Icon name="chev" size={15} back /><bdi>{lang.value === 'he' ? PRODUCT.he : PRODUCT.en.toLowerCase()}</bdi></a>
          <a class="linkbtn" href={PRODUCT.whatsapp} target="_blank" rel="noopener noreferrer" data-link="forgot"><Icon name="chat" size={16} /><span>{t('auth.forgot')}</span></a>
        </nav>
      </main>
    </div>
  );
}
