/**
 * Every write of the back office goes through <Write>: the fields, then a review step that says in words what will
 * happen and asks for the reason (3–500 characters; the owner reads it), and only then the call. The review freezes
 * what it describes: Go sends exactly the input the sentence was made from, never the fields as they are later. When
 * something the review depends on changes while it is open (the owner publishes, another "Restore…" is clicked), the
 * review is dropped, nothing is sent, and the fields say why. The result is shown where the write was made, and gets
 * the focus; a refusal says that nothing changed.
 *
 * A lost answer (a timeout or a network failure after the call left) is not a refusal: the write may have happened.
 * The page says so, reads again whether the change is there (`landed`, from fresh data: the change recognised by its
 * value), and waits `RETRY_GAP_MS` before it believes "not there" (the server may still be working on it). Go is offered
 * again only when the change is known not to be there; when the page cannot tell, it says so and offers a new check,
 * never a blind second send. A refusal that says it is already so (`already`: the value is there, made by a send
 * whose answer was lost or by another staff member) is shown as done, never blamed on the owner.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { isReason, REASON_MAX, REASON_MIN, stripBlank, textLength } from '@mana/contracts';
import type { Fail, Result } from './api.ts';
import { Icon, Notice, T } from './ui.tsx';

/** What the write will do and the input that does it (from the fields, as they are at the review), or why it cannot be reviewed. */
export type WritePlan<I> =
  | { readonly ok: true; readonly what: string; readonly note?: string; readonly input: I }
  | { readonly ok: false; readonly why: string };

/** Is the reviewed change there now? */
export type Landed = 'yes' | 'no' | 'unknown';

/** Refusals that mean the review was out of date: back to the fields, to review again. */
const REVIEW_AGAIN: ReadonlySet<string> = new Set(['stale', 'revision_changed']);

declare global {
  interface Window {
    /** Tests shorten the wait before a lost write is believed not to have happened. */
    __OPS_RETRY_GAP_MS?: number;
  }
}
/** After a lost answer, how long to wait before "the change is not there" is believed (a slow server may still apply it). */
export const RETRY_GAP_MS = 5_000;

export type WriteProps<I, D> = {
  /** data-write="…" for tests and a stable id prefix. */
  readonly id: string;
  /** The write cannot be made at all: the reason is shown and the fields are disabled. */
  readonly blocked?: string | null;
  /** Run at the review; may read what it needs to describe the change (async). */
  readonly plan: () => WritePlan<I> | Promise<WritePlan<I>>;
  /** The reason's hint; `false` for a write whose function takes no reason. */
  readonly reason?: string | false;
  readonly submit: string;
  /** Sends the reviewed input with the reason. */
  readonly run: (input: I, reason: string) => Promise<Result<D>>;
  readonly done: (data: D) => string;
  /** After it worked: `data` is null when the answer was lost but the change was found, or a refusal said it is already so. */
  readonly onDone?: (data: D | null) => unknown;
  /** After a failed run: more words for the error (the current values a refusal carries), and a chance to refresh. */
  readonly onFail?: (f: Fail) => string | null | undefined | void;
  /** After a lost answer: reads whether the reviewed change is there now (by its value). Without it the page cannot tell. */
  readonly landed?: (input: I) => Promise<Landed>;
  /** A refusal that means the change is already there: the words to show as the result, or null for a real refusal. */
  readonly already?: (f: Fail, input: I) => string | null;
  /** What the review depends on beyond its fields. When `key` changes while the review is open, the review is dropped
   * and `note` is shown with the fields. */
  readonly changed?: { readonly key: unknown; readonly note: string } | null;
  /** When this changes after the first render, the reason field gets the focus (the form was prefilled for the user). */
  readonly focusKey?: unknown;
  readonly children?: ComponentChildren;
};

type Reviewed<I> = { readonly what: string; readonly note: string | null; readonly input: I; readonly reason: string };
type Lost = 'checking' | 'waiting' | 'unknown';

export function Write<I, D>(p: WriteProps<I, D>) {
  const [step, setStep] = useState<'edit' | 'planning' | 'confirm' | 'running' | 'lost'>('edit');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [plan, setPlan] = useState<Reviewed<I> | null>(null);
  const [lost, setLost] = useState<Lost | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const resultEl = useRef<HTMLDivElement>(null);
  const reasonEl = useRef<HTMLTextAreaElement>(null);
  /** Each review gets a number; an answer to a review that was dropped is ignored. */
  const seq = useRef(0);
  const reviewedKey = useRef<unknown>(undefined);
  const wantFocus = useRef<'reason' | 'result' | null>(null);
  const lastFocusKey = useRef(p.focusKey);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (p.focusKey !== lastFocusKey.current) { lastFocusKey.current = p.focusKey; wantFocus.current = 'reason'; }
  const needsReason = p.reason !== false;
  const key = p.changed?.key;

  useEffect(() => () => { seq.current += 1; if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (step === 'confirm') box.current?.focus(); }, [step]);
  // what the review described changed while it was open: drop it, send nothing
  useEffect(() => {
    if ((step === 'planning' || step === 'confirm') && !Object.is(key, reviewedKey.current)) {
      seq.current += 1;
      setStep('edit'); setPlan(null); setError(null);
      setDropped(p.changed?.note ?? 'What you reviewed changed. Nothing was sent: review it again.');
    }
  }, [key, step]);
  useEffect(() => {
    if (wantFocus.current === 'reason' && reasonEl.current) { wantFocus.current = null; reasonEl.current.focus(); }
    else if (wantFocus.current === 'result' && resultEl.current) { wantFocus.current = null; resultEl.current.focus(); }
  });

  const review = async (e: Event) => {
    e.preventDefault();
    if (step !== 'edit') return;
    setResult(null); setDropped(null);
    const mine = ++seq.current;
    reviewedKey.current = key;
    setStep('planning'); setError(null);
    let pl: WritePlan<I>;
    try { pl = await p.plan(); } catch { pl = { ok: false, why: 'Could not prepare the review. Try again.' }; }
    if (mine !== seq.current) return;
    if (!pl.ok) { setStep('edit'); setError(pl.why); return; }
    if (needsReason && !isReason(reason)) { setStep('edit'); setError(`Write a reason of ${REASON_MIN} to ${REASON_MAX} characters. The owner reads it.`); return; }
    setPlan({ what: pl.what, note: pl.note ?? null, input: pl.input, reason: needsReason ? stripBlank(reason) : '' });
    setStep('confirm');
  };

  const succeed = async (text: string, data: D | null) => {
    setStep('edit'); setReason(''); setPlan(null); setLost(null); setError(null);
    setResult(text);
    wantFocus.current = 'result';
    await p.onDone?.(data);
  };

  /** After a lost answer: is the change there? Once at once, and once more after the gap before "no" is believed. */
  const settle = async (pl: Reviewed<I>, mine: number, failedAt: number, again: boolean): Promise<void> => {
    timer.current = null;
    setStep('lost'); setError(null); setLost('checking');
    let got: Landed = 'unknown';
    if (p.landed) { try { got = await p.landed(pl.input); } catch { got = 'unknown'; } }
    if (mine !== seq.current) return;
    if (got === 'yes') { await succeed('Done. The answer did not arrive, but the change is there now: it was made once.', null); return; }
    if (got === 'no') {
      const wait = failedAt + (window.__OPS_RETRY_GAP_MS || RETRY_GAP_MS) - Date.now();
      if (!again) { setLost('waiting'); timer.current = setTimeout(() => void settle(pl, mine, failedAt, true), Math.max(0, wait)); return; }
      // not there, after the gap: nothing was made, and the same review may be sent again
      setLost(null); setStep('confirm');
      setError('The answer did not arrive, and the change is not there: nothing was made. You can send it again.');
      return;
    }
    setLost('unknown');
  };

  const go = async () => {
    if (!plan || step !== 'confirm') return;
    const mine = seq.current;
    setStep('running'); setError(null);
    const r = await p.run(plan.input, plan.reason);
    if (mine !== seq.current) return;
    if (!r.ok && (r.kind === 'timeout' || r.kind === 'network')) { await settle(plan, mine, Date.now(), false); return; }
    if (!r.ok) {
      const already = p.already?.(r, plan.input) ?? null;
      if (already) { await succeed(already, null); return; }
      const more = p.onFail?.(r) || null;
      const again = r.kind === 'refused' && r.code !== undefined && REVIEW_AGAIN.has(r.code);
      if (again) { setStep('edit'); setPlan(null); } else setStep('confirm');
      setError((r.kind === 'refused' ? `Not done: ${r.message}` : `Not done. ${r.message}`) + (more ? ` ${more}` : ''));
      return;
    }
    await succeed(p.done(r.data), r.data);
  };
  const back = () => { seq.current += 1; if (timer.current) clearTimeout(timer.current); setStep('edit'); setError(null); setPlan(null); setLost(null); };
  const checkAgain = () => { if (plan) void settle(plan, seq.current, Date.now() - (window.__OPS_RETRY_GAP_MS || RETRY_GAP_MS), true); };
  // as the database counts it: characters, after the blank ends are stripped
  const left = REASON_MAX - textLength(stripBlank(reason));

  if (p.blocked) {
    return (
      <div class="write is-blocked" data-write={p.id} data-blocked>
        {error && <Notice tone="bad"><span data-write-error>{error}</span></Notice>}
        <Notice tone="warn">{p.blocked}</Notice>
        <fieldset class="write-fields" disabled>{p.children}</fieldset>
      </div>
    );
  }
  return (
    <div class="write" data-write={p.id}>
      {result && <div class="write-done" tabIndex={-1} ref={resultEl} data-write-done><Notice tone="good"><span data-write-result>{result}</span></Notice></div>}
      {step === 'edit' || step === 'planning' ? (
        <form class="write-form" onSubmit={review} noValidate>
          {dropped && <Notice tone="warn"><span data-write-dropped>{dropped}</span></Notice>}
          {p.children}
          {needsReason && (
            <div class="field">
              <label for={`${p.id}-reason`}>Reason <span class="muted">({p.reason ?? 'the owner reads it; no personal data'})</span></label>
              <textarea id={`${p.id}-reason`} ref={reasonEl} rows={2} maxLength={REASON_MAX + 20} dir="auto" value={reason}
                onInput={(e) => setReason(e.currentTarget.value)} data-reason aria-describedby={`${p.id}-left`} />
              <span id={`${p.id}-left`} class={'count-left' + (left < 0 ? ' is-over' : '')} data-left>{left < 0 ? `${-left} too many` : `${left} left`}</span>
            </div>
          )}
          {error && <Notice tone="bad"><span data-write-error>{error}</span></Notice>}
          <div class="row">
            <button type="submit" class="btn btn-primary btn-sm" disabled={step === 'planning'} data-review>{step === 'planning' ? 'Checking…' : 'Review'}</button>
          </div>
        </form>
      ) : plan && (
        <div class="confirm" role="group" aria-labelledby={`${p.id}-what`} tabIndex={-1} ref={box} data-confirm>
          <p class="confirm-title" id={`${p.id}-what`}><Icon name="info" /> <span data-what>{plan.what}</span></p>
          {plan.note && <p class="muted small" data-what-note>{plan.note}</p>}
          {needsReason && (
            <p class="confirm-reason">Logged as Halom with your reason, which the owner sees: <T class="quote">“{plan.reason}”</T></p>
          )}
          {step === 'lost' && lost && (
            <Notice tone={lost === 'unknown' ? 'bad' : 'warn'}>
              <span data-write-lost={lost}>{lost === 'unknown'
                ? 'The answer did not arrive, and this page could not tell whether the change was made. Nothing will be sent again from here: check again, or look at the timeline first.'
                : `The answer did not arrive: the change may or may not have been made. ${lost === 'checking' ? 'Checking whether it is there…' : 'Not there yet; the server may still be working on it. Checking again in a moment…'}`}</span>
            </Notice>
          )}
          {error && <Notice tone="bad"><span data-write-error>{error}</span></Notice>}
          <div class="row">
            {step === 'lost' ? (
              <>
                {lost === 'unknown' && p.landed && <button type="button" class="btn btn-primary btn-sm" onClick={checkAgain} data-check-again>Check again</button>}
                <button type="button" class="btn btn-sm" onClick={back} disabled={lost !== 'unknown'} data-back>Back to the form</button>
              </>
            ) : (
              <>
                <button type="button" class="btn btn-primary btn-sm" onClick={go} disabled={step === 'running'} data-go>{step === 'running' ? 'Working…' : p.submit}</button>
                <button type="button" class="btn btn-sm" onClick={back} disabled={step === 'running'} data-back>Back</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
