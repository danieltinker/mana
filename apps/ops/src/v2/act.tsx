/**
 * Act for the owner (D25): one of `ACT_FOR_OWNER_ACTIONS` through `act_for_owner`, with a reason the owner sees. The
 * targets come from what guests see (the published menu and its "off now"), so staff pick, never type, an id. When the
 * owner's support switch is off the form says so and stays closed; if it was turned off since the page loaded, the
 * database's refusal says so plainly. After it runs, the venue is fetched again and the entry is in the timeline.
 * A change to a dish starts from the dish as the owner has it now (read at the review, not the published menu), and
 * carries that row's `updated_at`: if the owner changed it since, the database refuses (`stale`) and says what it is now.
 */
import { useEffect, useState } from 'preact/hooks';
import {
  CASE_STATUSES, ONBOARDING_STATES, ONBOARDING_STEPS, allDishes, isAutoStep,
  type ActForOwnerAction, type ActForOwnerInput, type CaseStatus, type OnboardingState, type OnboardingStep, type OpsVenueDetail,
  type PublicMenuResponse, type SnapshotV2,
} from '@mana/contracts';
import type { Result } from './api.ts';
import {
  FORM_ACTIONS, actPlan, alreadySo, automaticOnly, holds, staleNow, targetsOf, type Fields, type Preset,
} from './act-model.ts';
import {
  ACT_LABEL, CASE_STATUS_LABEL, STATE_LABEL, STEP_LABEL, TARGET_LABEL, UNTIL_CHOICES, fmtMoney, fmtTime, isAct, names, snapshotNames,
} from './model.ts';
import { useCtx } from './ui.tsx';
import { Write, type Landed } from './write.tsx';

export type { Preset } from './act-model.ts';

export function ActForOwner({ detail, snapshot, menu, preset, onDone }: {
  detail: OpsVenueDetail; snapshot: SnapshotV2 | null; menu: Result<PublicMenuResponse>; preset: Preset | null; onDone: () => Promise<boolean>;
}) {
  const { api } = useCtx();
  const v = detail.venue;
  const off = menu.ok && menu.data.state === 'ok' ? menu.data.live.off : [];
  const firstDish = snapshot ? allDishes(snapshot)[0]?.dish.id ?? '' : '';
  const [f, setF] = useState<Fields>(() => ({
    action: off.length ? 'availability.restore' : 'availability.set', target: off[0] ? `${off[0].kind}:${off[0].id}` : '', until: '2h', dish: firstDish,
    field: 'price', price: '', hidden: 'hide', step: detail.onboarding.next ?? 'photos', state: 'doing', caseId: detail.cases[0]?.id ?? '', caseStatus: 'waiting_owner',
  }));
  useEffect(() => {
    if (preset) setF((x) => ({ ...x, action: preset.action, target: `${preset.kind}:${preset.id}` }));
  }, [preset?.key]);
  // the menu may arrive after the form opened (or change on a refresh): the dish chosen is one of its dishes
  const dishIds = snapshot ? allDishes(snapshot).map((x) => x.dish.id) : [];
  useEffect(() => {
    setF((x) => (x.dish && dishIds.includes(x.dish) ? x : { ...x, dish: dishIds[0] ?? '' }));
  }, [dishIds.join(',')]);
  const set = (p: Partial<Fields>) => setF((x) => ({ ...x, ...p }));

  /** After a lost answer: is this change there now? Read fresh, recognised by its value. */
  const landed = async (input: ActForOwnerInput): Promise<Landed> => {
    const p = input.payload as Readonly<Record<string, unknown>>;
    switch (input.action) {
      case 'dish.update': {
        const r = await api.dish(String(p.dishId));
        if (!r.ok || !r.data) return 'unknown';
        if (holds(r.data, p.patch)) return 'yes';
        return r.data.updated_at === p.expectedUpdatedAt ? 'no' : 'unknown';
      }
      case 'availability.set': case 'availability.restore': {
        const m = await api.publicMenu(v.slug);
        if (!m.ok || m.data.state !== 'ok') return 'unknown';
        const at = Date.parse(m.data.live.at);
        const off = m.data.live.off.some((o) => o.kind === p.targetKind && o.id === p.targetId && Date.parse(o.from) <= at && (o.until === null || Date.parse(o.until) > at));
        return (input.action === 'availability.set') === off ? 'yes' : 'no';
      }
      case 'onboarding.set': {
        const d = await api.venue(v.id);
        if (!d.ok) return 'unknown';
        const s = d.data.onboarding.steps.find((x) => x.step === p.step);
        if (s && s.state === p.state) return 'yes';
        return (s?.updatedAt ?? null) === p.expectedUpdatedAt ? 'no' : 'unknown';
      }
      case 'support_case.update': {
        const d = await api.venue(v.id);
        const c = d.ok ? d.data.cases.find((x) => x.id === p.caseId) : undefined;
        return !c ? 'unknown' : c.status === p.status ? 'yes' : 'no';
      }
      default: return 'unknown';
    }
  };
  const nameOf = snapshotNames(snapshot);
  const targets = targetsOf(snapshot);
  const offTargets = off.map((o) => ({ value: `${o.kind}:${o.id}`, label: `${nameOf(o.id) ?? TARGET_LABEL[o.kind]}${o.until ? ` (off until ${fmtTime(o.until)})` : ' (off until brought back)'}` }));
  const blocked = v.supportCanAct ? null
    : 'The owner has turned off Halom acting for them (their support switch). Halom can read this venue but not change it; ask the owner to turn it on in the owner app.';

  // a "Restore…" click while a review is open drops that review: the form shows the new choice, to review
  const presetName = preset ? `“${nameOf(preset.id) ?? TARGET_LABEL[preset.kind].toLowerCase()}”` : '';
  const changed = { key: preset?.key, note: `You chose “Restore…” on ${presetName} while reviewing another change. Nothing was sent: the form now brings ${presetName} back; review that.` };

  return (
    <Write id="act" submit="Act for the owner" blocked={blocked} changed={changed} focusKey={preset?.key}
      plan={async () => {
        if (f.action !== 'dish.update' || !snapshot || !f.dish) return actPlan(f, v.id, detail, snapshot, nameOf);
        const r = await api.dish(f.dish);
        return actPlan(f, v.id, detail, snapshot, nameOf, r.ok ? r.data : r);
      }}
      run={(input, reason) => api.actForOwner({ ...input, reason })}
      done={(d) => `Done${isAct(d.action) ? `: ${ACT_LABEL[d.action].toLowerCase()}` : ''}. It is in the timeline, with your reason.`}
      onFail={(r) => { if (r.kind === 'refused') void onDone(); return staleNow(r); }}
      landed={landed} already={alreadySo}
      onDone={() => { set({ target: '' }); return onDone(); }}>
      <label class="field"><span>Action</span>
        <select value={f.action} onChange={(e) => set({ action: e.currentTarget.value as ActForOwnerAction })} data-act-action>
          {FORM_ACTIONS.map((a) => <option key={a} value={a}>{ACT_LABEL[a]}</option>)}
        </select>
      </label>
      {(f.action === 'availability.set' || f.action === 'dish.update') && !snapshot && (
        <p class="muted small">The menu’s dishes come from the published menu; this venue has none guests can see yet.</p>
      )}
      {f.action === 'availability.restore' && (offTargets.length === 0 ? <p class="muted small" data-nothing-off>Nothing is off right now.</p> : (
        <label class="field"><span>What to bring back</span>
          <select value={f.target} onChange={(e) => set({ target: e.currentTarget.value })} data-act-target>
            <option value="">Choose…</option>
            {offTargets.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      ))}
      {f.action === 'availability.set' && snapshot && (
        <div class="two-fields">
          <label class="field"><span>What to take off</span>
            <select value={f.target} onChange={(e) => set({ target: e.currentTarget.value })} data-act-target>
              <option value="">Choose…</option>
              {['Sections', 'Dishes', 'Add-ons'].map((g) => (
                <optgroup key={g} label={g}>{targets.filter((x) => x.group === g).map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</optgroup>
              ))}
            </select>
          </label>
          <label class="field"><span>Until</span>
            <select value={f.until} onChange={(e) => set({ until: e.currentTarget.value })} data-act-until>
              {UNTIL_CHOICES.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </label>
        </div>
      )}
      {f.action === 'dish.update' && snapshot && (
        <div class="two-fields">
          <label class="field"><span>Dish</span>
            <select value={f.dish} onChange={(e) => set({ dish: e.currentTarget.value })} data-act-dish>
              {allDishes(snapshot).map(({ dish }) => <option key={dish.id} value={dish.id}>{names(dish.name).main}{dish.price ? ` · ${fmtMoney(dish.price.amount)}` : ''}</option>)}
            </select>
          </label>
          <label class="field"><span>Change</span>
            <select value={f.field} onChange={(e) => set({ field: e.currentTarget.value as Fields['field'] })} data-act-field>
              <option value="price">The price</option><option value="hidden">Shown or hidden</option>
            </select>
          </label>
          {f.field === 'price' ? (
            <label class="field"><span>New price in ₪ (empty: no price)</span>
              <input type="text" inputMode="decimal" value={f.price} onInput={(e) => set({ price: e.currentTarget.value })} data-act-price />
            </label>
          ) : (
            <label class="field"><span>Guests</span>
              <select value={f.hidden} onChange={(e) => set({ hidden: e.currentTarget.value as Fields['hidden'] })} data-act-hidden>
                <option value="hide">Hide it from guests</option><option value="show">Show it to guests</option>
              </select>
            </label>
          )}
        </div>
      )}
      {f.action === 'onboarding.set' && (
        <div class="two-fields">
          <label class="field"><span>Step</span>
            <select value={f.step} onChange={(e) => set({ step: e.currentTarget.value as OnboardingStep })} data-act-step>
              {ONBOARDING_STEPS.map((s) => <option key={s} value={s}>{STEP_LABEL[s]}{isAutoStep(s) ? ' (automatic)' : ''}</option>)}
            </select>
          </label>
          <label class="field"><span>Mark as</span>
            <select value={f.state} onChange={(e) => set({ state: e.currentTarget.value as OnboardingState })} data-act-state>
              {ONBOARDING_STATES.map((s) => <option key={s} value={s} disabled={automaticOnly(f.step, s)}>{STATE_LABEL[s]}</option>)}
            </select>
          </label>
          {isAutoStep(f.step) && <p class="muted small">The database marks this step done by itself{f.step === 'review' ? '; a menu built by hand may skip it' : ''}.</p>}
        </div>
      )}
      {f.action === 'support_case.update' && (detail.cases.length === 0 ? <p class="muted small">This venue has no case.</p> : (
        <div class="two-fields">
          <label class="field"><span>Case</span>
            <select value={f.caseId} onChange={(e) => set({ caseId: e.currentTarget.value })} data-act-case>
              {detail.cases.map((c) => <option key={c.id} value={c.id}>{c.subject.slice(0, 60)}</option>)}
            </select>
          </label>
          <label class="field"><span>Status</span>
            <select value={f.caseStatus} onChange={(e) => set({ caseStatus: e.currentTarget.value as CaseStatus })} data-act-case-status>
              {CASE_STATUSES.map((s) => <option key={s} value={s}>{CASE_STATUS_LABEL[s]}</option>)}
            </select>
          </label>
        </div>
      ))}
    </Write>
  );
}
