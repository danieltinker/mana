// One dish, in a sheet (a side panel on a wide screen), in three tabs: its details (saved as they are typed), its
// add-on groups (attached from the library, in order, with limits that can only tighten the group's, and a live
// preview of what the guest will see and pay), and what goes well with it.
import { useEffect, useState } from 'preact/hooks';
import { LIMITS, TAGS, type DishAddonGroupRow, type DishRow } from '@mana/contracts';
import { Btn, Confirm, Field, Icon, IconBtn, Note, Sheet, Switch, go } from '../../ui.tsx';
import { toast } from '../../lib/store.ts';
import { toV2Error } from '../data/errors.ts';
import { capacityOf, dishEdit, dishLimitsFromForm, dishToForm, effectiveLimits, groupToForm, limitChoices, type DishForm, type FieldError } from '../data/forms.ts';
import { guestModel } from '../data/guest.ts';
import { byCreated, byPosition, named } from '../data/rows.ts';
import { ANY_ROW, addRelated, attachGroup, attachedTo, canEdit, menu, moveDishTo, moveRow, patchRow, relatedOf, removeRows, resync, setDishLimits } from '../data/store.ts';
import { langsOf, ruleLine } from '../format.ts';
import { errText, lang, t } from '../i18n.ts';
import { Icon2, LangSeg, MoneyInput, ReadOnly, ReorderList, TabPanel, Tabs, useEntryLang } from '../ui.tsx';
import { SaveFailedLine } from '../saving.tsx';
import { GuestPreview } from './guest-preview.tsx';

type Tab = 'details' | 'addons' | 'related';
const TABS: Tab[] = ['details', 'addons', 'related'];

export function DishSheet({ id, tab, onClose }: { id: string; tab?: string; onClose: () => void }) {
  const d = menu.value!;
  const row = d.dishes.find((x) => x.id === id);
  const langs = langsOf(d.venue);
  const [L, setL] = useEntryLang(langs);
  const current: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : 'details';
  if (!row) return <Sheet open onClose={onClose} title={t('item.title')} side name="dish"><p class="muted">{t('item.notFound')}</p><Btn onClick={onClose}>{t('item.back')}</Btn></Sheet>;
  const name = named(row, lang.value) || t('menu2.unnamed');
  const groups = attachedTo(row.id).length, related = relatedOf(row.id).length;
  return (
    <Sheet open onClose={onClose} title={name} side tall name="dish" head={current !== 'related' ? <LangSeg value={L} onChange={setL} langs={langs} /> : undefined}>
      <SaveFailedLine />
      {!canEdit() && <Note>{t('menu2.readOnly')}</Note>}
      <Tabs label={t('dish.tabs')} value={current} onChange={(k) => go(`menu/d/${row.id}/${k}`, true)}
        tabs={[{ key: 'details', label: t('dish.tab.details') }, { key: 'addons', label: t('dish.tab.addons'), badge: groups }, { key: 'related', label: t('dish.tab.related'), badge: related }]} />
      <TabPanel id={current}>
        {current === 'details' && <DishDetails key={row.id} row={row} L={L} onDeleted={onClose} />}
        {current === 'addons' && <DishAddons row={row} L={L} />}
        {current === 'related' && <DishRelated row={row} />}
      </TabPanel>
    </Sheet>
  );
}

// ---------------------------------------------------------------- details
function DishDetails({ row, L, onDeleted }: { row: DishRow; L: 'he' | 'en'; onDeleted: () => void }) {
  const d = menu.value!;
  const editable = canEdit();
  const [form, setForm] = useState<DishForm>(() => dishToForm(row));
  const [errors, setErrors] = useState<readonly FieldError[]>([]);
  const [del, setDel] = useState(false), [busy, setBusy] = useState(false);
  const sections = byPosition(d.sections);
  const parts = d.schedules;
  // after a refusal, a change made elsewhere, or the owner's choice between the two: the form shows the dish as it is now
  useEffect(() => { const r = resync.value; if (r && r.table === 'dishes' && (r.id === row.id || r.id === ANY_ROW)) { setForm(dishToForm(row)); setErrors([]); } }, [resync.value]);

  /** Every change is saved shortly after (only what this change touched), except the fields that have a problem (shown under them). */
  const set = (patch: Partial<DishForm>) => {
    const next = { ...form, ...patch };
    const edit = dishEdit(form, next);
    setForm(next);
    setErrors(edit.errors);
    if (Object.keys(edit.patch).length) patchRow('dishes', row.id, edit.patch);
  };
  const errOf = (...fields: string[]) => { const e = errors.find((x) => fields.includes(x.field)); return e ? (e.code === 'name_missing' ? t('menu.item.nameMissing') : e.code === 'price_invalid' ? t('menu.item.badPrice') : errText(e.code)) : undefined; };
  const k = (base: 'name' | 'desc' | 'priceNote' | 'allergens') => (base + (L === 'he' ? 'He' : 'En')) as keyof DishForm;
  const input = (e: Event) => (e.target as HTMLInputElement).value;

  async function remove() {
    setBusy(true);
    try { await removeRows('dishes', [row.id]); setDel(false); onDeleted(); }
    catch (e) { toast(errText(toV2Error(e).code), 'error'); setDel(false); }
    finally { setBusy(false); }
  }

  return (
    <ReadOnly when={!editable} class="dish2" data-dish-details={row.id}>
      <Field label={t('item.name') + ' · ' + t('app.' + L)} error={errOf('name', 'name_' + L)}>{(p) => (
        <input {...p} type="text" dir="auto" lang={L} maxLength={LIMITS.nameLength} value={form[k('name')] as string} disabled={!editable} data-field={'dish-name-' + L} onInput={(e) => set({ [k('name')]: input(e) })} />
      )}</Field>
      <Field label={t('item.desc') + ' · ' + t('app.' + L)} optional>{(p) => (
        <textarea {...p} dir="auto" lang={L} maxLength={LIMITS.descLength} rows={3} value={form[k('desc')] as string} disabled={!editable} data-field={'dish-desc-' + L} onInput={(e) => set({ [k('desc')]: input(e) })} />
      )}</Field>
      <div class="price-row">
        <Field label={t('item.price')} error={errOf('price')}>{(p) => (
          <MoneyInput id={p.id} describedBy={p['aria-describedby']} invalid={!!p['aria-invalid']} value={form.price} onInput={(v) => set({ price: v })} field="dish-price" disabled={!editable} />
        )}</Field>
        <Field label={t('item.priceNote') + ' · ' + t('app.' + L)} optional>{(p) => (
          <input {...p} type="text" dir="auto" lang={L} maxLength={LIMITS.noteLength} placeholder={t('item.priceNoteEg')} value={form[k('priceNote')] as string} disabled={!editable} data-field={'dish-note-' + L} onInput={(e) => set({ [k('priceNote')]: input(e) })} />
        )}</Field>
      </div>
      <p class="fine">{t('gp.vat')}</p>
      <fieldset class="tags">
        <legend>{t('item.tags')}</legend>
        {TAGS.map((tag) => {
          const on = form.tags.includes(tag);
          return <label key={tag} class={'tagchip' + (on ? ' on' : '')}><input type="checkbox" checked={on} disabled={!editable} onChange={() => set({ tags: on ? form.tags.filter((x) => x !== tag) : [...form.tags, tag] })} /><Icon name={tag} size={18} />{t('tag.' + tag)}</label>;
        })}
      </fieldset>
      <Field label={t('item.allergens') + ' · ' + t('app.' + L)} hint={t('item.allergensHint')} optional>{(p) => (
        <input {...p} type="text" dir="auto" lang={L} maxLength={300} value={form[k('allergens')] as string} disabled={!editable} data-field={'dish-allergens-' + L} onInput={(e) => set({ [k('allergens')]: input(e) })} />
      )}</Field>
      <div class="grid2">
        <Field label={t('item.category')}>{(p) => (
          <select {...p} value={form.sectionId} disabled={!editable} data-field="dish-section" onChange={(e) => {
            const to = (e.target as HTMLSelectElement).value;
            setForm({ ...form, sectionId: to });
            moveDishTo(row.id, to);
          }}>{sections.map((s) => <option key={s.id} value={s.id}>{named(s, lang.value) || t('menu2.unnamed')}</option>)}</select>
        )}</Field>
        <Field label={t('dish.daypart')} hint={parts.length ? undefined : t('dish.daypart.none')}>{(p) => (
          <select {...p} value={form.scheduleId ?? ''} disabled={!editable || !parts.length} data-field="dish-daypart" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; set({ scheduleId: v || null }); }}>
            <option value="">{t('dish.daypart.always')}</option>
            {parts.map((s) => <option key={s.id} value={s.id}>{named(s, lang.value)}</option>)}
          </select>
        )}</Field>
      </div>
      <div class="switchrow"><span>{t('ed.hide')}</span><Switch checked={form.hidden} disabled={!editable} onChange={(v) => set({ hidden: v })} label={t('ed.hide')} /></div>
      {editable && <Btn kind="ghost" icon="trash" onClick={() => setDel(true)} data-action="delete-dish">{t('item.delete')}</Btn>}
      <Confirm open={del} title={t('item.delete')} body={t('item.deleteConfirm', { name: named(row, lang.value) })} confirmLabel={t('app.delete')} danger busy={busy} onConfirm={remove} onClose={() => setDel(false)} />
    </ReadOnly>
  );
}

// ---------------------------------------------------------------- add-ons
function DishAddons({ row, L }: { row: DishRow; L: 'he' | 'en' }) {
  const d = menu.value!;
  const editable = canEdit();
  const attached = attachedTo(row.id);
  const [arranging, setArranging] = useState(false), [picking, setPicking] = useState(false), [limitsOf, setLimitsOf] = useState<string | null>(null);
  const groups = new Map(d.groups.map((g) => [g.id, g] as const));
  const free = byCreated(d.groups).filter((g) => !attached.some((a) => a.group_id === g.id));
  const model = guestModel(d, row.id);
  const fail = (e: unknown) => toast(errText(toV2Error(e).code), 'error');
  const full = attached.length >= LIMITS.groupsPerDish;

  return (
    <div class="addons2" data-dish-addons={row.id}>
      {attached.length === 0 && <p class="muted">{t('dish.addons.none')}</p>}
      {attached.length > 0 && <>
        {editable && attached.length > 1 && <div class="row-between"><span /><button type="button" class={'toolbtn' + (arranging ? ' on' : '')} aria-pressed={arranging ? 'true' : 'false'} onClick={() => setArranging(!arranging)}>
          <Icon name={arranging ? 'check' : 'reorder'} size={18} /><span>{arranging ? t('menu.reorderDone') : t('menu.reorder')}</span></button></div>}
        <ReorderList items={attached} arranging={arranging} label={t('dish.tab.addons')} nameOf={(a) => named(groups.get(a.group_id), lang.value)}
          onMove={(from, to) => { moveRow('dish_addon_groups', attached, from, to)?.catch(fail); }}
          render={(a) => <Attached dag={a} open={limitsOf === a.id} onToggle={() => setLimitsOf(limitsOf === a.id ? null : a.id)} editable={editable && !arranging} />} />
      </>}
      {editable && !picking && <Btn icon="plus" disabled={full} onClick={() => setPicking(true)} data-action="attach">{t('dish.addons.attach')}</Btn>}
      {full && <p class="hint">{t('e.limit_groups_per_dish', { n: LIMITS.groupsPerDish })}</p>}
      {picking && (
        <div class="card picklist" data-picker="groups">
          <div class="row-between"><h3>{t('dish.addons.pick')}</h3><IconBtn icon="x" label={t('app.close')} onClick={() => setPicking(false)} /></div>
          {free.length === 0 && <p class="muted">{d.groups.length ? t('dish.addons.allAttached') : t('dish.addons.noLibrary')}</p>}
          <ul class="picks">
            {free.map((g) => (
              <li key={g.id}>
                <span class="pick-text"><span class="strong">{named(g, lang.value)}</span>{g.label && <span class="muted"> · {g.label}</span>}<span class="fine">{ruleLine(g.min_units, g.max_units)}</span></span>
                <Btn small onClick={() => { attachGroup(row.id, g.id).then(() => setPicking(false), fail); }} data-attach={g.id} aria-label={t('dish.addons.attachOne', { name: named(g, lang.value) })}>{t('dish.addons.attachShort')}</Btn>
              </li>
            ))}
          </ul>
          <a class="linkbtn" href="#/addons/new"><Icon name="plus" size={16} /><span>{t('lib.new')}</span></a>
        </div>
      )}
      {model && <GuestPreview model={model} L={L} />}
    </div>
  );
}

function Attached({ dag, open, onToggle, editable }: { dag: DishAddonGroupRow; open: boolean; onToggle: () => void; editable: boolean }) {
  const d = menu.value!;
  const g = d.groups.find((x) => x.id === dag.group_id)!;
  const eff = effectiveLimits(g, dag);
  const tighter = eff.min !== g.min_units || eff.max !== g.max_units;
  const name = named(g, lang.value);
  const opens = d.options.filter((o) => o.group_id === g.id && o.opens_group_id).map((o) => named(d.groups.find((x) => x.id === o.opens_group_id), lang.value));
  return (
    <div class="attached">
      <div class="attached-main">
        <span class="row-text">
          <a class="row-name" href={'#/addons/' + g.id}>{name}</a>
          <span class="row-sub"><span data-rule>{ruleLine(eff.min, eff.max)}</span>{tighter && <span class="badge badge-todo" data-tighter>{t('dish.limits.here')}</span>}</span>
          {opens.length > 0 && <span class="fine"><Icon2 name="nest" size={14} /> {t('lib.opens', { names: [...new Set(opens)].join(', ') })}</span>}
        </span>
        {editable && <div class="tools">
          <IconBtn icon="edit" label={t('dish.limits.edit', { name })} aria-expanded={open ? 'true' : 'false'} onClick={onToggle} />
          <IconBtn icon="trash" label={t('dish.addons.remove', { name })} onClick={() => { removeRows('dish_addon_groups', [dag.id]).catch((e) => toast(errText(toV2Error(e).code), 'error')); }} />
        </div>}
      </div>
      {open && <LimitsEditor dag={dag} onDone={onToggle} />}
    </div>
  );
}

/** A dish's limits for one group: only values tighter than the group's own are offered (the database refuses looser). */
function LimitsEditor({ dag, onDone }: { dag: DishAddonGroupRow; onDone: () => void }) {
  const d = menu.value!;
  const g = d.groups.find((x) => x.id === dag.group_id)!;
  const cap = capacityOf(groupToForm(g, d.options).options);
  const eff = effectiveLimits(g, dag);
  const [min, setMin] = useState(eff.min), [max, setMax] = useState(eff.max), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const choices = limitChoices(g, cap, min);
  useEffect(() => { if (max < Math.max(min, 1)) setMax(Math.max(min, 1)); }, [min]);
  async function save() {
    const m = dishLimitsFromForm(g, cap, min, max);
    if (!m.ok) { setError(errText(m.errors[0]!.code)); return; }
    setBusy(true);
    try { await setDishLimits(dag.id, m.value); onDone(); }
    catch (e) {
      const err = toV2Error(e);
      setError(errText(err.code));
      // changed elsewhere meanwhile: the limits as stored now are what the editor shows
      const now = err.code === 'stale' ? menu.value!.dishGroups.find((x) => x.id === dag.id) : null;
      if (now) { const ef = effectiveLimits(g, now); setMin(ef.min); setMax(ef.max); }
    }
    finally { setBusy(false); }
  }
  return (
    <div class="limits" data-limits={dag.id}>
      <p class="hint">{t('dish.limits.hint', { rule: ruleLine(g.min_units, g.max_units) })}</p>
      <div class="grid2">
        <Field label={t('ed.min')}>{(p) => <select {...p} value={String(min)} data-field="dish-min" onChange={(e) => setMin(Number((e.target as HTMLSelectElement).value))}>{choices.mins.map((n) => <option key={n} value={n}>{n}</option>)}</select>}</Field>
        <Field label={t('ed.max')}>{(p) => <select {...p} value={String(max)} data-field="dish-max" onChange={(e) => setMax(Number((e.target as HTMLSelectElement).value))}>{choices.maxes.map((n) => <option key={n} value={n}>{n}</option>)}</select>}</Field>
      </div>
      {error && <Note kind="error">{error}</Note>}
      <div class="btnrow"><Btn small kind="primary" busy={busy} onClick={save} data-action="save-limits">{t('app.save')}</Btn><Btn small kind="ghost" onClick={onDone}>{t('app.cancel')}</Btn></div>
    </div>
  );
}

// ---------------------------------------------------------------- goes well with
function DishRelated({ row }: { row: DishRow }) {
  const d = menu.value!;
  const editable = canEdit();
  const related = relatedOf(row.id);
  const [arranging, setArranging] = useState(false), [pick, setPick] = useState('');
  const dishes = new Map(d.dishes.map((x) => [x.id, x] as const));
  const sections = byPosition(d.sections);
  const others = sections.flatMap((s) => byPosition(d.dishes.filter((x) => x.section_id === s.id))).filter((x) => x.id !== row.id && !related.some((r) => r.related_dish_id === x.id));
  const full = related.length >= LIMITS.related;
  const fail = (e: unknown) => toast(errText(toV2Error(e).code), 'error');
  return (
    <div class="related2" data-dish-related={row.id}>
      <p class="hint">{t('dish.related.hint')}</p>
      {related.length === 0 && <p class="muted">{t('dish.related.none')}</p>}
      {related.length > 1 && editable && <div class="row-between"><span /><button type="button" class={'toolbtn' + (arranging ? ' on' : '')} aria-pressed={arranging ? 'true' : 'false'} onClick={() => setArranging(!arranging)}>
        <Icon name={arranging ? 'check' : 'reorder'} size={18} /><span>{arranging ? t('menu.reorderDone') : t('menu.reorder')}</span></button></div>}
      {related.length > 0 && <ReorderList items={related} arranging={arranging} label={t('dish.tab.related')} nameOf={(r) => named(dishes.get(r.related_dish_id), lang.value)}
        onMove={(from, to) => { moveRow('dish_relations', related, from, to)?.catch(fail); }}
        render={(r) => {
          const name = named(dishes.get(r.related_dish_id), lang.value);
          return <div class="attached-main"><span class="row-text"><span class="row-name">{name}</span></span>
            {editable && !arranging && <div class="tools"><IconBtn icon="trash" label={t('dish.related.remove', { name })} onClick={() => { removeRows('dish_relations', [r.id]).catch(fail); }} /></div>}</div>;
        }} />}
      {editable && (full ? <p class="hint">{t('e.limit_related', { n: LIMITS.related })}</p> : others.length > 0 && (
        <div class="related-add">
          <Field label={t('dish.related.add')}>{(p) => (
            <select {...p} key={related.length} value={pick} data-field="related-pick" onChange={(e) => setPick((e.target as HTMLSelectElement).value)}>
              <option value="">{t('dish.related.choose')}</option>
              {others.map((x) => <option key={x.id} value={x.id}>{named(x, lang.value) || t('menu2.unnamed')}</option>)}
            </select>
          )}</Field>
          <Btn icon="plus" disabled={!pick} onClick={() => { addRelated(row.id, pick).then(() => setPick(''), fail); }} data-action="add-related">{t('menu.quick.add')}</Btn>
        </div>
      ))}
    </div>
  );
}
