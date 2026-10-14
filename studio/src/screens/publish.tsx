// Publish. Before the first time: the last step of the path (the real viewer with the draft, two quick style picks, one
// button). Right after: the QR code, the link, the table card. Later: the same screen updates what guests see, and holds
// the versions and "take offline".
import { useEffect, useMemo, useState } from 'preact/hooks';
import QRCode from 'qrcode';
import { PRODUCT } from '../product.ts';
import { sb, q, toAppError } from '../lib/api.ts';
import { t, tn, errText, lang, fmtDate, fmtDateTime } from '../lib/i18n.ts';
import { D, edit, flushAll, applyLocal, planOf, textOf, toast, currentGeneration, everPublished } from '../lib/store.ts';
import { diff, hasChanges, refreshDraft } from '../lib/draft.ts';
import { shortUrl, qrUrl, shortText, openUrl } from '../lib/links.ts';
import { loadStats } from '../lib/stats.ts';
import { Btn, Note, Ltr, CopyBtn, Icon, Confirm, Loading, Sheet, Sticky, Field, go } from '../ui.tsx';
import { PreviewFrame } from './preview.tsx';
import { AccentDots, TableStrip } from './style.tsx';

/** The owner's phone, for Halom only: one quiet line after the first publish (the field opens when asked), and in the account menu. */
export function PhoneField({ autoFocus }: { autoFocus?: boolean }) {
  const d = D.value!;
  return <Field label={t('pub.contactPhone')} optional hint={t('pub.contactPhoneHint')}>{(f) => <input {...f} type="tel" dir="ltr" inputMode="tel" maxLength={40} autocomplete="tel" autoFocus={autoFocus} value={d.biz.contact_phone || ''} data-field="contact_phone" onInput={(e) => edit('businesses', d.biz.id, { contact_phone: (e.target as HTMLInputElement).value.trim() || null })} />}</Field>;
}
function PhoneLine() {
  const [shown, setShown] = useState(() => !!D.value!.biz.contact_phone);
  if (!shown) return <button type="button" class="linkbtn" onClick={() => setShown(true)} data-action="add-phone"><Icon name="plus" size={16} /><span>{t('pub.contactPhoneAsk')}</span></button>;
  return <div class="done-phone"><PhoneField autoFocus /></div>;
}

const QR_OPTS = { errorCorrectionLevel: 'Q' as const, margin: 4 };
function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function useQr(url: string) {
  const [svg, setSvg] = useState('');
  useEffect(() => { let on = true; QRCode.toString(url, { ...QR_OPTS, type: 'svg' }).then((s) => { if (on) setSvg(s); }).catch(() => {}); return () => { on = false; }; }, [url]);
  return svg;
}
const svgSrc = (svg: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

async function refreshPublishState(id: string) {
  const gen = currentGeneration();
  const [menu, ent, revisions] = await Promise.all([
    q(sb.from('menus').select('*').eq('business_id', id).single()),
    q(sb.from('entitlements').select('*').eq('business_id', id).single()),
    q(sb.from('menu_revisions').select('id, number, created_at, note').eq('business_id', id).order('number', { ascending: false }).limit(30)),
  ]);
  if (gen !== currentGeneration() || !D.value) return;
  D.value = { ...D.value, menu, ent, revisions: revisions as any[] };
}

export function PlanNote() {
  const p = planOf(D.value!.ent);
  if (p.state !== 'expired' && p.state !== 'suspended') return null;
  const contact = <a class="btn btn-secondary btn-sm" href={PRODUCT.whatsapp} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={18} /><span class="btn-txt">{t('home.plan.contact')}</span></a>;
  return <Note kind="warn" title={t(p.state === 'expired' ? 'home.plan.expired' : 'home.plan.suspended')} action={contact}>{t(p.state === 'expired' ? 'home.plan.expiredBody' : 'home.plan.suspendedBody')}</Note>;
}

function printCard(size: 'A6' | 'A5') {
  const card = document.querySelector('[data-table-card]');
  if (!card) return;
  // a copy of the card, alone on the sheet: the app itself is taken out of the print layout so exactly one page comes out
  const root = document.createElement('div');
  root.className = 'print-root';
  root.appendChild(card.cloneNode(true));
  const style = document.createElement('style');
  style.textContent = `@page { size: ${size === 'A6' ? '105mm 148mm' : '148mm 210mm'}; margin: 0; }`;      // A6 is not a CSS page-size keyword, so the sheet is given in millimetres
  document.body.appendChild(root); document.head.appendChild(style);
  document.documentElement.dataset.print = size;
  let cleaned = false;
  const done = () => { if (cleaned) return; cleaned = true; delete document.documentElement.dataset.print; style.remove(); root.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(done, 120000);
}

/** The QR code with everything around it: downloads, the table card, printing. Opens from Home and from the publish screen. */
export function QrSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = D.value!;
  const short = shortUrl(d.biz.slug), code = qrUrl(d.biz.slug);
  const svg = useQr(code);
  if (!open) return null;
  async function qrPng() {
    const url = await QRCode.toDataURL(code, { ...QR_OPTS, width: 2048, type: 'image/png' });
    download(`mana-qr-${d.biz.slug}.png`, await (await fetch(url)).blob());
  }
  const qrSvg = () => download(`mana-qr-${d.biz.slug}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
  return (
    <Sheet open onClose={onClose} title={t('pub.qr')} tall name="qr">
      <div class="qrsheet">
        <div class="tcard" aria-hidden="true" data-table-card>
          <p class="tcard-name">{d.biz.name_he && d.biz.name_en ? <><span lang="he" dir="rtl">{d.biz.name_he}</span><span lang="en" dir="ltr" class="tcard-name2">{d.biz.name_en}</span></> : <span>{d.biz.name_he || d.biz.name_en}</span>}</p>
          {svg && <img class="tcard-qr" src={svgSrc(svg)} alt="" />}
          <p class="tcard-scan"><span lang="he" dir="rtl">{t('pub.cardScanHe')}</span><span lang="en" dir="ltr">{t('pub.cardScanEn')}</span></p>
          <p class="tcard-foot" dir="ltr">Menu by {PRODUCT.en.toLowerCase()} · {PRODUCT.site}</p>
        </div>
        <div class="actgrid">
          <Btn icon="print" onClick={() => printCard('A6')} data-print="A6">{t('pub.cardA6')}</Btn>
          <Btn icon="print" onClick={() => printCard('A5')} data-print="A5">{t('pub.cardA5')}</Btn>
          <Btn icon="download" onClick={qrPng} data-qr-png>{t('pub.qrPng')}</Btn>
          <Btn icon="download" onClick={qrSvg} data-qr-svg>{t('pub.qrSvg')}</Btn>
        </div>
        <p class="linkline"><Ltr class="biglink">{shortText(d.biz.slug)}</Ltr><CopyBtn text={short} /></p>
      </div>
    </Sheet>
  );
}

function ChangeChips() {
  const dd = diff.value;
  if (!dd) return <span class="muted" data-diff="loading"><span class="spin spin-sm" aria-hidden="true" /></span>;
  if (!hasChanges.value) return <p class="muted" data-diff="none">{t('pub.changes.none')}</p>;
  return (
    <ul class="chips" data-diff="some">
      {dd.added > 0 && <li class="chip">{tn('pub.changes.added', dd.added)}</li>}
      {dd.changed > 0 && <li class="chip">{tn('pub.changes.changed', dd.changed)}</li>}
      {dd.removed > 0 && <li class="chip">{tn('pub.changes.removed', dd.removed)}</li>}
      {dd.look && <li class="chip">{t('pub.changes.look')}</li>}
      {dd.order && !dd.added && !dd.removed && <li class="chip">{t('pub.changes.order')}</li>}
    </ul>
  );
}

export function PublishScreen() {
  const d = D.value!;
  const p = planOf(d.ent);
  const live = !!d.menu.published_revision_id;
  const path = !everPublished();
  const liveRev = d.revisions.find((r) => r.id === d.menu.published_revision_id);
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [just, setJust] = useState<{ revision: number; first: boolean } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'restore' | 'unpublish'; n?: number } | null>(null), [qr, setQr] = useState(false);
  const short = shortUrl(d.biz.slug), share = openUrl(d.biz.slug);
  const svg = useQr(qrUrl(d.biz.slug));
  const name = textOf(d.biz, 'name', lang.value);
  const blocked = p.state === 'expired' || p.state === 'suspended';
  const wide = useMemo(() => { try { return matchMedia('(min-width: 1024px)').matches; } catch { return false; } }, []);
  useEffect(() => { refreshDraft(0); }, []);

  const noPrice = d.items.filter((i) => i.price_minor == null).length;
  const waiting = d.assets.filter((a) => a.status === 'ready_for_review').length;

  async function publish() {
    setBusy('publish'); setError('');
    try {
      await flushAll();
      const r = await q<any>(sb.rpc('publish_menu', { p_business: d.biz.id, p_note: null }));
      if (!r || !r.ok) { setError(errText((r && r.code) || 'unknown', 'pub.e')); await refreshPublishState(d.biz.id).catch(() => {}); return; }
      const first = !d.menu.first_published_at;
      await refreshPublishState(d.biz.id);
      setJust({ revision: r.revision, first });
      loadStats().catch(() => {});
      window.scrollTo(0, 0);
    } catch (e) { setError(errText(toAppError(e).code)); }
    finally { setBusy(''); }
  }
  async function restore(n: number) {
    setBusy('restore'); setError('');
    try {
      const r = await q<any>(sb.rpc('restore_revision', { p_business: d.biz.id, p_number: n }));
      if (!r || !r.ok) setError(errText((r && r.code) || 'unknown', 'pub.e'));
      else { await refreshPublishState(d.biz.id); toast(t('pub.restored', { n })); setJust(null); }
    } catch (e) { setError(errText(toAppError(e).code)); }
    finally { setBusy(''); setConfirm(null); }
  }
  async function unpublish() {
    setBusy('unpublish'); setError('');
    try {
      const r = await q<any>(sb.rpc('unpublish_menu', { p_business: d.biz.id }));
      if (!r || !r.ok) setError(errText((r && r.code) || 'unknown', 'pub.e'));
      else { applyLocal('menus', d.menu.id, { published_revision_id: null }); toast(t('pub.unpublished')); setJust(null); }
    } catch (e) { setError(errText(toAppError(e).code)); }
    finally { setBusy(''); setConfirm(null); }
  }
  const nativeShare = async () => {
    const data = { title: name, text: t('pub.shareText', { name, url: share }) };
    try { if ((navigator as any).share) { await (navigator as any).share({ ...data, url: share }); return; } } catch { /* closed */ }
    window.open('https://wa.me/?text=' + encodeURIComponent(data.text), '_blank', 'noopener');
  };

  // ---- right after publishing: the code, the link, what to do with them
  if (just && live) {
    return (
      <div class="page page-done has-sticky" data-published-rev={just.revision}>
        <header class="done-head">
          <span class="done-ico"><Icon name="check" size={28} /></span>
          <h1 tabIndex={-1}>{just.first ? t('pub.done.title') : t('pub.done.titleUpdate')}</h1>
        </header>
        <div class="done-qr">{svg ? <img src={svgSrc(svg)} alt={t('pub.qrAlt', { url: short })} width="240" height="240" data-qr /> : <Loading />}</div>
        <p class="linkline linkline-center"><Ltr class="biglink" data-short-link>{short}</Ltr><CopyBtn text={short} /></p>
        <div class="actgrid actgrid-3">
          <button type="button" class="act" onClick={() => setQr(true)} data-action="table-card"><Icon name="print" size={24} /><span>{t('pub.card')}</span></button>
          <button type="button" class="act" onClick={nativeShare} data-action="share"><Icon name="share" size={24} /><span>{t('pub.share')}</span></button>
          <a class="act" href={share} target="_blank" rel="noopener noreferrer" data-action="open-menu"><Icon name="open" size={24} /><span>{t('pub.open')}</span></a>
        </div>
        {just.first && <PhoneLine />}
        <Sticky><Btn kind="primary" block onClick={() => { setJust(null); go(''); }} data-action="to-home">{t('pub.done.next')}</Btn></Sticky>
        <QrSheet open={qr} onClose={() => setQr(false)} />
      </div>
    );
  }

  const canPublish = d.items.length > 0 && !blocked;
  const label = !live ? t('pub.publish') : t('pub.update');
  return (
    <div class="page page-publish has-sticky" data-live={live ? 'true' : 'false'}>
      <header class="page-head">
        <h1 tabIndex={-1}>{t('pub.title')}</h1>
        {live && <p class="status"><span class={'dot ' + (blocked ? 'dot-off' : 'dot-on')} aria-hidden="true" /><span data-live-line>{blocked ? t('home.offline') : liveRev ? t('pub.live', { n: liveRev.number, date: fmtDate(liveRev.created_at) }) : t('home.published')}</span></p>}
        {!live && !path && <p class="status"><span class="dot dot-off" aria-hidden="true" /><span>{t('pub.notLive')}</span></p>}
      </header>
      {blocked && <PlanNote />}
      {error && <Note kind="error">{error}</Note>}

      {d.items.length === 0 ? (
        <Note kind="warn" action={<Btn small onClick={() => go('menu')}>{t('pic.noItems.go')}</Btn>}>{t('pub.check.empty')}</Note>
      ) : (
        <div class="pubgrid">
          {!wide && <PreviewFrame />}
          <div class="pubside">
            <section class="blk" aria-labelledby="pk-accent"><h2 id="pk-accent">{t('look.accent')}</h2><AccentDots few /></section>
            <section class="blk" aria-labelledby="pk-table"><h2 id="pk-table">{t('look.surface')}</h2><TableStrip /></section>
            <a class="linkbtn" href="#/style" data-link="style"><Icon name="look" size={17} /><span>{t('pub.moreStyle')}</span></a>
            {(noPrice > 0 || waiting > 0) && (
              <ul class="chips" data-checklist>
                {noPrice > 0 && <li class="chip chip-warn" data-check="noPrice">{tn('pub.check.noPrice', noPrice)}</li>}
                {waiting > 0 && <li class="chip chip-warn" data-check="waiting"><a href="#/pictures">{tn('pub.check.waiting', waiting)}</a></li>}
              </ul>
            )}
            {live && <section class="blk" aria-labelledby="chg-h"><h2 id="chg-h">{t('pub.changes')}</h2><ChangeChips /></section>}
          </div>
        </div>
      )}

      {live && (
        <section class="blk blk-link" aria-labelledby="link-h">
          <h2 id="link-h" class="sr">{t('pub.link')}</h2>
          <p class="linkline"><Ltr class="biglink" data-short-link>{short}</Ltr><CopyBtn text={short} /></p>
          <div class="btnrow">
            <Btn icon="qr" onClick={() => setQr(true)} data-action="qr">{t('pub.qrShort')}</Btn>
            <a class="btn btn-secondary" href={'https://wa.me/?text=' + encodeURIComponent(t('pub.shareText', { name, url: share }))} target="_blank" rel="noopener noreferrer" data-share-wa><Icon name="share" size={18} /><span class="btn-txt">{t('pub.share')}</span></a>
            <a class="btn btn-secondary" href={share} target="_blank" rel="noopener noreferrer"><Icon name="open" size={18} /><span class="btn-txt">{t('pub.open')}</span></a>
          </div>
        </section>
      )}

      {d.revisions.length > 0 && (
        <details class="blk more revs-block">
          <summary><Icon name="history" size={18} /><span>{t('pub.revs')}</span></summary>
          <ul class="revs">
            {d.revisions.map((r) => (
              <li key={r.id} data-rev={r.number}>
                <span class="rev-main"><span class="strong">{t('pub.rev', { n: r.number })}</span><span class="muted">{fmtDateTime(r.created_at)}</span></span>
                {r.id === d.menu.published_revision_id ? <span class="badge badge-ok">{t('pub.revLive')}</span> : <Btn small disabled={blocked} onClick={() => setConfirm({ kind: 'restore', n: r.number })}>{t('pub.restore')}</Btn>}
              </li>
            ))}
          </ul>
          {live && <p class="unpub"><Btn kind="ghost" icon="power" onClick={() => setConfirm({ kind: 'unpublish' })} data-action="unpublish">{t('pub.unpublish')}</Btn></p>}
        </details>
      )}

      <Sticky note={!live && p.state === 'pending' && canPublish ? t('pub.trialStarts') : undefined}>
        <Btn kind="primary" block icon="send" busy={busy === 'publish'} disabled={!canPublish || (live && diff.value !== null && !hasChanges.value)} onClick={publish} data-action="publish">{label}</Btn>
      </Sticky>

      <QrSheet open={qr} onClose={() => setQr(false)} />
      <Confirm open={confirm?.kind === 'restore'} busy={busy === 'restore'} title={t('pub.restore')} body={t('pub.restoreConfirm', { n: confirm?.n ?? 0 })} confirmLabel={t('pub.restore')} onConfirm={() => restore(confirm!.n!)} onClose={() => setConfirm(null)} />
      <Confirm open={confirm?.kind === 'unpublish'} danger busy={busy === 'unpublish'} title={t('pub.unpublish')} body={t('pub.unpublishConfirm')} confirmLabel={t('pub.unpublish')} onConfirm={unpublish} onClose={() => setConfirm(null)} />
    </div>
  );
}
