// The real diner viewer, fed with the current draft (CONTRACT.md: preview handshake). On a phone it opens from a
// floating button as a full-screen sheet; on a wide screen it is docked beside the editor.
import { useEffect, useRef, useState } from 'preact/hooks';
import { cfg, sibling } from '../lib/api.ts';
import { t, lang } from '../lib/i18n.ts';
import { D, remember } from '../lib/store.ts';
import { draft, refreshDraft } from '../lib/draft.ts';
import { Sheet, Icon, ErrorNote, IconBtn } from '../ui.tsx';

export function PreviewFrame() {
  const d = D.value!;
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const [state, setState] = useState<'loading' | 'shown'>('loading');
  const post = () => {
    const snap = draft.value.snap;
    if (!ready.current || !frame.current?.contentWindow || !snap) return;
    frame.current.contentWindow.postMessage({ type: 'halom-menu-preview', snapshot: snap }, location.origin);
    setState('shown');
  };
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== frame.current?.contentWindow || !e.data || e.data.type !== 'halom-menu-preview-ready') return;
      ready.current = true; post();
    };
    window.addEventListener('message', on);
    if (!draft.value.snap) refreshDraft(0);
    return () => window.removeEventListener('message', on);
  }, []);
  useEffect(() => { post(); }, [draft.value.n]);                 // follows every saved edit
  // a switch for looking at the viewer in another mode while developing or testing (for example gl=off): never set for owners
  const extra = remember('preview-q') || '';
  const src = sibling(cfg!.viewPath || '../view/', '?preview=1&lang=' + (d.biz.langs.includes(lang.value) ? lang.value : d.biz.default_lang) + (extra ? '&' + extra : ''));
  const failed = !draft.value.snap && draft.value.error;
  return (
    <div class="phone" data-preview={failed ? 'error' : state}>
      <iframe ref={frame} title={t('prev.frame')} src={src} />
      {failed && <div class="phone-msg"><ErrorNote code={draft.value.error} onRetry={() => refreshDraft(0)} /></div>}
    </div>
  );
}

/** Phones: a round button above the tab bar that opens the menu as guests will see it. */
export function PreviewFab() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" class="fab" aria-label={t('prev.title')} title={t('prev.title')} onClick={() => setOpen(true)} data-action="preview"><Icon name="phone" size={24} /></button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('prev.title')} full name="preview" head={<IconBtn icon="refresh" label={t('prev.refresh')} onClick={() => refreshDraft(0)} />}>
        <PreviewFrame />
      </Sheet>
    </>
  );
}

/** Wide screens: the phone stays beside the editor. */
export function PreviewDock() {
  return <aside class="dock" aria-label={t('prev.title')}><PreviewFrame /><p class="dock-note fine">{t('prev.dock')}</p></aside>;
}
