// The menu: empty → three ways to fill it (scan a photo, paste a list, type). With dishes → the editor, as a list or as
// the pictures grid. Before the first publish these are steps one and two of the path, with one button that leads on.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { t, tn, errText, lang } from '../lib/i18n.ts';
import { D, edit, move, moveTo, sortRows, createCategory, deleteCategory, createItem, bulkAdd, toast, everPublished, textOf, type Cat, type Item } from '../lib/store.ts';
import { toAppError } from '../lib/api.ts';
import { parsePrice, formatPrice } from '../lib/money.ts';
import { parsePasted, guessKind, type PastedCategory } from '../lib/paste.ts';
import { jobs, unfinished, resumeUnfinished, discardUnfinished } from '../lib/pictures.ts';
import { illus, initIllus, setIllus, loadStock, stockForNew } from '../lib/stock.ts';
import { aiOn, askAi } from '../lib/ai.ts';
import { startScan } from '../lib/scan.ts';
import { Btn, IconBtn, Field, Note, Dialog, Confirm, Sheet, Seg, Sticky, Switch, Icon, Ltr, go, route } from '../ui.tsx';
import { DishPic, PicSheet, StudioLine, Tips, picState, phaseText, nameOf, coarse } from '../pic.tsx';
import { ItemSheet } from './item.tsx';

export const KINDS = ['food', 'dessert', 'drinks', 'wine', 'beer'];
export const entryLang = () => (D.value!.biz.default_lang === 'en' ? 'en' : 'he') as 'he' | 'en';
export const langsOf = () => { const b = D.value!.biz; const l: ('he' | 'en')[] = (b.langs || ['he', 'en']).filter((x: string) => x === 'he' || x === 'en'); return l.sort((a, c) => (a === b.default_lang ? -1 : c === b.default_lang ? 1 : 0)); };
const noPhoto = (i: Item) => { const s = picState(i).state; return s === 'none' || s === 'stock' || s === 'failed'; };

// ---------------------------------------------------------------- starting a scan (inputs live once, here)
const scanAsk = signal<'' | 'choose' | 'off'>('');
let scanPick: HTMLInputElement | null = null, scanCam: HTMLInputElement | null = null;
export async function startScanFlow() {
  if (aiOn.value === 'unknown') await askAi();
  if (aiOn.value !== 'on') { scanAsk.value = 'off'; return; }
  if (coarse()) scanAsk.value = 'choose'; else scanPick?.click();
}
function ScanInputs({ onPaste, onType }: { onPaste: () => void; onType: () => void }) {
  useEffect(() => { askAi(); loadStock(); }, []);
  const onFiles = (e: Event) => {
    const input = e.target as HTMLInputElement, files = Array.from(input.files || []);
    input.value = ''; scanAsk.value = '';
    if (!files.length) return;
    startScan(files); go('scan');
  };
  const ask = scanAsk.value;
  return <>
    <input ref={(el) => { scanPick = el; }} class="sr" type="file" accept="image/*" multiple tabIndex={-1} aria-hidden="true" data-scan-input="pick" onChange={onFiles} />
    <input ref={(el) => { scanCam = el; }} class="sr" type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" data-scan-input="camera" onChange={onFiles} />
    <Sheet open={ask === 'choose'} onClose={() => { scanAsk.value = ''; }} title={t('scan.title')} name="scan-choose">
      <div class="actlist">
        <Btn kind="primary" icon="camera" onClick={() => scanCam?.click()}>{t('scan.take')}</Btn>
        <Btn icon="image" onClick={() => scanPick?.click()}>{t('scan.choose')}</Btn>
      </div>
      <p class="hint">{t('scan.pagesHint')}</p>
    </Sheet>
    <Sheet open={ask === 'off'} onClose={() => { scanAsk.value = ''; }} title={t('scan.off.title')} name="scan-off">
      <p data-scan-off>{t('scan.off.body')}</p>
      <div class="actlist">
        <Btn kind="primary" icon="paste" onClick={() => { scanAsk.value = ''; onPaste(); }}>{t('menu.paste')}</Btn>
        <Btn icon="keys" onClick={() => { scanAsk.value = ''; onType(); }}>{t('menu.type')}</Btn>
      </div>
    </Sheet>
  </>;
}

// ---------------------------------------------------------------- the screen
export function MenuScreen({ view }: { view: 'list' | 'grid' }) {
  const d = D.value!;
  const path = !everPublished();
  const cats = useMemo(() => sortRows(d.categories), [d.categories]);
  const [catDialog, setCatDialog] = useState<{ cat: Cat | null } | null>(null);
  const [paste, setPaste] = useState(false), [imp, setImp] = useState(false), [reorder, setReorder] = useState(false), [only, setOnly] = useState(false);
  const [pic, setPic] = useState<string | null>(null), [focusCat, setFocusCat] = useState<string | null>(null), [live, setLive] = useState('');
  const sheetId = route.value[0] === 'menu' && route.value[1] === 'i' ? route.value[2] : null;
  useEffect(() => { initIllus(); }, [d.biz.id]);

  const doMove = (table: 'categories' | 'items', row: any, dir: -1 | 1) => {
    if (!move(table, row.id, dir)) return;
    const sibs = sortRows(table === 'items' ? D.value!.items.filter((i) => i.category_id === row.category_id) : D.value!.categories);
    setLive(t('menu.moved', { name: nameOf(row), n: sibs.findIndex((r) => r.id === row.id) + 1 }));
  };
  const typeIt = () => { setImp(false); if (cats.length) setFocusCat(cats[cats.length - 1].id); else setCatDialog({ cat: null }); };
  const missing = d.items.filter(noPhoto).length;
  const empty = d.items.length === 0;                       // no dishes yet: the three ways to bring them in come first
  const title = view === 'grid' && path ? t('pic.title') : t('menu.title');

  return (
    <div class={'page page-menu' + (path ? ' has-sticky' : '')} data-view={view}>
      <ScanInputs onPaste={() => setPaste(true)} onType={typeIt} />
      <p class="sr" aria-live="polite">{live}</p>

      {empty && (
        <>
          <header class="page-head"><h1 tabIndex={-1}>{t('menu.empty.title')}</h1></header>
          <div class="ways" data-ways>
            <button type="button" class="way way-main" data-way="scan" onClick={() => startScanFlow()}>
              <span class="way-ico"><Icon name="scan" size={30} /></span>
              <span class="way-text"><span class="way-title">{t('menu.way.scan')}</span><span class="chip chip-dark">{t('menu.way.fastest')}</span></span>
            </button>
            <button type="button" class="way" data-way="paste" onClick={() => setPaste(true)}>
              <span class="way-ico"><Icon name="paste" size={28} /></span><span class="way-text"><span class="way-title">{t('menu.paste')}</span></span>
            </button>
            <button type="button" class="way" data-way="type" onClick={typeIt}>
              <span class="way-ico"><Icon name="keys" size={28} /></span><span class="way-text"><span class="way-title">{t('menu.type')}</span></span>
            </button>
          </div>
        </>
      )}
      {(!empty || cats.length > 0) && (
        <>
          <header class="page-head menu-head">
            {!empty && <h1 tabIndex={-1}>{title}</h1>}
            <div class="menu-tools">
              {!path && <Seg small value={view} label={t('menu.view')} onChange={(v) => go(v === 'grid' ? 'pictures' : 'menu')} options={[{ value: 'list', label: t('menu.view.list'), icon: 'list' }, { value: 'grid', label: t('menu.view.grid'), icon: 'grid' }]} />}
              {view === 'list' && d.items.length > 1 && <button type="button" class={'toolbtn' + (reorder ? ' on' : '')} aria-pressed={reorder ? 'true' : 'false'} onClick={() => setReorder(!reorder)} data-tool="reorder"><Icon name="reorder" size={18} /><span>{t('menu.reorder')}</span></button>}
              {view === 'list' && <button type="button" class="toolbtn" onClick={() => setCatDialog({ cat: null })} data-tool="section"><Icon name="plus" size={18} /><span>{t('menu.addCategory')}</span></button>}
              {view === 'list' && !empty && <button type="button" class="toolbtn" onClick={() => setImp(true)} data-tool="import"><Icon name="scan" size={18} /><span>{t('menu.import')}</span></button>}
              {missing > 0 && (view === 'grid' || !path) && <button type="button" class={'toolbtn' + (only ? ' on' : '')} aria-pressed={only ? 'true' : 'false'} onClick={() => setOnly(!only)} data-tool="nophoto"><Icon name="camera" size={18} /><span>{t('menu.noPhoto')}</span><b>{missing}</b></button>}
            </div>
          </header>

          {view === 'grid' && !empty && <GridTop />}

          {cats.map((c, ci) => {
            let items = sortRows(d.items.filter((i) => i.category_id === c.id));
            if (only) items = items.filter(noPhoto);
            if (view === 'grid' || only) { if (!items.length) return null; }
            const cname = nameOf(c);
            return (
              <section key={c.id} class={'sec' + (view === 'grid' ? ' sec-grid' : '')} aria-labelledby={'cat-' + c.id} data-cat={c.id}>
                <header class="sec-head">
                  <h2 id={'cat-' + c.id}>{cname}</h2>
                  <span class="sec-n">{items.length}</span>
                  {view === 'list' && <div class="tools">
                    {reorder && <><IconBtn icon="up" label={t('menu.up', { name: cname })} disabled={ci === 0} onClick={() => doMove('categories', c, -1)} />
                      <IconBtn icon="down" label={t('menu.down', { name: cname })} disabled={ci === cats.length - 1} onClick={() => doMove('categories', c, 1)} /></>}
                    <IconBtn icon="edit" label={t('menu.cat.edit') + ': ' + cname} onClick={() => setCatDialog({ cat: c })} />
                  </div>}
                </header>
                {view === 'grid' ? (
                  <ul class="tiles2">
                    {items.map((it) => <Tile key={it.id} item={it} onOpen={() => setPic(it.id)} />)}
                  </ul>
                ) : (
                  <>
                    <Rows items={items} reorder={reorder && !only} onMove={doMove} onLive={setLive} />
                    {!only && <QuickAdd cat={c} open={items.length === 0 || focusCat === c.id} autoFocus={focusCat === c.id} />}
                  </>
                )}
              </section>
            );
          })}
          {only && missing === 0 && <p class="muted center">{t('menu.noPhotoNone')}</p>}
        </>
      )}

      {path && !empty && (view === 'list'
        ? <Sticky><Btn kind="primary" block disabled={d.items.length === 0} onClick={() => go('pictures')} data-next="pictures">{t('path.next.pictures')}</Btn></Sticky>
        : <Sticky><Btn kind="primary" block onClick={() => go('publish')} data-next="publish">{t('path.next.publish')}</Btn></Sticky>)}

      {catDialog && <SectionDialog cat={catDialog.cat} onClose={(made) => { setCatDialog(null); if (made) setFocusCat(made); }} />}
      {paste && <PasteSheet onClose={() => setPaste(false)} />}
      <Sheet open={imp} onClose={() => setImp(false)} title={t('menu.import')} name="import">
        <div class="actlist">
          <Btn kind="primary" icon="scan" onClick={() => { setImp(false); startScanFlow(); }} data-way="scan">{t('menu.way.scan')}</Btn>
          <Btn icon="paste" onClick={() => { setImp(false); setPaste(true); }} data-way="paste">{t('menu.paste')}</Btn>
          <Btn icon="keys" onClick={typeIt} data-way="type">{t('menu.type')}</Btn>
        </div>
      </Sheet>
      {pic && D.value!.items.find((i) => i.id === pic) && <PicSheet item={D.value!.items.find((i) => i.id === pic)!} onClose={() => setPic(null)} />}
      {sheetId && <ItemSheet id={sheetId} onClose={() => go(view === 'grid' ? 'pictures' : 'menu')} />}
    </div>
  );
}

// ---------------------------------------------------------------- the list
function Rows({ items, reorder, onMove, onLive }: { items: Item[]; reorder: boolean; onMove: (table: 'categories' | 'items', row: any, dir: -1 | 1) => void; onLive: (s: string) => void }) {
  const d = D.value!;
  const list = useRef<HTMLUListElement>(null);
  const drag = useRef<{ id: string; from: number; to: number; y0: number; h: number } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; dy: number; to: number; from: number } | null>(null);

  // drag to reorder (pointer): the row follows the finger, the others make room; the buttons stay for keyboards
  const down = (e: PointerEvent, it: Item, index: number) => {
    if (!reorder || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const li = (e.currentTarget as HTMLElement).closest('li') as HTMLElement;
    drag.current = { id: it.id, from: index, to: index, y0: e.clientY, h: li.getBoundingClientRect().height };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging({ id: it.id, dy: 0, to: index, from: index });
    e.preventDefault();
  };
  const moveP = (e: PointerEvent) => {
    const g = drag.current; if (!g) return;
    const dy = e.clientY - g.y0;
    g.to = Math.max(0, Math.min(items.length - 1, g.from + Math.round(dy / g.h)));
    setDragging({ id: g.id, dy, to: g.to, from: g.from });
  };
  const up = () => {
    const g = drag.current; drag.current = null; setDragging(null);
    if (!g || g.to === g.from) return;
    const row = items[g.from];
    if (moveTo('items', g.id, g.to)) onLive(t('menu.moved', { name: nameOf(row), n: g.to + 1 }));
  };
  if (!items.length) return null;
  return (
    <ul class={'rows' + (reorder ? ' is-reorder' : '')} ref={list}>
      {items.map((it, ii) => {
        const iname = nameOf(it), st = picState(it);
        let shift = 0;
        if (dragging && dragging.id !== it.id) {
          if (dragging.from < ii && ii <= dragging.to) shift = -1; else if (dragging.to <= ii && ii < dragging.from) shift = 1;
        }
        const style = dragging ? (dragging.id === it.id ? { transform: `translateY(${dragging.dy}px)`, zIndex: 3 } : { transform: shift ? `translateY(${shift * (drag.current?.h || 68)}px)` : undefined }) : undefined;
        return (
          <li key={it.id} class={'row' + (it.available ? '' : ' is-out') + (dragging && dragging.id === it.id ? ' is-dragging' : '')} data-item={it.id} data-status={st.state} style={style as any}>
            {reorder && <span class="grip" aria-hidden="true" onPointerDown={(e) => down(e as any, it, ii)} onPointerMove={(e) => moveP(e as any)} onPointerUp={up} onPointerCancel={up}><Icon name="grip" size={20} /></span>}
            <a class="row-main" href={'#/menu/i/' + it.id} aria-label={t('menu.item.edit', { name: iname })}>
              <DishPic item={it} />
              <span class="row-text">
                <span class="row-name">{iname}</span>
                <span class="row-sub">
                  {it.price_minor == null ? <span class="muted">{t('menu.item.noPrice')}</span> : <Ltr class="price">{formatPrice(it.price_minor, d.biz.currency)}</Ltr>}
                  {!it.available && <span class="badge badge-out">{t('menu.item.soldOut')}</span>}
                  {st.state === 'review' && <span class="badge badge-todo">{t('pic.badge.review')}</span>}
                </span>
              </span>
            </a>
            {reorder && <div class="tools">
              <IconBtn icon="up" label={t('menu.up', { name: iname })} disabled={ii === 0} onClick={() => onMove('items', it, -1)} />
              <IconBtn icon="down" label={t('menu.down', { name: iname })} disabled={ii === items.length - 1} onClick={() => onMove('items', it, 1)} />
            </div>}
          </li>
        );
      })}
    </ul>
  );
}

function QuickAdd({ cat, open, autoFocus }: { cat: Cat; open: boolean; autoFocus: boolean }) {
  const [shown, setShown] = useState(open);
  const [name, setName] = useState(''), [price, setPrice] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [said, setSaid] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const L = entryLang();
  useEffect(() => { if (open) setShown(true); }, [open]);
  useEffect(() => { if (autoFocus && shown) nameRef.current?.focus(); }, [autoFocus, shown]);
  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    const n = name.trim(), p = parsePrice(price);
    if (!n) { setError(t('menu.item.nameMissing')); nameRef.current?.focus(); return; }
    if (p === 'invalid') { setError(t('menu.item.badPrice')); return; }
    setBusy(true); setError('');
    try {
      const row = { ['name_' + L]: n.slice(0, 90) } as any;
      await createItem(cat.id, { ...row, price_minor: p, stock_id: stockForNew(row, cat) });
      setName(''); setPrice(''); setSaid(t('menu.quick.added', { name: n }));
      nameRef.current?.focus();                                     // "add another" keeps the hands on the keyboard
    } catch (err) { setError(errText(toAppError(err).code)); }
    finally { setBusy(false); }
  }
  const cname = nameOf(cat);
  if (!shown) return <button type="button" class="addrow" onClick={() => { setShown(true); setTimeout(() => nameRef.current?.focus(), 0); }} aria-label={t('menu.quick.label', { name: cname })} data-add-in={cat.id}><Icon name="plus" size={18} /><span>{t('menu.quick.open')}</span></button>;
  return (
    <form class="quick" onSubmit={submit} aria-label={t('menu.quick.label', { name: cname })} noValidate>
      <div class="quick-row">
        <input ref={nameRef} class="quick-name" type="text" maxLength={90} dir="auto" placeholder={t('menu.quick.name')} aria-label={t('menu.quick.name')} value={name} onInput={(e) => { setName((e.target as HTMLInputElement).value); setError(''); }} enterkeyhint="next" />
        <span class="quick-price"><input type="text" inputMode="decimal" dir="ltr" maxLength={12} placeholder={t('menu.quick.price')} aria-label={t('menu.quick.price')} value={price} onInput={(e) => { setPrice((e.target as HTMLInputElement).value); setError(''); }} enterkeyhint="done" /><span class="cur" aria-hidden="true">₪</span></span>
        <button type="submit" class={'iconbtn quick-go' + (busy ? ' is-busy' : '')} aria-label={t('menu.quick.add')} title={t('menu.quick.add')} disabled={busy}>{busy ? <span class="spin" aria-hidden="true" /> : <Icon name="plus" />}</button>
      </div>
      {error && <p class="ferr" role="alert">{error}</p>}
      <p class="sr" aria-live="polite">{said}</p>
    </form>
  );
}

// ---------------------------------------------------------------- the pictures grid
function GridTop() {
  const d = D.value!;
  const [busy, setBusy] = useState(false), [resuming, setResuming] = useState(false);
  const left = unfinished();
  const flip = async (on: boolean) => { setBusy(true); try { await setIllus(on); } catch (e) { toast(errText(toAppError(e).code), 'error'); } finally { setBusy(false); } };
  void d;
  return (
    <>
      <div class="illus" data-illus={illus.value ? 'on' : 'off'}>
        <div class="illus-row">
          <span class="illus-ico"><Icon name="sparkle" size={22} /></span>
          <p class="strong" id="illus-lbl">{t('pic.illus.switch')}</p>
          <Switch checked={illus.value} disabled={busy} label={t('pic.illus.switch')} onChange={flip} />
        </div>
        <p class="hint">{t('pic.illus.note')}</p>
      </div>
      <Tips />
      <StudioLine />
      {left.length > 0 && (
        <Note kind="warn" title={left.length === 1 ? t('pic.resume.title1') : t('pic.resume.title', { n: left.length })}
          action={<><Btn small kind="primary" busy={resuming} onClick={async () => { setResuming(true); try { await resumeUnfinished(); } finally { setResuming(false); } }}>{t('pic.resume.go')}</Btn><Btn small kind="ghost" onClick={() => discardUnfinished()}>{t('pic.resume.discard')}</Btn></>} />
      )}
      {jobs.value.length > 0 && <p class="queue-note" role="status"><span class="spin spin-sm" aria-hidden="true" />{t('pic.queue', { n: jobs.value.length })}</p>}
    </>
  );
}

function Tile({ item, onOpen }: { item: Item; onOpen: () => void }) {
  const st = picState(item), name = nameOf(item);
  const phase = st.a && st.state === 'working' ? phaseText(st.a.id) : null;
  return (
    <li class="tile2" data-item={item.id} data-status={st.state} data-asset={st.a ? st.a.id : ''}>
      <button type="button" class="tile2-btn" onClick={onOpen} aria-label={t('pic.for', { name })}>
        <DishPic item={item} size="tile" />
        <span class="tile2-name">{name}</span>
        {st.state === 'working' && <span class="tile2-state st-busy" role="status" dir="auto">{phase}</span>}
        {st.state === 'review' && <span class="tile2-state st-todo">{t('pic.badge.review')}</span>}
        {st.state === 'failed' && <span class="tile2-state st-bad">{t('pic.st.failed')}</span>}
        {st.state === 'halfway' && <span class="tile2-state st-bad">{t('pic.st.uploaded')}</span>}
      </button>
    </li>
  );
}

// ---------------------------------------------------------------- a section
function KindChips({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  return (
    <div class="kindchips" role="radiogroup" aria-label={t('menu.cat.kind')}>
      {KINDS.map((k) => <button key={k} type="button" role="radio" aria-checked={value === k ? 'true' : 'false'} class="kindchip" data-kind={k} onClick={() => onChange(k)}><Icon name={k} size={20} /><span>{t('kindc.' + k)}</span></button>)}
    </div>
  );
}

function SectionDialog({ cat, onClose }: { cat: Cat | null; onClose: (madeId?: string) => void }) {
  const langs = langsOf();
  const [L, setL] = useState<'he' | 'en'>(langs[0]);
  const [he, setHe] = useState(cat?.name_he || ''), [en, setEn] = useState(cat?.name_en || ''), [kind, setKind] = useState(cat?.kind || 'food'), [kindSet, setKindSet] = useState(!!cat);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmDel, setConfirmDel] = useState(false);
  const n = cat ? D.value!.items.filter((i) => i.category_id === cat.id).length : 0;
  const val = L === 'he' ? he : en;
  const onName = (v: string) => { (L === 'he' ? setHe : setEn)(v); setError(''); if (!kindSet) setKind(guessKind(v)); };
  async function save(e: Event) {
    e.preventDefault();
    if (!he.trim() && !en.trim()) return setError(t('menu.cat.nameMissing'));
    setBusy(true); setError('');
    try {
      if (cat) { edit('categories', cat.id, { name_he: he.trim(), name_en: en.trim(), kind }, { now: true }); onClose(); }
      else { const row = await createCategory({ name_he: he.trim(), name_en: en.trim(), kind }); onClose(row.id); }
    } catch (err) { setError(errText(toAppError(err).code)); }
    finally { setBusy(false); }
  }
  async function del() {
    setBusy(true);
    try { await deleteCategory(cat!.id); onClose(); }
    catch (err) { setError(errText(toAppError(err).code)); setConfirmDel(false); }
    finally { setBusy(false); }
  }
  return (
    <>
      <Sheet open={!confirmDel} onClose={() => onClose()} title={cat ? t('menu.cat.edit') : t('menu.addCategory')} name="section"
        head={langs.length > 1 ? <Seg small value={L} label={t('item.lang')} onChange={(v) => setL(v as 'he' | 'en')} options={langs.map((l) => ({ value: l, label: t(l === 'he' ? 'app.he.short' : 'app.en.short') }))} /> : undefined}>
        <form onSubmit={save} noValidate class="stack">
          <Field label={t('menu.cat.name')}>{(p) => <input {...p} type="text" dir={L === 'he' ? 'rtl' : 'ltr'} lang={L} maxLength={60} value={val} data-field={'cat_' + L} onInput={(e) => onName((e.target as HTMLInputElement).value)} />}</Field>
          <KindChips value={kind} onChange={(k) => { setKind(k); setKindSet(true); }} />
          {error && <Note kind="error">{error}</Note>}
          <div class="row-between">
            {cat ? <Btn kind="ghost" icon="trash" onClick={() => setConfirmDel(true)}>{t('app.delete')}</Btn> : <span />}
            <Btn type="submit" kind="primary" busy={busy}>{cat ? t('app.save') : t('menu.cat.add')}</Btn>
          </div>
        </form>
      </Sheet>
      {cat && <Confirm open={confirmDel} danger busy={busy} title={t('menu.cat.delete')} body={n ? tn('menu.cat.deleteConfirm', n, { name: nameOf(cat) }) : t('menu.cat.deleteConfirm0', { name: nameOf(cat) })} confirmLabel={t('app.delete')} onConfirm={del} onClose={() => setConfirmDel(false)} />}
    </>
  );
}

// ---------------------------------------------------------------- paste a list
function PasteSheet({ onClose }: { onClose: () => void }) {
  const d = D.value!;
  const [text, setText] = useState(''), [parsed, setParsed] = useState<PastedCategory[] | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const L = entryLang();
  const existing = (name: string) => d.categories.find((c) => [c.name_he, c.name_en].some((n: string) => n && n.trim().toLowerCase() === name.trim().toLowerCase()));
  const good = (parsed || []).map((c) => ({ ...c, items: c.items.filter((i) => !i.problem) })).filter((c) => c.items.length);
  const total = good.reduce((s, c) => s + c.items.length, 0);
  const bad = (parsed || []).reduce((s, c) => s + c.items.filter((i) => i.problem).length, 0);

  function review() {
    const p = parsePasted(text, t('paste.defaultCat'));
    if (!p.some((c) => c.items.length)) return setError(t('paste.nothing'));
    setError(''); setParsed(p);
  }
  async function add() {
    setBusy(true); setError('');
    const before = D.value!.items.length;
    try {
      await loadStock().catch(() => {});
      const n = await bulkAdd(good.map((c) => {
        const cat = { ['name_' + L]: c.name } as any;
        return { ...cat, kind: c.kind, existingId: existing(c.name)?.id, items: c.items.map((i) => { const row = { ['name_' + L]: i.name } as any; return { ...row, ['desc_' + L]: i.description || '', price_minor: i.price, stock_id: stockForNew(row, cat) }; }) };
      }));
      toast(tn('paste.added', n));
      onClose();
    } catch (err) {
      const done = D.value!.items.length - before;
      setError(errText(toAppError(err).code) + (done > 0 ? ' ' + t('paste.partial', { n: done }) : ''));
    } finally { setBusy(false); }
  }
  const setKind = (line: number, kind: any) => setParsed(parsed!.map((c) => (c.line === line ? { ...c, kind } : c)));

  return (
    <Sheet open onClose={onClose} title={t('menu.paste')} tall name="paste"
      foot={!parsed ? <Btn kind="primary" block onClick={review} disabled={!text.trim()}>{t('paste.review')}</Btn>
        : <><Btn kind="ghost" onClick={() => { setParsed(null); setError(''); }}>{t('app.back')}</Btn><Btn kind="primary" busy={busy} disabled={!total} onClick={add}>{tn('paste.add', total)}</Btn></>}>
      {!parsed ? (
        <div class="stack">
          <Field label={t('paste.field')} hint={t('paste.lead')}>{(p) => <textarea {...p} class="paste-area" dir="auto" rows={10} placeholder={t('paste.example')} value={text} onInput={(e) => { setText((e.target as HTMLTextAreaElement).value); setError(''); }} />}</Field>
          {error && <Note kind="error">{error}</Note>}
        </div>
      ) : (
        <div class="stack">
          <p class="strong" data-paste-summary>{t('paste.summary', { n: total, c: good.length })}</p>
          {bad > 0 && <Note kind="warn">{tn('paste.skipped', bad)}</Note>}
          <div class="paste-review">
            {parsed.filter((c) => c.items.length).map((c) => (
              <section key={c.line} class="paste-cat">
                <header>
                  <h3>{c.name}</h3>
                  {existing(c.name) ? <span class="chip">{t('paste.intoCat')}</span> : (
                    <label class="inline-select"><span class="sr">{t('menu.cat.kind')}</span>
                      <select value={c.kind} onChange={(e) => setKind(c.line, (e.target as HTMLSelectElement).value)}>{KINDS.map((k) => <option key={k} value={k}>{t('kindc.' + k)}</option>)}</select></label>
                  )}
                </header>
                <ul>
                  {c.items.map((i) => (
                    <li key={i.line} class={i.problem ? 'is-bad' : ''}>
                      <span class="paste-name">{i.name || '—'}{i.description && <span class="muted"> · {i.description}</span>}</span>
                      {i.problem ? <span class="badge badge-warn">{t('paste.line', { n: i.line })}: {t('paste.p.' + i.problem)}</span> : i.price != null ? <Ltr class="price">{formatPrice(i.price, d.biz.currency)}</Ltr> : <span class="muted">{t('menu.item.noPrice')}</span>}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          {error && <Note kind="error">{error}</Note>}
        </div>
      )}
    </Sheet>
  );
}
export const _keep = [Dialog, textOf];
