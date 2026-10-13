// The menu scanner: ONE screen. First the photo is chosen here (camera or gallery, no sheet over the menu); then the page
// is shown beside its rows while they arrive; then every row can be corrected or removed, and one button adds them to the
// menu. Nothing is written before that button.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t, tn, errText } from '../lib/i18n.ts';
import { D, toast, signOut } from '../lib/store.ts';
import { scan, cancelScan, retryScan, editRow, editSection, setSkipDup, addScanned, countRows, duplicates, toAdd, isDuplicate, type Row, type Sec } from '../lib/scan.ts';
import { stockThumb, stock } from '../lib/stock.ts';
import { aiOn, askAi } from '../lib/ai.ts';
import { Btn, IconBtn, Note, Seg, Sticky, Icon, Loading, go } from '../ui.tsx';
import { coarse } from '../pic.tsx';
import { onScanFiles, typeNext } from './menu.tsx';

// what the owner can do about each way a scan can fail: another picture (AGAIN), the same picture once more (SAME: the picture
// was fine, the connection or the service was not), sign in again, or type the menu instead (everything that is on our side)
const AGAIN = ['bad_image', 'heic', 'too_big', 'not_a_menu', 'unreadable', 'empty'];
const SAME = ['busy', 'timeout', 'network'];

function Thumb({ id }: { id: string | null }) {
  void stock.value.status;
  const src = id ? stockThumb(id) : null;
  return <span class={'pic pic-row' + (src ? ' pic-stock' : ' pic-none')} data-pic={src ? 'stock' : 'none'}>{src ? <><img src={src} alt="" loading="lazy" decoding="async" /><span class="pic-badge">{t('pic.illus')}</span></> : <Icon name="dish" size={20} />}</span>;
}

function RowView({ sec, row, L, edit, dup }: { sec: Sec; row: Row; L: 'he' | 'en'; edit: boolean; dup: boolean }) {
  const name = L === 'he' ? row.he : row.en, other = L === 'he' ? row.en : row.he;
  return (
    <li class={'srow' + (dup ? ' is-dup' : '')} data-scan-row={row.key} data-dup={dup ? 'true' : 'false'}>
      <Thumb id={row.stock} />
      {edit ? (
        <>
          <input class="srow-name" type="text" dir={L === 'he' ? 'rtl' : 'ltr'} lang={L} maxLength={90} value={name} placeholder={other} aria-label={t('scan.rowName')} data-scan-field="name" onInput={(e) => editRow(sec.key, row.key, { [L]: (e.target as HTMLInputElement).value })} />
          <span class="srow-price"><input type="text" inputMode="decimal" dir="ltr" maxLength={12} value={row.price} aria-label={t('menu.quick.price')} data-scan-field="price" onInput={(e) => editRow(sec.key, row.key, { price: (e.target as HTMLInputElement).value })} /><span class="cur" aria-hidden="true">₪</span></span>
          <IconBtn icon="x" label={t('scan.remove', { name: name || other })} onClick={() => editRow(sec.key, row.key, { removed: true })} />
        </>
      ) : (
        <><span class="srow-name srow-static" dir="auto">{name || other}</span><bdi dir="ltr" class="price">{row.price ? '₪' + row.price : ''}</bdi></>
      )}
      {dup && <span class="srow-dup">{t('scan.dup')}</span>}
    </li>
  );
}

/** Before a photo is chosen: the camera, the gallery and the line about several pages, on the screen itself. */
function Pick({ onType }: { onType: () => void }) {
  const pick = useRef<HTMLInputElement>(null), cam = useRef<HTMLInputElement>(null);
  useEffect(() => { if (aiOn.value === 'unknown') askAi(); }, []);
  const on = aiOn.value;
  if (on === 'unknown') return <Loading />;
  if (on !== 'on') return (
    <div class="scan-off" data-scan-off-box>
      <span class="empty-ico"><Icon name="scan" size={28} /></span>
      <p class="strong" data-scan-off>{t('scan.off.body')}</p>
      <Btn kind="primary" icon="keys" onClick={onType} data-action="scan-type">{t('menu.type')}</Btn>
    </div>
  );
  const camera = <Btn kind={coarse() ? 'primary' : 'secondary'} icon="camera" onClick={() => cam.current?.click()} data-scan-pick="camera">{t('scan.take')}</Btn>;
  const gallery = <Btn kind={coarse() ? 'secondary' : 'primary'} icon="image" onClick={() => pick.current?.click()} data-scan-pick="gallery">{t('scan.choose')}</Btn>;
  return (
    <div class="scan-pick" data-scan-pick>
      <input ref={pick} class="sr" type="file" accept="image/*" multiple tabIndex={-1} aria-hidden="true" data-scan-input="pick" onChange={onScanFiles} />
      <input ref={cam} class="sr" type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" data-scan-input="camera" onChange={onScanFiles} />
      <span class="scan-pick-ico"><Icon name="scan" size={34} /></span>
      <div class="actlist">{coarse() ? <>{camera}{gallery}</> : <>{gallery}{camera}</>}</div>
      <p class="hint center">{t('scan.pagesHint')}</p>
    </div>
  );
}

/** The photographed page beside its rows: the page being read, or any page once the review starts. */
function Pages({ images, page, reading }: { images: string[]; page: number; reading: boolean }) {
  const [picked, setPicked] = useState<number | null>(null);
  const cur = reading || picked === null ? Math.min(Math.max(page, 1), images.length) : picked;
  const src = images[cur - 1];
  if (!src) return null;
  return (
    <div class="scan-photo" data-scan-photo={cur}>
      <img class="scan-photo-img" src={src} alt={t('scan.photoAlt', { n: cur, of: images.length })} decoding="async" />
      {images.length > 1 && (
        <div class="scan-pages" role="tablist" aria-label={t('scan.pages')}>
          {images.map((u, i) => <button key={u} type="button" role="tab" aria-selected={cur === i + 1 ? 'true' : 'false'} class={'scan-page' + (cur === i + 1 ? ' is-cur' : '')} aria-label={t('scan.page', { n: i + 1, of: images.length })} onClick={() => setPicked(i + 1)}><img src={u} alt="" decoding="async" /></button>)}
        </div>
      )}
    </div>
  );
}

export function ScanScreen() {
  const s = scan.value;
  const d = D.value!;
  const langs: ('he' | 'en')[] = (d.biz.langs || ['he', 'en']).filter((l: string) => l === 'he' || l === 'en');
  const [pick, setPick] = useState<'he' | 'en' | null>(null);
  const close = () => { cancelScan(); go('menu'); };
  const typeInstead = () => { cancelScan(); typeNext.value = true; go('menu'); };

  if (!s) {
    return (
      <div class="scan" data-scan="pick" data-scan-count="0">
        <header class="scan-top">
          <IconBtn icon="x" label={t('app.close')} onClick={close} />
          <h1 tabIndex={-1}>{t('scan.title')}</h1>
        </header>
        <main class="scan-main" id="main"><Pick onType={typeInstead} /></main>
      </div>
    );
  }

  const printed = s.lang === 'he' || s.lang === 'en' ? s.lang : null;
  const L: 'he' | 'en' = pick || (printed && langs.includes(printed) ? printed : langs.includes(d.biz.default_lang) ? d.biz.default_lang : langs[0]);
  const n = countRows(s), dups = duplicates(s), adding = toAdd(s);
  const removed = s.sections.reduce((k, c) => k + c.rows.filter((r) => r.removed).length, 0);
  const review = s.status === 'review' || s.status === 'adding';
  const translated = printed && langs.length > 1 ? (printed === 'he' ? 'en' : 'he') : null;
  const [addCode, addDone] = (s.addError || '').split(':');

  async function add() {
    try { const k = await addScanned(); toast(tn('paste.added', k)); go('menu'); }
    catch { /* the sentence is on screen (addError) */ }
  }

  return (
    <div class="scan" data-scan={s.status} data-scan-count={n}>
      <header class="scan-top">
        <IconBtn icon="x" label={t('app.close')} onClick={close} />
        <h1 tabIndex={-1}>{s.status === 'reading' ? t('scan.reading') : s.status === 'error' ? t('scan.title') : t('scan.reviewTitle')}</h1>
        {review && langs.length > 1 && <Seg small value={L} label={t('item.lang')} onChange={(v) => setPick(v)} options={langs.map((l) => ({ value: l, label: t(l === 'he' ? 'app.he.short' : 'app.en.short') }))} />}
      </header>

      <main class="scan-main" id="main">
        {s.status === 'error' && (
          <div class="scan-error" data-scan-error={s.error}>
            <span class="empty-ico"><Icon name="scan" size={28} /></span>
            <p class="strong">{errText(s.error, 'scan.e')}</p>
            {SAME.includes(s.error) ? <Btn kind="primary" icon="refresh" onClick={() => retryScan()} data-action="scan-again">{t('scan.again')}</Btn>
              : AGAIN.includes(s.error) ? <Btn kind="primary" icon="refresh" onClick={() => cancelScan()} data-action="scan-again">{t('scan.again')}</Btn>
              : s.error === 'signed_out' ? <Btn kind="primary" onClick={() => { cancelScan(); void signOut(); }} data-action="scan-signin">{t('scan.signIn')}</Btn>
              : <Btn kind="primary" icon="keys" onClick={typeInstead} data-action="scan-type">{t('scan.typeInstead')}</Btn>}
          </div>
        )}

        {s.status !== 'error' && (
          <div class="scan-body">
            <Pages images={s.images} page={s.page} reading={s.status === 'reading'} />
            <div class="scan-rows">
              {s.status === 'reading' && (
                <p class="scan-live" role="status" aria-live="polite"><span class="spin" aria-hidden="true" /><span><strong data-scan-n>{n}</strong> {n === 1 ? t('scan.dish1') : t('scan.dishes')}</span>{s.pages > 1 && <span class="muted">{t('scan.page', { n: s.page, of: s.pages })}</span>}</p>
              )}
              {review && (
                <div class="scan-notes">
                  {translated && <p class="line" data-scan-note="translated"><Icon name="translate" size={18} /><span>{t(translated === 'en' ? 'scan.translated.en' : 'scan.translated.he')}</span></p>}
                  {s.truncated && <p class="line line-warn" data-scan-note="truncated"><Icon name="alert" size={18} /><span>{t(s.cut ? 'scan.cut' : 'scan.truncated', { n })}</span></p>}
                  {s.error && <p class="line line-warn" data-scan-note="page-error"><Icon name="alert" size={18} /><span>{s.pages > 1 ? t('scan.pageFailed', { n: s.errorPage }) + ' ' : ''}{errText(s.error, 'scan.e')}</span></p>}
                  {dups > 0 && <label class="line line-check" data-scan-note="dups"><input type="checkbox" checked={s.skipDup} onChange={(e) => setSkipDup((e.target as HTMLInputElement).checked)} /><span>{tn('scan.skipDup', dups)}</span></label>}
                </div>
              )}
              {s.sections.map((c) => {
                const rows = c.rows.filter((r) => !r.removed);
                if (!rows.length) return null;
                return (
                  <section key={c.key} class="ssec" data-scan-section={c.key}>
                    {review
                      ? <input class="ssec-name" type="text" dir={L === 'he' ? 'rtl' : 'ltr'} lang={L} maxLength={60} value={L === 'he' ? c.he : c.en} placeholder={L === 'he' ? c.en : c.he} aria-label={t('menu.cat.name')} onInput={(e) => editSection(c.key, { [L]: (e.target as HTMLInputElement).value })} />
                      : <h2 class="ssec-name" dir="auto">{(L === 'he' ? c.he : c.en) || c.he || c.en}</h2>}
                    <ul class="srows">{rows.map((r) => <RowView key={r.key} sec={c} row={r} L={L} edit={review} dup={review && isDuplicate(s, c, r)} />)}</ul>
                  </section>
                );
              })}
              {review && removed > 0 && <p class="center fine">{tn('scan.removed', removed)}</p>}
              {addCode && <Note kind="error">{errText(addCode)}{addDone ? ' ' + t('paste.partial', { n: addDone }) : ''}</Note>}
            </div>
          </div>
        )}
      </main>

      {review && <Sticky><Btn kind="primary" block busy={s.status === 'adding'} disabled={!adding} onClick={add} data-action="scan-add">{tn('scan.add', adding)}</Btn></Sticky>}
    </div>
  );
}
