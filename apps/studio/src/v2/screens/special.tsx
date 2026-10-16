// A special in one sheet, from Home (Hopa H53): the dish's names and price, its section, the days and hours, then save
// and publish. Three writes through the store, each with an id made here and kept until it is stored (a retry after a
// lost answer adds nothing twice): the schedule of kind special (named after the dish), the dish linked to it, then the
// publish. A retry after the owner changed the form saves only what changed, guarded like every edit (saveNow). The
// sheet says before the tap what publishing means now: Halom's approval still pending, the first publish, the menu
// offline, other changes waiting. A photo comes later, on the dish.
import { useRef, useState } from 'preact/hooks';
import { localParts, type DishRow } from '@mana/contracts';
import { toast } from '../../lib/store.ts';
import { Btn, Field, Note, Sheet } from '../../ui.tsx';
import { standingOf } from '../data/changes.ts';
import { hasChanges, refreshDraft } from '../data/draft.ts';
import { toV2Error } from '../data/errors.ts';
import { changed, type FieldError } from '../data/forms.ts';
import { clock } from '../data/live.ts';
import * as api from '../data/menu.ts';
import { byPosition, named, newId } from '../data/rows.ts';
import { SPECIAL_NAME_MAX, newSpecialForm, specialFromForm, type SpecialForm } from '../data/special.ts';
import { addDish, addRows, flushSaves, mayWrite, menu, refreshVenue, saveNow } from '../data/store.ts';
import { errText, lang, t } from '../i18n.ts';
import { MoneyInput } from '../ui.tsx';
import { daysText, timeRange } from '../words.ts';
import { DayChips, TimePair } from './hours.tsx';

type Done = { readonly dishId: string; readonly outcome: 'approved' | 'pending' | 'saved'; readonly when: string };

export function SpecialSheet({ onClose }: { onClose: () => void }) {
  const d = menu.value!, L = lang.value;
  const sections = byPosition(d.sections);
  const [form, setForm] = useState<SpecialForm>(() => newSpecialForm(sections[0]?.id ?? '', localParts(clock.value, d.venue.time_zone).weekday));
  // the schedule's and the dish's ids, made here and kept until stored
  const ids = useRef({ schedule: newId(), dish: newId() });
  // other unpublished changes, as the sheet opened (publishing sends them too)
  const [others] = useState(() => hasChanges.value);
  const [errors, setErrors] = useState<readonly FieldError[]>([]), [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'publish' | 'save'>(''), [done, setDone] = useState<Done | null>(null);
  const standing = standingOf(d.venue);
  const set = (p: Partial<SpecialForm>) => { setForm({ ...form, ...p }); setErrors([]); setError(''); };
  const errAt = (...fields: string[]) => { const e = errors.find((x) => fields.includes(x.field)); return e ? errText(e.code, 'special.e') : undefined; };

  async function save(publish: boolean) {
    if (busy) return;
    const m = specialFromForm(form, sections.map((s) => s.id));
    if (!m.ok) { setErrors(m.errors); return; }
    setBusy(publish ? 'publish' : 'save'); setError('');
    try {
      mayWrite();
      const { schedule, sectionId, dish } = m.value;
      const { schedule: sid, dish: did } = ids.current;
      // 1. the schedule; 2. the dish, linked to it. Stored by an earlier try: only what changed since, guarded.
      const sNow = menu.value!.schedules.find((s) => s.id === sid);
      if (!sNow) await addRows('schedules', [{ id: sid, ...schedule }]);
      else if (await saveNow('schedules', sid, changed(sNow, schedule)) === 'conflict') return;
      const cols: Pick<DishRow, 'name_he' | 'name_en' | 'price' | 'section_id' | 'schedule_id'> = { ...dish, section_id: sectionId, schedule_id: sid };
      const dNow = menu.value!.dishes.find((x) => x.id === did);
      if (!dNow) await addDish(sectionId, cols, did);
      else if (await saveNow('dishes', did, changed(dNow, cols)) === 'conflict') return;
      // 3. publish (everything waiting goes with it, as on the publish screen)
      let outcome: Done['outcome'] = 'saved';
      if (publish) {
        await flushSaves();
        outcome = (await api.publishMenu(d.venue.id, null)).review;
        await refreshVenue().catch(() => {});
        refreshDraft();
      }
      const w = schedule.windows[0]!;
      const when = daysText(w.days) + ' ' + timeRange(w.from, w.to);
      setDone({ dishId: did, outcome, when });
      toast(t('special.done.' + outcome, { when }));
    } catch (e) { setError(errText(toV2Error(e).code, 'pub.e')); }
    finally { setBusy(''); }
  }

  if (done) {
    return (
      <Sheet open onClose={onClose} title={t('special.done.title')} name="special">
        <div class="card-in" data-special-done={done.outcome} data-dish={done.dishId}>
          <p class="strong">{t('special.done.' + done.outcome, { when: done.when })}</p>
        </div>
        <div class="btnrow">
          <a class="btn btn-secondary" href={'#/menu/d/' + done.dishId} data-link="special-dish"><span class="btn-txt">{t('special.open')}</span></a>
          {done.outcome === 'saved' && <a class="btn btn-secondary" href="#/publish" data-link="publish"><span class="btn-txt">{t('pub.title')}</span></a>}
          <Btn kind="primary" onClick={onClose} data-action="special-close">{t('app.done')}</Btn>
        </div>
      </Sheet>
    );
  }

  const note = standing === 'pending' ? t('special.pending') : standing === 'never' ? t('pub2.approvalNote') : standing === 'offline' ? t('special.offline') : '';
  return (
    <Sheet open onClose={onClose} title={t('parts.newSpecial')} name="special" tall
      foot={<>
        <Btn kind="ghost" busy={busy === 'save'} disabled={!!busy} onClick={() => save(false)} data-action="special-save">{t('special.saveOnly')}</Btn>
        <Btn kind="primary" busy={busy === 'publish'} disabled={!!busy} onClick={() => save(true)} data-action="special-publish">{t('special.publish')}</Btn>
      </>}>
      <p class="hint">{t('special.lead')}</p>
      <div class="grid2">
        <Field label={t('menu.quick.name') + ' · ' + t('app.he')} error={errAt('name', 'name_he')}>{(p) => (
          <input {...p} type="text" dir="auto" lang="he" maxLength={SPECIAL_NAME_MAX} value={form.nameHe} data-field="special-name-he" onInput={(e) => set({ nameHe: (e.target as HTMLInputElement).value })} />
        )}</Field>
        <Field label={t('menu.quick.name') + ' · ' + t('app.en')} error={errAt('name_en')}>{(p) => (
          <input {...p} type="text" dir="auto" lang="en" maxLength={SPECIAL_NAME_MAX} value={form.nameEn} data-field="special-name-en" onInput={(e) => set({ nameEn: (e.target as HTMLInputElement).value })} />
        )}</Field>
      </div>
      <div class="grid2">
        <Field label={t('menu.quick.price')} error={errAt('price')}>{(p) => (
          <MoneyInput id={p.id} describedBy={p['aria-describedby']} invalid={!!p['aria-invalid']} value={form.price} field="special-price" onInput={(v) => set({ price: v })} />
        )}</Field>
        <Field label={t('special.section')} error={errAt('section')}>{(p) => (
          <select {...p} value={form.sectionId} data-field="special-section" onChange={(e) => set({ sectionId: (e.target as HTMLSelectElement).value })}>
            {sections.map((s) => <option key={s.id} value={s.id}>{named(s, L) || t('menu2.unnamed')}</option>)}
          </select>
        )}</Field>
      </div>
      <div class="field"><span class="flabel">{t('parts.when')}</span>
        <DayChips id="special" days={form.days} label={t('hours.days')} onChange={(days) => set({ days })} />
        {errAt('days') && <p class="ferr" role="alert">{errAt('days')}</p>}
        <TimePair id="special" from={form.from} to={form.to} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} />
        {errAt('time') && <p class="ferr" role="alert">{errAt('time')}</p>}
      </div>
      <p class="fine">{t('special.photo')}</p>
      {note && <div data-approval-note={standing}><Note>{note}</Note></div>}
      {others && <p class="fine" data-others-waiting>{t('special.others')}</p>}
      {error && <Note kind="error">{error}</Note>}
    </Sheet>
  );
}
