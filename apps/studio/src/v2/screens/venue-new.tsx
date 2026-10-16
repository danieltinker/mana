// A new place: its name, its kind, and its permanent menu address (create_venue, checked with slug_available while
// the owner types). The database makes places only for a confirmed e-mail address: until then this screen says so
// instead of offering a button that would be refused.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { VENUE_KINDS, type VenueKind } from '@mana/contracts';
import { shortText } from '../../lib/links.ts';
import { slugProblem, suggestSlug } from '../../lib/slug.ts';
import { Brand, LangToggle } from '../../brand.tsx';
import { Btn, Icon, Ltr, Note, go } from '../../ui.tsx';
import { toV2Error } from '../data/errors.ts';
import * as api from '../data/menu.ts';
import { loadMemberships, session, signOut } from '../data/store.ts';
import { errText, lang, t } from '../i18n.ts';

const HEBREW = /[֐-׿]/;

export function VenueNewScreen({ first }: { first: boolean }) {
  const confirmed = !!session.value?.user?.email_confirmed_at;
  const [name, setName] = useState(''), [kind, setKind] = useState<VenueKind>('restaurant');
  const [typed, setTyped] = useState(''), [touched, setTouched] = useState(false), [editing, setEditing] = useState(false), [bump, setBump] = useState(0);
  const [avail, setAvail] = useState<'idle' | 'checking' | 'free' | 'taken' | 'error'>('idle');
  const [error, setError] = useState(''), [unconfirmed, setUnconfirmed] = useState(!confirmed), [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null), slugRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const clean = name.trim(), isHe = HEBREW.test(clean);
  // the address follows the name until the owner edits it; a suggestion that is taken moves on to -2, -3, … by itself
  const base = useMemo(() => suggestSlug(isHe ? '' : clean, isHe ? clean : ''), [clean]);
  const slug = touched ? typed : bump ? base.slice(0, 37) + '-' + (bump + 1) : base;
  const showEdit = editing || (clean !== '' && slug === '');
  const problem = slug ? slugProblem(slug) : '';

  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => { setBump(0); }, [base]);
  useEffect(() => {
    if (!slug || problem) { setAvail('idle'); return; }
    setAvail('checking');
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const free = await api.slugAvailable(slug);
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
      const r = await api.createVenue({ slug, nameHe: isHe ? clean : '', nameEn: isHe ? '' : clean, kind, defaultLang: lang.value });
      go('menu', true);
      await loadMemberships(r.id);
    } catch (e2) {
      const code = toV2Error(e2).code;
      if (code === 'email_unconfirmed') { setUnconfirmed(true); return; }
      if (code === 'slug_taken') { setAvail('taken'); setEditing(true); }
      if (code === 'signed_out') { signOut(); return; }
      setError(errText(code, 'setup.e'));
    } finally { setBusy(false); }
  }
  const mail = session.value?.user?.email || '';
  const slugMsg = slug && problem ? t('setup.slug.' + problem) : avail === 'taken' ? t('setup.slugTaken') : '';
  const prefix = shortText('');

  return (
    <div class="start">
      <header class="start-top"><Brand small /><LangToggle /></header>
      <main class="start-main setup" id="main" data-screen="venue-new">
        {unconfirmed && (
          <Note kind="warn" title={t('venue.unconfirmed.title')}>
            <p>{t('venue.unconfirmed.body')} <Ltr class="strong">{mail}</Ltr></p>
            <p>{t('venue.unconfirmed.then')}</p>
          </Note>
        )}
        <form class="setup-form" onSubmit={create} noValidate>
          <h1><label for="place-name">{t('setup.title')}</label></h1>
          <input id="place-name" ref={nameRef} class="bigfield" type="text" dir="auto" maxLength={80} autocomplete="organization" enterkeyhint="go" value={name} data-field="place" aria-describedby="place-addr"
            onInput={(e) => { setName((e.target as HTMLInputElement).value); setError(''); }} />
          <div class="addr" id="place-addr" data-avail={problem ? 'bad' : avail}>
            {!showEdit ? (
              <p class="addr-line">
                <Ltr class="addr-url">{prefix}<strong data-slug>{slug || '…'}</strong></Ltr>
                {slug && !problem && avail === 'checking' && <span class="spin spin-sm" aria-hidden="true" />}
                {slug && !problem && avail === 'free' && <span class="addr-ok"><Icon name="check" size={15} /></span>}
                <span class="addr-perm">{t('setup.permanent')}</span>
                <button type="button" class="linkbtn addr-edit" onClick={openEdit}><Icon name="edit" size={15} /><span>{t('setup.edit')}</span></button>
              </p>
            ) : (
              <div class="addr-box">
                <label class="sr" for="place-slug">{t('setup.slug')}</label>
                <div class={'slugbox' + (slugMsg ? ' is-bad' : '')} dir="ltr"><span class="slugbox-pre">{prefix}</span>
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
            {VENUE_KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k ? 'true' : 'false'} class="kind" data-kind={k} onClick={() => setKind(k)}>
                <Icon name={k} size={24} /><span>{t('kind.' + k)}</span>
              </button>
            ))}
          </div>
          {error && <Note kind="error">{error}</Note>}
          <Btn type="submit" kind="primary" block busy={busy} disabled={unconfirmed || (avail === 'checking' && !!clean)}>{t('venue.create')}</Btn>
        </form>
        <p class="start-who fine center">
          {!first ? <button type="button" class="linkbtn" onClick={() => go('menu')}>{t('app.cancel')}</button>
            : <>{mail && <Ltr>{mail}</Ltr>} <button type="button" class="linkbtn" onClick={() => signOut()}>{t('app.signOut')}</button></>}
        </p>
      </main>
    </div>
  );
}
