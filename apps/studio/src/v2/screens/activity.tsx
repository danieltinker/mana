// The activity log (#/activity; F08, F11, D25): every change to the place, newest first, a page at a time
// (venue_activity), grouped by day on the venue's clock. Who did it in plain words (you, someone on your team, Halom,
// automatically), what, when; Halom's actions carry a mark and the reason Halom gave, reads of the menu and exports
// included. Filters: who, and how. Owners and managers (the counter has no records).
import { useEffect, useRef, useState } from 'preact/hooks';
import { ACTIVITY_VIAS, ACTOR_KINDS, type ActivityEntry, type ActivityVia, type ActorKind } from '@mana/contracts';
import { Btn, Field, Icon, Note, PageHead } from '../../ui.tsx';
import { activityWords, dayTitle, type ActivityWords } from '../data/activity.ts';
import { toV2Error } from '../data/errors.ts';
import { clock } from '../data/live.ts';
import { venueActivity } from '../data/records.ts';
import { canEdit, menu } from '../data/store.ts';
import { t } from '../i18n.ts';
import { ErrorLine } from '../ui.tsx';

/** Entries per page (the RPC allows up to 100). */
export const ACTIVITY_PAGE = 30;

/** Entries grouped by the venue's day, each said in words (shared with Home's "recent changes"). */
export function ActivityItems({ entries, timeZone }: { entries: readonly ActivityEntry[]; timeZone: string }) {
  const now = clock.value;
  const days: { day: string; items: { e: ActivityEntry; w: ActivityWords }[] }[] = [];
  for (const e of entries) {
    const w = activityWords(e, timeZone);
    const last = days[days.length - 1];
    if (last && last.day === w.day) last.items.push({ e, w }); else days.push({ day: w.day, items: [{ e, w }] });
  }
  return (
    <div class="actlog">
      {days.map((g) => (
        <section key={g.day} class="actday" data-day={g.day}>
          <h3 class="actday-h">{dayTitle(g.day, now, timeZone)}</h3>
          <ul class="rows actrows">
            {g.items.map(({ e, w }) => (
              <li key={e.id} class={'row actrow' + (w.who === 'halom' ? ' is-halom' : '')} data-activity={e.id} data-action={e.action} data-who={w.who}>
                <div class="actrow-in">
                  <p class="actrow-what" dir="auto">{w.what}</p>
                  {w.details && <p class="actrow-more fine" dir="auto">{w.details}</p>}
                  <p class="actrow-who fine">
                    {w.who === 'halom' && <span class="badge badge-halom" data-halom>{t('who.halom')}</span>}
                    {w.who !== 'halom' && <span>{w.whoText}</span>}
                    <span aria-hidden="true">·</span>
                    <bdi dir="ltr">{w.time}</bdi>
                  </p>
                  {w.reason && <p class="actrow-reason" dir="auto" data-reason>{t('act2.reason', { reason: w.reason })}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** One query's pages; `query` is the filters they were read with ("<actor>|<via>"). */
type Load = { state: 'loading' | 'ready' | 'error'; query: string; entries: ActivityEntry[]; next: number | null; error: string; more: boolean };

export function ActivityScreen() {
  const d = menu.value!;
  const records = canEdit();
  const [actor, setActor] = useState<ActorKind | ''>(''), [via, setVia] = useState<ActivityVia | ''>('');
  const [s, setS] = useState<Load>({ state: 'loading', query: '', entries: [], next: null, error: '', more: false });
  const seq = useRef(0);

  async function load(before: number | null) {
    const mine = ++seq.current, query = actor + '|' + via;
    setS((x) => (before === null ? { ...x, state: 'loading', error: '' } : { ...x, more: true, error: '' }));
    try {
      const page = await venueActivity({ venueId: d.venue.id, before, limit: ACTIVITY_PAGE, actor: actor || null, via: via || null });
      if (mine !== seq.current) return;
      setS((x) => ({ state: 'ready', query, entries: before === null ? [...page.entries] : [...x.entries, ...page.entries], next: page.next, error: '', more: false }));
    } catch (e) {
      if (mine !== seq.current) return;
      setS((x) => ({ ...x, state: before === null ? 'error' : x.state, error: toV2Error(e).code, more: false }));
    }
  }
  useEffect(() => { if (records) void load(null); }, [d.venue.id, actor, via, records]);

  if (!records) return <div class="page" data-screen="activity"><PageHead title={t('nav2.activity')} /><Note>{t('act2.counter')}</Note></div>;
  const filtered = actor !== '' || via !== '';
  return (
    <div class="page page-activity" data-screen="activity" data-state={s.state} data-query={s.query}>
      <PageHead title={t('nav2.activity')} lead={t('act2.lead')} />
      <div class="grid2 grid2-tight actfilters" role="group" aria-label={t('act2.filters')}>
        <Field label={t('act2.who')}>{(p) => (
          <select {...p} value={actor} data-field="activity-actor" onChange={(e) => setActor((e.target as HTMLSelectElement).value as ActorKind | '')}>
            <option value="">{t('whof.all')}</option>
            {ACTOR_KINDS.map((k) => <option key={k} value={k}>{t('whof.' + k)}</option>)}
          </select>
        )}</Field>
        <Field label={t('act2.how')}>{(p) => (
          <select {...p} value={via} data-field="activity-via" onChange={(e) => setVia((e.target as HTMLSelectElement).value as ActivityVia | '')}>
            <option value="">{t('via.all')}</option>
            {ACTIVITY_VIAS.map((k) => <option key={k} value={k}>{t('via.' + k)}</option>)}
          </select>
        )}</Field>
      </div>
      {s.state === 'loading' && <p class="muted"><span class="spin spin-sm" aria-hidden="true" /> {t('app.loading')}</p>}
      {s.state === 'error' && <ErrorLine code={s.error} onRetry={() => load(null)} />}
      {s.state === 'ready' && s.entries.length === 0 && <p class="muted" data-activity-empty>{t(filtered ? 'act2.noneFiltered' : 'act2.none')}</p>}
      {s.entries.length > 0 && <ActivityItems entries={s.entries} timeZone={d.venue.time_zone} />}
      {s.state === 'ready' && s.error && <ErrorLine code={s.error} onRetry={() => load(s.next)} />}
      {s.next !== null && s.state === 'ready' && <Btn block icon="down" busy={s.more} onClick={() => load(s.next)} data-action="activity-more">{t('act2.more')}</Btn>}
      {s.state === 'ready' && s.next === null && s.entries.length > 0 && <p class="fine center" data-activity-end><Icon name="check" size={14} /> {t('act2.end')}</p>}
    </div>
  );
}
