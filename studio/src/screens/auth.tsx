// The start: one screen. A button per provider that is switched on, then e-mail and password with ONE button:
// it signs in, and when there is no such account yet it makes one (through menus-signup) and signs in.
import { useEffect, useRef, useState } from 'preact/hooks';
import { PRODUCT } from '../product.ts';
import { cfg, sb, signUp, toAppError, sibling, ownAddress } from '../lib/api.ts';
import { t, errText } from '../lib/i18n.ts';
import { cleanEmail, emailProblem } from '../lib/email.ts';
import { Btn, Field, Note, Icon } from '../ui.tsx';
import { Brand, LangToggle, DishRise, ProviderMark } from '../brand.tsx';

const SIGNUP_CODES = ['invalid_email', 'email_rejected', 'weak_password', 'rate_limited', 'spam'];

export function StartScreen({ notice }: { notice?: string }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [hp, setHp] = useState('');
  const [show, setShow] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState(notice || ''), [forgot, setForgot] = useState(false);
  const opened = useRef(Date.now());
  const emailRef = useRef<HTMLInputElement>(null), pwRef = useRef<HTMLInputElement>(null);
  const providers = cfg!.auth.providers;
  useEffect(() => { if (notice) setError(notice); }, [notice]);

  async function withProvider(p: string) {
    if (busy) return;
    setBusy(p); setError('');
    try {
      const { error: err } = await sb.auth.signInWithOAuth({ provider: p as any, options: { redirectTo: ownAddress() } });
      if (err) { setError(errText(toAppError(err).code)); setBusy(''); }
      // otherwise the browser is already on its way to the provider
    } catch (e) { setError(errText(toAppError(e).code)); setBusy(''); }
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    // the address as the service will read it: no stray marks, no trailing full stop, lower case; the field shows the same
    const mail = cleanEmail(email);
    if (mail !== email) setEmail(mail);
    setForgot(false);
    const problem = emailProblem(mail);
    if (problem) { setError(t('auth.e.email.' + problem)); emailRef.current?.focus(); return; }
    if (!password) { setError(t('auth.e.no_password')); pwRef.current?.focus(); return; }
    setBusy('mail'); setError('');
    try {
      const first = await sb.auth.signInWithPassword({ email: mail, password });
      if (!first.error) return;                                             // signed in: the app moves on by itself
      const code = toAppError(first.error).code;
      if (code === 'network' || code === 'rate_limited') { setError(errText(code)); return; }
      // not signed in: either there is no such account yet, or the password is wrong. The sign-up function tells which.
      if (password.length < 8 || password.length > 72) { setError(t('auth.e.short')); setForgot(true); return; }
      const elapsed = Date.now() - opened.current;
      if (elapsed < 2500) await new Promise((r) => setTimeout(r, 2500 - elapsed));      // a password manager fills the form faster than the spam check allows
      const made = await signUp(mail, password, hp, Date.now() - opened.current);
      if (!made.ok) {
        if (made.code === 'exists') { setError(t('auth.e.wrong_password')); setForgot(true); pwRef.current?.focus(); return; }
        setError(t('auth.e.' + (SIGNUP_CODES.includes(made.code || '') ? made.code : 'failed')));
        return;
      }
      const second = await sb.auth.signInWithPassword({ email: mail, password });
      if (second.error) setError(t('auth.e.created_no_login'));
    } catch (e2) { setError(errText(toAppError(e2).code)); }
    finally { setBusy(''); }
  }

  return (
    <div class="start">
      <main class="start-main" id="main">
        <p class="start-brand"><Brand big /></p>
        <h1 class="start-line">{t('auth.title')}</h1>
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
          <div class="hp" aria-hidden="true"><label>Website<input type="text" name="website" tabIndex={-1} autocomplete="off" value={hp} onInput={(e) => setHp((e.target as HTMLInputElement).value)} /></label></div>
          {error && <Note kind="error">{error}{forgot && <> <a href={PRODUCT.whatsapp} target="_blank" rel="noopener noreferrer">{t('auth.forgotLink')}</a></>}</Note>}
          <Btn type="submit" kind="primary" block busy={busy === 'mail'} disabled={!!busy && busy !== 'mail'}>{t('auth.continue')}</Btn>
          <p class="fine center">{t('auth.newNote')}</p>
        </form>

        <nav class="start-links" aria-label={t('auth.links')}>
          <LangToggle plain />
          <a class="linkbtn" href={sibling(cfg!.sitePath || '../')} data-link="site"><Icon name="chev" size={15} back /><bdi dir="ltr">{PRODUCT.en}</bdi></a>
          <a class="linkbtn" href={sibling(cfg!.viewPath || '../view/', '?demo=olea')} target="_blank" rel="noopener noreferrer" data-link="demo"><Icon name="eye" size={16} /><span>{t('auth.demo')}</span></a>
          <a class="linkbtn" href={PRODUCT.whatsapp} target="_blank" rel="noopener noreferrer" data-link="forgot"><Icon name="chat" size={16} /><span>{t('auth.forgot')}</span></a>
        </nav>
      </main>
    </div>
  );
}
