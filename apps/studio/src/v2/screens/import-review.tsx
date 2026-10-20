// Checking an imported menu (#/onboarding/review/<import>; F03 step 3, ADR-006): what was read (sections, dishes,
// prices, add-on groups, and what the reader says about the source), the exceptions to fix or decide in place, and the
// plan: what applying would add to the menu, update, find already there, or leave out. Nothing is saved to the menu
// until the owner applies (apply_import, which runs exactly this plan: never a delete, never a duplicate). Prices read
// are shown and confirmed before they count; allergens are the source's own words, and labels only those the source
// states. Source text is shown as text, never as HTML.
//
// The owner's answers stay on this device until applying (there is no column for them; per account, data/answers.ts);
// a price typed in place changes the draft, which is stored again at once (save_import_draft), so another device sees
// it. Only an import of the open place is checked and applied here: one of another place (an address kept from it) is
// said plainly, with the way to that place, and never planned against this place's menu.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  draftCounts, isBlank, type ImportChoice, type ImportDecisions, type ImportDraft, type ImportPlan, type Text,
} from '@mana/contracts';
import { toast } from '../../lib/store.ts';
import { Btn, Confirm, Icon, Loading, Ltr, Note, Switch, go } from '../../ui.tsx';
import { toV2Error } from '../data/errors.ts';
import { nextOpenAfter } from '../data/flow.ts';
import { agorotOf, shekelsOf } from '../data/forms.ts';
import { existingMenu, isTextSource, type ImportLine } from '../data/imports.ts';
import {
  dropAnswers, importApi, importPlace, imports, keepAnswers, keepNotes, loadAnswers, loadAssets, loadImport, loadImports, loadProgress, notesFor, progress, runScan,
} from '../data/onboarding.ts';
import {
  addsNoDish, allLeftOut, carriesPrices, changesNothing, choose, confirmPrices, fitAnswers, isEmptyMenu, leaveOut, leftOut, noteLines, planLines, priceDiffs,
  review, sameDraft, sameSummary, withDishPrice, withOptionPrice, type ExceptionRow,
} from '../data/review.ts';
import { named } from '../data/rows.ts';
import { canEdit, flushSaves, hasUnsaved, memberships, menu, openVenue, reloadMenuQuietly } from '../data/store.ts';
import { leave } from '../leave.ts';
import { langsOf, shekels } from '../format.ts';
import { errText, fmtDateTime, has, lang, t, tn } from '../i18n.ts';
import { ErrorLine, MoneyInput } from '../ui.tsx';
import { scanWords } from './import-source.tsx';

/** How many of what the plan counts, by kind (the dish's own add-on links are not counted on their own). */
const KIND_WORDS: Readonly<Record<string, string>> = {
  section: 'imp.n.sections', dish: 'imp.n.dishes', group: 'imp.n.groups', option: 'imp.n.options', photo: 'imp.n.photos', dish_group: 'imp.n.groups',
};

const say = (x: Text | null | undefined): string => {
  if (!x) return '';
  const L = lang.value;
  return (L === 'he' ? x.he || x.en : x.en || x.he).trim();
};
/**
 * A name set inside a sentence, isolated (U+2068 … U+2069): its own direction, and a direction control inside it (a
 * U+202E read from a source) ends with it instead of turning the rest of the sentence round.
 */
const iso = (s: string): string => (s ? '⁨' + s + '⁩' : s);

// ---------------------------------------------------------------- imports waiting, being read, or failed
/** The place's imports that need the owner: a menu read and waiting for its check, one being read, one that failed. */
export function ImportsWaiting() {
  const list = (imports.value ?? []).filter((i) => i.status === 'parsed' || i.status === 'uploaded' || i.status === 'parsing' || i.status === 'failed');
  if (!list.length) return null;
  return (
    <section class="card" aria-labelledby="waiting-h" data-imports-waiting>
      <h2 id="waiting-h">{t('ob.imports.title')}</h2>
      <ul class="rows">
        {list.map((i) => (
          <li key={i.id} class="row" data-import={i.id} data-import-status={i.status}>
            <a class="row-main" href={'#/onboarding/review/' + i.id}>
              <span class="row-text">
                <span class="row-name">{t('ob.src.' + i.source)}</span>
                <span class="row-sub"><span class={'badge ' + (i.status === 'parsed' ? 'badge-warn' : i.status === 'failed' ? 'badge-out' : 'badge-todo')}>{t('imp.status.' + i.status)}</span><span class="fine">{fmtDateTime(i.created_at)}</span></span>
              </span>
              <Icon name="chev" size={18} flip />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- one import
export function ImportReview({ id }: { id: string }) {
  const open = menu.value!.venue.id;
  const line = (imports.value ?? []).find((i) => i.id === id) ?? null;
  /** Not the open place's: null (not known yet), '' (no place of this account has it), or the place it belongs to. */
  const [elsewhere, setElsewhere] = useState<string | null>(null), [error, setError] = useState('');
  /** Drawn again only when the import changed somewhere else (this device's own saves keep the preview as it is). */
  const [epoch, setEpoch] = useState(0);
  async function find() {
    if (await loadImport(id)) return;
    const p = await importPlace(id).catch(() => null);
    setElsewhere(p && p !== menu.value?.venue.id ? p : '');
  }
  useEffect(() => {
    setElsewhere(null);
    if (line) return;
    find().catch((e) => setError(toV2Error(e).code));
  }, [id, open, !!line]);
  if (error) return <ErrorLine code={error} onRetry={() => { setError(''); find().catch((e) => setError(toV2Error(e).code)); }} />;
  if (line && line.venue_id !== open) return <OtherPlace venueId={line.venue_id} />;
  if (elsewhere) return <OtherPlace venueId={elsewhere} />;
  if (elsewhere === '') return <Note kind="warn" action={<Btn small onClick={() => go('onboarding/menu')}>{t('ob.review.bring')}</Btn>}>{t('imp.missing')}</Note>;
  if (!line) return <Loading />;
  if (line.status === 'parsed') return <Preview key={line.id + ':' + epoch} line={line} onChanged={() => setEpoch((n) => n + 1)} />;
  return <NotReady line={line} />;
}

/**
 * An import of another of the account's places, opened while this one is open (Back after switching place, a link): it
 * is never checked against this place's menu nor added to it. Said plainly, with the way to its own place.
 */
function OtherPlace({ venueId }: { venueId: string }) {
  const m = memberships.value?.find((x) => x.venue.id === venueId) ?? null;
  const [unsaved, setUnsaved] = useState(false);
  if (!m) return <Note kind="warn" action={<Btn small onClick={() => go('onboarding/menu')}>{t('ob.review.bring')}</Btn>}>{t('imp.missing')}</Note>;
  const name = iso(named(m.venue, lang.value));
  function openIt() {
    leave(async () => {
      await flushSaves().catch(() => {});
      if (hasUnsaved()) { setUnsaved(true); return; }
      void openVenue(venueId);
    });
  }
  return (
    <div data-import-elsewhere={venueId}>
      <Note kind="warn" title={t('imp.other.title')} action={<Btn small kind="primary" onClick={openIt} data-action="open-import-place">{t('imp.other.open', { name })}</Btn>}>
        <p>{t('imp.other.body', { name })}</p>
        {unsaved && <p role="alert">{t('imp.other.unsaved')}</p>}
      </Note>
    </div>
  );
}

/** An import that is not waiting for its check: being read, failed, applied or given up. */
function NotReady({ line }: { line: ImportLine }) {
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [askDiscard, setAskDiscard] = useState(false);
  const image = !isTextSource(line.source);
  async function again() {
    setBusy('again'); setError('');
    try {
      const r = await runScan(line.source as 'scan' | 'wolt_screenshots', line.id);
      await loadImport(line.id);
      if (!r.ok) setError(scanWords(r.code)); else keepNotes(line.id, r.notes);
    } finally { setBusy(''); }
  }
  async function discard() {
    setBusy('discard'); setError('');
    try { await importApi.discard(line.id); await loadImports(); go('onboarding/menu'); }
    catch (e) { setError(errText(toV2Error(e).code, 'imp.e')); }
    finally { setBusy(''); setAskDiscard(false); }
  }
  const counts = line.parsed ? draftCounts(line.parsed) : null;
  return (
    <section class="card" data-import-state={line.status}>
      <p class="status"><span class={'dot ' + (line.status === 'applied' ? 'dot-on' : 'dot-off')} aria-hidden="true" />{t('imp.status.' + line.status)}</p>
      {line.status === 'applied' && counts && <p>{t('imp.appliedAt', { date: fmtDateTime(line.applied_at!) })} {t('imp.counts', { s: tn('imp.n.sections', counts.sections), d: tn('imp.n.dishes', counts.dishes), g: tn('imp.n.groups', counts.groups) })}</p>}
      {line.status === 'failed' && <p>{scanWords(line.error_code ?? 'failed')}</p>}
      {(line.status === 'uploaded' || line.status === 'parsing') && <p>{t(image ? 'imp.reading' : 'imp.unsaved')}</p>}
      {error && <Note kind="error">{error}</Note>}
      <div class="flow-actions">
        {line.status === 'applied' && <Btn kind="primary" block icon="chev" onClick={() => go('onboarding/' + ((progress.value && nextOpenAfter(progress.value, 'review')) ?? 'done'))} data-action="flow-next">{t('app.next')}</Btn>}
        {image && (line.status === 'failed' || line.status === 'uploaded') && <Btn kind="primary" block busy={busy === 'again'} icon="refresh" onClick={again} data-action="read-again">{t('imp.readAgain')}</Btn>}
        {line.status === 'parsing' && <Btn block icon="refresh" onClick={() => loadImport(line.id)} data-action="check-again">{t('imp.checkAgain')}</Btn>}
        {(line.status === 'failed' || line.status === 'uploaded') && <Btn kind="ghost" block onClick={() => setAskDiscard(true)} data-action="discard-import">{t('imp.discard')}</Btn>}
        {line.status === 'discarded' && <Btn block onClick={() => go('onboarding/menu')}>{t('ob.review.bring')}</Btn>}
      </div>
      <Confirm open={askDiscard} title={t('imp.discard.title')} body={t('imp.discard.body')} confirmLabel={t('imp.discard')} danger busy={busy === 'discard'}
        onConfirm={discard} onClose={() => setAskDiscard(false)} />
    </section>
  );
}

// ---------------------------------------------------------------- the preview
/** Imports read again because they changed elsewhere: the next preview of each says so once. */
const reread = new Set<string>();

function Preview({ line, onChanged }: { line: ImportLine & { status: 'parsed' }; onChanged: () => void }) {
  const d = menu.value!;
  const editable = canEdit();
  const langs = langsOf(d.venue);
  const [stored, setStored] = useState<ImportDraft>(line.parsed);
  /** The draft this device stored last, as of now (a save inside `apply` lands after its closure was made). */
  const lastStored = useRef<ImportDraft>(line.parsed);
  const [draft, setDraft] = useState<ImportDraft>(line.parsed);
  const [decisions, setDecisions] = useState<ImportDecisions>(() => fitAnswers(loadAnswers(line.id), line.parsed));
  const [assets, setAssets] = useState<{ id: string; dish_id: string | null; status: string }[]>([]);
  const [saving, setSaving] = useState<'' | 'saving' | 'failed'>(''), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [changed] = useState(() => reread.delete(line.id));
  const [askDiscard, setAskDiscard] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { loadAssets().then(setAssets).catch(() => {}); }, [line.id]);
  useEffect(() => { keepAnswers(line.id, decisions); }, [decisions]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const existing = useMemo(() => existingMenu(d, assets as never), [d, assets]);
  // one plan for the preview, the gate and the prices that differ whenever it can (a large menu takes a while to plan)
  const { pv, gt } = useMemo(() => review(draft, existing, decisions, langs), [draft, existing, decisions]);
  const diffs = useMemo(() => (pv.plan ? priceDiffs(draft, existing, pv.plan) : new Map()), [pv.plan]);
  const skip = leftOut(decisions);
  /** Applying would leave a place that has no dish with none: it waits, and says why (QA L2). */
  const noDish = gt.ok && addsNoDish(gt.plan, existing);
  /** A refusal in words; "too many" said without "with what you have" when the place has nothing yet. */
  const words = (code: string) => (code === 'too_many' && isEmptyMenu(existing) ? t('imp.e.too_many.alone') : errText(code, 'imp.e'));
  const counts = draftCounts(draft);
  const notes = notesFor(line.id) ?? line.notes ?? [];
  const fix = pv.rows.filter((r) => r.e.severity === 'fix'), check = pv.rows.filter((r) => r.e.severity === 'check');
  const openN = fix.filter((r) => r.open).length;
  const prices = carriesPrices(draft);

  /** A price typed in place: the draft changes now, and is stored again shortly after. */
  function edit(next: ImportDraft) {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    setSaving('saving');
    timer.current = setTimeout(() => { void store(next); }, 700);
  }
  async function store(next: ImportDraft): Promise<boolean> {
    try {
      await importApi.saveDraft(line.id, next, notes);
      lastStored.current = next; setStored(next); setSaving('');
      return true;
    } catch (e) { setSaving('failed'); setError(errText(toV2Error(e).code, 'imp.e')); return false; }
  }
  /** Applied: the menu, the imports and the progress read again, then on to the next open step. */
  async function applied(plan: ImportPlan | null, shown: ImportPlan | null) {
    dropAnswers(line.id);
    await Promise.all([reloadMenuQuietly(), loadImports().catch(() => {})]);
    const p = await loadProgress();
    // the database plans again as it applies (ADR-006): when that differs from the preview, the owner is told
    if (plan && shown && !sameSummary(plan.summary, shown.summary)) toast(t('imp.appliedOther'));
    else toast(plan && changesNothing(plan) ? t('imp.appliedNothing') : t('imp.applied'));
    go('onboarding/' + ((p && nextOpenAfter(p, 'review')) ?? 'done'));
  }
  async function apply() {
    if (busy || !gt.ok || noDish) return;
    if (line.venue_id !== menu.value?.venue.id) return;     // planned against this place's menu: never applied to another
    setBusy('apply'); setError('');
    try {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      if (!sameDraft(draft, stored) && !(await store(draft))) return;
      const shown = gt.plan;
      const r = await importApi.apply(line.id, draft, decisions);
      await applied(r.plan, shown);
    } catch (e) {
      const code = toV2Error(e).code;
      // an answer lost after the database applied it, an import closed or changed on another device: read it again first
      if (code === 'network' || code === 'import_closed' || code === 'draft_changed') {
        const now = await loadImport(line.id).catch(() => null);
        if (now?.status === 'applied') { await applied(null, null); return; }
        // changed somewhere else: not what this device stored last (its own saves are not a change elsewhere)
        if (now?.status === 'parsed' && !sameDraft(now.parsed, lastStored.current)) { reread.add(line.id); onChanged(); return; }
        if (now && now.status !== 'parsed') return;                                           // given up elsewhere: said by the screen
      }
      setError(errText(code, 'imp.e'));
    } finally { setBusy(''); }
  }
  async function discard() {
    setBusy('discard'); setError('');
    try { await importApi.discard(line.id); dropAnswers(line.id); await loadImports(); go('onboarding/menu'); }
    catch (e) { setError(errText(toV2Error(e).code, 'imp.e')); }
    finally { setBusy(''); setAskDiscard(false); }
  }

  return (
    <div class="review" data-review={line.id}>
      {changed && <Note kind="warn"><span data-reread>{t('imp.reread')}</span></Note>}
      <section class="card" aria-labelledby="read-h" data-read>
        <h2 id="read-h">{t('imp.read.title')}</h2>
        <ul class="chips" data-counts={`${counts.sections}/${counts.dishes}/${counts.groups}/${counts.options}`}>
          <li class="chip">{tn('imp.n.sections', counts.sections)}</li>
          <li class="chip">{tn('imp.n.dishes', counts.dishes)}</li>
          {counts.groups > 0 && <li class="chip">{tn('imp.n.groups', counts.groups)}</li>}
          {counts.options > 0 && <li class="chip">{tn('imp.n.options', counts.options)}</li>}
        </ul>
        {counts.dropped > 0 && <p class="fine" data-dropped={counts.dropped}>{tn('imp.dropped', counts.dropped)}</p>}
        <p class="fine">{t('imp.nothingYet')}</p>
      </section>

      {notes.length > 0 && (
        <section class="card" aria-labelledby="notes-h" data-notes>
          <h2 id="notes-h">{t('imp.notes.title')}</h2>
          <ul class="notelist">
            {noteLines(notes).map((n) => (
              <li key={n.code} data-note={n.code} data-severity={n.severity} data-count={n.count}>
                <Icon name={n.severity === 'check' ? 'alert' : 'info'} size={16} />
                <span>{tn('note.' + n.code, n.count)}{n.lines.length > 0 && <span class="fine"> · {tn('imp.lines', n.lines.length, { list: n.lines.slice(0, 8).join(', ') + (n.lines.length > 8 ? '…' : '') })}</span>}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {fix.length > 0 && (
        <section class="card" aria-labelledby="fix-h" data-fix>
          <h2 id="fix-h">{openN ? tn('imp.fix.open', openN) : t('imp.fix.done')}</h2>
          <ul class="exclist">{fix.map((r) => <Exception key={r.id} r={r} draft={draft} editable={editable} diffs={diffs} onChoose={(c) => setDecisions(choose(decisions, r.id, c))} onEdit={edit} />)}</ul>
        </section>
      )}
      {check.length > 0 && (
        <section class="card" aria-labelledby="check-h" data-check>
          <h2 id="check-h">{tn('imp.check.title', check.length)}</h2>
          <p class="fine">{t('imp.check.lead')}</p>
          <ul class="exclist">{check.map((r) => <Exception key={r.id} r={r} draft={draft} editable={editable} diffs={diffs} onChoose={(c) => setDecisions(choose(decisions, r.id, c))} onEdit={edit} />)}</ul>
        </section>
      )}

      <DraftList draft={draft} skip={skip} editable={editable} onLeave={(key, out) => setDecisions(leaveOut(decisions, key, out))} />

      <section class="card" aria-labelledby="plan-h" data-plan>
        <h2 id="plan-h">{t('imp.plan.title')}</h2>
        {pv.plan ? (changesNothing(pv.plan)
          ? (allLeftOut(pv.plan) ? <p data-plan-nothing="left-out">{t('imp.plan.allOut')}</p> : <p data-plan-nothing>{t('imp.plan.nothing')}</p>)
          : <ul class="planlist">{planLines(pv.plan).map((x) => (
            <li key={x.op + x.kind + (x.reason ?? '')} data-plan-line={x.op + ':' + x.kind} data-n={x.n} data-reason={x.reason ?? undefined}>
              {t('imp.op.' + x.op, { what: tn(KIND_WORDS[x.kind], x.n) })}{x.reason && <span class="fine"> · {t(has('imp.why.' + x.reason + '.' + x.kind) ? 'imp.why.' + x.reason + '.' + x.kind : 'imp.why.' + x.reason)}</span>}
            </li>
          ))}</ul>)
          : <p class="muted">{t('imp.plan.none')}</p>}
        {pv.plan && openN > 0 && <p class="fine">{t('imp.plan.provisional')}</p>}
        {pv.planErrors.map((e, i) => <p key={i} class="ferr" data-plan-error={e.code}>{words(e.code)}</p>)}
        <p class="fine">{t('imp.plan.never')}</p>
      </section>

      {editable && (
        <section class="card applycard" data-apply>
          {prices && (
            <div class="switchrow" data-prices-confirm>
              <span>{t('imp.prices.confirm')}</span>
              <Switch checked={decisions.pricesConfirmed} onChange={(on) => setDecisions(confirmPrices(decisions, on))} label={t('imp.prices.confirm')} />
            </div>
          )}
          {prices && <p class="fine">{t('imp.prices.hint')}</p>}
          {noDish && <p class="fine" data-apply-blocked="no-dish">{t('imp.blocked.noDish')}</p>}
          {!gt.ok && <ul class="fine" data-apply-blocked>
            {gt.open > 0 && <li>{tn('imp.blocked.open', gt.open)}</li>}
            {gt.prices && <li>{t('imp.blocked.prices')}</li>}
            {gt.errors.map((e, i) => <li key={i} data-blocked={e.code}>{words(e.code)}</li>)}
          </ul>}
          {saving === 'saving' && <p class="fine" role="status">{t('save.saving')}</p>}
          {error && <Note kind="error">{error}</Note>}
          <Btn kind="primary" block busy={busy === 'apply'} disabled={!gt.ok || noDish || saving === 'saving'} icon="check" onClick={apply} data-action="apply-import">{t('imp.apply')}</Btn>
          <p class="fine center">{t('imp.apply.note')}</p>
          <Btn kind="ghost" block onClick={() => setAskDiscard(true)} data-action="discard-import">{t('imp.discard')}</Btn>
          <Confirm open={askDiscard} title={t('imp.discard.title')} body={t('imp.discard.body')} confirmLabel={t('imp.discard')} danger busy={busy === 'discard'}
            onConfirm={discard} onClose={() => setAskDiscard(false)} />
        </section>
      )}
    </div>
  );
}

/** One exception: what it is about, in plain words, its answers, and for a price the field to type it in. */
function Exception({ r, draft, editable, diffs, onChoose, onEdit }: {
  r: ExceptionRow; draft: ImportDraft; editable: boolean; diffs: Map<string, { key: string; name: Text; yours: number; read: number }[]>;
  onChoose: (c: ImportChoice | null) => void; onEdit: (d: ImportDraft) => void;
}) {
  const what = t('imp.x.' + r.e.code, { name: iso(say(r.about.name) || t('menu2.unnamed')), within: iso(say(r.about.within)), theirs: iso(say(r.about.theirs)), n: r.e.count });
  const listed = r.e.code === 'price_differs' ? diffs.get(r.e.key.split('@')[0]!) ?? [] : [];
  const label = (c: ImportChoice) => t('imp.c.' + c);
  return (
    <li class={'exc' + (r.open ? ' is-open' : '')} data-exception={r.id} data-code={r.e.code} data-open={r.open ? 'yes' : 'no'} data-choice={r.effective ?? ''}>
      {/* the sentence keeps the screen's direction; each name inside it is isolated (iso) */}
      <p class="exc-what"><span class={'badge ' + (r.e.severity === 'fix' ? 'badge-warn' : 'badge-todo')}>{t(r.e.severity === 'fix' ? 'imp.fix' : 'imp.check')}</span> <span class="exc-text">{what}</span></p>
      {listed.length > 0 && <ul class="fine pricediff">{listed.map((x) => <li key={x.key}><span dir="auto">{say(x.name)}</span>: {t('imp.diff', { yours: shekels(x.yours), read: shekels(x.read) })}</li>)}</ul>}
      {editable && r.edit && <PriceFix r={r} draft={draft} onEdit={onEdit} />}
      {/* a fix with one answer is still answered by the owner (too_many: "leave it out"), so it is a button too */}
      {editable && (r.choices.length > 1 || r.e.severity === 'fix') && (
        <div class="kindchips" role="radiogroup" aria-label={what}>
          {r.choices.map((c) => (
            <button key={c} type="button" role="radio" class="kindchip" aria-checked={r.effective === c ? 'true' : 'false'} data-choose={c}
              onClick={() => onChoose(c)}>{label(c)}</button>
          ))}
        </div>
      )}
      {r.choices.length === 1 && r.e.severity === 'check' && <p class="fine">{label(r.choices[0]!)}</p>}
      {r.refused && <p class="ferr" role="alert" data-refused={r.refused}>{t('imp.refused.' + r.refused)}</p>}
    </li>
  );
}

/** A price the owner types where the source had none or an unreadable one (a dish's, or a choice's). */
function PriceFix({ r, draft, onEdit }: { r: ExceptionRow; draft: ImportDraft; onEdit: (d: ImportDraft) => void }) {
  const dish = r.edit === 'dish_price' ? draft.sections.flatMap((s) => s.dishes).find((x) => x.key === r.e.key) : null;
  const option = r.edit === 'option_price' ? draft.groups.flatMap((g) => g.options).find((x) => x.key === r.e.key) : null;
  const had = dish ? dish.price : option ? option.price : null;
  const shownText = dish?.priceText ?? option?.priceText ?? null;
  const [value, setValue] = useState(had === null ? '' : shekelsOf(had));
  const [bad, setBad] = useState(false);
  const id = 'fix-' + r.id.replace(/[^a-z0-9]/gi, '-');
  function commit() {
    const a = agorotOf(value);
    if (a === 'invalid' || (a === null && r.edit === 'option_price')) { setBad(true); return; }
    setBad(false);
    onEdit(r.edit === 'dish_price' ? withDishPrice(draft, r.e.key, a) : withOptionPrice(draft, r.e.key, a ?? 0));
  }
  return (
    <div class="pricefix">
      {shownText && !isBlank(shownText) && <p class="fine">{t('imp.priceText')} <Ltr dir="auto">{shownText}</Ltr></p>}
      <label class="flabel" for={id}>{t('imp.typePrice')}</label>
      <div class="pricefix-row">
        <MoneyInput id={id} value={value} invalid={bad} onInput={setValue} field={'fix-price-' + r.e.key} />
        <Btn small onClick={commit} disabled={!value.trim()} data-action="set-price">{t('imp.setPrice')}</Btn>
      </div>
      {bad && <p class="ferr" role="alert">{t('menu.item.badPrice')}</p>}
    </div>
  );
}

/**
 * Everything that was read, section by section, with its prices: what the owner confirms (open; each section folds).
 * Anything can be left out here (a section, a dish, an add-on group, a choice; ADR-006 `skip`) and put back: the plan
 * then says it is left out, as the owner chose, and what is inside it goes with it.
 */
function DraftList({ draft, skip, editable, onLeave }: { draft: ImportDraft; skip: ReadonlySet<string>; editable: boolean; onLeave: (key: string, out: boolean) => void }) {
  const groups = new Map(draft.groups.map((g) => [g.key, g] as const));
  // plain calls, not components: a button keeps its place (and the focus) when the list draws again
  // `all`: an add-on group, left out of every dish that has it (wherever its button is)
  const leaveBtn = (k: string, name: string, all = false) => (editable
    ? <button type="button" class="leavebtn" aria-pressed={skip.has(k) ? 'true' : 'false'} data-leave={k}
      aria-label={t(skip.has(k) ? 'imp.putBackOf' : all ? 'imp.leaveAllOf' : 'imp.leaveOf', { name: iso(name || t('menu2.unnamed')) })} onClick={() => onLeave(k, !skip.has(k))}>
      {t(skip.has(k) ? 'imp.putBack' : all ? 'imp.leaveAll' : 'imp.leave')}
    </button>
    : null);
  const out = (all = false) => <span class="badge badge-todo">{t(all ? 'imp.leftOutAll' : 'imp.leftOut')}</span>;
  return (
    <section class="card" aria-labelledby="draft-h" data-draft-list>
      <h2 id="draft-h">{t('imp.list.title')}</h2>
      {editable && <p class="fine">{t('imp.leave.lead')}</p>}
      {draft.sections.map((s) => (
        <details key={s.key} class={'draftsec' + (skip.has(s.key) ? ' is-out' : '')} data-draft-section={s.key} data-out={skip.has(s.key) ? 'yes' : 'no'} open>
          <summary><span class="strong" dir="auto">{say(s.name)}</span> <span class="fine">{tn('imp.n.dishes', s.dishes.length)}</span>{skip.has(s.key) && <> {out()}</>}</summary>
          <div class="leaverow">{leaveBtn(s.key, say(s.name))}</div>
          <ul class="draftdishes">
            {s.dishes.map((x) => (
              <li key={x.key} data-draft-dish={x.key} data-out={skip.has(x.key) || skip.has(s.key) ? 'yes' : 'no'} class={skip.has(x.key) || skip.has(s.key) ? 'is-out' : undefined}>
                <p class="draftdish-line">
                  <span dir="auto" class="strong">{say(x.name)}</span>
                  <span class="draftdish-price">{x.price !== null ? <Ltr class="price">{shekels(x.price)}</Ltr> : <span class="muted">{x.priceText ? t('imp.priceUnread') : t('menu.item.noPrice')}</span>}</span>
                </p>
                {!skip.has(s.key) && <div class="leaverow">{skip.has(x.key) && out()}{leaveBtn(x.key, say(x.name))}</div>}
                {!isBlank(say(x.desc)) && <p class="fine" dir="auto">{say(x.desc)}</p>}
                {!isBlank(say(x.priceNote)) && <p class="fine" dir="auto">{say(x.priceNote)}</p>}
                {x.tags.length > 0 && <p class="fine">{x.tags.map((g) => t('tag.' + g)).join(' · ')}</p>}
                {!isBlank(say(x.allergens)) && <p class="fine"><span>{t('imp.allergens')}</span> <span dir="auto">{say(x.allergens)}</span></p>}
                <p class="fine">{x.illustration ? t('pic.illus') : t('ob.noPhotoYet')}</p>
                {x.groups.map((a) => {
                  const g = groups.get(a.group);
                  if (!g) return null;
                  return (
                    <div key={a.group} class={'draftgroup' + (skip.has(g.key) ? ' is-out' : '')} data-draft-group={g.key} data-out={skip.has(g.key) ? 'yes' : 'no'}>
                      <p class="fine strong draftgroup-head"><span dir="auto">{say(g.name)}</span>{skip.has(g.key) && out(true)}{!skip.has(x.key) && !skip.has(s.key) && leaveBtn(g.key, say(g.name), true)}</p>
                      <ul class="fine">{g.options.map((o) => {
                        const nested = o.opens ? groups.get(o.opens) : null;
                        return (
                          <li key={o.key} data-draft-option={o.key} data-out={skip.has(o.key) ? 'yes' : 'no'} class={skip.has(o.key) ? 'is-out' : undefined}>
                            <span dir="auto">{say(o.name)}</span>{o.price !== null && o.price > 0 && <> <Ltr>+{shekels(o.price)}</Ltr></>}{o.price === null && <> · {t('imp.priceUnread')}</>}
                            {nested && <span class="nested"> › <span dir="auto">{say(nested.name)}</span>: {nested.options.map((n) => say(n.name) + (n.price ? ' +' + shekels(n.price) : '')).join(', ')}</span>}
                            {!skip.has(g.key) && !skip.has(x.key) && !skip.has(s.key) && <> {leaveBtn(o.key, say(o.name))}</>}
                          </li>
                        );
                      })}</ul>
                    </div>
                  );
                })}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
