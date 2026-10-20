// Suggestion rules (F06, Hopa H20–H24): the owner's context rules. At most one suggestion at a time, never in a chain,
// never pre-selected or added for the guest, never something already in the basket, unavailable or hidden by the
// guest's filter. #/rules lists them, each in one plain line, on or off, in the order they compete (drag, or the up and
// down buttons); #/rules/<id> (or new) edits one, with a live preview: the contracts' matchSuggestion on the draft menu
// (preview_menu) with a sample basket, day and hour the owner changes, saying what would be suggested, or why nothing.
// Saving sends only what changed since the editor opened, over the version it read (`saveNow`): a rule changed on
// another device meanwhile is never written over without the owner's say (conflict.tsx). A counter reads, never edits.
import { useEffect, useState } from 'preact/hooks';
import { TAGS, TRIGGERS, allDishes, localParts, type Suggestion, type Tag, type UpsellRuleRow, type Weekday } from '@mana/contracts';
import { Btn, Confirm, Empty, Field, Icon, Note, PageHead, Seg, Sheet, Sticky, Switch, go } from '../../ui.tsx';
import { toast } from '../../lib/store.ts';
import { liveOverlayOf } from '../data/availability.ts';
import { draft } from '../data/draft.ts';
import { toV2Error } from '../data/errors.ts';
import { changed, type FieldError } from '../data/forms.ts';
import { WEEK, venueHoursOf } from '../data/hours.ts';
import { clock, overrides } from '../data/live.ts';
import { ruleNumbers, ruleNumbersRange } from '../data/rule-numbers.ts';
import { byPosition, named, newId } from '../data/rows.ts';
import {
  newRuleForm, nextPriority, previewRule, ranked, reprioritize, ruleFromForm, ruleToForm, type IdLists, type RuleForm, type RuleWrite, type Sample, type Why,
} from '../data/rules.ts';
import { ANY_ROW, addRows, canEdit, menu, patchRow, removeRows, resync, saveNow, setPriorities } from '../data/store.ts';
import type { MenuData } from '../data/menu.ts';
import { langsOf } from '../format.ts';
import { errText, lang, t } from '../i18n.ts';
import { LangSeg, ReadOnly, ReorderList, Stepper, useEditOnly, useEntryLang } from '../ui.tsx';
import { dayName, daysText, momentText, orList, ruleSummary, timeRange, type NameOf } from '../words.ts';
import { DayChips, TimePair } from './hours.tsx';

export function RulesScreen({ rest }: { rest: string[] }) {
  // a new rule only edits: an account that may not edit is taken back to the list (also when it came by address);
  // an existing rule opens read-only for it, without the preview (the draft, preview_menu, is for those who edit)
  const editable = canEdit();
  useEditOnly(rest[0] === 'new', editable, 'rules');
  if (rest[0] && !(rest[0] === 'new' && !editable)) return <RuleEditor key={rest[0]} id={rest[0] === 'new' ? null : rest[0]} />;
  return <RulesList />;
}

/** Names in the current language, from the rows the app holds ('' for something deleted). */
function namesOf(d: MenuData, L: 'he' | 'en'): NameOf {
  return (kind, id) => {
    const row = kind === 'dish' ? d.dishes.find((x) => x.id === id) : kind === 'section' ? d.sections.find((x) => x.id === id) : d.options.find((x) => x.id === id);
    return row ? named(row, L) : '';
  };
}
const lineOf = (r: { line_he: string; line_en: string }, L: 'he' | 'en') => (L === 'he' ? r.line_he || r.line_en : r.line_en || r.line_he);

// ---------------------------------------------------------------- the list
function RulesList() {
  const d = menu.value!, L = lang.value;
  const editable = canEdit();
  const rules = ranked(d.rules);
  const names = namesOf(d, L);
  const [arranging, setArranging] = useState(false);
  const fail = (e: unknown) => toast(errText(toV2Error(e).code), 'error');
  const newBtn = <Btn kind="primary" icon="plus" onClick={() => go('rules/new')} data-action="new-rule">{t('rules.new')}</Btn>;
  return (
    <div class="page" data-screen="rules">
      <PageHead title={t('rules.title')} lead={t('rules.lead')}>{editable && rules.length > 0 && newBtn}</PageHead>
      {!editable && <Note>{t('ro.settings')}</Note>}
      {rules.length > 0 && <p class="fine" data-publish-note>{t('rules.publish')}</p>}
      {/* the period the dashboard lane's numbers count (data/rule-numbers.ts) */}
      {rules.length > 0 && ruleNumbers.value && ruleNumbersRange.value && <p class="fine" data-rule-period={ruleNumbersRange.value}>{t('rules.period.' + ruleNumbersRange.value)}</p>}
      {rules.length === 0 && <Empty title={t('rules.empty.title')} body={t('rules.empty.body')} icon="sparkle">{editable && newBtn}</Empty>}
      {rules.length > 1 && editable && <div class="row-between"><p class="hint">{t('rules.orderHint')}</p>
        <button type="button" class={'toolbtn' + (arranging ? ' on' : '')} aria-pressed={arranging ? 'true' : 'false'} onClick={() => setArranging(!arranging)} data-tool="arrange-rules">
          <Icon name={arranging ? 'check' : 'reorder'} size={18} /><span>{arranging ? t('menu.reorderDone') : t('menu.reorder')}</span></button></div>}
      {rules.length > 0 && <ReorderList items={rules} arranging={arranging} label={t('rules.title')} nameOf={(r) => r.label || ruleSummary(r, names)}
        onMove={(from, to) => { setPriorities(reprioritize(rules, from, to))?.catch(fail); }}
        render={(r) => <RuleLine rule={r} names={names} editable={editable && !arranging} />} />}
    </div>
  );
}

function RuleLine({ rule, names, editable }: { rule: UpsellRuleRow; names: NameOf; editable: boolean }) {
  const L = lang.value;
  const summary = ruleSummary(rule, names);
  const line = lineOf(rule, L);
  const nums = ruleNumbers.value?.get(rule.id);
  return (
    <>
      <a class="row-main" href={'#/rules/' + rule.id} aria-label={t('rules.edit', { name: rule.label || summary })} data-rule={rule.id}>
        <span class="row-text">
          <span class="row-name" data-summary>{summary}</span>
          {rule.label && <span class="row-sub fine">{rule.label}</span>}
          {line && <span class="row-sub rule-line">“{line}”</span>}
          <span class="row-sub">
            {!rule.active && <span class="badge badge-warn" data-rule-off>{t(rule.inactive_reason ? 'rules.emptied' : 'rules.off')}</span>}
            {/* the dashboard lane fills ruleNumbers (data/rule-numbers.ts) */}
            {nums && <span class="fine" data-rule-numbers>{t('rules.numbers', { shown: nums.shown, accepted: nums.accepted, dismissed: nums.dismissed })}</span>}
          </span>
        </span>
      </a>
      {editable && <span class="rule-switch"><Switch checked={rule.active} label={t('rules.onOff', { name: rule.label || summary })}
        onChange={(v) => patchRow('upsell_rules', rule.id, { active: v }, { now: true })} /></span>}
    </>
  );
}

// ---------------------------------------------------------------- one rule
function RuleEditor({ id }: { id: string | null }) {
  const d = menu.value!, L0 = lang.value;
  const row = id ? d.rules.find((r) => r.id === id) : null;
  const langs = langsOf(d.venue);
  const [L, setL] = useEntryLang(langs);
  // what the editor opened with: only what the owner changed here is saved (a change made elsewhere meanwhile stays)
  const [opened, setOpened] = useState<RuleForm>(() => (row ? ruleToForm(row) : newRuleForm(nextPriority(d.rules))));
  const [form, setForm] = useState<RuleForm>(opened);
  // a new rule's id: kept until it is stored, so trying again after a lost answer never adds the rule twice
  const [newRuleId] = useState(newId);
  const [errors, setErrors] = useState<readonly FieldError[]>([]), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [del, setDel] = useState(false), [leave, setLeave] = useState(false);
  const editable = canEdit();
  const dirty = JSON.stringify(form) !== JSON.stringify(opened);
  // the rule as stored again: after the owner's choice in a conflict, a refusal, or the menu read again (then only when
  // nothing is typed here: what the owner is typing stays, and its save is guarded)
  useEffect(() => {
    const r = resync.value;
    if (!r || !row) return;
    const ours = r.table === 'upsell_rules' && r.id === row.id;
    if (!ours && (r.id !== ANY_ROW || dirty)) return;
    const f = ruleToForm(row); setForm(f); setOpened(f); setErrors([]);
  }, [resync.value]);
  if (id && !row) return <div class="page"><a class="backlink" href="#/rules"><Icon name="chev" size={16} back />{t('rules.title')}</a><p class="muted">{t('rules.notFound')}</p></div>;
  const names = namesOf(d, L0);
  const set = (patch: Partial<RuleForm>) => { setForm({ ...form, ...patch }); setErrors([]); setError(''); };
  const errAt = (...fields: string[]) => { const e = errors.find((x) => fields.includes(x.field)); return e ? errText(e.code) : undefined; };
  const lineKey = L === 'he' ? 'lineHe' : 'lineEn';
  const checkout = form.trigger === 'checkout';
  const mapped = ruleFromForm(form);

  async function save() {
    if (busy) return;
    const m = ruleFromForm(form);
    if (!m.ok) { setErrors(m.errors); setError(t('e.form_invalid')); return; }
    setBusy(true); setError('');
    try {
      if (row) {
        const was = ruleFromForm(opened);
        // 'conflict': the rule changed somewhere else; the dialog asks, and the form follows the owner's choice (resync)
        if (await saveNow('upsell_rules', row.id, was.ok ? changed(was.value, m.value) : m.value) === 'saved') {
          const now = menu.value?.rules.find((r) => r.id === row.id);
          const f = now ? ruleToForm(now) : form; setForm(f); setOpened(f);
          toast(t('rules.saved'));
        }
      } else {
        try { await addRows('upsell_rules', [{ id: newRuleId, ...m.value }]); }
        catch (e) {
          // an earlier try was stored (its answer was lost) and the owner changed the rule since: store the change on it
          if (toV2Error(e).code !== 'stored_earlier') throw e;
          const had = menu.value?.rules.find((r) => r.id === newRuleId);
          const was = had ? ruleFromForm(ruleToForm(had)) : null;
          if (!had || !was?.ok || await saveNow('upsell_rules', newRuleId, changed(was.value, m.value)) === 'conflict') { go('rules/' + newRuleId, true); return; }
        }
        toast(t('rules.saved'));
        go('rules/' + newRuleId, true);
      }
    } catch (e) { setError(errText(toV2Error(e).code)); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { await removeRows('upsell_rules', [row!.id]); setDel(false); go('rules', true); }
    catch (e) { setError(errText(toV2Error(e).code)); setDel(false); }
    finally { setBusy(false); }
  }
  const back = () => (dirty ? setLeave(true) : go('rules'));
  const title = row ? row.label || ruleSummary(row, names) : t('rules.new');

  return (
    <div class="page has-sticky" data-screen="rule-editor" data-rule={id ?? 'new'}>
      <button type="button" class="backlink linkbtn" onClick={back}><Icon name="chev" size={16} back />{t('rules.title')}</button>
      <PageHead title={title}><LangSeg value={L} onChange={setL} langs={langs} /></PageHead>
      {row?.inactive_reason && <Note kind="warn" title={t('rules.emptied')}>{t('rules.emptiedBody')}</Note>}
      {mapped.ok && <p class="rule-summary-now" data-summary-now>{ruleSummary(mapped.value, names)}</p>}
      {!editable && <Note>{t('ro.settings')}</Note>}
      {editable && <p class="fine" data-publish-note>{t('rules.publish')}</p>}

      <ReadOnly when={!editable} class="rule-form">
      <section class="card" aria-labelledby="r-when-h">
        <h2 id="r-when-h">{t('rules.when')}</h2>
        <Seg value={form.trigger} label={t('rules.when')} disabled={!editable} options={TRIGGERS.map((x) => ({ value: x, label: t('rules.trigger.' + x) }))}
          onChange={(tr) => set({ trigger: tr, ...(tr === 'checkout' && form.suggestKind === 'option' ? { suggestKind: 'dish' as const, suggestOptionId: null } : {}) })} />
        <p class="hint">{t('rules.triggerHint.' + form.trigger)}</p>
        <div class="field">
          <span class="flabel">{t(checkout ? 'rules.scopeCheckout' : 'rules.scope')}</span>
          <Seg value={form.scopeKind} label={t(checkout ? 'rules.scopeCheckout' : 'rules.scope')} disabled={!editable} onChange={(k) => set({ scopeKind: k, scopeIds: [] })}
            options={[{ value: 'all', label: t('rules.scope.all') }, { value: 'section', label: t('rules.scope.section') }, { value: 'dish', label: t('rules.scope.dish') }]} />
          {form.scopeKind !== 'all' && <Targets id="scope" editable={editable} mode={form.scopeKind === 'dish' ? 'dishes' : 'sections'}
            value={form.scopeKind === 'dish' ? { dishes: form.scopeIds, sections: [] } : { dishes: [], sections: form.scopeIds }}
            onChange={(v) => set({ scopeIds: form.scopeKind === 'dish' ? v.dishes : v.sections })} />}
          {errAt('scope') && <p class="ferr" role="alert">{errAt('scope')}</p>}
        </div>
      </section>

      <section class="card" aria-labelledby="r-times-h">
        <h2 id="r-times-h">{t('rules.times')}</h2>
        <DayChips id="rule" days={form.days} label={t('hours.days')} disabled={!editable} onChange={(days) => set({ days })} />
        <p class="hint">{t('rules.daysHint')}</p>
        <div class="switchrow"><span>{t('rules.timed')}</span><Switch checked={form.timed} label={t('rules.timed')} disabled={!editable} onChange={(v) => set({ timed: v })} /></div>
        {form.timed && <TimePair id="rule" from={form.from} to={form.to} disabled={!editable} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} />}
        {errAt('time', 'days') && <p class="ferr" role="alert">{errAt('time', 'days')}</p>}
      </section>

      <section class="card" aria-labelledby="r-basket-h">
        <h2 id="r-basket-h">{t('rules.basket')}</h2>
        <div class="switchrow"><span>{t('rules.has')}</span><Switch checked={!!form.has} label={t('rules.has')} disabled={!editable} onChange={(on) => set({ has: on ? { dishes: [], sections: [] } : null })} /></div>
        {form.has && <Targets id="has" mode="both" editable={editable} value={form.has} onChange={(v) => set({ has: v })} />}
        {errAt('has') && <p class="ferr" role="alert">{errAt('has')}</p>}
        <div class="switchrow"><span>{t('rules.lacks')}</span><Switch checked={!!form.lacks} label={t('rules.lacks')} disabled={!editable} onChange={(on) => set({ lacks: on ? { dishes: [], sections: [] } : null })} /></div>
        {form.lacks && <Targets id="lacks" mode="both" editable={editable} value={form.lacks} onChange={(v) => set({ lacks: v })} />}
        {errAt('lacks') && <p class="ferr" role="alert">{errAt('lacks')}</p>}
      </section>

      <SuggestCard form={form} set={set} L={L} lineKey={lineKey} errAt={errAt} editable={editable} />

      <section class="card" aria-labelledby="r-more-h">
        <h2 id="r-more-h">{t('rules.more')}</h2>
        <div class="switchrow"><span>{t('rules.active')}</span><Switch checked={form.active} label={t('rules.active')} disabled={!editable} onChange={(v) => set({ active: v })} /></div>
        <div class="switchrow"><span>{t('rules.cap')}</span><Stepper id="rule-cap" value={form.cap} min={1} max={5} label={t('rules.cap')} disabled={!editable} onChange={(n) => set({ cap: n })} /></div>
        <Field label={t('rules.priority')} hint={t('rules.priorityHint')} error={errAt('priority')}>{(p) => (
          <input {...p} type="number" inputMode="numeric" min={0} max={100} dir="ltr" value={Number.isFinite(form.priority) ? form.priority : ''} disabled={!editable} data-field="rule-priority"
            onInput={(e) => { const v = (e.target as HTMLInputElement).value; set({ priority: v === '' ? NaN : Number(v) }); }} />
        )}</Field>
        <Field label={t('lib.label')} hint={t('rules.labelHint')} optional error={errAt('label')}>{(p) => (
          <input {...p} type="text" dir="auto" maxLength={80} value={form.label} disabled={!editable} data-field="rule-label" onInput={(e) => set({ label: (e.target as HTMLInputElement).value })} />
        )}</Field>
      </section>
      </ReadOnly>

      {editable && <RulePreview form={form} id={id} />}

      {row && editable && <Btn kind="ghost" icon="trash" onClick={() => setDel(true)} data-action="delete-rule">{t('rules.delete')}</Btn>}
      {editable && <Sticky note={error ? <span class="ferr" role="alert" data-error>{error}</span> : dirty ? t('save.leave') : undefined}>
        <Btn kind="primary" block busy={busy} disabled={!dirty && !!row} onClick={save} data-action="save-rule">{row ? t('rules.save') : t('rules.create')}</Btn></Sticky>}
      <Confirm open={del} title={t('rules.delete')} body={t('rules.deleteConfirm')} confirmLabel={t('app.delete')} danger busy={busy} onConfirm={remove} onClose={() => setDel(false)} />
      <Confirm open={leave} title={t('lib.leave.title')} body={t('rules.leave')} confirmLabel={t('lib.leave.go')} onConfirm={() => { setLeave(false); go('rules'); }} onClose={() => setLeave(false)} />
    </div>
  );
}

/** Dishes in menu order with their section, for the pickers. */
function menuDishes(d: MenuData) {
  return byPosition(d.sections).map((s) => ({ section: s, dishes: byPosition(d.dishes.filter((x) => x.section_id === s.id)) }));
}

/** A dish or an add-on of the dish in context, with the short line the guest reads; what keeps it from guests, said. */
function SuggestCard({ form, set, L, lineKey, errAt, editable }: {
  form: RuleForm; set: (p: Partial<RuleForm>) => void; L: 'he' | 'en'; lineKey: 'lineHe' | 'lineEn'; errAt: (...f: string[]) => string | undefined; editable: boolean;
}) {
  const d = menu.value!, UI = lang.value;
  const checkout = form.trigger === 'checkout';
  const tree = menuDishes(d);
  // the add-ons the guest can be offered: groups attached to a dish the rule applies to
  const inScope = d.dishes.filter((x) => form.scopeKind === 'all' || (form.scopeKind === 'dish' ? form.scopeIds.includes(x.id) : form.scopeIds.includes(x.section_id)));
  const groupIds = new Set(d.dishGroups.filter((a) => inScope.some((x) => x.id === a.dish_id)).map((a) => a.group_id));
  const current = form.suggestOptionId ? d.options.find((o) => o.id === form.suggestOptionId) : null;
  if (current) groupIds.add(current.group_id);
  const groups = d.groups.filter((g) => groupIds.has(g.id));
  const dish = form.suggestDishId ? d.dishes.find((x) => x.id === form.suggestDishId) : null;
  const hidden = dish && (dish.hidden || d.sections.find((s) => s.id === dish.section_id)?.hidden);
  const warn = form.suggestKind === 'dish' && dish
    ? form.scopeKind === 'dish' && form.scopeIds.includes(dish.id) ? t('issue.rule_suggests_its_trigger') : hidden ? t('rules.warn.hidden') : dish.price === null ? t('rules.warn.noPrice') : ''
    : '';
  return (
    <section class="card" aria-labelledby="r-suggest-h">
      <h2 id="r-suggest-h">{t('rules.suggest')}</h2>
      {checkout ? <p class="hint">{t('rules.suggest.checkoutDish')}</p>
        : <Seg value={form.suggestKind} label={t('rules.suggest')} disabled={!editable} onChange={(k) => set({ suggestKind: k })}
            options={[{ value: 'dish', label: t('rules.suggest.dish') }, { value: 'option', label: t('rules.suggest.option') }]} />}
      {form.suggestKind === 'dish' || checkout
        ? <Field label={t('rules.suggest.whichDish')} error={errAt('suggest')}>{(p) => (
            <select {...p} value={form.suggestDishId ?? ''} disabled={!editable} data-field="rule-suggest-dish" onChange={(e) => set({ suggestDishId: (e.target as HTMLSelectElement).value || null })}>
              <option value="">{t('dish.related.choose')}</option>
              {tree.map(({ section, dishes }) => <optgroup key={section.id} label={named(section, UI)}>
                {dishes.map((x) => <option key={x.id} value={x.id}>{named(x, UI) || t('menu2.unnamed')}</option>)}</optgroup>)}
            </select>
          )}</Field>
        : <Field label={t('rules.suggest.whichOption')} hint={groups.length ? t('rules.suggest.optionHint') : t('rules.suggest.noOptions')} error={errAt('suggest')}>{(p) => (
            <select {...p} value={form.suggestOptionId ?? ''} disabled={!editable || !groups.length} data-field="rule-suggest-option" onChange={(e) => set({ suggestOptionId: (e.target as HTMLSelectElement).value || null })}>
              <option value="">{t('rules.suggest.chooseOption')}</option>
              {groups.map((g) => <optgroup key={g.id} label={named(g, UI)}>
                {byPosition(d.options.filter((o) => o.group_id === g.id)).map((o) => <option key={o.id} value={o.id}>{named(o, UI)}</option>)}</optgroup>)}
            </select>
          )}</Field>}
      {warn && <p class="line line-warn"><Icon name="alert" /><span>{warn}</span></p>}
      <Field label={t('rules.line') + ' · ' + t('app.' + L)} hint={t('rules.lineHint')} optional error={errAt('line_he', 'line_en')}>{(p) => (
        <input {...p} type="text" dir="auto" lang={L} maxLength={120} value={form[lineKey]} disabled={!editable} data-field={'rule-line-' + L} onInput={(e) => set({ [lineKey]: (e.target as HTMLInputElement).value })} />
      )}</Field>
      <p class="fine">{t('rules.never')}</p>
    </section>
  );
}

/** Pick dishes, sections, or both (a whole section, or single dishes), in a sheet. */
function Targets({ id, mode, value, onChange, editable }: { id: string; mode: 'dishes' | 'sections' | 'both'; value: IdLists; onChange: (v: IdLists) => void; editable: boolean }) {
  const d = menu.value!, L = lang.value;
  const [open, setOpen] = useState(false);
  const chosen = [...value.sections.map((x) => named(d.sections.find((s) => s.id === x), L)), ...value.dishes.map((x) => named(d.dishes.find((y) => y.id === x), L))].filter(Boolean);
  const toggle = (list: 'dishes' | 'sections', x: string, on: boolean) => onChange({ ...value, [list]: on ? [...value[list], x] : value[list].filter((y) => y !== x) });
  return (
    <div class="targets" data-targets={id}>
      {chosen.length ? <ul class="chips" data-chosen>{chosen.map((n) => <li key={n} class="chip">{n}</li>)}</ul> : <p class="muted">{t('rules.pickNone')}</p>}
      {editable && <Btn small icon="edit" onClick={() => setOpen(true)} data-action={'pick-' + id}>{t('rules.pick')}</Btn>}
      <Sheet open={open && editable} onClose={() => setOpen(false)} title={t('rules.pickTitle.' + id)} name="pick"
        foot={<Btn kind="primary" onClick={() => setOpen(false)} data-action="pick-done">{t('rules.pickDone')}</Btn>}>
        {menuDishes(d).map(({ section, dishes }) => (
          <fieldset key={section.id} class="pickset">
            <legend>{named(section, L) || t('menu2.unnamed')}</legend>
            {mode !== 'dishes' && <label class="line line-check"><input type="checkbox" checked={value.sections.includes(section.id)} data-pick-section={section.id}
              onChange={(e) => toggle('sections', section.id, (e.target as HTMLInputElement).checked)} /><span>{mode === 'both' ? t('rules.wholeSection', { name: named(section, L) }) : named(section, L)}</span></label>}
            {mode !== 'sections' && dishes.map((x) => (
              <label key={x.id} class="line line-check"><input type="checkbox" checked={value.dishes.includes(x.id)} data-pick-dish={x.id}
                onChange={(e) => toggle('dishes', x.id, (e.target as HTMLInputElement).checked)} /><span>{named(x, L) || t('menu2.unnamed')}</span>
                {x.hidden && <span class="badge badge-warn">{t('menu2.hidden')}</span>}</label>
            ))}
          </fieldset>
        ))}
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------- the live preview
const hm = (minutes: number) => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');

/** The dish the sample starts with: the first one the rule applies to that guests see. */
function defaultDish(form: RuleForm, s: NonNullable<typeof draft.value.snapshot>): string | null {
  const all = allDishes(s);
  const hit = all.find(({ dish, sectionId }) => (form.scopeKind === 'dish' ? form.scopeIds.includes(dish.id) : form.scopeKind === 'section' ? form.scopeIds.includes(sectionId) : true));
  return (hit ?? all[0])?.dish.id ?? null;
}

function RulePreview({ form, id }: { form: RuleForm; id: string | null }) {
  const d = menu.value!, dr = draft.value, L = lang.value;
  const tz = d.venue.time_zone, now = clock.value;
  const [sample, setSample] = useState<Sample>(() => { const p = localParts(now, tz); return { dishId: null, basket: [], weekday: p.weekday, time: hm(p.minutes), tags: [], fromSuggestion: false }; });
  const s = dr.snapshot;
  const m = ruleFromForm(form);
  const head = <header class="gp-head"><h2 id="r-try-h">{t('rules.try')}</h2><p class="fine">{t('rules.trySub')}</p></header>;
  if (!s) return <section class="card" aria-labelledby="r-try-h" data-rule-preview>{head}<p class="muted">{dr.error ? errText(dr.error) : t('app.loading')}</p></section>;
  const index = new Map(allDishes(s).map((x) => [x.dish.id, x.dish] as const));
  const dishName = (x: string | null) => (x ? named({ name_he: index.get(x)?.name.he ?? '', name_en: index.get(x)?.name.en ?? '' }, L) : '');
  const trigger = form.trigger;
  const dishId = sample.dishId && index.has(sample.dishId) ? sample.dishId : defaultDish(form, s);
  const set = (p: Partial<Sample>) => setSample({ ...sample, ...p });
  const dishOptions = s.sections.map((sec) => <optgroup key={sec.id} label={sec.name[L] || sec.name[L === 'he' ? 'en' : 'he']}>
    {sec.dishes.map((x) => <option key={x.id} value={x.id}>{dishName(x.id)}</option>)}</optgroup>);

  let verdict;
  if (!m.ok) verdict = <div class="verdict" data-verdict="incomplete"><p class="muted">{t('rules.try.incomplete')}</p></div>;
  else {
    const p = previewRule({
      snapshot: s, live: liveOverlayOf(venueHoursOf(tz, d.hours, d.closures), overrides.value, now), id: id ?? 'new', write: m.value,
      optionGroup: new Map(d.options.map((o) => [o.id, o.group_id] as const)), sample: { ...sample, dishId }, now,
    });
    const what = (sg: Suggestion) => (sg.suggest.kind === 'dish' ? dishName(sg.suggest.dishId) : named(d.options.find((o) => o.id === (sg.suggest as { optionId: string }).optionId), L));
    const line = m.value && lineOf(m.value, L);
    const other = p.shown && p.shown.ruleId !== (id ?? 'new') ? p.shown : null;
    verdict = (
      <div class={'verdict ' + (p.mine ? 'is-yes' : 'is-no')} aria-live="polite" data-verdict={p.mine ? 'yes' : 'no'} data-why={p.why?.code ?? ''}>
        {p.off && <p class="fine">{t('rules.try.off')}</p>}
        {p.mine
          ? <><p class="verdict-main">{t('rules.try.yes', { x: what(p.mine) })}</p>{line && <p class="rule-line">“{line}”</p>}<p class="fine">{t('rules.try.offer')}</p></>
          : <><p class="verdict-main">{t('rules.try.no')}</p><p>{whyText(p.why!, { trigger, dish: dishName(dishId), suggestion: suggestionName(m.value, d, L, dishName), names: dishName, write: m.value, now, tz })}</p></>}
        {other && <p class="fine" data-verdict-other>{t(p.mine ? 'rules.try.otherFirst' : 'rules.try.other', { x: what(other) })}</p>}
      </div>
    );
  }
  return (
    <section class="card" aria-labelledby="r-try-h" data-rule-preview>
      {head}
      {verdict}
      <div class="sample">
        {trigger !== 'checkout' && <Field label={t(trigger === 'sheet' ? 'rules.try.opens' : 'rules.try.adds')}>{(p) => (
          <select {...p} value={dishId ?? ''} data-field="sample-dish" onChange={(e) => set({ dishId: (e.target as HTMLSelectElement).value || null })}>{dishOptions}</select>
        )}</Field>}
        <div class="field">
          <span class="flabel">{t('rules.try.basket')}</span>
          <ul class="chips" data-sample-basket>
            {trigger === 'add' && dishId && <li class="chip chip-dark">{t('rules.try.justAdded', { name: dishName(dishId) })}</li>}
            {sample.basket.map((x) => <li key={x} class="chip">{dishName(x)}<button type="button" class="chip-x" aria-label={t('rules.try.remove', { name: dishName(x) })} data-basket-remove={x}
              onClick={() => set({ basket: sample.basket.filter((y) => y !== x) })}><Icon name="x" size={14} /></button></li>)}
            {sample.basket.length === 0 && !(trigger === 'add' && dishId) && <li class="muted">{t('rules.try.empty')}</li>}
          </ul>
          <select value="" aria-label={t('rules.try.addToBasket')} data-field="sample-add" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; if (v && !sample.basket.includes(v)) set({ basket: [...sample.basket, v] }); }}>
            <option value="">{t('rules.try.addToBasket')}</option>{dishOptions}
          </select>
        </div>
        <div class="grid2 grid2-tight">
          <Field label={t('rules.try.day')}>{(p) => (
            <select {...p} value={String(sample.weekday)} data-field="sample-day" onChange={(e) => set({ weekday: Number((e.target as HTMLSelectElement).value) as Weekday })}>
              {WEEK.map((x) => <option key={x} value={x}>{dayName(x, true)}</option>)}
            </select>
          )}</Field>
          <Field label={t('rules.try.time')}>{(p) => <input {...p} type="time" dir="ltr" value={sample.time} data-field="sample-time" onInput={(e) => { const v = (e.target as HTMLInputElement).value; if (v) set({ time: v }); }} />}</Field>
        </div>
        <fieldset class="tags" data-sample-tags>
          <legend>{t('rules.try.filter')}</legend>
          {TAGS.map((tag) => {
            const on = sample.tags.includes(tag);
            return <label key={tag} class={'tagchip' + (on ? ' on' : '')}><input type="checkbox" checked={on} data-sample-tag={tag}
              onChange={() => set({ tags: on ? sample.tags.filter((x) => x !== tag) : [...sample.tags, tag] })} /><Icon name={tag} size={18} />{t('tag.' + tag)}</label>;
          })}
          <p class="hint">{t('rules.try.filterHint')}</p>
        </fieldset>
        {trigger === 'add' && <label class="line line-check"><input type="checkbox" checked={sample.fromSuggestion} data-field="sample-chained" onChange={(e) => set({ fromSuggestion: (e.target as HTMLInputElement).checked })} /><span>{t('rules.try.fromSuggestion')}</span></label>}
      </div>
    </section>
  );
}

function suggestionName(w: RuleWrite, d: MenuData, L: 'he' | 'en', dishName: (id: string | null) => string): string {
  if (w.suggest_kind === 'dish') return dishName(w.suggest_dish_id) || named(d.dishes.find((x) => x.id === w.suggest_dish_id), L);
  return named(d.options.find((o) => o.id === w.suggest_option_id), L);
}

type WhyCtx = { trigger: string; dish: string; suggestion: string; names: (id: string) => string; write: RuleWrite; now: number; tz: string };
/** Why nothing would be suggested, in the owner's words. */
function whyText(w: Why, c: WhyCtx): string {
  const until = (back: Date | null) => (back ? t('why.until', { when: momentText(back, c.now, c.tz) }) : '');
  switch (w.code) {
    case 'left_out': return t('issue.rule_left_out.' + w.reason);
    case 'scope': return c.trigger === 'checkout' ? t('why.scopeCheckout') : t('why.scope', { x: c.dish });
    case 'when': return t('why.when', { window: [c.write.days.length ? daysText(c.write.days) : '', c.write.from_time ? timeRange(c.write.from_time, c.write.to_time!, true) : ''].filter(Boolean).join(' ') });
    case 'lacks': return t('why.lacks', { x: orList(w.found.map(c.names)) });
    case 'unavailable': return t('why.unavailable.' + w.reason, { x: c.suggestion }) + until(w.back);
    case 'option_unavailable': return t('why.option_unavailable', { x: c.suggestion }) + until(w.back);
    default: return t('why.' + w.code, { x: c.suggestion, dish: c.dish });
  }
}
