// What the guest will see and pay for this dish, live, from the draft: the groups in order, the nested group under the
// choice that opens it, the owner's defaults pre-selected, and the price computed by @mana/contracts' priceDish, the
// same function the guest's phone and the server use. A compact stand-in for the guest's own sheet (another lane).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { defaultSelection, fromPrice, priceDish, type AddonOptionV2, type DishSelection, type PriceError } from '@mana/contracts';
import { Btn, Ltr } from '../../ui.tsx';
import { choose, chosenOption, clearGroup, maxOf, minOf, pricingOf, setQty, unitsIn, type GroupPath, type GuestModel } from '../data/guest.ts';
import { ruleLine, shekels } from '../format.ts';
import { t } from '../i18n.ts';
import { Price, Stepper } from '../ui.tsx';

export function GuestPreview({ model, L }: { model: GuestModel; L: 'he' | 'en' }) {
  const ctx = useMemo(() => pricingOf(model), [model]);
  const shape = JSON.stringify([model.dish, [...model.groups.values()]]);
  const start = () => defaultSelection(model.dish, ctx);
  const [sel, setSel] = useState<DishSelection>(start);
  useEffect(() => { setSel(start()); }, [shape]);
  const result = priceDish(model.dish, sel, ctx);
  const name = (x: { name: { he: string; en: string } }) => x.name[L] || x.name[L === 'he' ? 'en' : 'he'];
  return (
    <section class="gp" aria-labelledby="gp-title" data-guest-preview>
      <header class="gp-head"><h3 id="gp-title">{t('gp.title')}</h3><p class="fine">{t('gp.sub')}</p></header>
      <div class="gp-card" lang={L} dir={L === 'he' ? 'rtl' : 'ltr'}>
        <p class="gp-dish"><span class="gp-name">{name(model.dish)}</span><span class="gp-from" data-from><Price p={fromPrice(model.dish, { groups: model.groups })} /></span></p>
        {model.dish.addons.map((a) => <GroupBlock key={a.groupId} model={model} path={{ groupId: a.groupId, parentOptionId: null }} sel={sel} onSel={setSel} name={name} />)}
        <p class="gp-total" aria-live="polite" data-total={result.ok ? result.total : ''}>
          {result.ok ? <><span>{t('gp.total')}</span><Ltr class="price">{shekels(result.total)}</Ltr></> : <span class="gp-err">{problem(result.error, model, name)}</span>}
        </p>
        <p class="fine">{t('gp.vat')}</p>
      </div>
      <Btn small kind="ghost" icon="refresh" onClick={() => setSel(start())} data-action="preview-reset">{t('gp.reset')}</Btn>
    </section>
  );
}

function GroupBlock({ model, path, sel, onSel, name }: { model: GuestModel; path: GroupPath; sel: DishSelection; onSel: (s: DishSelection) => void; name: (x: { name: { he: string; en: string } }) => string }) {
  const g = model.groups.get(path.groupId);
  if (!g) return null;
  const min = minOf(model, path), max = maxOf(model, path), units = unitsIn(sel, path);
  const one = max === 1;
  const radioName = 'gp-' + (path.parentOptionId ?? 'top') + '-' + g.id;
  const label = (o: AddonOptionV2) => <>{name(o)}{o.price > 0 && <> <Ltr>+{shekels(o.price)}</Ltr></>}</>;
  return (
    <fieldset class={'gp-group' + (path.parentOptionId ? ' is-nested' : '')} data-preview-group={g.id}>
      <legend><span class="gp-gname">{name(g)}</span><span class="fine">{ruleLine(min, max)}</span></legend>
      <ul class="gp-options">
        {one && min === 0 && (
          <li><label class="gp-opt"><input type="radio" name={radioName} checked={units === 0} onChange={() => onSel(clearGroup(sel, path))} /><span>{t('gp.none')}</span></label></li>
        )}
        {g.options.map((o) => {
          const c = chosenOption(sel, path, o.id);
          const blocked = !c && !one && units >= max;
          const nested = c && o.opensGroupId && path.parentOptionId === null ? o.opensGroupId : null;
          return (
            <li key={o.id} data-preview-option={o.id}>
              <label class={'gp-opt' + (blocked ? ' is-off' : '')}>
                {one
                  ? <input type="radio" name={radioName} checked={!!c} onChange={() => onSel(choose(sel, model, path, o.id, true))} />
                  : <input type="checkbox" checked={!!c} disabled={blocked} onChange={(e) => onSel(choose(sel, model, path, o.id, (e.target as HTMLInputElement).checked))} />}
                <span>{label(o)}</span>
              </label>
              {c && o.maxQty > 1 && <Stepper value={c.qty ?? 1} min={1} max={Math.min(o.maxQty, max - units + (c.qty ?? 1))} label={t('gp.qty', { name: name(o) })} onChange={(n) => onSel(setQty(sel, path, o.id, n))} />}
              {nested && <GroupBlock model={model} path={{ groupId: nested, parentOptionId: o.id }} sel={sel} onSel={onSel} name={name} />}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** The first reason the guest cannot add the dish yet, in their words. */
function problem(e: PriceError, m: GuestModel, name: (x: { name: { he: string; en: string } }) => string): string {
  const g = 'groupId' in e ? m.groups.get(e.groupId) : undefined;
  const gname = g ? name(g) : '';
  switch (e.code) {
    case 'below_min': return t('gp.e.below_min', { group: gname, n: e.min });
    case 'above_max': return t('gp.e.above_max', { group: gname, n: e.max });
    case 'no_price': return t('gp.e.no_price');
    case 'dish_unavailable': return t('gp.e.unavailable');
    default: return t('gp.e.other');
  }
}
