// The one nesting level (D37, ADR-002) as the editor applies it, so the owner is never offered a second level:
// an option may open a group, but a group that some option opens may not hold an option that opens another, and a group
// whose options open groups may not be opened itself. The database (app.guard_nesting) and both snapshot validators
// refuse the same; these functions decide what the editor shows. Pure.
import type { AddonGroupRow, AddonOptionRow } from '@mana/contracts';

type Opt = Pick<AddonOptionRow, 'id' | 'group_id' | 'opens_group_id'>;

/** Groups that an option (other than `except`) opens. */
export function openedGroups(options: readonly Opt[], except: ReadonlySet<string> = new Set()): Set<string> {
  const out = new Set<string>();
  for (const o of options) if (o.opens_group_id && !except.has(o.id)) out.add(o.opens_group_id);
  return out;
}

/** Groups holding an option (other than `except`) that opens a group. */
export function openerGroups(options: readonly Opt[], except: ReadonlySet<string> = new Set()): Set<string> {
  const out = new Set<string>();
  for (const o of options) if (o.opens_group_id && !except.has(o.id)) out.add(o.group_id);
  return out;
}

/** May this group's options open a group? Not when another option already opens this group. */
export function canHoldOpeners(groupId: string | null, options: readonly Opt[]): boolean {
  return groupId === null || !openedGroups(options).has(groupId);
}

/**
 * The groups an option of `groupId` may open (null = a group not saved yet): never the group itself, never a group
 * whose own options open one, and nothing at all when `groupId` is itself opened by an option. The group's own
 * options are left out of the reckoning, since the form being edited replaces them.
 */
export function openTargets<G extends Pick<AddonGroupRow, 'id'>>(groupId: string | null, groups: readonly G[], options: readonly Opt[]): G[] {
  if (!canHoldOpeners(groupId, options)) return [];
  const mine = new Set(options.filter((o) => o.group_id === groupId).map((o) => o.id));
  const openers = openerGroups(options, mine);
  return groups.filter((g) => g.id !== groupId && !openers.has(g.id));
}

/**
 * What the database would say about a group's options opening these groups (null = nothing): `opens_self`, or
 * `nesting_too_deep` when the group is opened by another option or a target's own options open a group.
 */
export function nestingProblem(groupId: string | null, opens: readonly (string | null)[], options: readonly Opt[]): 'opens_self' | 'nesting_too_deep' | null {
  const targets = opens.filter((x): x is string => x !== null);
  if (targets.length === 0) return null;
  if (groupId !== null && targets.includes(groupId)) return 'opens_self';
  const allowed = new Set(openTargets(groupId, targets.map((id) => ({ id })), options).map((g) => g.id));
  return targets.every((t) => allowed.has(t)) ? null : 'nesting_too_deep';
}
