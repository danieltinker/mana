/**
 * The act-for-owner form's logic, apart from its screen (act.tsx), so it is unit-tested: the actions offered, the
 * review's sentence and input from the fields (`actPlan`), prices as typed, and how a `stale` refusal reads (what the
 * row is now, never who changed it; Halom's own change recognised by its value).
 */
import {
  ACT_FOR_OWNER_ACTIONS, LIMITS, allDishes, isAutoStep, isObject, validateActForOwner,
  type ActForOwnerAction, type ActForOwnerInput, type CaseStatus, type OnboardingState, type OnboardingStep, type OpsVenueDetail,
  type SnapshotV2, type TargetKind,
} from '@mana/contracts';
import type { DishNow, Fail } from './api.ts';
import { CASE_STATUS_LABEL, STATE_LABEL, STEP_LABEL, TARGET_LABEL, UNTIL_CHOICES, fmtMoney, names, type NameOf } from './model.ts';
import type { WritePlan } from './write.tsx';

/** The actions the form offers. Publishing is not one of them (phase 1: staff help a first publish through approval;
 * the contracts drop `menu.publish` from `ACT_FOR_OWNER_ACTIONS`). */
export const FORM_ACTIONS: readonly ActForOwnerAction[] = ACT_FOR_OWNER_ACTIONS.filter((a) => (a as string) !== 'menu.publish');
/** "Restore…" from the menu panel opens this form ready for that target. `key` makes a repeat click count. */
export type Preset = { readonly action: 'availability.restore' | 'availability.set'; readonly kind: TargetKind; readonly id: string; readonly key?: number };

export type Fields = {
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
export function targetsOf(s: SnapshotV2 | null): ReadonlyArray<{ value: string; label: string; group: string }> {
  if (!s) return [];
  return [
    ...s.sections.map((x) => ({ value: `section:${x.id}`, label: names(x.name).main, group: 'Sections' })),
    ...allDishes(s).map(({ dish }) => ({ value: `dish:${dish.id}`, label: names(dish.name).main, group: 'Dishes' })),
    ...s.addonGroups.flatMap((g) => g.options.map((o) => ({ value: `option:${o.id}`, label: `${names(o.name).main} (${names(g.name).main})`, group: 'Add-ons' }))),
  ];
}

/** The database's to set: an automatic step is never marked done by hand, and of them only the review may be skipped. */
export const automaticOnly = (step: OnboardingStep, state: OnboardingState): boolean =>
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
        const amount = parsePrice(f.price);
        if (amount === undefined || (amount !== null && amount > LIMITS.price)) {
          return no('Write the price in shekels with digits and at most one decimal point (for example 54 or 54.50), or leave it empty for no price.');
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

/**
 * Shekels as typed, to agorot: digits with at most one decimal separator and two decimals ("54", "54.5", "54,50").
 * '' is no price (null); anything else ("1e3", "0x10", "-2", "5.") is not a price (undefined).
 */
export function parsePrice(typed: string): number | null | undefined {
  const s = typed.trim();
  if (s === '') return null;
  const m = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return undefined;
  return Number(m[1]) * 100 + (m[2] ? Number(m[2].padEnd(2, '0')) : 0);
}

/** A `stale` refusal carries the row as it is now (the dish, or the onboarding step): that, in words. It never says who
 * changed it: another staff member, a send whose answer was lost, or the owner. */
export function staleNow(f: Fail): string | null {
  const cur = f.code === 'stale' && f.reply && isObject(f.reply.current) ? f.reply.current : null;
  if (!cur) return null;
  if (f.reply?.action === 'onboarding.set') {
    const st = cur.state;
    return typeof st === 'string' && st in STATE_LABEL ? `Now the step is ${STATE_LABEL[st as OnboardingState].toLowerCase()}.` : null;
  }
  const parts = [typeof cur.price === 'number' || cur.price === null ? `the price in the owner’s menu is ${money(cur.price as number | null)}` : null,
    typeof cur.hidden === 'boolean' ? (cur.hidden ? 'it is hidden from guests' : 'it is shown to guests') : null].filter(Boolean);
  return parts.length ? `Now ${parts.join(' and ')}.` : null;
}

/** Every column the patch sets already holds that value in the row. */
export const holds = (row: Readonly<Record<string, unknown>>, patch: unknown): boolean =>
  isObject(patch) && Object.keys(patch).length > 0 && Object.entries(patch).every(([k, v]) => k in row && row[k] === v);

/**
 * A `stale` refusal whose current row already holds what this change sets: Halom's own change (a send whose answer was
 * lost, or another staff member's), recognised by its value. The words for it, or null.
 */
export function alreadySo(f: Fail, input: ActForOwnerInput): string | null {
  const cur = f.code === 'stale' && f.reply && isObject(f.reply.current) ? f.reply.current : null;
  if (!cur) return null;
  const p = input.payload as Readonly<Record<string, unknown>>;
  const so = input.action === 'dish.update' ? holds(cur, p.patch) : input.action === 'onboarding.set' ? cur.state === p.state && cur.step === p.step : false;
  return so ? `Already so: ${staleNow(f)?.replace(/^Now /, '') ?? 'the change is there'} The change is in place (an earlier send whose answer was lost, or another Halom staff member); nothing more was sent.` : null;
}

