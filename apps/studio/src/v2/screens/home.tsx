// Home (#/home; F08): the owner's phone once the place has published. Where the menu stands; what to fix next (the
// dashboard's nudges, each a tap from the screen that fixes it); the quick actions for a busy moment (a dish off for two
// hours, everything taken off today back, a special, today's hours); what is off now, each with its "until" and one tap
// to bring it back; at a glance, live: menu opens (QR or link), dish views, adds, suggestions shown, accepted and
// dismissed, top dishes, for today, 7 or 30 days, with a chart whose every value is in the table under it; the latest
// changes; and the menu to download any time. Every number is my_dashboard's; with no visits the screen says so. The
// counter sees what is off and the two availability actions only.
import { useState } from 'preact/hooks';
import { DASHBOARD_RANGES, localParts, weekdayOf, type AvailabilityOverrideRow, type ClientDashboard, type DashboardRange, type Nudge } from '@mana/contracts';
import { shortText, shortUrl } from '../../lib/links.ts';
import { toast } from '../../lib/store.ts';
import { Btn, Confirm, CopyIcon, Icon, Ltr, Note, Seg, Sheet } from '../../ui.tsx';
import { Columns } from '../chart.tsx';
import { backAt, offToday, untilSpecOf } from '../data/availability.ts';
import { standingOf } from '../data/changes.ts';
import { dayBars, hasVisits, minuteBars, nudgeHref, share, type Bar } from '../data/dashboard.ts';
import { dashboard, dashError, dashLoading, range, refreshDashboard, setRange } from '../data/dashboard-live.ts';
import { toV2Error } from '../data/errors.ts';
import { exportFileName, menuCsv, menuJson } from '../data/export.ts';
import { closureFromForm, dayHours, newClosureForm, venueHoursOf } from '../data/hours.ts';
import { bringBack, clock, overrides, restoreToday, takeOff } from '../data/live.ts';
import { exportMenu } from '../data/records.ts';
import { byPosition, named, newId } from '../data/rows.ts';
import { addRows, canEdit, canOperate, menu, removeRows } from '../data/store.ts';
import { errText, lang, t, tn } from '../i18n.ts';
import { screenAt } from '../routes.tsx';
import { ErrorLine, Icon2, ReadOnly } from '../ui.tsx';
import { dateText, dayName, momentText } from '../words.ts';
import { ActivityItems } from './activity.tsx';
import { DayRow, NowCard } from './hours.tsx';
import { OffBadge } from './off.tsx';

const fmt = (n: number) => n.toLocaleString(lang.value === 'he' ? 'he-IL' : 'en-GB');
const hm = (minutes: number) => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');

export function HomeScreen() {
  const d = menu.value!;
  const v = d.venue;
  const records = canEdit();
  const standing = standingOf(v);
  return (
    <div class="page page-home2" data-screen="home" data-standing={standing}>
      <header class="home-head">
        <h1 tabIndex={-1}>{named(v, lang.value)}</h1>
        <p class="status" data-standing-line={standing}><span class={'dot ' + (standing === 'live' ? 'dot-on' : 'dot-off')} aria-hidden="true" /><span>{t('pub2.standing.' + standing)}</span></p>
        {standing === 'live' && <p class="home-link"><Ltr class="home-url">{shortText(v.slug)}</Ltr><CopyIcon text={shortUrl(v.slug)} /></p>}
      </header>
      {records && <Nudges />}
      {canOperate() && <QuickActions />}
      {canOperate() && <OffNow />}
      {records && <Glance />}
      {records && <Recent />}
      {records && <ExportCard />}
    </div>
  );
}

// ---------------------------------------------------------------- nudges
const NUDGE_ICON: Readonly<Record<Nudge['code'], string>> = {
  approval_pending: 'clock', onboarding_step: 'list', import_waiting: 'paste', case_waiting_owner: 'chat', dish_no_price: 'edit', dish_no_photo: 'camera',
  group_without_limits: 'layers',
};

export function nudgeText(n: Nudge): string {
  switch (n.code) {
    case 'approval_pending': return t('nudge.approval_pending');
    case 'onboarding_step': return tn('nudge.onboarding_step', n.count, { step: n.targets[0] ? t('step.' + n.targets[0].id) : '' });
    case 'import_waiting': return tn('nudge.import_waiting', n.count);
    case 'case_waiting_owner': return tn('nudge.case_waiting_owner', n.count);
    case 'dish_no_price': return tn('home.n.price', n.count);
    case 'dish_no_photo': return tn('home.n.photos', n.count);
    case 'group_without_limits': return tn('nudge.group_without_limits', n.count);
  }
}

function Nudges() {
  const d = dashboard.value;
  if (!d || d.venueId !== menu.value!.venue.id || !d.nudges.length) return null;
  return (
    <ul class="nudges" aria-label={t('home2.nudges')} data-nudges>
      {d.nudges.map((n) => {
        const href = nudgeHref(n, (p) => !!screenAt(p));
        const inner = <><Icon2 name={NUDGE_ICON[n.code]} size={20} /><span>{nudgeText(n)}</span></>;
        return (
          <li key={n.code} data-nudge={n.code} data-count={n.count}>
            {href ? <a href={'#/' + href} data-href={href}>{inner}<Icon name="chev" size={16} flip /></a> : <p class="nudge-plain">{inner}</p>}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- quick actions (two taps each)
function QuickActions() {
  const d = menu.value!;
  const editable = canEdit();
  const today = offToday(overrides.value, clock.value, d.venue.time_zone).length;
  const [sheet, setSheet] = useState<'off' | 'hours' | null>(null);
  const [ask, setAsk] = useState(false), [busy, setBusy] = useState(false);
  async function restore() {
    setBusy(true);
    try { const back = await restoreToday(); toast(tn('off.restored', back)); setAsk(false); void refreshDashboard(); }
    catch (e) { toast(errText(toV2Error(e).code), 'error'); setAsk(false); }
    finally { setBusy(false); }
  }
  return (
    <>
      <nav class={'acts acts-' + (editable ? 4 : 2)} aria-label={t('home2.acts')} data-quick>
        <button type="button" class="act" onClick={() => setSheet('off')} data-act="off2h"><span class="act-ico"><Icon2 name="pause" size={22} /></span><span>{t('home2.a.off2h')}</span></button>
        <button type="button" class="act" disabled={today === 0} onClick={() => setAsk(true)} data-act="restore-today" data-n={today}>
          <span class="act-ico"><Icon name="refresh" size={22} />{today > 0 && <b>{today}</b>}</span><span>{t('home2.a.restore')}</span>
        </button>
        {editable && <a class="act" href="#/hours/parts/new-special" data-act="special"><span class="act-ico"><Icon name="sparkle" size={22} /></span><span>{t('parts.newSpecial')}</span></a>}
        {editable && <button type="button" class="act" onClick={() => setSheet('hours')} data-act="hours"><span class="act-ico"><Icon name="clock" size={22} /></span><span>{t('home2.a.hours')}</span></button>}
      </nav>
      <Confirm open={ask} title={t('off.restoreToday.title')} body={tn('off.restoreToday.body', today)} confirmLabel={t('off.restoreToday.go')} busy={busy}
        onConfirm={restore} onClose={() => setAsk(false)} />
      {sheet === 'off' && <Off2hSheet onClose={() => setSheet(null)} />}
      {sheet === 'hours' && <TodayHoursSheet onClose={() => setSheet(null)} />}
    </>
  );
}

/** Tap a dish: it is off for two hours and comes back by itself. */
function Off2hSheet({ onClose }: { onClose: () => void }) {
  const d = menu.value!, L = lang.value, tz = d.venue.time_zone;
  const [query, setQuery] = useState(''), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const back = backAt(untilSpecOf('h2'), clock.value, venueHoursOf(tz, d.hours, d.closures));
  const q = query.trim().toLowerCase();
  const sections = byPosition(d.sections).map((s) => ({
    s, dishes: byPosition(d.dishes.filter((x) => x.section_id === s.id)).filter((x) => !q || x.name_he.toLowerCase().includes(q) || x.name_en.toLowerCase().includes(q)),
  })).filter((g) => g.dishes.length);
  async function take(id: string, name: string) {
    if (busy) return;
    setBusy(id); setError('');
    try {
      const until = await takeOff({ kind: 'dish', id }, untilSpecOf('h2'));
      toast(name + ': ' + (until ? t('off.state.until', { when: momentText(new Date(until), Date.now(), tz) }) : t('off.state.indefinite')));
      void refreshDashboard();
      onClose();
    } catch (e) { setError(errText(toV2Error(e).code)); }
    finally { setBusy(''); }
  }
  return (
    <Sheet open onClose={onClose} title={t('home2.a.off2h')} name="off2h" tall>
      <p class="hint">{t('home2.off2h.lead', { when: back ? momentText(back, clock.value, tz) : '' })}</p>
      <input type="search" dir="auto" value={query} placeholder={t('home2.off2h.search')} aria-label={t('home2.off2h.search')} data-field="off2h-search"
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
      {error && <Note kind="error">{error}</Note>}
      {sections.length === 0 && <p class="muted">{t('home2.off2h.none')}</p>}
      {sections.map(({ s, dishes }) => (
        <section key={s.id} class="offquick" aria-labelledby={'oq-' + s.id}>
          <h3 id={'oq-' + s.id}>{named(s, L) || t('menu2.unnamed')}</h3>
          <ul class="offchoices">
            {dishes.map((x) => {
              const name = named(x, L) || t('menu2.unnamed');
              return (
                <li key={x.id}>
                  <button type="button" class="offchoice" disabled={!!busy} onClick={() => take(x.id, name)} data-off2h={x.id} aria-label={t('home2.off2h.one', { name })}>
                    <span class="offchoice-what">{name}</span><OffBadge kind="dish" id={x.id} />
                    {busy === x.id && <span class="spin spin-sm" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Sheet>
  );
}

/** Today's opening hours (every week's, for this weekday), and closing just today. */
function TodayHoursSheet({ onClose }: { onClose: () => void }) {
  const d = menu.value!, tz = d.venue.time_zone;
  const p = localParts(clock.value, tz), today = p.date;
  const closure = d.closures.find((c) => c.from_date <= today && today <= c.to_date) ?? null;
  const editable = canEdit();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  // the closed date's id, made here and kept until it is stored: trying again after a lost answer adds it once
  const [closureId, setClosureId] = useState(newId);
  async function closeToday() {
    const m = closureFromForm(newClosureForm(today));
    if (!m.ok) { setError(errText(m.errors[0]!.code)); return; }
    setBusy(true); setError('');
    try { await addRows('venue_closures', [{ id: closureId, ...m.value }]); setClosureId(newId()); toast(t('home2.hours.closedDone')); }
    catch (e) { setError(errText(toV2Error(e).code)); }
    finally { setBusy(false); }
  }
  async function reopen(id: string) {
    setBusy(true); setError('');
    try { await removeRows('venue_closures', [id]); toast(t('home2.hours.reopenDone')); }
    catch (e) { setError(errText(toV2Error(e).code)); }
    finally { setBusy(false); }
  }
  return (
    <Sheet open onClose={onClose} title={t('home2.a.hours')} name="today-hours">
      <NowCard />
      {!editable && <Note>{t('ro.settings')}</Note>}
      <ReadOnly when={!editable}>
        <ul class="weekdays" data-today-hours={p.weekday}><DayRow day={p.weekday} rows={dayHours(d.hours, p.weekday)} editable={editable} /></ul>
      </ReadOnly>
      <p class="hint">{t('home2.hours.every', { day: dayName(p.weekday, true) })}</p>
      {editable && !closure && <Btn kind="primary" block busy={busy} icon="power" onClick={closeToday} data-action="close-today">{t('home2.hours.close')}</Btn>}
      {editable && closure && closure.from_date === today && closure.to_date === today
        && <Btn block busy={busy} icon="refresh" onClick={() => reopen(closure.id)} data-action="reopen-today">{t('home2.hours.reopen')}</Btn>}
      {closure && !(closure.from_date === today && closure.to_date === today) && <p class="strong">{t('home2.hours.closedRange', { date: dateText(closure.to_date) })}</p>}
      {error && <Note kind="error">{error}</Note>}
      <a class="linkbtn" href="#/hours" data-link="hours"><Icon name="clock" size={16} /><span>{t('home2.hours.all')}</span></a>
    </Sheet>
  );
}

// ---------------------------------------------------------------- what is off now
function OffNow() {
  const d = menu.value!, L = lang.value, now = clock.value, tz = d.venue.time_zone;
  const rows = overrides.value.filter((o) => o.restored_at === null && (o.until_at === null || Date.parse(o.until_at) > now));
  const [busy, setBusy] = useState('');
  if (!rows.length) return null;
  const nameOf = (o: AvailabilityOverrideRow): string => {
    if (o.target_kind === 'section') return named(d.sections.find((x) => x.id === o.target_id), L);
    if (o.target_kind === 'dish') return named(d.dishes.find((x) => x.id === o.target_id), L);
    const opt = d.options.find((x) => x.id === o.target_id);
    const g = opt ? d.groups.find((x) => x.id === opt.group_id) : null;
    return opt ? named(opt, L) + (g ? ' · ' + named(g, L) : '') : '';
  };
  async function back(o: AvailabilityOverrideRow, name: string) {
    setBusy(o.id);
    try { await bringBack({ kind: o.target_kind, id: o.target_id }); toast(t('off.backDone', { name })); void refreshDashboard(); }
    catch (e) { toast(errText(toV2Error(e).code), 'error'); }
    finally { setBusy(''); }
  }
  return (
    <section class="card offnowcard" aria-labelledby="offnow-h" data-off-list={rows.length}>
      <h2 id="offnow-h" class="status"><span class="dot dot-bad" aria-hidden="true" />{tn('off.now', rows.length)}</h2>
      <ul class="offlist">
        {rows.map((o) => {
          const name = nameOf(o) || t('menu2.unnamed');
          return (
            <li key={o.id} data-off-row={o.target_id} data-kind={o.target_kind}>
              <span class="offlist-text">
                <span class="offlist-name" dir="auto">{name}</span>
                <span class="fine">{o.until_at ? t('off.state.until', { when: momentText(new Date(o.until_at), now, tz) }) : t('off.state.indefinite')}
                  {o.created_by_kind === 'staff' && <> <span class="badge badge-halom">{t('who.halom')}</span></>}</span>
              </span>
              <Btn small busy={busy === o.id} onClick={() => back(o, name)} aria-label={t('home2.off.back', { name })} data-bring-back={o.target_id}>{t('off.back')}</Btn>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- at a glance
function Glance() {
  const v = menu.value!.venue;
  const d = dashboard.value, r = range.value;
  const ready = d && d.venueId === v.id && d.range === r ? d : null;
  return (
    <section class="card glance" aria-labelledby="glance-h" data-glance data-range={r} data-state={ready ? (hasVisits(ready.totals) ? 'ready' : 'empty') : 'loading'}>
      <div class="row-between">
        <h2 id="glance-h">{t('home2.numbers')}</h2>
        {ready?.demo && <span class="badge badge-todo" data-demo>{t('home2.demoBadge')}</span>}
      </div>
      <Seg value={r} label={t('home2.range')} onChange={(x: DashboardRange) => setRange(x)} options={DASHBOARD_RANGES.map((x) => ({ value: x, label: t('home2.range.' + x) }))} />
      {!ready && !dashError.value && <p class="muted"><span class="spin spin-sm" aria-hidden="true" /> {t('app.loading')}</p>}
      {ready && !hasVisits(ready.totals) && (
        <div class="glance-empty" data-dash-empty>
          <span class="empty-ico"><Icon name="clock" size={24} /></span>
          <p class="strong">{t('home2.empty.title')}</p>
          <p class="muted">{t('home2.empty.' + r)}</p>
        </div>
      )}
      {ready && hasVisits(ready.totals) && <Numbers d={ready} />}
      {ready?.demo && <p class="fine">{t('home2.demo')}</p>}
      {ready && <p class="fine" data-rolled-up>{ready.rolledUpAt ? t('home2.counted', { time: momentText(new Date(ready.rolledUpAt), clock.value, ready.timeZone, true) }) : t('home2.notCounted')}
        {dashLoading.value && <span class="spin spin-sm" aria-hidden="true" />}</p>}
      <ErrorLine code={dashError.value} onRetry={() => { void refreshDashboard(); }} />
    </section>
  );
}

const Num = ({ k, n }: { k: string; n: number }) => <Ltr data-n={k} data-v={n}>{fmt(n)}</Ltr>;

function Numbers({ d }: { d: ClientDashboard }) {
  const T = d.totals, o = d.opensBy, tz = d.timeZone, today = d.range === 'today';
  const bars = today ? minuteBars(d) : dayBars(d);
  const tick = (b: Bar, i: number): string | null => {
    if (today) return i === 0 || i === 30 || i === 59 ? hm(localParts(Date.parse(b.at), tz).minutes) : null;
    if (bars.length <= 7) return dayName(weekdayOf(b.at));
    return i === 0 || i === Math.floor(bars.length / 2) || i === bars.length - 1 ? `${Number(b.at.slice(8, 10))}.${Number(b.at.slice(5, 7))}` : null;
  };
  const opens = (n: number, capped: boolean) => (capped ? t('chart.atLeast', { n: tn('home2.opensN', n, { n: fmt(n) }) }) : tn('home2.opensN', n, { n: fmt(n) }));
  const long = (b: Bar) => (today ? hm(localParts(Date.parse(b.at), tz).minutes) : dateText(b.at)) + ': ' + opens(b.value, b.capped);
  const qr = share(o.qr, o.qr + o.link);
  const maxViews = Math.max(1, ...d.topDishes.map((x) => x.views));
  const L = lang.value;
  return (
    <div class="glance-in">
      <div class="glance-hero">
        <p class="dt-label"><Icon name="trend" size={16} />{t('home2.opens')}</p>
        <p class="dt-big"><Num k="menuOpens" n={T.menuOpens} /></p>
        <ul class="glance-minis">
          <li><Num k="qr" n={o.qr} /><span><Icon name="qr" size={14} />{t('home2.qr')}{qr !== null && <> · <Ltr>{qr}%</Ltr></>}</span></li>
          <li><Num k="link" n={o.link} /><span><Icon name="link" size={14} />{t('home2.link')}</span></li>
          <li><Num k="he" n={o.he} /><span><Icon name="globe" size={14} />{t('home2.he')}</span></li>
          <li><Num k="en" n={o.en} /><span><Icon name="globe" size={14} />{t('home2.en')}</span></li>
        </ul>
      </div>

      <div class="glance-chart">
        <p class="dt-label">{t(today ? 'home2.chart.minutes' : 'home2.chart.days')}</p>
        <Columns id={today ? 'minutes' : 'days'} bars={bars} title={t(today ? 'home2.chart.minutes' : 'home2.chart.days')} tick={tick} long={long} fmt={fmt} />
        <ChartTable d={d} />
      </div>

      <ul class="glance-tiles">
        <li><Num k="dishViews" n={T.dishViews} /><span>{t('home2.views')}</span></li>
        <li><Num k="basketAdds" n={T.basketAdds} /><span>{t('home.t.adds')}</span></li>
        <li><Num k="addonsChosen" n={T.addonsChosen} /><span>{t('home2.addons')}</span></li>
      </ul>

      <div class="glance-sugg" data-suggestions>
        <p class="dt-label"><Icon name="sparkle" size={16} />{t('home2.sugg')}</p>
        <ul class="glance-tiles">
          <li><Num k="suggestionsShown" n={T.suggestionsShown} /><span>{t('home2.sugg.shown')}</span></li>
          <li><Num k="suggestionsAccepted" n={T.suggestionsAccepted} /><span>{t('home2.sugg.accepted')}</span></li>
          <li><Num k="suggestionsDismissed" n={T.suggestionsDismissed} /><span>{t('home2.sugg.dismissed')}</span></li>
        </ul>
        {d.rules.length > 0 && <a class="linkbtn" href="#/rules" data-link="rules"><span>{t('home2.sugg.rules')}</span><Icon name="chev" size={14} flip /></a>}
      </div>

      {d.topDishes.length > 0 && (
        <div class="glance-top">
          <p class="dt-label"><Icon name="star" size={16} />{t('home.t.top')}</p>
          <ol class="topdishes topdishes2">
            {d.topDishes.map((x) => (
              <li key={x.dishId} data-top={x.dishId} data-views={x.views} data-adds={x.adds}>
                <span class="top-name" dir="auto">{(L === 'he' ? x.name.he || x.name.en : x.name.en || x.name.he) || t('menu2.unnamed')}</span>
                <svg class="chart top-bar" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width={Math.max(3, (x.views / maxViews) * 100)} height="8" rx="4" class="col" /></svg>
                <span class="top-n fine">{t('home2.topLine', { views: fmt(x.views), adds: fmt(x.adds) })}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {d.capped.length > 0 && <Note kind="warn">{t('home2.capped', { days: d.capped.map((c) => dateText(c.day)).join(', ') })}</Note>}
    </div>
  );
}

/** Every value of the chart, and the views and adds beside them: the honest view of the same numbers. */
function ChartTable({ d }: { d: ClientDashboard }) {
  const tz = d.timeZone, today = d.range === 'today';
  const rows = today
    ? d.lastHour.map((m) => ({ key: m.minute, label: hm(localParts(Date.parse(m.minute), tz).minutes), opens: m.opens, views: m.views, adds: m.adds, capped: false }))
    : d.days.map((x) => ({ key: x.day, label: dateText(x.day), opens: x.opens, views: x.views, adds: x.adds, capped: x.capped }));
  return (
    <details class="chart-table" data-chart-table>
      <summary>{t('home2.chart.table')}</summary>
      {rows.length === 0 ? <p class="muted">{t('home2.chart.noneHour')}</p> : (
        <table>
          <thead><tr>
            <th scope="col">{t(today ? 'home2.col.minute' : 'home2.col.day')}</th><th scope="col">{t('home2.col.opens')}</th>
            <th scope="col">{t('home2.col.views')}</th><th scope="col">{t('home2.col.adds')}</th>
          </tr></thead>
          <tbody>{rows.map((x) => (
            <tr key={x.key} data-row={x.key}>
              <th scope="row">{x.label}</th>
              <td><Ltr>{x.capped ? '≥' : ''}{fmt(x.opens)}</Ltr></td><td><Ltr>{fmt(x.views)}</Ltr></td><td><Ltr>{fmt(x.adds)}</Ltr></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </details>
  );
}

// ---------------------------------------------------------------- recent changes
function Recent() {
  const v = menu.value!.venue;
  const d = dashboard.value;
  if (!d || d.venueId !== v.id) return null;
  const list = d.activity.slice(0, 5);
  return (
    <section class="card" aria-labelledby="recent-h" data-recent>
      <div class="row-between"><h2 id="recent-h">{t('home2.recent')}</h2>
        <a class="linkbtn" href="#/activity" data-link="activity"><span>{t('home2.recent.all')}</span><Icon name="chev" size={14} flip /></a></div>
      {list.length === 0 ? <p class="muted">{t('home2.recent.none')}</p> : <ActivityItems entries={list} timeZone={v.time_zone} />}
    </section>
  );
}

// ---------------------------------------------------------------- the menu, any time
/** Hand the browser a file to save (built here; no server file). */
function saveFile(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function ExportCard() {
  const v = menu.value!.venue;
  const [busy, setBusy] = useState<'' | 'json' | 'csv'>(''), [error, setError] = useState('');
  async function download(kind: 'json' | 'csv') {
    if (busy) return;
    setBusy(kind); setError('');
    try {
      const x = await exportMenu(v.id);
      if (kind === 'json') saveFile(menuJson(x), exportFileName(x, 'json'), 'application/json');
      else saveFile(menuCsv(x), exportFileName(x, 'csv'), 'text/csv;charset=utf-8');
      toast(t('exp.done'));
      void refreshDashboard();
    } catch (e) { setError(errText(toV2Error(e).code)); }
    finally { setBusy(''); }
  }
  return (
    <section class="card" aria-labelledby="export-h" data-export>
      <h2 id="export-h">{t('exp.title')}</h2>
      <p class="hint">{t('exp.lead')}</p>
      <div class="btnrow">
        <Btn icon="download" busy={busy === 'json'} onClick={() => download('json')} data-action="export-json">{t('exp.json')}</Btn>
        <Btn icon="download" busy={busy === 'csv'} onClick={() => download('csv')} data-action="export-csv">{t('exp.csv')}</Btn>
      </div>
      <p class="fine">{t('exp.logged')}</p>
      {error && <Note kind="error">{error}</Note>}
    </section>
  );
}
