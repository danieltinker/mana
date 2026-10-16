// Everything about a dish's picture that more than one screen shows: the thumbnail (own photo, illustration with its
// badge, or empty), the sheet with what can be done to it, the illustration picker, the photo inputs, the studio line.
import { signal } from '@preact/signals';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { t, errText, lang } from './lib/i18n.ts';
import { toAppError } from './lib/api.ts';
import { D, edit, textOf, toast, type Asset, type Item } from './lib/store.ts';
import { studio, jobs, busyAsset, localError, urlVersion, checkStudio, prepareStudio, cancelStudioDownload, addPhoto, cancelJob, retry, usePhoto, reject, currentAsset, fileUrl } from './lib/pictures.ts';
import { stock, loadStock, stockThumb, stockName, stockVisible, searchStock, GROUPS, type StockEntry } from './lib/stock.ts';
import { Btn, Sheet, Icon, go } from './ui.tsx';

export const nameOf = (row: any) => textOf(row, 'name', lang.value);
const mb = (n: number) => String(Math.round(n / 1e6));
export const ATTEMPTS = 5;
export const picErr = (code: string) => errText(code, 'pic.e').replace(t('err.unknown'), t('pic.e.other'));

export function useFileUrl(asset: Asset | null | undefined, file: 'original' | 'color' | 'aux' | 'thumb'): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const v = urlVersion.value;
  useEffect(() => {
    let on = true;
    if (!asset) { setUrl(null); return; }
    fileUrl(asset, file).then((u) => { if (on) setUrl(u); }).catch(() => { if (on) setUrl(null); });
    return () => { on = false; };
  }, [asset?.id, asset?.updated_at, asset?.status, file, v]);
  return url;
}

/** What state a dish's picture is in, in one word (also the data-status the tests and the styles read). */
export function picState(item: Item): { a: Asset | null; state: 'none' | 'stock' | 'working' | 'review' | 'approved' | 'unused' | 'failed' | 'halfway'; phase: string | null } {
  const a = currentAsset(item.id);
  const job = a ? jobs.value.find((x) => x.assetId === a.id) : null;
  if (a && job) return { a, state: 'working', phase: job.phase };
  if (a && a.status === 'ready_for_review') return { a, state: 'review', phase: null };
  if (a && a.status === 'approved') return { a, state: item.asset_id === a.id ? 'approved' : 'unused', phase: null };
  if (a && a.status === 'failed') return { a, state: 'failed', phase: null };
  if (a && (a.status === 'uploaded' || a.status === 'processing')) return { a, state: 'halfway', phase: null };
  return { a: null, state: item.stock_id && stockThumb(item.stock_id) ? 'stock' : 'none', phase: null };
}
export function phaseText(assetId: string): string | null {
  const j = jobs.value.find((x) => x.assetId === assetId);
  if (!j) return null;
  if (j.phase === 'studio' && studio.value.status === 'loading' && studio.value.phase === 'download') return t('pic.studio.downloading', { done: mb(studio.value.loaded), total: mb(studio.value.total) });
  return t('pic.st.' + j.phase);
}

/** One short line about a dish's picture: what it is now, or what can be done. */
export function picLine(item: Item): string {
  const st = picState(item), a = st.a;
  if (st.state === 'working') return phaseText(a!.id) || t('pic.st.waiting');
  if (st.state === 'review') return t(a!.kind === 'photo' ? 'pic.st.ready_photo' : 'pic.st.ready_relief');
  if (st.state === 'approved') return t(a!.kind === 'photo' ? 'pic.st.approved_photo' : 'pic.st.approved_relief');
  if (st.state === 'unused') return t('pic.st.approved_unused');
  if (st.state === 'halfway') return t('pic.st.uploaded');
  if (st.state === 'failed') return t('pic.st.failed');
  if (st.state === 'stock') return t('pic.st.stock', { name: stockName(item.stock_id, lang.value) });
  return t('pic.add');
}

/** The picture of a dish as the owner should see it right now. Illustrations always carry their badge. */
export function DishPic({ item, size = 'row', asset }: { item?: Item | null; size?: 'row' | 'tile' | 'big' | 'slot'; asset?: Asset | null }) {
  const st = item ? picState(item) : { a: asset || null, state: asset ? 'review' : 'none', phase: null } as ReturnType<typeof picState>;
  const a = asset !== undefined ? asset : st.a;
  const has = !!a && !!a.thumb_path && ['ready_for_review', 'approved'].includes(a.status);
  const thumb = useFileUrl(has ? a : null, 'thumb');
  const orig = useFileUrl(!has && a && a.status !== 'rejected' ? a : null, 'original');
  const stockUrl = !a && item && item.stock_id ? stockThumb(item.stock_id) : null;
  void stock.value.status;                                              // redraw when the library arrives
  const src = thumb || orig || stockUrl;
  const cls = 'pic pic-' + size + (src ? '' : ' pic-none') + (has && a!.kind === 'relief' ? ' pic-relief' : '') + (stockUrl ? ' pic-stock' : '');
  return (
    <span class={cls} data-pic={stockUrl ? 'stock' : has ? a!.kind : a ? 'original' : 'none'}>
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : <Icon name={size === 'row' ? 'image' : 'plus'} size={size === 'row' ? 20 : 26} />}
      {stockUrl && <span class="pic-badge" data-badge="illustration">{t('pic.illus')}</span>}
      {st.state === 'working' && <span class="pic-busy" aria-hidden="true"><span class="spin" /></span>}
    </span>
  );
}

// ---------------------------------------------------------------- choosing a photo (two hidden inputs for the whole app)
export const picError = signal<{ itemId: string; text: string } | null>(null);
const adding = signal<string | null>(null);
let target: string | null = null, pickEl: HTMLInputElement | null = null, camEl: HTMLInputElement | null = null;
export const isAdding = (itemId: string) => adding.value === itemId;
export const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } };
export function pickPhoto(itemId: string, how: 'pick' | 'camera' = 'pick') { target = itemId; picError.value = null; (how === 'camera' ? camEl : pickEl)?.click(); }
export function PhotoInputs() {
  async function onFile(e: Event) {
    const input = e.target as HTMLInputElement, file = input.files && input.files[0], itemId = target;
    input.value = '';
    if (!file || !itemId) return;
    adding.value = itemId; picError.value = null;
    try { await addPhoto(itemId, file); }
    catch (err) { const code = toAppError(err).code; picError.value = { itemId, text: picErr(code === 'unknown' ? 'bad_image' : code) }; }
    finally { adding.value = null; }
  }
  return <>
    <input ref={(el) => { pickEl = el; }} class="sr" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" data-photo-input="pick" onChange={onFile} />
    <input ref={(el) => { camEl = el; }} class="sr" type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" data-photo-input="camera" onChange={onFile} />
  </>;
}

// ---------------------------------------------------------------- the studio (72 MB, once): one line and a bar, only when it matters
export function StudioLine() {
  const s = studio.value;
  useEffect(() => { checkStudio(); }, []);
  if (s.status === 'unsupported') return <p class="line line-warn" data-studio="unsupported"><Icon name="alert" size={18} /><span>{t('pic.studio.unsupported')} {t('pic.studio.unsupportedBody')}</span></p>;
  if (s.status === 'unavailable') return <p class="line line-bad" data-studio="unavailable" role="alert"><Icon name="alert" size={18} /><span>{t('pic.studio.unavailable')}</span></p>;
  if (s.status === 'failed') return <p class="line line-bad" data-studio="failed" role="alert"><Icon name="alert" size={18} /><span>{s.error === 'memory' ? picErr('memory') : t('pic.studio.failed')}</span><Btn small icon="refresh" onClick={() => prepareStudio().catch(() => {})}>{t('app.retry')}</Btn></p>;
  if (s.status !== 'loading') return null;
  const pct = s.total ? Math.min(100, Math.round((s.loaded / s.total) * 100)) : 0;
  return (
    <div class="line line-studio" data-studio="loading">
      <p role="status" aria-live="polite"><span dir="auto">{s.phase === 'download' ? t('pic.studio.downloading', { done: mb(s.loaded), total: mb(s.total) }) : t('pic.studio.' + (s.phase === 'models' ? 'models' : 'runtime'))}</span></p>
      <progress max={100} value={s.phase === 'download' ? pct : 100} aria-label={t('pic.studio.title')} />
      {s.phase === 'download' && <Btn small kind="ghost" onClick={cancelStudioDownload}>{t('pic.studio.cancel')}</Btn>}
    </div>
  );
}

/** Four things that make a photo work, as icons; a tap shows the sentence. */
export function Tips() {
  const [open, setOpen] = useState(0);
  const TIPS = [['plate', 1], ['frame', 2], ['angle', 3], ['backdrop', 4]] as const;
  return (
    <div class="tips">
      <div class="tips-row" role="group" aria-label={t('pic.tips')}>
        {TIPS.map(([icon, n]) => <button key={n} type="button" class="tip" aria-expanded={open === n ? 'true' : 'false'} aria-controls="tip-text" onClick={() => setOpen(open === n ? 0 : n)}><Icon name={icon} size={22} /><span>{t('pic.tipw' + n)}</span></button>)}
      </div>
      <p id="tip-text" class="tip-text" role="status" hidden={!open}>{open ? t('pic.tip' + open) : ''}</p>
    </div>
  );
}

// ---------------------------------------------------------------- what can be done to one dish's picture
export function PicActions({ item, onPick, onDone }: { item: Item; onPick: () => void; onDone?: () => void }) {
  const st = picState(item), a = st.a, name = nameOf(item);
  const errCode = a ? localError.value[a.id] || (a.status === 'failed' ? a.error_code || 'internal' : '') : '';
  const limit = !!a && a.status === 'failed' && (a.attempts >= ATTEMPTS || errCode === 'limit_attempts');
  const busy = a ? busyAsset.value[a.id] : null;
  const touch = useMemo(coarse, []);
  const adding2 = isAdding(item.id);
  const err = picError.value && picError.value.itemId === item.id ? picError.value.text : '';
  const photo = (how: 'pick' | 'camera') => pickPhoto(item.id, how);
  const failedText = st.state === 'failed' ? (limit ? picErr('limit_attempts') : picErr(errCode)) : '';
  const stateText = st.state === 'none' || st.state === 'failed' ? '' : picLine(item);
  return (
    <div class="picact" data-item-actions={item.id} data-status={st.state}>
      {stateText && <p class={'picact-state st-' + st.state} role={st.state === 'working' ? 'status' : undefined}>{st.state === 'working' && <span class="spin spin-sm" aria-hidden="true" />}<span dir="auto">{stateText}</span></p>}
      {failedText && <p class="row-err" role="alert">{failedText}{!limit && a!.attempts > 1 && <span class="muted"> · {t('pic.attempt', { n: a!.attempts })}</span>}</p>}
      {err && <p class="row-err" role="alert">{err}</p>}
      <div class="actlist">
        {st.state === 'working' && <Btn icon="x" onClick={() => cancelJob(a!.id)}>{t('pic.cancel')}</Btn>}
        {st.state === 'review' && <Btn kind="primary" icon="check" onClick={() => { onDone && onDone(); go('pictures/' + a!.id); }}>{t('pic.review')}</Btn>}
        {(st.state === 'approved' || st.state === 'unused') && <Btn icon="eye" onClick={() => { onDone && onDone(); go('pictures/' + a!.id); }} data-action="view-picture">{t('pic.view')}</Btn>}
        {st.state === 'failed' && !limit && !['bad_image', 'upload_lost', 'unsupported'].includes(errCode) && <Btn kind="primary" icon="refresh" onClick={() => retry(a!.id)}>{t('pic.tryAgain')}</Btn>}
        {st.state === 'failed' && a!.original_path && errCode !== 'bad_image' && <Btn busy={busy === 'photo'} icon="image" onClick={() => usePhoto(a!.id).then(() => { onDone && onDone(); go('pictures/' + a!.id); }).catch((e) => toast(picErr(toAppError(e).code), 'error'))}>{t('pic.usePhoto')}</Btn>}
        {st.state !== 'working' && (touch
          ? <><Btn kind={a ? 'secondary' : 'primary'} icon="camera" busy={adding2} aria-label={t('pic.takeFor', { name })} onClick={() => photo('camera')}>{t('pic.take')}</Btn>
              <Btn icon="image" aria-label={t('pic.chooseFor', { name })} onClick={() => photo('pick')}>{t('pic.choose')}</Btn></>
          : <Btn kind={a ? 'secondary' : 'primary'} icon="camera" busy={adding2} aria-label={a ? t('pic.replaceFor', { name }) : t('pic.addFor', { name })} onClick={() => photo('pick')}>{a ? t('pic.replace') : t('pic.add')}</Btn>)}
        {st.state !== 'working' && <Btn icon="sparkle" onClick={onPick} data-action="choose-illustration">{t(item.stock_id ? 'pic.otherIllus' : 'pic.chooseIllus')}</Btn>}
        {(st.state === 'approved' || st.state === 'unused' || st.state === 'review') && <Btn kind="ghost" icon="trash" busy={busy === 'reject'} data-action="remove-picture" aria-label={t('pic.remove')} title={t('pic.remove')} onClick={() => reject(a!.id).then(() => toast(t('rev.rejected'))).catch((e) => toast(picErr(toAppError(e).code), 'error'))}>{t('pic.remove')}</Btn>}
        {!a && item.stock_id && <Btn kind="ghost" icon="ban" data-action="no-picture" aria-label={t('pic.none')} title={t('pic.none')} onClick={() => edit('items', item.id, { stock_id: null }, { now: true })}>{t('pic.none')}</Btn>}
      </div>
    </div>
  );
}

/** The sheet that opens from a tile of the pictures grid. */
export function PicSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const [picker, setPicker] = useState(false);
  const fresh = D.value?.items.find((i) => i.id === item.id) || item;
  if (picker) return <StockPicker item={fresh} onClose={() => setPicker(false)} />;
  return (
    <Sheet open onClose={onClose} title={nameOf(fresh)} name="picture">
      <div class="picsheet">
        <DishPic item={fresh} size="big" />
        <PicActions item={fresh} onPick={() => setPicker(true)} onDone={onClose} />
        <Tips />
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------- the illustration picker
export function StockPicker({ item, onClose }: { item: Item; onClose: () => void }) {
  const [query, setQuery] = useState('');
  useEffect(() => { loadStock(); }, []);
  const lib = stock.value;
  const found = useMemo(() => (lib.status === 'ready' ? searchStock(query) : []), [query, lib.status]);
  const groups = useMemo(() => {
    if (query.trim()) return [{ id: '', entries: found }];
    const by = new Map<string, StockEntry[]>();
    for (const e of stockVisible()) by.set(e.group, [...(by.get(e.group) || []), e]);
    const known = GROUPS.filter((g) => by.has(g)), rest = [...by.keys()].filter((g) => !GROUPS.includes(g));
    return [...known, ...rest].map((g) => ({ id: g, entries: by.get(g)! }));
  }, [found, query, lib.status]);
  const choose = (id: string | null) => { edit('items', item.id, { stock_id: id }, { now: true }); onClose(); };
  const L = lang.value;
  return (
    <Sheet open onClose={onClose} title={t('pick.title')} tall name="illustrations">
      <div class="picker">
        <input class="picker-search" type="search" dir="auto" placeholder={t('pick.search')} aria-label={t('pick.search')} value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
        <p class="hint">{t('pic.illus.note')}</p>
        {lib.status === 'loading' && <p class="muted" role="status">{t('app.loading')}</p>}
        {lib.status === 'failed' && <p class="row-err" role="alert">{t('pick.failed')}</p>}
        {lib.status === 'ready' && (
          <>
            <div class="pickgrid">
              <button type="button" class={'pickcell' + (!item.stock_id ? ' on' : '')} aria-pressed={!item.stock_id ? 'true' : 'false'} data-stock="" onClick={() => choose(null)}>
                <span class="pic pic-tile pic-none"><Icon name="ban" size={26} /></span><span class="pickname">{t('pick.none')}</span>
              </button>
            </div>
            {groups.map((g) => g.entries.length > 0 && (
              <section key={g.id} class="pickgroup">
                {g.id && <h3>{t('sg.' + g.id) === 'sg.' + g.id ? g.id : t('sg.' + g.id)}</h3>}
                <div class="pickgrid">
                  {g.entries.map((e) => (
                    <button key={e.id} type="button" class={'pickcell' + (item.stock_id === e.id ? ' on' : '')} aria-pressed={item.stock_id === e.id ? 'true' : 'false'} data-stock={e.id} onClick={() => choose(e.id)}>
                      <span class="pic pic-tile pic-stock"><img src={stockThumb(e.id) || ''} alt="" loading="lazy" decoding="async" /><span class="pic-badge">{t('pic.illus')}</span></span>
                      <span class="pickname">{e.name[L] || e.name.en || e.name.he}</span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
            {query.trim() && found.length === 0 && <p class="muted">{t('pick.nothing')}</p>}
          </>
        )}
      </div>
    </Sheet>
  );
}
