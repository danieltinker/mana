// Availability from the phone (F05, Hopa H50–H51), two taps from the menu: the row's button opens this sheet, a choice
// takes the dish off: for an hour, two, until the next opening, until a time today, until a date, or until brought
// back; each choice says when it comes back before the tap, and it comes back by itself at that minute. A dish's add-on
// choices and whole groups are one tap further. The red marker says what is off now and until when.
//
// The "back at" beside each choice is worked out on a clock read every second while the sheet is open (the screens'
// own clock moves only every minute or so), so the minute shown is the minute the database stores; after the tap the
// stored moment is what the toast says.
import { useEffect, useState } from 'preact/hooks';
import { addDays, isHHMM, isLocalDate, localParts, nextOpening, type TargetKind } from '@mana/contracts';
import { Btn, Note, Sheet } from '../../ui.tsx';
import { toast } from '../../lib/store.ts';
import { UNTIL_CHOICES, backAt, offState, untilSpecOf, type OffState, type OffTarget, type UntilChoice } from '../data/availability.ts';
import { toV2Error } from '../data/errors.ts';
import { venueHoursOf } from '../data/hours.ts';
import { bringBack, clock, offNow, takeOff } from '../data/live.ts';
import { byPosition, named } from '../data/rows.ts';
import { attachedTo, canEdit, canOperate, menu } from '../data/store.ts';
import { errText, lang, t } from '../i18n.ts';
import { momentText } from '../words.ts';

type Kind = TargetKind | 'group';
const KINDS: readonly Kind[] = ['section', 'dish', 'option', 'group'];

/** Is it off now, and until when (a dish is also off while its section is). */
export function stateOf(kind: TargetKind, id: string): OffState {
  const d = menu.value!;
  const sectionId = kind === 'dish' ? d.dishes.find((x) => x.id === id)?.section_id ?? null : null;
  return offState({ kind, id, sectionId }, offNow(), clock.value);
}

/** "Unavailable until 15:30", "… until tomorrow 07:00", "… until you bring it back", "… with its section". */
export function offText(s: OffState): string {
  if (!s.off) return t('off.state.on');
  if (s.withSection) return t('off.state.section');
  return s.back ? t('off.state.until', { when: momentText(s.back, clock.value, menu.value!.venue.time_zone) }) : t('off.state.indefinite');
}

/** The red marker on anything off now. */
export function OffBadge({ kind, id }: { kind: TargetKind; id: string }) {
  const s = stateOf(kind, id);
  return s.off ? <span class="badge badge-out" data-off={id}>{offText(s)}</span> : null;
}

/** A group's choices, and how many of them are off now. */
function groupOff(id: string): { n: number; of: number } {
  const options = menu.value!.options.filter((o) => o.group_id === id);
  return { n: options.filter((o) => stateOf('option', o.id).off).length, of: options.length };
}

function nameOf(kind: Kind, id: string): string | null {
  const d = menu.value!, L = lang.value;
  const row = kind === 'section' ? d.sections.find((x) => x.id === id) : kind === 'dish' ? d.dishes.find((x) => x.id === id)
    : kind === 'option' ? d.options.find((x) => x.id === id) : d.groups.find((x) => x.id === id);
  return row ? named(row, L) || t('menu2.unnamed') : null;
}

/** Now, read again every second while a sheet that shows moments is open. */
function useSecondClock(): [number, () => void] {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  return [now, () => setNow(Date.now())];
}

/** The next frame: what the sheet shows is on screen before the call goes. */
const painted = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** A dish's section, when it is off now. */
function sectionOff(kind: Kind, id: string): boolean {
  if (kind !== 'dish') return false;
  const sec = menu.value!.dishes.find((x) => x.id === id)?.section_id;
  return !!sec && stateOf('section', sec).off;
}

export function OffSheet({ kind, id, onClose }: { kind: string; id: string; onClose: () => void }) {
  const d = menu.value!;
  const [now, readClock] = useSecondClock(), tz = d.venue.time_zone;
  const k = KINDS.includes(kind as Kind) ? (kind as Kind) : null;
  const name = k ? nameOf(k, id) : null;
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [open, setOpen] = useState<'time' | 'date' | null>(null);
  const [time, setTime] = useState(''), [date, setDate] = useState(() => addDays(localParts(now, tz).date, 1));
  if (!k || name === null) return <Sheet open onClose={onClose} title={t('off.title')} name="off"><p class="muted">{t('item.notFound')}</p></Sheet>;
  const target: OffTarget = { kind: k, id };
  const hours = venueHoursOf(tz, d.hours, d.closures);
  const state = k === 'group' ? null : stateOf(k, id);
  const group = k === 'group' ? groupOff(id) : null;
  const isOff = state ? state.off && !state.withSection : group!.n > 0;
  const withSection = sectionOff(k, id);
  const operate = canOperate();
  const when = (at: Date | null) => (at ? t('off.backAt', { when: momentText(at, now, tz) }) : t('off.never'));
  // "until the next opening" looks two weeks ahead (the contracts' nextOpening): past that, a date is asked for instead
  const noOpening = hours.weekly.length > 0 && nextOpening(hours, now) === null;

  async function apply(choice: UntilChoice, value = '') {
    if (busy) return;
    setBusy(choice); setError('');
    try {
      // the clock read again just before the call, so the moment on screen is the one sent for (at :59.8 the minute
      // can still turn on the way: the toast says the moment stored)
      readClock(); await painted();
      const until = await takeOff(target, untilSpecOf(choice, value));
      toast(name + ': ' + (until ? t('off.state.until', { when: momentText(new Date(until), Date.now(), tz) }) : t('off.state.indefinite')));
      onClose();
    } catch (e) { setError(errText(toV2Error(e).code)); }
    finally { setBusy(''); }
  }
  async function back() {
    if (busy) return;
    setBusy('back'); setError('');
    try { await bringBack(target); toast(t(withSection ? 'off.backButSection' : 'off.backDone', { name: name! })); onClose(); }
    catch (e) { setError(errText(toV2Error(e).code)); }
    finally { setBusy(''); }
  }

  const choice = (c: UntilChoice) => {
    if (c === 'time' || c === 'date') {
      const value = c === 'time' ? time : date;
      const ok = c === 'time' ? isHHMM(value) : isLocalDate(value);
      return (
        <li key={c}>
          <button type="button" class="offchoice" aria-expanded={open === c ? 'true' : 'false'} disabled={!!busy} onClick={() => setOpen(open === c ? null : c)} data-until={c}
            data-back={open === c && ok ? backAt(untilSpecOf(c, value), now, hours)?.toISOString() ?? '' : undefined}>
            <span class="offchoice-what">{t('off.c.' + c)}</span>
            {open === c && ok && <span class="fine">{when(backAt(untilSpecOf(c, value), now, hours))}</span>}
          </button>
          {open === c && (
            <div class="offpick">
              <input type={c} dir="ltr" value={value} aria-label={t('off.c.' + c)} data-field={'off-' + c} min={c === 'date' ? addDays(localParts(now, tz).date, 1) : undefined}
                onInput={(e) => (c === 'time' ? setTime : setDate)((e.target as HTMLInputElement).value)} />
              <Btn kind="primary" busy={busy === c} disabled={!ok} onClick={() => apply(c, value)} data-action={'off-' + c}>{t('off.go')}</Btn>
            </div>
          )}
        </li>
      );
    }
    if (c === 'next_opening' && noOpening) {
      return (
        <li key={c}>
          <button type="button" class="offchoice" disabled={!!busy} onClick={() => setOpen('date')} data-until={c} data-no-opening>
            <span class="offchoice-what">{t('off.c.' + c)}</span>
            <span class="fine">{t('off.noOpening')}</span>
          </button>
        </li>
      );
    }
    const back = backAt(untilSpecOf(c), now, hours);
    return (
      <li key={c}>
        <button type="button" class="offchoice" disabled={!!busy} onClick={() => apply(c)} data-until={c} data-back={back?.toISOString() ?? ''}>
          <span class="offchoice-what">{t('off.c.' + c)}</span>
          <span class="fine">{when(back)}</span>
          {busy === c && <span class="spin spin-sm" aria-hidden="true" />}
        </button>
      </li>
    );
  };

  const guests = k === 'option' || k === 'group' ? t('off.guests.option') : d.venue.sold_out_display === 'hide' ? t('off.guests.hide') : t('off.guests.bottom');
  return (
    <Sheet open onClose={onClose} title={name} name="off">
      <p class={'offnow' + (isOff || state?.off ? ' is-off' : '')} data-off-state={isOff ? 'off' : state?.off ? 'section' : 'on'} aria-live="polite">
        {state ? offText(state) : t('off.groupState', { n: group!.n, m: group!.of })}
      </p>
      {isOff && withSection && <p class="fine" data-off-also-section>{t('off.alsoSection')}</p>}
      {operate && isOff && <Btn kind="primary" block busy={busy === 'back'} onClick={back} data-action="bring-back">{t('off.back')}</Btn>}
      {operate && <>
        <h3 class="offhow">{isOff ? t('off.change') : t('off.how')}</h3>
        <ul class="offchoices">{UNTIL_CHOICES.map(choice)}</ul>
        <p class="fine">{guests}{canEdit() && k !== 'option' && k !== 'group' && <> <a href="#/hours">{t('off.guests.change')}</a></>}</p>
      </>}
      {error && <Note kind="error">{error}</Note>}
      {k === 'dish' && <DishChoices dishId={id} />}
    </Sheet>
  );
}

/** A dish's add-on groups and their choices (the nested ones too): each opens its own availability. */
function DishChoices({ dishId }: { dishId: string }) {
  const d = menu.value!, L = lang.value;
  const attached = attachedTo(dishId).map((a) => a.group_id);
  const nested = d.options.filter((o) => attached.includes(o.group_id) && o.opens_group_id).map((o) => o.opens_group_id!);
  const groups = [...new Set([...attached, ...nested])].map((g) => d.groups.find((x) => x.id === g)).filter((g) => !!g);
  if (!groups.length) return null;
  return (
    <section class="offparts" aria-labelledby="offparts-h">
      <h3 id="offparts-h">{t('off.parts')}</h3>
      {groups.map((g) => {
        const off = groupOff(g!.id);
        return (
          <ul key={g!.id} class="rows" aria-label={named(g!, L)}>
            <li class="row"><a class="row-main offrow" href={'#/menu/a/group/' + g!.id + '/' + dishId} data-off-group={g!.id}>
              <span class="row-text"><span class="row-name">{named(g!, L)}</span><span class="row-sub fine">{t('off.group')}</span></span>
              {off.n > 0 && <span class="badge badge-out">{t('off.groupState', { n: off.n, m: off.of })}</span>}
            </a></li>
            {byPosition(d.options.filter((o) => o.group_id === g!.id)).map((o) => (
              <li key={o.id} class="row"><a class="row-main offrow" href={'#/menu/a/option/' + o.id + '/' + dishId} data-off-option={o.id}>
                <span class="row-text"><span class="row-name">{named(o, L) || t('menu2.unnamed')}</span></span>
                <OffBadge kind="option" id={o.id} />
              </a></li>
            ))}
          </ul>
        );
      })}
    </section>
  );
}
