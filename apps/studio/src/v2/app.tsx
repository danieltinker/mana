// The v2 app: who is signed in decides the first screen (start, a new place, or the shell), and the shell is one top
// bar (the place, saving, the account), the screen, and the phone's bottom bar (a rail on a wide screen).
import { useEffect, useRef, useState } from 'preact/hooks';
import { PRODUCT } from '../product.ts';
import { sibling } from '../lib/api.ts';
import { toast } from '../lib/store.ts';
import { Brand } from '../brand.tsx';
import { Btn, Confirm, Icon, Loading, Ltr, Note, Sheet, Toasts, go, route } from '../ui.tsx';
import { ConflictDialog } from './conflict.tsx';
import { leave, leaveGuarded } from './leave.ts';
import { SaveFailedLine } from './saving.tsx';
import { cfg } from './data/client.ts';
import { named } from './data/rows.ts';
import { flushSaves, hasUnsaved, initAuth, loadError, loadMemberships, loadState, memberships, menu, openVenue, refused, retrySaves, saveState, session, signOut, venueId } from './data/store.ts';
import { errText, lang, setLang, t } from './i18n.ts';
import { NAV, PHONE_TABS, landing, screenAt } from './routes.tsx';
import { HelpButton } from './screens/help.tsx';
import { StartScreen } from './screens/start.tsx';
import { VenueNewScreen } from './screens/venue-new.tsx';
import { ErrorLine, Icon2 } from './ui.tsx';
// while a first publish waits for Halom, the open place learns of the approval by itself (backlog B4)
import './data/approval.ts';

export function App() {
  useEffect(() => {
    initAuth();
    const warn = (e: BeforeUnloadEvent) => { if (hasUnsaved() || leaveGuarded()) { e.preventDefault(); e.returnValue = t('save.leave'); } };
    // the connection is back: what did not save goes again by itself
    const online = () => { if (saveState.value === 'failed') retrySaves(); };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('online', online);
    return () => { window.removeEventListener('beforeunload', warn); window.removeEventListener('online', online); };
  }, []);
  useEffect(() => { if (refused.value) toast(errText(refused.value.code), 'error'); }, [refused.value]);
  useFocusOnNewScreen();

  const list = memberships.value;
  let body;
  if (!cfg) body = <Centered><Note kind="error">{t('app.configMissing')}</Note></Centered>;
  else if (session.value === undefined) body = <Centered><Loading /></Centered>;
  else if (session.value === null) body = <StartScreen />;
  else if (loadState.value === 'error') body = <Centered><h1>{t('app.loadFailed')}</h1><ErrorLine code={loadError.value} onRetry={() => loadMemberships()} /><Btn kind="ghost" onClick={() => signOut()}>{t('app.signOut')}</Btn></Centered>;
  else if (list === null) body = <Centered><Loading /></Centered>;
  else if (list.length === 0 || route.value[0] === 'new') body = <VenueNewScreen first={list.length === 0} />;
  else if (!menu.value) body = <Centered><Loading /></Centered>;
  else body = <Shell />;
  return <>{body}<Toasts /></>;
}

const Centered = ({ children }: { children: any }) => <div class="centered"><div class="centered-in"><p class="centered-brand"><Brand /></p>{children}</div></div>;

/** A new screen moves the keyboard and screen reader to its heading. */
function useFocusOnNewScreen() {
  const first = useRef(true);
  useEffect(() => {
    document.documentElement.dataset.route = route.value[0] || 'home';
    if (first.current) { first.current = false; return; }
    if (document.querySelector('dialog[open]')) return;
    const h = document.querySelector('main h1') as HTMLElement | null;
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }, [route.value.slice(0, 2).join('/')]);
}

function Shell() {
  const r = route.value, here = r[0] || '';
  const screen = screenAt(here);
  useEffect(() => { if (!screen) go(landing(), true); }, [here]);
  const d = menu.value!;
  const name = named({ name_he: d.venue.name_he, name_en: d.venue.name_en }, lang.value);
  const [account, setAccount] = useState(false);
  const several = (memberships.value || []).length > 1;
  // a dish's or a section's sheet says "not saved" itself (the page behind an open sheet cannot be reached)
  const sheetOpen = here === 'menu' && (r[1] === 'd' || r[1] === 's') && !!r[2];
  return (
    <div class="shell is-tabs v2" data-mode="tabs" data-venue={d.venue.id}>
      <a class="skip" href="#main">{t('app.skip')}</a>
      <header class="top">
        <div class="top-in">
          <a class="top-brand" href={'#/' + landing()} aria-label={PRODUCT.mark} onClick={(e) => guardedLink(e, landing())}><Brand small /></a>
          {several
            ? <button type="button" class="top-biz top-switch" aria-haspopup="dialog" onClick={() => setAccount(true)} data-action="switch-venue"><span>{name}</span><Icon name="chevdown" size={16} /></button>
            : <span class="top-biz" title={name}>{name}</span>}
          <SaveBadge />
          <HelpButton />
          <button type="button" class="acctbtn" aria-haspopup="dialog" aria-label={t('app.account')} onClick={() => setAccount(true)} data-action="account"><Icon name="user" /></button>
        </div>
      </header>
      <BottomNav here={here} />
      <main class="main" id="main" tabIndex={-1}>
        {!sheetOpen && <SaveFailedLine />}
        {screen ? screen.render(r.slice(1)) : <Loading />}
      </main>
      <AccountSheet open={account} onClose={() => setAccount(false)} />
      <ConflictDialog />
    </div>
  );
}

function SaveBadge() {
  const s = saveState.value;
  if (s === 'idle') return <span class="savebadge" aria-live="polite" />;
  const bad = s === 'failed' || s === 'conflict';
  return (
    <span class={'savebadge save-' + (bad ? 'failed' : s)} aria-live="polite" data-save={s}>
      {bad ? <Icon name="alert" size={15} /> : s === 'saved' ? <Icon name="check" size={15} /> : <span class="spin spin-sm" aria-hidden="true" />}
      <span class="savebadge-txt">{t(s === 'saving' ? 'save.saving' : bad ? 'save.failed' : 'save.' + s)}</span>
    </span>
  );
}

/** A link inside the shell: when a screen holds changes not saved yet, the owner is asked before it is followed. */
function guardedLink(e: MouseEvent, path: string) {
  if (!leaveGuarded() || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  leave(() => go(path));
}

function BottomNav({ here }: { here: string }) {
  const [more, setMore] = useState(false);
  const fits = NAV.length <= PHONE_TABS;
  const shown = fits ? NAV : NAV.slice(0, PHONE_TABS - 1), rest = fits ? [] : NAV.slice(PHONE_TABS - 1);
  const item = (n: (typeof NAV)[number]) => (
    <a key={n.key} href={'#/' + n.path} class="nav-item" aria-current={n.path === here ? 'page' : undefined} data-tab={n.key} onClick={(e) => guardedLink(e as unknown as MouseEvent, n.path)}>
      <span class="nav-ico"><Icon2 name={n.icon} size={22} />{n.dot?.() && <span class="nav-dot" aria-hidden="true" />}</span>
      <span class="nav-lbl">{t(n.label)}{n.dot?.() && <span class="sr"> · {t('nav2.waiting')}</span>}</span>
    </a>
  );
  return (
    <nav class="nav" aria-label={t('nav.label')} style={{ gridTemplateColumns: `repeat(${shown.length + (rest.length ? 1 : 0)}, 1fr)` }}>
      {shown.map(item)}
      {rest.length > 0 && <>
        <button type="button" class="nav-item" aria-haspopup="dialog" aria-current={rest.some((n) => n.path === here) ? 'page' : undefined} onClick={() => setMore(true)} data-tab="more">
          <span class="nav-ico"><Icon name="dots" size={22} /></span><span class="nav-lbl">{t('nav2.more')}</span>
        </button>
        <Sheet open={more} onClose={() => setMore(false)} title={t('nav2.more')} name="more">
          <ul class="menulist">{rest.map((n) => <li key={n.key}><a href={'#/' + n.path} onClick={(e) => { setMore(false); guardedLink(e as unknown as MouseEvent, n.path); }}><Icon2 name={n.icon} /><span>{t(n.label)}</span></a></li>)}</ul>
        </Sheet>
      </>}
    </nav>
  );
}

/** The account: the places (switch between them), the language, a new place, help, signing out. */
function AccountSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const list = memberships.value || [];
  const email = session.value?.user?.email || '';
  const other = lang.value === 'he' ? 'en' : 'he';
  // a change that did not save belongs to this place: switching drops it, so the owner is asked first
  const [ask, setAsk] = useState<string | null>(null), [askOut, setAskOut] = useState(false);
  // the place being opened decides where it opens (Home once it has published), not the one still on screen
  const switchTo = (id: string) => { setAsk(null); openVenue(id); go(landing(list.find((m) => m.venue.id === id)?.venue ?? null)); };
  function pick(id: string) {
    onClose();
    if (id === venueId.value) return;
    leave(async () => {
      await flushSaves().catch(() => {});
      if (hasUnsaved()) setAsk(id); else switchTo(id);
    });
  }
  // signing out drops what did not save: asked first
  function out() {
    onClose();
    leave(async () => {
      await flushSaves().catch(() => {});
      if (hasUnsaved()) setAskOut(true); else signOut();
    });
  }
  return (
    <>
    <Confirm open={!!ask} title={t('venue.unsaved.title')} body={t('venue.unsaved.body')} confirmLabel={t('venue.unsaved.go')} danger onConfirm={() => switchTo(ask!)} onClose={() => setAsk(null)} />
    <Confirm open={askOut} title={t('venue.unsaved.title')} body={t('signout.unsaved.body')} confirmLabel={t('signout.unsaved.go')} danger onConfirm={() => { setAskOut(false); signOut(); }} onClose={() => setAskOut(false)} />
    <Sheet open={open} onClose={onClose} title={t('app.account')} name="account">
      {email && <p class="muted acct-mail"><Ltr>{email}</Ltr></p>}
      {list.length > 1 && (
        <div class="bizlist" role="group" aria-label={t('app.switchBusiness')}>
          {list.map((m) => (
            <button key={m.venue.id} type="button" class="bizrow" aria-current={m.venue.id === venueId.value ? 'true' : undefined} data-venue={m.venue.slug}
              onClick={() => { pick(m.venue.id); }}>
              <Icon name="store" size={20} /><span class="bizrow-name">{named(m.venue, lang.value)}</span>
              {m.venue.id === venueId.value && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>
      )}
      <ul class="menulist">
        <li><button type="button" lang={other} onClick={() => setLang(other)} data-menu="language"><Icon name="globe" /><span>{t('app.langSwitch')}</span></button></li>
        <li><button type="button" onClick={() => { onClose(); leave(() => go('new')); }} data-menu="add-venue"><Icon name="plus" /><span>{t('app.addBusiness')}</span></button></li>
        <li><a href={sibling(cfg!.sitePath || '../')} data-menu="site"><Icon name="open" /><span>{t('app.site')}</span></a></li>
        <li><a href={PRODUCT.whatsapp} target="_blank" rel="noopener noreferrer" data-menu="help"><Icon name="chat" /><span>{t('app.help')}</span></a></li>
        <li><button type="button" onClick={out} data-menu="sign-out"><Icon name="logout" /><span>{t('app.signOut')}</span></button></li>
      </ul>
    </Sheet>
    </>
  );
}
