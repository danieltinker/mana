/**
 * Every write of the back office goes through <Write>: the fields, then a review step that says in words what will
 * happen and asks for the reason (3–500 characters; the owner reads it), and only then the call. The result is shown
 * where the write was made; a refusal says that nothing changed.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { isReason, REASON_MAX, REASON_MIN, stripBlank } from '@mana/contracts';
import type { Result } from './api.ts';
import { Icon, Notice, T } from './ui.tsx';

/** What the write will do (from its fields), or why it cannot be reviewed yet. */
export type WritePlan = { readonly ok: true; readonly what: string; readonly note?: string } | { readonly ok: false; readonly why: string };

export type WriteProps<D> = {
  /** data-write="…" for tests and a stable id prefix. */
  readonly id: string;
  /** The write cannot be made at all: the reason is shown and the fields are disabled. */
  readonly blocked?: string | null;
  readonly plan: () => WritePlan;
  /** The reason's hint; `false` for a write whose function takes no reason. */
  readonly reason?: string | false;
  readonly submit: string;
  readonly run: (reason: string) => Promise<Result<D>>;
  readonly done: (data: D) => string;
  readonly onDone?: (data: D) => unknown;
  readonly children?: ComponentChildren;
};

export function Write<D>(p: WriteProps<D>) {
  const [step, setStep] = useState<'edit' | 'confirm' | 'running'>('edit');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [plan, setPlan] = useState<Extract<WritePlan, { ok: true }> | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const needsReason = p.reason !== false;
  useEffect(() => { if (step === 'confirm') box.current?.focus(); }, [step]);

  const review = (e: Event) => {
    e.preventDefault();
    setResult(null);
    const pl = p.plan();
    if (!pl.ok) { setError(pl.why); return; }
    if (needsReason && !isReason(reason)) { setError(`Write a reason of ${REASON_MIN} to ${REASON_MAX} characters. The owner reads it.`); return; }
    setError(null); setPlan(pl); setStep('confirm');
  };
  const go = async () => {
    setStep('running'); setError(null);
    const r = await p.run(needsReason ? stripBlank(reason) : '');
    if (!r.ok) {
      setStep('confirm');
      setError(r.kind === 'refused' ? `Not done: ${r.message}` : `Not done. ${r.message}`);
      return;
    }
    setStep('edit'); setReason(''); setPlan(null);
    setResult(p.done(r.data));
    await p.onDone?.(r.data);
  };
  const left = REASON_MAX - stripBlank(reason).length;

  if (p.blocked) {
    return (
      <div class="write is-blocked" data-write={p.id} data-blocked>
        <Notice tone="warn">{p.blocked}</Notice>
        <fieldset class="write-fields" disabled>{p.children}</fieldset>
      </div>
    );
  }
  return (
    <div class="write" data-write={p.id}>
      {result && <Notice tone="good"><span data-write-result>{result}</span></Notice>}
      {step === 'edit' ? (
        <form class="write-form" onSubmit={review} noValidate>
          {p.children}
          {needsReason && (
            <label class="field">
              <span>Reason <span class="muted">({p.reason ?? 'the owner reads it; no personal data'})</span></span>
              <textarea rows={2} maxLength={REASON_MAX + 20} dir="auto" value={reason} onInput={(e) => setReason(e.currentTarget.value)} data-reason
                aria-describedby={`${p.id}-left`} />
              <span id={`${p.id}-left`} class={'count-left' + (left < 0 ? ' is-over' : '')}>{left < 0 ? `${-left} too many` : `${left} left`}</span>
            </label>
          )}
          {error && <Notice tone="bad"><span data-write-error>{error}</span></Notice>}
          <div class="row"><button type="submit" class="btn btn-primary btn-sm" data-review>Review</button></div>
        </form>
      ) : plan && (
        <div class="confirm" role="group" aria-labelledby={`${p.id}-what`} tabIndex={-1} ref={box} data-confirm>
          <p class="confirm-title" id={`${p.id}-what`}><Icon name="info" /> <span data-what>{plan.what}</span></p>
          {plan.note && <p class="muted small">{plan.note}</p>}
          {needsReason && (
            <p class="confirm-reason">Logged as Halom with your reason, which the owner sees: <T class="quote">“{stripBlank(reason)}”</T></p>
          )}
          {error && <Notice tone="bad"><span data-write-error>{error}</span></Notice>}
          <div class="row">
            <button type="button" class="btn btn-primary btn-sm" onClick={go} disabled={step === 'running'} data-go>{step === 'running' ? 'Working…' : p.submit}</button>
            <button type="button" class="btn btn-sm" onClick={() => { setStep('edit'); setError(null); }} disabled={step === 'running'} data-back>Back</button>
          </div>
        </div>
      )}
    </div>
  );
}
