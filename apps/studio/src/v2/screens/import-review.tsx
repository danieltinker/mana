// Checking an imported menu (#/onboarding/review/<import>; F03 step 3, ADR-006): what was read (sections, dishes,
// prices, add-on groups, and what the reader says about the source), the exceptions to fix or decide in place, and the
// plan: what applying would add to the menu, update, find already there, or leave out. Nothing is saved to the menu
// until the owner applies (apply_import, which runs exactly this plan: never a delete, never a duplicate). Prices read
// are shown and confirmed before they count; allergens are the source's own words, and labels only those the source
// states. Source text is shown as text, never as HTML.
//
// The owner's answers stay on this device until applying (there is no column for them); a price typed in place changes
// the draft, which is stored again at once (save_import_draft), so another device sees it.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  draftCounts, isBlank, type ImportChoice, type ImportDecisions, type ImportDraft, type Text,
} from '@mana/contracts';
import { toast } from '../../lib/store.ts';
import { Btn, Icon, Loading, Ltr, Note, Switch, go } from '../../ui.tsx';
import { toV2Error } from '../data/errors.ts';
import { nextOpenAfter } from '../data/flow.ts';
import { agorotOf, shekelsOf } from '../data/forms.ts';
import { existingMenu, isTextSource, type ImportLine } from '../data/imports.ts';
import { importApi, imports, keepNotes, loadAssets, loadImport, loadImports, loadProgress, notesFor, progress, runScan } from '../data/onboarding.ts';
import {
  carriesPrices, changesNothing, choose, confirmPrices, gate, NO_DECISIONS, planLines, preview, priceDiffs, sameDraft, withDishPrice, withOptionPrice,
  type ExceptionRow,
} from '../data/review.ts';
import { canEdit, menu, reloadMenuQuietly } from '../data/store.ts';
import { langsOf, shekels } from '../format.ts';
import { errText, fmtDateTime, lang, t, tn } from '../i18n.ts';
import { ErrorLine, MoneyInput } from '../ui.tsx';

const say = (x: Text | null | undefined): string => {
  if (!x) return '';
  const L = lang.value;
  return (L === 'he' ? x.he || x.en : x.en || x.he).trim();
};

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
                <span class="row-sub"><span class={'badge ' + (i.status === 'parsed' ? 'badge-warn' : i.status === 'failed' ? 'badge-bad' : 'badge-todo')}>{t('imp.status.' + i.status)}</span><span class="fine">{fmtDateTime(i.created_at)}</span></span>
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
  const line = (imports.value ?? []).find((i) => i.id === id) ?? null;
  const [missing, setMissing] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    if (line) return;
    loadImport(id).then((x) => setMissing(!x)).catch((e) => setError(toV2Error(e).code));
  }, [id, !!line]);
  if (error) return <ErrorLine code={error} onRetry={() => { setError(''); loadImport(id).catch((e) => setError(toV2Error(e).code)); }} />;
  if (missing) return <Note kind="warn" action={<Btn small onClick={() => go('onboarding/menu')}>{t('ob.review.bring')}</Btn>}>{t('imp.missing')}</Note>;
  if (!line) return <Loading />;
  if (line.status === 'parsed') return <Preview key={line.id + line.updated_at} line={line} />;
  return <NotReady line={line} />;
}

/** An import that is not waiting for its check: being read, failed, applied or given up. */
function NotReady({ line }: { line: ImportLine }) {
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const image = !isTextSource(line.source);
  async function again() {
    setBusy('again'); setError('');
    try {
      const r = await runScan(line.source as 'scan' | 'wolt_screenshots', line.id);
      await loadImport(line.id);
      if (!r.ok) setError(errText(r.code, 'ob.scan.e')); else keepNotes(line.id, r.notes);
    } finally { setBusy(''); }
  }
  async function discard() {
    setBusy('discard'); setError('');
    try { await importApi.discard(line.id); await loadImports(); go('onboarding/menu'); }
    catch (e) { setError(errText(toV2Error(e).code, 'imp.e')); }
    finally { setBusy(''); }
  }
  const counts = line.parsed ? draftCounts(line.parsed) : null;
  return (
    <section class="card" data-import-state={line.status}>
      <p class="status"><span class={'dot ' + (line.status === 'applied' ? 'dot-on' : 'dot-off')} aria-hidden="true" />{t('imp.status.' + line.status)}</p>
      {line.status === 'applied' && counts && <p>{t('imp.appliedAt', { date: fmtDateTime(line.applied_at!) })} {t('imp.counts', { s: counts.sections, d: counts.dishes, g: counts.groups })}</p>}
      {line.status === 'failed' && <p>{errText(line.error_code ?? 'failed', 'ob.scan.e')}</p>}
      {(line.status === 'uploaded' || line.status === 'parsing') && <p>{t(image ? 'imp.reading' : 'imp.unsaved')}</p>}
      {error && <Note kind="error">{error}</Note>}
      <div class="flow-actions">
        {line.status === 'applied' && <Btn kind="primary" block icon="chev" onClick={() => go('onboarding/' + ((progress.value && nextOpenAfter(progress.value, 'review')) ?? 'done'))} data-action="flow-next">{t('ob.next')}</Btn>}
        {image && (line.status === 'failed' || line.status === 'uploaded') && <Btn kind="primary" block busy={busy === 'again'} icon="refresh" onClick={again} data-action="read-again">{t('imp.readAgain')}</Btn>}
        {line.status === 'parsing' && <Btn block icon="refresh" onClick={() => loadImport(line.id)} data-action="check-again">{t('imp.checkAgain')}</Btn>}
        {(line.status === 'failed' || line.status === 'uploaded') && <Btn kind="ghost" block busy={busy === 'discard'} onClick={discard} data-action="discard-import">{t('imp.discard')}</Btn>}
        {line.status === 'discarded' && <Btn block onClick={() => go('onboarding/menu')}>{t('ob.review.bring')}</Btn>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- the preview
const ANSWERS_KEY = (id: string) => 'mana-import-answers:' + id;
function loadAnswers(id: string): ImportDecisions {
  try {
    const raw = localStorage.getItem(ANSWERS_KEY(id));
    if (!raw) return NO_DECISIONS;
    const j = JSON.parse(raw) as { choices?: Record<string, ImportChoice>; skip?: string[] };
    // the prices are confirmed again on every visit: never published unseen
    return { v: 1, pricesConfirmed: false, choices: j.choices ?? {}, skip: j.skip ?? [] };
  } catch { return NO_DECISIONS; }
}
function keepAnswers(id: string, d: ImportDecisions) {
  try { localStorage.setItem(ANSWERS_KEY(id), JSON.stringify({ choices: d.choices, skip: d.skip ?? [] })); } catch { /* storage is optional */ }
}
const dropAnswers = (id: string) => { try { localStorage.removeItem(ANSWERS_KEY(id)); } catch { /* storage is optional */ } };

function Preview({ line }: { line: ImportLine & { status: 'parsed' } }) {
  const d = menu.value!;
  const editable = canEdit();
  const langs = langsOf(d.venue);
  const [stored, setStored] = useState<ImportDraft>(line.parsed);
  const [draft, setDraft] = useState<ImportDraft>(line.parsed);
  const [decisions, setDecisions] = useState<ImportDecisions>(() => loadAnswers(line.id));
  const [assets, setAssets] = useState<{ id: string; dish_id: string | null; status: string }[]>([]);
  const [saving, setSaving] = useState<'' | 'saving' | 'failed'>(''), [busy, setBusy] = useState(''), [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { loadAssets().then(setAssets).catch(() => {}); }, [line.id]);
  useEffect(() => { keepAnswers(line.id, decisions); }, [decisions]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const existing = useMemo(() => existingMenu(d, assets as never), [d, assets]);
  const pv = useMemo(() => preview(draft, existing, decisions, langs), [draft, existing, decisions]);
  const gt = useMemo(() => gate(draft, existing, decisions, langs), [draft, existing, decisions]);
  const diffs = useMemo(() => (pv.plan ? priceDiffs(draft, existing, pv.plan) : new Map()), [pv.plan]);
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
      setStored(next); setSaving('');
      return true;
    } catch (e) { setSaving('failed'); setError(errText(toV2Error(e).code, 'imp.e')); return false; }
  }
  async function apply() {
    if (busy || !gt.ok) return;
    setBusy('apply'); setError('');
    try {
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      if (!sameDraft(draft, stored) && !(await store(draft))) return;
      const r = await importApi.apply(line.id, draft, decisions);
      dropAnswers(line.id);
      await Promise.all([reloadMenuQuietly(), loadImports().catch(() => {})]);
      const p = await loadProgress();
      toast(changesNothing(r.plan) ? t('imp.appliedNothing') : t('imp.applied'));
      go('onboarding/' + ((p && nextOpenAfter(p, 'review')) ?? 'done'));
    } catch (e) { setError(errText(toV2Error(e).code, 'imp.e')); }
    finally { setBusy(''); }
  }
  async function discard() {
    setBusy('discard'); setError('');
    try { await importApi.discard(line.id); dropAnswers(line.id); await loadImports(); go('onboarding/menu'); }
    catch (e) { setError(errText(toV2Error(e).code, 'imp.e')); }
    finally { setBusy(''); }
  }

  return (
    <div class="review" data-review={line.id}>
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
            {notes.map((n, i) => (
              <li key={i} data-note={n.code} data-severity={n.severity}>
                <Icon name={n.severity === 'check' ? 'alert' : 'info'} size={16} />
                <span>{t('note.' + n.code, { n: n.count })}{n.lines.length > 0 && <span class="fine"> · {tn('imp.lines', n.lines.length, { list: n.lines.slice(0, 8).join(', ') + (n.lines.length > 8 ? '…' : '') })}</span>}</span>
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

      <DraftList draft={draft} />

      <section class="card" aria-labelledby="plan-h" data-plan>
        <h2 id="plan-h">{t('imp.plan.title')}</h2>
        {pv.plan ? (changesNothing(pv.plan)
          ? <p data-plan-nothing>{t('imp.plan.nothing')}</p>
          : <ul class="planlist">{planLines(pv.plan).map((x) => <li key={x.op + x.kind} data-plan-line={x.op + ':' + x.kind} data-n={x.n}>{tn('imp.plan.' + x.op + '.' + x.kind, x.n)}</li>)}</ul>)
          : <p class="muted">{t('imp.plan.none')}</p>}
        {pv.plan && openN > 0 && <p class="fine">{t('imp.plan.provisional')}</p>}
        {pv.planErrors.map((e, i) => <p key={i} class="ferr" data-plan-error={e.code}>{errText(e.code, 'imp.e')}</p>)}
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
          {!gt.ok && <ul class="fine" data-apply-blocked>
            {gt.open > 0 && <li>{tn('imp.blocked.open', gt.open)}</li>}
            {gt.prices && <li>{t('imp.blocked.prices')}</li>}
            {gt.errors.map((e, i) => <li key={i}>{errText(e.code, 'imp.e')}</li>)}
          </ul>}
          {saving === 'saving' && <p class="fine" role="status">{t('save.saving')}</p>}
          {error && <Note kind="error">{error}</Note>}
          <Btn kind="primary" block busy={busy === 'apply'} disabled={!gt.ok || saving === 'saving'} icon="check" onClick={apply} data-action="apply-import">{t('imp.apply')}</Btn>
          <p class="fine center">{t('imp.apply.note')}</p>
          <Btn kind="ghost" block busy={busy === 'discard'} onClick={discard} data-action="discard-import">{t('imp.discard')}</Btn>
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
  const what = t('imp.x.' + r.e.code, { name: say(r.about.name) || t('menu2.unnamed'), within: say(r.about.within), theirs: say(r.about.theirs), n: r.e.count });
  const listed = r.e.code === 'price_differs' ? diffs.get(r.e.key.split('@')[0]!) ?? [] : [];
  const label = (c: ImportChoice) => t('imp.c.' + r.e.code + '.' + c);
  return (
    <li class={'exc' + (r.open ? ' is-open' : '')} data-exception={r.id} data-code={r.e.code} data-open={r.open ? 'yes' : 'no'} data-choice={r.effective ?? ''}>
      <p class="exc-what"><span class={'badge ' + (r.e.severity === 'fix' ? 'badge-warn' : 'badge-todo')}>{t(r.e.severity === 'fix' ? 'imp.fix' : 'imp.check')}</span> <span dir="auto">{what}</span></p>
      {listed.length > 0 && <ul class="fine pricediff">{listed.map((x) => <li key={x.key}><span dir="auto">{say(x.name)}</span>: {t('imp.diff', { yours: shekels(x.yours), read: shekels(x.read) })}</li>)}</ul>}
      {editable && r.edit && <PriceFix r={r} draft={draft} onEdit={onEdit} />}
      {editable && r.choices.length > 1 && (
        <div class="kindchips" role="radiogroup" aria-label={what}>
          {r.choices.map((c) => (
            <button key={c} type="button" role="radio" class="kindchip" aria-checked={r.effective === c ? 'true' : 'false'} data-choose={c}
              onClick={() => onChoose(c)}>{label(c)}</button>
          ))}
        </div>
      )}
      {r.choices.length === 1 && r.e.severity === 'check' && <p class="fine">{label(r.choices[0]!)}</p>}
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

/** Everything that was read, section by section, with its prices: what the owner confirms. */
function DraftList({ draft }: { draft: ImportDraft }) {
  const groups = new Map(draft.groups.map((g) => [g.key, g] as const));
  return (
    <section class="card" aria-labelledby="draft-h" data-draft-list>
      <h2 id="draft-h">{t('imp.list.title')}</h2>
      {draft.sections.map((s) => (
        <details key={s.key} class="draftsec" data-draft-section={s.key} open={draft.sections.length <= 3}>
          <summary><span class="strong" dir="auto">{say(s.name)}</span> <span class="fine">{tn('imp.n.dishes', s.dishes.length)}</span></summary>
          <ul class="draftdishes">
            {s.dishes.map((x) => (
              <li key={x.key} data-draft-dish={x.key}>
                <p class="draftdish-line">
                  <span dir="auto" class="strong">{say(x.name)}</span>
                  <span class="draftdish-price">{x.price !== null ? <Ltr class="price">{shekels(x.price)}</Ltr> : <span class="muted">{x.priceText ? t('imp.priceUnread') : t('menu.item.noPrice')}</span>}</span>
                </p>
                {!isBlank(say(x.desc)) && <p class="fine" dir="auto">{say(x.desc)}</p>}
                {!isBlank(say(x.priceNote)) && <p class="fine" dir="auto">{say(x.priceNote)}</p>}
                {x.tags.length > 0 && <p class="fine">{x.tags.map((g) => t('tag.' + g)).join(' · ')}</p>}
                {!isBlank(say(x.allergens)) && <p class="fine"><span>{t('imp.allergens')}</span> <span dir="auto">{say(x.allergens)}</span></p>}
                <p class="fine">{x.illustration ? t('pic.illus') : t('ob.noPhotoYet')}</p>
                {x.groups.map((a) => {
                  const g = groups.get(a.group);
                  if (!g) return null;
                  return (
                    <div key={a.group} class="draftgroup" data-draft-group={g.key}>
                      <p class="fine strong" dir="auto">{say(g.name)}</p>
                      <ul class="fine">{g.options.map((o) => {
                        const nested = o.opens ? groups.get(o.opens) : null;
                        return (
                          <li key={o.key} data-draft-option={o.key}>
                            <span dir="auto">{say(o.name)}</span>{o.price !== null && o.price > 0 && <> <Ltr>+{shekels(o.price)}</Ltr></>}{o.price === null && <> · {t('imp.priceUnread')}</>}
                            {nested && <span class="nested"> › <span dir="auto">{say(nested.name)}</span>: {nested.options.map((n) => say(n.name) + (n.price ? ' +' + shekels(n.price) : '')).join(', ')}</span>}
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
