import { render } from 'preact';
import { configFlags } from '@mana/contracts';
import { useEffect, useRef, useState } from 'preact/hooks';
import './app.css';
import { PRODUCT } from './product.ts';
import { cfg, sibling, takeAuthReturn } from './lib/api.ts';
import { lang, applyLang, setLang, t, errText } from './lib/i18n.ts';
import { session, businesses, bizId, D, loadState, loadError, initAuth, loadBusinesses, openBusiness, signOut, saveState, saveProblem, retryFailed, hasUnsaved, refused, toast, everPublished, remember } from './lib/store.ts';
import { hasChanges } from './lib/draft.ts';
import { jobs } from './lib/pictures.ts';
import { route, go, Icon, Btn, Toasts, Loading, ErrorNote, Sheet, Ltr, Note, SaveFailed } from './ui.tsx';
import { Brand } from './brand.tsx';
import { PhotoInputs } from './pic.tsx';
import { StartScreen } from './screens/auth.tsx';
import { SetupScreen } from './screens/setup.tsx';
import { HomeScreen } from './screens/home.tsx';
import { MenuScreen } from './screens/menu.tsx';
import { ReviewScreen } from './screens/pictures.tsx';
import { StyleScreen } from './screens/style.tsx';
import { PublishScreen, PhoneField } from './screens/publish.tsx';
import { ScanScreen } from './screens/scan.tsx';
import { PreviewFab, PreviewDock } from './screens/preview.tsx';

// The clean schema (ADR-005): a config with schema 2 (the demo database, the local stack) boots the v2 app in src/v2/,
// loaded as a chunk of its own; anything else (production) runs this app exactly as before. The flags are read through
// the contracts' configFlags (ADR-007): production is schema 1 whatever its file says, until the cutover.
const SCHEMA_2 = configFlags((window as any).HALOM_MENUS_CONFIG).schema === 2;
if (!SCHEMA_2) { applyLang(); document.title = PRODUCT.mark; }

const TABS = [{ path: '', key: 'home', icon: 'home' }, { path: 'menu', key: 'menu', icon: 'menu' }, { path: 'style', key: 'style', icon: 'look' }];
const STEPS = [{ path: 'menu', key: 'menu', icon: 'menu' }, { path: 'pictures', key: 'pictures', icon: 'camera' }, { path: 'publish', key: 'publish', icon: 'send' }];
const stepOf = (a: string) => (a === 'pictures' ? 1 : a === 'publish' || a === 'style' ? 2 : 0);

function useWide(query = '(min-width: 1024px)') {
  const [wide, setWide] = useState(() => { try { return matchMedia(query).matches; } catch { return false; } });
  useEffect(() => { let m: MediaQueryList; try { m = matchMedia(query); } catch { return; } const on = () => setWide(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);
  return wide;
}

function SaveBadge() {
  const s = saveState.value;
  if (s === 'idle') return <span class="savebadge" aria-live="polite" />;
  return (
    <span class={'savebadge save-' + s} aria-live="polite" data-save={s}>
      {s === 'failed' ? <Icon name="alert" size={15} /> : s === 'saved' ? <Icon name="check" size={15} /> : <span class="spin spin-sm" aria-hidden="true" />}
      <span class="savebadge-txt">{t('save.' + s)}</span>
    </span>
  );
}

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const list = businesses.value || [];
  const email = session.value?.user?.email || '';
  const other = lang.value === 'he' ? 'en' : 'he';
  return (
    <>
      <button type="button" class="acctbtn" aria-haspopup="dialog" aria-label={t('app.account')} onClick={() => setOpen(true)}><Icon name="user" /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('app.account')} name="account">
        {email && <p class="muted acct-mail"><Ltr>{email}</Ltr></p>}
        {list.length > 1 && (
          <div class="bizlist" role="group" aria-label={t('app.switchBusiness')}>
            {list.map((b) => (
              <button key={b.id} type="button" class="bizrow" aria-current={b.id === bizId.value ? 'true' : undefined} onClick={() => { setOpen(false); if (b.id !== bizId.value) { openBusiness(b.id); go(''); } }}>
                <Icon name="store" size={20} /><span class="bizrow-name">{b['name_' + lang.value] || b.name_he || b.name_en}</span>
                {b.id === bizId.value && <Icon name="check" size={18} />}
              </button>
            ))}
          </div>
        )}
        {D.value && <div class="acct-phone"><PhoneField /></div>}
        <ul class="menulist">
          <li><button type="button" lang={other} onClick={() => setLang(other)} data-menu="language"><Icon name="globe" /><span>{t('app.langSwitch')}</span></button></li>
          <li><button type="button" onClick={() => { setOpen(false); go('new'); }} data-menu="add-business"><Icon name="plus" /><span>{t('app.addBusiness')}</span></button></li>
          <li><a href={sibling(cfg!.sitePath || '../')} data-menu="site"><Icon name="open" /><span>{t('app.site')}</span></a></li>
          <li><a href={PRODUCT.whatsapp} target="_blank" rel="noopener noreferrer" data-menu="help"><Icon name="chat" /><span>{t('app.help')}</span></a></li>
          <li><button type="button" onClick={() => { setOpen(false); signOut(); }} data-menu="sign-out"><Icon name="logout" /><span>{t('app.signOut')}</span></button></li>
        </ul>
      </Sheet>
    </>
  );
}

/** Before the first publish: Menu → Pictures → Publish, the current part marked, the finished ones ticked. */
function PathBar({ step, reached }: { step: number; reached: number }) {
  const has = D.value!.items.length > 0;
  return (
    <nav class="pathbar" aria-label={t('path.label')}>
      <ol>
        {STEPS.map((s, i) => {
          const cur = i === step, done = !cur && has && i < Math.max(reached, step), open = i === 0 || has;
          const inner = <><span class="path-ico">{done ? <Icon name="check" size={16} /> : <Icon name={s.icon} size={17} />}</span><span class="path-word">{t('path.' + s.key)}</span></>;
          return (
            <li key={s.key} class={(cur ? 'is-cur' : '') + (done ? ' is-done' : '')} data-step={s.key} data-step-state={cur ? 'current' : done ? 'done' : 'todo'}>
              {open ? <a href={'#/' + s.path} aria-current={cur ? 'step' : undefined}>{inner}</a> : <span class="path-off" aria-disabled="true">{inner}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function PublishButton() {
  const d = D.value!;
  const live = !!d.menu.published_revision_id, changes = hasChanges.value;
  const state = !live ? 'off' : changes ? 'changes' : 'live';
  return (
    <a class={'pubbtn pubbtn-' + state} href="#/publish" data-pub-state={state} aria-current={route.value[0] === 'publish' ? 'page' : undefined}>
      <span class="pubdot" aria-hidden="true" /><span>{state === 'off' ? t('pub.publish') : state === 'changes' ? t('pub.update') : t('home.published')}</span>
    </a>
  );
}

function Shell() {
  const d = D.value!;
  const r = route.value, a = r[0] || '';
  const path = !everPublished();
  const wide = useWide();
  const name = d.biz['name_' + lang.value] || d.biz.name_he || d.biz.name_en;
  const has = d.items.length > 0;
  const stepKey = 'step:' + d.biz.id;
  const step = stepOf(a);
  const reached = Math.max(Number(remember(stepKey) || 0), path ? step : 0);

  // the path: Home is not a place yet; go to where the owner was (or the start), and never to a step that needs dishes first
  useEffect(() => {
    if (a === 'look') return go('style', true);
    if (a === 'preview') return go('menu', true);
    if (a === 'menu' && r[1] === 'item' && r[2]) return go('menu/i/' + r[2], true);
    if (!path) return;
    if (a === '' || !['menu', 'pictures', 'publish', 'style'].includes(a)) return go(has ? STEPS[Math.min(2, Number(remember(stepKey + ':at') || 0))].path : 'menu', true);
    if (!has && a !== 'menu') return go('menu', true);
    remember(stepKey, String(reached)); if (a !== 'style') remember(stepKey + ':at', String(step));
  }, [a, r[1], path, has]);

  let screen: any;
  if (a === 'pictures' && r[1]) screen = <ReviewScreen id={r[1]} />;
  else if (a === 'menu') screen = <MenuScreen view="list" />;
  else if (a === 'pictures') screen = <MenuScreen view="grid" />;
  else if (a === 'style') screen = <StyleScreen />;
  else if (a === 'publish') screen = <PublishScreen />;
  else screen = path ? <Loading /> : <HomeScreen />;

  const editing = ['menu', 'pictures', 'style'].includes(a) && !(a === 'pictures' && r[1]);
  const dock = wide && has && (editing || a === 'publish');
  const fab = !wide && has && editing;
  const active = jobs.value.length;

  return (
    <div class={'shell ' + (path ? 'is-path' : 'is-tabs') + (dock ? ' has-dock' : '')} data-mode={path ? 'path' : 'tabs'}>
      <a class="skip" href="#main">{t('app.skip')}</a>
      <header class="top">
        <div class="top-in">
          {path ? <PathBar step={step} reached={reached} />
            : <><a class={'top-brand' + (a === '' ? ' is-home' : '')} href="#/" aria-label={PRODUCT.mark}><Brand small /></a><span class={'top-biz' + (a === '' ? ' is-home' : '')} title={name}>{name}</span></>}
          <SaveBadge />
          {!path && <PublishButton />}
          <AccountMenu />
        </div>
      </header>
      {!path && (
        <nav class="nav" aria-label={t('nav.label')}>
          {TABS.map((n) => {
            const on = n.path === a || (n.key === 'menu' && a === 'pictures');
            return (
              <a key={n.key} href={'#/' + n.path} class="nav-item" aria-current={on ? 'page' : undefined} data-tab={n.key}>
                <span class="nav-ico"><Icon name={n.icon} size={22} />{n.key === 'menu' && active > 0 && <span class="nav-dot" aria-hidden="true" />}</span>
                <span class="nav-lbl">{t('nav.' + n.key)}</span>
              </a>
            );
          })}
        </nav>
      )}
      <main class="main" id="main" tabIndex={-1}>
        {path && (businesses.value || []).length > 1 && <p class="bizline"><Icon name="store" size={16} /><span>{name}</span></p>}
        {saveState.value === 'failed' && <SaveFailed problem={saveProblem.value} onRetry={() => retryFailed()} />}
        {screen}
      </main>
      {dock && <PreviewDock />}
      {fab && <PreviewFab />}
      <PhotoInputs />
    </div>
  );
}

function App() {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    // back from Google / Apple / Facebook: supabase-js has traded ?code= for a session by now; the query is cleaned either way
    initAuth().then(() => { const back = takeAuthReturn(); if (back && !session.value) setNotice(t('auth.e.provider')); });
    const warn = (e: BeforeUnloadEvent) => { if (hasUnsaved()) { e.preventDefault(); e.returnValue = t('save.leave'); } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => { if (refused.value) toast(errText(refused.value.code), 'error'); }, [refused.value]);
  const firstRoute = useRef(true), lastRoute = useRef<string[]>(route.value);
  useEffect(() => {
    document.documentElement.dataset.route = route.value[0] || 'home';
    const before = lastRoute.current; lastRoute.current = route.value;
    if (firstRoute.current) { firstRoute.current = false; return; }
    if (document.querySelector('dialog[open]')) return;
    // a dish's sheet was closed: the keyboard goes back to the row it was opened from
    if (before[0] === 'menu' && before[1] === 'i' && before[2] && route.value[0] === 'menu' && !route.value[1]) {
      const row = [...document.querySelectorAll('li.row[data-item] a.row-main')].find((el) => (el.parentElement as HTMLElement).dataset.item === before[2]) as HTMLElement | undefined;
      if (row) { row.focus({ preventScroll: true }); return; }
    }
    // a new screen: move focus to its heading so keyboard and screen-reader users know where they are
    const h = document.querySelector('main h1') as HTMLElement | null;
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }, [route.value.slice(0, 2).join('/')]);

  let body: any;
  if (!cfg) body = <Centered><Note kind="error">{t('app.configMissing')}</Note></Centered>;
  else if (session.value === undefined) body = <Centered><Loading /></Centered>;
  else if (session.value === null) body = <StartScreen notice={notice} />;
  else if (loadState.value === 'error') body = <Centered><h1>{t('app.loadFailed')}</h1><ErrorNote code={loadError.value} onRetry={() => loadBusinesses()} /><Btn kind="ghost" onClick={() => signOut()}>{t('app.signOut')}</Btn></Centered>;
  else if (businesses.value === null) body = <Centered><Loading /></Centered>;
  else if (businesses.value.length === 0 || route.value[0] === 'new') body = <SetupScreen first={businesses.value.length === 0} />;
  else if (!D.value) body = <Centered><Loading /></Centered>;
  else if (route.value[0] === 'scan') body = <ScanScreen />;                 // one screen: choose the photo there, then its rows
  else body = <Shell />;
  return <>{body}<Toasts /></>;
}
function Centered({ children }: { children: any }) {
  return <div class="centered"><div class="centered-in"><p class="centered-brand"><Brand /></p>{children}</div></div>;
}

if (SCHEMA_2) import('./v2/main.tsx');
else render(<App />, document.getElementById('app')!);
