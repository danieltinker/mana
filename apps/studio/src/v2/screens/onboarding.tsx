// The setup flow (#/onboarding/<step>; F03): one guided path for a new place, phone first, from its name to its
// published menu. Each step says what it is for, shows where it stands, and reuses the app's own screens rather than
// copying them (the menu, an add-on group, the hours, publishing, help); a screen the flow sends the owner to offers the
// way back ("back to setup", in the shell). Progress is saved at every step (set_onboarding_step), so the owner can leave
// and come back to the same step on any device, and Home's nudges lead back here. "Get help" is one tap away on every
// step (the shell's help button, and a link under each step that opens help on the step's topic).
//
// The steps (data/flow.ts): the place → the menu (bring it: four ways, or build it by hand) → checking an imported menu
// → add-ons → photos → hours → style → trying it on a phone → publishing. Only owners and managers set a place up; any
// other account is taken to the menu.
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { fromPrice, type CaseTopic, type OnboardingProgress, type OnboardingStep } from '@mana/contracts';
import { shortText } from '../../lib/links.ts';
import { Btn, Icon, Loading, Ltr, Note, go, route } from '../../ui.tsx';
import { standingOf } from '../data/changes.ts';
import { draft, refreshDraft } from '../data/draft.ts';
import { toV2Error } from '../data/errors.ts';
import { blockersOf, endWrite, FLOW_STEPS, isFinished, isStep, nextOpenAfter, openStep, stateOf, stepEnd, stepNumber, visitWrite, type PlaceFacts } from '../data/flow.ts';
import { guestModel } from '../data/guest.ts';
import { imports, importsError, loadImports, loadProgress, progress, progressError, returnTo, setStep } from '../data/onboarding.ts';
import { byCreated, byPosition, named } from '../data/rows.ts';
import { canEdit, menu } from '../data/store.ts';
import { langsOf, ruleLine } from '../format.ts';
import { errText, lang, t, tn } from '../i18n.ts';
import { leave, leaveGuarded } from '../leave.ts';
import { ErrorLine, Icon2, LangSeg, Price, useEditOnly } from '../ui.tsx';
import { dayHours, WEEK } from '../data/hours.ts';
import { GuestPreview } from './guest-preview.tsx';
import { DayRow, NowCard } from './hours.tsx';
import { ImportReview, ImportsWaiting } from './import-review.tsx';
import { SourceScreen, SourceCards } from './import-source.tsx';
import { PublishScreen } from './publish.tsx';
import { QrCard } from './qr.tsx';

/** The place as the flow reads it now (data/flow.ts `PlaceFacts`). */
export function placeFacts(): PlaceFacts {
  const d = menu.value!, list = imports.value ?? [];
  return {
    dishes: d.dishes.length,
    groupsUnconfirmed: d.groups.filter((g) => g.limits_confirmed === false).length,
    importsWaiting: list.filter((i) => i.status === 'parsed').length,
    importsReading: list.filter((i) => i.status === 'uploaded' || i.status === 'parsing').length,
    importsApplied: list.filter((i) => i.status === 'applied').length,
    hours: d.hours.length,
    publishIssues: draft.value.issues.length,
  };
}

/** The topic a step's "get help" opens with. */
const HELP_TOPIC: Readonly<Record<OnboardingStep, CaseTopic>> = {
  venue: 'onboarding', menu: 'import', review: 'import', addons: 'menu', photos: 'photos', hours: 'onboarding', style: 'onboarding', test: 'onboarding', publish: 'onboarding',
};

/** Leave the flow for one of the app's own screens; the shell then offers the way back to `step`. */
export function leaveFor(path: string, step: OnboardingStep) { returnTo.value = step; go(path); }

/** The way back to the flow, at the top of a screen the flow sent the owner to. */
export function BackToSetup() {
  const step = returnTo.value;
  if (!step || route.value[0] === 'onboarding') return null;
  // a screen holding changes not saved yet (a group form) asks first, as every other way out of it does (leave.ts)
  const back = (e: MouseEvent) => { if (!leaveGuarded()) return; e.preventDefault(); leave(() => go('onboarding/' + step)); };
  return (
    <a class="backtoflow" href={'#/onboarding/' + step} data-back-to-setup={step} onClick={(e) => back(e as unknown as MouseEvent)}>
      <Icon name="chev" size={16} back /><span>{t('ob.back', { step: t('step.' + step) })}</span>
    </a>
  );
}

/** Where the flow goes after a step: the next step still open, or "all set". */
const after = (p: OnboardingProgress, s: OnboardingStep) => 'onboarding/' + (nextOpenAfter(p, s) ?? 'done');

export function OnboardingScreen({ rest }: { rest: string[] }) {
  const editable = canEdit();
  useEditOnly(true, editable, 'menu');
  const d = menu.value!;
  const vid = d.venue.id;
  const p = progress.value;
  const [first, sub] = rest;
  // where the flow opens depends on the imports too (one waiting for its check opens first): read before choosing
  const [importsRead, setImportsRead] = useState(false);
  useEffect(() => {
    setImportsRead(false);
    void loadProgress();
    loadImports().catch(() => {}).finally(() => setImportsRead(true));
    refreshDraft();
  }, [vid]);
  // a publish (or Halom's approval) marks the publish step done: read the progress again when the place's standing moves
  useEffect(() => { void loadProgress(); }, [d.venue.published_revision_id, d.dishes.length > 0]);
  useEffect(() => { returnTo.value = null; }, [first]);
  useEffect(() => {
    if (p && importsRead && editable && (!first || (first !== 'done' && !isStep(first)))) go('onboarding/' + openStep(p, placeFacts()), true);
  }, [p, first, importsRead]);
  if (!editable) return null;
  if (!p) return <div class="page" data-screen="onboarding">{progressError.value ? <ErrorLine code={progressError.value} onRetry={() => loadProgress()} /> : <Loading />}</div>;
  if (first === 'done') return <AllSet p={p} />;
  if (!isStep(first)) return <Loading />;
  return <Flow step={first} sub={sub} p={p} />;
}

function Flow({ step, sub, p }: { step: OnboardingStep; sub: string | undefined; p: OnboardingProgress }) {
  const facts = placeFacts();
  const state = stateOf(p, step);
  // the first visit of a step says the owner is on it (doing), with what holds it back; never over a finished one
  useEffect(() => {
    const w = visitWrite(step, state, facts);
    if (w) setStep(step, w.state, w.blockers).catch(() => { /* the next visit tries again */ });
  }, [step]);
  let body: ComponentChildren;
  if (step === 'menu' && sub) body = <SourceScreen source={sub} />;
  else if (step === 'review' && sub) body = <ImportReview id={sub} />;
  else body = <StepBody step={step} p={p} facts={facts} />;
  const pct = Math.round((p.done / p.total) * 100);
  return (
    <div class="page flow" data-screen="onboarding" data-step={step} data-state={state}>
      <header class="flow-head">
        <p class="flow-count fine">{t('ob.count', { n: stepNumber(step), of: FLOW_STEPS.length })}</p>
        <div class="flow-bar" role="progressbar" aria-label={t('ob.progress')} aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done}
          aria-valuetext={t('ob.progressText', { done: p.done, total: p.total })} data-progress={p.done + '/' + p.total}><span style={{ width: pct + '%' }} /></div>
        <h1 tabIndex={-1}>{t('step.' + step)}</h1>
        {!sub && <p class="lead">{t('ob.lead.' + step)}</p>}
      </header>
      <StepList p={p} here={step} />
      {body}
      <p class="flow-help">
        <a class="linkbtn" href={'#/help/' + HELP_TOPIC[step]} data-flow-help={HELP_TOPIC[step]} onClick={(e) => { e.preventDefault(); leaveFor('help/' + HELP_TOPIC[step], step); }}>
          <Icon name="help" size={16} /><span>{t('ob.help')}</span>
        </a>
      </p>
    </div>
  );
}

/** Every step with where it stands; the owner can go back to any of them. Folded on a phone. */
function StepList({ p, here }: { p: OnboardingProgress; here: OnboardingStep }) {
  return (
    <details class="flow-steps card" data-steps>
      <summary><span>{t('ob.steps')}</span><span class="fine">{t('ob.progressText', { done: p.done, total: p.total })}</span></summary>
      <ol>
        {p.steps.map((s) => (
          <li key={s.step} data-step-state={s.state} data-step-item={s.step} aria-current={s.step === here ? 'step' : undefined}>
            <a href={'#/onboarding/' + s.step}>
              <span class={'flow-dot is-' + s.state} aria-hidden="true">{s.state === 'done' ? <Icon name="check" size={14} /> : stepNumber(s.step)}</span>
              <span class="flow-name">{t('step.' + s.step)}</span>
              <span class="fine">{t('stepstate.' + s.state)}</span>
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}

/** A step's end (data/flow.ts `stepEnd`): the owner's button(s) that finish it, then the next open step. */
function useFinish(step: OnboardingStep) {
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  async function finish(how: 'done' | 'skip' | 'review_skip') {
    if (busy) return;
    setBusy(how); setError('');
    try {
      const w = endWrite(step, how);
      const p = w ? await setStep(w.step, w.state, []) : progress.value!;
      go(after(p, step));
    } catch (e) { setError(errText(toV2Error(e).code)); }
    finally { setBusy(''); }
  }
  return { busy, error, finish };
}

function Actions({ children, error }: { children: ComponentChildren; error?: string }) {
  return <div class="flow-actions">{error && <Note kind="error">{error}</Note>}{children}</div>;
}

/** Continue to the next open step without writing (a step the database already finished). */
function NextBtn({ step, p, label = 'app.next' }: { step: OnboardingStep; p: OnboardingProgress; label?: string }) {
  return <Btn kind="primary" block icon="chev" onClick={() => go(after(p, step))} data-action="flow-next">{t(label)}</Btn>;
}

function StepBody({ step, p, facts }: { step: OnboardingStep; p: OnboardingProgress; facts: PlaceFacts }) {
  switch (step) {
    case 'venue': return <VenueStep p={p} />;
    case 'menu': return <MenuStep p={p} facts={facts} />;
    case 'review': return <ReviewStep p={p} facts={facts} />;
    case 'addons': return <AddonsStep p={p} facts={facts} />;
    case 'photos': return <PhotosStep />;
    case 'hours': return <HoursStep />;
    case 'style': return <StyleStep />;
    case 'test': return <TestStep />;
    case 'publish': return <PublishStep p={p} />;
  }
}

// ---------------------------------------------------------------- 1. the place
function VenueStep({ p }: { p: OnboardingProgress }) {
  const v = menu.value!.venue;
  return (
    <>
      <section class="card" data-venue-card>
        <p class="strong">{named(v, lang.value)}</p>
        <p><Ltr class="biglink">{shortText(v.slug)}</Ltr></p>
        <p class="fine">{t('setup.permanent')} · {t('kind.' + v.kind)}</p>
      </section>
      <Actions><NextBtn step="venue" p={p} /></Actions>
    </>
  );
}

// ---------------------------------------------------------------- 2. the menu: bring it, or build it by hand
function MenuStep({ p, facts }: { p: OnboardingProgress; facts: PlaceFacts }) {
  const d = menu.value!;
  const sections = d.sections.length;
  return (
    <>
      <ImportsWaiting />
      {facts.dishes > 0 && (
        <section class="card" data-menu-has>
          <p class="status"><span class="dot dot-on" aria-hidden="true" />{t('ob.menu.has', { dishes: tn('imp.n.dishes', facts.dishes), inSections: tn('ob.menu.inSections', sections) })}</p>
          <p class="fine">{t('ob.menu.hasMore')}</p>
          <Actions><NextBtn step="menu" p={p} /></Actions>
        </section>
      )}
      <SourceCards />
      <section class="card" data-by-hand>
        <h2>{t('ob.byHand.title')}</h2>
        <p class="fine">{t('ob.byHand.body')}</p>
        <Btn icon="edit" onClick={() => leaveFor('menu', 'menu')} data-action="build-by-hand">{t('ob.byHand.go')}</Btn>
      </section>
    </>
  );
}

// ---------------------------------------------------------------- 3. checking an imported menu
function ReviewStep({ p, facts }: { p: OnboardingProgress; facts: PlaceFacts }) {
  const { busy, error, finish } = useFinish('review');
  const state = stateOf(p, 'review');
  const waiting = (imports.value ?? []).filter((i) => i.status === 'parsed');
  useEffect(() => { if (waiting.length === 1) go('onboarding/review/' + waiting[0]!.id, true); }, [waiting.length]);
  if (imports.value === null) {
    return importsError.value ? <ErrorLine code={importsError.value} onRetry={() => { loadImports().catch(() => {}); }} /> : <Loading />;
  }
  if (waiting.length > 0) return <ImportsWaiting />;
  const end = stepEnd('review', facts);
  return (
    <section class="card" data-review-none>
      {isFinished(state)
        ? <p class="status"><span class="dot dot-on" aria-hidden="true" />{t(state === 'skipped' ? 'ob.review.byHand' : 'ob.review.applied')}</p>
        : end.end === 'review_skip' ? <p>{t('ob.review.byHand')}</p>
        : facts.importsReading > 0 ? <p>{t('ob.review.reading')}</p>
        : <p>{t('ob.review.nothing')}</p>}
      <Actions error={error}>
        {isFinished(state) ? <NextBtn step="review" p={p} />
          : end.end === 'review_skip' ? <Btn kind="primary" block busy={busy === 'review_skip'} onClick={() => finish('review_skip')} data-action="flow-review-skip">{t('app.next')}</Btn>
          : <Btn kind="primary" block icon="chev" onClick={() => go('onboarding/menu')} data-action="flow-bring-menu">{t('ob.review.bring')}</Btn>}
      </Actions>
    </section>
  );
}

// ---------------------------------------------------------------- 4. add-ons: imported groups' limits confirmed
function AddonsStep({ p, facts }: { p: OnboardingProgress; facts: PlaceFacts }) {
  const d = menu.value!, L = lang.value;
  const { busy, error, finish } = useFinish('addons');
  const groups = byCreated(d.groups);
  const state = stateOf(p, 'addons');
  return (
    <>
      {groups.length === 0 ? <section class="card" data-addons-none><p>{t('ob.addons.none')}</p></section> : (
        <section class="card" aria-labelledby="ob-groups-h">
          <h2 id="ob-groups-h">{facts.groupsUnconfirmed > 0 ? tn('ob.addons.wait', facts.groupsUnconfirmed) : t('ob.addons.allSet')}</h2>
          <ul class="rows">
            {groups.map((g) => (
              <li key={g.id} class="row" data-ob-group={g.id} data-confirmed={g.limits_confirmed ? 'yes' : 'no'}>
                <a class="row-main" href={'#/addons/' + g.id} onClick={(e) => { e.preventDefault(); leaveFor('addons/' + g.id, 'addons'); }}>
                  <span class="row-text">
                    <span class="row-name">{named(g, L) || t('menu2.unnamed')}</span>
                    <span class="row-sub"><span>{ruleLine(g.min_units, g.max_units)}</span></span>
                    {!g.limits_confirmed && <span class="row-sub"><span class="badge badge-warn">{t('lib.confirm.badge')}</span></span>}
                  </span>
                  <Icon name="chev" size={18} flip />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Actions error={error}>
        {isFinished(state) && facts.groupsUnconfirmed === 0 ? <NextBtn step="addons" p={p} />
          : facts.groupsUnconfirmed === 0 ? <Btn kind="primary" block busy={busy === 'done'} onClick={() => finish('done')} data-action="flow-done">{t('app.next')}</Btn>
          : <Btn kind="ghost" block busy={busy === 'skip'} onClick={() => finish('skip')} data-action="flow-later">{t('ob.later')}</Btn>}
      </Actions>
    </>
  );
}

// ---------------------------------------------------------------- 5. photos: no picture slot on a v2 dish yet
function PhotosStep() {
  const d = menu.value!;
  const p = progress.value!;
  const { busy, error, finish } = useFinish('photos');
  const illustrated = d.dishes.filter((x) => x.stock_id).length;
  const state = stateOf(p, 'photos');
  return (
    <>
      <section class="card" data-photos>
        <p>{t('ob.photos.body')}</p>
        <ul class="chips">
          <li class="chip" data-no-photo={d.dishes.length - illustrated}>{tn('ob.photos.none', d.dishes.length - illustrated)}</li>
          {illustrated > 0 && <li class="chip" data-illustrated={illustrated}>{tn('ob.photos.illus', illustrated)}</li>}
        </ul>
        <p class="fine">{t('ob.photos.later')}</p>
      </section>
      <Actions error={error}>
        {isFinished(state) ? <NextBtn step="photos" p={p} />
          : <Btn kind="primary" block busy={busy === 'skip'} onClick={() => finish('skip')} data-action="flow-later">{t('ob.photos.go')}</Btn>}
      </Actions>
    </>
  );
}

// ---------------------------------------------------------------- 6. hours and services
function HoursStep() {
  const d = menu.value!;
  const p = progress.value!;
  const { busy, error, finish } = useFinish('hours');
  const state = stateOf(p, 'hours');
  return (
    <>
      <NowCard />
      <section class="card" aria-labelledby="ob-week-h" data-ob-week>
        <h2 id="ob-week-h">{t('hours.week')}</h2>
        <ul class="weekdays">{WEEK.map((day) => <DayRow key={day} day={day} rows={dayHours(d.hours, day)} editable={false} />)}</ul>
        <Btn icon="clock" onClick={() => leaveFor('hours', 'hours')} data-action="set-hours">{t(d.hours.length ? 'ob.hours.change' : 'ob.hours.set')}</Btn>
      </section>
      <section class="card" data-services>
        <h2>{t('ob.services.title')}</h2>
        <p><span class="badge badge-ok">{t('ob.services.menu')}</span></p>
        <p class="fine">{t('ob.services.later')}</p>
      </section>
      <Actions error={error}>
        {isFinished(state) ? <NextBtn step="hours" p={p} /> : <>
          <Btn kind="primary" block busy={busy === 'done'} onClick={() => finish('done')} data-action="flow-done">{t(d.hours.length ? 'ob.hours.done' : 'ob.hours.always')}</Btn>
          <Btn kind="ghost" block busy={busy === 'skip'} onClick={() => finish('skip')} data-action="flow-later">{t('ob.later')}</Btn>
        </>}
      </Actions>
    </>
  );
}

// ---------------------------------------------------------------- 7. style: no style editor in this app yet
function StyleStep() {
  const v = menu.value!.venue;
  const p = progress.value!;
  const { busy, error, finish } = useFinish('style');
  const state = stateOf(p, 'style');
  const langs = langsOf(v);
  return (
    <>
      <section class="card" data-style>
        <p>{t('ob.style.body')}</p>
        <p><span class="strong">{t('ob.style.langs')}</span> {langs.map((l) => t('app.' + l)).join(' · ')}</p>
        <p class="fine">{t('ob.style.later')}</p>
      </section>
      <Actions error={error}>
        {isFinished(state) ? <NextBtn step="style" p={p} />
          : <Btn kind="primary" block busy={busy === 'skip'} onClick={() => finish('skip')} data-action="flow-later">{t('ob.style.go')}</Btn>}
      </Actions>
    </>
  );
}

// ---------------------------------------------------------------- 8. trying it on a phone
function TestStep() {
  const d = menu.value!;
  const p = progress.value!;
  const { busy, error, finish } = useFinish('test');
  const state = stateOf(p, 'test');
  const langs = langsOf(d.venue);
  const [L, setL] = useState<'he' | 'en'>(() => (langs.includes(lang.value) ? lang.value : langs[0] ?? 'he'));
  const [open, setOpen] = useState<string | null>(null);
  const model = useMemo(() => (open ? guestModel(d, open) : null), [open, d]);
  const name = (x: { name_he: string; name_en: string }) => (L === 'he' ? x.name_he || x.name_en : x.name_en || x.name_he);
  const sections = byPosition(d.sections.filter((s) => !s.hidden));
  return (
    <>
      <p class="fine">{t('ob.test.note')}</p>
      <LangSeg value={L} onChange={setL} langs={langs} />
      <div class="phoneframe" data-phone-frame>
        <div class="phone-screen" lang={L} dir={L === 'he' ? 'rtl' : 'ltr'}>
          <p class="phone-venue">{L === 'he' ? d.venue.name_he || d.venue.name_en : d.venue.name_en || d.venue.name_he}</p>
          {model ? <>
            <button type="button" class="linkbtn" onClick={() => setOpen(null)} data-action="phone-back"><Icon name="chev" size={16} back />{t('ob.test.back')}</button>
            <GuestPreview model={model} L={L} />
          </> : sections.map((s) => {
            const dishes = byPosition(d.dishes.filter((x) => x.section_id === s.id && !x.hidden));
            if (!dishes.length) return null;
            return (
              <section key={s.id} class="phone-sec">
                <h3>{name(s)}</h3>
                <ul>
                  {dishes.map((x) => {
                    const m = guestModel(d, x.id);
                    return (
                      <li key={x.id}>
                        <button type="button" class="phone-dish" onClick={() => setOpen(x.id)} data-phone-dish={x.id}>
                          <span class="phone-pic" aria-hidden="true">{x.stock_id ? <Icon2 name="image" size={18} /> : <Icon2 name="dish" size={18} />}</span>
                          <span class="phone-name">{name(x)}<span class="fine">{x.stock_id ? t('pic.illus') : t('ob.noPhotoYet')}</span></span>
                          <span class="phone-price">{m ? <Price p={fromPrice(m.dish, { groups: m.groups })} /> : null}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>
      <Actions error={error}>
        {isFinished(state) ? <NextBtn step="test" p={p} /> : <>
          <Btn kind="primary" block busy={busy === 'done'} onClick={() => finish('done')} data-action="flow-done">{t('ob.test.done')}</Btn>
          <Btn kind="ghost" block busy={busy === 'skip'} onClick={() => finish('skip')} data-action="flow-later">{t('ob.later')}</Btn>
        </>}
      </Actions>
    </>
  );
}

// ---------------------------------------------------------------- 9. publishing (the publish screen itself, and the QR)
function PublishStep({ p }: { p: OnboardingProgress }) {
  const v = menu.value!.venue;
  const published = standingOf(v) !== 'never';
  const facts = placeFacts();
  const blockers = blockersOf('publish', facts);
  return (
    <>
      {blockers.includes('menu_empty') && <Note kind="warn" action={<Btn small onClick={() => go('onboarding/menu')}>{t('ob.review.bring')}</Btn>}>{t('ob.publish.empty')}</Note>}
      <PublishScreen inFlow />
      {published && <QrCard venue={v} />}
      {published && isFinished(stateOf(p, 'publish')) && <Actions><NextBtn step="publish" p={p} /></Actions>}
    </>
  );
}

// ---------------------------------------------------------------- all set
function AllSet({ p }: { p: OnboardingProgress }) {
  const v = menu.value!.venue;
  const later = p.steps.filter((s) => s.state === 'skipped' && s.step !== 'review');
  const open = p.steps.filter((s) => !isFinished(s.state));
  if (open.length) {
    return (
      <div class="page flow" data-screen="onboarding" data-step="done">
        <h1 tabIndex={-1}>{t('ob.done.notYet')}</h1>
        <Btn kind="primary" block onClick={() => go('onboarding/' + open[0]!.step)} data-action="flow-resume">{t('step.' + open[0]!.step)}</Btn>
      </div>
    );
  }
  return (
    <div class="page flow" data-screen="onboarding" data-step="done">
      <header class="flow-head">
        <p class="status"><span class="dot dot-on" aria-hidden="true" />{t('ob.done.status')}</p>
        <h1 tabIndex={-1}>{t('ob.done.title')}</h1>
        <p class="lead">{t(standingOf(v) === 'pending' ? 'ob.done.pending' : 'ob.done.live')}</p>
      </header>
      {later.length > 0 && (
        <section class="card" data-later>
          <h2>{t('ob.done.later')}</h2>
          <ul class="chips">{later.map((s) => <li key={s.step}><a class="chip" href={'#/onboarding/' + s.step}>{t('step.' + s.step)}</a></li>)}</ul>
        </section>
      )}
      {standingOf(v) !== 'never' && <QrCard venue={v} />}
      <Btn kind="primary" block icon="home" onClick={() => go('home')} data-action="flow-home">{t('ob.done.home')}</Btn>
    </div>
  );
}
