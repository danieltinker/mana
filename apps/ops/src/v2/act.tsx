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
  ACT_FOR_OWNER_ACTIONS, CASE_STATUSES, LIMITS, ONBOARDING_STATES, ONBOARDING_STEPS, allDishes, isAutoStep, isObject, validateActForOwner,
  type ActForOwnerAction, type ActForOwnerInput, type CaseStatus, type OnboardingState, type OnboardingStep, type OpsVenueDetail,
  type PublicMenuResponse, type SnapshotV2, type TargetKind,
} from '@mana/contracts';
import type { DishNow, Fail, Result } from './api.ts';

/** The actions the form offers. Publishing is not one of them (phase 1: staff help a first publish through approval;
 * the contracts drop `menu.publish` from `ACT_FOR_OWNER_ACTIONS`). */
export const FORM_ACTIONS: readonly ActForOwnerAction[] = ACT_FOR_OWNER_ACTIONS.filter((a) => (a as string) !== 'menu.publish');
import {
  ACT_LABEL, CASE_STATUS_LABEL, STATE_LABEL, STEP_LABEL, TARGET_LABEL, UNTIL_CHOICES, fmtMoney, fmtTime, isAct, names, type NameOf, snapshotNames,
} from './model.ts';
import { useCtx } from './ui.tsx';
import { Write, type WritePlan } from './write.tsx';

/** "Restore…" from the menu panel opens this form ready for that target. `key` makes a repeat click count. */
export type Preset = { readonly action: 'availability.restore' | 'availability.set'; readonly kind: TargetKind; readonly id: string; readonly key?: number };

type Fields = {
  action: ActForOwnerAction;
  target: string;              // `${kind}:${id}`
  until: string;               // an UNTIL_CHOICES id
  dish: string;
  field: 'price' | 'hidden';
  price: string;               // shekels as typed
  hidden: 'hide' | 'show';
  step: OnboardingStep;
  state: OnboardingState;
  caseId: string;
  caseStatus: CaseStatus;
};

/** Everything that can be taken off, from the published menu: sections, dishes, add-ons. */
function targetsOf(s: SnapshotV2 | null): ReadonlyArray<{ value: string; label: string; group: string }> {
  if (!s) return [];
  return [
    ...s.sections.map((x) => ({ value: `section:${x.id}`, label: names(x.name).main, group: 'Sections' })),
    ...allDishes(s).map(({ dish }) => ({ value: `dish:${dish.id}`, label: names(dish.name).main, group: 'Dishes' })),
    ...s.addonGroups.flatMap((g) => g.options.map((o) => ({ value: `option:${o.id}`, label: `${names(o.name).main} (${names(g.name).main})`, group: 'Add-ons' }))),
  ];
}

/** The database's to set: an automatic step is never marked done by hand, and of them only the review may be skipped. */
const automaticOnly = (step: OnboardingStep, state: OnboardingState): boolean =>
  isAutoStep(step) && (state === 'done' || (state === 'skipped' && step !== 'review'));

const splitTarget = (v: string): { kind: TargetKind; id: string } | null => {
  const [kind, id] = v.split(':');
  return kind === 'section' || kind === 'dish' || kind === 'option' ? (id ? { kind, id } : null) : null;
};

const money = (agorot: number | null): string => (agorot === null ? 'no price' : fmtMoney(agorot));

/** The dish as the owner has it now, read at the review: the row, null when it is gone, or why it could not be read. */
export type DishNowRead = DishNow | null | Fail;

/**
 * The review's sentence and the input it describes, from the fields (and, for a dish, from the dish as the owner has
 * it now). The reason is <Write>'s; everything else is checked here as act_for_owner checks it.
 */
export function actPlan(f: Fields, venueId: string, d: OpsVenueDetail, s: SnapshotV2 | null, nameOf: NameOf, now: DishNowRead = null): WritePlan<ActForOwnerInput> {
  const venue = names(d.venue.name, d.venue.slug).main;
  const quote = (id: string) => `“${nameOf(id) ?? 'this item'}”`;
  const republish = 'The owner’s menu changes now; guests see it after the next publish.';
  const base = { venueId, reason: '' };
  const no = (why: string): WritePlan<ActForOwnerInput> => ({ ok: false, why });
  const yes = (input: ActForOwnerInput, what: string, note?: string): WritePlan<ActForOwnerInput> => {
    const v = validateActForOwner(input);
    const errors = v.ok ? [] : v.errors.filter((e) => e.path !== 'reason');
    return errors.length ? no(`This cannot be sent: ${errors.map((e) => e.code.replace(/_/g, ' ')).join(', ')}.`) : { ok: true, what, input, ...(note ? { note } : {}) };
  };
  switch (f.action) {
    case 'availability.set': case 'availability.restore': {
      const t = splitTarget(f.target);
      if (!t) return no(f.action === 'availability.restore' ? 'Choose what to bring back.' : 'Choose what to take off.');
      if (f.action === 'availability.restore') {
        return yes({ ...base, action: 'availability.restore', payload: { targetKind: t.kind, targetId: t.id } },
          `Bring ${quote(t.id)} (${TARGET_LABEL[t.kind].toLowerCase()}) back on ${venue}’s menu now.`, 'Guests see it at once.');
      }
      const u = UNTIL_CHOICES.find((x) => x.id === f.until) ?? UNTIL_CHOICES[0]!;
      return yes({ ...base, action: 'availability.set', payload: { targetKind: t.kind, targetId: t.id, until: u.spec } },
        `Take ${quote(t.id)} (${TARGET_LABEL[t.kind].toLowerCase()}) off ${venue}’s menu, ${u.label.toLowerCase()}.`, 'Guests see it at once.');
    }
    case 'dish.update': {
      const dish = s ? allDishes(s).find((x) => x.dish.id === f.dish)?.dish ?? null : null;
      if (!dish) return no('Choose a dish.');
      if (now === null) return no(`${quote(dish.id)} is no longer in the owner’s menu (it was deleted after the last publish). Nothing to change.`);
      if ('ok' in now) return no(`Could not read ${quote(dish.id)} as the owner has it now. ${now.message}`);
      const at = { expectedUpdatedAt: now.updated_at };
      if (f.field === 'price') {
        const txt = f.price.trim().replace(',', '.');
        const amount = txt === '' ? null : Math.round(Number(txt) * 100);
        if (amount !== null && !(Number.isFinite(amount) && amount >= 0 && amount <= LIMITS.price)) {
          return no('Write the price in shekels (for example 54 or 54.50), or leave it empty for no price.');
        }
        if (amount === now.price) return no(`Nothing would change: the owner’s price of ${quote(dish.id)} is already ${money(amount)}.`);
        const published = dish.price?.amount ?? null;
        const was = published === now.price ? money(now.price) : `${money(now.price)} (the owner’s price now; guests see ${money(published)} until the next publish)`;
        return yes({ ...base, action: 'dish.update', payload: { dishId: dish.id, patch: { price: amount }, ...at } },
          `Change the price of ${quote(dish.id)} from ${was} to ${money(amount)}.`, republish);
      }
      const hide = f.hidden === 'hide';
      if (now.hidden === hide) return no(`Nothing would change: ${quote(dish.id)} is already ${hide ? 'hidden from' : 'shown to'} guests in the owner’s menu.`);
      return yes({ ...base, action: 'dish.update', payload: { dishId: dish.id, patch: { hidden: hide }, ...at } },
        `${hide ? 'Hide' : 'Show'} ${quote(dish.id)} ${hide ? 'from' : 'to'} guests.`, republish);
    }
    case 'onboarding.set': {
      // the step as this page read it (with the venue): its state now and the updated_at the database compares
      const step = d.onboarding.steps.find((x) => x.step === f.step);
      const was = step?.state ?? 'todo';
      if (was === f.state) return no(`Nothing would change: the step “${STEP_LABEL[f.step]}” is already ${STATE_LABEL[was].toLowerCase()}.`);
      return yes({ ...base, action: 'onboarding.set', payload: { step: f.step, state: f.state, expectedUpdatedAt: step?.updatedAt ?? null } },
        `Mark the onboarding step “${STEP_LABEL[f.step]}” as ${STATE_LABEL[f.state].toLowerCase()} (it is ${STATE_LABEL[was].toLowerCase()} now).`);
    }
    case 'support_case.update': {
      const c = d.cases.find((x) => x.id === f.caseId);
      if (!c) return no('Choose a case.');
      return yes({ ...base, action: 'support_case.update', payload: { caseId: c.id, status: f.caseStatus } }, `Set the case “${c.subject.slice(0, 80)}” to ${CASE_STATUS_LABEL[f.caseStatus].toLowerCase()}.`);
    }
    default:
      return no('The back office does not offer this action.');
  }
}

/** A `stale` refusal carries the row as it is now (the dish, or the onboarding step): that, in words. */
export function staleNow(f: Fail): string | null {
  const cur = f.code === 'stale' && f.reply && isObject(f.reply.current) ? f.reply.current : null;
  if (!cur) return null;
  if (f.reply?.action === 'onboarding.set') {
    const st = cur.state;
    return typeof st === 'string' && st in STATE_LABEL ? `Now the step is ${STATE_LABEL[st as OnboardingState].toLowerCase()}.` : null;
  }
  const parts = [typeof cur.price === 'number' || cur.price === null ? `the owner’s price is ${money(cur.price as number | null)}` : null,
    typeof cur.hidden === 'boolean' ? (cur.hidden ? 'it is hidden from guests' : 'it is shown to guests') : null].filter(Boolean);
  return parts.length ? `Now ${parts.join(' and ')}.` : null;
}

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
  const set = (p: Partial<Fields>) => setF((x) => ({ ...x, ...p }));
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
