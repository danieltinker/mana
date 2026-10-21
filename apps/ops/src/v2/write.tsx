/**
 * Every write of the back office goes through <Write>: the fields, then a review step that says in words what will
 * happen and asks for the reason (3–500 characters; the owner reads it), and only then the call. The review freezes
 * what it describes: Go sends exactly the input the sentence was made from, never the fields as they are later. When
 * something the review depends on changes while it is open (the owner publishes, another "Restore…" is clicked), the
 * review is dropped, nothing is sent, and the fields say why. The result is shown where the write was made, and gets
 * the focus; a refusal says that nothing changed.
 *
 * A lost answer (a timeout or a network failure after the call left) is not a refusal: the write may have happened.
 * The page says so and reads whether this page's own write is there (`landed`: by the write's own log entry, landed.ts,
 * never by a value alone), and waits `RETRY_GAP_MS` from the moment the answer was lost before it believes "not there
 * yet". Even then a slow server may still make it, so the page says so, offers a new check, and sends the change
 * again only after an explicit confirm ("it may be made twice"); a new review of the same form asks the same while an
 * earlier send is unresolved. When the page cannot tell, it says so and offers a new check. A refusal that says it is
 * already so (`already`: the value is there, made by a send whose answer was lost or by another staff member) is
 * shown as done, never blamed on the owner.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { isReason, REASON_MAX, REASON_MIN, stripBlank, textLength } from '@mana/contracts';
import type { Fail, Result } from './api.ts';
import type { Landed, LandedAt } from './landed.ts';
import { Icon, Notice, T } from './ui.tsx';

export type { Landed, LandedAt } from './landed.ts';

/** What the write will do and the input that does it (from the fields, as they are at the review), or why it cannot be reviewed. */
export type WritePlan<I> =
  | { readonly ok: true; readonly what: string; readonly note?: string; readonly input: I }
  | { readonly ok: false; readonly why: string };

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
  /** After a lost answer: reads whether this page's own write is there now (by its log entry: the reason as sent, above
   * `mark`). Without it the page cannot tell. */
  readonly landed?: (input: I, at: LandedAt) => Promise<Landed>;
  /** At the review: the newest log id this page has seen (landed.ts `logMark`); a lost write's entry is looked for above it. */
  readonly mark?: () => number;
  /** A refusal that means the change is already there: the words to show as the result, or null for a real refusal. */
  readonly already?: (f: Fail, input: I) => string | null;
  /** What the review depends on beyond its fields. When `key` changes while the review is open, the review is dropped
   * and `note` is shown with the fields. */
  readonly changed?: { readonly key: unknown; readonly note: string } | null;
  /** When this changes after the first render, the reason field gets the focus (the form was prefilled for the user). */
  readonly focusKey?: unknown;
  readonly children?: ComponentChildren;
};

type Reviewed<I> = { readonly what: string; readonly note: string | null; readonly input: I; readonly reason: string; readonly mark: number };
/** After a lost answer: looking now; waiting out the gap; not there yet (it may still arrive); cannot tell. */
type Lost = 'checking' | 'waiting' | 'absent' | 'unknown';

const ABSENT = 'The answer did not arrive, and the change is not there yet. It may still arrive: a slow server can make it later. Check again before you send it again.';
const TWICE = 'If the first send still arrives, this change is made twice. Send it again anyway?';

export function Write<I, D>(p: WriteProps<I, D>) {
  const [step, setStep] = useState<'edit' | 'planning' | 'confirm' | 'running' | 'lost'>('edit');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [plan, setPlan] = useState<Reviewed<I> | null>(null);
  const [lost, setLost] = useState<Lost | null>(null);
  /** "Send it again…" was chosen: the confirm that it may be made twice is showing. */
  const [twice, setTwice] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const resultEl = useRef<HTMLDivElement>(null);
  const reasonEl = useRef<HTMLTextAreaElement>(null);
  /** Each review gets a number; an answer to a review that was dropped is ignored. */
  const seq = useRef(0);
  const reviewedKey = useRef<unknown>(undefined);
  const wantFocus = useRef<'reason' | 'result' | null>(null);
  const lastFocusKey = useRef(p.focusKey);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** A send whose answer was lost and whose outcome is not known yet: what was sent, and when its answer was lost. */
  const unresolved = useRef<{ readonly sent: Reviewed<I>; readonly at: number } | null>(null);
  if (p.focusKey !== lastFocusKey.current) { lastFocusKey.current = p.focusKey; wantFocus.current = 'reason'; }
  const needsReason = p.reason !== false;
  const key = p.changed?.key;
  const gap = () => window.__OPS_RETRY_GAP_MS || RETRY_GAP_MS;

  useEffect(() => () => { seq.current += 1; if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (step === 'confirm') box.current?.focus(); }, [step]);
  // what the review described changed while it was open: drop it, send nothing
  useEffect(() => {
    if ((step === 'planning' || step === 'confirm') && !Object.is(key, reviewedKey.current)) {
      seq.current += 1;
      setStep('edit'); setPlan(null); setError(null); setTwice(false);
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
    setResult(null); setDropped(null); setTwice(false);
    const mine = ++seq.current;
    reviewedKey.current = key;
    setStep('planning'); setError(null);
    let pl: WritePlan<I>;
    try { pl = await p.plan(); } catch { pl = { ok: false, why: 'Could not prepare the review. Try again.' }; }
    if (mine !== seq.current) return;
    if (!pl.ok) { setStep('edit'); setError(pl.why); return; }
    if (needsReason && !isReason(reason)) { setStep('edit'); setError(`Write a reason of ${REASON_MIN} to ${REASON_MAX} characters. The owner reads it.`); return; }
    setPlan({ what: pl.what, note: pl.note ?? null, input: pl.input, reason: needsReason ? stripBlank(reason) : '', mark: p.mark?.() ?? 0 });
    setStep('confirm');
  };

  const succeed = async (text: string, data: D | null) => {
    unresolved.current = null;
    setStep('edit'); setReason(''); setPlan(null); setLost(null); setError(null); setTwice(false);
    setResult(text);
    wantFocus.current = 'result';
    await p.onDone?.(data);
  };

  /**
   * After a lost answer: is the write that was sent there? Looked at once at once; when it is not, again once the gap
   * since its answer was lost (never since a click: SEC-N15) has passed; then "not there yet", which a slow server may
   * still change (QA-L1), so a second send needs its own confirm.
   */
  const settle = async (mine: number): Promise<void> => {
    const u = unresolved.current;
    if (!u) return;
    timer.current = null;
    setStep('lost'); setError(null); setLost('checking'); setTwice(false);
    let got: Landed = 'unknown';
    if (p.landed) { try { got = await p.landed(u.sent.input, { reason: u.sent.reason, mark: u.sent.mark }); } catch { got = 'unknown'; } }
    if (mine !== seq.current) return;
    if (got === 'yes') { await succeed('Done. The answer did not arrive, but the change is there now: it was made once.', null); return; }
    if (got === 'no') {
      const wait = u.at + gap() - Date.now();
      if (wait > 0) { setLost('waiting'); timer.current = setTimeout(() => void settle(mine), wait); return; }
      setLost('absent'); setStep('confirm');
      return;
    }
    setLost('unknown');
  };

  const send = async (pl: Reviewed<I>) => {
    const mine = seq.current;
    setStep('running'); setError(null); setTwice(false);
    const r = await p.run(pl.input, pl.reason);
    if (mine !== seq.current) return;
    if (!r.ok && (r.kind === 'timeout' || r.kind === 'network')) {
      unresolved.current = { sent: pl, at: Date.now() };
      await settle(mine);
      return;
    }
    if (!r.ok) {
      const already = p.already?.(r, pl.input) ?? null;
      if (already) { await succeed(already, null); return; }
      const more = p.onFail?.(r) || null;
      const again = r.kind === 'refused' && r.code !== undefined && REVIEW_AGAIN.has(r.code);
      if (again) { setStep('edit'); setPlan(null); } else setStep('confirm');
      setError((r.kind === 'refused' ? `Not done: ${r.message}` : `Not done. ${r.message}`) + (more ? ` ${more}` : ''));
      return;
    }
    await succeed(p.done(r.data), r.data);
  };
  // Go: only while no earlier send is unresolved; otherwise "Send it again…", then its confirm
  const go = () => { if (plan && step === 'confirm' && !unresolved.current) void send(plan); };
  const goAgain = () => { if (plan && step === 'confirm' && twice) void send(plan); };
  const back = () => { seq.current += 1; if (timer.current) clearTimeout(timer.current); setStep('edit'); setError(null); setPlan(null); setLost(null); setTwice(false); };
  const checkAgain = () => { seq.current += 1; if (timer.current) clearTimeout(timer.current); void settle(seq.current); };
  // as the database counts it: characters, after the blank ends are stripped
  const left = REASON_MAX - textLength(stripBlank(reason));
  const pendingSend = unresolved.current !== null;

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
          {lost && (step === 'lost' || lost === 'absent') && (
            <Notice tone={lost === 'unknown' ? 'bad' : 'warn'}>
              <span data-write-lost={lost}>{lost === 'unknown'
                ? 'The answer did not arrive, and this page could not tell whether the change was made. Nothing will be sent again from here: check again, or look at the timeline first.'
                : lost === 'absent' ? ABSENT
                  : `The answer did not arrive: the change may or may not have been made. ${lost === 'checking' ? 'Checking whether it is there…' : 'Not there yet; the server may still be working on it. Checking again in a moment…'}`}</span>
            </Notice>
          )}
          {step === 'confirm' && pendingSend && lost !== 'absent' && (
            <Notice tone="warn"><span data-write-lost="earlier">An earlier send of a change here got no answer, and it may still arrive. Check again before you send this.</span></Notice>
          )}
          {error && <Notice tone="bad"><span data-write-error>{error}</span></Notice>}
          {twice && step === 'confirm' && <p class="small" data-confirm-again><strong>{TWICE}</strong></p>}
          <div class="row">
            {step === 'lost' ? (
              <>
                {lost === 'unknown' && p.landed && <button type="button" class="btn btn-primary btn-sm" onClick={checkAgain} data-check-again>Check again</button>}
                <button type="button" class="btn btn-sm" onClick={back} disabled={lost !== 'unknown'} data-back>Back to the form</button>
              </>
            ) : pendingSend && step === 'confirm' ? (
              twice ? (
                <>
                  <button type="button" class="btn btn-primary btn-sm" onClick={goAgain} data-go-again>Yes, send it again</button>
                  <button type="button" class="btn btn-sm" onClick={() => setTwice(false)} data-cancel-again>Cancel</button>
                </>
              ) : (
                <>
                  {p.landed && <button type="button" class="btn btn-primary btn-sm" onClick={checkAgain} data-check-again>Check again</button>}
                  <button type="button" class="btn btn-sm" onClick={() => setTwice(true)} data-send-again>Send it again…</button>
                  <button type="button" class="btn btn-sm" onClick={back} data-back>Back to the form</button>
                </>
              )
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
