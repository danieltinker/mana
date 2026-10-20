// Publishing: every edit is a draft until here. The screen shows where the menu stands (never published, waiting for
// Halom's approval, live, offline), what publishing would change, what would stop it and what only warns (preview_menu,
// with lintSnapshotV2's warnings), then publishes. A place's first publish waits for Halom when
// publish_requires_approval holds: the menu is stored and guests see it once Halom approves. Each publish is a version
// that can be put back. Once the place has published, the QR code and the table card (screens/qr.tsx; outside
// production marked "demo", backlog B5). The setup flow shows this same screen as its last step (`inFlow`: the flow's
// own heading, and the QR card under it).
import { useEffect, useState } from 'preact/hooks';
import type { SnapshotV2 } from '@mana/contracts';
import { Btn, Confirm, CopyBtn, Icon, Ltr, Note, PageHead } from '../../ui.tsx';
import { openUrl, shortText, shortUrl } from '../../lib/links.ts';
import { planOf, toast } from '../../lib/store.ts';
import { standingOf } from '../data/changes.ts';
import { draft, hasChanges, refreshDraft, type Notice } from '../data/draft.ts';
import { toV2Error } from '../data/errors.ts';
import * as api from '../data/menu.ts';
import { canEdit, flushSaves, hasUnsaved, menu, refreshVenue, saveState } from '../data/store.ts';
import { errText, fmtDate, fmtDateTime, lang, t, tn } from '../i18n.ts';
import { QrCard } from './qr.tsx';

export function PublishScreen({ inFlow = false }: { inFlow?: boolean }) {
  const d = menu.value!;
  const v = d.venue;
  const dr = draft.value;
  const standing = standingOf(v);
  const plan = d.entitlement ? planOf(d.entitlement) : null;
  const blockedPlan = plan && (plan.state === 'expired' || plan.state === 'suspended') ? plan.state : null;
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [restoreN, setRestoreN] = useState<number | null>(null), [off, setOff] = useState(false);
  const [justPending, setJustPending] = useState(false);
  const live = d.revisions.find((r) => r.id === v.published_revision_id);
  const nothingNew = standing !== 'never' && dr.changes !== null && !dr.loading && !hasChanges.value && v.published_revision_id !== null;
  // a change still on its way, one that did not save, or one waiting for the owner's decision: guests would get a menu
  // without it, so publishing waits (and says why)
  const s = saveState.value;
  const unsaved = s === 'saving' || s === 'failed' || s === 'conflict' ? s : null;

  useEffect(() => { flushSaves().then(() => refreshDraft()); refreshVenue().catch(() => {}); }, []);
  // waiting for Halom: look again when the owner comes back to the app
  useEffect(() => {
    if (standing !== 'pending') return;
    const again = () => { if (document.visibilityState === 'visible') refreshVenue().catch(() => {}); };
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [standing]);

  async function publish() {
    if (busy) return;
    setBusy('publish'); setError('');
    try {
      await flushSaves();
      if (hasUnsaved()) { setError(t('pub2.blocked.' + (saveState.value === 'conflict' ? 'conflict' : 'failed'))); return; }
      const r = await api.publishMenu(v.id, null);
      await refreshVenue();
      refreshDraft();
      setJustPending(r.review === 'pending');
      toast(r.review === 'pending' ? t('pub2.sentForApproval') : t('pub.restored', { n: r.revision }));
    } catch (e) { setError(errText(toV2Error(e).code, 'pub.e')); refreshDraft(); }
    finally { setBusy(''); }
  }
  async function restore(n: number) {
    setBusy('restore'); setError('');
    try { await api.restoreRevision(v.id, n); await refreshVenue(); refreshDraft(); toast(t('pub.restored', { n })); setRestoreN(null); }
    catch (e) { setError(errText(toV2Error(e).code, 'pub.e')); setRestoreN(null); }
    finally { setBusy(''); }
  }
  async function unpublish() {
    setBusy('off'); setError('');
    try { await api.unpublishMenu(v.id); await refreshVenue(); refreshDraft(); toast(t('pub.unpublished')); setOff(false); }
    catch (e) { setError(errText(toV2Error(e).code, 'pub.e')); setOff(false); }
    finally { setBusy(''); }
  }
  async function check() {
    setBusy('check');
    try { await refreshVenue(); } catch (e) { setError(errText(toV2Error(e).code)); } finally { setBusy(''); }
  }

  return (
    <div class={inFlow ? 'page-publish' : 'page page-publish'} data-screen={inFlow ? undefined : 'publish'} data-publish data-standing={standing}>
      {!inFlow && <PageHead title={t('pub.title')} />}

      <section class="card standing" aria-labelledby="standing-h" data-standing-card={standing}>
        <h2 id="standing-h" class="status"><span class={'dot ' + (standing === 'live' ? 'dot-on' : 'dot-off')} aria-hidden="true" />{t('pub2.standing.' + standing)}</h2>
        {standing === 'never' && <p>{t('pub2.never.body')}</p>}
        {standing === 'pending' && <>
          <p>{t('pub2.pending.body')}</p>
          {justPending && <p class="fine">{t('pub2.pending.meanwhile')}</p>}
          <Btn small icon="refresh" busy={busy === 'check'} onClick={check} data-action="check-approval">{t('pub2.pending.check')}</Btn>
        </>}
        {standing === 'live' && live && <p>{t('pub.live', { n: live.number, date: fmtDate(live.created_at) })}</p>}
        {standing === 'offline' && <p>{t('pub.notLive')}</p>}
        {(standing === 'live' || standing === 'offline') && (
          <div class="linkline">
            <Ltr class="biglink">{shortText(v.slug)}</Ltr>
            <CopyBtn text={shortUrl(v.slug)} />
            {standing === 'live' && <a class="btn btn-sm" href={openUrl(v.slug)} target="_blank" rel="noopener noreferrer"><Icon name="open" size={16} /><span>{t('pub.open')}</span></a>}
          </div>
        )}
      </section>

      {blockedPlan && <Note kind="error">{t('pub.e.plan_' + blockedPlan)}</Note>}

      {!inFlow && standing !== 'never' && <QrCard venue={v} />}

      {canEdit() && <section class="card" aria-labelledby="draft-h" data-draft>
        <h2 id="draft-h">{t('pub.changes')}</h2>
        {dr.loading && !dr.snapshot && <p class="muted"><span class="spin spin-sm" aria-hidden="true" /> {t('app.loading')}</p>}
        {dr.error && <Note kind="error">{errText(dr.error)}</Note>}
        {dr.snapshot && <ChangesLine />}
        {dr.issues.length > 0 && <div class="notices" role="group" aria-label={t('pub2.issues')} data-issues>
          <p class="note-title">{tn('pub2.issues.n', dr.issues.length)}</p>
          <ul>{dr.issues.map((x, i) => <li key={i} class="line line-bad"><Icon name="alert" /><span>{noticeText(x, dr.snapshot)}</span></li>)}</ul>
        </div>}
        {dr.warnings.length > 0 && <div class="notices" role="group" aria-label={t('pub2.warnings')} data-warnings>
          <p class="note-title">{tn('pub2.warnings.n', dr.warnings.length)}</p>
          <ul>{dr.warnings.map((x, i) => <li key={i} class="line line-warn"><Icon name="info" /><span>{noticeText(x, dr.snapshot)}</span></li>)}</ul>
        </div>}
        {error && <Note kind="error">{error}</Note>}
        {unsaved && <p class={'fine' + (unsaved === 'saving' ? '' : ' ferr')} role={unsaved === 'saving' ? 'status' : 'alert'} data-blocked={unsaved}>{t('pub2.blocked.' + unsaved)}</p>}
        <Btn kind="primary" block busy={busy === 'publish'} disabled={!!blockedPlan || dr.issues.length > 0 || nothingNew || !dr.snapshot || !!unsaved} onClick={publish} data-action="publish">
          {standing === 'never' ? t('pub2.publishFirst') : t('pub2.publishChanges')}
        </Btn>
        {standing === 'never' && <p class="fine center">{t('pub2.approvalNote')}</p>}
      </section>}

      {d.revisions.length > 0 && <section class="card" aria-labelledby="revs-h">
        <h2 id="revs-h">{t('pub.revs')}</h2>
        <ul class="revs">
          {d.revisions.map((r) => (
            <li key={r.id} data-revision={r.number}>
              <span class="rev-main"><span class="strong">{t('pub.rev', { n: r.number })}</span><span class="fine">{fmtDateTime(r.created_at)}</span></span>
              {r.id === v.published_revision_id
                ? (standing === 'pending' ? <span class="badge badge-warn">{t('pub2.revPending')}</span> : <span class="badge badge-ok">{t('pub.revLive')}</span>)
                : canEdit() && <Btn small onClick={() => setRestoreN(r.number)} data-restore={r.number}>{t('pub2.restoreShort')}</Btn>}
            </li>
          ))}
        </ul>
        {canEdit() && v.published_revision_id && <Btn kind="ghost" icon="power" onClick={() => setOff(true)} data-action="unpublish">{t('pub.unpublish')}</Btn>}
      </section>}

      <Confirm open={restoreN !== null} title={t('pub.restore')} body={t('pub.restoreConfirm', { n: restoreN ?? 0 })} confirmLabel={t('pub.restore')} busy={busy === 'restore'}
        onConfirm={() => restore(restoreN!)} onClose={() => setRestoreN(null)} />
      <Confirm open={off} title={t('pub.unpublish')} body={t('pub.unpublishConfirm')} confirmLabel={t('pub.unpublish')} danger busy={busy === 'off'} onConfirm={unpublish} onClose={() => setOff(false)} />
    </div>
  );
}

function ChangesLine() {
  const c = draft.value.changes;
  if (!c) return <p class="muted">{t('pub2.changes.first')}</p>;
  const parts = [
    c.dishesAdded && tn('pub.changes.added', c.dishesAdded), c.dishesRemoved && tn('pub.changes.removed', c.dishesRemoved),
    c.dishesChanged && tn('pub.changes.changed', c.dishesChanged), c.groupsChanged && tn('pub2.changes.groups', c.groupsChanged),
    c.sections && t('pub.changes.order'), c.other && t('pub.changes.look'),
  ].filter(Boolean) as string[];
  return parts.length ? <ul class="chips" data-changes>{parts.map((p) => <li key={p} class="chip">{p}</li>)}</ul> : <p class="muted" data-changes="none">{t('pub.changes.none')}</p>;
}

/** A problem or warning from the preview, with the name of what it is about when the path leads to one. */
function noticeText(x: Notice, s: SnapshotV2 | null): string {
  const L = lang.value;
  const nm = (o: { name: { he: string; en: string } } | undefined) => (o ? o.name[L] || o.name[L === 'he' ? 'en' : 'he'] : '');
  let about = '';
  const dish = /^sections\[(\d+)\]\.dishes\[(\d+)\]/.exec(x.path), group = /^addonGroups\[(\d+)\]/.exec(x.path), sec = /^sections\[(\d+)\]/.exec(x.path);
  if (s && dish) about = nm(s.sections[+dish[1]!]?.dishes[+dish[2]!]);
  else if (s && group) about = nm(s.addonGroups[+group[1]!]);
  else if (s && sec) about = nm(s.sections[+sec[1]!]);
  else if (x.label) about = x.label;
  const what = x.code === 'rule_left_out' ? t('issue.rule_left_out.' + (x.reason || 'other')) : errText(x.code, 'issue');
  return about ? about + ': ' + what : what;
}
