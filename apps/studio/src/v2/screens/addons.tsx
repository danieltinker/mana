// The add-on group library (D37): a group is made once and attached to many dishes. A group has single or multiple
// choice, a minimum and a maximum (required when the minimum is one or more), defaults, a price per choice (0 allowed) and
// a most-per-dish, an order, Hebrew and English, and one nesting level: a choice may open one group of its own. The
// editor never offers a second level; should the database refuse one anyway (another device changed the library), its
// answer is said in plain words and the library is shown as it now is.
import { useRef, useState } from 'preact/hooks';
import { LIMITS, type AddonGroupRow } from '@mana/contracts';
import { Btn, Confirm, Empty, Field, Icon, IconBtn, Ltr, Note, PageHead, Seg, Sticky, Switch, go } from '../../ui.tsx';
import { toast } from '../../lib/store.ts';
import { toV2Error } from '../data/errors.ts';
import { capacityOf, groupToForm, mergeGroupForms, newGroupForm, newOptionForm, withSelection, type FieldError, type GroupForm, type OptionForm } from '../data/forms.ts';
import { leave as leaveScreen, useLeaveGuard } from '../leave.ts';
import type { GroupRows } from '../data/menu.ts';
import { canHoldOpeners, openTargets } from '../data/nesting.ts';
import { byCreated, byPosition, named, newId } from '../data/rows.ts';
import { canEdit, menu, removeRows, saveGroupForm } from '../data/store.ts';
import { langsOf, ruleLine, shekels } from '../format.ts';
import { errText, lang, t, tn } from '../i18n.ts';
import { Icon2, LangSeg, MoneyInput, ReadOnly, Stepper, useEditOnly, useEntryLang } from '../ui.tsx';
import { ruleSummary } from '../words.ts';

/** A suggestion rule as the rules list says it: its label, its line, or the rule in words. */
function ruleName(r: { id: string; name: string }): string {
  const d = menu.value, L = lang.value;
  const row = d?.rules.find((x) => x.id === r.id);
  if (r.name || !row || !d) return r.name || t('lib.rules.unnamed');
  return ruleSummary(row, (kind, id) => named(kind === 'dish' ? d.dishes.find((x) => x.id === id) : kind === 'section' ? d.sections.find((x) => x.id === id) : d.options.find((x) => x.id === id), L));
}

export function AddonsScreen({ rest }: { rest: string[] }) {
  const editable = canEdit();
  // a new group is only for an account that edits: any other is taken back to the library (also when it came by address)
  useEditOnly(rest[0] === 'new', editable, 'addons');
  if (rest[0] && !(rest[0] === 'new' && !editable)) return <GroupEditor key={rest[0]} id={rest[0] === 'new' ? null : rest[0]} />;
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
                    <span class="row-sub"><span>{ruleLine(g.min_units, g.max_units)} · {tn('lib.choices', n)}</span>{g.limits_confirmed === false && <span class="badge badge-warn" data-unconfirmed>{t('lib.confirm.badge')}</span>}</span>
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

/** A form's content, for "is anything changed" (the list keys of options not stored yet do not count). */
const shape = (f: GroupForm) => JSON.stringify({ ...f, options: f.options.map(({ key: _key, ...o }) => o) });

function GroupEditor({ id }: { id: string | null }) {
  const d = menu.value!, UI = lang.value;
  const row = id ? d.groups.find((g) => g.id === id) : null;
  const langs = langsOf(d.venue);
  const [L, setL] = useEntryLang(langs);
  const [form, setForm] = useState<GroupForm>(() => (row ? groupToForm(row, d.options) : newGroupForm()));
  // the group as this form read it: its version (sent with every save) and its content (what "changed" compares with)
  const [expected, setExpected] = useState<string | null>(row?.updated_at ?? null);
  const [base, setBase] = useState(() => shape(form));
  const [opened, setOpened] = useState<GroupForm>(() => form);
  // a new group's id is made here and kept, so saving again after a lost answer never makes a second group
  const [gid] = useState(() => id ?? newId());
  const [errors, setErrors] = useState<readonly FieldError[]>([]), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [del, setDel] = useState(false), [leave, setLeave] = useState(false);
  const [stale, setStale] = useState<GroupRows | null>(null), [rules, setRules] = useState<{ id: string; name: string }[] | null>(null);
  const leaveTo = useRef<(() => void) | null>(null);
  const editable = canEdit();
  const dirty = shape(form) !== base;
  // a group form with changes is not left without asking (the back link, the bottom bar, another place)
  useLeaveGuard(editable && dirty, (proceed) => { leaveTo.current = proceed; setLeave(true); });
  if (id && !row) return <div class="page"><a class="backlink" href="#/addons"><Icon name="chev" size={16} back />{t('lib.title')}</a><p class="muted">{t('lib.notFound')}</p></div>;

  const nested = !canHoldOpeners(id, d.options);
  const targets = openTargets(id, byCreated(d.groups), d.options);
  const u = row ? useOf(row) : { dishes: [], opens: [], openedBy: [] };
  const many = form.selection === 'multiple';
  const nameKey = L === 'he' ? 'nameHe' : 'nameEn';
  const errAt = (field: string) => { const e = errors.find((x) => x.field === field || x.field.startsWith(field + '_')); return e ? fieldText(e) : undefined; };
  const set = (f: GroupForm) => { setForm(f); setErrors([]); setError(''); };
  const setOpt = (i: number, patch: Partial<OptionForm>) => set({ ...form, options: form.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const moveOpt = (i: number, to: number) => { const o = [...form.options]; const [x] = o.splice(i, 1); o.splice(to, 0, x!); set({ ...form, options: o }); };
  const cap = capacityOf(form.options);
  /** The form now shows `rows` as stored, and the next save goes over their version. */
  const readAgain = (rows: GroupRows) => { const f = groupToForm(rows.group, rows.options); setForm(f); setOpened(f); setBase(shape(f)); setExpected(rows.group.updated_at); };

  async function save({ over = expected, confirmRules = false, confirmLimits = false, f = form }: { over?: string | null; confirmRules?: boolean; confirmLimits?: boolean; f?: GroupForm } = {}) {
    if (busy) return;
    setBusy(true); setError(''); setStale(null); setRules(null);
    try {
      const r = await saveGroupForm(gid, f, over, { confirmRules, confirmLimits });
      if (r.ok) {
        toast(t(confirmLimits ? 'lib.confirm.done' : 'lib.saved'));
        if (!id) go('addons/' + gid, true);
        else readAgain({ group: r.group, options: menu.value!.options.filter((o) => o.group_id === gid) });
      } else if (r.code === 'stale') setStale(r.current);
      else setRules(r.rules);
    } catch (e) {
      const err = toV2Error(e);
      if (err.code === 'form_invalid') { setErrors(err.detail as FieldError[]); return; }
      if (err.code === 'dish_limits') {
        // a dish has its own limits for this group that the change would break: said with the dish's name
        const x = err.detail as { dish: string; dishId: string | null };
        const dish = menu.value!.dishes.find((r) => r.id === x.dishId);
        setError(t('lib.e.dish_limits', { dish: (dish ? named(dish, UI) : x.dish) || t('menu2.unnamed') }));
        return;
      }
      setError(errText(err.code));
      if (err.code === 'nesting_too_deep') {
        // the library as it is stored now decides: an opener it no longer allows is dropped from the form
        const fresh = menu.value!;
        const allowed = new Set(openTargets(id, byCreated(fresh.groups), fresh.options).map((g) => g.id));
        setForm((f) => ({ ...f, options: f.options.map((o) => (o.opensGroupId && !allowed.has(o.opensGroupId) ? { ...o, opensGroupId: null } : o)) }));
      }
    } finally { setBusy(false); }
  }
  // changed elsewhere: only what the owner changed here goes over the group as stored now (mergeGroupForms), or the
  // stored one is shown
  const keepMine = () => {
    const now = groupToForm(stale!.group, stale!.options), over = stale!.group.updated_at;
    const merged = mergeGroupForms(opened, form, now);
    setForm(merged); setOpened(now); setBase(shape(now)); setExpected(over);
    save({ over, f: merged });
  };
  const takeStored = () => { readAgain(stale!); setStale(null); };
  async function remove() {
    setBusy(true);
    try { await removeRows('addon_groups', [row!.id]); setDel(false); go('addons', true); }
    catch (e) { setError(errText(toV2Error(e).code)); setDel(false); }
    finally { setBusy(false); }
  }
  const back = () => leaveScreen(() => go('addons'));

  return (
    <div class="page has-sticky" data-screen="group-editor" data-group={id ?? 'new'}>
      <button type="button" class="backlink linkbtn" onClick={back}><Icon name="chev" size={16} back />{t('lib.title')}</button>
      <PageHead title={row ? named(row, UI) || t('menu2.unnamed') : t('lib.new')}><LangSeg value={L} onChange={setL} langs={langs} /></PageHead>
      {!editable && <Note>{t('menu2.readOnly')}</Note>}
      {nested && <Note title={t('lib.nested.title')}>{t('lib.nested.body', { names: u.openedBy.join(', ') })}</Note>}

      <ReadOnly when={!editable} class="group-form">
      <div class="card">
        <Field label={t('lib.name') + ' · ' + t('app.' + L)} error={errAt('name')}>{(p) => (
          <input {...p} type="text" dir="auto" lang={L} maxLength={60} value={form[nameKey]} disabled={!editable} data-field={'group-name-' + L} onInput={(e) => set({ ...form, [nameKey]: (e.target as HTMLInputElement).value })} />
        )}</Field>
        <Field label={t('lib.label')} hint={t('lib.labelHint')} optional error={errAt('label')}>{(p) => (
          <input {...p} type="text" dir="auto" maxLength={60} value={form.label} disabled={!editable} data-field="group-label" onInput={(e) => set({ ...form, label: (e.target as HTMLInputElement).value })} />
        )}</Field>
      </div>

      {row && row.limits_confirmed === false && (
        <Note kind="warn" title={t('lib.confirm.title')} action={editable ? <Btn small kind="primary" icon="check" busy={busy} onClick={() => save({ confirmLimits: true })} data-action="confirm-limits">{t('lib.confirm.go')}</Btn> : undefined}>
          <span data-limits-unconfirmed>{t('lib.confirm.body', { rule: ruleLine(row.min_units, row.max_units) })}</span>
        </Note>
      )}
      <div class="card" role="group" aria-labelledby="how-h">
        <h2 id="how-h">{t('lib.how')}</h2>
        <Seg value={form.selection} label={t('lib.how')} disabled={!editable} onChange={(v) => set(withSelection(form, v))}
          options={[{ value: 'single', label: t('lib.single') }, { value: 'multiple', label: t('lib.multiple') }]} />
        <div class="switchrow"><span>{t('lib.required')}</span>
          <Switch checked={form.min > 0} disabled={!editable} label={t('lib.required')} onChange={(on) => set({ ...form, min: on ? Math.max(1, form.min) : 0 })} /></div>
        {many && <div class="grid2">
          {form.min > 0 && <div class="field"><span class="flabel">{t('ed.min')}</span><Stepper id="group-min" value={form.min} min={1} max={form.max} label={t('ed.min')} disabled={!editable} onChange={(n) => set({ ...form, min: n })} /></div>}
          <div class="field"><span class="flabel">{t('ed.max')}</span><Stepper id="group-max" value={form.max} min={Math.max(1, form.min)} max={Math.max(form.min, Math.min(30, Math.max(cap, 1)))} label={t('ed.max')} disabled={!editable} onChange={(n) => set({ ...form, max: n })} /></div>
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
      </ReadOnly>

      {row && <section class="card" aria-labelledby="used-h">
        <h2 id="used-h">{t('lib.used')}</h2>
        {u.dishes.length === 0 ? <p class="muted">{t('lib.unused')}</p>
          : <ul class="chips">{u.dishes.map((x) => <li key={x!.id}><a class="chip" href={'#/menu/d/' + x!.id + '/addons'}>{named(x!, UI)}</a></li>)}</ul>}
        {editable && <Btn kind="ghost" icon="trash" onClick={() => setDel(true)} data-action="delete-group">{t('lib.delete')}</Btn>}
      </section>}

      {editable && <Sticky note={error ? <span class="ferr" role="alert" data-error>{error}</span> : dirty && !stale ? t('save.leave') : undefined}>
        {stale && <StaleGroup rows={stale} busy={busy} onKeep={keepMine} onTake={takeStored} />}
        {!stale && <Btn kind="primary" block busy={busy} disabled={!dirty && !!row} onClick={() => save()} data-action="save-group">{row ? t('lib.save') : t('lib.create')}</Btn>}
      </Sticky>}
      <Confirm open={!!rules} title={t('lib.rules.title')} body={tn('lib.rules.body', rules?.length ?? 0, { names: (rules ?? []).map(ruleName).join(', ') })}
        confirmLabel={t('lib.rules.go')} danger busy={busy} onConfirm={() => save({ confirmRules: true })} onClose={() => setRules(null)} />
      <Confirm open={del} title={t('lib.delete')} body={u.dishes.length ? tn('lib.deleteUsed', u.dishes.length, { name: named(row, UI) }) : t('lib.deleteConfirm', { name: named(row, UI) })}
        confirmLabel={t('app.delete')} danger busy={busy} onConfirm={remove} onClose={() => setDel(false)} />
      <Confirm open={leave} title={t('lib.leave.title')} body={t('lib.leave.body')} confirmLabel={t('lib.leave.go')} onConfirm={() => { setLeave(false); const to = leaveTo.current ?? (() => go('addons')); leaveTo.current = null; to(); }} onClose={() => { setLeave(false); leaveTo.current = null; }} />
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
          <MoneyInput id={p.id} describedBy={p['aria-describedby']} invalid={!!p['aria-invalid']} value={o.price} placeholder="0" field={`option-price-${i}`} disabled={!editable} onInput={(v) => onChange({ price: v })} />
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

/** The group was saved somewhere else since this form read it: how it is stored now, and the owner's two ways on. */
function StaleGroup({ rows, busy, onKeep, onTake }: { rows: GroupRows; busy: boolean; onKeep: () => void; onTake: () => void }) {
  const L = lang.value;
  const opts = byPosition(rows.options);
  return (
    <div class="stale" role="alert" data-stale>
      <p class="note-title">{t('lib.stale.title')}</p>
      <p class="fine">{t('lib.stale.body')}</p>
      <div class="stale-now">
        <p><span class="strong">{named(rows.group, L) || t('menu2.unnamed')}</span> · {ruleLine(rows.group.min_units, rows.group.max_units)}</p>
        <ul>{opts.map((o) => <li key={o.id}>{named(o, L) || t('menu2.unnamed')}{o.price > 0 && <> <Ltr>+{shekels(o.price)}</Ltr></>}{o.is_default && <span class="muted"> · {t('lib.default')}</span>}</li>)}</ul>
      </div>
      <p class="fine" data-mine-only>{t('lib.stale.mineOnly')}</p>
      <div class="btnrow">
        <Btn kind="primary" busy={busy} onClick={onKeep} data-action="keep-mine">{t('lib.stale.keep')}</Btn>
        <Btn disabled={busy} onClick={onTake} data-action="take-stored">{t('lib.stale.take')}</Btn>
      </div>
    </div>
  );
}

/** A form problem, said where it is. */
function fieldText(e: FieldError): string {
  if (e.code === 'name_missing') return t('e.name_missing');
  if (e.code === 'price_invalid') return t('menu.item.badPrice');
  return errText(e.code, 'lib.e');
}
