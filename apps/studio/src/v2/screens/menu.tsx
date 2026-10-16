// The menu: sections in order, each with its dishes; a dish opens in its own sheet (#/menu/d/<id>), a section too
// (#/menu/s/<id>, #/menu/s/new). "Arrange" puts sections and dishes in order, by dragging or with the up and down
// buttons (keyboard and screen readers, each move announced).
import { useEffect, useRef, useState } from 'preact/hooks';
import { ROOMS, SECTION_KINDS, type DishRow, type SectionRow } from '@mana/contracts';
import { Btn, Confirm, Empty, Field, Icon, IconBtn, Note, PageHead, Sheet, Switch, go } from '../../ui.tsx';
import { toast } from '../../lib/store.ts';
import { toV2Error } from '../data/errors.ts';
import { agorotOf, newSectionForm, sectionFromForm, sectionToForm, type SectionForm } from '../data/forms.ts';
import { menuPrice } from '../data/guest.ts';
import { byPosition, named } from '../data/rows.ts';
import { addDish, addSection, canEdit, menu, moveRow, patchRow, removeRows } from '../data/store.ts';
import { langsOf } from '../format.ts';
import { errText, lang, t, tn } from '../i18n.ts';
import { LangSeg, MoneyInput, Price, ReorderList, useEntryLang } from '../ui.tsx';
import { DishSheet } from './dish.tsx';

export function MenuScreen({ rest }: { rest: string[] }) {
  const d = menu.value!;
  const L = lang.value;
  const editable = canEdit();
  const sections = byPosition(d.sections);
  const [arranging, setArranging] = useState(false);
  const [said, setSaid] = useState('');
  const sheetDish = rest[0] === 'd' && rest[1] ? rest[1] : null;
  const sheetSection = rest[0] === 's' && rest[1] ? rest[1] : null;
  const fail = (e: unknown) => toast(errText(toV2Error(e).code), 'error');

  const moveSection = (i: number, to: number) => {
    const p = moveRow('sections', sections, i, to);
    if (p) { p.catch(fail); setSaid(t('menu.moved', { name: named(sections[i], L), n: to + 1 })); }
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
      {!editable && <Note>{t('menu2.readOnly')}</Note>}

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
              {editable && <div class="tools">
                {arranging && <>
                  <IconBtn icon="up" label={t('menu.up', { name })} disabled={si === 0} onClick={() => moveSection(si, si - 1)} />
                  <IconBtn icon="down" label={t('menu.down', { name })} disabled={si === sections.length - 1} onClick={() => moveSection(si, si + 1)} />
                </>}
                <IconBtn icon="edit" label={t('menu.cat.edit') + ': ' + name} onClick={() => go('menu/s/' + sec.id)} />
              </div>}
            </header>
            <ReorderList items={dishes} arranging={arranging && editable} nameOf={(x) => named(x, L)} label={name}
              onMove={(from, to) => { moveRow('dishes', dishes, from, to)?.catch(fail); }}
              render={(x) => <DishLine dish={x} />} />
            {editable && !arranging && <QuickAdd section={sec} />}
          </section>
        );
      })}

      {sheetDish && <DishSheet id={sheetDish} tab={rest[2]} onClose={() => go('menu')} />}
      {sheetSection && <SectionSheet id={sheetSection === 'new' ? null : sheetSection} onClose={() => go('menu')} />}
    </div>
  );
}

function DishLine({ dish }: { dish: DishRow }) {
  const d = menu.value!, L = lang.value;
  const name = named(dish, L) || t('menu2.unnamed');
  const groups = d.dishGroups.filter((a) => a.dish_id === dish.id).length;
  const part = dish.schedule_id ? d.schedules.find((s) => s.id === dish.schedule_id) : null;
  return (
    <a class="row-main" href={'#/menu/d/' + dish.id} aria-label={t('menu.item.edit', { name })} data-dish={dish.id}>
      <span class="row-text">
        <span class="row-name">{name}</span>
        <span class="row-sub">
          <span data-price><Price p={menuPrice(d, dish.id)} /></span>
          {groups > 0 && <span class="badge badge-todo">{tn('menu2.groups', groups)}</span>}
          {part && <span class="badge badge-ok">{named(part, L)}</span>}
          {dish.hidden && <span class="badge badge-warn">{t('menu2.hidden')}</span>}
        </span>
      </span>
      <Icon name="chev" size={18} flip />
    </a>
  );
}

/** A dish in one line: its name (in the place's first language) and a price; the rest in its sheet. */
function QuickAdd({ section }: { section: SectionRow }) {
  const d = menu.value!;
  const entry = langsOf(d.venue)[0] ?? 'he';
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [said, setSaid] = useState('');
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
      await addDish(section.id, { ['name_' + entry]: n, price: p } as Partial<DishRow>);
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
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [nameErr, setNameErr] = useState(''), [del, setDel] = useState(false);
  if (id && !row) return <Sheet open onClose={onClose} title={t('menu.cat.edit')} name="section"><p class="muted">{t('item.notFound')}</p></Sheet>;
  const dishes = row ? d.dishes.filter((x) => x.section_id === row.id).length : 0;
  const set = (patch: Partial<SectionForm>) => { setForm({ ...form, ...patch }); setError(''); setNameErr(''); };

  async function save() {
    const m = sectionFromForm(form);
    if (!m.ok) { if (m.errors.some((x) => x.field === 'name')) setNameErr(t('menu.cat.nameMissing')); else setError(errText(m.errors[0]!.code)); return; }
    setBusy(true);
    try {
      if (row) { patchRow('sections', row.id, m.value, { now: true }); onClose(); }
      else { await addSection(m.value); onClose(); }
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
      <div class="switchrow"><span>{t('ed.hide')}</span><Switch checked={form.hidden} onChange={(v) => set({ hidden: v })} label={t('ed.hide')} /></div>
      {error && <Note kind="error">{error}</Note>}
      <Confirm open={del} title={t('menu.cat.delete')} body={t(confirmKey, { name: named(row, lang.value), n: dishes })} confirmLabel={t('app.delete')} danger busy={busy}
        onConfirm={remove} onClose={() => setDel(false)} />
    </Sheet>
  );
}
