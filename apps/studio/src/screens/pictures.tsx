// Review and approve one picture: the owner's photo beside what we made of it, the depth class, the relief in the real
// viewer, and the decision. (The list of dishes and their pictures is the grid in menu.tsx.)
import { useEffect, useRef, useState } from 'preact/hooks';
import { t, lang } from '../lib/i18n.ts';
import { cfg, sibling, toAppError } from '../lib/api.ts';
import { D, toast, type Asset, type Item } from '../lib/store.ts';
import { studio, busyAsset, localError, checkStudio, addPhoto, retry, rebuild, usePhoto, approve, reject } from '../lib/pictures.ts';
import { Btn, Note, Empty, Icon, go, Loading } from '../ui.tsx';
import { useFileUrl, phaseText, picErr, nameOf, ATTEMPTS, StudioLine } from '../pic.tsx';

// ---------------------------------------------------------------- review and approve
/** The cut-out as it really is: the colour image with the matte (green channel of aux.png) as its transparency. */
function CutOut({ color, aux, label }: { color: string; aux: string | null; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'plain'>('loading');
  useEffect(() => {
    let on = true;
    setState('loading');
    (async () => {
      try {
        if (!aux) throw new Error('no matte');
        const [c, a] = await Promise.all([color, aux].map(async (u) => createImageBitmap(await (await fetch(u)).blob())));
        const cv = ref.current;
        if (!on || !cv) return;
        const S = 512; cv.width = cv.height = S;
        const ctx = cv.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D;
        ctx.clearRect(0, 0, S, S); ctx.drawImage(a, 0, 0, S, S);
        const matte = ctx.getImageData(0, 0, S, S).data;
        ctx.clearRect(0, 0, S, S); ctx.drawImage(c, 0, 0, S, S);
        const px = ctx.getImageData(0, 0, S, S);
        for (let i = 0; i < px.data.length; i += 4) px.data[i + 3] = matte[i + 1];
        ctx.putImageData(px, 0, 0);
        c.close(); a.close();
        setState('ready');
      } catch { if (on) setState('plain'); }
    })();
    return () => { on = false; };
  }, [color, aux]);
  return <>
    <canvas ref={ref} role="img" aria-label={label} data-shot="result" data-ready={state === 'ready' ? 'true' : 'false'} hidden={state === 'plain'} />
    {state === 'plain' && <img src={color} alt={label} data-shot="result" data-ready="true" />}
  </>;
}

const DEPTHS = ['flat', 'low', 'medium', 'tall', 'stand'];
function warnText(w: string): string {
  if (/cut|crop|edge|border/i.test(w)) return t('rev.warn.cut');
  if (/small|tiny|far/i.test(w)) return t('rev.warn.small');
  return t('rev.warn.other', { text: w });
}

function TablePreview({ asset, item }: { asset: Asset; item: Item | undefined }) {
  const d = D.value!;
  const frame = useRef<HTMLIFrameElement>(null);
  const color = useFileUrl(asset, 'color'), aux = useFileUrl(asset, 'aux'), thumb = useFileUrl(asset, 'thumb');
  const ready = useRef(false);
  const send = () => {
    if (!ready.current || !frame.current?.contentWindow || !color || !aux) return;
    const snapshot = {
      v: 1, slug: d.biz.slug, revision: 0, publishedAt: new Date().toISOString(),
      business: { name: { he: d.biz.name_he, en: d.biz.name_en }, area: { he: '', en: '' }, cuisine: { he: '', en: '' }, logo: null, orderUrl: null, phone: null },
      locale: { default: lang.value, langs: [lang.value], currency: d.biz.currency },
      theme: { accent: d.biz.accent, surface: d.menu.surface, tableImg: null },
      categories: [{ id: 'review', name: { he: t('rev.title'), en: t('rev.title') }, kind: asset.relief_class === 'stand' ? 'drinks' : 'food', scene: 'auto', items: [{
        id: 'review-item', name: { he: item ? item.name_he || item.name_en : '', en: item ? item.name_en || item.name_he : '' }, desc: { he: '', en: '' }, price: null, available: true, tags: [], allergens: { he: '', en: '' }, details: {},
        asset: { state: 'relief', color, aux, thumb: thumb || color, kind: asset.relief_class, e: asset.meta.e, h: asset.meta.h, o: asset.meta.o ?? null, s: asset.meta.s ?? null },
      }] }],
    };
    frame.current.contentWindow.postMessage({ type: 'halom-menu-preview', snapshot }, location.origin);
  };
  useEffect(() => {
    const on = (e: MessageEvent) => { if (e.origin === location.origin && e.source === frame.current?.contentWindow && e.data && e.data.type === 'halom-menu-preview-ready') { ready.current = true; send(); } };
    window.addEventListener('message', on);
    return () => window.removeEventListener('message', on);
  });
  useEffect(() => { send(); }, [color, aux, asset.relief_class, asset.updated_at]);
  const src = sibling(cfg!.viewPath || '../view/', '?preview=1&lang=' + lang.value + '#c=review&i=review-item');
  return <iframe ref={frame} class="table-frame" title={t('rev.onTableTitle')} src={src} loading="lazy" />;
}

export function ReviewScreen({ id }: { id: string }) {
  const d = D.value!;
  const asset = d.assets.find((a) => a.id === id);
  const item = asset ? d.items.find((i) => i.id === asset.item_id) : undefined;
  const original = useFileUrl(asset, 'original'), color = useFileUrl(asset && asset.color_path ? asset : null, 'color'), auxUrl = useFileUrl(asset && asset.aux_path ? asset : null, 'aux');
  const [error, setError] = useState(''), [table, setTable] = useState(false), [said, setSaid] = useState('');
  const headRef = useRef<HTMLHeadingElement>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  useEffect(() => { headRef.current?.focus(); }, [id]);
  useEffect(() => { checkStudio(); }, []);
  if (!asset) return <div class="page"><Empty icon="image" title={t('rev.notFound')}><Btn onClick={() => go('pictures')}>{t('rev.back')}</Btn></Empty></div>;

  const busy = busyAsset.value[asset.id] || '';
  const phase = phaseText(asset.id);
  const name = item ? nameOf(item) : '';
  const isRelief = asset.kind === 'relief';
  const inUse = !!item && item.asset_id === asset.id;
  const errCode = localError.value[asset.id] || asset.error_code || 'internal';
  const limit = asset.status === 'failed' && (asset.attempts >= ATTEMPTS || errCode === 'limit_attempts');
  const noStudio = ['unsupported', 'unavailable'].includes(studio.value.status);
  const run = async (fn: () => Promise<any>, after?: () => void) => { setError(''); try { await fn(); after && after(); } catch (e) { setError(picErr(toAppError(e).code)); } };

  async function another(e: Event) {
    const input = e.target as HTMLInputElement, file = input.files && input.files[0];
    input.value = '';
    if (!file || !item) return;
    try { const newId = await addPhoto(item.id, file); go('pictures'); void newId; }
    catch (err) { setError(picErr(toAppError(err).code === 'unknown' ? 'bad_image' : toAppError(err).code)); }
  }

  return (
    <div class="page">
      <a class="backlink" href="#/pictures"><Icon name="chev" size={16} back />{t('rev.back')}</a>
      <header class="page-head"><div><h1 ref={headRef} tabIndex={-1}>{t('rev.title')}</h1>{name && <p class="lead">{name}</p>}</div></header>
      <StudioLine />
      <input ref={pickRef} class="sr" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" data-photo-input="another" onChange={another} />
      <p class="sr" aria-live="polite">{said}</p>

      {phase && <Note kind="info"><span role="status"><span class="spin spin-sm" aria-hidden="true" /> {t('rev.inQueue')} <span dir="auto">{phase}</span></span></Note>}

      {asset.status === 'failed' && !phase && (
        <Note kind="error" title={t('rev.failedTitle')}
          action={<>
            {!limit && !['bad_image', 'upload_lost', 'unsupported'].includes(errCode) && <Btn small kind="primary" icon="refresh" onClick={() => { retry(asset.id); }}>{t('pic.tryAgain')}</Btn>}
            {asset.original_path && errCode !== 'bad_image' && <Btn small busy={busy === 'photo'} onClick={() => run(() => usePhoto(asset.id))}>{t('pic.usePhoto')}</Btn>}
            <Btn small kind="ghost" icon="camera" onClick={() => pickRef.current?.click()}>{t('rev.another')}</Btn>
          </>}>
          {limit ? picErr('limit_attempts') : picErr(errCode)}
          {(errCode === 'memory' || errCode === 'unsupported') && <p class="hint"><strong>{t('pic.onComputer')}.</strong> {t('pic.onComputerBody')}</p>}
        </Note>
      )}

      <div class="compare">
        <figure class="card shot">
          <figcaption>{t('rev.yours')}</figcaption>
          <div class="shot-img">{original ? <img src={original} alt={t('rev.yours')} data-shot="original" /> : <Loading />}</div>
        </figure>
        {asset.color_path && ['ready_for_review', 'approved'].includes(asset.status) && (
          <figure class="card shot" data-result={asset.kind}>
            <figcaption>{isRelief ? t('rev.result') : t('rev.resultPhoto')}{isRelief && asset.relief_class && <span class="chip">{t('rev.depth.' + asset.relief_class)}</span>}</figcaption>
            <div class={'shot-img' + (isRelief ? ' shot-cut' : '')}>
              {!color ? <Loading /> : isRelief ? <CutOut color={color} aux={auxUrl} label={t('rev.result')} /> : <img src={color} alt={t('rev.resultPhoto')} data-shot="result" data-ready="true" />}
              {(busy === 'rebuild' || busy === 'analyse') && <div class="shot-busy" role="status"><span class="spin" aria-hidden="true" />{busy === 'analyse' ? t('rev.analysing') : t('rev.rebuilding')}</div>}
            </div>
            {!isRelief && <p class="hint">{t('rev.photoNote')}</p>}
          </figure>
        )}
      </div>

      {asset.status === 'ready_for_review' && isRelief && asset.meta && asset.meta.warn && <Note kind="warn" title={t('rev.hint')}>{warnText(String(asset.meta.warn))}</Note>}
      {error && <Note kind="error">{error}</Note>}

      {asset.status === 'ready_for_review' && (
        <>
          {isRelief && (
            <section class="card" aria-labelledby="depth-h">
              <h2 id="depth-h">{t('rev.depth')}</h2>
              {noStudio ? <Note kind="warn">{t('pic.studio.unsupported')}</Note> : (
                <div class="depths" role="radiogroup" aria-labelledby="depth-h">
                  {DEPTHS.map((k) => (
                    <button key={k} type="button" role="radio" aria-checked={asset.relief_class === k ? 'true' : 'false'} class="depth" disabled={!!busy} data-depth={k}
                      onClick={() => { if (asset.relief_class !== k) run(() => rebuild(asset.id, k), () => setSaid(t('rev.depth.' + k))); }}>
                      <span class="strong">{t('rev.depth.' + k)}</span><span class="muted">{t('rev.depth.eg.' + k)}</span>
                    </button>
                  ))}
                </div>
              )}
              <div class="stack-sm">
                <Btn icon="cube" onClick={() => setTable(!table)} aria-expanded={table ? 'true' : 'false'}>{t('rev.onTable')}</Btn>
                {table && <TablePreview asset={asset} item={item} />}
              </div>
            </section>
          )}
          <section class="card approve">
            <div class="approve-actions">
              <Btn kind="primary" icon="check" busy={busy === 'approve'} disabled={!!busy && busy !== 'approve'} data-action="approve" onClick={() => run(() => approve(asset.id), () => { toast(t('rev.approved')); go('pictures'); })}>{t('rev.approve')}</Btn>
              {isRelief
                ? <Btn busy={busy === 'photo'} disabled={!!busy && busy !== 'photo'} data-action="use-photo" onClick={() => run(() => usePhoto(asset.id))}>{t('pic.usePhoto')}</Btn>
                : !noStudio && asset.attempts < ATTEMPTS && <Btn disabled={!!busy} onClick={() => { retry(asset.id); go('pictures'); }}>{t('rev.backToRelief')}</Btn>}
              <Btn icon="camera" disabled={!!busy} onClick={() => pickRef.current?.click()}>{t('rev.another')}</Btn>
              <Btn kind="ghost" busy={busy === 'reject'} disabled={!!busy && busy !== 'reject'} data-action="reject" onClick={() => run(() => reject(asset.id), () => { toast(t('rev.rejected')); go('pictures'); })}>{t('rev.reject')}</Btn>
            </div>
          </section>
        </>
      )}

      {asset.status === 'approved' && (
        <section class="card approve">
          <p><Icon name="check" size={18} /> {inUse ? t('rev.approvedState') : t('pic.st.approved_unused')}</p>
          <div class="approve-actions">
            {!inUse && item && <Btn kind="primary" busy={busy === 'approve'} onClick={() => run(() => approve(asset.id), () => toast(t('rev.approved')))}>{t('rev.approve')}</Btn>}
            <Btn icon="camera" onClick={() => pickRef.current?.click()}>{t('rev.another')}</Btn>
            <Btn kind="ghost" busy={busy === 'reject'} data-action="remove" onClick={() => run(() => reject(asset.id), () => { toast(t('rev.rejected')); go('pictures'); })}>{t('rev.remove')}</Btn>
          </div>
        </section>
      )}
    </div>
  );
}
