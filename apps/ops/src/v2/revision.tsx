/**
 * The menu Halom approves: a stored revision (`ops_revision`), as the owner published it. Before the first approval
 * `public_menu` answers "unavailable", so this is what guests will see once Halom approves. Staff pick a revision and
 * one to compare it with (by default the published one, which after approval is the last approved menu; before it,
 * the revision before). Each read is logged on the venue's timeline (`menu.read`), so revisions are read when the page
 * opens a venue waiting for approval, or when asked: never on a timer.
 */
import { useEffect, useState } from 'preact/hooks';
import type { OpsRevision, OpsVenueDetail, Text } from '@mana/contracts';
import type { Fail, Ok } from './api.ts';
import { compareSnapshots, diffSize, fmtDateTime, fmtMoney, names, type MenuDiff } from './model.ts';
import { Badge, Notice, T, useCtx } from './ui.tsx';

type Rev = Ok<OpsRevision>;
type Shown = { readonly rev: Rev; readonly base: Rev | null };

export function Revisions({ detail, onRead }: { detail: OpsVenueDetail; onRead: () => unknown }) {
  const { api, notStaff, signedOut } = useCtx();
  const v = detail.venue;
  const pending = v.review === 'pending';
  // compare with the published revision (once approved, the last approved menu); before approval with the one before
  const [want, setWant] = useState<{ number: number | null; compare: number | 'live' | 'previous' | 'none' }>({ number: null, compare: pending ? 'previous' : 'live' });
  const [shown, setShown] = useState<Shown | null>(null);
  const [fail, setFail] = useState<Fail | null>(null);
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(pending);

  const read = async (number: number | null, compare: typeof want.compare) => {
    setBusy(true); setFail(null);
    const got = async (n: number | null) => {
      const r = await api.revision({ venueId: v.id, revision: n });
      if (!r.ok) { if (r.kind === 'not_staff') notStaff(r); else if (r.kind === 'signed_out') signedOut(); }
      return r;
    };
    const r = await got(number);
    if (!r.ok) { setBusy(false); setFail(r); return; }
    const rev = r.data;
    const live = v.menu.revision;
    const before = rev.revision.number > 1 ? rev.revision.number - 1 : null;
    const target = compare === 'none' ? null
      : compare === 'live' ? (live !== null && live !== rev.revision.number ? live : before)
        : compare === 'previous' ? before : compare === rev.revision.number ? null : compare;
    const b = target === null ? null : await got(target);
    setBusy(false);
    if (b && !b.ok) { setFail(b); return; }
    setShown({ rev, base: b && b.ok ? b.data : null });
    onRead();
  };
  // a venue waiting for approval: read the menu it waits with; again when the owner publishes a newer one
  useEffect(() => { if (asked) void read(want.number, want.compare); }, [asked, v.menu.revision]);
  const choose = (patch: Partial<typeof want>) => { const next = { ...want, ...patch }; setWant(next); setAsked(true); void read(next.number, next.compare); };

  const latest = shown?.rev.latest ?? v.menu.revision ?? 0;
  const numbers = Array.from({ length: latest }, (_, i) => latest - i);
  return (
    <section class="panel p-revision" aria-labelledby="rev-h" data-panel="revision">
      <div class="panel-head">
        <h2 id="rev-h">{pending ? 'The menu to approve' : 'Stored revisions'}</h2>
        <p class="muted small">{pending ? 'What guests will see once you approve: the revision as the owner published it. ' : 'Any revision as the owner published it. '}
          Each read is logged on the venue’s timeline.</p>
      </div>
      <div class="panel-body">
        {!asked ? (
          v.menu.firstPublishedAt
            ? <button type="button" class="btn btn-sm" onClick={() => setAsked(true)} data-read-revision>Read the newest revision</button>
            : <p class="muted small">Nothing is published yet.</p>
        ) : (
          <>
            {latest > 0 && (
              <div class="two-fields">
                <label class="field"><span>Revision</span>
                  <select value={String(want.number ?? '')} onChange={(e) => choose({ number: e.currentTarget.value ? Number(e.currentTarget.value) : null })} data-revision-pick disabled={busy}>
                    <option value="">The newest{shown && want.number === null ? ` (${shown.rev.revision.number})` : ''}</option>
                    {numbers.map((n) => <option key={n} value={n}>Revision {n}{n === v.menu.revision ? ' (published)' : ''}</option>)}
                  </select>
                </label>
                <label class="field"><span>Compare with</span>
                  <select value={String(want.compare)} onChange={(e) => { const x = e.currentTarget.value; choose({ compare: x === 'live' || x === 'previous' || x === 'none' ? x : Number(x) }); }}
                    data-revision-compare disabled={busy}>
                    {!pending && <option value="live">The published one (approved)</option>}
                    <option value="previous">The one before</option>
                    <option value="none">Nothing</option>
                    {numbers.map((n) => <option key={n} value={n}>Revision {n}</option>)}
                  </select>
                </label>
              </div>
            )}
            {fail && <Notice tone="bad">Could not read the revision. {fail.message}</Notice>}
            {busy && !shown && <p class="boot" role="status">Reading the revision…</p>}
            {shown && <Shown shown={shown} busy={busy} />}
          </>
        )}
      </div>
    </section>
  );
}

function Shown({ shown, busy }: { shown: Shown; busy: boolean }) {
  const { rev, base } = shown;
  const diff = base ? compareSnapshots(base.snapshot, rev.snapshot) : null;
  const added = new Set(diff?.dishesAdded.map((d) => d.id));
  const price = new Map(diff?.prices.map((p) => [p.id, p] as const));
  return (
    <div class={'stack-s' + (busy ? ' is-stale' : '')} data-revision={rev.revision.number}>
      <p class="small">
        <strong>Revision {rev.revision.number}</strong> of {rev.latest} · published {fmtDateTime(rev.revision.createdAt)}
        {rev.revision.live && <> · <Badge tone="good">published</Badge></>}
        {rev.revision.note && <> · <T class="muted">“{rev.revision.note}”</T></>}
      </p>
      {base && diff && <Diff diff={diff} base={base.revision.number} />}
      <ul class="menu-view" data-revision-menu>
        {rev.snapshot.sections.map((sec) => (
          <li key={sec.id} class="msec">
            <ul>
              <li class="mrow" data-menu-row="section"><T class="mrow-name">{names(sec.name).main}</T></li>
              {sec.dishes.map((d) => {
                const p = price.get(d.id);
                return (
                  <li key={d.id} class="mrow is-sub" data-id={d.id}>
                    <T class="mrow-name">{names(d.name).main}</T>
                    {added.has(d.id) && <Badge tone="info" data="new">new</Badge>}
                    <span class="mrow-price">{p ? <>{p.from === null ? 'no price' : fmtMoney(p.from)} → </> : null}{d.price ? fmtMoney(d.price.amount) : 'no price'}</span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Diff({ diff, base }: { diff: MenuDiff; base: number }) {
  if (diffSize(diff) === 0) return <p class="small" data-diff="none">The same dishes, sections and prices as revision {base}.</p>;
  const list = (xs: readonly { name: Text }[]) => xs.map((x) => names(x.name).main).join(', ');
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  return (
    <ul class="diff small" data-diff={diffSize(diff)} aria-label={`What changed since revision ${base}`}>
      <li class="muted">Since revision {base}:</li>
      {diff.dishesAdded.length > 0 && <li><strong>{n(diff.dishesAdded.length, 'dish added', 'dishes added')}</strong>: <T>{list(diff.dishesAdded)}</T></li>}
      {diff.dishesRemoved.length > 0 && <li><strong>{n(diff.dishesRemoved.length, 'dish removed', 'dishes removed')}</strong>: <T>{list(diff.dishesRemoved)}</T></li>}
      {diff.prices.length > 0 && (
        <li><strong>{n(diff.prices.length, 'price changed', 'prices changed')}</strong>:{' '}
          {diff.prices.map((p, i) => <span key={p.id}>{i ? ', ' : ''}<T>{names(p.name).main}</T> {p.from === null ? 'no price' : fmtMoney(p.from)} → {p.to === null ? 'no price' : fmtMoney(p.to)}</span>)}
        </li>
      )}
      {diff.renamed.length > 0 && <li><strong>{n(diff.renamed.length, 'dish renamed', 'dishes renamed')}</strong>: {diff.renamed.map((r, i) => <span key={r.id}>{i ? ', ' : ''}<T>{names(r.from).main}</T> → <T>{names(r.to).main}</T></span>)}</li>}
      {diff.sectionsAdded.length > 0 && <li><strong>{n(diff.sectionsAdded.length, 'section added', 'sections added')}</strong>: <T>{list(diff.sectionsAdded)}</T></li>}
      {diff.sectionsRemoved.length > 0 && <li><strong>{n(diff.sectionsRemoved.length, 'section removed', 'sections removed')}</strong>: <T>{list(diff.sectionsRemoved)}</T></li>}
    </ul>
  );
}
