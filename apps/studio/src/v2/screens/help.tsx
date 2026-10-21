// "Get help" (#/help; F03, F09): the owner or a manager asks Halom, in one line and a few details, under a topic
// (open_case); Halom sees the request in the back office. Beside it stands the owner's own switch: may Halom make
// changes for them (support_can_act, D25)? It is a standing setting, not part of a request: a tap changes it at once
// (the owner's alone; a manager sees it, disabled), the database logs the change, and every change Halom makes shows in
// the activity log with its reason. The screen says plainly what happens next, lists the place's requests that are not
// resolved, and keeps a person one tap away (WhatsApp). The shell's help button leads here from every screen.
import { useEffect, useRef, useState } from 'preact/hooks';
import { CASE_BODY_MAX, CASE_SUBJECT_MAX, CASE_TOPICS, oneOf, type CaseTopic } from '@mana/contracts';
import { PRODUCT } from '../../product.ts';
import { toast } from '../../lib/store.ts';
import { Btn, Field, Icon, Note, PageHead, Switch } from '../../ui.tsx';
import { toV2Error } from '../data/errors.ts';
import { openCase, openCases, type CaseLine } from '../data/records.ts';
import { requestIds } from '../data/request-id.ts';
import { canEdit, mayWrite, menu, refreshVenue, setSupportCanAct } from '../data/store.ts';
import { errText, fmtDate, t } from '../i18n.ts';
import { ErrorLine } from '../ui.tsx';

/** The help button in the shell's top bar (`onClick`: the shell's guard for a screen that holds unsaved changes). */
export function HelpButton({ onClick }: { onClick?: (e: MouseEvent) => void }) {
  return <a class="acctbtn helpbtn" href="#/help" aria-label={t('help.title')} title={t('help.title')} onClick={onClick} data-action="help"><Icon name="help" /></a>;
}

const TOPIC_ICON: Readonly<Record<CaseTopic, string>> = { onboarding: 'list', import: 'paste', menu: 'menu', photos: 'camera', account: 'user', other: 'chat' };

/** `rest`: `#/help/<topic>` opens the form on that topic (each step of the setup flow asks on its own). */
export function HelpScreen({ rest = [] }: { rest?: string[] }) {
  const d = menu.value!;
  const v = d.venue;
  const records = canEdit();
  const owner = d.role === 'owner';
  const asked = rest[0];
  const [topic, setTopic] = useState<CaseTopic>(() => (oneOf(CASE_TOPICS, asked) ? asked : 'menu'));
  useEffect(() => { if (oneOf(CASE_TOPICS, asked)) setTopic(asked); }, [asked]);
  const [subject, setSubject] = useState(''), [body, setBody] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [subjectErr, setSubjectErr] = useState('');
  const [sent, setSent] = useState<string | null>(null);
  const [cases, setCases] = useState<{ list: CaseLine[]; error: string; loading: boolean }>({ list: [], error: '', loading: true });
  const subjectRef = useRef<HTMLInputElement>(null);

  async function loadCases() {
    setCases((c) => ({ ...c, loading: true }));
    try { setCases({ list: await openCases(v.id), error: '', loading: false }); }
    catch (e) { setCases((c) => ({ ...c, error: toV2Error(e).code, loading: false })); }
  }
  useEffect(() => { if (records) void loadCases(); }, [v.id, records]);
  /** Sent: say what happens next. */
  async function done(caseId: string) {
    setSubject(''); setBody('');
    toast(t('help.sent'));
    setSent(caseId);
    await Promise.all([loadCases(), refreshVenue().catch(() => {})]);
  }
  // the request's own id (data/request-id.ts): the same for a resend of the same words after a lost answer (open_case
  // answers the stored request, `reused`), a new one as soon as the topic, the line or the details change, and after
  // a request is stored
  const ids = useRef(requestIds());
  /** An answer lost on the way back: is the request stored? Its own id among the place's open requests says. */
  const storedAs = async (id: string): Promise<CaseLine | null> => (await openCases(v.id)).find((c) => c.id === id) ?? null;
  async function send(e: Event) {
    e.preventDefault();
    if (busy) return;
    setError(''); setSubjectErr('');
    setBusy(true);
    const id = ids.current.forContent({ topic, subject, body });
    try {
      mayWrite();
      const r = await openCase({ venueId: v.id, topic, subject, body, id });
      ids.current.sent();
      await done(r.caseId);
    } catch (err) {
      const code = toV2Error(err).code;
      const found = code === 'network' ? await storedAs(id).catch(() => null) : null;
      if (found) { ids.current.sent(); await done(found.id); return; }
      if (code === 'text_missing' || code === 'text_too_long' || code === 'text_invalid') { setSubjectErr(errText(code, 'help.e')); subjectRef.current?.focus(); }
      else setError(errText(code, 'help.e'));
    } finally { setBusy(false); }
  }

  return (
    <div class="page page-help" data-screen="help">
      <PageHead title={t('help.title')} lead={records ? t('help.lead') : undefined} />
      {!records && <Note>{t('help.counter')}</Note>}

      {records && sent && (
        <section class="card helpnext" aria-labelledby="helpnext-h" data-case-sent={sent}>
          <h2 id="helpnext-h" class="status"><span class="dot dot-on" aria-hidden="true" />{t('help.next.title')}</h2>
          <p>{t('help.next.body')}</p>
          <p class="fine">{t(v.support_can_act ? 'help.next.act' : 'help.next.noAct')}</p>
          <Btn small kind="ghost" onClick={() => { setSent(null); subjectRef.current?.focus(); }}>{t('help.another')}</Btn>
        </section>
      )}

      {records && !sent && (
        <form class="card helpform" onSubmit={send} noValidate aria-labelledby="helpform-h" data-help-form>
          <h2 id="helpform-h">{t('help.ask')}</h2>
          <fieldset class="tags">
            <legend>{t('help.topic')}</legend>
            <div class="kindchips" role="radiogroup" aria-label={t('help.topic')}>
              {CASE_TOPICS.map((k) => (
                <button key={k} type="button" role="radio" class="kindchip" aria-checked={topic === k ? 'true' : 'false'} onClick={() => setTopic(k)} data-topic={k}>
                  <Icon name={TOPIC_ICON[k]} size={18} />{t('topic.' + k)}
                </button>
              ))}
            </div>
          </fieldset>
          <Field label={t('help.subject')} error={subjectErr}>{(p) => (
            <input {...p} ref={subjectRef} type="text" dir="auto" maxLength={CASE_SUBJECT_MAX} value={subject} data-field="help-subject"
              onInput={(e) => { setSubject((e.target as HTMLInputElement).value); setSubjectErr(''); }} />
          )}</Field>
          <Field label={t('help.body')} hint={t('help.bodyHint')} optional>{(p) => (
            <textarea {...p} dir="auto" rows={4} maxLength={CASE_BODY_MAX} value={body} data-field="help-body" onInput={(e) => setBody((e.target as HTMLTextAreaElement).value)} />
          )}</Field>
          {error && <Note kind="error">{error}</Note>}
          <Btn type="submit" kind="primary" block busy={busy} icon="send" data-action="send-help">{t('help.send')}</Btn>
          <p class="fine">{t('help.next.short')}</p>
        </form>
      )}

      {records && <AllowCard owner={owner} on={v.support_can_act} />}

      {records && (
        <section class="card" aria-labelledby="cases-h" data-cases>
          <h2 id="cases-h">{t('help.cases')}</h2>
          {cases.loading && cases.list.length === 0 && <p class="muted"><span class="spin spin-sm" aria-hidden="true" /> {t('app.loading')}</p>}
          <ErrorLine code={cases.error} onRetry={loadCases} />
          {!cases.loading && !cases.error && cases.list.length === 0 && <p class="muted" data-cases-none>{t('help.cases.none')}</p>}
          {cases.list.length > 0 && (
            <ul class="caselist">
              {cases.list.map((c) => (
                <li key={c.id} class={'caseline' + (c.status === 'waiting_owner' ? ' is-waiting' : '')} data-case={c.id} data-status={c.status}>
                  <p class="caseline-subject" dir="auto">{c.subject}</p>
                  <p class="caseline-meta fine">
                    <span class={'badge ' + (c.status === 'waiting_owner' ? 'badge-warn' : 'badge-todo')}>{t('case.' + c.status)}</span>
                    <span>{t('topic.' + c.topic)}</span>
                    <span>{t('help.opened', { date: fmtDate(c.created_at) })}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
          <a class="linkbtn" href="#/activity" data-link="activity"><Icon name="history" size={16} /><span>{t('help.seeLog')}</span></a>
        </section>
      )}

      <a class="btn btn-secondary btn-block" href={PRODUCT.whatsapp} target="_blank" rel="noopener noreferrer" data-link="whatsapp"><Icon name="chat" size={18} /><span class="btn-txt">{t('app.help')}</span></a>
    </div>
  );
}

/**
 * The owner's standing switch: Halom may (or may not) make changes for them. A tap stores it at once; until the database
 * answers, the switch shows the new position and waits; a refusal or a failure puts it back and says why.
 */
function AllowCard({ owner, on }: { owner: boolean; on: boolean }) {
  const [busy, setBusy] = useState<boolean | null>(null), [error, setError] = useState('');
  async function flip(next: boolean) {
    if (busy !== null || next === on) return;
    setError(''); setBusy(next);
    try {
      await setSupportCanAct(next);
      toast(t(next ? 'help.allow.nowOn' : 'help.allow.nowOff'));
    } catch (e) { setError(errText(toV2Error(e).code, 'help.e')); }
    finally { setBusy(null); }
  }
  return (
    <section class="card helpallow" aria-labelledby="allow-h" data-allow={on ? 'on' : 'off'} aria-busy={busy !== null ? 'true' : undefined}>
      <h2 id="allow-h">{t('help.allow.title')}</h2>
      <div class="switchrow"><span>{t('help.allow')}</span>
        <Switch checked={busy ?? on} onChange={flip} label={t('help.allow')} disabled={!owner || busy !== null} /></div>
      <p class="hint">{owner ? t('help.allowHint') : t('help.allowOwner', { state: t(on ? 'help.allow.on' : 'help.allow.off') })}</p>
      {error && <Note kind="error">{error}</Note>}
    </section>
  );
}
