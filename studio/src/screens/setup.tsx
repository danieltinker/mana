// "What is your place called?" One field and the kind; the address is suggested from the name and checked while
// the owner types. One tap makes the business. Contact details are not asked here (they are optional, after publishing).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { sb, q, toAppError } from '../lib/api.ts';
import { t, errText } from '../lib/i18n.ts';
import { loadBusinesses, signOut, session } from '../lib/store.ts';
import { suggestSlug, slugProblem } from '../lib/slug.ts';
import { Btn, Note, Ltr, go, Icon } from '../ui.tsx';
import { Brand, LangToggle } from '../brand.tsx';

export const KINDS = ['restaurant', 'cafe', 'bar', 'bakery', 'food_truck', 'other'];
const HEBREW = /[֐-׿]/;

export function SetupScreen({ first }: { first: boolean }) {
  const [name, setName] = useState(''), [kind, setKind] = useState('restaurant');
  const [typed, setTyped] = useState(''), [touched, setTouched] = useState(false), [editing, setEditing] = useState(false), [bump, setBump] = useState(0);
  const [avail, setAvail] = useState<'idle' | 'checking' | 'free' | 'taken' | 'error'>('idle');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null), slugRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const clean = name.trim();
  const isHe = HEBREW.test(clean);
  // the address follows the name until the owner edits it by hand; a suggestion that is taken moves on to -2, -3, … by itself
  const base = useMemo(() => suggestSlug(isHe ? '' : clean, isHe ? clean : ''), [clean]);
  const slug = touched ? typed : bump ? base.slice(0, 37) + '-' + (bump + 1) : base;
  const showEdit = editing || (clean !== '' && slug === '');

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => { setBump(0); }, [base]);

  const problem = slug ? slugProblem(slug) : '';
  useEffect(() => {
    if (!slug || problem) { setAvail('idle'); return; }
    setAvail('checking');
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const free = await q<boolean>(sb.rpc('slug_available', { p_slug: slug }));
        if (mine !== seq.current) return;
        if (!free && !touched && bump < 6) { setBump(bump + 1); return; }
        setAvail(free ? 'free' : 'taken');
        if (!free) setEditing(true);
      } catch { if (mine === seq.current) setAvail('error'); }
    }, 350);
    return () => clearTimeout(timer);
  }, [slug, problem]);
  const openEdit = () => { if (!touched) setTyped(slug); setEditing(true); setTimeout(() => slugRef.current?.focus(), 0); };

  async function create(e: Event) {
    e.preventDefault(); setError('');
    if (!clean) { setError(t('setup.nameMissing')); nameRef.current?.focus(); return; }
    if (!slug || problem || avail === 'taken') { openEdit(); return; }
    if (busy) return;
    setBusy(true);
    try {
      const r = await q<any>(sb.rpc('create_business', { p_slug: slug, p_name_he: isHe ? clean : '', p_name_en: isHe ? '' : clean, p_kind: kind, p_contact_name: '', p_contact_phone: '' }));
      if (!r || !r.ok) {
        const code = (r && r.code) || 'unknown';
        setError(errText(code, 'setup.e'));
        if (code === 'slug_taken') { setAvail('taken'); setEditing(true); }
        if (code === 'signed_out') signOut();
        return;
      }
      go('', true);
      await loadBusinesses(r.id);
    } catch (e2) { setError(errText(toAppError(e2).code)); }
    finally { setBusy(false); }
  }
  const mail = session.value?.user?.email || '';
  const slugMsg = slug && problem ? t('setup.slug.' + problem) : avail === 'taken' ? t('setup.slugTaken') : '';

  return (
    <div class="start">
      <header class="start-top"><Brand small /><LangToggle /></header>
      <main class="start-main setup" id="main">
        <form class="setup-form" onSubmit={create} noValidate>
          <h1><label for="place-name">{t('setup.title')}</label></h1>
          <input id="place-name" ref={nameRef} class="bigfield" type="text" dir="auto" maxLength={80} autocomplete="organization" enterkeyhint="go" value={name} data-field="place" aria-describedby="place-addr"
            onInput={(e) => { setName((e.target as HTMLInputElement).value); setError(''); }} />

          <div class="addr" id="place-addr" data-avail={problem ? 'bad' : avail}>
            {!showEdit ? (
              <p class="addr-line">
                <Ltr class="addr-url">halom.io/m/<strong data-slug>{slug || '…'}</strong></Ltr>
                {slug && !problem && avail === 'checking' && <span class="spin spin-sm" aria-hidden="true" />}
                {slug && !problem && avail === 'free' && <span class="addr-ok"><Icon name="check" size={15} /></span>}
                <span class="addr-perm">{t('setup.permanent')}</span>
                <button type="button" class="linkbtn addr-edit" onClick={openEdit}><Icon name="edit" size={15} /><span>{t('setup.edit')}</span></button>
              </p>
            ) : (
              <div class="addr-box">
                <label class="sr" for="place-slug">{t('setup.slug')}</label>
                <div class={'slugbox' + (slugMsg ? ' is-bad' : '')} dir="ltr"><span class="slugbox-pre">halom.io/m/</span>
                  <input id="place-slug" ref={slugRef} type="text" dir="ltr" lang="en" autocapitalize="none" autocomplete="off" spellcheck={false} maxLength={40} value={slug} data-field="slug"
                    onInput={(e) => { setTouched(true); setTyped((e.target as HTMLInputElement).value.toLowerCase().replace(/\s+/g, '-')); }} />
                </div>
                <p class="addr-state" role="status" aria-live="polite">
                  {slugMsg ? <span class="ferr">{slugMsg}</span>
                    : avail === 'checking' ? <><span class="spin spin-sm" aria-hidden="true" />{t('setup.slugChecking')}</>
                    : avail === 'free' ? <span class="addr-ok"><Icon name="check" size={15} />{t('setup.slugFree')}</span>
                    : avail === 'error' ? t('setup.slugCheckFailed') : null}
                </p>
                <p class="hint">{t('setup.slugPermanent')}</p>
              </div>
            )}
          </div>

          <div class="kinds" role="radiogroup" aria-label={t('setup.kind')}>
            {KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k ? 'true' : 'false'} class="kind" data-kind={k} onClick={() => setKind(k)}>
                <Icon name={k} size={24} /><span>{t('kind.' + k)}</span>
              </button>
            ))}
          </div>

          {error && <Note kind="error">{error}</Note>}
          <Btn type="submit" kind="primary" block busy={busy} disabled={avail === 'checking' && !!clean}>{t('app.next')}</Btn>
        </form>
        <p class="start-who fine center">
          {!first ? <button type="button" class="linkbtn" onClick={() => go('')}>{t('app.cancel')}</button>
            : <>{mail && <Ltr>{mail}</Ltr>} <button type="button" class="linkbtn" onClick={() => signOut()}>{t('app.signOut')}</button></>}
        </p>
      </main>
    </div>
  );
}
