// Opening hours, closed dates, and the day parts and specials sections and dishes follow (F05, Hopa H43, H47–H48), on
// the venue's clock (Asia/Jerusalem). "Open now" is what the guest's phone reads: the contracts' isOpenAt and nextOpening
// over the same rows public_menu sends, and like them it changes at once, without a publish. A day can have several
// windows (07:00–11:00 and 17:00–22:00); a window may run past midnight. #/hours is the week, #/hours/parts the
// schedules, #/hours/parts/<id> (or new, new-special) one schedule in a sheet. A counter sees all of it read-only.
//
// Opening hours and closed dates have no `updated_at` (the schema's): a window's new times are stored only while it still
// has the times this screen read (`saveHours`); a closed date is only added or deleted. A day part saves like a dish:
// only what changed since the sheet opened, guarded by `updated_at`, and a conflict asks the owner (conflict.tsx).
import { useEffect, useRef, useState } from 'preact/hooks';
import { isClosedOn, isOpenAt, localParts, nextOpening, type ScheduleKind, type VenueHoursRow, type Weekday } from '@mana/contracts';
import { Btn, Confirm, Empty, Field, Icon, IconBtn, Note, PageHead, Seg, Sheet, go } from '../../ui.tsx';
import { toast } from '../../lib/store.ts';
import { toV2Error } from '../data/errors.ts';
import { changed, type FieldError } from '../data/forms.ts';
import {
  WEEK, closureFromForm, dayHours, hhmm, hoursFromForm, isAllDay, newClosureForm, newScheduleForm, newWindowForm, scheduleFromForm, scheduleToForm, upcomingClosures,
  venueHoursOf, type ClosureForm, type ScheduleForm, type WindowForm,
} from '../data/hours.ts';
import { clock } from '../data/live.ts';
import { byCreated, named, newId } from '../data/rows.ts';
import { ANY_ROW, addRows, canEdit, menu, refreshHours, removeRows, resync, saveHours, saveNow, saveVenue } from '../data/store.ts';
import { langsOf } from '../format.ts';
import { errText, lang, t, tn } from '../i18n.ts';
import { LangSeg, ReadOnly, TabPanel, Tabs, useEditOnly, useEntryLang } from '../ui.tsx';
import { dateText, dayName, daysText, momentText, timeRange } from '../words.ts';

export function HoursScreen({ rest }: { rest: string[] }) {
  const d = menu.value!;
  const tab = rest[0] === 'parts' ? 'parts' : 'week';
  const editable = canEdit();
  // a new day part or special only edits: an account that may not edit is taken back to the list
  useEditOnly(tab === 'parts' && !!rest[1]?.startsWith('new'), editable, 'hours/parts');
  // hours and closed dates have no version to guard with: read them again when the screen opens and when it comes back
  // into view, so another device's change shows (and "open now" with it)
  useEffect(() => {
    const again = () => { if (document.visibilityState === 'visible') refreshHours().catch(() => {}); };
    again();
    window.addEventListener('focus', again);
    document.addEventListener('visibilitychange', again);
    return () => { window.removeEventListener('focus', again); document.removeEventListener('visibilitychange', again); };
  }, []);
  return (
    <div class="page page-hours" data-screen="hours">
      <PageHead title={t('hours.title')} />
      {!editable && <Note>{t('ro.settings')}</Note>}
      <Tabs label={t('hours.tabs')} value={tab} onChange={(k) => go(k === 'parts' ? 'hours/parts' : 'hours', true)}
        tabs={[{ key: 'week', label: t('hours.tab.week') }, { key: 'parts', label: t('hours.tab.parts'), badge: d.schedules.length }]} />
      <TabPanel id={tab}>{tab === 'week' ? <Week /> : <Parts open={rest[1] ?? null} />}</TabPanel>
    </div>
  );
}

/** The day chips: a group of toggles, Sunday first, and "every day". */
export function DayChips({ days, onChange, label, id, disabled }: { days: readonly Weekday[]; onChange: (d: Weekday[]) => void; label: string; id?: string; disabled?: boolean }) {
  const all = days.length === WEEK.length;
  return (
    <div class="daychips" role="group" aria-label={label} data-days={id}>
      {WEEK.map((d) => {
        const on = days.includes(d);
        return <button key={d} type="button" class="daychip" aria-pressed={on ? 'true' : 'false'} aria-label={dayName(d, true)} data-day={d} disabled={disabled}
          onClick={() => onChange(on ? days.filter((x) => x !== d) : WEEK.filter((x) => x === d || days.includes(x)))}>{dayName(d)}</button>;
      })}
      <button type="button" class="linkbtn daychip-all" aria-pressed={all ? 'true' : 'false'} disabled={disabled} onClick={() => onChange(all ? [] : [...WEEK])} data-day="all">{t('days.every')}</button>
    </div>
  );
}

/** From and to, as the phone's time pickers. */
export function TimePair({ from, to, onFrom, onTo, id, disabled, of, allDay }: {
  from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void; id: string; disabled?: boolean;
  /** Which one this is, when there are several (said after the field's name: "From · Time 2"). */
  of?: string;
  /** Opening hours: the same time twice says it is the full 24 hours (a rule refuses it instead). */
  allDay?: boolean;
}) {
  const sfx = of ? ' · ' + of : '';
  return (
    <div class="timepair" data-times={id}>
      <Field label={t('hours.from') + sfx}>{(p) => <input {...p} type="time" dir="ltr" value={from} disabled={disabled} data-field={id + '-from'} onInput={(e) => onFrom((e.target as HTMLInputElement).value)} />}</Field>
      <Field label={t('hours.to') + sfx}>{(p) => <input {...p} type="time" dir="ltr" value={to} disabled={disabled} data-field={id + '-to'} onInput={(e) => onTo((e.target as HTMLInputElement).value)} />}</Field>
      {allDay && isAllDay(from, to) && <p class="hint timepair-hint" data-all-day>{t('hours.allDay')}</p>}
    </div>
  );
}

const firstError = (errors: readonly FieldError[]) => (errors.length ? errText(errors[0]!.code) : '');

// ---------------------------------------------------------------- the week
function Week() {
  const d = menu.value!;
  const editable = canEdit();
  return (
    <>
      <NowCard />
      <section class="card" aria-labelledby="week-h" data-week>
        <h2 id="week-h">{t('hours.week')}</h2>
        <p class="hint">{t('hours.weekHint')}</p>
        <p class="fine" data-live-note>{t('hours.live')}</p>
        <ul class="weekdays">{WEEK.map((day) => <DayRow key={day} day={day} rows={dayHours(d.hours, day)} editable={editable} />)}</ul>
        {editable && <AddHours />}
      </section>
      <Closures />
      <SoldOutCard />
    </>
  );
}

/** Open or closed now, as the guest's phone will say it. */
function NowCard() {
  const d = menu.value!, now = clock.value, tz = d.venue.time_zone;
  const hours = venueHoursOf(tz, d.hours, d.closures);
  const none = hours.weekly.length === 0;
  const open = isOpenAt(hours, now);
  const next = open ? null : nextOpening(hours, now);
  const today = localParts(now, tz).date;
  const closure = isClosedOn(hours.closures, today) ? d.closures.find((c) => c.from_date <= today && today <= c.to_date) : null;
  const note = closure ? (lang.value === 'he' ? closure.note_he || closure.note_en : closure.note_en || closure.note_he) : '';
  return (
    <section class="card nowcard" aria-labelledby="now-h" data-open-now={none ? 'always' : open ? 'open' : 'closed'}>
      <h2 id="now-h" class="status"><span class={'dot ' + (open ? 'dot-on' : 'dot-off')} aria-hidden="true" />{none ? t('hours.none') : open ? t('hours.openNow') : t('hours.closedNow')}</h2>
      {none && <p>{t('hours.noneBody')}</p>}
      {!none && !open && <p data-next-opening>{next ? t('hours.opensAt', { when: momentText(next, now, tz, true) }) : t('hours.noOpening')}</p>}
      {/* open now from last night's hours, on a closed date: it closes when they end (never "open" beside "closed today") */}
      {closure && <p class="fine" data-closed-today>{open ? (note ? t('hours.closesTodayFor', { note }) : t('hours.closesToday')) : note ? t('hours.closedTodayFor', { note }) : t('hours.closedToday')}</p>}
    </section>
  );
}

function DayRow({ day, rows, editable }: { day: Weekday; rows: VenueHoursRow[]; editable: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <li class="weekday" data-day={day}>
      <div class="weekday-line">
        <span class="weekday-name">{dayName(day, true)}</span>
        <span class="weekday-hours">
          {rows.length === 0 && <span class="muted" data-closed>{t('hours.closed')}</span>}
          {rows.map((r) => {
            const range = timeRange(hhmm(r.opens), hhmm(r.closes));
            return editable
              ? <button key={r.id} type="button" class="chip hourchip" aria-expanded={editing === r.id ? 'true' : 'false'} aria-label={t('hours.edit', { day: dayName(day, true), range })}
                  onClick={() => setEditing(editing === r.id ? null : r.id)} data-hours={r.id}>{range}</button>
              : <span key={r.id} class="chip hourchip" data-hours={r.id}>{range}</span>;
          })}
        </span>
      </div>
      {editing && rows.some((r) => r.id === editing) && <WindowEditor key={editing} row={rows.find((r) => r.id === editing)!} onDone={() => setEditing(null)} />}
    </li>
  );
}

/** One opening window: change its times or remove it. */
function WindowEditor({ row, onDone }: { row: VenueHoursRow; onDone: () => void }) {
  const d = menu.value!;
  // the window as this editor read it: the save is guarded on its updated_at, so a change made on another device while
  // the editor is open is never written over without the owner's say
  const [opened, setOpened] = useState(row);
  const [from, setFrom] = useState(hhmm(row.opens)), [to, setTo] = useState(hhmm(row.closes));
  const [error, setError] = useState(''), [busy, setBusy] = useState('');
  // read again meanwhile (the screen came back into view, another tab): the editor says so at once
  const movedElsewhere = row.updated_at !== opened.updated_at;
  async function save() {
    const m = hoursFromForm([row.weekday], from, to, d.hours, row.id);
    if (!m.ok) { setError(firstError(m.errors)); return; }
    setBusy('save');
    try { await saveHours(row.id, { opens: from, closes: to }, opened.updated_at); onDone(); }
    catch (e) {
      const code = toV2Error(e).code;
      // changed on another device meanwhile: nothing was written; the times as stored now, to change again
      const now = code === 'stale' ? menu.value?.hours.find((h) => h.id === row.id) : null;
      if (now) { setOpened(now); setFrom(hhmm(now.opens)); setTo(hhmm(now.closes)); }
      setError(errText(code));
    }
    finally { setBusy(''); }
  }
  async function remove() {
    setBusy('remove');
    try { await removeRows('venue_hours', [row.id]); onDone(); }
    catch (e) { setError(errText(toV2Error(e).code)); setBusy(''); }
  }
  return (
    <div class="hoursedit" data-hours-edit={row.id}>
      {movedElsewhere && <p class="line line-warn" role="status" data-hours-changed>
        <Icon name="alert" /><span>{t('hours.changedElsewhere', { range: timeRange(hhmm(row.opens), hhmm(row.closes)) })}</span></p>}
      <TimePair id="edit" allDay from={from} to={to} onFrom={(v) => { setFrom(v); setError(''); }} onTo={(v) => { setTo(v); setError(''); }} />
      {error && <p class="ferr" role="alert">{error}</p>}
      <div class="btnrow">
        <Btn small kind="primary" busy={busy === 'save'} onClick={save} data-action="save-hours">{t('app.save')}</Btn>
        <Btn small kind="ghost" icon="trash" busy={busy === 'remove'} onClick={remove} data-action="remove-hours">{t('hours.remove')}</Btn>
        <Btn small kind="ghost" onClick={onDone}>{t('app.cancel')}</Btn>
      </div>
    </div>
  );
}

/** Hours on several days at once (one statement: all of them or none). */
function AddHours() {
  const d = menu.value!;
  const [open, setOpen] = useState(false), [days, setDays] = useState<Weekday[]>([]), [from, setFrom] = useState('08:00'), [to, setTo] = useState('17:00');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  // the new windows' ids, one per day: kept until they are stored, so trying again after a lost answer adds none twice
  const ids = useRef(new Map<Weekday, string>());
  if (!open) return <Btn icon="plus" onClick={() => setOpen(true)} data-action="add-hours">{t('hours.add')}</Btn>;
  async function add() {
    setBusy(true);
    // against the hours as stored now (another device may have added some)
    await refreshHours().catch(() => {});
    // an earlier try whose answer was lost is stored: the same hours are done; other hours are not stored over it, but said
    const landed = [...ids.current.values()].map((id) => menu.value!.hours.find((h) => h.id === id)).filter((h) => !!h);
    if (landed.length) {
      ids.current.clear();
      const same = landed.length === days.length && landed.every((h) => days.includes(h!.weekday) && hhmm(h!.opens) === from && hhmm(h!.closes) === to);
      if (same) { toast(t('hours.added', { days: daysText(days), range: timeRange(from, to) })); setDays([]); setOpen(false); }
      else setError(errText('stored_earlier'));
      setBusy(false);
      return;
    }
    const m = hoursFromForm(days, from, to, menu.value!.hours);
    if (!m.ok) { setError(firstError(m.errors)); setBusy(false); return; }
    try {
      const idOf = (w: Weekday) => { if (!ids.current.has(w)) ids.current.set(w, newId()); return ids.current.get(w)!; };
      await addRows('venue_hours', m.value.map((r) => ({ id: idOf(r.weekday), ...r })));
      ids.current.clear();
      toast(t('hours.added', { days: daysText(days), range: timeRange(from, to) }));
      setDays([]); setOpen(false);
    } catch (e) {
      const code = toV2Error(e).code;
      // the earlier try is stored (on screen now, in the week); a next try is a new window
      if (code === 'stored_earlier') ids.current.clear();
      setError(errText(code));
    }
    finally { setBusy(false); }
  }
  return (
    <div class="card-in hoursadd" data-hours-add>
      <h3>{t('hours.add')}</h3>
      <DayChips id="add" days={days} label={t('hours.days')} onChange={(x) => { setDays(x); setError(''); }} />
      <TimePair id="add" allDay from={from} to={to} onFrom={(v) => { setFrom(v); setError(''); }} onTo={(v) => { setTo(v); setError(''); }} />
      <p class="hint">{t('hours.overnight')}</p>
      {error && <p class="ferr" role="alert">{error}</p>}
      <div class="btnrow">
        <Btn kind="primary" busy={busy} onClick={add} data-action="save-new-hours">{t('hours.addGo')}</Btn>
        <Btn kind="ghost" onClick={() => { setOpen(false); setError(''); }}>{t('app.cancel')}</Btn>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- closed dates
function Closures() {
  const d = menu.value!;
  const editable = canEdit();
  const today = localParts(clock.value, d.venue.time_zone).date;
  const rows = upcomingClosures(d.closures, today);
  const [adding, setAdding] = useState(false), [form, setForm] = useState<ClosureForm>(() => newClosureForm(today));
  const [error, setError] = useState(''), [busy, setBusy] = useState(''), [del, setDel] = useState<{ id: string; when: string } | null>(null);
  // the new closed date's id: kept until it is stored (a retry after a lost answer adds it once)
  const [nextId, setNextId] = useState(newId);
  const L = lang.value;
  const noteKey = L === 'he' ? 'noteHe' : 'noteEn';
  async function add() {
    const m = closureFromForm(form);
    if (!m.ok) { setError(firstError(m.errors)); return; }
    setBusy('add');
    try { await addRows('venue_closures', [{ id: nextId, ...m.value }]); setNextId(newId()); setAdding(false); setForm(newClosureForm(today)); }
    catch (e) { setError(errText(toV2Error(e).code)); }
    finally { setBusy(''); }
  }
  async function remove(id: string) {
    setBusy(id);
    try { await removeRows('venue_closures', [id]); }
    catch (e) { toast(errText(toV2Error(e).code), 'error'); }
    finally { setBusy(''); setDel(null); }
  }
  const span = (from: string, to: string) => (from === to ? dateText(from) : t('closures.range', { from: dateText(from), to: dateText(to) }));
  return (
    <section class="card" aria-labelledby="closures-h" data-closures>
      <h2 id="closures-h">{t('closures.title')}</h2>
      <p class="hint">{t('closures.lead')}</p>
      {rows.length === 0 && <p class="muted">{t('closures.none')}</p>}
      {rows.length > 0 && <ul class="rows">{rows.map((c) => {
        const when = span(c.from_date, c.to_date), note = L === 'he' ? c.note_he || c.note_en : c.note_en || c.note_he;
        return (
          <li key={c.id} class="row" data-closure={c.id}>
            <div class="attached-main">
              <span class="row-text"><span class="row-name">{when}</span>{note && <span class="row-sub fine">{note}</span>}</span>
              {editable && <IconBtn icon="trash" label={t('closures.remove', { when })} disabled={busy === c.id} onClick={() => setDel({ id: c.id, when })} data-remove-closure={c.id} />}
            </div>
          </li>
        );
      })}</ul>}
      {editable && !adding && <Btn icon="plus" onClick={() => { setAdding(true); setError(''); }} data-action="add-closure">{t('closures.add')}</Btn>}
      {adding && editable && (
        <div class="card-in" data-closure-add>
          <div class="grid2">
            <Field label={t('closures.from')}>{(p) => <input {...p} type="date" dir="ltr" value={form.from} min={today} data-field="closure-from" onInput={(e) => { setForm({ ...form, from: (e.target as HTMLInputElement).value }); setError(''); }} />}</Field>
            <Field label={t('closures.to')} hint={t('closures.toHint')} optional>{(p) => <input {...p} type="date" dir="ltr" value={form.to} min={form.from || today} data-field="closure-to" onInput={(e) => { setForm({ ...form, to: (e.target as HTMLInputElement).value }); setError(''); }} />}</Field>
          </div>
          <Field label={t('closures.note')} hint={t('closures.noteHint')} optional>{(p) => (
            <input {...p} type="text" dir="auto" maxLength={80} value={form[noteKey]} data-field="closure-note" onInput={(e) => setForm({ ...form, [noteKey]: (e.target as HTMLInputElement).value })} />
          )}</Field>
          {error && <p class="ferr" role="alert">{error}</p>}
          <div class="btnrow">
            <Btn kind="primary" busy={busy === 'add'} onClick={add} data-action="save-closure">{t('hours.addGo')}</Btn>
            <Btn kind="ghost" onClick={() => setAdding(false)}>{t('app.cancel')}</Btn>
          </div>
        </div>
      )}
      <Confirm open={!!del} title={t('closures.removeTitle')} body={t('closures.removeConfirm', { when: del?.when ?? '' })} confirmLabel={t('closures.removeGo')} danger
        busy={!!del && busy === del.id} onConfirm={() => del && remove(del.id)} onClose={() => setDel(null)} />
    </section>
  );
}

/** What guests see of something unavailable: greyed at the end of its section (never orderable), or hidden. */
function SoldOutCard() {
  const d = menu.value!;
  const v = d.venue.sold_out_display;
  const [error, setError] = useState('');
  return (
    <section class="card" aria-labelledby="soldout-h" data-soldout={v}>
      <h2 id="soldout-h">{t('soldout.title')}</h2>
      {canEdit()
        ? <Seg value={v} label={t('soldout.title')} onChange={(x) => { setError(''); saveVenue({ sold_out_display: x }).catch((e) => setError(errText(toV2Error(e).code))); }}
            options={[{ value: 'bottom', label: t('soldout.bottom') }, { value: 'hide', label: t('soldout.hide') }]} />
        : <p class="strong">{t('soldout.' + v)}</p>}
      <p class="hint">{t('off.guests.' + v)} {t('soldout.publish')}</p>
      {error && <Note kind="error">{error}</Note>}
    </section>
  );
}

// ---------------------------------------------------------------- day parts and specials
const windowsText = (ws: readonly { days: readonly Weekday[]; from: string; to: string }[]) => ws.map((w) => daysText(w.days) + ' ' + timeRange(w.from, w.to)).join(' · ');

function usedBy(id: string) {
  const d = menu.value!;
  return { sections: d.sections.filter((s) => s.schedule_id === id), dishes: d.dishes.filter((x) => x.schedule_id === id) };
}
function usedText(id: string): string {
  const u = usedBy(id);
  if (!u.sections.length && !u.dishes.length) return t('parts.unused');
  return [u.sections.length && tn('parts.sections', u.sections.length), u.dishes.length && tn('parts.dishes', u.dishes.length)].filter(Boolean).join(' · ');
}

function Parts({ open }: { open: string | null }) {
  const d = menu.value!, L = lang.value;
  const editable = canEdit();
  const list = byCreated(d.schedules);
  const buttons = editable && <div class="btnrow">
    <Btn icon="plus" kind={list.length ? 'secondary' : 'primary'} onClick={() => go('hours/parts/new')} data-action="new-daypart">{t('parts.newDayPart')}</Btn>
    <Btn icon="plus" onClick={() => go('hours/parts/new-special')} data-action="new-special">{t('parts.newSpecial')}</Btn>
  </div>;
  return (
    <>
      <p class="lead">{t('parts.lead')}</p>
      <p class="fine" data-publish-note>{t('parts.publish')}</p>
      {list.length === 0 && <Empty title={t('parts.empty.title')} body={t('parts.empty.body')} icon="clock">{buttons}</Empty>}
      {list.length > 0 && <>
        <ul class="rows">{list.map((s) => (
          <li key={s.id} class="row" data-schedule={s.id}>
            <a class="row-main" href={'#/hours/parts/' + s.id}>
              <span class="row-text">
                <span class="row-name">{named(s, L) || t('menu2.unnamed')}</span>
                <span class="row-sub"><span class="badge badge-todo">{t('parts.kind.' + s.kind)}</span><span>{windowsText(s.windows)}</span></span>
                <span class="row-sub fine">{usedText(s.id)}</span>
              </span>
              <Icon name="chev" size={18} flip />
            </a>
          </li>
        ))}</ul>
        {buttons}
      </>}
      {open && (editable || !open.startsWith('new')) && <ScheduleSheet key={open} id={open.startsWith('new') ? null : open} kind={open === 'new-special' ? 'special' : 'day_part'} onClose={() => go('hours/parts')} />}
    </>
  );
}

function ScheduleSheet({ id, kind, onClose }: { id: string | null; kind: ScheduleKind; onClose: () => void }) {
  const d = menu.value!, UI = lang.value;
  const row = id ? d.schedules.find((s) => s.id === id) : null;
  const langs = langsOf(d.venue);
  const [L, setL] = useEntryLang(langs);
  // what the sheet opened with: only what the owner changed here is saved (a change made elsewhere meanwhile stays)
  const [opened, setOpened] = useState<ScheduleForm>(() => (row ? scheduleToForm(row) : newScheduleForm(kind)));
  const [form, setForm] = useState<ScheduleForm>(opened);
  const [newScheduleId] = useState(newId);
  const [errors, setErrors] = useState<readonly FieldError[]>([]), [error, setError] = useState('');
  const [busy, setBusy] = useState(false), [del, setDel] = useState(false);
  const editable = canEdit();
  const dirty = JSON.stringify(form) !== JSON.stringify(opened);
  // the schedule as stored again (the owner's choice in a conflict, a refusal; the menu read again while nothing is typed)
  useEffect(() => {
    const r = resync.value;
    if (!r || !row) return;
    const ours = r.table === 'schedules' && r.id === row.id;
    if (!ours && (r.id !== ANY_ROW || dirty)) return;
    const f = scheduleToForm(row); setForm(f); setOpened(f); setErrors([]);
  }, [resync.value]);
  if (id && !row) return <Sheet open onClose={onClose} title={t('parts.title')} name="schedule"><p class="muted">{t('item.notFound')}</p></Sheet>;
  const nameKey = L === 'he' ? 'nameHe' : 'nameEn';
  const set = (f: ScheduleForm) => { setForm(f); setErrors([]); setError(''); };
  const setWin = (i: number, patch: Partial<WindowForm>) => set({ ...form, windows: form.windows.map((w, j) => (j === i ? { ...w, ...patch } : w)) });
  const errAt = (field: string) => { const e = errors.find((x) => x.field === field || x.field.startsWith(field + '.') || x.field.startsWith(field + '_')); return e ? (e.code === 'name_missing' ? t('e.name_missing') : errText(e.code)) : undefined; };
  const u = row ? usedBy(row.id) : { sections: [], dishes: [] };

  async function save() {
    const m = scheduleFromForm(form);
    if (!m.ok) { setErrors(m.errors); return; }
    setBusy(true);
    try {
      if (row) {
        const was = scheduleFromForm(opened);
        const patch = was.ok ? changed(was.value, m.value) : m.value;
        // read again while open, and a column the owner changed moved elsewhere too: shown as stored, nothing written
        const stored = scheduleFromForm(scheduleToForm(row));
        if (was.ok && stored.ok && Object.keys(patch).some((k) => JSON.stringify(stored.value[k as keyof typeof patch]) !== JSON.stringify(was.value[k as keyof typeof patch]))) {
          const f = scheduleToForm(row); setForm(f); setOpened(f); setError(errText('stale')); return;
        }
        // 'conflict': changed somewhere else; the dialog asks, the sheet stays and follows the owner's choice (resync)
        if (await saveNow('schedules', row.id, patch) === 'conflict') return;
      } else {
        try { await addRows('schedules', [{ id: newScheduleId, ...m.value }]); }
        catch (e) {
          // an earlier try was stored (its answer was lost): the sheet's values go over it (guarded), then it closes
          if (toV2Error(e).code !== 'stored_earlier') throw e;
          const had = menu.value?.schedules.find((x) => x.id === newScheduleId);
          const then = had ? scheduleFromForm(scheduleToForm(had)) : null;
          if (had && then?.ok && await saveNow('schedules', newScheduleId, changed(then.value, m.value)) === 'conflict') return;
        }
      }
      toast(t('parts.saved')); onClose();
    } catch (e) { setError(errText(toV2Error(e).code)); }
    finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { await removeRows('schedules', [row!.id]); setDel(false); onClose(); }
    catch (e) { setError(errText(toV2Error(e).code)); setDel(false); }
    finally { setBusy(false); }
  }
  const n = u.sections.length + u.dishes.length;
  return (
    <Sheet open onClose={onClose} title={row ? named(row, UI) || t('parts.title') : t(kind === 'special' ? 'parts.newSpecial' : 'parts.newDayPart')} name="schedule" side tall
      head={<LangSeg value={L} onChange={setL} langs={langs} />}
      foot={editable && <>{row && <Btn kind="ghost" icon="trash" onClick={() => setDel(true)} data-action="delete-schedule">{t('app.delete')}</Btn>}
        <Btn kind="primary" busy={busy} onClick={save} data-action="save-schedule">{row ? t('app.save') : t('parts.create')}</Btn></>}>
      {!editable && <Note>{t('ro.settings')}</Note>}
      <ReadOnly when={!editable} class="schedule-form">
      <Field label={t('parts.name') + ' · ' + t('app.' + L)} hint={t('parts.nameHint')} error={errAt('name')}>{(p) => (
        <input {...p} type="text" dir="auto" lang={L} maxLength={60} value={form[nameKey]} disabled={!editable} data-field={'schedule-name-' + L} onInput={(e) => set({ ...form, [nameKey]: (e.target as HTMLInputElement).value })} />
      )}</Field>
      <div class="field"><span class="flabel">{t('parts.kind')}</span>
        <Seg value={form.kind} label={t('parts.kind')} disabled={!editable} onChange={(k) => set({ ...form, kind: k })} options={[{ value: 'day_part', label: t('parts.kind.day_part') }, { value: 'special', label: t('parts.kind.special') }]} />
        <p class="hint">{t('parts.kindHint.' + form.kind)}</p>
      </div>
      <fieldset class="windows">
        <legend>{t('parts.when')}</legend>
        {form.windows.map((w, i) => (
          <div key={w.key} class="windowcard" data-window={i}>
            <DayChips id={'w' + i} days={w.days} label={t('hours.days') + ' · ' + t('parts.windowN', { n: i + 1 })} disabled={!editable} onChange={(days) => setWin(i, { days })} />
            <TimePair id={'w' + i} from={w.from} to={w.to} disabled={!editable} of={form.windows.length > 1 ? t('parts.windowN', { n: i + 1 }) : undefined} onFrom={(v) => setWin(i, { from: v })} onTo={(v) => setWin(i, { to: v })} />
            {(errAt(`windows.${i}`)) && <p class="ferr" role="alert">{errAt(`windows.${i}`)}</p>}
            {editable && form.windows.length > 1 && <Btn small kind="ghost" icon="trash" aria-label={t('parts.removeTime') + ' · ' + t('parts.windowN', { n: i + 1 })} onClick={() => set({ ...form, windows: form.windows.filter((_, j) => j !== i) })}>{t('parts.removeTime')}</Btn>}
          </div>
        ))}
        {errAt('windows') && !form.windows.length && <p class="ferr" role="alert">{errAt('windows')}</p>}
        {editable && <Btn small icon="plus" onClick={() => set({ ...form, windows: [...form.windows, newWindowForm()] })} data-action="add-window">{t('parts.addTime')}</Btn>}
      </fieldset>
      <div class="grid2">
        <Field label={t('parts.validFrom')} optional error={errAt('validFrom')}>{(p) => <input {...p} type="date" dir="ltr" value={form.validFrom} disabled={!editable} data-field="schedule-from" onInput={(e) => set({ ...form, validFrom: (e.target as HTMLInputElement).value })} />}</Field>
        <Field label={t('parts.validTo')} optional error={errAt('validTo')}>{(p) => <input {...p} type="date" dir="ltr" value={form.validTo} disabled={!editable} data-field="schedule-to" onInput={(e) => set({ ...form, validTo: (e.target as HTMLInputElement).value })} />}</Field>
      </div>
      </ReadOnly>
      {row && <section aria-labelledby="sched-used-h">
        <h3 id="sched-used-h">{t('lib.used')}</h3>
        {n === 0 ? <p class="muted">{t('parts.unusedHint')}</p>
          : <ul class="chips">
            {u.sections.map((s) => <li key={s.id}><a class="chip" href={'#/menu/s/' + s.id}>{named(s, UI)}</a></li>)}
            {u.dishes.map((x) => <li key={x.id}><a class="chip" href={'#/menu/d/' + x.id}>{named(x, UI)}</a></li>)}
          </ul>}
      </section>}
      {error && <Note kind="error">{error}</Note>}
      <Confirm open={del} title={t('parts.delete')} body={n ? tn('parts.deleteUsed', n, { name: named(row, UI) }) : t('parts.deleteConfirm', { name: named(row, UI) })}
        confirmLabel={t('app.delete')} danger busy={busy} onConfirm={remove} onClose={() => setDel(false)} />
    </Sheet>
  );
}
