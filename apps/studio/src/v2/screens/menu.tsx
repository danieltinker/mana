// The menu: sections in order, each with its dishes; a dish opens in its own sheet (#/menu/d/<id>), a section too
// (#/menu/s/<id>, #/menu/s/new). "Arrange" puts sections and dishes in order, by dragging or with the up and down
// buttons (keyboard and screen readers, each move announced). Every row has its availability one tap away
// (#/menu/a/<kind>/<id>, screens/off.tsx), for the counter too; what is off now carries a red marker, and everything
// taken off today comes back with one button.
import { useEffect, useRef, useState } from 'preact/hooks';
import { ROOMS, SECTION_KINDS, type DishRow, type SectionRow } from '@mana/contracts';
import { Btn, Confirm, Empty, Field, Icon, IconBtn, Note, PageHead, Sheet, Switch, go } from '../../ui.tsx';
import { toast } from '../../lib/store.ts';
import { offToday } from '../data/availability.ts';
import { toV2Error } from '../data/errors.ts';
import { agorotOf, changed, newSectionForm, sectionFromForm, sectionToForm, type SectionForm } from '../data/forms.ts';
import { menuPrice } from '../data/guest.ts';
import { clock, offNow, overrides, restoreToday } from '../data/live.ts';
import { byPosition, named, newId } from '../data/rows.ts';
import { addDish, addSection, canEdit, canOperate, menu, moveRow, patchRow, removeRows } from '../data/store.ts';
import { langsOf } from '../format.ts';
import { errText, lang, t, tn } from '../i18n.ts';
import { GlyphBtn, LangSeg, MoneyInput, Price, ReorderList, focusOnReturn, refocusMove, useEditOnly, useEntryLang } from '../ui.tsx';
import { SaveFailedLine } from '../saving.tsx';
import { DishSheet } from './dish.tsx';
import { OffBadge, OffSheet, offText, stateOf } from './off.tsx';

/** The availability button's name: what it opens, and what is off now (a screen reader hears the red marker too). */
function offLabel(kind: 'section' | 'dish', id: string, name: string): string {
  const s = stateOf(kind, id);
  return s.off ? t('off.open', { name }) + '. ' + offText(s) : t('off.open', { name });
}

/** After the availability sheet closes, the focus goes back to the button that opened it. */
function refocusOff(id: string) {
  focusOnReturn(`[data-off-open="${id}"]`);           // instead of the menu's heading when the address changes back
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const b = document.querySelector(`[data-off-open="${id}"]`) as HTMLElement | null;
    if (b && document.activeElement !== b) b.focus();
  }));
}

export function MenuScreen({ rest }: { rest: string[] }) {
  const d = menu.value!;
  const L = lang.value;
  const editable = canEdit();
  const operate = canOperate();
  const sections = byPosition(d.sections);
  const [arranging, setArranging] = useState(false);
  const [said, setSaid] = useState('');
  const sheetDish = rest[0] === 'd' && rest[1] ? rest[1] : null;
  // a section's sheet only edits: an account that may not edit is taken back to the menu (also when it came by address)
  const sheetSection = rest[0] === 's' && rest[1] && editable ? rest[1] : null;
  useEditOnly(rest[0] === 's', editable, 'menu');
  // the availability sheet is for everyone who operates the place (a counter too)
  // an add-on choice or group opened from a dish's sheet carries the dish (rest[3]): closing returns to the dish's button
  const sheetOff = operate && rest[0] === 'a' && rest[1] && rest[2] ? { kind: rest[1], id: rest[2], from: rest[3] } : null;
  const fail = (e: unknown) => toast(errText(toV2Error(e).code), 'error');

  const moveSection = (i: number, to: number) => {
    const p = moveRow('sections', sections, i, to);
    if (p) {
      p.catch(fail);
      setSaid(t('menu.moved', { name: named(sections[i], L), n: to + 1 }));
      refocusMove(`section[data-section="${sections[i]!.id}"] .sec-head`, to < i ? 'up' : 'down');
    }
  };

  return (
    <div class="page page-menu" data-screen="menu">
      <p class="sr" aria-live="polite">{said}</p>
      <PageHead title={t('menu.title')}>
        {editable && sections.length > 0 && <div class="menu-tools">
          <button type="button" class="toolbtn" onClick={() => go('menu/s/new')} data-tool="section"><Icon name="plus" size={18} /><span>{t('menu.addCategory')}</span></button>
          <button type="button" class={'toolbtn' + (arranging ? ' on' : '')} aria-pressed={arranging ? 'true' : 'false'} onClick={() => setArranging(!arranging)} data-tool="arrange">
            <Icon name={arranging ? 'check' : 'reorder'} size={18} /><span>{arranging ? t('menu.reorderDone') : t('menu.reorder')}</span>
          </button>
        </div>}
      </PageHead>
      {!editable && <Note>{t(operate ? 'menu2.counter' : 'menu2.readOnly')}</Note>}
      {operate && <OffNowBar />}

      {sections.length === 0 && (
        <Empty title={t('menu2.empty.title')} body={t('menu2.empty.body')} icon="menu">
          {editable && <Btn kind="primary" icon="plus" onClick={() => go('menu/s/new')} data-empty="section">{t('menu2.empty.add')}</Btn>}
        </Empty>
      )}

      {sections.map((sec, si) => {
        const dishes = byPosition(d.dishes.filter((x) => x.section_id === sec.id));
        const name = named(sec, L) || t('menu2.unnamed');
        return (
          <section key={sec.id} class="sec" aria-labelledby={'sec-' + sec.id} data-section={sec.id}>
            <header class="sec-head">
              <h2 id={'sec-' + sec.id}>{name}</h2>
              <span class="sec-n">{dishes.length}</span>
              {sec.hidden && <span class="badge badge-warn">{t('menu2.hidden')}</span>}
              <OffBadge kind="section" id={sec.id} />
              {(editable || operate) && <div class="tools">
                {editable && arranging && <>
                  <IconBtn icon="up" label={t('menu.up', { name })} disabled={si === 0} data-move="up" onClick={() => moveSection(si, si - 1)} />
                  <IconBtn icon="down" label={t('menu.down', { name })} disabled={si === sections.length - 1} data-move="down" onClick={() => moveSection(si, si + 1)} />
                </>}
                {operate && !arranging && <GlyphBtn icon="pause" label={offLabel('section', sec.id, name)} onClick={() => go('menu/a/section/' + sec.id)} data-off-open={sec.id} />}
                {editable && <IconBtn icon="edit" label={t('menu.cat.edit') + ': ' + name} onClick={() => go('menu/s/' + sec.id)} />}
              </div>}
            </header>
            {sec.schedule_id && <p class="fine sec-part">{t('menu2.sectionPart', { name: named(d.schedules.find((s) => s.id === sec.schedule_id), L) })}</p>}
            <ReorderList items={dishes} arranging={arranging && editable} nameOf={(x) => named(x, L)} label={name}
              onMove={(from, to) => { moveRow('dishes', dishes, from, to)?.catch(fail); }}
              render={(x) => <DishLine dish={x} quick={operate && !arranging} />} />
            {editable && !arranging && <QuickAdd section={sec} />}
          </section>
        );
      })}

      {sheetDish && <DishSheet id={sheetDish} tab={rest[2]} onClose={() => go('menu')} />}
      {sheetSection && <SectionSheet id={sheetSection === 'new' ? null : sheetSection} onClose={() => go('menu')} />}
      {sheetOff && <OffSheet key={sheetOff.kind + sheetOff.id} kind={sheetOff.kind} id={sheetOff.id} onClose={() => { go('menu'); refocusOff(sheetOff.from || sheetOff.id); }} />}
    </div>
  );
}

function DishLine({ dish, quick }: { dish: DishRow; quick: boolean }) {
  const d = menu.value!, L = lang.value;
  const name = named(dish, L) || t('menu2.unnamed');
  const groups = d.dishGroups.filter((a) => a.dish_id === dish.id).length;
  const part = dish.schedule_id ? d.schedules.find((s) => s.id === dish.schedule_id) : null;
  return (
    <>
      <a class="row-main" href={'#/menu/d/' + dish.id} aria-label={t('menu.item.edit', { name })} aria-describedby={'dish-sub-' + dish.id} data-dish={dish.id}>
        <span class="row-text">
          <span class="row-name">{name}</span>
          {/* the price, add-ons, day part, hidden and the red marker: the link's description for a screen reader */}
          <span class="row-sub" id={'dish-sub-' + dish.id}>
            <span data-price><Price p={menuPrice(d, dish.id)} /></span>
            {groups > 0 && <>{' '}<span class="badge badge-todo">{tn('menu2.groups', groups)}</span></>}
            {part && <>{' '}<span class="badge badge-ok">{named(part, L)}</span></>}
            {dish.hidden && <>{' '}<span class="badge badge-warn">{t('menu2.hidden')}</span></>}
            {' '}<OffBadge kind="dish" id={dish.id} />
          </span>
        </span>
        {!quick && <Icon name="chev" size={18} flip />}
      </a>
      {quick && <GlyphBtn icon="pause" label={offLabel('dish', dish.id, name)} onClick={() => go('menu/a/dish/' + dish.id)} data-off-open={dish.id} />}
    </>
  );
}

/** What is off now, and one button that brings back everything taken off today (restore_today). */
function OffNowBar() {
  const d = menu.value!;
  const n = offNow().length;
  const today = offToday(overrides.value, clock.value, d.venue.time_zone).length;
  const [ask, setAsk] = useState(false), [busy, setBusy] = useState(false);
  if (n === 0) return null;
  async function restore() {
    setBusy(true);
    try { const back = await restoreToday(); toast(tn('off.restored', back)); setAsk(false); }
    catch (e) { toast(errText(toV2Error(e).code), 'error'); setAsk(false); }
    finally { setBusy(false); }
  }
  return (
    <div class="offbar" role="status" data-off-now={n}>
      <span class="offbar-n"><span class="dot dot-bad" aria-hidden="true" />{tn('off.now', n)}</span>
      {today > 0 && <Btn small icon="refresh" onClick={() => setAsk(true)} data-action="restore-today">{t('off.restoreToday', { n: today })}</Btn>}
      <Confirm open={ask} title={t('off.restoreToday.title')} body={tn('off.restoreToday.body', today)} confirmLabel={t('off.restoreToday.go')} busy={busy}
        onConfirm={restore} onClose={() => setAsk(false)} />
    </div>
  );
}

/** A dish in one line: its name (in the place's first language) and a price; the rest in its sheet. */
function QuickAdd({ section }: { section: SectionRow }) {
  const d = menu.value!;
  const entry = langsOf(d.venue)[0] ?? 'he';
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [said, setSaid] = useState('');
  // the next dish's id: kept until it is stored, so trying again after a lost answer never adds the dish twice
  const [nextId, setNextId] = useState(newId);
  const nameRef = useRef<HTMLInputElement>(null);
  const label = t('menu.quick.label', { name: named(section, lang.value) });
  useEffect(() => { if (open) nameRef.current?.focus(); }, [open]);
  async function submit(e: Event) {
    e.preventDefault();
    if (busy) return;
    const n = name.trim(), p = agorotOf(price);
    if (!n) { setError(t('menu.item.nameMissing')); nameRef.current?.focus(); return; }
    if (p === 'invalid') { setError(t('menu.item.badPrice')); return; }
    setBusy(true); setError('');
    try {
      await addDish(section.id, { ['name_' + entry]: n, price: p } as Partial<DishRow>, nextId);
      setNextId(newId());
      setName(''); setPrice(''); setSaid(t('menu.quick.added', { name: n }));
      nameRef.current?.focus();
    } catch (err) { setError(errText(toV2Error(err).code)); }
    finally { setBusy(false); }
  }
  if (!open) return <button type="button" class="addrow" onClick={() => setOpen(true)} aria-label={label} data-add-in={section.id}><Icon name="plus" size={18} /><span>{t('menu.quick.open')}</span></button>;
  return (
    <form class="quick" onSubmit={submit} aria-label={label} noValidate data-quick={section.id}>
      <div class="quick-row">
        <input ref={nameRef} class="quick-name" type="text" maxLength={90} dir="auto" placeholder={t('menu.quick.name')} aria-label={t('menu.quick.name')} value={name}
          onInput={(e) => { setName((e.target as HTMLInputElement).value); setError(''); }} enterkeyhint="next" />
        <MoneyInput value={price} onInput={(v) => { setPrice(v); setError(''); }} label={t('menu.quick.price')} placeholder={t('menu.quick.price')} />
        <button type="submit" class={'iconbtn quick-go' + (busy ? ' is-busy' : '')} aria-label={t('menu.quick.add')} title={t('menu.quick.add')} disabled={busy}>{busy ? <span class="spin" aria-hidden="true" /> : <Icon name="plus" />}</button>
      </div>
      {error && <p class="ferr" role="alert">{error}</p>}
      <p class="sr" aria-live="polite">{said}</p>
    </form>
  );
}

/** A section: its name in each language, what it holds, the room the guest menu shows it in, hidden or not. */
function SectionSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const d = menu.value!;
  const row = id ? d.sections.find((s) => s.id === id) : null;
  const langs = langsOf(d.venue);
  const [L, setL] = useEntryLang(langs);
  const [form, setForm] = useState<SectionForm>(() => (row ? sectionToForm(row) : newSectionForm()));
  // what the sheet opened with: only what the owner changed here is saved (a change made elsewhere meanwhile stays)
  const [opened] = useState(() => (row ? sectionToForm(row) : null));
  const [newSectionId] = useState(newId);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [nameErr, setNameErr] = useState(''), [del, setDel] = useState(false);
  if (id && !row) return <Sheet open onClose={onClose} title={t('menu.cat.edit')} name="section"><p class="muted">{t('item.notFound')}</p></Sheet>;
  const dishes = row ? d.dishes.filter((x) => x.section_id === row.id).length : 0;
  const set = (patch: Partial<SectionForm>) => { setForm({ ...form, ...patch }); setError(''); setNameErr(''); };

  async function save() {
    const m = sectionFromForm(form);
    if (!m.ok) { if (m.errors.some((x) => x.field === 'name')) setNameErr(t('menu.cat.nameMissing')); else setError(errText(m.errors[0]!.code)); return; }
    setBusy(true);
    try {
      if (row && opened) {
        const was = sectionFromForm(opened);
        const patch = was.ok ? changed(was.value, m.value) : m.value;
        patchRow('sections', row.id, patch, { now: true });
        onClose();
      } else { await addSection(m.value, newSectionId); onClose(); }
    } catch (e) { setError(errText(toV2Error(e).code)); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { await removeRows('sections', [row!.id]); setDel(false); onClose(); }
    catch (e) { setError(errText(toV2Error(e).code)); setDel(false); }
    finally { setBusy(false); }
  }
  const nameField = L === 'he' ? 'nameHe' : 'nameEn';
  const confirmKey = dishes === 0 ? 'menu.cat.deleteConfirm0' : dishes === 1 ? 'menu.cat.deleteConfirm1' : 'menu.cat.deleteConfirm';
  return (
    <Sheet open onClose={onClose} title={row ? t('menu.cat.edit') : t('menu.addCategory')} name="section" side head={<LangSeg value={L} onChange={setL} langs={langs} />}
      foot={<>{row && <Btn kind="ghost" icon="trash" onClick={() => setDel(true)} data-action="delete-section">{t('app.delete')}</Btn>}
        <Btn kind="primary" busy={busy} onClick={save} data-action="save-section">{row ? t('app.save') : t('menu.cat.add')}</Btn></>}>
      <SaveFailedLine />
      <Field label={t('menu.cat.name') + ' · ' + t('app.' + L)} error={nameErr}>{(p) => (
        <input {...p} type="text" dir="auto" lang={L} maxLength={60} value={form[nameField]} data-field={'section-name-' + L}
          onInput={(e) => set({ [nameField]: (e.target as HTMLInputElement).value } as Partial<SectionForm>)} />
      )}</Field>
      <fieldset class="tags">
        <legend>{t('menu.cat.kind')}</legend>
        <div class="kindchips" role="radiogroup" aria-label={t('menu.cat.kind')}>
          {SECTION_KINDS.map((k) => <button key={k} type="button" role="radio" class="kindchip" aria-checked={form.kind === k ? 'true' : 'false'} onClick={() => set({ kind: k })} data-kind={k}>
            <Icon name={k} size={18} />{t('kindc.' + k)}</button>)}
        </div>
      </fieldset>
      <Field label={t('room.label')} hint={t('room.hint')}>{(p) => (
        <select {...p} value={form.room ?? ''} data-field="room" onChange={(e) => { const v = (e.target as HTMLSelectElement).value; set({ room: v === '' ? null : (v as SectionForm['room']) }); }}>
          <option value="">{t('room.auto')}</option>
          {ROOMS.map((r) => <option key={r} value={r}>{t('room.' + r)}</option>)}
        </select>
      )}</Field>
      <Field label={t('dish.daypart')} hint={d.schedules.length ? t('menu2.sectionPartHint') : t('dish.daypart.none')}>{(p) => (
        <select {...p} value={form.scheduleId ?? ''} disabled={!d.schedules.length} data-field="section-daypart" onChange={(e) => set({ scheduleId: (e.target as HTMLSelectElement).value || null })}>
          <option value="">{t('dish.daypart.always')}</option>
          {d.schedules.map((s) => <option key={s.id} value={s.id}>{named(s, lang.value)}</option>)}
        </select>
      )}</Field>
      <a class="linkbtn" href="#/hours/parts" data-link="dayparts"><Icon name="clock" size={16} /><span>{t('parts.manage')}</span></a>
      <div class="switchrow"><span>{t('ed.hide')}</span><Switch checked={form.hidden} onChange={(v) => set({ hidden: v })} label={t('ed.hide')} /></div>
      {error && <Note kind="error">{error}</Note>}
      <Confirm open={del} title={t('menu.cat.delete')} body={t(confirmKey, { name: named(row, lang.value), n: dishes })} confirmLabel={t('app.delete')} danger busy={busy}
        onConfirm={remove} onClose={() => setDel(false)} />
    </Sheet>
  );
}
