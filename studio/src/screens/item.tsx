// One dish, in a sheet (a side panel on a wide screen): the picture slot, name, price, description, one language at a
// time. Everything else is behind "More". Every field saves by itself. The slot opens the same picture sheet as the grid.
import { useEffect, useRef, useState } from 'preact/hooks';
import { t, errText, lang } from '../lib/i18n.ts';
import { D, edit, sortRows, deleteItem, flushAll, toast, saveState, saveProblem, retryFailed, type Item } from '../lib/store.ts';
import { toAppError } from '../lib/api.ts';
import { parsePrice, formatMinor } from '../lib/money.ts';
import { originalOf, currentAsset } from '../lib/pictures.ts';
import { aiOn, askAi, describeDish } from '../lib/ai.ts';
import { loadStock, stockLabels } from '../lib/stock.ts';
import { Btn, Field, Note, Confirm, Sheet, Seg, Switch, Icon, SaveFailed } from '../ui.tsx';
import { DishPic, PicSheet, picState, picLine, nameOf } from '../pic.tsx';
import { langsOf } from './menu.tsx';

const TAGS = ['vegan', 'vegetarian', 'spicy', 'gf'];
const WINE = ['producer', 'name', 'vintage', 'region', 'grape', 'serving'];
const WINE_NOTES = ['sweetness', 'acidity', 'body', 'fruit', 'minerality', 'pairings'];
const clean = (o: any): any => { const out: any = {}; for (const k of Object.keys(o || {})) { const v = o[k]; if (v && typeof v === 'object') { const c = clean(v); if (Object.keys(c).length) out[k] = c; } else if (v !== '' && v != null) out[k] = v; } return out; };

function Details({ row, kind }: { row: Item; kind: 'wine' | 'beer' }) {
  const cur = (row.details && row.details[kind]) || {};
  const set = (patch: any) => {
    const next = clean({ ...cur, ...patch, notes: kind === 'wine' ? { ...(cur.notes || {}), ...(patch.notes || {}) } : undefined });
    const details = { ...(row.details || {}) };
    if (Object.keys(next).length) details[kind] = next; else delete details[kind];
    edit('items', row.id, { details });
  };
  const str = (v: any) => (typeof v === 'string' ? v : v && typeof v === 'object' ? v[lang.value] || v.he || v.en || '' : '');
  const text = (key: string, label: string, max = 80) => (
    <Field key={key} label={label}>{(p) => <input {...p} type="text" dir="auto" maxLength={max} value={str(cur[key])} data-detail={kind + '.' + key} onInput={(e) => set({ [key]: (e.target as HTMLInputElement).value })} />}</Field>
  );
  const select = (key: string, label: string, options: string[], ns: string) => (
    <Field key={key} label={label}>{(p) => <select {...p} value={cur[key] || ''} data-detail={kind + '.' + key} onChange={(e) => set({ [key]: (e.target as HTMLSelectElement).value })}><option value="">{t(ns + '.none')}</option>{options.map((o) => <option key={o} value={o}>{t(ns + '.' + o)}</option>)}</select>}</Field>
  );
  return (
    <section class="more-block" aria-labelledby={'det-' + kind}>
      <h3 id={'det-' + kind}>{t('item.' + kind)}</h3>
      {kind === 'wine' ? (
        <>
          <div class="grid2">{WINE.map((k) => text(k, t('wine.' + k)))}{select('color', t('wine.color'), ['red', 'white', 'rose', 'sparkling', 'orange'], 'wine.color')}</div>
          <details class="more"><summary>{t('wine.notes')}</summary>
            <div class="grid2">{WINE_NOTES.map((k) => (
              <Field key={k} label={t('wine.notes.' + k)}>{(p) => <input {...p} type="text" dir="auto" maxLength={120} value={str((cur.notes || {})[k])} data-detail={'wine.notes.' + k} onInput={(e) => set({ notes: { [k]: (e.target as HTMLInputElement).value } })} />}</Field>
            ))}</div>
          </details>
        </>
      ) : (
        <div class="grid2">{text('brewery', t('beer.brewery'))}{text('style', t('beer.style'))}{text('abv', t('beer.abv'), 12)}{select('serving', t('beer.serving'), ['bottle', 'can', 'tap'], 'beer.serving')}{select('color', t('beer.color'), ['pale', 'amber', 'dark'], 'beer.color')}</div>
      )}
    </section>
  );
}

export function ItemSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const d = D.value!;
  const row = d.items.find((i) => i.id === id);
  const langs = langsOf();
  const [L, setL] = useState<'he' | 'en'>(() => (langs.includes(lang.value) ? lang.value : langs[0]));
  const [price, setPrice] = useState(() => (row ? formatMinor(row.price_minor) : ''));
  const [priceErr, setPriceErr] = useState(false), [confirmDel, setConfirmDel] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [pic, setPic] = useState(false), [more, setMore] = useState(false);
  const [sugg, setSugg] = useState<Record<string, true>>({});              // fields whose text is a suggestion the owner has not touched yet
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { askAi(); }, []);
  useEffect(() => { setPrice(row ? formatMinor(row.price_minor) : ''); setSugg({}); setError(''); }, [id]);
  if (!row) return <Sheet open onClose={onClose} title={t('item.title')} side name="dish"><p class="muted">{t('item.notFound')}</p><Btn onClick={onClose}>{t('item.back')}</Btn></Sheet>;
  if (pic) return <PicSheet item={row} onClose={() => setPic(false)} />;
  const cat = d.categories.find((c) => c.id === row.category_id);
  const asset = currentAsset(row.id);
  const iname = nameOf(row);

  const onPrice = (v: string) => {
    setPrice(v);
    const p = parsePrice(v);
    if (p === 'invalid') return setPriceErr(true);
    setPriceErr(false);
    edit('items', row.id, { price_minor: p });
  };
  const setText = (field: string, v: string) => { edit('items', row.id, { [field]: v }); if (sugg[field]) { const s = { ...sugg }; delete s[field]; setSugg(s); } };
  const dropSuggestion = (field: string) => { edit('items', row.id, { [field]: '' }, { now: true }); const s = { ...sugg }; delete s[field]; setSugg(s); };
  const toggleTag = (tag: string) => edit('items', row.id, { tags: row.tags.includes(tag) ? row.tags.filter((x: string) => x !== tag) : TAGS.filter((x) => x === tag || row.tags.includes(x)) }, { now: true });

  async function suggest() {
    if (!asset || busy) return;
    setBusy('suggest'); setError('');
    try {
      await loadStock().catch(() => {});
      const photo = await originalOf(asset);
      const known = row.name_he.trim() || row.name_en.trim();
      const s = await describeDish(photo, { businessId: d.biz.id, name: known || undefined, langs, stock: stockLabels() });
      const cur = D.value!.items.find((i) => i.id === row.id) || row;
      const patch: any = {}, marks: Record<string, true> = {};
      // only EMPTY fields are filled; what the owner typed is never replaced; tags and allergens are never touched
      for (const l of langs) {
        if (!String(cur['name_' + l] || '').trim() && s.name[l]) { patch['name_' + l] = s.name[l].slice(0, 90); marks['name_' + l] = true; }
        if (!String(cur['desc_' + l] || '').trim() && s.desc[l]) { patch['desc_' + l] = s.desc[l].slice(0, 600); marks['desc_' + l] = true; }
      }
      if (!Object.keys(patch).length) { toast(t('item.suggest.nothing')); return; }
      edit('items', row.id, patch, { now: true });
      setSugg({ ...sugg, ...marks });
    } catch (e) { setError(errText(toAppError(e).code, 'ai.e')); }
    finally { setBusy(''); }
  }
  async function del() {
    setBusy('delete');
    try { await flushAll(); await deleteItem(row.id); onClose(); }
    catch (err) { setError(errText(toAppError(err).code)); setConfirmDel(false); }
    finally { setBusy(''); }
  }
  const mark = (field: string) => sugg[field] && (
    <span class="sugg" data-suggested={field}><Icon name="sparkle" size={14} /><span>{t('item.suggest.mark')}</span>
      <button type="button" class="sugg-x" aria-label={t('item.suggest.drop')} title={t('item.suggest.drop')} onClick={() => dropSuggestion(field)}><Icon name="x" size={14} /></button></span>
  );
  const other = L === 'he' ? 'en' : 'he';
  const otherSuggested = langs.length > 1 && Object.keys(sugg).some((f) => f.endsWith('_' + other));
  const canSuggest = aiOn.value === 'on' && !!asset && (!!asset.original_path || asset.status !== 'rejected');

  return (
    <>
      <Sheet open={!confirmDel} onClose={onClose} title={iname || t('item.title')} side tall name="dish"
        head={langs.length > 1 ? <Seg small value={L} label={t('item.lang')} onChange={(v) => setL(v as 'he' | 'en')} options={langs.map((l) => ({ value: l, label: t(l === 'he' ? 'app.he.short' : 'app.en.short') }))} /> : undefined}
        foot={<Btn kind="primary" block onClick={onClose} data-action="done">{t('app.done')}</Btn>}>
        <div class="dish" data-dish={row.id} data-lang={L}>
          {saveState.value === 'failed' && <SaveFailed problem={saveProblem.value} onRetry={() => retryFailed()} />}
          <button type="button" class="dish-slot" data-action="picture" data-status={picState(row).state} aria-label={t('pic.for', { name: iname })} onClick={() => setPic(true)}>
            <DishPic item={row} size="slot" />
            <span class="dish-slot-text"><span class="strong">{t('item.picture')}</span><span class="dish-slot-line" dir="auto">{picLine(row)}</span></span>
            <Icon name="chev" size={18} flip />
          </button>
          {canSuggest && <Btn icon="wand" busy={busy === 'suggest'} onClick={suggest} data-action="suggest">{t('item.suggest')}</Btn>}
          {otherSuggested && <p class="hint" data-suggested-other>{t('item.suggest.other', { lang: t(other === 'he' ? 'app.he' : 'app.en') })}</p>}
          <div class="dish-top">
            <Field label={t('item.name')} class={sugg['name_' + L] ? 'is-sugg' : ''}>{(p) => <><input {...p} ref={nameRef} type="text" dir={L === 'he' ? 'rtl' : 'ltr'} lang={L} maxLength={90} value={row['name_' + L] || ''} data-field={'name_' + L} onInput={(e) => setText('name_' + L, (e.target as HTMLInputElement).value)} />{mark('name_' + L)}</>}</Field>
            <Field label={t('item.price')} error={priceErr ? t('menu.item.badPrice') : undefined}>{(p) => <span class="money"><input {...p} type="text" inputMode="decimal" dir="ltr" maxLength={12} value={price} data-field="price" onInput={(e) => onPrice((e.target as HTMLInputElement).value)} /><span class="cur" aria-hidden="true">₪</span></span>}</Field>
          </div>
          <Field label={t('item.desc')} class={sugg['desc_' + L] ? 'is-sugg' : ''}>{(p) => <><textarea {...p} rows={2} dir={L === 'he' ? 'rtl' : 'ltr'} lang={L} maxLength={600} value={row['desc_' + L] || ''} data-field={'desc_' + L} onInput={(e) => setText('desc_' + L, (e.target as HTMLTextAreaElement).value)} />{mark('desc_' + L)}</>}</Field>
          {error && <Note kind="error">{error}</Note>}

          <button type="button" class="morebtn" aria-expanded={more ? 'true' : 'false'} aria-controls="dish-more" onClick={() => setMore(!more)} data-action="more"><span>{t('item.more')}</span><Icon name="chevdown" size={18} /></button>
          <div id="dish-more" class="dish-more" hidden={!more}>
            <div class="switchrow">
              <p class="strong">{t('item.soldOut')}</p>
              <Switch checked={!row.available} label={t('item.soldOut')} onChange={(v) => edit('items', row.id, { available: !v }, { now: true })} />
            </div>
            <fieldset class="tags"><legend>{t('item.tags')}</legend>
              {TAGS.map((tag) => <label key={tag} class={'tagchip' + (row.tags.includes(tag) ? ' on' : '')}><input type="checkbox" checked={row.tags.includes(tag)} onChange={() => toggleTag(tag)} /><Icon name={tag} size={18} /><span>{t('tag.' + tag)}</span></label>)}
            </fieldset>
            <Field label={t('item.priceNote')}>{(p) => <input {...p} type="text" dir={L === 'he' ? 'rtl' : 'ltr'} lang={L} maxLength={80} placeholder={t('item.priceNoteEg')} value={row['price_note_' + L] || ''} data-field={'price_note_' + L} onInput={(e) => setText('price_note_' + L, (e.target as HTMLInputElement).value)} />}</Field>
            <Field label={t('item.allergens')} hint={t('item.allergensHint')}>{(p) => <input {...p} type="text" dir={L === 'he' ? 'rtl' : 'ltr'} lang={L} maxLength={300} value={row['allergens_' + L] || ''} data-field={'allergens_' + L} onInput={(e) => setText('allergens_' + L, (e.target as HTMLInputElement).value)} />}</Field>
            {d.categories.length > 1 && <Field label={t('item.category')}>{(p) => <select {...p} value={row.category_id} data-field="category" onChange={(e) => edit('items', row.id, { category_id: (e.target as HTMLSelectElement).value, position: 9999 }, { now: true })}>{sortRows(d.categories).map((c) => <option key={c.id} value={c.id}>{nameOf(c)}</option>)}</select>}</Field>}
            {cat && (cat.kind === 'wine' || cat.kind === 'beer') && <Details row={row} kind={cat.kind} />}
            <Btn kind="ghost" icon="trash" onClick={() => setConfirmDel(true)} data-action="delete">{t('item.delete')}</Btn>
          </div>
        </div>
      </Sheet>
      <Confirm open={confirmDel} danger busy={busy === 'delete'} title={t('item.delete')} body={t('item.deleteConfirm', { name: iname })} confirmLabel={t('app.delete')} onConfirm={del} onClose={() => setConfirmDel(false)} />
    </>
  );
}
