// The add-on group library (D37): a group is made once and attached to many dishes. A group has single or multiple
// choice, a minimum and a maximum (required when the minimum is one or more), defaults, a price per choice (0 allowed) and
// a most-per-dish, an order, Hebrew and English, and one nesting level: a choice may open one group of its own. The
// editor never offers a second level; should the database refuse one anyway (another device changed the library), its
// answer is said in plain words and the library is shown as it now is.
import { useState } from 'preact/hooks';
import { LIMITS, type AddonGroupRow } from '@mana/contracts';
import { Btn, Confirm, Empty, Field, Icon, IconBtn, Note, PageHead, Seg, Sticky, Switch, go } from '../../ui.tsx';
import { toast } from '../../lib/store.ts';
import { toV2Error, type V2Error } from '../data/errors.ts';
import { capacityOf, groupToForm, newGroupForm, newOptionForm, withSelection, type FieldError, type GroupForm, type OptionForm } from '../data/forms.ts';
import { canHoldOpeners, openTargets } from '../data/nesting.ts';
import { byCreated, named } from '../data/rows.ts';
import { canEdit, menu, removeRows, saveGroupForm } from '../data/store.ts';
import { langsOf, ruleLine } from '../format.ts';
import { errText, lang, t, tn } from '../i18n.ts';
import { Icon2, LangSeg, MoneyInput, Stepper, useEntryLang } from '../ui.tsx';

export function AddonsScreen({ rest }: { rest: string[] }) {
  if (rest[0]) return <GroupEditor key={rest[0]} id={rest[0] === 'new' ? null : rest[0]} />;
  return <Library />;
}

/** Where a group is used and how it nests, in one line each. */
function useOf(g: AddonGroupRow) {
  const d = menu.value!, L = lang.value;
  const dishes = d.dishGroups.filter((a) => a.group_id === g.id).map((a) => d.dishes.find((x) => x.id === a.dish_id)).filter(Boolean);
  const opens = [...new Set(d.options.filter((o) => o.group_id === g.id && o.opens_group_id).map((o) => named(d.groups.find((x) => x.id === o.opens_group_id), L)))];
  const openedBy = d.options.filter((o) => o.opens_group_id === g.id).map((o) => named(o, L) + ' (' + named(d.groups.find((x) => x.id === o.group_id), L) + ')');
  return { dishes, opens, openedBy };
}

function Library() {
  const d = menu.value!, L = lang.value;
  const groups = byCreated(d.groups);
  return (
    <div class="page" data-screen="addons">
      <PageHead title={t('lib.title')} lead={t('lib.lead')}>
        {canEdit() && groups.length > 0 && <Btn kind="primary" icon="plus" onClick={() => go('addons/new')} data-action="new-group">{t('lib.new')}</Btn>}
      </PageHead>
      {groups.length === 0 && <Empty title={t('lib.empty.title')} body={t('lib.empty.body')} icon="list">
        {canEdit() && <Btn kind="primary" icon="plus" onClick={() => go('addons/new')} data-action="new-group">{t('lib.new')}</Btn>}
      </Empty>}
      {groups.length > 0 && (
        <ul class="rows">
          {groups.map((g) => {
            const u = useOf(g), n = d.options.filter((o) => o.group_id === g.id).length;
            return (
              <li key={g.id} class="row" data-group={g.id}>
                <a class="row-main" href={'#/addons/' + g.id}>
                  <span class="row-text">
                    <span class="row-name">{named(g, L) || t('menu2.unnamed')}{g.label && <span class="muted lib-label"> · {g.label}</span>}</span>
                    <span class="row-sub"><span>{ruleLine(g.min_units, g.max_units)} · {tn('lib.choices', n)}</span></span>
                    <span class="row-sub fine">
                      <span>{u.dishes.length ? tn('lib.usedBy', u.dishes.length) : t('lib.unused')}</span>
                      {u.opens.length > 0 && <span><Icon2 name="nest" size={14} /> {t('lib.opens', { names: u.opens.join(', ') })}</span>}
                      {u.openedBy.length > 0 && <span><Icon2 name="nest" size={14} /> {t('lib.openedBy', { names: u.openedBy.join(', ') })}</span>}
                    </span>
                  </span>
                  <Icon name="chev" size={18} flip />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GroupEditor({ id }: { id: string | null }) {
  const d = menu.value!, UI = lang.value;
  const row = id ? d.groups.find((g) => g.id === id) : null;
  const langs = langsOf(d.venue);
  const [L, setL] = useEntryLang(langs);
  const [form, setForm] = useState<GroupForm>(() => (row ? groupToForm(row, d.options) : newGroupForm()));
  const [errors, setErrors] = useState<readonly FieldError[]>([]), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [del, setDel] = useState(false), [leave, setLeave] = useState(false);
  const editable = canEdit();
  if (id && !row) return <div class="page"><a class="backlink" href="#/addons"><Icon name="chev" size={16} back />{t('lib.title')}</a><p class="muted">{t('lib.notFound')}</p></div>;

  const nested = !canHoldOpeners(id, d.options);
  const targets = openTargets(id, byCreated(d.groups), d.options);
  const u = row ? useOf(row) : { dishes: [], opens: [], openedBy: [] };
  const stored = row ? JSON.stringify(groupToForm(row, d.options)) : JSON.stringify(newGroupForm());
  const dirty = JSON.stringify(form) !== stored;
  const many = form.selection === 'multiple';
  const nameKey = L === 'he' ? 'nameHe' : 'nameEn';
  const errAt = (field: string) => { const e = errors.find((x) => x.field === field || x.field.startsWith(field + '_')); return e ? fieldText(e) : undefined; };
  const set = (f: GroupForm) => { setForm(f); setErrors([]); setError(''); };
  const setOpt = (i: number, patch: Partial<OptionForm>) => set({ ...form, options: form.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const moveOpt = (i: number, to: number) => { const o = [...form.options]; const [x] = o.splice(i, 1); o.splice(to, 0, x!); set({ ...form, options: o }); };
  const cap = capacityOf(form.options);

  async function save() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const g = await saveGroupForm(id, form);
      toast(t('lib.saved'));
      if (!id) go('addons/' + g.id, true); else setForm(groupToForm(g, menu.value!.options));
    } catch (e) {
      const err = toV2Error(e) as V2Error;
      if (err.code === 'form_invalid') { setErrors(err.detail as FieldError[]); return; }
      setError(errText(err.code));
      if (err.code === 'nesting_too_deep') {
        // the library as it is stored now decides: an opener it no longer allows is dropped from the form
        const fresh = menu.value!;
        const allowed = new Set(openTargets(id, byCreated(fresh.groups), fresh.options).map((g) => g.id));
        setForm((f) => ({ ...f, options: f.options.map((o) => (o.opensGroupId && !allowed.has(o.opensGroupId) ? { ...o, opensGroupId: null } : o)) }));
      }
    } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { await removeRows('addon_groups', [row!.id]); setDel(false); go('addons', true); }
    catch (e) { setError(errText(toV2Error(e).code)); setDel(false); }
    finally { setBusy(false); }
  }
  const back = () => (dirty ? setLeave(true) : go('addons'));

  return (
    <div class="page has-sticky" data-screen="group-editor" data-group={id ?? 'new'}>
      <button type="button" class="backlink linkbtn" onClick={back}><Icon name="chev" size={16} back />{t('lib.title')}</button>
      <PageHead title={row ? named(row, UI) || t('menu2.unnamed') : t('lib.new')}><LangSeg value={L} onChange={setL} langs={langs} /></PageHead>
      {nested && <Note title={t('lib.nested.title')}>{t('lib.nested.body', { names: u.openedBy.join(', ') })}</Note>}

      <div class="card">
        <Field label={t('lib.name') + ' · ' + t('app.' + L)} error={errAt('name')}>{(p) => (
          <input {...p} type="text" dir="auto" lang={L} maxLength={60} value={form[nameKey]} disabled={!editable} data-field={'group-name-' + L} onInput={(e) => set({ ...form, [nameKey]: (e.target as HTMLInputElement).value })} />
        )}</Field>
        <Field label={t('lib.label')} hint={t('lib.labelHint')} optional error={errAt('label')}>{(p) => (
          <input {...p} type="text" dir="auto" maxLength={60} value={form.label} disabled={!editable} data-field="group-label" onInput={(e) => set({ ...form, label: (e.target as HTMLInputElement).value })} />
        )}</Field>
      </div>

      <div class="card" role="group" aria-labelledby="how-h">
        <h2 id="how-h">{t('lib.how')}</h2>
        <Seg value={form.selection} label={t('lib.how')} onChange={(v) => set(withSelection(form, v))}
          options={[{ value: 'single', label: t('lib.single') }, { value: 'multiple', label: t('lib.multiple') }]} />
        <div class="switchrow"><span>{t('lib.required')}</span>
          <Switch checked={form.min > 0} disabled={!editable} label={t('lib.required')} onChange={(on) => set({ ...form, min: on ? Math.max(1, form.min) : 0 })} /></div>
        {many && <div class="grid2">
          {form.min > 0 && <div class="field"><span class="flabel">{t('ed.min')}</span><Stepper id="group-min" value={form.min} min={1} max={form.max} label={t('ed.min')} onChange={(n) => set({ ...form, min: n })} /></div>}
          <div class="field"><span class="flabel">{t('ed.max')}</span><Stepper id="group-max" value={form.max} min={Math.max(1, form.min)} max={Math.max(form.min, Math.min(30, Math.max(cap, 1)))} label={t('ed.max')} onChange={(n) => set({ ...form, max: n })} /></div>
        </div>}
        <p class="hint" data-rule>{ruleLine(form.min, form.max)}</p>
        {errAt('limits') && <p class="ferr" role="alert">{errAt('limits')}</p>}
      </div>

      <section class="card" aria-labelledby="opts-h">
        <h2 id="opts-h">{t('lib.options')}</h2>
        {errAt('options') && <p class="ferr" role="alert">{errAt('options')}</p>}
        {errAt('defaults') && <p class="ferr" role="alert">{errAt('defaults')}</p>}
        <ol class="opts">
          {form.options.map((o, i) => (
            <OptionCard key={o.key} o={o} i={i} n={form.options.length} L={L} many={many} nested={nested} targets={targets} editable={editable}
              errAt={(f) => errAt(`options.${i}.${f}`)} onChange={(p) => setOpt(i, p)} onMove={(to) => moveOpt(i, to)}
              onRemove={() => set({ ...form, options: form.options.filter((_, j) => j !== i) })}
              onDefault={(on) => set({ ...form, options: form.options.map((x, j) => (j === i ? { ...x, isDefault: on } : form.max === 1 && on ? { ...x, isDefault: false } : x)) })} />
          ))}
        </ol>
        {editable && form.options.length < LIMITS.optionsPerGroup && <Btn icon="plus" onClick={() => set({ ...form, options: [...form.options, newOptionForm()] })} data-action="add-option">{t('lib.addOption')}</Btn>}
      </section>

      {row && <section class="card" aria-labelledby="used-h">
        <h2 id="used-h">{t('lib.used')}</h2>
        {u.dishes.length === 0 ? <p class="muted">{t('lib.unused')}</p>
          : <ul class="chips">{u.dishes.map((x) => <li key={x!.id}><a class="chip" href={'#/menu/d/' + x!.id + '/addons'}>{named(x!, UI)}</a></li>)}</ul>}
        {editable && <Btn kind="ghost" icon="trash" onClick={() => setDel(true)} data-action="delete-group">{t('lib.delete')}</Btn>}
      </section>}

      {editable && <Sticky note={error ? <span class="ferr" role="alert" data-error>{error}</span> : dirty ? t('save.leave') : undefined}><Btn kind="primary" block busy={busy} disabled={!dirty && !!row} onClick={save} data-action="save-group">{row ? t('lib.save') : t('lib.create')}</Btn></Sticky>}
      <Confirm open={del} title={t('lib.delete')} body={u.dishes.length ? tn('lib.deleteUsed', u.dishes.length, { name: named(row, UI) }) : t('lib.deleteConfirm', { name: named(row, UI) })}
        confirmLabel={t('app.delete')} danger busy={busy} onConfirm={remove} onClose={() => setDel(false)} />
      <Confirm open={leave} title={t('lib.leave.title')} body={t('lib.leave.body')} confirmLabel={t('lib.leave.go')} onConfirm={() => { setLeave(false); go('addons'); }} onClose={() => setLeave(false)} />
    </div>
  );
}

function OptionCard({ o, i, n, L, many, nested, targets, editable, errAt, onChange, onMove, onRemove, onDefault }: {
  o: OptionForm; i: number; n: number; L: 'he' | 'en'; many: boolean; nested: boolean; targets: AddonGroupRow[]; editable: boolean;
  errAt: (f: string) => string | undefined; onChange: (p: Partial<OptionForm>) => void; onMove: (to: number) => void; onRemove: () => void; onDefault: (on: boolean) => void;
}) {
  const UI = lang.value;
  const nameKey = L === 'he' ? 'nameHe' : 'nameEn';
  const label = o[nameKey] || o[L === 'he' ? 'nameEn' : 'nameHe'] || t('lib.optionN', { n: i + 1 });
  // the current target stays listed even if it is no longer allowed, so the owner sees it (and saving says why not)
  const list = o.opensGroupId && !targets.some((g) => g.id === o.opensGroupId) ? [...targets, ...(menu.value!.groups.filter((g) => g.id === o.opensGroupId))] : targets;
  return (
    <li class="optcard" data-option={o.id ?? o.key}>
      <div class="opt-head">
        <span class="opt-n">{i + 1}</span>
        <div class="tools">
          <IconBtn icon="up" label={t('menu.up', { name: label })} disabled={!editable || i === 0} onClick={() => onMove(i - 1)} />
          <IconBtn icon="down" label={t('menu.down', { name: label })} disabled={!editable || i === n - 1} onClick={() => onMove(i + 1)} />
          <IconBtn icon="trash" label={t('lib.removeOption', { name: label })} disabled={!editable || n === 1} onClick={onRemove} />
        </div>
      </div>
      <div class="opt-grid">
        <Field label={t('item.name') + ' · ' + t('app.' + L)} error={errAt('name')}>{(p) => (
          <input {...p} type="text" dir="auto" lang={L} maxLength={60} value={o[nameKey]} disabled={!editable} data-field={`option-name-${i}-${L}`} onInput={(e) => onChange({ [nameKey]: (e.target as HTMLInputElement).value })} />
        )}</Field>
        <Field label={t('lib.optionPrice')} hint={t('lib.optionPriceHint')} error={errAt('price')}>{(p) => (
          <MoneyInput id={p.id} describedBy={p['aria-describedby']} invalid={!!p['aria-invalid']} value={o.price} placeholder="0" onInput={(v) => onChange({ price: v })} />
        )}</Field>
      </div>
      {many && !o.opensGroupId && <div class="switchrow"><span>{t('lib.maxQty')}</span>
        <Stepper id={`option-qty-${i}`} value={o.maxQty} min={1} max={LIMITS.optionQuantity} label={t('lib.maxQtyOf', { name: label })} disabled={!editable} onChange={(q) => onChange({ maxQty: q })} /></div>}
      {errAt('maxQty') && <p class="ferr" role="alert">{errAt('maxQty')}</p>}
      <div class="switchrow"><span>{t('lib.default')}</span><Switch checked={o.isDefault} disabled={!editable} label={t('lib.defaultOf', { name: label })} onChange={onDefault} /></div>
      {!nested && list.length > 0 && (
        <Field label={t('lib.opensField')} hint={t('lib.opensHint')} error={errAt('opens')}>{(p) => (
          <select {...p} value={o.opensGroupId ?? ''} disabled={!editable} data-field={`option-opens-${i}`} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; onChange(v ? { opensGroupId: v, maxQty: 1 } : { opensGroupId: null }); }}>
            <option value="">{t('lib.opensNothing')}</option>
            {list.map((g) => <option key={g.id} value={g.id}>{named(g, UI) || t('menu2.unnamed')}</option>)}
          </select>
        )}</Field>
      )}
    </li>
  );
}

/** A form problem, said where it is. */
function fieldText(e: FieldError): string {
  if (e.code === 'name_missing') return t('e.name_missing');
  if (e.code === 'price_invalid') return t('menu.item.badPrice');
  return errText(e.code, 'lib.e');
}
